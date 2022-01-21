import re
import pandas as pd
import xml.etree.ElementTree as ET

# Declare regex to simplify file paths below
regex = re.compile(r'.*/\d{4}/(.*)')

# Declare document level of file. Requires root starting point ('.').
doc_as_xpath = './/ns:div/[@type="entry"]'

# Declare date element of each document.
date_path = './ns:bibl/ns:date/[@when]'

# Declare person elements in each document.
person_path = './/ns:p/ns:persRef/[@ref]'

# Declare text level within each document.
text_path = './ns:div/[@type="docbody"]/ns:p'

# Read in file and get root of XML tree.
def get_root(xml_file):
    tree = ET.parse(xml_file)
    root = tree.getroot()
    return root


# Get namespace of individual file from root element.
def get_namespace(root):
    namespace = re.match(r"{(.*)}", str(root.tag))
    ns = {"ns":namespace.group(1)}
    return ns


# Get document id.
def get_document_id(ancestor, attrib_val_str):
    doc_id = ancestor.get(attrib_val_str)
    return doc_id


# Get date of document.
def get_date_from_attrValue(ancestor, xpath_as_string, attrib_val_str, namespace):
    date = ancestor.find(xpath_as_string, namespace).get(attrib_val_str)
    return date


def get_peopleList_from_attrValue(ancestor, xpath_as_string, attrib_val_str, namespace):
    people_list = []
    for elem in ancestor.findall(xpath_as_string, namespace):
        person = elem.get(attrib_val_str)
        people_list.append(person)
#     Return a string object of 'list' to be written to output file. Can be split later.
    return ','.join(people_list)



# Get subject heading from document.
def get_subject(ancestor, xpath_as_string, namespace):
    subject_list = []
    for elem in ancestor.findall(xpath_as_string, namespace):
        # subject = ''.join(ET.tostring(elem, encoding='unicode', method='text'))
        subject = re.sub(r'[\n\t\s]+', ' ', elem.text.strip())
        subject_list.append(subject)
#     Return a string object of 'list' to be written to output file. Can be split later.
    return ','.join(subject_list)


# Get plain text of every element (designated by first argument).
def get_textContent(ancestor, xpath_as_string, namespace):
    text_list = []
    for elem in ancestor.findall(xpath_as_string, namespace):
        text = ''.join(ET.tostring(elem, encoding='unicode', method='text'))

#         Add text (cleaned of additional whitespace) to text_list.
        text_list.append(re.sub(r'\s+', ' ', text))

#     Return concetanate text list.
    return ' '.join(text_list)


# Build dataframe from XML files.
def build_dataframe(xml_dir):
    dataframe = []

    for file in xml_dir:
    #         Call functions to create necessary variables and grab content.
        root = get_root(file)
        ns = get_namespace(root)

        for eachDoc in root.findall(doc_as_xpath, ns):
    #             Call functions.
            entry = get_document_id(eachDoc, '{http://www.w3.org/XML/1998/namespace}id')
            date = get_date_from_attrValue(eachDoc, date_path, 'when', ns)
            people = get_peopleList_from_attrValue(eachDoc, person_path, 'ref', ns)
            text = get_textContent(eachDoc, text_path, ns)
            
            dataframe.append([str(regex.search(file).groups()), entry, date, people, text])
            
    dataframe = pd.DataFrame(dataframe, columns = ['file', 'entry', 'date', 'people', 'text'])
    
    return dataframe