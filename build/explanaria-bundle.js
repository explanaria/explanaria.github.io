(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.EXP = {}));
}(this, (function (exports) { 'use strict';

	/* The base class that everything inherits from. 
		Each thing drawn to the screen is a tree. Domains, such as EXP.Area or EXP.Array are the root nodes,
		EXP.Transformation is currently the only intermediate node, and the leaf nodes are some form of Output such as
		EXP.LineOutput or EXP.PointOutput, or EXP.VectorOutput.

		All of these can be .add()ed to each other to form that tree, and this file defines how it works.
	*/

	class Node$1{
		constructor(){        
			this.children = [];
			this.parent = null;        
	    }
		add(thing){
			//chainable so you can a.add(b).add(c) to make a->b->c
			this.children.push(thing);
			thing.parent = this;
			if(thing._onAdd)thing._onAdd();
			return thing;
		}
		_onAdd(){}
		remove(thing){
			var index = this.children.indexOf( thing );
			if ( index !== - 1 ) {
				thing.parent = null;
				this.children.splice( index, 1 );
			}
			return this;
		}
	    getTopParent(){ //find the parent of the parent of the... until there's no more parents.
	        const MAX_CHAIN = 100;
	        let parentCount = 0;
			let root = this;
			while(root !== null && root.parent !== null && parentCount < MAX_CHAIN){
				root = root.parent;
	            parentCount+= 1;
			}
			if(parentCount >= MAX_CHAIN)throw new Error("Unable to find top-level parent!");
	        return root;
	    }
	    getDeepestChildren(){ //find all leaf nodes from this node
	        //this algorithm can probably be improved
	        if(this.children.length == 0)return [this];

	        let children = [];
	        for(let i=0;i<this.children.length;i++){
	            let childsChildren = this.children[i].getDeepestChildren();
	            for(let j=0;j<childsChildren.length;j++){
	                children.push(childsChildren[j]);
	            }
	        }
	        return children;
	    }
	    getClosestDomain(){
	        /* Find the DomainNode that this Node is being called from.
	        Traverse the chain of parents upwards until we find a DomainNode, at which point we return it.
	        This allows an output to resize an array to match a domainNode's numCallsPerActivation, for example.

	        Note that this returns the MOST RECENT DomainNode ancestor - it's assumed that domainnodes overwrite one another.
	        */
	        const MAX_CHAIN = 100;
	        let parentCount = 0;
			let root = this.parent; //start one level up in case this is a DomainNode already. we don't want that
			while(root !== null && root.parent !== null && !root.isDomainNode && parentCount < MAX_CHAIN){
				root = root.parent;
	            parentCount+= 1;
			}
			if(parentCount >= MAX_CHAIN)throw new Error("Unable to find parent!");
	        if(root === null || !root.isDomainNode)throw new Error("No DomainNode parent found!");
	        return root;
	    }

		onAfterActivation(){
			// do nothing
			//but call all children
			for(var i=0;i<this.children.length;i++){
				this.children[i].onAfterActivation();
			}
		}
	}

	class OutputNode extends Node$1{ //more of a java interface, really
		constructor(){super();}
		evaluateSelf(i, t, x, y, z){}
		onAfterActivation(){}
		_onAdd(){}
	}

	class DomainNode extends Node$1{ //A node that calls other functions over some range.
		constructor(){
	        super();
			this.itemDimensions = []; // array to store the number of times this is called per dimension.
	        this.numCallsPerActivation = null; // number of times any child node's evaluateSelf() is called
	    }
	    activate(t){}
	}
	DomainNode.prototype.isDomainNode = true;

	class EXPArray extends DomainNode{
		constructor(options){
			super();
			/*var points = new EXP.Array({
			data: [[-10,10],
				[10,10]]
			})*/

			EXP.Utils.assertPropExists(options, "data"); // a multidimensional array. assumed to only contain one type: either numbers or arrays
			EXP.Utils.assertType(options.data, Array);

			//It's assumed an EXP.Array will only store things such as 0, [0], [0,0] or [0,0,0]. If an array type is stored, this.arrayTypeDimensions contains the .length of that array. Otherwise it's 0, because points are 0-dimensional.
			if(options.data[0].constructor === Number){
				this.arrayTypeDimensions = 0;
			}else if(options.data[0].constructor === Array){
				this.arrayTypeDimensions = options.data[0].length;
			}else {
				console.error("Data in an EXP.Array should be a number or an array of other things, not " + options.data[0].constructor);
			}


			EXP.Utils.assert(options.data[0].length != 0); //don't accept [[]], data needs to be something like [[1,2]].

			this.data = options.data;
			this.numItems = this.data.length;

			this.itemDimensions = [this.data.length]; // array to store the number of times this is called per dimension.

			//the number of times every child's expr is called
			this.numCallsPerActivation = this.itemDimensions.reduce((sum,y)=>sum*y);
		}
		activate(t){
			if(this.arrayTypeDimensions == 0){
				//numbers can't be spread using ... operator
				for(var i=0;i<this.data.length;i++){
					this._callAllChildren(i,t,this.data[i]);
				}
			}else {
				for(var i=0;i<this.data.length;i++){
					this._callAllChildren(i,t,...this.data[i]);
				}
			}

			this.onAfterActivation(); // call children if necessary
		}
		_callAllChildren(...coordinates){
			for(var i=0;i<this.children.length;i++){
				this.children[i].evaluateSelf(...coordinates);
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

	function multiplyScalar(c, array){
		for(var i=0;i<array.length;i++){
			array[i] *= c;
		}
		return array
	}
	function vectorAdd(v1,v2){
	    let vec = clone(v1);
		for(var i=0;i<v1.length;i++){
			vec[i] += v2[i];
		}
		return vec
	}
	function vectorSub(v1,v2){
	    let vec = clone(v1);
		for(var i=0;i<v1.length;i++){
			vec[i] += v2[i];
		}
		return vec
	}
	function lerpVectors(t, p1, p2){
		//assumed t in [0,1]
		return vectorAdd(multiplyScalar(t,clone(p1)),multiplyScalar(1-t,clone(p2)));
	}
	function clone(vec){
		var newArr = new Array(vec.length);
		for(var i=0;i<vec.length;i++){
			newArr[i] = vec[i];
		}
		return newArr
	}
	function multiplyMatrix(vec, matrix){
		//assert vec.length == numRows

		let numRows = matrix.length;
		let numCols = matrix[0].length;

		var output = new Array(numCols);
		for(var j=0;j<numCols;j++){
			output[j] = 0;
			for(var i=0;i<numRows;i++){
				output[j] += matrix[i][j] * vec[i];
			}
		}
		return output;
	}

	//hack
	let Math$1 = {clone: clone, lerpVectors: lerpVectors, vectorAdd: vectorAdd, vectorSub: vectorSub, multiplyScalar: multiplyScalar, multiplyMatrix: multiplyMatrix};

	class Utils$1{
		static isArray(x){
	        if(x === undefined){
	            return false;
	        }
			return x.constructor === Array;
		}
		static isObject(x){
	        if(x === undefined){
	            return false;
	        }
			return x.constructor === Object;
		}
		static arrayCopy(x){
			return x.slice();
		}
		static isFunction(x){
	        if(x === undefined){
	            return false;
	        }
			return x.constructor === Function;
		}
		static isNumber(x){
	        if(x === undefined){
	            return false;
	        }
			return x.constructor === Number;
		}

		static assert(thing){
			//A function to check if something is true and halt otherwise in a callbackable way.
			if(!thing){
				console.error("ERROR! Assertion failed. See traceback for more.");
	            console.trace();
			}
		}

		static assertType(thing, type, errorMsg){
			//A function to check if something is true and halt otherwise in a callbackable way.
			if(!(thing.constructor === type)){
				if(errorMsg){
					console.error("ERROR! Something not of required type "+type.name+"! \n"+errorMsg+"\n See traceback for more.");
				}else {
					console.error("ERROR! Something not of required type "+type.name+"! See traceback for more.");
				}
	            console.trace();
			}
		}


		static assertPropExists(thing, name){
			if(!thing || !(name in thing)){
				console.error("ERROR! This object should have the property "+name+", but it was missing:");
	            console.log(thing);
	            console.trace();
			}
		}
		
		static clone(vec){
			return clone(vec);
		}


		static is1DNumericArray(vec){
	        if(!Utils$1.isArray(vec)) return false;
	        for(let i=0;i<vec.length;i++){
	            if(!Utils$1.isNumber(vec[i])) return false;
	        }
	        return true;
		}

	    static dist(vec1, vec2){
	        let sum = 0;
	        Utils$1.assert(Utils$1.is1DNumericArray(vec1));
	        Utils$1.assert(Utils$1.is1DNumericArray(vec2));
	        for(let i=0;i<vec1.length;i++){
	            sum += (vec1[i]-vec2[i])*(vec1[i]-vec2[i]);
	        }
	        return Math.sqrt(sum);
	    }

	}

	class Area extends DomainNode{
		constructor(options){
			super();

			/*var axes = new EXP.Area({
			bounds: [[-10,10],
				[10,10]]
			numItems: 10; //optional. Alternately numItems can vary for each axis: numItems: [10,2]
			})*/


		
			Utils$1.assertPropExists(options, "bounds"); // a multidimensional array
			Utils$1.assertType(options.bounds, Array);
			Utils$1.assertType(options.bounds[0], Array, "For an Area, options.bounds must be a multidimensional array, even for one dimension!"); // it MUST be multidimensional
			this.numDimensions = options.bounds.length;

			Utils$1.assert(options.bounds[0].length != 0); //don't accept [[]], it needs to be [[1,2]].

			this.bounds = options.bounds;
			this.numItems = options.numItems || 16;

			this.itemDimensions = []; // array to store the number of times this is called per dimension.

			if(this.numItems.constructor === Number){
				for(var i=0;i<this.numDimensions;i++){
					this.itemDimensions.push(this.numItems);
				}
			}else if(this.numItems.constructor === Array){
				Utils$1.assert(options.numItems.length == options.bounds.length);
				for(var i=0;i<this.numDimensions;i++){
					this.itemDimensions.push(this.numItems[i]);
				}
			}

			//the number of times every child's expr is called
			this.numCallsPerActivation = this.itemDimensions.reduce((sum,y)=>sum*y);
		}
		activate(t){
			//Use this to evaluate expr() and update the result, cascade-style.
			//the number of bounds this object has will be the number of dimensions.
			//the expr()s are called with expr(i, ...[coordinates], t), 
			//	(where i is the index of the current evaluation = times expr() has been called this frame, t = absolute timestep (s)).
			//please call with a t value obtained from performance.now()/1000 or something like that

			//note the less-than-or-equal-to in these loops
			if(this.numDimensions == 1){
				for(var i=0;i<this.itemDimensions[0];i++){
					let c1 = this.bounds[0][0] + (this.bounds[0][1]-this.bounds[0][0])*(i/(this.itemDimensions[0]-1));
					let index = i;
					this._callAllChildren(index,t,c1,0,0,0);
				}
			}else if(this.numDimensions == 2){
				//this can be reduced into a fancy recursion technique over the first index of this.bounds, I know it
				for(var i=0;i<this.itemDimensions[0];i++){
					let c1 = this.bounds[0][0] + (this.bounds[0][1]-this.bounds[0][0])*(i/(this.itemDimensions[0]-1));
					for(var j=0;j<this.itemDimensions[1];j++){
						let c2 = this.bounds[1][0] + (this.bounds[1][1]-this.bounds[1][0])*(j/(this.itemDimensions[1]-1));
						let index = i*this.itemDimensions[1] + j;
						this._callAllChildren(index,t,c1,c2,0,0);
					}
				}
			}else if(this.numDimensions == 3){
				//this can be reduced into a fancy recursion technique over the first index of this.bounds, I know it
				for(var i=0;i<this.itemDimensions[0];i++){
					let c1 = this.bounds[0][0] + (this.bounds[0][1]-this.bounds[0][0])*(i/(this.itemDimensions[0]-1));
					for(var j=0;j<this.itemDimensions[1];j++){
						let c2 = this.bounds[1][0] + (this.bounds[1][1]-this.bounds[1][0])*(j/(this.itemDimensions[1]-1));
						for(var k=0;k<this.itemDimensions[2];k++){
							let c3 = this.bounds[2][0] + (this.bounds[2][1]-this.bounds[2][0])*(k/(this.itemDimensions[2]-1));
							let index = (i*this.itemDimensions[1] + j)*this.itemDimensions[2] + k;
							this._callAllChildren(index,t,c1,c2,c3,0);
						}
					}
				}
			}else {
				assert("TODO: Use a fancy recursion technique to loop over all indices!");
			}

			this.onAfterActivation(); // call children if necessary
		}
		_callAllChildren(...coordinates){
			for(var i=0;i<this.children.length;i++){
				this.children[i].evaluateSelf(...coordinates);
			}
		}
		clone(){
			let clone = new Area({bounds: Utils$1.arrayCopy(this.bounds), numItems: this.numItems});
			for(var i=0;i<this.children.length;i++){
				clone.add(this.children[i].clone());
				if(clone.children[i]._onAdd)clone.children[i]._onAdd(); // necessary now that the chain of adding has been established
			}
			return clone;
		}
	}

	//Usage: var y = new Transformation({expr: function(...a){console.log(...a)}});
	class Transformation extends Node$1{
		constructor(options){
			super();
		
			EXP.Utils.assertPropExists(options, "expr"); // a function that returns a multidimensional array
			EXP.Utils.assertType(options.expr, Function);

			this.expr = options.expr;
		}
		evaluateSelf(...coordinates){
			//evaluate this Transformation's _expr, and broadcast the result to all children.
			let result = this.expr(...coordinates);
			if(result.constructor !== Array)result = [result];

			for(var i=0;i<this.children.length;i++){
				this.children[i].evaluateSelf(coordinates[0],coordinates[1], ...result);
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

	class LinkedTransformation extends Node$1{
	    /*
	        Like an EXP.Transformation, but it uses an existing EXP.Transformation's expr(), so if the linked transformation updates, so does this one. It's like a pointer to a Transformation, but in object form. 
	    */
		constructor(transformationToLinkTo){
			super({});
			EXP.Utils.assertType(transformationToLinkTo, Transformation);
	        this.linkedTransformationNode = transformationToLinkTo;
		}
		evaluateSelf(...coordinates){
			let result = this.linkedTransformationNode.expr(...coordinates);
			if(result.constructor !== Array)result = [result];

			for(var i=0;i<this.children.length;i++){
				this.children[i].evaluateSelf(coordinates[0],coordinates[1], ...result);
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

	exports.threeEnvironment = null;

	function setThreeEnvironment(newEnv){
	    exports.threeEnvironment = newEnv;
	}
	function getThreeEnvironment(){
	    return exports.threeEnvironment;
	}

	let EPS = Number.EPSILON;

	const Easing = {EaseInOut:1,EaseIn:2,EaseOut:3};

	class Interpolator{
	    constructor(fromValue, toValue, interpolationFunction){
	        this.toValue = toValue;
	        this.fromValue = fromValue;
	        this.interpolationFunction = interpolationFunction;
	    }
	    interpolate(percentage){} //percentage is 0-1 linearly
	}
	class NumberInterpolator extends Interpolator{
	    constructor(fromValue, toValue, interpolationFunction){
	        super(fromValue, toValue, interpolationFunction);
	    }
	    interpolate(percentage){
			let t = this.interpolationFunction(percentage);
			return t*this.toValue + (1-t)*this.fromValue;
	    }
	}

	class BoolInterpolator extends Interpolator{
	    constructor(fromValue, toValue, interpolationFunction){
	        super(fromValue, toValue, interpolationFunction);
	    }
	    interpolate(percentage){
	        let t = this.interpolationFunction(percentage);
	        if(t > 0.5){
	            return this.toValue;
	        }else {
	            return this.fromValue;
	        }
	    }
	}


	class ThreeJsColorInterpolator extends Interpolator{
	    constructor(fromValue, toValue, interpolationFunction){
	        super(fromValue, toValue, interpolationFunction);
	        this.tempValue = new THREE.Color();
	    }
	    interpolate(percentage){
	        let t = this.interpolationFunction(percentage);
	        this.tempValue.copy(this.fromValue);
	        return this.tempValue.lerp(this.toValue, t);
	    }
	    interpolateAndCopyTo(percentage, target){
	        let resultArray = this.interpolate(percentage);
	        target.copy(resultArray);
	    }
	}
	class ThreeJsVec3Interpolator extends Interpolator{
	    constructor(fromValue, toValue, interpolationFunction){
	        super(fromValue, toValue, interpolationFunction);
	        if(Utils$1.isArray(toValue) && toValue.length <= 3){
	            this.toValue = new THREE.Vector3(...this.toValue);
	        }
	        this.tempValue = new THREE.Vector3();
	    }
	    interpolate(percentage){
	        let t = this.interpolationFunction(percentage);
	        return this.tempValue.lerpVectors(this.fromValue, this.toValue, t); //this modifies this.tempValue in-place and returns it
	    }
	    interpolateAndCopyTo(percentage, target){
	        let resultArray = this.interpolate(percentage);
	        target.copy(resultArray);
	    }
	}

	class TransformationFunctionInterpolator extends Interpolator{
	    constructor(fromValue, toValue, interpolationFunction, staggerFraction, targetNumCallsPerActivation){
	        super(fromValue, toValue, interpolationFunction);
	        this.staggerFraction = staggerFraction;
	        this.targetNumCallsPerActivation = targetNumCallsPerActivation;
	    }
	    interpolate(percentage){
				//if staggerFraction != 0, it's the amount of time between the first point's start time and the last point's start time.
				//ASSUMPTION: the first variable of this function is i, and it's assumed i is zero-indexed.
				//encapsulate percentage

				return (function(...coords){
	                const i = coords[0];
					let lerpFactor = percentage;

	                //fancy staggering math, if we know how many objects are flowing through this transformation at once
	                if(this.targetNumCallsPerActivation !== undefined){
	                    lerpFactor = percentage/(1-this.staggerFraction+EPS) - i*this.staggerFraction/this.targetNumCallsPerActivation;
	                }
					//let percent = Math.min(Math.max(percentage - i/this.targetNumCallsPerActivation   ,1),0);

					let t = this.interpolationFunction(Math.max(Math.min(lerpFactor,1),0));
					return lerpVectors(t,this.toValue(...coords),this.fromValue(...coords))
				}).bind(this);
	    }
	}

	class Numeric1DArrayInterpolator extends Interpolator{
	    constructor(fromValue, toValue, interpolationFunction){
	        super(fromValue, toValue, interpolationFunction);
	        this.largestLength = Math.max(fromValue.length, toValue.length);
	        this.shortestLength = Math.min(fromValue.length, toValue.length);
	        this.fromValueIsShorter = fromValue.length < toValue.length;
	        this.resultArray = new Array(this.largestLength); //cached for speedup
	    }
	    interpolate(percentage){
			let t = this.interpolationFunction(percentage);
	        for(let i=0;i<this.shortestLength;i++){
	            this.resultArray[i] = t*this.toValue[i] + (1-t)*this.fromValue[i];
	        }

	        //if one array is longer than the other, interpolate as if the shorter array is padded with zeroes
	        if(this.fromValueIsShorter){
	            //this.fromValue[i] doesn't exist, so assume it's a zero
	            for(let i=this.shortestLength;i<this.largestLength;i++){
	                this.resultArray[i] = t*this.toValue[i]; // + (1-t)*0;
	            }
	        }else {
	            //this.toValue[i] doesn't exist, so assume it's a zero
	            for(let i=this.shortestLength;i<this.largestLength;i++){
	                this.resultArray[i] = (1-t)*this.fromValue[i]; // + t*0 
	            }
	        }
	        return this.resultArray;
	    }
	    interpolateAndCopyTo(percentage, target){
	        let resultArray = this.interpolate(percentage);
	        for(let i=0;i<resultArray.length;i++){
	            target[i] = resultArray[i];
	        }
	    }
	}

	class FallbackDoNothingInterpolator extends Interpolator{
	    constructor(fromValue, toValue, interpolationFunction){
	        super(fromValue, toValue, interpolationFunction);
	    }
	    interpolate(percentage){
	        return this.fromValue;
	    }
	}





	const ExistingAnimationSymbol = Symbol('CurrentEXPAnimation');


	class Animation{
		constructor(target, toValues, duration=1, optionalArguments={}){
	        if(!Utils$1.isObject(toValues) && !Utils$1.isArray(toValues)){
					console.error("Error transitioning: toValues must be an array or an object.");
	        }

			this.toValues = toValues;
			this.target = target;	
			this.duration = duration; //in s

	        //Parse optional values in optionalArguments

	        //choose easing function
	        this.easing = optionalArguments.easing === undefined ? Easing.EaseInOut : optionalArguments.easing;//default, Easing.EaseInOut
	        this.interpolationFunction = Animation.cosineEaseInOutInterpolation; 
	        if(this.easing == Easing.EaseIn){
	            this.interpolationFunction = Animation.cosineEaseInInterpolation;
	        }else if(this.easing == Easing.EaseOut){
	            this.interpolationFunction = Animation.cosineEaseOutInterpolation;
	        }

	        //setup values needed for staggered animation
	        this.staggerFraction = optionalArguments.staggerFraction === undefined ? 0 : optionalArguments.staggerFraction; // time in ms between first element beginning the animation and last element beginning the animation. Should be less than duration.
			Utils$1.assert(this.staggerFraction >= 0 && this.staggerFraction < 1);
			if(target.constructor === Transformation){
				this.targetNumCallsPerActivation = target.getTopParent().numCallsPerActivation;
			}else {
				if(this.staggerFraction != 0){
					console.error("staggerFraction can only be used when TransitionTo's target is an EXP.Transformation!");
				}
			}

	        this.mode = "copyProperties";
	        
			this.fromValues = {};
	        this.interpolators = [];
	        this.interpolatingPropertyNames = [];
	        if(!Utils$1.isArray(toValues)){
			    for(var property in this.toValues){
				    Utils$1.assertPropExists(this.target, property);

				    //copy property, making sure to store the correct 'this'
				    if(Utils$1.isFunction(this.target[property])){
					    this.fromValues[property] = this.target[property].bind(this.target);
				    }else {
					    this.fromValues[property] = this.target[property];
				    }

	                this.interpolators.push(this.chooseInterpolator(this.fromValues[property], this.toValues[property],this.interpolationFunction));
	                this.interpolatingPropertyNames.push(property);
			    }
	        }else {
	            this.mode = "copyToTarget";
	            //support Animation([a,b,c],[a,b,c,d,e]) where fromValues[property] might not be interpolatable, but fromValues is
			    this.fromValues = EXP.Math.clone(this.target);
	            let wholeThingInterpolator = this.chooseInterpolator(this.fromValues, this.toValues,this.interpolationFunction);
	            this.interpolators.push(wholeThingInterpolator);
	        }


			this.elapsedTime = 0;
	        this.prevTrueTime = 0;

	        if(this.target[ExistingAnimationSymbol] !== undefined){
	            this.dealWithExistingAnimation();
	        }
	        this.target[ExistingAnimationSymbol] = this;

			//begin
			this._updateCallback = this.update.bind(this);
			exports.threeEnvironment.on("update",this._updateCallback);
		}
	    dealWithExistingAnimation(){
	        //if another animation is halfway through playing when this animation starts, preempt it
	        let previousAnimation = this.target[ExistingAnimationSymbol];

	        //todo: fancy blending
	        previousAnimation.end();
			for(var property in this.fromValues){
	            if(property in previousAnimation.toValues){
	                this.fromValues[property] = previousAnimation.toValues[property];
	    		}
			}
	    }
	    chooseInterpolator(fromValue, toValue, interpolationFunction){
			if(typeof(toValue) === "number" && typeof(fromValue) === "number"){
	            //number-number
	            return new NumberInterpolator(fromValue, toValue, interpolationFunction);
			}else if(Utils$1.isFunction(toValue) && Utils$1.isFunction(fromValue)){
	            //function-function
				return new TransformationFunctionInterpolator(fromValue, toValue, interpolationFunction, this.staggerFraction, this.targetNumCallsPerActivation);
			}else if(toValue.constructor === THREE.Color && fromValue.constructor === THREE.Color){
	            //THREE.Color
	            return new ThreeJsColorInterpolator(fromValue, toValue, interpolationFunction);
	        }else if(fromValue.constructor === THREE.Vector3 && (toValue.constructor === THREE.Vector3 || Utils$1.is1DNumericArray(toValue))){
	            //THREE.Vector3 - but we can also interpret a toValue of [a,b,c] as new THREE.Vector3(a,b,c)
	            return new ThreeJsVec3Interpolator(fromValue, toValue, interpolationFunction);
	        }else if(typeof(toValue) === "boolean" && typeof(fromValue) === "boolean"){
	            //boolean
	            return new BoolInterpolator(fromValue, toValue, interpolationFunction);
			}else if(Utils$1.is1DNumericArray(toValue) && Utils$1.is1DNumericArray(fromValue)){
	            //function-function
				return new Numeric1DArrayInterpolator(fromValue, toValue, interpolationFunction);
	        }else {
	            //We don't know how to interpolate this. Instead we'll just do nothing, and at the end of the animation we'll just set the target to the toValue.
				console.error("Animation class cannot yet handle transitioning between things that aren't numbers or functions or arrays!");
	            return new FallbackDoNothingInterpolator(fromValue, toValue, interpolationFunction);
			}
	    }
		update(time){
			this.elapsedTime += time.realtimeDelta;	

			let percentage = this.elapsedTime/this.duration;

			//interpolate values
	        if(this.mode == 'copyProperties'){
			    for(let i=0;i<this.interpolators.length;i++){
	                let propertyName = this.interpolatingPropertyNames[i];
				    this.target[propertyName] = this.interpolators[i].interpolate(percentage);
			    }
	        }else {
	            //copy to target
	            this.interpolators[0].interpolateAndCopyTo(percentage, this.target);
	        }

			if(this.elapsedTime >= this.duration){
				this.end();
			}
		}
		static cosineEaseInOutInterpolation(x){
			return (1-Math.cos(x*Math.PI))/2;
		}
		static cosineEaseInInterpolation(x){
			return (1-Math.cos(x*Math.PI/2));
		}
		static cosineEaseOutInterpolation(x){
			return Math.sin(x * Math.PI/2);
		}
		static linearInterpolation(x){
			return x;
		}
		end(){
			for(var prop in this.toValues){
				this.target[prop] = this.toValues[prop];
			}
			exports.threeEnvironment.removeEventListener("update",this._updateCallback);
	        this.target[ExistingAnimationSymbol] = undefined;
		}
	}

	function TransitionTo(target, toValues, durationMS, optionalArguments){
	    //if someone's using the old calling strategy of staggerFraction as the last argument, convert it properly
	    if(optionalArguments && Utils$1.isNumber(optionalArguments)){
	        optionalArguments = {staggerFraction: optionalArguments};
	    }
		new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000, optionalArguments);
	}

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function commonjsRequire () {
		throw new Error('Dynamic requires are not currently supported by rollup-plugin-commonjs');
	}

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var tar = createCommonjsModule(function (module) {
	(function () {

		var lookup = [
				'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
				'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
				'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
				'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',
				'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
				'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
				'w', 'x', 'y', 'z', '0', '1', '2', '3',
				'4', '5', '6', '7', '8', '9', '+', '/'
			];
		function clean(length) {
			var i, buffer = new Uint8Array(length);
			for (i = 0; i < length; i += 1) {
				buffer[i] = 0;
			}
			return buffer;
		}

		function extend(orig, length, addLength, multipleOf) {
			var newSize = length + addLength,
				buffer = clean((parseInt(newSize / multipleOf) + 1) * multipleOf);

			buffer.set(orig);

			return buffer;
		}

		function pad(num, bytes, base) {
			num = num.toString(base || 8);
			return "000000000000".substr(num.length + 12 - bytes) + num;
		}

		function stringToUint8 (input, out, offset) {
			var i, length;

			out = out || clean(input.length);

			offset = offset || 0;
			for (i = 0, length = input.length; i < length; i += 1) {
				out[offset] = input.charCodeAt(i);
				offset += 1;
			}

			return out;
		}

		function uint8ToBase64(uint8) {
			var i,
				extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
				output = "",
				temp, length;

			function tripletToBase64 (num) {
				return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
			}
			// go through the array every three bytes, we'll deal with trailing stuff later
			for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
				temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
				output += tripletToBase64(temp);
			}

			// this prevents an ERR_INVALID_URL in Chrome (Firefox okay)
			switch (output.length % 4) {
				case 1:
					output += '=';
					break;
				case 2:
					output += '==';
					break;
			}

			return output;
		}

		window.utils = {};
		window.utils.clean = clean;
		window.utils.pad = pad;
		window.utils.extend = extend;
		window.utils.stringToUint8 = stringToUint8;
		window.utils.uint8ToBase64 = uint8ToBase64;
	}());

	(function () {

	/*
	struct posix_header {             // byte offset
		char name[100];               //   0
		char mode[8];                 // 100
		char uid[8];                  // 108
		char gid[8];                  // 116
		char size[12];                // 124
		char mtime[12];               // 136
		char chksum[8];               // 148
		char typeflag;                // 156
		char linkname[100];           // 157
		char magic[6];                // 257
		char version[2];              // 263
		char uname[32];               // 265
		char gname[32];               // 297
		char devmajor[8];             // 329
		char devminor[8];             // 337
		char prefix[155];             // 345
	                                  // 500
	};
	*/

		var utils = window.utils,
			headerFormat;

		headerFormat = [
			{
				'field': 'fileName',
				'length': 100
			},
			{
				'field': 'fileMode',
				'length': 8
			},
			{
				'field': 'uid',
				'length': 8
			},
			{
				'field': 'gid',
				'length': 8
			},
			{
				'field': 'fileSize',
				'length': 12
			},
			{
				'field': 'mtime',
				'length': 12
			},
			{
				'field': 'checksum',
				'length': 8
			},
			{
				'field': 'type',
				'length': 1
			},
			{
				'field': 'linkName',
				'length': 100
			},
			{
				'field': 'ustar',
				'length': 8
			},
			{
				'field': 'owner',
				'length': 32
			},
			{
				'field': 'group',
				'length': 32
			},
			{
				'field': 'majorNumber',
				'length': 8
			},
			{
				'field': 'minorNumber',
				'length': 8
			},
			{
				'field': 'filenamePrefix',
				'length': 155
			},
			{
				'field': 'padding',
				'length': 12
			}
		];

		function formatHeader(data, cb) {
			var buffer = utils.clean(512),
				offset = 0;

			headerFormat.forEach(function (value) {
				var str = data[value.field] || "",
					i, length;

				for (i = 0, length = str.length; i < length; i += 1) {
					buffer[offset] = str.charCodeAt(i);
					offset += 1;
				}

				offset += value.length - i; // space it out with nulls
			});

			if (typeof cb === 'function') {
				return cb(buffer, offset);
			}
			return buffer;
		}

		window.header = {};
		window.header.structure = headerFormat;
		window.header.format = formatHeader;
	}());

	(function () {

		var header = window.header,
			utils = window.utils,
			recordSize = 512,
			blockSize;

		function Tar(recordsPerBlock) {
			this.written = 0;
			blockSize = (recordsPerBlock || 20) * recordSize;
			this.out = utils.clean(blockSize);
			this.blocks = [];
			this.length = 0;
		}

		Tar.prototype.append = function (filepath, input, opts, callback) {
			var data,
				checksum,
				mode,
				mtime,
				uid,
				gid,
				headerArr;

			if (typeof input === 'string') {
				input = utils.stringToUint8(input);
			} else if (input.constructor !== Uint8Array.prototype.constructor) {
				throw 'Invalid input type. You gave me: ' + input.constructor.toString().match(/function\s*([$A-Za-z_][0-9A-Za-z_]*)\s*\(/)[1];
			}

			if (typeof opts === 'function') {
				opts = {};
			}

			opts = opts || {};

			mode = opts.mode || parseInt('777', 8) & 0xfff;
			mtime = opts.mtime || Math.floor(+new Date() / 1000);
			uid = opts.uid || 0;
			gid = opts.gid || 0;

			data = {
				fileName: filepath,
				fileMode: utils.pad(mode, 7),
				uid: utils.pad(uid, 7),
				gid: utils.pad(gid, 7),
				fileSize: utils.pad(input.length, 11),
				mtime: utils.pad(mtime, 11),
				checksum: '        ',
				type: '0', // just a file
				ustar: 'ustar  ',
				owner: opts.owner || '',
				group: opts.group || ''
			};

			// calculate the checksum
			checksum = 0;
			Object.keys(data).forEach(function (key) {
				var i, value = data[key], length;

				for (i = 0, length = value.length; i < length; i += 1) {
					checksum += value.charCodeAt(i);
				}
			});

			data.checksum = utils.pad(checksum, 6) + "\u0000 ";

			headerArr = header.format(data);

			var headerLength = Math.ceil( headerArr.length / recordSize ) * recordSize;
			var inputLength = Math.ceil( input.length / recordSize ) * recordSize;

			this.blocks.push( { header: headerArr, input: input, headerLength: headerLength, inputLength: inputLength } );

		};

		Tar.prototype.save = function() {

			var buffers = [];
			var chunks = [];
			var length = 0;
			var max = Math.pow( 2, 20 );

			var chunk = [];
			this.blocks.forEach( function( b ) {
				if( length + b.headerLength + b.inputLength > max ) {
					chunks.push( { blocks: chunk, length: length } );
					chunk = [];
					length = 0;
				}
				chunk.push( b );
				length += b.headerLength + b.inputLength;
			} );
			chunks.push( { blocks: chunk, length: length } );

			chunks.forEach( function( c ) {

				var buffer = new Uint8Array( c.length );
				var written = 0;
				c.blocks.forEach( function( b ) {
					buffer.set( b.header, written );
					written += b.headerLength;
					buffer.set( b.input, written );
					written += b.inputLength;
				} );
				buffers.push( buffer );

			} );

			buffers.push( new Uint8Array( 2 * recordSize ) );

			return new Blob( buffers, { type: 'octet/stream' } );

		};

		Tar.prototype.clear = function () {
			this.written = 0;
			this.out = utils.clean(blockSize);
		};

	  {
	    module.exports = Tar;
	  }
	}());
	});

	var download_1 = createCommonjsModule(function (module) {
	//download.js v3.0, by dandavis; 2008-2014. [CCBY2] see http://danml.com/download.html for tests/usage
	// v1 landed a FF+Chrome compat way of downloading strings to local un-named files, upgraded to use a hidden frame and optional mime
	// v2 added named files via a[download], msSaveBlob, IE (10+) support, and window.URL support for larger+faster saves than dataURLs
	// v3 added dataURL and Blob Input, bind-toggle arity, and legacy dataURL fallback was improved with force-download mime and base64 support

	// data can be a string, Blob, File, or dataURL




	function download(data, strFileName, strMimeType) {

		var self = window, // this script is only for browsers anyway...
			u = "application/octet-stream", // this default mime also triggers iframe downloads
			m = strMimeType || u,
			x = data,
			D = document,
			a = D.createElement("a"),
			z = function(a){return String(a);},


			B = self.Blob || self.MozBlob || self.WebKitBlob || z,
			BB = self.MSBlobBuilder || self.WebKitBlobBuilder || self.BlobBuilder,
			fn = strFileName || "download",
			blob,
			b,
			fr;

		//if(typeof B.bind === 'function' ){ B=B.bind(self); }

		if(String(this)==="true"){ //reverse arguments, allowing download.bind(true, "text/xml", "export.xml") to act as a callback
			x=[x, m];
			m=x[0];
			x=x[1];
		}



		//go ahead and download dataURLs right away
		if(String(x).match(/^data\:[\w+\-]+\/[\w+\-]+[,;]/)){
			return navigator.msSaveBlob ?  // IE10 can't do a[download], only Blobs:
				navigator.msSaveBlob(d2b(x), fn) :
				saver(x) ; // everyone else can save dataURLs un-processed
		}//end if dataURL passed?

		try{

			blob = x instanceof B ?
				x :
				new B([x], {type: m}) ;
		}catch(y){
			if(BB){
				b = new BB();
				b.append([x]);
				blob = b.getBlob(m); // the blob
			}

		}



		function d2b(u) {
			var p= u.split(/[:;,]/),
			t= p[1],
			dec= p[2] == "base64" ? atob : decodeURIComponent,
			bin= dec(p.pop()),
			mx= bin.length,
			i= 0,
			uia= new Uint8Array(mx);

			for(i;i<mx;++i) uia[i]= bin.charCodeAt(i);

			return new B([uia], {type: t});
		 }

		function saver(url, winMode){


			if ('download' in a) { //html5 A[download]
				a.href = url;
				a.setAttribute("download", fn);
				a.innerHTML = "downloading...";
				a.style.display = 'none';
				D.body.appendChild(a);
				setTimeout(function() {
					a.click();
					D.body.removeChild(a);
					if(winMode===true){setTimeout(function(){ self.URL.revokeObjectURL(a.href);}, 250 );}
				}, 66);
				return true;
			}

			//do iframe dataURL download (old ch+FF):
			var f = D.createElement("iframe");
			D.body.appendChild(f);
			if(!winMode){ // force a mime that will download:
				url="data:"+url.replace(/^data:([\w\/\-\+]+)/, u);
			}


			f.src = url;
			setTimeout(function(){ D.body.removeChild(f); }, 333);

		}//end saver


		if (navigator.msSaveBlob) { // IE10+ : (has Blob, but not a[download] or URL)
			return navigator.msSaveBlob(blob, fn);
		}

		if(self.URL){ // simple fast and modern way using Blob and URL:
			saver(self.URL.createObjectURL(blob), true);
		}else {
			// handle non-Blob()+non-URL browsers:
			if(typeof blob === "string" || blob.constructor===z ){
				try{
					return saver( "data:" +  m   + ";base64,"  +  self.btoa(blob)  );
				}catch(y){
					return saver( "data:" +  m   + "," + encodeURIComponent(blob)  );
				}
			}

			// Blob but not URL:
			fr=new FileReader();
			fr.onload=function(e){
				saver(this.result);
			};
			fr.readAsDataURL(blob);
		}
		return true;
	} /* end download() */

	{
	  module.exports = download;
	}
	});

	var gif = createCommonjsModule(function (module, exports) {
	// gif.js 0.2.0 - https://github.com/jnordberg/gif.js
	(function(f){{module.exports=f();}})(function(){return function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof commonjsRequire=="function"&&commonjsRequire;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r);}return n[o].exports}var i=typeof commonjsRequire=="function"&&commonjsRequire;for(var o=0;o<r.length;o++)s(r[o]);return s}return e}()({1:[function(require,module,exports){function EventEmitter(){this._events=this._events||{};this._maxListeners=this._maxListeners||undefined;}module.exports=EventEmitter;EventEmitter.EventEmitter=EventEmitter;EventEmitter.prototype._events=undefined;EventEmitter.prototype._maxListeners=undefined;EventEmitter.defaultMaxListeners=10;EventEmitter.prototype.setMaxListeners=function(n){if(!isNumber(n)||n<0||isNaN(n))throw TypeError("n must be a positive number");this._maxListeners=n;return this};EventEmitter.prototype.emit=function(type){var er,handler,len,args,i,listeners;if(!this._events)this._events={};if(type==="error"){if(!this._events.error||isObject(this._events.error)&&!this._events.error.length){er=arguments[1];if(er instanceof Error){throw er}else {var err=new Error('Uncaught, unspecified "error" event. ('+er+")");err.context=er;throw err}}}handler=this._events[type];if(isUndefined(handler))return false;if(isFunction(handler)){switch(arguments.length){case 1:handler.call(this);break;case 2:handler.call(this,arguments[1]);break;case 3:handler.call(this,arguments[1],arguments[2]);break;default:args=Array.prototype.slice.call(arguments,1);handler.apply(this,args);}}else if(isObject(handler)){args=Array.prototype.slice.call(arguments,1);listeners=handler.slice();len=listeners.length;for(i=0;i<len;i++)listeners[i].apply(this,args);}return true};EventEmitter.prototype.addListener=function(type,listener){var m;if(!isFunction(listener))throw TypeError("listener must be a function");if(!this._events)this._events={};if(this._events.newListener)this.emit("newListener",type,isFunction(listener.listener)?listener.listener:listener);if(!this._events[type])this._events[type]=listener;else if(isObject(this._events[type]))this._events[type].push(listener);else this._events[type]=[this._events[type],listener];if(isObject(this._events[type])&&!this._events[type].warned){if(!isUndefined(this._maxListeners)){m=this._maxListeners;}else {m=EventEmitter.defaultMaxListeners;}if(m&&m>0&&this._events[type].length>m){this._events[type].warned=true;console.error("(node) warning: possible EventEmitter memory "+"leak detected. %d listeners added. "+"Use emitter.setMaxListeners() to increase limit.",this._events[type].length);if(typeof console.trace==="function"){console.trace();}}}return this};EventEmitter.prototype.on=EventEmitter.prototype.addListener;EventEmitter.prototype.once=function(type,listener){if(!isFunction(listener))throw TypeError("listener must be a function");var fired=false;function g(){this.removeListener(type,g);if(!fired){fired=true;listener.apply(this,arguments);}}g.listener=listener;this.on(type,g);return this};EventEmitter.prototype.removeListener=function(type,listener){var list,position,length,i;if(!isFunction(listener))throw TypeError("listener must be a function");if(!this._events||!this._events[type])return this;list=this._events[type];length=list.length;position=-1;if(list===listener||isFunction(list.listener)&&list.listener===listener){delete this._events[type];if(this._events.removeListener)this.emit("removeListener",type,listener);}else if(isObject(list)){for(i=length;i-- >0;){if(list[i]===listener||list[i].listener&&list[i].listener===listener){position=i;break}}if(position<0)return this;if(list.length===1){list.length=0;delete this._events[type];}else {list.splice(position,1);}if(this._events.removeListener)this.emit("removeListener",type,listener);}return this};EventEmitter.prototype.removeAllListeners=function(type){var key,listeners;if(!this._events)return this;if(!this._events.removeListener){if(arguments.length===0)this._events={};else if(this._events[type])delete this._events[type];return this}if(arguments.length===0){for(key in this._events){if(key==="removeListener")continue;this.removeAllListeners(key);}this.removeAllListeners("removeListener");this._events={};return this}listeners=this._events[type];if(isFunction(listeners)){this.removeListener(type,listeners);}else if(listeners){while(listeners.length)this.removeListener(type,listeners[listeners.length-1]);}delete this._events[type];return this};EventEmitter.prototype.listeners=function(type){var ret;if(!this._events||!this._events[type])ret=[];else if(isFunction(this._events[type]))ret=[this._events[type]];else ret=this._events[type].slice();return ret};EventEmitter.prototype.listenerCount=function(type){if(this._events){var evlistener=this._events[type];if(isFunction(evlistener))return 1;else if(evlistener)return evlistener.length}return 0};EventEmitter.listenerCount=function(emitter,type){return emitter.listenerCount(type)};function isFunction(arg){return typeof arg==="function"}function isNumber(arg){return typeof arg==="number"}function isObject(arg){return typeof arg==="object"&&arg!==null}function isUndefined(arg){return arg===void 0}},{}],2:[function(require,module,exports){var NeuQuant=require("./TypedNeuQuant.js");var LZWEncoder=require("./LZWEncoder.js");function ByteArray(){this.page=-1;this.pages=[];this.newPage();}ByteArray.pageSize=4096;ByteArray.charMap={};for(var i=0;i<256;i++)ByteArray.charMap[i]=String.fromCharCode(i);ByteArray.prototype.newPage=function(){this.pages[++this.page]=new Uint8Array(ByteArray.pageSize);this.cursor=0;};ByteArray.prototype.getData=function(){var rv="";for(var p=0;p<this.pages.length;p++){for(var i=0;i<ByteArray.pageSize;i++){rv+=ByteArray.charMap[this.pages[p][i]];}}return rv};ByteArray.prototype.writeByte=function(val){if(this.cursor>=ByteArray.pageSize)this.newPage();this.pages[this.page][this.cursor++]=val;};ByteArray.prototype.writeUTFBytes=function(string){for(var l=string.length,i=0;i<l;i++)this.writeByte(string.charCodeAt(i));};ByteArray.prototype.writeBytes=function(array,offset,length){for(var l=length||array.length,i=offset||0;i<l;i++)this.writeByte(array[i]);};function GIFEncoder(width,height){this.width=~~width;this.height=~~height;this.transparent=null;this.transIndex=0;this.repeat=-1;this.delay=0;this.image=null;this.pixels=null;this.indexedPixels=null;this.colorDepth=null;this.colorTab=null;this.neuQuant=null;this.usedEntry=new Array;this.palSize=7;this.dispose=-1;this.firstFrame=true;this.sample=10;this.dither=false;this.globalPalette=false;this.out=new ByteArray;}GIFEncoder.prototype.setDelay=function(milliseconds){this.delay=Math.round(milliseconds/10);};GIFEncoder.prototype.setFrameRate=function(fps){this.delay=Math.round(100/fps);};GIFEncoder.prototype.setDispose=function(disposalCode){if(disposalCode>=0)this.dispose=disposalCode;};GIFEncoder.prototype.setRepeat=function(repeat){this.repeat=repeat;};GIFEncoder.prototype.setTransparent=function(color){this.transparent=color;};GIFEncoder.prototype.addFrame=function(imageData){this.image=imageData;this.colorTab=this.globalPalette&&this.globalPalette.slice?this.globalPalette:null;this.getImagePixels();this.analyzePixels();if(this.globalPalette===true)this.globalPalette=this.colorTab;if(this.firstFrame){this.writeLSD();this.writePalette();if(this.repeat>=0){this.writeNetscapeExt();}}this.writeGraphicCtrlExt();this.writeImageDesc();if(!this.firstFrame&&!this.globalPalette)this.writePalette();this.writePixels();this.firstFrame=false;};GIFEncoder.prototype.finish=function(){this.out.writeByte(59);};GIFEncoder.prototype.setQuality=function(quality){if(quality<1)quality=1;this.sample=quality;};GIFEncoder.prototype.setDither=function(dither){if(dither===true)dither="FloydSteinberg";this.dither=dither;};GIFEncoder.prototype.setGlobalPalette=function(palette){this.globalPalette=palette;};GIFEncoder.prototype.getGlobalPalette=function(){return this.globalPalette&&this.globalPalette.slice&&this.globalPalette.slice(0)||this.globalPalette};GIFEncoder.prototype.writeHeader=function(){this.out.writeUTFBytes("GIF89a");};GIFEncoder.prototype.analyzePixels=function(){if(!this.colorTab){this.neuQuant=new NeuQuant(this.pixels,this.sample);this.neuQuant.buildColormap();this.colorTab=this.neuQuant.getColormap();}if(this.dither){this.ditherPixels(this.dither.replace("-serpentine",""),this.dither.match(/-serpentine/)!==null);}else {this.indexPixels();}this.pixels=null;this.colorDepth=8;this.palSize=7;if(this.transparent!==null){this.transIndex=this.findClosest(this.transparent,true);}};GIFEncoder.prototype.indexPixels=function(imgq){var nPix=this.pixels.length/3;this.indexedPixels=new Uint8Array(nPix);var k=0;for(var j=0;j<nPix;j++){var index=this.findClosestRGB(this.pixels[k++]&255,this.pixels[k++]&255,this.pixels[k++]&255);this.usedEntry[index]=true;this.indexedPixels[j]=index;}};GIFEncoder.prototype.ditherPixels=function(kernel,serpentine){var kernels={FalseFloydSteinberg:[[3/8,1,0],[3/8,0,1],[2/8,1,1]],FloydSteinberg:[[7/16,1,0],[3/16,-1,1],[5/16,0,1],[1/16,1,1]],Stucki:[[8/42,1,0],[4/42,2,0],[2/42,-2,1],[4/42,-1,1],[8/42,0,1],[4/42,1,1],[2/42,2,1],[1/42,-2,2],[2/42,-1,2],[4/42,0,2],[2/42,1,2],[1/42,2,2]],Atkinson:[[1/8,1,0],[1/8,2,0],[1/8,-1,1],[1/8,0,1],[1/8,1,1],[1/8,0,2]]};if(!kernel||!kernels[kernel]){throw "Unknown dithering kernel: "+kernel}var ds=kernels[kernel];var index=0,height=this.height,width=this.width,data=this.pixels;var direction=serpentine?-1:1;this.indexedPixels=new Uint8Array(this.pixels.length/3);for(var y=0;y<height;y++){if(serpentine)direction=direction*-1;for(var x=direction==1?0:width-1,xend=direction==1?width:0;x!==xend;x+=direction){index=y*width+x;var idx=index*3;var r1=data[idx];var g1=data[idx+1];var b1=data[idx+2];idx=this.findClosestRGB(r1,g1,b1);this.usedEntry[idx]=true;this.indexedPixels[index]=idx;idx*=3;var r2=this.colorTab[idx];var g2=this.colorTab[idx+1];var b2=this.colorTab[idx+2];var er=r1-r2;var eg=g1-g2;var eb=b1-b2;for(var i=direction==1?0:ds.length-1,end=direction==1?ds.length:0;i!==end;i+=direction){var x1=ds[i][1];var y1=ds[i][2];if(x1+x>=0&&x1+x<width&&y1+y>=0&&y1+y<height){var d=ds[i][0];idx=index+x1+y1*width;idx*=3;data[idx]=Math.max(0,Math.min(255,data[idx]+er*d));data[idx+1]=Math.max(0,Math.min(255,data[idx+1]+eg*d));data[idx+2]=Math.max(0,Math.min(255,data[idx+2]+eb*d));}}}}};GIFEncoder.prototype.findClosest=function(c,used){return this.findClosestRGB((c&16711680)>>16,(c&65280)>>8,c&255,used)};GIFEncoder.prototype.findClosestRGB=function(r,g,b,used){if(this.colorTab===null)return -1;if(this.neuQuant&&!used){return this.neuQuant.lookupRGB(r,g,b)}var minpos=0;var dmin=256*256*256;var len=this.colorTab.length;for(var i=0,index=0;i<len;index++){var dr=r-(this.colorTab[i++]&255);var dg=g-(this.colorTab[i++]&255);var db=b-(this.colorTab[i++]&255);var d=dr*dr+dg*dg+db*db;if((!used||this.usedEntry[index])&&d<dmin){dmin=d;minpos=index;}}return minpos};GIFEncoder.prototype.getImagePixels=function(){var w=this.width;var h=this.height;this.pixels=new Uint8Array(w*h*3);var data=this.image;var srcPos=0;var count=0;for(var i=0;i<h;i++){for(var j=0;j<w;j++){this.pixels[count++]=data[srcPos++];this.pixels[count++]=data[srcPos++];this.pixels[count++]=data[srcPos++];srcPos++;}}};GIFEncoder.prototype.writeGraphicCtrlExt=function(){this.out.writeByte(33);this.out.writeByte(249);this.out.writeByte(4);var transp,disp;if(this.transparent===null){transp=0;disp=0;}else {transp=1;disp=2;}if(this.dispose>=0){disp=this.dispose&7;}disp<<=2;this.out.writeByte(0|disp|0|transp);this.writeShort(this.delay);this.out.writeByte(this.transIndex);this.out.writeByte(0);};GIFEncoder.prototype.writeImageDesc=function(){this.out.writeByte(44);this.writeShort(0);this.writeShort(0);this.writeShort(this.width);this.writeShort(this.height);if(this.firstFrame||this.globalPalette){this.out.writeByte(0);}else {this.out.writeByte(128|0|0|0|this.palSize);}};GIFEncoder.prototype.writeLSD=function(){this.writeShort(this.width);this.writeShort(this.height);this.out.writeByte(128|112|0|this.palSize);this.out.writeByte(0);this.out.writeByte(0);};GIFEncoder.prototype.writeNetscapeExt=function(){this.out.writeByte(33);this.out.writeByte(255);this.out.writeByte(11);this.out.writeUTFBytes("NETSCAPE2.0");this.out.writeByte(3);this.out.writeByte(1);this.writeShort(this.repeat);this.out.writeByte(0);};GIFEncoder.prototype.writePalette=function(){this.out.writeBytes(this.colorTab);var n=3*256-this.colorTab.length;for(var i=0;i<n;i++)this.out.writeByte(0);};GIFEncoder.prototype.writeShort=function(pValue){this.out.writeByte(pValue&255);this.out.writeByte(pValue>>8&255);};GIFEncoder.prototype.writePixels=function(){var enc=new LZWEncoder(this.width,this.height,this.indexedPixels,this.colorDepth);enc.encode(this.out);};GIFEncoder.prototype.stream=function(){return this.out};module.exports=GIFEncoder;},{"./LZWEncoder.js":3,"./TypedNeuQuant.js":4}],3:[function(require,module,exports){var EOF=-1;var BITS=12;var HSIZE=5003;var masks=[0,1,3,7,15,31,63,127,255,511,1023,2047,4095,8191,16383,32767,65535];function LZWEncoder(width,height,pixels,colorDepth){var initCodeSize=Math.max(2,colorDepth);var accum=new Uint8Array(256);var htab=new Int32Array(HSIZE);var codetab=new Int32Array(HSIZE);var cur_accum,cur_bits=0;var a_count;var free_ent=0;var maxcode;var clear_flg=false;var g_init_bits,ClearCode,EOFCode;function char_out(c,outs){accum[a_count++]=c;if(a_count>=254)flush_char(outs);}function cl_block(outs){cl_hash(HSIZE);free_ent=ClearCode+2;clear_flg=true;output(ClearCode,outs);}function cl_hash(hsize){for(var i=0;i<hsize;++i)htab[i]=-1;}function compress(init_bits,outs){var fcode,c,i,ent,disp,hsize_reg,hshift;g_init_bits=init_bits;clear_flg=false;n_bits=g_init_bits;maxcode=MAXCODE(n_bits);ClearCode=1<<init_bits-1;EOFCode=ClearCode+1;free_ent=ClearCode+2;a_count=0;ent=nextPixel();hshift=0;for(fcode=HSIZE;fcode<65536;fcode*=2)++hshift;hshift=8-hshift;hsize_reg=HSIZE;cl_hash(hsize_reg);output(ClearCode,outs);outer_loop:while((c=nextPixel())!=EOF){fcode=(c<<BITS)+ent;i=c<<hshift^ent;if(htab[i]===fcode){ent=codetab[i];continue}else if(htab[i]>=0){disp=hsize_reg-i;if(i===0)disp=1;do{if((i-=disp)<0)i+=hsize_reg;if(htab[i]===fcode){ent=codetab[i];continue outer_loop}}while(htab[i]>=0)}output(ent,outs);ent=c;if(free_ent<1<<BITS){codetab[i]=free_ent++;htab[i]=fcode;}else {cl_block(outs);}}output(ent,outs);output(EOFCode,outs);}function encode(outs){outs.writeByte(initCodeSize);remaining=width*height;curPixel=0;compress(initCodeSize+1,outs);outs.writeByte(0);}function flush_char(outs){if(a_count>0){outs.writeByte(a_count);outs.writeBytes(accum,0,a_count);a_count=0;}}function MAXCODE(n_bits){return (1<<n_bits)-1}function nextPixel(){if(remaining===0)return EOF;--remaining;var pix=pixels[curPixel++];return pix&255}function output(code,outs){cur_accum&=masks[cur_bits];if(cur_bits>0)cur_accum|=code<<cur_bits;else cur_accum=code;cur_bits+=n_bits;while(cur_bits>=8){char_out(cur_accum&255,outs);cur_accum>>=8;cur_bits-=8;}if(free_ent>maxcode||clear_flg){if(clear_flg){maxcode=MAXCODE(n_bits=g_init_bits);clear_flg=false;}else {++n_bits;if(n_bits==BITS)maxcode=1<<BITS;else maxcode=MAXCODE(n_bits);}}if(code==EOFCode){while(cur_bits>0){char_out(cur_accum&255,outs);cur_accum>>=8;cur_bits-=8;}flush_char(outs);}}this.encode=encode;}module.exports=LZWEncoder;},{}],4:[function(require,module,exports){var ncycles=100;var netsize=256;var maxnetpos=netsize-1;var netbiasshift=4;var intbiasshift=16;var intbias=1<<intbiasshift;var gammashift=10;var betashift=10;var beta=intbias>>betashift;var betagamma=intbias<<gammashift-betashift;var initrad=netsize>>3;var radiusbiasshift=6;var radiusbias=1<<radiusbiasshift;var initradius=initrad*radiusbias;var radiusdec=30;var alphabiasshift=10;var initalpha=1<<alphabiasshift;var radbiasshift=8;var radbias=1<<radbiasshift;var alpharadbshift=alphabiasshift+radbiasshift;var alpharadbias=1<<alpharadbshift;var prime1=499;var prime2=491;var prime3=487;var prime4=503;var minpicturebytes=3*prime4;function NeuQuant(pixels,samplefac){var network;var netindex;var bias;var freq;var radpower;function init(){network=[];netindex=new Int32Array(256);bias=new Int32Array(netsize);freq=new Int32Array(netsize);radpower=new Int32Array(netsize>>3);var i,v;for(i=0;i<netsize;i++){v=(i<<netbiasshift+8)/netsize;network[i]=new Float64Array([v,v,v,0]);freq[i]=intbias/netsize;bias[i]=0;}}function unbiasnet(){for(var i=0;i<netsize;i++){network[i][0]>>=netbiasshift;network[i][1]>>=netbiasshift;network[i][2]>>=netbiasshift;network[i][3]=i;}}function altersingle(alpha,i,b,g,r){network[i][0]-=alpha*(network[i][0]-b)/initalpha;network[i][1]-=alpha*(network[i][1]-g)/initalpha;network[i][2]-=alpha*(network[i][2]-r)/initalpha;}function alterneigh(radius,i,b,g,r){var lo=Math.abs(i-radius);var hi=Math.min(i+radius,netsize);var j=i+1;var k=i-1;var m=1;var p,a;while(j<hi||k>lo){a=radpower[m++];if(j<hi){p=network[j++];p[0]-=a*(p[0]-b)/alpharadbias;p[1]-=a*(p[1]-g)/alpharadbias;p[2]-=a*(p[2]-r)/alpharadbias;}if(k>lo){p=network[k--];p[0]-=a*(p[0]-b)/alpharadbias;p[1]-=a*(p[1]-g)/alpharadbias;p[2]-=a*(p[2]-r)/alpharadbias;}}}function contest(b,g,r){var bestd=~(1<<31);var bestbiasd=bestd;var bestpos=-1;var bestbiaspos=bestpos;var i,n,dist,biasdist,betafreq;for(i=0;i<netsize;i++){n=network[i];dist=Math.abs(n[0]-b)+Math.abs(n[1]-g)+Math.abs(n[2]-r);if(dist<bestd){bestd=dist;bestpos=i;}biasdist=dist-(bias[i]>>intbiasshift-netbiasshift);if(biasdist<bestbiasd){bestbiasd=biasdist;bestbiaspos=i;}betafreq=freq[i]>>betashift;freq[i]-=betafreq;bias[i]+=betafreq<<gammashift;}freq[bestpos]+=beta;bias[bestpos]-=betagamma;return bestbiaspos}function inxbuild(){var i,j,p,q,smallpos,smallval,previouscol=0,startpos=0;for(i=0;i<netsize;i++){p=network[i];smallpos=i;smallval=p[1];for(j=i+1;j<netsize;j++){q=network[j];if(q[1]<smallval){smallpos=j;smallval=q[1];}}q=network[smallpos];if(i!=smallpos){j=q[0];q[0]=p[0];p[0]=j;j=q[1];q[1]=p[1];p[1]=j;j=q[2];q[2]=p[2];p[2]=j;j=q[3];q[3]=p[3];p[3]=j;}if(smallval!=previouscol){netindex[previouscol]=startpos+i>>1;for(j=previouscol+1;j<smallval;j++)netindex[j]=i;previouscol=smallval;startpos=i;}}netindex[previouscol]=startpos+maxnetpos>>1;for(j=previouscol+1;j<256;j++)netindex[j]=maxnetpos;}function inxsearch(b,g,r){var a,p,dist;var bestd=1e3;var best=-1;var i=netindex[g];var j=i-1;while(i<netsize||j>=0){if(i<netsize){p=network[i];dist=p[1]-g;if(dist>=bestd)i=netsize;else {i++;if(dist<0)dist=-dist;a=p[0]-b;if(a<0)a=-a;dist+=a;if(dist<bestd){a=p[2]-r;if(a<0)a=-a;dist+=a;if(dist<bestd){bestd=dist;best=p[3];}}}}if(j>=0){p=network[j];dist=g-p[1];if(dist>=bestd)j=-1;else {j--;if(dist<0)dist=-dist;a=p[0]-b;if(a<0)a=-a;dist+=a;if(dist<bestd){a=p[2]-r;if(a<0)a=-a;dist+=a;if(dist<bestd){bestd=dist;best=p[3];}}}}}return best}function learn(){var i;var lengthcount=pixels.length;var alphadec=30+(samplefac-1)/3;var samplepixels=lengthcount/(3*samplefac);var delta=~~(samplepixels/ncycles);var alpha=initalpha;var radius=initradius;var rad=radius>>radiusbiasshift;if(rad<=1)rad=0;for(i=0;i<rad;i++)radpower[i]=alpha*((rad*rad-i*i)*radbias/(rad*rad));var step;if(lengthcount<minpicturebytes){samplefac=1;step=3;}else if(lengthcount%prime1!==0){step=3*prime1;}else if(lengthcount%prime2!==0){step=3*prime2;}else if(lengthcount%prime3!==0){step=3*prime3;}else {step=3*prime4;}var b,g,r,j;var pix=0;i=0;while(i<samplepixels){b=(pixels[pix]&255)<<netbiasshift;g=(pixels[pix+1]&255)<<netbiasshift;r=(pixels[pix+2]&255)<<netbiasshift;j=contest(b,g,r);altersingle(alpha,j,b,g,r);if(rad!==0)alterneigh(rad,j,b,g,r);pix+=step;if(pix>=lengthcount)pix-=lengthcount;i++;if(delta===0)delta=1;if(i%delta===0){alpha-=alpha/alphadec;radius-=radius/radiusdec;rad=radius>>radiusbiasshift;if(rad<=1)rad=0;for(j=0;j<rad;j++)radpower[j]=alpha*((rad*rad-j*j)*radbias/(rad*rad));}}}function buildColormap(){init();learn();unbiasnet();inxbuild();}this.buildColormap=buildColormap;function getColormap(){var map=[];var index=[];for(var i=0;i<netsize;i++)index[network[i][3]]=i;var k=0;for(var l=0;l<netsize;l++){var j=index[l];map[k++]=network[j][0];map[k++]=network[j][1];map[k++]=network[j][2];}return map}this.getColormap=getColormap;this.lookupRGB=inxsearch;}module.exports=NeuQuant;},{}],5:[function(require,module,exports){var UA,browser,mode,platform,ua;ua=navigator.userAgent.toLowerCase();platform=navigator.platform.toLowerCase();UA=ua.match(/(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/)||[null,"unknown",0];mode=UA[1]==="ie"&&document.documentMode;browser={name:UA[1]==="version"?UA[3]:UA[1],version:mode||parseFloat(UA[1]==="opera"&&UA[4]?UA[4]:UA[2]),platform:{name:ua.match(/ip(?:ad|od|hone)/)?"ios":(ua.match(/(?:webos|android)/)||platform.match(/mac|win|linux/)||["other"])[0]}};browser[browser.name]=true;browser[browser.name+parseInt(browser.version,10)]=true;browser.platform[browser.platform.name]=true;module.exports=browser;},{}],6:[function(require,module,exports){var EventEmitter,browser,extend=function(child,parent){for(var key in parent){if(hasProp.call(parent,key))child[key]=parent[key];}function ctor(){this.constructor=child;}ctor.prototype=parent.prototype;child.prototype=new ctor;child.__super__=parent.prototype;return child},hasProp={}.hasOwnProperty,indexOf=[].indexOf||function(item){for(var i=0,l=this.length;i<l;i++){if(i in this&&this[i]===item)return i}return -1},slice=[].slice;EventEmitter=require("events").EventEmitter;browser=require("./browser.coffee");require("./GIFEncoder.js");require("./gif.worker.coffee");module.exports=function(superClass){var defaults,frameDefaults;extend(GIF,superClass);defaults={workerScript:"gif.worker.js",workers:2,repeat:0,background:"#fff",quality:10,width:null,height:null,transparent:null,debug:false,dither:false};frameDefaults={delay:500,copy:false,dispose:-1};function GIF(options){var base,key,value;this.running=false;this.options={};this.frames=[];this.freeWorkers=[];this.activeWorkers=[];this.setOptions(options);for(key in defaults){value=defaults[key];if((base=this.options)[key]==null){base[key]=value;}}}GIF.prototype.setOption=function(key,value){this.options[key]=value;if(this._canvas!=null&&(key==="width"||key==="height")){return this._canvas[key]=value}};GIF.prototype.setOptions=function(options){var key,results,value;results=[];for(key in options){if(!hasProp.call(options,key))continue;value=options[key];results.push(this.setOption(key,value));}return results};GIF.prototype.addFrame=function(image,options){var frame,key;if(options==null){options={};}frame={};frame.transparent=this.options.transparent;for(key in frameDefaults){frame[key]=options[key]||frameDefaults[key];}if(this.options.width==null){this.setOption("width",image.width);}if(this.options.height==null){this.setOption("height",image.height);}if(typeof ImageData!=="undefined"&&ImageData!==null&&image instanceof ImageData){frame.data=image.data;}else if(typeof CanvasRenderingContext2D!=="undefined"&&CanvasRenderingContext2D!==null&&image instanceof CanvasRenderingContext2D||typeof WebGLRenderingContext!=="undefined"&&WebGLRenderingContext!==null&&image instanceof WebGLRenderingContext){if(options.copy){frame.data=this.getContextData(image);}else {frame.context=image;}}else if(image.childNodes!=null){if(options.copy){frame.data=this.getImageData(image);}else {frame.image=image;}}else {throw new Error("Invalid image")}return this.frames.push(frame)};GIF.prototype.render=function(){var j,numWorkers,ref;if(this.running){throw new Error("Already running")}if(this.options.width==null||this.options.height==null){throw new Error("Width and height must be set prior to rendering")}this.running=true;this.nextFrame=0;this.finishedFrames=0;this.imageParts=function(){var j,ref,results;results=[];for(j=0,ref=this.frames.length;0<=ref?j<ref:j>ref;0<=ref?++j:--j){results.push(null);}return results}.call(this);numWorkers=this.spawnWorkers();if(this.options.globalPalette===true){this.renderNextFrame();}else {for(j=0,ref=numWorkers;0<=ref?j<ref:j>ref;0<=ref?++j:--j){this.renderNextFrame();}}this.emit("start");return this.emit("progress",0)};GIF.prototype.abort=function(){var worker;while(true){worker=this.activeWorkers.shift();if(worker==null){break}this.log("killing active worker");worker.terminate();}this.running=false;return this.emit("abort")};GIF.prototype.spawnWorkers=function(){var numWorkers,ref,results;numWorkers=Math.min(this.options.workers,this.frames.length);(function(){results=[];for(var j=ref=this.freeWorkers.length;ref<=numWorkers?j<numWorkers:j>numWorkers;ref<=numWorkers?j++:j--){results.push(j);}return results}).apply(this).forEach(function(_this){return function(i){var worker;_this.log("spawning worker "+i);worker=new Worker(_this.options.workerScript);worker.onmessage=function(event){_this.activeWorkers.splice(_this.activeWorkers.indexOf(worker),1);_this.freeWorkers.push(worker);return _this.frameFinished(event.data)};return _this.freeWorkers.push(worker)}}(this));return numWorkers};GIF.prototype.frameFinished=function(frame){var j,ref;this.log("frame "+frame.index+" finished - "+this.activeWorkers.length+" active");this.finishedFrames++;this.emit("progress",this.finishedFrames/this.frames.length);this.imageParts[frame.index]=frame;if(this.options.globalPalette===true){this.options.globalPalette=frame.globalPalette;this.log("global palette analyzed");if(this.frames.length>2){for(j=1,ref=this.freeWorkers.length;1<=ref?j<ref:j>ref;1<=ref?++j:--j){this.renderNextFrame();}}}if(indexOf.call(this.imageParts,null)>=0){return this.renderNextFrame()}else {return this.finishRendering()}};GIF.prototype.finishRendering=function(){var data,frame,i,image,j,k,l,len,len1,len2,len3,offset,page,ref,ref1,ref2;len=0;ref=this.imageParts;for(j=0,len1=ref.length;j<len1;j++){frame=ref[j];len+=(frame.data.length-1)*frame.pageSize+frame.cursor;}len+=frame.pageSize-frame.cursor;this.log("rendering finished - filesize "+Math.round(len/1e3)+"kb");data=new Uint8Array(len);offset=0;ref1=this.imageParts;for(k=0,len2=ref1.length;k<len2;k++){frame=ref1[k];ref2=frame.data;for(i=l=0,len3=ref2.length;l<len3;i=++l){page=ref2[i];data.set(page,offset);if(i===frame.data.length-1){offset+=frame.cursor;}else {offset+=frame.pageSize;}}}image=new Blob([data],{type:"image/gif"});return this.emit("finished",image,data)};GIF.prototype.renderNextFrame=function(){var frame,task,worker;if(this.freeWorkers.length===0){throw new Error("No free workers")}if(this.nextFrame>=this.frames.length){return}frame=this.frames[this.nextFrame++];worker=this.freeWorkers.shift();task=this.getTask(frame);this.log("starting frame "+(task.index+1)+" of "+this.frames.length);this.activeWorkers.push(worker);return worker.postMessage(task)};GIF.prototype.getContextData=function(ctx){return ctx.getImageData(0,0,this.options.width,this.options.height).data};GIF.prototype.getImageData=function(image){var ctx;if(this._canvas==null){this._canvas=document.createElement("canvas");this._canvas.width=this.options.width;this._canvas.height=this.options.height;}ctx=this._canvas.getContext("2d");ctx.setFill=this.options.background;ctx.fillRect(0,0,this.options.width,this.options.height);ctx.drawImage(image,0,0);return this.getContextData(ctx)};GIF.prototype.getTask=function(frame){var index,task;index=this.frames.indexOf(frame);task={index:index,last:index===this.frames.length-1,delay:frame.delay,dispose:frame.dispose,transparent:frame.transparent,width:this.options.width,height:this.options.height,quality:this.options.quality,dither:this.options.dither,globalPalette:this.options.globalPalette,repeat:this.options.repeat,canTransfer:browser.name==="chrome"};if(frame.data!=null){task.data=frame.data;}else if(frame.context!=null){task.data=this.getContextData(frame.context);}else if(frame.image!=null){task.data=this.getImageData(frame.image);}else {throw new Error("Invalid frame")}return task};GIF.prototype.log=function(){var args;args=1<=arguments.length?slice.call(arguments,0):[];if(!this.options.debug){return}return console.log.apply(console,args)};return GIF}(EventEmitter);},{"./GIFEncoder.js":2,"./browser.coffee":5,"./gif.worker.coffee":7,events:1}],7:[function(require,module,exports){var GIFEncoder,renderFrame;GIFEncoder=require("./GIFEncoder.js");renderFrame=function(frame){var encoder,page,stream,transfer;encoder=new GIFEncoder(frame.width,frame.height);if(frame.index===0){encoder.writeHeader();}else {encoder.firstFrame=false;}encoder.setTransparent(frame.transparent);encoder.setDispose(frame.dispose);encoder.setRepeat(frame.repeat);encoder.setDelay(frame.delay);encoder.setQuality(frame.quality);encoder.setDither(frame.dither);encoder.setGlobalPalette(frame.globalPalette);encoder.addFrame(frame.data);if(frame.last){encoder.finish();}if(frame.globalPalette===true){frame.globalPalette=encoder.getGlobalPalette();}stream=encoder.stream();frame.data=stream.pages;frame.cursor=stream.cursor;frame.pageSize=stream.constructor.pageSize;if(frame.canTransfer){transfer=function(){var i,len,ref,results;ref=frame.data;results=[];for(i=0,len=ref.length;i<len;i++){page=ref[i];results.push(page.buffer);}return results}();return self.postMessage(frame,transfer)}else {return self.postMessage(frame)}};self.onmessage=function(event){return renderFrame(event.data)};},{"./GIFEncoder.js":2}]},{},[6])(6)});

	});

	var CCapture = createCommonjsModule(function (module, exports) {
	(function() {

	{
	  var Tar = tar;
	  var download = download_1;
	  var GIF = gif;
	}

	var objectTypes = {
	'function': true,
	'object': true
	};

	function checkGlobal(value) {
	    return (value && value.Object === Object) ? value : null;
	  }

	/** Detect free variable `exports`. */
	var freeExports = (exports && !exports.nodeType)
	? exports
	: undefined;

	/** Detect free variable `module`. */
	var freeModule = (module && !module.nodeType)
	? module
	: undefined;

	/** Detect the popular CommonJS extension `module.exports`. */
	var moduleExports = (freeModule && freeModule.exports === freeExports)
	? freeExports
	: undefined;

	/** Detect free variable `global` from Node.js. */
	var freeGlobal = checkGlobal(freeExports && freeModule && typeof commonjsGlobal == 'object' && commonjsGlobal);

	/** Detect free variable `self`. */
	var freeSelf = checkGlobal(objectTypes[typeof self] && self);

	/** Detect free variable `window`. */
	var freeWindow = checkGlobal(objectTypes[typeof window] && window);

	/** Detect `this` as the global object. */
	var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

	/**
	* Used as a reference to the global object.
	*
	* The `this` value is used if it's the global object to avoid Greasemonkey's
	* restricted `window` object, otherwise the `window` object is used.
	*/
	var root = freeGlobal ||
	((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
	  freeSelf || thisGlobal || Function('return this')();

	if( !('gc' in window ) ) {
		window.gc = function(){};
	}

	if (!HTMLCanvasElement.prototype.toBlob) {
	 Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
	  value: function (callback, type, quality) {

	    var binStr = atob( this.toDataURL(type, quality).split(',')[1] ),
	        len = binStr.length,
	        arr = new Uint8Array(len);

	    for (var i=0; i<len; i++ ) {
	     arr[i] = binStr.charCodeAt(i);
	    }

	    callback( new Blob( [arr], {type: type || 'image/png'} ) );
	  }
	 });
	}

	// @license http://opensource.org/licenses/MIT
	// copyright Paul Irish 2015


	// Date.now() is supported everywhere except IE8. For IE8 we use the Date.now polyfill
	//   github.com/Financial-Times/polyfill-service/blob/master/polyfills/Date.now/polyfill.js
	// as Safari 6 doesn't have support for NavigationTiming, we use a Date.now() timestamp for relative values

	// if you want values similar to what you'd get with real perf.now, place this towards the head of the page
	// but in reality, you're just getting the delta between now() calls, so it's not terribly important where it's placed


	(function(){

	  if ("performance" in window == false) {
	      window.performance = {};
	  }

	  Date.now = (Date.now || function () {  // thanks IE8
		  return new Date().getTime();
	  });

	  if ("now" in window.performance == false){

	    var nowOffset = Date.now();

	    if (performance.timing && performance.timing.navigationStart){
	      nowOffset = performance.timing.navigationStart;
	    }

	    window.performance.now = function now(){
	      return Date.now() - nowOffset;
	    };
	  }

	})();


	function pad( n ) {
		return String("0000000" + n).slice(-7);
	}
	// https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Timers

	var g_startTime = window.Date.now();

	function guid() {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
		}
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	}

	function CCFrameEncoder( settings ) {

		var _handlers = {};

		this.settings = settings;

		this.on = function(event, handler) {

			_handlers[event] = handler;

		};

		this.emit = function(event) {

			var handler = _handlers[event];
			if (handler) {

				handler.apply(null, Array.prototype.slice.call(arguments, 1));

			}

		};

		this.filename = settings.name || guid();
		this.extension = '';
		this.mimeType = '';

	}

	CCFrameEncoder.prototype.start = function(){};
	CCFrameEncoder.prototype.stop = function(){};
	CCFrameEncoder.prototype.add = function(){};
	CCFrameEncoder.prototype.save = function(){};
	CCFrameEncoder.prototype.dispose = function(){};
	CCFrameEncoder.prototype.safeToProceed = function(){ return true; };
	CCFrameEncoder.prototype.step = function() { console.log( 'Step not set!' ); };

	function CCTarEncoder( settings ) {

		CCFrameEncoder.call( this, settings );

		this.extension = '.tar';
		this.mimeType = 'application/x-tar';
		this.fileExtension = '';

		this.tape = null;
		this.count = 0;

	}

	CCTarEncoder.prototype = Object.create( CCFrameEncoder.prototype );

	CCTarEncoder.prototype.start = function(){

		this.dispose();

	};

	CCTarEncoder.prototype.add = function( blob ) {

		var fileReader = new FileReader();
		fileReader.onload = function() {
			this.tape.append( pad( this.count ) + this.fileExtension, new Uint8Array( fileReader.result ) );

			//if( this.settings.autoSaveTime > 0 && ( this.frames.length / this.settings.framerate ) >= this.settings.autoSaveTime ) {

			this.count++;
			this.step();
		}.bind( this );
		fileReader.readAsArrayBuffer(blob);

	};

	CCTarEncoder.prototype.save = function( callback ) {

		callback( this.tape.save() );

	};

	CCTarEncoder.prototype.dispose = function() {

		this.tape = new Tar();
		this.count = 0;

	};

	function CCPNGEncoder( settings ) {

		CCTarEncoder.call( this, settings );

		this.type = 'image/png';
		this.fileExtension = '.png';

	}

	CCPNGEncoder.prototype = Object.create( CCTarEncoder.prototype );

	CCPNGEncoder.prototype.add = function( canvas ) {

		canvas.toBlob( function( blob ) {
			CCTarEncoder.prototype.add.call( this, blob );
		}.bind( this ), this.type );

	};

	function CCJPEGEncoder( settings ) {

		CCTarEncoder.call( this, settings );

		this.type = 'image/jpeg';
		this.fileExtension = '.jpg';
		this.quality = ( settings.quality / 100 ) || .8;

	}

	CCJPEGEncoder.prototype = Object.create( CCTarEncoder.prototype );

	CCJPEGEncoder.prototype.add = function( canvas ) {

		canvas.toBlob( function( blob ) {
			CCTarEncoder.prototype.add.call( this, blob );
		}.bind( this ), this.type, this.quality );

	};

	/*

		WebM Encoder

	*/

	function CCWebMEncoder( settings ) {

		var canvas = document.createElement( 'canvas' );
		if( canvas.toDataURL( 'image/webp' ).substr(5,10) !== 'image/webp' ){
			console.log( "WebP not supported - try another export format" );
		}

		CCFrameEncoder.call( this, settings );

		this.quality = ( settings.quality / 100 ) || .8;

		this.extension = '.webm';
		this.mimeType = 'video/webm';
		this.baseFilename = this.filename;

		this.frames = [];
		this.part = 1;

	  this.videoWriter = new WebMWriter({
	    quality: this.quality,
	    fileWriter: null,
	    fd: null,
	    frameRate: settings.framerate
	});


	}

	CCWebMEncoder.prototype = Object.create( CCFrameEncoder.prototype );

	CCWebMEncoder.prototype.start = function( canvas ) {

		this.dispose();

	};

	CCWebMEncoder.prototype.add = function( canvas ) {

	  this.videoWriter.addFrame(canvas);

		//this.frames.push( canvas.toDataURL('image/webp', this.quality) );

		if( this.settings.autoSaveTime > 0 && ( this.frames.length / this.settings.framerate ) >= this.settings.autoSaveTime ) {
			this.save( function( blob ) {
				this.filename = this.baseFilename + '-part-' + pad( this.part );
				download( blob, this.filename + this.extension, this.mimeType );
				this.dispose();
				this.part++;
				this.filename = this.baseFilename + '-part-' + pad( this.part );
				this.step();
			}.bind( this ) );
		} else {
			this.step();
		}

	};

	CCWebMEncoder.prototype.save = function( callback ) {

	//	if( !this.frames.length ) return;

	  this.videoWriter.complete().then(callback);

		/*var webm = Whammy.fromImageArray( this.frames, this.settings.framerate )
		var blob = new Blob( [ webm ], { type: "octet/stream" } );
		callback( blob );*/

	};

	CCWebMEncoder.prototype.dispose = function( canvas ) {

		this.frames = [];

	};

	function CCFFMpegServerEncoder( settings ) {

		CCFrameEncoder.call( this, settings );

		settings.quality = ( settings.quality / 100 ) || .8;

		this.encoder = new FFMpegServer.Video( settings );
	    this.encoder.on( 'process', function() {
	        this.emit( 'process' );
	    }.bind( this ) );
	    this.encoder.on('finished', function( url, size ) {
	        var cb = this.callback;
	        if ( cb ) {
	            this.callback = undefined;
	            cb( url, size );
	        }
	    }.bind( this ) );
	    this.encoder.on( 'progress', function( progress ) {
	        if ( this.settings.onProgress ) {
	            this.settings.onProgress( progress );
	        }
	    }.bind( this ) );
	    this.encoder.on( 'error', function( data ) {
	        alert(JSON.stringify(data, null, 2));
	    }.bind( this ) );

	}

	CCFFMpegServerEncoder.prototype = Object.create( CCFrameEncoder.prototype );

	CCFFMpegServerEncoder.prototype.start = function() {

		this.encoder.start( this.settings );

	};

	CCFFMpegServerEncoder.prototype.add = function( canvas ) {

		this.encoder.add( canvas );

	};

	CCFFMpegServerEncoder.prototype.save = function( callback ) {

	    this.callback = callback;
	    this.encoder.end();

	};

	CCFFMpegServerEncoder.prototype.safeToProceed = function() {
	    return this.encoder.safeToProceed();
	};

	/*
		HTMLCanvasElement.captureStream()
	*/

	function CCStreamEncoder( settings ) {

		CCFrameEncoder.call( this, settings );

		this.framerate = this.settings.framerate;
		this.type = 'video/webm';
		this.extension = '.webm';
		this.stream = null;
		this.mediaRecorder = null;
		this.chunks = [];

	}

	CCStreamEncoder.prototype = Object.create( CCFrameEncoder.prototype );

	CCStreamEncoder.prototype.add = function( canvas ) {

		if( !this.stream ) {
			this.stream = canvas.captureStream( this.framerate );
			this.mediaRecorder = new MediaRecorder( this.stream );
			this.mediaRecorder.start();

			this.mediaRecorder.ondataavailable = function(e) {
				this.chunks.push(e.data);
			}.bind( this );

		}
		this.step();

	};

	CCStreamEncoder.prototype.save = function( callback ) {

		this.mediaRecorder.onstop = function( e ) {
			var blob = new Blob( this.chunks, { 'type' : 'video/webm' });
			this.chunks = [];
			callback( blob );

		}.bind( this );

		this.mediaRecorder.stop();

	};

	/*function CCGIFEncoder( settings ) {

		CCFrameEncoder.call( this );

		settings.quality = settings.quality || 6;
		this.settings = settings;

		this.encoder = new GIFEncoder();
		this.encoder.setRepeat( 1 );
	  	this.encoder.setDelay( settings.step );
	  	this.encoder.setQuality( 6 );
	  	this.encoder.setTransparent( null );
	  	this.encoder.setSize( 150, 150 );

	  	this.canvas = document.createElement( 'canvas' );
	  	this.ctx = this.canvas.getContext( '2d' );

	}

	CCGIFEncoder.prototype = Object.create( CCFrameEncoder );

	CCGIFEncoder.prototype.start = function() {

		this.encoder.start();

	}

	CCGIFEncoder.prototype.add = function( canvas ) {

		this.canvas.width = canvas.width;
		this.canvas.height = canvas.height;
		this.ctx.drawImage( canvas, 0, 0 );
		this.encoder.addFrame( this.ctx );

		this.encoder.setSize( canvas.width, canvas.height );
		var readBuffer = new Uint8Array(canvas.width * canvas.height * 4);
		var context = canvas.getContext( 'webgl' );
		context.readPixels(0, 0, canvas.width, canvas.height, context.RGBA, context.UNSIGNED_BYTE, readBuffer);
		this.encoder.addFrame( readBuffer, true );

	}

	CCGIFEncoder.prototype.stop = function() {

		this.encoder.finish();

	}

	CCGIFEncoder.prototype.save = function( callback ) {

		var binary_gif = this.encoder.stream().getData();

		var data_url = 'data:image/gif;base64,'+encode64(binary_gif);
		window.location = data_url;
		return;

		var blob = new Blob( [ binary_gif ], { type: "octet/stream" } );
		var url = window.URL.createObjectURL( blob );
		callback( url );

	}*/

	function CCGIFEncoder( settings ) {

		CCFrameEncoder.call( this, settings );

		settings.quality = 31 - ( ( settings.quality * 30 / 100 ) || 10 );
		settings.workers = settings.workers || 4;

		this.extension = '.gif';
		this.mimeType = 'image/gif';

	  	this.canvas = document.createElement( 'canvas' );
	  	this.ctx = this.canvas.getContext( '2d' );
	  	this.sizeSet = false;

	  	this.encoder = new GIF({
			workers: settings.workers,
			quality: settings.quality,
			workerScript: settings.workersPath + 'gif.worker.js'
		} );

	    this.encoder.on( 'progress', function( progress ) {
	        if ( this.settings.onProgress ) {
	            this.settings.onProgress( progress );
	        }
	    }.bind( this ) );

	    this.encoder.on('finished', function( blob ) {
	        var cb = this.callback;
	        if ( cb ) {
	            this.callback = undefined;
	            cb( blob );
	        }
	    }.bind( this ) );

	}

	CCGIFEncoder.prototype = Object.create( CCFrameEncoder.prototype );

	CCGIFEncoder.prototype.add = function( canvas ) {

		if( !this.sizeSet ) {
			this.encoder.setOption( 'width',canvas.width );
			this.encoder.setOption( 'height',canvas.height );
			this.sizeSet = true;
		}

		this.canvas.width = canvas.width;
		this.canvas.height = canvas.height;
		this.ctx.drawImage( canvas, 0, 0 );

		this.encoder.addFrame( this.ctx, { copy: true, delay: this.settings.step } );
		this.step();

		/*this.encoder.setSize( canvas.width, canvas.height );
		var readBuffer = new Uint8Array(canvas.width * canvas.height * 4);
		var context = canvas.getContext( 'webgl' );
		context.readPixels(0, 0, canvas.width, canvas.height, context.RGBA, context.UNSIGNED_BYTE, readBuffer);
		this.encoder.addFrame( readBuffer, true );*/

	};

	CCGIFEncoder.prototype.save = function( callback ) {

	    this.callback = callback;

		this.encoder.render();

	};

	function CCapture( settings ) {

		var _settings = settings || {},
			_verbose,
			_time,
			_startTime,
			_performanceTime,
			_performanceStartTime,
			_step,
	        _encoder,
			_timeouts = [],
			_intervals = [],
			_frameCount = 0,
			_intermediateFrameCount = 0,
			_requestAnimationFrameCallbacks = [],
			_capturing = false,
	        _handlers = {};

		_settings.framerate = _settings.framerate || 60;
		_settings.motionBlurFrames = 2 * ( _settings.motionBlurFrames || 1 );
		_verbose = _settings.verbose || false;
		_settings.display || false;
		_settings.step = 1000.0 / _settings.framerate ;
		_settings.timeLimit = _settings.timeLimit || 0;
		_settings.frameLimit = _settings.frameLimit || 0;
		_settings.startTime = _settings.startTime || 0;

		var _timeDisplay = document.createElement( 'div' );
		_timeDisplay.style.position = 'absolute';
		_timeDisplay.style.left = _timeDisplay.style.top = 0;
		_timeDisplay.style.backgroundColor = 'black';
		_timeDisplay.style.fontFamily = 'monospace';
		_timeDisplay.style.fontSize = '11px';
		_timeDisplay.style.padding = '5px';
		_timeDisplay.style.color = 'red';
		_timeDisplay.style.zIndex = 100000;
		if( _settings.display ) document.body.appendChild( _timeDisplay );

		var canvasMotionBlur = document.createElement( 'canvas' );
		var ctxMotionBlur = canvasMotionBlur.getContext( '2d' );
		var bufferMotionBlur;
		var imageData;

		_log( 'Step is set to ' + _settings.step + 'ms' );

	    var _encoders = {
			gif: CCGIFEncoder,
			webm: CCWebMEncoder,
			ffmpegserver: CCFFMpegServerEncoder,
			png: CCPNGEncoder,
			jpg: CCJPEGEncoder,
			'webm-mediarecorder': CCStreamEncoder
	    };

	    var ctor = _encoders[ _settings.format ];
	    if ( !ctor ) {
			throw "Error: Incorrect or missing format: Valid formats are " + Object.keys(_encoders).join(", ");
	    }
	    _encoder = new ctor( _settings );
	    _encoder.step = _step;

		_encoder.on('process', _process);
	    _encoder.on('progress', _progress);

	    if ("performance" in window == false) {
	    	window.performance = {};
	    }

		Date.now = (Date.now || function () {  // thanks IE8
			return new Date().getTime();
		});

		if ("now" in window.performance == false){

			var nowOffset = Date.now();

			if (performance.timing && performance.timing.navigationStart){
				nowOffset = performance.timing.navigationStart;
			}

			window.performance.now = function now(){
				return Date.now() - nowOffset;
			};
		}

		var _oldSetTimeout = window.setTimeout,
			_oldSetInterval = window.setInterval,
		    	_oldClearInterval = window.clearInterval,
			_oldClearTimeout = window.clearTimeout,
			_oldRequestAnimationFrame = window.requestAnimationFrame,
			_oldNow = window.Date.now,
			_oldPerformanceNow = window.performance.now,
			_oldGetTime = window.Date.prototype.getTime;
		// Date.prototype._oldGetTime = Date.prototype.getTime;

		var media = [];

		function _init() {

			_log( 'Capturer start' );

			_startTime = window.Date.now();
			_time = _startTime + _settings.startTime;
			_performanceStartTime = window.performance.now();
			_performanceTime = _performanceStartTime + _settings.startTime;

			window.Date.prototype.getTime = function(){
				return _time;
			};
			window.Date.now = function() {
				return _time;
			};

			window.setTimeout = function( callback, time ) {
				var t = {
					callback: callback,
					time: time,
					triggerTime: _time + time
				};
				_timeouts.push( t );
				_log( 'Timeout set to ' + t.time );
	            return t;
			};
			window.clearTimeout = function( id ) {
				for( var j = 0; j < _timeouts.length; j++ ) {
					if( _timeouts[ j ] == id ) {
						_timeouts.splice( j, 1 );
						_log( 'Timeout cleared' );
						continue;
					}
				}
			};
			window.setInterval = function( callback, time ) {
				var t = {
					callback: callback,
					time: time,
					triggerTime: _time + time
				};
				_intervals.push( t );
				_log( 'Interval set to ' + t.time );
				return t;
			};
			window.clearInterval = function( id ) {
				_log( 'clear Interval' );
				return null;
			};
			window.requestAnimationFrame = function( callback ) {
				_requestAnimationFrameCallbacks.push( callback );
			};
			window.performance.now = function(){
				return _performanceTime;
			};

			function hookCurrentTime() {
				if( !this._hooked ) {
					this._hooked = true;
					this._hookedTime = this.currentTime || 0;
					this.pause();
					media.push( this );
				}
				return this._hookedTime + _settings.startTime;
			}
			try {
				Object.defineProperty( HTMLVideoElement.prototype, 'currentTime', { get: hookCurrentTime } );
				Object.defineProperty( HTMLAudioElement.prototype, 'currentTime', { get: hookCurrentTime } );
			} catch (err) {
				_log(err);
			}

		}

		function _start() {
			_init();
			_encoder.start();
			_capturing = true;
		}

		function _stop() {
			_capturing = false;
			_encoder.stop();
			_destroy();
		}

		function _call( fn, p ) {
			_oldSetTimeout( fn, 0, p );
		}

		function _step() {
			//_oldRequestAnimationFrame( _process );
			_call( _process );
		}

		function _destroy() {
			_log( 'Capturer stop' );
			window.setTimeout = _oldSetTimeout;
			window.setInterval = _oldSetInterval;
			window.clearInterval = _oldClearInterval;
			window.clearTimeout = _oldClearTimeout;
			window.requestAnimationFrame = _oldRequestAnimationFrame;
			window.Date.prototype.getTime = _oldGetTime;
			window.Date.now = _oldNow;
			window.performance.now = _oldPerformanceNow;
		}

		function _updateTime() {
			var seconds = _frameCount / _settings.framerate;
			if( ( _settings.frameLimit && _frameCount >= _settings.frameLimit ) || ( _settings.timeLimit && seconds >= _settings.timeLimit ) ) {
				_stop();
				_save();
			}
			var d = new Date( null );
			d.setSeconds( seconds );
			if( _settings.motionBlurFrames > 2 ) {
				_timeDisplay.textContent = 'CCapture ' + _settings.format + ' | ' + _frameCount + ' frames (' + _intermediateFrameCount + ' inter) | ' +  d.toISOString().substr( 11, 8 );
			} else {
				_timeDisplay.textContent = 'CCapture ' + _settings.format + ' | ' + _frameCount + ' frames | ' +  d.toISOString().substr( 11, 8 );
			}
		}

		function _checkFrame( canvas ) {

			if( canvasMotionBlur.width !== canvas.width || canvasMotionBlur.height !== canvas.height ) {
				canvasMotionBlur.width = canvas.width;
				canvasMotionBlur.height = canvas.height;
				bufferMotionBlur = new Uint16Array( canvasMotionBlur.height * canvasMotionBlur.width * 4 );
				ctxMotionBlur.fillStyle = '#0';
				ctxMotionBlur.fillRect( 0, 0, canvasMotionBlur.width, canvasMotionBlur.height );
			}

		}

		function _blendFrame( canvas ) {

			//_log( 'Intermediate Frame: ' + _intermediateFrameCount );

			ctxMotionBlur.drawImage( canvas, 0, 0 );
			imageData = ctxMotionBlur.getImageData( 0, 0, canvasMotionBlur.width, canvasMotionBlur.height );
			for( var j = 0; j < bufferMotionBlur.length; j+= 4 ) {
				bufferMotionBlur[ j ] += imageData.data[ j ];
				bufferMotionBlur[ j + 1 ] += imageData.data[ j + 1 ];
				bufferMotionBlur[ j + 2 ] += imageData.data[ j + 2 ];
			}
			_intermediateFrameCount++;

		}

		function _saveFrame(){

			var data = imageData.data;
			for( var j = 0; j < bufferMotionBlur.length; j+= 4 ) {
				data[ j ] = bufferMotionBlur[ j ] * 2 / _settings.motionBlurFrames;
				data[ j + 1 ] = bufferMotionBlur[ j + 1 ] * 2 / _settings.motionBlurFrames;
				data[ j + 2 ] = bufferMotionBlur[ j + 2 ] * 2 / _settings.motionBlurFrames;
			}
			ctxMotionBlur.putImageData( imageData, 0, 0 );
			_encoder.add( canvasMotionBlur );
			_frameCount++;
			_intermediateFrameCount = 0;
			_log( 'Full MB Frame! ' + _frameCount + ' ' +  _time );
			for( var j = 0; j < bufferMotionBlur.length; j+= 4 ) {
				bufferMotionBlur[ j ] = 0;
				bufferMotionBlur[ j + 1 ] = 0;
				bufferMotionBlur[ j + 2 ] = 0;
			}
			gc();

		}

		function _capture( canvas ) {

			if( _capturing ) {

				if( _settings.motionBlurFrames > 2 ) {

					_checkFrame( canvas );
					_blendFrame( canvas );

					if( _intermediateFrameCount >= .5 * _settings.motionBlurFrames ) {
						_saveFrame();
					} else {
						_step();
					}

				} else {
					_encoder.add( canvas );
					_frameCount++;
					_log( 'Full Frame! ' + _frameCount );
				}

			}

		}

		function _process() {

			var step = 1000 / _settings.framerate;
			var dt = ( _frameCount + _intermediateFrameCount / _settings.motionBlurFrames ) * step;

			_time = _startTime + dt;
			_performanceTime = _performanceStartTime + dt;

			media.forEach( function( v ) {
				v._hookedTime = dt / 1000;
			} );

			_updateTime();
			_log( 'Frame: ' + _frameCount + ' ' + _intermediateFrameCount );

			for( var j = 0; j < _timeouts.length; j++ ) {
				if( _time >= _timeouts[ j ].triggerTime ) {
					_call( _timeouts[ j ].callback );
					//console.log( 'timeout!' );
					_timeouts.splice( j, 1 );
					continue;
				}
			}

			for( var j = 0; j < _intervals.length; j++ ) {
				if( _time >= _intervals[ j ].triggerTime ) {
					_call( _intervals[ j ].callback );
					_intervals[ j ].triggerTime += _intervals[ j ].time;
					//console.log( 'interval!' );
					continue;
				}
			}

			_requestAnimationFrameCallbacks.forEach( function( cb ) {
	     		_call( cb, _time - g_startTime );
	        } );
	        _requestAnimationFrameCallbacks = [];

		}

		function _save( callback ) {

			if( !callback ) {
				callback = function( blob ) {
					download( blob, _encoder.filename + _encoder.extension, _encoder.mimeType );
					return false;
				};
			}
			_encoder.save( callback );

		}

		function _log( message ) {
			if( _verbose ) console.log( message );
		}

	    function _on( event, handler ) {

	        _handlers[event] = handler;

	    }

	    function _emit( event ) {

	        var handler = _handlers[event];
	        if ( handler ) {

	            handler.apply( null, Array.prototype.slice.call( arguments, 1 ) );

	        }

	    }

	    function _progress( progress ) {

	        _emit( 'progress', progress );

	    }

		return {
			start: _start,
			capture: _capture,
			stop: _stop,
			save: _save,
	        on: _on
		}
	}

	(freeWindow || freeSelf || {}).CCapture = CCapture;

	  // Some AMD build optimizers like r.js check for condition patterns like the following:
	  if (freeExports && freeModule) {
	    // Export for Node.js.
	    if (moduleExports) {
	    	(freeModule.exports = CCapture).CCapture = CCapture;
	    }
	    // Export for CommonJS support.
	    freeExports.CCapture = CCapture;
	}
	else {
	    // Export to the global object.
	    root.CCapture = CCapture;
	}

	}());
	});

	/**
	 * @author alteredq / http://alteredqualia.com/
	 * @author mr.doob / http://mrdoob.com/
	 */

	var Detector = {

		canvas: !! window.CanvasRenderingContext2D,
		webgl: ( function () {

			try {

				var canvas = document.createElement( 'canvas' ); return !! ( window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ) );

			} catch ( e ) {

				return false;

			}

		} )(),
		workers: !! window.Worker,
		fileapi: window.File && window.FileReader && window.FileList && window.Blob,

		getWebGLErrorMessage: function () {

			var element = document.createElement( 'div' );
			element.id = 'webgl-error-message';
			element.style.fontFamily = 'monospace';
			element.style.fontSize = '13px';
			element.style.fontWeight = 'normal';
			element.style.textAlign = 'center';
			element.style.background = '#fff';
			element.style.color = '#000';
			element.style.padding = '1.5em';
			element.style.zIndex = '999';
			element.style.width = '400px';
			element.style.margin = '5em auto 0';

			if ( ! this.webgl ) {

				element.innerHTML = window.WebGLRenderingContext ? [
					'Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br />',
					'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.'
				].join( '\n' ) : [
					'Your browser does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br/>',
					'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.'
				].join( '\n' );

			}

			return element;

		},

		addGetWebGLMessage: function ( parameters ) {

			var parent, id, element;

			parameters = parameters || {};

			parent = parameters.parent !== undefined ? parameters.parent : document.body;
			id = parameters.id !== undefined ? parameters.id : 'oldie';

			element = Detector.getWebGLErrorMessage();
			element.id = id;

			parent.appendChild( element );

		}

	};

	//This library is designed to help start three.js easily, creating the render loop and canvas automagically.

	function ThreeasyEnvironment(canvasElem = null){
		this.prev_timestep = 0;
	    this.shouldCreateCanvas = (canvasElem === null);

		if(!Detector.webgl)Detector.addGetWebGLMessage();

	    //fov, aspect, near, far
		this.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 10000000 );
		//this.camera = new THREE.OrthographicCamera( 70, window.innerWidth / window.innerHeight, 0.1, 10 );

		this.camera.position.set(0, 0, 10);
		this.camera.lookAt(new THREE.Vector3(0,0,0));


		//create camera, scene, timer, renderer objects
		//craete render object


		
		this.scene = new THREE.Scene();
		this.scene.add(this.camera);

		//renderer
		let rendererOptions = { alpha: true, antialias: true};

	    if(!this.shouldCreateCanvas){
	        rendererOptions.canvas = canvasElem;
	    }

		this.renderer = new THREE.WebGLRenderer( rendererOptions );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setClearColor(new THREE.Color(0xFFFFFF), 1.0);


	    this.resizeCanvasIfNecessary(); //resize canvas to window size and set aspect ratio
		/*
		this.renderer.gammaInput = true;
		this.renderer.gammaOutput = true;
		this.renderer.shadowMap.enabled = true;
		this.renderer.vr.enabled = true;
		*/

		this.timeScale = 1;
		this.elapsedTime = 0;
		this.trueElapsedTime = 0;

	    if(this.shouldCreateCanvas){
		    this.container = document.createElement( 'div' );
		    this.container.appendChild( this.renderer.domElement );
	    }

		this.renderer.domElement.addEventListener( 'mousedown', this.onMouseDown.bind(this), false );
		this.renderer.domElement.addEventListener( 'mouseup', this.onMouseUp.bind(this), false );
		this.renderer.domElement.addEventListener( 'touchstart', this.onMouseDown.bind(this), false );
		this.renderer.domElement.addEventListener( 'touchend', this.onMouseUp.bind(this), false );

		/*
		//renderer.vr.enabled = true; 
		window.addEventListener( 'vrdisplaypointerrestricted', onPointerRestricted, false );
		window.addEventListener( 'vrdisplaypointerunrestricted', onPointerUnrestricted, false );
		document.body.appendChild( WEBVR.createButton( renderer ) );
		*/



		this.clock = new THREE.Clock();

		this.IS_RECORDING = false; // queryable if one wants to do things like beef up particle counts for render

	    //If the canvasElement is already loaded, then the 'load' event has already fired. We need to trigger it ourselves.
	    if(document.readyState == "loading"){
		    window.addEventListener('load', this.onPageLoad.bind(this), false);  
	    }else {
	        this.onPageLoad();
	    }
	}

	ThreeasyEnvironment.prototype.onPageLoad = function() {
		console.log("Threeasy_Setup loaded!");
		if(this.shouldCreateCanvas){
			document.body.appendChild( this.container );
		}

		this.start();
	};
	ThreeasyEnvironment.prototype.start = function(){
		this.prev_timestep = performance.now();
		this.clock.start();
		this.render(this.prev_timestep);
	};

	ThreeasyEnvironment.prototype.onMouseDown = function() {
		this.isMouseDown = true;
	};
	ThreeasyEnvironment.prototype.onMouseUp= function() {
		this.isMouseDown = false;
	};
	ThreeasyEnvironment.prototype.onPointerRestricted= function() {
		var pointerLockElement = this.renderer.domElement;
		if ( pointerLockElement && typeof(pointerLockElement.requestPointerLock) === 'function' ) {
			pointerLockElement.requestPointerLock();
		}
	};
	ThreeasyEnvironment.prototype.onPointerUnrestricted= function() {
		var currentPointerLockElement = document.pointerLockElement;
		var expectedPointerLockElement = this.renderer.domElement;
		if ( currentPointerLockElement && currentPointerLockElement === expectedPointerLockElement && typeof(document.exitPointerLock) === 'function' ) {
			document.exitPointerLock();
		}
	};
	ThreeasyEnvironment.prototype.evenify = function(x){
		if(x % 2 == 1){
			return x+1;
		}
		return x;
	};
	ThreeasyEnvironment.prototype.resizeCanvasIfNecessary= function() {
	    //https://webgl2fundamentals.org/webgl/lessons/webgl-anti-patterns.html yes, every frame.
	    //this handles the edge case where the canvas size changes but the window size doesn't

	    let width = window.innerWidth;
	    let height = window.innerHeight;
	    
	    if(!this.shouldCreateCanvas){ // a canvas was provided externally
	        width = this.renderer.domElement.clientWidth;
	        height = this.renderer.domElement.clientHeight;
	    }

	    if(width != this.renderer.domElement.width || height != this.renderer.domElement.height){
	        //canvas dimensions changed, update the internal resolution

		    this.camera.aspect = width / height;
	        //this.camera.setFocalLength(30); //if I use this, the camera will keep a constant width instead of constant height
		    this.aspect = this.camera.aspect;
		    this.camera.updateProjectionMatrix();
		    this.renderer.setSize( this.evenify(width), this.evenify(height),this.shouldCreateCanvas );
	    }
	};
	ThreeasyEnvironment.prototype.listeners = {"update": [],"render":[]}; //update event listeners
	ThreeasyEnvironment.prototype.render = function(timestep){
	    this.resizeCanvasIfNecessary();

	    var realtimeDelta = this.clock.getDelta();
		var delta = realtimeDelta*this.timeScale;
		this.elapsedTime += delta;
	    this.trueElapsedTime += realtimeDelta;
		//get timestep
		for(var i=0;i<this.listeners["update"].length;i++){
			this.listeners["update"][i]({"t":this.elapsedTime,"delta":delta,'realtimeDelta':realtimeDelta});
		}

		this.renderer.render( this.scene, this.camera );

		for(var i=0;i<this.listeners["render"].length;i++){
			this.listeners["render"][i]();
		}

		this.prev_timestep = timestep;
		window.requestAnimationFrame(this.render.bind(this));
	};
	ThreeasyEnvironment.prototype.on = function(event_name, func){
		//Registers an event listener.
		//each listener will be called with an object consisting of:
		//	{t: <current time in s>, "delta": <delta, in ms>}
		// an update event fires before a render. a render event fires post-render.
		if(event_name == "update"){ 
			this.listeners["update"].push(func);
		}else if(event_name == "render"){ 
			this.listeners["render"].push(func);
		}else {
			console.error("Invalid event name!");
		}
	};
	ThreeasyEnvironment.prototype.removeEventListener = function(event_name, func){
		//Unregisters an event listener, undoing an Threeasy_setup.on() event listener.
		//the naming scheme might not be the best here.
		if(event_name == "update"){ 
			let index = this.listeners["update"].indexOf(func);
			this.listeners["update"].splice(index,1);
		} else if(event_name == "render"){ 
			let index = this.listeners["render"].indexOf(func);
			this.listeners["render"].splice(index,1);
		}else {
			console.error("Nonexistent event name!");
		}
	};
	ThreeasyEnvironment.prototype.off = ThreeasyEnvironment.prototype.removeEventListener; //alias to match ThreeasyEnvironment.on

	class ThreeasyRecorder extends ThreeasyEnvironment{
		//based on http://www.tysoncadenhead.com/blog/exporting-canvas-animation-to-mov/ to record an animation
		//when done,     ffmpeg -r 60 -framerate 60 -i ./%07d.png -vcodec libx264 -pix_fmt yuv420p -crf:v 0 video.mp4
	    // to perform motion blur on an oversampled video, ffmpeg -i video.mp4 -vf tblend=all_mode=average,framestep=2 video2.mp4
		//then, add the yuv420p pixels (which for some reason isn't done by the prev command) by:
		// ffmpeg -i video.mp4 -vcodec libx264 -pix_fmt yuv420p -strict -2 -acodec aac finished_video.mp4
		//check with ffmpeg -i finished_video.mp4

		constructor(fps=30, length = 5, canvasElem = null){
			/* fps is evident, autostart is a boolean (by default, true), and length is in s.*/
			super(canvasElem);
			this.fps = fps;
			this.elapsedTime = 0;
			this.frameCount = fps * length;
			this.frames_rendered = 0;

			this.capturer = new CCapture( {
				framerate: fps,
				format: 'png',
				name: document.title,
				//verbose: true,
			} );

			this.rendering = false;

			this.IS_RECORDING = true;
		}
		start(){
			//make a recording sign
			this.recording_icon = document.createElement("div");
			this.recording_icon.style.width="20px";
			this.recording_icon.style.height="20px";
			this.recording_icon.style.position = 'absolute';
			this.recording_icon.style.top = '20px';
			this.recording_icon.style.left = '20px';
			this.recording_icon.style.borderRadius = '10px';
			this.recording_icon.style.backgroundColor = 'red';
			document.body.appendChild(this.recording_icon);

			this.frameCounter = document.createElement("div");
			this.frameCounter.style.position = 'absolute';
			this.frameCounter.style.top = '20px';
			this.frameCounter.style.left = '50px';
			this.frameCounter.style.color = 'black';
			this.frameCounter.style.borderRadius = '10px';
			this.frameCounter.style.backgroundColor = 'rgba(255,255,255,0.1)';
			document.body.appendChild(this.frameCounter);

			this.capturer.start();
			this.rendering = true;
			this.render();
		}
		render(timestep){
	        var realtimeDelta = 1/this.fps;//ignoring the true time, calculate the delta
			var delta = realtimeDelta*this.timeScale; 
			this.elapsedTime += delta;
	        this.trueElapsedTime += realtimeDelta;

			//get timestep
			for(var i=0;i<this.listeners["update"].length;i++){
				this.listeners["update"][i]({"t":this.elapsedTime,"delta":delta, 'realtimeDelta':realtimeDelta});
			}

			this.renderer.render( this.scene, this.camera );

			for(var i=0;i<this.listeners["render"].length;i++){
				this.listeners["render"][i]();
			}


			this.record_frame();
			this.recording_icon.style.borderRadius = '10px';

			window.requestAnimationFrame(this.render.bind(this));
		}
		record_frame(){
		//	let current_frame = document.querySelector('canvas').toDataURL();

			this.capturer.capture( document.querySelector('canvas') );

			this.frameCounter.innerHTML = this.frames_rendered + " / " + this.frameCount; //update timer

			this.frames_rendered++;


			if(this.frames_rendered>this.frameCount){
				this.render = null; //hacky way of stopping the rendering
				this.recording_icon.style.display = "none";
				//this.frameCounter.style.display = "none";

				this.rendering = false;
				this.capturer.stop();
				// default save, will download automatically a file called {name}.extension (webm/gif/tar)
				this.capturer.save();
			}
		}
		resizeCanvasIfNecessary() {
			//stop recording if window size changes
			if(this.rendering && window.innerWidth / window.innerHeight != this.aspect){
				this.capturer.stop();
				this.render = null; //hacky way of stopping the rendering
				alert("Aborting record: Window-size change detected!");
				this.rendering = false;
				return;
			}
			super.resizeCanvasIfNecessary();
		}
	}

	function setupThree(fps=30, length = 5, canvasElem = null){
		var is_recording = false;

		//extract record parameter from url
		var params = new URLSearchParams(document.location.search);
		let recordString = params.get("record");

		if(recordString){ //detect if URL params include ?record=1 or ?record=true
	        recordString = recordString.toLowerCase();
	        is_recording = (recordString == "true" || recordString == "1");
	    }

	    let threeEnvironment = getThreeEnvironment();
	    if(threeEnvironment !== null){//singleton has already been created
	        return threeEnvironment;
	    }

		if(is_recording){
			threeEnvironment = new ThreeasyRecorder(fps, length, canvasElem);
		}else {
			threeEnvironment = new ThreeasyEnvironment(canvasElem);
		}
	    setThreeEnvironment(threeEnvironment);
	    return threeEnvironment;
	}

	async function delay(waitTime){
		return new Promise(function(resolve, reject){
			window.setTimeout(resolve, waitTime);
		});

	}

	//LineOutputShaders.js

	//based on https://mattdesl.svbtle.com/drawing-lines-is-hard but with several errors corrected, bevel shading added, and more

	const LINE_JOIN_TYPES = {"MITER": 0.2, "BEVEL":1.2,"ROUND":2.2}; //I'd use 0,1,2 but JS doesn't add a decimal place at the end when inserting them in a string. cursed justification

	var vShader$1 = [
	"uniform float aspect;", //used to calibrate screen space
	"uniform float lineWidth;", //width of line
	"uniform float lineJoinType;",
	//"attribute vec3 position;", //added automatically by three.js
	"attribute vec3 nextPointPosition;",
	"attribute vec3 previousPointPosition;",
	"attribute float direction;",
	"attribute float approachNextOrPrevVertex;",

	"varying float crossLinePosition;",
	"attribute vec3 color;",
	"varying vec3 vColor;",
	"varying vec2 lineSegmentAClipSpace;",
	"varying vec2 lineSegmentBClipSpace;",
	"varying float thickness;",


	"varying vec3 debugInfo;",

	"vec3 angle_to_hue(float angle) {", //for debugging
	"  angle /= 3.141592*2.;",
	"  return clamp((abs(fract(angle+vec3(3.0, 2.0, 1.0)/3.0)*6.0-3.0)-1.0), 0.0, 1.0);",
	"}",

	//given an unit vector, move dist units perpendicular to it.
	"vec2 offsetPerpendicularAlongScreenSpace(vec2 dir, float twiceDist) {",
	  "vec2 normal = vec2(-dir.y, dir.x) ;",
	  "normal *= twiceDist/2.0;",
	  "normal.x /= aspect;",
	  "return normal;",
	"}",

	"void main() {",

	  "vec2 aspectVec = vec2(aspect, 1.0);",
	  "mat4 projViewModel = projectionMatrix *",
	            "viewMatrix * modelMatrix;",
	  "vec4 previousProjected = projViewModel * vec4(previousPointPosition, 1.0);",
	  "vec4 currentProjected = projViewModel * vec4(position, 1.0);",
	  "vec4 nextProjected = projViewModel * vec4(nextPointPosition, 1.0);",


	  //get 2D screen space with W divide and aspect correction
	  "vec2 currentScreen = currentProjected.xy / currentProjected.w * aspectVec;",
	  "vec2 previousScreen = previousProjected.xy / previousProjected.w * aspectVec;",
	  "vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;",

	  //"centerPointClipSpacePosition = currentProjected.xy / currentProjected.w;",//send to fragment shader
	  "crossLinePosition = direction;", //send direction to the fragment shader
	  "vColor = color;", //send direction to the fragment shader

	  "thickness = lineWidth / 400.;", //TODO: convert lineWidth to pixels
	  "float orientation = (direction-0.5)*2.;",

	  //get directions from (C - B) and (B - A)
	  "vec2 vecA = (currentScreen - previousScreen);",
	  "vec2 vecB = (nextScreen - currentScreen);",
	  "vec2 dirA = normalize(vecA);",
	  "vec2 dirB = normalize(vecB);",

	  //DEBUG
	  "lineSegmentAClipSpace = mix(previousScreen,currentScreen,approachNextOrPrevVertex) / aspectVec;",//send to fragment shader
	  "lineSegmentBClipSpace = mix(currentScreen,nextScreen,approachNextOrPrevVertex) / aspectVec;",//send to fragment shader

	  //starting point uses (next - current)
	  "vec2 offset = vec2(0.0);",
	  "if (currentScreen == previousScreen) {",
	  "  offset = offsetPerpendicularAlongScreenSpace(dirB * orientation, thickness);",
	  //offset += dirB * thickness; //end cap
	  "} ",
	  //ending point uses (current - previous)
	  "else if (currentScreen == nextScreen) {",
	  "  offset = offsetPerpendicularAlongScreenSpace(dirA * orientation, thickness);",
	  //offset += dirA * thickness; //end cap
	  "}",
	  "//somewhere in middle, needs a join",
	  "else {",
	  "  if (lineJoinType == "+LINE_JOIN_TYPES.MITER+") {",
	        //corner type: miter. This is buggy (there's no miter limit yet) so don't use
	  "    //now compute the miter join normal and length",
	  "    vec2 miterDirection = normalize(dirA + dirB);",
	  "    vec2 prevLineExtrudeDirection = vec2(-dirA.y, dirA.x);",
	  "    vec2 miter = vec2(-miterDirection.y, miterDirection.x);",
	  "    float len = thickness / (dot(miter, prevLineExtrudeDirection)+0.0001);", //calculate. dot product is always > 0
	  "    offset = offsetPerpendicularAlongScreenSpace(miterDirection * orientation, len);",
	  "  } else if (lineJoinType == "+LINE_JOIN_TYPES.BEVEL+"){",
	    //corner type: bevel
	  "    vec2 dir = mix(dirA, dirB, approachNextOrPrevVertex);",
	  "    offset = offsetPerpendicularAlongScreenSpace(dir * orientation, thickness);",
	  "  } else if (lineJoinType == "+LINE_JOIN_TYPES.ROUND+"){",
	    //corner type: round
	  "    vec2 dir = mix(dirA, dirB, approachNextOrPrevVertex);",
	  "    vec2 halfThicknessPastTheVertex = dir*thickness/2. * approachNextOrPrevVertex / aspectVec;",
	  "    offset = offsetPerpendicularAlongScreenSpace(dir * orientation, thickness) - halfThicknessPastTheVertex;", //extend rects past the vertex
	  "  } else {", //no line join type specified, just go for the previous point
	  "    offset = offsetPerpendicularAlongScreenSpace(dirA, thickness);",
	  "  }",
	  "}",

	  "debugInfo = vec3(approachNextOrPrevVertex, orientation, 0.0);", //TODO: remove. it's for debugging colors
	  "gl_Position = currentProjected + vec4(offset, 0.0,0.0) *currentProjected.w;",
	"}"].join("\n");

	var fShader$1 = [
	"uniform float opacity;",
	"uniform vec2 screenSize;",
	"uniform float aspect;",
	"uniform float lineJoinType;",
	"varying vec3 vColor;",
	"varying vec3 debugInfo;",
	"varying vec2 lineSegmentAClipSpace;",
	"varying vec2 lineSegmentBClipSpace;",
	"varying float crossLinePosition;",
	"varying float thickness;",

	/* useful for debugging! from https://www.ronja-tutorials.com/2018/11/24/sdf-space-manipulation.html
	"vec3 renderLinesOutside(float dist){",
	"    float _LineDistance = 0.3;",
	"    float _LineThickness = 0.05;",
	"    float _SubLineThickness = 0.05;",
	"    float _SubLines = 1.0;",
	"    vec3 col = mix(vec3(1.0,0.2,0.2), vec3(0.0,0.2,1.2), step(0.0, dist));",

	"    float distanceChange = fwidth(dist) * 0.5;",
	"    float majorLineDistance = abs(fract(dist / _LineDistance + 0.5) - 0.5) * _LineDistance;",
	"    float majorLines = smoothstep(_LineThickness - distanceChange, _LineThickness + distanceChange, majorLineDistance);",

	"    float distanceBetweenSubLines = _LineDistance / _SubLines;",
	"    float subLineDistance = abs(fract(dist / distanceBetweenSubLines + 0.5) - 0.5) * distanceBetweenSubLines;",
	"    float subLines = smoothstep(_SubLineThickness - distanceChange, _SubLineThickness + distanceChange, subLineDistance);",

	"    return col * majorLines * subLines;",
	"}", */


	"float lineSDF(vec2 point, vec2 lineStartPt,vec2 lineEndPt) {",
	  "float h = clamp(dot(point-lineStartPt,lineEndPt-lineStartPt)/dot(lineEndPt-lineStartPt,lineEndPt-lineStartPt),0.0,1.0);",
	  "vec2 projectedVec = (point-lineStartPt-(lineEndPt-lineStartPt)*h);",
	  "return length(projectedVec);",
	"}",


	"void main(){",
	"  vec3 col = vColor.rgb;",
	//"  col = debugInfo.rgb;",
	"  gl_FragColor = vec4(col, opacity);",

	"  if (lineJoinType == "+LINE_JOIN_TYPES.ROUND+"){",
	"      vec2 vertScreenSpacePosition = gl_FragCoord.xy;", //goes from 0 to screenSize.xy
	"      vec2 linePtAScreenSpace = (lineSegmentAClipSpace+1.)/2. * screenSize;", //convert [-1,1] to [0,1], then *screenSize
	"      vec2 linePtBScreenSpace = (lineSegmentBClipSpace+1.)/2. * screenSize;",
	"      float distFromLine = lineSDF(vertScreenSpacePosition, linePtAScreenSpace,linePtBScreenSpace);",
	"      float sdf = 1.-(1./thickness /screenSize.y * 4.0 *distFromLine);",
	"      float sdfOpacity = clamp(sdf / (abs(dFdx(sdf)) + abs(dFdy(sdf))),0.0,1.0);",
	//"      if(opacity * sdfOpacity < 0.1)discard;",
	"      gl_FragColor = vec4(col, opacity * sdfOpacity );",
	"  }",
	"}"].join("\n");

	var uniforms$1 = {
		lineWidth: {
			type: 'f',
			value: 1.0, //currently in units of yHeight*400
		},
		screenSize: {
			value: new THREE.Vector2( 1, 1 ),
		},
		lineJoinType: {
			type: 'f',
			value: LINE_JOIN_TYPES.ROUND,
		},
		opacity: {
			type: 'f',
			value: 1.0,
		},
		aspect: { //aspect ratio. need to load from renderer
			type: 'f',
			value: 1.0,
		}
	};

	const tmpColor = new THREE.Color(0x000000);

	class LineOutput extends OutputNode{
	    constructor(options = {}){
	        super();
	        /* should be .add()ed to a Transformation to work.
	        Crisp lines using the technique in https://mattdesl.svbtle.com/drawing-lines-is-hard, but also supporting mitered lines and beveled lines too!
	            options:
	            {
	                width: number. units are in screenY/400.
	                opacity: number
	                color: hex code or THREE.Color()
	                lineJoin: "bevel" or "round". default: round. Don't change this after initialization.
	            }
	        */

	        this._width = options.width !== undefined ? options.width : 5;
	        this._opacity = options.opacity !== undefined ? options.opacity : 1;

	        this._hasCustomColorFunction = false;
	        if(Utils$1.isFunction(options.color)){
	            this._hasCustomColorFunction = true;
	            this._color = options.color;
	        }else {
	            this._color = options.color !== undefined ? new THREE.Color(options.color) : new THREE.Color(0x55aa55);
	        }

	        this.lineJoinType = options.lineJoinType !== undefined ? options.lineJoinType.toUpperCase() : "BEVEL";
	        if(LINE_JOIN_TYPES[this.lineJoinType] === undefined){
	            this.lineJoinType = "BEVEL";
	        }

	        this.numCallsPerActivation = 0; //should always be equal to this.points.length
	        this.itemDimensions = []; // how many times to be called in each direction
	        this._outputDimensions = 3; //how many dimensions per point to store?

	        this.init();
	    }
	    init(){
	        this._geometry = new THREE.BufferGeometry();
	        this._vertices;
	        this.makeGeometry();


	        //make a deep copy of the uniforms template
	        this._uniforms = {};
	        for(var uniformName in uniforms$1){
	            this._uniforms[uniformName] = {
	                type: uniforms$1[uniformName].type,
	                value: uniforms$1[uniformName].value
	            };
	        }

	        this.material = new THREE.ShaderMaterial({
	            side: THREE.BackSide,
	            vertexShader: vShader$1, 
	            fragmentShader: fShader$1,
	            uniforms: this._uniforms,
	            extensions:{derivatives: true,},
	            alphaTest: 0.5,
	        });

	        this.mesh = new THREE.Mesh(this._geometry,this.material);

	        this.opacity = this._opacity; // setter sets transparent flag if necessary
	        this.color = this._color; //setter sets color attribute
	        this._uniforms.opacity.value = this._opacity;
	        this._uniforms.lineWidth.value = this._width;
	        this._uniforms.lineJoinType.value = LINE_JOIN_TYPES[this.lineJoinType];

	        getThreeEnvironment().scene.add(this.mesh);
	    }

	    makeGeometry(){
	        const MAX_POINTS = 1000; //these arrays get discarded on first activation anyways
	        const NUM_POINTS_PER_VERTEX = 4;

	        let numVerts = (MAX_POINTS-1)*NUM_POINTS_PER_VERTEX;

	        this._vertices = new Float32Array(this._outputDimensions * numVerts);
	        this._nextPointVertices = new Float32Array(this._outputDimensions * numVerts);
	        this._prevPointVertices = new Float32Array(this._outputDimensions * numVerts);
	        this._colors = new Float32Array(numVerts * 3);

	        // build geometry

	        this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
	        this._geometry.addAttribute( 'nextPointPosition', new THREE.Float32BufferAttribute( this._nextPointVertices, this._outputDimensions ) );
	        this._geometry.addAttribute( 'previousPointPosition', new THREE.Float32BufferAttribute( this._prevPointVertices, this._outputDimensions ) );
	        this._geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( this._colors, 3 ) );

	        this._currentPointIndex = 0; //used during updates as a pointer to the buffer
	        this._activatedOnce = false;

	    }
	    _onAdd(){
	        //climb up parent hierarchy to find the Domain node we're rendering from
	        let root = null;
	        try{
	           root = this.getClosestDomain();
	        }catch(error){
	            console.warn(error);
	            return;
	        }
	    
	        //todo: implement something like assert root typeof RootNode

	        this.numCallsPerActivation = root.numCallsPerActivation;
	        this.itemDimensions = root.itemDimensions;
	    }
	    _onFirstActivation(){
	        this._onAdd(); //setup this.numCallsPerActivation and this.itemDimensions. used here again because cloning means the onAdd() might be called before this is connected to a type of domain

	        // perhaps instead of generating a whole new array, this can reuse the old one?

	        const NUM_POINTS_PER_LINE_SEGMENT = 4; //4 used for beveling
	        const numVerts = (this.numCallsPerActivation) * NUM_POINTS_PER_LINE_SEGMENT;

	        let vertices = new Float32Array( this._outputDimensions * numVerts);
	        let nextVertices = new Float32Array( this._outputDimensions * numVerts);
	        let prevVertices = new Float32Array( this._outputDimensions * numVerts);
	        let colors = new Float32Array( 3 * numVerts);

	        let positionAttribute = this._geometry.attributes.position;
	        this._vertices = vertices;
	        positionAttribute.setArray(this._vertices);

	        let prevPointPositionAttribute = this._geometry.attributes.previousPointPosition;
	        this._prevPointVertices = prevVertices;
	        prevPointPositionAttribute.setArray(this._prevPointVertices);

	        let nextPointPositionAttribute = this._geometry.attributes.nextPointPosition;
	        this._nextPointVertices = nextVertices;
	        nextPointPositionAttribute.setArray(this._nextPointVertices);

	        let colorAttribute = this._geometry.attributes.color;
	        this._colors = colors;
	        colorAttribute.setArray(this._colors);

	        //used to differentiate the left border of the line from the right border
	        let direction = new Float32Array(numVerts);
	        for(let i=0; i<numVerts;i++){
	            direction[i] = i%2==0 ? 1 : 0; //alternate -1 and 1
	        }
	        this._geometry.addAttribute( 'direction', new THREE.Float32BufferAttribute( direction, 1) );

	        //used to differentiate the points which move towards prev vertex from points which move towards next vertex
	        let nextOrPrev = new Float32Array(numVerts);
	        for(let i=0; i<numVerts;i++){
	            nextOrPrev[i] = i%4<2 ? 0 : 1; //alternate 0,0, 1,1
	        }
	        this._geometry.addAttribute( 'approachNextOrPrevVertex', new THREE.Float32BufferAttribute( nextOrPrev, 1) );

	        //indices
	        /*
	        For each vertex, we connect it to the next vertex like this:
	        n --n+2--n+4--n+6
	        |  /  | / |  /  |
	       n+1 --n+3--n+5--n+7

	       pt1   pt2 pt2   pt3

	       vertices n,n+1 are around point 1, n+2,n+3,n+4,n+5 are around pt2, n+6,n+7 are for point3. the middle segment (n+2-n+5) is the polygon used for beveling at point 2.

	        then we advance n two at a time to move to the next vertex. vertices n, n+1 represent the same point;
	        they're separated in the vertex shader to a constant screenspace width */
	        let indices = [];
	        for(let vertNum=0;vertNum<(this.numCallsPerActivation-1);vertNum +=1){
	            let firstCoordinate = vertNum % this.itemDimensions[this.itemDimensions.length-1];
	            let endingNewLine = firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1;
	    
	            let vertIndex = vertNum * NUM_POINTS_PER_LINE_SEGMENT;
	            
	            if(!endingNewLine){
	                //these triangles should be disabled when doing round joins
	                if(this.lineJoinType == "BEVEL"){
	                    indices.push( vertIndex+1, vertIndex,   vertIndex+2);
	                    indices.push( vertIndex+1, vertIndex+2, vertIndex+3);
	                }

	                indices.push( vertIndex+3, vertIndex+2, vertIndex+4);
	                indices.push( vertIndex+3, vertIndex+4, vertIndex+5);
	            }
	        }
	        this._geometry.setIndex( indices );

	        if(!this._hasCustomColorFunction){
	            this.setAllVerticesToColor(this.color);
	        }

	        positionAttribute.needsUpdate = true;
	        colorAttribute.needsUpdate = true;
	    }
	    evaluateSelf(i, t, x, y, z, ...otherArgs){
	        if(!this._activatedOnce){
	            this._activatedOnce = true;
	            this._onFirstActivation();    
	        }

	        //it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.

	        //assert i < vertices.count

	        let xValue =  x === undefined ? 0 : x;
	        let yValue =  y === undefined ? 0 : y;
	        let zValue =  z === undefined ? 0 : z;

	        this.saveVertexInfoInBuffers(this._vertices, this._currentPointIndex, xValue,yValue,zValue);

	        if(this._hasCustomColorFunction){
	            let color = this._color(i,t,x,y,z,...otherArgs);
	            //if return type is [r,g,b]
	            if(Utils$1.isArray(color)){
	                this._setColorForVertexRGB(i, color[0],color[1],color[2]);
	            }else {
	                //if return type is either a hex string, THREE.Color, or even an HTML color string
	                tmpColor.set(color);
	                this._setColorForVertex(i, tmpColor);
	            }
	            
	        }

	        /* we're drawing like this:
	        *----*----*

	        *----*----*
	    
	        but we don't want to insert a diagonal line anywhere. This handles that:  */

	        let firstCoordinate = i % this.itemDimensions[this.itemDimensions.length-1];

	        //boolean variables. if in the future LineOutput can support variable-width lines, these should eb changed
	        let startingNewLine = firstCoordinate == 0;
	        let endingNewLine = firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1;

	        if(startingNewLine){
	            //make the prevPoint be the same point as this
	            this.saveVertexInfoInBuffers(this._prevPointVertices, this._currentPointIndex, xValue,yValue,zValue);
	        }else {

	            let prevX = this._vertices[(this._currentPointIndex-1)*this._outputDimensions*4];
	            let prevY = this._vertices[(this._currentPointIndex-1)*this._outputDimensions*4+1];
	            let prevZ = this._vertices[(this._currentPointIndex-1)*this._outputDimensions*4+2];

	            //set this thing's prevPoint to the previous vertex
	            this.saveVertexInfoInBuffers(this._prevPointVertices, this._currentPointIndex, prevX,prevY,prevZ);

	            //set the PREVIOUS point's nextPoint to to THIS vertex.
	            this.saveVertexInfoInBuffers(this._nextPointVertices, this._currentPointIndex-1, xValue,yValue,zValue);
	        }

	        if(endingNewLine){
	            //make the nextPoint be the same point as this
	            this.saveVertexInfoInBuffers(this._nextPointVertices, this._currentPointIndex, xValue,yValue,zValue);
	        }
	        this._currentPointIndex++;
	    }

	    saveVertexInfoInBuffers(array, vertNum, value1,value2,value3){
	        //for every call to activate(), all 4 geometry vertices representing that point need to save that info.
	        //Therefore, this function will spread three coordinates into a given array, repeatedly.

	        let index = vertNum*this._outputDimensions*4;

	        array[index]   = value1;
	        array[index+1] = value2;
	        array[index+2] = value3;

	        array[index+3] = value1;
	        array[index+4] = value2;
	        array[index+5] = value3;

	        array[index+6] = value1;
	        array[index+7] = value2;
	        array[index+8] = value3;

	        array[index+9]  = value1;
	        array[index+10] = value2;
	        array[index+11] = value3;
	        
	    }
	    onAfterActivation(){
	        let positionAttribute = this._geometry.attributes.position;
	        positionAttribute.needsUpdate = true;
	        let prevPointPositionAttribute = this._geometry.attributes.previousPointPosition;
	        prevPointPositionAttribute.needsUpdate = true;
	        let nextPointPositionAttribute = this._geometry.attributes.nextPointPosition;
	        nextPointPositionAttribute.needsUpdate = true;

	        //update aspect ratio. in the future perhaps this should only be changed when the aspect ratio changes so it's not being done per frame?
	        if(this._uniforms){
	            const three = getThreeEnvironment();
	            this._uniforms.aspect.value = three.camera.aspect; //TODO: re-enable once debugging is done
	            three.renderer.getDrawingBufferSize(this._uniforms.screenSize.value); //modifies uniform in place
	        }

	        this._currentPointIndex = 0; //reset after each update
	    }
	    removeSelfFromScene(){
	        getThreeEnvironment().scene.remove(this.mesh);
	    }
	    setAllVerticesToColor(color){
	        const col = new THREE.Color(color);
	        const numVertices = (this.numCallsPerActivation-1)*2;
	        for(let i=0; i<numVertices;i++){
	            //Don't forget some points appear twice - as the end of one line segment and the beginning of the next.
	            this._setColorForVertexRGB(i, col.r, col.g, col.b);
	        }
	        //tell three.js to update colors
	    }
	    _setColorForVertex(vertexIndex, color){
	        //color is a THREE.Color here
	        this._setColorForVertexRGB(vertexIndex, color.r, color.g, color.b);
	    }
	    _setColorForVertexRGB(vertexIndex, normalizedR, normalizedG, normalizedB){
	        //all of normalizedR, normalizedG, normalizedB are 0-1.
	        let colorArray = this._geometry.attributes.color.array;
	        let index = vertexIndex * 3 * 4; //*3 because colors have 3 channels, *4 because 4 vertices/line point

	        colorArray[index + 0] = normalizedR;
	        colorArray[index + 1] = normalizedG;
	        colorArray[index + 2] = normalizedB;

	        colorArray[index + 3] = normalizedR;
	        colorArray[index + 4] = normalizedG;
	        colorArray[index + 5] = normalizedB;

	        colorArray[index + 6] = normalizedR;
	        colorArray[index + 7] = normalizedG;
	        colorArray[index + 8] = normalizedB;

	        colorArray[index + 9] = normalizedR;
	        colorArray[index + 10] = normalizedG;
	        colorArray[index + 11] = normalizedB;

	        let colorAttribute = this._geometry.attributes.color;
	        colorAttribute.needsUpdate = true;
	    }
	    set color(color){
	        //color can be a THREE.Color(), or a function (i,t,x,y,z) => THREE.Color(), which will be called on every point.
	        this._color = color;
	        if(Utils$1.isFunction(color)){
	            this._hasCustomColorFunction = true;
	        }else {
	            this._hasCustomColorFunction = false;
	            this.setAllVerticesToColor(color);
	        }
	    }
	    get color(){
	        return this._color;
	    }
	    set opacity(opacity){
	        //mesh is always transparent
	        this.material.opacity = opacity;
	        this.material.transparent = opacity < 1 || this.lineJoinType == "ROUND";
	        this.material.visible = opacity > 0;
	        this._opacity = opacity;
	        this._uniforms.opacity.value = opacity;
	    }
	    get opacity(){
	        return this._opacity;
	    }
	    set width(width){
	        this._width = width;
	        this._uniforms.lineWidth.value = width;
	    }
	    get width(){
	        return this._width;
	    }
	    clone(){
	        return new LineOutput({width: this.width, color: this.color, opacity: this.opacity, lineJoinType: this.lineJoinType});
	    }
	}

	class PointOutput extends OutputNode{
		constructor(options = {}){
			super();
			/*
				width: number
				color: hex color, as in 0xrrggbb. Technically, this is a JS integer.
				opacity: 0-1. Optional.
			*/

			this._width = options.width !== undefined ? options.width : 1;
			this._color = options.color !== undefined ? new THREE.Color(options.color) : new THREE.Color(0x55aa55);
			this._opacity = options.opacity !== undefined ? options.opacity : 1;

			this.points = [];

	        this.material = new THREE.MeshBasicMaterial({color: this._color});
	        this.opacity = this._opacity; //trigger setter to set this.material's opacity properly

			this.numCallsPerActivation = 0; //should always be equal to this.points.length
			this._activatedOnce = false;
		}
		_onAdd(){ //should be called when this is .add()ed to something
			//climb up parent hierarchy to find the Area
			let root = this.getClosestDomain();

			this.numCallsPerActivation = root.numCallsPerActivation;

			if(this.points.length < this.numCallsPerActivation){
				for(var i=this.points.length;i<this.numCallsPerActivation;i++){
					this.points.push(new PointMesh({width: 1,material:this.material}));
					this.points[i].mesh.scale.setScalar(this._width); //set width by scaling point
				}
			}
		}
		_onFirstActivation(){
			if(this.points.length < this.numCallsPerActivation)this._onAdd();
		}
		evaluateSelf(i, t, x, y, z){
			if(!this._activatedOnce){
				this._activatedOnce = true;
				this._onFirstActivation();	
			}
			//it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.
			var point = this.getPoint(i);
			point.x = x === undefined ? 0 : x;
			point.y = y === undefined ? 0 : y;
			point.z = z === undefined ? 0 : z;
		}
		getPoint(i){
			return this.points[i];
		}
	    removeSelfFromScene(){
			for(var i=0;i<this.points.length;i++){
				this.points[i].removeSelfFromScene();
			}
	    }
		set opacity(opacity){
			//technically this sets all points to the same color. Todo: allow different points to be differently colored.
			
			let mat = this.material;
			mat.opacity = opacity; //instantiate the point
			mat.transparent = opacity < 1;
	        mat.visible = opacity > 0;
			this._opacity = opacity;
		}
		get opacity(){
			return this._opacity;
		}
		set color(color){
	        this.material.color = color;
			this._color = color;
		}
		get color(){
			return this._color;
		}
		set width(width){
			for(var i=0;i<this.points.length;i++){
				this.getPoint(i).mesh.scale.setScalar(width);
			}
			this._width = width;
		}
		get width(){
			return this._width;
		}
		clone(){
			return new PointOutput({width: this.width, color: this.color, opacity: this.opacity});
		}
	}


	class PointMesh{
		constructor(options){
			/*options:
				x,y: numbers
				width: number
	            material: 
			*/

			options.width === undefined ? 1 : options.width;
	        this.material = options.material; //one material per PointOutput

			this.mesh = new THREE.Mesh(this.sharedCircleGeometry,this.material);

			this.mesh.position.set(this.x,this.y,this.z);
			this.mesh.scale.setScalar(this.width/2);
			exports.threeEnvironment.scene.add(this.mesh);

			this.x = options.x || 0;
			this.y = options.y || 0;
			this.z = options.z || 0;
		}
		removeSelfFromScene(){
			exports.threeEnvironment.scene.remove(this.mesh);
		}
		set x(i){
			this.mesh.position.x = i;
		}
		set y(i){
			this.mesh.position.y = i;
		}
		set z(i){
			this.mesh.position.z = i;
		}
		get x(){
			return this.mesh.position.x;
		}
		get y(){
			return this.mesh.position.y;
		}
		get z(){
			return this.mesh.position.z;
		}
	}
	PointMesh.prototype.sharedCircleGeometry = new THREE.SphereGeometry(1/2, 8, 6); //radius 1/2 makes diameter 1, so that scaling by n means width=n

	class VectorOutput extends LineOutput{
	    constructor(options = {}){
	        /*
	                width: number. units are in screenY/400.
	                opacity: number
	                color: hex code or THREE.Color()
	                lineJoin: "bevel" or "round". default: round. Don't change this after initialization.
	        */
	        super(options);

	    }
	    init(){
	        this.arrowMaterial = new THREE.LineBasicMaterial({color: this._color, linewidth: this._width, opacity:this._opacity});

	        super.init();
	        this.arrowheads = [];

	        //TODO: make the arrow tip colors match the colors of the lines' tips

	        const circleResolution = 12;
	        const arrowheadSize = 0.3;
	        const EPSILON = 0.00001;
	        this.EPSILON = EPSILON;

	        this.coneGeometry = new THREE.CylinderBufferGeometry( 0, arrowheadSize, arrowheadSize*1.7, circleResolution, 1 );
	        let arrowheadOvershootFactor = 0.1; //used so that the line won't rudely clip through the point of the arrowhead
	        this.coneGeometry.translate( 0, - arrowheadSize + arrowheadOvershootFactor, 0 );
	        this._coneUpDirection = new THREE.Vector3(0,1,0);
	    }
	    _onFirstActivation(){
	        super._onFirstActivation();

	        if(this.itemDimensions.length > 1){
	            this.numArrowheads = this.itemDimensions.slice(0,this.itemDimensions.length-1).reduce(function(prev, current){
	                return current + prev;
	            });
	        }else {
	            //assumed itemDimensions isn't a nonzero array. That should be the constructor's problem.
	            this.numArrowheads = 1;
	        }

	        //remove any previous arrowheads
	        for(var i=0;i<this.arrowheads.length;i++){
	            let arrow = this.arrowheads[i];
	            exports.threeEnvironment.scene.remove(arrow);
	        }

	        this.arrowheads = new Array(this.numArrowheads);
	        for(var i=0;i<this.numArrowheads;i++){
	            this.arrowheads[i] = new THREE.Mesh(this.coneGeometry, this.arrowMaterial);
	            this.mesh.add(this.arrowheads[i]);
	        }
	    }
	    evaluateSelf(i, t, x, y, z){
	        //it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.
	        super.evaluateSelf(i,t,x,y,z);

	        const lastDimensionLength = this.itemDimensions[this.itemDimensions.length-1];
	        let firstCoordinate = i % lastDimensionLength;
	        let endingNewLine = firstCoordinate == lastDimensionLength-1;

	        if(endingNewLine){
	            //we need to update arrows
	            //calculate direction of last line segment
	            //this point is currentPointIndex-1 because currentPointIndex was increased by 1 during super.evaluateSelf()
	            let index = (this._currentPointIndex-1)*this._outputDimensions*4;

	            let prevX = this._vertices[(this._currentPointIndex-2)*this._outputDimensions*4];
	            let prevY = this._vertices[(this._currentPointIndex-2)*this._outputDimensions*4+1];
	            let prevZ = this._vertices[(this._currentPointIndex-2)*this._outputDimensions*4+2];

	            let dx = prevX - this._vertices[index];
	            let dy = prevY - this._vertices[index+1];
	            let dz = prevZ - this._vertices[index+2];

	            let lineNumber = Math.floor(i / lastDimensionLength);
	            Utils$1.assert(lineNumber <= this.numArrowheads); //this may be wrong

	            let directionVector = new THREE.Vector3(-dx,-dy,-dz);

	            //Make arrows disappear if the line is small enough
	            //One way to do this would be to sum the distances of all line segments. I'm cheating here and just measuring the distance of the last vector, then multiplying by the number of line segments (naively assuming all line segments are the same length)
	            let length = directionVector.length() * (lastDimensionLength-1);

	            const effectiveDistance = 3;
	            let clampedLength = Math.max(0, Math.min(length/effectiveDistance, 1));

	            //shrink function designed to have a steep slope close to 0 but mellow out at 0.5 or so in order to avoid the line width overcoming the arrowhead width
	            //In Chrome, three.js complains whenever something is set to 0 scale. Adding an epsilon term is unfortunate but necessary to avoid console spam.
	            this.arrowheads[lineNumber].scale.setScalar(Math.acos(1-2*clampedLength)/Math.PI + this.EPSILON);
	            
	             //position/rotation comes after since .normalize() modifies directionVector in place
	            let pos = this.arrowheads[lineNumber].position;
	            pos.x = x === undefined ? 0 : x;
	            pos.y = y === undefined ? 0 : y;
	            pos.z = z === undefined ? 0 : z;

	            if(length > 0){ //directionVector.normalize() fails with 0 length
	                this.arrowheads[lineNumber].quaternion.setFromUnitVectors(this._coneUpDirection, directionVector.normalize() );
	            }
	        }
	    }

	    set color(color){
	        //currently only a single color is supported.
	        //I should really make it possible to specify color by a function.
	        this._color = color;
	        this.setAllVerticesToColor(color);
	        this.arrowMaterial.color = new THREE.Color(this._color);
	    }

	    get color(){
	        return this._color;
	    }

	    set opacity(opacity){
	        this.arrowMaterial.opacity = opacity;
	        this.arrowMaterial.transparent = opacity < 1;
	        this.material.transparent = opacity < 1 || this.lineJoinType == "ROUND";
	        this.arrowMaterial.visible = opacity > 0;

	        //mesh is always transparent
	        this.material.opacity = opacity;
	        this.material.visible = opacity > 0;
	        this._opacity = opacity;
	        this._uniforms.opacity.value = opacity;
	    }

	    get opacity(){
	        return this._opacity;
	    }
	    removeSelfFromScene(){
	        exports.threeEnvironment.scene.remove(this.mesh);
	        for(var i=0;i<this.numArrowheads;i++){
	            exports.threeEnvironment.scene.remove(this.arrowheads[i]);
	        }
	    }
	    clone(){
	        return new VectorOutput({width: this.width, color: this.color, opacity: this.opacity,lineJoinType: this.lineJoinType});
	    }
	}

	//SurfaceOutputShaders.js

	//experiment: shaders to get the triangle pulsating!
	var vShader = [
	"varying vec3 vNormal;",
	"varying vec3 vPosition;",
	"varying vec2 vUv;",
	"uniform float time;",
	"uniform vec3 color;",
	"uniform vec3 vLight;",
	"uniform float gridSquares;",

	"void main() {",
		"vPosition = position.xyz;",
		"vNormal = normal.xyz;",
		"vUv = uv.xy;",
		"gl_Position = projectionMatrix *",
	            "modelViewMatrix *",
	            "vec4(position,1.0);",
	"}"].join("\n");

	var fShader = [
	"#extension GL_OES_standard_derivatives : enable",
	"varying vec3 vNormal;",
	"varying vec3 vPosition;",
	"varying vec2 vUv;",
	"uniform float time;",
	"uniform vec3 color;",
	"uniform float useCustomGridColor;",
	"uniform vec3 gridColor;",
	"uniform vec3 vLight;",
	"uniform float gridSquares;",
	"uniform float lineWidth;",
	"uniform float showGrid;",
	"uniform float showSolid;",
	"uniform float opacity;",

		//the following code from https://github.com/unconed/mathbox/blob/eaeb8e15ef2d0252740a74505a12d7a1051a61b6/src/shaders/glsl/mesh.fragment.shaded.glsl
	"vec3 offSpecular(vec3 color) {",
	"  vec3 c = 1.0 - color;",
	"  return 1.0 - c * c;",
	"}",

	"vec4 getShadedColor(vec3 rgb) { ",
	"  vec3 color = rgb.xyz;",
	"  vec3 color2 = offSpecular(rgb.xyz);",

	"  vec3 normal = normalize(vNormal);",
	"  vec3 light = normalize(vLight);",
	"  vec3 position = normalize(vPosition);",

	"  float side    = gl_FrontFacing ? -1.0 : 1.0;",
	"  float cosine  = side * dot(normal, light);",
	"  float diffuse = mix(max(0.0, cosine), .5 + .5 * cosine, .1);",

	"  float rimLighting = max(min(1.0 - side*dot(normal, light), 1.0),0.0);",

	"	float specular = max(0.0, abs(cosine) - 0.5);", //double sided specular
	"   return vec4(diffuse*color + 0.9*rimLighting*color + 0.4*color2 * specular,1.0);",
	"}",

	// Smooth HSV to RGB conversion from https://www.shadertoy.com/view/MsS3Wc
	"vec3 hsv2rgb_smooth( in vec3 c ){",
	"    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );",
	"	rgb = rgb*rgb*(3.0-2.0*rgb); // cubic smoothing	",
	"	return c.z * mix( vec3(1.0), rgb, c.y);",
	"}",

	//From Sam Hocevar: http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
	"vec3 rgb2hsv(vec3 c){",
	"    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);",
	"    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));",
	"    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));",

	"    float d = q.x - min(q.w, q.y);",
	"    float e = 1.0e-10;",
	"    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);",
	"}",
	 //chooses the color for the gridlines by varying lightness. 
	//NOT continuous or else by the intermediate function theorem there'd be a point where the gridlines were the same color as the material.
	"vec3 autoCalculatedGridLineColor(vec3 diffuseColor){",
	" vec3 hsv = rgb2hsv(diffuseColor.xyz);",
	" //hsv.x += 0.1;",
	" if(hsv.z < 0.8){hsv.z += 0.2;}else{hsv.z = 0.85-0.1*hsv.z;hsv.y -= 0.0;}",
	" vec3 autoCalculatedColor = hsv2rgb_smooth(hsv);",
	" return mix(autoCalculatedColor, diffuseColor, (1.0-showSolid)*(1.0-useCustomGridColor));", //if showSolid is 0.0 and useCustomGridColor is 0.0, just use the diffuse color as the grid color
	"}",

	"vec4 renderGridlines(vec4 existingColor, vec2 uv, vec3 chosenGridLineColor) {",
	"  vec2 vdistToGridEdge = (0.5-abs(mod(vUv.xy*gridSquares, 1.0)-0.5));", //thanks, desmos
	"  float distToGridEdge = min(vdistToGridEdge.x,vdistToGridEdge.y);",
	"  vec4 blendedGridLineColor = showGrid * vec4(chosenGridLineColor,1.0) + (1.0-showGrid)*existingColor.rgba;", //if showGrid =0, use solidColor as the gridline color, hiding the grid
	"  float blendBetweenGridColorVsSolidColorFactor = (smoothstep(lineWidth-1.*fwidth(distToGridEdge), lineWidth, distToGridEdge));", //if distToEdge.x < lineWidth || distToEdge.y < lineWidth, but with a smoothstep
	"  return mix(blendedGridLineColor,existingColor,blendBetweenGridColorVsSolidColorFactor);",
	"}",
	/*
	"vec4 getShadedColorMathbox(vec4 rgba) { ",
	"  vec3 color = rgba.xyz;",
	"  vec3 color2 = offSpecular(rgba.xyz);",

	"  vec3 normal = normalize(vNormal);",
	"  vec3 light = normalize(vLight);",
	"  vec3 position = normalize(vPosition);",
	"  float side    = gl_FrontFacing ? -1.0 : 1.0;",
	"  float cosine  = side * dot(normal, light);",
	"  float diffuse = mix(max(0.0, cosine), .5 + .5 * cosine, .1);",
	"   vec3  halfLight = normalize(light + position);",
	"	float cosineHalf = max(0.0, side * dot(normal, halfLight));",
	"	float specular = pow(cosineHalf, 16.0);",
	"	return vec4(color * (diffuse * .9 + .05) *0.0 +  .25 * color2 * specular, rgba.a);",
	"}",*/

	"void main(){",
	//"  //gl_FragColor = vec4(vNormal.xyz, 1.0); // view debug normals",
	//"  //if(vNormal.x < 0.0){gl_FragColor = vec4(offSpecular(color.rgb), 1.0);}else{gl_FragColor = vec4((color.rgb), 1.0);}", //view specular and non-specular colors
	//"  gl_FragColor = vec4(mod(vUv.xy,1.0),0.0,1.0); //show uvs
	"  vec4 solidColor = showSolid*showSolid*vec4(color.rgb, 1.0);",
	"  vec4 solidColorOut = showSolid*getShadedColor(color.rgb);",
	"  vec3 chosenGridLineColor = mix(autoCalculatedGridLineColor(color.rgb), gridColor, useCustomGridColor); ", //use either autoCalculatedGridLineColor(color) or override with user-specified gridColor variable.
	"  vec4 colorWithGridlines = renderGridlines(solidColorOut, vUv.xy, chosenGridLineColor);",
	"  colorWithGridlines.a *= opacity;",
	"  gl_FragColor = colorWithGridlines;",	
	"}"].join("\n");

	var uniforms = {
		time: {
			type: 'f',
			value: 0,
		},
		color: {
			type: 'c',
			value: new THREE.Color(0x55aa55),
		},
		useCustomGridColor: {
			type: 'f',
			value: 0,
		},
		gridColor: {
			type: 'c',
			value: new THREE.Color(0x55aa55),
		},
		opacity: {
			type: 'f',
			value: 0.1,
		},
		vLight: { //light direction
			type: 'vec3',
			value: [0,0,1],
		},
		gridSquares: {
			type: 'f',
			value: 4,
		},
		lineWidth: {
			type: 'f',
			value: 0.1,
		},
		showGrid: {
			type: 'f',
			value: 1.0,
		},
		showSolid: {
			type: 'f',
			value: 1.0,
		}
	};

	class SurfaceOutput extends OutputNode{
		constructor(options = {}){
			super();
			/* should be .add()ed to a Transformation to work
				options:
				{
					opacity: number
					color: hex code or THREE.Color(). Diffuse color of this surface.
					gridColor: hex code or THREE.Color(). If showGrid is true, grid lines will appear over this surface. gridColor determines their color 
					showGrid: boolean. If true, will display a gridColor-colored grid over the surface. Default: true
					showSolid: boolean. If true, will display a solid surface. Default: true
					gridSquares: number representing how many squares per dimension to use in a rendered grid
					gridLineWidth: number representing how many squares per dimension to use in a rendered grid
				}
			*/
			this._opacity = options.opacity !== undefined ? options.opacity : 1;

			this._color = options.color !== undefined ? new THREE.Color(options.color) : new THREE.Color(0x55aa55);

			this._gridColor = options.gridColor;
	        this._useCustomGridColor = options.gridColor !== undefined;

			this._gridSquares = options.gridSquares !== undefined ? options.gridSquares : 16;
			this._showGrid = options.showGrid !== undefined ? options.showGrid : true;
			this._showSolid = options.showSolid !== undefined ? options.showSolid : true;
			this._gridLineWidth = options.gridLineWidth !== undefined ? options.gridLineWidth : 0.15;

			this.numCallsPerActivation = 0; //should always be equal to this.vertices.length
			this.itemDimensions = []; // how many times to be called in each direction
			this._outputDimensions = 3; //how many dimensions per point to store?

			this.init();
		}
		init(){
			this._geometry = new THREE.BufferGeometry();
			this._vertices;
			this.makeGeometry();

			//make a deep copy of the uniforms template
			this._uniforms = {};
			for(var uniformName in uniforms){
				this._uniforms[uniformName] = {
					type: uniforms[uniformName].type,
					value: uniforms[uniformName].value
				};
			}

			this.material = new THREE.ShaderMaterial({
				side: THREE.BackSide,
				vertexShader: vShader, 
				fragmentShader: fShader,
				uniforms: this._uniforms,
				});
			this.mesh = new THREE.Mesh(this._geometry,this.material);

			this.opacity = this._opacity; // setter sets transparent flag if necessary
			this.color = this._color; //setter sets color uniform
			this._uniforms.opacity.value = this._opacity;
			this._uniforms.gridSquares.value = this._gridSquares;
			this._uniforms.showGrid.value = this.toNum(this._showGrid);
			this._uniforms.showSolid.value = this.toNum(this._showSolid);
			this._uniforms.lineWidth.value = this._gridLineWidth;
	        this._uniforms.useCustomGridColor.value = this._useCustomGridColor ? 1.0 : 0.0;
	        if(this._useCustomGridColor){
			    this._uniforms.gridColor.value = new THREE.Color(this._gridColor);
	        }

			getThreeEnvironment().scene.add(this.mesh);
		}
	    toNum(x){
	        if(x == false)return 0;
	        if(x == true)return 1;
	        return x;
	    }
		makeGeometry(){

			let MAX_POINTS = 10000;

			this._vertices = new Float32Array(MAX_POINTS * this._outputDimensions);
			this._normals = new Float32Array(MAX_POINTS * 3);
			this._uvs = new Float32Array(MAX_POINTS * 2);

			// build geometry

			this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
			this._geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( this._normals, 3 ) );
			this._geometry.addAttribute( 'uv', new THREE.Float32BufferAttribute( this._uvs, 2 ) );

			this._currentPointIndex = 0; //used during updates as a pointer to the buffer

			this._activatedOnce = false;

		}
		_setUVs(uvs, index, u, v){

		}
		_onFirstActivation(){
	        //setup this.numCallsPerActivation and this.itemDimensions. used here again because cloning means the onAdd() might be called before this is connected to a type of domain

			//climb up parent hierarchy to find the DomainNode we're rendering from
			let root = this.getClosestDomain();
			this.numCallsPerActivation = root.numCallsPerActivation;
			this.itemDimensions = root.itemDimensions;

			// perhaps instead of generating a whole new array, this can reuse the old one?
			let vertices = new Float32Array(this.numCallsPerActivation * this._outputDimensions);
			let normals = new Float32Array(this.numCallsPerActivation * 3);
			let uvs = new Float32Array(this.numCallsPerActivation * 2);

			let positionAttribute = this._geometry.attributes.position;
			this._vertices = vertices;
			positionAttribute.setArray(this._vertices);
			positionAttribute.needsUpdate = true;

			let normalAttribute = this._geometry.attributes.normal;
			this._normals = normals;
			normalAttribute.setArray(this._normals);
			normalAttribute.needsUpdate = true;

			let uvAttribute = this._geometry.attributes.uv;


			//assert this.itemDimensions[0] * this.itemDimensions[1] = this.numCallsPerActivation and this._outputDimensions == 2
			var indices = [];
			let i=0, j=0;
			for(j=0;j<this.itemDimensions[0]-1;j++){
				for(i=0;i<this.itemDimensions[1]-1;i++){

					let a = i + j * this.itemDimensions[1];
					let b = i + (j+1) * this.itemDimensions[1];
					let c = (i+1)+ (j+1) * this.itemDimensions[1];
					let d = (i+1)+ j * this.itemDimensions[1];

	        		indices.push(a, b, d);
					indices.push(b, c, d);
					
					//double sided reverse faces
	        		indices.push(d, b, a);
					indices.push(d, c, b);

				}
			}

			//normals (will be overwritten later) and uvs
			for(j=0;j<this.itemDimensions[0];j++){
				for(i=0;i<this.itemDimensions[1];i++){

					let pointIndex = i + j * this.itemDimensions[1];
					//set normal to [0,0,1] as a temporary value
					normals[(pointIndex)*3] = 0;
					normals[(pointIndex)*3+1] = 0;
					normals[(pointIndex)*3+2] = 1;

					//uvs
					uvs[(pointIndex)*2] = j/(this.itemDimensions[0]-1);
					uvs[(pointIndex)*2+1] = i/(this.itemDimensions[1]-1);
				}
			}

			this._uvs = uvs;
			uvAttribute.setArray(this._uvs);
			uvAttribute.needsUpdate = true;

			this._geometry.setIndex( indices );
		}
		evaluateSelf(i, t, x, y, z){
			if(!this._activatedOnce){
				this._activatedOnce = true;
				this._onFirstActivation();	
			}

			//it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.

			//assert i < vertices.count

			let index = this._currentPointIndex*this._outputDimensions;

		    this._vertices[index]   = x === undefined ? 0 : x;
			this._vertices[index+1] = y === undefined ? 0 : y;
			this._vertices[index+2] = z === undefined ? 0 : z;

			this._currentPointIndex++;
		}
		onAfterActivation(){
			let positionAttribute = this._geometry.attributes.position;
			positionAttribute.needsUpdate = true;

			this._recalcNormals();
			let normalAttribute = this._geometry.attributes.normal;
			normalAttribute.needsUpdate = true;

			this._currentPointIndex = 0; //reset after each update
	        if(this.opacity < 1 && this.opacity > 0){
	            this.sortFacesByDepth();
	        }
		}
	    sortFacesByDepth(){
	        //if this surface is transparent, for proper face rendering we should sort the faces so that they're drawn from back to front
	        let indexArray = this._geometry.index.array;
	        let positionArray = this._geometry.attributes.position.array;

	        let numFaces = this._geometry.index.array.length/3;

	        let distancesForEachFaceToCamera = new Float32Array(numFaces);
	        let cameraPos = getThreeEnvironment().camera.position;

	        for(let faceNo=0;faceNo<numFaces;faceNo++){
	            // the index array stores the indices of the 3 vertices which make a triangle, in order
				let vert1Index = indexArray[3*faceNo];
	            let vert2Index = indexArray[3*faceNo+1];
	            let vert3Index = indexArray[3*faceNo+2];

	            let centroidX = (positionArray[3*vert1Index] +positionArray[3*vert2Index]  +positionArray[3*vert3Index])/3;
			    let centroidY = (positionArray[3*vert1Index+1]+positionArray[3*vert2Index+1]+positionArray[3*vert3Index+1])/3; //Y
				let centroidZ = (positionArray[3*vert1Index+2]+positionArray[3*vert2Index+2]+positionArray[3*vert3Index+2])/3;

	            //compute distance from centroid to camera
	            let dx = centroidX - cameraPos.x;
	            let dy = centroidY - cameraPos.y;
	            let dz = centroidZ - cameraPos.z;
	            distancesForEachFaceToCamera[faceNo] = Math.sqrt(dx*dx + dy*dy + dz*dz);
	        }

	        //run insertion sort on distancesForEachFaceToCamera. every time you move a piece there, move the things in indexArray too
	        for(let i=1;i<numFaces;i++){
	            let j = i;
	            while(j > 0 && distancesForEachFaceToCamera[j-1] < distancesForEachFaceToCamera[j]){
	                //swap distancesForEachFaceToCamera[j] and distancesForEachFaceToCamera[j-1]
	                let temp = distancesForEachFaceToCamera[j];
	                distancesForEachFaceToCamera[j] = distancesForEachFaceToCamera[j-1];
	                distancesForEachFaceToCamera[j-1] = temp;

	                //also swap the indices for face #j and face #j-1, so this sort uses distancesForEachFaceToCamera as the key
	                let vert1Index = indexArray[3*j];
	                let vert2Index = indexArray[3*j+1];
	                let vert3Index = indexArray[3*j+2];

	                indexArray[3*j] = indexArray[3*(j-1)];
	                indexArray[3*j+1] = indexArray[3*(j-1)+1];
	                indexArray[3*j+2] = indexArray[3*(j-1)+2];

	                indexArray[3*(j-1)] = vert1Index;
	                indexArray[3*(j-1)+1] = vert2Index;
	                indexArray[3*(j-1)+2] = vert3Index;
	                j--;
	            }
	        }
	        //now indexArray is sorted according to the distance to the camera
	        this._geometry.index.needsUpdate = true;
	    }
		_recalcNormals(){
			this._geometry.attributes.position;
			this._geometry.attributes.normal;
			//rendered triangle indices
			//from three.js PlaneGeometry.js
			let normalVec = new THREE.Vector3();
			let partialX = new THREE.Vector3();
			let partialY = new THREE.Vector3();
			let negationFactor = 1;
			let i=0, j=0;
			for(j=0;j<this.itemDimensions[0];j++){
				for(i=0;i<this.itemDimensions[1];i++){

					//currently doing the normal for the point at index a.
					let a = i + j * this.itemDimensions[1];
					let b,c;

					//Tangents are calculated with finite differences - For (x,y), compute the partial derivatives using (x+1,y) and (x,y+1) and cross them. But if you're at theborder, x+1 and y+1 might not exist. So in that case we go backwards and use (x-1,y) and (x,y-1) instead.
					//When that happens, the vector subtraction will subtract the wrong way, introducing a factor of -1 into the cross product term. So negationFactor keeps track of when that happens and is multiplied again to cancel it out.
					negationFactor = 1; 

					//b is the index of the point 1 away in the y direction
					if(i < this.itemDimensions[1]-1){
						b = (i+1) + j * this.itemDimensions[1];
					}else {
						//end of the y axis, go backwards for tangents
						b = (i-1) + j * this.itemDimensions[1];
						negationFactor *= -1;
					}

					//c is the index of the point 1 away in the x direction
					if(j < this.itemDimensions[0]-1){
						c = i + (j+1) * this.itemDimensions[1];
					}else {
						//end of the x axis, go backwards for tangents
						c = i + (j-1) * this.itemDimensions[1];
						negationFactor *= -1;
					}

					//the vector b-a. 
					//this._vertices stores the components of each vector in one big float32array, so this pulls them out and just does the subtraction numerically. The components of vector #52 are x:52*3+0,y:52*3+1,z:52*3+2, for example.
					partialY.set(this._vertices[b*3]-this._vertices[a*3],this._vertices[b*3+1]-this._vertices[a*3+1],this._vertices[b*3+2]-this._vertices[a*3+2]);
					//the vector c-a.
					partialX.set(this._vertices[c*3]-this._vertices[a*3],this._vertices[c*3+1]-this._vertices[a*3+1],this._vertices[c*3+2]-this._vertices[a*3+2]);

					//b-a cross c-a
					normalVec.crossVectors(partialX,partialY).normalize();
					normalVec.multiplyScalar(negationFactor);
					//set normal
					this._normals[(i + j * this.itemDimensions[1])*3] = normalVec.x;
					this._normals[(i + j * this.itemDimensions[1])*3+1] = normalVec.y;
					this._normals[(i + j * this.itemDimensions[1])*3+2] = normalVec.z;
				}
			}
			// don't forget to normalAttribute.needsUpdate = true after calling this!
		}
	    removeSelfFromScene(){
	        threeEnvironment.scene.remove(this.mesh);
	    }
		set color(color){
			//currently only a single color is supported.
			//I should really make this a function
			this._color = color;
			this._uniforms.color.value = new THREE.Color(color);
		}
		get color(){
			return this._color;
		}
		set gridColor(color){
			//currently only a single color is supported.
			//I should really make this a function
			this._gridColor = color;
			this._uniforms.gridColor.value = new THREE.Color(color);
	        this._uniforms.useCustomGridColor.value = 1.0;
		}
		get gridColor(){
			return this._gridColor;
		}
		set opacity(opacity){
			this.material.opacity = opacity;
			this.material.transparent = (opacity < 1) || (!this._showSolid);
	        this.material.depthWrite = !this.material.transparent; // only depthWrite if not transparent, so that things show up behind this

			this.material.visible = opacity > 0;
			this._opacity = opacity;
	        this._uniforms.opacity.value = opacity;
		}
		get opacity(){
			return this._opacity;
		}
		clone(){
			return new SurfaceOutput({color: this.color, opacity: this.opacity});
		}
	}

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
	            this.array[this._currentArrayIndex] = coords[j];
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

	/**
	 * Downloaded from https://github.com/mrdoob/three.js/blob/master/src/extras/Earcut.js August 2021
	 * MIT Licensed
	 * Port from https://github.com/mapbox/earcut (v2.2.2)
	 */

	const Earcut = {

		triangulate: function ( data, holeIndices, dim = 2 ) {

			const hasHoles = holeIndices && holeIndices.length;
			const outerLen = hasHoles ? holeIndices[ 0 ] * dim : data.length;
			let outerNode = linkedList( data, 0, outerLen, dim, true );
			const triangles = [];

			if ( ! outerNode || outerNode.next === outerNode.prev ) return triangles;

			let minX, minY, maxX, maxY, x, y, invSize;

			if ( hasHoles ) outerNode = eliminateHoles( data, holeIndices, outerNode, dim );

			// if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
			if ( data.length > 80 * dim ) {

				minX = maxX = data[ 0 ];
				minY = maxY = data[ 1 ];

				for ( let i = dim; i < outerLen; i += dim ) {

					x = data[ i ];
					y = data[ i + 1 ];
					if ( x < minX ) minX = x;
					if ( y < minY ) minY = y;
					if ( x > maxX ) maxX = x;
					if ( y > maxY ) maxY = y;

				}

				// minX, minY and invSize are later used to transform coords into integers for z-order calculation
				invSize = Math.max( maxX - minX, maxY - minY );
				invSize = invSize !== 0 ? 1 / invSize : 0;

			}

			earcutLinked( outerNode, triangles, dim, minX, minY, invSize );

			return triangles;

		}

	};

	// create a circular doubly linked list from polygon points in the specified winding order
	function linkedList( data, start, end, dim, clockwise ) {

		let i, last;

		if ( clockwise === ( signedArea( data, start, end, dim ) > 0 ) ) {

			for ( i = start; i < end; i += dim ) last = insertNode( i, data[ i ], data[ i + 1 ], last );

		} else {

			for ( i = end - dim; i >= start; i -= dim ) last = insertNode( i, data[ i ], data[ i + 1 ], last );

		}

		if ( last && equals( last, last.next ) ) {

			removeNode( last );
			last = last.next;

		}

		return last;

	}

	// eliminate colinear or duplicate points
	function filterPoints( start, end ) {

		if ( ! start ) return start;
		if ( ! end ) end = start;

		let p = start,
			again;
		do {

			again = false;

			if ( ! p.steiner && ( equals( p, p.next ) || area( p.prev, p, p.next ) === 0 ) ) {

				removeNode( p );
				p = end = p.prev;
				if ( p === p.next ) break;
				again = true;

			} else {

				p = p.next;

			}

		} while ( again || p !== end );

		return end;

	}

	// main ear slicing loop which triangulates a polygon (given as a linked list)
	function earcutLinked( ear, triangles, dim, minX, minY, invSize, pass ) {

		if ( ! ear ) return;

		// interlink polygon nodes in z-order
		if ( ! pass && invSize ) indexCurve( ear, minX, minY, invSize );

		let stop = ear,
			prev, next;

		// iterate through ears, slicing them one by one
		while ( ear.prev !== ear.next ) {

			prev = ear.prev;
			next = ear.next;

			if ( invSize ? isEarHashed( ear, minX, minY, invSize ) : isEar( ear ) ) {

				// cut off the triangle
				triangles.push( prev.i / dim );
				triangles.push( ear.i / dim );
				triangles.push( next.i / dim );

				removeNode( ear );

				// skipping the next vertex leads to less sliver triangles
				ear = next.next;
				stop = next.next;

				continue;

			}

			ear = next;

			// if we looped through the whole remaining polygon and can't find any more ears
			if ( ear === stop ) {

				// try filtering points and slicing again
				if ( ! pass ) {

					earcutLinked( filterPoints( ear ), triangles, dim, minX, minY, invSize, 1 );

					// if this didn't work, try curing all small self-intersections locally

				} else if ( pass === 1 ) {

					ear = cureLocalIntersections( filterPoints( ear ), triangles, dim );
					earcutLinked( ear, triangles, dim, minX, minY, invSize, 2 );

					// as a last resort, try splitting the remaining polygon into two

				} else if ( pass === 2 ) {

					splitEarcut( ear, triangles, dim, minX, minY, invSize );

				}

				break;

			}

		}

	}

	// check whether a polygon node forms a valid ear with adjacent nodes
	function isEar( ear ) {

		const a = ear.prev,
			b = ear,
			c = ear.next;

		if ( area( a, b, c ) >= 0 ) return false; // reflex, can't be an ear

		// now make sure we don't have other points inside the potential ear
		let p = ear.next.next;

		while ( p !== ear.prev ) {

			if ( pointInTriangle( a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y ) &&
				area( p.prev, p, p.next ) >= 0 ) return false;
			p = p.next;

		}

		return true;

	}

	function isEarHashed( ear, minX, minY, invSize ) {

		const a = ear.prev,
			b = ear,
			c = ear.next;

		if ( area( a, b, c ) >= 0 ) return false; // reflex, can't be an ear

		// triangle bbox; min & max are calculated like this for speed
		const minTX = a.x < b.x ? ( a.x < c.x ? a.x : c.x ) : ( b.x < c.x ? b.x : c.x ),
			minTY = a.y < b.y ? ( a.y < c.y ? a.y : c.y ) : ( b.y < c.y ? b.y : c.y ),
			maxTX = a.x > b.x ? ( a.x > c.x ? a.x : c.x ) : ( b.x > c.x ? b.x : c.x ),
			maxTY = a.y > b.y ? ( a.y > c.y ? a.y : c.y ) : ( b.y > c.y ? b.y : c.y );

		// z-order range for the current triangle bbox;
		const minZ = zOrder( minTX, minTY, minX, minY, invSize ),
			maxZ = zOrder( maxTX, maxTY, minX, minY, invSize );

		let p = ear.prevZ,
			n = ear.nextZ;

		// look for points inside the triangle in both directions
		while ( p && p.z >= minZ && n && n.z <= maxZ ) {

			if ( p !== ear.prev && p !== ear.next &&
				pointInTriangle( a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y ) &&
				area( p.prev, p, p.next ) >= 0 ) return false;
			p = p.prevZ;

			if ( n !== ear.prev && n !== ear.next &&
				pointInTriangle( a.x, a.y, b.x, b.y, c.x, c.y, n.x, n.y ) &&
				area( n.prev, n, n.next ) >= 0 ) return false;
			n = n.nextZ;

		}

		// look for remaining points in decreasing z-order
		while ( p && p.z >= minZ ) {

			if ( p !== ear.prev && p !== ear.next &&
				pointInTriangle( a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y ) &&
				area( p.prev, p, p.next ) >= 0 ) return false;
			p = p.prevZ;

		}

		// look for remaining points in increasing z-order
		while ( n && n.z <= maxZ ) {

			if ( n !== ear.prev && n !== ear.next &&
				pointInTriangle( a.x, a.y, b.x, b.y, c.x, c.y, n.x, n.y ) &&
				area( n.prev, n, n.next ) >= 0 ) return false;
			n = n.nextZ;

		}

		return true;

	}

	// go through all polygon nodes and cure small local self-intersections
	function cureLocalIntersections( start, triangles, dim ) {

		let p = start;
		do {

			const a = p.prev,
				b = p.next.next;

			if ( ! equals( a, b ) && intersects( a, p, p.next, b ) && locallyInside( a, b ) && locallyInside( b, a ) ) {

				triangles.push( a.i / dim );
				triangles.push( p.i / dim );
				triangles.push( b.i / dim );

				// remove two nodes involved
				removeNode( p );
				removeNode( p.next );

				p = start = b;

			}

			p = p.next;

		} while ( p !== start );

		return filterPoints( p );

	}

	// try splitting polygon into two and triangulate them independently
	function splitEarcut( start, triangles, dim, minX, minY, invSize ) {

		// look for a valid diagonal that divides the polygon into two
		let a = start;
		do {

			let b = a.next.next;
			while ( b !== a.prev ) {

				if ( a.i !== b.i && isValidDiagonal( a, b ) ) {

					// split the polygon in two by the diagonal
					let c = splitPolygon( a, b );

					// filter colinear points around the cuts
					a = filterPoints( a, a.next );
					c = filterPoints( c, c.next );

					// run earcut on each half
					earcutLinked( a, triangles, dim, minX, minY, invSize );
					earcutLinked( c, triangles, dim, minX, minY, invSize );
					return;

				}

				b = b.next;

			}

			a = a.next;

		} while ( a !== start );

	}

	// link every hole into the outer loop, producing a single-ring polygon without holes
	function eliminateHoles( data, holeIndices, outerNode, dim ) {

		const queue = [];
		let i, len, start, end, list;

		for ( i = 0, len = holeIndices.length; i < len; i ++ ) {

			start = holeIndices[ i ] * dim;
			end = i < len - 1 ? holeIndices[ i + 1 ] * dim : data.length;
			list = linkedList( data, start, end, dim, false );
			if ( list === list.next ) list.steiner = true;
			queue.push( getLeftmost( list ) );

		}

		queue.sort( compareX );

		// process holes from left to right
		for ( i = 0; i < queue.length; i ++ ) {

			eliminateHole( queue[ i ], outerNode );
			outerNode = filterPoints( outerNode, outerNode.next );

		}

		return outerNode;

	}

	function compareX( a, b ) {

		return a.x - b.x;

	}

	// find a bridge between vertices that connects hole with an outer ring and and link it
	function eliminateHole( hole, outerNode ) {

		outerNode = findHoleBridge( hole, outerNode );
		if ( outerNode ) {

			const b = splitPolygon( outerNode, hole );

			// filter collinear points around the cuts
			filterPoints( outerNode, outerNode.next );
			filterPoints( b, b.next );

		}

	}

	// David Eberly's algorithm for finding a bridge between hole and outer polygon
	function findHoleBridge( hole, outerNode ) {

		let p = outerNode;
		const hx = hole.x;
		const hy = hole.y;
		let qx = - Infinity, m;

		// find a segment intersected by a ray from the hole's leftmost point to the left;
		// segment's endpoint with lesser x will be potential connection point
		do {

			if ( hy <= p.y && hy >= p.next.y && p.next.y !== p.y ) {

				const x = p.x + ( hy - p.y ) * ( p.next.x - p.x ) / ( p.next.y - p.y );
				if ( x <= hx && x > qx ) {

					qx = x;
					if ( x === hx ) {

						if ( hy === p.y ) return p;
						if ( hy === p.next.y ) return p.next;

					}

					m = p.x < p.next.x ? p : p.next;

				}

			}

			p = p.next;

		} while ( p !== outerNode );

		if ( ! m ) return null;

		if ( hx === qx ) return m; // hole touches outer segment; pick leftmost endpoint

		// look for points inside the triangle of hole point, segment intersection and endpoint;
		// if there are no points found, we have a valid connection;
		// otherwise choose the point of the minimum angle with the ray as connection point

		const stop = m,
			mx = m.x,
			my = m.y;
		let tanMin = Infinity, tan;

		p = m;

		do {

			if ( hx >= p.x && p.x >= mx && hx !== p.x &&
					pointInTriangle( hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y ) ) {

				tan = Math.abs( hy - p.y ) / ( hx - p.x ); // tangential

				if ( locallyInside( p, hole ) && ( tan < tanMin || ( tan === tanMin && ( p.x > m.x || ( p.x === m.x && sectorContainsSector( m, p ) ) ) ) ) ) {

					m = p;
					tanMin = tan;

				}

			}

			p = p.next;

		} while ( p !== stop );

		return m;

	}

	// whether sector in vertex m contains sector in vertex p in the same coordinates
	function sectorContainsSector( m, p ) {

		return area( m.prev, m, p.prev ) < 0 && area( p.next, m, m.next ) < 0;

	}

	// interlink polygon nodes in z-order
	function indexCurve( start, minX, minY, invSize ) {

		let p = start;
		do {

			if ( p.z === null ) p.z = zOrder( p.x, p.y, minX, minY, invSize );
			p.prevZ = p.prev;
			p.nextZ = p.next;
			p = p.next;

		} while ( p !== start );

		p.prevZ.nextZ = null;
		p.prevZ = null;

		sortLinked( p );

	}

	// Simon Tatham's linked list merge sort algorithm
	// http://www.chiark.greenend.org.uk/~sgtatham/algorithms/listsort.html
	function sortLinked( list ) {

		let i, p, q, e, tail, numMerges, pSize, qSize,
			inSize = 1;

		do {

			p = list;
			list = null;
			tail = null;
			numMerges = 0;

			while ( p ) {

				numMerges ++;
				q = p;
				pSize = 0;
				for ( i = 0; i < inSize; i ++ ) {

					pSize ++;
					q = q.nextZ;
					if ( ! q ) break;

				}

				qSize = inSize;

				while ( pSize > 0 || ( qSize > 0 && q ) ) {

					if ( pSize !== 0 && ( qSize === 0 || ! q || p.z <= q.z ) ) {

						e = p;
						p = p.nextZ;
						pSize --;

					} else {

						e = q;
						q = q.nextZ;
						qSize --;

					}

					if ( tail ) tail.nextZ = e;
					else list = e;

					e.prevZ = tail;
					tail = e;

				}

				p = q;

			}

			tail.nextZ = null;
			inSize *= 2;

		} while ( numMerges > 1 );

		return list;

	}

	// z-order of a point given coords and inverse of the longer side of data bbox
	function zOrder( x, y, minX, minY, invSize ) {

		// coords are transformed into non-negative 15-bit integer range
		x = 32767 * ( x - minX ) * invSize;
		y = 32767 * ( y - minY ) * invSize;

		x = ( x | ( x << 8 ) ) & 0x00FF00FF;
		x = ( x | ( x << 4 ) ) & 0x0F0F0F0F;
		x = ( x | ( x << 2 ) ) & 0x33333333;
		x = ( x | ( x << 1 ) ) & 0x55555555;

		y = ( y | ( y << 8 ) ) & 0x00FF00FF;
		y = ( y | ( y << 4 ) ) & 0x0F0F0F0F;
		y = ( y | ( y << 2 ) ) & 0x33333333;
		y = ( y | ( y << 1 ) ) & 0x55555555;

		return x | ( y << 1 );

	}

	// find the leftmost node of a polygon ring
	function getLeftmost( start ) {

		let p = start,
			leftmost = start;
		do {

			if ( p.x < leftmost.x || ( p.x === leftmost.x && p.y < leftmost.y ) ) leftmost = p;
			p = p.next;

		} while ( p !== start );

		return leftmost;

	}

	// check if a point lies within a convex triangle
	function pointInTriangle( ax, ay, bx, by, cx, cy, px, py ) {

		return ( cx - px ) * ( ay - py ) - ( ax - px ) * ( cy - py ) >= 0 &&
				( ax - px ) * ( by - py ) - ( bx - px ) * ( ay - py ) >= 0 &&
				( bx - px ) * ( cy - py ) - ( cx - px ) * ( by - py ) >= 0;

	}

	// check if a diagonal between two polygon nodes is valid (lies in polygon interior)
	function isValidDiagonal( a, b ) {

		return a.next.i !== b.i && a.prev.i !== b.i && ! intersectsPolygon( a, b ) && // dones't intersect other edges
			( locallyInside( a, b ) && locallyInside( b, a ) && middleInside( a, b ) && // locally visible
			( area( a.prev, a, b.prev ) || area( a, b.prev, b ) ) || // does not create opposite-facing sectors
			equals( a, b ) && area( a.prev, a, a.next ) > 0 && area( b.prev, b, b.next ) > 0 ); // special zero-length case

	}

	// signed area of a triangle
	function area( p, q, r ) {

		return ( q.y - p.y ) * ( r.x - q.x ) - ( q.x - p.x ) * ( r.y - q.y );

	}

	// check if two points are equal
	function equals( p1, p2 ) {

		return p1.x === p2.x && p1.y === p2.y;

	}

	// check if two segments intersect
	function intersects( p1, q1, p2, q2 ) {

		const o1 = sign( area( p1, q1, p2 ) );
		const o2 = sign( area( p1, q1, q2 ) );
		const o3 = sign( area( p2, q2, p1 ) );
		const o4 = sign( area( p2, q2, q1 ) );

		if ( o1 !== o2 && o3 !== o4 ) return true; // general case

		if ( o1 === 0 && onSegment( p1, p2, q1 ) ) return true; // p1, q1 and p2 are collinear and p2 lies on p1q1
		if ( o2 === 0 && onSegment( p1, q2, q1 ) ) return true; // p1, q1 and q2 are collinear and q2 lies on p1q1
		if ( o3 === 0 && onSegment( p2, p1, q2 ) ) return true; // p2, q2 and p1 are collinear and p1 lies on p2q2
		if ( o4 === 0 && onSegment( p2, q1, q2 ) ) return true; // p2, q2 and q1 are collinear and q1 lies on p2q2

		return false;

	}

	// for collinear points p, q, r, check if point q lies on segment pr
	function onSegment( p, q, r ) {

		return q.x <= Math.max( p.x, r.x ) && q.x >= Math.min( p.x, r.x ) && q.y <= Math.max( p.y, r.y ) && q.y >= Math.min( p.y, r.y );

	}

	function sign( num ) {

		return num > 0 ? 1 : num < 0 ? - 1 : 0;

	}

	// check if a polygon diagonal intersects any polygon segments
	function intersectsPolygon( a, b ) {

		let p = a;
		do {

			if ( p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i &&
					intersects( p, p.next, a, b ) ) return true;
			p = p.next;

		} while ( p !== a );

		return false;

	}

	// check if a polygon diagonal is locally inside the polygon
	function locallyInside( a, b ) {

		return area( a.prev, a, a.next ) < 0 ?
			area( a, b, a.next ) >= 0 && area( a, a.prev, b ) >= 0 :
			area( a, b, a.prev ) < 0 || area( a, a.next, b ) < 0;

	}

	// check if the middle point of a polygon diagonal is inside the polygon
	function middleInside( a, b ) {

		let p = a,
			inside = false;
		const px = ( a.x + b.x ) / 2,
			py = ( a.y + b.y ) / 2;
		do {

			if ( ( ( p.y > py ) !== ( p.next.y > py ) ) && p.next.y !== p.y &&
					( px < ( p.next.x - p.x ) * ( py - p.y ) / ( p.next.y - p.y ) + p.x ) )
				inside = ! inside;
			p = p.next;

		} while ( p !== a );

		return inside;

	}

	// link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
	// if one belongs to the outer ring and another to a hole, it merges it into a single ring
	function splitPolygon( a, b ) {

		const a2 = new Node( a.i, a.x, a.y ),
			b2 = new Node( b.i, b.x, b.y ),
			an = a.next,
			bp = b.prev;

		a.next = b;
		b.prev = a;

		a2.next = an;
		an.prev = a2;

		b2.next = a2;
		a2.prev = b2;

		bp.next = b2;
		b2.prev = bp;

		return b2;

	}

	// create a node and optionally link it with previous one (in a circular doubly linked list)
	function insertNode( i, x, y, last ) {

		const p = new Node( i, x, y );

		if ( ! last ) {

			p.prev = p;
			p.next = p;

		} else {

			p.next = last.next;
			p.prev = last;
			last.next.prev = p;
			last.next = p;

		}

		return p;

	}

	function removeNode( p ) {

		p.next.prev = p.prev;
		p.prev.next = p.next;

		if ( p.prevZ ) p.prevZ.nextZ = p.nextZ;
		if ( p.nextZ ) p.nextZ.prevZ = p.prevZ;

	}

	function Node( i, x, y ) {

		// vertex index in coordinates array
		this.i = i;

		// vertex coordinates
		this.x = x;
		this.y = y;

		// previous and next vertex nodes in a polygon ring
		this.prev = null;
		this.next = null;

		// z-order curve value
		this.z = null;

		// previous and next nodes in z-order
		this.prevZ = null;
		this.nextZ = null;

		// indicates whether this is a steiner point
		this.steiner = false;

	}

	function signedArea( data, start, end, dim ) {

		let sum = 0;
		for ( let i = start, j = end - dim; i < end; i += dim ) {

			sum += ( data[ j ] - data[ i ] ) * ( data[ i + 1 ] + data[ j + 1 ] );
			j = i;

		}

		return sum;

	}

	class ClosedPolygonOutput extends OutputNode{
	    constructor(options = {}){
	        super();
	        /* 
	        Interpret the points as the vertices of a 2D planar polygon. The polygon can be nonconvex, but ideally non-self-intersecting.

	        Currently this means each vertex will have its position projected to the XY plane, with the Z component lost.
	        Todo: support [0,x,y] and [x,0,y] and so on by dynamically computing the plane of best fit then projecting there


	        Should be .add()ed to a Transformation to work.
	            options:
	            {
	                opacity: number
	                color: hex code or THREE.Color()
	            }
	        */

	        this._opacity = options.opacity !== undefined ? options.opacity : 1;
	        this._color = options.color || 0x0000ff;
	        //todo: custom color function?

	        this.numCallsPerActivation = 0; //should always be equal to this.points.length
	        this.itemDimensions = []; // how many times to be called in each direction
	        this._outputDimensions = 3; //how many dimensions per point to store?

	        this.init();
	    }
	    init(){
	        this._geometry = new THREE.BufferGeometry();
	        this.makeGeometry();

	        this.material = new THREE.MeshBasicMaterial({
	            opacity: this._opacity,
	            //color: this._color,
	            side: THREE.DoubleSide,
	            vertexColors: THREE.VertexColors,
	        });

	        this.mesh = new THREE.Mesh(this._geometry,this.material);

	        this.opacity = this._opacity; // setter sets transparent flag if necessary
	        this.color = this._color; //setter sets color attribute

	        getThreeEnvironment().scene.add(this.mesh);
	    }

	    makeGeometry(){
	        const MAX_POINTS = 100; //these arrays get discarded on first activation anyways
	        this._vertices = new Float32Array(this._outputDimensions * MAX_POINTS);
	        this._colors = new Float32Array(3 * MAX_POINTS);
	        this._faceIndices = new Uint32Array(3 * MAX_POINTS);

	        this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
	        this._geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( this._colors, 3 ) );
	        this._geometry.setIndex(new THREE.Uint32BufferAttribute( this._faceIndices, 1 ) );

	        this._currentPointIndex = 0; //used during updates as a pointer to the buffer
	        this._activatedOnce = false;

	    }
	    _onAdd(){
	        //climb up parent hierarchy to find the Domain node we're rendering from
	        let root = null;
	        try{
	           root = this.getClosestDomain(); //todo: implement something like assert root typeof RootNode
	        }catch(error){
	            console.warn(error);
	            return;
	        }

	        this.numCallsPerActivation = root.numCallsPerActivation;
	        this.itemDimensions = root.itemDimensions;
	    }

	    _onFirstActivation(){
	        this._onAdd(); //setup this.numCallsPerActivation and this.itemDimensions. used here again because cloning means the onAdd() might be called before this is connected to a type of domain

	        // perhaps instead of generating a whole new array, this can reuse the old one?

	        const numVerts = this.numCallsPerActivation;

	        let positionAttribute = this._geometry.attributes.position;
	        this._vertices = new Float32Array( this._outputDimensions * numVerts);
	        positionAttribute.setArray(this._vertices);
	        positionAttribute.needsUpdate = true;

	        let colorAttribute = this._geometry.attributes.color;
	        this._colors = new Float32Array( 3 * numVerts);
	        colorAttribute.setArray(this._colors);

	        this._faceIndices = new Uint32Array( 3 * numVerts); //at most one face per vertex.
	        //is this enough? probably?? todo: do the math and see whether a polygon with n vertices can have n faces. It can definitely have at least n-2 cases (n-gon). I think no but I haven't checked
	        let faceAttribute = this._geometry.index;
	        faceAttribute.setArray(this._faceIndices);

	        this._projected2DCoords = new Float32Array( 2 * numVerts);

	        this.triangulateAndGenerateFaces();
	        this.setAllVerticesToColor(this.color);
	    }

	    triangulateAndGenerateFaces(){

	        // this._vertices is an array where every 3 numbers represent an (x,y,z) triplet.
	        // we want to interpret these points as the boundaries of a convex polygon.
	        // if they spell out a nonconvex polygon, we need to figure out how to trianguate it properly

	        //code adapted from three.js/src/extras/ShapeUtils.js

	        //project our polygon with vertices in 3D space to a 2D plane, so we can triangulate a 2D polygon
	        const numVerts = this.numCallsPerActivation;
	        for(let i=0;i<numVerts;i++){

	            const projectedX = this._vertices[i*this._outputDimensions]; //vertex x
	            const projectedY = this._vertices[i*this._outputDimensions+1]; //vertex y, throwing away z. todo: actually do a smart, dynamic projection. and not do that
	            //const ignored = this._vertices[i*this._outputDimensions+2];
	    
	            this._projected2DCoords[i*2] = projectedX;
	            this._projected2DCoords[i*2+1] = projectedY;
	        }

	        const holeIndices = [];
			const triangles = Earcut.triangulate( this._projected2DCoords, holeIndices );

	        //this could error if there are more 3*triangles than there are spots in faceIndices
			for ( let i = 0; i < triangles.length; i += 3 ) {
	            this._faceIndices[i] = triangles[i];
	            this._faceIndices[i+1] = triangles[i+1];
	            this._faceIndices[i+2] = triangles[i+2];
			}

	    }
	    evaluateSelf(i, t, x, y, z, ...otherArgs){
	        if(!this._activatedOnce){
	            this._activatedOnce = true;
	            this._onFirstActivation();    
	        }

	        //it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.
	        //assert i < vertices.count

	        let xValue =  x === undefined ? 0 : x;
	        let yValue =  y === undefined ? 0 : y;
	        let zValue =  z === undefined ? 0 : z;

	        this.saveVertexInfoInBuffers(this._vertices, this._currentPointIndex, xValue,yValue,zValue);
	        this._currentPointIndex++;
	    }
	    saveVertexInfoInBuffers(array, index, value1,value2,value3){
	        array[index*this._outputDimensions]   = value1;
	        array[index*this._outputDimensions+1] = value2;
	        array[index*this._outputDimensions+2] = value3;
	    }
	    onAfterActivation(){
	        let positionAttribute = this._geometry.attributes.position;
	        positionAttribute.needsUpdate = true;

	        this.triangulateAndGenerateFaces();

	        let indexAttribute = this._geometry.index;
	        indexAttribute.needsUpdate = true;

	        this._geometry.computeBoundingSphere(); //unsure if needed

	        this._currentPointIndex = 0; //reset after each update
	    }
	    removeSelfFromScene(){
	        getThreeEnvironment().scene.remove(this.mesh);
	    }
	    setAllVerticesToColor(color){
	        const col = new THREE.Color(color);
	        const numVertices = this.numCallsPerActivation;
	        for(let i=0; i<numVertices;i++){
	            //Don't forget some points appear twice - as the end of one line segment and the beginning of the next.
	            this._setColorForVertexRGB(i, col.r, col.g, col.b);
	        }
	        //tell three.js to update colors
	        let colorAttribute = this._geometry.attributes.color;
	        colorAttribute.needsUpdate = true;
	    }
	    _setColorForVertexRGB(vertexIndex, normalizedR, normalizedG, normalizedB){
	        //color is a THREE.Color here
	        let colorArray = this._geometry.attributes.color.array;
	        let index = vertexIndex * 3; //*3 because colors have 3 channels
	        colorArray[index + 0] = normalizedR;
	        colorArray[index + 1] = normalizedG;
	        colorArray[index + 2] = normalizedB;

	        //NOTE: colorAttribute.needsUpdate must be set to true after this or else the colors won't show up!
	    }
	    set color(color){
	        //color can be a THREE.Color()
	        this._color = color;
	        this.setAllVerticesToColor(color);
	    }
	    get color(){
	        return this._color;
	    }
	    set opacity(opacity){
	        //mesh is always transparent
	        this.material.opacity = opacity;
	        this.material.transparent = opacity < 1;
	        this.material.visible = opacity > 0;
	        this._opacity = opacity;
	    }
	    get opacity(){
	        return this._opacity;
	    }
	    clone(){
	        return new ClosedPolygonOutput({color: this.color, opacity: this.opacity});
	    }
	}

	var explanarianArrowSVG = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjIwMCIKICAgaGVpZ2h0PSIxMzAiCiAgIHZpZXdCb3g9IjAgMCAyMDAgMTMwIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjkxIHIxMzcyNSIKICAgc29kaXBvZGk6ZG9jbmFtZT0iRXhwbGFuYXJpYW5OZXh0QXJyb3cuc3ZnIj4KICA8ZGVmcz4KPHJhZGlhbEdyYWRpZW50IGlkPSJhIiBjeD0iNTAwIiBjeT0iNjI3LjcxIiByPSIyNDIuMzUiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMCAuMjk3MDIgLTMuODM5MSAtMS4xOTMxZS04IDI0MDguMSA4MzguODUpIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiNiYzczMTkiIG9mZnNldD0iMCIvPgo8c3RvcCBzdG9wLWNvbG9yPSIjZjBkMjYzIiBvZmZzZXQ9IjEiLz4KPC9yYWRpYWxHcmFkaWVudD4KPC9kZWZzPgo8bWV0YWRhdGE+CjxyZGY6UkRGPgo8Y2M6V29yayByZGY6YWJvdXQ9IiI+CjxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0Pgo8ZGM6dHlwZSByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIi8+CjxkYzp0aXRsZS8+CjwvY2M6V29yaz4KPC9yZGY6UkRGPgo8L21ldGFkYXRhPgo8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwIC05MjIuMzYpIj4KPHBhdGggZD0ibTE5Ny40NyA5ODcuMzZjMC0yNC4yODEtODcuMjYxLTYxLjcwOC04Ny4yNjEtNjEuNzA4djI5LjY5NGwtMTMuNTYzIDAuMzc5NGMtMTMuNTYzIDAuMzc5MzktNjIuMjAyIDIuODI3MS03NC44MTEgNy45NjU3LTEyLjYwOSA1LjEzODYtMTkuMzAxIDE0LjY5NS0xOS4zMDEgMjMuNjY5IDAgOC45NzM4IDMuOTczNSAxOC4xNjMgMTkuMzAxIDIzLjY2OSAxNS4zMjcgNS41MDU1IDYxLjI0OCA3LjU4NjMgNzQuODExIDcuOTY1N2wxMy41NjMgMC4zNzk0djI5LjY5NHM4Ny4yNjEtMzcuNDI4IDg3LjI2MS02MS43MDh6IiBmaWxsPSJ1cmwoI2EpIiBzdHJva2U9IiM3MzU1M2QiIHN0cm9rZS13aWR0aD0iMi42Mjg1Ii8+CjxnIHRyYW5zZm9ybT0ibWF0cml4KDAgLjI2Mjg1IC0uMjYyODUgMCAxNzguMTMgODYwLjAxKSIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEwIj4KPGVsbGlwc2UgY3g9IjU0Ny4xNCIgY3k9IjEyMC45MyIgcng9IjI1LjcxNCIgcnk9IjUxLjQyOSIgZmlsbD0iI2ZmZiIvPgo8ZWxsaXBzZSBjeD0iNTM0LjM3IiBjeT0iMTIzLjUzIiByeD0iMTIuNjI3IiByeT0iMjYuMjY0Ii8+CjwvZz4KPGcgdHJhbnNmb3JtPSJtYXRyaXgoMCAtLjI2Mjg1IC0uMjYyODUgMCAxNzguNjYgMTExNC43KSIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEwIj4KPGVsbGlwc2UgY3g9IjU0Ny4xNCIgY3k9IjEyMC45MyIgcng9IjI1LjcxNCIgcnk9IjUxLjQyOSIgZmlsbD0iI2ZmZiIvPgo8ZWxsaXBzZSBjeD0iNTM0LjM3IiBjeT0iMTIzLjUzIiByeD0iMTIuNjI3IiByeT0iMjYuMjY0Ii8+CjwvZz4KPC9nPgo8L3N2Zz4K";

	class DirectionArrow{
	    constructor(faceRight){
	        this.arrowImage = new Image();
	        this.arrowImage.src = explanarianArrowSVG;

	        this.arrowImage.classList.add("exp-arrow");

	        faceRight = faceRight===undefined ? true : faceRight;

	        if(faceRight){
	            this.arrowImage.classList.add("exp-arrow-right");
	        }else {
	            this.arrowImage.classList.add("exp-arrow-left");
	        }
	        this.arrowImage.onclick = (function(){
	            this.hideSelf();
	            this.onclickCallback();
	        }).bind(this);

	        this.onclickCallback = null; // to be set externally
	    }
	    showSelf(){
	        this.arrowImage.style.pointerEvents = '';
	        this.arrowImage.style.opacity = 1;
	        
	    }
	    hideSelf(){
	        this.arrowImage.style.opacity = 0;
	        this.arrowImage.style.pointerEvents = 'none';
	    }
	}


	class NonDecreasingDirector{
	    //Using a NonDecreasingDirector, create HTML elements with the 'exp-slide' class.
	    //The first HTML element with the 'exp-slide' class will be shown first. When the next slide button is clicked, that will fade out and be replaced with the next element with the exp-slide class, in order of HTML.
	    //If you want to display multiple HTML elements at the same time, 'exp-slide-<n>' will also be displayed when the presentation is currently on slide number n. For example, everything in the exp-slide-1 class will be visible from the start, and then exp-slide-2, and so on.
	    //Don't give an element both the exp-slide and exp-slide-n classes. 

	    // I want Director() to be able to backtrack by pressing backwards. This doesn't do that.
	    constructor(options){
	        this.slides = [];
	        this.currentSlideIndex = 0;        
	        this.numSlides = 0;
	        this.numHTMLSlides = 0;

	        this.nextSlideResolveFunction = null;
	        this.initialized = false;
	    }

	    


	    async begin(){
	        await this.waitForPageLoad();

	        this.setupAndHideAllSlideHTMLElements();

	        this.switchDisplayedSlideIndex(0); //unhide first one

	        this.setupClickables();

	        this.initialized = true;
	    }

	    setupAndHideAllSlideHTMLElements(){

	        this.slides = document.getElementsByClassName("exp-slide");
	        this.numHTMLSlides = this.slides.length;

	        //hide all slides except first one
	        for(var i=0;i<this.numHTMLSlides;i++){
	            this.slides[i].style.opacity = 0;
	            this.slides[i].style.pointerEvents = 'none';
	            this.slides[i].style.display = 'none';//opacity=0 alone won't be instant because of the 1s CSS transition
	        }
	        let self = this;
	        //now handle exp-slide-<n>
	        let allSpecificSlideElements = document.querySelectorAll('[class*="exp-slide-"]'); //this is a CSS attribute selector, and I hate that this exists. it's so ugly
	        for(var i=0;i<allSpecificSlideElements.length;i++){
	            allSpecificSlideElements[i].style.opacity = 0; 
	            allSpecificSlideElements[i].style.pointerEvents = 'none';
	            allSpecificSlideElements[i].style.display = 'none';//opacity=0 alone won't be instant because of the 1s CSS transition
	        }

	        //undo setting display-none after a bit of time
	        window.setTimeout(function(){
	            for(var i=0;i<self.slides.length;i++){
	                self.slides[i].style.display = '';
	            }
	            for(var i=0;i<allSpecificSlideElements.length;i++){
	                allSpecificSlideElements[i].style.display = '';
	            }
	        },1);

	    }

	    setupClickables(){
	        let self = this;

	        this.rightArrow = new DirectionArrow();
	        document.body.appendChild(this.rightArrow.arrowImage);
	        this.rightArrow.onclickCallback = function(){
	            self._changeSlide(1, function(){}); // this errors without the empty function because there's no resolve. There must be a better way to do things.
	            console.warn("WARNING: Horrible hack in effect to change slides. Please replace the pass-an-empty-function thing with something that actually resolves properly and does async.");
	            self.nextSlideResolveFunction();
	        };

	    }

	    async waitForPageLoad(){
	        return new Promise(function(resolve, reject){
	            if(document.readyState == 'complete'){
	                resolve();
	            }
	            window.addEventListener("DOMContentLoaded",resolve);
	        });
	    }
	    async nextSlide(){
	        if(!this.initialized)throw new Error("ERROR: Use .begin() on a Director before calling any other methods!");

	        let self = this;

	        this.rightArrow.showSelf();
	        //promise is resolved by calling this.nextSlidePromise.resolve() when the time comes

	        return new Promise(function(resolve, reject){
	            function keyListener(e){
	                if(e.repeat)return; //keydown fires multiple times but we only want the first one
	                let slideDelta = 0;
	                switch (e.keyCode) {
	                  case 34:
	                  case 39:
	                  case 40:
	                    slideDelta = 1;
	                    break;
	                }
	                if(slideDelta != 0){
	                    self._changeSlide(slideDelta, resolve);
	                    self.rightArrow.hideSelf();
	                    window.removeEventListener("keydown",keyListener); //this approach taken from https://stackoverflow.com/questions/35718645/resolving-a-promise-with-eventlistener
	                }
	            }

	            window.addEventListener("keydown", keyListener);
	            //horrible hack so that the 'next slide' arrow can trigger this too
	            self.nextSlideResolveFunction = function(){ 
	                resolve();
	                window.removeEventListener("keydown",keyListener); 
	            };
	        });
	    }
	    _changeSlide(slideDelta, resolve){
	        //slide changing logic
	        if(slideDelta != 0){
	            if(this.currentSlideIndex == 0 && slideDelta == -1){
	                return; //no going past the beginning
	            }
	            if(this.currentSlideIndex == this.numHTMLSlides-1 && slideDelta == 1){
	                return; //no going past the end
	            }

	            this.switchDisplayedSlideIndex(this.currentSlideIndex + slideDelta);
	            resolve();
	        }
	    }

	    switchDisplayedSlideIndex(slideNumber){
	        //updates HTML and also sets this.currentSlideIndex to slideNumber

	        let prevSlideNumber = this.currentSlideIndex;
	        this.currentSlideIndex = slideNumber;


	        //hide the HTML elements for the previous slide

	        //items with class exp-slide
	        if(prevSlideNumber < this.slides.length){
	            this.slides[prevSlideNumber].style.opacity = 0;
	            this.slides[prevSlideNumber].style.pointerEvents = 'none';
	        }
	        
	        //items with HTML class exp-slide-n
	        let prevSlideElems = document.getElementsByClassName("exp-slide-"+(prevSlideNumber+1));
	        for(var i=0;i<prevSlideElems.length;i++){
	            prevSlideElems[i].style.opacity = 0;
	            prevSlideElems[i].style.pointerEvents = 'none';
	        }


	        //show the HTML elements for the current slide
	  
	        
	        //items with HTML class exp-slide-n
	        let elemsToDisplayOnlyOnThisSlide = document.getElementsByClassName("exp-slide-"+(slideNumber+1));

	        if(slideNumber >= this.numHTMLSlides && elemsToDisplayOnlyOnThisSlide.length == 0){
	            console.error("Tried to show slide #"+slideNumber+", but only " + this.numHTMLSlides + "HTML elements with exp-slide were found! Make more slides?");
	            return;
	        }

	        for(var i=0;i<elemsToDisplayOnlyOnThisSlide.length;i++){
	            elemsToDisplayOnlyOnThisSlide[i].style.opacity = 1;
	            elemsToDisplayOnlyOnThisSlide[i].style.pointerEvents = ''; //not "all", because that might override CSS which sets pointer-events to none
	        }

	        //items with class exp-slide
	        if(slideNumber < this.slides.length){
	            this.slides[slideNumber].style.opacity = 1;
	            this.slides[slideNumber].style.pointerEvents = ''; //not "all", because that might override CSS which sets pointer-events to none
	            this.scrollUpToTopOfContainer(this.slides[slideNumber]);
	        }

	    }
	    scrollUpToTopOfContainer(element){
	        this.getScrollParent(element).scrollTop = 0;
	    }
	    getScrollParent(element, includeHidden){
	        //from https://stackoverflow.com/questions/35939886/find-first-scrollable-parent
	        var style = getComputedStyle(element);
	        var excludeStaticParent = style.position === "absolute";
	        var overflowRegex = includeHidden ? /(auto|scroll|hidden)/ : /(auto|scroll)/;
	        if (style.position === "fixed") return document.body;
	        for (var parent = element; (parent = parent.parentElement);) {
	            style = getComputedStyle(parent);
	            if (excludeStaticParent && style.position === "static") {
	                continue;
	            }
	            if (overflowRegex.test(style.overflow + style.overflowY + style.overflowX)) return parent;
	        }
	        return document.body;
	    }

	    //verbs
	    async _sleep(waitTime){
	        return new Promise(function(resolve, reject){
	            window.setTimeout(resolve, waitTime);
	        });
	    }
	    async delay(waitTime){
	        return this._sleep(waitTime);
	    }
	    TransitionTo(target, toValues, durationMS, optionalArguments){
	        //if someone's using the old calling strategy of staggerFraction as the last argument, convert it properly
	        if(optionalArguments && Utils.isNumber(optionalArguments)){
	            optionalArguments = {staggerFraction: optionalArguments};
	        }
	        new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000, staggerFraction=staggerFraction, optionalArguments);
	    }
	}





	const FORWARDS = ("forwards");
	const BACKWARDS = ("backwards");
	const NO_SLIDE_MOVEMENT = ("not time traveling");

	class UndoCapableDirector extends NonDecreasingDirector{
	    //thsi director uses both forwards and backwards arrows. the backwards arrow will undo any UndoCapableDirector.TransitionTo()s
	    //todo: hook up the arrows and make it not
	    constructor(options){
	        super(options);

	        this.furthestSlideIndex = 0; //matches the number of times nextSlide() has been called
	        //this.currentSlideIndex is always < this.furthestSlideIndex - if equal, we release the promise and let nextSlide() return

	        this.undoStack = [];
	        this.undoStackIndex = -1; //increased by one every time either this.TransitionTo is called or this.nextSlide() is called

	        let self = this;

	        this.currentReplayDirection = NO_SLIDE_MOVEMENT; //this variable is used to ensure that if you redo, then undo halfway through the redo, the redo ends up cancelled. 
	        this.numArrowPresses = 0;

	        //if you press right before the first director.nextSlide(), don't error
	        this.nextSlideResolveFunction = function(){}; 

	        function keyListener(e){
	            if(e.repeat)return; //keydown fires multiple times but we only want the first one
	            switch (e.keyCode) {
	              case 34:
	              case 39:
	              case 40:
	                self.handleForwardsPress();
	                break;
	              case 33:
	              case 37:
	              case 38:
	                self.handleBackwardsPress();
	            }
	        }

	        window.addEventListener("keydown", keyListener);
	    }

	    setupClickables(){
	        let self = this;

	        this.leftArrow = new DirectionArrow(false);
	        this.leftArrow.hideSelf();
	        document.body.appendChild(this.leftArrow.arrowImage);
	        this.leftArrow.onclickCallback = function(){
	            self.handleBackwardsPress();
	        };

	        this.rightArrow = new DirectionArrow(true);
	        document.body.appendChild(this.rightArrow.arrowImage);
	        this.rightArrow.onclickCallback = function(){
	            self.handleForwardsPress();
	        };
	    }

	    moveFurtherIntoPresentation(){
	            //if there's nothing to redo, (so we're not in the past of the undo stack), advance further.
	            //if there are less HTML slides than calls to director.newSlide(), complain in the console but allow the presentation to proceed
	            console.log("Moving further into presentation!");
	            if(this.currentSlideIndex < this.numSlides){
	                this.furthestSlideIndex += 1; 

	                this.switchDisplayedSlideIndex(this.currentSlideIndex + 1); //this will complain in the console window if there are less slides than newSlide() calls
	                this.showArrows(); //showArrows must come after this.currentSlideIndex advances or else we won't be able to tell if we're at the end or not
	            }
	            this.nextSlideResolveFunction(); //allow presentation code to proceed
	    }
	    isCaughtUpWithNothingToRedo(){
	        return this.undoStackIndex == this.undoStack.length-1;
	    }

	    async handleForwardsPress(){

	        //if there's nothing to redo, show the next slide
	        if(this.isCaughtUpWithNothingToRedo()){
	            this.moveFurtherIntoPresentation();
	            return;
	        }

	        // if we get to here, we've previously done an undo, and we're in the past. We need to catch up and redo all those items

	        //only redo if we're not already redoing
	        //todo: add an input buffer instead of discarding them
	        if(this.currentReplayDirection == FORWARDS)return;
	        this.currentReplayDirection = FORWARDS;

	        this.rightArrow.hideSelf();

	        this.numArrowPresses += 1;
	        let numArrowPresses = this.numArrowPresses;

	        //advance past the current NewSlideUndoItem we're presumably paused on

	        if(this.undoStack[this.undoStackIndex].constructor === NewSlideUndoItem){
	            this.undoStackIndex += 1;
	        }

	        //change HTML slide first so that if there are any delays to undo, they don't slow down the slide
	        this.switchDisplayedSlideIndex(this.currentSlideIndex + 1);
	        this.showArrows();
	        console.log(`Starting arrow press forwards #${numArrowPresses}`);

	        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
	            //loop through undo stack and redo each undo until we get to the next slide


	            let redoItem = this.undoStack[this.undoStackIndex];
	            await this.redoAnItem(redoItem);

	            //If there's a delay somewhere in the undo stack, and we sleep for some amount of time, the user might have pressed undo during that time. In that case, handleBackwardsPress() will set this.currentReplayDirection to BACKWARDS. But we're still running, so we should stop redoing!
	            if(this.currentReplayDirection != FORWARDS || numArrowPresses != this.numArrowPresses){
	                //this function has been preempted by another arrow press
	                console.log(`forwards has been preempted: this is ${numArrowPresses}, but there's another with ${this.numArrowPresses},${this.currentReplayDirection}`);
	                return;
	            }

	            if(this.undoStackIndex == this.undoStack.length-1){
	                //we've now fully caught up.

	                //if the current undoItem isn't a NewSlideUndoItem, but we do have a nextSlideResolveFunction (meaning the main user code is waiting on this to activate) allow presentation code to proceed
	                if(this.nextSlideResolveFunction){
	                    this.nextSlideResolveFunction();
	                }
	                break;
	            }
	            
	            this.undoStackIndex += 1;

	        }
	        this.currentReplayDirection = NO_SLIDE_MOVEMENT;
	    }

	    async redoAnItem(redoItem){
	        switch(redoItem.type){
	            case DELAY:
	                //keep in mind during this delay period, the user might push the left arrow key. If that happens, this.currentReplayDirection will be DECREASING, so handleForwardsPress() will quit
	                await this._sleep(redoItem.waitTime);
	                break;
	            case TRANSITIONTO:
	                new Animation(redoItem.target, redoItem.toValues, redoItem.duration, redoItem.optionalArguments);
	              //and now redoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething
	                break;
	        }
	    }

	    async handleBackwardsPress(){

	        if(this.undoStackIndex == 0 || this.currentSlideIndex == 0){
	            return;
	        }

	        //only undo if we're not already undoing
	        if(this.currentReplayDirection == BACKWARDS)return;
	        this.currentReplayDirection = BACKWARDS;

	        this.leftArrow.hideSelf();

	        this.numArrowPresses += 1;
	        let numArrowPresses = this.numArrowPresses;

	        //advance behind the current NewSlideUndoItem we're presumably paused on
	        if(this.undoStack[this.undoStackIndex].constructor === NewSlideUndoItem){
	            this.undoStackIndex -= 1;
	        }


	        //change HTML slide first so that if there are any delays to undo, they don't slow down the slide
	        this.switchDisplayedSlideIndex(this.currentSlideIndex - 1);
	        this.showArrows();

	        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
	            //loop through undo stack and undo each item until we reach the previous slide

	            if(this.undoStackIndex == 0){
	                //at first slide
	                break;
	            }

	            //If there's a delay somewhere in the undo stack, and we sleep for some amount of time, the user might have pressed redo during that time. In that case, handleForwardsPress() will set this.currentReplayDirection to FORWARDS. But we're still running, so we should stop redoing!
	            if(this.currentReplayDirection != BACKWARDS || numArrowPresses != this.numArrowPresses){
	                //this function has been preempted by another arrow press
	                console.log(`backwards has been preempted: ${numArrowPresses},${this.numArrowPresses},${this.currentReplayDirection}`);
	                return;
	            }

	            //undo transformation in this.undoStack[this.undoStackIndex]
	            let undoItem = this.undoStack[this.undoStackIndex];
	            await this.undoAnItem(undoItem);
	            this.undoStackIndex -= 1;
	        }
	        this.currentReplayDirection = NO_SLIDE_MOVEMENT;
	    }

	    async undoAnItem(undoItem){
	        switch(undoItem.type){
	                case DELAY:
	                    //keep in mind during this delay period, the user might push the right arrow. If that happens, this.currentReplayDirection will be INCREASING, so handleBackwardsPress() will quit instead of continuing.
	                    let waitTime = undoItem.waitTime;
	                    await this._sleep(waitTime/5);
	                    break;
	                case TRANSITIONTO:
	                    let duration = undoItem.duration;
	                    duration = duration/5; //undoing should be faster.
	                    //todo: invert the easing of the undoItem when creating the undo animation?
	                    Easing.EaseInOut;
	                    new Animation(undoItem.target, undoItem.fromValues, duration, undoItem.optionalArguments);
	                    //and now undoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething
	                    break;
	            }
	    }

	    showArrows(){
	        if(this.currentSlideIndex > 0){
	            this.leftArrow.showSelf();
	        }else {
	            this.leftArrow.hideSelf();
	        }
	        if(this.currentSlideIndex < this.numSlides){
	            this.rightArrow.showSelf();
	        }else {
	            this.rightArrow.hideSelf();
	        }
	    }

	    async nextSlide(){
	        /*The user will call this function to mark the transition between one slide and the next. This does two things:
	        A) waits until the user presses the right arrow key, returns, and continues execution until the next nextSlide() call
	        B) if the user presses the left arrow key, they can undo and go back in time, and every TransitionTo() call before that will be undone until it reaches a previous nextSlide() call. Any normal javascript assignments won't be caught in this :(
	        C) if undo
	        */
	        if(!this.initialized)throw new Error("ERROR: Use .begin() on a Director before calling any other methods!");

	        
	        this.numSlides++;
	        this.undoStack.push(new NewSlideUndoItem(this.currentSlideIndex));
	        this.undoStackIndex++;
	        this.showArrows();


	        let self = this;

	        //promise is resolved by calling this.nextSlideResolveFunction() when the time comes
	        return new Promise(function(resolve, reject){
	            self.nextSlideResolveFunction = function(){ 
	                resolve();
	            };
	        });

	    } 
	    async _sleep(waitTime){
	        await super._sleep(waitTime);
	    }

	    async delay(waitTime){
	        this.undoStack.push(new DelayUndoItem(waitTime));
	        this.undoStackIndex++;
	        console.log(this.undoStackIndex);
	        await this._sleep(waitTime);
	        console.log(this.undoStackIndex);
	        if(!this.isCaughtUpWithNothingToRedo()){
	            //This is a perilous situation. While we were delaying, the user pressed undo, and now we're in the past.
	            //we SHOULDN't yield back after this, because the presentation code might start running more transformations after this which conflict with the undoing animations. So we need to wait until we reach the right slide again
	            console.log("Egads! This is a perilous situation! Todo: wait until we're fully caught up to release");
	            let self = this;
	            //promise is resolved by calling this.nextSlideResolveFunction() when the time comes
	            return new Promise(function(resolve, reject){
	                self.nextSlideResolveFunction = function(){ 
	                    console.log("Release!");
	                    resolve();
	                };
	            });
	        }
	    }
	    TransitionTo(target, toValues, durationMS, optionalArguments){
	        let duration = durationMS === undefined ? 1 : durationMS/1000;
	        var animation = new Animation(target, toValues, duration, optionalArguments);
	        let fromValues = animation.fromValues;
	        this.undoStack.push(new UndoItem(target, toValues, fromValues, duration, optionalArguments));
	        this.undoStackIndex++;
	    }
	}


	//discount enum
	const TRANSITIONTO = 0;
	const NEWSLIDE = 1;
	const DELAY=2;

	//things that can be stored in a UndoCapableDirector's .undoStack[]
	class UndoItem{
	    constructor(target, toValues, fromValues, duration, optionalArguments){
	        this.target = target;
	        this.toValues = toValues;
	        this.fromValues = fromValues;
	        this.duration = duration;
	        this.type = TRANSITIONTO;
	        this.optionalArguments = optionalArguments;
	    }
	}

	class NewSlideUndoItem{
	    constructor(slideIndex){
	        this.slideIndex = slideIndex;
	        this.type = NEWSLIDE;
	    }
	}

	class DelayUndoItem{
	    constructor(waitTime){
	        this.waitTime = waitTime;
	        this.type = DELAY;
	    }
	}

	exports.Animation = Animation;
	exports.Area = Area;
	exports.Array = EXPArray;
	exports.ClosedPolygonOutput = ClosedPolygonOutput;
	exports.DirectionArrow = DirectionArrow;
	exports.Easing = Easing;
	exports.FlatArrayOutput = FlatArrayOutput;
	exports.HistoryRecorder = HistoryRecorder;
	exports.LineOutput = LineOutput;
	exports.Math = Math$1;
	exports.NonDecreasingDirector = NonDecreasingDirector;
	exports.PointMesh = PointMesh;
	exports.PointOutput = PointOutput;
	exports.SurfaceOutput = SurfaceOutput;
	exports.ThreeasyEnvironment = ThreeasyEnvironment;
	exports.ThreeasyRecorder = ThreeasyRecorder;
	exports.Transformation = Transformation;
	exports.TransitionTo = TransitionTo;
	exports.UndoCapableDirector = UndoCapableDirector;
	exports.Utils = Utils$1;
	exports.VectorOutput = VectorOutput;
	exports.delay = delay;
	exports.setupThree = setupThree;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=explanaria-bundle.js.map
