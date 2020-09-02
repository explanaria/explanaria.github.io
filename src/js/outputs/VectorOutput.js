import { LineOutput } from './LineOutput.js';
import { Utils } from '../utils.js';
import { threeEnvironment } from '../ThreeEnvironment.js';

export class VectorOutput extends LineOutput{
    constructor(options = {}){
        /*
                width: number. units are in screenY/400.
                opacity: number
                color: hex code or THREE.Color()
                lineJoin: "bevel" or "round". default: round. Don't change this after initialization.
        */
        super(options);

    }
    init(){
        this.arrowMaterial = new THREE.LineBasicMaterial({color: this._color, linewidth: this._width, opacity:this._opacity});

        super.init();
        this.arrowheads = [];

        //TODO: make the arrow tip colors match the colors of the lines' tips

        const circleResolution = 12;
        const arrowheadSize = 0.3;
        const EPSILON = 0.00001;
        this.EPSILON = EPSILON;

        this.coneGeometry = new THREE.CylinderBufferGeometry( 0, arrowheadSize, arrowheadSize*1.7, circleResolution, 1 );
        let arrowheadOvershootFactor = 0.1; //used so that the line won't rudely clip through the point of the arrowhead
        this.coneGeometry.translate( 0, - arrowheadSize + arrowheadOvershootFactor, 0 );
        this._coneUpDirection = new THREE.Vector3(0,1,0);
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
    }
    evaluateSelf(i, t, x, y, z){
        //it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.
        super.evaluateSelf(i,t,x,y,z);

        const lastDimensionLength = this.itemDimensions[this.itemDimensions.length-1];
        let firstCoordinate = i % lastDimensionLength;

        //boolean variables. if in the future LineOutput can support variable-width lines, these should eb changed
        let startingNewLine = firstCoordinate == 0;
        let endingNewLine = firstCoordinate == lastDimensionLength-1;

        if(endingNewLine){
            //we need to update arrows
            //calculate direction of last line segment
            //this point is currentPointIndex-1 because currentPointIndex was increased by 1 during super.evaluateSelf()
            let index = (this._currentPointIndex-1)*this._outputDimensions*4;

            let prevX = this._vertices[(this._currentPointIndex-2)*this._outputDimensions*4];
            let prevY = this._vertices[(this._currentPointIndex-2)*this._outputDimensions*4+1];
            let prevZ = this._vertices[(this._currentPointIndex-2)*this._outputDimensions*4+2];

            let dx = prevX - this._vertices[index];
            let dy = prevY - this._vertices[index+1];
            let dz = prevZ - this._vertices[index+2];

            let lineNumber = Math.floor(i / lastDimensionLength);
            Utils.assert(lineNumber <= this.numArrowheads); //this may be wrong

            let directionVector = new THREE.Vector3(-dx,-dy,-dz);

            //Make arrows disappear if the line is small enough
            //One way to do this would be to sum the distances of all line segments. I'm cheating here and just measuring the distance of the last vector, then multiplying by the number of line segments (naively assuming all line segments are the same length)
            let length = directionVector.length() * (lastDimensionLength-1);

            const effectiveDistance = 3;
            let clampedLength = Math.max(0, Math.min(length/effectiveDistance, 1));

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
        this.arrowMaterial.color = new THREE.Color(this._color);
    }

    get color(){
        return this._color;
    }

    set opacity(opacity){
        this.arrowMaterial.opacity = opacity;
        this.arrowMaterial.transparent = opacity < 1;
        this.material.transparent = opacity < 1 || this.lineJoinType == "ROUND";
        this.arrowMaterial.visible = opacity > 0;

        //mesh is always transparent
        this.material.opacity = opacity;
        this.material.visible = opacity > 0;
        this._opacity = opacity;
        this._uniforms.opacity.value = opacity;
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
        return new VectorOutput({width: this.width, color: this.color, opacity: this.opacity,lineJoinType: this.lineJoinType});
    }
}


