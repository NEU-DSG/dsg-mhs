'use strict'

// https://threejsfundamentals.org/threejs/lessons/threejs-scenegraph.html

function main() {
    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGL1Renderer({canvas});

    // Camera
    const fov = 40; // field of view
    const aspect = 2; // display aspect of canvas
    const near = 0.1; // space in front of camera that will be rendered.
    const far = 1000; // space behind camera clipped (removed) from view.
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 50, 0);
    camera.up.set(0, 0, 1); // Tell the camera which way to face by saying where up is (positive Z value)
    camera.lookAt(0, 0, 0);

    // Scene
    const scene = new THREE.Scene();
    {
        const color = 0xfffff;
        const intensity = 3;
        const light = new THREE.PointLight(color, intensity);
        scene.add(light);
    }

    // an array of objects whose rotation updates
    const objects = [];

    // use just one sphere for everything
    const radius = 1;
    const widthSegments = 6;
    const heightSegments = 6;
    const sphereGeometry = new THREE.SphereGeometry(
        radius, widthSegments, heightSegments);

    // Build solar system (parent of sun & earth).
    const solarSystem = new THREE.Object3D(); // Object3D represents local space; has no material or geometry.
    scene.add(solarSystem);
    objects.push(solarSystem);
    
    // Build the sun.
    const sunMaterial = new THREE.MeshPhongMaterial( {emissive: 0xffff00} );
    const sunMesh = new THREE.Mesh(sphereGeometry, sunMaterial);
    sunMesh.scale.set(5, 5, 5); // large, scale.set changes dimensions set in SphereGeometry.
    solarSystem.add(sunMesh);
    objects.push(sunMesh)

    // Build earth orbit.
    const earthOrbit = new THREE.Object3D();
    earthOrbit.position.x = 10;
    solarSystem.add(earthOrbit);
    objects.push(earthOrbit);

    // Build the earth.
    const earthMaterial = new THREE.MeshPhongMaterial({color: 0x2233ff, emissive: 0x112244 });
    const earthMesh = new THREE.Mesh(sphereGeometry, earthMaterial);
    earthOrbit.add(earthMesh);
    objects.push(earthMesh);

    // Build the moon orbit.
    const moonOrbit = new THREE.Object3D();
    moonOrbit.position.x = 2;
    earthOrbit.add(moonOrbit);

    // Build the moon.
    const moonMaterial = new THREE.MeshPhongMaterial({color: 0x888888, emissive: 0x222222});
    const moonMesh = new THREE.Mesh(sphereGeometry, moonMaterial);
    moonMesh.scale.set(.5, .5, .5);
    moonOrbit.add(moonMesh);
    objects.push(moonMesh);
    

    function resizeRendererToDisplaySize(renderer) {
        const canvas = renderer.domElement;
        const pixelRatio = window.devicePixelRatio;
        const width = canvas.clientWidth * pixelRatio | 0;
        const height = canvas.clientHeight * pixelRatio | 0;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            renderer.setSize(width, height, false);
        }
        return needResize;
    }

    function render(time) {
        time *= 0.001; //convert time to seconds.

        if (resizeRendererToDisplaySize(renderer)) {
            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }

        // Rotate all objects.
        objects.forEach((obj) => {
            obj.rotation.y = time;
        });

        // Add axeshelper.
        objects.forEach((node) => {
            const axes = new THREE.AxesHelper();
            axes.material.depthTest = false; // don't check if material's are drawing behind something
            axes.renderORder = 1; // draw after all the spheres.
            node.add(axes);
        })

        renderer.render(scene, camera);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render); // start loop
}

main();