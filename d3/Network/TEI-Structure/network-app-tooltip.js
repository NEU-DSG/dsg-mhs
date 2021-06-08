// SVG Dimensions
const margin = { top: 80, right: 40, bottom: 40, left: 200 };
const width = 960 - margin.right - margin.left;
const height = 500 - margin.top - margin.bottom;


// Utilities
function formatNumbers (d) {
    return d3.format('.2r')(d);
};

function mouseover() {
    
    nodeData = d3.select(this).data()[0];
        
    const nodeInfo = [
        ['Degree', formatNumbers(nodeData.degree, 2)],
        ['Community', formatNumbers(nodeData.modularity, 2)],
        ['Betweenness', formatNumbers(nodeData.betweenness, 3)],
        ['Eigenvector', formatNumbers(nodeData.eigenvector, 3)],
        ['Degree Centrality', formatNumbers(nodeData.degree_centrality, 3)]
    ];

    const tooltip = d3.select('.tooltip');

    tooltip
        .attr('display', 'block')
        .transition()
        .style('opacity', 0.95)
        .style('top', `${d3.event.clientY}px`)
        .style('left', `${d3.event.clientX + 15}px`);

    tooltip.select('h3').html(`${nodeData.id}`);

    d3.select('.toolbody')
        .selectAll('p')
        .data(nodeInfo)
        .join('p')
        .attr('class', 'tip-info')
        .html(d => `${d[0]}: ${d[1]}`);

    // Move tooltip.
    simulation.alphaTarget(0).restart();
};

function mousemove() {
    d3.select('.tooltip')
        .style('left', `${d3.event.clientX + 15}px`)
        .style('top', `${d3.event.clientY}`)
        .style('display', 'block');
};

function mouseout() {
    d3.select('.tooltip')
        .transition()
        .style('opacity', 0)
        .style('display', 'none');
};


function buildNetwork(data) {
    let margin = {top: 10, right: 10, bottom: 10, left: 10};
    let width = 600;
    let height = 600;

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

    // Build scales.
    const linkWidthScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.links.map(link => link.weight))])
        .range([1, 10]);

    const linkDashScale = d3
        .scaleOrdinal()
        .domain([0, .5, 1])
        .range([ "8 2", "2 2", null]);

    const nodeScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.nodes.map(node => node.degree))])
        .range([3, 30]);

    const fontSizeScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.nodes.map(node => node.degree))])
        .range([7, 16]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Build simulation.
    const simulation = d3.forceSimulation(data.nodes)
        .force("charge", d3.forceManyBody().strength(-1000))
        .force("link", d3.forceLink(data.links)
            .id(d => d.id)
            .distance(100).strength(0.5))
        //     .distance((d, i) => {
        //         if (d.source.degree >= 10) {
        //             return 100;
        //         } else {
        //             return 150;
        //         }
        //     })
        //     .strength((d, i) => {
        //         if (d.source.degree) {
        //             return 0.1;
        //         } else {
        //             return 0.8;
        //         }
        //     })
        // )
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("gravity", d3.forceManyBody().strength(20));

    // Build container.
    const svg = d3
        .select('.tei-network-container')
        .append('svg')
        // .attr('preserveAspectRatio', 'xMinYMin meet') // Full screen.
        // .attr('viewBox', "0 0 900 900")
        // .attr("position", "fixed")
        // .attr("top", 0)
        // .attr("left", 0)
        // .attr("height", "100%")
        // .attr("width", "100%")
        .attr("height", height + margin.top + margin.bottom) // Contained.
        .attr("width", width + margin.right + margin.left)
        .call(d3.zoom().on("zoom", function () { // Add zooming.
            svg.attr("transform", d3.event.transform)
            }))
        .append('g');

    // Build links.
    const link = svg
        .selectAll('path.link')
        .data(data.links)
        .enter()
        .append('path')
        .attr('class', 'edge')
        .attr('stroke', 'black')
        .attr('stroke-width', (d) => linkWidthScale(d.weight))
        .attr('stroke-dasharray', (d) => linkDashScale(d.weight))
        .attr('fill', "none");

    const lineGenerator = d3.line().curve(d3.curveCardinal);

    // Build nodes.
    const node = svg
        .selectAll('circle')
        .attr('class', 'node')
        .data(data.nodes)
        .enter()
        .append('circle')
        .attr('r', (d) => nodeScale(d.degree))
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('fill', (d) => colorScale(d.modularity));

    // Apply simulation & mouseover.
    node
        .call(drag(simulation))
        .on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseout', mouseout);
    
    // Build labels
    const labelContainer = svg
        .selectAll('node.label')
        .data(data.nodes)
        .enter()
        .append('g');

    labelContainer
        .append('text')
        .attr('pointer-events', 'none')
        .text(d => d.id)
        .attr('font-size', d => fontSizeScale(d.id))
        .attr('transform', (d) => {
            const scale = nodeScale(d.degree);
            const x = scale + 2;
            const y = scale + 4;
            return `translate(${d.x}, ${d.y})`
        });

    // Define position for nodes/links
    simulation.on('tick', () => {

        labelContainer
            .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

        node
            .attr('cx', (d) => d.x)
            .attr('cy', (d) => d.y);

        link
            .attr('d', (d) => {
                return lineGenerator([
                    [d.source.x, d.source.y],
                    [d.target.x, d.target.y]
                ])
            });

    });
}


function update() {
    const slider = document.getElementById("degreeRange");
    console.log(slider.value);
}


// Load data.
const tei_data = d3.json("/TEI-Structure/jqa_tei-network.json").then(data => {
    // console.log(data);
    // update(data);
    buildNetwork(data);
})