'use strict'

// https://threejsfundamentals.org/threejs/lessons/threejs-fundamentals.html
function main() {
    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGL1Renderer({canvas});
    const fov = 75; // field of view
    const aspect = 2; // display aspect of canvas
    const near = 0.1; // space in front of camera that will be rendered.
    const far = 5; // space behind camera clipped (removed) from view.
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.z = 2; // Camera defaults to looking down the -Z axis with +Y up.

    // Scene with light.
    const scene = new THREE.Scene();
    {
        const color = 0xffffff;
        const intensity = 1;
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.set(-1, 2, 4);
        scene.add(light);
    }
    // Box geometry: contains the data for a box.
    const boxWidth = 1;
    const boxHeight = 1;
    const boxDepth = 1;
    const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

    // Create basic material and set its color.
    // Mesh in three represents three things: geometry (shape), material (details), position (orientation & scale).
    // Function that creates new materials.
    function makeInstance(geometry, color, x) {
        const material = new THREE.MeshPhongMaterial({color}); // phongMaterial is affected by light; basicMaterial is not.
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        cube.position.x = x;
        return cube;
    };

    // Call it three times with different colors and x-positions.
    const cubes = [
        makeInstance(geometry, 0x44aa88, 0),
        makeInstance(geometry, 0x8844aa, -2),
        makeInstance(geometry, 0xaa8844, 2),
    ];

    // Resize function to fix blockiness of cubes.
    function resizeRendererToDisplaySize(renderer) {
        const canvas = renderer.domElement;
        const pixelRatio = window.devicePixelRatio; // 
        const width = canvas.clientWidth * pixelRatio | 0;
        const height = canvas.clientHeight * pixelRatio | 0;
        const needResize = canvas.width !== width || canvas.height !== height; // Boolean to check if resize needed.
        if (needResize) {
            renderer.setSize(width, height, false); // pass new width, height if true. 
        }
        return needResize;
    }

    // Animate cube by spinning it with render loop (requestAnimationFrame).
    function render(time) {
        time *= 0.001; // convert time to senconds

        // Update canvas to fit browser size (removes distortion at ends of x)
        if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        }

        // Render cubes at slightly different rotations.
        cubes.forEach((cube, ndx) => {
            const speed = 1 + ndx * .1;
            const rot = time * speed;
            cube.rotation.x = rot;
            cube.rotation.y = rot;
        });
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    };
    requestAnimationFrame(render); // starts loop by calling function render.
}

main();