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
			return x.constructor === Array;
		}
		static isObject(x){
			return x.constructor === Object;
		}
		static arrayCopy(x){
			return x.slice();
		}
		static isFunction(x){
			return x.constructor === Function;
		}
		static isNumber(x){
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
		let rendererOptions = { antialias: true};

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
			this.material.transparent = (opacity < 1) || (!this.showSolid);
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
	            elemsToDisplayOnlyOnThisSlide[i].style.pointerEvents = 'all';
	        }

	        //items with class exp-slide
	        if(slideNumber < this.slides.length){
	            this.slides[slideNumber].style.opacity = 1;
	            this.slides[slideNumber].style.pointerEvents = 'all';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9IaXN0b3J5UmVjb3JkZXIuanMiLCIuLi9zcmMvanMvVGhyZWVFbnZpcm9ubWVudC5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL291dHB1dHMvTGluZU91dHB1dFNoYWRlcnMuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9MaW5lT3V0cHV0LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvUG9pbnRPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9WZWN0b3JPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9TdXJmYWNlT3V0cHV0U2hhZGVycy5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1N1cmZhY2VPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9GbGF0QXJyYXlPdXRwdXQuanMiLCIuLi9zcmMvanMvRGlyZWN0b3JJbWFnZUNvbnN0YW50cy5qcyIsIi4uL3NyYy9qcy9EaXJlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBUaGUgYmFzZSBjbGFzcyB0aGF0IGV2ZXJ5dGhpbmcgaW5oZXJpdHMgZnJvbS4gXG5cdEVhY2ggdGhpbmcgZHJhd24gdG8gdGhlIHNjcmVlbiBpcyBhIHRyZWUuIERvbWFpbnMsIHN1Y2ggYXMgRVhQLkFyZWEgb3IgRVhQLkFycmF5IGFyZSB0aGUgcm9vdCBub2Rlcyxcblx0RVhQLlRyYW5zZm9ybWF0aW9uIGlzIGN1cnJlbnRseSB0aGUgb25seSBpbnRlcm1lZGlhdGUgbm9kZSwgYW5kIHRoZSBsZWFmIG5vZGVzIGFyZSBzb21lIGZvcm0gb2YgT3V0cHV0IHN1Y2ggYXNcblx0RVhQLkxpbmVPdXRwdXQgb3IgRVhQLlBvaW50T3V0cHV0LCBvciBFWFAuVmVjdG9yT3V0cHV0LlxuXG5cdEFsbCBvZiB0aGVzZSBjYW4gYmUgLmFkZCgpZWQgdG8gZWFjaCBvdGhlciB0byBmb3JtIHRoYXQgdHJlZSwgYW5kIHRoaXMgZmlsZSBkZWZpbmVzIGhvdyBpdCB3b3Jrcy5cbiovXG5cbmNsYXNzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKCl7ICAgICAgICBcblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsOyAgICAgICAgXG4gICAgfVxuXHRhZGQodGhpbmcpe1xuXHRcdC8vY2hhaW5hYmxlIHNvIHlvdSBjYW4gYS5hZGQoYikuYWRkKGMpIHRvIG1ha2UgYS0+Yi0+Y1xuXHRcdHRoaXMuY2hpbGRyZW4ucHVzaCh0aGluZyk7XG5cdFx0dGhpbmcucGFyZW50ID0gdGhpcztcblx0XHRpZih0aGluZy5fb25BZGQpdGhpbmcuX29uQWRkKCk7XG5cdFx0cmV0dXJuIHRoaW5nO1xuXHR9XG5cdF9vbkFkZCgpe31cblx0cmVtb3ZlKHRoaW5nKXtcblx0XHR2YXIgaW5kZXggPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoIHRoaW5nICk7XG5cdFx0aWYgKCBpbmRleCAhPT0gLSAxICkge1xuXHRcdFx0dGhpbmcucGFyZW50ID0gbnVsbDtcblx0XHRcdHRoaXMuY2hpbGRyZW4uc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuICAgIGdldFRvcFBhcmVudCgpeyAvL2ZpbmQgdGhlIHBhcmVudCBvZiB0aGUgcGFyZW50IG9mIHRoZS4uLiB1bnRpbCB0aGVyZSdzIG5vIG1vcmUgcGFyZW50cy5cbiAgICAgICAgY29uc3QgTUFYX0NIQUlOID0gMTAwO1xuICAgICAgICBsZXQgcGFyZW50Q291bnQgPSAwO1xuXHRcdGxldCByb290ID0gdGhpcztcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmIHBhcmVudENvdW50IDwgTUFYX0NIQUlOKXtcblx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcbiAgICAgICAgICAgIHBhcmVudENvdW50Kz0gMTtcblx0XHR9XG5cdFx0aWYocGFyZW50Q291bnQgPj0gTUFYX0NIQUlOKXRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIHRvcC1sZXZlbCBwYXJlbnQhXCIpO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9XG4gICAgZ2V0RGVlcGVzdENoaWxkcmVuKCl7IC8vZmluZCBhbGwgbGVhZiBub2RlcyBmcm9tIHRoaXMgbm9kZVxuICAgICAgICAvL3RoaXMgYWxnb3JpdGhtIGNhbiBwcm9iYWJseSBiZSBpbXByb3ZlZFxuICAgICAgICBpZih0aGlzLmNoaWxkcmVuLmxlbmd0aCA9PSAwKXJldHVybiBbdGhpc107XG5cbiAgICAgICAgbGV0IGNoaWxkcmVuID0gW107XG4gICAgICAgIGZvcihsZXQgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGxldCBjaGlsZHNDaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW5baV0uZ2V0RGVlcGVzdENoaWxkcmVuKCk7XG4gICAgICAgICAgICBmb3IobGV0IGo9MDtqPGNoaWxkc0NoaWxkcmVuLmxlbmd0aDtqKyspe1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goY2hpbGRzQ2hpbGRyZW5bal0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG4gICAgZ2V0Q2xvc2VzdERvbWFpbigpe1xuICAgICAgICAvKiBGaW5kIHRoZSBEb21haW5Ob2RlIHRoYXQgdGhpcyBOb2RlIGlzIGJlaW5nIGNhbGxlZCBmcm9tLlxuICAgICAgICBUcmF2ZXJzZSB0aGUgY2hhaW4gb2YgcGFyZW50cyB1cHdhcmRzIHVudGlsIHdlIGZpbmQgYSBEb21haW5Ob2RlLCBhdCB3aGljaCBwb2ludCB3ZSByZXR1cm4gaXQuXG4gICAgICAgIFRoaXMgYWxsb3dzIGFuIG91dHB1dCB0byByZXNpemUgYW4gYXJyYXkgdG8gbWF0Y2ggYSBkb21haW5Ob2RlJ3MgbnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBmb3IgZXhhbXBsZS5cblxuICAgICAgICBOb3RlIHRoYXQgdGhpcyByZXR1cm5zIHRoZSBNT1NUIFJFQ0VOVCBEb21haW5Ob2RlIGFuY2VzdG9yIC0gaXQncyBhc3N1bWVkIHRoYXQgZG9tYWlubm9kZXMgb3ZlcndyaXRlIG9uZSBhbm90aGVyLlxuICAgICAgICAqL1xuICAgICAgICBjb25zdCBNQVhfQ0hBSU4gPSAxMDA7XG4gICAgICAgIGxldCBwYXJlbnRDb3VudCA9IDA7XG5cdFx0bGV0IHJvb3QgPSB0aGlzLnBhcmVudDsgLy9zdGFydCBvbmUgbGV2ZWwgdXAgaW4gY2FzZSB0aGlzIGlzIGEgRG9tYWluTm9kZSBhbHJlYWR5LiB3ZSBkb24ndCB3YW50IHRoYXRcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmICFyb290LmlzRG9tYWluTm9kZSAmJiBwYXJlbnRDb3VudCA8IE1BWF9DSEFJTil7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG4gICAgICAgICAgICBwYXJlbnRDb3VudCs9IDE7XG5cdFx0fVxuXHRcdGlmKHBhcmVudENvdW50ID49IE1BWF9DSEFJTil0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBwYXJlbnQhXCIpO1xuICAgICAgICBpZihyb290ID09PSBudWxsIHx8ICFyb290LmlzRG9tYWluTm9kZSl0aHJvdyBuZXcgRXJyb3IoXCJObyBEb21haW5Ob2RlIHBhcmVudCBmb3VuZCFcIik7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH1cblxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblx0XHQvL2J1dCBjYWxsIGFsbCBjaGlsZHJlblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0ub25BZnRlckFjdGl2YXRpb24oKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgT3V0cHV0Tm9kZSBleHRlbmRzIE5vZGV7IC8vbW9yZSBvZiBhIGphdmEgaW50ZXJmYWNlLCByZWFsbHlcblx0Y29uc3RydWN0b3IoKXtzdXBlcigpO31cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope31cblx0b25BZnRlckFjdGl2YXRpb24oKXt9XG5cdF9vbkFkZCgpe31cbn1cblxuY2xhc3MgRG9tYWluTm9kZSBleHRlbmRzIE5vZGV7IC8vQSBub2RlIHRoYXQgY2FsbHMgb3RoZXIgZnVuY3Rpb25zIG92ZXIgc29tZSByYW5nZS5cblx0Y29uc3RydWN0b3IoKXtcbiAgICAgICAgc3VwZXIoKTtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSBudWxsOyAvLyBudW1iZXIgb2YgdGltZXMgYW55IGNoaWxkIG5vZGUncyBldmFsdWF0ZVNlbGYoKSBpcyBjYWxsZWRcbiAgICB9XG4gICAgYWN0aXZhdGUodCl7fVxufVxuRG9tYWluTm9kZS5wcm90b3R5cGUuaXNEb21haW5Ob2RlID0gdHJ1ZTtcblxuZXhwb3J0IGRlZmF1bHQgTm9kZTtcbmV4cG9ydCB7T3V0cHV0Tm9kZSwgRG9tYWluTm9kZX07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9ICBmcm9tICcuL05vZGUuanMnO1xuY2xhc3MgRVhQQXJyYXkgZXh0ZW5kcyBEb21haW5Ob2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHRzdXBlcigpO1xuXHRcdC8qdmFyIHBvaW50cyA9IG5ldyBFWFAuQXJyYXkoe1xuXHRcdGRhdGE6IFtbLTEwLDEwXSxcblx0XHRcdFsxMCwxMF1dXG5cdFx0fSkqL1xuXG5cdFx0RVhQLlV0aWxzLmFzc2VydFByb3BFeGlzdHMob3B0aW9ucywgXCJkYXRhXCIpOyAvLyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXkuIGFzc3VtZWQgdG8gb25seSBjb250YWluIG9uZSB0eXBlOiBlaXRoZXIgbnVtYmVycyBvciBhcnJheXNcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmRhdGEsIEFycmF5KTtcblxuXHRcdC8vSXQncyBhc3N1bWVkIGFuIEVYUC5BcnJheSB3aWxsIG9ubHkgc3RvcmUgdGhpbmdzIHN1Y2ggYXMgMCwgWzBdLCBbMCwwXSBvciBbMCwwLDBdLiBJZiBhbiBhcnJheSB0eXBlIGlzIHN0b3JlZCwgdGhpcy5hcnJheVR5cGVEaW1lbnNpb25zIGNvbnRhaW5zIHRoZSAubGVuZ3RoIG9mIHRoYXQgYXJyYXkuIE90aGVyd2lzZSBpdCdzIDAsIGJlY2F1c2UgcG9pbnRzIGFyZSAwLWRpbWVuc2lvbmFsLlxuXHRcdGlmKG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3RvciA9PT0gTnVtYmVyKXtcblx0XHRcdHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyA9IDA7XG5cdFx0fWVsc2UgaWYob3B0aW9ucy5kYXRhWzBdLmNvbnN0cnVjdG9yID09PSBBcnJheSl7XG5cdFx0XHR0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPSBvcHRpb25zLmRhdGFbMF0ubGVuZ3RoO1xuXHRcdH1lbHNle1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkRhdGEgaW4gYW4gRVhQLkFycmF5IHNob3VsZCBiZSBhIG51bWJlciBvciBhbiBhcnJheSBvZiBvdGhlciB0aGluZ3MsIG5vdCBcIiArIG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3Rvcik7XG5cdFx0fVxuXG5cblx0XHRFWFAuVXRpbHMuYXNzZXJ0KG9wdGlvbnMuZGF0YVswXS5sZW5ndGggIT0gMCk7IC8vZG9uJ3QgYWNjZXB0IFtbXV0sIGRhdGEgbmVlZHMgdG8gYmUgc29tZXRoaW5nIGxpa2UgW1sxLDJdXS5cblxuXHRcdHRoaXMuZGF0YSA9IG9wdGlvbnMuZGF0YTtcblx0XHR0aGlzLm51bUl0ZW1zID0gdGhpcy5kYXRhLmxlbmd0aDtcblxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbdGhpcy5kYXRhLmxlbmd0aF07IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdC8vdGhlIG51bWJlciBvZiB0aW1lcyBldmVyeSBjaGlsZCdzIGV4cHIgaXMgY2FsbGVkXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSB0aGlzLml0ZW1EaW1lbnNpb25zLnJlZHVjZSgoc3VtLHkpPT5zdW0qeSk7XG5cdH1cblx0YWN0aXZhdGUodCl7XG5cdFx0aWYodGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID09IDApe1xuXHRcdFx0Ly9udW1iZXJzIGNhbid0IGJlIHNwcmVhZCB1c2luZyAuLi4gb3BlcmF0b3Jcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5kYXRhLmxlbmd0aDtpKyspe1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaSx0LHRoaXMuZGF0YVtpXSk7XG5cdFx0XHR9XG5cdFx0fWVsc2V7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuZGF0YS5sZW5ndGg7aSsrKXtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGksdCwuLi50aGlzLmRhdGFbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMub25BZnRlckFjdGl2YXRpb24oKTsgLy8gY2FsbCBjaGlsZHJlbiBpZiBuZWNlc3Nhcnlcblx0fVxuXHRfY2FsbEFsbENoaWxkcmVuKC4uLmNvb3JkaW5hdGVzKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcylcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgY2xvbmUgPSBuZXcgRVhQLkFycmF5KHtkYXRhOiBFWFAuVXRpbHMuYXJyYXlDb3B5KHRoaXMuZGF0YSl9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RBcnJheSgpe1xuXHR2YXIgeCA9IG5ldyBFWFAuQXJyYXkoe2RhdGE6IFtbMCwxXSxbMCwxXV19KTtcblx0dmFyIHkgPSBuZXcgRVhQLlRyYW5zZm9ybWF0aW9uKHtleHByOiBmdW5jdGlvbiguLi5hKXtjb25zb2xlLmxvZyguLi5hKTsgcmV0dXJuIFsyXX19KTtcblx0eC5hZGQoeSk7XG5cdHguYWN0aXZhdGUoNTEyKTtcbn1cblxuZXhwb3J0IHtFWFBBcnJheSBhcyBBcnJheX07XG4iLCJmdW5jdGlvbiBtdWx0aXBseVNjYWxhcihjLCBhcnJheSl7XG5cdGZvcih2YXIgaT0wO2k8YXJyYXkubGVuZ3RoO2krKyl7XG5cdFx0YXJyYXlbaV0gKj0gYztcblx0fVxuXHRyZXR1cm4gYXJyYXlcbn1cbmZ1bmN0aW9uIHZlY3RvckFkZCh2MSx2Mil7XG4gICAgbGV0IHZlYyA9IGNsb25lKHYxKTtcblx0Zm9yKHZhciBpPTA7aTx2MS5sZW5ndGg7aSsrKXtcblx0XHR2ZWNbaV0gKz0gdjJbaV07XG5cdH1cblx0cmV0dXJuIHZlY1xufVxuZnVuY3Rpb24gdmVjdG9yU3ViKHYxLHYyKXtcbiAgICBsZXQgdmVjID0gY2xvbmUodjEpO1xuXHRmb3IodmFyIGk9MDtpPHYxLmxlbmd0aDtpKyspe1xuXHRcdHZlY1tpXSArPSB2MltpXTtcblx0fVxuXHRyZXR1cm4gdmVjXG59XG5mdW5jdGlvbiBsZXJwVmVjdG9ycyh0LCBwMSwgcDIpe1xuXHQvL2Fzc3VtZWQgdCBpbiBbMCwxXVxuXHRyZXR1cm4gdmVjdG9yQWRkKG11bHRpcGx5U2NhbGFyKHQsY2xvbmUocDEpKSxtdWx0aXBseVNjYWxhcigxLXQsY2xvbmUocDIpKSk7XG59XG5mdW5jdGlvbiBjbG9uZSh2ZWMpe1xuXHR2YXIgbmV3QXJyID0gbmV3IEFycmF5KHZlYy5sZW5ndGgpO1xuXHRmb3IodmFyIGk9MDtpPHZlYy5sZW5ndGg7aSsrKXtcblx0XHRuZXdBcnJbaV0gPSB2ZWNbaV07XG5cdH1cblx0cmV0dXJuIG5ld0FyclxufVxuZnVuY3Rpb24gbXVsdGlwbHlNYXRyaXgodmVjLCBtYXRyaXgpe1xuXHQvL2Fzc2VydCB2ZWMubGVuZ3RoID09IG51bVJvd3NcblxuXHRsZXQgbnVtUm93cyA9IG1hdHJpeC5sZW5ndGg7XG5cdGxldCBudW1Db2xzID0gbWF0cml4WzBdLmxlbmd0aDtcblxuXHR2YXIgb3V0cHV0ID0gbmV3IEFycmF5KG51bUNvbHMpO1xuXHRmb3IodmFyIGo9MDtqPG51bUNvbHM7aisrKXtcblx0XHRvdXRwdXRbal0gPSAwO1xuXHRcdGZvcih2YXIgaT0wO2k8bnVtUm93cztpKyspe1xuXHRcdFx0b3V0cHV0W2pdICs9IG1hdHJpeFtpXVtqXSAqIHZlY1tpXTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIG91dHB1dDtcbn1cblxuLy9oYWNrXG5sZXQgTWF0aCA9IHtjbG9uZTogY2xvbmUsIGxlcnBWZWN0b3JzOiBsZXJwVmVjdG9ycywgdmVjdG9yQWRkOiB2ZWN0b3JBZGQsIHZlY3RvclN1YjogdmVjdG9yU3ViLCBtdWx0aXBseVNjYWxhcjogbXVsdGlwbHlTY2FsYXIsIG11bHRpcGx5TWF0cml4OiBtdWx0aXBseU1hdHJpeH07XG5cbmV4cG9ydCB7dmVjdG9yQWRkLCB2ZWN0b3JTdWIsIGxlcnBWZWN0b3JzLCBjbG9uZSwgbXVsdGlwbHlTY2FsYXIsIG11bHRpcGx5TWF0cml4LCBNYXRofTtcbiIsImltcG9ydCB7Y2xvbmV9IGZyb20gJy4vbWF0aC5qcydcblxuY2xhc3MgVXRpbHN7XG5cblx0c3RhdGljIGlzQXJyYXkoeCl7XG5cdFx0cmV0dXJuIHguY29uc3RydWN0b3IgPT09IEFycmF5O1xuXHR9XG5cdHN0YXRpYyBpc09iamVjdCh4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0O1xuXHR9XG5cdHN0YXRpYyBhcnJheUNvcHkoeCl7XG5cdFx0cmV0dXJuIHguc2xpY2UoKTtcblx0fVxuXHRzdGF0aWMgaXNGdW5jdGlvbih4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gRnVuY3Rpb247XG5cdH1cblx0c3RhdGljIGlzTnVtYmVyKHgpe1xuXHRcdHJldHVybiB4LmNvbnN0cnVjdG9yID09PSBOdW1iZXI7XG5cdH1cblxuXHRzdGF0aWMgYXNzZXJ0KHRoaW5nKXtcblx0XHQvL0EgZnVuY3Rpb24gdG8gY2hlY2sgaWYgc29tZXRoaW5nIGlzIHRydWUgYW5kIGhhbHQgb3RoZXJ3aXNlIGluIGEgY2FsbGJhY2thYmxlIHdheS5cblx0XHRpZighdGhpbmcpe1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBBc3NlcnRpb24gZmFpbGVkLiBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcbiAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcblx0XHR9XG5cdH1cblxuXHRzdGF0aWMgYXNzZXJ0VHlwZSh0aGluZywgdHlwZSwgZXJyb3JNc2cpe1xuXHRcdC8vQSBmdW5jdGlvbiB0byBjaGVjayBpZiBzb21ldGhpbmcgaXMgdHJ1ZSBhbmQgaGFsdCBvdGhlcndpc2UgaW4gYSBjYWxsYmFja2FibGUgd2F5LlxuXHRcdGlmKCEodGhpbmcuY29uc3RydWN0b3IgPT09IHR5cGUpKXtcblx0XHRcdGlmKGVycm9yTXNnKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBTb21ldGhpbmcgbm90IG9mIHJlcXVpcmVkIHR5cGUgXCIrdHlwZS5uYW1lK1wiISBcXG5cIitlcnJvck1zZytcIlxcbiBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFNvbWV0aGluZyBub3Qgb2YgcmVxdWlyZWQgdHlwZSBcIit0eXBlLm5hbWUrXCIhIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdFx0fVxuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuXHRcdH1cblx0fVxuXG5cblx0c3RhdGljIGFzc2VydFByb3BFeGlzdHModGhpbmcsIG5hbWUpe1xuXHRcdGlmKCF0aGluZyB8fCAhKG5hbWUgaW4gdGhpbmcpKXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgXCIrbmFtZStcIiBub3QgcHJlc2VudCBpbiByZXF1aXJlZCBwcm9wZXJ0eVwiKTtcbiAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcblx0XHR9XG5cdH1cblx0XG5cdHN0YXRpYyBjbG9uZSh2ZWMpe1xuXHRcdHJldHVybiBjbG9uZSh2ZWMpO1xuXHR9XG5cblxuXHRzdGF0aWMgaXMxRE51bWVyaWNBcnJheSh2ZWMpe1xuICAgICAgICBpZighVXRpbHMuaXNBcnJheSh2ZWMpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGZvcihsZXQgaT0wO2k8dmVjLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgaWYoIVV0aWxzLmlzTnVtYmVyKHZlY1tpXSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcblx0fVxuXG59XG5cbmV4cG9ydCB7VXRpbHN9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyBEb21haW5Ob2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcblxuY2xhc3MgQXJlYSBleHRlbmRzIERvbWFpbk5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvKnZhciBheGVzID0gbmV3IEVYUC5BcmVhKHtcblx0XHRib3VuZHM6IFtbLTEwLDEwXSxcblx0XHRcdFsxMCwxMF1dXG5cdFx0bnVtSXRlbXM6IDEwOyAvL29wdGlvbmFsLiBBbHRlcm5hdGVseSBudW1JdGVtcyBjYW4gdmFyeSBmb3IgZWFjaCBheGlzOiBudW1JdGVtczogWzEwLDJdXG5cdFx0fSkqL1xuXG5cblx0XG5cdFx0VXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyhvcHRpb25zLCBcImJvdW5kc1wiKTsgLy8gYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5XG5cdFx0VXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmJvdW5kcywgQXJyYXkpO1xuXHRcdFV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5ib3VuZHNbMF0sIEFycmF5LCBcIkZvciBhbiBBcmVhLCBvcHRpb25zLmJvdW5kcyBtdXN0IGJlIGEgbXVsdGlkaW1lbnNpb25hbCBhcnJheSwgZXZlbiBmb3Igb25lIGRpbWVuc2lvbiFcIik7IC8vIGl0IE1VU1QgYmUgbXVsdGlkaW1lbnNpb25hbFxuXHRcdHRoaXMubnVtRGltZW5zaW9ucyA9IG9wdGlvbnMuYm91bmRzLmxlbmd0aDtcblxuXHRcdFV0aWxzLmFzc2VydChvcHRpb25zLmJvdW5kc1swXS5sZW5ndGggIT0gMCk7IC8vZG9uJ3QgYWNjZXB0IFtbXV0sIGl0IG5lZWRzIHRvIGJlIFtbMSwyXV0uXG5cblx0XHR0aGlzLmJvdW5kcyA9IG9wdGlvbnMuYm91bmRzO1xuXHRcdHRoaXMubnVtSXRlbXMgPSBvcHRpb25zLm51bUl0ZW1zIHx8IDE2O1xuXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBhcnJheSB0byBzdG9yZSB0aGUgbnVtYmVyIG9mIHRpbWVzIHRoaXMgaXMgY2FsbGVkIHBlciBkaW1lbnNpb24uXG5cblx0XHRpZih0aGlzLm51bUl0ZW1zLmNvbnN0cnVjdG9yID09PSBOdW1iZXIpe1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bURpbWVuc2lvbnM7aSsrKXtcblx0XHRcdFx0dGhpcy5pdGVtRGltZW5zaW9ucy5wdXNoKHRoaXMubnVtSXRlbXMpO1xuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtSXRlbXMuY29uc3RydWN0b3IgPT09IEFycmF5KXtcblx0XHRcdFV0aWxzLmFzc2VydChvcHRpb25zLm51bUl0ZW1zLmxlbmd0aCA9PSBvcHRpb25zLmJvdW5kcy5sZW5ndGgpO1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bURpbWVuc2lvbnM7aSsrKXtcblx0XHRcdFx0dGhpcy5pdGVtRGltZW5zaW9ucy5wdXNoKHRoaXMubnVtSXRlbXNbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vdGhlIG51bWJlciBvZiB0aW1lcyBldmVyeSBjaGlsZCdzIGV4cHIgaXMgY2FsbGVkXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSB0aGlzLml0ZW1EaW1lbnNpb25zLnJlZHVjZSgoc3VtLHkpPT5zdW0qeSk7XG5cdH1cblx0YWN0aXZhdGUodCl7XG5cdFx0Ly9Vc2UgdGhpcyB0byBldmFsdWF0ZSBleHByKCkgYW5kIHVwZGF0ZSB0aGUgcmVzdWx0LCBjYXNjYWRlLXN0eWxlLlxuXHRcdC8vdGhlIG51bWJlciBvZiBib3VuZHMgdGhpcyBvYmplY3QgaGFzIHdpbGwgYmUgdGhlIG51bWJlciBvZiBkaW1lbnNpb25zLlxuXHRcdC8vdGhlIGV4cHIoKXMgYXJlIGNhbGxlZCB3aXRoIGV4cHIoaSwgLi4uW2Nvb3JkaW5hdGVzXSwgdCksIFxuXHRcdC8vXHQod2hlcmUgaSBpcyB0aGUgaW5kZXggb2YgdGhlIGN1cnJlbnQgZXZhbHVhdGlvbiA9IHRpbWVzIGV4cHIoKSBoYXMgYmVlbiBjYWxsZWQgdGhpcyBmcmFtZSwgdCA9IGFic29sdXRlIHRpbWVzdGVwIChzKSkuXG5cdFx0Ly9wbGVhc2UgY2FsbCB3aXRoIGEgdCB2YWx1ZSBvYnRhaW5lZCBmcm9tIHBlcmZvcm1hbmNlLm5vdygpLzEwMDAgb3Igc29tZXRoaW5nIGxpa2UgdGhhdFxuXG5cdFx0Ly9ub3RlIHRoZSBsZXNzLXRoYW4tb3ItZXF1YWwtdG8gaW4gdGhlc2UgbG9vcHNcblx0XHRpZih0aGlzLm51bURpbWVuc2lvbnMgPT0gMSl7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0bGV0IGluZGV4ID0gaTtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsMCwwLDApO1xuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAyKXtcblx0XHRcdC8vdGhpcyBjYW4gYmUgcmVkdWNlZCBpbnRvIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSBvdmVyIHRoZSBmaXJzdCBpbmRleCBvZiB0aGlzLmJvdW5kcywgSSBrbm93IGl0XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0Zm9yKHZhciBqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzFdO2orKyl7XG5cdFx0XHRcdFx0bGV0IGMyID0gdGhpcy5ib3VuZHNbMV1bMF0gKyAodGhpcy5ib3VuZHNbMV1bMV0tdGhpcy5ib3VuZHNbMV1bMF0pKihqLyh0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTEpKTtcblx0XHRcdFx0XHRsZXQgaW5kZXggPSBpKnRoaXMuaXRlbURpbWVuc2lvbnNbMV0gKyBqO1xuXHRcdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpbmRleCx0LGMxLGMyLDAsMCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ZWxzZSBpZih0aGlzLm51bURpbWVuc2lvbnMgPT0gMyl7XG5cdFx0XHQvL3RoaXMgY2FuIGJlIHJlZHVjZWQgaW50byBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgb3ZlciB0aGUgZmlyc3QgaW5kZXggb2YgdGhpcy5ib3VuZHMsIEkga25vdyBpdFxuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2krKyl7XG5cdFx0XHRcdGxldCBjMSA9IHRoaXMuYm91bmRzWzBdWzBdICsgKHRoaXMuYm91bmRzWzBdWzFdLXRoaXMuYm91bmRzWzBdWzBdKSooaS8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKSk7XG5cdFx0XHRcdGZvcih2YXIgaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtqKyspe1xuXHRcdFx0XHRcdGxldCBjMiA9IHRoaXMuYm91bmRzWzFdWzBdICsgKHRoaXMuYm91bmRzWzFdWzFdLXRoaXMuYm91bmRzWzFdWzBdKSooai8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKSk7XG5cdFx0XHRcdFx0Zm9yKHZhciBrPTA7azx0aGlzLml0ZW1EaW1lbnNpb25zWzJdO2srKyl7XG5cdFx0XHRcdFx0XHRsZXQgYzMgPSB0aGlzLmJvdW5kc1syXVswXSArICh0aGlzLmJvdW5kc1syXVsxXS10aGlzLmJvdW5kc1syXVswXSkqKGsvKHRoaXMuaXRlbURpbWVuc2lvbnNbMl0tMSkpO1xuXHRcdFx0XHRcdFx0bGV0IGluZGV4ID0gKGkqdGhpcy5pdGVtRGltZW5zaW9uc1sxXSArIGopKnRoaXMuaXRlbURpbWVuc2lvbnNbMl0gKyBrO1xuXHRcdFx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsYzIsYzMsMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fWVsc2V7XG5cdFx0XHRhc3NlcnQoXCJUT0RPOiBVc2UgYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIHRvIGxvb3Agb3ZlciBhbGwgaW5kaWNlcyFcIik7XG5cdFx0fVxuXG5cdFx0dGhpcy5vbkFmdGVyQWN0aXZhdGlvbigpOyAvLyBjYWxsIGNoaWxkcmVuIGlmIG5lY2Vzc2FyeVxuXHR9XG5cdF9jYWxsQWxsQ2hpbGRyZW4oLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBBcmVhKHtib3VuZHM6IFV0aWxzLmFycmF5Q29weSh0aGlzLmJvdW5kcyksIG51bUl0ZW1zOiB0aGlzLm51bUl0ZW1zfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0XHRpZihjbG9uZS5jaGlsZHJlbltpXS5fb25BZGQpY2xvbmUuY2hpbGRyZW5baV0uX29uQWRkKCk7IC8vIG5lY2Vzc2FyeSBub3cgdGhhdCB0aGUgY2hhaW4gb2YgYWRkaW5nIGhhcyBiZWVuIGVzdGFibGlzaGVkXG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0QXJlYSgpe1xuXHR2YXIgeCA9IG5ldyBBcmVhKHtib3VuZHM6IFtbMCwxXSxbMCwxXV19KTtcblx0dmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpfX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSgpO1xufVxuXG5leHBvcnQgeyBBcmVhIH1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQgTm9kZSBmcm9tICcuL05vZGUuanMnO1xuXG4vL1VzYWdlOiB2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSl9fSk7XG5jbGFzcyBUcmFuc2Zvcm1hdGlvbiBleHRlbmRzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cdFxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZXhwclwiKTsgLy8gYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5XG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5leHByLCBGdW5jdGlvbik7XG5cblx0XHR0aGlzLmV4cHIgPSBvcHRpb25zLmV4cHI7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKXtcblx0XHQvL2V2YWx1YXRlIHRoaXMgVHJhbnNmb3JtYXRpb24ncyBfZXhwciwgYW5kIGJyb2FkY2FzdCB0aGUgcmVzdWx0IHRvIGFsbCBjaGlsZHJlbi5cblx0XHRsZXQgcmVzdWx0ID0gdGhpcy5leHByKC4uLmNvb3JkaW5hdGVzKTtcblx0XHRpZihyZXN1bHQuY29uc3RydWN0b3IgIT09IEFycmF5KXJlc3VsdCA9IFtyZXN1bHRdO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoY29vcmRpbmF0ZXNbMF0sY29vcmRpbmF0ZXNbMV0sIC4uLnJlc3VsdClcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgdGhpc0V4cHIgPSB0aGlzLmV4cHI7XG5cdFx0bGV0IGNsb25lID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiB0aGlzRXhwci5iaW5kKCl9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG5cdG1ha2VMaW5rKCl7XG4gICAgICAgIC8vbGlrZSBhIGNsb25lLCBidXQgd2lsbCB1c2UgdGhlIHNhbWUgZXhwciBhcyB0aGlzIFRyYW5zZm9ybWF0aW9uLlxuICAgICAgICAvL3VzZWZ1bCBpZiB0aGVyZSdzIGEgc3BlY2lmaWMgZnVuY3Rpb24gdGhhdCBuZWVkcyB0byBiZSB1c2VkIGJ5IGEgYnVuY2ggb2Ygb2JqZWN0c1xuXHRcdHJldHVybiBuZXcgTGlua2VkVHJhbnNmb3JtYXRpb24odGhpcyk7XG5cdH1cbn1cblxuY2xhc3MgTGlua2VkVHJhbnNmb3JtYXRpb24gZXh0ZW5kcyBOb2Rle1xuICAgIC8qXG4gICAgICAgIExpa2UgYW4gRVhQLlRyYW5zZm9ybWF0aW9uLCBidXQgaXQgdXNlcyBhbiBleGlzdGluZyBFWFAuVHJhbnNmb3JtYXRpb24ncyBleHByKCksIHNvIGlmIHRoZSBsaW5rZWQgdHJhbnNmb3JtYXRpb24gdXBkYXRlcywgc28gZG9lcyB0aGlzIG9uZS4gSXQncyBsaWtlIGEgcG9pbnRlciB0byBhIFRyYW5zZm9ybWF0aW9uLCBidXQgaW4gb2JqZWN0IGZvcm0uIFxuICAgICovXG5cdGNvbnN0cnVjdG9yKHRyYW5zZm9ybWF0aW9uVG9MaW5rVG8pe1xuXHRcdHN1cGVyKHt9KTtcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZSh0cmFuc2Zvcm1hdGlvblRvTGlua1RvLCBUcmFuc2Zvcm1hdGlvbik7XG4gICAgICAgIHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlID0gdHJhbnNmb3JtYXRpb25Ub0xpbmtUbztcblx0fVxuXHRldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGxldCByZXN1bHQgPSB0aGlzLmxpbmtlZFRyYW5zZm9ybWF0aW9uTm9kZS5leHByKC4uLmNvb3JkaW5hdGVzKTtcblx0XHRpZihyZXN1bHQuY29uc3RydWN0b3IgIT09IEFycmF5KXJlc3VsdCA9IFtyZXN1bHRdO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoY29vcmRpbmF0ZXNbMF0sY29vcmRpbmF0ZXNbMV0sIC4uLnJlc3VsdClcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgY2xvbmUgPSBuZXcgTGlua2VkVHJhbnNmb3JtYXRpb24odGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUpO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cblx0bWFrZUxpbmsoKXtcblx0XHRyZXR1cm4gbmV3IExpbmtlZFRyYW5zZm9ybWF0aW9uKHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlKTtcblx0fVxufVxuXG5cblxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0VHJhbnNmb3JtYXRpb24oKXtcblx0dmFyIHggPSBuZXcgQXJlYSh7Ym91bmRzOiBbWy0xMCwxMF1dfSk7XG5cdHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHsnZXhwcic6ICh4KSA9PiBjb25zb2xlLmxvZyh4KngpfSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKCk7IC8vIHNob3VsZCByZXR1cm4gMTAwLCA4MSwgNjQuLi4gMCwgMSwgNC4uLiAxMDBcbn1cblxuZXhwb3J0IHsgVHJhbnNmb3JtYXRpb24sIExpbmtlZFRyYW5zZm9ybWF0aW9ufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7IERvbWFpbk5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuXG5jbGFzcyBIaXN0b3J5UmVjb3JkZXIgZXh0ZW5kcyBEb21haW5Ob2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHRzdXBlcigpO1xuXG4gICAgICAgIC8qXG4gICAgICAgICAgICBDbGFzcyB0aGF0IHJlY29yZHMgdGhlIGxhc3QgZmV3IHZhbHVlcyBvZiB0aGUgcGFyZW50IFRyYW5zZm9ybWF0aW9uIGFuZCBtYWtlcyB0aGVtIGF2YWlsYWJsZSBmb3IgdXNlIGFzIGFuIGV4dHJhIGRpbWVuc2lvbi5cbiAgICAgICAgICAgIFVzYWdlOlxuICAgICAgICAgICAgdmFyIHJlY29yZGVyID0gbmV3IEhpc3RvcnlSZWNvcmRlcih7XG4gICAgICAgICAgICAgICAgbWVtb3J5TGVuZ3RoOiAxMCAvLyBob3cgbWFueSBwYXN0IHZhbHVlcyB0byBzdG9yZT9cbiAgICAgICAgICAgICAgICByZWNvcmRGcmFtZUludGVydmFsOiAxNS8vSG93IGxvbmcgdG8gd2FpdCBiZXR3ZWVuIGVhY2ggY2FwdHVyZT8gTWVhc3VyZWQgaW4gZnJhbWVzLCBzbyA2MCA9IDEgY2FwdHVyZSBwZXIgc2Vjb25kLCAzMCA9IDIgY2FwdHVyZXMvc2Vjb25kLCBldGMuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZXhhbXBsZSB1c2FnZTpcbiAgICAgICAgICAgIG5ldyBBcmVhKHtib3VuZHM6IFtbLTUsNV1dfSkuYWRkKG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogKGksdCx4KSA9PiBbTWF0aC5zaW4oeCksTWF0aC5jb3MoeCldfSkpLmFkZChuZXcgRVhQLkhpc3RvcnlSZWNvcmRlcih7bWVtb3J5TGVuZ3RoOiA1fSkuYWRkKG5ldyBMaW5lT3V0cHV0KHt3aWR0aDogNSwgY29sb3I6IDB4ZmYwMDAwfSkpO1xuXG4gICAgICAgICAgICBOT1RFOiBJdCBpcyBhc3N1bWVkIHRoYXQgYW55IHBhcmVudCB0cmFuc2Zvcm1hdGlvbiBvdXRwdXRzIGFuIGFycmF5IG9mIG51bWJlcnMgdGhhdCBpcyA0IG9yIGxlc3MgaW4gbGVuZ3RoLlxuICAgICAgICAqL1xuXG5cdFx0dGhpcy5tZW1vcnlMZW5ndGggPSBvcHRpb25zLm1lbW9yeUxlbmd0aCA9PT0gdW5kZWZpbmVkID8gMTAgOiBvcHRpb25zLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgdGhpcy5yZWNvcmRGcmFtZUludGVydmFsID0gb3B0aW9ucy5yZWNvcmRGcmFtZUludGVydmFsID09PSB1bmRlZmluZWQgPyAxNSA6IG9wdGlvbnMucmVjb3JkRnJhbWVJbnRlcnZhbDsgLy9zZXQgdG8gMSB0byByZWNvcmQgZXZlcnkgZnJhbWUuXG4gICAgICAgIHRoaXMuX291dHB1dERpbWVuc2lvbnMgPSA0OyAvL2hvdyBtYW55IGRpbWVuc2lvbnMgcGVyIHBvaW50IHRvIHN0b3JlPyAodG9kbzogYXV0b2RldGVjdCB0aGlzIGZyb20gcGFyZW50J3Mgb3V0cHV0KVxuXHRcdHRoaXMuY3VycmVudEhpc3RvcnlJbmRleD0wO1xuICAgICAgICB0aGlzLmZyYW1lUmVjb3JkVGltZXIgPSAwO1xuXHR9XG5cdF9vbkFkZCgpe1xuXHRcdC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBBcmVhXG5cdFx0bGV0IHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLm1lbW9yeUxlbmd0aDtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucy5jb25jYXQoW3RoaXMubWVtb3J5TGVuZ3RoXSk7XG5cbiAgICAgICAgdGhpcy5idWZmZXIgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG4gICAgXG4gICAgICAgIC8vVGhpcyBpcyBzbyB0aGF0IG5vIHN1cmZhY2UvYm91bmRhcnkgd2lsbCBhcHBlYXIgdW50aWwgaGlzdG9yeSBiZWdpbnMgdG8gYmUgcmVjb3JkZWQuIEknbSBzbyBzb3JyeS5cbiAgICAgICAgLy9Ub2RvOiBwcm9wZXIgY2xpcCBzaGFkZXIgbGlrZSBtYXRoYm94IGRvZXMgb3Igc29tZXRoaW5nLlxuICAgICAgICB0aGlzLmJ1ZmZlci5maWxsKE5hTik7IFxuXHR9XG4gICAgb25BZnRlckFjdGl2YXRpb24oKXtcbiAgICAgICAgc3VwZXIub25BZnRlckFjdGl2YXRpb24oKTtcblxuICAgICAgICAvL2V2ZXJ5IHNvIG9mdGVuLCBzaGlmdCB0byB0aGUgbmV4dCBidWZmZXIgc2xvdFxuICAgICAgICB0aGlzLmZyYW1lUmVjb3JkVGltZXIgKz0gMTtcbiAgICAgICAgaWYodGhpcy5mcmFtZVJlY29yZFRpbWVyID49IHRoaXMucmVjb3JkRnJhbWVJbnRlcnZhbCl7XG4gICAgICAgICAgICAvL3Jlc2V0IGZyYW1lIHJlY29yZCB0aW1lclxuICAgICAgICAgICAgdGhpcy5mcmFtZVJlY29yZFRpbWVyID0gMDtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCA9ICh0aGlzLmN1cnJlbnRIaXN0b3J5SW5kZXgrMSkldGhpcy5tZW1vcnlMZW5ndGg7XG4gICAgICAgIH1cbiAgICB9XG5cdGV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcyl7XG5cdFx0Ly9ldmFsdWF0ZSB0aGlzIFRyYW5zZm9ybWF0aW9uJ3MgX2V4cHIsIGFuZCBicm9hZGNhc3QgdGhlIHJlc3VsdCB0byBhbGwgY2hpbGRyZW4uXG5cdFx0bGV0IGkgPSBjb29yZGluYXRlc1swXTtcblx0XHRsZXQgdCA9IGNvb3JkaW5hdGVzWzFdO1xuICAgIFxuICAgICAgICAvL3N0ZXAgMTogc2F2ZSBjb29yZGluYXRlcyBmb3IgdGhpcyBmcmFtZSBpbiBidWZmZXJcbiAgICAgICAgaWYoY29vcmRpbmF0ZXMubGVuZ3RoID4gMit0aGlzLl9vdXRwdXREaW1lbnNpb25zKXtcbiAgICAgICAgICAgIC8vdG9kbzogbWFrZSB0aGlzIHVwZGF0ZSB0aGlzLl9vdXRwdXREaW1lbnNpb25zIGFuZCByZWFsbG9jYXRlIG1vcmUgYnVmZmVyIHNwYWNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFWFAuSGlzdG9yeVJlY29yZGVyIGlzIHVuYWJsZSB0byByZWNvcmQgaGlzdG9yeSBvZiBzb21ldGhpbmcgdGhhdCBvdXRwdXRzIGluIFwiK3RoaXMuX291dHB1dERpbWVuc2lvbnMrXCIgZGltZW5zaW9ucyEgWWV0LlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjeWNsaWNCdWZmZXJJbmRleCA9IChpKnRoaXMubWVtb3J5TGVuZ3RoK3RoaXMuY3VycmVudEhpc3RvcnlJbmRleCkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcbiAgICAgICAgZm9yKHZhciBqPTA7ajxjb29yZGluYXRlcy5sZW5ndGgtMjtqKyspeyBcbiAgICAgICAgICAgIHRoaXMuYnVmZmVyW2N5Y2xpY0J1ZmZlckluZGV4K2pdID0gY29vcmRpbmF0ZXNbMitqXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vc3RlcCAyOiwgY2FsbCBhbnkgY2hpbGRyZW4gb25jZSBwZXIgaGlzdG9yeSBpdGVtXG4gICAgICAgIGZvcih2YXIgY2hpbGRObz0wO2NoaWxkTm88dGhpcy5jaGlsZHJlbi5sZW5ndGg7Y2hpbGRObysrKXtcblx0XHQgICAgZm9yKHZhciBqPTA7ajx0aGlzLm1lbW9yeUxlbmd0aDtqKyspe1xuXG4gICAgICAgICAgICAgICAgLy90aGUgKzEgaW4gKGogKyB0aGlzLmN1cnJlbnRIaXN0b3J5SW5kZXggKyAxKSBpcyBpbXBvcnRhbnQ7IHdpdGhvdXQgaXQsIGEgTGluZU91dHB1dCB3aWxsIGRyYXcgYSBsaW5lIGZyb20gdGhlIG1vc3QgcmVjZW50IHZhbHVlIHRvIHRoZSBlbmQgb2YgaGlzdG9yeVxuICAgICAgICAgICAgICAgIGxldCBjeWNsaWNIaXN0b3J5VmFsdWUgPSAoaiArIHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCArIDEpICUgdGhpcy5tZW1vcnlMZW5ndGg7XG4gICAgICAgICAgICAgICAgbGV0IGN5Y2xpY0J1ZmZlckluZGV4ID0gKGkgKiB0aGlzLm1lbW9yeUxlbmd0aCArIGN5Y2xpY0hpc3RvcnlWYWx1ZSkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcbiAgICAgICAgICAgICAgICBsZXQgbm9uQ3ljbGljSW5kZXggPSBpICogdGhpcy5tZW1vcnlMZW5ndGggKyBqO1xuXG5cdFx0ICAgICAgICAvL0knbSB0b3JuIG9uIHdoZXRoZXIgdG8gYWRkIGEgZmluYWwgY29vcmRpbmF0ZSBhdCB0aGUgZW5kIHNvIGhpc3RvcnkgY2FuIGdvIG9mZiBpbiBhIG5ldyBkaXJlY3Rpb24uXG4gICAgICAgICAgICAgICAgLy90aGlzLmNoaWxkcmVuW2NoaWxkTm9dLmV2YWx1YXRlU2VsZihub25DeWNsaWNJbmRleCx0LHRoaXMuYnVmZmVyW2N5Y2xpY0J1ZmZlckluZGV4XSwgY3ljbGljSGlzdG9yeVZhbHVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuW2NoaWxkTm9dLmV2YWx1YXRlU2VsZihcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vbkN5Y2xpY0luZGV4LHQsIC8vaSx0XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi50aGlzLmJ1ZmZlci5zbGljZShjeWNsaWNCdWZmZXJJbmRleCxjeWNsaWNCdWZmZXJJbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zKSAvL2V4dHJhY3QgY29vcmRpbmF0ZXMgZm9yIHRoaXMgaGlzdG9yeSB2YWx1ZSBmcm9tIGJ1ZmZlclxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBIaXN0b3J5UmVjb3JkZXIoe21lbW9yeUxlbmd0aDogdGhpcy5tZW1vcnlMZW5ndGgsIHJlY29yZEZyYW1lSW50ZXJ2YWw6IHRoaXMucmVjb3JkRnJhbWVJbnRlcnZhbH0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cbn1cblxuZXhwb3J0IHsgSGlzdG9yeVJlY29yZGVyIH1cbiIsInZhciB0aHJlZUVudmlyb25tZW50ID0gbnVsbDtcblxuZnVuY3Rpb24gc2V0VGhyZWVFbnZpcm9ubWVudChuZXdFbnYpe1xuICAgIHRocmVlRW52aXJvbm1lbnQgPSBuZXdFbnY7XG59XG5mdW5jdGlvbiBnZXRUaHJlZUVudmlyb25tZW50KCl7XG4gICAgcmV0dXJuIHRocmVlRW52aXJvbm1lbnQ7XG59XG5leHBvcnQge3NldFRocmVlRW52aXJvbm1lbnQsIGdldFRocmVlRW52aXJvbm1lbnQsIHRocmVlRW52aXJvbm1lbnR9O1xuIiwiaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuL3V0aWxzLmpzJztcblxuaW1wb3J0IHsgVHJhbnNmb3JtYXRpb24gfSBmcm9tICcuL1RyYW5zZm9ybWF0aW9uLmpzJztcblxuaW1wb3J0ICogYXMgbWF0aCBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgdGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmxldCBFUFMgPSBOdW1iZXIuRVBTSUxPTjtcblxuY29uc3QgRWFzaW5nID0ge0Vhc2VJbk91dDoxLEVhc2VJbjoyLEVhc2VPdXQ6M307XG5cbmNsYXNzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHRoaXMudG9WYWx1ZSA9IHRvVmFsdWU7XG4gICAgICAgIHRoaXMuZnJvbVZhbHVlID0gZnJvbVZhbHVlO1xuICAgICAgICB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbiA9IGludGVycG9sYXRpb25GdW5jdGlvbjtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7fSAvL3BlcmNlbnRhZ2UgaXMgMC0xIGxpbmVhcmx5XG59XG5jbGFzcyBOdW1iZXJJbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuXHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG5cdFx0cmV0dXJuIHQqdGhpcy50b1ZhbHVlICsgKDEtdCkqdGhpcy5mcm9tVmFsdWU7XG4gICAgfVxufVxuXG5jbGFzcyBCb29sSW50ZXJwb2xhdG9yIGV4dGVuZHMgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcbiAgICAgICAgc3VwZXIoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZShwZXJjZW50YWdlKXtcbiAgICAgICAgbGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcbiAgICAgICAgaWYodCA+IDAuNSl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50b1ZhbHVlO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZyb21WYWx1ZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG5jbGFzcyBUaHJlZUpzQ29sb3JJbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgIHRoaXMudGVtcFZhbHVlID0gbmV3IFRIUkVFLkNvbG9yKCk7XG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuICAgICAgICBsZXQgdCA9IHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHBlcmNlbnRhZ2UpO1xuICAgICAgICB0aGlzLnRlbXBWYWx1ZS5jb3B5KHRoaXMuZnJvbVZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXMudGVtcFZhbHVlLmxlcnAodGhpcy50b1ZhbHVlLCB0KTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGVBbmRDb3B5VG8ocGVyY2VudGFnZSwgdGFyZ2V0KXtcbiAgICAgICAgbGV0IHJlc3VsdEFycmF5ID0gdGhpcy5pbnRlcnBvbGF0ZShwZXJjZW50YWdlKTtcbiAgICAgICAgdGFyZ2V0LmNvcHkocmVzdWx0QXJyYXkpO1xuICAgIH1cbn1cbmNsYXNzIFRocmVlSnNWZWMzSW50ZXJwb2xhdG9yIGV4dGVuZHMgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcbiAgICAgICAgc3VwZXIoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICBpZihVdGlscy5pc0FycmF5KHRvVmFsdWUpICYmIHRvVmFsdWUubGVuZ3RoIDw9IDMpe1xuICAgICAgICAgICAgdGhpcy50b1ZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjMoLi4udGhpcy50b1ZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnRlbXBWYWx1ZSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuICAgICAgICBsZXQgdCA9IHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHBlcmNlbnRhZ2UpO1xuICAgICAgICByZXR1cm4gdGhpcy50ZW1wVmFsdWUubGVycFZlY3RvcnModGhpcy5mcm9tVmFsdWUsIHRoaXMudG9WYWx1ZSwgdCk7IC8vdGhpcyBtb2RpZmllcyB0aGlzLnRlbXBWYWx1ZSBpbi1wbGFjZSBhbmQgcmV0dXJucyBpdFxuICAgIH1cbiAgICBpbnRlcnBvbGF0ZUFuZENvcHlUbyhwZXJjZW50YWdlLCB0YXJnZXQpe1xuICAgICAgICBsZXQgcmVzdWx0QXJyYXkgPSB0aGlzLmludGVycG9sYXRlKHBlcmNlbnRhZ2UpO1xuICAgICAgICB0YXJnZXQuY29weShyZXN1bHRBcnJheSk7XG4gICAgfVxufVxuXG5jbGFzcyBUcmFuc2Zvcm1hdGlvbkZ1bmN0aW9uSW50ZXJwb2xhdG9yIGV4dGVuZHMgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uLCBzdGFnZ2VyRnJhY3Rpb24sIHRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy5zdGFnZ2VyRnJhY3Rpb24gPSBzdGFnZ2VyRnJhY3Rpb247XG4gICAgICAgIHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gdGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZShwZXJjZW50YWdlKXtcblx0XHRcdC8vaWYgc3RhZ2dlckZyYWN0aW9uICE9IDAsIGl0J3MgdGhlIGFtb3VudCBvZiB0aW1lIGJldHdlZW4gdGhlIGZpcnN0IHBvaW50J3Mgc3RhcnQgdGltZSBhbmQgdGhlIGxhc3QgcG9pbnQncyBzdGFydCB0aW1lLlxuXHRcdFx0Ly9BU1NVTVBUSU9OOiB0aGUgZmlyc3QgdmFyaWFibGUgb2YgdGhpcyBmdW5jdGlvbiBpcyBpLCBhbmQgaXQncyBhc3N1bWVkIGkgaXMgemVyby1pbmRleGVkLlxuXHRcdFx0Ly9lbmNhcHN1bGF0ZSBwZXJjZW50YWdlXG5cblx0XHRcdHJldHVybiAoZnVuY3Rpb24oLi4uY29vcmRzKXtcbiAgICAgICAgICAgICAgICBjb25zdCBpID0gY29vcmRzWzBdO1xuXHRcdFx0XHRsZXQgbGVycEZhY3RvciA9IHBlcmNlbnRhZ2U7XG5cbiAgICAgICAgICAgICAgICAvL2ZhbmN5IHN0YWdnZXJpbmcgbWF0aCwgaWYgd2Uga25vdyBob3cgbWFueSBvYmplY3RzIGFyZSBmbG93aW5nIHRocm91Z2ggdGhpcyB0cmFuc2Zvcm1hdGlvbiBhdCBvbmNlXG4gICAgICAgICAgICAgICAgaWYodGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gIT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICAgICAgICAgIGxlcnBGYWN0b3IgPSBwZXJjZW50YWdlLygxLXRoaXMuc3RhZ2dlckZyYWN0aW9uK0VQUykgLSBpKnRoaXMuc3RhZ2dlckZyYWN0aW9uL3RoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuICAgICAgICAgICAgICAgIH1cblx0XHRcdFx0Ly9sZXQgcGVyY2VudCA9IE1hdGgubWluKE1hdGgubWF4KHBlcmNlbnRhZ2UgLSBpL3RoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uICAgLDEpLDApO1xuXG5cdFx0XHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24oTWF0aC5tYXgoTWF0aC5taW4obGVycEZhY3RvciwxKSwwKSk7XG5cdFx0XHRcdHJldHVybiBtYXRoLmxlcnBWZWN0b3JzKHQsdGhpcy50b1ZhbHVlKC4uLmNvb3JkcyksdGhpcy5mcm9tVmFsdWUoLi4uY29vcmRzKSlcblx0XHRcdH0pLmJpbmQodGhpcyk7XG4gICAgfVxufVxuXG5jbGFzcyBOdW1lcmljMURBcnJheUludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy5sYXJnZXN0TGVuZ3RoID0gTWF0aC5tYXgoZnJvbVZhbHVlLmxlbmd0aCwgdG9WYWx1ZS5sZW5ndGgpO1xuICAgICAgICB0aGlzLnNob3J0ZXN0TGVuZ3RoID0gTWF0aC5taW4oZnJvbVZhbHVlLmxlbmd0aCwgdG9WYWx1ZS5sZW5ndGgpO1xuICAgICAgICB0aGlzLmZyb21WYWx1ZUlzU2hvcnRlciA9IGZyb21WYWx1ZS5sZW5ndGggPCB0b1ZhbHVlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5yZXN1bHRBcnJheSA9IG5ldyBBcnJheSh0aGlzLmxhcmdlc3RMZW5ndGgpOyAvL2NhY2hlZCBmb3Igc3BlZWR1cFxuICAgIH1cbiAgICBpbnRlcnBvbGF0ZShwZXJjZW50YWdlKXtcblx0XHRsZXQgdCA9IHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHBlcmNlbnRhZ2UpO1xuICAgICAgICBmb3IobGV0IGk9MDtpPHRoaXMuc2hvcnRlc3RMZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIHRoaXMucmVzdWx0QXJyYXlbaV0gPSB0KnRoaXMudG9WYWx1ZVtpXSArICgxLXQpKnRoaXMuZnJvbVZhbHVlW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9pZiBvbmUgYXJyYXkgaXMgbG9uZ2VyIHRoYW4gdGhlIG90aGVyLCBpbnRlcnBvbGF0ZSBhcyBpZiB0aGUgc2hvcnRlciBhcnJheSBpcyBwYWRkZWQgd2l0aCB6ZXJvZXNcbiAgICAgICAgaWYodGhpcy5mcm9tVmFsdWVJc1Nob3J0ZXIpe1xuICAgICAgICAgICAgLy90aGlzLmZyb21WYWx1ZVtpXSBkb2Vzbid0IGV4aXN0LCBzbyBhc3N1bWUgaXQncyBhIHplcm9cbiAgICAgICAgICAgIGZvcihsZXQgaT10aGlzLnNob3J0ZXN0TGVuZ3RoO2k8dGhpcy5sYXJnZXN0TGVuZ3RoO2krKyl7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRBcnJheVtpXSA9IHQqdGhpcy50b1ZhbHVlW2ldOyAvLyArICgxLXQpKjA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgLy90aGlzLnRvVmFsdWVbaV0gZG9lc24ndCBleGlzdCwgc28gYXNzdW1lIGl0J3MgYSB6ZXJvXG4gICAgICAgICAgICBmb3IobGV0IGk9dGhpcy5zaG9ydGVzdExlbmd0aDtpPHRoaXMubGFyZ2VzdExlbmd0aDtpKyspe1xuICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0QXJyYXlbaV0gPSAoMS10KSp0aGlzLmZyb21WYWx1ZVtpXTsgLy8gKyB0KjAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucmVzdWx0QXJyYXk7XG4gICAgfVxuICAgIGludGVycG9sYXRlQW5kQ29weVRvKHBlcmNlbnRhZ2UsIHRhcmdldCl7XG4gICAgICAgIGxldCByZXN1bHRBcnJheSA9IHRoaXMuaW50ZXJwb2xhdGUocGVyY2VudGFnZSk7XG4gICAgICAgIGZvcihsZXQgaT0wO2k8cmVzdWx0QXJyYXkubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICB0YXJnZXRbaV0gPSByZXN1bHRBcnJheVtpXTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgRmFsbGJhY2tEb05vdGhpbmdJbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuICAgICAgICByZXR1cm4gdGhpcy5mcm9tVmFsdWU7XG4gICAgfVxufVxuXG5cblxuXG5cbmNvbnN0IEV4aXN0aW5nQW5pbWF0aW9uU3ltYm9sID0gU3ltYm9sKCdDdXJyZW50RVhQQW5pbWF0aW9uJylcblxuXG5jbGFzcyBBbmltYXRpb257XG5cdGNvbnN0cnVjdG9yKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uPTEsIG9wdGlvbmFsQXJndW1lbnRzPXt9KXtcbiAgICAgICAgaWYoIVV0aWxzLmlzT2JqZWN0KHRvVmFsdWVzKSAmJiAhVXRpbHMuaXNBcnJheSh0b1ZhbHVlcykpe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRXJyb3IgdHJhbnNpdGlvbmluZzogdG9WYWx1ZXMgbXVzdCBiZSBhbiBhcnJheSBvciBhbiBvYmplY3QuXCIpO1xuICAgICAgICB9XG5cblx0XHR0aGlzLnRvVmFsdWVzID0gdG9WYWx1ZXM7XG5cdFx0dGhpcy50YXJnZXQgPSB0YXJnZXQ7XHRcblx0XHR0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247IC8vaW4gc1xuXG4gICAgICAgIC8vUGFyc2Ugb3B0aW9uYWwgdmFsdWVzIGluIG9wdGlvbmFsQXJndW1lbnRzXG5cbiAgICAgICAgLy9jaG9vc2UgZWFzaW5nIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuZWFzaW5nID0gb3B0aW9uYWxBcmd1bWVudHMuZWFzaW5nID09PSB1bmRlZmluZWQgPyBFYXNpbmcuRWFzZUluT3V0IDogb3B0aW9uYWxBcmd1bWVudHMuZWFzaW5nOy8vZGVmYXVsdCwgRWFzaW5nLkVhc2VJbk91dFxuICAgICAgICB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbiA9IEFuaW1hdGlvbi5jb3NpbmVFYXNlSW5PdXRJbnRlcnBvbGF0aW9uOyBcbiAgICAgICAgaWYodGhpcy5lYXNpbmcgPT0gRWFzaW5nLkVhc2VJbil7XG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbiA9IEFuaW1hdGlvbi5jb3NpbmVFYXNlSW5JbnRlcnBvbGF0aW9uO1xuICAgICAgICB9ZWxzZSBpZih0aGlzLmVhc2luZyA9PSBFYXNpbmcuRWFzZU91dCl7XG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbiA9IEFuaW1hdGlvbi5jb3NpbmVFYXNlT3V0SW50ZXJwb2xhdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vc2V0dXAgdmFsdWVzIG5lZWRlZCBmb3Igc3RhZ2dlcmVkIGFuaW1hdGlvblxuICAgICAgICB0aGlzLnN0YWdnZXJGcmFjdGlvbiA9IG9wdGlvbmFsQXJndW1lbnRzLnN0YWdnZXJGcmFjdGlvbiA9PT0gdW5kZWZpbmVkID8gMCA6IG9wdGlvbmFsQXJndW1lbnRzLnN0YWdnZXJGcmFjdGlvbjsgLy8gdGltZSBpbiBtcyBiZXR3ZWVuIGZpcnN0IGVsZW1lbnQgYmVnaW5uaW5nIHRoZSBhbmltYXRpb24gYW5kIGxhc3QgZWxlbWVudCBiZWdpbm5pbmcgdGhlIGFuaW1hdGlvbi4gU2hvdWxkIGJlIGxlc3MgdGhhbiBkdXJhdGlvbi5cblx0XHRVdGlscy5hc3NlcnQodGhpcy5zdGFnZ2VyRnJhY3Rpb24gPj0gMCAmJiB0aGlzLnN0YWdnZXJGcmFjdGlvbiA8IDEpO1xuXHRcdGlmKHRhcmdldC5jb25zdHJ1Y3RvciA9PT0gVHJhbnNmb3JtYXRpb24pe1xuXHRcdFx0dGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gPSB0YXJnZXQuZ2V0VG9wUGFyZW50KCkubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXHRcdH1lbHNle1xuXHRcdFx0aWYodGhpcy5zdGFnZ2VyRnJhY3Rpb24gIT0gMCl7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJzdGFnZ2VyRnJhY3Rpb24gY2FuIG9ubHkgYmUgdXNlZCB3aGVuIFRyYW5zaXRpb25UbydzIHRhcmdldCBpcyBhbiBFWFAuVHJhbnNmb3JtYXRpb24hXCIpO1xuXHRcdFx0fVxuXHRcdH1cblxuICAgICAgICB0aGlzLm1vZGUgPSBcImNvcHlQcm9wZXJ0aWVzXCI7XG4gICAgICAgIFxuXHRcdHRoaXMuZnJvbVZhbHVlcyA9IHt9O1xuICAgICAgICB0aGlzLmludGVycG9sYXRvcnMgPSBbXTtcbiAgICAgICAgdGhpcy5pbnRlcnBvbGF0aW5nUHJvcGVydHlOYW1lcyA9IFtdO1xuICAgICAgICBpZighVXRpbHMuaXNBcnJheSh0b1ZhbHVlcykpe1xuXHRcdCAgICBmb3IodmFyIHByb3BlcnR5IGluIHRoaXMudG9WYWx1ZXMpe1xuXHRcdFx0ICAgIFV0aWxzLmFzc2VydFByb3BFeGlzdHModGhpcy50YXJnZXQsIHByb3BlcnR5KTtcblxuXHRcdFx0ICAgIC8vY29weSBwcm9wZXJ0eSwgbWFraW5nIHN1cmUgdG8gc3RvcmUgdGhlIGNvcnJlY3QgJ3RoaXMnXG5cdFx0XHQgICAgaWYoVXRpbHMuaXNGdW5jdGlvbih0aGlzLnRhcmdldFtwcm9wZXJ0eV0pKXtcblx0XHRcdFx0ICAgIHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0gPSB0aGlzLnRhcmdldFtwcm9wZXJ0eV0uYmluZCh0aGlzLnRhcmdldCk7XG5cdFx0XHQgICAgfWVsc2V7XG5cdFx0XHRcdCAgICB0aGlzLmZyb21WYWx1ZXNbcHJvcGVydHldID0gdGhpcy50YXJnZXRbcHJvcGVydHldO1xuXHRcdFx0ICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdG9ycy5wdXNoKHRoaXMuY2hvb3NlSW50ZXJwb2xhdG9yKHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0sIHRoaXMudG9WYWx1ZXNbcHJvcGVydHldLHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0aW5nUHJvcGVydHlOYW1lcy5wdXNoKHByb3BlcnR5KTtcblx0XHQgICAgfVxuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRoaXMubW9kZSA9IFwiY29weVRvVGFyZ2V0XCI7XG4gICAgICAgICAgICAvL3N1cHBvcnQgQW5pbWF0aW9uKFthLGIsY10sW2EsYixjLGQsZV0pIHdoZXJlIGZyb21WYWx1ZXNbcHJvcGVydHldIG1pZ2h0IG5vdCBiZSBpbnRlcnBvbGF0YWJsZSwgYnV0IGZyb21WYWx1ZXMgaXNcblx0XHQgICAgdGhpcy5mcm9tVmFsdWVzID0gRVhQLk1hdGguY2xvbmUodGhpcy50YXJnZXQpO1xuICAgICAgICAgICAgbGV0IHdob2xlVGhpbmdJbnRlcnBvbGF0b3IgPSB0aGlzLmNob29zZUludGVycG9sYXRvcih0aGlzLmZyb21WYWx1ZXMsIHRoaXMudG9WYWx1ZXMsdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0b3JzLnB1c2god2hvbGVUaGluZ0ludGVycG9sYXRvcik7XG4gICAgICAgIH1cblxuXG5cdFx0dGhpcy5lbGFwc2VkVGltZSA9IDA7XG4gICAgICAgIHRoaXMucHJldlRydWVUaW1lID0gMDtcblxuICAgICAgICBpZih0aGlzLnRhcmdldFtFeGlzdGluZ0FuaW1hdGlvblN5bWJvbF0gIT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICB0aGlzLmRlYWxXaXRoRXhpc3RpbmdBbmltYXRpb24oKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnRhcmdldFtFeGlzdGluZ0FuaW1hdGlvblN5bWJvbF0gPSB0aGlzO1xuXG5cdFx0Ly9iZWdpblxuXHRcdHRoaXMuX3VwZGF0ZUNhbGxiYWNrID0gdGhpcy51cGRhdGUuYmluZCh0aGlzKVxuXHRcdHRocmVlRW52aXJvbm1lbnQub24oXCJ1cGRhdGVcIix0aGlzLl91cGRhdGVDYWxsYmFjayk7XG5cdH1cbiAgICBkZWFsV2l0aEV4aXN0aW5nQW5pbWF0aW9uKCl7XG4gICAgICAgIC8vaWYgYW5vdGhlciBhbmltYXRpb24gaXMgaGFsZndheSB0aHJvdWdoIHBsYXlpbmcgd2hlbiB0aGlzIGFuaW1hdGlvbiBzdGFydHMsIHByZWVtcHQgaXRcbiAgICAgICAgbGV0IHByZXZpb3VzQW5pbWF0aW9uID0gdGhpcy50YXJnZXRbRXhpc3RpbmdBbmltYXRpb25TeW1ib2xdO1xuXG4gICAgICAgIC8vdG9kbzogZmFuY3kgYmxlbmRpbmdcbiAgICAgICAgcHJldmlvdXNBbmltYXRpb24uZW5kKCk7XG5cdFx0Zm9yKHZhciBwcm9wZXJ0eSBpbiB0aGlzLmZyb21WYWx1ZXMpe1xuICAgICAgICAgICAgaWYocHJvcGVydHkgaW4gcHJldmlvdXNBbmltYXRpb24udG9WYWx1ZXMpe1xuICAgICAgICAgICAgICAgIHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0gPSBwcmV2aW91c0FuaW1hdGlvbi50b1ZhbHVlc1twcm9wZXJ0eV07XG4gICAgXHRcdH1cblx0XHR9XG4gICAgfVxuICAgIGNob29zZUludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG5cdFx0aWYodHlwZW9mKHRvVmFsdWUpID09PSBcIm51bWJlclwiICYmIHR5cGVvZihmcm9tVmFsdWUpID09PSBcIm51bWJlclwiKXtcbiAgICAgICAgICAgIC8vbnVtYmVyLW51bWJlclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBOdW1iZXJJbnRlcnBvbGF0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuXHRcdH1lbHNlIGlmKFV0aWxzLmlzRnVuY3Rpb24odG9WYWx1ZSkgJiYgVXRpbHMuaXNGdW5jdGlvbihmcm9tVmFsdWUpKXtcbiAgICAgICAgICAgIC8vZnVuY3Rpb24tZnVuY3Rpb25cblx0XHRcdHJldHVybiBuZXcgVHJhbnNmb3JtYXRpb25GdW5jdGlvbkludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbiwgdGhpcy5zdGFnZ2VyRnJhY3Rpb24sIHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uKTtcblx0XHR9ZWxzZSBpZih0b1ZhbHVlLmNvbnN0cnVjdG9yID09PSBUSFJFRS5Db2xvciAmJiBmcm9tVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLkNvbG9yKXtcbiAgICAgICAgICAgIC8vVEhSRUUuQ29sb3JcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGhyZWVKc0NvbG9ySW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICAgICAgfWVsc2UgaWYoZnJvbVZhbHVlLmNvbnN0cnVjdG9yID09PSBUSFJFRS5WZWN0b3IzICYmICh0b1ZhbHVlLmNvbnN0cnVjdG9yID09PSBUSFJFRS5WZWN0b3IzIHx8IFV0aWxzLmlzMUROdW1lcmljQXJyYXkodG9WYWx1ZSkpKXtcbiAgICAgICAgICAgIC8vVEhSRUUuVmVjdG9yMyAtIGJ1dCB3ZSBjYW4gYWxzbyBpbnRlcnByZXQgYSB0b1ZhbHVlIG9mIFthLGIsY10gYXMgbmV3IFRIUkVFLlZlY3RvcjMoYSxiLGMpXG4gICAgICAgICAgICByZXR1cm4gbmV3IFRocmVlSnNWZWMzSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICAgICAgfWVsc2UgaWYodHlwZW9mKHRvVmFsdWUpID09PSBcImJvb2xlYW5cIiAmJiB0eXBlb2YoZnJvbVZhbHVlKSA9PT0gXCJib29sZWFuXCIpe1xuICAgICAgICAgICAgLy9ib29sZWFuXG4gICAgICAgICAgICByZXR1cm4gbmV3IEJvb2xJbnRlcnBvbGF0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuXHRcdH1lbHNlIGlmKFV0aWxzLmlzMUROdW1lcmljQXJyYXkodG9WYWx1ZSkgJiYgVXRpbHMuaXMxRE51bWVyaWNBcnJheShmcm9tVmFsdWUpKXtcbiAgICAgICAgICAgIC8vZnVuY3Rpb24tZnVuY3Rpb25cblx0XHRcdHJldHVybiBuZXcgTnVtZXJpYzFEQXJyYXlJbnRlcnBvbGF0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIC8vV2UgZG9uJ3Qga25vdyBob3cgdG8gaW50ZXJwb2xhdGUgdGhpcy4gSW5zdGVhZCB3ZSdsbCBqdXN0IGRvIG5vdGhpbmcsIGFuZCBhdCB0aGUgZW5kIG9mIHRoZSBhbmltYXRpb24gd2UnbGwganVzdCBzZXQgdGhlIHRhcmdldCB0byB0aGUgdG9WYWx1ZS5cblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJBbmltYXRpb24gY2xhc3MgY2Fubm90IHlldCBoYW5kbGUgdHJhbnNpdGlvbmluZyBiZXR3ZWVuIHRoaW5ncyB0aGF0IGFyZW4ndCBudW1iZXJzIG9yIGZ1bmN0aW9ucyBvciBhcnJheXMhXCIpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBGYWxsYmFja0RvTm90aGluZ0ludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG5cdFx0fVxuICAgIH1cblx0dXBkYXRlKHRpbWUpe1xuXHRcdHRoaXMuZWxhcHNlZFRpbWUgKz0gdGltZS5yZWFsdGltZURlbHRhO1x0XG5cblx0XHRsZXQgcGVyY2VudGFnZSA9IHRoaXMuZWxhcHNlZFRpbWUvdGhpcy5kdXJhdGlvbjtcblxuXHRcdC8vaW50ZXJwb2xhdGUgdmFsdWVzXG4gICAgICAgIGlmKHRoaXMubW9kZSA9PSAnY29weVByb3BlcnRpZXMnKXtcblx0XHQgICAgZm9yKGxldCBpPTA7aTx0aGlzLmludGVycG9sYXRvcnMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICAgICAgbGV0IHByb3BlcnR5TmFtZSA9IHRoaXMuaW50ZXJwb2xhdGluZ1Byb3BlcnR5TmFtZXNbaV07XG5cdFx0XHQgICAgdGhpcy50YXJnZXRbcHJvcGVydHlOYW1lXSA9IHRoaXMuaW50ZXJwb2xhdG9yc1tpXS5pbnRlcnBvbGF0ZShwZXJjZW50YWdlKTtcblx0XHQgICAgfVxuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIC8vY29weSB0byB0YXJnZXRcbiAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdG9yc1swXS5pbnRlcnBvbGF0ZUFuZENvcHlUbyhwZXJjZW50YWdlLCB0aGlzLnRhcmdldCk7XG4gICAgICAgIH1cblxuXHRcdGlmKHRoaXMuZWxhcHNlZFRpbWUgPj0gdGhpcy5kdXJhdGlvbil7XG5cdFx0XHR0aGlzLmVuZCgpO1xuXHRcdH1cblx0fVxuXHRzdGF0aWMgY29zaW5lRWFzZUluT3V0SW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4gKDEtTWF0aC5jb3MoeCpNYXRoLlBJKSkvMjtcblx0fVxuXHRzdGF0aWMgY29zaW5lRWFzZUluSW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4gKDEtTWF0aC5jb3MoeCpNYXRoLlBJLzIpKTtcblx0fVxuXHRzdGF0aWMgY29zaW5lRWFzZU91dEludGVycG9sYXRpb24oeCl7XG5cdFx0cmV0dXJuIE1hdGguc2luKHggKiBNYXRoLlBJLzIpO1xuXHR9XG5cdHN0YXRpYyBsaW5lYXJJbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiB4O1xuXHR9XG5cdGVuZCgpe1xuXHRcdGZvcih2YXIgcHJvcCBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BdID0gdGhpcy50b1ZhbHVlc1twcm9wXTtcblx0XHR9XG5cdFx0dGhyZWVFbnZpcm9ubWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwidXBkYXRlXCIsdGhpcy5fdXBkYXRlQ2FsbGJhY2spO1xuICAgICAgICB0aGlzLnRhcmdldFtFeGlzdGluZ0FuaW1hdGlvblN5bWJvbF0gPSB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZnVuY3Rpb24gVHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMsIG9wdGlvbmFsQXJndW1lbnRzKXtcbiAgICAvL2lmIHNvbWVvbmUncyB1c2luZyB0aGUgb2xkIGNhbGxpbmcgc3RyYXRlZ3kgb2Ygc3RhZ2dlckZyYWN0aW9uIGFzIHRoZSBsYXN0IGFyZ3VtZW50LCBjb252ZXJ0IGl0IHByb3Blcmx5XG4gICAgaWYob3B0aW9uYWxBcmd1bWVudHMgJiYgVXRpbHMuaXNOdW1iZXIob3B0aW9uYWxBcmd1bWVudHMpKXtcbiAgICAgICAgb3B0aW9uYWxBcmd1bWVudHMgPSB7c3RhZ2dlckZyYWN0aW9uOiBvcHRpb25hbEFyZ3VtZW50c307XG4gICAgfVxuXHR2YXIgYW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDAsIG9wdGlvbmFsQXJndW1lbnRzKTtcbn1cblxuZXhwb3J0IHtUcmFuc2l0aW9uVG8sIEFuaW1hdGlvbiwgRWFzaW5nfVxuIiwiKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIGxvb2t1cCA9IFtcblx0XHRcdCdBJywgJ0InLCAnQycsICdEJywgJ0UnLCAnRicsICdHJywgJ0gnLFxuXHRcdFx0J0knLCAnSicsICdLJywgJ0wnLCAnTScsICdOJywgJ08nLCAnUCcsXG5cdFx0XHQnUScsICdSJywgJ1MnLCAnVCcsICdVJywgJ1YnLCAnVycsICdYJyxcblx0XHRcdCdZJywgJ1onLCAnYScsICdiJywgJ2MnLCAnZCcsICdlJywgJ2YnLFxuXHRcdFx0J2cnLCAnaCcsICdpJywgJ2onLCAnaycsICdsJywgJ20nLCAnbicsXG5cdFx0XHQnbycsICdwJywgJ3EnLCAncicsICdzJywgJ3QnLCAndScsICd2Jyxcblx0XHRcdCd3JywgJ3gnLCAneScsICd6JywgJzAnLCAnMScsICcyJywgJzMnLFxuXHRcdFx0JzQnLCAnNScsICc2JywgJzcnLCAnOCcsICc5JywgJysnLCAnLydcblx0XHRdO1xuXHRmdW5jdGlvbiBjbGVhbihsZW5ndGgpIHtcblx0XHR2YXIgaSwgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKTtcblx0XHRmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdGJ1ZmZlcltpXSA9IDA7XG5cdFx0fVxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHRmdW5jdGlvbiBleHRlbmQob3JpZywgbGVuZ3RoLCBhZGRMZW5ndGgsIG11bHRpcGxlT2YpIHtcblx0XHR2YXIgbmV3U2l6ZSA9IGxlbmd0aCArIGFkZExlbmd0aCxcblx0XHRcdGJ1ZmZlciA9IGNsZWFuKChwYXJzZUludChuZXdTaXplIC8gbXVsdGlwbGVPZikgKyAxKSAqIG11bHRpcGxlT2YpO1xuXG5cdFx0YnVmZmVyLnNldChvcmlnKTtcblxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHRmdW5jdGlvbiBwYWQobnVtLCBieXRlcywgYmFzZSkge1xuXHRcdG51bSA9IG51bS50b1N0cmluZyhiYXNlIHx8IDgpO1xuXHRcdHJldHVybiBcIjAwMDAwMDAwMDAwMFwiLnN1YnN0cihudW0ubGVuZ3RoICsgMTIgLSBieXRlcykgKyBudW07XG5cdH1cblxuXHRmdW5jdGlvbiBzdHJpbmdUb1VpbnQ4IChpbnB1dCwgb3V0LCBvZmZzZXQpIHtcblx0XHR2YXIgaSwgbGVuZ3RoO1xuXG5cdFx0b3V0ID0gb3V0IHx8IGNsZWFuKGlucHV0Lmxlbmd0aCk7XG5cblx0XHRvZmZzZXQgPSBvZmZzZXQgfHwgMDtcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSBpbnB1dC5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0b3V0W29mZnNldF0gPSBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0b2Zmc2V0ICs9IDE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aDtcblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwW251bSA+PiAxOCAmIDB4M0ZdICsgbG9va3VwW251bSA+PiAxMiAmIDB4M0ZdICsgbG9va3VwW251bSA+PiA2ICYgMHgzRl0gKyBsb29rdXBbbnVtICYgMHgzRl07XG5cdFx0fTtcblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pO1xuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKTtcblx0XHR9XG5cblx0XHQvLyB0aGlzIHByZXZlbnRzIGFuIEVSUl9JTlZBTElEX1VSTCBpbiBDaHJvbWUgKEZpcmVmb3ggb2theSlcblx0XHRzd2l0Y2ggKG91dHB1dC5sZW5ndGggJSA0KSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdG91dHB1dCArPSAnPSc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHRvdXRwdXQgKz0gJz09Jztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0O1xuXHR9XG5cblx0d2luZG93LnV0aWxzID0ge31cblx0d2luZG93LnV0aWxzLmNsZWFuID0gY2xlYW47XG5cdHdpbmRvdy51dGlscy5wYWQgPSBwYWQ7XG5cdHdpbmRvdy51dGlscy5leHRlbmQgPSBleHRlbmQ7XG5cdHdpbmRvdy51dGlscy5zdHJpbmdUb1VpbnQ4ID0gc3RyaW5nVG9VaW50ODtcblx0d2luZG93LnV0aWxzLnVpbnQ4VG9CYXNlNjQgPSB1aW50OFRvQmFzZTY0O1xufSgpKTtcblxuKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cbi8qXG5zdHJ1Y3QgcG9zaXhfaGVhZGVyIHsgICAgICAgICAgICAgLy8gYnl0ZSBvZmZzZXRcblx0Y2hhciBuYW1lWzEwMF07ICAgICAgICAgICAgICAgLy8gICAwXG5cdGNoYXIgbW9kZVs4XTsgICAgICAgICAgICAgICAgIC8vIDEwMFxuXHRjaGFyIHVpZFs4XTsgICAgICAgICAgICAgICAgICAvLyAxMDhcblx0Y2hhciBnaWRbOF07ICAgICAgICAgICAgICAgICAgLy8gMTE2XG5cdGNoYXIgc2l6ZVsxMl07ICAgICAgICAgICAgICAgIC8vIDEyNFxuXHRjaGFyIG10aW1lWzEyXTsgICAgICAgICAgICAgICAvLyAxMzZcblx0Y2hhciBjaGtzdW1bOF07ICAgICAgICAgICAgICAgLy8gMTQ4XG5cdGNoYXIgdHlwZWZsYWc7ICAgICAgICAgICAgICAgIC8vIDE1NlxuXHRjaGFyIGxpbmtuYW1lWzEwMF07ICAgICAgICAgICAvLyAxNTdcblx0Y2hhciBtYWdpY1s2XTsgICAgICAgICAgICAgICAgLy8gMjU3XG5cdGNoYXIgdmVyc2lvblsyXTsgICAgICAgICAgICAgIC8vIDI2M1xuXHRjaGFyIHVuYW1lWzMyXTsgICAgICAgICAgICAgICAvLyAyNjVcblx0Y2hhciBnbmFtZVszMl07ICAgICAgICAgICAgICAgLy8gMjk3XG5cdGNoYXIgZGV2bWFqb3JbOF07ICAgICAgICAgICAgIC8vIDMyOVxuXHRjaGFyIGRldm1pbm9yWzhdOyAgICAgICAgICAgICAvLyAzMzdcblx0Y2hhciBwcmVmaXhbMTU1XTsgICAgICAgICAgICAgLy8gMzQ1XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gNTAwXG59O1xuKi9cblxuXHR2YXIgdXRpbHMgPSB3aW5kb3cudXRpbHMsXG5cdFx0aGVhZGVyRm9ybWF0O1xuXG5cdGhlYWRlckZvcm1hdCA9IFtcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZU5hbWUnLFxuXHRcdFx0J2xlbmd0aCc6IDEwMFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVNb2RlJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndWlkJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZ2lkJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZVNpemUnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbXRpbWUnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnY2hlY2tzdW0nLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd0eXBlJyxcblx0XHRcdCdsZW5ndGgnOiAxXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbGlua05hbWUnLFxuXHRcdFx0J2xlbmd0aCc6IDEwMFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3VzdGFyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnb3duZXInLFxuXHRcdFx0J2xlbmd0aCc6IDMyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZ3JvdXAnLFxuXHRcdFx0J2xlbmd0aCc6IDMyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbWFqb3JOdW1iZXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtaW5vck51bWJlcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVuYW1lUHJlZml4Jyxcblx0XHRcdCdsZW5ndGgnOiAxNTVcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdwYWRkaW5nJyxcblx0XHRcdCdsZW5ndGgnOiAxMlxuXHRcdH1cblx0XTtcblxuXHRmdW5jdGlvbiBmb3JtYXRIZWFkZXIoZGF0YSwgY2IpIHtcblx0XHR2YXIgYnVmZmVyID0gdXRpbHMuY2xlYW4oNTEyKSxcblx0XHRcdG9mZnNldCA9IDA7XG5cblx0XHRoZWFkZXJGb3JtYXQuZm9yRWFjaChmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdHZhciBzdHIgPSBkYXRhW3ZhbHVlLmZpZWxkXSB8fCBcIlwiLFxuXHRcdFx0XHRpLCBsZW5ndGg7XG5cblx0XHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHN0ci5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0XHRidWZmZXJbb2Zmc2V0XSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0XHRvZmZzZXQgKz0gMTtcblx0XHRcdH1cblxuXHRcdFx0b2Zmc2V0ICs9IHZhbHVlLmxlbmd0aCAtIGk7IC8vIHNwYWNlIGl0IG91dCB3aXRoIG51bGxzXG5cdFx0fSk7XG5cblx0XHRpZiAodHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRyZXR1cm4gY2IoYnVmZmVyLCBvZmZzZXQpO1xuXHRcdH1cblx0XHRyZXR1cm4gYnVmZmVyO1xuXHR9XG5cblx0d2luZG93LmhlYWRlciA9IHt9XG5cdHdpbmRvdy5oZWFkZXIuc3RydWN0dXJlID0gaGVhZGVyRm9ybWF0O1xuXHR3aW5kb3cuaGVhZGVyLmZvcm1hdCA9IGZvcm1hdEhlYWRlcjtcbn0oKSk7XG5cbihmdW5jdGlvbiAoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBoZWFkZXIgPSB3aW5kb3cuaGVhZGVyLFxuXHRcdHV0aWxzID0gd2luZG93LnV0aWxzLFxuXHRcdHJlY29yZFNpemUgPSA1MTIsXG5cdFx0YmxvY2tTaXplO1xuXG5cdGZ1bmN0aW9uIFRhcihyZWNvcmRzUGVyQmxvY2spIHtcblx0XHR0aGlzLndyaXR0ZW4gPSAwO1xuXHRcdGJsb2NrU2l6ZSA9IChyZWNvcmRzUGVyQmxvY2sgfHwgMjApICogcmVjb3JkU2l6ZTtcblx0XHR0aGlzLm91dCA9IHV0aWxzLmNsZWFuKGJsb2NrU2l6ZSk7XG5cdFx0dGhpcy5ibG9ja3MgPSBbXTtcblx0XHR0aGlzLmxlbmd0aCA9IDA7XG5cdH1cblxuXHRUYXIucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uIChmaWxlcGF0aCwgaW5wdXQsIG9wdHMsIGNhbGxiYWNrKSB7XG5cdFx0dmFyIGRhdGEsXG5cdFx0XHRjaGVja3N1bSxcblx0XHRcdG1vZGUsXG5cdFx0XHRtdGltZSxcblx0XHRcdHVpZCxcblx0XHRcdGdpZCxcblx0XHRcdGhlYWRlckFycjtcblxuXHRcdGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRpbnB1dCA9IHV0aWxzLnN0cmluZ1RvVWludDgoaW5wdXQpO1xuXHRcdH0gZWxzZSBpZiAoaW5wdXQuY29uc3RydWN0b3IgIT09IFVpbnQ4QXJyYXkucHJvdG90eXBlLmNvbnN0cnVjdG9yKSB7XG5cdFx0XHR0aHJvdyAnSW52YWxpZCBpbnB1dCB0eXBlLiBZb3UgZ2F2ZSBtZTogJyArIGlucHV0LmNvbnN0cnVjdG9yLnRvU3RyaW5nKCkubWF0Y2goL2Z1bmN0aW9uXFxzKihbJEEtWmEtel9dWzAtOUEtWmEtel9dKilcXHMqXFwoLylbMV07XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRjYWxsYmFjayA9IG9wdHM7XG5cdFx0XHRvcHRzID0ge307XG5cdFx0fVxuXG5cdFx0b3B0cyA9IG9wdHMgfHwge307XG5cblx0XHRtb2RlID0gb3B0cy5tb2RlIHx8IHBhcnNlSW50KCc3NzcnLCA4KSAmIDB4ZmZmO1xuXHRcdG10aW1lID0gb3B0cy5tdGltZSB8fCBNYXRoLmZsb29yKCtuZXcgRGF0ZSgpIC8gMTAwMCk7XG5cdFx0dWlkID0gb3B0cy51aWQgfHwgMDtcblx0XHRnaWQgPSBvcHRzLmdpZCB8fCAwO1xuXG5cdFx0ZGF0YSA9IHtcblx0XHRcdGZpbGVOYW1lOiBmaWxlcGF0aCxcblx0XHRcdGZpbGVNb2RlOiB1dGlscy5wYWQobW9kZSwgNyksXG5cdFx0XHR1aWQ6IHV0aWxzLnBhZCh1aWQsIDcpLFxuXHRcdFx0Z2lkOiB1dGlscy5wYWQoZ2lkLCA3KSxcblx0XHRcdGZpbGVTaXplOiB1dGlscy5wYWQoaW5wdXQubGVuZ3RoLCAxMSksXG5cdFx0XHRtdGltZTogdXRpbHMucGFkKG10aW1lLCAxMSksXG5cdFx0XHRjaGVja3N1bTogJyAgICAgICAgJyxcblx0XHRcdHR5cGU6ICcwJywgLy8ganVzdCBhIGZpbGVcblx0XHRcdHVzdGFyOiAndXN0YXIgICcsXG5cdFx0XHRvd25lcjogb3B0cy5vd25lciB8fCAnJyxcblx0XHRcdGdyb3VwOiBvcHRzLmdyb3VwIHx8ICcnXG5cdFx0fTtcblxuXHRcdC8vIGNhbGN1bGF0ZSB0aGUgY2hlY2tzdW1cblx0XHRjaGVja3N1bSA9IDA7XG5cdFx0T2JqZWN0LmtleXMoZGF0YSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG5cdFx0XHR2YXIgaSwgdmFsdWUgPSBkYXRhW2tleV0sIGxlbmd0aDtcblxuXHRcdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdFx0Y2hlY2tzdW0gKz0gdmFsdWUuY2hhckNvZGVBdChpKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGRhdGEuY2hlY2tzdW0gPSB1dGlscy5wYWQoY2hlY2tzdW0sIDYpICsgXCJcXHUwMDAwIFwiO1xuXG5cdFx0aGVhZGVyQXJyID0gaGVhZGVyLmZvcm1hdChkYXRhKTtcblxuXHRcdHZhciBoZWFkZXJMZW5ndGggPSBNYXRoLmNlaWwoIGhlYWRlckFyci5sZW5ndGggLyByZWNvcmRTaXplICkgKiByZWNvcmRTaXplO1xuXHRcdHZhciBpbnB1dExlbmd0aCA9IE1hdGguY2VpbCggaW5wdXQubGVuZ3RoIC8gcmVjb3JkU2l6ZSApICogcmVjb3JkU2l6ZTtcblxuXHRcdHRoaXMuYmxvY2tzLnB1c2goIHsgaGVhZGVyOiBoZWFkZXJBcnIsIGlucHV0OiBpbnB1dCwgaGVhZGVyTGVuZ3RoOiBoZWFkZXJMZW5ndGgsIGlucHV0TGVuZ3RoOiBpbnB1dExlbmd0aCB9ICk7XG5cblx0fTtcblxuXHRUYXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBidWZmZXJzID0gW107XG5cdFx0dmFyIGNodW5rcyA9IFtdO1xuXHRcdHZhciBsZW5ndGggPSAwO1xuXHRcdHZhciBtYXggPSBNYXRoLnBvdyggMiwgMjAgKTtcblxuXHRcdHZhciBjaHVuayA9IFtdO1xuXHRcdHRoaXMuYmxvY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBiICkge1xuXHRcdFx0aWYoIGxlbmd0aCArIGIuaGVhZGVyTGVuZ3RoICsgYi5pbnB1dExlbmd0aCA+IG1heCApIHtcblx0XHRcdFx0Y2h1bmtzLnB1c2goIHsgYmxvY2tzOiBjaHVuaywgbGVuZ3RoOiBsZW5ndGggfSApO1xuXHRcdFx0XHRjaHVuayA9IFtdO1xuXHRcdFx0XHRsZW5ndGggPSAwO1xuXHRcdFx0fVxuXHRcdFx0Y2h1bmsucHVzaCggYiApO1xuXHRcdFx0bGVuZ3RoICs9IGIuaGVhZGVyTGVuZ3RoICsgYi5pbnB1dExlbmd0aDtcblx0XHR9ICk7XG5cdFx0Y2h1bmtzLnB1c2goIHsgYmxvY2tzOiBjaHVuaywgbGVuZ3RoOiBsZW5ndGggfSApO1xuXG5cdFx0Y2h1bmtzLmZvckVhY2goIGZ1bmN0aW9uKCBjICkge1xuXG5cdFx0XHR2YXIgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoIGMubGVuZ3RoICk7XG5cdFx0XHR2YXIgd3JpdHRlbiA9IDA7XG5cdFx0XHRjLmJsb2Nrcy5mb3JFYWNoKCBmdW5jdGlvbiggYiApIHtcblx0XHRcdFx0YnVmZmVyLnNldCggYi5oZWFkZXIsIHdyaXR0ZW4gKTtcblx0XHRcdFx0d3JpdHRlbiArPSBiLmhlYWRlckxlbmd0aDtcblx0XHRcdFx0YnVmZmVyLnNldCggYi5pbnB1dCwgd3JpdHRlbiApO1xuXHRcdFx0XHR3cml0dGVuICs9IGIuaW5wdXRMZW5ndGg7XG5cdFx0XHR9ICk7XG5cdFx0XHRidWZmZXJzLnB1c2goIGJ1ZmZlciApO1xuXG5cdFx0fSApO1xuXG5cdFx0YnVmZmVycy5wdXNoKCBuZXcgVWludDhBcnJheSggMiAqIHJlY29yZFNpemUgKSApO1xuXG5cdFx0cmV0dXJuIG5ldyBCbG9iKCBidWZmZXJzLCB7IHR5cGU6ICdvY3RldC9zdHJlYW0nIH0gKTtcblxuXHR9O1xuXG5cdFRhci5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy53cml0dGVuID0gMDtcblx0XHR0aGlzLm91dCA9IHV0aWxzLmNsZWFuKGJsb2NrU2l6ZSk7XG5cdH07XG5cbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFRhcjtcbiAgfSBlbHNlIHtcbiAgICB3aW5kb3cuVGFyID0gVGFyO1xuICB9XG59KCkpO1xuIiwiLy9kb3dubG9hZC5qcyB2My4wLCBieSBkYW5kYXZpczsgMjAwOC0yMDE0LiBbQ0NCWTJdIHNlZSBodHRwOi8vZGFubWwuY29tL2Rvd25sb2FkLmh0bWwgZm9yIHRlc3RzL3VzYWdlXG4vLyB2MSBsYW5kZWQgYSBGRitDaHJvbWUgY29tcGF0IHdheSBvZiBkb3dubG9hZGluZyBzdHJpbmdzIHRvIGxvY2FsIHVuLW5hbWVkIGZpbGVzLCB1cGdyYWRlZCB0byB1c2UgYSBoaWRkZW4gZnJhbWUgYW5kIG9wdGlvbmFsIG1pbWVcbi8vIHYyIGFkZGVkIG5hbWVkIGZpbGVzIHZpYSBhW2Rvd25sb2FkXSwgbXNTYXZlQmxvYiwgSUUgKDEwKykgc3VwcG9ydCwgYW5kIHdpbmRvdy5VUkwgc3VwcG9ydCBmb3IgbGFyZ2VyK2Zhc3RlciBzYXZlcyB0aGFuIGRhdGFVUkxzXG4vLyB2MyBhZGRlZCBkYXRhVVJMIGFuZCBCbG9iIElucHV0LCBiaW5kLXRvZ2dsZSBhcml0eSwgYW5kIGxlZ2FjeSBkYXRhVVJMIGZhbGxiYWNrIHdhcyBpbXByb3ZlZCB3aXRoIGZvcmNlLWRvd25sb2FkIG1pbWUgYW5kIGJhc2U2NCBzdXBwb3J0XG5cbi8vIGRhdGEgY2FuIGJlIGEgc3RyaW5nLCBCbG9iLCBGaWxlLCBvciBkYXRhVVJMXG5cblxuXG5cbmZ1bmN0aW9uIGRvd25sb2FkKGRhdGEsIHN0ckZpbGVOYW1lLCBzdHJNaW1lVHlwZSkge1xuXG5cdHZhciBzZWxmID0gd2luZG93LCAvLyB0aGlzIHNjcmlwdCBpcyBvbmx5IGZvciBicm93c2VycyBhbnl3YXkuLi5cblx0XHR1ID0gXCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIiwgLy8gdGhpcyBkZWZhdWx0IG1pbWUgYWxzbyB0cmlnZ2VycyBpZnJhbWUgZG93bmxvYWRzXG5cdFx0bSA9IHN0ck1pbWVUeXBlIHx8IHUsXG5cdFx0eCA9IGRhdGEsXG5cdFx0RCA9IGRvY3VtZW50LFxuXHRcdGEgPSBELmNyZWF0ZUVsZW1lbnQoXCJhXCIpLFxuXHRcdHogPSBmdW5jdGlvbihhKXtyZXR1cm4gU3RyaW5nKGEpO30sXG5cblxuXHRcdEIgPSBzZWxmLkJsb2IgfHwgc2VsZi5Nb3pCbG9iIHx8IHNlbGYuV2ViS2l0QmxvYiB8fCB6LFxuXHRcdEJCID0gc2VsZi5NU0Jsb2JCdWlsZGVyIHx8IHNlbGYuV2ViS2l0QmxvYkJ1aWxkZXIgfHwgc2VsZi5CbG9iQnVpbGRlcixcblx0XHRmbiA9IHN0ckZpbGVOYW1lIHx8IFwiZG93bmxvYWRcIixcblx0XHRibG9iLFxuXHRcdGIsXG5cdFx0dWEsXG5cdFx0ZnI7XG5cblx0Ly9pZih0eXBlb2YgQi5iaW5kID09PSAnZnVuY3Rpb24nICl7IEI9Qi5iaW5kKHNlbGYpOyB9XG5cblx0aWYoU3RyaW5nKHRoaXMpPT09XCJ0cnVlXCIpeyAvL3JldmVyc2UgYXJndW1lbnRzLCBhbGxvd2luZyBkb3dubG9hZC5iaW5kKHRydWUsIFwidGV4dC94bWxcIiwgXCJleHBvcnQueG1sXCIpIHRvIGFjdCBhcyBhIGNhbGxiYWNrXG5cdFx0eD1beCwgbV07XG5cdFx0bT14WzBdO1xuXHRcdHg9eFsxXTtcblx0fVxuXG5cblxuXHQvL2dvIGFoZWFkIGFuZCBkb3dubG9hZCBkYXRhVVJMcyByaWdodCBhd2F5XG5cdGlmKFN0cmluZyh4KS5tYXRjaCgvXmRhdGFcXDpbXFx3K1xcLV0rXFwvW1xcdytcXC1dK1ssO10vKSl7XG5cdFx0cmV0dXJuIG5hdmlnYXRvci5tc1NhdmVCbG9iID8gIC8vIElFMTAgY2FuJ3QgZG8gYVtkb3dubG9hZF0sIG9ubHkgQmxvYnM6XG5cdFx0XHRuYXZpZ2F0b3IubXNTYXZlQmxvYihkMmIoeCksIGZuKSA6XG5cdFx0XHRzYXZlcih4KSA7IC8vIGV2ZXJ5b25lIGVsc2UgY2FuIHNhdmUgZGF0YVVSTHMgdW4tcHJvY2Vzc2VkXG5cdH0vL2VuZCBpZiBkYXRhVVJMIHBhc3NlZD9cblxuXHR0cnl7XG5cblx0XHRibG9iID0geCBpbnN0YW5jZW9mIEIgP1xuXHRcdFx0eCA6XG5cdFx0XHRuZXcgQihbeF0sIHt0eXBlOiBtfSkgO1xuXHR9Y2F0Y2goeSl7XG5cdFx0aWYoQkIpe1xuXHRcdFx0YiA9IG5ldyBCQigpO1xuXHRcdFx0Yi5hcHBlbmQoW3hdKTtcblx0XHRcdGJsb2IgPSBiLmdldEJsb2IobSk7IC8vIHRoZSBibG9iXG5cdFx0fVxuXG5cdH1cblxuXG5cblx0ZnVuY3Rpb24gZDJiKHUpIHtcblx0XHR2YXIgcD0gdS5zcGxpdCgvWzo7LF0vKSxcblx0XHR0PSBwWzFdLFxuXHRcdGRlYz0gcFsyXSA9PSBcImJhc2U2NFwiID8gYXRvYiA6IGRlY29kZVVSSUNvbXBvbmVudCxcblx0XHRiaW49IGRlYyhwLnBvcCgpKSxcblx0XHRteD0gYmluLmxlbmd0aCxcblx0XHRpPSAwLFxuXHRcdHVpYT0gbmV3IFVpbnQ4QXJyYXkobXgpO1xuXG5cdFx0Zm9yKGk7aTxteDsrK2kpIHVpYVtpXT0gYmluLmNoYXJDb2RlQXQoaSk7XG5cblx0XHRyZXR1cm4gbmV3IEIoW3VpYV0sIHt0eXBlOiB0fSk7XG5cdCB9XG5cblx0ZnVuY3Rpb24gc2F2ZXIodXJsLCB3aW5Nb2RlKXtcblxuXG5cdFx0aWYgKCdkb3dubG9hZCcgaW4gYSkgeyAvL2h0bWw1IEFbZG93bmxvYWRdXG5cdFx0XHRhLmhyZWYgPSB1cmw7XG5cdFx0XHRhLnNldEF0dHJpYnV0ZShcImRvd25sb2FkXCIsIGZuKTtcblx0XHRcdGEuaW5uZXJIVE1MID0gXCJkb3dubG9hZGluZy4uLlwiO1xuXHRcdFx0YS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0RC5ib2R5LmFwcGVuZENoaWxkKGEpO1xuXHRcdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0YS5jbGljaygpO1xuXHRcdFx0XHRELmJvZHkucmVtb3ZlQ2hpbGQoYSk7XG5cdFx0XHRcdGlmKHdpbk1vZGU9PT10cnVlKXtzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7IHNlbGYuVVJMLnJldm9rZU9iamVjdFVSTChhLmhyZWYpO30sIDI1MCApO31cblx0XHRcdH0sIDY2KTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vZG8gaWZyYW1lIGRhdGFVUkwgZG93bmxvYWQgKG9sZCBjaCtGRik6XG5cdFx0dmFyIGYgPSBELmNyZWF0ZUVsZW1lbnQoXCJpZnJhbWVcIik7XG5cdFx0RC5ib2R5LmFwcGVuZENoaWxkKGYpO1xuXHRcdGlmKCF3aW5Nb2RlKXsgLy8gZm9yY2UgYSBtaW1lIHRoYXQgd2lsbCBkb3dubG9hZDpcblx0XHRcdHVybD1cImRhdGE6XCIrdXJsLnJlcGxhY2UoL15kYXRhOihbXFx3XFwvXFwtXFwrXSspLywgdSk7XG5cdFx0fVxuXG5cblx0XHRmLnNyYyA9IHVybDtcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7IEQuYm9keS5yZW1vdmVDaGlsZChmKTsgfSwgMzMzKTtcblxuXHR9Ly9lbmQgc2F2ZXJcblxuXG5cdGlmIChuYXZpZ2F0b3IubXNTYXZlQmxvYikgeyAvLyBJRTEwKyA6IChoYXMgQmxvYiwgYnV0IG5vdCBhW2Rvd25sb2FkXSBvciBVUkwpXG5cdFx0cmV0dXJuIG5hdmlnYXRvci5tc1NhdmVCbG9iKGJsb2IsIGZuKTtcblx0fVxuXG5cdGlmKHNlbGYuVVJMKXsgLy8gc2ltcGxlIGZhc3QgYW5kIG1vZGVybiB3YXkgdXNpbmcgQmxvYiBhbmQgVVJMOlxuXHRcdHNhdmVyKHNlbGYuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKSwgdHJ1ZSk7XG5cdH1lbHNle1xuXHRcdC8vIGhhbmRsZSBub24tQmxvYigpK25vbi1VUkwgYnJvd3NlcnM6XG5cdFx0aWYodHlwZW9mIGJsb2IgPT09IFwic3RyaW5nXCIgfHwgYmxvYi5jb25zdHJ1Y3Rvcj09PXogKXtcblx0XHRcdHRyeXtcblx0XHRcdFx0cmV0dXJuIHNhdmVyKCBcImRhdGE6XCIgKyAgbSAgICsgXCI7YmFzZTY0LFwiICArICBzZWxmLmJ0b2EoYmxvYikgICk7XG5cdFx0XHR9Y2F0Y2goeSl7XG5cdFx0XHRcdHJldHVybiBzYXZlciggXCJkYXRhOlwiICsgIG0gICArIFwiLFwiICsgZW5jb2RlVVJJQ29tcG9uZW50KGJsb2IpICApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEJsb2IgYnV0IG5vdCBVUkw6XG5cdFx0ZnI9bmV3IEZpbGVSZWFkZXIoKTtcblx0XHRmci5vbmxvYWQ9ZnVuY3Rpb24oZSl7XG5cdFx0XHRzYXZlcih0aGlzLnJlc3VsdCk7XG5cdFx0fTtcblx0XHRmci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuXHR9XG5cdHJldHVybiB0cnVlO1xufSAvKiBlbmQgZG93bmxvYWQoKSAqL1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICBtb2R1bGUuZXhwb3J0cyA9IGRvd25sb2FkO1xufVxuIiwiLy8gZ2lmLmpzIDAuMi4wIC0gaHR0cHM6Ly9naXRodWIuY29tL2pub3JkYmVyZy9naWYuanNcclxuKGZ1bmN0aW9uKGYpe2lmKHR5cGVvZiBleHBvcnRzPT09XCJvYmplY3RcIiYmdHlwZW9mIG1vZHVsZSE9PVwidW5kZWZpbmVkXCIpe21vZHVsZS5leHBvcnRzPWYoKX1lbHNlIGlmKHR5cGVvZiBkZWZpbmU9PT1cImZ1bmN0aW9uXCImJmRlZmluZS5hbWQpe2RlZmluZShbXSxmKX1lbHNle3ZhciBnO2lmKHR5cGVvZiB3aW5kb3chPT1cInVuZGVmaW5lZFwiKXtnPXdpbmRvd31lbHNlIGlmKHR5cGVvZiBnbG9iYWwhPT1cInVuZGVmaW5lZFwiKXtnPWdsb2JhbH1lbHNlIGlmKHR5cGVvZiBzZWxmIT09XCJ1bmRlZmluZWRcIil7Zz1zZWxmfWVsc2V7Zz10aGlzfWcuR0lGPWYoKX19KShmdW5jdGlvbigpe3ZhciBkZWZpbmUsbW9kdWxlLGV4cG9ydHM7cmV0dXJuIGZ1bmN0aW9uKCl7ZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9cmV0dXJuIGV9KCkoezE6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe2Z1bmN0aW9uIEV2ZW50RW1pdHRlcigpe3RoaXMuX2V2ZW50cz10aGlzLl9ldmVudHN8fHt9O3RoaXMuX21heExpc3RlbmVycz10aGlzLl9tYXhMaXN0ZW5lcnN8fHVuZGVmaW5lZH1tb2R1bGUuZXhwb3J0cz1FdmVudEVtaXR0ZXI7RXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlcj1FdmVudEVtaXR0ZXI7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzPXVuZGVmaW5lZDtFdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnM9dW5kZWZpbmVkO0V2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzPTEwO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzPWZ1bmN0aW9uKG4pe2lmKCFpc051bWJlcihuKXx8bjwwfHxpc05hTihuKSl0aHJvdyBUeXBlRXJyb3IoXCJuIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIik7dGhpcy5fbWF4TGlzdGVuZXJzPW47cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdD1mdW5jdGlvbih0eXBlKXt2YXIgZXIsaGFuZGxlcixsZW4sYXJncyxpLGxpc3RlbmVycztpZighdGhpcy5fZXZlbnRzKXRoaXMuX2V2ZW50cz17fTtpZih0eXBlPT09XCJlcnJvclwiKXtpZighdGhpcy5fZXZlbnRzLmVycm9yfHxpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpJiYhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCl7ZXI9YXJndW1lbnRzWzFdO2lmKGVyIGluc3RhbmNlb2YgRXJyb3Ipe3Rocm93IGVyfWVsc2V7dmFyIGVycj1uZXcgRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuICgnK2VyK1wiKVwiKTtlcnIuY29udGV4dD1lcjt0aHJvdyBlcnJ9fX1oYW5kbGVyPXRoaXMuX2V2ZW50c1t0eXBlXTtpZihpc1VuZGVmaW5lZChoYW5kbGVyKSlyZXR1cm4gZmFsc2U7aWYoaXNGdW5jdGlvbihoYW5kbGVyKSl7c3dpdGNoKGFyZ3VtZW50cy5sZW5ndGgpe2Nhc2UgMTpoYW5kbGVyLmNhbGwodGhpcyk7YnJlYWs7Y2FzZSAyOmhhbmRsZXIuY2FsbCh0aGlzLGFyZ3VtZW50c1sxXSk7YnJlYWs7Y2FzZSAzOmhhbmRsZXIuY2FsbCh0aGlzLGFyZ3VtZW50c1sxXSxhcmd1bWVudHNbMl0pO2JyZWFrO2RlZmF1bHQ6YXJncz1BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsMSk7aGFuZGxlci5hcHBseSh0aGlzLGFyZ3MpfX1lbHNlIGlmKGlzT2JqZWN0KGhhbmRsZXIpKXthcmdzPUFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKTtsaXN0ZW5lcnM9aGFuZGxlci5zbGljZSgpO2xlbj1saXN0ZW5lcnMubGVuZ3RoO2ZvcihpPTA7aTxsZW47aSsrKWxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLGFyZ3MpfXJldHVybiB0cnVlfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe3ZhciBtO2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7aWYoIXRoaXMuX2V2ZW50cyl0aGlzLl9ldmVudHM9e307aWYodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKXRoaXMuZW1pdChcIm5ld0xpc3RlbmVyXCIsdHlwZSxpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKT9saXN0ZW5lci5saXN0ZW5lcjpsaXN0ZW5lcik7aWYoIXRoaXMuX2V2ZW50c1t0eXBlXSl0aGlzLl9ldmVudHNbdHlwZV09bGlzdGVuZXI7ZWxzZSBpZihpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKXRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtlbHNlIHRoaXMuX2V2ZW50c1t0eXBlXT1bdGhpcy5fZXZlbnRzW3R5cGVdLGxpc3RlbmVyXTtpZihpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pJiYhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCl7aWYoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpe209dGhpcy5fbWF4TGlzdGVuZXJzfWVsc2V7bT1FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVyc31pZihtJiZtPjAmJnRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGg+bSl7dGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZD10cnVlO2NvbnNvbGUuZXJyb3IoXCIobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSBcIitcImxlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gXCIrXCJVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC5cIix0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtpZih0eXBlb2YgY29uc29sZS50cmFjZT09PVwiZnVuY3Rpb25cIil7Y29uc29sZS50cmFjZSgpfX19cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUub249RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2U9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTt2YXIgZmlyZWQ9ZmFsc2U7ZnVuY3Rpb24gZygpe3RoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSxnKTtpZighZmlyZWQpe2ZpcmVkPXRydWU7bGlzdGVuZXIuYXBwbHkodGhpcyxhcmd1bWVudHMpfX1nLmxpc3RlbmVyPWxpc3RlbmVyO3RoaXMub24odHlwZSxnKTtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lcj1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXt2YXIgbGlzdCxwb3NpdGlvbixsZW5ndGgsaTtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO2lmKCF0aGlzLl9ldmVudHN8fCF0aGlzLl9ldmVudHNbdHlwZV0pcmV0dXJuIHRoaXM7bGlzdD10aGlzLl9ldmVudHNbdHlwZV07bGVuZ3RoPWxpc3QubGVuZ3RoO3Bvc2l0aW9uPS0xO2lmKGxpc3Q9PT1saXN0ZW5lcnx8aXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSYmbGlzdC5saXN0ZW5lcj09PWxpc3RlbmVyKXtkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO2lmKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil0aGlzLmVtaXQoXCJyZW1vdmVMaXN0ZW5lclwiLHR5cGUsbGlzdGVuZXIpfWVsc2UgaWYoaXNPYmplY3QobGlzdCkpe2ZvcihpPWxlbmd0aDtpLS0gPjA7KXtpZihsaXN0W2ldPT09bGlzdGVuZXJ8fGxpc3RbaV0ubGlzdGVuZXImJmxpc3RbaV0ubGlzdGVuZXI9PT1saXN0ZW5lcil7cG9zaXRpb249aTticmVha319aWYocG9zaXRpb248MClyZXR1cm4gdGhpcztpZihsaXN0Lmxlbmd0aD09PTEpe2xpc3QubGVuZ3RoPTA7ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXX1lbHNle2xpc3Quc3BsaWNlKHBvc2l0aW9uLDEpfWlmKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil0aGlzLmVtaXQoXCJyZW1vdmVMaXN0ZW5lclwiLHR5cGUsbGlzdGVuZXIpfXJldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycz1mdW5jdGlvbih0eXBlKXt2YXIga2V5LGxpc3RlbmVycztpZighdGhpcy5fZXZlbnRzKXJldHVybiB0aGlzO2lmKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpe2lmKGFyZ3VtZW50cy5sZW5ndGg9PT0wKXRoaXMuX2V2ZW50cz17fTtlbHNlIGlmKHRoaXMuX2V2ZW50c1t0eXBlXSlkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO3JldHVybiB0aGlzfWlmKGFyZ3VtZW50cy5sZW5ndGg9PT0wKXtmb3Ioa2V5IGluIHRoaXMuX2V2ZW50cyl7aWYoa2V5PT09XCJyZW1vdmVMaXN0ZW5lclwiKWNvbnRpbnVlO3RoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSl9dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoXCJyZW1vdmVMaXN0ZW5lclwiKTt0aGlzLl9ldmVudHM9e307cmV0dXJuIHRoaXN9bGlzdGVuZXJzPXRoaXMuX2V2ZW50c1t0eXBlXTtpZihpc0Z1bmN0aW9uKGxpc3RlbmVycykpe3RoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSxsaXN0ZW5lcnMpfWVsc2UgaWYobGlzdGVuZXJzKXt3aGlsZShsaXN0ZW5lcnMubGVuZ3RoKXRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSxsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aC0xXSl9ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnM9ZnVuY3Rpb24odHlwZSl7dmFyIHJldDtpZighdGhpcy5fZXZlbnRzfHwhdGhpcy5fZXZlbnRzW3R5cGVdKXJldD1bXTtlbHNlIGlmKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlyZXQ9W3RoaXMuX2V2ZW50c1t0eXBlXV07ZWxzZSByZXQ9dGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7cmV0dXJuIHJldH07RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50PWZ1bmN0aW9uKHR5cGUpe2lmKHRoaXMuX2V2ZW50cyl7dmFyIGV2bGlzdGVuZXI9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpcmV0dXJuIDE7ZWxzZSBpZihldmxpc3RlbmVyKXJldHVybiBldmxpc3RlbmVyLmxlbmd0aH1yZXR1cm4gMH07RXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQ9ZnVuY3Rpb24oZW1pdHRlcix0eXBlKXtyZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpfTtmdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZyl7cmV0dXJuIHR5cGVvZiBhcmc9PT1cImZ1bmN0aW9uXCJ9ZnVuY3Rpb24gaXNOdW1iZXIoYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwibnVtYmVyXCJ9ZnVuY3Rpb24gaXNPYmplY3QoYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwib2JqZWN0XCImJmFyZyE9PW51bGx9ZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKXtyZXR1cm4gYXJnPT09dm9pZCAwfX0se31dLDI6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBOZXVRdWFudD1yZXF1aXJlKFwiLi9UeXBlZE5ldVF1YW50LmpzXCIpO3ZhciBMWldFbmNvZGVyPXJlcXVpcmUoXCIuL0xaV0VuY29kZXIuanNcIik7ZnVuY3Rpb24gQnl0ZUFycmF5KCl7dGhpcy5wYWdlPS0xO3RoaXMucGFnZXM9W107dGhpcy5uZXdQYWdlKCl9Qnl0ZUFycmF5LnBhZ2VTaXplPTQwOTY7Qnl0ZUFycmF5LmNoYXJNYXA9e307Zm9yKHZhciBpPTA7aTwyNTY7aSsrKUJ5dGVBcnJheS5jaGFyTWFwW2ldPVN0cmluZy5mcm9tQ2hhckNvZGUoaSk7Qnl0ZUFycmF5LnByb3RvdHlwZS5uZXdQYWdlPWZ1bmN0aW9uKCl7dGhpcy5wYWdlc1srK3RoaXMucGFnZV09bmV3IFVpbnQ4QXJyYXkoQnl0ZUFycmF5LnBhZ2VTaXplKTt0aGlzLmN1cnNvcj0wfTtCeXRlQXJyYXkucHJvdG90eXBlLmdldERhdGE9ZnVuY3Rpb24oKXt2YXIgcnY9XCJcIjtmb3IodmFyIHA9MDtwPHRoaXMucGFnZXMubGVuZ3RoO3ArKyl7Zm9yKHZhciBpPTA7aTxCeXRlQXJyYXkucGFnZVNpemU7aSsrKXtydis9Qnl0ZUFycmF5LmNoYXJNYXBbdGhpcy5wYWdlc1twXVtpXV19fXJldHVybiBydn07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZUJ5dGU9ZnVuY3Rpb24odmFsKXtpZih0aGlzLmN1cnNvcj49Qnl0ZUFycmF5LnBhZ2VTaXplKXRoaXMubmV3UGFnZSgpO3RoaXMucGFnZXNbdGhpcy5wYWdlXVt0aGlzLmN1cnNvcisrXT12YWx9O0J5dGVBcnJheS5wcm90b3R5cGUud3JpdGVVVEZCeXRlcz1mdW5jdGlvbihzdHJpbmcpe2Zvcih2YXIgbD1zdHJpbmcubGVuZ3RoLGk9MDtpPGw7aSsrKXRoaXMud3JpdGVCeXRlKHN0cmluZy5jaGFyQ29kZUF0KGkpKX07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZUJ5dGVzPWZ1bmN0aW9uKGFycmF5LG9mZnNldCxsZW5ndGgpe2Zvcih2YXIgbD1sZW5ndGh8fGFycmF5Lmxlbmd0aCxpPW9mZnNldHx8MDtpPGw7aSsrKXRoaXMud3JpdGVCeXRlKGFycmF5W2ldKX07ZnVuY3Rpb24gR0lGRW5jb2Rlcih3aWR0aCxoZWlnaHQpe3RoaXMud2lkdGg9fn53aWR0aDt0aGlzLmhlaWdodD1+fmhlaWdodDt0aGlzLnRyYW5zcGFyZW50PW51bGw7dGhpcy50cmFuc0luZGV4PTA7dGhpcy5yZXBlYXQ9LTE7dGhpcy5kZWxheT0wO3RoaXMuaW1hZ2U9bnVsbDt0aGlzLnBpeGVscz1udWxsO3RoaXMuaW5kZXhlZFBpeGVscz1udWxsO3RoaXMuY29sb3JEZXB0aD1udWxsO3RoaXMuY29sb3JUYWI9bnVsbDt0aGlzLm5ldVF1YW50PW51bGw7dGhpcy51c2VkRW50cnk9bmV3IEFycmF5O3RoaXMucGFsU2l6ZT03O3RoaXMuZGlzcG9zZT0tMTt0aGlzLmZpcnN0RnJhbWU9dHJ1ZTt0aGlzLnNhbXBsZT0xMDt0aGlzLmRpdGhlcj1mYWxzZTt0aGlzLmdsb2JhbFBhbGV0dGU9ZmFsc2U7dGhpcy5vdXQ9bmV3IEJ5dGVBcnJheX1HSUZFbmNvZGVyLnByb3RvdHlwZS5zZXREZWxheT1mdW5jdGlvbihtaWxsaXNlY29uZHMpe3RoaXMuZGVsYXk9TWF0aC5yb3VuZChtaWxsaXNlY29uZHMvMTApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRGcmFtZVJhdGU9ZnVuY3Rpb24oZnBzKXt0aGlzLmRlbGF5PU1hdGgucm91bmQoMTAwL2Zwcyl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldERpc3Bvc2U9ZnVuY3Rpb24oZGlzcG9zYWxDb2RlKXtpZihkaXNwb3NhbENvZGU+PTApdGhpcy5kaXNwb3NlPWRpc3Bvc2FsQ29kZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0UmVwZWF0PWZ1bmN0aW9uKHJlcGVhdCl7dGhpcy5yZXBlYXQ9cmVwZWF0fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRUcmFuc3BhcmVudD1mdW5jdGlvbihjb2xvcil7dGhpcy50cmFuc3BhcmVudD1jb2xvcn07R0lGRW5jb2Rlci5wcm90b3R5cGUuYWRkRnJhbWU9ZnVuY3Rpb24oaW1hZ2VEYXRhKXt0aGlzLmltYWdlPWltYWdlRGF0YTt0aGlzLmNvbG9yVGFiPXRoaXMuZ2xvYmFsUGFsZXR0ZSYmdGhpcy5nbG9iYWxQYWxldHRlLnNsaWNlP3RoaXMuZ2xvYmFsUGFsZXR0ZTpudWxsO3RoaXMuZ2V0SW1hZ2VQaXhlbHMoKTt0aGlzLmFuYWx5emVQaXhlbHMoKTtpZih0aGlzLmdsb2JhbFBhbGV0dGU9PT10cnVlKXRoaXMuZ2xvYmFsUGFsZXR0ZT10aGlzLmNvbG9yVGFiO2lmKHRoaXMuZmlyc3RGcmFtZSl7dGhpcy53cml0ZUxTRCgpO3RoaXMud3JpdGVQYWxldHRlKCk7aWYodGhpcy5yZXBlYXQ+PTApe3RoaXMud3JpdGVOZXRzY2FwZUV4dCgpfX10aGlzLndyaXRlR3JhcGhpY0N0cmxFeHQoKTt0aGlzLndyaXRlSW1hZ2VEZXNjKCk7aWYoIXRoaXMuZmlyc3RGcmFtZSYmIXRoaXMuZ2xvYmFsUGFsZXR0ZSl0aGlzLndyaXRlUGFsZXR0ZSgpO3RoaXMud3JpdGVQaXhlbHMoKTt0aGlzLmZpcnN0RnJhbWU9ZmFsc2V9O0dJRkVuY29kZXIucHJvdG90eXBlLmZpbmlzaD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSg1OSl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFF1YWxpdHk9ZnVuY3Rpb24ocXVhbGl0eSl7aWYocXVhbGl0eTwxKXF1YWxpdHk9MTt0aGlzLnNhbXBsZT1xdWFsaXR5fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXREaXRoZXI9ZnVuY3Rpb24oZGl0aGVyKXtpZihkaXRoZXI9PT10cnVlKWRpdGhlcj1cIkZsb3lkU3RlaW5iZXJnXCI7dGhpcy5kaXRoZXI9ZGl0aGVyfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRHbG9iYWxQYWxldHRlPWZ1bmN0aW9uKHBhbGV0dGUpe3RoaXMuZ2xvYmFsUGFsZXR0ZT1wYWxldHRlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5nZXRHbG9iYWxQYWxldHRlPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZ2xvYmFsUGFsZXR0ZSYmdGhpcy5nbG9iYWxQYWxldHRlLnNsaWNlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2UoMCl8fHRoaXMuZ2xvYmFsUGFsZXR0ZX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVIZWFkZXI9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZVVURkJ5dGVzKFwiR0lGODlhXCIpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5hbmFseXplUGl4ZWxzPWZ1bmN0aW9uKCl7aWYoIXRoaXMuY29sb3JUYWIpe3RoaXMubmV1UXVhbnQ9bmV3IE5ldVF1YW50KHRoaXMucGl4ZWxzLHRoaXMuc2FtcGxlKTt0aGlzLm5ldVF1YW50LmJ1aWxkQ29sb3JtYXAoKTt0aGlzLmNvbG9yVGFiPXRoaXMubmV1UXVhbnQuZ2V0Q29sb3JtYXAoKX1pZih0aGlzLmRpdGhlcil7dGhpcy5kaXRoZXJQaXhlbHModGhpcy5kaXRoZXIucmVwbGFjZShcIi1zZXJwZW50aW5lXCIsXCJcIiksdGhpcy5kaXRoZXIubWF0Y2goLy1zZXJwZW50aW5lLykhPT1udWxsKX1lbHNle3RoaXMuaW5kZXhQaXhlbHMoKX10aGlzLnBpeGVscz1udWxsO3RoaXMuY29sb3JEZXB0aD04O3RoaXMucGFsU2l6ZT03O2lmKHRoaXMudHJhbnNwYXJlbnQhPT1udWxsKXt0aGlzLnRyYW5zSW5kZXg9dGhpcy5maW5kQ2xvc2VzdCh0aGlzLnRyYW5zcGFyZW50LHRydWUpfX07R0lGRW5jb2Rlci5wcm90b3R5cGUuaW5kZXhQaXhlbHM9ZnVuY3Rpb24oaW1ncSl7dmFyIG5QaXg9dGhpcy5waXhlbHMubGVuZ3RoLzM7dGhpcy5pbmRleGVkUGl4ZWxzPW5ldyBVaW50OEFycmF5KG5QaXgpO3ZhciBrPTA7Zm9yKHZhciBqPTA7ajxuUGl4O2orKyl7dmFyIGluZGV4PXRoaXMuZmluZENsb3Nlc3RSR0IodGhpcy5waXhlbHNbaysrXSYyNTUsdGhpcy5waXhlbHNbaysrXSYyNTUsdGhpcy5waXhlbHNbaysrXSYyNTUpO3RoaXMudXNlZEVudHJ5W2luZGV4XT10cnVlO3RoaXMuaW5kZXhlZFBpeGVsc1tqXT1pbmRleH19O0dJRkVuY29kZXIucHJvdG90eXBlLmRpdGhlclBpeGVscz1mdW5jdGlvbihrZXJuZWwsc2VycGVudGluZSl7dmFyIGtlcm5lbHM9e0ZhbHNlRmxveWRTdGVpbmJlcmc6W1szLzgsMSwwXSxbMy84LDAsMV0sWzIvOCwxLDFdXSxGbG95ZFN0ZWluYmVyZzpbWzcvMTYsMSwwXSxbMy8xNiwtMSwxXSxbNS8xNiwwLDFdLFsxLzE2LDEsMV1dLFN0dWNraTpbWzgvNDIsMSwwXSxbNC80MiwyLDBdLFsyLzQyLC0yLDFdLFs0LzQyLC0xLDFdLFs4LzQyLDAsMV0sWzQvNDIsMSwxXSxbMi80MiwyLDFdLFsxLzQyLC0yLDJdLFsyLzQyLC0xLDJdLFs0LzQyLDAsMl0sWzIvNDIsMSwyXSxbMS80MiwyLDJdXSxBdGtpbnNvbjpbWzEvOCwxLDBdLFsxLzgsMiwwXSxbMS84LC0xLDFdLFsxLzgsMCwxXSxbMS84LDEsMV0sWzEvOCwwLDJdXX07aWYoIWtlcm5lbHx8IWtlcm5lbHNba2VybmVsXSl7dGhyb3dcIlVua25vd24gZGl0aGVyaW5nIGtlcm5lbDogXCIra2VybmVsfXZhciBkcz1rZXJuZWxzW2tlcm5lbF07dmFyIGluZGV4PTAsaGVpZ2h0PXRoaXMuaGVpZ2h0LHdpZHRoPXRoaXMud2lkdGgsZGF0YT10aGlzLnBpeGVsczt2YXIgZGlyZWN0aW9uPXNlcnBlbnRpbmU/LTE6MTt0aGlzLmluZGV4ZWRQaXhlbHM9bmV3IFVpbnQ4QXJyYXkodGhpcy5waXhlbHMubGVuZ3RoLzMpO2Zvcih2YXIgeT0wO3k8aGVpZ2h0O3krKyl7aWYoc2VycGVudGluZSlkaXJlY3Rpb249ZGlyZWN0aW9uKi0xO2Zvcih2YXIgeD1kaXJlY3Rpb249PTE/MDp3aWR0aC0xLHhlbmQ9ZGlyZWN0aW9uPT0xP3dpZHRoOjA7eCE9PXhlbmQ7eCs9ZGlyZWN0aW9uKXtpbmRleD15KndpZHRoK3g7dmFyIGlkeD1pbmRleCozO3ZhciByMT1kYXRhW2lkeF07dmFyIGcxPWRhdGFbaWR4KzFdO3ZhciBiMT1kYXRhW2lkeCsyXTtpZHg9dGhpcy5maW5kQ2xvc2VzdFJHQihyMSxnMSxiMSk7dGhpcy51c2VkRW50cnlbaWR4XT10cnVlO3RoaXMuaW5kZXhlZFBpeGVsc1tpbmRleF09aWR4O2lkeCo9Mzt2YXIgcjI9dGhpcy5jb2xvclRhYltpZHhdO3ZhciBnMj10aGlzLmNvbG9yVGFiW2lkeCsxXTt2YXIgYjI9dGhpcy5jb2xvclRhYltpZHgrMl07dmFyIGVyPXIxLXIyO3ZhciBlZz1nMS1nMjt2YXIgZWI9YjEtYjI7Zm9yKHZhciBpPWRpcmVjdGlvbj09MT8wOmRzLmxlbmd0aC0xLGVuZD1kaXJlY3Rpb249PTE/ZHMubGVuZ3RoOjA7aSE9PWVuZDtpKz1kaXJlY3Rpb24pe3ZhciB4MT1kc1tpXVsxXTt2YXIgeTE9ZHNbaV1bMl07aWYoeDEreD49MCYmeDEreDx3aWR0aCYmeTEreT49MCYmeTEreTxoZWlnaHQpe3ZhciBkPWRzW2ldWzBdO2lkeD1pbmRleCt4MSt5MSp3aWR0aDtpZHgqPTM7ZGF0YVtpZHhdPU1hdGgubWF4KDAsTWF0aC5taW4oMjU1LGRhdGFbaWR4XStlcipkKSk7ZGF0YVtpZHgrMV09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHgrMV0rZWcqZCkpO2RhdGFbaWR4KzJdPU1hdGgubWF4KDAsTWF0aC5taW4oMjU1LGRhdGFbaWR4KzJdK2ViKmQpKX19fX19O0dJRkVuY29kZXIucHJvdG90eXBlLmZpbmRDbG9zZXN0PWZ1bmN0aW9uKGMsdXNlZCl7cmV0dXJuIHRoaXMuZmluZENsb3Nlc3RSR0IoKGMmMTY3MTE2ODApPj4xNiwoYyY2NTI4MCk+PjgsYyYyNTUsdXNlZCl9O0dJRkVuY29kZXIucHJvdG90eXBlLmZpbmRDbG9zZXN0UkdCPWZ1bmN0aW9uKHIsZyxiLHVzZWQpe2lmKHRoaXMuY29sb3JUYWI9PT1udWxsKXJldHVybi0xO2lmKHRoaXMubmV1UXVhbnQmJiF1c2VkKXtyZXR1cm4gdGhpcy5uZXVRdWFudC5sb29rdXBSR0IocixnLGIpfXZhciBjPWJ8Zzw8OHxyPDwxNjt2YXIgbWlucG9zPTA7dmFyIGRtaW49MjU2KjI1NioyNTY7dmFyIGxlbj10aGlzLmNvbG9yVGFiLmxlbmd0aDtmb3IodmFyIGk9MCxpbmRleD0wO2k8bGVuO2luZGV4Kyspe3ZhciBkcj1yLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZGc9Zy0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGRiPWItKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkPWRyKmRyK2RnKmRnK2RiKmRiO2lmKCghdXNlZHx8dGhpcy51c2VkRW50cnlbaW5kZXhdKSYmZDxkbWluKXtkbWluPWQ7bWlucG9zPWluZGV4fX1yZXR1cm4gbWlucG9zfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5nZXRJbWFnZVBpeGVscz1mdW5jdGlvbigpe3ZhciB3PXRoaXMud2lkdGg7dmFyIGg9dGhpcy5oZWlnaHQ7dGhpcy5waXhlbHM9bmV3IFVpbnQ4QXJyYXkodypoKjMpO3ZhciBkYXRhPXRoaXMuaW1hZ2U7dmFyIHNyY1Bvcz0wO3ZhciBjb3VudD0wO2Zvcih2YXIgaT0wO2k8aDtpKyspe2Zvcih2YXIgaj0wO2o8dztqKyspe3RoaXMucGl4ZWxzW2NvdW50KytdPWRhdGFbc3JjUG9zKytdO3RoaXMucGl4ZWxzW2NvdW50KytdPWRhdGFbc3JjUG9zKytdO3RoaXMucGl4ZWxzW2NvdW50KytdPWRhdGFbc3JjUG9zKytdO3NyY1BvcysrfX19O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlR3JhcGhpY0N0cmxFeHQ9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoMzMpO3RoaXMub3V0LndyaXRlQnl0ZSgyNDkpO3RoaXMub3V0LndyaXRlQnl0ZSg0KTt2YXIgdHJhbnNwLGRpc3A7aWYodGhpcy50cmFuc3BhcmVudD09PW51bGwpe3RyYW5zcD0wO2Rpc3A9MH1lbHNle3RyYW5zcD0xO2Rpc3A9Mn1pZih0aGlzLmRpc3Bvc2U+PTApe2Rpc3A9dGhpcy5kaXNwb3NlJjd9ZGlzcDw8PTI7dGhpcy5vdXQud3JpdGVCeXRlKDB8ZGlzcHwwfHRyYW5zcCk7dGhpcy53cml0ZVNob3J0KHRoaXMuZGVsYXkpO3RoaXMub3V0LndyaXRlQnl0ZSh0aGlzLnRyYW5zSW5kZXgpO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVJbWFnZURlc2M9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoNDQpO3RoaXMud3JpdGVTaG9ydCgwKTt0aGlzLndyaXRlU2hvcnQoMCk7dGhpcy53cml0ZVNob3J0KHRoaXMud2lkdGgpO3RoaXMud3JpdGVTaG9ydCh0aGlzLmhlaWdodCk7aWYodGhpcy5maXJzdEZyYW1lfHx0aGlzLmdsb2JhbFBhbGV0dGUpe3RoaXMub3V0LndyaXRlQnl0ZSgwKX1lbHNle3RoaXMub3V0LndyaXRlQnl0ZSgxMjh8MHwwfDB8dGhpcy5wYWxTaXplKX19O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlTFNEPWZ1bmN0aW9uKCl7dGhpcy53cml0ZVNob3J0KHRoaXMud2lkdGgpO3RoaXMud3JpdGVTaG9ydCh0aGlzLmhlaWdodCk7dGhpcy5vdXQud3JpdGVCeXRlKDEyOHwxMTJ8MHx0aGlzLnBhbFNpemUpO3RoaXMub3V0LndyaXRlQnl0ZSgwKTt0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlTmV0c2NhcGVFeHQ9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoMzMpO3RoaXMub3V0LndyaXRlQnl0ZSgyNTUpO3RoaXMub3V0LndyaXRlQnl0ZSgxMSk7dGhpcy5vdXQud3JpdGVVVEZCeXRlcyhcIk5FVFNDQVBFMi4wXCIpO3RoaXMub3V0LndyaXRlQnl0ZSgzKTt0aGlzLm91dC53cml0ZUJ5dGUoMSk7dGhpcy53cml0ZVNob3J0KHRoaXMucmVwZWF0KTt0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlUGFsZXR0ZT1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZXModGhpcy5jb2xvclRhYik7dmFyIG49MyoyNTYtdGhpcy5jb2xvclRhYi5sZW5ndGg7Zm9yKHZhciBpPTA7aTxuO2krKyl0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlU2hvcnQ9ZnVuY3Rpb24ocFZhbHVlKXt0aGlzLm91dC53cml0ZUJ5dGUocFZhbHVlJjI1NSk7dGhpcy5vdXQud3JpdGVCeXRlKHBWYWx1ZT4+OCYyNTUpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZVBpeGVscz1mdW5jdGlvbigpe3ZhciBlbmM9bmV3IExaV0VuY29kZXIodGhpcy53aWR0aCx0aGlzLmhlaWdodCx0aGlzLmluZGV4ZWRQaXhlbHMsdGhpcy5jb2xvckRlcHRoKTtlbmMuZW5jb2RlKHRoaXMub3V0KX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc3RyZWFtPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMub3V0fTttb2R1bGUuZXhwb3J0cz1HSUZFbmNvZGVyfSx7XCIuL0xaV0VuY29kZXIuanNcIjozLFwiLi9UeXBlZE5ldVF1YW50LmpzXCI6NH1dLDM6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBFT0Y9LTE7dmFyIEJJVFM9MTI7dmFyIEhTSVpFPTUwMDM7dmFyIG1hc2tzPVswLDEsMyw3LDE1LDMxLDYzLDEyNywyNTUsNTExLDEwMjMsMjA0Nyw0MDk1LDgxOTEsMTYzODMsMzI3NjcsNjU1MzVdO2Z1bmN0aW9uIExaV0VuY29kZXIod2lkdGgsaGVpZ2h0LHBpeGVscyxjb2xvckRlcHRoKXt2YXIgaW5pdENvZGVTaXplPU1hdGgubWF4KDIsY29sb3JEZXB0aCk7dmFyIGFjY3VtPW5ldyBVaW50OEFycmF5KDI1Nik7dmFyIGh0YWI9bmV3IEludDMyQXJyYXkoSFNJWkUpO3ZhciBjb2RldGFiPW5ldyBJbnQzMkFycmF5KEhTSVpFKTt2YXIgY3VyX2FjY3VtLGN1cl9iaXRzPTA7dmFyIGFfY291bnQ7dmFyIGZyZWVfZW50PTA7dmFyIG1heGNvZGU7dmFyIGNsZWFyX2ZsZz1mYWxzZTt2YXIgZ19pbml0X2JpdHMsQ2xlYXJDb2RlLEVPRkNvZGU7ZnVuY3Rpb24gY2hhcl9vdXQoYyxvdXRzKXthY2N1bVthX2NvdW50KytdPWM7aWYoYV9jb3VudD49MjU0KWZsdXNoX2NoYXIob3V0cyl9ZnVuY3Rpb24gY2xfYmxvY2sob3V0cyl7Y2xfaGFzaChIU0laRSk7ZnJlZV9lbnQ9Q2xlYXJDb2RlKzI7Y2xlYXJfZmxnPXRydWU7b3V0cHV0KENsZWFyQ29kZSxvdXRzKX1mdW5jdGlvbiBjbF9oYXNoKGhzaXplKXtmb3IodmFyIGk9MDtpPGhzaXplOysraSlodGFiW2ldPS0xfWZ1bmN0aW9uIGNvbXByZXNzKGluaXRfYml0cyxvdXRzKXt2YXIgZmNvZGUsYyxpLGVudCxkaXNwLGhzaXplX3JlZyxoc2hpZnQ7Z19pbml0X2JpdHM9aW5pdF9iaXRzO2NsZWFyX2ZsZz1mYWxzZTtuX2JpdHM9Z19pbml0X2JpdHM7bWF4Y29kZT1NQVhDT0RFKG5fYml0cyk7Q2xlYXJDb2RlPTE8PGluaXRfYml0cy0xO0VPRkNvZGU9Q2xlYXJDb2RlKzE7ZnJlZV9lbnQ9Q2xlYXJDb2RlKzI7YV9jb3VudD0wO2VudD1uZXh0UGl4ZWwoKTtoc2hpZnQ9MDtmb3IoZmNvZGU9SFNJWkU7ZmNvZGU8NjU1MzY7ZmNvZGUqPTIpKytoc2hpZnQ7aHNoaWZ0PTgtaHNoaWZ0O2hzaXplX3JlZz1IU0laRTtjbF9oYXNoKGhzaXplX3JlZyk7b3V0cHV0KENsZWFyQ29kZSxvdXRzKTtvdXRlcl9sb29wOndoaWxlKChjPW5leHRQaXhlbCgpKSE9RU9GKXtmY29kZT0oYzw8QklUUykrZW50O2k9Yzw8aHNoaWZ0XmVudDtpZihodGFiW2ldPT09ZmNvZGUpe2VudD1jb2RldGFiW2ldO2NvbnRpbnVlfWVsc2UgaWYoaHRhYltpXT49MCl7ZGlzcD1oc2l6ZV9yZWctaTtpZihpPT09MClkaXNwPTE7ZG97aWYoKGktPWRpc3ApPDApaSs9aHNpemVfcmVnO2lmKGh0YWJbaV09PT1mY29kZSl7ZW50PWNvZGV0YWJbaV07Y29udGludWUgb3V0ZXJfbG9vcH19d2hpbGUoaHRhYltpXT49MCl9b3V0cHV0KGVudCxvdXRzKTtlbnQ9YztpZihmcmVlX2VudDwxPDxCSVRTKXtjb2RldGFiW2ldPWZyZWVfZW50Kys7aHRhYltpXT1mY29kZX1lbHNle2NsX2Jsb2NrKG91dHMpfX1vdXRwdXQoZW50LG91dHMpO291dHB1dChFT0ZDb2RlLG91dHMpfWZ1bmN0aW9uIGVuY29kZShvdXRzKXtvdXRzLndyaXRlQnl0ZShpbml0Q29kZVNpemUpO3JlbWFpbmluZz13aWR0aCpoZWlnaHQ7Y3VyUGl4ZWw9MDtjb21wcmVzcyhpbml0Q29kZVNpemUrMSxvdXRzKTtvdXRzLndyaXRlQnl0ZSgwKX1mdW5jdGlvbiBmbHVzaF9jaGFyKG91dHMpe2lmKGFfY291bnQ+MCl7b3V0cy53cml0ZUJ5dGUoYV9jb3VudCk7b3V0cy53cml0ZUJ5dGVzKGFjY3VtLDAsYV9jb3VudCk7YV9jb3VudD0wfX1mdW5jdGlvbiBNQVhDT0RFKG5fYml0cyl7cmV0dXJuKDE8PG5fYml0cyktMX1mdW5jdGlvbiBuZXh0UGl4ZWwoKXtpZihyZW1haW5pbmc9PT0wKXJldHVybiBFT0Y7LS1yZW1haW5pbmc7dmFyIHBpeD1waXhlbHNbY3VyUGl4ZWwrK107cmV0dXJuIHBpeCYyNTV9ZnVuY3Rpb24gb3V0cHV0KGNvZGUsb3V0cyl7Y3VyX2FjY3VtJj1tYXNrc1tjdXJfYml0c107aWYoY3VyX2JpdHM+MCljdXJfYWNjdW18PWNvZGU8PGN1cl9iaXRzO2Vsc2UgY3VyX2FjY3VtPWNvZGU7Y3VyX2JpdHMrPW5fYml0czt3aGlsZShjdXJfYml0cz49OCl7Y2hhcl9vdXQoY3VyX2FjY3VtJjI1NSxvdXRzKTtjdXJfYWNjdW0+Pj04O2N1cl9iaXRzLT04fWlmKGZyZWVfZW50Pm1heGNvZGV8fGNsZWFyX2ZsZyl7aWYoY2xlYXJfZmxnKXttYXhjb2RlPU1BWENPREUobl9iaXRzPWdfaW5pdF9iaXRzKTtjbGVhcl9mbGc9ZmFsc2V9ZWxzZXsrK25fYml0cztpZihuX2JpdHM9PUJJVFMpbWF4Y29kZT0xPDxCSVRTO2Vsc2UgbWF4Y29kZT1NQVhDT0RFKG5fYml0cyl9fWlmKGNvZGU9PUVPRkNvZGUpe3doaWxlKGN1cl9iaXRzPjApe2NoYXJfb3V0KGN1cl9hY2N1bSYyNTUsb3V0cyk7Y3VyX2FjY3VtPj49ODtjdXJfYml0cy09OH1mbHVzaF9jaGFyKG91dHMpfX10aGlzLmVuY29kZT1lbmNvZGV9bW9kdWxlLmV4cG9ydHM9TFpXRW5jb2Rlcn0se31dLDQ6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBuY3ljbGVzPTEwMDt2YXIgbmV0c2l6ZT0yNTY7dmFyIG1heG5ldHBvcz1uZXRzaXplLTE7dmFyIG5ldGJpYXNzaGlmdD00O3ZhciBpbnRiaWFzc2hpZnQ9MTY7dmFyIGludGJpYXM9MTw8aW50Ymlhc3NoaWZ0O3ZhciBnYW1tYXNoaWZ0PTEwO3ZhciBnYW1tYT0xPDxnYW1tYXNoaWZ0O3ZhciBiZXRhc2hpZnQ9MTA7dmFyIGJldGE9aW50Ymlhcz4+YmV0YXNoaWZ0O3ZhciBiZXRhZ2FtbWE9aW50Ymlhczw8Z2FtbWFzaGlmdC1iZXRhc2hpZnQ7dmFyIGluaXRyYWQ9bmV0c2l6ZT4+Mzt2YXIgcmFkaXVzYmlhc3NoaWZ0PTY7dmFyIHJhZGl1c2JpYXM9MTw8cmFkaXVzYmlhc3NoaWZ0O3ZhciBpbml0cmFkaXVzPWluaXRyYWQqcmFkaXVzYmlhczt2YXIgcmFkaXVzZGVjPTMwO3ZhciBhbHBoYWJpYXNzaGlmdD0xMDt2YXIgaW5pdGFscGhhPTE8PGFscGhhYmlhc3NoaWZ0O3ZhciBhbHBoYWRlYzt2YXIgcmFkYmlhc3NoaWZ0PTg7dmFyIHJhZGJpYXM9MTw8cmFkYmlhc3NoaWZ0O3ZhciBhbHBoYXJhZGJzaGlmdD1hbHBoYWJpYXNzaGlmdCtyYWRiaWFzc2hpZnQ7dmFyIGFscGhhcmFkYmlhcz0xPDxhbHBoYXJhZGJzaGlmdDt2YXIgcHJpbWUxPTQ5OTt2YXIgcHJpbWUyPTQ5MTt2YXIgcHJpbWUzPTQ4Nzt2YXIgcHJpbWU0PTUwMzt2YXIgbWlucGljdHVyZWJ5dGVzPTMqcHJpbWU0O2Z1bmN0aW9uIE5ldVF1YW50KHBpeGVscyxzYW1wbGVmYWMpe3ZhciBuZXR3b3JrO3ZhciBuZXRpbmRleDt2YXIgYmlhczt2YXIgZnJlcTt2YXIgcmFkcG93ZXI7ZnVuY3Rpb24gaW5pdCgpe25ldHdvcms9W107bmV0aW5kZXg9bmV3IEludDMyQXJyYXkoMjU2KTtiaWFzPW5ldyBJbnQzMkFycmF5KG5ldHNpemUpO2ZyZXE9bmV3IEludDMyQXJyYXkobmV0c2l6ZSk7cmFkcG93ZXI9bmV3IEludDMyQXJyYXkobmV0c2l6ZT4+Myk7dmFyIGksdjtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe3Y9KGk8PG5ldGJpYXNzaGlmdCs4KS9uZXRzaXplO25ldHdvcmtbaV09bmV3IEZsb2F0NjRBcnJheShbdix2LHYsMF0pO2ZyZXFbaV09aW50Ymlhcy9uZXRzaXplO2JpYXNbaV09MH19ZnVuY3Rpb24gdW5iaWFzbmV0KCl7Zm9yKHZhciBpPTA7aTxuZXRzaXplO2krKyl7bmV0d29ya1tpXVswXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzFdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bMl0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVszXT1pfX1mdW5jdGlvbiBhbHRlcnNpbmdsZShhbHBoYSxpLGIsZyxyKXtuZXR3b3JrW2ldWzBdLT1hbHBoYSoobmV0d29ya1tpXVswXS1iKS9pbml0YWxwaGE7bmV0d29ya1tpXVsxXS09YWxwaGEqKG5ldHdvcmtbaV1bMV0tZykvaW5pdGFscGhhO25ldHdvcmtbaV1bMl0tPWFscGhhKihuZXR3b3JrW2ldWzJdLXIpL2luaXRhbHBoYX1mdW5jdGlvbiBhbHRlcm5laWdoKHJhZGl1cyxpLGIsZyxyKXt2YXIgbG89TWF0aC5hYnMoaS1yYWRpdXMpO3ZhciBoaT1NYXRoLm1pbihpK3JhZGl1cyxuZXRzaXplKTt2YXIgaj1pKzE7dmFyIGs9aS0xO3ZhciBtPTE7dmFyIHAsYTt3aGlsZShqPGhpfHxrPmxvKXthPXJhZHBvd2VyW20rK107aWYoajxoaSl7cD1uZXR3b3JrW2orK107cFswXS09YSoocFswXS1iKS9hbHBoYXJhZGJpYXM7cFsxXS09YSoocFsxXS1nKS9hbHBoYXJhZGJpYXM7cFsyXS09YSoocFsyXS1yKS9hbHBoYXJhZGJpYXN9aWYoaz5sbyl7cD1uZXR3b3JrW2stLV07cFswXS09YSoocFswXS1iKS9hbHBoYXJhZGJpYXM7cFsxXS09YSoocFsxXS1nKS9hbHBoYXJhZGJpYXM7cFsyXS09YSoocFsyXS1yKS9hbHBoYXJhZGJpYXN9fX1mdW5jdGlvbiBjb250ZXN0KGIsZyxyKXt2YXIgYmVzdGQ9figxPDwzMSk7dmFyIGJlc3RiaWFzZD1iZXN0ZDt2YXIgYmVzdHBvcz0tMTt2YXIgYmVzdGJpYXNwb3M9YmVzdHBvczt2YXIgaSxuLGRpc3QsYmlhc2Rpc3QsYmV0YWZyZXE7Zm9yKGk9MDtpPG5ldHNpemU7aSsrKXtuPW5ldHdvcmtbaV07ZGlzdD1NYXRoLmFicyhuWzBdLWIpK01hdGguYWJzKG5bMV0tZykrTWF0aC5hYnMoblsyXS1yKTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Rwb3M9aX1iaWFzZGlzdD1kaXN0LShiaWFzW2ldPj5pbnRiaWFzc2hpZnQtbmV0Ymlhc3NoaWZ0KTtpZihiaWFzZGlzdDxiZXN0Ymlhc2Qpe2Jlc3RiaWFzZD1iaWFzZGlzdDtiZXN0Ymlhc3Bvcz1pfWJldGFmcmVxPWZyZXFbaV0+PmJldGFzaGlmdDtmcmVxW2ldLT1iZXRhZnJlcTtiaWFzW2ldKz1iZXRhZnJlcTw8Z2FtbWFzaGlmdH1mcmVxW2Jlc3Rwb3NdKz1iZXRhO2JpYXNbYmVzdHBvc10tPWJldGFnYW1tYTtyZXR1cm4gYmVzdGJpYXNwb3N9ZnVuY3Rpb24gaW54YnVpbGQoKXt2YXIgaSxqLHAscSxzbWFsbHBvcyxzbWFsbHZhbCxwcmV2aW91c2NvbD0wLHN0YXJ0cG9zPTA7Zm9yKGk9MDtpPG5ldHNpemU7aSsrKXtwPW5ldHdvcmtbaV07c21hbGxwb3M9aTtzbWFsbHZhbD1wWzFdO2ZvcihqPWkrMTtqPG5ldHNpemU7aisrKXtxPW5ldHdvcmtbal07aWYocVsxXTxzbWFsbHZhbCl7c21hbGxwb3M9ajtzbWFsbHZhbD1xWzFdfX1xPW5ldHdvcmtbc21hbGxwb3NdO2lmKGkhPXNtYWxscG9zKXtqPXFbMF07cVswXT1wWzBdO3BbMF09ajtqPXFbMV07cVsxXT1wWzFdO3BbMV09ajtqPXFbMl07cVsyXT1wWzJdO3BbMl09ajtqPXFbM107cVszXT1wWzNdO3BbM109an1pZihzbWFsbHZhbCE9cHJldmlvdXNjb2wpe25ldGluZGV4W3ByZXZpb3VzY29sXT1zdGFydHBvcytpPj4xO2ZvcihqPXByZXZpb3VzY29sKzE7ajxzbWFsbHZhbDtqKyspbmV0aW5kZXhbal09aTtwcmV2aW91c2NvbD1zbWFsbHZhbDtzdGFydHBvcz1pfX1uZXRpbmRleFtwcmV2aW91c2NvbF09c3RhcnRwb3MrbWF4bmV0cG9zPj4xO2ZvcihqPXByZXZpb3VzY29sKzE7ajwyNTY7aisrKW5ldGluZGV4W2pdPW1heG5ldHBvc31mdW5jdGlvbiBpbnhzZWFyY2goYixnLHIpe3ZhciBhLHAsZGlzdDt2YXIgYmVzdGQ9MWUzO3ZhciBiZXN0PS0xO3ZhciBpPW5ldGluZGV4W2ddO3ZhciBqPWktMTt3aGlsZShpPG5ldHNpemV8fGo+PTApe2lmKGk8bmV0c2l6ZSl7cD1uZXR3b3JrW2ldO2Rpc3Q9cFsxXS1nO2lmKGRpc3Q+PWJlc3RkKWk9bmV0c2l6ZTtlbHNle2krKztpZihkaXN0PDApZGlzdD0tZGlzdDthPXBbMF0tYjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2E9cFsyXS1yO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0PXBbM119fX19aWYoaj49MCl7cD1uZXR3b3JrW2pdO2Rpc3Q9Zy1wWzFdO2lmKGRpc3Q+PWJlc3RkKWo9LTE7ZWxzZXtqLS07aWYoZGlzdDwwKWRpc3Q9LWRpc3Q7YT1wWzBdLWI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXthPXBbMl0tcjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdD1wWzNdfX19fX1yZXR1cm4gYmVzdH1mdW5jdGlvbiBsZWFybigpe3ZhciBpO3ZhciBsZW5ndGhjb3VudD1waXhlbHMubGVuZ3RoO3ZhciBhbHBoYWRlYz0zMCsoc2FtcGxlZmFjLTEpLzM7dmFyIHNhbXBsZXBpeGVscz1sZW5ndGhjb3VudC8oMypzYW1wbGVmYWMpO3ZhciBkZWx0YT1+fihzYW1wbGVwaXhlbHMvbmN5Y2xlcyk7dmFyIGFscGhhPWluaXRhbHBoYTt2YXIgcmFkaXVzPWluaXRyYWRpdXM7dmFyIHJhZD1yYWRpdXM+PnJhZGl1c2JpYXNzaGlmdDtpZihyYWQ8PTEpcmFkPTA7Zm9yKGk9MDtpPHJhZDtpKyspcmFkcG93ZXJbaV09YWxwaGEqKChyYWQqcmFkLWkqaSkqcmFkYmlhcy8ocmFkKnJhZCkpO3ZhciBzdGVwO2lmKGxlbmd0aGNvdW50PG1pbnBpY3R1cmVieXRlcyl7c2FtcGxlZmFjPTE7c3RlcD0zfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUxIT09MCl7c3RlcD0zKnByaW1lMX1lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMiE9PTApe3N0ZXA9MypwcmltZTJ9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTMhPT0wKXtzdGVwPTMqcHJpbWUzfWVsc2V7c3RlcD0zKnByaW1lNH12YXIgYixnLHIsajt2YXIgcGl4PTA7aT0wO3doaWxlKGk8c2FtcGxlcGl4ZWxzKXtiPShwaXhlbHNbcGl4XSYyNTUpPDxuZXRiaWFzc2hpZnQ7Zz0ocGl4ZWxzW3BpeCsxXSYyNTUpPDxuZXRiaWFzc2hpZnQ7cj0ocGl4ZWxzW3BpeCsyXSYyNTUpPDxuZXRiaWFzc2hpZnQ7aj1jb250ZXN0KGIsZyxyKTthbHRlcnNpbmdsZShhbHBoYSxqLGIsZyxyKTtpZihyYWQhPT0wKWFsdGVybmVpZ2gocmFkLGosYixnLHIpO3BpeCs9c3RlcDtpZihwaXg+PWxlbmd0aGNvdW50KXBpeC09bGVuZ3RoY291bnQ7aSsrO2lmKGRlbHRhPT09MClkZWx0YT0xO2lmKGklZGVsdGE9PT0wKXthbHBoYS09YWxwaGEvYWxwaGFkZWM7cmFkaXVzLT1yYWRpdXMvcmFkaXVzZGVjO3JhZD1yYWRpdXM+PnJhZGl1c2JpYXNzaGlmdDtpZihyYWQ8PTEpcmFkPTA7Zm9yKGo9MDtqPHJhZDtqKyspcmFkcG93ZXJbal09YWxwaGEqKChyYWQqcmFkLWoqaikqcmFkYmlhcy8ocmFkKnJhZCkpfX19ZnVuY3Rpb24gYnVpbGRDb2xvcm1hcCgpe2luaXQoKTtsZWFybigpO3VuYmlhc25ldCgpO2lueGJ1aWxkKCl9dGhpcy5idWlsZENvbG9ybWFwPWJ1aWxkQ29sb3JtYXA7ZnVuY3Rpb24gZ2V0Q29sb3JtYXAoKXt2YXIgbWFwPVtdO3ZhciBpbmRleD1bXTtmb3IodmFyIGk9MDtpPG5ldHNpemU7aSsrKWluZGV4W25ldHdvcmtbaV1bM11dPWk7dmFyIGs9MDtmb3IodmFyIGw9MDtsPG5ldHNpemU7bCsrKXt2YXIgaj1pbmRleFtsXTttYXBbaysrXT1uZXR3b3JrW2pdWzBdO21hcFtrKytdPW5ldHdvcmtbal1bMV07bWFwW2srK109bmV0d29ya1tqXVsyXX1yZXR1cm4gbWFwfXRoaXMuZ2V0Q29sb3JtYXA9Z2V0Q29sb3JtYXA7dGhpcy5sb29rdXBSR0I9aW54c2VhcmNofW1vZHVsZS5leHBvcnRzPU5ldVF1YW50fSx7fV0sNTpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIFVBLGJyb3dzZXIsbW9kZSxwbGF0Zm9ybSx1YTt1YT1uYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7cGxhdGZvcm09bmF2aWdhdG9yLnBsYXRmb3JtLnRvTG93ZXJDYXNlKCk7VUE9dWEubWF0Y2goLyhvcGVyYXxpZXxmaXJlZm94fGNocm9tZXx2ZXJzaW9uKVtcXHNcXC86XShbXFx3XFxkXFwuXSspPy4qPyhzYWZhcml8dmVyc2lvbltcXHNcXC86XShbXFx3XFxkXFwuXSspfCQpLyl8fFtudWxsLFwidW5rbm93blwiLDBdO21vZGU9VUFbMV09PT1cImllXCImJmRvY3VtZW50LmRvY3VtZW50TW9kZTticm93c2VyPXtuYW1lOlVBWzFdPT09XCJ2ZXJzaW9uXCI/VUFbM106VUFbMV0sdmVyc2lvbjptb2RlfHxwYXJzZUZsb2F0KFVBWzFdPT09XCJvcGVyYVwiJiZVQVs0XT9VQVs0XTpVQVsyXSkscGxhdGZvcm06e25hbWU6dWEubWF0Y2goL2lwKD86YWR8b2R8aG9uZSkvKT9cImlvc1wiOih1YS5tYXRjaCgvKD86d2Vib3N8YW5kcm9pZCkvKXx8cGxhdGZvcm0ubWF0Y2goL21hY3x3aW58bGludXgvKXx8W1wib3RoZXJcIl0pWzBdfX07YnJvd3Nlclticm93c2VyLm5hbWVdPXRydWU7YnJvd3Nlclticm93c2VyLm5hbWUrcGFyc2VJbnQoYnJvd3Nlci52ZXJzaW9uLDEwKV09dHJ1ZTticm93c2VyLnBsYXRmb3JtW2Jyb3dzZXIucGxhdGZvcm0ubmFtZV09dHJ1ZTttb2R1bGUuZXhwb3J0cz1icm93c2VyfSx7fV0sNjpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEV2ZW50RW1pdHRlcixHSUYsR0lGRW5jb2Rlcixicm93c2VyLGdpZldvcmtlcixleHRlbmQ9ZnVuY3Rpb24oY2hpbGQscGFyZW50KXtmb3IodmFyIGtleSBpbiBwYXJlbnQpe2lmKGhhc1Byb3AuY2FsbChwYXJlbnQsa2V5KSljaGlsZFtrZXldPXBhcmVudFtrZXldfWZ1bmN0aW9uIGN0b3IoKXt0aGlzLmNvbnN0cnVjdG9yPWNoaWxkfWN0b3IucHJvdG90eXBlPXBhcmVudC5wcm90b3R5cGU7Y2hpbGQucHJvdG90eXBlPW5ldyBjdG9yO2NoaWxkLl9fc3VwZXJfXz1wYXJlbnQucHJvdG90eXBlO3JldHVybiBjaGlsZH0saGFzUHJvcD17fS5oYXNPd25Qcm9wZXJ0eSxpbmRleE9mPVtdLmluZGV4T2Z8fGZ1bmN0aW9uKGl0ZW0pe2Zvcih2YXIgaT0wLGw9dGhpcy5sZW5ndGg7aTxsO2krKyl7aWYoaSBpbiB0aGlzJiZ0aGlzW2ldPT09aXRlbSlyZXR1cm4gaX1yZXR1cm4tMX0sc2xpY2U9W10uc2xpY2U7RXZlbnRFbWl0dGVyPXJlcXVpcmUoXCJldmVudHNcIikuRXZlbnRFbWl0dGVyO2Jyb3dzZXI9cmVxdWlyZShcIi4vYnJvd3Nlci5jb2ZmZWVcIik7R0lGRW5jb2Rlcj1yZXF1aXJlKFwiLi9HSUZFbmNvZGVyLmpzXCIpO2dpZldvcmtlcj1yZXF1aXJlKFwiLi9naWYud29ya2VyLmNvZmZlZVwiKTttb2R1bGUuZXhwb3J0cz1HSUY9ZnVuY3Rpb24oc3VwZXJDbGFzcyl7dmFyIGRlZmF1bHRzLGZyYW1lRGVmYXVsdHM7ZXh0ZW5kKEdJRixzdXBlckNsYXNzKTtkZWZhdWx0cz17d29ya2VyU2NyaXB0OlwiZ2lmLndvcmtlci5qc1wiLHdvcmtlcnM6MixyZXBlYXQ6MCxiYWNrZ3JvdW5kOlwiI2ZmZlwiLHF1YWxpdHk6MTAsd2lkdGg6bnVsbCxoZWlnaHQ6bnVsbCx0cmFuc3BhcmVudDpudWxsLGRlYnVnOmZhbHNlLGRpdGhlcjpmYWxzZX07ZnJhbWVEZWZhdWx0cz17ZGVsYXk6NTAwLGNvcHk6ZmFsc2UsZGlzcG9zZTotMX07ZnVuY3Rpb24gR0lGKG9wdGlvbnMpe3ZhciBiYXNlLGtleSx2YWx1ZTt0aGlzLnJ1bm5pbmc9ZmFsc2U7dGhpcy5vcHRpb25zPXt9O3RoaXMuZnJhbWVzPVtdO3RoaXMuZnJlZVdvcmtlcnM9W107dGhpcy5hY3RpdmVXb3JrZXJzPVtdO3RoaXMuc2V0T3B0aW9ucyhvcHRpb25zKTtmb3Ioa2V5IGluIGRlZmF1bHRzKXt2YWx1ZT1kZWZhdWx0c1trZXldO2lmKChiYXNlPXRoaXMub3B0aW9ucylba2V5XT09bnVsbCl7YmFzZVtrZXldPXZhbHVlfX19R0lGLnByb3RvdHlwZS5zZXRPcHRpb249ZnVuY3Rpb24oa2V5LHZhbHVlKXt0aGlzLm9wdGlvbnNba2V5XT12YWx1ZTtpZih0aGlzLl9jYW52YXMhPW51bGwmJihrZXk9PT1cIndpZHRoXCJ8fGtleT09PVwiaGVpZ2h0XCIpKXtyZXR1cm4gdGhpcy5fY2FudmFzW2tleV09dmFsdWV9fTtHSUYucHJvdG90eXBlLnNldE9wdGlvbnM9ZnVuY3Rpb24ob3B0aW9ucyl7dmFyIGtleSxyZXN1bHRzLHZhbHVlO3Jlc3VsdHM9W107Zm9yKGtleSBpbiBvcHRpb25zKXtpZighaGFzUHJvcC5jYWxsKG9wdGlvbnMsa2V5KSljb250aW51ZTt2YWx1ZT1vcHRpb25zW2tleV07cmVzdWx0cy5wdXNoKHRoaXMuc2V0T3B0aW9uKGtleSx2YWx1ZSkpfXJldHVybiByZXN1bHRzfTtHSUYucHJvdG90eXBlLmFkZEZyYW1lPWZ1bmN0aW9uKGltYWdlLG9wdGlvbnMpe3ZhciBmcmFtZSxrZXk7aWYob3B0aW9ucz09bnVsbCl7b3B0aW9ucz17fX1mcmFtZT17fTtmcmFtZS50cmFuc3BhcmVudD10aGlzLm9wdGlvbnMudHJhbnNwYXJlbnQ7Zm9yKGtleSBpbiBmcmFtZURlZmF1bHRzKXtmcmFtZVtrZXldPW9wdGlvbnNba2V5XXx8ZnJhbWVEZWZhdWx0c1trZXldfWlmKHRoaXMub3B0aW9ucy53aWR0aD09bnVsbCl7dGhpcy5zZXRPcHRpb24oXCJ3aWR0aFwiLGltYWdlLndpZHRoKX1pZih0aGlzLm9wdGlvbnMuaGVpZ2h0PT1udWxsKXt0aGlzLnNldE9wdGlvbihcImhlaWdodFwiLGltYWdlLmhlaWdodCl9aWYodHlwZW9mIEltYWdlRGF0YSE9PVwidW5kZWZpbmVkXCImJkltYWdlRGF0YSE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgSW1hZ2VEYXRhKXtmcmFtZS5kYXRhPWltYWdlLmRhdGF9ZWxzZSBpZih0eXBlb2YgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIT09XCJ1bmRlZmluZWRcIiYmQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkR8fHR5cGVvZiBXZWJHTFJlbmRlcmluZ0NvbnRleHQhPT1cInVuZGVmaW5lZFwiJiZXZWJHTFJlbmRlcmluZ0NvbnRleHQhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIFdlYkdMUmVuZGVyaW5nQ29udGV4dCl7aWYob3B0aW9ucy5jb3B5KXtmcmFtZS5kYXRhPXRoaXMuZ2V0Q29udGV4dERhdGEoaW1hZ2UpfWVsc2V7ZnJhbWUuY29udGV4dD1pbWFnZX19ZWxzZSBpZihpbWFnZS5jaGlsZE5vZGVzIT1udWxsKXtpZihvcHRpb25zLmNvcHkpe2ZyYW1lLmRhdGE9dGhpcy5nZXRJbWFnZURhdGEoaW1hZ2UpfWVsc2V7ZnJhbWUuaW1hZ2U9aW1hZ2V9fWVsc2V7dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBpbWFnZVwiKX1yZXR1cm4gdGhpcy5mcmFtZXMucHVzaChmcmFtZSl9O0dJRi5wcm90b3R5cGUucmVuZGVyPWZ1bmN0aW9uKCl7dmFyIGksaixudW1Xb3JrZXJzLHJlZjtpZih0aGlzLnJ1bm5pbmcpe3Rocm93IG5ldyBFcnJvcihcIkFscmVhZHkgcnVubmluZ1wiKX1pZih0aGlzLm9wdGlvbnMud2lkdGg9PW51bGx8fHRoaXMub3B0aW9ucy5oZWlnaHQ9PW51bGwpe3Rocm93IG5ldyBFcnJvcihcIldpZHRoIGFuZCBoZWlnaHQgbXVzdCBiZSBzZXQgcHJpb3IgdG8gcmVuZGVyaW5nXCIpfXRoaXMucnVubmluZz10cnVlO3RoaXMubmV4dEZyYW1lPTA7dGhpcy5maW5pc2hlZEZyYW1lcz0wO3RoaXMuaW1hZ2VQYXJ0cz1mdW5jdGlvbigpe3ZhciBqLHJlZixyZXN1bHRzO3Jlc3VsdHM9W107Zm9yKGk9aj0wLHJlZj10aGlzLmZyYW1lcy5sZW5ndGg7MDw9cmVmP2o8cmVmOmo+cmVmO2k9MDw9cmVmPysrajotLWope3Jlc3VsdHMucHVzaChudWxsKX1yZXR1cm4gcmVzdWx0c30uY2FsbCh0aGlzKTtudW1Xb3JrZXJzPXRoaXMuc3Bhd25Xb3JrZXJzKCk7aWYodGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGU9PT10cnVlKXt0aGlzLnJlbmRlck5leHRGcmFtZSgpfWVsc2V7Zm9yKGk9aj0wLHJlZj1udW1Xb3JrZXJzOzA8PXJlZj9qPHJlZjpqPnJlZjtpPTA8PXJlZj8rK2o6LS1qKXt0aGlzLnJlbmRlck5leHRGcmFtZSgpfX10aGlzLmVtaXQoXCJzdGFydFwiKTtyZXR1cm4gdGhpcy5lbWl0KFwicHJvZ3Jlc3NcIiwwKX07R0lGLnByb3RvdHlwZS5hYm9ydD1mdW5jdGlvbigpe3ZhciB3b3JrZXI7d2hpbGUodHJ1ZSl7d29ya2VyPXRoaXMuYWN0aXZlV29ya2Vycy5zaGlmdCgpO2lmKHdvcmtlcj09bnVsbCl7YnJlYWt9dGhpcy5sb2coXCJraWxsaW5nIGFjdGl2ZSB3b3JrZXJcIik7d29ya2VyLnRlcm1pbmF0ZSgpfXRoaXMucnVubmluZz1mYWxzZTtyZXR1cm4gdGhpcy5lbWl0KFwiYWJvcnRcIil9O0dJRi5wcm90b3R5cGUuc3Bhd25Xb3JrZXJzPWZ1bmN0aW9uKCl7dmFyIGosbnVtV29ya2VycyxyZWYscmVzdWx0cztudW1Xb3JrZXJzPU1hdGgubWluKHRoaXMub3B0aW9ucy53b3JrZXJzLHRoaXMuZnJhbWVzLmxlbmd0aCk7KGZ1bmN0aW9uKCl7cmVzdWx0cz1bXTtmb3IodmFyIGo9cmVmPXRoaXMuZnJlZVdvcmtlcnMubGVuZ3RoO3JlZjw9bnVtV29ya2Vycz9qPG51bVdvcmtlcnM6aj5udW1Xb3JrZXJzO3JlZjw9bnVtV29ya2Vycz9qKys6ai0tKXtyZXN1bHRzLnB1c2goail9cmV0dXJuIHJlc3VsdHN9KS5hcHBseSh0aGlzKS5mb3JFYWNoKGZ1bmN0aW9uKF90aGlzKXtyZXR1cm4gZnVuY3Rpb24oaSl7dmFyIHdvcmtlcjtfdGhpcy5sb2coXCJzcGF3bmluZyB3b3JrZXIgXCIraSk7d29ya2VyPW5ldyBXb3JrZXIoX3RoaXMub3B0aW9ucy53b3JrZXJTY3JpcHQpO3dvcmtlci5vbm1lc3NhZ2U9ZnVuY3Rpb24oZXZlbnQpe190aGlzLmFjdGl2ZVdvcmtlcnMuc3BsaWNlKF90aGlzLmFjdGl2ZVdvcmtlcnMuaW5kZXhPZih3b3JrZXIpLDEpO190aGlzLmZyZWVXb3JrZXJzLnB1c2god29ya2VyKTtyZXR1cm4gX3RoaXMuZnJhbWVGaW5pc2hlZChldmVudC5kYXRhKX07cmV0dXJuIF90aGlzLmZyZWVXb3JrZXJzLnB1c2god29ya2VyKX19KHRoaXMpKTtyZXR1cm4gbnVtV29ya2Vyc307R0lGLnByb3RvdHlwZS5mcmFtZUZpbmlzaGVkPWZ1bmN0aW9uKGZyYW1lKXt2YXIgaSxqLHJlZjt0aGlzLmxvZyhcImZyYW1lIFwiK2ZyYW1lLmluZGV4K1wiIGZpbmlzaGVkIC0gXCIrdGhpcy5hY3RpdmVXb3JrZXJzLmxlbmd0aCtcIiBhY3RpdmVcIik7dGhpcy5maW5pc2hlZEZyYW1lcysrO3RoaXMuZW1pdChcInByb2dyZXNzXCIsdGhpcy5maW5pc2hlZEZyYW1lcy90aGlzLmZyYW1lcy5sZW5ndGgpO3RoaXMuaW1hZ2VQYXJ0c1tmcmFtZS5pbmRleF09ZnJhbWU7aWYodGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGU9PT10cnVlKXt0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT1mcmFtZS5nbG9iYWxQYWxldHRlO3RoaXMubG9nKFwiZ2xvYmFsIHBhbGV0dGUgYW5hbHl6ZWRcIik7aWYodGhpcy5mcmFtZXMubGVuZ3RoPjIpe2ZvcihpPWo9MSxyZWY9dGhpcy5mcmVlV29ya2Vycy5sZW5ndGg7MTw9cmVmP2o8cmVmOmo+cmVmO2k9MTw9cmVmPysrajotLWope3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9fX1pZihpbmRleE9mLmNhbGwodGhpcy5pbWFnZVBhcnRzLG51bGwpPj0wKXtyZXR1cm4gdGhpcy5yZW5kZXJOZXh0RnJhbWUoKX1lbHNle3JldHVybiB0aGlzLmZpbmlzaFJlbmRlcmluZygpfX07R0lGLnByb3RvdHlwZS5maW5pc2hSZW5kZXJpbmc9ZnVuY3Rpb24oKXt2YXIgZGF0YSxmcmFtZSxpLGltYWdlLGosayxsLGxlbixsZW4xLGxlbjIsbGVuMyxvZmZzZXQscGFnZSxyZWYscmVmMSxyZWYyO2xlbj0wO3JlZj10aGlzLmltYWdlUGFydHM7Zm9yKGo9MCxsZW4xPXJlZi5sZW5ndGg7ajxsZW4xO2orKyl7ZnJhbWU9cmVmW2pdO2xlbis9KGZyYW1lLmRhdGEubGVuZ3RoLTEpKmZyYW1lLnBhZ2VTaXplK2ZyYW1lLmN1cnNvcn1sZW4rPWZyYW1lLnBhZ2VTaXplLWZyYW1lLmN1cnNvcjt0aGlzLmxvZyhcInJlbmRlcmluZyBmaW5pc2hlZCAtIGZpbGVzaXplIFwiK01hdGgucm91bmQobGVuLzFlMykrXCJrYlwiKTtkYXRhPW5ldyBVaW50OEFycmF5KGxlbik7b2Zmc2V0PTA7cmVmMT10aGlzLmltYWdlUGFydHM7Zm9yKGs9MCxsZW4yPXJlZjEubGVuZ3RoO2s8bGVuMjtrKyspe2ZyYW1lPXJlZjFba107cmVmMj1mcmFtZS5kYXRhO2ZvcihpPWw9MCxsZW4zPXJlZjIubGVuZ3RoO2w8bGVuMztpPSsrbCl7cGFnZT1yZWYyW2ldO2RhdGEuc2V0KHBhZ2Usb2Zmc2V0KTtpZihpPT09ZnJhbWUuZGF0YS5sZW5ndGgtMSl7b2Zmc2V0Kz1mcmFtZS5jdXJzb3J9ZWxzZXtvZmZzZXQrPWZyYW1lLnBhZ2VTaXplfX19aW1hZ2U9bmV3IEJsb2IoW2RhdGFdLHt0eXBlOlwiaW1hZ2UvZ2lmXCJ9KTtyZXR1cm4gdGhpcy5lbWl0KFwiZmluaXNoZWRcIixpbWFnZSxkYXRhKX07R0lGLnByb3RvdHlwZS5yZW5kZXJOZXh0RnJhbWU9ZnVuY3Rpb24oKXt2YXIgZnJhbWUsdGFzayx3b3JrZXI7aWYodGhpcy5mcmVlV29ya2Vycy5sZW5ndGg9PT0wKXt0aHJvdyBuZXcgRXJyb3IoXCJObyBmcmVlIHdvcmtlcnNcIil9aWYodGhpcy5uZXh0RnJhbWU+PXRoaXMuZnJhbWVzLmxlbmd0aCl7cmV0dXJufWZyYW1lPXRoaXMuZnJhbWVzW3RoaXMubmV4dEZyYW1lKytdO3dvcmtlcj10aGlzLmZyZWVXb3JrZXJzLnNoaWZ0KCk7dGFzaz10aGlzLmdldFRhc2soZnJhbWUpO3RoaXMubG9nKFwic3RhcnRpbmcgZnJhbWUgXCIrKHRhc2suaW5kZXgrMSkrXCIgb2YgXCIrdGhpcy5mcmFtZXMubGVuZ3RoKTt0aGlzLmFjdGl2ZVdvcmtlcnMucHVzaCh3b3JrZXIpO3JldHVybiB3b3JrZXIucG9zdE1lc3NhZ2UodGFzayl9O0dJRi5wcm90b3R5cGUuZ2V0Q29udGV4dERhdGE9ZnVuY3Rpb24oY3R4KXtyZXR1cm4gY3R4LmdldEltYWdlRGF0YSgwLDAsdGhpcy5vcHRpb25zLndpZHRoLHRoaXMub3B0aW9ucy5oZWlnaHQpLmRhdGF9O0dJRi5wcm90b3R5cGUuZ2V0SW1hZ2VEYXRhPWZ1bmN0aW9uKGltYWdlKXt2YXIgY3R4O2lmKHRoaXMuX2NhbnZhcz09bnVsbCl7dGhpcy5fY2FudmFzPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7dGhpcy5fY2FudmFzLndpZHRoPXRoaXMub3B0aW9ucy53aWR0aDt0aGlzLl9jYW52YXMuaGVpZ2h0PXRoaXMub3B0aW9ucy5oZWlnaHR9Y3R4PXRoaXMuX2NhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7Y3R4LnNldEZpbGw9dGhpcy5vcHRpb25zLmJhY2tncm91bmQ7Y3R4LmZpbGxSZWN0KDAsMCx0aGlzLm9wdGlvbnMud2lkdGgsdGhpcy5vcHRpb25zLmhlaWdodCk7Y3R4LmRyYXdJbWFnZShpbWFnZSwwLDApO3JldHVybiB0aGlzLmdldENvbnRleHREYXRhKGN0eCl9O0dJRi5wcm90b3R5cGUuZ2V0VGFzaz1mdW5jdGlvbihmcmFtZSl7dmFyIGluZGV4LHRhc2s7aW5kZXg9dGhpcy5mcmFtZXMuaW5kZXhPZihmcmFtZSk7dGFzaz17aW5kZXg6aW5kZXgsbGFzdDppbmRleD09PXRoaXMuZnJhbWVzLmxlbmd0aC0xLGRlbGF5OmZyYW1lLmRlbGF5LGRpc3Bvc2U6ZnJhbWUuZGlzcG9zZSx0cmFuc3BhcmVudDpmcmFtZS50cmFuc3BhcmVudCx3aWR0aDp0aGlzLm9wdGlvbnMud2lkdGgsaGVpZ2h0OnRoaXMub3B0aW9ucy5oZWlnaHQscXVhbGl0eTp0aGlzLm9wdGlvbnMucXVhbGl0eSxkaXRoZXI6dGhpcy5vcHRpb25zLmRpdGhlcixnbG9iYWxQYWxldHRlOnRoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlLHJlcGVhdDp0aGlzLm9wdGlvbnMucmVwZWF0LGNhblRyYW5zZmVyOmJyb3dzZXIubmFtZT09PVwiY2hyb21lXCJ9O2lmKGZyYW1lLmRhdGEhPW51bGwpe3Rhc2suZGF0YT1mcmFtZS5kYXRhfWVsc2UgaWYoZnJhbWUuY29udGV4dCE9bnVsbCl7dGFzay5kYXRhPXRoaXMuZ2V0Q29udGV4dERhdGEoZnJhbWUuY29udGV4dCl9ZWxzZSBpZihmcmFtZS5pbWFnZSE9bnVsbCl7dGFzay5kYXRhPXRoaXMuZ2V0SW1hZ2VEYXRhKGZyYW1lLmltYWdlKX1lbHNle3Rocm93IG5ldyBFcnJvcihcIkludmFsaWQgZnJhbWVcIil9cmV0dXJuIHRhc2t9O0dJRi5wcm90b3R5cGUubG9nPWZ1bmN0aW9uKCl7dmFyIGFyZ3M7YXJncz0xPD1hcmd1bWVudHMubGVuZ3RoP3NsaWNlLmNhbGwoYXJndW1lbnRzLDApOltdO2lmKCF0aGlzLm9wdGlvbnMuZGVidWcpe3JldHVybn1yZXR1cm4gY29uc29sZS5sb2cuYXBwbHkoY29uc29sZSxhcmdzKX07cmV0dXJuIEdJRn0oRXZlbnRFbWl0dGVyKX0se1wiLi9HSUZFbmNvZGVyLmpzXCI6MixcIi4vYnJvd3Nlci5jb2ZmZWVcIjo1LFwiLi9naWYud29ya2VyLmNvZmZlZVwiOjcsZXZlbnRzOjF9XSw3OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgR0lGRW5jb2RlcixyZW5kZXJGcmFtZTtHSUZFbmNvZGVyPXJlcXVpcmUoXCIuL0dJRkVuY29kZXIuanNcIik7cmVuZGVyRnJhbWU9ZnVuY3Rpb24oZnJhbWUpe3ZhciBlbmNvZGVyLHBhZ2Usc3RyZWFtLHRyYW5zZmVyO2VuY29kZXI9bmV3IEdJRkVuY29kZXIoZnJhbWUud2lkdGgsZnJhbWUuaGVpZ2h0KTtpZihmcmFtZS5pbmRleD09PTApe2VuY29kZXIud3JpdGVIZWFkZXIoKX1lbHNle2VuY29kZXIuZmlyc3RGcmFtZT1mYWxzZX1lbmNvZGVyLnNldFRyYW5zcGFyZW50KGZyYW1lLnRyYW5zcGFyZW50KTtlbmNvZGVyLnNldERpc3Bvc2UoZnJhbWUuZGlzcG9zZSk7ZW5jb2Rlci5zZXRSZXBlYXQoZnJhbWUucmVwZWF0KTtlbmNvZGVyLnNldERlbGF5KGZyYW1lLmRlbGF5KTtlbmNvZGVyLnNldFF1YWxpdHkoZnJhbWUucXVhbGl0eSk7ZW5jb2Rlci5zZXREaXRoZXIoZnJhbWUuZGl0aGVyKTtlbmNvZGVyLnNldEdsb2JhbFBhbGV0dGUoZnJhbWUuZ2xvYmFsUGFsZXR0ZSk7ZW5jb2Rlci5hZGRGcmFtZShmcmFtZS5kYXRhKTtpZihmcmFtZS5sYXN0KXtlbmNvZGVyLmZpbmlzaCgpfWlmKGZyYW1lLmdsb2JhbFBhbGV0dGU9PT10cnVlKXtmcmFtZS5nbG9iYWxQYWxldHRlPWVuY29kZXIuZ2V0R2xvYmFsUGFsZXR0ZSgpfXN0cmVhbT1lbmNvZGVyLnN0cmVhbSgpO2ZyYW1lLmRhdGE9c3RyZWFtLnBhZ2VzO2ZyYW1lLmN1cnNvcj1zdHJlYW0uY3Vyc29yO2ZyYW1lLnBhZ2VTaXplPXN0cmVhbS5jb25zdHJ1Y3Rvci5wYWdlU2l6ZTtpZihmcmFtZS5jYW5UcmFuc2Zlcil7dHJhbnNmZXI9ZnVuY3Rpb24oKXt2YXIgaSxsZW4scmVmLHJlc3VsdHM7cmVmPWZyYW1lLmRhdGE7cmVzdWx0cz1bXTtmb3IoaT0wLGxlbj1yZWYubGVuZ3RoO2k8bGVuO2krKyl7cGFnZT1yZWZbaV07cmVzdWx0cy5wdXNoKHBhZ2UuYnVmZmVyKX1yZXR1cm4gcmVzdWx0c30oKTtyZXR1cm4gc2VsZi5wb3N0TWVzc2FnZShmcmFtZSx0cmFuc2Zlcil9ZWxzZXtyZXR1cm4gc2VsZi5wb3N0TWVzc2FnZShmcmFtZSl9fTtzZWxmLm9ubWVzc2FnZT1mdW5jdGlvbihldmVudCl7cmV0dXJuIHJlbmRlckZyYW1lKGV2ZW50LmRhdGEpfX0se1wiLi9HSUZFbmNvZGVyLmpzXCI6Mn1dfSx7fSxbNl0pKDYpfSk7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWdpZi5qcy5tYXBcclxuIiwiOyhmdW5jdGlvbigpIHtcclxuXHJcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgdmFyIFRhciA9IHJlcXVpcmUoJy4vdGFyLmpzJyk7XHJcbiAgdmFyIGRvd25sb2FkID0gcmVxdWlyZSgnLi9kb3dubG9hZC5qcycpO1xyXG4gIHZhciBHSUYgPSByZXF1aXJlKCcuL2dpZi5qcycpO1xyXG59XHJcblxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBvYmplY3RUeXBlcyA9IHtcclxuJ2Z1bmN0aW9uJzogdHJ1ZSxcclxuJ29iamVjdCc6IHRydWVcclxufTtcclxuXHJcbmZ1bmN0aW9uIGNoZWNrR2xvYmFsKHZhbHVlKSB7XHJcbiAgICByZXR1cm4gKHZhbHVlICYmIHZhbHVlLk9iamVjdCA9PT0gT2JqZWN0KSA/IHZhbHVlIDogbnVsbDtcclxuICB9XHJcblxyXG4vKiogQnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMgd2l0aG91dCBhIGRlcGVuZGVuY3kgb24gYHJvb3RgLiAqL1xyXG52YXIgZnJlZVBhcnNlRmxvYXQgPSBwYXJzZUZsb2F0LFxyXG4gIGZyZWVQYXJzZUludCA9IHBhcnNlSW50O1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBleHBvcnRzYC4gKi9cclxudmFyIGZyZWVFeHBvcnRzID0gKG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlKVxyXG4/IGV4cG9ydHNcclxuOiB1bmRlZmluZWQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYG1vZHVsZWAuICovXHJcbnZhciBmcmVlTW9kdWxlID0gKG9iamVjdFR5cGVzW3R5cGVvZiBtb2R1bGVdICYmIG1vZHVsZSAmJiAhbW9kdWxlLm5vZGVUeXBlKVxyXG4/IG1vZHVsZVxyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgdGhlIHBvcHVsYXIgQ29tbW9uSlMgZXh0ZW5zaW9uIGBtb2R1bGUuZXhwb3J0c2AuICovXHJcbnZhciBtb2R1bGVFeHBvcnRzID0gKGZyZWVNb2R1bGUgJiYgZnJlZU1vZHVsZS5leHBvcnRzID09PSBmcmVlRXhwb3J0cylcclxuPyBmcmVlRXhwb3J0c1xyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZ2xvYmFsYCBmcm9tIE5vZGUuanMuICovXHJcbnZhciBmcmVlR2xvYmFsID0gY2hlY2tHbG9iYWwoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSAmJiB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbCk7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHNlbGZgLiAqL1xyXG52YXIgZnJlZVNlbGYgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygc2VsZl0gJiYgc2VsZik7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHdpbmRvd2AuICovXHJcbnZhciBmcmVlV2luZG93ID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHdpbmRvd10gJiYgd2luZG93KTtcclxuXHJcbi8qKiBEZXRlY3QgYHRoaXNgIGFzIHRoZSBnbG9iYWwgb2JqZWN0LiAqL1xyXG52YXIgdGhpc0dsb2JhbCA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB0aGlzXSAmJiB0aGlzKTtcclxuXHJcbi8qKlxyXG4qIFVzZWQgYXMgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbCBvYmplY3QuXHJcbipcclxuKiBUaGUgYHRoaXNgIHZhbHVlIGlzIHVzZWQgaWYgaXQncyB0aGUgZ2xvYmFsIG9iamVjdCB0byBhdm9pZCBHcmVhc2Vtb25rZXknc1xyXG4qIHJlc3RyaWN0ZWQgYHdpbmRvd2Agb2JqZWN0LCBvdGhlcndpc2UgdGhlIGB3aW5kb3dgIG9iamVjdCBpcyB1c2VkLlxyXG4qL1xyXG52YXIgcm9vdCA9IGZyZWVHbG9iYWwgfHxcclxuKChmcmVlV2luZG93ICE9PSAodGhpc0dsb2JhbCAmJiB0aGlzR2xvYmFsLndpbmRvdykpICYmIGZyZWVXaW5kb3cpIHx8XHJcbiAgZnJlZVNlbGYgfHwgdGhpc0dsb2JhbCB8fCBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xyXG5cclxuaWYoICEoJ2djJyBpbiB3aW5kb3cgKSApIHtcclxuXHR3aW5kb3cuZ2MgPSBmdW5jdGlvbigpe31cclxufVxyXG5cclxuaWYgKCFIVE1MQ2FudmFzRWxlbWVudC5wcm90b3R5cGUudG9CbG9iKSB7XHJcbiBPYmplY3QuZGVmaW5lUHJvcGVydHkoSFRNTENhbnZhc0VsZW1lbnQucHJvdG90eXBlLCAndG9CbG9iJywge1xyXG4gIHZhbHVlOiBmdW5jdGlvbiAoY2FsbGJhY2ssIHR5cGUsIHF1YWxpdHkpIHtcclxuXHJcbiAgICB2YXIgYmluU3RyID0gYXRvYiggdGhpcy50b0RhdGFVUkwodHlwZSwgcXVhbGl0eSkuc3BsaXQoJywnKVsxXSApLFxyXG4gICAgICAgIGxlbiA9IGJpblN0ci5sZW5ndGgsXHJcbiAgICAgICAgYXJyID0gbmV3IFVpbnQ4QXJyYXkobGVuKTtcclxuXHJcbiAgICBmb3IgKHZhciBpPTA7IGk8bGVuOyBpKysgKSB7XHJcbiAgICAgYXJyW2ldID0gYmluU3RyLmNoYXJDb2RlQXQoaSk7XHJcbiAgICB9XHJcblxyXG4gICAgY2FsbGJhY2soIG5ldyBCbG9iKCBbYXJyXSwge3R5cGU6IHR5cGUgfHwgJ2ltYWdlL3BuZyd9ICkgKTtcclxuICB9XHJcbiB9KTtcclxufVxyXG5cclxuLy8gQGxpY2Vuc2UgaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVFxyXG4vLyBjb3B5cmlnaHQgUGF1bCBJcmlzaCAyMDE1XHJcblxyXG5cclxuLy8gRGF0ZS5ub3coKSBpcyBzdXBwb3J0ZWQgZXZlcnl3aGVyZSBleGNlcHQgSUU4LiBGb3IgSUU4IHdlIHVzZSB0aGUgRGF0ZS5ub3cgcG9seWZpbGxcclxuLy8gICBnaXRodWIuY29tL0ZpbmFuY2lhbC1UaW1lcy9wb2x5ZmlsbC1zZXJ2aWNlL2Jsb2IvbWFzdGVyL3BvbHlmaWxscy9EYXRlLm5vdy9wb2x5ZmlsbC5qc1xyXG4vLyBhcyBTYWZhcmkgNiBkb2Vzbid0IGhhdmUgc3VwcG9ydCBmb3IgTmF2aWdhdGlvblRpbWluZywgd2UgdXNlIGEgRGF0ZS5ub3coKSB0aW1lc3RhbXAgZm9yIHJlbGF0aXZlIHZhbHVlc1xyXG5cclxuLy8gaWYgeW91IHdhbnQgdmFsdWVzIHNpbWlsYXIgdG8gd2hhdCB5b3UnZCBnZXQgd2l0aCByZWFsIHBlcmYubm93LCBwbGFjZSB0aGlzIHRvd2FyZHMgdGhlIGhlYWQgb2YgdGhlIHBhZ2VcclxuLy8gYnV0IGluIHJlYWxpdHksIHlvdSdyZSBqdXN0IGdldHRpbmcgdGhlIGRlbHRhIGJldHdlZW4gbm93KCkgY2FsbHMsIHNvIGl0J3Mgbm90IHRlcnJpYmx5IGltcG9ydGFudCB3aGVyZSBpdCdzIHBsYWNlZFxyXG5cclxuXHJcbihmdW5jdGlvbigpe1xyXG5cclxuICBpZiAoXCJwZXJmb3JtYW5jZVwiIGluIHdpbmRvdyA9PSBmYWxzZSkge1xyXG4gICAgICB3aW5kb3cucGVyZm9ybWFuY2UgPSB7fTtcclxuICB9XHJcblxyXG4gIERhdGUubm93ID0gKERhdGUubm93IHx8IGZ1bmN0aW9uICgpIHsgIC8vIHRoYW5rcyBJRThcclxuXHQgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICB9KTtcclxuXHJcbiAgaWYgKFwibm93XCIgaW4gd2luZG93LnBlcmZvcm1hbmNlID09IGZhbHNlKXtcclxuXHJcbiAgICB2YXIgbm93T2Zmc2V0ID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICBpZiAocGVyZm9ybWFuY2UudGltaW5nICYmIHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQpe1xyXG4gICAgICBub3dPZmZzZXQgPSBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0XHJcbiAgICB9XHJcblxyXG4gICAgd2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uIG5vdygpe1xyXG4gICAgICByZXR1cm4gRGF0ZS5ub3coKSAtIG5vd09mZnNldDtcclxuICAgIH1cclxuICB9XHJcblxyXG59KSgpO1xyXG5cclxuXHJcbmZ1bmN0aW9uIHBhZCggbiApIHtcclxuXHRyZXR1cm4gU3RyaW5nKFwiMDAwMDAwMFwiICsgbikuc2xpY2UoLTcpO1xyXG59XHJcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL0FkZC1vbnMvQ29kZV9zbmlwcGV0cy9UaW1lcnNcclxuXHJcbnZhciBnX3N0YXJ0VGltZSA9IHdpbmRvdy5EYXRlLm5vdygpO1xyXG5cclxuZnVuY3Rpb24gZ3VpZCgpIHtcclxuXHRmdW5jdGlvbiBzNCgpIHtcclxuXHRcdHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKS50b1N0cmluZygxNikuc3Vic3RyaW5nKDEpO1xyXG5cdH1cclxuXHRyZXR1cm4gczQoKSArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDRnJhbWVFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIF9oYW5kbGVycyA9IHt9O1xyXG5cclxuXHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XHJcblxyXG5cdHRoaXMub24gPSBmdW5jdGlvbihldmVudCwgaGFuZGxlcikge1xyXG5cclxuXHRcdF9oYW5kbGVyc1tldmVudF0gPSBoYW5kbGVyO1xyXG5cclxuXHR9O1xyXG5cclxuXHR0aGlzLmVtaXQgPSBmdW5jdGlvbihldmVudCkge1xyXG5cclxuXHRcdHZhciBoYW5kbGVyID0gX2hhbmRsZXJzW2V2ZW50XTtcclxuXHRcdGlmIChoYW5kbGVyKSB7XHJcblxyXG5cdFx0XHRoYW5kbGVyLmFwcGx5KG51bGwsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xyXG5cclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0dGhpcy5maWxlbmFtZSA9IHNldHRpbmdzLm5hbWUgfHwgZ3VpZCgpO1xyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJyc7XHJcblx0dGhpcy5taW1lVHlwZSA9ICcnO1xyXG5cclxufVxyXG5cclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc2FmZVRvUHJvY2VlZCA9IGZ1bmN0aW9uKCl7IHJldHVybiB0cnVlOyB9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RlcCA9IGZ1bmN0aW9uKCkgeyBjb25zb2xlLmxvZyggJ1N0ZXAgbm90IHNldCEnICkgfVxyXG5cclxuZnVuY3Rpb24gQ0NUYXJFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5leHRlbnNpb24gPSAnLnRhcidcclxuXHR0aGlzLm1pbWVUeXBlID0gJ2FwcGxpY2F0aW9uL3gtdGFyJ1xyXG5cdHRoaXMuZmlsZUV4dGVuc2lvbiA9ICcnO1xyXG5cclxuXHR0aGlzLnRhcGUgPSBudWxsXHJcblx0dGhpcy5jb3VudCA9IDA7XHJcblxyXG59XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKXtcclxuXHJcblx0dGhpcy5kaXNwb3NlKCk7XHJcblxyXG59O1xyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggYmxvYiApIHtcclxuXHJcblx0dmFyIGZpbGVSZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG5cdGZpbGVSZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLnRhcGUuYXBwZW5kKCBwYWQoIHRoaXMuY291bnQgKSArIHRoaXMuZmlsZUV4dGVuc2lvbiwgbmV3IFVpbnQ4QXJyYXkoIGZpbGVSZWFkZXIucmVzdWx0ICkgKTtcclxuXHJcblx0XHQvL2lmKCB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSA+IDAgJiYgKCB0aGlzLmZyYW1lcy5sZW5ndGggLyB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApID49IHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lICkge1xyXG5cclxuXHRcdHRoaXMuY291bnQrKztcclxuXHRcdHRoaXMuc3RlcCgpO1xyXG5cdH0uYmluZCggdGhpcyApO1xyXG5cdGZpbGVSZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYik7XHJcblxyXG59XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdGNhbGxiYWNrKCB0aGlzLnRhcGUuc2F2ZSgpICk7XHJcblxyXG59XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy50YXBlID0gbmV3IFRhcigpO1xyXG5cdHRoaXMuY291bnQgPSAwO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NQTkdFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NUYXJFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMudHlwZSA9ICdpbWFnZS9wbmcnO1xyXG5cdHRoaXMuZmlsZUV4dGVuc2lvbiA9ICcucG5nJztcclxuXHJcbn1cclxuXHJcbkNDUE5HRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ1RhckVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1BOR0VuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGNhbnZhcy50b0Jsb2IoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0Q0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQuY2FsbCggdGhpcywgYmxvYiApO1xyXG5cdH0uYmluZCggdGhpcyApLCB0aGlzLnR5cGUgKVxyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NKUEVHRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDVGFyRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLnR5cGUgPSAnaW1hZ2UvanBlZyc7XHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJy5qcGcnO1xyXG5cdHRoaXMucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxufVxyXG5cclxuQ0NKUEVHRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ1RhckVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0pQRUdFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRjYW52YXMudG9CbG9iKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdENDVGFyRW5jb2Rlci5wcm90b3R5cGUuYWRkLmNhbGwoIHRoaXMsIGJsb2IgKTtcclxuXHR9LmJpbmQoIHRoaXMgKSwgdGhpcy50eXBlLCB0aGlzLnF1YWxpdHkgKVxyXG5cclxufVxyXG5cclxuLypcclxuXHJcblx0V2ViTSBFbmNvZGVyXHJcblxyXG4qL1xyXG5cclxuZnVuY3Rpb24gQ0NXZWJNRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG5cdGlmKCBjYW52YXMudG9EYXRhVVJMKCAnaW1hZ2Uvd2VicCcgKS5zdWJzdHIoNSwxMCkgIT09ICdpbWFnZS93ZWJwJyApe1xyXG5cdFx0Y29uc29sZS5sb2coIFwiV2ViUCBub3Qgc3VwcG9ydGVkIC0gdHJ5IGFub3RoZXIgZXhwb3J0IGZvcm1hdFwiIClcclxuXHR9XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcud2VibSdcclxuXHR0aGlzLm1pbWVUeXBlID0gJ3ZpZGVvL3dlYm0nXHJcblx0dGhpcy5iYXNlRmlsZW5hbWUgPSB0aGlzLmZpbGVuYW1lO1xyXG5cclxuXHR0aGlzLmZyYW1lcyA9IFtdO1xyXG5cdHRoaXMucGFydCA9IDE7XHJcblxyXG4gIHRoaXMudmlkZW9Xcml0ZXIgPSBuZXcgV2ViTVdyaXRlcih7XHJcbiAgICBxdWFsaXR5OiB0aGlzLnF1YWxpdHksXHJcbiAgICBmaWxlV3JpdGVyOiBudWxsLFxyXG4gICAgZmQ6IG51bGwsXHJcbiAgICBmcmFtZVJhdGU6IHNldHRpbmdzLmZyYW1lcmF0ZVxyXG59KTtcclxuXHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmRpc3Bvc2UoKTtcclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG4gIHRoaXMudmlkZW9Xcml0ZXIuYWRkRnJhbWUoY2FudmFzKTtcclxuXHJcblx0Ly90aGlzLmZyYW1lcy5wdXNoKCBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS93ZWJwJywgdGhpcy5xdWFsaXR5KSApO1xyXG5cclxuXHRpZiggdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgPiAwICYmICggdGhpcy5mcmFtZXMubGVuZ3RoIC8gdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKSA+PSB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSApIHtcclxuXHRcdHRoaXMuc2F2ZSggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRcdHRoaXMuZmlsZW5hbWUgPSB0aGlzLmJhc2VGaWxlbmFtZSArICctcGFydC0nICsgcGFkKCB0aGlzLnBhcnQgKTtcclxuXHRcdFx0ZG93bmxvYWQoIGJsb2IsIHRoaXMuZmlsZW5hbWUgKyB0aGlzLmV4dGVuc2lvbiwgdGhpcy5taW1lVHlwZSApO1xyXG5cdFx0XHR0aGlzLmRpc3Bvc2UoKTtcclxuXHRcdFx0dGhpcy5wYXJ0Kys7XHJcblx0XHRcdHRoaXMuZmlsZW5hbWUgPSB0aGlzLmJhc2VGaWxlbmFtZSArICctcGFydC0nICsgcGFkKCB0aGlzLnBhcnQgKTtcclxuXHRcdFx0dGhpcy5zdGVwKCk7XHJcblx0XHR9LmJpbmQoIHRoaXMgKSApXHJcblx0fSBlbHNlIHtcclxuXHRcdHRoaXMuc3RlcCgpO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4vL1x0aWYoICF0aGlzLmZyYW1lcy5sZW5ndGggKSByZXR1cm47XHJcblxyXG4gIHRoaXMudmlkZW9Xcml0ZXIuY29tcGxldGUoKS50aGVuKGNhbGxiYWNrKTtcclxuXHJcblx0Lyp2YXIgd2VibSA9IFdoYW1teS5mcm9tSW1hZ2VBcnJheSggdGhpcy5mcmFtZXMsIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlIClcclxuXHR2YXIgYmxvYiA9IG5ldyBCbG9iKCBbIHdlYm0gXSwgeyB0eXBlOiBcIm9jdGV0L3N0cmVhbVwiIH0gKTtcclxuXHRjYWxsYmFjayggYmxvYiApOyovXHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5mcmFtZXMgPSBbXTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDRkZNcGVnU2VydmVyRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHNldHRpbmdzLnF1YWxpdHkgPSAoIHNldHRpbmdzLnF1YWxpdHkgLyAxMDAgKSB8fCAuODtcclxuXHJcblx0dGhpcy5lbmNvZGVyID0gbmV3IEZGTXBlZ1NlcnZlci5WaWRlbyggc2V0dGluZ3MgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ3Byb2Nlc3MnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLmVtaXQoICdwcm9jZXNzJyApXHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCdmaW5pc2hlZCcsIGZ1bmN0aW9uKCB1cmwsIHNpemUgKSB7XHJcbiAgICAgICAgdmFyIGNiID0gdGhpcy5jYWxsYmFjaztcclxuICAgICAgICBpZiAoIGNiICkge1xyXG4gICAgICAgICAgICB0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBjYiggdXJsLCBzaXplICk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ3Byb2dyZXNzJywgZnVuY3Rpb24oIHByb2dyZXNzICkge1xyXG4gICAgICAgIGlmICggdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzICkge1xyXG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MoIHByb2dyZXNzIClcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAnZXJyb3InLCBmdW5jdGlvbiggZGF0YSApIHtcclxuICAgICAgICBhbGVydChKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSk7XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc3RhcnQoIHRoaXMuc2V0dGluZ3MgKTtcclxuXHJcbn07XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5hZGQoIGNhbnZhcyApO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuICAgIHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcclxuICAgIHRoaXMuZW5jb2Rlci5lbmQoKTtcclxuXHJcbn1cclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuc2FmZVRvUHJvY2VlZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZW5jb2Rlci5zYWZlVG9Qcm9jZWVkKCk7XHJcbn07XHJcblxyXG4vKlxyXG5cdEhUTUxDYW52YXNFbGVtZW50LmNhcHR1cmVTdHJlYW0oKVxyXG4qL1xyXG5cclxuZnVuY3Rpb24gQ0NTdHJlYW1FbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5mcmFtZXJhdGUgPSB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZTtcclxuXHR0aGlzLnR5cGUgPSAndmlkZW8vd2VibSc7XHJcblx0dGhpcy5leHRlbnNpb24gPSAnLndlYm0nO1xyXG5cdHRoaXMuc3RyZWFtID0gbnVsbDtcclxuXHR0aGlzLm1lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG5cdHRoaXMuY2h1bmtzID0gW107XHJcblxyXG59XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGlmKCAhdGhpcy5zdHJlYW0gKSB7XHJcblx0XHR0aGlzLnN0cmVhbSA9IGNhbnZhcy5jYXB0dXJlU3RyZWFtKCB0aGlzLmZyYW1lcmF0ZSApO1xyXG5cdFx0dGhpcy5tZWRpYVJlY29yZGVyID0gbmV3IE1lZGlhUmVjb3JkZXIoIHRoaXMuc3RyZWFtICk7XHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIuc3RhcnQoKTtcclxuXHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0XHR0aGlzLmNodW5rcy5wdXNoKGUuZGF0YSk7XHJcblx0XHR9LmJpbmQoIHRoaXMgKTtcclxuXHJcblx0fVxyXG5cdHRoaXMuc3RlcCgpO1xyXG5cclxufVxyXG5cclxuQ0NTdHJlYW1FbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuXHR0aGlzLm1lZGlhUmVjb3JkZXIub25zdG9wID0gZnVuY3Rpb24oIGUgKSB7XHJcblx0XHR2YXIgYmxvYiA9IG5ldyBCbG9iKCB0aGlzLmNodW5rcywgeyAndHlwZScgOiAndmlkZW8vd2VibScgfSk7XHJcblx0XHR0aGlzLmNodW5rcyA9IFtdO1xyXG5cdFx0Y2FsbGJhY2soIGJsb2IgKTtcclxuXHJcblx0fS5iaW5kKCB0aGlzICk7XHJcblxyXG5cdHRoaXMubWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcblxyXG59XHJcblxyXG4vKmZ1bmN0aW9uIENDR0lGRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9IHNldHRpbmdzLnF1YWxpdHkgfHwgNjtcclxuXHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XHJcblxyXG5cdHRoaXMuZW5jb2RlciA9IG5ldyBHSUZFbmNvZGVyKCk7XHJcblx0dGhpcy5lbmNvZGVyLnNldFJlcGVhdCggMSApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldERlbGF5KCBzZXR0aW5ncy5zdGVwICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0UXVhbGl0eSggNiApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldFRyYW5zcGFyZW50KCBudWxsICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0U2l6ZSggMTUwLCAxNTAgKTtcclxuXHJcbiAgXHR0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcbiAgXHR0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoICcyZCcgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2RlciApO1xyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc3RhcnQoKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5jYW52YXMud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0dGhpcy5jYW52YXMuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHR0aGlzLmN0eC5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggdGhpcy5jdHggKTtcclxuXHJcblx0dGhpcy5lbmNvZGVyLnNldFNpemUoIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCApO1xyXG5cdHZhciByZWFkQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoY2FudmFzLndpZHRoICogY2FudmFzLmhlaWdodCAqIDQpO1xyXG5cdHZhciBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKTtcclxuXHRjb250ZXh0LnJlYWRQaXhlbHMoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0LCBjb250ZXh0LlJHQkEsIGNvbnRleHQuVU5TSUdORURfQllURSwgcmVhZEJ1ZmZlcik7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCByZWFkQnVmZmVyLCB0cnVlICk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmZpbmlzaCgpO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuXHR2YXIgYmluYXJ5X2dpZiA9IHRoaXMuZW5jb2Rlci5zdHJlYW0oKS5nZXREYXRhKCk7XHJcblxyXG5cdHZhciBkYXRhX3VybCA9ICdkYXRhOmltYWdlL2dpZjtiYXNlNjQsJytlbmNvZGU2NChiaW5hcnlfZ2lmKTtcclxuXHR3aW5kb3cubG9jYXRpb24gPSBkYXRhX3VybDtcclxuXHRyZXR1cm47XHJcblxyXG5cdHZhciBibG9iID0gbmV3IEJsb2IoIFsgYmluYXJ5X2dpZiBdLCB7IHR5cGU6IFwib2N0ZXQvc3RyZWFtXCIgfSApO1xyXG5cdHZhciB1cmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTCggYmxvYiApO1xyXG5cdGNhbGxiYWNrKCB1cmwgKTtcclxuXHJcbn0qL1xyXG5cclxuZnVuY3Rpb24gQ0NHSUZFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9IDMxIC0gKCAoIHNldHRpbmdzLnF1YWxpdHkgKiAzMCAvIDEwMCApIHx8IDEwICk7XHJcblx0c2V0dGluZ3Mud29ya2VycyA9IHNldHRpbmdzLndvcmtlcnMgfHwgNDtcclxuXHJcblx0dGhpcy5leHRlbnNpb24gPSAnLmdpZidcclxuXHR0aGlzLm1pbWVUeXBlID0gJ2ltYWdlL2dpZidcclxuXHJcbiAgXHR0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcbiAgXHR0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoICcyZCcgKTtcclxuICBcdHRoaXMuc2l6ZVNldCA9IGZhbHNlO1xyXG5cclxuICBcdHRoaXMuZW5jb2RlciA9IG5ldyBHSUYoe1xyXG5cdFx0d29ya2Vyczogc2V0dGluZ3Mud29ya2VycyxcclxuXHRcdHF1YWxpdHk6IHNldHRpbmdzLnF1YWxpdHksXHJcblx0XHR3b3JrZXJTY3JpcHQ6IHNldHRpbmdzLndvcmtlcnNQYXRoICsgJ2dpZi53b3JrZXIuanMnXHJcblx0fSApO1xyXG5cclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ3Byb2dyZXNzJywgZnVuY3Rpb24oIHByb2dyZXNzICkge1xyXG4gICAgICAgIGlmICggdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzICkge1xyXG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MoIHByb2dyZXNzIClcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxuICAgIHRoaXMuZW5jb2Rlci5vbignZmluaXNoZWQnLCBmdW5jdGlvbiggYmxvYiApIHtcclxuICAgICAgICB2YXIgY2IgPSB0aGlzLmNhbGxiYWNrO1xyXG4gICAgICAgIGlmICggY2IgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGNiKCBibG9iICk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0aWYoICF0aGlzLnNpemVTZXQgKSB7XHJcblx0XHR0aGlzLmVuY29kZXIuc2V0T3B0aW9uKCAnd2lkdGgnLGNhbnZhcy53aWR0aCApO1xyXG5cdFx0dGhpcy5lbmNvZGVyLnNldE9wdGlvbiggJ2hlaWdodCcsY2FudmFzLmhlaWdodCApO1xyXG5cdFx0dGhpcy5zaXplU2V0ID0gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdHRoaXMuY2FudmFzLndpZHRoID0gY2FudmFzLndpZHRoO1xyXG5cdHRoaXMuY2FudmFzLmhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XHJcblx0dGhpcy5jdHguZHJhd0ltYWdlKCBjYW52YXMsIDAsIDAgKTtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCB0aGlzLmN0eCwgeyBjb3B5OiB0cnVlLCBkZWxheTogdGhpcy5zZXR0aW5ncy5zdGVwIH0gKTtcclxuXHR0aGlzLnN0ZXAoKTtcclxuXHJcblx0Lyp0aGlzLmVuY29kZXIuc2V0U2l6ZSggY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0ICk7XHJcblx0dmFyIHJlYWRCdWZmZXIgPSBuZXcgVWludDhBcnJheShjYW52YXMud2lkdGggKiBjYW52YXMuaGVpZ2h0ICogNCk7XHJcblx0dmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApO1xyXG5cdGNvbnRleHQucmVhZFBpeGVscygwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQsIGNvbnRleHQuUkdCQSwgY29udGV4dC5VTlNJR05FRF9CWVRFLCByZWFkQnVmZmVyKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHJlYWRCdWZmZXIsIHRydWUgKTsqL1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuICAgIHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcclxuXHJcblx0dGhpcy5lbmNvZGVyLnJlbmRlcigpO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NhcHR1cmUoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgX3NldHRpbmdzID0gc2V0dGluZ3MgfHwge30sXHJcblx0XHRfZGF0ZSA9IG5ldyBEYXRlKCksXHJcblx0XHRfdmVyYm9zZSxcclxuXHRcdF9kaXNwbGF5LFxyXG5cdFx0X3RpbWUsXHJcblx0XHRfc3RhcnRUaW1lLFxyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSxcclxuXHRcdF9wZXJmb3JtYW5jZVN0YXJ0VGltZSxcclxuXHRcdF9zdGVwLFxyXG4gICAgICAgIF9lbmNvZGVyLFxyXG5cdFx0X3RpbWVvdXRzID0gW10sXHJcblx0XHRfaW50ZXJ2YWxzID0gW10sXHJcblx0XHRfZnJhbWVDb3VudCA9IDAsXHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA9IDAsXHJcblx0XHRfbGFzdEZyYW1lID0gbnVsbCxcclxuXHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MgPSBbXSxcclxuXHRcdF9jYXB0dXJpbmcgPSBmYWxzZSxcclxuICAgICAgICBfaGFuZGxlcnMgPSB7fTtcclxuXHJcblx0X3NldHRpbmdzLmZyYW1lcmF0ZSA9IF9zZXR0aW5ncy5mcmFtZXJhdGUgfHwgNjA7XHJcblx0X3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgPSAyICogKCBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyB8fCAxICk7XHJcblx0X3ZlcmJvc2UgPSBfc2V0dGluZ3MudmVyYm9zZSB8fCBmYWxzZTtcclxuXHRfZGlzcGxheSA9IF9zZXR0aW5ncy5kaXNwbGF5IHx8IGZhbHNlO1xyXG5cdF9zZXR0aW5ncy5zdGVwID0gMTAwMC4wIC8gX3NldHRpbmdzLmZyYW1lcmF0ZSA7XHJcblx0X3NldHRpbmdzLnRpbWVMaW1pdCA9IF9zZXR0aW5ncy50aW1lTGltaXQgfHwgMDtcclxuXHRfc2V0dGluZ3MuZnJhbWVMaW1pdCA9IF9zZXR0aW5ncy5mcmFtZUxpbWl0IHx8IDA7XHJcblx0X3NldHRpbmdzLnN0YXJ0VGltZSA9IF9zZXR0aW5ncy5zdGFydFRpbWUgfHwgMDtcclxuXHJcblx0dmFyIF90aW1lRGlzcGxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUubGVmdCA9IF90aW1lRGlzcGxheS5zdHlsZS50b3AgPSAwXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdibGFjayc7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJ1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5mb250U2l6ZSA9ICcxMXB4J1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5wYWRkaW5nID0gJzVweCdcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuY29sb3IgPSAncmVkJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuekluZGV4ID0gMTAwMDAwXHJcblx0aWYoIF9zZXR0aW5ncy5kaXNwbGF5ICkgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggX3RpbWVEaXNwbGF5ICk7XHJcblxyXG5cdHZhciBjYW52YXNNb3Rpb25CbHVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuXHR2YXIgY3R4TW90aW9uQmx1ciA9IGNhbnZhc01vdGlvbkJsdXIuZ2V0Q29udGV4dCggJzJkJyApO1xyXG5cdHZhciBidWZmZXJNb3Rpb25CbHVyO1xyXG5cdHZhciBpbWFnZURhdGE7XHJcblxyXG5cdF9sb2coICdTdGVwIGlzIHNldCB0byAnICsgX3NldHRpbmdzLnN0ZXAgKyAnbXMnICk7XHJcblxyXG4gICAgdmFyIF9lbmNvZGVycyA9IHtcclxuXHRcdGdpZjogQ0NHSUZFbmNvZGVyLFxyXG5cdFx0d2VibTogQ0NXZWJNRW5jb2RlcixcclxuXHRcdGZmbXBlZ3NlcnZlcjogQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLFxyXG5cdFx0cG5nOiBDQ1BOR0VuY29kZXIsXHJcblx0XHRqcGc6IENDSlBFR0VuY29kZXIsXHJcblx0XHQnd2VibS1tZWRpYXJlY29yZGVyJzogQ0NTdHJlYW1FbmNvZGVyXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBjdG9yID0gX2VuY29kZXJzWyBfc2V0dGluZ3MuZm9ybWF0IF07XHJcbiAgICBpZiAoICFjdG9yICkge1xyXG5cdFx0dGhyb3cgXCJFcnJvcjogSW5jb3JyZWN0IG9yIG1pc3NpbmcgZm9ybWF0OiBWYWxpZCBmb3JtYXRzIGFyZSBcIiArIE9iamVjdC5rZXlzKF9lbmNvZGVycykuam9pbihcIiwgXCIpO1xyXG4gICAgfVxyXG4gICAgX2VuY29kZXIgPSBuZXcgY3RvciggX3NldHRpbmdzICk7XHJcbiAgICBfZW5jb2Rlci5zdGVwID0gX3N0ZXBcclxuXHJcblx0X2VuY29kZXIub24oJ3Byb2Nlc3MnLCBfcHJvY2Vzcyk7XHJcbiAgICBfZW5jb2Rlci5vbigncHJvZ3Jlc3MnLCBfcHJvZ3Jlc3MpO1xyXG5cclxuICAgIGlmIChcInBlcmZvcm1hbmNlXCIgaW4gd2luZG93ID09IGZhbHNlKSB7XHJcbiAgICBcdHdpbmRvdy5wZXJmb3JtYW5jZSA9IHt9O1xyXG4gICAgfVxyXG5cclxuXHREYXRlLm5vdyA9IChEYXRlLm5vdyB8fCBmdW5jdGlvbiAoKSB7ICAvLyB0aGFua3MgSUU4XHJcblx0XHRyZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcblx0fSk7XHJcblxyXG5cdGlmIChcIm5vd1wiIGluIHdpbmRvdy5wZXJmb3JtYW5jZSA9PSBmYWxzZSl7XHJcblxyXG5cdFx0dmFyIG5vd09mZnNldCA9IERhdGUubm93KCk7XHJcblxyXG5cdFx0aWYgKHBlcmZvcm1hbmNlLnRpbWluZyAmJiBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0KXtcclxuXHRcdFx0bm93T2Zmc2V0ID0gcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydFxyXG5cdFx0fVxyXG5cclxuXHRcdHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbiBub3coKXtcclxuXHRcdFx0cmV0dXJuIERhdGUubm93KCkgLSBub3dPZmZzZXQ7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR2YXIgX29sZFNldFRpbWVvdXQgPSB3aW5kb3cuc2V0VGltZW91dCxcclxuXHRcdF9vbGRTZXRJbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCxcclxuXHQgICAgXHRfb2xkQ2xlYXJJbnRlcnZhbCA9IHdpbmRvdy5jbGVhckludGVydmFsLFxyXG5cdFx0X29sZENsZWFyVGltZW91dCA9IHdpbmRvdy5jbGVhclRpbWVvdXQsXHJcblx0XHRfb2xkUmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSxcclxuXHRcdF9vbGROb3cgPSB3aW5kb3cuRGF0ZS5ub3csXHJcblx0XHRfb2xkUGVyZm9ybWFuY2VOb3cgPSB3aW5kb3cucGVyZm9ybWFuY2Uubm93LFxyXG5cdFx0X29sZEdldFRpbWUgPSB3aW5kb3cuRGF0ZS5wcm90b3R5cGUuZ2V0VGltZTtcclxuXHQvLyBEYXRlLnByb3RvdHlwZS5fb2xkR2V0VGltZSA9IERhdGUucHJvdG90eXBlLmdldFRpbWU7XHJcblxyXG5cdHZhciBtZWRpYSA9IFtdO1xyXG5cclxuXHRmdW5jdGlvbiBfaW5pdCgpIHtcclxuXHJcblx0XHRfbG9nKCAnQ2FwdHVyZXIgc3RhcnQnICk7XHJcblxyXG5cdFx0X3N0YXJ0VGltZSA9IHdpbmRvdy5EYXRlLm5vdygpO1xyXG5cdFx0X3RpbWUgPSBfc3RhcnRUaW1lICsgX3NldHRpbmdzLnN0YXJ0VGltZTtcclxuXHRcdF9wZXJmb3JtYW5jZVN0YXJ0VGltZSA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTtcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUgPSBfcGVyZm9ybWFuY2VTdGFydFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cclxuXHRcdHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0cmV0dXJuIF90aW1lO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5EYXRlLm5vdyA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRyZXR1cm4gX3RpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oIGNhbGxiYWNrLCB0aW1lICkge1xyXG5cdFx0XHR2YXIgdCA9IHtcclxuXHRcdFx0XHRjYWxsYmFjazogY2FsbGJhY2ssXHJcblx0XHRcdFx0dGltZTogdGltZSxcclxuXHRcdFx0XHR0cmlnZ2VyVGltZTogX3RpbWUgKyB0aW1lXHJcblx0XHRcdH07XHJcblx0XHRcdF90aW1lb3V0cy5wdXNoKCB0ICk7XHJcblx0XHRcdF9sb2coICdUaW1lb3V0IHNldCB0byAnICsgdC50aW1lICk7XHJcbiAgICAgICAgICAgIHJldHVybiB0O1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQgPSBmdW5jdGlvbiggaWQgKSB7XHJcblx0XHRcdGZvciggdmFyIGogPSAwOyBqIDwgX3RpbWVvdXRzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRcdGlmKCBfdGltZW91dHNbIGogXSA9PSBpZCApIHtcclxuXHRcdFx0XHRcdF90aW1lb3V0cy5zcGxpY2UoIGosIDEgKTtcclxuXHRcdFx0XHRcdF9sb2coICdUaW1lb3V0IGNsZWFyZWQnICk7XHJcblx0XHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblx0XHR3aW5kb3cuc2V0SW50ZXJ2YWwgPSBmdW5jdGlvbiggY2FsbGJhY2ssIHRpbWUgKSB7XHJcblx0XHRcdHZhciB0ID0ge1xyXG5cdFx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0XHR0aW1lOiB0aW1lLFxyXG5cdFx0XHRcdHRyaWdnZXJUaW1lOiBfdGltZSArIHRpbWVcclxuXHRcdFx0fTtcclxuXHRcdFx0X2ludGVydmFscy5wdXNoKCB0ICk7XHJcblx0XHRcdF9sb2coICdJbnRlcnZhbCBzZXQgdG8gJyArIHQudGltZSApO1xyXG5cdFx0XHRyZXR1cm4gdDtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKCBpZCApIHtcclxuXHRcdFx0X2xvZyggJ2NsZWFyIEludGVydmFsJyApO1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cdFx0XHRfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzLnB1c2goIGNhbGxiYWNrICk7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uKCl7XHJcblx0XHRcdHJldHVybiBfcGVyZm9ybWFuY2VUaW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHRmdW5jdGlvbiBob29rQ3VycmVudFRpbWUoKSB7XHJcblx0XHRcdGlmKCAhdGhpcy5faG9va2VkICkge1xyXG5cdFx0XHRcdHRoaXMuX2hvb2tlZCA9IHRydWU7XHJcblx0XHRcdFx0dGhpcy5faG9va2VkVGltZSA9IHRoaXMuY3VycmVudFRpbWUgfHwgMDtcclxuXHRcdFx0XHR0aGlzLnBhdXNlKCk7XHJcblx0XHRcdFx0bWVkaWEucHVzaCggdGhpcyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB0aGlzLl9ob29rZWRUaW1lICsgX3NldHRpbmdzLnN0YXJ0VGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCBIVE1MVmlkZW9FbGVtZW50LnByb3RvdHlwZSwgJ2N1cnJlbnRUaW1lJywgeyBnZXQ6IGhvb2tDdXJyZW50VGltZSB9IClcclxuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCBIVE1MQXVkaW9FbGVtZW50LnByb3RvdHlwZSwgJ2N1cnJlbnRUaW1lJywgeyBnZXQ6IGhvb2tDdXJyZW50VGltZSB9IClcclxuXHRcdH0gY2F0Y2ggKGVycikge1xyXG5cdFx0XHRfbG9nKGVycik7XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0YXJ0KCkge1xyXG5cdFx0X2luaXQoKTtcclxuXHRcdF9lbmNvZGVyLnN0YXJ0KCk7XHJcblx0XHRfY2FwdHVyaW5nID0gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zdG9wKCkge1xyXG5cdFx0X2NhcHR1cmluZyA9IGZhbHNlO1xyXG5cdFx0X2VuY29kZXIuc3RvcCgpO1xyXG5cdFx0X2Rlc3Ryb3koKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jYWxsKCBmbiwgcCApIHtcclxuXHRcdF9vbGRTZXRUaW1lb3V0KCBmbiwgMCwgcCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0ZXAoKSB7XHJcblx0XHQvL19vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIF9wcm9jZXNzICk7XHJcblx0XHRfY2FsbCggX3Byb2Nlc3MgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9kZXN0cm95KCkge1xyXG5cdFx0X2xvZyggJ0NhcHR1cmVyIHN0b3AnICk7XHJcblx0XHR3aW5kb3cuc2V0VGltZW91dCA9IF9vbGRTZXRUaW1lb3V0O1xyXG5cdFx0d2luZG93LnNldEludGVydmFsID0gX29sZFNldEludGVydmFsO1xyXG5cdFx0d2luZG93LmNsZWFySW50ZXJ2YWwgPSBfb2xkQ2xlYXJJbnRlcnZhbDtcclxuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQgPSBfb2xkQ2xlYXJUaW1lb3V0O1xyXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IF9vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XHJcblx0XHR3aW5kb3cuRGF0ZS5wcm90b3R5cGUuZ2V0VGltZSA9IF9vbGRHZXRUaW1lO1xyXG5cdFx0d2luZG93LkRhdGUubm93ID0gX29sZE5vdztcclxuXHRcdHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBfb2xkUGVyZm9ybWFuY2VOb3c7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfdXBkYXRlVGltZSgpIHtcclxuXHRcdHZhciBzZWNvbmRzID0gX2ZyYW1lQ291bnQgLyBfc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdFx0aWYoICggX3NldHRpbmdzLmZyYW1lTGltaXQgJiYgX2ZyYW1lQ291bnQgPj0gX3NldHRpbmdzLmZyYW1lTGltaXQgKSB8fCAoIF9zZXR0aW5ncy50aW1lTGltaXQgJiYgc2Vjb25kcyA+PSBfc2V0dGluZ3MudGltZUxpbWl0ICkgKSB7XHJcblx0XHRcdF9zdG9wKCk7XHJcblx0XHRcdF9zYXZlKCk7XHJcblx0XHR9XHJcblx0XHR2YXIgZCA9IG5ldyBEYXRlKCBudWxsICk7XHJcblx0XHRkLnNldFNlY29uZHMoIHNlY29uZHMgKTtcclxuXHRcdGlmKCBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA+IDIgKSB7XHJcblx0XHRcdF90aW1lRGlzcGxheS50ZXh0Q29udGVudCA9ICdDQ2FwdHVyZSAnICsgX3NldHRpbmdzLmZvcm1hdCArICcgfCAnICsgX2ZyYW1lQ291bnQgKyAnIGZyYW1lcyAoJyArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ICsgJyBpbnRlcikgfCAnICsgIGQudG9JU09TdHJpbmcoKS5zdWJzdHIoIDExLCA4ICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRfdGltZURpc3BsYXkudGV4dENvbnRlbnQgPSAnQ0NhcHR1cmUgJyArIF9zZXR0aW5ncy5mb3JtYXQgKyAnIHwgJyArIF9mcmFtZUNvdW50ICsgJyBmcmFtZXMgfCAnICsgIGQudG9JU09TdHJpbmcoKS5zdWJzdHIoIDExLCA4ICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2hlY2tGcmFtZSggY2FudmFzICkge1xyXG5cclxuXHRcdGlmKCBjYW52YXNNb3Rpb25CbHVyLndpZHRoICE9PSBjYW52YXMud2lkdGggfHwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgIT09IGNhbnZhcy5oZWlnaHQgKSB7XHJcblx0XHRcdGNhbnZhc01vdGlvbkJsdXIud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0XHRcdGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1ciA9IG5ldyBVaW50MTZBcnJheSggY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKiBjYW52YXNNb3Rpb25CbHVyLndpZHRoICogNCApO1xyXG5cdFx0XHRjdHhNb3Rpb25CbHVyLmZpbGxTdHlsZSA9ICcjMCdcclxuXHRcdFx0Y3R4TW90aW9uQmx1ci5maWxsUmVjdCggMCwgMCwgY2FudmFzTW90aW9uQmx1ci53aWR0aCwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfYmxlbmRGcmFtZSggY2FudmFzICkge1xyXG5cclxuXHRcdC8vX2xvZyggJ0ludGVybWVkaWF0ZSBGcmFtZTogJyArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ICk7XHJcblxyXG5cdFx0Y3R4TW90aW9uQmx1ci5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cdFx0aW1hZ2VEYXRhID0gY3R4TW90aW9uQmx1ci5nZXRJbWFnZURhdGEoIDAsIDAsIGNhbnZhc01vdGlvbkJsdXIud2lkdGgsIGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICk7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiBdICs9IGltYWdlRGF0YS5kYXRhWyBqIF07XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAxIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogKyAxIF07XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogKyAyIF07XHJcblx0XHR9XHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCsrO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zYXZlRnJhbWUoKXtcclxuXHJcblx0XHR2YXIgZGF0YSA9IGltYWdlRGF0YS5kYXRhO1xyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBidWZmZXJNb3Rpb25CbHVyLmxlbmd0aDsgais9IDQgKSB7XHJcblx0XHRcdGRhdGFbIGogXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdFx0ZGF0YVsgaiArIDEgXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAxIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHRcdGRhdGFbIGogKyAyIF0gPSBidWZmZXJNb3Rpb25CbHVyWyBqICsgMiBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0fVxyXG5cdFx0Y3R4TW90aW9uQmx1ci5wdXRJbWFnZURhdGEoIGltYWdlRGF0YSwgMCwgMCApO1xyXG5cdFx0X2VuY29kZXIuYWRkKCBjYW52YXNNb3Rpb25CbHVyICk7XHJcblx0XHRfZnJhbWVDb3VudCsrO1xyXG5cdFx0X2ludGVybWVkaWF0ZUZyYW1lQ291bnQgPSAwO1xyXG5cdFx0X2xvZyggJ0Z1bGwgTUIgRnJhbWUhICcgKyBfZnJhbWVDb3VudCArICcgJyArICBfdGltZSApO1xyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBidWZmZXJNb3Rpb25CbHVyLmxlbmd0aDsgais9IDQgKSB7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogXSA9IDA7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAxIF0gPSAwO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMiBdID0gMDtcclxuXHRcdH1cclxuXHRcdGdjKCk7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NhcHR1cmUoIGNhbnZhcyApIHtcclxuXHJcblx0XHRpZiggX2NhcHR1cmluZyApIHtcclxuXHJcblx0XHRcdGlmKCBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA+IDIgKSB7XHJcblxyXG5cdFx0XHRcdF9jaGVja0ZyYW1lKCBjYW52YXMgKTtcclxuXHRcdFx0XHRfYmxlbmRGcmFtZSggY2FudmFzICk7XHJcblxyXG5cdFx0XHRcdGlmKCBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA+PSAuNSAqIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzICkge1xyXG5cdFx0XHRcdFx0X3NhdmVGcmFtZSgpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRfc3RlcCgpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0X2VuY29kZXIuYWRkKCBjYW52YXMgKTtcclxuXHRcdFx0XHRfZnJhbWVDb3VudCsrO1xyXG5cdFx0XHRcdF9sb2coICdGdWxsIEZyYW1lISAnICsgX2ZyYW1lQ291bnQgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfcHJvY2VzcygpIHtcclxuXHJcblx0XHR2YXIgc3RlcCA9IDEwMDAgLyBfc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdFx0dmFyIGR0ID0gKCBfZnJhbWVDb3VudCArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50IC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgKSAqIHN0ZXA7XHJcblxyXG5cdFx0X3RpbWUgPSBfc3RhcnRUaW1lICsgZHQ7XHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lID0gX3BlcmZvcm1hbmNlU3RhcnRUaW1lICsgZHQ7XHJcblxyXG5cdFx0bWVkaWEuZm9yRWFjaCggZnVuY3Rpb24oIHYgKSB7XHJcblx0XHRcdHYuX2hvb2tlZFRpbWUgPSBkdCAvIDEwMDA7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0X3VwZGF0ZVRpbWUoKTtcclxuXHRcdF9sb2coICdGcmFtZTogJyArIF9mcmFtZUNvdW50ICsgJyAnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKTtcclxuXHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IF90aW1lb3V0cy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0aWYoIF90aW1lID49IF90aW1lb3V0c1sgaiBdLnRyaWdnZXJUaW1lICkge1xyXG5cdFx0XHRcdF9jYWxsKCBfdGltZW91dHNbIGogXS5jYWxsYmFjayApXHJcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggJ3RpbWVvdXQhJyApO1xyXG5cdFx0XHRcdF90aW1lb3V0cy5zcGxpY2UoIGosIDEgKTtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgX2ludGVydmFscy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0aWYoIF90aW1lID49IF9pbnRlcnZhbHNbIGogXS50cmlnZ2VyVGltZSApIHtcclxuXHRcdFx0XHRfY2FsbCggX2ludGVydmFsc1sgaiBdLmNhbGxiYWNrICk7XHJcblx0XHRcdFx0X2ludGVydmFsc1sgaiBdLnRyaWdnZXJUaW1lICs9IF9pbnRlcnZhbHNbIGogXS50aW1lO1xyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coICdpbnRlcnZhbCEnICk7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBjYiApIHtcclxuICAgICBcdFx0X2NhbGwoIGNiLCBfdGltZSAtIGdfc3RhcnRUaW1lICk7XHJcbiAgICAgICAgfSApO1xyXG4gICAgICAgIF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MgPSBbXTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc2F2ZSggY2FsbGJhY2sgKSB7XHJcblxyXG5cdFx0aWYoICFjYWxsYmFjayApIHtcclxuXHRcdFx0Y2FsbGJhY2sgPSBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdFx0XHRkb3dubG9hZCggYmxvYiwgX2VuY29kZXIuZmlsZW5hbWUgKyBfZW5jb2Rlci5leHRlbnNpb24sIF9lbmNvZGVyLm1pbWVUeXBlICk7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRfZW5jb2Rlci5zYXZlKCBjYWxsYmFjayApO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9sb2coIG1lc3NhZ2UgKSB7XHJcblx0XHRpZiggX3ZlcmJvc2UgKSBjb25zb2xlLmxvZyggbWVzc2FnZSApO1xyXG5cdH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb24oIGV2ZW50LCBoYW5kbGVyICkge1xyXG5cclxuICAgICAgICBfaGFuZGxlcnNbZXZlbnRdID0gaGFuZGxlcjtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2VtaXQoIGV2ZW50ICkge1xyXG5cclxuICAgICAgICB2YXIgaGFuZGxlciA9IF9oYW5kbGVyc1tldmVudF07XHJcbiAgICAgICAgaWYgKCBoYW5kbGVyICkge1xyXG5cclxuICAgICAgICAgICAgaGFuZGxlci5hcHBseSggbnVsbCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGFyZ3VtZW50cywgMSApICk7XHJcblxyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX3Byb2dyZXNzKCBwcm9ncmVzcyApIHtcclxuXHJcbiAgICAgICAgX2VtaXQoICdwcm9ncmVzcycsIHByb2dyZXNzICk7XHJcblxyXG4gICAgfVxyXG5cclxuXHRyZXR1cm4ge1xyXG5cdFx0c3RhcnQ6IF9zdGFydCxcclxuXHRcdGNhcHR1cmU6IF9jYXB0dXJlLFxyXG5cdFx0c3RvcDogX3N0b3AsXHJcblx0XHRzYXZlOiBfc2F2ZSxcclxuICAgICAgICBvbjogX29uXHJcblx0fVxyXG59XHJcblxyXG4oZnJlZVdpbmRvdyB8fCBmcmVlU2VsZiB8fCB7fSkuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxuXHJcbiAgLy8gU29tZSBBTUQgYnVpbGQgb3B0aW1pemVycyBsaWtlIHIuanMgY2hlY2sgZm9yIGNvbmRpdGlvbiBwYXR0ZXJucyBsaWtlIHRoZSBmb2xsb3dpbmc6XHJcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XHJcbiAgICAvLyBEZWZpbmUgYXMgYW4gYW5vbnltb3VzIG1vZHVsZSBzbywgdGhyb3VnaCBwYXRoIG1hcHBpbmcsIGl0IGNhbiBiZVxyXG4gICAgLy8gcmVmZXJlbmNlZCBhcyB0aGUgXCJ1bmRlcnNjb3JlXCIgbW9kdWxlLlxyXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xyXG4gICAgXHRyZXR1cm4gQ0NhcHR1cmU7XHJcbiAgICB9KTtcclxufVxyXG4gIC8vIENoZWNrIGZvciBgZXhwb3J0c2AgYWZ0ZXIgYGRlZmluZWAgaW4gY2FzZSBhIGJ1aWxkIG9wdGltaXplciBhZGRzIGFuIGBleHBvcnRzYCBvYmplY3QuXHJcbiAgZWxzZSBpZiAoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSkge1xyXG4gICAgLy8gRXhwb3J0IGZvciBOb2RlLmpzLlxyXG4gICAgaWYgKG1vZHVsZUV4cG9ydHMpIHtcclxuICAgIFx0KGZyZWVNb2R1bGUuZXhwb3J0cyA9IENDYXB0dXJlKS5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG4gICAgfVxyXG4gICAgLy8gRXhwb3J0IGZvciBDb21tb25KUyBzdXBwb3J0LlxyXG4gICAgZnJlZUV4cG9ydHMuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxufVxyXG5lbHNlIHtcclxuICAgIC8vIEV4cG9ydCB0byB0aGUgZ2xvYmFsIG9iamVjdC5cclxuICAgIHJvb3QuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxufVxyXG5cclxufSgpKTtcclxuIiwiLyoqXG4gKiBAYXV0aG9yIGFsdGVyZWRxIC8gaHR0cDovL2FsdGVyZWRxdWFsaWEuY29tL1xuICogQGF1dGhvciBtci5kb29iIC8gaHR0cDovL21yZG9vYi5jb20vXG4gKi9cblxudmFyIERldGVjdG9yID0ge1xuXG5cdGNhbnZhczogISEgd2luZG93LkNhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCxcblx0d2ViZ2w6ICggZnVuY3Rpb24gKCkge1xuXG5cdFx0dHJ5IHtcblxuXHRcdFx0dmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7IHJldHVybiAhISAoIHdpbmRvdy5XZWJHTFJlbmRlcmluZ0NvbnRleHQgJiYgKCBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApIHx8IGNhbnZhcy5nZXRDb250ZXh0KCAnZXhwZXJpbWVudGFsLXdlYmdsJyApICkgKTtcblxuXHRcdH0gY2F0Y2ggKCBlICkge1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cblx0XHR9XG5cblx0fSApKCksXG5cdHdvcmtlcnM6ICEhIHdpbmRvdy5Xb3JrZXIsXG5cdGZpbGVhcGk6IHdpbmRvdy5GaWxlICYmIHdpbmRvdy5GaWxlUmVhZGVyICYmIHdpbmRvdy5GaWxlTGlzdCAmJiB3aW5kb3cuQmxvYixcblxuXHRnZXRXZWJHTEVycm9yTWVzc2FnZTogZnVuY3Rpb24gKCkge1xuXG5cdFx0dmFyIGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRcdGVsZW1lbnQuaWQgPSAnd2ViZ2wtZXJyb3ItbWVzc2FnZSc7XG5cdFx0ZWxlbWVudC5zdHlsZS5mb250RmFtaWx5ID0gJ21vbm9zcGFjZSc7XG5cdFx0ZWxlbWVudC5zdHlsZS5mb250U2l6ZSA9ICcxM3B4Jztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRXZWlnaHQgPSAnbm9ybWFsJztcblx0XHRlbGVtZW50LnN0eWxlLnRleHRBbGlnbiA9ICdjZW50ZXInO1xuXHRcdGVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZCA9ICcjZmZmJztcblx0XHRlbGVtZW50LnN0eWxlLmNvbG9yID0gJyMwMDAnO1xuXHRcdGVsZW1lbnQuc3R5bGUucGFkZGluZyA9ICcxLjVlbSc7XG5cdFx0ZWxlbWVudC5zdHlsZS56SW5kZXggPSAnOTk5Jztcblx0XHRlbGVtZW50LnN0eWxlLndpZHRoID0gJzQwMHB4Jztcblx0XHRlbGVtZW50LnN0eWxlLm1hcmdpbiA9ICc1ZW0gYXV0byAwJztcblxuXHRcdGlmICggISB0aGlzLndlYmdsICkge1xuXG5cdFx0XHRlbGVtZW50LmlubmVySFRNTCA9IHdpbmRvdy5XZWJHTFJlbmRlcmluZ0NvbnRleHQgPyBbXG5cdFx0XHRcdCdZb3VyIGdyYXBoaWNzIGNhcmQgZG9lcyBub3Qgc2VlbSB0byBzdXBwb3J0IDxhIGhyZWY9XCJodHRwOi8va2hyb25vcy5vcmcvd2ViZ2wvd2lraS9HZXR0aW5nX2FfV2ViR0xfSW1wbGVtZW50YXRpb25cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5XZWJHTDwvYT4uPGJyIC8+Jyxcblx0XHRcdFx0J0ZpbmQgb3V0IGhvdyB0byBnZXQgaXQgPGEgaHJlZj1cImh0dHA6Ly9nZXQud2ViZ2wub3JnL1wiIHN0eWxlPVwiY29sb3I6IzAwMFwiPmhlcmU8L2E+Lidcblx0XHRcdF0uam9pbiggJ1xcbicgKSA6IFtcblx0XHRcdFx0J1lvdXIgYnJvd3NlciBkb2VzIG5vdCBzZWVtIHRvIHN1cHBvcnQgPGEgaHJlZj1cImh0dHA6Ly9raHJvbm9zLm9yZy93ZWJnbC93aWtpL0dldHRpbmdfYV9XZWJHTF9JbXBsZW1lbnRhdGlvblwiIHN0eWxlPVwiY29sb3I6IzAwMFwiPldlYkdMPC9hPi48YnIvPicsXG5cdFx0XHRcdCdGaW5kIG91dCBob3cgdG8gZ2V0IGl0IDxhIGhyZWY9XCJodHRwOi8vZ2V0LndlYmdsLm9yZy9cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5oZXJlPC9hPi4nXG5cdFx0XHRdLmpvaW4oICdcXG4nICk7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gZWxlbWVudDtcblxuXHR9LFxuXG5cdGFkZEdldFdlYkdMTWVzc2FnZTogZnVuY3Rpb24gKCBwYXJhbWV0ZXJzICkge1xuXG5cdFx0dmFyIHBhcmVudCwgaWQsIGVsZW1lbnQ7XG5cblx0XHRwYXJhbWV0ZXJzID0gcGFyYW1ldGVycyB8fCB7fTtcblxuXHRcdHBhcmVudCA9IHBhcmFtZXRlcnMucGFyZW50ICE9PSB1bmRlZmluZWQgPyBwYXJhbWV0ZXJzLnBhcmVudCA6IGRvY3VtZW50LmJvZHk7XG5cdFx0aWQgPSBwYXJhbWV0ZXJzLmlkICE9PSB1bmRlZmluZWQgPyBwYXJhbWV0ZXJzLmlkIDogJ29sZGllJztcblxuXHRcdGVsZW1lbnQgPSBEZXRlY3Rvci5nZXRXZWJHTEVycm9yTWVzc2FnZSgpO1xuXHRcdGVsZW1lbnQuaWQgPSBpZDtcblxuXHRcdHBhcmVudC5hcHBlbmRDaGlsZCggZWxlbWVudCApO1xuXG5cdH1cblxufTtcblxuLy9FUzYgZXhwb3J0XG5cbmV4cG9ydCB7IERldGVjdG9yIH07XG4iLCIvL1RoaXMgbGlicmFyeSBpcyBkZXNpZ25lZCB0byBoZWxwIHN0YXJ0IHRocmVlLmpzIGVhc2lseSwgY3JlYXRpbmcgdGhlIHJlbmRlciBsb29wIGFuZCBjYW52YXMgYXV0b21hZ2ljYWxseS5cbi8vUmVhbGx5IGl0IHNob3VsZCBiZSBzcHVuIG9mZiBpbnRvIGl0cyBvd24gdGhpbmcgaW5zdGVhZCBvZiBiZWluZyBwYXJ0IG9mIGV4cGxhbmFyaWEuXG5cbi8vYWxzbywgY2hhbmdlIFRocmVlYXN5X0Vudmlyb25tZW50IHRvIFRocmVlYXN5X1JlY29yZGVyIHRvIGRvd25sb2FkIGhpZ2gtcXVhbGl0eSBmcmFtZXMgb2YgYW4gYW5pbWF0aW9uXG5cbmltcG9ydCBDQ2FwdHVyZSBmcm9tICdjY2FwdHVyZS5qcyc7XG5pbXBvcnQgeyBEZXRlY3RvciB9IGZyb20gJy4uL2xpYi9XZWJHTF9EZXRlY3Rvci5qcyc7XG5pbXBvcnQgeyBzZXRUaHJlZUVudmlyb25tZW50LCBnZXRUaHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxuZnVuY3Rpb24gVGhyZWVhc3lFbnZpcm9ubWVudChjYW52YXNFbGVtID0gbnVsbCl7XG5cdHRoaXMucHJldl90aW1lc3RlcCA9IDA7XG4gICAgdGhpcy5zaG91bGRDcmVhdGVDYW52YXMgPSAoY2FudmFzRWxlbSA9PT0gbnVsbCk7XG5cblx0aWYoIURldGVjdG9yLndlYmdsKURldGVjdG9yLmFkZEdldFdlYkdMTWVzc2FnZSgpO1xuXG4gICAgLy9mb3YsIGFzcGVjdCwgbmVhciwgZmFyXG5cdHRoaXMuY2FtZXJhID0gbmV3IFRIUkVFLlBlcnNwZWN0aXZlQ2FtZXJhKCA3MCwgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDAuMSwgMTAwMDAwMDAgKTtcblx0Ly90aGlzLmNhbWVyYSA9IG5ldyBUSFJFRS5PcnRob2dyYXBoaWNDYW1lcmEoIDcwLCB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgMC4xLCAxMCApO1xuXG5cdHRoaXMuY2FtZXJhLnBvc2l0aW9uLnNldCgwLCAwLCAxMCk7XG5cdHRoaXMuY2FtZXJhLmxvb2tBdChuZXcgVEhSRUUuVmVjdG9yMygwLDAsMCkpO1xuXG5cblx0Ly9jcmVhdGUgY2FtZXJhLCBzY2VuZSwgdGltZXIsIHJlbmRlcmVyIG9iamVjdHNcblx0Ly9jcmFldGUgcmVuZGVyIG9iamVjdFxuXG5cblx0XG5cdHRoaXMuc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcblx0dGhpcy5zY2VuZS5hZGQodGhpcy5jYW1lcmEpO1xuXG5cdC8vcmVuZGVyZXJcblx0bGV0IHJlbmRlcmVyT3B0aW9ucyA9IHsgYW50aWFsaWFzOiB0cnVlfTtcblxuICAgIGlmKCF0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyl7XG4gICAgICAgIHJlbmRlcmVyT3B0aW9ucy5jYW52YXMgPSBjYW52YXNFbGVtO1xuICAgIH1cblxuXHR0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoIHJlbmRlcmVyT3B0aW9ucyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldFBpeGVsUmF0aW8oIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvICk7XG5cdHRoaXMucmVuZGVyZXIuc2V0Q2xlYXJDb2xvcihuZXcgVEhSRUUuQ29sb3IoMHhGRkZGRkYpLCAxLjApO1xuXG5cbiAgICB0aGlzLnJlc2l6ZUNhbnZhc0lmTmVjZXNzYXJ5KCk7IC8vcmVzaXplIGNhbnZhcyB0byB3aW5kb3cgc2l6ZSBhbmQgc2V0IGFzcGVjdCByYXRpb1xuXHQvKlxuXHR0aGlzLnJlbmRlcmVyLmdhbW1hSW5wdXQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLmdhbW1hT3V0cHV0ID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci5zaGFkb3dNYXAuZW5hYmxlZCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIudnIuZW5hYmxlZCA9IHRydWU7XG5cdCovXG5cblx0dGhpcy50aW1lU2NhbGUgPSAxO1xuXHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblx0dGhpcy50cnVlRWxhcHNlZFRpbWUgPSAwO1xuXG4gICAgaWYodGhpcy5zaG91bGRDcmVhdGVDYW52YXMpe1xuXHQgICAgdGhpcy5jb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHQgICAgdGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQoIHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCApO1xuICAgIH1cblxuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIHRoaXMub25Nb3VzZURvd24uYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZXVwJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaHN0YXJ0JywgdGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoZW5kJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblxuXHQvKlxuXHQvL3JlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlOyBcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd2cmRpc3BsYXlwb2ludGVycmVzdHJpY3RlZCcsIG9uUG9pbnRlclJlc3RyaWN0ZWQsIGZhbHNlICk7XG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cG9pbnRlcnVucmVzdHJpY3RlZCcsIG9uUG9pbnRlclVucmVzdHJpY3RlZCwgZmFsc2UgKTtcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggV0VCVlIuY3JlYXRlQnV0dG9uKCByZW5kZXJlciApICk7XG5cdCovXG5cblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCB0aGlzLm9uUGFnZUxvYWQuYmluZCh0aGlzKSwgZmFsc2UpO1xuXG5cdHRoaXMuY2xvY2sgPSBuZXcgVEhSRUUuQ2xvY2soKTtcblxuXHR0aGlzLklTX1JFQ09SRElORyA9IGZhbHNlOyAvLyBxdWVyeWFibGUgaWYgb25lIHdhbnRzIHRvIGRvIHRoaW5ncyBsaWtlIGJlZWYgdXAgcGFydGljbGUgY291bnRzIGZvciByZW5kZXJcblxuICAgIGlmKCF0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyAmJiBjYW52YXNFbGVtLm9mZnNldFdpZHRoKXtcbiAgICAgICAgLy9JZiB0aGUgY2FudmFzRWxlbWVudCBpcyBhbHJlYWR5IGxvYWRlZCwgdGhlbiB0aGUgJ2xvYWQnIGV2ZW50IGhhcyBhbHJlYWR5IGZpcmVkLiBXZSBuZWVkIHRvIHRyaWdnZXIgaXQgb3Vyc2VsdmVzLlxuICAgICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMub25QYWdlTG9hZC5iaW5kKHRoaXMpKTtcbiAgICB9XG59XG5cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUGFnZUxvYWQgPSBmdW5jdGlvbigpIHtcblx0Y29uc29sZS5sb2coXCJUaHJlZWFzeV9TZXR1cCBsb2FkZWQhXCIpO1xuXHRpZih0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyl7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggdGhpcy5jb250YWluZXIgKTtcblx0fVxuXG5cdHRoaXMuc3RhcnQoKTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKXtcblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cdHRoaXMuY2xvY2suc3RhcnQoKTtcblx0dGhpcy5yZW5kZXIodGhpcy5wcmV2X3RpbWVzdGVwKTtcbn1cblxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Nb3VzZURvd24gPSBmdW5jdGlvbigpIHtcblx0dGhpcy5pc01vdXNlRG93biA9IHRydWU7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbk1vdXNlVXA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmlzTW91c2VEb3duID0gZmFsc2U7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vblBvaW50ZXJSZXN0cmljdGVkPSBmdW5jdGlvbigpIHtcblx0dmFyIHBvaW50ZXJMb2NrRWxlbWVudCA9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudDtcblx0aWYgKCBwb2ludGVyTG9ja0VsZW1lbnQgJiYgdHlwZW9mKHBvaW50ZXJMb2NrRWxlbWVudC5yZXF1ZXN0UG9pbnRlckxvY2spID09PSAnZnVuY3Rpb24nICkge1xuXHRcdHBvaW50ZXJMb2NrRWxlbWVudC5yZXF1ZXN0UG9pbnRlckxvY2soKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Qb2ludGVyVW5yZXN0cmljdGVkPSBmdW5jdGlvbigpIHtcblx0dmFyIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgPSBkb2N1bWVudC5wb2ludGVyTG9ja0VsZW1lbnQ7XG5cdHZhciBleHBlY3RlZFBvaW50ZXJMb2NrRWxlbWVudCA9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudDtcblx0aWYgKCBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ICYmIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgPT09IGV4cGVjdGVkUG9pbnRlckxvY2tFbGVtZW50ICYmIHR5cGVvZihkb2N1bWVudC5leGl0UG9pbnRlckxvY2spID09PSAnZnVuY3Rpb24nICkge1xuXHRcdGRvY3VtZW50LmV4aXRQb2ludGVyTG9jaygpO1xuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5ldmVuaWZ5ID0gZnVuY3Rpb24oeCl7XG5cdGlmKHggJSAyID09IDEpe1xuXHRcdHJldHVybiB4KzE7XG5cdH1cblx0cmV0dXJuIHg7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZXNpemVDYW52YXNJZk5lY2Vzc2FyeT0gZnVuY3Rpb24oKSB7XG4gICAgLy9odHRwczovL3dlYmdsMmZ1bmRhbWVudGFscy5vcmcvd2ViZ2wvbGVzc29ucy93ZWJnbC1hbnRpLXBhdHRlcm5zLmh0bWwgeWVzLCBldmVyeSBmcmFtZS5cbiAgICAvL3RoaXMgaGFuZGxlcyB0aGUgZWRnZSBjYXNlIHdoZXJlIHRoZSBjYW52YXMgc2l6ZSBjaGFuZ2VzIGJ1dCB0aGUgd2luZG93IHNpemUgZG9lc24ndFxuXG4gICAgbGV0IHdpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG4gICAgbGV0IGhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICBcbiAgICBpZighdGhpcy5zaG91bGRDcmVhdGVDYW52YXMpeyAvLyBhIGNhbnZhcyB3YXMgcHJvdmlkZWQgZXh0ZXJuYWxseVxuICAgICAgICB3aWR0aCA9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5jbGllbnRXaWR0aDtcbiAgICAgICAgaGVpZ2h0ID0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmNsaWVudEhlaWdodDtcbiAgICB9XG5cbiAgICBpZih3aWR0aCAhPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQud2lkdGggfHwgaGVpZ2h0ICE9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5oZWlnaHQpe1xuICAgICAgICAvL2NhbnZhcyBkaW1lbnNpb25zIGNoYW5nZWQsIHVwZGF0ZSB0aGUgaW50ZXJuYWwgcmVzb2x1dGlvblxuXG5cdCAgICB0aGlzLmNhbWVyYS5hc3BlY3QgPSB3aWR0aCAvIGhlaWdodDtcbiAgICAgICAgLy90aGlzLmNhbWVyYS5zZXRGb2NhbExlbmd0aCgzMCk7IC8vaWYgSSB1c2UgdGhpcywgdGhlIGNhbWVyYSB3aWxsIGtlZXAgYSBjb25zdGFudCB3aWR0aCBpbnN0ZWFkIG9mIGNvbnN0YW50IGhlaWdodFxuXHQgICAgdGhpcy5hc3BlY3QgPSB0aGlzLmNhbWVyYS5hc3BlY3Q7XG5cdCAgICB0aGlzLmNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG5cdCAgICB0aGlzLnJlbmRlcmVyLnNldFNpemUoIHRoaXMuZXZlbmlmeSh3aWR0aCksIHRoaXMuZXZlbmlmeShoZWlnaHQpLHRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzICk7XG4gICAgfVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUubGlzdGVuZXJzID0ge1widXBkYXRlXCI6IFtdLFwicmVuZGVyXCI6W119OyAvL3VwZGF0ZSBldmVudCBsaXN0ZW5lcnNcblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKHRpbWVzdGVwKXtcbiAgICB0aGlzLnJlc2l6ZUNhbnZhc0lmTmVjZXNzYXJ5KCk7XG5cbiAgICB2YXIgcmVhbHRpbWVEZWx0YSA9IHRoaXMuY2xvY2suZ2V0RGVsdGEoKTtcblx0dmFyIGRlbHRhID0gcmVhbHRpbWVEZWx0YSp0aGlzLnRpbWVTY2FsZTtcblx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcbiAgICB0aGlzLnRydWVFbGFwc2VkVGltZSArPSByZWFsdGltZURlbHRhO1xuXHQvL2dldCB0aW1lc3RlcFxuXHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmxlbmd0aDtpKyspe1xuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YSwncmVhbHRpbWVEZWx0YSc6cmVhbHRpbWVEZWx0YX0pO1xuXHR9XG5cblx0dGhpcy5yZW5kZXJlci5yZW5kZXIoIHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhICk7XG5cblx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXVtpXSgpO1xuXHR9XG5cblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gdGltZXN0ZXA7XG5cdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50X25hbWUsIGZ1bmMpe1xuXHQvL1JlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lci5cblx0Ly9lYWNoIGxpc3RlbmVyIHdpbGwgYmUgY2FsbGVkIHdpdGggYW4gb2JqZWN0IGNvbnNpc3Rpbmcgb2Y6XG5cdC8vXHR7dDogPGN1cnJlbnQgdGltZSBpbiBzPiwgXCJkZWx0YVwiOiA8ZGVsdGEsIGluIG1zPn1cblx0Ly8gYW4gdXBkYXRlIGV2ZW50IGZpcmVzIGJlZm9yZSBhIHJlbmRlci4gYSByZW5kZXIgZXZlbnQgZmlyZXMgcG9zdC1yZW5kZXIuXG5cdGlmKGV2ZW50X25hbWUgPT0gXCJ1cGRhdGVcIil7IFxuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLnB1c2goZnVuYyk7XG5cdH1lbHNlIGlmKGV2ZW50X25hbWUgPT0gXCJyZW5kZXJcIil7IFxuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLnB1c2goZnVuYyk7XG5cdH1lbHNle1xuXHRcdGNvbnNvbGUuZXJyb3IoXCJJbnZhbGlkIGV2ZW50IG5hbWUhXCIpXG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbihldmVudF9uYW1lLCBmdW5jKXtcblx0Ly9VbnJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciwgdW5kb2luZyBhbiBUaHJlZWFzeV9zZXR1cC5vbigpIGV2ZW50IGxpc3RlbmVyLlxuXHQvL3RoZSBuYW1pbmcgc2NoZW1lIG1pZ2h0IG5vdCBiZSB0aGUgYmVzdCBoZXJlLlxuXHRpZihldmVudF9uYW1lID09IFwidXBkYXRlXCIpeyBcblx0XHRsZXQgaW5kZXggPSB0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5pbmRleE9mKGZ1bmMpO1xuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLnNwbGljZShpbmRleCwxKTtcblx0fSBlbHNlIGlmKGV2ZW50X25hbWUgPT0gXCJyZW5kZXJcIil7IFxuXHRcdGxldCBpbmRleCA9IHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLmluZGV4T2YoZnVuYyk7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0uc3BsaWNlKGluZGV4LDEpO1xuXHR9ZWxzZXtcblx0XHRjb25zb2xlLmVycm9yKFwiTm9uZXhpc3RlbnQgZXZlbnQgbmFtZSFcIilcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub2ZmID0gVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lcjsgLy9hbGlhcyB0byBtYXRjaCBUaHJlZWFzeUVudmlyb25tZW50Lm9uXG5cbmNsYXNzIFRocmVlYXN5UmVjb3JkZXIgZXh0ZW5kcyBUaHJlZWFzeUVudmlyb25tZW50e1xuXHQvL2Jhc2VkIG9uIGh0dHA6Ly93d3cudHlzb25jYWRlbmhlYWQuY29tL2Jsb2cvZXhwb3J0aW5nLWNhbnZhcy1hbmltYXRpb24tdG8tbW92LyB0byByZWNvcmQgYW4gYW5pbWF0aW9uXG5cdC8vd2hlbiBkb25lLCAgICAgZmZtcGVnIC1yIDYwIC1mcmFtZXJhdGUgNjAgLWkgLi8lMDdkLnBuZyAtdmNvZGVjIGxpYngyNjQgLXBpeF9mbXQgeXV2NDIwcCAtY3JmOnYgMCB2aWRlby5tcDRcbiAgICAvLyB0byBwZXJmb3JtIG1vdGlvbiBibHVyIG9uIGFuIG92ZXJzYW1wbGVkIHZpZGVvLCBmZm1wZWcgLWkgdmlkZW8ubXA0IC12ZiB0YmxlbmQ9YWxsX21vZGU9YXZlcmFnZSxmcmFtZXN0ZXA9MiB2aWRlbzIubXA0XG5cdC8vdGhlbiwgYWRkIHRoZSB5dXY0MjBwIHBpeGVscyAod2hpY2ggZm9yIHNvbWUgcmVhc29uIGlzbid0IGRvbmUgYnkgdGhlIHByZXYgY29tbWFuZCkgYnk6XG5cdC8vIGZmbXBlZyAtaSB2aWRlby5tcDQgLXZjb2RlYyBsaWJ4MjY0IC1waXhfZm10IHl1djQyMHAgLXN0cmljdCAtMiAtYWNvZGVjIGFhYyBmaW5pc2hlZF92aWRlby5tcDRcblx0Ly9jaGVjayB3aXRoIGZmbXBlZyAtaSBmaW5pc2hlZF92aWRlby5tcDRcblxuXHRjb25zdHJ1Y3RvcihmcHM9MzAsIGxlbmd0aCA9IDUsIGNhbnZhc0VsZW0gPSBudWxsKXtcblx0XHQvKiBmcHMgaXMgZXZpZGVudCwgYXV0b3N0YXJ0IGlzIGEgYm9vbGVhbiAoYnkgZGVmYXVsdCwgdHJ1ZSksIGFuZCBsZW5ndGggaXMgaW4gcy4qL1xuXHRcdHN1cGVyKGNhbnZhc0VsZW0pO1xuXHRcdHRoaXMuZnBzID0gZnBzO1xuXHRcdHRoaXMuZWxhcHNlZFRpbWUgPSAwO1xuXHRcdHRoaXMuZnJhbWVDb3VudCA9IGZwcyAqIGxlbmd0aDtcblx0XHR0aGlzLmZyYW1lc19yZW5kZXJlZCA9IDA7XG5cblx0XHR0aGlzLmNhcHR1cmVyID0gbmV3IENDYXB0dXJlKCB7XG5cdFx0XHRmcmFtZXJhdGU6IGZwcyxcblx0XHRcdGZvcm1hdDogJ3BuZycsXG5cdFx0XHRuYW1lOiBkb2N1bWVudC50aXRsZSxcblx0XHRcdC8vdmVyYm9zZTogdHJ1ZSxcblx0XHR9ICk7XG5cblx0XHR0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuXG5cdFx0dGhpcy5JU19SRUNPUkRJTkcgPSB0cnVlO1xuXHR9XG5cdHN0YXJ0KCl7XG5cdFx0Ly9tYWtlIGEgcmVjb3JkaW5nIHNpZ25cblx0XHR0aGlzLnJlY29yZGluZ19pY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLndpZHRoPVwiMjBweFwiXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5oZWlnaHQ9XCIyMHB4XCJcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLnRvcCA9ICcyMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmxlZnQgPSAnMjBweCc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnMTBweCc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmVkJztcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMucmVjb3JkaW5nX2ljb24pO1xuXG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS50b3AgPSAnMjBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUubGVmdCA9ICc1MHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5jb2xvciA9ICdibGFjayc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDI1NSwyNTUsMjU1LDAuMSknO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5mcmFtZUNvdW50ZXIpO1xuXG5cdFx0dGhpcy5jYXB0dXJlci5zdGFydCgpO1xuXHRcdHRoaXMucmVuZGVyaW5nID0gdHJ1ZTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cdHJlbmRlcih0aW1lc3RlcCl7XG4gICAgICAgIHZhciByZWFsdGltZURlbHRhID0gMS90aGlzLmZwczsvL2lnbm9yaW5nIHRoZSB0cnVlIHRpbWUsIGNhbGN1bGF0ZSB0aGUgZGVsdGFcblx0XHR2YXIgZGVsdGEgPSByZWFsdGltZURlbHRhKnRoaXMudGltZVNjYWxlOyBcblx0XHR0aGlzLmVsYXBzZWRUaW1lICs9IGRlbHRhO1xuICAgICAgICB0aGlzLnRydWVFbGFwc2VkVGltZSArPSByZWFsdGltZURlbHRhO1xuXG5cdFx0Ly9nZXQgdGltZXN0ZXBcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl1baV0oe1widFwiOnRoaXMuZWxhcHNlZFRpbWUsXCJkZWx0YVwiOmRlbHRhLCAncmVhbHRpbWVEZWx0YSc6cmVhbHRpbWVEZWx0YX0pO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSApO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdW2ldKCk7XG5cdFx0fVxuXG5cblx0XHR0aGlzLnJlY29yZF9mcmFtZSgpO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLnJlbmRlci5iaW5kKHRoaXMpKTtcblx0fVxuXHRyZWNvcmRfZnJhbWUoKXtcblx0Ly9cdGxldCBjdXJyZW50X2ZyYW1lID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignY2FudmFzJykudG9EYXRhVVJMKCk7XG5cblx0XHR0aGlzLmNhcHR1cmVyLmNhcHR1cmUoIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2NhbnZhcycpICk7XG5cblx0XHR0aGlzLmZyYW1lQ291bnRlci5pbm5lckhUTUwgPSB0aGlzLmZyYW1lc19yZW5kZXJlZCArIFwiIC8gXCIgKyB0aGlzLmZyYW1lQ291bnQ7IC8vdXBkYXRlIHRpbWVyXG5cblx0XHR0aGlzLmZyYW1lc19yZW5kZXJlZCsrO1xuXG5cblx0XHRpZih0aGlzLmZyYW1lc19yZW5kZXJlZD50aGlzLmZyYW1lQ291bnQpe1xuXHRcdFx0dGhpcy5yZW5kZXIgPSBudWxsOyAvL2hhY2t5IHdheSBvZiBzdG9wcGluZyB0aGUgcmVuZGVyaW5nXG5cdFx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblx0XHRcdC8vdGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXG5cdFx0XHR0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5jYXB0dXJlci5zdG9wKCk7XG5cdFx0XHQvLyBkZWZhdWx0IHNhdmUsIHdpbGwgZG93bmxvYWQgYXV0b21hdGljYWxseSBhIGZpbGUgY2FsbGVkIHtuYW1lfS5leHRlbnNpb24gKHdlYm0vZ2lmL3Rhcilcblx0XHRcdHRoaXMuY2FwdHVyZXIuc2F2ZSgpO1xuXHRcdH1cblx0fVxuXHRyZXNpemVDYW52YXNJZk5lY2Vzc2FyeSgpIHtcblx0XHQvL3N0b3AgcmVjb3JkaW5nIGlmIHdpbmRvdyBzaXplIGNoYW5nZXNcblx0XHRpZih0aGlzLnJlbmRlcmluZyAmJiB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCAhPSB0aGlzLmFzcGVjdCl7XG5cdFx0XHR0aGlzLmNhcHR1cmVyLnN0b3AoKTtcblx0XHRcdHRoaXMucmVuZGVyID0gbnVsbDsgLy9oYWNreSB3YXkgb2Ygc3RvcHBpbmcgdGhlIHJlbmRlcmluZ1xuXHRcdFx0YWxlcnQoXCJBYm9ydGluZyByZWNvcmQ6IFdpbmRvdy1zaXplIGNoYW5nZSBkZXRlY3RlZCFcIik7XG5cdFx0XHR0aGlzLnJlbmRlcmluZyA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzdXBlci5yZXNpemVDYW52YXNJZk5lY2Vzc2FyeSgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHNldHVwVGhyZWUoZnBzPTMwLCBsZW5ndGggPSA1LCBjYW52YXNFbGVtID0gbnVsbCl7XG5cdC8qIFNldCB1cCB0aGUgdGhyZWUuanMgZW52aXJvbm1lbnQuIFN3aXRjaCBiZXR3ZWVuIGNsYXNzZXMgZHluYW1pY2FsbHkgc28gdGhhdCB5b3UgY2FuIHJlY29yZCBieSBhcHBlbmRpbmcgXCI/cmVjb3JkPXRydWVcIiB0byBhbiB1cmwuIFRoZW4gRVhQLnRocmVlRW52aXJvbm1lbnQuY2FtZXJhIGFuZCBFWFAudGhyZWVFbnZpcm9ubWVudC5zY2VuZSB3b3JrLCBhcyB3ZWxsIGFzIEVYUC50aHJlZUVudmlyb25tZW50Lm9uKCdldmVudCBuYW1lJywgY2FsbGJhY2spLiBPbmx5IG9uZSBlbnZpcm9ubWVudCBleGlzdHMgYXQgYSB0aW1lLlxuXG4gICAgVGhlIHJldHVybmVkIG9iamVjdCBpcyBhIHNpbmdsZXRvbjogbXVsdGlwbGUgY2FsbHMgd2lsbCByZXR1cm4gdGhlIHNhbWUgb2JqZWN0OiBFWFAudGhyZWVFbnZpcm9ubWVudC4qL1xuXHR2YXIgcmVjb3JkZXIgPSBudWxsO1xuXHR2YXIgaXNfcmVjb3JkaW5nID0gZmFsc2U7XG5cblx0Ly9leHRyYWN0IHJlY29yZCBwYXJhbWV0ZXIgZnJvbSB1cmxcblx0dmFyIHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoZG9jdW1lbnQubG9jYXRpb24uc2VhcmNoKTtcblx0bGV0IHJlY29yZFN0cmluZyA9IHBhcmFtcy5nZXQoXCJyZWNvcmRcIik7XG5cblx0aWYocmVjb3JkU3RyaW5nKXsgLy9kZXRlY3QgaWYgVVJMIHBhcmFtcyBpbmNsdWRlID9yZWNvcmQ9MSBvciA/cmVjb3JkPXRydWVcbiAgICAgICAgcmVjb3JkU3RyaW5nID0gcmVjb3JkU3RyaW5nLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlzX3JlY29yZGluZyA9IChyZWNvcmRTdHJpbmcgPT0gXCJ0cnVlXCIgfHwgcmVjb3JkU3RyaW5nID09IFwiMVwiKTtcbiAgICB9XG5cbiAgICBsZXQgdGhyZWVFbnZpcm9ubWVudCA9IGdldFRocmVlRW52aXJvbm1lbnQoKTtcbiAgICBpZih0aHJlZUVudmlyb25tZW50ICE9PSBudWxsKXsvL3NpbmdsZXRvbiBoYXMgYWxyZWFkeSBiZWVuIGNyZWF0ZWRcbiAgICAgICAgcmV0dXJuIHRocmVlRW52aXJvbm1lbnQ7XG4gICAgfVxuXG5cdGlmKGlzX3JlY29yZGluZyl7XG5cdFx0dGhyZWVFbnZpcm9ubWVudCA9IG5ldyBUaHJlZWFzeVJlY29yZGVyKGZwcywgbGVuZ3RoLCBjYW52YXNFbGVtKTtcblx0fWVsc2V7XG5cdFx0dGhyZWVFbnZpcm9ubWVudCA9IG5ldyBUaHJlZWFzeUVudmlyb25tZW50KGNhbnZhc0VsZW0pO1xuXHR9XG4gICAgc2V0VGhyZWVFbnZpcm9ubWVudCh0aHJlZUVudmlyb25tZW50KTtcbiAgICByZXR1cm4gdGhyZWVFbnZpcm9ubWVudDtcbn1cblxuZXhwb3J0IHtzZXR1cFRocmVlLCBUaHJlZWFzeUVudmlyb25tZW50LCBUaHJlZWFzeVJlY29yZGVyfVxuIiwiYXN5bmMgZnVuY3Rpb24gZGVsYXkod2FpdFRpbWUpe1xuXHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHR3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCB3YWl0VGltZSk7XG5cdH0pO1xuXG59XG5cbmV4cG9ydCB7ZGVsYXl9O1xuIiwiLy9MaW5lT3V0cHV0U2hhZGVycy5qc1xuXG4vL2Jhc2VkIG9uIGh0dHBzOi8vbWF0dGRlc2wuc3ZidGxlLmNvbS9kcmF3aW5nLWxpbmVzLWlzLWhhcmQgYnV0IHdpdGggc2V2ZXJhbCBlcnJvcnMgY29ycmVjdGVkLCBiZXZlbCBzaGFkaW5nIGFkZGVkLCBhbmQgbW9yZVxuXG5jb25zdCBMSU5FX0pPSU5fVFlQRVMgPSB7XCJNSVRFUlwiOiAwLjIsIFwiQkVWRUxcIjoxLjIsXCJST1VORFwiOjIuMn07IC8vSSdkIHVzZSAwLDEsMiBidXQgSlMgZG9lc24ndCBhZGQgYSBkZWNpbWFsIHBsYWNlIGF0IHRoZSBlbmQgd2hlbiBpbnNlcnRpbmcgdGhlbSBpbiBhIHN0cmluZy4gY3Vyc2VkIGp1c3RpZmljYXRpb25cblxudmFyIHZTaGFkZXIgPSBbXG5cInVuaWZvcm0gZmxvYXQgYXNwZWN0O1wiLCAvL3VzZWQgdG8gY2FsaWJyYXRlIHNjcmVlbiBzcGFjZVxuXCJ1bmlmb3JtIGZsb2F0IGxpbmVXaWR0aDtcIiwgLy93aWR0aCBvZiBsaW5lXG5cInVuaWZvcm0gZmxvYXQgbGluZUpvaW5UeXBlO1wiLFxuLy9cImF0dHJpYnV0ZSB2ZWMzIHBvc2l0aW9uO1wiLCAvL2FkZGVkIGF1dG9tYXRpY2FsbHkgYnkgdGhyZWUuanNcblwiYXR0cmlidXRlIHZlYzMgbmV4dFBvaW50UG9zaXRpb247XCIsXG5cImF0dHJpYnV0ZSB2ZWMzIHByZXZpb3VzUG9pbnRQb3NpdGlvbjtcIixcblwiYXR0cmlidXRlIGZsb2F0IGRpcmVjdGlvbjtcIixcblwiYXR0cmlidXRlIGZsb2F0IGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleDtcIixcblxuXCJ2YXJ5aW5nIGZsb2F0IGNyb3NzTGluZVBvc2l0aW9uO1wiLFxuXCJhdHRyaWJ1dGUgdmVjMyBjb2xvcjtcIixcblwidmFyeWluZyB2ZWMzIHZDb2xvcjtcIixcblwidmFyeWluZyB2ZWMyIGxpbmVTZWdtZW50QUNsaXBTcGFjZTtcIixcblwidmFyeWluZyB2ZWMyIGxpbmVTZWdtZW50QkNsaXBTcGFjZTtcIixcblwidmFyeWluZyBmbG9hdCB0aGlja25lc3M7XCIsXG5cblxuXCJ2YXJ5aW5nIHZlYzMgZGVidWdJbmZvO1wiLFxuXG5cInZlYzMgYW5nbGVfdG9faHVlKGZsb2F0IGFuZ2xlKSB7XCIsIC8vZm9yIGRlYnVnZ2luZ1xuXCIgIGFuZ2xlIC89IDMuMTQxNTkyKjIuO1wiLFxuXCIgIHJldHVybiBjbGFtcCgoYWJzKGZyYWN0KGFuZ2xlK3ZlYzMoMy4wLCAyLjAsIDEuMCkvMy4wKSo2LjAtMy4wKS0xLjApLCAwLjAsIDEuMCk7XCIsXG5cIn1cIixcblxuLy9naXZlbiBhbiB1bml0IHZlY3RvciwgbW92ZSBkaXN0IHVuaXRzIHBlcnBlbmRpY3VsYXIgdG8gaXQuXG5cInZlYzIgb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UodmVjMiBkaXIsIGZsb2F0IHR3aWNlRGlzdCkge1wiLFxuICBcInZlYzIgbm9ybWFsID0gdmVjMigtZGlyLnksIGRpci54KSA7XCIsXG4gIFwibm9ybWFsICo9IHR3aWNlRGlzdC8yLjA7XCIsXG4gIFwibm9ybWFsLnggLz0gYXNwZWN0O1wiLFxuICBcInJldHVybiBub3JtYWw7XCIsXG5cIn1cIixcblxuXCJ2b2lkIG1haW4oKSB7XCIsXG5cbiAgXCJ2ZWMyIGFzcGVjdFZlYyA9IHZlYzIoYXNwZWN0LCAxLjApO1wiLFxuICBcIm1hdDQgcHJvalZpZXdNb2RlbCA9IHByb2plY3Rpb25NYXRyaXggKlwiLFxuICAgICAgICAgICAgXCJ2aWV3TWF0cml4ICogbW9kZWxNYXRyaXg7XCIsXG4gIFwidmVjNCBwcmV2aW91c1Byb2plY3RlZCA9IHByb2pWaWV3TW9kZWwgKiB2ZWM0KHByZXZpb3VzUG9pbnRQb3NpdGlvbiwgMS4wKTtcIixcbiAgXCJ2ZWM0IGN1cnJlbnRQcm9qZWN0ZWQgPSBwcm9qVmlld01vZGVsICogdmVjNChwb3NpdGlvbiwgMS4wKTtcIixcbiAgXCJ2ZWM0IG5leHRQcm9qZWN0ZWQgPSBwcm9qVmlld01vZGVsICogdmVjNChuZXh0UG9pbnRQb3NpdGlvbiwgMS4wKTtcIixcblxuXG4gIC8vZ2V0IDJEIHNjcmVlbiBzcGFjZSB3aXRoIFcgZGl2aWRlIGFuZCBhc3BlY3QgY29ycmVjdGlvblxuICBcInZlYzIgY3VycmVudFNjcmVlbiA9IGN1cnJlbnRQcm9qZWN0ZWQueHkgLyBjdXJyZW50UHJvamVjdGVkLncgKiBhc3BlY3RWZWM7XCIsXG4gIFwidmVjMiBwcmV2aW91c1NjcmVlbiA9IHByZXZpb3VzUHJvamVjdGVkLnh5IC8gcHJldmlvdXNQcm9qZWN0ZWQudyAqIGFzcGVjdFZlYztcIixcbiAgXCJ2ZWMyIG5leHRTY3JlZW4gPSBuZXh0UHJvamVjdGVkLnh5IC8gbmV4dFByb2plY3RlZC53ICogYXNwZWN0VmVjO1wiLFxuXG4gIC8vXCJjZW50ZXJQb2ludENsaXBTcGFjZVBvc2l0aW9uID0gY3VycmVudFByb2plY3RlZC54eSAvIGN1cnJlbnRQcm9qZWN0ZWQudztcIiwvL3NlbmQgdG8gZnJhZ21lbnQgc2hhZGVyXG4gIFwiY3Jvc3NMaW5lUG9zaXRpb24gPSBkaXJlY3Rpb247XCIsIC8vc2VuZCBkaXJlY3Rpb24gdG8gdGhlIGZyYWdtZW50IHNoYWRlclxuICBcInZDb2xvciA9IGNvbG9yO1wiLCAvL3NlbmQgZGlyZWN0aW9uIHRvIHRoZSBmcmFnbWVudCBzaGFkZXJcblxuICBcInRoaWNrbmVzcyA9IGxpbmVXaWR0aCAvIDQwMC47XCIsIC8vVE9ETzogY29udmVydCBsaW5lV2lkdGggdG8gcGl4ZWxzXG4gIFwiZmxvYXQgb3JpZW50YXRpb24gPSAoZGlyZWN0aW9uLTAuNSkqMi47XCIsXG5cbiAgLy9nZXQgZGlyZWN0aW9ucyBmcm9tIChDIC0gQikgYW5kIChCIC0gQSlcbiAgXCJ2ZWMyIHZlY0EgPSAoY3VycmVudFNjcmVlbiAtIHByZXZpb3VzU2NyZWVuKTtcIixcbiAgXCJ2ZWMyIHZlY0IgPSAobmV4dFNjcmVlbiAtIGN1cnJlbnRTY3JlZW4pO1wiLFxuICBcInZlYzIgZGlyQSA9IG5vcm1hbGl6ZSh2ZWNBKTtcIixcbiAgXCJ2ZWMyIGRpckIgPSBub3JtYWxpemUodmVjQik7XCIsXG5cbiAgLy9ERUJVR1xuICBcImxpbmVTZWdtZW50QUNsaXBTcGFjZSA9IG1peChwcmV2aW91c1NjcmVlbixjdXJyZW50U2NyZWVuLGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleCkgLyBhc3BlY3RWZWM7XCIsLy9zZW5kIHRvIGZyYWdtZW50IHNoYWRlclxuICBcImxpbmVTZWdtZW50QkNsaXBTcGFjZSA9IG1peChjdXJyZW50U2NyZWVuLG5leHRTY3JlZW4sYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4KSAvIGFzcGVjdFZlYztcIiwvL3NlbmQgdG8gZnJhZ21lbnQgc2hhZGVyXG5cbiAgLy9zdGFydGluZyBwb2ludCB1c2VzIChuZXh0IC0gY3VycmVudClcbiAgXCJ2ZWMyIG9mZnNldCA9IHZlYzIoMC4wKTtcIixcbiAgXCJpZiAoY3VycmVudFNjcmVlbiA9PSBwcmV2aW91c1NjcmVlbikge1wiLFxuICBcIiAgb2Zmc2V0ID0gb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UoZGlyQiAqIG9yaWVudGF0aW9uLCB0aGlja25lc3MpO1wiLFxuICAvL29mZnNldCArPSBkaXJCICogdGhpY2tuZXNzOyAvL2VuZCBjYXBcbiAgXCJ9IFwiLFxuICAvL2VuZGluZyBwb2ludCB1c2VzIChjdXJyZW50IC0gcHJldmlvdXMpXG4gIFwiZWxzZSBpZiAoY3VycmVudFNjcmVlbiA9PSBuZXh0U2NyZWVuKSB7XCIsXG4gIFwiICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXJBICogb3JpZW50YXRpb24sIHRoaWNrbmVzcyk7XCIsXG4gIC8vb2Zmc2V0ICs9IGRpckEgKiB0aGlja25lc3M7IC8vZW5kIGNhcFxuICBcIn1cIixcbiAgXCIvL3NvbWV3aGVyZSBpbiBtaWRkbGUsIG5lZWRzIGEgam9pblwiLFxuICBcImVsc2Uge1wiLFxuICBcIiAgaWYgKGxpbmVKb2luVHlwZSA9PSBcIitMSU5FX0pPSU5fVFlQRVMuTUlURVIrXCIpIHtcIixcbiAgICAgICAgLy9jb3JuZXIgdHlwZTogbWl0ZXIuIFRoaXMgaXMgYnVnZ3kgKHRoZXJlJ3Mgbm8gbWl0ZXIgbGltaXQgeWV0KSBzbyBkb24ndCB1c2VcbiAgXCIgICAgLy9ub3cgY29tcHV0ZSB0aGUgbWl0ZXIgam9pbiBub3JtYWwgYW5kIGxlbmd0aFwiLFxuICBcIiAgICB2ZWMyIG1pdGVyRGlyZWN0aW9uID0gbm9ybWFsaXplKGRpckEgKyBkaXJCKTtcIixcbiAgXCIgICAgdmVjMiBwcmV2TGluZUV4dHJ1ZGVEaXJlY3Rpb24gPSB2ZWMyKC1kaXJBLnksIGRpckEueCk7XCIsXG4gIFwiICAgIHZlYzIgbWl0ZXIgPSB2ZWMyKC1taXRlckRpcmVjdGlvbi55LCBtaXRlckRpcmVjdGlvbi54KTtcIixcbiAgXCIgICAgZmxvYXQgbGVuID0gdGhpY2tuZXNzIC8gKGRvdChtaXRlciwgcHJldkxpbmVFeHRydWRlRGlyZWN0aW9uKSswLjAwMDEpO1wiLCAvL2NhbGN1bGF0ZS4gZG90IHByb2R1Y3QgaXMgYWx3YXlzID4gMFxuICBcIiAgICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShtaXRlckRpcmVjdGlvbiAqIG9yaWVudGF0aW9uLCBsZW4pO1wiLFxuICBcIiAgfSBlbHNlIGlmIChsaW5lSm9pblR5cGUgPT0gXCIrTElORV9KT0lOX1RZUEVTLkJFVkVMK1wiKXtcIixcbiAgICAvL2Nvcm5lciB0eXBlOiBiZXZlbFxuICBcIiAgICB2ZWMyIGRpciA9IG1peChkaXJBLCBkaXJCLCBhcHByb2FjaE5leHRPclByZXZWZXJ0ZXgpO1wiLFxuICBcIiAgICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXIgKiBvcmllbnRhdGlvbiwgdGhpY2tuZXNzKTtcIixcbiAgXCIgIH0gZWxzZSBpZiAobGluZUpvaW5UeXBlID09IFwiK0xJTkVfSk9JTl9UWVBFUy5ST1VORCtcIil7XCIsXG4gICAgLy9jb3JuZXIgdHlwZTogcm91bmRcbiAgXCIgICAgdmVjMiBkaXIgPSBtaXgoZGlyQSwgZGlyQiwgYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4KTtcIixcbiAgXCIgICAgdmVjMiBoYWxmVGhpY2tuZXNzUGFzdFRoZVZlcnRleCA9IGRpcip0aGlja25lc3MvMi4gKiBhcHByb2FjaE5leHRPclByZXZWZXJ0ZXggLyBhc3BlY3RWZWM7XCIsXG4gIFwiICAgIG9mZnNldCA9IG9mZnNldFBlcnBlbmRpY3VsYXJBbG9uZ1NjcmVlblNwYWNlKGRpciAqIG9yaWVudGF0aW9uLCB0aGlja25lc3MpIC0gaGFsZlRoaWNrbmVzc1Bhc3RUaGVWZXJ0ZXg7XCIsIC8vZXh0ZW5kIHJlY3RzIHBhc3QgdGhlIHZlcnRleFxuICBcIiAgfSBlbHNlIHtcIiwgLy9ubyBsaW5lIGpvaW4gdHlwZSBzcGVjaWZpZWQsIGp1c3QgZ28gZm9yIHRoZSBwcmV2aW91cyBwb2ludFxuICBcIiAgICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXJBLCB0aGlja25lc3MpO1wiLFxuICBcIiAgfVwiLFxuICBcIn1cIixcblxuICBcImRlYnVnSW5mbyA9IHZlYzMoYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4LCBvcmllbnRhdGlvbiwgMC4wKTtcIiwgLy9UT0RPOiByZW1vdmUuIGl0J3MgZm9yIGRlYnVnZ2luZyBjb2xvcnNcbiAgXCJnbF9Qb3NpdGlvbiA9IGN1cnJlbnRQcm9qZWN0ZWQgKyB2ZWM0KG9mZnNldCwgMC4wLDAuMCkgKmN1cnJlbnRQcm9qZWN0ZWQudztcIixcblwifVwiXS5qb2luKFwiXFxuXCIpO1xuXG52YXIgZlNoYWRlciA9IFtcblwidW5pZm9ybSBmbG9hdCBvcGFjaXR5O1wiLFxuXCJ1bmlmb3JtIHZlYzIgc2NyZWVuU2l6ZTtcIixcblwidW5pZm9ybSBmbG9hdCBhc3BlY3Q7XCIsXG5cInVuaWZvcm0gZmxvYXQgbGluZUpvaW5UeXBlO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgdkNvbG9yO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgZGVidWdJbmZvO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgbGluZVNlZ21lbnRBQ2xpcFNwYWNlO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgbGluZVNlZ21lbnRCQ2xpcFNwYWNlO1wiLFxuXCJ2YXJ5aW5nIGZsb2F0IGNyb3NzTGluZVBvc2l0aW9uO1wiLFxuXCJ2YXJ5aW5nIGZsb2F0IHRoaWNrbmVzcztcIixcblxuLyogdXNlZnVsIGZvciBkZWJ1Z2dpbmchIGZyb20gaHR0cHM6Ly93d3cucm9uamEtdHV0b3JpYWxzLmNvbS8yMDE4LzExLzI0L3NkZi1zcGFjZS1tYW5pcHVsYXRpb24uaHRtbFxuXCJ2ZWMzIHJlbmRlckxpbmVzT3V0c2lkZShmbG9hdCBkaXN0KXtcIixcblwiICAgIGZsb2F0IF9MaW5lRGlzdGFuY2UgPSAwLjM7XCIsXG5cIiAgICBmbG9hdCBfTGluZVRoaWNrbmVzcyA9IDAuMDU7XCIsXG5cIiAgICBmbG9hdCBfU3ViTGluZVRoaWNrbmVzcyA9IDAuMDU7XCIsXG5cIiAgICBmbG9hdCBfU3ViTGluZXMgPSAxLjA7XCIsXG5cIiAgICB2ZWMzIGNvbCA9IG1peCh2ZWMzKDEuMCwwLjIsMC4yKSwgdmVjMygwLjAsMC4yLDEuMiksIHN0ZXAoMC4wLCBkaXN0KSk7XCIsXG5cblwiICAgIGZsb2F0IGRpc3RhbmNlQ2hhbmdlID0gZndpZHRoKGRpc3QpICogMC41O1wiLFxuXCIgICAgZmxvYXQgbWFqb3JMaW5lRGlzdGFuY2UgPSBhYnMoZnJhY3QoZGlzdCAvIF9MaW5lRGlzdGFuY2UgKyAwLjUpIC0gMC41KSAqIF9MaW5lRGlzdGFuY2U7XCIsXG5cIiAgICBmbG9hdCBtYWpvckxpbmVzID0gc21vb3Roc3RlcChfTGluZVRoaWNrbmVzcyAtIGRpc3RhbmNlQ2hhbmdlLCBfTGluZVRoaWNrbmVzcyArIGRpc3RhbmNlQ2hhbmdlLCBtYWpvckxpbmVEaXN0YW5jZSk7XCIsXG5cblwiICAgIGZsb2F0IGRpc3RhbmNlQmV0d2VlblN1YkxpbmVzID0gX0xpbmVEaXN0YW5jZSAvIF9TdWJMaW5lcztcIixcblwiICAgIGZsb2F0IHN1YkxpbmVEaXN0YW5jZSA9IGFicyhmcmFjdChkaXN0IC8gZGlzdGFuY2VCZXR3ZWVuU3ViTGluZXMgKyAwLjUpIC0gMC41KSAqIGRpc3RhbmNlQmV0d2VlblN1YkxpbmVzO1wiLFxuXCIgICAgZmxvYXQgc3ViTGluZXMgPSBzbW9vdGhzdGVwKF9TdWJMaW5lVGhpY2tuZXNzIC0gZGlzdGFuY2VDaGFuZ2UsIF9TdWJMaW5lVGhpY2tuZXNzICsgZGlzdGFuY2VDaGFuZ2UsIHN1YkxpbmVEaXN0YW5jZSk7XCIsXG5cblwiICAgIHJldHVybiBjb2wgKiBtYWpvckxpbmVzICogc3ViTGluZXM7XCIsXG5cIn1cIiwgKi9cblxuXG5cImZsb2F0IGxpbmVTREYodmVjMiBwb2ludCwgdmVjMiBsaW5lU3RhcnRQdCx2ZWMyIGxpbmVFbmRQdCkge1wiLFxuICBcImZsb2F0IGggPSBjbGFtcChkb3QocG9pbnQtbGluZVN0YXJ0UHQsbGluZUVuZFB0LWxpbmVTdGFydFB0KS9kb3QobGluZUVuZFB0LWxpbmVTdGFydFB0LGxpbmVFbmRQdC1saW5lU3RhcnRQdCksMC4wLDEuMCk7XCIsXG4gIFwidmVjMiBwcm9qZWN0ZWRWZWMgPSAocG9pbnQtbGluZVN0YXJ0UHQtKGxpbmVFbmRQdC1saW5lU3RhcnRQdCkqaCk7XCIsXG4gIFwicmV0dXJuIGxlbmd0aChwcm9qZWN0ZWRWZWMpO1wiLFxuXCJ9XCIsXG5cblxuXCJ2b2lkIG1haW4oKXtcIixcblwiICB2ZWMzIGNvbCA9IHZDb2xvci5yZ2I7XCIsXG4vL1wiICBjb2wgPSBkZWJ1Z0luZm8ucmdiO1wiLFxuXCIgIGdsX0ZyYWdDb2xvciA9IHZlYzQoY29sLCBvcGFjaXR5KTtcIixcblxuXCIgIGlmIChsaW5lSm9pblR5cGUgPT0gXCIrTElORV9KT0lOX1RZUEVTLlJPVU5EK1wiKXtcIixcblwiICAgICAgdmVjMiB2ZXJ0U2NyZWVuU3BhY2VQb3NpdGlvbiA9IGdsX0ZyYWdDb29yZC54eTtcIiwgLy9nb2VzIGZyb20gMCB0byBzY3JlZW5TaXplLnh5XG5cIiAgICAgIHZlYzIgbGluZVB0QVNjcmVlblNwYWNlID0gKGxpbmVTZWdtZW50QUNsaXBTcGFjZSsxLikvMi4gKiBzY3JlZW5TaXplO1wiLCAvL2NvbnZlcnQgWy0xLDFdIHRvIFswLDFdLCB0aGVuICpzY3JlZW5TaXplXG5cIiAgICAgIHZlYzIgbGluZVB0QlNjcmVlblNwYWNlID0gKGxpbmVTZWdtZW50QkNsaXBTcGFjZSsxLikvMi4gKiBzY3JlZW5TaXplO1wiLFxuXCIgICAgICBmbG9hdCBkaXN0RnJvbUxpbmUgPSBsaW5lU0RGKHZlcnRTY3JlZW5TcGFjZVBvc2l0aW9uLCBsaW5lUHRBU2NyZWVuU3BhY2UsbGluZVB0QlNjcmVlblNwYWNlKTtcIixcblwiICAgICAgZmxvYXQgc2RmID0gMS4tKDEuL3RoaWNrbmVzcyAvc2NyZWVuU2l6ZS55ICogNC4wICpkaXN0RnJvbUxpbmUpO1wiLFxuXCIgICAgICBmbG9hdCBzZGZPcGFjaXR5ID0gY2xhbXAoc2RmIC8gKGFicyhkRmR4KHNkZikpICsgYWJzKGRGZHkoc2RmKSkpLDAuMCwxLjApO1wiLFxuLy9cIiAgICAgIGlmKG9wYWNpdHkgKiBzZGZPcGFjaXR5IDwgMC4xKWRpc2NhcmQ7XCIsXG5cIiAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoY29sLCBvcGFjaXR5ICogc2RmT3BhY2l0eSApO1wiLFxuXCIgIH1cIixcblwifVwiXS5qb2luKFwiXFxuXCIpXG5cbnZhciB1bmlmb3JtcyA9IHtcblx0bGluZVdpZHRoOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAxLjAsIC8vY3VycmVudGx5IGluIHVuaXRzIG9mIHlIZWlnaHQqNDAwXG5cdH0sXG5cdHNjcmVlblNpemU6IHtcblx0XHR2YWx1ZTogbmV3IFRIUkVFLlZlY3RvcjIoIDEsIDEgKSxcblx0fSxcblx0bGluZUpvaW5UeXBlOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiBMSU5FX0pPSU5fVFlQRVMuUk9VTkQsXG5cdH0sXG5cdG9wYWNpdHk6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCxcblx0fSxcblx0YXNwZWN0OiB7IC8vYXNwZWN0IHJhdGlvLiBuZWVkIHRvIGxvYWQgZnJvbSByZW5kZXJlclxuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMS4wLFxuXHR9XG59O1xuXG5leHBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcywgTElORV9KT0lOX1RZUEVTIH07XG4iLCJpbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuLi91dGlscy5qcyc7XG5pbXBvcnQgeyBnZXRUaHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcywgTElORV9KT0lOX1RZUEVTIH0gZnJvbSAnLi9MaW5lT3V0cHV0U2hhZGVycy5qcyc7XG5cbmNvbnN0IHRtcENvbG9yID0gbmV3IFRIUkVFLkNvbG9yKDB4MDAwMDAwKTtcblxuY2xhc3MgTGluZU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29yay5cbiAgICAgICAgQ3Jpc3AgbGluZXMgdXNpbmcgdGhlIHRlY2huaXF1ZSBpbiBodHRwczovL21hdHRkZXNsLnN2YnRsZS5jb20vZHJhd2luZy1saW5lcy1pcy1oYXJkLCBidXQgYWxzbyBzdXBwb3J0aW5nIG1pdGVyZWQgbGluZXMgYW5kIGJldmVsZWQgbGluZXMgdG9vIVxuICAgICAgICAgICAgb3B0aW9uczpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB3aWR0aDogbnVtYmVyLiB1bml0cyBhcmUgaW4gc2NyZWVuWS80MDAuXG4gICAgICAgICAgICAgICAgb3BhY2l0eTogbnVtYmVyXG4gICAgICAgICAgICAgICAgY29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcbiAgICAgICAgICAgICAgICBsaW5lSm9pbjogXCJiZXZlbFwiIG9yIFwicm91bmRcIi4gZGVmYXVsdDogcm91bmQuIERvbid0IGNoYW5nZSB0aGlzIGFmdGVyIGluaXRpYWxpemF0aW9uLlxuICAgICAgICAgICAgfVxuICAgICAgICAqL1xuXG4gICAgICAgIHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDU7XG4gICAgICAgIHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cbiAgICAgICAgdGhpcy5faGFzQ3VzdG9tQ29sb3JGdW5jdGlvbiA9IGZhbHNlO1xuICAgICAgICBpZihVdGlscy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29sb3IpKXtcbiAgICAgICAgICAgIHRoaXMuX2hhc0N1c3RvbUNvbG9yRnVuY3Rpb24gPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuY29sb3IpIDogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGluZUpvaW5UeXBlID0gb3B0aW9ucy5saW5lSm9pblR5cGUgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubGluZUpvaW5UeXBlLnRvVXBwZXJDYXNlKCkgOiBcIkJFVkVMXCI7XG4gICAgICAgIGlmKExJTkVfSk9JTl9UWVBFU1t0aGlzLmxpbmVKb2luVHlwZV0gPT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICB0aGlzLmxpbmVKb2luVHlwZSA9IFwiQkVWRUxcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuICAgICAgICB0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGhvdyBtYW55IHRpbWVzIHRvIGJlIGNhbGxlZCBpbiBlYWNoIGRpcmVjdGlvblxuICAgICAgICB0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gMzsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT9cblxuICAgICAgICB0aGlzLmluaXQoKTtcbiAgICB9XG4gICAgaW5pdCgpe1xuICAgICAgICB0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuICAgICAgICB0aGlzLl92ZXJ0aWNlcztcbiAgICAgICAgdGhpcy5tYWtlR2VvbWV0cnkoKTtcblxuXG4gICAgICAgIC8vbWFrZSBhIGRlZXAgY29weSBvZiB0aGUgdW5pZm9ybXMgdGVtcGxhdGVcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMgPSB7fTtcbiAgICAgICAgZm9yKHZhciB1bmlmb3JtTmFtZSBpbiB1bmlmb3Jtcyl7XG4gICAgICAgICAgICB0aGlzLl91bmlmb3Jtc1t1bmlmb3JtTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogdW5pZm9ybXNbdW5pZm9ybU5hbWVdLnR5cGUsXG4gICAgICAgICAgICAgICAgdmFsdWU6IHVuaWZvcm1zW3VuaWZvcm1OYW1lXS52YWx1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCh7XG4gICAgICAgICAgICBzaWRlOiBUSFJFRS5CYWNrU2lkZSxcbiAgICAgICAgICAgIHZlcnRleFNoYWRlcjogdlNoYWRlciwgXG4gICAgICAgICAgICBmcmFnbWVudFNoYWRlcjogZlNoYWRlcixcbiAgICAgICAgICAgIHVuaWZvcm1zOiB0aGlzLl91bmlmb3JtcyxcbiAgICAgICAgICAgIGV4dGVuc2lvbnM6e2Rlcml2YXRpdmVzOiB0cnVlLH0sXG4gICAgICAgICAgICBhbHBoYVRlc3Q6IDAuNSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cbiAgICAgICAgdGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy8gc2V0dGVyIHNldHMgdHJhbnNwYXJlbnQgZmxhZyBpZiBuZWNlc3NhcnlcbiAgICAgICAgdGhpcy5jb2xvciA9IHRoaXMuX2NvbG9yOyAvL3NldHRlciBzZXRzIGNvbG9yIGF0dHJpYnV0ZVxuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gdGhpcy5fb3BhY2l0eTtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMubGluZVdpZHRoLnZhbHVlID0gdGhpcy5fd2lkdGg7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLmxpbmVKb2luVHlwZS52YWx1ZSA9IExJTkVfSk9JTl9UWVBFU1t0aGlzLmxpbmVKb2luVHlwZV07XG5cbiAgICAgICAgZ2V0VGhyZWVFbnZpcm9ubWVudCgpLnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuICAgIH1cblxuICAgIG1ha2VHZW9tZXRyeSgpe1xuICAgICAgICBjb25zdCBNQVhfUE9JTlRTID0gMTAwMDsgLy90aGVzZSBhcnJheXMgZ2V0IGRpc2NhcmRlZCBvbiBmaXJzdCBhY3RpdmF0aW9uIGFueXdheXNcbiAgICAgICAgY29uc3QgTlVNX1BPSU5UU19QRVJfVkVSVEVYID0gNDtcblxuICAgICAgICBsZXQgbnVtVmVydHMgPSAoTUFYX1BPSU5UUy0xKSpOVU1fUE9JTlRTX1BFUl9WRVJURVg7XG5cbiAgICAgICAgdGhpcy5fdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIHRoaXMuX25leHRQb2ludFZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl9vdXRwdXREaW1lbnNpb25zICogbnVtVmVydHMpO1xuICAgICAgICB0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIG51bVZlcnRzKTtcbiAgICAgICAgdGhpcy5fY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheShudW1WZXJ0cyAqIDMpO1xuXG4gICAgICAgIC8vIGJ1aWxkIGdlb21ldHJ5XG5cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAncG9zaXRpb24nLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fdmVydGljZXMsIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKSApO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICduZXh0UG9pbnRQb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl9uZXh0UG9pbnRWZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3ByZXZpb3VzUG9pbnRQb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ2NvbG9yJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX2NvbG9ycywgMyApICk7XG5cbiAgICAgICAgdGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3VzZWQgZHVyaW5nIHVwZGF0ZXMgYXMgYSBwb2ludGVyIHRvIHRoZSBidWZmZXJcbiAgICAgICAgdGhpcy5fYWN0aXZhdGVkT25jZSA9IGZhbHNlO1xuXG4gICAgfVxuICAgIF9vbkFkZCgpe1xuICAgICAgICAvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgRG9tYWluIG5vZGUgd2UncmUgcmVuZGVyaW5nIGZyb21cbiAgICAgICAgbGV0IHJvb3QgPSBudWxsO1xuICAgICAgICB0cnl7XG4gICAgICAgICAgIHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcbiAgICAgICAgfWNhdGNoKGVycm9yKXtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihlcnJvcik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgLy90b2RvOiBpbXBsZW1lbnQgc29tZXRoaW5nIGxpa2UgYXNzZXJ0IHJvb3QgdHlwZW9mIFJvb3ROb2RlXG5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcbiAgICAgICAgdGhpcy5pdGVtRGltZW5zaW9ucyA9IHJvb3QuaXRlbURpbWVuc2lvbnM7XG4gICAgfVxuICAgIF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuICAgICAgICB0aGlzLl9vbkFkZCgpOyAvL3NldHVwIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLml0ZW1EaW1lbnNpb25zLiB1c2VkIGhlcmUgYWdhaW4gYmVjYXVzZSBjbG9uaW5nIG1lYW5zIHRoZSBvbkFkZCgpIG1pZ2h0IGJlIGNhbGxlZCBiZWZvcmUgdGhpcyBpcyBjb25uZWN0ZWQgdG8gYSB0eXBlIG9mIGRvbWFpblxuXG4gICAgICAgIC8vIHBlcmhhcHMgaW5zdGVhZCBvZiBnZW5lcmF0aW5nIGEgd2hvbGUgbmV3IGFycmF5LCB0aGlzIGNhbiByZXVzZSB0aGUgb2xkIG9uZT9cblxuICAgICAgICBjb25zdCBOVU1fUE9JTlRTX1BFUl9MSU5FX1NFR01FTlQgPSA0OyAvLzQgdXNlZCBmb3IgYmV2ZWxpbmdcbiAgICAgICAgY29uc3QgbnVtVmVydHMgPSAodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pICogTlVNX1BPSU5UU19QRVJfTElORV9TRUdNRU5UO1xuXG4gICAgICAgIGxldCB2ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIGxldCBuZXh0VmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICogbnVtVmVydHMpO1xuICAgICAgICBsZXQgcHJldlZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSggdGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIG51bVZlcnRzKTtcbiAgICAgICAgbGV0IGNvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkoIDMgKiBudW1WZXJ0cyk7XG5cbiAgICAgICAgbGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcbiAgICAgICAgdGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcbiAgICAgICAgcG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdmVydGljZXMpO1xuXG4gICAgICAgIGxldCBwcmV2UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucHJldmlvdXNQb2ludFBvc2l0aW9uO1xuICAgICAgICB0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcyA9IHByZXZWZXJ0aWNlcztcbiAgICAgICAgcHJldlBvaW50UG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fcHJldlBvaW50VmVydGljZXMpO1xuXG4gICAgICAgIGxldCBuZXh0UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubmV4dFBvaW50UG9zaXRpb247XG4gICAgICAgIHRoaXMuX25leHRQb2ludFZlcnRpY2VzID0gbmV4dFZlcnRpY2VzO1xuICAgICAgICBuZXh0UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9uZXh0UG9pbnRWZXJ0aWNlcyk7XG5cbiAgICAgICAgbGV0IGNvbG9yQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvcjtcbiAgICAgICAgdGhpcy5fY29sb3JzID0gY29sb3JzO1xuICAgICAgICBjb2xvckF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9jb2xvcnMpO1xuXG4gICAgICAgIC8vdXNlZCB0byBkaWZmZXJlbnRpYXRlIHRoZSBsZWZ0IGJvcmRlciBvZiB0aGUgbGluZSBmcm9tIHRoZSByaWdodCBib3JkZXJcbiAgICAgICAgbGV0IGRpcmVjdGlvbiA9IG5ldyBGbG9hdDMyQXJyYXkobnVtVmVydHMpO1xuICAgICAgICBmb3IobGV0IGk9MDsgaTxudW1WZXJ0cztpKyspe1xuICAgICAgICAgICAgZGlyZWN0aW9uW2ldID0gaSUyPT0wID8gMSA6IDA7IC8vYWx0ZXJuYXRlIC0xIGFuZCAxXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnZGlyZWN0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIGRpcmVjdGlvbiwgMSkgKTtcblxuICAgICAgICAvL3VzZWQgdG8gZGlmZmVyZW50aWF0ZSB0aGUgcG9pbnRzIHdoaWNoIG1vdmUgdG93YXJkcyBwcmV2IHZlcnRleCBmcm9tIHBvaW50cyB3aGljaCBtb3ZlIHRvd2FyZHMgbmV4dCB2ZXJ0ZXhcbiAgICAgICAgbGV0IG5leHRPclByZXYgPSBuZXcgRmxvYXQzMkFycmF5KG51bVZlcnRzKTtcbiAgICAgICAgZm9yKGxldCBpPTA7IGk8bnVtVmVydHM7aSsrKXtcbiAgICAgICAgICAgIG5leHRPclByZXZbaV0gPSBpJTQ8MiA/IDAgOiAxOyAvL2FsdGVybmF0ZSAwLDAsIDEsMVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ2FwcHJvYWNoTmV4dE9yUHJldlZlcnRleCcsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCBuZXh0T3JQcmV2LCAxKSApO1xuXG4gICAgICAgIC8vaW5kaWNlc1xuICAgICAgICAvKlxuICAgICAgICBGb3IgZWFjaCB2ZXJ0ZXgsIHdlIGNvbm5lY3QgaXQgdG8gdGhlIG5leHQgdmVydGV4IGxpa2UgdGhpczpcbiAgICAgICAgbiAtLW4rMi0tbis0LS1uKzZcbiAgICAgICAgfCAgLyAgfCAvIHwgIC8gIHxcbiAgICAgICBuKzEgLS1uKzMtLW4rNS0tbis3XG5cbiAgICAgICBwdDEgICBwdDIgcHQyICAgcHQzXG5cbiAgICAgICB2ZXJ0aWNlcyBuLG4rMSBhcmUgYXJvdW5kIHBvaW50IDEsIG4rMixuKzMsbis0LG4rNSBhcmUgYXJvdW5kIHB0Miwgbis2LG4rNyBhcmUgZm9yIHBvaW50My4gdGhlIG1pZGRsZSBzZWdtZW50IChuKzItbis1KSBpcyB0aGUgcG9seWdvbiB1c2VkIGZvciBiZXZlbGluZyBhdCBwb2ludCAyLlxuXG4gICAgICAgIHRoZW4gd2UgYWR2YW5jZSBuIHR3byBhdCBhIHRpbWUgdG8gbW92ZSB0byB0aGUgbmV4dCB2ZXJ0ZXguIHZlcnRpY2VzIG4sIG4rMSByZXByZXNlbnQgdGhlIHNhbWUgcG9pbnQ7XG4gICAgICAgIHRoZXkncmUgc2VwYXJhdGVkIGluIHRoZSB2ZXJ0ZXggc2hhZGVyIHRvIGEgY29uc3RhbnQgc2NyZWVuc3BhY2Ugd2lkdGggKi9cbiAgICAgICAgbGV0IGluZGljZXMgPSBbXTtcbiAgICAgICAgZm9yKGxldCB2ZXJ0TnVtPTA7dmVydE51bTwodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24tMSk7dmVydE51bSArPTEpeyAvL25vdCBzdXJlIHdoeSB0aGlzIC0zIGlzIHRoZXJlLiBpIGd1ZXNzIGl0IHN0b3BzIHZlcnROdW0rMyB0d28gbGluZXMgZG93biBmcm9tIGdvaW5nIHNvbWV3aGVyZSBpdCBzaG91bGRuJ3Q/XG4gICAgICAgICAgICBsZXQgZmlyc3RDb29yZGluYXRlID0gdmVydE51bSAlIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG4gICAgICAgICAgICBsZXQgZW5kaW5nTmV3TGluZSA9IGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTE7XG4gICAgXG4gICAgICAgICAgICBsZXQgdmVydEluZGV4ID0gdmVydE51bSAqIE5VTV9QT0lOVFNfUEVSX0xJTkVfU0VHTUVOVDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYoIWVuZGluZ05ld0xpbmUpe1xuICAgICAgICAgICAgICAgIC8vdGhlc2UgdHJpYW5nbGVzIHNob3VsZCBiZSBkaXNhYmxlZCB3aGVuIGRvaW5nIHJvdW5kIGpvaW5zXG4gICAgICAgICAgICAgICAgaWYodGhpcy5saW5lSm9pblR5cGUgPT0gXCJCRVZFTFwiKXtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKCB2ZXJ0SW5kZXgrMSwgdmVydEluZGV4LCAgIHZlcnRJbmRleCsyKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKCB2ZXJ0SW5kZXgrMSwgdmVydEluZGV4KzIsIHZlcnRJbmRleCszKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goIHZlcnRJbmRleCszLCB2ZXJ0SW5kZXgrMiwgdmVydEluZGV4KzQpO1xuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCggdmVydEluZGV4KzMsIHZlcnRJbmRleCs0LCB2ZXJ0SW5kZXgrNSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuc2V0SW5kZXgoIGluZGljZXMgKTtcblxuICAgICAgICBpZighdGhpcy5faGFzQ3VzdG9tQ29sb3JGdW5jdGlvbil7XG4gICAgICAgICAgICB0aGlzLnNldEFsbFZlcnRpY2VzVG9Db2xvcih0aGlzLmNvbG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgY29sb3JBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgIH1cbiAgICBldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeiwgLi4ub3RoZXJBcmdzKXtcbiAgICAgICAgaWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuICAgICAgICAgICAgdGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpOyAgICBcbiAgICAgICAgfVxuXG4gICAgICAgIC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblxuICAgICAgICAvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuICAgICAgICBsZXQgeFZhbHVlID0gIHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuICAgICAgICBsZXQgeVZhbHVlID0gIHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuICAgICAgICBsZXQgelZhbHVlID0gIHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXG4gICAgICAgIHRoaXMuc2F2ZVZlcnRleEluZm9JbkJ1ZmZlcnModGhpcy5fdmVydGljZXMsIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LCB4VmFsdWUseVZhbHVlLHpWYWx1ZSk7XG5cbiAgICAgICAgaWYodGhpcy5faGFzQ3VzdG9tQ29sb3JGdW5jdGlvbil7XG4gICAgICAgICAgICBsZXQgY29sb3IgPSB0aGlzLl9jb2xvcihpLHQseCx5LHosLi4ub3RoZXJBcmdzKTtcbiAgICAgICAgICAgIC8vaWYgcmV0dXJuIHR5cGUgaXMgW3IsZyxiXVxuICAgICAgICAgICAgaWYoVXRpbHMuaXNBcnJheShjb2xvcikpe1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldENvbG9yRm9yVmVydGV4UkdCKGksIGNvbG9yWzBdLGNvbG9yWzFdLGNvbG9yWzJdKTtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIC8vaWYgcmV0dXJuIHR5cGUgaXMgZWl0aGVyIGEgaGV4IHN0cmluZywgVEhSRUUuQ29sb3IsIG9yIGV2ZW4gYW4gSFRNTCBjb2xvciBzdHJpbmdcbiAgICAgICAgICAgICAgICB0bXBDb2xvci5zZXQoY29sb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldENvbG9yRm9yVmVydGV4KGksIHRtcENvbG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9XG5cbiAgICAgICAgLyogd2UncmUgZHJhd2luZyBsaWtlIHRoaXM6XG4gICAgICAgICotLS0tKi0tLS0qXG5cbiAgICAgICAgKi0tLS0qLS0tLSpcbiAgICBcbiAgICAgICAgYnV0IHdlIGRvbid0IHdhbnQgdG8gaW5zZXJ0IGEgZGlhZ29uYWwgbGluZSBhbnl3aGVyZS4gVGhpcyBoYW5kbGVzIHRoYXQ6ICAqL1xuXG4gICAgICAgIGxldCBmaXJzdENvb3JkaW5hdGUgPSBpICUgdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXTtcblxuICAgICAgICAvL2Jvb2xlYW4gdmFyaWFibGVzLiBpZiBpbiB0aGUgZnV0dXJlIExpbmVPdXRwdXQgY2FuIHN1cHBvcnQgdmFyaWFibGUtd2lkdGggbGluZXMsIHRoZXNlIHNob3VsZCBlYiBjaGFuZ2VkXG4gICAgICAgIGxldCBzdGFydGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gMDtcbiAgICAgICAgbGV0IGVuZGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xO1xuXG4gICAgICAgIGlmKHN0YXJ0aW5nTmV3TGluZSl7XG4gICAgICAgICAgICAvL21ha2UgdGhlIHByZXZQb2ludCBiZSB0aGUgc2FtZSBwb2ludCBhcyB0aGlzXG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX3ByZXZQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCwgeFZhbHVlLHlWYWx1ZSx6VmFsdWUpO1xuICAgICAgICB9ZWxzZXtcblxuICAgICAgICAgICAgbGV0IHByZXZYID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTEpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNF07XG4gICAgICAgICAgICBsZXQgcHJldlkgPSB0aGlzLl92ZXJ0aWNlc1sodGhpcy5fY3VycmVudFBvaW50SW5kZXgtMSkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucyo0KzFdO1xuICAgICAgICAgICAgbGV0IHByZXZaID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTEpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNCsyXTtcblxuICAgICAgICAgICAgLy9zZXQgdGhpcyB0aGluZydzIHByZXZQb2ludCB0byB0aGUgcHJldmlvdXMgdmVydGV4XG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX3ByZXZQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCwgcHJldlgscHJldlkscHJldlopO1xuXG4gICAgICAgICAgICAvL3NldCB0aGUgUFJFVklPVVMgcG9pbnQncyBuZXh0UG9pbnQgdG8gdG8gVEhJUyB2ZXJ0ZXguXG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX25leHRQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0xLCB4VmFsdWUseVZhbHVlLHpWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihlbmRpbmdOZXdMaW5lKXtcbiAgICAgICAgICAgIC8vbWFrZSB0aGUgbmV4dFBvaW50IGJlIHRoZSBzYW1lIHBvaW50IGFzIHRoaXNcbiAgICAgICAgICAgIHRoaXMuc2F2ZVZlcnRleEluZm9JbkJ1ZmZlcnModGhpcy5fbmV4dFBvaW50VmVydGljZXMsIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LCB4VmFsdWUseVZhbHVlLHpWYWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcbiAgICB9XG5cbiAgICBzYXZlVmVydGV4SW5mb0luQnVmZmVycyhhcnJheSwgdmVydE51bSwgdmFsdWUxLHZhbHVlMix2YWx1ZTMpe1xuICAgICAgICAvL2ZvciBldmVyeSBjYWxsIHRvIGFjdGl2YXRlKCksIGFsbCA0IGdlb21ldHJ5IHZlcnRpY2VzIHJlcHJlc2VudGluZyB0aGF0IHBvaW50IG5lZWQgdG8gc2F2ZSB0aGF0IGluZm8uXG4gICAgICAgIC8vVGhlcmVmb3JlLCB0aGlzIGZ1bmN0aW9uIHdpbGwgc3ByZWFkIHRocmVlIGNvb3JkaW5hdGVzIGludG8gYSBnaXZlbiBhcnJheSwgcmVwZWF0ZWRseS5cblxuICAgICAgICBsZXQgaW5kZXggPSB2ZXJ0TnVtKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNDtcblxuICAgICAgICBhcnJheVtpbmRleF0gICA9IHZhbHVlMVxuICAgICAgICBhcnJheVtpbmRleCsxXSA9IHZhbHVlMlxuICAgICAgICBhcnJheVtpbmRleCsyXSA9IHZhbHVlM1xuXG4gICAgICAgIGFycmF5W2luZGV4KzNdID0gdmFsdWUxXG4gICAgICAgIGFycmF5W2luZGV4KzRdID0gdmFsdWUyXG4gICAgICAgIGFycmF5W2luZGV4KzVdID0gdmFsdWUzXG5cbiAgICAgICAgYXJyYXlbaW5kZXgrNl0gPSB2YWx1ZTFcbiAgICAgICAgYXJyYXlbaW5kZXgrN10gPSB2YWx1ZTJcbiAgICAgICAgYXJyYXlbaW5kZXgrOF0gPSB2YWx1ZTNcblxuICAgICAgICBhcnJheVtpbmRleCs5XSAgPSB2YWx1ZTFcbiAgICAgICAgYXJyYXlbaW5kZXgrMTBdID0gdmFsdWUyXG4gICAgICAgIGFycmF5W2luZGV4KzExXSA9IHZhbHVlM1xuICAgICAgICBcbiAgICB9XG4gICAgb25BZnRlckFjdGl2YXRpb24oKXtcbiAgICAgICAgbGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcbiAgICAgICAgcG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgICBsZXQgcHJldlBvaW50UG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnByZXZpb3VzUG9pbnRQb3NpdGlvbjtcbiAgICAgICAgcHJldlBvaW50UG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgICBsZXQgbmV4dFBvaW50UG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5leHRQb2ludFBvc2l0aW9uO1xuICAgICAgICBuZXh0UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cbiAgICAgICAgLy91cGRhdGUgYXNwZWN0IHJhdGlvLiBpbiB0aGUgZnV0dXJlIHBlcmhhcHMgdGhpcyBzaG91bGQgb25seSBiZSBjaGFuZ2VkIHdoZW4gdGhlIGFzcGVjdCByYXRpbyBjaGFuZ2VzIHNvIGl0J3Mgbm90IGJlaW5nIGRvbmUgcGVyIGZyYW1lP1xuICAgICAgICBpZih0aGlzLl91bmlmb3Jtcyl7XG4gICAgICAgICAgICBjb25zdCB0aHJlZSA9IGdldFRocmVlRW52aXJvbm1lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3VuaWZvcm1zLmFzcGVjdC52YWx1ZSA9IHRocmVlLmNhbWVyYS5hc3BlY3Q7IC8vVE9ETzogcmUtZW5hYmxlIG9uY2UgZGVidWdnaW5nIGlzIGRvbmVcbiAgICAgICAgICAgIHRocmVlLnJlbmRlcmVyLmdldERyYXdpbmdCdWZmZXJTaXplKHRoaXMuX3VuaWZvcm1zLnNjcmVlblNpemUudmFsdWUpOyAvL21vZGlmaWVzIHVuaWZvcm0gaW4gcGxhY2VcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy9yZXNldCBhZnRlciBlYWNoIHVwZGF0ZVxuICAgIH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG4gICAgICAgIGdldFRocmVlRW52aXJvbm1lbnQoKS5zY2VuZS5yZW1vdmUodGhpcy5tZXNoKTtcbiAgICB9XG4gICAgc2V0QWxsVmVydGljZXNUb0NvbG9yKGNvbG9yKXtcbiAgICAgICAgY29uc3QgY29sID0gbmV3IFRIUkVFLkNvbG9yKGNvbG9yKTtcbiAgICAgICAgY29uc3QgbnVtVmVydGljZXMgPSAodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24tMSkqMjtcbiAgICAgICAgZm9yKGxldCBpPTA7IGk8bnVtVmVydGljZXM7aSsrKXtcbiAgICAgICAgICAgIC8vRG9uJ3QgZm9yZ2V0IHNvbWUgcG9pbnRzIGFwcGVhciB0d2ljZSAtIGFzIHRoZSBlbmQgb2Ygb25lIGxpbmUgc2VnbWVudCBhbmQgdGhlIGJlZ2lubmluZyBvZiB0aGUgbmV4dC5cbiAgICAgICAgICAgIHRoaXMuX3NldENvbG9yRm9yVmVydGV4UkdCKGksIGNvbC5yLCBjb2wuZywgY29sLmIpO1xuICAgICAgICB9XG4gICAgICAgIC8vdGVsbCB0aHJlZS5qcyB0byB1cGRhdGUgY29sb3JzXG4gICAgfVxuICAgIF9zZXRDb2xvckZvclZlcnRleCh2ZXJ0ZXhJbmRleCwgY29sb3Ipe1xuICAgICAgICAvL2NvbG9yIGlzIGEgVEhSRUUuQ29sb3IgaGVyZVxuICAgICAgICB0aGlzLl9zZXRDb2xvckZvclZlcnRleFJHQih2ZXJ0ZXhJbmRleCwgY29sb3IuciwgY29sb3IuZywgY29sb3IuYik7XG4gICAgfVxuICAgIF9zZXRDb2xvckZvclZlcnRleFJHQih2ZXJ0ZXhJbmRleCwgbm9ybWFsaXplZFIsIG5vcm1hbGl6ZWRHLCBub3JtYWxpemVkQil7XG4gICAgICAgIC8vYWxsIG9mIG5vcm1hbGl6ZWRSLCBub3JtYWxpemVkRywgbm9ybWFsaXplZEIgYXJlIDAtMS5cbiAgICAgICAgbGV0IGNvbG9yQXJyYXkgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLmNvbG9yLmFycmF5O1xuICAgICAgICBsZXQgaW5kZXggPSB2ZXJ0ZXhJbmRleCAqIDMgKiA0OyAvLyozIGJlY2F1c2UgY29sb3JzIGhhdmUgMyBjaGFubmVscywgKjQgYmVjYXVzZSA0IHZlcnRpY2VzL2xpbmUgcG9pbnRcblxuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgMF0gPSBub3JtYWxpemVkUjtcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDFdID0gbm9ybWFsaXplZEc7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAyXSA9IG5vcm1hbGl6ZWRCO1xuXG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAzXSA9IG5vcm1hbGl6ZWRSO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgNF0gPSBub3JtYWxpemVkRztcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDVdID0gbm9ybWFsaXplZEI7XG5cbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDZdID0gbm9ybWFsaXplZFI7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyA3XSA9IG5vcm1hbGl6ZWRHO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgOF0gPSBub3JtYWxpemVkQjtcblxuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgOV0gPSBub3JtYWxpemVkUjtcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDEwXSA9IG5vcm1hbGl6ZWRHO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgMTFdID0gbm9ybWFsaXplZEI7XG5cbiAgICAgICAgbGV0IGNvbG9yQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvcjtcbiAgICAgICAgY29sb3JBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgIH1cbiAgICBzZXQgY29sb3IoY29sb3Ipe1xuICAgICAgICAvL2NvbG9yIGNhbiBiZSBhIFRIUkVFLkNvbG9yKCksIG9yIGEgZnVuY3Rpb24gKGksdCx4LHkseikgPT4gVEhSRUUuQ29sb3IoKSwgd2hpY2ggd2lsbCBiZSBjYWxsZWQgb24gZXZlcnkgcG9pbnQuXG4gICAgICAgIHRoaXMuX2NvbG9yID0gY29sb3I7XG4gICAgICAgIGlmKFV0aWxzLmlzRnVuY3Rpb24oY29sb3IpKXtcbiAgICAgICAgICAgIHRoaXMuX2hhc0N1c3RvbUNvbG9yRnVuY3Rpb24gPSB0cnVlO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRoaXMuX2hhc0N1c3RvbUNvbG9yRnVuY3Rpb24gPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuc2V0QWxsVmVydGljZXNUb0NvbG9yKGNvbG9yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBnZXQgY29sb3IoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yO1xuICAgIH1cbiAgICBzZXQgb3BhY2l0eShvcGFjaXR5KXtcbiAgICAgICAgLy9tZXNoIGlzIGFsd2F5cyB0cmFuc3BhcmVudFxuICAgICAgICB0aGlzLm1hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDEgfHwgdGhpcy5saW5lSm9pblR5cGUgPT0gXCJST1VORFwiO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnZpc2libGUgPSBvcGFjaXR5ID4gMDtcbiAgICAgICAgdGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLm9wYWNpdHkudmFsdWUgPSBvcGFjaXR5O1xuICAgIH1cbiAgICBnZXQgb3BhY2l0eSgpe1xuICAgICAgICByZXR1cm4gdGhpcy5fb3BhY2l0eTtcbiAgICB9XG4gICAgc2V0IHdpZHRoKHdpZHRoKXtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMubGluZVdpZHRoLnZhbHVlID0gd2lkdGg7XG4gICAgfVxuICAgIGdldCB3aWR0aCgpe1xuICAgICAgICByZXR1cm4gdGhpcy5fd2lkdGg7XG4gICAgfVxuICAgIGNsb25lKCl7XG4gICAgICAgIHJldHVybiBuZXcgTGluZU91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHksIGxpbmVKb2luVHlwZTogdGhpcy5saW5lSm9pblR5cGV9KTtcbiAgICB9XG59XG5cbmV4cG9ydCB7TGluZU91dHB1dH07XG4iLCJpbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuaW1wb3J0IHsgdGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4uL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5jbGFzcyBQb2ludE91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKlxuXHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0Y29sb3I6IGhleCBjb2xvciwgYXMgaW4gMHhycmdnYmIuIFRlY2huaWNhbGx5LCB0aGlzIGlzIGEgSlMgaW50ZWdlci5cblx0XHRcdG9wYWNpdHk6IDAtMS4gT3B0aW9uYWwuXG5cdFx0Ki9cblxuXHRcdHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDE7XG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBuZXcgVEhSRUUuQ29sb3Iob3B0aW9ucy5jb2xvcikgOiBuZXcgVEhSRUUuQ29sb3IoMHg1NWFhNTUpO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cblx0XHR0aGlzLnBvaW50cyA9IFtdO1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe2NvbG9yOiB0aGlzLl9jb2xvcn0pO1xuICAgICAgICB0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvL3RyaWdnZXIgc2V0dGVyIHRvIHNldCB0aGlzLm1hdGVyaWFsJ3Mgb3BhY2l0eSBwcm9wZXJseVxuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSAwOyAvL3Nob3VsZCBhbHdheXMgYmUgZXF1YWwgdG8gdGhpcy5wb2ludHMubGVuZ3RoXG5cdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IGZhbHNlO1xuXHR9XG5cdF9vbkFkZCgpeyAvL3Nob3VsZCBiZSBjYWxsZWQgd2hlbiB0aGlzIGlzIC5hZGQoKWVkIHRvIHNvbWV0aGluZ1xuXHRcdC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBBcmVhXG5cdFx0bGV0IHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cblx0XHRpZih0aGlzLnBvaW50cy5sZW5ndGggPCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbil7XG5cdFx0XHRmb3IodmFyIGk9dGhpcy5wb2ludHMubGVuZ3RoO2k8dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb247aSsrKXtcblx0XHRcdFx0dGhpcy5wb2ludHMucHVzaChuZXcgUG9pbnRNZXNoKHt3aWR0aDogMSxtYXRlcmlhbDp0aGlzLm1hdGVyaWFsfSkpO1xuXHRcdFx0XHR0aGlzLnBvaW50c1tpXS5tZXNoLnNjYWxlLnNldFNjYWxhcih0aGlzLl93aWR0aCk7IC8vc2V0IHdpZHRoIGJ5IHNjYWxpbmcgcG9pbnRcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pdGhpcy5fb25BZGQoKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblx0XHR2YXIgcG9pbnQgPSB0aGlzLmdldFBvaW50KGkpO1xuXHRcdHBvaW50LnggPSB4ID09PSB1bmRlZmluZWQgPyAwIDogeDtcblx0XHRwb2ludC55ID0geSA9PT0gdW5kZWZpbmVkID8gMCA6IHk7XG5cdFx0cG9pbnQueiA9IHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXHR9XG5cdGdldFBvaW50KGkpe1xuXHRcdHJldHVybiB0aGlzLnBvaW50c1tpXTtcblx0fVxuICAgIHJlbW92ZVNlbGZGcm9tU2NlbmUoKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMucG9pbnRzLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5wb2ludHNbaV0ucmVtb3ZlU2VsZkZyb21TY2VuZSgpO1xuXHRcdH1cbiAgICB9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdC8vdGVjaG5pY2FsbHkgdGhpcyBzZXRzIGFsbCBwb2ludHMgdG8gdGhlIHNhbWUgY29sb3IuIFRvZG86IGFsbG93IGRpZmZlcmVudCBwb2ludHMgdG8gYmUgZGlmZmVyZW50bHkgY29sb3JlZC5cblx0XHRcblx0XHRsZXQgbWF0ID0gdGhpcy5tYXRlcmlhbDtcblx0XHRtYXQub3BhY2l0eSA9IG9wYWNpdHk7IC8vaW5zdGFudGlhdGUgdGhlIHBvaW50XG5cdFx0bWF0LnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG4gICAgICAgIG1hdC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRzZXQgY29sb3IoY29sb3Ipe1xuICAgICAgICB0aGlzLm1hdGVyaWFsLmNvbG9yID0gY29sb3I7XG5cdFx0dGhpcy5fY29sb3IgPSBjb2xvcjtcblx0fVxuXHRnZXQgY29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3I7XG5cdH1cblx0c2V0IHdpZHRoKHdpZHRoKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMucG9pbnRzLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5nZXRQb2ludChpKS5tZXNoLnNjYWxlLnNldFNjYWxhcih3aWR0aCk7XG5cdFx0fVxuXHRcdHRoaXMuX3dpZHRoID0gd2lkdGg7XG5cdH1cblx0Z2V0IHdpZHRoKCl7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZHRoO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBQb2ludE91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG5cbmNsYXNzIFBvaW50TWVzaHtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0LypvcHRpb25zOlxuXHRcdFx0eCx5OiBudW1iZXJzXG5cdFx0XHR3aWR0aDogbnVtYmVyXG4gICAgICAgICAgICBtYXRlcmlhbDogXG5cdFx0Ki9cblxuXHRcdGxldCB3aWR0aCA9IG9wdGlvbnMud2lkdGggPT09IHVuZGVmaW5lZCA/IDEgOiBvcHRpb25zLndpZHRoXG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBvcHRpb25zLm1hdGVyaWFsOyAvL29uZSBtYXRlcmlhbCBwZXIgUG9pbnRPdXRwdXRcblxuXHRcdHRoaXMubWVzaCA9IG5ldyBUSFJFRS5NZXNoKHRoaXMuc2hhcmVkQ2lyY2xlR2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cblx0XHR0aGlzLm1lc2gucG9zaXRpb24uc2V0KHRoaXMueCx0aGlzLnksdGhpcy56KTtcblx0XHR0aGlzLm1lc2guc2NhbGUuc2V0U2NhbGFyKHRoaXMud2lkdGgvMik7XG5cdFx0dGhyZWVFbnZpcm9ubWVudC5zY2VuZS5hZGQodGhpcy5tZXNoKTtcblxuXHRcdHRoaXMueCA9IG9wdGlvbnMueCB8fCAwO1xuXHRcdHRoaXMueSA9IG9wdGlvbnMueSB8fCAwO1xuXHRcdHRoaXMueiA9IG9wdGlvbnMueiB8fCAwO1xuXHR9XG5cdHJlbW92ZVNlbGZGcm9tU2NlbmUoKXtcblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLm1lc2gpO1xuXHR9XG5cdHNldCB4KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi54ID0gaTtcblx0fVxuXHRzZXQgeShpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueSA9IGk7XG5cdH1cblx0c2V0IHooaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnogPSBpO1xuXHR9XG5cdGdldCB4KCl7XG5cdFx0cmV0dXJuIHRoaXMubWVzaC5wb3NpdGlvbi54O1xuXHR9XG5cdGdldCB5KCl7XG5cdFx0cmV0dXJuIHRoaXMubWVzaC5wb3NpdGlvbi55O1xuXHR9XG5cdGdldCB6KCl7XG5cdFx0cmV0dXJuIHRoaXMubWVzaC5wb3NpdGlvbi56O1xuXHR9XG59XG5Qb2ludE1lc2gucHJvdG90eXBlLnNoYXJlZENpcmNsZUdlb21ldHJ5ID0gbmV3IFRIUkVFLlNwaGVyZUdlb21ldHJ5KDEvMiwgOCwgNik7IC8vcmFkaXVzIDEvMiBtYWtlcyBkaWFtZXRlciAxLCBzbyB0aGF0IHNjYWxpbmcgYnkgbiBtZWFucyB3aWR0aD1uXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0UG9pbnQoKXtcblx0dmFyIHggPSBuZXcgRVhQLkFyZWEoe2JvdW5kczogW1stMTAsMTBdXX0pO1xuXHR2YXIgeSA9IG5ldyBFWFAuVHJhbnNmb3JtYXRpb24oeydleHByJzogKHgpID0+IHgqeH0pO1xuXHR2YXIgeSA9IG5ldyBFWFAuUG9pbnRPdXRwdXQoKTtcblx0eC5hZGQoeSk7XG5cdHkuYWRkKHopO1xuXHR4LmFjdGl2YXRlKCk7XG59XG5cbmV4cG9ydCB7UG9pbnRPdXRwdXQsIFBvaW50TWVzaH1cbiIsImltcG9ydCB7IExpbmVPdXRwdXQgfSBmcm9tICcuL0xpbmVPdXRwdXQuanMnO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuLi91dGlscy5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBWZWN0b3JPdXRwdXQgZXh0ZW5kcyBMaW5lT3V0cHV0e1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG4gICAgICAgIC8qXG4gICAgICAgICAgICAgICAgd2lkdGg6IG51bWJlci4gdW5pdHMgYXJlIGluIHNjcmVlblkvNDAwLlxuICAgICAgICAgICAgICAgIG9wYWNpdHk6IG51bWJlclxuICAgICAgICAgICAgICAgIGNvbG9yOiBoZXggY29kZSBvciBUSFJFRS5Db2xvcigpXG4gICAgICAgICAgICAgICAgbGluZUpvaW46IFwiYmV2ZWxcIiBvciBcInJvdW5kXCIuIGRlZmF1bHQ6IHJvdW5kLiBEb24ndCBjaGFuZ2UgdGhpcyBhZnRlciBpbml0aWFsaXphdGlvbi5cbiAgICAgICAgKi9cbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICB9XG4gICAgaW5pdCgpe1xuICAgICAgICB0aGlzLmFycm93TWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe2NvbG9yOiB0aGlzLl9jb2xvciwgbGluZXdpZHRoOiB0aGlzLl93aWR0aCwgb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSk7XG5cbiAgICAgICAgc3VwZXIuaW5pdCgpO1xuICAgICAgICB0aGlzLmFycm93aGVhZHMgPSBbXTtcblxuICAgICAgICAvL1RPRE86IG1ha2UgdGhlIGFycm93IHRpcCBjb2xvcnMgbWF0Y2ggdGhlIGNvbG9ycyBvZiB0aGUgbGluZXMnIHRpcHNcblxuICAgICAgICBjb25zdCBjaXJjbGVSZXNvbHV0aW9uID0gMTI7XG4gICAgICAgIGNvbnN0IGFycm93aGVhZFNpemUgPSAwLjM7XG4gICAgICAgIGNvbnN0IEVQU0lMT04gPSAwLjAwMDAxO1xuICAgICAgICB0aGlzLkVQU0lMT04gPSBFUFNJTE9OO1xuXG4gICAgICAgIHRoaXMuY29uZUdlb21ldHJ5ID0gbmV3IFRIUkVFLkN5bGluZGVyQnVmZmVyR2VvbWV0cnkoIDAsIGFycm93aGVhZFNpemUsIGFycm93aGVhZFNpemUqMS43LCBjaXJjbGVSZXNvbHV0aW9uLCAxICk7XG4gICAgICAgIGxldCBhcnJvd2hlYWRPdmVyc2hvb3RGYWN0b3IgPSAwLjE7IC8vdXNlZCBzbyB0aGF0IHRoZSBsaW5lIHdvbid0IHJ1ZGVseSBjbGlwIHRocm91Z2ggdGhlIHBvaW50IG9mIHRoZSBhcnJvd2hlYWRcbiAgICAgICAgdGhpcy5jb25lR2VvbWV0cnkudHJhbnNsYXRlKCAwLCAtIGFycm93aGVhZFNpemUgKyBhcnJvd2hlYWRPdmVyc2hvb3RGYWN0b3IsIDAgKTtcbiAgICAgICAgdGhpcy5fY29uZVVwRGlyZWN0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwxLDApO1xuICAgIH1cbiAgICBfb25GaXJzdEFjdGl2YXRpb24oKXtcbiAgICAgICAgc3VwZXIuX29uRmlyc3RBY3RpdmF0aW9uKCk7XG5cbiAgICAgICAgaWYodGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGggPiAxKXtcbiAgICAgICAgICAgIHRoaXMubnVtQXJyb3doZWFkcyA9IHRoaXMuaXRlbURpbWVuc2lvbnMuc2xpY2UoMCx0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xKS5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VycmVudCl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnQgKyBwcmV2O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgLy9hc3N1bWVkIGl0ZW1EaW1lbnNpb25zIGlzbid0IGEgbm9uemVybyBhcnJheS4gVGhhdCBzaG91bGQgYmUgdGhlIGNvbnN0cnVjdG9yJ3MgcHJvYmxlbS5cbiAgICAgICAgICAgIHRoaXMubnVtQXJyb3doZWFkcyA9IDE7XG4gICAgICAgIH1cblxuICAgICAgICAvL3JlbW92ZSBhbnkgcHJldmlvdXMgYXJyb3doZWFkc1xuICAgICAgICBmb3IodmFyIGk9MDtpPHRoaXMuYXJyb3doZWFkcy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGxldCBhcnJvdyA9IHRoaXMuYXJyb3doZWFkc1tpXTtcbiAgICAgICAgICAgIHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKGFycm93KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXJyb3doZWFkcyA9IG5ldyBBcnJheSh0aGlzLm51bUFycm93aGVhZHMpO1xuICAgICAgICBmb3IodmFyIGk9MDtpPHRoaXMubnVtQXJyb3doZWFkcztpKyspe1xuICAgICAgICAgICAgdGhpcy5hcnJvd2hlYWRzW2ldID0gbmV3IFRIUkVFLk1lc2godGhpcy5jb25lR2VvbWV0cnksIHRoaXMuYXJyb3dNYXRlcmlhbCk7XG4gICAgICAgICAgICB0aGlzLm1lc2guYWRkKHRoaXMuYXJyb3doZWFkc1tpXSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coXCJudW1iZXIgb2YgYXJyb3doZWFkcyAoPSBudW1iZXIgb2YgbGluZXMpOlwiKyB0aGlzLm51bUFycm93aGVhZHMpO1xuICAgIH1cbiAgICBldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG4gICAgICAgIC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cbiAgICAgICAgc3VwZXIuZXZhbHVhdGVTZWxmKGksdCx4LHkseik7XG5cbiAgICAgICAgY29uc3QgbGFzdERpbWVuc2lvbkxlbmd0aCA9IHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG4gICAgICAgIGxldCBmaXJzdENvb3JkaW5hdGUgPSBpICUgbGFzdERpbWVuc2lvbkxlbmd0aDtcblxuICAgICAgICAvL2Jvb2xlYW4gdmFyaWFibGVzLiBpZiBpbiB0aGUgZnV0dXJlIExpbmVPdXRwdXQgY2FuIHN1cHBvcnQgdmFyaWFibGUtd2lkdGggbGluZXMsIHRoZXNlIHNob3VsZCBlYiBjaGFuZ2VkXG4gICAgICAgIGxldCBzdGFydGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gMDtcbiAgICAgICAgbGV0IGVuZGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gbGFzdERpbWVuc2lvbkxlbmd0aC0xO1xuXG4gICAgICAgIGlmKGVuZGluZ05ld0xpbmUpe1xuICAgICAgICAgICAgLy93ZSBuZWVkIHRvIHVwZGF0ZSBhcnJvd3NcbiAgICAgICAgICAgIC8vY2FsY3VsYXRlIGRpcmVjdGlvbiBvZiBsYXN0IGxpbmUgc2VnbWVudFxuICAgICAgICAgICAgLy90aGlzIHBvaW50IGlzIGN1cnJlbnRQb2ludEluZGV4LTEgYmVjYXVzZSBjdXJyZW50UG9pbnRJbmRleCB3YXMgaW5jcmVhc2VkIGJ5IDEgZHVyaW5nIHN1cGVyLmV2YWx1YXRlU2VsZigpXG4gICAgICAgICAgICBsZXQgaW5kZXggPSAodGhpcy5fY3VycmVudFBvaW50SW5kZXgtMSkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucyo0O1xuXG4gICAgICAgICAgICBsZXQgcHJldlggPSB0aGlzLl92ZXJ0aWNlc1sodGhpcy5fY3VycmVudFBvaW50SW5kZXgtMikqdGhpcy5fb3V0cHV0RGltZW5zaW9ucyo0XTtcbiAgICAgICAgICAgIGxldCBwcmV2WSA9IHRoaXMuX3ZlcnRpY2VzWyh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0yKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjQrMV07XG4gICAgICAgICAgICBsZXQgcHJldlogPSB0aGlzLl92ZXJ0aWNlc1sodGhpcy5fY3VycmVudFBvaW50SW5kZXgtMikqdGhpcy5fb3V0cHV0RGltZW5zaW9ucyo0KzJdO1xuXG4gICAgICAgICAgICBsZXQgZHggPSBwcmV2WCAtIHRoaXMuX3ZlcnRpY2VzW2luZGV4XTtcbiAgICAgICAgICAgIGxldCBkeSA9IHByZXZZIC0gdGhpcy5fdmVydGljZXNbaW5kZXgrMV07XG4gICAgICAgICAgICBsZXQgZHogPSBwcmV2WiAtIHRoaXMuX3ZlcnRpY2VzW2luZGV4KzJdO1xuXG4gICAgICAgICAgICBsZXQgbGluZU51bWJlciA9IE1hdGguZmxvb3IoaSAvIGxhc3REaW1lbnNpb25MZW5ndGgpO1xuICAgICAgICAgICAgVXRpbHMuYXNzZXJ0KGxpbmVOdW1iZXIgPD0gdGhpcy5udW1BcnJvd2hlYWRzKTsgLy90aGlzIG1heSBiZSB3cm9uZ1xuXG4gICAgICAgICAgICBsZXQgZGlyZWN0aW9uVmVjdG9yID0gbmV3IFRIUkVFLlZlY3RvcjMoLWR4LC1keSwtZHopO1xuXG4gICAgICAgICAgICAvL01ha2UgYXJyb3dzIGRpc2FwcGVhciBpZiB0aGUgbGluZSBpcyBzbWFsbCBlbm91Z2hcbiAgICAgICAgICAgIC8vT25lIHdheSB0byBkbyB0aGlzIHdvdWxkIGJlIHRvIHN1bSB0aGUgZGlzdGFuY2VzIG9mIGFsbCBsaW5lIHNlZ21lbnRzLiBJJ20gY2hlYXRpbmcgaGVyZSBhbmQganVzdCBtZWFzdXJpbmcgdGhlIGRpc3RhbmNlIG9mIHRoZSBsYXN0IHZlY3RvciwgdGhlbiBtdWx0aXBseWluZyBieSB0aGUgbnVtYmVyIG9mIGxpbmUgc2VnbWVudHMgKG5haXZlbHkgYXNzdW1pbmcgYWxsIGxpbmUgc2VnbWVudHMgYXJlIHRoZSBzYW1lIGxlbmd0aClcbiAgICAgICAgICAgIGxldCBsZW5ndGggPSBkaXJlY3Rpb25WZWN0b3IubGVuZ3RoKCkgKiAobGFzdERpbWVuc2lvbkxlbmd0aC0xKTtcblxuICAgICAgICAgICAgY29uc3QgZWZmZWN0aXZlRGlzdGFuY2UgPSAzO1xuICAgICAgICAgICAgbGV0IGNsYW1wZWRMZW5ndGggPSBNYXRoLm1heCgwLCBNYXRoLm1pbihsZW5ndGgvZWZmZWN0aXZlRGlzdGFuY2UsIDEpKTtcblxuICAgICAgICAgICAgLy9zaHJpbmsgZnVuY3Rpb24gZGVzaWduZWQgdG8gaGF2ZSBhIHN0ZWVwIHNsb3BlIGNsb3NlIHRvIDAgYnV0IG1lbGxvdyBvdXQgYXQgMC41IG9yIHNvIGluIG9yZGVyIHRvIGF2b2lkIHRoZSBsaW5lIHdpZHRoIG92ZXJjb21pbmcgdGhlIGFycm93aGVhZCB3aWR0aFxuICAgICAgICAgICAgLy9JbiBDaHJvbWUsIHRocmVlLmpzIGNvbXBsYWlucyB3aGVuZXZlciBzb21ldGhpbmcgaXMgc2V0IHRvIDAgc2NhbGUuIEFkZGluZyBhbiBlcHNpbG9uIHRlcm0gaXMgdW5mb3J0dW5hdGUgYnV0IG5lY2Vzc2FyeSB0byBhdm9pZCBjb25zb2xlIHNwYW0uXG4gICAgICAgICAgICB0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0uc2NhbGUuc2V0U2NhbGFyKE1hdGguYWNvcygxLTIqY2xhbXBlZExlbmd0aCkvTWF0aC5QSSArIHRoaXMuRVBTSUxPTik7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgICAvL3Bvc2l0aW9uL3JvdGF0aW9uIGNvbWVzIGFmdGVyIHNpbmNlIC5ub3JtYWxpemUoKSBtb2RpZmllcyBkaXJlY3Rpb25WZWN0b3IgaW4gcGxhY2VcbiAgICAgICAgICAgIGxldCBwb3MgPSB0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0ucG9zaXRpb247XG4gICAgICAgICAgICBwb3MueCA9IHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuICAgICAgICAgICAgcG9zLnkgPSB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcbiAgICAgICAgICAgIHBvcy56ID0geiA9PT0gdW5kZWZpbmVkID8gMCA6IHo7XG5cbiAgICAgICAgICAgIGlmKGxlbmd0aCA+IDApeyAvL2RpcmVjdGlvblZlY3Rvci5ub3JtYWxpemUoKSBmYWlscyB3aXRoIDAgbGVuZ3RoXG4gICAgICAgICAgICAgICAgdGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnF1YXRlcm5pb24uc2V0RnJvbVVuaXRWZWN0b3JzKHRoaXMuX2NvbmVVcERpcmVjdGlvbiwgZGlyZWN0aW9uVmVjdG9yLm5vcm1hbGl6ZSgpICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXQgY29sb3IoY29sb3Ipe1xuICAgICAgICAvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cbiAgICAgICAgLy9JIHNob3VsZCByZWFsbHkgbWFrZSBpdCBwb3NzaWJsZSB0byBzcGVjaWZ5IGNvbG9yIGJ5IGEgZnVuY3Rpb24uXG4gICAgICAgIHRoaXMuX2NvbG9yID0gY29sb3I7XG4gICAgICAgIHRoaXMuc2V0QWxsVmVydGljZXNUb0NvbG9yKGNvbG9yKTtcbiAgICAgICAgdGhpcy5hcnJvd01hdGVyaWFsLmNvbG9yID0gbmV3IFRIUkVFLkNvbG9yKHRoaXMuX2NvbG9yKTtcbiAgICB9XG5cbiAgICBnZXQgY29sb3IoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yO1xuICAgIH1cblxuICAgIHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuICAgICAgICB0aGlzLmFycm93TWF0ZXJpYWwub3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMuYXJyb3dNYXRlcmlhbC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDEgfHwgdGhpcy5saW5lSm9pblR5cGUgPT0gXCJST1VORFwiO1xuICAgICAgICB0aGlzLmFycm93TWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXG4gICAgICAgIC8vbWVzaCBpcyBhbHdheXMgdHJhbnNwYXJlbnRcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG4gICAgICAgIHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gb3BhY2l0eTtcbiAgICB9XG5cbiAgICBnZXQgb3BhY2l0eSgpe1xuICAgICAgICByZXR1cm4gdGhpcy5fb3BhY2l0eTtcbiAgICB9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLm1lc2gpO1xuICAgICAgICBmb3IodmFyIGk9MDtpPHRoaXMubnVtQXJyb3doZWFkcztpKyspe1xuICAgICAgICAgICAgdGhyZWVFbnZpcm9ubWVudC5zY2VuZS5yZW1vdmUodGhpcy5hcnJvd2hlYWRzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjbG9uZSgpe1xuICAgICAgICByZXR1cm4gbmV3IFZlY3Rvck91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHksbGluZUpvaW5UeXBlOiB0aGlzLmxpbmVKb2luVHlwZX0pO1xuICAgIH1cbn1cblxuXG4iLCIvL1N1cmZhY2VPdXRwdXRTaGFkZXJzLmpzXG5cbi8vZXhwZXJpbWVudDogc2hhZGVycyB0byBnZXQgdGhlIHRyaWFuZ2xlIHB1bHNhdGluZyFcbnZhciB2U2hhZGVyID0gW1xuXCJ2YXJ5aW5nIHZlYzMgdk5vcm1hbDtcIixcblwidmFyeWluZyB2ZWMzIHZQb3NpdGlvbjtcIixcblwidmFyeWluZyB2ZWMyIHZVdjtcIixcblwidW5pZm9ybSBmbG9hdCB0aW1lO1wiLFxuXCJ1bmlmb3JtIHZlYzMgY29sb3I7XCIsXG5cInVuaWZvcm0gdmVjMyB2TGlnaHQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgZ3JpZFNxdWFyZXM7XCIsXG5cblwidm9pZCBtYWluKCkge1wiLFxuXHRcInZQb3NpdGlvbiA9IHBvc2l0aW9uLnh5ejtcIixcblx0XCJ2Tm9ybWFsID0gbm9ybWFsLnh5ejtcIixcblx0XCJ2VXYgPSB1di54eTtcIixcblx0XCJnbF9Qb3NpdGlvbiA9IHByb2plY3Rpb25NYXRyaXggKlwiLFxuICAgICAgICAgICAgXCJtb2RlbFZpZXdNYXRyaXggKlwiLFxuICAgICAgICAgICAgXCJ2ZWM0KHBvc2l0aW9uLDEuMCk7XCIsXG5cIn1cIl0uam9pbihcIlxcblwiKVxuXG52YXIgZlNoYWRlciA9IFtcblwidmFyeWluZyB2ZWMzIHZOb3JtYWw7XCIsXG5cInZhcnlpbmcgdmVjMyB2UG9zaXRpb247XCIsXG5cInZhcnlpbmcgdmVjMiB2VXY7XCIsXG5cInVuaWZvcm0gZmxvYXQgdGltZTtcIixcblwidW5pZm9ybSB2ZWMzIGNvbG9yO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IHVzZUN1c3RvbUdyaWRDb2xvcjtcIixcblwidW5pZm9ybSB2ZWMzIGdyaWRDb2xvcjtcIixcblwidW5pZm9ybSB2ZWMzIHZMaWdodDtcIixcblwidW5pZm9ybSBmbG9hdCBncmlkU3F1YXJlcztcIixcblwidW5pZm9ybSBmbG9hdCBsaW5lV2lkdGg7XCIsXG5cInVuaWZvcm0gZmxvYXQgc2hvd0dyaWQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgc2hvd1NvbGlkO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IG9wYWNpdHk7XCIsXG5cblx0Ly90aGUgZm9sbG93aW5nIGNvZGUgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdW5jb25lZC9tYXRoYm94L2Jsb2IvZWFlYjhlMTVlZjJkMDI1Mjc0MGE3NDUwNWExMmQ3YTEwNTFhNjFiNi9zcmMvc2hhZGVycy9nbHNsL21lc2guZnJhZ21lbnQuc2hhZGVkLmdsc2xcblwidmVjMyBvZmZTcGVjdWxhcih2ZWMzIGNvbG9yKSB7XCIsXG5cIiAgdmVjMyBjID0gMS4wIC0gY29sb3I7XCIsXG5cIiAgcmV0dXJuIDEuMCAtIGMgKiBjO1wiLFxuXCJ9XCIsXG5cblwidmVjNCBnZXRTaGFkZWRDb2xvcih2ZWM0IHJnYmEpIHsgXCIsXG5cIiAgdmVjMyBjb2xvciA9IHJnYmEueHl6O1wiLFxuXCIgIHZlYzMgY29sb3IyID0gb2ZmU3BlY3VsYXIocmdiYS54eXopO1wiLFxuXG5cIiAgdmVjMyBub3JtYWwgPSBub3JtYWxpemUodk5vcm1hbCk7XCIsXG5cIiAgdmVjMyBsaWdodCA9IG5vcm1hbGl6ZSh2TGlnaHQpO1wiLFxuXCIgIHZlYzMgcG9zaXRpb24gPSBub3JtYWxpemUodlBvc2l0aW9uKTtcIixcblxuXCIgIGZsb2F0IHNpZGUgICAgPSBnbF9Gcm9udEZhY2luZyA/IC0xLjAgOiAxLjA7XCIsXG5cIiAgZmxvYXQgY29zaW5lICA9IHNpZGUgKiBkb3Qobm9ybWFsLCBsaWdodCk7XCIsXG5cIiAgZmxvYXQgZGlmZnVzZSA9IG1peChtYXgoMC4wLCBjb3NpbmUpLCAuNSArIC41ICogY29zaW5lLCAuMSk7XCIsXG5cblwiICBmbG9hdCByaW1MaWdodGluZyA9IG1heChtaW4oMS4wIC0gc2lkZSpkb3Qobm9ybWFsLCBsaWdodCksIDEuMCksMC4wKTtcIixcblxuXCJcdGZsb2F0IHNwZWN1bGFyID0gbWF4KDAuMCwgYWJzKGNvc2luZSkgLSAwLjUpO1wiLCAvL2RvdWJsZSBzaWRlZCBzcGVjdWxhclxuXCIgICByZXR1cm4gdmVjNChkaWZmdXNlKmNvbG9yICsgMC45KnJpbUxpZ2h0aW5nKmNvbG9yICsgMC40KmNvbG9yMiAqIHNwZWN1bGFyLCByZ2JhLmEpO1wiLFxuXCJ9XCIsXG5cbi8vIFNtb290aCBIU1YgdG8gUkdCIGNvbnZlcnNpb24gZnJvbSBodHRwczovL3d3dy5zaGFkZXJ0b3kuY29tL3ZpZXcvTXNTM1djXG5cInZlYzMgaHN2MnJnYl9zbW9vdGgoIGluIHZlYzMgYyApe1wiLFxuXCIgICAgdmVjMyByZ2IgPSBjbGFtcCggYWJzKG1vZChjLngqNi4wK3ZlYzMoMC4wLDQuMCwyLjApLDYuMCktMy4wKS0xLjAsIDAuMCwgMS4wICk7XCIsXG5cIlx0cmdiID0gcmdiKnJnYiooMy4wLTIuMCpyZ2IpOyAvLyBjdWJpYyBzbW9vdGhpbmdcdFwiLFxuXCJcdHJldHVybiBjLnogKiBtaXgoIHZlYzMoMS4wKSwgcmdiLCBjLnkpO1wiLFxuXCJ9XCIsXG5cbi8vRnJvbSBTYW0gSG9jZXZhcjogaHR0cDovL2xvbGVuZ2luZS5uZXQvYmxvZy8yMDEzLzA3LzI3L3JnYi10by1oc3YtaW4tZ2xzbFxuXCJ2ZWMzIHJnYjJoc3YodmVjMyBjKXtcIixcblwiICAgIHZlYzQgSyA9IHZlYzQoMC4wLCAtMS4wIC8gMy4wLCAyLjAgLyAzLjAsIC0xLjApO1wiLFxuXCIgICAgdmVjNCBwID0gbWl4KHZlYzQoYy5iZywgSy53eiksIHZlYzQoYy5nYiwgSy54eSksIHN0ZXAoYy5iLCBjLmcpKTtcIixcblwiICAgIHZlYzQgcSA9IG1peCh2ZWM0KHAueHl3LCBjLnIpLCB2ZWM0KGMuciwgcC55engpLCBzdGVwKHAueCwgYy5yKSk7XCIsXG5cblwiICAgIGZsb2F0IGQgPSBxLnggLSBtaW4ocS53LCBxLnkpO1wiLFxuXCIgICAgZmxvYXQgZSA9IDEuMGUtMTA7XCIsXG5cIiAgICByZXR1cm4gdmVjMyhhYnMocS56ICsgKHEudyAtIHEueSkgLyAoNi4wICogZCArIGUpKSwgZCAvIChxLnggKyBlKSwgcS54KTtcIixcblwifVwiLFxuIC8vY2hvb3NlcyB0aGUgY29sb3IgZm9yIHRoZSBncmlkbGluZXMgYnkgdmFyeWluZyBsaWdodG5lc3MuIFxuLy9OT1QgY29udGludW91cyBvciBlbHNlIGJ5IHRoZSBpbnRlcm1lZGlhdGUgZnVuY3Rpb24gdGhlb3JlbSB0aGVyZSdkIGJlIGEgcG9pbnQgd2hlcmUgdGhlIGdyaWRsaW5lcyB3ZXJlIHRoZSBzYW1lIGNvbG9yIGFzIHRoZSBtYXRlcmlhbC5cblwidmVjMyBncmlkTGluZUNvbG9yKHZlYzMgY29sb3Ipe1wiLFxuXCIgdmVjMyBoc3YgPSByZ2IyaHN2KGNvbG9yLnh5eik7XCIsXG5cIiAvL2hzdi54ICs9IDAuMTtcIixcblwiIGlmKGhzdi56IDwgMC44KXtoc3YueiArPSAwLjI7fWVsc2V7aHN2LnogPSAwLjg1LTAuMSpoc3Yuejtoc3YueSAtPSAwLjA7fVwiLFxuXCIgcmV0dXJuIGhzdjJyZ2Jfc21vb3RoKGhzdik7XCIsXG5cIn1cIixcblxuXCJ2ZWM0IHJlbmRlckdyaWRsaW5lcyh2ZWM0IGV4aXN0aW5nQ29sb3IsIHZlYzIgdXYsIHZlYzQgc29saWRDb2xvcikge1wiLFxuXCIgIHZlYzIgZGlzdFRvRWRnZSA9IGFicyhtb2QodlV2Lnh5KmdyaWRTcXVhcmVzICsgbGluZVdpZHRoLzIuMCwxLjApKTtcIixcblwiICB2ZWMzIGNob3NlbkdyaWRMaW5lQ29sb3IgPSBtaXgoZ3JpZExpbmVDb2xvcihzb2xpZENvbG9yLnh5eiksIGdyaWRDb2xvciwgdXNlQ3VzdG9tR3JpZENvbG9yKTsgXCIsIC8vdXNlIGVpdGhlciBncmlkTGluZUNvbG9yKCkgb3Igb3ZlcnJpZGUgd2l0aCBjdXN0b20gZ3JpZFxuXCIgIHZlYzMgYmxlbmRlZEdyaWRMaW5lID0gc2hvd1NvbGlkICogY2hvc2VuR3JpZExpbmVDb2xvciArICgxLjAtc2hvd1NvbGlkKSpzb2xpZENvbG9yLnh5ejtcIiwgLy9pZiBzaG93U29saWQgPTAsIHVzZSBzb2xpZENvbG9yIGFzIHRoZSBncmlkbGluZSBjb2xvciwgb3RoZXJ3aXNlIHNoYWRlXG5cblwiICBpZiggZGlzdFRvRWRnZS54IDwgbGluZVdpZHRoIHx8IGRpc3RUb0VkZ2UueSA8IGxpbmVXaWR0aCl7XCIsXG5cIiAgICByZXR1cm4gbWl4KGV4aXN0aW5nQ29sb3IsIHZlYzQoYmxlbmRlZEdyaWRMaW5lLCAxLjApLHNob3dHcmlkKTtcIixcblwiICB9XCIsXG5cIiAgcmV0dXJuIGV4aXN0aW5nQ29sb3I7XCIsXG5cIn1cIixcbi8qXG5cInZlYzQgZ2V0U2hhZGVkQ29sb3JNYXRoYm94KHZlYzQgcmdiYSkgeyBcIixcblwiICB2ZWMzIGNvbG9yID0gcmdiYS54eXo7XCIsXG5cIiAgdmVjMyBjb2xvcjIgPSBvZmZTcGVjdWxhcihyZ2JhLnh5eik7XCIsXG5cblwiICB2ZWMzIG5vcm1hbCA9IG5vcm1hbGl6ZSh2Tm9ybWFsKTtcIixcblwiICB2ZWMzIGxpZ2h0ID0gbm9ybWFsaXplKHZMaWdodCk7XCIsXG5cIiAgdmVjMyBwb3NpdGlvbiA9IG5vcm1hbGl6ZSh2UG9zaXRpb24pO1wiLFxuXCIgIGZsb2F0IHNpZGUgICAgPSBnbF9Gcm9udEZhY2luZyA/IC0xLjAgOiAxLjA7XCIsXG5cIiAgZmxvYXQgY29zaW5lICA9IHNpZGUgKiBkb3Qobm9ybWFsLCBsaWdodCk7XCIsXG5cIiAgZmxvYXQgZGlmZnVzZSA9IG1peChtYXgoMC4wLCBjb3NpbmUpLCAuNSArIC41ICogY29zaW5lLCAuMSk7XCIsXG5cIiAgIHZlYzMgIGhhbGZMaWdodCA9IG5vcm1hbGl6ZShsaWdodCArIHBvc2l0aW9uKTtcIixcblwiXHRmbG9hdCBjb3NpbmVIYWxmID0gbWF4KDAuMCwgc2lkZSAqIGRvdChub3JtYWwsIGhhbGZMaWdodCkpO1wiLFxuXCJcdGZsb2F0IHNwZWN1bGFyID0gcG93KGNvc2luZUhhbGYsIDE2LjApO1wiLFxuXCJcdHJldHVybiB2ZWM0KGNvbG9yICogKGRpZmZ1c2UgKiAuOSArIC4wNSkgKjAuMCArICAuMjUgKiBjb2xvcjIgKiBzcGVjdWxhciwgcmdiYS5hKTtcIixcblwifVwiLCovXG5cblwidm9pZCBtYWluKCl7XCIsXG4vL1wiICAvL2dsX0ZyYWdDb2xvciA9IHZlYzQodk5vcm1hbC54eXosIDEuMCk7IC8vIHZpZXcgZGVidWcgbm9ybWFsc1wiLFxuLy9cIiAgLy9pZih2Tm9ybWFsLnggPCAwLjApe2dsX0ZyYWdDb2xvciA9IHZlYzQob2ZmU3BlY3VsYXIoY29sb3IucmdiKSwgMS4wKTt9ZWxzZXtnbF9GcmFnQ29sb3IgPSB2ZWM0KChjb2xvci5yZ2IpLCAxLjApO31cIiwgLy92aWV3IHNwZWN1bGFyIGFuZCBub24tc3BlY3VsYXIgY29sb3JzXG4vL1wiICBnbF9GcmFnQ29sb3IgPSB2ZWM0KG1vZCh2VXYueHksMS4wKSwwLjAsMS4wKTsgLy9zaG93IHV2c1xuXCIgIHZlYzQgc29saWRDb2xvciA9IHZlYzQoY29sb3IucmdiLCBzaG93U29saWQpO1wiLFxuXCIgIHZlYzQgc29saWRDb2xvck91dCA9IHNob3dTb2xpZCpnZXRTaGFkZWRDb2xvcihzb2xpZENvbG9yKTtcIixcblwiICB2ZWM0IGNvbG9yV2l0aEdyaWRsaW5lcyA9IHJlbmRlckdyaWRsaW5lcyhzb2xpZENvbG9yT3V0LCB2VXYueHksIHNvbGlkQ29sb3IpO1wiLFxuXCIgIGNvbG9yV2l0aEdyaWRsaW5lcy5hICo9IG9wYWNpdHk7XCIsXG5cIiAgZ2xfRnJhZ0NvbG9yID0gY29sb3JXaXRoR3JpZGxpbmVzO1wiLFx0XG5cIn1cIl0uam9pbihcIlxcblwiKVxuXG52YXIgdW5pZm9ybXMgPSB7XG5cdHRpbWU6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDAsXG5cdH0sXG5cdGNvbG9yOiB7XG5cdFx0dHlwZTogJ2MnLFxuXHRcdHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMHg1NWFhNTUpLFxuXHR9LFxuXHR1c2VDdXN0b21HcmlkQ29sb3I6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDAsXG5cdH0sXG5cdGdyaWRDb2xvcjoge1xuXHRcdHR5cGU6ICdjJyxcblx0XHR2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KSxcblx0fSxcblx0b3BhY2l0eToge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMC4xLFxuXHR9LFxuXHR2TGlnaHQ6IHsgLy9saWdodCBkaXJlY3Rpb25cblx0XHR0eXBlOiAndmVjMycsXG5cdFx0dmFsdWU6IFswLDAsMV0sXG5cdH0sXG5cdGdyaWRTcXVhcmVzOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiA0LFxuXHR9LFxuXHRsaW5lV2lkdGg6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDAuMSxcblx0fSxcblx0c2hvd0dyaWQ6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCxcblx0fSxcblx0c2hvd1NvbGlkOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAxLjAsXG5cdH1cbn07XG5cbmV4cG9ydCB7IHZTaGFkZXIsIGZTaGFkZXIsIHVuaWZvcm1zIH07XG4iLCJpbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuaW1wb3J0IHtMaW5lT3V0cHV0fSBmcm9tICcuL0xpbmVPdXRwdXQuanMnO1xuaW1wb3J0IHsgZ2V0VGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4uL1RocmVlRW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgdlNoYWRlciwgZlNoYWRlciwgdW5pZm9ybXMgfSBmcm9tICcuL1N1cmZhY2VPdXRwdXRTaGFkZXJzLmpzJztcblxuY2xhc3MgU3VyZmFjZU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKiBzaG91bGQgYmUgLmFkZCgpZWQgdG8gYSBUcmFuc2Zvcm1hdGlvbiB0byB3b3JrXG5cdFx0XHRvcHRpb25zOlxuXHRcdFx0e1xuXHRcdFx0XHRvcGFjaXR5OiBudW1iZXJcblx0XHRcdFx0Y29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKCkuIERpZmZ1c2UgY29sb3Igb2YgdGhpcyBzdXJmYWNlLlxuXHRcdFx0XHRncmlkQ29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKCkuIElmIHNob3dHcmlkIGlzIHRydWUsIGdyaWQgbGluZXMgd2lsbCBhcHBlYXIgb3ZlciB0aGlzIHN1cmZhY2UuIGdyaWRDb2xvciBkZXRlcm1pbmVzIHRoZWlyIGNvbG9yIFxuXHRcdFx0XHRzaG93R3JpZDogYm9vbGVhbi4gSWYgdHJ1ZSwgd2lsbCBkaXNwbGF5IGEgZ3JpZENvbG9yLWNvbG9yZWQgZ3JpZCBvdmVyIHRoZSBzdXJmYWNlLiBEZWZhdWx0OiB0cnVlXG5cdFx0XHRcdHNob3dTb2xpZDogYm9vbGVhbi4gSWYgdHJ1ZSwgd2lsbCBkaXNwbGF5IGEgc29saWQgc3VyZmFjZS4gRGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHRncmlkU3F1YXJlczogbnVtYmVyIHJlcHJlc2VudGluZyBob3cgbWFueSBzcXVhcmVzIHBlciBkaW1lbnNpb24gdG8gdXNlIGluIGEgcmVuZGVyZWQgZ3JpZFxuXHRcdFx0XHRncmlkTGluZVdpZHRoOiBudW1iZXIgcmVwcmVzZW50aW5nIGhvdyBtYW55IHNxdWFyZXMgcGVyIGRpbWVuc2lvbiB0byB1c2UgaW4gYSByZW5kZXJlZCBncmlkXG5cdFx0XHR9XG5cdFx0Ki9cblx0XHR0aGlzLl9vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm9wYWNpdHkgOiAxO1xuXG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBuZXcgVEhSRUUuQ29sb3Iob3B0aW9ucy5jb2xvcikgOiBuZXcgVEhSRUUuQ29sb3IoMHg1NWFhNTUpO1xuXG5cdFx0dGhpcy5fZ3JpZENvbG9yID0gb3B0aW9ucy5ncmlkQ29sb3I7XG4gICAgICAgIHRoaXMuX3VzZUN1c3RvbUdyaWRDb2xvciA9IG9wdGlvbnMuZ3JpZENvbG9yICE9PSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLl9ncmlkU3F1YXJlcyA9IG9wdGlvbnMuZ3JpZFNxdWFyZXMgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuZ3JpZFNxdWFyZXMgOiAxNjtcblx0XHR0aGlzLl9zaG93R3JpZCA9IG9wdGlvbnMuc2hvd0dyaWQgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuc2hvd0dyaWQgOiB0cnVlO1xuXHRcdHRoaXMuX3Nob3dTb2xpZCA9IG9wdGlvbnMuc2hvd1NvbGlkICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLnNob3dTb2xpZCA6IHRydWU7XG5cdFx0dGhpcy5fZ3JpZExpbmVXaWR0aCA9IG9wdGlvbnMuZ3JpZExpbmVXaWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5ncmlkTGluZVdpZHRoIDogMC4xNTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMudmVydGljZXMubGVuZ3RoXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBob3cgbWFueSB0aW1lcyB0byBiZSBjYWxsZWQgaW4gZWFjaCBkaXJlY3Rpb25cblx0XHR0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gMzsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT9cblxuXHRcdHRoaXMuaW5pdCgpO1xuXHR9XG5cdGluaXQoKXtcblx0XHR0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXHRcdHRoaXMuX3ZlcnRpY2VzO1xuXHRcdHRoaXMubWFrZUdlb21ldHJ5KCk7XG5cblx0XHQvL21ha2UgYSBkZWVwIGNvcHkgb2YgdGhlIHVuaWZvcm1zIHRlbXBsYXRlXG5cdFx0dGhpcy5fdW5pZm9ybXMgPSB7fTtcblx0XHRmb3IodmFyIHVuaWZvcm1OYW1lIGluIHVuaWZvcm1zKXtcblx0XHRcdHRoaXMuX3VuaWZvcm1zW3VuaWZvcm1OYW1lXSA9IHtcblx0XHRcdFx0dHlwZTogdW5pZm9ybXNbdW5pZm9ybU5hbWVdLnR5cGUsXG5cdFx0XHRcdHZhbHVlOiB1bmlmb3Jtc1t1bmlmb3JtTmFtZV0udmFsdWVcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLlNoYWRlck1hdGVyaWFsKHtcblx0XHRcdHNpZGU6IFRIUkVFLkJhY2tTaWRlLFxuXHRcdFx0dmVydGV4U2hhZGVyOiB2U2hhZGVyLCBcblx0XHRcdGZyYWdtZW50U2hhZGVyOiBmU2hhZGVyLFxuXHRcdFx0dW5pZm9ybXM6IHRoaXMuX3VuaWZvcm1zLFxuXHRcdFx0fSk7XG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cblx0XHR0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvLyBzZXR0ZXIgc2V0cyB0cmFuc3BhcmVudCBmbGFnIGlmIG5lY2Vzc2FyeVxuXHRcdHRoaXMuY29sb3IgPSB0aGlzLl9jb2xvcjsgLy9zZXR0ZXIgc2V0cyBjb2xvciB1bmlmb3JtXG5cdFx0dGhpcy5fdW5pZm9ybXMub3BhY2l0eS52YWx1ZSA9IHRoaXMuX29wYWNpdHk7XG5cdFx0dGhpcy5fdW5pZm9ybXMuZ3JpZFNxdWFyZXMudmFsdWUgPSB0aGlzLl9ncmlkU3F1YXJlcztcblx0XHR0aGlzLl91bmlmb3Jtcy5zaG93R3JpZC52YWx1ZSA9IHRoaXMudG9OdW0odGhpcy5fc2hvd0dyaWQpO1xuXHRcdHRoaXMuX3VuaWZvcm1zLnNob3dTb2xpZC52YWx1ZSA9IHRoaXMudG9OdW0odGhpcy5fc2hvd1NvbGlkKTtcblx0XHR0aGlzLl91bmlmb3Jtcy5saW5lV2lkdGgudmFsdWUgPSB0aGlzLl9ncmlkTGluZVdpZHRoO1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy51c2VDdXN0b21HcmlkQ29sb3IudmFsdWUgPSB0aGlzLl91c2VDdXN0b21HcmlkQ29sb3IgPyAxLjAgOiAwLjA7XG4gICAgICAgIGlmKHRoaXMuX3VzZUN1c3RvbUdyaWRDb2xvcil7XG5cdFx0ICAgIHRoaXMuX3VuaWZvcm1zLmdyaWRDb2xvci52YWx1ZSA9IG5ldyBUSFJFRS5Db2xvcih0aGlzLl9ncmlkQ29sb3IpO1xuICAgICAgICB9XG5cblx0XHRpZighdGhpcy5zaG93U29saWQpdGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IHRydWU7XG5cblx0XHRnZXRUaHJlZUVudmlyb25tZW50KCkuc2NlbmUuYWRkKHRoaXMubWVzaCk7XG5cdH1cbiAgICB0b051bSh4KXtcbiAgICAgICAgaWYoeCA9PSBmYWxzZSlyZXR1cm4gMDtcbiAgICAgICAgaWYoeCA9PSB0cnVlKXJldHVybiAxO1xuICAgICAgICByZXR1cm4geDtcbiAgICB9XG5cdG1ha2VHZW9tZXRyeSgpe1xuXG5cdFx0bGV0IE1BWF9QT0lOVFMgPSAxMDAwMDtcblxuXHRcdHRoaXMuX3ZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheShNQVhfUE9JTlRTICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cdFx0dGhpcy5fbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDMpO1xuXHRcdHRoaXMuX3V2cyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDIpO1xuXG5cdFx0Ly8gYnVpbGQgZ2VvbWV0cnlcblxuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdub3JtYWwnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fbm9ybWFscywgMyApICk7XG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAndXYnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fdXZzLCAyICkgKTtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy91c2VkIGR1cmluZyB1cGRhdGVzIGFzIGEgcG9pbnRlciB0byB0aGUgYnVmZmVyXG5cblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cblx0fVxuXHRfc2V0VVZzKHV2cywgaW5kZXgsIHUsIHYpe1xuXG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG4gICAgICAgIC8vc2V0dXAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gYW5kIHRoaXMuaXRlbURpbWVuc2lvbnMuIHVzZWQgaGVyZSBhZ2FpbiBiZWNhdXNlIGNsb25pbmcgbWVhbnMgdGhlIG9uQWRkKCkgbWlnaHQgYmUgY2FsbGVkIGJlZm9yZSB0aGlzIGlzIGNvbm5lY3RlZCB0byBhIHR5cGUgb2YgZG9tYWluXG5cblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgRG9tYWluTm9kZSB3ZSdyZSByZW5kZXJpbmcgZnJvbVxuXHRcdGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcblxuXHRcdC8vIHBlcmhhcHMgaW5zdGVhZCBvZiBnZW5lcmF0aW5nIGEgd2hvbGUgbmV3IGFycmF5LCB0aGlzIGNhbiByZXVzZSB0aGUgb2xkIG9uZT9cblx0XHRsZXQgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cdFx0bGV0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogMyk7XG5cdFx0bGV0IHV2cyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiAyKTtcblxuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0dGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl92ZXJ0aWNlcyk7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBub3JtYWxzO1xuXHRcdG5vcm1hbEF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9ub3JtYWxzKTtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IHV2QXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy51djtcblxuXG5cdFx0Ly9hc3NlcnQgdGhpcy5pdGVtRGltZW5zaW9uc1swXSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0gPSB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiBhbmQgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9PSAyXG5cdFx0dmFyIGluZGljZXMgPSBbXTtcblxuXHRcdC8vcmVuZGVyZWQgdHJpYW5nbGUgaW5kaWNlc1xuXHRcdC8vZnJvbSB0aHJlZS5qcyBQbGFuZUdlb21ldHJ5LmpzXG5cdFx0bGV0IGJhc2UgPSAwO1xuXHRcdGxldCBpPTAsIGo9MDtcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXS0xO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xO2krKyl7XG5cblx0XHRcdFx0bGV0IGEgPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBiID0gaSArIChqKzEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGMgPSAoaSsxKSsgKGorMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRsZXQgZCA9IChpKzEpKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblxuICAgICAgICBcdFx0aW5kaWNlcy5wdXNoKGEsIGIsIGQpO1xuXHRcdFx0XHRpbmRpY2VzLnB1c2goYiwgYywgZCk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2RvdWJsZSBzaWRlZCByZXZlcnNlIGZhY2VzXG4gICAgICAgIFx0XHRpbmRpY2VzLnB1c2goZCwgYiwgYSk7XG5cdFx0XHRcdGluZGljZXMucHVzaChkLCBjLCBiKTtcblxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vbm9ybWFscyAod2lsbCBiZSBvdmVyd3JpdHRlbiBsYXRlcikgYW5kIHV2c1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtpKyspe1xuXG5cdFx0XHRcdGxldCBwb2ludEluZGV4ID0gaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHQvL3NldCBub3JtYWwgdG8gWzAsMCwxXSBhcyBhIHRlbXBvcmFyeSB2YWx1ZVxuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozXSA9IDA7XG5cdFx0XHRcdG5vcm1hbHNbKHBvaW50SW5kZXgpKjMrMV0gPSAwO1xuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozKzJdID0gMTtcblxuXHRcdFx0XHQvL3V2c1xuXHRcdFx0XHR1dnNbKHBvaW50SW5kZXgpKjJdID0gai8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKTtcblx0XHRcdFx0dXZzWyhwb2ludEluZGV4KSoyKzFdID0gaS8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl91dnMgPSB1dnM7XG5cdFx0dXZBdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdXZzKTtcblx0XHR1dkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHR0aGlzLl9nZW9tZXRyeS5zZXRJbmRleCggaW5kaWNlcyApO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHRpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7XHRcblx0XHR9XG5cblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cblx0XHQvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuXHRcdGxldCBpbmRleCA9IHRoaXMuX2N1cnJlbnRQb2ludEluZGV4KnRoaXMuX291dHB1dERpbWVuc2lvbnM7XG5cblx0ICAgIHRoaXMuX3ZlcnRpY2VzW2luZGV4XSAgID0geCA9PT0gdW5kZWZpbmVkID8gMCA6IHg7XG5cdFx0dGhpcy5fdmVydGljZXNbaW5kZXgrMV0gPSB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcblx0XHR0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXSA9IHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fcmVjYWxjTm9ybWFscygpO1xuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3Jlc2V0IGFmdGVyIGVhY2ggdXBkYXRlXG5cdH1cblx0X3JlY2FsY05vcm1hbHMoKXtcblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHQvL3JlbmRlcmVkIHRyaWFuZ2xlIGluZGljZXNcblx0XHQvL2Zyb20gdGhyZWUuanMgUGxhbmVHZW9tZXRyeS5qc1xuXHRcdGxldCBub3JtYWxWZWMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdGxldCBwYXJ0aWFsWCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0bGV0IHBhcnRpYWxZID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuXHRcdGxldCBiYXNlID0gMDtcblx0XHRsZXQgbmVnYXRpb25GYWN0b3IgPSAxO1xuXHRcdGxldCBpPTAsIGo9MDtcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtqKyspe1xuXHRcdFx0Zm9yKGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aSsrKXtcblxuXHRcdFx0XHQvL2N1cnJlbnRseSBkb2luZyB0aGUgbm9ybWFsIGZvciB0aGUgcG9pbnQgYXQgaW5kZXggYS5cblx0XHRcdFx0bGV0IGEgPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBiLGM7XG5cblx0XHRcdFx0Ly9UYW5nZW50cyBhcmUgY2FsY3VsYXRlZCB3aXRoIGZpbml0ZSBkaWZmZXJlbmNlcyAtIEZvciAoeCx5KSwgY29tcHV0ZSB0aGUgcGFydGlhbCBkZXJpdmF0aXZlcyB1c2luZyAoeCsxLHkpIGFuZCAoeCx5KzEpIGFuZCBjcm9zcyB0aGVtLiBCdXQgaWYgeW91J3JlIGF0IHRoZWJvcmRlciwgeCsxIGFuZCB5KzEgbWlnaHQgbm90IGV4aXN0LiBTbyBpbiB0aGF0IGNhc2Ugd2UgZ28gYmFja3dhcmRzIGFuZCB1c2UgKHgtMSx5KSBhbmQgKHgseS0xKSBpbnN0ZWFkLlxuXHRcdFx0XHQvL1doZW4gdGhhdCBoYXBwZW5zLCB0aGUgdmVjdG9yIHN1YnRyYWN0aW9uIHdpbGwgc3VidHJhY3QgdGhlIHdyb25nIHdheSwgaW50cm9kdWNpbmcgYSBmYWN0b3Igb2YgLTEgaW50byB0aGUgY3Jvc3MgcHJvZHVjdCB0ZXJtLiBTbyBuZWdhdGlvbkZhY3RvciBrZWVwcyB0cmFjayBvZiB3aGVuIHRoYXQgaGFwcGVucyBhbmQgaXMgbXVsdGlwbGllZCBhZ2FpbiB0byBjYW5jZWwgaXQgb3V0LlxuXHRcdFx0XHRuZWdhdGlvbkZhY3RvciA9IDE7IFxuXG5cdFx0XHRcdC8vYiBpcyB0aGUgaW5kZXggb2YgdGhlIHBvaW50IDEgYXdheSBpbiB0aGUgeSBkaXJlY3Rpb25cblx0XHRcdFx0aWYoaSA8IHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSl7XG5cdFx0XHRcdFx0YiA9IChpKzEpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdC8vZW5kIG9mIHRoZSB5IGF4aXMsIGdvIGJhY2t3YXJkcyBmb3IgdGFuZ2VudHNcblx0XHRcdFx0XHRiID0gKGktMSkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0XHRuZWdhdGlvbkZhY3RvciAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vYyBpcyB0aGUgaW5kZXggb2YgdGhlIHBvaW50IDEgYXdheSBpbiB0aGUgeCBkaXJlY3Rpb25cblx0XHRcdFx0aWYoaiA8IHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSl7XG5cdFx0XHRcdFx0YyA9IGkgKyAoaisxKSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdC8vZW5kIG9mIHRoZSB4IGF4aXMsIGdvIGJhY2t3YXJkcyBmb3IgdGFuZ2VudHNcblx0XHRcdFx0XHRjID0gaSArIChqLTEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0XHRuZWdhdGlvbkZhY3RvciAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vdGhlIHZlY3RvciBiLWEuIFxuXHRcdFx0XHQvL3RoaXMuX3ZlcnRpY2VzIHN0b3JlcyB0aGUgY29tcG9uZW50cyBvZiBlYWNoIHZlY3RvciBpbiBvbmUgYmlnIGZsb2F0MzJhcnJheSwgc28gdGhpcyBwdWxscyB0aGVtIG91dCBhbmQganVzdCBkb2VzIHRoZSBzdWJ0cmFjdGlvbiBudW1lcmljYWxseS4gVGhlIGNvbXBvbmVudHMgb2YgdmVjdG9yICM1MiBhcmUgeDo1MiozKzAseTo1MiozKzEsejo1MiozKzIsIGZvciBleGFtcGxlLlxuXHRcdFx0XHRwYXJ0aWFsWS5zZXQodGhpcy5fdmVydGljZXNbYiozXS10aGlzLl92ZXJ0aWNlc1thKjNdLHRoaXMuX3ZlcnRpY2VzW2IqMysxXS10aGlzLl92ZXJ0aWNlc1thKjMrMV0sdGhpcy5fdmVydGljZXNbYiozKzJdLXRoaXMuX3ZlcnRpY2VzW2EqMysyXSk7XG5cdFx0XHRcdC8vdGhlIHZlY3RvciBjLWEuXG5cdFx0XHRcdHBhcnRpYWxYLnNldCh0aGlzLl92ZXJ0aWNlc1tjKjNdLXRoaXMuX3ZlcnRpY2VzW2EqM10sdGhpcy5fdmVydGljZXNbYyozKzFdLXRoaXMuX3ZlcnRpY2VzW2EqMysxXSx0aGlzLl92ZXJ0aWNlc1tjKjMrMl0tdGhpcy5fdmVydGljZXNbYSozKzJdKTtcblxuXHRcdFx0XHQvL2ItYSBjcm9zcyBjLWFcblx0XHRcdFx0bm9ybWFsVmVjLmNyb3NzVmVjdG9ycyhwYXJ0aWFsWCxwYXJ0aWFsWSkubm9ybWFsaXplKCk7XG5cdFx0XHRcdG5vcm1hbFZlYy5tdWx0aXBseVNjYWxhcihuZWdhdGlvbkZhY3Rvcik7XG5cdFx0XHRcdC8vc2V0IG5vcm1hbFxuXHRcdFx0XHR0aGlzLl9ub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjNdID0gbm9ybWFsVmVjLng7XG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqMysxXSA9IG5vcm1hbFZlYy55O1xuXHRcdFx0XHR0aGlzLl9ub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjMrMl0gPSBub3JtYWxWZWMuejtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gZG9uJ3QgZm9yZ2V0IHRvIG5vcm1hbEF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWUgYWZ0ZXIgY2FsbGluZyB0aGlzIVxuXHR9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLm1lc2gpO1xuICAgIH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseSBtYWtlIHRoaXMgYSBmdW5jdGlvblxuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdFx0dGhpcy5fdW5pZm9ybXMuY29sb3IudmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IoY29sb3IpO1xuXHR9XG5cdGdldCBjb2xvcigpe1xuXHRcdHJldHVybiB0aGlzLl9jb2xvcjtcblx0fVxuXHRzZXQgZ3JpZENvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseSBtYWtlIHRoaXMgYSBmdW5jdGlvblxuXHRcdHRoaXMuX2dyaWRDb2xvciA9IGNvbG9yO1xuXHRcdHRoaXMuX3VuaWZvcm1zLmdyaWRDb2xvci52YWx1ZSA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLnVzZUN1c3RvbUdyaWRDb2xvci52YWx1ZSA9IDEuMDtcblx0fVxuXHRnZXQgZ3JpZENvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2dyaWRDb2xvcjtcblx0fVxuXHRzZXQgb3BhY2l0eShvcGFjaXR5KXtcblx0XHR0aGlzLm1hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuXHRcdHRoaXMubWF0ZXJpYWwudHJhbnNwYXJlbnQgPSAob3BhY2l0eSA8IDEpIHx8ICghdGhpcy5zaG93U29saWQpO1xuXHRcdHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBTdXJmYWNlT3V0cHV0KHtjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuZXhwb3J0IHtTdXJmYWNlT3V0cHV0fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5cbmNsYXNzIEZsYXRBcnJheU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG4gICAgLy9hbiBvdXRwdXQgd2hpY2ggZmlsbHMgYW4gYXJyYXkgd2l0aCBldmVyeSBjb29yZGluYXRlIHJlY2lldmVkLCBpbiBvcmRlci5cbiAgICAvL0l0J2xsIHJlZ2lzdGVyIFswLDEsMl0sWzMsNCw1XSBhcyBbMCwxLDIsMyw0LDVdLlxuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lypcblx0XHRcdGFycmF5OiBhbiBleGlzdGluZyBhcnJheSwgd2hpY2ggd2lsbCB0aGVuIGJlIG1vZGlmaWVkIGluIHBsYWNlIGV2ZXJ5IHRpbWUgdGhpcyBvdXRwdXQgaXMgYWN0aXZhdGVkXG5cdFx0Ki9cblxuXHRcdHRoaXMuYXJyYXkgPSBvcHRpb25zLmFycmF5O1xuICAgICAgICB0aGlzLl9jdXJyZW50QXJyYXlJbmRleCA9IDA7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIC4uLmNvb3Jkcyl7XG4gICAgICAgIGZvcih2YXIgaj0wO2o8Y29vcmRzLmxlbmd0aDtqKyspeyBcbiAgICAgICAgICAgIC8vSSBkb24ndCBuZWVkIHRvIHdvcnJ5IGFib3V0IG91dC1vZi1ib3VuZHMgZW50cmllcyBiZWNhdXNlIGphdmFzY3JpcHQgYXV0b21hdGljYWxseSBncm93cyBhcnJheXMgaWYgYSBuZXcgaW5kZXggaXMgc2V0LlxuICAgICAgICAgICAgLy9KYXZhc2NyaXB0IG1heSBoYXZlIHNvbWUgZ2FyYmFnZSBkZXNpZ24gY2hvaWNlcywgYnV0IEknbGwgY2xhaW0gdGhhdCBnYXJiYWdlIGZvciBteSBvd24gbmVmYXJpb3VzIGFkdmFudGFnZS5cbiAgICAgICAgICAgIHRoaXMuYXJyYXlbdGhpcy5fY3VycmVudEFycmF5SW5kZXhdID0gY29vcmRzW2pdXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50QXJyYXlJbmRleCsrO1xuICAgICAgICB9XG5cdH1cblx0b25BZnRlckFjdGl2YXRpb24oKXtcbiAgICAgICAgdGhpcy5fY3VycmVudEFycmF5SW5kZXggPSAwO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBGbGF0QXJyYXlPdXRwdXQoe2FycmF5OiBFWFAuTWF0aC5jbG9uZSh0aGlzLmFycmF5KX0pO1xuXHR9XG59XG5cbmV4cG9ydCB7RmxhdEFycmF5T3V0cHV0fTtcbiIsInZhciBleHBsYW5hcmlhbkFycm93U1ZHID0gXCJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBEOTRiV3dnZG1WeWMybHZiajBpTVM0d0lpQmxibU52WkdsdVp6MGlWVlJHTFRnaUlITjBZVzVrWVd4dmJtVTlJbTV2SWo4K0Nqd2hMUzBnUTNKbFlYUmxaQ0IzYVhSb0lFbHVhM05qWVhCbElDaG9kSFJ3T2k4dmQzZDNMbWx1YTNOallYQmxMbTl5Wnk4cElDMHRQZ29LUEhOMlp3b2dJQ0I0Yld4dWN6cGtZejBpYUhSMGNEb3ZMM0IxY213dWIzSm5MMlJqTDJWc1pXMWxiblJ6THpFdU1TOGlDaUFnSUhodGJHNXpPbU5qUFNKb2RIUndPaTh2WTNKbFlYUnBkbVZqYjIxdGIyNXpMbTl5Wnk5dWN5TWlDaUFnSUhodGJHNXpPbkprWmowaWFIUjBjRG92TDNkM2R5NTNNeTV2Y21jdk1UazVPUzh3TWk4eU1pMXlaR1l0YzNsdWRHRjRMVzV6SXlJS0lDQWdlRzFzYm5NNmMzWm5QU0pvZEhSd09pOHZkM2QzTG5jekxtOXlaeTh5TURBd0wzTjJaeUlLSUNBZ2VHMXNibk05SW1oMGRIQTZMeTkzZDNjdWR6TXViM0puTHpJd01EQXZjM1puSWdvZ0lDQjRiV3h1Y3pwNGJHbHVhejBpYUhSMGNEb3ZMM2QzZHk1M015NXZjbWN2TVRrNU9TOTRiR2x1YXlJS0lDQWdlRzFzYm5NNmMyOWthWEJ2WkdrOUltaDBkSEE2THk5emIyUnBjRzlrYVM1emIzVnlZMlZtYjNKblpTNXVaWFF2UkZSRUwzTnZaR2x3YjJScExUQXVaSFJrSWdvZ0lDQjRiV3h1Y3pwcGJtdHpZMkZ3WlQwaWFIUjBjRG92TDNkM2R5NXBibXR6WTJGd1pTNXZjbWN2Ym1GdFpYTndZV05sY3k5cGJtdHpZMkZ3WlNJS0lDQWdkMmxrZEdnOUlqSXdNQ0lLSUNBZ2FHVnBaMmgwUFNJeE16QWlDaUFnSUhacFpYZENiM2c5SWpBZ01DQXlNREFnTVRNd0lnb2dJQ0JwWkQwaWMzWm5NaUlLSUNBZ2RtVnljMmx2YmowaU1TNHhJZ29nSUNCcGJtdHpZMkZ3WlRwMlpYSnphVzl1UFNJd0xqa3hJSEl4TXpjeU5TSUtJQ0FnYzI5a2FYQnZaR2s2Wkc5amJtRnRaVDBpUlhod2JHRnVZWEpwWVc1T1pYaDBRWEp5YjNjdWMzWm5JajRLSUNBOFpHVm1jejRLUEhKaFpHbGhiRWR5WVdScFpXNTBJR2xrUFNKaElpQmplRDBpTlRBd0lpQmplVDBpTmpJM0xqY3hJaUJ5UFNJeU5ESXVNelVpSUdkeVlXUnBaVzUwVkhKaGJuTm1iM0p0UFNKdFlYUnlhWGdvTUNBdU1qazNNRElnTFRNdU9ETTVNU0F0TVM0eE9UTXhaUzA0SURJME1EZ3VNU0E0TXpndU9EVXBJaUJuY21Ga2FXVnVkRlZ1YVhSelBTSjFjMlZ5VTNCaFkyVlBibFZ6WlNJK0NqeHpkRzl3SUhOMGIzQXRZMjlzYjNJOUlpTmlZemN6TVRraUlHOW1abk5sZEQwaU1DSXZQZ284YzNSdmNDQnpkRzl3TFdOdmJHOXlQU0lqWmpCa01qWXpJaUJ2Wm1aelpYUTlJakVpTHo0S1BDOXlZV1JwWVd4SGNtRmthV1Z1ZEQ0S1BDOWtaV1p6UGdvOGJXVjBZV1JoZEdFK0NqeHlaR1k2VWtSR1BnbzhZMk02VjI5eWF5QnlaR1k2WVdKdmRYUTlJaUkrQ2p4a1l6cG1iM0p0WVhRK2FXMWhaMlV2YzNabkszaHRiRHd2WkdNNlptOXliV0YwUGdvOFpHTTZkSGx3WlNCeVpHWTZjbVZ6YjNWeVkyVTlJbWgwZEhBNkx5OXdkWEpzTG05eVp5OWtZeTlrWTIxcGRIbHdaUzlUZEdsc2JFbHRZV2RsSWk4K0NqeGtZenAwYVhSc1pTOCtDand2WTJNNlYyOXlhejRLUEM5eVpHWTZVa1JHUGdvOEwyMWxkR0ZrWVhSaFBnbzhaeUIwY21GdWMyWnZjbTA5SW5SeVlXNXpiR0YwWlNnd0lDMDVNakl1TXpZcElqNEtQSEJoZEdnZ1pEMGliVEU1Tnk0ME55QTVPRGN1TXpaak1DMHlOQzR5T0RFdE9EY3VNall4TFRZeExqY3dPQzA0Tnk0eU5qRXROakV1TnpBNGRqSTVMalk1Tkd3dE1UTXVOVFl6SURBdU16YzVOR010TVRNdU5UWXpJREF1TXpjNU16a3ROakl1TWpBeUlESXVPREkzTVMwM05DNDRNVEVnTnk0NU5qVTNMVEV5TGpZd09TQTFMakV6T0RZdE1Ua3VNekF4SURFMExqWTVOUzB4T1M0ek1ERWdNak11TmpZNUlEQWdPQzQ1TnpNNElETXVPVGN6TlNBeE9DNHhOak1nTVRrdU16QXhJREl6TGpZMk9TQXhOUzR6TWpjZ05TNDFNRFUxSURZeExqSTBPQ0EzTGpVNE5qTWdOelF1T0RFeElEY3VPVFkxTjJ3eE15NDFOak1nTUM0ek56azBkakk1TGpZNU5ITTROeTR5TmpFdE16Y3VOREk0SURnM0xqSTJNUzAyTVM0M01EaDZJaUJtYVd4c1BTSjFjbXdvSTJFcElpQnpkSEp2YTJVOUlpTTNNelUxTTJRaUlITjBjbTlyWlMxM2FXUjBhRDBpTWk0Mk1qZzFJaTgrQ2p4bklIUnlZVzV6Wm05eWJUMGliV0YwY21sNEtEQWdMakkyTWpnMUlDMHVNall5T0RVZ01DQXhOemd1TVRNZ09EWXdMakF4S1NJZ2MzUnliMnRsUFNJak1EQXdJaUJ6ZEhKdmEyVXRkMmxrZEdnOUlqRXdJajRLUEdWc2JHbHdjMlVnWTNnOUlqVTBOeTR4TkNJZ1kzazlJakV5TUM0NU15SWdjbmc5SWpJMUxqY3hOQ0lnY25rOUlqVXhMalF5T1NJZ1ptbHNiRDBpSTJabVppSXZQZ284Wld4c2FYQnpaU0JqZUQwaU5UTTBMak0zSWlCamVUMGlNVEl6TGpVeklpQnllRDBpTVRJdU5qSTNJaUJ5ZVQwaU1qWXVNalkwSWk4K0Nqd3ZaejRLUEdjZ2RISmhibk5tYjNKdFBTSnRZWFJ5YVhnb01DQXRMakkyTWpnMUlDMHVNall5T0RVZ01DQXhOemd1TmpZZ01URXhOQzQzS1NJZ2MzUnliMnRsUFNJak1EQXdJaUJ6ZEhKdmEyVXRkMmxrZEdnOUlqRXdJajRLUEdWc2JHbHdjMlVnWTNnOUlqVTBOeTR4TkNJZ1kzazlJakV5TUM0NU15SWdjbmc5SWpJMUxqY3hOQ0lnY25rOUlqVXhMalF5T1NJZ1ptbHNiRDBpSTJabVppSXZQZ284Wld4c2FYQnpaU0JqZUQwaU5UTTBMak0zSWlCamVUMGlNVEl6TGpVeklpQnllRDBpTVRJdU5qSTNJaUJ5ZVQwaU1qWXVNalkwSWk4K0Nqd3ZaejRLUEM5blBnbzhMM04yWno0S1wiO1xuXG5leHBvcnQgZGVmYXVsdCBleHBsYW5hcmlhbkFycm93U1ZHO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qVGhpcyBjbGFzcyBpcyBzdXBwb3NlZCB0byB0dXJuIGEgc2VyaWVzIG9mXG5kaXIuZGVsYXkoKVxuZGlyLnRyYW5zaXRpb25UbyguLi4pXG5kaXIuZGVsYXkoKVxuZGlyLm5leHRTbGlkZSgpO1xuXG5pbnRvIGEgc2VxdWVuY2UgdGhhdCBvbmx5IGFkdmFuY2VzIHdoZW4gdGhlIHJpZ2h0IGFycm93IGlzIHByZXNzZWQuXG5cbkFueSBkaXZzIHdpdGggdGhlIGV4cC1zbGlkZSBjbGFzcyB3aWxsIGFsc28gYmUgc2hvd24gYW5kIGhpZGRlbiBvbmUgYnkgb25lLlxuXG5BbHNvLFxuXG4qL1xuXG5pbXBvcnQge0FuaW1hdGlvbiwgRWFzaW5nfSBmcm9tICcuL0FuaW1hdGlvbi5qcyc7XG5pbXBvcnQgZXhwbGFuYXJpYW5BcnJvd1NWRyBmcm9tICcuL0RpcmVjdG9ySW1hZ2VDb25zdGFudHMuanMnO1xuXG5jbGFzcyBEaXJlY3Rpb25BcnJvd3tcbiAgICBjb25zdHJ1Y3RvcihmYWNlUmlnaHQpe1xuICAgICAgICB0aGlzLmFycm93SW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLnNyYyA9IGV4cGxhbmFyaWFuQXJyb3dTVkc7XG5cbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3dcIik7XG5cbiAgICAgICAgZmFjZVJpZ2h0ID0gZmFjZVJpZ2h0PT09dW5kZWZpbmVkID8gdHJ1ZSA6IGZhY2VSaWdodDtcblxuICAgICAgICBpZihmYWNlUmlnaHQpe1xuICAgICAgICAgICAgdGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3ctcmlnaHRcIilcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICB0aGlzLmFycm93SW1hZ2UuY2xhc3NMaXN0LmFkZChcImV4cC1hcnJvdy1sZWZ0XCIpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLm9uY2xpY2sgPSAoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHRoaXMuaGlkZVNlbGYoKTtcbiAgICAgICAgICAgIHRoaXMub25jbGlja0NhbGxiYWNrKCk7XG4gICAgICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICAgICAgdGhpcy5vbmNsaWNrQ2FsbGJhY2sgPSBudWxsOyAvLyB0byBiZSBzZXQgZXh0ZXJuYWxseVxuICAgIH1cbiAgICBzaG93U2VsZigpe1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnO1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3R5bGUub3BhY2l0eSA9IDE7XG4gICAgICAgIFxuICAgIH1cbiAgICBoaWRlU2VsZigpe1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuICAgIH1cbn1cblxuXG5jbGFzcyBOb25EZWNyZWFzaW5nRGlyZWN0b3J7XG4gICAgLy9Vc2luZyBhIE5vbkRlY3JlYXNpbmdEaXJlY3RvciwgY3JlYXRlIEhUTUwgZWxlbWVudHMgd2l0aCB0aGUgJ2V4cC1zbGlkZScgY2xhc3MuXG4gICAgLy9UaGUgZmlyc3QgSFRNTCBlbGVtZW50IHdpdGggdGhlICdleHAtc2xpZGUnIGNsYXNzIHdpbGwgYmUgc2hvd24gZmlyc3QuIFdoZW4gdGhlIG5leHQgc2xpZGUgYnV0dG9uIGlzIGNsaWNrZWQsIHRoYXQgd2lsbCBmYWRlIG91dCBhbmQgYmUgcmVwbGFjZWQgd2l0aCB0aGUgbmV4dCBlbGVtZW50IHdpdGggdGhlIGV4cC1zbGlkZSBjbGFzcywgaW4gb3JkZXIgb2YgSFRNTC5cbiAgICAvL0lmIHlvdSB3YW50IHRvIGRpc3BsYXkgbXVsdGlwbGUgSFRNTCBlbGVtZW50cyBhdCB0aGUgc2FtZSB0aW1lLCAnZXhwLXNsaWRlLTxuPicgd2lsbCBhbHNvIGJlIGRpc3BsYXllZCB3aGVuIHRoZSBwcmVzZW50YXRpb24gaXMgY3VycmVudGx5IG9uIHNsaWRlIG51bWJlciBuLiBGb3IgZXhhbXBsZSwgZXZlcnl0aGluZyBpbiB0aGUgZXhwLXNsaWRlLTEgY2xhc3Mgd2lsbCBiZSB2aXNpYmxlIGZyb20gdGhlIHN0YXJ0LCBhbmQgdGhlbiBleHAtc2xpZGUtMiwgYW5kIHNvIG9uLlxuICAgIC8vRG9uJ3QgZ2l2ZSBhbiBlbGVtZW50IGJvdGggdGhlIGV4cC1zbGlkZSBhbmQgZXhwLXNsaWRlLW4gY2xhc3Nlcy4gXG5cbiAgICAvLyBJIHdhbnQgRGlyZWN0b3IoKSB0byBiZSBhYmxlIHRvIGJhY2t0cmFjayBieSBwcmVzc2luZyBiYWNrd2FyZHMuIFRoaXMgZG9lc24ndCBkbyB0aGF0LlxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuICAgICAgICB0aGlzLnNsaWRlcyA9IFtdO1xuICAgICAgICB0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID0gMDsgICAgICAgIFxuICAgICAgICB0aGlzLm51bVNsaWRlcyA9IDA7XG4gICAgICAgIHRoaXMubnVtSFRNTFNsaWRlcyA9IDA7XG5cbiAgICAgICAgdGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBudWxsO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgXG5cblxuICAgIGFzeW5jIGJlZ2luKCl7XG4gICAgICAgIGF3YWl0IHRoaXMud2FpdEZvclBhZ2VMb2FkKCk7XG5cbiAgICAgICAgdGhpcy5zZXR1cEFuZEhpZGVBbGxTbGlkZUhUTUxFbGVtZW50cygpO1xuXG4gICAgICAgIHRoaXMuc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleCgwKTsgLy91bmhpZGUgZmlyc3Qgb25lXG5cbiAgICAgICAgdGhpcy5zZXR1cENsaWNrYWJsZXMoKTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBzZXR1cEFuZEhpZGVBbGxTbGlkZUhUTUxFbGVtZW50cygpe1xuXG4gICAgICAgIHRoaXMuc2xpZGVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZVwiKTtcbiAgICAgICAgdGhpcy5udW1IVE1MU2xpZGVzID0gdGhpcy5zbGlkZXMubGVuZ3RoO1xuXG4gICAgICAgIC8vaGlkZSBhbGwgc2xpZGVzIGV4Y2VwdCBmaXJzdCBvbmVcbiAgICAgICAgZm9yKHZhciBpPTA7aTx0aGlzLm51bUhUTUxTbGlkZXM7aSsrKXtcbiAgICAgICAgICAgIHRoaXMuc2xpZGVzW2ldLnN0eWxlLm9wYWNpdHkgPSAwO1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbaV0uc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgICAgICAgICAgIHRoaXMuc2xpZGVzW2ldLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7Ly9vcGFjaXR5PTAgYWxvbmUgd29uJ3QgYmUgaW5zdGFudCBiZWNhdXNlIG9mIHRoZSAxcyBDU1MgdHJhbnNpdGlvblxuICAgICAgICB9XG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgLy9ub3cgaGFuZGxlIGV4cC1zbGlkZS08bj5cbiAgICAgICAgbGV0IGFsbFNwZWNpZmljU2xpZGVFbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tjbGFzcyo9XCJleHAtc2xpZGUtXCJdJyk7IC8vdGhpcyBpcyBhIENTUyBhdHRyaWJ1dGUgc2VsZWN0b3IsIGFuZCBJIGhhdGUgdGhhdCB0aGlzIGV4aXN0cy4gaXQncyBzbyB1Z2x5XG4gICAgICAgIGZvcih2YXIgaT0wO2k8YWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgYWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzW2ldLnN0eWxlLm9wYWNpdHkgPSAwOyBcbiAgICAgICAgICAgIGFsbFNwZWNpZmljU2xpZGVFbGVtZW50c1tpXS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuICAgICAgICAgICAgYWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzW2ldLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7Ly9vcGFjaXR5PTAgYWxvbmUgd29uJ3QgYmUgaW5zdGFudCBiZWNhdXNlIG9mIHRoZSAxcyBDU1MgdHJhbnNpdGlvblxuICAgICAgICB9XG5cbiAgICAgICAgLy91bmRvIHNldHRpbmcgZGlzcGxheS1ub25lIGFmdGVyIGEgYml0IG9mIHRpbWVcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGZvcih2YXIgaT0wO2k8c2VsZi5zbGlkZXMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICAgICAgc2VsZi5zbGlkZXNbaV0uc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yKHZhciBpPTA7aTxhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICAgICAgYWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzW2ldLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwxKTtcblxuICAgIH1cblxuICAgIHNldHVwQ2xpY2thYmxlcygpe1xuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5yaWdodEFycm93ID0gbmV3IERpcmVjdGlvbkFycm93KCk7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yaWdodEFycm93LmFycm93SW1hZ2UpO1xuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cub25jbGlja0NhbGxiYWNrID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHNlbGYuX2NoYW5nZVNsaWRlKDEsIGZ1bmN0aW9uKCl7fSk7IC8vIHRoaXMgZXJyb3JzIHdpdGhvdXQgdGhlIGVtcHR5IGZ1bmN0aW9uIGJlY2F1c2UgdGhlcmUncyBubyByZXNvbHZlLiBUaGVyZSBtdXN0IGJlIGEgYmV0dGVyIHdheSB0byBkbyB0aGluZ3MuXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJXQVJOSU5HOiBIb3JyaWJsZSBoYWNrIGluIGVmZmVjdCB0byBjaGFuZ2Ugc2xpZGVzLiBQbGVhc2UgcmVwbGFjZSB0aGUgcGFzcy1hbi1lbXB0eS1mdW5jdGlvbiB0aGluZyB3aXRoIHNvbWV0aGluZyB0aGF0IGFjdHVhbGx5IHJlc29sdmVzIHByb3Blcmx5IGFuZCBkb2VzIGFzeW5jLlwiKVxuICAgICAgICAgICAgc2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24oKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgYXN5bmMgd2FpdEZvclBhZ2VMb2FkKCl7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgICAgICAgaWYoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PSAnY29tcGxldGUnKXtcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIixyZXNvbHZlKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGFzeW5jIG5leHRTbGlkZSgpe1xuICAgICAgICBpZighdGhpcy5pbml0aWFsaXplZCl0aHJvdyBuZXcgRXJyb3IoXCJFUlJPUjogVXNlIC5iZWdpbigpIG9uIGEgRGlyZWN0b3IgYmVmb3JlIGNhbGxpbmcgYW55IG90aGVyIG1ldGhvZHMhXCIpO1xuXG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cuc2hvd1NlbGYoKTtcbiAgICAgICAgLy9wcm9taXNlIGlzIHJlc29sdmVkIGJ5IGNhbGxpbmcgdGhpcy5uZXh0U2xpZGVQcm9taXNlLnJlc29sdmUoKSB3aGVuIHRoZSB0aW1lIGNvbWVzXG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICBmdW5jdGlvbiBrZXlMaXN0ZW5lcihlKXtcbiAgICAgICAgICAgICAgICBpZihlLnJlcGVhdClyZXR1cm47IC8va2V5ZG93biBmaXJlcyBtdWx0aXBsZSB0aW1lcyBidXQgd2Ugb25seSB3YW50IHRoZSBmaXJzdCBvbmVcbiAgICAgICAgICAgICAgICBsZXQgc2xpZGVEZWx0YSA9IDA7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChlLmtleUNvZGUpIHtcbiAgICAgICAgICAgICAgICAgIGNhc2UgMzQ6XG4gICAgICAgICAgICAgICAgICBjYXNlIDM5OlxuICAgICAgICAgICAgICAgICAgY2FzZSA0MDpcbiAgICAgICAgICAgICAgICAgICAgc2xpZGVEZWx0YSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmKHNsaWRlRGVsdGEgIT0gMCl7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnJpZ2h0QXJyb3cuaGlkZVNlbGYoKTtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsa2V5TGlzdGVuZXIpOyAvL3RoaXMgYXBwcm9hY2ggdGFrZW4gZnJvbSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNTcxODY0NS9yZXNvbHZpbmctYS1wcm9taXNlLXdpdGgtZXZlbnRsaXN0ZW5lclxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGtleUxpc3RlbmVyKTtcbiAgICAgICAgICAgIC8vaG9ycmlibGUgaGFjayBzbyB0aGF0IHRoZSAnbmV4dCBzbGlkZScgYXJyb3cgY2FuIHRyaWdnZXIgdGhpcyB0b29cbiAgICAgICAgICAgIHNlbGYubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gZnVuY3Rpb24oKXsgXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLGtleUxpc3RlbmVyKTsgXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBfY2hhbmdlU2xpZGUoc2xpZGVEZWx0YSwgcmVzb2x2ZSl7XG4gICAgICAgIC8vc2xpZGUgY2hhbmdpbmcgbG9naWNcbiAgICAgICAgaWYoc2xpZGVEZWx0YSAhPSAwKXtcbiAgICAgICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gMCAmJiBzbGlkZURlbHRhID09IC0xKXtcbiAgICAgICAgICAgICAgICByZXR1cm47IC8vbm8gZ29pbmcgcGFzdCB0aGUgYmVnaW5uaW5nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IHRoaXMubnVtSFRNTFNsaWRlcy0xICYmIHNsaWRlRGVsdGEgPT0gMSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuOyAvL25vIGdvaW5nIHBhc3QgdGhlIGVuZFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgodGhpcy5jdXJyZW50U2xpZGVJbmRleCArIHNsaWRlRGVsdGEpO1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleChzbGlkZU51bWJlcil7XG4gICAgICAgIC8vdXBkYXRlcyBIVE1MIGFuZCBhbHNvIHNldHMgdGhpcy5jdXJyZW50U2xpZGVJbmRleCB0byBzbGlkZU51bWJlclxuXG4gICAgICAgIGxldCBwcmV2U2xpZGVOdW1iZXIgPSB0aGlzLmN1cnJlbnRTbGlkZUluZGV4O1xuICAgICAgICB0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID0gc2xpZGVOdW1iZXI7XG5cblxuICAgICAgICAvL2hpZGUgdGhlIEhUTUwgZWxlbWVudHMgZm9yIHRoZSBwcmV2aW91cyBzbGlkZVxuXG4gICAgICAgIC8vaXRlbXMgd2l0aCBjbGFzcyBleHAtc2xpZGVcbiAgICAgICAgaWYocHJldlNsaWRlTnVtYmVyIDwgdGhpcy5zbGlkZXMubGVuZ3RoKXtcbiAgICAgICAgICAgIHRoaXMuc2xpZGVzW3ByZXZTbGlkZU51bWJlcl0uc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1twcmV2U2xpZGVOdW1iZXJdLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vaXRlbXMgd2l0aCBIVE1MIGNsYXNzIGV4cC1zbGlkZS1uXG4gICAgICAgIGxldCBwcmV2U2xpZGVFbGVtcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJleHAtc2xpZGUtXCIrKHByZXZTbGlkZU51bWJlcisxKSlcbiAgICAgICAgZm9yKHZhciBpPTA7aTxwcmV2U2xpZGVFbGVtcy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIHByZXZTbGlkZUVsZW1zW2ldLnN0eWxlLm9wYWNpdHkgPSAwO1xuICAgICAgICAgICAgcHJldlNsaWRlRWxlbXNbaV0uc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy9zaG93IHRoZSBIVE1MIGVsZW1lbnRzIGZvciB0aGUgY3VycmVudCBzbGlkZVxuICBcbiAgICAgICAgXG4gICAgICAgIC8vaXRlbXMgd2l0aCBIVE1MIGNsYXNzIGV4cC1zbGlkZS1uXG4gICAgICAgIGxldCBlbGVtc1RvRGlzcGxheU9ubHlPblRoaXNTbGlkZSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJleHAtc2xpZGUtXCIrKHNsaWRlTnVtYmVyKzEpKTtcblxuICAgICAgICBpZihzbGlkZU51bWJlciA+PSB0aGlzLm51bUhUTUxTbGlkZXMgJiYgZWxlbXNUb0Rpc3BsYXlPbmx5T25UaGlzU2xpZGUubGVuZ3RoID09IDApe1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlRyaWVkIHRvIHNob3cgc2xpZGUgI1wiK3NsaWRlTnVtYmVyK1wiLCBidXQgb25seSBcIiArIHRoaXMubnVtSFRNTFNsaWRlcyArIFwiSFRNTCBlbGVtZW50cyB3aXRoIGV4cC1zbGlkZSB3ZXJlIGZvdW5kISBNYWtlIG1vcmUgc2xpZGVzP1wiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvcih2YXIgaT0wO2k8ZWxlbXNUb0Rpc3BsYXlPbmx5T25UaGlzU2xpZGUubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICBlbGVtc1RvRGlzcGxheU9ubHlPblRoaXNTbGlkZVtpXS5zdHlsZS5vcGFjaXR5ID0gMTtcbiAgICAgICAgICAgIGVsZW1zVG9EaXNwbGF5T25seU9uVGhpc1NsaWRlW2ldLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnYWxsJztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vaXRlbXMgd2l0aCBjbGFzcyBleHAtc2xpZGVcbiAgICAgICAgaWYoc2xpZGVOdW1iZXIgPCB0aGlzLnNsaWRlcy5sZW5ndGgpe1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbc2xpZGVOdW1iZXJdLnN0eWxlLm9wYWNpdHkgPSAxO1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbc2xpZGVOdW1iZXJdLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnYWxsJztcbiAgICAgICAgICAgIHRoaXMuc2Nyb2xsVXBUb1RvcE9mQ29udGFpbmVyKHRoaXMuc2xpZGVzW3NsaWRlTnVtYmVyXSk7XG4gICAgICAgIH1cblxuICAgIH1cbiAgICBzY3JvbGxVcFRvVG9wT2ZDb250YWluZXIoZWxlbWVudCl7XG4gICAgICAgIHRoaXMuZ2V0U2Nyb2xsUGFyZW50KGVsZW1lbnQpLnNjcm9sbFRvcCA9IDA7XG4gICAgfVxuICAgIGdldFNjcm9sbFBhcmVudChlbGVtZW50LCBpbmNsdWRlSGlkZGVuKXtcbiAgICAgICAgLy9mcm9tIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM1OTM5ODg2L2ZpbmQtZmlyc3Qtc2Nyb2xsYWJsZS1wYXJlbnRcbiAgICAgICAgdmFyIHN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KTtcbiAgICAgICAgdmFyIGV4Y2x1ZGVTdGF0aWNQYXJlbnQgPSBzdHlsZS5wb3NpdGlvbiA9PT0gXCJhYnNvbHV0ZVwiO1xuICAgICAgICB2YXIgb3ZlcmZsb3dSZWdleCA9IGluY2x1ZGVIaWRkZW4gPyAvKGF1dG98c2Nyb2xsfGhpZGRlbikvIDogLyhhdXRvfHNjcm9sbCkvO1xuICAgICAgICBpZiAoc3R5bGUucG9zaXRpb24gPT09IFwiZml4ZWRcIikgcmV0dXJuIGRvY3VtZW50LmJvZHk7XG4gICAgICAgIGZvciAodmFyIHBhcmVudCA9IGVsZW1lbnQ7IChwYXJlbnQgPSBwYXJlbnQucGFyZW50RWxlbWVudCk7KSB7XG4gICAgICAgICAgICBzdHlsZSA9IGdldENvbXB1dGVkU3R5bGUocGFyZW50KTtcbiAgICAgICAgICAgIGlmIChleGNsdWRlU3RhdGljUGFyZW50ICYmIHN0eWxlLnBvc2l0aW9uID09PSBcInN0YXRpY1wiKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAob3ZlcmZsb3dSZWdleC50ZXN0KHN0eWxlLm92ZXJmbG93ICsgc3R5bGUub3ZlcmZsb3dZICsgc3R5bGUub3ZlcmZsb3dYKSkgcmV0dXJuIHBhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZG9jdW1lbnQuYm9keTtcbiAgICB9XG5cbiAgICAvL3ZlcmJzXG4gICAgYXN5bmMgX3NsZWVwKHdhaXRUaW1lKXtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCB3YWl0VGltZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBhc3luYyBkZWxheSh3YWl0VGltZSl7XG4gICAgICAgIHJldHVybiB0aGlzLl9zbGVlcCh3YWl0VGltZSk7XG4gICAgfVxuICAgIFRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TLCBvcHRpb25hbEFyZ3VtZW50cyl7XG4gICAgICAgIC8vaWYgc29tZW9uZSdzIHVzaW5nIHRoZSBvbGQgY2FsbGluZyBzdHJhdGVneSBvZiBzdGFnZ2VyRnJhY3Rpb24gYXMgdGhlIGxhc3QgYXJndW1lbnQsIGNvbnZlcnQgaXQgcHJvcGVybHlcbiAgICAgICAgaWYob3B0aW9uYWxBcmd1bWVudHMgJiYgVXRpbHMuaXNOdW1iZXIob3B0aW9uYWxBcmd1bWVudHMpKXtcbiAgICAgICAgICAgIG9wdGlvbmFsQXJndW1lbnRzID0ge3N0YWdnZXJGcmFjdGlvbjogb3B0aW9uYWxBcmd1bWVudHN9O1xuICAgICAgICB9XG4gICAgICAgIG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwLCBzdGFnZ2VyRnJhY3Rpb249c3RhZ2dlckZyYWN0aW9uLCBvcHRpb25hbEFyZ3VtZW50cyk7XG4gICAgfVxufVxuXG5cblxuXG5cbmNvbnN0IEZPUldBUkRTID0gKFwiZm9yd2FyZHNcIik7XG5jb25zdCBCQUNLV0FSRFMgPSAoXCJiYWNrd2FyZHNcIik7XG5jb25zdCBOT19TTElERV9NT1ZFTUVOVCA9IChcIm5vdCB0aW1lIHRyYXZlbGluZ1wiKTtcblxuY2xhc3MgVW5kb0NhcGFibGVEaXJlY3RvciBleHRlbmRzIE5vbkRlY3JlYXNpbmdEaXJlY3RvcntcbiAgICAvL3Roc2kgZGlyZWN0b3IgdXNlcyBib3RoIGZvcndhcmRzIGFuZCBiYWNrd2FyZHMgYXJyb3dzLiB0aGUgYmFja3dhcmRzIGFycm93IHdpbGwgdW5kbyBhbnkgVW5kb0NhcGFibGVEaXJlY3Rvci5UcmFuc2l0aW9uVG8oKXNcbiAgICAvL3RvZG86IGhvb2sgdXAgdGhlIGFycm93cyBhbmQgbWFrZSBpdCBub3RcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKXtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAgICAgdGhpcy5mdXJ0aGVzdFNsaWRlSW5kZXggPSAwOyAvL21hdGNoZXMgdGhlIG51bWJlciBvZiB0aW1lcyBuZXh0U2xpZGUoKSBoYXMgYmVlbiBjYWxsZWRcbiAgICAgICAgLy90aGlzLmN1cnJlbnRTbGlkZUluZGV4IGlzIGFsd2F5cyA8IHRoaXMuZnVydGhlc3RTbGlkZUluZGV4IC0gaWYgZXF1YWwsIHdlIHJlbGVhc2UgdGhlIHByb21pc2UgYW5kIGxldCBuZXh0U2xpZGUoKSByZXR1cm5cblxuICAgICAgICB0aGlzLnVuZG9TdGFjayA9IFtdO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ID0gLTE7IC8vaW5jcmVhc2VkIGJ5IG9uZSBldmVyeSB0aW1lIGVpdGhlciB0aGlzLlRyYW5zaXRpb25UbyBpcyBjYWxsZWQgb3IgdGhpcy5uZXh0U2xpZGUoKSBpcyBjYWxsZWRcblxuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID0gTk9fU0xJREVfTU9WRU1FTlQ7IC8vdGhpcyB2YXJpYWJsZSBpcyB1c2VkIHRvIGVuc3VyZSB0aGF0IGlmIHlvdSByZWRvLCB0aGVuIHVuZG8gaGFsZndheSB0aHJvdWdoIHRoZSByZWRvLCB0aGUgcmVkbyBlbmRzIHVwIGNhbmNlbGxlZC4gXG4gICAgICAgIHRoaXMubnVtQXJyb3dQcmVzc2VzID0gMDtcblxuICAgICAgICAvL2lmIHlvdSBwcmVzcyByaWdodCBiZWZvcmUgdGhlIGZpcnN0IGRpcmVjdG9yLm5leHRTbGlkZSgpLCBkb24ndCBlcnJvclxuICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IGZ1bmN0aW9uKCl7fSBcblxuICAgICAgICBmdW5jdGlvbiBrZXlMaXN0ZW5lcihlKXtcbiAgICAgICAgICAgIGlmKGUucmVwZWF0KXJldHVybjsgLy9rZXlkb3duIGZpcmVzIG11bHRpcGxlIHRpbWVzIGJ1dCB3ZSBvbmx5IHdhbnQgdGhlIGZpcnN0IG9uZVxuICAgICAgICAgICAgbGV0IHNsaWRlRGVsdGEgPSAwO1xuICAgICAgICAgICAgc3dpdGNoIChlLmtleUNvZGUpIHtcbiAgICAgICAgICAgICAgY2FzZSAzNDpcbiAgICAgICAgICAgICAgY2FzZSAzOTpcbiAgICAgICAgICAgICAgY2FzZSA0MDpcbiAgICAgICAgICAgICAgICBzZWxmLmhhbmRsZUZvcndhcmRzUHJlc3MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAzMzpcbiAgICAgICAgICAgICAgY2FzZSAzNzpcbiAgICAgICAgICAgICAgY2FzZSAzODpcbiAgICAgICAgICAgICAgICBzZWxmLmhhbmRsZUJhY2t3YXJkc1ByZXNzKCk7XG4gICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwga2V5TGlzdGVuZXIpO1xuICAgIH1cblxuICAgIHNldHVwQ2xpY2thYmxlcygpe1xuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5sZWZ0QXJyb3cgPSBuZXcgRGlyZWN0aW9uQXJyb3coZmFsc2UpO1xuICAgICAgICB0aGlzLmxlZnRBcnJvdy5oaWRlU2VsZigpO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMubGVmdEFycm93LmFycm93SW1hZ2UpO1xuICAgICAgICB0aGlzLmxlZnRBcnJvdy5vbmNsaWNrQ2FsbGJhY2sgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgc2VsZi5oYW5kbGVCYWNrd2FyZHNQcmVzcygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yaWdodEFycm93ID0gbmV3IERpcmVjdGlvbkFycm93KHRydWUpO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMucmlnaHRBcnJvdy5hcnJvd0ltYWdlKTtcbiAgICAgICAgdGhpcy5yaWdodEFycm93Lm9uY2xpY2tDYWxsYmFjayA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBzZWxmLmhhbmRsZUZvcndhcmRzUHJlc3MoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1vdmVGdXJ0aGVySW50b1ByZXNlbnRhdGlvbigpe1xuICAgICAgICAgICAgLy9pZiB0aGVyZSdzIG5vdGhpbmcgdG8gcmVkbywgKHNvIHdlJ3JlIG5vdCBpbiB0aGUgcGFzdCBvZiB0aGUgdW5kbyBzdGFjayksIGFkdmFuY2UgZnVydGhlci5cbiAgICAgICAgICAgIC8vaWYgdGhlcmUgYXJlIGxlc3MgSFRNTCBzbGlkZXMgdGhhbiBjYWxscyB0byBkaXJlY3Rvci5uZXdTbGlkZSgpLCBjb21wbGFpbiBpbiB0aGUgY29uc29sZSBidXQgYWxsb3cgdGhlIHByZXNlbnRhdGlvbiB0byBwcm9jZWVkXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIk1vdmluZyBmdXJ0aGVyIGludG8gcHJlc2VudGF0aW9uIVwiKTtcbiAgICAgICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPCB0aGlzLm51bVNsaWRlcyl7XG4gICAgICAgICAgICAgICAgdGhpcy5mdXJ0aGVzdFNsaWRlSW5kZXggKz0gMTsgXG5cbiAgICAgICAgICAgICAgICB0aGlzLnN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgodGhpcy5jdXJyZW50U2xpZGVJbmRleCArIDEpOyAvL3RoaXMgd2lsbCBjb21wbGFpbiBpbiB0aGUgY29uc29sZSB3aW5kb3cgaWYgdGhlcmUgYXJlIGxlc3Mgc2xpZGVzIHRoYW4gbmV3U2xpZGUoKSBjYWxsc1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Fycm93cygpOyAvL3Nob3dBcnJvd3MgbXVzdCBjb21lIGFmdGVyIHRoaXMuY3VycmVudFNsaWRlSW5kZXggYWR2YW5jZXMgb3IgZWxzZSB3ZSB3b24ndCBiZSBhYmxlIHRvIHRlbGwgaWYgd2UncmUgYXQgdGhlIGVuZCBvciBub3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uKCk7IC8vYWxsb3cgcHJlc2VudGF0aW9uIGNvZGUgdG8gcHJvY2VlZFxuICAgIH1cbiAgICBpc0NhdWdodFVwV2l0aE5vdGhpbmdUb1JlZG8oKXtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5kb1N0YWNrSW5kZXggPT0gdGhpcy51bmRvU3RhY2subGVuZ3RoLTE7XG4gICAgfVxuXG4gICAgYXN5bmMgaGFuZGxlRm9yd2FyZHNQcmVzcygpe1xuXG4gICAgICAgIC8vaWYgdGhlcmUncyBub3RoaW5nIHRvIHJlZG8sIHNob3cgdGhlIG5leHQgc2xpZGVcbiAgICAgICAgaWYodGhpcy5pc0NhdWdodFVwV2l0aE5vdGhpbmdUb1JlZG8oKSl7XG4gICAgICAgICAgICB0aGlzLm1vdmVGdXJ0aGVySW50b1ByZXNlbnRhdGlvbigpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgd2UgZ2V0IHRvIGhlcmUsIHdlJ3ZlIHByZXZpb3VzbHkgZG9uZSBhbiB1bmRvLCBhbmQgd2UncmUgaW4gdGhlIHBhc3QuIFdlIG5lZWQgdG8gY2F0Y2ggdXAgYW5kIHJlZG8gYWxsIHRob3NlIGl0ZW1zXG5cbiAgICAgICAgLy9vbmx5IHJlZG8gaWYgd2UncmUgbm90IGFscmVhZHkgcmVkb2luZ1xuICAgICAgICAvL3RvZG86IGFkZCBhbiBpbnB1dCBidWZmZXIgaW5zdGVhZCBvZiBkaXNjYXJkaW5nIHRoZW1cbiAgICAgICAgaWYodGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID09IEZPUldBUkRTKXJldHVybjtcbiAgICAgICAgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID0gRk9SV0FSRFM7XG5cbiAgICAgICAgdGhpcy5yaWdodEFycm93LmhpZGVTZWxmKCk7XG5cbiAgICAgICAgdGhpcy5udW1BcnJvd1ByZXNzZXMgKz0gMTtcbiAgICAgICAgbGV0IG51bUFycm93UHJlc3NlcyA9IHRoaXMubnVtQXJyb3dQcmVzc2VzO1xuXG4gICAgICAgIC8vYWR2YW5jZSBwYXN0IHRoZSBjdXJyZW50IE5ld1NsaWRlVW5kb0l0ZW0gd2UncmUgcHJlc3VtYWJseSBwYXVzZWQgb25cblxuICAgICAgICBpZih0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XS5jb25zdHJ1Y3RvciA9PT0gTmV3U2xpZGVVbmRvSXRlbSl7XG4gICAgICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ICs9IDE7XG4gICAgICAgIH1cblxuICAgICAgICAvL2NoYW5nZSBIVE1MIHNsaWRlIGZpcnN0IHNvIHRoYXQgaWYgdGhlcmUgYXJlIGFueSBkZWxheXMgdG8gdW5kbywgdGhleSBkb24ndCBzbG93IGRvd24gdGhlIHNsaWRlXG4gICAgICAgIHRoaXMuc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleCh0aGlzLmN1cnJlbnRTbGlkZUluZGV4ICsgMSk7XG4gICAgICAgIHRoaXMuc2hvd0Fycm93cygpO1xuICAgICAgICBjb25zb2xlLmxvZyhgU3RhcnRpbmcgYXJyb3cgcHJlc3MgZm9yd2FyZHMgIyR7bnVtQXJyb3dQcmVzc2VzfWApO1xuXG4gICAgICAgIHdoaWxlKHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdLmNvbnN0cnVjdG9yICE9PSBOZXdTbGlkZVVuZG9JdGVtKXtcbiAgICAgICAgICAgIC8vbG9vcCB0aHJvdWdoIHVuZG8gc3RhY2sgYW5kIHJlZG8gZWFjaCB1bmRvIHVudGlsIHdlIGdldCB0byB0aGUgbmV4dCBzbGlkZVxuXG5cbiAgICAgICAgICAgIGxldCByZWRvSXRlbSA9IHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlZG9Bbkl0ZW0ocmVkb0l0ZW0pO1xuXG4gICAgICAgICAgICAvL0lmIHRoZXJlJ3MgYSBkZWxheSBzb21ld2hlcmUgaW4gdGhlIHVuZG8gc3RhY2ssIGFuZCB3ZSBzbGVlcCBmb3Igc29tZSBhbW91bnQgb2YgdGltZSwgdGhlIHVzZXIgbWlnaHQgaGF2ZSBwcmVzc2VkIHVuZG8gZHVyaW5nIHRoYXQgdGltZS4gSW4gdGhhdCBjYXNlLCBoYW5kbGVCYWNrd2FyZHNQcmVzcygpIHdpbGwgc2V0IHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiB0byBCQUNLV0FSRFMuIEJ1dCB3ZSdyZSBzdGlsbCBydW5uaW5nLCBzbyB3ZSBzaG91bGQgc3RvcCByZWRvaW5nIVxuICAgICAgICAgICAgaWYodGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uICE9IEZPUldBUkRTIHx8IG51bUFycm93UHJlc3NlcyAhPSB0aGlzLm51bUFycm93UHJlc3Nlcyl7XG4gICAgICAgICAgICAgICAgLy90aGlzIGZ1bmN0aW9uIGhhcyBiZWVuIHByZWVtcHRlZCBieSBhbm90aGVyIGFycm93IHByZXNzXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYGZvcndhcmRzIGhhcyBiZWVuIHByZWVtcHRlZDogdGhpcyBpcyAke251bUFycm93UHJlc3Nlc30sIGJ1dCB0aGVyZSdzIGFub3RoZXIgd2l0aCAke3RoaXMubnVtQXJyb3dQcmVzc2VzfSwke3RoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbn1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPT0gdGhpcy51bmRvU3RhY2subGVuZ3RoLTEpe1xuICAgICAgICAgICAgICAgIC8vd2UndmUgbm93IGZ1bGx5IGNhdWdodCB1cC5cblxuICAgICAgICAgICAgICAgIC8vaWYgdGhlIGN1cnJlbnQgdW5kb0l0ZW0gaXNuJ3QgYSBOZXdTbGlkZVVuZG9JdGVtLCBidXQgd2UgZG8gaGF2ZSBhIG5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiAobWVhbmluZyB0aGUgbWFpbiB1c2VyIGNvZGUgaXMgd2FpdGluZyBvbiB0aGlzIHRvIGFjdGl2YXRlKSBhbGxvdyBwcmVzZW50YXRpb24gY29kZSB0byBwcm9jZWVkXG4gICAgICAgICAgICAgICAgaWYodGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24pe1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCArPSAxO1xuXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID0gTk9fU0xJREVfTU9WRU1FTlQ7XG4gICAgfVxuXG4gICAgYXN5bmMgcmVkb0FuSXRlbShyZWRvSXRlbSl7XG4gICAgICAgIHN3aXRjaChyZWRvSXRlbS50eXBlKXtcbiAgICAgICAgICAgIGNhc2UgREVMQVk6XG4gICAgICAgICAgICAgICAgLy9rZWVwIGluIG1pbmQgZHVyaW5nIHRoaXMgZGVsYXkgcGVyaW9kLCB0aGUgdXNlciBtaWdodCBwdXNoIHRoZSBsZWZ0IGFycm93IGtleS4gSWYgdGhhdCBoYXBwZW5zLCB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gd2lsbCBiZSBERUNSRUFTSU5HLCBzbyBoYW5kbGVGb3J3YXJkc1ByZXNzKCkgd2lsbCBxdWl0XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5fc2xlZXAocmVkb0l0ZW0ud2FpdFRpbWUpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBUUkFOU0lUSU9OVE86XG4gICAgICAgICAgICAgICAgdmFyIHJlZG9BbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKHJlZG9JdGVtLnRhcmdldCwgcmVkb0l0ZW0udG9WYWx1ZXMsIHJlZG9JdGVtLmR1cmF0aW9uLCByZWRvSXRlbS5vcHRpb25hbEFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgIC8vYW5kIG5vdyByZWRvQW5pbWF0aW9uLCBoYXZpbmcgYmVlbiBjcmVhdGVkLCBnb2VzIG9mZiBhbmQgZG9lcyBpdHMgb3duIHRoaW5nIEkgZ3Vlc3MuIHRoaXMgc2VlbXMgaW5lZmZpY2llbnQuIHRvZG86IGZpeCB0aGF0IGFuZCBtYWtlIHRoZW0gYWxsIGNlbnRyYWxseSB1cGRhdGVkIGJ5IHRoZSBhbmltYXRpb24gbG9vcCBvcnNvbWV0aGluZ1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBORVdTTElERTpcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBoYW5kbGVCYWNrd2FyZHNQcmVzcygpe1xuXG4gICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPT0gMCB8fCB0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IDApe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9vbmx5IHVuZG8gaWYgd2UncmUgbm90IGFscmVhZHkgdW5kb2luZ1xuICAgICAgICBpZih0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPT0gQkFDS1dBUkRTKXJldHVybjtcbiAgICAgICAgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID0gQkFDS1dBUkRTO1xuXG4gICAgICAgIHRoaXMubGVmdEFycm93LmhpZGVTZWxmKCk7XG5cbiAgICAgICAgdGhpcy5udW1BcnJvd1ByZXNzZXMgKz0gMTtcbiAgICAgICAgbGV0IG51bUFycm93UHJlc3NlcyA9IHRoaXMubnVtQXJyb3dQcmVzc2VzO1xuXG4gICAgICAgIC8vYWR2YW5jZSBiZWhpbmQgdGhlIGN1cnJlbnQgTmV3U2xpZGVVbmRvSXRlbSB3ZSdyZSBwcmVzdW1hYmx5IHBhdXNlZCBvblxuICAgICAgICBpZih0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XS5jb25zdHJ1Y3RvciA9PT0gTmV3U2xpZGVVbmRvSXRlbSl7XG4gICAgICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4IC09IDE7XG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vY2hhbmdlIEhUTUwgc2xpZGUgZmlyc3Qgc28gdGhhdCBpZiB0aGVyZSBhcmUgYW55IGRlbGF5cyB0byB1bmRvLCB0aGV5IGRvbid0IHNsb3cgZG93biB0aGUgc2xpZGVcbiAgICAgICAgdGhpcy5zd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KHRoaXMuY3VycmVudFNsaWRlSW5kZXggLSAxKTtcbiAgICAgICAgdGhpcy5zaG93QXJyb3dzKCk7XG5cbiAgICAgICAgd2hpbGUodGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF0uY29uc3RydWN0b3IgIT09IE5ld1NsaWRlVW5kb0l0ZW0pe1xuICAgICAgICAgICAgLy9sb29wIHRocm91Z2ggdW5kbyBzdGFjayBhbmQgdW5kbyBlYWNoIGl0ZW0gdW50aWwgd2UgcmVhY2ggdGhlIHByZXZpb3VzIHNsaWRlXG5cbiAgICAgICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPT0gMCl7XG4gICAgICAgICAgICAgICAgLy9hdCBmaXJzdCBzbGlkZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL0lmIHRoZXJlJ3MgYSBkZWxheSBzb21ld2hlcmUgaW4gdGhlIHVuZG8gc3RhY2ssIGFuZCB3ZSBzbGVlcCBmb3Igc29tZSBhbW91bnQgb2YgdGltZSwgdGhlIHVzZXIgbWlnaHQgaGF2ZSBwcmVzc2VkIHJlZG8gZHVyaW5nIHRoYXQgdGltZS4gSW4gdGhhdCBjYXNlLCBoYW5kbGVGb3J3YXJkc1ByZXNzKCkgd2lsbCBzZXQgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uIHRvIEZPUldBUkRTLiBCdXQgd2UncmUgc3RpbGwgcnVubmluZywgc28gd2Ugc2hvdWxkIHN0b3AgcmVkb2luZyFcbiAgICAgICAgICAgIGlmKHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiAhPSBCQUNLV0FSRFMgfHwgbnVtQXJyb3dQcmVzc2VzICE9IHRoaXMubnVtQXJyb3dQcmVzc2VzKXtcbiAgICAgICAgICAgICAgICAvL3RoaXMgZnVuY3Rpb24gaGFzIGJlZW4gcHJlZW1wdGVkIGJ5IGFub3RoZXIgYXJyb3cgcHJlc3NcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgYmFja3dhcmRzIGhhcyBiZWVuIHByZWVtcHRlZDogJHtudW1BcnJvd1ByZXNzZXN9LCR7dGhpcy5udW1BcnJvd1ByZXNzZXN9LCR7dGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9ufWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy91bmRvIHRyYW5zZm9ybWF0aW9uIGluIHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdXG4gICAgICAgICAgICBsZXQgdW5kb0l0ZW0gPSB0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMudW5kb0FuSXRlbSh1bmRvSXRlbSk7XG4gICAgICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4IC09IDE7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID0gTk9fU0xJREVfTU9WRU1FTlQ7XG4gICAgfVxuXG4gICAgYXN5bmMgdW5kb0FuSXRlbSh1bmRvSXRlbSl7XG4gICAgICAgIHN3aXRjaCh1bmRvSXRlbS50eXBlKXtcbiAgICAgICAgICAgICAgICBjYXNlIERFTEFZOlxuICAgICAgICAgICAgICAgICAgICAvL2tlZXAgaW4gbWluZCBkdXJpbmcgdGhpcyBkZWxheSBwZXJpb2QsIHRoZSB1c2VyIG1pZ2h0IHB1c2ggdGhlIHJpZ2h0IGFycm93LiBJZiB0aGF0IGhhcHBlbnMsIHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiB3aWxsIGJlIElOQ1JFQVNJTkcsIHNvIGhhbmRsZUJhY2t3YXJkc1ByZXNzKCkgd2lsbCBxdWl0IGluc3RlYWQgb2YgY29udGludWluZy5cbiAgICAgICAgICAgICAgICAgICAgbGV0IHdhaXRUaW1lID0gdW5kb0l0ZW0ud2FpdFRpbWU7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuX3NsZWVwKHdhaXRUaW1lLzUpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFRSQU5TSVRJT05UTzpcbiAgICAgICAgICAgICAgICAgICAgbGV0IGR1cmF0aW9uID0gdW5kb0l0ZW0uZHVyYXRpb247XG4gICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uID0gZHVyYXRpb24vNTsgLy91bmRvaW5nIHNob3VsZCBiZSBmYXN0ZXIuXG4gICAgICAgICAgICAgICAgICAgIC8vdG9kbzogaW52ZXJ0IHRoZSBlYXNpbmcgb2YgdGhlIHVuZG9JdGVtIHdoZW4gY3JlYXRpbmcgdGhlIHVuZG8gYW5pbWF0aW9uP1xuICAgICAgICAgICAgICAgICAgICBsZXQgZWFzaW5nID0gRWFzaW5nLkVhc2VJbk91dDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHVuZG9BbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKHVuZG9JdGVtLnRhcmdldCwgdW5kb0l0ZW0uZnJvbVZhbHVlcywgZHVyYXRpb24sIHVuZG9JdGVtLm9wdGlvbmFsQXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgLy9hbmQgbm93IHVuZG9BbmltYXRpb24sIGhhdmluZyBiZWVuIGNyZWF0ZWQsIGdvZXMgb2ZmIGFuZCBkb2VzIGl0cyBvd24gdGhpbmcgSSBndWVzcy4gdGhpcyBzZWVtcyBpbmVmZmljaWVudC4gdG9kbzogZml4IHRoYXQgYW5kIG1ha2UgdGhlbSBhbGwgY2VudHJhbGx5IHVwZGF0ZWQgYnkgdGhlIGFuaW1hdGlvbiBsb29wIG9yc29tZXRoaW5nXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgTkVXU0xJREU6XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgIH1cblxuICAgIHNob3dBcnJvd3MoKXtcbiAgICAgICAgaWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA+IDApe1xuICAgICAgICAgICAgdGhpcy5sZWZ0QXJyb3cuc2hvd1NlbGYoKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICB0aGlzLmxlZnRBcnJvdy5oaWRlU2VsZigpO1xuICAgICAgICB9XG4gICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPCB0aGlzLm51bVNsaWRlcyl7XG4gICAgICAgICAgICB0aGlzLnJpZ2h0QXJyb3cuc2hvd1NlbGYoKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICB0aGlzLnJpZ2h0QXJyb3cuaGlkZVNlbGYoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIG5leHRTbGlkZSgpe1xuICAgICAgICAvKlRoZSB1c2VyIHdpbGwgY2FsbCB0aGlzIGZ1bmN0aW9uIHRvIG1hcmsgdGhlIHRyYW5zaXRpb24gYmV0d2VlbiBvbmUgc2xpZGUgYW5kIHRoZSBuZXh0LiBUaGlzIGRvZXMgdHdvIHRoaW5nczpcbiAgICAgICAgQSkgd2FpdHMgdW50aWwgdGhlIHVzZXIgcHJlc3NlcyB0aGUgcmlnaHQgYXJyb3cga2V5LCByZXR1cm5zLCBhbmQgY29udGludWVzIGV4ZWN1dGlvbiB1bnRpbCB0aGUgbmV4dCBuZXh0U2xpZGUoKSBjYWxsXG4gICAgICAgIEIpIGlmIHRoZSB1c2VyIHByZXNzZXMgdGhlIGxlZnQgYXJyb3cga2V5LCB0aGV5IGNhbiB1bmRvIGFuZCBnbyBiYWNrIGluIHRpbWUsIGFuZCBldmVyeSBUcmFuc2l0aW9uVG8oKSBjYWxsIGJlZm9yZSB0aGF0IHdpbGwgYmUgdW5kb25lIHVudGlsIGl0IHJlYWNoZXMgYSBwcmV2aW91cyBuZXh0U2xpZGUoKSBjYWxsLiBBbnkgbm9ybWFsIGphdmFzY3JpcHQgYXNzaWdubWVudHMgd29uJ3QgYmUgY2F1Z2h0IGluIHRoaXMgOihcbiAgICAgICAgQykgaWYgdW5kb1xuICAgICAgICAqL1xuICAgICAgICBpZighdGhpcy5pbml0aWFsaXplZCl0aHJvdyBuZXcgRXJyb3IoXCJFUlJPUjogVXNlIC5iZWdpbigpIG9uIGEgRGlyZWN0b3IgYmVmb3JlIGNhbGxpbmcgYW55IG90aGVyIG1ldGhvZHMhXCIpO1xuXG4gICAgICAgIFxuICAgICAgICB0aGlzLm51bVNsaWRlcysrO1xuICAgICAgICB0aGlzLnVuZG9TdGFjay5wdXNoKG5ldyBOZXdTbGlkZVVuZG9JdGVtKHRoaXMuY3VycmVudFNsaWRlSW5kZXgpKTtcbiAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCsrO1xuICAgICAgICB0aGlzLnNob3dBcnJvd3MoKTtcblxuXG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICAvL3Byb21pc2UgaXMgcmVzb2x2ZWQgYnkgY2FsbGluZyB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpIHdoZW4gdGhlIHRpbWUgY29tZXNcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICBzZWxmLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IGZ1bmN0aW9uKCl7IFxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IFxuICAgIGFzeW5jIF9zbGVlcCh3YWl0VGltZSl7XG4gICAgICAgIGF3YWl0IHN1cGVyLl9zbGVlcCh3YWl0VGltZSk7XG4gICAgfVxuXG4gICAgYXN5bmMgZGVsYXkod2FpdFRpbWUpe1xuICAgICAgICB0aGlzLnVuZG9TdGFjay5wdXNoKG5ldyBEZWxheVVuZG9JdGVtKHdhaXRUaW1lKSk7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXgrKztcbiAgICAgICAgY29uc29sZS5sb2codGhpcy51bmRvU3RhY2tJbmRleCk7XG4gICAgICAgIGF3YWl0IHRoaXMuX3NsZWVwKHdhaXRUaW1lKTtcbiAgICAgICAgY29uc29sZS5sb2codGhpcy51bmRvU3RhY2tJbmRleCk7XG4gICAgICAgIGlmKCF0aGlzLmlzQ2F1Z2h0VXBXaXRoTm90aGluZ1RvUmVkbygpKXtcbiAgICAgICAgICAgIC8vVGhpcyBpcyBhIHBlcmlsb3VzIHNpdHVhdGlvbi4gV2hpbGUgd2Ugd2VyZSBkZWxheWluZywgdGhlIHVzZXIgcHJlc3NlZCB1bmRvLCBhbmQgbm93IHdlJ3JlIGluIHRoZSBwYXN0LlxuICAgICAgICAgICAgLy93ZSBTSE9VTEROJ3QgeWllbGQgYmFjayBhZnRlciB0aGlzLCBiZWNhdXNlIHRoZSBwcmVzZW50YXRpb24gY29kZSBtaWdodCBzdGFydCBydW5uaW5nIG1vcmUgdHJhbnNmb3JtYXRpb25zIGFmdGVyIHRoaXMgd2hpY2ggY29uZmxpY3Qgd2l0aCB0aGUgdW5kb2luZyBhbmltYXRpb25zLiBTbyB3ZSBuZWVkIHRvIHdhaXQgdW50aWwgd2UgcmVhY2ggdGhlIHJpZ2h0IHNsaWRlIGFnYWluXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkVnYWRzISBUaGlzIGlzIGEgcGVyaWxvdXMgc2l0dWF0aW9uISBUb2RvOiB3YWl0IHVudGlsIHdlJ3JlIGZ1bGx5IGNhdWdodCB1cCB0byByZWxlYXNlXCIpO1xuICAgICAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgLy9wcm9taXNlIGlzIHJlc29sdmVkIGJ5IGNhbGxpbmcgdGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24oKSB3aGVuIHRoZSB0aW1lIGNvbWVzXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgICAgICBzZWxmLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IGZ1bmN0aW9uKCl7IFxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIlJlbGVhc2UhXCIpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgVHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMsIG9wdGlvbmFsQXJndW1lbnRzKXtcbiAgICAgICAgbGV0IGR1cmF0aW9uID0gZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gMSA6IGR1cmF0aW9uTVMvMTAwMDtcbiAgICAgICAgdmFyIGFuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb24sIG9wdGlvbmFsQXJndW1lbnRzKTtcbiAgICAgICAgbGV0IGZyb21WYWx1ZXMgPSBhbmltYXRpb24uZnJvbVZhbHVlcztcbiAgICAgICAgdGhpcy51bmRvU3RhY2sucHVzaChuZXcgVW5kb0l0ZW0odGFyZ2V0LCB0b1ZhbHVlcywgZnJvbVZhbHVlcywgZHVyYXRpb24sIG9wdGlvbmFsQXJndW1lbnRzKSk7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXgrKztcbiAgICB9XG59XG5cblxuLy9kaXNjb3VudCBlbnVtXG5jb25zdCBUUkFOU0lUSU9OVE8gPSAwO1xuY29uc3QgTkVXU0xJREUgPSAxO1xuY29uc3QgREVMQVk9MjtcblxuLy90aGluZ3MgdGhhdCBjYW4gYmUgc3RvcmVkIGluIGEgVW5kb0NhcGFibGVEaXJlY3RvcidzIC51bmRvU3RhY2tbXVxuY2xhc3MgVW5kb0l0ZW17XG4gICAgY29uc3RydWN0b3IodGFyZ2V0LCB0b1ZhbHVlcywgZnJvbVZhbHVlcywgZHVyYXRpb24sIG9wdGlvbmFsQXJndW1lbnRzKXtcbiAgICAgICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG4gICAgICAgIHRoaXMudG9WYWx1ZXMgPSB0b1ZhbHVlcztcbiAgICAgICAgdGhpcy5mcm9tVmFsdWVzID0gZnJvbVZhbHVlcztcbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgICB0aGlzLnR5cGUgPSBUUkFOU0lUSU9OVE87XG4gICAgICAgIHRoaXMub3B0aW9uYWxBcmd1bWVudHMgPSBvcHRpb25hbEFyZ3VtZW50cztcbiAgICB9XG59XG5cbmNsYXNzIE5ld1NsaWRlVW5kb0l0ZW17XG4gICAgY29uc3RydWN0b3Ioc2xpZGVJbmRleCl7XG4gICAgICAgIHRoaXMuc2xpZGVJbmRleCA9IHNsaWRlSW5kZXg7XG4gICAgICAgIHRoaXMudHlwZSA9IE5FV1NMSURFO1xuICAgIH1cbn1cblxuY2xhc3MgRGVsYXlVbmRvSXRlbXtcbiAgICBjb25zdHJ1Y3Rvcih3YWl0VGltZSl7XG4gICAgICAgIHRoaXMud2FpdFRpbWUgPSB3YWl0VGltZTtcbiAgICAgICAgdGhpcy50eXBlID0gREVMQVk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBOb25EZWNyZWFzaW5nRGlyZWN0b3IsIERpcmVjdGlvbkFycm93LCBVbmRvQ2FwYWJsZURpcmVjdG9yIH07XG4iXSwibmFtZXMiOlsiTWF0aCIsIlV0aWxzIiwidGhyZWVFbnZpcm9ubWVudCIsIm1hdGgubGVycFZlY3RvcnMiLCJyZXF1aXJlIiwicmVxdWlyZSQkMCIsInJlcXVpcmUkJDEiLCJyZXF1aXJlJCQyIiwiZ2xvYmFsIiwidlNoYWRlciIsImZTaGFkZXIiLCJ1bmlmb3JtcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0NBQUE7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFQSxNQUFNLElBQUk7Q0FDVixDQUFDLFdBQVcsRUFBRTtDQUNkLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7Q0FDckIsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztDQUNyQixLQUFLO0NBQ0wsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0NBQ1g7Q0FDQSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQzVCLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Q0FDdEIsRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO0NBQ2pDLEVBQUUsT0FB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QUFhLElBQUksQ0FBQyxDQUFDO0NBQzdCLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDNUMsSUFBSSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEcsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7Q0FDbEIsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxJQUFJO0NBQ0osR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7Q0FDbkM7Q0FDQSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzVDLElBQUksSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3RHLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDN0MsS0FBSyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdkcsS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDOUMsS0FBSyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM5QyxLQUFLO0NBQ0wsSUFBSTtDQUNKLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO0NBQ25DO0NBQ0EsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM1QyxJQUFJLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN0RyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzdDLEtBQUssSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3ZHLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDOUMsTUFBTSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDeEcsTUFBTSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM1RSxNQUFNLElB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LFNBQVMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLFVBQVUsS0FBSyxTQUFTLEdBQUcsU0FBUyxHQUFHLFVBQVUsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztDQUM1SCxDQUFDOzs7Ozs7Ozs7Ozs7O0NDeFRELENBQUMsWUFBWTtBQUNiLEFBQ0E7Q0FDQSxDQUFDLElBQUksTUFBTSxHQUFHO0NBQ2QsR0FBRyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztDQUN6QyxHQUFHLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0NBQ3pDLEdBQUcsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7Q0FDekMsR0FBRyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztDQUN6QyxHQUFHLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0NBQ3pDLEdBQUcsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7Q0FDekMsR0FBRyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztDQUN6QyxHQUFHLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0NBQ3pDLEdBQUcsQ0FBQztDQUNKLENBQUMs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RyxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0NBQ3pCLEdBQUcsUUFBUSxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7Q0FDeEMsR0FBRyxLQUFLLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDO0NBQzlCLEdBQUcsUUFBUSxFQUFFLFVBQVU7Q0FDdkIsR0FBRyxJQUFJLEVBQUUsR0FBRztDQUNaLEdBQUcsS0FBSyxFQUFFLFNBQVM7Q0FDbkIsR0FBRyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssSUFBSSxFQUFFO0NBQzFCLEdBQUcsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLElBQUksRUFBRTtDQUMxQixHQUFHLENBQUM7O0NBRUo7Q0FDQSxFQUFFLFFBQVEsR0FBRyxDQUFDLENBQUM7Q0FDZixFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxFQUFFO0NBQzNDLEdBQUcsSUFBSSxDQUFDLEVBQUUsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLENBQUM7O0NBRXBDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtDQUMxRCxJQUFJLFFBQVEsSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3BDLElBQUk7Q0FDSixHQUFHLENBQUMsQ0FBQzs7Q0FFTCxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDOztDQUVyRCxFQUFFLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDOztDQUVsQyxFQUFFLElBQUks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QUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU9BLGVBQU8sRUFBRSxVQUFVLEVBQUVBLGVBQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsWUFBWSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksR0FBRyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxZQUFZLEtBQUssQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsb0JBQW1CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQyxxQ0FBcUMsQ0FBQyxrREFBa0QsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsT0FBTyxPQUFPLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEdBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxHQUFHLFFBQVEsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsZ0JBQWdCLENBQUMsU0FBUyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGdCQUFnQixDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUMsQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLE9BQU8sVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsU0FBUyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxPQUFPLEdBQUcsR0FBRyxVQUFVLENBQUMsU0FBUyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxPQUFPLEdBQUcsR0FBRyxRQUFRLENBQUMsU0FBUyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxPQUFPLEdBQUcsR0FBRyxRQUFRLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEdBQUcsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFFLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBRyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLFVBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLFlBQVksQ0FBQyxDQUFDLEdBQUcsWUFBWSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQVksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBSyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxPQUFPLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxHQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsSUFBSSxFQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFLLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyw0QkFBNEIsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQUFBbUIsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFLLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU0sR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVUsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksV0FBVyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsU0FBUyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxHQUFHLFNBQVMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsRUFBRSxTQUFTLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLFNBQVMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxNQUFNLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLE1BQU0sUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLEVBQUUsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxBQUF3QixJQUFJLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLEVBQUUsZUFBZSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksY0FBYyxDQUFDLEVBQUUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLEFBQWEsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsSUFBSSxjQUFjLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLFFBQVEsQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsV0FBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLFNBQVMsQ0FBQyxPQUFPLFdBQVcsQ0FBQyxTQUFTLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEdBQUcsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFTLENBQUMsU0FBUyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsU0FBUyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLEVBQUUsV0FBVyxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLGFBQWEsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLFFBQVEsR0FBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLFNBQVMsV0FBVyxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLDZGQUE2RixDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFDLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxVQUFVLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxHQUFHLEdBQUcsR0FBRyxPQUFPLEVBQUUsR0FBRyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxHQUFHLElBQUksT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxHQUFHLElBQUksYUFBYSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxhQUFhLENBQUMsR0FBRyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFDLENBQUMsR0FBRyxPQUFPLFNBQVMsR0FBRyxXQUFXLEVBQUUsU0FBUyxHQUFHLElBQUksRUFBRSxLQUFLLFlBQVksU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEtBQUssR0FBRyxPQUFPLHdCQUF3QixHQUFHLFdBQVcsRUFBRSx3QkFBd0IsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLHdCQUF3QixFQUFFLE9BQU8scUJBQXFCLEdBQUcsV0FBVyxFQUFFLHFCQUFxQixHQUFHLElBQUksRUFBRSxLQUFLLFlBQVkscUJBQXFCLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBSyxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaURBQWlELENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFNLFVBQVUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxPQUFPLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxPQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsU0FBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsWUFBWSxFQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsR0FBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLE1BQUssQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFP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QUFVLEVBQUUsVUFBVSxHQUFHLEVBQUUsSUFBSSxHQUFHO0NBQ3RELFFBQVEsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztDQUMvQixRQUFRLEtBQUssRUFBRSxHQUFHO0NBQ2xCLFlBQVksSUFBSSxDQUFDLFFBQVEsR0FBRyxTQUFTLENBQUM7Q0FDdEMsWUFBWSxFQUFFLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDO0NBQzVCLFNBQVM7Q0FDVCxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUM7Q0FDckIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsVUFBVSxRQUFRLEdBQUc7Q0FDdEQsUUFBUSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxHQUFHO0NBQ3hDLFlBQVksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsUUFBUSxHQUFFO0NBQ2hELFNBQVM7Q0FDVCxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUM7Q0FDckIsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxPQUFPLEVBQUUsVUFBVSxJQUFJLEdBQUc7Q0FDL0MsUUFBUSxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDN0MsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDOztDQUVyQixDQUFDOztDQUVELHFCQUFxQixDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzs7Q0FFNUUscUJBQXFCLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxXQUFXOztDQUVuRCxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQzs7Q0FFckMsQ0FBQyxDQUFDOztDQUVGLHFCQUFxQixDQUFDLFNBQVMsQ0FB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QUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUN0RCxLQUFLO0NBQ0wsSUFBSSxxQkFBcUIsQ0FBQyxLQUFLLENBQUM7Q0FDaEMsUUFBUSxNQUFNLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDM0MsUUFBUSxNQUFNLFdBQVcsR0FBRyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0NBQzdELFFBQVEsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUN2QztDQUNBLFlBQVksSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQy9ELFNBQVM7Q0FDVDtDQUNBLEtBQUs7Q0FDTCxJQUFJLGtCQUFrQixDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUM7Q0FDMUM7Q0FDQSxRQUFRLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMzRSxLQUFLO0NBQ0wsSUFBSSxxQkFBcUIsQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxXQUFXLENBQUM7Q0FDN0U7Q0FDQSxRQUFRLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUM7Q0FDL0QsUUFBUSxJQUFJLEtBQUssR0FBRyxXQUFXLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQzs7Q0FFeEMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7O0NBRTVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDOztDQUU1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQzs7Q0FFNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzdDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUM7O0NBRTdDLFFBQVEsSUFBSSxjQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDO0NBQzdELFFBQVEsY0FBYyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7Q0FDMUMsS0FBSztDQUNMLElBQUksSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDO0NBQ3BCO0NBQ0EsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztDQUM1QixRQUFRLEdBQUdBLE9BQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDbkMsWUFBWSxJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxDQUFDO0NBQ2hELFNBQVMsSUFBSTtDQUNiLFlB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QUNwQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUMsS0FBSyxJQUFJO0NBQ1Q7Q0FDQSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUMsS0FBSyxjQUFjLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDMUIsS0FBSzs7Q0FFTDtDQUNBO0NBQ0EsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ2xKO0NBQ0EsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUks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
