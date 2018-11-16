import {OutputNode} from '../Node.js';
import {LineOutput} from './LineOutput.js';
import { threeEnvironment } from '../ThreeEnvironment.js';
import { vShader, fShader, uniforms } from './SurfaceOutputShaders.js';

class SurfaceOutput extends OutputNode{
	constructor(options = {}){
		super();
		/* should be .add()ed to a Transformation to work
			options:
			{
				width: number
				opacity: number
				color: hex code or THREE.Color()
				showGrid: boolean. If true, will display a grid over the surface. Default: true
				showSolid: boolean. If true, will display a solid surface. Default: true
				gridSquares: number representing how many squares per dimension to use in a rendered grid
			}
		*/
		this._opacity = options.opacity !== undefined ? options.opacity : 1;
		this._color = options.color !== undefined ? options.color : 0x55aa55;

		this._gridSquares = options.gridSquares !== undefined ? options.gridSquares : 16;
		this._showGrid = options.showGrid !== undefined ? options.showGrid : true;
		this._showSolid = options.showSolid !== undefined ? options.showSolid : true;
		this._gridLineWidth = options.gridLineWidth !== undefined ? options.gridLineWidth : 0.15;

		this.numCallsPerActivation = 0; //should always be equal to this.vertices.length
		this.itemDimensions = []; // how many times to be called in each direction
		this._outputDimensions = 3; //how many dimensions per point to store?

		this.init();
	}
	init(){
		this._geometry = new THREE.BufferGeometry();
		this._vertices;
		this.makeGeometry();

		//make a deep copy of the uniforms template
		this._uniforms = {};
		for(var uniformName in uniforms){
			this._uniforms[uniformName] = {
				type: uniforms[uniformName].type,
				value: uniforms[uniformName].value
			}
		}

		this.material = new THREE.ShaderMaterial({
			side: THREE.BackSide,
			vertexShader: vShader, 
			fragmentShader: fShader,
			uniforms: this._uniforms,
			});
		this.mesh = new THREE.Mesh(this._geometry,this.material);

		this.opacity = this._opacity; // setter sets transparent flag if necessary
		this.color = this._color; //setter sets color uniform
		this._uniforms.opacity.value = this._opacity;
		this._uniforms.gridSquares.value = this._gridSquares;
		this._uniforms.showGrid.value = this._showGrid ? 1 : 0;
		this._uniforms.showSolid.value = this._showSolid ? 1 : 0;
		this._uniforms.lineWidth.value = this._gridLineWidth;

		if(!this.showSolid)this.material.transparent = true;

		threeEnvironment.scene.add(this.mesh);
	}
	makeGeometry(){

		let MAX_POINTS = 10000;

		this._vertices = new Float32Array(MAX_POINTS * this._outputDimensions);
		this._normals = new Float32Array(MAX_POINTS * 3);
		this._uvs = new Float32Array(MAX_POINTS * 2);

		// build geometry

		this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
		this._geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( this._normals, 3 ) );
		this._geometry.addAttribute( 'uv', new THREE.Float32BufferAttribute( this._uvs, 2 ) );

		this._currentPointIndex = 0; //used during updates as a pointer to the buffer

		this._activatedOnce = false;

	}
	_setUVs(uvs, index, u, v){

	}
	_onFirstActivation(){
        //setup this.numCallsPerActivation and this.itemDimensions. used here again because cloning means the onAdd() might be called before this is connected to a type of domain

		//climb up parent hierarchy to find the DomainNode we're rendering from
		let root = this.getClosestDomain();
		this.numCallsPerActivation = root.numCallsPerActivation;
		this.itemDimensions = root.itemDimensions;

		// perhaps instead of generating a whole new array, this can reuse the old one?
		let vertices = new Float32Array(this.numCallsPerActivation * this._outputDimensions);
		let normals = new Float32Array(this.numCallsPerActivation * 3);
		let uvs = new Float32Array(this.numCallsPerActivation * 2);

		let positionAttribute = this._geometry.attributes.position;
		this._vertices = vertices;
		positionAttribute.setArray(this._vertices);
		positionAttribute.needsUpdate = true;

		let normalAttribute = this._geometry.attributes.normal;
		this._normals = normals;
		normalAttribute.setArray(this._normals);
		normalAttribute.needsUpdate = true;

		let uvAttribute = this._geometry.attributes.uv;


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

			}
		}

		//normals (will be overwritten later) and uvs
		for(j=0;j<this.itemDimensions[0];j++){
			for(i=0;i<this.itemDimensions[1];i++){

				let pointIndex = i + j * this.itemDimensions[1];
				//set normal to [0,0,1] as a temporary value
				normals[(pointIndex)*3] = 0;
				normals[(pointIndex)*3+1] = 0;
				normals[(pointIndex)*3+2] = 1;

				//uvs
				uvs[(pointIndex)*2] = j/(this.itemDimensions[0]-1);
				uvs[(pointIndex)*2+1] = i/(this.itemDimensions[1]-1);
			}
		}

		this._uvs = uvs;
		uvAttribute.setArray(this._uvs);
		uvAttribute.needsUpdate = true;

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

		this._recalcNormals();
		let normalAttribute = this._geometry.attributes.normal;
		normalAttribute.needsUpdate = true;

		this._currentPointIndex = 0; //reset after each update
	}
	_recalcNormals(){
		let positionAttribute = this._geometry.attributes.position;
		let normalAttribute = this._geometry.attributes.normal;
		//rendered triangle indices
		//from three.js PlaneGeometry.js
		let normalVec = new THREE.Vector3();
		let partialX = new THREE.Vector3();
		let partialY = new THREE.Vector3();

		let base = 0;
		let negationFactor = 1;
		let i=0, j=0;
		for(j=0;j<this.itemDimensions[0];j++){
			for(i=0;i<this.itemDimensions[1];i++){

				//currently doing the normal for the point at index a.
				let a = i + j * this.itemDimensions[1];
				let b,c;

				//Tangents are calculated with finite differences - For (x,y), compute the partial derivatives using (x+1,y) and (x,y+1) and cross them. But if you're at theborder, x+1 and y+1 might not exist. So in that case we go backwards and use (x-1,y) and (x,y-1) instead.
				//When that happens, the vector subtraction will subtract the wrong way, introducing a factor of -1 into the cross product term. So negationFactor keeps track of when that happens and is multiplied again to cancel it out.
				negationFactor = 1; 

				//b is the index of the point 1 away in the y direction
				if(i < this.itemDimensions[1]-1){
					b = (i+1) + j * this.itemDimensions[1];
				}else{
					//end of the y axis, go backwards for tangents
					b = (i-1) + j * this.itemDimensions[1];
					negationFactor *= -1;
				}

				//c is the index of the point 1 away in the x direction
				if(j < this.itemDimensions[0]-1){
					c = i + (j+1) * this.itemDimensions[1];
				}else{
					//end of the x axis, go backwards for tangents
					c = i + (j-1) * this.itemDimensions[1];
					negationFactor *= -1;
				}

				//the vector b-a. 
				//this._vertices stores the components of each vector in one big float32array, so this pulls them out and just does the subtraction numerically. The components of vector #52 are x:52*3+0,y:52*3+1,z:52*3+2, for example.
				partialY.set(this._vertices[b*3]-this._vertices[a*3],this._vertices[b*3+1]-this._vertices[a*3+1],this._vertices[b*3+2]-this._vertices[a*3+2]);
				//the vector c-a.
				partialX.set(this._vertices[c*3]-this._vertices[a*3],this._vertices[c*3+1]-this._vertices[a*3+1],this._vertices[c*3+2]-this._vertices[a*3+2]);

				//b-a cross c-a
				normalVec.crossVectors(partialX,partialY).normalize();
				normalVec.multiplyScalar(negationFactor);
				//set normal
				this._normals[(i + j * this.itemDimensions[1])*3] = normalVec.x;
				this._normals[(i + j * this.itemDimensions[1])*3+1] = normalVec.y;
				this._normals[(i + j * this.itemDimensions[1])*3+2] = normalVec.z;
			}
		}
		// don't forget to normalAttribute.needsUpdate = true after calling this!
	}
	set color(color){
		//currently only a single color is supported.
		//I should really make this a function
		this._color = color;
		this._uniforms.color.value = new THREE.Color(color);
	}
	get color(){
		return this._color;
	}
	set opacity(opacity){
		this.material.opacity = opacity;
		this.material.transparent = opacity < 1;
		this.material.visible = opacity > 0;
		this._opacity = opacity;
        this._uniforms.opacity.value = opacity;
	}
	get opacity(){
		return this._opacity;
	}
	clone(){
		return new SurfaceOutput({color: this.color, opacity: this.opacity});
	}
}

export {SurfaceOutput};
