let three, controls, objects, knotParams;

let pointCoords = [0,0,0];

let presentation = null;

let manifoldPoint = null;//will be an EXP.Transformation



let twoDCanvasHandler = null;

//represent
class twoDCoordIntroScene{
    constructor(canvasID){
        this.canvas = document.getElementById(canvasID);
        this.context = this.canvas.getContext("2d");

        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
        this.onWindowResize();

        this.opacity = 1;

        this.cartesianOpacity = 1;
        this.polarOpacity = 0;

    }
    onWindowResize(){
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;

    }
    activate(t){
        this.canvas.width = this.canvas.width;

        this.context.fillStyle = '#ffffff';
        this.context.fillRect(0,0,this.canvas.width, this.canvas.height);
        this.canvas.style.opacity = this.opacity;

        let centerPos = [this.canvas.width/2, this.canvas.height/2];


        let pointPos = [100,100];
        pointPos = [150*Math.sin(t/3), 150*Math.sin(t/5)];
    
           
        this.context.globalAlpha = this.cartesianOpacity;
        this.draw2DCoordinates(t, pointPos);
        this.drawCartesianText(t, centerPos, pointPos);

        this.context.globalAlpha = this.polarOpacity;
        this.drawPolarCoordinates(t, pointPos);
        this.drawPolarText(t, centerPos, pointPos);

        this.context.globalAlpha = 1;

        
        //point    
        this.context.fillStyle = "#f07000";
        drawCircle(this.context, centerPos[0]+pointPos[0],centerPos[1]+pointPos[1],20);
    }
    draw2DCoordinates(t, pointPos){


        let pos = [this.canvas.width/2, this.canvas.height/2];

        let lineLength = Math.min(Math.min(this.canvas.width, this.canvas.height)*2/3, 500);

        this.context.lineWidth = 10;


        this.context.strokeStyle = coordinateLine1Color;
        drawVerticalArrow(this.context, pos, lineLength, 20, 20,);
        this.context.strokeStyle = coordinateLine2Color;
        drawHorizontalArrow(this.context, pos, lineLength, 20, 20);

        //lines to point
        this.context.lineWidth = 10;
        this.context.strokeStyle = coordinateLine2Color;
        drawArrow(this.context, pos[0], pos[1], pos[0] + pointPos[0], pos[1], 30);
        this.context.strokeStyle = coordinateLine1Color;
        drawArrow(this.context, pos[0]+ pointPos[0], pos[1], pos[0] + pointPos[0], pos[1]+ pointPos[1], 30);
    }
    drawCartesianText(t, pos, pointPos){
        this.drawTwoCoordinates([pos[0]+pointPos[0],pos[1]+pointPos[1]], [pointPos[0]/100, -pointPos[1]/100]);
    }
    drawPolarText(t, pos, pointPos){
        const size = Math.sqrt(pointPos[1]*pointPos[1] + pointPos[0]*pointPos[0])
        let angle = Math.atan2(pointPos[1],pointPos[0]);
        angle = (angle+(Math.PI*2))%(Math.PI*2)
        this.drawTwoCoordinates([pos[0]+pointPos[0],pos[1]+pointPos[1]], [size/100, angle]);
    }
    drawTwoCoordinates(pos, coordinates){
        this.context.font = "48px Computer Modern Serif";

        let allStrings = ['[',format(coordinates[0]),',',format(coordinates[1]),']'];

        let textX = pos[0] + 50;
        let textY = pos[1] - 50;
        for(let i=0;i<allStrings.length;i++){

            let metrics = this.context.measureText(allStrings[i]);

            //draw a transparent rectangle under the text
            this.context.fillStyle = "rgba(255,255,255,0.9)"
            this.context.fillRect(textX, textY-38, metrics.width, 52);

            if(i == 1){this.context.fillStyle = coordinateLine2Color;}
            else if(i == 3){this.context.fillStyle = coordinateLine1Color}
            else{this.context.fillStyle = '#444';}

            this.context.fillText(allStrings[i], textX, textY);

            textX += metrics.width;
        }
    }
    drawPolarCoordinates(t, pointPos){
        let pos = [this.canvas.width/2, this.canvas.height/2];

        let lineLength = Math.min(Math.min(this.canvas.width, this.canvas.height)*2/3, 500);

        this.context.lineWidth = 10;


        this.context.strokeStyle = 'rgba(170,170,170, 0.5)';
        drawVerticalArrow(this.context, pos, lineLength, 20, 20,);
        drawHorizontalArrow(this.context, pos, lineLength, 20, 20);


        this.context.strokeStyle = 'white';
        //drawArrow(this.context, pos[0], pos[1], pos[0] + 150, pos[1], 30);

        //axis 1: arc
        const size = Math.sqrt(pointPos[1]*pointPos[1] + pointPos[0]*pointPos[0])
        let angle = Math.atan2(pointPos[1],pointPos[0]);
        let radius = Math.min(100, size*2/3); //show circle smaller than 100px if angle is smaller than 100px
        
        this.context.strokeStyle = coordinateLine1Color;
        this.context.beginPath();
        this.context.arc(pos[0],pos[1], radius, 0, angle);
        this.context.stroke();

        //arrow straight to the point
        this.context.strokeStyle = coordinateLine2Color;
        drawArrow(this.context, pos[0], pos[1], pos[0] + pointPos[0], pos[1]+ pointPos[1], 30);
    }
}

function setup(){
	three = EXP.setupThree(60,15,document.getElementById("canvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);
    

	three.camera.position.z = 3;
	three.camera.position.y = 0.5;

    controls.autoRotate = true;    
    controls.enableKeys = false;
    controls.autoRotateSpeed = 1;
    
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
    manifoldPoint = new EXP.Transformation({expr: (i,t,x) => [Math.sin(t/3), Math.sin(t/5), Math.sin(t/7)]});
    threeDPoint
    .add(manifoldPoint)
    .add(new EXP.PointOutput({width:0.2, color: pointColor}));

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


    document.getElementById("coord1").style.color = coordinateLine1Color;
    document.getElementById("coord2").style.color = coordinateLine2Color;
    document.getElementById("coord3").style.color = coordinateLine3Color;

    twoDCanvasHandler = new twoDCoordIntroScene("twoDcanvasOverlay");
    
	presentation = new EXP.UndoCapableDirector();

    objects = [twoDCanvasHandler, torus, threeDPoint, xAxis, yAxis, zAxis, pointXAxis, pointYAxis, pointZAxis, pointUpdater];
}

function format(x){
    return Number(x).toFixed(2);
}


async function animate(){
    twoDCanvasHandler.cartesianOpacity = 0;
    await presentation.begin();

    await presentation.nextSlide();
    presentation.TransitionTo(twoDCanvasHandler, {'cartesianOpacity':1}, 750);
    
    await presentation.nextSlide();
    /*
    presentation.TransitionTo(twoDCanvasHandler, {'cartesianOpacity':0}, 750);
    await presentation.delay(500);
    presentation.TransitionTo(twoDCanvasHandler, {'polarOpacity':1}, 750);*/

    presentation.TransitionTo(twoDCanvasHandler, {'polarOpacity':1, 'cartesianOpacity':0}, 750);


    await presentation.nextSlide();
    presentation.TransitionTo(twoDCanvasHandler, {'opacity':0}, 750);

    //technically this is a string. the CSS animation handles the transition.
    let threeDCoords = document.getElementById("coords");
    presentation.TransitionTo(threeDCoords.style, {'opacity':1}, 0);
   
    /*
    await presentation.nextSlide();
    presentation.TransitionTo(manifoldPoint, {expr: (i,t,x) => [5,5,5]});*/
}

window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
