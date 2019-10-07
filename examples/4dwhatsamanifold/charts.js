class Atlas{
    constructor(meshBeingCoveredInCharts){
        this.meshBeingCoveredInCharts = meshBeingCoveredInCharts;
        this.charts = [];

        this.threeDPoint = new THREE.Vector3();


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

    removeAllCharts(){
        this.charts.forEach( function ( d ) {
            three.scene.remove( d.mesh );
        } );
        this.charts = [];

    }

    addChartCenteredAtPosition(position){

    }

    addChart(chart){
        this.charts.push(chart);
        three.scene.add(chart.mesh);
    }
    updateAllOtherCharts(){
        //after our 3D point is set, 
        //make all charts compute whether to draw their 2D points properly.

        let threeDPointPos = this.threeDPoint;
        //
        for(var i=0;i<this.charts.length;i++){
            this.charts[i].updateDrawnPointLocation(threeDPointPos);
        }
    }
}

class CoordinateChart2D{
    //a class to represent a coordinate chart.
    //it consists of BOTH a 3D mesh and a 2D canvas representing the coordinates.
    //

    constructor(parentAtlas, position, orientation){
        this.parentAtlas = parentAtlas;
        this.pointPos = [0,0];

        //create the 3D Decal
        //give the decal a random color
        var material = this.parentAtlas.decalMaterial.clone();
        material.color.setHex( Math.random() * 0xffffff );

        this.mesh = new THREE.Mesh( new DecalGeometry( this.parentAtlas.meshBeingCoveredInCharts, position, orientation, this.parentAtlas.newChartSize ), material);

        //aand save
    }

    onmousedown(){
        if(dist(this.pointPos[0], this.pointPos[1], mouseX, mouseY) < this.pointRadius){
            this.dragging = true;
        }
    }
    onmousemove(){
        //calc point on this chart
        //x = blah()
        //y = blah()

        this.pointPos = [x,y];
        let threeDPoint = this.uvTo3DCoords(this.pointPos);
        this.parentAtlas.threeDPoint = threeDPoint
        this.parentAtlas.updateAllOtherCharts();
    }
    onmouseup(){
        this.dragging = false;
    }
    uvTo3DCoords(pointPos){
        //convert the 2D point to the 3D position on the manifold.
        //todo
    }

    updateDrawnPointLocation(pointPos){
        //if the location of the 3D point is updated, figure out whether we need to draw a 2D point somewhere.
        if(this.dragging)return;
        //if(pointPos intersects our chart mesh){

        //}
        this.pointPos = this.projectPointOntoChart(pointPos);
    }

    projectPointOntoChart(pointPos){
        //convert the 3D pointPos to a 2D point on this chart.
        //compute using this.mesh

        //return [x,y];
        return [0,0];
    }
    containsPoint(newPointPos){
        //does this mesh contain the 3D point newPointPos?

        //return isIntersecting(newPointPos, this.mesh);
    }
    
}
