<script>
    import KyaniteSymmetryGroup from "../twoD/KyaniteSymmetryGroup.svelte";
    import AndalusiteSymmetryGroup from "../twoD/AndalusiteSymmetryGroup.svelte";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {getAtomColor, aVecColor, bVecColor, cVecColor, aPlusCVecColor} from "../colors.js";
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

    let andGroup, andalusiteElemPositions, andalusiteVisibleElements, andalusiteVisibleArrows;
    let kyGroup, kyaniteElemPositions, kyaniteVisibleElements;
    let data = {
        showAndalusiteGroup: true,
        showKyaniteGroup: false,
        showBothColumns: false,
    };

    async function animate(){
        clearThreeScene();
        let canvas = attachCanvas("threecanvas", "threecanvas");
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);
        controls.enableKeys = false;
        window.three = three;
        window.controls = controls;
        window.andalusiteData = andalusiteData;
        window.presentation = presentation;
        window.kyGroup = kyGroup;

        window.andGroup = andGroup, window.andalusiteElemPositions = andalusiteElemPositions, window.andalusiteVisibleElements = andalusiteVisibleElements; window.andalusiteVisibleArrows = andalusiteVisibleArrows;

        let [andalusite, expandalusitebonds] = makeBallStickDiagram(andalusiteData, 1,1,1); //static one
        let [movingAndalusite, movingAndalusiteBonds] = makeBallStickDiagram(andalusiteData, 0,0,0); //copy which moves to illustrate translations
        andalusite.children[0].material.transparent = true;
        andalusite.children[0].material.needsUpdate = true;

        window.andalusite = andalusite;
        window.expandalusitebonds = expandalusitebonds;
        three.scene.add(andalusite)

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
        aVecArrow.add(new EXP.Transformation({expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], andalusiteData.aVec)}))
            .add(scaleWithMainCrystal.makeLink())
            .add(translationRepresentation1);

        let aPlusCVecArrow = new EXP.Array({data: [atomStartPos, atomStartPos]})
        let aPlusCVecArrowDir = EXP.Math.vectorAdd(andalusiteData.aVec,andalusiteData.cVec);
        let translationRepresentation2 = new EXP.VectorOutput({color: aPlusCVecColor, opacity: 0});
        aPlusCVecArrow.add(new EXP.Transformation({expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], aPlusCVecArrowDir)}))
            .add(scaleWithMainCrystal.makeLink())
            .add(translationRepresentation2);

        let cVecArrow = new EXP.Array({data: [atomStartPos, atomStartPos]})
        cVecArrow.add(new EXP.Transformation({expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], andalusiteData.cVec)}))
            .add(scaleWithMainCrystal.makeLink())
            .add(new EXP.VectorOutput({color: cVecColor, opacity: 0}));

        let bVecArrow = new EXP.Array({data: [atomStartPos, atomStartPos]})
        bVecArrow.add(new EXP.Transformation({expr: (i,t,x,y,z) => i == 0 ? [x,y,z] : EXP.Math.vectorAdd([x,y,z], andalusiteData.bVec)}))
            .add(scaleWithMainCrystal.makeLink())
            .add(new EXP.VectorOutput({color: bVecColor, opacity: 0}));

        window.aVecArrow = aVecArrow; window.bVecArrow = bVecArrow; window.cVecArrow = cVecArrow;

        objects = objects.concat(aVecArrow, bVecArrow, cVecArrow, aPlusCVecArrow);

        let cameraRadius = 40;

        await presentation.begin();
        await presentation.nextSlide();

        //dolly in, so the lines seem more parallel
        presentation.ResetTo(three.camera.position, {x: 4, y:4, z: cameraRadius});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:0, z: 0});
        presentation.TransitionTo(three.camera, {zoom: 4});

        //show translation arrows
        [aVecArrow, bVecArrow, aPlusCVecArrow, cVecArrow].map(item => presentation.TransitionTo(item.getDeepestChildren()[0], {opacity: 0.9}))
        presentation.TransitionTo(andalusite.children[0].material, {opacity: 0.2});
        presentation.TransitionTo(expandalusitebonds.getDeepestChildren()[0], {opacity: 0.1});
        

        await presentation.nextSlide();

        showElement("e");
        andalusiteVisibleElements[0] = true; //e
        andalusiteVisibleElements[1] = true; //a
        andalusiteVisibleElements[2] = true; //b
        andalusiteVisibleElements[3] = true; //c

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

        ["e",'a','b','c','ca'].forEach(name => showElement(name))

        //todo: this probably won't undo properly
        presentation.TransitionInstantly(andalusiteVisibleArrows, {
                "e": [true,true,true, true],
                "a": [true, false, false], 
                "b": [false, true, false], 
                "c": [false, false, true],
                "ca": [false,false,false, true]});
        andalusiteVisibleArrows = andalusiteVisibleArrows;

        await presentation.nextSlide();

        //show that ac can be made using a and c
        presentation.TransitionInstantly(andalusiteVisibleArrows, {"a": [true, false, true],  "c": [true, false, true]});
        andalusiteVisibleArrows = andalusiteVisibleArrows;
        
        await presentation.nextSlide();

        //show a grid!
        presentation.TransitionInstantly(andalusiteVisibleArrows, {"a": [true, true, true], "b": [true, true, true], "c": [true, true, true]});
        andalusiteVisibleArrows = andalusiteVisibleArrows;

        for(let i=0;i<3;i++){
        for(let j=0;j<3;j++){
        for(let k=0;k<3;k++){
            if(i == j && j == k) continue;
            if((i == 1 && j == 1) || (k == 1 && j == 1) || (i ==1 && k == 1)) continue;

            let element = andGroup.multiply(andGroup.multiply(andGroup.generators[i],andGroup.generators[j]), andGroup.generators[k]);
            showElement(element.name)
            let toValues = {};
            toValues[element.name] = [true,true,true];
            presentation.TransitionInstantly(andalusiteVisibleArrows, toValues);
        }}}
        
        ['aa', 'cc', 'ca', 'ba', 'bc','ccaa', 'ccba'].forEach(name => {
            showElement(name)
            let toValues = {};
            toValues[name] = [true,true,true];
            presentation.TransitionInstantly(andalusiteVisibleArrows, toValues);
        });
        ['ccaa', 'ccbaa', 'cbaa'].forEach(name => {
            showElement(name)
        });

        andalusiteVisibleArrows = andalusiteVisibleArrows;

        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();

        //non-movements time

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

    .groupcontainer{
        position: relative;
    }
</style>

<div class="overlappingItemContainer exp-text topThing">
    <div class="twocolumnsLeftBigger">
        <div class="threecanvascontainer column" id="threecanvas" />

        <div class="groupdisplay">
                <!--
                <div class="highlight fadeInImmediately" 
                    style:left={elemPositions !== undefined ? elemPositions.get(data.currentOrientation)[0] + "em":""} 
                    style:top={elemPositions !== undefined ? elemPositions.get(data.currentOrientation)[1]+ "em":""} /> -->
                <div class:tworows={data.showBothColumns}>
                    {#if data.showKyaniteGroup}
                    <div class="groupcontainer">
                        <KyaniteSymmetryGroup bind:group={kyGroup} bind:positions={kyaniteElemPositions} bind:isElementVisible={kyaniteVisibleElements}/>
                    </div>
                    {/if}
                    {#if data.showAndalusiteGroup}
                    <div class="groupcontainer">
                        <AndalusiteSymmetryGroup bind:group={andGroup} bind:positions={andalusiteElemPositions} bind:isElementVisible={andalusiteVisibleElements}  bind:isArrowVisibleMap={andalusiteVisibleArrows} />
                    </div>
                    {/if}
                </div>
        </div>
    </div>
</div>


<div class="overlappingItemContainer bottomThing">
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
                On the right, I'll draw the Cayley graph of andalusite. There's a few different types of actions we discovered, so I'll plot those too.
            </div>
    </div>

    <div class="exp-slide">
            <div class="frostedbg">
                However, <span style={"color: " + aPlusCVecColor}>some actions</span> can be created by combining <span style={"color: " + aVecColor}>two</span> <span style={"color: " + cVecColor}>other</span> actions. We can represent that in the Cayley graph, too.
            </div>
    </div>

    <div class="exp-slide">
            <div class="frostedbg">
                In all, a Cayley graph of all the actions which involve moving forms a kind of grid-like structure. You can follow any arrow to perform an action, or follow the arrow backwards to undo that action.
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                As it turns out, looking at just the movements-only part of a symmetry group will always form this cube-like structure. The actions themselves might vary (in kyanite, they don't form 90 degree angles like this andalusite does), but for a crystal, the cayley graph of movements always looks like this infinite 3D grid. Geologists call this only-translations pattern the "bravais lattice".
            </div>
    </div>
    <div class="exp-slide">
            <div class="frostedbg">
                In fact, for a long time, we thought materials couldn't exist without having some type of movements in their symmetry group. Despite hundreds of years of geology, it took until the 1980s to discover repeating patterns of atoms which didn't have transation symmetry, buried in a fallen meteorite. They're called "quasicrystals", and scientists are very interested.
            </div>
    </div>

    <div class="exp-slide">
            <div class="frostedbg">
                So, those are all the movement actions. Are there any non-movement actions?
            </div>
    </div>


</div>
