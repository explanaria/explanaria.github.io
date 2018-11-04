"use strict";

import { Utils } from './utils.js';
import { DomainNode } from './Node.js';

class Area extends DomainNode{
	constructor(options){
		super();

		/*var axes = new EXP.Area({
		bounds: [[-10,10],
			[10,10]]
		numItems: 10; //optional. Alternately numItems can vary for each axis: numItems: [10,2]
		})*/


	
		Utils.assertPropExists(options, "bounds"); // a multidimensional array
		Utils.assertType(options.bounds, Array);
		Utils.assertType(options.bounds[0], Array, "For an Area, options.bounds must be a multidimensional array, even for one dimension!"); // it MUST be multidimensional
		this.numDimensions = options.bounds.length;

		Utils.assert(options.bounds[0].length != 0); //don't accept [[]], it needs to be [[1,2]].

		this.bounds = options.bounds;
		this.numItems = options.numItems || 16;

		this.itemDimensions = []; // array to store the number of times this is called per dimension.

		if(this.numItems.constructor === Number){
			for(var i=0;i<this.numDimensions;i++){
				this.itemDimensions.push(this.numItems);
			}
		}else if(this.numItems.constructor === Array){
			Utils.assert(options.numItems.length == options.bounds.length);
			for(var i=0;i<this.numDimensions;i++){
				this.itemDimensions.push(this.numItems[i]);
			}
		}

		//the number of times every child's expr is called
		this.numCallsPerActivation = this.itemDimensions.reduce((sum,y)=>sum*y);
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
		}else if(this.numDimensions == 3){
			//this can be reduced into a fancy recursion technique over the first index of this.bounds, I know it
			for(var i=0;i<this.itemDimensions[0];i++){
				let c1 = this.bounds[0][0] + (this.bounds[0][1]-this.bounds[0][0])*(i/(this.itemDimensions[0]-1));
				for(var j=0;j<this.itemDimensions[1];j++){
					let c2 = this.bounds[1][0] + (this.bounds[1][1]-this.bounds[1][0])*(j/(this.itemDimensions[1]-1));
					for(var k=0;k<this.itemDimensions[2];k++){
						let c3 = this.bounds[2][0] + (this.bounds[2][1]-this.bounds[2][0])*(k/(this.itemDimensions[2]-1));
						let index = (i*this.itemDimensions[1] + j)*this.itemDimensions[2] + k;
						this._callAllChildren(index,t,c1,c2,c3,0);
					}
				}
			}
		}else{
			assert("TODO: Use a fancy recursion technique to loop over all indices!");
		}

		this.onAfterActivation(); // call children if necessary
	}
	_callAllChildren(...coordinates){
		for(var i=0;i<this.children.length;i++){
			this.children[i].evaluateSelf(...coordinates)
		}
	}
	clone(){
		let clone = new Area({bounds: Utils.arrayCopy(this.bounds), numItems: this.numItems});
		for(var i=0;i<this.children.length;i++){
			clone.add(this.children[i].clone());
			if(clone.children[i]._onAdd)clone.children[i]._onAdd(); // necessary now that the chain of adding has been established
		}
		return clone;
	}
}


//testing code
function testArea(){
	var x = new Area({bounds: [[0,1],[0,1]]});
	var y = new Transformation({expr: function(...a){console.log(...a)}});
	x.add(y);
	x.activate();
}

export { Area }
