import warnings, re, glob, datetime, csv, sys, os, base64, io, spacy
import pandas as pd
import numpy as np

# I'm using lxml because it has getparent(), which is critical for accessing multiple xml:id of docs within a single file.
from lxml import etree

# I'm using ET in get_encoding() only.
import xml.etree.ElementTree as ET

import dash, dash_table
import dash_core_components as dcc
from dash.dependencies import Input, Output, State
from dash.exceptions import PreventUpdate
import dash_html_components as html
from jupyter_dash import JupyterDash

# Import spaCy language model.
nlp = spacy.load('en_core_web_sm')

# Script

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
XML Parsing Function: Get Encoded Content
"""    
def get_encoding(elem):
#     encoding = etree.tostring(elem, pretty_print = True).decode('UTF-8') # this line failed to return single elem.
    
#     This troubleshoots an error that emerged with etree.tostring above:
    encoding = ET.tostring(elem, method = 'xml').decode('utf-8') # convert xml to string with ET
#     encoding = etree.fromstring(encoding) # convert string back to xml encoding with etree.
#     encoding = etree.tostring(encoding).decode('utf-8') # convert back to string with etree.
    
    encoding = xml_cleanup(encoding)
    encoding = re.sub('\s+', ' ', encoding) # remove additional whitespace
    encoding = re.sub('[:]?ns0[:]?', '', encoding)
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
            new_encoding = re.sub('ns0:', '', new_encoding)

            return new_encoding

        else:
            return 'Error Making NER Suggestions'
    
#     Up-conversion works well because it 'breaks' if an entity already has been encoded:
#     <w>Abel</w> (found entity) does not match <w><persRef_ref="abel-mary">Mrs</w> <w>Abel</persRef></w>
#     <persRef> breaks function and avoids duplicating entities.
    
    except:
        return 'Error Occurred with Regex.'
    


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
XML Parsing Function: Intersperse Entity with Likely TEI Information for Capacious Regex
"""
def intersperse(lst, item):
    result = [item] * (len(lst) * 2 - 0)
    result[0::2] = lst
    return result


"""
XML Function: Build KWIC of Found Entities in Up Converted Encoding
"""
def get_kwic_encoding(entity, encoding, banned_list, kwic_range):
#     Up convert arguments.
    converted_encoding = up_convert_encoding(encoding)
    converted_entity = up_convert_encoding(entity)

#     Intersperse & 'up convert' by hand entity.
    expanded_entity = [c for c in entity]
    expanded_regex = '[' + "|".join(['(<.*?>)']) + ']*'

    expanded_regex = r''.join(intersperse(expanded_entity, expanded_regex))
    expanded_entity = re.sub('\s', '</w> <w>', expanded_regex)
    
#     <w>(?:(?!<w>).)*
#     'Tempered greedy token solution', <w> cannot appear after a <w>, unless within expanded_entity
#     entity_regex = re.compile('(<w>(?:(?!<w>).)*' + expanded_entity + '.*?</w>)')
    entity_regex = re.compile('([^\s]*' + expanded_entity + '[^\s]*)')
    
    
    # Use regex match as final conv. entity.
    try:
        kwic_dict = {entity: []}
        for m in entity_regex.finditer(converted_encoding):
            
            if any(item in m.group() for item in banned_list):
                pass
            
            else:
#                 Gather context:
#                 Start of match (m.start()) minus kwic_range through end of match plus kwic_range.
                context = converted_encoding[ m.start() - kwic_range : m.end() + kwic_range]
                kwic_dict[entity].append(context)
        
        
#         For each item in entity list, create new regex and expand until reaches preceeding </w> and trailing <w>.
        for n, i in enumerate(kwic_dict[entity]):
            complete_kwic = re.search(f'([^\s]*{i}[^\s]*)', converted_encoding).group()
            clean_kwic = re.sub('(</?[\w]>)', '', complete_kwic)
            kwic_dict[entity][n] = clean_kwic
        
#         Return values only
        return kwic_dict[entity]
            
    except AttributeError:
        return np.nan


"""
XML: & NER: Create Dataframe of Entities
"""
def make_dataframe(child, df, ns, subset_ner, filename, descendant_order):
    abridged_xpath = get_abridged_xpath(child)
    entities, previous_encoding = get_contents(child, './/ns:.', ns, subset_ner)

    df = df.append({
        'file':re.sub('.*/(.*.xml)', '\\1', filename),
        'descendant_order': descendant_order,
        'abridged_xpath':abridged_xpath,
        'previous_encoding': previous_encoding,
        'entities':entities,
    },
        ignore_index = True)
    
    return df



"""
Parse Contents: XML Structure (ouput-data-upload)
"""
def parse_contents(contents, filename, ner_values): # date,
    print ('parsing contents...')
    ner_values = ner_values#.split(',')
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
                    
            
            print ('\texploding dataframe...')
#             Join data
            df = df \
                .explode('entities') \
                .dropna(subset = ['entities'])
            
            df[['entity', 'label']] = pd.DataFrame(df['entities'].tolist(), index = df.index)
            
            print ('\tmaking ner suggestions...')
            df['new_encoding'] = df \
                .apply(lambda row: make_ner_suggestions(row['previous_encoding'],
                                                        row['entity'],
                                                        row['label'],
                                                        subset_ner, 4, banned_list),
                       axis = 1)

#             Call KWIC.
            df['keyword_in_context'] = df \
                .apply(lambda row: get_kwic_encoding(row['entity'],
                                                     row['previous_encoding'],
                                                     banned_list, 30),
                       axis = 1)

            df = df.explode('keyword_in_context')
            
            # Add additional columns for user input.
            df['uniq_id'] = ''
            
#             Drop rows if 'new_encoding' value equals 'Already Encoded'.
            df = df[df['new_encoding'] != 'Already Encoded']

            
    except Exception as e:
        return html.Div([
            f'There was an error processing this file: {e}.'
    ])


#     Return HTML with outputs.
    return df # filename, date, 


app = dash.Dash(__name__)

app.config.suppress_callback_exceptions = True


# Preset variables.
ner_labels = ['LOC','GPE']
# ner_labels = ['PERSON','LOC','GPE','FAC','ORG','NORP','EVENT','WORK_OF_ART','LAW','DATE']

# Banned List (list of elements that already encode entities)
banned_list = ['persRef', 'date']

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
#             html.Tr([
#                 html.Td('PERSON'),
#                 html.Td('A person\'s name (proper noun)' ),
#             ]),
            html.Tr([
                html.Td('LOC'),
                html.Td('Non-GPE locations, mountain ranges, bodies of water.' ),
            ]),
            html.Tr([
                html.Td('GPE'),
                html.Td('Countries, cities, states.' ),
            ]),
#             html.Tr([
#                 html.Td('FAC'),
#                 html.Td('Buildings, airports, highways, bridges, etc.' ),
#             ]),
#             html.Tr([
#                 html.Td('ORG'),
#                 html.Td('Companies, agencies, institutions, etc.' ),
#             ]),
#             html.Tr([
#                 html.Td('NORP'),
#                 html.Td('Nationalities or religious or political groups.' ),
#             ]),
#             html.Tr([
#                 html.Td('EVENT'),
#                 html.Td('Named hurricanes, battles, wars, sports events, etc.' ),
#             ]),
#             html.Tr([
#                 html.Td('WORK_OF_ART'),
#                 html.Td('Titles of books, songs, etc.' ),
#             ]),
#             html.Tr([
#                 html.Td('LAW'),
#                 html.Td('Named documents made into laws.' ),
#             ]),
#             html.Tr([
#                 html.Td('DATE'),
#                 html.Td('Absolute or relative dates or periods.' ),
#             ]),
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
        value = ['LOC', 'GPE']
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
        multiple=False # Allow multiple files to be uploaded
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
                         page_size=10,
                        ),
    
    html.Div(id = 'download-button-container'),
    
    html.Div(id = 'file-downloaded-container')
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
def upload_data(contents, ner_values, filename, date):
    if contents is None:
        raise PreventUpdate
    
    try:
        data = parse_contents(contents, filename, ner_values)

        file_information = html.Div([html.P(f'File name: {filename}'),
                                     html.P(f'Last modified: {datetime.datetime.fromtimestamp(date)}')])

        return file_information, data.to_dict('rows')
    
    except AttributeError:
        return html.P(f'Could not parse {filename}, possibly because app found no entities.'), ''


# Generate table with data from store.
@app.callback([Output('data-table-container', 'data'),
               Output('data-table-container', 'columns')],
              Input('data-upload-store', 'data'))
def populate_data_table(data):

    df = pd.DataFrame(data)[['file', 'entity', 'label']]
    cols = [{'name':i, 'id': i} for i in df.columns]

    return df.to_dict('rows'), cols


# After last revision (or whenever one change completed), provide button to commit changes to XML.
@app.callback(Output('download-button-container', 'children'),
              Input('data-upload-store', 'data'))
def provide_download_button(data):
    if data is None:
        raise PreventUpdate
    
    return html.Button('Download NER Suggestions as CSV.', 
                       id = 'download-button', className = 'download-button')


@app.callback(Output('file-downloaded-container', 'children'),
              Input('download-button-container', 'n_clicks'),
              [State('data-upload-store', 'data'),
               State('upload-data', 'filename')])
def download_csv(n_clicks, data, filename):
    download_id = [p['prop_id'] for p in dash.callback_context.triggered][0]
    
    if download_id != 'download-button-container.n_clicks':
        raise PreventUpdate
    
    reFile = re.match(r'(.*).xml', filename).group(1)
    
    path = f"{reFile}.csv"
    with open(path, "w") as file:
        df = pd.DataFrame(data)
        
#         Create accept column.
        df['accept'] = ''
#         Re-organize column order.
        df = df[['accept', 'entity', 'keyword_in_context', 'label', 
                 'uniq_id', 'previous_encoding', 'new_encoding', 
                 'entities', 'abridged_xpath', 'descendant_order', 'file']]
    
        df.to_csv(file, sep = ',')
        
    return html.P(f'{reFile}.csv downloaded!')

if __name__ == "__main__":
    application.run(port = 8080)