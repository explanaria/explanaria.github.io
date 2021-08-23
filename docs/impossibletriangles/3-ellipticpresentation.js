
import {elliptic_curve_add, LongLineThrough} from "./3-congruentutilities.js";
import {gridColor, xColor, yColor, triangleVisArrowColor, reflectionLineColor, validIntegerColor, rColor, sColor, tColor} from "./colors.js";

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
    window.p=-36, window.q=0;
    window.curveY = (x)=>Math.sqrt(Math.abs(x*x*x + p*x+q));
    let mainCurveCenterPos = [0,-1];
    let scaleFactor = 4;
    let [mainCurveObjects, mainCurveText, mainCurveProjection] = makeLabeledCurve(p,q, mainCurveCenterPos, [0,5], scaleFactor, 8);
    window.mainCurveObjects = mainCurveObjects;
    window.mainCurveText = mainCurveText;
    window.mainCurveProjection = mainCurveProjection;
    window.graphAxes = mainCurveObjects[mainCurveObjects.length-1];

    mainCurveText.opacity = 0;

    /* The two example elliptic curves */

    let [firstCurve1, label1, _] = makeLabeledCurve(-4,1, [4+20,-1], [0,3])
    let [firstCurve2, label2, __] = makeLabeledCurve(4,5, [-4+20,-1], [0,3])

    window.allFirstCurves = firstCurve1.concat(firstCurve2)//.concat(firstCurve3).concat(firstCurve4);
    window.allFirstLabels = [label1, label2];
    //begin curves hidden
    allFirstCurves.forEach(curveObject => 
            curveObject.getDeepestChildren().forEach( (output) => {
                output.opacity = 0;
            }));
    allFirstLabels.forEach(object => {object.opacity = 0;})

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
    window.threeFourFiveCurvePoint = [threeFourFivePointX, curveY(threeFourFivePointX)]
	window.threeFourFivePoint = new EXP.Array({data: [threeFourFiveCurvePoint]});
	window.threeFourFiveOutput = new EXP.PointOutput({width:pointSize,color:pointColor, opacity: 0});
	threeFourFivePoint.add(mainCurveProjection.makeLink()).add(threeFourFiveOutput);

    //the point on the elliptic curve
    let trianglePointLabel = EXP.Math.vectorAdd(mainCurveProjection.expr(0,0,...threeFourFiveCurvePoint), [0,0])
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
    window.threeFourFiveLabelThreePointFive = new AutoColoring3DText({ //todo: color according to x and y colors
        text: "y = \\sqrt{r^2 \\cdot s^2 \\cdot t^2} = \\frac{35}{8}",
        position3D: EXP.Math.vectorAdd(labelThreePos, [0,1.5]),
        opacity: 0,
        align: 'right',
        frostedBG: true,
        customColors: {
            "35": yColor,
            "8":  yColor,
        }
    })

    window.threefourFiveArrow2 = new EXP.Array({data: [
        EXP.Math.vectorAdd(labelTwoPos, [2,0]),
        EXP.Math.vectorAdd(labelThreePos, [-0.5,0])
    ]});
    threefourFiveArrow2.add(new EXP.VectorOutput({color: triangleVisArrowColor, opacity: 0, width: 5}));

    //arrows between the things
    window.threefourFiveArrow3 = new EXP.Array({data: [
        EXP.Math.vectorAdd(labelThreePos, [2,2.5]),
        EXP.Math.vectorAdd(trianglePointLabel, [0.5,-1])
    ]});
    threefourFiveArrow3.add(new EXP.VectorOutput({color: triangleVisArrowColor, opacity: 0, width: 5}));


    ///////////////////////


	//two points to add on the curve
	window.pointXes = [-5.9, -0.8];
	window.ellipticpts = new EXP.Array({data: pointXes});
    let curvePts = ellipticpts.add(new EXP.Transformation({'expr': (i,t,x) => [x, curveY(x)]}))
	window.ellipticPtsoutput = new EXP.PointOutput({width:0.2,color:pointColor, opacity: 0});
	curvePts.add(mainCurveProjection.makeLink()).add(ellipticPtsoutput);

    let points = pointXes.map(x => [x, curveY(x)]); //todo: find a way to do this without leaking the abstractions
    curvePts.add(new EXP.Transformation({'expr': (i,t,x,y) => {
        points[i][0] = x;
        points[i][1] = y;
        return [];
    }}));

    window.additionPtLabel1 = new AutoColoring3DText({
        text: "P_1",
        position3D: (t) => mainCurveProjection.expr(0,0,...points[0]), //todo: find a way to do this without leaking the abstractions
        opacity: 0,
        align: 'top',
        frostedBG: true,
    })
    window.additionPtLabel2 = new AutoColoring3DText({
        text: "P_2",
        position3D: (t) => mainCurveProjection.expr(0,0,...points[1]), //todo: find a way to do this without leaking the abstractions
        opacity: 0,
        align: 'top',
        frostedBG: true,
    })

	//perform elliptic curve addition

    //P1+P2 on the elliptic curve
	let p3 = elliptic_curve_add(points[0],points[1], [p,q]);
    let p3Negative = [p3[0], -p3[1]];

    let lineLength = 10;
    //note: points[0] and points[1] aren't copies for some reason :( but I use that to animate the line later
	window.additionLine = new LongLineThrough(points[0],points[1],additionLineColor, 2, lineLength);
    additionLine.transform2.expr = mainCurveProjection.expr; //todo: use mainCurveProjection.makeLink()



	window.reflectionLine = new LongLineThrough(p3,p3Negative,reflectionLineColor, 2, lineLength);
    reflectionLine.transform2.expr = mainCurveProjection.expr; //todo: use mainCurveProjection.makeLink()


    window.additionPtLabel3 = new AutoColoring3DText({
        text: "P_1 + P_2",
        position3D: mainCurveProjection.expr(0,0,...p3),
        opacity: 0,
        align: 'bottom',
        frostedBG: true,
    })

	window.ellipticAdditionResult = new EXP.Array({data: [[...p3Negative]]});
    window.thirdPointControl = new EXP.Transformation({expr: (i,t,x,y) => [x,y]})
	window.ellipticAdditionResultOutput = new EXP.PointOutput({width:0.0,color:pointColor});
	ellipticAdditionResult.add(mainCurveProjection.makeLink()).add(thirdPointControl).add(ellipticAdditionResultOutput);



    window.threeFourFiveX = 25/4;
	window.PplusP = elliptic_curve_add([threeFourFiveX, curveY(threeFourFiveX)],[threeFourFiveX, curveY(threeFourFiveX)], [p,q]);
    window.PplusPNegative = [PplusP[0], -PplusP[1]];

    let twoPX = PplusP[0];
	window.PplusPplusP = elliptic_curve_add(PplusP,[threeFourFiveX, curveY(threeFourFiveX)], [p,q]);
    window.PplusPplusPNegative = [PplusPplusP[0], -PplusPplusP[1]];
    window.PplusPplusPLabel = new AutoColoring3DText({
        text: "P_1 + P_1 + P_1",
        position3D: mainCurveProjection.expr(0,0,...PplusPplusP),
        opacity: 0,
        align: 'left',
        frostedBG: true,
    })
	window.PplusPplusPPoint = new EXP.Array({data: [[...PplusPplusPNegative]]});
	window.PplusPplusPOutput = new EXP.PointOutput({width:0.3,color:pointColor, opacity: 0});
    PplusPplusPPoint.add(mainCurveProjection.makeLink()).add(PplusPplusPOutput)

    /*
    let threePX = PplusPplusP[0];
	window.PplusPplusPplusP = elliptic_curve_add([threePX, curveY(threePX)],[threeFourFiveX, curveY(threeFourFiveX)], [p,q]);
    window.PplusPplusPplusPNegative = [PplusPplusPplusP[0], -PplusPplusPplusP[1]];
    window.pointTimes4 = new AutoColoring3DText({
        text: "P_1 + P_1 + P_1 + P_1",
        position3D: mainCurveProjection.expr(0,0,...PplusPplusPplusP),
        opacity: 1,
        align: 'bottom',
        frostedBG: true,
    })*/


    let staticObjects = [graphAxes].concat(mainCurveObjects);
	let sceneObjects = ([ellipticpts, mainCurveText]); 

    staticObjects = staticObjects.concat(allFirstCurves);
    sceneObjects = sceneObjects.concat(allFirstLabels);
    sceneObjects = sceneObjects.concat([additionLine, ellipticAdditionResult]);

    sceneObjects = sceneObjects.concat([threeFourFiveLabel, threeFourFiveLabelTwo, threeFourFiveLabelTwoPointFive, threeFourFiveLabelThree, threeFourFiveLabelThreePointFive, threefourFiveArrow1, threefourFiveArrow2, threefourFiveArrow3]);
    sceneObjects = sceneObjects.concat(threeFourFiveTriangleAreaLabels);
    staticObjects = staticObjects.concat([threeFourFivePoint, threeFourFiveTriangle])

    sceneObjects = sceneObjects.concat([reflectionLine, additionPtLabel1, additionPtLabel2, additionPtLabel3]);
    
    sceneObjects = sceneObjects.concat([PplusPplusPLabel,PplusPplusPPoint]);
    

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
    threefourFiveArrow1.getDeepestChildren().forEach( (output) => presentation.TransitionTo(output, {'opacity':1}, 500));

    //show s = 5/2 label and arrow
    await presentation.delay(250);
    presentation.TransitionTo(threeFourFiveLabelTwo,{opacity:1},500);
    presentation.TransitionTo(threeFourFiveLabelTwoPointFive,{opacity:1},500);
	
    
    await presentation.nextSlide();


    //show arrow
    threefourFiveArrow2.getDeepestChildren().forEach( (output) => presentation.TransitionTo(output, {'opacity':1}, 500));
    await presentation.delay(250);

    //show x = s^2 label
    presentation.TransitionTo(threeFourFiveLabelThree,{opacity:1},500);
    presentation.TransitionTo(threeFourFiveLabelThreePointFive,{opacity:1},500);
	
    
    await presentation.nextSlide();

    //show arrow to curve point
    threefourFiveArrow3.getDeepestChildren().forEach( (output) => presentation.TransitionTo(output, {'opacity':1}, 500));
    await presentation.delay(250);

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
    await presentation.nextSlide();
    //hide all the explanatory stuff
    [threeFourFiveTriangle, threefourFiveArrow1, threefourFiveArrow2, threefourFiveArrow3].forEach(curveObject => curveObject.getDeepestChildren().forEach((output) => {
                presentation.TransitionTo(output, {'opacity':0}, 1000);
            }));
    [threeFourFiveLabelTwo, threeFourFiveLabelTwoPointFive,  threeFourFiveLabelThree, threeFourFiveLabelThreePointFive].concat(threeFourFiveTriangleAreaLabels).forEach( (output) => presentation.TransitionTo(output, {'opacity':0}, 1000));
    //also hide the 3-4-5 point

	presentation.TransitionTo(threeFourFiveLabel,{opacity:0},500);
	presentation.TransitionTo(threeFourFiveOutput,{opacity:0},500);

    
	presentation.TransitionTo(mainCurveText,{position3D: (t) => [-4, 3]},1000);

    
    await presentation.nextSlide();

    //show points to add    

    [additionPtLabel1, additionPtLabel2].forEach(text => 
	presentation.TransitionTo(text,{opacity:1},500))
    

	presentation.TransitionTo(ellipticPtsoutput,{opacity:1, width:pointSize*3},400);
	await presentation.delay(400);
	presentation.TransitionTo(ellipticPtsoutput,{width:pointSize},400);

    await presentation.nextSlide();

    
	additionLine.revealSelf(presentation);

	await EXP.delay(1000);

	//draw 3rd point
	//animate a fancy point appear animation
	presentation.TransitionTo(ellipticAdditionResultOutput,{opacity:1, width:pointSize*3},400);
	await presentation.delay(400);
	presentation.TransitionTo(ellipticAdditionResultOutput,{opacity:1, width:pointSize},400);
	await presentation.delay(500);
    //reflect

    //flip the line and the point

    reflectionLine.revealSelf(presentation);
	await presentation.delay(1000);
	presentation.TransitionTo(ellipticAdditionResult.data[0],{1: -ellipticAdditionResult.data[0][1]});
	await presentation.delay(400);
	presentation.TransitionTo(additionPtLabel3,{opacity:1},400);

    await presentation.nextSlide();
	presentation.TransitionTo(reflectionLine.output,{opacity:0},250);
    reflectionLine.hideSelf(presentation);
    await presentation.delay(500);

    //move points together
    let sameX = -3;
	presentation.TransitionTo(pointXes,{0:sameX-0.000001, 1: sameX},1000);

	let newP3 = elliptic_curve_add([sameX, curveY(sameX)],[sameX, curveY(sameX)], [p,q]);
    let p3Negative = [newP3[0], -newP3[1]];

    //hide P1+P2
	presentation.TransitionTo(ellipticAdditionResultOutput,{opacity:0, width: 0},250);
	presentation.TransitionTo(additionPtLabel3,{opacity:0},250);
	presentation.TransitionTo(ellipticAdditionResult.data[0],{0: p3Negative[0], 1: p3Negative[1]});

    await presentation.delay(500);
	presentation.TransitionTo(additionPtLabel3,{text:"P_1 + P_1"},0);
	presentation.TransitionTo(additionPtLabel2,{opacity:0},500);

    //show P1+P1
    await presentation.delay(500);
	presentation.TransitionTo(ellipticAdditionResultOutput,{opacity:1, width: pointSize*3},400);
    await presentation.delay(400);
	presentation.TransitionTo(ellipticAdditionResultOutput,{opacity:1, width: pointSize},400);
    //reflect
    await presentation.delay(500);
	presentation.TransitionTo(reflectionLine,{p1:newP3, p2: p3Negative},1);
	presentation.TransitionTo(reflectionLine.output,{opacity:1},250);
    reflectionLine.revealSelf(presentation);
    await presentation.delay(500);

	presentation.TransitionTo(ellipticAdditionResult.data[0],{0: newP3[0], 1: newP3[1]});
	presentation.TransitionTo(additionPtLabel3,{opacity:1},500);
        
    await presentation.nextSlide();

    //hide elliptic curve addition stuff
	[additionPtLabel1,additionPtLabel2, additionPtLabel3, reflectionLine.output, additionLine.output].forEach(item => presentation.TransitionTo(item,{opacity:0},500));
	presentation.TransitionTo(ellipticAdditionResultOutput,{opacity:0, width: 0},500);
	presentation.TransitionTo(ellipticPtsoutput,{opacity:0},400);
    additionLine.hideSelf(presentation);

	presentation.TransitionTo(threeFourFiveLabel,{opacity:1},500);
	presentation.TransitionTo(threeFourFiveOutput,{opacity:1},500);

    await presentation.nextSlide();

    //elliptic add the 3-4-5 point

	presentation.TransitionTo(pointXes,{0:threeFourFiveX-0.000001, 1: threeFourFiveX},1);
	presentation.TransitionTo(ellipticAdditionResult.data[0],{0: p3Negative[0], 1: p3Negative[1]},1);
    presentation.TransitionTo(additionLine.output,{opacity:1},500);
	presentation.TransitionTo(additionPtLabel1,{align: "left"},1);
	presentation.TransitionTo(additionPtLabel1,{opacity:1},500);
    additionLine.revealSelf(presentation);

    //set the result
	presentation.TransitionTo(ellipticAdditionResult.data[0],{0: PplusPNegative[0], 1: PplusPNegative[1]},1);

    //make points big so you can see them
	presentation.TransitionTo(ellipticAdditionResultOutput,{opacity:1, width: 10},250);

    await presentation.nextSlide();

    //dramatic zoom out to see P1 + P1
	presentation.TransitionTo(additionLine,{length: 200},2000);
	presentation.TransitionTo(mainCurveText,{position3D: (t) => [0, 100]},2000);
	presentation.TransitionTo(three.camera.position,{z: 3000},2000);
	presentation.TransitionTo(threeFourFiveOutput,{width:10},2000);

    await presentation.delay(2000);


    //bwomp
	presentation.TransitionTo(ellipticAdditionResultOutput,{width:10*3},500);
    await presentation.delay(500);
	presentation.TransitionTo(ellipticAdditionResultOutput,{width:10},500);
    await presentation.delay(500);


	presentation.TransitionTo(reflectionLine,{length: 200},500);
	presentation.TransitionTo(reflectionLine,{p1:PplusP, p2: PplusPNegative},1);
	presentation.TransitionTo(reflectionLine.output,{opacity:1},250);
    reflectionLine.revealSelf(presentation);

    //slide down the line
	presentation.TransitionTo(ellipticAdditionResult.data[0],{0: PplusP[0], 1: PplusP[1]},1000);
	presentation.TransitionTo(additionPtLabel3,{opacity:1},1000); //P1 + P1 label
    let worldPos = mainCurveProjection.expr(0,0,...PplusP);
	presentation.TransitionTo(additionPtLabel3.position3D,{0: worldPos[0], 1: worldPos[1]},1000);

    await presentation.nextSlide();

    //hide lines
    presentation.TransitionTo(additionLine.output,{opacity:0},500);
    
    reflectionLine.hideSelf(presentation);
    additionLine.hideSelf(presentation);
    await presentation.delay(500);
    //show addition line in their new spots
    presentation.TransitionTo(additionLine.output,{opacity:1},1);
	presentation.TransitionTo(additionLine,{p1:PplusP, p2: threeFourFiveCurvePoint},1);
    additionLine.revealSelf(presentation);

    await presentation.delay(500);

    //dramatically zoom in

	presentation.TransitionTo(three.camera.position,{z: 100},2000);
	//presentation.TransitionTo(ellipticAdditionResultOutput,{width: pointSize},2000);
	presentation.TransitionTo(threeFourFiveOutput,{width:pointSize},2000);
    await presentation.delay(2000);

    //bwomp

	presentation.TransitionTo(PplusPplusPOutput,{opacity:1, width: pointSize*3},400);
    await presentation.delay(400);
	presentation.TransitionTo(PplusPplusPOutput,{width: pointSize},400);
    await presentation.delay(400);

    //flip negative
	presentation.TransitionTo(reflectionLine,{length: 10},1);
	presentation.TransitionTo(reflectionLine,{p1:PplusPplusP, p2: PplusPplusPNegative},1);
	presentation.TransitionTo(reflectionLine.output,{opacity:1},250);
    reflectionLine.revealSelf(presentation);

    await presentation.delay(500);
	presentation.TransitionTo(PplusPplusPPoint.data[0],{0: PplusPplusP[0], 1: PplusPplusP[1]},500);
	presentation.TransitionTo(PplusPplusPLabel,{opacity: 1},500);
    


    await presentation.nextSlide();
    await presentation.nextSlide();

    //hide everything
    [additionPtLabel1, additionPtLabel3, ellipticAdditionResultOutput, threeFourFiveLabel, PplusPplusPLabel, additionLine.output, reflectionLine.output, mainCurveText, PplusPplusPOutput].forEach(item => presentation.TransitionTo(item,{opacity:0},1000))
    mainCurveObjects.concat([graphAxes, threeFourFiveOutput]).forEach(object => object.getDeepestChildren().forEach( async (output) => {
        presentation.TransitionTo(output, {'opacity':0.2}, 1000);
    }))

    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    
    

}
window.addEventListener("load",function(){
    setup();
    animate();
})
