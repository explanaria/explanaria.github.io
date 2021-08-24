//Code to handle where on the xy plane the mouse is pointing to.

const raycaster = new THREE.Raycaster();
let planeWidth = 50;
let perpendicularRectangle = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth,planeWidth), new THREE.MeshBasicMaterial({color: 0x00ff00})); //A plane at z=0, perpendicular to the default camera. The Raycaster will try to intersect this plane. This also means if the camera pans beyond the plane, there will be no intersections and mouse movement will silently fail :(

const spareVec2 = new THREE.Vector2();
function raycastMouseTo2D(three, callback, canvasX, canvasY){
        //do the heavy lifting to find where on a 2D plane user clicked

        //computing the canvas width and height is hard.
        //we can use three.renderer.domElement.clientWidth, but that hits the DOM multiple times every frame and causes a slow repaint
        three.renderer.getSize(spareVec2);
        let canvasWidth = spareVec2.x; 
        let canvasHeight = spareVec2.y;
        
        //todo: account for devicePixelRatio changing

        let twodX = ( canvasX * window.devicePixelRatio / canvasHeight) * 2 - 1; //-1 to 1
        let twodY = 1 - ( canvasY * window.devicePixelRatio / canvasHeight) * 2; //-1 to 1 but reversed

        raycaster.setFromCamera( new THREE.Vector2(twodX, twodY), three.camera );
        let intersections = raycaster.intersectObject( perpendicularRectangle );
        if(intersections.length > 0){
            //we hit the rectangle
            let { distance, point, face, faceIndex, object } = intersections[0];
            callback(point);
        }
}

function findThreejsMousePoint(three, callback, eventType="mousedown", isTouchEvent=false){
    //callback is a function(worldSpacePoint)
    //helper function which sets up an event listener, then calculates the mouse position in 3D space from 2D
    //Usage: findThreejsMousePoint(three, function(threeDMouseCoords){ 
    //    someThreeDmouseCursor.position = threeDMouseCoords;
    //}, "mousedown")

    //drag move
    three.renderer.domElement.addEventListener(eventType, (event) => {
        event.preventDefault();

        let clientMousePositionX = 0;
        let clientMousePositionY = 0;

        if(!isTouchEvent){
            raycastMouseTo2D(three, callback, event.offsetX, event.offsetY);
        }else{
            let rect = three.renderer.domElement.getBoundingClientRect();
            for(var i=0;i<event.changedTouches.length;i++){
                let touch = event.changedTouches[i];
                raycastMouseTo2D(three, callback, touch.clientX - rect.left, touch.clientY - rect.top);
            }
        }
    }, false)
}


//todo: touchmove support
function onThreejsMousedown(three, callback){
    findThreejsMousePoint(three, callback, "mousedown")
    findThreejsMousePoint(three, callback, "touchstart", true)
}
function onThreejsMouseup(three, callback){
    findThreejsMousePoint(three, callback, "mouseup");
    findThreejsMousePoint(three, callback, "touchend", true);
}
function onThreejsMousemove(three, callback){
    findThreejsMousePoint(three, callback, "mousemove");
    findThreejsMousePoint(three, callback, "touchmove", true);
}


export {onThreejsMousedown, onThreejsMousemove, onThreejsMouseup}

