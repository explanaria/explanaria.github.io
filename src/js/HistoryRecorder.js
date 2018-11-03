"use strict";

import Node from './Node.js';

//Class that records the last few values of the parent Transformation and makes them available for use as an extra dimension.
class HistoryRecorder extends Node{
	constructor(options){
		super();
	
		EXP.Utils.assertPropExists(options, "memoryLength"); // a 
function that returns a multidimensional array

		this.memoryLength = options.memoryLength;
		this.currentHistoryIndex=0;

		this.children = [];
		this.parent = null;
	}
	evaluateSelf(...coordinates){
		//evaluate this Transformation's _expr, and broadcast the result to all children.
		let i = coordinates[0]
		let t = coordinates[1]

		// save all other coordinates in buffed
		if(result.constructor !== Array)result = [result];

		for(var i=0;i<this.children.length;i++){
			for j in range this.memorylength){
			
this.children[i].evaluateSelf(buffer[0...numDims], this.currentHistoryIndex)
		
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
		let clone = new Transformation({expr: thisExpr.bind()});
		for(var i=0;i<this.children.length;i++){
			clone.add(this.children[i].clone());
		}
		return clone;
	}
}




//testing code
//todo: write
// a = (i,t) => [cos t, sin t]
// b = new historyrecordrt
// .add surfaceiutput
// verify helix

export { HistoryRecorder }
