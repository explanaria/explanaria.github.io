import { rotate2D } from "./utils.js";


export const triangleShadowColor = "#555555";
export const triangleColor = "#bbbbbb";
export const D6TextColor = "#000";

export const triangleStrokeStyle = "hsla(0,0%,0%,0)";
export const arrowColor = "hsl(240, 90%, 70%)";


export const canvasSize = 3; //in em

//30 should really be "em to px"
export const canvasSizePixels = canvasSize * 30; //is this the right calculation? 

export const triangleRadius = 0.35*canvasSizePixels;
export const arrowCenterDistance = 0.43*canvasSizePixels; //how far from the center should the arced arrow that shows a rotation be?
export const offsetDegrees = 20; //don't end the arc directly at the end of the rotation, end slightly before to give the arrowhead some space
export const num_dashes = 5;
export const dash_radius = canvasSize/2; //how far from the center should dashed lines for mirroring go
export const D6_text_size_multiplier = 0.3;
export const lineWidth = 2;
export let NUM_DEGREES_IN_ONE_ROTATION = 120;


let startVertex = [0,-triangleRadius]; //one vertex of the triangle




export function drawTrianglePath(ctx, centerX, centerY, oneVertexVectorFromCenter){
    ctx.translate(centerX, centerY);
    ctx.beginPath();
    ctx.moveTo(...oneVertexVectorFromCenter);
    ctx.lineTo(...rotate2D(120, ...oneVertexVectorFromCenter));
    ctx.lineTo(...rotate2D(240, ...oneVertexVectorFromCenter));
    ctx.lineTo(...oneVertexVectorFromCenter);
    ctx.closePath();
    ctx.stroke();

    ctx.translate(-centerX, -centerY);
}


export function isAllRs(string){
    for(let i=0;i<string.length;i++){
        if(string[i] != 'r')return false;
    }
    return true;
}


export function drawStaticElements(ctx, element){
    //draw things like arcs or dotted lines to represent transformations. these don't move
    ctx.strokeStyle = arrowColor;
    if(isAllRs(element.name)){
        //this is a pure rotation. draw a rotation arrow
        //handles both "r" and "rr"!
        let rotationDegrees = NUM_DEGREES_IN_ONE_ROTATION * element.name.length; //increase arc distance if needed

        let arrowLineVec = [0,-arrowCenterDistance];

        ctx.beginPath();
        ctx.moveTo(...arrowLineVec);
        for(let i=0;i<rotationDegrees - offsetDegrees;i+=1){
            ctx.lineTo(...rotate2D(i, ...arrowLineVec));
        }             
        ctx.stroke();

        //arrowhead triangle
        
        let arrowheadSize = 6;
        let finalPoint = rotate2D(rotationDegrees - offsetDegrees, ...arrowLineVec);
        let finalDirection = rotate2D(90 + rotationDegrees - offsetDegrees, ...[0, -arrowheadSize]);

        drawTrianglePath(ctx, finalPoint[0],finalPoint[1], finalDirection);
        ctx.fillStyle = arrowColor;
        ctx.fill();
    }
    else if(element.name.search("f") != -1){//todo: add check for only "r"s being in there
        //draw a dotted flip line.
        //any Rs there will rotate the flip line.g
        let flipStartPos = [0, dash_radius];
        for(let i=element.name.length-1;i>=0;i--){ //traverse name from right to left, backwards, because that's how function notation works
            if(element.name[i] == 'r'){
                flipStartPos = rotate2D(NUM_DEGREES_IN_ONE_ROTATION, ...flipStartPos);
            }
            if(element.name[i] == 'f'){ //flip horizontally
                flipStartPos[0] = -flipStartPos[0];
            }
        }

        //now draw a dotted line from flipStartPos to -flipStartPos
        ctx.beginPath()
        for(let i=0;i<num_dashes*2;i++){
            let lerpFactor = i / (num_dashes*2);
            let posX = lerpFactor * flipStartPos[0]  + (1-lerpFactor) * (-flipStartPos[0]);
            let posY = lerpFactor * flipStartPos[1]  + (1-lerpFactor) * (-flipStartPos[1]);
            if(i%2 == 0){
                ctx.moveTo(posX, posY);
            }else{
                ctx.lineTo(posX, posY);
            }
        }
        ctx.stroke();
    }
}



export function easing(t){
    //cosine ease
    return (1-Math.cos(t * Math.PI))/2
}
