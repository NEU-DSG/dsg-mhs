import sys, os, random, warnings, pickle, nltk, gensim
import pandas as pd
import numpy as np

# PCA visualization
from scipy.spatial.distance import cosine
from nltk.cluster import KMeansClusterer
from sklearn import cluster, metrics
from sklearn.metrics import pairwise, adjusted_rand_score
from sklearn.decomposition import PCA, NMF
from sklearn.manifold import MDS, TSNE


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print ('Expected command: tsne_w2v_cluster.py <w2v_model_input> <cluster_output> <numberOfClusters> <pca_output>')
        """
        e.g.,
        python tsne_w2v_cluster.py "/Users/quinn.wi/Documents/Data/Output/WordVectors/jqa_w2v.txt" "/Users/quinn.wi/Documents/Data/Output/WordVectors/jqa_w2v_kmeans-clusters.pkl" 100 "/Users/quinn.wi/Documents/Data/Output/WordVectors/jqa_w2v_tsne-coordinates.csv"
        """
        exit(-1)

    """
    Cluster words in w2v model.
    """
    print ('Beginning clustering algorithm. This could take awhile...')
    model = gensim.models.KeyedVectors.load_word2vec_format(sys.argv[1])

    X = model[model.key_to_index]

    clusters = int(sys.argv[3])

    kclusterer = KMeansClusterer(clusters, distance = nltk.cluster.util.cosine_distance, repeats = 25)
    assigned_clusters = kclusterer.cluster(X, assign_clusters = True)

    kmeans = cluster.KMeans(n_clusters = clusters)
    kmeans.fit(X)

    labels = kmeans.labels_
    centroids = kmeans.cluster_centers_

    words = list(model.key_to_index)
    cluster_dict = {}

    for i, word in enumerate(words):
        cluster_dict[word] = str(assigned_clusters[i])

    with open(sys.argv[2], 'wb') as f:
        pickle.dump(cluster_dict, f, pickle.HIGHEST_PROTOCOL)
    print ('Clusters saved: ', sys.argv[2])

    """
    Compute PCA of words in w2v model.
    """
    X = model[model.key_to_index]

    pca = PCA(n_components = 3).fit_transform(X)

    Y = TSNE(n_components=3, random_state=0, perplexity=15).fit_transform(pca)

    # Sets everything up to plot
    tsne_data = pd.DataFrame({'words': [k for k in model.key_to_index],
                              'cluster': [v for v in cluster_dict.values()],
                              'x': [x for x in Y[:, 0]],
                              'y': [y for y in Y[:, 1]],
                              'z': [z for z in Y[:, 2]]})
    print ('PCA calculated.')

    tsne_data.to_csv(sys.argv[4], sep = ',', index = False)
    print ('PCA data saved: ', sys.argv[4])
