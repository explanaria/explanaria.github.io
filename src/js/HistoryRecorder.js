"use strict";

import { DomainNode } from './Node.js';

class HistoryRecorder extends DomainNode{
	constructor(options){
		super();

        /*
            Class that records the last few values of the parent Transformation and makes them available for use as an extra dimension.
            Usage:
            var recorder = new HistoryRecorder({
                memoryLength: 10 // how many past values to store?
                recordFrameInterval: 15//How long to wait between each capture? Measured in frames, so 60 = 1 capture per second, 30 = 2 captures/second, etc.
            });

            example usage:
            new Area({bounds: [[-5,5]]}).add(new Transformation({expr: (i,t,x) => [Math.sin(x),Math.cos(x)]})).add(new EXP.HistoryRecorder({memoryLength: 5}).add(new LineOutput({width: 5, color: 0xff0000}));

            NOTE: It is assumed that any parent transformation outputs an array of numbers that is 4 or less in length.
        */

		this.memoryLength = options.memoryLength === undefined ? 10 : options.memoryLength;
        this.recordFrameInterval = options.recordFrameInterval === undefined ? 15 : options.recordFrameInterval; //set to 1 to record every frame.
        this._outputDimensions = 4; //how many dimensions per point to store? (todo: autodetect this from parent's output)
		this.currentHistoryIndex=0;
        this.frameRecordTimer = 0;
	}
	_onAdd(){
		//climb up parent hierarchy to find the Area
		let root = this.getClosestDomain();

		this.numCallsPerActivation = root.numCallsPerActivation * this.memoryLength;
		this.itemDimensions = root.itemDimensions.concat([this.memoryLength]);

        this.buffer = new Float32Array(this.numCallsPerActivation * this._outputDimensions);
    
        //This is so that no surface/boundary will appear until history begins to be recorded. I'm so sorry.
        //Todo: proper clip shader like mathbox does or something.
        this.buffer.fill(NaN); 
	}
    onAfterActivation(){
        super.onAfterActivation();

        //every so often, shift to the next buffer slot
        this.frameRecordTimer += 1;
        if(this.frameRecordTimer >= this.recordFrameInterval){
            //reset frame record timer
            this.frameRecordTimer = 0;
            this.currentHistoryIndex = (this.currentHistoryIndex+1)%this.memoryLength;
        }
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

        let cyclicBufferIndex = (i*this.memoryLength+this.currentHistoryIndex)*this._outputDimensions;
        for(var j=0;j<coordinates.length-2;j++){ 
            this.buffer[cyclicBufferIndex+j] = coordinates[2+j];
        }

        //step 2:, call any children once per history item
        for(var childNo=0;childNo<this.children.length;childNo++){
		    for(var j=0;j<this.memoryLength;j++){

                //the +1 in (j + this.currentHistoryIndex + 1) is important; without it, a LineOutput will draw a line from the most recent value to the end of history
                let cyclicHistoryValue = (j + this.currentHistoryIndex + 1) % this.memoryLength;
                let cyclicBufferIndex = (i * this.memoryLength + cyclicHistoryValue)*this._outputDimensions;
                let nonCyclicIndex = i * this.memoryLength + j;

		        //I'm torn on whether to add a final coordinate at the end so history can go off in a new direction.
                //this.children[childNo].evaluateSelf(nonCyclicIndex,t,this.buffer[cyclicBufferIndex], cyclicHistoryValue);
                this.children[childNo].evaluateSelf(
                        nonCyclicIndex,t, //i,t
                        ...this.buffer.slice(cyclicBufferIndex,cyclicBufferIndex+this._outputDimensions) //extract coordinates for this history value from buffer
                );
            }
        }
	}
	clone(){
		let clone = new HistoryRecorder({memoryLength: this.memoryLength, recordFrameInterval: this.recordFrameInterval});
		for(var i=0;i<this.children.length;i++){
			clone.add(this.children[i].clone());
		}
		return clone;
	}
}

export { HistoryRecorder }
