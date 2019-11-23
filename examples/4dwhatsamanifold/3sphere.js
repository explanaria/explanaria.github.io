let three, controls, objects, knotParams;

let userPointParams = {x1:Math.PI/2,x2:0,factors:['linear','linear']};

let presentation = null;

let sphereOutput = null;
let sphereLineOutput = null;
let coord1SliderR = null;

//*/


let twoDCanvasHandler = null;

let northPoleChartSurface, southPoleChartSurface, middleChartSurface = null;



//2D canvas class in the main canvas zone
class CircleCoordinateNotAlwaysCircularScene{
    constructor(canvasID){
        this.canvas = document.getElementById(canvasID);
        this.context = this.canvas.getContext("2d");

        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
        this.onWindowResize();

        this.opacity = 1;

        this.circleCoordOpacity = 1;
        this.textOpacity = 0;

        this.width = this.canvas.width;
    }
    onWindowResize(){
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
    }
    activate(t){
        if(this.canvas.parentElement.clientWidth != this.width)this.onWindowResize();
        this.canvas.width = this.canvas.width;

        this.context.fillStyle = '#ffffff';
        this.context.fillRect(0,0,this.canvas.width, this.canvas.height);
        this.canvas.style.opacity = this.opacity;

        let centerPos = [this.canvas.width/2, this.canvas.height/2];

        //axis 1: arc
        //this.context.globalAlpha = this.circleCoordOpacity;
        this.context.lineWidth = 10;
        this.context.strokeStyle = coordinateLine2Color;

        let radius = 0.5 * 0.8 * Math.min(this.canvas.width, this.canvas.height);
        radius = radius * Math.sin(userPointParams.x1);
        radius = Math.max(radius, 5);
        drawCircleStroke(this.context, centerPos[0], centerPos[1], radius);

        this.context.globalAlpha = 1;

        if(radius == 5){
            this.drawText(centerPos);
        }
    }
    drawText(pos){
        let fontSize = Math.min(48, this.canvas.width / 10);

        this.context.font = fontSize+"px Computer Modern Serif";

        this.context.fillStyle = "black";

        let string = "Not a circle!";

        let metrics = this.context.measureText(string);

        let textX = pos[0] - metrics.width/2;
        let textY = pos[1] - 50;
        this.context.fillText("This is a point,", textX, textY - fontSize*1.2);
        this.context.fillText("not a circle!", textX, textY);
    }
}


function setup(){
	three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    presentation = new EXP.UndoCapableDirector();
    

	three.camera.position.z = 2;
	three.camera.position.y = 0.5;

    controls.enableKeys = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    three.scene.add(new THREE.AmbientLight(0xffffff));
    
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
		[(a*Math.sin(theta1))*Math.cos(theta2),a*Math.cos(theta1),(a*Math.sin(theta1))*Math.sin(theta2)];


    var sphere = new EXP.Area({bounds: [[0,Math.PI*2],[0, Math.PI]], numItems: [30,30]});
    var timeChange = new EXP.Transformation({'expr': (i,t,theta1,theta2) => [theta1, theta2]});
    var manifoldParametrization = new EXP.Transformation({'expr': (i,t,theta1,theta2) => sphereParametrization(i,t,theta1,theta2) });
    sphereOutput = new EXP.SurfaceOutput({opacity:0.3, color: blue, showGrid: true, gridLineWidth: 0.05, showSolid:true});

    //SO. For some reason, this makes everything look a lot better with transparency on. It still renders things behind it properly (I guess that takes depthTest).
    //I guess it OVERWRITES the thing behind it instead of adding to it?
    //which looks bad at opacity 1.0, but looks GREAT at opacity 0.3 - 0.
    //I wonder if I rendered things in two parts, one solid color with  X, and one lines with depthWrite off, whether it would look awesome
    //
    sphereOutput.mesh.material.depthWrite = false;
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
    userPoint1
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.PointOutput({width:0.3, color: pointColor}));
    
    var coord2 = new EXP.Area({bounds: [[0,1]], numItems: 200});
    let coord2Range = 2*Math.PI; //how wide the coordinate should be
    coord2
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,(x-0.5)*coord2Range + userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine2Color}));

    coord1SliderR = new RealNumberSlider(coordinateLine1Color, '1real', ()=>userPointParams.x1/(Math.PI/2)-1, (x)=>{userPointParams.x1=(x+1)*(Math.PI/2)});
    let coord1SliderC = new CircleSlider(coordinateLine2Color, '1circle', ()=>userPointParams.x2, (x)=>{userPointParams.x2=x});

    coord1SliderR.mode = 'vertical';

    //coordinate charts for north pole, south pole


/*
    let middleCircleChart = new CirclePlaneSlider(coordinateLine3Color, 'northPoleSlider', 
        ()=>{
            let radius = (Math.PI/2-userPointParams.x1);
            let pos = [Math.cos(userPointParams.x2)*radius, Math.sin(userPointParams.x2)*radius];
            return pos;
        }, 
        (x,y)=>{
            let angle = Math.atan2(y,x);
            let radius = Math.sqrt(y*y+x*x);
            userPointParams.x1=(-Math.PI/2+radius);
            userPointParams.x2=angle;
        });

*/


    const poleChartRadius = Math.PI/2;


    let northPoleSlider = new CirclePlaneSlider(coordinateLine4Color, 'northPoleSlider', 
        ()=>{
            let radius = (userPointParams.x1)/poleChartRadius;
            let pos = [Math.cos(userPointParams.x2)*radius, Math.sin(userPointParams.x2)*radius];
            return pos;
        }, 
        (x,y)=>{
            let angle = Math.atan2(y,x);
            let radius = Math.sqrt(y*y+x*x);
            userPointParams.x1=(radius*poleChartRadius);
            userPointParams.x2=angle;
        });

    let southPoleSlider = new CirclePlaneSlider(coordinateLine3Color, 'southPoleSlider', 
        ()=>{
            let radius = (Math.PI-userPointParams.x1)/poleChartRadius;
            let pos = [Math.cos(-userPointParams.x2)*radius, Math.sin(-userPointParams.x2)*radius];
            return pos;
        }, 
        (x,y)=>{
            let angle = Math.atan2(y,x);
            let radius = Math.sqrt(y*y+x*x);
            userPointParams.x1=(Math.PI-radius*poleChartRadius);
            userPointParams.x2=-angle;
        });

    northPoleChartSurface = new EXP.Area({bounds: [[0, poleChartRadius],[0,2*Math.PI]], numItems: [10,30]});
    northPoleChartSurface
    .add(manifoldParametrization.makeLink())
    .add(new EXP.SurfaceOutput({width:10, color: coordinateLine4Color, opacity:0, gridLineWidth: 0.1, showSolid:true, gridSquares: 8}));
    northPoleChartSurface.children[0].children[0].mesh.scale.set(1.01, 1.01, 1.01);

    southPoleChartSurface = new EXP.Area({bounds: [[Math.PI-poleChartRadius,Math.PI],[0,2*Math.PI]], numItems: [10,30]});
    southPoleChartSurface
    .add(manifoldParametrization.makeLink())
    .add(new EXP.SurfaceOutput({width:10, color: coordinateLine3Color, opacity:0, gridLineWidth: 0.1, showSolid:true, gridSquares: 8}));
    southPoleChartSurface.children[0].children[0].mesh.scale.set(1.01, 1.01, 1.01);

    middleChartSurface = new EXP.Area({bounds: [[poleChartRadius/1.5,Math.PI-poleChartRadius/1.5],[0.2,2*Math.PI+0.2]], numItems: [10,30]});
    middleChartSurface
    .add(manifoldParametrization.makeLink())
    .add(new EXP.SurfaceOutput({width:10, color: coordinateLine2Color, opacity:0, gridLineWidth: 0.1, showSolid:0.9, gridSquares: 8}));
    middleChartSurface.children[0].children[0].mesh.scale.set(1.02, 1.02, 1.02);



    //points to highlight edges
	var singularPoints = new EXP.Array({data: [[0,0],[Math.PI,0]]});
	var ptOutput = new EXP.PointOutput({color: green, width: 0.1});

    singularPoints.add(manifoldParametrization.makeLink()).add(ptOutput);

    twoDCanvasHandler = new CircleCoordinateNotAlwaysCircularScene("twoDcanvas");

    objects = [twoDCanvasHandler, sphere, coord1, coord2, userPoint1, coord1SliderC, coord1SliderR, singularPoints, northPoleSlider, southPoleSlider, northPoleChartSurface, southPoleChartSurface,middleChartSurface];
}

async function animate(){

    let canvasContainer = document.getElementById('canvasContainer');

    //twoDCanvasHandler.cartesianOpacity = 0;
    await presentation.begin();

    await presentation.nextSlide();
    presentation.TransitionTo(sphereOutput, {'opacity':0.03}, 750);

    /*
    presentation.TransitionTo(sphereOutput, {'opacity':0}, 750);
    await presentation.delay(750);
    presentation.TransitionTo(sphereLineOutput, {'opacity':0.5}, 750);
    */

    //animation is done in CSS with 1500 

    //TODO: when this undos, call three.onWindowResize();
    objects.push({activate: function(){three.onWindowResize()}}); //ensure canvas keeps aspect ratio properly
    presentation.TransitionTo(canvasContainer.style, {'grid-template-columns': '2fr 1fr'}, 0);
    await presentation.delay(1500);
    objects.pop(); //delete that last object

    //HORRIBLE HACK ALERT

    window.addEventListener("mouseup", () => three.onWindowResize());
    window.addEventListener("touchend",() => three.onWindowResize());



    await presentation.nextSlide();

    presentation.TransitionTo(coord1SliderR, {'value': -1}, 1000);

    await presentation.nextSlide();

    // "But what if we use more than one coordinate system?

    await presentation.nextSlide();

    objects.push({activate: function(){three.onWindowResize()}}); //ensure canvas keeps aspect ratio properly
    presentation.TransitionTo(canvasContainer.style, {'grid-template-columns': '2fr 0fr', 'transition':'all 0.75s ease-in-out'}, 0);

    await presentation.delay(1000);
    objects.pop(); //delete that last object



    [northPoleChartSurface,middleChartSurface,southPoleChartSurface].forEach( (item) => {
        item.getDeepestChildren().forEach( (output) => {
            presentation.TransitionTo(output, {'opacity': 1});
        })
    });

}


window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
