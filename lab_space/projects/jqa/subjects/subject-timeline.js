'use strict'

// Preprocess Data.
function type(d) {
    var parseNA = string => (string === 'NA' ? undefined : string);
    
    // Change data type for count.
    return {
        subject: parseNA(d.subject),
        count: +d.count,
        year: new Date(d.year).getFullYear()
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
        count: d[1]
    }));

    // Build SVG Container.
    const svg = d3.select('.bar-timeline')
        .append('svg')
        .attr('height', height + margin.top + margin.bottom)
        .attr('width', width + margin.right + margin.left)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Build scales.
    let x = d3.scaleTime()
        .domain([d3.min(subjArray, d => d.year), d3.max(subjArray, d => d.year)])
        .range([margin.left, width - margin.right]);

    let y = d3.scaleLinear()
        .domain([0, d3.max(subjArray, d => d.count)]).nice()
        .range([height - margin.bottom, margin.top]);

    // Build & append axes.
    // xAxis.
    let xAxis = g => g
        .attr('transform', `translate(0,  ${height - margin.bottom})`)
        .call(
            d3.axisBottom(x)
                .tickFormat(d3.format("d"))
        );

    svg.append('g').call(xAxis).style('text-anchor', 'start');

    // yAxis.
    let yAxis = g => g
        .attr('transform', `translate(${margin.left}, 0)`)
        .call(
            d3.axisLeft(y)
                .ticks(4)
                .tickSize( -(width), 0, 0)
        )
        .call(g => g.select('.domain').remove())
        .call(g => g.append('text')
            .attr('x', -margin.left)
            .attr('y', 10)
            .attr('text-anchor', 'start')
        ) 

    svg.append('g').call(yAxis);

    // Build fixed graph.
    let fixedBars = svg.append('g').selectAll('rect.fixed').attr('class', 'fixed');

    fixedBars
        .data(subjArray, d => d.year)
        .join(
            enter => enter
                .append('rect')
                .attr('fill', '#696969')
                .attr('x', d => x(d.year)) // +25 for yAxis adjustment.
                .attr('y', d => y(d.count))
                .attr('height', d => y(0) - y(d.count))
                .attr('width', (width / subjArray.length) - 20),
            update => update,
            exit => exit.remove()
        );

    let fixedValues = svg.append('g').selectAll('text');

    fixedValues
        .data(subjArray, d => d.year)
        .join(
            enter => enter
                .append('text')
                .attr('fill', '#696969')
                .attr('x', d => x(d.year) + 25)
                .attr('y', d => y(d.count) - 5)
                .text(d => d.count)
                .attr('text-align', 'center')
            ,
            update => update,
            exit => exit.remove()
        );

    // Access dropdown menu value and write subject to page. 
    let selectValue = d3.select('select').property('value');

    let subset = data.filter(d => (d.subject === selectValue));

    let subjText = d3.select('#subjText')
        .attr('class', 'subjText')
        .text(selectValue);


    // Change highlighted bar sections on change.
    function onchange() {

        selectValue = d3.select('select').property('value');
        console.log(selectValue);

        subset = data.filter(d => (d.subject === selectValue));

        subjText.text(selectValue);

        // Build relative graph.
        let relativeBars = svg.selectAll('rect.relative');

        relativeBars
            .data(subset)
            .join(
                enter => enter
                    .append('rect')
                    .attr('class', 'relative')
                    .attr('fill', '#91f3b6')
                    .attr('x', d => x(d.year))
                    .attr('y', d => y(d.count))
                    .attr('height', d => y(0) - y(d.count))
                    .attr('width', (width / subjArray.length) - 20) // width of bar a fraction of length of dataset.
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', d => y(d.count)),

                update => update
                    .attr('x', d => x(d.year))
                    .attr('y', d => y(d.count))
                    .attr('height', d => y(0) - y(d.count))
                    .attr('width', (width / subjArray.length) - 20)
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', d => y(d.count)),

                exit => exit
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', d => y(0))
                    .remove()
            );

        let relativeValues = svg.selectAll('text.relativeLabel');

        relativeValues
            .data(subset)
            .join(
                enter => {enter
                    .append('text')
                    .attr('class', 'relativeLabel')
                    .attr('fill', '#91f3b6')
                    .attr('x', d => x(d.year) + 25)
                    .attr('y', d => y(d.count) - 5)
                    .text(d => d.count)
                },
                update => {update
                    .attr('x', d => x(d.year) + 25)
                    .attr('y', d => y(d.count) - 5)
                    .text(d => d.count)
                },
                exit => {exit.remove()}
            );
    }

});