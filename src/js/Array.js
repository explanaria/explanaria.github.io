"use strict";

import { DomainNode }  from './Node.js';
class EXPArray extends DomainNode{
	constructor(options){
		super();
		/*var points = new EXP.Array({
		data: [[-10,10],
			[10,10]]
		})*/

		EXP.Utils.assertPropExists(options, "data"); // a multidimensional array. assumed to only contain one type: either numbers or arrays
		EXP.Utils.assertType(options.data, Array);

		//It's assumed an EXP.Array will only store things such as 0, [0], [0,0] or [0,0,0]. If an array type is stored, this.arrayTypeDimensions contains the .length of that array. Otherwise it's 0, because points are 0-dimensional.
		if(options.data[0].constructor === Number){
			this.arrayTypeDimensions = 0;
		}else if(options.data[0].constructor === Array){
			this.arrayTypeDimensions = options.data[0].length;
		}else{
			console.error("Data in an EXP.Array should be a number or an array of other things, not " + options.data[0].constructor);
		}


		EXP.Utils.assert(options.data[0].length != 0); //don't accept [[]], data needs to be something like [[1,2]].

		this.data = options.data;
		this.numItems = this.data.length;

		this.itemDimensions = [this.data.length]; // array to store the number of times this is called per dimension.

		//the number of times every child's expr is called
		this.numCallsPerActivation = this.itemDimensions.reduce((sum,y)=>sum*y);
	}
	activate(t){
		if(this.arrayTypeDimensions == 0){
			//numbers can't be spread using ... operator
			for(var i=0;i<this.data.length;i++){
				this._callAllChildren(i,t,this.data[i]);
			}
		}else{
			for(var i=0;i<this.data.length;i++){
				this._callAllChildren(i,t,...this.data[i]);
			}
		}

		this.onAfterActivation(); // call children if necessary
	}
	_callAllChildren(...coordinates){
		for(var i=0;i<this.children.length;i++){
			this.children[i].evaluateSelf(...coordinates)
		}
	}
	clone(){
		let clone = new EXP.Array({data: EXP.Utils.arrayCopy(this.data)});
		for(var i=0;i<this.children.length;i++){
			clone.add(this.children[i].clone());
		}
		return clone;
	}
}


//testing code
function testArray(){
	var x = new EXP.Array({data: [[0,1],[0,1]]});
	var y = new EXP.Transformation({expr: function(...a){console.log(...a); return [2]}});
	x.add(y);
	x.activate(512);
}

export {EXPArray as Array};
