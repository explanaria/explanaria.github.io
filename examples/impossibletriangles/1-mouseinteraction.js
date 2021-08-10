//Code to handle where on the xy plane the mouse is pointing to.

const raycaster = new THREE.Raycaster();
let planeWidth = 50;
let perpendicularRectangle = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth,planeWidth), new THREE.MeshBasicMaterial({color: 0x00ff00})); //A plane at z=0, perpendicular to the default camera. The Raycaster will try to intersect this plane. This also means if the camera pans beyond the plane, there will be no intersections and mouse movement will silently fail :(

function findThreejsMousePoint(three, callback, eventType="mousedown"){
    //callback is a function(worldSpacePoint)
    //helper function which sets up an event listener, then calculates the mouse position in 3D space from 2D
    //Usage: findThreejsMousePoint(three, function(threeDMouseCoords){ 
    //    someThreeDmouseCursor.position = threeDMouseCoords;
    //}, "mousedown")

    //drag move
    let grabbedPoint = null;
    three.renderer.domElement.addEventListener(eventType, (event) => {
        let twodX = ( event.offsetX / three.renderer.domElement.width ) * 2 - 1; //-1 to 1
        let twodY = 1 - ( event.offsetY / three.renderer.domElement.height ) * 2; //-1 to 1 but reversed

        raycaster.setFromCamera( new THREE.Vector2(twodX, twodY), three.camera );
        let intersections = raycaster.intersectObject( perpendicularRectangle );
        if(intersections.length > 0){
            //we hit the rectangle
            let { distance, point, face, faceIndex, object } = intersections[0];
            callback(point);
        }
    })
}


//todo: touchmove support
function onThreejsMousedown(three, callback){
    findThreejsMousePoint(three, callback, "mousedown")
}
function onThreejsMouseup(three, callback){
    findThreejsMousePoint(three, callback, "mouseup");
}
function onThreejsMousemove(three, callback){
    findThreejsMousePoint(three, callback, "mousemove");
}

export {onThreejsMousedown, onThreejsMousemove, onThreejsMouseup}

