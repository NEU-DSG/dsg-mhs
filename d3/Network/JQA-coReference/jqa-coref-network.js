// Dimensions & Constants
const margin = { top: 80, right: 40, bottom: 40, left: 200 },
    width = 960 - margin.right - margin.left,
    height = 800 - margin.top - margin.bottom,
    radius = 6,
    duration = 300;

// Build SVG (network) container.
const svg = d3
   .select('.tei-network-container')
   .append('svg')
       .attr("height", height + margin.top + margin.bottom) // Contained.
       .attr("width", width + margin.right + margin.left)
   .call(d3.zoom().on("zoom", function () { // Add zooming.
       svg.attr("transform", d3.event.transform)
       }))
   .append('g');

// Build tooltip container.
const tooltip = d3
    .select(".tooltip-container")
    .append("div")
        .style("opacity", 0);

const toolHeader = tooltip
    .append('h3')
        .attr("class", "tipHeader");

const toolBody = tooltip
    .append('div')
        .attr('class', 'tipBody');

// Utilities
function formatNumbers (d) {
    return d3.format('.2r')(d);
};

let adjlist = [];

function neigh(a, b) {
    return a == b || adjlist.includes(a + '-' + b) || adjlist.includes(b + '-' + a);
}


// d3.json('/JQA-coReference/network.json').then(data => {
// d3.json('/JQA-coReference/jqa_coef-network-subset.json').then(data => {
d3.json('/JQA-coReference/ego-boylston-ward.json').then(data => {

     // Build first-step for focus/unfocus: adjlist + neigh()
     data.links.forEach(function(d) {
        adjlist.push(d.source + '-' + d.target);
    });

    // Draw initial graph.
    chart(data);

    // Listeners call chart().
    d3.select('#degree-slider').on('input', input);
    d3.select('#between-slider').on('input', input);

    // Generic input filter for all sliders.
    function input() {

        let thisID = this.id // ID of whichever input changed.
        let inputVal = +this.value; // Value of changed input.

        // Switch function decides which property to filter.
        function switchResult(thisID) {
            switch (thisID) {
                case 'degree-slider': {
                    return 'degree';
                }
                case 'between-slider': {
                    return 'betweenness';
                }
                default: {
                    console.log('Default Input');
                    break;
                }
            }
        }
        let inputSwitch = switchResult(thisID);

        // Result of switch function filters node property here.
        let newNodes = [...data.nodes.filter( d => d[inputSwitch] > inputVal )];
        let ids = newNodes.map( d => d.id);

        // Select only links in which both source & target are present in nodes list.
        let newLinks = [...data.links.filter( d => (ids.includes(d.source)) && (ids.includes(d.target)) )];

        let dataset = {
            'nodes': [...newNodes],
            'links': [...newLinks]
        };

        // Update graph.
        chart(dataset);
    };
});

function chart(dataset) {
    const links = dataset.links.map(d => Object.create(d));
    const nodes = dataset.nodes.map(d => Object.create(d));

    // Build scales.
    const colorScale = d3.scaleOrdinal(d3.schemePaired);

    const nodeScale = d3
        .scaleLinear()
        .domain([0, d3.max(nodes.map(node => node.degree))])
        .range([10, 50]);

    const fontSizeScale = d3
        .scaleLinear()
        .domain([0, d3.max(nodes.map(node => node.degree))])
        .range([12, 20]);

    // Build simulation.
    const simulation = d3
        .forceSimulation(nodes)
        .force("charge", d3.forceManyBody()
            .strength(-8000)
            .distanceMin(1)
            .distanceMax(1000))
        .force("link", d3.forceLink(links)
            .id(d => d.id)
            .distance(100)
            .strength(1))
        .force("center", d3.forceCenter(width / 1.5, height / 1.5))
        .force("gravity", d3.forceManyBody().strength(20));

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
  
    const link = svg
        .selectAll("line")
        .data(links)
        .join(
            enter => enter.append("line")
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0.7),
            update => update
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0.7),
            exit => exit.remove()
        );
  
    const node = svg
        .selectAll("circle")
        .data(nodes)
        .join(
            enter => enter.append('circle')
                .attr('r', (d) => nodeScale(d.degree))
                .attr('fill', (d) => colorScale(d.modularity)),
                // .attr('fill', (d) => d.color),
            update => update
                .attr('r', (d) => nodeScale(d.degree))
                .attr('fill', (d) => colorScale(d.modularity)),
                // .attr('fill', (d) => d.color),
            exit => exit.transition().remove()
        )
        .call(drag(simulation));
    
    const labelContainer = svg
        .selectAll('text')
        .data(nodes)
        .join(
            enter => enter.append('text')
                    .attr('pointer-events', 'none')
                .text(d => d.id)
                    .attr('font-size', d => fontSizeScale(d.degree))
                    .attr('transform', (d) => {
                        const scale = nodeScale(d.degree);
                        const x = scale + 2;
                        const y = scale + 4;
                        return `translate(${d.x}, ${d.y})`
                    }),
            update => update
                .text(d => d.id)
                    .attr('font-size', d => fontSizeScale(d.degree))
                    .attr('transform', (d) => {
                        const scale = nodeScale(d.degree);
                        const x = scale + 2;
                        const y = scale + 4;
                        return `translate(${d.x}, ${d.y})`
                    }),
            exit => exit.transition().remove()
        )

    // Mouse over/out.
    node.on("mouseover", function (d, i) {

        // Focus
        let source = d3.select(d3.event.target).datum().__proto__.id;

        node.style("opacity", function(o) {
            return neigh(source, o.__proto__.id) ? 1 : 0.1;
        });
        link.style("opacity", function(o) {
            return o.source.__proto__.id == source || o.target.__proto__.id == source ? 1 : 0.2;
        });
        labelContainer.attr("display", function(o) {
          return neigh(source, o.__proto__.id) ? "block": "none";
        });

        // Gather info for tooltip.
        const nodeInfo = [
            ['Degree', formatNumbers(d.degree, 2)],
            ['Community', formatNumbers(d.modularity, 2)],
            ['Betweenness', formatNumbers(d.betweenness, 3)],
            ['Eigenvector', formatNumbers(d.eigenvector, 3)],
            ['Degree Centrality', formatNumbers(d.degree_centrality, 3)],
        ];

        tooltip
            .transition(duration)
                .style("opacity", 0.97);

        toolHeader
            .html(d.id);

        toolBody
            .selectAll('p')
            .data(nodeInfo)
            .join('p')
                .html(d => `${d[0]}: ${d[1]}`);

        simulation.alphaTarget(0).restart();
    });

    node.on("mouseout", function(d, i) {        
        tooltip.transition(duration).style("opacity", 0);

        // Unfocus
        labelContainer.attr("display", "block");
        node.style("opacity", 1);
        link.style("opacity", 1);
    })

    // Tick function.
    simulation.on("tick", () => {

        labelContainer
            .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
    
        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        });
};