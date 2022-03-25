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
const linkOpacity = d3.scaleLinear().range([0.4, 1]);
const linkSize = d3.scaleLinear().range([0.5, 3])

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
    // 
    // Build filtering widgets.
    // 

    console.log('building widgets...');
    // Gather unique keywords & populate checkbox widget.
    let uniqueTerms = [...new Set(data.nodes.map(item => item.source))];
    let checkbox = document.getElementById('checkbox');
    for (let i = 0; i < uniqueTerms.length; i++){
        let checkbox_opt = uniqueTerms[i];
  
        let checkbox_elem = document.createElement('input'); // build input (radio) element.
        checkbox_elem.setAttribute('type', 'checkbox');
        checkbox_elem.setAttribute('name', 'check');
        checkbox_elem.setAttribute('id', checkbox_opt);
        checkbox_elem.setAttribute('checked', true);
        checkbox_elem.setAttribute('value', 'checked');
        checkbox_elem.addEventListener('change', () => { // change value when un/checked.
            if (checkbox_elem.value === 'checked') {
                checkbox_elem.value = 'unchecked';
            } else {
                checkbox_elem.value = 'checked';
            }
        })
        checkbox_elem.addEventListener('change', filterListener); // Add listeners to checkboxes and filter from set.
        checkbox.appendChild(checkbox_elem);
  
        let checkbox_label = document.createElement('label'); // build labels for input
        checkbox_label.setAttribute('for', checkbox_opt);
        checkbox_label.innerHTML = checkbox_opt;
        checkbox.appendChild(checkbox_label);
        
        let br = document.createElement('br'); // add break for spacing
        checkbox.appendChild(br);
    };

    // Populate dropdown menu (propertySelector).
    let propKeys = Object.keys(data.nodes[0]); // select first node and get keys.
    let items2remove = ['degree', 'betweenness', 'eigenvector', 'degree_cent', 'target', 'id', 'meta_mjp_id', 'meta_date'];
    propKeys = propKeys.filter(d => !items2remove.includes(d)); // remove selected items from array
    
    let dropdown = document.getElementById('propertySelector');
    for (let i = 0; i < propKeys.length; i++) {
        let opt = propKeys[i];
        let elem = document.createElement('option');
        elem.textContent = opt;
        elem.value = opt;
  
        elem.addEventListener('click', dropdownListener);
  
        dropdown.appendChild(elem); // Write dropdown menu.
    };

    // Set dropdown menu to index of source
    dropdown.selectedIndex = 3;
  
    // Determine whicb value will distinguish nodes with color.
    let set_node_color;
    function dropdownListener(e) {
        set_node_color = this.value;

        d3.selectAll('circle.node')
            .attr('fill', d => colorScale(d[set_node_color]));
    };

    // Build slider filters.
    sliderKeys = Object.keys(data.nodes[0]).filter(d => ['degree', 'betweenness', 'eigenvector', 'degree_cent'].includes(d));

    sliderKeys.forEach( function(d) {
        let l = document.createElement('label');
        let lt = document.createTextNode(d);
        l.appendChild(lt); // append text to label

        let s = document.createElement('input');
        s.type = 'range';
        s.min = d3.min(data.nodes.map(node => node[d]));
        s.max = d3.max(data.nodes.map(node => node[d]));
        s.step = (d3.max(data.nodes.map(node => node[d])) / 10);
        s.value = s.min;
        s.id = d;
        s.name = 'slider';
        s.addEventListener('change', filterListener); // add filter/update listener.

        document.getElementById('sliders').appendChild(l).appendChild(s);
    });
  
    // filterListener creates array of checked items.
    function filterListener(e) {

        // Use listener to filter out nodes before graphing.
        let checklist_filter = [uniqueTerms];
        let checkList = document.getElementsByName('check');
        for (let i = 0; i < checkList.length; i++) {
            let source_id = checkList[i].id;
  
            if (checkList[i].value === 'checked' && !checklist_filter.includes(source_id)) {
                checklist_filter.push(source_id);
            } else if (checkList[i].value === 'checked' && checklist_filter.includes(source_id)) {
                // do nothing
            } else {
                checklist_filter.splice(checklist_filter.indexOf(source_id), 1); // remove index where this.id appears.
            }
        };

        // Further filter with sliders.
        let slider_filter = {};
        let sliderList = document.getElementsByName('slider');
        for (let i = 0; i < sliderList.length; i++) {
            slider_filter[sliderList[i].id] = sliderList[i].value;
        };

        // Build filtered dataset 
        let filtered_nodes = data.nodes.filter( d =>
            checklist_filter.includes(d.source) &&
            d.degree >= slider_filter.degree &&
            d.betweenness >= slider_filter.betweenness &&
            d.eigenvector >= slider_filter.eigenvector &&
            d.degree_cent >= slider_filter.degree_cent
        );
        
        // Use filtered nodes to determine subset of links.
        let nodes_id = filtered_nodes.map(d => d.id);

        // Filter links with both source & target present in subset.
        let filtered_links = data.links.filter( d => 
            nodes_id.includes(d.source.id) && 
            nodes_id.includes(d.target.id)
        );

        // Build first-step for focus/unfocus: adjlist + neigh()
        filtered_links.forEach(function(d) {
            adjlist.push(d.source + '-' + d.target);
        });
  
        filtered_dataset = {
            'nodes': [...filtered_nodes],
            'links': [...filtered_links]
        };
  
        update(filtered_dataset); // update network with filtered data.
    };


    // 
    // Build simulation and update function.
    // 
    
    // Instantiate variables for later use.
    let link, node, label;

    // Build force simulation.
    // Documentation: https://devdocs.io/d3~7/d3-force#forcesimulation
    console.log('building simulation...');
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

    // Add nodes, links, & labels to simulation and tell them to move in unison with each tick.
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

    // Update function reads-in data and organizes nodes, links, & labels.
    update(data);

    // Update function from: https://codepen.io/pen/?editors=0010 ;; https://www.d3indepth.com/force-layout/
    function update(dataset) {

        // Base node colors on dropdown menu's selected option.
        let node_color = document.getElementById('propertySelector')
            .options[document.getElementById("propertySelector").selectedIndex]
            .value;
        console.log(node_color);

        // Update scales' domains.
        nodeScale.domain([0, d3.max(dataset.nodes.map(node => node.degree))]);
        fontSizeScale.domain([0, d3.max(dataset.nodes.map(node => node.degree))]);
        linkOpacity.domain([
            d3.min(dataset.links.map(link => link.weight)),
            d3.max(dataset.links.map(link => link.weight))
        ]);

        // The following order determines which objects are drawn first (beneath the rest).
        link = d3.select('.links')
            .selectAll('line')
            .data(dataset.links, d => d.id)
            .join(
                enter => enter.append("line").attr('class', 'link')
                    .attr("stroke", "#999")
                    .attr("stroke-opacity", d => linkOpacity(d.weight)) // 0.5
                    .attr('stroke-width', d => linkSize(d.weight))
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y),
                update => update
                    .attr("stroke", "#999")
                    .attr("stroke-opacity", d => linkOpacity(d.weight))
                    .attr('stroke-width', d => linkSize(d.weight))
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y),
                exit => exit.transition().remove()
            );

        node = d3.select('.nodes')
            .selectAll("circle")
            .data(dataset.nodes, d => d.id)
            .join(
                enter => enter.append('circle').attr('class', 'node')
                    .attr('r', (d) => nodeScale(d.degree))
                    .attr('fill', (d) => colorScale(d[node_color]))
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y),
                update => update
                    .attr('r', (d) => nodeScale(d.degree))
                    .attr('fill', (d) => colorScale(d[node_color]))
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
        simulation.alphaDecay(0.01).restart(); // set higher (0-1) to stabilize network more quickly.
        //     .nodes(dataset.nodes, d => d.id) // this section will re-arrange nodes after updating.
        //     .force("link", d3.forceLink(dataset.links)
        //         .id(d => d.id)
        //         .distance( height / dataset.nodes.length)
        //     ).on("tick", () => { // tick function.

        //         label
        //             .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

        //         link
        //             .attr("x1", d => d.source.x)
        //             .attr("y1", d => d.source.y)
        //             .attr("x2", d => d.target.x)
        //             .attr("y2", d => d.target.y);
            
        //         node
        //             .attr("cx", d => d.x)
        //             .attr("cy", d => d.y);
        //     }
        // );
    };
});
