
// Utilities
function formatNumbers (d) {
    return d3.format('.2r')(d);
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
        .range([5, 30]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const fontSizeScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.nodes.map(node => node.degree))])
        .range([7, 16]);

    // Build simulation.
    const simulation = d3.forceSimulation(data.nodes)
        .force("charge", d3.forceManyBody().strength(-100))
        .force("link", d3.forceLink(data.links)
            .id(d => d.id)
            .distance(100).strength(0.5))
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

    node.call(drag(simulation));

    // Build text containers.
    const textContainer = svg
        .attr("class", "textContainer")
        .selectAll('g.label')        
        .data(data.nodes)
        .enter()
        .append('g');
    
    textContainer
        .append('text')
        .text(d => d.id)
        .attr('font-size', d => fontSizeScale(d.degree))
        // .attr('text-anchor', 'middle');
        .attr('transform', d => {
            const scale = nodeScale(d.degree);
            const x = scale + 2;
            const y = scale + 4;
            return `translate(${x}, ${y})`
        });

    const card = svg
        .append('g')
        .attr('pointer-events', 'none')
        .attr('display', 'none');
    
    const cardBackground = card.append('rect')
        .attr("class", "cardBackground")
        // .attr("width", 150)
        // .attr("height", 45)
        // .attr("fill", "#eee")
        // .attr("stroke", "#333")
        .attr("rx", 4);
    
    const cardTextName = card.append('text')
        .attr("class", "cardTextname")
        .attr("transform", "translate(8, 20)")
        .text("Defaule Text");

    let currentTarget;
    node.on("mouseover", d => {
        card.attr("display", "block");
    
        currentTarget = d3.event.target;

        const nodeInfo = [
            ['Degree', formatNumbers(currentTarget.degree, 2)],
            ['Community', formatNumbers(currentTarget.modularity, 2)],
            ['Betweenness', formatNumbers(currentTarget.betweenness, 2)],
            ['Eigenvector', formatNumbers(currentTarget.eigenvector, 2)],
            ['Degree Centrality', formatNumbers(currentTarget.degree_centrality, 2)]
        ];

        const cardTextInfo = card.selectAll('p')
            .data(nodeInfo)
            .join('p')
            .attr("class", "cardTextInfo")
            .html(d => `${d[0]}: ${d[1]}`);

        // Change card text on mouseover
        cardTextName.text(d.id);

        // // Adjust card size.
        // // Get boundary box width of cardTextName + Role, select largest.
        // const nameWidth = cardTextName.node().getBBox().width; 
        // const positionWidth = cardTextInfo.width;
        // const cardWidth = Math.max(nameWidth, positionWidth);

        // cardBackground.attr("width", cardWidth + 16);

        // Move hover card.
        simulation.alphaTarget(0).restart();
    });
    
    node.on("mouseout", d => {
        currentTarget = null;
        card.attr('display', 'none');
    });


    // Define position for nodes/links
    simulation.on('tick', () => {

        textContainer
            .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

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



// Load data.
const tei_data = d3.json("/TEI-Structure/jqa_tei-structure.json").then(data => {
    // console.log(data);
    buildNetwork(data);
})