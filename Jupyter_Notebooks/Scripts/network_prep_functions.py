import pandas as pd

"""
Create data structures for network graphs.
    Input: expects a dataframe with a column named 'source' and 'target'
    Output: a nodes df, links df, and nodes_dictionary
"""
def get_nodes_and_links(dataframe):

    nodes = dataframe['source'] \
        .append(pd.DataFrame(dataframe['target'].values.tolist()), ignore_index = True) \
        .drop_duplicates() \
        .rename(columns = {0:'label'})

    # Create identifying codes for labels.
    nodes = nodes \
        .assign(source = nodes['label'].astype('category').cat.codes) \
        .sort_values(['source'], ascending = True) # Sorting matches labels with source codes.

    # # Create dictionary to map values to codes.
    # nodes_dictionary = nodes.set_index('label')['source'].to_dict()

    # Create dictionary to map values to codes.
    nodes_dictionary = nodes['label'].to_dict()

    # Create links dataframe and map links to nodes' codes.
    links = dataframe \
        .assign(source = dataframe['source'].map(nodes_dictionary),
                target = dataframe['target'].map(nodes_dictionary))

    return nodes, links, nodes_dictionary
