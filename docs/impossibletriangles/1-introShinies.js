import {triangleLineColor, triangleNonGrabbableCornerColor, rColor, sColor, tColor} from "./colors.js"

import {constructEXPEllipticCurve} from "./3-makeellipticcurve.js";

export function makeIntroObjects(){

    let objects = [];

    let points = [[0,0],[6,0],[6,3]];
    for(let i=0;i<3;i++){
        points[i][0] -= 0;
        points[i][1] += 4;
    }

    window.shinyTriangle = new EXP.Array({data: [0,1,2,0]});
    let getTrianglePoints = shinyTriangle.add(new EXP.Transformation({'expr':(i,t,index) => points[index]}))
    getTrianglePoints.add(new EXP.LineOutput({opacity:1, color: triangleLineColor})); //line between the triangles
    getTrianglePoints.add(new EXP.PointOutput({opacity:1, color: triangleNonGrabbableCornerColor, width:0.4})); //line between the triangles

    //abuse of javascript: this transformation is doing nothing but setting points, so that it stops when shinyTriangle stops being updated
    //todo: not error
    shinyTriangle.add(new EXP.Transformation({'expr':(i,t,index) => {
        let angle = Math.cos(t)/20 + Math.PI/6;

        let x = Math.cos(angle)*6 + points[0][0];
        let y = Math.sin(angle)*6 + points[0][1];

        points[1][0] = x;

        points[2][0] = x;
        points[2][1] = y;
        return [0];
    }}))


    let a=1;
    let b=5;
    let c=7;


    window.squaresPos = new EXP.Transformation({'expr':(i,t,x,y) => [x/1.5+2.5 + Math.cos(t)/6,y/1.5-2]});
    window.shinySquareA = new EXP.Array({data: [[0,0], [a,0],[a,a],[0,a]]});
    shinySquareA
        .add(squaresPos)
        .add(new EXP.ClosedPolygonOutput({color: rColor, opacity: 1}));

    window.shinySquareB = new EXP.Array({data: [[0,b],[0,a],[a,a],[a,0], [b,0],[b,b]]});
    shinySquareB
        .add(squaresPos.makeLink())
        .add(new EXP.ClosedPolygonOutput({color: sColor, opacity: 1}));

    window.shinySquareC = new EXP.Array({data: [[0,c],[0,b],[b,b],[b,0], [c,0],[c,c]]});
    shinySquareC
        .add(squaresPos.makeLink())
        .add(new EXP.ClosedPolygonOutput({color: tColor, opacity: 1}));

    let [curveObjects, curvePos] = constructEXPEllipticCurve(-9,5); //x^3 - 3x + 0

    curvePos.expr = (i,t,x,y) => [x/2+c+1.5, y/2 + c/2 + 2 + Math.cos(t+0.4)/5, 1];
    //todo: subtle curve-adding animation?
    //two points, line stretching to the third?

    objects = [shinyTriangle, shinySquareA, shinySquareB, shinySquareC]
    objects = objects.concat(curveObjects);


    return objects;

}




