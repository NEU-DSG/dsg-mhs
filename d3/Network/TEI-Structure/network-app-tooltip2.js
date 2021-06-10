// SVG Dimensions & Constants
const margin = { top: 80, right: 40, bottom: 40, left: 200 },
    width = 960 - margin.right - margin.left,
    height = 800 - margin.top - margin.bottom,
    radius = 6;


const duration = 300;


// Utilities
function formatNumbers (d) {
    return d3.format('.2r')(d);
};

function buildNetwork(data) {

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
        .force("charge", d3.forceManyBody().strength(-800))
        .force("link", d3.forceLink(data.links)
            .id(d => d.id)
            .distance(100).strength(1))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("gravity", d3.forceManyBody().strength(20));

    // Build container.
    const svg = d3
        .select('.tei-network-container')
        .append('svg')
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
        .call(drag(simulation));
    
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

    // Hovercard template
    const card = svg
        .append('g')
        .attr("pointer-events", "none") // Set to none so user doesn't interact with card
        .attr('display', 'none');
        
    const cardBackground = card.append('rect')
        .attr("class", "cardBackground")
        .attr('width', 150)
        .attr("height", 45)
        .attr('fill', "#eee")
        .attr("stroke", "#333")
        .attr("rx", 4); // Round corners

    const cardTextName = card
        .append('text')
        .attr("transform", "translate(8, 20)")
        .text("DEFAULT NAME");

    // const cardInfo = card
    //     .append('text')
    //     .attr("font-size", 10)
    //     .attr("transform", "translate(8, 35)")
    //     .text("DEFAULT TEXT");

    let currentTarget;

    node.on("mouseover", d => {

        currentTarget = d3.event.target;
        
        const nodeInfo = [
            ['Degree', formatNumbers(d.degree, 2)],
            ['Community', formatNumbers(d.modularity, 2)],
            ['Betweenness', formatNumbers(d.betweenness, 3)],
            ['Eigenvector', formatNumbers(d.eigenvector, 3)],
            ['Degree Centrality', formatNumbers(d.degree_centrality, 3)]
        ];

        card
            .attr("display", "block")
            .transition(duration)
            .style('opacity', 0.95);

        cardTextName.text(d.id);
        
        const cardInfo = card
            .append('text')
            .attr("font-size", 10)
            .attr("transform", "translate(8, 35)")
            .data(nodeInfo)
            .text(d => `${d[0]}: ${d[1]}`);

        // Move hover card with if-condition in simulation call below.
        simulation.alphaTarget(0).restart();
    });

    node.on("mouseout", () => {
        currentTarget = null;
        card.attr('display', 'none');        
    })

    
    

    // Define position for nodes/links
    simulation.on('tick', () => {

        labelContainer
            .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

        node
            .attr('cx', (d) => d.x) // Unbounded.
            .attr('cy', (d) => d.y);
            // .attr('cx', function (d) { return d.x = Math.max(radius, Math.min(width - radius, d.x)); }) // Bounded.
            // .attr('cy', function (d) { return d.y = Math.max(radius, Math.min(height - radius, d.y)); });

        link
            .attr('d', (d) => {
                return lineGenerator([
                    [d.source.x, d.source.y],
                    [d.target.x, d.target.y]
                ])
            });

        // Move card to node location.
        if (currentTarget) {
            // console.log(currentTarget);
            const radius = currentTarget.r.baseVal.value;
            const xPos = currentTarget.cx.baseVal.value + radius + 3;
            const yPos = currentTarget.cy.baseVal.value + radius + 3;

            card.attr("transform", `translate(${xPos}, ${yPos})`);
        }

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