window.addEventListener("load",function(){
    setup();
    animate();
})

let trianglePoints = [[0,0],[1,0],[1,1]];

function computeTriangleArea(){
    
}

function isDistanceInteger(point1, point2){
        let distanceSquared = (point1[0]-point2[0])(point1[0]-point2[0]) + (point1[0]-point2[0])*(point1[0]-point2[0])
        if(distanceSquared % 1 == 0){ //if distance squared is an integer
            return true;
        }
        return false;
}

function areAllSideLengthsIntegers(){
    pairs = [
        [ trianglePoints[0], trianglePoints[1]],

        [ trianglePoints[0], trianglePoints[1]]

        [ trianglePoints[0], trianglePoints[1]]
    ]
    let allSidesIntegers = true;
    for(var pair in pairs){
        let point1 = pair[0];
        let point2 = pair[1];
        if (!isDistanceInteger(point1, point2)){
            allSidesIntegers = false;
        }
    }
    return allSidesIntegers;
}


//y^2 = x^3 + -2x + 1

let sceneObjects = []
function setup(){
    var three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
    var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    three.camera.position.set(5,5,10);
    three.camera.lookAt(new THREE.Vector3(5,5,0));


    let integerGrid = new EXP.Area({bounds: [[0,9],[0,9]], numItems: 10});
    integerGrid.add(new EXP.PointOutput({width: 0.1}));

    let triangleLine = new EXP.Array({data: [0,1,2,0]});
    triangleLine.add(new EXP.Transformation({'expr':(i,t,index) => trianglePoints[index]})).add(new EXP.LineOutput({}));


    sceneObjects = [integerGrid, triangleLine]; 
    three.on("update",function(time){
	    sceneObjects.forEach(i => i.activate(time.t));
    });
    console.log("Loaded.");
}

async function animate(){
	//
	await EXP.delay(3000);
	//animate a fancy wiggle
	//EXP.TransitionTo(pt3output,{opacity:1, width:0.6},400);
	await EXP.delay(400);

}
window.addEventListener("load",function(){
    setup();
    animate();
})
