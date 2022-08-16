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


const cleanMaterial = material => {
    material.dispose()
    // dispose textures
    for (const key of Object.keys(material)) {
	    const value = material[key]
	    if (value && typeof value === 'object' && 'minFilter' in value) {
		    //disposing texture
		    value.dispose()
	    }
    }
}

export function clearThreeScene(){

    three.scene.traverse(object => {
	    if (!object.isMesh) return;

	    object.geometry.dispose()

	    if (object.material.isMaterial) {
		    cleanMaterial(object.material)
	    } else {
		    // an array of materials
		    for (const material of object.material) cleanMaterial(material)
	    }
    })
    three.scene.clear();
    three.camera.position.set(0,0,5);
    three.camera.zoom = 1;
    three.camera.rotation.set(0,0,0);
    three.camera.updateMatrix();
}


//allow EXP to animate camera zooms
let lastZoom = 1;
function updateCameraIfNeeded(){
    if(three.camera.zoom != lastZoom){
        three.camera.updateProjectionMatrix();
        lastZoom = three.camera.zoom;
    }
}
three.on("update", updateCameraIfNeeded) //todo: remove event listener on onDestroy
