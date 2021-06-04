function buildNetwork(data) {

    // Build drag simulation.
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

    // Set scales.
    const linkWidthScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.links.map(link => link.weight))])
        .range([[0.2, 3]]);

    const linkDashScale = d3
        .scaleOrdinal()
        .domain([0, 50, 100])
        .range(["4 2", "2 2", null]);

    const nodeScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.nodes.map(node => node.degree))])
        .range([5, 25]);

    const fontSizeScale = d3
        .scaleLinear()
        .domain([0, d3.max(data.nodes.map(node => node.degree))])
        .range([7, 12])

    // Build simulation.
    const simulation = d3.forceSimulation(data.nodes)
        .force("charge", d3.forceManyBody().strength(-70))
        .force("link", d3.forceLink(data.links)
            .id(d => d.id)
            .distance(55))
        .force("center", d3.forceCenter(300, 300))
        .force("gravity", d3.forceManyBody().strength(60));

    const svg = d3
        .select('.network-container')
        .append('svg')
        .attr('preserveAspectRatio', 'xMinYMin meet')
        .attr('viewBox', "0 0 960 500");

    // Build links.
    const link = svg
        .selectAll('path.link')
        .data(data.links)
        .enter()
        .append('path')
        .attr('class', 'edge')
        .attr('stroke', 'black')
        .attr("stroke-width", (d) => linkWidthScale(d.weight))
        .attr("stroke-dasharray", (d) => linkDashScale(d.weight))
        .attr('fill', 'none');

    const lineGenerator = d3.line().curve(d3.curveCardinal);

    // Build nodes.
    const node = svg
        .selectAll('circle')        
        .data(data.nodes)
        .enter()
        .append('circle')
        .attr('class', 'node')
        .attr('r', (d) => nodeScale(d.degree))
        .attr('stroke', 'black')
        .attr('stroke-width', 0.5)
        .attr('fill', 'grey');

    node.call(drag(simulation));

    // Build text container & card.
    const textContainer = svg
        .selectAll('g.label')
        .data(data.nodes)
        .enter()
        .append('g');
    
    textContainer
        .append('text')
        .text((d) => d.id)
        .attr('font-size', (d) => fontSizeScale(d.degree))
        .attr('transform', (d) => {
            const scale = nodeScale(d.degree);
            const x = scale + 2;
            const y = scale + 4;

            return `translate(${x}, ${y})`
        });

    const card = svg
        .append('g')
        .attr("pointer-events", "none")
        .attr('display', 'none');

    const cardBackground = card
        .append('rect')
        .attr('width', 150)
        .attr('height', 45)
        .attr('fill', '#eee')
        .attr('stroke', '#333')
        .attr('rx', 4);

    const cardTextName = card
        .append('text')
        .attr('transform', 'translate(8, 12)')
        .text('Default Name');
    
    // Control mouse actions.
    let currentTarget;

    node.on('mouseover', d => {
        card.attr('display', 'block');

        currentTarget = d3.event.target;

        // Change name on card.
        cardTextName.text(d.id);

        // Adjust card size.
        const nameWidth = cardTextName.node().getBBox().width;

        cardBackground.attr('width', nameWidth + 16);

        // Move hover card.
        simulation.alphaTarget(0).restart();

    });

    node.on('mouseout', d => {
        currentTarget = null;
        card.attr('display', 'none');
    });
    
    
    // Define coordinates for each node/link.
    simulation.on('tick', () => {

        textContainer
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
        
        // Move card to node location.
        if (currentTarget) {
            const radius = currentTarget.r.baseVal.value;
            const xPos = currentTarget.cx.baseVal.value + radius + 3;
            const yPos = currentTarget.cy.baseVal.value + radius + 3;

            card.attr('transform', `translate(${xPos}, ${yPos})`);
        }
    });
}



d3.json('/JQA-coReference/jqa_coef-network-subset.json').then((data) => {
    console.log(data);
    buildNetwork(data);
})