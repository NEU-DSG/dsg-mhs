'use strict'

// Preprocess Data.
function type(d) {
    var parseNA = string => (string === 'NA' ? undefined : string);
    
    // Change data type for count.
    return {
        subject: parseNA(d.subjects),
        count: +d.count,
    };
}


// Read-in data, call type(), then process and build graph.
d3.csv('data/subject-year-count.csv', type).then(data => {

    // Dimensions and Constants
    let margin = {top: 20, right: 15, bottom: 25, left: 15},
        width = 960 - margin.right - margin.left,
        height = 600 - margin.top - margin.bottom,
        duration = 300,
        top_n = 10,
        padding = 15,
        barPadding = (height - (margin.bottom + margin.top)) / (top_n * 5);

    // Build SVG Container.
    let svg = d3.select('.bar-chart')
        .append('svg')
        .attr('height', height + margin.top + margin.bottom)
        .attr('width', width + margin.right + margin.left + padding)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    function preprocessData(data) {
        console.log(data);

        // Create new array from data, which sums counts by subjects.
        let subjMap = d3.rollup(data, 
            v => d3.sum(v, leaf => leaf.count),
            d => d.subject);

        let subjArray = Array.from(subjMap, d => ({
            subject: d[0],
            count: d[1]
        }));

        // Assign color to each subject.
        subjArray.forEach( d => {
            d.colour = d3.hsl(Math.random()*360,0.75,0.75);
        })

        // Sort by count and assign rank.
        subjArray
            .sort((a, b) => d3.descending(a.count, b.count))
            .forEach( (d, i) => d.rank = i);

        return subjArray;
    }

    let subjArray = preprocessData(data);

    // Build scales.
    let x = d3.scaleLinear()
        .domain([0, d3.max(subjArray, d => d.count)])
        .range([margin.left, width - margin.right]);

    let y = d3.scaleLinear()
        .domain([top_n, 0])
        .range([height + margin.bottom, margin.top + padding]);

    let xAxis = d3.axisTop()
        .scale(x)
        .ticks( width > 500 ? 5:2)
        .tickSize( -( height + margin.top + margin.bottom + padding))
        .tickFormat( d => d3.format(',') (d));

       // Append axis.
    svg.append('g')
       .attr('class', 'axis xAxis')
       .attr('transform', `translate(0, ${margin.top})`)
       .call(xAxis)
        .selectAll('.tick line')
        .classed('origin', d => d == 0)
        .attr("stroke-opacity", 0.1);

    let bars = svg.append('g').attr('class', 'bars');
    let labels = svg.append('g').attr('class', 'labels');
    let values = svg.append('g').attr('class', 'valueLabels');

    let quarterMax = d3.max(subjArray, d => d.count) / 4;

    function chart(subjArray) {
        // Append bars.
        bars
            .selectAll('.bar')
            .data(subjArray)
            .join(
                enter => {enter
                    .append('rect')
                    .attr('class', 'bar')
                    .attr('x', x(0) + 1)
                    .attr('width', d => x(d.count) - x(0) - 1) // values adjusted by hand here.
                    .attr('y', d => y(d.rank))
                    .attr('height', y(1) - y(0) - barPadding)
                },
                update => {update},
                exit => {exit.remove()}
            );
        
        // Append labels.
        labels
            .selectAll('text.label')
            .data(subjArray)
            .join(
                enter => {enter
                    .append('text')
                    .attr('x', function(d) { return (d.count > quarterMax ? x(d.count) - 8 : x(d.count) + 8 )}) // if count < 500, swap places with values.
                    .attr('y', d => y(d.rank) + 27)
                    .style('text-anchor', function(d) { return (d.count > quarterMax ? 'end' : 'start') })
                    .html(d => d.subject)
                    .style('fill', d => d.count > quarterMax ? '#353135' : '#FFFAF0')
                },
                update => {update},
                exit => {exit.remove()}
            );

        // Append value labels.
        values
            .selectAll('text.valueLabels')
            .data(subjArray)
            .join(
                enter => {enter
                    .append('text')
                    .attr('class', 'valueLabel')
                    .attr('x', d => d.count > quarterMax ? x(d.count) + 5 : x(d.count) - 35)
                    .attr('y', d => y(d.rank) + 27)
                    .text(d => d.count)
                    .style('fill', d => d.count > quarterMax ? '#fdeed8' : '#353135')
                },
                update => {update},
                exit => {exit.remove()}
            );
    }

    chart(subjArray);
})