(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, factory(global.EXP = {}));
}(this, function (exports) { 'use strict';

	/* The base class that everything inherits from. 
		Each thing drawn to the screen is a tree. Domains, such as EXP.Area or EXP.Array are the root nodes,
		EXP.Transformation is currently the only intermediate node, and the leaf nodes are some form of Output such as
		EXP.LineOutput or EXP.PointOutput, or EXP.VectorOutput.

		All of these can be .add()ed to each other to form that tree, and this file defines how it works.
	*/

	class Node{
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

	class OutputNode extends Node{ //more of a java interface, really
		constructor(){super();}
		evaluateSelf(i, t, x, y, z){}
		onAfterActivation(){}
		_onAdd(){}
	}

	class DomainNode extends Node{ //A node that calls other functions over some range.
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
			}else{
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
			}else{
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
				}else{
					console.error("ERROR! Something not of required type "+type.name+"! See traceback for more.");
				}
	            console.trace();
			}
		}


		static assertPropExists(thing, name){
			if(!thing || !(name in thing)){
				console.error("ERROR! "+name+" not present in required property");
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
			}else{
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
	class Transformation extends Node{
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

	class LinkedTransformation extends Node{
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
	        }else{
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
	        }else{
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
			}else{
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
				    }else{
					    this.fromValues[property] = this.target[property];
				    }

	                this.interpolators.push(this.chooseInterpolator(this.fromValues[property], this.toValues[property],this.interpolationFunction));
	                this.interpolatingPropertyNames.push(property);
			    }
	        }else{
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
	        }else{
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
	        }else{
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
		var animation = new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000, optionalArguments);
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
				default:
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
				callback = opts;
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
		}else{
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
	(function(f){{module.exports=f();}})(function(){return function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof commonjsRequire=="function"&&commonjsRequire;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r);}return n[o].exports}var i=typeof commonjsRequire=="function"&&commonjsRequire;for(var o=0;o<r.length;o++)s(r[o]);return s}return e}()({1:[function(require,module,exports){function EventEmitter(){this._events=this._events||{};this._maxListeners=this._maxListeners||undefined;}module.exports=EventEmitter;EventEmitter.EventEmitter=EventEmitter;EventEmitter.prototype._events=undefined;EventEmitter.prototype._maxListeners=undefined;EventEmitter.defaultMaxListeners=10;EventEmitter.prototype.setMaxListeners=function(n){if(!isNumber(n)||n<0||isNaN(n))throw TypeError("n must be a positive number");this._maxListeners=n;return this};EventEmitter.prototype.emit=function(type){var er,handler,len,args,i,listeners;if(!this._events)this._events={};if(type==="error"){if(!this._events.error||isObject(this._events.error)&&!this._events.error.length){er=arguments[1];if(er instanceof Error){throw er}else{var err=new Error('Uncaught, unspecified "error" event. ('+er+")");err.context=er;throw err}}}handler=this._events[type];if(isUndefined(handler))return false;if(isFunction(handler)){switch(arguments.length){case 1:handler.call(this);break;case 2:handler.call(this,arguments[1]);break;case 3:handler.call(this,arguments[1],arguments[2]);break;default:args=Array.prototype.slice.call(arguments,1);handler.apply(this,args);}}else if(isObject(handler)){args=Array.prototype.slice.call(arguments,1);listeners=handler.slice();len=listeners.length;for(i=0;i<len;i++)listeners[i].apply(this,args);}return true};EventEmitter.prototype.addListener=function(type,listener){var m;if(!isFunction(listener))throw TypeError("listener must be a function");if(!this._events)this._events={};if(this._events.newListener)this.emit("newListener",type,isFunction(listener.listener)?listener.listener:listener);if(!this._events[type])this._events[type]=listener;else if(isObject(this._events[type]))this._events[type].push(listener);else this._events[type]=[this._events[type],listener];if(isObject(this._events[type])&&!this._events[type].warned){if(!isUndefined(this._maxListeners)){m=this._maxListeners;}else{m=EventEmitter.defaultMaxListeners;}if(m&&m>0&&this._events[type].length>m){this._events[type].warned=true;console.error("(node) warning: possible EventEmitter memory "+"leak detected. %d listeners added. "+"Use emitter.setMaxListeners() to increase limit.",this._events[type].length);if(typeof console.trace==="function"){console.trace();}}}return this};EventEmitter.prototype.on=EventEmitter.prototype.addListener;EventEmitter.prototype.once=function(type,listener){if(!isFunction(listener))throw TypeError("listener must be a function");var fired=false;function g(){this.removeListener(type,g);if(!fired){fired=true;listener.apply(this,arguments);}}g.listener=listener;this.on(type,g);return this};EventEmitter.prototype.removeListener=function(type,listener){var list,position,length,i;if(!isFunction(listener))throw TypeError("listener must be a function");if(!this._events||!this._events[type])return this;list=this._events[type];length=list.length;position=-1;if(list===listener||isFunction(list.listener)&&list.listener===listener){delete this._events[type];if(this._events.removeListener)this.emit("removeListener",type,listener);}else if(isObject(list)){for(i=length;i-- >0;){if(list[i]===listener||list[i].listener&&list[i].listener===listener){position=i;break}}if(position<0)return this;if(list.length===1){list.length=0;delete this._events[type];}else{list.splice(position,1);}if(this._events.removeListener)this.emit("removeListener",type,listener);}return this};EventEmitter.prototype.removeAllListeners=function(type){var key,listeners;if(!this._events)return this;if(!this._events.removeListener){if(arguments.length===0)this._events={};else if(this._events[type])delete this._events[type];return this}if(arguments.length===0){for(key in this._events){if(key==="removeListener")continue;this.removeAllListeners(key);}this.removeAllListeners("removeListener");this._events={};return this}listeners=this._events[type];if(isFunction(listeners)){this.removeListener(type,listeners);}else if(listeners){while(listeners.length)this.removeListener(type,listeners[listeners.length-1]);}delete this._events[type];return this};EventEmitter.prototype.listeners=function(type){var ret;if(!this._events||!this._events[type])ret=[];else if(isFunction(this._events[type]))ret=[this._events[type]];else ret=this._events[type].slice();return ret};EventEmitter.prototype.listenerCount=function(type){if(this._events){var evlistener=this._events[type];if(isFunction(evlistener))return 1;else if(evlistener)return evlistener.length}return 0};EventEmitter.listenerCount=function(emitter,type){return emitter.listenerCount(type)};function isFunction(arg){return typeof arg==="function"}function isNumber(arg){return typeof arg==="number"}function isObject(arg){return typeof arg==="object"&&arg!==null}function isUndefined(arg){return arg===void 0}},{}],2:[function(require,module,exports){var NeuQuant=require("./TypedNeuQuant.js");var LZWEncoder=require("./LZWEncoder.js");function ByteArray(){this.page=-1;this.pages=[];this.newPage();}ByteArray.pageSize=4096;ByteArray.charMap={};for(var i=0;i<256;i++)ByteArray.charMap[i]=String.fromCharCode(i);ByteArray.prototype.newPage=function(){this.pages[++this.page]=new Uint8Array(ByteArray.pageSize);this.cursor=0;};ByteArray.prototype.getData=function(){var rv="";for(var p=0;p<this.pages.length;p++){for(var i=0;i<ByteArray.pageSize;i++){rv+=ByteArray.charMap[this.pages[p][i]];}}return rv};ByteArray.prototype.writeByte=function(val){if(this.cursor>=ByteArray.pageSize)this.newPage();this.pages[this.page][this.cursor++]=val;};ByteArray.prototype.writeUTFBytes=function(string){for(var l=string.length,i=0;i<l;i++)this.writeByte(string.charCodeAt(i));};ByteArray.prototype.writeBytes=function(array,offset,length){for(var l=length||array.length,i=offset||0;i<l;i++)this.writeByte(array[i]);};function GIFEncoder(width,height){this.width=~~width;this.height=~~height;this.transparent=null;this.transIndex=0;this.repeat=-1;this.delay=0;this.image=null;this.pixels=null;this.indexedPixels=null;this.colorDepth=null;this.colorTab=null;this.neuQuant=null;this.usedEntry=new Array;this.palSize=7;this.dispose=-1;this.firstFrame=true;this.sample=10;this.dither=false;this.globalPalette=false;this.out=new ByteArray;}GIFEncoder.prototype.setDelay=function(milliseconds){this.delay=Math.round(milliseconds/10);};GIFEncoder.prototype.setFrameRate=function(fps){this.delay=Math.round(100/fps);};GIFEncoder.prototype.setDispose=function(disposalCode){if(disposalCode>=0)this.dispose=disposalCode;};GIFEncoder.prototype.setRepeat=function(repeat){this.repeat=repeat;};GIFEncoder.prototype.setTransparent=function(color){this.transparent=color;};GIFEncoder.prototype.addFrame=function(imageData){this.image=imageData;this.colorTab=this.globalPalette&&this.globalPalette.slice?this.globalPalette:null;this.getImagePixels();this.analyzePixels();if(this.globalPalette===true)this.globalPalette=this.colorTab;if(this.firstFrame){this.writeLSD();this.writePalette();if(this.repeat>=0){this.writeNetscapeExt();}}this.writeGraphicCtrlExt();this.writeImageDesc();if(!this.firstFrame&&!this.globalPalette)this.writePalette();this.writePixels();this.firstFrame=false;};GIFEncoder.prototype.finish=function(){this.out.writeByte(59);};GIFEncoder.prototype.setQuality=function(quality){if(quality<1)quality=1;this.sample=quality;};GIFEncoder.prototype.setDither=function(dither){if(dither===true)dither="FloydSteinberg";this.dither=dither;};GIFEncoder.prototype.setGlobalPalette=function(palette){this.globalPalette=palette;};GIFEncoder.prototype.getGlobalPalette=function(){return this.globalPalette&&this.globalPalette.slice&&this.globalPalette.slice(0)||this.globalPalette};GIFEncoder.prototype.writeHeader=function(){this.out.writeUTFBytes("GIF89a");};GIFEncoder.prototype.analyzePixels=function(){if(!this.colorTab){this.neuQuant=new NeuQuant(this.pixels,this.sample);this.neuQuant.buildColormap();this.colorTab=this.neuQuant.getColormap();}if(this.dither){this.ditherPixels(this.dither.replace("-serpentine",""),this.dither.match(/-serpentine/)!==null);}else{this.indexPixels();}this.pixels=null;this.colorDepth=8;this.palSize=7;if(this.transparent!==null){this.transIndex=this.findClosest(this.transparent,true);}};GIFEncoder.prototype.indexPixels=function(imgq){var nPix=this.pixels.length/3;this.indexedPixels=new Uint8Array(nPix);var k=0;for(var j=0;j<nPix;j++){var index=this.findClosestRGB(this.pixels[k++]&255,this.pixels[k++]&255,this.pixels[k++]&255);this.usedEntry[index]=true;this.indexedPixels[j]=index;}};GIFEncoder.prototype.ditherPixels=function(kernel,serpentine){var kernels={FalseFloydSteinberg:[[3/8,1,0],[3/8,0,1],[2/8,1,1]],FloydSteinberg:[[7/16,1,0],[3/16,-1,1],[5/16,0,1],[1/16,1,1]],Stucki:[[8/42,1,0],[4/42,2,0],[2/42,-2,1],[4/42,-1,1],[8/42,0,1],[4/42,1,1],[2/42,2,1],[1/42,-2,2],[2/42,-1,2],[4/42,0,2],[2/42,1,2],[1/42,2,2]],Atkinson:[[1/8,1,0],[1/8,2,0],[1/8,-1,1],[1/8,0,1],[1/8,1,1],[1/8,0,2]]};if(!kernel||!kernels[kernel]){throw"Unknown dithering kernel: "+kernel}var ds=kernels[kernel];var index=0,height=this.height,width=this.width,data=this.pixels;var direction=serpentine?-1:1;this.indexedPixels=new Uint8Array(this.pixels.length/3);for(var y=0;y<height;y++){if(serpentine)direction=direction*-1;for(var x=direction==1?0:width-1,xend=direction==1?width:0;x!==xend;x+=direction){index=y*width+x;var idx=index*3;var r1=data[idx];var g1=data[idx+1];var b1=data[idx+2];idx=this.findClosestRGB(r1,g1,b1);this.usedEntry[idx]=true;this.indexedPixels[index]=idx;idx*=3;var r2=this.colorTab[idx];var g2=this.colorTab[idx+1];var b2=this.colorTab[idx+2];var er=r1-r2;var eg=g1-g2;var eb=b1-b2;for(var i=direction==1?0:ds.length-1,end=direction==1?ds.length:0;i!==end;i+=direction){var x1=ds[i][1];var y1=ds[i][2];if(x1+x>=0&&x1+x<width&&y1+y>=0&&y1+y<height){var d=ds[i][0];idx=index+x1+y1*width;idx*=3;data[idx]=Math.max(0,Math.min(255,data[idx]+er*d));data[idx+1]=Math.max(0,Math.min(255,data[idx+1]+eg*d));data[idx+2]=Math.max(0,Math.min(255,data[idx+2]+eb*d));}}}}};GIFEncoder.prototype.findClosest=function(c,used){return this.findClosestRGB((c&16711680)>>16,(c&65280)>>8,c&255,used)};GIFEncoder.prototype.findClosestRGB=function(r,g,b,used){if(this.colorTab===null)return -1;if(this.neuQuant&&!used){return this.neuQuant.lookupRGB(r,g,b)}var minpos=0;var dmin=256*256*256;var len=this.colorTab.length;for(var i=0,index=0;i<len;index++){var dr=r-(this.colorTab[i++]&255);var dg=g-(this.colorTab[i++]&255);var db=b-(this.colorTab[i++]&255);var d=dr*dr+dg*dg+db*db;if((!used||this.usedEntry[index])&&d<dmin){dmin=d;minpos=index;}}return minpos};GIFEncoder.prototype.getImagePixels=function(){var w=this.width;var h=this.height;this.pixels=new Uint8Array(w*h*3);var data=this.image;var srcPos=0;var count=0;for(var i=0;i<h;i++){for(var j=0;j<w;j++){this.pixels[count++]=data[srcPos++];this.pixels[count++]=data[srcPos++];this.pixels[count++]=data[srcPos++];srcPos++;}}};GIFEncoder.prototype.writeGraphicCtrlExt=function(){this.out.writeByte(33);this.out.writeByte(249);this.out.writeByte(4);var transp,disp;if(this.transparent===null){transp=0;disp=0;}else{transp=1;disp=2;}if(this.dispose>=0){disp=this.dispose&7;}disp<<=2;this.out.writeByte(0|disp|0|transp);this.writeShort(this.delay);this.out.writeByte(this.transIndex);this.out.writeByte(0);};GIFEncoder.prototype.writeImageDesc=function(){this.out.writeByte(44);this.writeShort(0);this.writeShort(0);this.writeShort(this.width);this.writeShort(this.height);if(this.firstFrame||this.globalPalette){this.out.writeByte(0);}else{this.out.writeByte(128|0|0|0|this.palSize);}};GIFEncoder.prototype.writeLSD=function(){this.writeShort(this.width);this.writeShort(this.height);this.out.writeByte(128|112|0|this.palSize);this.out.writeByte(0);this.out.writeByte(0);};GIFEncoder.prototype.writeNetscapeExt=function(){this.out.writeByte(33);this.out.writeByte(255);this.out.writeByte(11);this.out.writeUTFBytes("NETSCAPE2.0");this.out.writeByte(3);this.out.writeByte(1);this.writeShort(this.repeat);this.out.writeByte(0);};GIFEncoder.prototype.writePalette=function(){this.out.writeBytes(this.colorTab);var n=3*256-this.colorTab.length;for(var i=0;i<n;i++)this.out.writeByte(0);};GIFEncoder.prototype.writeShort=function(pValue){this.out.writeByte(pValue&255);this.out.writeByte(pValue>>8&255);};GIFEncoder.prototype.writePixels=function(){var enc=new LZWEncoder(this.width,this.height,this.indexedPixels,this.colorDepth);enc.encode(this.out);};GIFEncoder.prototype.stream=function(){return this.out};module.exports=GIFEncoder;},{"./LZWEncoder.js":3,"./TypedNeuQuant.js":4}],3:[function(require,module,exports){var EOF=-1;var BITS=12;var HSIZE=5003;var masks=[0,1,3,7,15,31,63,127,255,511,1023,2047,4095,8191,16383,32767,65535];function LZWEncoder(width,height,pixels,colorDepth){var initCodeSize=Math.max(2,colorDepth);var accum=new Uint8Array(256);var htab=new Int32Array(HSIZE);var codetab=new Int32Array(HSIZE);var cur_accum,cur_bits=0;var a_count;var free_ent=0;var maxcode;var clear_flg=false;var g_init_bits,ClearCode,EOFCode;function char_out(c,outs){accum[a_count++]=c;if(a_count>=254)flush_char(outs);}function cl_block(outs){cl_hash(HSIZE);free_ent=ClearCode+2;clear_flg=true;output(ClearCode,outs);}function cl_hash(hsize){for(var i=0;i<hsize;++i)htab[i]=-1;}function compress(init_bits,outs){var fcode,c,i,ent,disp,hsize_reg,hshift;g_init_bits=init_bits;clear_flg=false;n_bits=g_init_bits;maxcode=MAXCODE(n_bits);ClearCode=1<<init_bits-1;EOFCode=ClearCode+1;free_ent=ClearCode+2;a_count=0;ent=nextPixel();hshift=0;for(fcode=HSIZE;fcode<65536;fcode*=2)++hshift;hshift=8-hshift;hsize_reg=HSIZE;cl_hash(hsize_reg);output(ClearCode,outs);outer_loop:while((c=nextPixel())!=EOF){fcode=(c<<BITS)+ent;i=c<<hshift^ent;if(htab[i]===fcode){ent=codetab[i];continue}else if(htab[i]>=0){disp=hsize_reg-i;if(i===0)disp=1;do{if((i-=disp)<0)i+=hsize_reg;if(htab[i]===fcode){ent=codetab[i];continue outer_loop}}while(htab[i]>=0)}output(ent,outs);ent=c;if(free_ent<1<<BITS){codetab[i]=free_ent++;htab[i]=fcode;}else{cl_block(outs);}}output(ent,outs);output(EOFCode,outs);}function encode(outs){outs.writeByte(initCodeSize);remaining=width*height;curPixel=0;compress(initCodeSize+1,outs);outs.writeByte(0);}function flush_char(outs){if(a_count>0){outs.writeByte(a_count);outs.writeBytes(accum,0,a_count);a_count=0;}}function MAXCODE(n_bits){return (1<<n_bits)-1}function nextPixel(){if(remaining===0)return EOF;--remaining;var pix=pixels[curPixel++];return pix&255}function output(code,outs){cur_accum&=masks[cur_bits];if(cur_bits>0)cur_accum|=code<<cur_bits;else cur_accum=code;cur_bits+=n_bits;while(cur_bits>=8){char_out(cur_accum&255,outs);cur_accum>>=8;cur_bits-=8;}if(free_ent>maxcode||clear_flg){if(clear_flg){maxcode=MAXCODE(n_bits=g_init_bits);clear_flg=false;}else{++n_bits;if(n_bits==BITS)maxcode=1<<BITS;else maxcode=MAXCODE(n_bits);}}if(code==EOFCode){while(cur_bits>0){char_out(cur_accum&255,outs);cur_accum>>=8;cur_bits-=8;}flush_char(outs);}}this.encode=encode;}module.exports=LZWEncoder;},{}],4:[function(require,module,exports){var ncycles=100;var netsize=256;var maxnetpos=netsize-1;var netbiasshift=4;var intbiasshift=16;var intbias=1<<intbiasshift;var gammashift=10;var betashift=10;var beta=intbias>>betashift;var betagamma=intbias<<gammashift-betashift;var initrad=netsize>>3;var radiusbiasshift=6;var radiusbias=1<<radiusbiasshift;var initradius=initrad*radiusbias;var radiusdec=30;var alphabiasshift=10;var initalpha=1<<alphabiasshift;var radbiasshift=8;var radbias=1<<radbiasshift;var alpharadbshift=alphabiasshift+radbiasshift;var alpharadbias=1<<alpharadbshift;var prime1=499;var prime2=491;var prime3=487;var prime4=503;var minpicturebytes=3*prime4;function NeuQuant(pixels,samplefac){var network;var netindex;var bias;var freq;var radpower;function init(){network=[];netindex=new Int32Array(256);bias=new Int32Array(netsize);freq=new Int32Array(netsize);radpower=new Int32Array(netsize>>3);var i,v;for(i=0;i<netsize;i++){v=(i<<netbiasshift+8)/netsize;network[i]=new Float64Array([v,v,v,0]);freq[i]=intbias/netsize;bias[i]=0;}}function unbiasnet(){for(var i=0;i<netsize;i++){network[i][0]>>=netbiasshift;network[i][1]>>=netbiasshift;network[i][2]>>=netbiasshift;network[i][3]=i;}}function altersingle(alpha,i,b,g,r){network[i][0]-=alpha*(network[i][0]-b)/initalpha;network[i][1]-=alpha*(network[i][1]-g)/initalpha;network[i][2]-=alpha*(network[i][2]-r)/initalpha;}function alterneigh(radius,i,b,g,r){var lo=Math.abs(i-radius);var hi=Math.min(i+radius,netsize);var j=i+1;var k=i-1;var m=1;var p,a;while(j<hi||k>lo){a=radpower[m++];if(j<hi){p=network[j++];p[0]-=a*(p[0]-b)/alpharadbias;p[1]-=a*(p[1]-g)/alpharadbias;p[2]-=a*(p[2]-r)/alpharadbias;}if(k>lo){p=network[k--];p[0]-=a*(p[0]-b)/alpharadbias;p[1]-=a*(p[1]-g)/alpharadbias;p[2]-=a*(p[2]-r)/alpharadbias;}}}function contest(b,g,r){var bestd=~(1<<31);var bestbiasd=bestd;var bestpos=-1;var bestbiaspos=bestpos;var i,n,dist,biasdist,betafreq;for(i=0;i<netsize;i++){n=network[i];dist=Math.abs(n[0]-b)+Math.abs(n[1]-g)+Math.abs(n[2]-r);if(dist<bestd){bestd=dist;bestpos=i;}biasdist=dist-(bias[i]>>intbiasshift-netbiasshift);if(biasdist<bestbiasd){bestbiasd=biasdist;bestbiaspos=i;}betafreq=freq[i]>>betashift;freq[i]-=betafreq;bias[i]+=betafreq<<gammashift;}freq[bestpos]+=beta;bias[bestpos]-=betagamma;return bestbiaspos}function inxbuild(){var i,j,p,q,smallpos,smallval,previouscol=0,startpos=0;for(i=0;i<netsize;i++){p=network[i];smallpos=i;smallval=p[1];for(j=i+1;j<netsize;j++){q=network[j];if(q[1]<smallval){smallpos=j;smallval=q[1];}}q=network[smallpos];if(i!=smallpos){j=q[0];q[0]=p[0];p[0]=j;j=q[1];q[1]=p[1];p[1]=j;j=q[2];q[2]=p[2];p[2]=j;j=q[3];q[3]=p[3];p[3]=j;}if(smallval!=previouscol){netindex[previouscol]=startpos+i>>1;for(j=previouscol+1;j<smallval;j++)netindex[j]=i;previouscol=smallval;startpos=i;}}netindex[previouscol]=startpos+maxnetpos>>1;for(j=previouscol+1;j<256;j++)netindex[j]=maxnetpos;}function inxsearch(b,g,r){var a,p,dist;var bestd=1e3;var best=-1;var i=netindex[g];var j=i-1;while(i<netsize||j>=0){if(i<netsize){p=network[i];dist=p[1]-g;if(dist>=bestd)i=netsize;else{i++;if(dist<0)dist=-dist;a=p[0]-b;if(a<0)a=-a;dist+=a;if(dist<bestd){a=p[2]-r;if(a<0)a=-a;dist+=a;if(dist<bestd){bestd=dist;best=p[3];}}}}if(j>=0){p=network[j];dist=g-p[1];if(dist>=bestd)j=-1;else{j--;if(dist<0)dist=-dist;a=p[0]-b;if(a<0)a=-a;dist+=a;if(dist<bestd){a=p[2]-r;if(a<0)a=-a;dist+=a;if(dist<bestd){bestd=dist;best=p[3];}}}}}return best}function learn(){var i;var lengthcount=pixels.length;var alphadec=30+(samplefac-1)/3;var samplepixels=lengthcount/(3*samplefac);var delta=~~(samplepixels/ncycles);var alpha=initalpha;var radius=initradius;var rad=radius>>radiusbiasshift;if(rad<=1)rad=0;for(i=0;i<rad;i++)radpower[i]=alpha*((rad*rad-i*i)*radbias/(rad*rad));var step;if(lengthcount<minpicturebytes){samplefac=1;step=3;}else if(lengthcount%prime1!==0){step=3*prime1;}else if(lengthcount%prime2!==0){step=3*prime2;}else if(lengthcount%prime3!==0){step=3*prime3;}else{step=3*prime4;}var b,g,r,j;var pix=0;i=0;while(i<samplepixels){b=(pixels[pix]&255)<<netbiasshift;g=(pixels[pix+1]&255)<<netbiasshift;r=(pixels[pix+2]&255)<<netbiasshift;j=contest(b,g,r);altersingle(alpha,j,b,g,r);if(rad!==0)alterneigh(rad,j,b,g,r);pix+=step;if(pix>=lengthcount)pix-=lengthcount;i++;if(delta===0)delta=1;if(i%delta===0){alpha-=alpha/alphadec;radius-=radius/radiusdec;rad=radius>>radiusbiasshift;if(rad<=1)rad=0;for(j=0;j<rad;j++)radpower[j]=alpha*((rad*rad-j*j)*radbias/(rad*rad));}}}function buildColormap(){init();learn();unbiasnet();inxbuild();}this.buildColormap=buildColormap;function getColormap(){var map=[];var index=[];for(var i=0;i<netsize;i++)index[network[i][3]]=i;var k=0;for(var l=0;l<netsize;l++){var j=index[l];map[k++]=network[j][0];map[k++]=network[j][1];map[k++]=network[j][2];}return map}this.getColormap=getColormap;this.lookupRGB=inxsearch;}module.exports=NeuQuant;},{}],5:[function(require,module,exports){var UA,browser,mode,platform,ua;ua=navigator.userAgent.toLowerCase();platform=navigator.platform.toLowerCase();UA=ua.match(/(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/)||[null,"unknown",0];mode=UA[1]==="ie"&&document.documentMode;browser={name:UA[1]==="version"?UA[3]:UA[1],version:mode||parseFloat(UA[1]==="opera"&&UA[4]?UA[4]:UA[2]),platform:{name:ua.match(/ip(?:ad|od|hone)/)?"ios":(ua.match(/(?:webos|android)/)||platform.match(/mac|win|linux/)||["other"])[0]}};browser[browser.name]=true;browser[browser.name+parseInt(browser.version,10)]=true;browser.platform[browser.platform.name]=true;module.exports=browser;},{}],6:[function(require,module,exports){var EventEmitter,GIF,GIFEncoder,browser,gifWorker,extend=function(child,parent){for(var key in parent){if(hasProp.call(parent,key))child[key]=parent[key];}function ctor(){this.constructor=child;}ctor.prototype=parent.prototype;child.prototype=new ctor;child.__super__=parent.prototype;return child},hasProp={}.hasOwnProperty,indexOf=[].indexOf||function(item){for(var i=0,l=this.length;i<l;i++){if(i in this&&this[i]===item)return i}return -1},slice=[].slice;EventEmitter=require("events").EventEmitter;browser=require("./browser.coffee");GIFEncoder=require("./GIFEncoder.js");gifWorker=require("./gif.worker.coffee");module.exports=GIF=function(superClass){var defaults,frameDefaults;extend(GIF,superClass);defaults={workerScript:"gif.worker.js",workers:2,repeat:0,background:"#fff",quality:10,width:null,height:null,transparent:null,debug:false,dither:false};frameDefaults={delay:500,copy:false,dispose:-1};function GIF(options){var base,key,value;this.running=false;this.options={};this.frames=[];this.freeWorkers=[];this.activeWorkers=[];this.setOptions(options);for(key in defaults){value=defaults[key];if((base=this.options)[key]==null){base[key]=value;}}}GIF.prototype.setOption=function(key,value){this.options[key]=value;if(this._canvas!=null&&(key==="width"||key==="height")){return this._canvas[key]=value}};GIF.prototype.setOptions=function(options){var key,results,value;results=[];for(key in options){if(!hasProp.call(options,key))continue;value=options[key];results.push(this.setOption(key,value));}return results};GIF.prototype.addFrame=function(image,options){var frame,key;if(options==null){options={};}frame={};frame.transparent=this.options.transparent;for(key in frameDefaults){frame[key]=options[key]||frameDefaults[key];}if(this.options.width==null){this.setOption("width",image.width);}if(this.options.height==null){this.setOption("height",image.height);}if(typeof ImageData!=="undefined"&&ImageData!==null&&image instanceof ImageData){frame.data=image.data;}else if(typeof CanvasRenderingContext2D!=="undefined"&&CanvasRenderingContext2D!==null&&image instanceof CanvasRenderingContext2D||typeof WebGLRenderingContext!=="undefined"&&WebGLRenderingContext!==null&&image instanceof WebGLRenderingContext){if(options.copy){frame.data=this.getContextData(image);}else{frame.context=image;}}else if(image.childNodes!=null){if(options.copy){frame.data=this.getImageData(image);}else{frame.image=image;}}else{throw new Error("Invalid image")}return this.frames.push(frame)};GIF.prototype.render=function(){var i,j,numWorkers,ref;if(this.running){throw new Error("Already running")}if(this.options.width==null||this.options.height==null){throw new Error("Width and height must be set prior to rendering")}this.running=true;this.nextFrame=0;this.finishedFrames=0;this.imageParts=function(){var j,ref,results;results=[];for(i=j=0,ref=this.frames.length;0<=ref?j<ref:j>ref;i=0<=ref?++j:--j){results.push(null);}return results}.call(this);numWorkers=this.spawnWorkers();if(this.options.globalPalette===true){this.renderNextFrame();}else{for(i=j=0,ref=numWorkers;0<=ref?j<ref:j>ref;i=0<=ref?++j:--j){this.renderNextFrame();}}this.emit("start");return this.emit("progress",0)};GIF.prototype.abort=function(){var worker;while(true){worker=this.activeWorkers.shift();if(worker==null){break}this.log("killing active worker");worker.terminate();}this.running=false;return this.emit("abort")};GIF.prototype.spawnWorkers=function(){var numWorkers,ref,results;numWorkers=Math.min(this.options.workers,this.frames.length);(function(){results=[];for(var j=ref=this.freeWorkers.length;ref<=numWorkers?j<numWorkers:j>numWorkers;ref<=numWorkers?j++:j--){results.push(j);}return results}).apply(this).forEach(function(_this){return function(i){var worker;_this.log("spawning worker "+i);worker=new Worker(_this.options.workerScript);worker.onmessage=function(event){_this.activeWorkers.splice(_this.activeWorkers.indexOf(worker),1);_this.freeWorkers.push(worker);return _this.frameFinished(event.data)};return _this.freeWorkers.push(worker)}}(this));return numWorkers};GIF.prototype.frameFinished=function(frame){var i,j,ref;this.log("frame "+frame.index+" finished - "+this.activeWorkers.length+" active");this.finishedFrames++;this.emit("progress",this.finishedFrames/this.frames.length);this.imageParts[frame.index]=frame;if(this.options.globalPalette===true){this.options.globalPalette=frame.globalPalette;this.log("global palette analyzed");if(this.frames.length>2){for(i=j=1,ref=this.freeWorkers.length;1<=ref?j<ref:j>ref;i=1<=ref?++j:--j){this.renderNextFrame();}}}if(indexOf.call(this.imageParts,null)>=0){return this.renderNextFrame()}else{return this.finishRendering()}};GIF.prototype.finishRendering=function(){var data,frame,i,image,j,k,l,len,len1,len2,len3,offset,page,ref,ref1,ref2;len=0;ref=this.imageParts;for(j=0,len1=ref.length;j<len1;j++){frame=ref[j];len+=(frame.data.length-1)*frame.pageSize+frame.cursor;}len+=frame.pageSize-frame.cursor;this.log("rendering finished - filesize "+Math.round(len/1e3)+"kb");data=new Uint8Array(len);offset=0;ref1=this.imageParts;for(k=0,len2=ref1.length;k<len2;k++){frame=ref1[k];ref2=frame.data;for(i=l=0,len3=ref2.length;l<len3;i=++l){page=ref2[i];data.set(page,offset);if(i===frame.data.length-1){offset+=frame.cursor;}else{offset+=frame.pageSize;}}}image=new Blob([data],{type:"image/gif"});return this.emit("finished",image,data)};GIF.prototype.renderNextFrame=function(){var frame,task,worker;if(this.freeWorkers.length===0){throw new Error("No free workers")}if(this.nextFrame>=this.frames.length){return}frame=this.frames[this.nextFrame++];worker=this.freeWorkers.shift();task=this.getTask(frame);this.log("starting frame "+(task.index+1)+" of "+this.frames.length);this.activeWorkers.push(worker);return worker.postMessage(task)};GIF.prototype.getContextData=function(ctx){return ctx.getImageData(0,0,this.options.width,this.options.height).data};GIF.prototype.getImageData=function(image){var ctx;if(this._canvas==null){this._canvas=document.createElement("canvas");this._canvas.width=this.options.width;this._canvas.height=this.options.height;}ctx=this._canvas.getContext("2d");ctx.setFill=this.options.background;ctx.fillRect(0,0,this.options.width,this.options.height);ctx.drawImage(image,0,0);return this.getContextData(ctx)};GIF.prototype.getTask=function(frame){var index,task;index=this.frames.indexOf(frame);task={index:index,last:index===this.frames.length-1,delay:frame.delay,dispose:frame.dispose,transparent:frame.transparent,width:this.options.width,height:this.options.height,quality:this.options.quality,dither:this.options.dither,globalPalette:this.options.globalPalette,repeat:this.options.repeat,canTransfer:browser.name==="chrome"};if(frame.data!=null){task.data=frame.data;}else if(frame.context!=null){task.data=this.getContextData(frame.context);}else if(frame.image!=null){task.data=this.getImageData(frame.image);}else{throw new Error("Invalid frame")}return task};GIF.prototype.log=function(){var args;args=1<=arguments.length?slice.call(arguments,0):[];if(!this.options.debug){return}return console.log.apply(console,args)};return GIF}(EventEmitter);},{"./GIFEncoder.js":2,"./browser.coffee":5,"./gif.worker.coffee":7,events:1}],7:[function(require,module,exports){var GIFEncoder,renderFrame;GIFEncoder=require("./GIFEncoder.js");renderFrame=function(frame){var encoder,page,stream,transfer;encoder=new GIFEncoder(frame.width,frame.height);if(frame.index===0){encoder.writeHeader();}else{encoder.firstFrame=false;}encoder.setTransparent(frame.transparent);encoder.setDispose(frame.dispose);encoder.setRepeat(frame.repeat);encoder.setDelay(frame.delay);encoder.setQuality(frame.quality);encoder.setDither(frame.dither);encoder.setGlobalPalette(frame.globalPalette);encoder.addFrame(frame.data);if(frame.last){encoder.finish();}if(frame.globalPalette===true){frame.globalPalette=encoder.getGlobalPalette();}stream=encoder.stream();frame.data=stream.pages;frame.cursor=stream.cursor;frame.pageSize=stream.constructor.pageSize;if(frame.canTransfer){transfer=function(){var i,len,ref,results;ref=frame.data;results=[];for(i=0,len=ref.length;i<len;i++){page=ref[i];results.push(page.buffer);}return results}();return self.postMessage(frame,transfer)}else{return self.postMessage(frame)}};self.onmessage=function(event){return renderFrame(event.data)};},{"./GIFEncoder.js":2}]},{},[6])(6)});

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
			_display,
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
		_display = _settings.display || false;
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

		window.addEventListener('load', this.onPageLoad.bind(this), false);

		this.clock = new THREE.Clock();

		this.IS_RECORDING = false; // queryable if one wants to do things like beef up particle counts for render

	    if(!this.shouldCreateCanvas && canvasElem.offsetWidth){
	        //If the canvasElement is already loaded, then the 'load' event has already fired. We need to trigger it ourselves.
	        window.requestAnimationFrame(this.onPageLoad.bind(this));
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
		}else{
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
		}else{
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
		}else{
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

	var vShader = [
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

	var fShader = [
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

	var uniforms = {
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
	        }else{
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
	        for(let vertNum=0;vertNum<(this.numCallsPerActivation-1);vertNum +=1){ //not sure why this -3 is there. i guess it stops vertNum+3 two lines down from going somewhere it shouldn't?
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
	            }else{
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
	        }else{

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
	        }else{
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

			let width = options.width === undefined ? 1 : options.width;
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
	        }else{
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
	        console.log("number of arrowheads (= number of lines):"+ this.numArrowheads);
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
	var vShader$1 = [
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

	var fShader$1 = [
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

	"vec4 getShadedColor(vec4 rgba) { ",
	"  vec3 color = rgba.xyz;",
	"  vec3 color2 = offSpecular(rgba.xyz);",

	"  vec3 normal = normalize(vNormal);",
	"  vec3 light = normalize(vLight);",
	"  vec3 position = normalize(vPosition);",

	"  float side    = gl_FrontFacing ? -1.0 : 1.0;",
	"  float cosine  = side * dot(normal, light);",
	"  float diffuse = mix(max(0.0, cosine), .5 + .5 * cosine, .1);",

	"  float rimLighting = max(min(1.0 - side*dot(normal, light), 1.0),0.0);",

	"	float specular = max(0.0, abs(cosine) - 0.5);", //double sided specular
	"   return vec4(diffuse*color + 0.9*rimLighting*color + 0.4*color2 * specular, rgba.a);",
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
	"vec3 gridLineColor(vec3 color){",
	" vec3 hsv = rgb2hsv(color.xyz);",
	" //hsv.x += 0.1;",
	" if(hsv.z < 0.8){hsv.z += 0.2;}else{hsv.z = 0.85-0.1*hsv.z;hsv.y -= 0.0;}",
	" return hsv2rgb_smooth(hsv);",
	"}",

	"vec4 renderGridlines(vec4 existingColor, vec2 uv, vec4 solidColor) {",
	"  vec2 distToEdge = abs(mod(vUv.xy*gridSquares + lineWidth/2.0,1.0));",
	"  vec3 chosenGridLineColor = mix(gridLineColor(solidColor.xyz), gridColor, useCustomGridColor); ", //use either gridLineColor() or override with custom grid
	"  vec3 blendedGridLine = showSolid * chosenGridLineColor + (1.0-showSolid)*solidColor.xyz;", //if showSolid =0, use solidColor as the gridline color, otherwise shade

	"  if( distToEdge.x < lineWidth || distToEdge.y < lineWidth){",
	"    return mix(existingColor, vec4(blendedGridLine, 1.0),showGrid);",
	"  }",
	"  return existingColor;",
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
	"  vec4 solidColor = vec4(color.rgb, showSolid);",
	"  vec4 solidColorOut = showSolid*getShadedColor(solidColor);",
	"  vec4 colorWithGridlines = renderGridlines(solidColorOut, vUv.xy, solidColor);",
	"  colorWithGridlines.a *= opacity;",
	"  gl_FragColor = colorWithGridlines;",	
	"}"].join("\n");

	var uniforms$1 = {
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

			if(!this.showSolid)this.material.transparent = true;

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
			let positionAttribute = this._geometry.attributes.position;
			let normalAttribute = this._geometry.attributes.normal;
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
					}else{
						//end of the y axis, go backwards for tangents
						b = (i-1) + j * this.itemDimensions[1];
						negationFactor *= -1;
					}

					//c is the index of the point 1 away in the x direction
					if(j < this.itemDimensions[0]-1){
						c = i + (j+1) * this.itemDimensions[1];
					}else{
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

	var explanarianArrowSVG = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjIwMCIKICAgaGVpZ2h0PSIxMzAiCiAgIHZpZXdCb3g9IjAgMCAyMDAgMTMwIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjkxIHIxMzcyNSIKICAgc29kaXBvZGk6ZG9jbmFtZT0iRXhwbGFuYXJpYW5OZXh0QXJyb3cuc3ZnIj4KICA8ZGVmcz4KPHJhZGlhbEdyYWRpZW50IGlkPSJhIiBjeD0iNTAwIiBjeT0iNjI3LjcxIiByPSIyNDIuMzUiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMCAuMjk3MDIgLTMuODM5MSAtMS4xOTMxZS04IDI0MDguMSA4MzguODUpIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiNiYzczMTkiIG9mZnNldD0iMCIvPgo8c3RvcCBzdG9wLWNvbG9yPSIjZjBkMjYzIiBvZmZzZXQ9IjEiLz4KPC9yYWRpYWxHcmFkaWVudD4KPC9kZWZzPgo8bWV0YWRhdGE+CjxyZGY6UkRGPgo8Y2M6V29yayByZGY6YWJvdXQ9IiI+CjxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0Pgo8ZGM6dHlwZSByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIi8+CjxkYzp0aXRsZS8+CjwvY2M6V29yaz4KPC9yZGY6UkRGPgo8L21ldGFkYXRhPgo8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwIC05MjIuMzYpIj4KPHBhdGggZD0ibTE5Ny40NyA5ODcuMzZjMC0yNC4yODEtODcuMjYxLTYxLjcwOC04Ny4yNjEtNjEuNzA4djI5LjY5NGwtMTMuNTYzIDAuMzc5NGMtMTMuNTYzIDAuMzc5MzktNjIuMjAyIDIuODI3MS03NC44MTEgNy45NjU3LTEyLjYwOSA1LjEzODYtMTkuMzAxIDE0LjY5NS0xOS4zMDEgMjMuNjY5IDAgOC45NzM4IDMuOTczNSAxOC4xNjMgMTkuMzAxIDIzLjY2OSAxNS4zMjcgNS41MDU1IDYxLjI0OCA3LjU4NjMgNzQuODExIDcuOTY1N2wxMy41NjMgMC4zNzk0djI5LjY5NHM4Ny4yNjEtMzcuNDI4IDg3LjI2MS02MS43MDh6IiBmaWxsPSJ1cmwoI2EpIiBzdHJva2U9IiM3MzU1M2QiIHN0cm9rZS13aWR0aD0iMi42Mjg1Ii8+CjxnIHRyYW5zZm9ybT0ibWF0cml4KDAgLjI2Mjg1IC0uMjYyODUgMCAxNzguMTMgODYwLjAxKSIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEwIj4KPGVsbGlwc2UgY3g9IjU0Ny4xNCIgY3k9IjEyMC45MyIgcng9IjI1LjcxNCIgcnk9IjUxLjQyOSIgZmlsbD0iI2ZmZiIvPgo8ZWxsaXBzZSBjeD0iNTM0LjM3IiBjeT0iMTIzLjUzIiByeD0iMTIuNjI3IiByeT0iMjYuMjY0Ii8+CjwvZz4KPGcgdHJhbnNmb3JtPSJtYXRyaXgoMCAtLjI2Mjg1IC0uMjYyODUgMCAxNzguNjYgMTExNC43KSIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEwIj4KPGVsbGlwc2UgY3g9IjU0Ny4xNCIgY3k9IjEyMC45MyIgcng9IjI1LjcxNCIgcnk9IjUxLjQyOSIgZmlsbD0iI2ZmZiIvPgo8ZWxsaXBzZSBjeD0iNTM0LjM3IiBjeT0iMTIzLjUzIiByeD0iMTIuNjI3IiByeT0iMjYuMjY0Ii8+CjwvZz4KPC9nPgo8L3N2Zz4K";

	class DirectionArrow{
	    constructor(faceRight){
	        this.arrowImage = new Image();
	        this.arrowImage.src = explanarianArrowSVG;

	        this.arrowImage.classList.add("exp-arrow");

	        faceRight = faceRight===undefined ? true : faceRight;

	        if(faceRight){
	            this.arrowImage.classList.add("exp-arrow-right");
	        }else{
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
	                  default:
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
	              default:
	                break;
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
	                var redoAnimation = new Animation(redoItem.target, redoItem.toValues, redoItem.duration, redoItem.optionalArguments);
	              //and now redoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething
	                break;
	            case NEWSLIDE:
	                break;
	            default:
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
	                    var undoAnimation = new Animation(undoItem.target, undoItem.fromValues, duration, undoItem.optionalArguments);
	                    //and now undoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething
	                    break;
	                case NEWSLIDE:
	                    break;
	                default:
	                    break;
	            }
	    }

	    showArrows(){
	        if(this.currentSlideIndex > 0){
	            this.leftArrow.showSelf();
	        }else{
	            this.leftArrow.hideSelf();
	        }
	        if(this.currentSlideIndex < this.numSlides){
	            this.rightArrow.showSelf();
	        }else{
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

	exports.Transformation = Transformation;
	exports.setupThree = setupThree;
	exports.ThreeasyEnvironment = ThreeasyEnvironment;
	exports.ThreeasyRecorder = ThreeasyRecorder;
	exports.Utils = Utils$1;
	exports.Math = Math$1;
	exports.Array = EXPArray;
	exports.Area = Area;
	exports.HistoryRecorder = HistoryRecorder;
	exports.TransitionTo = TransitionTo;
	exports.Animation = Animation;
	exports.Easing = Easing;
	exports.delay = delay;
	exports.LineOutput = LineOutput;
	exports.PointOutput = PointOutput;
	exports.PointMesh = PointMesh;
	exports.VectorOutput = VectorOutput;
	exports.SurfaceOutput = SurfaceOutput;
	exports.FlatArrayOutput = FlatArrayOutput;
	exports.NonDecreasingDirector = NonDecreasingDirector;
	exports.DirectionArrow = DirectionArrow;
	exports.UndoCapableDirector = UndoCapableDirector;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9IaXN0b3J5UmVjb3JkZXIuanMiLCIuLi9zcmMvanMvVGhyZWVFbnZpcm9ubWVudC5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL291dHB1dHMvTGluZU91dHB1dFNoYWRlcnMuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9MaW5lT3V0cHV0LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvUG9pbnRPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9WZWN0b3JPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9TdXJmYWNlT3V0cHV0U2hhZGVycy5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1N1cmZhY2VPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9GbGF0QXJyYXlPdXRwdXQuanMiLCIuLi9zcmMvanMvRGlyZWN0b3JJbWFnZUNvbnN0YW50cy5qcyIsIi4uL3NyYy9qcy9EaXJlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBUaGUgYmFzZSBjbGFzcyB0aGF0IGV2ZXJ5dGhpbmcgaW5oZXJpdHMgZnJvbS4gXG5cdEVhY2ggdGhpbmcgZHJhd24gdG8gdGhlIHNjcmVlbiBpcyBhIHRyZWUuIERvbWFpbnMsIHN1Y2ggYXMgRVhQLkFyZWEgb3IgRVhQLkFycmF5IGFyZSB0aGUgcm9vdCBub2Rlcyxcblx0RVhQLlRyYW5zZm9ybWF0aW9uIGlzIGN1cnJlbnRseSB0aGUgb25seSBpbnRlcm1lZGlhdGUgbm9kZSwgYW5kIHRoZSBsZWFmIG5vZGVzIGFyZSBzb21lIGZvcm0gb2YgT3V0cHV0IHN1Y2ggYXNcblx0RVhQLkxpbmVPdXRwdXQgb3IgRVhQLlBvaW50T3V0cHV0LCBvciBFWFAuVmVjdG9yT3V0cHV0LlxuXG5cdEFsbCBvZiB0aGVzZSBjYW4gYmUgLmFkZCgpZWQgdG8gZWFjaCBvdGhlciB0byBmb3JtIHRoYXQgdHJlZSwgYW5kIHRoaXMgZmlsZSBkZWZpbmVzIGhvdyBpdCB3b3Jrcy5cbiovXG5cbmNsYXNzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKCl7ICAgICAgICBcblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsOyAgICAgICAgXG4gICAgfVxuXHRhZGQodGhpbmcpe1xuXHRcdC8vY2hhaW5hYmxlIHNvIHlvdSBjYW4gYS5hZGQoYikuYWRkKGMpIHRvIG1ha2UgYS0+Yi0+Y1xuXHRcdHRoaXMuY2hpbGRyZW4ucHVzaCh0aGluZyk7XG5cdFx0dGhpbmcucGFyZW50ID0gdGhpcztcblx0XHRpZih0aGluZy5fb25BZGQpdGhpbmcuX29uQWRkKCk7XG5cdFx0cmV0dXJuIHRoaW5nO1xuXHR9XG5cdF9vbkFkZCgpe31cblx0cmVtb3ZlKHRoaW5nKXtcblx0XHR2YXIgaW5kZXggPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoIHRoaW5nICk7XG5cdFx0aWYgKCBpbmRleCAhPT0gLSAxICkge1xuXHRcdFx0dGhpbmcucGFyZW50ID0gbnVsbDtcblx0XHRcdHRoaXMuY2hpbGRyZW4uc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuICAgIGdldFRvcFBhcmVudCgpeyAvL2ZpbmQgdGhlIHBhcmVudCBvZiB0aGUgcGFyZW50IG9mIHRoZS4uLiB1bnRpbCB0aGVyZSdzIG5vIG1vcmUgcGFyZW50cy5cbiAgICAgICAgY29uc3QgTUFYX0NIQUlOID0gMTAwO1xuICAgICAgICBsZXQgcGFyZW50Q291bnQgPSAwO1xuXHRcdGxldCByb290ID0gdGhpcztcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmIHBhcmVudENvdW50IDwgTUFYX0NIQUlOKXtcblx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcbiAgICAgICAgICAgIHBhcmVudENvdW50Kz0gMTtcblx0XHR9XG5cdFx0aWYocGFyZW50Q291bnQgPj0gTUFYX0NIQUlOKXRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIHRvcC1sZXZlbCBwYXJlbnQhXCIpO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9XG4gICAgZ2V0RGVlcGVzdENoaWxkcmVuKCl7IC8vZmluZCBhbGwgbGVhZiBub2RlcyBmcm9tIHRoaXMgbm9kZVxuICAgICAgICAvL3RoaXMgYWxnb3JpdGhtIGNhbiBwcm9iYWJseSBiZSBpbXByb3ZlZFxuICAgICAgICBpZih0aGlzLmNoaWxkcmVuLmxlbmd0aCA9PSAwKXJldHVybiBbdGhpc107XG5cbiAgICAgICAgbGV0IGNoaWxkcmVuID0gW107XG4gICAgICAgIGZvcihsZXQgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGxldCBjaGlsZHNDaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW5baV0uZ2V0RGVlcGVzdENoaWxkcmVuKCk7XG4gICAgICAgICAgICBmb3IobGV0IGo9MDtqPGNoaWxkc0NoaWxkcmVuLmxlbmd0aDtqKyspe1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goY2hpbGRzQ2hpbGRyZW5bal0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG4gICAgZ2V0Q2xvc2VzdERvbWFpbigpe1xuICAgICAgICAvKiBGaW5kIHRoZSBEb21haW5Ob2RlIHRoYXQgdGhpcyBOb2RlIGlzIGJlaW5nIGNhbGxlZCBmcm9tLlxuICAgICAgICBUcmF2ZXJzZSB0aGUgY2hhaW4gb2YgcGFyZW50cyB1cHdhcmRzIHVudGlsIHdlIGZpbmQgYSBEb21haW5Ob2RlLCBhdCB3aGljaCBwb2ludCB3ZSByZXR1cm4gaXQuXG4gICAgICAgIFRoaXMgYWxsb3dzIGFuIG91dHB1dCB0byByZXNpemUgYW4gYXJyYXkgdG8gbWF0Y2ggYSBkb21haW5Ob2RlJ3MgbnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBmb3IgZXhhbXBsZS5cblxuICAgICAgICBOb3RlIHRoYXQgdGhpcyByZXR1cm5zIHRoZSBNT1NUIFJFQ0VOVCBEb21haW5Ob2RlIGFuY2VzdG9yIC0gaXQncyBhc3N1bWVkIHRoYXQgZG9tYWlubm9kZXMgb3ZlcndyaXRlIG9uZSBhbm90aGVyLlxuICAgICAgICAqL1xuICAgICAgICBjb25zdCBNQVhfQ0hBSU4gPSAxMDA7XG4gICAgICAgIGxldCBwYXJlbnRDb3VudCA9IDA7XG5cdFx0bGV0IHJvb3QgPSB0aGlzLnBhcmVudDsgLy9zdGFydCBvbmUgbGV2ZWwgdXAgaW4gY2FzZSB0aGlzIGlzIGEgRG9tYWluTm9kZSBhbHJlYWR5LiB3ZSBkb24ndCB3YW50IHRoYXRcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmICFyb290LmlzRG9tYWluTm9kZSAmJiBwYXJlbnRDb3VudCA8IE1BWF9DSEFJTil7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG4gICAgICAgICAgICBwYXJlbnRDb3VudCs9IDE7XG5cdFx0fVxuXHRcdGlmKHBhcmVudENvdW50ID49IE1BWF9DSEFJTil0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBwYXJlbnQhXCIpO1xuICAgICAgICBpZihyb290ID09PSBudWxsIHx8ICFyb290LmlzRG9tYWluTm9kZSl0aHJvdyBuZXcgRXJyb3IoXCJObyBEb21haW5Ob2RlIHBhcmVudCBmb3VuZCFcIik7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH1cblxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblx0XHQvL2J1dCBjYWxsIGFsbCBjaGlsZHJlblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0ub25BZnRlckFjdGl2YXRpb24oKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgT3V0cHV0Tm9kZSBleHRlbmRzIE5vZGV7IC8vbW9yZSBvZiBhIGphdmEgaW50ZXJmYWNlLCByZWFsbHlcblx0Y29uc3RydWN0b3IoKXtzdXBlcigpO31cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope31cblx0b25BZnRlckFjdGl2YXRpb24oKXt9XG5cdF9vbkFkZCgpe31cbn1cblxuY2xhc3MgRG9tYWluTm9kZSBleHRlbmRzIE5vZGV7IC8vQSBub2RlIHRoYXQgY2FsbHMgb3RoZXIgZnVuY3Rpb25zIG92ZXIgc29tZSByYW5nZS5cblx0Y29uc3RydWN0b3IoKXtcbiAgICAgICAgc3VwZXIoKTtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSBudWxsOyAvLyBudW1iZXIgb2YgdGltZXMgYW55IGNoaWxkIG5vZGUncyBldmFsdWF0ZVNlbGYoKSBpcyBjYWxsZWRcbiAgICB9XG4gICAgYWN0aXZhdGUodCl7fVxufVxuRG9tYWluTm9kZS5wcm90b3R5cGUuaXNEb21haW5Ob2RlID0gdHJ1ZTtcblxuZXhwb3J0IGRlZmF1bHQgTm9kZTtcbmV4cG9ydCB7T3V0cHV0Tm9kZSwgRG9tYWluTm9kZX07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9ICBmcm9tICcuL05vZGUuanMnO1xuY2xhc3MgRVhQQXJyYXkgZXh0ZW5kcyBEb21haW5Ob2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHRzdXBlcigpO1xuXHRcdC8qdmFyIHBvaW50cyA9IG5ldyBFWFAuQXJyYXkoe1xuXHRcdGRhdGE6IFtbLTEwLDEwXSxcblx0XHRcdFsxMCwxMF1dXG5cdFx0fSkqL1xuXG5cdFx0RVhQLlV0aWxzLmFzc2VydFByb3BFeGlzdHMob3B0aW9ucywgXCJkYXRhXCIpOyAvLyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXkuIGFzc3VtZWQgdG8gb25seSBjb250YWluIG9uZSB0eXBlOiBlaXRoZXIgbnVtYmVycyBvciBhcnJheXNcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmRhdGEsIEFycmF5KTtcblxuXHRcdC8vSXQncyBhc3N1bWVkIGFuIEVYUC5BcnJheSB3aWxsIG9ubHkgc3RvcmUgdGhpbmdzIHN1Y2ggYXMgMCwgWzBdLCBbMCwwXSBvciBbMCwwLDBdLiBJZiBhbiBhcnJheSB0eXBlIGlzIHN0b3JlZCwgdGhpcy5hcnJheVR5cGVEaW1lbnNpb25zIGNvbnRhaW5zIHRoZSAubGVuZ3RoIG9mIHRoYXQgYXJyYXkuIE90aGVyd2lzZSBpdCdzIDAsIGJlY2F1c2UgcG9pbnRzIGFyZSAwLWRpbWVuc2lvbmFsLlxuXHRcdGlmKG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3RvciA9PT0gTnVtYmVyKXtcblx0XHRcdHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyA9IDA7XG5cdFx0fWVsc2UgaWYob3B0aW9ucy5kYXRhWzBdLmNvbnN0cnVjdG9yID09PSBBcnJheSl7XG5cdFx0XHR0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPSBvcHRpb25zLmRhdGFbMF0ubGVuZ3RoO1xuXHRcdH1lbHNle1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkRhdGEgaW4gYW4gRVhQLkFycmF5IHNob3VsZCBiZSBhIG51bWJlciBvciBhbiBhcnJheSBvZiBvdGhlciB0aGluZ3MsIG5vdCBcIiArIG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3Rvcik7XG5cdFx0fVxuXG5cblx0XHRFWFAuVXRpbHMuYXNzZXJ0KG9wdGlvbnMuZGF0YVswXS5sZW5ndGggIT0gMCk7IC8vZG9uJ3QgYWNjZXB0IFtbXV0sIGRhdGEgbmVlZHMgdG8gYmUgc29tZXRoaW5nIGxpa2UgW1sxLDJdXS5cblxuXHRcdHRoaXMuZGF0YSA9IG9wdGlvbnMuZGF0YTtcblx0XHR0aGlzLm51bUl0ZW1zID0gdGhpcy5kYXRhLmxlbmd0aDtcblxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbdGhpcy5kYXRhLmxlbmd0aF07IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdC8vdGhlIG51bWJlciBvZiB0aW1lcyBldmVyeSBjaGlsZCdzIGV4cHIgaXMgY2FsbGVkXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSB0aGlzLml0ZW1EaW1lbnNpb25zLnJlZHVjZSgoc3VtLHkpPT5zdW0qeSk7XG5cdH1cblx0YWN0aXZhdGUodCl7XG5cdFx0aWYodGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID09IDApe1xuXHRcdFx0Ly9udW1iZXJzIGNhbid0IGJlIHNwcmVhZCB1c2luZyAuLi4gb3BlcmF0b3Jcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5kYXRhLmxlbmd0aDtpKyspe1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaSx0LHRoaXMuZGF0YVtpXSk7XG5cdFx0XHR9XG5cdFx0fWVsc2V7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuZGF0YS5sZW5ndGg7aSsrKXtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGksdCwuLi50aGlzLmRhdGFbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMub25BZnRlckFjdGl2YXRpb24oKTsgLy8gY2FsbCBjaGlsZHJlbiBpZiBuZWNlc3Nhcnlcblx0fVxuXHRfY2FsbEFsbENoaWxkcmVuKC4uLmNvb3JkaW5hdGVzKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcylcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgY2xvbmUgPSBuZXcgRVhQLkFycmF5KHtkYXRhOiBFWFAuVXRpbHMuYXJyYXlDb3B5KHRoaXMuZGF0YSl9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RBcnJheSgpe1xuXHR2YXIgeCA9IG5ldyBFWFAuQXJyYXkoe2RhdGE6IFtbMCwxXSxbMCwxXV19KTtcblx0dmFyIHkgPSBuZXcgRVhQLlRyYW5zZm9ybWF0aW9uKHtleHByOiBmdW5jdGlvbiguLi5hKXtjb25zb2xlLmxvZyguLi5hKTsgcmV0dXJuIFsyXX19KTtcblx0eC5hZGQoeSk7XG5cdHguYWN0aXZhdGUoNTEyKTtcbn1cblxuZXhwb3J0IHtFWFBBcnJheSBhcyBBcnJheX07XG4iLCJmdW5jdGlvbiBtdWx0aXBseVNjYWxhcihjLCBhcnJheSl7XG5cdGZvcih2YXIgaT0wO2k8YXJyYXkubGVuZ3RoO2krKyl7XG5cdFx0YXJyYXlbaV0gKj0gYztcblx0fVxuXHRyZXR1cm4gYXJyYXlcbn1cbmZ1bmN0aW9uIHZlY3RvckFkZCh2MSx2Mil7XG4gICAgbGV0IHZlYyA9IGNsb25lKHYxKTtcblx0Zm9yKHZhciBpPTA7aTx2MS5sZW5ndGg7aSsrKXtcblx0XHR2ZWNbaV0gKz0gdjJbaV07XG5cdH1cblx0cmV0dXJuIHZlY1xufVxuZnVuY3Rpb24gdmVjdG9yU3ViKHYxLHYyKXtcbiAgICBsZXQgdmVjID0gY2xvbmUodjEpO1xuXHRmb3IodmFyIGk9MDtpPHYxLmxlbmd0aDtpKyspe1xuXHRcdHZlY1tpXSArPSB2MltpXTtcblx0fVxuXHRyZXR1cm4gdmVjXG59XG5mdW5jdGlvbiBsZXJwVmVjdG9ycyh0LCBwMSwgcDIpe1xuXHQvL2Fzc3VtZWQgdCBpbiBbMCwxXVxuXHRyZXR1cm4gdmVjdG9yQWRkKG11bHRpcGx5U2NhbGFyKHQsY2xvbmUocDEpKSxtdWx0aXBseVNjYWxhcigxLXQsY2xvbmUocDIpKSk7XG59XG5mdW5jdGlvbiBjbG9uZSh2ZWMpe1xuXHR2YXIgbmV3QXJyID0gbmV3IEFycmF5KHZlYy5sZW5ndGgpO1xuXHRmb3IodmFyIGk9MDtpPHZlYy5sZW5ndGg7aSsrKXtcblx0XHRuZXdBcnJbaV0gPSB2ZWNbaV07XG5cdH1cblx0cmV0dXJuIG5ld0FyclxufVxuZnVuY3Rpb24gbXVsdGlwbHlNYXRyaXgodmVjLCBtYXRyaXgpe1xuXHQvL2Fzc2VydCB2ZWMubGVuZ3RoID09IG51bVJvd3NcblxuXHRsZXQgbnVtUm93cyA9IG1hdHJpeC5sZW5ndGg7XG5cdGxldCBudW1Db2xzID0gbWF0cml4WzBdLmxlbmd0aDtcblxuXHR2YXIgb3V0cHV0ID0gbmV3IEFycmF5KG51bUNvbHMpO1xuXHRmb3IodmFyIGo9MDtqPG51bUNvbHM7aisrKXtcblx0XHRvdXRwdXRbal0gPSAwO1xuXHRcdGZvcih2YXIgaT0wO2k8bnVtUm93cztpKyspe1xuXHRcdFx0b3V0cHV0W2pdICs9IG1hdHJpeFtpXVtqXSAqIHZlY1tpXTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIG91dHB1dDtcbn1cblxuLy9oYWNrXG5sZXQgTWF0aCA9IHtjbG9uZTogY2xvbmUsIGxlcnBWZWN0b3JzOiBsZXJwVmVjdG9ycywgdmVjdG9yQWRkOiB2ZWN0b3JBZGQsIHZlY3RvclN1YjogdmVjdG9yU3ViLCBtdWx0aXBseVNjYWxhcjogbXVsdGlwbHlTY2FsYXIsIG11bHRpcGx5TWF0cml4OiBtdWx0aXBseU1hdHJpeH07XG5cbmV4cG9ydCB7dmVjdG9yQWRkLCB2ZWN0b3JTdWIsIGxlcnBWZWN0b3JzLCBjbG9uZSwgbXVsdGlwbHlTY2FsYXIsIG11bHRpcGx5TWF0cml4LCBNYXRofTtcbiIsImltcG9ydCB7Y2xvbmV9IGZyb20gJy4vbWF0aC5qcydcblxuY2xhc3MgVXRpbHN7XG5cblx0c3RhdGljIGlzQXJyYXkoeCl7XG4gICAgICAgIGlmKHggPT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gQXJyYXk7XG5cdH1cblx0c3RhdGljIGlzT2JqZWN0KHgpe1xuICAgICAgICBpZih4ID09PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cdFx0cmV0dXJuIHguY29uc3RydWN0b3IgPT09IE9iamVjdDtcblx0fVxuXHRzdGF0aWMgYXJyYXlDb3B5KHgpe1xuXHRcdHJldHVybiB4LnNsaWNlKCk7XG5cdH1cblx0c3RhdGljIGlzRnVuY3Rpb24oeCl7XG4gICAgICAgIGlmKHggPT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gRnVuY3Rpb247XG5cdH1cblx0c3RhdGljIGlzTnVtYmVyKHgpe1xuICAgICAgICBpZih4ID09PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cdFx0cmV0dXJuIHguY29uc3RydWN0b3IgPT09IE51bWJlcjtcblx0fVxuXG5cdHN0YXRpYyBhc3NlcnQodGhpbmcpe1xuXHRcdC8vQSBmdW5jdGlvbiB0byBjaGVjayBpZiBzb21ldGhpbmcgaXMgdHJ1ZSBhbmQgaGFsdCBvdGhlcndpc2UgaW4gYSBjYWxsYmFja2FibGUgd2F5LlxuXHRcdGlmKCF0aGluZyl7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIEFzc2VydGlvbiBmYWlsZWQuIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuXHRcdH1cblx0fVxuXG5cdHN0YXRpYyBhc3NlcnRUeXBlKHRoaW5nLCB0eXBlLCBlcnJvck1zZyl7XG5cdFx0Ly9BIGZ1bmN0aW9uIHRvIGNoZWNrIGlmIHNvbWV0aGluZyBpcyB0cnVlIGFuZCBoYWx0IG90aGVyd2lzZSBpbiBhIGNhbGxiYWNrYWJsZSB3YXkuXG5cdFx0aWYoISh0aGluZy5jb25zdHJ1Y3RvciA9PT0gdHlwZSkpe1xuXHRcdFx0aWYoZXJyb3JNc2cpe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFNvbWV0aGluZyBub3Qgb2YgcmVxdWlyZWQgdHlwZSBcIit0eXBlLm5hbWUrXCIhIFxcblwiK2Vycm9yTXNnK1wiXFxuIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdFx0fWVsc2V7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgU29tZXRoaW5nIG5vdCBvZiByZXF1aXJlZCB0eXBlIFwiK3R5cGUubmFtZStcIiEgU2VlIHRyYWNlYmFjayBmb3IgbW9yZS5cIik7XG5cdFx0XHR9XG4gICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG5cdFx0fVxuXHR9XG5cblxuXHRzdGF0aWMgYXNzZXJ0UHJvcEV4aXN0cyh0aGluZywgbmFtZSl7XG5cdFx0aWYoIXRoaW5nIHx8ICEobmFtZSBpbiB0aGluZykpe1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBcIituYW1lK1wiIG5vdCBwcmVzZW50IGluIHJlcXVpcmVkIHByb3BlcnR5XCIpO1xuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuXHRcdH1cblx0fVxuXHRcblx0c3RhdGljIGNsb25lKHZlYyl7XG5cdFx0cmV0dXJuIGNsb25lKHZlYyk7XG5cdH1cblxuXG5cdHN0YXRpYyBpczFETnVtZXJpY0FycmF5KHZlYyl7XG4gICAgICAgIGlmKCFVdGlscy5pc0FycmF5KHZlYykpIHJldHVybiBmYWxzZTtcbiAgICAgICAgZm9yKGxldCBpPTA7aTx2ZWMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICBpZighVXRpbHMuaXNOdW1iZXIodmVjW2ldKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuXHR9XG5cbn1cblxuZXhwb3J0IHtVdGlsc307XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7IERvbWFpbk5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuXG5jbGFzcyBBcmVhIGV4dGVuZHMgRG9tYWluTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8qdmFyIGF4ZXMgPSBuZXcgRVhQLkFyZWEoe1xuXHRcdGJvdW5kczogW1stMTAsMTBdLFxuXHRcdFx0WzEwLDEwXV1cblx0XHRudW1JdGVtczogMTA7IC8vb3B0aW9uYWwuIEFsdGVybmF0ZWx5IG51bUl0ZW1zIGNhbiB2YXJ5IGZvciBlYWNoIGF4aXM6IG51bUl0ZW1zOiBbMTAsMl1cblx0XHR9KSovXG5cblxuXHRcblx0XHRVdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiYm91bmRzXCIpOyAvLyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXlcblx0XHRVdGlscy5hc3NlcnRUeXBlKG9wdGlvbnMuYm91bmRzLCBBcnJheSk7XG5cdFx0VXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmJvdW5kc1swXSwgQXJyYXksIFwiRm9yIGFuIEFyZWEsIG9wdGlvbnMuYm91bmRzIG11c3QgYmUgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LCBldmVuIGZvciBvbmUgZGltZW5zaW9uIVwiKTsgLy8gaXQgTVVTVCBiZSBtdWx0aWRpbWVuc2lvbmFsXG5cdFx0dGhpcy5udW1EaW1lbnNpb25zID0gb3B0aW9ucy5ib3VuZHMubGVuZ3RoO1xuXG5cdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMuYm91bmRzWzBdLmxlbmd0aCAhPSAwKTsgLy9kb24ndCBhY2NlcHQgW1tdXSwgaXQgbmVlZHMgdG8gYmUgW1sxLDJdXS5cblxuXHRcdHRoaXMuYm91bmRzID0gb3B0aW9ucy5ib3VuZHM7XG5cdFx0dGhpcy5udW1JdGVtcyA9IG9wdGlvbnMubnVtSXRlbXMgfHwgMTY7XG5cblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdGlmKHRoaXMubnVtSXRlbXMuY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtRGltZW5zaW9ucztpKyspe1xuXHRcdFx0XHR0aGlzLml0ZW1EaW1lbnNpb25zLnB1c2godGhpcy5udW1JdGVtcyk7XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1JdGVtcy5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMubnVtSXRlbXMubGVuZ3RoID09IG9wdGlvbnMuYm91bmRzLmxlbmd0aCk7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtRGltZW5zaW9ucztpKyspe1xuXHRcdFx0XHR0aGlzLml0ZW1EaW1lbnNpb25zLnB1c2godGhpcy5udW1JdGVtc1tpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIHRpbWVzIGV2ZXJ5IGNoaWxkJ3MgZXhwciBpcyBjYWxsZWRcblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHRoaXMuaXRlbURpbWVuc2lvbnMucmVkdWNlKChzdW0seSk9PnN1bSp5KTtcblx0fVxuXHRhY3RpdmF0ZSh0KXtcblx0XHQvL1VzZSB0aGlzIHRvIGV2YWx1YXRlIGV4cHIoKSBhbmQgdXBkYXRlIHRoZSByZXN1bHQsIGNhc2NhZGUtc3R5bGUuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIGJvdW5kcyB0aGlzIG9iamVjdCBoYXMgd2lsbCBiZSB0aGUgbnVtYmVyIG9mIGRpbWVuc2lvbnMuXG5cdFx0Ly90aGUgZXhwcigpcyBhcmUgY2FsbGVkIHdpdGggZXhwcihpLCAuLi5bY29vcmRpbmF0ZXNdLCB0KSwgXG5cdFx0Ly9cdCh3aGVyZSBpIGlzIHRoZSBpbmRleCBvZiB0aGUgY3VycmVudCBldmFsdWF0aW9uID0gdGltZXMgZXhwcigpIGhhcyBiZWVuIGNhbGxlZCB0aGlzIGZyYW1lLCB0ID0gYWJzb2x1dGUgdGltZXN0ZXAgKHMpKS5cblx0XHQvL3BsZWFzZSBjYWxsIHdpdGggYSB0IHZhbHVlIG9idGFpbmVkIGZyb20gcGVyZm9ybWFuY2Uubm93KCkvMTAwMCBvciBzb21ldGhpbmcgbGlrZSB0aGF0XG5cblx0XHQvL25vdGUgdGhlIGxlc3MtdGhhbi1vci1lcXVhbC10byBpbiB0aGVzZSBsb29wc1xuXHRcdGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAxKXtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRsZXQgaW5kZXggPSBpO1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSwwLDAsMCk7XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1EaW1lbnNpb25zID09IDIpe1xuXHRcdFx0Ly90aGlzIGNhbiBiZSByZWR1Y2VkIGludG8gYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIG92ZXIgdGhlIGZpcnN0IGluZGV4IG9mIHRoaXMuYm91bmRzLCBJIGtub3cgaXRcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRmb3IodmFyIGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aisrKXtcblx0XHRcdFx0XHRsZXQgYzIgPSB0aGlzLmJvdW5kc1sxXVswXSArICh0aGlzLmJvdW5kc1sxXVsxXS10aGlzLmJvdW5kc1sxXVswXSkqKGovKHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSkpO1xuXHRcdFx0XHRcdGxldCBpbmRleCA9IGkqdGhpcy5pdGVtRGltZW5zaW9uc1sxXSArIGo7XG5cdFx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsYzIsMCwwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAzKXtcblx0XHRcdC8vdGhpcyBjYW4gYmUgcmVkdWNlZCBpbnRvIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSBvdmVyIHRoZSBmaXJzdCBpbmRleCBvZiB0aGlzLmJvdW5kcywgSSBrbm93IGl0XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0Zm9yKHZhciBqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzFdO2orKyl7XG5cdFx0XHRcdFx0bGV0IGMyID0gdGhpcy5ib3VuZHNbMV1bMF0gKyAodGhpcy5ib3VuZHNbMV1bMV0tdGhpcy5ib3VuZHNbMV1bMF0pKihqLyh0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTEpKTtcblx0XHRcdFx0XHRmb3IodmFyIGs9MDtrPHRoaXMuaXRlbURpbWVuc2lvbnNbMl07aysrKXtcblx0XHRcdFx0XHRcdGxldCBjMyA9IHRoaXMuYm91bmRzWzJdWzBdICsgKHRoaXMuYm91bmRzWzJdWzFdLXRoaXMuYm91bmRzWzJdWzBdKSooay8odGhpcy5pdGVtRGltZW5zaW9uc1syXS0xKSk7XG5cdFx0XHRcdFx0XHRsZXQgaW5kZXggPSAoaSp0aGlzLml0ZW1EaW1lbnNpb25zWzFdICsgaikqdGhpcy5pdGVtRGltZW5zaW9uc1syXSArIGs7XG5cdFx0XHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSxjMixjMywwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ZWxzZXtcblx0XHRcdGFzc2VydChcIlRPRE86IFVzZSBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgdG8gbG9vcCBvdmVyIGFsbCBpbmRpY2VzIVwiKTtcblx0XHR9XG5cblx0XHR0aGlzLm9uQWZ0ZXJBY3RpdmF0aW9uKCk7IC8vIGNhbGwgY2hpbGRyZW4gaWYgbmVjZXNzYXJ5XG5cdH1cblx0X2NhbGxBbGxDaGlsZHJlbiguLi5jb29yZGluYXRlcyl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpXG5cdFx0fVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEFyZWEoe2JvdW5kczogVXRpbHMuYXJyYXlDb3B5KHRoaXMuYm91bmRzKSwgbnVtSXRlbXM6IHRoaXMubnVtSXRlbXN9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHRcdGlmKGNsb25lLmNoaWxkcmVuW2ldLl9vbkFkZCljbG9uZS5jaGlsZHJlbltpXS5fb25BZGQoKTsgLy8gbmVjZXNzYXJ5IG5vdyB0aGF0IHRoZSBjaGFpbiBvZiBhZGRpbmcgaGFzIGJlZW4gZXN0YWJsaXNoZWRcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RBcmVhKCl7XG5cdHZhciB4ID0gbmV3IEFyZWEoe2JvdW5kczogW1swLDFdLFswLDFdXX0pO1xuXHR2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSl9fSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKCk7XG59XG5cbmV4cG9ydCB7IEFyZWEgfVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCBOb2RlIGZyb20gJy4vTm9kZS5qcyc7XG5cbi8vVXNhZ2U6IHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiBmdW5jdGlvbiguLi5hKXtjb25zb2xlLmxvZyguLi5hKX19KTtcbmNsYXNzIFRyYW5zZm9ybWF0aW9uIGV4dGVuZHMgTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblx0XG5cdFx0RVhQLlV0aWxzLmFzc2VydFByb3BFeGlzdHMob3B0aW9ucywgXCJleHByXCIpOyAvLyBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXlcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmV4cHIsIEZ1bmN0aW9uKTtcblxuXHRcdHRoaXMuZXhwciA9IG9wdGlvbnMuZXhwcjtcblx0fVxuXHRldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpe1xuXHRcdC8vZXZhbHVhdGUgdGhpcyBUcmFuc2Zvcm1hdGlvbidzIF9leHByLCBhbmQgYnJvYWRjYXN0IHRoZSByZXN1bHQgdG8gYWxsIGNoaWxkcmVuLlxuXHRcdGxldCByZXN1bHQgPSB0aGlzLmV4cHIoLi4uY29vcmRpbmF0ZXMpO1xuXHRcdGlmKHJlc3VsdC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpcmVzdWx0ID0gW3Jlc3VsdF07XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZihjb29yZGluYXRlc1swXSxjb29yZGluYXRlc1sxXSwgLi4ucmVzdWx0KVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCB0aGlzRXhwciA9IHRoaXMuZXhwcjtcblx0XHRsZXQgY2xvbmUgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IHRoaXNFeHByLmJpbmQoKX0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cblx0bWFrZUxpbmsoKXtcbiAgICAgICAgLy9saWtlIGEgY2xvbmUsIGJ1dCB3aWxsIHVzZSB0aGUgc2FtZSBleHByIGFzIHRoaXMgVHJhbnNmb3JtYXRpb24uXG4gICAgICAgIC8vdXNlZnVsIGlmIHRoZXJlJ3MgYSBzcGVjaWZpYyBmdW5jdGlvbiB0aGF0IG5lZWRzIHRvIGJlIHVzZWQgYnkgYSBidW5jaCBvZiBvYmplY3RzXG5cdFx0cmV0dXJuIG5ldyBMaW5rZWRUcmFuc2Zvcm1hdGlvbih0aGlzKTtcblx0fVxufVxuXG5jbGFzcyBMaW5rZWRUcmFuc2Zvcm1hdGlvbiBleHRlbmRzIE5vZGV7XG4gICAgLypcbiAgICAgICAgTGlrZSBhbiBFWFAuVHJhbnNmb3JtYXRpb24sIGJ1dCBpdCB1c2VzIGFuIGV4aXN0aW5nIEVYUC5UcmFuc2Zvcm1hdGlvbidzIGV4cHIoKSwgc28gaWYgdGhlIGxpbmtlZCB0cmFuc2Zvcm1hdGlvbiB1cGRhdGVzLCBzbyBkb2VzIHRoaXMgb25lLiBJdCdzIGxpa2UgYSBwb2ludGVyIHRvIGEgVHJhbnNmb3JtYXRpb24sIGJ1dCBpbiBvYmplY3QgZm9ybS4gXG4gICAgKi9cblx0Y29uc3RydWN0b3IodHJhbnNmb3JtYXRpb25Ub0xpbmtUbyl7XG5cdFx0c3VwZXIoe30pO1xuXHRcdEVYUC5VdGlscy5hc3NlcnRUeXBlKHRyYW5zZm9ybWF0aW9uVG9MaW5rVG8sIFRyYW5zZm9ybWF0aW9uKTtcbiAgICAgICAgdGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUgPSB0cmFuc2Zvcm1hdGlvblRvTGlua1RvO1xuXHR9XG5cdGV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcyl7XG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlLmV4cHIoLi4uY29vcmRpbmF0ZXMpO1xuXHRcdGlmKHJlc3VsdC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpcmVzdWx0ID0gW3Jlc3VsdF07XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZihjb29yZGluYXRlc1swXSxjb29yZGluYXRlc1sxXSwgLi4ucmVzdWx0KVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBMaW5rZWRUcmFuc2Zvcm1hdGlvbih0aGlzLmxpbmtlZFRyYW5zZm9ybWF0aW9uTm9kZSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxuXHRtYWtlTGluaygpe1xuXHRcdHJldHVybiBuZXcgTGlua2VkVHJhbnNmb3JtYXRpb24odGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUpO1xuXHR9XG59XG5cblxuXG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RUcmFuc2Zvcm1hdGlvbigpe1xuXHR2YXIgeCA9IG5ldyBBcmVhKHtib3VuZHM6IFtbLTEwLDEwXV19KTtcblx0dmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oeydleHByJzogKHgpID0+IGNvbnNvbGUubG9nKHgqeCl9KTtcblx0eC5hZGQoeSk7XG5cdHguYWN0aXZhdGUoKTsgLy8gc2hvdWxkIHJldHVybiAxMDAsIDgxLCA2NC4uLiAwLCAxLCA0Li4uIDEwMFxufVxuXG5leHBvcnQgeyBUcmFuc2Zvcm1hdGlvbiwgTGlua2VkVHJhbnNmb3JtYXRpb259XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5cbmNsYXNzIEhpc3RvcnlSZWNvcmRlciBleHRlbmRzIERvbWFpbk5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIENsYXNzIHRoYXQgcmVjb3JkcyB0aGUgbGFzdCBmZXcgdmFsdWVzIG9mIHRoZSBwYXJlbnQgVHJhbnNmb3JtYXRpb24gYW5kIG1ha2VzIHRoZW0gYXZhaWxhYmxlIGZvciB1c2UgYXMgYW4gZXh0cmEgZGltZW5zaW9uLlxuICAgICAgICAgICAgVXNhZ2U6XG4gICAgICAgICAgICB2YXIgcmVjb3JkZXIgPSBuZXcgSGlzdG9yeVJlY29yZGVyKHtcbiAgICAgICAgICAgICAgICBtZW1vcnlMZW5ndGg6IDEwIC8vIGhvdyBtYW55IHBhc3QgdmFsdWVzIHRvIHN0b3JlP1xuICAgICAgICAgICAgICAgIHJlY29yZEZyYW1lSW50ZXJ2YWw6IDE1Ly9Ib3cgbG9uZyB0byB3YWl0IGJldHdlZW4gZWFjaCBjYXB0dXJlPyBNZWFzdXJlZCBpbiBmcmFtZXMsIHNvIDYwID0gMSBjYXB0dXJlIHBlciBzZWNvbmQsIDMwID0gMiBjYXB0dXJlcy9zZWNvbmQsIGV0Yy5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBleGFtcGxlIHVzYWdlOlxuICAgICAgICAgICAgbmV3IEFyZWEoe2JvdW5kczogW1stNSw1XV19KS5hZGQobmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiAoaSx0LHgpID0+IFtNYXRoLnNpbih4KSxNYXRoLmNvcyh4KV19KSkuYWRkKG5ldyBFWFAuSGlzdG9yeVJlY29yZGVyKHttZW1vcnlMZW5ndGg6IDV9KS5hZGQobmV3IExpbmVPdXRwdXQoe3dpZHRoOiA1LCBjb2xvcjogMHhmZjAwMDB9KSk7XG5cbiAgICAgICAgICAgIE5PVEU6IEl0IGlzIGFzc3VtZWQgdGhhdCBhbnkgcGFyZW50IHRyYW5zZm9ybWF0aW9uIG91dHB1dHMgYW4gYXJyYXkgb2YgbnVtYmVycyB0aGF0IGlzIDQgb3IgbGVzcyBpbiBsZW5ndGguXG4gICAgICAgICovXG5cblx0XHR0aGlzLm1lbW9yeUxlbmd0aCA9IG9wdGlvbnMubWVtb3J5TGVuZ3RoID09PSB1bmRlZmluZWQgPyAxMCA6IG9wdGlvbnMubWVtb3J5TGVuZ3RoO1xuICAgICAgICB0aGlzLnJlY29yZEZyYW1lSW50ZXJ2YWwgPSBvcHRpb25zLnJlY29yZEZyYW1lSW50ZXJ2YWwgPT09IHVuZGVmaW5lZCA/IDE1IDogb3B0aW9ucy5yZWNvcmRGcmFtZUludGVydmFsOyAvL3NldCB0byAxIHRvIHJlY29yZCBldmVyeSBmcmFtZS5cbiAgICAgICAgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDQ7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/ICh0b2RvOiBhdXRvZGV0ZWN0IHRoaXMgZnJvbSBwYXJlbnQncyBvdXRwdXQpXG5cdFx0dGhpcy5jdXJyZW50SGlzdG9yeUluZGV4PTA7XG4gICAgICAgIHRoaXMuZnJhbWVSZWNvcmRUaW1lciA9IDA7XG5cdH1cblx0X29uQWRkKCl7XG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIEFyZWFcblx0XHRsZXQgcm9vdCA9IHRoaXMuZ2V0Q2xvc2VzdERvbWFpbigpO1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIHRoaXMubWVtb3J5TGVuZ3RoO1xuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSByb290Lml0ZW1EaW1lbnNpb25zLmNvbmNhdChbdGhpcy5tZW1vcnlMZW5ndGhdKTtcblxuICAgICAgICB0aGlzLmJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcbiAgICBcbiAgICAgICAgLy9UaGlzIGlzIHNvIHRoYXQgbm8gc3VyZmFjZS9ib3VuZGFyeSB3aWxsIGFwcGVhciB1bnRpbCBoaXN0b3J5IGJlZ2lucyB0byBiZSByZWNvcmRlZC4gSSdtIHNvIHNvcnJ5LlxuICAgICAgICAvL1RvZG86IHByb3BlciBjbGlwIHNoYWRlciBsaWtlIG1hdGhib3ggZG9lcyBvciBzb21ldGhpbmcuXG4gICAgICAgIHRoaXMuYnVmZmVyLmZpbGwoTmFOKTsgXG5cdH1cbiAgICBvbkFmdGVyQWN0aXZhdGlvbigpe1xuICAgICAgICBzdXBlci5vbkFmdGVyQWN0aXZhdGlvbigpO1xuXG4gICAgICAgIC8vZXZlcnkgc28gb2Z0ZW4sIHNoaWZ0IHRvIHRoZSBuZXh0IGJ1ZmZlciBzbG90XG4gICAgICAgIHRoaXMuZnJhbWVSZWNvcmRUaW1lciArPSAxO1xuICAgICAgICBpZih0aGlzLmZyYW1lUmVjb3JkVGltZXIgPj0gdGhpcy5yZWNvcmRGcmFtZUludGVydmFsKXtcbiAgICAgICAgICAgIC8vcmVzZXQgZnJhbWUgcmVjb3JkIHRpbWVyXG4gICAgICAgICAgICB0aGlzLmZyYW1lUmVjb3JkVGltZXIgPSAwO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4ID0gKHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCsxKSV0aGlzLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgfVxuICAgIH1cblx0ZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKXtcblx0XHQvL2V2YWx1YXRlIHRoaXMgVHJhbnNmb3JtYXRpb24ncyBfZXhwciwgYW5kIGJyb2FkY2FzdCB0aGUgcmVzdWx0IHRvIGFsbCBjaGlsZHJlbi5cblx0XHRsZXQgaSA9IGNvb3JkaW5hdGVzWzBdO1xuXHRcdGxldCB0ID0gY29vcmRpbmF0ZXNbMV07XG4gICAgXG4gICAgICAgIC8vc3RlcCAxOiBzYXZlIGNvb3JkaW5hdGVzIGZvciB0aGlzIGZyYW1lIGluIGJ1ZmZlclxuICAgICAgICBpZihjb29yZGluYXRlcy5sZW5ndGggPiAyK3RoaXMuX291dHB1dERpbWVuc2lvbnMpe1xuICAgICAgICAgICAgLy90b2RvOiBtYWtlIHRoaXMgdXBkYXRlIHRoaXMuX291dHB1dERpbWVuc2lvbnMgYW5kIHJlYWxsb2NhdGUgbW9yZSBidWZmZXIgc3BhY2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVYUC5IaXN0b3J5UmVjb3JkZXIgaXMgdW5hYmxlIHRvIHJlY29yZCBoaXN0b3J5IG9mIHNvbWV0aGluZyB0aGF0IG91dHB1dHMgaW4gXCIrdGhpcy5fb3V0cHV0RGltZW5zaW9ucytcIiBkaW1lbnNpb25zISBZZXQuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGN5Y2xpY0J1ZmZlckluZGV4ID0gKGkqdGhpcy5tZW1vcnlMZW5ndGgrdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4KSp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuICAgICAgICBmb3IodmFyIGo9MDtqPGNvb3JkaW5hdGVzLmxlbmd0aC0yO2orKyl7IFxuICAgICAgICAgICAgdGhpcy5idWZmZXJbY3ljbGljQnVmZmVySW5kZXgral0gPSBjb29yZGluYXRlc1syK2pdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9zdGVwIDI6LCBjYWxsIGFueSBjaGlsZHJlbiBvbmNlIHBlciBoaXN0b3J5IGl0ZW1cbiAgICAgICAgZm9yKHZhciBjaGlsZE5vPTA7Y2hpbGRObzx0aGlzLmNoaWxkcmVuLmxlbmd0aDtjaGlsZE5vKyspe1xuXHRcdCAgICBmb3IodmFyIGo9MDtqPHRoaXMubWVtb3J5TGVuZ3RoO2orKyl7XG5cbiAgICAgICAgICAgICAgICAvL3RoZSArMSBpbiAoaiArIHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCArIDEpIGlzIGltcG9ydGFudDsgd2l0aG91dCBpdCwgYSBMaW5lT3V0cHV0IHdpbGwgZHJhdyBhIGxpbmUgZnJvbSB0aGUgbW9zdCByZWNlbnQgdmFsdWUgdG8gdGhlIGVuZCBvZiBoaXN0b3J5XG4gICAgICAgICAgICAgICAgbGV0IGN5Y2xpY0hpc3RvcnlWYWx1ZSA9IChqICsgdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4ICsgMSkgJSB0aGlzLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgICAgICAgICBsZXQgY3ljbGljQnVmZmVySW5kZXggPSAoaSAqIHRoaXMubWVtb3J5TGVuZ3RoICsgY3ljbGljSGlzdG9yeVZhbHVlKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuICAgICAgICAgICAgICAgIGxldCBub25DeWNsaWNJbmRleCA9IGkgKiB0aGlzLm1lbW9yeUxlbmd0aCArIGo7XG5cblx0XHQgICAgICAgIC8vSSdtIHRvcm4gb24gd2hldGhlciB0byBhZGQgYSBmaW5hbCBjb29yZGluYXRlIGF0IHRoZSBlbmQgc28gaGlzdG9yeSBjYW4gZ28gb2ZmIGluIGEgbmV3IGRpcmVjdGlvbi5cbiAgICAgICAgICAgICAgICAvL3RoaXMuY2hpbGRyZW5bY2hpbGROb10uZXZhbHVhdGVTZWxmKG5vbkN5Y2xpY0luZGV4LHQsdGhpcy5idWZmZXJbY3ljbGljQnVmZmVySW5kZXhdLCBjeWNsaWNIaXN0b3J5VmFsdWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW5bY2hpbGROb10uZXZhbHVhdGVTZWxmKFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9uQ3ljbGljSW5kZXgsdCwgLy9pLHRcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuYnVmZmVyLnNsaWNlKGN5Y2xpY0J1ZmZlckluZGV4LGN5Y2xpY0J1ZmZlckluZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMpIC8vZXh0cmFjdCBjb29yZGluYXRlcyBmb3IgdGhpcyBoaXN0b3J5IHZhbHVlIGZyb20gYnVmZmVyXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEhpc3RvcnlSZWNvcmRlcih7bWVtb3J5TGVuZ3RoOiB0aGlzLm1lbW9yeUxlbmd0aCwgcmVjb3JkRnJhbWVJbnRlcnZhbDogdGhpcy5yZWNvcmRGcmFtZUludGVydmFsfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5leHBvcnQgeyBIaXN0b3J5UmVjb3JkZXIgfVxuIiwidmFyIHRocmVlRW52aXJvbm1lbnQgPSBudWxsO1xuXG5mdW5jdGlvbiBzZXRUaHJlZUVudmlyb25tZW50KG5ld0Vudil7XG4gICAgdGhyZWVFbnZpcm9ubWVudCA9IG5ld0Vudjtcbn1cbmZ1bmN0aW9uIGdldFRocmVlRW52aXJvbm1lbnQoKXtcbiAgICByZXR1cm4gdGhyZWVFbnZpcm9ubWVudDtcbn1cbmV4cG9ydCB7c2V0VGhyZWVFbnZpcm9ubWVudCwgZ2V0VGhyZWVFbnZpcm9ubWVudCwgdGhyZWVFbnZpcm9ubWVudH07XG4iLCJpbXBvcnQgeyBVdGlscyB9IGZyb20gJy4vdXRpbHMuanMnO1xuXG5pbXBvcnQgeyBUcmFuc2Zvcm1hdGlvbiB9IGZyb20gJy4vVHJhbnNmb3JtYXRpb24uanMnO1xuXG5pbXBvcnQgKiBhcyBtYXRoIGZyb20gJy4vbWF0aC5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxubGV0IEVQUyA9IE51bWJlci5FUFNJTE9OO1xuXG5jb25zdCBFYXNpbmcgPSB7RWFzZUluT3V0OjEsRWFzZUluOjIsRWFzZU91dDozfTtcblxuY2xhc3MgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcbiAgICAgICAgdGhpcy50b1ZhbHVlID0gdG9WYWx1ZTtcbiAgICAgICAgdGhpcy5mcm9tVmFsdWUgPSBmcm9tVmFsdWU7XG4gICAgICAgIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uID0gaW50ZXJwb2xhdGlvbkZ1bmN0aW9uO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZShwZXJjZW50YWdlKXt9IC8vcGVyY2VudGFnZSBpcyAwLTEgbGluZWFybHlcbn1cbmNsYXNzIE51bWJlckludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG5cdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcblx0XHRyZXR1cm4gdCp0aGlzLnRvVmFsdWUgKyAoMS10KSp0aGlzLmZyb21WYWx1ZTtcbiAgICB9XG59XG5cbmNsYXNzIEJvb2xJbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuICAgICAgICBsZXQgdCA9IHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHBlcmNlbnRhZ2UpO1xuICAgICAgICBpZih0ID4gMC41KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvVmFsdWU7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZnJvbVZhbHVlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbmNsYXNzIFRocmVlSnNDb2xvckludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy50ZW1wVmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IoKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG4gICAgICAgIGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG4gICAgICAgIHRoaXMudGVtcFZhbHVlLmNvcHkodGhpcy5mcm9tVmFsdWUpO1xuICAgICAgICByZXR1cm4gdGhpcy50ZW1wVmFsdWUubGVycCh0aGlzLnRvVmFsdWUsIHQpO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZUFuZENvcHlUbyhwZXJjZW50YWdlLCB0YXJnZXQpe1xuICAgICAgICBsZXQgcmVzdWx0QXJyYXkgPSB0aGlzLmludGVycG9sYXRlKHBlcmNlbnRhZ2UpO1xuICAgICAgICB0YXJnZXQuY29weShyZXN1bHRBcnJheSk7XG4gICAgfVxufVxuY2xhc3MgVGhyZWVKc1ZlYzNJbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgIGlmKFV0aWxzLmlzQXJyYXkodG9WYWx1ZSkgJiYgdG9WYWx1ZS5sZW5ndGggPD0gMyl7XG4gICAgICAgICAgICB0aGlzLnRvVmFsdWUgPSBuZXcgVEhSRUUuVmVjdG9yMyguLi50aGlzLnRvVmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGVtcFZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG4gICAgICAgIGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG4gICAgICAgIHJldHVybiB0aGlzLnRlbXBWYWx1ZS5sZXJwVmVjdG9ycyh0aGlzLmZyb21WYWx1ZSwgdGhpcy50b1ZhbHVlLCB0KTsgLy90aGlzIG1vZGlmaWVzIHRoaXMudGVtcFZhbHVlIGluLXBsYWNlIGFuZCByZXR1cm5zIGl0XG4gICAgfVxuICAgIGludGVycG9sYXRlQW5kQ29weVRvKHBlcmNlbnRhZ2UsIHRhcmdldCl7XG4gICAgICAgIGxldCByZXN1bHRBcnJheSA9IHRoaXMuaW50ZXJwb2xhdGUocGVyY2VudGFnZSk7XG4gICAgICAgIHRhcmdldC5jb3B5KHJlc3VsdEFycmF5KTtcbiAgICB9XG59XG5cbmNsYXNzIFRyYW5zZm9ybWF0aW9uRnVuY3Rpb25JbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24sIHN0YWdnZXJGcmFjdGlvbiwgdGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uKXtcbiAgICAgICAgc3VwZXIoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB0aGlzLnN0YWdnZXJGcmFjdGlvbiA9IHN0YWdnZXJGcmFjdGlvbjtcbiAgICAgICAgdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gPSB0YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb247XG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuXHRcdFx0Ly9pZiBzdGFnZ2VyRnJhY3Rpb24gIT0gMCwgaXQncyB0aGUgYW1vdW50IG9mIHRpbWUgYmV0d2VlbiB0aGUgZmlyc3QgcG9pbnQncyBzdGFydCB0aW1lIGFuZCB0aGUgbGFzdCBwb2ludCdzIHN0YXJ0IHRpbWUuXG5cdFx0XHQvL0FTU1VNUFRJT046IHRoZSBmaXJzdCB2YXJpYWJsZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGksIGFuZCBpdCdzIGFzc3VtZWQgaSBpcyB6ZXJvLWluZGV4ZWQuXG5cdFx0XHQvL2VuY2Fwc3VsYXRlIHBlcmNlbnRhZ2VcblxuXHRcdFx0cmV0dXJuIChmdW5jdGlvbiguLi5jb29yZHMpe1xuICAgICAgICAgICAgICAgIGNvbnN0IGkgPSBjb29yZHNbMF07XG5cdFx0XHRcdGxldCBsZXJwRmFjdG9yID0gcGVyY2VudGFnZTtcblxuICAgICAgICAgICAgICAgIC8vZmFuY3kgc3RhZ2dlcmluZyBtYXRoLCBpZiB3ZSBrbm93IGhvdyBtYW55IG9iamVjdHMgYXJlIGZsb3dpbmcgdGhyb3VnaCB0aGlzIHRyYW5zZm9ybWF0aW9uIGF0IG9uY2VcbiAgICAgICAgICAgICAgICBpZih0aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbiAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgICAgICAgICAgbGVycEZhY3RvciA9IHBlcmNlbnRhZ2UvKDEtdGhpcy5zdGFnZ2VyRnJhY3Rpb24rRVBTKSAtIGkqdGhpcy5zdGFnZ2VyRnJhY3Rpb24vdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb247XG4gICAgICAgICAgICAgICAgfVxuXHRcdFx0XHQvL2xldCBwZXJjZW50ID0gTWF0aC5taW4oTWF0aC5tYXgocGVyY2VudGFnZSAtIGkvdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gICAsMSksMCk7XG5cblx0XHRcdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihNYXRoLm1heChNYXRoLm1pbihsZXJwRmFjdG9yLDEpLDApKTtcblx0XHRcdFx0cmV0dXJuIG1hdGgubGVycFZlY3RvcnModCx0aGlzLnRvVmFsdWUoLi4uY29vcmRzKSx0aGlzLmZyb21WYWx1ZSguLi5jb29yZHMpKVxuXHRcdFx0fSkuYmluZCh0aGlzKTtcbiAgICB9XG59XG5cbmNsYXNzIE51bWVyaWMxREFycmF5SW50ZXJwb2xhdG9yIGV4dGVuZHMgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcbiAgICAgICAgc3VwZXIoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB0aGlzLmxhcmdlc3RMZW5ndGggPSBNYXRoLm1heChmcm9tVmFsdWUubGVuZ3RoLCB0b1ZhbHVlLmxlbmd0aCk7XG4gICAgICAgIHRoaXMuc2hvcnRlc3RMZW5ndGggPSBNYXRoLm1pbihmcm9tVmFsdWUubGVuZ3RoLCB0b1ZhbHVlLmxlbmd0aCk7XG4gICAgICAgIHRoaXMuZnJvbVZhbHVlSXNTaG9ydGVyID0gZnJvbVZhbHVlLmxlbmd0aCA8IHRvVmFsdWUubGVuZ3RoO1xuICAgICAgICB0aGlzLnJlc3VsdEFycmF5ID0gbmV3IEFycmF5KHRoaXMubGFyZ2VzdExlbmd0aCk7IC8vY2FjaGVkIGZvciBzcGVlZHVwXG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuXHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG4gICAgICAgIGZvcihsZXQgaT0wO2k8dGhpcy5zaG9ydGVzdExlbmd0aDtpKyspe1xuICAgICAgICAgICAgdGhpcy5yZXN1bHRBcnJheVtpXSA9IHQqdGhpcy50b1ZhbHVlW2ldICsgKDEtdCkqdGhpcy5mcm9tVmFsdWVbaV07XG4gICAgICAgIH1cblxuICAgICAgICAvL2lmIG9uZSBhcnJheSBpcyBsb25nZXIgdGhhbiB0aGUgb3RoZXIsIGludGVycG9sYXRlIGFzIGlmIHRoZSBzaG9ydGVyIGFycmF5IGlzIHBhZGRlZCB3aXRoIHplcm9lc1xuICAgICAgICBpZih0aGlzLmZyb21WYWx1ZUlzU2hvcnRlcil7XG4gICAgICAgICAgICAvL3RoaXMuZnJvbVZhbHVlW2ldIGRvZXNuJ3QgZXhpc3QsIHNvIGFzc3VtZSBpdCdzIGEgemVyb1xuICAgICAgICAgICAgZm9yKGxldCBpPXRoaXMuc2hvcnRlc3RMZW5ndGg7aTx0aGlzLmxhcmdlc3RMZW5ndGg7aSsrKXtcbiAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdEFycmF5W2ldID0gdCp0aGlzLnRvVmFsdWVbaV07IC8vICsgKDEtdCkqMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAvL3RoaXMudG9WYWx1ZVtpXSBkb2Vzbid0IGV4aXN0LCBzbyBhc3N1bWUgaXQncyBhIHplcm9cbiAgICAgICAgICAgIGZvcihsZXQgaT10aGlzLnNob3J0ZXN0TGVuZ3RoO2k8dGhpcy5sYXJnZXN0TGVuZ3RoO2krKyl7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRBcnJheVtpXSA9ICgxLXQpKnRoaXMuZnJvbVZhbHVlW2ldOyAvLyArIHQqMCBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5yZXN1bHRBcnJheTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGVBbmRDb3B5VG8ocGVyY2VudGFnZSwgdGFyZ2V0KXtcbiAgICAgICAgbGV0IHJlc3VsdEFycmF5ID0gdGhpcy5pbnRlcnBvbGF0ZShwZXJjZW50YWdlKTtcbiAgICAgICAgZm9yKGxldCBpPTA7aTxyZXN1bHRBcnJheS5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIHRhcmdldFtpXSA9IHJlc3VsdEFycmF5W2ldO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBGYWxsYmFja0RvTm90aGluZ0ludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG4gICAgICAgIHJldHVybiB0aGlzLmZyb21WYWx1ZTtcbiAgICB9XG59XG5cblxuXG5cblxuY29uc3QgRXhpc3RpbmdBbmltYXRpb25TeW1ib2wgPSBTeW1ib2woJ0N1cnJlbnRFWFBBbmltYXRpb24nKVxuXG5cbmNsYXNzIEFuaW1hdGlvbntcblx0Y29uc3RydWN0b3IodGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb249MSwgb3B0aW9uYWxBcmd1bWVudHM9e30pe1xuICAgICAgICBpZighVXRpbHMuaXNPYmplY3QodG9WYWx1ZXMpICYmICFVdGlscy5pc0FycmF5KHRvVmFsdWVzKSl7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFcnJvciB0cmFuc2l0aW9uaW5nOiB0b1ZhbHVlcyBtdXN0IGJlIGFuIGFycmF5IG9yIGFuIG9iamVjdC5cIik7XG4gICAgICAgIH1cblxuXHRcdHRoaXMudG9WYWx1ZXMgPSB0b1ZhbHVlcztcblx0XHR0aGlzLnRhcmdldCA9IHRhcmdldDtcdFxuXHRcdHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbjsgLy9pbiBzXG5cbiAgICAgICAgLy9QYXJzZSBvcHRpb25hbCB2YWx1ZXMgaW4gb3B0aW9uYWxBcmd1bWVudHNcblxuICAgICAgICAvL2Nob29zZSBlYXNpbmcgZnVuY3Rpb25cbiAgICAgICAgdGhpcy5lYXNpbmcgPSBvcHRpb25hbEFyZ3VtZW50cy5lYXNpbmcgPT09IHVuZGVmaW5lZCA/IEVhc2luZy5FYXNlSW5PdXQgOiBvcHRpb25hbEFyZ3VtZW50cy5lYXNpbmc7Ly9kZWZhdWx0LCBFYXNpbmcuRWFzZUluT3V0XG4gICAgICAgIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uID0gQW5pbWF0aW9uLmNvc2luZUVhc2VJbk91dEludGVycG9sYXRpb247IFxuICAgICAgICBpZih0aGlzLmVhc2luZyA9PSBFYXNpbmcuRWFzZUluKXtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uID0gQW5pbWF0aW9uLmNvc2luZUVhc2VJbkludGVycG9sYXRpb247XG4gICAgICAgIH1lbHNlIGlmKHRoaXMuZWFzaW5nID09IEVhc2luZy5FYXNlT3V0KXtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uID0gQW5pbWF0aW9uLmNvc2luZUVhc2VPdXRJbnRlcnBvbGF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9zZXR1cCB2YWx1ZXMgbmVlZGVkIGZvciBzdGFnZ2VyZWQgYW5pbWF0aW9uXG4gICAgICAgIHRoaXMuc3RhZ2dlckZyYWN0aW9uID0gb3B0aW9uYWxBcmd1bWVudHMuc3RhZ2dlckZyYWN0aW9uID09PSB1bmRlZmluZWQgPyAwIDogb3B0aW9uYWxBcmd1bWVudHMuc3RhZ2dlckZyYWN0aW9uOyAvLyB0aW1lIGluIG1zIGJldHdlZW4gZmlyc3QgZWxlbWVudCBiZWdpbm5pbmcgdGhlIGFuaW1hdGlvbiBhbmQgbGFzdCBlbGVtZW50IGJlZ2lubmluZyB0aGUgYW5pbWF0aW9uLiBTaG91bGQgYmUgbGVzcyB0aGFuIGR1cmF0aW9uLlxuXHRcdFV0aWxzLmFzc2VydCh0aGlzLnN0YWdnZXJGcmFjdGlvbiA+PSAwICYmIHRoaXMuc3RhZ2dlckZyYWN0aW9uIDwgMSk7XG5cdFx0aWYodGFyZ2V0LmNvbnN0cnVjdG9yID09PSBUcmFuc2Zvcm1hdGlvbil7XG5cdFx0XHR0aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHRhcmdldC5nZXRUb3BQYXJlbnQoKS5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cdFx0fWVsc2V7XG5cdFx0XHRpZih0aGlzLnN0YWdnZXJGcmFjdGlvbiAhPSAwKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcInN0YWdnZXJGcmFjdGlvbiBjYW4gb25seSBiZSB1c2VkIHdoZW4gVHJhbnNpdGlvblRvJ3MgdGFyZ2V0IGlzIGFuIEVYUC5UcmFuc2Zvcm1hdGlvbiFcIik7XG5cdFx0XHR9XG5cdFx0fVxuXG4gICAgICAgIHRoaXMubW9kZSA9IFwiY29weVByb3BlcnRpZXNcIjtcbiAgICAgICAgXG5cdFx0dGhpcy5mcm9tVmFsdWVzID0ge307XG4gICAgICAgIHRoaXMuaW50ZXJwb2xhdG9ycyA9IFtdO1xuICAgICAgICB0aGlzLmludGVycG9sYXRpbmdQcm9wZXJ0eU5hbWVzID0gW107XG4gICAgICAgIGlmKCFVdGlscy5pc0FycmF5KHRvVmFsdWVzKSl7XG5cdFx0ICAgIGZvcih2YXIgcHJvcGVydHkgaW4gdGhpcy50b1ZhbHVlcyl7XG5cdFx0XHQgICAgVXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyh0aGlzLnRhcmdldCwgcHJvcGVydHkpO1xuXG5cdFx0XHQgICAgLy9jb3B5IHByb3BlcnR5LCBtYWtpbmcgc3VyZSB0byBzdG9yZSB0aGUgY29ycmVjdCAndGhpcydcblx0XHRcdCAgICBpZihVdGlscy5pc0Z1bmN0aW9uKHRoaXMudGFyZ2V0W3Byb3BlcnR5XSkpe1xuXHRcdFx0XHQgICAgdGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHRoaXMudGFyZ2V0W3Byb3BlcnR5XS5iaW5kKHRoaXMudGFyZ2V0KTtcblx0XHRcdCAgICB9ZWxzZXtcblx0XHRcdFx0ICAgIHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0gPSB0aGlzLnRhcmdldFtwcm9wZXJ0eV07XG5cdFx0XHQgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0b3JzLnB1c2godGhpcy5jaG9vc2VJbnRlcnBvbGF0b3IodGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSwgdGhpcy50b1ZhbHVlc1twcm9wZXJ0eV0sdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24pKTtcbiAgICAgICAgICAgICAgICB0aGlzLmludGVycG9sYXRpbmdQcm9wZXJ0eU5hbWVzLnB1c2gocHJvcGVydHkpO1xuXHRcdCAgICB9XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5tb2RlID0gXCJjb3B5VG9UYXJnZXRcIjtcbiAgICAgICAgICAgIC8vc3VwcG9ydCBBbmltYXRpb24oW2EsYixjXSxbYSxiLGMsZCxlXSkgd2hlcmUgZnJvbVZhbHVlc1twcm9wZXJ0eV0gbWlnaHQgbm90IGJlIGludGVycG9sYXRhYmxlLCBidXQgZnJvbVZhbHVlcyBpc1xuXHRcdCAgICB0aGlzLmZyb21WYWx1ZXMgPSBFWFAuTWF0aC5jbG9uZSh0aGlzLnRhcmdldCk7XG4gICAgICAgICAgICBsZXQgd2hvbGVUaGluZ0ludGVycG9sYXRvciA9IHRoaXMuY2hvb3NlSW50ZXJwb2xhdG9yKHRoaXMuZnJvbVZhbHVlcywgdGhpcy50b1ZhbHVlcyx0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRvcnMucHVzaCh3aG9sZVRoaW5nSW50ZXJwb2xhdG9yKTtcbiAgICAgICAgfVxuXG5cblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5wcmV2VHJ1ZVRpbWUgPSAwO1xuXG4gICAgICAgIGlmKHRoaXMudGFyZ2V0W0V4aXN0aW5nQW5pbWF0aW9uU3ltYm9sXSAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIHRoaXMuZGVhbFdpdGhFeGlzdGluZ0FuaW1hdGlvbigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGFyZ2V0W0V4aXN0aW5nQW5pbWF0aW9uU3ltYm9sXSA9IHRoaXM7XG5cblx0XHQvL2JlZ2luXG5cdFx0dGhpcy5fdXBkYXRlQ2FsbGJhY2sgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpXG5cdFx0dGhyZWVFbnZpcm9ubWVudC5vbihcInVwZGF0ZVwiLHRoaXMuX3VwZGF0ZUNhbGxiYWNrKTtcblx0fVxuICAgIGRlYWxXaXRoRXhpc3RpbmdBbmltYXRpb24oKXtcbiAgICAgICAgLy9pZiBhbm90aGVyIGFuaW1hdGlvbiBpcyBoYWxmd2F5IHRocm91Z2ggcGxheWluZyB3aGVuIHRoaXMgYW5pbWF0aW9uIHN0YXJ0cywgcHJlZW1wdCBpdFxuICAgICAgICBsZXQgcHJldmlvdXNBbmltYXRpb24gPSB0aGlzLnRhcmdldFtFeGlzdGluZ0FuaW1hdGlvblN5bWJvbF07XG5cbiAgICAgICAgLy90b2RvOiBmYW5jeSBibGVuZGluZ1xuICAgICAgICBwcmV2aW91c0FuaW1hdGlvbi5lbmQoKTtcblx0XHRmb3IodmFyIHByb3BlcnR5IGluIHRoaXMuZnJvbVZhbHVlcyl7XG4gICAgICAgICAgICBpZihwcm9wZXJ0eSBpbiBwcmV2aW91c0FuaW1hdGlvbi50b1ZhbHVlcyl7XG4gICAgICAgICAgICAgICAgdGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHByZXZpb3VzQW5pbWF0aW9uLnRvVmFsdWVzW3Byb3BlcnR5XTtcbiAgICBcdFx0fVxuXHRcdH1cbiAgICB9XG4gICAgY2hvb3NlSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcblx0XHRpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mKGZyb21WYWx1ZSkgPT09IFwibnVtYmVyXCIpe1xuICAgICAgICAgICAgLy9udW1iZXItbnVtYmVyXG4gICAgICAgICAgICByZXR1cm4gbmV3IE51bWJlckludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXNGdW5jdGlvbih0b1ZhbHVlKSAmJiBVdGlscy5pc0Z1bmN0aW9uKGZyb21WYWx1ZSkpe1xuICAgICAgICAgICAgLy9mdW5jdGlvbi1mdW5jdGlvblxuXHRcdFx0cmV0dXJuIG5ldyBUcmFuc2Zvcm1hdGlvbkZ1bmN0aW9uSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uLCB0aGlzLnN0YWdnZXJGcmFjdGlvbiwgdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24pO1xuXHRcdH1lbHNlIGlmKHRvVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLkNvbG9yICYmIGZyb21WYWx1ZS5jb25zdHJ1Y3RvciA9PT0gVEhSRUUuQ29sb3Ipe1xuICAgICAgICAgICAgLy9USFJFRS5Db2xvclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBUaHJlZUpzQ29sb3JJbnRlcnBvbGF0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB9ZWxzZSBpZihmcm9tVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLlZlY3RvcjMgJiYgKHRvVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLlZlY3RvcjMgfHwgVXRpbHMuaXMxRE51bWVyaWNBcnJheSh0b1ZhbHVlKSkpe1xuICAgICAgICAgICAgLy9USFJFRS5WZWN0b3IzIC0gYnV0IHdlIGNhbiBhbHNvIGludGVycHJldCBhIHRvVmFsdWUgb2YgW2EsYixjXSBhcyBuZXcgVEhSRUUuVmVjdG9yMyhhLGIsYylcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGhyZWVKc1ZlYzNJbnRlcnBvbGF0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB9ZWxzZSBpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwiYm9vbGVhblwiICYmIHR5cGVvZihmcm9tVmFsdWUpID09PSBcImJvb2xlYW5cIil7XG4gICAgICAgICAgICAvL2Jvb2xlYW5cbiAgICAgICAgICAgIHJldHVybiBuZXcgQm9vbEludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXMxRE51bWVyaWNBcnJheSh0b1ZhbHVlKSAmJiBVdGlscy5pczFETnVtZXJpY0FycmF5KGZyb21WYWx1ZSkpe1xuICAgICAgICAgICAgLy9mdW5jdGlvbi1mdW5jdGlvblxuXHRcdFx0cmV0dXJuIG5ldyBOdW1lcmljMURBcnJheUludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgLy9XZSBkb24ndCBrbm93IGhvdyB0byBpbnRlcnBvbGF0ZSB0aGlzLiBJbnN0ZWFkIHdlJ2xsIGp1c3QgZG8gbm90aGluZywgYW5kIGF0IHRoZSBlbmQgb2YgdGhlIGFuaW1hdGlvbiB3ZSdsbCBqdXN0IHNldCB0aGUgdGFyZ2V0IHRvIHRoZSB0b1ZhbHVlLlxuXHRcdFx0Y29uc29sZS5lcnJvcihcIkFuaW1hdGlvbiBjbGFzcyBjYW5ub3QgeWV0IGhhbmRsZSB0cmFuc2l0aW9uaW5nIGJldHdlZW4gdGhpbmdzIHRoYXQgYXJlbid0IG51bWJlcnMgb3IgZnVuY3Rpb25zIG9yIGFycmF5cyFcIik7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEZhbGxiYWNrRG9Ob3RoaW5nSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcblx0XHR9XG4gICAgfVxuXHR1cGRhdGUodGltZSl7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSB0aW1lLnJlYWx0aW1lRGVsdGE7XHRcblxuXHRcdGxldCBwZXJjZW50YWdlID0gdGhpcy5lbGFwc2VkVGltZS90aGlzLmR1cmF0aW9uO1xuXG5cdFx0Ly9pbnRlcnBvbGF0ZSB2YWx1ZXNcbiAgICAgICAgaWYodGhpcy5tb2RlID09ICdjb3B5UHJvcGVydGllcycpe1xuXHRcdCAgICBmb3IobGV0IGk9MDtpPHRoaXMuaW50ZXJwb2xhdG9ycy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgICAgICBsZXQgcHJvcGVydHlOYW1lID0gdGhpcy5pbnRlcnBvbGF0aW5nUHJvcGVydHlOYW1lc1tpXTtcblx0XHRcdCAgICB0aGlzLnRhcmdldFtwcm9wZXJ0eU5hbWVdID0gdGhpcy5pbnRlcnBvbGF0b3JzW2ldLmludGVycG9sYXRlKHBlcmNlbnRhZ2UpO1xuXHRcdCAgICB9XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgLy9jb3B5IHRvIHRhcmdldFxuICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0b3JzWzBdLmludGVycG9sYXRlQW5kQ29weVRvKHBlcmNlbnRhZ2UsIHRoaXMudGFyZ2V0KTtcbiAgICAgICAgfVxuXG5cdFx0aWYodGhpcy5lbGFwc2VkVGltZSA+PSB0aGlzLmR1cmF0aW9uKXtcblx0XHRcdHRoaXMuZW5kKCk7XG5cdFx0fVxuXHR9XG5cdHN0YXRpYyBjb3NpbmVFYXNlSW5PdXRJbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiAoMS1NYXRoLmNvcyh4Kk1hdGguUEkpKS8yO1xuXHR9XG5cdHN0YXRpYyBjb3NpbmVFYXNlSW5JbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiAoMS1NYXRoLmNvcyh4Kk1hdGguUEkvMikpO1xuXHR9XG5cdHN0YXRpYyBjb3NpbmVFYXNlT3V0SW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4gTWF0aC5zaW4oeCAqIE1hdGguUEkvMik7XG5cdH1cblx0c3RhdGljIGxpbmVhckludGVycG9sYXRpb24oeCl7XG5cdFx0cmV0dXJuIHg7XG5cdH1cblx0ZW5kKCl7XG5cdFx0Zm9yKHZhciBwcm9wIGluIHRoaXMudG9WYWx1ZXMpe1xuXHRcdFx0dGhpcy50YXJnZXRbcHJvcF0gPSB0aGlzLnRvVmFsdWVzW3Byb3BdO1xuXHRcdH1cblx0XHR0aHJlZUVudmlyb25tZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ1cGRhdGVcIix0aGlzLl91cGRhdGVDYWxsYmFjayk7XG4gICAgICAgIHRoaXMudGFyZ2V0W0V4aXN0aW5nQW5pbWF0aW9uU3ltYm9sXSA9IHVuZGVmaW5lZDtcblx0fVxufVxuXG5mdW5jdGlvbiBUcmFuc2l0aW9uVG8odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUywgb3B0aW9uYWxBcmd1bWVudHMpe1xuICAgIC8vaWYgc29tZW9uZSdzIHVzaW5nIHRoZSBvbGQgY2FsbGluZyBzdHJhdGVneSBvZiBzdGFnZ2VyRnJhY3Rpb24gYXMgdGhlIGxhc3QgYXJndW1lbnQsIGNvbnZlcnQgaXQgcHJvcGVybHlcbiAgICBpZihvcHRpb25hbEFyZ3VtZW50cyAmJiBVdGlscy5pc051bWJlcihvcHRpb25hbEFyZ3VtZW50cykpe1xuICAgICAgICBvcHRpb25hbEFyZ3VtZW50cyA9IHtzdGFnZ2VyRnJhY3Rpb246IG9wdGlvbmFsQXJndW1lbnRzfTtcbiAgICB9XG5cdHZhciBhbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGR1cmF0aW9uTVMvMTAwMCwgb3B0aW9uYWxBcmd1bWVudHMpO1xufVxuXG5leHBvcnQge1RyYW5zaXRpb25UbywgQW5pbWF0aW9uLCBFYXNpbmd9XG4iLCIoZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgbG9va3VwID0gW1xuXHRcdFx0J0EnLCAnQicsICdDJywgJ0QnLCAnRScsICdGJywgJ0cnLCAnSCcsXG5cdFx0XHQnSScsICdKJywgJ0snLCAnTCcsICdNJywgJ04nLCAnTycsICdQJyxcblx0XHRcdCdRJywgJ1InLCAnUycsICdUJywgJ1UnLCAnVicsICdXJywgJ1gnLFxuXHRcdFx0J1knLCAnWicsICdhJywgJ2InLCAnYycsICdkJywgJ2UnLCAnZicsXG5cdFx0XHQnZycsICdoJywgJ2knLCAnaicsICdrJywgJ2wnLCAnbScsICduJyxcblx0XHRcdCdvJywgJ3AnLCAncScsICdyJywgJ3MnLCAndCcsICd1JywgJ3YnLFxuXHRcdFx0J3cnLCAneCcsICd5JywgJ3onLCAnMCcsICcxJywgJzInLCAnMycsXG5cdFx0XHQnNCcsICc1JywgJzYnLCAnNycsICc4JywgJzknLCAnKycsICcvJ1xuXHRcdF07XG5cdGZ1bmN0aW9uIGNsZWFuKGxlbmd0aCkge1xuXHRcdHZhciBpLCBidWZmZXIgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuXHRcdGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0YnVmZmVyW2ldID0gMDtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdGZ1bmN0aW9uIGV4dGVuZChvcmlnLCBsZW5ndGgsIGFkZExlbmd0aCwgbXVsdGlwbGVPZikge1xuXHRcdHZhciBuZXdTaXplID0gbGVuZ3RoICsgYWRkTGVuZ3RoLFxuXHRcdFx0YnVmZmVyID0gY2xlYW4oKHBhcnNlSW50KG5ld1NpemUgLyBtdWx0aXBsZU9mKSArIDEpICogbXVsdGlwbGVPZik7XG5cblx0XHRidWZmZXIuc2V0KG9yaWcpO1xuXG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdGZ1bmN0aW9uIHBhZChudW0sIGJ5dGVzLCBiYXNlKSB7XG5cdFx0bnVtID0gbnVtLnRvU3RyaW5nKGJhc2UgfHwgOCk7XG5cdFx0cmV0dXJuIFwiMDAwMDAwMDAwMDAwXCIuc3Vic3RyKG51bS5sZW5ndGggKyAxMiAtIGJ5dGVzKSArIG51bTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN0cmluZ1RvVWludDggKGlucHV0LCBvdXQsIG9mZnNldCkge1xuXHRcdHZhciBpLCBsZW5ndGg7XG5cblx0XHRvdXQgPSBvdXQgfHwgY2xlYW4oaW5wdXQubGVuZ3RoKTtcblxuXHRcdG9mZnNldCA9IG9mZnNldCB8fCAwO1xuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IGlucHV0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRvdXRbb2Zmc2V0XSA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRvZmZzZXQgKz0gMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0O1xuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoO1xuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXTtcblx0XHR9O1xuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSk7XG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApO1xuXHRcdH1cblxuXHRcdC8vIHRoaXMgcHJldmVudHMgYW4gRVJSX0lOVkFMSURfVVJMIGluIENocm9tZSAoRmlyZWZveCBva2F5KVxuXHRcdHN3aXRjaCAob3V0cHV0Lmxlbmd0aCAlIDQpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0b3V0cHV0ICs9ICc9Jztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdG91dHB1dCArPSAnPT0nO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHR3aW5kb3cudXRpbHMgPSB7fVxuXHR3aW5kb3cudXRpbHMuY2xlYW4gPSBjbGVhbjtcblx0d2luZG93LnV0aWxzLnBhZCA9IHBhZDtcblx0d2luZG93LnV0aWxzLmV4dGVuZCA9IGV4dGVuZDtcblx0d2luZG93LnV0aWxzLnN0cmluZ1RvVWludDggPSBzdHJpbmdUb1VpbnQ4O1xuXHR3aW5kb3cudXRpbHMudWludDhUb0Jhc2U2NCA9IHVpbnQ4VG9CYXNlNjQ7XG59KCkpO1xuXG4oZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuLypcbnN0cnVjdCBwb3NpeF9oZWFkZXIgeyAgICAgICAgICAgICAvLyBieXRlIG9mZnNldFxuXHRjaGFyIG5hbWVbMTAwXTsgICAgICAgICAgICAgICAvLyAgIDBcblx0Y2hhciBtb2RlWzhdOyAgICAgICAgICAgICAgICAgLy8gMTAwXG5cdGNoYXIgdWlkWzhdOyAgICAgICAgICAgICAgICAgIC8vIDEwOFxuXHRjaGFyIGdpZFs4XTsgICAgICAgICAgICAgICAgICAvLyAxMTZcblx0Y2hhciBzaXplWzEyXTsgICAgICAgICAgICAgICAgLy8gMTI0XG5cdGNoYXIgbXRpbWVbMTJdOyAgICAgICAgICAgICAgIC8vIDEzNlxuXHRjaGFyIGNoa3N1bVs4XTsgICAgICAgICAgICAgICAvLyAxNDhcblx0Y2hhciB0eXBlZmxhZzsgICAgICAgICAgICAgICAgLy8gMTU2XG5cdGNoYXIgbGlua25hbWVbMTAwXTsgICAgICAgICAgIC8vIDE1N1xuXHRjaGFyIG1hZ2ljWzZdOyAgICAgICAgICAgICAgICAvLyAyNTdcblx0Y2hhciB2ZXJzaW9uWzJdOyAgICAgICAgICAgICAgLy8gMjYzXG5cdGNoYXIgdW5hbWVbMzJdOyAgICAgICAgICAgICAgIC8vIDI2NVxuXHRjaGFyIGduYW1lWzMyXTsgICAgICAgICAgICAgICAvLyAyOTdcblx0Y2hhciBkZXZtYWpvcls4XTsgICAgICAgICAgICAgLy8gMzI5XG5cdGNoYXIgZGV2bWlub3JbOF07ICAgICAgICAgICAgIC8vIDMzN1xuXHRjaGFyIHByZWZpeFsxNTVdOyAgICAgICAgICAgICAvLyAzNDVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyA1MDBcbn07XG4qL1xuXG5cdHZhciB1dGlscyA9IHdpbmRvdy51dGlscyxcblx0XHRoZWFkZXJGb3JtYXQ7XG5cblx0aGVhZGVyRm9ybWF0ID0gW1xuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlTmFtZScsXG5cdFx0XHQnbGVuZ3RoJzogMTAwXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZU1vZGUnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd1aWQnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdnaWQnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlU2l6ZScsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtdGltZScsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdjaGVja3N1bScsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3R5cGUnLFxuXHRcdFx0J2xlbmd0aCc6IDFcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdsaW5rTmFtZScsXG5cdFx0XHQnbGVuZ3RoJzogMTAwXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndXN0YXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdvd25lcicsXG5cdFx0XHQnbGVuZ3RoJzogMzJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdncm91cCcsXG5cdFx0XHQnbGVuZ3RoJzogMzJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtYWpvck51bWJlcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ21pbm9yTnVtYmVyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZW5hbWVQcmVmaXgnLFxuXHRcdFx0J2xlbmd0aCc6IDE1NVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3BhZGRpbmcnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fVxuXHRdO1xuXG5cdGZ1bmN0aW9uIGZvcm1hdEhlYWRlcihkYXRhLCBjYikge1xuXHRcdHZhciBidWZmZXIgPSB1dGlscy5jbGVhbig1MTIpLFxuXHRcdFx0b2Zmc2V0ID0gMDtcblxuXHRcdGhlYWRlckZvcm1hdC5mb3JFYWNoKGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0dmFyIHN0ciA9IGRhdGFbdmFsdWUuZmllbGRdIHx8IFwiXCIsXG5cdFx0XHRcdGksIGxlbmd0aDtcblxuXHRcdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gc3RyLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRcdGJ1ZmZlcltvZmZzZXRdID0gc3RyLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRcdG9mZnNldCArPSAxO1xuXHRcdFx0fVxuXG5cdFx0XHRvZmZzZXQgKz0gdmFsdWUubGVuZ3RoIC0gaTsgLy8gc3BhY2UgaXQgb3V0IHdpdGggbnVsbHNcblx0XHR9KTtcblxuXHRcdGlmICh0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiBjYihidWZmZXIsIG9mZnNldCk7XG5cdFx0fVxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHR3aW5kb3cuaGVhZGVyID0ge31cblx0d2luZG93LmhlYWRlci5zdHJ1Y3R1cmUgPSBoZWFkZXJGb3JtYXQ7XG5cdHdpbmRvdy5oZWFkZXIuZm9ybWF0ID0gZm9ybWF0SGVhZGVyO1xufSgpKTtcblxuKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIGhlYWRlciA9IHdpbmRvdy5oZWFkZXIsXG5cdFx0dXRpbHMgPSB3aW5kb3cudXRpbHMsXG5cdFx0cmVjb3JkU2l6ZSA9IDUxMixcblx0XHRibG9ja1NpemU7XG5cblx0ZnVuY3Rpb24gVGFyKHJlY29yZHNQZXJCbG9jaykge1xuXHRcdHRoaXMud3JpdHRlbiA9IDA7XG5cdFx0YmxvY2tTaXplID0gKHJlY29yZHNQZXJCbG9jayB8fCAyMCkgKiByZWNvcmRTaXplO1xuXHRcdHRoaXMub3V0ID0gdXRpbHMuY2xlYW4oYmxvY2tTaXplKTtcblx0XHR0aGlzLmJsb2NrcyA9IFtdO1xuXHRcdHRoaXMubGVuZ3RoID0gMDtcblx0fVxuXG5cdFRhci5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24gKGZpbGVwYXRoLCBpbnB1dCwgb3B0cywgY2FsbGJhY2spIHtcblx0XHR2YXIgZGF0YSxcblx0XHRcdGNoZWNrc3VtLFxuXHRcdFx0bW9kZSxcblx0XHRcdG10aW1lLFxuXHRcdFx0dWlkLFxuXHRcdFx0Z2lkLFxuXHRcdFx0aGVhZGVyQXJyO1xuXG5cdFx0aWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGlucHV0ID0gdXRpbHMuc3RyaW5nVG9VaW50OChpbnB1dCk7XG5cdFx0fSBlbHNlIGlmIChpbnB1dC5jb25zdHJ1Y3RvciAhPT0gVWludDhBcnJheS5wcm90b3R5cGUuY29uc3RydWN0b3IpIHtcblx0XHRcdHRocm93ICdJbnZhbGlkIGlucHV0IHR5cGUuIFlvdSBnYXZlIG1lOiAnICsgaW5wdXQuY29uc3RydWN0b3IudG9TdHJpbmcoKS5tYXRjaCgvZnVuY3Rpb25cXHMqKFskQS1aYS16X11bMC05QS1aYS16X10qKVxccypcXCgvKVsxXTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGNhbGxiYWNrID0gb3B0cztcblx0XHRcdG9wdHMgPSB7fTtcblx0XHR9XG5cblx0XHRvcHRzID0gb3B0cyB8fCB7fTtcblxuXHRcdG1vZGUgPSBvcHRzLm1vZGUgfHwgcGFyc2VJbnQoJzc3NycsIDgpICYgMHhmZmY7XG5cdFx0bXRpbWUgPSBvcHRzLm10aW1lIHx8IE1hdGguZmxvb3IoK25ldyBEYXRlKCkgLyAxMDAwKTtcblx0XHR1aWQgPSBvcHRzLnVpZCB8fCAwO1xuXHRcdGdpZCA9IG9wdHMuZ2lkIHx8IDA7XG5cblx0XHRkYXRhID0ge1xuXHRcdFx0ZmlsZU5hbWU6IGZpbGVwYXRoLFxuXHRcdFx0ZmlsZU1vZGU6IHV0aWxzLnBhZChtb2RlLCA3KSxcblx0XHRcdHVpZDogdXRpbHMucGFkKHVpZCwgNyksXG5cdFx0XHRnaWQ6IHV0aWxzLnBhZChnaWQsIDcpLFxuXHRcdFx0ZmlsZVNpemU6IHV0aWxzLnBhZChpbnB1dC5sZW5ndGgsIDExKSxcblx0XHRcdG10aW1lOiB1dGlscy5wYWQobXRpbWUsIDExKSxcblx0XHRcdGNoZWNrc3VtOiAnICAgICAgICAnLFxuXHRcdFx0dHlwZTogJzAnLCAvLyBqdXN0IGEgZmlsZVxuXHRcdFx0dXN0YXI6ICd1c3RhciAgJyxcblx0XHRcdG93bmVyOiBvcHRzLm93bmVyIHx8ICcnLFxuXHRcdFx0Z3JvdXA6IG9wdHMuZ3JvdXAgfHwgJydcblx0XHR9O1xuXG5cdFx0Ly8gY2FsY3VsYXRlIHRoZSBjaGVja3N1bVxuXHRcdGNoZWNrc3VtID0gMDtcblx0XHRPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdHZhciBpLCB2YWx1ZSA9IGRhdGFba2V5XSwgbGVuZ3RoO1xuXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB2YWx1ZS5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0XHRjaGVja3N1bSArPSB2YWx1ZS5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0ZGF0YS5jaGVja3N1bSA9IHV0aWxzLnBhZChjaGVja3N1bSwgNikgKyBcIlxcdTAwMDAgXCI7XG5cblx0XHRoZWFkZXJBcnIgPSBoZWFkZXIuZm9ybWF0KGRhdGEpO1xuXG5cdFx0dmFyIGhlYWRlckxlbmd0aCA9IE1hdGguY2VpbCggaGVhZGVyQXJyLmxlbmd0aCAvIHJlY29yZFNpemUgKSAqIHJlY29yZFNpemU7XG5cdFx0dmFyIGlucHV0TGVuZ3RoID0gTWF0aC5jZWlsKCBpbnB1dC5sZW5ndGggLyByZWNvcmRTaXplICkgKiByZWNvcmRTaXplO1xuXG5cdFx0dGhpcy5ibG9ja3MucHVzaCggeyBoZWFkZXI6IGhlYWRlckFyciwgaW5wdXQ6IGlucHV0LCBoZWFkZXJMZW5ndGg6IGhlYWRlckxlbmd0aCwgaW5wdXRMZW5ndGg6IGlucHV0TGVuZ3RoIH0gKTtcblxuXHR9O1xuXG5cdFRhci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGJ1ZmZlcnMgPSBbXTtcblx0XHR2YXIgY2h1bmtzID0gW107XG5cdFx0dmFyIGxlbmd0aCA9IDA7XG5cdFx0dmFyIG1heCA9IE1hdGgucG93KCAyLCAyMCApO1xuXG5cdFx0dmFyIGNodW5rID0gW107XG5cdFx0dGhpcy5ibG9ja3MuZm9yRWFjaCggZnVuY3Rpb24oIGIgKSB7XG5cdFx0XHRpZiggbGVuZ3RoICsgYi5oZWFkZXJMZW5ndGggKyBiLmlucHV0TGVuZ3RoID4gbWF4ICkge1xuXHRcdFx0XHRjaHVua3MucHVzaCggeyBibG9ja3M6IGNodW5rLCBsZW5ndGg6IGxlbmd0aCB9ICk7XG5cdFx0XHRcdGNodW5rID0gW107XG5cdFx0XHRcdGxlbmd0aCA9IDA7XG5cdFx0XHR9XG5cdFx0XHRjaHVuay5wdXNoKCBiICk7XG5cdFx0XHRsZW5ndGggKz0gYi5oZWFkZXJMZW5ndGggKyBiLmlucHV0TGVuZ3RoO1xuXHRcdH0gKTtcblx0XHRjaHVua3MucHVzaCggeyBibG9ja3M6IGNodW5rLCBsZW5ndGg6IGxlbmd0aCB9ICk7XG5cblx0XHRjaHVua3MuZm9yRWFjaCggZnVuY3Rpb24oIGMgKSB7XG5cblx0XHRcdHZhciBidWZmZXIgPSBuZXcgVWludDhBcnJheSggYy5sZW5ndGggKTtcblx0XHRcdHZhciB3cml0dGVuID0gMDtcblx0XHRcdGMuYmxvY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBiICkge1xuXHRcdFx0XHRidWZmZXIuc2V0KCBiLmhlYWRlciwgd3JpdHRlbiApO1xuXHRcdFx0XHR3cml0dGVuICs9IGIuaGVhZGVyTGVuZ3RoO1xuXHRcdFx0XHRidWZmZXIuc2V0KCBiLmlucHV0LCB3cml0dGVuICk7XG5cdFx0XHRcdHdyaXR0ZW4gKz0gYi5pbnB1dExlbmd0aDtcblx0XHRcdH0gKTtcblx0XHRcdGJ1ZmZlcnMucHVzaCggYnVmZmVyICk7XG5cblx0XHR9ICk7XG5cblx0XHRidWZmZXJzLnB1c2goIG5ldyBVaW50OEFycmF5KCAyICogcmVjb3JkU2l6ZSApICk7XG5cblx0XHRyZXR1cm4gbmV3IEJsb2IoIGJ1ZmZlcnMsIHsgdHlwZTogJ29jdGV0L3N0cmVhbScgfSApO1xuXG5cdH07XG5cblx0VGFyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLndyaXR0ZW4gPSAwO1xuXHRcdHRoaXMub3V0ID0gdXRpbHMuY2xlYW4oYmxvY2tTaXplKTtcblx0fTtcblxuICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gVGFyO1xuICB9IGVsc2Uge1xuICAgIHdpbmRvdy5UYXIgPSBUYXI7XG4gIH1cbn0oKSk7XG4iLCIvL2Rvd25sb2FkLmpzIHYzLjAsIGJ5IGRhbmRhdmlzOyAyMDA4LTIwMTQuIFtDQ0JZMl0gc2VlIGh0dHA6Ly9kYW5tbC5jb20vZG93bmxvYWQuaHRtbCBmb3IgdGVzdHMvdXNhZ2Vcbi8vIHYxIGxhbmRlZCBhIEZGK0Nocm9tZSBjb21wYXQgd2F5IG9mIGRvd25sb2FkaW5nIHN0cmluZ3MgdG8gbG9jYWwgdW4tbmFtZWQgZmlsZXMsIHVwZ3JhZGVkIHRvIHVzZSBhIGhpZGRlbiBmcmFtZSBhbmQgb3B0aW9uYWwgbWltZVxuLy8gdjIgYWRkZWQgbmFtZWQgZmlsZXMgdmlhIGFbZG93bmxvYWRdLCBtc1NhdmVCbG9iLCBJRSAoMTArKSBzdXBwb3J0LCBhbmQgd2luZG93LlVSTCBzdXBwb3J0IGZvciBsYXJnZXIrZmFzdGVyIHNhdmVzIHRoYW4gZGF0YVVSTHNcbi8vIHYzIGFkZGVkIGRhdGFVUkwgYW5kIEJsb2IgSW5wdXQsIGJpbmQtdG9nZ2xlIGFyaXR5LCBhbmQgbGVnYWN5IGRhdGFVUkwgZmFsbGJhY2sgd2FzIGltcHJvdmVkIHdpdGggZm9yY2UtZG93bmxvYWQgbWltZSBhbmQgYmFzZTY0IHN1cHBvcnRcblxuLy8gZGF0YSBjYW4gYmUgYSBzdHJpbmcsIEJsb2IsIEZpbGUsIG9yIGRhdGFVUkxcblxuXG5cblxuZnVuY3Rpb24gZG93bmxvYWQoZGF0YSwgc3RyRmlsZU5hbWUsIHN0ck1pbWVUeXBlKSB7XG5cblx0dmFyIHNlbGYgPSB3aW5kb3csIC8vIHRoaXMgc2NyaXB0IGlzIG9ubHkgZm9yIGJyb3dzZXJzIGFueXdheS4uLlxuXHRcdHUgPSBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiLCAvLyB0aGlzIGRlZmF1bHQgbWltZSBhbHNvIHRyaWdnZXJzIGlmcmFtZSBkb3dubG9hZHNcblx0XHRtID0gc3RyTWltZVR5cGUgfHwgdSxcblx0XHR4ID0gZGF0YSxcblx0XHREID0gZG9jdW1lbnQsXG5cdFx0YSA9IEQuY3JlYXRlRWxlbWVudChcImFcIiksXG5cdFx0eiA9IGZ1bmN0aW9uKGEpe3JldHVybiBTdHJpbmcoYSk7fSxcblxuXG5cdFx0QiA9IHNlbGYuQmxvYiB8fCBzZWxmLk1vekJsb2IgfHwgc2VsZi5XZWJLaXRCbG9iIHx8IHosXG5cdFx0QkIgPSBzZWxmLk1TQmxvYkJ1aWxkZXIgfHwgc2VsZi5XZWJLaXRCbG9iQnVpbGRlciB8fCBzZWxmLkJsb2JCdWlsZGVyLFxuXHRcdGZuID0gc3RyRmlsZU5hbWUgfHwgXCJkb3dubG9hZFwiLFxuXHRcdGJsb2IsXG5cdFx0Yixcblx0XHR1YSxcblx0XHRmcjtcblxuXHQvL2lmKHR5cGVvZiBCLmJpbmQgPT09ICdmdW5jdGlvbicgKXsgQj1CLmJpbmQoc2VsZik7IH1cblxuXHRpZihTdHJpbmcodGhpcyk9PT1cInRydWVcIil7IC8vcmV2ZXJzZSBhcmd1bWVudHMsIGFsbG93aW5nIGRvd25sb2FkLmJpbmQodHJ1ZSwgXCJ0ZXh0L3htbFwiLCBcImV4cG9ydC54bWxcIikgdG8gYWN0IGFzIGEgY2FsbGJhY2tcblx0XHR4PVt4LCBtXTtcblx0XHRtPXhbMF07XG5cdFx0eD14WzFdO1xuXHR9XG5cblxuXG5cdC8vZ28gYWhlYWQgYW5kIGRvd25sb2FkIGRhdGFVUkxzIHJpZ2h0IGF3YXlcblx0aWYoU3RyaW5nKHgpLm1hdGNoKC9eZGF0YVxcOltcXHcrXFwtXStcXC9bXFx3K1xcLV0rWyw7XS8pKXtcblx0XHRyZXR1cm4gbmF2aWdhdG9yLm1zU2F2ZUJsb2IgPyAgLy8gSUUxMCBjYW4ndCBkbyBhW2Rvd25sb2FkXSwgb25seSBCbG9iczpcblx0XHRcdG5hdmlnYXRvci5tc1NhdmVCbG9iKGQyYih4KSwgZm4pIDpcblx0XHRcdHNhdmVyKHgpIDsgLy8gZXZlcnlvbmUgZWxzZSBjYW4gc2F2ZSBkYXRhVVJMcyB1bi1wcm9jZXNzZWRcblx0fS8vZW5kIGlmIGRhdGFVUkwgcGFzc2VkP1xuXG5cdHRyeXtcblxuXHRcdGJsb2IgPSB4IGluc3RhbmNlb2YgQiA/XG5cdFx0XHR4IDpcblx0XHRcdG5ldyBCKFt4XSwge3R5cGU6IG19KSA7XG5cdH1jYXRjaCh5KXtcblx0XHRpZihCQil7XG5cdFx0XHRiID0gbmV3IEJCKCk7XG5cdFx0XHRiLmFwcGVuZChbeF0pO1xuXHRcdFx0YmxvYiA9IGIuZ2V0QmxvYihtKTsgLy8gdGhlIGJsb2Jcblx0XHR9XG5cblx0fVxuXG5cblxuXHRmdW5jdGlvbiBkMmIodSkge1xuXHRcdHZhciBwPSB1LnNwbGl0KC9bOjssXS8pLFxuXHRcdHQ9IHBbMV0sXG5cdFx0ZGVjPSBwWzJdID09IFwiYmFzZTY0XCIgPyBhdG9iIDogZGVjb2RlVVJJQ29tcG9uZW50LFxuXHRcdGJpbj0gZGVjKHAucG9wKCkpLFxuXHRcdG14PSBiaW4ubGVuZ3RoLFxuXHRcdGk9IDAsXG5cdFx0dWlhPSBuZXcgVWludDhBcnJheShteCk7XG5cblx0XHRmb3IoaTtpPG14OysraSkgdWlhW2ldPSBiaW4uY2hhckNvZGVBdChpKTtcblxuXHRcdHJldHVybiBuZXcgQihbdWlhXSwge3R5cGU6IHR9KTtcblx0IH1cblxuXHRmdW5jdGlvbiBzYXZlcih1cmwsIHdpbk1vZGUpe1xuXG5cblx0XHRpZiAoJ2Rvd25sb2FkJyBpbiBhKSB7IC8vaHRtbDUgQVtkb3dubG9hZF1cblx0XHRcdGEuaHJlZiA9IHVybDtcblx0XHRcdGEuc2V0QXR0cmlidXRlKFwiZG93bmxvYWRcIiwgZm4pO1xuXHRcdFx0YS5pbm5lckhUTUwgPSBcImRvd25sb2FkaW5nLi4uXCI7XG5cdFx0XHRhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRELmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRhLmNsaWNrKCk7XG5cdFx0XHRcdEQuYm9keS5yZW1vdmVDaGlsZChhKTtcblx0XHRcdFx0aWYod2luTW9kZT09PXRydWUpe3NldFRpbWVvdXQoZnVuY3Rpb24oKXsgc2VsZi5VUkwucmV2b2tlT2JqZWN0VVJMKGEuaHJlZik7fSwgMjUwICk7fVxuXHRcdFx0fSwgNjYpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly9kbyBpZnJhbWUgZGF0YVVSTCBkb3dubG9hZCAob2xkIGNoK0ZGKTpcblx0XHR2YXIgZiA9IEQuY3JlYXRlRWxlbWVudChcImlmcmFtZVwiKTtcblx0XHRELmJvZHkuYXBwZW5kQ2hpbGQoZik7XG5cdFx0aWYoIXdpbk1vZGUpeyAvLyBmb3JjZSBhIG1pbWUgdGhhdCB3aWxsIGRvd25sb2FkOlxuXHRcdFx0dXJsPVwiZGF0YTpcIit1cmwucmVwbGFjZSgvXmRhdGE6KFtcXHdcXC9cXC1cXCtdKykvLCB1KTtcblx0XHR9XG5cblxuXHRcdGYuc3JjID0gdXJsO1xuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXsgRC5ib2R5LnJlbW92ZUNoaWxkKGYpOyB9LCAzMzMpO1xuXG5cdH0vL2VuZCBzYXZlclxuXG5cblx0aWYgKG5hdmlnYXRvci5tc1NhdmVCbG9iKSB7IC8vIElFMTArIDogKGhhcyBCbG9iLCBidXQgbm90IGFbZG93bmxvYWRdIG9yIFVSTClcblx0XHRyZXR1cm4gbmF2aWdhdG9yLm1zU2F2ZUJsb2IoYmxvYiwgZm4pO1xuXHR9XG5cblx0aWYoc2VsZi5VUkwpeyAvLyBzaW1wbGUgZmFzdCBhbmQgbW9kZXJuIHdheSB1c2luZyBCbG9iIGFuZCBVUkw6XG5cdFx0c2F2ZXIoc2VsZi5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpLCB0cnVlKTtcblx0fWVsc2V7XG5cdFx0Ly8gaGFuZGxlIG5vbi1CbG9iKCkrbm9uLVVSTCBicm93c2Vyczpcblx0XHRpZih0eXBlb2YgYmxvYiA9PT0gXCJzdHJpbmdcIiB8fCBibG9iLmNvbnN0cnVjdG9yPT09eiApe1xuXHRcdFx0dHJ5e1xuXHRcdFx0XHRyZXR1cm4gc2F2ZXIoIFwiZGF0YTpcIiArICBtICAgKyBcIjtiYXNlNjQsXCIgICsgIHNlbGYuYnRvYShibG9iKSAgKTtcblx0XHRcdH1jYXRjaCh5KXtcblx0XHRcdFx0cmV0dXJuIHNhdmVyKCBcImRhdGE6XCIgKyAgbSAgICsgXCIsXCIgKyBlbmNvZGVVUklDb21wb25lbnQoYmxvYikgICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQmxvYiBidXQgbm90IFVSTDpcblx0XHRmcj1uZXcgRmlsZVJlYWRlcigpO1xuXHRcdGZyLm9ubG9hZD1mdW5jdGlvbihlKXtcblx0XHRcdHNhdmVyKHRoaXMucmVzdWx0KTtcblx0XHR9O1xuXHRcdGZyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG5cdH1cblx0cmV0dXJuIHRydWU7XG59IC8qIGVuZCBkb3dubG9hZCgpICovXG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZG93bmxvYWQ7XG59XG4iLCIvLyBnaWYuanMgMC4yLjAgLSBodHRwczovL2dpdGh1Yi5jb20vam5vcmRiZXJnL2dpZi5qc1xyXG4oZnVuY3Rpb24oZil7aWYodHlwZW9mIGV4cG9ydHM9PT1cIm9iamVjdFwiJiZ0eXBlb2YgbW9kdWxlIT09XCJ1bmRlZmluZWRcIil7bW9kdWxlLmV4cG9ydHM9ZigpfWVsc2UgaWYodHlwZW9mIGRlZmluZT09PVwiZnVuY3Rpb25cIiYmZGVmaW5lLmFtZCl7ZGVmaW5lKFtdLGYpfWVsc2V7dmFyIGc7aWYodHlwZW9mIHdpbmRvdyE9PVwidW5kZWZpbmVkXCIpe2c9d2luZG93fWVsc2UgaWYodHlwZW9mIGdsb2JhbCE9PVwidW5kZWZpbmVkXCIpe2c9Z2xvYmFsfWVsc2UgaWYodHlwZW9mIHNlbGYhPT1cInVuZGVmaW5lZFwiKXtnPXNlbGZ9ZWxzZXtnPXRoaXN9Zy5HSUY9ZigpfX0pKGZ1bmN0aW9uKCl7dmFyIGRlZmluZSxtb2R1bGUsZXhwb3J0cztyZXR1cm4gZnVuY3Rpb24oKXtmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc31yZXR1cm4gZX0oKSh7MTpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7ZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCl7dGhpcy5fZXZlbnRzPXRoaXMuX2V2ZW50c3x8e307dGhpcy5fbWF4TGlzdGVuZXJzPXRoaXMuX21heExpc3RlbmVyc3x8dW5kZWZpbmVkfW1vZHVsZS5leHBvcnRzPUV2ZW50RW1pdHRlcjtFdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyPUV2ZW50RW1pdHRlcjtFdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHM9dW5kZWZpbmVkO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycz11bmRlZmluZWQ7RXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM9MTA7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnM9ZnVuY3Rpb24obil7aWYoIWlzTnVtYmVyKG4pfHxuPDB8fGlzTmFOKG4pKXRocm93IFR5cGVFcnJvcihcIm4gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiKTt0aGlzLl9tYXhMaXN0ZW5lcnM9bjtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0PWZ1bmN0aW9uKHR5cGUpe3ZhciBlcixoYW5kbGVyLGxlbixhcmdzLGksbGlzdGVuZXJzO2lmKCF0aGlzLl9ldmVudHMpdGhpcy5fZXZlbnRzPXt9O2lmKHR5cGU9PT1cImVycm9yXCIpe2lmKCF0aGlzLl9ldmVudHMuZXJyb3J8fGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikmJiF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKXtlcj1hcmd1bWVudHNbMV07aWYoZXIgaW5zdGFuY2VvZiBFcnJvcil7dGhyb3cgZXJ9ZWxzZXt2YXIgZXJyPW5ldyBFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4gKCcrZXIrXCIpXCIpO2Vyci5jb250ZXh0PWVyO3Rocm93IGVycn19fWhhbmRsZXI9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzVW5kZWZpbmVkKGhhbmRsZXIpKXJldHVybiBmYWxzZTtpZihpc0Z1bmN0aW9uKGhhbmRsZXIpKXtzd2l0Y2goYXJndW1lbnRzLmxlbmd0aCl7Y2FzZSAxOmhhbmRsZXIuY2FsbCh0aGlzKTticmVhaztjYXNlIDI6aGFuZGxlci5jYWxsKHRoaXMsYXJndW1lbnRzWzFdKTticmVhaztjYXNlIDM6aGFuZGxlci5jYWxsKHRoaXMsYXJndW1lbnRzWzFdLGFyZ3VtZW50c1syXSk7YnJlYWs7ZGVmYXVsdDphcmdzPUFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKTtoYW5kbGVyLmFwcGx5KHRoaXMsYXJncyl9fWVsc2UgaWYoaXNPYmplY3QoaGFuZGxlcikpe2FyZ3M9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpO2xpc3RlbmVycz1oYW5kbGVyLnNsaWNlKCk7bGVuPWxpc3RlbmVycy5sZW5ndGg7Zm9yKGk9MDtpPGxlbjtpKyspbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsYXJncyl9cmV0dXJuIHRydWV9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7dmFyIG07aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTtpZighdGhpcy5fZXZlbnRzKXRoaXMuX2V2ZW50cz17fTtpZih0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpdGhpcy5lbWl0KFwibmV3TGlzdGVuZXJcIix0eXBlLGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpP2xpc3RlbmVyLmxpc3RlbmVyOmxpc3RlbmVyKTtpZighdGhpcy5fZXZlbnRzW3R5cGVdKXRoaXMuX2V2ZW50c1t0eXBlXT1saXN0ZW5lcjtlbHNlIGlmKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO2Vsc2UgdGhpcy5fZXZlbnRzW3R5cGVdPVt0aGlzLl9ldmVudHNbdHlwZV0sbGlzdGVuZXJdO2lmKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkmJiF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKXtpZighaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSl7bT10aGlzLl9tYXhMaXN0ZW5lcnN9ZWxzZXttPUV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzfWlmKG0mJm0+MCYmdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aD5tKXt0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkPXRydWU7Y29uc29sZS5lcnJvcihcIihub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5IFwiK1wibGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiBcIitcIlVzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LlwiLHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO2lmKHR5cGVvZiBjb25zb2xlLnRyYWNlPT09XCJmdW5jdGlvblwiKXtjb25zb2xlLnRyYWNlKCl9fX1yZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbj1FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO0V2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZT1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO3ZhciBmaXJlZD1mYWxzZTtmdW5jdGlvbiBnKCl7dGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGcpO2lmKCFmaXJlZCl7ZmlyZWQ9dHJ1ZTtsaXN0ZW5lci5hcHBseSh0aGlzLGFyZ3VtZW50cyl9fWcubGlzdGVuZXI9bGlzdGVuZXI7dGhpcy5vbih0eXBlLGcpO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe3ZhciBsaXN0LHBvc2l0aW9uLGxlbmd0aCxpO2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7aWYoIXRoaXMuX2V2ZW50c3x8IXRoaXMuX2V2ZW50c1t0eXBlXSlyZXR1cm4gdGhpcztsaXN0PXRoaXMuX2V2ZW50c1t0eXBlXTtsZW5ndGg9bGlzdC5sZW5ndGg7cG9zaXRpb249LTE7aWYobGlzdD09PWxpc3RlbmVyfHxpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpJiZsaXN0Lmxpc3RlbmVyPT09bGlzdGVuZXIpe2RlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07aWYodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsdHlwZSxsaXN0ZW5lcil9ZWxzZSBpZihpc09iamVjdChsaXN0KSl7Zm9yKGk9bGVuZ3RoO2ktLSA+MDspe2lmKGxpc3RbaV09PT1saXN0ZW5lcnx8bGlzdFtpXS5saXN0ZW5lciYmbGlzdFtpXS5saXN0ZW5lcj09PWxpc3RlbmVyKXtwb3NpdGlvbj1pO2JyZWFrfX1pZihwb3NpdGlvbjwwKXJldHVybiB0aGlzO2lmKGxpc3QubGVuZ3RoPT09MSl7bGlzdC5sZW5ndGg9MDtkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdfWVsc2V7bGlzdC5zcGxpY2UocG9zaXRpb24sMSl9aWYodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsdHlwZSxsaXN0ZW5lcil9cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzPWZ1bmN0aW9uKHR5cGUpe3ZhciBrZXksbGlzdGVuZXJzO2lmKCF0aGlzLl9ldmVudHMpcmV0dXJuIHRoaXM7aWYoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil7aWYoYXJndW1lbnRzLmxlbmd0aD09PTApdGhpcy5fZXZlbnRzPXt9O2Vsc2UgaWYodGhpcy5fZXZlbnRzW3R5cGVdKWRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07cmV0dXJuIHRoaXN9aWYoYXJndW1lbnRzLmxlbmd0aD09PTApe2ZvcihrZXkgaW4gdGhpcy5fZXZlbnRzKXtpZihrZXk9PT1cInJlbW92ZUxpc3RlbmVyXCIpY29udGludWU7dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KX10aGlzLnJlbW92ZUFsbExpc3RlbmVycyhcInJlbW92ZUxpc3RlbmVyXCIpO3RoaXMuX2V2ZW50cz17fTtyZXR1cm4gdGhpc31saXN0ZW5lcnM9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzRnVuY3Rpb24obGlzdGVuZXJzKSl7dGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGxpc3RlbmVycyl9ZWxzZSBpZihsaXN0ZW5lcnMpe3doaWxlKGxpc3RlbmVycy5sZW5ndGgpdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoLTFdKX1kZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycz1mdW5jdGlvbih0eXBlKXt2YXIgcmV0O2lmKCF0aGlzLl9ldmVudHN8fCF0aGlzLl9ldmVudHNbdHlwZV0pcmV0PVtdO2Vsc2UgaWYoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKXJldD1bdGhpcy5fZXZlbnRzW3R5cGVdXTtlbHNlIHJldD10aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtyZXR1cm4gcmV0fTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQ9ZnVuY3Rpb24odHlwZSl7aWYodGhpcy5fZXZlbnRzKXt2YXIgZXZsaXN0ZW5lcj10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlyZXR1cm4gMTtlbHNlIGlmKGV2bGlzdGVuZXIpcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RofXJldHVybiAwfTtFdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudD1mdW5jdGlvbihlbWl0dGVyLHR5cGUpe3JldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSl9O2Z1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwiZnVuY3Rpb25cIn1mdW5jdGlvbiBpc051bWJlcihhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJudW1iZXJcIn1mdW5jdGlvbiBpc09iamVjdChhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJvYmplY3RcIiYmYXJnIT09bnVsbH1mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpe3JldHVybiBhcmc9PT12b2lkIDB9fSx7fV0sMjpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIE5ldVF1YW50PXJlcXVpcmUoXCIuL1R5cGVkTmV1UXVhbnQuanNcIik7dmFyIExaV0VuY29kZXI9cmVxdWlyZShcIi4vTFpXRW5jb2Rlci5qc1wiKTtmdW5jdGlvbiBCeXRlQXJyYXkoKXt0aGlzLnBhZ2U9LTE7dGhpcy5wYWdlcz1bXTt0aGlzLm5ld1BhZ2UoKX1CeXRlQXJyYXkucGFnZVNpemU9NDA5NjtCeXRlQXJyYXkuY2hhck1hcD17fTtmb3IodmFyIGk9MDtpPDI1NjtpKyspQnl0ZUFycmF5LmNoYXJNYXBbaV09U3RyaW5nLmZyb21DaGFyQ29kZShpKTtCeXRlQXJyYXkucHJvdG90eXBlLm5ld1BhZ2U9ZnVuY3Rpb24oKXt0aGlzLnBhZ2VzWysrdGhpcy5wYWdlXT1uZXcgVWludDhBcnJheShCeXRlQXJyYXkucGFnZVNpemUpO3RoaXMuY3Vyc29yPTB9O0J5dGVBcnJheS5wcm90b3R5cGUuZ2V0RGF0YT1mdW5jdGlvbigpe3ZhciBydj1cIlwiO2Zvcih2YXIgcD0wO3A8dGhpcy5wYWdlcy5sZW5ndGg7cCsrKXtmb3IodmFyIGk9MDtpPEJ5dGVBcnJheS5wYWdlU2l6ZTtpKyspe3J2Kz1CeXRlQXJyYXkuY2hhck1hcFt0aGlzLnBhZ2VzW3BdW2ldXX19cmV0dXJuIHJ2fTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlQnl0ZT1mdW5jdGlvbih2YWwpe2lmKHRoaXMuY3Vyc29yPj1CeXRlQXJyYXkucGFnZVNpemUpdGhpcy5uZXdQYWdlKCk7dGhpcy5wYWdlc1t0aGlzLnBhZ2VdW3RoaXMuY3Vyc29yKytdPXZhbH07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZVVURkJ5dGVzPWZ1bmN0aW9uKHN0cmluZyl7Zm9yKHZhciBsPXN0cmluZy5sZW5ndGgsaT0wO2k8bDtpKyspdGhpcy53cml0ZUJ5dGUoc3RyaW5nLmNoYXJDb2RlQXQoaSkpfTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlQnl0ZXM9ZnVuY3Rpb24oYXJyYXksb2Zmc2V0LGxlbmd0aCl7Zm9yKHZhciBsPWxlbmd0aHx8YXJyYXkubGVuZ3RoLGk9b2Zmc2V0fHwwO2k8bDtpKyspdGhpcy53cml0ZUJ5dGUoYXJyYXlbaV0pfTtmdW5jdGlvbiBHSUZFbmNvZGVyKHdpZHRoLGhlaWdodCl7dGhpcy53aWR0aD1+fndpZHRoO3RoaXMuaGVpZ2h0PX5+aGVpZ2h0O3RoaXMudHJhbnNwYXJlbnQ9bnVsbDt0aGlzLnRyYW5zSW5kZXg9MDt0aGlzLnJlcGVhdD0tMTt0aGlzLmRlbGF5PTA7dGhpcy5pbWFnZT1udWxsO3RoaXMucGl4ZWxzPW51bGw7dGhpcy5pbmRleGVkUGl4ZWxzPW51bGw7dGhpcy5jb2xvckRlcHRoPW51bGw7dGhpcy5jb2xvclRhYj1udWxsO3RoaXMubmV1UXVhbnQ9bnVsbDt0aGlzLnVzZWRFbnRyeT1uZXcgQXJyYXk7dGhpcy5wYWxTaXplPTc7dGhpcy5kaXNwb3NlPS0xO3RoaXMuZmlyc3RGcmFtZT10cnVlO3RoaXMuc2FtcGxlPTEwO3RoaXMuZGl0aGVyPWZhbHNlO3RoaXMuZ2xvYmFsUGFsZXR0ZT1mYWxzZTt0aGlzLm91dD1uZXcgQnl0ZUFycmF5fUdJRkVuY29kZXIucHJvdG90eXBlLnNldERlbGF5PWZ1bmN0aW9uKG1pbGxpc2Vjb25kcyl7dGhpcy5kZWxheT1NYXRoLnJvdW5kKG1pbGxpc2Vjb25kcy8xMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldEZyYW1lUmF0ZT1mdW5jdGlvbihmcHMpe3RoaXMuZGVsYXk9TWF0aC5yb3VuZCgxMDAvZnBzKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGlzcG9zZT1mdW5jdGlvbihkaXNwb3NhbENvZGUpe2lmKGRpc3Bvc2FsQ29kZT49MCl0aGlzLmRpc3Bvc2U9ZGlzcG9zYWxDb2RlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRSZXBlYXQ9ZnVuY3Rpb24ocmVwZWF0KXt0aGlzLnJlcGVhdD1yZXBlYXR9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFRyYW5zcGFyZW50PWZ1bmN0aW9uKGNvbG9yKXt0aGlzLnRyYW5zcGFyZW50PWNvbG9yfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGRGcmFtZT1mdW5jdGlvbihpbWFnZURhdGEpe3RoaXMuaW1hZ2U9aW1hZ2VEYXRhO3RoaXMuY29sb3JUYWI9dGhpcy5nbG9iYWxQYWxldHRlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2U/dGhpcy5nbG9iYWxQYWxldHRlOm51bGw7dGhpcy5nZXRJbWFnZVBpeGVscygpO3RoaXMuYW5hbHl6ZVBpeGVscygpO2lmKHRoaXMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpdGhpcy5nbG9iYWxQYWxldHRlPXRoaXMuY29sb3JUYWI7aWYodGhpcy5maXJzdEZyYW1lKXt0aGlzLndyaXRlTFNEKCk7dGhpcy53cml0ZVBhbGV0dGUoKTtpZih0aGlzLnJlcGVhdD49MCl7dGhpcy53cml0ZU5ldHNjYXBlRXh0KCl9fXRoaXMud3JpdGVHcmFwaGljQ3RybEV4dCgpO3RoaXMud3JpdGVJbWFnZURlc2MoKTtpZighdGhpcy5maXJzdEZyYW1lJiYhdGhpcy5nbG9iYWxQYWxldHRlKXRoaXMud3JpdGVQYWxldHRlKCk7dGhpcy53cml0ZVBpeGVscygpO3RoaXMuZmlyc3RGcmFtZT1mYWxzZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluaXNoPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDU5KX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0UXVhbGl0eT1mdW5jdGlvbihxdWFsaXR5KXtpZihxdWFsaXR5PDEpcXVhbGl0eT0xO3RoaXMuc2FtcGxlPXF1YWxpdHl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldERpdGhlcj1mdW5jdGlvbihkaXRoZXIpe2lmKGRpdGhlcj09PXRydWUpZGl0aGVyPVwiRmxveWRTdGVpbmJlcmdcIjt0aGlzLmRpdGhlcj1kaXRoZXJ9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldEdsb2JhbFBhbGV0dGU9ZnVuY3Rpb24ocGFsZXR0ZSl7dGhpcy5nbG9iYWxQYWxldHRlPXBhbGV0dGV9O0dJRkVuY29kZXIucHJvdG90eXBlLmdldEdsb2JhbFBhbGV0dGU9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5nbG9iYWxQYWxldHRlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2UmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZSgwKXx8dGhpcy5nbG9iYWxQYWxldHRlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUhlYWRlcj1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlVVRGQnl0ZXMoXCJHSUY4OWFcIil9O0dJRkVuY29kZXIucHJvdG90eXBlLmFuYWx5emVQaXhlbHM9ZnVuY3Rpb24oKXtpZighdGhpcy5jb2xvclRhYil7dGhpcy5uZXVRdWFudD1uZXcgTmV1UXVhbnQodGhpcy5waXhlbHMsdGhpcy5zYW1wbGUpO3RoaXMubmV1UXVhbnQuYnVpbGRDb2xvcm1hcCgpO3RoaXMuY29sb3JUYWI9dGhpcy5uZXVRdWFudC5nZXRDb2xvcm1hcCgpfWlmKHRoaXMuZGl0aGVyKXt0aGlzLmRpdGhlclBpeGVscyh0aGlzLmRpdGhlci5yZXBsYWNlKFwiLXNlcnBlbnRpbmVcIixcIlwiKSx0aGlzLmRpdGhlci5tYXRjaCgvLXNlcnBlbnRpbmUvKSE9PW51bGwpfWVsc2V7dGhpcy5pbmRleFBpeGVscygpfXRoaXMucGl4ZWxzPW51bGw7dGhpcy5jb2xvckRlcHRoPTg7dGhpcy5wYWxTaXplPTc7aWYodGhpcy50cmFuc3BhcmVudCE9PW51bGwpe3RoaXMudHJhbnNJbmRleD10aGlzLmZpbmRDbG9zZXN0KHRoaXMudHJhbnNwYXJlbnQsdHJ1ZSl9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5pbmRleFBpeGVscz1mdW5jdGlvbihpbWdxKXt2YXIgblBpeD10aGlzLnBpeGVscy5sZW5ndGgvMzt0aGlzLmluZGV4ZWRQaXhlbHM9bmV3IFVpbnQ4QXJyYXkoblBpeCk7dmFyIGs9MDtmb3IodmFyIGo9MDtqPG5QaXg7aisrKXt2YXIgaW5kZXg9dGhpcy5maW5kQ2xvc2VzdFJHQih0aGlzLnBpeGVsc1trKytdJjI1NSx0aGlzLnBpeGVsc1trKytdJjI1NSx0aGlzLnBpeGVsc1trKytdJjI1NSk7dGhpcy51c2VkRW50cnlbaW5kZXhdPXRydWU7dGhpcy5pbmRleGVkUGl4ZWxzW2pdPWluZGV4fX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZGl0aGVyUGl4ZWxzPWZ1bmN0aW9uKGtlcm5lbCxzZXJwZW50aW5lKXt2YXIga2VybmVscz17RmFsc2VGbG95ZFN0ZWluYmVyZzpbWzMvOCwxLDBdLFszLzgsMCwxXSxbMi84LDEsMV1dLEZsb3lkU3RlaW5iZXJnOltbNy8xNiwxLDBdLFszLzE2LC0xLDFdLFs1LzE2LDAsMV0sWzEvMTYsMSwxXV0sU3R1Y2tpOltbOC80MiwxLDBdLFs0LzQyLDIsMF0sWzIvNDIsLTIsMV0sWzQvNDIsLTEsMV0sWzgvNDIsMCwxXSxbNC80MiwxLDFdLFsyLzQyLDIsMV0sWzEvNDIsLTIsMl0sWzIvNDIsLTEsMl0sWzQvNDIsMCwyXSxbMi80MiwxLDJdLFsxLzQyLDIsMl1dLEF0a2luc29uOltbMS84LDEsMF0sWzEvOCwyLDBdLFsxLzgsLTEsMV0sWzEvOCwwLDFdLFsxLzgsMSwxXSxbMS84LDAsMl1dfTtpZigha2VybmVsfHwha2VybmVsc1trZXJuZWxdKXt0aHJvd1wiVW5rbm93biBkaXRoZXJpbmcga2VybmVsOiBcIitrZXJuZWx9dmFyIGRzPWtlcm5lbHNba2VybmVsXTt2YXIgaW5kZXg9MCxoZWlnaHQ9dGhpcy5oZWlnaHQsd2lkdGg9dGhpcy53aWR0aCxkYXRhPXRoaXMucGl4ZWxzO3ZhciBkaXJlY3Rpb249c2VycGVudGluZT8tMToxO3RoaXMuaW5kZXhlZFBpeGVscz1uZXcgVWludDhBcnJheSh0aGlzLnBpeGVscy5sZW5ndGgvMyk7Zm9yKHZhciB5PTA7eTxoZWlnaHQ7eSsrKXtpZihzZXJwZW50aW5lKWRpcmVjdGlvbj1kaXJlY3Rpb24qLTE7Zm9yKHZhciB4PWRpcmVjdGlvbj09MT8wOndpZHRoLTEseGVuZD1kaXJlY3Rpb249PTE/d2lkdGg6MDt4IT09eGVuZDt4Kz1kaXJlY3Rpb24pe2luZGV4PXkqd2lkdGgreDt2YXIgaWR4PWluZGV4KjM7dmFyIHIxPWRhdGFbaWR4XTt2YXIgZzE9ZGF0YVtpZHgrMV07dmFyIGIxPWRhdGFbaWR4KzJdO2lkeD10aGlzLmZpbmRDbG9zZXN0UkdCKHIxLGcxLGIxKTt0aGlzLnVzZWRFbnRyeVtpZHhdPXRydWU7dGhpcy5pbmRleGVkUGl4ZWxzW2luZGV4XT1pZHg7aWR4Kj0zO3ZhciByMj10aGlzLmNvbG9yVGFiW2lkeF07dmFyIGcyPXRoaXMuY29sb3JUYWJbaWR4KzFdO3ZhciBiMj10aGlzLmNvbG9yVGFiW2lkeCsyXTt2YXIgZXI9cjEtcjI7dmFyIGVnPWcxLWcyO3ZhciBlYj1iMS1iMjtmb3IodmFyIGk9ZGlyZWN0aW9uPT0xPzA6ZHMubGVuZ3RoLTEsZW5kPWRpcmVjdGlvbj09MT9kcy5sZW5ndGg6MDtpIT09ZW5kO2krPWRpcmVjdGlvbil7dmFyIHgxPWRzW2ldWzFdO3ZhciB5MT1kc1tpXVsyXTtpZih4MSt4Pj0wJiZ4MSt4PHdpZHRoJiZ5MSt5Pj0wJiZ5MSt5PGhlaWdodCl7dmFyIGQ9ZHNbaV1bMF07aWR4PWluZGV4K3gxK3kxKndpZHRoO2lkeCo9MztkYXRhW2lkeF09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHhdK2VyKmQpKTtkYXRhW2lkeCsxXT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeCsxXStlZypkKSk7ZGF0YVtpZHgrMl09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHgrMl0rZWIqZCkpfX19fX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluZENsb3Nlc3Q9ZnVuY3Rpb24oYyx1c2VkKXtyZXR1cm4gdGhpcy5maW5kQ2xvc2VzdFJHQigoYyYxNjcxMTY4MCk+PjE2LChjJjY1MjgwKT4+OCxjJjI1NSx1c2VkKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluZENsb3Nlc3RSR0I9ZnVuY3Rpb24ocixnLGIsdXNlZCl7aWYodGhpcy5jb2xvclRhYj09PW51bGwpcmV0dXJuLTE7aWYodGhpcy5uZXVRdWFudCYmIXVzZWQpe3JldHVybiB0aGlzLm5ldVF1YW50Lmxvb2t1cFJHQihyLGcsYil9dmFyIGM9YnxnPDw4fHI8PDE2O3ZhciBtaW5wb3M9MDt2YXIgZG1pbj0yNTYqMjU2KjI1Njt2YXIgbGVuPXRoaXMuY29sb3JUYWIubGVuZ3RoO2Zvcih2YXIgaT0wLGluZGV4PTA7aTxsZW47aW5kZXgrKyl7dmFyIGRyPXItKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkZz1nLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZGI9Yi0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGQ9ZHIqZHIrZGcqZGcrZGIqZGI7aWYoKCF1c2VkfHx0aGlzLnVzZWRFbnRyeVtpbmRleF0pJiZkPGRtaW4pe2RtaW49ZDttaW5wb3M9aW5kZXh9fXJldHVybiBtaW5wb3N9O0dJRkVuY29kZXIucHJvdG90eXBlLmdldEltYWdlUGl4ZWxzPWZ1bmN0aW9uKCl7dmFyIHc9dGhpcy53aWR0aDt2YXIgaD10aGlzLmhlaWdodDt0aGlzLnBpeGVscz1uZXcgVWludDhBcnJheSh3KmgqMyk7dmFyIGRhdGE9dGhpcy5pbWFnZTt2YXIgc3JjUG9zPTA7dmFyIGNvdW50PTA7Zm9yKHZhciBpPTA7aTxoO2krKyl7Zm9yKHZhciBqPTA7ajx3O2orKyl7dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107c3JjUG9zKyt9fX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVHcmFwaGljQ3RybEV4dD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSgzMyk7dGhpcy5vdXQud3JpdGVCeXRlKDI0OSk7dGhpcy5vdXQud3JpdGVCeXRlKDQpO3ZhciB0cmFuc3AsZGlzcDtpZih0aGlzLnRyYW5zcGFyZW50PT09bnVsbCl7dHJhbnNwPTA7ZGlzcD0wfWVsc2V7dHJhbnNwPTE7ZGlzcD0yfWlmKHRoaXMuZGlzcG9zZT49MCl7ZGlzcD10aGlzLmRpc3Bvc2UmN31kaXNwPDw9Mjt0aGlzLm91dC53cml0ZUJ5dGUoMHxkaXNwfDB8dHJhbnNwKTt0aGlzLndyaXRlU2hvcnQodGhpcy5kZWxheSk7dGhpcy5vdXQud3JpdGVCeXRlKHRoaXMudHJhbnNJbmRleCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUltYWdlRGVzYz1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSg0NCk7dGhpcy53cml0ZVNob3J0KDApO3RoaXMud3JpdGVTaG9ydCgwKTt0aGlzLndyaXRlU2hvcnQodGhpcy53aWR0aCk7dGhpcy53cml0ZVNob3J0KHRoaXMuaGVpZ2h0KTtpZih0aGlzLmZpcnN0RnJhbWV8fHRoaXMuZ2xvYmFsUGFsZXR0ZSl7dGhpcy5vdXQud3JpdGVCeXRlKDApfWVsc2V7dGhpcy5vdXQud3JpdGVCeXRlKDEyOHwwfDB8MHx0aGlzLnBhbFNpemUpfX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVMU0Q9ZnVuY3Rpb24oKXt0aGlzLndyaXRlU2hvcnQodGhpcy53aWR0aCk7dGhpcy53cml0ZVNob3J0KHRoaXMuaGVpZ2h0KTt0aGlzLm91dC53cml0ZUJ5dGUoMTI4fDExMnwwfHRoaXMucGFsU2l6ZSk7dGhpcy5vdXQud3JpdGVCeXRlKDApO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVOZXRzY2FwZUV4dD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSgzMyk7dGhpcy5vdXQud3JpdGVCeXRlKDI1NSk7dGhpcy5vdXQud3JpdGVCeXRlKDExKTt0aGlzLm91dC53cml0ZVVURkJ5dGVzKFwiTkVUU0NBUEUyLjBcIik7dGhpcy5vdXQud3JpdGVCeXRlKDMpO3RoaXMub3V0LndyaXRlQnl0ZSgxKTt0aGlzLndyaXRlU2hvcnQodGhpcy5yZXBlYXQpO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVQYWxldHRlPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlcyh0aGlzLmNvbG9yVGFiKTt2YXIgbj0zKjI1Ni10aGlzLmNvbG9yVGFiLmxlbmd0aDtmb3IodmFyIGk9MDtpPG47aSsrKXRoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVTaG9ydD1mdW5jdGlvbihwVmFsdWUpe3RoaXMub3V0LndyaXRlQnl0ZShwVmFsdWUmMjU1KTt0aGlzLm91dC53cml0ZUJ5dGUocFZhbHVlPj44JjI1NSl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlUGl4ZWxzPWZ1bmN0aW9uKCl7dmFyIGVuYz1uZXcgTFpXRW5jb2Rlcih0aGlzLndpZHRoLHRoaXMuaGVpZ2h0LHRoaXMuaW5kZXhlZFBpeGVscyx0aGlzLmNvbG9yRGVwdGgpO2VuYy5lbmNvZGUodGhpcy5vdXQpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zdHJlYW09ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5vdXR9O21vZHVsZS5leHBvcnRzPUdJRkVuY29kZXJ9LHtcIi4vTFpXRW5jb2Rlci5qc1wiOjMsXCIuL1R5cGVkTmV1UXVhbnQuanNcIjo0fV0sMzpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEVPRj0tMTt2YXIgQklUUz0xMjt2YXIgSFNJWkU9NTAwMzt2YXIgbWFza3M9WzAsMSwzLDcsMTUsMzEsNjMsMTI3LDI1NSw1MTEsMTAyMywyMDQ3LDQwOTUsODE5MSwxNjM4MywzMjc2Nyw2NTUzNV07ZnVuY3Rpb24gTFpXRW5jb2Rlcih3aWR0aCxoZWlnaHQscGl4ZWxzLGNvbG9yRGVwdGgpe3ZhciBpbml0Q29kZVNpemU9TWF0aC5tYXgoMixjb2xvckRlcHRoKTt2YXIgYWNjdW09bmV3IFVpbnQ4QXJyYXkoMjU2KTt2YXIgaHRhYj1uZXcgSW50MzJBcnJheShIU0laRSk7dmFyIGNvZGV0YWI9bmV3IEludDMyQXJyYXkoSFNJWkUpO3ZhciBjdXJfYWNjdW0sY3VyX2JpdHM9MDt2YXIgYV9jb3VudDt2YXIgZnJlZV9lbnQ9MDt2YXIgbWF4Y29kZTt2YXIgY2xlYXJfZmxnPWZhbHNlO3ZhciBnX2luaXRfYml0cyxDbGVhckNvZGUsRU9GQ29kZTtmdW5jdGlvbiBjaGFyX291dChjLG91dHMpe2FjY3VtW2FfY291bnQrK109YztpZihhX2NvdW50Pj0yNTQpZmx1c2hfY2hhcihvdXRzKX1mdW5jdGlvbiBjbF9ibG9jayhvdXRzKXtjbF9oYXNoKEhTSVpFKTtmcmVlX2VudD1DbGVhckNvZGUrMjtjbGVhcl9mbGc9dHJ1ZTtvdXRwdXQoQ2xlYXJDb2RlLG91dHMpfWZ1bmN0aW9uIGNsX2hhc2goaHNpemUpe2Zvcih2YXIgaT0wO2k8aHNpemU7KytpKWh0YWJbaV09LTF9ZnVuY3Rpb24gY29tcHJlc3MoaW5pdF9iaXRzLG91dHMpe3ZhciBmY29kZSxjLGksZW50LGRpc3AsaHNpemVfcmVnLGhzaGlmdDtnX2luaXRfYml0cz1pbml0X2JpdHM7Y2xlYXJfZmxnPWZhbHNlO25fYml0cz1nX2luaXRfYml0czttYXhjb2RlPU1BWENPREUobl9iaXRzKTtDbGVhckNvZGU9MTw8aW5pdF9iaXRzLTE7RU9GQ29kZT1DbGVhckNvZGUrMTtmcmVlX2VudD1DbGVhckNvZGUrMjthX2NvdW50PTA7ZW50PW5leHRQaXhlbCgpO2hzaGlmdD0wO2ZvcihmY29kZT1IU0laRTtmY29kZTw2NTUzNjtmY29kZSo9MikrK2hzaGlmdDtoc2hpZnQ9OC1oc2hpZnQ7aHNpemVfcmVnPUhTSVpFO2NsX2hhc2goaHNpemVfcmVnKTtvdXRwdXQoQ2xlYXJDb2RlLG91dHMpO291dGVyX2xvb3A6d2hpbGUoKGM9bmV4dFBpeGVsKCkpIT1FT0Ype2Zjb2RlPShjPDxCSVRTKStlbnQ7aT1jPDxoc2hpZnReZW50O2lmKGh0YWJbaV09PT1mY29kZSl7ZW50PWNvZGV0YWJbaV07Y29udGludWV9ZWxzZSBpZihodGFiW2ldPj0wKXtkaXNwPWhzaXplX3JlZy1pO2lmKGk9PT0wKWRpc3A9MTtkb3tpZigoaS09ZGlzcCk8MClpKz1oc2l6ZV9yZWc7aWYoaHRhYltpXT09PWZjb2RlKXtlbnQ9Y29kZXRhYltpXTtjb250aW51ZSBvdXRlcl9sb29wfX13aGlsZShodGFiW2ldPj0wKX1vdXRwdXQoZW50LG91dHMpO2VudD1jO2lmKGZyZWVfZW50PDE8PEJJVFMpe2NvZGV0YWJbaV09ZnJlZV9lbnQrKztodGFiW2ldPWZjb2RlfWVsc2V7Y2xfYmxvY2sob3V0cyl9fW91dHB1dChlbnQsb3V0cyk7b3V0cHV0KEVPRkNvZGUsb3V0cyl9ZnVuY3Rpb24gZW5jb2RlKG91dHMpe291dHMud3JpdGVCeXRlKGluaXRDb2RlU2l6ZSk7cmVtYWluaW5nPXdpZHRoKmhlaWdodDtjdXJQaXhlbD0wO2NvbXByZXNzKGluaXRDb2RlU2l6ZSsxLG91dHMpO291dHMud3JpdGVCeXRlKDApfWZ1bmN0aW9uIGZsdXNoX2NoYXIob3V0cyl7aWYoYV9jb3VudD4wKXtvdXRzLndyaXRlQnl0ZShhX2NvdW50KTtvdXRzLndyaXRlQnl0ZXMoYWNjdW0sMCxhX2NvdW50KTthX2NvdW50PTB9fWZ1bmN0aW9uIE1BWENPREUobl9iaXRzKXtyZXR1cm4oMTw8bl9iaXRzKS0xfWZ1bmN0aW9uIG5leHRQaXhlbCgpe2lmKHJlbWFpbmluZz09PTApcmV0dXJuIEVPRjstLXJlbWFpbmluZzt2YXIgcGl4PXBpeGVsc1tjdXJQaXhlbCsrXTtyZXR1cm4gcGl4JjI1NX1mdW5jdGlvbiBvdXRwdXQoY29kZSxvdXRzKXtjdXJfYWNjdW0mPW1hc2tzW2N1cl9iaXRzXTtpZihjdXJfYml0cz4wKWN1cl9hY2N1bXw9Y29kZTw8Y3VyX2JpdHM7ZWxzZSBjdXJfYWNjdW09Y29kZTtjdXJfYml0cys9bl9iaXRzO3doaWxlKGN1cl9iaXRzPj04KXtjaGFyX291dChjdXJfYWNjdW0mMjU1LG91dHMpO2N1cl9hY2N1bT4+PTg7Y3VyX2JpdHMtPTh9aWYoZnJlZV9lbnQ+bWF4Y29kZXx8Y2xlYXJfZmxnKXtpZihjbGVhcl9mbGcpe21heGNvZGU9TUFYQ09ERShuX2JpdHM9Z19pbml0X2JpdHMpO2NsZWFyX2ZsZz1mYWxzZX1lbHNleysrbl9iaXRzO2lmKG5fYml0cz09QklUUyltYXhjb2RlPTE8PEJJVFM7ZWxzZSBtYXhjb2RlPU1BWENPREUobl9iaXRzKX19aWYoY29kZT09RU9GQ29kZSl7d2hpbGUoY3VyX2JpdHM+MCl7Y2hhcl9vdXQoY3VyX2FjY3VtJjI1NSxvdXRzKTtjdXJfYWNjdW0+Pj04O2N1cl9iaXRzLT04fWZsdXNoX2NoYXIob3V0cyl9fXRoaXMuZW5jb2RlPWVuY29kZX1tb2R1bGUuZXhwb3J0cz1MWldFbmNvZGVyfSx7fV0sNDpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIG5jeWNsZXM9MTAwO3ZhciBuZXRzaXplPTI1Njt2YXIgbWF4bmV0cG9zPW5ldHNpemUtMTt2YXIgbmV0Ymlhc3NoaWZ0PTQ7dmFyIGludGJpYXNzaGlmdD0xNjt2YXIgaW50Ymlhcz0xPDxpbnRiaWFzc2hpZnQ7dmFyIGdhbW1hc2hpZnQ9MTA7dmFyIGdhbW1hPTE8PGdhbW1hc2hpZnQ7dmFyIGJldGFzaGlmdD0xMDt2YXIgYmV0YT1pbnRiaWFzPj5iZXRhc2hpZnQ7dmFyIGJldGFnYW1tYT1pbnRiaWFzPDxnYW1tYXNoaWZ0LWJldGFzaGlmdDt2YXIgaW5pdHJhZD1uZXRzaXplPj4zO3ZhciByYWRpdXNiaWFzc2hpZnQ9Njt2YXIgcmFkaXVzYmlhcz0xPDxyYWRpdXNiaWFzc2hpZnQ7dmFyIGluaXRyYWRpdXM9aW5pdHJhZCpyYWRpdXNiaWFzO3ZhciByYWRpdXNkZWM9MzA7dmFyIGFscGhhYmlhc3NoaWZ0PTEwO3ZhciBpbml0YWxwaGE9MTw8YWxwaGFiaWFzc2hpZnQ7dmFyIGFscGhhZGVjO3ZhciByYWRiaWFzc2hpZnQ9ODt2YXIgcmFkYmlhcz0xPDxyYWRiaWFzc2hpZnQ7dmFyIGFscGhhcmFkYnNoaWZ0PWFscGhhYmlhc3NoaWZ0K3JhZGJpYXNzaGlmdDt2YXIgYWxwaGFyYWRiaWFzPTE8PGFscGhhcmFkYnNoaWZ0O3ZhciBwcmltZTE9NDk5O3ZhciBwcmltZTI9NDkxO3ZhciBwcmltZTM9NDg3O3ZhciBwcmltZTQ9NTAzO3ZhciBtaW5waWN0dXJlYnl0ZXM9MypwcmltZTQ7ZnVuY3Rpb24gTmV1UXVhbnQocGl4ZWxzLHNhbXBsZWZhYyl7dmFyIG5ldHdvcms7dmFyIG5ldGluZGV4O3ZhciBiaWFzO3ZhciBmcmVxO3ZhciByYWRwb3dlcjtmdW5jdGlvbiBpbml0KCl7bmV0d29yaz1bXTtuZXRpbmRleD1uZXcgSW50MzJBcnJheSgyNTYpO2JpYXM9bmV3IEludDMyQXJyYXkobmV0c2l6ZSk7ZnJlcT1uZXcgSW50MzJBcnJheShuZXRzaXplKTtyYWRwb3dlcj1uZXcgSW50MzJBcnJheShuZXRzaXplPj4zKTt2YXIgaSx2O2ZvcihpPTA7aTxuZXRzaXplO2krKyl7dj0oaTw8bmV0Ymlhc3NoaWZ0KzgpL25ldHNpemU7bmV0d29ya1tpXT1uZXcgRmxvYXQ2NEFycmF5KFt2LHYsdiwwXSk7ZnJlcVtpXT1pbnRiaWFzL25ldHNpemU7Ymlhc1tpXT0wfX1mdW5jdGlvbiB1bmJpYXNuZXQoKXtmb3IodmFyIGk9MDtpPG5ldHNpemU7aSsrKXtuZXR3b3JrW2ldWzBdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bMV0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVsyXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzNdPWl9fWZ1bmN0aW9uIGFsdGVyc2luZ2xlKGFscGhhLGksYixnLHIpe25ldHdvcmtbaV1bMF0tPWFscGhhKihuZXR3b3JrW2ldWzBdLWIpL2luaXRhbHBoYTtuZXR3b3JrW2ldWzFdLT1hbHBoYSoobmV0d29ya1tpXVsxXS1nKS9pbml0YWxwaGE7bmV0d29ya1tpXVsyXS09YWxwaGEqKG5ldHdvcmtbaV1bMl0tcikvaW5pdGFscGhhfWZ1bmN0aW9uIGFsdGVybmVpZ2gocmFkaXVzLGksYixnLHIpe3ZhciBsbz1NYXRoLmFicyhpLXJhZGl1cyk7dmFyIGhpPU1hdGgubWluKGkrcmFkaXVzLG5ldHNpemUpO3ZhciBqPWkrMTt2YXIgaz1pLTE7dmFyIG09MTt2YXIgcCxhO3doaWxlKGo8aGl8fGs+bG8pe2E9cmFkcG93ZXJbbSsrXTtpZihqPGhpKXtwPW5ldHdvcmtbaisrXTtwWzBdLT1hKihwWzBdLWIpL2FscGhhcmFkYmlhcztwWzFdLT1hKihwWzFdLWcpL2FscGhhcmFkYmlhcztwWzJdLT1hKihwWzJdLXIpL2FscGhhcmFkYmlhc31pZihrPmxvKXtwPW5ldHdvcmtbay0tXTtwWzBdLT1hKihwWzBdLWIpL2FscGhhcmFkYmlhcztwWzFdLT1hKihwWzFdLWcpL2FscGhhcmFkYmlhcztwWzJdLT1hKihwWzJdLXIpL2FscGhhcmFkYmlhc319fWZ1bmN0aW9uIGNvbnRlc3QoYixnLHIpe3ZhciBiZXN0ZD1+KDE8PDMxKTt2YXIgYmVzdGJpYXNkPWJlc3RkO3ZhciBiZXN0cG9zPS0xO3ZhciBiZXN0Ymlhc3Bvcz1iZXN0cG9zO3ZhciBpLG4sZGlzdCxiaWFzZGlzdCxiZXRhZnJlcTtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe249bmV0d29ya1tpXTtkaXN0PU1hdGguYWJzKG5bMF0tYikrTWF0aC5hYnMoblsxXS1nKStNYXRoLmFicyhuWzJdLXIpO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdHBvcz1pfWJpYXNkaXN0PWRpc3QtKGJpYXNbaV0+PmludGJpYXNzaGlmdC1uZXRiaWFzc2hpZnQpO2lmKGJpYXNkaXN0PGJlc3RiaWFzZCl7YmVzdGJpYXNkPWJpYXNkaXN0O2Jlc3RiaWFzcG9zPWl9YmV0YWZyZXE9ZnJlcVtpXT4+YmV0YXNoaWZ0O2ZyZXFbaV0tPWJldGFmcmVxO2JpYXNbaV0rPWJldGFmcmVxPDxnYW1tYXNoaWZ0fWZyZXFbYmVzdHBvc10rPWJldGE7Ymlhc1tiZXN0cG9zXS09YmV0YWdhbW1hO3JldHVybiBiZXN0Ymlhc3Bvc31mdW5jdGlvbiBpbnhidWlsZCgpe3ZhciBpLGoscCxxLHNtYWxscG9zLHNtYWxsdmFsLHByZXZpb3VzY29sPTAsc3RhcnRwb3M9MDtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe3A9bmV0d29ya1tpXTtzbWFsbHBvcz1pO3NtYWxsdmFsPXBbMV07Zm9yKGo9aSsxO2o8bmV0c2l6ZTtqKyspe3E9bmV0d29ya1tqXTtpZihxWzFdPHNtYWxsdmFsKXtzbWFsbHBvcz1qO3NtYWxsdmFsPXFbMV19fXE9bmV0d29ya1tzbWFsbHBvc107aWYoaSE9c21hbGxwb3Mpe2o9cVswXTtxWzBdPXBbMF07cFswXT1qO2o9cVsxXTtxWzFdPXBbMV07cFsxXT1qO2o9cVsyXTtxWzJdPXBbMl07cFsyXT1qO2o9cVszXTtxWzNdPXBbM107cFszXT1qfWlmKHNtYWxsdmFsIT1wcmV2aW91c2NvbCl7bmV0aW5kZXhbcHJldmlvdXNjb2xdPXN0YXJ0cG9zK2k+PjE7Zm9yKGo9cHJldmlvdXNjb2wrMTtqPHNtYWxsdmFsO2orKyluZXRpbmRleFtqXT1pO3ByZXZpb3VzY29sPXNtYWxsdmFsO3N0YXJ0cG9zPWl9fW5ldGluZGV4W3ByZXZpb3VzY29sXT1zdGFydHBvcyttYXhuZXRwb3M+PjE7Zm9yKGo9cHJldmlvdXNjb2wrMTtqPDI1NjtqKyspbmV0aW5kZXhbal09bWF4bmV0cG9zfWZ1bmN0aW9uIGlueHNlYXJjaChiLGcscil7dmFyIGEscCxkaXN0O3ZhciBiZXN0ZD0xZTM7dmFyIGJlc3Q9LTE7dmFyIGk9bmV0aW5kZXhbZ107dmFyIGo9aS0xO3doaWxlKGk8bmV0c2l6ZXx8aj49MCl7aWYoaTxuZXRzaXplKXtwPW5ldHdvcmtbaV07ZGlzdD1wWzFdLWc7aWYoZGlzdD49YmVzdGQpaT1uZXRzaXplO2Vsc2V7aSsrO2lmKGRpc3Q8MClkaXN0PS1kaXN0O2E9cFswXS1iO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YT1wWzJdLXI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Q9cFszXX19fX1pZihqPj0wKXtwPW5ldHdvcmtbal07ZGlzdD1nLXBbMV07aWYoZGlzdD49YmVzdGQpaj0tMTtlbHNle2otLTtpZihkaXN0PDApZGlzdD0tZGlzdDthPXBbMF0tYjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2E9cFsyXS1yO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0PXBbM119fX19fXJldHVybiBiZXN0fWZ1bmN0aW9uIGxlYXJuKCl7dmFyIGk7dmFyIGxlbmd0aGNvdW50PXBpeGVscy5sZW5ndGg7dmFyIGFscGhhZGVjPTMwKyhzYW1wbGVmYWMtMSkvMzt2YXIgc2FtcGxlcGl4ZWxzPWxlbmd0aGNvdW50LygzKnNhbXBsZWZhYyk7dmFyIGRlbHRhPX5+KHNhbXBsZXBpeGVscy9uY3ljbGVzKTt2YXIgYWxwaGE9aW5pdGFscGhhO3ZhciByYWRpdXM9aW5pdHJhZGl1czt2YXIgcmFkPXJhZGl1cz4+cmFkaXVzYmlhc3NoaWZ0O2lmKHJhZDw9MSlyYWQ9MDtmb3IoaT0wO2k8cmFkO2krKylyYWRwb3dlcltpXT1hbHBoYSooKHJhZCpyYWQtaSppKSpyYWRiaWFzLyhyYWQqcmFkKSk7dmFyIHN0ZXA7aWYobGVuZ3RoY291bnQ8bWlucGljdHVyZWJ5dGVzKXtzYW1wbGVmYWM9MTtzdGVwPTN9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTEhPT0wKXtzdGVwPTMqcHJpbWUxfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUyIT09MCl7c3RlcD0zKnByaW1lMn1lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMyE9PTApe3N0ZXA9MypwcmltZTN9ZWxzZXtzdGVwPTMqcHJpbWU0fXZhciBiLGcscixqO3ZhciBwaXg9MDtpPTA7d2hpbGUoaTxzYW1wbGVwaXhlbHMpe2I9KHBpeGVsc1twaXhdJjI1NSk8PG5ldGJpYXNzaGlmdDtnPShwaXhlbHNbcGl4KzFdJjI1NSk8PG5ldGJpYXNzaGlmdDtyPShwaXhlbHNbcGl4KzJdJjI1NSk8PG5ldGJpYXNzaGlmdDtqPWNvbnRlc3QoYixnLHIpO2FsdGVyc2luZ2xlKGFscGhhLGosYixnLHIpO2lmKHJhZCE9PTApYWx0ZXJuZWlnaChyYWQsaixiLGcscik7cGl4Kz1zdGVwO2lmKHBpeD49bGVuZ3RoY291bnQpcGl4LT1sZW5ndGhjb3VudDtpKys7aWYoZGVsdGE9PT0wKWRlbHRhPTE7aWYoaSVkZWx0YT09PTApe2FscGhhLT1hbHBoYS9hbHBoYWRlYztyYWRpdXMtPXJhZGl1cy9yYWRpdXNkZWM7cmFkPXJhZGl1cz4+cmFkaXVzYmlhc3NoaWZ0O2lmKHJhZDw9MSlyYWQ9MDtmb3Ioaj0wO2o8cmFkO2orKylyYWRwb3dlcltqXT1hbHBoYSooKHJhZCpyYWQtaipqKSpyYWRiaWFzLyhyYWQqcmFkKSl9fX1mdW5jdGlvbiBidWlsZENvbG9ybWFwKCl7aW5pdCgpO2xlYXJuKCk7dW5iaWFzbmV0KCk7aW54YnVpbGQoKX10aGlzLmJ1aWxkQ29sb3JtYXA9YnVpbGRDb2xvcm1hcDtmdW5jdGlvbiBnZXRDb2xvcm1hcCgpe3ZhciBtYXA9W107dmFyIGluZGV4PVtdO2Zvcih2YXIgaT0wO2k8bmV0c2l6ZTtpKyspaW5kZXhbbmV0d29ya1tpXVszXV09aTt2YXIgaz0wO2Zvcih2YXIgbD0wO2w8bmV0c2l6ZTtsKyspe3ZhciBqPWluZGV4W2xdO21hcFtrKytdPW5ldHdvcmtbal1bMF07bWFwW2srK109bmV0d29ya1tqXVsxXTttYXBbaysrXT1uZXR3b3JrW2pdWzJdfXJldHVybiBtYXB9dGhpcy5nZXRDb2xvcm1hcD1nZXRDb2xvcm1hcDt0aGlzLmxvb2t1cFJHQj1pbnhzZWFyY2h9bW9kdWxlLmV4cG9ydHM9TmV1UXVhbnR9LHt9XSw1OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgVUEsYnJvd3Nlcixtb2RlLHBsYXRmb3JtLHVhO3VhPW5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtwbGF0Zm9ybT1uYXZpZ2F0b3IucGxhdGZvcm0udG9Mb3dlckNhc2UoKTtVQT11YS5tYXRjaCgvKG9wZXJhfGllfGZpcmVmb3h8Y2hyb21lfHZlcnNpb24pW1xcc1xcLzpdKFtcXHdcXGRcXC5dKyk/Lio/KHNhZmFyaXx2ZXJzaW9uW1xcc1xcLzpdKFtcXHdcXGRcXC5dKyl8JCkvKXx8W251bGwsXCJ1bmtub3duXCIsMF07bW9kZT1VQVsxXT09PVwiaWVcIiYmZG9jdW1lbnQuZG9jdW1lbnRNb2RlO2Jyb3dzZXI9e25hbWU6VUFbMV09PT1cInZlcnNpb25cIj9VQVszXTpVQVsxXSx2ZXJzaW9uOm1vZGV8fHBhcnNlRmxvYXQoVUFbMV09PT1cIm9wZXJhXCImJlVBWzRdP1VBWzRdOlVBWzJdKSxwbGF0Zm9ybTp7bmFtZTp1YS5tYXRjaCgvaXAoPzphZHxvZHxob25lKS8pP1wiaW9zXCI6KHVhLm1hdGNoKC8oPzp3ZWJvc3xhbmRyb2lkKS8pfHxwbGF0Zm9ybS5tYXRjaCgvbWFjfHdpbnxsaW51eC8pfHxbXCJvdGhlclwiXSlbMF19fTticm93c2VyW2Jyb3dzZXIubmFtZV09dHJ1ZTticm93c2VyW2Jyb3dzZXIubmFtZStwYXJzZUludChicm93c2VyLnZlcnNpb24sMTApXT10cnVlO2Jyb3dzZXIucGxhdGZvcm1bYnJvd3Nlci5wbGF0Zm9ybS5uYW1lXT10cnVlO21vZHVsZS5leHBvcnRzPWJyb3dzZXJ9LHt9XSw2OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgRXZlbnRFbWl0dGVyLEdJRixHSUZFbmNvZGVyLGJyb3dzZXIsZ2lmV29ya2VyLGV4dGVuZD1mdW5jdGlvbihjaGlsZCxwYXJlbnQpe2Zvcih2YXIga2V5IGluIHBhcmVudCl7aWYoaGFzUHJvcC5jYWxsKHBhcmVudCxrZXkpKWNoaWxkW2tleV09cGFyZW50W2tleV19ZnVuY3Rpb24gY3Rvcigpe3RoaXMuY29uc3RydWN0b3I9Y2hpbGR9Y3Rvci5wcm90b3R5cGU9cGFyZW50LnByb3RvdHlwZTtjaGlsZC5wcm90b3R5cGU9bmV3IGN0b3I7Y2hpbGQuX19zdXBlcl9fPXBhcmVudC5wcm90b3R5cGU7cmV0dXJuIGNoaWxkfSxoYXNQcm9wPXt9Lmhhc093blByb3BlcnR5LGluZGV4T2Y9W10uaW5kZXhPZnx8ZnVuY3Rpb24oaXRlbSl7Zm9yKHZhciBpPTAsbD10aGlzLmxlbmd0aDtpPGw7aSsrKXtpZihpIGluIHRoaXMmJnRoaXNbaV09PT1pdGVtKXJldHVybiBpfXJldHVybi0xfSxzbGljZT1bXS5zbGljZTtFdmVudEVtaXR0ZXI9cmVxdWlyZShcImV2ZW50c1wiKS5FdmVudEVtaXR0ZXI7YnJvd3Nlcj1yZXF1aXJlKFwiLi9icm93c2VyLmNvZmZlZVwiKTtHSUZFbmNvZGVyPXJlcXVpcmUoXCIuL0dJRkVuY29kZXIuanNcIik7Z2lmV29ya2VyPXJlcXVpcmUoXCIuL2dpZi53b3JrZXIuY29mZmVlXCIpO21vZHVsZS5leHBvcnRzPUdJRj1mdW5jdGlvbihzdXBlckNsYXNzKXt2YXIgZGVmYXVsdHMsZnJhbWVEZWZhdWx0cztleHRlbmQoR0lGLHN1cGVyQ2xhc3MpO2RlZmF1bHRzPXt3b3JrZXJTY3JpcHQ6XCJnaWYud29ya2VyLmpzXCIsd29ya2VyczoyLHJlcGVhdDowLGJhY2tncm91bmQ6XCIjZmZmXCIscXVhbGl0eToxMCx3aWR0aDpudWxsLGhlaWdodDpudWxsLHRyYW5zcGFyZW50Om51bGwsZGVidWc6ZmFsc2UsZGl0aGVyOmZhbHNlfTtmcmFtZURlZmF1bHRzPXtkZWxheTo1MDAsY29weTpmYWxzZSxkaXNwb3NlOi0xfTtmdW5jdGlvbiBHSUYob3B0aW9ucyl7dmFyIGJhc2Usa2V5LHZhbHVlO3RoaXMucnVubmluZz1mYWxzZTt0aGlzLm9wdGlvbnM9e307dGhpcy5mcmFtZXM9W107dGhpcy5mcmVlV29ya2Vycz1bXTt0aGlzLmFjdGl2ZVdvcmtlcnM9W107dGhpcy5zZXRPcHRpb25zKG9wdGlvbnMpO2ZvcihrZXkgaW4gZGVmYXVsdHMpe3ZhbHVlPWRlZmF1bHRzW2tleV07aWYoKGJhc2U9dGhpcy5vcHRpb25zKVtrZXldPT1udWxsKXtiYXNlW2tleV09dmFsdWV9fX1HSUYucHJvdG90eXBlLnNldE9wdGlvbj1mdW5jdGlvbihrZXksdmFsdWUpe3RoaXMub3B0aW9uc1trZXldPXZhbHVlO2lmKHRoaXMuX2NhbnZhcyE9bnVsbCYmKGtleT09PVwid2lkdGhcInx8a2V5PT09XCJoZWlnaHRcIikpe3JldHVybiB0aGlzLl9jYW52YXNba2V5XT12YWx1ZX19O0dJRi5wcm90b3R5cGUuc2V0T3B0aW9ucz1mdW5jdGlvbihvcHRpb25zKXt2YXIga2V5LHJlc3VsdHMsdmFsdWU7cmVzdWx0cz1bXTtmb3Ioa2V5IGluIG9wdGlvbnMpe2lmKCFoYXNQcm9wLmNhbGwob3B0aW9ucyxrZXkpKWNvbnRpbnVlO3ZhbHVlPW9wdGlvbnNba2V5XTtyZXN1bHRzLnB1c2godGhpcy5zZXRPcHRpb24oa2V5LHZhbHVlKSl9cmV0dXJuIHJlc3VsdHN9O0dJRi5wcm90b3R5cGUuYWRkRnJhbWU9ZnVuY3Rpb24oaW1hZ2Usb3B0aW9ucyl7dmFyIGZyYW1lLGtleTtpZihvcHRpb25zPT1udWxsKXtvcHRpb25zPXt9fWZyYW1lPXt9O2ZyYW1lLnRyYW5zcGFyZW50PXRoaXMub3B0aW9ucy50cmFuc3BhcmVudDtmb3Ioa2V5IGluIGZyYW1lRGVmYXVsdHMpe2ZyYW1lW2tleV09b3B0aW9uc1trZXldfHxmcmFtZURlZmF1bHRzW2tleV19aWYodGhpcy5vcHRpb25zLndpZHRoPT1udWxsKXt0aGlzLnNldE9wdGlvbihcIndpZHRoXCIsaW1hZ2Uud2lkdGgpfWlmKHRoaXMub3B0aW9ucy5oZWlnaHQ9PW51bGwpe3RoaXMuc2V0T3B0aW9uKFwiaGVpZ2h0XCIsaW1hZ2UuaGVpZ2h0KX1pZih0eXBlb2YgSW1hZ2VEYXRhIT09XCJ1bmRlZmluZWRcIiYmSW1hZ2VEYXRhIT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBJbWFnZURhdGEpe2ZyYW1lLmRhdGE9aW1hZ2UuZGF0YX1lbHNlIGlmKHR5cGVvZiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQhPT1cInVuZGVmaW5lZFwiJiZDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRHx8dHlwZW9mIFdlYkdMUmVuZGVyaW5nQ29udGV4dCE9PVwidW5kZWZpbmVkXCImJldlYkdMUmVuZGVyaW5nQ29udGV4dCE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgV2ViR0xSZW5kZXJpbmdDb250ZXh0KXtpZihvcHRpb25zLmNvcHkpe2ZyYW1lLmRhdGE9dGhpcy5nZXRDb250ZXh0RGF0YShpbWFnZSl9ZWxzZXtmcmFtZS5jb250ZXh0PWltYWdlfX1lbHNlIGlmKGltYWdlLmNoaWxkTm9kZXMhPW51bGwpe2lmKG9wdGlvbnMuY29weSl7ZnJhbWUuZGF0YT10aGlzLmdldEltYWdlRGF0YShpbWFnZSl9ZWxzZXtmcmFtZS5pbWFnZT1pbWFnZX19ZWxzZXt0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGltYWdlXCIpfXJldHVybiB0aGlzLmZyYW1lcy5wdXNoKGZyYW1lKX07R0lGLnByb3RvdHlwZS5yZW5kZXI9ZnVuY3Rpb24oKXt2YXIgaSxqLG51bVdvcmtlcnMscmVmO2lmKHRoaXMucnVubmluZyl7dGhyb3cgbmV3IEVycm9yKFwiQWxyZWFkeSBydW5uaW5nXCIpfWlmKHRoaXMub3B0aW9ucy53aWR0aD09bnVsbHx8dGhpcy5vcHRpb25zLmhlaWdodD09bnVsbCl7dGhyb3cgbmV3IEVycm9yKFwiV2lkdGggYW5kIGhlaWdodCBtdXN0IGJlIHNldCBwcmlvciB0byByZW5kZXJpbmdcIil9dGhpcy5ydW5uaW5nPXRydWU7dGhpcy5uZXh0RnJhbWU9MDt0aGlzLmZpbmlzaGVkRnJhbWVzPTA7dGhpcy5pbWFnZVBhcnRzPWZ1bmN0aW9uKCl7dmFyIGoscmVmLHJlc3VsdHM7cmVzdWx0cz1bXTtmb3IoaT1qPTAscmVmPXRoaXMuZnJhbWVzLmxlbmd0aDswPD1yZWY/ajxyZWY6aj5yZWY7aT0wPD1yZWY/KytqOi0tail7cmVzdWx0cy5wdXNoKG51bGwpfXJldHVybiByZXN1bHRzfS5jYWxsKHRoaXMpO251bVdvcmtlcnM9dGhpcy5zcGF3bldvcmtlcnMoKTtpZih0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9ZWxzZXtmb3IoaT1qPTAscmVmPW51bVdvcmtlcnM7MDw9cmVmP2o8cmVmOmo+cmVmO2k9MDw9cmVmPysrajotLWope3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9fXRoaXMuZW1pdChcInN0YXJ0XCIpO3JldHVybiB0aGlzLmVtaXQoXCJwcm9ncmVzc1wiLDApfTtHSUYucHJvdG90eXBlLmFib3J0PWZ1bmN0aW9uKCl7dmFyIHdvcmtlcjt3aGlsZSh0cnVlKXt3b3JrZXI9dGhpcy5hY3RpdmVXb3JrZXJzLnNoaWZ0KCk7aWYod29ya2VyPT1udWxsKXticmVha310aGlzLmxvZyhcImtpbGxpbmcgYWN0aXZlIHdvcmtlclwiKTt3b3JrZXIudGVybWluYXRlKCl9dGhpcy5ydW5uaW5nPWZhbHNlO3JldHVybiB0aGlzLmVtaXQoXCJhYm9ydFwiKX07R0lGLnByb3RvdHlwZS5zcGF3bldvcmtlcnM9ZnVuY3Rpb24oKXt2YXIgaixudW1Xb3JrZXJzLHJlZixyZXN1bHRzO251bVdvcmtlcnM9TWF0aC5taW4odGhpcy5vcHRpb25zLndvcmtlcnMsdGhpcy5mcmFtZXMubGVuZ3RoKTsoZnVuY3Rpb24oKXtyZXN1bHRzPVtdO2Zvcih2YXIgaj1yZWY9dGhpcy5mcmVlV29ya2Vycy5sZW5ndGg7cmVmPD1udW1Xb3JrZXJzP2o8bnVtV29ya2VyczpqPm51bVdvcmtlcnM7cmVmPD1udW1Xb3JrZXJzP2orKzpqLS0pe3Jlc3VsdHMucHVzaChqKX1yZXR1cm4gcmVzdWx0c30pLmFwcGx5KHRoaXMpLmZvckVhY2goZnVuY3Rpb24oX3RoaXMpe3JldHVybiBmdW5jdGlvbihpKXt2YXIgd29ya2VyO190aGlzLmxvZyhcInNwYXduaW5nIHdvcmtlciBcIitpKTt3b3JrZXI9bmV3IFdvcmtlcihfdGhpcy5vcHRpb25zLndvcmtlclNjcmlwdCk7d29ya2VyLm9ubWVzc2FnZT1mdW5jdGlvbihldmVudCl7X3RoaXMuYWN0aXZlV29ya2Vycy5zcGxpY2UoX3RoaXMuYWN0aXZlV29ya2Vycy5pbmRleE9mKHdvcmtlciksMSk7X3RoaXMuZnJlZVdvcmtlcnMucHVzaCh3b3JrZXIpO3JldHVybiBfdGhpcy5mcmFtZUZpbmlzaGVkKGV2ZW50LmRhdGEpfTtyZXR1cm4gX3RoaXMuZnJlZVdvcmtlcnMucHVzaCh3b3JrZXIpfX0odGhpcykpO3JldHVybiBudW1Xb3JrZXJzfTtHSUYucHJvdG90eXBlLmZyYW1lRmluaXNoZWQ9ZnVuY3Rpb24oZnJhbWUpe3ZhciBpLGoscmVmO3RoaXMubG9nKFwiZnJhbWUgXCIrZnJhbWUuaW5kZXgrXCIgZmluaXNoZWQgLSBcIit0aGlzLmFjdGl2ZVdvcmtlcnMubGVuZ3RoK1wiIGFjdGl2ZVwiKTt0aGlzLmZpbmlzaGVkRnJhbWVzKys7dGhpcy5lbWl0KFwicHJvZ3Jlc3NcIix0aGlzLmZpbmlzaGVkRnJhbWVzL3RoaXMuZnJhbWVzLmxlbmd0aCk7dGhpcy5pbWFnZVBhcnRzW2ZyYW1lLmluZGV4XT1mcmFtZTtpZih0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe3RoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPWZyYW1lLmdsb2JhbFBhbGV0dGU7dGhpcy5sb2coXCJnbG9iYWwgcGFsZXR0ZSBhbmFseXplZFwiKTtpZih0aGlzLmZyYW1lcy5sZW5ndGg+Mil7Zm9yKGk9aj0xLHJlZj10aGlzLmZyZWVXb3JrZXJzLmxlbmd0aDsxPD1yZWY/ajxyZWY6aj5yZWY7aT0xPD1yZWY/KytqOi0tail7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX19fWlmKGluZGV4T2YuY2FsbCh0aGlzLmltYWdlUGFydHMsbnVsbCk+PTApe3JldHVybiB0aGlzLnJlbmRlck5leHRGcmFtZSgpfWVsc2V7cmV0dXJuIHRoaXMuZmluaXNoUmVuZGVyaW5nKCl9fTtHSUYucHJvdG90eXBlLmZpbmlzaFJlbmRlcmluZz1mdW5jdGlvbigpe3ZhciBkYXRhLGZyYW1lLGksaW1hZ2UsaixrLGwsbGVuLGxlbjEsbGVuMixsZW4zLG9mZnNldCxwYWdlLHJlZixyZWYxLHJlZjI7bGVuPTA7cmVmPXRoaXMuaW1hZ2VQYXJ0cztmb3Ioaj0wLGxlbjE9cmVmLmxlbmd0aDtqPGxlbjE7aisrKXtmcmFtZT1yZWZbal07bGVuKz0oZnJhbWUuZGF0YS5sZW5ndGgtMSkqZnJhbWUucGFnZVNpemUrZnJhbWUuY3Vyc29yfWxlbis9ZnJhbWUucGFnZVNpemUtZnJhbWUuY3Vyc29yO3RoaXMubG9nKFwicmVuZGVyaW5nIGZpbmlzaGVkIC0gZmlsZXNpemUgXCIrTWF0aC5yb3VuZChsZW4vMWUzKStcImtiXCIpO2RhdGE9bmV3IFVpbnQ4QXJyYXkobGVuKTtvZmZzZXQ9MDtyZWYxPXRoaXMuaW1hZ2VQYXJ0cztmb3Ioaz0wLGxlbjI9cmVmMS5sZW5ndGg7azxsZW4yO2srKyl7ZnJhbWU9cmVmMVtrXTtyZWYyPWZyYW1lLmRhdGE7Zm9yKGk9bD0wLGxlbjM9cmVmMi5sZW5ndGg7bDxsZW4zO2k9KytsKXtwYWdlPXJlZjJbaV07ZGF0YS5zZXQocGFnZSxvZmZzZXQpO2lmKGk9PT1mcmFtZS5kYXRhLmxlbmd0aC0xKXtvZmZzZXQrPWZyYW1lLmN1cnNvcn1lbHNle29mZnNldCs9ZnJhbWUucGFnZVNpemV9fX1pbWFnZT1uZXcgQmxvYihbZGF0YV0se3R5cGU6XCJpbWFnZS9naWZcIn0pO3JldHVybiB0aGlzLmVtaXQoXCJmaW5pc2hlZFwiLGltYWdlLGRhdGEpfTtHSUYucHJvdG90eXBlLnJlbmRlck5leHRGcmFtZT1mdW5jdGlvbigpe3ZhciBmcmFtZSx0YXNrLHdvcmtlcjtpZih0aGlzLmZyZWVXb3JrZXJzLmxlbmd0aD09PTApe3Rocm93IG5ldyBFcnJvcihcIk5vIGZyZWUgd29ya2Vyc1wiKX1pZih0aGlzLm5leHRGcmFtZT49dGhpcy5mcmFtZXMubGVuZ3RoKXtyZXR1cm59ZnJhbWU9dGhpcy5mcmFtZXNbdGhpcy5uZXh0RnJhbWUrK107d29ya2VyPXRoaXMuZnJlZVdvcmtlcnMuc2hpZnQoKTt0YXNrPXRoaXMuZ2V0VGFzayhmcmFtZSk7dGhpcy5sb2coXCJzdGFydGluZyBmcmFtZSBcIisodGFzay5pbmRleCsxKStcIiBvZiBcIit0aGlzLmZyYW1lcy5sZW5ndGgpO3RoaXMuYWN0aXZlV29ya2Vycy5wdXNoKHdvcmtlcik7cmV0dXJuIHdvcmtlci5wb3N0TWVzc2FnZSh0YXNrKX07R0lGLnByb3RvdHlwZS5nZXRDb250ZXh0RGF0YT1mdW5jdGlvbihjdHgpe3JldHVybiBjdHguZ2V0SW1hZ2VEYXRhKDAsMCx0aGlzLm9wdGlvbnMud2lkdGgsdGhpcy5vcHRpb25zLmhlaWdodCkuZGF0YX07R0lGLnByb3RvdHlwZS5nZXRJbWFnZURhdGE9ZnVuY3Rpb24oaW1hZ2Upe3ZhciBjdHg7aWYodGhpcy5fY2FudmFzPT1udWxsKXt0aGlzLl9jYW52YXM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTt0aGlzLl9jYW52YXMud2lkdGg9dGhpcy5vcHRpb25zLndpZHRoO3RoaXMuX2NhbnZhcy5oZWlnaHQ9dGhpcy5vcHRpb25zLmhlaWdodH1jdHg9dGhpcy5fY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtjdHguc2V0RmlsbD10aGlzLm9wdGlvbnMuYmFja2dyb3VuZDtjdHguZmlsbFJlY3QoMCwwLHRoaXMub3B0aW9ucy53aWR0aCx0aGlzLm9wdGlvbnMuaGVpZ2h0KTtjdHguZHJhd0ltYWdlKGltYWdlLDAsMCk7cmV0dXJuIHRoaXMuZ2V0Q29udGV4dERhdGEoY3R4KX07R0lGLnByb3RvdHlwZS5nZXRUYXNrPWZ1bmN0aW9uKGZyYW1lKXt2YXIgaW5kZXgsdGFzaztpbmRleD10aGlzLmZyYW1lcy5pbmRleE9mKGZyYW1lKTt0YXNrPXtpbmRleDppbmRleCxsYXN0OmluZGV4PT09dGhpcy5mcmFtZXMubGVuZ3RoLTEsZGVsYXk6ZnJhbWUuZGVsYXksZGlzcG9zZTpmcmFtZS5kaXNwb3NlLHRyYW5zcGFyZW50OmZyYW1lLnRyYW5zcGFyZW50LHdpZHRoOnRoaXMub3B0aW9ucy53aWR0aCxoZWlnaHQ6dGhpcy5vcHRpb25zLmhlaWdodCxxdWFsaXR5OnRoaXMub3B0aW9ucy5xdWFsaXR5LGRpdGhlcjp0aGlzLm9wdGlvbnMuZGl0aGVyLGdsb2JhbFBhbGV0dGU6dGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGUscmVwZWF0OnRoaXMub3B0aW9ucy5yZXBlYXQsY2FuVHJhbnNmZXI6YnJvd3Nlci5uYW1lPT09XCJjaHJvbWVcIn07aWYoZnJhbWUuZGF0YSE9bnVsbCl7dGFzay5kYXRhPWZyYW1lLmRhdGF9ZWxzZSBpZihmcmFtZS5jb250ZXh0IT1udWxsKXt0YXNrLmRhdGE9dGhpcy5nZXRDb250ZXh0RGF0YShmcmFtZS5jb250ZXh0KX1lbHNlIGlmKGZyYW1lLmltYWdlIT1udWxsKXt0YXNrLmRhdGE9dGhpcy5nZXRJbWFnZURhdGEoZnJhbWUuaW1hZ2UpfWVsc2V7dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBmcmFtZVwiKX1yZXR1cm4gdGFza307R0lGLnByb3RvdHlwZS5sb2c9ZnVuY3Rpb24oKXt2YXIgYXJnczthcmdzPTE8PWFyZ3VtZW50cy5sZW5ndGg/c2xpY2UuY2FsbChhcmd1bWVudHMsMCk6W107aWYoIXRoaXMub3B0aW9ucy5kZWJ1Zyl7cmV0dXJufXJldHVybiBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLGFyZ3MpfTtyZXR1cm4gR0lGfShFdmVudEVtaXR0ZXIpfSx7XCIuL0dJRkVuY29kZXIuanNcIjoyLFwiLi9icm93c2VyLmNvZmZlZVwiOjUsXCIuL2dpZi53b3JrZXIuY29mZmVlXCI6NyxldmVudHM6MX1dLDc6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBHSUZFbmNvZGVyLHJlbmRlckZyYW1lO0dJRkVuY29kZXI9cmVxdWlyZShcIi4vR0lGRW5jb2Rlci5qc1wiKTtyZW5kZXJGcmFtZT1mdW5jdGlvbihmcmFtZSl7dmFyIGVuY29kZXIscGFnZSxzdHJlYW0sdHJhbnNmZXI7ZW5jb2Rlcj1uZXcgR0lGRW5jb2RlcihmcmFtZS53aWR0aCxmcmFtZS5oZWlnaHQpO2lmKGZyYW1lLmluZGV4PT09MCl7ZW5jb2Rlci53cml0ZUhlYWRlcigpfWVsc2V7ZW5jb2Rlci5maXJzdEZyYW1lPWZhbHNlfWVuY29kZXIuc2V0VHJhbnNwYXJlbnQoZnJhbWUudHJhbnNwYXJlbnQpO2VuY29kZXIuc2V0RGlzcG9zZShmcmFtZS5kaXNwb3NlKTtlbmNvZGVyLnNldFJlcGVhdChmcmFtZS5yZXBlYXQpO2VuY29kZXIuc2V0RGVsYXkoZnJhbWUuZGVsYXkpO2VuY29kZXIuc2V0UXVhbGl0eShmcmFtZS5xdWFsaXR5KTtlbmNvZGVyLnNldERpdGhlcihmcmFtZS5kaXRoZXIpO2VuY29kZXIuc2V0R2xvYmFsUGFsZXR0ZShmcmFtZS5nbG9iYWxQYWxldHRlKTtlbmNvZGVyLmFkZEZyYW1lKGZyYW1lLmRhdGEpO2lmKGZyYW1lLmxhc3Qpe2VuY29kZXIuZmluaXNoKCl9aWYoZnJhbWUuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe2ZyYW1lLmdsb2JhbFBhbGV0dGU9ZW5jb2Rlci5nZXRHbG9iYWxQYWxldHRlKCl9c3RyZWFtPWVuY29kZXIuc3RyZWFtKCk7ZnJhbWUuZGF0YT1zdHJlYW0ucGFnZXM7ZnJhbWUuY3Vyc29yPXN0cmVhbS5jdXJzb3I7ZnJhbWUucGFnZVNpemU9c3RyZWFtLmNvbnN0cnVjdG9yLnBhZ2VTaXplO2lmKGZyYW1lLmNhblRyYW5zZmVyKXt0cmFuc2Zlcj1mdW5jdGlvbigpe3ZhciBpLGxlbixyZWYscmVzdWx0cztyZWY9ZnJhbWUuZGF0YTtyZXN1bHRzPVtdO2ZvcihpPTAsbGVuPXJlZi5sZW5ndGg7aTxsZW47aSsrKXtwYWdlPXJlZltpXTtyZXN1bHRzLnB1c2gocGFnZS5idWZmZXIpfXJldHVybiByZXN1bHRzfSgpO3JldHVybiBzZWxmLnBvc3RNZXNzYWdlKGZyYW1lLHRyYW5zZmVyKX1lbHNle3JldHVybiBzZWxmLnBvc3RNZXNzYWdlKGZyYW1lKX19O3NlbGYub25tZXNzYWdlPWZ1bmN0aW9uKGV2ZW50KXtyZXR1cm4gcmVuZGVyRnJhbWUoZXZlbnQuZGF0YSl9fSx7XCIuL0dJRkVuY29kZXIuanNcIjoyfV19LHt9LFs2XSkoNil9KTtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Z2lmLmpzLm1hcFxyXG4iLCI7KGZ1bmN0aW9uKCkge1xyXG5cclxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICB2YXIgVGFyID0gcmVxdWlyZSgnLi90YXIuanMnKTtcclxuICB2YXIgZG93bmxvYWQgPSByZXF1aXJlKCcuL2Rvd25sb2FkLmpzJyk7XHJcbiAgdmFyIEdJRiA9IHJlcXVpcmUoJy4vZ2lmLmpzJyk7XHJcbn1cclxuXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxudmFyIG9iamVjdFR5cGVzID0ge1xyXG4nZnVuY3Rpb24nOiB0cnVlLFxyXG4nb2JqZWN0JzogdHJ1ZVxyXG59O1xyXG5cclxuZnVuY3Rpb24gY2hlY2tHbG9iYWwodmFsdWUpIHtcclxuICAgIHJldHVybiAodmFsdWUgJiYgdmFsdWUuT2JqZWN0ID09PSBPYmplY3QpID8gdmFsdWUgOiBudWxsO1xyXG4gIH1cclxuXHJcbi8qKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyB3aXRob3V0IGEgZGVwZW5kZW5jeSBvbiBgcm9vdGAuICovXHJcbnZhciBmcmVlUGFyc2VGbG9hdCA9IHBhcnNlRmxvYXQsXHJcbiAgZnJlZVBhcnNlSW50ID0gcGFyc2VJbnQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgLiAqL1xyXG52YXIgZnJlZUV4cG9ydHMgPSAob2JqZWN0VHlwZXNbdHlwZW9mIGV4cG9ydHNdICYmIGV4cG9ydHMgJiYgIWV4cG9ydHMubm9kZVR5cGUpXHJcbj8gZXhwb3J0c1xyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYC4gKi9cclxudmFyIGZyZWVNb2R1bGUgPSAob2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUpXHJcbj8gbW9kdWxlXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCB0aGUgcG9wdWxhciBDb21tb25KUyBleHRlbnNpb24gYG1vZHVsZS5leHBvcnRzYC4gKi9cclxudmFyIG1vZHVsZUV4cG9ydHMgPSAoZnJlZU1vZHVsZSAmJiBmcmVlTW9kdWxlLmV4cG9ydHMgPT09IGZyZWVFeHBvcnRzKVxyXG4/IGZyZWVFeHBvcnRzXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcy4gKi9cclxudmFyIGZyZWVHbG9iYWwgPSBjaGVja0dsb2JhbChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlICYmIHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsKTtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgc2VsZmAuICovXHJcbnZhciBmcmVlU2VsZiA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiBzZWxmXSAmJiBzZWxmKTtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgd2luZG93YC4gKi9cclxudmFyIGZyZWVXaW5kb3cgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygd2luZG93XSAmJiB3aW5kb3cpO1xyXG5cclxuLyoqIERldGVjdCBgdGhpc2AgYXMgdGhlIGdsb2JhbCBvYmplY3QuICovXHJcbnZhciB0aGlzR2xvYmFsID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHRoaXNdICYmIHRoaXMpO1xyXG5cclxuLyoqXHJcbiogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdC5cclxuKlxyXG4qIFRoZSBgdGhpc2AgdmFsdWUgaXMgdXNlZCBpZiBpdCdzIHRoZSBnbG9iYWwgb2JqZWN0IHRvIGF2b2lkIEdyZWFzZW1vbmtleSdzXHJcbiogcmVzdHJpY3RlZCBgd2luZG93YCBvYmplY3QsIG90aGVyd2lzZSB0aGUgYHdpbmRvd2Agb2JqZWN0IGlzIHVzZWQuXHJcbiovXHJcbnZhciByb290ID0gZnJlZUdsb2JhbCB8fFxyXG4oKGZyZWVXaW5kb3cgIT09ICh0aGlzR2xvYmFsICYmIHRoaXNHbG9iYWwud2luZG93KSkgJiYgZnJlZVdpbmRvdykgfHxcclxuICBmcmVlU2VsZiB8fCB0aGlzR2xvYmFsIHx8IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XHJcblxyXG5pZiggISgnZ2MnIGluIHdpbmRvdyApICkge1xyXG5cdHdpbmRvdy5nYyA9IGZ1bmN0aW9uKCl7fVxyXG59XHJcblxyXG5pZiAoIUhUTUxDYW52YXNFbGVtZW50LnByb3RvdHlwZS50b0Jsb2IpIHtcclxuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShIVE1MQ2FudmFzRWxlbWVudC5wcm90b3R5cGUsICd0b0Jsb2InLCB7XHJcbiAgdmFsdWU6IGZ1bmN0aW9uIChjYWxsYmFjaywgdHlwZSwgcXVhbGl0eSkge1xyXG5cclxuICAgIHZhciBiaW5TdHIgPSBhdG9iKCB0aGlzLnRvRGF0YVVSTCh0eXBlLCBxdWFsaXR5KS5zcGxpdCgnLCcpWzFdICksXHJcbiAgICAgICAgbGVuID0gYmluU3RyLmxlbmd0aCxcclxuICAgICAgICBhcnIgPSBuZXcgVWludDhBcnJheShsZW4pO1xyXG5cclxuICAgIGZvciAodmFyIGk9MDsgaTxsZW47IGkrKyApIHtcclxuICAgICBhcnJbaV0gPSBiaW5TdHIuY2hhckNvZGVBdChpKTtcclxuICAgIH1cclxuXHJcbiAgICBjYWxsYmFjayggbmV3IEJsb2IoIFthcnJdLCB7dHlwZTogdHlwZSB8fCAnaW1hZ2UvcG5nJ30gKSApO1xyXG4gIH1cclxuIH0pO1xyXG59XHJcblxyXG4vLyBAbGljZW5zZSBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXHJcbi8vIGNvcHlyaWdodCBQYXVsIElyaXNoIDIwMTVcclxuXHJcblxyXG4vLyBEYXRlLm5vdygpIGlzIHN1cHBvcnRlZCBldmVyeXdoZXJlIGV4Y2VwdCBJRTguIEZvciBJRTggd2UgdXNlIHRoZSBEYXRlLm5vdyBwb2x5ZmlsbFxyXG4vLyAgIGdpdGh1Yi5jb20vRmluYW5jaWFsLVRpbWVzL3BvbHlmaWxsLXNlcnZpY2UvYmxvYi9tYXN0ZXIvcG9seWZpbGxzL0RhdGUubm93L3BvbHlmaWxsLmpzXHJcbi8vIGFzIFNhZmFyaSA2IGRvZXNuJ3QgaGF2ZSBzdXBwb3J0IGZvciBOYXZpZ2F0aW9uVGltaW5nLCB3ZSB1c2UgYSBEYXRlLm5vdygpIHRpbWVzdGFtcCBmb3IgcmVsYXRpdmUgdmFsdWVzXHJcblxyXG4vLyBpZiB5b3Ugd2FudCB2YWx1ZXMgc2ltaWxhciB0byB3aGF0IHlvdSdkIGdldCB3aXRoIHJlYWwgcGVyZi5ub3csIHBsYWNlIHRoaXMgdG93YXJkcyB0aGUgaGVhZCBvZiB0aGUgcGFnZVxyXG4vLyBidXQgaW4gcmVhbGl0eSwgeW91J3JlIGp1c3QgZ2V0dGluZyB0aGUgZGVsdGEgYmV0d2VlbiBub3coKSBjYWxscywgc28gaXQncyBub3QgdGVycmlibHkgaW1wb3J0YW50IHdoZXJlIGl0J3MgcGxhY2VkXHJcblxyXG5cclxuKGZ1bmN0aW9uKCl7XHJcblxyXG4gIGlmIChcInBlcmZvcm1hbmNlXCIgaW4gd2luZG93ID09IGZhbHNlKSB7XHJcbiAgICAgIHdpbmRvdy5wZXJmb3JtYW5jZSA9IHt9O1xyXG4gIH1cclxuXHJcbiAgRGF0ZS5ub3cgPSAoRGF0ZS5ub3cgfHwgZnVuY3Rpb24gKCkgeyAgLy8gdGhhbmtzIElFOFxyXG5cdCAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gIH0pO1xyXG5cclxuICBpZiAoXCJub3dcIiBpbiB3aW5kb3cucGVyZm9ybWFuY2UgPT0gZmFsc2Upe1xyXG5cclxuICAgIHZhciBub3dPZmZzZXQgPSBEYXRlLm5vdygpO1xyXG5cclxuICAgIGlmIChwZXJmb3JtYW5jZS50aW1pbmcgJiYgcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydCl7XHJcbiAgICAgIG5vd09mZnNldCA9IHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnRcclxuICAgIH1cclxuXHJcbiAgICB3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24gbm93KCl7XHJcbiAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gbm93T2Zmc2V0O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbn0pKCk7XHJcblxyXG5cclxuZnVuY3Rpb24gcGFkKCBuICkge1xyXG5cdHJldHVybiBTdHJpbmcoXCIwMDAwMDAwXCIgKyBuKS5zbGljZSgtNyk7XHJcbn1cclxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvQWRkLW9ucy9Db2RlX3NuaXBwZXRzL1RpbWVyc1xyXG5cclxudmFyIGdfc3RhcnRUaW1lID0gd2luZG93LkRhdGUubm93KCk7XHJcblxyXG5mdW5jdGlvbiBndWlkKCkge1xyXG5cdGZ1bmN0aW9uIHM0KCkge1xyXG5cdFx0cmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApLnRvU3RyaW5nKDE2KS5zdWJzdHJpbmcoMSk7XHJcblx0fVxyXG5cdHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gQ0NGcmFtZUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgX2hhbmRsZXJzID0ge307XHJcblxyXG5cdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHJcblx0dGhpcy5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBoYW5kbGVyKSB7XHJcblxyXG5cdFx0X2hhbmRsZXJzW2V2ZW50XSA9IGhhbmRsZXI7XHJcblxyXG5cdH07XHJcblxyXG5cdHRoaXMuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblxyXG5cdFx0dmFyIGhhbmRsZXIgPSBfaGFuZGxlcnNbZXZlbnRdO1xyXG5cdFx0aWYgKGhhbmRsZXIpIHtcclxuXHJcblx0XHRcdGhhbmRsZXIuYXBwbHkobnVsbCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHR0aGlzLmZpbGVuYW1lID0gc2V0dGluZ3MubmFtZSB8fCBndWlkKCk7XHJcblx0dGhpcy5leHRlbnNpb24gPSAnJztcclxuXHR0aGlzLm1pbWVUeXBlID0gJyc7XHJcblxyXG59XHJcblxyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zYWZlVG9Qcm9jZWVkID0gZnVuY3Rpb24oKXsgcmV0dXJuIHRydWU7IH07XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdGVwID0gZnVuY3Rpb24oKSB7IGNvbnNvbGUubG9nKCAnU3RlcCBub3Qgc2V0IScgKSB9XHJcblxyXG5mdW5jdGlvbiBDQ1RhckVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcudGFyJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAnYXBwbGljYXRpb24veC10YXInXHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJyc7XHJcblxyXG5cdHRoaXMudGFwZSA9IG51bGxcclxuXHR0aGlzLmNvdW50ID0gMDtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe1xyXG5cclxuXHR0aGlzLmRpc3Bvc2UoKTtcclxuXHJcbn07XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBibG9iICkge1xyXG5cclxuXHR2YXIgZmlsZVJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcblx0ZmlsZVJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMudGFwZS5hcHBlbmQoIHBhZCggdGhpcy5jb3VudCApICsgdGhpcy5maWxlRXh0ZW5zaW9uLCBuZXcgVWludDhBcnJheSggZmlsZVJlYWRlci5yZXN1bHQgKSApO1xyXG5cclxuXHRcdC8vaWYoIHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lID4gMCAmJiAoIHRoaXMuZnJhbWVzLmxlbmd0aCAvIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlICkgPj0gdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgKSB7XHJcblxyXG5cdFx0dGhpcy5jb3VudCsrO1xyXG5cdFx0dGhpcy5zdGVwKCk7XHJcblx0fS5iaW5kKCB0aGlzICk7XHJcblx0ZmlsZVJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0Y2FsbGJhY2soIHRoaXMudGFwZS5zYXZlKCkgKTtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLnRhcGUgPSBuZXcgVGFyKCk7XHJcblx0dGhpcy5jb3VudCA9IDA7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ1BOR0VuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ1RhckVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy50eXBlID0gJ2ltYWdlL3BuZyc7XHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJy5wbmcnO1xyXG5cclxufVxyXG5cclxuQ0NQTkdFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDVGFyRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDUE5HRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0Y2FudmFzLnRvQmxvYiggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRDQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZC5jYWxsKCB0aGlzLCBibG9iICk7XHJcblx0fS5iaW5kKCB0aGlzICksIHRoaXMudHlwZSApXHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0pQRUdFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NUYXJFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMudHlwZSA9ICdpbWFnZS9qcGVnJztcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnLmpwZyc7XHJcblx0dGhpcy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG59XHJcblxyXG5DQ0pQRUdFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDVGFyRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDSlBFR0VuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGNhbnZhcy50b0Jsb2IoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0Q0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQuY2FsbCggdGhpcywgYmxvYiApO1xyXG5cdH0uYmluZCggdGhpcyApLCB0aGlzLnR5cGUsIHRoaXMucXVhbGl0eSApXHJcblxyXG59XHJcblxyXG4vKlxyXG5cclxuXHRXZWJNIEVuY29kZXJcclxuXHJcbiovXHJcblxyXG5mdW5jdGlvbiBDQ1dlYk1FbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcblx0aWYoIGNhbnZhcy50b0RhdGFVUkwoICdpbWFnZS93ZWJwJyApLnN1YnN0cig1LDEwKSAhPT0gJ2ltYWdlL3dlYnAnICl7XHJcblx0XHRjb25zb2xlLmxvZyggXCJXZWJQIG5vdCBzdXBwb3J0ZWQgLSB0cnkgYW5vdGhlciBleHBvcnQgZm9ybWF0XCIgKVxyXG5cdH1cclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy53ZWJtJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAndmlkZW8vd2VibSdcclxuXHR0aGlzLmJhc2VGaWxlbmFtZSA9IHRoaXMuZmlsZW5hbWU7XHJcblxyXG5cdHRoaXMuZnJhbWVzID0gW107XHJcblx0dGhpcy5wYXJ0ID0gMTtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlciA9IG5ldyBXZWJNV3JpdGVyKHtcclxuICAgIHF1YWxpdHk6IHRoaXMucXVhbGl0eSxcclxuICAgIGZpbGVXcml0ZXI6IG51bGwsXHJcbiAgICBmZDogbnVsbCxcclxuICAgIGZyYW1lUmF0ZTogc2V0dGluZ3MuZnJhbWVyYXRlXHJcbn0pO1xyXG5cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZGlzcG9zZSgpO1xyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlci5hZGRGcmFtZShjYW52YXMpO1xyXG5cclxuXHQvL3RoaXMuZnJhbWVzLnB1c2goIGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3dlYnAnLCB0aGlzLnF1YWxpdHkpICk7XHJcblxyXG5cdGlmKCB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSA+IDAgJiYgKCB0aGlzLmZyYW1lcy5sZW5ndGggLyB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApID49IHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lICkge1xyXG5cdFx0dGhpcy5zYXZlKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdFx0dGhpcy5maWxlbmFtZSA9IHRoaXMuYmFzZUZpbGVuYW1lICsgJy1wYXJ0LScgKyBwYWQoIHRoaXMucGFydCApO1xyXG5cdFx0XHRkb3dubG9hZCggYmxvYiwgdGhpcy5maWxlbmFtZSArIHRoaXMuZXh0ZW5zaW9uLCB0aGlzLm1pbWVUeXBlICk7XHJcblx0XHRcdHRoaXMuZGlzcG9zZSgpO1xyXG5cdFx0XHR0aGlzLnBhcnQrKztcclxuXHRcdFx0dGhpcy5maWxlbmFtZSA9IHRoaXMuYmFzZUZpbGVuYW1lICsgJy1wYXJ0LScgKyBwYWQoIHRoaXMucGFydCApO1xyXG5cdFx0XHR0aGlzLnN0ZXAoKTtcclxuXHRcdH0uYmluZCggdGhpcyApIClcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhpcy5zdGVwKCk7XHJcblx0fVxyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbi8vXHRpZiggIXRoaXMuZnJhbWVzLmxlbmd0aCApIHJldHVybjtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlci5jb21wbGV0ZSgpLnRoZW4oY2FsbGJhY2spO1xyXG5cclxuXHQvKnZhciB3ZWJtID0gV2hhbW15LmZyb21JbWFnZUFycmF5KCB0aGlzLmZyYW1lcywgdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKVxyXG5cdHZhciBibG9iID0gbmV3IEJsb2IoIFsgd2VibSBdLCB7IHR5cGU6IFwib2N0ZXQvc3RyZWFtXCIgfSApO1xyXG5cdGNhbGxiYWNrKCBibG9iICk7Ki9cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmZyYW1lcyA9IFtdO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxuXHR0aGlzLmVuY29kZXIgPSBuZXcgRkZNcGVnU2VydmVyLlZpZGVvKCBzZXR0aW5ncyApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvY2VzcycsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuZW1pdCggJ3Byb2Nlc3MnIClcclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oJ2ZpbmlzaGVkJywgZnVuY3Rpb24oIHVybCwgc2l6ZSApIHtcclxuICAgICAgICB2YXIgY2IgPSB0aGlzLmNhbGxiYWNrO1xyXG4gICAgICAgIGlmICggY2IgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGNiKCB1cmwsIHNpemUgKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvZ3Jlc3MnLCBmdW5jdGlvbiggcHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgaWYgKCB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyggcHJvZ3Jlc3MgKVxyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdlcnJvcicsIGZ1bmN0aW9uKCBkYXRhICkge1xyXG4gICAgICAgIGFsZXJ0KEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpKTtcclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zdGFydCggdGhpcy5zZXR0aW5ncyApO1xyXG5cclxufTtcclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmFkZCggY2FudmFzICk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG4gICAgdGhpcy5lbmNvZGVyLmVuZCgpO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zYWZlVG9Qcm9jZWVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5lbmNvZGVyLnNhZmVUb1Byb2NlZWQoKTtcclxufTtcclxuXHJcbi8qXHJcblx0SFRNTENhbnZhc0VsZW1lbnQuY2FwdHVyZVN0cmVhbSgpXHJcbiovXHJcblxyXG5mdW5jdGlvbiBDQ1N0cmVhbUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLmZyYW1lcmF0ZSA9IHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdHRoaXMudHlwZSA9ICd2aWRlby93ZWJtJztcclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcud2VibSc7XHJcblx0dGhpcy5zdHJlYW0gPSBudWxsO1xyXG5cdHRoaXMubWVkaWFSZWNvcmRlciA9IG51bGw7XHJcblx0dGhpcy5jaHVua3MgPSBbXTtcclxuXHJcbn1cclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0aWYoICF0aGlzLnN0cmVhbSApIHtcclxuXHRcdHRoaXMuc3RyZWFtID0gY2FudmFzLmNhcHR1cmVTdHJlYW0oIHRoaXMuZnJhbWVyYXRlICk7XHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIgPSBuZXcgTWVkaWFSZWNvcmRlciggdGhpcy5zdHJlYW0gKTtcclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlci5zdGFydCgpO1xyXG5cclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPSBmdW5jdGlvbihlKSB7XHJcblx0XHRcdHRoaXMuY2h1bmtzLnB1c2goZS5kYXRhKTtcclxuXHRcdH0uYmluZCggdGhpcyApO1xyXG5cclxuXHR9XHJcblx0dGhpcy5zdGVwKCk7XHJcblxyXG59XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdHRoaXMubWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbiggZSApIHtcclxuXHRcdHZhciBibG9iID0gbmV3IEJsb2IoIHRoaXMuY2h1bmtzLCB7ICd0eXBlJyA6ICd2aWRlby93ZWJtJyB9KTtcclxuXHRcdHRoaXMuY2h1bmtzID0gW107XHJcblx0XHRjYWxsYmFjayggYmxvYiApO1xyXG5cclxuXHR9LmJpbmQoIHRoaXMgKTtcclxuXHJcblx0dGhpcy5tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuXHJcbn1cclxuXHJcbi8qZnVuY3Rpb24gQ0NHSUZFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gc2V0dGluZ3MucXVhbGl0eSB8fCA2O1xyXG5cdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHJcblx0dGhpcy5lbmNvZGVyID0gbmV3IEdJRkVuY29kZXIoKTtcclxuXHR0aGlzLmVuY29kZXIuc2V0UmVwZWF0KCAxICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0RGVsYXkoIHNldHRpbmdzLnN0ZXAgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRRdWFsaXR5KCA2ICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0VHJhbnNwYXJlbnQoIG51bGwgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRTaXplKCAxNTAsIDE1MCApO1xyXG5cclxuICBcdHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuICBcdHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCggJzJkJyApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyICk7XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zdGFydCgpO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmNhbnZhcy53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHR0aGlzLmNhbnZhcy5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdHRoaXMuY3R4LmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCB0aGlzLmN0eCApO1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc2V0U2l6ZSggY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0ICk7XHJcblx0dmFyIHJlYWRCdWZmZXIgPSBuZXcgVWludDhBcnJheShjYW52YXMud2lkdGggKiBjYW52YXMuaGVpZ2h0ICogNCk7XHJcblx0dmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApO1xyXG5cdGNvbnRleHQucmVhZFBpeGVscygwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQsIGNvbnRleHQuUkdCQSwgY29udGV4dC5VTlNJR05FRF9CWVRFLCByZWFkQnVmZmVyKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHJlYWRCdWZmZXIsIHRydWUgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuZmluaXNoKCk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdHZhciBiaW5hcnlfZ2lmID0gdGhpcy5lbmNvZGVyLnN0cmVhbSgpLmdldERhdGEoKTtcclxuXHJcblx0dmFyIGRhdGFfdXJsID0gJ2RhdGE6aW1hZ2UvZ2lmO2Jhc2U2NCwnK2VuY29kZTY0KGJpbmFyeV9naWYpO1xyXG5cdHdpbmRvdy5sb2NhdGlvbiA9IGRhdGFfdXJsO1xyXG5cdHJldHVybjtcclxuXHJcblx0dmFyIGJsb2IgPSBuZXcgQmxvYiggWyBiaW5hcnlfZ2lmIF0sIHsgdHlwZTogXCJvY3RldC9zdHJlYW1cIiB9ICk7XHJcblx0dmFyIHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKCBibG9iICk7XHJcblx0Y2FsbGJhY2soIHVybCApO1xyXG5cclxufSovXHJcblxyXG5mdW5jdGlvbiBDQ0dJRkVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gMzEgLSAoICggc2V0dGluZ3MucXVhbGl0eSAqIDMwIC8gMTAwICkgfHwgMTAgKTtcclxuXHRzZXR0aW5ncy53b3JrZXJzID0gc2V0dGluZ3Mud29ya2VycyB8fCA0O1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcuZ2lmJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAnaW1hZ2UvZ2lmJ1xyXG5cclxuICBcdHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuICBcdHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCggJzJkJyApO1xyXG4gIFx0dGhpcy5zaXplU2V0ID0gZmFsc2U7XHJcblxyXG4gIFx0dGhpcy5lbmNvZGVyID0gbmV3IEdJRih7XHJcblx0XHR3b3JrZXJzOiBzZXR0aW5ncy53b3JrZXJzLFxyXG5cdFx0cXVhbGl0eTogc2V0dGluZ3MucXVhbGl0eSxcclxuXHRcdHdvcmtlclNjcmlwdDogc2V0dGluZ3Mud29ya2Vyc1BhdGggKyAnZ2lmLndvcmtlci5qcydcclxuXHR9ICk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvZ3Jlc3MnLCBmdW5jdGlvbiggcHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgaWYgKCB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyggcHJvZ3Jlc3MgKVxyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCdmaW5pc2hlZCcsIGZ1bmN0aW9uKCBibG9iICkge1xyXG4gICAgICAgIHZhciBjYiA9IHRoaXMuY2FsbGJhY2s7XHJcbiAgICAgICAgaWYgKCBjYiApIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgY2IoIGJsb2IgKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRpZiggIXRoaXMuc2l6ZVNldCApIHtcclxuXHRcdHRoaXMuZW5jb2Rlci5zZXRPcHRpb24oICd3aWR0aCcsY2FudmFzLndpZHRoICk7XHJcblx0XHR0aGlzLmVuY29kZXIuc2V0T3B0aW9uKCAnaGVpZ2h0JyxjYW52YXMuaGVpZ2h0ICk7XHJcblx0XHR0aGlzLnNpemVTZXQgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0dGhpcy5jYW52YXMud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0dGhpcy5jYW52YXMuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHR0aGlzLmN0eC5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHRoaXMuY3R4LCB7IGNvcHk6IHRydWUsIGRlbGF5OiB0aGlzLnNldHRpbmdzLnN0ZXAgfSApO1xyXG5cdHRoaXMuc3RlcCgpO1xyXG5cclxuXHQvKnRoaXMuZW5jb2Rlci5zZXRTaXplKCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQgKTtcclxuXHR2YXIgcmVhZEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGNhbnZhcy53aWR0aCAqIGNhbnZhcy5oZWlnaHQgKiA0KTtcclxuXHR2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICk7XHJcblx0Y29udGV4dC5yZWFkUGl4ZWxzKDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCwgY29udGV4dC5SR0JBLCBjb250ZXh0LlVOU0lHTkVEX0JZVEUsIHJlYWRCdWZmZXIpO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggcmVhZEJ1ZmZlciwgdHJ1ZSApOyovXHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG5cclxuXHR0aGlzLmVuY29kZXIucmVuZGVyKCk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ2FwdHVyZSggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBfc2V0dGluZ3MgPSBzZXR0aW5ncyB8fCB7fSxcclxuXHRcdF9kYXRlID0gbmV3IERhdGUoKSxcclxuXHRcdF92ZXJib3NlLFxyXG5cdFx0X2Rpc3BsYXksXHJcblx0XHRfdGltZSxcclxuXHRcdF9zdGFydFRpbWUsXHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lLFxyXG5cdFx0X3BlcmZvcm1hbmNlU3RhcnRUaW1lLFxyXG5cdFx0X3N0ZXAsXHJcbiAgICAgICAgX2VuY29kZXIsXHJcblx0XHRfdGltZW91dHMgPSBbXSxcclxuXHRcdF9pbnRlcnZhbHMgPSBbXSxcclxuXHRcdF9mcmFtZUNvdW50ID0gMCxcclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID0gMCxcclxuXHRcdF9sYXN0RnJhbWUgPSBudWxsLFxyXG5cdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcyA9IFtdLFxyXG5cdFx0X2NhcHR1cmluZyA9IGZhbHNlLFxyXG4gICAgICAgIF9oYW5kbGVycyA9IHt9O1xyXG5cclxuXHRfc2V0dGluZ3MuZnJhbWVyYXRlID0gX3NldHRpbmdzLmZyYW1lcmF0ZSB8fCA2MDtcclxuXHRfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA9IDIgKiAoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzIHx8IDEgKTtcclxuXHRfdmVyYm9zZSA9IF9zZXR0aW5ncy52ZXJib3NlIHx8IGZhbHNlO1xyXG5cdF9kaXNwbGF5ID0gX3NldHRpbmdzLmRpc3BsYXkgfHwgZmFsc2U7XHJcblx0X3NldHRpbmdzLnN0ZXAgPSAxMDAwLjAgLyBfc2V0dGluZ3MuZnJhbWVyYXRlIDtcclxuXHRfc2V0dGluZ3MudGltZUxpbWl0ID0gX3NldHRpbmdzLnRpbWVMaW1pdCB8fCAwO1xyXG5cdF9zZXR0aW5ncy5mcmFtZUxpbWl0ID0gX3NldHRpbmdzLmZyYW1lTGltaXQgfHwgMDtcclxuXHRfc2V0dGluZ3Muc3RhcnRUaW1lID0gX3NldHRpbmdzLnN0YXJ0VGltZSB8fCAwO1xyXG5cclxuXHR2YXIgX3RpbWVEaXNwbGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRfdGltZURpc3BsYXkuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5sZWZ0ID0gX3RpbWVEaXNwbGF5LnN0eWxlLnRvcCA9IDBcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2JsYWNrJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmZvbnRTaXplID0gJzExcHgnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnBhZGRpbmcgPSAnNXB4J1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5jb2xvciA9ICdyZWQnO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS56SW5kZXggPSAxMDAwMDBcclxuXHRpZiggX3NldHRpbmdzLmRpc3BsYXkgKSBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBfdGltZURpc3BsYXkgKTtcclxuXHJcblx0dmFyIGNhbnZhc01vdGlvbkJsdXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG5cdHZhciBjdHhNb3Rpb25CbHVyID0gY2FudmFzTW90aW9uQmx1ci5nZXRDb250ZXh0KCAnMmQnICk7XHJcblx0dmFyIGJ1ZmZlck1vdGlvbkJsdXI7XHJcblx0dmFyIGltYWdlRGF0YTtcclxuXHJcblx0X2xvZyggJ1N0ZXAgaXMgc2V0IHRvICcgKyBfc2V0dGluZ3Muc3RlcCArICdtcycgKTtcclxuXHJcbiAgICB2YXIgX2VuY29kZXJzID0ge1xyXG5cdFx0Z2lmOiBDQ0dJRkVuY29kZXIsXHJcblx0XHR3ZWJtOiBDQ1dlYk1FbmNvZGVyLFxyXG5cdFx0ZmZtcGVnc2VydmVyOiBDQ0ZGTXBlZ1NlcnZlckVuY29kZXIsXHJcblx0XHRwbmc6IENDUE5HRW5jb2RlcixcclxuXHRcdGpwZzogQ0NKUEVHRW5jb2RlcixcclxuXHRcdCd3ZWJtLW1lZGlhcmVjb3JkZXInOiBDQ1N0cmVhbUVuY29kZXJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIGN0b3IgPSBfZW5jb2RlcnNbIF9zZXR0aW5ncy5mb3JtYXQgXTtcclxuICAgIGlmICggIWN0b3IgKSB7XHJcblx0XHR0aHJvdyBcIkVycm9yOiBJbmNvcnJlY3Qgb3IgbWlzc2luZyBmb3JtYXQ6IFZhbGlkIGZvcm1hdHMgYXJlIFwiICsgT2JqZWN0LmtleXMoX2VuY29kZXJzKS5qb2luKFwiLCBcIik7XHJcbiAgICB9XHJcbiAgICBfZW5jb2RlciA9IG5ldyBjdG9yKCBfc2V0dGluZ3MgKTtcclxuICAgIF9lbmNvZGVyLnN0ZXAgPSBfc3RlcFxyXG5cclxuXHRfZW5jb2Rlci5vbigncHJvY2VzcycsIF9wcm9jZXNzKTtcclxuICAgIF9lbmNvZGVyLm9uKCdwcm9ncmVzcycsIF9wcm9ncmVzcyk7XHJcblxyXG4gICAgaWYgKFwicGVyZm9ybWFuY2VcIiBpbiB3aW5kb3cgPT0gZmFsc2UpIHtcclxuICAgIFx0d2luZG93LnBlcmZvcm1hbmNlID0ge307XHJcbiAgICB9XHJcblxyXG5cdERhdGUubm93ID0gKERhdGUubm93IHx8IGZ1bmN0aW9uICgpIHsgIC8vIHRoYW5rcyBJRThcclxuXHRcdHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuXHR9KTtcclxuXHJcblx0aWYgKFwibm93XCIgaW4gd2luZG93LnBlcmZvcm1hbmNlID09IGZhbHNlKXtcclxuXHJcblx0XHR2YXIgbm93T2Zmc2V0ID0gRGF0ZS5ub3coKTtcclxuXHJcblx0XHRpZiAocGVyZm9ybWFuY2UudGltaW5nICYmIHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQpe1xyXG5cdFx0XHRub3dPZmZzZXQgPSBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0XHJcblx0XHR9XHJcblxyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uIG5vdygpe1xyXG5cdFx0XHRyZXR1cm4gRGF0ZS5ub3coKSAtIG5vd09mZnNldDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciBfb2xkU2V0VGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0LFxyXG5cdFx0X29sZFNldEludGVydmFsID0gd2luZG93LnNldEludGVydmFsLFxyXG5cdCAgICBcdF9vbGRDbGVhckludGVydmFsID0gd2luZG93LmNsZWFySW50ZXJ2YWwsXHJcblx0XHRfb2xkQ2xlYXJUaW1lb3V0ID0gd2luZG93LmNsZWFyVGltZW91dCxcclxuXHRcdF9vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxyXG5cdFx0X29sZE5vdyA9IHdpbmRvdy5EYXRlLm5vdyxcclxuXHRcdF9vbGRQZXJmb3JtYW5jZU5vdyA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3csXHJcblx0XHRfb2xkR2V0VGltZSA9IHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lO1xyXG5cdC8vIERhdGUucHJvdG90eXBlLl9vbGRHZXRUaW1lID0gRGF0ZS5wcm90b3R5cGUuZ2V0VGltZTtcclxuXHJcblx0dmFyIG1lZGlhID0gW107XHJcblxyXG5cdGZ1bmN0aW9uIF9pbml0KCkge1xyXG5cclxuXHRcdF9sb2coICdDYXB0dXJlciBzdGFydCcgKTtcclxuXHJcblx0XHRfc3RhcnRUaW1lID0gd2luZG93LkRhdGUubm93KCk7XHJcblx0XHRfdGltZSA9IF9zdGFydFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cdFx0X3BlcmZvcm1hbmNlU3RhcnRUaW1lID0gd2luZG93LnBlcmZvcm1hbmNlLm5vdygpO1xyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSA9IF9wZXJmb3JtYW5jZVN0YXJ0VGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblxyXG5cdFx0d2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWUgPSBmdW5jdGlvbigpe1xyXG5cdFx0XHRyZXR1cm4gX3RpbWU7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LkRhdGUubm93ID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdHJldHVybiBfdGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0d2luZG93LnNldFRpbWVvdXQgPSBmdW5jdGlvbiggY2FsbGJhY2ssIHRpbWUgKSB7XHJcblx0XHRcdHZhciB0ID0ge1xyXG5cdFx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0XHR0aW1lOiB0aW1lLFxyXG5cdFx0XHRcdHRyaWdnZXJUaW1lOiBfdGltZSArIHRpbWVcclxuXHRcdFx0fTtcclxuXHRcdFx0X3RpbWVvdXRzLnB1c2goIHQgKTtcclxuXHRcdFx0X2xvZyggJ1RpbWVvdXQgc2V0IHRvICcgKyB0LnRpbWUgKTtcclxuICAgICAgICAgICAgcmV0dXJuIHQ7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCA9IGZ1bmN0aW9uKCBpZCApIHtcclxuXHRcdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfdGltZW91dHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdFx0aWYoIF90aW1lb3V0c1sgaiBdID09IGlkICkge1xyXG5cdFx0XHRcdFx0X3RpbWVvdXRzLnNwbGljZSggaiwgMSApO1xyXG5cdFx0XHRcdFx0X2xvZyggJ1RpbWVvdXQgY2xlYXJlZCcgKTtcclxuXHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uKCBjYWxsYmFjaywgdGltZSApIHtcclxuXHRcdFx0dmFyIHQgPSB7XHJcblx0XHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxyXG5cdFx0XHRcdHRpbWU6IHRpbWUsXHJcblx0XHRcdFx0dHJpZ2dlclRpbWU6IF90aW1lICsgdGltZVxyXG5cdFx0XHR9O1xyXG5cdFx0XHRfaW50ZXJ2YWxzLnB1c2goIHQgKTtcclxuXHRcdFx0X2xvZyggJ0ludGVydmFsIHNldCB0byAnICsgdC50aW1lICk7XHJcblx0XHRcdHJldHVybiB0O1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5jbGVhckludGVydmFsID0gZnVuY3Rpb24oIGlkICkge1xyXG5cdFx0XHRfbG9nKCAnY2xlYXIgSW50ZXJ2YWwnICk7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblx0XHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MucHVzaCggY2FsbGJhY2sgKTtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0cmV0dXJuIF9wZXJmb3JtYW5jZVRpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdGZ1bmN0aW9uIGhvb2tDdXJyZW50VGltZSgpIHtcclxuXHRcdFx0aWYoICF0aGlzLl9ob29rZWQgKSB7XHJcblx0XHRcdFx0dGhpcy5faG9va2VkID0gdHJ1ZTtcclxuXHRcdFx0XHR0aGlzLl9ob29rZWRUaW1lID0gdGhpcy5jdXJyZW50VGltZSB8fCAwO1xyXG5cdFx0XHRcdHRoaXMucGF1c2UoKTtcclxuXHRcdFx0XHRtZWRpYS5wdXNoKCB0aGlzICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHRoaXMuX2hvb2tlZFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIEhUTUxWaWRlb0VsZW1lbnQucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7IGdldDogaG9va0N1cnJlbnRUaW1lIH0gKVxyXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIEhUTUxBdWRpb0VsZW1lbnQucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7IGdldDogaG9va0N1cnJlbnRUaW1lIH0gKVxyXG5cdFx0fSBjYXRjaCAoZXJyKSB7XHJcblx0XHRcdF9sb2coZXJyKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RhcnQoKSB7XHJcblx0XHRfaW5pdCgpO1xyXG5cdFx0X2VuY29kZXIuc3RhcnQoKTtcclxuXHRcdF9jYXB0dXJpbmcgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0b3AoKSB7XHJcblx0XHRfY2FwdHVyaW5nID0gZmFsc2U7XHJcblx0XHRfZW5jb2Rlci5zdG9wKCk7XHJcblx0XHRfZGVzdHJveSgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NhbGwoIGZuLCBwICkge1xyXG5cdFx0X29sZFNldFRpbWVvdXQoIGZuLCAwLCBwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RlcCgpIHtcclxuXHRcdC8vX29sZFJlcXVlc3RBbmltYXRpb25GcmFtZSggX3Byb2Nlc3MgKTtcclxuXHRcdF9jYWxsKCBfcHJvY2VzcyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2Rlc3Ryb3koKSB7XHJcblx0XHRfbG9nKCAnQ2FwdHVyZXIgc3RvcCcgKTtcclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0ID0gX29sZFNldFRpbWVvdXQ7XHJcblx0XHR3aW5kb3cuc2V0SW50ZXJ2YWwgPSBfb2xkU2V0SW50ZXJ2YWw7XHJcblx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCA9IF9vbGRDbGVhckludGVydmFsO1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCA9IF9vbGRDbGVhclRpbWVvdXQ7XHJcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gX29sZFJlcXVlc3RBbmltYXRpb25GcmFtZTtcclxuXHRcdHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lID0gX29sZEdldFRpbWU7XHJcblx0XHR3aW5kb3cuRGF0ZS5ub3cgPSBfb2xkTm93O1xyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IF9vbGRQZXJmb3JtYW5jZU5vdztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF91cGRhdGVUaW1lKCkge1xyXG5cdFx0dmFyIHNlY29uZHMgPSBfZnJhbWVDb3VudCAvIF9zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0XHRpZiggKCBfc2V0dGluZ3MuZnJhbWVMaW1pdCAmJiBfZnJhbWVDb3VudCA+PSBfc2V0dGluZ3MuZnJhbWVMaW1pdCApIHx8ICggX3NldHRpbmdzLnRpbWVMaW1pdCAmJiBzZWNvbmRzID49IF9zZXR0aW5ncy50aW1lTGltaXQgKSApIHtcclxuXHRcdFx0X3N0b3AoKTtcclxuXHRcdFx0X3NhdmUoKTtcclxuXHRcdH1cclxuXHRcdHZhciBkID0gbmV3IERhdGUoIG51bGwgKTtcclxuXHRcdGQuc2V0U2Vjb25kcyggc2Vjb25kcyApO1xyXG5cdFx0aWYoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID4gMiApIHtcclxuXHRcdFx0X3RpbWVEaXNwbGF5LnRleHRDb250ZW50ID0gJ0NDYXB0dXJlICcgKyBfc2V0dGluZ3MuZm9ybWF0ICsgJyB8ICcgKyBfZnJhbWVDb3VudCArICcgZnJhbWVzICgnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKyAnIGludGVyKSB8ICcgKyAgZC50b0lTT1N0cmluZygpLnN1YnN0ciggMTEsIDggKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdF90aW1lRGlzcGxheS50ZXh0Q29udGVudCA9ICdDQ2FwdHVyZSAnICsgX3NldHRpbmdzLmZvcm1hdCArICcgfCAnICsgX2ZyYW1lQ291bnQgKyAnIGZyYW1lcyB8ICcgKyAgZC50b0lTT1N0cmluZygpLnN1YnN0ciggMTEsIDggKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jaGVja0ZyYW1lKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0aWYoIGNhbnZhc01vdGlvbkJsdXIud2lkdGggIT09IGNhbnZhcy53aWR0aCB8fCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCAhPT0gY2FudmFzLmhlaWdodCApIHtcclxuXHRcdFx0Y2FudmFzTW90aW9uQmx1ci53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHRcdFx0Y2FudmFzTW90aW9uQmx1ci5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyID0gbmV3IFVpbnQxNkFycmF5KCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCAqIGNhbnZhc01vdGlvbkJsdXIud2lkdGggKiA0ICk7XHJcblx0XHRcdGN0eE1vdGlvbkJsdXIuZmlsbFN0eWxlID0gJyMwJ1xyXG5cdFx0XHRjdHhNb3Rpb25CbHVyLmZpbGxSZWN0KCAwLCAwLCBjYW52YXNNb3Rpb25CbHVyLndpZHRoLCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCApO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9ibGVuZEZyYW1lKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0Ly9fbG9nKCAnSW50ZXJtZWRpYXRlIEZyYW1lOiAnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKTtcclxuXHJcblx0XHRjdHhNb3Rpb25CbHVyLmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblx0XHRpbWFnZURhdGEgPSBjdHhNb3Rpb25CbHVyLmdldEltYWdlRGF0YSggMCwgMCwgY2FudmFzTW90aW9uQmx1ci53aWR0aCwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogXTtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSArPSBpbWFnZURhdGEuZGF0YVsgaiArIDEgXTtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSArPSBpbWFnZURhdGEuZGF0YVsgaiArIDIgXTtcclxuXHRcdH1cclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50Kys7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3NhdmVGcmFtZSgpe1xyXG5cclxuXHRcdHZhciBkYXRhID0gaW1hZ2VEYXRhLmRhdGE7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0ZGF0YVsgaiBdID0gYnVmZmVyTW90aW9uQmx1clsgaiBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0XHRkYXRhWyBqICsgMSBdID0gYnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdFx0ZGF0YVsgaiArIDIgXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHR9XHJcblx0XHRjdHhNb3Rpb25CbHVyLnB1dEltYWdlRGF0YSggaW1hZ2VEYXRhLCAwLCAwICk7XHJcblx0XHRfZW5jb2Rlci5hZGQoIGNhbnZhc01vdGlvbkJsdXIgKTtcclxuXHRcdF9mcmFtZUNvdW50Kys7XHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA9IDA7XHJcblx0XHRfbG9nKCAnRnVsbCBNQiBGcmFtZSEgJyArIF9mcmFtZUNvdW50ICsgJyAnICsgIF90aW1lICk7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiBdID0gMDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSA9IDA7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gPSAwO1xyXG5cdFx0fVxyXG5cdFx0Z2MoKTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2FwdHVyZSggY2FudmFzICkge1xyXG5cclxuXHRcdGlmKCBfY2FwdHVyaW5nICkge1xyXG5cclxuXHRcdFx0aWYoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID4gMiApIHtcclxuXHJcblx0XHRcdFx0X2NoZWNrRnJhbWUoIGNhbnZhcyApO1xyXG5cdFx0XHRcdF9ibGVuZEZyYW1lKCBjYW52YXMgKTtcclxuXHJcblx0XHRcdFx0aWYoIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID49IC41ICogX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgKSB7XHJcblx0XHRcdFx0XHRfc2F2ZUZyYW1lKCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdF9zdGVwKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRfZW5jb2Rlci5hZGQoIGNhbnZhcyApO1xyXG5cdFx0XHRcdF9mcmFtZUNvdW50Kys7XHJcblx0XHRcdFx0X2xvZyggJ0Z1bGwgRnJhbWUhICcgKyBfZnJhbWVDb3VudCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9wcm9jZXNzKCkge1xyXG5cclxuXHRcdHZhciBzdGVwID0gMTAwMCAvIF9zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0XHR2YXIgZHQgPSAoIF9mcmFtZUNvdW50ICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyApICogc3RlcDtcclxuXHJcblx0XHRfdGltZSA9IF9zdGFydFRpbWUgKyBkdDtcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUgPSBfcGVyZm9ybWFuY2VTdGFydFRpbWUgKyBkdDtcclxuXHJcblx0XHRtZWRpYS5mb3JFYWNoKCBmdW5jdGlvbiggdiApIHtcclxuXHRcdFx0di5faG9va2VkVGltZSA9IGR0IC8gMTAwMDtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRfdXBkYXRlVGltZSgpO1xyXG5cdFx0X2xvZyggJ0ZyYW1lOiAnICsgX2ZyYW1lQ291bnQgKyAnICcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCApO1xyXG5cclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgX3RpbWVvdXRzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRpZiggX3RpbWUgPj0gX3RpbWVvdXRzWyBqIF0udHJpZ2dlclRpbWUgKSB7XHJcblx0XHRcdFx0X2NhbGwoIF90aW1lb3V0c1sgaiBdLmNhbGxiYWNrIClcclxuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCAndGltZW91dCEnICk7XHJcblx0XHRcdFx0X3RpbWVvdXRzLnNwbGljZSggaiwgMSApO1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfaW50ZXJ2YWxzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRpZiggX3RpbWUgPj0gX2ludGVydmFsc1sgaiBdLnRyaWdnZXJUaW1lICkge1xyXG5cdFx0XHRcdF9jYWxsKCBfaW50ZXJ2YWxzWyBqIF0uY2FsbGJhY2sgKTtcclxuXHRcdFx0XHRfaW50ZXJ2YWxzWyBqIF0udHJpZ2dlclRpbWUgKz0gX2ludGVydmFsc1sgaiBdLnRpbWU7XHJcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggJ2ludGVydmFsIScgKTtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MuZm9yRWFjaCggZnVuY3Rpb24oIGNiICkge1xyXG4gICAgIFx0XHRfY2FsbCggY2IsIF90aW1lIC0gZ19zdGFydFRpbWUgKTtcclxuICAgICAgICB9ICk7XHJcbiAgICAgICAgX3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcyA9IFtdO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zYXZlKCBjYWxsYmFjayApIHtcclxuXHJcblx0XHRpZiggIWNhbGxiYWNrICkge1xyXG5cdFx0XHRjYWxsYmFjayA9IGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0XHRcdGRvd25sb2FkKCBibG9iLCBfZW5jb2Rlci5maWxlbmFtZSArIF9lbmNvZGVyLmV4dGVuc2lvbiwgX2VuY29kZXIubWltZVR5cGUgKTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdF9lbmNvZGVyLnNhdmUoIGNhbGxiYWNrICk7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2xvZyggbWVzc2FnZSApIHtcclxuXHRcdGlmKCBfdmVyYm9zZSApIGNvbnNvbGUubG9nKCBtZXNzYWdlICk7XHJcblx0fVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbiggZXZlbnQsIGhhbmRsZXIgKSB7XHJcblxyXG4gICAgICAgIF9oYW5kbGVyc1tldmVudF0gPSBoYW5kbGVyO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZW1pdCggZXZlbnQgKSB7XHJcblxyXG4gICAgICAgIHZhciBoYW5kbGVyID0gX2hhbmRsZXJzW2V2ZW50XTtcclxuICAgICAgICBpZiAoIGhhbmRsZXIgKSB7XHJcblxyXG4gICAgICAgICAgICBoYW5kbGVyLmFwcGx5KCBudWxsLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggYXJndW1lbnRzLCAxICkgKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfcHJvZ3Jlc3MoIHByb2dyZXNzICkge1xyXG5cclxuICAgICAgICBfZW1pdCggJ3Byb2dyZXNzJywgcHJvZ3Jlc3MgKTtcclxuXHJcbiAgICB9XHJcblxyXG5cdHJldHVybiB7XHJcblx0XHRzdGFydDogX3N0YXJ0LFxyXG5cdFx0Y2FwdHVyZTogX2NhcHR1cmUsXHJcblx0XHRzdG9wOiBfc3RvcCxcclxuXHRcdHNhdmU6IF9zYXZlLFxyXG4gICAgICAgIG9uOiBfb25cclxuXHR9XHJcbn1cclxuXHJcbihmcmVlV2luZG93IHx8IGZyZWVTZWxmIHx8IHt9KS5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG5cclxuICAvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzIGxpa2Ugci5qcyBjaGVjayBmb3IgY29uZGl0aW9uIHBhdHRlcm5zIGxpa2UgdGhlIGZvbGxvd2luZzpcclxuICBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcclxuICAgIC8vIERlZmluZSBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlIHNvLCB0aHJvdWdoIHBhdGggbWFwcGluZywgaXQgY2FuIGJlXHJcbiAgICAvLyByZWZlcmVuY2VkIGFzIHRoZSBcInVuZGVyc2NvcmVcIiBtb2R1bGUuXHJcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XHJcbiAgICBcdHJldHVybiBDQ2FwdHVyZTtcclxuICAgIH0pO1xyXG59XHJcbiAgLy8gQ2hlY2sgZm9yIGBleHBvcnRzYCBhZnRlciBgZGVmaW5lYCBpbiBjYXNlIGEgYnVpbGQgb3B0aW1pemVyIGFkZHMgYW4gYGV4cG9ydHNgIG9iamVjdC5cclxuICBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlKSB7XHJcbiAgICAvLyBFeHBvcnQgZm9yIE5vZGUuanMuXHJcbiAgICBpZiAobW9kdWxlRXhwb3J0cykge1xyXG4gICAgXHQoZnJlZU1vZHVsZS5leHBvcnRzID0gQ0NhcHR1cmUpLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbiAgICB9XHJcbiAgICAvLyBFeHBvcnQgZm9yIENvbW1vbkpTIHN1cHBvcnQuXHJcbiAgICBmcmVlRXhwb3J0cy5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG59XHJcbmVsc2Uge1xyXG4gICAgLy8gRXhwb3J0IHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxyXG4gICAgcm9vdC5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG59XHJcblxyXG59KCkpO1xyXG4iLCIvKipcbiAqIEBhdXRob3IgYWx0ZXJlZHEgLyBodHRwOi8vYWx0ZXJlZHF1YWxpYS5jb20vXG4gKiBAYXV0aG9yIG1yLmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbS9cbiAqL1xuXG52YXIgRGV0ZWN0b3IgPSB7XG5cblx0Y2FudmFzOiAhISB3aW5kb3cuQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuXHR3ZWJnbDogKCBmdW5jdGlvbiAoKSB7XG5cblx0XHR0cnkge1xuXG5cdFx0XHR2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTsgcmV0dXJuICEhICggd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCAmJiAoIGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICkgfHwgY2FudmFzLmdldENvbnRleHQoICdleHBlcmltZW50YWwtd2ViZ2wnICkgKSApO1xuXG5cdFx0fSBjYXRjaCAoIGUgKSB7XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblxuXHRcdH1cblxuXHR9ICkoKSxcblx0d29ya2VyczogISEgd2luZG93Lldvcmtlcixcblx0ZmlsZWFwaTogd2luZG93LkZpbGUgJiYgd2luZG93LkZpbGVSZWFkZXIgJiYgd2luZG93LkZpbGVMaXN0ICYmIHdpbmRvdy5CbG9iLFxuXG5cdGdldFdlYkdMRXJyb3JNZXNzYWdlOiBmdW5jdGlvbiAoKSB7XG5cblx0XHR2YXIgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0ZWxlbWVudC5pZCA9ICd3ZWJnbC1lcnJvci1tZXNzYWdlJztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRTaXplID0gJzEzcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9ICdub3JtYWwnO1xuXHRcdGVsZW1lbnQuc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XG5cdFx0ZWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kID0gJyNmZmYnO1xuXHRcdGVsZW1lbnQuc3R5bGUuY29sb3IgPSAnIzAwMCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5wYWRkaW5nID0gJzEuNWVtJztcblx0XHRlbGVtZW50LnN0eWxlLnpJbmRleCA9ICc5OTknO1xuXHRcdGVsZW1lbnQuc3R5bGUud2lkdGggPSAnNDAwcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUubWFyZ2luID0gJzVlbSBhdXRvIDAnO1xuXG5cdFx0aWYgKCAhIHRoaXMud2ViZ2wgKSB7XG5cblx0XHRcdGVsZW1lbnQuaW5uZXJIVE1MID0gd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCA/IFtcblx0XHRcdFx0J1lvdXIgZ3JhcGhpY3MgY2FyZCBkb2VzIG5vdCBzZWVtIHRvIHN1cHBvcnQgPGEgaHJlZj1cImh0dHA6Ly9raHJvbm9zLm9yZy93ZWJnbC93aWtpL0dldHRpbmdfYV9XZWJHTF9JbXBsZW1lbnRhdGlvblwiIHN0eWxlPVwiY29sb3I6IzAwMFwiPldlYkdMPC9hPi48YnIgLz4nLFxuXHRcdFx0XHQnRmluZCBvdXQgaG93IHRvIGdldCBpdCA8YSBocmVmPVwiaHR0cDovL2dldC53ZWJnbC5vcmcvXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+aGVyZTwvYT4uJ1xuXHRcdFx0XS5qb2luKCAnXFxuJyApIDogW1xuXHRcdFx0XHQnWW91ciBicm93c2VyIGRvZXMgbm90IHNlZW0gdG8gc3VwcG9ydCA8YSBocmVmPVwiaHR0cDovL2tocm9ub3Mub3JnL3dlYmdsL3dpa2kvR2V0dGluZ19hX1dlYkdMX0ltcGxlbWVudGF0aW9uXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+V2ViR0w8L2E+Ljxici8+Jyxcblx0XHRcdFx0J0ZpbmQgb3V0IGhvdyB0byBnZXQgaXQgPGEgaHJlZj1cImh0dHA6Ly9nZXQud2ViZ2wub3JnL1wiIHN0eWxlPVwiY29sb3I6IzAwMFwiPmhlcmU8L2E+Lidcblx0XHRcdF0uam9pbiggJ1xcbicgKTtcblxuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50O1xuXG5cdH0sXG5cblx0YWRkR2V0V2ViR0xNZXNzYWdlOiBmdW5jdGlvbiAoIHBhcmFtZXRlcnMgKSB7XG5cblx0XHR2YXIgcGFyZW50LCBpZCwgZWxlbWVudDtcblxuXHRcdHBhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzIHx8IHt9O1xuXG5cdFx0cGFyZW50ID0gcGFyYW1ldGVycy5wYXJlbnQgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMucGFyZW50IDogZG9jdW1lbnQuYm9keTtcblx0XHRpZCA9IHBhcmFtZXRlcnMuaWQgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMuaWQgOiAnb2xkaWUnO1xuXG5cdFx0ZWxlbWVudCA9IERldGVjdG9yLmdldFdlYkdMRXJyb3JNZXNzYWdlKCk7XG5cdFx0ZWxlbWVudC5pZCA9IGlkO1xuXG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKCBlbGVtZW50ICk7XG5cblx0fVxuXG59O1xuXG4vL0VTNiBleHBvcnRcblxuZXhwb3J0IHsgRGV0ZWN0b3IgfTtcbiIsIi8vVGhpcyBsaWJyYXJ5IGlzIGRlc2lnbmVkIHRvIGhlbHAgc3RhcnQgdGhyZWUuanMgZWFzaWx5LCBjcmVhdGluZyB0aGUgcmVuZGVyIGxvb3AgYW5kIGNhbnZhcyBhdXRvbWFnaWNhbGx5LlxuLy9SZWFsbHkgaXQgc2hvdWxkIGJlIHNwdW4gb2ZmIGludG8gaXRzIG93biB0aGluZyBpbnN0ZWFkIG9mIGJlaW5nIHBhcnQgb2YgZXhwbGFuYXJpYS5cblxuLy9hbHNvLCBjaGFuZ2UgVGhyZWVhc3lfRW52aXJvbm1lbnQgdG8gVGhyZWVhc3lfUmVjb3JkZXIgdG8gZG93bmxvYWQgaGlnaC1xdWFsaXR5IGZyYW1lcyBvZiBhbiBhbmltYXRpb25cblxuaW1wb3J0IENDYXB0dXJlIGZyb20gJ2NjYXB0dXJlLmpzJztcbmltcG9ydCB7IERldGVjdG9yIH0gZnJvbSAnLi4vbGliL1dlYkdMX0RldGVjdG9yLmpzJztcbmltcG9ydCB7IHNldFRocmVlRW52aXJvbm1lbnQsIGdldFRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5mdW5jdGlvbiBUaHJlZWFzeUVudmlyb25tZW50KGNhbnZhc0VsZW0gPSBudWxsKXtcblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gMDtcbiAgICB0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyA9IChjYW52YXNFbGVtID09PSBudWxsKTtcblxuXHRpZighRGV0ZWN0b3Iud2ViZ2wpRGV0ZWN0b3IuYWRkR2V0V2ViR0xNZXNzYWdlKCk7XG5cbiAgICAvL2ZvdiwgYXNwZWN0LCBuZWFyLCBmYXJcblx0dGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoIDcwLCB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgMC4xLCAxMDAwMDAwMCApO1xuXHQvL3RoaXMuY2FtZXJhID0gbmV3IFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYSggNzAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDEwICk7XG5cblx0dGhpcy5jYW1lcmEucG9zaXRpb24uc2V0KDAsIDAsIDEwKTtcblx0dGhpcy5jYW1lcmEubG9va0F0KG5ldyBUSFJFRS5WZWN0b3IzKDAsMCwwKSk7XG5cblxuXHQvL2NyZWF0ZSBjYW1lcmEsIHNjZW5lLCB0aW1lciwgcmVuZGVyZXIgb2JqZWN0c1xuXHQvL2NyYWV0ZSByZW5kZXIgb2JqZWN0XG5cblxuXHRcblx0dGhpcy5zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xuXHR0aGlzLnNjZW5lLmFkZCh0aGlzLmNhbWVyYSk7XG5cblx0Ly9yZW5kZXJlclxuXHRsZXQgcmVuZGVyZXJPcHRpb25zID0geyBhbHBoYTogdHJ1ZSwgYW50aWFsaWFzOiB0cnVlfTtcblxuICAgIGlmKCF0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyl7XG4gICAgICAgIHJlbmRlcmVyT3B0aW9ucy5jYW52YXMgPSBjYW52YXNFbGVtO1xuICAgIH1cblxuXHR0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoIHJlbmRlcmVyT3B0aW9ucyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldFBpeGVsUmF0aW8oIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvICk7XG5cdHRoaXMucmVuZGVyZXIuc2V0Q2xlYXJDb2xvcihuZXcgVEhSRUUuQ29sb3IoMHhGRkZGRkYpLCAxLjApO1xuXG5cbiAgICB0aGlzLnJlc2l6ZUNhbnZhc0lmTmVjZXNzYXJ5KCk7IC8vcmVzaXplIGNhbnZhcyB0byB3aW5kb3cgc2l6ZSBhbmQgc2V0IGFzcGVjdCByYXRpb1xuXHQvKlxuXHR0aGlzLnJlbmRlcmVyLmdhbW1hSW5wdXQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLmdhbW1hT3V0cHV0ID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci5zaGFkb3dNYXAuZW5hYmxlZCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIudnIuZW5hYmxlZCA9IHRydWU7XG5cdCovXG5cblx0dGhpcy50aW1lU2NhbGUgPSAxO1xuXHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblx0dGhpcy50cnVlRWxhcHNlZFRpbWUgPSAwO1xuXG4gICAgaWYodGhpcy5zaG91bGRDcmVhdGVDYW52YXMpe1xuXHQgICAgdGhpcy5jb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHQgICAgdGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQoIHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCApO1xuICAgIH1cblxuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIHRoaXMub25Nb3VzZURvd24uYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZXVwJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaHN0YXJ0JywgdGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoZW5kJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblxuXHQvKlxuXHQvL3JlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlOyBcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd2cmRpc3BsYXlwb2ludGVycmVzdHJpY3RlZCcsIG9uUG9pbnRlclJlc3RyaWN0ZWQsIGZhbHNlICk7XG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cG9pbnRlcnVucmVzdHJpY3RlZCcsIG9uUG9pbnRlclVucmVzdHJpY3RlZCwgZmFsc2UgKTtcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggV0VCVlIuY3JlYXRlQnV0dG9uKCByZW5kZXJlciApICk7XG5cdCovXG5cblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCB0aGlzLm9uUGFnZUxvYWQuYmluZCh0aGlzKSwgZmFsc2UpO1xuXG5cdHRoaXMuY2xvY2sgPSBuZXcgVEhSRUUuQ2xvY2soKTtcblxuXHR0aGlzLklTX1JFQ09SRElORyA9IGZhbHNlOyAvLyBxdWVyeWFibGUgaWYgb25lIHdhbnRzIHRvIGRvIHRoaW5ncyBsaWtlIGJlZWYgdXAgcGFydGljbGUgY291bnRzIGZvciByZW5kZXJcblxuICAgIGlmKCF0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyAmJiBjYW52YXNFbGVtLm9mZnNldFdpZHRoKXtcbiAgICAgICAgLy9JZiB0aGUgY2FudmFzRWxlbWVudCBpcyBhbHJlYWR5IGxvYWRlZCwgdGhlbiB0aGUgJ2xvYWQnIGV2ZW50IGhhcyBhbHJlYWR5IGZpcmVkLiBXZSBuZWVkIHRvIHRyaWdnZXIgaXQgb3Vyc2VsdmVzLlxuICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMub25QYWdlTG9hZC5iaW5kKHRoaXMpKTtcbiAgICB9XG59XG5cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUGFnZUxvYWQgPSBmdW5jdGlvbigpIHtcblx0Y29uc29sZS5sb2coXCJUaHJlZWFzeV9TZXR1cCBsb2FkZWQhXCIpO1xuXHRpZih0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyl7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggdGhpcy5jb250YWluZXIgKTtcblx0fVxuXG5cdHRoaXMuc3RhcnQoKTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKXtcblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cdHRoaXMuY2xvY2suc3RhcnQoKTtcblx0dGhpcy5yZW5kZXIodGhpcy5wcmV2X3RpbWVzdGVwKTtcbn1cblxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Nb3VzZURvd24gPSBmdW5jdGlvbigpIHtcblx0dGhpcy5pc01vdXNlRG93biA9IHRydWU7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbk1vdXNlVXA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmlzTW91c2VEb3duID0gZmFsc2U7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vblBvaW50ZXJSZXN0cmljdGVkPSBmdW5jdGlvbigpIHtcblx0dmFyIHBvaW50ZXJMb2NrRWxlbWVudCA9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudDtcblx0aWYgKCBwb2ludGVyTG9ja0VsZW1lbnQgJiYgdHlwZW9mKHBvaW50ZXJMb2NrRWxlbWVudC5yZXF1ZXN0UG9pbnRlckxvY2spID09PSAnZnVuY3Rpb24nICkge1xuXHRcdHBvaW50ZXJMb2NrRWxlbWVudC5yZXF1ZXN0UG9pbnRlckxvY2soKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Qb2ludGVyVW5yZXN0cmljdGVkPSBmdW5jdGlvbigpIHtcblx0dmFyIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgPSBkb2N1bWVudC5wb2ludGVyTG9ja0VsZW1lbnQ7XG5cdHZhciBleHBlY3RlZFBvaW50ZXJMb2NrRWxlbWVudCA9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudDtcblx0aWYgKCBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ICYmIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgPT09IGV4cGVjdGVkUG9pbnRlckxvY2tFbGVtZW50ICYmIHR5cGVvZihkb2N1bWVudC5leGl0UG9pbnRlckxvY2spID09PSAnZnVuY3Rpb24nICkge1xuXHRcdGRvY3VtZW50LmV4aXRQb2ludGVyTG9jaygpO1xuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5ldmVuaWZ5ID0gZnVuY3Rpb24oeCl7XG5cdGlmKHggJSAyID09IDEpe1xuXHRcdHJldHVybiB4KzE7XG5cdH1cblx0cmV0dXJuIHg7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZXNpemVDYW52YXNJZk5lY2Vzc2FyeT0gZnVuY3Rpb24oKSB7XG4gICAgLy9odHRwczovL3dlYmdsMmZ1bmRhbWVudGFscy5vcmcvd2ViZ2wvbGVzc29ucy93ZWJnbC1hbnRpLXBhdHRlcm5zLmh0bWwgeWVzLCBldmVyeSBmcmFtZS5cbiAgICAvL3RoaXMgaGFuZGxlcyB0aGUgZWRnZSBjYXNlIHdoZXJlIHRoZSBjYW52YXMgc2l6ZSBjaGFuZ2VzIGJ1dCB0aGUgd2luZG93IHNpemUgZG9lc24ndFxuXG4gICAgbGV0IHdpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG4gICAgbGV0IGhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICBcbiAgICBpZighdGhpcy5zaG91bGRDcmVhdGVDYW52YXMpeyAvLyBhIGNhbnZhcyB3YXMgcHJvdmlkZWQgZXh0ZXJuYWxseVxuICAgICAgICB3aWR0aCA9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5jbGllbnRXaWR0aDtcbiAgICAgICAgaGVpZ2h0ID0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmNsaWVudEhlaWdodDtcbiAgICB9XG5cbiAgICBpZih3aWR0aCAhPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQud2lkdGggfHwgaGVpZ2h0ICE9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5oZWlnaHQpe1xuICAgICAgICAvL2NhbnZhcyBkaW1lbnNpb25zIGNoYW5nZWQsIHVwZGF0ZSB0aGUgaW50ZXJuYWwgcmVzb2x1dGlvblxuXG5cdCAgICB0aGlzLmNhbWVyYS5hc3BlY3QgPSB3aWR0aCAvIGhlaWdodDtcbiAgICAgICAgLy90aGlzLmNhbWVyYS5zZXRGb2NhbExlbmd0aCgzMCk7IC8vaWYgSSB1c2UgdGhpcywgdGhlIGNhbWVyYSB3aWxsIGtlZXAgYSBjb25zdGFudCB3aWR0aCBpbnN0ZWFkIG9mIGNvbnN0YW50IGhlaWdodFxuXHQgICAgdGhpcy5hc3BlY3QgPSB0aGlzLmNhbWVyYS5hc3BlY3Q7XG5cdCAgICB0aGlzLmNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG5cdCAgICB0aGlzLnJlbmRlcmVyLnNldFNpemUoIHRoaXMuZXZlbmlmeSh3aWR0aCksIHRoaXMuZXZlbmlmeShoZWlnaHQpLHRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzICk7XG4gICAgfVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUubGlzdGVuZXJzID0ge1widXBkYXRlXCI6IFtdLFwicmVuZGVyXCI6W119OyAvL3VwZGF0ZSBldmVudCBsaXN0ZW5lcnNcblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKHRpbWVzdGVwKXtcbiAgICB0aGlzLnJlc2l6ZUNhbnZhc0lmTmVjZXNzYXJ5KCk7XG5cbiAgICB2YXIgcmVhbHRpbWVEZWx0YSA9IHRoaXMuY2xvY2suZ2V0RGVsdGEoKTtcblx0dmFyIGRlbHRhID0gcmVhbHRpbWVEZWx0YSp0aGlzLnRpbWVTY2FsZTtcblx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcbiAgICB0aGlzLnRydWVFbGFwc2VkVGltZSArPSByZWFsdGltZURlbHRhO1xuXHQvL2dldCB0aW1lc3RlcFxuXHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmxlbmd0aDtpKyspe1xuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YSwncmVhbHRpbWVEZWx0YSc6cmVhbHRpbWVEZWx0YX0pO1xuXHR9XG5cblx0dGhpcy5yZW5kZXJlci5yZW5kZXIoIHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhICk7XG5cblx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXVtpXSgpO1xuXHR9XG5cblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gdGltZXN0ZXA7XG5cdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50X25hbWUsIGZ1bmMpe1xuXHQvL1JlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lci5cblx0Ly9lYWNoIGxpc3RlbmVyIHdpbGwgYmUgY2FsbGVkIHdpdGggYW4gb2JqZWN0IGNvbnNpc3Rpbmcgb2Y6XG5cdC8vXHR7dDogPGN1cnJlbnQgdGltZSBpbiBzPiwgXCJkZWx0YVwiOiA8ZGVsdGEsIGluIG1zPn1cblx0Ly8gYW4gdXBkYXRlIGV2ZW50IGZpcmVzIGJlZm9yZSBhIHJlbmRlci4gYSByZW5kZXIgZXZlbnQgZmlyZXMgcG9zdC1yZW5kZXIuXG5cdGlmKGV2ZW50X25hbWUgPT0gXCJ1cGRhdGVcIil7IFxuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLnB1c2goZnVuYyk7XG5cdH1lbHNlIGlmKGV2ZW50X25hbWUgPT0gXCJyZW5kZXJcIil7IFxuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLnB1c2goZnVuYyk7XG5cdH1lbHNle1xuXHRcdGNvbnNvbGUuZXJyb3IoXCJJbnZhbGlkIGV2ZW50IG5hbWUhXCIpXG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbihldmVudF9uYW1lLCBmdW5jKXtcblx0Ly9VbnJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciwgdW5kb2luZyBhbiBUaHJlZWFzeV9zZXR1cC5vbigpIGV2ZW50IGxpc3RlbmVyLlxuXHQvL3RoZSBuYW1pbmcgc2NoZW1lIG1pZ2h0IG5vdCBiZSB0aGUgYmVzdCBoZXJlLlxuXHRpZihldmVudF9uYW1lID09IFwidXBkYXRlXCIpeyBcblx0XHRsZXQgaW5kZXggPSB0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5pbmRleE9mKGZ1bmMpO1xuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLnNwbGljZShpbmRleCwxKTtcblx0fSBlbHNlIGlmKGV2ZW50X25hbWUgPT0gXCJyZW5kZXJcIil7IFxuXHRcdGxldCBpbmRleCA9IHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLmluZGV4T2YoZnVuYyk7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0uc3BsaWNlKGluZGV4LDEpO1xuXHR9ZWxzZXtcblx0XHRjb25zb2xlLmVycm9yKFwiTm9uZXhpc3RlbnQgZXZlbnQgbmFtZSFcIilcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub2ZmID0gVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lcjsgLy9hbGlhcyB0byBtYXRjaCBUaHJlZWFzeUVudmlyb25tZW50Lm9uXG5cbmNsYXNzIFRocmVlYXN5UmVjb3JkZXIgZXh0ZW5kcyBUaHJlZWFzeUVudmlyb25tZW50e1xuXHQvL2Jhc2VkIG9uIGh0dHA6Ly93d3cudHlzb25jYWRlbmhlYWQuY29tL2Jsb2cvZXhwb3J0aW5nLWNhbnZhcy1hbmltYXRpb24tdG8tbW92LyB0byByZWNvcmQgYW4gYW5pbWF0aW9uXG5cdC8vd2hlbiBkb25lLCAgICAgZmZtcGVnIC1yIDYwIC1mcmFtZXJhdGUgNjAgLWkgLi8lMDdkLnBuZyAtdmNvZGVjIGxpYngyNjQgLXBpeF9mbXQgeXV2NDIwcCAtY3JmOnYgMCB2aWRlby5tcDRcbiAgICAvLyB0byBwZXJmb3JtIG1vdGlvbiBibHVyIG9uIGFuIG92ZXJzYW1wbGVkIHZpZGVvLCBmZm1wZWcgLWkgdmlkZW8ubXA0IC12ZiB0YmxlbmQ9YWxsX21vZGU9YXZlcmFnZSxmcmFtZXN0ZXA9MiB2aWRlbzIubXA0XG5cdC8vdGhlbiwgYWRkIHRoZSB5dXY0MjBwIHBpeGVscyAod2hpY2ggZm9yIHNvbWUgcmVhc29uIGlzbid0IGRvbmUgYnkgdGhlIHByZXYgY29tbWFuZCkgYnk6XG5cdC8vIGZmbXBlZyAtaSB2aWRlby5tcDQgLXZjb2RlYyBsaWJ4MjY0IC1waXhfZm10IHl1djQyMHAgLXN0cmljdCAtMiAtYWNvZGVjIGFhYyBmaW5pc2hlZF92aWRlby5tcDRcblx0Ly9jaGVjayB3aXRoIGZmbXBlZyAtaSBmaW5pc2hlZF92aWRlby5tcDRcblxuXHRjb25zdHJ1Y3RvcihmcHM9MzAsIGxlbmd0aCA9IDUsIGNhbnZhc0VsZW0gPSBudWxsKXtcblx0XHQvKiBmcHMgaXMgZXZpZGVudCwgYXV0b3N0YXJ0IGlzIGEgYm9vbGVhbiAoYnkgZGVmYXVsdCwgdHJ1ZSksIGFuZCBsZW5ndGggaXMgaW4gcy4qL1xuXHRcdHN1cGVyKGNhbnZhc0VsZW0pO1xuXHRcdHRoaXMuZnBzID0gZnBzO1xuXHRcdHRoaXMuZWxhcHNlZFRpbWUgPSAwO1xuXHRcdHRoaXMuZnJhbWVDb3VudCA9IGZwcyAqIGxlbmd0aDtcblx0XHR0aGlzLmZyYW1lc19yZW5kZXJlZCA9IDA7XG5cblx0XHR0aGlzLmNhcHR1cmVyID0gbmV3IENDYXB0dXJlKCB7XG5cdFx0XHRmcmFtZXJhdGU6IGZwcyxcblx0XHRcdGZvcm1hdDogJ3BuZycsXG5cdFx0XHRuYW1lOiBkb2N1bWVudC50aXRsZSxcblx0XHRcdC8vdmVyYm9zZTogdHJ1ZSxcblx0XHR9ICk7XG5cblx0XHR0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuXG5cdFx0dGhpcy5JU19SRUNPUkRJTkcgPSB0cnVlO1xuXHR9XG5cdHN0YXJ0KCl7XG5cdFx0Ly9tYWtlIGEgcmVjb3JkaW5nIHNpZ25cblx0XHR0aGlzLnJlY29yZGluZ19pY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLndpZHRoPVwiMjBweFwiXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5oZWlnaHQ9XCIyMHB4XCJcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLnRvcCA9ICcyMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmxlZnQgPSAnMjBweCc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnMTBweCc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmVkJztcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMucmVjb3JkaW5nX2ljb24pO1xuXG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS50b3AgPSAnMjBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUubGVmdCA9ICc1MHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5jb2xvciA9ICdibGFjayc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDI1NSwyNTUsMjU1LDAuMSknO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5mcmFtZUNvdW50ZXIpO1xuXG5cdFx0dGhpcy5jYXB0dXJlci5zdGFydCgpO1xuXHRcdHRoaXMucmVuZGVyaW5nID0gdHJ1ZTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cdHJlbmRlcih0aW1lc3RlcCl7XG4gICAgICAgIHZhciByZWFsdGltZURlbHRhID0gMS90aGlzLmZwczsvL2lnbm9yaW5nIHRoZSB0cnVlIHRpbWUsIGNhbGN1bGF0ZSB0aGUgZGVsdGFcblx0XHR2YXIgZGVsdGEgPSByZWFsdGltZURlbHRhKnRoaXMudGltZVNjYWxlOyBcblx0XHR0aGlzLmVsYXBzZWRUaW1lICs9IGRlbHRhO1xuICAgICAgICB0aGlzLnRydWVFbGFwc2VkVGltZSArPSByZWFsdGltZURlbHRhO1xuXG5cdFx0Ly9nZXQgdGltZXN0ZXBcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl1baV0oe1widFwiOnRoaXMuZWxhcHNlZFRpbWUsXCJkZWx0YVwiOmRlbHRhLCAncmVhbHRpbWVEZWx0YSc6cmVhbHRpbWVEZWx0YX0pO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSApO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdW2ldKCk7XG5cdFx0fVxuXG5cblx0XHR0aGlzLnJlY29yZF9mcmFtZSgpO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLnJlbmRlci5iaW5kKHRoaXMpKTtcblx0fVxuXHRyZWNvcmRfZnJhbWUoKXtcblx0Ly9cdGxldCBjdXJyZW50X2ZyYW1lID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignY2FudmFzJykudG9EYXRhVVJMKCk7XG5cblx0XHR0aGlzLmNhcHR1cmVyLmNhcHR1cmUoIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2NhbnZhcycpICk7XG5cblx0XHR0aGlzLmZyYW1lQ291bnRlci5pbm5lckhUTUwgPSB0aGlzLmZyYW1lc19yZW5kZXJlZCArIFwiIC8gXCIgKyB0aGlzLmZyYW1lQ291bnQ7IC8vdXBkYXRlIHRpbWVyXG5cblx0XHR0aGlzLmZyYW1lc19yZW5kZXJlZCsrO1xuXG5cblx0XHRpZih0aGlzLmZyYW1lc19yZW5kZXJlZD50aGlzLmZyYW1lQ291bnQpe1xuXHRcdFx0dGhpcy5yZW5kZXIgPSBudWxsOyAvL2hhY2t5IHdheSBvZiBzdG9wcGluZyB0aGUgcmVuZGVyaW5nXG5cdFx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0XHRcdC8vdGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXG5cdFx0XHR0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5jYXB0dXJlci5zdG9wKCk7XG5cdFx0XHQvLyBkZWZhdWx0IHNhdmUsIHdpbGwgZG93bmxvYWQgYXV0b21hdGljYWxseSBhIGZpbGUgY2FsbGVkIHtuYW1lfS5leHRlbnNpb24gKHdlYm0vZ2lmL3Rhcilcblx0XHRcdHRoaXMuY2FwdHVyZXIuc2F2ZSgpO1xuXHRcdH1cblx0fVxuXHRyZXNpemVDYW52YXNJZk5lY2Vzc2FyeSgpIHtcblx0XHQvL3N0b3AgcmVjb3JkaW5nIGlmIHdpbmRvdyBzaXplIGNoYW5nZXNcblx0XHRpZih0aGlzLnJlbmRlcmluZyAmJiB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCAhPSB0aGlzLmFzcGVjdCl7XG5cdFx0XHR0aGlzLmNhcHR1cmVyLnN0b3AoKTtcblx0XHRcdHRoaXMucmVuZGVyID0gbnVsbDsgLy9oYWNreSB3YXkgb2Ygc3RvcHBpbmcgdGhlIHJlbmRlcmluZ1xuXHRcdFx0YWxlcnQoXCJBYm9ydGluZyByZWNvcmQ6IFdpbmRvdy1zaXplIGNoYW5nZSBkZXRlY3RlZCFcIik7XG5cdFx0XHR0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzdXBlci5yZXNpemVDYW52YXNJZk5lY2Vzc2FyeSgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHNldHVwVGhyZWUoZnBzPTMwLCBsZW5ndGggPSA1LCBjYW52YXNFbGVtID0gbnVsbCl7XG5cdC8qIFNldCB1cCB0aGUgdGhyZWUuanMgZW52aXJvbm1lbnQuIFN3aXRjaCBiZXR3ZWVuIGNsYXNzZXMgZHluYW1pY2FsbHkgc28gdGhhdCB5b3UgY2FuIHJlY29yZCBieSBhcHBlbmRpbmcgXCI/cmVjb3JkPXRydWVcIiB0byBhbiB1cmwuIFRoZW4gRVhQLnRocmVlRW52aXJvbm1lbnQuY2FtZXJhIGFuZCBFWFAudGhyZWVFbnZpcm9ubWVudC5zY2VuZSB3b3JrLCBhcyB3ZWxsIGFzIEVYUC50aHJlZUVudmlyb25tZW50Lm9uKCdldmVudCBuYW1lJywgY2FsbGJhY2spLiBPbmx5IG9uZSBlbnZpcm9ubWVudCBleGlzdHMgYXQgYSB0aW1lLlxuXG4gICAgVGhlIHJldHVybmVkIG9iamVjdCBpcyBhIHNpbmdsZXRvbjogbXVsdGlwbGUgY2FsbHMgd2lsbCByZXR1cm4gdGhlIHNhbWUgb2JqZWN0OiBFWFAudGhyZWVFbnZpcm9ubWVudC4qL1xuXHR2YXIgcmVjb3JkZXIgPSBudWxsO1xuXHR2YXIgaXNfcmVjb3JkaW5nID0gZmFsc2U7XG5cblx0Ly9leHRyYWN0IHJlY29yZCBwYXJhbWV0ZXIgZnJvbSB1cmxcblx0dmFyIHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoZG9jdW1lbnQubG9jYXRpb24uc2VhcmNoKTtcblx0bGV0IHJlY29yZFN0cmluZyA9IHBhcmFtcy5nZXQoXCJyZWNvcmRcIik7XG5cblx0aWYocmVjb3JkU3RyaW5nKXsgLy9kZXRlY3QgaWYgVVJMIHBhcmFtcyBpbmNsdWRlID9yZWNvcmQ9MSBvciA/cmVjb3JkPXRydWVcbiAgICAgICAgcmVjb3JkU3RyaW5nID0gcmVjb3JkU3RyaW5nLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlzX3JlY29yZGluZyA9IChyZWNvcmRTdHJpbmcgPT0gXCJ0cnVlXCIgfHwgcmVjb3JkU3RyaW5nID09IFwiMVwiKTtcbiAgICB9XG5cbiAgICBsZXQgdGhyZWVFbnZpcm9ubWVudCA9IGdldFRocmVlRW52aXJvbm1lbnQoKTtcbiAgICBpZih0aHJlZUVudmlyb25tZW50ICE9PSBudWxsKXsvL3NpbmdsZXRvbiBoYXMgYWxyZWFkeSBiZWVuIGNyZWF0ZWRcbiAgICAgICAgcmV0dXJuIHRocmVlRW52aXJvbm1lbnQ7XG4gICAgfVxuXG5cdGlmKGlzX3JlY29yZGluZyl7XG5cdFx0dGhyZWVFbnZpcm9ubWVudCA9IG5ldyBUaHJlZWFzeVJlY29yZGVyKGZwcywgbGVuZ3RoLCBjYW52YXNFbGVtKTtcblx0fWVsc2V7XG5cdFx0dGhyZWVFbnZpcm9ubWVudCA9IG5ldyBUaHJlZWFzeUVudmlyb25tZW50KGNhbnZhc0VsZW0pO1xuXHR9XG4gICAgc2V0VGhyZWVFbnZpcm9ubWVudCh0aHJlZUVudmlyb25tZW50KTtcbiAgICByZXR1cm4gdGhyZWVFbnZpcm9ubWVudDtcbn1cblxuZXhwb3J0IHtzZXR1cFRocmVlLCBUaHJlZWFzeUVudmlyb25tZW50LCBUaHJlZWFzeVJlY29yZGVyfVxuIiwiYXN5bmMgZnVuY3Rpb24gZGVsYXkod2FpdFRpbWUpe1xuXHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHR3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCB3YWl0VGltZSk7XG5cdH0pO1xuXG59XG5cbmV4cG9ydCB7ZGVsYXl9O1xuIiwiLy9MaW5lT3V0cHV0U2hhZGVycy5qc1xuXG4vL2Jhc2VkIG9uIGh0dHBzOi8vbWF0dGRlc2wuc3ZidGxlLmNvbS9kcmF3aW5nLWxpbmVzLWlzLWhhcmQgYnV0IHdpdGggc2V2ZXJhbCBlcnJvcnMgY29ycmVjdGVkLCBiZXZlbCBzaGFkaW5nIGFkZGVkLCBhbmQgbW9yZVxuXG5jb25zdCBMSU5FX0pPSU5fVFlQRVMgPSB7XCJNSVRFUlwiOiAwLjIsIFwiQkVWRUxcIjoxLjIsXCJST1VORFwiOjIuMn07IC8vSSdkIHVzZSAwLDEsMiBidXQgSlMgZG9lc24ndCBhZGQgYSBkZWNpbWFsIHBsYWNlIGF0IHRoZSBlbmQgd2hlbiBpbnNlcnRpbmcgdGhlbSBpbiBhIHN0cmluZy4gY3Vyc2VkIGp1c3RpZmljYXRpb25cblxudmFyIHZTaGFkZXIgPSBbXG5cInVuaWZvcm0gZmxvYXQgYXNwZWN0O1wiLCAvL3VzZWQgdG8gY2FsaWJyYXRlIHNjcmVlbiBzcGFjZVxuXCJ1bmlmb3JtIGZsb2F0IGxpbmVXaWR0aDtcIiwgLy93aWR0aCBvZiBsaW5lXG5cInVuaWZvcm0gZmxvYXQgbGluZUpvaW5UeXBlO1wiLFxuLy9cImF0dHJpYnV0ZSB2ZWMzIHBvc2l0aW9uO1wiLCAvL2FkZGVkIGF1dG9tYXRpY2FsbHkgYnkgdGhyZWUuanNcblwiYXR0cmlidXRlIHZlYzMgbmV4dFBvaW50UG9zaXRpb247XCIsXG5cImF0dHJpYnV0ZSB2ZWMzIHByZXZpb3VzUG9pbnRQb3NpdGlvbjtcIixcblwiYXR0cmlidXRlIGZsb2F0IGRpcmVjdGlvbjtcIixcblwiYXR0cmlidXRlIGZsb2F0IGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleDtcIixcblxuXCJ2YXJ5aW5nIGZsb2F0IGNyb3NzTGluZVBvc2l0aW9uO1wiLFxuXCJhdHRyaWJ1dGUgdmVjMyBjb2xvcjtcIixcblwidmFyeWluZyB2ZWMzIHZDb2xvcjtcIixcblwidmFyeWluZyB2ZWMyIGxpbmVTZWdtZW50QUNsaXBTcGFjZTtcIixcblwidmFyeWluZyB2ZWMyIGxpbmVTZWdtZW50QkNsaXBTcGFjZTtcIixcblwidmFyeWluZyBmbG9hdCB0aGlja25lc3M7XCIsXG5cblxuXCJ2YXJ5aW5nIHZlYzMgZGVidWdJbmZvO1wiLFxuXG5cInZlYzMgYW5nbGVfdG9faHVlKGZsb2F0IGFuZ2xlKSB7XCIsIC8vZm9yIGRlYnVnZ2luZ1xuXCIgIGFuZ2xlIC89IDMuMTQxNTkyKjIuO1wiLFxuXCIgIHJldHVybiBjbGFtcCgoYWJzKGZyYWN0KGFuZ2xlK3ZlYzMoMy4wLCAyLjAsIDEuMCkvMy4wKSo2LjAtMy4wKS0xLjApLCAwLjAsIDEuMCk7XCIsXG5cIn1cIixcblxuLy9naXZlbiBhbiB1bml0IHZlY3RvciwgbW92ZSBkaXN0IHVuaXRzIHBlcnBlbmRpY3VsYXIgdG8gaXQuXG5cInZlYzIgb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UodmVjMiBkaXIsIGZsb2F0IHR3aWNlRGlzdCkge1wiLFxuICBcInZlYzIgbm9ybWFsID0gdmVjMigtZGlyLnksIGRpci54KSA7XCIsXG4gIFwibm9ybWFsICo9IHR3aWNlRGlzdC8yLjA7XCIsXG4gIFwibm9ybWFsLnggLz0gYXNwZWN0O1wiLFxuICBcInJldHVybiBub3JtYWw7XCIsXG5cIn1cIixcblxuXCJ2b2lkIG1haW4oKSB7XCIsXG5cbiAgXCJ2ZWMyIGFzcGVjdFZlYyA9IHZlYzIoYXNwZWN0LCAxLjApO1wiLFxuICBcIm1hdDQgcHJvalZpZXdNb2RlbCA9IHByb2plY3Rpb25NYXRyaXggKlwiLFxuICAgICAgICAgICAgXCJ2aWV3TWF0cml4ICogbW9kZWxNYXRyaXg7XCIsXG4gIFwidmVjNCBwcmV2aW91c1Byb2plY3RlZCA9IHByb2pWaWV3TW9kZWwgKiB2ZWM0KHByZXZpb3VzUG9pbnRQb3NpdGlvbiwgMS4wKTtcIixcbiAgXCJ2ZWM0IGN1cnJlbnRQcm9qZWN0ZWQgPSBwcm9qVmlld01vZGVsICogdmVjNChwb3NpdGlvbiwgMS4wKTtcIixcbiAgXCJ2ZWM0IG5leHRQcm9qZWN0ZWQgPSBwcm9qVmlld01vZGVsICogdmVjNChuZXh0UG9pbnRQb3NpdGlvbiwgMS4wKTtcIixcblxuXG4gIC8vZ2V0IDJEIHNjcmVlbiBzcGFjZSB3aXRoIFcgZGl2aWRlIGFuZCBhc3BlY3QgY29ycmVjdGlvblxuICBcInZlYzIgY3VycmVudFNjcmVlbiA9IGN1cnJlbnRQcm9qZWN0ZWQueHkgLyBjdXJyZW50UHJvamVjdGVkLncgKiBhc3BlY3RWZWM7XCIsXG4gIFwidmVjMiBwcmV2aW91c1NjcmVlbiA9IHByZXZpb3VzUHJvamVjdGVkLnh5IC8gcHJldmlvdXNQcm9qZWN0ZWQudyAqIGFzcGVjdFZlYztcIixcbiAgXCJ2ZWMyIG5leHRTY3JlZW4gPSBuZXh0UHJvamVjdGVkLnh5IC8gbmV4dFByb2plY3RlZC53ICogYXNwZWN0VmVjO1wiLFxuXG4gIC8vXCJjZW50ZXJQb2ludENsaXBTcGFjZVBvc2l0aW9uID0gY3VycmVudFByb2plY3RlZC54eSAvIGN1cnJlbnRQcm9qZWN0ZWQudztcIiwvL3NlbmQgdG8gZnJhZ21lbnQgc2hhZGVyXG4gIFwiY3Jvc3NMaW5lUG9zaXRpb24gPSBkaXJlY3Rpb247XCIsIC8vc2VuZCBkaXJlY3Rpb24gdG8gdGhlIGZyYWdtZW50IHNoYWRlclxuICBcInZDb2xvciA9IGNvbG9yO1wiLCAvL3NlbmQgZGlyZWN0aW9uIHRvIHRoZSBmcmFnbWVudCBzaGFkZXJcblxuICBcInRoaWNrbmVzcyA9IGxpbmVXaWR0aCAvIDQwMC47XCIsIC8vVE9ETzogY29udmVydCBsaW5lV2lkdGggdG8gcGl4ZWxzXG4gIFwiZmxvYXQgb3JpZW50YXRpb24gPSAoZGlyZWN0aW9uLTAuNSkqMi47XCIsXG5cbiAgLy9nZXQgZGlyZWN0aW9ucyBmcm9tIChDIC0gQikgYW5kIChCIC0gQSlcbiAgXCJ2ZWMyIHZlY0EgPSAoY3VycmVudFNjcmVlbiAtIHByZXZpb3VzU2NyZWVuKTtcIixcbiAgXCJ2ZWMyIHZlY0IgPSAobmV4dFNjcmVlbiAtIGN1cnJlbnRTY3JlZW4pO1wiLFxuICBcInZlYzIgZGlyQSA9IG5vcm1hbGl6ZSh2ZWNBKTtcIixcbiAgXCJ2ZWMyIGRpckIgPSBub3JtYWxpemUodmVjQik7XCIsXG5cbiAgLy9ERUJVR1xuICBcImxpbmVTZWdtZW50QUNsaXBTcGFjZSA9IG1peChwcmV2aW91c1NjcmVlbixjdXJyZW50U2NyZWVuLGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleCkgLyBhc3BlY3RWZWM7XCIsLy9zZW5kIHRvIGZyYWdtZW50IHNoYWRlclxuICBcImxpbmVTZWdtZW50QkNsaXBTcGFjZSA9IG1peChjdXJyZW50U2NyZWVuLG5leHRTY3JlZW4sYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4KSAvIGFzcGVjdFZlYztcIiwvL3NlbmQgdG8gZnJhZ21lbnQgc2hhZGVyXG5cbiAgLy9zdGFydGluZyBwb2ludCB1c2VzIChuZXh0IC0gY3VycmVudClcbiAgXCJ2ZWMyIG9mZnNldCA9IHZlYzIoMC4wKTtcIixcbiAgXCJpZiAoY3VycmVudFNjcmVlbiA9PSBwcmV2aW91c1NjcmVlbikge1wiLFxuICBcIiAgb2Zmc2V0ID0gb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UoZGlyQiAqIG9yaWVudGF0aW9uLCB0aGlja25lc3MpO1wiLFxuICAvL29mZnNldCArPSBkaXJCICogdGhpY2tuZXNzOyAvL2VuZCBjYXBcbiAgXCJ9IFwiLFxuICAvL2VuZGluZyBwb2ludCB1c2VzIChjdXJyZW50IC0gcHJldmlvdXMpXG4gIFwiZWxzZSBpZiAoY3VycmVudFNjcmVlbiA9PSBuZXh0U2NyZWVuKSB7XCIsXG4gIFwiICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXJBICogb3JpZW50YXRpb24sIHRoaWNrbmVzcyk7XCIsXG4gIC8vb2Zmc2V0ICs9IGRpckEgKiB0aGlja25lc3M7IC8vZW5kIGNhcFxuICBcIn1cIixcbiAgXCIvL3NvbWV3aGVyZSBpbiBtaWRkbGUsIG5lZWRzIGEgam9pblwiLFxuICBcImVsc2Uge1wiLFxuICBcIiAgaWYgKGxpbmVKb2luVHlwZSA9PSBcIitMSU5FX0pPSU5fVFlQRVMuTUlURVIrXCIpIHtcIixcbiAgICAgICAgLy9jb3JuZXIgdHlwZTogbWl0ZXIuIFRoaXMgaXMgYnVnZ3kgKHRoZXJlJ3Mgbm8gbWl0ZXIgbGltaXQgeWV0KSBzbyBkb24ndCB1c2VcbiAgXCIgICAgLy9ub3cgY29tcHV0ZSB0aGUgbWl0ZXIgam9pbiBub3JtYWwgYW5kIGxlbmd0aFwiLFxuICBcIiAgICB2ZWMyIG1pdGVyRGlyZWN0aW9uID0gbm9ybWFsaXplKGRpckEgKyBkaXJCKTtcIixcbiAgXCIgICAgdmVjMiBwcmV2TGluZUV4dHJ1ZGVEaXJlY3Rpb24gPSB2ZWMyKC1kaXJBLnksIGRpckEueCk7XCIsXG4gIFwiICAgIHZlYzIgbWl0ZXIgPSB2ZWMyKC1taXRlckRpcmVjdGlvbi55LCBtaXRlckRpcmVjdGlvbi54KTtcIixcbiAgXCIgICAgZmxvYXQgbGVuID0gdGhpY2tuZXNzIC8gKGRvdChtaXRlciwgcHJldkxpbmVFeHRydWRlRGlyZWN0aW9uKSswLjAwMDEpO1wiLCAvL2NhbGN1bGF0ZS4gZG90IHByb2R1Y3QgaXMgYWx3YXlzID4gMFxuICBcIiAgICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShtaXRlckRpcmVjdGlvbiAqIG9yaWVudGF0aW9uLCBsZW4pO1wiLFxuICBcIiAgfSBlbHNlIGlmIChsaW5lSm9pblR5cGUgPT0gXCIrTElORV9KT0lOX1RZUEVTLkJFVkVMK1wiKXtcIixcbiAgICAvL2Nvcm5lciB0eXBlOiBiZXZlbFxuICBcIiAgICB2ZWMyIGRpciA9IG1peChkaXJBLCBkaXJCLCBhcHByb2FjaE5leHRPclByZXZWZXJ0ZXgpO1wiLFxuICBcIiAgICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXIgKiBvcmllbnRhdGlvbiwgdGhpY2tuZXNzKTtcIixcbiAgXCIgIH0gZWxzZSBpZiAobGluZUpvaW5UeXBlID09IFwiK0xJTkVfSk9JTl9UWVBFUy5ST1VORCtcIil7XCIsXG4gICAgLy9jb3JuZXIgdHlwZTogcm91bmRcbiAgXCIgICAgdmVjMiBkaXIgPSBtaXgoZGlyQSwgZGlyQiwgYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4KTtcIixcbiAgXCIgICAgdmVjMiBoYWxmVGhpY2tuZXNzUGFzdFRoZVZlcnRleCA9IGRpcip0aGlja25lc3MvMi4gKiBhcHByb2FjaE5leHRPclByZXZWZXJ0ZXggLyBhc3BlY3RWZWM7XCIsXG4gIFwiICAgIG9mZnNldCA9IG9mZnNldFBlcnBlbmRpY3VsYXJBbG9uZ1NjcmVlblNwYWNlKGRpciAqIG9yaWVudGF0aW9uLCB0aGlja25lc3MpIC0gaGFsZlRoaWNrbmVzc1Bhc3RUaGVWZXJ0ZXg7XCIsIC8vZXh0ZW5kIHJlY3RzIHBhc3QgdGhlIHZlcnRleFxuICBcIiAgfSBlbHNlIHtcIiwgLy9ubyBsaW5lIGpvaW4gdHlwZSBzcGVjaWZpZWQsIGp1c3QgZ28gZm9yIHRoZSBwcmV2aW91cyBwb2ludFxuICBcIiAgICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXJBLCB0aGlja25lc3MpO1wiLFxuICBcIiAgfVwiLFxuICBcIn1cIixcblxuICBcImRlYnVnSW5mbyA9IHZlYzMoYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4LCBvcmllbnRhdGlvbiwgMC4wKTtcIiwgLy9UT0RPOiByZW1vdmUuIGl0J3MgZm9yIGRlYnVnZ2luZyBjb2xvcnNcbiAgXCJnbF9Qb3NpdGlvbiA9IGN1cnJlbnRQcm9qZWN0ZWQgKyB2ZWM0KG9mZnNldCwgMC4wLDAuMCkgKmN1cnJlbnRQcm9qZWN0ZWQudztcIixcblwifVwiXS5qb2luKFwiXFxuXCIpO1xuXG52YXIgZlNoYWRlciA9IFtcblwidW5pZm9ybSBmbG9hdCBvcGFjaXR5O1wiLFxuXCJ1bmlmb3JtIHZlYzIgc2NyZWVuU2l6ZTtcIixcblwidW5pZm9ybSBmbG9hdCBhc3BlY3Q7XCIsXG5cInVuaWZvcm0gZmxvYXQgbGluZUpvaW5UeXBlO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgdkNvbG9yO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgZGVidWdJbmZvO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgbGluZVNlZ21lbnRBQ2xpcFNwYWNlO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgbGluZVNlZ21lbnRCQ2xpcFNwYWNlO1wiLFxuXCJ2YXJ5aW5nIGZsb2F0IGNyb3NzTGluZVBvc2l0aW9uO1wiLFxuXCJ2YXJ5aW5nIGZsb2F0IHRoaWNrbmVzcztcIixcblxuLyogdXNlZnVsIGZvciBkZWJ1Z2dpbmchIGZyb20gaHR0cHM6Ly93d3cucm9uamEtdHV0b3JpYWxzLmNvbS8yMDE4LzExLzI0L3NkZi1zcGFjZS1tYW5pcHVsYXRpb24uaHRtbFxuXCJ2ZWMzIHJlbmRlckxpbmVzT3V0c2lkZShmbG9hdCBkaXN0KXtcIixcblwiICAgIGZsb2F0IF9MaW5lRGlzdGFuY2UgPSAwLjM7XCIsXG5cIiAgICBmbG9hdCBfTGluZVRoaWNrbmVzcyA9IDAuMDU7XCIsXG5cIiAgICBmbG9hdCBfU3ViTGluZVRoaWNrbmVzcyA9IDAuMDU7XCIsXG5cIiAgICBmbG9hdCBfU3ViTGluZXMgPSAxLjA7XCIsXG5cIiAgICB2ZWMzIGNvbCA9IG1peCh2ZWMzKDEuMCwwLjIsMC4yKSwgdmVjMygwLjAsMC4yLDEuMiksIHN0ZXAoMC4wLCBkaXN0KSk7XCIsXG5cblwiICAgIGZsb2F0IGRpc3RhbmNlQ2hhbmdlID0gZndpZHRoKGRpc3QpICogMC41O1wiLFxuXCIgICAgZmxvYXQgbWFqb3JMaW5lRGlzdGFuY2UgPSBhYnMoZnJhY3QoZGlzdCAvIF9MaW5lRGlzdGFuY2UgKyAwLjUpIC0gMC41KSAqIF9MaW5lRGlzdGFuY2U7XCIsXG5cIiAgICBmbG9hdCBtYWpvckxpbmVzID0gc21vb3Roc3RlcChfTGluZVRoaWNrbmVzcyAtIGRpc3RhbmNlQ2hhbmdlLCBfTGluZVRoaWNrbmVzcyArIGRpc3RhbmNlQ2hhbmdlLCBtYWpvckxpbmVEaXN0YW5jZSk7XCIsXG5cblwiICAgIGZsb2F0IGRpc3RhbmNlQmV0d2VlblN1YkxpbmVzID0gX0xpbmVEaXN0YW5jZSAvIF9TdWJMaW5lcztcIixcblwiICAgIGZsb2F0IHN1YkxpbmVEaXN0YW5jZSA9IGFicyhmcmFjdChkaXN0IC8gZGlzdGFuY2VCZXR3ZWVuU3ViTGluZXMgKyAwLjUpIC0gMC41KSAqIGRpc3RhbmNlQmV0d2VlblN1YkxpbmVzO1wiLFxuXCIgICAgZmxvYXQgc3ViTGluZXMgPSBzbW9vdGhzdGVwKF9TdWJMaW5lVGhpY2tuZXNzIC0gZGlzdGFuY2VDaGFuZ2UsIF9TdWJMaW5lVGhpY2tuZXNzICsgZGlzdGFuY2VDaGFuZ2UsIHN1YkxpbmVEaXN0YW5jZSk7XCIsXG5cblwiICAgIHJldHVybiBjb2wgKiBtYWpvckxpbmVzICogc3ViTGluZXM7XCIsXG5cIn1cIiwgKi9cblxuXG5cImZsb2F0IGxpbmVTREYodmVjMiBwb2ludCwgdmVjMiBsaW5lU3RhcnRQdCx2ZWMyIGxpbmVFbmRQdCkge1wiLFxuICBcImZsb2F0IGggPSBjbGFtcChkb3QocG9pbnQtbGluZVN0YXJ0UHQsbGluZUVuZFB0LWxpbmVTdGFydFB0KS9kb3QobGluZUVuZFB0LWxpbmVTdGFydFB0LGxpbmVFbmRQdC1saW5lU3RhcnRQdCksMC4wLDEuMCk7XCIsXG4gIFwidmVjMiBwcm9qZWN0ZWRWZWMgPSAocG9pbnQtbGluZVN0YXJ0UHQtKGxpbmVFbmRQdC1saW5lU3RhcnRQdCkqaCk7XCIsXG4gIFwicmV0dXJuIGxlbmd0aChwcm9qZWN0ZWRWZWMpO1wiLFxuXCJ9XCIsXG5cblxuXCJ2b2lkIG1haW4oKXtcIixcblwiICB2ZWMzIGNvbCA9IHZDb2xvci5yZ2I7XCIsXG4vL1wiICBjb2wgPSBkZWJ1Z0luZm8ucmdiO1wiLFxuXCIgIGdsX0ZyYWdDb2xvciA9IHZlYzQoY29sLCBvcGFjaXR5KTtcIixcblxuXCIgIGlmIChsaW5lSm9pblR5cGUgPT0gXCIrTElORV9KT0lOX1RZUEVTLlJPVU5EK1wiKXtcIixcblwiICAgICAgdmVjMiB2ZXJ0U2NyZWVuU3BhY2VQb3NpdGlvbiA9IGdsX0ZyYWdDb29yZC54eTtcIiwgLy9nb2VzIGZyb20gMCB0byBzY3JlZW5TaXplLnh5XG5cIiAgICAgIHZlYzIgbGluZVB0QVNjcmVlblNwYWNlID0gKGxpbmVTZWdtZW50QUNsaXBTcGFjZSsxLikvMi4gKiBzY3JlZW5TaXplO1wiLCAvL2NvbnZlcnQgWy0xLDFdIHRvIFswLDFdLCB0aGVuICpzY3JlZW5TaXplXG5cIiAgICAgIHZlYzIgbGluZVB0QlNjcmVlblNwYWNlID0gKGxpbmVTZWdtZW50QkNsaXBTcGFjZSsxLikvMi4gKiBzY3JlZW5TaXplO1wiLFxuXCIgICAgICBmbG9hdCBkaXN0RnJvbUxpbmUgPSBsaW5lU0RGKHZlcnRTY3JlZW5TcGFjZVBvc2l0aW9uLCBsaW5lUHRBU2NyZWVuU3BhY2UsbGluZVB0QlNjcmVlblNwYWNlKTtcIixcblwiICAgICAgZmxvYXQgc2RmID0gMS4tKDEuL3RoaWNrbmVzcyAvc2NyZWVuU2l6ZS55ICogNC4wICpkaXN0RnJvbUxpbmUpO1wiLFxuXCIgICAgICBmbG9hdCBzZGZPcGFjaXR5ID0gY2xhbXAoc2RmIC8gKGFicyhkRmR4KHNkZikpICsgYWJzKGRGZHkoc2RmKSkpLDAuMCwxLjApO1wiLFxuLy9cIiAgICAgIGlmKG9wYWNpdHkgKiBzZGZPcGFjaXR5IDwgMC4xKWRpc2NhcmQ7XCIsXG5cIiAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoY29sLCBvcGFjaXR5ICogc2RmT3BhY2l0eSApO1wiLFxuXCIgIH1cIixcblwifVwiXS5qb2luKFwiXFxuXCIpXG5cbnZhciB1bmlmb3JtcyA9IHtcblx0bGluZVdpZHRoOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAxLjAsIC8vY3VycmVudGx5IGluIHVuaXRzIG9mIHlIZWlnaHQqNDAwXG5cdH0sXG5cdHNjcmVlblNpemU6IHtcblx0XHR2YWx1ZTogbmV3IFRIUkVFLlZlY3RvcjIoIDEsIDEgKSxcblx0fSxcblx0bGluZUpvaW5UeXBlOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiBMSU5FX0pPSU5fVFlQRVMuUk9VTkQsXG5cdH0sXG5cdG9wYWNpdHk6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCxcblx0fSxcblx0YXNwZWN0OiB7IC8vYXNwZWN0IHJhdGlvLiBuZWVkIHRvIGxvYWQgZnJvbSByZW5kZXJlclxuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMS4wLFxuXHR9XG59O1xuXG5leHBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcywgTElORV9KT0lOX1RZUEVTIH07XG4iLCJpbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuLi91dGlscy5qcyc7XG5pbXBvcnQgeyBnZXRUaHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcywgTElORV9KT0lOX1RZUEVTIH0gZnJvbSAnLi9MaW5lT3V0cHV0U2hhZGVycy5qcyc7XG5cbmNvbnN0IHRtcENvbG9yID0gbmV3IFRIUkVFLkNvbG9yKDB4MDAwMDAwKTtcblxuY2xhc3MgTGluZU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29yay5cbiAgICAgICAgQ3Jpc3AgbGluZXMgdXNpbmcgdGhlIHRlY2huaXF1ZSBpbiBodHRwczovL21hdHRkZXNsLnN2YnRsZS5jb20vZHJhd2luZy1saW5lcy1pcy1oYXJkLCBidXQgYWxzbyBzdXBwb3J0aW5nIG1pdGVyZWQgbGluZXMgYW5kIGJldmVsZWQgbGluZXMgdG9vIVxuICAgICAgICAgICAgb3B0aW9uczpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB3aWR0aDogbnVtYmVyLiB1bml0cyBhcmUgaW4gc2NyZWVuWS80MDAuXG4gICAgICAgICAgICAgICAgb3BhY2l0eTogbnVtYmVyXG4gICAgICAgICAgICAgICAgY29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcbiAgICAgICAgICAgICAgICBsaW5lSm9pbjogXCJiZXZlbFwiIG9yIFwicm91bmRcIi4gZGVmYXVsdDogcm91bmQuIERvbid0IGNoYW5nZSB0aGlzIGFmdGVyIGluaXRpYWxpemF0aW9uLlxuICAgICAgICAgICAgfVxuICAgICAgICAqL1xuXG4gICAgICAgIHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDU7XG4gICAgICAgIHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cbiAgICAgICAgdGhpcy5faGFzQ3VzdG9tQ29sb3JGdW5jdGlvbiA9IGZhbHNlO1xuICAgICAgICBpZihVdGlscy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29sb3IpKXtcbiAgICAgICAgICAgIHRoaXMuX2hhc0N1c3RvbUNvbG9yRnVuY3Rpb24gPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuY29sb3IpIDogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGluZUpvaW5UeXBlID0gb3B0aW9ucy5saW5lSm9pblR5cGUgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubGluZUpvaW5UeXBlLnRvVXBwZXJDYXNlKCkgOiBcIkJFVkVMXCI7XG4gICAgICAgIGlmKExJTkVfSk9JTl9UWVBFU1t0aGlzLmxpbmVKb2luVHlwZV0gPT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICB0aGlzLmxpbmVKb2luVHlwZSA9IFwiQkVWRUxcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuICAgICAgICB0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGhvdyBtYW55IHRpbWVzIHRvIGJlIGNhbGxlZCBpbiBlYWNoIGRpcmVjdGlvblxuICAgICAgICB0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gMzsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT9cblxuICAgICAgICB0aGlzLmluaXQoKTtcbiAgICB9XG4gICAgaW5pdCgpe1xuICAgICAgICB0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuICAgICAgICB0aGlzLl92ZXJ0aWNlcztcbiAgICAgICAgdGhpcy5tYWtlR2VvbWV0cnkoKTtcblxuXG4gICAgICAgIC8vbWFrZSBhIGRlZXAgY29weSBvZiB0aGUgdW5pZm9ybXMgdGVtcGxhdGVcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMgPSB7fTtcbiAgICAgICAgZm9yKHZhciB1bmlmb3JtTmFtZSBpbiB1bmlmb3Jtcyl7XG4gICAgICAgICAgICB0aGlzLl91bmlmb3Jtc1t1bmlmb3JtTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogdW5pZm9ybXNbdW5pZm9ybU5hbWVdLnR5cGUsXG4gICAgICAgICAgICAgICAgdmFsdWU6IHVuaWZvcm1zW3VuaWZvcm1OYW1lXS52YWx1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCh7XG4gICAgICAgICAgICBzaWRlOiBUSFJFRS5CYWNrU2lkZSxcbiAgICAgICAgICAgIHZlcnRleFNoYWRlcjogdlNoYWRlciwgXG4gICAgICAgICAgICBmcmFnbWVudFNoYWRlcjogZlNoYWRlcixcbiAgICAgICAgICAgIHVuaWZvcm1zOiB0aGlzLl91bmlmb3JtcyxcbiAgICAgICAgICAgIGV4dGVuc2lvbnM6e2Rlcml2YXRpdmVzOiB0cnVlLH0sXG4gICAgICAgICAgICBhbHBoYVRlc3Q6IDAuNSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cbiAgICAgICAgdGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy8gc2V0dGVyIHNldHMgdHJhbnNwYXJlbnQgZmxhZyBpZiBuZWNlc3NhcnlcbiAgICAgICAgdGhpcy5jb2xvciA9IHRoaXMuX2NvbG9yOyAvL3NldHRlciBzZXRzIGNvbG9yIGF0dHJpYnV0ZVxuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gdGhpcy5fb3BhY2l0eTtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMubGluZVdpZHRoLnZhbHVlID0gdGhpcy5fd2lkdGg7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLmxpbmVKb2luVHlwZS52YWx1ZSA9IExJTkVfSk9JTl9UWVBFU1t0aGlzLmxpbmVKb2luVHlwZV07XG5cbiAgICAgICAgZ2V0VGhyZWVFbnZpcm9ubWVudCgpLnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuICAgIH1cblxuICAgIG1ha2VHZW9tZXRyeSgpe1xuICAgICAgICBjb25zdCBNQVhfUE9JTlRTID0gMTAwMDsgLy90aGVzZSBhcnJheXMgZ2V0IGRpc2NhcmRlZCBvbiBmaXJzdCBhY3RpdmF0aW9uIGFueXdheXNcbiAgICAgICAgY29uc3QgTlVNX1BPSU5UU19QRVJfVkVSVEVYID0gNDtcblxuICAgICAgICBsZXQgbnVtVmVydHMgPSAoTUFYX1BPSU5UUy0xKSpOVU1fUE9JTlRTX1BFUl9WRVJURVg7XG5cbiAgICAgICAgdGhpcy5fdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIHRoaXMuX25leHRQb2ludFZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl9vdXRwdXREaW1lbnNpb25zICogbnVtVmVydHMpO1xuICAgICAgICB0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIG51bVZlcnRzKTtcbiAgICAgICAgdGhpcy5fY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheShudW1WZXJ0cyAqIDMpO1xuXG4gICAgICAgIC8vIGJ1aWxkIGdlb21ldHJ5XG5cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAncG9zaXRpb24nLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fdmVydGljZXMsIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKSApO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICduZXh0UG9pbnRQb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl9uZXh0UG9pbnRWZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3ByZXZpb3VzUG9pbnRQb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ2NvbG9yJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX2NvbG9ycywgMyApICk7XG5cbiAgICAgICAgdGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3VzZWQgZHVyaW5nIHVwZGF0ZXMgYXMgYSBwb2ludGVyIHRvIHRoZSBidWZmZXJcbiAgICAgICAgdGhpcy5fYWN0aXZhdGVkT25jZSA9IGZhbHNlO1xuXG4gICAgfVxuICAgIF9vbkFkZCgpe1xuICAgICAgICAvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgRG9tYWluIG5vZGUgd2UncmUgcmVuZGVyaW5nIGZyb21cbiAgICAgICAgbGV0IHJvb3QgPSBudWxsO1xuICAgICAgICB0cnl7XG4gICAgICAgICAgIHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcbiAgICAgICAgfWNhdGNoKGVycm9yKXtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihlcnJvcik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgLy90b2RvOiBpbXBsZW1lbnQgc29tZXRoaW5nIGxpa2UgYXNzZXJ0IHJvb3QgdHlwZW9mIFJvb3ROb2RlXG5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcbiAgICAgICAgdGhpcy5pdGVtRGltZW5zaW9ucyA9IHJvb3QuaXRlbURpbWVuc2lvbnM7XG4gICAgfVxuICAgIF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuICAgICAgICB0aGlzLl9vbkFkZCgpOyAvL3NldHVwIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLml0ZW1EaW1lbnNpb25zLiB1c2VkIGhlcmUgYWdhaW4gYmVjYXVzZSBjbG9uaW5nIG1lYW5zIHRoZSBvbkFkZCgpIG1pZ2h0IGJlIGNhbGxlZCBiZWZvcmUgdGhpcyBpcyBjb25uZWN0ZWQgdG8gYSB0eXBlIG9mIGRvbWFpblxuXG4gICAgICAgIC8vIHBlcmhhcHMgaW5zdGVhZCBvZiBnZW5lcmF0aW5nIGEgd2hvbGUgbmV3IGFycmF5LCB0aGlzIGNhbiByZXVzZSB0aGUgb2xkIG9uZT9cblxuICAgICAgICBjb25zdCBOVU1fUE9JTlRTX1BFUl9MSU5FX1NFR01FTlQgPSA0OyAvLzQgdXNlZCBmb3IgYmV2ZWxpbmdcbiAgICAgICAgY29uc3QgbnVtVmVydHMgPSAodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pICogTlVNX1BPSU5UU19QRVJfTElORV9TRUdNRU5UO1xuXG4gICAgICAgIGxldCB2ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIGxldCBuZXh0VmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICogbnVtVmVydHMpO1xuICAgICAgICBsZXQgcHJldlZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSggdGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIG51bVZlcnRzKTtcbiAgICAgICAgbGV0IGNvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkoIDMgKiBudW1WZXJ0cyk7XG5cbiAgICAgICAgbGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcbiAgICAgICAgdGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcbiAgICAgICAgcG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdmVydGljZXMpO1xuXG4gICAgICAgIGxldCBwcmV2UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucHJldmlvdXNQb2ludFBvc2l0aW9uO1xuICAgICAgICB0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcyA9IHByZXZWZXJ0aWNlcztcbiAgICAgICAgcHJldlBvaW50UG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fcHJldlBvaW50VmVydGljZXMpO1xuXG4gICAgICAgIGxldCBuZXh0UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubmV4dFBvaW50UG9zaXRpb247XG4gICAgICAgIHRoaXMuX25leHRQb2ludFZlcnRpY2VzID0gbmV4dFZlcnRpY2VzO1xuICAgICAgICBuZXh0UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9uZXh0UG9pbnRWZXJ0aWNlcyk7XG5cbiAgICAgICAgbGV0IGNvbG9yQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvcjtcbiAgICAgICAgdGhpcy5fY29sb3JzID0gY29sb3JzO1xuICAgICAgICBjb2xvckF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9jb2xvcnMpO1xuXG4gICAgICAgIC8vdXNlZCB0byBkaWZmZXJlbnRpYXRlIHRoZSBsZWZ0IGJvcmRlciBvZiB0aGUgbGluZSBmcm9tIHRoZSByaWdodCBib3JkZXJcbiAgICAgICAgbGV0IGRpcmVjdGlvbiA9IG5ldyBGbG9hdDMyQXJyYXkobnVtVmVydHMpO1xuICAgICAgICBmb3IobGV0IGk9MDsgaTxudW1WZXJ0cztpKyspe1xuICAgICAgICAgICAgZGlyZWN0aW9uW2ldID0gaSUyPT0wID8gMSA6IDA7IC8vYWx0ZXJuYXRlIC0xIGFuZCAxXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnZGlyZWN0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIGRpcmVjdGlvbiwgMSkgKTtcblxuICAgICAgICAvL3VzZWQgdG8gZGlmZmVyZW50aWF0ZSB0aGUgcG9pbnRzIHdoaWNoIG1vdmUgdG93YXJkcyBwcmV2IHZlcnRleCBmcm9tIHBvaW50cyB3aGljaCBtb3ZlIHRvd2FyZHMgbmV4dCB2ZXJ0ZXhcbiAgICAgICAgbGV0IG5leHRPclByZXYgPSBuZXcgRmxvYXQzMkFycmF5KG51bVZlcnRzKTtcbiAgICAgICAgZm9yKGxldCBpPTA7IGk8bnVtVmVydHM7aSsrKXtcbiAgICAgICAgICAgIG5leHRPclByZXZbaV0gPSBpJTQ8MiA/IDAgOiAxOyAvL2FsdGVybmF0ZSAwLDAsIDEsMVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ2FwcHJvYWNoTmV4dE9yUHJldlZlcnRleCcsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCBuZXh0T3JQcmV2LCAxKSApO1xuXG4gICAgICAgIC8vaW5kaWNlc1xuICAgICAgICAvKlxuICAgICAgICBGb3IgZWFjaCB2ZXJ0ZXgsIHdlIGNvbm5lY3QgaXQgdG8gdGhlIG5leHQgdmVydGV4IGxpa2UgdGhpczpcbiAgICAgICAgbiAtLW4rMi0tbis0LS1uKzZcbiAgICAgICAgfCAgLyAgfCAvIHwgIC8gIHxcbiAgICAgICBuKzEgLS1uKzMtLW4rNS0tbis3XG5cbiAgICAgICBwdDEgICBwdDIgcHQyICAgcHQzXG5cbiAgICAgICB2ZXJ0aWNlcyBuLG4rMSBhcmUgYXJvdW5kIHBvaW50IDEsIG4rMixuKzMsbis0LG4rNSBhcmUgYXJvdW5kIHB0Miwgbis2LG4rNyBhcmUgZm9yIHBvaW50My4gdGhlIG1pZGRsZSBzZWdtZW50IChuKzItbis1KSBpcyB0aGUgcG9seWdvbiB1c2VkIGZvciBiZXZlbGluZyBhdCBwb2ludCAyLlxuXG4gICAgICAgIHRoZW4gd2UgYWR2YW5jZSBuIHR3byBhdCBhIHRpbWUgdG8gbW92ZSB0byB0aGUgbmV4dCB2ZXJ0ZXguIHZlcnRpY2VzIG4sIG4rMSByZXByZXNlbnQgdGhlIHNhbWUgcG9pbnQ7XG4gICAgICAgIHRoZXkncmUgc2VwYXJhdGVkIGluIHRoZSB2ZXJ0ZXggc2hhZGVyIHRvIGEgY29uc3RhbnQgc2NyZWVuc3BhY2Ugd2lkdGggKi9cbiAgICAgICAgbGV0IGluZGljZXMgPSBbXTtcbiAgICAgICAgZm9yKGxldCB2ZXJ0TnVtPTA7dmVydE51bTwodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24tMSk7dmVydE51bSArPTEpeyAvL25vdCBzdXJlIHdoeSB0aGlzIC0zIGlzIHRoZXJlLiBpIGd1ZXNzIGl0IHN0b3BzIHZlcnROdW0rMyB0d28gbGluZXMgZG93biBmcm9tIGdvaW5nIHNvbWV3aGVyZSBpdCBzaG91bGRuJ3Q/XG4gICAgICAgICAgICBsZXQgZmlyc3RDb29yZGluYXRlID0gdmVydE51bSAlIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG4gICAgICAgICAgICBsZXQgZW5kaW5nTmV3TGluZSA9IGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTE7XG4gICAgXG4gICAgICAgICAgICBsZXQgdmVydEluZGV4ID0gdmVydE51bSAqIE5VTV9QT0lOVFNfUEVSX0xJTkVfU0VHTUVOVDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYoIWVuZGluZ05ld0xpbmUpe1xuICAgICAgICAgICAgICAgIC8vdGhlc2UgdHJpYW5nbGVzIHNob3VsZCBiZSBkaXNhYmxlZCB3aGVuIGRvaW5nIHJvdW5kIGpvaW5zXG4gICAgICAgICAgICAgICAgaWYodGhpcy5saW5lSm9pblR5cGUgPT0gXCJCRVZFTFwiKXtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKCB2ZXJ0SW5kZXgrMSwgdmVydEluZGV4LCAgIHZlcnRJbmRleCsyKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKCB2ZXJ0SW5kZXgrMSwgdmVydEluZGV4KzIsIHZlcnRJbmRleCszKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goIHZlcnRJbmRleCszLCB2ZXJ0SW5kZXgrMiwgdmVydEluZGV4KzQpO1xuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCggdmVydEluZGV4KzMsIHZlcnRJbmRleCs0LCB2ZXJ0SW5kZXgrNSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuc2V0SW5kZXgoIGluZGljZXMgKTtcblxuICAgICAgICBpZighdGhpcy5faGFzQ3VzdG9tQ29sb3JGdW5jdGlvbil7XG4gICAgICAgICAgICB0aGlzLnNldEFsbFZlcnRpY2VzVG9Db2xvcih0aGlzLmNvbG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgY29sb3JBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgIH1cbiAgICBldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeiwgLi4ub3RoZXJBcmdzKXtcbiAgICAgICAgaWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuICAgICAgICAgICAgdGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpOyAgICBcbiAgICAgICAgfVxuXG4gICAgICAgIC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblxuICAgICAgICAvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuICAgICAgICBsZXQgeFZhbHVlID0gIHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuICAgICAgICBsZXQgeVZhbHVlID0gIHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuICAgICAgICBsZXQgelZhbHVlID0gIHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXG4gICAgICAgIHRoaXMuc2F2ZVZlcnRleEluZm9JbkJ1ZmZlcnModGhpcy5fdmVydGljZXMsIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LCB4VmFsdWUseVZhbHVlLHpWYWx1ZSk7XG5cbiAgICAgICAgaWYodGhpcy5faGFzQ3VzdG9tQ29sb3JGdW5jdGlvbil7XG4gICAgICAgICAgICBsZXQgY29sb3IgPSB0aGlzLl9jb2xvcihpLHQseCx5LHosLi4ub3RoZXJBcmdzKTtcbiAgICAgICAgICAgIC8vaWYgcmV0dXJuIHR5cGUgaXMgW3IsZyxiXVxuICAgICAgICAgICAgaWYoVXRpbHMuaXNBcnJheShjb2xvcikpe1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldENvbG9yRm9yVmVydGV4UkdCKGksIGNvbG9yWzBdLGNvbG9yWzFdLGNvbG9yWzJdKTtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIC8vaWYgcmV0dXJuIHR5cGUgaXMgZWl0aGVyIGEgaGV4IHN0cmluZywgVEhSRUUuQ29sb3IsIG9yIGV2ZW4gYW4gSFRNTCBjb2xvciBzdHJpbmdcbiAgICAgICAgICAgICAgICB0bXBDb2xvci5zZXQoY29sb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldENvbG9yRm9yVmVydGV4KGksIHRtcENvbG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9XG5cbiAgICAgICAgLyogd2UncmUgZHJhd2luZyBsaWtlIHRoaXM6XG4gICAgICAgICotLS0tKi0tLS0qXG5cbiAgICAgICAgKi0tLS0qLS0tLSpcbiAgICBcbiAgICAgICAgYnV0IHdlIGRvbid0IHdhbnQgdG8gaW5zZXJ0IGEgZGlhZ29uYWwgbGluZSBhbnl3aGVyZS4gVGhpcyBoYW5kbGVzIHRoYXQ6ICAqL1xuXG4gICAgICAgIGxldCBmaXJzdENvb3JkaW5hdGUgPSBpICUgdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXTtcblxuICAgICAgICAvL2Jvb2xlYW4gdmFyaWFibGVzLiBpZiBpbiB0aGUgZnV0dXJlIExpbmVPdXRwdXQgY2FuIHN1cHBvcnQgdmFyaWFibGUtd2lkdGggbGluZXMsIHRoZXNlIHNob3VsZCBlYiBjaGFuZ2VkXG4gICAgICAgIGxldCBzdGFydGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gMDtcbiAgICAgICAgbGV0IGVuZGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xO1xuXG4gICAgICAgIGlmKHN0YXJ0aW5nTmV3TGluZSl7XG4gICAgICAgICAgICAvL21ha2UgdGhlIHByZXZQb2ludCBiZSB0aGUgc2FtZSBwb2ludCBhcyB0aGlzXG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX3ByZXZQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCwgeFZhbHVlLHlWYWx1ZSx6VmFsdWUpO1xuICAgICAgICB9ZWxzZXtcblxuICAgICAgICAgICAgbGV0IHByZXZYID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTEpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNF07XG4gICAgICAgICAgICBsZXQgcHJldlkgPSB0aGlzLl92ZXJ0aWNlc1sodGhpcy5fY3VycmVudFBvaW50SW5kZXgtMSkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucyo0KzFdO1xuICAgICAgICAgICAgbGV0IHByZXZaID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTEpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNCsyXTtcblxuICAgICAgICAgICAgLy9zZXQgdGhpcyB0aGluZydzIHByZXZQb2ludCB0byB0aGUgcHJldmlvdXMgdmVydGV4XG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX3ByZXZQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCwgcHJldlgscHJldlkscHJldlopO1xuXG4gICAgICAgICAgICAvL3NldCB0aGUgUFJFVklPVVMgcG9pbnQncyBuZXh0UG9pbnQgdG8gdG8gVEhJUyB2ZXJ0ZXguXG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX25leHRQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0xLCB4VmFsdWUseVZhbHVlLHpWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihlbmRpbmdOZXdMaW5lKXtcbiAgICAgICAgICAgIC8vbWFrZSB0aGUgbmV4dFBvaW50IGJlIHRoZSBzYW1lIHBvaW50IGFzIHRoaXNcbiAgICAgICAgICAgIHRoaXMuc2F2ZVZlcnRleEluZm9JbkJ1ZmZlcnModGhpcy5fbmV4dFBvaW50VmVydGljZXMsIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LCB4VmFsdWUseVZhbHVlLHpWYWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcbiAgICB9XG5cbiAgICBzYXZlVmVydGV4SW5mb0luQnVmZmVycyhhcnJheSwgdmVydE51bSwgdmFsdWUxLHZhbHVlMix2YWx1ZTMpe1xuICAgICAgICAvL2ZvciBldmVyeSBjYWxsIHRvIGFjdGl2YXRlKCksIGFsbCA0IGdlb21ldHJ5IHZlcnRpY2VzIHJlcHJlc2VudGluZyB0aGF0IHBvaW50IG5lZWQgdG8gc2F2ZSB0aGF0IGluZm8uXG4gICAgICAgIC8vVGhlcmVmb3JlLCB0aGlzIGZ1bmN0aW9uIHdpbGwgc3ByZWFkIHRocmVlIGNvb3JkaW5hdGVzIGludG8gYSBnaXZlbiBhcnJheSwgcmVwZWF0ZWRseS5cblxuICAgICAgICBsZXQgaW5kZXggPSB2ZXJ0TnVtKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNDtcblxuICAgICAgICBhcnJheVtpbmRleF0gICA9IHZhbHVlMVxuICAgICAgICBhcnJheVtpbmRleCsxXSA9IHZhbHVlMlxuICAgICAgICBhcnJheVtpbmRleCsyXSA9IHZhbHVlM1xuXG4gICAgICAgIGFycmF5W2luZGV4KzNdID0gdmFsdWUxXG4gICAgICAgIGFycmF5W2luZGV4KzRdID0gdmFsdWUyXG4gICAgICAgIGFycmF5W2luZGV4KzVdID0gdmFsdWUzXG5cbiAgICAgICAgYXJyYXlbaW5kZXgrNl0gPSB2YWx1ZTFcbiAgICAgICAgYXJyYXlbaW5kZXgrN10gPSB2YWx1ZTJcbiAgICAgICAgYXJyYXlbaW5kZXgrOF0gPSB2YWx1ZTNcblxuICAgICAgICBhcnJheVtpbmRleCs5XSAgPSB2YWx1ZTFcbiAgICAgICAgYXJyYXlbaW5kZXgrMTBdID0gdmFsdWUyXG4gICAgICAgIGFycmF5W2luZGV4KzExXSA9IHZhbHVlM1xuICAgICAgICBcbiAgICB9XG4gICAgb25BZnRlckFjdGl2YXRpb24oKXtcbiAgICAgICAgbGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcbiAgICAgICAgcG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgICBsZXQgcHJldlBvaW50UG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnByZXZpb3VzUG9pbnRQb3NpdGlvbjtcbiAgICAgICAgcHJldlBvaW50UG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgICBsZXQgbmV4dFBvaW50UG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5leHRQb2ludFBvc2l0aW9uO1xuICAgICAgICBuZXh0UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cbiAgICAgICAgLy91cGRhdGUgYXNwZWN0IHJhdGlvLiBpbiB0aGUgZnV0dXJlIHBlcmhhcHMgdGhpcyBzaG91bGQgb25seSBiZSBjaGFuZ2VkIHdoZW4gdGhlIGFzcGVjdCByYXRpbyBjaGFuZ2VzIHNvIGl0J3Mgbm90IGJlaW5nIGRvbmUgcGVyIGZyYW1lP1xuICAgICAgICBpZih0aGlzLl91bmlmb3Jtcyl7XG4gICAgICAgICAgICBjb25zdCB0aHJlZSA9IGdldFRocmVlRW52aXJvbm1lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3VuaWZvcm1zLmFzcGVjdC52YWx1ZSA9IHRocmVlLmNhbWVyYS5hc3BlY3Q7IC8vVE9ETzogcmUtZW5hYmxlIG9uY2UgZGVidWdnaW5nIGlzIGRvbmVcbiAgICAgICAgICAgIHRocmVlLnJlbmRlcmVyLmdldERyYXdpbmdCdWZmZXJTaXplKHRoaXMuX3VuaWZvcm1zLnNjcmVlblNpemUudmFsdWUpOyAvL21vZGlmaWVzIHVuaWZvcm0gaW4gcGxhY2VcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy9yZXNldCBhZnRlciBlYWNoIHVwZGF0ZVxuICAgIH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG4gICAgICAgIGdldFRocmVlRW52aXJvbm1lbnQoKS5zY2VuZS5yZW1vdmUodGhpcy5tZXNoKTtcbiAgICB9XG4gICAgc2V0QWxsVmVydGljZXNUb0NvbG9yKGNvbG9yKXtcbiAgICAgICAgY29uc3QgY29sID0gbmV3IFRIUkVFLkNvbG9yKGNvbG9yKTtcbiAgICAgICAgY29uc3QgbnVtVmVydGljZXMgPSAodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24tMSkqMjtcbiAgICAgICAgZm9yKGxldCBpPTA7IGk8bnVtVmVydGljZXM7aSsrKXtcbiAgICAgICAgICAgIC8vRG9uJ3QgZm9yZ2V0IHNvbWUgcG9pbnRzIGFwcGVhciB0d2ljZSAtIGFzIHRoZSBlbmQgb2Ygb25lIGxpbmUgc2VnbWVudCBhbmQgdGhlIGJlZ2lubmluZyBvZiB0aGUgbmV4dC5cbiAgICAgICAgICAgIHRoaXMuX3NldENvbG9yRm9yVmVydGV4UkdCKGksIGNvbC5yLCBjb2wuZywgY29sLmIpO1xuICAgICAgICB9XG4gICAgICAgIC8vdGVsbCB0aHJlZS5qcyB0byB1cGRhdGUgY29sb3JzXG4gICAgfVxuICAgIF9zZXRDb2xvckZvclZlcnRleCh2ZXJ0ZXhJbmRleCwgY29sb3Ipe1xuICAgICAgICAvL2NvbG9yIGlzIGEgVEhSRUUuQ29sb3IgaGVyZVxuICAgICAgICB0aGlzLl9zZXRDb2xvckZvclZlcnRleFJHQih2ZXJ0ZXhJbmRleCwgY29sb3IuciwgY29sb3IuZywgY29sb3IuYik7XG4gICAgfVxuICAgIF9zZXRDb2xvckZvclZlcnRleFJHQih2ZXJ0ZXhJbmRleCwgbm9ybWFsaXplZFIsIG5vcm1hbGl6ZWRHLCBub3JtYWxpemVkQil7XG4gICAgICAgIC8vYWxsIG9mIG5vcm1hbGl6ZWRSLCBub3JtYWxpemVkRywgbm9ybWFsaXplZEIgYXJlIDAtMS5cbiAgICAgICAgbGV0IGNvbG9yQXJyYXkgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLmNvbG9yLmFycmF5O1xuICAgICAgICBsZXQgaW5kZXggPSB2ZXJ0ZXhJbmRleCAqIDMgKiA0OyAvLyozIGJlY2F1c2UgY29sb3JzIGhhdmUgMyBjaGFubmVscywgKjQgYmVjYXVzZSA0IHZlcnRpY2VzL2xpbmUgcG9pbnRcblxuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgMF0gPSBub3JtYWxpemVkUjtcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDFdID0gbm9ybWFsaXplZEc7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAyXSA9IG5vcm1hbGl6ZWRCO1xuXG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAzXSA9IG5vcm1hbGl6ZWRSO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgNF0gPSBub3JtYWxpemVkRztcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDVdID0gbm9ybWFsaXplZEI7XG5cbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDZdID0gbm9ybWFsaXplZFI7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyA3XSA9IG5vcm1hbGl6ZWRHO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgOF0gPSBub3JtYWxpemVkQjtcblxuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgOV0gPSBub3JtYWxpemVkUjtcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDEwXSA9IG5vcm1hbGl6ZWRHO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgMTFdID0gbm9ybWFsaXplZEI7XG5cbiAgICAgICAgbGV0IGNvbG9yQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvcjtcbiAgICAgICAgY29sb3JBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgIH1cbiAgICBzZXQgY29sb3IoY29sb3Ipe1xuICAgICAgICAvL2NvbG9yIGNhbiBiZSBhIFRIUkVFLkNvbG9yKCksIG9yIGEgZnVuY3Rpb24gKGksdCx4LHkseikgPT4gVEhSRUUuQ29sb3IoKSwgd2hpY2ggd2lsbCBiZSBjYWxsZWQgb24gZXZlcnkgcG9pbnQuXG4gICAgICAgIHRoaXMuX2NvbG9yID0gY29sb3I7XG4gICAgICAgIGlmKFV0aWxzLmlzRnVuY3Rpb24oY29sb3IpKXtcbiAgICAgICAgICAgIHRoaXMuX2hhc0N1c3RvbUNvbG9yRnVuY3Rpb24gPSB0cnVlO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRoaXMuX2hhc0N1c3RvbUNvbG9yRnVuY3Rpb24gPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuc2V0QWxsVmVydGljZXNUb0NvbG9yKGNvbG9yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBnZXQgY29sb3IoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yO1xuICAgIH1cbiAgICBzZXQgb3BhY2l0eShvcGFjaXR5KXtcbiAgICAgICAgLy9tZXNoIGlzIGFsd2F5cyB0cmFuc3BhcmVudFxuICAgICAgICB0aGlzLm1hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDEgfHwgdGhpcy5saW5lSm9pblR5cGUgPT0gXCJST1VORFwiO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnZpc2libGUgPSBvcGFjaXR5ID4gMDtcbiAgICAgICAgdGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLm9wYWNpdHkudmFsdWUgPSBvcGFjaXR5O1xuICAgIH1cbiAgICBnZXQgb3BhY2l0eSgpe1xuICAgICAgICByZXR1cm4gdGhpcy5fb3BhY2l0eTtcbiAgICB9XG4gICAgc2V0IHdpZHRoKHdpZHRoKXtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMubGluZVdpZHRoLnZhbHVlID0gd2lkdGg7XG4gICAgfVxuICAgIGdldCB3aWR0aCgpe1xuICAgICAgICByZXR1cm4gdGhpcy5fd2lkdGg7XG4gICAgfVxuICAgIGNsb25lKCl7XG4gICAgICAgIHJldHVybiBuZXcgTGluZU91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHksIGxpbmVKb2luVHlwZTogdGhpcy5saW5lSm9pblR5cGV9KTtcbiAgICB9XG59XG5cbmV4cG9ydCB7TGluZU91dHB1dH07XG4iLCJpbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuaW1wb3J0IHsgdGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4uL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5jbGFzcyBQb2ludE91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKlxuXHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0Y29sb3I6IGhleCBjb2xvciwgYXMgaW4gMHhycmdnYmIuIFRlY2huaWNhbGx5LCB0aGlzIGlzIGEgSlMgaW50ZWdlci5cblx0XHRcdG9wYWNpdHk6IDAtMS4gT3B0aW9uYWwuXG5cdFx0Ki9cblxuXHRcdHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDE7XG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBuZXcgVEhSRUUuQ29sb3Iob3B0aW9ucy5jb2xvcikgOiBuZXcgVEhSRUUuQ29sb3IoMHg1NWFhNTUpO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cblx0XHR0aGlzLnBvaW50cyA9IFtdO1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe2NvbG9yOiB0aGlzLl9jb2xvcn0pO1xuICAgICAgICB0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvL3RyaWdnZXIgc2V0dGVyIHRvIHNldCB0aGlzLm1hdGVyaWFsJ3Mgb3BhY2l0eSBwcm9wZXJseVxuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSAwOyAvL3Nob3VsZCBhbHdheXMgYmUgZXF1YWwgdG8gdGhpcy5wb2ludHMubGVuZ3RoXG5cdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IGZhbHNlO1xuXHR9XG5cdF9vbkFkZCgpeyAvL3Nob3VsZCBiZSBjYWxsZWQgd2hlbiB0aGlzIGlzIC5hZGQoKWVkIHRvIHNvbWV0aGluZ1xuXHRcdC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBBcmVhXG5cdFx0bGV0IHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cblx0XHRpZih0aGlzLnBvaW50cy5sZW5ndGggPCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbil7XG5cdFx0XHRmb3IodmFyIGk9dGhpcy5wb2ludHMubGVuZ3RoO2k8dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb247aSsrKXtcblx0XHRcdFx0dGhpcy5wb2ludHMucHVzaChuZXcgUG9pbnRNZXNoKHt3aWR0aDogMSxtYXRlcmlhbDp0aGlzLm1hdGVyaWFsfSkpO1xuXHRcdFx0XHR0aGlzLnBvaW50c1tpXS5tZXNoLnNjYWxlLnNldFNjYWxhcih0aGlzLl93aWR0aCk7IC8vc2V0IHdpZHRoIGJ5IHNjYWxpbmcgcG9pbnRcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pdGhpcy5fb25BZGQoKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblx0XHR2YXIgcG9pbnQgPSB0aGlzLmdldFBvaW50KGkpO1xuXHRcdHBvaW50LnggPSB4ID09PSB1bmRlZmluZWQgPyAwIDogeDtcblx0XHRwb2ludC55ID0geSA9PT0gdW5kZWZpbmVkID8gMCA6IHk7XG5cdFx0cG9pbnQueiA9IHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXHR9XG5cdGdldFBvaW50KGkpe1xuXHRcdHJldHVybiB0aGlzLnBvaW50c1tpXTtcblx0fVxuICAgIHJlbW92ZVNlbGZGcm9tU2NlbmUoKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMucG9pbnRzLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5wb2ludHNbaV0ucmVtb3ZlU2VsZkZyb21TY2VuZSgpO1xuXHRcdH1cbiAgICB9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdC8vdGVjaG5pY2FsbHkgdGhpcyBzZXRzIGFsbCBwb2ludHMgdG8gdGhlIHNhbWUgY29sb3IuIFRvZG86IGFsbG93IGRpZmZlcmVudCBwb2ludHMgdG8gYmUgZGlmZmVyZW50bHkgY29sb3JlZC5cblx0XHRcblx0XHRsZXQgbWF0ID0gdGhpcy5tYXRlcmlhbDtcblx0XHRtYXQub3BhY2l0eSA9IG9wYWNpdHk7IC8vaW5zdGFudGlhdGUgdGhlIHBvaW50XG5cdFx0bWF0LnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG4gICAgICAgIG1hdC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRzZXQgY29sb3IoY29sb3Ipe1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmNvbG9yID0gY29sb3I7XG5cdFx0dGhpcy5fY29sb3IgPSBjb2xvcjtcblx0fVxuXHRnZXQgY29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3I7XG5cdH1cblx0c2V0IHdpZHRoKHdpZHRoKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMucG9pbnRzLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5nZXRQb2ludChpKS5tZXNoLnNjYWxlLnNldFNjYWxhcih3aWR0aCk7XG5cdFx0fVxuXHRcdHRoaXMuX3dpZHRoID0gd2lkdGg7XG5cdH1cblx0Z2V0IHdpZHRoKCl7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZHRoO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBQb2ludE91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG5cbmNsYXNzIFBvaW50TWVzaHtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0LypvcHRpb25zOlxuXHRcdFx0eCx5OiBudW1iZXJzXG5cdFx0XHR3aWR0aDogbnVtYmVyXG4gICAgICAgICAgICBtYXRlcmlhbDogXG5cdFx0Ki9cblxuXHRcdGxldCB3aWR0aCA9IG9wdGlvbnMud2lkdGggPT09IHVuZGVmaW5lZCA/IDEgOiBvcHRpb25zLndpZHRoXG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBvcHRpb25zLm1hdGVyaWFsOyAvL29uZSBtYXRlcmlhbCBwZXIgUG9pbnRPdXRwdXRcblxuXHRcdHRoaXMubWVzaCA9IG5ldyBUSFJFRS5NZXNoKHRoaXMuc2hhcmVkQ2lyY2xlR2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cblx0XHR0aGlzLm1lc2gucG9zaXRpb24uc2V0KHRoaXMueCx0aGlzLnksdGhpcy56KTtcblx0XHR0aGlzLm1lc2guc2NhbGUuc2V0U2NhbGFyKHRoaXMud2lkdGgvMik7XG5cdFx0dGhyZWVFbnZpcm9ubWVudC5zY2VuZS5hZGQodGhpcy5tZXNoKTtcblxuXHRcdHRoaXMueCA9IG9wdGlvbnMueCB8fCAwO1xuXHRcdHRoaXMueSA9IG9wdGlvbnMueSB8fCAwO1xuXHRcdHRoaXMueiA9IG9wdGlvbnMueiB8fCAwO1xuXHR9XG5cdHJlbW92ZVNlbGZGcm9tU2NlbmUoKXtcblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLm1lc2gpO1xuXHR9XG5cdHNldCB4KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi54ID0gaTtcblx0fVxuXHRzZXQgeShpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueSA9IGk7XG5cdH1cblx0c2V0IHooaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnogPSBpO1xuXHR9XG5cdGdldCB4KCl7XG5cdFx0cmV0dXJuIHRoaXMubWVzaC5wb3NpdGlvbi54O1xuXHR9XG5cdGdldCB5KCl7XG5cdFx0cmV0dXJuIHRoaXMubWVzaC5wb3NpdGlvbi55O1xuXHR9XG5cdGdldCB6KCl7XG5cdFx0cmV0dXJuIHRoaXMubWVzaC5wb3NpdGlvbi56O1xuXHR9XG59XG5Qb2ludE1lc2gucHJvdG90eXBlLnNoYXJlZENpcmNsZUdlb21ldHJ5ID0gbmV3IFRIUkVFLlNwaGVyZUdlb21ldHJ5KDEvMiwgOCwgNik7IC8vcmFkaXVzIDEvMiBtYWtlcyBkaWFtZXRlciAxLCBzbyB0aGF0IHNjYWxpbmcgYnkgbiBtZWFucyB3aWR0aD1uXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0UG9pbnQoKXtcblx0dmFyIHggPSBuZXcgRVhQLkFyZWEoe2JvdW5kczogW1stMTAsMTBdXX0pO1xuXHR2YXIgeSA9IG5ldyBFWFAuVHJhbnNmb3JtYXRpb24oeydleHByJzogKHgpID0+IHgqeH0pO1xuXHR2YXIgeSA9IG5ldyBFWFAuUG9pbnRPdXRwdXQoKTtcblx0eC5hZGQoeSk7XG5cdHkuYWRkKHopO1xuXHR4LmFjdGl2YXRlKCk7XG59XG5cbmV4cG9ydCB7UG9pbnRPdXRwdXQsIFBvaW50TWVzaH1cbiIsImltcG9ydCB7IExpbmVPdXRwdXQgfSBmcm9tICcuL0xpbmVPdXRwdXQuanMnO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuLi91dGlscy5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBWZWN0b3JPdXRwdXQgZXh0ZW5kcyBMaW5lT3V0cHV0e1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG4gICAgICAgIC8qXG4gICAgICAgICAgICAgICAgd2lkdGg6IG51bWJlci4gdW5pdHMgYXJlIGluIHNjcmVlblkvNDAwLlxuICAgICAgICAgICAgICAgIG9wYWNpdHk6IG51bWJlclxuICAgICAgICAgICAgICAgIGNvbG9yOiBoZXggY29kZSBvciBUSFJFRS5Db2xvcigpXG4gICAgICAgICAgICAgICAgbGluZUpvaW46IFwiYmV2ZWxcIiBvciBcInJvdW5kXCIuIGRlZmF1bHQ6IHJvdW5kLiBEb24ndCBjaGFuZ2UgdGhpcyBhZnRlciBpbml0aWFsaXphdGlvbi5cbiAgICAgICAgKi9cbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICB9XG4gICAgaW5pdCgpe1xuICAgICAgICB0aGlzLmFycm93TWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe2NvbG9yOiB0aGlzLl9jb2xvciwgbGluZXdpZHRoOiB0aGlzLl93aWR0aCwgb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSk7XG5cbiAgICAgICAgc3VwZXIuaW5pdCgpO1xuICAgICAgICB0aGlzLmFycm93aGVhZHMgPSBbXTtcblxuICAgICAgICAvL1RPRE86IG1ha2UgdGhlIGFycm93IHRpcCBjb2xvcnMgbWF0Y2ggdGhlIGNvbG9ycyBvZiB0aGUgbGluZXMnIHRpcHNcblxuICAgICAgICBjb25zdCBjaXJjbGVSZXNvbHV0aW9uID0gMTI7XG4gICAgICAgIGNvbnN0IGFycm93aGVhZFNpemUgPSAwLjM7XG4gICAgICAgIGNvbnN0IEVQU0lMT04gPSAwLjAwMDAxO1xuICAgICAgICB0aGlzLkVQU0lMT04gPSBFUFNJTE9OO1xuXG4gICAgICAgIHRoaXMuY29uZUdlb21ldHJ5ID0gbmV3IFRIUkVFLkN5bGluZGVyQnVmZmVyR2VvbWV0cnkoIDAsIGFycm93aGVhZFNpemUsIGFycm93aGVhZFNpemUqMS43LCBjaXJjbGVSZXNvbHV0aW9uLCAxICk7XG4gICAgICAgIGxldCBhcnJvd2hlYWRPdmVyc2hvb3RGYWN0b3IgPSAwLjE7IC8vdXNlZCBzbyB0aGF0IHRoZSBsaW5lIHdvbid0IHJ1ZGVseSBjbGlwIHRocm91Z2ggdGhlIHBvaW50IG9mIHRoZSBhcnJvd2hlYWRcbiAgICAgICAgdGhpcy5jb25lR2VvbWV0cnkudHJhbnNsYXRlKCAwLCAtIGFycm93aGVhZFNpemUgKyBhcnJvd2hlYWRPdmVyc2hvb3RGYWN0b3IsIDAgKTtcbiAgICAgICAgdGhpcy5fY29uZVVwRGlyZWN0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwxLDApO1xuICAgIH1cbiAgICBfb25GaXJzdEFjdGl2YXRpb24oKXtcbiAgICAgICAgc3VwZXIuX29uRmlyc3RBY3RpdmF0aW9uKCk7XG5cbiAgICAgICAgaWYodGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGggPiAxKXtcbiAgICAgICAgICAgIHRoaXMubnVtQXJyb3doZWFkcyA9IHRoaXMuaXRlbURpbWVuc2lvbnMuc2xpY2UoMCx0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xKS5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VycmVudCl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnQgKyBwcmV2O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgLy9hc3N1bWVkIGl0ZW1EaW1lbnNpb25zIGlzbid0IGEgbm9uemVybyBhcnJheS4gVGhhdCBzaG91bGQgYmUgdGhlIGNvbnN0cnVjdG9yJ3MgcHJvYmxlbS5cbiAgICAgICAgICAgIHRoaXMubnVtQXJyb3doZWFkcyA9IDE7XG4gICAgICAgIH1cblxuICAgICAgICAvL3JlbW92ZSBhbnkgcHJldmlvdXMgYXJyb3doZWFkc1xuICAgICAgICBmb3IodmFyIGk9MDtpPHRoaXMuYXJyb3doZWFkcy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGxldCBhcnJvdyA9IHRoaXMuYXJyb3doZWFkc1tpXTtcbiAgICAgICAgICAgIHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKGFycm93KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXJyb3doZWFkcyA9IG5ldyBBcnJheSh0aGlzLm51bUFycm93aGVhZHMpO1xuICAgICAgICBmb3IodmFyIGk9MDtpPHRoaXMubnVtQXJyb3doZWFkcztpKyspe1xuICAgICAgICAgICAgdGhpcy5hcnJvd2hlYWRzW2ldID0gbmV3IFRIUkVFLk1lc2godGhpcy5jb25lR2VvbWV0cnksIHRoaXMuYXJyb3dNYXRlcmlhbCk7XG4gICAgICAgICAgICB0aGlzLm1lc2guYWRkKHRoaXMuYXJyb3doZWFkc1tpXSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coXCJudW1iZXIgb2YgYXJyb3doZWFkcyAoPSBudW1iZXIgb2YgbGluZXMpOlwiKyB0aGlzLm51bUFycm93aGVhZHMpO1xuICAgIH1cbiAgICBldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG4gICAgICAgIC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cbiAgICAgICAgc3VwZXIuZXZhbHVhdGVTZWxmKGksdCx4LHkseik7XG5cbiAgICAgICAgY29uc3QgbGFzdERpbWVuc2lvbkxlbmd0aCA9IHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG4gICAgICAgIGxldCBmaXJzdENvb3JkaW5hdGUgPSBpICUgbGFzdERpbWVuc2lvbkxlbmd0aDtcblxuICAgICAgICAvL2Jvb2xlYW4gdmFyaWFibGVzLiBpZiBpbiB0aGUgZnV0dXJlIExpbmVPdXRwdXQgY2FuIHN1cHBvcnQgdmFyaWFibGUtd2lkdGggbGluZXMsIHRoZXNlIHNob3VsZCBlYiBjaGFuZ2VkXG4gICAgICAgIGxldCBzdGFydGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gMDtcbiAgICAgICAgbGV0IGVuZGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gbGFzdERpbWVuc2lvbkxlbmd0aC0xO1xuXG4gICAgICAgIGlmKGVuZGluZ05ld0xpbmUpe1xuICAgICAgICAgICAgLy93ZSBuZWVkIHRvIHVwZGF0ZSBhcnJvd3NcbiAgICAgICAgICAgIC8vY2FsY3VsYXRlIGRpcmVjdGlvbiBvZiBsYXN0IGxpbmUgc2VnbWVudFxuICAgICAgICAgICAgLy90aGlzIHBvaW50IGlzIGN1cnJlbnRQb2ludEluZGV4LTEgYmVjYXVzZSBjdXJyZW50UG9pbnRJbmRleCB3YXMgaW5jcmVhc2VkIGJ5IDEgZHVyaW5nIHN1cGVyLmV2YWx1YXRlU2VsZigpXG4gICAgICAgICAgICBsZXQgaW5kZXggPSAodGhpcy5fY3VycmVudFBvaW50SW5kZXgtMSkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucyo0O1xuXG4gICAgICAgICAgICBsZXQgcHJldlggPSB0aGlzLl92ZXJ0aWNlc1sodGhpcy5fY3VycmVudFBvaW50SW5kZXgtMikqdGhpcy5fb3V0cHV0RGltZW5zaW9ucyo0XTtcbiAgICAgICAgICAgIGxldCBwcmV2WSA9IHRoaXMuX3ZlcnRpY2VzWyh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0yKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjQrMV07XG4gICAgICAgICAgICBsZXQgcHJldlogPSB0aGlzLl92ZXJ0aWNlc1sodGhpcy5fY3VycmVudFBvaW50SW5kZXgtMikqdGhpcy5fb3V0cHV0RGltZW5zaW9ucyo0KzJdO1xuXG4gICAgICAgICAgICBsZXQgZHggPSBwcmV2WCAtIHRoaXMuX3ZlcnRpY2VzW2luZGV4XTtcbiAgICAgICAgICAgIGxldCBkeSA9IHByZXZZIC0gdGhpcy5fdmVydGljZXNbaW5kZXgrMV07XG4gICAgICAgICAgICBsZXQgZHogPSBwcmV2WiAtIHRoaXMuX3ZlcnRpY2VzW2luZGV4KzJdO1xuXG4gICAgICAgICAgICBsZXQgbGluZU51bWJlciA9IE1hdGguZmxvb3IoaSAvIGxhc3REaW1lbnNpb25MZW5ndGgpO1xuICAgICAgICAgICAgVXRpbHMuYXNzZXJ0KGxpbmVOdW1iZXIgPD0gdGhpcy5udW1BcnJvd2hlYWRzKTsgLy90aGlzIG1heSBiZSB3cm9uZ1xuXG4gICAgICAgICAgICBsZXQgZGlyZWN0aW9uVmVjdG9yID0gbmV3IFRIUkVFLlZlY3RvcjMoLWR4LC1keSwtZHopO1xuXG4gICAgICAgICAgICAvL01ha2UgYXJyb3dzIGRpc2FwcGVhciBpZiB0aGUgbGluZSBpcyBzbWFsbCBlbm91Z2hcbiAgICAgICAgICAgIC8vT25lIHdheSB0byBkbyB0aGlzIHdvdWxkIGJlIHRvIHN1bSB0aGUgZGlzdGFuY2VzIG9mIGFsbCBsaW5lIHNlZ21lbnRzLiBJJ20gY2hlYXRpbmcgaGVyZSBhbmQganVzdCBtZWFzdXJpbmcgdGhlIGRpc3RhbmNlIG9mIHRoZSBsYXN0IHZlY3RvciwgdGhlbiBtdWx0aXBseWluZyBieSB0aGUgbnVtYmVyIG9mIGxpbmUgc2VnbWVudHMgKG5haXZlbHkgYXNzdW1pbmcgYWxsIGxpbmUgc2VnbWVudHMgYXJlIHRoZSBzYW1lIGxlbmd0aClcbiAgICAgICAgICAgIGxldCBsZW5ndGggPSBkaXJlY3Rpb25WZWN0b3IubGVuZ3RoKCkgKiAobGFzdERpbWVuc2lvbkxlbmd0aC0xKTtcblxuICAgICAgICAgICAgY29uc3QgZWZmZWN0aXZlRGlzdGFuY2UgPSAzO1xuICAgICAgICAgICAgbGV0IGNsYW1wZWRMZW5ndGggPSBNYXRoLm1heCgwLCBNYXRoLm1pbihsZW5ndGgvZWZmZWN0aXZlRGlzdGFuY2UsIDEpKTtcblxuICAgICAgICAgICAgLy9zaHJpbmsgZnVuY3Rpb24gZGVzaWduZWQgdG8gaGF2ZSBhIHN0ZWVwIHNsb3BlIGNsb3NlIHRvIDAgYnV0IG1lbGxvdyBvdXQgYXQgMC41IG9yIHNvIGluIG9yZGVyIHRvIGF2b2lkIHRoZSBsaW5lIHdpZHRoIG92ZXJjb21pbmcgdGhlIGFycm93aGVhZCB3aWR0aFxuICAgICAgICAgICAgLy9JbiBDaHJvbWUsIHRocmVlLmpzIGNvbXBsYWlucyB3aGVuZXZlciBzb21ldGhpbmcgaXMgc2V0IHRvIDAgc2NhbGUuIEFkZGluZyBhbiBlcHNpbG9uIHRlcm0gaXMgdW5mb3J0dW5hdGUgYnV0IG5lY2Vzc2FyeSB0byBhdm9pZCBjb25zb2xlIHNwYW0uXG4gICAgICAgICAgICB0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0uc2NhbGUuc2V0U2NhbGFyKE1hdGguYWNvcygxLTIqY2xhbXBlZExlbmd0aCkvTWF0aC5QSSArIHRoaXMuRVBTSUxPTik7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgICAvL3Bvc2l0aW9uL3JvdGF0aW9uIGNvbWVzIGFmdGVyIHNpbmNlIC5ub3JtYWxpemUoKSBtb2RpZmllcyBkaXJlY3Rpb25WZWN0b3IgaW4gcGxhY2VcbiAgICAgICAgICAgIGxldCBwb3MgPSB0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0ucG9zaXRpb247XG4gICAgICAgICAgICBwb3MueCA9IHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuICAgICAgICAgICAgcG9zLnkgPSB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcbiAgICAgICAgICAgIHBvcy56ID0geiA9PT0gdW5kZWZpbmVkID8gMCA6IHo7XG5cbiAgICAgICAgICAgIGlmKGxlbmd0aCA+IDApeyAvL2RpcmVjdGlvblZlY3Rvci5ub3JtYWxpemUoKSBmYWlscyB3aXRoIDAgbGVuZ3RoXG4gICAgICAgICAgICAgICAgdGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnF1YXRlcm5pb24uc2V0RnJvbVVuaXRWZWN0b3JzKHRoaXMuX2NvbmVVcERpcmVjdGlvbiwgZGlyZWN0aW9uVmVjdG9yLm5vcm1hbGl6ZSgpICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXQgY29sb3IoY29sb3Ipe1xuICAgICAgICAvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cbiAgICAgICAgLy9JIHNob3VsZCByZWFsbHkgbWFrZSBpdCBwb3NzaWJsZSB0byBzcGVjaWZ5IGNvbG9yIGJ5IGEgZnVuY3Rpb24uXG4gICAgICAgIHRoaXMuX2NvbG9yID0gY29sb3I7XG4gICAgICAgIHRoaXMuc2V0QWxsVmVydGljZXNUb0NvbG9yKGNvbG9yKTtcbiAgICAgICAgdGhpcy5hcnJvd01hdGVyaWFsLmNvbG9yID0gbmV3IFRIUkVFLkNvbG9yKHRoaXMuX2NvbG9yKTtcbiAgICB9XG5cbiAgICBnZXQgY29sb3IoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yO1xuICAgIH1cblxuICAgIHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuICAgICAgICB0aGlzLmFycm93TWF0ZXJpYWwub3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMuYXJyb3dNYXRlcmlhbC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDEgfHwgdGhpcy5saW5lSm9pblR5cGUgPT0gXCJST1VORFwiO1xuICAgICAgICB0aGlzLmFycm93TWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXG4gICAgICAgIC8vbWVzaCBpcyBhbHdheXMgdHJhbnNwYXJlbnRcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG4gICAgICAgIHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gb3BhY2l0eTtcbiAgICB9XG5cbiAgICBnZXQgb3BhY2l0eSgpe1xuICAgICAgICByZXR1cm4gdGhpcy5fb3BhY2l0eTtcbiAgICB9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLm1lc2gpO1xuICAgICAgICBmb3IodmFyIGk9MDtpPHRoaXMubnVtQXJyb3doZWFkcztpKyspe1xuICAgICAgICAgICAgdGhyZWVFbnZpcm9ubWVudC5zY2VuZS5yZW1vdmUodGhpcy5hcnJvd2hlYWRzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjbG9uZSgpe1xuICAgICAgICByZXR1cm4gbmV3IFZlY3Rvck91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHksbGluZUpvaW5UeXBlOiB0aGlzLmxpbmVKb2luVHlwZX0pO1xuICAgIH1cbn1cblxuXG4iLCIvL1N1cmZhY2VPdXRwdXRTaGFkZXJzLmpzXG5cbi8vZXhwZXJpbWVudDogc2hhZGVycyB0byBnZXQgdGhlIHRyaWFuZ2xlIHB1bHNhdGluZyFcbnZhciB2U2hhZGVyID0gW1xuXCJ2YXJ5aW5nIHZlYzMgdk5vcm1hbDtcIixcblwidmFyeWluZyB2ZWMzIHZQb3NpdGlvbjtcIixcblwidmFyeWluZyB2ZWMyIHZVdjtcIixcblwidW5pZm9ybSBmbG9hdCB0aW1lO1wiLFxuXCJ1bmlmb3JtIHZlYzMgY29sb3I7XCIsXG5cInVuaWZvcm0gdmVjMyB2TGlnaHQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgZ3JpZFNxdWFyZXM7XCIsXG5cblwidm9pZCBtYWluKCkge1wiLFxuXHRcInZQb3NpdGlvbiA9IHBvc2l0aW9uLnh5ejtcIixcblx0XCJ2Tm9ybWFsID0gbm9ybWFsLnh5ejtcIixcblx0XCJ2VXYgPSB1di54eTtcIixcblx0XCJnbF9Qb3NpdGlvbiA9IHByb2plY3Rpb25NYXRyaXggKlwiLFxuICAgICAgICAgICAgXCJtb2RlbFZpZXdNYXRyaXggKlwiLFxuICAgICAgICAgICAgXCJ2ZWM0KHBvc2l0aW9uLDEuMCk7XCIsXG5cIn1cIl0uam9pbihcIlxcblwiKVxuXG52YXIgZlNoYWRlciA9IFtcblwidmFyeWluZyB2ZWMzIHZOb3JtYWw7XCIsXG5cInZhcnlpbmcgdmVjMyB2UG9zaXRpb247XCIsXG5cInZhcnlpbmcgdmVjMiB2VXY7XCIsXG5cInVuaWZvcm0gZmxvYXQgdGltZTtcIixcblwidW5pZm9ybSB2ZWMzIGNvbG9yO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IHVzZUN1c3RvbUdyaWRDb2xvcjtcIixcblwidW5pZm9ybSB2ZWMzIGdyaWRDb2xvcjtcIixcblwidW5pZm9ybSB2ZWMzIHZMaWdodDtcIixcblwidW5pZm9ybSBmbG9hdCBncmlkU3F1YXJlcztcIixcblwidW5pZm9ybSBmbG9hdCBsaW5lV2lkdGg7XCIsXG5cInVuaWZvcm0gZmxvYXQgc2hvd0dyaWQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgc2hvd1NvbGlkO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IG9wYWNpdHk7XCIsXG5cblx0Ly90aGUgZm9sbG93aW5nIGNvZGUgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdW5jb25lZC9tYXRoYm94L2Jsb2IvZWFlYjhlMTVlZjJkMDI1Mjc0MGE3NDUwNWExMmQ3YTEwNTFhNjFiNi9zcmMvc2hhZGVycy9nbHNsL21lc2guZnJhZ21lbnQuc2hhZGVkLmdsc2xcblwidmVjMyBvZmZTcGVjdWxhcih2ZWMzIGNvbG9yKSB7XCIsXG5cIiAgdmVjMyBjID0gMS4wIC0gY29sb3I7XCIsXG5cIiAgcmV0dXJuIDEuMCAtIGMgKiBjO1wiLFxuXCJ9XCIsXG5cblwidmVjNCBnZXRTaGFkZWRDb2xvcih2ZWM0IHJnYmEpIHsgXCIsXG5cIiAgdmVjMyBjb2xvciA9IHJnYmEueHl6O1wiLFxuXCIgIHZlYzMgY29sb3IyID0gb2ZmU3BlY3VsYXIocmdiYS54eXopO1wiLFxuXG5cIiAgdmVjMyBub3JtYWwgPSBub3JtYWxpemUodk5vcm1hbCk7XCIsXG5cIiAgdmVjMyBsaWdodCA9IG5vcm1hbGl6ZSh2TGlnaHQpO1wiLFxuXCIgIHZlYzMgcG9zaXRpb24gPSBub3JtYWxpemUodlBvc2l0aW9uKTtcIixcblxuXCIgIGZsb2F0IHNpZGUgICAgPSBnbF9Gcm9udEZhY2luZyA/IC0xLjAgOiAxLjA7XCIsXG5cIiAgZmxvYXQgY29zaW5lICA9IHNpZGUgKiBkb3Qobm9ybWFsLCBsaWdodCk7XCIsXG5cIiAgZmxvYXQgZGlmZnVzZSA9IG1peChtYXgoMC4wLCBjb3NpbmUpLCAuNSArIC41ICogY29zaW5lLCAuMSk7XCIsXG5cblwiICBmbG9hdCByaW1MaWdodGluZyA9IG1heChtaW4oMS4wIC0gc2lkZSpkb3Qobm9ybWFsLCBsaWdodCksIDEuMCksMC4wKTtcIixcblxuXCJcdGZsb2F0IHNwZWN1bGFyID0gbWF4KDAuMCwgYWJzKGNvc2luZSkgLSAwLjUpO1wiLCAvL2RvdWJsZSBzaWRlZCBzcGVjdWxhclxuXCIgICByZXR1cm4gdmVjNChkaWZmdXNlKmNvbG9yICsgMC45KnJpbUxpZ2h0aW5nKmNvbG9yICsgMC40KmNvbG9yMiAqIHNwZWN1bGFyLCByZ2JhLmEpO1wiLFxuXCJ9XCIsXG5cbi8vIFNtb290aCBIU1YgdG8gUkdCIGNvbnZlcnNpb24gZnJvbSBodHRwczovL3d3dy5zaGFkZXJ0b3kuY29tL3ZpZXcvTXNTM1djXG5cInZlYzMgaHN2MnJnYl9zbW9vdGgoIGluIHZlYzMgYyApe1wiLFxuXCIgICAgdmVjMyByZ2IgPSBjbGFtcCggYWJzKG1vZChjLngqNi4wK3ZlYzMoMC4wLDQuMCwyLjApLDYuMCktMy4wKS0xLjAsIDAuMCwgMS4wICk7XCIsXG5cIlx0cmdiID0gcmdiKnJnYiooMy4wLTIuMCpyZ2IpOyAvLyBjdWJpYyBzbW9vdGhpbmdcdFwiLFxuXCJcdHJldHVybiBjLnogKiBtaXgoIHZlYzMoMS4wKSwgcmdiLCBjLnkpO1wiLFxuXCJ9XCIsXG5cbi8vRnJvbSBTYW0gSG9jZXZhcjogaHR0cDovL2xvbGVuZ2luZS5uZXQvYmxvZy8yMDEzLzA3LzI3L3JnYi10by1oc3YtaW4tZ2xzbFxuXCJ2ZWMzIHJnYjJoc3YodmVjMyBjKXtcIixcblwiICAgIHZlYzQgSyA9IHZlYzQoMC4wLCAtMS4wIC8gMy4wLCAyLjAgLyAzLjAsIC0xLjApO1wiLFxuXCIgICAgdmVjNCBwID0gbWl4KHZlYzQoYy5iZywgSy53eiksIHZlYzQoYy5nYiwgSy54eSksIHN0ZXAoYy5iLCBjLmcpKTtcIixcblwiICAgIHZlYzQgcSA9IG1peCh2ZWM0KHAueHl3LCBjLnIpLCB2ZWM0KGMuciwgcC55engpLCBzdGVwKHAueCwgYy5yKSk7XCIsXG5cblwiICAgIGZsb2F0IGQgPSBxLnggLSBtaW4ocS53LCBxLnkpO1wiLFxuXCIgICAgZmxvYXQgZSA9IDEuMGUtMTA7XCIsXG5cIiAgICByZXR1cm4gdmVjMyhhYnMocS56ICsgKHEudyAtIHEueSkgLyAoNi4wICogZCArIGUpKSwgZCAvIChxLnggKyBlKSwgcS54KTtcIixcblwifVwiLFxuIC8vY2hvb3NlcyB0aGUgY29sb3IgZm9yIHRoZSBncmlkbGluZXMgYnkgdmFyeWluZyBsaWdodG5lc3MuIFxuLy9OT1QgY29udGludW91cyBvciBlbHNlIGJ5IHRoZSBpbnRlcm1lZGlhdGUgZnVuY3Rpb24gdGhlb3JlbSB0aGVyZSdkIGJlIGEgcG9pbnQgd2hlcmUgdGhlIGdyaWRsaW5lcyB3ZXJlIHRoZSBzYW1lIGNvbG9yIGFzIHRoZSBtYXRlcmlhbC5cblwidmVjMyBncmlkTGluZUNvbG9yKHZlYzMgY29sb3Ipe1wiLFxuXCIgdmVjMyBoc3YgPSByZ2IyaHN2KGNvbG9yLnh5eik7XCIsXG5cIiAvL2hzdi54ICs9IDAuMTtcIixcblwiIGlmKGhzdi56IDwgMC44KXtoc3YueiArPSAwLjI7fWVsc2V7aHN2LnogPSAwLjg1LTAuMSpoc3Yuejtoc3YueSAtPSAwLjA7fVwiLFxuXCIgcmV0dXJuIGhzdjJyZ2Jfc21vb3RoKGhzdik7XCIsXG5cIn1cIixcblxuXCJ2ZWM0IHJlbmRlckdyaWRsaW5lcyh2ZWM0IGV4aXN0aW5nQ29sb3IsIHZlYzIgdXYsIHZlYzQgc29saWRDb2xvcikge1wiLFxuXCIgIHZlYzIgZGlzdFRvRWRnZSA9IGFicyhtb2QodlV2Lnh5KmdyaWRTcXVhcmVzICsgbGluZVdpZHRoLzIuMCwxLjApKTtcIixcblwiICB2ZWMzIGNob3NlbkdyaWRMaW5lQ29sb3IgPSBtaXgoZ3JpZExpbmVDb2xvcihzb2xpZENvbG9yLnh5eiksIGdyaWRDb2xvciwgdXNlQ3VzdG9tR3JpZENvbG9yKTsgXCIsIC8vdXNlIGVpdGhlciBncmlkTGluZUNvbG9yKCkgb3Igb3ZlcnJpZGUgd2l0aCBjdXN0b20gZ3JpZFxuXCIgIHZlYzMgYmxlbmRlZEdyaWRMaW5lID0gc2hvd1NvbGlkICogY2hvc2VuR3JpZExpbmVDb2xvciArICgxLjAtc2hvd1NvbGlkKSpzb2xpZENvbG9yLnh5ejtcIiwgLy9pZiBzaG93U29saWQgPTAsIHVzZSBzb2xpZENvbG9yIGFzIHRoZSBncmlkbGluZSBjb2xvciwgb3RoZXJ3aXNlIHNoYWRlXG5cblwiICBpZiggZGlzdFRvRWRnZS54IDwgbGluZVdpZHRoIHx8IGRpc3RUb0VkZ2UueSA8IGxpbmVXaWR0aCl7XCIsXG5cIiAgICByZXR1cm4gbWl4KGV4aXN0aW5nQ29sb3IsIHZlYzQoYmxlbmRlZEdyaWRMaW5lLCAxLjApLHNob3dHcmlkKTtcIixcblwiICB9XCIsXG5cIiAgcmV0dXJuIGV4aXN0aW5nQ29sb3I7XCIsXG5cIn1cIixcbi8qXG5cInZlYzQgZ2V0U2hhZGVkQ29sb3JNYXRoYm94KHZlYzQgcmdiYSkgeyBcIixcblwiICB2ZWMzIGNvbG9yID0gcmdiYS54eXo7XCIsXG5cIiAgdmVjMyBjb2xvcjIgPSBvZmZTcGVjdWxhcihyZ2JhLnh5eik7XCIsXG5cblwiICB2ZWMzIG5vcm1hbCA9IG5vcm1hbGl6ZSh2Tm9ybWFsKTtcIixcblwiICB2ZWMzIGxpZ2h0ID0gbm9ybWFsaXplKHZMaWdodCk7XCIsXG5cIiAgdmVjMyBwb3NpdGlvbiA9IG5vcm1hbGl6ZSh2UG9zaXRpb24pO1wiLFxuXCIgIGZsb2F0IHNpZGUgICAgPSBnbF9Gcm9udEZhY2luZyA/IC0xLjAgOiAxLjA7XCIsXG5cIiAgZmxvYXQgY29zaW5lICA9IHNpZGUgKiBkb3Qobm9ybWFsLCBsaWdodCk7XCIsXG5cIiAgZmxvYXQgZGlmZnVzZSA9IG1peChtYXgoMC4wLCBjb3NpbmUpLCAuNSArIC41ICogY29zaW5lLCAuMSk7XCIsXG5cIiAgIHZlYzMgIGhhbGZMaWdodCA9IG5vcm1hbGl6ZShsaWdodCArIHBvc2l0aW9uKTtcIixcblwiXHRmbG9hdCBjb3NpbmVIYWxmID0gbWF4KDAuMCwgc2lkZSAqIGRvdChub3JtYWwsIGhhbGZMaWdodCkpO1wiLFxuXCJcdGZsb2F0IHNwZWN1bGFyID0gcG93KGNvc2luZUhhbGYsIDE2LjApO1wiLFxuXCJcdHJldHVybiB2ZWM0KGNvbG9yICogKGRpZmZ1c2UgKiAuOSArIC4wNSkgKjAuMCArICAuMjUgKiBjb2xvcjIgKiBzcGVjdWxhciwgcmdiYS5hKTtcIixcblwifVwiLCovXG5cblwidm9pZCBtYWluKCl7XCIsXG4vL1wiICAvL2dsX0ZyYWdDb2xvciA9IHZlYzQodk5vcm1hbC54eXosIDEuMCk7IC8vIHZpZXcgZGVidWcgbm9ybWFsc1wiLFxuLy9cIiAgLy9pZih2Tm9ybWFsLnggPCAwLjApe2dsX0ZyYWdDb2xvciA9IHZlYzQob2ZmU3BlY3VsYXIoY29sb3IucmdiKSwgMS4wKTt9ZWxzZXtnbF9GcmFnQ29sb3IgPSB2ZWM0KChjb2xvci5yZ2IpLCAxLjApO31cIiwgLy92aWV3IHNwZWN1bGFyIGFuZCBub24tc3BlY3VsYXIgY29sb3JzXG4vL1wiICBnbF9GcmFnQ29sb3IgPSB2ZWM0KG1vZCh2VXYueHksMS4wKSwwLjAsMS4wKTsgLy9zaG93IHV2c1xuXCIgIHZlYzQgc29saWRDb2xvciA9IHZlYzQoY29sb3IucmdiLCBzaG93U29saWQpO1wiLFxuXCIgIHZlYzQgc29saWRDb2xvck91dCA9IHNob3dTb2xpZCpnZXRTaGFkZWRDb2xvcihzb2xpZENvbG9yKTtcIixcblwiICB2ZWM0IGNvbG9yV2l0aEdyaWRsaW5lcyA9IHJlbmRlckdyaWRsaW5lcyhzb2xpZENvbG9yT3V0LCB2VXYueHksIHNvbGlkQ29sb3IpO1wiLFxuXCIgIGNvbG9yV2l0aEdyaWRsaW5lcy5hICo9IG9wYWNpdHk7XCIsXG5cIiAgZ2xfRnJhZ0NvbG9yID0gY29sb3JXaXRoR3JpZGxpbmVzO1wiLFx0XG5cIn1cIl0uam9pbihcIlxcblwiKVxuXG52YXIgdW5pZm9ybXMgPSB7XG5cdHRpbWU6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDAsXG5cdH0sXG5cdGNvbG9yOiB7XG5cdFx0dHlwZTogJ2MnLFxuXHRcdHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMHg1NWFhNTUpLFxuXHR9LFxuXHR1c2VDdXN0b21HcmlkQ29sb3I6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDAsXG5cdH0sXG5cdGdyaWRDb2xvcjoge1xuXHRcdHR5cGU6ICdjJyxcblx0XHR2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KSxcblx0fSxcblx0b3BhY2l0eToge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMC4xLFxuXHR9LFxuXHR2TGlnaHQ6IHsgLy9saWdodCBkaXJlY3Rpb25cblx0XHR0eXBlOiAndmVjMycsXG5cdFx0dmFsdWU6IFswLDAsMV0sXG5cdH0sXG5cdGdyaWRTcXVhcmVzOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiA0LFxuXHR9LFxuXHRsaW5lV2lkdGg6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDAuMSxcblx0fSxcblx0c2hvd0dyaWQ6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCxcblx0fSxcblx0c2hvd1NvbGlkOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAxLjAsXG5cdH1cbn07XG5cbmV4cG9ydCB7IHZTaGFkZXIsIGZTaGFkZXIsIHVuaWZvcm1zIH07XG4iLCJpbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuaW1wb3J0IHtMaW5lT3V0cHV0fSBmcm9tICcuL0xpbmVPdXRwdXQuanMnO1xuaW1wb3J0IHsgZ2V0VGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4uL1RocmVlRW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgdlNoYWRlciwgZlNoYWRlciwgdW5pZm9ybXMgfSBmcm9tICcuL1N1cmZhY2VPdXRwdXRTaGFkZXJzLmpzJztcblxuY2xhc3MgU3VyZmFjZU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKiBzaG91bGQgYmUgLmFkZCgpZWQgdG8gYSBUcmFuc2Zvcm1hdGlvbiB0byB3b3JrXG5cdFx0XHRvcHRpb25zOlxuXHRcdFx0e1xuXHRcdFx0XHRvcGFjaXR5OiBudW1iZXJcblx0XHRcdFx0Y29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKCkuIERpZmZ1c2UgY29sb3Igb2YgdGhpcyBzdXJmYWNlLlxuXHRcdFx0XHRncmlkQ29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKCkuIElmIHNob3dHcmlkIGlzIHRydWUsIGdyaWQgbGluZXMgd2lsbCBhcHBlYXIgb3ZlciB0aGlzIHN1cmZhY2UuIGdyaWRDb2xvciBkZXRlcm1pbmVzIHRoZWlyIGNvbG9yIFxuXHRcdFx0XHRzaG93R3JpZDogYm9vbGVhbi4gSWYgdHJ1ZSwgd2lsbCBkaXNwbGF5IGEgZ3JpZENvbG9yLWNvbG9yZWQgZ3JpZCBvdmVyIHRoZSBzdXJmYWNlLiBEZWZhdWx0OiB0cnVlXG5cdFx0XHRcdHNob3dTb2xpZDogYm9vbGVhbi4gSWYgdHJ1ZSwgd2lsbCBkaXNwbGF5IGEgc29saWQgc3VyZmFjZS4gRGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHRncmlkU3F1YXJlczogbnVtYmVyIHJlcHJlc2VudGluZyBob3cgbWFueSBzcXVhcmVzIHBlciBkaW1lbnNpb24gdG8gdXNlIGluIGEgcmVuZGVyZWQgZ3JpZFxuXHRcdFx0XHRncmlkTGluZVdpZHRoOiBudW1iZXIgcmVwcmVzZW50aW5nIGhvdyBtYW55IHNxdWFyZXMgcGVyIGRpbWVuc2lvbiB0byB1c2UgaW4gYSByZW5kZXJlZCBncmlkXG5cdFx0XHR9XG5cdFx0Ki9cblx0XHR0aGlzLl9vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm9wYWNpdHkgOiAxO1xuXG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBuZXcgVEhSRUUuQ29sb3Iob3B0aW9ucy5jb2xvcikgOiBuZXcgVEhSRUUuQ29sb3IoMHg1NWFhNTUpO1xuXG5cdFx0dGhpcy5fZ3JpZENvbG9yID0gb3B0aW9ucy5ncmlkQ29sb3I7XG4gICAgICAgIHRoaXMuX3VzZUN1c3RvbUdyaWRDb2xvciA9IG9wdGlvbnMuZ3JpZENvbG9yICE9PSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLl9ncmlkU3F1YXJlcyA9IG9wdGlvbnMuZ3JpZFNxdWFyZXMgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuZ3JpZFNxdWFyZXMgOiAxNjtcblx0XHR0aGlzLl9zaG93R3JpZCA9IG9wdGlvbnMuc2hvd0dyaWQgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuc2hvd0dyaWQgOiB0cnVlO1xuXHRcdHRoaXMuX3Nob3dTb2xpZCA9IG9wdGlvbnMuc2hvd1NvbGlkICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLnNob3dTb2xpZCA6IHRydWU7XG5cdFx0dGhpcy5fZ3JpZExpbmVXaWR0aCA9IG9wdGlvbnMuZ3JpZExpbmVXaWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5ncmlkTGluZVdpZHRoIDogMC4xNTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMudmVydGljZXMubGVuZ3RoXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBob3cgbWFueSB0aW1lcyB0byBiZSBjYWxsZWQgaW4gZWFjaCBkaXJlY3Rpb25cblx0XHR0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gMzsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT9cblxuXHRcdHRoaXMuaW5pdCgpO1xuXHR9XG5cdGluaXQoKXtcblx0XHR0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXHRcdHRoaXMuX3ZlcnRpY2VzO1xuXHRcdHRoaXMubWFrZUdlb21ldHJ5KCk7XG5cblx0XHQvL21ha2UgYSBkZWVwIGNvcHkgb2YgdGhlIHVuaWZvcm1zIHRlbXBsYXRlXG5cdFx0dGhpcy5fdW5pZm9ybXMgPSB7fTtcblx0XHRmb3IodmFyIHVuaWZvcm1OYW1lIGluIHVuaWZvcm1zKXtcblx0XHRcdHRoaXMuX3VuaWZvcm1zW3VuaWZvcm1OYW1lXSA9IHtcblx0XHRcdFx0dHlwZTogdW5pZm9ybXNbdW5pZm9ybU5hbWVdLnR5cGUsXG5cdFx0XHRcdHZhbHVlOiB1bmlmb3Jtc1t1bmlmb3JtTmFtZV0udmFsdWVcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLlNoYWRlck1hdGVyaWFsKHtcblx0XHRcdHNpZGU6IFRIUkVFLkJhY2tTaWRlLFxuXHRcdFx0dmVydGV4U2hhZGVyOiB2U2hhZGVyLCBcblx0XHRcdGZyYWdtZW50U2hhZGVyOiBmU2hhZGVyLFxuXHRcdFx0dW5pZm9ybXM6IHRoaXMuX3VuaWZvcm1zLFxuXHRcdFx0fSk7XG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cblx0XHR0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvLyBzZXR0ZXIgc2V0cyB0cmFuc3BhcmVudCBmbGFnIGlmIG5lY2Vzc2FyeVxuXHRcdHRoaXMuY29sb3IgPSB0aGlzLl9jb2xvcjsgLy9zZXR0ZXIgc2V0cyBjb2xvciB1bmlmb3JtXG5cdFx0dGhpcy5fdW5pZm9ybXMub3BhY2l0eS52YWx1ZSA9IHRoaXMuX29wYWNpdHk7XG5cdFx0dGhpcy5fdW5pZm9ybXMuZ3JpZFNxdWFyZXMudmFsdWUgPSB0aGlzLl9ncmlkU3F1YXJlcztcblx0XHR0aGlzLl91bmlmb3Jtcy5zaG93R3JpZC52YWx1ZSA9IHRoaXMudG9OdW0odGhpcy5fc2hvd0dyaWQpO1xuXHRcdHRoaXMuX3VuaWZvcm1zLnNob3dTb2xpZC52YWx1ZSA9IHRoaXMudG9OdW0odGhpcy5fc2hvd1NvbGlkKTtcblx0XHR0aGlzLl91bmlmb3Jtcy5saW5lV2lkdGgudmFsdWUgPSB0aGlzLl9ncmlkTGluZVdpZHRoO1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy51c2VDdXN0b21HcmlkQ29sb3IudmFsdWUgPSB0aGlzLl91c2VDdXN0b21HcmlkQ29sb3IgPyAxLjAgOiAwLjA7XG4gICAgICAgIGlmKHRoaXMuX3VzZUN1c3RvbUdyaWRDb2xvcil7XG5cdFx0ICAgIHRoaXMuX3VuaWZvcm1zLmdyaWRDb2xvci52YWx1ZSA9IG5ldyBUSFJFRS5Db2xvcih0aGlzLl9ncmlkQ29sb3IpO1xuICAgICAgICB9XG5cblx0XHRpZighdGhpcy5zaG93U29saWQpdGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IHRydWU7XG5cblx0XHRnZXRUaHJlZUVudmlyb25tZW50KCkuc2NlbmUuYWRkKHRoaXMubWVzaCk7XG5cdH1cbiAgICB0b051bSh4KXtcbiAgICAgICAgaWYoeCA9PSBmYWxzZSlyZXR1cm4gMDtcbiAgICAgICAgaWYoeCA9PSB0cnVlKXJldHVybiAxO1xuICAgICAgICByZXR1cm4geDtcbiAgICB9XG5cdG1ha2VHZW9tZXRyeSgpe1xuXG5cdFx0bGV0IE1BWF9QT0lOVFMgPSAxMDAwMDtcblxuXHRcdHRoaXMuX3ZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheShNQVhfUE9JTlRTICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cdFx0dGhpcy5fbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDMpO1xuXHRcdHRoaXMuX3V2cyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDIpO1xuXG5cdFx0Ly8gYnVpbGQgZ2VvbWV0cnlcblxuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdub3JtYWwnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fbm9ybWFscywgMyApICk7XG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAndXYnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fdXZzLCAyICkgKTtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy91c2VkIGR1cmluZyB1cGRhdGVzIGFzIGEgcG9pbnRlciB0byB0aGUgYnVmZmVyXG5cblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cblx0fVxuXHRfc2V0VVZzKHV2cywgaW5kZXgsIHUsIHYpe1xuXG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG4gICAgICAgIC8vc2V0dXAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gYW5kIHRoaXMuaXRlbURpbWVuc2lvbnMuIHVzZWQgaGVyZSBhZ2FpbiBiZWNhdXNlIGNsb25pbmcgbWVhbnMgdGhlIG9uQWRkKCkgbWlnaHQgYmUgY2FsbGVkIGJlZm9yZSB0aGlzIGlzIGNvbm5lY3RlZCB0byBhIHR5cGUgb2YgZG9tYWluXG5cblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgRG9tYWluTm9kZSB3ZSdyZSByZW5kZXJpbmcgZnJvbVxuXHRcdGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcblxuXHRcdC8vIHBlcmhhcHMgaW5zdGVhZCBvZiBnZW5lcmF0aW5nIGEgd2hvbGUgbmV3IGFycmF5LCB0aGlzIGNhbiByZXVzZSB0aGUgb2xkIG9uZT9cblx0XHRsZXQgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cdFx0bGV0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogMyk7XG5cdFx0bGV0IHV2cyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiAyKTtcblxuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0dGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl92ZXJ0aWNlcyk7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBub3JtYWxzO1xuXHRcdG5vcm1hbEF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9ub3JtYWxzKTtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IHV2QXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy51djtcblxuXG5cdFx0Ly9hc3NlcnQgdGhpcy5pdGVtRGltZW5zaW9uc1swXSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0gPSB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiBhbmQgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9PSAyXG5cdFx0dmFyIGluZGljZXMgPSBbXTtcblxuXHRcdC8vcmVuZGVyZWQgdHJpYW5nbGUgaW5kaWNlc1xuXHRcdC8vZnJvbSB0aHJlZS5qcyBQbGFuZUdlb21ldHJ5LmpzXG5cdFx0bGV0IGJhc2UgPSAwO1xuXHRcdGxldCBpPTAsIGo9MDtcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXS0xO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xO2krKyl7XG5cblx0XHRcdFx0bGV0IGEgPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBiID0gaSArIChqKzEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGMgPSAoaSsxKSsgKGorMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRsZXQgZCA9IChpKzEpKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblxuICAgICAgICBcdFx0aW5kaWNlcy5wdXNoKGEsIGIsIGQpO1xuXHRcdFx0XHRpbmRpY2VzLnB1c2goYiwgYywgZCk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2RvdWJsZSBzaWRlZCByZXZlcnNlIGZhY2VzXG4gICAgICAgIFx0XHRpbmRpY2VzLnB1c2goZCwgYiwgYSk7XG5cdFx0XHRcdGluZGljZXMucHVzaChkLCBjLCBiKTtcblxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vbm9ybWFscyAod2lsbCBiZSBvdmVyd3JpdHRlbiBsYXRlcikgYW5kIHV2c1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtpKyspe1xuXG5cdFx0XHRcdGxldCBwb2ludEluZGV4ID0gaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHQvL3NldCBub3JtYWwgdG8gWzAsMCwxXSBhcyBhIHRlbXBvcmFyeSB2YWx1ZVxuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozXSA9IDA7XG5cdFx0XHRcdG5vcm1hbHNbKHBvaW50SW5kZXgpKjMrMV0gPSAwO1xuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozKzJdID0gMTtcblxuXHRcdFx0XHQvL3V2c1xuXHRcdFx0XHR1dnNbKHBvaW50SW5kZXgpKjJdID0gai8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKTtcblx0XHRcdFx0dXZzWyhwb2ludEluZGV4KSoyKzFdID0gaS8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl91dnMgPSB1dnM7XG5cdFx0dXZBdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdXZzKTtcblx0XHR1dkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHR0aGlzLl9nZW9tZXRyeS5zZXRJbmRleCggaW5kaWNlcyApO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHRpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7XHRcblx0XHR9XG5cblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cblx0XHQvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuXHRcdGxldCBpbmRleCA9IHRoaXMuX2N1cnJlbnRQb2ludEluZGV4KnRoaXMuX291dHB1dERpbWVuc2lvbnM7XG5cblx0ICAgIHRoaXMuX3ZlcnRpY2VzW2luZGV4XSAgID0geCA9PT0gdW5kZWZpbmVkID8gMCA6IHg7XG5cdFx0dGhpcy5fdmVydGljZXNbaW5kZXgrMV0gPSB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcblx0XHR0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXSA9IHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fcmVjYWxjTm9ybWFscygpO1xuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3Jlc2V0IGFmdGVyIGVhY2ggdXBkYXRlXG4gICAgICAgIGlmKHRoaXMub3BhY2l0eSA8IDEgJiYgdGhpcy5vcGFjaXR5ID4gMCl7XG4gICAgICAgICAgICB0aGlzLnNvcnRGYWNlc0J5RGVwdGgoKTtcbiAgICAgICAgfVxuXHR9XG4gICAgc29ydEZhY2VzQnlEZXB0aCgpe1xuICAgICAgICAvL2lmIHRoaXMgc3VyZmFjZSBpcyB0cmFuc3BhcmVudCwgZm9yIHByb3BlciBmYWNlIHJlbmRlcmluZyB3ZSBzaG91bGQgc29ydCB0aGUgZmFjZXMgc28gdGhhdCB0aGV5J3JlIGRyYXduIGZyb20gYmFjayB0byBmcm9udFxuICAgICAgICBsZXQgaW5kZXhBcnJheSA9IHRoaXMuX2dlb21ldHJ5LmluZGV4LmFycmF5O1xuICAgICAgICBsZXQgcG9zaXRpb25BcnJheSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb24uYXJyYXk7XG5cbiAgICAgICAgbGV0IG51bUZhY2VzID0gdGhpcy5fZ2VvbWV0cnkuaW5kZXguYXJyYXkubGVuZ3RoLzM7XG5cbiAgICAgICAgbGV0IGRpc3RhbmNlc0ZvckVhY2hGYWNlVG9DYW1lcmEgPSBuZXcgRmxvYXQzMkFycmF5KG51bUZhY2VzKTtcbiAgICAgICAgbGV0IGNhbWVyYVBvcyA9IGdldFRocmVlRW52aXJvbm1lbnQoKS5jYW1lcmEucG9zaXRpb247XG5cbiAgICAgICAgZm9yKGxldCBmYWNlTm89MDtmYWNlTm88bnVtRmFjZXM7ZmFjZU5vKyspe1xuICAgICAgICAgICAgLy8gdGhlIGluZGV4IGFycmF5IHN0b3JlcyB0aGUgaW5kaWNlcyBvZiB0aGUgMyB2ZXJ0aWNlcyB3aGljaCBtYWtlIGEgdHJpYW5nbGUsIGluIG9yZGVyXG5cdFx0XHRsZXQgdmVydDFJbmRleCA9IGluZGV4QXJyYXlbMypmYWNlTm9dO1xuICAgICAgICAgICAgbGV0IHZlcnQySW5kZXggPSBpbmRleEFycmF5WzMqZmFjZU5vKzFdO1xuICAgICAgICAgICAgbGV0IHZlcnQzSW5kZXggPSBpbmRleEFycmF5WzMqZmFjZU5vKzJdO1xuXG4gICAgICAgICAgICBsZXQgY2VudHJvaWRYID0gKHBvc2l0aW9uQXJyYXlbMyp2ZXJ0MUluZGV4XSArcG9zaXRpb25BcnJheVszKnZlcnQySW5kZXhdICArcG9zaXRpb25BcnJheVszKnZlcnQzSW5kZXhdKS8zO1xuXHRcdCAgICBsZXQgY2VudHJvaWRZID0gKHBvc2l0aW9uQXJyYXlbMyp2ZXJ0MUluZGV4KzFdK3Bvc2l0aW9uQXJyYXlbMyp2ZXJ0MkluZGV4KzFdK3Bvc2l0aW9uQXJyYXlbMyp2ZXJ0M0luZGV4KzFdKS8zOyAvL1lcblx0XHRcdGxldCBjZW50cm9pZFogPSAocG9zaXRpb25BcnJheVszKnZlcnQxSW5kZXgrMl0rcG9zaXRpb25BcnJheVszKnZlcnQySW5kZXgrMl0rcG9zaXRpb25BcnJheVszKnZlcnQzSW5kZXgrMl0pLzM7XG5cbiAgICAgICAgICAgIC8vY29tcHV0ZSBkaXN0YW5jZSBmcm9tIGNlbnRyb2lkIHRvIGNhbWVyYVxuICAgICAgICAgICAgbGV0IGR4ID0gY2VudHJvaWRYIC0gY2FtZXJhUG9zLng7XG4gICAgICAgICAgICBsZXQgZHkgPSBjZW50cm9pZFkgLSBjYW1lcmFQb3MueTtcbiAgICAgICAgICAgIGxldCBkeiA9IGNlbnRyb2lkWiAtIGNhbWVyYVBvcy56O1xuICAgICAgICAgICAgZGlzdGFuY2VzRm9yRWFjaEZhY2VUb0NhbWVyYVtmYWNlTm9dID0gTWF0aC5zcXJ0KGR4KmR4ICsgZHkqZHkgKyBkeipkeik7XG4gICAgICAgIH1cblxuICAgICAgICAvL3J1biBpbnNlcnRpb24gc29ydCBvbiBkaXN0YW5jZXNGb3JFYWNoRmFjZVRvQ2FtZXJhLiBldmVyeSB0aW1lIHlvdSBtb3ZlIGEgcGllY2UgdGhlcmUsIG1vdmUgdGhlIHRoaW5ncyBpbiBpbmRleEFycmF5IHRvb1xuICAgICAgICBmb3IobGV0IGk9MTtpPG51bUZhY2VzO2krKyl7XG4gICAgICAgICAgICBsZXQgaiA9IGk7XG4gICAgICAgICAgICB3aGlsZShqID4gMCAmJiBkaXN0YW5jZXNGb3JFYWNoRmFjZVRvQ2FtZXJhW2otMV0gPCBkaXN0YW5jZXNGb3JFYWNoRmFjZVRvQ2FtZXJhW2pdKXtcbiAgICAgICAgICAgICAgICAvL3N3YXAgZGlzdGFuY2VzRm9yRWFjaEZhY2VUb0NhbWVyYVtqXSBhbmQgZGlzdGFuY2VzRm9yRWFjaEZhY2VUb0NhbWVyYVtqLTFdXG4gICAgICAgICAgICAgICAgbGV0IHRlbXAgPSBkaXN0YW5jZXNGb3JFYWNoRmFjZVRvQ2FtZXJhW2pdO1xuICAgICAgICAgICAgICAgIGRpc3RhbmNlc0ZvckVhY2hGYWNlVG9DYW1lcmFbal0gPSBkaXN0YW5jZXNGb3JFYWNoRmFjZVRvQ2FtZXJhW2otMV07XG4gICAgICAgICAgICAgICAgZGlzdGFuY2VzRm9yRWFjaEZhY2VUb0NhbWVyYVtqLTFdID0gdGVtcDtcblxuICAgICAgICAgICAgICAgIC8vYWxzbyBzd2FwIHRoZSBpbmRpY2VzIGZvciBmYWNlICNqIGFuZCBmYWNlICNqLTEsIHNvIHRoaXMgc29ydCB1c2VzIGRpc3RhbmNlc0ZvckVhY2hGYWNlVG9DYW1lcmEgYXMgdGhlIGtleVxuICAgICAgICAgICAgICAgIGxldCB2ZXJ0MUluZGV4ID0gaW5kZXhBcnJheVszKmpdO1xuICAgICAgICAgICAgICAgIGxldCB2ZXJ0MkluZGV4ID0gaW5kZXhBcnJheVszKmorMV07XG4gICAgICAgICAgICAgICAgbGV0IHZlcnQzSW5kZXggPSBpbmRleEFycmF5WzMqaisyXTtcblxuICAgICAgICAgICAgICAgIGluZGV4QXJyYXlbMypqXSA9IGluZGV4QXJyYXlbMyooai0xKV07XG4gICAgICAgICAgICAgICAgaW5kZXhBcnJheVszKmorMV0gPSBpbmRleEFycmF5WzMqKGotMSkrMV07XG4gICAgICAgICAgICAgICAgaW5kZXhBcnJheVszKmorMl0gPSBpbmRleEFycmF5WzMqKGotMSkrMl07XG5cbiAgICAgICAgICAgICAgICBpbmRleEFycmF5WzMqKGotMSldID0gdmVydDFJbmRleDtcbiAgICAgICAgICAgICAgICBpbmRleEFycmF5WzMqKGotMSkrMV0gPSB2ZXJ0MkluZGV4O1xuICAgICAgICAgICAgICAgIGluZGV4QXJyYXlbMyooai0xKSsyXSA9IHZlcnQzSW5kZXg7XG4gICAgICAgICAgICAgICAgai0tO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vbm93IGluZGV4QXJyYXkgaXMgc29ydGVkIGFjY29yZGluZyB0byB0aGUgZGlzdGFuY2UgdG8gdGhlIGNhbWVyYVxuICAgICAgICB0aGlzLl9nZW9tZXRyeS5pbmRleC5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgfVxuXHRfcmVjYWxjTm9ybWFscygpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdC8vcmVuZGVyZWQgdHJpYW5nbGUgaW5kaWNlc1xuXHRcdC8vZnJvbSB0aHJlZS5qcyBQbGFuZUdlb21ldHJ5LmpzXG5cdFx0bGV0IG5vcm1hbFZlYyA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0bGV0IHBhcnRpYWxYID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XHRsZXQgcGFydGlhbFkgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG5cdFx0bGV0IGJhc2UgPSAwO1xuXHRcdGxldCBuZWdhdGlvbkZhY3RvciA9IDE7XG5cdFx0bGV0IGk9MCwgaj0wO1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtpKyspe1xuXG5cdFx0XHRcdC8vY3VycmVudGx5IGRvaW5nIHRoZSBub3JtYWwgZm9yIHRoZSBwb2ludCBhdCBpbmRleCBhLlxuXHRcdFx0XHRsZXQgYSA9IGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGIsYztcblxuXHRcdFx0XHQvL1RhbmdlbnRzIGFyZSBjYWxjdWxhdGVkIHdpdGggZmluaXRlIGRpZmZlcmVuY2VzIC0gRm9yICh4LHkpLCBjb21wdXRlIHRoZSBwYXJ0aWFsIGRlcml2YXRpdmVzIHVzaW5nICh4KzEseSkgYW5kICh4LHkrMSkgYW5kIGNyb3NzIHRoZW0uIEJ1dCBpZiB5b3UncmUgYXQgdGhlYm9yZGVyLCB4KzEgYW5kIHkrMSBtaWdodCBub3QgZXhpc3QuIFNvIGluIHRoYXQgY2FzZSB3ZSBnbyBiYWNrd2FyZHMgYW5kIHVzZSAoeC0xLHkpIGFuZCAoeCx5LTEpIGluc3RlYWQuXG5cdFx0XHRcdC8vV2hlbiB0aGF0IGhhcHBlbnMsIHRoZSB2ZWN0b3Igc3VidHJhY3Rpb24gd2lsbCBzdWJ0cmFjdCB0aGUgd3Jvbmcgd2F5LCBpbnRyb2R1Y2luZyBhIGZhY3RvciBvZiAtMSBpbnRvIHRoZSBjcm9zcyBwcm9kdWN0IHRlcm0uIFNvIG5lZ2F0aW9uRmFjdG9yIGtlZXBzIHRyYWNrIG9mIHdoZW4gdGhhdCBoYXBwZW5zIGFuZCBpcyBtdWx0aXBsaWVkIGFnYWluIHRvIGNhbmNlbCBpdCBvdXQuXG5cdFx0XHRcdG5lZ2F0aW9uRmFjdG9yID0gMTsgXG5cblx0XHRcdFx0Ly9iIGlzIHRoZSBpbmRleCBvZiB0aGUgcG9pbnQgMSBhd2F5IGluIHRoZSB5IGRpcmVjdGlvblxuXHRcdFx0XHRpZihpIDwgdGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKXtcblx0XHRcdFx0XHRiID0gKGkrMSkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0fWVsc2V7XG5cdFx0XHRcdFx0Ly9lbmQgb2YgdGhlIHkgYXhpcywgZ28gYmFja3dhcmRzIGZvciB0YW5nZW50c1xuXHRcdFx0XHRcdGIgPSAoaS0xKSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRcdG5lZ2F0aW9uRmFjdG9yICo9IC0xO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9jIGlzIHRoZSBpbmRleCBvZiB0aGUgcG9pbnQgMSBhd2F5IGluIHRoZSB4IGRpcmVjdGlvblxuXHRcdFx0XHRpZihqIDwgdGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKXtcblx0XHRcdFx0XHRjID0gaSArIChqKzEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0fWVsc2V7XG5cdFx0XHRcdFx0Ly9lbmQgb2YgdGhlIHggYXhpcywgZ28gYmFja3dhcmRzIGZvciB0YW5nZW50c1xuXHRcdFx0XHRcdGMgPSBpICsgKGotMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRcdG5lZ2F0aW9uRmFjdG9yICo9IC0xO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly90aGUgdmVjdG9yIGItYS4gXG5cdFx0XHRcdC8vdGhpcy5fdmVydGljZXMgc3RvcmVzIHRoZSBjb21wb25lbnRzIG9mIGVhY2ggdmVjdG9yIGluIG9uZSBiaWcgZmxvYXQzMmFycmF5LCBzbyB0aGlzIHB1bGxzIHRoZW0gb3V0IGFuZCBqdXN0IGRvZXMgdGhlIHN1YnRyYWN0aW9uIG51bWVyaWNhbGx5LiBUaGUgY29tcG9uZW50cyBvZiB2ZWN0b3IgIzUyIGFyZSB4OjUyKjMrMCx5OjUyKjMrMSx6OjUyKjMrMiwgZm9yIGV4YW1wbGUuXG5cdFx0XHRcdHBhcnRpYWxZLnNldCh0aGlzLl92ZXJ0aWNlc1tiKjNdLXRoaXMuX3ZlcnRpY2VzW2EqM10sdGhpcy5fdmVydGljZXNbYiozKzFdLXRoaXMuX3ZlcnRpY2VzW2EqMysxXSx0aGlzLl92ZXJ0aWNlc1tiKjMrMl0tdGhpcy5fdmVydGljZXNbYSozKzJdKTtcblx0XHRcdFx0Ly90aGUgdmVjdG9yIGMtYS5cblx0XHRcdFx0cGFydGlhbFguc2V0KHRoaXMuX3ZlcnRpY2VzW2MqM10tdGhpcy5fdmVydGljZXNbYSozXSx0aGlzLl92ZXJ0aWNlc1tjKjMrMV0tdGhpcy5fdmVydGljZXNbYSozKzFdLHRoaXMuX3ZlcnRpY2VzW2MqMysyXS10aGlzLl92ZXJ0aWNlc1thKjMrMl0pO1xuXG5cdFx0XHRcdC8vYi1hIGNyb3NzIGMtYVxuXHRcdFx0XHRub3JtYWxWZWMuY3Jvc3NWZWN0b3JzKHBhcnRpYWxYLHBhcnRpYWxZKS5ub3JtYWxpemUoKTtcblx0XHRcdFx0bm9ybWFsVmVjLm11bHRpcGx5U2NhbGFyKG5lZ2F0aW9uRmFjdG9yKTtcblx0XHRcdFx0Ly9zZXQgbm9ybWFsXG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqM10gPSBub3JtYWxWZWMueDtcblx0XHRcdFx0dGhpcy5fbm9ybWFsc1soaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdKSozKzFdID0gbm9ybWFsVmVjLnk7XG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqMysyXSA9IG5vcm1hbFZlYy56O1xuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBkb24ndCBmb3JnZXQgdG8gbm9ybWFsQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZSBhZnRlciBjYWxsaW5nIHRoaXMhXG5cdH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG4gICAgICAgIHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG4gICAgfVxuXHRzZXQgY29sb3IoY29sb3Ipe1xuXHRcdC8vY3VycmVudGx5IG9ubHkgYSBzaW5nbGUgY29sb3IgaXMgc3VwcG9ydGVkLlxuXHRcdC8vSSBzaG91bGQgcmVhbGx5IG1ha2UgdGhpcyBhIGZ1bmN0aW9uXG5cdFx0dGhpcy5fY29sb3IgPSBjb2xvcjtcblx0XHR0aGlzLl91bmlmb3Jtcy5jb2xvci52YWx1ZSA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG5cdH1cblx0Z2V0IGNvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbG9yO1xuXHR9XG5cdHNldCBncmlkQ29sb3IoY29sb3Ipe1xuXHRcdC8vY3VycmVudGx5IG9ubHkgYSBzaW5nbGUgY29sb3IgaXMgc3VwcG9ydGVkLlxuXHRcdC8vSSBzaG91bGQgcmVhbGx5IG1ha2UgdGhpcyBhIGZ1bmN0aW9uXG5cdFx0dGhpcy5fZ3JpZENvbG9yID0gY29sb3I7XG5cdFx0dGhpcy5fdW5pZm9ybXMuZ3JpZENvbG9yLnZhbHVlID0gbmV3IFRIUkVFLkNvbG9yKGNvbG9yKTtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMudXNlQ3VzdG9tR3JpZENvbG9yLnZhbHVlID0gMS4wO1xuXHR9XG5cdGdldCBncmlkQ29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fZ3JpZENvbG9yO1xuXHR9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdHRoaXMubWF0ZXJpYWwub3BhY2l0eSA9IG9wYWNpdHk7XG5cdFx0dGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IChvcGFjaXR5IDwgMSkgfHwgKCF0aGlzLl9zaG93U29saWQpO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmRlcHRoV3JpdGUgPSAhdGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudDsgLy8gb25seSBkZXB0aFdyaXRlIGlmIG5vdCB0cmFuc3BhcmVudCwgc28gdGhhdCB0aGluZ3Mgc2hvdyB1cCBiZWhpbmQgdGhpc1xuXG5cdFx0dGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLm9wYWNpdHkudmFsdWUgPSBvcGFjaXR5O1xuXHR9XG5cdGdldCBvcGFjaXR5KCl7XG5cdFx0cmV0dXJuIHRoaXMuX29wYWNpdHk7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IFN1cmZhY2VPdXRwdXQoe2NvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG5leHBvcnQge1N1cmZhY2VPdXRwdXR9O1xuIiwiaW1wb3J0IHtPdXRwdXROb2RlfSBmcm9tICcuLi9Ob2RlLmpzJztcblxuY2xhc3MgRmxhdEFycmF5T3V0cHV0IGV4dGVuZHMgT3V0cHV0Tm9kZXtcbiAgICAvL2FuIG91dHB1dCB3aGljaCBmaWxscyBhbiBhcnJheSB3aXRoIGV2ZXJ5IGNvb3JkaW5hdGUgcmVjaWV2ZWQsIGluIG9yZGVyLlxuICAgIC8vSXQnbGwgcmVnaXN0ZXIgWzAsMSwyXSxbMyw0LDVdIGFzIFswLDEsMiwzLDQsNV0uXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKlxuXHRcdFx0YXJyYXk6IGFuIGV4aXN0aW5nIGFycmF5LCB3aGljaCB3aWxsIHRoZW4gYmUgbW9kaWZpZWQgaW4gcGxhY2UgZXZlcnkgdGltZSB0aGlzIG91dHB1dCBpcyBhY3RpdmF0ZWRcblx0XHQqL1xuXG5cdFx0dGhpcy5hcnJheSA9IG9wdGlvbnMuYXJyYXk7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRBcnJheUluZGV4ID0gMDtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgLi4uY29vcmRzKXtcbiAgICAgICAgZm9yKHZhciBqPTA7ajxjb29yZHMubGVuZ3RoO2orKyl7IFxuICAgICAgICAgICAgLy9JIGRvbid0IG5lZWQgdG8gd29ycnkgYWJvdXQgb3V0LW9mLWJvdW5kcyBlbnRyaWVzIGJlY2F1c2UgamF2YXNjcmlwdCBhdXRvbWF0aWNhbGx5IGdyb3dzIGFycmF5cyBpZiBhIG5ldyBpbmRleCBpcyBzZXQuXG4gICAgICAgICAgICAvL0phdmFzY3JpcHQgbWF5IGhhdmUgc29tZSBnYXJiYWdlIGRlc2lnbiBjaG9pY2VzLCBidXQgSSdsbCBjbGFpbSB0aGF0IGdhcmJhZ2UgZm9yIG15IG93biBuZWZhcmlvdXMgYWR2YW50YWdlLlxuICAgICAgICAgICAgdGhpcy5hcnJheVt0aGlzLl9jdXJyZW50QXJyYXlJbmRleF0gPSBjb29yZHNbal1cbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRBcnJheUluZGV4Kys7XG4gICAgICAgIH1cblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuICAgICAgICB0aGlzLl9jdXJyZW50QXJyYXlJbmRleCA9IDA7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IEZsYXRBcnJheU91dHB1dCh7YXJyYXk6IEVYUC5NYXRoLmNsb25lKHRoaXMuYXJyYXkpfSk7XG5cdH1cbn1cblxuZXhwb3J0IHtGbGF0QXJyYXlPdXRwdXR9O1xuIiwidmFyIGV4cGxhbmFyaWFuQXJyb3dTVkcgPSBcImRhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEQ5NGJXd2dkbVZ5YzJsdmJqMGlNUzR3SWlCbGJtTnZaR2x1WnowaVZWUkdMVGdpSUhOMFlXNWtZV3h2Ym1VOUltNXZJajgrQ2p3aExTMGdRM0psWVhSbFpDQjNhWFJvSUVsdWEzTmpZWEJsSUNob2RIUndPaTh2ZDNkM0xtbHVhM05qWVhCbExtOXlaeThwSUMwdFBnb0tQSE4yWndvZ0lDQjRiV3h1Y3pwa1l6MGlhSFIwY0RvdkwzQjFjbXd1YjNKbkwyUmpMMlZzWlcxbGJuUnpMekV1TVM4aUNpQWdJSGh0Ykc1ek9tTmpQU0pvZEhSd09pOHZZM0psWVhScGRtVmpiMjF0YjI1ekxtOXlaeTl1Y3lNaUNpQWdJSGh0Ykc1ek9uSmtaajBpYUhSMGNEb3ZMM2QzZHk1M015NXZjbWN2TVRrNU9TOHdNaTh5TWkxeVpHWXRjM2x1ZEdGNExXNXpJeUlLSUNBZ2VHMXNibk02YzNablBTSm9kSFJ3T2k4dmQzZDNMbmN6TG05eVp5OHlNREF3TDNOMlp5SUtJQ0FnZUcxc2JuTTlJbWgwZEhBNkx5OTNkM2N1ZHpNdWIzSm5Mekl3TURBdmMzWm5JZ29nSUNCNGJXeHVjenA0YkdsdWF6MGlhSFIwY0RvdkwzZDNkeTUzTXk1dmNtY3ZNVGs1T1M5NGJHbHVheUlLSUNBZ2VHMXNibk02YzI5a2FYQnZaR2s5SW1oMGRIQTZMeTl6YjJScGNHOWthUzV6YjNWeVkyVm1iM0puWlM1dVpYUXZSRlJFTDNOdlpHbHdiMlJwTFRBdVpIUmtJZ29nSUNCNGJXeHVjenBwYm10elkyRndaVDBpYUhSMGNEb3ZMM2QzZHk1cGJtdHpZMkZ3WlM1dmNtY3ZibUZ0WlhOd1lXTmxjeTlwYm10elkyRndaU0lLSUNBZ2QybGtkR2c5SWpJd01DSUtJQ0FnYUdWcFoyaDBQU0l4TXpBaUNpQWdJSFpwWlhkQ2IzZzlJakFnTUNBeU1EQWdNVE13SWdvZ0lDQnBaRDBpYzNabk1pSUtJQ0FnZG1WeWMybHZiajBpTVM0eElnb2dJQ0JwYm10elkyRndaVHAyWlhKemFXOXVQU0l3TGpreElISXhNemN5TlNJS0lDQWdjMjlrYVhCdlpHazZaRzlqYm1GdFpUMGlSWGh3YkdGdVlYSnBZVzVPWlhoMFFYSnliM2N1YzNabklqNEtJQ0E4WkdWbWN6NEtQSEpoWkdsaGJFZHlZV1JwWlc1MElHbGtQU0poSWlCamVEMGlOVEF3SWlCamVUMGlOakkzTGpjeElpQnlQU0l5TkRJdU16VWlJR2R5WVdScFpXNTBWSEpoYm5ObWIzSnRQU0p0WVhSeWFYZ29NQ0F1TWprM01ESWdMVE11T0RNNU1TQXRNUzR4T1RNeFpTMDRJREkwTURndU1TQTRNemd1T0RVcElpQm5jbUZrYVdWdWRGVnVhWFJ6UFNKMWMyVnlVM0JoWTJWUGJsVnpaU0krQ2p4emRHOXdJSE4wYjNBdFkyOXNiM0k5SWlOaVl6Y3pNVGtpSUc5bVpuTmxkRDBpTUNJdlBnbzhjM1J2Y0NCemRHOXdMV052Ykc5eVBTSWpaakJrTWpZeklpQnZabVp6WlhROUlqRWlMejRLUEM5eVlXUnBZV3hIY21Ga2FXVnVkRDRLUEM5a1pXWnpQZ284YldWMFlXUmhkR0UrQ2p4eVpHWTZVa1JHUGdvOFkyTTZWMjl5YXlCeVpHWTZZV0p2ZFhROUlpSStDanhrWXpwbWIzSnRZWFErYVcxaFoyVXZjM1puSzNodGJEd3ZaR002Wm05eWJXRjBQZ284WkdNNmRIbHdaU0J5WkdZNmNtVnpiM1Z5WTJVOUltaDBkSEE2THk5d2RYSnNMbTl5Wnk5a1l5OWtZMjFwZEhsd1pTOVRkR2xzYkVsdFlXZGxJaTgrQ2p4a1l6cDBhWFJzWlM4K0Nqd3ZZMk02VjI5eWF6NEtQQzl5WkdZNlVrUkdQZ284TDIxbGRHRmtZWFJoUGdvOFp5QjBjbUZ1YzJadmNtMDlJblJ5WVc1emJHRjBaU2d3SUMwNU1qSXVNellwSWo0S1BIQmhkR2dnWkQwaWJURTVOeTQwTnlBNU9EY3VNelpqTUMweU5DNHlPREV0T0RjdU1qWXhMVFl4TGpjd09DMDROeTR5TmpFdE5qRXVOekE0ZGpJNUxqWTVOR3d0TVRNdU5UWXpJREF1TXpjNU5HTXRNVE11TlRZeklEQXVNemM1TXprdE5qSXVNakF5SURJdU9ESTNNUzAzTkM0NE1URWdOeTQ1TmpVM0xURXlMall3T1NBMUxqRXpPRFl0TVRrdU16QXhJREUwTGpZNU5TMHhPUzR6TURFZ01qTXVOalk1SURBZ09DNDVOek00SURNdU9UY3pOU0F4T0M0eE5qTWdNVGt1TXpBeElESXpMalkyT1NBeE5TNHpNamNnTlM0MU1EVTFJRFl4TGpJME9DQTNMalU0TmpNZ056UXVPREV4SURjdU9UWTFOMnd4TXk0MU5qTWdNQzR6TnprMGRqSTVMalk1TkhNNE55NHlOakV0TXpjdU5ESTRJRGczTGpJMk1TMDJNUzQzTURoNklpQm1hV3hzUFNKMWNtd29JMkVwSWlCemRISnZhMlU5SWlNM016VTFNMlFpSUhOMGNtOXJaUzEzYVdSMGFEMGlNaTQyTWpnMUlpOCtDanhuSUhSeVlXNXpabTl5YlQwaWJXRjBjbWw0S0RBZ0xqSTJNamcxSUMwdU1qWXlPRFVnTUNBeE56Z3VNVE1nT0RZd0xqQXhLU0lnYzNSeWIydGxQU0lqTURBd0lpQnpkSEp2YTJVdGQybGtkR2c5SWpFd0lqNEtQR1ZzYkdsd2MyVWdZM2c5SWpVME55NHhOQ0lnWTNrOUlqRXlNQzQ1TXlJZ2NuZzlJakkxTGpjeE5DSWdjbms5SWpVeExqUXlPU0lnWm1sc2JEMGlJMlptWmlJdlBnbzhaV3hzYVhCelpTQmplRDBpTlRNMExqTTNJaUJqZVQwaU1USXpMalV6SWlCeWVEMGlNVEl1TmpJM0lpQnllVDBpTWpZdU1qWTBJaTgrQ2p3dlp6NEtQR2NnZEhKaGJuTm1iM0p0UFNKdFlYUnlhWGdvTUNBdExqSTJNamcxSUMwdU1qWXlPRFVnTUNBeE56Z3VOallnTVRFeE5DNDNLU0lnYzNSeWIydGxQU0lqTURBd0lpQnpkSEp2YTJVdGQybGtkR2c5SWpFd0lqNEtQR1ZzYkdsd2MyVWdZM2c5SWpVME55NHhOQ0lnWTNrOUlqRXlNQzQ1TXlJZ2NuZzlJakkxTGpjeE5DSWdjbms5SWpVeExqUXlPU0lnWm1sc2JEMGlJMlptWmlJdlBnbzhaV3hzYVhCelpTQmplRDBpTlRNMExqTTNJaUJqZVQwaU1USXpMalV6SWlCeWVEMGlNVEl1TmpJM0lpQnllVDBpTWpZdU1qWTBJaTgrQ2p3dlp6NEtQQzluUGdvOEwzTjJaejRLXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGV4cGxhbmFyaWFuQXJyb3dTVkc7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLypUaGlzIGNsYXNzIGlzIHN1cHBvc2VkIHRvIHR1cm4gYSBzZXJpZXMgb2ZcbmRpci5kZWxheSgpXG5kaXIudHJhbnNpdGlvblRvKC4uLilcbmRpci5kZWxheSgpXG5kaXIubmV4dFNsaWRlKCk7XG5cbmludG8gYSBzZXF1ZW5jZSB0aGF0IG9ubHkgYWR2YW5jZXMgd2hlbiB0aGUgcmlnaHQgYXJyb3cgaXMgcHJlc3NlZC5cblxuQW55IGRpdnMgd2l0aCB0aGUgZXhwLXNsaWRlIGNsYXNzIHdpbGwgYWxzbyBiZSBzaG93biBhbmQgaGlkZGVuIG9uZSBieSBvbmUuXG5cbkFsc28sXG5cbiovXG5cbmltcG9ydCB7QW5pbWF0aW9uLCBFYXNpbmd9IGZyb20gJy4vQW5pbWF0aW9uLmpzJztcbmltcG9ydCBleHBsYW5hcmlhbkFycm93U1ZHIGZyb20gJy4vRGlyZWN0b3JJbWFnZUNvbnN0YW50cy5qcyc7XG5cbmNsYXNzIERpcmVjdGlvbkFycm93e1xuICAgIGNvbnN0cnVjdG9yKGZhY2VSaWdodCl7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZSA9IG5ldyBJbWFnZSgpO1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3JjID0gZXhwbGFuYXJpYW5BcnJvd1NWRztcblxuICAgICAgICB0aGlzLmFycm93SW1hZ2UuY2xhc3NMaXN0LmFkZChcImV4cC1hcnJvd1wiKTtcblxuICAgICAgICBmYWNlUmlnaHQgPSBmYWNlUmlnaHQ9PT11bmRlZmluZWQgPyB0cnVlIDogZmFjZVJpZ2h0O1xuXG4gICAgICAgIGlmKGZhY2VSaWdodCl7XG4gICAgICAgICAgICB0aGlzLmFycm93SW1hZ2UuY2xhc3NMaXN0LmFkZChcImV4cC1hcnJvdy1yaWdodFwiKVxuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRoaXMuYXJyb3dJbWFnZS5jbGFzc0xpc3QuYWRkKFwiZXhwLWFycm93LWxlZnRcIilcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFycm93SW1hZ2Uub25jbGljayA9IChmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5oaWRlU2VsZigpO1xuICAgICAgICAgICAgdGhpcy5vbmNsaWNrQ2FsbGJhY2soKTtcbiAgICAgICAgfSkuYmluZCh0aGlzKTtcblxuICAgICAgICB0aGlzLm9uY2xpY2tDYWxsYmFjayA9IG51bGw7IC8vIHRvIGJlIHNldCBleHRlcm5hbGx5XG4gICAgfVxuICAgIHNob3dTZWxmKCl7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5vcGFjaXR5ID0gMTtcbiAgICAgICAgXG4gICAgfVxuICAgIGhpZGVTZWxmKCl7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5vcGFjaXR5ID0gMDtcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gICAgfVxufVxuXG5cbmNsYXNzIE5vbkRlY3JlYXNpbmdEaXJlY3RvcntcbiAgICAvL1VzaW5nIGEgTm9uRGVjcmVhc2luZ0RpcmVjdG9yLCBjcmVhdGUgSFRNTCBlbGVtZW50cyB3aXRoIHRoZSAnZXhwLXNsaWRlJyBjbGFzcy5cbiAgICAvL1RoZSBmaXJzdCBIVE1MIGVsZW1lbnQgd2l0aCB0aGUgJ2V4cC1zbGlkZScgY2xhc3Mgd2lsbCBiZSBzaG93biBmaXJzdC4gV2hlbiB0aGUgbmV4dCBzbGlkZSBidXR0b24gaXMgY2xpY2tlZCwgdGhhdCB3aWxsIGZhZGUgb3V0IGFuZCBiZSByZXBsYWNlZCB3aXRoIHRoZSBuZXh0IGVsZW1lbnQgd2l0aCB0aGUgZXhwLXNsaWRlIGNsYXNzLCBpbiBvcmRlciBvZiBIVE1MLlxuICAgIC8vSWYgeW91IHdhbnQgdG8gZGlzcGxheSBtdWx0aXBsZSBIVE1MIGVsZW1lbnRzIGF0IHRoZSBzYW1lIHRpbWUsICdleHAtc2xpZGUtPG4+JyB3aWxsIGFsc28gYmUgZGlzcGxheWVkIHdoZW4gdGhlIHByZXNlbnRhdGlvbiBpcyBjdXJyZW50bHkgb24gc2xpZGUgbnVtYmVyIG4uIEZvciBleGFtcGxlLCBldmVyeXRoaW5nIGluIHRoZSBleHAtc2xpZGUtMSBjbGFzcyB3aWxsIGJlIHZpc2libGUgZnJvbSB0aGUgc3RhcnQsIGFuZCB0aGVuIGV4cC1zbGlkZS0yLCBhbmQgc28gb24uXG4gICAgLy9Eb24ndCBnaXZlIGFuIGVsZW1lbnQgYm90aCB0aGUgZXhwLXNsaWRlIGFuZCBleHAtc2xpZGUtbiBjbGFzc2VzLiBcblxuICAgIC8vIEkgd2FudCBEaXJlY3RvcigpIHRvIGJlIGFibGUgdG8gYmFja3RyYWNrIGJ5IHByZXNzaW5nIGJhY2t3YXJkcy4gVGhpcyBkb2Vzbid0IGRvIHRoYXQuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyl7XG4gICAgICAgIHRoaXMuc2xpZGVzID0gW107XG4gICAgICAgIHRoaXMuY3VycmVudFNsaWRlSW5kZXggPSAwOyAgICAgICAgXG4gICAgICAgIHRoaXMubnVtU2xpZGVzID0gMDtcbiAgICAgICAgdGhpcy5udW1IVE1MU2xpZGVzID0gMDtcblxuICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBcblxuXG4gICAgYXN5bmMgYmVnaW4oKXtcbiAgICAgICAgYXdhaXQgdGhpcy53YWl0Rm9yUGFnZUxvYWQoKTtcblxuICAgICAgICB0aGlzLnNldHVwQW5kSGlkZUFsbFNsaWRlSFRNTEVsZW1lbnRzKCk7XG5cbiAgICAgICAgdGhpcy5zd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KDApOyAvL3VuaGlkZSBmaXJzdCBvbmVcblxuICAgICAgICB0aGlzLnNldHVwQ2xpY2thYmxlcygpO1xuXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIHNldHVwQW5kSGlkZUFsbFNsaWRlSFRNTEVsZW1lbnRzKCl7XG5cbiAgICAgICAgdGhpcy5zbGlkZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXhwLXNsaWRlXCIpO1xuICAgICAgICB0aGlzLm51bUhUTUxTbGlkZXMgPSB0aGlzLnNsaWRlcy5sZW5ndGg7XG5cbiAgICAgICAgLy9oaWRlIGFsbCBzbGlkZXMgZXhjZXB0IGZpcnN0IG9uZVxuICAgICAgICBmb3IodmFyIGk9MDtpPHRoaXMubnVtSFRNTFNsaWRlcztpKyspe1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbaV0uc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1tpXS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbaV0uc3R5bGUuZGlzcGxheSA9ICdub25lJzsvL29wYWNpdHk9MCBhbG9uZSB3b24ndCBiZSBpbnN0YW50IGJlY2F1c2Ugb2YgdGhlIDFzIENTUyB0cmFuc2l0aW9uXG4gICAgICAgIH1cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgICAgICAvL25vdyBoYW5kbGUgZXhwLXNsaWRlLTxuPlxuICAgICAgICBsZXQgYWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2NsYXNzKj1cImV4cC1zbGlkZS1cIl0nKTsgLy90aGlzIGlzIGEgQ1NTIGF0dHJpYnV0ZSBzZWxlY3RvciwgYW5kIEkgaGF0ZSB0aGF0IHRoaXMgZXhpc3RzLiBpdCdzIHNvIHVnbHlcbiAgICAgICAgZm9yKHZhciBpPTA7aTxhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICBhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHNbaV0uc3R5bGUub3BhY2l0eSA9IDA7IFxuICAgICAgICAgICAgYWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzW2ldLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gICAgICAgICAgICBhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHNbaV0uc3R5bGUuZGlzcGxheSA9ICdub25lJzsvL29wYWNpdHk9MCBhbG9uZSB3b24ndCBiZSBpbnN0YW50IGJlY2F1c2Ugb2YgdGhlIDFzIENTUyB0cmFuc2l0aW9uXG4gICAgICAgIH1cblxuICAgICAgICAvL3VuZG8gc2V0dGluZyBkaXNwbGF5LW5vbmUgYWZ0ZXIgYSBiaXQgb2YgdGltZVxuICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICAgICAgZm9yKHZhciBpPTA7aTxzZWxmLnNsaWRlcy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgICAgICBzZWxmLnNsaWRlc1tpXS5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IodmFyIGk9MDtpPGFsbFNwZWNpZmljU2xpZGVFbGVtZW50cy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgICAgICBhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHNbaV0uc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LDEpO1xuXG4gICAgfVxuXG4gICAgc2V0dXBDbGlja2FibGVzKCl7XG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cgPSBuZXcgRGlyZWN0aW9uQXJyb3coKTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLnJpZ2h0QXJyb3cuYXJyb3dJbWFnZSk7XG4gICAgICAgIHRoaXMucmlnaHRBcnJvdy5vbmNsaWNrQ2FsbGJhY2sgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgc2VsZi5fY2hhbmdlU2xpZGUoMSwgZnVuY3Rpb24oKXt9KTsgLy8gdGhpcyBlcnJvcnMgd2l0aG91dCB0aGUgZW1wdHkgZnVuY3Rpb24gYmVjYXVzZSB0aGVyZSdzIG5vIHJlc29sdmUuIFRoZXJlIG11c3QgYmUgYSBiZXR0ZXIgd2F5IHRvIGRvIHRoaW5ncy5cbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIldBUk5JTkc6IEhvcnJpYmxlIGhhY2sgaW4gZWZmZWN0IHRvIGNoYW5nZSBzbGlkZXMuIFBsZWFzZSByZXBsYWNlIHRoZSBwYXNzLWFuLWVtcHR5LWZ1bmN0aW9uIHRoaW5nIHdpdGggc29tZXRoaW5nIHRoYXQgYWN0dWFsbHkgcmVzb2x2ZXMgcHJvcGVybHkgYW5kIGRvZXMgYXN5bmMuXCIpXG4gICAgICAgICAgICBzZWxmLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBhc3luYyB3YWl0Rm9yUGFnZUxvYWQoKXtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICBpZihkb2N1bWVudC5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScpe1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLHJlc29sdmUpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgYXN5bmMgbmV4dFNsaWRlKCl7XG4gICAgICAgIGlmKCF0aGlzLmluaXRpYWxpemVkKXRocm93IG5ldyBFcnJvcihcIkVSUk9SOiBVc2UgLmJlZ2luKCkgb24gYSBEaXJlY3RvciBiZWZvcmUgY2FsbGluZyBhbnkgb3RoZXIgbWV0aG9kcyFcIik7XG5cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHRoaXMucmlnaHRBcnJvdy5zaG93U2VsZigpO1xuICAgICAgICAvL3Byb21pc2UgaXMgcmVzb2x2ZWQgYnkgY2FsbGluZyB0aGlzLm5leHRTbGlkZVByb21pc2UucmVzb2x2ZSgpIHdoZW4gdGhlIHRpbWUgY29tZXNcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgIGZ1bmN0aW9uIGtleUxpc3RlbmVyKGUpe1xuICAgICAgICAgICAgICAgIGlmKGUucmVwZWF0KXJldHVybjsgLy9rZXlkb3duIGZpcmVzIG11bHRpcGxlIHRpbWVzIGJ1dCB3ZSBvbmx5IHdhbnQgdGhlIGZpcnN0IG9uZVxuICAgICAgICAgICAgICAgIGxldCBzbGlkZURlbHRhID0gMDtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGUua2V5Q29kZSkge1xuICAgICAgICAgICAgICAgICAgY2FzZSAzNDpcbiAgICAgICAgICAgICAgICAgIGNhc2UgMzk6XG4gICAgICAgICAgICAgICAgICBjYXNlIDQwOlxuICAgICAgICAgICAgICAgICAgICBzbGlkZURlbHRhID0gMTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYoc2xpZGVEZWx0YSAhPSAwKXtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5fY2hhbmdlU2xpZGUoc2xpZGVEZWx0YSwgcmVzb2x2ZSk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYucmlnaHRBcnJvdy5oaWRlU2VsZigpO1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIixrZXlMaXN0ZW5lcik7IC8vdGhpcyBhcHByb2FjaCB0YWtlbiBmcm9tIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM1NzE4NjQ1L3Jlc29sdmluZy1hLXByb21pc2Utd2l0aC1ldmVudGxpc3RlbmVyXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwga2V5TGlzdGVuZXIpO1xuICAgICAgICAgICAgLy9ob3JyaWJsZSBoYWNrIHNvIHRoYXQgdGhlICduZXh0IHNsaWRlJyBhcnJvdyBjYW4gdHJpZ2dlciB0aGlzIHRvb1xuICAgICAgICAgICAgc2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBmdW5jdGlvbigpeyBcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsa2V5TGlzdGVuZXIpOyBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIF9jaGFuZ2VTbGlkZShzbGlkZURlbHRhLCByZXNvbHZlKXtcbiAgICAgICAgLy9zbGlkZSBjaGFuZ2luZyBsb2dpY1xuICAgICAgICBpZihzbGlkZURlbHRhICE9IDApe1xuICAgICAgICAgICAgaWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA9PSAwICYmIHNsaWRlRGVsdGEgPT0gLTEpe1xuICAgICAgICAgICAgICAgIHJldHVybjsgLy9ubyBnb2luZyBwYXN0IHRoZSBiZWdpbm5pbmdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gdGhpcy5udW1IVE1MU2xpZGVzLTEgJiYgc2xpZGVEZWx0YSA9PSAxKXtcbiAgICAgICAgICAgICAgICByZXR1cm47IC8vbm8gZ29pbmcgcGFzdCB0aGUgZW5kXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleCh0aGlzLmN1cnJlbnRTbGlkZUluZGV4ICsgc2xpZGVEZWx0YSk7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KHNsaWRlTnVtYmVyKXtcbiAgICAgICAgLy91cGRhdGVzIEhUTUwgYW5kIGFsc28gc2V0cyB0aGlzLmN1cnJlbnRTbGlkZUluZGV4IHRvIHNsaWRlTnVtYmVyXG5cbiAgICAgICAgbGV0IHByZXZTbGlkZU51bWJlciA9IHRoaXMuY3VycmVudFNsaWRlSW5kZXg7XG4gICAgICAgIHRoaXMuY3VycmVudFNsaWRlSW5kZXggPSBzbGlkZU51bWJlcjtcblxuXG4gICAgICAgIC8vaGlkZSB0aGUgSFRNTCBlbGVtZW50cyBmb3IgdGhlIHByZXZpb3VzIHNsaWRlXG5cbiAgICAgICAgLy9pdGVtcyB3aXRoIGNsYXNzIGV4cC1zbGlkZVxuICAgICAgICBpZihwcmV2U2xpZGVOdW1iZXIgPCB0aGlzLnNsaWRlcy5sZW5ndGgpe1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbcHJldlNsaWRlTnVtYmVyXS5zdHlsZS5vcGFjaXR5ID0gMDtcbiAgICAgICAgICAgIHRoaXMuc2xpZGVzW3ByZXZTbGlkZU51bWJlcl0uc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy9pdGVtcyB3aXRoIEhUTUwgY2xhc3MgZXhwLXNsaWRlLW5cbiAgICAgICAgbGV0IHByZXZTbGlkZUVsZW1zID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZS1cIisocHJldlNsaWRlTnVtYmVyKzEpKVxuICAgICAgICBmb3IodmFyIGk9MDtpPHByZXZTbGlkZUVsZW1zLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgcHJldlNsaWRlRWxlbXNbaV0uc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgICAgICAgICBwcmV2U2xpZGVFbGVtc1tpXS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuICAgICAgICB9XG5cblxuICAgICAgICAvL3Nob3cgdGhlIEhUTUwgZWxlbWVudHMgZm9yIHRoZSBjdXJyZW50IHNsaWRlXG4gIFxuICAgICAgICBcbiAgICAgICAgLy9pdGVtcyB3aXRoIEhUTUwgY2xhc3MgZXhwLXNsaWRlLW5cbiAgICAgICAgbGV0IGVsZW1zVG9EaXNwbGF5T25seU9uVGhpc1NsaWRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZS1cIisoc2xpZGVOdW1iZXIrMSkpO1xuXG4gICAgICAgIGlmKHNsaWRlTnVtYmVyID49IHRoaXMubnVtSFRNTFNsaWRlcyAmJiBlbGVtc1RvRGlzcGxheU9ubHlPblRoaXNTbGlkZS5sZW5ndGggPT0gMCl7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiVHJpZWQgdG8gc2hvdyBzbGlkZSAjXCIrc2xpZGVOdW1iZXIrXCIsIGJ1dCBvbmx5IFwiICsgdGhpcy5udW1IVE1MU2xpZGVzICsgXCJIVE1MIGVsZW1lbnRzIHdpdGggZXhwLXNsaWRlIHdlcmUgZm91bmQhIE1ha2UgbW9yZSBzbGlkZXM/XCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKHZhciBpPTA7aTxlbGVtc1RvRGlzcGxheU9ubHlPblRoaXNTbGlkZS5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGVsZW1zVG9EaXNwbGF5T25seU9uVGhpc1NsaWRlW2ldLnN0eWxlLm9wYWNpdHkgPSAxO1xuICAgICAgICAgICAgZWxlbXNUb0Rpc3BsYXlPbmx5T25UaGlzU2xpZGVbaV0uc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnOyAvL25vdCBcImFsbFwiLCBiZWNhdXNlIHRoYXQgbWlnaHQgb3ZlcnJpZGUgQ1NTIHdoaWNoIHNldHMgcG9pbnRlci1ldmVudHMgdG8gbm9uZVxuICAgICAgICB9XG5cbiAgICAgICAgLy9pdGVtcyB3aXRoIGNsYXNzIGV4cC1zbGlkZVxuICAgICAgICBpZihzbGlkZU51bWJlciA8IHRoaXMuc2xpZGVzLmxlbmd0aCl7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1tzbGlkZU51bWJlcl0uc3R5bGUub3BhY2l0eSA9IDE7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1tzbGlkZU51bWJlcl0uc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnOyAvL25vdCBcImFsbFwiLCBiZWNhdXNlIHRoYXQgbWlnaHQgb3ZlcnJpZGUgQ1NTIHdoaWNoIHNldHMgcG9pbnRlci1ldmVudHMgdG8gbm9uZVxuICAgICAgICAgICAgdGhpcy5zY3JvbGxVcFRvVG9wT2ZDb250YWluZXIodGhpcy5zbGlkZXNbc2xpZGVOdW1iZXJdKTtcbiAgICAgICAgfVxuXG4gICAgfVxuICAgIHNjcm9sbFVwVG9Ub3BPZkNvbnRhaW5lcihlbGVtZW50KXtcbiAgICAgICAgdGhpcy5nZXRTY3JvbGxQYXJlbnQoZWxlbWVudCkuc2Nyb2xsVG9wID0gMDtcbiAgICB9XG4gICAgZ2V0U2Nyb2xsUGFyZW50KGVsZW1lbnQsIGluY2x1ZGVIaWRkZW4pe1xuICAgICAgICAvL2Zyb20gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzU5Mzk4ODYvZmluZC1maXJzdC1zY3JvbGxhYmxlLXBhcmVudFxuICAgICAgICB2YXIgc3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuICAgICAgICB2YXIgZXhjbHVkZVN0YXRpY1BhcmVudCA9IHN0eWxlLnBvc2l0aW9uID09PSBcImFic29sdXRlXCI7XG4gICAgICAgIHZhciBvdmVyZmxvd1JlZ2V4ID0gaW5jbHVkZUhpZGRlbiA/IC8oYXV0b3xzY3JvbGx8aGlkZGVuKS8gOiAvKGF1dG98c2Nyb2xsKS87XG4gICAgICAgIGlmIChzdHlsZS5wb3NpdGlvbiA9PT0gXCJmaXhlZFwiKSByZXR1cm4gZG9jdW1lbnQuYm9keTtcbiAgICAgICAgZm9yICh2YXIgcGFyZW50ID0gZWxlbWVudDsgKHBhcmVudCA9IHBhcmVudC5wYXJlbnRFbGVtZW50KTspIHtcbiAgICAgICAgICAgIHN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShwYXJlbnQpO1xuICAgICAgICAgICAgaWYgKGV4Y2x1ZGVTdGF0aWNQYXJlbnQgJiYgc3R5bGUucG9zaXRpb24gPT09IFwic3RhdGljXCIpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvdmVyZmxvd1JlZ2V4LnRlc3Qoc3R5bGUub3ZlcmZsb3cgKyBzdHlsZS5vdmVyZmxvd1kgKyBzdHlsZS5vdmVyZmxvd1gpKSByZXR1cm4gcGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkb2N1bWVudC5ib2R5O1xuICAgIH1cblxuICAgIC8vdmVyYnNcbiAgICBhc3luYyBfc2xlZXAod2FpdFRpbWUpe1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIHdhaXRUaW1lKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGFzeW5jIGRlbGF5KHdhaXRUaW1lKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NsZWVwKHdhaXRUaW1lKTtcbiAgICB9XG4gICAgVHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMsIG9wdGlvbmFsQXJndW1lbnRzKXtcbiAgICAgICAgLy9pZiBzb21lb25lJ3MgdXNpbmcgdGhlIG9sZCBjYWxsaW5nIHN0cmF0ZWd5IG9mIHN0YWdnZXJGcmFjdGlvbiBhcyB0aGUgbGFzdCBhcmd1bWVudCwgY29udmVydCBpdCBwcm9wZXJseVxuICAgICAgICBpZihvcHRpb25hbEFyZ3VtZW50cyAmJiBVdGlscy5pc051bWJlcihvcHRpb25hbEFyZ3VtZW50cykpe1xuICAgICAgICAgICAgb3B0aW9uYWxBcmd1bWVudHMgPSB7c3RhZ2dlckZyYWN0aW9uOiBvcHRpb25hbEFyZ3VtZW50c307XG4gICAgICAgIH1cbiAgICAgICAgbmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDAsIHN0YWdnZXJGcmFjdGlvbj1zdGFnZ2VyRnJhY3Rpb24sIG9wdGlvbmFsQXJndW1lbnRzKTtcbiAgICB9XG59XG5cblxuXG5cblxuY29uc3QgRk9SV0FSRFMgPSAoXCJmb3J3YXJkc1wiKTtcbmNvbnN0IEJBQ0tXQVJEUyA9IChcImJhY2t3YXJkc1wiKTtcbmNvbnN0IE5PX1NMSURFX01PVkVNRU5UID0gKFwibm90IHRpbWUgdHJhdmVsaW5nXCIpO1xuXG5jbGFzcyBVbmRvQ2FwYWJsZURpcmVjdG9yIGV4dGVuZHMgTm9uRGVjcmVhc2luZ0RpcmVjdG9ye1xuICAgIC8vdGhzaSBkaXJlY3RvciB1c2VzIGJvdGggZm9yd2FyZHMgYW5kIGJhY2t3YXJkcyBhcnJvd3MuIHRoZSBiYWNrd2FyZHMgYXJyb3cgd2lsbCB1bmRvIGFueSBVbmRvQ2FwYWJsZURpcmVjdG9yLlRyYW5zaXRpb25Ubygpc1xuICAgIC8vdG9kbzogaG9vayB1cCB0aGUgYXJyb3dzIGFuZCBtYWtlIGl0IG5vdFxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcblxuICAgICAgICB0aGlzLmZ1cnRoZXN0U2xpZGVJbmRleCA9IDA7IC8vbWF0Y2hlcyB0aGUgbnVtYmVyIG9mIHRpbWVzIG5leHRTbGlkZSgpIGhhcyBiZWVuIGNhbGxlZFxuICAgICAgICAvL3RoaXMuY3VycmVudFNsaWRlSW5kZXggaXMgYWx3YXlzIDwgdGhpcy5mdXJ0aGVzdFNsaWRlSW5kZXggLSBpZiBlcXVhbCwgd2UgcmVsZWFzZSB0aGUgcHJvbWlzZSBhbmQgbGV0IG5leHRTbGlkZSgpIHJldHVyblxuXG4gICAgICAgIHRoaXMudW5kb1N0YWNrID0gW107XG4gICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXggPSAtMTsgLy9pbmNyZWFzZWQgYnkgb25lIGV2ZXJ5IHRpbWUgZWl0aGVyIHRoaXMuVHJhbnNpdGlvblRvIGlzIGNhbGxlZCBvciB0aGlzLm5leHRTbGlkZSgpIGlzIGNhbGxlZFxuXG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPSBOT19TTElERV9NT1ZFTUVOVDsgLy90aGlzIHZhcmlhYmxlIGlzIHVzZWQgdG8gZW5zdXJlIHRoYXQgaWYgeW91IHJlZG8sIHRoZW4gdW5kbyBoYWxmd2F5IHRocm91Z2ggdGhlIHJlZG8sIHRoZSByZWRvIGVuZHMgdXAgY2FuY2VsbGVkLiBcbiAgICAgICAgdGhpcy5udW1BcnJvd1ByZXNzZXMgPSAwO1xuXG4gICAgICAgIC8vaWYgeW91IHByZXNzIHJpZ2h0IGJlZm9yZSB0aGUgZmlyc3QgZGlyZWN0b3IubmV4dFNsaWRlKCksIGRvbid0IGVycm9yXG4gICAgICAgIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gZnVuY3Rpb24oKXt9IFxuXG4gICAgICAgIGZ1bmN0aW9uIGtleUxpc3RlbmVyKGUpe1xuICAgICAgICAgICAgaWYoZS5yZXBlYXQpcmV0dXJuOyAvL2tleWRvd24gZmlyZXMgbXVsdGlwbGUgdGltZXMgYnV0IHdlIG9ubHkgd2FudCB0aGUgZmlyc3Qgb25lXG4gICAgICAgICAgICBsZXQgc2xpZGVEZWx0YSA9IDA7XG4gICAgICAgICAgICBzd2l0Y2ggKGUua2V5Q29kZSkge1xuICAgICAgICAgICAgICBjYXNlIDM0OlxuICAgICAgICAgICAgICBjYXNlIDM5OlxuICAgICAgICAgICAgICBjYXNlIDQwOlxuICAgICAgICAgICAgICAgIHNlbGYuaGFuZGxlRm9yd2FyZHNQcmVzcygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDMzOlxuICAgICAgICAgICAgICBjYXNlIDM3OlxuICAgICAgICAgICAgICBjYXNlIDM4OlxuICAgICAgICAgICAgICAgIHNlbGYuaGFuZGxlQmFja3dhcmRzUHJlc3MoKTtcbiAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBrZXlMaXN0ZW5lcik7XG4gICAgfVxuXG4gICAgc2V0dXBDbGlja2FibGVzKCl7XG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLmxlZnRBcnJvdyA9IG5ldyBEaXJlY3Rpb25BcnJvdyhmYWxzZSk7XG4gICAgICAgIHRoaXMubGVmdEFycm93LmhpZGVTZWxmKCk7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5sZWZ0QXJyb3cuYXJyb3dJbWFnZSk7XG4gICAgICAgIHRoaXMubGVmdEFycm93Lm9uY2xpY2tDYWxsYmFjayA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBzZWxmLmhhbmRsZUJhY2t3YXJkc1ByZXNzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cgPSBuZXcgRGlyZWN0aW9uQXJyb3codHJ1ZSk7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yaWdodEFycm93LmFycm93SW1hZ2UpO1xuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cub25jbGlja0NhbGxiYWNrID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHNlbGYuaGFuZGxlRm9yd2FyZHNQcmVzcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbW92ZUZ1cnRoZXJJbnRvUHJlc2VudGF0aW9uKCl7XG4gICAgICAgICAgICAvL2lmIHRoZXJlJ3Mgbm90aGluZyB0byByZWRvLCAoc28gd2UncmUgbm90IGluIHRoZSBwYXN0IG9mIHRoZSB1bmRvIHN0YWNrKSwgYWR2YW5jZSBmdXJ0aGVyLlxuICAgICAgICAgICAgLy9pZiB0aGVyZSBhcmUgbGVzcyBIVE1MIHNsaWRlcyB0aGFuIGNhbGxzIHRvIGRpcmVjdG9yLm5ld1NsaWRlKCksIGNvbXBsYWluIGluIHRoZSBjb25zb2xlIGJ1dCBhbGxvdyB0aGUgcHJlc2VudGF0aW9uIHRvIHByb2NlZWRcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiTW92aW5nIGZ1cnRoZXIgaW50byBwcmVzZW50YXRpb24hXCIpO1xuICAgICAgICAgICAgaWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA8IHRoaXMubnVtU2xpZGVzKXtcbiAgICAgICAgICAgICAgICB0aGlzLmZ1cnRoZXN0U2xpZGVJbmRleCArPSAxOyBcblxuICAgICAgICAgICAgICAgIHRoaXMuc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleCh0aGlzLmN1cnJlbnRTbGlkZUluZGV4ICsgMSk7IC8vdGhpcyB3aWxsIGNvbXBsYWluIGluIHRoZSBjb25zb2xlIHdpbmRvdyBpZiB0aGVyZSBhcmUgbGVzcyBzbGlkZXMgdGhhbiBuZXdTbGlkZSgpIGNhbGxzXG4gICAgICAgICAgICAgICAgdGhpcy5zaG93QXJyb3dzKCk7IC8vc2hvd0Fycm93cyBtdXN0IGNvbWUgYWZ0ZXIgdGhpcy5jdXJyZW50U2xpZGVJbmRleCBhZHZhbmNlcyBvciBlbHNlIHdlIHdvbid0IGJlIGFibGUgdG8gdGVsbCBpZiB3ZSdyZSBhdCB0aGUgZW5kIG9yIG5vdFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24oKTsgLy9hbGxvdyBwcmVzZW50YXRpb24gY29kZSB0byBwcm9jZWVkXG4gICAgfVxuICAgIGlzQ2F1Z2h0VXBXaXRoTm90aGluZ1RvUmVkbygpe1xuICAgICAgICByZXR1cm4gdGhpcy51bmRvU3RhY2tJbmRleCA9PSB0aGlzLnVuZG9TdGFjay5sZW5ndGgtMTtcbiAgICB9XG5cbiAgICBhc3luYyBoYW5kbGVGb3J3YXJkc1ByZXNzKCl7XG5cbiAgICAgICAgLy9pZiB0aGVyZSdzIG5vdGhpbmcgdG8gcmVkbywgc2hvdyB0aGUgbmV4dCBzbGlkZVxuICAgICAgICBpZih0aGlzLmlzQ2F1Z2h0VXBXaXRoTm90aGluZ1RvUmVkbygpKXtcbiAgICAgICAgICAgIHRoaXMubW92ZUZ1cnRoZXJJbnRvUHJlc2VudGF0aW9uKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB3ZSBnZXQgdG8gaGVyZSwgd2UndmUgcHJldmlvdXNseSBkb25lIGFuIHVuZG8sIGFuZCB3ZSdyZSBpbiB0aGUgcGFzdC4gV2UgbmVlZCB0byBjYXRjaCB1cCBhbmQgcmVkbyBhbGwgdGhvc2UgaXRlbXNcblxuICAgICAgICAvL29ubHkgcmVkbyBpZiB3ZSdyZSBub3QgYWxyZWFkeSByZWRvaW5nXG4gICAgICAgIC8vdG9kbzogYWRkIGFuIGlucHV0IGJ1ZmZlciBpbnN0ZWFkIG9mIGRpc2NhcmRpbmcgdGhlbVxuICAgICAgICBpZih0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPT0gRk9SV0FSRFMpcmV0dXJuO1xuICAgICAgICB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPSBGT1JXQVJEUztcblxuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cuaGlkZVNlbGYoKTtcblxuICAgICAgICB0aGlzLm51bUFycm93UHJlc3NlcyArPSAxO1xuICAgICAgICBsZXQgbnVtQXJyb3dQcmVzc2VzID0gdGhpcy5udW1BcnJvd1ByZXNzZXM7XG5cbiAgICAgICAgLy9hZHZhbmNlIHBhc3QgdGhlIGN1cnJlbnQgTmV3U2xpZGVVbmRvSXRlbSB3ZSdyZSBwcmVzdW1hYmx5IHBhdXNlZCBvblxuXG4gICAgICAgIGlmKHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdLmNvbnN0cnVjdG9yID09PSBOZXdTbGlkZVVuZG9JdGVtKXtcbiAgICAgICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXggKz0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vY2hhbmdlIEhUTUwgc2xpZGUgZmlyc3Qgc28gdGhhdCBpZiB0aGVyZSBhcmUgYW55IGRlbGF5cyB0byB1bmRvLCB0aGV5IGRvbid0IHNsb3cgZG93biB0aGUgc2xpZGVcbiAgICAgICAgdGhpcy5zd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KHRoaXMuY3VycmVudFNsaWRlSW5kZXggKyAxKTtcbiAgICAgICAgdGhpcy5zaG93QXJyb3dzKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBTdGFydGluZyBhcnJvdyBwcmVzcyBmb3J3YXJkcyAjJHtudW1BcnJvd1ByZXNzZXN9YCk7XG5cbiAgICAgICAgd2hpbGUodGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF0uY29uc3RydWN0b3IgIT09IE5ld1NsaWRlVW5kb0l0ZW0pe1xuICAgICAgICAgICAgLy9sb29wIHRocm91Z2ggdW5kbyBzdGFjayBhbmQgcmVkbyBlYWNoIHVuZG8gdW50aWwgd2UgZ2V0IHRvIHRoZSBuZXh0IHNsaWRlXG5cblxuICAgICAgICAgICAgbGV0IHJlZG9JdGVtID0gdGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF1cbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVkb0FuSXRlbShyZWRvSXRlbSk7XG5cbiAgICAgICAgICAgIC8vSWYgdGhlcmUncyBhIGRlbGF5IHNvbWV3aGVyZSBpbiB0aGUgdW5kbyBzdGFjaywgYW5kIHdlIHNsZWVwIGZvciBzb21lIGFtb3VudCBvZiB0aW1lLCB0aGUgdXNlciBtaWdodCBoYXZlIHByZXNzZWQgdW5kbyBkdXJpbmcgdGhhdCB0aW1lLiBJbiB0aGF0IGNhc2UsIGhhbmRsZUJhY2t3YXJkc1ByZXNzKCkgd2lsbCBzZXQgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uIHRvIEJBQ0tXQVJEUy4gQnV0IHdlJ3JlIHN0aWxsIHJ1bm5pbmcsIHNvIHdlIHNob3VsZCBzdG9wIHJlZG9pbmchXG4gICAgICAgICAgICBpZih0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gIT0gRk9SV0FSRFMgfHwgbnVtQXJyb3dQcmVzc2VzICE9IHRoaXMubnVtQXJyb3dQcmVzc2VzKXtcbiAgICAgICAgICAgICAgICAvL3RoaXMgZnVuY3Rpb24gaGFzIGJlZW4gcHJlZW1wdGVkIGJ5IGFub3RoZXIgYXJyb3cgcHJlc3NcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgZm9yd2FyZHMgaGFzIGJlZW4gcHJlZW1wdGVkOiB0aGlzIGlzICR7bnVtQXJyb3dQcmVzc2VzfSwgYnV0IHRoZXJlJ3MgYW5vdGhlciB3aXRoICR7dGhpcy5udW1BcnJvd1ByZXNzZXN9LCR7dGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYodGhpcy51bmRvU3RhY2tJbmRleCA9PSB0aGlzLnVuZG9TdGFjay5sZW5ndGgtMSl7XG4gICAgICAgICAgICAgICAgLy93ZSd2ZSBub3cgZnVsbHkgY2F1Z2h0IHVwLlxuXG4gICAgICAgICAgICAgICAgLy9pZiB0aGUgY3VycmVudCB1bmRvSXRlbSBpc24ndCBhIE5ld1NsaWRlVW5kb0l0ZW0sIGJ1dCB3ZSBkbyBoYXZlIGEgbmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uIChtZWFuaW5nIHRoZSBtYWluIHVzZXIgY29kZSBpcyB3YWl0aW5nIG9uIHRoaXMgdG8gYWN0aXZhdGUpIGFsbG93IHByZXNlbnRhdGlvbiBjb2RlIHRvIHByb2NlZWRcbiAgICAgICAgICAgICAgICBpZih0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbil7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ICs9IDE7XG5cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPSBOT19TTElERV9NT1ZFTUVOVDtcbiAgICB9XG5cbiAgICBhc3luYyByZWRvQW5JdGVtKHJlZG9JdGVtKXtcbiAgICAgICAgc3dpdGNoKHJlZG9JdGVtLnR5cGUpe1xuICAgICAgICAgICAgY2FzZSBERUxBWTpcbiAgICAgICAgICAgICAgICAvL2tlZXAgaW4gbWluZCBkdXJpbmcgdGhpcyBkZWxheSBwZXJpb2QsIHRoZSB1c2VyIG1pZ2h0IHB1c2ggdGhlIGxlZnQgYXJyb3cga2V5LiBJZiB0aGF0IGhhcHBlbnMsIHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiB3aWxsIGJlIERFQ1JFQVNJTkcsIHNvIGhhbmRsZUZvcndhcmRzUHJlc3MoKSB3aWxsIHF1aXRcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLl9zbGVlcChyZWRvSXRlbS53YWl0VGltZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFRSQU5TSVRJT05UTzpcbiAgICAgICAgICAgICAgICB2YXIgcmVkb0FuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24ocmVkb0l0ZW0udGFyZ2V0LCByZWRvSXRlbS50b1ZhbHVlcywgcmVkb0l0ZW0uZHVyYXRpb24sIHJlZG9JdGVtLm9wdGlvbmFsQXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgLy9hbmQgbm93IHJlZG9BbmltYXRpb24sIGhhdmluZyBiZWVuIGNyZWF0ZWQsIGdvZXMgb2ZmIGFuZCBkb2VzIGl0cyBvd24gdGhpbmcgSSBndWVzcy4gdGhpcyBzZWVtcyBpbmVmZmljaWVudC4gdG9kbzogZml4IHRoYXQgYW5kIG1ha2UgdGhlbSBhbGwgY2VudHJhbGx5IHVwZGF0ZWQgYnkgdGhlIGFuaW1hdGlvbiBsb29wIG9yc29tZXRoaW5nXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIE5FV1NMSURFOlxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGhhbmRsZUJhY2t3YXJkc1ByZXNzKCl7XG5cbiAgICAgICAgaWYodGhpcy51bmRvU3RhY2tJbmRleCA9PSAwIHx8IHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gMCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvL29ubHkgdW5kbyBpZiB3ZSdyZSBub3QgYWxyZWFkeSB1bmRvaW5nXG4gICAgICAgIGlmKHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiA9PSBCQUNLV0FSRFMpcmV0dXJuO1xuICAgICAgICB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPSBCQUNLV0FSRFM7XG5cbiAgICAgICAgdGhpcy5sZWZ0QXJyb3cuaGlkZVNlbGYoKTtcblxuICAgICAgICB0aGlzLm51bUFycm93UHJlc3NlcyArPSAxO1xuICAgICAgICBsZXQgbnVtQXJyb3dQcmVzc2VzID0gdGhpcy5udW1BcnJvd1ByZXNzZXM7XG5cbiAgICAgICAgLy9hZHZhbmNlIGJlaGluZCB0aGUgY3VycmVudCBOZXdTbGlkZVVuZG9JdGVtIHdlJ3JlIHByZXN1bWFibHkgcGF1c2VkIG9uXG4gICAgICAgIGlmKHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdLmNvbnN0cnVjdG9yID09PSBOZXdTbGlkZVVuZG9JdGVtKXtcbiAgICAgICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXggLT0gMTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy9jaGFuZ2UgSFRNTCBzbGlkZSBmaXJzdCBzbyB0aGF0IGlmIHRoZXJlIGFyZSBhbnkgZGVsYXlzIHRvIHVuZG8sIHRoZXkgZG9uJ3Qgc2xvdyBkb3duIHRoZSBzbGlkZVxuICAgICAgICB0aGlzLnN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgodGhpcy5jdXJyZW50U2xpZGVJbmRleCAtIDEpO1xuICAgICAgICB0aGlzLnNob3dBcnJvd3MoKTtcblxuICAgICAgICB3aGlsZSh0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XS5jb25zdHJ1Y3RvciAhPT0gTmV3U2xpZGVVbmRvSXRlbSl7XG4gICAgICAgICAgICAvL2xvb3AgdGhyb3VnaCB1bmRvIHN0YWNrIGFuZCB1bmRvIGVhY2ggaXRlbSB1bnRpbCB3ZSByZWFjaCB0aGUgcHJldmlvdXMgc2xpZGVcblxuICAgICAgICAgICAgaWYodGhpcy51bmRvU3RhY2tJbmRleCA9PSAwKXtcbiAgICAgICAgICAgICAgICAvL2F0IGZpcnN0IHNsaWRlXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vSWYgdGhlcmUncyBhIGRlbGF5IHNvbWV3aGVyZSBpbiB0aGUgdW5kbyBzdGFjaywgYW5kIHdlIHNsZWVwIGZvciBzb21lIGFtb3VudCBvZiB0aW1lLCB0aGUgdXNlciBtaWdodCBoYXZlIHByZXNzZWQgcmVkbyBkdXJpbmcgdGhhdCB0aW1lLiBJbiB0aGF0IGNhc2UsIGhhbmRsZUZvcndhcmRzUHJlc3MoKSB3aWxsIHNldCB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gdG8gRk9SV0FSRFMuIEJ1dCB3ZSdyZSBzdGlsbCBydW5uaW5nLCBzbyB3ZSBzaG91bGQgc3RvcCByZWRvaW5nIVxuICAgICAgICAgICAgaWYodGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uICE9IEJBQ0tXQVJEUyB8fCBudW1BcnJvd1ByZXNzZXMgIT0gdGhpcy5udW1BcnJvd1ByZXNzZXMpe1xuICAgICAgICAgICAgICAgIC8vdGhpcyBmdW5jdGlvbiBoYXMgYmVlbiBwcmVlbXB0ZWQgYnkgYW5vdGhlciBhcnJvdyBwcmVzc1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBiYWNrd2FyZHMgaGFzIGJlZW4gcHJlZW1wdGVkOiAke251bUFycm93UHJlc3Nlc30sJHt0aGlzLm51bUFycm93UHJlc3Nlc30sJHt0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb259YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL3VuZG8gdHJhbnNmb3JtYXRpb24gaW4gdGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF1cbiAgICAgICAgICAgIGxldCB1bmRvSXRlbSA9IHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy51bmRvQW5JdGVtKHVuZG9JdGVtKTtcbiAgICAgICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXggLT0gMTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPSBOT19TTElERV9NT1ZFTUVOVDtcbiAgICB9XG5cbiAgICBhc3luYyB1bmRvQW5JdGVtKHVuZG9JdGVtKXtcbiAgICAgICAgc3dpdGNoKHVuZG9JdGVtLnR5cGUpe1xuICAgICAgICAgICAgICAgIGNhc2UgREVMQVk6XG4gICAgICAgICAgICAgICAgICAgIC8va2VlcCBpbiBtaW5kIGR1cmluZyB0aGlzIGRlbGF5IHBlcmlvZCwgdGhlIHVzZXIgbWlnaHQgcHVzaCB0aGUgcmlnaHQgYXJyb3cuIElmIHRoYXQgaGFwcGVucywgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uIHdpbGwgYmUgSU5DUkVBU0lORywgc28gaGFuZGxlQmFja3dhcmRzUHJlc3MoKSB3aWxsIHF1aXQgaW5zdGVhZCBvZiBjb250aW51aW5nLlxuICAgICAgICAgICAgICAgICAgICBsZXQgd2FpdFRpbWUgPSB1bmRvSXRlbS53YWl0VGltZTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5fc2xlZXAod2FpdFRpbWUvNSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgVFJBTlNJVElPTlRPOlxuICAgICAgICAgICAgICAgICAgICBsZXQgZHVyYXRpb24gPSB1bmRvSXRlbS5kdXJhdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgZHVyYXRpb24gPSBkdXJhdGlvbi81OyAvL3VuZG9pbmcgc2hvdWxkIGJlIGZhc3Rlci5cbiAgICAgICAgICAgICAgICAgICAgLy90b2RvOiBpbnZlcnQgdGhlIGVhc2luZyBvZiB0aGUgdW5kb0l0ZW0gd2hlbiBjcmVhdGluZyB0aGUgdW5kbyBhbmltYXRpb24/XG4gICAgICAgICAgICAgICAgICAgIGxldCBlYXNpbmcgPSBFYXNpbmcuRWFzZUluT3V0O1xuICAgICAgICAgICAgICAgICAgICB2YXIgdW5kb0FuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24odW5kb0l0ZW0udGFyZ2V0LCB1bmRvSXRlbS5mcm9tVmFsdWVzLCBkdXJhdGlvbiwgdW5kb0l0ZW0ub3B0aW9uYWxBcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICAvL2FuZCBub3cgdW5kb0FuaW1hdGlvbiwgaGF2aW5nIGJlZW4gY3JlYXRlZCwgZ29lcyBvZmYgYW5kIGRvZXMgaXRzIG93biB0aGluZyBJIGd1ZXNzLiB0aGlzIHNlZW1zIGluZWZmaWNpZW50LiB0b2RvOiBmaXggdGhhdCBhbmQgbWFrZSB0aGVtIGFsbCBjZW50cmFsbHkgdXBkYXRlZCBieSB0aGUgYW5pbWF0aW9uIGxvb3Agb3Jzb21ldGhpbmdcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBORVdTTElERTpcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgfVxuXG4gICAgc2hvd0Fycm93cygpe1xuICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID4gMCl7XG4gICAgICAgICAgICB0aGlzLmxlZnRBcnJvdy5zaG93U2VsZigpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRoaXMubGVmdEFycm93LmhpZGVTZWxmKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA8IHRoaXMubnVtU2xpZGVzKXtcbiAgICAgICAgICAgIHRoaXMucmlnaHRBcnJvdy5zaG93U2VsZigpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRoaXMucmlnaHRBcnJvdy5oaWRlU2VsZigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgbmV4dFNsaWRlKCl7XG4gICAgICAgIC8qVGhlIHVzZXIgd2lsbCBjYWxsIHRoaXMgZnVuY3Rpb24gdG8gbWFyayB0aGUgdHJhbnNpdGlvbiBiZXR3ZWVuIG9uZSBzbGlkZSBhbmQgdGhlIG5leHQuIFRoaXMgZG9lcyB0d28gdGhpbmdzOlxuICAgICAgICBBKSB3YWl0cyB1bnRpbCB0aGUgdXNlciBwcmVzc2VzIHRoZSByaWdodCBhcnJvdyBrZXksIHJldHVybnMsIGFuZCBjb250aW51ZXMgZXhlY3V0aW9uIHVudGlsIHRoZSBuZXh0IG5leHRTbGlkZSgpIGNhbGxcbiAgICAgICAgQikgaWYgdGhlIHVzZXIgcHJlc3NlcyB0aGUgbGVmdCBhcnJvdyBrZXksIHRoZXkgY2FuIHVuZG8gYW5kIGdvIGJhY2sgaW4gdGltZSwgYW5kIGV2ZXJ5IFRyYW5zaXRpb25UbygpIGNhbGwgYmVmb3JlIHRoYXQgd2lsbCBiZSB1bmRvbmUgdW50aWwgaXQgcmVhY2hlcyBhIHByZXZpb3VzIG5leHRTbGlkZSgpIGNhbGwuIEFueSBub3JtYWwgamF2YXNjcmlwdCBhc3NpZ25tZW50cyB3b24ndCBiZSBjYXVnaHQgaW4gdGhpcyA6KFxuICAgICAgICBDKSBpZiB1bmRvXG4gICAgICAgICovXG4gICAgICAgIGlmKCF0aGlzLmluaXRpYWxpemVkKXRocm93IG5ldyBFcnJvcihcIkVSUk9SOiBVc2UgLmJlZ2luKCkgb24gYSBEaXJlY3RvciBiZWZvcmUgY2FsbGluZyBhbnkgb3RoZXIgbWV0aG9kcyFcIik7XG5cbiAgICAgICAgXG4gICAgICAgIHRoaXMubnVtU2xpZGVzKys7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrLnB1c2gobmV3IE5ld1NsaWRlVW5kb0l0ZW0odGhpcy5jdXJyZW50U2xpZGVJbmRleCkpO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4Kys7XG4gICAgICAgIHRoaXMuc2hvd0Fycm93cygpO1xuXG5cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vcHJvbWlzZSBpcyByZXNvbHZlZCBieSBjYWxsaW5nIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uKCkgd2hlbiB0aGUgdGltZSBjb21lc1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgIHNlbGYubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gZnVuY3Rpb24oKXsgXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH0gXG4gICAgYXN5bmMgX3NsZWVwKHdhaXRUaW1lKXtcbiAgICAgICAgYXdhaXQgc3VwZXIuX3NsZWVwKHdhaXRUaW1lKTtcbiAgICB9XG5cbiAgICBhc3luYyBkZWxheSh3YWl0VGltZSl7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrLnB1c2gobmV3IERlbGF5VW5kb0l0ZW0od2FpdFRpbWUpKTtcbiAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCsrO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLnVuZG9TdGFja0luZGV4KTtcbiAgICAgICAgYXdhaXQgdGhpcy5fc2xlZXAod2FpdFRpbWUpO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLnVuZG9TdGFja0luZGV4KTtcbiAgICAgICAgaWYoIXRoaXMuaXNDYXVnaHRVcFdpdGhOb3RoaW5nVG9SZWRvKCkpe1xuICAgICAgICAgICAgLy9UaGlzIGlzIGEgcGVyaWxvdXMgc2l0dWF0aW9uLiBXaGlsZSB3ZSB3ZXJlIGRlbGF5aW5nLCB0aGUgdXNlciBwcmVzc2VkIHVuZG8sIGFuZCBub3cgd2UncmUgaW4gdGhlIHBhc3QuXG4gICAgICAgICAgICAvL3dlIFNIT1VMRE4ndCB5aWVsZCBiYWNrIGFmdGVyIHRoaXMsIGJlY2F1c2UgdGhlIHByZXNlbnRhdGlvbiBjb2RlIG1pZ2h0IHN0YXJ0IHJ1bm5pbmcgbW9yZSB0cmFuc2Zvcm1hdGlvbnMgYWZ0ZXIgdGhpcyB3aGljaCBjb25mbGljdCB3aXRoIHRoZSB1bmRvaW5nIGFuaW1hdGlvbnMuIFNvIHdlIG5lZWQgdG8gd2FpdCB1bnRpbCB3ZSByZWFjaCB0aGUgcmlnaHQgc2xpZGUgYWdhaW5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRWdhZHMhIFRoaXMgaXMgYSBwZXJpbG91cyBzaXR1YXRpb24hIFRvZG86IHdhaXQgdW50aWwgd2UncmUgZnVsbHkgY2F1Z2h0IHVwIHRvIHJlbGVhc2VcIik7XG4gICAgICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICAvL3Byb21pc2UgaXMgcmVzb2x2ZWQgYnkgY2FsbGluZyB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpIHdoZW4gdGhlIHRpbWUgY29tZXNcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgICAgICAgICAgIHNlbGYubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gZnVuY3Rpb24oKXsgXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiUmVsZWFzZSFcIik7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBUcmFuc2l0aW9uVG8odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUywgb3B0aW9uYWxBcmd1bWVudHMpe1xuICAgICAgICBsZXQgZHVyYXRpb24gPSBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyAxIDogZHVyYXRpb25NUy8xMDAwO1xuICAgICAgICB2YXIgYW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbiwgb3B0aW9uYWxBcmd1bWVudHMpO1xuICAgICAgICBsZXQgZnJvbVZhbHVlcyA9IGFuaW1hdGlvbi5mcm9tVmFsdWVzO1xuICAgICAgICB0aGlzLnVuZG9TdGFjay5wdXNoKG5ldyBVbmRvSXRlbSh0YXJnZXQsIHRvVmFsdWVzLCBmcm9tVmFsdWVzLCBkdXJhdGlvbiwgb3B0aW9uYWxBcmd1bWVudHMpKTtcbiAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCsrO1xuICAgIH1cbn1cblxuXG4vL2Rpc2NvdW50IGVudW1cbmNvbnN0IFRSQU5TSVRJT05UTyA9IDA7XG5jb25zdCBORVdTTElERSA9IDE7XG5jb25zdCBERUxBWT0yO1xuXG4vL3RoaW5ncyB0aGF0IGNhbiBiZSBzdG9yZWQgaW4gYSBVbmRvQ2FwYWJsZURpcmVjdG9yJ3MgLnVuZG9TdGFja1tdXG5jbGFzcyBVbmRvSXRlbXtcbiAgICBjb25zdHJ1Y3Rvcih0YXJnZXQsIHRvVmFsdWVzLCBmcm9tVmFsdWVzLCBkdXJhdGlvbiwgb3B0aW9uYWxBcmd1bWVudHMpe1xuICAgICAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcbiAgICAgICAgdGhpcy50b1ZhbHVlcyA9IHRvVmFsdWVzO1xuICAgICAgICB0aGlzLmZyb21WYWx1ZXMgPSBmcm9tVmFsdWVzO1xuICAgICAgICB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG4gICAgICAgIHRoaXMudHlwZSA9IFRSQU5TSVRJT05UTztcbiAgICAgICAgdGhpcy5vcHRpb25hbEFyZ3VtZW50cyA9IG9wdGlvbmFsQXJndW1lbnRzO1xuICAgIH1cbn1cblxuY2xhc3MgTmV3U2xpZGVVbmRvSXRlbXtcbiAgICBjb25zdHJ1Y3RvcihzbGlkZUluZGV4KXtcbiAgICAgICAgdGhpcy5zbGlkZUluZGV4ID0gc2xpZGVJbmRleDtcbiAgICAgICAgdGhpcy50eXBlID0gTkVXU0xJREU7XG4gICAgfVxufVxuXG5jbGFzcyBEZWxheVVuZG9JdGVte1xuICAgIGNvbnN0cnVjdG9yKHdhaXRUaW1lKXtcbiAgICAgICAgdGhpcy53YWl0VGltZSA9IHdhaXRUaW1lO1xuICAgICAgICB0aGlzLnR5cGUgPSBERUxBWTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IE5vbkRlY3JlYXNpbmdEaXJlY3RvciwgRGlyZWN0aW9uQXJyb3csIFVuZG9DYXBhYmxlRGlyZWN0b3IgfTtcbiJdLCJuYW1lcyI6WyJNYXRoIiwiVXRpbHMiLCJ0aHJlZUVudmlyb25tZW50IiwibWF0aC5sZXJwVmVjdG9ycyIsInJlcXVpcmUiLCJyZXF1aXJlJCQwIiwicmVxdWlyZSQkMSIsInJlcXVpcmUkJDIiLCJnbG9iYWwiLCJ2U2hhZGVyIiwiZlNoYWRlciIsInVuaWZvcm1zIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Q0FBQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBOztDQUVBLE1BQU0sSUFBSTtDQUNWLENBQUMsV0FBVyxFQUFFO0NBQ2QsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztDQUNyQixFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0NBQ3JCLEtBQUs7Q0FDTCxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7Q0FDWDtDQUNBLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDNUIsRUFBRSxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztDQUN0QixFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7Q0FDakMsRUFBRSxPQUFPLEtBQUssQ0FBQztDQUNmLEVBQUU7Q0FDRixDQUFDLE1BQU0sRUFBRSxFQUFFO0NBQ1gsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0NBQ2QsRUFBRSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztDQUM3QyxFQUFFLEtBQUssS0FBSyxLQUFLLEVBQUUsQ0FBQyxHQUFHO0NBQ3ZCLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Q0FDdkIsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUM7Q0FDcEMsR0FBRztDQUNILEVBQUUsT0FBTyxJQUFJLENBQUM7Q0FDZCxFQUFFO0NBQ0YsSUFBSSxZQUFZLEVBQUU7Q0FDbEIsUUFBUSxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUM7Q0FDOUIsUUFBUSxJQUFJLFdBQVcsR0FBRyxDQUFDLENBQUM7Q0FDNUIsRUFBRSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7Q0FDbEIsRUFBRSxNQUFNLElBQUksS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLElBQUksV0FBVyxHQUFHLFNBQVMsQ0FBQztDQUN6RSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0NBQ3RCLFlBQVksV0FBVyxHQUFHLENBQUMsQ0FBQztDQUM1QixHQUFHO0NBQ0gsRUFBRSxHQUFHLFdBQVcsSUFBSSxTQUFTLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO0NBQ2xGLFFBQVEsT0FBTyxJQUFJLENBQUM7Q0FDcEIsS0FBSztDQUNMLElBQUksa0JBQWtCLEVBQUU7Q0FDeEI7Q0FDQSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQzs7Q0FFbkQsUUFBUSxJQUFJLFFBQVEsR0FBRyxFQUFFLENBQUM7Q0FDMUIsUUFBUSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDL0MsWUFBWSxJQUFJLGNBQWMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixFQUFFLENBQUM7Q0FDdkUsWUFBWSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUNwRCxnQkFBZ0IsUUFBUSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNqRCxhQUFhO0NBQ2IsU0FBUztDQUNULFFBQVEsT0FBTyxRQUFRLENBQUM7Q0FDeEIsS0FBSztDQUNMLElBQUksZ0JBQWdCLEVBQUU7Q0FDdEI7Q0FDQTtDQUNBOztDQUVBO0NBQ0E7Q0FDQSxRQUFRLE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQztDQUM5QixRQUFRLElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQztDQUM1QixFQUFFLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7Q0FDekIsRUFBRSxNQUFNLElBQUksS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxJQUFJLFdBQVcsR0FBRyxTQUFTLENBQUM7Q0FDL0YsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztDQUN0QixZQUFZLFdBQVcsR0FBRyxDQUFDLENBQUM7Q0FDNUIsR0FBRztDQUNILEVBQUUsR0FBRyxXQUFXLElBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztDQUN4RSxRQUFRLEdBQUcsSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0NBQzlGLFFBQVEsT0FBTyxJQUFJLENBQUM7Q0FDcEIsS0FBSzs7Q0FFTCxDQUFDLGlCQUFpQixFQUFFO0NBQ3BCO0NBQ0E7Q0FDQSxFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUN6QyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztDQUN4QyxHQUFHO0NBQ0gsRUFBRTtDQUNGLENBQUM7O0NBRUQsTUFBTSxVQUFVLFNBQVMsSUFBSTtDQUM3QixDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7Q0FDeEIsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0NBQzlCLENBQUMsaUJBQWlCLEVBQUUsRUFBRTtDQUN0QixDQUFDLE1BQU0sRUFBRSxFQUFFO0NBQ1gsQ0FBQzs7Q0FFRCxNQUFNLFVBQVUsU0FBUyxJQUFJO0NBQzdCLENBQUMsV0FBVyxFQUFFO0NBQ2QsUUFBUSxLQUFLLEVBQUUsQ0FBQztDQUNoQixFQUFFLElBQUksQ0FBQyxjQUFjLEdBQUcsRUFBRSxDQUFDO0NBQzNCLFFBQVEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQztDQUMxQyxLQUFLO0NBQ0wsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUU7Q0FDakIsQ0FBQztDQUNELFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQzs7Q0M3RnpDLE1BQU0sUUFBUSxTQUFTLFVBQVU7Q0FDakMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDO0NBQ3JCLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDVjtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0NBQzlDLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQzs7Q0FFNUM7Q0FDQSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEtBQUssTUFBTSxDQUFDO0NBQzVDLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixHQUFHLENBQUMsQ0FBQztDQUNoQyxHQUFHLEtBQUssR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsS0FBSyxLQUFLLENBQUM7Q0FDakQsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7Q0FDckQsR0FBRyxJQUFJO0NBQ1AsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDJFQUEyRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7Q0FDNUgsR0FBRzs7O0NBR0gsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQzs7Q0FFaEQsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDM0IsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDOztDQUVuQyxFQUFFLElBQUksQ0FBQyxjQUFjLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDOztDQUUzQztDQUNBLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDMUUsRUFBRTtDQUNGLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztDQUNaLEVBQUUsR0FBRyxJQUFJLENBQUMsbUJBQW1CLElBQUksQ0FBQyxDQUFDO0NBQ25DO0NBQ0EsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDdEMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUMsSUFBSTtDQUNKLEdBQUcsSUFBSTtDQUNQLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ3RDLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDL0MsSUFBSTtDQUNKLEdBQUc7O0NBRUgsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztDQUMzQixFQUFFO0NBQ0YsQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUNqQyxFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUN6QyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLEdBQUcsV0FBVyxFQUFDO0NBQ2hELEdBQUc7Q0FDSCxFQUFFO0NBQ0YsQ0FBQyxLQUFLLEVBQUU7Q0FDUixFQUFFLElBQUksS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3BFLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ3pDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7Q0FDdkMsR0FBRztDQUNILEVBQUUsT0FBTyxLQUFLLENBQUM7Q0FDZixFQUFFO0NBQ0YsQ0FBQzs7Q0M1REQsU0FBUyxjQUFjLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQztDQUNqQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ2hDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUNoQixFQUFFO0NBQ0YsQ0FBQyxPQUFPLEtBQUs7Q0FDYixDQUFDO0NBQ0QsU0FBUyxTQUFTLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztDQUN6QixJQUFJLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztDQUN4QixDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzdCLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNsQixFQUFFO0NBQ0YsQ0FBQyxPQUFPLEdBQUc7Q0FDWCxDQUFDO0NBQ0QsU0FBUyxTQUFTLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztDQUN6QixJQUFJLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztDQUN4QixDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzdCLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNsQixFQUFFO0NBQ0YsQ0FBQyxPQUFPLEdBQUc7Q0FDWCxDQUFDO0NBQ0QsU0FBUyxXQUFXLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUM7Q0FDL0I7Q0FDQSxDQUFDLE9BQU8sU0FBUyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM3RSxDQUFDO0NBQ0QsU0FBUyxLQUFLLENBQUMsR0FBRyxDQUFDO0NBQ25CLENBQUMsSUFBSSxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQ3BDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDOUIsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3JCLEVBQUU7Q0FDRixDQUFDLE9BQU8sTUFBTTtDQUNkLENBQUM7Q0FDRCxTQUFTLGNBQWMsQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDO0NBQ3BDOztDQUVBLENBQUMsSUFBSSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztDQUM3QixDQUFDLElBQUksT0FBTyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7O0NBRWhDLENBQUMsSUFBSSxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Q0FDakMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzNCLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUNoQixFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDNUIsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN0QyxHQUFHO0NBQ0gsRUFBRTtDQUNGLENBQUMsT0FBTyxNQUFNLENBQUM7Q0FDZixDQUFDOztDQUVEO0FBQ0EsQUFBRyxLQUFDQSxNQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLGNBQWMsQ0FBQzs7Q0M5Qy9KLE1BQU1DLE9BQUs7O0NBRVgsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLENBQUM7Q0FDbEIsUUFBUSxHQUFHLENBQUMsS0FBSyxTQUFTLENBQUM7Q0FDM0IsWUFBWSxPQUFPLEtBQUssQ0FBQztDQUN6QixTQUFTO0NBQ1QsRUFBRSxPQUFPLENBQUMsQ0FBQyxXQUFXLEtBQUssS0FBSyxDQUFDO0NBQ2pDLEVBQUU7Q0FDRixDQUFDLE9BQU8sUUFBUSxDQUFDLENBQUMsQ0FBQztDQUNuQixRQUFRLEdBQUcsQ0FBQyxLQUFLLFNBQVMsQ0FBQztDQUMzQixZQUFZLE9BQU8sS0FBSyxDQUFDO0NBQ3pCLFNBQVM7Q0FDVCxFQUFFLE9BQU8sQ0FBQyxDQUFDLFdBQVcsS0FBSyxNQUFNLENBQUM7Q0FDbEMsRUFBRTtDQUNGLENBQUMsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDO0NBQ3BCLEVBQUUsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUM7Q0FDbkIsRUFBRTtDQUNGLENBQUMsT0FBTyxVQUFVLENBQUMsQ0FBQyxDQUFDO0NBQ3JCLFFBQVEsR0FBRyxDQUFDLEtBQUssU0FBUyxDQUFDO0NBQzNCLFlBQVksT0FBTyxLQUFLLENBQUM7Q0FDekIsU0FBUztDQUNULEVBQUUsT0FBTyxDQUFDLENBQUMsV0FBVyxLQUFLLFFBQVEsQ0FBQztDQUNwQyxFQUFFO0NBQ0YsQ0FBQyxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUM7Q0FDbkIsUUFBUSxHQUFHLENBQUMsS0FBSyxTQUFTLENBQUM7Q0FDM0IsWUFBWSxPQUFPLEtBQUssQ0FBQztDQUN6QixTQUFTO0NBQ1QsRUFBRSxPQUFPLENBQUMsQ0FBQyxXQUFXLEtBQUssTUFBTSxDQUFDO0NBQ2xDLEVBQUU7O0NBRUYsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUM7Q0FDckI7Q0FDQSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUM7Q0FDWixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0RBQWtELENBQUMsQ0FBQztDQUNyRSxZQUFZLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztDQUM1QixHQUFHO0NBQ0gsRUFBRTs7Q0FFRixDQUFDLE9BQU8sVUFBVSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDO0NBQ3pDO0NBQ0EsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLFdBQVcsS0FBSyxJQUFJLENBQUMsQ0FBQztDQUNuQyxHQUFHLEdBQUcsUUFBUSxDQUFDO0NBQ2YsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLHdDQUF3QyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0NBQ25ILElBQUksSUFBSTtDQUNSLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDJCQUEyQixDQUFDLENBQUM7Q0FDbEcsSUFBSTtDQUNKLFlBQVksT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO0NBQzVCLEdBQUc7Q0FDSCxFQUFFOzs7Q0FHRixDQUFDLE9BQU8sZ0JBQWdCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQztDQUNyQyxFQUFFLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRSxJQUFJLElBQUksS0FBSyxDQUFDLENBQUM7Q0FDaEMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsbUNBQW1DLENBQUMsQ0FBQztDQUNyRSxZQUFZLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztDQUM1QixHQUFHO0NBQ0gsRUFBRTtDQUNGO0NBQ0EsQ0FBQyxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUM7Q0FDbEIsRUFBRSxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUNwQixFQUFFOzs7Q0FHRixDQUFDLE9BQU8sZ0JBQWdCLENBQUMsR0FBRyxDQUFDO0NBQzdCLFFBQVEsR0FBRyxDQUFDQSxPQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLE9BQU8sS0FBSyxDQUFDO0NBQzdDLFFBQVEsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDckMsWUFBWSxHQUFHLENBQUNBLE9BQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxLQUFLLENBQUM7Q0FDckQsU0FBUztDQUNULFFBQVEsT0FBTyxJQUFJLENBQUM7Q0FDcEIsRUFBRTs7Q0FFRixDQUFDOztDQ3BFRCxNQUFNLElBQUksU0FBUyxVQUFVO0NBQzdCLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQztDQUNyQixFQUFFLEtBQUssRUFBRSxDQUFDOztDQUVWO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7OztDQUdBO0NBQ0EsRUFBRUEsT0FBSyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztDQUM1QyxFQUFFQSxPQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7Q0FDMUMsRUFBRUEsT0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSx1RkFBdUYsQ0FBQyxDQUFDO0NBQ3RJLEVBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQzs7Q0FFN0MsRUFBRUEsT0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQzs7Q0FFOUMsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7Q0FDL0IsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDOztDQUV6QyxFQUFFLElBQUksQ0FBQyxjQUFjLEdBQUcsRUFBRSxDQUFDOztDQUUzQixFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEtBQUssTUFBTSxDQUFDO0NBQzFDLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDeEMsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7Q0FDNUMsSUFBSTtDQUNKLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxLQUFLLEtBQUssQ0FBQztDQUMvQyxHQUFHQSxPQUFLLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7Q0FDbEUsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUN4QyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMvQyxJQUFJO0NBQ0osR0FBRzs7Q0FFSDtDQUNBLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDMUUsRUFBRTtDQUNGLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztDQUNaO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQSxFQUFFLEdBQUcsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7Q0FDN0IsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM1QyxJQUFJLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN0RyxJQUFJLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztDQUNsQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLElBQUk7Q0FDSixHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsQ0FBQztDQUNuQztDQUNBLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDNUMsSUFBSSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEcsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM3QyxLQUFLLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN2RyxLQUFLLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM5QyxLQUFLLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzlDLEtBQUs7Q0FDTCxJQUFJO0NBQ0osR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7Q0FDbkM7Q0FDQSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzVDLElBQUksSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3RHLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDN0MsS0FBSyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdkcsS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM5QyxNQUFNLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMs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Q0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU9HLGVBQU8sRUFBRSxVQUFVLEVBQUVBLGVBQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBT0EsZUFBTyxFQUFFLFVBQVUsRUFBRUEsZUFBTyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxZQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxVQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxHQUFHLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLFlBQVksS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLHdDQUF3QyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxvQkFBbUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLCtDQUErQyxDQUFDLHFDQUFxQyxDQUFDLGtEQUFrRCxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxPQUFPLE9BQU8sQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsUUFBUSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUMsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxnQkFBZ0IsQ0FBQyxTQUFTLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBQyxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsT0FBTyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFVBQVUsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFFBQVEsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFFBQVEsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksVUFBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsR0FBRyxZQUFZLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBSyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEdBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBRyxJQUFJLEVBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLDRCQUE0QixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxBQUFtQixJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQUssQ0FBQyxDQUFDLE9BQU8sTUFBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFDLENBQUMsU0FBUyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFDLENBQUMsU0FBUyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLEdBQUcsU0FBUyxHQUFHLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLE1BQU0sUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBSyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsTUFBTSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsRUFBRSxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLEFBQXdCLElBQUksU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxjQUFjLENBQUMsRUFBRSxDQUFDLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsQUFBYSxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxJQUFJLGNBQWMsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxRQUFRLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksUUFBUSxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBUyxDQUFDLFNBQVMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQVksQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxXQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsU0FBUyxDQUFDLE9BQU8sV0FBVyxDQUFDLFNBQVMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsR0FBRyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVMsQ0FBQyxTQUFTLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxXQUFXLENBQUMsR0FBRyxFQUFFLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsUUFBUSxHQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsU0FBUyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsNkZBQTZGLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksR0FBRyxJQUFJLE1BQU0sQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUMsQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLEdBQUcsR0FBRyxHQUFHLE9BQU8sRUFBRSxHQUFHLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxhQUFhLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUMsQ0FBQyxHQUFHLE9BQU8sU0FBUyxHQUFHLFdBQVcsRUFBRSxTQUFTLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sd0JBQXdCLEdBQUcsV0FBVyxFQUFFLHdCQUF3QixHQUFHLElBQUksRUFBRSxLQUFLLFlBQVksd0JBQXdCLEVBQUUsT0FBTyxxQkFBcUIsR0FBRyxXQUFXLEVBQUUscUJBQXFCLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSxxQkFBcUIsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFLLENBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQU0sVUFBVSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE9BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxTQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBQyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxZQUFZLEVBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxHQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsTUFBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsR0FBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEtBQUssQ0FB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QUUsV0FBVyxDQUFDO0NBQzdFO0NBQ0EsUUFBUSxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDO0NBQy9ELFFBQVEsSUFBSSxLQUFLLEdBQUcsV0FBVyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7O0NBRXhDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDOztDQUU1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQzs7Q0FFNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7O0NBRTVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM3QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDOztDQUU3QyxRQUFRLElBQUksY0FBYyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztDQUM3RCxR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TSxJQUFJLFNBQVMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztDQUNwSCxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDOztDQUVqSDtDQUNBLFlBQVksSUFBSSxFQUFFLEdBQUcsU0FBUyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7Q0FDN0MsWUFBWSxJQUFJLEVBQUUsR0FBRyxTQUFTLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQztDQUM3QyxZQUFZLElBQUksRUFBRSxHQUFHLFNBQVMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO0NBQzdDLFlBQVksNEJBQTRCLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0NBQ3BGLFNBQVM7O0NBRVQ7Q0FDQSxRQUFRLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDbkMsWUFBWSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDdEIsWUFBWSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksNEJBQTRCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLDRCQUE0QixDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQy9GO0NBQ0EsZ0JBQWdCLElBQUksSUFBSSxHQUFH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QUksQ0FBQyxDQUFDLENBQUMsQ0FBQzs7Q0FFWjtDQUNBO0NBQ0EsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDOztDQUV2QjtDQUNBLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLEtBQUssSUFBSTtDQUNUO0NBQ0EsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLEtBQUssY0FBYyxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQzFCLEtBQUs7O0NBRUw7Q0FDQSxJQUFJLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3BDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxLQUFLLElBQUk7Q0FDVDtDQUNBLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxLQUFLLGNBQWMsSUFBSSxDQUFDLENBQUMsQ0FBQztDQUMxQixLQUFLOztDQUVMO0NBQ0E7Q0FDQSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDbEo7Q0FDQSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0NBRWxKO0NBQ0EsSUFBSSxTQUFTLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztDQUMxRCxJQUFJLFNBQVMsQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLENBQUM7Q0FDN0M7Q0FDQSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQztDQUNwRSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FB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
