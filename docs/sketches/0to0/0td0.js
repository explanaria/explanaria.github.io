import "../../resources/build/explanaria-bundle.js"; //loads EXP into global namespace

await EXP.pageLoad();

window.three = EXP.setupThree(document.getElementById("threeDcanvas"));

var controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);

three.camera.position.set(5,5,12);
three.camera.lookAt(new THREE.Vector3(5,5,0))

/*
three.camera.position.z *= 5;
three.camera.zoom *= 5; //remove distortion from FOV
three.camera.updateProjectionMatrix();*/

let objects = [];

let gridColor = "grey";

window.sourceDomain = new EXP.Area({bounds: [[-5,5],[-5,5]], numItems: 11});
sourceDomain.add(new EXP.SurfaceOutput({color: gridColor, showSolid: false, opacity:0.2})); //green grid

let powerFuncColor = 'blue';

let powerFunc = new EXP.Transformation({expr: (i, t, x, y) => [x,y, Math.pow(x, y)]});
let powerFuncOutput = new EXP.SurfaceOutput({color: powerFuncColor, opacity: 0.2});
sourceDomain.add(powerFunc).add(powerFuncOutput);

let triangleLineColor = "fuchsia";

let xSquaredLine = window.xSquaredLine = new EXP.Area({bounds: [[-5, 5], [-5, 5]], numItems: [11, 30]});
xSquaredLine.add(new EXP.Transformation({expr: (i,t,x,y) => [y,x]}))
.add(powerFunc.makeLink())
.add(new EXP.LineOutput({opacity:1, color: triangleLineColor})); //line between the triangles

objects = objects.concat(xSquaredLine, sourceDomain);

//onthreejsMousedown

three.on("update",function(time){
    objects.forEach(i => i.activate(time.t));
});


function setupGoat(presentation){
    //analytics
    document.addEventListener('visibilitychange', function(e) {
        if (window.goatcounter === undefined)return;
        if (document.visibilityState !== 'hidden')
            return
        if (goatcounter.filter())
            return
        navigator.sendBeacon(goatcounter.url({
            event: true,
            title: location.pathname + location.search + " unloaded on slide " + presentation.currentSlideIndex,
            path: function(p) { return 'unload-' + p + '-slide-'+presentation.currentSlideIndex },
        }))
    })
}

//animation code

console.log("loaded")

let presentation = new EXP.UndoCapableDirector();
window.presentation = presentation;
await presentation.begin();
setupGoat(presentation);
await presentation.nextSlide();
