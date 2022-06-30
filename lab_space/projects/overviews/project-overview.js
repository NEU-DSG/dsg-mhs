'use strict'

// Preprocess Data.
function type(d) {
    var parseNA = string => (string === 'NA' ? undefined : string);
    
    // Change data type for count.
    return {
        project: parseNA(d.project),
        year: d3.timeParse('%Y')(d.year), // for d3.scaleTime
        // year: +d.year, // for d3.scaleBand
        Sum: +d.Sum,
    };
}

// Read-in data, call type(), then process and build graph.
Promise.all([
    d3.json('overviews/data/docCounts.json', type),
    d3.json('overviews/data/wordCount.json', type)
]).then( files => {

    let data = files[0];

    let range_of_years = d3.max(data, d => d.year) - d3.min(data, d => d.year);

    // Change data with dropdown 
    d3.select('select').on('change', chart);

    // Build margins & svg.
    let margin = {top: 10, right: 20, bottom: 30, left: 50},
        width = 960 - margin.right - margin.left,
        height = 600 - margin.top - margin.bottom,
        dur = 1000;

    let svg = d3.select('.bar-chart')
        .append('svg')
            .attr('height', height)
            .attr('width', width)
            .attr('transform', `translate( ${margin.left}, ${margin.top} )`);

    // Build Scales & Axes.
    let x = d3.scaleTime()
        .domain(d3.extent(data, d => d.year))
        .range([margin.left, width - margin.right]);

    let y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.Sum)])
        .nice()
        .range([height - margin.bottom, margin.top]);

    let xAxis = d3.axisBottom(x);
    let yAxis = d3.axisLeft(y);

    svg.append('g')
        .attr('class', 'xAxis')
        .attr('transform', `translate(0, ${height - margin.bottom})`)
        .call(xAxis);

    svg.append('g')
        .attr('class', 'yAxis')
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(yAxis);

    let color = d3.scaleOrdinal() // Map colors to project.
        .domain(['JQA', 'ESR', 'CMS', 'RBT'])
        .range(['#91f3b6', '#f36d73', '#f0dd94', '#4d9de0']); // I'm assuming order of ranges matches order of domain.

    // Stack data.
    // https://github.com/d3/d3-shape/blob/v1.3.7/README.md#stack
    let stack = d3.stack()
        .keys(['JQA', 'ESR', 'CMS', 'RBT'])
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    data = stack(data);
    
    // Build graph components.
    let bars = svg.append('g')
        .attr('class', 'bars')
        .selectAll('g')
        .data(data)
        .join('g')
            .style('fill', d => color(d.key));

    // Update chart function.
    function chart(data) {

        // Switch case for different data selections.
        switch (d3.select('select').property('value')) {
            case 'doc':
                console.log('on doc')
                data = files[0]
                break;
            case 'word':
                console.log('on word')
                data = files[1]
                break;
            default:
                data = files[0]
        };
        
        // Update scales & axes.
        y.domain([0, d3.max(data, d => d.Sum)]);

        svg.selectAll('.yAxis')
            .transition()
            .duration(dur)
            .call(yAxis);

        // Re-stack data after switch.
        data = stack(data);

        // Append bars.
        bars
            .selectAll('rect.bar')
            .data(d => d)
            .join(
                enter => {enter
                    .append('rect')
                    .attr('class', 'bar')
                    .attr('x', d => x(d.data.year))
                    .attr('y', d => y(d[1]))
                    .attr('height', d => y(d[0]) - y(d[1]))
                    .attr('width', (width / range_of_years) - 0.4)
                },
                update => {update
                    .append('rect')
                    .attr('class', 'bar')
                    .attr('x', d => x(d.data.year))
                    .attr('y', d => y(d[1]))
                    .attr('height', d => y(d[0]) - y(d[1]))
                    .attr('width', (width / range_of_years) - 0.4)
                },
                exit => {exit.remove()}
            );
    }

    chart(data);

})