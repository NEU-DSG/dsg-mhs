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

    let width = window.innerWidth,
        height = window.innerHeight;

    // Get unique subjects from data array.
    let subjects = [...new Set(data.map(d => d.subject))];

    let colorScale = d3.scaleOrdinal()
        .domain(subjects)
        .range(d3.schemePaired);
    

    // Style settings.
    let node_color = '#fad6a5';
    let node_size = 0.2;
    let focused_node_color = '#91f3b6';
    let focused_node_size = 35;

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

    // Set camera to center on scatter plot.
    camera.position.set(4, 3, 80);

    // Scene.
    let scene = new THREE.Scene();

    // Window Resizing.
    window.addEventListener('resize', onWindowResize, false);

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix;
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Data Points (build geometry for each point).
    const color = new THREE.Color();
    const geometries = [];

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
        vertex.color = colorScale(d.subject);

        // let color = colorScale(d.subject);

        const geometry = new THREE.BufferGeometry().setFromPoints( vertex );
        
        // geometry.setAttribute('color', color); // causing error?
        
        geometries.push(geometry);
    });

    // Merge geometries.
    const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
    console.log(geometries);
    console.log(mergedGeometry);

    // Material.
    let circle_sprite = new THREE.TextureLoader().load(
        "https://fastforwardlabs.github.io/visualization_assets/circle-sprite.png"
    );

    const material = new THREE.PointsMaterial({
        name: true,
        size: node_size,
        map: circle_sprite,
        vertexColors: true,
        sizeAttenuation: true,
    });

    // Mesh (geometries + material).
    const mesh = new THREE.Mesh(mergedGeometry, material);
    scene.add(mesh);
    // let points_arr = [];

    // data.forEach( (d, i) => {
    //     let vertex = new THREE.Vector3(
    //         d.x,
    //         d.y,
    //         0,
    //     );
    //     vertex.index = i;
    //     vertex.entry = d.entry;
    //     vertex.date = d.date;
    //     vertex.subject = d.subject;

    //     // let col = colorScale(d.subject).replace('#', '0x')
    //     // // console.log('hex:', col);

    //     // var c = new THREE.Color();

    //     // // c.set(col);
    //     // vertex.color.set(col);

    //     points_arr.push(vertex);
    // });

    // // Geometry.
    // let nodeGeometry = new THREE.BufferGeometry().setFromPoints( points_arr );

    // // Material.
    // let circle_sprite = new THREE.TextureLoader().load(
    //     "https://fastforwardlabs.github.io/visualization_assets/circle-sprite.png"
    // );

    // let nodeMaterial = new THREE.PointsMaterial({
    //     name: true,
    //     size: node_size,
    //     map: circle_sprite,
    //     // vertexColors: true,
    //     color: true,
    //     sizeAttenuation: true,
    // });

    // // Combine geometry & material, then add points to scene.
    // let points = new THREE.Points(nodeGeometry, nodeMaterial);
    // scene.add(points);

    // Set up zoom behavior.
    let zoom = d3.zoom()
        .scaleExtent([10, 80])
        .on('zoom', (event) => {
            if (event.sourceEvent) {

                // Get z from d3.
                let new_z = event.transform.k;

                if (new_z !== camera.position.z) {

                    // Handle a zoom event
                    let {clientX, clientY} = event.sourceEvent;

                    // Project a vector from current mouse position and zoom level.
                    // Find the x and y coordinates for  where that vector intersects the new zoom level.
                    // Code from WestLangley https://stackoverflow.com/questions/13055214/mouse-canvas-x-y-to-three-js-world-x-y-z/13091694#13091694
                    let vector = new THREE.Vector3(
                        clientX / width * 2 - 1,
                        - (clientY / height) * 2 + 1,
                        0.5
                    );
                    vector.unproject(camera);
                    let dir = vector.sub(camera.position).normalize();
                    let distance = (new_z - camera.position.z) / dir.z;
                    let pos = camera.position.clone().add(dir.multiplyScalar(distance));

                    // Set the camera to new coordinates
                    camera.position.set(pos.x, pos.y, new_z);

                } else {

                    // Handle panning.
                    let { movementX, movementY } = event.sourceEvent;

                    // Adjust mouse movement by current scale and set camera.
                    let current_scale = getCurrentScale();
                    camera.position.set(camera.position.x - movementX / current_scale, 
                        camera.position.y + movementY / current_scale, 
                        camera.position.z);
                }
            }
        });

    // From https://github.com/anvaka/three.map.control, used for panning
    function getCurrentScale() {
        var vFOV = camera.fov * Math.PI / 180
        var scale_height = 2 * Math.tan( vFOV / 2 ) * camera.position.z
        var currentScale = height / scale_height
        return currentScale
    }

    let view = d3.select(renderer.domElement);
    view.call(zoom);

    function render() {
        requestAnimationFrame(render);
        renderer.render(scene, camera);
    }

    window.requestAnimationFrame(render);

    // function onMouseMove (event) {
    //     mouseRay.x = (event.x / window.innerWidth) * 2 - 1;
    //     mouseRay.y = -(event.y / window.innerHeight) * 2 + 1;
    //     mouseRay.z = 0.5;
    // };

    // window.addEventListener('mouseMove', onMouseMove, false );

    // 4. Find point intersects with mouse.
    // let raycaster = new THREE.Raycaster();
    // raycaster.params.Points.threshold = 1;


    // Raycaster.
    const mouseRay = new THREE.Vector3();
    // const raycaster = new THREE.Raycaster();
    // raycaster.params.Points.threshold = 1;

    view.on('mousemove', (event) => {
        camera.updateMatrixWorld();

        mouseRay.x = (event.x / window.innerWidth) * 2 - 1;
        mouseRay.y = -(event.y / window.innerHeight) * 2 + 1;
        mouseRay.z = 0.5;
        
        // checkIntersects(mouseRay); 
    });

    function checkIntersects(mouseRay) {
        // raycaster.setFromCamera(mouseRay, camera);
        // let intersects = raycaster.intersectObjects(scene.children, {recursive: true});
        
        mouseRay.unproject(camera);
        var ray = new THREE.Raycaster(camera.position, mouseRay.sub(camera.position).normalize());
        var intersects = ray.intersectObjects(scene.children);

        if (intersects[0]) {
            let sorted_intersects = intersects.sort((a, b) => {b.distanceToRay - a.distanceToRay}); // sort intersects by descending order
            let intersect = sorted_intersects[0];
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