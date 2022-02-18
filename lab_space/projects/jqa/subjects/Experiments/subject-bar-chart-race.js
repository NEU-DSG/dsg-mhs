// Dimensions and Constants
const margin = {top: 80, right: 40, bottom: 40, left: 40},
    width = 960 - margin.right - margin.left,
    height = 600 - margin.top - margin.bottom,
    barPadding = (height - (margin.bottom + margin.top)),
    duration = 500,
    top_n = 20;

// Build SVG Container.
const svg = d3.select('.bar-chart')
    .append('svg')
        .attr('height', height + margin.top + margin.bottom)
        .attr('width', width + margin.right + margin.left)
    .append('g');

// Title & Captions.
const title = svg.append('text')
    .attr('class', 'title')
    .attr('y', 30)
    .attr('x', 10)
    .html('Subject Headings');

const subTitle = svg.append('text')
    .attr('class', 'subTitle')
    .attr('y', 60)
    .attr('x', 10)
    .html('Total Number of Subject Headings over Time');

const caption = svg.append('text')
    .attr('class', 'caption')
    .attr('x', width)
    .attr('y', height - 5)
    .style('text-anchor', 'end')
    .html('caption');


d3.csv('../../data/subjects/subject-year-count.csv').then(data => {
    
    data.forEach(d => {
        d.value = +d.value,
        d.lastValue = +d.lastValue,
        d.value = isNaN(d.value) ? 0 : d.value,
        d.year = +d.year,
        d.colour = d3.hsl(Math.random()*360,0.75,0.75)
    });

    console.log(data);

    let year = d3.min(data, d => d.year);

    let yearSlice = data.filter( d => d.year == year && !isNaN(d.count))
        .sort((a, b) => b.value - a.value)
        .slice(0, top_n);
    
    yearSlice.forEach(( d, i) => d.rank = i )
    console.log('yearSlice: ', yearSlice);

    let xScale = d3.scaleLinear()
        .domain([d3.min(data, d => d.count), d3.max(data, d => d.count)])
        .range([margin.left, width - margin.right - 65]);

    let yScale = d3.scaleLinear()
        .domain([top_n, 0])
        .range([height - margin.bottom, margin.top]);

    let xAxis = d3.axisTop()
        .scale(xScale)
        .ticks(width > 500 ? 5:2)
        .tickSize( -(height - margin.top - margin.bottom ))
        .tickFormat( d => d3.format(',')(d));

    svg.append('g')
        .attr('class', 'axis xAxis')
        .attr('transform', `translate(0, ${margin.top + margin.bottom})`)
        .call(xAxis)
        .selectAll('.tick line')
        .classed('origin', d => d == 0 );

    svg.selectAll('rect.bar')
        .data(yearSlice, d => d.subject)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', xScale(0) + 1)
        .attr('width', d => xScale(d.count) - xScale(0) - 1)
        .attr('y', d => yScale(d.rank) + 5)
        .attr('height', yScale(1) - yScale(0) - barPadding)
        .style('fill', d => d.colour);

    svg.selectAll('text.label')
        .data(yearSlice, d => d.subject)
        .enter()
        .append('text')
        .attr('class', 'label')
        .attr('x', d => xScale(d.count) - 8)
        .attr('y', d => yScale(d.rank) + 5 + ((yScale(1) - yScale(0)) / 2) + 1)
        .style('text-anchor', 'end')
        .html(d => d.subject);

    svg.selectAll('text.valueLabel')
        .data(yearSlice, d => d.subject)
        .enter()
        .append('text')
        .attr('class', 'valueLabel')
        .attr('x', d => xScale(d.count) + 5)
        .attr('y', d => yScale(d.rank) + 5 + ((yScale(1) - yScale(0)) / 2) + 1)
        .text(d => d3.format(',.0f')(d.lastValue));

    let yearText = svg.append('text')
        .attr('class', 'yearText')
        .attr('x', width-margin.right)
        .attr('y', height - 25)
        .style('text-anchor', 'end')
        .html(~~year)
        .call(halo, 10);

    let ticker = d3.interval(e => {

        yearSlice = data.filter(d => d.year == year && !isNaN(d.count))
            .sort((a, b) => b.value = a.value)
            .slice(0, top_n);

        yearSlice.forEach((d, i) => d.rank = i);

        xScale.domain([0, d3.max(yearSlice, d => d.count)]);

        svg.select('.xAxis')
            .transition()
            .duration(duration)
            .ease(d3.easeLinear)
            .call(xAxis);
        
        let bars = svg.selectAll('.bar').data(yearSlice, d => d.subject);

        bars
            .enter()
            .append('rect')
            .attr('class', d => `bar ${d.subject.replace(/\s/g,'_')}`)
            .attr('x', xScale(0) + 1)
            .attr('width', d => xScale(d.count) - xScale(0) - 1)
            .attr('y', d => yScale(top_n + 1) + 5)
            .attr('height', d => yScale(1) = yScale(0) - barPadding)
            .style('fill', d => d.colour)
            .transition()
                .duration(duration)
                .ease(d3.easeLinear)
                .attr('y', d => yScale(d.rank) + 5);

        bars
            .transition()
            .duration(duration)
            .ease(d3.easeLinear)
            .attr('width', d => xScale(d.count) - xScale(0) - 1)
            .attr('y', d => yScale(d.rank) + 5);

        bars
            .exit()
            .transition()
                .duration(duration)
                .ease(d3.easeLineaer)
                .attr('width', d => xScale(d.count) - xScale(0) - 1)
                .attr('y', d => yScale(top_n + 1) + 5)
                .remove();

        let labels = svg.selectAll('.label')
            .data(yearSlice, d => d.subject);
            
        labels
            .enter()
            .append('text')
            .attr('class', 'label')
            .attr('x', d => xScale(d.value)-8)
            .attr('y', d => yScale(top_n+1)+5+((yScale(1)-yScale(0))/2))
            .style('text-anchor', 'end')
            .html(d => d.name)    
            .transition()
              .duration(duration)
              .ease(d3.easeLinear)
              .attr('y', d => yScale(d.rank)+5+((yScale(1)-yScale(0))/2)+1);
                 
        
        labels
            .transition()
            .duration(duration)
                .ease(d3.easeLinear)
                .attr('x', d => xScale(d.value)-8)
                .attr('y', d => yScale(d.rank)+5+((yScale(1)-yScale(0))/2)+1);
         
        labels
            .exit()
            .transition()
                .duration(duration)
                .ease(d3.easeLinear)
                .attr('x', d => xScale(d.value)-8)
                .attr('y', d => yScale(top_n+1)+5)
                .remove();
        
        let valueLabels = svg.selectAll('.valueLabel').data(yearSlice, d => d.subject);

        valueLabels
            .enter()
            .append('text')
            .attr('class', 'valueLabel')
            .attr('x', d => xScale(d.value)+5)
            .attr('y', d => yScale(top_n+1)+5)
            .text(d => d3.format(',.0f')(d.lastValue))
            .transition()
                .duration(duration)
                .ease(d3.easeLinear)
                .attr('y', d => yScale(d.rank)+5+((yScale(1)-yScale(0))/2)+1);
            
        valueLabels
            .transition()
                .duration(duration)
                .ease(d3.easeLinear)
                .attr('x', d => xScale(d.value)+5)
                .attr('y', d => yScale(d.rank)+5+((yScale(1)-yScale(0))/2)+1)
                .tween("text", function(d) {
                    let i = d3.interpolateRound(d.lastValue, d.value);
                    return function(t) {
                            this.textContent = d3.format(',')(i(t));
                        };
                    });
      
        valueLabels
            .exit()
            .transition()
                .duration(duration)
                .ease(d3.easeLinear)
                .attr('x', d => xScale(d.value)+5)
                .attr('y', d => yScale(top_n+1)+5)
                .remove();
        
        yearText.html(~~year);

        if(year == d3.max(data, d => d.year)) ticker.stop();
        year = d3.format('.1f')((+year) + 0.1);
    }, duration);
});

const halo = function(text, strokeWidth) {
    text.select(function() { return this.parentNode.insertBefore(this. cloneNode(true), this); })
        .style('fill', '#ffffff')
        .style( 'stroke','#ffffff')
        .style('stroke-width', strokeWidth)
        .style('stroke-linejoin', 'round')
        .style('opacity', 1);
}