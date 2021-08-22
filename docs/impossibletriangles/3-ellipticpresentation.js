
import {elliptic_curve_add, LongLineThrough} from "./3-congruentutilities.js";
import {gridColor, xColor, yColor, triangleVisArrowColor, validIntegerColor, rColor, sColor, tColor} from "./colors.js";

import {Dynamic3DText} from "./katex-labels.js";
import {addColorToHTML, AutoColoring3DText, ColorSuccessiveNumbers3DText} from './2-addColorToHTMLMath.js';
addColorToHTML();

import {makeLabeledCurve, makeTriangle} from "./3-makethings.js"

const pointSize = 0.4;
const pointColor = 0xff7070;
const additionLineColor = 0xbf5050;

async function setup(){
    window.three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));

	three.camera.position.set(0,0,10);
	three.camera.lookAt(new THREE.Vector3(0,0,0));

    three.camera.position.z *= 10;
    three.camera.zoom *= 10; //remove distortion from FOV and appear orthographic
    three.camera.updateProjectionMatrix();

	console.log("Loaded.");



    //elliptic curve
    let p=-36, q=0;
    let curveY = (x)=>Math.sqrt(Math.abs(x*x*x + p*x+q));
    let mainCurveCenterPos = [0,-1];
    let scaleFactor = 4;
    let [mainCurveObjects, mainCurveText, mainCurveProjection] = makeLabeledCurve(p,q, mainCurveCenterPos, [0,5], scaleFactor, 8);
    window.mainCurveObjects = mainCurveObjects;
    window.mainCurveText = mainCurveText;
    window.mainCurveProjection = mainCurveProjection;
    window.graphAxes = mainCurveObjects[mainCurveObjects.length-1];

    mainCurveText.opacity = 0;

    /* The two example elliptic curves */

    let [firstCurve1, label1, _] = makeLabeledCurve(-4,1, [4+20,-1], [1,3])
    let [firstCurve2, label2, __] = makeLabeledCurve(4,5, [-4+20,-1], [-1,3])

    window.allFirstCurves = firstCurve1.concat(firstCurve2)//.concat(firstCurve3).concat(firstCurve4);
    window.allFirstLabels = [label1, label2];
    //begin curves hidden
    allFirstCurves.forEach(curveObject => 
            curveObject.getDeepestChildren().forEach( (output) => {
                output.opacity = 0;
            }));
    allFirstLabels.forEach(object => {object.opacity = 0;})

	//two points to add on the curve
	window.points = [[-4.5,curveY(-4.5)],
					[-1.5,curveY(-1.5)]]

	window.ellipticpts = new EXP.Array({data: points});
	window.ellipticPtsoutput = new EXP.PointOutput({width:0.2,color:pointColor, opacity: 0});
	ellipticpts.add(mainCurveProjection.makeLink()).add(ellipticPtsoutput);

    /* 3-4-5 triangle */

    //the 3-4-5- triangle which corresponds to a point on the curve
    let triangleDisplayPos = [-6, 0]
    let [threeFourFiveTriangle, threeFourFiveTriangleAreaLabels] = makeTriangle(4,3, triangleDisplayPos);
    window.threeFourFiveTriangleAreaLabels = threeFourFiveTriangleAreaLabels;
    window.threeFourFiveTriangle = threeFourFiveTriangle;
    threeFourFiveTriangle.getDeepestChildren().forEach( (output) => {
            output.opacity = 0;
    });

    //point corresponding to 3-4-5 triangle

    //r,s,t = 1,5,7 corresponds to 6-8-10 triangle, so r,s,t = 1/2, 2.5, 3.5 works for n=6
    //then x = s^2 = 2.5^2 = 6.25
    //(6.25, 4.375) = (, 35/8)
    let threeFourFivePointX = 6.25;
    let threeFourFiveCurvePoint = [threeFourFivePointX, curveY(threeFourFivePointX)]
	window.threeFourFivePoint = new EXP.Array({data: [threeFourFiveCurvePoint]});
	window.threeFourFiveOutput = new EXP.PointOutput({width:pointSize,color:pointColor, opacity: 0});
	threeFourFivePoint.add(mainCurveProjection.makeLink()).add(threeFourFiveOutput);

    //the point on the elliptic curve
    let trianglePointLabel = EXP.Math.vectorAdd(mainCurveProjection.expr(0,0,...threeFourFiveCurvePoint), [0.5,0])
    window.threeFourFiveLabel = new AutoColoring3DText({ 
        text: "(\\frac{25}{4}, \\frac{35}{8})",
        position3D: trianglePointLabel,
        opacity: 0,
        align: 'right',
        frostedBG: true,
        customColors: {
            "25": xColor,
            "4": xColor,
            "35": yColor,
            "8": yColor,
        }
    })

    let labelTwoPos = EXP.Math.vectorAdd(mainCurveProjection.expr(0,0,...threeFourFiveCurvePoint), [-5,-5])
    window.threeFourFiveLabelTwo = new AutoColoring3DText({ //todo: color according to x and y colors
        text: "(r^2, s^2, t^2)",
        position3D: EXP.Math.vectorAdd(labelTwoPos, [2,1.5]),
        opacity: 0,
        align: 'left',
        frostedBG: true,
        customColors: {
            "1": rColor,
            "4": rColor,
        }
    })
    window.threeFourFiveLabelTwoPointFive = new ColorSuccessiveNumbers3DText({ //todo: color according to x and y colors
        text: "= (\\frac{1}{4}, \\frac{25}{4}, \\frac{49}{4})",
        position3D: EXP.Math.vectorAdd(labelTwoPos, [2,0]),
        opacity: 0,
        align: 'left',
        frostedBG: true,
        customColors: [rColor, sColor, tColor],
    })

    //arrow from triangle to s text
    window.threefourFiveArrow1 = new EXP.Array({data: [
        [labelTwoPos[0], triangleDisplayPos[1]-0.5],
        EXP.Math.vectorAdd(labelTwoPos, [0,2])
    ]});
    threefourFiveArrow1.add(new EXP.VectorOutput({color: triangleVisArrowColor, opacity: 0, width: 5}));

    //arrows between the things

    let labelThreePos = EXP.Math.vectorAdd(mainCurveProjection.expr(0,0,...threeFourFiveCurvePoint), [0,-5])
    window.threeFourFiveLabelThree = new AutoColoring3DText({ //todo: color according to x and y colors
        text: "x = s^2 = \\frac{25}{4}",
        position3D: labelThreePos,
        opacity: 0,
        align: 'right',
        frostedBG: true,
        customColors: {
            "25": xColor,
            "4":  xColor,
        }
    })

    window.threefourFiveArrow2 = new EXP.Array({data: [
        EXP.Math.vectorAdd(labelTwoPos, [2,0]),
        EXP.Math.vectorAdd(labelThreePos, [-0.5,0])
    ]});
    threefourFiveArrow2.add(new EXP.VectorOutput({color: triangleVisArrowColor, opacity: 0, width: 5}));

    //arrows between the things
    window.threefourFiveArrow3 = new EXP.Array({data: [
        EXP.Math.vectorAdd(labelThreePos, [2,1]),
        EXP.Math.vectorAdd(trianglePointLabel, [0.5,-1])
    ]});
    threefourFiveArrow3.add(new EXP.VectorOutput({color: triangleVisArrowColor, opacity: 0, width: 5}));


    ///////////////////////

	//perform elliptic curve addition
	let p3 = elliptic_curve_add(points[0],points[1], [-2,1]);
    let lineLength = 10;
	window.additionLine = new LongLineThrough(points[0],points[1],additionLineColor, 2, lineLength);

	window.addedPoint = new EXP.Array({data: [[...p3,0]]});
    window.thirdPointControl = new EXP.Transformation({expr: (i,t,x,y) => EXP.Math.vectorAdd([x,y], mainCurveCenterPos)})
	window.pt3output = new EXP.PointOutput({width:0.0,color:pointColor});
	addedPoint.add(thirdPointControl).add(pt3output);






    let staticObjects = [graphAxes].concat(mainCurveObjects);
	let sceneObjects = ([ellipticpts, mainCurveText]); 

    staticObjects = staticObjects.concat(allFirstCurves);
    sceneObjects = sceneObjects.concat(allFirstLabels);
    sceneObjects = sceneObjects.concat([additionLine, addedPoint]);

    sceneObjects = sceneObjects.concat([threeFourFiveLabel, threeFourFiveLabelTwo, threeFourFiveLabelTwoPointFive, threeFourFiveLabelThree, threefourFiveArrow1, threefourFiveArrow2, threefourFiveArrow3]);
    sceneObjects = sceneObjects.concat(threeFourFiveTriangleAreaLabels);
    staticObjects = staticObjects.concat([threeFourFivePoint, threeFourFiveTriangle, ])
	three.on("update",function(time){
		sceneObjects.forEach(i => i.activate(time.t));
	});
	staticObjects.forEach(i => i.activate(0));
}

async function animate(){

    let presentation = new EXP.UndoCapableDirector();
    await presentation.begin();

    //presentation.TransitionTo(mainCurveProjection, {'expr':(i,t,x,y) => [x+5,y+5]}, 1000);
    mainCurveObjects.forEach(object => object.getDeepestChildren().forEach( async (output) => {
        presentation.TransitionTo(output, {'opacity':1}, 500);
    }))
    graphAxes.getDeepestChildren().forEach( async (output) => {
        presentation.TransitionTo(output, {'opacity':1}, 500);
    })
    await presentation.nextSlide();

    //Pan to other elliptic curves

    presentation.TransitionTo(three.camera.position, {x: 20}, 1000);
    await presentation.delay(500);
  
    //show other elliptic curves
    allFirstCurves.forEach(curveObject => curveObject.getDeepestChildren().forEach( async (output) => {
                await presentation.TransitionTo(output, {'opacity':1}, 1000);
            }));
    allFirstLabels.forEach(text => presentation.TransitionTo(text, {'opacity':1}, 1000))
    
    await presentation.nextSlide();
    
    presentation.TransitionTo(three.camera.position, {x: 0}, 1000);
	presentation.TransitionTo(mainCurveText,{opacity:1},1000);
    //hide other elliptic curves
    allFirstCurves.forEach(curveObject => curveObject.getDeepestChildren().forEach( async (output) => {
                await presentation.TransitionTo(output, {'opacity':0}, 1000);
            }));
    allFirstLabels.forEach(text => presentation.TransitionTo(text, {'opacity':0}, 1000))

    await presentation.nextSlide();
    await presentation.nextSlide();

    //big slide: show how we get from triangle to elliptic curve!

    //show triangle
    threeFourFiveTriangleAreaLabels.forEach(item => presentation.TransitionTo(item,{opacity:1},500));
    threeFourFiveTriangle.getDeepestChildren().forEach( (output) => presentation.TransitionTo(output, {'opacity':1}, 500));

    await presentation.nextSlide();

    //show arrow
	await presentation.delay(400);
    threefourFiveArrow1.getDeepestChildren().forEach( (output) => presentation.TransitionTo(output, {'opacity':1}, 500));

    //show s = 5/2 label and arrow
    await presentation.delay(500);
    presentation.TransitionTo(threeFourFiveLabelTwo,{opacity:1},500);
    presentation.TransitionTo(threeFourFiveLabelTwoPointFive,{opacity:1},500);
	
    
    await presentation.nextSlide();


    //show arrow
    threefourFiveArrow2.getDeepestChildren().forEach( (output) => presentation.TransitionTo(output, {'opacity':1}, 500));
    await presentation.delay(500);

    //show x = s^2 label
    presentation.TransitionTo(threeFourFiveLabelThree,{opacity:1},500);
	
    
    await presentation.nextSlide();

    //show arrow to curve point
    threefourFiveArrow3.getDeepestChildren().forEach( (output) => presentation.TransitionTo(output, {'opacity':1}, 500));
    await presentation.delay(500);

    //show point corresponding to 3-4-5 triangle
	presentation.TransitionTo(threeFourFiveOutput,{opacity:1, width:pointSize*3},400);
	presentation.TransitionTo(threeFourFiveLabel,{opacity:1},500);
	await presentation.delay(400);
	presentation.TransitionTo(threeFourFiveOutput,{width:pointSize},400);

    await presentation.nextSlide();

    function flipArrow(array, presentation){
        let arrowPts = [array.data[0], array.data[1]]
        presentation.TransitionTo(array.data[0], {0: arrowPts[1][0], 1: arrowPts[1][1]})
        presentation.TransitionTo(array.data[1], {0: arrowPts[0][0], 1: arrowPts[0][1]})
    }

    flipArrow(threefourFiveArrow1, presentation)
    flipArrow(threefourFiveArrow2, presentation)
    flipArrow(threefourFiveArrow3, presentation)

    
    await presentation.nextSlide();
    await presentation.nextSlide();
    //hide all the explanatory stuff
    [threeFourFiveTriangle, threefourFiveArrow1, threefourFiveArrow2, threefourFiveArrow3].forEach(curveObject => curveObject.getDeepestChildren().forEach((output) => {
                presentation.TransitionTo(output, {'opacity':0}, 1000);
            }));
    [threeFourFiveLabelTwo, threeFourFiveLabelTwoPointFive,  threeFourFiveLabelThree].concat(threeFourFiveTriangleAreaLabels).forEach( (output) => presentation.TransitionTo(output, {'opacity':0}, 1000));
    //flip arrows

    /*
    await presentation.nextSlide();

    //show points to add    
	presentation.TransitionTo(ellipticPtsoutput,{opacity:1, width:pointSize*3},400);
	await presentation.delay(400);
	presentation.TransitionTo(ellipticPtsoutput,{width:pointSize},400);

    await presentation.nextSlide();

    
	additionLine.revealSelf();

	await EXP.delay(1000);

	//draw 3rd point
	//animate a fancy point appear animation
	presentation.TransitionTo(pt3output,{opacity:1, width:pointSize*3},400);
	await presentation.delay(400);
	presentation.TransitionTo(pt3output,{opacity:1, width:pointSize},400);
	await presentation.delay(500);
    //reflect
	EXP.TransitionTo(thirdPointControl,{'expr':(i,t,a,b) => [a,-b]});
    */

}
window.addEventListener("load",function(){
    setup();
    animate();
})
