'use strict'

// Process data.
function type(d) {
    var parseNA = string => (string === 'NA' ? undefined : string);

    // Change data type for count.
    return {
        entry: parseNA(d.entry),
        date: Date.parse(d.date),
        subject: parseNA(d.subject),
        x: +d.x,
        y: +d.y,
    };
}

// https://bocoup.com/blog/smoothly-animate-thousands-of-points-with-html5-canvas-and-d3
// https://bl.ocks.org/pbeshai/65420c8d722cdbb0600b276c3adcc6e8

// https://peterbeshai.com/blog/2017-05-26-beautifully-animate-points-with-webgl-and-regl/
// https://bl.ocks.org/pbeshai/28c7f3acdde4ca5a13854f06c5d7e334
d3.csv('data/jqa-d2v-umap.txt', type).then(data => {
    console.log(data);

    // let canvas = document.getElementById('d2v');
    const canvas = d3.select('canvas');

    // Get unique subjects from data array.
    let subjects = [...new Set(data.map(d => d.subject))];

    let colorScale = d3.scaleOrdinal()
        .domain(subjects)
        .range(d3.schemePaired);

    data.forEach(d => {
        d.color = colorScale(d.subject);
    })


    //  Given a set of points, lay them out in a grid.
    //  Mutates the `points` passed in by updating the x and y values.
    
    //  @param {Object[]} points The array of points to update. Will get `x` and `y` set.
    //  @param {Number} pointWidth The size in pixels of the point's width. Should also include margin.
    //  @param {Number} gridWidth The width of the grid of points
    //  @return {Object[]} points with modified x and y
    
    function gridLayout(points, pointWidth, gridWidth) {
        const pointHeight = pointWidth;
        const pointsPerRow = Math.floor(gridWidth / pointWidth);
        const numRows = points.length / pointsPerRow;

        points.forEach((point, i) => {
            point.x = pointWidth * (i % pointsPerRow);
            point.y = pointHeight * Math.floor(i / pointsPerRow);
    });

        return points;
    }

    // Draw points based on their current layout.
    function draw() {
        const ctx = canvas.node().getContext('2d');
        ctx.save();

        // Erase what is on the canvase currently.
        ctx.clearRect(0, 0, width, height);

        // Draw each point as a rectangle
        for (let i = 0; i < data.length; ++i) {
            const point = data[i];
            ctx.fillStyle = point.color;
            ctx.fillRect(point.x, point.y, pointWidth, pointWidth);
        }

        ctx.restore();
    }
    
    const pointWidth = 4;
    const pointMargin = 3;
    const width = 600;
    const height = window.innerHeight;

    gridLayout(data, pointWidth + pointMargin, width);
    draw();
    

});