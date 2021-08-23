import {onThreejsMousedown, onThreejsMousemove, onThreejsMouseup} from "./1-mouseinteraction.js";
import {areAllSideLengthsIntegers, computeTriangleArea, colorHighlightingIrrationals, renderLengthHighlightingIrrationals} from "./1-computedTriangleProperties.js";
import {Dynamic3DText} from "./katex-labels.js";
import {gridColor, twoNColor, black, hintArrowColor, triangleLineColor, triangleGrabbableCornerColor, triangleNonGrabbableCornerColor} from "./colors.js";

import {addColorToHTML} from './2-addColorToHTMLMath.js';
addColorToHTML();

import {vecScale, vecAdd, dist, distSquared, isInteger, roundPointIfCloseToInteger, roundToIntegerIfClose, roundPoint, roundCoord} from "./1-trianglemath.js"

import {makeIntroObjects} from "./1-introShinies.js"

window.fixedPoint = [-1,-1];
window.draggablePoint = EXP.Math.vectorAdd([10,6], fixedPoint);
window.slidingHorizontalPoint = [draggablePoint[0],fixedPoint[1]];
window.trianglePoints = [fixedPoint, slidingHorizontalPoint, draggablePoint]



let sceneObjects = []
function setup(){
    window.three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
    //window.twoD = setup2DCanvas();
    //var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    three.camera.position.set(5,5,12);
    three.camera.lookAt(new THREE.Vector3(5,5,0))

    three.camera.position.z *= 5;
    three.camera.zoom *= 5; //remove distortion from FOV
    three.camera.updateProjectionMatrix();

    window.integerGrid = new EXP.Area({bounds: [[-10,19],[-10,19]], numItems: 30});
    integerGrid.add(new EXP.PointOutput({width: 0.2, color: gridColor, opacity:0})); //green grid

    window.triangleLine = new EXP.Array({data: [0,1,2,0]});
    let getTrianglePoints = triangleLine.add(new EXP.Transformation({'expr':(i,t,index) => trianglePoints[index]}))
    getTrianglePoints.add(new EXP.LineOutput({opacity:0, color: triangleLineColor})); //line between the triangles

    let grabbablePointSize = 0.5;

    window.grabbablePoints = new EXP.Array({data: [draggablePoint]});
    window.trianglePointsOutput = new EXP.PointOutput({color: triangleGrabbableCornerColor, width: grabbablePointSize, opacity:0});
    grabbablePoints.add(trianglePointsOutput);

    window.fixedPointDisplay = new EXP.Array({data: [fixedPoint, slidingHorizontalPoint]});
    fixedPointDisplay.add(new EXP.PointOutput({color: triangleNonGrabbableCornerColor, width: grabbablePointSize-0.1, opacity:0}));



    window.twentyFourHint = new EXP.Area({bounds: [[0,1]], numItems: 2});

    let hintTarget = [8+fixedPoint[0],6+fixedPoint[0]];
    twentyFourHint
        .add(new EXP.Transformation({'expr':(i,t) => i == 0 ? draggablePoint : vecAdd(vecScale(draggablePoint, 0.5),vecScale(hintTarget, 0.5))}))
        .add(new EXP.VectorOutput({opacity:0, color: hintArrowColor})); //line between the triangles


    //grab a point if you click on it
    let grabbedPointType = null;
    onThreejsMousedown(three, function(worldPoint){
        if(dist([worldPoint.x, worldPoint.y], draggablePoint) < grabbablePointSize+0.1){ //todo: dist isn't'
            //grab that point
            grabbedPointType = "draggable";
        }
    })

    //move a dragged point
    onThreejsMousemove(three, function(worldPoint){
        if(grabbedPointType != null){
            if(grabbedPointType == "draggable"){
                let [x,y] = roundPoint(worldPoint.x, worldPoint.y);
                draggablePoint[0] = x;
                draggablePoint[1] = y;

                slidingHorizontalPoint[0] = x;
                
            }
        }
    })
    //snap to grid
    onThreejsMouseup(three, function(worldPoint){
        if(grabbedPointType != null){
            let roundedX = roundCoord(worldPoint.x);
            let roundedY = roundCoord(worldPoint.y);
            if(grabbedPointType == "draggable"){
                draggablePoint[0] = roundedX;
                draggablePoint[1] = roundedY;

                slidingHorizontalPoint[0] = roundedX;
            }
            grabbedPointType = null;
        }
    })

    window.areaText = new Dynamic3DText({
        text: (t) => computeTriangleArea(trianglePoints),
        //color: (t) => isInteger(computeTriangleArea(trianglePoints)) ? validIntegerColor : invalidIntegerColor,
        color: twoNColor,
        position3D: (t) => vecScale(vecAdd(vecAdd(trianglePoints[0], trianglePoints[1]),trianglePoints[2]), 1/3), //midpoint
        opacity: 0
    })


    //Sides!


    window.side1Text = new Dynamic3DText({
        text: (t) => renderLengthHighlightingIrrationals(trianglePoints[0], trianglePoints[1]), 
        color: (t) => colorHighlightingIrrationals(trianglePoints[0], trianglePoints[1]),
        position3D: (t) => vecAdd(vecScale(vecAdd(trianglePoints[0], trianglePoints[1]),0.5), vecScale(trianglePoints[2], -0.0)),
        opacity: 0,
        frostedBG: true,
    })

    window.side2Text = new Dynamic3DText({
        text: (t) => renderLengthHighlightingIrrationals(trianglePoints[1], trianglePoints[2]), 
        color: (t) => colorHighlightingIrrationals(trianglePoints[1], trianglePoints[2]),
        position3D: (t) => {
            //move to the side if the triangle is small
            let sideMidpoint = vecScale(vecAdd(trianglePoints[1], trianglePoints[2]),0.5);
            if(Math.abs(sideMidpoint[0] - trianglePoints[0][0]) < 4){
                sideMidpoint[0] +=  1 * Math.sign(sideMidpoint[0] - trianglePoints[0][0])
            }
            return sideMidpoint;   
        },
        opacity: 0,
        frostedBG: true,
    })

    window.side3Text = new Dynamic3DText({
        text: (t) => renderLengthHighlightingIrrationals(trianglePoints[0], trianglePoints[2]), 
        color: (t) => colorHighlightingIrrationals(trianglePoints[0], trianglePoints[2]),
        position3D: (t) => {

            //move to the side if the triangle is small
            let sideMidpoint = vecScale(vecAdd(trianglePoints[0], trianglePoints[2]),0.5);
            if(Math.abs(sideMidpoint[0] - trianglePoints[0][0]) < 4){
                sideMidpoint[0] -=  1 * Math.sign(sideMidpoint[0] - trianglePoints[0][0])
                sideMidpoint[1] +=  1 * Math.sign(sideMidpoint[1] - trianglePoints[0][1])
            }
            return sideMidpoint;
        },
        opacity: 0,
        frostedBG: true,
    })

    window.dragMeText = new Dynamic3DText({
        text: (t) => "\\text{Drag me!}", 
        color: triangleGrabbableCornerColor,
        position3D: (t) => trianglePoints[2],
        opacity: 0,
        align: "top",
        frostedBG: true,
    })

    
    let staticSceneObjects = [integerGrid];
    sceneObjects = [triangleLine, areaText, side1Text, side2Text, side3Text, grabbablePoints, fixedPointDisplay, twentyFourHint, dragMeText]; 

    window.introObjects = makeIntroObjects();
    window.introSettings = {"introObjectsActive":true};

    three.on("update",function(time){
	    sceneObjects.forEach(i => i.activate(time.t));

	    if(introSettings.introObjectsActive)introObjects.forEach(i => i.activate(time.t));

        grabbablePoints.getDeepestChildren()[0].width = 0.5 + 0.1*Math.sin(time.t*2); //animate grabbable points
    });
    staticSceneObjects.forEach(i => i.activate(0));

    console.log("Loaded.");
}

async function animate(){
    let presentation = new EXP.UndoCapableDirector();
    await presentation.begin();
    await presentation.nextSlide();

    let introCount = 0;
    introObjects.forEach(object => object.getDeepestChildren().forEach( async (output) => {
        introCount += 1;
        await EXP.delay(500*introCount/5); //these are going to be running concurrently, which is a bit weird and messes with undoing
        if(output.opacity)presentation.TransitionTo(output, {'opacity':0}, 500);
    }))

    await presentation.delay(1000);
    integerGrid.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':1}, 500));
    await presentation.delay(250);
    grabbablePoints.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':1}, 500));
    fixedPointDisplay.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':1}, 500));
    await presentation.delay(250);
    triangleLine.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':1}, 500));
    await presentation.delay(250);
    
    //[integerGrid, triangleLine, grabbablePoints, fixedPointDisplay].forEach(item => item.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':1}, 500, {staggerFraction: 2/3})));
    presentation.TransitionTo(areaText, {opacity: 1});

    presentation.TransitionTo(introSettings, {introObjectsActive: false}, 1);

    await presentation.nextSlide();
    presentation.TransitionTo(side1Text, {opacity: 1});
    presentation.TransitionTo(side2Text, {opacity: 1});
    presentation.TransitionTo(side3Text, {opacity: 1});

    await presentation.nextSlide();
 
    //5-12-13 triangle
    presentation.TransitionTo(draggablePoint, {"0":12+fixedPoint[0], "1":5+fixedPoint[1]});
    presentation.TransitionTo(slidingHorizontalPoint, {"0":12+fixedPoint[0]});

	//await EXP.delay(3000);
	//EXP.TransitionTo(pt3output,{opacity:1, width:0.6},400);
    twentyFourHint.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':0}, 500));
    await presentation.nextSlide();

    presentation.TransitionTo(dragMeText, {'opacity':1}, 500);
    
    await presentation.nextSlide();



    presentation.TransitionTo(dragMeText, {'opacity':0}, 500);
    twentyFourHint.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':0}, 500));
    let target1 = [8+fixedPoint[0],6+fixedPoint[0]];
    presentation.TransitionTo(draggablePoint, {"0": target1[0], "1":target1[1]});
    presentation.TransitionTo(slidingHorizontalPoint, {"0":target1[0]});
    await presentation.nextSlide();
    await presentation.nextSlide();

    //to 6
    let target2 = [4+fixedPoint[0],3+fixedPoint[0]];


    presentation.TransitionTo(draggablePoint, {"0": target2[0], "1":target2[1]});
    presentation.TransitionTo(slidingHorizontalPoint, {"0":target2[0]});
    await presentation.nextSlide();


    presentation.TransitionTo(dragMeText, {'opacity':1}, 500);
    await presentation.nextSlide();
    presentation.TransitionTo(dragMeText, {'opacity':0}, 500);

    
    let target3 = [35/12+fixedPoint[0],24/5+fixedPoint[0]];
    presentation.TransitionTo(draggablePoint, {"0": target3[0], "1":target3[1]});
    presentation.TransitionTo(slidingHorizontalPoint, {"0":target3[0]});
    await presentation.nextSlide();
    
    let target4 = [780/323+fixedPoint[0],323/30+fixedPoint[0]];
    presentation.TransitionTo(draggablePoint, {"0": target4[0], "1":target4[1]});
    presentation.TransitionTo(slidingHorizontalPoint, {"0":target4[0]});
    await presentation.nextSlide();
    presentation.TransitionTo(dragMeText, {'opacity':1}, 500);
    await presentation.nextSlide();
    presentation.TransitionTo(dragMeText, {'opacity':0}, 500);

}
window.addEventListener("load",function(){
    setup();
    animate();
})
