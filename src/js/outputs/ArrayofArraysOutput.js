import * as THREE from "../../lib/three.module.js";
import {OutputNode} from '../Node.js';

class ArrayofArraysOutput extends OutputNode{
    //an output which fills an array with one array per point recieved
    //It'll register [0,1,2],[3,4,5] as [[0,1,2],[3,4,5]].
	constructor(options = {}){
		super();
		/*
			array (optional): an existing array, which will then be modified in place every time this output is activated
		*/

		this.array = options.array;
	}
	_onAdd(){ //should be called when this is .add()ed to something
		//climb up parent hierarchy to find the Area
		let root = this.getClosestDomain();

		this.numCallsPerActivation = root.numCallsPerActivation;
        if(this.array === undefined)this.array = new Array(this.numCallsPerActivation);
        for(let i=0; i<this.numCallsPerActivation;i++){
            this.array[i] = []
        }
	}
	evaluateSelf(i, t, ...coords){
        for(var j=0;j<coords.length;j++){ 
            //The spread operator constructs a new array each time this is evaluated.
            //that means if the length of coords shrinks, I won't need to worry about that ever.
            this.array[i] = coords;
        }
	}
	clone(){
		return new ArrayofArraysOutput({array: EXP.Math.clone(this.array)});
	}
}

export {ArrayofArraysOutput};
