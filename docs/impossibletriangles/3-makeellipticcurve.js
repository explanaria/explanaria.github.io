import * as EXP from "../resources/build/explanaria-bundle.js";

import {cardanoRealRoots} from "./3-cubicroots.js";
import {ellipticCurveColor} from "./colors.js";

function range(startAt = 0,endAt=10, numSubdivisions = 10) { // from https://stackoverflow.com/questions/3895478/does-javascript-have-a-method-like-range-to-generate-a-range-within-the-supp#10050831
    let arr = Array(numSubdivisions)
    for(let i=0;i<numSubdivisions;i++){
        arr[i] = startAt + (endAt-startAt) * (i/numSubdivisions);
    }  
    return arr;
}

export function constructEXPEllipticCurve(p=-2, q=1){
    //construct EXP.LineOutputs() representing the elliptuc curve y^2 = x^3 + px + q

	let positiveY = (x)=>Math.sqrt(Math.abs(x*x*x + p*x+q)); //the abs is there as a hack, so that if the thing in the sqrt is a tiny bit negative it doesn't NaN
    let realroots = cardanoRealRoots(p,q);

    //construct EXP lines representing the curve
    window.curveObjects = [];
    var curveProjection = new EXP.Transformation({'expr':(i,t,a,b,c) => [a,b,c]});

    if(realroots.length == 3){
	    var leftCurveComponent = new EXP.Area({bounds: [[realroots[0], realroots[1]]], numItems: 30});
	    var positiveLeftHalf = new EXP.Transformation({'expr': (i,t,x,y) => [x, positiveY(x)]});
	    var negativeLeftHalf = new EXP.Transformation({'expr': (i,t,x,y) => [x, -positiveY(x)]});
	    leftCurveComponent.add(positiveLeftHalf).add(curveProjection.makeLink()).add(new EXP.LineOutput({width:5,color:ellipticCurveColor, opacity:1}));
        leftCurveComponent.add(negativeLeftHalf).add(curveProjection.makeLink()).add(new EXP.LineOutput({width:5,color:ellipticCurveColor, opacity:1}));
        curveObjects.push(leftCurveComponent);
    }
    //right connected component of the curve, or the entire thing if there's only one root (untested)
    //todo: pack more values close to the rightmost root so you can see the curve smoothly
    let lastRoot = realroots[realroots.length-1];
    var rightCurveComponent = new EXP.Array({data: range(lastRoot, lastRoot+3, 20).concat(range(lastRoot+3, 10, 10).concat(range(10, 100, 10)))});
    var positiveRightHalf = new EXP.Transformation({'expr': (i,t,x,y) => [x, positiveY(x)]});
    var negativeRightHalf = new EXP.Transformation({'expr': (i,t,x,y) => [x, -positiveY(x)]});
    rightCurveComponent.add(positiveRightHalf).add(curveProjection.makeLink()).add(new EXP.LineOutput({width:5,color:ellipticCurveColor, opacity:1}));
    rightCurveComponent.add(negativeRightHalf).add(curveProjection.makeLink()).add(new EXP.LineOutput({width:5,color:ellipticCurveColor, opacity:1}));
    curveObjects.push(rightCurveComponent);
    return [curveObjects, curveProjection];
}
