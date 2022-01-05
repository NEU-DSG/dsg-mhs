// Dimensions & Constants
const margin = { top: 80, right: 40, bottom: 40, left: 200 },
    width = 960 - margin.right - margin.left, // window.innerWidth; +svg.node().getBoundingClientRect().width
    height = 800 - margin.top - margin.bottom, // window.innerHeight;
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

function changeCheck(cb) {
    if (cb.checked === true) {
        cb.checked = false
    } else {
        cb.checked = true
    }
};

let adjlist = [];

function neigh(a, b) {
    return a == b || adjlist.includes(a + '-' + b) || adjlist.includes(b + '-' + a);
}

d3.json("/MarsdenWork/Data/marsden-lemma-vectors-network-filtered90.json").then(data => {

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
        dropdown.appendChild(elem); // Write dropdown menu.
    };

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
        checkbox_elem.addEventListener('change', checkboxListener); // Add listeners to checkboxes and filter from set.
        checkbox.appendChild(checkbox_elem);

        let checkbox_label = document.createElement('label'); // build labels for input
        checkbox_label.setAttribute('for', checkbox_opt);
        checkbox_label.innerHTML = checkbox_opt;
        checkbox.appendChild(checkbox_label);
        
        let br = document.createElement('br'); // add break for spacing
        checkbox.appendChild(br);
    };

    // Use listener to filter out nodes before graphing.
    let source_filter = [uniqueTerms];
    let filtered_dataset = data;

    // checkboxListener creates array of checked items.
    function checkboxListener(e) {
        let nodeList = document.getElementsByName('check');
        
        for (let i = 0; i < nodeList.length; i++) {
            let source_id = nodeList[i].id;

            if (nodeList[i].value === 'checked' && !source_filter.includes(source_id)) {
                source_filter.push(source_id);
            } else if (nodeList[i].value === 'checked' && source_filter.includes(source_id)) {
                // do nothing
            } else {
                source_filter.splice(i, 1); // remove index where this.id appears.
            }
        }

        let filtered_nodes = data.nodes.filter( d => !source_filter.includes(d.source));
        let nodes_id = filtered_nodes.map(d => d.id);
        let filtered_links = data.links.filter( d => nodes_id.includes(d.source) && nodes_id.includes(d.target));
    
        // Build first-step for focus/unfocus: adjlist + neigh()
        filtered_links.forEach(function(d) {
            adjlist.push(d.source + '-' + d.target);
        });

        filtered_dataset = {
            'nodes': [...filtered_nodes],
            'links': [...filtered_links]
        };
    };

    // Build scales.
    const colorScale = d3.scaleOrdinal(d3.schemePaired);

    const nodeScale = d3
        .scaleLinear()
        .domain([0, d3.max(filtered_dataset.nodes.map(node => node.degree))])
        .range([15, 25]);

    const fontSizeScale = d3
        .scaleLinear()
        .domain([0, d3.max(filtered_dataset.nodes.map(node => node.degree))])
        .range([12, 20]);

    // Build simulation.
    const simulation = d3
        .forceSimulation(filtered_dataset.nodes)
        .force("charge", d3.forceManyBody()
            .strength(-100)
            .distanceMin(0)
            .distanceMax(2000)
            )
        .force("link", d3.forceLink(filtered_dataset.links)
            .id(d => d.id)
            .distance( 30 )
            .strength(1)
            )
        .force("center", d3.forceCenter( (width / 2), (height / 2) ))
        .force("collision", d3.forceCollide()
            .radius( d => nodeScale(d.degree)) 
            )
        .force("gravity", d3.forceManyBody()
            .strength(-1000)
            );

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

    // Initialize link, node, and label for drawing.

    const link = svg.selectAll("line");
    const node = svg.selectAll("circle");
    // let label = svg.selectAll('text');

    // function updateGraph() {

    link
        .data(filtered_dataset.links)
        .join(
            enter => enter.append("line")
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0.7),
            update => update
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0.7),
            exit => exit.remove()
        );

    node
        .data(filtered_dataset.nodes)
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
    // };

    // updateGraph();

    
    // Tick function.
    simulation.on("tick", () => {

        // label
        //     .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
    
        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    });
    
});