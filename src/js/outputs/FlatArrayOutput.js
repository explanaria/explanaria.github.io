import {OutputNode} from '../Node.js';

class FlatArrayOutput extends OutputNode{
    //an output which fills an array with every coordinate recieved, in order.
    //It'll register [0,1,2],[3,4,5] as [0,1,2,3,4,5].
	constructor(options = {}){
		super();
		/*
			array: an existing array, which will then be modified in place every time this output is activated
		*/

		this.array = options.array;
        this._currentArrayIndex = 0;
	}
	evaluateSelf(i, t, ...coords){
        for(var j=0;j<coords.length;j++){ 
            //I don't need to worry about out-of-bounds entries because javascript automatically grows arrays if a new index is set.
            //Javascript may have some garbage design choices, but I'll claim that garbage for my own nefarious advantage.
            this.array[this._currentArrayIndex] = coords[j]
            this._currentArrayIndex++;
        }
	}
	onAfterActivation(){
        this._currentArrayIndex = 0;
	}
	clone(){
		return new FlatArrayOutput({array: EXP.Math.clone(this.array)});
	}
}

export {FlatArrayOutput};
