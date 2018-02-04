"use strict";


class Transformation{
	constructor(options){
	
		assertPropExists(options, "expr"); // a multidimensional array
		assertType(options.expr, Function);

		this._expr = options.expr;

		this.children = [];
	}
	add(thing){
		this.children.push(thing);
	}
	expr(...coordinates){
		let result = this._expr(...coordinates);
		for(var i=0;i<this.children.length;i++){
			this.children[i].expr(...result)
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
