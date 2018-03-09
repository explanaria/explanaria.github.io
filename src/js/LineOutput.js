var EXP = EXP || {};

EXP.LineOutput = class LineOutput{
	constructor(options = {}){
		/*input: Transformation
			width: number
		*/

		this._width = options.width !== undefined ? options.width : 5;
		this._opacity = options.opacity !== undefined ? options.opacity : 1; //trigger transparency if needed
		this._color = options.color !== undefined ? options.color : 0x55aa55;


		this.points = [];

		this.numCallsPerActivation = 0; //should always be equal to this.points.length
		this.itemDimensions = []; // how many times to be called in each direction

		this.parent = null;


		this._geometry = new THREE.BufferGeometry();
		this._vertices;
		this._outputDimensions = 3; //how many dimensions per point to store?
		this.makeGeometry();

		this.material = new THREE.LineBasicMaterial({color: this._color, linewidth: this._width,opacity:this._opacity});
		this.mesh = new THREE.LineSegments(this._geometry,this.material);

		three.scene.add(this.mesh);
	}
	makeGeometry(){
		// follow http://blog.cjgammon.com/threejs-geometry
		// or mathbox's lineGeometry

		let numVertices = 3;

		/*
		This code seems to be necessary to render lines as a triangle strp.
		I can't seem to get it to work properly.

		var indices = [];

		//indices
		let base = 0;
		for(var k=0;k<numVertices-1;k+=1){
        	indices.push( base, base+1, base+2);
			indices.push( base+2, base+1, base+3);
			base += 2;
		}
		this._geometry.setIndex( indices );*/

		let MAX_POINTS = 1000;

		this._vertices = new Float32Array(MAX_POINTS * 2 * this._outputDimensions);

		// build geometry

		this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
		//this._geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
		//this.geometry.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

		this._currentPointIndex = 0; //used during updates as a pointer to the buffer

	}
	_onAdd(){ //should be called when this is .add()ed to something

		//climb up parent hierarchy to find the Area
		let root = this;
		while(root.parent !== null){
			root = root.parent;
		}

		this.numCallsPerActivation = root.numCallsPerActivation;
		this.itemDimensions = root.itemDimensions;

		// perhaps instead of generating a whole new array, this can reuse the old one?
		let vertices = new Float32Array(this.numCallsPerActivation * this._outputDimensions);

		let positionAttribute = this._geometry.attributes.position;
		positionAttribute.count = this.numCallsPerActivation*2;

		positionAttribute.array = this._vertices;
		this.vertices = vertices;
		positionAttribute.needsUpdate = true;
	}
	evaluateSelf(i, t, x, y, z){
		//it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.

		//assert i < vertices.count

		let index = this._currentPointIndex*this._outputDimensions;

		if(x !== undefined)this._vertices[index] = x;
		if(y !== undefined)this._vertices[index+1] = y;
		if(z !== undefined)this._vertices[index+2] = z;

		this._currentPointIndex++;

		/* we're drawing like this:
		*----*----*

        *----*----*
	
		but we don't want to insert a diagonal line anywhere. This handles that:  */

		let firstCoordinate = i % this.itemDimensions[this.itemDimensions.length-1];

		if(!(firstCoordinate == 0 || firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1)){
			if(x !== undefined)this._vertices[index+this._outputDimensions] = x;
			if(y !== undefined)this._vertices[index+this._outputDimensions+1] = y;
			if(z !== undefined)this._vertices[index+this._outputDimensions+2] = z;
			this._currentPointIndex++;
		}

		//vertices should really be an uniform, though.
	}
	onAfterActivation(){
		let positionAttribute = this._geometry.attributes.position;
		positionAttribute.needsUpdate = true;
		this._currentPointIndex = 0; //reset after each update
	}
	set color(color){
		//currently only a single color is supported.
		//I should really
		this._color = color;
		this.mesh.material.color.copy(color); //assumed color is a THREE.Width
	}
	get color(){
		return this._color;
	}
	set opacity(opacity){
		let mat = this.mesh.material;
		mat.opacity = opacity;
		mat.transparent = opacity < 1;
		this._opacity = opacity;
	}
	get opacity(){
		return this._opacity;
	}
	set width(width){
		this._width = width;
		this.mesh.material.linewidth = width;
	}
	get width(){
		return this._width;
	}
}


