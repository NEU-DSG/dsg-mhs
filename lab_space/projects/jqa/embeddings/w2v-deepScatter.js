'use strict'

// https://manu.ninja/webgl-three-js-annotations/
// https://codepen.io/Lorti/pen/Vbppap/

// https://threejsfundamentals.org/threejs/lessons/threejs-canvas-textures.html


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
    // Style settings.
    const node_color = '#fad6a5';
    const node_size = 0.3;
    const focused_node_color = '#91f3b6';
    const focused_node_size = 35;

    // Build canvas.
    const canvas = document.getElementById('w2v-scatterplot');

    // Renderer.
    const renderer = new THREE.WebGL1Renderer({canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Camera.
    const fov = 10;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 1;
    const far = 80;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    // Scene.
    const scene = new THREE.Scene();

    // Window Resizing.
    window.addEventListener("resize", onWindowResize, false);

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Data Points.
    const points_arr = [];

    data.forEach( (d, i) => {
        const vertex = new THREE.Vector3(
            d.x, 
            d.y,
            0
        );
        vertex.index = i;
        vertex.word = d.word;
        points_arr.push(vertex);
    });

    // Geometry
    let nodeGeometry = new THREE.BufferGeometry().setFromPoints( points_arr );

    // Material
    let circle_sprite = new THREE.TextureLoader().load(
        "https://fastforwardlabs.github.io/visualization_assets/circle-sprite.png"
    )

    let nodeMaterial = new THREE.PointsMaterial({
        name: true,
        size: node_size, 
        map: circle_sprite,
        transparent: true,
        color: node_color,
        sizeAttenuation: true,
    });

    // Combine geometry & material, then add points to scene.
    const points = new THREE.Points(nodeGeometry, nodeMaterial);
    scene.add(points);

    // Add zoom & panning controls.
    function zoomHandler(d3_transform) {
        let scale = d3_transform.k;
        let x = -(d3_transform.x - window.innerWidth / 2) / scale;
        let y = (d3_transform.y - window.innerHeight / 2) / scale;
        let z = getZfromScale(scale);
        camera.position.set(x, y, z);
    }

    function getScaleFromZ(camera_z_position) {
        let half_fov = fov / 2;
        let half_fov_radians = toRadians(half_fov);
        let half_fov_height = Math.tan(half_fov_radians) * camera_z_position;
        let fov_height = half_fov_height * 2;
        let scale = window.innerHeight / fov_height; // Divide vis. height by height derived from fov.
        return scale;        
    }

    function getZfromScale(scale) {
        let half_fov = fov / 2;
        let half_fov_radians = toRadians(half_fov);
        let scale_height = window.innerHeight / scale;
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
        var initial_transform = d3.zoomIdentity.translate(window.innerWidth / 2, window.innerHeight / 2).scale(initial_scale);
        zoom.transform(view, initial_transform);
        camera.position.set(0, 0, far);
    }
    setUpZoom();

    // Render visualization.
    function updateScreenPosition() {
        const vector = new THREE.Vector3();
        const canvas = renderer.domElement;

        vector.project(camera);

        vector.x = Math.round((0.5 + vector.x / 2) * (canvas.width / window.devicePixelRatio));
        vector.y = Math.round((0.5 - vector.y / 2) * (canvas.height / window.devicePixelRatio)); 
    }

    function render() {
        requestAnimationFrame(render);
        renderer.render(scene, camera);
        updateScreenPosition();
    }

    render();

    // 4. Find point intersects with mouse.
    let raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 1;

    const mouseRay = new THREE.Vector3();
    mouseRay.project(camera);

    view.on('mousemove', (event) => {
        points.updateMatrixWorld();

        mouseRay.x = (event.x / window.innerWidth) * 2 - 1;
        mouseRay.y = -(event.y / window.innerHeight) * 2 + 1;
        mouseRay.z = 0;
        
        checkIntersects(mouseRay); 
    });

    function checkIntersects(mouseRay) {
        raycaster.setFromCamera(mouseRay, camera);
        let intersects = raycaster.intersectObjects(scene.children, {recursive: true});
        
        if (intersects[0]) {
            let sorted_intersects = intersects.sort((a, b) => {b.distanceToRay - a.distanceToRay}); // sort intersects by descending order
            let intersect = sorted_intersects[0];
            // intersect.object.material.color.set( 0xff0000 );

            let index = intersect.index;
            let datum = points_arr[index];

            // console.log(datum);
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
            size: focused_node_size,
            sizeAttenuation: false,
            color: focused_node_color,
            map: circle_sprite,
            transparent: true
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
});

//     // // 6. Add tooltip.
//     // // Iniitial tooltip state.
//     // let tooltip_state = { display: 'none' };
//     // console.log(tooltip_state);

//     // let $tooltip = document.querySelector("#tooltip");
//     // let $pointTip = document.querySelector('#pointTip');

//     // function updateTooltip() {
//     //     $tooltip.style.display = tooltip_state.display;
//     //     $tooltip.style.left = tooltip_state.left + 'px';
//     //     $tooltip.style.top = tooltip_state.top + 'px';
//     //     $pointTip.innerText = tooltip_state.word;
//     //     $pointTip.style.background = '#FAD6A5';
//     // }

//     // function showTooltip(mouseRay, datum) {
//     //     let tooltip_width = 120;
//     //     let x_offset = -tooltip_width / 2;
//     //     let y_offest = 30;
//     //     tooltip_state.display = 'block';
//     //     tooltip_state.left = mouseRay[0] + x_offset;
//     //     tooltip_state.top = mouseRay[1] + y_offest;
//     //     tooltip_state.name = datum.name;
//     //     updateTooltip();
//     // }

//     // function hideTooltip() {
//     //     tooltip_state.display = 'none';
//     //     updateTooltip();
//     // }