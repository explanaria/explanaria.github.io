import {OutputNode} from '../Node.js';
import {LineOutput} from './LineOutput.js';

class SurfaceOutput extends OutputNode{
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
		this._opacity = options.opacity !== undefined ? options.opacity : 1;
		this._color = options.color !== undefined ? options.color : 0x55aa55;

		this.numCallsPerActivation = 0; //should always be equal to this.vertices.length
		this.itemDimensions = []; // how many times to be called in each direction
		this._outputDimensions = 3; //how many dimensions per point to store?

		this.parent = null;

		this.init();
	}
	init(){
		this._geometry = new THREE.BufferGeometry();
		this._vertices;
		this.makeGeometry();

		this.material = new THREE.MeshBasicMaterial({color: this._color, opacity:this._opacity});
		this.mesh = new THREE.Mesh(this._geometry,this.material);

		this.opacity = this._opacity; // setter sets transparent flag if necessary

		three.scene.add(this.mesh);
	}
	makeGeometry(){

		let MAX_POINTS = 10000;

		this._vertices = new Float32Array(MAX_POINTS * this._outputDimensions);
		this._normals = new Float32Array(MAX_POINTS * this._outputDimensions);

		// build geometry

		this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
		this._geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( this._normals, 3 ) );
		//this.geometry.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

		this._currentPointIndex = 0; //used during updates as a pointer to the buffer

		this._activatedOnce = false;

	}
	_onAdd(){
		//climb up parent hierarchy to find the Area
		let root = this;
		while(root.parent !== null){
			root = root.parent;
		}
	
		//todo: implement something like assert root typeof RootNode

		this.numCallsPerActivation = root.numCallsPerActivation;
		this.itemDimensions = root.itemDimensions;
	}
	_onFirstActivation(){
		this._onAdd(); //setup this.numCallsPerActivation and this.itemDimensions. used here again because cloning means the onAdd() might be called before this is connected to a type of domain

		// perhaps instead of generating a whole new array, this can reuse the old one?
		let vertices = new Float32Array(this.numCallsPerActivation * this._outputDimensions);
		let normals = new Float32Array(this.numCallsPerActivation * 3);

		console.log(this.itemDimensions, this.numCallsPerActivation, this._outputDimensions);

		let positionAttribute = this._geometry.attributes.position;
		this._vertices = vertices;
		positionAttribute.setArray(this._vertices);
		positionAttribute.needsUpdate = true;

		let normalAttribute = this._geometry.attributes.normal;
		this._normals = normals;
		normalAttribute.setArray(this._normals);
		normalAttribute.needsUpdate = true;


		//assert this.itemDimensions[0] * this.itemDimensions[1] = this.numCallsPerActivation and this._outputDimensions == 2
		var indices = [];

		//rendered triangle indices
		//from three.js PlaneGeometry.js
		let base = 0;
		let i=0, j=0;
		for(j=0;j<this.itemDimensions[0]-1;j++){
			for(i=0;i<this.itemDimensions[1]-1;i++){

				let a = i + j * this.itemDimensions[1];
				let b = i + (j+1) * this.itemDimensions[1];
				let c = (i+1)+ (j+1) * this.itemDimensions[1];
				let d = (i+1)+ j * this.itemDimensions[1];

        		indices.push(a, b, d);
				indices.push(b, c, d);
				
				//double sided reverse faces
        		indices.push(d, b, a);
				indices.push(d, c, b);

				//set normal to [0,0,1]
				/*normals[(i + j * this.itemDimensions[1])*3] = 0
				normals[(i + j * this.itemDimensions[1])*3+1] = 0
				normals[(i + j * this.itemDimensions[1])*3+2] = 0*/
			}
		}
		console.log(indices);
		this._geometry.setIndex( indices );
	}
	evaluateSelf(i, t, x, y, z){
		if(!this._activatedOnce){
			this._activatedOnce = true;
			this._onFirstActivation();	
		}

		//it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.

		//assert i < vertices.count

		let index = this._currentPointIndex*this._outputDimensions;

		if(x !== undefined)this._vertices[index] = x;
		if(y !== undefined)this._vertices[index+1] = y;
		if(z !== undefined)this._vertices[index+2] = z;

		this._currentPointIndex++;
	}
	onAfterActivation(){
		let positionAttribute = this._geometry.attributes.position;
		positionAttribute.needsUpdate = true;

		//todo: recalc normals

		this._currentPointIndex = 0; //reset after each update
	}
	set color(color){
		//currently only a single color is supported.
		//I should really make this a function
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
		return new SurfaceOutput({color: this.color, opacity: this.opacity});
	}
}

export {SurfaceOutput};
