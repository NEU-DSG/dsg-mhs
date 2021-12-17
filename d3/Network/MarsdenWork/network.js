// Dimensions & Constants
const margin = { top: 80, right: 40, bottom: 40, left: 200 },
    width = 960 - margin.right - margin.left,
    height = 800 - margin.top - margin.bottom,
    radius = 6,
    duration = 300;

// Build container.
const svg = d3
   .select('.network-container')
   .append('svg')
       .attr("height", height + margin.top + margin.bottom) // Contained.
       .attr("width", width + margin.right + margin.left)
   .call(d3.zoom().on("zoom", function (event) { // Add zooming.
       svg.attr("transform", event.transform)
       }))
   .append('g');

// Utilities
function formatNumbers (d) {
    return d3.format('.2r')(d);
};

let adjlist = [];

function neigh(a, b) {
    return a == b || adjlist.includes(a + '-' + b) || adjlist.includes(b + '-' + a);
}

const w = window.innerWidth;
const h = window.innerHeight;

// d3.json("/MarsdenWork/marsden-lemma-vectors-network-filtered90.json").then(data => {
d3.json("/MarsdenWork/Data/marsden-lemma-vectors-network.json").then(data => {

    // Populate dropdown menu (propertySelector).
    let propKeys = Object.keys(data.nodes[0]); // select first node and get keys.
    propKeys = propKeys.filter(item => (item !== 'degree') | (item !== 'betweenness') | (item !== 'eigenvector') | (item !== 'degree_cent') | (item !== 'source') | (item !== 'target') | (item !== 'id')); // remove some keys.
    console.log(propKeys);



    // Filter to remove nodes before graphing.
    let source_filter = Array(['freewoman', 'egoist', 'bondwoman']); // 'woman', 'man', 
    
    data.nodes = data.nodes.filter( d => source_filter[0].includes(d.source));
    let nodes_id = data.nodes.map(d => d.id);
    data.links = data.links.filter( d => nodes_id.includes(d.source) && nodes_id.includes(d.target));

     // Build first-step for focus/unfocus: adjlist + neigh()
     data.links.forEach(function(d) {
        adjlist.push(d.source + '-' + d.target);
    });

    // Draw initial graph.
    chart(data);

    // Listeners call chart().
    d3.select('#degree-slider').on('input', numericInput);
    d3.select('#between-slider').on('input', numericInput);

    // Generic input filter for all sliders.
    function numericInput() {

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
        let newNodes = [...data.nodes.filter( d => d[inputSwitch] >= inputVal )];
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
        .range([15, 25]);

    const fontSizeScale = d3
        .scaleLinear()
        .domain([0, d3.max(nodes.map(node => node.degree))])
        .range([12, 20]);

    // Build simulation.
    const simulation = d3
        .forceSimulation(nodes)
        .force("charge", d3.forceManyBody()
            .strength(-1000)
            .distanceMin(100)
            .distanceMax(1000)
            )
        .force("link", d3.forceLink(links)
            .id(d => d.id)
            .distance( h / (dataset.nodes.length / 10))
            .strength(1)
            )
        .force("center", d3.forceCenter(width / 1.5, height / 1.5))
        .force("gravity", d3.forceManyBody().strength(-1000));

    // Build drag.
    const drag = simulation => {
        const dragStarted = (d, event) => {
            if (!event.active) {
                simulation.alphaTarget(0.3).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
        }
        const dragged = (d, event) => {
            d.fx = event.x;
            d.fy = event.y;
        }
        const dragEnded = (d, event) => {
            if (!event.active) {
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
                .attr('fill', (d) => colorScale(d.source)),
            update => update
                .attr('r', (d) => nodeScale(d.degree))
                .attr('fill', (d) => colorScale(d.source)),
            exit => exit.transition().remove()
        )
        .call( drag(simulation) );
    
    const label = svg
        .selectAll('text')
        .data(nodes)
        .join(
            enter => enter.append('text')
                    .attr('pointer-events', 'none')
                    .attr("display", "block") // block display initially
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
                    .attr("display", "block")
                    .attr('font-size', d => fontSizeScale(d.degree))
                    .attr('transform', (d) => {
                        const scale = nodeScale(d.degree);
                        const x = scale + 2;
                        const y = scale + 4;
                        return `translate(${d.x}, ${d.y})`
                    }),
            exit => exit.transition().remove()
        )     

    // Build tooltip.
    const tooltip = d3
        .select('.tooltip-container') // .select("body")
        .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

    const toolHeader = tooltip
        .append('h3')
            .attr("class", "tipHeader");

    const toolBody = tooltip
        .append('div')
            .attr('class', 'tipBody');

    // Mouse over/out.
    node.on("mouseover", function (d, event) {
        console.log(event.__proto__);

        // Focus
        let source = event.__proto__.id;
        
        node.style("opacity", function(o) {
            return neigh(source, o.__proto__.id) ? 1 : 0.1;
        });
        link.style("opacity", function(o) {
            return o.source.__proto__.id == source || o.target.__proto__.id == source ? 1 : 0.1;
        });
        label.attr("display", function(o) {
          return neigh(source, o.__proto__.id) ? "block": "none";
        });

        // Gather info for tooltip.
        let node_data = event.__proto__;

        const nodeInfo = [
            ['Degree', formatNumbers(node_data.degree, 2)],
            ['Community', formatNumbers(node_data.modularity, 2)],
            ['Betweenness', formatNumbers(node_data.betweenness, 3)],
            ['Eigenvector', formatNumbers(node_data.eigenvector, 3)],
            ['Degree Centrality', formatNumbers(node_data.degree_centrality, 3)]
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
                .html(d => `${d[0]}: ${d[1]}`)
                .style("left", (event) => (event.pageX + 10) + "px")
                .style("top", (event) => (event.pageY - 15) + "px");

        simulation.alphaTarget(0).restart();
    });

    node.on("mousemove", function (d, event, i) {
        tooltip
            .style('left', `${event.clientX + 15}px`)
            .style('top', `${event.clientY}px`);
    })

    node.on("mouseout", function(d, i) {        
        tooltip.transition(duration).style("opacity", 0);

        // Unfocus
        label.attr("display", "block");
        node.style("opacity", 1);
        link.style("opacity", 1);
    })

    // Tick function.
    simulation.on("tick", () => {

        label
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