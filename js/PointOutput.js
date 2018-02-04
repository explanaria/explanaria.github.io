class PointOutput{
	constructor(options){
		/*input: Transformation
			width: number
		*/

		this.width = options.width || 1;

		this.points = [];
	}
	expr(x,y,z){
		let point = this.getPoint(i);
		point.x = x;
		point.y = y;
		point.z = z;
	}
	getPoint(i){
		if(i > this.points.length){
			this.points.push(new Point({width: this.width});
		}
	}
}

Point.prototype._points = {};


/*
Problem now:
	PointOutput needs to know how many Point()s to make so it can call each one sequentially. Also, how does it know when a rendering loop starts and stops?

	I suppose that means it needs to connect to the original Area and read its numItems, and use numItems * numDimensions.

	Reading the mathbox articles, it looks like mathbox solved this problem by declaring a width variable equal to that thing, and then secretly having emit() control one big floating point array. That gets you speed, as arrays can be GPU-offloaded.

I guess the big thing I want from mathbox is to error when a thing with three channels is sent to a vector. Is this time for joy.js? I think so.

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
