var EXP = EXP || {};

//class that was planned to handle complex numbers. Isn't ready yet. Todo.

EXP.ComplexPoint = class ComplexPoint extends EXP.Point{
	//this class handles displaying its complex number.
	//
	constructor(re,im,options){
		if(options === undefined)options = {};
		if(re)options.x = re;
		if(im)options.y = im;
		super(options);

		this.value = new EXP.ComplexNumber(options.x,options.y);
	}
	_update(){
		this.mesh.position.x = this.value.x;
		this.mesh.position.y = this.value.y;
	}
}

EXP.ComplexPoint.prototype._materials = {};


EXP.ComplexNumber = class ComplexNumber{
	//class to represent a complex number and to do complex math on. Operations modify the vector, so use .clone() first.
	//same as THREE.Vector3()'s.
	constructor(x,y){
		this.x = x;
		this.y = y;
	}
	multiply(b){
		let y = this.y;
		let x = this.x;
		this.x = x*b.x - y*b.y;
		this.y = y*b.x + x*b.y;
		return this;
	}
	divide(b){
		this.x = (this.x*this.y+b.x*b.y) /(b.x*b.x+b.y*b.y);
		this.y = (this.y*b.x-this.x*b.y) /(b.x*b.x+b.y*b.y);
		return this;
	}
	add(b){
		this.x += b.x;
		this.y += b.y;
		return this;
	}
	sub(b){
		this.x -= b.x;
		this.y -= b.y;
		return this;
	}
	clone(){
		return new EXP.ComplexNumber(this.x,this.y);
	}
}
