class Atlas{
    constructor(meshBeingCoveredInCharts, pointColor){
        this.meshBeingCoveredInCharts = meshBeingCoveredInCharts;

        this.charts = [];

        this.raycaster = new THREE.Raycaster();

        this.threeDPointPos = new THREE.Vector3();
        this.threeDPointNormal = new THREE.Vector3(0,0,1);

        this.threeDPointRotationHelper = new THREE.Object3D(); //used when making new charts

        this.threeDPointMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), new THREE.MeshBasicMaterial({color: 0xFFA500})); //the mesh representing the 3D point
        three.scene.add(this.threeDPointMesh);
1
        this.decalMaterial = new THREE.MeshLambertMaterial({
	        specular: 0x444444,
	        shininess: 0.3,
	        normalScale: new THREE.Vector2( 0.5, 0.5 ),
	        transparent: false,
	        depthTest: true,
	        depthWrite: true,
	        polygonOffset: true,
	        polygonOffsetFactor: - 4,
	        wireframe: false
        } );

        let size = 1.8;
        this.newChartSize = new THREE.Vector3(size,size,size);
    }
    activate(){
        //render all charts' 2D canvases and move the 3D ball.
        for(var i=0;i<this.charts.length;i++){
            this.charts[i].twoDslider.activate();
        }
        this.threeDPointMesh.position.copy(this.threeDPointPos); //
    }

    removeAllCharts(){
        this.charts.forEach( function ( c ) {
            three.scene.remove( c.mesh );
            let canvas = c.twoDslider.canvas;
            let canvasContainer = canvas.parentElement;
            canvasContainer.removeChild(canvas);
            canvasContainer.parentElement.removeChild(canvasContainer);
        } );
        this.charts = [];
    }

    addChartCenteredAtCurrentPosition(){
        this.threeDPointRotationHelper.lookAt(this.threeDPointNormal)

        let chart = new CoordinateChart2D(this, this.threeDPointPos, this.threeDPointRotationHelper.rotation);
        this.addChart(chart);
    }

    addChart(chart){
        this.charts.push(chart);
        three.scene.add(chart.mesh);
    }
    updateAllOtherCharts(nearestManifoldPoint, normalDirection){
        //after our 3D point is set, 
        //make all charts compute whether to draw their 2D points properly.

        //change displayed point position
        this.threeDPointPos.copy(nearestManifoldPoint);
        this.threeDPointNormal.copy(normalDirection);

        nearestManifoldPoint.addScaledVector(normalDirection, 0.25); //step back slightly to better hit the manifold.

	    this.raycaster.set( nearestManifoldPoint, normalDirection.multiplyScalar(-1));



        //see what charts intersect the point here.
        //this is O(n) right now, it could be improved with like an octree or a distance calculation
        for(var i=0;i<this.charts.length;i++){

	        var intersections = this.raycaster.intersectObject( this.charts[i].mesh );
            if(intersections.length == 0){
                this.charts[i].hideDraggables();
                continue;
            }{
                this.charts[i].showDraggables();
            }

            let intersectionData = intersections[0];

            let p = intersectionData.point;
            let uvCoords = intersectionData.uv;
		    //intersectionData.object.material.map.transformUv( uv ); //needed if offset or repeat used in the UV map

            this.charts[i].updateDrawnPointLocation(uvCoords);
        }
    }
}

//store vector3s up here for reuse, so we don't create a new object every frame
let planarApproximation = new THREE.Vector3();
let planarApproximationInwardsNormal = new THREE.Vector3();

class CoordinateChart2D{
    //a class to represent a coordinate chart.
    //it consists of BOTH a 3D mesh and a 2D canvas representing the coordinates.
    //

    constructor(parentAtlas, position, orientation){
        this.parentAtlas = parentAtlas;
        this.pointPos = [0,0];

        this.parentDOMElementID = "chartCanvases";

        //create the 3D Decal
        //give the decal a random color
        var material = this.parentAtlas.decalMaterial.clone();
        this.color = Math.random() * 0xffffff;
        this.colorString =  '#' + ('00000' + (this.color | 0).toString(16)).substr(-6);
        material.polygonOffsetFactor = -4-this.parentAtlas.charts.length;
        material.color.setHex( this.color);


        this.sourcePosition = position;
        this.sourceOrientation = orientation;

        this.xSpan = parentAtlas.newChartSize.x/2;
        this.ySpan = parentAtlas.newChartSize.y/2;

        //matrix to project UV corodinates (0-1) to world coordinates
	    this.projectorMatrix = new THREE.Matrix4();
	    this.projectorMatrix.makeRotationFromEuler( orientation );
	    this.projectorMatrix.setPosition( position );

        this.mesh = new THREE.Mesh( new DecalGeometry( this.parentAtlas.meshBeingCoveredInCharts, this.sourcePosition, this.sourceOrientation, this.parentAtlas.newChartSize ), material);


            //make new dom element           
        this.twoDslider = new PlaneSliderWithANewCanvas(
            this.colorString, 
            this.parentDOMElementID, 
            () => this.pointPos, 
            (x,y) => {this.onSliderTick(x,y)}
        )
        this.twoDslider.activate();
    }
    onSliderTick(x,y){
        //called every frame.

        //but we only want to do something when the value changes
        if(x != this.twoDslider.lastValues[0] || y != this.twoDslider.lastValues[1]){
            this.pointPos = [x,y];
            this.updateAtlas3DPointFrom2DCoords(x,y);
        }
    }
    updateAtlas3DPointFrom2DCoords(x,y){
        //Now, we must figure out the 3D location of the point
        
        //step 1: planar approximation. approximate the coordinate chart as a linear plane based on some data we saved when this chart was created. Then we'll project that approximation onto the mesh itself.

        //keep in mind the -y is because a canvas's +y direction is down, but we want it to be up.
        planarApproximation.set(x*this.xSpan,-y*this.ySpan,0);
		planarApproximation.applyMatrix4( this.projectorMatrix );

        planarApproximationInwardsNormal.set(x,-y,1);
        planarApproximationInwardsNormal.applyMatrix4( this.projectorMatrix );
        planarApproximationInwardsNormal.sub(planarApproximation).multiplyScalar(-1); //sure there's a better linalg way of getting this normal direction right from the coefficients of the matrix itself. but I'm lazy and spent 3 hours debugging this code and I think this is good enough.

        //step 2: using the linear approximation, raycast this onto the meshBeingCoveredInCharts to find the true 3D point.
        //we can borrow the raycaster from our parent atlas; they're not using it right now

        
        //want to visualize it?
        //this.parentAtlas.threeDPointPos.copy(planarApproximation);
        //this.debugPoint.position.copy(planarApproximation).add(planarApproximationInwardsNormal)

        let raycaster = this.parentAtlas.raycaster;
        raycaster.set(
            planarApproximation.addScaledVector(planarApproximationInwardsNormal,-0.1), //move outwards a little bit along the normal to avoid missing the mesh. THIS DOES MUTATE planarApproximation! But it's OK since we don't use it afterwards.
            planarApproximationInwardsNormal
        );


        var intersections = raycaster.intersectObject( this.parentAtlas.meshBeingCoveredInCharts );
        if(intersections.length == 0){
             //oops. guess the coordinate chart doesn't cover this part. guess the linear approximation will have to do. no updates. should really raise an error I guess

            //this.twoDslider.disallowMovementIntoThisSpot();

            //show an 'x' over the mouse
            this.twoDslider.invalidCrossPos = [x,y];
            this.twoDslider.values = this.twoDslider.lastValues; //keep the point in place
            this.twoDslider.showInvalidCross = true;
            return
        }
        this.twoDslider.showInvalidCross = false;
           
        let intersectionData = intersections[0];
        let manifoldPoint = intersectionData.point;
	    let manifoldNormal = intersectionData.face.normal.clone();
	    manifoldNormal.transformDirection( meshBeingCoveredInCharts.matrixWorld );

        this.parentAtlas.updateAllOtherCharts(manifoldPoint,manifoldNormal);
    }

    updateDrawnPointLocation(uvCoords){
        if(this.twoDslider.dragging)return;
        this.pointPos[0] = (uvCoords.x - 0.5)*2; //change from 0-1 to -1-1.
        this.pointPos[1] = ((1-uvCoords.y) - 0.5)*2; //the 1-y is because a 3D chart's +Y is up, but a canvas's +y is down.
        
        this.twoDslider.showInvalidCross = false;
    }
    hideDraggables(){
        this.twoDslider.showDraggables = false;
        this.twoDslider.showInvalidCross = false;
    }
    showDraggables(){
        this.twoDslider.showDraggables = true;
    }
    //projecting the 3D manifold point to 2d local coordinates is done via raycasting in Atlas.updateAllOtherCharts()
}


class PlaneSliderWithANewCanvas extends PlaneSlider{
    constructor(color, containerID, valueGetter, valueSetter){
        super(color, containerID, valueGetter, valueSetter);

        this.maxDraggableRadius = 0.9;
    }

    setupCanvas(containerID){
        //make a new canvas
        this.canvas = document.createElement("canvas");

        let container = document.createElement("div")
        container.className = "chart";
        container.appendChild(this.canvas);
        document.getElementById(containerID).appendChild(container);
    }
}
/*
function uvToPosition(chartMesh, uvs){

    let chartUVs = chartMesh.geometry.attributes['uv']


}*/
