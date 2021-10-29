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

// https://peterbeshai.com/blog/2017-05-26-beautifully-animate-points-with-webgl-and-regl/
d3.csv('data/jqa-d2v-umap.txt', type).then(data => {
    console.log(data);

    // Get unique subjects from data array.
    let subjects = [...new Set(data.map(d => d.subject))];

    let colorScale = d3.scaleOrdinal()
        .domain(subjects)
        .range(d3.schemePaired);

    data.forEach(d => {
        d.color = colorScale(d.subject);
    });

    function main(err, regl) {
        const pointWidth = 4;
        const width = window.innerWidth;
        const height = window.innerHeight;

        const drawPoints = regl({
            frag: `
                // Set the precision of floating point numbers.
                precision highp float;

                // this value is populated by the vertex shader.
                varying vec3 fragColor;

                void main() {
                    // gl_FragColor is a special variable that holds the color of a pixel.
                    gl_FragColor = vec4(fragColor, 1);
                }
            `,
            vert: `
                // per vertex attributes
                attribute vec2 position;
                attribute vec3 color;
            
                // variables to send to the fragment shader
                varying vec3 fragColor;
            
                // values that are the same for all vertices
                uniform float pointWidth;
                uniform float stageWidth;
                uniform float stageHeight;

                // helper function to transform from pixel space to normalzied device coordinates (NDC).
                // In NDC (0, 0) is the middle, (-1, 1) is the top left and (1, -1) is the bottom right.
                vec2 normalizeCoords(vec2 position) {
                    // read in the positions into x and y vars.
                    float x = position[0];
                    float y = position[1];

                    return vec2(
                        2.0 * ((x / stageWidth) - 0.5),
                        // invert y since we think [0,0] is bottom left in pixel space
                        -(2.0 * ((y / stageHeight) - 0.5));
                    )
                }
            
                void main() {
                    // update the size of a point based on the prop pointWidth
                    gl_PointSize = pointWidth;
            
                    // send color to the fragment shader
                    fragColor = color;
            
                    // gl_Position is  a special variable that holds the position of a vertex.
                    gl_Position = vec4(normalizeCoords(position), 0.0, 1.0);
                }
            `,

            attributes: {
                position: data.map(d => [d.x, d.y]),
                color: data.map(d = d.color),
            },

            uniforms: {
                // using regl.prop to pass these in, we can specify them as arguments
                // in drawPoints function
                pointWidth: regl.prop('pointWidth'),

                // regl actually provides these as viewportWidth and
                // viewportHeight but I am using these outside and I want
                // to ensure they are the same numbers, so I am explicitly
                // passing them in.
                stageWidth: regl.prop('stageWidth'),
                stageHeight: regl.prop('stageHeight'),
            },

            // Specify number of points to draw.
            count: data.length,

            // Specify that each vertex is a point (not part of a mesh).
            primitive: 'data',
        });

        // Start animation loop.
        let frameLoop = regl.frame(() => {
            // clear buffer.
            regl.clear({
                // background color (black)
                color: [0, 0, 0, 1],
                depth: 1,
            });

            // Draw points using regl function.
            drawPoint({
                pointWidth,
                stageWidth: width,
                stagegHeight: height,
            });

            if (frameLoop) {
                frameLoop.cancel();
            }
        });
    }

    // initialize regl
    createREGL({
        onDone: main,
    })

}); // end.