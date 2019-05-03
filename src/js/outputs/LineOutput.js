import {OutputNode} from '../Node.js';
import { threeEnvironment } from '../ThreeEnvironment.js';

class LineOutput extends OutputNode{
	constructor(options = {}){
		super();
		/* should be .add()ed to a Transformation to work
			options:
			{
				width: number
				opacity: number
				color: hex code or THREE.Color()
			}
		*/

		this._width = options.width !== undefined ? options.width : 5;
		this._opacity = options.opacity !== undefined ? options.opacity : 1;
		this._color = options.color !== undefined ? options.color : 0x55aa55;

		this.numCallsPerActivation = 0; //should always be equal to this.points.length
		this.itemDimensions = []; // how many times to be called in each direction
		this._outputDimensions = 3; //how many dimensions per point to store?

		this.init();
	}
	init(){
		this._geometry = new THREE.BufferGeometry();
		this._vertices;
		this.makeGeometry();

		this.material = new THREE.LineBasicMaterial({color: this._color, linewidth: this._width,opacity:this._opacity});
		this.mesh = new THREE.LineSegments(this._geometry,this.material);

		this.opacity = this._opacity; // setter sets transparent flag if necessary

		threeEnvironment.scene.add(this.mesh);
	}

	makeGeometry(){
		// follow http://blog.cjgammon.com/threejs-geometry
		// or mathbox's lineGeometry

		/*
		This code seems to be necessary to render lines as a triangle strp.
		I can't seem to get it to work properly.

		let numVertices = 3;
		var indices = [];

		//indices
		let base = 0;
		for(var k=0;k<numVertices-1;k+=1){
        	indices.push( base, base+1, base+2);
			indices.push( base+2, base+1, base+3);
			base += 2;
		}
		this._geometry.setIndex( indices );*/

		let MAX_POINTS = 10000;

		this._vertices = new Float32Array(MAX_POINTS * 2 * this._outputDimensions);

		// build geometry

		this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
		//this._geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
		//this.geometry.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

		this._currentPointIndex = 0; //used during updates as a pointer to the buffer

		this._activatedOnce = false;

	}
	_onAdd(){
		//climb up parent hierarchy to find the Domain node we're rendering from
        let root = this.getClosestDomain();
	
		//todo: implement something like assert root typeof RootNode

		this.numCallsPerActivation = root.numCallsPerActivation;
		this.itemDimensions = root.itemDimensions;
	}
	_onFirstActivation(){
		this._onAdd(); //setup this.numCallsPerActivation and this.itemDimensions. used here again because cloning means the onAdd() might be called before this is connected to a type of domain

		// perhaps instead of generating a whole new array, this can reuse the old one?
		let vertices = new Float32Array(this.numCallsPerActivation * this._outputDimensions * 2);

		let positionAttribute = this._geometry.attributes.position;
		this._vertices = vertices;
		positionAttribute.setArray(this._vertices);

		positionAttribute.needsUpdate = true;
	}
	evaluateSelf(i, t, x, y, z){
		if(!this._activatedOnce){
			this._activatedOnce = true;
			this._onFirstActivation();	
		}

		//it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.

		//assert i < vertices.count

		let index = this._currentPointIndex*this._outputDimensions;

	    this._vertices[index]   = x === undefined ? 0 : x;
		this._vertices[index+1] = y === undefined ? 0 : y;
		this._vertices[index+2] = z === undefined ? 0 : z;

		this._currentPointIndex++;

		/* we're drawing like this:
		*----*----*

        *----*----*
	
		but we don't want to insert a diagonal line anywhere. This handles that:  */

		let firstCoordinate = i % this.itemDimensions[this.itemDimensions.length-1];

		if(!(firstCoordinate == 0 || firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1)){
			this._vertices[index+this._outputDimensions]   = x === undefined ? 0 : x;
			this._vertices[index+this._outputDimensions+1] = y === undefined ? 0 : y;
			this._vertices[index+this._outputDimensions+2] = z === undefined ? 0 : z;
			this._currentPointIndex++;
		}

		//vertices should really be an uniform, though.
	}
	onAfterActivation(){
		let positionAttribute = this._geometry.attributes.position;
		positionAttribute.needsUpdate = true;
		this._currentPointIndex = 0; //reset after each update
	}
    removeSelfFromScene(){
        threeEnvironment.scene.remove(this.mesh);
    }
	set color(color){
		//currently only a single color is supported.
		//I should really make it possible to specify color by a function.
		this.material.color = new THREE.Color(color);
		this._color = color;
	}
	get color(){
		return this._color;
	}
	set opacity(opacity){
		this.material.opacity = opacity;
		this.material.transparent = opacity < 1;
		this.material.visible = opacity > 0;
		this._opacity = opacity;
	}
	get opacity(){
		return this._opacity;
	}
	set width(width){
		this._width = width;
		this.material.linewidth = width;
	}
	get width(){
		return this._width;
	}
	clone(){
		return new LineOutput({width: this.width, color: this.color, opacity: this.opacity});
	}
}

export {LineOutput};
