'use strict'

// Preprocess Data.
function type(d) {
    var parseNA = string => (string === 'NA' ? undefined : string);
    
    // Change data type for count.
    return {
        subject: parseNA(d.subjects),
        count: +d.count,
        year: new Date(d.year)
    };
}

d3.csv('data/subject-year-count.csv', type).then(data => {

    // Dimensions and Constants
    const margin = {top: 30, right: 30, bottom: 30, left: 40},
        width = 960 - margin.right - margin.left,
        height = 600 - margin.top - margin.bottom,
        padding = 15,
        duration = 100;

    const subjects = [...new Set(data.map( d => d.subject ))].sort();

    // Selection options.
    let select = d3.select('#subject-selection')
        .append('select')
        .attr('class', 'select')
        .on('change', onchange)

    let options = select
        .selectAll('option')
        .data(subjects)
        .enter()
        .append('option')
            .text( function(d) { return d; } );

    // Create map with rollup to sum counts by subject for total.
    let subjMap = d3.rollup(data,
        v => d3.sum(v, leaf => leaf.count),
        d => d.year);
    
    // Convert to map to array for accessing.
    let subjArray = Array.from(subjMap, d => ({
        year: d[0],
        total: d[1]
    }));

    // New data includes normalized counts per year.
    let newData = data.map((item, i) => Object.assign({}, item, subjArray[i]));
    
    newData.forEach( function(obj) {
        // let perc = Math.round(+obj.count / obj.total);

        let perc = Number.parseFloat(+obj.count / obj.total).toFixed(2) * 100;

        obj['percentage'] = perc = +perc || 0;
    });

    // Build scales.
    let x = d3.scaleTime()
        .domain(d3.extent(newData, d => d.year))
        .range([margin.left, width - margin.right - padding]);

    let y = d3.scaleLinear()
        .domain(d3.extent(newData, d => d.percentage))
        .nice()
        .range([height - margin.bottom, margin.top]);

    let xAxis = d3.axisBottom(x);
    let yAxis = d3.axisLeft(y);

    // Build svg.
    const svg = d3.select('.bar-timeline')
        .append('svg')
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height])
            .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

    svg
        .append("g")
            .attr("transform", `translate(${margin.left}, 0)`)
            .call(yAxis)
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".tick line").clone()
                .attr("x2", width - margin.left - margin.right)
                .attr("stroke-opacity", 0.1))
        .append("g")
            .attr("transform", `translate(0, ${height - margin.bottom})`)
            .call(xAxis);

    // Access dropdown menu value and write chosen subject to page. 
    let selectValue = d3.select('select').property('value');

    let subset = newData.filter(d => (d.subject === selectValue));

    let subjText = d3.select('#subjText')
        .attr('class', 'subjText')
        .text(selectValue);

    let bars = svg.append('g').attr('class', 'bars');
    let labels = svg.append('g').attr('class', 'labels');

    // Build initial graph with page load.
    onchange(subset);

    // Change highlighted bar sections on change.
    function onchange() {

        selectValue = d3.select('select').property('value');
        subset = newData.filter(d => (d.subject === selectValue));
        subjText.text(selectValue);

        console.log('subset', subset);

        // Build graph.
        bars
            .selectAll('g.bars')
            .data(subset)
            .join(
                enter => enter
                    .append('rect')
                    .attr('class', 'bar')
                    .attr('fill', '#91f3b6')
                    .attr('x', d => x(d.year))
                    .attr('y', d => y(d.percentage))
                    .attr('height', d => y(0) - y(d.percentage))
                    .attr('width', (width / newData.length) - 20) // (width / newData.length) width of bar a fraction of length of dataset.
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', d => y(d.percentage)),

                update => update
                    .attr('x', d => x(d.year))
                    .attr('y', d => y(d.percentage))
                    .attr('height', d => y(0) - y(d.percentage))
                    .attr('width', (width / newData.length) - 20)
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', d => y(d.percentage)),

                exit => exit
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', d => y(0))
                    .remove()
            );

        labels
            .selectAll('g.labels')
            .data(subset)
            .join(
                enter => {enter
                    .append('text')
                    .attr('class', 'label')
                    .attr('fill', '#91f3b6')
                    .attr('x', d => x(d.year))
                    .attr('y', d => y(d.percentage))
                    .text(d => d.percentage)
                },
                update => {update
                    .attr('x', d => x(d.year))
                    .attr('y', d => y(d.percentage))
                    .text(d => d.percentage)
                },
                exit => {exit.remove()}
            );
    };
});