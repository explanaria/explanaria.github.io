let three, controls, objects, knotParams;

let userPointParams = {x1:Math.PI/2,x2:0,factors:['linear','linear']};

let presentation = null;



let overhandPoints = [[-3,0,0],[-2,1.25,0],[-1,1.5,0],[0,2,0.25],[1,2,0],[0.5,1,-0.25], [-0.5,1,0.25],[-1,2,0],[0,2,-0.25],[1,1.5,0],[2,1.25,0],[3,0,0]];
let knotPoints = [[-3,0,0],[-2,1.25,0],[-1,1.5,0],[0,2,0.25],[1,2,0],[0.5,1,-0.25], [-0.5,1,0.25],[-1,2,0],[0,2,-0.25],[1,1.5,0],[2,1.25,0],[3,0,0]]; //same as overhandPoints

let knotSpline, knotEndPoints, bonkEffect, knotGripPoint;

function setup(){
	three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    presentation = new EXP.UndoCapableDirector();
    

	three.camera.position.z = 4;
	three.camera.position.y = 3;

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



    knotEndPoints = new EXP.Array({data: [knotPoints[0],knotPoints[knotPoints.length-1]]});
    knotEndPoints.add(new EXP.PointOutput({color: 0x333333, width: 0.2}));


    knotGripPoint = new EXP.Array({data: [knotPoints[4]]});
    knotGripPoint.add(new EXP.PointOutput({color: 0x333333, width: 0.1, opacity:0}));



    let knotPointsDebug = new EXP.Array({data: knotPoints});
    //knotPointsDebug.add(new EXP.PointOutput({color: 0x333333, width: 0.1}));

    knotSpline = new EXP.Area({bounds: [[0,1]], numItems: 100});
    knotSpline
    .add(new EXP.Transformation({expr: (i,t,x) => getCatRomSpline(x, knotPoints)}))
    .add(new EXP.LineOutput({color: coordinateLine4ZeroColor, width: 5}));

    //to get the classic "line over/under" effect, I give these lines a white outline behind them
    knotSpline.children[0].add(new EXP.Transformation({expr: (i,t,x,y,z) => {
        let cameraDirection = new THREE.Vector3(x,y,z).sub(three.camera.position).normalize(); //move away from camera
        return [x+cameraDirection.x* 0.05, y+cameraDirection.y* 0.05,z+cameraDirection.z * 0.05];
    }}))
    .add(new EXP.LineOutput({color: 0xffffff, width: 30}));

    


    /* cool stagger effect
    bonkEffectLine = new EXP.Array({data: [[1,0,0],[1,0,0]]});
    bonkEffectLine.add(new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z]}))
    .add(new EXP.LineOutput({color: blue, width: 5}));*/

    bonkEffect = new THREE.Mesh(new THREE.RingGeometry(0.4,0.5,32),new THREE.MeshBasicMaterial({color: blue, opacity: 0.0, transparent: true}));
    three.scene.add(bonkEffect);



    objects = [knotEndPoints, knotSpline,knotPointsDebug,knotGripPoint];

    console.log("Loaded.");
}

async function animate(){

    let canvasContainer = document.getElementById('canvasContainer');

    //twoDCanvasHandler.cartesianOpacity = 0;
    await presentation.begin();

    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    //show overhand knot
    await presentation.nextSlide();

    //show that if the ends are fixed, we can always undo the knot

    //slide loop along
    var l = knotPoints.length-1;
    for(let i=2; i<knotPoints.length-3;i++){
        if(i==4)continue;
        let knotPointSlidAlongLength = EXP.Math.vectorAdd(knotPoints[i],[4,-3,0]);
        knotPointSlidAlongLength[2] *= 3;
        presentation.TransitionTo(knotPoints[i], knotPointSlidAlongLength, 2000);
    }
    //compress points near the right end
    for(let i=l-2; i<knotPoints.length;i++){
        presentation.TransitionTo(knotPoints[i], knotPoints[l], 1000);
    }
    presentation.TransitionTo(knotPoints[1], [1,0,0], 2000);
    presentation.TransitionTo(knotPoints[4], EXP.Math.vectorAdd(knotPoints[3],[5,-2,0.5]), 2000);
    await presentation.delay(2000);

    //now send each point to a straight line
    var l = knotPoints.length-1;
    for(let i=1; i<knotPoints.length-3;i++){
        presentation.TransitionTo(knotPoints[i], [(i/l)*4-2,0,0], 2000);
    }

    await presentation.nextSlide();
    await presentation.nextSlide();


    //go back to the overhand knot
    presentation.TransitionTo(knotSpline.children[0].children[0], {opacity:0}, 500);
    await presentation.delay(500);
    for(let i=0; i<knotPoints.length;i++){
        presentation.TransitionTo(knotPoints[i], overhandPoints[i], 200);
    }
    await presentation.delay(300);
    presentation.TransitionTo(knotSpline.children[0].children[0], {opacity:1}, 500);


    await presentation.delay(1000);


    let joinPoint = [0,-1,0];
    presentation.TransitionTo(knotPoints[0], joinPoint, 1000);
    presentation.TransitionTo(knotPoints[knotPoints.length-1], joinPoint, 1000);
    presentation.TransitionTo(knotPoints[1], EXP.Math.vectorAdd(joinPoint,[-1.5,0.25,0]), 1000);
    presentation.TransitionTo(knotPoints[knotPoints.length-2], EXP.Math.vectorAdd(joinPoint,[1.5,0.25,0]), 1000);


    //also make the line closed    
    presentation.TransitionTo(knotSpline.children[0], {'expr': (i,t,x) => getCatRomSpline(x, knotPoints, closed=false, endTangentsAsIfClosed=true)}, 1000);
    await presentation.nextSlide();

    //Zoom in on the bonk point
    let bonkPoint = [1,1.5,0];
    presentation.TransitionTo(three.camera.position, {x:0,y:2,z:2}, 1000); //zoom in a bit. TODO: buggy
    presentation.TransitionTo(controls.target, {x:bonkPoint[0],y:bonkPoint[1],z:bonkPoint[2]}, 750, {easing:EXP.Easing.EaseIn});

    presentation.TransitionTo(knotGripPoint.children[0], {opacity: 1.0},1000);

    await presentation.nextSlide();
    
    //it's bonking time!
    //anticipation...
    presentation.TransitionTo(knotPoints[4], EXP.Math.vectorAdd(bonkPoint,[0,0.75,0]), 500);
    await presentation.delay(750);
    //go in for the kill
    presentation.TransitionTo(knotPoints[4], bonkPoint, 750, {easing:EXP.Easing.EaseIn});
    await presentation.delay(751);

    //bounce off!
    presentation.TransitionTo(knotPoints[4], [1,2,0], 750, {easing:EXP.Easing.EaseOut});

    //show bonk effect
    bonkEffect.position.set(...bonkPoint);
    bonkEffect.scale.setScalar(1.0);
    bonkEffect.material.opacity = 0.0;
    presentation.TransitionTo(bonkEffect.material, {'opacity':1.0},200, {easing: EXP.Easing.EaseIn});
    presentation.TransitionTo(bonkEffect.scale, {x:1.3,y:1.3,z:1.3},1000, {easing: EXP.Easing.EaseOut});
    await presentation.delay(200);
    //fade out bonk effect after a bit
    presentation.TransitionTo(bonkEffect.material, {'opacity':0.0},500, {easing: EXP.Easing.EaseOut});

    //todo: make bonk effect better. Star particles? the word "bonk"?


    await presentation.nextSlide();
    //show coordinates for both points

    await presentation.nextSlide();
    //replay bonk


}

window.addEventListener("load",function(){
    setup();
    animate();
});
