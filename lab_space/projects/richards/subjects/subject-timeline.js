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
    let margin = {top: 30, right: 50, bottom: 30, left: 30},
        width = 960,
        height = 500,
        duration = 100;

    const subjects = [...new Set(data.map( d => d.subjects ))].sort();

    // Selection options.
    let select = d3.select('#subject-selection')
        .append('select')
        .attr('class', 'select')
        .on('change', update);

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
            .style('display', 'none')
            .style('position', 'fixed')
            .attr('pointer-events', 'none');

    const toolHeader = tooltip
        .append('h3')
            .attr("class", "tipHeader");

    const toolBody = tooltip
        .append('div')
            .attr('class', 'tipBody');

      // Build scales.
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

    // Access dropdown menu value and write chosen subject to page. 
    let selectValue = d3.select('select').property('value');
    let subset = data.filter(d => (d.subjects === selectValue));
    let subjText = d3.select('#subjText')
        .attr('class', 'subjText')
        .text(selectValue);

    let line = svg.append('g').attr('class', 'line');

    line.selectAll('path')
        .data([data])
        .join(
            enter => enter.append('path')
                .attr('class', 'line')
                .attr('fill', 'none')
                .attr('stroke', '#696969')
                .attr("stroke-width", 6)
                .attr('d', d3.line()
                    .x(d => x(d.year))
                    .y(d => y(d.total))
                ),
            update => update,
            exit => exit.remove()
        );

    line
        .selectAll('circle')
        .data(data)
        .join(
            enter => enter.append('circle')
                .attr('class', 'line')
                .attr("dy", "0.35em")
                .attr('cx', d => x(d.year))
                .attr('cy', d => y(d.total))
                .attr('r', 15)
                .attr('fill', '#110b11')
                .style('stroke', '#696969'),
            update => update,
            exit => exit.remove()
        )

    line
        .selectAll('text.line')
        .data(data)
        .join(
            enter => enter.append('text')
                .attr('class', 'line')
                .attr("dy", "0.35em")
                .attr('x', d => x(d.year))
                .attr('y', d => y(d.total))
                .attr('fill', '#fdeed8')
                .attr('text-anchor', 'middle')
                .attr('pointer-events', 'none')
                .text(d => d.total),
            update => update,
            exit => exit.remove()
        )

    let subNodes = svg.append('g').attr('class', 'subNodes');
    let subText = svg.append('g').attr('class', 'subText');

    // Build initial graph with page load.
    update();

    // Change highlighted bar sections on change.
    function update(subset) {

        selectValue = d3.select('select').property('value');
        subset = data.filter(d => (d.subjects === selectValue));
        subjText.text(selectValue);

        // Build relative graph.
        subNodes
            .selectAll('.subNodes')
            .data(subset)
            .join(
                enter => enter.append('circle')
                        .attr('class', 'subNodes')
                        .attr('fill', '#91f3b6')
                        .attr('cx', d => x(d.year))
                        .attr('cy', d => y(d.count))
                        .attr('r', 15)
                        .style('stroke', '#110b11')
                        .style('stroke-width', 1.5)
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear),

                update => update.transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                        .attr('cx', d => x(d.year))
                        .attr('cy', d => y(d.count)),

                exit => exit
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear)
                    .remove(),
            );

        subText
            .selectAll('.subText')
            .data(subset)
            .join(
                enter => enter.append('text')
                    .attr('class', 'subText')
                    .attr("dy", "0.35em")
                    .attr('x', d => x(d.year))
                    .attr('y', d => y(d.count))
                    .attr('fill', '#110b11')
                    .attr('text-anchor', 'middle')
                    .attr('pointer-events', 'none')
                    .text(d => d.count)
                    .transition()
                        .duration(duration)
                        .ease(d3.easeLinear),
                update => update.transition()
                    .duration(duration)
                    .ease(d3.easeLinear)
                    .attr('x', d => x(d.year))
                    .attr('y', d => y(d.count)),
                exit => exit.transition()
                    .duration(duration)
                    .ease(d3.easeLinear)
                    .remove()
            )
    };

    // Include hover over for info.
    line.on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseout', mouseout);

    subNodes.on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseout', mouseout);

    // Functions for mouseover/out events.
    function mouseover(event, d, i) {
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
                ['Percentage of Total', source.percentage + '%']
            ];
        }
        
        tooltip
            .transition(duration)
                .attr('pointer-events', 'none')
                .style('display', 'inline')
                .style('opacity', 0.97)
                .style("left", (event.x + 10) + "px")
                .style("top", (event.y - 15) + "px");
                
        toolHeader
            .attr('pointer-events', 'none')
            .html(selectValue);

        toolBody
            .selectAll('p')
            .data(source_info)
            .join('p')
                .attr('pointer-events', 'none')
                .html(d => `${d[0]}: ${d[1]}`);
    };

    function mousemove(event) {
        tooltip
            .style("left", (event.x + 10) + "px")
            .style("top", (event.y - 15) + "px");
    }

    function mouseout() {
        tooltip.transition(duration).style('display', 'none').style('opacity', 0);
    }

});