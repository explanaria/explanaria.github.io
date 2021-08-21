import { getThreeEnvironment } from './copypastes/ThreeEnvironment.js';
import { vShader, fShader, uniforms, LINE_JOIN_TYPES } from './copypastes/LineOutputShaders.js';


class LineMesh{
    constructor(options = {}){
        /*
        Crisp lines using the technique in https://mattdesl.svbtle.com/drawing-lines-is-hard, but also supporting mitered lines and beveled lines too!
            options:
            {
                width: number. units are in screenY/400.
                opacity: number
                color: hex code or THREE.Color()
                lineJoin: "bevel" or "round". default: round. Don't change this after initialization.

                points: [[x,y,z],[x2,y2,z2]]...
            }
    
            //unlike LineOutput, points are stored in a .points array.
        */
        this._width = options.width !== undefined ? options.width : 10;
        this._opacity = options.opacity !== undefined ? options.opacity : 1;

        this._color = options.color !== undefined ? new THREE.Color(options.color) : new THREE.Color(0x55aa55);
 
        this.lineJoinType = options.lineJoinType !== undefined ? options.lineJoinType.toUpperCase() : "BEVEL";
        if(LINE_JOIN_TYPES[this.lineJoinType] === undefined){
            this.lineJoinType = "BEVEL";
        }

        this.init();
        this.points = options.points || [];
        this.color = this._color; //setter sets color attribute
    }
    init(){
        this._geometry = new THREE.BufferGeometry();
        this._vertices;
        this.setupAttributes();


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
        this._uniforms.opacity.value = this._opacity;
        this._uniforms.lineWidth.value = this._width;
        this._uniforms.lineJoinType.value = LINE_JOIN_TYPES[this.lineJoinType];

        getThreeEnvironment().scene.add(this.mesh);
    }

    setupAttributes(){
        const NUM_POINTS_PER_VERTEX = 4;
        let numVerts = 1*NUM_POINTS_PER_VERTEX;

        this._vertices = new Float32Array(3 * numVerts);
        this._nextPointVertices = new Float32Array(3 * numVerts);
        this._prevPointVertices = new Float32Array(3 * numVerts);
        this._colors = new Float32Array(numVerts * 3);

        // build geometry

        this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, 3 ) );
        this._geometry.addAttribute( 'nextPointPosition', new THREE.Float32BufferAttribute( this._nextPointVertices, 3 ) );
        this._geometry.addAttribute( 'previousPointPosition', new THREE.Float32BufferAttribute( this._prevPointVertices, 3 ) );
        this._geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( this._colors, 3 ) );
    }
    resizeBuffersForDifferentNumberOfPoints(){

        const NUM_POINTS_PER_LINE_SEGMENT = 4; //4 used for beveling
        const numVerts = (this.points.length) * NUM_POINTS_PER_LINE_SEGMENT;

        let vertices = new Float32Array( 3 * numVerts);
        let nextVertices = new Float32Array( 3 * numVerts);
        let prevVertices = new Float32Array( 3 * numVerts);
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
        for(let vertNum=0;vertNum<(this.points.length-1);vertNum +=1){ //not sure why this -3 is there. i guess it stops vertNum+3 two lines down from going somewhere it shouldn't?
            
            if(vertNum != this.points.length-1){
                //these triangles should be disabled when doing round joins
                if(this.lineJoinType == "BEVEL"){
                    indices.push( vertNum+1, vertNum,   vertNum+2);
                    indices.push( vertNum+1, vertNum+2, vertNum+3);
                }

                indices.push( vertNum+3, vertNum+2, vertNum+4);
                indices.push( vertNum+3, vertNum+4, vertNum+5);
            }
        }
        this._geometry.setIndex( indices );

        this.setAllVerticesToColor(this.color);

        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;
    }
    updatePointPosition(pointIndex, x,y,z){
        let xValue =  x === undefined ? 0 : x;
        let yValue =  y === undefined ? 0 : y;
        let zValue =  z === undefined ? 0 : z;

        this.saveVertexInfoInBuffers(this._vertices, pointIndex, xValue,yValue,zValue);

        let startingNewLine = pointIndex == 0;
        let endingNewLine = pointIndex == this.points.length-1;

        if(startingNewLine){
            //make the prevPoint be the same point as this
            this.saveVertexInfoInBuffers(this._prevPointVertices, pointIndex, xValue,yValue,zValue);
        }else{

            let prevX = this._vertices[(pointIndex-1)*3*4];
            let prevY = this._vertices[(pointIndex-1)*3*4+1];
            let prevZ = this._vertices[(pointIndex-1)*3*4+2];

            //set this thing's prevPoint to the previous vertex
            this.saveVertexInfoInBuffers(this._prevPointVertices, pointIndex, prevX,prevY,prevZ);

            //set the PREVIOUS point's nextPoint to to THIS vertex.
            this.saveVertexInfoInBuffers(this._nextPointVertices, pointIndex-1, xValue,yValue,zValue);
        }

        if(endingNewLine){
            //make the nextPoint be the same point as this
            this.saveVertexInfoInBuffers(this._nextPointVertices, pointIndex, xValue,yValue,zValue);
        }
    }
    saveVertexInfoInBuffers(array, vertNum, value1,value2,value3){
        //for every call to activate(), all 4 geometry vertices representing that point need to save that info.
        //Therefore, this function will spread three coordinates into a given array, repeatedly.

        let index = vertNum*3*4;

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
    updatePointAttributes(){
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
    }
    removeSelfFromScene(){
        getThreeEnvironment().scene.remove(this.mesh);
    }
    setAllVerticesToColor(color){
        const col = new THREE.Color(color);
        for(let i=0; i<this.points.length;i++){
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
        //color can be a THREE.Color(), or a function (i,t,x,y,z) => THREE.Color(), which will be called on every point.
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
    set points(points){

        let oldLength = this._points ? this._points.length : 0;
        this._points = points;

        if(points.length != oldLength){
            this.resizeBuffersForDifferentNumberOfPoints();
        }


        for(let i=0;i<points.length;i++){
            this.updatePointPosition(i,points[i][0],points[i][1],points[i][2]);
        }
        this.updatePointAttributes();
    }
    get points(){
        return this._points;
    }
}

export default LineMesh;
