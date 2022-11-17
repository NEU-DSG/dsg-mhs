# Primary Source Coop Documentation
This GitHub repository houses the various scripts and data outputs of the Primary Source Cooperative’s (PSC) Digital Lab Space. There are two halves of the repository: the Jupyter_Notebooks and the lab_space. The Jupyter Notebooks process XML files and extract data. The data outputs of the notebooks are then saved in the lab_space, which holds the HTML and Javascript files for visualizations. In this way, whenever a notebook script is re-run, the visualization should automatically reflect any changes in the data outputs.

## Jupyter_Notebooks
The subdirectory of notebooks is organized around specific data derivatives. There are scripts to extract data for each project within each subfolder. For example, the “Networks” folder is dedicated to constructing graphs of co-occurrences. There is a separate network script for each project of the Primary Source Coop. Furthermore, each notebook follows a general pattern: read in libraries, parse XML files and build a dataframe, and, lastly extract the specified information.

In order to connect to the PSC’s BaseX database, you have to be connected to Northeastern’s VPN.

Changes to the data might necessitate tweaking the visualization code in some cases (networks).
Interfaces

### Named Entities
Named entities are gathered in x ways:

Future plans: develop custom models from the XML to improve probabilities of named entity recognition.

### Networks
The network data of each project is currently a co-occurrence network of named individuals. More precisely, these co-occurrences are adjacency matrices of unique identifiers found in each text (using pandas .crosstab function). The matrices are the inputs for building the networks (using the networkx library). 

For larger projects, which are too computationally expensive to illustrate through web browsers, the visualizations are sub-networks chosen by the editors. 
Scripts

### Sentiments
The sentiment data measures and assigns a positive or negative emotion to each text (using textblob). With datasets that slow down web browsers, a subset of values close to zero will be removed.

### Subjects
The subjects notebooks produce three types of data from the subject headings of each text: raw counts, normalized counts, and subject co-occurrence networks. The raw counts provide an overview of the most frequently used subjects within the corpus. The normalized count shows subjects as a percentage of total subject counts for each year. Lastly, the subject networks 

## Lab_space
The lab_space subdirectory is organized around the different projects of the Primary Source Cooperative. For example, the John Quincy Adams project has its own subdirectory within the lab_space that contains the data outputs and web pages dedicated to that project. There are folders for the data derivatives for that project further down the subdirectory.

### Styles
The styles folder contains the CSS files as well as Javascript files for creating a navigation menu on each page. While the CSS files here govern the styling of global elements in the lab space, styles unique to each visualization may be called on the page that the visualization appears.
