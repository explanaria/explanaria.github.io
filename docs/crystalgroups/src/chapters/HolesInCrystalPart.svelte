<script>
    import MoleculeCanvas from "../threeD/MoleculeCanvas.svelte";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {getAtomColor, chapter2linecolor, chapter2linecolor2, chapter2linecolor3} from "../colors.js";
    import {onMount, onDestroy} from "svelte";

    import {attachCanvas, three, clearThreeScene} from "../threeD/sharedthreejscanvas.js"
    import {makeBallStickDiagram, allAtoms, getSymmetryClones} from "../threeD/ballStickDiagram.js";
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
        let [movingAndalusite2, expandalusitebonds22] = makeBallStickDiagram(andalusiteData, 1,1,0); //copy which moves to illustrate translations
        movingAndalusite.children[0].material.transparent = true;
        movingAndalusite.children[0].material.needsUpdate = true;
        presentation.TransitionInstantly(movingAndalusite.children[0].material, {opacity: 0});

        movingAndalusite2.children[0].material.transparent = true;
        movingAndalusite2.children[0].material.needsUpdate = true;
        presentation.TransitionInstantly(movingAndalusite2.children[0].material, {opacity: 0});

        movingAndalusite2.position.copy(new THREE.Vector3(...andalusiteData.cVec)).multiply(andalusite.scale);

        window.andalusite = andalusite;
        window.movingAndalusite2 = movingAndalusite2;

        //lines pointing in a direction
        let atomsWithLines = andalusiteData.atoms["Si"]; //allAtoms(andalusiteData); //todo: just oxygens?
        atomsWithLines = atomsWithLines.reduce((total, newAtom) => total.concat(
            getSymmetryClones(newAtom, andalusiteData, 2, 2, 0)
        ), []);

        let atomLines = new EXP.Area({bounds: [[0, atomsWithLines.length-1], [0,1]], numItems: [atomsWithLines.length, 2]});
        let atomLinesOutput = new EXP.LineOutput({color: chapter2linecolor, opacity: 0});

        let lineData = {direction: EXP.Math.vectorScale(andalusiteData.cVec, -2)};
        atomLines.add(new EXP.Transformation({expr: (i,t, lineNumber, isEnd) => 
                isEnd == 0 ? 
                EXP.Math.vectorAdd(atomsWithLines[Math.round(lineNumber)], EXP.Math.vectorScale(lineData.direction, 1)) : 
                EXP.Math.vectorAdd(atomsWithLines[Math.round(lineNumber)], EXP.Math.vectorScale(lineData.direction, -1))
        }))
        .add(new EXP.Transformation({expr: (i,t, x,y,z) => 
                //scale to match andalusite
                [x*andalusite.scale.x,y*andalusite.scale.y,z*andalusite.scale.z]
        })).add(atomLinesOutput);
        objects.push(atomLines);

        window.atomLinesOutput = atomLinesOutput;
        atomLinesOutput.material.depthTest = false; //appear over the crystal

        presentation.TransitionInstantly(three.camera.position, {x: 0, y:0, z: 40});
        presentation.TransitionInstantly(three.camera, {zoom: 1});
        presentation.TransitionInstantly(three.camera.rotation, {x: 0, y:0, z: 0});
        three.on("update", updateCameraIfNeeded) //todo: remove event listener on onDestroy



        three.scene.add(andalusite)
        three.scene.add(movingAndalusite)
        three.scene.add(movingAndalusite2)

        let cameraRadius = 40;

        await presentation.begin();
        await presentation.nextSlide();

        //dolly in, so the lines seem more parallel
        presentation.ResetTo(three.camera.position, {x: 0, y:0, z: cameraRadius});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:0, z: 0});
        presentation.TransitionTo(three.camera, {zoom: 4});

        await presentation.nextSlide();
        await presentation.nextSlide();

        //no effect here
        presentation.ResetTo(three.camera.position, {x: 16, y:0, z: 26});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:0.4, z: 0});

        await presentation.nextSlide();

        //yup, effect here
        let secondSeeThroughVec = EXP.Math.vectorAdd(andalusiteData.aVec, andalusiteData.cVec);
        let diagonalCameraPos = EXP.Math.vectorScale(EXP.Math.normalize(secondSeeThroughVec), cameraRadius);
        presentation.ResetTo(three.camera.position, {x: diagonalCameraPos[0]+1, y:diagonalCameraPos[1], z: diagonalCameraPos[2]-1});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/4+0.2, z: 0});

        await presentation.nextSlide();

        let thirdSeeThroughVec = andalusiteData.aVec;
        let aVecCameraPos = EXP.Math.vectorScale(EXP.Math.normalize(thirdSeeThroughVec), cameraRadius);
        presentation.ResetTo(three.camera.position, {x: aVecCameraPos[0], y:aVecCameraPos[1], z: aVecCameraPos[2]});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/2, z: 0});

        await presentation.nextSlide();

        //third diagonal angle

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
        presentation.TransitionTo(expandalusitebonds.getDeepestChildren()[0], {opacity: 0.2});


        //show lines
        await presentation.delay(1000);
        presentation.TransitionTo(atomLinesOutput, {opacity: 1});

        await presentation.nextSlide();

        presentation.ResetTo(three.camera.position, {x: cameraRadius, y:0, z: 0});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/2, z: 0});

        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();

        presentation.TransitionTo(andalusite.position, {y: 100}, 2000);
        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 1}, 250);
        presentation.TransitionTo(movingAndalusite2.children[0].material, {opacity: 1}, 250);

        await presentation.nextSlide();

        //translate
        let firstMovingVector = andalusiteData.cVec;
        presentation.TransitionTo(movingAndalusite.position, {x: firstMovingVector[0] * andalusite.scale.x, y: firstMovingVector[1]* andalusite.scale.y, z: firstMovingVector[2] * andalusite.scale.z}, 2000);
        window.firstMovingVector = firstMovingVector;
        window.movingAndalusite = movingAndalusite;

        await presentation.nextSlide();

        
        presentation.TransitionTo(movingAndalusite2.children[0].material, {opacity: 0}, 250);
        presentation.TransitionTo(expandalusitebonds22.getDeepestChildren()[0], {opacity: 0}, 250);
        
        presentation.TransitionTo(atomLinesOutput, {opacity: 0}, 500);

        presentation.TransitionTo(andalusite.position, {y: 0}, 1000); //return from the heavens

        await presentation.delay(1000);

        presentation.ResetTo(three.camera.position, {x: diagonalCameraPos[0]+1, y:diagonalCameraPos[1], z: diagonalCameraPos[2]-1});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/4+0.2, z: 0});

        presentation.TransitionTo(lineData, {direction: secondSeeThroughVec});
        await presentation.nextSlide();

        presentation.TransitionInstantly(atomLinesOutput, {color: chapter2linecolor2});
        presentation.TransitionTo(atomLinesOutput, {opacity: 0.9});

        let secondMovePos = EXP.Math.vectorAdd(firstMovingVector, EXP.Math.vectorScale(secondSeeThroughVec, -1));

        presentation.TransitionTo(movingAndalusite.position, {x: secondMovePos[0] * andalusite.scale.x, y: secondMovePos[1]* andalusite.scale.y, z: secondMovePos[2] * andalusite.scale.z}, 2000);

        await presentation.nextSlide();

        //move to third see through hole

        presentation.ResetTo(three.camera.position, {x: aVecCameraPos[0], y:aVecCameraPos[1], z: aVecCameraPos[2]});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/2, z: 0});
        presentation.TransitionTo(atomLinesOutput, {opacity: 0});

        //aand move crystal!
        await presentation.nextSlide();

        presentation.TransitionInstantly(lineData, {direction: thirdSeeThroughVec});
        presentation.TransitionInstantly(atomLinesOutput, {color: chapter2linecolor3});
        presentation.TransitionTo(atomLinesOutput, {opacity: 0.9});

        let thirdMovePos = EXP.Math.vectorAdd(secondMovePos, thirdSeeThroughVec);
        presentation.TransitionTo(movingAndalusite.position, {x: thirdMovePos[0] * andalusite.scale.x, y: thirdMovePos[1]* andalusite.scale.y, z: thirdMovePos[2] * andalusite.scale.z}, 2000);
        await presentation.nextSlide();

        //'we now have 3 movements'
        presentation.TransitionTo(atomLinesOutput, {opacity: 0});
        
        presentation.TransitionTo(movingAndalusite2.children[0].material, {opacity: 0}, 250);
        presentation.TransitionTo(expandalusitebonds22.getDeepestChildren()[0], {opacity: 0}, 250);
        
        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 0}, 250);
        presentation.TransitionTo(expandalusitebonds2.getDeepestChildren()[0], {opacity: 0}, 250);

        //show 3 vectors representing each movement
        let atomStartPos = [0,0,0];
        let vec1 = new EXP.Array({data: [atomStartPos, atomStartPos]})
        let translationRepresentation1 = new EXP.VectorOutput({color: chapter2linecolor, opacity: 1});
        vec1.add(new EXP.Transformation({expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], firstMovingVector)})).add(translationRepresentation1);

        let vec2 = vec1.clone();
        vec2.children[0].expr = (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], secondSeeThroughVec);
        vec2.getDeepestChildren()[0].color = chapter2linecolor2;

        let vec3 = vec1.clone();
        vec3.children[0].expr = (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], thirdSeeThroughVec);
        vec3.getDeepestChildren()[0].color = chapter2linecolor3;
        window.vec1 = vec1; window.vec2 = vec2; window.vec3 = vec3;

        objects = objects.concat(vec1, vec2, vec3);

        if(!alreadyEnding){
            //dispatch("chapterEnd");
        }
    }

    let objects = [];
    function updateObjects(time){
        objects.forEach(item => item.activate(time.dt))
    }

    let presentation, alreadyEnding=false;
    onMount(async () => {
        three.on("update", updateObjects);
        presentation = new EXP.UndoCapableDirector();
        animate();
    });
    onDestroy(() => {
        alreadyEnding = true;
        presentation.rushThroughRestOfPresentation();
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
                The see-through effect doesn't happen at all angles. Just a bunch of disordered atoms here.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                But it does happen here.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                And here.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                Up here too.
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
                This helps us see what's going on: when there's a see-through effect, it means that in the direction we're looking, every atom lines up with another atom along that direction. Great!
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                But we can be even more precise than that. It's hard to keep track of millions of atoms, but the same thing happens to all of them: lining up in a given direction. One of the key lessons of group theory is that instead of thinking about objects, it can sometimes be simpler to think about <b>actions</b>.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                Let me clear up some of this clutter really quick and I'll show you what I mean.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
               We can be more precise if we talk about <b>moving</b>. The "see-through" effect happens in a certain direction if, when we take the entire crystal and <b>move</b> it in the direction we were looking, every moved atom would line up with another atom in the original crystal.
            </div>
    </div>
    
    <div class="exp-slide">
            <div class="frostedbg">
                What about this other direction where we saw a see-through effect?
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                Same thing: a see-through effect shows us that <b>moving</b> the crystal in this direction will keep the atoms in places where other atoms are.
            </div>
    </div>

    <div class="exp-slide">
            <div class="frostedbg">
                And the third see-through effect we saw? 
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                Yup. It also happens because of an <b>action which moves the crystal but leaves the structure unchanged</b>. <!-- aaa --> 
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                So, to recap: every time we see a see-through effect, we know that <b>moving</b>the crystal in that direction will send every atom to another atom of the same type in the crystal. We've found 3 of these movements so far.
            </div>
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
