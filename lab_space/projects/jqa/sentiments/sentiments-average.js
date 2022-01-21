'use strict'

// Preprocess Data.
function type(d, i) {
    // var parseNA = string => (string === 'NA' ? undefined : string);
    
    // Change data type for count.
    return {
        date: new Date(d.date),
        year: new Date(d.date).getFullYear(),
        month: new Date(d.date).getMonth(),
        day: new Intl.DateTimeFormat('en-US', { weekday: 'long'}).format(new Date(d.date)), // Sunday - Saturday : 0 - 6
        sentiment: +d.sentiment,
        id: +i,
    };
}

d3.csv('data/jqa_sentiments.csv', type).then( data => {

    // let averages = d3.group(data, d => d.day);
    let dailyAverages = d3.rollup(data, v => d3.mean(v, d => d.sentiment), d => d.day);
    console.log(dailyAverages);

    let monthlyAverages = d3.rollup(data, v => d3.mean(v, d => d.sentiment), d => d.month);
    console.log(monthlyAverages);
    
    let yearlyAverages = d3.rollup(data, v => d3.mean(v, d => d.sentiment), d => d.year);
    console.log(yearlyAverages);

    // No significant, discernable patterns in sentiments over time. 
    // Highs/lows seem to be temporary rather than drawn out, according to sent. analysis.

    // Although not shown, averages by day and year show similar graphs with little fluctuation.
    
}); // end