"use strict";

//Usage: var y = new Transformation({expr: function(...a){console.log(...a)}});
var EXP = EXP || {};

EXP.Transformation = class Transformation{
	constructor(options){
	
		EXP.Utils.assertPropExists(options, "expr"); // a function that returns a multidimensional array
		EXP.Utils.assertType(options.expr, Function);

		this.expr = options.expr;

		this.children = [];
		this.parent = null;
	}
	add(thing){
		//chainable.
		this.children.push(thing);
		thing.parent = this;
		if(thing._onAdd)thing._onAdd();
		return thing;
	}
	evaluateSelf(...coordinates){
		//evaluate this Transformation's _expr, and broadcast the result to all children.
		let result = this.expr(...coordinates);
		if(result.constructor !== Array)result = [result];

		for(var i=0;i<this.children.length;i++){
			this.children[i].evaluateSelf(coordinates[0],coordinates[1], ...result)
		}
	}
	onAfterActivation(){
		// do nothing

		//but call all children
		for(var i=0;i<this.children.length;i++){
			this.children[i].onAfterActivation()
		}
	}
	clone(){
		let thisExpr = this.expr;
		let clone = new EXP.Transformation({expr: thisExpr.bind()});
		for(var i=0;i<this.children.length;i++){
			clone.add(this.children[i].clone());
		}
		return clone;
	}
}




//testing code
function testTransformation(){
	var x = new EXP.Area({bounds: [[-10,10]]});
	var y = new EXP.Transformation({'expr': (x) => console.log(x*x)});
	x.add(y);
	x.activate();
}
