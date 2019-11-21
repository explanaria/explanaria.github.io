let three, controls, objects=[], presentation;


function setupThree(){
	three = EXP.setupThree(60,15,document.getElementById("canvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);
    

	three.camera.position.z = 6;
	three.camera.position.y = 0.5;
    //controls.autoRotate = true;
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
		controls.update();
	});

    
	presentation = new EXP.UndoCapableDirector();
    console.log("Loaded.");

}

function setupAxes(){
    let axisSize = 1.5;
    xAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    xAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
    xAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [axisSize*x,0,0]}))
    .add(xAxisControl)
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine1Color}));
    
    xAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [-axisSize*x,0,0]}))
    .add(xAxisControl.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine1Color}));

    yAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    yAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
    yAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,axisSize*x,0]}))
    .add(yAxisControl)
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine2Color}));
    yAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,-axisSize*x,0]}))
    .add(yAxisControl.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine2Color}));

    let zAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    zAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
    zAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,0,axisSize*x]}))
    .add(zAxisControl)
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine3Color}));
    zAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,0,-axisSize*x]}))
    .add(zAxisControl.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine3Color}));

    setup4DAxes();

    [xAxis, yAxis, zAxis, wAxis].forEach((x) => objects.push(x));

}


function setup(){
    setupThree();
    setup4DEmbedding();
    setup4DPolychora();
    setupAxes();
}

window.addEventListener("load",function(){
    setup();
    animate4DStandalone();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
