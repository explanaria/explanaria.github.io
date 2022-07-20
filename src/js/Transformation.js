"use strict";

import Node from './Node.js';
import { Utils } from './utils.js';

//Usage: var y = new Transformation({expr: function(...a){console.log(...a)}});
class Transformation extends Node{
	constructor(options){
		super();
	
		Utils.assertPropExists(options, "expr"); // a function that returns a multidimensional array
		Utils.assertType(options.expr, Function);

		this.expr = options.expr;
	}
	evaluateSelf(...coordinates){
		//evaluate this Transformation's _expr, and broadcast the result to all children.
		let result = this.expr(...coordinates);
		if(result.constructor !== Array)result = [result];

		for(var i=0;i<this.children.length;i++){
			this.children[i].evaluateSelf(coordinates[0],coordinates[1], ...result)
		}
	}
	clone(){
		let thisExpr = this.expr;
		let clone = new Transformation({expr: thisExpr.bind()});
		for(var i=0;i<this.children.length;i++){
			clone.add(this.children[i].clone());
		}
		return clone;
	}
	makeLink(){
        //like a clone, but will use the same expr as this Transformation.
        //useful if there's a specific function that needs to be used by a bunch of objects
		return new LinkedTransformation(this);
	}
}

class LinkedTransformation extends Node{
    /*
        Like an EXP.Transformation, but it uses an existing EXP.Transformation's expr(), so if the linked transformation updates, so does this one. It's like a pointer to a Transformation, but in object form. 
    */
	constructor(transformationToLinkTo){
		super({});
		Utils.assertType(transformationToLinkTo, Transformation);
        this.linkedTransformationNode = transformationToLinkTo;
	}
	evaluateSelf(...coordinates){
		let result = this.linkedTransformationNode.expr(...coordinates);
		if(result.constructor !== Array)result = [result];

		for(var i=0;i<this.children.length;i++){
			this.children[i].evaluateSelf(coordinates[0],coordinates[1], ...result)
		}
	}
	clone(){
		let clone = new LinkedTransformation(this.linkedTransformationNode);
		for(var i=0;i<this.children.length;i++){
			clone.add(this.children[i].clone());
		}
		return clone;
	}
	makeLink(){
		return new LinkedTransformation(this.linkedTransformationNode);
	}
}





//testing code
function testTransformation(){
	var x = new Area({bounds: [[-10,10]]});
	var y = new Transformation({'expr': (x) => console.log(x*x)});
	x.add(y);
	x.activate(); // should return 100, 81, 64... 0, 1, 4... 100
}

export { Transformation, LinkedTransformation}
