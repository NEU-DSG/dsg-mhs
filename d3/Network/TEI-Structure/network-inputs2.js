// SVG Dimensions & Constants
const margin = { top: 80, right: 40, bottom: 40, left: 200 },
    width = 960 - margin.right - margin.left,
    height = 800 - margin.top - margin.bottom,
    radius = 6,
    duration = 300;

// Load data.
d3.json("/TEI-Structure/jqa_tei-network.json").then(data => {

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

    const nodeScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.nodes.map(node => node.degree))])
        .range([5, 25]);

    const fontSizeScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.nodes.map(node => node.degree))])
        .range([4, 12]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // const linkScale = d3
    //     .scaleLinear()
    //     .domain([d3.min(data.links.map(link))])

    // Build simulation.
    const simulation = d3.forceSimulation(data.nodes)
        .force("charge", d3.forceManyBody()
            .strength(-800)
            .distanceMin(1)
            .distanceMax(500))
        .force("link", d3.forceLink(data.links)
            .id(d => d.id)
            .distance(80)
            .strength(1))
        .force("center", d3.forceCenter(width / 1.5, height / 1.5))
        .force("gravity", d3.forceManyBody().strength(20));


    // Build nodes.
    const node = svg
        .selectAll('circle')
        .attr('class', 'node')
        .data(data.nodes) //, (d) => d)
        .enter()
        .append('circle')
        .attr('r', (d) => nodeScale(d.degree))
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('fill', (d) => colorScale(d.modularity));

    
    // Update positions for nodes/links
    simulation.on('tick', () => {
        // labelContainer
        //     .attr('transform', (d) => `translate(${d.x}, ${d.y})`);


        node
            .attr('cx', (d) => d.x)
            .attr('cy', (d) => d.y);
    
        // link
        //     .attr('d', (d) => {
        //         return lineGenerator([
        //             [d.source.x, d.source.y],
        //             [d.target.x, d.target.y]
        //         ])
        //     });
    });

});
