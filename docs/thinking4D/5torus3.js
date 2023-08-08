import * as EXP from "../resources/build/explanaria-bundle.js";
import {CircleSlider, PlaneSlider, drawCircle} from "./sliders.js";
import {coordinateLine1Color, coordinateLine1ColorDarker, coordinateLine2Color, coordinateLine2ColorDarker, coordinateLine3Color, coordinateLine3ColorDarker, pointColor, blue} from "./colors.js";

let three, controls, objects=[], knotParams;

let userPointParams = {x1:0,x2:0,x3:0};
let userPointParamController = null;

let presentation = null;

let sphereOutput = null;
let sphereLineOutput = null;
let coord1SliderC, coord2SliderC, coord3SliderC = null;

let cube,cube2 = null;
let userPoint1, userPoint2, coord1,coord2,coord3,torus = null;

let torusCoord1, torusCoord2;

function wrapToInterval(x,size){
    //move number into [-1, +1]
    //x%1 would work, but -1%1 == 0 in JS
    if(Math.abs(x) == size)return x;
    let s2 = 2*size;
    return (((x+size)%s2)+s2)%s2 -size; //javascript % is absolute-valued: -1 % 3 == -1, not 2. this is normally terrible but used here
}


class CircleToSidewaysSlider extends CircleSlider{
    // a circleslider that can animate into a line slider.
    //in retrospect I should have just animated this via explanaria instead of doing it internally
    constructor(...args){
        super(...args);
        this.lineAnimationFactor = 0;

        let lerpNumbers = (x,y) => x * (this.lineAnimationFactor) + y*(1-this.lineAnimationFactor);
    }
    lerpTo(a,b){
        return EXP.Math.lerpVectors(this.lineAnimationFactor, a, b);
    }
    drawPointTrack(){
        //this.radius = 35 / 100 * this.canvas.width;
        //this.pointRadius = 15 /100 * this.canvas.width;

        //draw some line segments
        let endHeight = 10/100 * this.canvas.width;
        this.context.beginPath();
        this.context.moveTo(this.pos[0] - this.radius*this.lineAnimationFactor, this.pos[1] - endHeight * this.lineAnimationFactor+ this.radius*(1-this.lineAnimationFactor));
        this.context.lineTo(this.pos[0] - this.radius*this.lineAnimationFactor, this.pos[1] + endHeight * this.lineAnimationFactor+ this.radius*(1-this.lineAnimationFactor));
        this.context.moveTo(this.pos[0] + this.radius*this.lineAnimationFactor, this.pos[1] - endHeight * this.lineAnimationFactor + this.radius*(1-this.lineAnimationFactor));
        this.context.lineTo(this.pos[0] + this.radius*this.lineAnimationFactor, this.pos[1] + endHeight * this.lineAnimationFactor+ this.radius*(1-this.lineAnimationFactor));
        this.context.stroke();        

        //draw the circle/line blended together
        this.context.beginPath();
        let circleStartPos = [this.pos[0], this.pos[1] + this.radius]
        let lineStartPos = [this.pos[0] - this.radius, this.pos[1]]
        this.context.moveTo(...this.lerpTo(lineStartPos, circleStartPos));
        for(var i=0; i <= Math.PI*2+0.01; i += Math.PI/30){
            

            let circlePos = [this.pos[0] + Math.cos(i+Math.PI/2)*this.radius, this.pos[1] + Math.sin(i+Math.PI/2) * this.radius];
            let linePos = [this.pos[0] - this.radius + (i / (Math.PI))*this.radius, this.pos[1]];

            this.context.lineTo(...this.lerpTo(linePos, circlePos));
        }
        this.context.stroke();

       // drawCircleStroke(this.context, this.pos[0],this.pos[1],this.radius);
    }
    drawPoint(x,y){
        let circlePos = [this.pos[0] + this.radius*Math.cos(this.value), this.pos[1] + this.radius*Math.sin(this.value)]
        let linePos = [this.pos[0] + (wrapToInterval(this.value, Math.PI)/Math.PI) * this.radius, this.pos[1]];
        let pointPos = this.lerpTo(linePos, circlePos);

        drawCircle(this.context, pointPos[0], pointPos[1], this.pointRadius);
    }

    onmousemove(x,y){
        if(this.dragging){
            
            let mouseAngle = Math.atan2(y-this.pos[1],x-this.pos[0]);
            this.value = this.lerpTo([(x - this.pos[0])/this.radius *Math.PI],[mouseAngle])[0];
            this.valueSetter(this.value);
        }
    }
}


class CoordMover{
    constructor(){
        this.x1Speed = 0
        this.x2Speed = 0;
        this.x3Speed = 0;
    
        this.prevT = 0;
    }
    activate(t){
        let dt = t-this.prevT;
        this.prevT=t; 
        userPointParams.x1 += dt * this.x1Speed;
        userPointParams.x2 += dt * this.x2Speed;
        userPointParams.x3 += dt * this.x3Speed;
    }

}

function setup(){
	three = EXP.setupThree(document.getElementById("threeDcanvas"));
	controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);

    presentation = new EXP.UndoCapableDirector();

    //set HTML colors
    Array.prototype.slice.call(document.getElementsByClassName("coord1")).forEach( (elem) => { elem.style.color = coordinateLine1Color; } );
    Array.prototype.slice.call(document.getElementsByClassName("coord2")).forEach( (elem) => { elem.style.color = coordinateLine2Color; } );
    Array.prototype.slice.call(document.getElementsByClassName("coord3")).forEach( (elem) => { elem.style.color = coordinateLine3Color; } );
    

	three.camera.position.z = 3;
	three.camera.position.y = 0.5;

    controls.enableKeys = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
		controls.update();
	});

	three.scene.add( new THREE.AmbientLight( 0x443333 ) );

	var light = new THREE.DirectionalLight( 0xffddcc, 1 );
	light.position.set( 1, 0.75, 0.5 );
	three.scene.add( light );

	var light = new THREE.PointLight( 0xccccff, 1 );
	light.position.set( - 1, 0.75, - 0.5 );
	three.scene.add( light );

    console.log("Loaded.");

    //cube to represent area
    
    let boxWidth = 2; //width of the area in R^3 that's being passed into this parametrization.

    let cubeGeom = new THREE.BoxGeometry(boxWidth,boxWidth,boxWidth);
    //apply vertex colors to the box so you can see where the sides that are glued are
    let colors = new THREE.BufferAttribute(new Float32Array(24 * 3), 3)
    cubeGeom.setAttribute("color", colors)

    for(var i=0;i<8;i++){
        let color = new THREE.Color(coordinateLine1ColorDarker).toArray();
        colors.setXYZ(i, ...color);
    }
    for(var i=8;i<16;i++){
        let color = new THREE.Color(coordinateLine2ColorDarker).toArray();
        colors.setXYZ(i, ...color);
    }
    for(var i=16;i<24;i++){
        let color = new THREE.Color(coordinateLine3ColorDarker).toArray();
        colors.setXYZ(i, ...color);
    }
    window.colors = colors;
    window.coordinateLine3ColorDarker = coordinateLine3ColorDarker;
    window.coordinateLine2ColorDarker = coordinateLine2ColorDarker;
    window.coordinateLine1ColorDarker = coordinateLine1ColorDarker;

    cube = new THREE.Mesh(cubeGeom, new THREE.MeshBasicMaterial({ opacity:1, side: THREE.BackSide, vertexColors: true, transparent: true}));
    three.scene.add(cube);

    let cubeMaterial2 = new THREE.MeshBasicMaterial({ opacity:0.2, side: THREE.BackSide, vertexColors: THREE.FaceColors, transparent: true});

    var cubeGridTex = new THREE.TextureLoader().load( 'grid.png', function(texture){
        cubeMaterial2.map = texture;
        cubeMaterial2.needsUpdate = true;
        cubeMaterial2.transparent = true;
    });

    cube2 = new THREE.Mesh(new THREE.BoxGeometry(boxWidth-0.01,boxWidth-0.01,boxWidth-0.01), cubeMaterial2);
    three.scene.add(cube2);

    cube.visible = false;
    cube2.visible = false;


    userPoint2 = new EXP.Array({data: [[0,1]]}); //discarded
    let manifoldParametrization = new EXP.Transformation({expr: (i,t,x,y,z) => [wrapToInterval(x/Math.PI,1),wrapToInterval(y/Math.PI,1),wrapToInterval(z/Math.PI,1)]});
    userPoint2
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,userPointParams.x2, userPointParams.x3]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.PointOutput({width:0.3, color: pointColor}));
    

   coord1 = new EXP.Area({bounds: [[0,1]], numItems: 20});
    let coord1Range = 2*Math.PI; //how wide the coordinate display should be
    coord1
    .add(new EXP.Transformation({expr: (i,t,x) => [(x-0.5)*coord1Range,userPointParams.x2, userPointParams.x3]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine1Color}));


    coord2 = new EXP.Area({bounds: [[0,1]], numItems: 20});
    let coord2Range = 2*Math.PI; //how wide the coordinate should be
    coord2
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,(x-0.5)*coord2Range, userPointParams.x3]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine2Color}));

    coord3 = new EXP.Area({bounds: [[0,1]], numItems: 20});
    let coord3Range = 2*Math.PI; //how wide the coordinate should be
    coord3
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,userPointParams.x2, (x-0.5)*coord3Range]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine3Color}));

    userPointParamController = new CoordMover();

    let a=0.5;
    let b=1;
    torus = new EXP.Area({bounds: [[0,Math.PI*2],[0,Math.PI*2]], numItems:24});
    let torusParametrization = new EXP.Transformation({expr: (i,t,theta1,theta2) => [(a*Math.cos(theta1)+b)*Math.cos(theta2),(a*Math.cos(theta1)+b)*Math.sin(theta2),a*Math.sin(theta1)]})
    torus.add(torusParametrization)
    .add(new EXP.SurfaceOutput({color: blue, opacity: 0.3, showGrid: true, gridLineWidth: 0.05, showSolid:true}));

    userPoint1 = new EXP.Array({data: [[0,1]]}); //discarded
    userPoint1
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,userPointParams.x2]}))
    .add(torusParametrization.makeLink())
    .add(new EXP.PointOutput({width:0.3, color: pointColor}));


    torusCoord1 = new EXP.Area({bounds: [[0,1]], numItems: 20});
    let torusCoord1Range = Math.PI*2; //how wide the coordinate display should be
    torusCoord1
    .add(new EXP.Transformation({expr: (i,t,x) => [(x)*torusCoord1Range,userPointParams.x2]}))
    .add(torusParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine1Color}));

    torusCoord2 = new EXP.Area({bounds: [[0,1]], numItems: 200});
    let torusCoord2Range = 2*Math.PI; //how wide the coordinate should be
    torusCoord2
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,(x-0.5)*torusCoord2Range + userPointParams.x2]}))
    .add(torusParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine2Color}));


    coord1SliderC = new CircleToSidewaysSlider(coordinateLine1Color, 'circle1', ()=>userPointParams.x1, (x)=>{userPointParams.x1=x});
    coord2SliderC = new CircleToSidewaysSlider(coordinateLine2Color, 'circle2', ()=>userPointParams.x2, (x)=>{userPointParams.x2=x});
    coord3SliderC = new CircleToSidewaysSlider(coordinateLine3Color, 'circle3', ()=>userPointParams.x3, (x)=>{userPointParams.x3=x});

    let flatSlider = new PlaneSlider(coordinateLine2Color, 'flatTorus2D', 
        ()=>{
            return [-userPointParams.x2/(Math.PI), (userPointParams.x1)/(Math.PI)];
        }, 
        (x,y)=>{
            userPointParams.x1=y*(Math.PI);
            userPointParams.x2=-x*Math.PI;
        });
    flatSlider.lineColor2 = coordinateLine1Color;

    objects = [coord1, coord2, coord3, userPoint2, coord1SliderC, coord2SliderC, coord3SliderC, userPointParamController, torus, torusCoord1,torusCoord2, userPoint1, flatSlider];
}

async function animate(){

    await presentation.begin();
    cube.material.opacity = 0;
    cube2.material.opacity = 0;

    cube.visible = false;
    cube2.visible = false;

    [userPoint2,coord1, coord2, coord3].forEach( (item) => item.getDeepestChildren().forEach((output) =>
    presentation.TransitionTo(output, {'opacity':0}, 1000)
    ));

    await presentation.nextSlide();

    let threeCoordinates = document.getElementById("secondTimesSign");
    presentation.TransitionTo(threeCoordinates.style, {'transform':'scale(0)'}, 0);

    let twoCoordinates = document.getElementById("circleContainer2");
    presentation.TransitionTo(twoCoordinates.style, {'transform':'scale(0)'}, 0);



    let questionMarks = document.getElementById("questionMarks");
    presentation.TransitionTo(questionMarks.style, {'opacity':0, 'pointerEvents': "none"}, 0);

    let threeDcanvas = document.getElementById("threeDcanvas");
    presentation.TransitionTo(threeDcanvas.style, {'opacity':1, 'pointerEvents':"all"}, 0);

    await presentation.nextSlide();

   


    [coord1SliderC,coord2SliderC,coord3SliderC].forEach( (item) => presentation.TransitionTo(item,{lineAnimationFactor:1}),1500);

    await presentation.nextSlide();

    let directSumFactors = document.getElementById("directSumFactors");
    presentation.TransitionTo(directSumFactors.style, {'opacity':0, 'pointerEvents': "none"}, 0);

    let flatTorus = document.getElementById("flatTorus");
    presentation.TransitionTo(flatTorus.style, {'opacity':1, 'pointerEvents':"all"}, 0);


    //show the 2D coordinate system. While this is happening, let's reset the three circle coordinates so they'll appear like this again when they unhide.
    [coord1SliderC,coord2SliderC,coord3SliderC].forEach( (item) => presentation.TransitionTo(item,{lineAnimationFactor:0}),1);
    await presentation.nextSlide();


    [torusCoord1, torusCoord2, torus, userPoint1].forEach( (item) => item.getDeepestChildren().forEach((output) =>
        presentation.TransitionTo(output, {'opacity':0}, 1000)
    ));
    presentation.TransitionTo(flatTorus.style, {'opacity':0, 'pointerEvents': "none"}, 0);
    presentation.TransitionTo(directSumFactors.style, {'opacity':1, 'pointerEvents':"all"}, 0);
    presentation.TransitionTo(questionMarks.style, {'opacity':1}, 0);


    await presentation.delay(1000);
    presentation.TransitionTo(twoCoordinates.style, {'transform':'scale(1)'}, 0);
    presentation.TransitionTo(threeCoordinates.style, {'transform':'scale(1)'}, 0);





    //cube: appear!

    await presentation.nextSlide();
    presentation.TransitionTo(questionMarks.style, {'opacity':0}, 0);
    [coord1SliderC,coord2SliderC,coord3SliderC].forEach( (item) => presentation.TransitionTo(item,{lineAnimationFactor:1},1000));

    presentation.TransitionTo(cube, {'visible':true}, 1);
    presentation.TransitionTo(cube2, {'visible':true}, 1);

    await presentation.delay(1000);

    [userPoint2, coord1, coord2, coord3].forEach(
        (item) => {
            item.getDeepestChildren().forEach(
                (output) => {
                    presentation.TransitionTo(output, {'opacity':1}, 1000);
                }
            )
        }
	);

    presentation.TransitionTo(cube.material, {'opacity':1}, 1000)
    presentation.TransitionTo(cube2.material, {'opacity':1}, 1000)

    await presentation.nextSlide();

    /*
    presentation.TransitionTo(userPointParamController, {'x1Speed':8}, 125);
    await presentation.delay(125);
    presentation.TransitionTo(userPointParamController, {'x1Speed':-8}, 125);
    await presentation.delay(125);
    presentation.TransitionTo(userPointParamController, {'x1Speed':8}, 125);
    await presentation.delay(125);
    presentation.TransitionTo(userPointParamController, {'x1Speed':-8}, 125);
    await presentation.delay(125);
    presentation.TransitionTo(userPointParamController, {'x1Speed':0}, 125);
    await presentation.delay(250);

    presentation.TransitionTo(userPointParamController, {'x2Speed':4}, 1000);
    await presentation.delay(1250);
    presentation.TransitionTo(userPointParamController, {'x2Speed':-4}, 1000);
    await presentation.delay(1250);
    presentation.TransitionTo(userPointParamController, {'x2Speed':0}, 1000);

    presentation.TransitionTo(userPointParamController, {'x3Speed':4}, 1000);
    await presentation.delay(1250);
    presentation.TransitionTo(userPointParamController, {'x3Speed':-4}, 1000);
    await presentation.delay(1250);
    presentation.TransitionTo(userPointParamController, {'x3Speed':0}, 1000);
    */


    presentation.TransitionTo(userPointParams, {'x1':Math.PI*2}, 2000);
    await presentation.delay(2000);
    presentation.TransitionTo(userPointParams, {'x2':Math.PI*2}, 2000);
    await presentation.delay(2000);
    presentation.TransitionTo(userPointParams, {'x3':Math.PI*2}, 2000);


    await presentation.nextSlide();
    //slide 4: fancy pattern
    objects.pop()
    let fancyFlight = {activate: function(t){userPointParams.x1 = 2*Math.sin(t/2);userPointParams.x2 = 5*Math.sin(t/1.7);userPointParams.x3 = 2*Math.sin(t/1.3);}};
    objects.push(fancyFlight);

    //[coord1SliderC,coord2SliderC,coord3SliderC].forEach( (item) => presentation.TransitionTo(item,{lineAnimationFactor:0}),1500);

    //back to user controllable
    //await presentation.nextSlide();
    //objects.pop();
}


window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
