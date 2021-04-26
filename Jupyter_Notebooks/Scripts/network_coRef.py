import sys, json, glob, re # Import global modules (ones that appear in multiple locations) with 'as'
import pandas as pd
import numpy as np
import seaborn as sns
import networkx as nx
from networkx.readwrite import json_graph
from networkx.algorithms import community
from json import JSONEncoder

# Import project-specific functions.
# Python files (.py) have to be in same folder to work.
from functions_xml_ET_parse import *
from functions_network_prep import *


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print ('Expected command: network_coRef.py <input> <output>')
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
            text = get_textContent(eachDoc, text_path, ns)

            dataframe.append([str(regex.search(file).groups()), entry, date, people, text])

    dataframe = pd.DataFrame(dataframe, columns = ['file', 'entry', 'date', 'people', 'text'])

    # Split string of people into individuals.
    dataframe['people'] = dataframe['people'].str.split(r',|;')

    # Explode list so that each list value becomes a row.
    dataframe = dataframe.explode('people')

    # Create entry-person matrix.
    dataframe = pd.crosstab(dataframe['entry'], dataframe['people'])

    # Convert entry-person matrix into an adjacency matrix of persons.
    dataframe = dataframe.T.dot(dataframe)
    print (dataframe.shape)

    # Change diagonal values to zero. That is, a person cannot co-occur with themself.
    np.fill_diagonal(dataframe.values, 0)

    # Simple correlation matrix from dataframe.
    dataframe = dataframe.corr(method = 'pearson')

    # Create new 'source' column that corresponds to index (person).
    dataframe['source'] = dataframe.index

    # Reshape dataframe to focus on source, target, and weight.
    # Remove same-person pairs (weight = 1) and weak correlations (weight < 4).
    # Rename 'people' column name to 'target'.
    dataframe = pd.melt(dataframe, id_vars = ['source'], value_name = 'weight') \
        .query('(weight < 1.00) & (weight > 0.4)') \
        .rename(columns = {'people':'target'})

    print ('Dataframe built.')

    """
    Create network object.
    """
    nodes, links, nodes_dictionary = get_nodes_and_links(dataframe)

    # Map labels back onto source and target.
    edges = links.replace({'source':nodes_dictionary, 'target':nodes_dictionary})

    # Convert edges dataframe to edges tuple (compatible with graph object below).
    edges = [tuple(x) for x in edges[['source', 'target']].to_numpy()]

    # Initialize graph object.
    G = nx.Graph()

    # Add nodes and edges to graph object.
    G.add_nodes_from(nodes['label'])
    G.add_edges_from(edges)

    print (nx.info(G))

    # Measure network density.
    density = nx.density(G)
    print (f"Network density: {density:.3f}")

    # Related to diameter, check if network is connected and, therefore, can have a diameter.
    print (f"Is the network connected? {nx.is_connected(G)}")

    # Get a list of network components (communities).
    # Find the largest component.
    components = nx.connected_components(G)
    largest_component = max(components, key = len)

    # Create a subgraph of the largest component and measure its diameter.
    subgraph = G.subgraph(largest_component)
    diameter = nx.diameter(subgraph)
    print (f"Network diameter of the largest component: {diameter:.3f}")

    # Find triadic closure (similar to density).
    triadic_closure = nx.transitivity(G)
    print (f"Triadic closure: {triadic_closure:.3f}\n")

    # # Find centrality measures.
    # betweenness_dict = nx.betweenness_centrality(G) # Run betweenness centrality
    # eigenvector_dict = nx.eigenvector_centrality(G) # Run eigenvector centrality
    #
    # # Assign each centrality measure to an attribute.
    # nx.set_node_attributes(G, betweenness_dict, 'betweenness')
    # nx.set_node_attributes(G, eigenvector_dict, 'eigenvector')
    # nx.set_node_attributes(G, dict(G.degree(G.nodes())), 'degree')

    # Find communities.
    communities = community.greedy_modularity_communities(G)

    # Create a dictionary that maps nodes to their community.
    modularity_dict = {}
    for i, c in enumerate(communities):
        for name in c:
            modularity_dict[name] = i

    # Add modularity information to graph object.
    nx.set_node_attributes(G, modularity_dict, 'modularity')
    print ('Network object created.')

    """
    Save network object.
    """
    # Convert graph object into a dictionary.
    data = json_graph.node_link_data(G)

    # Serialize dictionary with json.
    class NPEncoder(JSONEncoder):
        def default(self, obj):
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            return JSONEncoder.default(self, obj)

    data_json = json.dumps(data, cls=NPEncoder)

    with open(sys.argv[2], "w") as f:
        f.write(data_json)
        print ('Network object saved.')
