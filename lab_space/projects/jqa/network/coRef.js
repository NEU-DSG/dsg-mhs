// Const dimensions & constants.
const margin = { top: 80, right: 40, bottom: 40, left: 200 },
    width = 960 - margin.right - margin.left,
    height = 800 - margin.top - margin.bottom,
    radius = 6,
    duration = 300;

// Build svg container.
const svg = d3.select('.network')
    .append('svg')
        .attr('height', height + margin.top + margin.bottom)
        .attr('width', width + margin.right + margin.left)
    .call(d3.zoom().on('zoom', function (event) {
        svg.attr('transform', event.transform)
    }))
    .append('g');

const tooltip = d3.select('.tooltip-container')
    .append('div')
    .style('opacity', 0);

const toolHeader = tooltip
    .append('h3')
        .attr('class', 'tipHeader');

const toolBody = tooltip
    .append('div')
        .attr('class', 'tipBody');

// Utilities.
function formatNumbers(d) {
    return d3.format('.2r')(d);
};

let adjlist = [];

function neigh(a, b) {
    return a == b || adjlist.includes(a + '-' + b) || adjlist.includes(b + '-' + a);
};

d3.json('data/jqa_coRef-network.json').then(data => {
    console.log(data);



    // // Build first-step for focus/unfocus: adjlist + neigh()
    // data.links.forEach(function(d) {
    //     adjlist.push(d.source + '-' + d.target);
    // });

    // // Draw initial graph.
    // chart(data);
});