import re
import pandas as pd
import xml.etree.ElementTree as ET

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

def build_dataframe(list_of_files):
    dataframe = []

    for file in list_of_files:
        
        try:
            root = get_root(file)
            ns = get_namespace(root)

            reFile = str(re.search(r'.*/(.*.xml)', str(file)).group(1)) # get filename without path

            date = root.find('.//ns:date/[@type="creation"]', ns).get('when') # get date.

            source = root.find('.//ns:bibl//ns:author', ns).text   # get source/author & target/recipient
            target = root.find('.//ns:bibl//ns:recipient', ns).text
            
        #     Loops
        #     loop to get all references (persRef)
            references_l = []
            for ref in root.findall('.//ns:persRef', ns):
                person = ref.get('ref')
                references_l.append(person)
            references = ','.join(references_l)

        #     loop to get subjects.
            subject_l = []
            for subject in root.findall('.//ns:subject', ns):
                subject_l.append(subject.text)
            subjects = ','.join(subject_l)

        #     loop to get all text within <div type="docbody">
            text_l = []
            for txt in root.findall('.//ns:div[@type="docbody"]', ns):
                string = ''.join(ET.tostring(txt, encoding='unicode', method='text'))
                clean_string = re.sub(r'[\t\n\s]+', ' ', string)
                text_l.append(clean_string)
            content = ' '.join(text_l)


            row = {'file': reFile, 'date': date, 'source': source, 'target':target, 
                'subjects': subjects, 'references': references, 'text': content}
            

            dataframe.append(row)
            
        except:
            print (file, '\n')
        
    df = pd.DataFrame(dataframe)
    return (df)