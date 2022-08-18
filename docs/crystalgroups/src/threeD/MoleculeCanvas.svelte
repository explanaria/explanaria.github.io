<script type="module">
    import {kyaniteData, andalusiteData, sillimaniteData} from "./polymorphdata.js";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";

    import {onMount, onDestroy} from "svelte";
    import {attachCanvas, three, clearThreeScene} from "./sharedthreejscanvas.js";

    import {makeBallStickDiagram} from "./ballStickDiagram.js";


    let controls, fps=0;

    onMount(() => {  
        console.log("starting moleculecanvas")
        let canvas = attachCanvas("threecanvas", "threecanvas")
        clearThreeScene();

        window.three = three;
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);
        controls.enableKeys = false;


        three.camera.position.z = 40;
        //three.camera.zoom = 10;


        
        let [kyanite, expkyanitebonds] = makeBallStickDiagram(kyaniteData, 2,2,2);
        three.scene.add(kyanite)
        kyanite.position.x -= 4*5;
        kyanite.position.y -= 8;


        let [andalusite, expandalusitebonds] = makeBallStickDiagram(andalusiteData, 2,2,2);
        three.scene.add(andalusite)
        andalusite.position.x += 4*5;
        andalusite.position.y -= 8;


        three.on("update", (data) => {fps = Math.round(1/data.realtimeDelta)})
        /*
        var color = 0xFFFFFF;  // white
          var near = 20;
          var far = 25;
        three.scene.fog = new THREE.Fog(color, near, far);*/
    })
    /* todo: onDestroy() */
    onDestroy(() => {
        controls.dispose();
    })

</script>


<!-- <div style:position="absolute" style:top="0%" style:right="0%" style:text-align="right">Fps: {fps}</div> -->
<div class="threecanvascontainer" id="threecanvas" /> <!-- three.hs canvas attached here -->
