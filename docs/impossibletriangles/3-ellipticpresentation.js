import {constructEXPEllipticCurve} from "./3-makeellipticcurve.js";
import {elliptic_curve_add, LongLineThrough} from "./3-congruentutilities.js";
import {gridColor} from "./colors.js";

import {addColorToHTML, AutoColoring3DText} from './2-addColorToHTMLMath.js';
addColorToHTML();

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


    function makeLabeledCurve(p,q, position=[0,0], textOffset = [0, -3], scaleFactor=3, axesSize=3){
        let [curveObjects, curveProjection] = constructEXPEllipticCurve(p, q);

        function makeText(p,q){
            let text = "y^2 = x^3"
            if(p != 0){
                if(p > 0)text += '+'+p+'x';
                if(p < 0)text += ''+p+'x';
            }
            if(q != 0){
                if(q > 0)text += '+'+q;
                if(q < 0)text += ''+q;
            }
            return text;
        }

        let label = new AutoColoring3DText({
            text: makeText(p,q),
            position3D: (t) => [position[0]+textOffset[0], position[1]+textOffset[1]],
            opacity: 1,
            frostedBG: true,
        })
        curveProjection.expr = (i,t,x,y) => [x/scaleFactor+position[0], y/scaleFactor+position[1]]

        let graphAxes = new EXP.Area({bounds: [[-axesSize,axesSize]], numItems: 2});
        graphAxes.add(new EXP.Transformation({expr: (i,t,x) => [position[0]+x,position[1]]})).add(new EXP.VectorOutput({color:gridColor}));
        graphAxes.add(new EXP.Transformation({expr: (i,t,x) => [position[0],position[1]+x]})).add(new EXP.VectorOutput({color:gridColor}))

        let objects = curveObjects.concat([graphAxes]);
        return [objects, label, curveProjection];
    }


    //elliptic curve
    let p=-36, q=0;
    let curveY = (x)=>Math.sqrt(Math.abs(x*x*x + p*x+q));
    let mainCurveCenterPos = [0,-1];
    let scaleFactor = 4;
    let [mainCurveObjects, mainCurveText, mainCurveProjection] = makeLabeledCurve(p,q, mainCurveCenterPos, [0,-3], scaleFactor, 10);
    window.mainCurveObjects = mainCurveObjects;
    window.mainCurveText = mainCurveText;
    window.mainCurveProjection = mainCurveProjection;
    window.graphAxes = mainCurveObjects[mainCurveObjects.length-1];


    let [firstCurve1, label1, _] = makeLabeledCurve(-4,1, [4+20,0], [1,-3])
    let [firstCurve2, label2, __] = makeLabeledCurve(3,5, [-4+20,0], [-1,-3])

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

    //point corresponding to 3-4-5 triangle

    //r,s,t = 1,5,7 corresponds to 6-8-10 triangle, so r,s,t = 1/2, 2.5, 3.5 works for n=6
    //then x = s^2 = 2.5^2 = 6.25
    //(6.25, 4.375) = (, 35/8)
    let threeFourFivePointX = 6.25;
    let threeFourFiveCurvePoint = [threeFourFivePointX, curveY(threeFourFivePointX)]
	window.threeFourFivePoint = new EXP.Array({data: [threeFourFiveCurvePoint]});
	window.threeFourFiveOutput = new EXP.PointOutput({width:pointSize,color:pointColor, opacity: 0});
	threeFourFivePoint.add(mainCurveProjection.makeLink()).add(threeFourFiveOutput);

    window.threeFourFiveLabel = new AutoColoring3DText({ //todo: color according to x and y colors
        text: "(\\frac{25}{4}, \\frac{35}{8})",
        position3D: EXP.Math.vectorAdd(mainCurveProjection.expr(0,0,...threeFourFiveCurvePoint), [-2,0]),
        opacity: 0,
        frostedBG: true,
    })

    //todo:
    //let threeFourFiveTriangle = makeTriangle(3,4,5);



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

    sceneObjects = sceneObjects.concat([threeFourFiveLabel]);
    staticObjects = staticObjects.concat([threeFourFivePoint, ])
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
    //hide other elliptic curves
    allFirstCurves.forEach(curveObject => curveObject.getDeepestChildren().forEach( async (output) => {
                await presentation.TransitionTo(output, {'opacity':0}, 1000);
            }));
    allFirstLabels.forEach(text => presentation.TransitionTo(text, {'opacity':0}, 1000))

    await presentation.nextSlide();

    //show point corresponding to 3-4-5 triangle
	presentation.TransitionTo(threeFourFiveOutput,{opacity:1, width:pointSize*3},400);
	presentation.TransitionTo(threeFourFiveLabel,{opacity:1},500);
	await presentation.delay(400);
	presentation.TransitionTo(threeFourFiveOutput,{width:pointSize},400);

    showTriangle(); //TODO: fix
    

    await presentation.nextSlide();
    await presentation.nextSlide();
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

}
window.addEventListener("load",function(){
    setup();
    animate();
})
