let three, controls, objects, knotParams;

let userPointParams = {x1:Math.PI/2,x2:0,factors:['linear','linear']};

let presentation = null;



let overhandPoints = [[-3,0,0],[-2,1.25,0],[-1,1.5,0],[0,2,0.25],[1,2,0],[0.5,1,-0.25], [-0.5,1,0.25],[-1,2,0],[0,2,-0.25],[1,1.5,0],[2,1.25,0],[3,0,0]];
let knotPoints = [[-3,0,0],[-2,1.25,0],[-1,1.5,0],[0,2,0.25],[1,2,0],[0.5,1,-0.25], [-0.5,1,0.25],[-1,2,0],[0,2,-0.25],[1,1.5,0],[2,1.25,0],[3,0,0]]; //same as overhandPoints

let knotSpline, knotEndPoints;

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



    let knotPointsDebug = new EXP.Array({data: knotPoints});
    knotPointsDebug.add(new EXP.PointOutput({color: 0x333333, width: 0.1}));

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




    objects = [knotEndPoints, knotSpline,knotPointsDebug];

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
        presentation.TransitionTo(knotPoints[i], {'0':knotPoints[i][0]+4,'1':knotPoints[i][1]-3,'2':knotPoints[i][2]*2}, 2000);
    }
    //compress points near the right end
    for(let i=l-2; i<knotPoints.length;i++){
        presentation.TransitionTo(knotPoints[i], {'0':knotPoints[l][0],'1':knotPoints[l][1],'2':knotPoints[l][2]}, 1000);
    }
    await presentation.delay(2000);

var l = knotPoints.length-1;
for(let i=1; i<knotPoints.length-3;i++){
    presentation.TransitionTo(knotPoints[i], {'0':(i/l)*4-2,'1':0,'2':0}, 2000);
}

    await presentation.nextSlide();
    await presentation.nextSlide();

    for(let i=0; i<knotPoints.length;i++){
        presentation.TransitionTo(knotPoints[i], {'0':overhandPoints[i][0],'1':overhandPoints[i][1],'2':overhandPoints[i][2]}, 1000);
    }
    await presentation.delay(1500);


    let joinPoint = [0,-1,0];
    presentation.TransitionTo(knotPoints[0], {'0':joinPoint[0],'1':joinPoint[1],'2':joinPoint[2]}, 1000);
    presentation.TransitionTo(knotPoints[knotPoints.length-1], {'0':joinPoint[0],'1':joinPoint[1],'2':joinPoint[2]}, 1000);


    presentation.TransitionTo(knotPoints[1], {'0':joinPoint[0] - 1.5,'1':joinPoint[1]+0.25,'2':joinPoint[2]}, 1000);
    presentation.TransitionTo(knotPoints[knotPoints.length-2], {'0':joinPoint[0] + 1.5,'1':joinPoint[1]+0.25,'2':joinPoint[2]}, 1000);


    //also make the line closed    
    presentation.TransitionTo(knotSpline.children[0], {'expr': (i,t,x) => getCatRomSpline(x, knotPoints, closed=false, endTangentsAsIfClosed=true)}, 1000);
        

    //original
    //presentation.TransitionTo(knotPoints[4], {'0':1,'1':2,'2':0}, 750);


    await presentation.nextSlide();
    //zoom in on that crossing
    let bonkPoint = [0,1.5,0];
    presentation.TransitionTo(knotPoints[4], {'0':bonkPoint[0],'1':bonkPoint[1],'2':bonkPoint[2]}, 750);
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    //"Let's focus on this crossing."
    // arrow?

    await presentation.nextSlide();
    presentation.TransitionTo(knotPoints[4], {'0':0.5,'1':1.75,'2':0}, 750);

    /*

    NEXT STEPS
    - some sort of TransitionTo numeric array thing
    if it's a 1D array, pad them both to max(start.length, end.length)
    fill those with zeroes
    transition between each number

    - have some storage on the thing being called so that one animation knows if it's interrupting another
        - in other words, clean blending
        - use a Symbol? object[symbol] = thisAnimation; then check object[symbol] for the current animation, update this animation's prev value to that animation's post value,
    
    - some way to set line color
        - TransitionTo has a color feature? no
        - LineOutput.color = function(i,t,xyz)? no, because I want to set it via time
        - feels like I need some kind of render path thing because, you know, maybe I don't want to set it solely based on x,y,z. I'd want to set it pre-something
        - ArrayOutput and connect it to the .color thing?
    
    - Transformation but with a position and scale thing which just does input*scale + position?
    
    - add some way of looping things
        - presentation.loopThis(()=>{
              presentation.TransitionTo(blah, {'blah':1});
              await presentation.delay(1000);
              presentation.TransitionTo(blah, {'blah':0});
              await presentation.delay(1000);=
          });
        //I guess you can't use .nextSlide() in there, and you'd need to implement the undo (just skip right past it? Make the LoopThis() store its own undo cache?)    
        loopThis? loopTillNextSlide?
        mathbox made it per-object: loopThis(object, ...)
    */

    /*
    presentation.TransitionTo(sphereOutput, {'opacity':0}, 750);
    await presentation.delay(750);
    */

    //Show the 2D canvas. Animation is done in CSS with a time of 1500 ms 
    await presentation.delay(1500);


}

/*
let centerCameraOnPointEnabled = true;
let cameraPosIntermediary = new THREE.Vector3();
let cameraLookTarget = new THREE.Vector3();
function centerCamera(time){
    //center the camera so it gives a view of the normal.
    //a bit nauseating though...
    let cameraTarget = new THREE.Vector3(...sphereParametrization(0,0,userPointParams.x1,userPointParams.x2));

    if(userPointParams.x1 < 0.7){
        cameraTarget.set(0,1.3,0);
    }

    if(userPointParams.x1 > Math.PI - 0.7){
        cameraTarget.set(0,-1.3,0);
    }

    let cameraPosTarget = cameraTarget.clone().multiplyScalar(2);

    if(centerCameraOnPointEnabled){
        cameraPosIntermediary.lerp(cameraPosTarget, 3.1*time.delta);
        three.camera.position.lerp(cameraPosIntermediary, 3*time.delta);
        cameraLookTarget.lerp(cameraTarget, 3.1*time.delta);
        three.camera.lookAt(cameraLookTarget);
    }
}*/


window.addEventListener("load",function(){
    setup();
    animate();
});
