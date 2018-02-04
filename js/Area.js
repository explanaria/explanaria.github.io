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
		const this.numCallsPerActivation = this.numItems * this.numDimensions;

		this.children = [];
	}
	add(thing){
		//todo: assert thing not in this.children
		this.children.push(thing);
	}
	activate(){
		if(this.numDimensions == 1){
			for(var i=0;i<this.numItems;i++){
				let c1 = this.bounds[0][0] + (this.bounds[0][1]-this.bounds[0][0])*(i/this.numItems);
				this._callAllChildren(c1);
			}
		}else if(this.numDimensions == 2){
			//this can be reduced into a fancy recursion technique over the first index of this.bounds, I know it
			for(var i=0;i<this.numItems;i++){
				for(var j=0;j<this.numItems;j++){
					let c1 = this.bounds[0][0] + (this.bounds[0][1]-this.bounds[0][0])*(i/this.numItems);
					let c2 = this.bounds[1][0] + (this.bounds[1][1]-this.bounds[1][0])*(j/this.numItems);
					this._callAllChildren(c1,c2);
				}
			}
		}else{
			assert("TODO: Use a fancy recursion technique to loop over all indices!");
		}
	}
	_callAllChildren(...coordinates){
		for(var i=0;i<this.children.length;i++){
			this.children[i].expr(...coordinates)
		}
	}

}




//testing code
function testArea(){
	var x = new Area({bounds: [[0,1],[0,1]]});
	var y = {expr: function(...a){console.log(...a)}};
	x.add(y);
	x.activate();
}
