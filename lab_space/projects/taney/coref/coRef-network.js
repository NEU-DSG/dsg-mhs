// Utilities.
function formatNumbers(d) {
    return d3.format('.2r')(d);
}

let adjlist = [] // Adjacency list for highlighting connected nodes.

function neigh(a, b) {
    return a == b || adjlist.includes(a + '-' + b) || adjlist.includes(b + '-' + a);
}

// Build drag event handlers
function dragStarted(d, event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}
  
function dragged(d, event) {
    d.fx = event.x;
    d.fy = event.y;
    console.log(d.fy);
}
  
function dragEnded(d, event) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

d3.json('data/taney_coRef-network.json').then(data => {
    // Build constants.
   let margin = {top: 30, right: 30, bottom: 30, left: 30},
       width = 960,
       height = 700,
       duration = 300;

   // Build container.
   const svg = d3.select('.network')
   .append('svg')
       .attr("height", height + margin.top + margin.bottom) // Contained.
       .attr("width", width + margin.right + margin.left)
   .call(d3.zoom()
       .scaleExtent([0.15, 6])
       .on("zoom", function (event) { // Add zooming.
           svg.attr("transform", event.transform)
       }))
   .append('g')
   .attr('transform', `translate(${margin.left}, ${margin.top})`);

   // Coordinates of SVG boundaries.
   const pos = svg.node().getBoundingClientRect();
   console.log(pos);

   // Build elements.
   svg.append('g').attr('class', 'links'); // links
   svg.append('g').attr('class', 'nodes'); // nodes
   svg.append('g').attr('class', 'labels'); // labels

   // Build tooltip.
   const tooltip = d3.select('.network') // d3.select('.tooltip-container')
       .append('div')
           .attr('class', 'network-tooltip')
           .style('opacity', 0)
           .style('position', 'fixed')
           .attr('pointer-events', 'none');

   const toolHeader = tooltip
       .append('h3')
       .attr('class', 'toolHeader')
       .attr('pointer-events', 'none');

   const toolBody = tooltip
       .append('p')
       .attr('class', 'toolBody')
       .attr('pointer-events', 'none');

   // Build first-step for focus/unfocus: adjlist + neigh()
   data.links.forEach(function(d) {
       adjlist.push(d.source + '-' + d.target);
   });

   // Build node & font scales.
   let nodeColor = d3.scaleSequential(
       d3.schemeSet2
       // d3.schemeTableau10
   )
   .domain(d3.extent(data.nodes.map(node => node.modularity)));

   let nodeScale = d3.scaleLinear()
       .domain(d3.extent(data.nodes.map(node => node.degree)))
       .range([25, 100]);
   
   let fontSizeScale = d3.scaleLinear()
       .domain([0, d3.max(data.nodes.map(node => node.degree))])
       .range([16, 32]);

   let edgeScale = d3.scaleLinear()
       .domain(d3.extent(data.links.map(link => link.weight)))
       .range([3, 20])

   // Instantiate variables for later use.
   let link, node, label;

   // Build force simulation.
   // Documentation: https://devdocs.io/d3~7/d3-force#forcesimulation
   const simulation = d3.forceSimulation()
       .force("charge", d3.forceManyBody()
           .strength(-1000)
           .distanceMin(100)
           .distanceMax(1000)
       )
       .force("center", d3.forceCenter( width/2, height/2 ))
       .force("gravity", d3.forceManyBody()
           .strength()
       )
       .force("collision", d3.forceCollide()
           .radius(d => d.r * 2)
       )
       .force('center', d3.forceCenter(width / 2, height / 2));


   // Add nodes, links, & labels to simulation and tell them to move in unison with each tick.
   simulation
       .nodes(data.nodes, d => d.id)
       .force('collide', d3.forceCollide().radius(d => nodeScale(d.degree) + 10))
       .force("link", d3.forceLink(data.links)
           .id(d => d.id)
           .distance( height / data.nodes.length)
           // .distance(100)
       )
       .on("tick", (d) => { // tick function.

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
       }
   );

   // Draw initial graph.
   chart(data);

   // Draw network function.
   function chart(dataset) {

       let nodes = dataset.nodes.map(d => Object.create(d));
       let links = dataset.links.map(d => Object.create(d));

       // links = links.filter(function (d) { return d.weight >= 0.5 });
       // nodes = nodes.filter( (d) => links.find( ({source}) => d.id === source));
       // nodes = nodes.filter(function (d) {return d.degree >= 20});
       // links = links.filter( (d) => nodes.find( ({id}) => d.id === id) );

       // Draw links.
       link = d3.select('.links')
           .selectAll('line')
           .data(links)
           .join(
               enter => enter.append('line')
                   .attr('class', 'edge')
                   .attr("x1", d => d.source.x)
                   .attr("y1", d => d.source.y)
                   .attr("x2", d => d.target.x)
                   .attr("y2", d => d.target.y)
                   .attr('stroke', d => nodeColor(d.source['modularity']) )
                   .attr('stroke-width', d => edgeScale(d.__proto__.weight) )
                   .attr('opacity', 0.6),
               update => update,
               exit => exit.transition().remove()
           );

       // Draw nodes.
       node = d3.select('.nodes')
           .selectAll("circle")
           .data(nodes)
           .join(
               enter => enter.append('circle')
                   .attr('class', 'node')
                   .attr("cx", d => d.x)
                   .attr("cy", d => d.y)
                   .attr('r', (d) => nodeScale(d.degree))
                   .attr('fill', (d) => nodeColor(d.modularity)),
               update => update,
               exit => exit.transition().remove()
           )
           .call(d3.drag()
               .on("start", dragStarted)
               .on("drag", dragged)
               .on("end", dragEnded)
           );


       // Write labels.
       label = d3.select('.labels')
           .selectAll('text')
           .data(nodes)
           .join(
               enter => enter.append('text')
                       .attr('class', 'label')
                       .attr('pointer-events', 'none')
                   .text( d => {if (d.degree > 3.0) {return d.id} else {return ''}} )
                       .attr('font-size', d => fontSizeScale(d.degree)),
               update => update
                   .text( d => {if (d.degree > 3.0) {return d.id} else {return ''}} )
                       .attr('font-size', d => fontSizeScale(d.degree)),
               exit => exit.transition().remove()
           )
       
       // Reheat simulation.
       simulation.alphaDecay(0.01).restart();

   };

   // Move mouse over/out.
   node.on('mouseover', function(event, d, i) {

       // Focus
       let source = d3.select(event.target).datum().__proto__.id;

       node.style('opacity', function(o) {
           return neigh(source, o.__proto__.id) ? 1: 0.1;
       });

       link.style('opacity', function(o) {
           return o.__proto__.source.id == source || o.__proto__.target.id == source ? 1 : 0.2;
       });

       label
           .text( d => d.id)
           .attr('display', function(o) {
               return neigh(source, o.__proto__.id) ? "block" : "none";
           });

       // Gather tooltip info.
       let nodeInfo = [
           ['Degree', formatNumbers(d.degree, 2)],
           ['Community', formatNumbers(d.modularity, 2)],
           ['Betweenness', formatNumbers(d.betweenness, 3)],
           ['Eigenvector', formatNumbers(d.eigenvector, 3)],
       ];

       tooltip
           .transition(duration)
               .attr('pointer-events', 'none')
               .style('opacity', 0.97)
               .style("left", (pos.x) + "px")
               .style("top", (pos.y) + "px");
           
       toolHeader
           .html(d.id)
           .attr('pointer-events', 'none');

       toolBody
           .selectAll('p')
           .data(nodeInfo)
           .join('p')
               .html(d => `${d[0]}: ${d[1]}`)
               .attr('pointer-events', 'none');

       simulation.alphaTarget(0).restart();
   });

   node.on('mousemove', function(event) {
       tooltip
           .style("left", (pos.x) + "px")
           .style("top", (pos.y) + "px")
   })

   node.on('mouseout', function () {
       tooltip.transition(duration).style('opacity', 0);

       // Unfocus.
       label
           .text( d => {if (d.degree > 3.0) {return d.id} else {return ''}} )
           .attr('display', 'block');
       node.style('opacity', 1);
       link.style('opacity', 0.6);
   })

});