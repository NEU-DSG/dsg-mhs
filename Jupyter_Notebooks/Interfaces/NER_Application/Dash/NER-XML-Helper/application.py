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


"""
XML Parsing Function: Get Namespaces
"""
def get_namespace(root):
    namespace = re.match(r"{(.*)}", str(root.tag))
    ns = {"ns":namespace.group(1)}
    return ns


"""
XML Parsing Function: Retrieve XPaths
"""
def get_abridged_xpath(child):
    if child.getparent().get('{http://www.w3.org/XML/1998/namespace}id') is not None:
        ancestor = child.getparent().tag
        xml_id = child.getparent().get('{http://www.w3.org/XML/1998/namespace}id')

        abridged_xpath = f'.//ns:body//{ancestor}[@xml:id="{xml_id}"]/{child.tag}'
        return abridged_xpath


"""
XML Parsing Function: Convert to String
"""
def get_text(elem):
    text_list = []
    text = ''.join(etree.tostring(elem, encoding='unicode', method='text', with_tail=False))
    text_list.append(re.sub(r'\s+', ' ', text))
    return ' '.join(text_list)


"""
XML Parsing Function: Get Encoded Content
"""
def get_encoding(elem):
    encoding = etree.tostring(elem, pretty_print = True).decode('utf-8')
    encoding = re.sub('\s+', ' ', encoding) # remove additional whitespace
    return encoding




"""
NER Function
"""
# spaCy
def get_spacy_entities(text, subset_ner):
    sp_entities_l = []
    doc = nlp(text)
    for ent in doc.ents:
        if ent.label_ in subset_ner.keys():
            sp_entities_l.append((str(ent), ent.label_))
        else:
            pass
    return sp_entities_l




"""
XML & NER: Retrieve Contents
"""
def get_contents(ancestor, xpath_as_string, namespace, subset_ner):

    textContent = get_text(ancestor) # Get plain text.
    encodedContent = get_encoding(ancestor) # Get encoded content.
    sp_entities_l = get_spacy_entities(textContent, subset_ner) # Get named entities from plain text.

    return (sp_entities_l, encodedContent)




"""
XML Parsing Function: Write New Encoding with Up-Conversion
"""
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




"""
XML: & NER: Create Dataframe of Entities
"""
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



"""
Parse Contents: XML Structure (ouput-data-upload)
"""
def parse_contents(contents, filename, date, ner_values):
    ner_values = ner_values.split(',')
    content_type, content_string = contents.split(',')
    decoded = base64.b64decode(content_string).decode('utf-8')

    # Label dictionary.
    label_dict = {'PERSON':'persRef',
                  'LOC':'placeName', # Non-GPE locations, mountain ranges, bodies of water.
                  'GPE':'placeName', # Countries, cities, states.
                  'FAC':'placeName', # Buildings, airports, highways, bridges, etc.
                  'ORG':'orgName', # Companies, agencies, institutions, etc.
                  'NORP':'name', # Nationalities or religious or political groups.
                  'EVENT':'name', # Named hurricanes, battles, wars, sports events, etc.
                  'WORK_OF_ART':'name', # Titles of books, songs, etc.
                  'LAW':'name', # Named documents made into laws.
                  'DATE':'date' # Absolute or relative dates or periods.
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
            df['uniq_id'] = ''

#             Drop rows if 'new_encoding' value equals 'Already Encoded'.
            df = df[df['new_encoding'] != 'Already Encoded']


    except Exception as e:
        return html.Div([
            f'There was an error processing this file: {e}.'
    ])


#     Return HTML with outputs.
    return filename, date, df



"""
XML & Regex: Up Conversion

Function replaces all spaces between beginning and end tags with underscores.
Then, function wraps each token (determined by whitespace) with word tags (<w>...</w>)
"""
def up_convert_encoding(column):
#     Regularize spacing & store data as new variable ('converted_encoding').
    converted_encoding = re.sub('\s+', ' ', column, re.MULTILINE)

#     Create regex that replaces spaces with underscores if spaces occur within tags.
#     This regex treats tags as a single token later.
    tag_regex = re.compile('<(.*?)>')

#     Accumulate underscores through iteration
    for match in re.findall(tag_regex, column):
        replace_space = re.sub('\s', '_', match)
        converted_encoding = re.sub(match, replace_space, converted_encoding)

#     Up-Converstion
#     Tokenize encoding and text, appending <w> tags, and re-join.
    converted_encoding = converted_encoding.split(' ')
    for idx, item in enumerate(converted_encoding):
        item = '<w>' + item + '</w>'
        converted_encoding[idx] = item
    converted_encoding = ' '.join(converted_encoding)

    return converted_encoding


"""
XML: Remove word tags and clean up
"""
def xml_cleanup(encoding):
#     Clean up any additional whitespace and remove word tags.
    encoding = re.sub('\s+', ' ', encoding, re.MULTILINE)
    encoding = re.sub('<[/]?w>', '', encoding)

    encoding = re.sub('_', ' ', encoding) # Remove any remaining underscores in tags.
    encoding = re.sub('“', '"', encoding) # Change quotation marks to correct unicode.
    encoding = re.sub('”', '"', encoding)

    return encoding


"""
Reading Pane: Highlight Found Entity
"""
def highlighter(previous_encoding, entity):
    highlighted_text = etree.fromstring(previous_encoding)
    highlighted_text = etree.tostring(highlighted_text, method = 'text', encoding = 'utf-8').decode('utf-8')

    entity_match = re.search(f'(.*)({entity})(.*)', highlighted_text)

    highlighted_text = html.P([entity_match.group(1), html.Mark(entity_match.group(2)), entity_match.group(3)])

    return highlighted_text


"""
XML Parsing Function: Suggest New Encoding with Hand Edits

Similar to make_ner_suggestions(), this function folds in revision using regular expressions.
The outcome is the previous encoding with additional encoded information determined by user input.

Expected Columns:
    previous_encoding
    entities
    uniq_id
"""
def revise_with_uniq_id(label_dict, uniq_id,
                           label, entity, previous_encoding, new_encoding):

    label = label_dict[label]

#     Up convert PREVIOUS ENCODING: assumes encoder will supply new encoding and attribute with value.
    converted_encoding = up_convert_encoding(previous_encoding)
    converted_entity = ' '.join(['<w>' + e + '</w>' for e in entity.split(' ')])

#     If there is a unique id to add & hand edits...
    if uniq_id != '':

        entity_regex = re.sub('<w>(.*)</w>', '(\\1)(.*?</w>)', converted_entity)
        entity_match = re.search(entity_regex, converted_encoding)

        revised_encoding = re.sub(f'{entity_match.group(0)}',
                                  f'<{label} ref="{uniq_id}" type="nerHelper-added">{entity_match.group(1)}</{label}>{entity_match.group(2)}',
                                  converted_encoding)

        revised_encoding = xml_cleanup(revised_encoding)

        return revised_encoding

    else:
        pass


"""
XML Parsing Function: Suggest New Encoding with Hand Edits

Similar to make_ner_suggestions(), this function folds in revision using regular expressions.
The outcome is the previous encoding with additional encoded information determined by user input.

Expected Columns:
    previous_encoding
    entities
    uniq_id
"""
def revise_without_uniq_id(label_dict, uniq_id,
                           label, entity, previous_encoding, new_encoding):

    label = label_dict[label]

#     Up convert PREVIOUS ENCODING: assumes encoder will supply new encoding and attribute with value.
    converted_encoding = up_convert_encoding(previous_encoding)
    converted_entity = ' '.join(['<w>' + e + '</w>' for e in entity.split(' ')])

#     If there is a unique id to add & hand edits...
    if uniq_id == '':

        entity_regex = re.sub('<w>(.*)</w>', '(\\1)(.*?</w>)', converted_entity)
        entity_match = re.search(entity_regex, converted_encoding)

        revised_encoding = re.sub(f'{entity_match.group(0)}',
                                  f'<{label} type="nerHelper-added">{entity_match.group(1)}</{label}>{entity_match.group(2)}',
                                  converted_encoding)

        revised_encoding = xml_cleanup(revised_encoding)

        return revised_encoding

    else:
        pass


"""
XML & NER: Update/Inherit Accepted Changes
Expects a dataframe (from a .csv) with these columns:
    file
    abridged_xpath
    descendant_order
    previous_encoding
    entities
    new_encoding
    uniq_id
"""
def inherit_changes(label_dict, dataframe):

    dataframe = dataframe.fillna('')
    for index, row in dataframe.iterrows():

#         If HAND changes are accepted...
        if row['uniq_id'] != '':

            revised_by_hand = revise_with_uniq_id(label_dict, row['uniq_id'],
                                                  row['label'], row['entity'],
                                                  row['previous_encoding'], row['new_encoding'])

            dataframe.loc[index, 'new_encoding'] = revised_by_hand

            try:
                if dataframe.loc[index + 1, 'abridged_xpath'] == row['abridged_xpath'] \
                and dataframe.loc[index + 1, 'descendant_order'] == row['descendant_order']:
                    dataframe.loc[index + 1, 'previous_encoding'] = row['new_encoding']

                else:
                    dataframe.loc[index, 'new_encoding'] = revised_by_hand


            except KeyError as e:
                dataframe.loc[index, 'new_encoding'] = revised_by_hand

#         If NER suggestions are accepted as-is...
        elif row['label'] != '' and row['uniq_id'] == '':

            revised_no_uniq_id = revise_without_uniq_id(label_dict, row['uniq_id'],
                                                        row['label'], row['entity'],
                                                        row['previous_encoding'], row['new_encoding'])

            dataframe.loc[index, 'new_encoding'] = revised_no_uniq_id

            try:
                if dataframe.loc[index + 1, 'abridged_xpath'] == row['abridged_xpath'] \
                and dataframe.loc[index + 1, 'descendant_order'] == row['descendant_order']:
                    dataframe.loc[index + 1, 'previous_encoding'] = row['new_encoding']

                else:
                    dataframe.loc[index, 'new_encoding'] = row['new_encoding']

            except KeyError as e:
                dataframe.loc[index, 'new_encoding'] = row['new_encoding']

#         If changes are rejected...
        else:
            try:
                if dataframe.loc[index + 1, 'abridged_xpath'] == row['abridged_xpath'] \
                and dataframe.loc[index + 1, 'descendant_order'] == row['descendant_order']:
                    dataframe.loc[index + 1, 'previous_encoding'] = dataframe.loc[index, 'previous_encoding']

            except KeyError as e:
                dataframe.loc[index, 'new_encoding'] = dataframe.loc[index, 'previous_encoding']

#     Subset dataframe with finalized revisions.
    dataframe = dataframe.groupby(['abridged_xpath', 'descendant_order']).tail(1)

    return dataframe


"""
XML: Write <change> to <revisionDesc>
Expects:
    XML File (xml_contents in revise_xml())

Output:
    Writes changes directly to xml structure (root)
"""
def append_change_to_revisionDesc(root, ns):
#     Create a change element for revisionDesc.
#     If revisionDesc already exists...
    if root.find('.//ns:teiHeader/ns:revisionDesc', ns):
        revision_desc = root.find('.//ns:teiHeader/ns:revisionDesc', ns)

        new_change = etree.SubElement(revision_desc, 'change',
                                      when = str(datetime.datetime.now().strftime("%Y-%m-%d")),
                                      who = '#nerHelper')

        new_change.text = f"Entities added by NER (spaCy: {spacy.__version__}) application."
#     Else, create revisionDesc with SubElement, then change.
    else:
        teiHeader = root.find('.//ns:teiHeader', ns)
        revision_desc = etree.SubElement(teiHeader, 'revisionDesc')
        new_change = etree.SubElement(revision_desc, 'change',
                                      when = str(datetime.datetime.now().strftime("%Y-%m-%d")),
                                      who = '#nerHelper')
        new_change.text = f"Entities added by NER (spaCy: {spacy.__version__}) application."



"""
XML: Write <application> to <appInfo>
Expects:
    XML File (xml_contents in revise_xml())

Output:
    Writes changes directly to xml structure (root)
"""
def append_app_to_appInfo(root, ns):
#     If <appInfo> already exists...
    if root.find('.//ns:teiHeader//ns:appInfo', ns):
        app_info = root.find('.//ns:teiHeader//ns:appInfo', ns)

        ner_app_info = etree.SubElement(app_info, 'application',
                                        ident = 'nerHelper',
                                        version = "0.1")

        # Without saving a variable.
        etree.SubElement(ner_app_info, 'label').text = 'nerHelper App'
        etree.SubElement(ner_app_info, 'p').text = f'Entities added with spaCy-{spacy.__version__}.'

#     If <appInfo> missing BUT <encodingDesc> exists...
    elif root.find('.//ns:teiHeader/ns:encodingDesc', ns):
        encoding_desc = root.find('.//ns:teiHeader/ns:encodingDesc', ns)

        app_info = etree.SubElement(encoding_desc, 'appInfo')

        ner_app_info = etree.SubElement(app_info, 'application',
                                ident = 'nerHelper',
                                version = "0.1")

        etree.SubElement(ner_app_info, 'label').text = 'nerHelper App'
        etree.SubElement(ner_app_info, 'p').text = f'Entities added with spaCy-{spacy.__version__}.'

#     Else <appInfo> and <encodingDesc> missing...
    else:
        teiHeader = root.find('.//ns:teiHeader', ns)

        encoding_desc = etree.SubElement(teiHeader, 'encodingDesc')

        app_info = etree.SubElement(encoding_desc, 'appInfo')

        ner_app_info = etree.SubElement(app_info, 'application',
                                ident = 'nerHelper',
                                version = "0.1")

        etree.SubElement(ner_app_info, 'label').text = 'nerHelper App'
        etree.SubElement(ner_app_info, 'p').text = f'Entities added with spaCy-{spacy.__version__}.'



"""
XML & NER: Write New XML File with Accepted Revisions
Expects:
    XML File with Original Encoding
    CSV File with Accepted Changes
    Label Dictionary
"""
def revise_xml(xml_contents, csv_df):
#     Label dictionary.
    label_dict = {'PERSON':'persRef',
                  'LOC':'placeName', # Non-GPE locations, mountain ranges, bodies of water.
                  'GPE':'placeName', # Countries, cities, states.
                  'FAC':'placeName', # Buildings, airports, highways, bridges, etc.
                  'ORG':'orgName', # Companies, agencies, institutions, etc.
                  'NORP':'name', # Nationalities or religious or political groups.
                  'EVENT':'name', # Named hurricanes, battles, wars, sports events, etc.
                  'WORK_OF_ART':'name', # Titles of books, songs, etc.
                  'LAW':'name', # Named documents made into laws.
                  'DATE':'date' # Absolute or relative dates or periods.
                 }

#     First, update data to reflect accepted changes.
    new_data = inherit_changes(label_dict, csv_df)

    xml_content_type, xml_content_string = xml_contents.split(',')
    xml_decoded = base64.b64decode(xml_content_string).decode('utf-8')
    xml_file = xml_decoded.encode('utf-8')

    root = etree.fromstring(xml_file)
    ns = get_namespace(root)

#     Add <change> to <revisionDesc> and add <application> to <appInfo>
    append_change_to_revisionDesc(root, ns)
    append_app_to_appInfo(root, ns) # Does not need to save as variable; changes written to root.


#     Convert XML structure to string for regex processing.
    tree_as_string = etree.tostring(root, pretty_print = True).decode('utf-8')
    tree_as_string = re.sub('\s+', ' ', tree_as_string) # remove additional whitespace

#     Write accepted code into XML tree.
    for index, row in new_data.iterrows():
        original_encoding_as_string = row['previous_encoding']

        # Remove namespaces within tags to ensure regex matches accurately.
        original_encoding_as_string = re.sub('^<(.*?)( xmlns.*?)>(.*)$',
                                             '<\\1>\\3',
                                             original_encoding_as_string)

        accepted_encoding_as_string = row['new_encoding']
        accepted_encoding_as_string = re.sub('<(.*?)( xmlns.*?)>(.*)$',
                                             '<\\1>\\3',
                                             accepted_encoding_as_string) # Remove namespaces within tags.

        tree_as_string = re.sub(original_encoding_as_string,
                                accepted_encoding_as_string,
                                tree_as_string)


#     Check well-formedness (will fail if not well-formed)
    doc = etree.fromstring(tree_as_string)
    et = etree.ElementTree(doc)

#     Convert to string.
    et = etree.tostring(et, encoding='unicode', method='xml', pretty_print = True)
    return et


"""
XML: Write Schema Information before Root
Input:
    - Revised XML document (return variable from revise_xml())
    - XML File with Original Encoding
"""
def write_schema_information(xml_contents, final_revisions):
    xml_content_type, xml_content_string = xml_contents.split(',')
    xml_decoded = base64.b64decode(xml_content_string).decode('utf-8')

    xml_file = xml_decoded.encode('utf-8').decode('utf-8')
    xml_file = re.sub('\s+', ' ', xml_file)

    schema_match = re.search('(<?.*)(<TEI.*)', xml_file)
    schema_match = schema_match.group(1)

    completed_document = schema_match + final_revisions

    return completed_document


app = dash.Dash(__name__)
app.config.suppress_callback_exceptions = True
application = app.server

# Preset Variables.
ner_labels = ['PERSON','LOC','GPE','FAC','ORG','NORP','EVENT','WORK_OF_ART','LAW']

# Banned List (list of elements that already encode entities)
banned_list = ['persRef']


# Layout.
app.layout = html.Div([

#     Title
    html.Header(
        className="app-header",
        children = [
            html.Div('nerHelper Application', className = "app-header--title")
        ]),

#     Add or substract labels to list for NER to find. Complete list of NER labels: https://spacy.io/api/annotation
    html.H2('NER Labels & Definitions'),

#     Add legend & checklist for ner_labels.
    html.Table([
        html.Thead([
            html.Tr([
                html.Th('Label'),
                html.Th('Definition'),
            ]),
        ]),
        html.Tbody([
            html.Tr([
                html.Td('PERSON'),
                html.Td('A person\'s name (proper noun)' ),
            ]),
            html.Tr([
                html.Td('LOC'),
                html.Td('Non-GPE locations, mountain ranges, bodies of water.' ),
            ]),
            html.Tr([
                html.Td('GPE'),
                html.Td('Countries, cities, states.' ),
            ]),
            html.Tr([
                html.Td('FAC'),
                html.Td('Buildings, airports, highways, bridges, etc.' ),
            ]),
            html.Tr([
                html.Td('ORG'),
                html.Td('Companies, agencies, institutions, etc.' ),
            ]),
            html.Tr([
                html.Td('NORP'),
                html.Td('Nationalities or religious or political groups.' ),
            ]),
            html.Tr([
                html.Td('EVENT'),
                html.Td('Named hurricanes, battles, wars, sports events, etc.' ),
            ]),
            html.Tr([
                html.Td('WORK_OF_ART'),
                html.Td('Titles of books, songs, etc.' ),
            ]),
            html.Tr([
                html.Td('LAW'),
                html.Td('Named documents made into laws.' ),
            ]),
            html.Tr([
                html.Td('DATE'),
                html.Td('Absolute or relative dates or periods.' ),
            ]),
        ]),
    ]),

    #     Add or substract labels to list for NER to find. Complete list of NER labels: https://spacy.io/api/annotation
    html.H2('Select Entities to Search For'),

    dcc.Checklist(
        className = 'ner-checklist',
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
        className = 'upload-data',
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

#     Store uploaded data.
    dcc.Store(id = 'data-upload-store'),

#     Display pane for file information.
    html.Div(className = 'file-information', id = 'file-information'),

#     Display pane for data as table.
    dash_table.DataTable(id = 'data-table-container',
                         row_selectable="single",
                         selected_rows = [0],
                         editable = True,
                         page_size=1,
                        ),

#     Display pane for reading data from selected row & revision options.
    html.Div(className = 'reading-container', id = 'reading-container'),
    html.Div(id = 'revision-radio-container'),
    html.Div(id = 'revision-text-container'),
    html.Div(id = 'revision-button-container'),

    dcc.ConfirmDialog(
        id='confirm',
        message='You must include an ID when selecting PERSON.',
    ),

#     Store revised data.
    dcc.Store(id = 'revisions-store'),


#     Div to hold button that will write and download XML file.
    html.Div(id = 'write-button-container'),

    html.Div(id = 'download-button-container')
])



####################################################################################################################
####################################################################################################################
######### Callbacks ################################################################################################
####################################################################################################################
####################################################################################################################



# Upload data & create table.
@app.callback([Output('file-information', 'children'),
               Output('data-upload-store', 'data')],
              [Input('upload-data', 'contents'),
               Input('ner-checklist', 'value')],
              [State('upload-data', 'filename'),
               State('upload-data', 'last_modified')])
def upload_data(list_of_contents, ner_values, list_of_names, list_of_dates):
    if list_of_contents is None:
        raise PreventUpdate

#     Parse uploaded contents.
    children = [
        parse_contents(c, n, d, ner) for c, n, d, ner in
        zip(list_of_contents, list_of_names, list_of_dates, ner_values)
    ]
    data = children[0][2]

#     Extract file information.
    file_information = html.Div([html.P(f'File name: {children[0][0]}'),
                                 html.P(f'Last Modified: {datetime.datetime.fromtimestamp(children[0][1])}')])

    return file_information, data.to_dict('rows')



# Generate table with data from store.
@app.callback([Output('data-table-container', 'data'),
               Output('data-table-container', 'columns')],
              Input('data-upload-store', 'data'))
def populate_data_table(data):

    df = pd.DataFrame(data)[['file', 'entity', 'label']]
    cols = [{'name':i, 'id': i} for i in df.columns]

    return df.to_dict('rows'), cols



# Create reading pane & revision options once row from table is selected.
@app.callback([Output('reading-container', 'children'),
               Output('revision-radio-container', 'children'),
               Output('revision-text-container', 'children'),
               Output('revision-button-container', 'children')],
              [Input('data-upload-store', 'data'),
               Input('data-table-container', 'selected_rows')])
def create_reading_and_revisions_pane(data, selected_rows):
    if data is None:
        raise PreventUpdate

    reading_df = pd.DataFrame(data).iloc[selected_rows]

#     Access previous and new encoding and squeeze() them to return only scalar (the text).
#     Use highlighter() to re-construct previous_encoding with html.Mark() around found entity.
    highlighted_text = highlighter(reading_df['previous_encoding'].squeeze(),
                                   reading_df['entity'].squeeze())

    reading_pane = html.Div([
        html.H2('Found Entity'),
        html.Div(highlighted_text),
        html.H2('Revisions Options'),
        html.P("""
        Please confirm the correct label that describes the entity.
        If you've selected 'PERSON,' you must also hand-type an reference identifier below.
        The reference identifier should match an entity in the names authority database.
        """),
    ])

#     Choose correct entity label with radio buttons.
    revision_radio = dcc.RadioItems(
        className = 'radio-input',
        id = 'radioInput',
        options = [{'label':'PERSON', 'value':'PERSON'},
                   {'label':'LOC', 'value':'LOC'},
                   {'label':'GPE', 'value':'GPE'},
                   {'label':'FAC', 'value':'FAC'},
                   {'label':'ORG', 'value':'ORG'},
                   {'label':'NORP', 'value':'NORP'},
                   {'label':'EVENT', 'value':'EVENT'},
                   {'label':'WORK_OF_ART', 'value':'WORK_OF_ART'},
                   {'label':'LAW', 'value':'LAW'},
                   {'label':'DATE', 'value':'DATE'},
                   {'label':'No Changes', 'value':''}
        ]
        ),

#     Create text area for manual changes.
    revision_text = dcc.Input(className = 'text-input',
                              id = 'textInput', type = 'text',
                              placeholder = 'Type a Unique ID here.', value = '', debounce = True)

#     Create button for committing changes.
    revision_button = html.Button('Confirm Changes?', id = 'confirm-button',
                                  n_clicks = 0, className = 'revision-button'),

    return reading_pane, revision_radio, revision_text, revision_button


# Once a revisions is accepted, write row with instructions to dataframe.
@app.callback([Output('revisions-store', 'data'),
               Output('confirm', 'displayed')],
              [Input('revision-button-container', 'n_clicks'),
               Input('data-upload-store', 'data'),
               Input('data-table-container', 'selected_rows'),
               Input('revision-radio-container', 'children'),
               Input('revision-text-container', 'children')],
              State('revisions-store', 'data'))
def commit_revisions_to_dataframe(n_clicks, data, selected_rows,
                                  radio_children, text_children, revisions):

#     Only run if the n_click 'id' is triggered by the revision-button-container.
    changed_id = [p['prop_id'] for p in dash.callback_context.triggered][0]

    if changed_id != 'revision-button-container.n_clicks':
        raise PreventUpdate

    revised_row = pd.DataFrame(data).iloc[selected_rows]

#     Check if radio_ and text_children each have a value by seeing if a 'value' key is nested in 'props'.
    if 'value' in radio_children[0]['props']:
        radio_value = radio_children[0]['props']['value']
    else:
        radio_value = ''

    if 'value' in text_children['props']:
        text_value = text_children['props']['value']
    else:
        text_value = ''

#     Change individual cell value according to selected row & user-input.
    revised_row['uniq_id'] = text_value
    revised_row['label'] = radio_value

#     Check for xml:id and send error msg if missing.
    if radio_value == 'PERSON' and text_value == '':
        error_msg = True
        return None, error_msg

    else:
        error_msg = False
#         Create or update revisions dataframe to store revisions.
        if revisions is None:
            revisions = pd.DataFrame(revised_row)
        else:
            revisions = pd.DataFrame(revisions)
            revisions = revisions.append(revised_row, ignore_index = True)

        return revisions.to_dict('rows'), error_msg



# After last revision (or whenever one change completed), provide button to commit changes to XML.
@app.callback(Output('write-button-container', 'children'),
              Input('revisions-store', 'data'))
def provide_button_to_download_revisions(data):
    if data is None:
        raise PreventUpdate

    return html.Button('Finished? Download Revised XML.',
                       id = 'write-xml-button', className = 'write-button')


# Run functions to revise XML and download new document.
@app.callback(Output('download-button-container', 'children'),
              [Input('write-button-container', 'n_clicks'),
               Input('upload-data', 'contents'),
               Input('revisions-store', 'data')],
              State('upload-data', 'filename'))
def provide_download_link(n_clicks, contents, revisions, filename):
    write_id = [p['prop_id'] for p in dash.callback_context.triggered][0]

    if write_id != 'write-button-container.n_clicks':
        raise PreventUpdate

    xml_contents = contents[0]
    revisions = pd.DataFrame(revisions)

    final_revisions = revise_xml(xml_contents, revisions)

    completed_file = write_schema_information(xml_contents, final_revisions)

    path = f"revised-{filename[0]}"
    with open(path, "w") as file:
        file.write(completed_file)

    return html.P(f'{filename[0]} downloaded! Please review the XML document for well-formedness.')

if __name__ == "__main__":
    # Beanstalk expects app to be running on 8080.
    application.run(port = 8080)
