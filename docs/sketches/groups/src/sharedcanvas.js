export let three = EXP.setupThree();


export let canvas = three.renderer.canvas;

//there's only ever one 3D canvas. but each time svelte switches chapters, destroying and recreates all the DOM, it gets removed from one set of DOM, and attached in a different place

function attachCanvas(newparent, classToGive){
    let parent = canvas.parentElement; //???
    if(parent){
        parent.removeChild(canvas)
    }
    newparent.appendChild(canvas)
    canvas.classString = classToGive;
    return canvas;
}
