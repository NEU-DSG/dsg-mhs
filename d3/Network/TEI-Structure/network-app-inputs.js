// SVG Dimensions & Constants
const margin = { top: 80, right: 40, bottom: 40, left: 200 },
    width = 960 - margin.right - margin.left,
    height = 800 - margin.top - margin.bottom,
    radius = 6,
    duration = 300;

const svg = d3.select('.tei-network-container')
    .append('svg')
    .attr("height", height + margin.top + margin.bottom) // Contained.
    .attr("width", width + margin.right + margin.left)
    .call(d3.zoom().on("zoom", function () { // Add zooming.
        svg.attr("transform", d3.event.transform)
        }))
    .append('g');

// Build link, node, & labelContainer
const link = svg
    .append('g')
    .attr('class', 'edge');

const node = svg
    .append('g')
    .attr('class', 'node');

const labelContainer = svg
    .append('g')
    .attr('class', 'label-container');

// Build tooltip.
const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

const toolHeader = tooltip
    .append('h3')
    .attr("class", "tipHeader");

const toolBody = tooltip
    .append('div')
    .attr('class', 'tipBody');

// Build simulation
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id( function(d) { return d.id; }).strenght(0.5))
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter( width / 2, height / 2));

// Utilities
function formatNumbers (d) {
    return d3.format('.2r')(d);
};


function buildDrag(simulation) {
    // Build drag.
    const drag = simulation => {
        const dragStarted = d => {
            if (!d3.event.active) {
                simulation.alphaTarget(0.3).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
        }
        const dragged = d => {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        }
        const dragEnded = d => {
            if (!d3.event.active) {
                simulation.alphaTarget(0);
            }
            d.fx = null;
            d.fy = null;
        }
        return d3.drag()
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded)
    };

    return drag;
};


function drawNetwork(data, simulation) {
    // Scales
    const nodeScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.nodes.map(node => node.degree))])
        .range([2, 15]);

    const fontSizeScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.nodes.map(node => node.degree))])
        .range([4, 12]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    link
        .selectAll('path.link')
        .data(data.links)
        .enter()
        .append('path')
        .attr('class', 'edge')
        .attr('stroke', 'black')      
        .attr('fill', "none");

    node
        .selectAll('circle')
        .attr('class', 'node')
        .data(data.nodes)
        .enter()
        .append('circle')
        .attr('r', (d) => nodeScale(d.degree))
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('fill', (d) => colorScale(d.modularity));


    // // Define position for nodes/links
    // simulation.on('tick', () => {

    //     // labelContainer
    //     //     .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

    //     node
    //         .attr('cx', (d) => d.x)
    //         .attr('cy', (d) => d.y);

    //     link
    //         .attr('d', (d) => {
    //             return lineGenerator([
    //                 [d.source.x, d.source.y],
    //                 [d.target.x, d.target.y]
    //             ])
    //         });

    // });

};

// Load data.
const tei_data = d3.json("/TEI-Structure/jqa_tei-network.json").then(data => {
    console.log(data);
    // update(data);

    // const degreeVal = d3.select('.degree-slider').node().value;
    // console.log(degreeVal);

    const simulation = buildSimulation(data.nodes, data.links);

    drawNetwork(data, simulation);
});