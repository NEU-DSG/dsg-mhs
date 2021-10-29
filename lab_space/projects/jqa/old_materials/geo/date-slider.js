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
    // d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv('data/jqa-geoReference.csv', type)
])
.then(([data]) => {
    let margin = {top: 20, right: 20, bottom: 25, left: 20},
        width = 960 - margin.right - margin.left,
        height = 600 - margin.top - margin.bottom,
        sliderWidth = width / 2;

    let svg = d3.select('#test-holder')
        .append('svg')
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr('transform', `translate(${margin.left}, ${margin.right})`)
        .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.right})`);

    let [startDate, endDate] = d3.extent(data, d => d.datetime);

    // Build slider tools.
    // https://bl.ocks.org/johnwalley/e1d256b81e51da68f7feb632a53c3518
    let sliderTime = d3.sliderBottom()
        .min(startDate)
        .max(endDate)
        .step(1000 * 60 * 60 * 24 * 365) // step by year
        .width(sliderWidth)
        .tickFormat(d3.timeFormat('%Y'))
        // .tickValues(data, d => d.datetime)
        .default(endDate)
        .on('onchange', val => {

            // Change date label in paragraph.
            d3.select('p#value-time').text(d3.timeFormat('%Y')(val));

            // Draw chart here.
        });

    let gTime = d3.select('div#slider-time')
        .append('svg')
        .attr('width', 500)
        .attr('height', 100)
        .append('g')
        .attr('transform', `translate(15,15)`);

    gTime.call(sliderTime);

    // Print initialize time as paragraph.
    d3.select('p#value-time').text(d3.timeFormat('%Y')(sliderTime.value()));

    // Build play button tools.
    let playButton = d3.select('#test-button');

    playButton.on('click', function() {
        let button = d3.select(this);
        let sliderVal = sliderTime.value();

        var t = (+sliderTime.value() + 1) % (+sliderTime.max() + 1);

        console.log(t);

        if (button.text() == 'Pause') {
            button.text('Play')

            // sliderVal.value(t + 1);
            console.log(t + 1);
            
        } else {
            button.text('Pause')
        }
    })
    
})