d3.json('data/Sedgwick_coRef-network.json').then(data => {
    console.log(data);
    
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
        .append('g')
        .attr("transform", 
              "translate(" + margin.left + "," + margin.top + ")");

    // Build elements.
    const links = svg.append('g').attr('class', 'links');
    const nodes = svg.append('g').attr('class', 'nodes');
    const labels = svg.append('g').attr('class', 'labels');

    // Build scales.
    const colorScale = d3.scaleOrdinal(d3.schemePaired);
    const nodeScale = d3.scaleLinear().range([25, 50]);
    const fontSizeScale = d3.scaleLinear().range([12, 20]);
    const linkOpacity = d3.scaleLinear().range([0.4, 1]);
    const linkSize = d3.scaleLinear().range([0.5, 3])

    // Build tooltip.
    const tooltip = d3.select(".network")
        .append("div")
            .attr("class", "tooltip")
            .style('opacity', 0);

    const toolHeader = tooltip
        .append('h3')
            .attr("class", "tipHeader");

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
    
    // const dragStarted = (d, event) => {
    //     console.log(d);
    //     if (!event.active) simulation.alphaTarget(0.3).restart();
    //     d.fx = event.x;
    //     d.fy = event.y;
    //     // console.log( d3.select(this).raise() )
    //     // d3.select(this).raise().attr("transform", d=> "translate("+[d.x,d.y]+")" )
    // }
    // const dragged = (d, event) => {
    //     d.fx = event.x;
    //     d.fy = event.y;
    //     // d3.select(this).raise().attr("transform", d=> "translate("+[d.x,d.y]+")" )
    // }
    // const dragEnded = (d, event) => {
    //     if (!event.active) simulation.alphaTarget(0);
    //     // event.fx = null;
    //     // event.fy = null;
    //     d.fx = null;
    //     d.fy = null;
    // }

    drag = simulation => {
        function dragsubject(event) {
          return simulation.find(event.x, event.y);
        }
      
        function dragstarted(event) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        }
        
        function dragged(event) {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        }
        
        function dragended(event) {
          if (!event.active) simulation.alphaTarget(0);
          event.subject.fx = null;
          event.subject.fy = null;
        }
        
        return d3.drag()
            .subject(dragsubject)
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    // Build first-step for focus/unfocus: adjlist + neigh()
    data.links.forEach(function(d) {
        adjlist.push(d.source + '-' + d.target);
    });

    let link, node, label;

    const simulation = d3.forceSimulation()
        .force("charge", d3.forceManyBody()
            .strength(-8000)
            .distanceMin(100)
            .distanceMax(1000)
        )
        .force("center", d3.forceCenter(width/2, height/2))
        .force("gravity", d3.forceManyBody()
            .strength()
        )
        .force("collision", d3.forceCollide()
            .radius(d => d.r * 2)
        );

    // Tick function.
    simulation
        .nodes(data.nodes, d => d.id)
        .force("link", d3.forceLink(data.links)
            .id(d => d.id)
            .distance( height / data.nodes.length)
        )
        .on('tick', () => {
            label
                .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
    });

    // Draw initial graph.
    chart(data);

    // Apply drag and mouse over/out functions.
    node
        .call( drag(simulation) )
        .on('mouseover', function(event, d, i) {
            // Focus
            let source = event.target.__data__.id;

            node.style('opacity', function(o) {
                return neigh(source, o.id) ? 1: 0.1;
            });

            link.style('opacity', function(o) {
                return o.source.id == source || o.target.id == source ? 1 : 0.2;
            });

            label.attr('display', function(o) {
                return neigh(source, o.id) ? "block" : "none";
            });

            // Gather tooltip info.
            let nodeInfo = [
                ['Degree', formatNumbers(d.degree, 2)],
                // ['Community', formatNumbers(d.modularity, 2)],
                ['Betweenness', formatNumbers(d.betweenness, 3)],
                ['Eigenvector', formatNumbers(d.eigenvector, 3)],
                // ['Degree Centrality', formatNumbers(d.degree_centrality, 3)],
            ];

            tooltip
                .transition(duration)
                    .style('opacity', 0.97)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 15) + "px");
                
            toolHeader
                .html(d.id);

            toolBody
                .selectAll('p')
                .data(nodeInfo)
                .join('p')
                    .html(d => `${d[0]}: ${d[1]}`);

            simulation.alphaTarget(0).restart();
        })
        .on('mousemove', function(event) {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 15) + "px");
        })
        .on('mouseout', function (d, i, event) {
            tooltip.transition(duration).style('opacity', 0);

            // Unfocus.
            label.attr('display', 'block');
            node.style('opacity', 1);
            link.style('opacity', 1);
        })

    function chart(dataset) {

        // Update scales' domains.
        nodeScale.domain([0, d3.max(dataset.nodes.map(node => node.degree))]);
        fontSizeScale.domain([0, d3.max(dataset.nodes.map(node => node.degree))]);
        linkOpacity.domain([
            d3.min(dataset.links.map(link => link.weight)),
            d3.max(dataset.links.map(link => link.weight))
        ]);
        
        link = d3.select('.links')
            .selectAll('line')
            .data(dataset.links)
            .join(
                enter => enter.append('line')
                    .attr('class', 'link'),
                update => update,
                exit => exit.remove()
            );
    
        node = d3.select('.nodes')
            .selectAll("circle")
            .data(dataset.nodes)
            .join(
                enter => enter.append('circle')
                    .attr('r', (d) => nodeScale(d.degree))
                    .attr('class', 'node'),
                update => update
                    .attr('r', (d) => nodeScale(d.degree))
                    .attr('class', 'node'),
                exit => exit.transition().remove()
            );
    
        label = d3.select('.labels') // .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
            .selectAll('text')
            .data(dataset.nodes)
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
    
        // Reheat simulation.
        simulation.alphaDecay(0.01).restart();
    }
});