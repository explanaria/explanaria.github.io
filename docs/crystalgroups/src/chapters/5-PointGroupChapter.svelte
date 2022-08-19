<script>
    import KyaniteSymmetryGroup from "../twoD/KyaniteSymmetryGroup.svelte";
    import AndalusiteTranslationSymmetryGroup from "../twoD/AndalusiteTranslationSymmetryGroup.svelte";
    import AndalusiteSymmetryGroup from "../twoD/AndalusiteSymmetryGroup.svelte";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {getAtomColor, aVecColor, bVecColor, cVecColor, aPlusCVecColor, mirrorColor, mirrorColor2, glidePlaneColor1, glidePlaneColor2} from "../colors.js";
    import {onMount, onDestroy, tick} from "svelte";

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

    //set these to true to skip parts of the chapter
    let debugDisableTranslationPart = false;
    let debugHideTranslations = false;

    let andTranslationGroup, andalusiteTranslationElemPositions, andalusiteTranslationVisibleElements, andalusiteTranslationVisibleArrows;

    let andGroup, andalusiteElemPositions, andalusiteVisibleElements, andalusiteVisibleArrows;
    let kyGroup, kyaniteElemPositions, kyaniteVisibleElements;
    let _data = {
        showAndalusiteTranslationGroup: true,
        translationGroupOffset: 0,
        andalusiteTranslationGroupOpacity: 1,

        showAndalusiteGroup: true,
        andalusiteGroupOffset: 0,
        andalusiteGroupOpacity: 0,

        showKyaniteGroup: false,
        showBothColumns: false,
    };

    //hack for reactivity
    let data = {};
    Object.keys(_data).forEach(keyName => 
        Object.defineProperty(data, keyName, {
          set(x) { _data[keyName] = x; _data = _data;}, //let svelte know about the reactive change
          get(x) { return _data[keyName]; }
        })
    );
    

    async function animate(){
        clearThreeScene();
        let canvas = attachCanvas("threecanvas", "threecanvas");
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);
        controls.enableKeys = false;

        //expose things to window for debugging
        window.three = three;
        window.controls = controls;
        window.andalusiteData = andalusiteData;
        window.presentation = presentation;
        window.kyGroup = kyGroup;

        window.data = data;
        window.andTranslationGroup = andTranslationGroup, window.andalusiteTranslationElemPositions = andalusiteTranslationElemPositions, window.andalusiteTranslationVisibleElements = andalusiteTranslationVisibleElements; window.andalusiteTranslationVisibleArrows = andalusiteTranslationVisibleArrows;

        window.andGroup = andGroup, window.andalusiteElemPositions = andalusiteElemPositions, window.andalusiteVisibleElements = andalusiteVisibleElements; window.andalusiteVisibleArrows = andalusiteVisibleArrows;

        let [andalusite, expandalusitebonds] = makeBallStickDiagram(andalusiteData, 1,1,1); //static one
        andalusite.scale.set(1,1,1); //this is going to be easier for scaling
        andalusite.children[0].material.transparent = true;
        andalusite.children[0].material.needsUpdate = true;

        window.andalusite = andalusite;
        window.expandalusitebonds = expandalusitebonds;
        three.scene.add(andalusite)

        let [movingAndalusite, movingAndalusiteBonds] = makeBallStickDiagram(andalusiteData, 1,1,1, 1.1); //copy which moves to illustrate translations
        movingAndalusite.scale.set(1,1,1);
        movingAndalusite.children[0].material.transparent = true;
        movingAndalusite.children[0].material.needsUpdate = true;
        presentation.TransitionInstantly(movingAndalusite.children[0].material, {opacity: 0});
        presentation.TransitionTo(movingAndalusiteBonds.getDeepestChildren()[0], {opacity: 0}, 250);
        three.scene.add(movingAndalusite)
        window.movingAndalusite = movingAndalusite;
        window.movingAndalusiteBonds = movingAndalusiteBonds;

        /*
        let [movingAndalusite, movingAndalusiteBonds] = makeBallStickDiagram(andalusiteData, 0,0,0); //copy which moves to illustrate translations
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
        window.movingAndalusiteTarget = movingAndalusiteTarget;
        window.movingAndalusiteGhostCopy = movingAndalusiteGhostCopy;

        three.scene.add(movingAndalusite)
        three.scene.add(movingAndalusiteTarget)
        three.scene.add(movingAndalusiteGhostCopy)
        */


        //mirror planes!
        let mirrorCenterZ = andalusiteData.cVec[2]/2;

        let mirror1 = new EXP.Area({bounds: [[-1,1],[-1,1]], numItems: [2,2]})
        mirror1.add(new EXP.Transformation({expr: (i,t,x,y) => [x*15,y*15, mirrorCenterZ]}))
        .add(new EXP.SurfaceOutput({gridSquares: 4, color: mirrorColor, showSolid: false, opacity: 0.0}))
        objects.push(mirror1)

        let mirrorCenterZ2 = -andalusiteData.cVec[2]/2;

        let mirror2 = new EXP.Area({bounds: [[-1,1],[-1,1]], numItems: [2,2]})
        mirror2.add(new EXP.Transformation({expr: (i,t,x,y) => [x*15,y*15, mirrorCenterZ2]}))
        .add(new EXP.SurfaceOutput({gridSquares: 4, color: mirrorColor2, showSolid: false, opacity: 0.0}))
        objects.push(mirror2)

        //xz plane mirror
        let mirrorCenterY = andalusiteData.bVec[1]/4;
        let mirror3 = new EXP.Area({bounds: [[-1,1],[-1,1]], numItems: [2,2]})
        mirror3.add(new EXP.Transformation({expr: (i,t,x,z) => [x*10, mirrorCenterY, z*10]}))
        .add(new EXP.SurfaceOutput({gridSquares: 4, color: glidePlaneColor1, showSolid: false, opacity: 0.0}))
        objects.push(mirror3)
        window.mirrorCenterY = mirrorCenterY;


        //xz plane mirror
        let mirrorCenterX = andalusiteData.aVec[0]/4;
        let mirror4 = new EXP.Area({bounds: [[-1,1],[-1,1]], numItems: [2,2]})
        mirror4.add(new EXP.Transformation({expr: (i,t,y,z) => [mirrorCenterX, y * 10, z*10]}))
        .add(new EXP.SurfaceOutput({gridSquares: 4, color: glidePlaneColor2, showSolid: false, opacity: 0.0}))
        objects.push(mirror4)
        window.mirrorCenterX = mirrorCenterX;



        presentation.TransitionInstantly(three.camera.position, {x: 0, y:0, z: 40});
        presentation.TransitionInstantly(three.camera.rotation, {x: 0, y:0, z: 0});


        //the translations which belong to see-through effects
        let firstSeeThroughVec = andalusiteData.cVec;
        let secondSeeThroughVec = EXP.Math.vectorAdd(andalusiteData.aVec, andalusiteData.cVec);
        let thirdSeeThroughVec = andalusiteData.aVec;

        //show 3 vectors representing each movement
        let atomStartPos = andalusiteData.atoms["Al"][5]; //[0,0,0]
        let aVecArrow = new EXP.Array({data: [atomStartPos, atomStartPos]})

        let scaleWithMainCrystal = new EXP.Transformation({expr: (i,t,x,y,z) => [x * andalusite.scale.x,y * andalusite.scale.y,z * andalusite.scale.z]});

aVecColor, bVecColor, cVecColor, aPlusCVecColor
        let translationRepresentation1 = new EXP.VectorOutput({color: aVecColor, opacity: 0});

        let displayedAVec = EXP.Math.vectorScale(andalusiteData.aVec,0.95); //go slightly behind atom circle
        aVecArrow.add(new EXP.Transformation({expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], displayedAVec)}))
            .add(scaleWithMainCrystal.makeLink())
            .add(translationRepresentation1);

        let aPlusCVecArrow = new EXP.Array({data: [atomStartPos, atomStartPos]})
        let aPlusCVecArrowDir = EXP.Math.vectorAdd(andalusiteData.aVec,andalusiteData.cVec);

        let displayedAPlusCVecArrowDir = EXP.Math.vectorScale(aPlusCVecArrowDir,0.97);//go slightly behind atom
        let translationRepresentation2 = new EXP.VectorOutput({color: aPlusCVecColor, opacity: 0});
        aPlusCVecArrow.add(new EXP.Transformation({expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], displayedAPlusCVecArrowDir)}))
            .add(scaleWithMainCrystal.makeLink())
            .add(translationRepresentation2);

        let cVecArrow = new EXP.Array({data: [atomStartPos, atomStartPos]})
        let displayedCVec = EXP.Math.vectorScale(andalusiteData.cVec,0.95);
        cVecArrow.add(new EXP.Transformation({expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], displayedCVec)}))
            .add(scaleWithMainCrystal.makeLink())
            .add(new EXP.VectorOutput({color: cVecColor, opacity: 0}));

        let bVecArrow = new EXP.Array({data: [atomStartPos, atomStartPos]})
        bVecArrow.add(new EXP.Transformation({expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], andalusiteData.bVec)}))
            .add(scaleWithMainCrystal.makeLink())
            .add(new EXP.VectorOutput({color: bVecColor, opacity: 0}));

        //cheat a bit for visual clarity, and make arrows appear over the crystal

        [aVecArrow, bVecArrow, aPlusCVecArrow, cVecArrow].map(item => presentation.TransitionInstantly(item.getDeepestChildren()[0].material, {depthTest: false}))

        window.aVecArrow = aVecArrow; window.bVecArrow = bVecArrow; window.cVecArrow = cVecArrow;

        objects = objects.concat(aVecArrow, bVecArrow, cVecArrow, aPlusCVecArrow);

        let cameraRadius = 40;

        await presentation.begin();


        if(!debugDisableTranslationPart){ //debug: so i can cut out slides

        

        await presentation.nextSlide();

        //dolly in, so the lines seem more parallel
        presentation.ResetTo(three.camera.position, {x: 9, y:11, z: cameraRadius});
        presentation.ResetTo(three.camera.rotation, {x: -0.2, y:0, z: 0});
        presentation.TransitionTo(three.camera, {zoom: 4});

        //show translation arrows
        [aVecArrow, bVecArrow, aPlusCVecArrow, cVecArrow].map(item => presentation.TransitionTo(item.getDeepestChildren()[0], {opacity: 0.9}))
        presentation.TransitionTo(andalusite.children[0].material, {opacity: 0.2});
        presentation.TransitionTo(expandalusitebonds.getDeepestChildren()[0], {opacity: 0.1});
        

        await presentation.nextSlide();

        presentation.TransitionInstantly(data, {showAndalusiteTranslationGroup: true});

        showTranslationElement("e");
        andalusiteTranslationVisibleElements[0] = true; //e
        andalusiteTranslationVisibleElements[1] = true; //a
        andalusiteTranslationVisibleElements[2] = true; //b
        andalusiteTranslationVisibleElements[3] = true; //c

        function showTranslationElement(name){
            //todo: make undoable
            andTranslationGroup.elements.forEach((el, i) => {
                if(el.name == name){
                    andalusiteTranslationVisibleElements[i] = true;
                }
            })
            andalusiteTranslationVisibleElements = andalusiteTranslationVisibleElements;
        }
        window.showTranslationElement = showTranslationElement;

        ["e",'a','b','c','ca'].forEach(name => showTranslationElement(name))

        //todo: this probably won't undo properly
        presentation.TransitionInstantly(andalusiteTranslationVisibleArrows, {
                "e": [true,true,true, true],
                "a": [true, false, false], 
                "b": [false, true, false], 
                "c": [false, false, true],
                "ca": [false,false,false, true]});
        andalusiteTranslationVisibleArrows = andalusiteTranslationVisibleArrows;

        await presentation.nextSlide();

        //show that ac can be made using a and c
        presentation.TransitionInstantly(andalusiteTranslationVisibleArrows, {"a": [true, false, true],  "c": [true, false, true]});
        andalusiteTranslationVisibleArrows = andalusiteTranslationVisibleArrows;
        
        await presentation.nextSlide();

        //show a grid!
        presentation.TransitionInstantly(andalusiteTranslationVisibleArrows, {"a": [true, true, true], "b": [true, true, true], "c": [true, true, true]});
        andalusiteTranslationVisibleArrows = andalusiteTranslationVisibleArrows;

        for(let i=0;i<3;i++){
        for(let j=0;j<3;j++){
        for(let k=0;k<3;k++){
            if(i == j && j == k) continue;
            if((i == 1 && j == 1) || (k == 1 && j == 1) || (i ==1 && k == 1)) continue;

            let element = andTranslationGroup.multiply(andTranslationGroup.multiply(andTranslationGroup.generators[i],andTranslationGroup.generators[j]), andTranslationGroup.generators[k]);
            showTranslationElement(element.name)
            let toValues = {};
            toValues[element.name] = [true,true,true];
            presentation.TransitionInstantly(andalusiteTranslationVisibleArrows, toValues);
        }}}
        
        ['aa', 'cc', 'ca', 'ba', 'bc','ccaa', 'ccba'].forEach(name => {
            showTranslationElement(name)
            let toValues = {};
            toValues[name] = [true,true,true];
            presentation.TransitionInstantly(andalusiteTranslationVisibleArrows, toValues);
        });
        ['ccaa', 'ccbaa', 'cbaa'].forEach(name => {
            showTranslationElement(name)
        });

        andalusiteTranslationVisibleArrows = andalusiteTranslationVisibleArrows;

        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        }


        [aVecArrow, bVecArrow, aPlusCVecArrow, cVecArrow].map(item => presentation.TransitionTo(item.getDeepestChildren()[0], {opacity: 0}))

        //non-movements time

        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 1});
        presentation.TransitionTo(movingAndalusiteBonds.getDeepestChildren()[0], {opacity: 0.2}, 250);

        presentation.TransitionTo(andalusite.children[0].material, {opacity: 0.3});
        presentation.TransitionTo(expandalusitebonds.getDeepestChildren()[0], {opacity: 0.1});

        presentation.TransitionInstantly(data, {andalusiteTranslationGroupOpacity: 0, andalusiteGroupOpacity: 1,  showAndalusiteGroup: true});
        //todo: do this in an undo-friendly manner

        function showElement(name){
            //todo: make undoable
            andGroup.elements.forEach((el, i) => {
                if(el.name == name){
                    andalusiteVisibleElements[i] = true;
                }
            })
            andalusiteVisibleElements = andalusiteVisibleElements;
        }
        window.showElement = showElement;

        showElement("e");


        if(!debugHideTranslations){

        await presentation.nextSlide();

        //show a mirror plane!

        presentation.TransitionTo(mirror1.getDeepestChildren()[0], {opacity: 0.8});

        //show m on the group
        showElement("m");
        let mIndex = andGroup.generators.indexOf(andGroup.getElemByName("m"));
        andalusiteVisibleArrows["e"][mIndex] = true; //show arrow from e to m
        andalusiteVisibleArrows["m"][mIndex] = true; //show arrow from e to m

        //mirror the crystal across it
        await presentation.nextSlide();

        presentation.ResetTo(three.camera.position, {x: cameraRadius, y:2, z: 0});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/2, z: 0});
        presentation.TransitionTo(three.camera, {zoom: 4});

        await presentation.delay(1000);

        //show a mirror!
        presentation.TransitionInstantly(movingAndalusite.children[0].material, {transparent: false});

        //mirror about the center
        presentation.TransitionTo(movingAndalusite.scale, {z: -1}, 2000);
        presentation.TransitionTo(movingAndalusite.position, {z: 2 * mirrorCenterZ}, 2000);

        await presentation.nextSlide();
        presentation.TransitionTo(mirror2.getDeepestChildren()[0], {opacity: 0.8});
        showElement("m2");

        let m2Index = andGroup.generators.indexOf(andGroup.getElemByName("m2"));
        andalusiteVisibleArrows["e"][m2Index] = true; //show arrow from e to m
        andalusiteVisibleArrows["m2"][m2Index] = true; //show arrow from e to m

        await presentation.nextSlide();

        presentation.TransitionTo(movingAndalusite.scale, {z: 1}, 2000);
        presentation.TransitionTo(movingAndalusite.position, {z: 2 * mirrorCenterZ + 6 * mirrorCenterZ2}, 2000);


        await presentation.nextSlide();


        andalusiteVisibleArrows["m2"][mIndex] = true; //show arrow from e to m

        showElement("c");

        await presentation.nextSlide();

        presentation.TransitionTo(movingAndalusite.position, {z: 0}, 2000);

        await presentation.nextSlide();

        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();


        }

        //ok enough reflection. it's glide reflection time.

        await presentation.nextSlide();

        presentation.TransitionTo(mirror1.getDeepestChildren()[0], {opacity: 0});
        presentation.TransitionTo(mirror2.getDeepestChildren()[0], {opacity: 0});

        presentation.ResetTo(three.camera.position, {x: cameraRadius, y:4, z: 0});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/2, z: 0});
        presentation.TransitionTo(three.camera, {zoom: 4});

        presentation.TransitionTo(mirror3.getDeepestChildren()[0], {opacity: 0.9});

        await presentation.nextSlide();

        let glideReflectionAmount = andalusiteData.aVec[0]/2;

        //reflect...
        presentation.TransitionTo(movingAndalusite.scale, {y: -1}, 2000);
        presentation.TransitionTo(movingAndalusite.position, {y: mirrorCenterY * 2}, 2000);

        await presentation.nextSlide();

        //glide.
        //found using http://img.chem.ucl.ac.uk/sgp/LARGE/058az1.htm
        presentation.TransitionTo(movingAndalusite.position, {x: andalusiteData.aVec[0]/2, y: mirrorCenterY * 2, z: andalusiteData.cVec[2]/2 }, 2000);

        await presentation.nextSlide();


        //show m on the group
        showElement("g1");
        let g1Index = andGroup.generators.indexOf(andGroup.getElemByName("g1"));
        andalusiteVisibleArrows["e"][g1Index] = true; //show arrow from e to g1
        andalusiteVisibleArrows["g1"][g1Index] = true; //show arrow from g1 to bc

        await presentation.nextSlide();

        await presentation.nextSlide();
    
        //show glide plane #2
        presentation.TransitionTo(movingAndalusite.scale, {y: 1}, 1000);
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y: 0, z: 0 }, 1000);
        presentation.TransitionTo(mirror3.getDeepestChildren()[0], {opacity: 0});
        presentation.TransitionTo(mirror4.getDeepestChildren()[0], {opacity: 0.9});


        await presentation.nextSlide();

        presentation.TransitionTo(movingAndalusite.scale, {x: -1}, 1000);
        presentation.TransitionTo(movingAndalusite.position, {x: mirrorCenterX * 2}, 1000);

        await presentation.delay(1000);

        presentation.TransitionTo(movingAndalusite.position, {x: mirrorCenterX * 2, y: andalusiteData.bVec[1]/2, z: andalusiteData.cVec[2]/2 }, 2000);

        showElement("g2");
        let g2Index = andGroup.generators.indexOf(andGroup.getElemByName("g2"));
        andalusiteVisibleArrows["e"][g2Index] = true; //show arrow from e to g1
        andalusiteVisibleArrows["g2"][g2Index] = true; //show arrow from g1 to bc

        await presentation.nextSlide();
        await presentation.nextSlide();
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

<style>
    .groupcontainer{
        position: relative;
        transition: 1s ease-in-out transform, 1s ease-in-out opacity;
    }
</style>

<div class="overlappingItemContainer">
    <div class="overlappingItemContainer exp-text topThing">
        <div class="twocolumnsLeftBigger">
            <div class="threecanvascontainer column" id="threecanvas" />
                <div class="groupdisplay">
                    <!--
                    <div class="highlight fadeInImmediately" 
                        style:left={elemPositions !== undefined ? elemPositions.get(data.currentOrientation)[0] + "em":""} 
                        style:top={elemPositions !== undefined ? elemPositions.get(data.currentOrientation)[1]+ "em":""} /> -->
                    <div class:tworows={_data.showBothColumns}>
                        {#if _data.showKyaniteGroup}
                        <div class="groupcontainer">
                            <KyaniteSymmetryGroup bind:group={kyGroup} bind:positions={kyaniteElemPositions} bind:isElementVisible={kyaniteVisibleElements}/>
                        </div>
                        {/if}
                        {#if _data.showAndalusiteTranslationGroup}
                        <div class="groupcontainer" style:transform={'translateX(' + data.translationGroupOffset + 'em)'} style:opacity={_data.andalusiteTranslationGroupOpacity}>
                            <AndalusiteTranslationSymmetryGroup bind:group={andTranslationGroup} bind:positions={andalusiteTranslationElemPositions} bind:isElementVisible={andalusiteTranslationVisibleElements}  bind:isArrowVisibleMap={andalusiteTranslationVisibleArrows} />
                        </div>
                        {/if}
                        {#if _data.showAndalusiteGroup}
                        <div class="groupcontainer" style:transform={'translateX(' + data.andalusiteGroupOffset + 'em)'} style:opacity={_data.andalusiteGroupOpacity}>
                            <AndalusiteSymmetryGroup bind:group={andGroup} bind:positions={andalusiteElemPositions} bind:isElementVisible={andalusiteVisibleElements}  bind:isArrowVisibleMap={andalusiteVisibleArrows} />
                        </div>
                        {/if}
                    </div>
            </div>
        </div>
    </div>



    <div class="bottomThing noclick">
        <div class="overlappingItemContainer alignBottom">
            {#if !debugDisableTranslationPart}
            <div class="exp-slide">
                    <div class="frostedbg">
                        We started this explanarian by asking "How can we describe the difference between andalusite and kyanite?"
                        <br>Now, let's use symmetry groups to answer that question.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        We saw that andalusite's symmetry group included several <b>movements</b>, in various different directions.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        On the right, I'll draw a Cayley graph of andalusite. There's a few different types of movement actions we discovered, so I'll plot those too.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        However, we saw <b style={"color: " + aPlusCVecColor}>some actions</b> can be created by combining <b style={"color: " + aVecColor}>two</b> <b style={"color: " + cVecColor}>other</b> actions. We can represent that in the Cayley graph, too: from the start, follow <b style={"color: " + aVecColor}>one arrow</b>, then <b style={"color: " + cVecColor}>the other</b> to get to the <b style={"color: " + aPlusCVecColor}>combined action</b>.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        What happens if we take these actions and kept combining them? Since combining two movements creates another movement, we'd get a subgroup of andalusite's symmetry group consisting of only movements. This subgroup forms a kind of grid-like structure. You can follow any arrow to perform an action, or follow the arrow backwards to undo that action.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        As it turns out, for any crystal, the Cayley graph of the movements-only subgroup will always form this cube-like structure. The movement actions themselves might vary (in kyanite, they don't form 90 degree angles), but this subgroup's Cayley graph will always look like an infinite 3D grid. Geologists call a crystal's movements-only subgroup its "Bravais lattice".
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        In fact, for a long time, we thought every single material on earth had a Bravais lattice. Despite hundreds of years of geology, it took until the 1980s to discover repeating patterns of atoms whose symmetry group didn't have any movement actions at all. Those patterns, now called "quasicrystals", earned their discoverer a Nobel Prize.
                    </div>
            </div>


            <div class="exp-slide">
                    <div class="frostedbg">
                        So, those are all the movement actions. Are there any non-movement actions?
                    </div>
            </div>
            {/if}

            {#if !debugHideTranslations}

            <div class="exp-slide">
                    <div class="frostedbg">
                        Let's draw a Cayley graph of the non-movement actions. To start, a group must always include at least one action: doing nothing.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        In one direction, Andalusite has a <b style={"color: " + mirrorColor}>mirror symmetry across this plane</b>.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        If you reflect the crystal across <b style={"color: " + mirrorColor}>this plane</b>, all the atoms line up with other atoms on the other side. 
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        But this isn't the only mirror action. This <b style={"color: " + mirrorColor2}>other mirror plane</b> also works.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        If we mirror about this <b style={"color: " + mirrorColor2}>other mirror plane</b>, all the atoms still realign with the crystal. So we have two different mirror actions in the symmetry group.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Interestingly, even though mirroring twice returns you to where you started, doing <b style={"color: " + mirrorColor}>the first mirror</b>, then <b style={"color: " + mirrorColor2}>the second mirror</b>, seems to result in <b style={"color: " + cVecColor}>a movement perpendicular to the mirror plane</b>.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        In fact, there's actually infinitely many possible mirror actions, all mirroring across parallel planes. 
                        <br>Why? To find out, let's do some group theory with equations.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        We saw that combining <b style={"color: " + mirrorColor}>the first mirror</b> (which I'll call "<b style={"color: " + mirrorColor}>m</b>") with <b style={"color: " + mirrorColor2}>the second mirror</b> (which I'll call "<b style={"color: " + mirrorColor2}>m2</b>") will get you <b style={"color: " + cVecColor}>a perpendicular movement</b> (which I'll call "<b style={"color: " + cVecColor}>c</b>").
                        <br>
                        We can write this as an equation, with * standing for combining actions by doing one after the other:
                        <br><b style={"color: " + mirrorColor}>m</b> * <b style={"color: " + mirrorColor2}>m2</b> = <b style={"color: " + cVecColor}>c</b>
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Now, if we combine the action on both sides of the equation with <b style={"color: " + mirrorColor2}>m2</b>: 
                        <br><b style={"color: " + mirrorColor}>m</b> * <b style={"color: " + mirrorColor2}>m2</b> * <b style={"color: " + mirrorColor2}>m2</b> = <b style={"color: " + cVecColor}>c</b> * <b style={"color: " + mirrorColor2}>m2</b>
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Finally, <b style={"color: " + mirrorColor2}>m2</b> is a mirror action, and mirroring something twice is the same as no action whatsoever: 
                        <br><b style={"color: " + mirrorColor}>m</b> * (<b style={"color: " + mirrorColor2}>m2</b> * <b style={"color: " + mirrorColor2}>m2</b>) = c * <b style={"color: " + mirrorColor2}>m2</b>
                        <br>
                        <br><b style={"color: " + mirrorColor}>m</b> = <b style={"color: " + cVecColor}>c</b> * <b style={"color: " + mirrorColor2}>m2</b>
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        In summary, we see <b style={"color: " + mirrorColor}>m</b> = <b style={"color: " + cVecColor}>c</b> * <b style={"color: " + mirrorColor2}>m2</b>.
                        <br> This equation tells us that <b style={"color: " + mirrorColor}>the first mirror action</b> is the same as <b style={"color: " + cVecColor}>moving</b> before <b style={"color: " + mirrorColor2}>mirroring</b>. So these mirror actions are just moved versions of one another.
                        <br>
                    </div>
            </div>
            {/if}

            <div class="exp-slide">
                    <div class="frostedbg">
                        So if you start with <b style={"color: " + mirrorColor}>one mirror</b>, you can <b style={"color: " + cVecColor}>move perpendicular to the mirror plane</b> as many times as you want and the result will still be a <b style={"color: " + mirrorColor2}>mirror action</b>! And that's why there are infinitely many mirror actions.
                        <br>Manipulating actions in the form of equations is one of the core ideas of group theory.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        What about the other directions, you might ask? Is Andalusite mirror symmetric along this plane? 
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Unfortunately, andalusite is only mirror symmetric in that one plane we saw. Although it might look like the atoms line up, a mirror will leave them slightly misaligned. Look at the checkerboard pattern of blue <b style={"color:" + getAtomColor("Si")}>silicon</b> atoms and their lighter blue original places.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        But we can realign the atoms by moving along the <b style={"color: " + glidePlaneColor1}>same plane</b>.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        A combination of a mirror and a movement parallel to that mirror plane is called a "<b style={"color: " + glidePlaneColor1}>glide reflection</b>". (If the movement was perpendicular to the mirroring, we'd get another mirroring, like we just saw before!)
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Interestingly, if you do only the movement or only the reflection, not both, it won't realign andalusite with itself. You need both the glide and the reflection together to be a valid element of andalusite's symmetry group.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Finally, there's one more reflection plane we haven't tried yet.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        It also gives us a different <b style={"color: " + glidePlaneColor2}>glide reflection</b>. 
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        If you do a glide reflection twice, you get a simple movement.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Finally, since this is a group, you can combine these actions to get a total of eight non-translation actions.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        So, in summary, here's what Andalusite's symmetry group looks like! Those two glide plane directions, combined with the mirrors (and translations), make up Andalusite's entire symmetry group. Combine them in any order and they'll give you every possible realignment of andalusite's atoms with itself.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Kyanite, on the other hand, has a much simpler symmetry group.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Kyanite only has one non-translation action: "inversion", where you send an atom with coordinates [x,y,z] to [-x,-y,-z]. It's like a reflection through a point.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        So, to answer our original question, how can we tell apart kyanite and andalusite? The answer: their symmetry groups are incredibly different! If you know how to find and distinguish between symmetry groups, you can uncover lots of info that isn't necessarily clear at first glance.
                        <br>And that's why mathematicians care about group theory.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        In fact, "Turn things into groups, then see if the groups are different" is a very useful strategy. It's also why mathematicians who study topology use group theory: if you have a weird surface, 3D volume, or even a 4D space, topologists often study spaces by creating a group called the "fundamental group" of that space.
                    </div>
            </div>
        </div>
    </div>
</div>
