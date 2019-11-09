let three, controls, objects, knotParams;

let userPointParams = {x1:0,x2:0,x3:0};

let presentation = null;

let sphereOutput = null;
let sphereLineOutput = null;
let coord1SliderC, coord2SliderC, coord3SliderC = null;

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


function wrapToInterval(x,size){
    //move number into [-1, +1]
    //x%1 would work, but -1%1 == 0 in JS
    if(Math.abs(x) == size)return x;
    let s2 = 2*size;
    return (((x+size)%s2)+s2)%s2 -size; //javascript % is absolute-valued: -1 % 3 == -1, not 2. this is normally terrible but used here
}

function setup(){
	three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    presentation = new EXP.UndoCapableDirector();
    

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
    for(var i=0;i<4;i++){
        cubeGeom.faces[i].color = new THREE.Color(coordinateLine1ColorDarker);
    }
    for(var i=4;i<8;i++){
        cubeGeom.faces[i].color = new THREE.Color(coordinateLine2ColorDarker);
    }
    for(var i=8;i<12;i++){
        cubeGeom.faces[i].color = new THREE.Color(coordinateLine3ColorDarker);
    }

    var cube = new THREE.Mesh(cubeGeom, new THREE.MeshBasicMaterial({ opacity:0.2, side: THREE.BackSide, vertexColors: THREE.FaceColors}));
    three.scene.add(cube);

    let cubeMaterial2 = new THREE.MeshBasicMaterial({ opacity:0.2, side: THREE.BackSide, vertexColors: THREE.FaceColors, transparent: true});

    var cubeGridTex = new THREE.TextureLoader().load( 'grid.png', function(texture){
        cubeMaterial2.map = texture;
        cubeMaterial2.needsUpdate = true;
        cubeMaterial2.transparent = true;
    });

    var cube2 = new THREE.Mesh(new THREE.BoxGeometry(boxWidth-0.01,boxWidth-0.01,boxWidth-0.01), cubeMaterial2);
    three.scene.add(cube2);


    var userPoint1 = new EXP.Array({data: [[0,1]]}); //discarded
    let manifoldParametrization = new EXP.Transformation({expr: (i,t,x,y,z) => [wrapToInterval(x/Math.PI,1),wrapToInterval(y/Math.PI,1),wrapToInterval(z/Math.PI,1)]});
    userPoint1
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,userPointParams.x2, userPointParams.x3]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.PointOutput({width:0.3, color: pointColor}));
    

    var coord1 = new EXP.Area({bounds: [[0,1]], numItems: 20});
    let coord1Range = 2*Math.PI; //how wide the coordinate display should be
    coord1
    .add(new EXP.Transformation({expr: (i,t,x) => [(x-0.5)*coord1Range,userPointParams.x2, userPointParams.x3]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine1Color}));


    var coord2 = new EXP.Area({bounds: [[0,1]], numItems: 20});
    let coord2Range = 2*Math.PI; //how wide the coordinate should be
    coord2
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,(x-0.5)*coord2Range, userPointParams.x3]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine2Color}));

    var coord3 = new EXP.Area({bounds: [[0,1]], numItems: 20});
    let coord3Range = 2*Math.PI; //how wide the coordinate should be
    coord3
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,userPointParams.x2, (x-0.5)*coord3Range]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine3Color}));

    coord1SliderC = new CircleToSidewaysSlider(coordinateLine1Color, 'circle1', ()=>userPointParams.x1, (x)=>{userPointParams.x1=x});
    coord2SliderC = new CircleToSidewaysSlider(coordinateLine2Color, 'circle2', ()=>userPointParams.x2, (x)=>{userPointParams.x2=x});
    coord3SliderC = new CircleToSidewaysSlider(coordinateLine3Color, 'circle3', ()=>userPointParams.x3, (x)=>{userPointParams.x3=x});

    objects = [coord1, coord2, coord3, userPoint1, coord1SliderC, coord2SliderC, coord3SliderC];
}

async function animate(){

    await presentation.begin();

    await presentation.nextSlide();
    [coord1SliderC,coord2SliderC,coord3SliderC].forEach( (item) => presentation.TransitionTo(item,{lineAnimationFactor:1}),1500);

    await presentation.nextSlide();

    let prevT = 0;
    let x1Mover = {activate: function(t){let dt = t-prevT; prevT=t; userPointParams.x1 += dt;}};
    objects.push(x1Mover);


    await presentation.nextSlide();
    //slide 2: change y
    objects.pop();
    let x2Mover = {activate: function(t){let dt = t-prevT; prevT=t; userPointParams.x2 += dt;}};
    objects.push(x2Mover);

    await presentation.nextSlide();
    //slide 3: change z
    objects.pop()
    let x3Mover = {activate: function(t){let dt = t-prevT; prevT=t; userPointParams.x3 += dt;}};
    objects.push(x3Mover);

    await presentation.nextSlide();
    //slide 4: fancy pattern
    objects.pop()
    let fancyFlight = {activate: function(t){userPointParams.x1 = 2*Math.sin(t/2);userPointParams.x2 = 5*Math.sin(t/1.7);userPointParams.x3 = 2*Math.sin(t/1.3);}};
    objects.push(fancyFlight);

    [coord1SliderC,coord2SliderC,coord3SliderC].forEach( (item) => presentation.TransitionTo(item,{lineAnimationFactor:0}),1500);

    await presentation.nextSlide();
    objects.pop();
    //back to user controllable
}


window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
