let three, controls, objects, knotParams;

let pointCoords = [];

function setup(){
	three = EXP.setupThree(60,15,document.getElementById("canvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);
    

	three.camera.position.z = 3;
	three.camera.position.y = 0.5;
    controls.autoRotate = true;
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
		controls.update();
	});

    let blue = 0x0070f0;
    let green = 0x50d050;

    let fadedRed = 0xf07000;
    let fadedPurple = 0xf070f0;

    let gray = 0x555555;


    let coordinateLine1Color = 'hsl(260,81%,69%)';
    let coordinateLine2Color = 'hsl(160,81%,69%)';
    let coordinateLine3Color = 'hsl(60,81%,69%)';

    console.log("Loaded.");

    var a=1;
    var b=2;
    let domainWidth = 2*Math.PI; //width of the area in R^2 that's being passed into this parametrization.

    function manifoldEmbeddingIntoR3(i,t,theta1,theta2){
        if(userPointParams.factors[0] == 'circle'){

            if(userPointParams.factors[1] == 'circle'){
                return [(a*Math.cos(theta1)+b)*Math.cos(theta2),(a*Math.cos(theta1)+b)*Math.sin(theta2),a*Math.sin(theta1)];
            }else{
                return [b*Math.sin(theta1),theta2/1.5,b*Math.cos(theta1)];
            }

        }else{

            if(userPointParams.factors[1] == 'circle'){
                return [b*Math.sin(theta2),theta1/1.5,b*Math.cos(theta2)];
            }else{
                //plane
                return [theta2, theta1, 0];
            }


        }
    }


    var torus = new EXP.Area({bounds: [[-domainWidth/2,domainWidth/2],[-domainWidth/2, domainWidth/2]], numItems: [30,30]});
    /*var manifoldParametrization = new EXP.Transformation({'expr': (i,t,theta1,theta2) => manifoldEmbeddingIntoR3(i,t,theta1,theta2)
    });
    var output = new EXP.SurfaceOutput({opacity:0.3, color: blue, showGrid: true, gridLineWidth: 0.05, showSolid:true});

    torus.add(manifoldParametrization).add(output);*/


    var threeDPoint = new EXP.Array({data: [[0]]})
    var manifoldPoint = new EXP.Transformation({expr: (i,t,x) => [Math.sin(t/3), Math.sin(t/5), Math.sin(t/7)]});
    threeDPoint
    .add(manifoldPoint)
    .add(new EXP.PointOutput({width:0.2, color: fadedRed}));

    var xAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    xAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [x,0,0]}))
    //.add(new EXP.VectorOutput({width:10, color: coordinateLine1Color}));
    xAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [4*(x-0.5),0,0]}))
    .add(new EXP.LineOutput({width:3, color: coordinateLine1Color}));

    var yAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    yAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,x,0]}))
    //.add(new EXP.VectorOutput({width:10, color: coordinateLine2Color}));
    yAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,4*(x-0.5),0]}))
    .add(new EXP.LineOutput({width:3, color: coordinateLine2Color}));

    var zAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    zAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,0,x]}))
    //.add(new EXP.VectorOutput({width:10, color: coordinateLine3Color}));
    zAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,0,4*(x-0.5)]}))
    .add(new EXP.LineOutput({width:3, color: coordinateLine3Color}));


    var pointXAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    pointXAxis
    .add(manifoldPoint.makeLink())
    .add(new EXP.Transformation({expr: (i,t,x,y,z) => i==0 ? [0,0,0]: [x,0,0]}))
    .add(new EXP.VectorOutput({width:10, color: coordinateLine1Color}));

    var pointYAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    pointXAxis
    .add(manifoldPoint.makeLink())
    .add(new EXP.Transformation({expr: (i,t,x,y,z) => i==0 ? [x,0,0]: [x,y,0]}))
    .add(new EXP.VectorOutput({width:10, color: coordinateLine2Color}));

    var pointZAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    pointXAxis
    .add(manifoldPoint.makeLink())
    .add(new EXP.Transformation({expr: (i,t,x,y,z) => i==0 ? [x,y,0]: [x,y,z]}))
    .add(new EXP.VectorOutput({width:10, color: coordinateLine3Color}));

    //read out the point's coords
    manifoldPoint.add(new EXP.Transformation({expr: (i,t,x,y,z) => pointCoords=[x,y,z]}))

    let pointUpdater = {'activate':function(){
        document.getElementById("coord1").innerHTML = format(pointCoords[0]);
        document.getElementById("coord2").innerHTML = format(pointCoords[1]);
        document.getElementById("coord3").innerHTML = format(pointCoords[2]);
    }};


    document.getElementById("coord1").style.backgroundColor = coordinateLine1Color
    document.getElementById("coord2").style.backgroundColor = coordinateLine2Color
    document.getElementById("coord3").style.backgroundColor = coordinateLine3Color

    objects = [torus, threeDPoint, xAxis, yAxis, zAxis, pointXAxis, pointYAxis, pointZAxis, pointUpdater];
}

function format(x){
    return parseInt(x*100)/100;
}


async function animate(){
    //await EXP.delay(2000);
   // EXP.TransitionTo(knotParams,{'a':3,'b':2});
}

window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
