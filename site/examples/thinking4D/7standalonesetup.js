//contains all the code if you want to visit 7 fourdimensions alone

let three, controls, controlsToRotateAboutOrigin, objects=[], presentation;

let axisRotation = null;


let xAxis, yAxis,zAxis = null;


function setupThree(){
	three = EXP.setupThree(60,15,document.getElementById("canvas"));
	controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);

    controlsToRotateAboutOrigin = new RotateAboutCenterControls([],three.renderer.domElement);
    

	three.camera.position.z = 6;
	three.camera.position.y = 0.5;
    //controls.autoRotate = true;
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
		controls.update();
        controlsToRotateAboutOrigin.update(time.delta);
	});

    
	presentation = new EXP.UndoCapableDirector();
    console.log("Loaded.");

}

    function setup3DAxes(){
        let axisSize = 1.5;
        xAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
        xAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
        xAxis
        .add(new EXP.Transformation({expr: (i,t,x) => [axisSize*x,0,0]}))
        .add(xAxisControl)
        .add(R4Rotation.makeLink())
        .add(R4Embedding.makeLink())
        .add(new EXP.VectorOutput({width:3, color: coordinateLine1Color}));
        
        xAxis
        .add(new EXP.Transformation({expr: (i,t,x) => [-axisSize*x,0,0]}))
        .add(xAxisControl.makeLink())
        .add(R4Rotation.makeLink())
        .add(R4Embedding.makeLink())
        .add(new EXP.VectorOutput({width:3, color: coordinateLine1Color}));

        yAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
        yAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
        yAxis
        .add(new EXP.Transformation({expr: (i,t,x) => [0,axisSize*x,0]}))
        .add(yAxisControl)
        .add(R4Rotation.makeLink())
        .add(R4Embedding.makeLink())
        .add(new EXP.VectorOutput({width:3, color: coordinateLine2Color}));
        yAxis
        .add(new EXP.Transformation({expr: (i,t,x) => [0,-axisSize*x,0]}))
        .add(yAxisControl.makeLink())
        .add(R4Rotation.makeLink())
        .add(R4Embedding.makeLink())
        .add(new EXP.VectorOutput({width:3, color: coordinateLine2Color}));

        zAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
        zAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
        zAxis
        .add(new EXP.Transformation({expr: (i,t,x) => [0,0,axisSize*x]}))
        .add(zAxisControl)
        .add(R4Rotation.makeLink())
        .add(R4Embedding.makeLink())
        .add(new EXP.VectorOutput({width:3, color: coordinateLine3Color}));
        zAxis
        .add(new EXP.Transformation({expr: (i,t,x) => [0,0,-axisSize*x]}))
        .add(zAxisControl.makeLink())
        .add(R4Rotation.makeLink())
        .add(R4Embedding.makeLink())
        .add(new EXP.VectorOutput({width:3, color: coordinateLine3Color}));
    }

function setupAxes(){
    setup4DAxes();

    [xAxis, yAxis, zAxis, wAxis].forEach((x) => objects.push(x));

}




function setup4DPolychora(){

    polychora = [];

    
    let hypercube = makeHypercube(R4Embedding, [R4Rotation]);
    hypercube.objectParent.position.x = 2;

    let sq5 = Math.sqrt(5), sq29 = Math.sqrt(2/9), sq23 = Math.sqrt(2/3);
    let fivecell = new Polychoron(
        [//points
            //[0,0,0,0], [0,0,0,1], [0,0,1,0], [0,1,0,0], [1,0,0,0],

            //[1,1,1,-1/sq5], [1,-1,-1,-1/sq5], [-1,1,-1,-1/sq5], [-1,-1,1,-1/sq5], [0,0,0,sq5-1/sq5]
            [sq5*Math.sqrt(8/9),-sq5/3,0,0], [-sq5*sq29,-sq5/3,-sq5*sq23,0], [-sq5*sq29,-sq5/3,sq5*sq23,0], [0,sq5,0,0], [0,0,0,1] //has base on XZ plane, almost all w=0

        ],
        [ //lines
            [0,1], [0,2], [0,3], [0,4],
            [1,2],[1,3],[1,4],
            [2,3],[2,4],
            [3,4],
        ],
    R4Embedding,R4Rotation);
    fivecell.objectParent.position.x = -3;

    
    //VERY COOL! but also a bit laggy
    /*
    let torus3 = makeTorus3(R4Embedding, R4Rotation);
    objects.push(torus3);
    polychora = [hypercube, fivecell, torus3];
    */

    objects.push(hypercube);
    objects.push(fivecell);

    polychora = [hypercube, fivecell];
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
