import {constructEXPEllipticCurve} from "./3-makeellipticcurve.js";
import {AutoColoring3DText} from './2-addColorToHTMLMath.js';
import {Dynamic3DText} from "./katex-labels.js";
import {gridColor, pColor, qColor, triangleLineColor, triangleGrabbableCornerColor, validIntegerColor, twoNColor} from "./colors.js";

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
    console.log(p)

    let label = new AutoColoring3DText({
        text: ellipticCurveEquationText(p,q),
        position3D: (t) => [position[0]+textOffset[0], position[1]+textOffset[1]],
        opacity: 1,
        frostedBG: true,
        customColors: customColors,
    })
    curveProjection.expr = (i,t,x,y) => [x/scaleFactor+position[0], y/scaleFactor+position[1]]

    let graphAxes = new EXP.Area({bounds: [[-axesSize,axesSize]], numItems: 2});
    graphAxes.add(new EXP.Transformation({expr: (i,t,x) => [position[0]+x,position[1]]})).add(new EXP.VectorOutput({color:gridColor}));
    graphAxes.add(new EXP.Transformation({expr: (i,t,x) => [position[0],position[1]+x]})).add(new EXP.VectorOutput({color:gridColor}))

    let objects = curveObjects.concat([graphAxes]);
    return [objects, label, curveProjection];
}

export function makeTriangle(w,h, centerPos){

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
    getTrianglePoints.add(new EXP.PointOutput({opacity:1, color: triangleGrabbableCornerColor, width:0.4})); //line between the

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
        text: w*h/2, 
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
