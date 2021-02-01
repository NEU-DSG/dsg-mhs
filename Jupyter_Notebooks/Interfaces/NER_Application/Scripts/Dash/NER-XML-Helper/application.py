#!/usr/bin/env python
# coding: utf-8

import warnings, re, glob, datetime, csv, sys, os, base64, io, spacy
import pandas as pd
import numpy as np
from lxml import etree

import dash, dash_table
import dash_core_components as dcc
from dash.dependencies import Input, Output, State
import dash_html_components as html
# from jupyter_dash import JupyterDash

# Import spaCy language model.
nlp = spacy.load('en_core_web_sm')

# Ignore simple warnings.
warnings.simplefilter('ignore', DeprecationWarning)


# """
# XML Parsing Function: Get Namespaces
# """
def get_namespace(root):
    namespace = re.match(r"{(.*)}", str(root.tag))
    ns = {"ns":namespace.group(1)}
    return ns



# """
# XML Parsing Function: Retrieve XPaths
# """
def get_abridged_xpath(child):
    if child.getparent().get('{http://www.w3.org/XML/1998/namespace}id') is not None:
        ancestor = child.getparent().tag
        xml_id = child.getparent().get('{http://www.w3.org/XML/1998/namespace}id')

        abridged_xpath = f'.//ns:body//{ancestor}[@xml:id="{xml_id}"]/{child.tag}'
        return abridged_xpath


# """
# XML Parsing Function: Convert to String
# """
def get_text(elem):
    text_list = []
    text = ''.join(etree.tostring(elem, encoding='unicode', method='text', with_tail=False))
    text_list.append(re.sub(r'\s+', ' ', text))
    return ' '.join(text_list)


# """
# XML Parsing Function: Get Encoded Content
# """
def get_encoding(elem):
    encoding = etree.tostring(elem, pretty_print = True).decode('utf-8')
    encoding = re.sub('\s+', ' ', encoding) # remove additional whitespace
    return encoding




# """
# XML Parsing Function: Write New Encoding with Up-Conversion
# """
def make_ner_suggestions(previous_encoding, entity, label, subset_ner, kwic_range, banned_list):
#     Regularize spacing & store data as new variable ('converted_encoding').
    converted_encoding = re.sub('\s+', ' ', previous_encoding, re.MULTILINE)

#     Create regex that replaces spaces with underscores if spaces occur within tags.
#     This regex treats tags as a single token later.
    tag_regex = re.compile('<(.*?)>')

#     Accumulate underscores through iteration
    for match in re.findall(tag_regex, previous_encoding):
        replace_space = re.sub('\s', '_', match)
        converted_encoding = re.sub(match, replace_space, converted_encoding)

#     Up-convert entity (label remains unchanged).
    label = subset_ner[label]
    converted_entity = ' '.join(['<w>' + e + '</w>' for e in entity.split(' ')])

#     Up-Converstion
#     Tokenize encoding and text, appending <w> tags, and re-join.
    converted_encoding = converted_encoding.split(' ')
    for idx, item in enumerate(converted_encoding):
        item = '<w>' + item + '</w>'
        converted_encoding[idx] = item

    converted_encoding = ' '.join(converted_encoding)

#     Find converted entities and kwic-converted entities, even if there's additional encoding within entity.
    try:
        entity_regex = re.sub('<w>(.*)</w>', '(\\1)(.*?</w>)', converted_entity)
        entity_match = re.search(entity_regex, converted_encoding)

        ban_decision = []
        for i in banned_list:
            if i in entity_match.group(0):
                ban_decision.append('y')

        if 'y' in ban_decision:
            return "Already Encoded"

#         If expanded regex is in previous encoding, find & replace it with new encoding.
        elif entity_match:
            new_encoding = re.sub(f'{entity_match.group(0)}',
                                  f'<{label}>{entity_match.group(1)}</{label}>{entity_match.group(2)}',
                                  converted_encoding)

#             Remove <w> tags to return to well-formed xml.
            new_encoding = re.sub('<[/]?w>', '', new_encoding)
#             Remove underscores.
            new_encoding = re.sub('_', ' ', new_encoding)

            return new_encoding

        else:
            return 'Error Making NER Suggestions'

#     Up-conversion works well because it 'breaks' if an entity already has been encoded:
#     <w>Abel</w> (found entity) does not match <w><persRef_ref="abel-mary">Mrs</w> <w>Abel</persRef></w>
#     <persRef> breaks function and avoids duplicating entities.

    except:
        return 'Error Occurred with Regex.'



# """
# NER Function
# """
def get_spacy_entities(text, subset_ner):
    sp_entities_l = []
    doc = nlp(text)
    for ent in doc.ents:
        if ent.label_ in subset_ner.keys():
            sp_entities_l.append((str(ent), ent.label_))
        else:
            pass
    return sp_entities_l


# """
# XML & NER: Retrieve Contents
# """
def get_contents(ancestor, xpath_as_string, namespace, subset_ner):

    textContent = get_text(ancestor) # Get plain text.
    encodedContent = get_encoding(ancestor) # Get encoded content.
    sp_entities_l = get_spacy_entities(textContent, subset_ner) # Get named entities from plain text.

    return (sp_entities_l, encodedContent)


# """
# XML: & NER: Create Dataframe of Entities
# """
def make_dataframe(child, df, ns, subset_ner, filename, descendant_order):
    abridged_xpath = get_abridged_xpath(child)
    entities, previous_encoding = get_contents(child, './/ns:.', ns, subset_ner)

    df = df.append({
        'file':re.sub('.*/(.*.xml)', '\\1', filename),
        'descendant_order': descendant_order,
#         'abridged_xpath':abridged_xpath,
        'previous_encoding': previous_encoding,
        'entities':entities,
    },
        ignore_index = True)

    return df


# """
# Parse Contents: XML Structure (ouput-data-upload)
# """
def parse_contents(contents, filename, date, ner_values):
    ner_values = ner_values.split(',')
    content_type, content_string = contents.split(',')
    decoded = base64.b64decode(content_string).decode('utf-8')

    label_dict = {'PERSON':'persName',
                  'LOC':'placeName', # Non-GPE locations, mountain ranges, bodies of water.
                  'GPE':'placeName', # Countries, cities, states.
                  'FAC':'placeName', # Buildings, airports, highways, bridges, etc.
                  'ORG':'orgName', # Companies, agencies, institutions, etc.
                  'NORP':'name', # Nationalities or religious or political groups.
                  'EVENT':'name', # Named hurricanes, battles, wars, sports events, etc.
                  'WORK_OF_ART':'name', # Titles of books, songs, etc.
                  'LAW':'name', # Named documents made into laws.
                 }

    #### Subset label_dict with input values from Checklist *****
    subset_ner = {k: label_dict[k] for k in ner_values}

#     Run XML Parser + NER here.
    try:
#         Assume that the user uploaded a CSV file
        if 'csv' in filename:
            df = pd.read_csv(
                io.StringIO(decoded)
            )

#         Assume that the user uploaded an XML file
        elif 'xml' in filename:
            xml_file = decoded.encode('utf-8')

            df = pd.DataFrame(columns = ['file', 'abridged_xpath', 'previous_encoding', 'entities'])

            root = etree.fromstring(xml_file)
            ns = get_namespace(root)

#             Search through elements for entities.
            desc_order = 0
            for child in root.findall('.//ns:body//ns:div[@type="docbody"]', ns):

                abridged_xpath = get_abridged_xpath(child)

                for descendant in child:
                    desc_order = desc_order + 1
                    df = make_dataframe(descendant, df, ns, subset_ner, filename, desc_order)
                    df['abridged_xpath'] = abridged_xpath

#             Join data
            df = df \
                .explode('entities') \
                .dropna()

            df[['entity', 'label']] = pd.DataFrame(df['entities'].tolist(), index = df.index)

            df['new_encoding'] = df \
                .apply(lambda row: make_ner_suggestions(row['previous_encoding'],
                                                        row['entity'],
                                                        row['label'],
                                                        subset_ner, 4, banned_list),
                       axis = 1)


            # Add additional columns for user input.
            df['accept_changes'] = ''
            df['make_hand_edits'] = ''

#             Drop rows if 'new_encoding' value equals 'Already Encoded'.
            df = df[df['new_encoding'] != 'Already Encoded']


    except Exception as e:
        return html.Div([
            f'There was an error processing this file: {e}.'
    ])


#     Return HTML with outputs.
    return html.Div([

#         Print file info.
        html.Div([
            html.H4('File Information'),
            html.P(f'{filename}, {datetime.datetime.fromtimestamp(date)}'),
        ]),

        html.Br(),

#         Return data table of element and attribute info.
        dash_table.DataTable(
            data = df.to_dict('records'),
            columns = [{'name':i, 'id':i} for i in df.columns],
            page_size=5,
            export_format = 'csv',

            style_cell_conditional=[
                {
                    'if': {'column_id': c},
                    'textAlign': 'left'
                } for c in ['Date', 'Region']
            ],
            style_data_conditional=[
                {
                    'if': {'row_index': 'odd'},
                    'backgroundColor': 'rgb(248, 248, 248)'
                }
            ],
            style_header={
                'backgroundColor': 'rgb(230, 230, 230)',
                'fontWeight': 'bold'
            }
        ),
    ])


app = dash.Dash(__name__)
application = app.server

# Preset Variables.
ner_labels = ['PERSON','LOC','GPE','FAC','ORG','NORP','EVENT','WORK_OF_ART','LAW']

# Banned List (list of elements that already encode entities)
banned_list = ['persRef']

# Layout.
app.layout = html.Div([
#     Title
    html.H1('Named Entity Recognition Helper'),

#     Add or substract labels to list for NER to find. Complete list of NER labels: https://spacy.io/api/annotation
    html.H2('Select Entities to Search For'),
    dcc.Checklist(
        id = 'ner-checklist',
        options = [{
            'label': i,
            'value': i
        } for i in ner_labels],
        value = ['PERSON', 'LOC', 'GPE']
    ),


#     Upload Data Area.
    html.H2('Upload File'),
    dcc.Upload(
        id = 'upload-data',
        children = html.Div([
            'Drag and Drop or ', html.A('Select File')
        ]),
        style={
            'width': '95%',
            'height': '60px',
            'lineHeight': '60px',
            'borderWidth': '1px',
            'borderStyle': 'dashed',
            'borderRadius': '5px',
            'textAlign': 'center',
            'margin': '10px'
        },
        multiple=True # Allow multiple files to be uploaded
    ),
    html.Div(id = 'output-data-upload'),
])

# Callbacks.
# Upload callback variables & function.
@app.callback(Output('output-data-upload', 'children'),
              [Input('upload-data', 'contents'), Input('ner-checklist', 'value')],
              [State('upload-data', 'filename'), State('upload-data', 'last_modified')])

def update_output(list_of_contents, ner_values, list_of_names, list_of_dates):
    if list_of_contents is not None:
        children = [
            parse_contents(c, n, d, ner) for c, n, d, ner in
            zip(list_of_contents, list_of_names, list_of_dates, ner_values)
        ]
        return children


if __name__ == "__main__":
    # Beanstalk expects app to be running on 8080.
    application.run(port = 8080)
