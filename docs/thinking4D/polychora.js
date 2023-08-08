import * as EXP from "../resources/build/explanaria-bundle.js";
import {fourDColorMap} from "./colors.js";
export class Polychoron{
    //relies on global colorMap() defined in 7 visualizing4d.js 
    constructor(points, lines, embeddingTransformation, preEmbeddingTransformations, scene){
        this.points = points;
        this.lineData = lines;
        this.embeddingTransformation = embeddingTransformation;
        this.preEmbeddingTransformations = preEmbeddingTransformations;
        if(preEmbeddingTransformations.constructor != Array)this.preEmbeddingTransformations = [preEmbeddingTransformations];

        this.outputs = [];
        this.EXPLines = [];

        this.color = 0x00ff88;
        this.colorAttributes = []; //the attributes containing arrays for color. this is a giant hacky way of changing color for EXP.LineOutputs

        this.objectParent = new THREE.Object3D();
        scene.add(this.objectParent);

        this.makeEXPLines(lines);        
    }
    makeEXPLines(){
        for(var i=0;i<this.lineData.length;i++){
            let ptAIndex = this.lineData[i][0];
            let ptBIndex = this.lineData[i][1];
            var line = new EXP.Array({data: [this.points[ptAIndex],this.points[ptBIndex]]});
            let output = new EXP.LineOutput({width: 10, color: 0xffffff});

            let numPreEmbeds = this.preEmbeddingTransformations.length;
            
            //Add everything. The chain: line -> add this.preEmbeddingTransformations[0], this.preEmbeddingTransformations[1]... -> this.embeddingTransformation -> output.
            let parent = line;
            for(let k=0;k<numPreEmbeds;k++){
                let child = this.preEmbeddingTransformations[k].makeLink();
                parent.add(child);
                parent = child;
            }

            parent
                .add(this.embeddingTransformation.makeLink())
                .add(output);

            this.EXPLines.push(line);
            this.outputs.push(output);
            this.objectParent.add(output.mesh);

            //set up color lerping by memorizing the attributes like a terrible person
            this.colorAttributes.push(output._geometry.attributes.color);

        }
    }
    activate(t){
        for(var i=0;i<this.EXPLines.length;i++){
            this.EXPLines[i].activate(t);

            let lineOutput = this.outputs[i];


            //calculate the appropriate 4D color and set it. Manually. this is terrible. todo: make this dynamic and Transformation-chainable
            let ptA = this.points[this.lineData[i][0]];
            let ptB = this.points[this.lineData[i][1]];

            let ptA4DCoordinates = ptA;
            let ptB4DCoordinates = ptB;
            //THIS IS TERRIBLE
            for(let j=0;j<this.preEmbeddingTransformations.length;j++){
                ptA4DCoordinates = this.preEmbeddingTransformations[j].expr(i,t,...ptA4DCoordinates);
                ptB4DCoordinates = this.preEmbeddingTransformations[j].expr(i,t,...ptB4DCoordinates);
            }

            let color1 = fourDColorMap(ptA4DCoordinates[3]);
            lineOutput._setColorForVertexRGB(0, color1.r, color1.g, color1.b);

            let color2 = fourDColorMap(ptB4DCoordinates[3]);
            lineOutput._setColorForVertexRGB(1, color2.r, color2.g, color2.b);

		    lineOutput._geometry.attributes.color.needsUpdate = true;
        }
    }
}

export function makeHypercube(R4Embedding, R4Rotation, scene){

    let points = [];
    let lines = [];

    //utility function used to avoid adding [a,b] and [b,a] as two separate lines twice
    function addLine(oneIndex, twoIndex){
        if(oneIndex < twoIndex){
             lines.push([oneIndex,twoIndex]) 
        }
    }

    for(let x=0;x<=1;x++){ //-1 - 1
        for(let y=0;y<=1;y++){
            for(let z=0;z<=1;z++){
                for(let w=0;w<=1;w++){
                    let point = [x-0.5,y-0.5,z-0.5, w] //xyz are -1/2 to 1/2, w is 0-1
                    points.push(point);
        
                    //we should now add a line to every point that shares 3/4 coordinates
                    let pointIndex = w + 2*z + 4*y + 8*x;
                    addLine(pointIndex, ((1-w)+ 2*z     +4*y     + 8*x));
                    addLine(pointIndex, (w    + 2*(1-z) +4*y     + 8*x));
                    addLine(pointIndex, (w    + 2*z     +4*(1-y) + 8*x));
                    addLine(pointIndex, (w    + 2*z     +4*y     + 8*(1-x)));
                }
            }
        }
    }

    return new Polychoron(points, lines, R4Embedding, R4Rotation, scene);
}

export function makeHypertetrahedron(R4Embedding, R4Rotation, scene){ //Also known as a 5-cell
    let sq5 = Math.sqrt(5), sq29 = Math.sqrt(2/9), sq23 = Math.sqrt(2/3);
    let fivecell = new Polychoron(
        [//points
            //[0,0,0,0], [0,0,0,1], [0,0,1,0], [0,1,0,0], [1,0,0,0],

            //[1,1,1,-1/sq5], [1,-1,-1,-1/sq5], [-1,1,-1,-1/sq5], [-1,-1,1,-1/sq5], [0,0,0,sq5-1/sq5]
            [sq5*Math.sqrt(8/9),-sq5/3,0,0], [-sq5*sq29,-sq5/3,-sq5*sq23,0], [-sq5*sq29,-sq5/3,sq5*sq23,0], [0,sq5,0,0], [0,0,0,1] //has base on XZ plane, almost all w=0

        ],
        [ //lines
            [0,1], [0,2], [0,3], [0,4],
            [1,2],[1,3],[1,4],
            [2,3],[2,4],
            [3,4],
        ],
    R4Embedding,R4Rotation, scene);

    return fivecell;

}



function torus3Parametrization(theta1,theta2,theta3){
    let a=0.5,b=1,c=1;
    return [
    ((a*Math.cos(theta1)+b)*Math.cos(theta2)+c)*Math.cos(theta3),
    ((a*Math.cos(theta1)+b)*Math.sin(theta2)+c)*Math.cos(theta3),
    (a*Math.sin(theta1)+c)*Math.cos(theta3),
    Math.sin(theta3),
    ];
}

export function makeTorus3(R4Embedding, R4Rotation, scene){

    let points = [];
    let lines = [];

    //utility function used to avoid adding [a,b] and [b,a] as two separate lines twice
    function addLine(oneIndex, twoIndex){
        if(oneIndex < twoIndex){
             lines.push([oneIndex,twoIndex]) 
        }
    }

    const firstSubdivisions = 8;
    const secondSubdivisions = 8;
    const thirdSubdivisions = 6;

    const calcArrayIndex = (index1, index2, index3) => index3 + index2* (thirdSubdivisions+1) + index1 * (thirdSubdivisions+1)*(secondSubdivisions+1);

    for(let index1=0;index1<=firstSubdivisions;index1++){
        for(let index2=0;index2<=secondSubdivisions;index2++){
            for(let index3=0;index3<=thirdSubdivisions;index3++){
                    let theta1 = index1/firstSubdivisions * Math.PI*2;
                    let theta2 = index2/secondSubdivisions * Math.PI*2;
                    let theta3 = index3/thirdSubdivisions * Math.PI*2;

                    let point = torus3Parametrization(theta1,theta2,theta3);
                    points.push(point);
        
                    //line time
                    let thisIndex = calcArrayIndex(index1, index2, index3);

                    //line to the point that shares 1st,2nd coords
                    if(index3 != thirdSubdivisions){
                      let thirdNeighborIndex = calcArrayIndex(index1, index2, index3+1);
                      addLine(thisIndex,thirdNeighborIndex);
                    }
                     //line to the point that shares 1st,3rd coords
                    if(index2 != secondSubdivisions){
                      let secondNeighborIndex = calcArrayIndex(index1, index2+1, index3);
                      addLine(thisIndex,secondNeighborIndex);
                    }
                    //line to the point that shares 2nd,3rd coords
                    if(index1 != firstSubdivisions){
                      let firstNeighborIndex = calcArrayIndex(index1+1, index2, index3);
                      addLine(thisIndex,firstNeighborIndex);
                    }
            }
        }
    }

    return new Polychoron(points, lines, R4Embedding, R4Rotation, scene);
}



