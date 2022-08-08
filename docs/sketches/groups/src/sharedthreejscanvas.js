import * as EXP from "../../../resources/build/explanaria-bundle.js";

//there's only ever one 3D canvas. but each time svelte switches chapters, destroying and recreates all the DOM, it gets removed from one set of DOM, and attached in a different place

let canvas = document.createElement("canvas")

export let three = EXP.setupThree(canvas);

export function attachCanvas(newparent, classToGive){
    if(typeof(newparent) == "string"){
        newparent = document.getElementById(newparent);
    }
    removeCanvas();
    newparent.appendChild(canvas)
    canvas.className = classToGive;
    three.resizeCanvasIfNecessary();
    return canvas;
}
export function removeCanvas(){
    let parent = canvas.parentElement;
    if(parent){
        parent.removeChild(canvas)
    }
}
