import sys, os, string, glob, gensim
import pandas as pd
import numpy as np
from nltk.tokenize import word_tokenize, sent_tokenize

from functions_xml_ET_parse import *

# Define tokenizer.
def fast_tokenize(text):

    # Get a list of punctuation marks
    punct = string.punctuation + '“' + '”' + '‘' + "’"

    lower_case = text.lower()
    lower_case = lower_case.replace('—', ' ').replace('\n', ' ')

    # Iterate through text removing punctuation characters
    no_punct = "".join([char for char in lower_case if char not in punct])

    # Split text over whitespace into list of words
    tokens = no_punct.split()

    return tokens


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print ('Expected command: w2v_build.py <input> <output>')
        exit(-1)


    """
    Declare variables.
    """
    # Declare regex to simplify file paths below
    regex = re.compile(r'.*/(.*).xml') # /\d{4}

    # Declare document level of file. Requires root starting point ('.').
    doc_as_xpath = './/ns:div/[@type="entry"]'

    # Declare date element of each document.
    date_path = './ns:bibl/ns:date/[@when]'

    # Declare text level within each document.
    text_path = './ns:div/[@type="docbody"]/ns:p'

    print ('Variables declared.')


    """
    Build dataframe.
    """
    dataframe = []

    for file in glob.glob(str(sys.argv[1]) + '/*xml'):
    #         Call functions to create necessary variables and grab content.
        root = get_root(file)
        ns = get_namespace(root)

        for eachDoc in root.findall(doc_as_xpath, ns):
    #             Call functions.
            entry = get_document_id(eachDoc, '{http://www.w3.org/XML/1998/namespace}id')
            date = get_date_from_attrValue(eachDoc, date_path, 'when', ns)
            text = get_textContent(eachDoc, text_path, ns)

            dataframe.append([str(regex.search(file).groups()), entry, date, text])

    dataframe = pd.DataFrame(dataframe, columns = ['file', 'entry', 'date', 'text'])
    print ('Dataframe built.')

    """
    Train w2v model.
    """
    # Convert dataframe text field to list of sentences.
    sentences = [sentence for text in dataframe['text'] for sentence in sent_tokenize(text)]
    words_by_sentence = [fast_tokenize(sentence) for sentence in sentences]
    words_by_sentence = [sentence for sentence in words_by_sentence if sentence != []]

    # Get total number of words and unique words.
    single_list_of_words = []
    for l in words_by_sentence:
        for w in l:
            single_list_of_words.append(w)
    print (f'Word total: {len(single_list_of_words)}\nUnique word total {len(set(single_list_of_words))}')

    # Build model.
    model = gensim.models.Word2Vec(words_by_sentence, window=5, vector_size=100,
                                   min_count=10, sg=1, alpha=0.025,
                                   batch_words=10000, workers=4)
    print ('Model trained.')

    model.wv.save_word2vec_format(sys.argv[2])
    print ('Model saved.')
