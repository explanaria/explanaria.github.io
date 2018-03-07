var EXP = EXP || {};

EXP.PointOutput = class PointOutput{
	constructor(options = {}){
		/*input: Transformation
			width: number
		*/

		this.width = options.width !== undefined ? options.width : 1;
		this._color = options.color !== undefined ? options.color : 0x55aa55;


		this.points = [];

		this.numCallsPerActivation = 0; //should always be equal to this.points.length

		this.parent = null;
		this._opacity = 1;
	}
	_onAdd(){ //should be called when this is .add()ed to something

		//climb up parent hierarchy to find the Area
		let root = this;
		while(root.parent !== null){
			root = root.parent;
		}

		this.numCallsPerActivation = root.numCallsPerActivation;

		for(var i=0;i<this.numCallsPerActivation;i++){
			this.getPoint(i).mesh.visible = false; //instantiate the point
		}
	}
	evaluateSelf(i, t, x, y, z){
		//it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.
		var point = this.getPoint(i);
		if(x !== undefined)point.x = x;
		if(y !== undefined)point.y = y;
		if(z !== undefined)point.z = z;
		point.mesh.visible = true;
	}
	onAfterActivation(){

	}
	getPoint(i){
		if(i >= this.points.length){
			this.points.push(new EXP.Point({width: this.width,color:this._color}));
		}
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
