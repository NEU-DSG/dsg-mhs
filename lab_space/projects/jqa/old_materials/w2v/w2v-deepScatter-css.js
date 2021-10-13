'use strict'

import {CSS3DRenderer, CSS3DObject} from './CSS3DRenderer.js';

// Preprocess Data.
function type(d) {
    var parseNA = string => (string === 'NA' ? undefined : string);
    
    // Change data type for count.
    return {
        word: parseNA(d.word),
        x: +d.x,
        y: +d.y,
    };
}


d3.csv('data/jqa_umap.csv', type).then(data => {
    
    let camera, scene, renderer;

    const objects = [];

    init();
    animate();

    function init() {
        const fov = 10;
        const aspect = window.innerWidth / window.innerHeight;
        const near = 2;
        const far = 60;
        
        camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        scene = new THREE.Scene();

        data.forEach( (d, i) => {
            // // Data points.
            // const vertex = new THREE.Vector3(
            //     d.x, 
            //     d.y,
            //     0
            // );
            // vertex.index = i;
            // vertex.word = d.word;
            // points_arr.push(vertex);
    
            // Label divs.
            const elem = document.createElement('div');
            elem.className = 'details';
            elem.innerHTML = d.word;
            // elem.appendChild(details)
    
            const objectCSS = new CSS3DObject(elem);
            objectCSS.position.x = d.x;
            objectCSS.position.y = d.y;
            objectCSS.position.z = 0;
    
            scene.add(objectCSS);
            objects.push(objectCSS);
        });

        renderer = new CSS3DRenderer();
        renderer.setSize( window.innerWidth, window.innerHeight );
        document.getElementById('canvas-container').appendChild( renderer.domElement );

        window.addEventListener('resize', onWindowResize);
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight)
        render();
    }

    function animate() {
        requestAnimationFrame( animate );
    }

    function render() {
        renderer.render(scene, camera)
    }
});