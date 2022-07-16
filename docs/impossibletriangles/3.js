
import {elliptic_curve_add, LongLineThrough} from "./3-congruentutilities.js";
import {gridColor, xColor, yColor, triangleVisArrowColor, reflectionLineColor, validIntegerColor, rColor, sColor, tColor} from "./colors.js";

import {Dynamic3DText} from "./katex-labels.js";
import {addColorToHTML, AutoColoring3DText, ColorSuccessiveNumbers3DText} from './2-addColorToHTMLMath.js';

import {makeLabeledCurve, makeTriangle, makeFractionallyLabeledTriangle} from "./3-makethings.js";

import "./presentationmode.js";

const pointSize = 0.4;
const pointColor = 0xff7070;
const additionLineColor = 0xbf5050;

await EXP.pageLoad();
window.three = EXP.setupThree(document.getElementById("threeDcanvas"));
addColorToHTML();

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

let labelTwoPos = EXP.Math.vectorAdd(mainCurveProjection.expr(0,0,...threeFourFiveCurvePoint), [-6,-5])
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

let labelThreePos = EXP.Math.vectorAdd(mainCurveProjection.expr(0,0,...threeFourFiveCurvePoint), [-1,-5])
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
let examplep3 = elliptic_curve_add(points[0],points[1], [p,q]);
let examplep3Negative = [examplep3[0], -examplep3[1]];

let lineLength = 10;
//note: points[0] and points[1] aren't copies for some reason :( but I use that to animate the line later
window.additionLine = new LongLineThrough(points[0],points[1],additionLineColor, 2, lineLength);
additionLine.transform2.expr = mainCurveProjection.expr; //todo: use mainCurveProjection.makeLink()



window.reflectionLine = new LongLineThrough(examplep3,examplep3Negative,reflectionLineColor, 2, lineLength);
reflectionLine.transform2.expr = mainCurveProjection.expr; //todo: use mainCurveProjection.makeLink()


window.additionPtLabel3 = new AutoColoring3DText({
    text: "P_1 + P_2",
    position3D: mainCurveProjection.expr(0,0,...examplep3),
    opacity: 0,
    align: 'bottom',
    frostedBG: true,
})

window.ellipticAdditionResult = new EXP.Array({data: [[...examplep3Negative]]});
window.thirdPointControl = new EXP.Transformation({expr: (i,t,x,y) => [x,y]})
window.ellipticAdditionResultOutput = new EXP.PointOutput({width:0.0,color:pointColor});
ellipticAdditionResult.add(mainCurveProjection.makeLink()).add(thirdPointControl).add(ellipticAdditionResultOutput);


///// add the point representing the 3-4-5 triangle to itself repeatedly

window.threeFourFiveX = 25/4;
window.PplusP = elliptic_curve_add([threeFourFiveX, curveY(threeFourFiveX)],[threeFourFiveX, curveY(threeFourFiveX)], [p,q]);
//exact: x = 1442401/19600, y = 1726556399/2744000. x = (1201/140)^2
//meaning r = 1151/140, s = 1201/140, t = 1249/140
//meaing triangle = width 98/140, height 2400/140, hypotenuse 1201/140*2]

window.PplusPExactCoords = new AutoColoring3DText({
    text: "(\\frac{1442401}{19600}, \\frac{-1726556399}{2744000})", //yup. jeez
    position3D: mainCurveProjection.expr(0,0,...PplusP),
    opacity: 0,
    align: 'top',
    frostedBG: true,
    customColors: {
        "1442401": xColor,
        "19600": xColor,
        "1726556399": yColor,
        "2744000": yColor,
        "-": yColor,
    }
})

//{n:98, d:140},{n:2400, d:140},{n:2402, d:140}

let PplusPTrianglePos = mainCurveProjection.expr(0,0,...[-500,-400])// EXP.Math.vectorAdd(mainCurveProjection.expr(0,0,...PplusP), [2,0]));
let [PplusPTriangle, PplusPAreaLabels] = makeFractionallyLabeledTriangle({n:7, d:10},{n:120, d:7},{n:1201, d:70}, PplusPTrianglePos, 10)
window.PplusPAreaLabels = PplusPAreaLabels;
window.PplusPTriangle = PplusPTriangle;
PplusPTriangle.getDeepestChildren().forEach( (output) => {
        output.opacity = 0;
});

window.PplusPNegative = [PplusP[0], -PplusP[1]];


// adding three times!

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

//adding [25/4,35/8] to [1442401/19600,-1726556399/2744000] should give:
//[60473718955225/6968554599204,339760634079313268605/18395604368087917608]

//from this, s = sqrt(x) = 7776485/2639802, 
//so sides are width: 4653/851, height: 3404/1551 hypotenuse: 7776485/1319901
window.PplusPplusPExactCoords = new AutoColoring3DText({
    text: "(\\frac{60473...}{6968...}, \\frac{33976...}{1839...})", //yup. jeez
    position3D: mainCurveProjection.expr(0,0,...PplusPplusP),
    opacity: 0,
    align: 'right',
    frostedBG: true,
    customColors: {
        "60473...": xColor,
        "6968...": xColor,
        "33976...": yColor,
        "1839...": yColor,
    }
})

//P1 + P1 + P1 triangle
//
let PplusPplusPTrianglePos = [-7,0];
let [PplusPplusPTriangle, PplusPplusPAreaLabels] = makeFractionallyLabeledTriangle({n:4653, d:851},{n:3404, d:1551},{n:7776485, d:1319901}, PplusPplusPTrianglePos, 0.75)
window.PplusPplusPAreaLabels = PplusPplusPAreaLabels;
window.PplusPplusPTriangle = PplusPplusPTriangle;
PplusPplusPTriangle.getDeepestChildren().forEach( (output) => {
        output.opacity = 0;
});

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
let sceneObjects = [ellipticpts, mainCurveText]; 
window.sceneObjects = sceneObjects;

staticObjects = staticObjects.concat(allFirstCurves);
sceneObjects = sceneObjects.concat(allFirstLabels);
sceneObjects = sceneObjects.concat([additionLine, ellipticAdditionResult]);

sceneObjects = sceneObjects.concat([threeFourFiveLabel, threeFourFiveLabelTwo, threeFourFiveLabelTwoPointFive, threeFourFiveLabelThree, threeFourFiveLabelThreePointFive, threefourFiveArrow1, threefourFiveArrow2, threefourFiveArrow3]);
sceneObjects = sceneObjects.concat(threeFourFiveTriangleAreaLabels);
staticObjects = staticObjects.concat([threeFourFivePoint, threeFourFiveTriangle])

sceneObjects = sceneObjects.concat([reflectionLine, additionPtLabel1, additionPtLabel2, additionPtLabel3]);

sceneObjects = sceneObjects.concat(PplusPAreaLabels);
sceneObjects = sceneObjects.concat(PplusPplusPAreaLabels);
staticObjects = staticObjects.concat([PplusPTriangle, PplusPplusPTriangle]);

sceneObjects = sceneObjects.concat([PplusPplusPLabel,PplusPplusPPoint, PplusPExactCoords, PplusPplusPExactCoords]);


three.on("update",function(time){
	sceneObjects.forEach(i => i.activate(time.t));
});
staticObjects.forEach(i => i.activate(0));

//end setup

function setupGoat(presentation){
    //analytics
    document.addEventListener('visibilitychange', function(e) {
        if (window.goatcounter === undefined)return;
        if (document.visibilityState !== 'hidden')
            return
        if (goatcounter.filter())
            return
        navigator.sendBeacon(goatcounter.url({
            event: true,
            title: location.pathname + location.search + " unloaded on slide " + presentation.currentSlideIndex,
            path: function(p) { return 'unload-' + p + '-slide-'+presentation.currentSlideIndex },
        }))
    })
}


let presentation = new EXP.UndoCapableDirector();
window.presentation = presentation;
await presentation.begin();
setupGoat(presentation);

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

await EXP.delay(750);

//draw 3rd point
//animate a fancy point appear animation
presentation.TransitionTo(ellipticAdditionResultOutput,{opacity:1, width:pointSize*3},400);
await presentation.delay(400);
presentation.TransitionTo(ellipticAdditionResultOutput,{opacity:1, width:pointSize},400);

await presentation.nextSlide();
//reflect

//flip the line and the point

reflectionLine.revealSelf(presentation);
await presentation.delay(500);
presentation.TransitionTo(ellipticAdditionResult.data[0],{1: -ellipticAdditionResult.data[0][1]});
await presentation.delay(400);
presentation.TransitionTo(additionPtLabel3,{opacity:1},400);

await presentation.nextSlide();

presentation.TransitionTo(reflectionLine.output,{opacity:0},250);
reflectionLine.hideSelf(presentation);
await presentation.delay(250);

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
presentation.TransitionTo(additionPtLabel3,{text:"P_1 + P_1", align: "bottom"},0);
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


presentation.TransitionTo(reflectionLine,{length: 300},1000);
presentation.TransitionTo(reflectionLine,{p1:PplusP, p2: PplusPNegative},1);
presentation.TransitionTo(reflectionLine.output,{opacity:1},250);
reflectionLine.revealSelf(presentation);

await presentation.delay(500);

//slide down the line
presentation.TransitionTo(ellipticAdditionResult.data[0],{0: PplusP[0], 1: PplusP[1]},1000);
presentation.TransitionTo(additionPtLabel3,{opacity:1},1000); //P1 + P1 label
let worldPos = mainCurveProjection.expr(0,0,...PplusP);
presentation.TransitionTo(additionPtLabel3.position3D,{0: worldPos[0], 1: worldPos[1]},1000);

await presentation.delay(1000);
presentation.TransitionTo(PplusPExactCoords,{opacity:1},1000); //P1 + P1 exact coords label


await presentation.nextSlide();

PplusPTriangle.getDeepestChildren().forEach( (output) => presentation.TransitionTo(output,{opacity:1},1000));
PplusPAreaLabels.forEach(text => presentation.TransitionTo(text,{opacity:1},1000));

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

presentation.TransitionTo(three.camera.position,{z: 120, y: 1},2000);
//presentation.TransitionTo(ellipticAdditionResultOutput,{width: pointSize},2000);
presentation.TransitionTo(threeFourFiveOutput,{width:pointSize},2000);
presentation.TransitionTo(PplusPExactCoords,{opacity:0},2000); //hide P1 + P1 exact coords label

//hide P + P triangle

PplusPTriangle.getDeepestChildren().forEach( (output) => presentation.TransitionTo(output,{opacity:0},2000));
PplusPAreaLabels.forEach(text => presentation.TransitionTo(text,{opacity:0},2000));

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
presentation.TransitionTo(PplusPplusPExactCoords,{opacity: 1},500);

//show triangle

PplusPplusPTriangle.getDeepestChildren().forEach( (output) => presentation.TransitionTo(output,{opacity:1},1000));
PplusPplusPAreaLabels.forEach(text => presentation.TransitionTo(text,{opacity:1},1000));


await presentation.nextSlide();
await presentation.nextSlide();

//hide triangle
PplusPplusPAreaLabels.forEach(text => presentation.TransitionTo(text,{opacity:0},1000));
[additionLine.output, reflectionLine.output, mainCurveText].forEach(item => presentation.TransitionTo(item,{opacity:0},250))
mainCurveObjects.forEach(object => object.getDeepestChildren().forEach( async (output) => {
    presentation.TransitionTo(output, {'opacity':0.2}, 1000);
}));
[graphAxes, PplusPplusPTriangle].forEach(object => object.getDeepestChildren().forEach( async (output) => {
    presentation.TransitionTo(output, {'opacity':0}, 1000);
}))

await presentation.delay(250);

//show multiples of P1 all lined up

    //P1
    let p1Pos = [-10, 15];
    sceneObjects = sceneObjects.concat([threeFourFivePoint, additionPtLabel1])
    presentation.TransitionTo(threeFourFivePoint.data,{0: p1Pos},1000); // 1
    presentation.TransitionTo(threeFourFiveLabel,{position3D:mainCurveProjection.expr(0,0,...p1Pos)},1000); //(25/4, 35/8) text1
    presentation.TransitionTo(additionPtLabel1,{position3D: (t) => mainCurveProjection.expr(0,0,...p1Pos)},1000); //"P1" text

	    
    //P1 + P1
    //the point is very far away (we needed to zoom out to see it), so we offscreen teleport closer to make a smoother animation
    let p2pos = [-10,5];
    let p2ScreenPos = mainCurveProjection.expr(0,0,...p2pos);
    presentation.TransitionTo(ellipticAdditionResultOutput,{width: pointSize, opacity: 0},1); //needs to happen before we teleport so a giant point doesn't show up for one frame
    await presentation.delay(1);
    presentation.TransitionTo(PplusPExactCoords,{align: "right", position3D:[0,-10], opacity: 0},1);
    presentation.TransitionTo(additionPtLabel3,{align: "left", position3D: [0,-10], opacity: 0},1); //offscreen teleport for a smoother entrances
    presentation.TransitionTo(ellipticAdditionResult.data,{0: [0,-10]},1);
    await presentation.delay(1);
    await presentation.delay(100);
    presentation.TransitionTo(ellipticAdditionResult.data,{0: p2pos},1000);// P + P point
    presentation.TransitionTo(additionPtLabel3, {position3D: p2ScreenPos, opacity: 1},1000);
    presentation.TransitionTo(PplusPExactCoords, {position3D: p2ScreenPos, opacity: 1},1000);
    presentation.TransitionTo(ellipticAdditionResultOutput,{opacity: 1},1000);

    let pos3 = [-10, -5];

    await presentation.delay(100);
    
    presentation.TransitionTo(PplusPplusPLabel,{align: "left"},1000);
    presentation.TransitionTo(PplusPplusPExactCoords,{align: "right"},1000);

    presentation.TransitionTo(PplusPplusPLabel,{position3D:mainCurveProjection.expr(0,0,...pos3)},1000);
    presentation.TransitionTo(PplusPplusPExactCoords,{position3D:mainCurveProjection.expr(0,0,...pos3)},1000);
    presentation.TransitionTo(PplusPplusPPoint.data[0],{0: pos3[0],1: pos3[1]},1000);

    let ellipsis = new EXP.Area({bounds: [[-2,2],[-5,-5]], numItems: 3})
    window.ellipsis = ellipsis;
    ellipsis.add(new EXP.PointOutput({color: 0x000000, width: pointSize, opacity: 0}));
    sceneObjects.push(ellipsis)

    await presentation.delay(1000);

    presentation.TransitionTo(ellipsis.children[0],{opacity: 1},1000);


//added
await presentation.nextSlide();
await presentation.nextSlide();
await presentation.nextSlide();


//hide everything
PplusPplusPAreaLabels.forEach(text => presentation.TransitionTo(text,{opacity:0},1000));
[additionPtLabel1, additionPtLabel3, ellipticAdditionResultOutput, threeFourFiveOutput, threeFourFiveLabel, PplusPplusPLabel, PplusPExactCoords, additionLine.output, reflectionLine.output, mainCurveText, PplusPplusPOutput, PplusPplusPExactCoords, ellipsis.children[0]].forEach(item => presentation.TransitionTo(item,{opacity:0},1000));
//mainCurveObjects.concat([graphAxes, threeFourFiveOutput, PplusPplusPTriangle]).forEach(object => object.getDeepestChildren().forEach( async (output) => {
//    presentation.TransitionTo(output, {'opacity':0.2}, 1000);
//}))

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
