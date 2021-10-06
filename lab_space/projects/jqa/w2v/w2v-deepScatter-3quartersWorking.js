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
    
    const node_color = '#fad6a5';
    const node_size = 2;

    // 1. Build camera, scene, and append points.
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Build camera.
    const fov = 10;
    const aspect = width / height;
    const near = 2;
    const far = 60;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    // Build canvas.
    const canvas = document.querySelector('#w2v-scatterplot');

    // Build scenes & renderers.
    // webGL.
    const renderer = new THREE.WebGL1Renderer({canvas, antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    const scene = new THREE.Scene();

    window.addEventListener('resize', () => {
        width = window.innerWidth;
        height = window.innerHeight;

        renderer.setSize(width, height);

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    });

    // Build data points and label divs.
    const points_arr = [];

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
    });

    let nodeGeometry = new THREE.BufferGeometry().setFromPoints( points_arr );

    let circle_sprite = new THREE.TextureLoader().load(
        "https://fastforwardlabs.github.io/visualization_assets/circle-sprite.png"
    )

    let nodeMaterial = new THREE.PointsMaterial({
        name: true,
        size: node_size, 
        map: circle_sprite,
        transparent: true,
        color: node_color,
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

    // 4. Find point intersects with mouse.
    let raycaster = new THREE.Raycaster();
    // raycaster.params.Points.threshold = 0.1;
    const mouseRay = new THREE.Vector3();

    view.on('mousemove', (event) => {
        mouseRay.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouseRay.y = -(event.clientY / window.innerHeight) * 2 + 1;
        mouseRay.z = 0;

        checkIntersects(mouseRay); 
    });

    function checkIntersects(mouseRay) {
        raycaster.setFromCamera(mouseRay, camera);
        let intersects = raycaster.intersectObjects(scene.children, {recursive: true});
        
        if (intersects[0]) {
            let sorted_intersects = intersects.sort((a, b) => {b.distanceToRay - a.distanceToRay}); // sort intersects by descending order
            let intersect = sorted_intersects[0];

            // console.log(intersect)
            // intersect.object.material.color.set( 0xff0000 );

            let index = intersect.index;
            let datum = points_arr[index];
            
            highlightPoint(datum);
            // showTooltip(mouseRay, datum);
        } else {
            removeHighlights();
            // hideTooltip();
        }
    }

    // 5. Add mouse hover behavior.
    let hoverContainer = new THREE.Object3D()
    scene.add(hoverContainer);

    function highlightPoint(datum) {
        removeHighlights();

        let geo_vertices = [];

        geo_vertices.push(
            new THREE.Vector3(
                datum.x,
                datum.y,
                0
            )
        );

        let geometry = new THREE.BufferGeometry().setFromPoints( geo_vertices );

        let material = new THREE.PointsMaterial({
            size: 26,
            sizeAttenuation: false,
            vertexColors: false,
            map: circle_sprite,
            transparent: true
        });

        let point = new THREE.Points(geometry, material);
        // console.log(point);
        hoverContainer.add(point);
    }

    function removeHighlights() {
        hoverContainer.remove(...hoverContainer.children);
    }

    view.on('mouseleave', () => {
        removeHighlights();
    });

    // // 6. Add tooltip.
    // // Iniitial tooltip state.
    // let tooltip_state = { display: 'none' };
    // console.log(tooltip_state);

    // let $tooltip = document.querySelector("#tooltip");
    // let $pointTip = document.querySelector('#pointTip');

    // function updateTooltip() {
    //     $tooltip.style.display = tooltip_state.display;
    //     $tooltip.style.left = tooltip_state.left + 'px';
    //     $tooltip.style.top = tooltip_state.top + 'px';
    //     $pointTip.innerText = tooltip_state.word;
    //     $pointTip.style.background = '#FAD6A5';
    // }

    // function showTooltip(mouseRay, datum) {
    //     let tooltip_width = 120;
    //     let x_offset = -tooltip_width / 2;
    //     let y_offest = 30;
    //     tooltip_state.display = 'block';
    //     tooltip_state.left = mouseRay[0] + x_offset;
    //     tooltip_state.top = mouseRay[1] + y_offest;
    //     tooltip_state.name = datum.name;
    //     updateTooltip();
    // }

    // function hideTooltip() {
    //     tooltip_state.display = 'none';
    //     updateTooltip();
    // }
});