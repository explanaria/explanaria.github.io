<script>
    import KyaniteSymmetryGroup from "../twoD/KyaniteSymmetryGroup.svelte";
    import AndalusiteTranslationSymmetryGroup from "../twoD/AndalusiteTranslationSymmetryGroup.svelte";
    import AndalusiteSymmetryGroup from "../twoD/AndalusiteSymmetryGroup.svelte";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {getAtomColor, aVecColor, bVecColor, cVecColor, aPlusCVecColor, mirrorColor, mirrorColor2, glidePlaneColor1, rotationColor, glideRotationColor1, glideRotationColor2, glideRotationColor3, inversionColor, defaultGroupElementBorderColor} from "../colors.js";
    import {onMount, onDestroy, tick} from "svelte";

    import {attachCanvas, three, clearThreeScene} from "../threeD/sharedthreejscanvas.js"
    import {makeBallStickDiagram, allAtoms, getSymmetryClones} from "../threeD/ballStickDiagram.js";
    import {andalusiteData, kyaniteData} from "../threeD/polymorphdata.js";
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

    let groupEquationProgress = 0;
    let changeData = {set groupEquationProgress(x){ groupEquationProgress = x;}, get groupEquationProgress(){return groupEquationProgress}}; //hack so explanaria can change changeData

    let andTranslationGroup, andalusiteTranslationElemPositions, andalusiteTranslationVisibleElements, andalusiteTranslationVisibleArrows;

    let andGroup, andalusiteElemPositions, andalusiteVisibleElements, andalusiteVisibleArrows;
    let kyGroup, kyaniteElemPositions, kyaniteVisibleElements, kyaniteVisibleArrows;
    let _data = {
        translationGroupOffset: "",
        andalusiteTranslationGroupOpacity: 1,

        andalusiteGroupOffset: "translate(2.5em, 0)",
        andalusiteGroupOpacity: "0",

        kyaniteGroupOpacity: 0,
        kyaniteGroupOffset: "",
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
        window.EXP = EXP;
        window.three = three;
        window.controls = controls;
        window.andalusiteData = andalusiteData;
        window.kyaniteData = kyaniteData;
        window.presentation = presentation;
        window.kyGroup = kyGroup;

        window.data = data;
        window.andTranslationGroup = andTranslationGroup, window.andalusiteTranslationElemPositions = andalusiteTranslationElemPositions, window.andalusiteTranslationVisibleElements = andalusiteTranslationVisibleElements; window.andalusiteTranslationVisibleArrows = andalusiteTranslationVisibleArrows;

        window.andGroup = andGroup, window.andalusiteElemPositions = andalusiteElemPositions, window.andalusiteVisibleElements = andalusiteVisibleElements; window.andalusiteVisibleArrows = andalusiteVisibleArrows;

        let [andalusite, expAndalusiteBonds] = makeBallStickDiagram(andalusiteData, 1,1,1); //static one
        andalusite.scale.set(1,1,1); //this is going to be easier for scaling
        andalusite.children[0].material.transparent = true;
        andalusite.children[0].material.needsUpdate = true;

        window.andalusite = andalusite;
        window.expAndalusiteBonds = expAndalusiteBonds;
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



        let [kyanite, expKyaniteBonds] = makeBallStickDiagram(kyaniteData, 1,1,1); //static one
        kyanite.scale.set(1,1,1); //this is going to be easier for scaling
        kyanite.children[0].material.transparent = true;
        kyanite.children[0].material.needsUpdate = true;
        presentation.TransitionInstantly(kyanite.children[0].material, {opacity: 0});
        presentation.TransitionInstantly(expKyaniteBonds.getDeepestChildren()[0], {opacity: 0});
        kyanite.position.y = -20;

        window.kyanite = kyanite;
        window.expKyaniteBonds = expKyaniteBonds;
        three.scene.add(kyanite)

        let [movingKyanite, movingKyaniteBonds] = makeBallStickDiagram(kyaniteData, 1,1,1, 1.1); //copy which moves to illustrate translations
        movingKyanite.scale.set(1,1,1);
        movingKyanite.children[0].material.transparent = true;
        movingKyanite.children[0].material.needsUpdate = true;
        presentation.TransitionInstantly(movingKyanite.children[0].material, {opacity: 0});
        presentation.TransitionInstantly(movingKyaniteBonds.getDeepestChildren()[0], {opacity: 0});
        movingKyanite.position.y = -20;
        three.scene.add(movingKyanite)
        window.movingKyanite = movingKyanite;
        window.movingKyaniteBonds = movingKyaniteBonds;

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
        let mirrorCenterZ = -andalusiteData.cVec[2]/2;

        let mirror1 = new EXP.Area({bounds: [[-1,1],[-1,1]], numItems: [2,2]})
        mirror1.add(new EXP.Transformation({expr: (i,t,x,y) => [x*15,y*15, mirrorCenterZ]}))
        .add(new EXP.SurfaceOutput({gridSquares: 4, color: mirrorColor, showSolid: false, opacity: 0.0}))
        objects.push(mirror1)

        let mirrorCenterZ2 = andalusiteData.cVec[2]/2;

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
        .add(new EXP.SurfaceOutput({gridSquares: 4, color: glidePlaneColor1, showSolid: false, opacity: 0.0}))
        objects.push(mirror4)
        window.mirrorCenterX = mirrorCenterX;



        let inversionCenter = EXP.Math.vectorScale(andalusiteData.aVec, 0.5);
        let inversionTrackPoint = andalusiteData.atoms["Si"][1];

        let inversionArrow1 = new EXP.Array({data: [inversionCenter, inversionTrackPoint]})
        let inversionArrowOutput = new EXP.VectorOutput({color: inversionColor, opacity: 0});
        let inversionArrow2 = new EXP.Array({data: [inversionCenter, EXP.Math.vectorAdd(EXP.Math.vectorScale(EXP.Math.vectorSub(inversionTrackPoint, inversionCenter), -1), inversionCenter)]
        })
        inversionArrow1.add(inversionArrowOutput)
        inversionArrow2.add(inversionArrowOutput.clone())
        objects = objects.concat(inversionArrow1, inversionArrow2);
        window.inversionArrow1 = inversionArrow1;




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
        presentation.TransitionTo(expAndalusiteBonds.getDeepestChildren()[0], {opacity: 0.1});
        

        await presentation.nextSlide();

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
        await presentation.nextSlide();
        }


        [aVecArrow, bVecArrow, aPlusCVecArrow, cVecArrow].map(item => presentation.TransitionTo(item.getDeepestChildren()[0], {opacity: 0}))

        //non-movements time

        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 1});
        presentation.TransitionTo(movingAndalusiteBonds.getDeepestChildren()[0], {opacity: 0.2}, 250);

        presentation.TransitionTo(andalusite.children[0].material, {opacity: 0.3});
        presentation.TransitionTo(expAndalusiteBonds.getDeepestChildren()[0], {opacity: 0.1});

        presentation.TransitionInstantly(data, {andalusiteTranslationGroupOpacity: 0, andalusiteGroupOpacity: 1});

        function showElement(name){
            andGroup.elements.forEach((el, i) => {
                if(el.name == name){
                    let toValues = {};
                    toValues[i] = true;
                    presentation.TransitionInstantly(andalusiteVisibleElements, toValues);
                }
            })
        }
        function showKyaniteElement(name){
            kyGroup.elements.forEach((el, i) => {
                if(el.name == name){
                    let toValues = {};
                    toValues[i] = true;
                    presentation.TransitionInstantly(kyaniteVisibleElements, toValues);
                }
            })
        }
        function hideElement(name){
            andGroup.elements.forEach((el, i) => {
                if(el.name == name){
                    let toValues = {};
                    toValues[i] = false;
                    presentation.TransitionInstantly(andalusiteVisibleElements, toValues);
                }
            })
        }
        function changeArrow(startName, generatorName, newValue=true){
            let generatorIndex = andGroup.generators.indexOf(andGroup.getElemByName(generatorName));
            if(generatorIndex == -1)return;

            let toValues = {};
            toValues[generatorIndex] = newValue;

            let theseArrows = {};
            theseArrows[startName] = andalusiteVisibleArrows[startName];
            presentation.TransitionInstantly(andalusiteVisibleArrows, theseArrows)//tell svelte to update when undoing
            presentation.TransitionInstantly(andalusiteVisibleArrows[startName], toValues);  //show arrow from e to m
            presentation.TransitionInstantly(andalusiteVisibleArrows, theseArrows)//tell svelte to update when redoing
        }
        function changeKyaniteArrow(startName, generatorName, newValue=true){
            let generatorIndex = kyGroup.generators.indexOf(kyGroup.getElemByName(generatorName));
            if(generatorIndex == -1)return;

            let toValues = {};
            toValues[generatorIndex] = newValue;

            let theseArrows = {};
            theseArrows[startName] = kyaniteVisibleArrows[startName];
            presentation.TransitionInstantly(kyaniteVisibleArrows, theseArrows)//tell svelte to update when undoing
            presentation.TransitionInstantly(kyaniteVisibleArrows[startName], toValues);  //show arrow from e to m
            presentation.TransitionInstantly(kyaniteVisibleArrows, theseArrows)//tell svelte to update when redoing
        }

        window.showElement = showElement;
        window.hideElement = hideElement;
        window.changeArrow = changeArrow;

        showElement("e");


        if(!debugHideTranslations){

        await presentation.nextSlide();

        //show a mirror plane!

        presentation.TransitionTo(mirror1.getDeepestChildren()[0], {opacity: 0.8});

        //show m on the group
        showElement("m");
        changeArrow("e", "m", true)
        changeArrow("m", "m", true)

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


        changeArrow("e", "m2", true)
        changeArrow("m2", "m2", true)

        await presentation.nextSlide();

        presentation.TransitionTo(movingAndalusite.scale, {z: 1}, 2000);
        presentation.TransitionTo(movingAndalusite.position, {z: 2 * mirrorCenterZ + 6 * mirrorCenterZ2}, 2000);


        await presentation.nextSlide();

        changeArrow("m", "m2", true);
        showElement("c");

        let cTranslationStart = andalusiteData.atoms["Si"][0];

        presentation.TransitionTo(cVecArrow.getDeepestChildren()[0], {opacity: 0.9})
        presentation.TransitionInstantly(cVecArrow.children[0], {expr: (i,t,x,y,z) => cTranslationStart});
        presentation.TransitionTo(cVecArrow.children[0], {expr: (i,t,x,y,z) => i == 0 ? cTranslationStart : EXP.Math.vectorAdd(cTranslationStart, displayedCVec)});

        await presentation.nextSlide();

        //todo: hide arrow

        presentation.TransitionTo(movingAndalusite.position, {z: 0}, 500);
        presentation.TransitionTo(cVecArrow.getDeepestChildren()[0], {opacity: 0}, 500)

        await presentation.delay(500);
        presentation.TransitionTo(movingAndalusite.scale, {z: -1}, 1000);
        presentation.TransitionTo(movingAndalusite.position, {z: 2 * mirrorCenterZ2}, 1000);
        await presentation.delay(1000);

        presentation.TransitionTo(movingAndalusite.scale, {z: 1}, 1000);
        presentation.TransitionTo(movingAndalusite.position, {z: 6 * mirrorCenterZ + 2 * mirrorCenterZ2}, 1000);


        await presentation.delay(1000);


        changeArrow("m2", "m", true);
        showElement("c⁻¹");

        let oppositeCVec = EXP.Math.vectorScale(displayedCVec, -1);

        presentation.TransitionTo(cVecArrow.getDeepestChildren()[0], {opacity: 1}, 500);
        presentation.TransitionTo(cVecArrow.children[0], {expr: (i,t,x,y,z) => i == 0 ? cTranslationStart : EXP.Math.vectorAdd(cTranslationStart, oppositeCVec)});

        await presentation.nextSlide();
        await presentation.nextSlide();


        await presentation.nextSlide();
        presentation.TransitionTo(changeData, {groupEquationProgress:1}, 500);
        await presentation.nextSlide();
        presentation.TransitionTo(changeData, {groupEquationProgress:2}, 500);
        await presentation.nextSlide();
        presentation.TransitionTo(changeData, {groupEquationProgress:3}, 500);
        await presentation.nextSlide();
        presentation.TransitionTo(changeData, {groupEquationProgress:4}, 500);

        await presentation.nextSlide();
        presentation.TransitionTo(changeData, {groupEquationProgress:5}, 500);
        changeArrow("m", "c", true);

        await presentation.nextSlide();

        let newcTranslationStart = EXP.Math.vectorAdd(cTranslationStart, [0,0,mirrorCenterZ])
        presentation.TransitionTo(cVecArrow.children[0], {expr: (i,t,x,y,z) => i == 0 ? newcTranslationStart : EXP.Math.vectorAdd(newcTranslationStart, displayedCVec)});

        await presentation.nextSlide();
        presentation.TransitionTo(changeData, {groupEquationProgress:0}, 500);
        presentation.TransitionTo(cVecArrow.getDeepestChildren()[0], {opacity: 0})
        presentation.TransitionTo(movingAndalusite.position, {z: 0}, 1000);


        changeArrow("m", "c", false);
        changeArrow("e", "m2", false);
        changeArrow("m2", "m2", false);
        changeArrow("m", "m2", false);
        hideElement("m2");

        changeArrow("m2", "m", false);
        hideElement("c⁻¹");
        
        }
        await presentation.nextSlide();

        //move camera

        presentation.ResetTo(three.camera.position, {x: 0, y:0, z: 50});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:0, z: 0});
        presentation.TransitionTo(three.camera, {zoom: 4});

        await presentation.delay(1000);

        presentation.TransitionTo(movingAndalusite.rotation, {z:Math.PI}, 2000);

        changeArrow("e", "r", true);
        showElement("r");

        //just in case
        changeArrow("e", "m", true);
        changeArrow("m", "m", true);
        showElement("m");

        await presentation.nextSlide();

        presentation.TransitionTo(movingAndalusite.rotation, {z:Math.PI*2}, 1000);

        changeArrow("r", "r", true);

        //ok enough reflection. it's glide reflection time.

        await presentation.nextSlide();

        presentation.TransitionTo(mirror1.getDeepestChildren()[0], {opacity: 0});
        presentation.TransitionTo(mirror2.getDeepestChildren()[0], {opacity: 0});


        presentation.TransitionTo(mirror3.getDeepestChildren()[0], {opacity: 0.9});

        await presentation.nextSlide();

        await presentation.delay(1000);

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
        showElement("g");
        changeArrow("e", "g", true);

        await presentation.nextSlide();

        await presentation.nextSlide();
    
        //"alright, we have all the tools we need to start combining"

        presentation.TransitionTo(movingAndalusite.scale, {y: 1}, 1000);
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y: 0, z: 0 }, 1000);

        await presentation.nextSlide();

        //rotate + g = another glide reflection

        //rotate...
        presentation.TransitionTo(movingAndalusite.rotation, {z:Math.PI}, 1000);
        await presentation.delay(1000);

        //reflect...
        presentation.TransitionTo(movingAndalusite.scale, {y: -1}, 2000);
        //presentation.TransitionTo(movingAndalusite.position, {y: mirrorCenterY * 2}, 2000);
        //glide.
        //found using http://img.chem.ucl.ac.uk/sgp/LARGE/058az1.htm
        presentation.TransitionTo(movingAndalusite.position, {x: andalusiteData.aVec[0]/2, y: mirrorCenterY * 2, z: andalusiteData.cVec[2]/2 }, 2000);

        changeArrow("r", "g", true);

        await presentation.nextSlide();

        //demonstrate glide reflection #2
    
        //show glide plane #2
        presentation.TransitionTo(movingAndalusite.scale, {y: 1}, 500);
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y: 0, z: 0 }, 500);
        presentation.TransitionTo(mirror3.getDeepestChildren()[0], {opacity: 0});
        presentation.TransitionTo(mirror4.getDeepestChildren()[0], {opacity: 0.9});

        showElement("rg");

        await presentation.delay(1000);

        presentation.TransitionTo(movingAndalusite.scale, {x: -1}, 1000);
        presentation.TransitionTo(movingAndalusite.position, {x: mirrorCenterX * 2}, 1000);

        await presentation.delay(1000);

        presentation.TransitionTo(movingAndalusite.position, {x: mirrorCenterX * 2, y: andalusiteData.bVec[1]/2, z: andalusiteData.cVec[2]/2 }, 2000);

        showElement("rg");
        changeArrow("r", "g", true);

        await presentation.nextSlide();

        //prepare camera for new things

        //hey if you glire rotate twice you get a normal thing

        presentation.TransitionTo(movingAndalusite.scale, {x: 1}, 1000);
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y: andalusiteData.bVec[1], z: andalusiteData.cVec[2]}, 1000);

        changeArrow("e", "rg", true);
        changeArrow("rg", "rg", true);
        changeArrow("g", "g", true);

        showElement("cb");
        showElement("ca");

        await presentation.nextSlide();
        presentation.TransitionTo(mirror4.getDeepestChildren()[0], {opacity: 0});

        showElement("ba");
        showElement("a");
        showElement("b");
        showElement("c");
        changeArrow("c", "b", true);
        changeArrow("b", "c", true);
        changeArrow("a", "c", true);
        changeArrow("c", "a", true);

        changeArrow("a", "b", true);
        changeArrow("b", "a", true);

        changeArrow("e", "a", true);
        changeArrow("e", "b", true);
        changeArrow("e", "c", true);

        await presentation.nextSlide();
        await presentation.nextSlide();

        hideElement("ba");
        hideElement("a");
        hideElement("b");
        hideElement("c");
        changeArrow("c", "b", false);
        changeArrow("b", "c", false);
        changeArrow("a", "c", false);
        changeArrow("c", "a", false);

        changeArrow("a", "b", false);
        changeArrow("b", "a", false);

        changeArrow("e", "a", false);
        changeArrow("e", "b", false);
        changeArrow("e", "c", false);

        //also hide double things
        hideElement("ca"); 
        hideElement("cb"); 
        changeArrow("g", "g", false);

        await presentation.nextSlide();

        //Anyway, let's keep combining.

        presentation.TransitionTo(movingAndalusite.scale, {x:1, y: 1, z:1}, 1000);
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y: 0, z: 0 }, 1000);

        presentation.ResetTo(three.camera.position, {x: cameraRadius, y:-1, z: 0});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:Math.PI/2, z: 0});

        presentation.TransitionTo(movingAndalusite.rotation, {x: 0, y: 0, z: 0 }, 1000);
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y: 0, z: 0 }, 1000);
        presentation.TransitionTo(movingAndalusite.scale, {x: 1, y: 1, z: 1 }, 1000);

        presentation.TransitionInstantly(data, {andalusiteGroupOffset: "translate(7em, 0)"});

        await presentation.nextSlide();

        presentation.TransitionTo(inversionArrow1.getDeepestChildren()[0], {opacity: 1}, 500);
        presentation.TransitionTo(inversionArrow2.getDeepestChildren()[0], {opacity: 1}, 500);

        await presentation.delay(500);

        presentation.TransitionTo(movingAndalusite.position, {x: inversionCenter[0]*2, y: inversionCenter[1]*2, z: inversionCenter[2]*2}, 2000);
        presentation.TransitionTo(movingAndalusite.scale, {x: -1, y: -1, z: -1}, 2000);

        let inversionName = "rm";
        showElement(inversionName);
        changeArrow("m", "r", true);
        changeArrow("r", "m", true);
        changeArrow(inversionName, "r", true);
        changeArrow(inversionName, "m", true);

        await presentation.nextSlide();

        //un-invert

        presentation.TransitionTo(movingAndalusite.position, {x: 0, y: 0, z: 0 }, 1000);
        //presentation.TransitionTo(movingAndalusite.position, {x: andalusiteData.aVec[0]/2, y: 0, z: andalusiteData.cVec[2]/2 }, 2000);
        presentation.TransitionTo(movingAndalusite.scale, {x: 1, y: 1, z: 1}, 2000);

        await presentation.nextSlide();

        presentation.TransitionTo(inversionArrow1.getDeepestChildren()[0], {opacity: 0}, 1000);
        presentation.TransitionTo(inversionArrow2.getDeepestChildren()[0], {opacity: 0}, 1000);

        //introduce glide rotation

        showElement("mg");
        changeArrow("m", "g", true);
        showElement(inversionName+"g");
        changeArrow(inversionName, "g", true);

        //glide rotation

        presentation.TransitionTo(movingAndalusite.rotation, {x: 0, y: Math.PI, z: 0 }, 3000);
        presentation.TransitionTo(movingAndalusite.position, {x: 3*andalusiteData.aVec[0]/2, y: andalusiteData.bVec[1]/2, z: andalusiteData.cVec[2]/2 }, 3000);

        await presentation.nextSlide();

        await presentation.nextSlide();
        await presentation.nextSlide();


        //hey it's different if you change the order

        showElement("gm")
        changeArrow("g", "m", true);
        changeArrow("gm", "m", true);

        await presentation.nextSlide();
        changeArrow("mg", "c", true);

        await presentation.nextSlide();

        await presentation.nextSlide();
        await presentation.nextSlide();
        console.log('end abelian talk')
        showElement("rgm")
        changeArrow("rgm", "c", true);
        changeArrow("rg", "m", true);
        changeArrow("rgm", "m", true);

        presentation.TransitionTo(three.camera, {zoom: 2})
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y: 0, z: 0 }, 1000);
        presentation.TransitionTo(movingAndalusite.rotation, {x: 0, y: 0, z: 0 }, 1000);

        //r-direction ones
        /*
        showElement("mgr")
        changeArrow("mg", "r", true);
        changeArrow("mgr", "r", true);

        showElement("gr")
        changeArrow("g", "r", true);
        changeArrow("gr", "r", true);*/

        await presentation.nextSlide();
        await presentation.nextSlide();

        //hide andalusite

        presentation.TransitionTo(three.camera.position, {x: 0, y:0,z:40})
        presentation.TransitionTo(three.camera.rotation, {y: 0})

        presentation.TransitionTo(andalusite.children[0].material, {opacity: 0}, 500);
        presentation.TransitionTo(expAndalusiteBonds.getDeepestChildren()[0], {opacity: 0}, 500);
        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 0}, 500);
        presentation.TransitionTo(movingAndalusiteBonds.getDeepestChildren()[0], {opacity: 0}, 500);

        //fly into the sky
        presentation.TransitionTo(andalusite.position, {x: 0, y: 50, z: 0 }, 1000);
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y: 50, z: 0 }, 1000);

        //kyanite, reveal yourself
        presentation.TransitionTo(kyanite.position, {x: 0, y: 0, z: 0 }, 1000);
        presentation.TransitionTo(movingKyanite.position, {x: 0, y: 0, z: 0 }, 1000);

        //show kyanite
        presentation.TransitionTo(kyanite.children[0].material, {opacity: 0.2});
        presentation.TransitionTo(expKyaniteBonds.getDeepestChildren()[0], {opacity: 0.2});
        presentation.TransitionTo(movingKyanite.children[0].material, {opacity: 1});
        presentation.TransitionTo(movingKyaniteBonds.getDeepestChildren()[0], {opacity: 0.2});

        presentation.TransitionInstantly(data, {kyaniteGroupOpacity: 1, andalusiteGroupOpacity: 0});
        showKyaniteElement("e")

        await presentation.nextSlide();


        //show kyanite inversion

        showKyaniteElement("i")
        changeKyaniteArrow("e", "i", true)
        changeKyaniteArrow("i", "i", true)

        var twiceCenterVec = EXP.Math.vectorAdd(EXP.Math.vectorAdd(kyaniteData.aVec, kyaniteData.bVec), kyaniteData.cVec)
        presentation.TransitionTo(movingKyanite.scale, {x: -1, y: -1, z: -1 }, 2000);
        presentation.TransitionTo(movingKyanite.position, {x: twiceCenterVec[0], y: twiceCenterVec[1], z: twiceCenterVec[2] }, 2000);

        await presentation.nextSlide();

        //show both at the same time

        presentation.TransitionTo(three.camera, {zoom: 1});
        presentation.ResetTo(three.camera.position, {x: 0, y:-5, z: 80});
        presentation.ResetTo(three.camera.rotation, {x: 0, y:0, z: 0});

        presentation.TransitionTo(movingAndalusite.children[0].material, {opacity: 1}, 500);
        presentation.TransitionTo(movingAndalusiteBonds.getDeepestChildren()[0], {opacity: 0.2}, 500);

        //fly downwards
        //presentation.TransitionTo(andalusite.position, {x: 0, y: 10, z: 0 }, 1000);
        presentation.TransitionTo(movingAndalusite.position, {x: 0, y: 15, z: 0 }, 1000);

        //kyanite go down 
        presentation.TransitionTo(kyanite.position, {x: 3, y: -15, z: 0 }, 1000);
        //different position because of the inversion. scale is still -1 here
        presentation.TransitionTo(movingKyanite.position, {x: twiceCenterVec[0]+3, y: twiceCenterVec[1] -15, z: twiceCenterVec[2] }, 1000);


        presentation.TransitionInstantly(data, {kyaniteGroupOpacity: 1, andalusiteGroupOpacity: 1});

        presentation.TransitionInstantly(data, {andalusiteGroupOffset: "scale(0.7) translate(7em, 0)", kyaniteGroupOffset: "scale(0.7) translate(4em, 12em)"});


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
    #equations{
        z-index: 3;
    }
</style>

<div class="overlappingItemContainer noclick">
    <div class="overlappingItemContainer exp-text topThing">
        <div class="twocolumnsLeftBigger">
            <div class="threecanvascontainer column yesclick" id="threecanvas" style="z-index: 0"/>
            <div class="groupdisplay noclick" style="z-index: 1">
                <!--
                <div class="highlight fadeInImmediately" 
                    style:left={elemPositions !== undefined ? elemPositions.get(data.currentOrientation)[0] + "em":""} 
                    style:top={elemPositions !== undefined ? elemPositions.get(data.currentOrientation)[1]+ "em":""} /> -->
                <div class:tworows={_data.showBothColumns}>
                    {#if true}
                    <div class="groupcontainer"  style:opacity={_data.kyaniteGroupOpacity}>
                        <KyaniteSymmetryGroup bind:group={kyGroup} bind:positions={kyaniteElemPositions} bind:isElementVisible={kyaniteVisibleElements} bind:isArrowVisibleMap={kyaniteVisibleArrows} transform={_data.kyaniteGroupOffset}/>
                    </div>
                    {/if}
                    {#if true}
                    <div class="groupcontainer" style:opacity={_data.andalusiteTranslationGroupOpacity}>
                        <AndalusiteTranslationSymmetryGroup bind:group={andTranslationGroup} bind:positions={andalusiteTranslationElemPositions} bind:isElementVisible={andalusiteTranslationVisibleElements}  bind:isArrowVisibleMap={andalusiteTranslationVisibleArrows} transform={_data.translationGroupOffset}/>
                    </div>
                    {/if}
                    {#if true}
                    <div class="groupcontainer" style:opacity={_data.andalusiteGroupOpacity}>
                            <AndalusiteSymmetryGroup bind:group={andGroup} bind:positions={andalusiteElemPositions} bind:isElementVisible={andalusiteVisibleElements}  bind:isArrowVisibleMap={andalusiteVisibleArrows} transform={_data.andalusiteGroupOffset} />
                    </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <div class="exp-slide-1 nomouse newchaptercard" style="z-index: 3">
        <div class="frostedbg">
            <h1>Chapter 4</h1>
            <p>Cracking the Crystal Conundrum</p>
        </div>
    </div>

    {#if groupEquationProgress > 0}
    <div id="equations" style:opacity={Math.max(0, Math.min(1, groupEquationProgress))}>
        <div class="frostedbg" style="width: 15em;  margin: 0 auto;">
            <p style:opacity={Math.max(0, Math.min(1, groupEquationProgress))}>
                <b style={"color: " + mirrorColor}>m</b> * <b style={"color: " + mirrorColor2}>m2</b> = <b style={"color: " + cVecColor}>c</b>
            </p>
            <p style:opacity={Math.max(0, Math.min(1, groupEquationProgress-1))}>
                <b style={"color: " + mirrorColor}>m</b> * <b style={"color: " + mirrorColor2}>m2</b> * <b style={"color: " + mirrorColor2}>m2</b> = <b style={"color: " + cVecColor}>c</b>* <b style={"color: " + mirrorColor2}>m2</b></p>
            <p style:opacity={Math.max(0, Math.min(1, groupEquationProgress-2))}><b style={"color: " + mirrorColor}>m</b> * (<b style={"color: " + mirrorColor2}>m2</b>* <b style={"color: " + mirrorColor2}>m2</b>) = <b style={"color: " + cVecColor}>c</b>* <b style={"color: " + mirrorColor2}>m2</b></p>
            <p style:opacity={Math.max(0, Math.min(1, groupEquationProgress-3))}><b style={"color: " + mirrorColor}>m</b> * (e) = <b style={"color: " + cVecColor}>c</b>* <b style={"color: " + mirrorColor2}>m2</b></p>
            <p style:opacity={Math.max(0, Math.min(1, groupEquationProgress-3))}><b style={"color: " + mirrorColor}>m</b> = <b style={"color: " + cVecColor}>c</b>* <b style={"color: " + mirrorColor2}>m2</b>
            </p>
        </div>
    </div>
    {/if}


    <div class="bottomThing noclick" style="z-index: 2">
        <div class="overlappingItemContainer alignBottom">
            {#if !debugDisableTranslationPart}
            <div class="exp-slide">
                    <div class="frostedbg">
                        We started this journey by asking "How can we describe the difference between andalusite and kyanite?"
                        <br>Now, let's use symmetry groups to answer that question.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        In chapter 2, we saw that andalusite's symmetry group included several <b>movements</b>, in various different directions.
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
                        What happens if we took these actions and kept combining them? We're starting with movement actions, and combining two movements creates another movement, so we'd get a subgroup of andalusite's symmetry group consisting of only movements.
                    </div>
            </div>
          <div class="exp-slide">
                    <div class="frostedbg">
                        This movements-only subgroup forms a kind of grid-like structure. You can follow any arrow to perform an action, or follow the arrow backwards to undo that action.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        As it turns out, for any crystal, the Cayley graph of the movements-only subgroup will always form this cube-like structure. The movement actions themselves might vary (in kyanite, they don't form 90 degree angles), but this subgroup's Cayley graph will always look like an infinite 3D grid. Geologists call a crystal's movements-only subgroup its "Bravais lattice".
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        In fact, for decades we thought every single material on earth had a Bravais lattice. Despite years of geology, it took until the 1980s to discover repeating patterns of atoms whose symmetry group didn't have any movement actions at all. The discoverer of those "quasicrystals" was awarded a Nobel Prize.
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
                        In one direction, Andalusite has a <b style={"color: " + mirrorColor}>mirror symmetry across <b style={"color: " + mirrorColor}>this plane</b>.
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
                        Interestingly, even though doing the same mirror twice in a row returns you to where you started, doing <b style={"color: " + mirrorColor}>the first mirror</b>, then <b style={"color: " + mirrorColor2}>the second mirror</b>, seems to result in <b style={"color: " + cVecColor}>a movement perpendicular to the mirror plane</b>.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        And if you do the mirrors in a different order, <b style={"color: " + mirrorColor2}>second mirror</b> then <b style={"color: " + mirrorColor}>first mirror</b>, you get <b style={"color: " + cVecColor}>a movement in the other direction</b>.
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
                        We saw that combining <b style={"color: " + mirrorColor}>the first mirror</b> (which I'll call "<b style={"color: " + mirrorColor}>m</b>") with <b style={"color: " + mirrorColor2}>the second mirror</b> (which I'll call "<b style={"color: " + mirrorColor2}>m2</b>") will get you <b style={"color: " + cVecColor}>a perpendicular movement</b> (which I'll call "<b style={"color: " + cVecColor}>c</b>" for combination).
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        We can write this as an equation, with * standing for combining actions by doing one after the other:
                        <br><b style={"color: " + mirrorColor}>m</b> * <b style={"color: " + mirrorColor2}>m2</b> = <b style={"color: " + cVecColor}>c</b>
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Now, if we combine the action on both sides of the equation with <b style={"color: " + mirrorColor2}>m2</b>...
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Since this is a group, the group rules allow us to use parentheses, so let's group these two <b style={"color: " + mirrorColor2}>m2</b>s.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Now, <b style={"color: " + mirrorColor2}>m2</b> is a mirror action, and mirroring something twice is the same as no action whatsoever.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        In summary, we see <b style={"color: " + mirrorColor}>m</b> = <b style={"color: " + cVecColor}>c</b> * <b style={"color: " + mirrorColor2}>m2</b>.
                        <br> This equation tells us that <b style={"color: " + mirrorColor}>the first mirror action</b> is the same as <b style={"color: " + cVecColor}>moving</b> before <b style={"color: " + mirrorColor2}>mirroring</b>. So these mirror actions are just moved versions of one another.
                        <br>
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        So if you start with <b style={"color: " + mirrorColor}>one mirror</b>, you can <b style={"color: " + cVecColor}>move perpendicular to the mirror plane</b> as many times as you want and the result will still be a <b style={"color: " + mirrorColor2}>mirror action</b>! And that's why there are infinitely many mirror actions.
                        <br>Manipulating actions in the form of equations is one of the core ideas of group theory.
                    </div>
            </div>
            {/if}

            <div class="exp-slide">
                    <div class="frostedbg">
                        For us, this means I can simplify the Cayley graph by only drawing one mirror action, and remembering we can make more by combining other actions.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Another action in andalusite's symmetry group is a <b style={"color: " + rotationColor}>180 degree rotation</b> around the plane of the <b style={"color: " + mirrorColor}>mirror action</b> we just saw.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        As usual for <b style={"color: " + rotationColor}>180 degree rotation</b>, doing it twice will get us back to where we started.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Anyway, speaking of mirror planes, what about other planes? Is Andalusite mirror symmetric along <b style={"color: " + glidePlaneColor1}>this plane</b>?
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Unfortunately, andalusite is only mirror symmetric using <b style={"color: " + mirrorColor}>that one plane</b> we saw. This mirror will leave them slightly misaligned. Look at the checkerboard pattern of red <b style={"color:" + getAtomColor("O")}>oxygen</b> atoms and their lighter red original places.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        But we can realign the atoms by moving along the <b style={"color: " + glidePlaneColor1}>same plane</b>.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        A combination of a mirror and a small movement parallel to that mirror plane is called a "<b style={"color: " + glidePlaneColor1}>glide reflection</b>". (If the movement was perpendicular to the mirror plane, we'd get another mirroring, like we just saw before!)
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Interestingly, if you do only the small movement or only the reflection, not both, it won't realign andalusite with itself. You need both the glide and the reflection together to be a valid element of andalusite's symmetry group.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Alright, we have all the tools we need to start combining.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        First, if we <b style={"color: " + rotationColor}>rotate</b> before doing a <b style={"color: " + glidePlaneColor1}>glide reflection</b>, it combines to make a different glide reflection. This glide reflection both reflects and moves around different planes and axes.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Here's what the combined glide reflection looks like. It reflects and moves around different planes and axes than <b style={"color: " + glidePlaneColor1}>our first one</b>.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        One interesting fact about a <b style={"color: " + glidePlaneColor1}>glide reflection</b> is that if you do one twice, the two reflection parts cancel out and you get just a movement.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        In fact, we saw these movements earlier as part of the movements-only subgroup!
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        When drawn this way, you can see an asymmetry in andalusite: andalusite is only <b style={"color: " + mirrorColor}>mirror symmetric</b> in one axis, but not the other two (which have glide reflections instead). 
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        In fact, that asymmetry actually translates to a property you can see in crystals: andalusite crystals tend to be rectangular prisms, longer in the direction of <b style={"color: " + cVecColor}>movement c</b>, perpendicular to the <b style={"color: " + mirrorColor}>mirror planes</b>.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Anyway, let's keep combining. 
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Combining a <b style={"color: " + rotationColor}>180 degree rotation</b> with a <b style={"color: " + mirrorColor}>mirror along the rotation plane</b> creates an "<b style={"color: " + inversionColor}>inversion</b>". If you see a geologist putting lines on top of numbers when naming groups, like P<span style="text-decoration:overline;">nm2</span>, it means there's inversion symmetry.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Inversion symmetry is, confusingly, unrelated to the "undo in a group" inverse or the function 1/x. The action sends a point at [x,y,z] to [-x,-y,-z]. Think of it as a reflection "through a point" (specifically, the point [0,0,0]), as opposed to other reflections "through a plane".
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Finally, <b style={"color: " + mirrorColor}>mirroring</b> before doing a <b style={"color: " + glidePlaneColor1}>glide reflection</b> will give you a <b style={"color: " + glideRotationColor1}>glide rotation</b>: a combination of a rotation, then movement along the same axis. It's the same action a screw makes when you tighten one.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        We're nearly done with andalusite's non-translations Cayley graph. There's only a few arrows left to draw. Doesn't this pattern look like a cube? It almost feels like we should be drawing <b style={"color: " + mirrorColor}>mirror</b> and <b style={"color: " + rotationColor}>rotate</b> lines on the bottom of the graph, parallel to the ones on the top half.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Let's look at the bottom right corner of the cayley graph. If we do a <b style={"color: " + glidePlaneColor1}>glide reflection</b>, then <b style={"color: " + mirrorColor}>mirror</b>, to find <b style={"color: " + glidePlaneColor1}>g</b><b style={"color: " + mirrorColor}>m</b>...
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Hmm. <b style={"color: " + glidePlaneColor1}>g</b><b style={"color: " + mirrorColor}>m</b> is a <b style={"color: " + glideRotationColor1}>glide rotation, alright</b>... but it's not <b style={"color: " + defaultGroupElementBorderColor}>m*g</b>. This one is rotating around a different axis.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        They're close, at least. You can turn the glide rotations into one another using just a <b style={"color: " + cVecColor}>movement c</b>. But the order you combine these actions seems to matter: <b style={"color: " + glidePlaneColor1}>g</b> * <b style={"color: " + mirrorColor}>m</b> ≠ <b style={"color: " + glidePlaneColor1}>m</b> * <b style={"color: " + mirrorColor}>g</b>. Addition and multiplication aren't like that.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Never fear! Mathematicians have names for this exact scenario. If the order you combine two things doesn't matter, like how 2*3=3*2 or <b style={"color: " + rotationColor}>r</b> * <b style={"color: " + mirrorColor}>m</b> = <b style={"color: " + mirrorColor}>m</b> * <b style={"color: " + rotationColor}>r</b>, then those things <b>"commute"</b>. In other words, we just saw that <b style={"color: " + glidePlaneColor1}>g</b> and <b style={"color: " + mirrorColor}>m</b> don't commute. 
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        By the way, groups where everything commutes with everything else, so order never matters, are called <b>Abelian groups</b> (named after mathematician Niels Henrik Abel). Adding numbers and andalusite's movement-only subgroup are both Abelian, while D<sub>6</sub> and andalusite's symmetry group aren't Abelian.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        So, here's what the non-movements part of Andalusite's symmetry group looks like!
                        There are similar structures all across the symmetry group, created by combining different movements with one of these elements.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        In summary: with a rotation, a mirror, a glide reflection, and a ton of movements we saw earlier, you can combine elements to create Andalusite's entire symmetry group.
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Kyanite, on the other hand, has a much simpler symmetry group.
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        Kyanite only has one non-translation action: inversion. That's it!
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        So, to answer our original question, how can we tell apart kyanite and andalusite? The answer: their symmetry groups are incredibly different!
                    </div>
            </div>
            <div class="exp-slide">
                    <div class="frostedbg">
                        In conclusion, "turn things into groups, then see if the groups are different" is a very useful strategy. Topologists, for example, can study things like surfaces and 4D spaces using "fundamental groups". Physicists can study particle physics using "Lie groups".
                    </div>
            </div>

            <div class="exp-slide">
                    <div class="frostedbg">
                        Looking at symmetry groups can uncover lots of info that isn't necessarily clear at first glance - such as why we could see clearly through our crystals.
                        <br>And that's why mathematicians care about group theory.
                    </div>
            </div>
        </div>
    </div>
</div>
