import * as EXP from "../resources/build/explanaria-bundle.js";

import {constructEXPEllipticCurve} from "./3-makeellipticcurve.js";
import {AutoColoring3DText} from './2-addColorToHTMLMath.js';
import {Dynamic3DText} from "./katex-labels.js";
import {gridColor, pColor, qColor, triangleLineColor, triangleNonGrabbableCornerColor, validIntegerColor, twoNColor} from "./colors.js";

function average(p1,p2){
    return [(p1[0]+p2[0])/2,(p1[1]+p2[1])/2];
}

function ellipticCurveEquationText(p,q){
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


export function makeLabeledCurve(p,q, position=[0,0], textOffset = [0, -3], scaleFactor=3, axesSize=3){
    let [curveObjects, curveProjection] = constructEXPEllipticCurve(p, q);

    //This might pose a problem if both p and q are negative and they have different color
    //This will also color the exponents if either p or q are 2 or 3 
    let customColors = {};
    customColors[String(Math.abs(p))] = pColor,
    customColors[String(Math.abs(q))] = qColor;
    customColors["−"] = pColor;

    let label = new AutoColoring3DText({
        text: ellipticCurveEquationText(p,q),
        position3D: (t) => [position[0]+textOffset[0], position[1]+textOffset[1]],
        opacity: 1,
        frostedBG: true,
        customColors: customColors,
        textSize: 0.8,
    })
    curveProjection.expr = (i,t,x,y) => [x/scaleFactor+position[0], y/scaleFactor+position[1]]

    let graphAxes = new EXP.Area({bounds: [[-axesSize,axesSize]], numItems: 2});
    graphAxes.add(new EXP.Transformation({expr: (i,t,x) => [position[0]+x,position[1]]})).add(new EXP.VectorOutput({color:gridColor}));
    graphAxes.add(new EXP.Transformation({expr: (i,t,x) => [position[0],position[1]+x]})).add(new EXP.VectorOutput({color:gridColor}))

    let objects = curveObjects.concat([graphAxes]);
    return [objects, label, curveProjection];
}


export function makeFractionallyLabeledTriangle(side1fraction, side2fraction, side3fraction, centerPos, scaleFactor = 1){
    //w is {n: blah, denom: blah} in which case it'll be rendered as a fraction

    let objects = [];

    let w = side1fraction.n/side1fraction.d;
    let h = side2fraction.n/side2fraction.d;

    let points = [[0,0],[w*scaleFactor,0],[w*scaleFactor,h*scaleFactor]];
    let center = [0,0];
    for(let i=0;i<3;i++){
        points[i][0] += centerPos[0];
        points[i][1] += centerPos[1];

        center[0] += points[i][0];
        center[1] += points[i][1];
    
    }
    center[0] /= 3;
    center[1] /= 3;

    let shinyTriangle = new EXP.Array({data: [0,1,2,0]});
    let getTrianglePoints = shinyTriangle.add(new EXP.Transformation({'expr':(i,t,index) => points[index]}))
    getTrianglePoints.add(new EXP.LineOutput({opacity:1, color: triangleLineColor})); //line between the triangles
    getTrianglePoints.add(new EXP.PointOutput({opacity:1, color: triangleNonGrabbableCornerColor, width:0.4*scaleFactor})); //line between the


    let rPos = average(points[1], points[0])
    let sPos = average(points[1], points[2])
    let tPos = average(points[2], points[0])
    if(w < 2){
        //thin triangle, move labels away for better clarity
        rPos = EXP.Math.vectorAdd(rPos, [0, -3*scaleFactor]);
        sPos = EXP.Math.vectorAdd(sPos, [3*scaleFactor, 0]);
        tPos = EXP.Math.vectorAdd(tPos, [-3*scaleFactor, 0]);
    }

    if(side3fraction.n + side3fraction.d > 10000){ //long hypotenuse label, move upwards
        rPos = EXP.Math.vectorAdd(rPos, [0, -1*scaleFactor]);
        tPos = EXP.Math.vectorAdd(tPos, [-1*scaleFactor, 1.5*scaleFactor]);
    }

    let areaLabel = new Dynamic3DText({
        text: w*h/2, 
        color: twoNColor,
        position3D: center,
        opacity: 0,
        frostedBG: true,
    })

    let rLabel = new Dynamic3DText({
        text: "\\frac{"+side1fraction.n+"}{"+side1fraction.d+"}", 
        color: validIntegerColor,
        position3D: rPos,
        opacity: 0,
        frostedBG: true,
    })
    let sLabel = new Dynamic3DText({
        text: "\\frac{"+side2fraction.n+"}{"+side2fraction.d+"}",
        color: validIntegerColor,
        position3D: sPos,
        opacity: 0,
        frostedBG: true,
    })
    let tLabel = new Dynamic3DText({
        text: "\\frac{"+side3fraction.n+"}{"+side3fraction.d+"}",
        color: validIntegerColor,
        position3D: tPos,
        opacity: 0,
        frostedBG: true,
    })

    return [shinyTriangle, [areaLabel, rLabel, sLabel, tLabel]];
}

export function makeTriangle(w,h, centerPos){
    //w can be a number or {n: blah, denom: blah} in which case it'll be rendered as a fraction

    let objects = [];

    let points = [[0,0],[w,0],[w,h]];
    let center = [0,0];
    for(let i=0;i<3;i++){
        points[i][0] += centerPos[0];
        points[i][1] += centerPos[1];

        center[0] += points[i][0];
        center[1] += points[i][1];
    
    }
    center[0] /= 3;
    center[1] /= 3;

    let shinyTriangle = new EXP.Array({data: [0,1,2,0]});
    let getTrianglePoints = shinyTriangle.add(new EXP.Transformation({'expr':(i,t,index) => points[index]}))
    getTrianglePoints.add(new EXP.LineOutput({opacity:1, color: triangleLineColor})); //line between the triangles
    getTrianglePoints.add(new EXP.PointOutput({opacity:1, color: triangleNonGrabbableCornerColor, width:0.4})); //line between the

    let areaLabel = new Dynamic3DText({
        text: w*h/2, 
        color: twoNColor,
        position3D: center,
        opacity: 0,
        frostedBG: true,
    })

    let rLabel = new Dynamic3DText({
        text: w, 
        color: validIntegerColor,
        position3D: average(points[0], points[1]),
        opacity: 0,
        frostedBG: true,
    })
    let sLabel = new Dynamic3DText({
        text: h, 
        color: validIntegerColor,
        position3D: average(points[1], points[2]),
        opacity: 0,
        frostedBG: true,
    })
    let tLabel = new Dynamic3DText({
        text: Math.sqrt(w*w+h*h), 
        color: validIntegerColor,
        position3D: average(points[0], points[2]),
        opacity: 0,
        frostedBG: true,
    })

    return [shinyTriangle, [areaLabel, rLabel, sLabel, tLabel]];
}
