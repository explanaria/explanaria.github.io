import {OutputNode} from '../Node.js';
import { getThreeEnvironment } from '../ThreeEnvironment.js';
import { vShader, fShader, uniforms, LINE_JOIN_TYPES } from './LineOutputShaders.js';

class LineOutput extends OutputNode{
    constructor(options = {}){
        super();
        /* should be .add()ed to a Transformation to work.
        Crisp lines using the technique in https://mattdesl.svbtle.com/drawing-lines-is-hard, but also supporting mitered lines and beveled lines too!
            options:
            {
                width: number. units are in screenY/400.
                opacity: number
                color: hex code or THREE.Color()
                lineJoin: "bevel" or "round". default: round. Don't change this after initialization.
            }
        */

        this._width = options.width !== undefined ? options.width : 5;
        this._opacity = options.opacity !== undefined ? options.opacity : 1;
        this._color = options.color !== undefined ? new THREE.Color(options.color) : new THREE.Color(0x55aa55);

        this.lineJoinType = options.lineJoinType !== undefined ? options.lineJoinType.toUpperCase() : "BEVEL";
        if(LINE_JOIN_TYPES[this.lineJoinType] === undefined){
            this.lineJoinType = "BEVEL";
        }

        this.numCallsPerActivation = 0; //should always be equal to this.points.length
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
            extensions:{derivatives: true,},
            alphaTest: 0.5,
        });

        this.mesh = new THREE.Mesh(this._geometry,this.material);

        this.opacity = this._opacity; // setter sets transparent flag if necessary
        this.color = this._color; //setter sets color attribute
        this._uniforms.opacity.value = this._opacity;
        this._uniforms.lineWidth.value = this._width;
        this._uniforms.lineJoinType.value = LINE_JOIN_TYPES[this.lineJoinType];

        getThreeEnvironment().scene.add(this.mesh);
    }

    makeGeometry(){
        const MAX_POINTS = 1000; //these arrays get discarded on first activation anyways
        const NUM_POINTS_PER_VERTEX = 4;

        let numVerts = (MAX_POINTS-1)*NUM_POINTS_PER_VERTEX;

        this._vertices = new Float32Array(this._outputDimensions * numVerts);
        this._nextPointVertices = new Float32Array(this._outputDimensions * numVerts);
        this._prevPointVertices = new Float32Array(this._outputDimensions * numVerts);
        this._colors = new Float32Array(numVerts * 3);

        // build geometry

        this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
        this._geometry.addAttribute( 'nextPointPosition', new THREE.Float32BufferAttribute( this._nextPointVertices, this._outputDimensions ) );
        this._geometry.addAttribute( 'previousPointPosition', new THREE.Float32BufferAttribute( this._prevPointVertices, this._outputDimensions ) );
        this._geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( this._colors, 3 ) );

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

        const NUM_POINTS_PER_LINE_SEGMENT = 4; //4 used for beveling
        const numVerts = (this.numCallsPerActivation) * NUM_POINTS_PER_LINE_SEGMENT;

        let vertices = new Float32Array( this._outputDimensions * numVerts);
        let nextVertices = new Float32Array( this._outputDimensions * numVerts);
        let prevVertices = new Float32Array( this._outputDimensions * numVerts);
        let colors = new Float32Array( 3 * numVerts);

        let positionAttribute = this._geometry.attributes.position;
        this._vertices = vertices;
        positionAttribute.setArray(this._vertices);

        let prevPointPositionAttribute = this._geometry.attributes.previousPointPosition;
        this._prevPointVertices = prevVertices;
        prevPointPositionAttribute.setArray(this._prevPointVertices);

        let nextPointPositionAttribute = this._geometry.attributes.nextPointPosition;
        this._nextPointVertices = nextVertices;
        nextPointPositionAttribute.setArray(this._nextPointVertices);

        let colorAttribute = this._geometry.attributes.color;
        this._colors = colors;
        colorAttribute.setArray(this._colors);

        //used to differentiate the left border of the line from the right border
        let direction = new Float32Array(numVerts);
        for(let i=0; i<numVerts;i++){
            direction[i] = i%2==0 ? 1 : 0; //alternate -1 and 1
        }
        this._geometry.addAttribute( 'direction', new THREE.Float32BufferAttribute( direction, 1) );

        //used to differentiate the points which move towards prev vertex from points which move towards next vertex
        let nextOrPrev = new Float32Array(numVerts);
        for(let i=0; i<numVerts;i++){
            nextOrPrev[i] = i%4<2 ? 0 : 1; //alternate 0,0, 1,1
        }
        this._geometry.addAttribute( 'approachNextOrPrevVertex', new THREE.Float32BufferAttribute( nextOrPrev, 1) );

        //indices
        /*
        For each vertex, we connect it to the next vertex like this:
        n --n+2--n+4--n+6
        |  /  | / |  /  |
       n+1 --n+3--n+5--n+7

       pt1   pt2 pt2   pt3

       vertices n,n+1 are around point 1, n+2,n+3,n+4,n+5 are around pt2, n+6,n+7 are for point3. the middle segment (n+2-n+5) is the polygon used for beveling at point 2.

        then we advance n two at a time to move to the next vertex. vertices n, n+1 represent the same point;
        they're separated in the vertex shader to a constant screenspace width */
        let indices = [];
        for(let vertNum=0;vertNum<(this.numCallsPerActivation-1);vertNum +=1){ //not sure why this -3 is there. i guess it stops vertNum+3 two lines down from going somewhere it shouldn't?
            let firstCoordinate = vertNum % this.itemDimensions[this.itemDimensions.length-1];
            let endingNewLine = firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1;
    
            let vertIndex = vertNum * NUM_POINTS_PER_LINE_SEGMENT;
            
            if(!endingNewLine){
                //these triangles should be disabled when doing round joins
                if(this.lineJoinType == "BEVEL"){
                    indices.push( vertIndex+1, vertIndex,   vertIndex+2);
                    indices.push( vertIndex+1, vertIndex+2, vertIndex+3);
                }

                indices.push( vertIndex+3, vertIndex+2, vertIndex+4);
                indices.push( vertIndex+3, vertIndex+4, vertIndex+5);
            }
        }
        this._geometry.setIndex( indices );

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

        let xValue =  x === undefined ? 0 : x;
        let yValue =  y === undefined ? 0 : y;
        let zValue =  z === undefined ? 0 : z;

        this.saveVertexInfoInBuffers(this._vertices, this._currentPointIndex, xValue,yValue,zValue);

        /* we're drawing like this:
        *----*----*

        *----*----*
    
        but we don't want to insert a diagonal line anywhere. This handles that:  */

        let firstCoordinate = i % this.itemDimensions[this.itemDimensions.length-1];

        //boolean variables. if in the future LineOutput can support variable-width lines, these should eb changed
        let startingNewLine = firstCoordinate == 0;
        let endingNewLine = firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1;

        if(startingNewLine){
            //make the prevPoint be the same point as this
            this.saveVertexInfoInBuffers(this._prevPointVertices, this._currentPointIndex, xValue,yValue,zValue);
        }else{

            let prevX = this._vertices[(this._currentPointIndex-1)*this._outputDimensions*4];
            let prevY = this._vertices[(this._currentPointIndex-1)*this._outputDimensions*4+1];
            let prevZ = this._vertices[(this._currentPointIndex-1)*this._outputDimensions*4+2];

            //set this thing's prevPoint to the previous vertex
            this.saveVertexInfoInBuffers(this._prevPointVertices, this._currentPointIndex, prevX,prevY,prevZ);

            //set the PREVIOUS point's nextPoint to to THIS vertex.
            this.saveVertexInfoInBuffers(this._nextPointVertices, this._currentPointIndex-1, xValue,yValue,zValue);
        }

        if(endingNewLine){
            //make the nextPoint be the same point as this
            this.saveVertexInfoInBuffers(this._nextPointVertices, this._currentPointIndex, xValue,yValue,zValue);
        }
        this._currentPointIndex++;
    }

    saveVertexInfoInBuffers(array, vertNum, value1,value2,value3){
        //for every call to activate(), all 4 geometry vertices representing that point need to save that info.
        //Therefore, this function will spread three coordinates into a given array, repeatedly.

        let index = vertNum*this._outputDimensions*4;

        array[index]   = value1
        array[index+1] = value2
        array[index+2] = value3

        array[index+3] = value1
        array[index+4] = value2
        array[index+5] = value3

        array[index+6] = value1
        array[index+7] = value2
        array[index+8] = value3

        array[index+9]  = value1
        array[index+10] = value2
        array[index+11] = value3
        
    }
    onAfterActivation(){
        let positionAttribute = this._geometry.attributes.position;
        positionAttribute.needsUpdate = true;
        let prevPointPositionAttribute = this._geometry.attributes.previousPointPosition;
        prevPointPositionAttribute.needsUpdate = true;
        let nextPointPositionAttribute = this._geometry.attributes.nextPointPosition;
        nextPointPositionAttribute.needsUpdate = true;

        //update aspect ratio. in the future perhaps this should only be changed when the aspect ratio changes so it's not being done per frame?
        if(this._uniforms){
            const three = getThreeEnvironment();
            this._uniforms.aspect.value = three.camera.aspect; //TODO: re-enable once debugging is done
            three.renderer.getDrawingBufferSize(this._uniforms.screenSize.value); //modifies uniform in place
        }

        this._currentPointIndex = 0; //reset after each update
    }
    removeSelfFromScene(){
        getThreeEnvironment().scene.remove(this.mesh);
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
        let index = vertexIndex * 3 * 4; //*3 because colors have 3 channels, *4 because 4 vertices/line point

        colorArray[index + 0] = normalizedR;
        colorArray[index + 1] = normalizedG;
        colorArray[index + 2] = normalizedB;

        colorArray[index + 3] = normalizedR;
        colorArray[index + 4] = normalizedG;
        colorArray[index + 5] = normalizedB;

        colorArray[index + 6] = normalizedR;
        colorArray[index + 7] = normalizedG;
        colorArray[index + 8] = normalizedB;

        colorArray[index + 9] = normalizedR;
        colorArray[index + 10] = normalizedG;
        colorArray[index + 11] = normalizedB;

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
        //mesh is always transparent
        this.material.opacity = opacity;
        this.material.transparent = opacity < 1 || this.lineJoinType == "ROUND";
        this.material.visible = opacity > 0;
        this._opacity = opacity;
        this._uniforms.opacity.value = opacity;
    }
    get opacity(){
        return this._opacity;
    }
    set width(width){
        this._width = width;
        this._uniforms.lineWidth.value = width;
    }
    get width(){
        return this._width;
    }
    clone(){
        return new LineOutput({width: this.width, color: this.color, opacity: this.opacity, lineJoinType: this.lineJoinType});
    }
}

export {LineOutput};
