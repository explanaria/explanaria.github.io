import {rColor, sColor, tColor, yColor, xColor, twoNColor, white, black, twoNTextColor, invalidIntegerColor} from "./colors.js";
import katex from './dist/katex-v0.13.13/katex.mjs';

import {Dynamic3DText} from "./katex-labels.js";

function getAppropriateColor(string){
        if(string == "N"){
            return twoNColor.getStyle();
        }
        if(string == "r"){
            return rColor.getStyle();
        }
        if(string == "s"){
            return sColor.getStyle();
        }
        if(string == "t"){
            return tColor.getStyle();
        }
        if(string == "y"){
            return yColor.getStyle();
        }
        if(string == "x"){
            return xColor.getStyle();
        }
        if(string == "irrational"){
            return invalidIntegerColor;
        }
        return "";
}


function walkAndAddColor(elem){
    if(elem.children.length == 0){
        //no children, add color
        if(getAppropriateColor(elem.innerHTML) != ""){
            if(elem.style)elem.style.color = getAppropriateColor(elem.innerHTML);
        }
        return;
    }
    for(let i=0;i<elem.children.length;i++){
        walkAndAddColor(elem.children[i])
    }  
}

function scanPageAndAddColor(){
    let maths = document.getElementsByTagName("kmath");
    for(let i=0;i<maths.length;i++){
        let elem = maths[i];
        katex.render(elem.innerHTML, elem, {
            throwOnError: false
        });
        walkAndAddColor(elem);
        if("color" in elem.attributes && getAppropriateColor(elem.attributes.color.value) != ""){ //<kmath color='N'>10</kmath>
            if(elem.style)elem.style.color = getAppropriateColor(elem.attributes.color.value);
        }
    }
}

export function addColorToHTML(){
    //call before page loaded
    document.addEventListener("DOMContentLoaded", scanPageAndAddColor);
}



export class AutoColoring3DText extends Dynamic3DText{
    renderDisplayedText(){
        katex.render(this._text, this.htmlElem, {
            throwOnError: false
        });
        walkAndAddColor(this.htmlElem);
    }
}

