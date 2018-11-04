"use strict";

import { DomainNode } from './Node.js';

//Class that records the last few values of the parent Transformation and makes them available for use as an extra dimension.\
//It is assumed that the parent is a Transformation or Array that only returns a single number, not an array of numbers.
class HistoryRecorder extends DomainNode{
	constructor(options){
		super();

		this.memoryLength = options.memoryLength === undefined ? 10 : options.memoryLength;
        this._outputDimensions = 4; //how many dimensions per point to store? (todo: autodetect this from parent's output)
		this.currentHistoryIndex=0;
	}
	_onAdd(){
		//climb up parent hierarchy to find the Area
		let root = this.getClosestDomain();
	
		//todo: implement something like assert root typeof RootNode

		this.numCallsPerActivation = root.numCallsPerActivation * this.memoryLength;
		this.itemDimensions = root.itemDimensions.concat([this.memoryLength]);

        this.buffer = new Float32Array(this.numCallsPerActivation * this._outputDimensions);
	}
    onAfterActivation(){
        this.currentHistoryIndex = (this.currentHistoryIndex+1)%this.memoryLength;
        super.onAfterActivation();
    }
	evaluateSelf(...coordinates){
		//evaluate this Transformation's _expr, and broadcast the result to all children.
		let i = coordinates[0];
		let t = coordinates[1];
    
        //step 1: save coordinates for this frame in buffer
        if(coordinates.length > 2+this._outputDimensions){
            //todo: make this update this._outputDimensions and reallocate more buffer space
            throw new Error("EXP.HistoryRecorder is unable to record history of something that outputs in "+this._outputDimensions+" dimensions! Yet.");
        }

        for(var j=0;j<coordinates.length-2;j++){ 
            this.buffer[(i*this.memoryLength+this.currentHistoryIndex)*this._outputDimensions+j] = coordinates[2+j];
        }

        //step 2:, call any children once per history item
        for(var childNo=0;childNo<this.children.length;childNo++){
		    for(var j=0;j<this.memoryLength;j++){
		        //should I not have the ,j) buffer-history index at the end? 
                let cyclicHistoryValue = (j + this.currentHistoryIndex) % this.memoryLength;
                let cyclicBufferIndex = (i * this.memoryLength + cyclicHistoryValue)*this._outputDimensions;
                let nonCyclicIndex = i * this.memoryLength + j;

                //this.children[childNo].evaluateSelf(nonCyclicIndex,t,this.buffer[cyclicBufferIndex], cyclicHistoryValue);
                this.children[childNo].evaluateSelf(
                        nonCyclicIndex,t, //i,t
                        ...this.buffer.slice(cyclicBufferIndex,cyclicBufferIndex+this._outputDimensions) //extract coordinates for this history value from buffer
                    );
            }
        }
	}
	//clone(){ //todo
	//}
}




//testing code
//todo: write
// a = (i,t) => [cos t, sin t]
// b = new historyrecordrt
// .add surfaceiutput
// verify helix

export { HistoryRecorder }
