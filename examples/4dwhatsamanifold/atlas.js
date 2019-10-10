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


        this.textureLoader = new THREE.TextureLoader();
        this.decalDiffuse = this.textureLoader.load('decal-diffuse.png'); //this texture doesn't seem to load locally?
        this.decalNormal = this.textureLoader.load('decal-normal.jpg');
1
        this.decalMaterial = new THREE.MeshBasicMaterial({
	        specular: 0x444444,
	        //map: this.decalDiffuse, 
	        normalMap: this.decalNormal,
	        normalScale: new THREE.Vector2( 1, 1 ),
	        shininess: 30,
	        transparent: false,
	        depthTest: true,
	        depthWrite: false,
	        polygonOffset: true,
	        polygonOffsetFactor: - 4,
	        wireframe: false
        } );

        this.newChartSize = new THREE.Vector3(2,2,2);
    }
    activate(){
        //render all charts' 2D canvases and move the 3D ball.
        for(var i=0;i<this.charts.length;i++){
            this.charts[i].twoDslider.activate();
        }
        this.threeDPointMesh.position.copy(this.threeDPointPos); //
    }

    removeAllCharts(){
        this.charts.forEach( function ( d ) {
            three.scene.remove( d.mesh );
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
        material.color.setHex( this.color);


        this.sourcePosition = position;
        this.sourceOrientation = orientation;

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
        if(x != this.pointPos[0] || y != this.pointPos[1]){
            this.pointPos = [x,y];
            this.updateAtlas3DPointFrom2DCoords(x,y);
        }
    }
    updateAtlas3DPointFrom2DCoords(x,y){
        //Now, we must figure out the 3D location of the point
        
        //step 1: planar approximation. approximate the coordinate chart as a linear plane based on some data we saved when this chart was created. Then we'll project that approximation onto the mesh itself.
        planarApproximation.set(x,y,0);
		planarApproximation.applyMatrix4( this.projectorMatrix );

        planarApproximationInwardsNormal.set(x,y,1);
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
            this.twoDslider.values = this.twoDslider.lastValues;
            return
        }
           

        let intersectionData = intersections[0];
        let manifoldPoint = intersectionData.point;
	    let manifoldNormal = intersectionData.face.normal.clone();
	    manifoldNormal.transformDirection( meshBeingCoveredInCharts.matrixWorld );

        this.parentAtlas.updateAllOtherCharts(manifoldPoint,manifoldNormal);
    }

    updateDrawnPointLocation(uvCoords){
        if(this.twoDslider.dragging)return;
        this.pointPos[0] = (uvCoords.x - 0.5)*2; //change from 0-1 to -1-1.
        this.pointPos[1] = (uvCoords.y - 0.5)*2;
    }
    hideDraggables(){
        this.twoDslider.showDraggables = false;
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
        container.className = "tile";
        container.appendChild(this.canvas);
        document.getElementById(containerID).appendChild(container);
    }
}
/*
function uvToPosition(chartMesh, uvs){

    let chartUVs = chartMesh.geometry.attributes['uv']


}*/
