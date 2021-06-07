

function buildTree(data) {
    // const margin = {top: 40, right: 40, bottom: 40, left: 40};
    // const width = 700 - margin.right - margin.left;
    // const height = 700 - margin.top - margin.bottom;

    // Stratify into hierarchy.
    const stratify = d3
        .stratify()
        .id(d => d.target)
        .parentId(d => d.source);

    const dataHierarchy = stratify(data);

    // console.log(dataHierarchy);
}


// Load data.
const tei_data = d3.csv("/TEI-Structure/jqa_tei-structure.csv").then(data => {
    console.log(data);
    buildTree(data);
})