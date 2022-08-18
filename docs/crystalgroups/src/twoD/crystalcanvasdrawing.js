import { rotate2D } from "./utils.js";
import * as EXP from "../../../resources/build/explanaria-bundle.js";
import {defaultGroupElementBorderColor, specialGeneratorColors} from "../colors.js";
import {drawTrianglePath} from "./d6canvasdrawing.js";

export const canvasSize = 2; //in em

//30 should really be "em to px"
export const canvasSizePixels = canvasSize * 30; //is this the right calculation? 

const dash_radius = canvasSizePixels * 0.4;
const num_dashes = 4;


export const dotColor = "gray";
export const dotColor2 = "red";

export function isPureTranslation(string){
    for(let i=0;i<string.length;i++){
        if(string[i] != 'a' && string[i] != 'b' && string[i] != 'c')return false;
    }
    return true;
}

let aVec = [7,0];
let bVec = [0,-7];
let cVec = [-4,4];

export function getTranslationVector(string){
    let vec = [0,0];
    for(let i=0;i<string.length;i++){
        let char = string[i];
        if(char == 'a'){
            vec = EXP.Math.vectorAdd(vec, aVec)
        }
        if(char == 'b'){
            vec = EXP.Math.vectorAdd(vec, bVec)
        }
        if(char == 'c'){
            vec = EXP.Math.vectorAdd(vec, cVec)
        }
    }
    return vec;
}

function chooseColor(name){
    if(specialGeneratorColors[name])return specialGeneratorColors[name];
    return defaultGroupElementBorderColor;
}


export function drawStaticElements(ctx, element){
    //draw things like arcs or dotted lines to represent transformations. these don't move
    //ctx.strokeStyle = arrowColor;
    ctx.fillStyle = ctx.strokeStyle = chooseColor(element.name);

    if(isPureTranslation(element.name)){
        //this is a pure translation
        let translationVec = getTranslationVector(element.name)

        ctx.beginPath();
        ctx.moveTo(...rotate2D(180, ...translationVec));
        ctx.lineTo(...translationVec);
        ctx.stroke();

        //arrowhead triangle
        
        let arrowheadSize = 6;
        let finalPoint = translationVec;
        let finalDirection = translationVec;

        drawTrianglePath(ctx, finalPoint[0],finalPoint[1], finalDirection);
        ctx.fill();
    }

    else if(element.name == "m" || element.name == "m2" || element.name == "g" || element.name == "g1" || element.name == "g2"){//todo: add check for only "r"s being in there
        //draw a dotted flip line.
        //any Rs there will rotate the flip line.g

        let flipStartPos = [dash_radius, 0];
        if(element.name[0] == 'm'){
            //no tilt
            let flipStartPos = [0, dash_radius];
        }else{
            //tilt different directions
            flipStartPos = rotate2D(30, ...flipStartPos);
            for(let i=element.name.length-1;i>=0;i--){ //traverse name from right to left, backwards, because that's how function notation works

                if(element.name[i] == '2'){
                    let rotationDegrees = 80;
                    flipStartPos = rotate2D(rotationDegrees, ...flipStartPos);
                }
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
        
        if(element.name.indexOf("g") !== -1){
            //glide reflection. draw an arrow

            //arrow to signify translation
            let arrowStart = [flipStartPos[0] * 0.8, flipStartPos[1] * 0.8];
            arrowStart[0] += flipStartPos[1] * 0.5;
            arrowStart[1] -= flipStartPos[0] * 0.5;

            let finalPoint = [arrowStart[0] - 1.8*flipStartPos[0], arrowStart[1] - 1.8*flipStartPos[1]]

            ctx.beginPath()
            ctx.moveTo(...arrowStart);
            ctx.lineTo(...finalPoint);
            ctx.stroke();
            
            drawTrianglePath(ctx, arrowStart[0],arrowStart[1], [flipStartPos[0] * 0.3, flipStartPos[1] * 0.3]);
        }
        
    }
}



export function easing(t){
    //cosine ease
    return (1-Math.cos(t * Math.PI))/2
}
