<script>
    import MoleculeCanvas from "../threeD/MoleculeCanvas.svelte";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {getAtomColor} from "../colors.js";
    import {onMount, onDestroy} from "svelte";

    import {attachCanvas, three, clearThreeScene} from "../threeD/sharedthreejscanvas.js"
    import {makeBallStickDiagram, allAtoms} from "../threeD/ballStickDiagram.js";
    import {andalusiteData} from "../threeD/polymorphdata.js";
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

    async function animate(){
        clearThreeScene();
        let canvas = attachCanvas("threecanvas", "threecanvas");
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);
        window.three = three;
        window.controls = controls;
        window.andalusiteData = andalusiteData;
        window.presentation = presentation;

        let [andalusite, expandalusitebonds] = makeBallStickDiagram(andalusiteData, 2,2,2); //static one
        let [movingAndalusite, expandalusitebonds2] = makeBallStickDiagram(andalusiteData, 1,1,0); //copy which moves to illustrate translations

        let atomLines = new EXP.Array({data: allAtoms(andalusiteData)});
        atomLines.add(new EXP.Transformation({expr: (i,t,x,y,z) => [0,0,0]}))

        presentation.TransitionInstantly(three.camera.position, {x: 0, y:0, z: 40});
        presentation.TransitionInstantly(three.camera, {zoom: 1});
        presentation.TransitionInstantly(three.camera.rotation, {x: 0, y:0, z: 0});
        three.on("update", updateCameraIfNeeded) //todo: remove event listener on onDestroy



        three.scene.add(andalusite)
        three.scene.add(movingAndalusite)

        let cameraRadius = 40;

        await presentation.begin();
        await presentation.nextSlide();

        //dolly in, so the lines seem more parallel
        presentation.ResetTo(three.camera.position, {x: 0, y:0, z: cameraRadius});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:0, z: 0});
        presentation.TransitionTo(three.camera, {zoom: 4});

        await presentation.nextSlide();
        await presentation.nextSlide();

        let cameraVec = EXP.Math.vectorAdd(andalusiteData.aVec, andalusiteData.cVec);
        let pos = EXP.Math.vectorScale(EXP.Math.normalize(cameraVec), cameraRadius);
        window.pos = pos;
        presentation.ResetTo(three.camera.position, {x: pos[0]+1, y:pos[1], z: pos[2]-1});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/4+0.2, z: 0});

        await presentation.nextSlide();

        //made with cameraRadius of 40
        presentation.ResetTo(three.camera.position, {x: 26.5, y: 25.4, z: 16.3});
        presentation.ResetTo(three.camera.rotation, {x: -1.0, y:0.77, z: 0});

        await presentation.nextSlide();
        await presentation.nextSlide();

        //move back to first one
        presentation.ResetTo(three.camera.position, {x: 0, y:0, z: cameraRadius});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:0, z: 0});

        await presentation.nextSlide();

        andalusite.children[0].material.transparent = true;
        andalusite.children[0].material.needsUpdate = true;
        presentation.TransitionTo(andalusite.children[0].material, {opacity: 0.2});


        //TODO: show lines

        await presentation.nextSlide();
        presentation.ResetTo(three.camera.position, {x: 0, y:0, z: cameraRadius});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:0, z: 0});


        await presentation.delay(1000);

        //translate
        let movingVector = andalusiteData.cVec;
        presentation.TransitionTo(movingAndalusite.position, {x: movingVector[0], y: movingVector[1], z: movingVector[2]}, 2000);
        window.movingVector = movingVector;
        window.movingAndalusite = movingAndalusite;

        await presentation.nextSlide();
        //dispatch("chapterEnd");
    }

    let presentation;
    onMount(() => {
        presentation = new EXP.UndoCapableDirector(); 
        animate();
    });
    onDestroy(() => {
        presentation.removeClickables();
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
        pointer-events: none;
    }
    .topThing{
        height:70%;
    }
    .bottomThing{
        height: 30%;
    }
</style>

<div class="overlappingItemContainer exp-text topThing">
    <div class="threecanvascontainer" id="threecanvas" />
    <div id="whitebg" style="opacity: 0"/>
    <div id="overlays" class="overlappingItemContainer">
        <!-- 
        <div class="exp-slide-2">
            <div class="frostedbg">
                Andalusite
            </div>
        </div>
        -->
    </div>
</div>


<div class="overlappingItemContainer bottomThing">
    <div class="exp-slide">
            <div class="frostedbg">
                Let's start by examining the structure of just andalusite for now. Click and drag to rotate the crystal.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                
                As you rotate andalusite and examine it from all angles, you might notice something weird: from certain angles, sometimes the atoms align to let you see straight through andalusite.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                Why does that happen? Let's investigate further.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                The see-through effect also happens here.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                And here.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                So what's causing that see-through effect? What's special about these specific directions?
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                Let's go back to the first example we found of see-through-ness. What's going on here? 
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                (show lines)
                When we see the see-through effect, the atoms almost seem to make lines, radiating outwards from the center point, like a tunnel.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                But if we look from another angle, those lines are actually all parallel, moving in the same direction.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                This helps us see what's going on: when the atoms line up, it means that in the direction we're looking, every atom lines up with another atom along that direction.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
               This gives us a more precise way to think about this "line effect": it happens because if we took the entire crystal and moved it in the direction we were looking, every moved atom would line up with another atom in the original crystal.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                This line of thinking focuses more on the action: this "tunnel effect" happens whenever the crystal could be moved in a direction, where the movement keeps the crystal looking the same before and after.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                For crystals, thinking about <b>actions</b> makes understanding the "see-through" effect a lot easier. Instead of focusing on millions of atoms, we can focus on one action: movement in a certain direction.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                Interestingly, this way of thinking about the crystal is less focused on the crystal itself, and more focused on <b>actions which leave the crystal unchanged</b>. Focusing on actions instead of objects, verbs instead of nouns, is one of the key ideas of group theory.
            </div>
    </div>
    
    <div class="exp-slide">
                what about this directoin? 
    </div>
    <div class="exp-slide">
                same thing: the crystal stays the same if you translate in this direction.
    </div>

    <div class="exp-slide">
                what about direction 3? 
    </div>
    <div class="exp-slide">
                yup.
    </div>
    <div class="exp-slide">
               but interestingly, this translation is the same as translatoin 1 then translation 2
    </div>
    <div class="exp-slide">
                so:
                    - we can understand crystals by looking at "the actions which leave it unchanged"
                    - combining two of those actions gives you another action
                these are two of the four tenets of group theory!
    </div>
    <div class="exp-slide">
                to illustrate this, let's take a break from crystals, and move to a simpler example.
    </div>
</div>
