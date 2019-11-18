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

		this.material = new THREE.LineBasicMaterial({vertexColors: THREE.VertexColors, linewidth: this._width,opacity:this._opacity});
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

		const MAX_POINTS = 10000;
        const NUM_POINTS_PER_LINE_SEGMENT = 2;

		this._vertices = new Float32Array(this._outputDimensions * (MAX_POINTS-1)*NUM_POINTS_PER_LINE_SEGMENT);
		this._colors = new Float32Array((MAX_POINTS-1)*NUM_POINTS_PER_LINE_SEGMENT * 3);

		// build geometry

		this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
        this._geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( this._colors, 3 ) );
		//this._geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
		//this.geometry.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

		this._currentPointIndex = 0; //used during updates as a pointer to the buffer

		this._activatedOnce = false;

	}
	_onAdd(){
		//climb up parent hierarchy to find the Domain node we're rendering from
        let root = null;
        try{
           root = this.getClosestDomain();
        }catch(error){
            console.warn(error);
            return;
        }
	
		//todo: implement something like assert root typeof RootNode

		this.numCallsPerActivation = root.numCallsPerActivation;
		this.itemDimensions = root.itemDimensions;
	}
	_onFirstActivation(){
		this._onAdd(); //setup this.numCallsPerActivation and this.itemDimensions. used here again because cloning means the onAdd() might be called before this is connected to a type of domain

		// perhaps instead of generating a whole new array, this can reuse the old one?


        // Why use (this.numCallsPerActivation-1)*2? 
        // We want to render a chain with n points, each connected to the one in front of it by a line except the last one. Then because the last vertex doesn't introduce a new line, there are n-1 lines between the chain points.
        // Each line is rendered using two vertices. So we multiply the number of lines, this.numCallsPerActivation-1, by two.
        const NUM_POINTS_PER_LINE_SEGMENT = 2;

		let vertices = new Float32Array( this._outputDimensions * (this.numCallsPerActivation-1) * NUM_POINTS_PER_LINE_SEGMENT);
		let colors = new Float32Array( 3 * (this.numCallsPerActivation-1) * NUM_POINTS_PER_LINE_SEGMENT);

		let positionAttribute = this._geometry.attributes.position;
		this._vertices = vertices;
		positionAttribute.setArray(this._vertices);

		let colorAttribute = this._geometry.attributes.color;
		this._colors = colors;
		colorAttribute.setArray(this._colors);

        this.setAllVerticesToColor(this.color);

		positionAttribute.needsUpdate = true;
		colorAttribute.needsUpdate = true;
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
    setAllVerticesToColor(color){
        const col = new THREE.Color(color);
        const numVertices = (this.numCallsPerActivation-1)*2;
        for(let i=0; i<numVertices;i++){
            //Don't forget some points appear twice - as the end of one line segment and the beginning of the next.
            this._setColorForVertexRGB(i, col.r, col.g, col.b);
        }
        //tell three.js to update colors
    }
    _setColorForVertex(vertexIndex, color){
        //color is a THREE.Color here
		this._setColorForVertexRGB(vertexIndex, color.r, color.g, color.b);
    }
    _setColorForVertexRGB(vertexIndex, normalizedR, normalizedG, normalizedB){
        //all of normalizedR, normalizedG, normalizedB are 0-1.
		let colorArray = this._geometry.attributes.color.array;
        colorArray[vertexIndex*3 + 0] = normalizedR;
        colorArray[vertexIndex*3 + 1] = normalizedG;
        colorArray[vertexIndex*3 + 2] = normalizedB;

		let colorAttribute = this._geometry.attributes.color;
		colorAttribute.needsUpdate = true;
    }
	set color(color){
		//currently only a single color is supported.
		//I should really make it possible to specify color by a function.
		this._color = color;
        this.setAllVerticesToColor(color);
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
