import * as EXP from "../resources/build/explanaria-bundle.js";
function setup(){}
let presentation = new EXP.UndoCapableDirector();

async function animate(){
    await presentation.begin();

    for(let i=0;i<11;i++){
    await presentation.nextSlide();
    }
}

window.addEventListener("load",function(){
    setup();
    animate();
});
