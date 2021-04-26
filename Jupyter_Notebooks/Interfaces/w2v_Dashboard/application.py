import re, json, warnings, pickle, gensim
import pandas as pd
import numpy as np

# Primary visualizations
import matplotlib.pyplot as plt
import matplotlib
from matplotlib.patches import Patch
from matplotlib.lines import Line2D
import seaborn as sns
import plotly.express as px

# PCA visualization
from scipy.spatial.distance import cosine
from sklearn.metrics import pairwise
from sklearn.manifold import MDS, TSNE
from mpl_toolkits.mplot3d import Axes3D
from sklearn.decomposition import PCA

# Import (Jupyter) Dash -- App Functionality
import dash, dash_table
from dash.dependencies import Input, Output, State
from dash.exceptions import PreventUpdate
import dash_core_components as dcc
import dash_html_components as html
from jupyter_dash import JupyterDash

# Ignore simple warnings.
warnings.simplefilter('ignore', DeprecationWarning)

# Declare directory location to shorten filepaths later.
abs_dir = "/Users/quinn.wi/Documents/"

# Load model.
model = gensim.models.KeyedVectors.load_word2vec_format(abs_dir + 'Data/Output/WordVectors/jqa_w2v.txt')

# Load pca + tsne coordinates.
tsne_data = pd.read_csv(abs_dir + '/Data/Output/WordVectors/jqa_w2v_tsne-coordinates.csv', sep = ',')




def construct_graph(data, word, topn):
    word_list = []
    for i in model.most_similar([word], topn = topn):
        word_list.append(i[0])

    dff = data[data.words.isin(word_list + [word])]

    dff['color'] = np.where(dff['words'] != word, '#37718E', '#AEF3E7')

    fig = px.scatter_3d(dff, x = 'x', y = 'y', z = 'z',
                        text = 'words',
                        title = f't-SNE Cluster of "{word}" in dJQA.',
                        color = 'color')

    return fig



# App configurations
app = dash.Dash(__name__)
app.config.suppress_callback_exceptions = True


# Layout.
app.layout = html.Div(
    className = 'app-body',
    children = [

#             app-header
        html.Header(
            className="app-header",
            children = [
                html.Div('Word2Vec Dashboard', className = "app-header--title")
            ]),

        html.Div(
            className = 'row',
            children = [

                html.Div(className = 'col-md-3',
                         children = [
                             dcc.Input(id = 'text', type = 'text', value = 'work', debounce = True),

                             dcc.Slider(id = 'slider', min = 5, max = 35, step = 1, value = 20,
                                        marks = {str(i): str(i) for i in range(5, 35, 5)}),

                             html.Button('Click here to create analogies.', id = 'analogy-button'),

                             dcc.Graph(id = 'text_plot')
                         ]),

                html.Div(className = 'col-md-4', children = [dash_table.DataTable(id = 'cosine-table')]),
            ]
        )
])


###########################
######### Callbacks #######

###########################


# Scatter Plot.
@app.callback(
    Output('text_plot', 'figure'),
    [Input('text', 'value'), Input('slider', 'value')]
)
def update_textPlot(text, slider):
    return construct_graph(tsne_data, text.lower(), slider)

# Data Table.
@app.callback(
    [Output('cosine-table', 'data'), Output('cosine-table', 'columns')],
    [Input('text', 'value'), Input('slider', 'value')]
)
def update_dataTable(text, slider):
    sims = model.most_similar([text], topn = slider)
    cos_df = pd.DataFrame(sims, columns = ['word', 'similarity'])
    cos_df['similarity'] = cos_df['similarity'].round(3)
    cols = [{'name': i, 'id': i} for i in cos_df.columns]

    return cos_df.to_dict('rows'), cols



if __name__ == "__main__":
#     app.run_server(mode = 'inline', debug = True) # mode = 'inline' for JupyterDash
    app.run_server(debug = True)
