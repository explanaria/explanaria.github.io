import {Dynamic3DText} from "./1-katex-labels.js";

let a=1;
let b=5;
let c=7;


function setup(){
    window.three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
    //var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    console.log("Loaded.");

    var area = new EXP.Area({bounds: [[0, Math.PI*1]],numItems: 16});
    var id = new EXP.Transformation({'expr': (i,t,x) => [5*Math.cos(x+t),5*Math.sin(x+t),0]});



    three.camera.position.set(c/2,c/2,8);
    three.camera.lookAt(new THREE.Vector3(c/2,c/2,0))

    /*
    var aSquare = new EXP.Array({data: [[0,0], [a,0],[a,a],[0,a]]});
    aSquare
        .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y]}))
        .add(new EXP.ClosedPolygonOutput({color: 0x00ff55}));

    var bSquare = new EXP.Array({data: [[0,b],[0,a],[a,a],[a,0], [b,0],[b,b]]});
    bSquare
        .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y]}))
        .add(new EXP.ClosedPolygonOutput({color: 0x0055ff, opacity:0.5}));
    bSquare.children[0].add(new EXP.LineOutput({color: 0x4488ff, width: 20}))

    var cSquare = new EXP.Array({data: [[0,c],[0,b],[b,b],[b,0], [c,0],[c,c]]});
    cSquare
        .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y]}))
        .add(new EXP.ClosedPolygonOutput({color: 0x55ff00}));
    */

    let aColor = 0x00ff55
    let bColor = 0x4488ff
    let cColor = 0x55ff00
    let twoNColor = 0xff66ff;

    window.aSquarePos = new EXP.Transformation({'expr':(i,t,x,y) => [x,y]});
    var aSquare = new EXP.Array({data: [[0,0], [a,0],[a,a],[0,a]]});
    aSquare
        .add(aSquarePos)
        .add(new EXP.ClosedPolygonOutput({color: aColor}));

    var bSquareTop = new EXP.Array({data: [[0,b],[0,a], [b,a],[b,b]]});
    bSquareTop
        .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y]}))
        .add(new EXP.ClosedPolygonOutput({color: bColor}));
    //bSquare.children[0].add(new EXP.LineOutput({color: 0x4488ff, width: 20}))

    var cSquareTop = new EXP.Array({data: [[0,c],[0,b],[b,b],[b,a], [c,a],[c,c]]});
    cSquareTop
        .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y]}))
        .add(new EXP.ClosedPolygonOutput({color: cColor}));

    window.bottomPartPos = new EXP.Transformation({'expr':(i,t,x,y) => [x,y]});
    var bSquareBottom = new EXP.Array({data: [[a,a],[a,0], [b,0],[b,a]]});
    bSquareBottom
        .add(bottomPartPos.makeLink())
        .add(new EXP.ClosedPolygonOutput({color: bColor}));

    var cSquareBottom = new EXP.Array({data: [[b,a],[b,0],[c,0],[c,a]]});
    cSquareBottom
        .add(bottomPartPos.makeLink())
        .add(new EXP.ClosedPolygonOutput({color: cColor}));
        
    //todo: hide
    var bigBorder1 = new EXP.Array({data: [[0,c],[0,a],[a,a],[a,0], [c,0],[c,c], [0,c]]});
    window.firstBorderLine = new EXP.LineOutput({color: 0xff88ff, opacity:0, width:10})
    bigBorder1
        .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y,0.01]}))
        .add(firstBorderLine);
    


    window.aText = new Dynamic3DText({
        text: (t) => "a^2", 
        color: (t) => "black",
        position3D: (t) => window.aSquarePos.expr(0,t,a/2,a/2)
    })

    window.bText = new Dynamic3DText({
        text: (t) => "b^2", 
        color: (t) => "black",
        position3D: (t) => [b/2,b/2]
    })

    window.cText = new Dynamic3DText({
        text: (t) => "c^2", 
        color: (t) => "black",
        position3D: (t) => [(b+c)/2,(b+c)/2]
    })

    window.firstTwoNText = new Dynamic3DText({
        text: (t) => "2N", 
        color: (t) => twoNColor,
        position3D: (t) => [(a+c)/2,(a+c)/2],
        opacity: 0, //0
    })

    window.secondTwoNText = new Dynamic3DText({
        text: (t) => "\\text{Still} 2N", 
        color: (t) => twoNColor,
        position3D: (t) => [(a+c)/2,(a+c)/2],
        opacity: 0, //0
    })

    var grid = new EXP.Area({bounds: [[-5,5],[-5,5]],numItems: 16});
    grid.add(new EXP.PointOutput({width: 0.2, color:0xcccccc})); // grid

    window.objects = [aSquare, bSquareTop, bSquareBottom, cSquareTop, cSquareBottom, bigBorder1, aText, bText, cText, firstTwoNText, secondTwoNText]
    three.on("update",function(time){
	    objects.forEach(i => i.activate(time.t));
	    //controls.update();
    });
}

async function animate(){

	await EXP.delay(5000);

    
    await EXP.TransitionTo(bText, {'opacity':0});
    await EXP.TransitionTo(cText, {'opacity':0});

    //await presentation.nextSlide();

    await EXP.TransitionTo(aSquarePos, {'expr': (i,t,x,y) => [x-1.2,y-0.2]})
    await EXP.delay(1000);

    await EXP.TransitionTo(firstBorderLine, {'opacity':1});
    await EXP.TransitionTo(firstTwoNText, {'opacity':1});

    //await presentation.nextSlide();

    await EXP.TransitionTo(firstBorderLine, {'opacity':0});
    await EXP.TransitionTo(firstTwoNText, {'opacity':0});

    await EXP.TransitionTo(bottomPartPos, {'expr': (i,t,x,y) => [x,y-0.2]})
    await EXP.delay(1000);

    await EXP.TransitionTo(bottomPartPos, {'expr': (i,t,x,y) => [x+c+2,y-0.2]})
    await EXP.delay(1000);
    await EXP.TransitionTo(bottomPartPos, {'expr': (i,t,x,y) => [-y+c+a+1,x]}, 1000)
    await EXP.delay(2000);
    await EXP.TransitionTo(bottomPartPos, {'expr': (i,t,x,y) => [-y+c+a,x]}, 1000)
    await EXP.TransitionTo(secondTwoNText, {'opacity':1});
}


window.addEventListener("load",function(){
    setup();
    animate();
})
