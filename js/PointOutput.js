class PointOutput{
	constructor(options = {}){
		/*input: Transformation
			width: number
		*/

		this.width = options.width || 1;
		this.color = options.color || 0x55aa55;


		this.points = [];

		this.numCallsPerActivation = 0; //should always be equal to this.points.length

		this.parent = null;
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
	expr(i, t, x, y, z){
		//it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.
		var point = this.getPoint(i);
		if(x)point.x = x;
		if(y)point.y = y;
		if(z)point.z = z;
		point.mesh.visible = true;
	}
	getPoint(i){
		if(i >= this.points.length){
			this.points.push(new Point({width: this.width,color:this.color}));
		}
		return this.points[i];
	}
}

/*
Problem now:
	PointOutput needs to know how many Point()s to make so it can call each one sequentially. Also, how does it know when a rendering loop starts and stops?

	I suppose that means it needs to connect to the original Area and read its numItems, and use numItems * numDimensions.

	Reading the mathbox articles, it looks like mathbox solved this problem by declaring a width variable equal to that thing, and then secretly having emit() control one big floating point array. That gets you speed, as arrays can be GPU-offloaded.

I guess the big thing I want from mathbox is to error when a thing with three channels is sent to a vector. Is this time for joy.js? I think so.

-
There are 3 things that need to be defined for any visualization to work: domain, transformation, and range/output. However, the output needs to know how many times the transformation will be evaluated, to know about its result, and that's the job of the domain. So a domain needs to connect to a range somehow. timesCombining the domain and the transformation, like mathbox does.

*/



//testing code
function testPoint(){
	var x = new Area({bounds: [[-10,10]]});
	var y = new Transformation({'expr': (x) => x*x});
	var y = new PointOutput();
	x.add(y);
	y.add(z);
	x.activate();
}
