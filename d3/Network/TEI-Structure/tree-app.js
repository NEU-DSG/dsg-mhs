
// Tree structure doesn't work b/c TEI elements can have multiple parents.
// Type conversion.
const parseStringNA = string => (string === 'NA' ? undefined : string);
const parseNumberNA = number => (number === 'NA' ? null : +number);

function type(d) {
  return {
    // nodeID: +d.id,
    node: parseStringNA(d.node),
    parent: parseStringNA(d.parent),
    weight: parseNumberNA(d.weight),
  };
}

function buildTree(tei) {
    const margin = {top: 40, right: 40, bottom: 40, left: 40};
    const width = 700 - margin.right - margin.left;
    const height = 700 - margin.top - margin.bottom;

    // Stratify into hierarchy.
    const stratify = d3
        .stratify()
        .id(d => d.node)
        .parentId(d => d.parent);
    
    const dataHierarchy = stratify(tei);

    // console.log(dataHierarchy);
}


// Load data.
const tei_data = d3.csv("/TEI-Structure/jqa_tei-structure.csv", type).then(data => {
    console.log(data);
    buildTree(data);
})