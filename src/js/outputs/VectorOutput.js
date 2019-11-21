import { LineOutput } from './LineOutput.js';
import { Utils } from '../utils.js';
import { threeEnvironment } from '../ThreeEnvironment.js';

export class VectorOutput extends LineOutput{
	constructor(options = {}){
		/*input: Transformation
			width: number
		*/
		super(options);

	}
	init(){
		this._geometry = new THREE.BufferGeometry();
		this._vertices;
		this.arrowheads = [];


		this.material = new THREE.LineBasicMaterial({vertexColors: THREE.VertexColors, linewidth: this._width, opacity:this._opacity});
        //TODO: make the arrow tip colors match the colors of the lines' tips
		this.arrowMaterial = new THREE.LineBasicMaterial({color: this._color, linewidth: this._width, opacity:this._opacity});
		this.lineMesh = new THREE.LineSegments(this._geometry,this.material);

		this.opacity = this._opacity; // setter sets transparent flag if necessary


		const circleResolution = 12;
		const arrowheadSize = 0.3;
		const EPSILON = 0.00001;
		this.EPSILON = EPSILON;

		this.coneGeometry = new THREE.CylinderBufferGeometry( 0, arrowheadSize, arrowheadSize*1.7, circleResolution, 1 );
		let arrowheadOvershootFactor = 0.1; //used so that the line won't rudely clip through the point of the arrowhead

		this.coneGeometry.translate( 0, - arrowheadSize + arrowheadOvershootFactor, 0 );

		this._coneUpDirection = new THREE.Vector3(0,1,0);

		this.makeGeometry();

        this.mesh = new THREE.Object3D();
        this.mesh.add(this.lineMesh);

		threeEnvironment.scene.add(this.mesh);
	}
	_onFirstActivation(){
		super._onFirstActivation();

		if(this.itemDimensions.length > 1){
			this.numArrowheads = this.itemDimensions.slice(0,this.itemDimensions.length-1).reduce(function(prev, current){
				return current + prev;
			});
		}else{
			//assumed itemDimensions isn't a nonzero array. That should be the constructor's problem.
			this.numArrowheads = 1;
		}

		//remove any previous arrowheads
		for(var i=0;i<this.arrowheads.length;i++){
			let arrow = this.arrowheads[i];
			threeEnvironment.scene.remove(arrow);
		}

		this.arrowheads = new Array(this.numArrowheads);
		for(var i=0;i<this.numArrowheads;i++){
			this.arrowheads[i] = new THREE.Mesh(this.coneGeometry, this.arrowMaterial);
            this.mesh.add(this.arrowheads[i]);
		}
		console.log("number of arrowheads (= number of lines):"+ this.numArrowheads);
	}
	evaluateSelf(i, t, x, y, z){
		//it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.
		if(!this._activatedOnce){
			this._activatedOnce = true;
			this._onFirstActivation();	
		}

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

		//vertices should really be an uniform, though.
		if(!(firstCoordinate == 0 || firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1)){
			this._vertices[index+this._outputDimensions]   = x === undefined ? 0 : x;
			this._vertices[index+this._outputDimensions+1] = y === undefined ? 0 : y;
			this._vertices[index+this._outputDimensions+2] = z === undefined ? 0 : z;
			this._currentPointIndex++;
		}

		if(firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1){

			//calculate direction of last line segment
			let dx = this._vertices[index-this._outputDimensions] - this._vertices[index]
			let dy = this._vertices[index-this._outputDimensions+1] - this._vertices[index+1]
			let dz = this._vertices[index-this._outputDimensions+2] - this._vertices[index+2]

			let lineNumber = Math.floor(i / this.itemDimensions[this.itemDimensions.length-1]);
			Utils.assert(lineNumber <= this.numArrowheads); //this may be wrong

			let directionVector = new THREE.Vector3(-dx,-dy,-dz)

			//Make arrows disappear if the line is small enough
			//One way to do this would be to sum the distances of all line segments. I'm cheating here and just measuring the distance of the last vector, then multiplying by the number of line segments (naively assuming all line segments are the same length)
			let length = directionVector.length() * (this.itemDimensions[this.itemDimensions.length-1]-1)

			const effectiveDistance = 3;

			let clampedLength = Math.max(0, Math.min(length/effectiveDistance, 1))/1

			//shrink function designed to have a steep slope close to 0 but mellow out at 0.5 or so in order to avoid the line width overcoming the arrowhead width
			//In Chrome, three.js complains whenever something is set to 0 scale. Adding an epsilon term is unfortunate but necessary to avoid console spam.
			
			this.arrowheads[lineNumber].scale.setScalar(Math.acos(1-2*clampedLength)/Math.PI + this.EPSILON);
			
 			//position/rotation comes after since .normalize() modifies directionVector in place
		
			let pos = this.arrowheads[lineNumber].position;

			pos.x = x === undefined ? 0 : x;
			pos.y = y === undefined ? 0 : y;
			pos.z = z === undefined ? 0 : z;

			if(length > 0){ //directionVector.normalize() fails with 0 length
				this.arrowheads[lineNumber].quaternion.setFromUnitVectors(this._coneUpDirection, directionVector.normalize() );
			}

		}
	}


	set color(color){
		//currently only a single color is supported.
		//I should really make it possible to specify color by a function.
		this._color = color;
        this.setAllVerticesToColor(color);
        this.arrowMaterial.color = this._color;
	}

	get color(){
		return this._color;
	}

    set opacity(opacity){
		this.arrowMaterial.opacity = opacity;
		this.arrowMaterial.transparent = opacity < 1;
		this.arrowMaterial.visible = opacity > 0;

		this.material.opacity = opacity;
		this.material.transparent = opacity < 1;
		this.material.visible = opacity > 0;
		this._opacity = opacity;
    }

	get opacity(){
		return this._opacity;
	}
    removeSelfFromScene(){
        threeEnvironment.scene.remove(this.mesh);
		for(var i=0;i<this.numArrowheads;i++){
			threeEnvironment.scene.remove(this.arrowheads[i]);
		}
    }
	clone(){
		return new VectorOutput({width: this.width, color: this.color, opacity: this.opacity});
	}
}


