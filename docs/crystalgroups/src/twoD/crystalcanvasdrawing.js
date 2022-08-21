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
        if(string[i] != 'a' && string[i] != 'b' && string[i] != 'c' && string[i] != '⁻' && string[i] != '¹')return false;
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
        if(char == '⁻'){ //part of c⁻¹
            vec = EXP.Math.vectorScale(vec, -1)
        }
        if(char == "¹"){
            //nothing! the negating is done by the - sign
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

    else if(element.name == "m" || element.name == "m2" || element.name == "g" || element.name == "rg" || element.name == "gr"){//todo: add check for only "r"s being in there
        //draw a dotted flip line.
        //any Rs there will rotate the flip line.g

        let flipStartPos = [dash_radius, 0];

        if(element.name == "g")flipStartPos = EXP.Math.vectorScale(getTranslationVector("ca"), dash_radius/7);
        if(element.name == "rg" || element.name == "gr")flipStartPos = EXP.Math.vectorScale(getTranslationVector("cb"), dash_radius/7);

        if(element.name[0] == 'm'){
            flipStartPos = [0, dash_radius];
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
    else if(element.name == "rmg" || element.name == "mgr" || element.name == "rgm"  || element.name == "rc" || element.name == "mg" || element.name == "gm"){
        //glide rotation

        let flipStartPos = [5,0];
        if(element.name == "g")flipStartPos = EXP.Math.vectorScale(getTranslationVector("cb"), dash_radius/13);

        if(element.name == "mg")flipStartPos = EXP.Math.vectorScale(getTranslationVector("a"), dash_radius/13);
        if(element.name == "gm")flipStartPos = EXP.Math.vectorScale(getTranslationVector("a"), dash_radius/13);

        if(element.name == "rc")flipStartPos = EXP.Math.vectorScale(getTranslationVector("c"), dash_radius/13);
        if(element.name == "rmg" || element.name == "mgr" || element.name == "rgm")flipStartPos = EXP.Math.vectorScale(getTranslationVector("b"), dash_radius/13);

        let perpendicular = [-0.8* flipStartPos[1], 0.8*flipStartPos[0]];

        //now draw a dotted line from flipStartPos to -flipStartPos
        ctx.beginPath()
        let posX=0,posY=0;
        for(let i=-0.5;i<0.5;i+=0.02){
            let sineangle = Math.sin(2*(i+0.5) * Math.PI);

            posX = i * flipStartPos[0]  + (1-i) * (-flipStartPos[0]) + sineangle * perpendicular[0];
            posY = i * flipStartPos[1]  + (1-i) * (-flipStartPos[1]) + sineangle * perpendicular[1];
            if(i == -1){
                ctx.moveTo(posX, posY);
            }else{
                ctx.lineTo(posX, posY);
            }
        }
        ctx.stroke();

        let rotateTriangleCenter = EXP.Math.vectorAdd([posX,posY], EXP.Math.vectorScale(perpendicular, 0.8))
        drawTrianglePath(ctx, rotateTriangleCenter[0],rotateTriangleCenter[1], [perpendicular[0] * 0.3, perpendicular[1] * 0.3]);
   
        //arrow to signify translation
        let arrowStart = [flipStartPos[0], flipStartPos[1]];

        let finalPoint = [- 1.8*flipStartPos[0], - 1.8*flipStartPos[1]]

        ctx.beginPath()
        ctx.moveTo(...arrowStart);
        ctx.lineTo(...finalPoint);
        ctx.stroke();
        
        drawTrianglePath(ctx, arrowStart[0],arrowStart[1], [flipStartPos[0] * 0.3, flipStartPos[1] * 0.3]);
    }


    else if(element.name == "r"){
        let posX=0,posY=0;
        for(let arrowcount = 0; arrowcount < 2; arrowcount++){ //two arrows

            ctx.beginPath();
            let posX=0, posY=0;
            for(let i=0.8; i<Math.PI; i += 0.1){

                posX = Math.cos(i + Math.PI*arrowcount) * dash_radius * 2/3;
                posY *= 0.4; //skew for 3d effect
                posY = Math.sin(i + Math.PI*arrowcount) * dash_radius * 2/3;

                if(i == 0){
                    ctx.moveTo(posX, posY);
                }else{
                    ctx.lineTo(posX, posY);
                }
            }
            ctx.stroke();
            drawTrianglePath(ctx, posX, posY, [0, arrowcount == 0 ? -5 : 5]);
        }
    }

    else if(element.name == "rm" || element.name == "i"){
        //inversion
        let line = [0, dash_radius * 0.85];
        for(let arrowcount = 0; arrowcount < 3; arrowcount++){ //two arrows

            ctx.beginPath();
            ctx.moveTo(line[0], line[1]);
            ctx.lineTo(-line[0], -line[1]);
            ctx.stroke();
            drawTrianglePath(ctx, line[0], line[1], [line[0] * 0.2, line[1] * 0.2]);
            //drawTrianglePath(ctx, -line[0], -line[1], [line[0] * -0.2, line[1] * -0.2]);

            line = rotate2D(40, ...line);
        }

        
        ctx.beginPath();
        ctx.arc(0, 0, dash_radius * 0.3, 0, 2 * Math.PI);
        ctx.fill();
    }
}



export function easing(t){
    //cosine ease
    return (1-Math.cos(t * Math.PI))/2
}
