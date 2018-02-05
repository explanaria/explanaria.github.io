"use strict";

//var y = new Transformation({expr: function(...a){console.log(...a)}});

class Transformation{
	constructor(options){
	
		assertPropExists(options, "expr"); // a multidimensional array
		assertType(options.expr, Function);

		this._expr = options.expr;

		this.children = [];
		this.parent = null;
	}
	add(thing){
		this.children.push(thing);
		thing.parent = this;
		if(thing._onAdd)thing._onAdd();
	}
	expr(...coordinates){
		let result = this._expr(...coordinates);;
		if(result.constructor !== Array)result = [result];

		for(var i=0;i<this.children.length;i++){
			this.children[i].expr(coordinates[0],coordinates[1], ...result)
		}
	}
}




//testing code
function testTransformation(){
	var x = new Area({bounds: [[-10,10]]});
	var y = new Transformation({'expr': (x) => console.log(x*x)});
	x.add(y);
	x.activate();
}
