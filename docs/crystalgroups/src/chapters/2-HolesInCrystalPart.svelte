<script>
    import MoleculeCanvas from "../threeD/MoleculeCanvas.svelte";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {getAtomColor, chapter2linecolor, chapter2linecolor2, chapter2linecolor3} from "../colors.js";
    import {onMount, onDestroy, tick} from "svelte";

    import {attachCanvas, three, clearThreeScene} from "../threeD/sharedthreejscanvas.js"
    import {makeBallStickDiagram, allAtoms, getSymmetryClones} from "../threeD/ballStickDiagram.js";
    import {andalusiteData} from "../threeD/polymorphdata.js";
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

    let controls;

    export let alludeToChapter3 = true;


    async function animate(){
        clearThreeScene();
        let canvas = attachCanvas("threecanvas", "threecanvas topThing");
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);
        controls.enableKeys = false;
        window.three = three;
        window.controls = controls;
        window.andalusiteData = andalusiteData;
        window.presentation = presentation;

        let [andalusite, expandalusitebonds] = makeBallStickDiagram(andalusiteData, 2,2,2); //static one
        let [movingAndalusite, expandalusitebonds2] = makeBallStickDiagram(andalusiteData, 0,0,0); //copy which moves to illustrate translations
        let [movingAndalusiteGhostCopy, movingAndalusiteGhostCopyBonds] = makeBallStickDiagram(andalusiteData, 0,0,0); //copy which stays still and transparent
        let [movingAndalusiteTarget, movingAndalusiteTargetBonds] = makeBallStickDiagram(andalusiteData, 0,0,0); //copy which moves to illustrate translations
        movingAndalusite.children[0].material.transparent = true;
        movingAndalusite.children[0].material.needsUpdate = true;
        presentation.TransitionInstantly(movingAndalusite.children[0].material, {opacity: 0});

        movingAndalusiteTarget.children[0].material.transparent = true;
        movingAndalusiteTarget.children[0].material.needsUpdate = true;
        presentation.TransitionInstantly(movingAndalusiteTarget.children[0].material, {opacity: 0});
        presentation.TransitionTo(movingAndalusiteTargetBonds.getDeepestChildren()[0], {opacity: 0}, 250);

        movingAndalusiteGhostCopy.children[0].material.transparent = true;
        movingAndalusiteGhostCopy.children[0].material.needsUpdate = true;
        movingAndalusiteGhostCopyBonds.opacity = 0.2;
        presentation.TransitionInstantly(movingAndalusiteGhostCopy.children[0].material, {opacity: 0});

        movingAndalusiteTarget.position.copy(new THREE.Vector3(...andalusiteData.cVec)).multiply(andalusite.scale);

        window.andalusite = andalusite;
        window.movingAndalusiteTarget = movingAndalusiteTarget;
        window.movingAndalusiteGhostCopy = movingAndalusiteGhostCopy;
        window.expandalusitebonds = expandalusitebonds;

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

        presentation.TransitionInstantly(three.camera.position, {x: 0, y:5, z: 40});
        presentation.TransitionInstantly(three.camera, {zoom: 1});
        presentation.TransitionInstantly(three.camera.rotation, {x: 0, y:0, z: 0});



        three.scene.add(andalusite)
        three.scene.add(movingAndalusite)
        three.scene.add(movingAndalusiteTarget)
        three.scene.add(movingAndalusiteGhostCopy)

        //the translations which belong to see-through effects
        let firstSeeThroughVec = andalusiteData.cVec;
        let secondSeeThroughVec = EXP.Math.vectorAdd(andalusiteData.aVec, andalusiteData.cVec);
        let thirdSeeThroughVec = andalusiteData.aVec;


        //show 3 vectors representing each movement
        let atomStartPos = andalusiteData.atoms["Al"][5]; //[0,0,0]
        let vec1 = new EXP.Array({data: [atomStartPos, atomStartPos]})

        let scaleWithMainCrystal = new EXP.Transformation({expr: (i,t,x,y,z) => [x * andalusite.scale.x,y * andalusite.scale.y,z * andalusite.scale.z]});

        let translationRepresentation1 = new EXP.VectorOutput({color: chapter2linecolor, opacity: 0});
        //vec1.add(new EXP.Transformation({expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], firstSeeThroughVec)}))
        vec1.add(new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z]}))
            .add(scaleWithMainCrystal.makeLink())
            .add(translationRepresentation1);

        let vec2 = new EXP.Array({data: [atomStartPos, atomStartPos]})
        let translationRepresentation2 = new EXP.VectorOutput({color: chapter2linecolor2, opacity: 0});
        vec2.add(new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z]}))
            .add(scaleWithMainCrystal.makeLink())
            .add(translationRepresentation2);

        let vec3 = new EXP.Array({data: [atomStartPos, atomStartPos]})
        let translationRepresentation3 = new EXP.VectorOutput({color: chapter2linecolor3, opacity: 0});
        vec3.add(new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z]}))
            .add(scaleWithMainCrystal.makeLink())
            .add(translationRepresentation3);

        window.vec1 = vec1; window.vec2 = vec2; window.vec3 = vec3;

        objects = objects.concat(vec1, vec2, vec3);



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

        //yup, effect here. line up camera according to secondSeeThroughVec
        let diagonalCameraPos = EXP.Math.vectorScale(EXP.Math.normalize(secondSeeThroughVec), cameraRadius);
        presentation.ResetTo(three.camera.position, {x: diagonalCameraPos[0]+1, y:diagonalCameraPos[1], z: diagonalCameraPos[2]-1});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/4+0.2, z: 0});

        await presentation.nextSlide();

        //translate for thirdSeeThroughVec
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
        await presentation.delay(500);
        presentation.TransitionTo(atomLinesOutput, {opacity: 0.9});

        await presentation.nextSlide();

        presentation.ResetTo(three.camera.position, {x: cameraRadius, y:0, z: 0});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/2, z: 0});

        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();

        //take up more of the frame
        presentation.ResetTo(three.camera.position, {x: 30, y:2, z: 3});

        //show moving andalusite copies
        presentation.TransitionTo(andalusite.position, {y: 100}, 2000);
        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 1}, 250);
        presentation.TransitionTo(movingAndalusiteTarget.children[0].material, {opacity: 1}, 250);
        presentation.TransitionTo(movingAndalusiteTargetBonds.getDeepestChildren()[0], {opacity: 0.2}, 250);
        presentation.TransitionTo(movingAndalusiteGhostCopy.children[0].material, {opacity: 0.1}, 250);
        presentation.TransitionTo(movingAndalusiteGhostCopyBonds, {opacity: 0.1}, 250);

        presentation.TransitionTo(atomLinesOutput, {opacity: 0}, 250);

        await presentation.nextSlide();

        await presentation.delay(500);

        //show an arrow representing the movement
        presentation.TransitionTo(vec1.children[0], {expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], firstSeeThroughVec)})
        presentation.TransitionInstantly(vec1.getDeepestChildren()[0], {opacity: 1});

        await presentation.delay(1000);

        //translate with firstSeeThroughVec
        presentation.TransitionTo(movingAndalusite.position, {x: firstSeeThroughVec[0] * andalusite.scale.x, y: firstSeeThroughVec[1]* andalusite.scale.y, z: firstSeeThroughVec[2] * andalusite.scale.z}, 2000);
        window.firstSeeThroughVec = firstSeeThroughVec;
        window.movingAndalusite = movingAndalusite;


        await presentation.nextSlide();

        presentation.ResetTo(three.camera.position, {x: cameraRadius, y:0, z: 0});
        
        //hide all the stuff from translation #1 and re-show the crystal
        presentation.TransitionTo(movingAndalusiteTarget.children[0].material, {opacity: 0}, 250);
        presentation.TransitionTo(movingAndalusiteTargetBonds.getDeepestChildren()[0], {opacity: 0}, 250);
        presentation.TransitionTo(vec1.getDeepestChildren()[0], {opacity: 0});
        

        presentation.TransitionTo(andalusite.position, {y: 0}, 1000); //return from the heavens
        presentation.TransitionInstantly(andalusite.children[0].material, {opacity: 1});

        await presentation.delay(1000);

        //show see through effect #2
        presentation.ResetTo(three.camera.position, {x: diagonalCameraPos[0]+1, y:diagonalCameraPos[1], z: diagonalCameraPos[2]-1});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/4+0.2, z: 0});

        //show lines, this time in another color
        presentation.TransitionInstantly(lineData, {direction: secondSeeThroughVec});
        presentation.TransitionInstantly(atomLinesOutput, {width: 8, color: chapter2linecolor2});
        presentation.TransitionTo(atomLinesOutput, {opacity: 0.9});


        await presentation.nextSlide();

        //hide the lines and the andalusite
        presentation.TransitionTo(atomLinesOutput, {opacity: 0});
        //fly into the air and hide
        presentation.TransitionTo(andalusite.position, {y: 100}, 1000); //fly to the heavens
        presentation.TransitionTo(andalusite.children[0].material, {opacity: 0}, 500);
        presentation.TransitionTo(expandalusitebonds.getDeepestChildren()[0], {opacity: 0}, 500);

        //set up moving andalusites to be visible
        presentation.TransitionInstantly(movingAndalusite.position, {x:0,y:0,z:0});
        movingAndalusiteTarget.position.copy(new THREE.Vector3(...secondSeeThroughVec)).multiply(andalusite.scale);
        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 1}, 250);
        presentation.TransitionTo(movingAndalusiteTarget.children[0].material, {opacity: 1}, 250);
        presentation.TransitionTo(movingAndalusiteGhostCopy.children[0].material, {opacity: 0.2}, 250);
        presentation.TransitionTo(movingAndalusiteTargetBonds.getDeepestChildren()[0], {opacity: 0.2}, 250);
        presentation.TransitionTo(movingAndalusiteGhostCopyBonds, {opacity: 0.1}, 250);

        presentation.ResetTo(three.camera.position, {x: 5, y:2, z: 30});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:0, z: 0});
        
        await presentation.delay(1000);

        //aand translate
        presentation.TransitionTo(movingAndalusite.position, {x: secondSeeThroughVec[0] * andalusite.scale.x, y: secondSeeThroughVec[1]* andalusite.scale.y, z: secondSeeThroughVec[2] * andalusite.scale.z}, 2000);
        //show the arrow too
        presentation.TransitionTo(vec2.children[0], {expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], secondSeeThroughVec)}, 2000)
        presentation.TransitionTo(vec2.getDeepestChildren()[0], {opacity: 1});

        await presentation.nextSlide();

        //move to third see through hole

        presentation.ResetTo(three.camera.position, {x: aVecCameraPos[0], y:aVecCameraPos[1], z: aVecCameraPos[2]});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/2, z: 0});
        presentation.TransitionTo(atomLinesOutput, {opacity: 0}, 250);

        presentation.TransitionTo(andalusite.position, {y: 0}, 1000); //return from the heavens
        presentation.TransitionInstantly(andalusite.children[0].material, {opacity: 1});
        presentation.TransitionTo(expandalusitebonds.getDeepestChildren()[0], {opacity: 0.2});

        await presentation.delay(750);
        presentation.TransitionInstantly(lineData, {direction: thirdSeeThroughVec});
        presentation.TransitionInstantly(atomLinesOutput, {color: chapter2linecolor3});
        //im not feeling the lines on #3
        //presentation.TransitionTo(atomLinesOutput, {opacity: 0.9}, 1000);

        //set up for translation #3
        presentation.TransitionTo(movingAndalusiteTarget.children[0].material, {opacity: 0}, 250);
        presentation.TransitionTo(movingAndalusiteTargetBonds.getDeepestChildren()[0], {opacity: 0}, 250);
        presentation.TransitionTo(vec2.getDeepestChildren()[0], {opacity: 0});


        await presentation.nextSlide();

        //third translation time. move to another camera angle
        //presentation.ResetTo(three.camera.position, {x: 3, y:0, z: 40});
        presentation.ResetTo(three.camera.position, {x: 27, y:3, z: 27});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/4, z: 0});

        await presentation.delay(500);

        //hide the lines and the andalusite
        presentation.TransitionTo(atomLinesOutput, {opacity: 0});
        //fly into the air and hide
        presentation.TransitionTo(andalusite.position, {y: 100}, 1000); //fly to the heavens
        presentation.TransitionTo(andalusite.children[0].material, {opacity: 0}, 500);
        presentation.TransitionTo(expandalusitebonds.getDeepestChildren()[0], {opacity: 0}, 500);

        //set up moving andalusites to be visible
        presentation.TransitionInstantly(movingAndalusite.position, {x:0,y:0,z:0});

        presentation.TransitionInstantly(movingAndalusite.position, {x:0,y:0,z:0});
        let thirdTargetPos = new THREE.Vector3(...thirdSeeThroughVec).multiply(andalusite.scale);
        presentation.TransitionInstantly(movingAndalusiteTarget.position, {x:thirdTargetPos.x,y:thirdTargetPos.y,z:thirdTargetPos.z});
        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 1}, 250);
        presentation.TransitionTo(movingAndalusiteTarget.children[0].material, {opacity: 1}, 250);
        presentation.TransitionTo(movingAndalusiteGhostCopy.children[0].material, {opacity: 0.2}, 250);
        presentation.TransitionTo(movingAndalusiteTargetBonds.getDeepestChildren()[0], {opacity: 0.2}, 250);
        presentation.TransitionTo(movingAndalusiteGhostCopyBonds, {opacity: 0.1}, 250);

        await presentation.delay(1000);

        //translate #3
        presentation.TransitionTo(movingAndalusite.position, {x: thirdSeeThroughVec[0] * andalusite.scale.x, y: thirdSeeThroughVec[1]* andalusite.scale.y, z: thirdSeeThroughVec[2] * andalusite.scale.z}, 2000);
        //show the arrow too
        presentation.TransitionTo(vec3.children[0], {expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], thirdSeeThroughVec)}, 2000)
        presentation.TransitionTo(vec3.getDeepestChildren()[0], {opacity: 1});

        await presentation.nextSlide();
        presentation.ResetTo(three.camera.position, {x: 3, y:15, z: 35});
        presentation.ResetTo(three.camera.rotation, {x: -Math.PI/8, y:0, z: 0});

        //'we now have 3 movements'
        presentation.TransitionTo(atomLinesOutput, {opacity: 0});
        
        presentation.TransitionTo(movingAndalusiteTarget.children[0].material, {opacity: 0}, 250);
        presentation.TransitionTo(movingAndalusiteTargetBonds.getDeepestChildren()[0], {opacity: 0}, 250);
        
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y:0, z:0 }, 1000);

        //ok show those arrows
        [vec1, vec2, vec3].forEach(item => presentation.TransitionTo(item.getDeepestChildren()[0], {opacity: 1}));

        await presentation.nextSlide();

        presentation.TransitionTo(andalusite.position, {y: 0}, 1000); //return from the heavens
        presentation.TransitionInstantly(andalusite.children[0].material, {opacity: 0.2});
        presentation.TransitionTo(expandalusitebonds.getDeepestChildren()[0], {opacity: 0.2});
        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 0}, 250);
        presentation.TransitionTo(expandalusitebonds2.getDeepestChildren()[0], {opacity: 0}, 250);

        //i'm going to use this later
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y:0, z:0 }, 1000);
        presentation.TransitionTo(movingAndalusiteTarget.position, {x: 0, y:0, z:0 }, 1000);

        await presentation.nextSlide();
        await presentation.nextSlide();

        presentation.TransitionTo(andalusite.position, {y: 100}, 1000); //see ya

        presentation.TransitionTo(movingAndalusiteTarget.children[0].material, {opacity: 1}, 250);
        presentation.TransitionTo(movingAndalusiteTargetBonds.getDeepestChildren()[0], {opacity: 0.2}, 250);
        presentation.TransitionTo(movingAndalusiteGhostCopy.children[0].material, {opacity: 0.2}, 250);
        presentation.TransitionTo(movingAndalusiteGhostCopyBonds, {opacity: 0.1}, 250);

        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 1}, 250);
        presentation.TransitionTo(expandalusitebonds2.getDeepestChildren()[0], {opacity: 0.2}, 250);

        await presentation.nextSlide();
        
        presentation.TransitionTo(movingAndalusite.position, {x: firstSeeThroughVec[0] * andalusite.scale.x, y: firstSeeThroughVec[1]* andalusite.scale.y, z: firstSeeThroughVec[2] * andalusite.scale.z}, 1000);
        await presentation.delay(1000);
        presentation.TransitionTo(movingAndalusite.position, {x: secondSeeThroughVec[0] * andalusite.scale.x, y: secondSeeThroughVec[1]* andalusite.scale.y, z: secondSeeThroughVec[2] * andalusite.scale.z}, 1000);

        await presentation.nextSlide();

        //use the target to illustrate the combined motion
        presentation.TransitionTo(movingAndalusiteTarget.position, {x: secondSeeThroughVec[0] * andalusite.scale.x, y: secondSeeThroughVec[1]* andalusite.scale.y, z: secondSeeThroughVec[2] * andalusite.scale.z}, 1000);

        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();


        if(!alreadyEnding){
            dispatch("chapterEnd");
        }
    }

    let objects = [];
    function updateObjects(time){
        objects.forEach(item => item.activate(time.dt))
    }

    let presentation, alreadyEnding=false;
    onMount(async () => {
        three.on("update", updateObjects);
        await tick();
        presentation = new EXP.UndoCapableDirector();
        animate();
    });
    onDestroy(() => {
        alreadyEnding = true;
        presentation.dispose();
        controls.dispose();
        three.removeEventListener("update", updateObjects)
    });

    let slideStart = 1;
</script>

<div class="overlappingItemContainer">
    <div class="overlappingItemContainer exp-text topThing">
        <div class="threecanvascontainer" id="threecanvas" />

        <div class="noclick">
            <div class="exp-slide-1 frostedbg">
                <h1>Chapter 2</h1>
                <p>The Clear Conundrum</p>
            </div>
        </div>
        <!--
        <div id="whitebg" style="opacity: 0"/>
        <div id="overlays" class="overlappingItemContainer">
            <!-- 
            <div class="exp-slide-2">
                <div class="frostedbg">
                    Andalusite
                </div>
            </div>
           
        </div>
        -->
    </div>


    <div class="bottomThing noclick">
        <div class="overlappingItemContainer alignBottom">
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
                        When we see the see-through effect, the atoms almost seem to make <b style={"color: " + chapter2linecolor}>lines</b>, radiating outwards from the center point, like a tunnel.
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
                        Let me clear up some of this clutter quickly and I'll show you what I mean.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                       We can be more precise if we talk about <b>moving</b>. The "see-through" effect happens in a certain direction if, when we take the entire crystal and <span style={"color: " + chapter2linecolor}><b>move it in the direction we were looking</b></span>, after a certain distance, every moved atom would line up with another atom in the original crystal.
                    </div>
            </div>
            
            <div class="exp-slide">
                    <div class="frostedbg">
                        What about this other direction where we saw a see-through effect?
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Same thing: a see-through effect shows us that <span style={"color: " + chapter2linecolor2}><b>moving the crystal in this other direction</b></span> a certain distance will also realign the moved atoms with the original crystal.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        And the third see-through effect we saw? 
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Yup. That also happens because <span style={"color: " + chapter2linecolor3}><b>moving the atoms this third way</b></span> will realign them with the crystal.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        So, to recap: every time we see a see-through effect, it's because there's <b>a movement of the crystal in that direction</b> which <b>realigns the crystal's atoms with itself</b>. We've found 3 of these movements so far.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        The lesson here: you can learn a lot about an object (like a crystal) by studying <b>actions which realign an object with itself</b>, like the <b style={"color: " + chapter2linecolor}>mov</b><b style={"color: " + chapter2linecolor2}>eme</b><b style={"color: " + chapter2linecolor3}>nts</b> we discovered. The collection of all such actions is called a <b>"symmetry group"</b>, and mathematicians love studying them in group theory.
                    </div>
            </div>
            
            <div class="exp-slide">
                    <div class="frostedbg">
                        But there's more to the story than that, because actions can <b>combine</b> in interesting ways.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        For example, let's take another look at the actions we found in the symmetry group. We can combine two actions by performing them in sequence: do one, then another.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                       If we combine the <b style={"color: " + chapter2linecolor}>first</b> action we found with the <b style={"color: " + chapter2linecolor3}>third</b> action...
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                       If we combine the <b style={"color: " + chapter2linecolor}>first</b> action we found with the <b style={"color: " + chapter2linecolor3}>third</b> action... 
                       <br>it's the same as the <b style={"color: " + chapter2linecolor2}>second</b> action.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        In fact, combining <b>any</b> two actions will give you another action. That's one of the key rules of groups. And for many groups, once you know some simple actions and how they combine, you can combine the actions to deduce everything there is to know about a group.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        In summary:
                        <br>
                        <ul>
                            <li>We can understand crystals by looking at "the actions which realign it with itself"</li>
                            <li>Combining two such actions gives you another action!</li>
                        </ul>
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        {#if alludeToChapter3}
                        In a way, you could say group theory is all about understanding the ways two things combine (and undo, but I'll discuss that later). And that's why mathematicians care about group theory so much.
                        <br>But what does a full symmetry group actually look like? Let's find out.
                        {:else}
                        When I first learned about group theory, it was taught very abstractly. Sure, it was interesting, but I wanted to know: what would make mathematicians think to study "actions which send a shape to itself" in the first place? These crystals, to me, are the answer. I hope they inspire you to learn more about group theory!
                        {/if}
                    </div>
            </div>
        </div>
    </div>
</div>
