"use strict";

class Area{
	constructor(options){

		/*var axes = new THINGNAME.Area({
		bounds: [[-10,10],
			[10,10]]
		numItems: 10; //optional
		})*/


	
		assertPropExists(options, "bounds"); // a multidimensional array
		assertType(options.bounds, Array);
		this.numDimensions = options.bounds.length;

		assert(options.bounds[0].length != 0); //don't accept [[]], it needs to be [[1,2]].

		this.bounds = options.bounds;

		this.numItems = options.numItems || 16;

		//the number of times every child's expr should always be this.numItems * this.numDimensions.
		this.numCallsPerActivation = this.numItems * this.numDimensions;

		this.children = [];
		this.parent = null;
	}
	add(thing){
		//todo: assert thing not in this.children
		this.children.push(thing);
		thing.parent = this;
		if(thing._onAdd)thing._onAdd();
	}
	activate(t){
		//Use this to evaluate expr() and update the result, cascade-style.
		//the number of bounds this object has will be the number of dimensions.
		//the expr()s are called with expr(i, ...[coordinates], t), 
		//	(where i is the index of the current evaluation = times expr() has been called this frame, t = absolute timestep (s)).
		//please call with a t value obtained from performance.now()/1000 or something like that
		if(this.numDimensions == 1){
			for(var i=0;i<this.numItems;i++){
				let c1 = this.bounds[0][0] + (this.bounds[0][1]-this.bounds[0][0])*(i/this.numItems);
				let index = i;
				this._callAllChildren(index,t,c1);
			}
		}else if(this.numDimensions == 2){
			//this can be reduced into a fancy recursion technique over the first index of this.bounds, I know it
			for(var i=0;i<this.numItems;i++){
				for(var j=0;j<this.numItems;j++){
					let c1 = this.bounds[0][0] + (this.bounds[0][1]-this.bounds[0][0])*(i/this.numItems);
					let c2 = this.bounds[1][0] + (this.bounds[1][1]-this.bounds[1][0])*(j/this.numItems);
					let index = i*this.numItems + j;
					this._callAllChildren(index,t,c1,c2);
				}
			}
		}else{
			assert("TODO: Use a fancy recursion technique to loop over all indices!");
		}
	}
	_callAllChildren(...coordinates){
		for(var i=0;i<this.children.length;i++){
			this.children[i].evaluateSelf(...coordinates)
		}
	}

}




//testing code
function testArea(){
	var x = new Area({bounds: [[0,1],[0,1]]});
	var y = new Transformation({expr: function(...a){console.log(...a)}});
	x.add(y);
	x.activate();
}
