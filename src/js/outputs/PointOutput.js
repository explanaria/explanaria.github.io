import Point from './Point.js';
import {OutputNode} from '../Node.js';

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

		this.numCallsPerActivation = 0; //should always be equal to this.points.length
		this._activatedOnce = false;
	}
	_onAdd(){ //should be called when this is .add()ed to something
		//climb up parent hierarchy to find the Area
		let root = this.getTopParent();

		this.numCallsPerActivation = root.numCallsPerActivation;

		if(this.points.length < this.numCallsPerActivation){
			for(var i=this.points.length;i<this.numCallsPerActivation;i++){
				this.points.push(new Point({width: 1,color:this._color, opacity:this._opacity}));
				this.points[i].mesh.scale.setScalar(this._width); //set width by scaling point
				this.points[i].mesh.visible = false; //instantiate the point
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
		if(x !== undefined)point.x = x;
		if(y !== undefined)point.y = y;
		if(z !== undefined)point.z = z;
		point.mesh.visible = true;
	}
	getPoint(i){
		return this.points[i];
	}
	set opacity(opacity){
		//technically this will set all points of the same color, and it'll be wiped with a color change. But I'll deal with that sometime later.
		for(var i=0;i<this.numCallsPerActivation;i++){
			let mat = this.getPoint(i).mesh.material;
			mat.opacity = opacity; //instantiate the point
			mat.transparent = opacity < 1;
		}
		this._opacity = opacity;
	}
	get opacity(){
		return this._opacity;
	}
	set color(color){
		for(var i=0;i<this.points.length;i++){
			this.getPoint(i).color = color;
		}
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

//testing code
function testPoint(){
	var x = new EXP.Area({bounds: [[-10,10]]});
	var y = new EXP.Transformation({'expr': (x) => x*x});
	var y = new EXP.PointOutput();
	x.add(y);
	y.add(z);
	x.activate();
}

export {PointOutput}
