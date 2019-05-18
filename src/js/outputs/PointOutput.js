import {OutputNode} from '../Node.js';
import { threeEnvironment } from '../ThreeEnvironment.js';

class PointOutput extends OutputNode{
	constructor(options = {}){
		super();
		/*
			width: number
			color: hex color, as in 0xrrggbb. Technically, this is a JS integer.
			opacity: 0-1. Optional.
		*/

		this._width = options.width !== undefined ? options.width : 1;
		this._color = options.color !== undefined ? options.color : 0x55aa55;
		this._opacity = options.opacity !== undefined ? options.opacity : 1;

		this.points = [];

        this.material = new THREE.MeshBasicMaterial({color: this._color});
        this.opacity = this._opacity; //trigger setter to set this.material's opacity properly

		this.numCallsPerActivation = 0; //should always be equal to this.points.length
		this._activatedOnce = false;
	}
	_onAdd(){ //should be called when this is .add()ed to something
		//climb up parent hierarchy to find the Area
		let root = this.getClosestDomain();

		this.numCallsPerActivation = root.numCallsPerActivation;

		if(this.points.length < this.numCallsPerActivation){
			for(var i=this.points.length;i<this.numCallsPerActivation;i++){
				this.points.push(new PointMesh({width: 1,material:this.material}));
				this.points[i].mesh.scale.setScalar(this._width); //set width by scaling point
			}
		}
	}
	_onFirstActivation(){
		if(this.points.length < this.numCallsPerActivation)this._onAdd();
	}
	evaluateSelf(i, t, x, y, z){
		if(!this._activatedOnce){
			this._activatedOnce = true;
			this._onFirstActivation();	
		}
		//it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.
		var point = this.getPoint(i);
		point.x = x === undefined ? 0 : x;
		point.y = y === undefined ? 0 : y;
		point.z = z === undefined ? 0 : z;
	}
	getPoint(i){
		return this.points[i];
	}
    removeSelfFromScene(){
		for(var i=0;i<this.points.length;i++){
			this.points[i].removeSelfFromScene();
		}
    }
	set opacity(opacity){
		//technically this sets all points to the same color. Todo: allow different points to be differently colored.
		
		let mat = this.material;
		mat.opacity = opacity; //instantiate the point
		mat.transparent = opacity < 1;
        mat.visible = opacity > 0;
		this._opacity = opacity;
	}
	get opacity(){
		return this._opacity;
	}
	set color(color){
        this.material.color = color;
		this._color = color;
	}
	get color(){
		return this._color;
	}
	set width(width){
		for(var i=0;i<this.points.length;i++){
			this.getPoint(i).mesh.scale.setScalar(width);
		}
		this._width = width;
	}
	get width(){
		return this._width;
	}
	clone(){
		return new PointOutput({width: this.width, color: this.color, opacity: this.opacity});
	}
}


class PointMesh{
	constructor(options){
		/*options:
			x,y: numbers
			width: number
            material: 
		*/

		let width = options.width === undefined ? 1 : options.width
        this.material = options.material; //one material per PointOutput

		this.mesh = new THREE.Mesh(this.sharedCircleGeometry,this.material);

		this.mesh.position.set(this.x,this.y,this.z);
		this.mesh.scale.setScalar(this.width/2);
		threeEnvironment.scene.add(this.mesh);

		this.x = options.x || 0;
		this.y = options.y || 0;
		this.z = options.z || 0;
	}
	removeSelfFromScene(){
		threeEnvironment.scene.remove(this.mesh);
	}
	set x(i){
		this.mesh.position.x = i;
	}
	set y(i){
		this.mesh.position.y = i;
	}
	set z(i){
		this.mesh.position.z = i;
	}
	get x(){
		return this.mesh.position.x;
	}
	get y(){
		return this.mesh.position.y;
	}
	get z(){
		return this.mesh.position.z;
	}
}
PointMesh.prototype.sharedCircleGeometry = new THREE.SphereGeometry(1/2, 8, 6); //radius 1/2 makes diameter 1, so that scaling by n means width=n

//testing code
function testPoint(){
	var x = new EXP.Area({bounds: [[-10,10]]});
	var y = new EXP.Transformation({'expr': (x) => x*x});
	var y = new EXP.PointOutput();
	x.add(y);
	y.add(z);
	x.activate();
}

export {PointOutput, PointMesh}
