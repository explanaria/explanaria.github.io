import {rColor, sColor, tColor, yColor, xColor, zColor, pColor, qColor, twoNColor, white, black, twoNTextColor, invalidIntegerColor, validIntegerColor} from "./colors.js";
import katex from './dist/katex-v0.13.13/katex.mjs';

import {Dynamic3DText} from "./katex-labels.js";

function getAppropriateColor(string, customColorDict={}){
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
        if(string == "z"){
            return zColor.getStyle();
        }
        if(string == "p"){
            return pColor.getStyle();
        }
        if(string == "q"){
            return qColor.getStyle();
        }
        if(string == "irrational"){
            return invalidIntegerColor.getStyle();
        }
        if(string == "rational"){
            return validIntegerColor.getStyle();
        }
   
        if(string in customColorDict){
            return customColorDict[string].getStyle();
        }

        return "";
}


function walkAndAddColor(elem, customColorDict){
    if(elem.children.length == 0){
        //no children, add color
        let color = getAppropriateColor(elem.innerHTML, customColorDict);
        if(color != ""){
            if(elem.style)elem.style.color = color;
        }
        return;
    }

    if(elem.className == "mord"){

    }

    for(let i=0;i<elem.children.length;i++){
        walkAndAddColor(elem.children[i], customColorDict)
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
    if(document.readyState == 'complete'){
        scanPageAndAddColor();
    }else{
    document.addEventListener("DOMContentLoaded", scanPageAndAddColor);
    }
}



export class AutoColoring3DText extends Dynamic3DText{
    constructor(options){
        super(options);
         //a dict of {"x": redColor}. will color all instances of X with the color redColor.
        //note that you can specify numbers like "2" or "3", but it'll also color the 2 in x^2
        this.customColorDict = options.customColors || {};

        this.numberColors = {};
        
    }
    renderDisplayedText(){
        katex.render(this._text, this.htmlElem, {
            throwOnError: false
        });
        walkAndAddColor(this.htmlElem, this.customColorDict);

        this.htmlElem.children[this.htmlElem.children.length]
    }
}

export class ColorSuccessiveNumbers3DText extends Dynamic3DText{
    constructor(options){
        super(options);
         //[color1, color2, color3]. used for (a/2,b/2,c/2) to color the entire fraction
        this.customColors = options.customColors || [];
        
    }
    renderDisplayedText(){
        katex.render(this._text, this.htmlElem, {
            throwOnError: false
        });
        walkAndAddColor(this.htmlElem, {});

        let katexHtmlRoot = this.htmlElem.children[0].children[1]

        let colorsUsed = 0;
        for(let j=0;j<katexHtmlRoot.children.length;j++){
            let base = katexHtmlRoot.children[j];
            for(let i=0;i<base.children.length;i++){
                let elem = base.children[i];
                if(elem.className == "mord" && colorsUsed < this.customColors.length){
                    if(elem.style)elem.style.color = this.customColors[colorsUsed].getStyle();
                    colorsUsed+= 1;
                }
            }
        }
    }
}

