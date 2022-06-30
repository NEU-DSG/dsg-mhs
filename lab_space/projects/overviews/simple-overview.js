'use strict'

// Preprocess Data.
function type(d) {
    var parseNA = string => (string === 'NA' ? undefined : string);
    
    // Change data type for count.
    return {
        project: parseNA(d.project).toLowerCase(), // lower casing to match HTML id's.
        docCount:parseFloat(+d.docCount).toLocaleString(),
        wordCount: parseFloat(+d.wordCount).toLocaleString(),
    };
}

// Read-in data, call type(), then process and build graph.
d3.csv('overviews/data/simple-counts.csv', type).then( data => {

    data.forEach( o => {
        let linebreak = document.createElement("br");

        let div = document.getElementById(`${o.project}-header`);
        
        let docs = document.createTextNode(`${o.docCount} documents`);
        let words = document.createTextNode(`${o.wordCount} words`);

        div.append(docs);
        div.append(linebreak);
        div.append(words);

    });

})