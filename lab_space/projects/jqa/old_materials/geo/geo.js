'use strict'

// https://medium.com/@andybarefoot/making-a-map-using-d3-js-8aa3637304ee

function type(d) {

    let timeFormat = d3.timeFormat('%Y-%b-%d');
    let parseNA = string => (string === 'NA' ? undefined : string);

    return {
        entry: parseNA(d.entry),
        date: timeFormat(new Date(d.date) ),
        year: new Date(d.date).getFullYear(),
        lat: d.lat,
        lon: d.lon
    }
}

// // Build slider.
// let moving = false;
// let currentValue = 0;
// let targetValue = width;

// let playButton = d3.select('#play-button');

// let slider = svg.append('g')
//     .attr('class', 'slider')
//     .attr('transform', `translate(${margin.left}, ${margin.top})`);


Promise.all([
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv('data/jqa-geoReference.csv', type)
])
.then(([geoData, data]) => {
    let margin = {top: 20, right: 20, bottom: 25, left: 20},
        width = 860 - margin.right - margin.left,
        height = 500 - margin.top - margin.bottom;

    // Build zoom function.
    let zoom = d3.zoom()
        .on('zoom', (event) => {
            svg.attr('transform', event.transform);
        })
        .scaleExtent([1, 40]);

    // Build svg and project map.
    let svg = d3.select('#map-holder')
        .append('svg')
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
        .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.right})`)
        .call(zoom);

    let projection = d3.geoAitoff()
        .scale(width / 2 / Math.PI)
        .translate([width / 2, height / 2]);

    // Build tooltip.
    let tooltip = d3.select('#map-holder')
        .append('div')
        .attr('class', 'tooltip');

    // Build mouse moves.
    let mouseover = function (event, d) {
        tooltip.style('opacity', 1)
    }

    let mousemove = function(event, d) {
        tooltip
            .html('Entry: ' + d.entry + '<br>' + 'Date: ' + d.date + '<br>' + 'Long: ' + d.lon + '<br>' + 'Lat: ' + d.lat)
            .style('left', (event.x) / 2 + 'px')
            .style('top', (event.x) / 2 - 30 + "px")
    }

    let mouseleave = function(event, d) {
        tooltip.style('opacity', 0)
    }

    // Date range.
    let [startDate, endDate] = d3.extent(data, d => d.date);

    // // Apply x-scale to slider range.
    // let x = d3.scaleTime()
    //     .domain([startDate, endDate])
    //     .range([0, targetValue])
    //     .clamp(true);

    // // Add details to slider.
    // slider.append('g')
    //         .attr('class', 'track')
    //         .attr('x1', x.range()[0])
    //         .attr('x2', x.range()[1])
    //     .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
    //         .attr('class', 'track-inset')
    //     .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
    //         .attr('class', 'track-overlay')
    //     .call(d3.drag()
    //         .on('start.interrupt', function() { slider.interrupt(); })
    //         .on('start drag', function(event) {
    //             currentValue = event.x;
    //             update(x.invert(currentValue));
    //         })
    //     );
    
    // slider.insert('g', '.track-overlay')
    //         .attr('class', 'ticks')
    //         .attr('transform', `translate(0, ${18})`)
    //     .selectAll('text')
    //     .data(x.ticks(10))
    //     .enter()
    //     .append('text')
    //         .attr('x', x)
    //         .attr('y', 10)
    //         .attr('text-anchor', 'middle')
    //     .text(function(d) { return d.date})

    // let handle = slider.insert('circle', '.track-overlay')
    //     .attr('class', 'handle')
    //     .attr('r', 9);

    // let label = slider.append('text')
    //     .attr('class', 'label')
    //     .attr('text-anchor', 'middle')
    //     .text(startDate)
    //     .attr('transform', `translate(0, ${(-25)})`)

    // Draw country borders.
    svg
        .selectAll('path')
        .data(geoData.features)
        .join(
            enter => enter.append('path')
                .attr('class', 'country')
                .attr('d', d3.geoPath().projection(projection)),
            update => update,
            exit => exit.transition().remove()
        );

    // Add play/pause animation.
    
    function chart(data) {
        // Draw geo-references.
        svg
            .selectAll('circle.marker')
            .data(data)
            .join(
                enter => enter.append('circle')
                    .attr('class', 'marker')
                    .attr('cx', d => projection([d.lon, d.lat])[0])
                    .attr('cy', d => projection([d.lon, d.lat])[1])
                    .attr('r', 1),
                update => update,
                exit => exit.transition().remove()
            )
            .on('mouseover', mouseover)
            .on('mousemove', mousemove)
            .on('mouseleave', mouseleave);
    };

    chart(data)

}); // end.
