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
    // console.log(data);

    // 1. Build camera, scene, and append points.
    let width = window.innerWidth;
    let viz_width = width; // this is needed for resizing viz separately.
    let height = window.innerHeight;

    // Build camera.
    const fov = 10;
    const aspect = width / height;
    const near = 2;
    const far = 60;
    // const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    const canvas = document.querySelector('#w2v-scatterplot');
    const renderer = new THREE.WebGL1Renderer({canvas});
    // const renderer = new CSS3DRenderer({canvas});
    renderer.setSize(width, height);

    window.addEventListener('resize', () => {
        width = window.innerWidth;
        viz_width = width;
        height = window.innerHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    });

    // Build scene.
    const scene = new THREE.Scene();

    const points_arr = [];
    const objects = [];
    const elem = document.querySelector('#labels');

    // Build data points and label divs.
    data.forEach( (d, i) => {
        // Data points.
        const vertex = new THREE.Vector3(
            d.x, 
            d.y,
            0
        );
        vertex.index = i;
        vertex.word = d.word;
        points_arr.push(vertex);

        // Label divs.
        const details = document.createElement('div');
        details.className = 'details';
        details.innerHTML = d.word;
        elem.appendChild(details)

        const objectCSS = new CSS3DObject(elem);
        objectCSS.position.x = d.x;
        objectCSS.position.y = d.y;
        objectCSS.position.z = 0;

        scene.add(objectCSS);
        objects.push(objectCSS);
    });

    console.log(objects);

    let nodeGeometry = new THREE.BufferGeometry().setFromPoints( points_arr );

    let circle_sprite = new THREE.TextureLoader().load(
        "https://fastforwardlabs.github.io/visualization_assets/circle-sprite.png"
    )

    let nodeMaterial = new THREE.PointsMaterial({
        name: true,
        size: 1, 
        map: circle_sprite,
        transparent: true,
        color: '#fad6a5',
        sizeAttenuation: false,
    });

    const points = new THREE.Points(nodeGeometry, nodeMaterial);
    scene.add(points);

    // 2. Add zoom & panning controls.
    // Zoom controls.
    function zoomHandler(d3_transform) {
        let scale = d3_transform.k;
        let x = -(d3_transform.x - width / 2) / scale;
        let y = (d3_transform.y - height / 2) / scale;
        let z = getZfromScale(scale);
        camera.position.set(x, y, z);
    }

    function getScaleFromZ(camera_z_position) {
        let half_fov = fov / 2;
        let half_fov_radians = toRadians(half_fov);
        let half_fov_height = Math.tan(half_fov_radians) * camera_z_position;
        let fov_height = half_fov_height * 2;
        let scale = height / fov_height; // Divide vis. height by height derived from fov.
        return scale;        
    }

    function getZfromScale(scale) {
        let half_fov = fov / 2;
        let half_fov_radians = toRadians(half_fov);
        let scale_height = height / scale;
        let camera_z_position = scale_height / (2 * Math.tan(half_fov_radians));
        return camera_z_position;
    }

    function toRadians(angle) {
        return angle * (Math.PI / 180);
    }

    let zoom = d3.zoom()
        .scaleExtent([getScaleFromZ(far), getScaleFromZ(near)])
        .on('zoom', (event) => {
            let d3_transform = event.transform;
            zoomHandler(d3_transform);
        });
    
    let view = d3.select(renderer.domElement);

    function setUpZoom() {
        view.call(zoom);
        let initial_scale = getScaleFromZ(far);
        var initial_transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(initial_scale);
        zoom.transform(view, initial_transform);
        camera.position.set(0, 0, far);
    }
    setUpZoom();

    // 3. Render visualization.
    function render() {
        nodeMaterial.size = far / camera.position.z; // change point size when zooming;

        requestAnimationFrame(render);
        renderer.render(scene, camera);
    }
    render();

    // 4. Add hover and tooltip interactions.
    let raycaster = new THREE.Raycaster();
    raycaster.layers.set(0); // not three-dimensional, so set to 0.

    // Conditionally set points threshold.
    // https://stackoverflow.com/questions/44999924/three-js-ray-casting-for-particular-points
    // determines how precise raycaster can be (smaller numbers for crowded spaces).
    let pointThreshold;
    switch(camera.position.z) {
        case 7 <= camera.position.z < 40:
            pointThreshold = (camera.position.z / 10);
            break;
        case camera.position.z < 7:
            pointThreshold = 0.01;
            break;
        default:
            pointThreshold = (camera.position.z / 2);
    }
    raycaster.params.Points.threshold = pointThreshold;

    let vec = new THREE.Vector3();
    let pos = new THREE.Vector3();

    view.on('mousemove', (event) => {
        vec.set(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1,
            0
        );
        vec.unproject(camera);
        vec.sub(camera.position).normalize();

        var distance = -camera.position.z / vec.z;
        pos.copy( camera.position ).add( vec.multiplyScalar(distance));

        checkIntersects(pos);  
    });

    function checkIntersects(pos) {
        raycaster.setFromCamera(pos, camera);
        let intersects = raycaster.intersectObject(points);
        
        if (intersects[0]) {
            let sorted_intersects = intersects.sort((a, b) => {a.distanceToRay - b.distanceToRay});
            let intersect = sorted_intersects[0];

            let index = intersect.index;
            let datum = points_arr[index];
            
            highlightPoint(datum);
            // showTooltip(pos, datum);
            // showTooltip(pos, datum);
        } else {
            removeHighlights();
            // hideTooltip();
        }
    }

    let hoverContainer = new THREE.Object3D()
    scene.add(hoverContainer);

    function highlightPoint(datum) {
        removeHighlights();

        let geo_vertices = [];

        let geometry = new THREE.BufferGeometry();
        geo_vertices.push(
            new THREE.Vector3(
                datum.x,
                datum.y,
                0
            )
        );

        let material = new THREE.PointsMaterial({
            size: 6,
            sizeAttenuation: false,
            vertexColors: false,
            // transparent: true
        });

        let point = new THREE.Points(geometry, material);
        hoverContainer.add(point);
    }

    function removeHighlights() {
        hoverContainer.remove(...hoverContainer.children);
    }

    view.on('mouseleave', () => {
        removeHighlights();
    });


    // // Iniitial tooltip state.
    // let tooltip_state = { display: 'none' };

    // let $tooltip = document.querySelector("#tooltip");
    // let $point_tip = document.querySelector('#point_tip');

    // function updateTooltip() {
    //     $tooltip.style.display = tooltip_state.display;
    //     $tooltip.style.left = tooltip_state.left + 'px';
    //     $tooltip.style.top = tooltip_state.top + 'px';
    //     $point_tip.innerText = tooltip_state.word;
    //     $point_tip.style.background = '#FAD6A5';
    // }

    // function showTooltip(mouse_position, datum) {
    //     let tooltip_width = 120;
    //     let x_offset = -tooltip_width / 2;
    //     let y_offest = 30;
    //     tooltip_state.display = 'block';
    //     tooltip_state.left = mouse_position[0] + x_offset;
    //     tooltip_state.top = mouse_position[1] + y_offest;
    //     tooltip_state.name = datum.name;
    //     updateTooltip();
    // }

    // function hideTooltip() {
    //     tooltip_state.display = 'none';
    //     updateTooltip();
    // }
});