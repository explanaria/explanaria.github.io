"use strict";
var EXP = EXP || {};

//really this should extend Area, or some superclass of both
EXP.Array = class Array{
	constructor(options){
		/*var points = new EXP.Array({
		data: [[-10,10],
			[10,10]]
		})*/

		assertPropExists(options, "data"); // a multidimensional array
		assertType(options.data, Array);
		this.numDimensions = options.data[0].length;

		assert(options.data[0].length != 0); //don't accept [[]], it needs to be [[1,2]].

		this.data = options.data;

		this.numItems = this.data.length;

		this.itemDimensions = []; // array to store the number of times this is called per dimension.
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
		for(var i=0;i<this.data.length;i++){
			this._callAllChildren(i,t,...this.data[i]);
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
function testArray(){
	var x = new EXP.Array({data: [[0,1],[0,1]]});
	var y = new Transformation({expr: function(...a){console.log(...a); return [2]}});
	x.add(y);
	x.activate(512);
}
