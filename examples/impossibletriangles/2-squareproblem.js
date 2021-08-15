import {Dynamic3DText} from "./1-katex-labels.js";


function setup(){
    window.three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
    //var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    console.log("Loaded.");

    var area = new EXP.Area({bounds: [[0, Math.PI*1]],numItems: 16});
    var id = new EXP.Transformation({'expr': (i,t,x) => [5*Math.cos(x+t),5*Math.sin(x+t),0]});

    let a=1;
    let b=5;
    let c=7;


    three.camera.position.set(c/2,c/2,8);
    three.camera.lookAt(new THREE.Vector3(c/2,c/2,0))

    var aSquare = new EXP.Array({data: [[0,0], [a,0],[a,a],[0,a]]});
    aSquare
        .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y]}))
        .add(new EXP.ClosedPolygonOutput({color: 0x00ff55}));

    var bSquare = new EXP.Array({data: [[0,b],[0,a],[a,a],[a,0], [b,0],[b,b]]});
    bSquare
        .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y]}))
        .add(new EXP.ClosedPolygonOutput({color: 0x0055ff}));

    var cSquare = new EXP.Array({data: [[0,c],[0,b],[b,b],[b,0], [c,0],[c,c]]});
    cSquare
        .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y]}))
        .add(new EXP.ClosedPolygonOutput({color: 0x55ff00}));

    let aText = new Dynamic3DText({
        text: (t) => "a^2", 
        color: (t) => "black",
        position3D: (t) => [a/2,a/2]
    })

    let bText = new Dynamic3DText({
        text: (t) => "b^2", 
        color: (t) => "black",
        position3D: (t) => [b/2,b/2]
    })

    let cText = new Dynamic3DText({
        text: (t) => "c^2", 
        color: (t) => "black",
        position3D: (t) => [(b+c)/2,(b+c)/2]
    })

    var grid = new EXP.Area({bounds: [[-5,5],[-5,5]],numItems: 16});
    grid.add(new EXP.PointOutput({width: 0.2, color:0xcccccc})); // grid

    window.objects = [aSquare, bSquare, cSquare, aText, bText, cText]
    three.on("update",function(time){
	    objects.forEach(i => i.activate(time.t));
	    //controls.update();
    });
}

async function animate(){

	await EXP.delay(5000);
}


window.addEventListener("load",function(){
    setup();
    animate();
})
