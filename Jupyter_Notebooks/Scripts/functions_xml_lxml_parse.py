from lxml import etree

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
