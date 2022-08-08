import * as THREE from "../../lib/three.module.js";
import {OutputNode} from '../Node.js';
import { Utils } from '../utils.js';
import { getThreeEnvironment } from '../ThreeEnvironment.js';
import {Earcut} from "../../lib/Earcut.js";

class ClosedPolygonOutput extends OutputNode{
    constructor(options = {}){
        super();
        /* 
        Interpret the points as the vertices of a 2D planar polygon. The polygon can be nonconvex, but ideally non-self-intersecting.

        Currently this means each vertex will have its position projected to the XY plane, with the Z component lost.
        Todo: support [0,x,y] and [x,0,y] and so on by dynamically computing the plane of best fit then projecting there


        Should be .add()ed to a Transformation to work.
            options:
            {
                opacity: number
                color: hex code or THREE.Color()
            }
        */

        this._opacity = options.opacity !== undefined ? options.opacity : 1;
        this._color = options.color || 0x0000ff;
        //todo: custom color function?

        this.numCallsPerActivation = 0; //should always be equal to this.points.length
        this.itemDimensions = []; // how many times to be called in each direction
        this._outputDimensions = 3; //how many dimensions per point to store?

        this.init();
    }
    init(){
        this._geometry = new THREE.BufferGeometry();
        this.makeGeometry();

        this.material = new THREE.MeshBasicMaterial({
            opacity: this._opacity,
            //color: this._color,
            side: THREE.DoubleSide,
            vertexColors: true,
        });

        this.mesh = new THREE.Mesh(this._geometry,this.material);

        this.opacity = this._opacity; // setter sets transparent flag if necessary
        this.color = this._color; //setter sets color attribute

        getThreeEnvironment().scene.add(this.mesh);
    }

    makeGeometry(){
        const MAX_POINTS = 1; //these arrays get discarded on first activation anyways
        this._vertices = new Float32Array(this._outputDimensions * MAX_POINTS);
        this._colors = new Float32Array(3 * MAX_POINTS);
        this._faceIndices = new Uint32Array(3 * MAX_POINTS);

        this._geometry.setAttribute( 'position', new THREE.BufferAttribute( this._vertices, this._outputDimensions ) );
        this._geometry.setAttribute( 'color', new THREE.BufferAttribute( this._colors, 3 ) );
        this._geometry.setIndex(new THREE.BufferAttribute( this._faceIndices, 1 ) );

        this._currentPointIndex = 0; //used during updates as a pointer to the buffer
        this._activatedOnce = false;

    }
    _onAdd(){
        //climb up parent hierarchy to find the Domain node we're rendering from
        let root = null;
        try{
           root = this.getClosestDomain(); //todo: implement something like assert root typeof RootNode
        }catch(error){
            console.warn(error);
            return;
        }

        this.numCallsPerActivation = root.numCallsPerActivation;
        this.itemDimensions = root.itemDimensions;
    }

    _onFirstActivation(){
        this._onAdd(); //setup this.numCallsPerActivation and this.itemDimensions. used here again because cloning means the onAdd() might be called before this is connected to a type of domain

        // perhaps instead of generating a whole new array, this can reuse the old one?

        const numVerts = this.numCallsPerActivation;

        
        this._vertices = new Float32Array( this._outputDimensions * numVerts);
        let positionAttribute = new THREE.BufferAttribute( this._vertices, this._outputDimensions );
        this._geometry.deleteAttribute('position');
        this._geometry.setAttribute('position', positionAttribute);

        this._colors = new Float32Array( 3 * numVerts);
        let colorAttribute = new THREE.BufferAttribute( this._colors, 3 );
        this._geometry.deleteAttribute('color');
        this._geometry.setAttribute('color', colorAttribute);

        this._faceIndices = new Uint32Array( 3 * numVerts); //at most one face per vertex.
        //is this enough? probably?? todo: do the math and see whether a polygon with n vertices can have n faces. It can definitely have at least n-2 cases (n-gon). I think no but I haven't checked
        let faceAttribute = new THREE.BufferAttribute( this._faceIndices, 1 )
        this._geometry.setIndex(faceAttribute);

        this._projected2DCoords = new Float32Array( 2 * numVerts);

        this.triangulateAndGenerateFaces();
        faceAttribute.needsUpdate = true;
        this.setAllVerticesToColor(this.color);
    }

    computeBestFitPlane(){

    //from https://www.ilikebigbits.com/2017_09_25_plane_from_points_2.html
    }

    projectTo2DPlane(x,y,z){
        //throwing away z. todo: actually do a smart, dynamic projection. and not do that
        return [x,y]
    }

    triangulateAndGenerateFaces(){

        // this._vertices is an array where every 3 numbers represent an (x,y,z) triplet.
        // we want to interpret these points as the boundaries of a convex polygon.
        // if they spell out a nonconvex polygon, we need to figure out how to trianguate it properly

        //code adapted from three.js/src/extras/ShapeUtils.js

        //project our polygon with vertices in 3D space to a 2D plane, so we can triangulate a 2D polygon
        const numVerts = this.numCallsPerActivation;
        for(let i=0;i<numVerts;i++){

            const x = this._vertices[i*this._outputDimensions];
            const y = this._vertices[i*this._outputDimensions+1];
            const z = this._vertices[i*this._outputDimensions+2];

            const [projectedX, projectedY] = this.projectTo2DPlane(x,y,z);
    
            this._projected2DCoords[i*2] = projectedX;
            this._projected2DCoords[i*2+1] = projectedY;
        }

        const holeIndices = [];
		const triangles = Earcut.triangulate( this._projected2DCoords, holeIndices );

        //this could error if there are more 3*triangles than there are spots in faceIndices
		for ( let i = 0; i < triangles.length; i += 3 ) {
            this._faceIndices[i] = triangles[i];
            this._faceIndices[i+1] = triangles[i+1];
            this._faceIndices[i+2] = triangles[i+2];
		}

    }
    evaluateSelf(i, t, x, y, z, ...otherArgs){
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
        this._currentPointIndex++;
    }
    saveVertexInfoInBuffers(array, index, value1,value2,value3){
        array[index*this._outputDimensions]   = value1
        array[index*this._outputDimensions+1] = value2
        array[index*this._outputDimensions+2] = value3
    }
    onAfterActivation(){
        let positionAttribute = this._geometry.attributes.position;
        positionAttribute.needsUpdate = true;

        this.triangulateAndGenerateFaces();

        let indexAttribute = this._geometry.index;
        indexAttribute.needsUpdate = true;

        this._geometry.computeBoundingSphere(); //unsure if needed

        this._currentPointIndex = 0; //reset after each update
    }
    removeSelfFromScene(){
        getThreeEnvironment().scene.remove(this.mesh);
    }
    setAllVerticesToColor(color){
        const col = new THREE.Color(color);
        const numVertices = this.numCallsPerActivation;
        for(let i=0; i<numVertices;i++){
            //Don't forget some points appear twice - as the end of one line segment and the beginning of the next.
            this._setColorForVertexRGB(i, col.r, col.g, col.b);
        }
        //tell three.js to update colors
        let colorAttribute = this._geometry.attributes.color;
        colorAttribute.needsUpdate = true;
    }
    _setColorForVertexRGB(vertexIndex, normalizedR, normalizedG, normalizedB){
        //color is a THREE.Color here
        let colorArray = this._geometry.attributes.color.array;
        let index = vertexIndex * 3; //*3 because colors have 3 channels
        colorArray[index + 0] = normalizedR;
        colorArray[index + 1] = normalizedG;
        colorArray[index + 2] = normalizedB;

        //NOTE: colorAttribute.needsUpdate must be set to true after this or else the colors won't show up!
    }
    set color(color){
        //color can be a THREE.Color()
        this._color = color;
        this.setAllVerticesToColor(color);
    }
    get color(){
        return this._color;
    }
    set opacity(opacity){
        //mesh is always transparent
        this.material.opacity = opacity;
        this.material.transparent = opacity < 1;
        this.material.visible = opacity > 0;
        this._opacity = opacity;
    }
    get opacity(){
        return this._opacity;
    }
    clone(){
        return new ClosedPolygonOutput({color: this.color, opacity: this.opacity});
    }
}

export {ClosedPolygonOutput};
