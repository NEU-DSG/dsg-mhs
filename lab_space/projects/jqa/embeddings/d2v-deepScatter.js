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

d3.csv('data/jqa-d2v-umap.txt', type).then(data => {
    console.log(data);

    // Get unique subjects from data array.
    let subjects = [...new Set(data.map(d => d.subject))];

    let colorScale = d3.scaleOrdinal()
        .domain(subjects)
        .range(d3.schemePaired);

    // Style settings.
    // let node_color = '#fad6a5';
    let node_size = 0.2;

    // Build canvas.
    let canvas = document.getElementById('d2v');

    // Renderer.
    let renderer = new THREE.WebGLRenderer({canvas, antialia: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Camera.
    let fov = 10;
    let aspect = window.innerWidth / window.innerHeight;
    let near = 1;
    let far = 80;
    let camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    // Scene.
    let scene = new THREE.Scene();

    // Window Resizing.
    window.addEventListener('resize', onWindowResize, false);

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix;
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Data Points.
    let points_arr = [];

    data.forEach( (d, i) => {
        let vertex = new THREE.Vector3(
            d.x,
            d.y,
            0,
        );
        vertex.index = i;
        vertex.entry = d.entry;
        vertex.date = d.date;
        vertex.subject = d.subject;
        vertex.color = new THREE.Color(colorScale(d.subject));
        points_arr.push(vertex);
    });

    // Geometry.
    let nodeGeometry = new THREE.BufferGeometry().setFromPoints( points_arr );

    // Material.
    let circle_sprite = new THREE.TextureLoader().load(
        "https://fastforwardlabs.github.io/visualization_assets/circle-sprite.png"
    );

    let nodeMaterial = new THREE.PointsMaterial({
        name: true,
        size: node_size,
        map: circle_sprite,
        // vertexColors: true,
        // color: true,
        sizeAttenuation: true,
    });

    // Combine geometry & material, then add points to scene.
    let points = new THREE.Points(nodeGeometry, nodeMaterial);
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
        let scale = window.innerHeight / fov_height;
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
        let vector = new THREE.Vector3();
        let canvas = renderer.domElement;

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
});