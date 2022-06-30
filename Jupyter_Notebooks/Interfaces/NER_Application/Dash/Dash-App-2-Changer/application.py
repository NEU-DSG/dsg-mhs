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
XML Parsing Function: Suggest New Encoding with Hand Edits

Similar to make_ner_suggestions(), this function folds in revision using regular expressions.
The outcome is the previous encoding with additional encoded information determined by user input.

Expected Columns:
    previous_encoding
    entities
    uniq_id
"""
def revise_with_uniq_id(entity, uniq_id, converted_encoding, label):
    converted_entity = ' '.join(['<w>' + e + '</w>' for e in entity.split(' ')])
    
    entity_regex = re.sub('<w>(.*)</w>', '(\\1)(.*?</w>)', converted_entity)
    entity_match = re.search(entity_regex, converted_encoding)

    revised_encoding = re.sub(f'{entity_match.group(0)}',
                              f'<{label} ref="{uniq_id}" type="nerHelper-added">{entity_match.group(1)}</{label}>{entity_match.group(2)}',
                              converted_encoding)
        
    revised_encoding = xml_cleanup(revised_encoding)
        
    return revised_encoding

    
"""
XML Parsing Function: Suggest New Encoding with Hand Edits

Similar to make_ner_suggestions(), this function folds in revision using regular expressions.
The outcome is the previous encoding with additional encoded information determined by user input.

Expected Columns:
    previous_encoding
    entities
    uniq_id
"""
def revise_without_uniq_id(entity, converted_encoding, label):
    converted_entity = ' '.join(['<w>' + e + '</w>' for e in entity.split(' ')])
    entity_regex = re.sub('<w>(.*)</w>', '(\\1)(.*?</w>)', converted_entity)
    entity_match = re.search(entity_regex, converted_encoding)

    revised_encoding = re.sub(f'{entity_match.group(0)}',
                              f'<{label} type="nerHelper-added">{entity_match.group(1)}</{label}>{entity_match.group(2)}',
                              converted_encoding)
    
    cleaned_revisions = xml_cleanup(revised_encoding)
    
    return cleaned_revisions

"""
XML & Regex: Choose revision function based on presence of uniq_id
"""
def choose_revision(entity, uniq_id, converted_encoding, label):
    if uniq_id != '':
        polished_revisions = revise_with_uniq_id(entity, uniq_id, converted_encoding, label)
    elif uniq_id == '':
        polished_revisions = revise_without_uniq_id(entity, converted_encoding, label)
    else:
        print ('breaking at choose_revision()')
        
    return polished_revisions



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
    print ('starting inherit_changes()...')
    
    dataframe = dataframe.fillna('')
    for index, row in dataframe.iterrows():
        label = label_dict[row['label']]
        entity = row['entity']
        uniq_id = row['uniq_id']
    
        if row['accept'] == 'y': # if changes are accepted...
            print ('changes accepted...')
            
#             Check if there's a preceding row.
            try:
                dataframe.loc[index - 1, 'new_encoding']

        #         If the current row is handling same element as the preceding row...
                if (row['abridged_xpath'] == dataframe.loc[index - 1, 'abridged_xpath']) \
                and (row['descendant_order']== dataframe.loc[index - 1, 'descendant_order']):
                    print ('previous elem is the same')

#                     Up convert encoding.
                    converted_encoding = up_convert_encoding(dataframe.loc[index - 1, 'new_encoding']) # access preceding row's new_encoding for most recently updated changes to elem.

                    polished_revisions = choose_revision(entity, uniq_id, converted_encoding, label)

                    dataframe.loc[index, 'new_encoding'] = polished_revisions

        #         If the current row is handling a different row...
                else:
                    print ('previous elem is NOT the same')
        #             Up convert current row's "previous encoding"
                    converted_encoding = up_convert_encoding(row['previous_encoding'])

                    polished_revisions = choose_revision(entity, uniq_id, converted_encoding, label)

                    dataframe.loc[index, 'new_encoding'] = polished_revisions
                    
            except KeyError: # there's not a preceding row.
                print ('accepting changes, there is no preceding row...')
                converted_encoding = up_convert_encoding(row['previous_encoding'])

                polished_revisions = choose_revision(entity, uniq_id, converted_encoding, label)

                dataframe.loc[index, 'new_encoding'] = polished_revisions

#         If changes aren't accepted, 
        else:
            print ('changes not accepted')
#             Check for most recent changes.
            try:
                dataframe.loc[index - 1, 'new_encoding']

        #         If the current row is handling same element as the preceding row...
                if (row['abridged_xpath'] == dataframe.loc[index - 1, 'abridged_xpath']) \
                and (row['descendant_order']== dataframe.loc[index - 1, 'descendant_order']):
                    
#                     If the same elem as preceding, adopt preceding's changes (without accepting current row's).
                    dataframe.loc[index, 'new_encoding'] = dataframe.loc[index - 1, 'new_encoding']
                
                else:
#                     if row is handling elem for first time and changes rejected, then keep previous_encoding as-is.
                    dataframe.loc[index, 'new_encoding'] = dataframe.loc[index, 'previous_encoding']
    
            except KeyError:
#                 If no preceding row and changes rejected, keep previous_encoding as-is.
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
    print ('starting revise_xml()...')
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
    print ('\tchanges inherited...')
    
    xml_content_type, xml_content_string = xml_contents.split(',')
    xml_decoded = base64.b64decode(xml_content_string).decode('utf-8')
    xml_file = xml_decoded.encode('utf-8')
    print ('\txml file read...')
    
#     root = ET.fromstring(xml_file)
    root = etree.fromstring(xml_file)
    ns = get_namespace(root)
    
#     Add <change> to <revisionDesc> and add <application> to <appInfo>
    append_change_to_revisionDesc(root, ns)
    append_app_to_appInfo(root, ns) # Does not need to save as variable; changes written to root.
    print ('\trevisionDesc updated...')
    
    
#     Convert XML structure to string for regex processing.
    tree_as_string = ET.fromstring(xml_file)
    tree_as_string = ET.tostring(tree_as_string, method = 'xml').decode('utf-8')
    tree_as_string = re.sub('\s+', ' ', tree_as_string)
    tree_as_string = re.sub('ns0:', '', tree_as_string)
    print ('\txml tree converted to string...')
    
    
#     Write accepted code into XML tree.
    for index, row in new_data.iterrows():
        original_encoding_as_string = row['previous_encoding']
        
        # Remove namespaces within tags to ensure regex matches accurately.
        original_encoding_as_string = re.sub('^<(.*?)( xmlns.*?)>(.*)$',
                                             '<\\1>\\3',
                                             original_encoding_as_string)
        
#         Remove namespaces.
        original_encoding_as_string = re.sub('ns0:', '', original_encoding_as_string)
        
        accepted_encoding_as_string = row['new_encoding']
        accepted_encoding_as_string = re.sub('<(.*?)( xmlns.*?)>(.*)$',
                                             '<\\1>\\3',
                                             accepted_encoding_as_string) # Remove namespaces within tags.
        
#         Remove namespaces.
        accepted_encoding_as_string = re.sub('ns0:', '', accepted_encoding_as_string)
        
        tree_as_string = re.sub(original_encoding_as_string,
                                accepted_encoding_as_string,
                                tree_as_string)

#         Remove namespaces.
        tree_as_string = re.sub('ns0:', '', tree_as_string)
    
    print ('\txml doc. revised with accepted changes...')
        
#     Check well-formedness (will fail if not well-formed)
    doc = etree.fromstring(tree_as_string)
    et = etree.ElementTree(doc)
    
#     Convert to string.
    et = etree.tostring(et, encoding='unicode', method='xml', pretty_print = True)
    print ('\txml doc. well-formed and converted to string...')
    return et


"""
XML: Write Schema Information before Root
Input: 
    - Revised XML document (return variable from revise_xml())
    - XML File with Original Encoding
"""
def write_schema_information(xml_contents, final_revisions):
    print ('starting write_schema_information()...')
    xml_content_type, xml_content_string = xml_contents.split(',')
    xml_decoded = base64.b64decode(xml_content_string).decode('utf-8')
    
#     xml_file = xml_decoded.encode('utf-8').decode('utf-8')
    xml_file = xml_cleanup(xml_decoded)
    xml_file = re.sub('\s+', ' ', xml_file)
    print ('\txml file cleaned of extra spaces...')
    
    schema_match = re.search('(<?.*)(<TEI.*)', xml_file)
    schema_match = schema_match.group(1)
    
    completed_document = schema_match + final_revisions
    print ('\txml schema included in revised doc...')

    return completed_document



# Preset variables.
ner_labels = ['PERSON','LOC','GPE','FAC','ORG','NORP','EVENT','WORK_OF_ART','LAW','DATE']

# Banned List (list of elements that already encode entities)
banned_list = ['persRef', 'date']


app = dash.Dash(__name__)

# Layout.
app.layout = html.Div([
    
#     Title
    html.Header( 
        className="app-header",
        children = [
            html.Div('nerHelper Application', className = "app-header--title")
        ]),
    
    
#     Upload Data Area.
    html.H2('Upload XML File'),
    dcc.Upload(
        className = 'upload-xml',
        id = 'upload-xml',
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
    dcc.Store(id = 'xml-upload-store'),

    
#     Display pane for file information.
    html.Div(className = 'xml-information', id = 'xml-information'),
 
      
#     Upload Data Area.
    html.H2('Upload CSV File'),
    dcc.Upload(
        className = 'upload-csv',
        id = 'upload-csv',
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
    dcc.Store(id = 'csv-upload-store'),
    
    html.Div(className = 'csv-information', id = 'csv-information'),
    
      
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

# Upload XML
@app.callback([Output('xml-upload-store', 'data'),
               Output('xml-information', 'children')],
              Input('upload-xml', 'contents'), 
              State('upload-xml', 'filename'))
def upload_xml(contents, filename):
    
    file_name = html.P(f'File name: {filename}')
    
    return contents, file_name


# Upload CSV & display data table.
@app.callback([Output('csv-upload-store', 'data'),
               Output('csv-information', 'children')],
#               Output('data-table-container', 'data'), Output('data-table-container', 'columns')],
              Input('upload-csv', 'contents'),
              State('upload-csv', 'filename'))
def upload_csv(contents, filename):
    
    if not contents:
        raise PreventUpdate
    
    file_name = html.P(f'File name: {filename}')
    
    content_type, content_string = contents.split(',')
    decoded = base64.b64decode(content_string)
    
    try:
        if 'csv' in filename:
        # Assume that the user uploaded a CSV file
            df = pd.read_csv(io.StringIO(decoded.decode('utf-8')))
            cols = [{'name':i, 'id': i} for i in df.columns]
            
        elif 'xls' in filename:
        # Assume that the user uploaded an excel file
            print ('csv file is excel spreadsheet...')
            df = pd.read_excel(io.BytesIO(decoded), index_col = 0)
            cols = [{'name':i, 'id': i} for i in df.columns]
            
        return contents, file_name #, df.to_dict('rows'), cols

    except Exception as e:
        print(e)
    


# Supply download button once both files are uploaded.
@app.callback(Output('download-button-container', 'children'),
              [Input('xml-upload-store', 'data'),
               Input('csv-upload-store', 'data')])
def confirm_revision_rewrite(xml_content, csv_content):
    
    if xml_content and csv_content:
        
        return html.Button('Download Revised XML.', id = 'download-button', className = 'download-button')


# Write and download revised xml.
@app.callback(Output('file-downloaded-container', 'children'), 
              Input('download-button-container', 'n_clicks'),
              [State('xml-upload-store', 'data'), 
               State('csv-upload-store', 'data'), 
               State('upload-csv', 'filename'),
               State('upload-xml', 'filename')])
def write_revised_xml(n_clicks, xml_contents, csv_contents, csv_filename, xml_filename):
    download_id = [p['prop_id'] for p in dash.callback_context.triggered][0]
    
    if download_id != 'download-button-container.n_clicks':
        raise PreventUpdate
    
    content_type, content_string = csv_contents.split(',')
    decoded = base64.b64decode(content_string)
    
    
    try:
        if 'csv' in csv_filename:
        # Assume that the user uploaded a CSV file
            df = pd.read_csv(io.StringIO(decoded.decode('utf-8')))
            cols = [{'name':i, 'id': i} for i in df.columns]
            
        elif 'xls' in csv_filename:
        # Assume that the user uploaded an excel file
            df = pd.read_excel(io.BytesIO(decoded), index_col = 0)
            cols = [{'name':i, 'id': i} for i in df.columns]
            
        else:
            raise PreventUpdate
            
        revisions = revise_xml(xml_contents, df)

        completed_file = write_schema_information(xml_contents, revisions) # not working

        path = f"revised-{xml_filename}"
        with open(path, "w") as file:
            file.write(completed_file)

        return html.P(f'revised-{xml_filename}! Please review the XML document for well-formedness.')


    except Exception as e:
        print(e)
    

if __name__ == "__main__":
    application.run(port = 8080)