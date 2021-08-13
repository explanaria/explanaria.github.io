import {onThreejsMousedown, onThreejsMousemove, onThreejsMouseup} from "./1-mouseinteraction.js";
import {areAllSideLengthsIntegers, computeTriangleArea} from "./1-computedTriangleProperties.js";
import {Dynamic3DText} from "./1-katex-labels.js";

function vecScale(vec1, scaleFactor){
    //move to EXP.Utils soon
    let addedVec = [];
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec1));
    for(let i=0;i<vec1.length;i++){
        addedVec.push(vec1[i]*scaleFactor)
    }
    return addedVec;
}

function isInteger(num){
    return num % 1 == 0;
}

function vecAdd(vec1, vec2){
    //move to EXP.Utils soon
    let addedVec = [];
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec1));
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec2));
    for(let i=0;i<vec1.length;i++){
        addedVec.push(vec1[i]+vec2[i])
    }
    return addedVec;
}



function distSquared(vec1, vec2){
    //move to EXP.Utils soon
    let sum = 0;
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec1));
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec2));
    for(let i=0;i<vec1.length;i++){
        sum += (vec1[i]-vec2[i])*(vec1[i]-vec2[i])
    }
    return sum;
}
function dist(vec1, vec2){
    return Math.sqrt(distSquared(vec1, vec2))
}

window.trianglePoints = [[2,2],[5,2],[5,6]]; //3-4-5 triangle with lower left edge at (2,2)


const validIntegerColor = "green";
const invalidIntegerColor = "maroon";


function roundToIntegerIfClose(n){
    let closestInteger = Math.round(n)
    let distanceToInteger = Math.abs(n - closestInteger);
    if(distanceToInteger < 0.2){
        return closestInteger
    }
    return n;
}

//y^2 = x^3 + -2x + 1

let sceneObjects = []
function setup(){
    window.three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
    //window.twoD = setup2DCanvas();
    //var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    three.camera.position.set(5,5,8);
    three.camera.lookAt(new THREE.Vector3(5,5,0))

    three.camera.position.z *= 5;
    three.camera.zoom *= 5; //remove distortion from FOV


    three.camera.updateProjectionMatrix();


    let integerGrid = new EXP.Area({bounds: [[-10,19],[-10,19]], numItems: 30});
    integerGrid.add(new EXP.PointOutput({width: 0.2})); //green grid

    let triangleLine = new EXP.Array({data: [0,1,2,0]});
    let getTrianglePoints = triangleLine.add(new EXP.Transformation({'expr':(i,t,index) => trianglePoints[index]}))
    getTrianglePoints.add(new EXP.LineOutput({})); //line between the triangles

    let grabbablePointSize = 0.5;
    window.trianglePointsDrawn = new EXP.PointOutput({color: 0xff0000, width: grabbablePointSize})
    getTrianglePoints.add(trianglePointsDrawn);


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
            trianglePoints[grabbedPointIndex][1] = worldPoint.y;

            //snap to an integer grid point if it's close
            let roundedX = Math.round(worldPoint.x)
            let roundedY = Math.round(worldPoint.y)
            let distToGridSquared = distSquared([worldPoint.x, worldPoint.y], [roundedX, roundedY]);
            if(distToGridSquared < 0.15){
                trianglePoints[grabbedPointIndex][0] = roundedX;
                trianglePoints[grabbedPointIndex][1] = roundedY;
            }
        }
    })
    //snap to grid
    onThreejsMouseup(three, function(worldPoint){
        if(grabbedPointIndex != null){
            trianglePoints[grabbedPointIndex][0] = Math.round(worldPoint.x);
            trianglePoints[grabbedPointIndex][1] = Math.round(worldPoint.y);
            grabbedPointIndex = null;
        }
    })



    let areaText = new Dynamic3DText({
        text: (t) => computeTriangleArea(trianglePoints),
        color: (t) => isInteger(computeTriangleArea(trianglePoints)) ? validIntegerColor : invalidIntegerColor,
        position3D: (t) => vecScale(vecAdd(vecAdd(trianglePoints[0], trianglePoints[1]),trianglePoints[2]), 1/3), //midpoint
    })


    //Sides!

    function renderLengthHighlightingIrrationals(point1, point2){
        let distanceSquared = distSquared(point1, point2);
        let distance = Math.sqrt(distanceSquared);
        if(isInteger(distanceSquared)){
            //integer or sqrt(integer)
            if(isInteger(distance)){
                return distance;
            }else{
                return "\\sqrt{"+ parseInt(distanceSquared)+"}"; //rendered by katex
            }
        }else{
            //other real
            return distance.toFixed(2);
        }
    }

    function colorHighlightingIrrationals(point1, point2){
        let distanceSquared = distSquared(point1, point2);
        let distance = Math.sqrt(distanceSquared);
        if(distanceSquared % 1 == 0){
            if(distance % 1 == 0){ //integer
                return validIntegerColor;
            }else{ //sqrt(integer)
                return invalidIntegerColor;
            }
        }else{
            //other real
            return invalidIntegerColor;
        }
    }


    let side1Text = new Dynamic3DText({
        text: (t) => renderLengthHighlightingIrrationals(trianglePoints[0], trianglePoints[1]), 
        color: (t) => colorHighlightingIrrationals(trianglePoints[0], trianglePoints[1]),
        position3D: (t) => vecAdd(vecScale(vecAdd(trianglePoints[0], trianglePoints[1]),0.5), vecScale(trianglePoints[2], -0.0))
    })

    let side2Text = new Dynamic3DText({
        text: (t) => renderLengthHighlightingIrrationals(trianglePoints[1], trianglePoints[2]), 
        color: (t) => colorHighlightingIrrationals(trianglePoints[1], trianglePoints[2]),
        position3D: (t) => vecAdd(vecScale(vecAdd(trianglePoints[1], trianglePoints[2]),0.5), vecScale(trianglePoints[0], -0.0))
    })

    let side3Text = new Dynamic3DText({
        text: (t) => renderLengthHighlightingIrrationals(trianglePoints[0], trianglePoints[2]), 
        color: (t) => colorHighlightingIrrationals(trianglePoints[0], trianglePoints[2]),
        position3D: (t) => vecAdd(vecScale(vecAdd(trianglePoints[0], trianglePoints[2]),0.5), vecScale(trianglePoints[1], -0.0))
    })

    
    let staticSceneObjects = [integerGrid];
    sceneObjects = [triangleLine, areaText, side1Text, side2Text, side3Text]; 
    three.on("update",function(time){
	    sceneObjects.forEach(i => i.activate(time.t));
    });
    staticSceneObjects.forEach(i => i.activate(0));

    console.log("Loaded.");
}

async function animate(){
    let presentation = new EXP.UndoCapableDirector();
    await presentation.begin();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
	//await EXP.delay(3000);
	//EXP.TransitionTo(pt3output,{opacity:1, width:0.6},400);

}
window.addEventListener("load",function(){
    setup();
    animate();
})
