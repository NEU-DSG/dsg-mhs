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

d3.csv('data/richards_sentiments.csv', type).then( data => {
    data = data.filter(d => d.year !== 0); // temporary fix to prevent bad date formats.

    // Set date range controls.
    let [startDate, endDate] = d3.extent(data, d => d.date);
    console.log(startDate, endDate);

    document.getElementById('start').setAttribute('min', startDate);
    document.getElementById('start').setAttribute('max', endDate);
    document.getElementById('start').valueAsDate = startDate;
    document.getElementById('end').setAttribute('min', startDate);
    document.getElementById('end').setAttribute('max', endDate);
    document.getElementById('end').valueAsDate = endDate;

    // Set dimensions and margins.
    let margin = {top: 5, right: 10, bottom: 30, left: 30},
        width = 700 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom,
        padding = 15,
        dur = 2000;

    // Build SVG.
    let svg = d3.select('.lollipop-chart')
        .append('svg')
        .attr('height', height + margin.top + margin.bottom + padding)
        .attr('width', width + margin.right + margin.left + padding)
        .append('g')
        .attr('transform', `translate(${margin.left + padding}, ${margin.top})`)
        .style('background-color', '#110b11');

    // Build scale.
    let x = d3.scaleTime()
        .domain([startDate, endDate])
        .range([margin.left, width - margin.right - padding]);

    // Append axis.
    let xAxis = d3.axisBottom(x)

    svg.append('g')
        .attr('class', 'xAxis');

    let y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.sentiment))
        .range([height - margin.bottom, margin.top]);
    
    svg.append('g')
        .call(
            d3.axisLeft(y).ticks(5)
        );

    // Create container for tooltip.
    let tooltip = d3
        .select('.lollipop-chart')
        .append('div')
        .style('opacity', 0);
    
    let toolHeader = tooltip
        .append('h3')
        .attr('class', 'tipHeader');

    let toolBody = tooltip
        .append('div')
        .attr('class', 'toolBody');

    // Create subset by date.
    let subset = data.filter( d => (startDate <= d.date && d.date <= endDate) );

    
    // Add listener.
    let startListener = d3.select('#start');
    startListener.on('change', update);

    let endListener = d3.select('#end');
    endListener.on('change', update);

    // Add bars & circles.
    let bars = svg.append('g').attr('class', 'line');
    let circles = svg.append('g').attr('class', 'circle');
    
    // Update function.
    function update(data) {

        circles.exit().remove();

        let newStart = document.getElementById('start').valueAsDate;
        let newEnd = document.getElementById('end').valueAsDate;
        
        // Filter by date.
        let newSubset = subset.filter(d => newStart <= d.date && d.date <= newEnd);

        // Change x-axis.
        x.domain([newStart, newEnd]);
        // y.domain([d3.min(newSubset, d => d.sentiment), d3.max(newSubset, d => d.sentiment)])

        svg.selectAll('.xAxis')
            .transition()
            .duration(dur)
            .call(xAxis)
            .attr('transform', `translate(0, ${height})`) 
            .selectAll('text')
            .attr('transform', `translate(-10,0)rotate(-45)`)
            .style('text-anchor', 'end');

        // Build lollipops.
        bars
            .selectAll('line.bar')
            .data(newSubset)
            .join(
                enter => enter.append('line')
                    .attr('class', 'bar')
                    .attr('x1', d => x(d.date))
                    .attr('x2', d => x(d.date))
                    .attr('y1', d => y(d.sentiment))
                    .attr('y2', y(0))
                    .attr('stroke', d => {if (d.sentiment < 0) {return '#dfb4e4'} else {return '#91f3b6'}})
                    .attr('stroke-width', (width - margin.right) / newSubset.length - 3) // stroke width gets larger when date range is smaller.
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
                        .attr('stroke-width', (width - margin.right) / newSubset.length - 3)
                        .style('opacity', 0.4)
                ,
                exit => exit
                    .transition()
                        .duration(dur)
                        .ease(d3.easeLinear)
                        .attr('x1', d => x(d.date))
                        .attr('x2', d => x(d.date))
                        .attr('y1', d => y(0))
                        .attr('y2', y(0))
                    .remove()
            );

        circles
            .selectAll('circle')
            .data(newSubset)
            .join(
                enter => enter.append('circle')
                    .attr('class', 'pop')
                    .attr('cx', d => x(d.date))
                    .attr('cy', d => y(d.sentiment))
                    .attr('r', (width - margin.right) / newSubset.length - 2)
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
                        .attr('r', (width - margin.right) / newSubset.length - 2)
                        .attr('fill', d => {if (d.sentiment < 0) {return '#dfb4e4'} else {return '#91f3b6'}})
                ,
                exit => exit
                    .transition()
                    .attr('cx', d => x(d.date))
                    .attr('cy', 0)
                    .attr('r', 0)
                    .remove()
            );

            // Mouse moves.
            circles.on('mouseover', (event) => { 
                let source = d3.select(event.target).datum();

                circles
                    .selectAll('.pop')
                    .attr('r', (d) => {
                        if (d.id === source.id) 
                        {return ((width - margin.right) / newSubset.length)} else 
                        {((width - margin.right) / newSubset.length - 2)}
                    })
                    .style('opacity', (d) => {if (d.id === source.id) {return 1} else {return 0.1}});

                bars
                    .selectAll('.bar')
                    .attr('stroke-width', (d) => {if (d.id === source.id) {return ((width - margin.right) / newSubset.length) } else {return (width - margin.right) / newSubset.length - 3}});

                
                let toolInfo = [
                    ['Date', source.date],
                    ['Sentiment Score', source.sentiment]
                ]

                tooltip
                    .transition(dur)
                    .style('opacity', 0.97);
                toolHeader
                    .html(source.id)
                    .style('color', (d) => {if (source.sentiment < 0) {return '#dfb4e4'} else {return '#91f3b6'}});
                toolBody
                    .selectAll('p')
                    .data(toolInfo)
                    .join('p')
                        .html(d => `${d[0]}: ${d[1]}`)
                        .style('color', (d) => {if (source.sentiment < 0) {return '#dfb4e4'} else {return '#91f3b6'}});
            });

            circles.on('mouseout', (event) => {

                circles
                    .selectAll('.pop')
                    .attr('r', (width - margin.right) / newSubset.length - 2)
                    .style('opacity', 1);

                    bars
                        .selectAll('.bar')
                        .attr('stroke-width', (width - margin.right) / newSubset.length - 2);
            });
    };

    update(data);

});