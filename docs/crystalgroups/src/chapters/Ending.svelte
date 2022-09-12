<script>
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {getAtomColor, aVecColor, bVecColor, cVecColor, aPlusCVecColor} from "../colors.js";
    import {onMount, onDestroy, tick} from "svelte";

    import {attachCanvas, three, clearThreeScene} from "../threeD/sharedthreejscanvas.js"
    import {makeBallStickDiagram, allAtoms, getSymmetryClones} from "../threeD/ballStickDiagram.js";
    import {andalusiteData} from "../threeD/polymorphdata.js";

    import D3Group from "../twoD/D3Group.svelte";

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

    let controls;

    let lastZoom = 1;
    function updateCameraIfNeeded(){
        if(three.camera.zoom != lastZoom){
            three.camera.updateProjectionMatrix();
            lastZoom = three.camera.zoom;
        }
    }

    let bigandalusite = {rotation: {x:0}};
    async function animate(){
        clearThreeScene();
        let canvas = attachCanvas("threecanvas", "threecanvas");
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);
        controls.enableKeys = false;

        let [andalusite, expandalusitebonds] = makeBallStickDiagram(andalusiteData, 1,1,1); //static one
        bigandalusite = andalusite;
        three.scene.add(andalusite)
        bigandalusite.rotation.y += 0.3;
    }

    let objects = [];
    function updateObjects(time){
        objects.forEach(item => item.activate(time.dt))
        bigandalusite.rotation.y += time.delta / 100;
    }

    let alreadyEnding=false;
    onMount(async () => {
        three.on("update", updateObjects);
        await tick();
        animate();
    });
    onDestroy(() => {
        alreadyEnding = true;
        controls.dispose();
        three.removeEventListener("update", updateObjects)
    });

    let slideStart = 1;
</script>

<style>
    #whitebg{
        background-color: white;
        transition: opacity 0.5s ease-in-out;
        pointer-events: none;
        z-index: 1;
    }
    #overlays{
        z-index: 2;
    }
    .grouptime{
        position:absolute;
        top:0;
        left:20em;
        transform: scale(0.5);
    }
    .thinmargin{
        width: 22em;
        padding: 0.2em;
        margin: 0 auto;
    }
</style>

<div class="overlappingItemContainer fullscreen">
    <div>
        <div class="threecanvascontainer column" id="threecanvas" />
    </div>

    <div id="overlays" class="overlappingItemContainer noclick">
        <div style="margin: 0 5% 0; width: 90%;">
            <br />
            <div class="frostedbg thinmargin">
                <h1>Crystal Clear Conundrums</h1>
                 A Multifaceted Intro to Group Theory
                <br>
                <aside>August 2022</aside>
                <br><br>
                Thanks so much for reading!
            </div>

            <br /><br /><br /><br /><br />

            <div class="twocolumnsLeftBigger frostedbg yesclick" style="gap: 1em;">
                <div class="column">
                    More Explanaria
                    <br><br>
                    <aside>
                        <div class="twocolumns">
                            <a href="https://explanaria.github.io/impossibletriangles/1" data-goatcounter-click="crystalgroups-to-impossibletriangles">The Case of the Impossible Triangles</a>
                            <a href="https://explanaria.github.io/thinking4D/1%20R3.html" data-goatcounter-click="crystalgroups-to-4D">How Mathematicians Think About Four Dimensions</a>
                        </div>
                        <br><a href="https://explanaria.github.io/" data-goatcounter-click="impossibletriangles-to-home">All Articles</a>
                    </aside>
                </div>
                <div class="column" style="text-align: center">
                    <aside>
                        <form action="https://tinyletter.com/explanaria" method="post" target="popupwindow" onsubmit="window.open('https://tinyletter.com/explanaria', 'popupwindow', 'scrollbars=yes,width=800,height=600');return true">
                            <label for="tlemail">
                                Get notified about new interactive math explanations as soon as they release!</label>
                            <br>
                            
                            <p><input type="text" class="emailbox" name="email" id="tlemail" placeholder="Your email address" /></p><input type="hidden" value="1" name="embed"/>
                            <input type="submit" class="emailbtn" value="Subscribe" />
                        </form>

                    </aside>
                </div>
            </div>
        </div>
    </div>
</div>
