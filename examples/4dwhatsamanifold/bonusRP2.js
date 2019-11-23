let three, controls, objects, knotParams;

let userPointParams = {x1:Math.PI/2 ,x2:Math.PI/2};

let presentation = null;

let sphereOutput = null;
let sphereLineOutput = null;
let coord1SliderR = null;

//*/


function setup(){
	three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    presentation = new EXP.UndoCapableDirector();
    

	three.camera.position.z = 2;
	three.camera.position.y = 0.5;
    controls.enableKeys = false;
    //controls.autoRotate = true;
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
		controls.update();
	});

    console.log("Loaded.");

    var a=1;
    var b=2;

    let domainWidth = 2*Math.PI; //width of the area in R^2 that's being passed into this parametrization.

    
    //sphere
	let sphereParametrization = (i,t,theta1,theta2) => 
		[(a*Math.sin(theta1))*Math.cos(-theta2),a*Math.cos(theta1),(a*Math.sin(theta1))*Math.sin(-theta2)];


    var sphere = new EXP.Area({bounds: [[0,Math.PI*2],[0, Math.PI]], numItems: [30,30]});
    var timeChange = new EXP.Transformation({'expr': (i,t,theta1,theta2) => [theta1, theta2]});
    var manifoldParametrization = new EXP.Transformation({'expr': (i,t,theta1,theta2) => sphereParametrization(i,t,theta1,theta2) });
    sphereOutput = new EXP.SurfaceOutput({opacity:0.3, color: blue, showGrid: true, gridLineWidth: 0.05, showSolid:true});
    sphere.add(timeChange).add(manifoldParametrization).add(sphereOutput);

    //sphere's lines
    sphereLineOutput = new EXP.LineOutput({width: 10, color: coordinateLine2ColorLighter, opacity: 0});
    manifoldParametrization.add(sphereLineOutput);

    var coord1 = new EXP.Area({bounds: [[0,1]], numItems: 20});
    let coord1Range = Math.PI; //how wide the coordinate display should be
    coord1
    .add(new EXP.Transformation({expr: (i,t,x) => [(x)*coord1Range,userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine1Color}));


    var userPoint1 = new EXP.Array({data: [[0,1]]}); //discarded
    let manifoldLink = manifoldParametrization.makeLink();
    userPoint1
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,userPointParams.x2]}))
    .add(manifoldLink)
    .add(new EXP.PointOutput({width:0.3, color: pointColor}));

    //point 2
    manifoldLink
    .add(new EXP.Transformation({expr: (i,t,x,y,z) => [-x,-y,-z]}))
    .add(new EXP.PointOutput({width:0.3, color: pointColor}));

    var userLine = new EXP.Array({data: [[0],[1]]}); //discarded
    let manifoldLink2 = manifoldParametrization.makeLink();
    let LEF = 10; //line extension factor. 1 = ends on sphere, 3 = radius = 3*sphere raidus
    userLine
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.Transformation({expr: (i,t,x,y,z) => i==0?[-x,-y,-z]:[x,y,z]}))
    .add(new EXP.Transformation({expr: (i,t,x,y,z) => [LEF*x,LEF*y,LEF*z]}))
    .add(new EXP.LineOutput({width:10, color: pointColor}));


    
    var coord2 = new EXP.Area({bounds: [[0,1]], numItems: 200});
    let coord2Range = 2*Math.PI; //how wide the coordinate should be
    coord2
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,(x-0.5)*coord2Range + userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine2Color}));

    //points to highlight edges
	var singularPoints = new EXP.Array({data: [[0,0],[Math.PI,0]]});
	var ptOutput = new EXP.PointOutput({color: green, width: 0.1});

    singularPoints.add(manifoldParametrization.makeLink()).add(ptOutput);

	var singularPoints = new EXP.Array({data: [[0,0],[Math.PI,0]]});
	var ptOutput = new EXP.PointOutput({color: green, width: 0.1});

    singularPoints.add(manifoldParametrization.makeLink()).add(ptOutput);



    objects = [sphere, /*coord1, coord2,*/ userPoint1, userLine, singularPoints];

    setupRP2Atlas(objects, manifoldParametrization);
}

async function animate(){
    //await presentation.begin();

    //await presentation.nextSlide();
}


class PlaneSliderWithANewCanvas extends PlaneSlider{
    constructor(color, containerID, valueGetter, valueSetter){
        super(color, containerID, valueGetter, valueSetter);
    }

    setupCanvas(containerID){
        //make a new canvas
        this.canvas = document.createElement("canvas");

        let container = document.createElement("div")
        container.className = "chart";
        container.appendChild(this.canvas);
        document.getElementById(containerID).appendChild(container);
    }
}


window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
