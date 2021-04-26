import sys, re, json, warnings, pickle, nltk
import pandas as pd
import numpy as np
import glob as glob

# Import NLTK packages.
from nltk import word_tokenize
from nltk.stem import WordNetLemmatizer
from nltk.stem.snowball import SnowballStemmer
from nltk.corpus import stopwords

# Import and append stopwords.
stop_words = stopwords.words("english")

# Import sklearn packages.
from sklearn.decomposition import LatentDirichletAllocation as LDA
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

# Import project-specific functions.
# Python files (.py) have to be in same folder to work.
from functions_xml_ET_parse import *


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print ('Expected command: topic_model_gensim.py <input> <output> <numberOfTopics>')
        exit(-1)


    """
    Declare variables.
    """
    # Declare regex to simplify file paths below
    regex = re.compile(r'.*/\d{4}/(.*)')

    # Declare document level of file. Requires root starting point ('.').
    doc_as_xpath = './/ns:div/[@type="entry"]'

    # Declare date element of each document.
    date_path = './ns:bibl/ns:date/[@when]'

    # Declare person elements in each document.
    person_path = './/ns:p/ns:persRef/[@ref]'

    # Declare subject elements in each document.
    subject_path = './/ns:bibl/ns:note[@type="subject"]'

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
            people = get_peopleList_from_attrValue(eachDoc, person_path, 'ref', ns)
            subject = get_subject_from_attrValue(eachDoc, subject_path, ns)
            text = get_textContent(eachDoc, text_path, ns)

            dataframe.append([str(regex.search(file).groups()), entry, date, people, subject, text])

    dataframe = pd.DataFrame(dataframe, columns = ['file', 'entry', 'date', 'people', 'subject', 'text'])
    print ('Dataframe built.')


    """
    Lemmatize & Stem Text
    """
    # Lowercase text field
    dataframe['text'] = dataframe['text'].str.lower()

    # Tokenize text field.
    dataframe['text'] = dataframe['text'].apply(word_tokenize)

    # Lemmatize and stem text field.
    lemmatizer = WordNetLemmatizer()
    stemmer = SnowballStemmer("english", ignore_stopwords = True)

    def lemma_and_stem(list_of_words):
        return [stemmer.stem(lemmatizer.lemmatize(w)) for w in list_of_words if w not in stop_words]

    dataframe['text'] = dataframe['text'].apply(lemma_and_stem)

    # Convert list of words to string for LDA model.
    dataframe['text'] = dataframe['text'].apply(' '.join)
    print ('Text lemmatized and stemmed.')


    """
    Train Topic Model
    """
    # Remove duplicate text rows (caused from unnesting headings) by subsetting & de-duplicating.
    topics = dataframe[['entry', 'text']].drop_duplicates(subset = ['entry'])

    # Initialise the vectorizer with English stop words.
    vectorizer = CountVectorizer(stop_words='english')

    # Fit and transform the processed texts.
    features = vectorizer.fit_transform(topics['text'])

    # Set parameters (topics set to number of unique subject headings found).
    number_topics = int(sys.argv[3])
    number_words = 10

    # Create and fit the LDA model
    lda = LDA(n_components = number_topics, n_jobs=-1)
    lda.fit(features)

    # Create a document-topic matrix.
    dtm = lda.transform(features)

    # Convert document-topic matrix to dataframe.
    dtm = pd.DataFrame(dtm, index = topics.index)

    # Join document-topic dataframe with metadata on shared indices.
    dtm = pd.merge(dataframe[['file', 'entry', 'date', 'subject']],
                   dtm,
                   left_index = True, right_index = True)
    print ('Model trained.')


    """
    Save topics dataframe.
    """
    dtm.to_csv(sys.argv[2], sep = ',', index = False)
    print ('Topics dataframe saved.')
