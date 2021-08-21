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
	        element.scrollIntoView(true);
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
	        this.showArrows();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9IaXN0b3J5UmVjb3JkZXIuanMiLCIuLi9zcmMvanMvVGhyZWVFbnZpcm9ubWVudC5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL291dHB1dHMvTGluZU91dHB1dFNoYWRlcnMuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9MaW5lT3V0cHV0LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvUG9pbnRPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9WZWN0b3JPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9TdXJmYWNlT3V0cHV0U2hhZGVycy5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1N1cmZhY2VPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9GbGF0QXJyYXlPdXRwdXQuanMiLCIuLi9zcmMvbGliL0VhcmN1dC5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL0Nsb3NlZFBvbHlnb25PdXRwdXQuanMiLCIuLi9zcmMvanMvRGlyZWN0b3JJbWFnZUNvbnN0YW50cy5qcyIsIi4uL3NyYy9qcy9EaXJlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBUaGUgYmFzZSBjbGFzcyB0aGF0IGV2ZXJ5dGhpbmcgaW5oZXJpdHMgZnJvbS4gXG5cdEVhY2ggdGhpbmcgZHJhd24gdG8gdGhlIHNjcmVlbiBpcyBhIHRyZWUuIERvbWFpbnMsIHN1Y2ggYXMgRVhQLkFyZWEgb3IgRVhQLkFycmF5IGFyZSB0aGUgcm9vdCBub2Rlcyxcblx0RVhQLlRyYW5zZm9ybWF0aW9uIGlzIGN1cnJlbnRseSB0aGUgb25seSBpbnRlcm1lZGlhdGUgbm9kZSwgYW5kIHRoZSBsZWFmIG5vZGVzIGFyZSBzb21lIGZvcm0gb2YgT3V0cHV0IHN1Y2ggYXNcblx0RVhQLkxpbmVPdXRwdXQgb3IgRVhQLlBvaW50T3V0cHV0LCBvciBFWFAuVmVjdG9yT3V0cHV0LlxuXG5cdEFsbCBvZiB0aGVzZSBjYW4gYmUgLmFkZCgpZWQgdG8gZWFjaCBvdGhlciB0byBmb3JtIHRoYXQgdHJlZSwgYW5kIHRoaXMgZmlsZSBkZWZpbmVzIGhvdyBpdCB3b3Jrcy5cbiovXG5cbmNsYXNzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKCl7ICAgICAgICBcblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsOyAgICAgICAgXG4gICAgfVxuXHRhZGQodGhpbmcpe1xuXHRcdC8vY2hhaW5hYmxlIHNvIHlvdSBjYW4gYS5hZGQoYikuYWRkKGMpIHRvIG1ha2UgYS0+Yi0+Y1xuXHRcdHRoaXMuY2hpbGRyZW4ucHVzaCh0aGluZyk7XG5cdFx0dGhpbmcucGFyZW50ID0gdGhpcztcblx0XHRpZih0aGluZy5fb25BZGQpdGhpbmcuX29uQWRkKCk7XG5cdFx0cmV0dXJuIHRoaW5nO1xuXHR9XG5cdF9vbkFkZCgpe31cblx0cmVtb3ZlKHRoaW5nKXtcblx0XHR2YXIgaW5kZXggPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoIHRoaW5nICk7XG5cdFx0aWYgKCBpbmRleCAhPT0gLSAxICkge1xuXHRcdFx0dGhpbmcucGFyZW50ID0gbnVsbDtcblx0XHRcdHRoaXMuY2hpbGRyZW4uc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuICAgIGdldFRvcFBhcmVudCgpeyAvL2ZpbmQgdGhlIHBhcmVudCBvZiB0aGUgcGFyZW50IG9mIHRoZS4uLiB1bnRpbCB0aGVyZSdzIG5vIG1vcmUgcGFyZW50cy5cbiAgICAgICAgY29uc3QgTUFYX0NIQUlOID0gMTAwO1xuICAgICAgICBsZXQgcGFyZW50Q291bnQgPSAwO1xuXHRcdGxldCByb290ID0gdGhpcztcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmIHBhcmVudENvdW50IDwgTUFYX0NIQUlOKXtcblx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcbiAgICAgICAgICAgIHBhcmVudENvdW50Kz0gMTtcblx0XHR9XG5cdFx0aWYocGFyZW50Q291bnQgPj0gTUFYX0NIQUlOKXRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIHRvcC1sZXZlbCBwYXJlbnQhXCIpO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9XG4gICAgZ2V0RGVlcGVzdENoaWxkcmVuKCl7IC8vZmluZCBhbGwgbGVhZiBub2RlcyBmcm9tIHRoaXMgbm9kZVxuICAgICAgICAvL3RoaXMgYWxnb3JpdGhtIGNhbiBwcm9iYWJseSBiZSBpbXByb3ZlZFxuICAgICAgICBpZih0aGlzLmNoaWxkcmVuLmxlbmd0aCA9PSAwKXJldHVybiBbdGhpc107XG5cbiAgICAgICAgbGV0IGNoaWxkcmVuID0gW107XG4gICAgICAgIGZvcihsZXQgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGxldCBjaGlsZHNDaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW5baV0uZ2V0RGVlcGVzdENoaWxkcmVuKCk7XG4gICAgICAgICAgICBmb3IobGV0IGo9MDtqPGNoaWxkc0NoaWxkcmVuLmxlbmd0aDtqKyspe1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goY2hpbGRzQ2hpbGRyZW5bal0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG4gICAgZ2V0Q2xvc2VzdERvbWFpbigpe1xuICAgICAgICAvKiBGaW5kIHRoZSBEb21haW5Ob2RlIHRoYXQgdGhpcyBOb2RlIGlzIGJlaW5nIGNhbGxlZCBmcm9tLlxuICAgICAgICBUcmF2ZXJzZSB0aGUgY2hhaW4gb2YgcGFyZW50cyB1cHdhcmRzIHVudGlsIHdlIGZpbmQgYSBEb21haW5Ob2RlLCBhdCB3aGljaCBwb2ludCB3ZSByZXR1cm4gaXQuXG4gICAgICAgIFRoaXMgYWxsb3dzIGFuIG91dHB1dCB0byByZXNpemUgYW4gYXJyYXkgdG8gbWF0Y2ggYSBkb21haW5Ob2RlJ3MgbnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBmb3IgZXhhbXBsZS5cblxuICAgICAgICBOb3RlIHRoYXQgdGhpcyByZXR1cm5zIHRoZSBNT1NUIFJFQ0VOVCBEb21haW5Ob2RlIGFuY2VzdG9yIC0gaXQncyBhc3N1bWVkIHRoYXQgZG9tYWlubm9kZXMgb3ZlcndyaXRlIG9uZSBhbm90aGVyLlxuICAgICAgICAqL1xuICAgICAgICBjb25zdCBNQVhfQ0hBSU4gPSAxMDA7XG4gICAgICAgIGxldCBwYXJlbnRDb3VudCA9IDA7XG5cdFx0bGV0IHJvb3QgPSB0aGlzLnBhcmVudDsgLy9zdGFydCBvbmUgbGV2ZWwgdXAgaW4gY2FzZSB0aGlzIGlzIGEgRG9tYWluTm9kZSBhbHJlYWR5LiB3ZSBkb24ndCB3YW50IHRoYXRcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmICFyb290LmlzRG9tYWluTm9kZSAmJiBwYXJlbnRDb3VudCA8IE1BWF9DSEFJTil7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG4gICAgICAgICAgICBwYXJlbnRDb3VudCs9IDE7XG5cdFx0fVxuXHRcdGlmKHBhcmVudENvdW50ID49IE1BWF9DSEFJTil0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBwYXJlbnQhXCIpO1xuICAgICAgICBpZihyb290ID09PSBudWxsIHx8ICFyb290LmlzRG9tYWluTm9kZSl0aHJvdyBuZXcgRXJyb3IoXCJObyBEb21haW5Ob2RlIHBhcmVudCBmb3VuZCFcIik7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH1cblxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblx0XHQvL2J1dCBjYWxsIGFsbCBjaGlsZHJlblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0ub25BZnRlckFjdGl2YXRpb24oKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgT3V0cHV0Tm9kZSBleHRlbmRzIE5vZGV7IC8vbW9yZSBvZiBhIGphdmEgaW50ZXJmYWNlLCByZWFsbHlcblx0Y29uc3RydWN0b3IoKXtzdXBlcigpO31cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope31cblx0b25BZnRlckFjdGl2YXRpb24oKXt9XG5cdF9vbkFkZCgpe31cbn1cblxuY2xhc3MgRG9tYWluTm9kZSBleHRlbmRzIE5vZGV7IC8vQSBub2RlIHRoYXQgY2FsbHMgb3RoZXIgZnVuY3Rpb25zIG92ZXIgc29tZSByYW5nZS5cblx0Y29uc3RydWN0b3IoKXtcbiAgICAgICAgc3VwZXIoKTtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSBudWxsOyAvLyBudW1iZXIgb2YgdGltZXMgYW55IGNoaWxkIG5vZGUncyBldmFsdWF0ZVNlbGYoKSBpcyBjYWxsZWRcbiAgICB9XG4gICAgYWN0aXZhdGUodCl7fVxufVxuRG9tYWluTm9kZS5wcm90b3R5cGUuaXNEb21haW5Ob2RlID0gdHJ1ZTtcblxuZXhwb3J0IGRlZmF1bHQgTm9kZTtcbmV4cG9ydCB7T3V0cHV0Tm9kZSwgRG9tYWluTm9kZX07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9ICBmcm9tICcuL05vZGUuanMnO1xuY2xhc3MgRVhQQXJyYXkgZXh0ZW5kcyBEb21haW5Ob2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHRzdXBlcigpO1xuXHRcdC8qdmFyIHBvaW50cyA9IG5ldyBFWFAuQXJyYXkoe1xuXHRcdGRhdGE6IFtbLTEwLDEwXSxcblx0XHRcdFsxMCwxMF1dXG5cdFx0fSkqL1xuXG5cdFx0RVhQLlV0aWxzLmFzc2VydFByb3BFeGlzdHMob3B0aW9ucywgXCJkYXRhXCIpOyAvLyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXkuIGFzc3VtZWQgdG8gb25seSBjb250YWluIG9uZSB0eXBlOiBlaXRoZXIgbnVtYmVycyBvciBhcnJheXNcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmRhdGEsIEFycmF5KTtcblxuXHRcdC8vSXQncyBhc3N1bWVkIGFuIEVYUC5BcnJheSB3aWxsIG9ubHkgc3RvcmUgdGhpbmdzIHN1Y2ggYXMgMCwgWzBdLCBbMCwwXSBvciBbMCwwLDBdLiBJZiBhbiBhcnJheSB0eXBlIGlzIHN0b3JlZCwgdGhpcy5hcnJheVR5cGVEaW1lbnNpb25zIGNvbnRhaW5zIHRoZSAubGVuZ3RoIG9mIHRoYXQgYXJyYXkuIE90aGVyd2lzZSBpdCdzIDAsIGJlY2F1c2UgcG9pbnRzIGFyZSAwLWRpbWVuc2lvbmFsLlxuXHRcdGlmKG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3RvciA9PT0gTnVtYmVyKXtcblx0XHRcdHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyA9IDA7XG5cdFx0fWVsc2UgaWYob3B0aW9ucy5kYXRhWzBdLmNvbnN0cnVjdG9yID09PSBBcnJheSl7XG5cdFx0XHR0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPSBvcHRpb25zLmRhdGFbMF0ubGVuZ3RoO1xuXHRcdH1lbHNle1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkRhdGEgaW4gYW4gRVhQLkFycmF5IHNob3VsZCBiZSBhIG51bWJlciBvciBhbiBhcnJheSBvZiBvdGhlciB0aGluZ3MsIG5vdCBcIiArIG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3Rvcik7XG5cdFx0fVxuXG5cblx0XHRFWFAuVXRpbHMuYXNzZXJ0KG9wdGlvbnMuZGF0YVswXS5sZW5ndGggIT0gMCk7IC8vZG9uJ3QgYWNjZXB0IFtbXV0sIGRhdGEgbmVlZHMgdG8gYmUgc29tZXRoaW5nIGxpa2UgW1sxLDJdXS5cblxuXHRcdHRoaXMuZGF0YSA9IG9wdGlvbnMuZGF0YTtcblx0XHR0aGlzLm51bUl0ZW1zID0gdGhpcy5kYXRhLmxlbmd0aDtcblxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbdGhpcy5kYXRhLmxlbmd0aF07IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdC8vdGhlIG51bWJlciBvZiB0aW1lcyBldmVyeSBjaGlsZCdzIGV4cHIgaXMgY2FsbGVkXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSB0aGlzLml0ZW1EaW1lbnNpb25zLnJlZHVjZSgoc3VtLHkpPT5zdW0qeSk7XG5cdH1cblx0YWN0aXZhdGUodCl7XG5cdFx0aWYodGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID09IDApe1xuXHRcdFx0Ly9udW1iZXJzIGNhbid0IGJlIHNwcmVhZCB1c2luZyAuLi4gb3BlcmF0b3Jcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5kYXRhLmxlbmd0aDtpKyspe1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaSx0LHRoaXMuZGF0YVtpXSk7XG5cdFx0XHR9XG5cdFx0fWVsc2V7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuZGF0YS5sZW5ndGg7aSsrKXtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGksdCwuLi50aGlzLmRhdGFbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMub25BZnRlckFjdGl2YXRpb24oKTsgLy8gY2FsbCBjaGlsZHJlbiBpZiBuZWNlc3Nhcnlcblx0fVxuXHRfY2FsbEFsbENoaWxkcmVuKC4uLmNvb3JkaW5hdGVzKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcylcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgY2xvbmUgPSBuZXcgRVhQLkFycmF5KHtkYXRhOiBFWFAuVXRpbHMuYXJyYXlDb3B5KHRoaXMuZGF0YSl9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RBcnJheSgpe1xuXHR2YXIgeCA9IG5ldyBFWFAuQXJyYXkoe2RhdGE6IFtbMCwxXSxbMCwxXV19KTtcblx0dmFyIHkgPSBuZXcgRVhQLlRyYW5zZm9ybWF0aW9uKHtleHByOiBmdW5jdGlvbiguLi5hKXtjb25zb2xlLmxvZyguLi5hKTsgcmV0dXJuIFsyXX19KTtcblx0eC5hZGQoeSk7XG5cdHguYWN0aXZhdGUoNTEyKTtcbn1cblxuZXhwb3J0IHtFWFBBcnJheSBhcyBBcnJheX07XG4iLCJmdW5jdGlvbiBtdWx0aXBseVNjYWxhcihjLCBhcnJheSl7XG5cdGZvcih2YXIgaT0wO2k8YXJyYXkubGVuZ3RoO2krKyl7XG5cdFx0YXJyYXlbaV0gKj0gYztcblx0fVxuXHRyZXR1cm4gYXJyYXlcbn1cbmZ1bmN0aW9uIHZlY3RvckFkZCh2MSx2Mil7XG4gICAgbGV0IHZlYyA9IGNsb25lKHYxKTtcblx0Zm9yKHZhciBpPTA7aTx2MS5sZW5ndGg7aSsrKXtcblx0XHR2ZWNbaV0gKz0gdjJbaV07XG5cdH1cblx0cmV0dXJuIHZlY1xufVxuZnVuY3Rpb24gdmVjdG9yU3ViKHYxLHYyKXtcbiAgICBsZXQgdmVjID0gY2xvbmUodjEpO1xuXHRmb3IodmFyIGk9MDtpPHYxLmxlbmd0aDtpKyspe1xuXHRcdHZlY1tpXSArPSB2MltpXTtcblx0fVxuXHRyZXR1cm4gdmVjXG59XG5mdW5jdGlvbiBsZXJwVmVjdG9ycyh0LCBwMSwgcDIpe1xuXHQvL2Fzc3VtZWQgdCBpbiBbMCwxXVxuXHRyZXR1cm4gdmVjdG9yQWRkKG11bHRpcGx5U2NhbGFyKHQsY2xvbmUocDEpKSxtdWx0aXBseVNjYWxhcigxLXQsY2xvbmUocDIpKSk7XG59XG5mdW5jdGlvbiBjbG9uZSh2ZWMpe1xuXHR2YXIgbmV3QXJyID0gbmV3IEFycmF5KHZlYy5sZW5ndGgpO1xuXHRmb3IodmFyIGk9MDtpPHZlYy5sZW5ndGg7aSsrKXtcblx0XHRuZXdBcnJbaV0gPSB2ZWNbaV07XG5cdH1cblx0cmV0dXJuIG5ld0FyclxufVxuZnVuY3Rpb24gbXVsdGlwbHlNYXRyaXgodmVjLCBtYXRyaXgpe1xuXHQvL2Fzc2VydCB2ZWMubGVuZ3RoID09IG51bVJvd3NcblxuXHRsZXQgbnVtUm93cyA9IG1hdHJpeC5sZW5ndGg7XG5cdGxldCBudW1Db2xzID0gbWF0cml4WzBdLmxlbmd0aDtcblxuXHR2YXIgb3V0cHV0ID0gbmV3IEFycmF5KG51bUNvbHMpO1xuXHRmb3IodmFyIGo9MDtqPG51bUNvbHM7aisrKXtcblx0XHRvdXRwdXRbal0gPSAwO1xuXHRcdGZvcih2YXIgaT0wO2k8bnVtUm93cztpKyspe1xuXHRcdFx0b3V0cHV0W2pdICs9IG1hdHJpeFtpXVtqXSAqIHZlY1tpXTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIG91dHB1dDtcbn1cblxuLy9oYWNrXG5sZXQgTWF0aCA9IHtjbG9uZTogY2xvbmUsIGxlcnBWZWN0b3JzOiBsZXJwVmVjdG9ycywgdmVjdG9yQWRkOiB2ZWN0b3JBZGQsIHZlY3RvclN1YjogdmVjdG9yU3ViLCBtdWx0aXBseVNjYWxhcjogbXVsdGlwbHlTY2FsYXIsIG11bHRpcGx5TWF0cml4OiBtdWx0aXBseU1hdHJpeH07XG5cbmV4cG9ydCB7dmVjdG9yQWRkLCB2ZWN0b3JTdWIsIGxlcnBWZWN0b3JzLCBjbG9uZSwgbXVsdGlwbHlTY2FsYXIsIG11bHRpcGx5TWF0cml4LCBNYXRofTtcbiIsImltcG9ydCB7Y2xvbmV9IGZyb20gJy4vbWF0aC5qcydcblxuY2xhc3MgVXRpbHN7XG5cdHN0YXRpYyBpc0FycmF5KHgpe1xuICAgICAgICBpZih4ID09PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cdFx0cmV0dXJuIHguY29uc3RydWN0b3IgPT09IEFycmF5O1xuXHR9XG5cdHN0YXRpYyBpc09iamVjdCh4KXtcbiAgICAgICAgaWYoeCA9PT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXHRcdHJldHVybiB4LmNvbnN0cnVjdG9yID09PSBPYmplY3Q7XG5cdH1cblx0c3RhdGljIGFycmF5Q29weSh4KXtcblx0XHRyZXR1cm4geC5zbGljZSgpO1xuXHR9XG5cdHN0YXRpYyBpc0Z1bmN0aW9uKHgpe1xuICAgICAgICBpZih4ID09PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cdFx0cmV0dXJuIHguY29uc3RydWN0b3IgPT09IEZ1bmN0aW9uO1xuXHR9XG5cdHN0YXRpYyBpc051bWJlcih4KXtcbiAgICAgICAgaWYoeCA9PT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXHRcdHJldHVybiB4LmNvbnN0cnVjdG9yID09PSBOdW1iZXI7XG5cdH1cblxuXHRzdGF0aWMgYXNzZXJ0KHRoaW5nKXtcblx0XHQvL0EgZnVuY3Rpb24gdG8gY2hlY2sgaWYgc29tZXRoaW5nIGlzIHRydWUgYW5kIGhhbHQgb3RoZXJ3aXNlIGluIGEgY2FsbGJhY2thYmxlIHdheS5cblx0XHRpZighdGhpbmcpe1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBBc3NlcnRpb24gZmFpbGVkLiBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcbiAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcblx0XHR9XG5cdH1cblxuXHRzdGF0aWMgYXNzZXJ0VHlwZSh0aGluZywgdHlwZSwgZXJyb3JNc2cpe1xuXHRcdC8vQSBmdW5jdGlvbiB0byBjaGVjayBpZiBzb21ldGhpbmcgaXMgdHJ1ZSBhbmQgaGFsdCBvdGhlcndpc2UgaW4gYSBjYWxsYmFja2FibGUgd2F5LlxuXHRcdGlmKCEodGhpbmcuY29uc3RydWN0b3IgPT09IHR5cGUpKXtcblx0XHRcdGlmKGVycm9yTXNnKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBTb21ldGhpbmcgbm90IG9mIHJlcXVpcmVkIHR5cGUgXCIrdHlwZS5uYW1lK1wiISBcXG5cIitlcnJvck1zZytcIlxcbiBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFNvbWV0aGluZyBub3Qgb2YgcmVxdWlyZWQgdHlwZSBcIit0eXBlLm5hbWUrXCIhIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdFx0fVxuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuXHRcdH1cblx0fVxuXG5cblx0c3RhdGljIGFzc2VydFByb3BFeGlzdHModGhpbmcsIG5hbWUpe1xuXHRcdGlmKCF0aGluZyB8fCAhKG5hbWUgaW4gdGhpbmcpKXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgVGhpcyBvYmplY3Qgc2hvdWxkIGhhdmUgdGhlIHByb3BlcnR5IFwiK25hbWUrXCIsIGJ1dCBpdCB3YXMgbWlzc2luZzpcIik7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyh0aGluZyk7XG4gICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG5cdFx0fVxuXHR9XG5cdFxuXHRzdGF0aWMgY2xvbmUodmVjKXtcblx0XHRyZXR1cm4gY2xvbmUodmVjKTtcblx0fVxuXG5cblx0c3RhdGljIGlzMUROdW1lcmljQXJyYXkodmVjKXtcbiAgICAgICAgaWYoIVV0aWxzLmlzQXJyYXkodmVjKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBmb3IobGV0IGk9MDtpPHZlYy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGlmKCFVdGlscy5pc051bWJlcih2ZWNbaV0pKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG5cdH1cblxuICAgIHN0YXRpYyBkaXN0KHZlYzEsIHZlYzIpe1xuICAgICAgICBsZXQgc3VtID0gMDtcbiAgICAgICAgVXRpbHMuYXNzZXJ0KFV0aWxzLmlzMUROdW1lcmljQXJyYXkodmVjMSkpO1xuICAgICAgICBVdGlscy5hc3NlcnQoVXRpbHMuaXMxRE51bWVyaWNBcnJheSh2ZWMyKSk7XG4gICAgICAgIGZvcihsZXQgaT0wO2k8dmVjMS5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIHN1bSArPSAodmVjMVtpXS12ZWMyW2ldKSoodmVjMVtpXS12ZWMyW2ldKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQoc3VtKTtcbiAgICB9XG5cbn1cblxuZXhwb3J0IHtVdGlsc307XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7IERvbWFpbk5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuXG5jbGFzcyBBcmVhIGV4dGVuZHMgRG9tYWluTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8qdmFyIGF4ZXMgPSBuZXcgRVhQLkFyZWEoe1xuXHRcdGJvdW5kczogW1stMTAsMTBdLFxuXHRcdFx0WzEwLDEwXV1cblx0XHRudW1JdGVtczogMTA7IC8vb3B0aW9uYWwuIEFsdGVybmF0ZWx5IG51bUl0ZW1zIGNhbiB2YXJ5IGZvciBlYWNoIGF4aXM6IG51bUl0ZW1zOiBbMTAsMl1cblx0XHR9KSovXG5cblxuXHRcblx0XHRVdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiYm91bmRzXCIpOyAvLyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXlcblx0XHRVdGlscy5hc3NlcnRUeXBlKG9wdGlvbnMuYm91bmRzLCBBcnJheSk7XG5cdFx0VXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmJvdW5kc1swXSwgQXJyYXksIFwiRm9yIGFuIEFyZWEsIG9wdGlvbnMuYm91bmRzIG11c3QgYmUgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LCBldmVuIGZvciBvbmUgZGltZW5zaW9uIVwiKTsgLy8gaXQgTVVTVCBiZSBtdWx0aWRpbWVuc2lvbmFsXG5cdFx0dGhpcy5udW1EaW1lbnNpb25zID0gb3B0aW9ucy5ib3VuZHMubGVuZ3RoO1xuXG5cdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMuYm91bmRzWzBdLmxlbmd0aCAhPSAwKTsgLy9kb24ndCBhY2NlcHQgW1tdXSwgaXQgbmVlZHMgdG8gYmUgW1sxLDJdXS5cblxuXHRcdHRoaXMuYm91bmRzID0gb3B0aW9ucy5ib3VuZHM7XG5cdFx0dGhpcy5udW1JdGVtcyA9IG9wdGlvbnMubnVtSXRlbXMgfHwgMTY7XG5cblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdGlmKHRoaXMubnVtSXRlbXMuY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtRGltZW5zaW9ucztpKyspe1xuXHRcdFx0XHR0aGlzLml0ZW1EaW1lbnNpb25zLnB1c2godGhpcy5udW1JdGVtcyk7XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1JdGVtcy5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMubnVtSXRlbXMubGVuZ3RoID09IG9wdGlvbnMuYm91bmRzLmxlbmd0aCk7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtRGltZW5zaW9ucztpKyspe1xuXHRcdFx0XHR0aGlzLml0ZW1EaW1lbnNpb25zLnB1c2godGhpcy5udW1JdGVtc1tpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIHRpbWVzIGV2ZXJ5IGNoaWxkJ3MgZXhwciBpcyBjYWxsZWRcblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHRoaXMuaXRlbURpbWVuc2lvbnMucmVkdWNlKChzdW0seSk9PnN1bSp5KTtcblx0fVxuXHRhY3RpdmF0ZSh0KXtcblx0XHQvL1VzZSB0aGlzIHRvIGV2YWx1YXRlIGV4cHIoKSBhbmQgdXBkYXRlIHRoZSByZXN1bHQsIGNhc2NhZGUtc3R5bGUuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIGJvdW5kcyB0aGlzIG9iamVjdCBoYXMgd2lsbCBiZSB0aGUgbnVtYmVyIG9mIGRpbWVuc2lvbnMuXG5cdFx0Ly90aGUgZXhwcigpcyBhcmUgY2FsbGVkIHdpdGggZXhwcihpLCAuLi5bY29vcmRpbmF0ZXNdLCB0KSwgXG5cdFx0Ly9cdCh3aGVyZSBpIGlzIHRoZSBpbmRleCBvZiB0aGUgY3VycmVudCBldmFsdWF0aW9uID0gdGltZXMgZXhwcigpIGhhcyBiZWVuIGNhbGxlZCB0aGlzIGZyYW1lLCB0ID0gYWJzb2x1dGUgdGltZXN0ZXAgKHMpKS5cblx0XHQvL3BsZWFzZSBjYWxsIHdpdGggYSB0IHZhbHVlIG9idGFpbmVkIGZyb20gcGVyZm9ybWFuY2Uubm93KCkvMTAwMCBvciBzb21ldGhpbmcgbGlrZSB0aGF0XG5cblx0XHQvL25vdGUgdGhlIGxlc3MtdGhhbi1vci1lcXVhbC10byBpbiB0aGVzZSBsb29wc1xuXHRcdGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAxKXtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRsZXQgaW5kZXggPSBpO1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSwwLDAsMCk7XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1EaW1lbnNpb25zID09IDIpe1xuXHRcdFx0Ly90aGlzIGNhbiBiZSByZWR1Y2VkIGludG8gYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIG92ZXIgdGhlIGZpcnN0IGluZGV4IG9mIHRoaXMuYm91bmRzLCBJIGtub3cgaXRcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRmb3IodmFyIGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aisrKXtcblx0XHRcdFx0XHRsZXQgYzIgPSB0aGlzLmJvdW5kc1sxXVswXSArICh0aGlzLmJvdW5kc1sxXVsxXS10aGlzLmJvdW5kc1sxXVswXSkqKGovKHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSkpO1xuXHRcdFx0XHRcdGxldCBpbmRleCA9IGkqdGhpcy5pdGVtRGltZW5zaW9uc1sxXSArIGo7XG5cdFx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsYzIsMCwwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAzKXtcblx0XHRcdC8vdGhpcyBjYW4gYmUgcmVkdWNlZCBpbnRvIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSBvdmVyIHRoZSBmaXJzdCBpbmRleCBvZiB0aGlzLmJvdW5kcywgSSBrbm93IGl0XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0Zm9yKHZhciBqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzFdO2orKyl7XG5cdFx0XHRcdFx0bGV0IGMyID0gdGhpcy5ib3VuZHNbMV1bMF0gKyAodGhpcy5ib3VuZHNbMV1bMV0tdGhpcy5ib3VuZHNbMV1bMF0pKihqLyh0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTEpKTtcblx0XHRcdFx0XHRmb3IodmFyIGs9MDtrPHRoaXMuaXRlbURpbWVuc2lvbnNbMl07aysrKXtcblx0XHRcdFx0XHRcdGxldCBjMyA9IHRoaXMuYm91bmRzWzJdWzBdICsgKHRoaXMuYm91bmRzWzJdWzFdLXRoaXMuYm91bmRzWzJdWzBdKSooay8odGhpcy5pdGVtRGltZW5zaW9uc1syXS0xKSk7XG5cdFx0XHRcdFx0XHRsZXQgaW5kZXggPSAoaSp0aGlzLml0ZW1EaW1lbnNpb25zWzFdICsgaikqdGhpcy5pdGVtRGltZW5zaW9uc1syXSArIGs7XG5cdFx0XHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSxjMixjMywwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ZWxzZXtcblx0XHRcdGFzc2VydChcIlRPRE86IFVzZSBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgdG8gbG9vcCBvdmVyIGFsbCBpbmRpY2VzIVwiKTtcblx0XHR9XG5cblx0XHR0aGlzLm9uQWZ0ZXJBY3RpdmF0aW9uKCk7IC8vIGNhbGwgY2hpbGRyZW4gaWYgbmVjZXNzYXJ5XG5cdH1cblx0X2NhbGxBbGxDaGlsZHJlbiguLi5jb29yZGluYXRlcyl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpXG5cdFx0fVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEFyZWEoe2JvdW5kczogVXRpbHMuYXJyYXlDb3B5KHRoaXMuYm91bmRzKSwgbnVtSXRlbXM6IHRoaXMubnVtSXRlbXN9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHRcdGlmKGNsb25lLmNoaWxkcmVuW2ldLl9vbkFkZCljbG9uZS5jaGlsZHJlbltpXS5fb25BZGQoKTsgLy8gbmVjZXNzYXJ5IG5vdyB0aGF0IHRoZSBjaGFpbiBvZiBhZGRpbmcgaGFzIGJlZW4gZXN0YWJsaXNoZWRcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RBcmVhKCl7XG5cdHZhciB4ID0gbmV3IEFyZWEoe2JvdW5kczogW1swLDFdLFswLDFdXX0pO1xuXHR2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSl9fSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKCk7XG59XG5cbmV4cG9ydCB7IEFyZWEgfVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCBOb2RlIGZyb20gJy4vTm9kZS5qcyc7XG5cbi8vVXNhZ2U6IHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiBmdW5jdGlvbiguLi5hKXtjb25zb2xlLmxvZyguLi5hKX19KTtcbmNsYXNzIFRyYW5zZm9ybWF0aW9uIGV4dGVuZHMgTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblx0XG5cdFx0RVhQLlV0aWxzLmFzc2VydFByb3BFeGlzdHMob3B0aW9ucywgXCJleHByXCIpOyAvLyBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXlcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmV4cHIsIEZ1bmN0aW9uKTtcblxuXHRcdHRoaXMuZXhwciA9IG9wdGlvbnMuZXhwcjtcblx0fVxuXHRldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpe1xuXHRcdC8vZXZhbHVhdGUgdGhpcyBUcmFuc2Zvcm1hdGlvbidzIF9leHByLCBhbmQgYnJvYWRjYXN0IHRoZSByZXN1bHQgdG8gYWxsIGNoaWxkcmVuLlxuXHRcdGxldCByZXN1bHQgPSB0aGlzLmV4cHIoLi4uY29vcmRpbmF0ZXMpO1xuXHRcdGlmKHJlc3VsdC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpcmVzdWx0ID0gW3Jlc3VsdF07XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZihjb29yZGluYXRlc1swXSxjb29yZGluYXRlc1sxXSwgLi4ucmVzdWx0KVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCB0aGlzRXhwciA9IHRoaXMuZXhwcjtcblx0XHRsZXQgY2xvbmUgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IHRoaXNFeHByLmJpbmQoKX0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cblx0bWFrZUxpbmsoKXtcbiAgICAgICAgLy9saWtlIGEgY2xvbmUsIGJ1dCB3aWxsIHVzZSB0aGUgc2FtZSBleHByIGFzIHRoaXMgVHJhbnNmb3JtYXRpb24uXG4gICAgICAgIC8vdXNlZnVsIGlmIHRoZXJlJ3MgYSBzcGVjaWZpYyBmdW5jdGlvbiB0aGF0IG5lZWRzIHRvIGJlIHVzZWQgYnkgYSBidW5jaCBvZiBvYmplY3RzXG5cdFx0cmV0dXJuIG5ldyBMaW5rZWRUcmFuc2Zvcm1hdGlvbih0aGlzKTtcblx0fVxufVxuXG5jbGFzcyBMaW5rZWRUcmFuc2Zvcm1hdGlvbiBleHRlbmRzIE5vZGV7XG4gICAgLypcbiAgICAgICAgTGlrZSBhbiBFWFAuVHJhbnNmb3JtYXRpb24sIGJ1dCBpdCB1c2VzIGFuIGV4aXN0aW5nIEVYUC5UcmFuc2Zvcm1hdGlvbidzIGV4cHIoKSwgc28gaWYgdGhlIGxpbmtlZCB0cmFuc2Zvcm1hdGlvbiB1cGRhdGVzLCBzbyBkb2VzIHRoaXMgb25lLiBJdCdzIGxpa2UgYSBwb2ludGVyIHRvIGEgVHJhbnNmb3JtYXRpb24sIGJ1dCBpbiBvYmplY3QgZm9ybS4gXG4gICAgKi9cblx0Y29uc3RydWN0b3IodHJhbnNmb3JtYXRpb25Ub0xpbmtUbyl7XG5cdFx0c3VwZXIoe30pO1xuXHRcdEVYUC5VdGlscy5hc3NlcnRUeXBlKHRyYW5zZm9ybWF0aW9uVG9MaW5rVG8sIFRyYW5zZm9ybWF0aW9uKTtcbiAgICAgICAgdGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUgPSB0cmFuc2Zvcm1hdGlvblRvTGlua1RvO1xuXHR9XG5cdGV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcyl7XG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlLmV4cHIoLi4uY29vcmRpbmF0ZXMpO1xuXHRcdGlmKHJlc3VsdC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpcmVzdWx0ID0gW3Jlc3VsdF07XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZihjb29yZGluYXRlc1swXSxjb29yZGluYXRlc1sxXSwgLi4ucmVzdWx0KVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBMaW5rZWRUcmFuc2Zvcm1hdGlvbih0aGlzLmxpbmtlZFRyYW5zZm9ybWF0aW9uTm9kZSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxuXHRtYWtlTGluaygpe1xuXHRcdHJldHVybiBuZXcgTGlua2VkVHJhbnNmb3JtYXRpb24odGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUpO1xuXHR9XG59XG5cblxuXG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RUcmFuc2Zvcm1hdGlvbigpe1xuXHR2YXIgeCA9IG5ldyBBcmVhKHtib3VuZHM6IFtbLTEwLDEwXV19KTtcblx0dmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oeydleHByJzogKHgpID0+IGNvbnNvbGUubG9nKHgqeCl9KTtcblx0eC5hZGQoeSk7XG5cdHguYWN0aXZhdGUoKTsgLy8gc2hvdWxkIHJldHVybiAxMDAsIDgxLCA2NC4uLiAwLCAxLCA0Li4uIDEwMFxufVxuXG5leHBvcnQgeyBUcmFuc2Zvcm1hdGlvbiwgTGlua2VkVHJhbnNmb3JtYXRpb259XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5cbmNsYXNzIEhpc3RvcnlSZWNvcmRlciBleHRlbmRzIERvbWFpbk5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIENsYXNzIHRoYXQgcmVjb3JkcyB0aGUgbGFzdCBmZXcgdmFsdWVzIG9mIHRoZSBwYXJlbnQgVHJhbnNmb3JtYXRpb24gYW5kIG1ha2VzIHRoZW0gYXZhaWxhYmxlIGZvciB1c2UgYXMgYW4gZXh0cmEgZGltZW5zaW9uLlxuICAgICAgICAgICAgVXNhZ2U6XG4gICAgICAgICAgICB2YXIgcmVjb3JkZXIgPSBuZXcgSGlzdG9yeVJlY29yZGVyKHtcbiAgICAgICAgICAgICAgICBtZW1vcnlMZW5ndGg6IDEwIC8vIGhvdyBtYW55IHBhc3QgdmFsdWVzIHRvIHN0b3JlP1xuICAgICAgICAgICAgICAgIHJlY29yZEZyYW1lSW50ZXJ2YWw6IDE1Ly9Ib3cgbG9uZyB0byB3YWl0IGJldHdlZW4gZWFjaCBjYXB0dXJlPyBNZWFzdXJlZCBpbiBmcmFtZXMsIHNvIDYwID0gMSBjYXB0dXJlIHBlciBzZWNvbmQsIDMwID0gMiBjYXB0dXJlcy9zZWNvbmQsIGV0Yy5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBleGFtcGxlIHVzYWdlOlxuICAgICAgICAgICAgbmV3IEFyZWEoe2JvdW5kczogW1stNSw1XV19KS5hZGQobmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiAoaSx0LHgpID0+IFtNYXRoLnNpbih4KSxNYXRoLmNvcyh4KV19KSkuYWRkKG5ldyBFWFAuSGlzdG9yeVJlY29yZGVyKHttZW1vcnlMZW5ndGg6IDV9KS5hZGQobmV3IExpbmVPdXRwdXQoe3dpZHRoOiA1LCBjb2xvcjogMHhmZjAwMDB9KSk7XG5cbiAgICAgICAgICAgIE5PVEU6IEl0IGlzIGFzc3VtZWQgdGhhdCBhbnkgcGFyZW50IHRyYW5zZm9ybWF0aW9uIG91dHB1dHMgYW4gYXJyYXkgb2YgbnVtYmVycyB0aGF0IGlzIDQgb3IgbGVzcyBpbiBsZW5ndGguXG4gICAgICAgICovXG5cblx0XHR0aGlzLm1lbW9yeUxlbmd0aCA9IG9wdGlvbnMubWVtb3J5TGVuZ3RoID09PSB1bmRlZmluZWQgPyAxMCA6IG9wdGlvbnMubWVtb3J5TGVuZ3RoO1xuICAgICAgICB0aGlzLnJlY29yZEZyYW1lSW50ZXJ2YWwgPSBvcHRpb25zLnJlY29yZEZyYW1lSW50ZXJ2YWwgPT09IHVuZGVmaW5lZCA/IDE1IDogb3B0aW9ucy5yZWNvcmRGcmFtZUludGVydmFsOyAvL3NldCB0byAxIHRvIHJlY29yZCBldmVyeSBmcmFtZS5cbiAgICAgICAgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDQ7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/ICh0b2RvOiBhdXRvZGV0ZWN0IHRoaXMgZnJvbSBwYXJlbnQncyBvdXRwdXQpXG5cdFx0dGhpcy5jdXJyZW50SGlzdG9yeUluZGV4PTA7XG4gICAgICAgIHRoaXMuZnJhbWVSZWNvcmRUaW1lciA9IDA7XG5cdH1cblx0X29uQWRkKCl7XG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIEFyZWFcblx0XHRsZXQgcm9vdCA9IHRoaXMuZ2V0Q2xvc2VzdERvbWFpbigpO1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIHRoaXMubWVtb3J5TGVuZ3RoO1xuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSByb290Lml0ZW1EaW1lbnNpb25zLmNvbmNhdChbdGhpcy5tZW1vcnlMZW5ndGhdKTtcblxuICAgICAgICB0aGlzLmJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcbiAgICBcbiAgICAgICAgLy9UaGlzIGlzIHNvIHRoYXQgbm8gc3VyZmFjZS9ib3VuZGFyeSB3aWxsIGFwcGVhciB1bnRpbCBoaXN0b3J5IGJlZ2lucyB0byBiZSByZWNvcmRlZC4gSSdtIHNvIHNvcnJ5LlxuICAgICAgICAvL1RvZG86IHByb3BlciBjbGlwIHNoYWRlciBsaWtlIG1hdGhib3ggZG9lcyBvciBzb21ldGhpbmcuXG4gICAgICAgIHRoaXMuYnVmZmVyLmZpbGwoTmFOKTsgXG5cdH1cbiAgICBvbkFmdGVyQWN0aXZhdGlvbigpe1xuICAgICAgICBzdXBlci5vbkFmdGVyQWN0aXZhdGlvbigpO1xuXG4gICAgICAgIC8vZXZlcnkgc28gb2Z0ZW4sIHNoaWZ0IHRvIHRoZSBuZXh0IGJ1ZmZlciBzbG90XG4gICAgICAgIHRoaXMuZnJhbWVSZWNvcmRUaW1lciArPSAxO1xuICAgICAgICBpZih0aGlzLmZyYW1lUmVjb3JkVGltZXIgPj0gdGhpcy5yZWNvcmRGcmFtZUludGVydmFsKXtcbiAgICAgICAgICAgIC8vcmVzZXQgZnJhbWUgcmVjb3JkIHRpbWVyXG4gICAgICAgICAgICB0aGlzLmZyYW1lUmVjb3JkVGltZXIgPSAwO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4ID0gKHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCsxKSV0aGlzLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgfVxuICAgIH1cblx0ZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKXtcblx0XHQvL2V2YWx1YXRlIHRoaXMgVHJhbnNmb3JtYXRpb24ncyBfZXhwciwgYW5kIGJyb2FkY2FzdCB0aGUgcmVzdWx0IHRvIGFsbCBjaGlsZHJlbi5cblx0XHRsZXQgaSA9IGNvb3JkaW5hdGVzWzBdO1xuXHRcdGxldCB0ID0gY29vcmRpbmF0ZXNbMV07XG4gICAgXG4gICAgICAgIC8vc3RlcCAxOiBzYXZlIGNvb3JkaW5hdGVzIGZvciB0aGlzIGZyYW1lIGluIGJ1ZmZlclxuICAgICAgICBpZihjb29yZGluYXRlcy5sZW5ndGggPiAyK3RoaXMuX291dHB1dERpbWVuc2lvbnMpe1xuICAgICAgICAgICAgLy90b2RvOiBtYWtlIHRoaXMgdXBkYXRlIHRoaXMuX291dHB1dERpbWVuc2lvbnMgYW5kIHJlYWxsb2NhdGUgbW9yZSBidWZmZXIgc3BhY2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVYUC5IaXN0b3J5UmVjb3JkZXIgaXMgdW5hYmxlIHRvIHJlY29yZCBoaXN0b3J5IG9mIHNvbWV0aGluZyB0aGF0IG91dHB1dHMgaW4gXCIrdGhpcy5fb3V0cHV0RGltZW5zaW9ucytcIiBkaW1lbnNpb25zISBZZXQuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGN5Y2xpY0J1ZmZlckluZGV4ID0gKGkqdGhpcy5tZW1vcnlMZW5ndGgrdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4KSp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuICAgICAgICBmb3IodmFyIGo9MDtqPGNvb3JkaW5hdGVzLmxlbmd0aC0yO2orKyl7IFxuICAgICAgICAgICAgdGhpcy5idWZmZXJbY3ljbGljQnVmZmVySW5kZXgral0gPSBjb29yZGluYXRlc1syK2pdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9zdGVwIDI6LCBjYWxsIGFueSBjaGlsZHJlbiBvbmNlIHBlciBoaXN0b3J5IGl0ZW1cbiAgICAgICAgZm9yKHZhciBjaGlsZE5vPTA7Y2hpbGRObzx0aGlzLmNoaWxkcmVuLmxlbmd0aDtjaGlsZE5vKyspe1xuXHRcdCAgICBmb3IodmFyIGo9MDtqPHRoaXMubWVtb3J5TGVuZ3RoO2orKyl7XG5cbiAgICAgICAgICAgICAgICAvL3RoZSArMSBpbiAoaiArIHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCArIDEpIGlzIGltcG9ydGFudDsgd2l0aG91dCBpdCwgYSBMaW5lT3V0cHV0IHdpbGwgZHJhdyBhIGxpbmUgZnJvbSB0aGUgbW9zdCByZWNlbnQgdmFsdWUgdG8gdGhlIGVuZCBvZiBoaXN0b3J5XG4gICAgICAgICAgICAgICAgbGV0IGN5Y2xpY0hpc3RvcnlWYWx1ZSA9IChqICsgdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4ICsgMSkgJSB0aGlzLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgICAgICAgICBsZXQgY3ljbGljQnVmZmVySW5kZXggPSAoaSAqIHRoaXMubWVtb3J5TGVuZ3RoICsgY3ljbGljSGlzdG9yeVZhbHVlKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuICAgICAgICAgICAgICAgIGxldCBub25DeWNsaWNJbmRleCA9IGkgKiB0aGlzLm1lbW9yeUxlbmd0aCArIGo7XG5cblx0XHQgICAgICAgIC8vSSdtIHRvcm4gb24gd2hldGhlciB0byBhZGQgYSBmaW5hbCBjb29yZGluYXRlIGF0IHRoZSBlbmQgc28gaGlzdG9yeSBjYW4gZ28gb2ZmIGluIGEgbmV3IGRpcmVjdGlvbi5cbiAgICAgICAgICAgICAgICAvL3RoaXMuY2hpbGRyZW5bY2hpbGROb10uZXZhbHVhdGVTZWxmKG5vbkN5Y2xpY0luZGV4LHQsdGhpcy5idWZmZXJbY3ljbGljQnVmZmVySW5kZXhdLCBjeWNsaWNIaXN0b3J5VmFsdWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW5bY2hpbGROb10uZXZhbHVhdGVTZWxmKFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9uQ3ljbGljSW5kZXgsdCwgLy9pLHRcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuYnVmZmVyLnNsaWNlKGN5Y2xpY0J1ZmZlckluZGV4LGN5Y2xpY0J1ZmZlckluZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMpIC8vZXh0cmFjdCBjb29yZGluYXRlcyBmb3IgdGhpcyBoaXN0b3J5IHZhbHVlIGZyb20gYnVmZmVyXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEhpc3RvcnlSZWNvcmRlcih7bWVtb3J5TGVuZ3RoOiB0aGlzLm1lbW9yeUxlbmd0aCwgcmVjb3JkRnJhbWVJbnRlcnZhbDogdGhpcy5yZWNvcmRGcmFtZUludGVydmFsfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5leHBvcnQgeyBIaXN0b3J5UmVjb3JkZXIgfVxuIiwidmFyIHRocmVlRW52aXJvbm1lbnQgPSBudWxsO1xuXG5mdW5jdGlvbiBzZXRUaHJlZUVudmlyb25tZW50KG5ld0Vudil7XG4gICAgdGhyZWVFbnZpcm9ubWVudCA9IG5ld0Vudjtcbn1cbmZ1bmN0aW9uIGdldFRocmVlRW52aXJvbm1lbnQoKXtcbiAgICByZXR1cm4gdGhyZWVFbnZpcm9ubWVudDtcbn1cbmV4cG9ydCB7c2V0VGhyZWVFbnZpcm9ubWVudCwgZ2V0VGhyZWVFbnZpcm9ubWVudCwgdGhyZWVFbnZpcm9ubWVudH07XG4iLCJpbXBvcnQgeyBVdGlscyB9IGZyb20gJy4vdXRpbHMuanMnO1xuXG5pbXBvcnQgeyBUcmFuc2Zvcm1hdGlvbiB9IGZyb20gJy4vVHJhbnNmb3JtYXRpb24uanMnO1xuXG5pbXBvcnQgKiBhcyBtYXRoIGZyb20gJy4vbWF0aC5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxubGV0IEVQUyA9IE51bWJlci5FUFNJTE9OO1xuXG5jb25zdCBFYXNpbmcgPSB7RWFzZUluT3V0OjEsRWFzZUluOjIsRWFzZU91dDozfTtcblxuY2xhc3MgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcbiAgICAgICAgdGhpcy50b1ZhbHVlID0gdG9WYWx1ZTtcbiAgICAgICAgdGhpcy5mcm9tVmFsdWUgPSBmcm9tVmFsdWU7XG4gICAgICAgIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uID0gaW50ZXJwb2xhdGlvbkZ1bmN0aW9uO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZShwZXJjZW50YWdlKXt9IC8vcGVyY2VudGFnZSBpcyAwLTEgbGluZWFybHlcbn1cbmNsYXNzIE51bWJlckludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG5cdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcblx0XHRyZXR1cm4gdCp0aGlzLnRvVmFsdWUgKyAoMS10KSp0aGlzLmZyb21WYWx1ZTtcbiAgICB9XG59XG5cbmNsYXNzIEJvb2xJbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuICAgICAgICBsZXQgdCA9IHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHBlcmNlbnRhZ2UpO1xuICAgICAgICBpZih0ID4gMC41KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvVmFsdWU7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZnJvbVZhbHVlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbmNsYXNzIFRocmVlSnNDb2xvckludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy50ZW1wVmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IoKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG4gICAgICAgIGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG4gICAgICAgIHRoaXMudGVtcFZhbHVlLmNvcHkodGhpcy5mcm9tVmFsdWUpO1xuICAgICAgICByZXR1cm4gdGhpcy50ZW1wVmFsdWUubGVycCh0aGlzLnRvVmFsdWUsIHQpO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZUFuZENvcHlUbyhwZXJjZW50YWdlLCB0YXJnZXQpe1xuICAgICAgICBsZXQgcmVzdWx0QXJyYXkgPSB0aGlzLmludGVycG9sYXRlKHBlcmNlbnRhZ2UpO1xuICAgICAgICB0YXJnZXQuY29weShyZXN1bHRBcnJheSk7XG4gICAgfVxufVxuY2xhc3MgVGhyZWVKc1ZlYzNJbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgIGlmKFV0aWxzLmlzQXJyYXkodG9WYWx1ZSkgJiYgdG9WYWx1ZS5sZW5ndGggPD0gMyl7XG4gICAgICAgICAgICB0aGlzLnRvVmFsdWUgPSBuZXcgVEhSRUUuVmVjdG9yMyguLi50aGlzLnRvVmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGVtcFZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG4gICAgICAgIGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG4gICAgICAgIHJldHVybiB0aGlzLnRlbXBWYWx1ZS5sZXJwVmVjdG9ycyh0aGlzLmZyb21WYWx1ZSwgdGhpcy50b1ZhbHVlLCB0KTsgLy90aGlzIG1vZGlmaWVzIHRoaXMudGVtcFZhbHVlIGluLXBsYWNlIGFuZCByZXR1cm5zIGl0XG4gICAgfVxuICAgIGludGVycG9sYXRlQW5kQ29weVRvKHBlcmNlbnRhZ2UsIHRhcmdldCl7XG4gICAgICAgIGxldCByZXN1bHRBcnJheSA9IHRoaXMuaW50ZXJwb2xhdGUocGVyY2VudGFnZSk7XG4gICAgICAgIHRhcmdldC5jb3B5KHJlc3VsdEFycmF5KTtcbiAgICB9XG59XG5cbmNsYXNzIFRyYW5zZm9ybWF0aW9uRnVuY3Rpb25JbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24sIHN0YWdnZXJGcmFjdGlvbiwgdGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uKXtcbiAgICAgICAgc3VwZXIoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB0aGlzLnN0YWdnZXJGcmFjdGlvbiA9IHN0YWdnZXJGcmFjdGlvbjtcbiAgICAgICAgdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gPSB0YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb247XG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuXHRcdFx0Ly9pZiBzdGFnZ2VyRnJhY3Rpb24gIT0gMCwgaXQncyB0aGUgYW1vdW50IG9mIHRpbWUgYmV0d2VlbiB0aGUgZmlyc3QgcG9pbnQncyBzdGFydCB0aW1lIGFuZCB0aGUgbGFzdCBwb2ludCdzIHN0YXJ0IHRpbWUuXG5cdFx0XHQvL0FTU1VNUFRJT046IHRoZSBmaXJzdCB2YXJpYWJsZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGksIGFuZCBpdCdzIGFzc3VtZWQgaSBpcyB6ZXJvLWluZGV4ZWQuXG5cdFx0XHQvL2VuY2Fwc3VsYXRlIHBlcmNlbnRhZ2VcblxuXHRcdFx0cmV0dXJuIChmdW5jdGlvbiguLi5jb29yZHMpe1xuICAgICAgICAgICAgICAgIGNvbnN0IGkgPSBjb29yZHNbMF07XG5cdFx0XHRcdGxldCBsZXJwRmFjdG9yID0gcGVyY2VudGFnZTtcblxuICAgICAgICAgICAgICAgIC8vZmFuY3kgc3RhZ2dlcmluZyBtYXRoLCBpZiB3ZSBrbm93IGhvdyBtYW55IG9iamVjdHMgYXJlIGZsb3dpbmcgdGhyb3VnaCB0aGlzIHRyYW5zZm9ybWF0aW9uIGF0IG9uY2VcbiAgICAgICAgICAgICAgICBpZih0aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbiAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgICAgICAgICAgbGVycEZhY3RvciA9IHBlcmNlbnRhZ2UvKDEtdGhpcy5zdGFnZ2VyRnJhY3Rpb24rRVBTKSAtIGkqdGhpcy5zdGFnZ2VyRnJhY3Rpb24vdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb247XG4gICAgICAgICAgICAgICAgfVxuXHRcdFx0XHQvL2xldCBwZXJjZW50ID0gTWF0aC5taW4oTWF0aC5tYXgocGVyY2VudGFnZSAtIGkvdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gICAsMSksMCk7XG5cblx0XHRcdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihNYXRoLm1heChNYXRoLm1pbihsZXJwRmFjdG9yLDEpLDApKTtcblx0XHRcdFx0cmV0dXJuIG1hdGgubGVycFZlY3RvcnModCx0aGlzLnRvVmFsdWUoLi4uY29vcmRzKSx0aGlzLmZyb21WYWx1ZSguLi5jb29yZHMpKVxuXHRcdFx0fSkuYmluZCh0aGlzKTtcbiAgICB9XG59XG5cbmNsYXNzIE51bWVyaWMxREFycmF5SW50ZXJwb2xhdG9yIGV4dGVuZHMgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcbiAgICAgICAgc3VwZXIoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB0aGlzLmxhcmdlc3RMZW5ndGggPSBNYXRoLm1heChmcm9tVmFsdWUubGVuZ3RoLCB0b1ZhbHVlLmxlbmd0aCk7XG4gICAgICAgIHRoaXMuc2hvcnRlc3RMZW5ndGggPSBNYXRoLm1pbihmcm9tVmFsdWUubGVuZ3RoLCB0b1ZhbHVlLmxlbmd0aCk7XG4gICAgICAgIHRoaXMuZnJvbVZhbHVlSXNTaG9ydGVyID0gZnJvbVZhbHVlLmxlbmd0aCA8IHRvVmFsdWUubGVuZ3RoO1xuICAgICAgICB0aGlzLnJlc3VsdEFycmF5ID0gbmV3IEFycmF5KHRoaXMubGFyZ2VzdExlbmd0aCk7IC8vY2FjaGVkIGZvciBzcGVlZHVwXG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuXHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG4gICAgICAgIGZvcihsZXQgaT0wO2k8dGhpcy5zaG9ydGVzdExlbmd0aDtpKyspe1xuICAgICAgICAgICAgdGhpcy5yZXN1bHRBcnJheVtpXSA9IHQqdGhpcy50b1ZhbHVlW2ldICsgKDEtdCkqdGhpcy5mcm9tVmFsdWVbaV07XG4gICAgICAgIH1cblxuICAgICAgICAvL2lmIG9uZSBhcnJheSBpcyBsb25nZXIgdGhhbiB0aGUgb3RoZXIsIGludGVycG9sYXRlIGFzIGlmIHRoZSBzaG9ydGVyIGFycmF5IGlzIHBhZGRlZCB3aXRoIHplcm9lc1xuICAgICAgICBpZih0aGlzLmZyb21WYWx1ZUlzU2hvcnRlcil7XG4gICAgICAgICAgICAvL3RoaXMuZnJvbVZhbHVlW2ldIGRvZXNuJ3QgZXhpc3QsIHNvIGFzc3VtZSBpdCdzIGEgemVyb1xuICAgICAgICAgICAgZm9yKGxldCBpPXRoaXMuc2hvcnRlc3RMZW5ndGg7aTx0aGlzLmxhcmdlc3RMZW5ndGg7aSsrKXtcbiAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdEFycmF5W2ldID0gdCp0aGlzLnRvVmFsdWVbaV07IC8vICsgKDEtdCkqMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAvL3RoaXMudG9WYWx1ZVtpXSBkb2Vzbid0IGV4aXN0LCBzbyBhc3N1bWUgaXQncyBhIHplcm9cbiAgICAgICAgICAgIGZvcihsZXQgaT10aGlzLnNob3J0ZXN0TGVuZ3RoO2k8dGhpcy5sYXJnZXN0TGVuZ3RoO2krKyl7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRBcnJheVtpXSA9ICgxLXQpKnRoaXMuZnJvbVZhbHVlW2ldOyAvLyArIHQqMCBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5yZXN1bHRBcnJheTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGVBbmRDb3B5VG8ocGVyY2VudGFnZSwgdGFyZ2V0KXtcbiAgICAgICAgbGV0IHJlc3VsdEFycmF5ID0gdGhpcy5pbnRlcnBvbGF0ZShwZXJjZW50YWdlKTtcbiAgICAgICAgZm9yKGxldCBpPTA7aTxyZXN1bHRBcnJheS5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIHRhcmdldFtpXSA9IHJlc3VsdEFycmF5W2ldO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBGYWxsYmFja0RvTm90aGluZ0ludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG4gICAgICAgIHJldHVybiB0aGlzLmZyb21WYWx1ZTtcbiAgICB9XG59XG5cblxuXG5cblxuY29uc3QgRXhpc3RpbmdBbmltYXRpb25TeW1ib2wgPSBTeW1ib2woJ0N1cnJlbnRFWFBBbmltYXRpb24nKVxuXG5cbmNsYXNzIEFuaW1hdGlvbntcblx0Y29uc3RydWN0b3IodGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb249MSwgb3B0aW9uYWxBcmd1bWVudHM9e30pe1xuICAgICAgICBpZighVXRpbHMuaXNPYmplY3QodG9WYWx1ZXMpICYmICFVdGlscy5pc0FycmF5KHRvVmFsdWVzKSl7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFcnJvciB0cmFuc2l0aW9uaW5nOiB0b1ZhbHVlcyBtdXN0IGJlIGFuIGFycmF5IG9yIGFuIG9iamVjdC5cIik7XG4gICAgICAgIH1cblxuXHRcdHRoaXMudG9WYWx1ZXMgPSB0b1ZhbHVlcztcblx0XHR0aGlzLnRhcmdldCA9IHRhcmdldDtcdFxuXHRcdHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbjsgLy9pbiBzXG5cbiAgICAgICAgLy9QYXJzZSBvcHRpb25hbCB2YWx1ZXMgaW4gb3B0aW9uYWxBcmd1bWVudHNcblxuICAgICAgICAvL2Nob29zZSBlYXNpbmcgZnVuY3Rpb25cbiAgICAgICAgdGhpcy5lYXNpbmcgPSBvcHRpb25hbEFyZ3VtZW50cy5lYXNpbmcgPT09IHVuZGVmaW5lZCA/IEVhc2luZy5FYXNlSW5PdXQgOiBvcHRpb25hbEFyZ3VtZW50cy5lYXNpbmc7Ly9kZWZhdWx0LCBFYXNpbmcuRWFzZUluT3V0XG4gICAgICAgIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uID0gQW5pbWF0aW9uLmNvc2luZUVhc2VJbk91dEludGVycG9sYXRpb247IFxuICAgICAgICBpZih0aGlzLmVhc2luZyA9PSBFYXNpbmcuRWFzZUluKXtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uID0gQW5pbWF0aW9uLmNvc2luZUVhc2VJbkludGVycG9sYXRpb247XG4gICAgICAgIH1lbHNlIGlmKHRoaXMuZWFzaW5nID09IEVhc2luZy5FYXNlT3V0KXtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uID0gQW5pbWF0aW9uLmNvc2luZUVhc2VPdXRJbnRlcnBvbGF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9zZXR1cCB2YWx1ZXMgbmVlZGVkIGZvciBzdGFnZ2VyZWQgYW5pbWF0aW9uXG4gICAgICAgIHRoaXMuc3RhZ2dlckZyYWN0aW9uID0gb3B0aW9uYWxBcmd1bWVudHMuc3RhZ2dlckZyYWN0aW9uID09PSB1bmRlZmluZWQgPyAwIDogb3B0aW9uYWxBcmd1bWVudHMuc3RhZ2dlckZyYWN0aW9uOyAvLyB0aW1lIGluIG1zIGJldHdlZW4gZmlyc3QgZWxlbWVudCBiZWdpbm5pbmcgdGhlIGFuaW1hdGlvbiBhbmQgbGFzdCBlbGVtZW50IGJlZ2lubmluZyB0aGUgYW5pbWF0aW9uLiBTaG91bGQgYmUgbGVzcyB0aGFuIGR1cmF0aW9uLlxuXHRcdFV0aWxzLmFzc2VydCh0aGlzLnN0YWdnZXJGcmFjdGlvbiA+PSAwICYmIHRoaXMuc3RhZ2dlckZyYWN0aW9uIDwgMSk7XG5cdFx0aWYodGFyZ2V0LmNvbnN0cnVjdG9yID09PSBUcmFuc2Zvcm1hdGlvbil7XG5cdFx0XHR0aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHRhcmdldC5nZXRUb3BQYXJlbnQoKS5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cdFx0fWVsc2V7XG5cdFx0XHRpZih0aGlzLnN0YWdnZXJGcmFjdGlvbiAhPSAwKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcInN0YWdnZXJGcmFjdGlvbiBjYW4gb25seSBiZSB1c2VkIHdoZW4gVHJhbnNpdGlvblRvJ3MgdGFyZ2V0IGlzIGFuIEVYUC5UcmFuc2Zvcm1hdGlvbiFcIik7XG5cdFx0XHR9XG5cdFx0fVxuXG4gICAgICAgIHRoaXMubW9kZSA9IFwiY29weVByb3BlcnRpZXNcIjtcbiAgICAgICAgXG5cdFx0dGhpcy5mcm9tVmFsdWVzID0ge307XG4gICAgICAgIHRoaXMuaW50ZXJwb2xhdG9ycyA9IFtdO1xuICAgICAgICB0aGlzLmludGVycG9sYXRpbmdQcm9wZXJ0eU5hbWVzID0gW107XG4gICAgICAgIGlmKCFVdGlscy5pc0FycmF5KHRvVmFsdWVzKSl7XG5cdFx0ICAgIGZvcih2YXIgcHJvcGVydHkgaW4gdGhpcy50b1ZhbHVlcyl7XG5cdFx0XHQgICAgVXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyh0aGlzLnRhcmdldCwgcHJvcGVydHkpO1xuXG5cdFx0XHQgICAgLy9jb3B5IHByb3BlcnR5LCBtYWtpbmcgc3VyZSB0byBzdG9yZSB0aGUgY29ycmVjdCAndGhpcydcblx0XHRcdCAgICBpZihVdGlscy5pc0Z1bmN0aW9uKHRoaXMudGFyZ2V0W3Byb3BlcnR5XSkpe1xuXHRcdFx0XHQgICAgdGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHRoaXMudGFyZ2V0W3Byb3BlcnR5XS5iaW5kKHRoaXMudGFyZ2V0KTtcblx0XHRcdCAgICB9ZWxzZXtcblx0XHRcdFx0ICAgIHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0gPSB0aGlzLnRhcmdldFtwcm9wZXJ0eV07XG5cdFx0XHQgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0b3JzLnB1c2godGhpcy5jaG9vc2VJbnRlcnBvbGF0b3IodGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSwgdGhpcy50b1ZhbHVlc1twcm9wZXJ0eV0sdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24pKTtcbiAgICAgICAgICAgICAgICB0aGlzLmludGVycG9sYXRpbmdQcm9wZXJ0eU5hbWVzLnB1c2gocHJvcGVydHkpO1xuXHRcdCAgICB9XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5tb2RlID0gXCJjb3B5VG9UYXJnZXRcIjtcbiAgICAgICAgICAgIC8vc3VwcG9ydCBBbmltYXRpb24oW2EsYixjXSxbYSxiLGMsZCxlXSkgd2hlcmUgZnJvbVZhbHVlc1twcm9wZXJ0eV0gbWlnaHQgbm90IGJlIGludGVycG9sYXRhYmxlLCBidXQgZnJvbVZhbHVlcyBpc1xuXHRcdCAgICB0aGlzLmZyb21WYWx1ZXMgPSBFWFAuTWF0aC5jbG9uZSh0aGlzLnRhcmdldCk7XG4gICAgICAgICAgICBsZXQgd2hvbGVUaGluZ0ludGVycG9sYXRvciA9IHRoaXMuY2hvb3NlSW50ZXJwb2xhdG9yKHRoaXMuZnJvbVZhbHVlcywgdGhpcy50b1ZhbHVlcyx0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRvcnMucHVzaCh3aG9sZVRoaW5nSW50ZXJwb2xhdG9yKTtcbiAgICAgICAgfVxuXG5cblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5wcmV2VHJ1ZVRpbWUgPSAwO1xuXG4gICAgICAgIGlmKHRoaXMudGFyZ2V0W0V4aXN0aW5nQW5pbWF0aW9uU3ltYm9sXSAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIHRoaXMuZGVhbFdpdGhFeGlzdGluZ0FuaW1hdGlvbigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGFyZ2V0W0V4aXN0aW5nQW5pbWF0aW9uU3ltYm9sXSA9IHRoaXM7XG5cblx0XHQvL2JlZ2luXG5cdFx0dGhpcy5fdXBkYXRlQ2FsbGJhY2sgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpXG5cdFx0dGhyZWVFbnZpcm9ubWVudC5vbihcInVwZGF0ZVwiLHRoaXMuX3VwZGF0ZUNhbGxiYWNrKTtcblx0fVxuICAgIGRlYWxXaXRoRXhpc3RpbmdBbmltYXRpb24oKXtcbiAgICAgICAgLy9pZiBhbm90aGVyIGFuaW1hdGlvbiBpcyBoYWxmd2F5IHRocm91Z2ggcGxheWluZyB3aGVuIHRoaXMgYW5pbWF0aW9uIHN0YXJ0cywgcHJlZW1wdCBpdFxuICAgICAgICBsZXQgcHJldmlvdXNBbmltYXRpb24gPSB0aGlzLnRhcmdldFtFeGlzdGluZ0FuaW1hdGlvblN5bWJvbF07XG5cbiAgICAgICAgLy90b2RvOiBmYW5jeSBibGVuZGluZ1xuICAgICAgICBwcmV2aW91c0FuaW1hdGlvbi5lbmQoKTtcblx0XHRmb3IodmFyIHByb3BlcnR5IGluIHRoaXMuZnJvbVZhbHVlcyl7XG4gICAgICAgICAgICBpZihwcm9wZXJ0eSBpbiBwcmV2aW91c0FuaW1hdGlvbi50b1ZhbHVlcyl7XG4gICAgICAgICAgICAgICAgdGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHByZXZpb3VzQW5pbWF0aW9uLnRvVmFsdWVzW3Byb3BlcnR5XTtcbiAgICBcdFx0fVxuXHRcdH1cbiAgICB9XG4gICAgY2hvb3NlSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcblx0XHRpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mKGZyb21WYWx1ZSkgPT09IFwibnVtYmVyXCIpe1xuICAgICAgICAgICAgLy9udW1iZXItbnVtYmVyXG4gICAgICAgICAgICByZXR1cm4gbmV3IE51bWJlckludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXNGdW5jdGlvbih0b1ZhbHVlKSAmJiBVdGlscy5pc0Z1bmN0aW9uKGZyb21WYWx1ZSkpe1xuICAgICAgICAgICAgLy9mdW5jdGlvbi1mdW5jdGlvblxuXHRcdFx0cmV0dXJuIG5ldyBUcmFuc2Zvcm1hdGlvbkZ1bmN0aW9uSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uLCB0aGlzLnN0YWdnZXJGcmFjdGlvbiwgdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24pO1xuXHRcdH1lbHNlIGlmKHRvVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLkNvbG9yICYmIGZyb21WYWx1ZS5jb25zdHJ1Y3RvciA9PT0gVEhSRUUuQ29sb3Ipe1xuICAgICAgICAgICAgLy9USFJFRS5Db2xvclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBUaHJlZUpzQ29sb3JJbnRlcnBvbGF0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB9ZWxzZSBpZihmcm9tVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLlZlY3RvcjMgJiYgKHRvVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLlZlY3RvcjMgfHwgVXRpbHMuaXMxRE51bWVyaWNBcnJheSh0b1ZhbHVlKSkpe1xuICAgICAgICAgICAgLy9USFJFRS5WZWN0b3IzIC0gYnV0IHdlIGNhbiBhbHNvIGludGVycHJldCBhIHRvVmFsdWUgb2YgW2EsYixjXSBhcyBuZXcgVEhSRUUuVmVjdG9yMyhhLGIsYylcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGhyZWVKc1ZlYzNJbnRlcnBvbGF0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB9ZWxzZSBpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwiYm9vbGVhblwiICYmIHR5cGVvZihmcm9tVmFsdWUpID09PSBcImJvb2xlYW5cIil7XG4gICAgICAgICAgICAvL2Jvb2xlYW5cbiAgICAgICAgICAgIHJldHVybiBuZXcgQm9vbEludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXMxRE51bWVyaWNBcnJheSh0b1ZhbHVlKSAmJiBVdGlscy5pczFETnVtZXJpY0FycmF5KGZyb21WYWx1ZSkpe1xuICAgICAgICAgICAgLy9mdW5jdGlvbi1mdW5jdGlvblxuXHRcdFx0cmV0dXJuIG5ldyBOdW1lcmljMURBcnJheUludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgLy9XZSBkb24ndCBrbm93IGhvdyB0byBpbnRlcnBvbGF0ZSB0aGlzLiBJbnN0ZWFkIHdlJ2xsIGp1c3QgZG8gbm90aGluZywgYW5kIGF0IHRoZSBlbmQgb2YgdGhlIGFuaW1hdGlvbiB3ZSdsbCBqdXN0IHNldCB0aGUgdGFyZ2V0IHRvIHRoZSB0b1ZhbHVlLlxuXHRcdFx0Y29uc29sZS5lcnJvcihcIkFuaW1hdGlvbiBjbGFzcyBjYW5ub3QgeWV0IGhhbmRsZSB0cmFuc2l0aW9uaW5nIGJldHdlZW4gdGhpbmdzIHRoYXQgYXJlbid0IG51bWJlcnMgb3IgZnVuY3Rpb25zIG9yIGFycmF5cyFcIik7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEZhbGxiYWNrRG9Ob3RoaW5nSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcblx0XHR9XG4gICAgfVxuXHR1cGRhdGUodGltZSl7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSB0aW1lLnJlYWx0aW1lRGVsdGE7XHRcblxuXHRcdGxldCBwZXJjZW50YWdlID0gdGhpcy5lbGFwc2VkVGltZS90aGlzLmR1cmF0aW9uO1xuXG5cdFx0Ly9pbnRlcnBvbGF0ZSB2YWx1ZXNcbiAgICAgICAgaWYodGhpcy5tb2RlID09ICdjb3B5UHJvcGVydGllcycpe1xuXHRcdCAgICBmb3IobGV0IGk9MDtpPHRoaXMuaW50ZXJwb2xhdG9ycy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgICAgICBsZXQgcHJvcGVydHlOYW1lID0gdGhpcy5pbnRlcnBvbGF0aW5nUHJvcGVydHlOYW1lc1tpXTtcblx0XHRcdCAgICB0aGlzLnRhcmdldFtwcm9wZXJ0eU5hbWVdID0gdGhpcy5pbnRlcnBvbGF0b3JzW2ldLmludGVycG9sYXRlKHBlcmNlbnRhZ2UpO1xuXHRcdCAgICB9XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgLy9jb3B5IHRvIHRhcmdldFxuICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0b3JzWzBdLmludGVycG9sYXRlQW5kQ29weVRvKHBlcmNlbnRhZ2UsIHRoaXMudGFyZ2V0KTtcbiAgICAgICAgfVxuXG5cdFx0aWYodGhpcy5lbGFwc2VkVGltZSA+PSB0aGlzLmR1cmF0aW9uKXtcblx0XHRcdHRoaXMuZW5kKCk7XG5cdFx0fVxuXHR9XG5cdHN0YXRpYyBjb3NpbmVFYXNlSW5PdXRJbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiAoMS1NYXRoLmNvcyh4Kk1hdGguUEkpKS8yO1xuXHR9XG5cdHN0YXRpYyBjb3NpbmVFYXNlSW5JbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiAoMS1NYXRoLmNvcyh4Kk1hdGguUEkvMikpO1xuXHR9XG5cdHN0YXRpYyBjb3NpbmVFYXNlT3V0SW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4gTWF0aC5zaW4oeCAqIE1hdGguUEkvMik7XG5cdH1cblx0c3RhdGljIGxpbmVhckludGVycG9sYXRpb24oeCl7XG5cdFx0cmV0dXJuIHg7XG5cdH1cblx0ZW5kKCl7XG5cdFx0Zm9yKHZhciBwcm9wIGluIHRoaXMudG9WYWx1ZXMpe1xuXHRcdFx0dGhpcy50YXJnZXRbcHJvcF0gPSB0aGlzLnRvVmFsdWVzW3Byb3BdO1xuXHRcdH1cblx0XHR0aHJlZUVudmlyb25tZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ1cGRhdGVcIix0aGlzLl91cGRhdGVDYWxsYmFjayk7XG4gICAgICAgIHRoaXMudGFyZ2V0W0V4aXN0aW5nQW5pbWF0aW9uU3ltYm9sXSA9IHVuZGVmaW5lZDtcblx0fVxufVxuXG5mdW5jdGlvbiBUcmFuc2l0aW9uVG8odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUywgb3B0aW9uYWxBcmd1bWVudHMpe1xuICAgIC8vaWYgc29tZW9uZSdzIHVzaW5nIHRoZSBvbGQgY2FsbGluZyBzdHJhdGVneSBvZiBzdGFnZ2VyRnJhY3Rpb24gYXMgdGhlIGxhc3QgYXJndW1lbnQsIGNvbnZlcnQgaXQgcHJvcGVybHlcbiAgICBpZihvcHRpb25hbEFyZ3VtZW50cyAmJiBVdGlscy5pc051bWJlcihvcHRpb25hbEFyZ3VtZW50cykpe1xuICAgICAgICBvcHRpb25hbEFyZ3VtZW50cyA9IHtzdGFnZ2VyRnJhY3Rpb246IG9wdGlvbmFsQXJndW1lbnRzfTtcbiAgICB9XG5cdHZhciBhbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGR1cmF0aW9uTVMvMTAwMCwgb3B0aW9uYWxBcmd1bWVudHMpO1xufVxuXG5leHBvcnQge1RyYW5zaXRpb25UbywgQW5pbWF0aW9uLCBFYXNpbmd9XG4iLCIoZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgbG9va3VwID0gW1xuXHRcdFx0J0EnLCAnQicsICdDJywgJ0QnLCAnRScsICdGJywgJ0cnLCAnSCcsXG5cdFx0XHQnSScsICdKJywgJ0snLCAnTCcsICdNJywgJ04nLCAnTycsICdQJyxcblx0XHRcdCdRJywgJ1InLCAnUycsICdUJywgJ1UnLCAnVicsICdXJywgJ1gnLFxuXHRcdFx0J1knLCAnWicsICdhJywgJ2InLCAnYycsICdkJywgJ2UnLCAnZicsXG5cdFx0XHQnZycsICdoJywgJ2knLCAnaicsICdrJywgJ2wnLCAnbScsICduJyxcblx0XHRcdCdvJywgJ3AnLCAncScsICdyJywgJ3MnLCAndCcsICd1JywgJ3YnLFxuXHRcdFx0J3cnLCAneCcsICd5JywgJ3onLCAnMCcsICcxJywgJzInLCAnMycsXG5cdFx0XHQnNCcsICc1JywgJzYnLCAnNycsICc4JywgJzknLCAnKycsICcvJ1xuXHRcdF07XG5cdGZ1bmN0aW9uIGNsZWFuKGxlbmd0aCkge1xuXHRcdHZhciBpLCBidWZmZXIgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuXHRcdGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0YnVmZmVyW2ldID0gMDtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdGZ1bmN0aW9uIGV4dGVuZChvcmlnLCBsZW5ndGgsIGFkZExlbmd0aCwgbXVsdGlwbGVPZikge1xuXHRcdHZhciBuZXdTaXplID0gbGVuZ3RoICsgYWRkTGVuZ3RoLFxuXHRcdFx0YnVmZmVyID0gY2xlYW4oKHBhcnNlSW50KG5ld1NpemUgLyBtdWx0aXBsZU9mKSArIDEpICogbXVsdGlwbGVPZik7XG5cblx0XHRidWZmZXIuc2V0KG9yaWcpO1xuXG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdGZ1bmN0aW9uIHBhZChudW0sIGJ5dGVzLCBiYXNlKSB7XG5cdFx0bnVtID0gbnVtLnRvU3RyaW5nKGJhc2UgfHwgOCk7XG5cdFx0cmV0dXJuIFwiMDAwMDAwMDAwMDAwXCIuc3Vic3RyKG51bS5sZW5ndGggKyAxMiAtIGJ5dGVzKSArIG51bTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN0cmluZ1RvVWludDggKGlucHV0LCBvdXQsIG9mZnNldCkge1xuXHRcdHZhciBpLCBsZW5ndGg7XG5cblx0XHRvdXQgPSBvdXQgfHwgY2xlYW4oaW5wdXQubGVuZ3RoKTtcblxuXHRcdG9mZnNldCA9IG9mZnNldCB8fCAwO1xuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IGlucHV0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRvdXRbb2Zmc2V0XSA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRvZmZzZXQgKz0gMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0O1xuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoO1xuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXTtcblx0XHR9O1xuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSk7XG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApO1xuXHRcdH1cblxuXHRcdC8vIHRoaXMgcHJldmVudHMgYW4gRVJSX0lOVkFMSURfVVJMIGluIENocm9tZSAoRmlyZWZveCBva2F5KVxuXHRcdHN3aXRjaCAob3V0cHV0Lmxlbmd0aCAlIDQpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0b3V0cHV0ICs9ICc9Jztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdG91dHB1dCArPSAnPT0nO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHR3aW5kb3cudXRpbHMgPSB7fVxuXHR3aW5kb3cudXRpbHMuY2xlYW4gPSBjbGVhbjtcblx0d2luZG93LnV0aWxzLnBhZCA9IHBhZDtcblx0d2luZG93LnV0aWxzLmV4dGVuZCA9IGV4dGVuZDtcblx0d2luZG93LnV0aWxzLnN0cmluZ1RvVWludDggPSBzdHJpbmdUb1VpbnQ4O1xuXHR3aW5kb3cudXRpbHMudWludDhUb0Jhc2U2NCA9IHVpbnQ4VG9CYXNlNjQ7XG59KCkpO1xuXG4oZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuLypcbnN0cnVjdCBwb3NpeF9oZWFkZXIgeyAgICAgICAgICAgICAvLyBieXRlIG9mZnNldFxuXHRjaGFyIG5hbWVbMTAwXTsgICAgICAgICAgICAgICAvLyAgIDBcblx0Y2hhciBtb2RlWzhdOyAgICAgICAgICAgICAgICAgLy8gMTAwXG5cdGNoYXIgdWlkWzhdOyAgICAgICAgICAgICAgICAgIC8vIDEwOFxuXHRjaGFyIGdpZFs4XTsgICAgICAgICAgICAgICAgICAvLyAxMTZcblx0Y2hhciBzaXplWzEyXTsgICAgICAgICAgICAgICAgLy8gMTI0XG5cdGNoYXIgbXRpbWVbMTJdOyAgICAgICAgICAgICAgIC8vIDEzNlxuXHRjaGFyIGNoa3N1bVs4XTsgICAgICAgICAgICAgICAvLyAxNDhcblx0Y2hhciB0eXBlZmxhZzsgICAgICAgICAgICAgICAgLy8gMTU2XG5cdGNoYXIgbGlua25hbWVbMTAwXTsgICAgICAgICAgIC8vIDE1N1xuXHRjaGFyIG1hZ2ljWzZdOyAgICAgICAgICAgICAgICAvLyAyNTdcblx0Y2hhciB2ZXJzaW9uWzJdOyAgICAgICAgICAgICAgLy8gMjYzXG5cdGNoYXIgdW5hbWVbMzJdOyAgICAgICAgICAgICAgIC8vIDI2NVxuXHRjaGFyIGduYW1lWzMyXTsgICAgICAgICAgICAgICAvLyAyOTdcblx0Y2hhciBkZXZtYWpvcls4XTsgICAgICAgICAgICAgLy8gMzI5XG5cdGNoYXIgZGV2bWlub3JbOF07ICAgICAgICAgICAgIC8vIDMzN1xuXHRjaGFyIHByZWZpeFsxNTVdOyAgICAgICAgICAgICAvLyAzNDVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyA1MDBcbn07XG4qL1xuXG5cdHZhciB1dGlscyA9IHdpbmRvdy51dGlscyxcblx0XHRoZWFkZXJGb3JtYXQ7XG5cblx0aGVhZGVyRm9ybWF0ID0gW1xuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlTmFtZScsXG5cdFx0XHQnbGVuZ3RoJzogMTAwXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZU1vZGUnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd1aWQnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdnaWQnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlU2l6ZScsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtdGltZScsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdjaGVja3N1bScsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3R5cGUnLFxuXHRcdFx0J2xlbmd0aCc6IDFcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdsaW5rTmFtZScsXG5cdFx0XHQnbGVuZ3RoJzogMTAwXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndXN0YXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdvd25lcicsXG5cdFx0XHQnbGVuZ3RoJzogMzJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdncm91cCcsXG5cdFx0XHQnbGVuZ3RoJzogMzJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtYWpvck51bWJlcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ21pbm9yTnVtYmVyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZW5hbWVQcmVmaXgnLFxuXHRcdFx0J2xlbmd0aCc6IDE1NVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3BhZGRpbmcnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fVxuXHRdO1xuXG5cdGZ1bmN0aW9uIGZvcm1hdEhlYWRlcihkYXRhLCBjYikge1xuXHRcdHZhciBidWZmZXIgPSB1dGlscy5jbGVhbig1MTIpLFxuXHRcdFx0b2Zmc2V0ID0gMDtcblxuXHRcdGhlYWRlckZvcm1hdC5mb3JFYWNoKGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0dmFyIHN0ciA9IGRhdGFbdmFsdWUuZmllbGRdIHx8IFwiXCIsXG5cdFx0XHRcdGksIGxlbmd0aDtcblxuXHRcdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gc3RyLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRcdGJ1ZmZlcltvZmZzZXRdID0gc3RyLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRcdG9mZnNldCArPSAxO1xuXHRcdFx0fVxuXG5cdFx0XHRvZmZzZXQgKz0gdmFsdWUubGVuZ3RoIC0gaTsgLy8gc3BhY2UgaXQgb3V0IHdpdGggbnVsbHNcblx0XHR9KTtcblxuXHRcdGlmICh0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiBjYihidWZmZXIsIG9mZnNldCk7XG5cdFx0fVxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHR3aW5kb3cuaGVhZGVyID0ge31cblx0d2luZG93LmhlYWRlci5zdHJ1Y3R1cmUgPSBoZWFkZXJGb3JtYXQ7XG5cdHdpbmRvdy5oZWFkZXIuZm9ybWF0ID0gZm9ybWF0SGVhZGVyO1xufSgpKTtcblxuKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIGhlYWRlciA9IHdpbmRvdy5oZWFkZXIsXG5cdFx0dXRpbHMgPSB3aW5kb3cudXRpbHMsXG5cdFx0cmVjb3JkU2l6ZSA9IDUxMixcblx0XHRibG9ja1NpemU7XG5cblx0ZnVuY3Rpb24gVGFyKHJlY29yZHNQZXJCbG9jaykge1xuXHRcdHRoaXMud3JpdHRlbiA9IDA7XG5cdFx0YmxvY2tTaXplID0gKHJlY29yZHNQZXJCbG9jayB8fCAyMCkgKiByZWNvcmRTaXplO1xuXHRcdHRoaXMub3V0ID0gdXRpbHMuY2xlYW4oYmxvY2tTaXplKTtcblx0XHR0aGlzLmJsb2NrcyA9IFtdO1xuXHRcdHRoaXMubGVuZ3RoID0gMDtcblx0fVxuXG5cdFRhci5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24gKGZpbGVwYXRoLCBpbnB1dCwgb3B0cywgY2FsbGJhY2spIHtcblx0XHR2YXIgZGF0YSxcblx0XHRcdGNoZWNrc3VtLFxuXHRcdFx0bW9kZSxcblx0XHRcdG10aW1lLFxuXHRcdFx0dWlkLFxuXHRcdFx0Z2lkLFxuXHRcdFx0aGVhZGVyQXJyO1xuXG5cdFx0aWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGlucHV0ID0gdXRpbHMuc3RyaW5nVG9VaW50OChpbnB1dCk7XG5cdFx0fSBlbHNlIGlmIChpbnB1dC5jb25zdHJ1Y3RvciAhPT0gVWludDhBcnJheS5wcm90b3R5cGUuY29uc3RydWN0b3IpIHtcblx0XHRcdHRocm93ICdJbnZhbGlkIGlucHV0IHR5cGUuIFlvdSBnYXZlIG1lOiAnICsgaW5wdXQuY29uc3RydWN0b3IudG9TdHJpbmcoKS5tYXRjaCgvZnVuY3Rpb25cXHMqKFskQS1aYS16X11bMC05QS1aYS16X10qKVxccypcXCgvKVsxXTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGNhbGxiYWNrID0gb3B0cztcblx0XHRcdG9wdHMgPSB7fTtcblx0XHR9XG5cblx0XHRvcHRzID0gb3B0cyB8fCB7fTtcblxuXHRcdG1vZGUgPSBvcHRzLm1vZGUgfHwgcGFyc2VJbnQoJzc3NycsIDgpICYgMHhmZmY7XG5cdFx0bXRpbWUgPSBvcHRzLm10aW1lIHx8IE1hdGguZmxvb3IoK25ldyBEYXRlKCkgLyAxMDAwKTtcblx0XHR1aWQgPSBvcHRzLnVpZCB8fCAwO1xuXHRcdGdpZCA9IG9wdHMuZ2lkIHx8IDA7XG5cblx0XHRkYXRhID0ge1xuXHRcdFx0ZmlsZU5hbWU6IGZpbGVwYXRoLFxuXHRcdFx0ZmlsZU1vZGU6IHV0aWxzLnBhZChtb2RlLCA3KSxcblx0XHRcdHVpZDogdXRpbHMucGFkKHVpZCwgNyksXG5cdFx0XHRnaWQ6IHV0aWxzLnBhZChnaWQsIDcpLFxuXHRcdFx0ZmlsZVNpemU6IHV0aWxzLnBhZChpbnB1dC5sZW5ndGgsIDExKSxcblx0XHRcdG10aW1lOiB1dGlscy5wYWQobXRpbWUsIDExKSxcblx0XHRcdGNoZWNrc3VtOiAnICAgICAgICAnLFxuXHRcdFx0dHlwZTogJzAnLCAvLyBqdXN0IGEgZmlsZVxuXHRcdFx0dXN0YXI6ICd1c3RhciAgJyxcblx0XHRcdG93bmVyOiBvcHRzLm93bmVyIHx8ICcnLFxuXHRcdFx0Z3JvdXA6IG9wdHMuZ3JvdXAgfHwgJydcblx0XHR9O1xuXG5cdFx0Ly8gY2FsY3VsYXRlIHRoZSBjaGVja3N1bVxuXHRcdGNoZWNrc3VtID0gMDtcblx0XHRPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdHZhciBpLCB2YWx1ZSA9IGRhdGFba2V5XSwgbGVuZ3RoO1xuXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB2YWx1ZS5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0XHRjaGVja3N1bSArPSB2YWx1ZS5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0ZGF0YS5jaGVja3N1bSA9IHV0aWxzLnBhZChjaGVja3N1bSwgNikgKyBcIlxcdTAwMDAgXCI7XG5cblx0XHRoZWFkZXJBcnIgPSBoZWFkZXIuZm9ybWF0KGRhdGEpO1xuXG5cdFx0dmFyIGhlYWRlckxlbmd0aCA9IE1hdGguY2VpbCggaGVhZGVyQXJyLmxlbmd0aCAvIHJlY29yZFNpemUgKSAqIHJlY29yZFNpemU7XG5cdFx0dmFyIGlucHV0TGVuZ3RoID0gTWF0aC5jZWlsKCBpbnB1dC5sZW5ndGggLyByZWNvcmRTaXplICkgKiByZWNvcmRTaXplO1xuXG5cdFx0dGhpcy5ibG9ja3MucHVzaCggeyBoZWFkZXI6IGhlYWRlckFyciwgaW5wdXQ6IGlucHV0LCBoZWFkZXJMZW5ndGg6IGhlYWRlckxlbmd0aCwgaW5wdXRMZW5ndGg6IGlucHV0TGVuZ3RoIH0gKTtcblxuXHR9O1xuXG5cdFRhci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGJ1ZmZlcnMgPSBbXTtcblx0XHR2YXIgY2h1bmtzID0gW107XG5cdFx0dmFyIGxlbmd0aCA9IDA7XG5cdFx0dmFyIG1heCA9IE1hdGgucG93KCAyLCAyMCApO1xuXG5cdFx0dmFyIGNodW5rID0gW107XG5cdFx0dGhpcy5ibG9ja3MuZm9yRWFjaCggZnVuY3Rpb24oIGIgKSB7XG5cdFx0XHRpZiggbGVuZ3RoICsgYi5oZWFkZXJMZW5ndGggKyBiLmlucHV0TGVuZ3RoID4gbWF4ICkge1xuXHRcdFx0XHRjaHVua3MucHVzaCggeyBibG9ja3M6IGNodW5rLCBsZW5ndGg6IGxlbmd0aCB9ICk7XG5cdFx0XHRcdGNodW5rID0gW107XG5cdFx0XHRcdGxlbmd0aCA9IDA7XG5cdFx0XHR9XG5cdFx0XHRjaHVuay5wdXNoKCBiICk7XG5cdFx0XHRsZW5ndGggKz0gYi5oZWFkZXJMZW5ndGggKyBiLmlucHV0TGVuZ3RoO1xuXHRcdH0gKTtcblx0XHRjaHVua3MucHVzaCggeyBibG9ja3M6IGNodW5rLCBsZW5ndGg6IGxlbmd0aCB9ICk7XG5cblx0XHRjaHVua3MuZm9yRWFjaCggZnVuY3Rpb24oIGMgKSB7XG5cblx0XHRcdHZhciBidWZmZXIgPSBuZXcgVWludDhBcnJheSggYy5sZW5ndGggKTtcblx0XHRcdHZhciB3cml0dGVuID0gMDtcblx0XHRcdGMuYmxvY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBiICkge1xuXHRcdFx0XHRidWZmZXIuc2V0KCBiLmhlYWRlciwgd3JpdHRlbiApO1xuXHRcdFx0XHR3cml0dGVuICs9IGIuaGVhZGVyTGVuZ3RoO1xuXHRcdFx0XHRidWZmZXIuc2V0KCBiLmlucHV0LCB3cml0dGVuICk7XG5cdFx0XHRcdHdyaXR0ZW4gKz0gYi5pbnB1dExlbmd0aDtcblx0XHRcdH0gKTtcblx0XHRcdGJ1ZmZlcnMucHVzaCggYnVmZmVyICk7XG5cblx0XHR9ICk7XG5cblx0XHRidWZmZXJzLnB1c2goIG5ldyBVaW50OEFycmF5KCAyICogcmVjb3JkU2l6ZSApICk7XG5cblx0XHRyZXR1cm4gbmV3IEJsb2IoIGJ1ZmZlcnMsIHsgdHlwZTogJ29jdGV0L3N0cmVhbScgfSApO1xuXG5cdH07XG5cblx0VGFyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLndyaXR0ZW4gPSAwO1xuXHRcdHRoaXMub3V0ID0gdXRpbHMuY2xlYW4oYmxvY2tTaXplKTtcblx0fTtcblxuICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gVGFyO1xuICB9IGVsc2Uge1xuICAgIHdpbmRvdy5UYXIgPSBUYXI7XG4gIH1cbn0oKSk7XG4iLCIvL2Rvd25sb2FkLmpzIHYzLjAsIGJ5IGRhbmRhdmlzOyAyMDA4LTIwMTQuIFtDQ0JZMl0gc2VlIGh0dHA6Ly9kYW5tbC5jb20vZG93bmxvYWQuaHRtbCBmb3IgdGVzdHMvdXNhZ2Vcbi8vIHYxIGxhbmRlZCBhIEZGK0Nocm9tZSBjb21wYXQgd2F5IG9mIGRvd25sb2FkaW5nIHN0cmluZ3MgdG8gbG9jYWwgdW4tbmFtZWQgZmlsZXMsIHVwZ3JhZGVkIHRvIHVzZSBhIGhpZGRlbiBmcmFtZSBhbmQgb3B0aW9uYWwgbWltZVxuLy8gdjIgYWRkZWQgbmFtZWQgZmlsZXMgdmlhIGFbZG93bmxvYWRdLCBtc1NhdmVCbG9iLCBJRSAoMTArKSBzdXBwb3J0LCBhbmQgd2luZG93LlVSTCBzdXBwb3J0IGZvciBsYXJnZXIrZmFzdGVyIHNhdmVzIHRoYW4gZGF0YVVSTHNcbi8vIHYzIGFkZGVkIGRhdGFVUkwgYW5kIEJsb2IgSW5wdXQsIGJpbmQtdG9nZ2xlIGFyaXR5LCBhbmQgbGVnYWN5IGRhdGFVUkwgZmFsbGJhY2sgd2FzIGltcHJvdmVkIHdpdGggZm9yY2UtZG93bmxvYWQgbWltZSBhbmQgYmFzZTY0IHN1cHBvcnRcblxuLy8gZGF0YSBjYW4gYmUgYSBzdHJpbmcsIEJsb2IsIEZpbGUsIG9yIGRhdGFVUkxcblxuXG5cblxuZnVuY3Rpb24gZG93bmxvYWQoZGF0YSwgc3RyRmlsZU5hbWUsIHN0ck1pbWVUeXBlKSB7XG5cblx0dmFyIHNlbGYgPSB3aW5kb3csIC8vIHRoaXMgc2NyaXB0IGlzIG9ubHkgZm9yIGJyb3dzZXJzIGFueXdheS4uLlxuXHRcdHUgPSBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiLCAvLyB0aGlzIGRlZmF1bHQgbWltZSBhbHNvIHRyaWdnZXJzIGlmcmFtZSBkb3dubG9hZHNcblx0XHRtID0gc3RyTWltZVR5cGUgfHwgdSxcblx0XHR4ID0gZGF0YSxcblx0XHREID0gZG9jdW1lbnQsXG5cdFx0YSA9IEQuY3JlYXRlRWxlbWVudChcImFcIiksXG5cdFx0eiA9IGZ1bmN0aW9uKGEpe3JldHVybiBTdHJpbmcoYSk7fSxcblxuXG5cdFx0QiA9IHNlbGYuQmxvYiB8fCBzZWxmLk1vekJsb2IgfHwgc2VsZi5XZWJLaXRCbG9iIHx8IHosXG5cdFx0QkIgPSBzZWxmLk1TQmxvYkJ1aWxkZXIgfHwgc2VsZi5XZWJLaXRCbG9iQnVpbGRlciB8fCBzZWxmLkJsb2JCdWlsZGVyLFxuXHRcdGZuID0gc3RyRmlsZU5hbWUgfHwgXCJkb3dubG9hZFwiLFxuXHRcdGJsb2IsXG5cdFx0Yixcblx0XHR1YSxcblx0XHRmcjtcblxuXHQvL2lmKHR5cGVvZiBCLmJpbmQgPT09ICdmdW5jdGlvbicgKXsgQj1CLmJpbmQoc2VsZik7IH1cblxuXHRpZihTdHJpbmcodGhpcyk9PT1cInRydWVcIil7IC8vcmV2ZXJzZSBhcmd1bWVudHMsIGFsbG93aW5nIGRvd25sb2FkLmJpbmQodHJ1ZSwgXCJ0ZXh0L3htbFwiLCBcImV4cG9ydC54bWxcIikgdG8gYWN0IGFzIGEgY2FsbGJhY2tcblx0XHR4PVt4LCBtXTtcblx0XHRtPXhbMF07XG5cdFx0eD14WzFdO1xuXHR9XG5cblxuXG5cdC8vZ28gYWhlYWQgYW5kIGRvd25sb2FkIGRhdGFVUkxzIHJpZ2h0IGF3YXlcblx0aWYoU3RyaW5nKHgpLm1hdGNoKC9eZGF0YVxcOltcXHcrXFwtXStcXC9bXFx3K1xcLV0rWyw7XS8pKXtcblx0XHRyZXR1cm4gbmF2aWdhdG9yLm1zU2F2ZUJsb2IgPyAgLy8gSUUxMCBjYW4ndCBkbyBhW2Rvd25sb2FkXSwgb25seSBCbG9iczpcblx0XHRcdG5hdmlnYXRvci5tc1NhdmVCbG9iKGQyYih4KSwgZm4pIDpcblx0XHRcdHNhdmVyKHgpIDsgLy8gZXZlcnlvbmUgZWxzZSBjYW4gc2F2ZSBkYXRhVVJMcyB1bi1wcm9jZXNzZWRcblx0fS8vZW5kIGlmIGRhdGFVUkwgcGFzc2VkP1xuXG5cdHRyeXtcblxuXHRcdGJsb2IgPSB4IGluc3RhbmNlb2YgQiA/XG5cdFx0XHR4IDpcblx0XHRcdG5ldyBCKFt4XSwge3R5cGU6IG19KSA7XG5cdH1jYXRjaCh5KXtcblx0XHRpZihCQil7XG5cdFx0XHRiID0gbmV3IEJCKCk7XG5cdFx0XHRiLmFwcGVuZChbeF0pO1xuXHRcdFx0YmxvYiA9IGIuZ2V0QmxvYihtKTsgLy8gdGhlIGJsb2Jcblx0XHR9XG5cblx0fVxuXG5cblxuXHRmdW5jdGlvbiBkMmIodSkge1xuXHRcdHZhciBwPSB1LnNwbGl0KC9bOjssXS8pLFxuXHRcdHQ9IHBbMV0sXG5cdFx0ZGVjPSBwWzJdID09IFwiYmFzZTY0XCIgPyBhdG9iIDogZGVjb2RlVVJJQ29tcG9uZW50LFxuXHRcdGJpbj0gZGVjKHAucG9wKCkpLFxuXHRcdG14PSBiaW4ubGVuZ3RoLFxuXHRcdGk9IDAsXG5cdFx0dWlhPSBuZXcgVWludDhBcnJheShteCk7XG5cblx0XHRmb3IoaTtpPG14OysraSkgdWlhW2ldPSBiaW4uY2hhckNvZGVBdChpKTtcblxuXHRcdHJldHVybiBuZXcgQihbdWlhXSwge3R5cGU6IHR9KTtcblx0IH1cblxuXHRmdW5jdGlvbiBzYXZlcih1cmwsIHdpbk1vZGUpe1xuXG5cblx0XHRpZiAoJ2Rvd25sb2FkJyBpbiBhKSB7IC8vaHRtbDUgQVtkb3dubG9hZF1cblx0XHRcdGEuaHJlZiA9IHVybDtcblx0XHRcdGEuc2V0QXR0cmlidXRlKFwiZG93bmxvYWRcIiwgZm4pO1xuXHRcdFx0YS5pbm5lckhUTUwgPSBcImRvd25sb2FkaW5nLi4uXCI7XG5cdFx0XHRhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRELmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRhLmNsaWNrKCk7XG5cdFx0XHRcdEQuYm9keS5yZW1vdmVDaGlsZChhKTtcblx0XHRcdFx0aWYod2luTW9kZT09PXRydWUpe3NldFRpbWVvdXQoZnVuY3Rpb24oKXsgc2VsZi5VUkwucmV2b2tlT2JqZWN0VVJMKGEuaHJlZik7fSwgMjUwICk7fVxuXHRcdFx0fSwgNjYpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly9kbyBpZnJhbWUgZGF0YVVSTCBkb3dubG9hZCAob2xkIGNoK0ZGKTpcblx0XHR2YXIgZiA9IEQuY3JlYXRlRWxlbWVudChcImlmcmFtZVwiKTtcblx0XHRELmJvZHkuYXBwZW5kQ2hpbGQoZik7XG5cdFx0aWYoIXdpbk1vZGUpeyAvLyBmb3JjZSBhIG1pbWUgdGhhdCB3aWxsIGRvd25sb2FkOlxuXHRcdFx0dXJsPVwiZGF0YTpcIit1cmwucmVwbGFjZSgvXmRhdGE6KFtcXHdcXC9cXC1cXCtdKykvLCB1KTtcblx0XHR9XG5cblxuXHRcdGYuc3JjID0gdXJsO1xuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXsgRC5ib2R5LnJlbW92ZUNoaWxkKGYpOyB9LCAzMzMpO1xuXG5cdH0vL2VuZCBzYXZlclxuXG5cblx0aWYgKG5hdmlnYXRvci5tc1NhdmVCbG9iKSB7IC8vIElFMTArIDogKGhhcyBCbG9iLCBidXQgbm90IGFbZG93bmxvYWRdIG9yIFVSTClcblx0XHRyZXR1cm4gbmF2aWdhdG9yLm1zU2F2ZUJsb2IoYmxvYiwgZm4pO1xuXHR9XG5cblx0aWYoc2VsZi5VUkwpeyAvLyBzaW1wbGUgZmFzdCBhbmQgbW9kZXJuIHdheSB1c2luZyBCbG9iIGFuZCBVUkw6XG5cdFx0c2F2ZXIoc2VsZi5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpLCB0cnVlKTtcblx0fWVsc2V7XG5cdFx0Ly8gaGFuZGxlIG5vbi1CbG9iKCkrbm9uLVVSTCBicm93c2Vyczpcblx0XHRpZih0eXBlb2YgYmxvYiA9PT0gXCJzdHJpbmdcIiB8fCBibG9iLmNvbnN0cnVjdG9yPT09eiApe1xuXHRcdFx0dHJ5e1xuXHRcdFx0XHRyZXR1cm4gc2F2ZXIoIFwiZGF0YTpcIiArICBtICAgKyBcIjtiYXNlNjQsXCIgICsgIHNlbGYuYnRvYShibG9iKSAgKTtcblx0XHRcdH1jYXRjaCh5KXtcblx0XHRcdFx0cmV0dXJuIHNhdmVyKCBcImRhdGE6XCIgKyAgbSAgICsgXCIsXCIgKyBlbmNvZGVVUklDb21wb25lbnQoYmxvYikgICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQmxvYiBidXQgbm90IFVSTDpcblx0XHRmcj1uZXcgRmlsZVJlYWRlcigpO1xuXHRcdGZyLm9ubG9hZD1mdW5jdGlvbihlKXtcblx0XHRcdHNhdmVyKHRoaXMucmVzdWx0KTtcblx0XHR9O1xuXHRcdGZyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG5cdH1cblx0cmV0dXJuIHRydWU7XG59IC8qIGVuZCBkb3dubG9hZCgpICovXG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZG93bmxvYWQ7XG59XG4iLCIvLyBnaWYuanMgMC4yLjAgLSBodHRwczovL2dpdGh1Yi5jb20vam5vcmRiZXJnL2dpZi5qc1xyXG4oZnVuY3Rpb24oZil7aWYodHlwZW9mIGV4cG9ydHM9PT1cIm9iamVjdFwiJiZ0eXBlb2YgbW9kdWxlIT09XCJ1bmRlZmluZWRcIil7bW9kdWxlLmV4cG9ydHM9ZigpfWVsc2UgaWYodHlwZW9mIGRlZmluZT09PVwiZnVuY3Rpb25cIiYmZGVmaW5lLmFtZCl7ZGVmaW5lKFtdLGYpfWVsc2V7dmFyIGc7aWYodHlwZW9mIHdpbmRvdyE9PVwidW5kZWZpbmVkXCIpe2c9d2luZG93fWVsc2UgaWYodHlwZW9mIGdsb2JhbCE9PVwidW5kZWZpbmVkXCIpe2c9Z2xvYmFsfWVsc2UgaWYodHlwZW9mIHNlbGYhPT1cInVuZGVmaW5lZFwiKXtnPXNlbGZ9ZWxzZXtnPXRoaXN9Zy5HSUY9ZigpfX0pKGZ1bmN0aW9uKCl7dmFyIGRlZmluZSxtb2R1bGUsZXhwb3J0cztyZXR1cm4gZnVuY3Rpb24oKXtmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc31yZXR1cm4gZX0oKSh7MTpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7ZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCl7dGhpcy5fZXZlbnRzPXRoaXMuX2V2ZW50c3x8e307dGhpcy5fbWF4TGlzdGVuZXJzPXRoaXMuX21heExpc3RlbmVyc3x8dW5kZWZpbmVkfW1vZHVsZS5leHBvcnRzPUV2ZW50RW1pdHRlcjtFdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyPUV2ZW50RW1pdHRlcjtFdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHM9dW5kZWZpbmVkO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycz11bmRlZmluZWQ7RXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM9MTA7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnM9ZnVuY3Rpb24obil7aWYoIWlzTnVtYmVyKG4pfHxuPDB8fGlzTmFOKG4pKXRocm93IFR5cGVFcnJvcihcIm4gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiKTt0aGlzLl9tYXhMaXN0ZW5lcnM9bjtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0PWZ1bmN0aW9uKHR5cGUpe3ZhciBlcixoYW5kbGVyLGxlbixhcmdzLGksbGlzdGVuZXJzO2lmKCF0aGlzLl9ldmVudHMpdGhpcy5fZXZlbnRzPXt9O2lmKHR5cGU9PT1cImVycm9yXCIpe2lmKCF0aGlzLl9ldmVudHMuZXJyb3J8fGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikmJiF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKXtlcj1hcmd1bWVudHNbMV07aWYoZXIgaW5zdGFuY2VvZiBFcnJvcil7dGhyb3cgZXJ9ZWxzZXt2YXIgZXJyPW5ldyBFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4gKCcrZXIrXCIpXCIpO2Vyci5jb250ZXh0PWVyO3Rocm93IGVycn19fWhhbmRsZXI9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzVW5kZWZpbmVkKGhhbmRsZXIpKXJldHVybiBmYWxzZTtpZihpc0Z1bmN0aW9uKGhhbmRsZXIpKXtzd2l0Y2goYXJndW1lbnRzLmxlbmd0aCl7Y2FzZSAxOmhhbmRsZXIuY2FsbCh0aGlzKTticmVhaztjYXNlIDI6aGFuZGxlci5jYWxsKHRoaXMsYXJndW1lbnRzWzFdKTticmVhaztjYXNlIDM6aGFuZGxlci5jYWxsKHRoaXMsYXJndW1lbnRzWzFdLGFyZ3VtZW50c1syXSk7YnJlYWs7ZGVmYXVsdDphcmdzPUFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKTtoYW5kbGVyLmFwcGx5KHRoaXMsYXJncyl9fWVsc2UgaWYoaXNPYmplY3QoaGFuZGxlcikpe2FyZ3M9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpO2xpc3RlbmVycz1oYW5kbGVyLnNsaWNlKCk7bGVuPWxpc3RlbmVycy5sZW5ndGg7Zm9yKGk9MDtpPGxlbjtpKyspbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsYXJncyl9cmV0dXJuIHRydWV9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7dmFyIG07aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTtpZighdGhpcy5fZXZlbnRzKXRoaXMuX2V2ZW50cz17fTtpZih0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpdGhpcy5lbWl0KFwibmV3TGlzdGVuZXJcIix0eXBlLGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpP2xpc3RlbmVyLmxpc3RlbmVyOmxpc3RlbmVyKTtpZighdGhpcy5fZXZlbnRzW3R5cGVdKXRoaXMuX2V2ZW50c1t0eXBlXT1saXN0ZW5lcjtlbHNlIGlmKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO2Vsc2UgdGhpcy5fZXZlbnRzW3R5cGVdPVt0aGlzLl9ldmVudHNbdHlwZV0sbGlzdGVuZXJdO2lmKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkmJiF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKXtpZighaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSl7bT10aGlzLl9tYXhMaXN0ZW5lcnN9ZWxzZXttPUV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzfWlmKG0mJm0+MCYmdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aD5tKXt0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkPXRydWU7Y29uc29sZS5lcnJvcihcIihub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5IFwiK1wibGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiBcIitcIlVzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LlwiLHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO2lmKHR5cGVvZiBjb25zb2xlLnRyYWNlPT09XCJmdW5jdGlvblwiKXtjb25zb2xlLnRyYWNlKCl9fX1yZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbj1FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO0V2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZT1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO3ZhciBmaXJlZD1mYWxzZTtmdW5jdGlvbiBnKCl7dGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGcpO2lmKCFmaXJlZCl7ZmlyZWQ9dHJ1ZTtsaXN0ZW5lci5hcHBseSh0aGlzLGFyZ3VtZW50cyl9fWcubGlzdGVuZXI9bGlzdGVuZXI7dGhpcy5vbih0eXBlLGcpO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe3ZhciBsaXN0LHBvc2l0aW9uLGxlbmd0aCxpO2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7aWYoIXRoaXMuX2V2ZW50c3x8IXRoaXMuX2V2ZW50c1t0eXBlXSlyZXR1cm4gdGhpcztsaXN0PXRoaXMuX2V2ZW50c1t0eXBlXTtsZW5ndGg9bGlzdC5sZW5ndGg7cG9zaXRpb249LTE7aWYobGlzdD09PWxpc3RlbmVyfHxpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpJiZsaXN0Lmxpc3RlbmVyPT09bGlzdGVuZXIpe2RlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07aWYodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsdHlwZSxsaXN0ZW5lcil9ZWxzZSBpZihpc09iamVjdChsaXN0KSl7Zm9yKGk9bGVuZ3RoO2ktLSA+MDspe2lmKGxpc3RbaV09PT1saXN0ZW5lcnx8bGlzdFtpXS5saXN0ZW5lciYmbGlzdFtpXS5saXN0ZW5lcj09PWxpc3RlbmVyKXtwb3NpdGlvbj1pO2JyZWFrfX1pZihwb3NpdGlvbjwwKXJldHVybiB0aGlzO2lmKGxpc3QubGVuZ3RoPT09MSl7bGlzdC5sZW5ndGg9MDtkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdfWVsc2V7bGlzdC5zcGxpY2UocG9zaXRpb24sMSl9aWYodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsdHlwZSxsaXN0ZW5lcil9cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzPWZ1bmN0aW9uKHR5cGUpe3ZhciBrZXksbGlzdGVuZXJzO2lmKCF0aGlzLl9ldmVudHMpcmV0dXJuIHRoaXM7aWYoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil7aWYoYXJndW1lbnRzLmxlbmd0aD09PTApdGhpcy5fZXZlbnRzPXt9O2Vsc2UgaWYodGhpcy5fZXZlbnRzW3R5cGVdKWRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07cmV0dXJuIHRoaXN9aWYoYXJndW1lbnRzLmxlbmd0aD09PTApe2ZvcihrZXkgaW4gdGhpcy5fZXZlbnRzKXtpZihrZXk9PT1cInJlbW92ZUxpc3RlbmVyXCIpY29udGludWU7dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KX10aGlzLnJlbW92ZUFsbExpc3RlbmVycyhcInJlbW92ZUxpc3RlbmVyXCIpO3RoaXMuX2V2ZW50cz17fTtyZXR1cm4gdGhpc31saXN0ZW5lcnM9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzRnVuY3Rpb24obGlzdGVuZXJzKSl7dGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGxpc3RlbmVycyl9ZWxzZSBpZihsaXN0ZW5lcnMpe3doaWxlKGxpc3RlbmVycy5sZW5ndGgpdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoLTFdKX1kZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycz1mdW5jdGlvbih0eXBlKXt2YXIgcmV0O2lmKCF0aGlzLl9ldmVudHN8fCF0aGlzLl9ldmVudHNbdHlwZV0pcmV0PVtdO2Vsc2UgaWYoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKXJldD1bdGhpcy5fZXZlbnRzW3R5cGVdXTtlbHNlIHJldD10aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtyZXR1cm4gcmV0fTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQ9ZnVuY3Rpb24odHlwZSl7aWYodGhpcy5fZXZlbnRzKXt2YXIgZXZsaXN0ZW5lcj10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlyZXR1cm4gMTtlbHNlIGlmKGV2bGlzdGVuZXIpcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RofXJldHVybiAwfTtFdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudD1mdW5jdGlvbihlbWl0dGVyLHR5cGUpe3JldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSl9O2Z1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwiZnVuY3Rpb25cIn1mdW5jdGlvbiBpc051bWJlcihhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJudW1iZXJcIn1mdW5jdGlvbiBpc09iamVjdChhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJvYmplY3RcIiYmYXJnIT09bnVsbH1mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpe3JldHVybiBhcmc9PT12b2lkIDB9fSx7fV0sMjpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIE5ldVF1YW50PXJlcXVpcmUoXCIuL1R5cGVkTmV1UXVhbnQuanNcIik7dmFyIExaV0VuY29kZXI9cmVxdWlyZShcIi4vTFpXRW5jb2Rlci5qc1wiKTtmdW5jdGlvbiBCeXRlQXJyYXkoKXt0aGlzLnBhZ2U9LTE7dGhpcy5wYWdlcz1bXTt0aGlzLm5ld1BhZ2UoKX1CeXRlQXJyYXkucGFnZVNpemU9NDA5NjtCeXRlQXJyYXkuY2hhck1hcD17fTtmb3IodmFyIGk9MDtpPDI1NjtpKyspQnl0ZUFycmF5LmNoYXJNYXBbaV09U3RyaW5nLmZyb21DaGFyQ29kZShpKTtCeXRlQXJyYXkucHJvdG90eXBlLm5ld1BhZ2U9ZnVuY3Rpb24oKXt0aGlzLnBhZ2VzWysrdGhpcy5wYWdlXT1uZXcgVWludDhBcnJheShCeXRlQXJyYXkucGFnZVNpemUpO3RoaXMuY3Vyc29yPTB9O0J5dGVBcnJheS5wcm90b3R5cGUuZ2V0RGF0YT1mdW5jdGlvbigpe3ZhciBydj1cIlwiO2Zvcih2YXIgcD0wO3A8dGhpcy5wYWdlcy5sZW5ndGg7cCsrKXtmb3IodmFyIGk9MDtpPEJ5dGVBcnJheS5wYWdlU2l6ZTtpKyspe3J2Kz1CeXRlQXJyYXkuY2hhck1hcFt0aGlzLnBhZ2VzW3BdW2ldXX19cmV0dXJuIHJ2fTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlQnl0ZT1mdW5jdGlvbih2YWwpe2lmKHRoaXMuY3Vyc29yPj1CeXRlQXJyYXkucGFnZVNpemUpdGhpcy5uZXdQYWdlKCk7dGhpcy5wYWdlc1t0aGlzLnBhZ2VdW3RoaXMuY3Vyc29yKytdPXZhbH07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZVVURkJ5dGVzPWZ1bmN0aW9uKHN0cmluZyl7Zm9yKHZhciBsPXN0cmluZy5sZW5ndGgsaT0wO2k8bDtpKyspdGhpcy53cml0ZUJ5dGUoc3RyaW5nLmNoYXJDb2RlQXQoaSkpfTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlQnl0ZXM9ZnVuY3Rpb24oYXJyYXksb2Zmc2V0LGxlbmd0aCl7Zm9yKHZhciBsPWxlbmd0aHx8YXJyYXkubGVuZ3RoLGk9b2Zmc2V0fHwwO2k8bDtpKyspdGhpcy53cml0ZUJ5dGUoYXJyYXlbaV0pfTtmdW5jdGlvbiBHSUZFbmNvZGVyKHdpZHRoLGhlaWdodCl7dGhpcy53aWR0aD1+fndpZHRoO3RoaXMuaGVpZ2h0PX5+aGVpZ2h0O3RoaXMudHJhbnNwYXJlbnQ9bnVsbDt0aGlzLnRyYW5zSW5kZXg9MDt0aGlzLnJlcGVhdD0tMTt0aGlzLmRlbGF5PTA7dGhpcy5pbWFnZT1udWxsO3RoaXMucGl4ZWxzPW51bGw7dGhpcy5pbmRleGVkUGl4ZWxzPW51bGw7dGhpcy5jb2xvckRlcHRoPW51bGw7dGhpcy5jb2xvclRhYj1udWxsO3RoaXMubmV1UXVhbnQ9bnVsbDt0aGlzLnVzZWRFbnRyeT1uZXcgQXJyYXk7dGhpcy5wYWxTaXplPTc7dGhpcy5kaXNwb3NlPS0xO3RoaXMuZmlyc3RGcmFtZT10cnVlO3RoaXMuc2FtcGxlPTEwO3RoaXMuZGl0aGVyPWZhbHNlO3RoaXMuZ2xvYmFsUGFsZXR0ZT1mYWxzZTt0aGlzLm91dD1uZXcgQnl0ZUFycmF5fUdJRkVuY29kZXIucHJvdG90eXBlLnNldERlbGF5PWZ1bmN0aW9uKG1pbGxpc2Vjb25kcyl7dGhpcy5kZWxheT1NYXRoLnJvdW5kKG1pbGxpc2Vjb25kcy8xMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldEZyYW1lUmF0ZT1mdW5jdGlvbihmcHMpe3RoaXMuZGVsYXk9TWF0aC5yb3VuZCgxMDAvZnBzKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGlzcG9zZT1mdW5jdGlvbihkaXNwb3NhbENvZGUpe2lmKGRpc3Bvc2FsQ29kZT49MCl0aGlzLmRpc3Bvc2U9ZGlzcG9zYWxDb2RlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRSZXBlYXQ9ZnVuY3Rpb24ocmVwZWF0KXt0aGlzLnJlcGVhdD1yZXBlYXR9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFRyYW5zcGFyZW50PWZ1bmN0aW9uKGNvbG9yKXt0aGlzLnRyYW5zcGFyZW50PWNvbG9yfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGRGcmFtZT1mdW5jdGlvbihpbWFnZURhdGEpe3RoaXMuaW1hZ2U9aW1hZ2VEYXRhO3RoaXMuY29sb3JUYWI9dGhpcy5nbG9iYWxQYWxldHRlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2U/dGhpcy5nbG9iYWxQYWxldHRlOm51bGw7dGhpcy5nZXRJbWFnZVBpeGVscygpO3RoaXMuYW5hbHl6ZVBpeGVscygpO2lmKHRoaXMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpdGhpcy5nbG9iYWxQYWxldHRlPXRoaXMuY29sb3JUYWI7aWYodGhpcy5maXJzdEZyYW1lKXt0aGlzLndyaXRlTFNEKCk7dGhpcy53cml0ZVBhbGV0dGUoKTtpZih0aGlzLnJlcGVhdD49MCl7dGhpcy53cml0ZU5ldHNjYXBlRXh0KCl9fXRoaXMud3JpdGVHcmFwaGljQ3RybEV4dCgpO3RoaXMud3JpdGVJbWFnZURlc2MoKTtpZighdGhpcy5maXJzdEZyYW1lJiYhdGhpcy5nbG9iYWxQYWxldHRlKXRoaXMud3JpdGVQYWxldHRlKCk7dGhpcy53cml0ZVBpeGVscygpO3RoaXMuZmlyc3RGcmFtZT1mYWxzZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluaXNoPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDU5KX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0UXVhbGl0eT1mdW5jdGlvbihxdWFsaXR5KXtpZihxdWFsaXR5PDEpcXVhbGl0eT0xO3RoaXMuc2FtcGxlPXF1YWxpdHl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldERpdGhlcj1mdW5jdGlvbihkaXRoZXIpe2lmKGRpdGhlcj09PXRydWUpZGl0aGVyPVwiRmxveWRTdGVpbmJlcmdcIjt0aGlzLmRpdGhlcj1kaXRoZXJ9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldEdsb2JhbFBhbGV0dGU9ZnVuY3Rpb24ocGFsZXR0ZSl7dGhpcy5nbG9iYWxQYWxldHRlPXBhbGV0dGV9O0dJRkVuY29kZXIucHJvdG90eXBlLmdldEdsb2JhbFBhbGV0dGU9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5nbG9iYWxQYWxldHRlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2UmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZSgwKXx8dGhpcy5nbG9iYWxQYWxldHRlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUhlYWRlcj1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlVVRGQnl0ZXMoXCJHSUY4OWFcIil9O0dJRkVuY29kZXIucHJvdG90eXBlLmFuYWx5emVQaXhlbHM9ZnVuY3Rpb24oKXtpZighdGhpcy5jb2xvclRhYil7dGhpcy5uZXVRdWFudD1uZXcgTmV1UXVhbnQodGhpcy5waXhlbHMsdGhpcy5zYW1wbGUpO3RoaXMubmV1UXVhbnQuYnVpbGRDb2xvcm1hcCgpO3RoaXMuY29sb3JUYWI9dGhpcy5uZXVRdWFudC5nZXRDb2xvcm1hcCgpfWlmKHRoaXMuZGl0aGVyKXt0aGlzLmRpdGhlclBpeGVscyh0aGlzLmRpdGhlci5yZXBsYWNlKFwiLXNlcnBlbnRpbmVcIixcIlwiKSx0aGlzLmRpdGhlci5tYXRjaCgvLXNlcnBlbnRpbmUvKSE9PW51bGwpfWVsc2V7dGhpcy5pbmRleFBpeGVscygpfXRoaXMucGl4ZWxzPW51bGw7dGhpcy5jb2xvckRlcHRoPTg7dGhpcy5wYWxTaXplPTc7aWYodGhpcy50cmFuc3BhcmVudCE9PW51bGwpe3RoaXMudHJhbnNJbmRleD10aGlzLmZpbmRDbG9zZXN0KHRoaXMudHJhbnNwYXJlbnQsdHJ1ZSl9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5pbmRleFBpeGVscz1mdW5jdGlvbihpbWdxKXt2YXIgblBpeD10aGlzLnBpeGVscy5sZW5ndGgvMzt0aGlzLmluZGV4ZWRQaXhlbHM9bmV3IFVpbnQ4QXJyYXkoblBpeCk7dmFyIGs9MDtmb3IodmFyIGo9MDtqPG5QaXg7aisrKXt2YXIgaW5kZXg9dGhpcy5maW5kQ2xvc2VzdFJHQih0aGlzLnBpeGVsc1trKytdJjI1NSx0aGlzLnBpeGVsc1trKytdJjI1NSx0aGlzLnBpeGVsc1trKytdJjI1NSk7dGhpcy51c2VkRW50cnlbaW5kZXhdPXRydWU7dGhpcy5pbmRleGVkUGl4ZWxzW2pdPWluZGV4fX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZGl0aGVyUGl4ZWxzPWZ1bmN0aW9uKGtlcm5lbCxzZXJwZW50aW5lKXt2YXIga2VybmVscz17RmFsc2VGbG95ZFN0ZWluYmVyZzpbWzMvOCwxLDBdLFszLzgsMCwxXSxbMi84LDEsMV1dLEZsb3lkU3RlaW5iZXJnOltbNy8xNiwxLDBdLFszLzE2LC0xLDFdLFs1LzE2LDAsMV0sWzEvMTYsMSwxXV0sU3R1Y2tpOltbOC80MiwxLDBdLFs0LzQyLDIsMF0sWzIvNDIsLTIsMV0sWzQvNDIsLTEsMV0sWzgvNDIsMCwxXSxbNC80MiwxLDFdLFsyLzQyLDIsMV0sWzEvNDIsLTIsMl0sWzIvNDIsLTEsMl0sWzQvNDIsMCwyXSxbMi80MiwxLDJdLFsxLzQyLDIsMl1dLEF0a2luc29uOltbMS84LDEsMF0sWzEvOCwyLDBdLFsxLzgsLTEsMV0sWzEvOCwwLDFdLFsxLzgsMSwxXSxbMS84LDAsMl1dfTtpZigha2VybmVsfHwha2VybmVsc1trZXJuZWxdKXt0aHJvd1wiVW5rbm93biBkaXRoZXJpbmcga2VybmVsOiBcIitrZXJuZWx9dmFyIGRzPWtlcm5lbHNba2VybmVsXTt2YXIgaW5kZXg9MCxoZWlnaHQ9dGhpcy5oZWlnaHQsd2lkdGg9dGhpcy53aWR0aCxkYXRhPXRoaXMucGl4ZWxzO3ZhciBkaXJlY3Rpb249c2VycGVudGluZT8tMToxO3RoaXMuaW5kZXhlZFBpeGVscz1uZXcgVWludDhBcnJheSh0aGlzLnBpeGVscy5sZW5ndGgvMyk7Zm9yKHZhciB5PTA7eTxoZWlnaHQ7eSsrKXtpZihzZXJwZW50aW5lKWRpcmVjdGlvbj1kaXJlY3Rpb24qLTE7Zm9yKHZhciB4PWRpcmVjdGlvbj09MT8wOndpZHRoLTEseGVuZD1kaXJlY3Rpb249PTE/d2lkdGg6MDt4IT09eGVuZDt4Kz1kaXJlY3Rpb24pe2luZGV4PXkqd2lkdGgreDt2YXIgaWR4PWluZGV4KjM7dmFyIHIxPWRhdGFbaWR4XTt2YXIgZzE9ZGF0YVtpZHgrMV07dmFyIGIxPWRhdGFbaWR4KzJdO2lkeD10aGlzLmZpbmRDbG9zZXN0UkdCKHIxLGcxLGIxKTt0aGlzLnVzZWRFbnRyeVtpZHhdPXRydWU7dGhpcy5pbmRleGVkUGl4ZWxzW2luZGV4XT1pZHg7aWR4Kj0zO3ZhciByMj10aGlzLmNvbG9yVGFiW2lkeF07dmFyIGcyPXRoaXMuY29sb3JUYWJbaWR4KzFdO3ZhciBiMj10aGlzLmNvbG9yVGFiW2lkeCsyXTt2YXIgZXI9cjEtcjI7dmFyIGVnPWcxLWcyO3ZhciBlYj1iMS1iMjtmb3IodmFyIGk9ZGlyZWN0aW9uPT0xPzA6ZHMubGVuZ3RoLTEsZW5kPWRpcmVjdGlvbj09MT9kcy5sZW5ndGg6MDtpIT09ZW5kO2krPWRpcmVjdGlvbil7dmFyIHgxPWRzW2ldWzFdO3ZhciB5MT1kc1tpXVsyXTtpZih4MSt4Pj0wJiZ4MSt4PHdpZHRoJiZ5MSt5Pj0wJiZ5MSt5PGhlaWdodCl7dmFyIGQ9ZHNbaV1bMF07aWR4PWluZGV4K3gxK3kxKndpZHRoO2lkeCo9MztkYXRhW2lkeF09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHhdK2VyKmQpKTtkYXRhW2lkeCsxXT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeCsxXStlZypkKSk7ZGF0YVtpZHgrMl09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHgrMl0rZWIqZCkpfX19fX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluZENsb3Nlc3Q9ZnVuY3Rpb24oYyx1c2VkKXtyZXR1cm4gdGhpcy5maW5kQ2xvc2VzdFJHQigoYyYxNjcxMTY4MCk+PjE2LChjJjY1MjgwKT4+OCxjJjI1NSx1c2VkKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluZENsb3Nlc3RSR0I9ZnVuY3Rpb24ocixnLGIsdXNlZCl7aWYodGhpcy5jb2xvclRhYj09PW51bGwpcmV0dXJuLTE7aWYodGhpcy5uZXVRdWFudCYmIXVzZWQpe3JldHVybiB0aGlzLm5ldVF1YW50Lmxvb2t1cFJHQihyLGcsYil9dmFyIGM9YnxnPDw4fHI8PDE2O3ZhciBtaW5wb3M9MDt2YXIgZG1pbj0yNTYqMjU2KjI1Njt2YXIgbGVuPXRoaXMuY29sb3JUYWIubGVuZ3RoO2Zvcih2YXIgaT0wLGluZGV4PTA7aTxsZW47aW5kZXgrKyl7dmFyIGRyPXItKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkZz1nLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZGI9Yi0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGQ9ZHIqZHIrZGcqZGcrZGIqZGI7aWYoKCF1c2VkfHx0aGlzLnVzZWRFbnRyeVtpbmRleF0pJiZkPGRtaW4pe2RtaW49ZDttaW5wb3M9aW5kZXh9fXJldHVybiBtaW5wb3N9O0dJRkVuY29kZXIucHJvdG90eXBlLmdldEltYWdlUGl4ZWxzPWZ1bmN0aW9uKCl7dmFyIHc9dGhpcy53aWR0aDt2YXIgaD10aGlzLmhlaWdodDt0aGlzLnBpeGVscz1uZXcgVWludDhBcnJheSh3KmgqMyk7dmFyIGRhdGE9dGhpcy5pbWFnZTt2YXIgc3JjUG9zPTA7dmFyIGNvdW50PTA7Zm9yKHZhciBpPTA7aTxoO2krKyl7Zm9yKHZhciBqPTA7ajx3O2orKyl7dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107c3JjUG9zKyt9fX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVHcmFwaGljQ3RybEV4dD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSgzMyk7dGhpcy5vdXQud3JpdGVCeXRlKDI0OSk7dGhpcy5vdXQud3JpdGVCeXRlKDQpO3ZhciB0cmFuc3AsZGlzcDtpZih0aGlzLnRyYW5zcGFyZW50PT09bnVsbCl7dHJhbnNwPTA7ZGlzcD0wfWVsc2V7dHJhbnNwPTE7ZGlzcD0yfWlmKHRoaXMuZGlzcG9zZT49MCl7ZGlzcD10aGlzLmRpc3Bvc2UmN31kaXNwPDw9Mjt0aGlzLm91dC53cml0ZUJ5dGUoMHxkaXNwfDB8dHJhbnNwKTt0aGlzLndyaXRlU2hvcnQodGhpcy5kZWxheSk7dGhpcy5vdXQud3JpdGVCeXRlKHRoaXMudHJhbnNJbmRleCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUltYWdlRGVzYz1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSg0NCk7dGhpcy53cml0ZVNob3J0KDApO3RoaXMud3JpdGVTaG9ydCgwKTt0aGlzLndyaXRlU2hvcnQodGhpcy53aWR0aCk7dGhpcy53cml0ZVNob3J0KHRoaXMuaGVpZ2h0KTtpZih0aGlzLmZpcnN0RnJhbWV8fHRoaXMuZ2xvYmFsUGFsZXR0ZSl7dGhpcy5vdXQud3JpdGVCeXRlKDApfWVsc2V7dGhpcy5vdXQud3JpdGVCeXRlKDEyOHwwfDB8MHx0aGlzLnBhbFNpemUpfX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVMU0Q9ZnVuY3Rpb24oKXt0aGlzLndyaXRlU2hvcnQodGhpcy53aWR0aCk7dGhpcy53cml0ZVNob3J0KHRoaXMuaGVpZ2h0KTt0aGlzLm91dC53cml0ZUJ5dGUoMTI4fDExMnwwfHRoaXMucGFsU2l6ZSk7dGhpcy5vdXQud3JpdGVCeXRlKDApO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVOZXRzY2FwZUV4dD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSgzMyk7dGhpcy5vdXQud3JpdGVCeXRlKDI1NSk7dGhpcy5vdXQud3JpdGVCeXRlKDExKTt0aGlzLm91dC53cml0ZVVURkJ5dGVzKFwiTkVUU0NBUEUyLjBcIik7dGhpcy5vdXQud3JpdGVCeXRlKDMpO3RoaXMub3V0LndyaXRlQnl0ZSgxKTt0aGlzLndyaXRlU2hvcnQodGhpcy5yZXBlYXQpO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVQYWxldHRlPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlcyh0aGlzLmNvbG9yVGFiKTt2YXIgbj0zKjI1Ni10aGlzLmNvbG9yVGFiLmxlbmd0aDtmb3IodmFyIGk9MDtpPG47aSsrKXRoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVTaG9ydD1mdW5jdGlvbihwVmFsdWUpe3RoaXMub3V0LndyaXRlQnl0ZShwVmFsdWUmMjU1KTt0aGlzLm91dC53cml0ZUJ5dGUocFZhbHVlPj44JjI1NSl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlUGl4ZWxzPWZ1bmN0aW9uKCl7dmFyIGVuYz1uZXcgTFpXRW5jb2Rlcih0aGlzLndpZHRoLHRoaXMuaGVpZ2h0LHRoaXMuaW5kZXhlZFBpeGVscyx0aGlzLmNvbG9yRGVwdGgpO2VuYy5lbmNvZGUodGhpcy5vdXQpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zdHJlYW09ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5vdXR9O21vZHVsZS5leHBvcnRzPUdJRkVuY29kZXJ9LHtcIi4vTFpXRW5jb2Rlci5qc1wiOjMsXCIuL1R5cGVkTmV1UXVhbnQuanNcIjo0fV0sMzpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEVPRj0tMTt2YXIgQklUUz0xMjt2YXIgSFNJWkU9NTAwMzt2YXIgbWFza3M9WzAsMSwzLDcsMTUsMzEsNjMsMTI3LDI1NSw1MTEsMTAyMywyMDQ3LDQwOTUsODE5MSwxNjM4MywzMjc2Nyw2NTUzNV07ZnVuY3Rpb24gTFpXRW5jb2Rlcih3aWR0aCxoZWlnaHQscGl4ZWxzLGNvbG9yRGVwdGgpe3ZhciBpbml0Q29kZVNpemU9TWF0aC5tYXgoMixjb2xvckRlcHRoKTt2YXIgYWNjdW09bmV3IFVpbnQ4QXJyYXkoMjU2KTt2YXIgaHRhYj1uZXcgSW50MzJBcnJheShIU0laRSk7dmFyIGNvZGV0YWI9bmV3IEludDMyQXJyYXkoSFNJWkUpO3ZhciBjdXJfYWNjdW0sY3VyX2JpdHM9MDt2YXIgYV9jb3VudDt2YXIgZnJlZV9lbnQ9MDt2YXIgbWF4Y29kZTt2YXIgY2xlYXJfZmxnPWZhbHNlO3ZhciBnX2luaXRfYml0cyxDbGVhckNvZGUsRU9GQ29kZTtmdW5jdGlvbiBjaGFyX291dChjLG91dHMpe2FjY3VtW2FfY291bnQrK109YztpZihhX2NvdW50Pj0yNTQpZmx1c2hfY2hhcihvdXRzKX1mdW5jdGlvbiBjbF9ibG9jayhvdXRzKXtjbF9oYXNoKEhTSVpFKTtmcmVlX2VudD1DbGVhckNvZGUrMjtjbGVhcl9mbGc9dHJ1ZTtvdXRwdXQoQ2xlYXJDb2RlLG91dHMpfWZ1bmN0aW9uIGNsX2hhc2goaHNpemUpe2Zvcih2YXIgaT0wO2k8aHNpemU7KytpKWh0YWJbaV09LTF9ZnVuY3Rpb24gY29tcHJlc3MoaW5pdF9iaXRzLG91dHMpe3ZhciBmY29kZSxjLGksZW50LGRpc3AsaHNpemVfcmVnLGhzaGlmdDtnX2luaXRfYml0cz1pbml0X2JpdHM7Y2xlYXJfZmxnPWZhbHNlO25fYml0cz1nX2luaXRfYml0czttYXhjb2RlPU1BWENPREUobl9iaXRzKTtDbGVhckNvZGU9MTw8aW5pdF9iaXRzLTE7RU9GQ29kZT1DbGVhckNvZGUrMTtmcmVlX2VudD1DbGVhckNvZGUrMjthX2NvdW50PTA7ZW50PW5leHRQaXhlbCgpO2hzaGlmdD0wO2ZvcihmY29kZT1IU0laRTtmY29kZTw2NTUzNjtmY29kZSo9MikrK2hzaGlmdDtoc2hpZnQ9OC1oc2hpZnQ7aHNpemVfcmVnPUhTSVpFO2NsX2hhc2goaHNpemVfcmVnKTtvdXRwdXQoQ2xlYXJDb2RlLG91dHMpO291dGVyX2xvb3A6d2hpbGUoKGM9bmV4dFBpeGVsKCkpIT1FT0Ype2Zjb2RlPShjPDxCSVRTKStlbnQ7aT1jPDxoc2hpZnReZW50O2lmKGh0YWJbaV09PT1mY29kZSl7ZW50PWNvZGV0YWJbaV07Y29udGludWV9ZWxzZSBpZihodGFiW2ldPj0wKXtkaXNwPWhzaXplX3JlZy1pO2lmKGk9PT0wKWRpc3A9MTtkb3tpZigoaS09ZGlzcCk8MClpKz1oc2l6ZV9yZWc7aWYoaHRhYltpXT09PWZjb2RlKXtlbnQ9Y29kZXRhYltpXTtjb250aW51ZSBvdXRlcl9sb29wfX13aGlsZShodGFiW2ldPj0wKX1vdXRwdXQoZW50LG91dHMpO2VudD1jO2lmKGZyZWVfZW50PDE8PEJJVFMpe2NvZGV0YWJbaV09ZnJlZV9lbnQrKztodGFiW2ldPWZjb2RlfWVsc2V7Y2xfYmxvY2sob3V0cyl9fW91dHB1dChlbnQsb3V0cyk7b3V0cHV0KEVPRkNvZGUsb3V0cyl9ZnVuY3Rpb24gZW5jb2RlKG91dHMpe291dHMud3JpdGVCeXRlKGluaXRDb2RlU2l6ZSk7cmVtYWluaW5nPXdpZHRoKmhlaWdodDtjdXJQaXhlbD0wO2NvbXByZXNzKGluaXRDb2RlU2l6ZSsxLG91dHMpO291dHMud3JpdGVCeXRlKDApfWZ1bmN0aW9uIGZsdXNoX2NoYXIob3V0cyl7aWYoYV9jb3VudD4wKXtvdXRzLndyaXRlQnl0ZShhX2NvdW50KTtvdXRzLndyaXRlQnl0ZXMoYWNjdW0sMCxhX2NvdW50KTthX2NvdW50PTB9fWZ1bmN0aW9uIE1BWENPREUobl9iaXRzKXtyZXR1cm4oMTw8bl9iaXRzKS0xfWZ1bmN0aW9uIG5leHRQaXhlbCgpe2lmKHJlbWFpbmluZz09PTApcmV0dXJuIEVPRjstLXJlbWFpbmluZzt2YXIgcGl4PXBpeGVsc1tjdXJQaXhlbCsrXTtyZXR1cm4gcGl4JjI1NX1mdW5jdGlvbiBvdXRwdXQoY29kZSxvdXRzKXtjdXJfYWNjdW0mPW1hc2tzW2N1cl9iaXRzXTtpZihjdXJfYml0cz4wKWN1cl9hY2N1bXw9Y29kZTw8Y3VyX2JpdHM7ZWxzZSBjdXJfYWNjdW09Y29kZTtjdXJfYml0cys9bl9iaXRzO3doaWxlKGN1cl9iaXRzPj04KXtjaGFyX291dChjdXJfYWNjdW0mMjU1LG91dHMpO2N1cl9hY2N1bT4+PTg7Y3VyX2JpdHMtPTh9aWYoZnJlZV9lbnQ+bWF4Y29kZXx8Y2xlYXJfZmxnKXtpZihjbGVhcl9mbGcpe21heGNvZGU9TUFYQ09ERShuX2JpdHM9Z19pbml0X2JpdHMpO2NsZWFyX2ZsZz1mYWxzZX1lbHNleysrbl9iaXRzO2lmKG5fYml0cz09QklUUyltYXhjb2RlPTE8PEJJVFM7ZWxzZSBtYXhjb2RlPU1BWENPREUobl9iaXRzKX19aWYoY29kZT09RU9GQ29kZSl7d2hpbGUoY3VyX2JpdHM+MCl7Y2hhcl9vdXQoY3VyX2FjY3VtJjI1NSxvdXRzKTtjdXJfYWNjdW0+Pj04O2N1cl9iaXRzLT04fWZsdXNoX2NoYXIob3V0cyl9fXRoaXMuZW5jb2RlPWVuY29kZX1tb2R1bGUuZXhwb3J0cz1MWldFbmNvZGVyfSx7fV0sNDpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIG5jeWNsZXM9MTAwO3ZhciBuZXRzaXplPTI1Njt2YXIgbWF4bmV0cG9zPW5ldHNpemUtMTt2YXIgbmV0Ymlhc3NoaWZ0PTQ7dmFyIGludGJpYXNzaGlmdD0xNjt2YXIgaW50Ymlhcz0xPDxpbnRiaWFzc2hpZnQ7dmFyIGdhbW1hc2hpZnQ9MTA7dmFyIGdhbW1hPTE8PGdhbW1hc2hpZnQ7dmFyIGJldGFzaGlmdD0xMDt2YXIgYmV0YT1pbnRiaWFzPj5iZXRhc2hpZnQ7dmFyIGJldGFnYW1tYT1pbnRiaWFzPDxnYW1tYXNoaWZ0LWJldGFzaGlmdDt2YXIgaW5pdHJhZD1uZXRzaXplPj4zO3ZhciByYWRpdXNiaWFzc2hpZnQ9Njt2YXIgcmFkaXVzYmlhcz0xPDxyYWRpdXNiaWFzc2hpZnQ7dmFyIGluaXRyYWRpdXM9aW5pdHJhZCpyYWRpdXNiaWFzO3ZhciByYWRpdXNkZWM9MzA7dmFyIGFscGhhYmlhc3NoaWZ0PTEwO3ZhciBpbml0YWxwaGE9MTw8YWxwaGFiaWFzc2hpZnQ7dmFyIGFscGhhZGVjO3ZhciByYWRiaWFzc2hpZnQ9ODt2YXIgcmFkYmlhcz0xPDxyYWRiaWFzc2hpZnQ7dmFyIGFscGhhcmFkYnNoaWZ0PWFscGhhYmlhc3NoaWZ0K3JhZGJpYXNzaGlmdDt2YXIgYWxwaGFyYWRiaWFzPTE8PGFscGhhcmFkYnNoaWZ0O3ZhciBwcmltZTE9NDk5O3ZhciBwcmltZTI9NDkxO3ZhciBwcmltZTM9NDg3O3ZhciBwcmltZTQ9NTAzO3ZhciBtaW5waWN0dXJlYnl0ZXM9MypwcmltZTQ7ZnVuY3Rpb24gTmV1UXVhbnQocGl4ZWxzLHNhbXBsZWZhYyl7dmFyIG5ldHdvcms7dmFyIG5ldGluZGV4O3ZhciBiaWFzO3ZhciBmcmVxO3ZhciByYWRwb3dlcjtmdW5jdGlvbiBpbml0KCl7bmV0d29yaz1bXTtuZXRpbmRleD1uZXcgSW50MzJBcnJheSgyNTYpO2JpYXM9bmV3IEludDMyQXJyYXkobmV0c2l6ZSk7ZnJlcT1uZXcgSW50MzJBcnJheShuZXRzaXplKTtyYWRwb3dlcj1uZXcgSW50MzJBcnJheShuZXRzaXplPj4zKTt2YXIgaSx2O2ZvcihpPTA7aTxuZXRzaXplO2krKyl7dj0oaTw8bmV0Ymlhc3NoaWZ0KzgpL25ldHNpemU7bmV0d29ya1tpXT1uZXcgRmxvYXQ2NEFycmF5KFt2LHYsdiwwXSk7ZnJlcVtpXT1pbnRiaWFzL25ldHNpemU7Ymlhc1tpXT0wfX1mdW5jdGlvbiB1bmJpYXNuZXQoKXtmb3IodmFyIGk9MDtpPG5ldHNpemU7aSsrKXtuZXR3b3JrW2ldWzBdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bMV0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVsyXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzNdPWl9fWZ1bmN0aW9uIGFsdGVyc2luZ2xlKGFscGhhLGksYixnLHIpe25ldHdvcmtbaV1bMF0tPWFscGhhKihuZXR3b3JrW2ldWzBdLWIpL2luaXRhbHBoYTtuZXR3b3JrW2ldWzFdLT1hbHBoYSoobmV0d29ya1tpXVsxXS1nKS9pbml0YWxwaGE7bmV0d29ya1tpXVsyXS09YWxwaGEqKG5ldHdvcmtbaV1bMl0tcikvaW5pdGFscGhhfWZ1bmN0aW9uIGFsdGVybmVpZ2gocmFkaXVzLGksYixnLHIpe3ZhciBsbz1NYXRoLmFicyhpLXJhZGl1cyk7dmFyIGhpPU1hdGgubWluKGkrcmFkaXVzLG5ldHNpemUpO3ZhciBqPWkrMTt2YXIgaz1pLTE7dmFyIG09MTt2YXIgcCxhO3doaWxlKGo8aGl8fGs+bG8pe2E9cmFkcG93ZXJbbSsrXTtpZihqPGhpKXtwPW5ldHdvcmtbaisrXTtwWzBdLT1hKihwWzBdLWIpL2FscGhhcmFkYmlhcztwWzFdLT1hKihwWzFdLWcpL2FscGhhcmFkYmlhcztwWzJdLT1hKihwWzJdLXIpL2FscGhhcmFkYmlhc31pZihrPmxvKXtwPW5ldHdvcmtbay0tXTtwWzBdLT1hKihwWzBdLWIpL2FscGhhcmFkYmlhcztwWzFdLT1hKihwWzFdLWcpL2FscGhhcmFkYmlhcztwWzJdLT1hKihwWzJdLXIpL2FscGhhcmFkYmlhc319fWZ1bmN0aW9uIGNvbnRlc3QoYixnLHIpe3ZhciBiZXN0ZD1+KDE8PDMxKTt2YXIgYmVzdGJpYXNkPWJlc3RkO3ZhciBiZXN0cG9zPS0xO3ZhciBiZXN0Ymlhc3Bvcz1iZXN0cG9zO3ZhciBpLG4sZGlzdCxiaWFzZGlzdCxiZXRhZnJlcTtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe249bmV0d29ya1tpXTtkaXN0PU1hdGguYWJzKG5bMF0tYikrTWF0aC5hYnMoblsxXS1nKStNYXRoLmFicyhuWzJdLXIpO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdHBvcz1pfWJpYXNkaXN0PWRpc3QtKGJpYXNbaV0+PmludGJpYXNzaGlmdC1uZXRiaWFzc2hpZnQpO2lmKGJpYXNkaXN0PGJlc3RiaWFzZCl7YmVzdGJpYXNkPWJpYXNkaXN0O2Jlc3RiaWFzcG9zPWl9YmV0YWZyZXE9ZnJlcVtpXT4+YmV0YXNoaWZ0O2ZyZXFbaV0tPWJldGFmcmVxO2JpYXNbaV0rPWJldGFmcmVxPDxnYW1tYXNoaWZ0fWZyZXFbYmVzdHBvc10rPWJldGE7Ymlhc1tiZXN0cG9zXS09YmV0YWdhbW1hO3JldHVybiBiZXN0Ymlhc3Bvc31mdW5jdGlvbiBpbnhidWlsZCgpe3ZhciBpLGoscCxxLHNtYWxscG9zLHNtYWxsdmFsLHByZXZpb3VzY29sPTAsc3RhcnRwb3M9MDtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe3A9bmV0d29ya1tpXTtzbWFsbHBvcz1pO3NtYWxsdmFsPXBbMV07Zm9yKGo9aSsxO2o8bmV0c2l6ZTtqKyspe3E9bmV0d29ya1tqXTtpZihxWzFdPHNtYWxsdmFsKXtzbWFsbHBvcz1qO3NtYWxsdmFsPXFbMV19fXE9bmV0d29ya1tzbWFsbHBvc107aWYoaSE9c21hbGxwb3Mpe2o9cVswXTtxWzBdPXBbMF07cFswXT1qO2o9cVsxXTtxWzFdPXBbMV07cFsxXT1qO2o9cVsyXTtxWzJdPXBbMl07cFsyXT1qO2o9cVszXTtxWzNdPXBbM107cFszXT1qfWlmKHNtYWxsdmFsIT1wcmV2aW91c2NvbCl7bmV0aW5kZXhbcHJldmlvdXNjb2xdPXN0YXJ0cG9zK2k+PjE7Zm9yKGo9cHJldmlvdXNjb2wrMTtqPHNtYWxsdmFsO2orKyluZXRpbmRleFtqXT1pO3ByZXZpb3VzY29sPXNtYWxsdmFsO3N0YXJ0cG9zPWl9fW5ldGluZGV4W3ByZXZpb3VzY29sXT1zdGFydHBvcyttYXhuZXRwb3M+PjE7Zm9yKGo9cHJldmlvdXNjb2wrMTtqPDI1NjtqKyspbmV0aW5kZXhbal09bWF4bmV0cG9zfWZ1bmN0aW9uIGlueHNlYXJjaChiLGcscil7dmFyIGEscCxkaXN0O3ZhciBiZXN0ZD0xZTM7dmFyIGJlc3Q9LTE7dmFyIGk9bmV0aW5kZXhbZ107dmFyIGo9aS0xO3doaWxlKGk8bmV0c2l6ZXx8aj49MCl7aWYoaTxuZXRzaXplKXtwPW5ldHdvcmtbaV07ZGlzdD1wWzFdLWc7aWYoZGlzdD49YmVzdGQpaT1uZXRzaXplO2Vsc2V7aSsrO2lmKGRpc3Q8MClkaXN0PS1kaXN0O2E9cFswXS1iO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YT1wWzJdLXI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Q9cFszXX19fX1pZihqPj0wKXtwPW5ldHdvcmtbal07ZGlzdD1nLXBbMV07aWYoZGlzdD49YmVzdGQpaj0tMTtlbHNle2otLTtpZihkaXN0PDApZGlzdD0tZGlzdDthPXBbMF0tYjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2E9cFsyXS1yO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0PXBbM119fX19fXJldHVybiBiZXN0fWZ1bmN0aW9uIGxlYXJuKCl7dmFyIGk7dmFyIGxlbmd0aGNvdW50PXBpeGVscy5sZW5ndGg7dmFyIGFscGhhZGVjPTMwKyhzYW1wbGVmYWMtMSkvMzt2YXIgc2FtcGxlcGl4ZWxzPWxlbmd0aGNvdW50LygzKnNhbXBsZWZhYyk7dmFyIGRlbHRhPX5+KHNhbXBsZXBpeGVscy9uY3ljbGVzKTt2YXIgYWxwaGE9aW5pdGFscGhhO3ZhciByYWRpdXM9aW5pdHJhZGl1czt2YXIgcmFkPXJhZGl1cz4+cmFkaXVzYmlhc3NoaWZ0O2lmKHJhZDw9MSlyYWQ9MDtmb3IoaT0wO2k8cmFkO2krKylyYWRwb3dlcltpXT1hbHBoYSooKHJhZCpyYWQtaSppKSpyYWRiaWFzLyhyYWQqcmFkKSk7dmFyIHN0ZXA7aWYobGVuZ3RoY291bnQ8bWlucGljdHVyZWJ5dGVzKXtzYW1wbGVmYWM9MTtzdGVwPTN9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTEhPT0wKXtzdGVwPTMqcHJpbWUxfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUyIT09MCl7c3RlcD0zKnByaW1lMn1lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMyE9PTApe3N0ZXA9MypwcmltZTN9ZWxzZXtzdGVwPTMqcHJpbWU0fXZhciBiLGcscixqO3ZhciBwaXg9MDtpPTA7d2hpbGUoaTxzYW1wbGVwaXhlbHMpe2I9KHBpeGVsc1twaXhdJjI1NSk8PG5ldGJpYXNzaGlmdDtnPShwaXhlbHNbcGl4KzFdJjI1NSk8PG5ldGJpYXNzaGlmdDtyPShwaXhlbHNbcGl4KzJdJjI1NSk8PG5ldGJpYXNzaGlmdDtqPWNvbnRlc3QoYixnLHIpO2FsdGVyc2luZ2xlKGFscGhhLGosYixnLHIpO2lmKHJhZCE9PTApYWx0ZXJuZWlnaChyYWQsaixiLGcscik7cGl4Kz1zdGVwO2lmKHBpeD49bGVuZ3RoY291bnQpcGl4LT1sZW5ndGhjb3VudDtpKys7aWYoZGVsdGE9PT0wKWRlbHRhPTE7aWYoaSVkZWx0YT09PTApe2FscGhhLT1hbHBoYS9hbHBoYWRlYztyYWRpdXMtPXJhZGl1cy9yYWRpdXNkZWM7cmFkPXJhZGl1cz4+cmFkaXVzYmlhc3NoaWZ0O2lmKHJhZDw9MSlyYWQ9MDtmb3Ioaj0wO2o8cmFkO2orKylyYWRwb3dlcltqXT1hbHBoYSooKHJhZCpyYWQtaipqKSpyYWRiaWFzLyhyYWQqcmFkKSl9fX1mdW5jdGlvbiBidWlsZENvbG9ybWFwKCl7aW5pdCgpO2xlYXJuKCk7dW5iaWFzbmV0KCk7aW54YnVpbGQoKX10aGlzLmJ1aWxkQ29sb3JtYXA9YnVpbGRDb2xvcm1hcDtmdW5jdGlvbiBnZXRDb2xvcm1hcCgpe3ZhciBtYXA9W107dmFyIGluZGV4PVtdO2Zvcih2YXIgaT0wO2k8bmV0c2l6ZTtpKyspaW5kZXhbbmV0d29ya1tpXVszXV09aTt2YXIgaz0wO2Zvcih2YXIgbD0wO2w8bmV0c2l6ZTtsKyspe3ZhciBqPWluZGV4W2xdO21hcFtrKytdPW5ldHdvcmtbal1bMF07bWFwW2srK109bmV0d29ya1tqXVsxXTttYXBbaysrXT1uZXR3b3JrW2pdWzJdfXJldHVybiBtYXB9dGhpcy5nZXRDb2xvcm1hcD1nZXRDb2xvcm1hcDt0aGlzLmxvb2t1cFJHQj1pbnhzZWFyY2h9bW9kdWxlLmV4cG9ydHM9TmV1UXVhbnR9LHt9XSw1OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgVUEsYnJvd3Nlcixtb2RlLHBsYXRmb3JtLHVhO3VhPW5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtwbGF0Zm9ybT1uYXZpZ2F0b3IucGxhdGZvcm0udG9Mb3dlckNhc2UoKTtVQT11YS5tYXRjaCgvKG9wZXJhfGllfGZpcmVmb3h8Y2hyb21lfHZlcnNpb24pW1xcc1xcLzpdKFtcXHdcXGRcXC5dKyk/Lio/KHNhZmFyaXx2ZXJzaW9uW1xcc1xcLzpdKFtcXHdcXGRcXC5dKyl8JCkvKXx8W251bGwsXCJ1bmtub3duXCIsMF07bW9kZT1VQVsxXT09PVwiaWVcIiYmZG9jdW1lbnQuZG9jdW1lbnRNb2RlO2Jyb3dzZXI9e25hbWU6VUFbMV09PT1cInZlcnNpb25cIj9VQVszXTpVQVsxXSx2ZXJzaW9uOm1vZGV8fHBhcnNlRmxvYXQoVUFbMV09PT1cIm9wZXJhXCImJlVBWzRdP1VBWzRdOlVBWzJdKSxwbGF0Zm9ybTp7bmFtZTp1YS5tYXRjaCgvaXAoPzphZHxvZHxob25lKS8pP1wiaW9zXCI6KHVhLm1hdGNoKC8oPzp3ZWJvc3xhbmRyb2lkKS8pfHxwbGF0Zm9ybS5tYXRjaCgvbWFjfHdpbnxsaW51eC8pfHxbXCJvdGhlclwiXSlbMF19fTticm93c2VyW2Jyb3dzZXIubmFtZV09dHJ1ZTticm93c2VyW2Jyb3dzZXIubmFtZStwYXJzZUludChicm93c2VyLnZlcnNpb24sMTApXT10cnVlO2Jyb3dzZXIucGxhdGZvcm1bYnJvd3Nlci5wbGF0Zm9ybS5uYW1lXT10cnVlO21vZHVsZS5leHBvcnRzPWJyb3dzZXJ9LHt9XSw2OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgRXZlbnRFbWl0dGVyLEdJRixHSUZFbmNvZGVyLGJyb3dzZXIsZ2lmV29ya2VyLGV4dGVuZD1mdW5jdGlvbihjaGlsZCxwYXJlbnQpe2Zvcih2YXIga2V5IGluIHBhcmVudCl7aWYoaGFzUHJvcC5jYWxsKHBhcmVudCxrZXkpKWNoaWxkW2tleV09cGFyZW50W2tleV19ZnVuY3Rpb24gY3Rvcigpe3RoaXMuY29uc3RydWN0b3I9Y2hpbGR9Y3Rvci5wcm90b3R5cGU9cGFyZW50LnByb3RvdHlwZTtjaGlsZC5wcm90b3R5cGU9bmV3IGN0b3I7Y2hpbGQuX19zdXBlcl9fPXBhcmVudC5wcm90b3R5cGU7cmV0dXJuIGNoaWxkfSxoYXNQcm9wPXt9Lmhhc093blByb3BlcnR5LGluZGV4T2Y9W10uaW5kZXhPZnx8ZnVuY3Rpb24oaXRlbSl7Zm9yKHZhciBpPTAsbD10aGlzLmxlbmd0aDtpPGw7aSsrKXtpZihpIGluIHRoaXMmJnRoaXNbaV09PT1pdGVtKXJldHVybiBpfXJldHVybi0xfSxzbGljZT1bXS5zbGljZTtFdmVudEVtaXR0ZXI9cmVxdWlyZShcImV2ZW50c1wiKS5FdmVudEVtaXR0ZXI7YnJvd3Nlcj1yZXF1aXJlKFwiLi9icm93c2VyLmNvZmZlZVwiKTtHSUZFbmNvZGVyPXJlcXVpcmUoXCIuL0dJRkVuY29kZXIuanNcIik7Z2lmV29ya2VyPXJlcXVpcmUoXCIuL2dpZi53b3JrZXIuY29mZmVlXCIpO21vZHVsZS5leHBvcnRzPUdJRj1mdW5jdGlvbihzdXBlckNsYXNzKXt2YXIgZGVmYXVsdHMsZnJhbWVEZWZhdWx0cztleHRlbmQoR0lGLHN1cGVyQ2xhc3MpO2RlZmF1bHRzPXt3b3JrZXJTY3JpcHQ6XCJnaWYud29ya2VyLmpzXCIsd29ya2VyczoyLHJlcGVhdDowLGJhY2tncm91bmQ6XCIjZmZmXCIscXVhbGl0eToxMCx3aWR0aDpudWxsLGhlaWdodDpudWxsLHRyYW5zcGFyZW50Om51bGwsZGVidWc6ZmFsc2UsZGl0aGVyOmZhbHNlfTtmcmFtZURlZmF1bHRzPXtkZWxheTo1MDAsY29weTpmYWxzZSxkaXNwb3NlOi0xfTtmdW5jdGlvbiBHSUYob3B0aW9ucyl7dmFyIGJhc2Usa2V5LHZhbHVlO3RoaXMucnVubmluZz1mYWxzZTt0aGlzLm9wdGlvbnM9e307dGhpcy5mcmFtZXM9W107dGhpcy5mcmVlV29ya2Vycz1bXTt0aGlzLmFjdGl2ZVdvcmtlcnM9W107dGhpcy5zZXRPcHRpb25zKG9wdGlvbnMpO2ZvcihrZXkgaW4gZGVmYXVsdHMpe3ZhbHVlPWRlZmF1bHRzW2tleV07aWYoKGJhc2U9dGhpcy5vcHRpb25zKVtrZXldPT1udWxsKXtiYXNlW2tleV09dmFsdWV9fX1HSUYucHJvdG90eXBlLnNldE9wdGlvbj1mdW5jdGlvbihrZXksdmFsdWUpe3RoaXMub3B0aW9uc1trZXldPXZhbHVlO2lmKHRoaXMuX2NhbnZhcyE9bnVsbCYmKGtleT09PVwid2lkdGhcInx8a2V5PT09XCJoZWlnaHRcIikpe3JldHVybiB0aGlzLl9jYW52YXNba2V5XT12YWx1ZX19O0dJRi5wcm90b3R5cGUuc2V0T3B0aW9ucz1mdW5jdGlvbihvcHRpb25zKXt2YXIga2V5LHJlc3VsdHMsdmFsdWU7cmVzdWx0cz1bXTtmb3Ioa2V5IGluIG9wdGlvbnMpe2lmKCFoYXNQcm9wLmNhbGwob3B0aW9ucyxrZXkpKWNvbnRpbnVlO3ZhbHVlPW9wdGlvbnNba2V5XTtyZXN1bHRzLnB1c2godGhpcy5zZXRPcHRpb24oa2V5LHZhbHVlKSl9cmV0dXJuIHJlc3VsdHN9O0dJRi5wcm90b3R5cGUuYWRkRnJhbWU9ZnVuY3Rpb24oaW1hZ2Usb3B0aW9ucyl7dmFyIGZyYW1lLGtleTtpZihvcHRpb25zPT1udWxsKXtvcHRpb25zPXt9fWZyYW1lPXt9O2ZyYW1lLnRyYW5zcGFyZW50PXRoaXMub3B0aW9ucy50cmFuc3BhcmVudDtmb3Ioa2V5IGluIGZyYW1lRGVmYXVsdHMpe2ZyYW1lW2tleV09b3B0aW9uc1trZXldfHxmcmFtZURlZmF1bHRzW2tleV19aWYodGhpcy5vcHRpb25zLndpZHRoPT1udWxsKXt0aGlzLnNldE9wdGlvbihcIndpZHRoXCIsaW1hZ2Uud2lkdGgpfWlmKHRoaXMub3B0aW9ucy5oZWlnaHQ9PW51bGwpe3RoaXMuc2V0T3B0aW9uKFwiaGVpZ2h0XCIsaW1hZ2UuaGVpZ2h0KX1pZih0eXBlb2YgSW1hZ2VEYXRhIT09XCJ1bmRlZmluZWRcIiYmSW1hZ2VEYXRhIT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBJbWFnZURhdGEpe2ZyYW1lLmRhdGE9aW1hZ2UuZGF0YX1lbHNlIGlmKHR5cGVvZiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQhPT1cInVuZGVmaW5lZFwiJiZDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRHx8dHlwZW9mIFdlYkdMUmVuZGVyaW5nQ29udGV4dCE9PVwidW5kZWZpbmVkXCImJldlYkdMUmVuZGVyaW5nQ29udGV4dCE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgV2ViR0xSZW5kZXJpbmdDb250ZXh0KXtpZihvcHRpb25zLmNvcHkpe2ZyYW1lLmRhdGE9dGhpcy5nZXRDb250ZXh0RGF0YShpbWFnZSl9ZWxzZXtmcmFtZS5jb250ZXh0PWltYWdlfX1lbHNlIGlmKGltYWdlLmNoaWxkTm9kZXMhPW51bGwpe2lmKG9wdGlvbnMuY29weSl7ZnJhbWUuZGF0YT10aGlzLmdldEltYWdlRGF0YShpbWFnZSl9ZWxzZXtmcmFtZS5pbWFnZT1pbWFnZX19ZWxzZXt0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGltYWdlXCIpfXJldHVybiB0aGlzLmZyYW1lcy5wdXNoKGZyYW1lKX07R0lGLnByb3RvdHlwZS5yZW5kZXI9ZnVuY3Rpb24oKXt2YXIgaSxqLG51bVdvcmtlcnMscmVmO2lmKHRoaXMucnVubmluZyl7dGhyb3cgbmV3IEVycm9yKFwiQWxyZWFkeSBydW5uaW5nXCIpfWlmKHRoaXMub3B0aW9ucy53aWR0aD09bnVsbHx8dGhpcy5vcHRpb25zLmhlaWdodD09bnVsbCl7dGhyb3cgbmV3IEVycm9yKFwiV2lkdGggYW5kIGhlaWdodCBtdXN0IGJlIHNldCBwcmlvciB0byByZW5kZXJpbmdcIil9dGhpcy5ydW5uaW5nPXRydWU7dGhpcy5uZXh0RnJhbWU9MDt0aGlzLmZpbmlzaGVkRnJhbWVzPTA7dGhpcy5pbWFnZVBhcnRzPWZ1bmN0aW9uKCl7dmFyIGoscmVmLHJlc3VsdHM7cmVzdWx0cz1bXTtmb3IoaT1qPTAscmVmPXRoaXMuZnJhbWVzLmxlbmd0aDswPD1yZWY/ajxyZWY6aj5yZWY7aT0wPD1yZWY/KytqOi0tail7cmVzdWx0cy5wdXNoKG51bGwpfXJldHVybiByZXN1bHRzfS5jYWxsKHRoaXMpO251bVdvcmtlcnM9dGhpcy5zcGF3bldvcmtlcnMoKTtpZih0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9ZWxzZXtmb3IoaT1qPTAscmVmPW51bVdvcmtlcnM7MDw9cmVmP2o8cmVmOmo+cmVmO2k9MDw9cmVmPysrajotLWope3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9fXRoaXMuZW1pdChcInN0YXJ0XCIpO3JldHVybiB0aGlzLmVtaXQoXCJwcm9ncmVzc1wiLDApfTtHSUYucHJvdG90eXBlLmFib3J0PWZ1bmN0aW9uKCl7dmFyIHdvcmtlcjt3aGlsZSh0cnVlKXt3b3JrZXI9dGhpcy5hY3RpdmVXb3JrZXJzLnNoaWZ0KCk7aWYod29ya2VyPT1udWxsKXticmVha310aGlzLmxvZyhcImtpbGxpbmcgYWN0aXZlIHdvcmtlclwiKTt3b3JrZXIudGVybWluYXRlKCl9dGhpcy5ydW5uaW5nPWZhbHNlO3JldHVybiB0aGlzLmVtaXQoXCJhYm9ydFwiKX07R0lGLnByb3RvdHlwZS5zcGF3bldvcmtlcnM9ZnVuY3Rpb24oKXt2YXIgaixudW1Xb3JrZXJzLHJlZixyZXN1bHRzO251bVdvcmtlcnM9TWF0aC5taW4odGhpcy5vcHRpb25zLndvcmtlcnMsdGhpcy5mcmFtZXMubGVuZ3RoKTsoZnVuY3Rpb24oKXtyZXN1bHRzPVtdO2Zvcih2YXIgaj1yZWY9dGhpcy5mcmVlV29ya2Vycy5sZW5ndGg7cmVmPD1udW1Xb3JrZXJzP2o8bnVtV29ya2VyczpqPm51bVdvcmtlcnM7cmVmPD1udW1Xb3JrZXJzP2orKzpqLS0pe3Jlc3VsdHMucHVzaChqKX1yZXR1cm4gcmVzdWx0c30pLmFwcGx5KHRoaXMpLmZvckVhY2goZnVuY3Rpb24oX3RoaXMpe3JldHVybiBmdW5jdGlvbihpKXt2YXIgd29ya2VyO190aGlzLmxvZyhcInNwYXduaW5nIHdvcmtlciBcIitpKTt3b3JrZXI9bmV3IFdvcmtlcihfdGhpcy5vcHRpb25zLndvcmtlclNjcmlwdCk7d29ya2VyLm9ubWVzc2FnZT1mdW5jdGlvbihldmVudCl7X3RoaXMuYWN0aXZlV29ya2Vycy5zcGxpY2UoX3RoaXMuYWN0aXZlV29ya2Vycy5pbmRleE9mKHdvcmtlciksMSk7X3RoaXMuZnJlZVdvcmtlcnMucHVzaCh3b3JrZXIpO3JldHVybiBfdGhpcy5mcmFtZUZpbmlzaGVkKGV2ZW50LmRhdGEpfTtyZXR1cm4gX3RoaXMuZnJlZVdvcmtlcnMucHVzaCh3b3JrZXIpfX0odGhpcykpO3JldHVybiBudW1Xb3JrZXJzfTtHSUYucHJvdG90eXBlLmZyYW1lRmluaXNoZWQ9ZnVuY3Rpb24oZnJhbWUpe3ZhciBpLGoscmVmO3RoaXMubG9nKFwiZnJhbWUgXCIrZnJhbWUuaW5kZXgrXCIgZmluaXNoZWQgLSBcIit0aGlzLmFjdGl2ZVdvcmtlcnMubGVuZ3RoK1wiIGFjdGl2ZVwiKTt0aGlzLmZpbmlzaGVkRnJhbWVzKys7dGhpcy5lbWl0KFwicHJvZ3Jlc3NcIix0aGlzLmZpbmlzaGVkRnJhbWVzL3RoaXMuZnJhbWVzLmxlbmd0aCk7dGhpcy5pbWFnZVBhcnRzW2ZyYW1lLmluZGV4XT1mcmFtZTtpZih0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe3RoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPWZyYW1lLmdsb2JhbFBhbGV0dGU7dGhpcy5sb2coXCJnbG9iYWwgcGFsZXR0ZSBhbmFseXplZFwiKTtpZih0aGlzLmZyYW1lcy5sZW5ndGg+Mil7Zm9yKGk9aj0xLHJlZj10aGlzLmZyZWVXb3JrZXJzLmxlbmd0aDsxPD1yZWY/ajxyZWY6aj5yZWY7aT0xPD1yZWY/KytqOi0tail7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX19fWlmKGluZGV4T2YuY2FsbCh0aGlzLmltYWdlUGFydHMsbnVsbCk+PTApe3JldHVybiB0aGlzLnJlbmRlck5leHRGcmFtZSgpfWVsc2V7cmV0dXJuIHRoaXMuZmluaXNoUmVuZGVyaW5nKCl9fTtHSUYucHJvdG90eXBlLmZpbmlzaFJlbmRlcmluZz1mdW5jdGlvbigpe3ZhciBkYXRhLGZyYW1lLGksaW1hZ2UsaixrLGwsbGVuLGxlbjEsbGVuMixsZW4zLG9mZnNldCxwYWdlLHJlZixyZWYxLHJlZjI7bGVuPTA7cmVmPXRoaXMuaW1hZ2VQYXJ0cztmb3Ioaj0wLGxlbjE9cmVmLmxlbmd0aDtqPGxlbjE7aisrKXtmcmFtZT1yZWZbal07bGVuKz0oZnJhbWUuZGF0YS5sZW5ndGgtMSkqZnJhbWUucGFnZVNpemUrZnJhbWUuY3Vyc29yfWxlbis9ZnJhbWUucGFnZVNpemUtZnJhbWUuY3Vyc29yO3RoaXMubG9nKFwicmVuZGVyaW5nIGZpbmlzaGVkIC0gZmlsZXNpemUgXCIrTWF0aC5yb3VuZChsZW4vMWUzKStcImtiXCIpO2RhdGE9bmV3IFVpbnQ4QXJyYXkobGVuKTtvZmZzZXQ9MDtyZWYxPXRoaXMuaW1hZ2VQYXJ0cztmb3Ioaz0wLGxlbjI9cmVmMS5sZW5ndGg7azxsZW4yO2srKyl7ZnJhbWU9cmVmMVtrXTtyZWYyPWZyYW1lLmRhdGE7Zm9yKGk9bD0wLGxlbjM9cmVmMi5sZW5ndGg7bDxsZW4zO2k9KytsKXtwYWdlPXJlZjJbaV07ZGF0YS5zZXQocGFnZSxvZmZzZXQpO2lmKGk9PT1mcmFtZS5kYXRhLmxlbmd0aC0xKXtvZmZzZXQrPWZyYW1lLmN1cnNvcn1lbHNle29mZnNldCs9ZnJhbWUucGFnZVNpemV9fX1pbWFnZT1uZXcgQmxvYihbZGF0YV0se3R5cGU6XCJpbWFnZS9naWZcIn0pO3JldHVybiB0aGlzLmVtaXQoXCJmaW5pc2hlZFwiLGltYWdlLGRhdGEpfTtHSUYucHJvdG90eXBlLnJlbmRlck5leHRGcmFtZT1mdW5jdGlvbigpe3ZhciBmcmFtZSx0YXNrLHdvcmtlcjtpZih0aGlzLmZyZWVXb3JrZXJzLmxlbmd0aD09PTApe3Rocm93IG5ldyBFcnJvcihcIk5vIGZyZWUgd29ya2Vyc1wiKX1pZih0aGlzLm5leHRGcmFtZT49dGhpcy5mcmFtZXMubGVuZ3RoKXtyZXR1cm59ZnJhbWU9dGhpcy5mcmFtZXNbdGhpcy5uZXh0RnJhbWUrK107d29ya2VyPXRoaXMuZnJlZVdvcmtlcnMuc2hpZnQoKTt0YXNrPXRoaXMuZ2V0VGFzayhmcmFtZSk7dGhpcy5sb2coXCJzdGFydGluZyBmcmFtZSBcIisodGFzay5pbmRleCsxKStcIiBvZiBcIit0aGlzLmZyYW1lcy5sZW5ndGgpO3RoaXMuYWN0aXZlV29ya2Vycy5wdXNoKHdvcmtlcik7cmV0dXJuIHdvcmtlci5wb3N0TWVzc2FnZSh0YXNrKX07R0lGLnByb3RvdHlwZS5nZXRDb250ZXh0RGF0YT1mdW5jdGlvbihjdHgpe3JldHVybiBjdHguZ2V0SW1hZ2VEYXRhKDAsMCx0aGlzLm9wdGlvbnMud2lkdGgsdGhpcy5vcHRpb25zLmhlaWdodCkuZGF0YX07R0lGLnByb3RvdHlwZS5nZXRJbWFnZURhdGE9ZnVuY3Rpb24oaW1hZ2Upe3ZhciBjdHg7aWYodGhpcy5fY2FudmFzPT1udWxsKXt0aGlzLl9jYW52YXM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTt0aGlzLl9jYW52YXMud2lkdGg9dGhpcy5vcHRpb25zLndpZHRoO3RoaXMuX2NhbnZhcy5oZWlnaHQ9dGhpcy5vcHRpb25zLmhlaWdodH1jdHg9dGhpcy5fY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtjdHguc2V0RmlsbD10aGlzLm9wdGlvbnMuYmFja2dyb3VuZDtjdHguZmlsbFJlY3QoMCwwLHRoaXMub3B0aW9ucy53aWR0aCx0aGlzLm9wdGlvbnMuaGVpZ2h0KTtjdHguZHJhd0ltYWdlKGltYWdlLDAsMCk7cmV0dXJuIHRoaXMuZ2V0Q29udGV4dERhdGEoY3R4KX07R0lGLnByb3RvdHlwZS5nZXRUYXNrPWZ1bmN0aW9uKGZyYW1lKXt2YXIgaW5kZXgsdGFzaztpbmRleD10aGlzLmZyYW1lcy5pbmRleE9mKGZyYW1lKTt0YXNrPXtpbmRleDppbmRleCxsYXN0OmluZGV4PT09dGhpcy5mcmFtZXMubGVuZ3RoLTEsZGVsYXk6ZnJhbWUuZGVsYXksZGlzcG9zZTpmcmFtZS5kaXNwb3NlLHRyYW5zcGFyZW50OmZyYW1lLnRyYW5zcGFyZW50LHdpZHRoOnRoaXMub3B0aW9ucy53aWR0aCxoZWlnaHQ6dGhpcy5vcHRpb25zLmhlaWdodCxxdWFsaXR5OnRoaXMub3B0aW9ucy5xdWFsaXR5LGRpdGhlcjp0aGlzLm9wdGlvbnMuZGl0aGVyLGdsb2JhbFBhbGV0dGU6dGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGUscmVwZWF0OnRoaXMub3B0aW9ucy5yZXBlYXQsY2FuVHJhbnNmZXI6YnJvd3Nlci5uYW1lPT09XCJjaHJvbWVcIn07aWYoZnJhbWUuZGF0YSE9bnVsbCl7dGFzay5kYXRhPWZyYW1lLmRhdGF9ZWxzZSBpZihmcmFtZS5jb250ZXh0IT1udWxsKXt0YXNrLmRhdGE9dGhpcy5nZXRDb250ZXh0RGF0YShmcmFtZS5jb250ZXh0KX1lbHNlIGlmKGZyYW1lLmltYWdlIT1udWxsKXt0YXNrLmRhdGE9dGhpcy5nZXRJbWFnZURhdGEoZnJhbWUuaW1hZ2UpfWVsc2V7dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBmcmFtZVwiKX1yZXR1cm4gdGFza307R0lGLnByb3RvdHlwZS5sb2c9ZnVuY3Rpb24oKXt2YXIgYXJnczthcmdzPTE8PWFyZ3VtZW50cy5sZW5ndGg/c2xpY2UuY2FsbChhcmd1bWVudHMsMCk6W107aWYoIXRoaXMub3B0aW9ucy5kZWJ1Zyl7cmV0dXJufXJldHVybiBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLGFyZ3MpfTtyZXR1cm4gR0lGfShFdmVudEVtaXR0ZXIpfSx7XCIuL0dJRkVuY29kZXIuanNcIjoyLFwiLi9icm93c2VyLmNvZmZlZVwiOjUsXCIuL2dpZi53b3JrZXIuY29mZmVlXCI6NyxldmVudHM6MX1dLDc6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBHSUZFbmNvZGVyLHJlbmRlckZyYW1lO0dJRkVuY29kZXI9cmVxdWlyZShcIi4vR0lGRW5jb2Rlci5qc1wiKTtyZW5kZXJGcmFtZT1mdW5jdGlvbihmcmFtZSl7dmFyIGVuY29kZXIscGFnZSxzdHJlYW0sdHJhbnNmZXI7ZW5jb2Rlcj1uZXcgR0lGRW5jb2RlcihmcmFtZS53aWR0aCxmcmFtZS5oZWlnaHQpO2lmKGZyYW1lLmluZGV4PT09MCl7ZW5jb2Rlci53cml0ZUhlYWRlcigpfWVsc2V7ZW5jb2Rlci5maXJzdEZyYW1lPWZhbHNlfWVuY29kZXIuc2V0VHJhbnNwYXJlbnQoZnJhbWUudHJhbnNwYXJlbnQpO2VuY29kZXIuc2V0RGlzcG9zZShmcmFtZS5kaXNwb3NlKTtlbmNvZGVyLnNldFJlcGVhdChmcmFtZS5yZXBlYXQpO2VuY29kZXIuc2V0RGVsYXkoZnJhbWUuZGVsYXkpO2VuY29kZXIuc2V0UXVhbGl0eShmcmFtZS5xdWFsaXR5KTtlbmNvZGVyLnNldERpdGhlcihmcmFtZS5kaXRoZXIpO2VuY29kZXIuc2V0R2xvYmFsUGFsZXR0ZShmcmFtZS5nbG9iYWxQYWxldHRlKTtlbmNvZGVyLmFkZEZyYW1lKGZyYW1lLmRhdGEpO2lmKGZyYW1lLmxhc3Qpe2VuY29kZXIuZmluaXNoKCl9aWYoZnJhbWUuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe2ZyYW1lLmdsb2JhbFBhbGV0dGU9ZW5jb2Rlci5nZXRHbG9iYWxQYWxldHRlKCl9c3RyZWFtPWVuY29kZXIuc3RyZWFtKCk7ZnJhbWUuZGF0YT1zdHJlYW0ucGFnZXM7ZnJhbWUuY3Vyc29yPXN0cmVhbS5jdXJzb3I7ZnJhbWUucGFnZVNpemU9c3RyZWFtLmNvbnN0cnVjdG9yLnBhZ2VTaXplO2lmKGZyYW1lLmNhblRyYW5zZmVyKXt0cmFuc2Zlcj1mdW5jdGlvbigpe3ZhciBpLGxlbixyZWYscmVzdWx0cztyZWY9ZnJhbWUuZGF0YTtyZXN1bHRzPVtdO2ZvcihpPTAsbGVuPXJlZi5sZW5ndGg7aTxsZW47aSsrKXtwYWdlPXJlZltpXTtyZXN1bHRzLnB1c2gocGFnZS5idWZmZXIpfXJldHVybiByZXN1bHRzfSgpO3JldHVybiBzZWxmLnBvc3RNZXNzYWdlKGZyYW1lLHRyYW5zZmVyKX1lbHNle3JldHVybiBzZWxmLnBvc3RNZXNzYWdlKGZyYW1lKX19O3NlbGYub25tZXNzYWdlPWZ1bmN0aW9uKGV2ZW50KXtyZXR1cm4gcmVuZGVyRnJhbWUoZXZlbnQuZGF0YSl9fSx7XCIuL0dJRkVuY29kZXIuanNcIjoyfV19LHt9LFs2XSkoNil9KTtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Z2lmLmpzLm1hcFxyXG4iLCI7KGZ1bmN0aW9uKCkge1xyXG5cclxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICB2YXIgVGFyID0gcmVxdWlyZSgnLi90YXIuanMnKTtcclxuICB2YXIgZG93bmxvYWQgPSByZXF1aXJlKCcuL2Rvd25sb2FkLmpzJyk7XHJcbiAgdmFyIEdJRiA9IHJlcXVpcmUoJy4vZ2lmLmpzJyk7XHJcbn1cclxuXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxudmFyIG9iamVjdFR5cGVzID0ge1xyXG4nZnVuY3Rpb24nOiB0cnVlLFxyXG4nb2JqZWN0JzogdHJ1ZVxyXG59O1xyXG5cclxuZnVuY3Rpb24gY2hlY2tHbG9iYWwodmFsdWUpIHtcclxuICAgIHJldHVybiAodmFsdWUgJiYgdmFsdWUuT2JqZWN0ID09PSBPYmplY3QpID8gdmFsdWUgOiBudWxsO1xyXG4gIH1cclxuXHJcbi8qKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyB3aXRob3V0IGEgZGVwZW5kZW5jeSBvbiBgcm9vdGAuICovXHJcbnZhciBmcmVlUGFyc2VGbG9hdCA9IHBhcnNlRmxvYXQsXHJcbiAgZnJlZVBhcnNlSW50ID0gcGFyc2VJbnQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgLiAqL1xyXG52YXIgZnJlZUV4cG9ydHMgPSAob2JqZWN0VHlwZXNbdHlwZW9mIGV4cG9ydHNdICYmIGV4cG9ydHMgJiYgIWV4cG9ydHMubm9kZVR5cGUpXHJcbj8gZXhwb3J0c1xyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYC4gKi9cclxudmFyIGZyZWVNb2R1bGUgPSAob2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUpXHJcbj8gbW9kdWxlXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCB0aGUgcG9wdWxhciBDb21tb25KUyBleHRlbnNpb24gYG1vZHVsZS5leHBvcnRzYC4gKi9cclxudmFyIG1vZHVsZUV4cG9ydHMgPSAoZnJlZU1vZHVsZSAmJiBmcmVlTW9kdWxlLmV4cG9ydHMgPT09IGZyZWVFeHBvcnRzKVxyXG4/IGZyZWVFeHBvcnRzXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcy4gKi9cclxudmFyIGZyZWVHbG9iYWwgPSBjaGVja0dsb2JhbChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlICYmIHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsKTtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgc2VsZmAuICovXHJcbnZhciBmcmVlU2VsZiA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiBzZWxmXSAmJiBzZWxmKTtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgd2luZG93YC4gKi9cclxudmFyIGZyZWVXaW5kb3cgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygd2luZG93XSAmJiB3aW5kb3cpO1xyXG5cclxuLyoqIERldGVjdCBgdGhpc2AgYXMgdGhlIGdsb2JhbCBvYmplY3QuICovXHJcbnZhciB0aGlzR2xvYmFsID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHRoaXNdICYmIHRoaXMpO1xyXG5cclxuLyoqXHJcbiogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdC5cclxuKlxyXG4qIFRoZSBgdGhpc2AgdmFsdWUgaXMgdXNlZCBpZiBpdCdzIHRoZSBnbG9iYWwgb2JqZWN0IHRvIGF2b2lkIEdyZWFzZW1vbmtleSdzXHJcbiogcmVzdHJpY3RlZCBgd2luZG93YCBvYmplY3QsIG90aGVyd2lzZSB0aGUgYHdpbmRvd2Agb2JqZWN0IGlzIHVzZWQuXHJcbiovXHJcbnZhciByb290ID0gZnJlZUdsb2JhbCB8fFxyXG4oKGZyZWVXaW5kb3cgIT09ICh0aGlzR2xvYmFsICYmIHRoaXNHbG9iYWwud2luZG93KSkgJiYgZnJlZVdpbmRvdykgfHxcclxuICBmcmVlU2VsZiB8fCB0aGlzR2xvYmFsIHx8IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XHJcblxyXG5pZiggISgnZ2MnIGluIHdpbmRvdyApICkge1xyXG5cdHdpbmRvdy5nYyA9IGZ1bmN0aW9uKCl7fVxyXG59XHJcblxyXG5pZiAoIUhUTUxDYW52YXNFbGVtZW50LnByb3RvdHlwZS50b0Jsb2IpIHtcclxuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShIVE1MQ2FudmFzRWxlbWVudC5wcm90b3R5cGUsICd0b0Jsb2InLCB7XHJcbiAgdmFsdWU6IGZ1bmN0aW9uIChjYWxsYmFjaywgdHlwZSwgcXVhbGl0eSkge1xyXG5cclxuICAgIHZhciBiaW5TdHIgPSBhdG9iKCB0aGlzLnRvRGF0YVVSTCh0eXBlLCBxdWFsaXR5KS5zcGxpdCgnLCcpWzFdICksXHJcbiAgICAgICAgbGVuID0gYmluU3RyLmxlbmd0aCxcclxuICAgICAgICBhcnIgPSBuZXcgVWludDhBcnJheShsZW4pO1xyXG5cclxuICAgIGZvciAodmFyIGk9MDsgaTxsZW47IGkrKyApIHtcclxuICAgICBhcnJbaV0gPSBiaW5TdHIuY2hhckNvZGVBdChpKTtcclxuICAgIH1cclxuXHJcbiAgICBjYWxsYmFjayggbmV3IEJsb2IoIFthcnJdLCB7dHlwZTogdHlwZSB8fCAnaW1hZ2UvcG5nJ30gKSApO1xyXG4gIH1cclxuIH0pO1xyXG59XHJcblxyXG4vLyBAbGljZW5zZSBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXHJcbi8vIGNvcHlyaWdodCBQYXVsIElyaXNoIDIwMTVcclxuXHJcblxyXG4vLyBEYXRlLm5vdygpIGlzIHN1cHBvcnRlZCBldmVyeXdoZXJlIGV4Y2VwdCBJRTguIEZvciBJRTggd2UgdXNlIHRoZSBEYXRlLm5vdyBwb2x5ZmlsbFxyXG4vLyAgIGdpdGh1Yi5jb20vRmluYW5jaWFsLVRpbWVzL3BvbHlmaWxsLXNlcnZpY2UvYmxvYi9tYXN0ZXIvcG9seWZpbGxzL0RhdGUubm93L3BvbHlmaWxsLmpzXHJcbi8vIGFzIFNhZmFyaSA2IGRvZXNuJ3QgaGF2ZSBzdXBwb3J0IGZvciBOYXZpZ2F0aW9uVGltaW5nLCB3ZSB1c2UgYSBEYXRlLm5vdygpIHRpbWVzdGFtcCBmb3IgcmVsYXRpdmUgdmFsdWVzXHJcblxyXG4vLyBpZiB5b3Ugd2FudCB2YWx1ZXMgc2ltaWxhciB0byB3aGF0IHlvdSdkIGdldCB3aXRoIHJlYWwgcGVyZi5ub3csIHBsYWNlIHRoaXMgdG93YXJkcyB0aGUgaGVhZCBvZiB0aGUgcGFnZVxyXG4vLyBidXQgaW4gcmVhbGl0eSwgeW91J3JlIGp1c3QgZ2V0dGluZyB0aGUgZGVsdGEgYmV0d2VlbiBub3coKSBjYWxscywgc28gaXQncyBub3QgdGVycmlibHkgaW1wb3J0YW50IHdoZXJlIGl0J3MgcGxhY2VkXHJcblxyXG5cclxuKGZ1bmN0aW9uKCl7XHJcblxyXG4gIGlmIChcInBlcmZvcm1hbmNlXCIgaW4gd2luZG93ID09IGZhbHNlKSB7XHJcbiAgICAgIHdpbmRvdy5wZXJmb3JtYW5jZSA9IHt9O1xyXG4gIH1cclxuXHJcbiAgRGF0ZS5ub3cgPSAoRGF0ZS5ub3cgfHwgZnVuY3Rpb24gKCkgeyAgLy8gdGhhbmtzIElFOFxyXG5cdCAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gIH0pO1xyXG5cclxuICBpZiAoXCJub3dcIiBpbiB3aW5kb3cucGVyZm9ybWFuY2UgPT0gZmFsc2Upe1xyXG5cclxuICAgIHZhciBub3dPZmZzZXQgPSBEYXRlLm5vdygpO1xyXG5cclxuICAgIGlmIChwZXJmb3JtYW5jZS50aW1pbmcgJiYgcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydCl7XHJcbiAgICAgIG5vd09mZnNldCA9IHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnRcclxuICAgIH1cclxuXHJcbiAgICB3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24gbm93KCl7XHJcbiAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gbm93T2Zmc2V0O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbn0pKCk7XHJcblxyXG5cclxuZnVuY3Rpb24gcGFkKCBuICkge1xyXG5cdHJldHVybiBTdHJpbmcoXCIwMDAwMDAwXCIgKyBuKS5zbGljZSgtNyk7XHJcbn1cclxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvQWRkLW9ucy9Db2RlX3NuaXBwZXRzL1RpbWVyc1xyXG5cclxudmFyIGdfc3RhcnRUaW1lID0gd2luZG93LkRhdGUubm93KCk7XHJcblxyXG5mdW5jdGlvbiBndWlkKCkge1xyXG5cdGZ1bmN0aW9uIHM0KCkge1xyXG5cdFx0cmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApLnRvU3RyaW5nKDE2KS5zdWJzdHJpbmcoMSk7XHJcblx0fVxyXG5cdHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gQ0NGcmFtZUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgX2hhbmRsZXJzID0ge307XHJcblxyXG5cdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHJcblx0dGhpcy5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBoYW5kbGVyKSB7XHJcblxyXG5cdFx0X2hhbmRsZXJzW2V2ZW50XSA9IGhhbmRsZXI7XHJcblxyXG5cdH07XHJcblxyXG5cdHRoaXMuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblxyXG5cdFx0dmFyIGhhbmRsZXIgPSBfaGFuZGxlcnNbZXZlbnRdO1xyXG5cdFx0aWYgKGhhbmRsZXIpIHtcclxuXHJcblx0XHRcdGhhbmRsZXIuYXBwbHkobnVsbCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHR0aGlzLmZpbGVuYW1lID0gc2V0dGluZ3MubmFtZSB8fCBndWlkKCk7XHJcblx0dGhpcy5leHRlbnNpb24gPSAnJztcclxuXHR0aGlzLm1pbWVUeXBlID0gJyc7XHJcblxyXG59XHJcblxyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zYWZlVG9Qcm9jZWVkID0gZnVuY3Rpb24oKXsgcmV0dXJuIHRydWU7IH07XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdGVwID0gZnVuY3Rpb24oKSB7IGNvbnNvbGUubG9nKCAnU3RlcCBub3Qgc2V0IScgKSB9XHJcblxyXG5mdW5jdGlvbiBDQ1RhckVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcudGFyJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAnYXBwbGljYXRpb24veC10YXInXHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJyc7XHJcblxyXG5cdHRoaXMudGFwZSA9IG51bGxcclxuXHR0aGlzLmNvdW50ID0gMDtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe1xyXG5cclxuXHR0aGlzLmRpc3Bvc2UoKTtcclxuXHJcbn07XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBibG9iICkge1xyXG5cclxuXHR2YXIgZmlsZVJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcblx0ZmlsZVJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMudGFwZS5hcHBlbmQoIHBhZCggdGhpcy5jb3VudCApICsgdGhpcy5maWxlRXh0ZW5zaW9uLCBuZXcgVWludDhBcnJheSggZmlsZVJlYWRlci5yZXN1bHQgKSApO1xyXG5cclxuXHRcdC8vaWYoIHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lID4gMCAmJiAoIHRoaXMuZnJhbWVzLmxlbmd0aCAvIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlICkgPj0gdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgKSB7XHJcblxyXG5cdFx0dGhpcy5jb3VudCsrO1xyXG5cdFx0dGhpcy5zdGVwKCk7XHJcblx0fS5iaW5kKCB0aGlzICk7XHJcblx0ZmlsZVJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0Y2FsbGJhY2soIHRoaXMudGFwZS5zYXZlKCkgKTtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLnRhcGUgPSBuZXcgVGFyKCk7XHJcblx0dGhpcy5jb3VudCA9IDA7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ1BOR0VuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ1RhckVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy50eXBlID0gJ2ltYWdlL3BuZyc7XHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJy5wbmcnO1xyXG5cclxufVxyXG5cclxuQ0NQTkdFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDVGFyRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDUE5HRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0Y2FudmFzLnRvQmxvYiggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRDQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZC5jYWxsKCB0aGlzLCBibG9iICk7XHJcblx0fS5iaW5kKCB0aGlzICksIHRoaXMudHlwZSApXHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0pQRUdFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NUYXJFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMudHlwZSA9ICdpbWFnZS9qcGVnJztcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnLmpwZyc7XHJcblx0dGhpcy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG59XHJcblxyXG5DQ0pQRUdFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDVGFyRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDSlBFR0VuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGNhbnZhcy50b0Jsb2IoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0Q0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQuY2FsbCggdGhpcywgYmxvYiApO1xyXG5cdH0uYmluZCggdGhpcyApLCB0aGlzLnR5cGUsIHRoaXMucXVhbGl0eSApXHJcblxyXG59XHJcblxyXG4vKlxyXG5cclxuXHRXZWJNIEVuY29kZXJcclxuXHJcbiovXHJcblxyXG5mdW5jdGlvbiBDQ1dlYk1FbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcblx0aWYoIGNhbnZhcy50b0RhdGFVUkwoICdpbWFnZS93ZWJwJyApLnN1YnN0cig1LDEwKSAhPT0gJ2ltYWdlL3dlYnAnICl7XHJcblx0XHRjb25zb2xlLmxvZyggXCJXZWJQIG5vdCBzdXBwb3J0ZWQgLSB0cnkgYW5vdGhlciBleHBvcnQgZm9ybWF0XCIgKVxyXG5cdH1cclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy53ZWJtJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAndmlkZW8vd2VibSdcclxuXHR0aGlzLmJhc2VGaWxlbmFtZSA9IHRoaXMuZmlsZW5hbWU7XHJcblxyXG5cdHRoaXMuZnJhbWVzID0gW107XHJcblx0dGhpcy5wYXJ0ID0gMTtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlciA9IG5ldyBXZWJNV3JpdGVyKHtcclxuICAgIHF1YWxpdHk6IHRoaXMucXVhbGl0eSxcclxuICAgIGZpbGVXcml0ZXI6IG51bGwsXHJcbiAgICBmZDogbnVsbCxcclxuICAgIGZyYW1lUmF0ZTogc2V0dGluZ3MuZnJhbWVyYXRlXHJcbn0pO1xyXG5cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZGlzcG9zZSgpO1xyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlci5hZGRGcmFtZShjYW52YXMpO1xyXG5cclxuXHQvL3RoaXMuZnJhbWVzLnB1c2goIGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3dlYnAnLCB0aGlzLnF1YWxpdHkpICk7XHJcblxyXG5cdGlmKCB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSA+IDAgJiYgKCB0aGlzLmZyYW1lcy5sZW5ndGggLyB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApID49IHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lICkge1xyXG5cdFx0dGhpcy5zYXZlKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdFx0dGhpcy5maWxlbmFtZSA9IHRoaXMuYmFzZUZpbGVuYW1lICsgJy1wYXJ0LScgKyBwYWQoIHRoaXMucGFydCApO1xyXG5cdFx0XHRkb3dubG9hZCggYmxvYiwgdGhpcy5maWxlbmFtZSArIHRoaXMuZXh0ZW5zaW9uLCB0aGlzLm1pbWVUeXBlICk7XHJcblx0XHRcdHRoaXMuZGlzcG9zZSgpO1xyXG5cdFx0XHR0aGlzLnBhcnQrKztcclxuXHRcdFx0dGhpcy5maWxlbmFtZSA9IHRoaXMuYmFzZUZpbGVuYW1lICsgJy1wYXJ0LScgKyBwYWQoIHRoaXMucGFydCApO1xyXG5cdFx0XHR0aGlzLnN0ZXAoKTtcclxuXHRcdH0uYmluZCggdGhpcyApIClcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhpcy5zdGVwKCk7XHJcblx0fVxyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbi8vXHRpZiggIXRoaXMuZnJhbWVzLmxlbmd0aCApIHJldHVybjtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlci5jb21wbGV0ZSgpLnRoZW4oY2FsbGJhY2spO1xyXG5cclxuXHQvKnZhciB3ZWJtID0gV2hhbW15LmZyb21JbWFnZUFycmF5KCB0aGlzLmZyYW1lcywgdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKVxyXG5cdHZhciBibG9iID0gbmV3IEJsb2IoIFsgd2VibSBdLCB7IHR5cGU6IFwib2N0ZXQvc3RyZWFtXCIgfSApO1xyXG5cdGNhbGxiYWNrKCBibG9iICk7Ki9cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmZyYW1lcyA9IFtdO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxuXHR0aGlzLmVuY29kZXIgPSBuZXcgRkZNcGVnU2VydmVyLlZpZGVvKCBzZXR0aW5ncyApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvY2VzcycsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuZW1pdCggJ3Byb2Nlc3MnIClcclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oJ2ZpbmlzaGVkJywgZnVuY3Rpb24oIHVybCwgc2l6ZSApIHtcclxuICAgICAgICB2YXIgY2IgPSB0aGlzLmNhbGxiYWNrO1xyXG4gICAgICAgIGlmICggY2IgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGNiKCB1cmwsIHNpemUgKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvZ3Jlc3MnLCBmdW5jdGlvbiggcHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgaWYgKCB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyggcHJvZ3Jlc3MgKVxyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdlcnJvcicsIGZ1bmN0aW9uKCBkYXRhICkge1xyXG4gICAgICAgIGFsZXJ0KEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpKTtcclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zdGFydCggdGhpcy5zZXR0aW5ncyApO1xyXG5cclxufTtcclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmFkZCggY2FudmFzICk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG4gICAgdGhpcy5lbmNvZGVyLmVuZCgpO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zYWZlVG9Qcm9jZWVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5lbmNvZGVyLnNhZmVUb1Byb2NlZWQoKTtcclxufTtcclxuXHJcbi8qXHJcblx0SFRNTENhbnZhc0VsZW1lbnQuY2FwdHVyZVN0cmVhbSgpXHJcbiovXHJcblxyXG5mdW5jdGlvbiBDQ1N0cmVhbUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLmZyYW1lcmF0ZSA9IHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdHRoaXMudHlwZSA9ICd2aWRlby93ZWJtJztcclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcud2VibSc7XHJcblx0dGhpcy5zdHJlYW0gPSBudWxsO1xyXG5cdHRoaXMubWVkaWFSZWNvcmRlciA9IG51bGw7XHJcblx0dGhpcy5jaHVua3MgPSBbXTtcclxuXHJcbn1cclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0aWYoICF0aGlzLnN0cmVhbSApIHtcclxuXHRcdHRoaXMuc3RyZWFtID0gY2FudmFzLmNhcHR1cmVTdHJlYW0oIHRoaXMuZnJhbWVyYXRlICk7XHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIgPSBuZXcgTWVkaWFSZWNvcmRlciggdGhpcy5zdHJlYW0gKTtcclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlci5zdGFydCgpO1xyXG5cclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPSBmdW5jdGlvbihlKSB7XHJcblx0XHRcdHRoaXMuY2h1bmtzLnB1c2goZS5kYXRhKTtcclxuXHRcdH0uYmluZCggdGhpcyApO1xyXG5cclxuXHR9XHJcblx0dGhpcy5zdGVwKCk7XHJcblxyXG59XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdHRoaXMubWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbiggZSApIHtcclxuXHRcdHZhciBibG9iID0gbmV3IEJsb2IoIHRoaXMuY2h1bmtzLCB7ICd0eXBlJyA6ICd2aWRlby93ZWJtJyB9KTtcclxuXHRcdHRoaXMuY2h1bmtzID0gW107XHJcblx0XHRjYWxsYmFjayggYmxvYiApO1xyXG5cclxuXHR9LmJpbmQoIHRoaXMgKTtcclxuXHJcblx0dGhpcy5tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuXHJcbn1cclxuXHJcbi8qZnVuY3Rpb24gQ0NHSUZFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gc2V0dGluZ3MucXVhbGl0eSB8fCA2O1xyXG5cdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHJcblx0dGhpcy5lbmNvZGVyID0gbmV3IEdJRkVuY29kZXIoKTtcclxuXHR0aGlzLmVuY29kZXIuc2V0UmVwZWF0KCAxICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0RGVsYXkoIHNldHRpbmdzLnN0ZXAgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRRdWFsaXR5KCA2ICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0VHJhbnNwYXJlbnQoIG51bGwgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRTaXplKCAxNTAsIDE1MCApO1xyXG5cclxuICBcdHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuICBcdHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCggJzJkJyApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyICk7XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zdGFydCgpO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmNhbnZhcy53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHR0aGlzLmNhbnZhcy5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdHRoaXMuY3R4LmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCB0aGlzLmN0eCApO1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc2V0U2l6ZSggY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0ICk7XHJcblx0dmFyIHJlYWRCdWZmZXIgPSBuZXcgVWludDhBcnJheShjYW52YXMud2lkdGggKiBjYW52YXMuaGVpZ2h0ICogNCk7XHJcblx0dmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApO1xyXG5cdGNvbnRleHQucmVhZFBpeGVscygwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQsIGNvbnRleHQuUkdCQSwgY29udGV4dC5VTlNJR05FRF9CWVRFLCByZWFkQnVmZmVyKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHJlYWRCdWZmZXIsIHRydWUgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuZmluaXNoKCk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdHZhciBiaW5hcnlfZ2lmID0gdGhpcy5lbmNvZGVyLnN0cmVhbSgpLmdldERhdGEoKTtcclxuXHJcblx0dmFyIGRhdGFfdXJsID0gJ2RhdGE6aW1hZ2UvZ2lmO2Jhc2U2NCwnK2VuY29kZTY0KGJpbmFyeV9naWYpO1xyXG5cdHdpbmRvdy5sb2NhdGlvbiA9IGRhdGFfdXJsO1xyXG5cdHJldHVybjtcclxuXHJcblx0dmFyIGJsb2IgPSBuZXcgQmxvYiggWyBiaW5hcnlfZ2lmIF0sIHsgdHlwZTogXCJvY3RldC9zdHJlYW1cIiB9ICk7XHJcblx0dmFyIHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKCBibG9iICk7XHJcblx0Y2FsbGJhY2soIHVybCApO1xyXG5cclxufSovXHJcblxyXG5mdW5jdGlvbiBDQ0dJRkVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gMzEgLSAoICggc2V0dGluZ3MucXVhbGl0eSAqIDMwIC8gMTAwICkgfHwgMTAgKTtcclxuXHRzZXR0aW5ncy53b3JrZXJzID0gc2V0dGluZ3Mud29ya2VycyB8fCA0O1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcuZ2lmJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAnaW1hZ2UvZ2lmJ1xyXG5cclxuICBcdHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuICBcdHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCggJzJkJyApO1xyXG4gIFx0dGhpcy5zaXplU2V0ID0gZmFsc2U7XHJcblxyXG4gIFx0dGhpcy5lbmNvZGVyID0gbmV3IEdJRih7XHJcblx0XHR3b3JrZXJzOiBzZXR0aW5ncy53b3JrZXJzLFxyXG5cdFx0cXVhbGl0eTogc2V0dGluZ3MucXVhbGl0eSxcclxuXHRcdHdvcmtlclNjcmlwdDogc2V0dGluZ3Mud29ya2Vyc1BhdGggKyAnZ2lmLndvcmtlci5qcydcclxuXHR9ICk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvZ3Jlc3MnLCBmdW5jdGlvbiggcHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgaWYgKCB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyggcHJvZ3Jlc3MgKVxyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCdmaW5pc2hlZCcsIGZ1bmN0aW9uKCBibG9iICkge1xyXG4gICAgICAgIHZhciBjYiA9IHRoaXMuY2FsbGJhY2s7XHJcbiAgICAgICAgaWYgKCBjYiApIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgY2IoIGJsb2IgKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRpZiggIXRoaXMuc2l6ZVNldCApIHtcclxuXHRcdHRoaXMuZW5jb2Rlci5zZXRPcHRpb24oICd3aWR0aCcsY2FudmFzLndpZHRoICk7XHJcblx0XHR0aGlzLmVuY29kZXIuc2V0T3B0aW9uKCAnaGVpZ2h0JyxjYW52YXMuaGVpZ2h0ICk7XHJcblx0XHR0aGlzLnNpemVTZXQgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0dGhpcy5jYW52YXMud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0dGhpcy5jYW52YXMuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHR0aGlzLmN0eC5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHRoaXMuY3R4LCB7IGNvcHk6IHRydWUsIGRlbGF5OiB0aGlzLnNldHRpbmdzLnN0ZXAgfSApO1xyXG5cdHRoaXMuc3RlcCgpO1xyXG5cclxuXHQvKnRoaXMuZW5jb2Rlci5zZXRTaXplKCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQgKTtcclxuXHR2YXIgcmVhZEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGNhbnZhcy53aWR0aCAqIGNhbnZhcy5oZWlnaHQgKiA0KTtcclxuXHR2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICk7XHJcblx0Y29udGV4dC5yZWFkUGl4ZWxzKDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCwgY29udGV4dC5SR0JBLCBjb250ZXh0LlVOU0lHTkVEX0JZVEUsIHJlYWRCdWZmZXIpO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggcmVhZEJ1ZmZlciwgdHJ1ZSApOyovXHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG5cclxuXHR0aGlzLmVuY29kZXIucmVuZGVyKCk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ2FwdHVyZSggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBfc2V0dGluZ3MgPSBzZXR0aW5ncyB8fCB7fSxcclxuXHRcdF9kYXRlID0gbmV3IERhdGUoKSxcclxuXHRcdF92ZXJib3NlLFxyXG5cdFx0X2Rpc3BsYXksXHJcblx0XHRfdGltZSxcclxuXHRcdF9zdGFydFRpbWUsXHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lLFxyXG5cdFx0X3BlcmZvcm1hbmNlU3RhcnRUaW1lLFxyXG5cdFx0X3N0ZXAsXHJcbiAgICAgICAgX2VuY29kZXIsXHJcblx0XHRfdGltZW91dHMgPSBbXSxcclxuXHRcdF9pbnRlcnZhbHMgPSBbXSxcclxuXHRcdF9mcmFtZUNvdW50ID0gMCxcclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID0gMCxcclxuXHRcdF9sYXN0RnJhbWUgPSBudWxsLFxyXG5cdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcyA9IFtdLFxyXG5cdFx0X2NhcHR1cmluZyA9IGZhbHNlLFxyXG4gICAgICAgIF9oYW5kbGVycyA9IHt9O1xyXG5cclxuXHRfc2V0dGluZ3MuZnJhbWVyYXRlID0gX3NldHRpbmdzLmZyYW1lcmF0ZSB8fCA2MDtcclxuXHRfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA9IDIgKiAoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzIHx8IDEgKTtcclxuXHRfdmVyYm9zZSA9IF9zZXR0aW5ncy52ZXJib3NlIHx8IGZhbHNlO1xyXG5cdF9kaXNwbGF5ID0gX3NldHRpbmdzLmRpc3BsYXkgfHwgZmFsc2U7XHJcblx0X3NldHRpbmdzLnN0ZXAgPSAxMDAwLjAgLyBfc2V0dGluZ3MuZnJhbWVyYXRlIDtcclxuXHRfc2V0dGluZ3MudGltZUxpbWl0ID0gX3NldHRpbmdzLnRpbWVMaW1pdCB8fCAwO1xyXG5cdF9zZXR0aW5ncy5mcmFtZUxpbWl0ID0gX3NldHRpbmdzLmZyYW1lTGltaXQgfHwgMDtcclxuXHRfc2V0dGluZ3Muc3RhcnRUaW1lID0gX3NldHRpbmdzLnN0YXJ0VGltZSB8fCAwO1xyXG5cclxuXHR2YXIgX3RpbWVEaXNwbGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRfdGltZURpc3BsYXkuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5sZWZ0ID0gX3RpbWVEaXNwbGF5LnN0eWxlLnRvcCA9IDBcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2JsYWNrJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmZvbnRTaXplID0gJzExcHgnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnBhZGRpbmcgPSAnNXB4J1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5jb2xvciA9ICdyZWQnO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS56SW5kZXggPSAxMDAwMDBcclxuXHRpZiggX3NldHRpbmdzLmRpc3BsYXkgKSBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBfdGltZURpc3BsYXkgKTtcclxuXHJcblx0dmFyIGNhbnZhc01vdGlvbkJsdXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG5cdHZhciBjdHhNb3Rpb25CbHVyID0gY2FudmFzTW90aW9uQmx1ci5nZXRDb250ZXh0KCAnMmQnICk7XHJcblx0dmFyIGJ1ZmZlck1vdGlvbkJsdXI7XHJcblx0dmFyIGltYWdlRGF0YTtcclxuXHJcblx0X2xvZyggJ1N0ZXAgaXMgc2V0IHRvICcgKyBfc2V0dGluZ3Muc3RlcCArICdtcycgKTtcclxuXHJcbiAgICB2YXIgX2VuY29kZXJzID0ge1xyXG5cdFx0Z2lmOiBDQ0dJRkVuY29kZXIsXHJcblx0XHR3ZWJtOiBDQ1dlYk1FbmNvZGVyLFxyXG5cdFx0ZmZtcGVnc2VydmVyOiBDQ0ZGTXBlZ1NlcnZlckVuY29kZXIsXHJcblx0XHRwbmc6IENDUE5HRW5jb2RlcixcclxuXHRcdGpwZzogQ0NKUEVHRW5jb2RlcixcclxuXHRcdCd3ZWJtLW1lZGlhcmVjb3JkZXInOiBDQ1N0cmVhbUVuY29kZXJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIGN0b3IgPSBfZW5jb2RlcnNbIF9zZXR0aW5ncy5mb3JtYXQgXTtcclxuICAgIGlmICggIWN0b3IgKSB7XHJcblx0XHR0aHJvdyBcIkVycm9yOiBJbmNvcnJlY3Qgb3IgbWlzc2luZyBmb3JtYXQ6IFZhbGlkIGZvcm1hdHMgYXJlIFwiICsgT2JqZWN0LmtleXMoX2VuY29kZXJzKS5qb2luKFwiLCBcIik7XHJcbiAgICB9XHJcbiAgICBfZW5jb2RlciA9IG5ldyBjdG9yKCBfc2V0dGluZ3MgKTtcclxuICAgIF9lbmNvZGVyLnN0ZXAgPSBfc3RlcFxyXG5cclxuXHRfZW5jb2Rlci5vbigncHJvY2VzcycsIF9wcm9jZXNzKTtcclxuICAgIF9lbmNvZGVyLm9uKCdwcm9ncmVzcycsIF9wcm9ncmVzcyk7XHJcblxyXG4gICAgaWYgKFwicGVyZm9ybWFuY2VcIiBpbiB3aW5kb3cgPT0gZmFsc2UpIHtcclxuICAgIFx0d2luZG93LnBlcmZvcm1hbmNlID0ge307XHJcbiAgICB9XHJcblxyXG5cdERhdGUubm93ID0gKERhdGUubm93IHx8IGZ1bmN0aW9uICgpIHsgIC8vIHRoYW5rcyBJRThcclxuXHRcdHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuXHR9KTtcclxuXHJcblx0aWYgKFwibm93XCIgaW4gd2luZG93LnBlcmZvcm1hbmNlID09IGZhbHNlKXtcclxuXHJcblx0XHR2YXIgbm93T2Zmc2V0ID0gRGF0ZS5ub3coKTtcclxuXHJcblx0XHRpZiAocGVyZm9ybWFuY2UudGltaW5nICYmIHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQpe1xyXG5cdFx0XHRub3dPZmZzZXQgPSBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0XHJcblx0XHR9XHJcblxyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uIG5vdygpe1xyXG5cdFx0XHRyZXR1cm4gRGF0ZS5ub3coKSAtIG5vd09mZnNldDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciBfb2xkU2V0VGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0LFxyXG5cdFx0X29sZFNldEludGVydmFsID0gd2luZG93LnNldEludGVydmFsLFxyXG5cdCAgICBcdF9vbGRDbGVhckludGVydmFsID0gd2luZG93LmNsZWFySW50ZXJ2YWwsXHJcblx0XHRfb2xkQ2xlYXJUaW1lb3V0ID0gd2luZG93LmNsZWFyVGltZW91dCxcclxuXHRcdF9vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxyXG5cdFx0X29sZE5vdyA9IHdpbmRvdy5EYXRlLm5vdyxcclxuXHRcdF9vbGRQZXJmb3JtYW5jZU5vdyA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3csXHJcblx0XHRfb2xkR2V0VGltZSA9IHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lO1xyXG5cdC8vIERhdGUucHJvdG90eXBlLl9vbGRHZXRUaW1lID0gRGF0ZS5wcm90b3R5cGUuZ2V0VGltZTtcclxuXHJcblx0dmFyIG1lZGlhID0gW107XHJcblxyXG5cdGZ1bmN0aW9uIF9pbml0KCkge1xyXG5cclxuXHRcdF9sb2coICdDYXB0dXJlciBzdGFydCcgKTtcclxuXHJcblx0XHRfc3RhcnRUaW1lID0gd2luZG93LkRhdGUubm93KCk7XHJcblx0XHRfdGltZSA9IF9zdGFydFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cdFx0X3BlcmZvcm1hbmNlU3RhcnRUaW1lID0gd2luZG93LnBlcmZvcm1hbmNlLm5vdygpO1xyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSA9IF9wZXJmb3JtYW5jZVN0YXJ0VGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblxyXG5cdFx0d2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWUgPSBmdW5jdGlvbigpe1xyXG5cdFx0XHRyZXR1cm4gX3RpbWU7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LkRhdGUubm93ID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdHJldHVybiBfdGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0d2luZG93LnNldFRpbWVvdXQgPSBmdW5jdGlvbiggY2FsbGJhY2ssIHRpbWUgKSB7XHJcblx0XHRcdHZhciB0ID0ge1xyXG5cdFx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0XHR0aW1lOiB0aW1lLFxyXG5cdFx0XHRcdHRyaWdnZXJUaW1lOiBfdGltZSArIHRpbWVcclxuXHRcdFx0fTtcclxuXHRcdFx0X3RpbWVvdXRzLnB1c2goIHQgKTtcclxuXHRcdFx0X2xvZyggJ1RpbWVvdXQgc2V0IHRvICcgKyB0LnRpbWUgKTtcclxuICAgICAgICAgICAgcmV0dXJuIHQ7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCA9IGZ1bmN0aW9uKCBpZCApIHtcclxuXHRcdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfdGltZW91dHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdFx0aWYoIF90aW1lb3V0c1sgaiBdID09IGlkICkge1xyXG5cdFx0XHRcdFx0X3RpbWVvdXRzLnNwbGljZSggaiwgMSApO1xyXG5cdFx0XHRcdFx0X2xvZyggJ1RpbWVvdXQgY2xlYXJlZCcgKTtcclxuXHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uKCBjYWxsYmFjaywgdGltZSApIHtcclxuXHRcdFx0dmFyIHQgPSB7XHJcblx0XHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxyXG5cdFx0XHRcdHRpbWU6IHRpbWUsXHJcblx0XHRcdFx0dHJpZ2dlclRpbWU6IF90aW1lICsgdGltZVxyXG5cdFx0XHR9O1xyXG5cdFx0XHRfaW50ZXJ2YWxzLnB1c2goIHQgKTtcclxuXHRcdFx0X2xvZyggJ0ludGVydmFsIHNldCB0byAnICsgdC50aW1lICk7XHJcblx0XHRcdHJldHVybiB0O1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5jbGVhckludGVydmFsID0gZnVuY3Rpb24oIGlkICkge1xyXG5cdFx0XHRfbG9nKCAnY2xlYXIgSW50ZXJ2YWwnICk7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblx0XHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MucHVzaCggY2FsbGJhY2sgKTtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0cmV0dXJuIF9wZXJmb3JtYW5jZVRpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdGZ1bmN0aW9uIGhvb2tDdXJyZW50VGltZSgpIHtcclxuXHRcdFx0aWYoICF0aGlzLl9ob29rZWQgKSB7XHJcblx0XHRcdFx0dGhpcy5faG9va2VkID0gdHJ1ZTtcclxuXHRcdFx0XHR0aGlzLl9ob29rZWRUaW1lID0gdGhpcy5jdXJyZW50VGltZSB8fCAwO1xyXG5cdFx0XHRcdHRoaXMucGF1c2UoKTtcclxuXHRcdFx0XHRtZWRpYS5wdXNoKCB0aGlzICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHRoaXMuX2hvb2tlZFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIEhUTUxWaWRlb0VsZW1lbnQucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7IGdldDogaG9va0N1cnJlbnRUaW1lIH0gKVxyXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIEhUTUxBdWRpb0VsZW1lbnQucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7IGdldDogaG9va0N1cnJlbnRUaW1lIH0gKVxyXG5cdFx0fSBjYXRjaCAoZXJyKSB7XHJcblx0XHRcdF9sb2coZXJyKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RhcnQoKSB7XHJcblx0XHRfaW5pdCgpO1xyXG5cdFx0X2VuY29kZXIuc3RhcnQoKTtcclxuXHRcdF9jYXB0dXJpbmcgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0b3AoKSB7XHJcblx0XHRfY2FwdHVyaW5nID0gZmFsc2U7XHJcblx0XHRfZW5jb2Rlci5zdG9wKCk7XHJcblx0XHRfZGVzdHJveSgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NhbGwoIGZuLCBwICkge1xyXG5cdFx0X29sZFNldFRpbWVvdXQoIGZuLCAwLCBwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RlcCgpIHtcclxuXHRcdC8vX29sZFJlcXVlc3RBbmltYXRpb25GcmFtZSggX3Byb2Nlc3MgKTtcclxuXHRcdF9jYWxsKCBfcHJvY2VzcyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2Rlc3Ryb3koKSB7XHJcblx0XHRfbG9nKCAnQ2FwdHVyZXIgc3RvcCcgKTtcclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0ID0gX29sZFNldFRpbWVvdXQ7XHJcblx0XHR3aW5kb3cuc2V0SW50ZXJ2YWwgPSBfb2xkU2V0SW50ZXJ2YWw7XHJcblx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCA9IF9vbGRDbGVhckludGVydmFsO1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCA9IF9vbGRDbGVhclRpbWVvdXQ7XHJcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gX29sZFJlcXVlc3RBbmltYXRpb25GcmFtZTtcclxuXHRcdHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lID0gX29sZEdldFRpbWU7XHJcblx0XHR3aW5kb3cuRGF0ZS5ub3cgPSBfb2xkTm93O1xyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IF9vbGRQZXJmb3JtYW5jZU5vdztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF91cGRhdGVUaW1lKCkge1xyXG5cdFx0dmFyIHNlY29uZHMgPSBfZnJhbWVDb3VudCAvIF9zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0XHRpZiggKCBfc2V0dGluZ3MuZnJhbWVMaW1pdCAmJiBfZnJhbWVDb3VudCA+PSBfc2V0dGluZ3MuZnJhbWVMaW1pdCApIHx8ICggX3NldHRpbmdzLnRpbWVMaW1pdCAmJiBzZWNvbmRzID49IF9zZXR0aW5ncy50aW1lTGltaXQgKSApIHtcclxuXHRcdFx0X3N0b3AoKTtcclxuXHRcdFx0X3NhdmUoKTtcclxuXHRcdH1cclxuXHRcdHZhciBkID0gbmV3IERhdGUoIG51bGwgKTtcclxuXHRcdGQuc2V0U2Vjb25kcyggc2Vjb25kcyApO1xyXG5cdFx0aWYoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID4gMiApIHtcclxuXHRcdFx0X3RpbWVEaXNwbGF5LnRleHRDb250ZW50ID0gJ0NDYXB0dXJlICcgKyBfc2V0dGluZ3MuZm9ybWF0ICsgJyB8ICcgKyBfZnJhbWVDb3VudCArICcgZnJhbWVzICgnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKyAnIGludGVyKSB8ICcgKyAgZC50b0lTT1N0cmluZygpLnN1YnN0ciggMTEsIDggKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdF90aW1lRGlzcGxheS50ZXh0Q29udGVudCA9ICdDQ2FwdHVyZSAnICsgX3NldHRpbmdzLmZvcm1hdCArICcgfCAnICsgX2ZyYW1lQ291bnQgKyAnIGZyYW1lcyB8ICcgKyAgZC50b0lTT1N0cmluZygpLnN1YnN0ciggMTEsIDggKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jaGVja0ZyYW1lKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0aWYoIGNhbnZhc01vdGlvbkJsdXIud2lkdGggIT09IGNhbnZhcy53aWR0aCB8fCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCAhPT0gY2FudmFzLmhlaWdodCApIHtcclxuXHRcdFx0Y2FudmFzTW90aW9uQmx1ci53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHRcdFx0Y2FudmFzTW90aW9uQmx1ci5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyID0gbmV3IFVpbnQxNkFycmF5KCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCAqIGNhbnZhc01vdGlvbkJsdXIud2lkdGggKiA0ICk7XHJcblx0XHRcdGN0eE1vdGlvbkJsdXIuZmlsbFN0eWxlID0gJyMwJ1xyXG5cdFx0XHRjdHhNb3Rpb25CbHVyLmZpbGxSZWN0KCAwLCAwLCBjYW52YXNNb3Rpb25CbHVyLndpZHRoLCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCApO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9ibGVuZEZyYW1lKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0Ly9fbG9nKCAnSW50ZXJtZWRpYXRlIEZyYW1lOiAnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKTtcclxuXHJcblx0XHRjdHhNb3Rpb25CbHVyLmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblx0XHRpbWFnZURhdGEgPSBjdHhNb3Rpb25CbHVyLmdldEltYWdlRGF0YSggMCwgMCwgY2FudmFzTW90aW9uQmx1ci53aWR0aCwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogXTtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSArPSBpbWFnZURhdGEuZGF0YVsgaiArIDEgXTtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSArPSBpbWFnZURhdGEuZGF0YVsgaiArIDIgXTtcclxuXHRcdH1cclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50Kys7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3NhdmVGcmFtZSgpe1xyXG5cclxuXHRcdHZhciBkYXRhID0gaW1hZ2VEYXRhLmRhdGE7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0ZGF0YVsgaiBdID0gYnVmZmVyTW90aW9uQmx1clsgaiBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0XHRkYXRhWyBqICsgMSBdID0gYnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdFx0ZGF0YVsgaiArIDIgXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHR9XHJcblx0XHRjdHhNb3Rpb25CbHVyLnB1dEltYWdlRGF0YSggaW1hZ2VEYXRhLCAwLCAwICk7XHJcblx0XHRfZW5jb2Rlci5hZGQoIGNhbnZhc01vdGlvbkJsdXIgKTtcclxuXHRcdF9mcmFtZUNvdW50Kys7XHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA9IDA7XHJcblx0XHRfbG9nKCAnRnVsbCBNQiBGcmFtZSEgJyArIF9mcmFtZUNvdW50ICsgJyAnICsgIF90aW1lICk7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiBdID0gMDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSA9IDA7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gPSAwO1xyXG5cdFx0fVxyXG5cdFx0Z2MoKTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2FwdHVyZSggY2FudmFzICkge1xyXG5cclxuXHRcdGlmKCBfY2FwdHVyaW5nICkge1xyXG5cclxuXHRcdFx0aWYoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID4gMiApIHtcclxuXHJcblx0XHRcdFx0X2NoZWNrRnJhbWUoIGNhbnZhcyApO1xyXG5cdFx0XHRcdF9ibGVuZEZyYW1lKCBjYW52YXMgKTtcclxuXHJcblx0XHRcdFx0aWYoIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID49IC41ICogX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgKSB7XHJcblx0XHRcdFx0XHRfc2F2ZUZyYW1lKCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdF9zdGVwKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRfZW5jb2Rlci5hZGQoIGNhbnZhcyApO1xyXG5cdFx0XHRcdF9mcmFtZUNvdW50Kys7XHJcblx0XHRcdFx0X2xvZyggJ0Z1bGwgRnJhbWUhICcgKyBfZnJhbWVDb3VudCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9wcm9jZXNzKCkge1xyXG5cclxuXHRcdHZhciBzdGVwID0gMTAwMCAvIF9zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0XHR2YXIgZHQgPSAoIF9mcmFtZUNvdW50ICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyApICogc3RlcDtcclxuXHJcblx0XHRfdGltZSA9IF9zdGFydFRpbWUgKyBkdDtcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUgPSBfcGVyZm9ybWFuY2VTdGFydFRpbWUgKyBkdDtcclxuXHJcblx0XHRtZWRpYS5mb3JFYWNoKCBmdW5jdGlvbiggdiApIHtcclxuXHRcdFx0di5faG9va2VkVGltZSA9IGR0IC8gMTAwMDtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRfdXBkYXRlVGltZSgpO1xyXG5cdFx0X2xvZyggJ0ZyYW1lOiAnICsgX2ZyYW1lQ291bnQgKyAnICcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCApO1xyXG5cclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgX3RpbWVvdXRzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRpZiggX3RpbWUgPj0gX3RpbWVvdXRzWyBqIF0udHJpZ2dlclRpbWUgKSB7XHJcblx0XHRcdFx0X2NhbGwoIF90aW1lb3V0c1sgaiBdLmNhbGxiYWNrIClcclxuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCAndGltZW91dCEnICk7XHJcblx0XHRcdFx0X3RpbWVvdXRzLnNwbGljZSggaiwgMSApO1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfaW50ZXJ2YWxzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRpZiggX3RpbWUgPj0gX2ludGVydmFsc1sgaiBdLnRyaWdnZXJUaW1lICkge1xyXG5cdFx0XHRcdF9jYWxsKCBfaW50ZXJ2YWxzWyBqIF0uY2FsbGJhY2sgKTtcclxuXHRcdFx0XHRfaW50ZXJ2YWxzWyBqIF0udHJpZ2dlclRpbWUgKz0gX2ludGVydmFsc1sgaiBdLnRpbWU7XHJcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggJ2ludGVydmFsIScgKTtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MuZm9yRWFjaCggZnVuY3Rpb24oIGNiICkge1xyXG4gICAgIFx0XHRfY2FsbCggY2IsIF90aW1lIC0gZ19zdGFydFRpbWUgKTtcclxuICAgICAgICB9ICk7XHJcbiAgICAgICAgX3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcyA9IFtdO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zYXZlKCBjYWxsYmFjayApIHtcclxuXHJcblx0XHRpZiggIWNhbGxiYWNrICkge1xyXG5cdFx0XHRjYWxsYmFjayA9IGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0XHRcdGRvd25sb2FkKCBibG9iLCBfZW5jb2Rlci5maWxlbmFtZSArIF9lbmNvZGVyLmV4dGVuc2lvbiwgX2VuY29kZXIubWltZVR5cGUgKTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdF9lbmNvZGVyLnNhdmUoIGNhbGxiYWNrICk7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2xvZyggbWVzc2FnZSApIHtcclxuXHRcdGlmKCBfdmVyYm9zZSApIGNvbnNvbGUubG9nKCBtZXNzYWdlICk7XHJcblx0fVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbiggZXZlbnQsIGhhbmRsZXIgKSB7XHJcblxyXG4gICAgICAgIF9oYW5kbGVyc1tldmVudF0gPSBoYW5kbGVyO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZW1pdCggZXZlbnQgKSB7XHJcblxyXG4gICAgICAgIHZhciBoYW5kbGVyID0gX2hhbmRsZXJzW2V2ZW50XTtcclxuICAgICAgICBpZiAoIGhhbmRsZXIgKSB7XHJcblxyXG4gICAgICAgICAgICBoYW5kbGVyLmFwcGx5KCBudWxsLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggYXJndW1lbnRzLCAxICkgKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfcHJvZ3Jlc3MoIHByb2dyZXNzICkge1xyXG5cclxuICAgICAgICBfZW1pdCggJ3Byb2dyZXNzJywgcHJvZ3Jlc3MgKTtcclxuXHJcbiAgICB9XHJcblxyXG5cdHJldHVybiB7XHJcblx0XHRzdGFydDogX3N0YXJ0LFxyXG5cdFx0Y2FwdHVyZTogX2NhcHR1cmUsXHJcblx0XHRzdG9wOiBfc3RvcCxcclxuXHRcdHNhdmU6IF9zYXZlLFxyXG4gICAgICAgIG9uOiBfb25cclxuXHR9XHJcbn1cclxuXHJcbihmcmVlV2luZG93IHx8IGZyZWVTZWxmIHx8IHt9KS5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG5cclxuICAvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzIGxpa2Ugci5qcyBjaGVjayBmb3IgY29uZGl0aW9uIHBhdHRlcm5zIGxpa2UgdGhlIGZvbGxvd2luZzpcclxuICBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcclxuICAgIC8vIERlZmluZSBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlIHNvLCB0aHJvdWdoIHBhdGggbWFwcGluZywgaXQgY2FuIGJlXHJcbiAgICAvLyByZWZlcmVuY2VkIGFzIHRoZSBcInVuZGVyc2NvcmVcIiBtb2R1bGUuXHJcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XHJcbiAgICBcdHJldHVybiBDQ2FwdHVyZTtcclxuICAgIH0pO1xyXG59XHJcbiAgLy8gQ2hlY2sgZm9yIGBleHBvcnRzYCBhZnRlciBgZGVmaW5lYCBpbiBjYXNlIGEgYnVpbGQgb3B0aW1pemVyIGFkZHMgYW4gYGV4cG9ydHNgIG9iamVjdC5cclxuICBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlKSB7XHJcbiAgICAvLyBFeHBvcnQgZm9yIE5vZGUuanMuXHJcbiAgICBpZiAobW9kdWxlRXhwb3J0cykge1xyXG4gICAgXHQoZnJlZU1vZHVsZS5leHBvcnRzID0gQ0NhcHR1cmUpLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbiAgICB9XHJcbiAgICAvLyBFeHBvcnQgZm9yIENvbW1vbkpTIHN1cHBvcnQuXHJcbiAgICBmcmVlRXhwb3J0cy5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG59XHJcbmVsc2Uge1xyXG4gICAgLy8gRXhwb3J0IHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxyXG4gICAgcm9vdC5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG59XHJcblxyXG59KCkpO1xyXG4iLCIvKipcbiAqIEBhdXRob3IgYWx0ZXJlZHEgLyBodHRwOi8vYWx0ZXJlZHF1YWxpYS5jb20vXG4gKiBAYXV0aG9yIG1yLmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbS9cbiAqL1xuXG52YXIgRGV0ZWN0b3IgPSB7XG5cblx0Y2FudmFzOiAhISB3aW5kb3cuQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuXHR3ZWJnbDogKCBmdW5jdGlvbiAoKSB7XG5cblx0XHR0cnkge1xuXG5cdFx0XHR2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTsgcmV0dXJuICEhICggd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCAmJiAoIGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICkgfHwgY2FudmFzLmdldENvbnRleHQoICdleHBlcmltZW50YWwtd2ViZ2wnICkgKSApO1xuXG5cdFx0fSBjYXRjaCAoIGUgKSB7XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblxuXHRcdH1cblxuXHR9ICkoKSxcblx0d29ya2VyczogISEgd2luZG93Lldvcmtlcixcblx0ZmlsZWFwaTogd2luZG93LkZpbGUgJiYgd2luZG93LkZpbGVSZWFkZXIgJiYgd2luZG93LkZpbGVMaXN0ICYmIHdpbmRvdy5CbG9iLFxuXG5cdGdldFdlYkdMRXJyb3JNZXNzYWdlOiBmdW5jdGlvbiAoKSB7XG5cblx0XHR2YXIgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0ZWxlbWVudC5pZCA9ICd3ZWJnbC1lcnJvci1tZXNzYWdlJztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRTaXplID0gJzEzcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9ICdub3JtYWwnO1xuXHRcdGVsZW1lbnQuc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XG5cdFx0ZWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kID0gJyNmZmYnO1xuXHRcdGVsZW1lbnQuc3R5bGUuY29sb3IgPSAnIzAwMCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5wYWRkaW5nID0gJzEuNWVtJztcblx0XHRlbGVtZW50LnN0eWxlLnpJbmRleCA9ICc5OTknO1xuXHRcdGVsZW1lbnQuc3R5bGUud2lkdGggPSAnNDAwcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUubWFyZ2luID0gJzVlbSBhdXRvIDAnO1xuXG5cdFx0aWYgKCAhIHRoaXMud2ViZ2wgKSB7XG5cblx0XHRcdGVsZW1lbnQuaW5uZXJIVE1MID0gd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCA/IFtcblx0XHRcdFx0J1lvdXIgZ3JhcGhpY3MgY2FyZCBkb2VzIG5vdCBzZWVtIHRvIHN1cHBvcnQgPGEgaHJlZj1cImh0dHA6Ly9raHJvbm9zLm9yZy93ZWJnbC93aWtpL0dldHRpbmdfYV9XZWJHTF9JbXBsZW1lbnRhdGlvblwiIHN0eWxlPVwiY29sb3I6IzAwMFwiPldlYkdMPC9hPi48YnIgLz4nLFxuXHRcdFx0XHQnRmluZCBvdXQgaG93IHRvIGdldCBpdCA8YSBocmVmPVwiaHR0cDovL2dldC53ZWJnbC5vcmcvXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+aGVyZTwvYT4uJ1xuXHRcdFx0XS5qb2luKCAnXFxuJyApIDogW1xuXHRcdFx0XHQnWW91ciBicm93c2VyIGRvZXMgbm90IHNlZW0gdG8gc3VwcG9ydCA8YSBocmVmPVwiaHR0cDovL2tocm9ub3Mub3JnL3dlYmdsL3dpa2kvR2V0dGluZ19hX1dlYkdMX0ltcGxlbWVudGF0aW9uXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+V2ViR0w8L2E+Ljxici8+Jyxcblx0XHRcdFx0J0ZpbmQgb3V0IGhvdyB0byBnZXQgaXQgPGEgaHJlZj1cImh0dHA6Ly9nZXQud2ViZ2wub3JnL1wiIHN0eWxlPVwiY29sb3I6IzAwMFwiPmhlcmU8L2E+Lidcblx0XHRcdF0uam9pbiggJ1xcbicgKTtcblxuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50O1xuXG5cdH0sXG5cblx0YWRkR2V0V2ViR0xNZXNzYWdlOiBmdW5jdGlvbiAoIHBhcmFtZXRlcnMgKSB7XG5cblx0XHR2YXIgcGFyZW50LCBpZCwgZWxlbWVudDtcblxuXHRcdHBhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzIHx8IHt9O1xuXG5cdFx0cGFyZW50ID0gcGFyYW1ldGVycy5wYXJlbnQgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMucGFyZW50IDogZG9jdW1lbnQuYm9keTtcblx0XHRpZCA9IHBhcmFtZXRlcnMuaWQgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMuaWQgOiAnb2xkaWUnO1xuXG5cdFx0ZWxlbWVudCA9IERldGVjdG9yLmdldFdlYkdMRXJyb3JNZXNzYWdlKCk7XG5cdFx0ZWxlbWVudC5pZCA9IGlkO1xuXG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKCBlbGVtZW50ICk7XG5cblx0fVxuXG59O1xuXG4vL0VTNiBleHBvcnRcblxuZXhwb3J0IHsgRGV0ZWN0b3IgfTtcbiIsIi8vVGhpcyBsaWJyYXJ5IGlzIGRlc2lnbmVkIHRvIGhlbHAgc3RhcnQgdGhyZWUuanMgZWFzaWx5LCBjcmVhdGluZyB0aGUgcmVuZGVyIGxvb3AgYW5kIGNhbnZhcyBhdXRvbWFnaWNhbGx5LlxuLy9SZWFsbHkgaXQgc2hvdWxkIGJlIHNwdW4gb2ZmIGludG8gaXRzIG93biB0aGluZyBpbnN0ZWFkIG9mIGJlaW5nIHBhcnQgb2YgZXhwbGFuYXJpYS5cblxuLy9hbHNvLCBjaGFuZ2UgVGhyZWVhc3lfRW52aXJvbm1lbnQgdG8gVGhyZWVhc3lfUmVjb3JkZXIgdG8gZG93bmxvYWQgaGlnaC1xdWFsaXR5IGZyYW1lcyBvZiBhbiBhbmltYXRpb25cblxuaW1wb3J0IENDYXB0dXJlIGZyb20gJ2NjYXB0dXJlLmpzJztcbmltcG9ydCB7IERldGVjdG9yIH0gZnJvbSAnLi4vbGliL1dlYkdMX0RldGVjdG9yLmpzJztcbmltcG9ydCB7IHNldFRocmVlRW52aXJvbm1lbnQsIGdldFRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5mdW5jdGlvbiBUaHJlZWFzeUVudmlyb25tZW50KGNhbnZhc0VsZW0gPSBudWxsKXtcblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gMDtcbiAgICB0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyA9IChjYW52YXNFbGVtID09PSBudWxsKTtcblxuXHRpZighRGV0ZWN0b3Iud2ViZ2wpRGV0ZWN0b3IuYWRkR2V0V2ViR0xNZXNzYWdlKCk7XG5cbiAgICAvL2ZvdiwgYXNwZWN0LCBuZWFyLCBmYXJcblx0dGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoIDcwLCB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgMC4xLCAxMDAwMDAwMCApO1xuXHQvL3RoaXMuY2FtZXJhID0gbmV3IFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYSggNzAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDEwICk7XG5cblx0dGhpcy5jYW1lcmEucG9zaXRpb24uc2V0KDAsIDAsIDEwKTtcblx0dGhpcy5jYW1lcmEubG9va0F0KG5ldyBUSFJFRS5WZWN0b3IzKDAsMCwwKSk7XG5cblxuXHQvL2NyZWF0ZSBjYW1lcmEsIHNjZW5lLCB0aW1lciwgcmVuZGVyZXIgb2JqZWN0c1xuXHQvL2NyYWV0ZSByZW5kZXIgb2JqZWN0XG5cblxuXHRcblx0dGhpcy5zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xuXHR0aGlzLnNjZW5lLmFkZCh0aGlzLmNhbWVyYSk7XG5cblx0Ly9yZW5kZXJlclxuXHRsZXQgcmVuZGVyZXJPcHRpb25zID0geyBhbHBoYTogdHJ1ZSwgYW50aWFsaWFzOiB0cnVlfTtcblxuICAgIGlmKCF0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyl7XG4gICAgICAgIHJlbmRlcmVyT3B0aW9ucy5jYW52YXMgPSBjYW52YXNFbGVtO1xuICAgIH1cblxuXHR0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoIHJlbmRlcmVyT3B0aW9ucyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldFBpeGVsUmF0aW8oIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvICk7XG5cdHRoaXMucmVuZGVyZXIuc2V0Q2xlYXJDb2xvcihuZXcgVEhSRUUuQ29sb3IoMHhGRkZGRkYpLCAxLjApO1xuXG5cbiAgICB0aGlzLnJlc2l6ZUNhbnZhc0lmTmVjZXNzYXJ5KCk7IC8vcmVzaXplIGNhbnZhcyB0byB3aW5kb3cgc2l6ZSBhbmQgc2V0IGFzcGVjdCByYXRpb1xuXHQvKlxuXHR0aGlzLnJlbmRlcmVyLmdhbW1hSW5wdXQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLmdhbW1hT3V0cHV0ID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci5zaGFkb3dNYXAuZW5hYmxlZCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIudnIuZW5hYmxlZCA9IHRydWU7XG5cdCovXG5cblx0dGhpcy50aW1lU2NhbGUgPSAxO1xuXHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblx0dGhpcy50cnVlRWxhcHNlZFRpbWUgPSAwO1xuXG4gICAgaWYodGhpcy5zaG91bGRDcmVhdGVDYW52YXMpe1xuXHQgICAgdGhpcy5jb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHQgICAgdGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQoIHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCApO1xuICAgIH1cblxuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIHRoaXMub25Nb3VzZURvd24uYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZXVwJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaHN0YXJ0JywgdGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoZW5kJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblxuXHQvKlxuXHQvL3JlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlOyBcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd2cmRpc3BsYXlwb2ludGVycmVzdHJpY3RlZCcsIG9uUG9pbnRlclJlc3RyaWN0ZWQsIGZhbHNlICk7XG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cG9pbnRlcnVucmVzdHJpY3RlZCcsIG9uUG9pbnRlclVucmVzdHJpY3RlZCwgZmFsc2UgKTtcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggV0VCVlIuY3JlYXRlQnV0dG9uKCByZW5kZXJlciApICk7XG5cdCovXG5cblxuXG5cdHRoaXMuY2xvY2sgPSBuZXcgVEhSRUUuQ2xvY2soKTtcblxuXHR0aGlzLklTX1JFQ09SRElORyA9IGZhbHNlOyAvLyBxdWVyeWFibGUgaWYgb25lIHdhbnRzIHRvIGRvIHRoaW5ncyBsaWtlIGJlZWYgdXAgcGFydGljbGUgY291bnRzIGZvciByZW5kZXJcblxuICAgIC8vSWYgdGhlIGNhbnZhc0VsZW1lbnQgaXMgYWxyZWFkeSBsb2FkZWQsIHRoZW4gdGhlICdsb2FkJyBldmVudCBoYXMgYWxyZWFkeSBmaXJlZC4gV2UgbmVlZCB0byB0cmlnZ2VyIGl0IG91cnNlbHZlcy5cbiAgICBpZihkb2N1bWVudC5yZWFkeVN0YXRlID09IFwibG9hZGluZ1wiKXtcblx0ICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgdGhpcy5vblBhZ2VMb2FkLmJpbmQodGhpcyksIGZhbHNlKTsgIFxuICAgIH1lbHNle1xuICAgICAgICB0aGlzLm9uUGFnZUxvYWQoKTtcbiAgICB9XG59XG5cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUGFnZUxvYWQgPSBmdW5jdGlvbigpIHtcblx0Y29uc29sZS5sb2coXCJUaHJlZWFzeV9TZXR1cCBsb2FkZWQhXCIpO1xuXHRpZih0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyl7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggdGhpcy5jb250YWluZXIgKTtcblx0fVxuXG5cdHRoaXMuc3RhcnQoKTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKXtcblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cdHRoaXMuY2xvY2suc3RhcnQoKTtcblx0dGhpcy5yZW5kZXIodGhpcy5wcmV2X3RpbWVzdGVwKTtcbn1cblxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Nb3VzZURvd24gPSBmdW5jdGlvbigpIHtcblx0dGhpcy5pc01vdXNlRG93biA9IHRydWU7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbk1vdXNlVXA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmlzTW91c2VEb3duID0gZmFsc2U7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vblBvaW50ZXJSZXN0cmljdGVkPSBmdW5jdGlvbigpIHtcblx0dmFyIHBvaW50ZXJMb2NrRWxlbWVudCA9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudDtcblx0aWYgKCBwb2ludGVyTG9ja0VsZW1lbnQgJiYgdHlwZW9mKHBvaW50ZXJMb2NrRWxlbWVudC5yZXF1ZXN0UG9pbnRlckxvY2spID09PSAnZnVuY3Rpb24nICkge1xuXHRcdHBvaW50ZXJMb2NrRWxlbWVudC5yZXF1ZXN0UG9pbnRlckxvY2soKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Qb2ludGVyVW5yZXN0cmljdGVkPSBmdW5jdGlvbigpIHtcblx0dmFyIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgPSBkb2N1bWVudC5wb2ludGVyTG9ja0VsZW1lbnQ7XG5cdHZhciBleHBlY3RlZFBvaW50ZXJMb2NrRWxlbWVudCA9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudDtcblx0aWYgKCBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ICYmIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgPT09IGV4cGVjdGVkUG9pbnRlckxvY2tFbGVtZW50ICYmIHR5cGVvZihkb2N1bWVudC5leGl0UG9pbnRlckxvY2spID09PSAnZnVuY3Rpb24nICkge1xuXHRcdGRvY3VtZW50LmV4aXRQb2ludGVyTG9jaygpO1xuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5ldmVuaWZ5ID0gZnVuY3Rpb24oeCl7XG5cdGlmKHggJSAyID09IDEpe1xuXHRcdHJldHVybiB4KzE7XG5cdH1cblx0cmV0dXJuIHg7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZXNpemVDYW52YXNJZk5lY2Vzc2FyeT0gZnVuY3Rpb24oKSB7XG4gICAgLy9odHRwczovL3dlYmdsMmZ1bmRhbWVudGFscy5vcmcvd2ViZ2wvbGVzc29ucy93ZWJnbC1hbnRpLXBhdHRlcm5zLmh0bWwgeWVzLCBldmVyeSBmcmFtZS5cbiAgICAvL3RoaXMgaGFuZGxlcyB0aGUgZWRnZSBjYXNlIHdoZXJlIHRoZSBjYW52YXMgc2l6ZSBjaGFuZ2VzIGJ1dCB0aGUgd2luZG93IHNpemUgZG9lc24ndFxuXG4gICAgbGV0IHdpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG4gICAgbGV0IGhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICBcbiAgICBpZighdGhpcy5zaG91bGRDcmVhdGVDYW52YXMpeyAvLyBhIGNhbnZhcyB3YXMgcHJvdmlkZWQgZXh0ZXJuYWxseVxuICAgICAgICB3aWR0aCA9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5jbGllbnRXaWR0aDtcbiAgICAgICAgaGVpZ2h0ID0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmNsaWVudEhlaWdodDtcbiAgICB9XG5cbiAgICBpZih3aWR0aCAhPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQud2lkdGggfHwgaGVpZ2h0ICE9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5oZWlnaHQpe1xuICAgICAgICAvL2NhbnZhcyBkaW1lbnNpb25zIGNoYW5nZWQsIHVwZGF0ZSB0aGUgaW50ZXJuYWwgcmVzb2x1dGlvblxuXG5cdCAgICB0aGlzLmNhbWVyYS5hc3BlY3QgPSB3aWR0aCAvIGhlaWdodDtcbiAgICAgICAgLy90aGlzLmNhbWVyYS5zZXRGb2NhbExlbmd0aCgzMCk7IC8vaWYgSSB1c2UgdGhpcywgdGhlIGNhbWVyYSB3aWxsIGtlZXAgYSBjb25zdGFudCB3aWR0aCBpbnN0ZWFkIG9mIGNvbnN0YW50IGhlaWdodFxuXHQgICAgdGhpcy5hc3BlY3QgPSB0aGlzLmNhbWVyYS5hc3BlY3Q7XG5cdCAgICB0aGlzLmNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG5cdCAgICB0aGlzLnJlbmRlcmVyLnNldFNpemUoIHRoaXMuZXZlbmlmeSh3aWR0aCksIHRoaXMuZXZlbmlmeShoZWlnaHQpLHRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzICk7XG4gICAgfVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUubGlzdGVuZXJzID0ge1widXBkYXRlXCI6IFtdLFwicmVuZGVyXCI6W119OyAvL3VwZGF0ZSBldmVudCBsaXN0ZW5lcnNcblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKHRpbWVzdGVwKXtcbiAgICB0aGlzLnJlc2l6ZUNhbnZhc0lmTmVjZXNzYXJ5KCk7XG5cbiAgICB2YXIgcmVhbHRpbWVEZWx0YSA9IHRoaXMuY2xvY2suZ2V0RGVsdGEoKTtcblx0dmFyIGRlbHRhID0gcmVhbHRpbWVEZWx0YSp0aGlzLnRpbWVTY2FsZTtcblx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcbiAgICB0aGlzLnRydWVFbGFwc2VkVGltZSArPSByZWFsdGltZURlbHRhO1xuXHQvL2dldCB0aW1lc3RlcFxuXHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmxlbmd0aDtpKyspe1xuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YSwncmVhbHRpbWVEZWx0YSc6cmVhbHRpbWVEZWx0YX0pO1xuXHR9XG5cblx0dGhpcy5yZW5kZXJlci5yZW5kZXIoIHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhICk7XG5cblx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXVtpXSgpO1xuXHR9XG5cblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gdGltZXN0ZXA7XG5cdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50X25hbWUsIGZ1bmMpe1xuXHQvL1JlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lci5cblx0Ly9lYWNoIGxpc3RlbmVyIHdpbGwgYmUgY2FsbGVkIHdpdGggYW4gb2JqZWN0IGNvbnNpc3Rpbmcgb2Y6XG5cdC8vXHR7dDogPGN1cnJlbnQgdGltZSBpbiBzPiwgXCJkZWx0YVwiOiA8ZGVsdGEsIGluIG1zPn1cblx0Ly8gYW4gdXBkYXRlIGV2ZW50IGZpcmVzIGJlZm9yZSBhIHJlbmRlci4gYSByZW5kZXIgZXZlbnQgZmlyZXMgcG9zdC1yZW5kZXIuXG5cdGlmKGV2ZW50X25hbWUgPT0gXCJ1cGRhdGVcIil7IFxuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLnB1c2goZnVuYyk7XG5cdH1lbHNlIGlmKGV2ZW50X25hbWUgPT0gXCJyZW5kZXJcIil7IFxuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLnB1c2goZnVuYyk7XG5cdH1lbHNle1xuXHRcdGNvbnNvbGUuZXJyb3IoXCJJbnZhbGlkIGV2ZW50IG5hbWUhXCIpXG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbihldmVudF9uYW1lLCBmdW5jKXtcblx0Ly9VbnJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciwgdW5kb2luZyBhbiBUaHJlZWFzeV9zZXR1cC5vbigpIGV2ZW50IGxpc3RlbmVyLlxuXHQvL3RoZSBuYW1pbmcgc2NoZW1lIG1pZ2h0IG5vdCBiZSB0aGUgYmVzdCBoZXJlLlxuXHRpZihldmVudF9uYW1lID09IFwidXBkYXRlXCIpeyBcblx0XHRsZXQgaW5kZXggPSB0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5pbmRleE9mKGZ1bmMpO1xuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLnNwbGljZShpbmRleCwxKTtcblx0fSBlbHNlIGlmKGV2ZW50X25hbWUgPT0gXCJyZW5kZXJcIil7IFxuXHRcdGxldCBpbmRleCA9IHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLmluZGV4T2YoZnVuYyk7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0uc3BsaWNlKGluZGV4LDEpO1xuXHR9ZWxzZXtcblx0XHRjb25zb2xlLmVycm9yKFwiTm9uZXhpc3RlbnQgZXZlbnQgbmFtZSFcIilcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub2ZmID0gVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lcjsgLy9hbGlhcyB0byBtYXRjaCBUaHJlZWFzeUVudmlyb25tZW50Lm9uXG5cbmNsYXNzIFRocmVlYXN5UmVjb3JkZXIgZXh0ZW5kcyBUaHJlZWFzeUVudmlyb25tZW50e1xuXHQvL2Jhc2VkIG9uIGh0dHA6Ly93d3cudHlzb25jYWRlbmhlYWQuY29tL2Jsb2cvZXhwb3J0aW5nLWNhbnZhcy1hbmltYXRpb24tdG8tbW92LyB0byByZWNvcmQgYW4gYW5pbWF0aW9uXG5cdC8vd2hlbiBkb25lLCAgICAgZmZtcGVnIC1yIDYwIC1mcmFtZXJhdGUgNjAgLWkgLi8lMDdkLnBuZyAtdmNvZGVjIGxpYngyNjQgLXBpeF9mbXQgeXV2NDIwcCAtY3JmOnYgMCB2aWRlby5tcDRcbiAgICAvLyB0byBwZXJmb3JtIG1vdGlvbiBibHVyIG9uIGFuIG92ZXJzYW1wbGVkIHZpZGVvLCBmZm1wZWcgLWkgdmlkZW8ubXA0IC12ZiB0YmxlbmQ9YWxsX21vZGU9YXZlcmFnZSxmcmFtZXN0ZXA9MiB2aWRlbzIubXA0XG5cdC8vdGhlbiwgYWRkIHRoZSB5dXY0MjBwIHBpeGVscyAod2hpY2ggZm9yIHNvbWUgcmVhc29uIGlzbid0IGRvbmUgYnkgdGhlIHByZXYgY29tbWFuZCkgYnk6XG5cdC8vIGZmbXBlZyAtaSB2aWRlby5tcDQgLXZjb2RlYyBsaWJ4MjY0IC1waXhfZm10IHl1djQyMHAgLXN0cmljdCAtMiAtYWNvZGVjIGFhYyBmaW5pc2hlZF92aWRlby5tcDRcblx0Ly9jaGVjayB3aXRoIGZmbXBlZyAtaSBmaW5pc2hlZF92aWRlby5tcDRcblxuXHRjb25zdHJ1Y3RvcihmcHM9MzAsIGxlbmd0aCA9IDUsIGNhbnZhc0VsZW0gPSBudWxsKXtcblx0XHQvKiBmcHMgaXMgZXZpZGVudCwgYXV0b3N0YXJ0IGlzIGEgYm9vbGVhbiAoYnkgZGVmYXVsdCwgdHJ1ZSksIGFuZCBsZW5ndGggaXMgaW4gcy4qL1xuXHRcdHN1cGVyKGNhbnZhc0VsZW0pO1xuXHRcdHRoaXMuZnBzID0gZnBzO1xuXHRcdHRoaXMuZWxhcHNlZFRpbWUgPSAwO1xuXHRcdHRoaXMuZnJhbWVDb3VudCA9IGZwcyAqIGxlbmd0aDtcblx0XHR0aGlzLmZyYW1lc19yZW5kZXJlZCA9IDA7XG5cblx0XHR0aGlzLmNhcHR1cmVyID0gbmV3IENDYXB0dXJlKCB7XG5cdFx0XHRmcmFtZXJhdGU6IGZwcyxcblx0XHRcdGZvcm1hdDogJ3BuZycsXG5cdFx0XHRuYW1lOiBkb2N1bWVudC50aXRsZSxcblx0XHRcdC8vdmVyYm9zZTogdHJ1ZSxcblx0XHR9ICk7XG5cblx0XHR0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuXG5cdFx0dGhpcy5JU19SRUNPUkRJTkcgPSB0cnVlO1xuXHR9XG5cdHN0YXJ0KCl7XG5cdFx0Ly9tYWtlIGEgcmVjb3JkaW5nIHNpZ25cblx0XHR0aGlzLnJlY29yZGluZ19pY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLndpZHRoPVwiMjBweFwiXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5oZWlnaHQ9XCIyMHB4XCJcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLnRvcCA9ICcyMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmxlZnQgPSAnMjBweCc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnMTBweCc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmVkJztcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMucmVjb3JkaW5nX2ljb24pO1xuXG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS50b3AgPSAnMjBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUubGVmdCA9ICc1MHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5jb2xvciA9ICdibGFjayc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDI1NSwyNTUsMjU1LDAuMSknO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5mcmFtZUNvdW50ZXIpO1xuXG5cdFx0dGhpcy5jYXB0dXJlci5zdGFydCgpO1xuXHRcdHRoaXMucmVuZGVyaW5nID0gdHJ1ZTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cdHJlbmRlcih0aW1lc3RlcCl7XG4gICAgICAgIHZhciByZWFsdGltZURlbHRhID0gMS90aGlzLmZwczsvL2lnbm9yaW5nIHRoZSB0cnVlIHRpbWUsIGNhbGN1bGF0ZSB0aGUgZGVsdGFcblx0XHR2YXIgZGVsdGEgPSByZWFsdGltZURlbHRhKnRoaXMudGltZVNjYWxlOyBcblx0XHR0aGlzLmVsYXBzZWRUaW1lICs9IGRlbHRhO1xuICAgICAgICB0aGlzLnRydWVFbGFwc2VkVGltZSArPSByZWFsdGltZURlbHRhO1xuXG5cdFx0Ly9nZXQgdGltZXN0ZXBcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl1baV0oe1widFwiOnRoaXMuZWxhcHNlZFRpbWUsXCJkZWx0YVwiOmRlbHRhLCAncmVhbHRpbWVEZWx0YSc6cmVhbHRpbWVEZWx0YX0pO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSApO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdW2ldKCk7XG5cdFx0fVxuXG5cblx0XHR0aGlzLnJlY29yZF9mcmFtZSgpO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLnJlbmRlci5iaW5kKHRoaXMpKTtcblx0fVxuXHRyZWNvcmRfZnJhbWUoKXtcblx0Ly9cdGxldCBjdXJyZW50X2ZyYW1lID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignY2FudmFzJykudG9EYXRhVVJMKCk7XG5cblx0XHR0aGlzLmNhcHR1cmVyLmNhcHR1cmUoIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2NhbnZhcycpICk7XG5cblx0XHR0aGlzLmZyYW1lQ291bnRlci5pbm5lckhUTUwgPSB0aGlzLmZyYW1lc19yZW5kZXJlZCArIFwiIC8gXCIgKyB0aGlzLmZyYW1lQ291bnQ7IC8vdXBkYXRlIHRpbWVyXG5cblx0XHR0aGlzLmZyYW1lc19yZW5kZXJlZCsrO1xuXG5cblx0XHRpZih0aGlzLmZyYW1lc19yZW5kZXJlZD50aGlzLmZyYW1lQ291bnQpe1xuXHRcdFx0dGhpcy5yZW5kZXIgPSBudWxsOyAvL2hhY2t5IHdheSBvZiBzdG9wcGluZyB0aGUgcmVuZGVyaW5nXG5cdFx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0XHRcdC8vdGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXG5cdFx0XHR0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5jYXB0dXJlci5zdG9wKCk7XG5cdFx0XHQvLyBkZWZhdWx0IHNhdmUsIHdpbGwgZG93bmxvYWQgYXV0b21hdGljYWxseSBhIGZpbGUgY2FsbGVkIHtuYW1lfS5leHRlbnNpb24gKHdlYm0vZ2lmL3Rhcilcblx0XHRcdHRoaXMuY2FwdHVyZXIuc2F2ZSgpO1xuXHRcdH1cblx0fVxuXHRyZXNpemVDYW52YXNJZk5lY2Vzc2FyeSgpIHtcblx0XHQvL3N0b3AgcmVjb3JkaW5nIGlmIHdpbmRvdyBzaXplIGNoYW5nZXNcblx0XHRpZih0aGlzLnJlbmRlcmluZyAmJiB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCAhPSB0aGlzLmFzcGVjdCl7XG5cdFx0XHR0aGlzLmNhcHR1cmVyLnN0b3AoKTtcblx0XHRcdHRoaXMucmVuZGVyID0gbnVsbDsgLy9oYWNreSB3YXkgb2Ygc3RvcHBpbmcgdGhlIHJlbmRlcmluZ1xuXHRcdFx0YWxlcnQoXCJBYm9ydGluZyByZWNvcmQ6IFdpbmRvdy1zaXplIGNoYW5nZSBkZXRlY3RlZCFcIik7XG5cdFx0XHR0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzdXBlci5yZXNpemVDYW52YXNJZk5lY2Vzc2FyeSgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHNldHVwVGhyZWUoZnBzPTMwLCBsZW5ndGggPSA1LCBjYW52YXNFbGVtID0gbnVsbCl7XG5cdC8qIFNldCB1cCB0aGUgdGhyZWUuanMgZW52aXJvbm1lbnQuIFN3aXRjaCBiZXR3ZWVuIGNsYXNzZXMgZHluYW1pY2FsbHkgc28gdGhhdCB5b3UgY2FuIHJlY29yZCBieSBhcHBlbmRpbmcgXCI/cmVjb3JkPXRydWVcIiB0byBhbiB1cmwuIFRoZW4gRVhQLnRocmVlRW52aXJvbm1lbnQuY2FtZXJhIGFuZCBFWFAudGhyZWVFbnZpcm9ubWVudC5zY2VuZSB3b3JrLCBhcyB3ZWxsIGFzIEVYUC50aHJlZUVudmlyb25tZW50Lm9uKCdldmVudCBuYW1lJywgY2FsbGJhY2spLiBPbmx5IG9uZSBlbnZpcm9ubWVudCBleGlzdHMgYXQgYSB0aW1lLlxuXG4gICAgVGhlIHJldHVybmVkIG9iamVjdCBpcyBhIHNpbmdsZXRvbjogbXVsdGlwbGUgY2FsbHMgd2lsbCByZXR1cm4gdGhlIHNhbWUgb2JqZWN0OiBFWFAudGhyZWVFbnZpcm9ubWVudC4qL1xuXHR2YXIgcmVjb3JkZXIgPSBudWxsO1xuXHR2YXIgaXNfcmVjb3JkaW5nID0gZmFsc2U7XG5cblx0Ly9leHRyYWN0IHJlY29yZCBwYXJhbWV0ZXIgZnJvbSB1cmxcblx0dmFyIHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoZG9jdW1lbnQubG9jYXRpb24uc2VhcmNoKTtcblx0bGV0IHJlY29yZFN0cmluZyA9IHBhcmFtcy5nZXQoXCJyZWNvcmRcIik7XG5cblx0aWYocmVjb3JkU3RyaW5nKXsgLy9kZXRlY3QgaWYgVVJMIHBhcmFtcyBpbmNsdWRlID9yZWNvcmQ9MSBvciA/cmVjb3JkPXRydWVcbiAgICAgICAgcmVjb3JkU3RyaW5nID0gcmVjb3JkU3RyaW5nLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlzX3JlY29yZGluZyA9IChyZWNvcmRTdHJpbmcgPT0gXCJ0cnVlXCIgfHwgcmVjb3JkU3RyaW5nID09IFwiMVwiKTtcbiAgICB9XG5cbiAgICBsZXQgdGhyZWVFbnZpcm9ubWVudCA9IGdldFRocmVlRW52aXJvbm1lbnQoKTtcbiAgICBpZih0aHJlZUVudmlyb25tZW50ICE9PSBudWxsKXsvL3NpbmdsZXRvbiBoYXMgYWxyZWFkeSBiZWVuIGNyZWF0ZWRcbiAgICAgICAgcmV0dXJuIHRocmVlRW52aXJvbm1lbnQ7XG4gICAgfVxuXG5cdGlmKGlzX3JlY29yZGluZyl7XG5cdFx0dGhyZWVFbnZpcm9ubWVudCA9IG5ldyBUaHJlZWFzeVJlY29yZGVyKGZwcywgbGVuZ3RoLCBjYW52YXNFbGVtKTtcblx0fWVsc2V7XG5cdFx0dGhyZWVFbnZpcm9ubWVudCA9IG5ldyBUaHJlZWFzeUVudmlyb25tZW50KGNhbnZhc0VsZW0pO1xuXHR9XG4gICAgc2V0VGhyZWVFbnZpcm9ubWVudCh0aHJlZUVudmlyb25tZW50KTtcbiAgICByZXR1cm4gdGhyZWVFbnZpcm9ubWVudDtcbn1cblxuZXhwb3J0IHtzZXR1cFRocmVlLCBUaHJlZWFzeUVudmlyb25tZW50LCBUaHJlZWFzeVJlY29yZGVyfVxuIiwiYXN5bmMgZnVuY3Rpb24gZGVsYXkod2FpdFRpbWUpe1xuXHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHR3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCB3YWl0VGltZSk7XG5cdH0pO1xuXG59XG5cbmV4cG9ydCB7ZGVsYXl9O1xuIiwiLy9MaW5lT3V0cHV0U2hhZGVycy5qc1xuXG4vL2Jhc2VkIG9uIGh0dHBzOi8vbWF0dGRlc2wuc3ZidGxlLmNvbS9kcmF3aW5nLWxpbmVzLWlzLWhhcmQgYnV0IHdpdGggc2V2ZXJhbCBlcnJvcnMgY29ycmVjdGVkLCBiZXZlbCBzaGFkaW5nIGFkZGVkLCBhbmQgbW9yZVxuXG5jb25zdCBMSU5FX0pPSU5fVFlQRVMgPSB7XCJNSVRFUlwiOiAwLjIsIFwiQkVWRUxcIjoxLjIsXCJST1VORFwiOjIuMn07IC8vSSdkIHVzZSAwLDEsMiBidXQgSlMgZG9lc24ndCBhZGQgYSBkZWNpbWFsIHBsYWNlIGF0IHRoZSBlbmQgd2hlbiBpbnNlcnRpbmcgdGhlbSBpbiBhIHN0cmluZy4gY3Vyc2VkIGp1c3RpZmljYXRpb25cblxudmFyIHZTaGFkZXIgPSBbXG5cInVuaWZvcm0gZmxvYXQgYXNwZWN0O1wiLCAvL3VzZWQgdG8gY2FsaWJyYXRlIHNjcmVlbiBzcGFjZVxuXCJ1bmlmb3JtIGZsb2F0IGxpbmVXaWR0aDtcIiwgLy93aWR0aCBvZiBsaW5lXG5cInVuaWZvcm0gZmxvYXQgbGluZUpvaW5UeXBlO1wiLFxuLy9cImF0dHJpYnV0ZSB2ZWMzIHBvc2l0aW9uO1wiLCAvL2FkZGVkIGF1dG9tYXRpY2FsbHkgYnkgdGhyZWUuanNcblwiYXR0cmlidXRlIHZlYzMgbmV4dFBvaW50UG9zaXRpb247XCIsXG5cImF0dHJpYnV0ZSB2ZWMzIHByZXZpb3VzUG9pbnRQb3NpdGlvbjtcIixcblwiYXR0cmlidXRlIGZsb2F0IGRpcmVjdGlvbjtcIixcblwiYXR0cmlidXRlIGZsb2F0IGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleDtcIixcblxuXCJ2YXJ5aW5nIGZsb2F0IGNyb3NzTGluZVBvc2l0aW9uO1wiLFxuXCJhdHRyaWJ1dGUgdmVjMyBjb2xvcjtcIixcblwidmFyeWluZyB2ZWMzIHZDb2xvcjtcIixcblwidmFyeWluZyB2ZWMyIGxpbmVTZWdtZW50QUNsaXBTcGFjZTtcIixcblwidmFyeWluZyB2ZWMyIGxpbmVTZWdtZW50QkNsaXBTcGFjZTtcIixcblwidmFyeWluZyBmbG9hdCB0aGlja25lc3M7XCIsXG5cblxuXCJ2YXJ5aW5nIHZlYzMgZGVidWdJbmZvO1wiLFxuXG5cInZlYzMgYW5nbGVfdG9faHVlKGZsb2F0IGFuZ2xlKSB7XCIsIC8vZm9yIGRlYnVnZ2luZ1xuXCIgIGFuZ2xlIC89IDMuMTQxNTkyKjIuO1wiLFxuXCIgIHJldHVybiBjbGFtcCgoYWJzKGZyYWN0KGFuZ2xlK3ZlYzMoMy4wLCAyLjAsIDEuMCkvMy4wKSo2LjAtMy4wKS0xLjApLCAwLjAsIDEuMCk7XCIsXG5cIn1cIixcblxuLy9naXZlbiBhbiB1bml0IHZlY3RvciwgbW92ZSBkaXN0IHVuaXRzIHBlcnBlbmRpY3VsYXIgdG8gaXQuXG5cInZlYzIgb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UodmVjMiBkaXIsIGZsb2F0IHR3aWNlRGlzdCkge1wiLFxuICBcInZlYzIgbm9ybWFsID0gdmVjMigtZGlyLnksIGRpci54KSA7XCIsXG4gIFwibm9ybWFsICo9IHR3aWNlRGlzdC8yLjA7XCIsXG4gIFwibm9ybWFsLnggLz0gYXNwZWN0O1wiLFxuICBcInJldHVybiBub3JtYWw7XCIsXG5cIn1cIixcblxuXCJ2b2lkIG1haW4oKSB7XCIsXG5cbiAgXCJ2ZWMyIGFzcGVjdFZlYyA9IHZlYzIoYXNwZWN0LCAxLjApO1wiLFxuICBcIm1hdDQgcHJvalZpZXdNb2RlbCA9IHByb2plY3Rpb25NYXRyaXggKlwiLFxuICAgICAgICAgICAgXCJ2aWV3TWF0cml4ICogbW9kZWxNYXRyaXg7XCIsXG4gIFwidmVjNCBwcmV2aW91c1Byb2plY3RlZCA9IHByb2pWaWV3TW9kZWwgKiB2ZWM0KHByZXZpb3VzUG9pbnRQb3NpdGlvbiwgMS4wKTtcIixcbiAgXCJ2ZWM0IGN1cnJlbnRQcm9qZWN0ZWQgPSBwcm9qVmlld01vZGVsICogdmVjNChwb3NpdGlvbiwgMS4wKTtcIixcbiAgXCJ2ZWM0IG5leHRQcm9qZWN0ZWQgPSBwcm9qVmlld01vZGVsICogdmVjNChuZXh0UG9pbnRQb3NpdGlvbiwgMS4wKTtcIixcblxuXG4gIC8vZ2V0IDJEIHNjcmVlbiBzcGFjZSB3aXRoIFcgZGl2aWRlIGFuZCBhc3BlY3QgY29ycmVjdGlvblxuICBcInZlYzIgY3VycmVudFNjcmVlbiA9IGN1cnJlbnRQcm9qZWN0ZWQueHkgLyBjdXJyZW50UHJvamVjdGVkLncgKiBhc3BlY3RWZWM7XCIsXG4gIFwidmVjMiBwcmV2aW91c1NjcmVlbiA9IHByZXZpb3VzUHJvamVjdGVkLnh5IC8gcHJldmlvdXNQcm9qZWN0ZWQudyAqIGFzcGVjdFZlYztcIixcbiAgXCJ2ZWMyIG5leHRTY3JlZW4gPSBuZXh0UHJvamVjdGVkLnh5IC8gbmV4dFByb2plY3RlZC53ICogYXNwZWN0VmVjO1wiLFxuXG4gIC8vXCJjZW50ZXJQb2ludENsaXBTcGFjZVBvc2l0aW9uID0gY3VycmVudFByb2plY3RlZC54eSAvIGN1cnJlbnRQcm9qZWN0ZWQudztcIiwvL3NlbmQgdG8gZnJhZ21lbnQgc2hhZGVyXG4gIFwiY3Jvc3NMaW5lUG9zaXRpb24gPSBkaXJlY3Rpb247XCIsIC8vc2VuZCBkaXJlY3Rpb24gdG8gdGhlIGZyYWdtZW50IHNoYWRlclxuICBcInZDb2xvciA9IGNvbG9yO1wiLCAvL3NlbmQgZGlyZWN0aW9uIHRvIHRoZSBmcmFnbWVudCBzaGFkZXJcblxuICBcInRoaWNrbmVzcyA9IGxpbmVXaWR0aCAvIDQwMC47XCIsIC8vVE9ETzogY29udmVydCBsaW5lV2lkdGggdG8gcGl4ZWxzXG4gIFwiZmxvYXQgb3JpZW50YXRpb24gPSAoZGlyZWN0aW9uLTAuNSkqMi47XCIsXG5cbiAgLy9nZXQgZGlyZWN0aW9ucyBmcm9tIChDIC0gQikgYW5kIChCIC0gQSlcbiAgXCJ2ZWMyIHZlY0EgPSAoY3VycmVudFNjcmVlbiAtIHByZXZpb3VzU2NyZWVuKTtcIixcbiAgXCJ2ZWMyIHZlY0IgPSAobmV4dFNjcmVlbiAtIGN1cnJlbnRTY3JlZW4pO1wiLFxuICBcInZlYzIgZGlyQSA9IG5vcm1hbGl6ZSh2ZWNBKTtcIixcbiAgXCJ2ZWMyIGRpckIgPSBub3JtYWxpemUodmVjQik7XCIsXG5cbiAgLy9ERUJVR1xuICBcImxpbmVTZWdtZW50QUNsaXBTcGFjZSA9IG1peChwcmV2aW91c1NjcmVlbixjdXJyZW50U2NyZWVuLGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleCkgLyBhc3BlY3RWZWM7XCIsLy9zZW5kIHRvIGZyYWdtZW50IHNoYWRlclxuICBcImxpbmVTZWdtZW50QkNsaXBTcGFjZSA9IG1peChjdXJyZW50U2NyZWVuLG5leHRTY3JlZW4sYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4KSAvIGFzcGVjdFZlYztcIiwvL3NlbmQgdG8gZnJhZ21lbnQgc2hhZGVyXG5cbiAgLy9zdGFydGluZyBwb2ludCB1c2VzIChuZXh0IC0gY3VycmVudClcbiAgXCJ2ZWMyIG9mZnNldCA9IHZlYzIoMC4wKTtcIixcbiAgXCJpZiAoY3VycmVudFNjcmVlbiA9PSBwcmV2aW91c1NjcmVlbikge1wiLFxuICBcIiAgb2Zmc2V0ID0gb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UoZGlyQiAqIG9yaWVudGF0aW9uLCB0aGlja25lc3MpO1wiLFxuICAvL29mZnNldCArPSBkaXJCICogdGhpY2tuZXNzOyAvL2VuZCBjYXBcbiAgXCJ9IFwiLFxuICAvL2VuZGluZyBwb2ludCB1c2VzIChjdXJyZW50IC0gcHJldmlvdXMpXG4gIFwiZWxzZSBpZiAoY3VycmVudFNjcmVlbiA9PSBuZXh0U2NyZWVuKSB7XCIsXG4gIFwiICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXJBICogb3JpZW50YXRpb24sIHRoaWNrbmVzcyk7XCIsXG4gIC8vb2Zmc2V0ICs9IGRpckEgKiB0aGlja25lc3M7IC8vZW5kIGNhcFxuICBcIn1cIixcbiAgXCIvL3NvbWV3aGVyZSBpbiBtaWRkbGUsIG5lZWRzIGEgam9pblwiLFxuICBcImVsc2Uge1wiLFxuICBcIiAgaWYgKGxpbmVKb2luVHlwZSA9PSBcIitMSU5FX0pPSU5fVFlQRVMuTUlURVIrXCIpIHtcIixcbiAgICAgICAgLy9jb3JuZXIgdHlwZTogbWl0ZXIuIFRoaXMgaXMgYnVnZ3kgKHRoZXJlJ3Mgbm8gbWl0ZXIgbGltaXQgeWV0KSBzbyBkb24ndCB1c2VcbiAgXCIgICAgLy9ub3cgY29tcHV0ZSB0aGUgbWl0ZXIgam9pbiBub3JtYWwgYW5kIGxlbmd0aFwiLFxuICBcIiAgICB2ZWMyIG1pdGVyRGlyZWN0aW9uID0gbm9ybWFsaXplKGRpckEgKyBkaXJCKTtcIixcbiAgXCIgICAgdmVjMiBwcmV2TGluZUV4dHJ1ZGVEaXJlY3Rpb24gPSB2ZWMyKC1kaXJBLnksIGRpckEueCk7XCIsXG4gIFwiICAgIHZlYzIgbWl0ZXIgPSB2ZWMyKC1taXRlckRpcmVjdGlvbi55LCBtaXRlckRpcmVjdGlvbi54KTtcIixcbiAgXCIgICAgZmxvYXQgbGVuID0gdGhpY2tuZXNzIC8gKGRvdChtaXRlciwgcHJldkxpbmVFeHRydWRlRGlyZWN0aW9uKSswLjAwMDEpO1wiLCAvL2NhbGN1bGF0ZS4gZG90IHByb2R1Y3QgaXMgYWx3YXlzID4gMFxuICBcIiAgICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShtaXRlckRpcmVjdGlvbiAqIG9yaWVudGF0aW9uLCBsZW4pO1wiLFxuICBcIiAgfSBlbHNlIGlmIChsaW5lSm9pblR5cGUgPT0gXCIrTElORV9KT0lOX1RZUEVTLkJFVkVMK1wiKXtcIixcbiAgICAvL2Nvcm5lciB0eXBlOiBiZXZlbFxuICBcIiAgICB2ZWMyIGRpciA9IG1peChkaXJBLCBkaXJCLCBhcHByb2FjaE5leHRPclByZXZWZXJ0ZXgpO1wiLFxuICBcIiAgICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXIgKiBvcmllbnRhdGlvbiwgdGhpY2tuZXNzKTtcIixcbiAgXCIgIH0gZWxzZSBpZiAobGluZUpvaW5UeXBlID09IFwiK0xJTkVfSk9JTl9UWVBFUy5ST1VORCtcIil7XCIsXG4gICAgLy9jb3JuZXIgdHlwZTogcm91bmRcbiAgXCIgICAgdmVjMiBkaXIgPSBtaXgoZGlyQSwgZGlyQiwgYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4KTtcIixcbiAgXCIgICAgdmVjMiBoYWxmVGhpY2tuZXNzUGFzdFRoZVZlcnRleCA9IGRpcip0aGlja25lc3MvMi4gKiBhcHByb2FjaE5leHRPclByZXZWZXJ0ZXggLyBhc3BlY3RWZWM7XCIsXG4gIFwiICAgIG9mZnNldCA9IG9mZnNldFBlcnBlbmRpY3VsYXJBbG9uZ1NjcmVlblNwYWNlKGRpciAqIG9yaWVudGF0aW9uLCB0aGlja25lc3MpIC0gaGFsZlRoaWNrbmVzc1Bhc3RUaGVWZXJ0ZXg7XCIsIC8vZXh0ZW5kIHJlY3RzIHBhc3QgdGhlIHZlcnRleFxuICBcIiAgfSBlbHNlIHtcIiwgLy9ubyBsaW5lIGpvaW4gdHlwZSBzcGVjaWZpZWQsIGp1c3QgZ28gZm9yIHRoZSBwcmV2aW91cyBwb2ludFxuICBcIiAgICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXJBLCB0aGlja25lc3MpO1wiLFxuICBcIiAgfVwiLFxuICBcIn1cIixcblxuICBcImRlYnVnSW5mbyA9IHZlYzMoYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4LCBvcmllbnRhdGlvbiwgMC4wKTtcIiwgLy9UT0RPOiByZW1vdmUuIGl0J3MgZm9yIGRlYnVnZ2luZyBjb2xvcnNcbiAgXCJnbF9Qb3NpdGlvbiA9IGN1cnJlbnRQcm9qZWN0ZWQgKyB2ZWM0KG9mZnNldCwgMC4wLDAuMCkgKmN1cnJlbnRQcm9qZWN0ZWQudztcIixcblwifVwiXS5qb2luKFwiXFxuXCIpO1xuXG52YXIgZlNoYWRlciA9IFtcblwidW5pZm9ybSBmbG9hdCBvcGFjaXR5O1wiLFxuXCJ1bmlmb3JtIHZlYzIgc2NyZWVuU2l6ZTtcIixcblwidW5pZm9ybSBmbG9hdCBhc3BlY3Q7XCIsXG5cInVuaWZvcm0gZmxvYXQgbGluZUpvaW5UeXBlO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgdkNvbG9yO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgZGVidWdJbmZvO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgbGluZVNlZ21lbnRBQ2xpcFNwYWNlO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgbGluZVNlZ21lbnRCQ2xpcFNwYWNlO1wiLFxuXCJ2YXJ5aW5nIGZsb2F0IGNyb3NzTGluZVBvc2l0aW9uO1wiLFxuXCJ2YXJ5aW5nIGZsb2F0IHRoaWNrbmVzcztcIixcblxuLyogdXNlZnVsIGZvciBkZWJ1Z2dpbmchIGZyb20gaHR0cHM6Ly93d3cucm9uamEtdHV0b3JpYWxzLmNvbS8yMDE4LzExLzI0L3NkZi1zcGFjZS1tYW5pcHVsYXRpb24uaHRtbFxuXCJ2ZWMzIHJlbmRlckxpbmVzT3V0c2lkZShmbG9hdCBkaXN0KXtcIixcblwiICAgIGZsb2F0IF9MaW5lRGlzdGFuY2UgPSAwLjM7XCIsXG5cIiAgICBmbG9hdCBfTGluZVRoaWNrbmVzcyA9IDAuMDU7XCIsXG5cIiAgICBmbG9hdCBfU3ViTGluZVRoaWNrbmVzcyA9IDAuMDU7XCIsXG5cIiAgICBmbG9hdCBfU3ViTGluZXMgPSAxLjA7XCIsXG5cIiAgICB2ZWMzIGNvbCA9IG1peCh2ZWMzKDEuMCwwLjIsMC4yKSwgdmVjMygwLjAsMC4yLDEuMiksIHN0ZXAoMC4wLCBkaXN0KSk7XCIsXG5cblwiICAgIGZsb2F0IGRpc3RhbmNlQ2hhbmdlID0gZndpZHRoKGRpc3QpICogMC41O1wiLFxuXCIgICAgZmxvYXQgbWFqb3JMaW5lRGlzdGFuY2UgPSBhYnMoZnJhY3QoZGlzdCAvIF9MaW5lRGlzdGFuY2UgKyAwLjUpIC0gMC41KSAqIF9MaW5lRGlzdGFuY2U7XCIsXG5cIiAgICBmbG9hdCBtYWpvckxpbmVzID0gc21vb3Roc3RlcChfTGluZVRoaWNrbmVzcyAtIGRpc3RhbmNlQ2hhbmdlLCBfTGluZVRoaWNrbmVzcyArIGRpc3RhbmNlQ2hhbmdlLCBtYWpvckxpbmVEaXN0YW5jZSk7XCIsXG5cblwiICAgIGZsb2F0IGRpc3RhbmNlQmV0d2VlblN1YkxpbmVzID0gX0xpbmVEaXN0YW5jZSAvIF9TdWJMaW5lcztcIixcblwiICAgIGZsb2F0IHN1YkxpbmVEaXN0YW5jZSA9IGFicyhmcmFjdChkaXN0IC8gZGlzdGFuY2VCZXR3ZWVuU3ViTGluZXMgKyAwLjUpIC0gMC41KSAqIGRpc3RhbmNlQmV0d2VlblN1YkxpbmVzO1wiLFxuXCIgICAgZmxvYXQgc3ViTGluZXMgPSBzbW9vdGhzdGVwKF9TdWJMaW5lVGhpY2tuZXNzIC0gZGlzdGFuY2VDaGFuZ2UsIF9TdWJMaW5lVGhpY2tuZXNzICsgZGlzdGFuY2VDaGFuZ2UsIHN1YkxpbmVEaXN0YW5jZSk7XCIsXG5cblwiICAgIHJldHVybiBjb2wgKiBtYWpvckxpbmVzICogc3ViTGluZXM7XCIsXG5cIn1cIiwgKi9cblxuXG5cImZsb2F0IGxpbmVTREYodmVjMiBwb2ludCwgdmVjMiBsaW5lU3RhcnRQdCx2ZWMyIGxpbmVFbmRQdCkge1wiLFxuICBcImZsb2F0IGggPSBjbGFtcChkb3QocG9pbnQtbGluZVN0YXJ0UHQsbGluZUVuZFB0LWxpbmVTdGFydFB0KS9kb3QobGluZUVuZFB0LWxpbmVTdGFydFB0LGxpbmVFbmRQdC1saW5lU3RhcnRQdCksMC4wLDEuMCk7XCIsXG4gIFwidmVjMiBwcm9qZWN0ZWRWZWMgPSAocG9pbnQtbGluZVN0YXJ0UHQtKGxpbmVFbmRQdC1saW5lU3RhcnRQdCkqaCk7XCIsXG4gIFwicmV0dXJuIGxlbmd0aChwcm9qZWN0ZWRWZWMpO1wiLFxuXCJ9XCIsXG5cblxuXCJ2b2lkIG1haW4oKXtcIixcblwiICB2ZWMzIGNvbCA9IHZDb2xvci5yZ2I7XCIsXG4vL1wiICBjb2wgPSBkZWJ1Z0luZm8ucmdiO1wiLFxuXCIgIGdsX0ZyYWdDb2xvciA9IHZlYzQoY29sLCBvcGFjaXR5KTtcIixcblxuXCIgIGlmIChsaW5lSm9pblR5cGUgPT0gXCIrTElORV9KT0lOX1RZUEVTLlJPVU5EK1wiKXtcIixcblwiICAgICAgdmVjMiB2ZXJ0U2NyZWVuU3BhY2VQb3NpdGlvbiA9IGdsX0ZyYWdDb29yZC54eTtcIiwgLy9nb2VzIGZyb20gMCB0byBzY3JlZW5TaXplLnh5XG5cIiAgICAgIHZlYzIgbGluZVB0QVNjcmVlblNwYWNlID0gKGxpbmVTZWdtZW50QUNsaXBTcGFjZSsxLikvMi4gKiBzY3JlZW5TaXplO1wiLCAvL2NvbnZlcnQgWy0xLDFdIHRvIFswLDFdLCB0aGVuICpzY3JlZW5TaXplXG5cIiAgICAgIHZlYzIgbGluZVB0QlNjcmVlblNwYWNlID0gKGxpbmVTZWdtZW50QkNsaXBTcGFjZSsxLikvMi4gKiBzY3JlZW5TaXplO1wiLFxuXCIgICAgICBmbG9hdCBkaXN0RnJvbUxpbmUgPSBsaW5lU0RGKHZlcnRTY3JlZW5TcGFjZVBvc2l0aW9uLCBsaW5lUHRBU2NyZWVuU3BhY2UsbGluZVB0QlNjcmVlblNwYWNlKTtcIixcblwiICAgICAgZmxvYXQgc2RmID0gMS4tKDEuL3RoaWNrbmVzcyAvc2NyZWVuU2l6ZS55ICogNC4wICpkaXN0RnJvbUxpbmUpO1wiLFxuXCIgICAgICBmbG9hdCBzZGZPcGFjaXR5ID0gY2xhbXAoc2RmIC8gKGFicyhkRmR4KHNkZikpICsgYWJzKGRGZHkoc2RmKSkpLDAuMCwxLjApO1wiLFxuLy9cIiAgICAgIGlmKG9wYWNpdHkgKiBzZGZPcGFjaXR5IDwgMC4xKWRpc2NhcmQ7XCIsXG5cIiAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoY29sLCBvcGFjaXR5ICogc2RmT3BhY2l0eSApO1wiLFxuXCIgIH1cIixcblwifVwiXS5qb2luKFwiXFxuXCIpXG5cbnZhciB1bmlmb3JtcyA9IHtcblx0bGluZVdpZHRoOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAxLjAsIC8vY3VycmVudGx5IGluIHVuaXRzIG9mIHlIZWlnaHQqNDAwXG5cdH0sXG5cdHNjcmVlblNpemU6IHtcblx0XHR2YWx1ZTogbmV3IFRIUkVFLlZlY3RvcjIoIDEsIDEgKSxcblx0fSxcblx0bGluZUpvaW5UeXBlOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiBMSU5FX0pPSU5fVFlQRVMuUk9VTkQsXG5cdH0sXG5cdG9wYWNpdHk6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCxcblx0fSxcblx0YXNwZWN0OiB7IC8vYXNwZWN0IHJhdGlvLiBuZWVkIHRvIGxvYWQgZnJvbSByZW5kZXJlclxuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMS4wLFxuXHR9XG59O1xuXG5leHBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcywgTElORV9KT0lOX1RZUEVTIH07XG4iLCJpbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuLi91dGlscy5qcyc7XG5pbXBvcnQgeyBnZXRUaHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcywgTElORV9KT0lOX1RZUEVTIH0gZnJvbSAnLi9MaW5lT3V0cHV0U2hhZGVycy5qcyc7XG5cbmNvbnN0IHRtcENvbG9yID0gbmV3IFRIUkVFLkNvbG9yKDB4MDAwMDAwKTtcblxuY2xhc3MgTGluZU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29yay5cbiAgICAgICAgQ3Jpc3AgbGluZXMgdXNpbmcgdGhlIHRlY2huaXF1ZSBpbiBodHRwczovL21hdHRkZXNsLnN2YnRsZS5jb20vZHJhd2luZy1saW5lcy1pcy1oYXJkLCBidXQgYWxzbyBzdXBwb3J0aW5nIG1pdGVyZWQgbGluZXMgYW5kIGJldmVsZWQgbGluZXMgdG9vIVxuICAgICAgICAgICAgb3B0aW9uczpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB3aWR0aDogbnVtYmVyLiB1bml0cyBhcmUgaW4gc2NyZWVuWS80MDAuXG4gICAgICAgICAgICAgICAgb3BhY2l0eTogbnVtYmVyXG4gICAgICAgICAgICAgICAgY29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcbiAgICAgICAgICAgICAgICBsaW5lSm9pbjogXCJiZXZlbFwiIG9yIFwicm91bmRcIi4gZGVmYXVsdDogcm91bmQuIERvbid0IGNoYW5nZSB0aGlzIGFmdGVyIGluaXRpYWxpemF0aW9uLlxuICAgICAgICAgICAgfVxuICAgICAgICAqL1xuXG4gICAgICAgIHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDU7XG4gICAgICAgIHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cbiAgICAgICAgdGhpcy5faGFzQ3VzdG9tQ29sb3JGdW5jdGlvbiA9IGZhbHNlO1xuICAgICAgICBpZihVdGlscy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29sb3IpKXtcbiAgICAgICAgICAgIHRoaXMuX2hhc0N1c3RvbUNvbG9yRnVuY3Rpb24gPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuY29sb3IpIDogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGluZUpvaW5UeXBlID0gb3B0aW9ucy5saW5lSm9pblR5cGUgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubGluZUpvaW5UeXBlLnRvVXBwZXJDYXNlKCkgOiBcIkJFVkVMXCI7XG4gICAgICAgIGlmKExJTkVfSk9JTl9UWVBFU1t0aGlzLmxpbmVKb2luVHlwZV0gPT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICB0aGlzLmxpbmVKb2luVHlwZSA9IFwiQkVWRUxcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuICAgICAgICB0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGhvdyBtYW55IHRpbWVzIHRvIGJlIGNhbGxlZCBpbiBlYWNoIGRpcmVjdGlvblxuICAgICAgICB0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gMzsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT9cblxuICAgICAgICB0aGlzLmluaXQoKTtcbiAgICB9XG4gICAgaW5pdCgpe1xuICAgICAgICB0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuICAgICAgICB0aGlzLl92ZXJ0aWNlcztcbiAgICAgICAgdGhpcy5tYWtlR2VvbWV0cnkoKTtcblxuXG4gICAgICAgIC8vbWFrZSBhIGRlZXAgY29weSBvZiB0aGUgdW5pZm9ybXMgdGVtcGxhdGVcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMgPSB7fTtcbiAgICAgICAgZm9yKHZhciB1bmlmb3JtTmFtZSBpbiB1bmlmb3Jtcyl7XG4gICAgICAgICAgICB0aGlzLl91bmlmb3Jtc1t1bmlmb3JtTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogdW5pZm9ybXNbdW5pZm9ybU5hbWVdLnR5cGUsXG4gICAgICAgICAgICAgICAgdmFsdWU6IHVuaWZvcm1zW3VuaWZvcm1OYW1lXS52YWx1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCh7XG4gICAgICAgICAgICBzaWRlOiBUSFJFRS5CYWNrU2lkZSxcbiAgICAgICAgICAgIHZlcnRleFNoYWRlcjogdlNoYWRlciwgXG4gICAgICAgICAgICBmcmFnbWVudFNoYWRlcjogZlNoYWRlcixcbiAgICAgICAgICAgIHVuaWZvcm1zOiB0aGlzLl91bmlmb3JtcyxcbiAgICAgICAgICAgIGV4dGVuc2lvbnM6e2Rlcml2YXRpdmVzOiB0cnVlLH0sXG4gICAgICAgICAgICBhbHBoYVRlc3Q6IDAuNSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cbiAgICAgICAgdGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy8gc2V0dGVyIHNldHMgdHJhbnNwYXJlbnQgZmxhZyBpZiBuZWNlc3NhcnlcbiAgICAgICAgdGhpcy5jb2xvciA9IHRoaXMuX2NvbG9yOyAvL3NldHRlciBzZXRzIGNvbG9yIGF0dHJpYnV0ZVxuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gdGhpcy5fb3BhY2l0eTtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMubGluZVdpZHRoLnZhbHVlID0gdGhpcy5fd2lkdGg7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLmxpbmVKb2luVHlwZS52YWx1ZSA9IExJTkVfSk9JTl9UWVBFU1t0aGlzLmxpbmVKb2luVHlwZV07XG5cbiAgICAgICAgZ2V0VGhyZWVFbnZpcm9ubWVudCgpLnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuICAgIH1cblxuICAgIG1ha2VHZW9tZXRyeSgpe1xuICAgICAgICBjb25zdCBNQVhfUE9JTlRTID0gMTAwMDsgLy90aGVzZSBhcnJheXMgZ2V0IGRpc2NhcmRlZCBvbiBmaXJzdCBhY3RpdmF0aW9uIGFueXdheXNcbiAgICAgICAgY29uc3QgTlVNX1BPSU5UU19QRVJfVkVSVEVYID0gNDtcblxuICAgICAgICBsZXQgbnVtVmVydHMgPSAoTUFYX1BPSU5UUy0xKSpOVU1fUE9JTlRTX1BFUl9WRVJURVg7XG5cbiAgICAgICAgdGhpcy5fdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIHRoaXMuX25leHRQb2ludFZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl9vdXRwdXREaW1lbnNpb25zICogbnVtVmVydHMpO1xuICAgICAgICB0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIG51bVZlcnRzKTtcbiAgICAgICAgdGhpcy5fY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheShudW1WZXJ0cyAqIDMpO1xuXG4gICAgICAgIC8vIGJ1aWxkIGdlb21ldHJ5XG5cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAncG9zaXRpb24nLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fdmVydGljZXMsIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKSApO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICduZXh0UG9pbnRQb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl9uZXh0UG9pbnRWZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3ByZXZpb3VzUG9pbnRQb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ2NvbG9yJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX2NvbG9ycywgMyApICk7XG5cbiAgICAgICAgdGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3VzZWQgZHVyaW5nIHVwZGF0ZXMgYXMgYSBwb2ludGVyIHRvIHRoZSBidWZmZXJcbiAgICAgICAgdGhpcy5fYWN0aXZhdGVkT25jZSA9IGZhbHNlO1xuXG4gICAgfVxuICAgIF9vbkFkZCgpe1xuICAgICAgICAvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgRG9tYWluIG5vZGUgd2UncmUgcmVuZGVyaW5nIGZyb21cbiAgICAgICAgbGV0IHJvb3QgPSBudWxsO1xuICAgICAgICB0cnl7XG4gICAgICAgICAgIHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcbiAgICAgICAgfWNhdGNoKGVycm9yKXtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihlcnJvcik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgLy90b2RvOiBpbXBsZW1lbnQgc29tZXRoaW5nIGxpa2UgYXNzZXJ0IHJvb3QgdHlwZW9mIFJvb3ROb2RlXG5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcbiAgICAgICAgdGhpcy5pdGVtRGltZW5zaW9ucyA9IHJvb3QuaXRlbURpbWVuc2lvbnM7XG4gICAgfVxuICAgIF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuICAgICAgICB0aGlzLl9vbkFkZCgpOyAvL3NldHVwIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLml0ZW1EaW1lbnNpb25zLiB1c2VkIGhlcmUgYWdhaW4gYmVjYXVzZSBjbG9uaW5nIG1lYW5zIHRoZSBvbkFkZCgpIG1pZ2h0IGJlIGNhbGxlZCBiZWZvcmUgdGhpcyBpcyBjb25uZWN0ZWQgdG8gYSB0eXBlIG9mIGRvbWFpblxuXG4gICAgICAgIC8vIHBlcmhhcHMgaW5zdGVhZCBvZiBnZW5lcmF0aW5nIGEgd2hvbGUgbmV3IGFycmF5LCB0aGlzIGNhbiByZXVzZSB0aGUgb2xkIG9uZT9cblxuICAgICAgICBjb25zdCBOVU1fUE9JTlRTX1BFUl9MSU5FX1NFR01FTlQgPSA0OyAvLzQgdXNlZCBmb3IgYmV2ZWxpbmdcbiAgICAgICAgY29uc3QgbnVtVmVydHMgPSAodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pICogTlVNX1BPSU5UU19QRVJfTElORV9TRUdNRU5UO1xuXG4gICAgICAgIGxldCB2ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIGxldCBuZXh0VmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICogbnVtVmVydHMpO1xuICAgICAgICBsZXQgcHJldlZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSggdGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIG51bVZlcnRzKTtcbiAgICAgICAgbGV0IGNvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkoIDMgKiBudW1WZXJ0cyk7XG5cbiAgICAgICAgbGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcbiAgICAgICAgdGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcbiAgICAgICAgcG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdmVydGljZXMpO1xuXG4gICAgICAgIGxldCBwcmV2UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucHJldmlvdXNQb2ludFBvc2l0aW9uO1xuICAgICAgICB0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcyA9IHByZXZWZXJ0aWNlcztcbiAgICAgICAgcHJldlBvaW50UG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fcHJldlBvaW50VmVydGljZXMpO1xuXG4gICAgICAgIGxldCBuZXh0UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubmV4dFBvaW50UG9zaXRpb247XG4gICAgICAgIHRoaXMuX25leHRQb2ludFZlcnRpY2VzID0gbmV4dFZlcnRpY2VzO1xuICAgICAgICBuZXh0UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9uZXh0UG9pbnRWZXJ0aWNlcyk7XG5cbiAgICAgICAgbGV0IGNvbG9yQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvcjtcbiAgICAgICAgdGhpcy5fY29sb3JzID0gY29sb3JzO1xuICAgICAgICBjb2xvckF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9jb2xvcnMpO1xuXG4gICAgICAgIC8vdXNlZCB0byBkaWZmZXJlbnRpYXRlIHRoZSBsZWZ0IGJvcmRlciBvZiB0aGUgbGluZSBmcm9tIHRoZSByaWdodCBib3JkZXJcbiAgICAgICAgbGV0IGRpcmVjdGlvbiA9IG5ldyBGbG9hdDMyQXJyYXkobnVtVmVydHMpO1xuICAgICAgICBmb3IobGV0IGk9MDsgaTxudW1WZXJ0cztpKyspe1xuICAgICAgICAgICAgZGlyZWN0aW9uW2ldID0gaSUyPT0wID8gMSA6IDA7IC8vYWx0ZXJuYXRlIC0xIGFuZCAxXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnZGlyZWN0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIGRpcmVjdGlvbiwgMSkgKTtcblxuICAgICAgICAvL3VzZWQgdG8gZGlmZmVyZW50aWF0ZSB0aGUgcG9pbnRzIHdoaWNoIG1vdmUgdG93YXJkcyBwcmV2IHZlcnRleCBmcm9tIHBvaW50cyB3aGljaCBtb3ZlIHRvd2FyZHMgbmV4dCB2ZXJ0ZXhcbiAgICAgICAgbGV0IG5leHRPclByZXYgPSBuZXcgRmxvYXQzMkFycmF5KG51bVZlcnRzKTtcbiAgICAgICAgZm9yKGxldCBpPTA7IGk8bnVtVmVydHM7aSsrKXtcbiAgICAgICAgICAgIG5leHRPclByZXZbaV0gPSBpJTQ8MiA/IDAgOiAxOyAvL2FsdGVybmF0ZSAwLDAsIDEsMVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ2FwcHJvYWNoTmV4dE9yUHJldlZlcnRleCcsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCBuZXh0T3JQcmV2LCAxKSApO1xuXG4gICAgICAgIC8vaW5kaWNlc1xuICAgICAgICAvKlxuICAgICAgICBGb3IgZWFjaCB2ZXJ0ZXgsIHdlIGNvbm5lY3QgaXQgdG8gdGhlIG5leHQgdmVydGV4IGxpa2UgdGhpczpcbiAgICAgICAgbiAtLW4rMi0tbis0LS1uKzZcbiAgICAgICAgfCAgLyAgfCAvIHwgIC8gIHxcbiAgICAgICBuKzEgLS1uKzMtLW4rNS0tbis3XG5cbiAgICAgICBwdDEgICBwdDIgcHQyICAgcHQzXG5cbiAgICAgICB2ZXJ0aWNlcyBuLG4rMSBhcmUgYXJvdW5kIHBvaW50IDEsIG4rMixuKzMsbis0LG4rNSBhcmUgYXJvdW5kIHB0Miwgbis2LG4rNyBhcmUgZm9yIHBvaW50My4gdGhlIG1pZGRsZSBzZWdtZW50IChuKzItbis1KSBpcyB0aGUgcG9seWdvbiB1c2VkIGZvciBiZXZlbGluZyBhdCBwb2ludCAyLlxuXG4gICAgICAgIHRoZW4gd2UgYWR2YW5jZSBuIHR3byBhdCBhIHRpbWUgdG8gbW92ZSB0byB0aGUgbmV4dCB2ZXJ0ZXguIHZlcnRpY2VzIG4sIG4rMSByZXByZXNlbnQgdGhlIHNhbWUgcG9pbnQ7XG4gICAgICAgIHRoZXkncmUgc2VwYXJhdGVkIGluIHRoZSB2ZXJ0ZXggc2hhZGVyIHRvIGEgY29uc3RhbnQgc2NyZWVuc3BhY2Ugd2lkdGggKi9cbiAgICAgICAgbGV0IGluZGljZXMgPSBbXTtcbiAgICAgICAgZm9yKGxldCB2ZXJ0TnVtPTA7dmVydE51bTwodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24tMSk7dmVydE51bSArPTEpe1xuICAgICAgICAgICAgbGV0IGZpcnN0Q29vcmRpbmF0ZSA9IHZlcnROdW0gJSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdO1xuICAgICAgICAgICAgbGV0IGVuZGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xO1xuICAgIFxuICAgICAgICAgICAgbGV0IHZlcnRJbmRleCA9IHZlcnROdW0gKiBOVU1fUE9JTlRTX1BFUl9MSU5FX1NFR01FTlQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmKCFlbmRpbmdOZXdMaW5lKXtcbiAgICAgICAgICAgICAgICAvL3RoZXNlIHRyaWFuZ2xlcyBzaG91bGQgYmUgZGlzYWJsZWQgd2hlbiBkb2luZyByb3VuZCBqb2luc1xuICAgICAgICAgICAgICAgIGlmKHRoaXMubGluZUpvaW5UeXBlID09IFwiQkVWRUxcIil7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCggdmVydEluZGV4KzEsIHZlcnRJbmRleCwgICB2ZXJ0SW5kZXgrMik7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCggdmVydEluZGV4KzEsIHZlcnRJbmRleCsyLCB2ZXJ0SW5kZXgrMyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKCB2ZXJ0SW5kZXgrMywgdmVydEluZGV4KzIsIHZlcnRJbmRleCs0KTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goIHZlcnRJbmRleCszLCB2ZXJ0SW5kZXgrNCwgdmVydEluZGV4KzUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LnNldEluZGV4KCBpbmRpY2VzICk7XG5cbiAgICAgICAgaWYoIXRoaXMuX2hhc0N1c3RvbUNvbG9yRnVuY3Rpb24pe1xuICAgICAgICAgICAgdGhpcy5zZXRBbGxWZXJ0aWNlc1RvQ29sb3IodGhpcy5jb2xvcik7XG4gICAgICAgIH1cblxuICAgICAgICBwb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgICAgIGNvbG9yQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICB9XG4gICAgZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHosIC4uLm90aGVyQXJncyl7XG4gICAgICAgIGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTsgICAgXG4gICAgICAgIH1cblxuICAgICAgICAvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cbiAgICAgICAgLy9hc3NlcnQgaSA8IHZlcnRpY2VzLmNvdW50XG5cbiAgICAgICAgbGV0IHhWYWx1ZSA9ICB4ID09PSB1bmRlZmluZWQgPyAwIDogeDtcbiAgICAgICAgbGV0IHlWYWx1ZSA9ICB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcbiAgICAgICAgbGV0IHpWYWx1ZSA9ICB6ID09PSB1bmRlZmluZWQgPyAwIDogejtcblxuICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCwgeFZhbHVlLHlWYWx1ZSx6VmFsdWUpO1xuXG4gICAgICAgIGlmKHRoaXMuX2hhc0N1c3RvbUNvbG9yRnVuY3Rpb24pe1xuICAgICAgICAgICAgbGV0IGNvbG9yID0gdGhpcy5fY29sb3IoaSx0LHgseSx6LC4uLm90aGVyQXJncyk7XG4gICAgICAgICAgICAvL2lmIHJldHVybiB0eXBlIGlzIFtyLGcsYl1cbiAgICAgICAgICAgIGlmKFV0aWxzLmlzQXJyYXkoY29sb3IpKXtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRDb2xvckZvclZlcnRleFJHQihpLCBjb2xvclswXSxjb2xvclsxXSxjb2xvclsyXSk7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICAvL2lmIHJldHVybiB0eXBlIGlzIGVpdGhlciBhIGhleCBzdHJpbmcsIFRIUkVFLkNvbG9yLCBvciBldmVuIGFuIEhUTUwgY29sb3Igc3RyaW5nXG4gICAgICAgICAgICAgICAgdG1wQ29sb3Iuc2V0KGNvbG9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRDb2xvckZvclZlcnRleChpLCB0bXBDb2xvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIHdlJ3JlIGRyYXdpbmcgbGlrZSB0aGlzOlxuICAgICAgICAqLS0tLSotLS0tKlxuXG4gICAgICAgICotLS0tKi0tLS0qXG4gICAgXG4gICAgICAgIGJ1dCB3ZSBkb24ndCB3YW50IHRvIGluc2VydCBhIGRpYWdvbmFsIGxpbmUgYW55d2hlcmUuIFRoaXMgaGFuZGxlcyB0aGF0OiAgKi9cblxuICAgICAgICBsZXQgZmlyc3RDb29yZGluYXRlID0gaSAlIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG5cbiAgICAgICAgLy9ib29sZWFuIHZhcmlhYmxlcy4gaWYgaW4gdGhlIGZ1dHVyZSBMaW5lT3V0cHV0IGNhbiBzdXBwb3J0IHZhcmlhYmxlLXdpZHRoIGxpbmVzLCB0aGVzZSBzaG91bGQgZWIgY2hhbmdlZFxuICAgICAgICBsZXQgc3RhcnRpbmdOZXdMaW5lID0gZmlyc3RDb29yZGluYXRlID09IDA7XG4gICAgICAgIGxldCBlbmRpbmdOZXdMaW5lID0gZmlyc3RDb29yZGluYXRlID09IHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0tMTtcblxuICAgICAgICBpZihzdGFydGluZ05ld0xpbmUpe1xuICAgICAgICAgICAgLy9tYWtlIHRoZSBwcmV2UG9pbnQgYmUgdGhlIHNhbWUgcG9pbnQgYXMgdGhpc1xuICAgICAgICAgICAgdGhpcy5zYXZlVmVydGV4SW5mb0luQnVmZmVycyh0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcywgdGhpcy5fY3VycmVudFBvaW50SW5kZXgsIHhWYWx1ZSx5VmFsdWUselZhbHVlKTtcbiAgICAgICAgfWVsc2V7XG5cbiAgICAgICAgICAgIGxldCBwcmV2WCA9IHRoaXMuX3ZlcnRpY2VzWyh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0xKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjRdO1xuICAgICAgICAgICAgbGV0IHByZXZZID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTEpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNCsxXTtcbiAgICAgICAgICAgIGxldCBwcmV2WiA9IHRoaXMuX3ZlcnRpY2VzWyh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0xKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjQrMl07XG5cbiAgICAgICAgICAgIC8vc2V0IHRoaXMgdGhpbmcncyBwcmV2UG9pbnQgdG8gdGhlIHByZXZpb3VzIHZlcnRleFxuICAgICAgICAgICAgdGhpcy5zYXZlVmVydGV4SW5mb0luQnVmZmVycyh0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcywgdGhpcy5fY3VycmVudFBvaW50SW5kZXgsIHByZXZYLHByZXZZLHByZXZaKTtcblxuICAgICAgICAgICAgLy9zZXQgdGhlIFBSRVZJT1VTIHBvaW50J3MgbmV4dFBvaW50IHRvIHRvIFRISVMgdmVydGV4LlxuICAgICAgICAgICAgdGhpcy5zYXZlVmVydGV4SW5mb0luQnVmZmVycyh0aGlzLl9uZXh0UG9pbnRWZXJ0aWNlcywgdGhpcy5fY3VycmVudFBvaW50SW5kZXgtMSwgeFZhbHVlLHlWYWx1ZSx6VmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoZW5kaW5nTmV3TGluZSl7XG4gICAgICAgICAgICAvL21ha2UgdGhlIG5leHRQb2ludCBiZSB0aGUgc2FtZSBwb2ludCBhcyB0aGlzXG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX25leHRQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCwgeFZhbHVlLHlWYWx1ZSx6VmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4Kys7XG4gICAgfVxuXG4gICAgc2F2ZVZlcnRleEluZm9JbkJ1ZmZlcnMoYXJyYXksIHZlcnROdW0sIHZhbHVlMSx2YWx1ZTIsdmFsdWUzKXtcbiAgICAgICAgLy9mb3IgZXZlcnkgY2FsbCB0byBhY3RpdmF0ZSgpLCBhbGwgNCBnZW9tZXRyeSB2ZXJ0aWNlcyByZXByZXNlbnRpbmcgdGhhdCBwb2ludCBuZWVkIHRvIHNhdmUgdGhhdCBpbmZvLlxuICAgICAgICAvL1RoZXJlZm9yZSwgdGhpcyBmdW5jdGlvbiB3aWxsIHNwcmVhZCB0aHJlZSBjb29yZGluYXRlcyBpbnRvIGEgZ2l2ZW4gYXJyYXksIHJlcGVhdGVkbHkuXG5cbiAgICAgICAgbGV0IGluZGV4ID0gdmVydE51bSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjQ7XG5cbiAgICAgICAgYXJyYXlbaW5kZXhdICAgPSB2YWx1ZTFcbiAgICAgICAgYXJyYXlbaW5kZXgrMV0gPSB2YWx1ZTJcbiAgICAgICAgYXJyYXlbaW5kZXgrMl0gPSB2YWx1ZTNcblxuICAgICAgICBhcnJheVtpbmRleCszXSA9IHZhbHVlMVxuICAgICAgICBhcnJheVtpbmRleCs0XSA9IHZhbHVlMlxuICAgICAgICBhcnJheVtpbmRleCs1XSA9IHZhbHVlM1xuXG4gICAgICAgIGFycmF5W2luZGV4KzZdID0gdmFsdWUxXG4gICAgICAgIGFycmF5W2luZGV4KzddID0gdmFsdWUyXG4gICAgICAgIGFycmF5W2luZGV4KzhdID0gdmFsdWUzXG5cbiAgICAgICAgYXJyYXlbaW5kZXgrOV0gID0gdmFsdWUxXG4gICAgICAgIGFycmF5W2luZGV4KzEwXSA9IHZhbHVlMlxuICAgICAgICBhcnJheVtpbmRleCsxMV0gPSB2YWx1ZTNcbiAgICAgICAgXG4gICAgfVxuICAgIG9uQWZ0ZXJBY3RpdmF0aW9uKCl7XG4gICAgICAgIGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgbGV0IHByZXZQb2ludFBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wcmV2aW91c1BvaW50UG9zaXRpb247XG4gICAgICAgIHByZXZQb2ludFBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgbGV0IG5leHRQb2ludFBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5uZXh0UG9pbnRQb3NpdGlvbjtcbiAgICAgICAgbmV4dFBvaW50UG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG4gICAgICAgIC8vdXBkYXRlIGFzcGVjdCByYXRpby4gaW4gdGhlIGZ1dHVyZSBwZXJoYXBzIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2hhbmdlZCB3aGVuIHRoZSBhc3BlY3QgcmF0aW8gY2hhbmdlcyBzbyBpdCdzIG5vdCBiZWluZyBkb25lIHBlciBmcmFtZT9cbiAgICAgICAgaWYodGhpcy5fdW5pZm9ybXMpe1xuICAgICAgICAgICAgY29uc3QgdGhyZWUgPSBnZXRUaHJlZUVudmlyb25tZW50KCk7XG4gICAgICAgICAgICB0aGlzLl91bmlmb3Jtcy5hc3BlY3QudmFsdWUgPSB0aHJlZS5jYW1lcmEuYXNwZWN0OyAvL1RPRE86IHJlLWVuYWJsZSBvbmNlIGRlYnVnZ2luZyBpcyBkb25lXG4gICAgICAgICAgICB0aHJlZS5yZW5kZXJlci5nZXREcmF3aW5nQnVmZmVyU2l6ZSh0aGlzLl91bmlmb3Jtcy5zY3JlZW5TaXplLnZhbHVlKTsgLy9tb2RpZmllcyB1bmlmb3JtIGluIHBsYWNlXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vcmVzZXQgYWZ0ZXIgZWFjaCB1cGRhdGVcbiAgICB9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICBnZXRUaHJlZUVudmlyb25tZW50KCkuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG4gICAgfVxuICAgIHNldEFsbFZlcnRpY2VzVG9Db2xvcihjb2xvcil7XG4gICAgICAgIGNvbnN0IGNvbCA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG4gICAgICAgIGNvbnN0IG51bVZlcnRpY2VzID0gKHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLTEpKjI7XG4gICAgICAgIGZvcihsZXQgaT0wOyBpPG51bVZlcnRpY2VzO2krKyl7XG4gICAgICAgICAgICAvL0Rvbid0IGZvcmdldCBzb21lIHBvaW50cyBhcHBlYXIgdHdpY2UgLSBhcyB0aGUgZW5kIG9mIG9uZSBsaW5lIHNlZ21lbnQgYW5kIHRoZSBiZWdpbm5pbmcgb2YgdGhlIG5leHQuXG4gICAgICAgICAgICB0aGlzLl9zZXRDb2xvckZvclZlcnRleFJHQihpLCBjb2wuciwgY29sLmcsIGNvbC5iKTtcbiAgICAgICAgfVxuICAgICAgICAvL3RlbGwgdGhyZWUuanMgdG8gdXBkYXRlIGNvbG9yc1xuICAgIH1cbiAgICBfc2V0Q29sb3JGb3JWZXJ0ZXgodmVydGV4SW5kZXgsIGNvbG9yKXtcbiAgICAgICAgLy9jb2xvciBpcyBhIFRIUkVFLkNvbG9yIGhlcmVcbiAgICAgICAgdGhpcy5fc2V0Q29sb3JGb3JWZXJ0ZXhSR0IodmVydGV4SW5kZXgsIGNvbG9yLnIsIGNvbG9yLmcsIGNvbG9yLmIpO1xuICAgIH1cbiAgICBfc2V0Q29sb3JGb3JWZXJ0ZXhSR0IodmVydGV4SW5kZXgsIG5vcm1hbGl6ZWRSLCBub3JtYWxpemVkRywgbm9ybWFsaXplZEIpe1xuICAgICAgICAvL2FsbCBvZiBub3JtYWxpemVkUiwgbm9ybWFsaXplZEcsIG5vcm1hbGl6ZWRCIGFyZSAwLTEuXG4gICAgICAgIGxldCBjb2xvckFycmF5ID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvci5hcnJheTtcbiAgICAgICAgbGV0IGluZGV4ID0gdmVydGV4SW5kZXggKiAzICogNDsgLy8qMyBiZWNhdXNlIGNvbG9ycyBoYXZlIDMgY2hhbm5lbHMsICo0IGJlY2F1c2UgNCB2ZXJ0aWNlcy9saW5lIHBvaW50XG5cbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDBdID0gbm9ybWFsaXplZFI7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAxXSA9IG5vcm1hbGl6ZWRHO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgMl0gPSBub3JtYWxpemVkQjtcblxuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgM10gPSBub3JtYWxpemVkUjtcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDRdID0gbm9ybWFsaXplZEc7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyA1XSA9IG5vcm1hbGl6ZWRCO1xuXG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyA2XSA9IG5vcm1hbGl6ZWRSO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgN10gPSBub3JtYWxpemVkRztcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDhdID0gbm9ybWFsaXplZEI7XG5cbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDldID0gbm9ybWFsaXplZFI7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAxMF0gPSBub3JtYWxpemVkRztcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDExXSA9IG5vcm1hbGl6ZWRCO1xuXG4gICAgICAgIGxldCBjb2xvckF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMuY29sb3I7XG4gICAgICAgIGNvbG9yQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICB9XG4gICAgc2V0IGNvbG9yKGNvbG9yKXtcbiAgICAgICAgLy9jb2xvciBjYW4gYmUgYSBUSFJFRS5Db2xvcigpLCBvciBhIGZ1bmN0aW9uIChpLHQseCx5LHopID0+IFRIUkVFLkNvbG9yKCksIHdoaWNoIHdpbGwgYmUgY2FsbGVkIG9uIGV2ZXJ5IHBvaW50LlxuICAgICAgICB0aGlzLl9jb2xvciA9IGNvbG9yO1xuICAgICAgICBpZihVdGlscy5pc0Z1bmN0aW9uKGNvbG9yKSl7XG4gICAgICAgICAgICB0aGlzLl9oYXNDdXN0b21Db2xvckZ1bmN0aW9uID0gdHJ1ZTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICB0aGlzLl9oYXNDdXN0b21Db2xvckZ1bmN0aW9uID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnNldEFsbFZlcnRpY2VzVG9Db2xvcihjb2xvcik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZ2V0IGNvbG9yKCl7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvcjtcbiAgICB9XG4gICAgc2V0IG9wYWNpdHkob3BhY2l0eSl7XG4gICAgICAgIC8vbWVzaCBpcyBhbHdheXMgdHJhbnNwYXJlbnRcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxIHx8IHRoaXMubGluZUpvaW5UeXBlID09IFwiUk9VTkRcIjtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG4gICAgICAgIHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gb3BhY2l0eTtcbiAgICB9XG4gICAgZ2V0IG9wYWNpdHkoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29wYWNpdHk7XG4gICAgfVxuICAgIHNldCB3aWR0aCh3aWR0aCl7XG4gICAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLmxpbmVXaWR0aC52YWx1ZSA9IHdpZHRoO1xuICAgIH1cbiAgICBnZXQgd2lkdGgoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dpZHRoO1xuICAgIH1cbiAgICBjbG9uZSgpe1xuICAgICAgICByZXR1cm4gbmV3IExpbmVPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5LCBsaW5lSm9pblR5cGU6IHRoaXMubGluZUpvaW5UeXBlfSk7XG4gICAgfVxufVxuXG5leHBvcnQge0xpbmVPdXRwdXR9O1xuIiwiaW1wb3J0IHtPdXRwdXROb2RlfSBmcm9tICcuLi9Ob2RlLmpzJztcbmltcG9ydCB7IHRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxuY2xhc3MgUG9pbnRPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lypcblx0XHRcdHdpZHRoOiBudW1iZXJcblx0XHRcdGNvbG9yOiBoZXggY29sb3IsIGFzIGluIDB4cnJnZ2JiLiBUZWNobmljYWxseSwgdGhpcyBpcyBhIEpTIGludGVnZXIuXG5cdFx0XHRvcGFjaXR5OiAwLTEuIE9wdGlvbmFsLlxuXHRcdCovXG5cblx0XHR0aGlzLl93aWR0aCA9IG9wdGlvbnMud2lkdGggIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMud2lkdGggOiAxO1xuXHRcdHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuY29sb3IpIDogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KTtcblx0XHR0aGlzLl9vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm9wYWNpdHkgOiAxO1xuXG5cdFx0dGhpcy5wb2ludHMgPSBbXTtcblxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtjb2xvcjogdGhpcy5fY29sb3J9KTtcbiAgICAgICAgdGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy90cmlnZ2VyIHNldHRlciB0byBzZXQgdGhpcy5tYXRlcmlhbCdzIG9wYWNpdHkgcHJvcGVybHlcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuXHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblx0fVxuXHRfb25BZGQoKXsgLy9zaG91bGQgYmUgY2FsbGVkIHdoZW4gdGhpcyBpcyAuYWRkKCllZCB0byBzb21ldGhpbmdcblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgQXJlYVxuXHRcdGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pe1xuXHRcdFx0Zm9yKHZhciBpPXRoaXMucG9pbnRzLmxlbmd0aDtpPHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO2krKyl7XG5cdFx0XHRcdHRoaXMucG9pbnRzLnB1c2gobmV3IFBvaW50TWVzaCh7d2lkdGg6IDEsbWF0ZXJpYWw6dGhpcy5tYXRlcmlhbH0pKTtcblx0XHRcdFx0dGhpcy5wb2ludHNbaV0ubWVzaC5zY2FsZS5zZXRTY2FsYXIodGhpcy5fd2lkdGgpOyAvL3NldCB3aWR0aCBieSBzY2FsaW5nIHBvaW50XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuXHRcdGlmKHRoaXMucG9pbnRzLmxlbmd0aCA8IHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uKXRoaXMuX29uQWRkKCk7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope1xuXHRcdGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcblx0XHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTtcdFxuXHRcdH1cblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cdFx0dmFyIHBvaW50ID0gdGhpcy5nZXRQb2ludChpKTtcblx0XHRwb2ludC54ID0geCA9PT0gdW5kZWZpbmVkID8gMCA6IHg7XG5cdFx0cG9pbnQueSA9IHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuXHRcdHBvaW50LnogPSB6ID09PSB1bmRlZmluZWQgPyAwIDogejtcblx0fVxuXHRnZXRQb2ludChpKXtcblx0XHRyZXR1cm4gdGhpcy5wb2ludHNbaV07XG5cdH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnBvaW50cy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMucG9pbnRzW2ldLnJlbW92ZVNlbGZGcm9tU2NlbmUoKTtcblx0XHR9XG4gICAgfVxuXHRzZXQgb3BhY2l0eShvcGFjaXR5KXtcblx0XHQvL3RlY2huaWNhbGx5IHRoaXMgc2V0cyBhbGwgcG9pbnRzIHRvIHRoZSBzYW1lIGNvbG9yLiBUb2RvOiBhbGxvdyBkaWZmZXJlbnQgcG9pbnRzIHRvIGJlIGRpZmZlcmVudGx5IGNvbG9yZWQuXG5cdFx0XG5cdFx0bGV0IG1hdCA9IHRoaXMubWF0ZXJpYWw7XG5cdFx0bWF0Lm9wYWNpdHkgPSBvcGFjaXR5OyAvL2luc3RhbnRpYXRlIHRoZSBwb2ludFxuXHRcdG1hdC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuICAgICAgICBtYXQudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuXHR9XG5cdGdldCBvcGFjaXR5KCl7XG5cdFx0cmV0dXJuIHRoaXMuX29wYWNpdHk7XG5cdH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5jb2xvciA9IGNvbG9yO1xuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdH1cblx0Z2V0IGNvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbG9yO1xuXHR9XG5cdHNldCB3aWR0aCh3aWR0aCl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnBvaW50cy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuZ2V0UG9pbnQoaSkubWVzaC5zY2FsZS5zZXRTY2FsYXIod2lkdGgpO1xuXHRcdH1cblx0XHR0aGlzLl93aWR0aCA9IHdpZHRoO1xuXHR9XG5cdGdldCB3aWR0aCgpe1xuXHRcdHJldHVybiB0aGlzLl93aWR0aDtcblx0fVxuXHRjbG9uZSgpe1xuXHRcdHJldHVybiBuZXcgUG9pbnRPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuXG5jbGFzcyBQb2ludE1lc2h7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdC8qb3B0aW9uczpcblx0XHRcdHgseTogbnVtYmVyc1xuXHRcdFx0d2lkdGg6IG51bWJlclxuICAgICAgICAgICAgbWF0ZXJpYWw6IFxuXHRcdCovXG5cblx0XHRsZXQgd2lkdGggPSBvcHRpb25zLndpZHRoID09PSB1bmRlZmluZWQgPyAxIDogb3B0aW9ucy53aWR0aFxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gb3B0aW9ucy5tYXRlcmlhbDsgLy9vbmUgbWF0ZXJpYWwgcGVyIFBvaW50T3V0cHV0XG5cblx0XHR0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTWVzaCh0aGlzLnNoYXJlZENpcmNsZUdlb21ldHJ5LHRoaXMubWF0ZXJpYWwpO1xuXG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnNldCh0aGlzLngsdGhpcy55LHRoaXMueik7XG5cdFx0dGhpcy5tZXNoLnNjYWxlLnNldFNjYWxhcih0aGlzLndpZHRoLzIpO1xuXHRcdHRocmVlRW52aXJvbm1lbnQuc2NlbmUuYWRkKHRoaXMubWVzaCk7XG5cblx0XHR0aGlzLnggPSBvcHRpb25zLnggfHwgMDtcblx0XHR0aGlzLnkgPSBvcHRpb25zLnkgfHwgMDtcblx0XHR0aGlzLnogPSBvcHRpb25zLnogfHwgMDtcblx0fVxuXHRyZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG5cdFx0dGhyZWVFbnZpcm9ubWVudC5zY2VuZS5yZW1vdmUodGhpcy5tZXNoKTtcblx0fVxuXHRzZXQgeChpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueCA9IGk7XG5cdH1cblx0c2V0IHkoaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnkgPSBpO1xuXHR9XG5cdHNldCB6KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi56ID0gaTtcblx0fVxuXHRnZXQgeCgpe1xuXHRcdHJldHVybiB0aGlzLm1lc2gucG9zaXRpb24ueDtcblx0fVxuXHRnZXQgeSgpe1xuXHRcdHJldHVybiB0aGlzLm1lc2gucG9zaXRpb24ueTtcblx0fVxuXHRnZXQgeigpe1xuXHRcdHJldHVybiB0aGlzLm1lc2gucG9zaXRpb24uejtcblx0fVxufVxuUG9pbnRNZXNoLnByb3RvdHlwZS5zaGFyZWRDaXJjbGVHZW9tZXRyeSA9IG5ldyBUSFJFRS5TcGhlcmVHZW9tZXRyeSgxLzIsIDgsIDYpOyAvL3JhZGl1cyAxLzIgbWFrZXMgZGlhbWV0ZXIgMSwgc28gdGhhdCBzY2FsaW5nIGJ5IG4gbWVhbnMgd2lkdGg9blxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdFBvaW50KCl7XG5cdHZhciB4ID0gbmV3IEVYUC5BcmVhKHtib3VuZHM6IFtbLTEwLDEwXV19KTtcblx0dmFyIHkgPSBuZXcgRVhQLlRyYW5zZm9ybWF0aW9uKHsnZXhwcic6ICh4KSA9PiB4Knh9KTtcblx0dmFyIHkgPSBuZXcgRVhQLlBvaW50T3V0cHV0KCk7XG5cdHguYWRkKHkpO1xuXHR5LmFkZCh6KTtcblx0eC5hY3RpdmF0ZSgpO1xufVxuXG5leHBvcnQge1BvaW50T3V0cHV0LCBQb2ludE1lc2h9XG4iLCJpbXBvcnQgeyBMaW5lT3V0cHV0IH0gZnJvbSAnLi9MaW5lT3V0cHV0LmpzJztcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi4vdXRpbHMuanMnO1xuaW1wb3J0IHsgdGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4uL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5leHBvcnQgY2xhc3MgVmVjdG9yT3V0cHV0IGV4dGVuZHMgTGluZU91dHB1dHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuICAgICAgICAvKlxuICAgICAgICAgICAgICAgIHdpZHRoOiBudW1iZXIuIHVuaXRzIGFyZSBpbiBzY3JlZW5ZLzQwMC5cbiAgICAgICAgICAgICAgICBvcGFjaXR5OiBudW1iZXJcbiAgICAgICAgICAgICAgICBjb2xvcjogaGV4IGNvZGUgb3IgVEhSRUUuQ29sb3IoKVxuICAgICAgICAgICAgICAgIGxpbmVKb2luOiBcImJldmVsXCIgb3IgXCJyb3VuZFwiLiBkZWZhdWx0OiByb3VuZC4gRG9uJ3QgY2hhbmdlIHRoaXMgYWZ0ZXIgaW5pdGlhbGl6YXRpb24uXG4gICAgICAgICovXG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgfVxuICAgIGluaXQoKXtcbiAgICAgICAgdGhpcy5hcnJvd01hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtjb2xvcjogdGhpcy5fY29sb3IsIGxpbmV3aWR0aDogdGhpcy5fd2lkdGgsIG9wYWNpdHk6dGhpcy5fb3BhY2l0eX0pO1xuXG4gICAgICAgIHN1cGVyLmluaXQoKTtcbiAgICAgICAgdGhpcy5hcnJvd2hlYWRzID0gW107XG5cbiAgICAgICAgLy9UT0RPOiBtYWtlIHRoZSBhcnJvdyB0aXAgY29sb3JzIG1hdGNoIHRoZSBjb2xvcnMgb2YgdGhlIGxpbmVzJyB0aXBzXG5cbiAgICAgICAgY29uc3QgY2lyY2xlUmVzb2x1dGlvbiA9IDEyO1xuICAgICAgICBjb25zdCBhcnJvd2hlYWRTaXplID0gMC4zO1xuICAgICAgICBjb25zdCBFUFNJTE9OID0gMC4wMDAwMTtcbiAgICAgICAgdGhpcy5FUFNJTE9OID0gRVBTSUxPTjtcblxuICAgICAgICB0aGlzLmNvbmVHZW9tZXRyeSA9IG5ldyBUSFJFRS5DeWxpbmRlckJ1ZmZlckdlb21ldHJ5KCAwLCBhcnJvd2hlYWRTaXplLCBhcnJvd2hlYWRTaXplKjEuNywgY2lyY2xlUmVzb2x1dGlvbiwgMSApO1xuICAgICAgICBsZXQgYXJyb3doZWFkT3ZlcnNob290RmFjdG9yID0gMC4xOyAvL3VzZWQgc28gdGhhdCB0aGUgbGluZSB3b24ndCBydWRlbHkgY2xpcCB0aHJvdWdoIHRoZSBwb2ludCBvZiB0aGUgYXJyb3doZWFkXG4gICAgICAgIHRoaXMuY29uZUdlb21ldHJ5LnRyYW5zbGF0ZSggMCwgLSBhcnJvd2hlYWRTaXplICsgYXJyb3doZWFkT3ZlcnNob290RmFjdG9yLCAwICk7XG4gICAgICAgIHRoaXMuX2NvbmVVcERpcmVjdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsMSwwKTtcbiAgICB9XG4gICAgX29uRmlyc3RBY3RpdmF0aW9uKCl7XG4gICAgICAgIHN1cGVyLl9vbkZpcnN0QWN0aXZhdGlvbigpO1xuXG4gICAgICAgIGlmKHRoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoID4gMSl7XG4gICAgICAgICAgICB0aGlzLm51bUFycm93aGVhZHMgPSB0aGlzLml0ZW1EaW1lbnNpb25zLnNsaWNlKDAsdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMSkucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cnJlbnQpe1xuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyZW50ICsgcHJldjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIC8vYXNzdW1lZCBpdGVtRGltZW5zaW9ucyBpc24ndCBhIG5vbnplcm8gYXJyYXkuIFRoYXQgc2hvdWxkIGJlIHRoZSBjb25zdHJ1Y3RvcidzIHByb2JsZW0uXG4gICAgICAgICAgICB0aGlzLm51bUFycm93aGVhZHMgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9yZW1vdmUgYW55IHByZXZpb3VzIGFycm93aGVhZHNcbiAgICAgICAgZm9yKHZhciBpPTA7aTx0aGlzLmFycm93aGVhZHMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICBsZXQgYXJyb3cgPSB0aGlzLmFycm93aGVhZHNbaV07XG4gICAgICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZShhcnJvdyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmFycm93aGVhZHMgPSBuZXcgQXJyYXkodGhpcy5udW1BcnJvd2hlYWRzKTtcbiAgICAgICAgZm9yKHZhciBpPTA7aTx0aGlzLm51bUFycm93aGVhZHM7aSsrKXtcbiAgICAgICAgICAgIHRoaXMuYXJyb3doZWFkc1tpXSA9IG5ldyBUSFJFRS5NZXNoKHRoaXMuY29uZUdlb21ldHJ5LCB0aGlzLmFycm93TWF0ZXJpYWwpO1xuICAgICAgICAgICAgdGhpcy5tZXNoLmFkZCh0aGlzLmFycm93aGVhZHNbaV0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcbiAgICAgICAgLy9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuICAgICAgICBzdXBlci5ldmFsdWF0ZVNlbGYoaSx0LHgseSx6KTtcblxuICAgICAgICBjb25zdCBsYXN0RGltZW5zaW9uTGVuZ3RoID0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXTtcbiAgICAgICAgbGV0IGZpcnN0Q29vcmRpbmF0ZSA9IGkgJSBsYXN0RGltZW5zaW9uTGVuZ3RoO1xuXG4gICAgICAgIC8vYm9vbGVhbiB2YXJpYWJsZXMuIGlmIGluIHRoZSBmdXR1cmUgTGluZU91dHB1dCBjYW4gc3VwcG9ydCB2YXJpYWJsZS13aWR0aCBsaW5lcywgdGhlc2Ugc2hvdWxkIGViIGNoYW5nZWRcbiAgICAgICAgbGV0IHN0YXJ0aW5nTmV3TGluZSA9IGZpcnN0Q29vcmRpbmF0ZSA9PSAwO1xuICAgICAgICBsZXQgZW5kaW5nTmV3TGluZSA9IGZpcnN0Q29vcmRpbmF0ZSA9PSBsYXN0RGltZW5zaW9uTGVuZ3RoLTE7XG5cbiAgICAgICAgaWYoZW5kaW5nTmV3TGluZSl7XG4gICAgICAgICAgICAvL3dlIG5lZWQgdG8gdXBkYXRlIGFycm93c1xuICAgICAgICAgICAgLy9jYWxjdWxhdGUgZGlyZWN0aW9uIG9mIGxhc3QgbGluZSBzZWdtZW50XG4gICAgICAgICAgICAvL3RoaXMgcG9pbnQgaXMgY3VycmVudFBvaW50SW5kZXgtMSBiZWNhdXNlIGN1cnJlbnRQb2ludEluZGV4IHdhcyBpbmNyZWFzZWQgYnkgMSBkdXJpbmcgc3VwZXIuZXZhbHVhdGVTZWxmKClcbiAgICAgICAgICAgIGxldCBpbmRleCA9ICh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0xKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjQ7XG5cbiAgICAgICAgICAgIGxldCBwcmV2WCA9IHRoaXMuX3ZlcnRpY2VzWyh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0yKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjRdO1xuICAgICAgICAgICAgbGV0IHByZXZZID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTIpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNCsxXTtcbiAgICAgICAgICAgIGxldCBwcmV2WiA9IHRoaXMuX3ZlcnRpY2VzWyh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0yKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjQrMl07XG5cbiAgICAgICAgICAgIGxldCBkeCA9IHByZXZYIC0gdGhpcy5fdmVydGljZXNbaW5kZXhdO1xuICAgICAgICAgICAgbGV0IGR5ID0gcHJldlkgLSB0aGlzLl92ZXJ0aWNlc1tpbmRleCsxXTtcbiAgICAgICAgICAgIGxldCBkeiA9IHByZXZaIC0gdGhpcy5fdmVydGljZXNbaW5kZXgrMl07XG5cbiAgICAgICAgICAgIGxldCBsaW5lTnVtYmVyID0gTWF0aC5mbG9vcihpIC8gbGFzdERpbWVuc2lvbkxlbmd0aCk7XG4gICAgICAgICAgICBVdGlscy5hc3NlcnQobGluZU51bWJlciA8PSB0aGlzLm51bUFycm93aGVhZHMpOyAvL3RoaXMgbWF5IGJlIHdyb25nXG5cbiAgICAgICAgICAgIGxldCBkaXJlY3Rpb25WZWN0b3IgPSBuZXcgVEhSRUUuVmVjdG9yMygtZHgsLWR5LC1keik7XG5cbiAgICAgICAgICAgIC8vTWFrZSBhcnJvd3MgZGlzYXBwZWFyIGlmIHRoZSBsaW5lIGlzIHNtYWxsIGVub3VnaFxuICAgICAgICAgICAgLy9PbmUgd2F5IHRvIGRvIHRoaXMgd291bGQgYmUgdG8gc3VtIHRoZSBkaXN0YW5jZXMgb2YgYWxsIGxpbmUgc2VnbWVudHMuIEknbSBjaGVhdGluZyBoZXJlIGFuZCBqdXN0IG1lYXN1cmluZyB0aGUgZGlzdGFuY2Ugb2YgdGhlIGxhc3QgdmVjdG9yLCB0aGVuIG11bHRpcGx5aW5nIGJ5IHRoZSBudW1iZXIgb2YgbGluZSBzZWdtZW50cyAobmFpdmVseSBhc3N1bWluZyBhbGwgbGluZSBzZWdtZW50cyBhcmUgdGhlIHNhbWUgbGVuZ3RoKVxuICAgICAgICAgICAgbGV0IGxlbmd0aCA9IGRpcmVjdGlvblZlY3Rvci5sZW5ndGgoKSAqIChsYXN0RGltZW5zaW9uTGVuZ3RoLTEpO1xuXG4gICAgICAgICAgICBjb25zdCBlZmZlY3RpdmVEaXN0YW5jZSA9IDM7XG4gICAgICAgICAgICBsZXQgY2xhbXBlZExlbmd0aCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGxlbmd0aC9lZmZlY3RpdmVEaXN0YW5jZSwgMSkpO1xuXG4gICAgICAgICAgICAvL3NocmluayBmdW5jdGlvbiBkZXNpZ25lZCB0byBoYXZlIGEgc3RlZXAgc2xvcGUgY2xvc2UgdG8gMCBidXQgbWVsbG93IG91dCBhdCAwLjUgb3Igc28gaW4gb3JkZXIgdG8gYXZvaWQgdGhlIGxpbmUgd2lkdGggb3ZlcmNvbWluZyB0aGUgYXJyb3doZWFkIHdpZHRoXG4gICAgICAgICAgICAvL0luIENocm9tZSwgdGhyZWUuanMgY29tcGxhaW5zIHdoZW5ldmVyIHNvbWV0aGluZyBpcyBzZXQgdG8gMCBzY2FsZS4gQWRkaW5nIGFuIGVwc2lsb24gdGVybSBpcyB1bmZvcnR1bmF0ZSBidXQgbmVjZXNzYXJ5IHRvIGF2b2lkIGNvbnNvbGUgc3BhbS5cbiAgICAgICAgICAgIHRoaXMuYXJyb3doZWFkc1tsaW5lTnVtYmVyXS5zY2FsZS5zZXRTY2FsYXIoTWF0aC5hY29zKDEtMipjbGFtcGVkTGVuZ3RoKS9NYXRoLlBJICsgdGhpcy5FUFNJTE9OKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgIC8vcG9zaXRpb24vcm90YXRpb24gY29tZXMgYWZ0ZXIgc2luY2UgLm5vcm1hbGl6ZSgpIG1vZGlmaWVzIGRpcmVjdGlvblZlY3RvciBpbiBwbGFjZVxuICAgICAgICAgICAgbGV0IHBvcyA9IHRoaXMuYXJyb3doZWFkc1tsaW5lTnVtYmVyXS5wb3NpdGlvbjtcbiAgICAgICAgICAgIHBvcy54ID0geCA9PT0gdW5kZWZpbmVkID8gMCA6IHg7XG4gICAgICAgICAgICBwb3MueSA9IHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuICAgICAgICAgICAgcG9zLnogPSB6ID09PSB1bmRlZmluZWQgPyAwIDogejtcblxuICAgICAgICAgICAgaWYobGVuZ3RoID4gMCl7IC8vZGlyZWN0aW9uVmVjdG9yLm5vcm1hbGl6ZSgpIGZhaWxzIHdpdGggMCBsZW5ndGhcbiAgICAgICAgICAgICAgICB0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0ucXVhdGVybmlvbi5zZXRGcm9tVW5pdFZlY3RvcnModGhpcy5fY29uZVVwRGlyZWN0aW9uLCBkaXJlY3Rpb25WZWN0b3Iubm9ybWFsaXplKCkgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldCBjb2xvcihjb2xvcil7XG4gICAgICAgIC8vY3VycmVudGx5IG9ubHkgYSBzaW5nbGUgY29sb3IgaXMgc3VwcG9ydGVkLlxuICAgICAgICAvL0kgc2hvdWxkIHJlYWxseSBtYWtlIGl0IHBvc3NpYmxlIHRvIHNwZWNpZnkgY29sb3IgYnkgYSBmdW5jdGlvbi5cbiAgICAgICAgdGhpcy5fY29sb3IgPSBjb2xvcjtcbiAgICAgICAgdGhpcy5zZXRBbGxWZXJ0aWNlc1RvQ29sb3IoY29sb3IpO1xuICAgICAgICB0aGlzLmFycm93TWF0ZXJpYWwuY29sb3IgPSBuZXcgVEhSRUUuQ29sb3IodGhpcy5fY29sb3IpO1xuICAgIH1cblxuICAgIGdldCBjb2xvcigpe1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgc2V0IG9wYWNpdHkob3BhY2l0eSl7XG4gICAgICAgIHRoaXMuYXJyb3dNYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcbiAgICAgICAgdGhpcy5hcnJvd01hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMSB8fCB0aGlzLmxpbmVKb2luVHlwZSA9PSBcIlJPVU5EXCI7XG4gICAgICAgIHRoaXMuYXJyb3dNYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cbiAgICAgICAgLy9tZXNoIGlzIGFsd2F5cyB0cmFuc3BhcmVudFxuICAgICAgICB0aGlzLm1hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnZpc2libGUgPSBvcGFjaXR5ID4gMDtcbiAgICAgICAgdGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLm9wYWNpdHkudmFsdWUgPSBvcGFjaXR5O1xuICAgIH1cblxuICAgIGdldCBvcGFjaXR5KCl7XG4gICAgICAgIHJldHVybiB0aGlzLl9vcGFjaXR5O1xuICAgIH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG4gICAgICAgIHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG4gICAgICAgIGZvcih2YXIgaT0wO2k8dGhpcy5udW1BcnJvd2hlYWRzO2krKyl7XG4gICAgICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLmFycm93aGVhZHNbaV0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNsb25lKCl7XG4gICAgICAgIHJldHVybiBuZXcgVmVjdG9yT3V0cHV0KHt3aWR0aDogdGhpcy53aWR0aCwgY29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eSxsaW5lSm9pblR5cGU6IHRoaXMubGluZUpvaW5UeXBlfSk7XG4gICAgfVxufVxuXG5cbiIsIi8vU3VyZmFjZU91dHB1dFNoYWRlcnMuanNcblxuLy9leHBlcmltZW50OiBzaGFkZXJzIHRvIGdldCB0aGUgdHJpYW5nbGUgcHVsc2F0aW5nIVxudmFyIHZTaGFkZXIgPSBbXG5cInZhcnlpbmcgdmVjMyB2Tm9ybWFsO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgdlBvc2l0aW9uO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgdlV2O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IHRpbWU7XCIsXG5cInVuaWZvcm0gdmVjMyBjb2xvcjtcIixcblwidW5pZm9ybSB2ZWMzIHZMaWdodDtcIixcblwidW5pZm9ybSBmbG9hdCBncmlkU3F1YXJlcztcIixcblxuXCJ2b2lkIG1haW4oKSB7XCIsXG5cdFwidlBvc2l0aW9uID0gcG9zaXRpb24ueHl6O1wiLFxuXHRcInZOb3JtYWwgPSBub3JtYWwueHl6O1wiLFxuXHRcInZVdiA9IHV2Lnh5O1wiLFxuXHRcImdsX1Bvc2l0aW9uID0gcHJvamVjdGlvbk1hdHJpeCAqXCIsXG4gICAgICAgICAgICBcIm1vZGVsVmlld01hdHJpeCAqXCIsXG4gICAgICAgICAgICBcInZlYzQocG9zaXRpb24sMS4wKTtcIixcblwifVwiXS5qb2luKFwiXFxuXCIpXG5cbnZhciBmU2hhZGVyID0gW1xuXCIjZXh0ZW5zaW9uIEdMX09FU19zdGFuZGFyZF9kZXJpdmF0aXZlcyA6IGVuYWJsZVwiLFxuXCJ2YXJ5aW5nIHZlYzMgdk5vcm1hbDtcIixcblwidmFyeWluZyB2ZWMzIHZQb3NpdGlvbjtcIixcblwidmFyeWluZyB2ZWMyIHZVdjtcIixcblwidW5pZm9ybSBmbG9hdCB0aW1lO1wiLFxuXCJ1bmlmb3JtIHZlYzMgY29sb3I7XCIsXG5cInVuaWZvcm0gZmxvYXQgdXNlQ3VzdG9tR3JpZENvbG9yO1wiLFxuXCJ1bmlmb3JtIHZlYzMgZ3JpZENvbG9yO1wiLFxuXCJ1bmlmb3JtIHZlYzMgdkxpZ2h0O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGdyaWRTcXVhcmVzO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGxpbmVXaWR0aDtcIixcblwidW5pZm9ybSBmbG9hdCBzaG93R3JpZDtcIixcblwidW5pZm9ybSBmbG9hdCBzaG93U29saWQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcIixcblxuXHQvL3RoZSBmb2xsb3dpbmcgY29kZSBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS91bmNvbmVkL21hdGhib3gvYmxvYi9lYWViOGUxNWVmMmQwMjUyNzQwYTc0NTA1YTEyZDdhMTA1MWE2MWI2L3NyYy9zaGFkZXJzL2dsc2wvbWVzaC5mcmFnbWVudC5zaGFkZWQuZ2xzbFxuXCJ2ZWMzIG9mZlNwZWN1bGFyKHZlYzMgY29sb3IpIHtcIixcblwiICB2ZWMzIGMgPSAxLjAgLSBjb2xvcjtcIixcblwiICByZXR1cm4gMS4wIC0gYyAqIGM7XCIsXG5cIn1cIixcblxuXCJ2ZWM0IGdldFNoYWRlZENvbG9yKHZlYzMgcmdiKSB7IFwiLFxuXCIgIHZlYzMgY29sb3IgPSByZ2IueHl6O1wiLFxuXCIgIHZlYzMgY29sb3IyID0gb2ZmU3BlY3VsYXIocmdiLnh5eik7XCIsXG5cblwiICB2ZWMzIG5vcm1hbCA9IG5vcm1hbGl6ZSh2Tm9ybWFsKTtcIixcblwiICB2ZWMzIGxpZ2h0ID0gbm9ybWFsaXplKHZMaWdodCk7XCIsXG5cIiAgdmVjMyBwb3NpdGlvbiA9IG5vcm1hbGl6ZSh2UG9zaXRpb24pO1wiLFxuXG5cIiAgZmxvYXQgc2lkZSAgICA9IGdsX0Zyb250RmFjaW5nID8gLTEuMCA6IDEuMDtcIixcblwiICBmbG9hdCBjb3NpbmUgID0gc2lkZSAqIGRvdChub3JtYWwsIGxpZ2h0KTtcIixcblwiICBmbG9hdCBkaWZmdXNlID0gbWl4KG1heCgwLjAsIGNvc2luZSksIC41ICsgLjUgKiBjb3NpbmUsIC4xKTtcIixcblxuXCIgIGZsb2F0IHJpbUxpZ2h0aW5nID0gbWF4KG1pbigxLjAgLSBzaWRlKmRvdChub3JtYWwsIGxpZ2h0KSwgMS4wKSwwLjApO1wiLFxuXG5cIlx0ZmxvYXQgc3BlY3VsYXIgPSBtYXgoMC4wLCBhYnMoY29zaW5lKSAtIDAuNSk7XCIsIC8vZG91YmxlIHNpZGVkIHNwZWN1bGFyXG5cIiAgIHJldHVybiB2ZWM0KGRpZmZ1c2UqY29sb3IgKyAwLjkqcmltTGlnaHRpbmcqY29sb3IgKyAwLjQqY29sb3IyICogc3BlY3VsYXIsMS4wKTtcIixcblwifVwiLFxuXG4vLyBTbW9vdGggSFNWIHRvIFJHQiBjb252ZXJzaW9uIGZyb20gaHR0cHM6Ly93d3cuc2hhZGVydG95LmNvbS92aWV3L01zUzNXY1xuXCJ2ZWMzIGhzdjJyZ2Jfc21vb3RoKCBpbiB2ZWMzIGMgKXtcIixcblwiICAgIHZlYzMgcmdiID0gY2xhbXAoIGFicyhtb2QoYy54KjYuMCt2ZWMzKDAuMCw0LjAsMi4wKSw2LjApLTMuMCktMS4wLCAwLjAsIDEuMCApO1wiLFxuXCJcdHJnYiA9IHJnYipyZ2IqKDMuMC0yLjAqcmdiKTsgLy8gY3ViaWMgc21vb3RoaW5nXHRcIixcblwiXHRyZXR1cm4gYy56ICogbWl4KCB2ZWMzKDEuMCksIHJnYiwgYy55KTtcIixcblwifVwiLFxuXG4vL0Zyb20gU2FtIEhvY2V2YXI6IGh0dHA6Ly9sb2xlbmdpbmUubmV0L2Jsb2cvMjAxMy8wNy8yNy9yZ2ItdG8taHN2LWluLWdsc2xcblwidmVjMyByZ2IyaHN2KHZlYzMgYyl7XCIsXG5cIiAgICB2ZWM0IEsgPSB2ZWM0KDAuMCwgLTEuMCAvIDMuMCwgMi4wIC8gMy4wLCAtMS4wKTtcIixcblwiICAgIHZlYzQgcCA9IG1peCh2ZWM0KGMuYmcsIEsud3opLCB2ZWM0KGMuZ2IsIEsueHkpLCBzdGVwKGMuYiwgYy5nKSk7XCIsXG5cIiAgICB2ZWM0IHEgPSBtaXgodmVjNChwLnh5dywgYy5yKSwgdmVjNChjLnIsIHAueXp4KSwgc3RlcChwLngsIGMucikpO1wiLFxuXG5cIiAgICBmbG9hdCBkID0gcS54IC0gbWluKHEudywgcS55KTtcIixcblwiICAgIGZsb2F0IGUgPSAxLjBlLTEwO1wiLFxuXCIgICAgcmV0dXJuIHZlYzMoYWJzKHEueiArIChxLncgLSBxLnkpIC8gKDYuMCAqIGQgKyBlKSksIGQgLyAocS54ICsgZSksIHEueCk7XCIsXG5cIn1cIixcbiAvL2Nob29zZXMgdGhlIGNvbG9yIGZvciB0aGUgZ3JpZGxpbmVzIGJ5IHZhcnlpbmcgbGlnaHRuZXNzLiBcbi8vTk9UIGNvbnRpbnVvdXMgb3IgZWxzZSBieSB0aGUgaW50ZXJtZWRpYXRlIGZ1bmN0aW9uIHRoZW9yZW0gdGhlcmUnZCBiZSBhIHBvaW50IHdoZXJlIHRoZSBncmlkbGluZXMgd2VyZSB0aGUgc2FtZSBjb2xvciBhcyB0aGUgbWF0ZXJpYWwuXG5cInZlYzMgYXV0b0NhbGN1bGF0ZWRHcmlkTGluZUNvbG9yKHZlYzMgZGlmZnVzZUNvbG9yKXtcIixcblwiIHZlYzMgaHN2ID0gcmdiMmhzdihkaWZmdXNlQ29sb3IueHl6KTtcIixcblwiIC8vaHN2LnggKz0gMC4xO1wiLFxuXCIgaWYoaHN2LnogPCAwLjgpe2hzdi56ICs9IDAuMjt9ZWxzZXtoc3YueiA9IDAuODUtMC4xKmhzdi56O2hzdi55IC09IDAuMDt9XCIsXG5cIiB2ZWMzIGF1dG9DYWxjdWxhdGVkQ29sb3IgPSBoc3YycmdiX3Ntb290aChoc3YpO1wiLFxuXCIgcmV0dXJuIG1peChhdXRvQ2FsY3VsYXRlZENvbG9yLCBkaWZmdXNlQ29sb3IsICgxLjAtc2hvd1NvbGlkKSooMS4wLXVzZUN1c3RvbUdyaWRDb2xvcikpO1wiLCAvL2lmIHNob3dTb2xpZCBpcyAwLjAgYW5kIHVzZUN1c3RvbUdyaWRDb2xvciBpcyAwLjAsIGp1c3QgdXNlIHRoZSBkaWZmdXNlIGNvbG9yIGFzIHRoZSBncmlkIGNvbG9yXG5cIn1cIixcblxuXCJ2ZWM0IHJlbmRlckdyaWRsaW5lcyh2ZWM0IGV4aXN0aW5nQ29sb3IsIHZlYzIgdXYsIHZlYzMgY2hvc2VuR3JpZExpbmVDb2xvcikge1wiLFxuXCIgIHZlYzIgdmRpc3RUb0dyaWRFZGdlID0gKDAuNS1hYnMobW9kKHZVdi54eSpncmlkU3F1YXJlcywgMS4wKS0wLjUpKTtcIiwgLy90aGFua3MsIGRlc21vc1xuXCIgIGZsb2F0IGRpc3RUb0dyaWRFZGdlID0gbWluKHZkaXN0VG9HcmlkRWRnZS54LHZkaXN0VG9HcmlkRWRnZS55KTtcIixcblwiICB2ZWM0IGJsZW5kZWRHcmlkTGluZUNvbG9yID0gc2hvd0dyaWQgKiB2ZWM0KGNob3NlbkdyaWRMaW5lQ29sb3IsMS4wKSArICgxLjAtc2hvd0dyaWQpKmV4aXN0aW5nQ29sb3IucmdiYTtcIiwgLy9pZiBzaG93R3JpZCA9MCwgdXNlIHNvbGlkQ29sb3IgYXMgdGhlIGdyaWRsaW5lIGNvbG9yLCBoaWRpbmcgdGhlIGdyaWRcblwiICBmbG9hdCBibGVuZEJldHdlZW5HcmlkQ29sb3JWc1NvbGlkQ29sb3JGYWN0b3IgPSAoc21vb3Roc3RlcChsaW5lV2lkdGgtMS4qZndpZHRoKGRpc3RUb0dyaWRFZGdlKSwgbGluZVdpZHRoLCBkaXN0VG9HcmlkRWRnZSkpO1wiLCAvL2lmIGRpc3RUb0VkZ2UueCA8IGxpbmVXaWR0aCB8fCBkaXN0VG9FZGdlLnkgPCBsaW5lV2lkdGgsIGJ1dCB3aXRoIGEgc21vb3Roc3RlcFxuXCIgIHJldHVybiBtaXgoYmxlbmRlZEdyaWRMaW5lQ29sb3IsZXhpc3RpbmdDb2xvcixibGVuZEJldHdlZW5HcmlkQ29sb3JWc1NvbGlkQ29sb3JGYWN0b3IpO1wiLFxuXCJ9XCIsXG4vKlxuXCJ2ZWM0IGdldFNoYWRlZENvbG9yTWF0aGJveCh2ZWM0IHJnYmEpIHsgXCIsXG5cIiAgdmVjMyBjb2xvciA9IHJnYmEueHl6O1wiLFxuXCIgIHZlYzMgY29sb3IyID0gb2ZmU3BlY3VsYXIocmdiYS54eXopO1wiLFxuXG5cIiAgdmVjMyBub3JtYWwgPSBub3JtYWxpemUodk5vcm1hbCk7XCIsXG5cIiAgdmVjMyBsaWdodCA9IG5vcm1hbGl6ZSh2TGlnaHQpO1wiLFxuXCIgIHZlYzMgcG9zaXRpb24gPSBub3JtYWxpemUodlBvc2l0aW9uKTtcIixcblwiICBmbG9hdCBzaWRlICAgID0gZ2xfRnJvbnRGYWNpbmcgPyAtMS4wIDogMS4wO1wiLFxuXCIgIGZsb2F0IGNvc2luZSAgPSBzaWRlICogZG90KG5vcm1hbCwgbGlnaHQpO1wiLFxuXCIgIGZsb2F0IGRpZmZ1c2UgPSBtaXgobWF4KDAuMCwgY29zaW5lKSwgLjUgKyAuNSAqIGNvc2luZSwgLjEpO1wiLFxuXCIgICB2ZWMzICBoYWxmTGlnaHQgPSBub3JtYWxpemUobGlnaHQgKyBwb3NpdGlvbik7XCIsXG5cIlx0ZmxvYXQgY29zaW5lSGFsZiA9IG1heCgwLjAsIHNpZGUgKiBkb3Qobm9ybWFsLCBoYWxmTGlnaHQpKTtcIixcblwiXHRmbG9hdCBzcGVjdWxhciA9IHBvdyhjb3NpbmVIYWxmLCAxNi4wKTtcIixcblwiXHRyZXR1cm4gdmVjNChjb2xvciAqIChkaWZmdXNlICogLjkgKyAuMDUpICowLjAgKyAgLjI1ICogY29sb3IyICogc3BlY3VsYXIsIHJnYmEuYSk7XCIsXG5cIn1cIiwqL1xuXG5cInZvaWQgbWFpbigpe1wiLFxuLy9cIiAgLy9nbF9GcmFnQ29sb3IgPSB2ZWM0KHZOb3JtYWwueHl6LCAxLjApOyAvLyB2aWV3IGRlYnVnIG5vcm1hbHNcIixcbi8vXCIgIC8vaWYodk5vcm1hbC54IDwgMC4wKXtnbF9GcmFnQ29sb3IgPSB2ZWM0KG9mZlNwZWN1bGFyKGNvbG9yLnJnYiksIDEuMCk7fWVsc2V7Z2xfRnJhZ0NvbG9yID0gdmVjNCgoY29sb3IucmdiKSwgMS4wKTt9XCIsIC8vdmlldyBzcGVjdWxhciBhbmQgbm9uLXNwZWN1bGFyIGNvbG9yc1xuLy9cIiAgZ2xfRnJhZ0NvbG9yID0gdmVjNChtb2QodlV2Lnh5LDEuMCksMC4wLDEuMCk7IC8vc2hvdyB1dnNcblwiICB2ZWM0IHNvbGlkQ29sb3IgPSBzaG93U29saWQqc2hvd1NvbGlkKnZlYzQoY29sb3IucmdiLCAxLjApO1wiLFxuXCIgIHZlYzQgc29saWRDb2xvck91dCA9IHNob3dTb2xpZCpnZXRTaGFkZWRDb2xvcihjb2xvci5yZ2IpO1wiLFxuXCIgIHZlYzMgY2hvc2VuR3JpZExpbmVDb2xvciA9IG1peChhdXRvQ2FsY3VsYXRlZEdyaWRMaW5lQ29sb3IoY29sb3IucmdiKSwgZ3JpZENvbG9yLCB1c2VDdXN0b21HcmlkQ29sb3IpOyBcIiwgLy91c2UgZWl0aGVyIGF1dG9DYWxjdWxhdGVkR3JpZExpbmVDb2xvcihjb2xvcikgb3Igb3ZlcnJpZGUgd2l0aCB1c2VyLXNwZWNpZmllZCBncmlkQ29sb3IgdmFyaWFibGUuXG5cIiAgdmVjNCBjb2xvcldpdGhHcmlkbGluZXMgPSByZW5kZXJHcmlkbGluZXMoc29saWRDb2xvck91dCwgdlV2Lnh5LCBjaG9zZW5HcmlkTGluZUNvbG9yKTtcIixcblwiICBjb2xvcldpdGhHcmlkbGluZXMuYSAqPSBvcGFjaXR5O1wiLFxuXCIgIGdsX0ZyYWdDb2xvciA9IGNvbG9yV2l0aEdyaWRsaW5lcztcIixcdFxuXCJ9XCJdLmpvaW4oXCJcXG5cIilcblxudmFyIHVuaWZvcm1zID0ge1xuXHR0aW1lOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAwLFxuXHR9LFxuXHRjb2xvcjoge1xuXHRcdHR5cGU6ICdjJyxcblx0XHR2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KSxcblx0fSxcblx0dXNlQ3VzdG9tR3JpZENvbG9yOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAwLFxuXHR9LFxuXHRncmlkQ29sb3I6IHtcblx0XHR0eXBlOiAnYycsXG5cdFx0dmFsdWU6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSksXG5cdH0sXG5cdG9wYWNpdHk6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDAuMSxcblx0fSxcblx0dkxpZ2h0OiB7IC8vbGlnaHQgZGlyZWN0aW9uXG5cdFx0dHlwZTogJ3ZlYzMnLFxuXHRcdHZhbHVlOiBbMCwwLDFdLFxuXHR9LFxuXHRncmlkU3F1YXJlczoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogNCxcblx0fSxcblx0bGluZVdpZHRoOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAwLjEsXG5cdH0sXG5cdHNob3dHcmlkOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAxLjAsXG5cdH0sXG5cdHNob3dTb2xpZDoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMS4wLFxuXHR9XG59O1xuXG5leHBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcyB9O1xuIiwiaW1wb3J0IHtPdXRwdXROb2RlfSBmcm9tICcuLi9Ob2RlLmpzJztcbmltcG9ydCB7TGluZU91dHB1dH0gZnJvbSAnLi9MaW5lT3V0cHV0LmpzJztcbmltcG9ydCB7IGdldFRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuLi9UaHJlZUVudmlyb25tZW50LmpzJztcbmltcG9ydCB7IHZTaGFkZXIsIGZTaGFkZXIsIHVuaWZvcm1zIH0gZnJvbSAnLi9TdXJmYWNlT3V0cHV0U2hhZGVycy5qcyc7XG5cbmNsYXNzIFN1cmZhY2VPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29ya1xuXHRcdFx0b3B0aW9uczpcblx0XHRcdHtcblx0XHRcdFx0b3BhY2l0eTogbnVtYmVyXG5cdFx0XHRcdGNvbG9yOiBoZXggY29kZSBvciBUSFJFRS5Db2xvcigpLiBEaWZmdXNlIGNvbG9yIG9mIHRoaXMgc3VyZmFjZS5cblx0XHRcdFx0Z3JpZENvbG9yOiBoZXggY29kZSBvciBUSFJFRS5Db2xvcigpLiBJZiBzaG93R3JpZCBpcyB0cnVlLCBncmlkIGxpbmVzIHdpbGwgYXBwZWFyIG92ZXIgdGhpcyBzdXJmYWNlLiBncmlkQ29sb3IgZGV0ZXJtaW5lcyB0aGVpciBjb2xvciBcblx0XHRcdFx0c2hvd0dyaWQ6IGJvb2xlYW4uIElmIHRydWUsIHdpbGwgZGlzcGxheSBhIGdyaWRDb2xvci1jb2xvcmVkIGdyaWQgb3ZlciB0aGUgc3VyZmFjZS4gRGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHRzaG93U29saWQ6IGJvb2xlYW4uIElmIHRydWUsIHdpbGwgZGlzcGxheSBhIHNvbGlkIHN1cmZhY2UuIERlZmF1bHQ6IHRydWVcblx0XHRcdFx0Z3JpZFNxdWFyZXM6IG51bWJlciByZXByZXNlbnRpbmcgaG93IG1hbnkgc3F1YXJlcyBwZXIgZGltZW5zaW9uIHRvIHVzZSBpbiBhIHJlbmRlcmVkIGdyaWRcblx0XHRcdFx0Z3JpZExpbmVXaWR0aDogbnVtYmVyIHJlcHJlc2VudGluZyBob3cgbWFueSBzcXVhcmVzIHBlciBkaW1lbnNpb24gdG8gdXNlIGluIGEgcmVuZGVyZWQgZ3JpZFxuXHRcdFx0fVxuXHRcdCovXG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcblxuXHRcdHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuY29sb3IpIDogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KTtcblxuXHRcdHRoaXMuX2dyaWRDb2xvciA9IG9wdGlvbnMuZ3JpZENvbG9yO1xuICAgICAgICB0aGlzLl91c2VDdXN0b21HcmlkQ29sb3IgPSBvcHRpb25zLmdyaWRDb2xvciAhPT0gdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5fZ3JpZFNxdWFyZXMgPSBvcHRpb25zLmdyaWRTcXVhcmVzICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmdyaWRTcXVhcmVzIDogMTY7XG5cdFx0dGhpcy5fc2hvd0dyaWQgPSBvcHRpb25zLnNob3dHcmlkICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLnNob3dHcmlkIDogdHJ1ZTtcblx0XHR0aGlzLl9zaG93U29saWQgPSBvcHRpb25zLnNob3dTb2xpZCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5zaG93U29saWQgOiB0cnVlO1xuXHRcdHRoaXMuX2dyaWRMaW5lV2lkdGggPSBvcHRpb25zLmdyaWRMaW5lV2lkdGggIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuZ3JpZExpbmVXaWR0aCA6IDAuMTU7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IDA7IC8vc2hvdWxkIGFsd2F5cyBiZSBlcXVhbCB0byB0aGlzLnZlcnRpY2VzLmxlbmd0aFxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbXTsgLy8gaG93IG1hbnkgdGltZXMgdG8gYmUgY2FsbGVkIGluIGVhY2ggZGlyZWN0aW9uXG5cdFx0dGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDM7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/XG5cblx0XHR0aGlzLmluaXQoKTtcblx0fVxuXHRpbml0KCl7XG5cdFx0dGhpcy5fZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcblx0XHR0aGlzLl92ZXJ0aWNlcztcblx0XHR0aGlzLm1ha2VHZW9tZXRyeSgpO1xuXG5cdFx0Ly9tYWtlIGEgZGVlcCBjb3B5IG9mIHRoZSB1bmlmb3JtcyB0ZW1wbGF0ZVxuXHRcdHRoaXMuX3VuaWZvcm1zID0ge307XG5cdFx0Zm9yKHZhciB1bmlmb3JtTmFtZSBpbiB1bmlmb3Jtcyl7XG5cdFx0XHR0aGlzLl91bmlmb3Jtc1t1bmlmb3JtTmFtZV0gPSB7XG5cdFx0XHRcdHR5cGU6IHVuaWZvcm1zW3VuaWZvcm1OYW1lXS50eXBlLFxuXHRcdFx0XHR2YWx1ZTogdW5pZm9ybXNbdW5pZm9ybU5hbWVdLnZhbHVlXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCh7XG5cdFx0XHRzaWRlOiBUSFJFRS5CYWNrU2lkZSxcblx0XHRcdHZlcnRleFNoYWRlcjogdlNoYWRlciwgXG5cdFx0XHRmcmFnbWVudFNoYWRlcjogZlNoYWRlcixcblx0XHRcdHVuaWZvcm1zOiB0aGlzLl91bmlmb3Jtcyxcblx0XHRcdH0pO1xuXHRcdHRoaXMubWVzaCA9IG5ldyBUSFJFRS5NZXNoKHRoaXMuX2dlb21ldHJ5LHRoaXMubWF0ZXJpYWwpO1xuXG5cdFx0dGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy8gc2V0dGVyIHNldHMgdHJhbnNwYXJlbnQgZmxhZyBpZiBuZWNlc3Nhcnlcblx0XHR0aGlzLmNvbG9yID0gdGhpcy5fY29sb3I7IC8vc2V0dGVyIHNldHMgY29sb3IgdW5pZm9ybVxuXHRcdHRoaXMuX3VuaWZvcm1zLm9wYWNpdHkudmFsdWUgPSB0aGlzLl9vcGFjaXR5O1xuXHRcdHRoaXMuX3VuaWZvcm1zLmdyaWRTcXVhcmVzLnZhbHVlID0gdGhpcy5fZ3JpZFNxdWFyZXM7XG5cdFx0dGhpcy5fdW5pZm9ybXMuc2hvd0dyaWQudmFsdWUgPSB0aGlzLnRvTnVtKHRoaXMuX3Nob3dHcmlkKTtcblx0XHR0aGlzLl91bmlmb3Jtcy5zaG93U29saWQudmFsdWUgPSB0aGlzLnRvTnVtKHRoaXMuX3Nob3dTb2xpZCk7XG5cdFx0dGhpcy5fdW5pZm9ybXMubGluZVdpZHRoLnZhbHVlID0gdGhpcy5fZ3JpZExpbmVXaWR0aDtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMudXNlQ3VzdG9tR3JpZENvbG9yLnZhbHVlID0gdGhpcy5fdXNlQ3VzdG9tR3JpZENvbG9yID8gMS4wIDogMC4wO1xuICAgICAgICBpZih0aGlzLl91c2VDdXN0b21HcmlkQ29sb3Ipe1xuXHRcdCAgICB0aGlzLl91bmlmb3Jtcy5ncmlkQ29sb3IudmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IodGhpcy5fZ3JpZENvbG9yKTtcbiAgICAgICAgfVxuXG5cdFx0Z2V0VGhyZWVFbnZpcm9ubWVudCgpLnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXHR9XG4gICAgdG9OdW0oeCl7XG4gICAgICAgIGlmKHggPT0gZmFsc2UpcmV0dXJuIDA7XG4gICAgICAgIGlmKHggPT0gdHJ1ZSlyZXR1cm4gMTtcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgfVxuXHRtYWtlR2VvbWV0cnkoKXtcblxuXHRcdGxldCBNQVhfUE9JTlRTID0gMTAwMDA7XG5cblx0XHR0aGlzLl92ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMpO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KE1BWF9QT0lOVFMgKiAzKTtcblx0XHR0aGlzLl91dnMgPSBuZXcgRmxvYXQzMkFycmF5KE1BWF9QT0lOVFMgKiAyKTtcblxuXHRcdC8vIGJ1aWxkIGdlb21ldHJ5XG5cblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdwb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl92ZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnbm9ybWFsJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX25vcm1hbHMsIDMgKSApO1xuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3V2JywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3V2cywgMiApICk7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vdXNlZCBkdXJpbmcgdXBkYXRlcyBhcyBhIHBvaW50ZXIgdG8gdGhlIGJ1ZmZlclxuXG5cdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IGZhbHNlO1xuXG5cdH1cblx0X3NldFVWcyh1dnMsIGluZGV4LCB1LCB2KXtcblxuXHR9XG5cdF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuICAgICAgICAvL3NldHVwIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLml0ZW1EaW1lbnNpb25zLiB1c2VkIGhlcmUgYWdhaW4gYmVjYXVzZSBjbG9uaW5nIG1lYW5zIHRoZSBvbkFkZCgpIG1pZ2h0IGJlIGNhbGxlZCBiZWZvcmUgdGhpcyBpcyBjb25uZWN0ZWQgdG8gYSB0eXBlIG9mIGRvbWFpblxuXG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIERvbWFpbk5vZGUgd2UncmUgcmVuZGVyaW5nIGZyb21cblx0XHRsZXQgcm9vdCA9IHRoaXMuZ2V0Q2xvc2VzdERvbWFpbigpO1xuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IHJvb3QuaXRlbURpbWVuc2lvbnM7XG5cblx0XHQvLyBwZXJoYXBzIGluc3RlYWQgb2YgZ2VuZXJhdGluZyBhIHdob2xlIG5ldyBhcnJheSwgdGhpcyBjYW4gcmV1c2UgdGhlIG9sZCBvbmU/XG5cdFx0bGV0IHZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMpO1xuXHRcdGxldCBub3JtYWxzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIDMpO1xuXHRcdGxldCB1dnMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogMik7XG5cblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdHRoaXMuX3ZlcnRpY2VzID0gdmVydGljZXM7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdmVydGljZXMpO1xuXHRcdHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblxuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHR0aGlzLl9ub3JtYWxzID0gbm9ybWFscztcblx0XHRub3JtYWxBdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fbm9ybWFscyk7XG5cdFx0bm9ybWFsQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblxuXHRcdGxldCB1dkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMudXY7XG5cblxuXHRcdC8vYXNzZXJ0IHRoaXMuaXRlbURpbWVuc2lvbnNbMF0gKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdID0gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gYW5kIHRoaXMuX291dHB1dERpbWVuc2lvbnMgPT0gMlxuXHRcdHZhciBpbmRpY2VzID0gW107XG5cblx0XHQvL3JlbmRlcmVkIHRyaWFuZ2xlIGluZGljZXNcblx0XHQvL2Zyb20gdGhyZWUuanMgUGxhbmVHZW9tZXRyeS5qc1xuXHRcdGxldCBiYXNlID0gMDtcblx0XHRsZXQgaT0wLCBqPTA7XG5cdFx0Zm9yKGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMTtqKyspe1xuXHRcdFx0Zm9yKGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMTtpKyspe1xuXG5cdFx0XHRcdGxldCBhID0gaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRsZXQgYiA9IGkgKyAoaisxKSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBjID0gKGkrMSkrIChqKzEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGQgPSAoaSsxKSsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cbiAgICAgICAgXHRcdGluZGljZXMucHVzaChhLCBiLCBkKTtcblx0XHRcdFx0aW5kaWNlcy5wdXNoKGIsIGMsIGQpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9kb3VibGUgc2lkZWQgcmV2ZXJzZSBmYWNlc1xuICAgICAgICBcdFx0aW5kaWNlcy5wdXNoKGQsIGIsIGEpO1xuXHRcdFx0XHRpbmRpY2VzLnB1c2goZCwgYywgYik7XG5cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL25vcm1hbHMgKHdpbGwgYmUgb3ZlcndyaXR0ZW4gbGF0ZXIpIGFuZCB1dnNcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtqKyspe1xuXHRcdFx0Zm9yKGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aSsrKXtcblxuXHRcdFx0XHRsZXQgcG9pbnRJbmRleCA9IGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0Ly9zZXQgbm9ybWFsIHRvIFswLDAsMV0gYXMgYSB0ZW1wb3JhcnkgdmFsdWVcblx0XHRcdFx0bm9ybWFsc1socG9pbnRJbmRleCkqM10gPSAwO1xuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozKzFdID0gMDtcblx0XHRcdFx0bm9ybWFsc1socG9pbnRJbmRleCkqMysyXSA9IDE7XG5cblx0XHRcdFx0Ly91dnNcblx0XHRcdFx0dXZzWyhwb2ludEluZGV4KSoyXSA9IGovKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSk7XG5cdFx0XHRcdHV2c1socG9pbnRJbmRleCkqMisxXSA9IGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fdXZzID0gdXZzO1xuXHRcdHV2QXR0cmlidXRlLnNldEFycmF5KHRoaXMuX3V2cyk7XG5cdFx0dXZBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fZ2VvbWV0cnkuc2V0SW5kZXgoIGluZGljZXMgKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXG5cdFx0Ly9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuXG5cdFx0Ly9hc3NlcnQgaSA8IHZlcnRpY2VzLmNvdW50XG5cblx0XHRsZXQgaW5kZXggPSB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuXG5cdCAgICB0aGlzLl92ZXJ0aWNlc1tpbmRleF0gICA9IHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuXHRcdHRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdID0geSA9PT0gdW5kZWZpbmVkID8gMCA6IHk7XG5cdFx0dGhpcy5fdmVydGljZXNbaW5kZXgrMl0gPSB6ID09PSB1bmRlZmluZWQgPyAwIDogejtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4Kys7XG5cdH1cblx0b25BZnRlckFjdGl2YXRpb24oKXtcblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblxuXHRcdHRoaXMuX3JlY2FsY05vcm1hbHMoKTtcblx0XHRsZXQgbm9ybWFsQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5ub3JtYWw7XG5cdFx0bm9ybWFsQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy9yZXNldCBhZnRlciBlYWNoIHVwZGF0ZVxuICAgICAgICBpZih0aGlzLm9wYWNpdHkgPCAxICYmIHRoaXMub3BhY2l0eSA+IDApe1xuICAgICAgICAgICAgdGhpcy5zb3J0RmFjZXNCeURlcHRoKCk7XG4gICAgICAgIH1cblx0fVxuICAgIHNvcnRGYWNlc0J5RGVwdGgoKXtcbiAgICAgICAgLy9pZiB0aGlzIHN1cmZhY2UgaXMgdHJhbnNwYXJlbnQsIGZvciBwcm9wZXIgZmFjZSByZW5kZXJpbmcgd2Ugc2hvdWxkIHNvcnQgdGhlIGZhY2VzIHNvIHRoYXQgdGhleSdyZSBkcmF3biBmcm9tIGJhY2sgdG8gZnJvbnRcbiAgICAgICAgbGV0IGluZGV4QXJyYXkgPSB0aGlzLl9nZW9tZXRyeS5pbmRleC5hcnJheTtcbiAgICAgICAgbGV0IHBvc2l0aW9uQXJyYXkgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uLmFycmF5O1xuXG4gICAgICAgIGxldCBudW1GYWNlcyA9IHRoaXMuX2dlb21ldHJ5LmluZGV4LmFycmF5Lmxlbmd0aC8zO1xuXG4gICAgICAgIGxldCBkaXN0YW5jZXNGb3JFYWNoRmFjZVRvQ2FtZXJhID0gbmV3IEZsb2F0MzJBcnJheShudW1GYWNlcyk7XG4gICAgICAgIGxldCBjYW1lcmFQb3MgPSBnZXRUaHJlZUVudmlyb25tZW50KCkuY2FtZXJhLnBvc2l0aW9uO1xuXG4gICAgICAgIGZvcihsZXQgZmFjZU5vPTA7ZmFjZU5vPG51bUZhY2VzO2ZhY2VObysrKXtcbiAgICAgICAgICAgIC8vIHRoZSBpbmRleCBhcnJheSBzdG9yZXMgdGhlIGluZGljZXMgb2YgdGhlIDMgdmVydGljZXMgd2hpY2ggbWFrZSBhIHRyaWFuZ2xlLCBpbiBvcmRlclxuXHRcdFx0bGV0IHZlcnQxSW5kZXggPSBpbmRleEFycmF5WzMqZmFjZU5vXTtcbiAgICAgICAgICAgIGxldCB2ZXJ0MkluZGV4ID0gaW5kZXhBcnJheVszKmZhY2VObysxXTtcbiAgICAgICAgICAgIGxldCB2ZXJ0M0luZGV4ID0gaW5kZXhBcnJheVszKmZhY2VObysyXTtcblxuICAgICAgICAgICAgbGV0IGNlbnRyb2lkWCA9IChwb3NpdGlvbkFycmF5WzMqdmVydDFJbmRleF0gK3Bvc2l0aW9uQXJyYXlbMyp2ZXJ0MkluZGV4XSAgK3Bvc2l0aW9uQXJyYXlbMyp2ZXJ0M0luZGV4XSkvMztcblx0XHQgICAgbGV0IGNlbnRyb2lkWSA9IChwb3NpdGlvbkFycmF5WzMqdmVydDFJbmRleCsxXStwb3NpdGlvbkFycmF5WzMqdmVydDJJbmRleCsxXStwb3NpdGlvbkFycmF5WzMqdmVydDNJbmRleCsxXSkvMzsgLy9ZXG5cdFx0XHRsZXQgY2VudHJvaWRaID0gKHBvc2l0aW9uQXJyYXlbMyp2ZXJ0MUluZGV4KzJdK3Bvc2l0aW9uQXJyYXlbMyp2ZXJ0MkluZGV4KzJdK3Bvc2l0aW9uQXJyYXlbMyp2ZXJ0M0luZGV4KzJdKS8zO1xuXG4gICAgICAgICAgICAvL2NvbXB1dGUgZGlzdGFuY2UgZnJvbSBjZW50cm9pZCB0byBjYW1lcmFcbiAgICAgICAgICAgIGxldCBkeCA9IGNlbnRyb2lkWCAtIGNhbWVyYVBvcy54O1xuICAgICAgICAgICAgbGV0IGR5ID0gY2VudHJvaWRZIC0gY2FtZXJhUG9zLnk7XG4gICAgICAgICAgICBsZXQgZHogPSBjZW50cm9pZFogLSBjYW1lcmFQb3MuejtcbiAgICAgICAgICAgIGRpc3RhbmNlc0ZvckVhY2hGYWNlVG9DYW1lcmFbZmFjZU5vXSA9IE1hdGguc3FydChkeCpkeCArIGR5KmR5ICsgZHoqZHopO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9ydW4gaW5zZXJ0aW9uIHNvcnQgb24gZGlzdGFuY2VzRm9yRWFjaEZhY2VUb0NhbWVyYS4gZXZlcnkgdGltZSB5b3UgbW92ZSBhIHBpZWNlIHRoZXJlLCBtb3ZlIHRoZSB0aGluZ3MgaW4gaW5kZXhBcnJheSB0b29cbiAgICAgICAgZm9yKGxldCBpPTE7aTxudW1GYWNlcztpKyspe1xuICAgICAgICAgICAgbGV0IGogPSBpO1xuICAgICAgICAgICAgd2hpbGUoaiA+IDAgJiYgZGlzdGFuY2VzRm9yRWFjaEZhY2VUb0NhbWVyYVtqLTFdIDwgZGlzdGFuY2VzRm9yRWFjaEZhY2VUb0NhbWVyYVtqXSl7XG4gICAgICAgICAgICAgICAgLy9zd2FwIGRpc3RhbmNlc0ZvckVhY2hGYWNlVG9DYW1lcmFbal0gYW5kIGRpc3RhbmNlc0ZvckVhY2hGYWNlVG9DYW1lcmFbai0xXVxuICAgICAgICAgICAgICAgIGxldCB0ZW1wID0gZGlzdGFuY2VzRm9yRWFjaEZhY2VUb0NhbWVyYVtqXTtcbiAgICAgICAgICAgICAgICBkaXN0YW5jZXNGb3JFYWNoRmFjZVRvQ2FtZXJhW2pdID0gZGlzdGFuY2VzRm9yRWFjaEZhY2VUb0NhbWVyYVtqLTFdO1xuICAgICAgICAgICAgICAgIGRpc3RhbmNlc0ZvckVhY2hGYWNlVG9DYW1lcmFbai0xXSA9IHRlbXA7XG5cbiAgICAgICAgICAgICAgICAvL2Fsc28gc3dhcCB0aGUgaW5kaWNlcyBmb3IgZmFjZSAjaiBhbmQgZmFjZSAjai0xLCBzbyB0aGlzIHNvcnQgdXNlcyBkaXN0YW5jZXNGb3JFYWNoRmFjZVRvQ2FtZXJhIGFzIHRoZSBrZXlcbiAgICAgICAgICAgICAgICBsZXQgdmVydDFJbmRleCA9IGluZGV4QXJyYXlbMypqXTtcbiAgICAgICAgICAgICAgICBsZXQgdmVydDJJbmRleCA9IGluZGV4QXJyYXlbMypqKzFdO1xuICAgICAgICAgICAgICAgIGxldCB2ZXJ0M0luZGV4ID0gaW5kZXhBcnJheVszKmorMl07XG5cbiAgICAgICAgICAgICAgICBpbmRleEFycmF5WzMqal0gPSBpbmRleEFycmF5WzMqKGotMSldO1xuICAgICAgICAgICAgICAgIGluZGV4QXJyYXlbMypqKzFdID0gaW5kZXhBcnJheVszKihqLTEpKzFdO1xuICAgICAgICAgICAgICAgIGluZGV4QXJyYXlbMypqKzJdID0gaW5kZXhBcnJheVszKihqLTEpKzJdO1xuXG4gICAgICAgICAgICAgICAgaW5kZXhBcnJheVszKihqLTEpXSA9IHZlcnQxSW5kZXg7XG4gICAgICAgICAgICAgICAgaW5kZXhBcnJheVszKihqLTEpKzFdID0gdmVydDJJbmRleDtcbiAgICAgICAgICAgICAgICBpbmRleEFycmF5WzMqKGotMSkrMl0gPSB2ZXJ0M0luZGV4O1xuICAgICAgICAgICAgICAgIGotLTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL25vdyBpbmRleEFycmF5IGlzIHNvcnRlZCBhY2NvcmRpbmcgdG8gdGhlIGRpc3RhbmNlIHRvIHRoZSBjYW1lcmFcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuaW5kZXgubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgIH1cblx0X3JlY2FsY05vcm1hbHMoKXtcblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHQvL3JlbmRlcmVkIHRyaWFuZ2xlIGluZGljZXNcblx0XHQvL2Zyb20gdGhyZWUuanMgUGxhbmVHZW9tZXRyeS5qc1xuXHRcdGxldCBub3JtYWxWZWMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdGxldCBwYXJ0aWFsWCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0bGV0IHBhcnRpYWxZID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuXHRcdGxldCBiYXNlID0gMDtcblx0XHRsZXQgbmVnYXRpb25GYWN0b3IgPSAxO1xuXHRcdGxldCBpPTAsIGo9MDtcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtqKyspe1xuXHRcdFx0Zm9yKGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aSsrKXtcblxuXHRcdFx0XHQvL2N1cnJlbnRseSBkb2luZyB0aGUgbm9ybWFsIGZvciB0aGUgcG9pbnQgYXQgaW5kZXggYS5cblx0XHRcdFx0bGV0IGEgPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBiLGM7XG5cblx0XHRcdFx0Ly9UYW5nZW50cyBhcmUgY2FsY3VsYXRlZCB3aXRoIGZpbml0ZSBkaWZmZXJlbmNlcyAtIEZvciAoeCx5KSwgY29tcHV0ZSB0aGUgcGFydGlhbCBkZXJpdmF0aXZlcyB1c2luZyAoeCsxLHkpIGFuZCAoeCx5KzEpIGFuZCBjcm9zcyB0aGVtLiBCdXQgaWYgeW91J3JlIGF0IHRoZWJvcmRlciwgeCsxIGFuZCB5KzEgbWlnaHQgbm90IGV4aXN0LiBTbyBpbiB0aGF0IGNhc2Ugd2UgZ28gYmFja3dhcmRzIGFuZCB1c2UgKHgtMSx5KSBhbmQgKHgseS0xKSBpbnN0ZWFkLlxuXHRcdFx0XHQvL1doZW4gdGhhdCBoYXBwZW5zLCB0aGUgdmVjdG9yIHN1YnRyYWN0aW9uIHdpbGwgc3VidHJhY3QgdGhlIHdyb25nIHdheSwgaW50cm9kdWNpbmcgYSBmYWN0b3Igb2YgLTEgaW50byB0aGUgY3Jvc3MgcHJvZHVjdCB0ZXJtLiBTbyBuZWdhdGlvbkZhY3RvciBrZWVwcyB0cmFjayBvZiB3aGVuIHRoYXQgaGFwcGVucyBhbmQgaXMgbXVsdGlwbGllZCBhZ2FpbiB0byBjYW5jZWwgaXQgb3V0LlxuXHRcdFx0XHRuZWdhdGlvbkZhY3RvciA9IDE7IFxuXG5cdFx0XHRcdC8vYiBpcyB0aGUgaW5kZXggb2YgdGhlIHBvaW50IDEgYXdheSBpbiB0aGUgeSBkaXJlY3Rpb25cblx0XHRcdFx0aWYoaSA8IHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSl7XG5cdFx0XHRcdFx0YiA9IChpKzEpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdC8vZW5kIG9mIHRoZSB5IGF4aXMsIGdvIGJhY2t3YXJkcyBmb3IgdGFuZ2VudHNcblx0XHRcdFx0XHRiID0gKGktMSkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0XHRuZWdhdGlvbkZhY3RvciAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vYyBpcyB0aGUgaW5kZXggb2YgdGhlIHBvaW50IDEgYXdheSBpbiB0aGUgeCBkaXJlY3Rpb25cblx0XHRcdFx0aWYoaiA8IHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSl7XG5cdFx0XHRcdFx0YyA9IGkgKyAoaisxKSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdC8vZW5kIG9mIHRoZSB4IGF4aXMsIGdvIGJhY2t3YXJkcyBmb3IgdGFuZ2VudHNcblx0XHRcdFx0XHRjID0gaSArIChqLTEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0XHRuZWdhdGlvbkZhY3RvciAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vdGhlIHZlY3RvciBiLWEuIFxuXHRcdFx0XHQvL3RoaXMuX3ZlcnRpY2VzIHN0b3JlcyB0aGUgY29tcG9uZW50cyBvZiBlYWNoIHZlY3RvciBpbiBvbmUgYmlnIGZsb2F0MzJhcnJheSwgc28gdGhpcyBwdWxscyB0aGVtIG91dCBhbmQganVzdCBkb2VzIHRoZSBzdWJ0cmFjdGlvbiBudW1lcmljYWxseS4gVGhlIGNvbXBvbmVudHMgb2YgdmVjdG9yICM1MiBhcmUgeDo1MiozKzAseTo1MiozKzEsejo1MiozKzIsIGZvciBleGFtcGxlLlxuXHRcdFx0XHRwYXJ0aWFsWS5zZXQodGhpcy5fdmVydGljZXNbYiozXS10aGlzLl92ZXJ0aWNlc1thKjNdLHRoaXMuX3ZlcnRpY2VzW2IqMysxXS10aGlzLl92ZXJ0aWNlc1thKjMrMV0sdGhpcy5fdmVydGljZXNbYiozKzJdLXRoaXMuX3ZlcnRpY2VzW2EqMysyXSk7XG5cdFx0XHRcdC8vdGhlIHZlY3RvciBjLWEuXG5cdFx0XHRcdHBhcnRpYWxYLnNldCh0aGlzLl92ZXJ0aWNlc1tjKjNdLXRoaXMuX3ZlcnRpY2VzW2EqM10sdGhpcy5fdmVydGljZXNbYyozKzFdLXRoaXMuX3ZlcnRpY2VzW2EqMysxXSx0aGlzLl92ZXJ0aWNlc1tjKjMrMl0tdGhpcy5fdmVydGljZXNbYSozKzJdKTtcblxuXHRcdFx0XHQvL2ItYSBjcm9zcyBjLWFcblx0XHRcdFx0bm9ybWFsVmVjLmNyb3NzVmVjdG9ycyhwYXJ0aWFsWCxwYXJ0aWFsWSkubm9ybWFsaXplKCk7XG5cdFx0XHRcdG5vcm1hbFZlYy5tdWx0aXBseVNjYWxhcihuZWdhdGlvbkZhY3Rvcik7XG5cdFx0XHRcdC8vc2V0IG5vcm1hbFxuXHRcdFx0XHR0aGlzLl9ub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjNdID0gbm9ybWFsVmVjLng7XG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqMysxXSA9IG5vcm1hbFZlYy55O1xuXHRcdFx0XHR0aGlzLl9ub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjMrMl0gPSBub3JtYWxWZWMuejtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gZG9uJ3QgZm9yZ2V0IHRvIG5vcm1hbEF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWUgYWZ0ZXIgY2FsbGluZyB0aGlzIVxuXHR9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLm1lc2gpO1xuICAgIH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseSBtYWtlIHRoaXMgYSBmdW5jdGlvblxuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdFx0dGhpcy5fdW5pZm9ybXMuY29sb3IudmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IoY29sb3IpO1xuXHR9XG5cdGdldCBjb2xvcigpe1xuXHRcdHJldHVybiB0aGlzLl9jb2xvcjtcblx0fVxuXHRzZXQgZ3JpZENvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseSBtYWtlIHRoaXMgYSBmdW5jdGlvblxuXHRcdHRoaXMuX2dyaWRDb2xvciA9IGNvbG9yO1xuXHRcdHRoaXMuX3VuaWZvcm1zLmdyaWRDb2xvci52YWx1ZSA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLnVzZUN1c3RvbUdyaWRDb2xvci52YWx1ZSA9IDEuMDtcblx0fVxuXHRnZXQgZ3JpZENvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2dyaWRDb2xvcjtcblx0fVxuXHRzZXQgb3BhY2l0eShvcGFjaXR5KXtcblx0XHR0aGlzLm1hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuXHRcdHRoaXMubWF0ZXJpYWwudHJhbnNwYXJlbnQgPSAob3BhY2l0eSA8IDEpIHx8ICghdGhpcy5fc2hvd1NvbGlkKTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5kZXB0aFdyaXRlID0gIXRoaXMubWF0ZXJpYWwudHJhbnNwYXJlbnQ7IC8vIG9ubHkgZGVwdGhXcml0ZSBpZiBub3QgdHJhbnNwYXJlbnQsIHNvIHRoYXQgdGhpbmdzIHNob3cgdXAgYmVoaW5kIHRoaXNcblxuXHRcdHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBTdXJmYWNlT3V0cHV0KHtjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuZXhwb3J0IHtTdXJmYWNlT3V0cHV0fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5cbmNsYXNzIEZsYXRBcnJheU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG4gICAgLy9hbiBvdXRwdXQgd2hpY2ggZmlsbHMgYW4gYXJyYXkgd2l0aCBldmVyeSBjb29yZGluYXRlIHJlY2lldmVkLCBpbiBvcmRlci5cbiAgICAvL0l0J2xsIHJlZ2lzdGVyIFswLDEsMl0sWzMsNCw1XSBhcyBbMCwxLDIsMyw0LDVdLlxuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lypcblx0XHRcdGFycmF5OiBhbiBleGlzdGluZyBhcnJheSwgd2hpY2ggd2lsbCB0aGVuIGJlIG1vZGlmaWVkIGluIHBsYWNlIGV2ZXJ5IHRpbWUgdGhpcyBvdXRwdXQgaXMgYWN0aXZhdGVkXG5cdFx0Ki9cblxuXHRcdHRoaXMuYXJyYXkgPSBvcHRpb25zLmFycmF5O1xuICAgICAgICB0aGlzLl9jdXJyZW50QXJyYXlJbmRleCA9IDA7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIC4uLmNvb3Jkcyl7XG4gICAgICAgIGZvcih2YXIgaj0wO2o8Y29vcmRzLmxlbmd0aDtqKyspeyBcbiAgICAgICAgICAgIC8vSSBkb24ndCBuZWVkIHRvIHdvcnJ5IGFib3V0IG91dC1vZi1ib3VuZHMgZW50cmllcyBiZWNhdXNlIGphdmFzY3JpcHQgYXV0b21hdGljYWxseSBncm93cyBhcnJheXMgaWYgYSBuZXcgaW5kZXggaXMgc2V0LlxuICAgICAgICAgICAgLy9KYXZhc2NyaXB0IG1heSBoYXZlIHNvbWUgZ2FyYmFnZSBkZXNpZ24gY2hvaWNlcywgYnV0IEknbGwgY2xhaW0gdGhhdCBnYXJiYWdlIGZvciBteSBvd24gbmVmYXJpb3VzIGFkdmFudGFnZS5cbiAgICAgICAgICAgIHRoaXMuYXJyYXlbdGhpcy5fY3VycmVudEFycmF5SW5kZXhdID0gY29vcmRzW2pdXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50QXJyYXlJbmRleCsrO1xuICAgICAgICB9XG5cdH1cblx0b25BZnRlckFjdGl2YXRpb24oKXtcbiAgICAgICAgdGhpcy5fY3VycmVudEFycmF5SW5kZXggPSAwO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBGbGF0QXJyYXlPdXRwdXQoe2FycmF5OiBFWFAuTWF0aC5jbG9uZSh0aGlzLmFycmF5KX0pO1xuXHR9XG59XG5cbmV4cG9ydCB7RmxhdEFycmF5T3V0cHV0fTtcbiIsIi8qKlxuICogRG93bmxvYWRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi9tYXN0ZXIvc3JjL2V4dHJhcy9FYXJjdXQuanMgQXVndXN0IDIwMjFcbiAqIE1JVCBMaWNlbnNlZFxuICogUG9ydCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9tYXBib3gvZWFyY3V0ICh2Mi4yLjIpXG4gKi9cblxuY29uc3QgRWFyY3V0ID0ge1xuXG5cdHRyaWFuZ3VsYXRlOiBmdW5jdGlvbiAoIGRhdGEsIGhvbGVJbmRpY2VzLCBkaW0gPSAyICkge1xuXG5cdFx0Y29uc3QgaGFzSG9sZXMgPSBob2xlSW5kaWNlcyAmJiBob2xlSW5kaWNlcy5sZW5ndGg7XG5cdFx0Y29uc3Qgb3V0ZXJMZW4gPSBoYXNIb2xlcyA/IGhvbGVJbmRpY2VzWyAwIF0gKiBkaW0gOiBkYXRhLmxlbmd0aDtcblx0XHRsZXQgb3V0ZXJOb2RlID0gbGlua2VkTGlzdCggZGF0YSwgMCwgb3V0ZXJMZW4sIGRpbSwgdHJ1ZSApO1xuXHRcdGNvbnN0IHRyaWFuZ2xlcyA9IFtdO1xuXG5cdFx0aWYgKCAhIG91dGVyTm9kZSB8fCBvdXRlck5vZGUubmV4dCA9PT0gb3V0ZXJOb2RlLnByZXYgKSByZXR1cm4gdHJpYW5nbGVzO1xuXG5cdFx0bGV0IG1pblgsIG1pblksIG1heFgsIG1heFksIHgsIHksIGludlNpemU7XG5cblx0XHRpZiAoIGhhc0hvbGVzICkgb3V0ZXJOb2RlID0gZWxpbWluYXRlSG9sZXMoIGRhdGEsIGhvbGVJbmRpY2VzLCBvdXRlck5vZGUsIGRpbSApO1xuXG5cdFx0Ly8gaWYgdGhlIHNoYXBlIGlzIG5vdCB0b28gc2ltcGxlLCB3ZSdsbCB1c2Ugei1vcmRlciBjdXJ2ZSBoYXNoIGxhdGVyOyBjYWxjdWxhdGUgcG9seWdvbiBiYm94XG5cdFx0aWYgKCBkYXRhLmxlbmd0aCA+IDgwICogZGltICkge1xuXG5cdFx0XHRtaW5YID0gbWF4WCA9IGRhdGFbIDAgXTtcblx0XHRcdG1pblkgPSBtYXhZID0gZGF0YVsgMSBdO1xuXG5cdFx0XHRmb3IgKCBsZXQgaSA9IGRpbTsgaSA8IG91dGVyTGVuOyBpICs9IGRpbSApIHtcblxuXHRcdFx0XHR4ID0gZGF0YVsgaSBdO1xuXHRcdFx0XHR5ID0gZGF0YVsgaSArIDEgXTtcblx0XHRcdFx0aWYgKCB4IDwgbWluWCApIG1pblggPSB4O1xuXHRcdFx0XHRpZiAoIHkgPCBtaW5ZICkgbWluWSA9IHk7XG5cdFx0XHRcdGlmICggeCA+IG1heFggKSBtYXhYID0geDtcblx0XHRcdFx0aWYgKCB5ID4gbWF4WSApIG1heFkgPSB5O1xuXG5cdFx0XHR9XG5cblx0XHRcdC8vIG1pblgsIG1pblkgYW5kIGludlNpemUgYXJlIGxhdGVyIHVzZWQgdG8gdHJhbnNmb3JtIGNvb3JkcyBpbnRvIGludGVnZXJzIGZvciB6LW9yZGVyIGNhbGN1bGF0aW9uXG5cdFx0XHRpbnZTaXplID0gTWF0aC5tYXgoIG1heFggLSBtaW5YLCBtYXhZIC0gbWluWSApO1xuXHRcdFx0aW52U2l6ZSA9IGludlNpemUgIT09IDAgPyAxIC8gaW52U2l6ZSA6IDA7XG5cblx0XHR9XG5cblx0XHRlYXJjdXRMaW5rZWQoIG91dGVyTm9kZSwgdHJpYW5nbGVzLCBkaW0sIG1pblgsIG1pblksIGludlNpemUgKTtcblxuXHRcdHJldHVybiB0cmlhbmdsZXM7XG5cblx0fVxuXG59O1xuXG4vLyBjcmVhdGUgYSBjaXJjdWxhciBkb3VibHkgbGlua2VkIGxpc3QgZnJvbSBwb2x5Z29uIHBvaW50cyBpbiB0aGUgc3BlY2lmaWVkIHdpbmRpbmcgb3JkZXJcbmZ1bmN0aW9uIGxpbmtlZExpc3QoIGRhdGEsIHN0YXJ0LCBlbmQsIGRpbSwgY2xvY2t3aXNlICkge1xuXG5cdGxldCBpLCBsYXN0O1xuXG5cdGlmICggY2xvY2t3aXNlID09PSAoIHNpZ25lZEFyZWEoIGRhdGEsIHN0YXJ0LCBlbmQsIGRpbSApID4gMCApICkge1xuXG5cdFx0Zm9yICggaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IGRpbSApIGxhc3QgPSBpbnNlcnROb2RlKCBpLCBkYXRhWyBpIF0sIGRhdGFbIGkgKyAxIF0sIGxhc3QgKTtcblxuXHR9IGVsc2Uge1xuXG5cdFx0Zm9yICggaSA9IGVuZCAtIGRpbTsgaSA+PSBzdGFydDsgaSAtPSBkaW0gKSBsYXN0ID0gaW5zZXJ0Tm9kZSggaSwgZGF0YVsgaSBdLCBkYXRhWyBpICsgMSBdLCBsYXN0ICk7XG5cblx0fVxuXG5cdGlmICggbGFzdCAmJiBlcXVhbHMoIGxhc3QsIGxhc3QubmV4dCApICkge1xuXG5cdFx0cmVtb3ZlTm9kZSggbGFzdCApO1xuXHRcdGxhc3QgPSBsYXN0Lm5leHQ7XG5cblx0fVxuXG5cdHJldHVybiBsYXN0O1xuXG59XG5cbi8vIGVsaW1pbmF0ZSBjb2xpbmVhciBvciBkdXBsaWNhdGUgcG9pbnRzXG5mdW5jdGlvbiBmaWx0ZXJQb2ludHMoIHN0YXJ0LCBlbmQgKSB7XG5cblx0aWYgKCAhIHN0YXJ0ICkgcmV0dXJuIHN0YXJ0O1xuXHRpZiAoICEgZW5kICkgZW5kID0gc3RhcnQ7XG5cblx0bGV0IHAgPSBzdGFydCxcblx0XHRhZ2Fpbjtcblx0ZG8ge1xuXG5cdFx0YWdhaW4gPSBmYWxzZTtcblxuXHRcdGlmICggISBwLnN0ZWluZXIgJiYgKCBlcXVhbHMoIHAsIHAubmV4dCApIHx8IGFyZWEoIHAucHJldiwgcCwgcC5uZXh0ICkgPT09IDAgKSApIHtcblxuXHRcdFx0cmVtb3ZlTm9kZSggcCApO1xuXHRcdFx0cCA9IGVuZCA9IHAucHJldjtcblx0XHRcdGlmICggcCA9PT0gcC5uZXh0ICkgYnJlYWs7XG5cdFx0XHRhZ2FpbiA9IHRydWU7XG5cblx0XHR9IGVsc2Uge1xuXG5cdFx0XHRwID0gcC5uZXh0O1xuXG5cdFx0fVxuXG5cdH0gd2hpbGUgKCBhZ2FpbiB8fCBwICE9PSBlbmQgKTtcblxuXHRyZXR1cm4gZW5kO1xuXG59XG5cbi8vIG1haW4gZWFyIHNsaWNpbmcgbG9vcCB3aGljaCB0cmlhbmd1bGF0ZXMgYSBwb2x5Z29uIChnaXZlbiBhcyBhIGxpbmtlZCBsaXN0KVxuZnVuY3Rpb24gZWFyY3V0TGlua2VkKCBlYXIsIHRyaWFuZ2xlcywgZGltLCBtaW5YLCBtaW5ZLCBpbnZTaXplLCBwYXNzICkge1xuXG5cdGlmICggISBlYXIgKSByZXR1cm47XG5cblx0Ly8gaW50ZXJsaW5rIHBvbHlnb24gbm9kZXMgaW4gei1vcmRlclxuXHRpZiAoICEgcGFzcyAmJiBpbnZTaXplICkgaW5kZXhDdXJ2ZSggZWFyLCBtaW5YLCBtaW5ZLCBpbnZTaXplICk7XG5cblx0bGV0IHN0b3AgPSBlYXIsXG5cdFx0cHJldiwgbmV4dDtcblxuXHQvLyBpdGVyYXRlIHRocm91Z2ggZWFycywgc2xpY2luZyB0aGVtIG9uZSBieSBvbmVcblx0d2hpbGUgKCBlYXIucHJldiAhPT0gZWFyLm5leHQgKSB7XG5cblx0XHRwcmV2ID0gZWFyLnByZXY7XG5cdFx0bmV4dCA9IGVhci5uZXh0O1xuXG5cdFx0aWYgKCBpbnZTaXplID8gaXNFYXJIYXNoZWQoIGVhciwgbWluWCwgbWluWSwgaW52U2l6ZSApIDogaXNFYXIoIGVhciApICkge1xuXG5cdFx0XHQvLyBjdXQgb2ZmIHRoZSB0cmlhbmdsZVxuXHRcdFx0dHJpYW5nbGVzLnB1c2goIHByZXYuaSAvIGRpbSApO1xuXHRcdFx0dHJpYW5nbGVzLnB1c2goIGVhci5pIC8gZGltICk7XG5cdFx0XHR0cmlhbmdsZXMucHVzaCggbmV4dC5pIC8gZGltICk7XG5cblx0XHRcdHJlbW92ZU5vZGUoIGVhciApO1xuXG5cdFx0XHQvLyBza2lwcGluZyB0aGUgbmV4dCB2ZXJ0ZXggbGVhZHMgdG8gbGVzcyBzbGl2ZXIgdHJpYW5nbGVzXG5cdFx0XHRlYXIgPSBuZXh0Lm5leHQ7XG5cdFx0XHRzdG9wID0gbmV4dC5uZXh0O1xuXG5cdFx0XHRjb250aW51ZTtcblxuXHRcdH1cblxuXHRcdGVhciA9IG5leHQ7XG5cblx0XHQvLyBpZiB3ZSBsb29wZWQgdGhyb3VnaCB0aGUgd2hvbGUgcmVtYWluaW5nIHBvbHlnb24gYW5kIGNhbid0IGZpbmQgYW55IG1vcmUgZWFyc1xuXHRcdGlmICggZWFyID09PSBzdG9wICkge1xuXG5cdFx0XHQvLyB0cnkgZmlsdGVyaW5nIHBvaW50cyBhbmQgc2xpY2luZyBhZ2FpblxuXHRcdFx0aWYgKCAhIHBhc3MgKSB7XG5cblx0XHRcdFx0ZWFyY3V0TGlua2VkKCBmaWx0ZXJQb2ludHMoIGVhciApLCB0cmlhbmdsZXMsIGRpbSwgbWluWCwgbWluWSwgaW52U2l6ZSwgMSApO1xuXG5cdFx0XHRcdC8vIGlmIHRoaXMgZGlkbid0IHdvcmssIHRyeSBjdXJpbmcgYWxsIHNtYWxsIHNlbGYtaW50ZXJzZWN0aW9ucyBsb2NhbGx5XG5cblx0XHRcdH0gZWxzZSBpZiAoIHBhc3MgPT09IDEgKSB7XG5cblx0XHRcdFx0ZWFyID0gY3VyZUxvY2FsSW50ZXJzZWN0aW9ucyggZmlsdGVyUG9pbnRzKCBlYXIgKSwgdHJpYW5nbGVzLCBkaW0gKTtcblx0XHRcdFx0ZWFyY3V0TGlua2VkKCBlYXIsIHRyaWFuZ2xlcywgZGltLCBtaW5YLCBtaW5ZLCBpbnZTaXplLCAyICk7XG5cblx0XHRcdFx0Ly8gYXMgYSBsYXN0IHJlc29ydCwgdHJ5IHNwbGl0dGluZyB0aGUgcmVtYWluaW5nIHBvbHlnb24gaW50byB0d29cblxuXHRcdFx0fSBlbHNlIGlmICggcGFzcyA9PT0gMiApIHtcblxuXHRcdFx0XHRzcGxpdEVhcmN1dCggZWFyLCB0cmlhbmdsZXMsIGRpbSwgbWluWCwgbWluWSwgaW52U2l6ZSApO1xuXG5cdFx0XHR9XG5cblx0XHRcdGJyZWFrO1xuXG5cdFx0fVxuXG5cdH1cblxufVxuXG4vLyBjaGVjayB3aGV0aGVyIGEgcG9seWdvbiBub2RlIGZvcm1zIGEgdmFsaWQgZWFyIHdpdGggYWRqYWNlbnQgbm9kZXNcbmZ1bmN0aW9uIGlzRWFyKCBlYXIgKSB7XG5cblx0Y29uc3QgYSA9IGVhci5wcmV2LFxuXHRcdGIgPSBlYXIsXG5cdFx0YyA9IGVhci5uZXh0O1xuXG5cdGlmICggYXJlYSggYSwgYiwgYyApID49IDAgKSByZXR1cm4gZmFsc2U7IC8vIHJlZmxleCwgY2FuJ3QgYmUgYW4gZWFyXG5cblx0Ly8gbm93IG1ha2Ugc3VyZSB3ZSBkb24ndCBoYXZlIG90aGVyIHBvaW50cyBpbnNpZGUgdGhlIHBvdGVudGlhbCBlYXJcblx0bGV0IHAgPSBlYXIubmV4dC5uZXh0O1xuXG5cdHdoaWxlICggcCAhPT0gZWFyLnByZXYgKSB7XG5cblx0XHRpZiAoIHBvaW50SW5UcmlhbmdsZSggYS54LCBhLnksIGIueCwgYi55LCBjLngsIGMueSwgcC54LCBwLnkgKSAmJlxuXHRcdFx0YXJlYSggcC5wcmV2LCBwLCBwLm5leHQgKSA+PSAwICkgcmV0dXJuIGZhbHNlO1xuXHRcdHAgPSBwLm5leHQ7XG5cblx0fVxuXG5cdHJldHVybiB0cnVlO1xuXG59XG5cbmZ1bmN0aW9uIGlzRWFySGFzaGVkKCBlYXIsIG1pblgsIG1pblksIGludlNpemUgKSB7XG5cblx0Y29uc3QgYSA9IGVhci5wcmV2LFxuXHRcdGIgPSBlYXIsXG5cdFx0YyA9IGVhci5uZXh0O1xuXG5cdGlmICggYXJlYSggYSwgYiwgYyApID49IDAgKSByZXR1cm4gZmFsc2U7IC8vIHJlZmxleCwgY2FuJ3QgYmUgYW4gZWFyXG5cblx0Ly8gdHJpYW5nbGUgYmJveDsgbWluICYgbWF4IGFyZSBjYWxjdWxhdGVkIGxpa2UgdGhpcyBmb3Igc3BlZWRcblx0Y29uc3QgbWluVFggPSBhLnggPCBiLnggPyAoIGEueCA8IGMueCA/IGEueCA6IGMueCApIDogKCBiLnggPCBjLnggPyBiLnggOiBjLnggKSxcblx0XHRtaW5UWSA9IGEueSA8IGIueSA/ICggYS55IDwgYy55ID8gYS55IDogYy55ICkgOiAoIGIueSA8IGMueSA/IGIueSA6IGMueSApLFxuXHRcdG1heFRYID0gYS54ID4gYi54ID8gKCBhLnggPiBjLnggPyBhLnggOiBjLnggKSA6ICggYi54ID4gYy54ID8gYi54IDogYy54ICksXG5cdFx0bWF4VFkgPSBhLnkgPiBiLnkgPyAoIGEueSA+IGMueSA/IGEueSA6IGMueSApIDogKCBiLnkgPiBjLnkgPyBiLnkgOiBjLnkgKTtcblxuXHQvLyB6LW9yZGVyIHJhbmdlIGZvciB0aGUgY3VycmVudCB0cmlhbmdsZSBiYm94O1xuXHRjb25zdCBtaW5aID0gek9yZGVyKCBtaW5UWCwgbWluVFksIG1pblgsIG1pblksIGludlNpemUgKSxcblx0XHRtYXhaID0gek9yZGVyKCBtYXhUWCwgbWF4VFksIG1pblgsIG1pblksIGludlNpemUgKTtcblxuXHRsZXQgcCA9IGVhci5wcmV2Wixcblx0XHRuID0gZWFyLm5leHRaO1xuXG5cdC8vIGxvb2sgZm9yIHBvaW50cyBpbnNpZGUgdGhlIHRyaWFuZ2xlIGluIGJvdGggZGlyZWN0aW9uc1xuXHR3aGlsZSAoIHAgJiYgcC56ID49IG1pblogJiYgbiAmJiBuLnogPD0gbWF4WiApIHtcblxuXHRcdGlmICggcCAhPT0gZWFyLnByZXYgJiYgcCAhPT0gZWFyLm5leHQgJiZcblx0XHRcdHBvaW50SW5UcmlhbmdsZSggYS54LCBhLnksIGIueCwgYi55LCBjLngsIGMueSwgcC54LCBwLnkgKSAmJlxuXHRcdFx0YXJlYSggcC5wcmV2LCBwLCBwLm5leHQgKSA+PSAwICkgcmV0dXJuIGZhbHNlO1xuXHRcdHAgPSBwLnByZXZaO1xuXG5cdFx0aWYgKCBuICE9PSBlYXIucHJldiAmJiBuICE9PSBlYXIubmV4dCAmJlxuXHRcdFx0cG9pbnRJblRyaWFuZ2xlKCBhLngsIGEueSwgYi54LCBiLnksIGMueCwgYy55LCBuLngsIG4ueSApICYmXG5cdFx0XHRhcmVhKCBuLnByZXYsIG4sIG4ubmV4dCApID49IDAgKSByZXR1cm4gZmFsc2U7XG5cdFx0biA9IG4ubmV4dFo7XG5cblx0fVxuXG5cdC8vIGxvb2sgZm9yIHJlbWFpbmluZyBwb2ludHMgaW4gZGVjcmVhc2luZyB6LW9yZGVyXG5cdHdoaWxlICggcCAmJiBwLnogPj0gbWluWiApIHtcblxuXHRcdGlmICggcCAhPT0gZWFyLnByZXYgJiYgcCAhPT0gZWFyLm5leHQgJiZcblx0XHRcdHBvaW50SW5UcmlhbmdsZSggYS54LCBhLnksIGIueCwgYi55LCBjLngsIGMueSwgcC54LCBwLnkgKSAmJlxuXHRcdFx0YXJlYSggcC5wcmV2LCBwLCBwLm5leHQgKSA+PSAwICkgcmV0dXJuIGZhbHNlO1xuXHRcdHAgPSBwLnByZXZaO1xuXG5cdH1cblxuXHQvLyBsb29rIGZvciByZW1haW5pbmcgcG9pbnRzIGluIGluY3JlYXNpbmcgei1vcmRlclxuXHR3aGlsZSAoIG4gJiYgbi56IDw9IG1heFogKSB7XG5cblx0XHRpZiAoIG4gIT09IGVhci5wcmV2ICYmIG4gIT09IGVhci5uZXh0ICYmXG5cdFx0XHRwb2ludEluVHJpYW5nbGUoIGEueCwgYS55LCBiLngsIGIueSwgYy54LCBjLnksIG4ueCwgbi55ICkgJiZcblx0XHRcdGFyZWEoIG4ucHJldiwgbiwgbi5uZXh0ICkgPj0gMCApIHJldHVybiBmYWxzZTtcblx0XHRuID0gbi5uZXh0WjtcblxuXHR9XG5cblx0cmV0dXJuIHRydWU7XG5cbn1cblxuLy8gZ28gdGhyb3VnaCBhbGwgcG9seWdvbiBub2RlcyBhbmQgY3VyZSBzbWFsbCBsb2NhbCBzZWxmLWludGVyc2VjdGlvbnNcbmZ1bmN0aW9uIGN1cmVMb2NhbEludGVyc2VjdGlvbnMoIHN0YXJ0LCB0cmlhbmdsZXMsIGRpbSApIHtcblxuXHRsZXQgcCA9IHN0YXJ0O1xuXHRkbyB7XG5cblx0XHRjb25zdCBhID0gcC5wcmV2LFxuXHRcdFx0YiA9IHAubmV4dC5uZXh0O1xuXG5cdFx0aWYgKCAhIGVxdWFscyggYSwgYiApICYmIGludGVyc2VjdHMoIGEsIHAsIHAubmV4dCwgYiApICYmIGxvY2FsbHlJbnNpZGUoIGEsIGIgKSAmJiBsb2NhbGx5SW5zaWRlKCBiLCBhICkgKSB7XG5cblx0XHRcdHRyaWFuZ2xlcy5wdXNoKCBhLmkgLyBkaW0gKTtcblx0XHRcdHRyaWFuZ2xlcy5wdXNoKCBwLmkgLyBkaW0gKTtcblx0XHRcdHRyaWFuZ2xlcy5wdXNoKCBiLmkgLyBkaW0gKTtcblxuXHRcdFx0Ly8gcmVtb3ZlIHR3byBub2RlcyBpbnZvbHZlZFxuXHRcdFx0cmVtb3ZlTm9kZSggcCApO1xuXHRcdFx0cmVtb3ZlTm9kZSggcC5uZXh0ICk7XG5cblx0XHRcdHAgPSBzdGFydCA9IGI7XG5cblx0XHR9XG5cblx0XHRwID0gcC5uZXh0O1xuXG5cdH0gd2hpbGUgKCBwICE9PSBzdGFydCApO1xuXG5cdHJldHVybiBmaWx0ZXJQb2ludHMoIHAgKTtcblxufVxuXG4vLyB0cnkgc3BsaXR0aW5nIHBvbHlnb24gaW50byB0d28gYW5kIHRyaWFuZ3VsYXRlIHRoZW0gaW5kZXBlbmRlbnRseVxuZnVuY3Rpb24gc3BsaXRFYXJjdXQoIHN0YXJ0LCB0cmlhbmdsZXMsIGRpbSwgbWluWCwgbWluWSwgaW52U2l6ZSApIHtcblxuXHQvLyBsb29rIGZvciBhIHZhbGlkIGRpYWdvbmFsIHRoYXQgZGl2aWRlcyB0aGUgcG9seWdvbiBpbnRvIHR3b1xuXHRsZXQgYSA9IHN0YXJ0O1xuXHRkbyB7XG5cblx0XHRsZXQgYiA9IGEubmV4dC5uZXh0O1xuXHRcdHdoaWxlICggYiAhPT0gYS5wcmV2ICkge1xuXG5cdFx0XHRpZiAoIGEuaSAhPT0gYi5pICYmIGlzVmFsaWREaWFnb25hbCggYSwgYiApICkge1xuXG5cdFx0XHRcdC8vIHNwbGl0IHRoZSBwb2x5Z29uIGluIHR3byBieSB0aGUgZGlhZ29uYWxcblx0XHRcdFx0bGV0IGMgPSBzcGxpdFBvbHlnb24oIGEsIGIgKTtcblxuXHRcdFx0XHQvLyBmaWx0ZXIgY29saW5lYXIgcG9pbnRzIGFyb3VuZCB0aGUgY3V0c1xuXHRcdFx0XHRhID0gZmlsdGVyUG9pbnRzKCBhLCBhLm5leHQgKTtcblx0XHRcdFx0YyA9IGZpbHRlclBvaW50cyggYywgYy5uZXh0ICk7XG5cblx0XHRcdFx0Ly8gcnVuIGVhcmN1dCBvbiBlYWNoIGhhbGZcblx0XHRcdFx0ZWFyY3V0TGlua2VkKCBhLCB0cmlhbmdsZXMsIGRpbSwgbWluWCwgbWluWSwgaW52U2l6ZSApO1xuXHRcdFx0XHRlYXJjdXRMaW5rZWQoIGMsIHRyaWFuZ2xlcywgZGltLCBtaW5YLCBtaW5ZLCBpbnZTaXplICk7XG5cdFx0XHRcdHJldHVybjtcblxuXHRcdFx0fVxuXG5cdFx0XHRiID0gYi5uZXh0O1xuXG5cdFx0fVxuXG5cdFx0YSA9IGEubmV4dDtcblxuXHR9IHdoaWxlICggYSAhPT0gc3RhcnQgKTtcblxufVxuXG4vLyBsaW5rIGV2ZXJ5IGhvbGUgaW50byB0aGUgb3V0ZXIgbG9vcCwgcHJvZHVjaW5nIGEgc2luZ2xlLXJpbmcgcG9seWdvbiB3aXRob3V0IGhvbGVzXG5mdW5jdGlvbiBlbGltaW5hdGVIb2xlcyggZGF0YSwgaG9sZUluZGljZXMsIG91dGVyTm9kZSwgZGltICkge1xuXG5cdGNvbnN0IHF1ZXVlID0gW107XG5cdGxldCBpLCBsZW4sIHN0YXJ0LCBlbmQsIGxpc3Q7XG5cblx0Zm9yICggaSA9IDAsIGxlbiA9IGhvbGVJbmRpY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSArKyApIHtcblxuXHRcdHN0YXJ0ID0gaG9sZUluZGljZXNbIGkgXSAqIGRpbTtcblx0XHRlbmQgPSBpIDwgbGVuIC0gMSA/IGhvbGVJbmRpY2VzWyBpICsgMSBdICogZGltIDogZGF0YS5sZW5ndGg7XG5cdFx0bGlzdCA9IGxpbmtlZExpc3QoIGRhdGEsIHN0YXJ0LCBlbmQsIGRpbSwgZmFsc2UgKTtcblx0XHRpZiAoIGxpc3QgPT09IGxpc3QubmV4dCApIGxpc3Quc3RlaW5lciA9IHRydWU7XG5cdFx0cXVldWUucHVzaCggZ2V0TGVmdG1vc3QoIGxpc3QgKSApO1xuXG5cdH1cblxuXHRxdWV1ZS5zb3J0KCBjb21wYXJlWCApO1xuXG5cdC8vIHByb2Nlc3MgaG9sZXMgZnJvbSBsZWZ0IHRvIHJpZ2h0XG5cdGZvciAoIGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpICsrICkge1xuXG5cdFx0ZWxpbWluYXRlSG9sZSggcXVldWVbIGkgXSwgb3V0ZXJOb2RlICk7XG5cdFx0b3V0ZXJOb2RlID0gZmlsdGVyUG9pbnRzKCBvdXRlck5vZGUsIG91dGVyTm9kZS5uZXh0ICk7XG5cblx0fVxuXG5cdHJldHVybiBvdXRlck5vZGU7XG5cbn1cblxuZnVuY3Rpb24gY29tcGFyZVgoIGEsIGIgKSB7XG5cblx0cmV0dXJuIGEueCAtIGIueDtcblxufVxuXG4vLyBmaW5kIGEgYnJpZGdlIGJldHdlZW4gdmVydGljZXMgdGhhdCBjb25uZWN0cyBob2xlIHdpdGggYW4gb3V0ZXIgcmluZyBhbmQgYW5kIGxpbmsgaXRcbmZ1bmN0aW9uIGVsaW1pbmF0ZUhvbGUoIGhvbGUsIG91dGVyTm9kZSApIHtcblxuXHRvdXRlck5vZGUgPSBmaW5kSG9sZUJyaWRnZSggaG9sZSwgb3V0ZXJOb2RlICk7XG5cdGlmICggb3V0ZXJOb2RlICkge1xuXG5cdFx0Y29uc3QgYiA9IHNwbGl0UG9seWdvbiggb3V0ZXJOb2RlLCBob2xlICk7XG5cblx0XHQvLyBmaWx0ZXIgY29sbGluZWFyIHBvaW50cyBhcm91bmQgdGhlIGN1dHNcblx0XHRmaWx0ZXJQb2ludHMoIG91dGVyTm9kZSwgb3V0ZXJOb2RlLm5leHQgKTtcblx0XHRmaWx0ZXJQb2ludHMoIGIsIGIubmV4dCApO1xuXG5cdH1cblxufVxuXG4vLyBEYXZpZCBFYmVybHkncyBhbGdvcml0aG0gZm9yIGZpbmRpbmcgYSBicmlkZ2UgYmV0d2VlbiBob2xlIGFuZCBvdXRlciBwb2x5Z29uXG5mdW5jdGlvbiBmaW5kSG9sZUJyaWRnZSggaG9sZSwgb3V0ZXJOb2RlICkge1xuXG5cdGxldCBwID0gb3V0ZXJOb2RlO1xuXHRjb25zdCBoeCA9IGhvbGUueDtcblx0Y29uc3QgaHkgPSBob2xlLnk7XG5cdGxldCBxeCA9IC0gSW5maW5pdHksIG07XG5cblx0Ly8gZmluZCBhIHNlZ21lbnQgaW50ZXJzZWN0ZWQgYnkgYSByYXkgZnJvbSB0aGUgaG9sZSdzIGxlZnRtb3N0IHBvaW50IHRvIHRoZSBsZWZ0O1xuXHQvLyBzZWdtZW50J3MgZW5kcG9pbnQgd2l0aCBsZXNzZXIgeCB3aWxsIGJlIHBvdGVudGlhbCBjb25uZWN0aW9uIHBvaW50XG5cdGRvIHtcblxuXHRcdGlmICggaHkgPD0gcC55ICYmIGh5ID49IHAubmV4dC55ICYmIHAubmV4dC55ICE9PSBwLnkgKSB7XG5cblx0XHRcdGNvbnN0IHggPSBwLnggKyAoIGh5IC0gcC55ICkgKiAoIHAubmV4dC54IC0gcC54ICkgLyAoIHAubmV4dC55IC0gcC55ICk7XG5cdFx0XHRpZiAoIHggPD0gaHggJiYgeCA+IHF4ICkge1xuXG5cdFx0XHRcdHF4ID0geDtcblx0XHRcdFx0aWYgKCB4ID09PSBoeCApIHtcblxuXHRcdFx0XHRcdGlmICggaHkgPT09IHAueSApIHJldHVybiBwO1xuXHRcdFx0XHRcdGlmICggaHkgPT09IHAubmV4dC55ICkgcmV0dXJuIHAubmV4dDtcblxuXHRcdFx0XHR9XG5cblx0XHRcdFx0bSA9IHAueCA8IHAubmV4dC54ID8gcCA6IHAubmV4dDtcblxuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdFx0cCA9IHAubmV4dDtcblxuXHR9IHdoaWxlICggcCAhPT0gb3V0ZXJOb2RlICk7XG5cblx0aWYgKCAhIG0gKSByZXR1cm4gbnVsbDtcblxuXHRpZiAoIGh4ID09PSBxeCApIHJldHVybiBtOyAvLyBob2xlIHRvdWNoZXMgb3V0ZXIgc2VnbWVudDsgcGljayBsZWZ0bW9zdCBlbmRwb2ludFxuXG5cdC8vIGxvb2sgZm9yIHBvaW50cyBpbnNpZGUgdGhlIHRyaWFuZ2xlIG9mIGhvbGUgcG9pbnQsIHNlZ21lbnQgaW50ZXJzZWN0aW9uIGFuZCBlbmRwb2ludDtcblx0Ly8gaWYgdGhlcmUgYXJlIG5vIHBvaW50cyBmb3VuZCwgd2UgaGF2ZSBhIHZhbGlkIGNvbm5lY3Rpb247XG5cdC8vIG90aGVyd2lzZSBjaG9vc2UgdGhlIHBvaW50IG9mIHRoZSBtaW5pbXVtIGFuZ2xlIHdpdGggdGhlIHJheSBhcyBjb25uZWN0aW9uIHBvaW50XG5cblx0Y29uc3Qgc3RvcCA9IG0sXG5cdFx0bXggPSBtLngsXG5cdFx0bXkgPSBtLnk7XG5cdGxldCB0YW5NaW4gPSBJbmZpbml0eSwgdGFuO1xuXG5cdHAgPSBtO1xuXG5cdGRvIHtcblxuXHRcdGlmICggaHggPj0gcC54ICYmIHAueCA+PSBteCAmJiBoeCAhPT0gcC54ICYmXG5cdFx0XHRcdHBvaW50SW5UcmlhbmdsZSggaHkgPCBteSA/IGh4IDogcXgsIGh5LCBteCwgbXksIGh5IDwgbXkgPyBxeCA6IGh4LCBoeSwgcC54LCBwLnkgKSApIHtcblxuXHRcdFx0dGFuID0gTWF0aC5hYnMoIGh5IC0gcC55ICkgLyAoIGh4IC0gcC54ICk7IC8vIHRhbmdlbnRpYWxcblxuXHRcdFx0aWYgKCBsb2NhbGx5SW5zaWRlKCBwLCBob2xlICkgJiYgKCB0YW4gPCB0YW5NaW4gfHwgKCB0YW4gPT09IHRhbk1pbiAmJiAoIHAueCA+IG0ueCB8fCAoIHAueCA9PT0gbS54ICYmIHNlY3RvckNvbnRhaW5zU2VjdG9yKCBtLCBwICkgKSApICkgKSApIHtcblxuXHRcdFx0XHRtID0gcDtcblx0XHRcdFx0dGFuTWluID0gdGFuO1xuXG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHRwID0gcC5uZXh0O1xuXG5cdH0gd2hpbGUgKCBwICE9PSBzdG9wICk7XG5cblx0cmV0dXJuIG07XG5cbn1cblxuLy8gd2hldGhlciBzZWN0b3IgaW4gdmVydGV4IG0gY29udGFpbnMgc2VjdG9yIGluIHZlcnRleCBwIGluIHRoZSBzYW1lIGNvb3JkaW5hdGVzXG5mdW5jdGlvbiBzZWN0b3JDb250YWluc1NlY3RvciggbSwgcCApIHtcblxuXHRyZXR1cm4gYXJlYSggbS5wcmV2LCBtLCBwLnByZXYgKSA8IDAgJiYgYXJlYSggcC5uZXh0LCBtLCBtLm5leHQgKSA8IDA7XG5cbn1cblxuLy8gaW50ZXJsaW5rIHBvbHlnb24gbm9kZXMgaW4gei1vcmRlclxuZnVuY3Rpb24gaW5kZXhDdXJ2ZSggc3RhcnQsIG1pblgsIG1pblksIGludlNpemUgKSB7XG5cblx0bGV0IHAgPSBzdGFydDtcblx0ZG8ge1xuXG5cdFx0aWYgKCBwLnogPT09IG51bGwgKSBwLnogPSB6T3JkZXIoIHAueCwgcC55LCBtaW5YLCBtaW5ZLCBpbnZTaXplICk7XG5cdFx0cC5wcmV2WiA9IHAucHJldjtcblx0XHRwLm5leHRaID0gcC5uZXh0O1xuXHRcdHAgPSBwLm5leHQ7XG5cblx0fSB3aGlsZSAoIHAgIT09IHN0YXJ0ICk7XG5cblx0cC5wcmV2Wi5uZXh0WiA9IG51bGw7XG5cdHAucHJldlogPSBudWxsO1xuXG5cdHNvcnRMaW5rZWQoIHAgKTtcblxufVxuXG4vLyBTaW1vbiBUYXRoYW0ncyBsaW5rZWQgbGlzdCBtZXJnZSBzb3J0IGFsZ29yaXRobVxuLy8gaHR0cDovL3d3dy5jaGlhcmsuZ3JlZW5lbmQub3JnLnVrL35zZ3RhdGhhbS9hbGdvcml0aG1zL2xpc3Rzb3J0Lmh0bWxcbmZ1bmN0aW9uIHNvcnRMaW5rZWQoIGxpc3QgKSB7XG5cblx0bGV0IGksIHAsIHEsIGUsIHRhaWwsIG51bU1lcmdlcywgcFNpemUsIHFTaXplLFxuXHRcdGluU2l6ZSA9IDE7XG5cblx0ZG8ge1xuXG5cdFx0cCA9IGxpc3Q7XG5cdFx0bGlzdCA9IG51bGw7XG5cdFx0dGFpbCA9IG51bGw7XG5cdFx0bnVtTWVyZ2VzID0gMDtcblxuXHRcdHdoaWxlICggcCApIHtcblxuXHRcdFx0bnVtTWVyZ2VzICsrO1xuXHRcdFx0cSA9IHA7XG5cdFx0XHRwU2l6ZSA9IDA7XG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IGluU2l6ZTsgaSArKyApIHtcblxuXHRcdFx0XHRwU2l6ZSArKztcblx0XHRcdFx0cSA9IHEubmV4dFo7XG5cdFx0XHRcdGlmICggISBxICkgYnJlYWs7XG5cblx0XHRcdH1cblxuXHRcdFx0cVNpemUgPSBpblNpemU7XG5cblx0XHRcdHdoaWxlICggcFNpemUgPiAwIHx8ICggcVNpemUgPiAwICYmIHEgKSApIHtcblxuXHRcdFx0XHRpZiAoIHBTaXplICE9PSAwICYmICggcVNpemUgPT09IDAgfHwgISBxIHx8IHAueiA8PSBxLnogKSApIHtcblxuXHRcdFx0XHRcdGUgPSBwO1xuXHRcdFx0XHRcdHAgPSBwLm5leHRaO1xuXHRcdFx0XHRcdHBTaXplIC0tO1xuXG5cdFx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0XHRlID0gcTtcblx0XHRcdFx0XHRxID0gcS5uZXh0Wjtcblx0XHRcdFx0XHRxU2l6ZSAtLTtcblxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCB0YWlsICkgdGFpbC5uZXh0WiA9IGU7XG5cdFx0XHRcdGVsc2UgbGlzdCA9IGU7XG5cblx0XHRcdFx0ZS5wcmV2WiA9IHRhaWw7XG5cdFx0XHRcdHRhaWwgPSBlO1xuXG5cdFx0XHR9XG5cblx0XHRcdHAgPSBxO1xuXG5cdFx0fVxuXG5cdFx0dGFpbC5uZXh0WiA9IG51bGw7XG5cdFx0aW5TaXplICo9IDI7XG5cblx0fSB3aGlsZSAoIG51bU1lcmdlcyA+IDEgKTtcblxuXHRyZXR1cm4gbGlzdDtcblxufVxuXG4vLyB6LW9yZGVyIG9mIGEgcG9pbnQgZ2l2ZW4gY29vcmRzIGFuZCBpbnZlcnNlIG9mIHRoZSBsb25nZXIgc2lkZSBvZiBkYXRhIGJib3hcbmZ1bmN0aW9uIHpPcmRlciggeCwgeSwgbWluWCwgbWluWSwgaW52U2l6ZSApIHtcblxuXHQvLyBjb29yZHMgYXJlIHRyYW5zZm9ybWVkIGludG8gbm9uLW5lZ2F0aXZlIDE1LWJpdCBpbnRlZ2VyIHJhbmdlXG5cdHggPSAzMjc2NyAqICggeCAtIG1pblggKSAqIGludlNpemU7XG5cdHkgPSAzMjc2NyAqICggeSAtIG1pblkgKSAqIGludlNpemU7XG5cblx0eCA9ICggeCB8ICggeCA8PCA4ICkgKSAmIDB4MDBGRjAwRkY7XG5cdHggPSAoIHggfCAoIHggPDwgNCApICkgJiAweDBGMEYwRjBGO1xuXHR4ID0gKCB4IHwgKCB4IDw8IDIgKSApICYgMHgzMzMzMzMzMztcblx0eCA9ICggeCB8ICggeCA8PCAxICkgKSAmIDB4NTU1NTU1NTU7XG5cblx0eSA9ICggeSB8ICggeSA8PCA4ICkgKSAmIDB4MDBGRjAwRkY7XG5cdHkgPSAoIHkgfCAoIHkgPDwgNCApICkgJiAweDBGMEYwRjBGO1xuXHR5ID0gKCB5IHwgKCB5IDw8IDIgKSApICYgMHgzMzMzMzMzMztcblx0eSA9ICggeSB8ICggeSA8PCAxICkgKSAmIDB4NTU1NTU1NTU7XG5cblx0cmV0dXJuIHggfCAoIHkgPDwgMSApO1xuXG59XG5cbi8vIGZpbmQgdGhlIGxlZnRtb3N0IG5vZGUgb2YgYSBwb2x5Z29uIHJpbmdcbmZ1bmN0aW9uIGdldExlZnRtb3N0KCBzdGFydCApIHtcblxuXHRsZXQgcCA9IHN0YXJ0LFxuXHRcdGxlZnRtb3N0ID0gc3RhcnQ7XG5cdGRvIHtcblxuXHRcdGlmICggcC54IDwgbGVmdG1vc3QueCB8fCAoIHAueCA9PT0gbGVmdG1vc3QueCAmJiBwLnkgPCBsZWZ0bW9zdC55ICkgKSBsZWZ0bW9zdCA9IHA7XG5cdFx0cCA9IHAubmV4dDtcblxuXHR9IHdoaWxlICggcCAhPT0gc3RhcnQgKTtcblxuXHRyZXR1cm4gbGVmdG1vc3Q7XG5cbn1cblxuLy8gY2hlY2sgaWYgYSBwb2ludCBsaWVzIHdpdGhpbiBhIGNvbnZleCB0cmlhbmdsZVxuZnVuY3Rpb24gcG9pbnRJblRyaWFuZ2xlKCBheCwgYXksIGJ4LCBieSwgY3gsIGN5LCBweCwgcHkgKSB7XG5cblx0cmV0dXJuICggY3ggLSBweCApICogKCBheSAtIHB5ICkgLSAoIGF4IC0gcHggKSAqICggY3kgLSBweSApID49IDAgJiZcblx0XHRcdCggYXggLSBweCApICogKCBieSAtIHB5ICkgLSAoIGJ4IC0gcHggKSAqICggYXkgLSBweSApID49IDAgJiZcblx0XHRcdCggYnggLSBweCApICogKCBjeSAtIHB5ICkgLSAoIGN4IC0gcHggKSAqICggYnkgLSBweSApID49IDA7XG5cbn1cblxuLy8gY2hlY2sgaWYgYSBkaWFnb25hbCBiZXR3ZWVuIHR3byBwb2x5Z29uIG5vZGVzIGlzIHZhbGlkIChsaWVzIGluIHBvbHlnb24gaW50ZXJpb3IpXG5mdW5jdGlvbiBpc1ZhbGlkRGlhZ29uYWwoIGEsIGIgKSB7XG5cblx0cmV0dXJuIGEubmV4dC5pICE9PSBiLmkgJiYgYS5wcmV2LmkgIT09IGIuaSAmJiAhIGludGVyc2VjdHNQb2x5Z29uKCBhLCBiICkgJiYgLy8gZG9uZXMndCBpbnRlcnNlY3Qgb3RoZXIgZWRnZXNcblx0XHQoIGxvY2FsbHlJbnNpZGUoIGEsIGIgKSAmJiBsb2NhbGx5SW5zaWRlKCBiLCBhICkgJiYgbWlkZGxlSW5zaWRlKCBhLCBiICkgJiYgLy8gbG9jYWxseSB2aXNpYmxlXG5cdFx0KCBhcmVhKCBhLnByZXYsIGEsIGIucHJldiApIHx8IGFyZWEoIGEsIGIucHJldiwgYiApICkgfHwgLy8gZG9lcyBub3QgY3JlYXRlIG9wcG9zaXRlLWZhY2luZyBzZWN0b3JzXG5cdFx0ZXF1YWxzKCBhLCBiICkgJiYgYXJlYSggYS5wcmV2LCBhLCBhLm5leHQgKSA+IDAgJiYgYXJlYSggYi5wcmV2LCBiLCBiLm5leHQgKSA+IDAgKTsgLy8gc3BlY2lhbCB6ZXJvLWxlbmd0aCBjYXNlXG5cbn1cblxuLy8gc2lnbmVkIGFyZWEgb2YgYSB0cmlhbmdsZVxuZnVuY3Rpb24gYXJlYSggcCwgcSwgciApIHtcblxuXHRyZXR1cm4gKCBxLnkgLSBwLnkgKSAqICggci54IC0gcS54ICkgLSAoIHEueCAtIHAueCApICogKCByLnkgLSBxLnkgKTtcblxufVxuXG4vLyBjaGVjayBpZiB0d28gcG9pbnRzIGFyZSBlcXVhbFxuZnVuY3Rpb24gZXF1YWxzKCBwMSwgcDIgKSB7XG5cblx0cmV0dXJuIHAxLnggPT09IHAyLnggJiYgcDEueSA9PT0gcDIueTtcblxufVxuXG4vLyBjaGVjayBpZiB0d28gc2VnbWVudHMgaW50ZXJzZWN0XG5mdW5jdGlvbiBpbnRlcnNlY3RzKCBwMSwgcTEsIHAyLCBxMiApIHtcblxuXHRjb25zdCBvMSA9IHNpZ24oIGFyZWEoIHAxLCBxMSwgcDIgKSApO1xuXHRjb25zdCBvMiA9IHNpZ24oIGFyZWEoIHAxLCBxMSwgcTIgKSApO1xuXHRjb25zdCBvMyA9IHNpZ24oIGFyZWEoIHAyLCBxMiwgcDEgKSApO1xuXHRjb25zdCBvNCA9IHNpZ24oIGFyZWEoIHAyLCBxMiwgcTEgKSApO1xuXG5cdGlmICggbzEgIT09IG8yICYmIG8zICE9PSBvNCApIHJldHVybiB0cnVlOyAvLyBnZW5lcmFsIGNhc2VcblxuXHRpZiAoIG8xID09PSAwICYmIG9uU2VnbWVudCggcDEsIHAyLCBxMSApICkgcmV0dXJuIHRydWU7IC8vIHAxLCBxMSBhbmQgcDIgYXJlIGNvbGxpbmVhciBhbmQgcDIgbGllcyBvbiBwMXExXG5cdGlmICggbzIgPT09IDAgJiYgb25TZWdtZW50KCBwMSwgcTIsIHExICkgKSByZXR1cm4gdHJ1ZTsgLy8gcDEsIHExIGFuZCBxMiBhcmUgY29sbGluZWFyIGFuZCBxMiBsaWVzIG9uIHAxcTFcblx0aWYgKCBvMyA9PT0gMCAmJiBvblNlZ21lbnQoIHAyLCBwMSwgcTIgKSApIHJldHVybiB0cnVlOyAvLyBwMiwgcTIgYW5kIHAxIGFyZSBjb2xsaW5lYXIgYW5kIHAxIGxpZXMgb24gcDJxMlxuXHRpZiAoIG80ID09PSAwICYmIG9uU2VnbWVudCggcDIsIHExLCBxMiApICkgcmV0dXJuIHRydWU7IC8vIHAyLCBxMiBhbmQgcTEgYXJlIGNvbGxpbmVhciBhbmQgcTEgbGllcyBvbiBwMnEyXG5cblx0cmV0dXJuIGZhbHNlO1xuXG59XG5cbi8vIGZvciBjb2xsaW5lYXIgcG9pbnRzIHAsIHEsIHIsIGNoZWNrIGlmIHBvaW50IHEgbGllcyBvbiBzZWdtZW50IHByXG5mdW5jdGlvbiBvblNlZ21lbnQoIHAsIHEsIHIgKSB7XG5cblx0cmV0dXJuIHEueCA8PSBNYXRoLm1heCggcC54LCByLnggKSAmJiBxLnggPj0gTWF0aC5taW4oIHAueCwgci54ICkgJiYgcS55IDw9IE1hdGgubWF4KCBwLnksIHIueSApICYmIHEueSA+PSBNYXRoLm1pbiggcC55LCByLnkgKTtcblxufVxuXG5mdW5jdGlvbiBzaWduKCBudW0gKSB7XG5cblx0cmV0dXJuIG51bSA+IDAgPyAxIDogbnVtIDwgMCA/IC0gMSA6IDA7XG5cbn1cblxuLy8gY2hlY2sgaWYgYSBwb2x5Z29uIGRpYWdvbmFsIGludGVyc2VjdHMgYW55IHBvbHlnb24gc2VnbWVudHNcbmZ1bmN0aW9uIGludGVyc2VjdHNQb2x5Z29uKCBhLCBiICkge1xuXG5cdGxldCBwID0gYTtcblx0ZG8ge1xuXG5cdFx0aWYgKCBwLmkgIT09IGEuaSAmJiBwLm5leHQuaSAhPT0gYS5pICYmIHAuaSAhPT0gYi5pICYmIHAubmV4dC5pICE9PSBiLmkgJiZcblx0XHRcdFx0aW50ZXJzZWN0cyggcCwgcC5uZXh0LCBhLCBiICkgKSByZXR1cm4gdHJ1ZTtcblx0XHRwID0gcC5uZXh0O1xuXG5cdH0gd2hpbGUgKCBwICE9PSBhICk7XG5cblx0cmV0dXJuIGZhbHNlO1xuXG59XG5cbi8vIGNoZWNrIGlmIGEgcG9seWdvbiBkaWFnb25hbCBpcyBsb2NhbGx5IGluc2lkZSB0aGUgcG9seWdvblxuZnVuY3Rpb24gbG9jYWxseUluc2lkZSggYSwgYiApIHtcblxuXHRyZXR1cm4gYXJlYSggYS5wcmV2LCBhLCBhLm5leHQgKSA8IDAgP1xuXHRcdGFyZWEoIGEsIGIsIGEubmV4dCApID49IDAgJiYgYXJlYSggYSwgYS5wcmV2LCBiICkgPj0gMCA6XG5cdFx0YXJlYSggYSwgYiwgYS5wcmV2ICkgPCAwIHx8IGFyZWEoIGEsIGEubmV4dCwgYiApIDwgMDtcblxufVxuXG4vLyBjaGVjayBpZiB0aGUgbWlkZGxlIHBvaW50IG9mIGEgcG9seWdvbiBkaWFnb25hbCBpcyBpbnNpZGUgdGhlIHBvbHlnb25cbmZ1bmN0aW9uIG1pZGRsZUluc2lkZSggYSwgYiApIHtcblxuXHRsZXQgcCA9IGEsXG5cdFx0aW5zaWRlID0gZmFsc2U7XG5cdGNvbnN0IHB4ID0gKCBhLnggKyBiLnggKSAvIDIsXG5cdFx0cHkgPSAoIGEueSArIGIueSApIC8gMjtcblx0ZG8ge1xuXG5cdFx0aWYgKCAoICggcC55ID4gcHkgKSAhPT0gKCBwLm5leHQueSA+IHB5ICkgKSAmJiBwLm5leHQueSAhPT0gcC55ICYmXG5cdFx0XHRcdCggcHggPCAoIHAubmV4dC54IC0gcC54ICkgKiAoIHB5IC0gcC55ICkgLyAoIHAubmV4dC55IC0gcC55ICkgKyBwLnggKSApXG5cdFx0XHRpbnNpZGUgPSAhIGluc2lkZTtcblx0XHRwID0gcC5uZXh0O1xuXG5cdH0gd2hpbGUgKCBwICE9PSBhICk7XG5cblx0cmV0dXJuIGluc2lkZTtcblxufVxuXG4vLyBsaW5rIHR3byBwb2x5Z29uIHZlcnRpY2VzIHdpdGggYSBicmlkZ2U7IGlmIHRoZSB2ZXJ0aWNlcyBiZWxvbmcgdG8gdGhlIHNhbWUgcmluZywgaXQgc3BsaXRzIHBvbHlnb24gaW50byB0d287XG4vLyBpZiBvbmUgYmVsb25ncyB0byB0aGUgb3V0ZXIgcmluZyBhbmQgYW5vdGhlciB0byBhIGhvbGUsIGl0IG1lcmdlcyBpdCBpbnRvIGEgc2luZ2xlIHJpbmdcbmZ1bmN0aW9uIHNwbGl0UG9seWdvbiggYSwgYiApIHtcblxuXHRjb25zdCBhMiA9IG5ldyBOb2RlKCBhLmksIGEueCwgYS55ICksXG5cdFx0YjIgPSBuZXcgTm9kZSggYi5pLCBiLngsIGIueSApLFxuXHRcdGFuID0gYS5uZXh0LFxuXHRcdGJwID0gYi5wcmV2O1xuXG5cdGEubmV4dCA9IGI7XG5cdGIucHJldiA9IGE7XG5cblx0YTIubmV4dCA9IGFuO1xuXHRhbi5wcmV2ID0gYTI7XG5cblx0YjIubmV4dCA9IGEyO1xuXHRhMi5wcmV2ID0gYjI7XG5cblx0YnAubmV4dCA9IGIyO1xuXHRiMi5wcmV2ID0gYnA7XG5cblx0cmV0dXJuIGIyO1xuXG59XG5cbi8vIGNyZWF0ZSBhIG5vZGUgYW5kIG9wdGlvbmFsbHkgbGluayBpdCB3aXRoIHByZXZpb3VzIG9uZSAoaW4gYSBjaXJjdWxhciBkb3VibHkgbGlua2VkIGxpc3QpXG5mdW5jdGlvbiBpbnNlcnROb2RlKCBpLCB4LCB5LCBsYXN0ICkge1xuXG5cdGNvbnN0IHAgPSBuZXcgTm9kZSggaSwgeCwgeSApO1xuXG5cdGlmICggISBsYXN0ICkge1xuXG5cdFx0cC5wcmV2ID0gcDtcblx0XHRwLm5leHQgPSBwO1xuXG5cdH0gZWxzZSB7XG5cblx0XHRwLm5leHQgPSBsYXN0Lm5leHQ7XG5cdFx0cC5wcmV2ID0gbGFzdDtcblx0XHRsYXN0Lm5leHQucHJldiA9IHA7XG5cdFx0bGFzdC5uZXh0ID0gcDtcblxuXHR9XG5cblx0cmV0dXJuIHA7XG5cbn1cblxuZnVuY3Rpb24gcmVtb3ZlTm9kZSggcCApIHtcblxuXHRwLm5leHQucHJldiA9IHAucHJldjtcblx0cC5wcmV2Lm5leHQgPSBwLm5leHQ7XG5cblx0aWYgKCBwLnByZXZaICkgcC5wcmV2Wi5uZXh0WiA9IHAubmV4dFo7XG5cdGlmICggcC5uZXh0WiApIHAubmV4dFoucHJldlogPSBwLnByZXZaO1xuXG59XG5cbmZ1bmN0aW9uIE5vZGUoIGksIHgsIHkgKSB7XG5cblx0Ly8gdmVydGV4IGluZGV4IGluIGNvb3JkaW5hdGVzIGFycmF5XG5cdHRoaXMuaSA9IGk7XG5cblx0Ly8gdmVydGV4IGNvb3JkaW5hdGVzXG5cdHRoaXMueCA9IHg7XG5cdHRoaXMueSA9IHk7XG5cblx0Ly8gcHJldmlvdXMgYW5kIG5leHQgdmVydGV4IG5vZGVzIGluIGEgcG9seWdvbiByaW5nXG5cdHRoaXMucHJldiA9IG51bGw7XG5cdHRoaXMubmV4dCA9IG51bGw7XG5cblx0Ly8gei1vcmRlciBjdXJ2ZSB2YWx1ZVxuXHR0aGlzLnogPSBudWxsO1xuXG5cdC8vIHByZXZpb3VzIGFuZCBuZXh0IG5vZGVzIGluIHotb3JkZXJcblx0dGhpcy5wcmV2WiA9IG51bGw7XG5cdHRoaXMubmV4dFogPSBudWxsO1xuXG5cdC8vIGluZGljYXRlcyB3aGV0aGVyIHRoaXMgaXMgYSBzdGVpbmVyIHBvaW50XG5cdHRoaXMuc3RlaW5lciA9IGZhbHNlO1xuXG59XG5cbmZ1bmN0aW9uIHNpZ25lZEFyZWEoIGRhdGEsIHN0YXJ0LCBlbmQsIGRpbSApIHtcblxuXHRsZXQgc3VtID0gMDtcblx0Zm9yICggbGV0IGkgPSBzdGFydCwgaiA9IGVuZCAtIGRpbTsgaSA8IGVuZDsgaSArPSBkaW0gKSB7XG5cblx0XHRzdW0gKz0gKCBkYXRhWyBqIF0gLSBkYXRhWyBpIF0gKSAqICggZGF0YVsgaSArIDEgXSArIGRhdGFbIGogKyAxIF0gKTtcblx0XHRqID0gaTtcblxuXHR9XG5cblx0cmV0dXJuIHN1bTtcblxufVxuXG5leHBvcnQgeyBFYXJjdXQgfTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gJy4uL3V0aWxzLmpzJztcbmltcG9ydCB7IGdldFRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuLi9UaHJlZUVudmlyb25tZW50LmpzJztcbmltcG9ydCB7RWFyY3V0fSBmcm9tIFwiLi4vLi4vbGliL0VhcmN1dC5qc1wiO1xuXG5jbGFzcyBDbG9zZWRQb2x5Z29uT3V0cHV0IGV4dGVuZHMgT3V0cHV0Tm9kZXtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvKiBcbiAgICAgICAgSW50ZXJwcmV0IHRoZSBwb2ludHMgYXMgdGhlIHZlcnRpY2VzIG9mIGEgMkQgcGxhbmFyIHBvbHlnb24uIFRoZSBwb2x5Z29uIGNhbiBiZSBub25jb252ZXgsIGJ1dCBpZGVhbGx5IG5vbi1zZWxmLWludGVyc2VjdGluZy5cblxuICAgICAgICBDdXJyZW50bHkgdGhpcyBtZWFucyBlYWNoIHZlcnRleCB3aWxsIGhhdmUgaXRzIHBvc2l0aW9uIHByb2plY3RlZCB0byB0aGUgWFkgcGxhbmUsIHdpdGggdGhlIFogY29tcG9uZW50IGxvc3QuXG4gICAgICAgIFRvZG86IHN1cHBvcnQgWzAseCx5XSBhbmQgW3gsMCx5XSBhbmQgc28gb24gYnkgZHluYW1pY2FsbHkgY29tcHV0aW5nIHRoZSBwbGFuZSBvZiBiZXN0IGZpdCB0aGVuIHByb2plY3RpbmcgdGhlcmVcblxuXG4gICAgICAgIFNob3VsZCBiZSAuYWRkKCllZCB0byBhIFRyYW5zZm9ybWF0aW9uIHRvIHdvcmsuXG4gICAgICAgICAgICBvcHRpb25zOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG9wYWNpdHk6IG51bWJlclxuICAgICAgICAgICAgICAgIGNvbG9yOiBoZXggY29kZSBvciBUSFJFRS5Db2xvcigpXG4gICAgICAgICAgICB9XG4gICAgICAgICovXG5cbiAgICAgICAgdGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcbiAgICAgICAgdGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yIHx8IDB4MDAwMGZmO1xuICAgICAgICAvL3RvZG86IGN1c3RvbSBjb2xvciBmdW5jdGlvbj9cblxuICAgICAgICB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IDA7IC8vc2hvdWxkIGFsd2F5cyBiZSBlcXVhbCB0byB0aGlzLnBvaW50cy5sZW5ndGhcbiAgICAgICAgdGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBob3cgbWFueSB0aW1lcyB0byBiZSBjYWxsZWQgaW4gZWFjaCBkaXJlY3Rpb25cbiAgICAgICAgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDM7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/XG5cbiAgICAgICAgdGhpcy5pbml0KCk7XG4gICAgfVxuICAgIGluaXQoKXtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcbiAgICAgICAgdGhpcy5tYWtlR2VvbWV0cnkoKTtcblxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtcbiAgICAgICAgICAgIG9wYWNpdHk6IHRoaXMuX29wYWNpdHksXG4gICAgICAgICAgICAvL2NvbG9yOiB0aGlzLl9jb2xvcixcbiAgICAgICAgICAgIHNpZGU6IFRIUkVFLkRvdWJsZVNpZGUsXG4gICAgICAgICAgICB2ZXJ0ZXhDb2xvcnM6IFRIUkVFLlZlcnRleENvbG9ycyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cbiAgICAgICAgdGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy8gc2V0dGVyIHNldHMgdHJhbnNwYXJlbnQgZmxhZyBpZiBuZWNlc3NhcnlcbiAgICAgICAgdGhpcy5jb2xvciA9IHRoaXMuX2NvbG9yOyAvL3NldHRlciBzZXRzIGNvbG9yIGF0dHJpYnV0ZVxuXG4gICAgICAgIGdldFRocmVlRW52aXJvbm1lbnQoKS5zY2VuZS5hZGQodGhpcy5tZXNoKTtcbiAgICB9XG5cbiAgICBtYWtlR2VvbWV0cnkoKXtcbiAgICAgICAgY29uc3QgTUFYX1BPSU5UUyA9IDEwMDsgLy90aGVzZSBhcnJheXMgZ2V0IGRpc2NhcmRlZCBvbiBmaXJzdCBhY3RpdmF0aW9uIGFueXdheXNcbiAgICAgICAgdGhpcy5fdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBNQVhfUE9JTlRTKTtcbiAgICAgICAgdGhpcy5fY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheSgzICogTUFYX1BPSU5UUyk7XG4gICAgICAgIHRoaXMuX2ZhY2VJbmRpY2VzID0gbmV3IFVpbnQzMkFycmF5KDMgKiBNQVhfUE9JTlRTKTtcblxuICAgICAgICB0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdwb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl92ZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ2NvbG9yJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX2NvbG9ycywgMyApICk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LnNldEluZGV4KG5ldyBUSFJFRS5VaW50MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX2ZhY2VJbmRpY2VzLCAxICkgKTtcblxuICAgICAgICB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vdXNlZCBkdXJpbmcgdXBkYXRlcyBhcyBhIHBvaW50ZXIgdG8gdGhlIGJ1ZmZlclxuICAgICAgICB0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cbiAgICB9XG4gICAgX29uQWRkKCl7XG4gICAgICAgIC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBEb21haW4gbm9kZSB3ZSdyZSByZW5kZXJpbmcgZnJvbVxuICAgICAgICBsZXQgcm9vdCA9IG51bGw7XG4gICAgICAgIHRyeXtcbiAgICAgICAgICAgcm9vdCA9IHRoaXMuZ2V0Q2xvc2VzdERvbWFpbigpOyAvL3RvZG86IGltcGxlbWVudCBzb21ldGhpbmcgbGlrZSBhc3NlcnQgcm9vdCB0eXBlb2YgUm9vdE5vZGVcbiAgICAgICAgfWNhdGNoKGVycm9yKXtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihlcnJvcik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuICAgICAgICB0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcbiAgICB9XG5cbiAgICBfb25GaXJzdEFjdGl2YXRpb24oKXtcbiAgICAgICAgdGhpcy5fb25BZGQoKTsgLy9zZXR1cCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiBhbmQgdGhpcy5pdGVtRGltZW5zaW9ucy4gdXNlZCBoZXJlIGFnYWluIGJlY2F1c2UgY2xvbmluZyBtZWFucyB0aGUgb25BZGQoKSBtaWdodCBiZSBjYWxsZWQgYmVmb3JlIHRoaXMgaXMgY29ubmVjdGVkIHRvIGEgdHlwZSBvZiBkb21haW5cblxuICAgICAgICAvLyBwZXJoYXBzIGluc3RlYWQgb2YgZ2VuZXJhdGluZyBhIHdob2xlIG5ldyBhcnJheSwgdGhpcyBjYW4gcmV1c2UgdGhlIG9sZCBvbmU/XG5cbiAgICAgICAgY29uc3QgbnVtVmVydHMgPSB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblxuICAgICAgICBsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuICAgICAgICB0aGlzLl92ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlLnNldEFycmF5KHRoaXMuX3ZlcnRpY2VzKTtcbiAgICAgICAgcG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG4gICAgICAgIGxldCBjb2xvckF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMuY29sb3I7XG4gICAgICAgIHRoaXMuX2NvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkoIDMgKiBudW1WZXJ0cyk7XG4gICAgICAgIGNvbG9yQXR0cmlidXRlLnNldEFycmF5KHRoaXMuX2NvbG9ycyk7XG5cbiAgICAgICAgdGhpcy5fZmFjZUluZGljZXMgPSBuZXcgVWludDMyQXJyYXkoIDMgKiBudW1WZXJ0cyk7IC8vYXQgbW9zdCBvbmUgZmFjZSBwZXIgdmVydGV4LlxuICAgICAgICAvL2lzIHRoaXMgZW5vdWdoPyBwcm9iYWJseT8/IHRvZG86IGRvIHRoZSBtYXRoIGFuZCBzZWUgd2hldGhlciBhIHBvbHlnb24gd2l0aCBuIHZlcnRpY2VzIGNhbiBoYXZlIG4gZmFjZXMuIEl0IGNhbiBkZWZpbml0ZWx5IGhhdmUgYXQgbGVhc3Qgbi0yIGNhc2VzIChuLWdvbikuIEkgdGhpbmsgbm8gYnV0IEkgaGF2ZW4ndCBjaGVja2VkXG4gICAgICAgIGxldCBmYWNlQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuaW5kZXg7XG4gICAgICAgIGZhY2VBdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fZmFjZUluZGljZXMpO1xuXG4gICAgICAgIHRoaXMuX3Byb2plY3RlZDJEQ29vcmRzID0gbmV3IEZsb2F0MzJBcnJheSggMiAqIG51bVZlcnRzKTtcblxuICAgICAgICB0aGlzLnRyaWFuZ3VsYXRlQW5kR2VuZXJhdGVGYWNlcygpO1xuICAgICAgICB0aGlzLnNldEFsbFZlcnRpY2VzVG9Db2xvcih0aGlzLmNvbG9yKTtcbiAgICB9XG5cbiAgICB0cmlhbmd1bGF0ZUFuZEdlbmVyYXRlRmFjZXMoKXtcblxuICAgICAgICAvLyB0aGlzLl92ZXJ0aWNlcyBpcyBhbiBhcnJheSB3aGVyZSBldmVyeSAzIG51bWJlcnMgcmVwcmVzZW50IGFuICh4LHkseikgdHJpcGxldC5cbiAgICAgICAgLy8gd2Ugd2FudCB0byBpbnRlcnByZXQgdGhlc2UgcG9pbnRzIGFzIHRoZSBib3VuZGFyaWVzIG9mIGEgY29udmV4IHBvbHlnb24uXG4gICAgICAgIC8vIGlmIHRoZXkgc3BlbGwgb3V0IGEgbm9uY29udmV4IHBvbHlnb24sIHdlIG5lZWQgdG8gZmlndXJlIG91dCBob3cgdG8gdHJpYW5ndWF0ZSBpdCBwcm9wZXJseVxuXG4gICAgICAgIC8vY29kZSBhZGFwdGVkIGZyb20gdGhyZWUuanMvc3JjL2V4dHJhcy9TaGFwZVV0aWxzLmpzXG5cbiAgICAgICAgLy9wcm9qZWN0IG91ciBwb2x5Z29uIHdpdGggdmVydGljZXMgaW4gM0Qgc3BhY2UgdG8gYSAyRCBwbGFuZSwgc28gd2UgY2FuIHRyaWFuZ3VsYXRlIGEgMkQgcG9seWdvblxuICAgICAgICBjb25zdCBudW1WZXJ0cyA9IHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuICAgICAgICBmb3IobGV0IGk9MDtpPG51bVZlcnRzO2krKyl7XG5cbiAgICAgICAgICAgIGNvbnN0IHByb2plY3RlZFggPSB0aGlzLl92ZXJ0aWNlc1tpKnRoaXMuX291dHB1dERpbWVuc2lvbnNdOyAvL3ZlcnRleCB4XG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0ZWRZID0gdGhpcy5fdmVydGljZXNbaSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKzFdOyAvL3ZlcnRleCB5LCB0aHJvd2luZyBhd2F5IHouIHRvZG86IGFjdHVhbGx5IGRvIGEgc21hcnQsIGR5bmFtaWMgcHJvamVjdGlvbi4gYW5kIG5vdCBkbyB0aGF0XG4gICAgICAgICAgICAvL2NvbnN0IGlnbm9yZWQgPSB0aGlzLl92ZXJ0aWNlc1tpKnRoaXMuX291dHB1dERpbWVuc2lvbnMrMl07XG4gICAgXG4gICAgICAgICAgICB0aGlzLl9wcm9qZWN0ZWQyRENvb3Jkc1tpKjJdID0gcHJvamVjdGVkWDtcbiAgICAgICAgICAgIHRoaXMuX3Byb2plY3RlZDJEQ29vcmRzW2kqMisxXSA9IHByb2plY3RlZFk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBob2xlSW5kaWNlcyA9IFtdO1xuXHRcdGNvbnN0IHRyaWFuZ2xlcyA9IEVhcmN1dC50cmlhbmd1bGF0ZSggdGhpcy5fcHJvamVjdGVkMkRDb29yZHMsIGhvbGVJbmRpY2VzICk7XG5cbiAgICAgICAgLy90aGlzIGNvdWxkIGVycm9yIGlmIHRoZXJlIGFyZSBtb3JlIDMqdHJpYW5nbGVzIHRoYW4gdGhlcmUgYXJlIHNwb3RzIGluIGZhY2VJbmRpY2VzXG5cdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgdHJpYW5nbGVzLmxlbmd0aDsgaSArPSAzICkge1xuICAgICAgICAgICAgdGhpcy5fZmFjZUluZGljZXNbaV0gPSB0cmlhbmdsZXNbaV07XG4gICAgICAgICAgICB0aGlzLl9mYWNlSW5kaWNlc1tpKzFdID0gdHJpYW5nbGVzW2krMV07XG4gICAgICAgICAgICB0aGlzLl9mYWNlSW5kaWNlc1tpKzJdID0gdHJpYW5nbGVzW2krMl07XG5cdFx0fVxuXG4gICAgfVxuICAgIGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6LCAuLi5vdGhlckFyZ3Mpe1xuICAgICAgICBpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG4gICAgICAgICAgICB0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7ICAgIFxuICAgICAgICB9XG5cbiAgICAgICAgLy9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuICAgICAgICAvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuICAgICAgICBsZXQgeFZhbHVlID0gIHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuICAgICAgICBsZXQgeVZhbHVlID0gIHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuICAgICAgICBsZXQgelZhbHVlID0gIHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXG4gICAgICAgIHRoaXMuc2F2ZVZlcnRleEluZm9JbkJ1ZmZlcnModGhpcy5fdmVydGljZXMsIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LCB4VmFsdWUseVZhbHVlLHpWYWx1ZSk7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4Kys7XG4gICAgfVxuICAgIHNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKGFycmF5LCBpbmRleCwgdmFsdWUxLHZhbHVlMix2YWx1ZTMpe1xuICAgICAgICBhcnJheVtpbmRleCp0aGlzLl9vdXRwdXREaW1lbnNpb25zXSAgID0gdmFsdWUxXG4gICAgICAgIGFycmF5W2luZGV4KnRoaXMuX291dHB1dERpbWVuc2lvbnMrMV0gPSB2YWx1ZTJcbiAgICAgICAgYXJyYXlbaW5kZXgqdGhpcy5fb3V0cHV0RGltZW5zaW9ucysyXSA9IHZhbHVlM1xuICAgIH1cbiAgICBvbkFmdGVyQWN0aXZhdGlvbigpe1xuICAgICAgICBsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuICAgICAgICBwb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cbiAgICAgICAgdGhpcy50cmlhbmd1bGF0ZUFuZEdlbmVyYXRlRmFjZXMoKTtcblxuICAgICAgICBsZXQgaW5kZXhBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5pbmRleDtcbiAgICAgICAgaW5kZXhBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmNvbXB1dGVCb3VuZGluZ1NwaGVyZSgpOyAvL3Vuc3VyZSBpZiBuZWVkZWRcblxuICAgICAgICB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vcmVzZXQgYWZ0ZXIgZWFjaCB1cGRhdGVcbiAgICB9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICBnZXRUaHJlZUVudmlyb25tZW50KCkuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG4gICAgfVxuICAgIHNldEFsbFZlcnRpY2VzVG9Db2xvcihjb2xvcil7XG4gICAgICAgIGNvbnN0IGNvbCA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG4gICAgICAgIGNvbnN0IG51bVZlcnRpY2VzID0gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb247XG4gICAgICAgIGZvcihsZXQgaT0wOyBpPG51bVZlcnRpY2VzO2krKyl7XG4gICAgICAgICAgICAvL0Rvbid0IGZvcmdldCBzb21lIHBvaW50cyBhcHBlYXIgdHdpY2UgLSBhcyB0aGUgZW5kIG9mIG9uZSBsaW5lIHNlZ21lbnQgYW5kIHRoZSBiZWdpbm5pbmcgb2YgdGhlIG5leHQuXG4gICAgICAgICAgICB0aGlzLl9zZXRDb2xvckZvclZlcnRleFJHQihpLCBjb2wuciwgY29sLmcsIGNvbC5iKTtcbiAgICAgICAgfVxuICAgICAgICAvL3RlbGwgdGhyZWUuanMgdG8gdXBkYXRlIGNvbG9yc1xuICAgICAgICBsZXQgY29sb3JBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLmNvbG9yO1xuICAgICAgICBjb2xvckF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgfVxuICAgIF9zZXRDb2xvckZvclZlcnRleFJHQih2ZXJ0ZXhJbmRleCwgbm9ybWFsaXplZFIsIG5vcm1hbGl6ZWRHLCBub3JtYWxpemVkQil7XG4gICAgICAgIC8vY29sb3IgaXMgYSBUSFJFRS5Db2xvciBoZXJlXG4gICAgICAgIGxldCBjb2xvckFycmF5ID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvci5hcnJheTtcbiAgICAgICAgbGV0IGluZGV4ID0gdmVydGV4SW5kZXggKiAzOyAvLyozIGJlY2F1c2UgY29sb3JzIGhhdmUgMyBjaGFubmVsc1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgMF0gPSBub3JtYWxpemVkUjtcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDFdID0gbm9ybWFsaXplZEc7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAyXSA9IG5vcm1hbGl6ZWRCO1xuXG4gICAgICAgIC8vTk9URTogY29sb3JBdHRyaWJ1dGUubmVlZHNVcGRhdGUgbXVzdCBiZSBzZXQgdG8gdHJ1ZSBhZnRlciB0aGlzIG9yIGVsc2UgdGhlIGNvbG9ycyB3b24ndCBzaG93IHVwIVxuICAgIH1cbiAgICBzZXQgY29sb3IoY29sb3Ipe1xuICAgICAgICAvL2NvbG9yIGNhbiBiZSBhIFRIUkVFLkNvbG9yKClcbiAgICAgICAgdGhpcy5fY29sb3IgPSBjb2xvcjtcbiAgICAgICAgdGhpcy5zZXRBbGxWZXJ0aWNlc1RvQ29sb3IoY29sb3IpO1xuICAgIH1cbiAgICBnZXQgY29sb3IoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yO1xuICAgIH1cbiAgICBzZXQgb3BhY2l0eShvcGFjaXR5KXtcbiAgICAgICAgLy9tZXNoIGlzIGFsd2F5cyB0cmFuc3BhcmVudFxuICAgICAgICB0aGlzLm1hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuICAgICAgICB0aGlzLl9vcGFjaXR5ID0gb3BhY2l0eTtcbiAgICB9XG4gICAgZ2V0IG9wYWNpdHkoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29wYWNpdHk7XG4gICAgfVxuICAgIGNsb25lKCl7XG4gICAgICAgIHJldHVybiBuZXcgQ2xvc2VkUG9seWdvbk91dHB1dCh7Y29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eX0pO1xuICAgIH1cbn1cblxuZXhwb3J0IHtDbG9zZWRQb2x5Z29uT3V0cHV0fTtcbiIsInZhciBleHBsYW5hcmlhbkFycm93U1ZHID0gXCJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBEOTRiV3dnZG1WeWMybHZiajBpTVM0d0lpQmxibU52WkdsdVp6MGlWVlJHTFRnaUlITjBZVzVrWVd4dmJtVTlJbTV2SWo4K0Nqd2hMUzBnUTNKbFlYUmxaQ0IzYVhSb0lFbHVhM05qWVhCbElDaG9kSFJ3T2k4dmQzZDNMbWx1YTNOallYQmxMbTl5Wnk4cElDMHRQZ29LUEhOMlp3b2dJQ0I0Yld4dWN6cGtZejBpYUhSMGNEb3ZMM0IxY213dWIzSm5MMlJqTDJWc1pXMWxiblJ6THpFdU1TOGlDaUFnSUhodGJHNXpPbU5qUFNKb2RIUndPaTh2WTNKbFlYUnBkbVZqYjIxdGIyNXpMbTl5Wnk5dWN5TWlDaUFnSUhodGJHNXpPbkprWmowaWFIUjBjRG92TDNkM2R5NTNNeTV2Y21jdk1UazVPUzh3TWk4eU1pMXlaR1l0YzNsdWRHRjRMVzV6SXlJS0lDQWdlRzFzYm5NNmMzWm5QU0pvZEhSd09pOHZkM2QzTG5jekxtOXlaeTh5TURBd0wzTjJaeUlLSUNBZ2VHMXNibk05SW1oMGRIQTZMeTkzZDNjdWR6TXViM0puTHpJd01EQXZjM1puSWdvZ0lDQjRiV3h1Y3pwNGJHbHVhejBpYUhSMGNEb3ZMM2QzZHk1M015NXZjbWN2TVRrNU9TOTRiR2x1YXlJS0lDQWdlRzFzYm5NNmMyOWthWEJ2WkdrOUltaDBkSEE2THk5emIyUnBjRzlrYVM1emIzVnlZMlZtYjNKblpTNXVaWFF2UkZSRUwzTnZaR2x3YjJScExUQXVaSFJrSWdvZ0lDQjRiV3h1Y3pwcGJtdHpZMkZ3WlQwaWFIUjBjRG92TDNkM2R5NXBibXR6WTJGd1pTNXZjbWN2Ym1GdFpYTndZV05sY3k5cGJtdHpZMkZ3WlNJS0lDQWdkMmxrZEdnOUlqSXdNQ0lLSUNBZ2FHVnBaMmgwUFNJeE16QWlDaUFnSUhacFpYZENiM2c5SWpBZ01DQXlNREFnTVRNd0lnb2dJQ0JwWkQwaWMzWm5NaUlLSUNBZ2RtVnljMmx2YmowaU1TNHhJZ29nSUNCcGJtdHpZMkZ3WlRwMlpYSnphVzl1UFNJd0xqa3hJSEl4TXpjeU5TSUtJQ0FnYzI5a2FYQnZaR2s2Wkc5amJtRnRaVDBpUlhod2JHRnVZWEpwWVc1T1pYaDBRWEp5YjNjdWMzWm5JajRLSUNBOFpHVm1jejRLUEhKaFpHbGhiRWR5WVdScFpXNTBJR2xrUFNKaElpQmplRDBpTlRBd0lpQmplVDBpTmpJM0xqY3hJaUJ5UFNJeU5ESXVNelVpSUdkeVlXUnBaVzUwVkhKaGJuTm1iM0p0UFNKdFlYUnlhWGdvTUNBdU1qazNNRElnTFRNdU9ETTVNU0F0TVM0eE9UTXhaUzA0SURJME1EZ3VNU0E0TXpndU9EVXBJaUJuY21Ga2FXVnVkRlZ1YVhSelBTSjFjMlZ5VTNCaFkyVlBibFZ6WlNJK0NqeHpkRzl3SUhOMGIzQXRZMjlzYjNJOUlpTmlZemN6TVRraUlHOW1abk5sZEQwaU1DSXZQZ284YzNSdmNDQnpkRzl3TFdOdmJHOXlQU0lqWmpCa01qWXpJaUJ2Wm1aelpYUTlJakVpTHo0S1BDOXlZV1JwWVd4SGNtRmthV1Z1ZEQ0S1BDOWtaV1p6UGdvOGJXVjBZV1JoZEdFK0NqeHlaR1k2VWtSR1BnbzhZMk02VjI5eWF5QnlaR1k2WVdKdmRYUTlJaUkrQ2p4a1l6cG1iM0p0WVhRK2FXMWhaMlV2YzNabkszaHRiRHd2WkdNNlptOXliV0YwUGdvOFpHTTZkSGx3WlNCeVpHWTZjbVZ6YjNWeVkyVTlJbWgwZEhBNkx5OXdkWEpzTG05eVp5OWtZeTlrWTIxcGRIbHdaUzlUZEdsc2JFbHRZV2RsSWk4K0NqeGtZenAwYVhSc1pTOCtDand2WTJNNlYyOXlhejRLUEM5eVpHWTZVa1JHUGdvOEwyMWxkR0ZrWVhSaFBnbzhaeUIwY21GdWMyWnZjbTA5SW5SeVlXNXpiR0YwWlNnd0lDMDVNakl1TXpZcElqNEtQSEJoZEdnZ1pEMGliVEU1Tnk0ME55QTVPRGN1TXpaak1DMHlOQzR5T0RFdE9EY3VNall4TFRZeExqY3dPQzA0Tnk0eU5qRXROakV1TnpBNGRqSTVMalk1Tkd3dE1UTXVOVFl6SURBdU16YzVOR010TVRNdU5UWXpJREF1TXpjNU16a3ROakl1TWpBeUlESXVPREkzTVMwM05DNDRNVEVnTnk0NU5qVTNMVEV5TGpZd09TQTFMakV6T0RZdE1Ua3VNekF4SURFMExqWTVOUzB4T1M0ek1ERWdNak11TmpZNUlEQWdPQzQ1TnpNNElETXVPVGN6TlNBeE9DNHhOak1nTVRrdU16QXhJREl6TGpZMk9TQXhOUzR6TWpjZ05TNDFNRFUxSURZeExqSTBPQ0EzTGpVNE5qTWdOelF1T0RFeElEY3VPVFkxTjJ3eE15NDFOak1nTUM0ek56azBkakk1TGpZNU5ITTROeTR5TmpFdE16Y3VOREk0SURnM0xqSTJNUzAyTVM0M01EaDZJaUJtYVd4c1BTSjFjbXdvSTJFcElpQnpkSEp2YTJVOUlpTTNNelUxTTJRaUlITjBjbTlyWlMxM2FXUjBhRDBpTWk0Mk1qZzFJaTgrQ2p4bklIUnlZVzV6Wm05eWJUMGliV0YwY21sNEtEQWdMakkyTWpnMUlDMHVNall5T0RVZ01DQXhOemd1TVRNZ09EWXdMakF4S1NJZ2MzUnliMnRsUFNJak1EQXdJaUJ6ZEhKdmEyVXRkMmxrZEdnOUlqRXdJajRLUEdWc2JHbHdjMlVnWTNnOUlqVTBOeTR4TkNJZ1kzazlJakV5TUM0NU15SWdjbmc5SWpJMUxqY3hOQ0lnY25rOUlqVXhMalF5T1NJZ1ptbHNiRDBpSTJabVppSXZQZ284Wld4c2FYQnpaU0JqZUQwaU5UTTBMak0zSWlCamVUMGlNVEl6TGpVeklpQnllRDBpTVRJdU5qSTNJaUJ5ZVQwaU1qWXVNalkwSWk4K0Nqd3ZaejRLUEdjZ2RISmhibk5tYjNKdFBTSnRZWFJ5YVhnb01DQXRMakkyTWpnMUlDMHVNall5T0RVZ01DQXhOemd1TmpZZ01URXhOQzQzS1NJZ2MzUnliMnRsUFNJak1EQXdJaUJ6ZEhKdmEyVXRkMmxrZEdnOUlqRXdJajRLUEdWc2JHbHdjMlVnWTNnOUlqVTBOeTR4TkNJZ1kzazlJakV5TUM0NU15SWdjbmc5SWpJMUxqY3hOQ0lnY25rOUlqVXhMalF5T1NJZ1ptbHNiRDBpSTJabVppSXZQZ284Wld4c2FYQnpaU0JqZUQwaU5UTTBMak0zSWlCamVUMGlNVEl6TGpVeklpQnllRDBpTVRJdU5qSTNJaUJ5ZVQwaU1qWXVNalkwSWk4K0Nqd3ZaejRLUEM5blBnbzhMM04yWno0S1wiO1xuXG5leHBvcnQgZGVmYXVsdCBleHBsYW5hcmlhbkFycm93U1ZHO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qVGhpcyBjbGFzcyBpcyBzdXBwb3NlZCB0byB0dXJuIGEgc2VyaWVzIG9mXG5kaXIuZGVsYXkoKVxuZGlyLnRyYW5zaXRpb25UbyguLi4pXG5kaXIuZGVsYXkoKVxuZGlyLm5leHRTbGlkZSgpO1xuXG5pbnRvIGEgc2VxdWVuY2UgdGhhdCBvbmx5IGFkdmFuY2VzIHdoZW4gdGhlIHJpZ2h0IGFycm93IGlzIHByZXNzZWQuXG5cbkFueSBkaXZzIHdpdGggdGhlIGV4cC1zbGlkZSBjbGFzcyB3aWxsIGFsc28gYmUgc2hvd24gYW5kIGhpZGRlbiBvbmUgYnkgb25lLlxuXG5BbHNvLFxuXG4qL1xuXG5pbXBvcnQge0FuaW1hdGlvbiwgRWFzaW5nfSBmcm9tICcuL0FuaW1hdGlvbi5qcyc7XG5pbXBvcnQgZXhwbGFuYXJpYW5BcnJvd1NWRyBmcm9tICcuL0RpcmVjdG9ySW1hZ2VDb25zdGFudHMuanMnO1xuXG5jbGFzcyBEaXJlY3Rpb25BcnJvd3tcbiAgICBjb25zdHJ1Y3RvcihmYWNlUmlnaHQpe1xuICAgICAgICB0aGlzLmFycm93SW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLnNyYyA9IGV4cGxhbmFyaWFuQXJyb3dTVkc7XG5cbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3dcIik7XG5cbiAgICAgICAgZmFjZVJpZ2h0ID0gZmFjZVJpZ2h0PT09dW5kZWZpbmVkID8gdHJ1ZSA6IGZhY2VSaWdodDtcblxuICAgICAgICBpZihmYWNlUmlnaHQpe1xuICAgICAgICAgICAgdGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3ctcmlnaHRcIilcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICB0aGlzLmFycm93SW1hZ2UuY2xhc3NMaXN0LmFkZChcImV4cC1hcnJvdy1sZWZ0XCIpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLm9uY2xpY2sgPSAoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHRoaXMuaGlkZVNlbGYoKTtcbiAgICAgICAgICAgIHRoaXMub25jbGlja0NhbGxiYWNrKCk7XG4gICAgICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICAgICAgdGhpcy5vbmNsaWNrQ2FsbGJhY2sgPSBudWxsOyAvLyB0byBiZSBzZXQgZXh0ZXJuYWxseVxuICAgIH1cbiAgICBzaG93U2VsZigpe1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnO1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3R5bGUub3BhY2l0eSA9IDE7XG4gICAgfVxuICAgIGhpZGVTZWxmKCl7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5vcGFjaXR5ID0gMDtcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gICAgfVxufVxuXG5cbmNsYXNzIE5vbkRlY3JlYXNpbmdEaXJlY3RvcntcbiAgICAvL1VzaW5nIGEgTm9uRGVjcmVhc2luZ0RpcmVjdG9yLCBjcmVhdGUgSFRNTCBlbGVtZW50cyB3aXRoIHRoZSAnZXhwLXNsaWRlJyBjbGFzcy5cbiAgICAvL1RoZSBmaXJzdCBIVE1MIGVsZW1lbnQgd2l0aCB0aGUgJ2V4cC1zbGlkZScgY2xhc3Mgd2lsbCBiZSBzaG93biBmaXJzdC4gV2hlbiB0aGUgbmV4dCBzbGlkZSBidXR0b24gaXMgY2xpY2tlZCwgdGhhdCB3aWxsIGZhZGUgb3V0IGFuZCBiZSByZXBsYWNlZCB3aXRoIHRoZSBuZXh0IGVsZW1lbnQgd2l0aCB0aGUgZXhwLXNsaWRlIGNsYXNzLCBpbiBvcmRlciBvZiBIVE1MLlxuICAgIC8vSWYgeW91IHdhbnQgdG8gZGlzcGxheSBtdWx0aXBsZSBIVE1MIGVsZW1lbnRzIGF0IHRoZSBzYW1lIHRpbWUsICdleHAtc2xpZGUtPG4+JyB3aWxsIGFsc28gYmUgZGlzcGxheWVkIHdoZW4gdGhlIHByZXNlbnRhdGlvbiBpcyBjdXJyZW50bHkgb24gc2xpZGUgbnVtYmVyIG4uIEZvciBleGFtcGxlLCBldmVyeXRoaW5nIGluIHRoZSBleHAtc2xpZGUtMSBjbGFzcyB3aWxsIGJlIHZpc2libGUgZnJvbSB0aGUgc3RhcnQsIGFuZCB0aGVuIGV4cC1zbGlkZS0yLCBhbmQgc28gb24uXG4gICAgLy9Eb24ndCBnaXZlIGFuIGVsZW1lbnQgYm90aCB0aGUgZXhwLXNsaWRlIGFuZCBleHAtc2xpZGUtbiBjbGFzc2VzLiBcblxuICAgIC8vIEkgd2FudCBEaXJlY3RvcigpIHRvIGJlIGFibGUgdG8gYmFja3RyYWNrIGJ5IHByZXNzaW5nIGJhY2t3YXJkcy4gVGhpcyBkb2Vzbid0IGRvIHRoYXQuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyl7XG4gICAgICAgIHRoaXMuc2xpZGVzID0gW107XG4gICAgICAgIHRoaXMuY3VycmVudFNsaWRlSW5kZXggPSAwOyAgICAgICAgXG4gICAgICAgIHRoaXMubnVtU2xpZGVzID0gMDtcbiAgICAgICAgdGhpcy5udW1IVE1MU2xpZGVzID0gMDtcblxuICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBcblxuXG4gICAgYXN5bmMgYmVnaW4oKXtcbiAgICAgICAgYXdhaXQgdGhpcy53YWl0Rm9yUGFnZUxvYWQoKTtcblxuICAgICAgICB0aGlzLnNldHVwQW5kSGlkZUFsbFNsaWRlSFRNTEVsZW1lbnRzKCk7XG5cbiAgICAgICAgdGhpcy5zd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KDApOyAvL3VuaGlkZSBmaXJzdCBvbmVcblxuICAgICAgICB0aGlzLnNldHVwQ2xpY2thYmxlcygpO1xuXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIHNldHVwQW5kSGlkZUFsbFNsaWRlSFRNTEVsZW1lbnRzKCl7XG5cbiAgICAgICAgdGhpcy5zbGlkZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXhwLXNsaWRlXCIpO1xuICAgICAgICB0aGlzLm51bUhUTUxTbGlkZXMgPSB0aGlzLnNsaWRlcy5sZW5ndGg7XG5cbiAgICAgICAgLy9oaWRlIGFsbCBzbGlkZXMgZXhjZXB0IGZpcnN0IG9uZVxuICAgICAgICBmb3IodmFyIGk9MDtpPHRoaXMubnVtSFRNTFNsaWRlcztpKyspe1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbaV0uc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1tpXS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbaV0uc3R5bGUuZGlzcGxheSA9ICdub25lJzsvL29wYWNpdHk9MCBhbG9uZSB3b24ndCBiZSBpbnN0YW50IGJlY2F1c2Ugb2YgdGhlIDFzIENTUyB0cmFuc2l0aW9uXG4gICAgICAgIH1cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgICAgICAvL25vdyBoYW5kbGUgZXhwLXNsaWRlLTxuPlxuICAgICAgICBsZXQgYWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2NsYXNzKj1cImV4cC1zbGlkZS1cIl0nKTsgLy90aGlzIGlzIGEgQ1NTIGF0dHJpYnV0ZSBzZWxlY3RvciwgYW5kIEkgaGF0ZSB0aGF0IHRoaXMgZXhpc3RzLiBpdCdzIHNvIHVnbHlcbiAgICAgICAgZm9yKHZhciBpPTA7aTxhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICBhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHNbaV0uc3R5bGUub3BhY2l0eSA9IDA7IFxuICAgICAgICAgICAgYWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzW2ldLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gICAgICAgICAgICBhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHNbaV0uc3R5bGUuZGlzcGxheSA9ICdub25lJzsvL29wYWNpdHk9MCBhbG9uZSB3b24ndCBiZSBpbnN0YW50IGJlY2F1c2Ugb2YgdGhlIDFzIENTUyB0cmFuc2l0aW9uXG4gICAgICAgIH1cblxuICAgICAgICAvL3VuZG8gc2V0dGluZyBkaXNwbGF5LW5vbmUgYWZ0ZXIgYSBiaXQgb2YgdGltZVxuICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICAgICAgZm9yKHZhciBpPTA7aTxzZWxmLnNsaWRlcy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgICAgICBzZWxmLnNsaWRlc1tpXS5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IodmFyIGk9MDtpPGFsbFNwZWNpZmljU2xpZGVFbGVtZW50cy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgICAgICBhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHNbaV0uc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LDEpO1xuXG4gICAgfVxuXG4gICAgc2V0dXBDbGlja2FibGVzKCl7XG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cgPSBuZXcgRGlyZWN0aW9uQXJyb3coKTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLnJpZ2h0QXJyb3cuYXJyb3dJbWFnZSk7XG4gICAgICAgIHRoaXMucmlnaHRBcnJvdy5vbmNsaWNrQ2FsbGJhY2sgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgc2VsZi5fY2hhbmdlU2xpZGUoMSwgZnVuY3Rpb24oKXt9KTsgLy8gdGhpcyBlcnJvcnMgd2l0aG91dCB0aGUgZW1wdHkgZnVuY3Rpb24gYmVjYXVzZSB0aGVyZSdzIG5vIHJlc29sdmUuIFRoZXJlIG11c3QgYmUgYSBiZXR0ZXIgd2F5IHRvIGRvIHRoaW5ncy5cbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIldBUk5JTkc6IEhvcnJpYmxlIGhhY2sgaW4gZWZmZWN0IHRvIGNoYW5nZSBzbGlkZXMuIFBsZWFzZSByZXBsYWNlIHRoZSBwYXNzLWFuLWVtcHR5LWZ1bmN0aW9uIHRoaW5nIHdpdGggc29tZXRoaW5nIHRoYXQgYWN0dWFsbHkgcmVzb2x2ZXMgcHJvcGVybHkgYW5kIGRvZXMgYXN5bmMuXCIpXG4gICAgICAgICAgICBzZWxmLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBhc3luYyB3YWl0Rm9yUGFnZUxvYWQoKXtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICBpZihkb2N1bWVudC5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScpe1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLHJlc29sdmUpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgYXN5bmMgbmV4dFNsaWRlKCl7XG4gICAgICAgIGlmKCF0aGlzLmluaXRpYWxpemVkKXRocm93IG5ldyBFcnJvcihcIkVSUk9SOiBVc2UgLmJlZ2luKCkgb24gYSBEaXJlY3RvciBiZWZvcmUgY2FsbGluZyBhbnkgb3RoZXIgbWV0aG9kcyFcIik7XG5cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHRoaXMucmlnaHRBcnJvdy5zaG93U2VsZigpO1xuICAgICAgICAvL3Byb21pc2UgaXMgcmVzb2x2ZWQgYnkgY2FsbGluZyB0aGlzLm5leHRTbGlkZVByb21pc2UucmVzb2x2ZSgpIHdoZW4gdGhlIHRpbWUgY29tZXNcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgIGZ1bmN0aW9uIGtleUxpc3RlbmVyKGUpe1xuICAgICAgICAgICAgICAgIGlmKGUucmVwZWF0KXJldHVybjsgLy9rZXlkb3duIGZpcmVzIG11bHRpcGxlIHRpbWVzIGJ1dCB3ZSBvbmx5IHdhbnQgdGhlIGZpcnN0IG9uZVxuICAgICAgICAgICAgICAgIGxldCBzbGlkZURlbHRhID0gMDtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGUua2V5Q29kZSkge1xuICAgICAgICAgICAgICAgICAgY2FzZSAzNDpcbiAgICAgICAgICAgICAgICAgIGNhc2UgMzk6XG4gICAgICAgICAgICAgICAgICBjYXNlIDQwOlxuICAgICAgICAgICAgICAgICAgICBzbGlkZURlbHRhID0gMTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYoc2xpZGVEZWx0YSAhPSAwKXtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5fY2hhbmdlU2xpZGUoc2xpZGVEZWx0YSwgcmVzb2x2ZSk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYucmlnaHRBcnJvdy5oaWRlU2VsZigpO1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIixrZXlMaXN0ZW5lcik7IC8vdGhpcyBhcHByb2FjaCB0YWtlbiBmcm9tIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM1NzE4NjQ1L3Jlc29sdmluZy1hLXByb21pc2Utd2l0aC1ldmVudGxpc3RlbmVyXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwga2V5TGlzdGVuZXIpO1xuICAgICAgICAgICAgLy9ob3JyaWJsZSBoYWNrIHNvIHRoYXQgdGhlICduZXh0IHNsaWRlJyBhcnJvdyBjYW4gdHJpZ2dlciB0aGlzIHRvb1xuICAgICAgICAgICAgc2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBmdW5jdGlvbigpeyBcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsa2V5TGlzdGVuZXIpOyBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIF9jaGFuZ2VTbGlkZShzbGlkZURlbHRhLCByZXNvbHZlKXtcbiAgICAgICAgLy9zbGlkZSBjaGFuZ2luZyBsb2dpY1xuICAgICAgICBpZihzbGlkZURlbHRhICE9IDApe1xuICAgICAgICAgICAgaWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA9PSAwICYmIHNsaWRlRGVsdGEgPT0gLTEpe1xuICAgICAgICAgICAgICAgIHJldHVybjsgLy9ubyBnb2luZyBwYXN0IHRoZSBiZWdpbm5pbmdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gdGhpcy5udW1IVE1MU2xpZGVzLTEgJiYgc2xpZGVEZWx0YSA9PSAxKXtcbiAgICAgICAgICAgICAgICByZXR1cm47IC8vbm8gZ29pbmcgcGFzdCB0aGUgZW5kXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleCh0aGlzLmN1cnJlbnRTbGlkZUluZGV4ICsgc2xpZGVEZWx0YSk7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KHNsaWRlTnVtYmVyKXtcbiAgICAgICAgLy91cGRhdGVzIEhUTUwgYW5kIGFsc28gc2V0cyB0aGlzLmN1cnJlbnRTbGlkZUluZGV4IHRvIHNsaWRlTnVtYmVyXG5cbiAgICAgICAgbGV0IHByZXZTbGlkZU51bWJlciA9IHRoaXMuY3VycmVudFNsaWRlSW5kZXg7XG4gICAgICAgIHRoaXMuY3VycmVudFNsaWRlSW5kZXggPSBzbGlkZU51bWJlcjtcblxuXG4gICAgICAgIC8vaGlkZSB0aGUgSFRNTCBlbGVtZW50cyBmb3IgdGhlIHByZXZpb3VzIHNsaWRlXG5cbiAgICAgICAgLy9pdGVtcyB3aXRoIGNsYXNzIGV4cC1zbGlkZVxuICAgICAgICBpZihwcmV2U2xpZGVOdW1iZXIgPCB0aGlzLnNsaWRlcy5sZW5ndGgpe1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbcHJldlNsaWRlTnVtYmVyXS5zdHlsZS5vcGFjaXR5ID0gMDtcbiAgICAgICAgICAgIHRoaXMuc2xpZGVzW3ByZXZTbGlkZU51bWJlcl0uc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy9pdGVtcyB3aXRoIEhUTUwgY2xhc3MgZXhwLXNsaWRlLW5cbiAgICAgICAgbGV0IHByZXZTbGlkZUVsZW1zID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZS1cIisocHJldlNsaWRlTnVtYmVyKzEpKVxuICAgICAgICBmb3IodmFyIGk9MDtpPHByZXZTbGlkZUVsZW1zLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgcHJldlNsaWRlRWxlbXNbaV0uc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgICAgICAgICBwcmV2U2xpZGVFbGVtc1tpXS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuICAgICAgICB9XG5cblxuICAgICAgICAvL3Nob3cgdGhlIEhUTUwgZWxlbWVudHMgZm9yIHRoZSBjdXJyZW50IHNsaWRlXG4gIFxuICAgICAgICBcbiAgICAgICAgLy9pdGVtcyB3aXRoIEhUTUwgY2xhc3MgZXhwLXNsaWRlLW5cbiAgICAgICAgbGV0IGVsZW1zVG9EaXNwbGF5T25seU9uVGhpc1NsaWRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZS1cIisoc2xpZGVOdW1iZXIrMSkpO1xuXG4gICAgICAgIGlmKHNsaWRlTnVtYmVyID49IHRoaXMubnVtSFRNTFNsaWRlcyAmJiBlbGVtc1RvRGlzcGxheU9ubHlPblRoaXNTbGlkZS5sZW5ndGggPT0gMCl7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiVHJpZWQgdG8gc2hvdyBzbGlkZSAjXCIrc2xpZGVOdW1iZXIrXCIsIGJ1dCBvbmx5IFwiICsgdGhpcy5udW1IVE1MU2xpZGVzICsgXCJIVE1MIGVsZW1lbnRzIHdpdGggZXhwLXNsaWRlIHdlcmUgZm91bmQhIE1ha2UgbW9yZSBzbGlkZXM/XCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKHZhciBpPTA7aTxlbGVtc1RvRGlzcGxheU9ubHlPblRoaXNTbGlkZS5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGVsZW1zVG9EaXNwbGF5T25seU9uVGhpc1NsaWRlW2ldLnN0eWxlLm9wYWNpdHkgPSAxO1xuICAgICAgICAgICAgZWxlbXNUb0Rpc3BsYXlPbmx5T25UaGlzU2xpZGVbaV0uc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnOyAvL25vdCBcImFsbFwiLCBiZWNhdXNlIHRoYXQgbWlnaHQgb3ZlcnJpZGUgQ1NTIHdoaWNoIHNldHMgcG9pbnRlci1ldmVudHMgdG8gbm9uZVxuICAgICAgICB9XG5cbiAgICAgICAgLy9pdGVtcyB3aXRoIGNsYXNzIGV4cC1zbGlkZVxuICAgICAgICBpZihzbGlkZU51bWJlciA8IHRoaXMuc2xpZGVzLmxlbmd0aCl7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1tzbGlkZU51bWJlcl0uc3R5bGUub3BhY2l0eSA9IDE7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1tzbGlkZU51bWJlcl0uc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnOyAvL25vdCBcImFsbFwiLCBiZWNhdXNlIHRoYXQgbWlnaHQgb3ZlcnJpZGUgQ1NTIHdoaWNoIHNldHMgcG9pbnRlci1ldmVudHMgdG8gbm9uZVxuICAgICAgICAgICAgdGhpcy5zY3JvbGxVcFRvVG9wT2ZDb250YWluZXIodGhpcy5zbGlkZXNbc2xpZGVOdW1iZXJdKTtcbiAgICAgICAgfVxuXG4gICAgfVxuICAgIHNjcm9sbFVwVG9Ub3BPZkNvbnRhaW5lcihlbGVtZW50KXtcbiAgICAgICAgZWxlbWVudC5zY3JvbGxJbnRvVmlldyh0cnVlKTtcbiAgICB9XG5cbiAgICAvL3ZlcmJzXG4gICAgYXN5bmMgX3NsZWVwKHdhaXRUaW1lKXtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCB3YWl0VGltZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBhc3luYyBkZWxheSh3YWl0VGltZSl7XG4gICAgICAgIHJldHVybiB0aGlzLl9zbGVlcCh3YWl0VGltZSk7XG4gICAgfVxuICAgIFRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TLCBvcHRpb25hbEFyZ3VtZW50cyl7XG4gICAgICAgIC8vaWYgc29tZW9uZSdzIHVzaW5nIHRoZSBvbGQgY2FsbGluZyBzdHJhdGVneSBvZiBzdGFnZ2VyRnJhY3Rpb24gYXMgdGhlIGxhc3QgYXJndW1lbnQsIGNvbnZlcnQgaXQgcHJvcGVybHlcbiAgICAgICAgaWYob3B0aW9uYWxBcmd1bWVudHMgJiYgVXRpbHMuaXNOdW1iZXIob3B0aW9uYWxBcmd1bWVudHMpKXtcbiAgICAgICAgICAgIG9wdGlvbmFsQXJndW1lbnRzID0ge3N0YWdnZXJGcmFjdGlvbjogb3B0aW9uYWxBcmd1bWVudHN9O1xuICAgICAgICB9XG4gICAgICAgIG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwLCBzdGFnZ2VyRnJhY3Rpb249c3RhZ2dlckZyYWN0aW9uLCBvcHRpb25hbEFyZ3VtZW50cyk7XG4gICAgfVxufVxuXG5cblxuXG5cbmNvbnN0IEZPUldBUkRTID0gKFwiZm9yd2FyZHNcIik7XG5jb25zdCBCQUNLV0FSRFMgPSAoXCJiYWNrd2FyZHNcIik7XG5jb25zdCBOT19TTElERV9NT1ZFTUVOVCA9IChcIm5vdCB0aW1lIHRyYXZlbGluZ1wiKTtcblxuY2xhc3MgVW5kb0NhcGFibGVEaXJlY3RvciBleHRlbmRzIE5vbkRlY3JlYXNpbmdEaXJlY3RvcntcbiAgICAvL3Roc2kgZGlyZWN0b3IgdXNlcyBib3RoIGZvcndhcmRzIGFuZCBiYWNrd2FyZHMgYXJyb3dzLiB0aGUgYmFja3dhcmRzIGFycm93IHdpbGwgdW5kbyBhbnkgVW5kb0NhcGFibGVEaXJlY3Rvci5UcmFuc2l0aW9uVG8oKXNcbiAgICAvL3RvZG86IGhvb2sgdXAgdGhlIGFycm93cyBhbmQgbWFrZSBpdCBub3RcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKXtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAgICAgdGhpcy5mdXJ0aGVzdFNsaWRlSW5kZXggPSAwOyAvL21hdGNoZXMgdGhlIG51bWJlciBvZiB0aW1lcyBuZXh0U2xpZGUoKSBoYXMgYmVlbiBjYWxsZWRcbiAgICAgICAgLy90aGlzLmN1cnJlbnRTbGlkZUluZGV4IGlzIGFsd2F5cyA8IHRoaXMuZnVydGhlc3RTbGlkZUluZGV4IC0gaWYgZXF1YWwsIHdlIHJlbGVhc2UgdGhlIHByb21pc2UgYW5kIGxldCBuZXh0U2xpZGUoKSByZXR1cm5cblxuICAgICAgICB0aGlzLnVuZG9TdGFjayA9IFtdO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ID0gLTE7IC8vaW5jcmVhc2VkIGJ5IG9uZSBldmVyeSB0aW1lIGVpdGhlciB0aGlzLlRyYW5zaXRpb25UbyBpcyBjYWxsZWQgb3IgdGhpcy5uZXh0U2xpZGUoKSBpcyBjYWxsZWRcblxuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID0gTk9fU0xJREVfTU9WRU1FTlQ7IC8vdGhpcyB2YXJpYWJsZSBpcyB1c2VkIHRvIGVuc3VyZSB0aGF0IGlmIHlvdSByZWRvLCB0aGVuIHVuZG8gaGFsZndheSB0aHJvdWdoIHRoZSByZWRvLCB0aGUgcmVkbyBlbmRzIHVwIGNhbmNlbGxlZC4gXG4gICAgICAgIHRoaXMubnVtQXJyb3dQcmVzc2VzID0gMDtcblxuICAgICAgICAvL2lmIHlvdSBwcmVzcyByaWdodCBiZWZvcmUgdGhlIGZpcnN0IGRpcmVjdG9yLm5leHRTbGlkZSgpLCBkb24ndCBlcnJvclxuICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IGZ1bmN0aW9uKCl7fSBcblxuICAgICAgICBmdW5jdGlvbiBrZXlMaXN0ZW5lcihlKXtcbiAgICAgICAgICAgIGlmKGUucmVwZWF0KXJldHVybjsgLy9rZXlkb3duIGZpcmVzIG11bHRpcGxlIHRpbWVzIGJ1dCB3ZSBvbmx5IHdhbnQgdGhlIGZpcnN0IG9uZVxuICAgICAgICAgICAgbGV0IHNsaWRlRGVsdGEgPSAwO1xuICAgICAgICAgICAgc3dpdGNoIChlLmtleUNvZGUpIHtcbiAgICAgICAgICAgICAgY2FzZSAzNDpcbiAgICAgICAgICAgICAgY2FzZSAzOTpcbiAgICAgICAgICAgICAgY2FzZSA0MDpcbiAgICAgICAgICAgICAgICBzZWxmLmhhbmRsZUZvcndhcmRzUHJlc3MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAzMzpcbiAgICAgICAgICAgICAgY2FzZSAzNzpcbiAgICAgICAgICAgICAgY2FzZSAzODpcbiAgICAgICAgICAgICAgICBzZWxmLmhhbmRsZUJhY2t3YXJkc1ByZXNzKCk7XG4gICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwga2V5TGlzdGVuZXIpO1xuICAgIH1cblxuICAgIHNldHVwQ2xpY2thYmxlcygpe1xuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5sZWZ0QXJyb3cgPSBuZXcgRGlyZWN0aW9uQXJyb3coZmFsc2UpO1xuICAgICAgICB0aGlzLmxlZnRBcnJvdy5oaWRlU2VsZigpO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMubGVmdEFycm93LmFycm93SW1hZ2UpO1xuICAgICAgICB0aGlzLmxlZnRBcnJvdy5vbmNsaWNrQ2FsbGJhY2sgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgc2VsZi5oYW5kbGVCYWNrd2FyZHNQcmVzcygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yaWdodEFycm93ID0gbmV3IERpcmVjdGlvbkFycm93KHRydWUpO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMucmlnaHRBcnJvdy5hcnJvd0ltYWdlKTtcbiAgICAgICAgdGhpcy5yaWdodEFycm93Lm9uY2xpY2tDYWxsYmFjayA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBzZWxmLmhhbmRsZUZvcndhcmRzUHJlc3MoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1vdmVGdXJ0aGVySW50b1ByZXNlbnRhdGlvbigpe1xuICAgICAgICAgICAgLy9pZiB0aGVyZSdzIG5vdGhpbmcgdG8gcmVkbywgKHNvIHdlJ3JlIG5vdCBpbiB0aGUgcGFzdCBvZiB0aGUgdW5kbyBzdGFjayksIGFkdmFuY2UgZnVydGhlci5cbiAgICAgICAgICAgIC8vaWYgdGhlcmUgYXJlIGxlc3MgSFRNTCBzbGlkZXMgdGhhbiBjYWxscyB0byBkaXJlY3Rvci5uZXdTbGlkZSgpLCBjb21wbGFpbiBpbiB0aGUgY29uc29sZSBidXQgYWxsb3cgdGhlIHByZXNlbnRhdGlvbiB0byBwcm9jZWVkXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIk1vdmluZyBmdXJ0aGVyIGludG8gcHJlc2VudGF0aW9uIVwiKTtcbiAgICAgICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPCB0aGlzLm51bVNsaWRlcyl7XG4gICAgICAgICAgICAgICAgdGhpcy5mdXJ0aGVzdFNsaWRlSW5kZXggKz0gMTsgXG5cbiAgICAgICAgICAgICAgICB0aGlzLnN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgodGhpcy5jdXJyZW50U2xpZGVJbmRleCArIDEpOyAvL3RoaXMgd2lsbCBjb21wbGFpbiBpbiB0aGUgY29uc29sZSB3aW5kb3cgaWYgdGhlcmUgYXJlIGxlc3Mgc2xpZGVzIHRoYW4gbmV3U2xpZGUoKSBjYWxsc1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Fycm93cygpOyAvL3Nob3dBcnJvd3MgbXVzdCBjb21lIGFmdGVyIHRoaXMuY3VycmVudFNsaWRlSW5kZXggYWR2YW5jZXMgb3IgZWxzZSB3ZSB3b24ndCBiZSBhYmxlIHRvIHRlbGwgaWYgd2UncmUgYXQgdGhlIGVuZCBvciBub3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uKCk7IC8vYWxsb3cgcHJlc2VudGF0aW9uIGNvZGUgdG8gcHJvY2VlZFxuICAgIH1cbiAgICBpc0NhdWdodFVwV2l0aE5vdGhpbmdUb1JlZG8oKXtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5kb1N0YWNrSW5kZXggPT0gdGhpcy51bmRvU3RhY2subGVuZ3RoLTE7XG4gICAgfVxuXG4gICAgYXN5bmMgaGFuZGxlRm9yd2FyZHNQcmVzcygpe1xuXG4gICAgICAgIC8vaWYgdGhlcmUncyBub3RoaW5nIHRvIHJlZG8sIHNob3cgdGhlIG5leHQgc2xpZGVcbiAgICAgICAgaWYodGhpcy5pc0NhdWdodFVwV2l0aE5vdGhpbmdUb1JlZG8oKSl7XG4gICAgICAgICAgICB0aGlzLm1vdmVGdXJ0aGVySW50b1ByZXNlbnRhdGlvbigpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgd2UgZ2V0IHRvIGhlcmUsIHdlJ3ZlIHByZXZpb3VzbHkgZG9uZSBhbiB1bmRvLCBhbmQgd2UncmUgaW4gdGhlIHBhc3QuIFdlIG5lZWQgdG8gY2F0Y2ggdXAgYW5kIHJlZG8gYWxsIHRob3NlIGl0ZW1zXG5cbiAgICAgICAgLy9vbmx5IHJlZG8gaWYgd2UncmUgbm90IGFscmVhZHkgcmVkb2luZ1xuICAgICAgICAvL3RvZG86IGFkZCBhbiBpbnB1dCBidWZmZXIgaW5zdGVhZCBvZiBkaXNjYXJkaW5nIHRoZW1cbiAgICAgICAgaWYodGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID09IEZPUldBUkRTKXJldHVybjtcbiAgICAgICAgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID0gRk9SV0FSRFM7XG5cbiAgICAgICAgdGhpcy5yaWdodEFycm93LmhpZGVTZWxmKCk7XG5cbiAgICAgICAgdGhpcy5udW1BcnJvd1ByZXNzZXMgKz0gMTtcbiAgICAgICAgbGV0IG51bUFycm93UHJlc3NlcyA9IHRoaXMubnVtQXJyb3dQcmVzc2VzO1xuXG4gICAgICAgIC8vYWR2YW5jZSBwYXN0IHRoZSBjdXJyZW50IE5ld1NsaWRlVW5kb0l0ZW0gd2UncmUgcHJlc3VtYWJseSBwYXVzZWQgb25cblxuICAgICAgICBpZih0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XS5jb25zdHJ1Y3RvciA9PT0gTmV3U2xpZGVVbmRvSXRlbSl7XG4gICAgICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ICs9IDE7XG4gICAgICAgIH1cblxuICAgICAgICAvL2NoYW5nZSBIVE1MIHNsaWRlIGZpcnN0IHNvIHRoYXQgaWYgdGhlcmUgYXJlIGFueSBkZWxheXMgdG8gdW5kbywgdGhleSBkb24ndCBzbG93IGRvd24gdGhlIHNsaWRlXG4gICAgICAgIHRoaXMuc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleCh0aGlzLmN1cnJlbnRTbGlkZUluZGV4ICsgMSk7XG4gICAgICAgIHRoaXMuc2hvd0Fycm93cygpO1xuICAgICAgICBjb25zb2xlLmxvZyhgU3RhcnRpbmcgYXJyb3cgcHJlc3MgZm9yd2FyZHMgIyR7bnVtQXJyb3dQcmVzc2VzfWApO1xuXG4gICAgICAgIHdoaWxlKHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdLmNvbnN0cnVjdG9yICE9PSBOZXdTbGlkZVVuZG9JdGVtKXtcbiAgICAgICAgICAgIC8vbG9vcCB0aHJvdWdoIHVuZG8gc3RhY2sgYW5kIHJlZG8gZWFjaCB1bmRvIHVudGlsIHdlIGdldCB0byB0aGUgbmV4dCBzbGlkZVxuXG5cbiAgICAgICAgICAgIGxldCByZWRvSXRlbSA9IHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlZG9Bbkl0ZW0ocmVkb0l0ZW0pO1xuXG4gICAgICAgICAgICAvL0lmIHRoZXJlJ3MgYSBkZWxheSBzb21ld2hlcmUgaW4gdGhlIHVuZG8gc3RhY2ssIGFuZCB3ZSBzbGVlcCBmb3Igc29tZSBhbW91bnQgb2YgdGltZSwgdGhlIHVzZXIgbWlnaHQgaGF2ZSBwcmVzc2VkIHVuZG8gZHVyaW5nIHRoYXQgdGltZS4gSW4gdGhhdCBjYXNlLCBoYW5kbGVCYWNrd2FyZHNQcmVzcygpIHdpbGwgc2V0IHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiB0byBCQUNLV0FSRFMuIEJ1dCB3ZSdyZSBzdGlsbCBydW5uaW5nLCBzbyB3ZSBzaG91bGQgc3RvcCByZWRvaW5nIVxuICAgICAgICAgICAgaWYodGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uICE9IEZPUldBUkRTIHx8IG51bUFycm93UHJlc3NlcyAhPSB0aGlzLm51bUFycm93UHJlc3Nlcyl7XG4gICAgICAgICAgICAgICAgLy90aGlzIGZ1bmN0aW9uIGhhcyBiZWVuIHByZWVtcHRlZCBieSBhbm90aGVyIGFycm93IHByZXNzXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYGZvcndhcmRzIGhhcyBiZWVuIHByZWVtcHRlZDogdGhpcyBpcyAke251bUFycm93UHJlc3Nlc30sIGJ1dCB0aGVyZSdzIGFub3RoZXIgd2l0aCAke3RoaXMubnVtQXJyb3dQcmVzc2VzfSwke3RoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPT0gdGhpcy51bmRvU3RhY2subGVuZ3RoLTEpe1xuICAgICAgICAgICAgICAgIC8vd2UndmUgbm93IGZ1bGx5IGNhdWdodCB1cC5cblxuICAgICAgICAgICAgICAgIC8vaWYgdGhlIGN1cnJlbnQgdW5kb0l0ZW0gaXNuJ3QgYSBOZXdTbGlkZVVuZG9JdGVtLCBidXQgd2UgZG8gaGF2ZSBhIG5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiAobWVhbmluZyB0aGUgbWFpbiB1c2VyIGNvZGUgaXMgd2FpdGluZyBvbiB0aGlzIHRvIGFjdGl2YXRlKSBhbGxvdyBwcmVzZW50YXRpb24gY29kZSB0byBwcm9jZWVkXG4gICAgICAgICAgICAgICAgaWYodGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24pe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCArPSAxO1xuXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID0gTk9fU0xJREVfTU9WRU1FTlQ7XG4gICAgICAgIHRoaXMuc2hvd0Fycm93cygpO1xuICAgIH1cblxuICAgIGFzeW5jIHJlZG9Bbkl0ZW0ocmVkb0l0ZW0pe1xuICAgICAgICBzd2l0Y2gocmVkb0l0ZW0udHlwZSl7XG4gICAgICAgICAgICBjYXNlIERFTEFZOlxuICAgICAgICAgICAgICAgIC8va2VlcCBpbiBtaW5kIGR1cmluZyB0aGlzIGRlbGF5IHBlcmlvZCwgdGhlIHVzZXIgbWlnaHQgcHVzaCB0aGUgbGVmdCBhcnJvdyBrZXkuIElmIHRoYXQgaGFwcGVucywgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uIHdpbGwgYmUgREVDUkVBU0lORywgc28gaGFuZGxlRm9yd2FyZHNQcmVzcygpIHdpbGwgcXVpdFxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuX3NsZWVwKHJlZG9JdGVtLndhaXRUaW1lKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgVFJBTlNJVElPTlRPOlxuICAgICAgICAgICAgICAgIHZhciByZWRvQW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbihyZWRvSXRlbS50YXJnZXQsIHJlZG9JdGVtLnRvVmFsdWVzLCByZWRvSXRlbS5kdXJhdGlvbiwgcmVkb0l0ZW0ub3B0aW9uYWxBcmd1bWVudHMpO1xuICAgICAgICAgICAgICAvL2FuZCBub3cgcmVkb0FuaW1hdGlvbiwgaGF2aW5nIGJlZW4gY3JlYXRlZCwgZ29lcyBvZmYgYW5kIGRvZXMgaXRzIG93biB0aGluZyBJIGd1ZXNzLiB0aGlzIHNlZW1zIGluZWZmaWNpZW50LiB0b2RvOiBmaXggdGhhdCBhbmQgbWFrZSB0aGVtIGFsbCBjZW50cmFsbHkgdXBkYXRlZCBieSB0aGUgYW5pbWF0aW9uIGxvb3Agb3Jzb21ldGhpbmdcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgTkVXU0xJREU6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgaGFuZGxlQmFja3dhcmRzUHJlc3MoKXtcblxuICAgICAgICBpZih0aGlzLnVuZG9TdGFja0luZGV4ID09IDAgfHwgdGhpcy5jdXJyZW50U2xpZGVJbmRleCA9PSAwKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vb25seSB1bmRvIGlmIHdlJ3JlIG5vdCBhbHJlYWR5IHVuZG9pbmdcbiAgICAgICAgaWYodGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID09IEJBQ0tXQVJEUylyZXR1cm47XG4gICAgICAgIHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiA9IEJBQ0tXQVJEUztcblxuICAgICAgICB0aGlzLmxlZnRBcnJvdy5oaWRlU2VsZigpO1xuXG4gICAgICAgIHRoaXMubnVtQXJyb3dQcmVzc2VzICs9IDE7XG4gICAgICAgIGxldCBudW1BcnJvd1ByZXNzZXMgPSB0aGlzLm51bUFycm93UHJlc3NlcztcblxuICAgICAgICAvL2FkdmFuY2UgYmVoaW5kIHRoZSBjdXJyZW50IE5ld1NsaWRlVW5kb0l0ZW0gd2UncmUgcHJlc3VtYWJseSBwYXVzZWQgb25cbiAgICAgICAgaWYodGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF0uY29uc3RydWN0b3IgPT09IE5ld1NsaWRlVW5kb0l0ZW0pe1xuICAgICAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCAtPSAxO1xuICAgICAgICB9XG5cblxuICAgICAgICAvL2NoYW5nZSBIVE1MIHNsaWRlIGZpcnN0IHNvIHRoYXQgaWYgdGhlcmUgYXJlIGFueSBkZWxheXMgdG8gdW5kbywgdGhleSBkb24ndCBzbG93IGRvd24gdGhlIHNsaWRlXG4gICAgICAgIHRoaXMuc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleCh0aGlzLmN1cnJlbnRTbGlkZUluZGV4IC0gMSk7XG4gICAgICAgIHRoaXMuc2hvd0Fycm93cygpO1xuXG4gICAgICAgIHdoaWxlKHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdLmNvbnN0cnVjdG9yICE9PSBOZXdTbGlkZVVuZG9JdGVtKXtcbiAgICAgICAgICAgIC8vbG9vcCB0aHJvdWdoIHVuZG8gc3RhY2sgYW5kIHVuZG8gZWFjaCBpdGVtIHVudGlsIHdlIHJlYWNoIHRoZSBwcmV2aW91cyBzbGlkZVxuXG4gICAgICAgICAgICBpZih0aGlzLnVuZG9TdGFja0luZGV4ID09IDApe1xuICAgICAgICAgICAgICAgIC8vYXQgZmlyc3Qgc2xpZGVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9JZiB0aGVyZSdzIGEgZGVsYXkgc29tZXdoZXJlIGluIHRoZSB1bmRvIHN0YWNrLCBhbmQgd2Ugc2xlZXAgZm9yIHNvbWUgYW1vdW50IG9mIHRpbWUsIHRoZSB1c2VyIG1pZ2h0IGhhdmUgcHJlc3NlZCByZWRvIGR1cmluZyB0aGF0IHRpbWUuIEluIHRoYXQgY2FzZSwgaGFuZGxlRm9yd2FyZHNQcmVzcygpIHdpbGwgc2V0IHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiB0byBGT1JXQVJEUy4gQnV0IHdlJ3JlIHN0aWxsIHJ1bm5pbmcsIHNvIHdlIHNob3VsZCBzdG9wIHJlZG9pbmchXG4gICAgICAgICAgICBpZih0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gIT0gQkFDS1dBUkRTIHx8IG51bUFycm93UHJlc3NlcyAhPSB0aGlzLm51bUFycm93UHJlc3Nlcyl7XG4gICAgICAgICAgICAgICAgLy90aGlzIGZ1bmN0aW9uIGhhcyBiZWVuIHByZWVtcHRlZCBieSBhbm90aGVyIGFycm93IHByZXNzXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYGJhY2t3YXJkcyBoYXMgYmVlbiBwcmVlbXB0ZWQ6ICR7bnVtQXJyb3dQcmVzc2VzfSwke3RoaXMubnVtQXJyb3dQcmVzc2VzfSwke3RoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vdW5kbyB0cmFuc2Zvcm1hdGlvbiBpbiB0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XVxuICAgICAgICAgICAgbGV0IHVuZG9JdGVtID0gdGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF07XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnVuZG9Bbkl0ZW0odW5kb0l0ZW0pO1xuICAgICAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCAtPSAxO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiA9IE5PX1NMSURFX01PVkVNRU5UO1xuICAgIH1cblxuICAgIGFzeW5jIHVuZG9Bbkl0ZW0odW5kb0l0ZW0pe1xuICAgICAgICBzd2l0Y2godW5kb0l0ZW0udHlwZSl7XG4gICAgICAgICAgICAgICAgY2FzZSBERUxBWTpcbiAgICAgICAgICAgICAgICAgICAgLy9rZWVwIGluIG1pbmQgZHVyaW5nIHRoaXMgZGVsYXkgcGVyaW9kLCB0aGUgdXNlciBtaWdodCBwdXNoIHRoZSByaWdodCBhcnJvdy4gSWYgdGhhdCBoYXBwZW5zLCB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gd2lsbCBiZSBJTkNSRUFTSU5HLCBzbyBoYW5kbGVCYWNrd2FyZHNQcmVzcygpIHdpbGwgcXVpdCBpbnN0ZWFkIG9mIGNvbnRpbnVpbmcuXG4gICAgICAgICAgICAgICAgICAgIGxldCB3YWl0VGltZSA9IHVuZG9JdGVtLndhaXRUaW1lO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLl9zbGVlcCh3YWl0VGltZS81KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUUkFOU0lUSU9OVE86XG4gICAgICAgICAgICAgICAgICAgIGxldCBkdXJhdGlvbiA9IHVuZG9JdGVtLmR1cmF0aW9uO1xuICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbiA9IGR1cmF0aW9uLzU7IC8vdW5kb2luZyBzaG91bGQgYmUgZmFzdGVyLlxuICAgICAgICAgICAgICAgICAgICAvL3RvZG86IGludmVydCB0aGUgZWFzaW5nIG9mIHRoZSB1bmRvSXRlbSB3aGVuIGNyZWF0aW5nIHRoZSB1bmRvIGFuaW1hdGlvbj9cbiAgICAgICAgICAgICAgICAgICAgbGV0IGVhc2luZyA9IEVhc2luZy5FYXNlSW5PdXQ7XG4gICAgICAgICAgICAgICAgICAgIHZhciB1bmRvQW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbih1bmRvSXRlbS50YXJnZXQsIHVuZG9JdGVtLmZyb21WYWx1ZXMsIGR1cmF0aW9uLCB1bmRvSXRlbS5vcHRpb25hbEFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIC8vYW5kIG5vdyB1bmRvQW5pbWF0aW9uLCBoYXZpbmcgYmVlbiBjcmVhdGVkLCBnb2VzIG9mZiBhbmQgZG9lcyBpdHMgb3duIHRoaW5nIEkgZ3Vlc3MuIHRoaXMgc2VlbXMgaW5lZmZpY2llbnQuIHRvZG86IGZpeCB0aGF0IGFuZCBtYWtlIHRoZW0gYWxsIGNlbnRyYWxseSB1cGRhdGVkIGJ5IHRoZSBhbmltYXRpb24gbG9vcCBvcnNvbWV0aGluZ1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIE5FV1NMSURFOlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICB9XG5cbiAgICBzaG93QXJyb3dzKCl7XG4gICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPiAwKXtcbiAgICAgICAgICAgIHRoaXMubGVmdEFycm93LnNob3dTZWxmKCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5sZWZ0QXJyb3cuaGlkZVNlbGYoKTtcbiAgICAgICAgfVxuICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4IDwgdGhpcy5udW1TbGlkZXMpe1xuICAgICAgICAgICAgdGhpcy5yaWdodEFycm93LnNob3dTZWxmKCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5yaWdodEFycm93LmhpZGVTZWxmKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBuZXh0U2xpZGUoKXtcbiAgICAgICAgLypUaGUgdXNlciB3aWxsIGNhbGwgdGhpcyBmdW5jdGlvbiB0byBtYXJrIHRoZSB0cmFuc2l0aW9uIGJldHdlZW4gb25lIHNsaWRlIGFuZCB0aGUgbmV4dC4gVGhpcyBkb2VzIHR3byB0aGluZ3M6XG4gICAgICAgIEEpIHdhaXRzIHVudGlsIHRoZSB1c2VyIHByZXNzZXMgdGhlIHJpZ2h0IGFycm93IGtleSwgcmV0dXJucywgYW5kIGNvbnRpbnVlcyBleGVjdXRpb24gdW50aWwgdGhlIG5leHQgbmV4dFNsaWRlKCkgY2FsbFxuICAgICAgICBCKSBpZiB0aGUgdXNlciBwcmVzc2VzIHRoZSBsZWZ0IGFycm93IGtleSwgdGhleSBjYW4gdW5kbyBhbmQgZ28gYmFjayBpbiB0aW1lLCBhbmQgZXZlcnkgVHJhbnNpdGlvblRvKCkgY2FsbCBiZWZvcmUgdGhhdCB3aWxsIGJlIHVuZG9uZSB1bnRpbCBpdCByZWFjaGVzIGEgcHJldmlvdXMgbmV4dFNsaWRlKCkgY2FsbC4gQW55IG5vcm1hbCBqYXZhc2NyaXB0IGFzc2lnbm1lbnRzIHdvbid0IGJlIGNhdWdodCBpbiB0aGlzIDooXG4gICAgICAgIEMpIGlmIHVuZG9cbiAgICAgICAgKi9cbiAgICAgICAgaWYoIXRoaXMuaW5pdGlhbGl6ZWQpdGhyb3cgbmV3IEVycm9yKFwiRVJST1I6IFVzZSAuYmVnaW4oKSBvbiBhIERpcmVjdG9yIGJlZm9yZSBjYWxsaW5nIGFueSBvdGhlciBtZXRob2RzIVwiKTtcblxuICAgICAgICBcbiAgICAgICAgdGhpcy5udW1TbGlkZXMrKztcbiAgICAgICAgdGhpcy51bmRvU3RhY2sucHVzaChuZXcgTmV3U2xpZGVVbmRvSXRlbSh0aGlzLmN1cnJlbnRTbGlkZUluZGV4KSk7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXgrKztcbiAgICAgICAgdGhpcy5zaG93QXJyb3dzKCk7XG5cblxuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgLy9wcm9taXNlIGlzIHJlc29sdmVkIGJ5IGNhbGxpbmcgdGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24oKSB3aGVuIHRoZSB0aW1lIGNvbWVzXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgICAgICAgc2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBmdW5jdGlvbigpeyBcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBcbiAgICBhc3luYyBfc2xlZXAod2FpdFRpbWUpe1xuICAgICAgICBhd2FpdCBzdXBlci5fc2xlZXAod2FpdFRpbWUpO1xuICAgIH1cblxuICAgIGFzeW5jIGRlbGF5KHdhaXRUaW1lKXtcbiAgICAgICAgdGhpcy51bmRvU3RhY2sucHVzaChuZXcgRGVsYXlVbmRvSXRlbSh3YWl0VGltZSkpO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4Kys7XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMudW5kb1N0YWNrSW5kZXgpO1xuICAgICAgICBhd2FpdCB0aGlzLl9zbGVlcCh3YWl0VGltZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMudW5kb1N0YWNrSW5kZXgpO1xuICAgICAgICBpZighdGhpcy5pc0NhdWdodFVwV2l0aE5vdGhpbmdUb1JlZG8oKSl7XG4gICAgICAgICAgICAvL1RoaXMgaXMgYSBwZXJpbG91cyBzaXR1YXRpb24uIFdoaWxlIHdlIHdlcmUgZGVsYXlpbmcsIHRoZSB1c2VyIHByZXNzZWQgdW5kbywgYW5kIG5vdyB3ZSdyZSBpbiB0aGUgcGFzdC5cbiAgICAgICAgICAgIC8vd2UgU0hPVUxETid0IHlpZWxkIGJhY2sgYWZ0ZXIgdGhpcywgYmVjYXVzZSB0aGUgcHJlc2VudGF0aW9uIGNvZGUgbWlnaHQgc3RhcnQgcnVubmluZyBtb3JlIHRyYW5zZm9ybWF0aW9ucyBhZnRlciB0aGlzIHdoaWNoIGNvbmZsaWN0IHdpdGggdGhlIHVuZG9pbmcgYW5pbWF0aW9ucy4gU28gd2UgbmVlZCB0byB3YWl0IHVudGlsIHdlIHJlYWNoIHRoZSByaWdodCBzbGlkZSBhZ2FpblxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJFZ2FkcyEgVGhpcyBpcyBhIHBlcmlsb3VzIHNpdHVhdGlvbiEgVG9kbzogd2FpdCB1bnRpbCB3ZSdyZSBmdWxseSBjYXVnaHQgdXAgdG8gcmVsZWFzZVwiKTtcbiAgICAgICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIC8vcHJvbWlzZSBpcyByZXNvbHZlZCBieSBjYWxsaW5nIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uKCkgd2hlbiB0aGUgdGltZSBjb21lc1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICAgICAgc2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBmdW5jdGlvbigpeyBcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJSZWxlYXNlIVwiKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIFRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TLCBvcHRpb25hbEFyZ3VtZW50cyl7XG4gICAgICAgIGxldCBkdXJhdGlvbiA9IGR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IDEgOiBkdXJhdGlvbk1TLzEwMDA7XG4gICAgICAgIHZhciBhbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uLCBvcHRpb25hbEFyZ3VtZW50cyk7XG4gICAgICAgIGxldCBmcm9tVmFsdWVzID0gYW5pbWF0aW9uLmZyb21WYWx1ZXM7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrLnB1c2gobmV3IFVuZG9JdGVtKHRhcmdldCwgdG9WYWx1ZXMsIGZyb21WYWx1ZXMsIGR1cmF0aW9uLCBvcHRpb25hbEFyZ3VtZW50cykpO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4Kys7XG4gICAgfVxufVxuXG5cbi8vZGlzY291bnQgZW51bVxuY29uc3QgVFJBTlNJVElPTlRPID0gMDtcbmNvbnN0IE5FV1NMSURFID0gMTtcbmNvbnN0IERFTEFZPTI7XG5cbi8vdGhpbmdzIHRoYXQgY2FuIGJlIHN0b3JlZCBpbiBhIFVuZG9DYXBhYmxlRGlyZWN0b3IncyAudW5kb1N0YWNrW11cbmNsYXNzIFVuZG9JdGVte1xuICAgIGNvbnN0cnVjdG9yKHRhcmdldCwgdG9WYWx1ZXMsIGZyb21WYWx1ZXMsIGR1cmF0aW9uLCBvcHRpb25hbEFyZ3VtZW50cyl7XG4gICAgICAgIHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xuICAgICAgICB0aGlzLnRvVmFsdWVzID0gdG9WYWx1ZXM7XG4gICAgICAgIHRoaXMuZnJvbVZhbHVlcyA9IGZyb21WYWx1ZXM7XG4gICAgICAgIHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICAgICAgdGhpcy50eXBlID0gVFJBTlNJVElPTlRPO1xuICAgICAgICB0aGlzLm9wdGlvbmFsQXJndW1lbnRzID0gb3B0aW9uYWxBcmd1bWVudHM7XG4gICAgfVxufVxuXG5jbGFzcyBOZXdTbGlkZVVuZG9JdGVte1xuICAgIGNvbnN0cnVjdG9yKHNsaWRlSW5kZXgpe1xuICAgICAgICB0aGlzLnNsaWRlSW5kZXggPSBzbGlkZUluZGV4O1xuICAgICAgICB0aGlzLnR5cGUgPSBORVdTTElERTtcbiAgICB9XG59XG5cbmNsYXNzIERlbGF5VW5kb0l0ZW17XG4gICAgY29uc3RydWN0b3Iod2FpdFRpbWUpe1xuICAgICAgICB0aGlzLndhaXRUaW1lID0gd2FpdFRpbWU7XG4gICAgICAgIHRoaXMudHlwZSA9IERFTEFZO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTm9uRGVjcmVhc2luZ0RpcmVjdG9yLCBEaXJlY3Rpb25BcnJvdywgVW5kb0NhcGFibGVEaXJlY3RvciB9O1xuIl0sIm5hbWVzIjpbIk5vZGUiLCJNYXRoIiwiVXRpbHMiLCJ0aHJlZUVudmlyb25tZW50IiwibWF0aC5sZXJwVmVjdG9ycyIsInJlcXVpcmUiLCJyZXF1aXJlJCQwIiwicmVxdWlyZSQkMSIsInJlcXVpcmUkJDIiLCJnbG9iYWwiLCJ2U2hhZGVyIiwiZlNoYWRlciIsInVuaWZvcm1zIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Q0FBQTtDQUNBO0NBQ0E7Q0FDQTtBQUNBO0NBQ0E7Q0FDQTtBQUNBO0NBQ0EsTUFBTUEsTUFBSTtDQUNWLENBQUMsV0FBVyxFQUFFO0NBQ2QsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztDQUNyQixFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0NBQ3JCLEtBQUs7Q0FDTCxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7Q0FDWDtDQUNBLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDNUIsRUFBRSxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztDQUN0QixFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7Q0FD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Q0FBQyxDQUFDO0NBQ1o7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtBQUNBO0NBQ0E7Q0FDQSxFQUFFLEdBQUcsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7Q0FDN0IsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM1QyxJQUFJLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN0RyxJQUFJLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztDQUNsQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLElBQUk7Q0FDSixHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsQ0FBQztDQUNuQztDQUNBLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDNUMsSUFBSSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEcsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM3QyxLQUFLLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN2RyxLQUFLLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM5QyxLQUFLLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzlDLEtBQUs7Q0FDTCxJQUFJO0NBQ0osR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7Q0FDbkM7Q0FDQSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzVDLElBQUksSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3RHLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDN0MsS0FBSyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdkcsS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM5QyxNQUFNLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN4RyxNQUFNLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEdB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SUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQztDQUM3RyxHQUNBO0NBQ0E7Q0FDQSxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFVLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO0NBQ3RFLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNsRSxHQUFHLE1BQU0sSUFBSSxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDbkMsR0FBRztBQUNIO0NBQ0E7Q0FDQSxFQUFFLFFBQVEsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDO0NBQzNCLEdBQUcsS0FBSyxDQUFDO0NBQ1QsSUFBSSxNQUFNLElBQUksR0FBRyxDQUFDO0NBQ2xCLElBQUksTUFBTTtDQUNWLEdBQUcsS0FBSyxDQUFDO0NBQ1QsSUFBSSxNQUFNLElBQUksSUFBSSxDQUFDO0NBQ25CLElBQUksTUFBTTtDQUdWLEdBQUc7QUFDSDtDQUNBLEVBQUUsT0FBTyxNQUFNLENBQUM7Q0FDaEIsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLEdBQUU7Q0FDbEIsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7Q0FDNUIsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7Q0FDeEIsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7Q0FDOUIsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7Q0FDNUMsQ0FBQyxNQUFNLENB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LElBQUksQ0FBQztDQUNiLENBQUM7QUFDRDtDQUM0RTtDQUM1RSxFQUFFLGNBQWMsR0FBRyxRQUFRLENBQUM7Q0FDNUI7Ozs7Q0N2SUE7Q0FDQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQTJELENBQUMsY0FBYyxDQUFDLENBQUMsR0FBRSxDQUFnTyxDQUFDLEVBQUUsVUFBVSxDQUEyQixPQUFPLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU9HLGVBQU8sRUFBRSxVQUFVLEVBQUVBLGVBQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBT0EsZUFBTyxFQUFFLFVBQVUsRUFBRUEsZUFBTyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxZQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxVQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxHQUFHLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLFlBQVksS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLHdDQUF3QyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWEsQ0FBQyxLQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxvQkFBbUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLCtDQUErQyxDQUFDLHFDQUFxQyxDQUFDLGtEQUFrRCxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxPQUFPLE9BQU8sQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsUUFBUSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUMsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUMsQ0FBQyxLQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxnQkFBZ0IsQ0FBQyxTQUFTLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBQyxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsT0FBTyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFVBQVUsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFFBQVEsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFFBQVEsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksVUFBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsR0FBRyxZQUFZLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBSyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEdBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBRyxJQUFJLEVBQUMsQ0FBQyxLQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFLLDRCQUE0QixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBb0IsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFLLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU0sR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLEtBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxLQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVUsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksV0FBVyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsU0FBUyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUssQ0FBQyxLQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxHQUFHLFNBQVMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsRUFBRSxTQUFTLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLFNBQVMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxNQUFNLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQUssQ0FBQyxLQUFJLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLE1BQU0sUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLEVBQUUsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBeUIsSUFBSSxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBYyxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxJQUFJLGNBQWMsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxRQUFRLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksUUFBUSxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBUyxDQUFDLFNBQVMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQVksQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxXQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsU0FBUyxDQUFDLE9BQU8sV0FBVyxDQUFDLFNBQVMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsR0FBRyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVMsQ0FBQyxTQUFTLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsS0FBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxXQUFXLENBQUMsR0FBRyxFQUFFLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsUUFBUSxHQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsU0FBUyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsNkZBQTZGLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssWUFBWSxDQUFnQixPQUFPLENBQVcsTUFBTSxDQUFDLFNBQVMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBQyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsTUFBTSxZQUFZLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQVksT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQVcsT0FBTyxDQUFDLHFCQUFxQixDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBSyxTQUFTLFVBQVUsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLEdBQUcsR0FBRyxHQUFHLE9BQU8sRUFBRSxHQUFHLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxhQUFhLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUMsQ0FBQyxHQUFHLE9BQU8sU0FBUyxHQUFHLFdBQVcsRUFBRSxTQUFTLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sd0JBQXdCLEdBQUcsV0FBVyxFQUFFLHdCQUF3QixHQUFHLElBQUksRUFBRSxLQUFLLFlBQVksd0JBQXdCLEVBQUUsT0FBTyxxQkFBcUIsR0FBRyxXQUFXLEVBQUUscUJBQXFCLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSxxQkFBcUIsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUMsQ0FBQyxLQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFLLENBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFDLENBQUMsS0FBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBSyxDQUFDLENBQUMsS0FBSSxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsS0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaURBQWlELENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLEtBQUksQ0FBQyxJQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxLQUFPLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxLQUFLLENBQUMsS0FBTyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxLQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxPQUFNLENBQUMsS0FBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsU0FBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUMsQ0FBQyxLQUFJLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsWUFBWSxFQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsR0FBRSxDQUFDLEtBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLE1BQUssQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEdBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxL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Q0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ3RELEtBQUs7Q0FDTCxJQUFJLHFCQUFxQixDQUFDLEtBQUssQ0FBQztDQUNoQyxRQUFRLE1BQU0sR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUMzQyxRQUFRLE1BQU0sV0FBVyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7Q0FDN0QsUUFBUSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ3ZDO0NBQ0EsWUFBWSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDL0QsU0FBUztDQUNUO0NBQ0EsS0FBSztDQUNMLElBQUksa0JBQWtCLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQztDQUMxQztDQUNBLFFBQVEsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzNFLEtBQUs7Q0FDTCxJQUFJLHFCQUFxQixDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQztDQUM3RTtDQUNBLFFBQVEsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztDQUMvRCxRQUFRLElBQUksS0FBSyxHQUFHLFdBQVcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3hDO0NBQ0EsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7QUFDNUM7Q0FDQSxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztBQUM1QztDQUNBLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0FBQzVDO0NBQ0EsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzdDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUM7QUFDN0M7Q0FDQSxRQUFRLElBQUksY0FBYyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztDQUM3RCxRQUFRLGNBQWMsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0NBQzFDLEtBQUs7Q0FDTCxJQUFJLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQztDQUNwQjtDQUNBLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7Q0FDNUIsUUFBUSxHQUFHQSxPQUFLLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQ25DLFlBQVksSUFBSSxDQUFDLHVCQUF1QixHQUFHLElBQUksQ0FBQztDQUNoRCxTQUFTLEtBQUk7Q0FDYixZQUFZLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxLQUFLLENBQUM7Q0FDakQsWUFBWSxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDOUMsU0FBUztDQUNULEtBQUs7Q0FDTCxJQUFJLElBQUksS0FBSyxFQUFFO0NBQ2YsUUFBUSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7Q0FDM0IsS0FBSztDQUNMLElBQUksSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDO0NBQ3hCO0NBQ0EsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7Q0FDeEMsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsR0FBRyxPQUFPLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxZQUFZLElBQUksT0FBTyxDQUFDO0NBQ2hGLFFBQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEdBQUcsT0FBTyxHQUFHLENBQUMsQ0FBQztDQUM1QyxRQUFRLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO0NBQ2hDLFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQztDQUMvQyxLQUFLO0NBQ0wsSUFBSSxJQUFJLE9BQU8sRUFBRTtDQUNqQixRQUFRLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztDQUM3QixLQUFLO0NBQ0wsSUFBSSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUM7Q0FDcEIsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztDQUM1QixRQUFRLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7Q0FDL0MsS0FBSztDQUNMLElBQUksSUFBSSxLQUFLLEVBQUU7Q0FDZixRQUFRLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztDQUMzQixLQUFLO0NBQ0wsSUFBSSxLQUFLLEVBQUU7Q0FDWCxRQUFRLE9BQU8sSUFBSSxVQUFVLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Q0FDOUgsS0FBSztDQUNMOztDQ3RYQSxNQUFNLFdBQVcsU0FBUyxVQUFVO0NBQ3BDLENBQUMsV0FBVyxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7Q0FDMUIsRUFBRSxLQUFLLEVBQUUsQ0FBQztDQUNWO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7QUFDQTtDQUNBLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVMsR0FBRyxPQUFPLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztDQUNoRSxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7Q0FDekcsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxPQUFPLEtBQUssU0FBUyxHQUFHLE9BQU8sQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQ3RFO0NBQ0EsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztBQUNuQjtDQUNBLFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztDQUMxRSxRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztBQUNyQztDQUNBLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixHQUFHLENBQUMsQ0FBQztDQUNqQyxFQUFFLElBQUksQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDO0NBQzlCLEVBQUU7Q0FDRixDQUFDLE1BQU0sRUFBRTtDQUNUO0NBQ0EsRUFBRSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztBQUNyQztDQUNBLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztBQUMxRDtDQUNBLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUM7Q0FDckQsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDakUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdkUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUNyRCxJQUFJO0NBQ0osR0FBRztDQUNILEVBQUU7Q0FDRixDQUFDLGtCQUFrQixFQUFFO0NBQ3JCLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0NBQ25FLEVBQUU7Q0FDRixDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0NBQzVCLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7Q0FDMUIsR0FBRyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQztDQUM5QixHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0NBQzdCLEdBQUc7Q0FDSDtDQUNBLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMvQixFQUFFLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQ3BDLEVBQUUsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssU0FBUyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDcEMsRUFBRSxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxTQUFTLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUNwQyxFQUFFO0NBQ0YsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0NBQ1osRUFBRSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDeEIsRUFBRTtDQUNGLElBQUksbUJBQW1CLEVBQUU7Q0FDekIsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDdkMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixFQUFFLENBQUM7Q0FDeEMsR0FBRztDQUNILEtBQUs7Q0FDTCxDQUFDLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQztDQUNyQjtDQUNBO0NBQ0EsRUFBRSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO0NBQzFCLEVBQUUsR0FBRyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7Q0FDeEIsRUFBRSxHQUFHLENBQUMsV0FBVyxHQUFHLE9BQU8sR0FBRyxDQUFDLENBQUM7Q0FDaEMsUUFBUSxHQUFHLENBQUMsT0FBTyxHQUFHLE9BQU8sR0FBRyxDQUFDLENBQUM7Q0FDbEMsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztDQUMxQixFQUFFO0NBQ0YsQ0FBQyxJQUFJLE9BQU8sRUFBRTtDQUNkLEVBQUUsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO0NBQ3ZCLEVBQUU7Q0FDRixDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQztDQUNqQixRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztDQUNwQyxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO0NBQ3RCLEVBQUU7Q0FDRixDQUFDLElBQUksS0FBSyxFQUFFO0NBQ1osRUFBRSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7Q0FDckIsRUFBRTtDQUNGLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDO0NBQ2pCLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ3ZDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUNoRCxHQUFHO0NBQ0gsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztDQUN0QixFQUFFO0NBQ0YsQ0FBQyxJQUFJLEtBQUssRUFBRTtDQUNaLEVBQUUsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0NBQ3JCLEVBQUU7Q0FDRixDQUFDLEtBQUssRUFBRTtDQUNSLEVBQUUsT0FBTyxJQUFJLFdBQVcsQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztDQUN4RixFQUFFO0NBQ0YsQ0FBQztBQUNEO0FBQ0E7Q0FDQSxNQUFNLFNBQVM7Q0FDZixDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUM7Q0FDckI7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtBQUNBO0NBQ0EsRUFBYyxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVMsR0FBRyxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQUs7Q0FDN0QsUUFBUSxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUM7QUFDekM7Q0FDQSxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDdEU7Q0FDQSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQy9DLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDMUMsRUFBRUMsd0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDeEM7Q0FDQSxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDMUIsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzFCLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUMxQixFQUFFO0NBQ0YsQ0FBQyxtQkFBbUIsRUFBRTtDQUN0QixFQUFFQSx3QkFBZ0IsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUMzQyxFQUFFO0NBQ0YsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDVCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDM0IsRUFBRTtDQUNGLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ1QsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQzNCLEVBQUU7Q0FDRixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNULEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUMzQixFQUFFO0NBQ0YsQ0FBQyxJQUFJLENBQUMsRUFBRTtDQUNSLEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Q0FDOUIsRUFBRTtDQUNGLENBQUMsSUFBSSxDQUFDLEVBQUU7Q0FDUixFQUFFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0NBQzlCLEVBQUU7Q0FDRixDQUFDLElBQUksQ0FBQyxFQUFFO0NBQ1IsRUFBRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztDQUM5QixFQUFFO0NBQ0YsQ0FBQztDQUNELFNBQVMsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDOztDQ3BJeEUsTUFBTSxZQUFZLFNBQVMsVUFBVTtDQUM1QyxJQUFJLFdBQVcsQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO0NBQzdCO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLFFBQVEsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3ZCO0NBQ0EsS0FBSztDQUNMLElBQUksSUFBSSxFQUFFO0NBQ1YsUUFBUSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzlIO0NBQ0EsUUFBUSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7Q0FDckIsUUFBUSxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztBQUM3QjtDQUNBO0FBQ0E7Q0FDQSxRQUFRLE1BQU0sZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO0NBQ3BDLFFBQVEsTUFBTSxhQUFhLEdBQUcsR0FBRyxDQUFDO0NBQ2xDLFFBQVEsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDO0NBQ2hDLFFBQVEsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7QUFDL0I7Q0FDQSxRQUFRLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsc0JBQXNCLEVBQUUsQ0FBQyxFQUFFLGFBQWEsRUFBRSxhQUFhLENBQUMsR0FBRyxFQUFFLGdCQUFnQixFQUFFLENBQUMsRUFBRSxDQUFDO0NBQ3pILFFBQVEsSUFBSSx3QkFBd0IsR0FBRyxHQUFHLENBQUM7Q0FDM0MsUUFBUSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxDQUFDLEVBQUUsRUFBRSxhQUFhLEdBQUcsd0JBQXdCLEVBQUUsQ0FBQyxFQUFFLENBQUM7Q0FDeEYsUUFBUSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDekQsS0FBSztDQUNMLElBQUksa0JBQWtCLEVBQUU7Q0FDeEIsUUFBUSxLQUFLLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztBQUNuQztDQUNBLFFBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7Q0FDMUMsWUFBWSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxJQUFJLEVBQUUsT0FBTyxDQUFDO0NBQ3pILGdCQUFnQixPQUFPLE9BQU8sR0FBRyxJQUFJLENBQUM7Q0FDdEMsYUFBYSxDQUFDLENBQUM7Q0FDZixTQUFTLEtBQUk7Q0FDYjtDQUNBLFlBQVksSUFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUM7Q0FDbkMsU0FBUztBQUNUO0NBQ0E7Q0FDQSxRQUFRLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUNqRCxZQUFZLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDM0MsWUFBWUEsd0JBQWdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUNqRCxTQUFTO0FBQ1Q7Q0FDQSxRQUFRLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0NBQ3hELFFBQVEsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDN0MsWUFBWSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztDQUN2RixZQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM5QyxTQUFTO0NBQ1QsS0FBSztDQUNMLElBQUksWUFBWSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7Q0FDL0I7Q0FDQSxRQUFRLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RDO0NBQ0EsUUFBUSxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEYsUUFBUSxJQUFJLGVBQWUsR0FBRyxDQUFDLEdBQUcsbUJBQW1CLENBQUM7Q0FJdEQsUUFBUSxJQUFJLGFBQWEsR0FBRyxlQUFlLElBQUksbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0FBQ3JFO0NBQ0EsUUFBUSxHQUFHLGFBQWEsQ0FBQztDQUN6QjtDQUNBO0NBQ0E7Q0FDQSxZQUFZLElBQUksS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO0FBQzdFO0NBQ0EsWUFBWSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDN0YsWUFBWSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQy9GLFlBQVksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMvRjtDQUNBLFlBQVksSUFBSSxFQUFFLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDbkQsWUFBWSxJQUFJLEVBQUUsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDckQsWUFBWSxJQUFJLEVBQUUsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckQ7Q0FDQSxZQUFZLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLG1CQUFtQixDQUFDLENBQUM7Q0FDakUsWUFBWUQsT0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQzNEO0NBQ0EsWUFBWSxJQUFJLGVBQWUsR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNqRTtDQUNBO0NBQ0E7Q0FDQSxZQUFZLElBQUksTUFBTSxHQUFHLGVBQWUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1RTtDQUNBLFlBQVksTUFBTSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7Q0FDeEMsWUFBWSxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25GO0NBQ0E7Q0FDQTtDQUNBLFlBQVksSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztDQUM3RztDQUNBO0NBQ0EsWUFBWSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQ0FBQztDQUMzRCxZQUFZLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQzVDLFlBQVksR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssU0FBUyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDNUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxTQUFTLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM1QztDQUNBLFlBQVksR0FBRyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0NBQzFCLGdCQUFnQixJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsZUFBZSxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUM7Q0FDL0gsYUFBYTtDQUNiLFNBQVM7Q0FDVCxLQUFLO0FBQ0w7Q0FDQSxJQUFJLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQztDQUNwQjtDQUNBO0NBQ0EsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztDQUM1QixRQUFRLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUMxQyxRQUFRLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Q0FDaEUsS0FBSztBQUNMO0NBQ0EsSUFBSSxJQUFJLEtBQUssRUFBRTtDQUNmLFFBQVEsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0NBQzNCLEtBQUs7QUFDTDtDQUNBLElBQUksSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDO0NBQ3hCLFFBQVEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0NBQzdDLFFBQVEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLEdBQUcsT0FBTyxHQUFHLENBQUMsQ0FBQztDQUNyRCxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxHQUFHLE9BQU8sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLFlBQVksSUFBSSxPQUFPLENBQUM7Q0FDaEYsUUFBUSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sR0FBRyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQ2pEO0NBQ0E7Q0FDQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztDQUN4QyxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxHQUFHLE9BQU8sR0FBRyxDQUFDLENBQUM7Q0FDNUMsUUFBUSxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztDQUNoQyxRQUFRLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUM7Q0FDL0MsS0FBSztBQUNMO0NBQ0EsSUFBSSxJQUFJLE9BQU8sRUFBRTtDQUNqQixRQUFRLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztDQUM3QixLQUFLO0NBQ0wsSUFBSSxtQkFBbUIsRUFBRTtDQUN6QixRQUFRQyx3QkFBZ0IsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUNqRCxRQUFRLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzdDLFlBQVlBLHdCQUFnQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzlELFNBQVM7Q0FDVCxLQUFLO0NBQ0wsSUFBSSxLQUFLLEVBQUU7Q0FDWCxRQUFRLE9BQU8sSUFBSSxZQUFZLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Q0FDL0gsS0FBSztDQUNMOztDQ25KQTtBQUNBO0NBQ0E7Q0FDQSxJQUFJLE9BQU8sR0FBRztDQUNkLHVCQUF1QjtDQUN2Qix5QkFBeUI7Q0FDekIsbUJBQW1CO0NBQ25CLHFCQUFxQjtDQUNyQixxQkFBcUI7Q0FDckIsc0JBQXNCO0NBQ3RCLDRCQUE0QjtBQUM1QjtDQUNBLGVBQWU7Q0FDZixDQUFDLDJCQUEyQjtDQUM1QixDQUFDLHVCQUF1QjtDQUN4QixDQUFDLGNBQWM7Q0FDZixDQUFDLGtDQUFrQztDQUNuQyxZQUFZLG1CQUFtQjtDQUMvQixZQUFZLHFCQUFxQjtDQUNqQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDO0FBQ2Y7Q0FDQSxJQUFJLE9BQU8sR0FBRztDQUNkLGlEQUFpRDtDQUNqRCx1QkFBdUI7Q0FDdkIseUJBQXlCO0NBQ3pCLG1CQUFtQjtDQUNuQixxQkFBcUI7Q0FDckIscUJBQXFCO0NBQ3JCLG1DQUFtQztDQUNuQyx5QkFBeUI7Q0FDekIsc0JBQXNCO0NBQ3RCLDRCQUE0QjtDQUM1QiwwQkFBMEI7Q0FDMUIseUJBQXlCO0NBQ3pCLDBCQUEwQjtDQUMxQix3QkFBd0I7QUFDeEI7Q0FDQTtDQUNBLGdDQUFnQztDQUNoQyx5QkFBeUI7Q0FDekIsdUJBQXVCO0NBQ3ZCLEdBQUc7QUFDSDtDQUNBLGtDQUFrQztDQUNsQyx5QkFBeUI7Q0FDekIsdUNBQXVDO0FBQ3ZDO0NBQ0EscUNBQXFDO0NBQ3JDLG1DQUFtQztDQUNuQyx5Q0FBeUM7QUFDekM7Q0FDQSxnREFBZ0Q7Q0FDaEQsOENBQThDO0NBQzlDLGdFQUFnRTtBQUNoRTtDQUNBLHlFQUF5RTtBQUN6RTtDQUNBLGdEQUFnRDtDQUNoRCxvRkFBb0Y7Q0FDcEYsR0FBRztBQUNIO0NBQ0E7Q0FDQSxtQ0FBbUM7Q0FDbkMsb0ZBQW9GO0NBQ3BGLG1EQUFtRDtDQUNuRCwwQ0FBMEM7Q0FDMUMsR0FBRztBQUNIO0NBQ0E7Q0FDQSx1QkFBdUI7Q0FDdkIsc0RBQXNEO0NBQ3RELHVFQUF1RTtDQUN2RSx1RUFBdUU7QUFDdkU7Q0FDQSxvQ0FBb0M7Q0FDcEMsd0JBQXdCO0NBQ3hCLDhFQUE4RTtDQUM5RSxHQUFHO0NBQ0g7Q0FDQTtDQUNBLHNEQUFzRDtDQUN0RCx3Q0FBd0M7Q0FDeEMsa0JBQWtCO0NBQ2xCLDJFQUEyRTtDQUMzRSxrREFBa0Q7Q0FDbEQsMkZBQTJGO0NBQzNGLEdBQUc7QUFDSDtDQUNBLCtFQUErRTtDQUMvRSx1RUFBdUU7Q0FDdkUsb0VBQW9FO0NBQ3BFLDZHQUE2RztDQUM3RyxpSUFBaUk7Q0FDakksMkZBQTJGO0NBQzNGLEdBQUc7Q0FDSDtDQUNBO0NBQ0E7Q0FDQTtBQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtBQUNBO0NBQ0EsY0FBYztDQUNkO0NBQ0E7Q0FDQTtDQUNBLCtEQUErRDtDQUMvRCw2REFBNkQ7Q0FDN0QsMkdBQTJHO0NBQzNHLDBGQUEwRjtDQUMxRixvQ0FBb0M7Q0FDcEMsc0NBQXNDO0NBQ3RDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7QUFDZjtDQUNBLElBQUksUUFBUSxHQUFHO0NBQ2YsQ0FBQyxJQUFJLEVBQUU7Q0FDUCxFQUFFLElBQUksRUFBRSxHQUFHO0NBQ1gsRUFBRSxLQUFLLEVBQUUsQ0FBQztDQUNWLEVBQUU7Q0FDRixDQUFDLEtBQUssRUFBRTtDQUNSLEVBQUUsSUFBSSxFQUFFLEdBQUc7Q0FDWCxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO0NBQ2xDLEVBQUU7Q0FDRixDQUFDLGtCQUFrQixFQUFFO0NBQ3JCLEVBQUUsSUFBSSxFQUFFLEdBQUc7Q0FDWCxFQUFFLEtBQUssRUFBRSxDQUFDO0NBQ1YsRUFBRTtDQUNGLENBQUMsU0FBUyxFQUFFO0NBQ1osRUFBRSxJQUFJLEVBQUUsR0FBRztDQUNYLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUM7Q0FDbEMsRUFBRTtDQUNGLENBQUMsT0FBTyxFQUFFO0NBQ1YsRUFBRSxJQUFJLEVBQUUsR0FBRztDQUNYLEVBQUUsS0FBSyxFQUFFLEdBQUc7Q0FDWixFQUFFO0NBQ0YsQ0FBQyxNQUFNLEVBQUU7Q0FDVCxFQUFFLElBQUksRUFBRSxNQUFNO0NBQ2QsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNoQixFQUFFO0NBQ0YsQ0FBQyxXQUFXLEVBQUU7Q0FDZCxFQUFFLElBQUksRUFBRSxHQUFHO0NBQ1gsRUFBRSxLQUFLLEVBQUUsQ0FBQztDQUNWLEVBQUU7Q0FDRixDQUFDLFNBQVMsRUFBRTtDQUNaLEVBQUUsSUFBSSxFQUFFLEdBQUc7Q0FDWCxFQUFFLEtBQUssRUFBRSxHQUFHO0NBQ1osRUFBRTtDQUNGLENBQUMsUUFBUSxFQUFFO0NBQ1gsRUFBRSxJQUFJLEVBQUUsR0FBRztDQUNYLEVBQUUsS0FBSyxFQUFFLEdBQUc7Q0FDWixFQUFFO0NBQ0YsQ0FBQyxTQUFTLEVBQUU7Q0FDWixFQUFFLElBQUksRUFBRSxHQUFHO0NBQ1gsRUFBRSxLQUFLLEVBQUUsR0FBRztDQUNaLEVBQUU7Q0FDRixDQUFDOztDQ2hLRCxNQUFNLGFBQWEsU0FBUyxVQUFVO0NBQ3RDLENBQUMsV0FBVyxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7Q0FDMUIsRUFBRSxLQUFLLEVBQUUsQ0FBQztDQUNWO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsT0FBTyxLQUFLLFNBQVMsR0FBRyxPQUFPLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztBQUN0RTtDQUNBLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVMsR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUN6RztDQUNBLEVBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDO0NBQ3RDLFFBQVEsSUFBSSxDQUFDLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxTQUFTLEtBQUssU0FBUyxDQUFDO0FBQ25FO0NBQ0EsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxXQUFXLEtBQUssU0FBUyxHQUFHLE9BQU8sQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO0NBQ25GLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsUUFBUSxLQUFLLFNBQVMsR0FBRyxPQUFPLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztDQUM1RSxFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFNBQVMsS0FBSyxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7Q0FDL0UsRUFBRSxJQUFJLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQyxhQUFhLEtBQUssU0FBUyxHQUFHLE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO0FBQzNGO0NBQ0EsRUFBRSxJQUFJLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFDO0NBQ2pDLEVBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxFQUFFLENBQUM7Q0FDM0IsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0FBQzdCO0NBQ0EsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Q0FDZCxFQUFFO0NBQ0YsQ0FBQyxJQUFJLEVBQUU7Q0FDUCxFQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7Q0FDOUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO0NBQ2pCLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0FBQ3RCO0NBQ0E7Q0FDQSxFQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDO0NBQ3RCLEVBQUUsSUFBSSxJQUFJLFdBQVcsSUFBSSxRQUFRLENBQUM7Q0FDbEMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxHQUFHO0NBQ2pDLElBQUksSUFBSSxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJO0NBQ3BDLElBQUksS0FBSyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLO0NBQ3RDLEtBQUk7Q0FDSixHQUFHO0FBQ0g7Q0FDQSxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDO0NBQzNDLEdBQUcsSUFBSSxFQUFFLEtBQUssQ0FBQyxRQUFRO0NBQ3ZCLEdBQUcsWUFBWSxFQUFFLE9BQU87Q0FDeEIsR0FBRyxjQUFjLEVBQUUsT0FBTztDQUMxQixHQUFHLFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUztDQUMzQixJQUFJLENBQUMsQ0FBQztDQUNOLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDM0Q7Q0FDQSxFQUFFLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztDQUMvQixFQUFFLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztDQUMzQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO0NBQy9DLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7Q0FDdkQsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Q0FDN0QsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7Q0FDL0QsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztDQUN2RCxRQUFRLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDO0NBQ3ZGLFFBQVEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUM7Q0FDcEMsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztDQUN4RSxTQUFTO0FBQ1Q7Q0FDQSxFQUFFLG1CQUFtQixFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDN0MsRUFBRTtDQUNGLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQztDQUNaLFFBQVEsR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0NBQy9CLFFBQVEsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0NBQzlCLFFBQVEsT0FBTyxDQUFDLENBQUM7Q0FDakIsS0FBSztDQUNMLENBQUMsWUFBWSxFQUFFO0FBQ2Y7Q0FDQSxFQUFFLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztBQUN6QjtDQUNBLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLFlBQVksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7Q0FDekUsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksWUFBWSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUNuRCxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxZQUFZLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQy9DO0NBQ0E7QUFDQTtDQUNBLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsVUFBVSxFQUFFLElBQUksS0FBSyxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixFQUFFLEVBQUUsQ0FBQztDQUN4SCxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLFFBQVEsRUFBRSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Q0FDaEcsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxJQUFJLEVBQUUsSUFBSSxLQUFLLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO0FBQ3hGO0NBQ0EsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO0FBQzlCO0NBQ0EsRUFBRSxJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztBQUM5QjtDQUNBLEVBQUU7Q0FDRixDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDMUI7Q0FDQSxFQUFFO0NBQ0YsQ0FBQyxrQkFBa0IsRUFBRTtDQUNyQjtBQUNBO0NBQ0E7Q0FDQSxFQUFFLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0NBQ3JDLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztDQUMxRCxFQUFFLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztBQUM1QztDQUNBO0NBQ0EsRUFBRSxJQUFJLFFBQVEsR0FBRyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7Q0FDdkYsRUFBRSxJQUFJLE9BQU8sR0FBRyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFDLENBQUM7Q0FDakUsRUFBRSxJQUFJLEdBQUcsR0FBRyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDN0Q7Q0FDQSxFQUFFLElBQUksaUJBQWlCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDO0NBQzdELEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7Q0FDNUIsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0NBQzdDLEVBQUUsaUJBQWlCLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztBQUN2QztDQUNBLEVBQUUsSUFBSSxlQUFlLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDO0NBQ3pELEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7Q0FDMUIsRUFBRSxlQUFlLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztDQUMxQyxFQUFFLGVBQWUsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBQ3JDO0NBQ0EsRUFBRSxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7QUFDakQ7QUFDQTtDQUNBO0NBQ0EsRUFBRSxJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUM7Q0FLbkIsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNmLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUN6QyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDMUM7Q0FDQSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMzQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMvQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNsRCxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QztDQUNBLFVBQVUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQ2hDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQzFCO0NBQ0E7Q0FDQSxVQUFVLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztDQUNoQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMxQjtDQUNBLElBQUk7Q0FDSixHQUFHO0FBQ0g7Q0FDQTtDQUNBLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ3ZDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ3hDO0NBQ0EsSUFBSSxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEQ7Q0FDQSxJQUFJLE9BQU8sQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDaEMsSUFBSSxPQUFPLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUNsQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDO0NBQ0E7Q0FDQSxJQUFJLEdBQUcsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN2RCxJQUFJLEdBQUcsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDekQsSUFBSTtDQUNKLEdBQUc7QUFDSDtDQUNBLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7Q0FDbEIsRUFBRSxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUNsQyxFQUFFLFdBQVcsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBQ2pDO0NBQ0EsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQztDQUNyQyxFQUFFO0NBQ0YsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztDQUM1QixFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO0NBQzFCLEdBQUcsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7Q0FDOUIsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztDQUM3QixHQUFHO0FBQ0g7Q0FDQTtBQUNBO0NBQ0E7QUFDQTtDQUNBLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztBQUM3RDtDQUNBLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssU0FBUyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDdkQsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssU0FBUyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDcEQsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssU0FBUyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDcEQ7Q0FDQSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0NBQzVCLEVBQUU7Q0FDRixDQUFDLGlCQUFpQixFQUFFO0NBQ3BCLEVBQUUsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUM7Q0FDN0QsRUFBRSxpQkFBaUIsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBQ3ZDO0NBQ0EsRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7Q0FDeEIsRUFBRSxJQUFJLGVBQWUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUM7Q0FDekQsRUFBRSxlQUFlLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztBQUNyQztDQUNBLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBQztDQUM5QixRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7Q0FDaEQsWUFBWSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztDQUNwQyxTQUFTO0NBQ1QsRUFBRTtDQUNGLElBQUksZ0JBQWdCLEVBQUU7Q0FDdEI7Q0FDQSxRQUFRLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztDQUNwRCxRQUFRLElBQUksYUFBYSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7QUFDckU7Q0FDQSxRQUFRLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzNEO0NBQ0EsUUFBUSxJQUFJLDRCQUE0QixHQUFHLElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0NBQ3RFLFFBQVEsSUFBSSxTQUFTLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO0FBQzlEO0NBQ0EsUUFBUSxJQUFJLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO0NBQ2xEO0NBQ0EsR0FBRyxJQUFJLFVBQVUsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQ3pDLFlBQVksSUFBSSxVQUFVLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEQsWUFBWSxJQUFJLFVBQVUsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwRDtDQUNBLFlBQVksSUFBSSxTQUFTLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7Q0FDdkgsTUFBTSxJQUFJLFNBQVMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztDQUNwSCxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2pIO0NBQ0E7Q0FDQSxZQUFZLElBQUksRUFBRSxHQUFHLFNBQVMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO0NBQzdDLFlBQVksSUFBSSxFQUFFLEdBQUcsU0FBUyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7Q0FDN0MsWUFBWSxJQUFJLEVBQUUsR0FBRyxTQUFTLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQztDQUM3QyxZQUFZLDRCQUE0QixDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztDQUNwRixTQUFTO0FBQ1Q7Q0FDQTtDQUNBLFFBQVEsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUNuQyxZQUFZLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUN0QixZQUFZLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSw0QkFBNEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDL0Y7Q0FDQSxnQkFBZ0IsSUFBSSxJQUFJLEdBQUcsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDM0QsZ0JBQWdCLDRCQUE0QixDQUFDLENBQUMsQ0FBQyxHQUFHLDRCQUE0QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNwRixnQkFBZ0IsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUN6RDtDQUNBO0NBQ0EsZ0JBQWdCLElBQUksVUFBVSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDakQsZ0JBQWdCLElBQUksVUFBVSxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ25ELGdCQUFnQixJQUFJLFVBQVUsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuRDtDQUNBLGdCQUFnQixVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEQsZ0JBQWdCLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzFELGdCQUFnQixVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxRDtDQUNBLGdCQUFnQixVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQztDQUNqRCxnQkFBZ0IsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDO0NBQ25ELGdCQUFnQixVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUM7Q0FDbkQsZ0JBQWdCLENBQUMsRUFBRSxDQUFDO0NBQ3BCLGFBQWE7Q0FDYixTQUFTO0NBQ1Q7Q0FDQSxRQUFRLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7Q0FDaEQsS0FBSztDQUNMLENBQUMsY0FBYyxFQUFFO0NBQ2pCLEVBQTBCLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVM7Q0FDN0QsRUFBd0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsT0FBTztDQUN6RDtDQUNBO0NBQ0EsRUFBRSxJQUFJLFNBQVMsR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztDQUN0QyxFQUFFLElBQUksUUFBUSxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0NBQ3JDLEVBQUUsSUFBSSxRQUFRLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7Q0FHckMsRUFBRSxJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUM7Q0FDekIsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNmLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ3ZDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQ3hDO0NBQ0E7Q0FDQSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMzQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNaO0NBQ0E7Q0FDQTtDQUNBLElBQUksY0FBYyxHQUFHLENBQUMsQ0FBQztBQUN2QjtDQUNBO0NBQ0EsSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNwQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUMsS0FBSyxLQUFJO0NBQ1Q7Q0FDQSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUMsS0FBSyxjQUFjLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDMUIsS0FBSztBQUNMO0NBQ0E7Q0FDQSxJQUFJLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3BDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxLQUFLLEtBQUk7Q0FDVDtDQUNBLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxLQUFLLGNBQWMsSUFBSSxDQUFDLENBQUMsQ0FBQztDQUMxQixLQUFLO0FBQ0w7Q0FDQTtDQUNBO0NBQ0EsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ2xKO0NBQ0EsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xKO0NBQ0E7Q0FDQSxJQUFJLFNBQVMsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDO0NBQzFELElBQUksU0FBUyxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsQ0FBQztDQUM3QztDQUNBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO0NBQ3BFLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQztDQUN0RSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMs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LENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSTtDQUNuQixFQUFFLENBQUMsR0FBRyxHQUFHO0NBQ1QsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztBQUNmO0NBQ0EsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxPQUFPLEtBQUssQ0FBQztBQUMxQztDQUNBO0NBQ0EsQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztBQUN2QjtDQUNBLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksR0FBRztBQUMxQjtDQUNBLEVBQUUsS0FBSyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO0NBQ2hFLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsT0FBTyxLQUFLLENBQUM7Q0FDakQsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNiO0NBQ0EsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxPQUFPLElBQUksQ0FBQztBQUNiO0NBQ0EsQ0FBQztBQUNEO0NBQ0EsU0FBUyxXQUFXLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsT0FBTyxHQUFHO0FBQ2pEO0NBQ0EsQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSTtDQUNuQixFQUFFLENBQUMsR0FBRyxHQUFHO0NBQ1QsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztBQUNmO0NBQ0EsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxPQUFPLEtBQUssQ0FBQztBQUMxQztDQUNBO0NBQ0EsQ0FBQyxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO0NBQ2hGLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7Q0FDM0UsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRTtDQUMzRSxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDNUU7Q0FDQTtDQUNBLENBQUMsTUFBTSxJQUFJLEdBQUcsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUU7Q0FDekQsRUFBRSxJQUFJLEdBQUcsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQztBQUNyRDtDQUNBLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLEtBQUs7Q0FDbEIsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztBQUNoQjtDQUNBO0NBQ0EsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLEdBQUc7QUFDaEQ7Q0FDQSxFQUFFLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJO0NBQ3ZDLEdBQUcsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtDQUM1RCxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLE9BQU8sS0FBSyxDQUFDO0NBQ2pELEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDZDtDQUNBLEVBQUUsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUk7Q0FDdkMsR0FBRyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO0NBQzVELEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsT0FBTyxLQUFLLENBQUM7Q0FDakQsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUNkO0NBQ0EsRUFBRTtBQUNGO0NBQ0E7Q0FDQSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxHQUFHO0FBQzVCO0NBQ0EsRUFBRSxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSTtDQUN2QyxHQUFHLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7Q0FDNUQsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxPQUFPLEtBQUssQ0FBQztDQUNqRCxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ2Q7Q0FDQSxFQUFFO0FBQ0Y7Q0FDQTtDQUNBLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLEdBQUc7QUFDNUI7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Q0FBQyxPQUFPLEVBQUUsRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLEVBQUUsSUFBSSxDQUFDO0NBQ2xFLEdBQUcsRUFBRSxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsRUFBRSxJQUFJLENBQUM7Q0FDN0QsR0FBRyxFQUFFLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzlEO0NBQ0EsQ0FBQztBQUNEO0NBQ0E7Q0FDQSxTQUFTLGVBQWUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHO0FBQ2pDO0NBQ0EsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7Q0FDM0UsSUFBSSxhQUFhLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLGFBQWEsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksWUFBWSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7Q0FDMUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRTtDQUN2RCxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQztBQUNyRjtDQUNBLENBQUM7QUFDRDtDQUNBO0NBQ0EsU0FBUyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUc7QUFDekI7Q0FDQSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDdEU7Q0FDQSxDQUFDO0FBQ0Q7Q0FDQTtDQUNBLFNBQVMsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUc7QUFDMUI7Q0FDQSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN2QztDQUNBLENBQUM7QUFDRDtDQUNBO0NBQ0EsU0FBUyxVQUFVLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHO0FBQ3RDO0NBQ0EsQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQztDQUN2QyxDQUFDLE1BQU0sRUFBRSxHQUFHLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDO0NBQ3ZDLENBQUMsTUFBTSxFQUFFLEdBQUcsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUM7Q0FDdkMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQztBQUN2QztDQUNBLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsT0FBTyxJQUFJLENBQUM7QUFDM0M7Q0FDQSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSSxTQUFTLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxPQUFPLElBQUksQ0FBQztDQUN4RCxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSSxTQUFTLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxPQUFPLElBQUksQ0FBQztDQUN4RCxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSSxTQUFTLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxPQUFPLElBQUksQ0FBQztDQUN4RCxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSSxTQUFTLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxPQUFPLElBQUksQ0FBQztBQUN4RDtDQUNBLENBQUMsT0FBTyxLQUFLLENBQUM7QUFDZDtDQUNBLENBQUM7QUFDRDtDQUNBO0NBQ0EsU0FBUyxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUc7QUFDOUI7Q0FDQSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUs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QUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRTtDQUN6RSxHQUFHLE1BQU0sR0FBRyxFQUFFLE1BQU0sQ0FBQztDQUNyQixFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ2I7Q0FDQSxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRztBQUNyQjtDQUNBLENBQUMsT0FBTyxNQUFNLENBQUM7QUFDZjtDQUNBLENBQUM7QUFDRDtDQUNBO0NBQ0E7Q0FDQSxTQUFTLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHO0FBQzlCO0NBQ0EsQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtDQUNyQyxFQUFFLEVBQUUsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtDQUNoQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsSUFBSTtDQUNiLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDZDtDQUNBLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7Q0FDWixDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQ1o7Q0FDQSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0NBQ2QsQ0FBQyxFQUFFLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNkO0NBQ0EsQ0FBQyxFQUFFLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztDQUNkLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7QUFDZDtDQUNBLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7Q0FDZCxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsRUFBRSxD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
