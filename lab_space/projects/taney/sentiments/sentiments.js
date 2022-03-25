'use strict'

// Preprocess Data.
function type(d, i) {
    // var parseNA = string => (string === 'NA' ? undefined : string);
    
    // Change data type for count.
    return {
        date: new Date(d.date),
        year: new Date(d.date).getFullYear(),
        day: new Date(d.date).getDay(),
        sentiment: +d.sentiment,
        id: +i,
    };
}

d3.csv('data/taney_sentiments.csv', type).then( data => {
    data = data.filter(d => d.year !== 0); // temporary fix to prevent bad date formats.

    // Set date range controls.
    let [startDate, endDate] = d3.extent(data, d => d.date);

    document.getElementById('start').setAttribute('min', startDate);
    document.getElementById('start').setAttribute('max', endDate);
    document.getElementById('start').valueAsDate = startDate;
    document.getElementById('end').setAttribute('min', startDate);
    document.getElementById('end').setAttribute('max', endDate);
    document.getElementById('end').valueAsDate = endDate;

    // Set dimensions and margins.
    let margin = {top: 20, right: 30, bottom: 60, left: 40},
        width = 640,
        height = 600,
        padding = 5,
        dur = 1000;

    // Build SVG.
    let svg = d3.select('.lollipop-chart')
        .append('svg')
            .attr('height', height)
            .attr('width', width)
            .attr('background-color', '#110b11');

    // Build scale.
    let x = d3.scaleTime()
        .domain([startDate, endDate])
        .range([margin.left + padding, width - margin.right]);

    // Append axis.
    let xAxis = d3.axisBottom(x)

    svg.append('g')
        .call( xAxis )
        .attr('transform', `translate(0, ${height - margin.bottom})`)
        .attr('class', 'xAxis');

    let y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.sentiment))
        .range([height - margin.bottom - margin.top, margin.top]);
    
    svg.append('g')
        .call(
            d3.axisLeft(y)
        )
        .attr('transform', `translate(${margin.left - padding}, 0)`)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", width - margin.left - margin.right)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", -margin.left)
            .attr('y', 10));

    // Create container for tooltip.
    let tooltip = d3.select('.lollipop-chart')
        .append('div')
            .attr('class', 'tooltip')
            .style('background-color', '#242124')
            .style('opacity', 0)
            .style('position', 'fixed')
            .attr('pointer-events', 'none');
    
    let toolHeader = tooltip
        .append('h3')
        .attr('class', 'tipHeader');

    let toolBody = tooltip
        .append('div')
        .attr('class', 'toolBody');

    // Create subset by date.
    let subset = data.filter( d => (startDate <= d.date && d.date <= endDate) );
    
    // Add listener.
    d3.select('#start').on('change', update);
    d3.select('#end').on('change', update);

    // Add bars & circles.
    let bars = svg.append('g')
        .attr('class', 'line');

    let circles = svg.append('g')
        .attr('class', 'circle');
    
    // Update function.
    function update() {

        startDate = document.getElementById('start').valueAsDate;
        endDate = document.getElementById('end').valueAsDate;
        
        // Filter by date.
        subset.filter(d => startDate <= d.date && d.date <= endDate);

        // Change x-axis.
        x.domain([startDate, endDate]);

        svg.selectAll('.xAxis')
            .transition()
            .duration(dur)
            .selectAll('text')
                .attr('transform', `translate(-10,0)rotate(-45)`)
                .style('text-anchor', 'end');

        // Build lollipops.
        bars
            .selectAll('line.bar')
            .data(subset)
            .join(
                enter => enter.append('line')
                    .attr('class', 'bar')
                    .attr('x1', d => x(d.date))
                    .attr('x2', d => x(d.date))
                    .attr('y1', d => y(d.sentiment))
                    .attr('y2', y(0))
                    .attr('stroke', d => {if (d.sentiment < 0) {return '#dfb4e4'} else {return '#91f3b6'}})
                    .attr('stroke-width', (width - margin.right) / (subset.length * 12)) // stroke width gets larger when date range is smaller.
                    .style('opacity', 0.4)
                    .transition()
                        .duration(dur)
                        .ease(d3.easeLinear)
                ,
                update => update
                    .transition()
                        .duration(dur)
                        .ease(d3.easeLinear)
                        .attr('x1', d => x(d.date))
                        .attr('x2', d => x(d.date))
                        .attr('y1', d => y(d.sentiment))
                        .attr('y2', y(0))
                        .attr('stroke', d => {if (d.sentiment < 0) {return '#dfb4e4'} else {return '#91f3b6'}})
                        .attr('stroke-width', (width - margin.right) / (subset.length * 12))
                        .style('opacity', 0.4)
                ,
                exit => exit
                    .transition()
                        .duration(dur)
                        .ease(d3.easeLinear)
                    .remove()
            );

        circles
            .selectAll('circle')
            .data(subset)
            .join(
                enter => enter.append('circle')
                    .attr('class', 'pop')
                    .attr('cx', d => x(d.date))
                    .attr('cy', d => y(d.sentiment))
                    .attr('r', (width - margin.right) / (subset.length * 4))
                    .attr('fill', d => {if (d.sentiment < 0) {return '#dfb4e4'} else {return '#91f3b6'}})
                    .transition()
                        .duration(dur)
                        .ease(d3.easeLinear)
                ,
                update => update
                    .transition()
                    .duration(dur)
                    .ease(d3.easeLinear)
                        .attr('cx', d => x(d.date))
                        .attr('cy', d => y(d.sentiment))
                        .attr('r', (width - margin.right) / (subset.length * 4))
                        .attr('fill', d => {if (d.sentiment < 0) {return '#dfb4e4'} else {return '#91f3b6'}})
                ,
                exit => exit
                    .transition()
                    .duration(dur)
                    .remove()
            );
    };

    update(data);

    // Mouse moves.
    circles.on('mouseover', function(event) { 

        let source = event.target.__data__;

        circles
            .selectAll('.pop')
            .attr('r', (d) => {
                if (d.id === source.id) 
                {return ((width - margin.right) / (subset.length * 2))} else 
                {((width - margin.right) / (subset.length * 10))}
            })
            .style('opacity', (d) => {if (d.id === source.id) {return 1} else {return 0.1}});

        bars
            .selectAll('.bar')
            .attr('stroke-width', (d) => {
                if (d.id === source.id) { return (width - margin.right) / (subset.length * 12) } 
                else { return (width - margin.right) / (subset.length * 12)}});

        
        let toolInfo = [
            ['Date', source.date],
            ['Sentiment Score', source.sentiment]
        ]
        
        tooltip
            .transition(dur)
                .style('opacity', 0.97);

        toolHeader
            .html(source.id)
            .style('color', (d) => {
                if (source.sentiment < 0) {return '#dfb4e4'} 
                else {return '#91f3b6'}});

        toolBody
            .selectAll('p')
            .data(toolInfo)
            .join('p')
                .html(d => `${d[0]}: ${d[1]}`)
                .style('color', (d) => {
                    if (source.sentiment < 0) {return '#dfb4e4'}
                     else {return '#91f3b6'}});
    });

    circles.on('mousemove', (event) => {
        tooltip
            .style("left", (event.x) + "px")
            .style("top", (event.y) + "px")
    })

    circles.on('mouseout', () => {
        circles
            .selectAll('.pop')
            .attr('r', (width - margin.right) / (subset.length * 4))
            .style('opacity', 1);

        bars
            .selectAll('.bar')
            .attr('stroke-width', (width - margin.right) / (subset.length * 12));

        tooltip
            .style('opacity', 0);
    });

});
