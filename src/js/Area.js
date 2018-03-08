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

		this.itemDimensions = []; // array to store the number of times this is called per dimension.
		//right now, this is identical in each direction. todo: allow users to specify this.
		for(var i=0;i<this.numDimensions;i++){
			this.itemDimensions.push(this.numItems);
		}

		//the number of times every child's expr is called
		this.numCallsPerActivation = this.itemDimensions.reduce((sum,y)=>sum*y)

		this.children = [];
		this.parent = null;
	}
	add(thing){
		//todo: assert thing not in this.children
		this.children.push(thing);
		thing.parent = this;
		if(thing._onAdd)thing._onAdd();
		return thing;
	}
	activate(t){
		//Use this to evaluate expr() and update the result, cascade-style.
		//the number of bounds this object has will be the number of dimensions.
		//the expr()s are called with expr(i, ...[coordinates], t), 
		//	(where i is the index of the current evaluation = times expr() has been called this frame, t = absolute timestep (s)).
		//please call with a t value obtained from performance.now()/1000 or something like that

		//note the less-than-or-equal-to in these loops
		if(this.numDimensions == 1){
			for(var i=0;i<this.itemDimensions[0];i++){
				let c1 = this.bounds[0][0] + (this.bounds[0][1]-this.bounds[0][0])*(i/(this.itemDimensions[0]-1));
				let index = i;
				this._callAllChildren(index,t,c1,0,0,0);
			}
		}else if(this.numDimensions == 2){
			//this can be reduced into a fancy recursion technique over the first index of this.bounds, I know it
			for(var i=0;i<this.itemDimensions[0];i++){
				let c1 = this.bounds[0][0] + (this.bounds[0][1]-this.bounds[0][0])*(i/(this.itemDimensions[0]-1));
				for(var j=0;j<this.itemDimensions[1];j++){
					let c2 = this.bounds[1][0] + (this.bounds[1][1]-this.bounds[1][0])*(j/(this.itemDimensions[1]-1));
					let index = i*this.itemDimensions[1] + j;
					this._callAllChildren(index,t,c1,c2,0,0);
				}
			}
		}else{
			assert("TODO: Use a fancy recursion technique to loop over all indices!");
		}

		this.onAfterActivation(); // call children if necessary
	}
	onAfterActivation(){
		// do nothing

		//but call all children
		for(var i=0;i<this.children.length;i++){
			this.children[i].onAfterActivation()
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
