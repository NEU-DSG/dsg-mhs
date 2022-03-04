'use strict'

// Preprocess Data.
function type(d) {
    var parseNA = string => (string === 'NA' ? undefined : string);
    
    // Change data type for count.
    return {
        subjects: parseNA(d.subjects),
        count: +d.count,
        total: +d.total,
        percentage: +d.percentage,
        year: new Date(d.year).getFullYear()
    };
}

d3.csv('data/subject-year-count.csv', type).then(data => {

    // Dimensions and Constants
    let margin = {top: 30, right: 30, bottom: 50, left: 30},
        width = 960,
        height = 500,
        duration = 100;

    const subjects = [...new Set(data.map( d => d.subjects ))].sort();

    // Selection options.
    let select = d3.select('#subject-selection')
        .append('select')
        .attr('class', 'select')
        .on('change', update)

    select
        .selectAll('option')
        .data(subjects)
        .enter()
        .append('option')
            .text( function(d) { return d; } );

    // Build SVG Container.
    const svg = d3.select('.bar-timeline')
        .append('svg')
            .attr('class', 'subject-timeline')
            .attr('height', height)
            .attr('width', width)
        .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Build tooltip.
    const tooltip = d3.select(".bar-timeline")
        .append('div')
            .attr('class', 'tooltip')
            .style('background-color', '#242124')
            .style('opacity', 0)
            .style('position', 'fixed')
            .attr('pointer-events', 'none');

    const toolHeader = tooltip
        .append('h3')
            .attr("class", "tipHeader");

    const toolBody = tooltip
        .append('div')
            .attr('class', 'tipBody');

    // Build scales & axes.
    let x = d3.scaleTime()
        .domain(d3.extent(data, d => d.year))
        .nice()
        .range([margin.left, width - margin.left - margin.right]);

    svg.append('g')
        .attr('transform', `translate(0, ${height - margin.bottom - margin.top})`)
        .call( 
            d3.axisBottom(x).tickFormat(d3.format("d"))
        );

    let y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.total)])
        .nice()
        .range([height - margin.top - margin.bottom, 0]);

    svg.append('g')
        .call(
            d3.axisLeft(y).ticks(7).tickSize( -(width), 0, 0)
        )
        .attr("stroke-opacity", 0.3);

    // Get range of years to set x-axis scales properly.
    let range_of_years = d3.extent(data, d => d.year)[1] - d3.extent(data, d => d.year)[0]

    // Build fixed graph.
    let fixedBars = svg.append('g').attr('class', 'fixedBars');

    fixedBars
        .selectAll('rect')
        .data(data, d => d.year)
        .join(
            enter => enter
                .append('rect')
                .attr('fill', '#696969')
                .attr('x', d => x(d.year)) 
                .attr('y', d => y(d.total))
                .attr('height', d => y(0) - y(d.total))
                .attr('width', (width) / (range_of_years + 0.5) ), // half of padding because there are many years.
            update => update,
            exit => exit.remove()
        );

    // Access dropdown menu value and write chosen subject to page. 
    let selectValue = d3.select('select').property('value');
    let subset = data.filter(d => (d.subjects === selectValue));
    let subjText = d3.select('#subjText')
        .attr('class', 'subjText')
        .text(selectValue);

    let relativeBars = svg.append('g')
            .attr('class', 'relBars');

    // Build initial graph with page load.
    update();

    // Change highlighted bar sections on change.
    function update(subset) {

        selectValue = d3.select('select').property('value');
        subset = data.filter(d => (d.subjects === selectValue));
        subjText.text(selectValue);

        // Build relative graph.
        relativeBars
            .selectAll('relBars')
            .data(subset)
            .join(
                enter => enter
                    .append('rect')
                    .attr('class', 'relBars')
                    .attr('fill', '#91f3b6')
                    .attr('x', d => x(d.year))
                    .attr('y', d => y(d.count))
                    .attr('height', d => y(0) - y(d.count))
                    .attr('width', (width - margin.left - margin.right) / (range_of_years + 1) )
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', d => y(d.count)),

                update => update
                    .attr('x', d => x(d.year))
                    .attr('y', d => y(d.count))
                    .attr('height', d => y(0) - y(d.count))
                    .attr('width', (width - margin.left - margin.right) / (range_of_years + 1) )
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', d => y(d.count)),

                exit => exit
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', y(0))
                    .remove()
            );
    };

    // Include hover over for info.
    fixedBars
        .on('mouseover', function(event, d, i) {
            let hover_year = event.target.__data__.year;

            let source = data.filter(d => d.year === hover_year && d.subjects === selectValue)[0];

            let source_info;

            if (source == undefined) {
                source_info = [
                    ['Count', 0 ],
                    ['Total', 0 ],
                    ['Percentage of Total', 0 ]
                ] 
            } else {
                source_info = [
                    ['Count', source.count ],
                    ['Total', source.total ],
                    ['Percentage of Total', source.percentage ]
                ];
            }
            
            tooltip
                .transition(duration)
                    .style('opacity', 0.97)
                    .style("left", (event.x + 10) + "px")
                    .style("top", (event.y - 15) + "px");
                    
            toolHeader
                .html(selectValue);

            toolBody
                .selectAll('p')
                .data(source_info)
                .join('p')
                    .html(d => `${d[0]}: ${d[1]}`);
        })
        .on('mousemove', function(event) {
            tooltip
                .style("left", (event.x + 10) + "px")
                .style("top", (event.y - 15) + "px");
        })
        .on('mouseout', function () {
            tooltip.transition(duration).style('opacity', 0);
        })

});