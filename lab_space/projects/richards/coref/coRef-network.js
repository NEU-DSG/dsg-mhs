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
}

let adjlist = [];

function neigh(a, b) {
    return a == b || adjlist.includes(a + '-' + b) || adjlist.includes(b + '-' + a);
}

d3.json('data/Richards_coRef-network.json').then(data => {
    console.log(data);

    // Build first-step for focus/unfocus: adjlist + neigh()
    data.links.forEach(function(d) {
        adjlist.push(d.source + '-' + d.target);
    });

    // Draw initial graph.
    chart(data);
});

function chart(dataset) {
    const links = dataset.links.map(d => Object.create(d));
    const nodes = dataset.nodes.map(d => Object.create(d));

    let nodeScale = d3.scaleLinear()
        .domain([0, d3.max(nodes.map(node => node.degree))])
        .range([10, 40]);
    
    let fontSizeScale = d3.scaleLinear()
        .domain([0, d3.max(nodes.map(node => node.degree))])
        .range([12, 20]);

    // Build simulation.
    let simulation = d3.forceSimulation(nodes)
        .force('charge', d3.forceManyBody()
            .strength(-8000)
            .distanceMin(100)
            .distanceMax(1000))
        .force('link', d3.forceLink(links)
            .id(d => d.id)
            .distance(100)
            .strength( 1 )) // d => d.weight
        .force('center', d3.forceCenter(width / 1.5, height / 1.5))
        .force('gravity', d3.forceManyBody().strength(100));

    // Build drag.
    let drag = simulation => {
        let dragStarted = (d, event) => {
            if (!event.active) {
                simulation.alphaTarget(0.3).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
        }
        let dragged = (d, event) => {
            d.fx = event.x;
            d.fy = event.y;
        }
        let dragEnded = (d, event) => {
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
    
    let link = svg.selectAll('line')
        .data(links)
        .join(
            enter => enter.append('line')
                .attr('class', 'edge'),
            update => update,
            exit => exit.remove()
        );

    let node = svg.selectAll('circle')
        .data(nodes)
        .join(
            enter => enter.append('circle')
                .attr('r', (d) => nodeScale(d.degree))
                .attr('class', 'node'),
            update => update
                .attr('r', (d) => nodeScale(d.degree))
                .attr('class', 'node'),
            exit => exit.transition().remove()
        )
        .call(drag(simulation));

    let labelContainer = svg.selectAll('text')
            .data(nodes)
            .join(
                enter => enter.append('text')
                        .attr('pointer-events', 'none')
                        .attr('class', 'label')
                    .text(d => d.id)
                        .attr('font-size', d => fontSizeScale(d.degree))
                        .attr('transform', (d) => {
                            let scale = nodeScale(d.degree);
                            let x = scale + 2;
                            let y = scale + 4;
                            return `translate(${d.x}, ${d.y})`
                        }),
                update => update
                    .text(d => d.id)
                        .attr('font-size', d => fontSizeScale(d.degree))
                        .attr('transform', (d) => {
                            let scale = nodeScale(d.degree);
                            let x = scale + 2;
                            let y = scale + 4;
                            return `translate(${d.x}, ${d.y})`
                        }),
                exit => exit.transition().remove()
            )

    // Move mouse over/out.
    node.on('mouseover', function(event, d, i) {
        // Focus
        let source = d3.select(event.target).datum().__proto__.id;

        node.style('opacity', function(o) {
            return neigh(source, o.__proto__.id) ? 1: 0.1;
        });

        link.style('opacity', function(o) {
            return o.source.__proto__.id == source || o.target.__proto__.id == source ? 1 : 0.2;
        });

        labelContainer.attr('display', function(o) {
            return neigh(source, o.__proto__.id) ? "block" : "none";
        });

        // Gather tooltip info.
        let nodeInfo = [
            ['Degree', formatNumbers(d.degree, 2)],
            ['Community', formatNumbers(d.modularity, 2)],
            ['Betweenness', formatNumbers(d.betweenness, 3)],
            ['Eigenvector', formatNumbers(d.eigenvector, 3)],
            ['Degree Centrality', formatNumbers(d.degree_centrality, 3)],
        ];

        tooltip
            .transition(duration)
                .style('opacity', 0.97);
            
        toolHeader
            .html(d.id);

        toolBody
            .selectAll('p')
            .data(nodeInfo)
            .join('p')
                .html(d => `${d[0]}: ${d[1]}`);

        simulation.alphaTarget(0).restart();
    });

    node.on('mouseout', function (d, i, event) {
        tooltip.transition(duration).style('opacity', 0);

        // Unfocus.
        labelContainer.attr('display', 'block');
        node.style('opacity', 1);
        link.style('opacity', 1);
    })


    // Tick function.
    simulation.on('tick', () => {

        labelContainer
            .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    })
}