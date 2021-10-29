'use strict'

// https://medium.com/@andybarefoot/making-a-map-using-d3-js-8aa3637304ee

function type(d) {
    let timeFormat = d3.timeFormat('%Y-%b-%d');
    let parseNA = string => (string === 'NA' ? undefined : string);

    return {
        entry: parseNA(d.entry),
        date: timeFormat(new Date(d.date) ),
        datetime: new Date(d.date),
        year: new Date(d.date).getFullYear(),
        lon: parseFloat(d.lon),
        lat: parseFloat(d.lat)
    }
}

Promise.all([
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv('data/jqa-geoReference.csv', type)
])
.then(([usData, data]) => {
    let margin = {top: 20, right: 20, bottom: 25, left: 20},
        width = 960 - margin.right - margin.left,
        height = 600 - margin.top - margin.bottom;

    // Build zoom function.
    let zoom = d3.zoom()
        .on('zoom', (event) => {
            svg.attr('transform', event.transform);
        })
        .scaleExtent([1, 40]);

    let svg = d3.select('#us-map')
        .append('svg')
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr('transform', `translate(${margin.left}, ${margin.right})`)
        .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.right})`)
        .call(zoom);

    let projection = d3.geoAlbersUsa()
        .scale(width)
        .translate([width / 2, height / 2]);


    // Build tooltip.
    let tooltip = d3.select('#us-map')
        .append('div')
        .attr('class', 'us-tooltip');

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

    // Build slider tools.
    let moving = false;
    let currentValue = 0;
    let targetValue = width / 1.5;
    let timer = 0;

    // Date range.
    let [startDate, endDate] = d3.extent(data, d => d.date);

    let x = d3.scaleTime()
        .domain([startDate, endDate])
        .range([0, targetValue])
        .clamp(true);

    let slider = svg.append('g')
        .attr('class', 'slider')
        .attr('transform', `translate(${margin.left}, ${height / 5})`);

    slider.append('line')
        .attr('class', 'track')
        .attr('x1', x.range()[0])
        .attr('x2', x.range()[1])
        .select( function() { return this.parentNode.appendChild(this.cloneNode(true)); })
            .attr('class', 'track-inset')
        .select( function() { return this.parentNode.appendChild(this.cloneNode(true)); })
            .attr('class', 'track-overlay')
            .call(d3.drag()
                .on('start.interrupt', function() { slider.interrupt(); })
                .on('start drag', function(event) {
                    currentValue = event.x;
                    console.log(currentValue);
                    update(x.invert(currentValue)); // update function (draw current data) here.
                })
            );

    slider.insert('g', '.track-overlay')
        .attr('class', 'ticks')
        .attr('transform', `translate(${0}, ${18})`)
        .selectAll('text')
            .data(x.ticks(10))
            .enter()
            .append('text')
            .attr('x', x)
            .attr('y', 10)
            .attr('text-anchor', 'middle')
            .text( function (d) { return d; });

    let handle = slider.insert('circle', '.track-overaly')
        .attr('class', 'handle')
        .attr('r', 9);
    
    let label = slider.append('text')
        .attr('class', 'label')
        .attr('text-anchor', 'middle')
        .text(startDate)
        .attr('transform', `translate(0, ${-5})`);

    // Play button.
    let playButton = d3.select('#us-play-button');

    playButton
        .on('click', function () {
            let button = d3.select(this);
            if (button.text() == 'Pause') {
                moving = false;
                d3.select(this).clearInterval(timer);
                button.text('Play');
            } else {
                moving = true;
                timer = setInterval(step, 100);
                button.text('Pause');
            }
            console.log('Slider moving: ', moving);
        });

    function step() {
        update(x.invert(currentValue));
        currentValue = currentValue + (targetValue / 151);
        if (currentValue > targetValue) {
            moving = false;
            currentValue = 0;
            clearInterval(timer);
            playButton.text('Play');
            console.log('Slider moving: ', moving);
        }
    }

    // Subset map data.
    usData.features = usData.features.filter( d => d.properties.name == "USA"); // || d.properties.name == "Canada");

    let subset = []

    // Remove (splice) data object if it doesn't appear in US projection.
    data.forEach( (d, i, o) => {
        if (projection([d.lon, d.lat]) === null) {
            o.splice(i, 1);
        } else {
            subset.push(d);
        }
    }) 
    // Sort data by date (ascending).
    data.sort((a, b) => a.date - b.date);

    // Draw US map.
    svg
        .selectAll('path.state')
        .data(usData.features)
        .join(
            enter => enter.append('path')
                .attr('class', 'state')
                .attr('d', d3.geoPath().projection(projection)),
            update => update,
            exit => exit.transition().remove()
        )
        .attr('transform', `translate(${margin.left}, ${height / 8})`);

    // Draw markers within current subset.
    function chart(subset) {

        let markers = svg.selectAll('circle.marker')
            .attr('class', 'marker')
            .data(subset);
            
        markers
            .join(
                enter => enter.append('circle')
                    .attr('class', 'marker')
                    .attr('cx', d => projection([d.lon, d.lat])[0])
                    .attr('cy', d => projection([d.lon, d.lat])[1])
                    .attr('r', 2),
                update => update,
                exit => exit.transition().remove()
            )
            .on('mouseover', mouseover)
            .on('mousemove', mousemove)
            .on('mouseleave', mouseleave);
    }

    // chart(subset);
    function update(h) {
        console.log(h);
        handle.attr('cx', x(h));
        label.attr('x', x(h)).text(h);

        // Filter data set and redraw plot.
        let newData = subset.filter(d => { d.date < h });
        
        chart(newData);
    }


    

})