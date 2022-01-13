  // Dimensions & Constants
const margin = { top: 80, right: 40, bottom: 40, left: 200 },
    width = 960 - margin.right - margin.left,
    height = 800 - margin.top - margin.bottom,
    duration = 300;

// Build container.
const svg = d3.select('.network-container')
    .append('svg')
        .attr("height", height + margin.top + margin.bottom) // Contained.
        .attr("width", width + margin.right + margin.left)
    .call(d3.zoom().on("zoom", function (event) { // Add zooming.
        svg.attr("transform", event.transform)
        }))
    .append('g');

// Build elements.
const links = svg.append('g').attr('class', 'links');
const nodes = svg.append('g').attr('class', 'nodes');
const labels = svg.append('g').attr('class', 'labels');

// Build scales.
const colorScale = d3.scaleOrdinal(d3.schemePaired);
const nodeScale = d3.scaleLinear().range([25, 50]);
const fontSizeScale = d3.scaleLinear().range([12, 20]);

// Utilities
function formatNumbers (d) {
    return d3.format('.2r')(d);
};

let adjlist = [];

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

d3.json("/MarsdenWork/Data/marsden-lemma-vectors-network-filtered90.json").then(data => {

    // Instantiate variables for later use.
    let link, node, label;

    // Build force simulation.
    // Documentation: https://devdocs.io/d3~7/d3-force#forcesimulation
    const simulation = d3.forceSimulation()
        .force("charge", d3.forceManyBody()
            .strength(-500)
        )
        .force("center", d3.forceCenter(width/2, height/2))
        .force("gravity", d3.forceManyBody()
            .strength()
        )
        .force("collision", d3.forceCollide()
            .radius(d => d.r * 2)
        );

    simulation
        .nodes(data.nodes, d => d.id)
        .force("link", d3.forceLink(data.links)
            .id(d => d.id)
            .distance( height / data.nodes.length)
        ).on("tick", () => { // tick function.

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

    update(data);

    // Update function from: https://codepen.io/pen/?editors=0010 ;; https://www.d3indepth.com/force-layout/
    function update(dataset) {

        // Update scales' domains.
        nodeScale.domain([0, d3.max(dataset.nodes.map(node => node.degree))]);
        fontSizeScale.domain([0, d3.max(dataset.nodes.map(node => node.degree))]);

        link = d3.select('.links')
            .selectAll('line')
            .data(dataset.links, d => d.id) // `${d.source.id}\t${d.target.id}`
            .join(
                enter => enter.append("line").attr('class', 'link')
                    .attr("stroke", "#999")
                    .attr("stroke-opacity", 0.5)
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y),
                update => update
                    .attr("stroke", "#999")
                    .attr("stroke-opacity", 0.5)
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y),
                exit => exit.remove()
            );

        node = d3.select('.nodes')
            .selectAll("circle")
            .data(dataset.nodes, d => d.id)
            .join(
                enter => enter.append('circle').attr('class', 'node')
                    .attr('r', (d) => nodeScale(d.degree))
                    .attr('fill', (d) => colorScale(d.source))
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y),
                update => update
                    .attr('r', (d) => nodeScale(d.degree))
                    .attr('fill', (d) => colorScale(d.source))
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y),
                exit => exit.transition().remove()
            )
            .call(d3.drag()
                .on("start", dragStarted)
                .on("drag", dragged)
                .on("end", dragEnded)
            );

        label = d3.select('.labels') // .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
            .selectAll('text')
            .data(dataset.nodes, d => d.id)
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

        // Reheat simulation.
        simulation.alpha(0.5).alphaTarget(0.3).restart();
    };
});



    // // Populate dropdown menu (propertySelector).
    // let propKeys = Object.keys(data.nodes[0]); // select first node and get keys.
    // let items2remove = ['degree', 'betweenness', 'eigenvector', 'degree_cent', 'target', 'id', 'meta_mjp_id', 'meta_date'];
    // propKeys = propKeys.filter(d => !items2remove.includes(d)); // remove selected items from array
    
    // let dropdown = document.getElementById('propertySelector');
    // for (let i = 0; i < propKeys.length; i++) {
    //     let opt = propKeys[i];
    //     let elem = document.createElement('option');
    //     elem.textContent = opt;
    //     elem.value = opt;

    //     elem.addEventListener('click', dropdownListener);

    //     dropdown.appendChild(elem); // Write dropdown menu.
    // };

    // // Determine whicb value will distinguish nodes with color.
    // let node_color;
    // function dropdownListener(e) {
    //     node_color = this.value;
    // };

    // // Gather unique keywords & populate checkbox widget.
    // let uniqueTerms = [...new Set(data.nodes.map(item => item.source))];
    // let checkbox = document.getElementById('checkbox');
    // for (let i = 0; i < uniqueTerms.length; i++){
    //     let checkbox_opt = uniqueTerms[i];

    //     let checkbox_elem = document.createElement('input'); // build input (radio) element.
    //     checkbox_elem.setAttribute('type', 'checkbox');
    //     checkbox_elem.setAttribute('name', 'check');
    //     checkbox_elem.setAttribute('id', checkbox_opt);
    //     checkbox_elem.setAttribute('checked', true);
    //     checkbox_elem.setAttribute('value', 'checked');
    //     checkbox_elem.addEventListener('change', () => { // change value when un/checked.
    //         if (checkbox_elem.value === 'checked') {
    //             checkbox_elem.value = 'unchecked';
    //         } else {
    //             checkbox_elem.value = 'checked';
    //         }
    //     })
    //     checkbox_elem.addEventListener('change', checkboxListener); // Add listeners to checkboxes and filter from set.
    //     checkbox.appendChild(checkbox_elem);

    //     let checkbox_label = document.createElement('label'); // build labels for input
    //     checkbox_label.setAttribute('for', checkbox_opt);
    //     checkbox_label.innerHTML = checkbox_opt;
    //     checkbox.appendChild(checkbox_label);
        
    //     let br = document.createElement('br'); // add break for spacing
    //     checkbox.appendChild(br);
    // };

    // // Use listener to filter out nodes before graphing.
    // let source_filter = [uniqueTerms],
    //     filtered_data;

    // // checkboxListener creates array of checked items.
    // function checkboxListener(e) {
    //     let nodeList = document.getElementsByName('check');
        
    //     for (let i = 0; i < nodeList.length; i++) {
    //         let source_id = nodeList[i].id;

    //         if (nodeList[i].value === 'checked' && !source_filter.includes(source_id)) {
    //             source_filter.push(source_id);
    //         } else if (nodeList[i].value === 'checked' && source_filter.includes(source_id)) {
    //             // do nothing
    //         } else {
    //             source_filter.splice(i, 1); // remove index where this.id appears.
    //         }
    //     }

    //     let filtered_nodes = data.nodes.filter( d => source_filter.includes(d.source));
    //     let nodes_id = filtered_nodes.map(d => d.id);
    //     let filtered_links = data.links.filter( d => nodes_id.includes(d.source) && nodes_id.includes(d.target));
    
    //     // Build first-step for focus/unfocus: adjlist + neigh()
    //     filtered_links.forEach(function(d) {
    //         adjlist.push(d.source + '-' + d.target);
    //     });

    //     filtered_dataset = {
    //         'nodes': [...filtered_nodes],
    //         'links': [...filtered_links]
    //     };

    //     return filtered_dataset;
    // };

    // filtered_data = checkboxListener();
    // console.log(filtered_data);