"use strict";
var EXP = EXP || {};

//really this should extend Area, or some superclass of both
EXP.Array = class EXPArray{
	constructor(options){
		/*var points = new EXP.Array({
		data: [[-10,10],
			[10,10]]
		})*/

		EXP.Utils.assertPropExists(options, "data"); // a multidimensional array
		EXP.Utils.assertType(options.data, Array);

		if(options.data[0].constructor === Number){
			this.numDimensions = 1;
		}else if(options.data[0].constructor === Array){
			this.numDimensions = options.data[0].length;
		}else{
			console.error("Data in an EXP.Array should be a number or an array of other things, not " + options.data[0].constructor);
		}


		EXP.Utils.assert(options.data[0].length != 0); //don't accept [[]], data needs to be something like [[1,2]].

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
		if(	this.numDimensions == 1){
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
