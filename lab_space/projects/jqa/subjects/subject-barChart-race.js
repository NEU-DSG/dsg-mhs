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

    data.forEach( d => {
        d.color = d3.hsl(Math.random()*360,0.75,0.75)
    });

    // Assign 'lastCount' property to objects in array 'data' with conditions.
    for (var i = 0; i < data.length; i++) {
        let subj = data[i].subject;
        let year = data[i].year;

        let obj = data.filter(d => (d.year === year - 1) && (d.subject === subj));

        if (obj.length > 0) { 
            data[i].lastCount = obj[0].count;
        } else {
            data[i].lastCount = 0;
        }
    }

    // Dimensions and Constants
    const margin = {top: 20, right: 15, bottom: 25, left: 15},
        width = 960 - margin.right - margin.left,
        height = 600 - margin.top - margin.bottom,
        duration = 400,
        top_n = 10,
        padding = 15,
        barPadding = (height - (margin.bottom + margin.top)) / (top_n * 5);

    // Build SVG Container.
    const svg = d3.select('.bar-chart-racing')
        .append('svg')
        .attr('height', height + margin.top + margin.bottom)
        .attr('width', width + margin.right + margin.left + padding)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    let year = d3.min(data, d => d.year);

    let yearSlice = data.filter(d => d.year == year && !isNaN(d.count))
        .sort((a, b) => b.count - a.count)
        .slice(0, top_n);

    yearSlice.forEach((d,i) => d.rank = +i);

    // Build scales.
    let x = d3.scaleLinear()
        // .domain([0, d3.max(data, d => d.count)]) // fixed axis
        .domain([0, d3.max(yearSlice, d => d.count)]) // adjust axis each year
        .range([margin.left, width - margin.right]);

    let y = d3.scaleLinear()
        .domain([top_n, 0])
        .range([height + margin.bottom, margin.top + padding]);

    let xAxis = d3.axisTop()
        .scale(x)
        .ticks( width > 500 ? 5:2)
        .tickSize( -( height + margin.top + margin.bottom + padding))
        .tickFormat( d => d3.format(',') (d));

    let yearText = svg.append('text')
        .attr('class', 'yearText')
        .attr('x', width)
        .attr('y', height)
        .style('text-anchor', 'end')
        .html(~~year);

    // Append axis.
    svg.append('g')
       .attr('class', 'axis xAxis')
       .attr('transform', `translate(0, ${margin.top})`)
       .call(xAxis)
        .selectAll('.tick line')
        .classed('origin', d => d == 0);


    // // Add unique colors: https://medium.com/@Elijah_Meeks/color-advice-for-data-visualization-with-d3-js-33b5adc41c90
    // let colorScale = d3.scaleOrdinal(d3.schemePastel1);

    function chart(yearSlice) {
        
        // Redraw graph.
        svg
            .selectAll('rect')
            .data(yearSlice, d => d.subject)
            .join(
                enter => {enter
                    .append('rect')
                    .attr('class', 'bar')
                    .style('fill', d => d.color)
                    .attr('height', y(1) - y(0) - barPadding)
                    .attr('x', x(0) + 1)
                    .attr('y', d => y(top_n + 1))
                    .attr('width', d => x(d.count) - x(0) - 1) // values adjusted by hand here.
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', d => y(d.rank))
                    },
                update => {update
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('width', d => x(d.count) - x(0) - 1)
                        .attr('y', d => y(d.rank))
                    },
                exit => {exit
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('width', d => x(0))
                        .attr('y', d => y(top_n + 1))
                        .remove();
                    }
            );
        
        // Append labels.
        svg
            .selectAll('text.label')
            .data(yearSlice)
            .join(
                enter => {enter
                    .append('text')
                    .attr('class', 'label')
                    .attr('x', d => x(d.count) - 8)
                    // .attr('y', d => y(top_n + 1) + barPadding + 15)
                    .attr('y', d => y(top_n + 1) + ( (y(1) - y(0)) / 2) )
                    .style('text-anchor', 'end')
                    .html(d => d.subject)
                },
                update => {update
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('x', d => x(d.count) - 8)
                        // .attr('y', d => y(d.rank) + barPadding + 15)
                        .attr('y', d => y(d.rank) + ( (y(1) - y(0)) / 2) )
                    // .style('text-anchor', 'end')
                    // .html(d => d.subject)
                },
                exit => {exit
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('x', d => x(d.count) - 8)
                        .attr('y', d => y(top_n + 1) + barPadding + 15)
                        .remove();
                }
            );

        // Append value labels.
        svg
            .selectAll('text.valueLabel')
            .data(yearSlice, d => d.subject)
            .join(
                enter => {enter
                    .append('text')
                    .attr('class', 'valueLabel')
                    .attr('x', d => x(d.count) + 5 )
                    .attr('y', d => y(top_n + 1) + 5)
                    .text(d => d3.format(',.0f')(d.lastCount))
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('y', d => y(d.rank) + 5 + ( (y(1) - y(0)) / 2) )
                    // .attr('y', d => y(d.rank) + 25)
                    // .text(d => d.count)
                },
                update => {update
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('x', d => x(d.count) + 5 )
                        .attr('y', d => y(d.rank) + 5 + ( (y(1) - y(0)) / 2) )
                        .tween('text', function(d) {
                            let i = d3.interpolateRound(d.lastCount, d.count);

                            return function(t) {
                                this.textContent = d3.format(',')(i (t));
                            };
                        })
                },
                exit => {exit
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('x', d => x(d.count) - 8)
                        .attr('y', d => y(top_n + 1) + barPadding + 15)
                        .remove();
                }
            );
    };

    // Reshape graph with every tick (done within "ticker").
    let ticker = d3.interval( d => {

        // Filter out year from data, sort, and select top n.
        yearSlice = data.filter(d => d.year == Math.floor(year) && !isNaN(d.count))
            .sort((a, b) => d3.descending(a.count, b.count))
            .slice(0, top_n);

        // Rank by count (per year).
        yearSlice.forEach((d, i) => d.rank = i);

        // Change text to current year.
        yearText.html(~~year);

        // Adjust axis with each year slice.
        x.domain([0, d3.max(yearSlice, d => d.count)]);
        
        // Resize x-Axis
        svg.select('.xAxis')
            .transition()
                .duration(duration)
                .ease(d3.easeLinear)
                .call(xAxis);

        // Call chart function.
        chart(yearSlice);

        if (year == d3.max(data, d => d.year)) ticker.stop();
        year = d3.format('.1f')((+year) + 0.1);
        }, duration);

});

// To - Do:
// Fix bugs (subjects not appearing, text run-off), add pause/start buttong
// Add hover tooltip.