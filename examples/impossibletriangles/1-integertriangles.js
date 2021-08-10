import {onThreejsMousedown, onThreejsMousemove, onThreejsMouseup} from "./1-mouseinteraction.js";
import {areAllSideLengthsIntegers, computeTriangleArea} from "./1-computedTriangleProperties.js";

function dist(vec1, vec2){
    //move to EXP.Utils soon
    let sum = 0;
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec1));
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec2));
    for(let i=0;i<vec1.length;i++){
        sum += (vec1[i]-vec2[i])*(vec1[i]-vec2[i])
    }
    return Math.sqrt(sum);
}

window.trianglePoints = [[2,2],[1,0],[1,1]];


//y^2 = x^3 + -2x + 1

let sceneObjects = []
function setup(){
    window.three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
    //var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    three.camera.position.set(5,5,10);
    three.camera.lookAt(new THREE.Vector3(5,5,0));


    let integerGrid = new EXP.Area({bounds: [[0,9],[0,9]], numItems: 10});
    integerGrid.add(new EXP.PointOutput({width: 0.2})); //green grid

    let triangleLine = new EXP.Array({data: [0,1,2,0]});
    let getTrianglePoints = triangleLine.add(new EXP.Transformation({'expr':(i,t,index) => trianglePoints[index]}))
    getTrianglePoints.add(new EXP.LineOutput({})); //line between the triangles

    let grabbablePointSize = 0.5;
    window.trianglePointsDrawn = new EXP.PointOutput({color: 0xff0000, width: grabbablePointSize})
    getTrianglePoints.add(trianglePointsDrawn);

    
    sceneObjects = [integerGrid, triangleLine]; 
    three.on("update",function(time){
	    sceneObjects.forEach(i => i.activate(time.t));
    });



    //grab a point if you click on it
    let grabbedPointIndex = null;
    onThreejsMousedown(three, function(worldPoint){
        for(let i=0;i<3;i++){
            if(dist([worldPoint.x, worldPoint.y], trianglePoints[i]) < grabbablePointSize+0.1){ //todo: dist isn't'
                //grab that point
                grabbedPointIndex = i;
            }
        }
    })
    //move a dragged point
    onThreejsMousemove(three, function(worldPoint){
        if(grabbedPointIndex != null){
            trianglePoints[grabbedPointIndex][0] = worldPoint.x
            trianglePoints[grabbedPointIndex][1] = worldPoint.y
        }
        //mesh.position.copy(worldPoint);
    })
    //snap to grid
    onThreejsMouseup(three, function(worldPoint){
        if(grabbedPointIndex != null){
            trianglePoints[grabbedPointIndex][0] = parseInt(worldPoint.x+0.5);
            trianglePoints[grabbedPointIndex][1] = parseInt(worldPoint.y+0.5);
            grabbedPointIndex = null;
        }
    })
    console.log("Loaded.");
}

async function animate(){
	//await EXP.delay(3000);
	//EXP.TransitionTo(pt3output,{opacity:1, width:0.6},400);

}
window.addEventListener("load",function(){
    setup();
    animate();
})
