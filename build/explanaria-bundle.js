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

	//test??
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
	        this.target[propertyName] = t > 0.5 ? this.toValue : this.fromValue;
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
	            for(let i=this.shortestLength;i<this.longestLength;i++){
	                this.resultArray[i] = t*this.toValue[i]; // + (1-t)*0;
	            }
	        }else{
	            //this.toValue[i] doesn't exist, so assume it's a zero
	            for(let i=this.shortestLength;i<this.longestLength;i++){
	                this.resultArray[i] = (1-t)*this.fromValue[i]; // + t*0 
	            }
	        }
	        return this.resultArray;
	    }
	}







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
	        
			this.fromValues = {};
	        this.interpolators = [];
	        this.interpolatingPropertyNames = [];
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


			this.elapsedTime = 0;
	        this.prevTrueTime = 0;

			//begin
			this._updateCallback = this.update.bind(this);
			exports.threeEnvironment.on("update",this._updateCallback);
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
	        }else if(typeof(toValue) === "boolean" && typeof(fromValue) === "boolean"){
	            //boolean
	            return new BoolInterpolator(fromValue, toValue, interpolationFunction);
			}else if(Utils$1.is1DNumericArray(toValue) && Utils$1.is1DNumericArray(fromValue)){
	            //function-function
				return new Numeric1DArrayInterpolator(fromValue, toValue, interpolationFunction);
	        }else{
	            //We don't know how to interpolate this. Instead we'll just do nothing, and at the end of the animation we'll just set the target to the toValue.
				console.error("Animation class cannot yet handle transitioning between things that aren't numbers or functions!");
			}
	    }
		update(time){
			this.elapsedTime += time.realtimeDelta;	

			let percentage = this.elapsedTime/this.duration;

			//interpolate values
			for(let i=0;i<this.interpolators.length;i++){
	            let propertyName = this.interpolatingPropertyNames[i];
				this.target[propertyName] = this.interpolators[i].interpolate(percentage);
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
		}
	}

	function TransitionTo(target, toValues, durationMS, optionalArguments){
	    //if someone's using the old calling strategy of staggerFraction as the last argument, convert it properly
	    if(Utils$1.isNumber(optionalArguments)){
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
	        this._color = options.color !== undefined ? new THREE.Color(options.color) : new THREE.Color(0x55aa55);

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

	        this.setAllVerticesToColor(this.color);

	        positionAttribute.needsUpdate = true;
	        colorAttribute.needsUpdate = true;
	    }
	    evaluateSelf(i, t, x, y, z){
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
	        //currently only a single color is supported.
	        //I should really make it possible to specify color by a function.
	        this._color = color;
	        this.setAllVerticesToColor(color);
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

			this._gridColor = options.gridColor !== undefined ? new THREE.Color(options.gridColor) : new THREE.Color(0x55aa55);
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
	        this._uniforms.useCustomGridColor = this._useCustomGridColor;

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
	        this._uniforms.useCustomGridColor = 1.0;
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
	            this.slides[i].style.display = 'none';//opacity=0 alone won't be instant because of the 1s CSS transition
	        }
	        let self = this;
	        //undo setting display-none after a bit of time
	        window.setTimeout(function(){
	            for(var i=0;i<self.slides.length;i++){
	                self.slides[i].style.display = '';
	            }
	        },1);

	        //now handle exp-slide-<n>
	        let allSpecificSlideElements = document.querySelectorAll('[class*="exp-slide-"]'); //this is a CSS attribute selector, and I hate that this exists. it's so ugly
	        for(var i=0;i<allSpecificSlideElements.length;i++){
	            allSpecificSlideElements[i].style.opacity = 0; 
	            allSpecificSlideElements[i].style.display = 'none';//opacity=0 alone won't be instant because of the 1s CSS transition
	        }
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
	        }
	        
	        //items with HTML class exp-slide-n
	        let prevSlideElems = document.getElementsByClassName("exp-slide-"+(prevSlideNumber+1));
	        for(var i=0;i<prevSlideElems.length;i++){
	            prevSlideElems[i].style.opacity = 0;
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
	        }

	        //items with class exp-slide
	        if(slideNumber < this.slides.length){
	            this.slides[slideNumber].style.opacity = 1;
	        }

	    }

	    //verbs
	    async delay(waitTime){
	        return new Promise(function(resolve, reject){
	            window.setTimeout(resolve, waitTime);
	        });
	    }
	    TransitionTo(target, toValues, durationMS, optionalArguments){
	        //if someone's using the old calling strategy of staggerFraction as the last argument, convert it properly
	        if(Utils.isNumber(optionalArguments)){
	            optionalArguments = {staggerFraction: optionalArguments};
	        }
	        new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000, staggerFraction=staggerFraction, optionalArguments);
	    }
	}







	class UndoCapableDirector extends NonDecreasingDirector{
	    //thsi director uses both forwards and backwards arrows. the backwards arrow will undo any UndoCapableDirector.TransitionTo()s
	    //todo: hook up the arrows and make it not
	    constructor(options){
	        super(options);

	        this.furthestSlideIndex = 0; //matches the number of times nextSlide() has been called
	        //this.currentSlideIndex is always < this.furthestSlideIndex - if equal, we release the promise and let nextSlide() return

	        this.undoStack = [];
	        this.undoStackIndex = 0; //increased by one every time either this.TransitionTo is called or this.nextSlide() is called

	        let self = this;

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
	            if(this.currentSlideIndex < this.numSlides){
	                this.undoStackIndex += 1; //advance past the NewSlideUndoItem
	                this.furthestSlideIndex += 1; 

	                this.switchDisplayedSlideIndex(this.currentSlideIndex + 1); //this will complain in the console window if there are less slides than newSlide() calls
	                this.showArrows(); //showArrows must come after this.currentSlideIndex advances or else we won't be able to tell if we're at the end or not
	            }
	            this.nextSlideResolveFunction(); //allow presentation code to proceed
	    }

	    handleForwardsPress(){
	        this.rightArrow.hideSelf();

	        if(this.furthestSlideIndex == this.currentSlideIndex){
	            //if nothing to redo
	            this.moveFurtherIntoPresentation();
	            return;
	        }
	        // if we get to here, we've previously done an undo and we need to catch up

	        if(this.undoStackIndex < this.undoStack.length-1) this.undoStackIndex += 1;

	        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
	            //loop through undo stack and redo each undo

	            let redoItem = this.undoStack[this.undoStackIndex];
	            switch(redoItem.type){
	                case DELAY:
	                    //while redoing, skip any delays
	                    break;
	                case TRANSITIONTO:
	                    var redoAnimation = new Animation(redoItem.target, redoItem.toValues, redoItem.durationMS === undefined ? undefined : redoItem.durationMS/1000, redoItem.optionalArguments);
	                  //and now redoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething
	                    break;
	                case NEWSLIDE:
	                    break;
	                default:
	                    break;
	            }

	            if(this.undoStackIndex == this.undoStack.length-1){
	                //fully redone and at current slide
	                break;
	            }
	            
	            this.undoStackIndex += 1;

	        }
	        this.switchDisplayedSlideIndex(this.currentSlideIndex + 1);
	        this.showArrows();
	    }

	    handleBackwardsPress(){
	        this.leftArrow.hideSelf();

	        if(this.undoStackIndex == 0 || this.currentSlideIndex == 0){
	            return;
	        }

	        this.undoStackIndex -= 1;
	        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
	            //loop through undo stack and redo each undo

	            if(this.undoStackIndex == 0){
	                //at first slide
	                break;
	            }

	            //undo transformation in this.undoStack[this.undoStackIndex]
	            let undoItem = this.undoStack[this.undoStackIndex];
	            switch(undoItem.type){
	                case DELAY:
	                    //while undoing, skip any delays
	                    break;
	                case TRANSITIONTO:
	                    let duration = undoItem.durationMS === undefined ? 1 : undoItem.durationMS/1000;
	                    duration = Math.min(duration / 2, 1); //undoing should be faster, so cut it in half - but cap durations at 1s
	                    //todo: invert the easing of the undoItem when creating the undo animation?
	                    let easing = Easing.EaseInOut;
	                    var undoAnimation = new Animation(undoItem.target, undoItem.fromValues, duration, {staggerFraction:0, easing: easing});
	                    //and now undoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething
	                    break;
	                case NEWSLIDE:
	                    break;
	                default:
	                    break;
	            }
	            this.undoStackIndex -= 1;
	        }
	        this.switchDisplayedSlideIndex(this.currentSlideIndex - 1);
	        this.showArrows();
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
	        this.showArrows();


	        let self = this;

	        //promise is resolved by calling this.nextSlideResolveFunction() when the time comes
	        return new Promise(function(resolve, reject){
	            self.nextSlideResolveFunction = function(){ 
	                resolve();
	            };
	        });

	    }

	    async delay(waitTime){
	        this.undoStack.push(new DelayUndoItem(waitTime));
	        this.undoStackIndex++;
	        await super.delay(waitTime);
	    }
	    TransitionTo(target, toValues, durationMS, optionalArguments){
	        var animation = new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000, optionalArguments);
	        let fromValues = animation.fromValues;
	        this.undoStack.push(new UndoItem(target, toValues, fromValues, durationMS, optionalArguments));
	        this.undoStackIndex++;
	    }
	}


	//discount enum
	const TRANSITIONTO = 0;
	const NEWSLIDE = 1;
	const DELAY=2;

	//things that can be stored in a UndoCapableDirector's .undoStack[]
	class UndoItem{
	    constructor(target, toValues, fromValues, durationMS, optionalArguments){
	        this.target = target;
	        this.toValues = toValues;
	        this.fromValues = fromValues;
	        this.durationMS = durationMS;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9IaXN0b3J5UmVjb3JkZXIuanMiLCIuLi9zcmMvanMvVGhyZWVFbnZpcm9ubWVudC5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL291dHB1dHMvTGluZU91dHB1dFNoYWRlcnMuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9MaW5lT3V0cHV0LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvUG9pbnRPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9WZWN0b3JPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9TdXJmYWNlT3V0cHV0U2hhZGVycy5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1N1cmZhY2VPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9GbGF0QXJyYXlPdXRwdXQuanMiLCIuLi9zcmMvanMvRGlyZWN0b3JJbWFnZUNvbnN0YW50cy5qcyIsIi4uL3NyYy9qcy9EaXJlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBUaGUgYmFzZSBjbGFzcyB0aGF0IGV2ZXJ5dGhpbmcgaW5oZXJpdHMgZnJvbS4gXG5cdEVhY2ggdGhpbmcgZHJhd24gdG8gdGhlIHNjcmVlbiBpcyBhIHRyZWUuIERvbWFpbnMsIHN1Y2ggYXMgRVhQLkFyZWEgb3IgRVhQLkFycmF5IGFyZSB0aGUgcm9vdCBub2Rlcyxcblx0RVhQLlRyYW5zZm9ybWF0aW9uIGlzIGN1cnJlbnRseSB0aGUgb25seSBpbnRlcm1lZGlhdGUgbm9kZSwgYW5kIHRoZSBsZWFmIG5vZGVzIGFyZSBzb21lIGZvcm0gb2YgT3V0cHV0IHN1Y2ggYXNcblx0RVhQLkxpbmVPdXRwdXQgb3IgRVhQLlBvaW50T3V0cHV0LCBvciBFWFAuVmVjdG9yT3V0cHV0LlxuXG5cdEFsbCBvZiB0aGVzZSBjYW4gYmUgLmFkZCgpZWQgdG8gZWFjaCBvdGhlciB0byBmb3JtIHRoYXQgdHJlZSwgYW5kIHRoaXMgZmlsZSBkZWZpbmVzIGhvdyBpdCB3b3Jrcy5cbiovXG5cbmNsYXNzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKCl7ICAgICAgICBcblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsOyAgICAgICAgXG4gICAgfVxuXHRhZGQodGhpbmcpe1xuXHRcdC8vY2hhaW5hYmxlIHNvIHlvdSBjYW4gYS5hZGQoYikuYWRkKGMpIHRvIG1ha2UgYS0+Yi0+Y1xuXHRcdHRoaXMuY2hpbGRyZW4ucHVzaCh0aGluZyk7XG5cdFx0dGhpbmcucGFyZW50ID0gdGhpcztcblx0XHRpZih0aGluZy5fb25BZGQpdGhpbmcuX29uQWRkKCk7XG5cdFx0cmV0dXJuIHRoaW5nO1xuXHR9XG5cdF9vbkFkZCgpe31cblx0cmVtb3ZlKHRoaW5nKXtcblx0XHR2YXIgaW5kZXggPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoIHRoaW5nICk7XG5cdFx0aWYgKCBpbmRleCAhPT0gLSAxICkge1xuXHRcdFx0dGhpbmcucGFyZW50ID0gbnVsbDtcblx0XHRcdHRoaXMuY2hpbGRyZW4uc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuICAgIGdldFRvcFBhcmVudCgpeyAvL2ZpbmQgdGhlIHBhcmVudCBvZiB0aGUgcGFyZW50IG9mIHRoZS4uLiB1bnRpbCB0aGVyZSdzIG5vIG1vcmUgcGFyZW50cy5cbiAgICAgICAgY29uc3QgTUFYX0NIQUlOID0gMTAwO1xuICAgICAgICBsZXQgcGFyZW50Q291bnQgPSAwO1xuXHRcdGxldCByb290ID0gdGhpcztcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmIHBhcmVudENvdW50IDwgTUFYX0NIQUlOKXtcblx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcbiAgICAgICAgICAgIHBhcmVudENvdW50Kz0gMTtcblx0XHR9XG5cdFx0aWYocGFyZW50Q291bnQgPj0gTUFYX0NIQUlOKXRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIHRvcC1sZXZlbCBwYXJlbnQhXCIpO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9XG4gICAgZ2V0RGVlcGVzdENoaWxkcmVuKCl7IC8vZmluZCBhbGwgbGVhZiBub2RlcyBmcm9tIHRoaXMgbm9kZVxuICAgICAgICAvL3RoaXMgYWxnb3JpdGhtIGNhbiBwcm9iYWJseSBiZSBpbXByb3ZlZFxuICAgICAgICBpZih0aGlzLmNoaWxkcmVuLmxlbmd0aCA9PSAwKXJldHVybiBbdGhpc107XG5cbiAgICAgICAgbGV0IGNoaWxkcmVuID0gW107XG4gICAgICAgIGZvcihsZXQgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGxldCBjaGlsZHNDaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW5baV0uZ2V0RGVlcGVzdENoaWxkcmVuKCk7XG4gICAgICAgICAgICBmb3IobGV0IGo9MDtqPGNoaWxkc0NoaWxkcmVuLmxlbmd0aDtqKyspe1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goY2hpbGRzQ2hpbGRyZW5bal0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG4gICAgZ2V0Q2xvc2VzdERvbWFpbigpe1xuICAgICAgICAvKiBGaW5kIHRoZSBEb21haW5Ob2RlIHRoYXQgdGhpcyBOb2RlIGlzIGJlaW5nIGNhbGxlZCBmcm9tLlxuICAgICAgICBUcmF2ZXJzZSB0aGUgY2hhaW4gb2YgcGFyZW50cyB1cHdhcmRzIHVudGlsIHdlIGZpbmQgYSBEb21haW5Ob2RlLCBhdCB3aGljaCBwb2ludCB3ZSByZXR1cm4gaXQuXG4gICAgICAgIFRoaXMgYWxsb3dzIGFuIG91dHB1dCB0byByZXNpemUgYW4gYXJyYXkgdG8gbWF0Y2ggYSBkb21haW5Ob2RlJ3MgbnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBmb3IgZXhhbXBsZS5cblxuICAgICAgICBOb3RlIHRoYXQgdGhpcyByZXR1cm5zIHRoZSBNT1NUIFJFQ0VOVCBEb21haW5Ob2RlIGFuY2VzdG9yIC0gaXQncyBhc3N1bWVkIHRoYXQgZG9tYWlubm9kZXMgb3ZlcndyaXRlIG9uZSBhbm90aGVyLlxuICAgICAgICAqL1xuICAgICAgICBjb25zdCBNQVhfQ0hBSU4gPSAxMDA7XG4gICAgICAgIGxldCBwYXJlbnRDb3VudCA9IDA7XG5cdFx0bGV0IHJvb3QgPSB0aGlzLnBhcmVudDsgLy9zdGFydCBvbmUgbGV2ZWwgdXAgaW4gY2FzZSB0aGlzIGlzIGEgRG9tYWluTm9kZSBhbHJlYWR5LiB3ZSBkb24ndCB3YW50IHRoYXRcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmICFyb290LmlzRG9tYWluTm9kZSAmJiBwYXJlbnRDb3VudCA8IE1BWF9DSEFJTil7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG4gICAgICAgICAgICBwYXJlbnRDb3VudCs9IDE7XG5cdFx0fVxuXHRcdGlmKHBhcmVudENvdW50ID49IE1BWF9DSEFJTil0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBwYXJlbnQhXCIpO1xuICAgICAgICBpZihyb290ID09PSBudWxsIHx8ICFyb290LmlzRG9tYWluTm9kZSl0aHJvdyBuZXcgRXJyb3IoXCJObyBEb21haW5Ob2RlIHBhcmVudCBmb3VuZCFcIik7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH1cblxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblx0XHQvL2J1dCBjYWxsIGFsbCBjaGlsZHJlblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0ub25BZnRlckFjdGl2YXRpb24oKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgT3V0cHV0Tm9kZSBleHRlbmRzIE5vZGV7IC8vbW9yZSBvZiBhIGphdmEgaW50ZXJmYWNlLCByZWFsbHlcblx0Y29uc3RydWN0b3IoKXtzdXBlcigpO31cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope31cblx0b25BZnRlckFjdGl2YXRpb24oKXt9XG5cdF9vbkFkZCgpe31cbn1cblxuY2xhc3MgRG9tYWluTm9kZSBleHRlbmRzIE5vZGV7IC8vQSBub2RlIHRoYXQgY2FsbHMgb3RoZXIgZnVuY3Rpb25zIG92ZXIgc29tZSByYW5nZS5cblx0Y29uc3RydWN0b3IoKXtcbiAgICAgICAgc3VwZXIoKTtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSBudWxsOyAvLyBudW1iZXIgb2YgdGltZXMgYW55IGNoaWxkIG5vZGUncyBldmFsdWF0ZVNlbGYoKSBpcyBjYWxsZWRcbiAgICB9XG4gICAgYWN0aXZhdGUodCl7fVxufVxuRG9tYWluTm9kZS5wcm90b3R5cGUuaXNEb21haW5Ob2RlID0gdHJ1ZTtcblxuZXhwb3J0IGRlZmF1bHQgTm9kZTtcbmV4cG9ydCB7T3V0cHV0Tm9kZSwgRG9tYWluTm9kZX07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9ICBmcm9tICcuL05vZGUuanMnO1xuLy90ZXN0Pz9cbmNsYXNzIEVYUEFycmF5IGV4dGVuZHMgRG9tYWluTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKnZhciBwb2ludHMgPSBuZXcgRVhQLkFycmF5KHtcblx0XHRkYXRhOiBbWy0xMCwxMF0sXG5cdFx0XHRbMTAsMTBdXVxuXHRcdH0pKi9cblxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZGF0YVwiKTsgLy8gYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LiBhc3N1bWVkIHRvIG9ubHkgY29udGFpbiBvbmUgdHlwZTogZWl0aGVyIG51bWJlcnMgb3IgYXJyYXlzXG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5kYXRhLCBBcnJheSk7XG5cblx0XHQvL0l0J3MgYXNzdW1lZCBhbiBFWFAuQXJyYXkgd2lsbCBvbmx5IHN0b3JlIHRoaW5ncyBzdWNoIGFzIDAsIFswXSwgWzAsMF0gb3IgWzAsMCwwXS4gSWYgYW4gYXJyYXkgdHlwZSBpcyBzdG9yZWQsIHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyBjb250YWlucyB0aGUgLmxlbmd0aCBvZiB0aGF0IGFycmF5LiBPdGhlcndpc2UgaXQncyAwLCBiZWNhdXNlIHBvaW50cyBhcmUgMC1kaW1lbnNpb25hbC5cblx0XHRpZihvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHR0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPSAwO1xuXHRcdH1lbHNlIGlmKG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0dGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID0gb3B0aW9ucy5kYXRhWzBdLmxlbmd0aDtcblx0XHR9ZWxzZXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJEYXRhIGluIGFuIEVYUC5BcnJheSBzaG91bGQgYmUgYSBudW1iZXIgb3IgYW4gYXJyYXkgb2Ygb3RoZXIgdGhpbmdzLCBub3QgXCIgKyBvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IpO1xuXHRcdH1cblxuXG5cdFx0RVhQLlV0aWxzLmFzc2VydChvcHRpb25zLmRhdGFbMF0ubGVuZ3RoICE9IDApOyAvL2Rvbid0IGFjY2VwdCBbW11dLCBkYXRhIG5lZWRzIHRvIGJlIHNvbWV0aGluZyBsaWtlIFtbMSwyXV0uXG5cblx0XHR0aGlzLmRhdGEgPSBvcHRpb25zLmRhdGE7XG5cdFx0dGhpcy5udW1JdGVtcyA9IHRoaXMuZGF0YS5sZW5ndGg7XG5cblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW3RoaXMuZGF0YS5sZW5ndGhdOyAvLyBhcnJheSB0byBzdG9yZSB0aGUgbnVtYmVyIG9mIHRpbWVzIHRoaXMgaXMgY2FsbGVkIHBlciBkaW1lbnNpb24uXG5cblx0XHQvL3RoZSBudW1iZXIgb2YgdGltZXMgZXZlcnkgY2hpbGQncyBleHByIGlzIGNhbGxlZFxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gdGhpcy5pdGVtRGltZW5zaW9ucy5yZWR1Y2UoKHN1bSx5KT0+c3VtKnkpO1xuXHR9XG5cdGFjdGl2YXRlKHQpe1xuXHRcdGlmKHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyA9PSAwKXtcblx0XHRcdC8vbnVtYmVycyBjYW4ndCBiZSBzcHJlYWQgdXNpbmcgLi4uIG9wZXJhdG9yXG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuZGF0YS5sZW5ndGg7aSsrKXtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGksdCx0aGlzLmRhdGFbaV0pO1xuXHRcdFx0fVxuXHRcdH1lbHNle1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmRhdGEubGVuZ3RoO2krKyl7XG5cdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpLHQsLi4udGhpcy5kYXRhW2ldKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm9uQWZ0ZXJBY3RpdmF0aW9uKCk7IC8vIGNhbGwgY2hpbGRyZW4gaWYgbmVjZXNzYXJ5XG5cdH1cblx0X2NhbGxBbGxDaGlsZHJlbiguLi5jb29yZGluYXRlcyl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpXG5cdFx0fVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEVYUC5BcnJheSh7ZGF0YTogRVhQLlV0aWxzLmFycmF5Q29weSh0aGlzLmRhdGEpfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0QXJyYXkoKXtcblx0dmFyIHggPSBuZXcgRVhQLkFycmF5KHtkYXRhOiBbWzAsMV0sWzAsMV1dfSk7XG5cdHZhciB5ID0gbmV3IEVYUC5UcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSk7IHJldHVybiBbMl19fSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKDUxMik7XG59XG5cbmV4cG9ydCB7RVhQQXJyYXkgYXMgQXJyYXl9O1xuIiwiZnVuY3Rpb24gbXVsdGlwbHlTY2FsYXIoYywgYXJyYXkpe1xuXHRmb3IodmFyIGk9MDtpPGFycmF5Lmxlbmd0aDtpKyspe1xuXHRcdGFycmF5W2ldICo9IGM7XG5cdH1cblx0cmV0dXJuIGFycmF5XG59XG5mdW5jdGlvbiB2ZWN0b3JBZGQodjEsdjIpe1xuICAgIGxldCB2ZWMgPSBjbG9uZSh2MSk7XG5cdGZvcih2YXIgaT0wO2k8djEubGVuZ3RoO2krKyl7XG5cdFx0dmVjW2ldICs9IHYyW2ldO1xuXHR9XG5cdHJldHVybiB2ZWNcbn1cbmZ1bmN0aW9uIHZlY3RvclN1Yih2MSx2Mil7XG4gICAgbGV0IHZlYyA9IGNsb25lKHYxKTtcblx0Zm9yKHZhciBpPTA7aTx2MS5sZW5ndGg7aSsrKXtcblx0XHR2ZWNbaV0gKz0gdjJbaV07XG5cdH1cblx0cmV0dXJuIHZlY1xufVxuZnVuY3Rpb24gbGVycFZlY3RvcnModCwgcDEsIHAyKXtcblx0Ly9hc3N1bWVkIHQgaW4gWzAsMV1cblx0cmV0dXJuIHZlY3RvckFkZChtdWx0aXBseVNjYWxhcih0LGNsb25lKHAxKSksbXVsdGlwbHlTY2FsYXIoMS10LGNsb25lKHAyKSkpO1xufVxuZnVuY3Rpb24gY2xvbmUodmVjKXtcblx0dmFyIG5ld0FyciA9IG5ldyBBcnJheSh2ZWMubGVuZ3RoKTtcblx0Zm9yKHZhciBpPTA7aTx2ZWMubGVuZ3RoO2krKyl7XG5cdFx0bmV3QXJyW2ldID0gdmVjW2ldO1xuXHR9XG5cdHJldHVybiBuZXdBcnJcbn1cbmZ1bmN0aW9uIG11bHRpcGx5TWF0cml4KHZlYywgbWF0cml4KXtcblx0Ly9hc3NlcnQgdmVjLmxlbmd0aCA9PSBudW1Sb3dzXG5cblx0bGV0IG51bVJvd3MgPSBtYXRyaXgubGVuZ3RoO1xuXHRsZXQgbnVtQ29scyA9IG1hdHJpeFswXS5sZW5ndGg7XG5cblx0dmFyIG91dHB1dCA9IG5ldyBBcnJheShudW1Db2xzKTtcblx0Zm9yKHZhciBqPTA7ajxudW1Db2xzO2orKyl7XG5cdFx0b3V0cHV0W2pdID0gMDtcblx0XHRmb3IodmFyIGk9MDtpPG51bVJvd3M7aSsrKXtcblx0XHRcdG91dHB1dFtqXSArPSBtYXRyaXhbaV1bal0gKiB2ZWNbaV07XG5cdFx0fVxuXHR9XG5cdHJldHVybiBvdXRwdXQ7XG59XG5cbi8vaGFja1xubGV0IE1hdGggPSB7Y2xvbmU6IGNsb25lLCBsZXJwVmVjdG9yczogbGVycFZlY3RvcnMsIHZlY3RvckFkZDogdmVjdG9yQWRkLCB2ZWN0b3JTdWI6IHZlY3RvclN1YiwgbXVsdGlwbHlTY2FsYXI6IG11bHRpcGx5U2NhbGFyLCBtdWx0aXBseU1hdHJpeDogbXVsdGlwbHlNYXRyaXh9O1xuXG5leHBvcnQge3ZlY3RvckFkZCwgdmVjdG9yU3ViLCBsZXJwVmVjdG9ycywgY2xvbmUsIG11bHRpcGx5U2NhbGFyLCBtdWx0aXBseU1hdHJpeCwgTWF0aH07XG4iLCJpbXBvcnQge2Nsb25lfSBmcm9tICcuL21hdGguanMnXG5cbmNsYXNzIFV0aWxze1xuXG5cdHN0YXRpYyBpc0FycmF5KHgpe1xuXHRcdHJldHVybiB4LmNvbnN0cnVjdG9yID09PSBBcnJheTtcblx0fVxuXHRzdGF0aWMgaXNPYmplY3QoeCl7XG5cdFx0cmV0dXJuIHguY29uc3RydWN0b3IgPT09IE9iamVjdDtcblx0fVxuXHRzdGF0aWMgYXJyYXlDb3B5KHgpe1xuXHRcdHJldHVybiB4LnNsaWNlKCk7XG5cdH1cblx0c3RhdGljIGlzRnVuY3Rpb24oeCl7XG5cdFx0cmV0dXJuIHguY29uc3RydWN0b3IgPT09IEZ1bmN0aW9uO1xuXHR9XG5cdHN0YXRpYyBpc051bWJlcih4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gTnVtYmVyO1xuXHR9XG5cblx0c3RhdGljIGFzc2VydCh0aGluZyl7XG5cdFx0Ly9BIGZ1bmN0aW9uIHRvIGNoZWNrIGlmIHNvbWV0aGluZyBpcyB0cnVlIGFuZCBoYWx0IG90aGVyd2lzZSBpbiBhIGNhbGxiYWNrYWJsZSB3YXkuXG5cdFx0aWYoIXRoaW5nKXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgQXNzZXJ0aW9uIGZhaWxlZC4gU2VlIHRyYWNlYmFjayBmb3IgbW9yZS5cIik7XG4gICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG5cdFx0fVxuXHR9XG5cblx0c3RhdGljIGFzc2VydFR5cGUodGhpbmcsIHR5cGUsIGVycm9yTXNnKXtcblx0XHQvL0EgZnVuY3Rpb24gdG8gY2hlY2sgaWYgc29tZXRoaW5nIGlzIHRydWUgYW5kIGhhbHQgb3RoZXJ3aXNlIGluIGEgY2FsbGJhY2thYmxlIHdheS5cblx0XHRpZighKHRoaW5nLmNvbnN0cnVjdG9yID09PSB0eXBlKSl7XG5cdFx0XHRpZihlcnJvck1zZyl7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgU29tZXRoaW5nIG5vdCBvZiByZXF1aXJlZCB0eXBlIFwiK3R5cGUubmFtZStcIiEgXFxuXCIrZXJyb3JNc2crXCJcXG4gU2VlIHRyYWNlYmFjayBmb3IgbW9yZS5cIik7XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBTb21ldGhpbmcgbm90IG9mIHJlcXVpcmVkIHR5cGUgXCIrdHlwZS5uYW1lK1wiISBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcblx0XHRcdH1cbiAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcblx0XHR9XG5cdH1cblxuXG5cdHN0YXRpYyBhc3NlcnRQcm9wRXhpc3RzKHRoaW5nLCBuYW1lKXtcblx0XHRpZighdGhpbmcgfHwgIShuYW1lIGluIHRoaW5nKSl7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFwiK25hbWUrXCIgbm90IHByZXNlbnQgaW4gcmVxdWlyZWQgcHJvcGVydHlcIik7XG4gICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG5cdFx0fVxuXHR9XG5cdFxuXHRzdGF0aWMgY2xvbmUodmVjKXtcblx0XHRyZXR1cm4gY2xvbmUodmVjKTtcblx0fVxuXG5cblx0c3RhdGljIGlzMUROdW1lcmljQXJyYXkodmVjKXtcbiAgICAgICAgaWYoIVV0aWxzLmlzQXJyYXkodmVjKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBmb3IobGV0IGk9MDtpPHZlYy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGlmKCFVdGlscy5pc051bWJlcih2ZWNbaV0pKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG5cdH1cblxufVxuXG5leHBvcnQge1V0aWxzfTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQgeyBVdGlscyB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHsgRG9tYWluTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5cbmNsYXNzIEFyZWEgZXh0ZW5kcyBEb21haW5Ob2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHRzdXBlcigpO1xuXG5cdFx0Lyp2YXIgYXhlcyA9IG5ldyBFWFAuQXJlYSh7XG5cdFx0Ym91bmRzOiBbWy0xMCwxMF0sXG5cdFx0XHRbMTAsMTBdXVxuXHRcdG51bUl0ZW1zOiAxMDsgLy9vcHRpb25hbC4gQWx0ZXJuYXRlbHkgbnVtSXRlbXMgY2FuIHZhcnkgZm9yIGVhY2ggYXhpczogbnVtSXRlbXM6IFsxMCwyXVxuXHRcdH0pKi9cblxuXG5cdFxuXHRcdFV0aWxzLmFzc2VydFByb3BFeGlzdHMob3B0aW9ucywgXCJib3VuZHNcIik7IC8vIGEgbXVsdGlkaW1lbnNpb25hbCBhcnJheVxuXHRcdFV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5ib3VuZHMsIEFycmF5KTtcblx0XHRVdGlscy5hc3NlcnRUeXBlKG9wdGlvbnMuYm91bmRzWzBdLCBBcnJheSwgXCJGb3IgYW4gQXJlYSwgb3B0aW9ucy5ib3VuZHMgbXVzdCBiZSBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXksIGV2ZW4gZm9yIG9uZSBkaW1lbnNpb24hXCIpOyAvLyBpdCBNVVNUIGJlIG11bHRpZGltZW5zaW9uYWxcblx0XHR0aGlzLm51bURpbWVuc2lvbnMgPSBvcHRpb25zLmJvdW5kcy5sZW5ndGg7XG5cblx0XHRVdGlscy5hc3NlcnQob3B0aW9ucy5ib3VuZHNbMF0ubGVuZ3RoICE9IDApOyAvL2Rvbid0IGFjY2VwdCBbW11dLCBpdCBuZWVkcyB0byBiZSBbWzEsMl1dLlxuXG5cdFx0dGhpcy5ib3VuZHMgPSBvcHRpb25zLmJvdW5kcztcblx0XHR0aGlzLm51bUl0ZW1zID0gb3B0aW9ucy5udW1JdGVtcyB8fCAxNjtcblxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbXTsgLy8gYXJyYXkgdG8gc3RvcmUgdGhlIG51bWJlciBvZiB0aW1lcyB0aGlzIGlzIGNhbGxlZCBwZXIgZGltZW5zaW9uLlxuXG5cdFx0aWYodGhpcy5udW1JdGVtcy5jb25zdHJ1Y3RvciA9PT0gTnVtYmVyKXtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1EaW1lbnNpb25zO2krKyl7XG5cdFx0XHRcdHRoaXMuaXRlbURpbWVuc2lvbnMucHVzaCh0aGlzLm51bUl0ZW1zKTtcblx0XHRcdH1cblx0XHR9ZWxzZSBpZih0aGlzLm51bUl0ZW1zLmNvbnN0cnVjdG9yID09PSBBcnJheSl7XG5cdFx0XHRVdGlscy5hc3NlcnQob3B0aW9ucy5udW1JdGVtcy5sZW5ndGggPT0gb3B0aW9ucy5ib3VuZHMubGVuZ3RoKTtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1EaW1lbnNpb25zO2krKyl7XG5cdFx0XHRcdHRoaXMuaXRlbURpbWVuc2lvbnMucHVzaCh0aGlzLm51bUl0ZW1zW2ldKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL3RoZSBudW1iZXIgb2YgdGltZXMgZXZlcnkgY2hpbGQncyBleHByIGlzIGNhbGxlZFxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gdGhpcy5pdGVtRGltZW5zaW9ucy5yZWR1Y2UoKHN1bSx5KT0+c3VtKnkpO1xuXHR9XG5cdGFjdGl2YXRlKHQpe1xuXHRcdC8vVXNlIHRoaXMgdG8gZXZhbHVhdGUgZXhwcigpIGFuZCB1cGRhdGUgdGhlIHJlc3VsdCwgY2FzY2FkZS1zdHlsZS5cblx0XHQvL3RoZSBudW1iZXIgb2YgYm91bmRzIHRoaXMgb2JqZWN0IGhhcyB3aWxsIGJlIHRoZSBudW1iZXIgb2YgZGltZW5zaW9ucy5cblx0XHQvL3RoZSBleHByKClzIGFyZSBjYWxsZWQgd2l0aCBleHByKGksIC4uLltjb29yZGluYXRlc10sIHQpLCBcblx0XHQvL1x0KHdoZXJlIGkgaXMgdGhlIGluZGV4IG9mIHRoZSBjdXJyZW50IGV2YWx1YXRpb24gPSB0aW1lcyBleHByKCkgaGFzIGJlZW4gY2FsbGVkIHRoaXMgZnJhbWUsIHQgPSBhYnNvbHV0ZSB0aW1lc3RlcCAocykpLlxuXHRcdC8vcGxlYXNlIGNhbGwgd2l0aCBhIHQgdmFsdWUgb2J0YWluZWQgZnJvbSBwZXJmb3JtYW5jZS5ub3coKS8xMDAwIG9yIHNvbWV0aGluZyBsaWtlIHRoYXRcblxuXHRcdC8vbm90ZSB0aGUgbGVzcy10aGFuLW9yLWVxdWFsLXRvIGluIHRoZXNlIGxvb3BzXG5cdFx0aWYodGhpcy5udW1EaW1lbnNpb25zID09IDEpe1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2krKyl7XG5cdFx0XHRcdGxldCBjMSA9IHRoaXMuYm91bmRzWzBdWzBdICsgKHRoaXMuYm91bmRzWzBdWzFdLXRoaXMuYm91bmRzWzBdWzBdKSooaS8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKSk7XG5cdFx0XHRcdGxldCBpbmRleCA9IGk7XG5cdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpbmRleCx0LGMxLDAsMCwwKTtcblx0XHRcdH1cblx0XHR9ZWxzZSBpZih0aGlzLm51bURpbWVuc2lvbnMgPT0gMil7XG5cdFx0XHQvL3RoaXMgY2FuIGJlIHJlZHVjZWQgaW50byBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgb3ZlciB0aGUgZmlyc3QgaW5kZXggb2YgdGhpcy5ib3VuZHMsIEkga25vdyBpdFxuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2krKyl7XG5cdFx0XHRcdGxldCBjMSA9IHRoaXMuYm91bmRzWzBdWzBdICsgKHRoaXMuYm91bmRzWzBdWzFdLXRoaXMuYm91bmRzWzBdWzBdKSooaS8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKSk7XG5cdFx0XHRcdGZvcih2YXIgaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtqKyspe1xuXHRcdFx0XHRcdGxldCBjMiA9IHRoaXMuYm91bmRzWzFdWzBdICsgKHRoaXMuYm91bmRzWzFdWzFdLXRoaXMuYm91bmRzWzFdWzBdKSooai8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKSk7XG5cdFx0XHRcdFx0bGV0IGluZGV4ID0gaSp0aGlzLml0ZW1EaW1lbnNpb25zWzFdICsgajtcblx0XHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSxjMiwwLDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1EaW1lbnNpb25zID09IDMpe1xuXHRcdFx0Ly90aGlzIGNhbiBiZSByZWR1Y2VkIGludG8gYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIG92ZXIgdGhlIGZpcnN0IGluZGV4IG9mIHRoaXMuYm91bmRzLCBJIGtub3cgaXRcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRmb3IodmFyIGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aisrKXtcblx0XHRcdFx0XHRsZXQgYzIgPSB0aGlzLmJvdW5kc1sxXVswXSArICh0aGlzLmJvdW5kc1sxXVsxXS10aGlzLmJvdW5kc1sxXVswXSkqKGovKHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSkpO1xuXHRcdFx0XHRcdGZvcih2YXIgaz0wO2s8dGhpcy5pdGVtRGltZW5zaW9uc1syXTtrKyspe1xuXHRcdFx0XHRcdFx0bGV0IGMzID0gdGhpcy5ib3VuZHNbMl1bMF0gKyAodGhpcy5ib3VuZHNbMl1bMV0tdGhpcy5ib3VuZHNbMl1bMF0pKihrLyh0aGlzLml0ZW1EaW1lbnNpb25zWzJdLTEpKTtcblx0XHRcdFx0XHRcdGxldCBpbmRleCA9IChpKnRoaXMuaXRlbURpbWVuc2lvbnNbMV0gKyBqKSp0aGlzLml0ZW1EaW1lbnNpb25zWzJdICsgaztcblx0XHRcdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpbmRleCx0LGMxLGMyLGMzLDApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1lbHNle1xuXHRcdFx0YXNzZXJ0KFwiVE9ETzogVXNlIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSB0byBsb29wIG92ZXIgYWxsIGluZGljZXMhXCIpO1xuXHRcdH1cblxuXHRcdHRoaXMub25BZnRlckFjdGl2YXRpb24oKTsgLy8gY2FsbCBjaGlsZHJlbiBpZiBuZWNlc3Nhcnlcblx0fVxuXHRfY2FsbEFsbENoaWxkcmVuKC4uLmNvb3JkaW5hdGVzKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcylcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgY2xvbmUgPSBuZXcgQXJlYSh7Ym91bmRzOiBVdGlscy5hcnJheUNvcHkodGhpcy5ib3VuZHMpLCBudW1JdGVtczogdGhpcy5udW1JdGVtc30pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdFx0aWYoY2xvbmUuY2hpbGRyZW5baV0uX29uQWRkKWNsb25lLmNoaWxkcmVuW2ldLl9vbkFkZCgpOyAvLyBuZWNlc3Nhcnkgbm93IHRoYXQgdGhlIGNoYWluIG9mIGFkZGluZyBoYXMgYmVlbiBlc3RhYmxpc2hlZFxuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cbn1cblxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdEFyZWEoKXtcblx0dmFyIHggPSBuZXcgQXJlYSh7Ym91bmRzOiBbWzAsMV0sWzAsMV1dfSk7XG5cdHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiBmdW5jdGlvbiguLi5hKXtjb25zb2xlLmxvZyguLi5hKX19KTtcblx0eC5hZGQoeSk7XG5cdHguYWN0aXZhdGUoKTtcbn1cblxuZXhwb3J0IHsgQXJlYSB9XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IE5vZGUgZnJvbSAnLi9Ob2RlLmpzJztcblxuLy9Vc2FnZTogdmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpfX0pO1xuY2xhc3MgVHJhbnNmb3JtYXRpb24gZXh0ZW5kcyBOb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHRzdXBlcigpO1xuXHRcblx0XHRFWFAuVXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyhvcHRpb25zLCBcImV4cHJcIik7IC8vIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgbXVsdGlkaW1lbnNpb25hbCBhcnJheVxuXHRcdEVYUC5VdGlscy5hc3NlcnRUeXBlKG9wdGlvbnMuZXhwciwgRnVuY3Rpb24pO1xuXG5cdFx0dGhpcy5leHByID0gb3B0aW9ucy5leHByO1xuXHR9XG5cdGV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcyl7XG5cdFx0Ly9ldmFsdWF0ZSB0aGlzIFRyYW5zZm9ybWF0aW9uJ3MgX2V4cHIsIGFuZCBicm9hZGNhc3QgdGhlIHJlc3VsdCB0byBhbGwgY2hpbGRyZW4uXG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMuZXhwciguLi5jb29yZGluYXRlcyk7XG5cdFx0aWYocmVzdWx0LmNvbnN0cnVjdG9yICE9PSBBcnJheSlyZXN1bHQgPSBbcmVzdWx0XTtcblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKGNvb3JkaW5hdGVzWzBdLGNvb3JkaW5hdGVzWzFdLCAuLi5yZXN1bHQpXG5cdFx0fVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IHRoaXNFeHByID0gdGhpcy5leHByO1xuXHRcdGxldCBjbG9uZSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogdGhpc0V4cHIuYmluZCgpfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxuXHRtYWtlTGluaygpe1xuICAgICAgICAvL2xpa2UgYSBjbG9uZSwgYnV0IHdpbGwgdXNlIHRoZSBzYW1lIGV4cHIgYXMgdGhpcyBUcmFuc2Zvcm1hdGlvbi5cbiAgICAgICAgLy91c2VmdWwgaWYgdGhlcmUncyBhIHNwZWNpZmljIGZ1bmN0aW9uIHRoYXQgbmVlZHMgdG8gYmUgdXNlZCBieSBhIGJ1bmNoIG9mIG9iamVjdHNcblx0XHRyZXR1cm4gbmV3IExpbmtlZFRyYW5zZm9ybWF0aW9uKHRoaXMpO1xuXHR9XG59XG5cbmNsYXNzIExpbmtlZFRyYW5zZm9ybWF0aW9uIGV4dGVuZHMgTm9kZXtcbiAgICAvKlxuICAgICAgICBMaWtlIGFuIEVYUC5UcmFuc2Zvcm1hdGlvbiwgYnV0IGl0IHVzZXMgYW4gZXhpc3RpbmcgRVhQLlRyYW5zZm9ybWF0aW9uJ3MgZXhwcigpLCBzbyBpZiB0aGUgbGlua2VkIHRyYW5zZm9ybWF0aW9uIHVwZGF0ZXMsIHNvIGRvZXMgdGhpcyBvbmUuIEl0J3MgbGlrZSBhIHBvaW50ZXIgdG8gYSBUcmFuc2Zvcm1hdGlvbiwgYnV0IGluIG9iamVjdCBmb3JtLiBcbiAgICAqL1xuXHRjb25zdHJ1Y3Rvcih0cmFuc2Zvcm1hdGlvblRvTGlua1RvKXtcblx0XHRzdXBlcih7fSk7XG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUodHJhbnNmb3JtYXRpb25Ub0xpbmtUbywgVHJhbnNmb3JtYXRpb24pO1xuICAgICAgICB0aGlzLmxpbmtlZFRyYW5zZm9ybWF0aW9uTm9kZSA9IHRyYW5zZm9ybWF0aW9uVG9MaW5rVG87XG5cdH1cblx0ZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKXtcblx0XHRsZXQgcmVzdWx0ID0gdGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUuZXhwciguLi5jb29yZGluYXRlcyk7XG5cdFx0aWYocmVzdWx0LmNvbnN0cnVjdG9yICE9PSBBcnJheSlyZXN1bHQgPSBbcmVzdWx0XTtcblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKGNvb3JkaW5hdGVzWzBdLGNvb3JkaW5hdGVzWzFdLCAuLi5yZXN1bHQpXG5cdFx0fVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IExpbmtlZFRyYW5zZm9ybWF0aW9uKHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlKTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG5cdG1ha2VMaW5rKCl7XG5cdFx0cmV0dXJuIG5ldyBMaW5rZWRUcmFuc2Zvcm1hdGlvbih0aGlzLmxpbmtlZFRyYW5zZm9ybWF0aW9uTm9kZSk7XG5cdH1cbn1cblxuXG5cblxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdFRyYW5zZm9ybWF0aW9uKCl7XG5cdHZhciB4ID0gbmV3IEFyZWEoe2JvdW5kczogW1stMTAsMTBdXX0pO1xuXHR2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7J2V4cHInOiAoeCkgPT4gY29uc29sZS5sb2coeCp4KX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSgpOyAvLyBzaG91bGQgcmV0dXJuIDEwMCwgODEsIDY0Li4uIDAsIDEsIDQuLi4gMTAwXG59XG5cbmV4cG9ydCB7IFRyYW5zZm9ybWF0aW9uLCBMaW5rZWRUcmFuc2Zvcm1hdGlvbn1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQgeyBEb21haW5Ob2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcblxuY2xhc3MgSGlzdG9yeVJlY29yZGVyIGV4dGVuZHMgRG9tYWluTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblxuICAgICAgICAvKlxuICAgICAgICAgICAgQ2xhc3MgdGhhdCByZWNvcmRzIHRoZSBsYXN0IGZldyB2YWx1ZXMgb2YgdGhlIHBhcmVudCBUcmFuc2Zvcm1hdGlvbiBhbmQgbWFrZXMgdGhlbSBhdmFpbGFibGUgZm9yIHVzZSBhcyBhbiBleHRyYSBkaW1lbnNpb24uXG4gICAgICAgICAgICBVc2FnZTpcbiAgICAgICAgICAgIHZhciByZWNvcmRlciA9IG5ldyBIaXN0b3J5UmVjb3JkZXIoe1xuICAgICAgICAgICAgICAgIG1lbW9yeUxlbmd0aDogMTAgLy8gaG93IG1hbnkgcGFzdCB2YWx1ZXMgdG8gc3RvcmU/XG4gICAgICAgICAgICAgICAgcmVjb3JkRnJhbWVJbnRlcnZhbDogMTUvL0hvdyBsb25nIHRvIHdhaXQgYmV0d2VlbiBlYWNoIGNhcHR1cmU/IE1lYXN1cmVkIGluIGZyYW1lcywgc28gNjAgPSAxIGNhcHR1cmUgcGVyIHNlY29uZCwgMzAgPSAyIGNhcHR1cmVzL3NlY29uZCwgZXRjLlxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGV4YW1wbGUgdXNhZ2U6XG4gICAgICAgICAgICBuZXcgQXJlYSh7Ym91bmRzOiBbWy01LDVdXX0pLmFkZChuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IChpLHQseCkgPT4gW01hdGguc2luKHgpLE1hdGguY29zKHgpXX0pKS5hZGQobmV3IEVYUC5IaXN0b3J5UmVjb3JkZXIoe21lbW9yeUxlbmd0aDogNX0pLmFkZChuZXcgTGluZU91dHB1dCh7d2lkdGg6IDUsIGNvbG9yOiAweGZmMDAwMH0pKTtcblxuICAgICAgICAgICAgTk9URTogSXQgaXMgYXNzdW1lZCB0aGF0IGFueSBwYXJlbnQgdHJhbnNmb3JtYXRpb24gb3V0cHV0cyBhbiBhcnJheSBvZiBudW1iZXJzIHRoYXQgaXMgNCBvciBsZXNzIGluIGxlbmd0aC5cbiAgICAgICAgKi9cblxuXHRcdHRoaXMubWVtb3J5TGVuZ3RoID0gb3B0aW9ucy5tZW1vcnlMZW5ndGggPT09IHVuZGVmaW5lZCA/IDEwIDogb3B0aW9ucy5tZW1vcnlMZW5ndGg7XG4gICAgICAgIHRoaXMucmVjb3JkRnJhbWVJbnRlcnZhbCA9IG9wdGlvbnMucmVjb3JkRnJhbWVJbnRlcnZhbCA9PT0gdW5kZWZpbmVkID8gMTUgOiBvcHRpb25zLnJlY29yZEZyYW1lSW50ZXJ2YWw7IC8vc2V0IHRvIDEgdG8gcmVjb3JkIGV2ZXJ5IGZyYW1lLlxuICAgICAgICB0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gNDsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT8gKHRvZG86IGF1dG9kZXRlY3QgdGhpcyBmcm9tIHBhcmVudCdzIG91dHB1dClcblx0XHR0aGlzLmN1cnJlbnRIaXN0b3J5SW5kZXg9MDtcbiAgICAgICAgdGhpcy5mcmFtZVJlY29yZFRpbWVyID0gMDtcblx0fVxuXHRfb25BZGQoKXtcblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgQXJlYVxuXHRcdGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5tZW1vcnlMZW5ndGg7XG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IHJvb3QuaXRlbURpbWVuc2lvbnMuY29uY2F0KFt0aGlzLm1lbW9yeUxlbmd0aF0pO1xuXG4gICAgICAgIHRoaXMuYnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMpO1xuICAgIFxuICAgICAgICAvL1RoaXMgaXMgc28gdGhhdCBubyBzdXJmYWNlL2JvdW5kYXJ5IHdpbGwgYXBwZWFyIHVudGlsIGhpc3RvcnkgYmVnaW5zIHRvIGJlIHJlY29yZGVkLiBJJ20gc28gc29ycnkuXG4gICAgICAgIC8vVG9kbzogcHJvcGVyIGNsaXAgc2hhZGVyIGxpa2UgbWF0aGJveCBkb2VzIG9yIHNvbWV0aGluZy5cbiAgICAgICAgdGhpcy5idWZmZXIuZmlsbChOYU4pOyBcblx0fVxuICAgIG9uQWZ0ZXJBY3RpdmF0aW9uKCl7XG4gICAgICAgIHN1cGVyLm9uQWZ0ZXJBY3RpdmF0aW9uKCk7XG5cbiAgICAgICAgLy9ldmVyeSBzbyBvZnRlbiwgc2hpZnQgdG8gdGhlIG5leHQgYnVmZmVyIHNsb3RcbiAgICAgICAgdGhpcy5mcmFtZVJlY29yZFRpbWVyICs9IDE7XG4gICAgICAgIGlmKHRoaXMuZnJhbWVSZWNvcmRUaW1lciA+PSB0aGlzLnJlY29yZEZyYW1lSW50ZXJ2YWwpe1xuICAgICAgICAgICAgLy9yZXNldCBmcmFtZSByZWNvcmQgdGltZXJcbiAgICAgICAgICAgIHRoaXMuZnJhbWVSZWNvcmRUaW1lciA9IDA7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRIaXN0b3J5SW5kZXggPSAodGhpcy5jdXJyZW50SGlzdG9yeUluZGV4KzEpJXRoaXMubWVtb3J5TGVuZ3RoO1xuICAgICAgICB9XG4gICAgfVxuXHRldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpe1xuXHRcdC8vZXZhbHVhdGUgdGhpcyBUcmFuc2Zvcm1hdGlvbidzIF9leHByLCBhbmQgYnJvYWRjYXN0IHRoZSByZXN1bHQgdG8gYWxsIGNoaWxkcmVuLlxuXHRcdGxldCBpID0gY29vcmRpbmF0ZXNbMF07XG5cdFx0bGV0IHQgPSBjb29yZGluYXRlc1sxXTtcbiAgICBcbiAgICAgICAgLy9zdGVwIDE6IHNhdmUgY29vcmRpbmF0ZXMgZm9yIHRoaXMgZnJhbWUgaW4gYnVmZmVyXG4gICAgICAgIGlmKGNvb3JkaW5hdGVzLmxlbmd0aCA+IDIrdGhpcy5fb3V0cHV0RGltZW5zaW9ucyl7XG4gICAgICAgICAgICAvL3RvZG86IG1ha2UgdGhpcyB1cGRhdGUgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyBhbmQgcmVhbGxvY2F0ZSBtb3JlIGJ1ZmZlciBzcGFjZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRVhQLkhpc3RvcnlSZWNvcmRlciBpcyB1bmFibGUgdG8gcmVjb3JkIGhpc3Rvcnkgb2Ygc29tZXRoaW5nIHRoYXQgb3V0cHV0cyBpbiBcIit0aGlzLl9vdXRwdXREaW1lbnNpb25zK1wiIGRpbWVuc2lvbnMhIFlldC5cIik7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3ljbGljQnVmZmVySW5kZXggPSAoaSp0aGlzLm1lbW9yeUxlbmd0aCt0aGlzLmN1cnJlbnRIaXN0b3J5SW5kZXgpKnRoaXMuX291dHB1dERpbWVuc2lvbnM7XG4gICAgICAgIGZvcih2YXIgaj0wO2o8Y29vcmRpbmF0ZXMubGVuZ3RoLTI7aisrKXsgXG4gICAgICAgICAgICB0aGlzLmJ1ZmZlcltjeWNsaWNCdWZmZXJJbmRleCtqXSA9IGNvb3JkaW5hdGVzWzIral07XG4gICAgICAgIH1cblxuICAgICAgICAvL3N0ZXAgMjosIGNhbGwgYW55IGNoaWxkcmVuIG9uY2UgcGVyIGhpc3RvcnkgaXRlbVxuICAgICAgICBmb3IodmFyIGNoaWxkTm89MDtjaGlsZE5vPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2NoaWxkTm8rKyl7XG5cdFx0ICAgIGZvcih2YXIgaj0wO2o8dGhpcy5tZW1vcnlMZW5ndGg7aisrKXtcblxuICAgICAgICAgICAgICAgIC8vdGhlICsxIGluIChqICsgdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4ICsgMSkgaXMgaW1wb3J0YW50OyB3aXRob3V0IGl0LCBhIExpbmVPdXRwdXQgd2lsbCBkcmF3IGEgbGluZSBmcm9tIHRoZSBtb3N0IHJlY2VudCB2YWx1ZSB0byB0aGUgZW5kIG9mIGhpc3RvcnlcbiAgICAgICAgICAgICAgICBsZXQgY3ljbGljSGlzdG9yeVZhbHVlID0gKGogKyB0aGlzLmN1cnJlbnRIaXN0b3J5SW5kZXggKyAxKSAlIHRoaXMubWVtb3J5TGVuZ3RoO1xuICAgICAgICAgICAgICAgIGxldCBjeWNsaWNCdWZmZXJJbmRleCA9IChpICogdGhpcy5tZW1vcnlMZW5ndGggKyBjeWNsaWNIaXN0b3J5VmFsdWUpKnRoaXMuX291dHB1dERpbWVuc2lvbnM7XG4gICAgICAgICAgICAgICAgbGV0IG5vbkN5Y2xpY0luZGV4ID0gaSAqIHRoaXMubWVtb3J5TGVuZ3RoICsgajtcblxuXHRcdCAgICAgICAgLy9JJ20gdG9ybiBvbiB3aGV0aGVyIHRvIGFkZCBhIGZpbmFsIGNvb3JkaW5hdGUgYXQgdGhlIGVuZCBzbyBoaXN0b3J5IGNhbiBnbyBvZmYgaW4gYSBuZXcgZGlyZWN0aW9uLlxuICAgICAgICAgICAgICAgIC8vdGhpcy5jaGlsZHJlbltjaGlsZE5vXS5ldmFsdWF0ZVNlbGYobm9uQ3ljbGljSW5kZXgsdCx0aGlzLmJ1ZmZlcltjeWNsaWNCdWZmZXJJbmRleF0sIGN5Y2xpY0hpc3RvcnlWYWx1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5jaGlsZHJlbltjaGlsZE5vXS5ldmFsdWF0ZVNlbGYoXG4gICAgICAgICAgICAgICAgICAgICAgICBub25DeWNsaWNJbmRleCx0LCAvL2ksdFxuICAgICAgICAgICAgICAgICAgICAgICAgLi4udGhpcy5idWZmZXIuc2xpY2UoY3ljbGljQnVmZmVySW5kZXgsY3ljbGljQnVmZmVySW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucykgLy9leHRyYWN0IGNvb3JkaW5hdGVzIGZvciB0aGlzIGhpc3RvcnkgdmFsdWUgZnJvbSBidWZmZXJcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgY2xvbmUgPSBuZXcgSGlzdG9yeVJlY29yZGVyKHttZW1vcnlMZW5ndGg6IHRoaXMubWVtb3J5TGVuZ3RoLCByZWNvcmRGcmFtZUludGVydmFsOiB0aGlzLnJlY29yZEZyYW1lSW50ZXJ2YWx9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cbmV4cG9ydCB7IEhpc3RvcnlSZWNvcmRlciB9XG4iLCJ2YXIgdGhyZWVFbnZpcm9ubWVudCA9IG51bGw7XG5cbmZ1bmN0aW9uIHNldFRocmVlRW52aXJvbm1lbnQobmV3RW52KXtcbiAgICB0aHJlZUVudmlyb25tZW50ID0gbmV3RW52O1xufVxuZnVuY3Rpb24gZ2V0VGhyZWVFbnZpcm9ubWVudCgpe1xuICAgIHJldHVybiB0aHJlZUVudmlyb25tZW50O1xufVxuZXhwb3J0IHtzZXRUaHJlZUVudmlyb25tZW50LCBnZXRUaHJlZUVudmlyb25tZW50LCB0aHJlZUVudmlyb25tZW50fTtcbiIsImltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi91dGlscy5qcyc7XG5cbmltcG9ydCB7IFRyYW5zZm9ybWF0aW9uIH0gZnJvbSAnLi9UcmFuc2Zvcm1hdGlvbi5qcyc7XG5cbmltcG9ydCAqIGFzIG1hdGggZnJvbSAnLi9tYXRoLmpzJztcbmltcG9ydCB7IHRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5sZXQgRVBTID0gTnVtYmVyLkVQU0lMT047XG5cbmNvbnN0IEVhc2luZyA9IHtFYXNlSW5PdXQ6MSxFYXNlSW46MixFYXNlT3V0OjN9O1xuXG5jbGFzcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICB0aGlzLnRvVmFsdWUgPSB0b1ZhbHVlO1xuICAgICAgICB0aGlzLmZyb21WYWx1ZSA9IGZyb21WYWx1ZTtcbiAgICAgICAgdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24gPSBpbnRlcnBvbGF0aW9uRnVuY3Rpb247XG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe30gLy9wZXJjZW50YWdlIGlzIDAtMSBsaW5lYXJseVxufVxuY2xhc3MgTnVtYmVySW50ZXJwb2xhdG9yIGV4dGVuZHMgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcbiAgICAgICAgc3VwZXIoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZShwZXJjZW50YWdlKXtcblx0XHRsZXQgdCA9IHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHBlcmNlbnRhZ2UpO1xuXHRcdHJldHVybiB0KnRoaXMudG9WYWx1ZSArICgxLXQpKnRoaXMuZnJvbVZhbHVlO1xuICAgIH1cbn1cblxuY2xhc3MgQm9vbEludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG4gICAgICAgIGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG4gICAgICAgIHRoaXMudGFyZ2V0W3Byb3BlcnR5TmFtZV0gPSB0ID4gMC41ID8gdGhpcy50b1ZhbHVlIDogdGhpcy5mcm9tVmFsdWU7XG4gICAgfVxufVxuXG5cbmNsYXNzIFRocmVlSnNDb2xvckludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy50ZW1wVmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IoKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG4gICAgICAgIGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG4gICAgICAgIHRoaXMudGVtcFZhbHVlLmNvcHkodGhpcy5mcm9tVmFsdWUpO1xuICAgICAgICByZXR1cm4gdGhpcy50ZW1wVmFsdWUubGVycCh0aGlzLnRvVmFsdWUsIHQpO1xuICAgIH1cbn1cblxuY2xhc3MgVHJhbnNmb3JtYXRpb25GdW5jdGlvbkludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbiwgc3RhZ2dlckZyYWN0aW9uLCB0YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgIHRoaXMuc3RhZ2dlckZyYWN0aW9uID0gc3RhZ2dlckZyYWN0aW9uO1xuICAgICAgICB0aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbjtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG5cdFx0XHQvL2lmIHN0YWdnZXJGcmFjdGlvbiAhPSAwLCBpdCdzIHRoZSBhbW91bnQgb2YgdGltZSBiZXR3ZWVuIHRoZSBmaXJzdCBwb2ludCdzIHN0YXJ0IHRpbWUgYW5kIHRoZSBsYXN0IHBvaW50J3Mgc3RhcnQgdGltZS5cblx0XHRcdC8vQVNTVU1QVElPTjogdGhlIGZpcnN0IHZhcmlhYmxlIG9mIHRoaXMgZnVuY3Rpb24gaXMgaSwgYW5kIGl0J3MgYXNzdW1lZCBpIGlzIHplcm8taW5kZXhlZC5cblx0XHRcdC8vZW5jYXBzdWxhdGUgcGVyY2VudGFnZVxuXG5cdFx0XHRyZXR1cm4gKGZ1bmN0aW9uKC4uLmNvb3Jkcyl7XG4gICAgICAgICAgICAgICAgY29uc3QgaSA9IGNvb3Jkc1swXTtcblx0XHRcdFx0bGV0IGxlcnBGYWN0b3IgPSBwZXJjZW50YWdlO1xuXG4gICAgICAgICAgICAgICAgLy9mYW5jeSBzdGFnZ2VyaW5nIG1hdGgsIGlmIHdlIGtub3cgaG93IG1hbnkgb2JqZWN0cyBhcmUgZmxvd2luZyB0aHJvdWdoIHRoaXMgdHJhbnNmb3JtYXRpb24gYXQgb25jZVxuICAgICAgICAgICAgICAgIGlmKHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uICE9PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgICAgICAgICBsZXJwRmFjdG9yID0gcGVyY2VudGFnZS8oMS10aGlzLnN0YWdnZXJGcmFjdGlvbitFUFMpIC0gaSp0aGlzLnN0YWdnZXJGcmFjdGlvbi90aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbjtcbiAgICAgICAgICAgICAgICB9XG5cdFx0XHRcdC8vbGV0IHBlcmNlbnQgPSBNYXRoLm1pbihNYXRoLm1heChwZXJjZW50YWdlIC0gaS90aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbiAgICwxKSwwKTtcblxuXHRcdFx0XHRsZXQgdCA9IHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKE1hdGgubWF4KE1hdGgubWluKGxlcnBGYWN0b3IsMSksMCkpO1xuXHRcdFx0XHRyZXR1cm4gbWF0aC5sZXJwVmVjdG9ycyh0LHRoaXMudG9WYWx1ZSguLi5jb29yZHMpLHRoaXMuZnJvbVZhbHVlKC4uLmNvb3JkcykpXG5cdFx0XHR9KS5iaW5kKHRoaXMpO1xuICAgIH1cbn1cblxuY2xhc3MgTnVtZXJpYzFEQXJyYXlJbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgIHRoaXMubGFyZ2VzdExlbmd0aCA9IE1hdGgubWF4KGZyb21WYWx1ZS5sZW5ndGgsIHRvVmFsdWUubGVuZ3RoKTtcbiAgICAgICAgdGhpcy5zaG9ydGVzdExlbmd0aCA9IE1hdGgubWluKGZyb21WYWx1ZS5sZW5ndGgsIHRvVmFsdWUubGVuZ3RoKTtcbiAgICAgICAgdGhpcy5mcm9tVmFsdWVJc1Nob3J0ZXIgPSBmcm9tVmFsdWUubGVuZ3RoIDwgdG9WYWx1ZS5sZW5ndGg7XG4gICAgICAgIHRoaXMucmVzdWx0QXJyYXkgPSBuZXcgQXJyYXkodGhpcy5sYXJnZXN0TGVuZ3RoKTsgLy9jYWNoZWQgZm9yIHNwZWVkdXBcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG5cdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcbiAgICAgICAgZm9yKGxldCBpPTA7aTx0aGlzLnNob3J0ZXN0TGVuZ3RoO2krKyl7XG4gICAgICAgICAgICB0aGlzLnJlc3VsdEFycmF5W2ldID0gdCp0aGlzLnRvVmFsdWVbaV0gKyAoMS10KSp0aGlzLmZyb21WYWx1ZVtpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vaWYgb25lIGFycmF5IGlzIGxvbmdlciB0aGFuIHRoZSBvdGhlciwgaW50ZXJwb2xhdGUgYXMgaWYgdGhlIHNob3J0ZXIgYXJyYXkgaXMgcGFkZGVkIHdpdGggemVyb2VzXG4gICAgICAgIGlmKHRoaXMuZnJvbVZhbHVlSXNTaG9ydGVyKXtcbiAgICAgICAgICAgIC8vdGhpcy5mcm9tVmFsdWVbaV0gZG9lc24ndCBleGlzdCwgc28gYXNzdW1lIGl0J3MgYSB6ZXJvXG4gICAgICAgICAgICBmb3IobGV0IGk9dGhpcy5zaG9ydGVzdExlbmd0aDtpPHRoaXMubG9uZ2VzdExlbmd0aDtpKyspe1xuICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0QXJyYXlbaV0gPSB0KnRoaXMudG9WYWx1ZVtpXTsgLy8gKyAoMS10KSowO1xuICAgICAgICAgICAgfVxuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIC8vdGhpcy50b1ZhbHVlW2ldIGRvZXNuJ3QgZXhpc3QsIHNvIGFzc3VtZSBpdCdzIGEgemVyb1xuICAgICAgICAgICAgZm9yKGxldCBpPXRoaXMuc2hvcnRlc3RMZW5ndGg7aTx0aGlzLmxvbmdlc3RMZW5ndGg7aSsrKXtcbiAgICAgICAgICAgICAgICB0aGlzLnJlc3VsdEFycmF5W2ldID0gKDEtdCkqdGhpcy5mcm9tVmFsdWVbaV07IC8vICsgdCowIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnJlc3VsdEFycmF5O1xuICAgIH1cbn1cblxuXG5cblxuXG5cblxuY2xhc3MgQW5pbWF0aW9ue1xuXHRjb25zdHJ1Y3Rvcih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbj0xLCBvcHRpb25hbEFyZ3VtZW50cz17fSl7XG4gICAgICAgIGlmKCFVdGlscy5pc09iamVjdCh0b1ZhbHVlcykgJiYgIVV0aWxzLmlzQXJyYXkodG9WYWx1ZXMpKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcIkVycm9yIHRyYW5zaXRpb25pbmc6IHRvVmFsdWVzIG11c3QgYmUgYW4gYXJyYXkgb3IgYW4gb2JqZWN0LlwiKTtcbiAgICAgICAgfVxuXG5cdFx0dGhpcy50b1ZhbHVlcyA9IHRvVmFsdWVzO1xuXHRcdHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1x0XG5cdFx0dGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uOyAvL2luIHNcblxuICAgICAgICAvL1BhcnNlIG9wdGlvbmFsIHZhbHVlcyBpbiBvcHRpb25hbEFyZ3VtZW50c1xuXG4gICAgICAgIC8vY2hvb3NlIGVhc2luZyBmdW5jdGlvblxuICAgICAgICB0aGlzLmVhc2luZyA9IG9wdGlvbmFsQXJndW1lbnRzLmVhc2luZyA9PT0gdW5kZWZpbmVkID8gRWFzaW5nLkVhc2VJbk91dCA6IG9wdGlvbmFsQXJndW1lbnRzLmVhc2luZzsvL2RlZmF1bHQsIEVhc2luZy5FYXNlSW5PdXRcbiAgICAgICAgdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24gPSBBbmltYXRpb24uY29zaW5lRWFzZUluT3V0SW50ZXJwb2xhdGlvbjsgXG4gICAgICAgIGlmKHRoaXMuZWFzaW5nID09IEVhc2luZy5FYXNlSW4pe1xuICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24gPSBBbmltYXRpb24uY29zaW5lRWFzZUluSW50ZXJwb2xhdGlvbjtcbiAgICAgICAgfWVsc2UgaWYodGhpcy5lYXNpbmcgPT0gRWFzaW5nLkVhc2VPdXQpe1xuICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24gPSBBbmltYXRpb24uY29zaW5lRWFzZU91dEludGVycG9sYXRpb247XG4gICAgICAgIH1cblxuICAgICAgICAvL3NldHVwIHZhbHVlcyBuZWVkZWQgZm9yIHN0YWdnZXJlZCBhbmltYXRpb25cbiAgICAgICAgdGhpcy5zdGFnZ2VyRnJhY3Rpb24gPSBvcHRpb25hbEFyZ3VtZW50cy5zdGFnZ2VyRnJhY3Rpb24gPT09IHVuZGVmaW5lZCA/IDAgOiBvcHRpb25hbEFyZ3VtZW50cy5zdGFnZ2VyRnJhY3Rpb247IC8vIHRpbWUgaW4gbXMgYmV0d2VlbiBmaXJzdCBlbGVtZW50IGJlZ2lubmluZyB0aGUgYW5pbWF0aW9uIGFuZCBsYXN0IGVsZW1lbnQgYmVnaW5uaW5nIHRoZSBhbmltYXRpb24uIFNob3VsZCBiZSBsZXNzIHRoYW4gZHVyYXRpb24uXG5cdFx0VXRpbHMuYXNzZXJ0KHRoaXMuc3RhZ2dlckZyYWN0aW9uID49IDAgJiYgdGhpcy5zdGFnZ2VyRnJhY3Rpb24gPCAxKTtcblx0XHRpZih0YXJnZXQuY29uc3RydWN0b3IgPT09IFRyYW5zZm9ybWF0aW9uKXtcblx0XHRcdHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gdGFyZ2V0LmdldFRvcFBhcmVudCgpLm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR9ZWxzZXtcblx0XHRcdGlmKHRoaXMuc3RhZ2dlckZyYWN0aW9uICE9IDApe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwic3RhZ2dlckZyYWN0aW9uIGNhbiBvbmx5IGJlIHVzZWQgd2hlbiBUcmFuc2l0aW9uVG8ncyB0YXJnZXQgaXMgYW4gRVhQLlRyYW5zZm9ybWF0aW9uIVwiKTtcblx0XHRcdH1cblx0XHR9XG4gICAgICAgIFxuXHRcdHRoaXMuZnJvbVZhbHVlcyA9IHt9O1xuICAgICAgICB0aGlzLmludGVycG9sYXRvcnMgPSBbXTtcbiAgICAgICAgdGhpcy5pbnRlcnBvbGF0aW5nUHJvcGVydHlOYW1lcyA9IFtdO1xuXHRcdGZvcih2YXIgcHJvcGVydHkgaW4gdGhpcy50b1ZhbHVlcyl7XG5cdFx0XHRVdGlscy5hc3NlcnRQcm9wRXhpc3RzKHRoaXMudGFyZ2V0LCBwcm9wZXJ0eSk7XG5cblx0XHRcdC8vY29weSBwcm9wZXJ0eSwgbWFraW5nIHN1cmUgdG8gc3RvcmUgdGhlIGNvcnJlY3QgJ3RoaXMnXG5cdFx0XHRpZihVdGlscy5pc0Z1bmN0aW9uKHRoaXMudGFyZ2V0W3Byb3BlcnR5XSkpe1xuXHRcdFx0XHR0aGlzLmZyb21WYWx1ZXNbcHJvcGVydHldID0gdGhpcy50YXJnZXRbcHJvcGVydHldLmJpbmQodGhpcy50YXJnZXQpO1xuXHRcdFx0fWVsc2V7XG5cdFx0XHRcdHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0gPSB0aGlzLnRhcmdldFtwcm9wZXJ0eV07XG5cdFx0XHR9XG5cbiAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdG9ycy5wdXNoKHRoaXMuY2hvb3NlSW50ZXJwb2xhdG9yKHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0sIHRoaXMudG9WYWx1ZXNbcHJvcGVydHldLHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKSk7XG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRpbmdQcm9wZXJ0eU5hbWVzLnB1c2gocHJvcGVydHkpO1xuXHRcdH1cblxuXG5cdFx0dGhpcy5lbGFwc2VkVGltZSA9IDA7XG4gICAgICAgIHRoaXMucHJldlRydWVUaW1lID0gMDtcblxuXHRcdC8vYmVnaW5cblx0XHR0aGlzLl91cGRhdGVDYWxsYmFjayA9IHRoaXMudXBkYXRlLmJpbmQodGhpcylcblx0XHR0aHJlZUVudmlyb25tZW50Lm9uKFwidXBkYXRlXCIsdGhpcy5fdXBkYXRlQ2FsbGJhY2spO1xuXHR9XG4gICAgY2hvb3NlSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcblx0XHRpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mKGZyb21WYWx1ZSkgPT09IFwibnVtYmVyXCIpe1xuICAgICAgICAgICAgLy9udW1iZXItbnVtYmVyXG4gICAgICAgICAgICByZXR1cm4gbmV3IE51bWJlckludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXNGdW5jdGlvbih0b1ZhbHVlKSAmJiBVdGlscy5pc0Z1bmN0aW9uKGZyb21WYWx1ZSkpe1xuICAgICAgICAgICAgLy9mdW5jdGlvbi1mdW5jdGlvblxuXHRcdFx0cmV0dXJuIG5ldyBUcmFuc2Zvcm1hdGlvbkZ1bmN0aW9uSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uLCB0aGlzLnN0YWdnZXJGcmFjdGlvbiwgdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24pO1xuXHRcdH1lbHNlIGlmKHRvVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLkNvbG9yICYmIGZyb21WYWx1ZS5jb25zdHJ1Y3RvciA9PT0gVEhSRUUuQ29sb3Ipe1xuICAgICAgICAgICAgLy9USFJFRS5Db2xvclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBUaHJlZUpzQ29sb3JJbnRlcnBvbGF0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB9ZWxzZSBpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwiYm9vbGVhblwiICYmIHR5cGVvZihmcm9tVmFsdWUpID09PSBcImJvb2xlYW5cIil7XG4gICAgICAgICAgICAvL2Jvb2xlYW5cbiAgICAgICAgICAgIHJldHVybiBuZXcgQm9vbEludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXMxRE51bWVyaWNBcnJheSh0b1ZhbHVlKSAmJiBVdGlscy5pczFETnVtZXJpY0FycmF5KGZyb21WYWx1ZSkpe1xuICAgICAgICAgICAgLy9mdW5jdGlvbi1mdW5jdGlvblxuXHRcdFx0cmV0dXJuIG5ldyBOdW1lcmljMURBcnJheUludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgLy9XZSBkb24ndCBrbm93IGhvdyB0byBpbnRlcnBvbGF0ZSB0aGlzLiBJbnN0ZWFkIHdlJ2xsIGp1c3QgZG8gbm90aGluZywgYW5kIGF0IHRoZSBlbmQgb2YgdGhlIGFuaW1hdGlvbiB3ZSdsbCBqdXN0IHNldCB0aGUgdGFyZ2V0IHRvIHRoZSB0b1ZhbHVlLlxuXHRcdFx0Y29uc29sZS5lcnJvcihcIkFuaW1hdGlvbiBjbGFzcyBjYW5ub3QgeWV0IGhhbmRsZSB0cmFuc2l0aW9uaW5nIGJldHdlZW4gdGhpbmdzIHRoYXQgYXJlbid0IG51bWJlcnMgb3IgZnVuY3Rpb25zIVwiKTtcblx0XHR9XG4gICAgfVxuXHR1cGRhdGUodGltZSl7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSB0aW1lLnJlYWx0aW1lRGVsdGE7XHRcblxuXHRcdGxldCBwZXJjZW50YWdlID0gdGhpcy5lbGFwc2VkVGltZS90aGlzLmR1cmF0aW9uO1xuXG5cdFx0Ly9pbnRlcnBvbGF0ZSB2YWx1ZXNcblx0XHRmb3IobGV0IGk9MDtpPHRoaXMuaW50ZXJwb2xhdG9ycy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGxldCBwcm9wZXJ0eU5hbWUgPSB0aGlzLmludGVycG9sYXRpbmdQcm9wZXJ0eU5hbWVzW2ldO1xuXHRcdFx0dGhpcy50YXJnZXRbcHJvcGVydHlOYW1lXSA9IHRoaXMuaW50ZXJwb2xhdG9yc1tpXS5pbnRlcnBvbGF0ZShwZXJjZW50YWdlKTtcblx0XHR9XG5cblx0XHRpZih0aGlzLmVsYXBzZWRUaW1lID49IHRoaXMuZHVyYXRpb24pe1xuXHRcdFx0dGhpcy5lbmQoKTtcblx0XHR9XG5cdH1cblx0c3RhdGljIGNvc2luZUVhc2VJbk91dEludGVycG9sYXRpb24oeCl7XG5cdFx0cmV0dXJuICgxLU1hdGguY29zKHgqTWF0aC5QSSkpLzI7XG5cdH1cblx0c3RhdGljIGNvc2luZUVhc2VJbkludGVycG9sYXRpb24oeCl7XG5cdFx0cmV0dXJuICgxLU1hdGguY29zKHgqTWF0aC5QSS8yKSk7XG5cdH1cblx0c3RhdGljIGNvc2luZUVhc2VPdXRJbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiBNYXRoLnNpbih4ICogTWF0aC5QSS8yKTtcblx0fVxuXHRzdGF0aWMgbGluZWFySW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4geDtcblx0fVxuXHRlbmQoKXtcblx0XHRmb3IodmFyIHByb3AgaW4gdGhpcy50b1ZhbHVlcyl7XG5cdFx0XHR0aGlzLnRhcmdldFtwcm9wXSA9IHRoaXMudG9WYWx1ZXNbcHJvcF07XG5cdFx0fVxuXHRcdHRocmVlRW52aXJvbm1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInVwZGF0ZVwiLHRoaXMuX3VwZGF0ZUNhbGxiYWNrKTtcblx0fVxufVxuXG5mdW5jdGlvbiBUcmFuc2l0aW9uVG8odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUywgb3B0aW9uYWxBcmd1bWVudHMpe1xuICAgIC8vaWYgc29tZW9uZSdzIHVzaW5nIHRoZSBvbGQgY2FsbGluZyBzdHJhdGVneSBvZiBzdGFnZ2VyRnJhY3Rpb24gYXMgdGhlIGxhc3QgYXJndW1lbnQsIGNvbnZlcnQgaXQgcHJvcGVybHlcbiAgICBpZihVdGlscy5pc051bWJlcihvcHRpb25hbEFyZ3VtZW50cykpe1xuICAgICAgICBvcHRpb25hbEFyZ3VtZW50cyA9IHtzdGFnZ2VyRnJhY3Rpb246IG9wdGlvbmFsQXJndW1lbnRzfTtcbiAgICB9XG5cdHZhciBhbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGR1cmF0aW9uTVMvMTAwMCwgb3B0aW9uYWxBcmd1bWVudHMpO1xufVxuXG5leHBvcnQge1RyYW5zaXRpb25UbywgQW5pbWF0aW9uLCBFYXNpbmd9XG4iLCIoZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgbG9va3VwID0gW1xuXHRcdFx0J0EnLCAnQicsICdDJywgJ0QnLCAnRScsICdGJywgJ0cnLCAnSCcsXG5cdFx0XHQnSScsICdKJywgJ0snLCAnTCcsICdNJywgJ04nLCAnTycsICdQJyxcblx0XHRcdCdRJywgJ1InLCAnUycsICdUJywgJ1UnLCAnVicsICdXJywgJ1gnLFxuXHRcdFx0J1knLCAnWicsICdhJywgJ2InLCAnYycsICdkJywgJ2UnLCAnZicsXG5cdFx0XHQnZycsICdoJywgJ2knLCAnaicsICdrJywgJ2wnLCAnbScsICduJyxcblx0XHRcdCdvJywgJ3AnLCAncScsICdyJywgJ3MnLCAndCcsICd1JywgJ3YnLFxuXHRcdFx0J3cnLCAneCcsICd5JywgJ3onLCAnMCcsICcxJywgJzInLCAnMycsXG5cdFx0XHQnNCcsICc1JywgJzYnLCAnNycsICc4JywgJzknLCAnKycsICcvJ1xuXHRcdF07XG5cdGZ1bmN0aW9uIGNsZWFuKGxlbmd0aCkge1xuXHRcdHZhciBpLCBidWZmZXIgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuXHRcdGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0YnVmZmVyW2ldID0gMDtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdGZ1bmN0aW9uIGV4dGVuZChvcmlnLCBsZW5ndGgsIGFkZExlbmd0aCwgbXVsdGlwbGVPZikge1xuXHRcdHZhciBuZXdTaXplID0gbGVuZ3RoICsgYWRkTGVuZ3RoLFxuXHRcdFx0YnVmZmVyID0gY2xlYW4oKHBhcnNlSW50KG5ld1NpemUgLyBtdWx0aXBsZU9mKSArIDEpICogbXVsdGlwbGVPZik7XG5cblx0XHRidWZmZXIuc2V0KG9yaWcpO1xuXG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdGZ1bmN0aW9uIHBhZChudW0sIGJ5dGVzLCBiYXNlKSB7XG5cdFx0bnVtID0gbnVtLnRvU3RyaW5nKGJhc2UgfHwgOCk7XG5cdFx0cmV0dXJuIFwiMDAwMDAwMDAwMDAwXCIuc3Vic3RyKG51bS5sZW5ndGggKyAxMiAtIGJ5dGVzKSArIG51bTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN0cmluZ1RvVWludDggKGlucHV0LCBvdXQsIG9mZnNldCkge1xuXHRcdHZhciBpLCBsZW5ndGg7XG5cblx0XHRvdXQgPSBvdXQgfHwgY2xlYW4oaW5wdXQubGVuZ3RoKTtcblxuXHRcdG9mZnNldCA9IG9mZnNldCB8fCAwO1xuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IGlucHV0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRvdXRbb2Zmc2V0XSA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRvZmZzZXQgKz0gMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0O1xuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoO1xuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXTtcblx0XHR9O1xuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSk7XG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApO1xuXHRcdH1cblxuXHRcdC8vIHRoaXMgcHJldmVudHMgYW4gRVJSX0lOVkFMSURfVVJMIGluIENocm9tZSAoRmlyZWZveCBva2F5KVxuXHRcdHN3aXRjaCAob3V0cHV0Lmxlbmd0aCAlIDQpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0b3V0cHV0ICs9ICc9Jztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdG91dHB1dCArPSAnPT0nO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHR3aW5kb3cudXRpbHMgPSB7fVxuXHR3aW5kb3cudXRpbHMuY2xlYW4gPSBjbGVhbjtcblx0d2luZG93LnV0aWxzLnBhZCA9IHBhZDtcblx0d2luZG93LnV0aWxzLmV4dGVuZCA9IGV4dGVuZDtcblx0d2luZG93LnV0aWxzLnN0cmluZ1RvVWludDggPSBzdHJpbmdUb1VpbnQ4O1xuXHR3aW5kb3cudXRpbHMudWludDhUb0Jhc2U2NCA9IHVpbnQ4VG9CYXNlNjQ7XG59KCkpO1xuXG4oZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuLypcbnN0cnVjdCBwb3NpeF9oZWFkZXIgeyAgICAgICAgICAgICAvLyBieXRlIG9mZnNldFxuXHRjaGFyIG5hbWVbMTAwXTsgICAgICAgICAgICAgICAvLyAgIDBcblx0Y2hhciBtb2RlWzhdOyAgICAgICAgICAgICAgICAgLy8gMTAwXG5cdGNoYXIgdWlkWzhdOyAgICAgICAgICAgICAgICAgIC8vIDEwOFxuXHRjaGFyIGdpZFs4XTsgICAgICAgICAgICAgICAgICAvLyAxMTZcblx0Y2hhciBzaXplWzEyXTsgICAgICAgICAgICAgICAgLy8gMTI0XG5cdGNoYXIgbXRpbWVbMTJdOyAgICAgICAgICAgICAgIC8vIDEzNlxuXHRjaGFyIGNoa3N1bVs4XTsgICAgICAgICAgICAgICAvLyAxNDhcblx0Y2hhciB0eXBlZmxhZzsgICAgICAgICAgICAgICAgLy8gMTU2XG5cdGNoYXIgbGlua25hbWVbMTAwXTsgICAgICAgICAgIC8vIDE1N1xuXHRjaGFyIG1hZ2ljWzZdOyAgICAgICAgICAgICAgICAvLyAyNTdcblx0Y2hhciB2ZXJzaW9uWzJdOyAgICAgICAgICAgICAgLy8gMjYzXG5cdGNoYXIgdW5hbWVbMzJdOyAgICAgICAgICAgICAgIC8vIDI2NVxuXHRjaGFyIGduYW1lWzMyXTsgICAgICAgICAgICAgICAvLyAyOTdcblx0Y2hhciBkZXZtYWpvcls4XTsgICAgICAgICAgICAgLy8gMzI5XG5cdGNoYXIgZGV2bWlub3JbOF07ICAgICAgICAgICAgIC8vIDMzN1xuXHRjaGFyIHByZWZpeFsxNTVdOyAgICAgICAgICAgICAvLyAzNDVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyA1MDBcbn07XG4qL1xuXG5cdHZhciB1dGlscyA9IHdpbmRvdy51dGlscyxcblx0XHRoZWFkZXJGb3JtYXQ7XG5cblx0aGVhZGVyRm9ybWF0ID0gW1xuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlTmFtZScsXG5cdFx0XHQnbGVuZ3RoJzogMTAwXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZU1vZGUnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd1aWQnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdnaWQnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlU2l6ZScsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtdGltZScsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdjaGVja3N1bScsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3R5cGUnLFxuXHRcdFx0J2xlbmd0aCc6IDFcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdsaW5rTmFtZScsXG5cdFx0XHQnbGVuZ3RoJzogMTAwXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndXN0YXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdvd25lcicsXG5cdFx0XHQnbGVuZ3RoJzogMzJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdncm91cCcsXG5cdFx0XHQnbGVuZ3RoJzogMzJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtYWpvck51bWJlcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ21pbm9yTnVtYmVyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZW5hbWVQcmVmaXgnLFxuXHRcdFx0J2xlbmd0aCc6IDE1NVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3BhZGRpbmcnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fVxuXHRdO1xuXG5cdGZ1bmN0aW9uIGZvcm1hdEhlYWRlcihkYXRhLCBjYikge1xuXHRcdHZhciBidWZmZXIgPSB1dGlscy5jbGVhbig1MTIpLFxuXHRcdFx0b2Zmc2V0ID0gMDtcblxuXHRcdGhlYWRlckZvcm1hdC5mb3JFYWNoKGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0dmFyIHN0ciA9IGRhdGFbdmFsdWUuZmllbGRdIHx8IFwiXCIsXG5cdFx0XHRcdGksIGxlbmd0aDtcblxuXHRcdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gc3RyLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRcdGJ1ZmZlcltvZmZzZXRdID0gc3RyLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRcdG9mZnNldCArPSAxO1xuXHRcdFx0fVxuXG5cdFx0XHRvZmZzZXQgKz0gdmFsdWUubGVuZ3RoIC0gaTsgLy8gc3BhY2UgaXQgb3V0IHdpdGggbnVsbHNcblx0XHR9KTtcblxuXHRcdGlmICh0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiBjYihidWZmZXIsIG9mZnNldCk7XG5cdFx0fVxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHR3aW5kb3cuaGVhZGVyID0ge31cblx0d2luZG93LmhlYWRlci5zdHJ1Y3R1cmUgPSBoZWFkZXJGb3JtYXQ7XG5cdHdpbmRvdy5oZWFkZXIuZm9ybWF0ID0gZm9ybWF0SGVhZGVyO1xufSgpKTtcblxuKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIGhlYWRlciA9IHdpbmRvdy5oZWFkZXIsXG5cdFx0dXRpbHMgPSB3aW5kb3cudXRpbHMsXG5cdFx0cmVjb3JkU2l6ZSA9IDUxMixcblx0XHRibG9ja1NpemU7XG5cblx0ZnVuY3Rpb24gVGFyKHJlY29yZHNQZXJCbG9jaykge1xuXHRcdHRoaXMud3JpdHRlbiA9IDA7XG5cdFx0YmxvY2tTaXplID0gKHJlY29yZHNQZXJCbG9jayB8fCAyMCkgKiByZWNvcmRTaXplO1xuXHRcdHRoaXMub3V0ID0gdXRpbHMuY2xlYW4oYmxvY2tTaXplKTtcblx0XHR0aGlzLmJsb2NrcyA9IFtdO1xuXHRcdHRoaXMubGVuZ3RoID0gMDtcblx0fVxuXG5cdFRhci5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24gKGZpbGVwYXRoLCBpbnB1dCwgb3B0cywgY2FsbGJhY2spIHtcblx0XHR2YXIgZGF0YSxcblx0XHRcdGNoZWNrc3VtLFxuXHRcdFx0bW9kZSxcblx0XHRcdG10aW1lLFxuXHRcdFx0dWlkLFxuXHRcdFx0Z2lkLFxuXHRcdFx0aGVhZGVyQXJyO1xuXG5cdFx0aWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGlucHV0ID0gdXRpbHMuc3RyaW5nVG9VaW50OChpbnB1dCk7XG5cdFx0fSBlbHNlIGlmIChpbnB1dC5jb25zdHJ1Y3RvciAhPT0gVWludDhBcnJheS5wcm90b3R5cGUuY29uc3RydWN0b3IpIHtcblx0XHRcdHRocm93ICdJbnZhbGlkIGlucHV0IHR5cGUuIFlvdSBnYXZlIG1lOiAnICsgaW5wdXQuY29uc3RydWN0b3IudG9TdHJpbmcoKS5tYXRjaCgvZnVuY3Rpb25cXHMqKFskQS1aYS16X11bMC05QS1aYS16X10qKVxccypcXCgvKVsxXTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGNhbGxiYWNrID0gb3B0cztcblx0XHRcdG9wdHMgPSB7fTtcblx0XHR9XG5cblx0XHRvcHRzID0gb3B0cyB8fCB7fTtcblxuXHRcdG1vZGUgPSBvcHRzLm1vZGUgfHwgcGFyc2VJbnQoJzc3NycsIDgpICYgMHhmZmY7XG5cdFx0bXRpbWUgPSBvcHRzLm10aW1lIHx8IE1hdGguZmxvb3IoK25ldyBEYXRlKCkgLyAxMDAwKTtcblx0XHR1aWQgPSBvcHRzLnVpZCB8fCAwO1xuXHRcdGdpZCA9IG9wdHMuZ2lkIHx8IDA7XG5cblx0XHRkYXRhID0ge1xuXHRcdFx0ZmlsZU5hbWU6IGZpbGVwYXRoLFxuXHRcdFx0ZmlsZU1vZGU6IHV0aWxzLnBhZChtb2RlLCA3KSxcblx0XHRcdHVpZDogdXRpbHMucGFkKHVpZCwgNyksXG5cdFx0XHRnaWQ6IHV0aWxzLnBhZChnaWQsIDcpLFxuXHRcdFx0ZmlsZVNpemU6IHV0aWxzLnBhZChpbnB1dC5sZW5ndGgsIDExKSxcblx0XHRcdG10aW1lOiB1dGlscy5wYWQobXRpbWUsIDExKSxcblx0XHRcdGNoZWNrc3VtOiAnICAgICAgICAnLFxuXHRcdFx0dHlwZTogJzAnLCAvLyBqdXN0IGEgZmlsZVxuXHRcdFx0dXN0YXI6ICd1c3RhciAgJyxcblx0XHRcdG93bmVyOiBvcHRzLm93bmVyIHx8ICcnLFxuXHRcdFx0Z3JvdXA6IG9wdHMuZ3JvdXAgfHwgJydcblx0XHR9O1xuXG5cdFx0Ly8gY2FsY3VsYXRlIHRoZSBjaGVja3N1bVxuXHRcdGNoZWNrc3VtID0gMDtcblx0XHRPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdHZhciBpLCB2YWx1ZSA9IGRhdGFba2V5XSwgbGVuZ3RoO1xuXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB2YWx1ZS5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0XHRjaGVja3N1bSArPSB2YWx1ZS5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0ZGF0YS5jaGVja3N1bSA9IHV0aWxzLnBhZChjaGVja3N1bSwgNikgKyBcIlxcdTAwMDAgXCI7XG5cblx0XHRoZWFkZXJBcnIgPSBoZWFkZXIuZm9ybWF0KGRhdGEpO1xuXG5cdFx0dmFyIGhlYWRlckxlbmd0aCA9IE1hdGguY2VpbCggaGVhZGVyQXJyLmxlbmd0aCAvIHJlY29yZFNpemUgKSAqIHJlY29yZFNpemU7XG5cdFx0dmFyIGlucHV0TGVuZ3RoID0gTWF0aC5jZWlsKCBpbnB1dC5sZW5ndGggLyByZWNvcmRTaXplICkgKiByZWNvcmRTaXplO1xuXG5cdFx0dGhpcy5ibG9ja3MucHVzaCggeyBoZWFkZXI6IGhlYWRlckFyciwgaW5wdXQ6IGlucHV0LCBoZWFkZXJMZW5ndGg6IGhlYWRlckxlbmd0aCwgaW5wdXRMZW5ndGg6IGlucHV0TGVuZ3RoIH0gKTtcblxuXHR9O1xuXG5cdFRhci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGJ1ZmZlcnMgPSBbXTtcblx0XHR2YXIgY2h1bmtzID0gW107XG5cdFx0dmFyIGxlbmd0aCA9IDA7XG5cdFx0dmFyIG1heCA9IE1hdGgucG93KCAyLCAyMCApO1xuXG5cdFx0dmFyIGNodW5rID0gW107XG5cdFx0dGhpcy5ibG9ja3MuZm9yRWFjaCggZnVuY3Rpb24oIGIgKSB7XG5cdFx0XHRpZiggbGVuZ3RoICsgYi5oZWFkZXJMZW5ndGggKyBiLmlucHV0TGVuZ3RoID4gbWF4ICkge1xuXHRcdFx0XHRjaHVua3MucHVzaCggeyBibG9ja3M6IGNodW5rLCBsZW5ndGg6IGxlbmd0aCB9ICk7XG5cdFx0XHRcdGNodW5rID0gW107XG5cdFx0XHRcdGxlbmd0aCA9IDA7XG5cdFx0XHR9XG5cdFx0XHRjaHVuay5wdXNoKCBiICk7XG5cdFx0XHRsZW5ndGggKz0gYi5oZWFkZXJMZW5ndGggKyBiLmlucHV0TGVuZ3RoO1xuXHRcdH0gKTtcblx0XHRjaHVua3MucHVzaCggeyBibG9ja3M6IGNodW5rLCBsZW5ndGg6IGxlbmd0aCB9ICk7XG5cblx0XHRjaHVua3MuZm9yRWFjaCggZnVuY3Rpb24oIGMgKSB7XG5cblx0XHRcdHZhciBidWZmZXIgPSBuZXcgVWludDhBcnJheSggYy5sZW5ndGggKTtcblx0XHRcdHZhciB3cml0dGVuID0gMDtcblx0XHRcdGMuYmxvY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBiICkge1xuXHRcdFx0XHRidWZmZXIuc2V0KCBiLmhlYWRlciwgd3JpdHRlbiApO1xuXHRcdFx0XHR3cml0dGVuICs9IGIuaGVhZGVyTGVuZ3RoO1xuXHRcdFx0XHRidWZmZXIuc2V0KCBiLmlucHV0LCB3cml0dGVuICk7XG5cdFx0XHRcdHdyaXR0ZW4gKz0gYi5pbnB1dExlbmd0aDtcblx0XHRcdH0gKTtcblx0XHRcdGJ1ZmZlcnMucHVzaCggYnVmZmVyICk7XG5cblx0XHR9ICk7XG5cblx0XHRidWZmZXJzLnB1c2goIG5ldyBVaW50OEFycmF5KCAyICogcmVjb3JkU2l6ZSApICk7XG5cblx0XHRyZXR1cm4gbmV3IEJsb2IoIGJ1ZmZlcnMsIHsgdHlwZTogJ29jdGV0L3N0cmVhbScgfSApO1xuXG5cdH07XG5cblx0VGFyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLndyaXR0ZW4gPSAwO1xuXHRcdHRoaXMub3V0ID0gdXRpbHMuY2xlYW4oYmxvY2tTaXplKTtcblx0fTtcblxuICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gVGFyO1xuICB9IGVsc2Uge1xuICAgIHdpbmRvdy5UYXIgPSBUYXI7XG4gIH1cbn0oKSk7XG4iLCIvL2Rvd25sb2FkLmpzIHYzLjAsIGJ5IGRhbmRhdmlzOyAyMDA4LTIwMTQuIFtDQ0JZMl0gc2VlIGh0dHA6Ly9kYW5tbC5jb20vZG93bmxvYWQuaHRtbCBmb3IgdGVzdHMvdXNhZ2Vcbi8vIHYxIGxhbmRlZCBhIEZGK0Nocm9tZSBjb21wYXQgd2F5IG9mIGRvd25sb2FkaW5nIHN0cmluZ3MgdG8gbG9jYWwgdW4tbmFtZWQgZmlsZXMsIHVwZ3JhZGVkIHRvIHVzZSBhIGhpZGRlbiBmcmFtZSBhbmQgb3B0aW9uYWwgbWltZVxuLy8gdjIgYWRkZWQgbmFtZWQgZmlsZXMgdmlhIGFbZG93bmxvYWRdLCBtc1NhdmVCbG9iLCBJRSAoMTArKSBzdXBwb3J0LCBhbmQgd2luZG93LlVSTCBzdXBwb3J0IGZvciBsYXJnZXIrZmFzdGVyIHNhdmVzIHRoYW4gZGF0YVVSTHNcbi8vIHYzIGFkZGVkIGRhdGFVUkwgYW5kIEJsb2IgSW5wdXQsIGJpbmQtdG9nZ2xlIGFyaXR5LCBhbmQgbGVnYWN5IGRhdGFVUkwgZmFsbGJhY2sgd2FzIGltcHJvdmVkIHdpdGggZm9yY2UtZG93bmxvYWQgbWltZSBhbmQgYmFzZTY0IHN1cHBvcnRcblxuLy8gZGF0YSBjYW4gYmUgYSBzdHJpbmcsIEJsb2IsIEZpbGUsIG9yIGRhdGFVUkxcblxuXG5cblxuZnVuY3Rpb24gZG93bmxvYWQoZGF0YSwgc3RyRmlsZU5hbWUsIHN0ck1pbWVUeXBlKSB7XG5cblx0dmFyIHNlbGYgPSB3aW5kb3csIC8vIHRoaXMgc2NyaXB0IGlzIG9ubHkgZm9yIGJyb3dzZXJzIGFueXdheS4uLlxuXHRcdHUgPSBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiLCAvLyB0aGlzIGRlZmF1bHQgbWltZSBhbHNvIHRyaWdnZXJzIGlmcmFtZSBkb3dubG9hZHNcblx0XHRtID0gc3RyTWltZVR5cGUgfHwgdSxcblx0XHR4ID0gZGF0YSxcblx0XHREID0gZG9jdW1lbnQsXG5cdFx0YSA9IEQuY3JlYXRlRWxlbWVudChcImFcIiksXG5cdFx0eiA9IGZ1bmN0aW9uKGEpe3JldHVybiBTdHJpbmcoYSk7fSxcblxuXG5cdFx0QiA9IHNlbGYuQmxvYiB8fCBzZWxmLk1vekJsb2IgfHwgc2VsZi5XZWJLaXRCbG9iIHx8IHosXG5cdFx0QkIgPSBzZWxmLk1TQmxvYkJ1aWxkZXIgfHwgc2VsZi5XZWJLaXRCbG9iQnVpbGRlciB8fCBzZWxmLkJsb2JCdWlsZGVyLFxuXHRcdGZuID0gc3RyRmlsZU5hbWUgfHwgXCJkb3dubG9hZFwiLFxuXHRcdGJsb2IsXG5cdFx0Yixcblx0XHR1YSxcblx0XHRmcjtcblxuXHQvL2lmKHR5cGVvZiBCLmJpbmQgPT09ICdmdW5jdGlvbicgKXsgQj1CLmJpbmQoc2VsZik7IH1cblxuXHRpZihTdHJpbmcodGhpcyk9PT1cInRydWVcIil7IC8vcmV2ZXJzZSBhcmd1bWVudHMsIGFsbG93aW5nIGRvd25sb2FkLmJpbmQodHJ1ZSwgXCJ0ZXh0L3htbFwiLCBcImV4cG9ydC54bWxcIikgdG8gYWN0IGFzIGEgY2FsbGJhY2tcblx0XHR4PVt4LCBtXTtcblx0XHRtPXhbMF07XG5cdFx0eD14WzFdO1xuXHR9XG5cblxuXG5cdC8vZ28gYWhlYWQgYW5kIGRvd25sb2FkIGRhdGFVUkxzIHJpZ2h0IGF3YXlcblx0aWYoU3RyaW5nKHgpLm1hdGNoKC9eZGF0YVxcOltcXHcrXFwtXStcXC9bXFx3K1xcLV0rWyw7XS8pKXtcblx0XHRyZXR1cm4gbmF2aWdhdG9yLm1zU2F2ZUJsb2IgPyAgLy8gSUUxMCBjYW4ndCBkbyBhW2Rvd25sb2FkXSwgb25seSBCbG9iczpcblx0XHRcdG5hdmlnYXRvci5tc1NhdmVCbG9iKGQyYih4KSwgZm4pIDpcblx0XHRcdHNhdmVyKHgpIDsgLy8gZXZlcnlvbmUgZWxzZSBjYW4gc2F2ZSBkYXRhVVJMcyB1bi1wcm9jZXNzZWRcblx0fS8vZW5kIGlmIGRhdGFVUkwgcGFzc2VkP1xuXG5cdHRyeXtcblxuXHRcdGJsb2IgPSB4IGluc3RhbmNlb2YgQiA/XG5cdFx0XHR4IDpcblx0XHRcdG5ldyBCKFt4XSwge3R5cGU6IG19KSA7XG5cdH1jYXRjaCh5KXtcblx0XHRpZihCQil7XG5cdFx0XHRiID0gbmV3IEJCKCk7XG5cdFx0XHRiLmFwcGVuZChbeF0pO1xuXHRcdFx0YmxvYiA9IGIuZ2V0QmxvYihtKTsgLy8gdGhlIGJsb2Jcblx0XHR9XG5cblx0fVxuXG5cblxuXHRmdW5jdGlvbiBkMmIodSkge1xuXHRcdHZhciBwPSB1LnNwbGl0KC9bOjssXS8pLFxuXHRcdHQ9IHBbMV0sXG5cdFx0ZGVjPSBwWzJdID09IFwiYmFzZTY0XCIgPyBhdG9iIDogZGVjb2RlVVJJQ29tcG9uZW50LFxuXHRcdGJpbj0gZGVjKHAucG9wKCkpLFxuXHRcdG14PSBiaW4ubGVuZ3RoLFxuXHRcdGk9IDAsXG5cdFx0dWlhPSBuZXcgVWludDhBcnJheShteCk7XG5cblx0XHRmb3IoaTtpPG14OysraSkgdWlhW2ldPSBiaW4uY2hhckNvZGVBdChpKTtcblxuXHRcdHJldHVybiBuZXcgQihbdWlhXSwge3R5cGU6IHR9KTtcblx0IH1cblxuXHRmdW5jdGlvbiBzYXZlcih1cmwsIHdpbk1vZGUpe1xuXG5cblx0XHRpZiAoJ2Rvd25sb2FkJyBpbiBhKSB7IC8vaHRtbDUgQVtkb3dubG9hZF1cblx0XHRcdGEuaHJlZiA9IHVybDtcblx0XHRcdGEuc2V0QXR0cmlidXRlKFwiZG93bmxvYWRcIiwgZm4pO1xuXHRcdFx0YS5pbm5lckhUTUwgPSBcImRvd25sb2FkaW5nLi4uXCI7XG5cdFx0XHRhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRELmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRhLmNsaWNrKCk7XG5cdFx0XHRcdEQuYm9keS5yZW1vdmVDaGlsZChhKTtcblx0XHRcdFx0aWYod2luTW9kZT09PXRydWUpe3NldFRpbWVvdXQoZnVuY3Rpb24oKXsgc2VsZi5VUkwucmV2b2tlT2JqZWN0VVJMKGEuaHJlZik7fSwgMjUwICk7fVxuXHRcdFx0fSwgNjYpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly9kbyBpZnJhbWUgZGF0YVVSTCBkb3dubG9hZCAob2xkIGNoK0ZGKTpcblx0XHR2YXIgZiA9IEQuY3JlYXRlRWxlbWVudChcImlmcmFtZVwiKTtcblx0XHRELmJvZHkuYXBwZW5kQ2hpbGQoZik7XG5cdFx0aWYoIXdpbk1vZGUpeyAvLyBmb3JjZSBhIG1pbWUgdGhhdCB3aWxsIGRvd25sb2FkOlxuXHRcdFx0dXJsPVwiZGF0YTpcIit1cmwucmVwbGFjZSgvXmRhdGE6KFtcXHdcXC9cXC1cXCtdKykvLCB1KTtcblx0XHR9XG5cblxuXHRcdGYuc3JjID0gdXJsO1xuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXsgRC5ib2R5LnJlbW92ZUNoaWxkKGYpOyB9LCAzMzMpO1xuXG5cdH0vL2VuZCBzYXZlclxuXG5cblx0aWYgKG5hdmlnYXRvci5tc1NhdmVCbG9iKSB7IC8vIElFMTArIDogKGhhcyBCbG9iLCBidXQgbm90IGFbZG93bmxvYWRdIG9yIFVSTClcblx0XHRyZXR1cm4gbmF2aWdhdG9yLm1zU2F2ZUJsb2IoYmxvYiwgZm4pO1xuXHR9XG5cblx0aWYoc2VsZi5VUkwpeyAvLyBzaW1wbGUgZmFzdCBhbmQgbW9kZXJuIHdheSB1c2luZyBCbG9iIGFuZCBVUkw6XG5cdFx0c2F2ZXIoc2VsZi5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpLCB0cnVlKTtcblx0fWVsc2V7XG5cdFx0Ly8gaGFuZGxlIG5vbi1CbG9iKCkrbm9uLVVSTCBicm93c2Vyczpcblx0XHRpZih0eXBlb2YgYmxvYiA9PT0gXCJzdHJpbmdcIiB8fCBibG9iLmNvbnN0cnVjdG9yPT09eiApe1xuXHRcdFx0dHJ5e1xuXHRcdFx0XHRyZXR1cm4gc2F2ZXIoIFwiZGF0YTpcIiArICBtICAgKyBcIjtiYXNlNjQsXCIgICsgIHNlbGYuYnRvYShibG9iKSAgKTtcblx0XHRcdH1jYXRjaCh5KXtcblx0XHRcdFx0cmV0dXJuIHNhdmVyKCBcImRhdGE6XCIgKyAgbSAgICsgXCIsXCIgKyBlbmNvZGVVUklDb21wb25lbnQoYmxvYikgICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQmxvYiBidXQgbm90IFVSTDpcblx0XHRmcj1uZXcgRmlsZVJlYWRlcigpO1xuXHRcdGZyLm9ubG9hZD1mdW5jdGlvbihlKXtcblx0XHRcdHNhdmVyKHRoaXMucmVzdWx0KTtcblx0XHR9O1xuXHRcdGZyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG5cdH1cblx0cmV0dXJuIHRydWU7XG59IC8qIGVuZCBkb3dubG9hZCgpICovXG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZG93bmxvYWQ7XG59XG4iLCIvLyBnaWYuanMgMC4yLjAgLSBodHRwczovL2dpdGh1Yi5jb20vam5vcmRiZXJnL2dpZi5qc1xyXG4oZnVuY3Rpb24oZil7aWYodHlwZW9mIGV4cG9ydHM9PT1cIm9iamVjdFwiJiZ0eXBlb2YgbW9kdWxlIT09XCJ1bmRlZmluZWRcIil7bW9kdWxlLmV4cG9ydHM9ZigpfWVsc2UgaWYodHlwZW9mIGRlZmluZT09PVwiZnVuY3Rpb25cIiYmZGVmaW5lLmFtZCl7ZGVmaW5lKFtdLGYpfWVsc2V7dmFyIGc7aWYodHlwZW9mIHdpbmRvdyE9PVwidW5kZWZpbmVkXCIpe2c9d2luZG93fWVsc2UgaWYodHlwZW9mIGdsb2JhbCE9PVwidW5kZWZpbmVkXCIpe2c9Z2xvYmFsfWVsc2UgaWYodHlwZW9mIHNlbGYhPT1cInVuZGVmaW5lZFwiKXtnPXNlbGZ9ZWxzZXtnPXRoaXN9Zy5HSUY9ZigpfX0pKGZ1bmN0aW9uKCl7dmFyIGRlZmluZSxtb2R1bGUsZXhwb3J0cztyZXR1cm4gZnVuY3Rpb24oKXtmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc31yZXR1cm4gZX0oKSh7MTpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7ZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCl7dGhpcy5fZXZlbnRzPXRoaXMuX2V2ZW50c3x8e307dGhpcy5fbWF4TGlzdGVuZXJzPXRoaXMuX21heExpc3RlbmVyc3x8dW5kZWZpbmVkfW1vZHVsZS5leHBvcnRzPUV2ZW50RW1pdHRlcjtFdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyPUV2ZW50RW1pdHRlcjtFdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHM9dW5kZWZpbmVkO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycz11bmRlZmluZWQ7RXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM9MTA7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnM9ZnVuY3Rpb24obil7aWYoIWlzTnVtYmVyKG4pfHxuPDB8fGlzTmFOKG4pKXRocm93IFR5cGVFcnJvcihcIm4gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiKTt0aGlzLl9tYXhMaXN0ZW5lcnM9bjtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0PWZ1bmN0aW9uKHR5cGUpe3ZhciBlcixoYW5kbGVyLGxlbixhcmdzLGksbGlzdGVuZXJzO2lmKCF0aGlzLl9ldmVudHMpdGhpcy5fZXZlbnRzPXt9O2lmKHR5cGU9PT1cImVycm9yXCIpe2lmKCF0aGlzLl9ldmVudHMuZXJyb3J8fGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikmJiF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKXtlcj1hcmd1bWVudHNbMV07aWYoZXIgaW5zdGFuY2VvZiBFcnJvcil7dGhyb3cgZXJ9ZWxzZXt2YXIgZXJyPW5ldyBFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4gKCcrZXIrXCIpXCIpO2Vyci5jb250ZXh0PWVyO3Rocm93IGVycn19fWhhbmRsZXI9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzVW5kZWZpbmVkKGhhbmRsZXIpKXJldHVybiBmYWxzZTtpZihpc0Z1bmN0aW9uKGhhbmRsZXIpKXtzd2l0Y2goYXJndW1lbnRzLmxlbmd0aCl7Y2FzZSAxOmhhbmRsZXIuY2FsbCh0aGlzKTticmVhaztjYXNlIDI6aGFuZGxlci5jYWxsKHRoaXMsYXJndW1lbnRzWzFdKTticmVhaztjYXNlIDM6aGFuZGxlci5jYWxsKHRoaXMsYXJndW1lbnRzWzFdLGFyZ3VtZW50c1syXSk7YnJlYWs7ZGVmYXVsdDphcmdzPUFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKTtoYW5kbGVyLmFwcGx5KHRoaXMsYXJncyl9fWVsc2UgaWYoaXNPYmplY3QoaGFuZGxlcikpe2FyZ3M9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpO2xpc3RlbmVycz1oYW5kbGVyLnNsaWNlKCk7bGVuPWxpc3RlbmVycy5sZW5ndGg7Zm9yKGk9MDtpPGxlbjtpKyspbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsYXJncyl9cmV0dXJuIHRydWV9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7dmFyIG07aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTtpZighdGhpcy5fZXZlbnRzKXRoaXMuX2V2ZW50cz17fTtpZih0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpdGhpcy5lbWl0KFwibmV3TGlzdGVuZXJcIix0eXBlLGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpP2xpc3RlbmVyLmxpc3RlbmVyOmxpc3RlbmVyKTtpZighdGhpcy5fZXZlbnRzW3R5cGVdKXRoaXMuX2V2ZW50c1t0eXBlXT1saXN0ZW5lcjtlbHNlIGlmKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO2Vsc2UgdGhpcy5fZXZlbnRzW3R5cGVdPVt0aGlzLl9ldmVudHNbdHlwZV0sbGlzdGVuZXJdO2lmKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkmJiF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKXtpZighaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSl7bT10aGlzLl9tYXhMaXN0ZW5lcnN9ZWxzZXttPUV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzfWlmKG0mJm0+MCYmdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aD5tKXt0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkPXRydWU7Y29uc29sZS5lcnJvcihcIihub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5IFwiK1wibGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiBcIitcIlVzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LlwiLHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO2lmKHR5cGVvZiBjb25zb2xlLnRyYWNlPT09XCJmdW5jdGlvblwiKXtjb25zb2xlLnRyYWNlKCl9fX1yZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbj1FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO0V2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZT1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO3ZhciBmaXJlZD1mYWxzZTtmdW5jdGlvbiBnKCl7dGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGcpO2lmKCFmaXJlZCl7ZmlyZWQ9dHJ1ZTtsaXN0ZW5lci5hcHBseSh0aGlzLGFyZ3VtZW50cyl9fWcubGlzdGVuZXI9bGlzdGVuZXI7dGhpcy5vbih0eXBlLGcpO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe3ZhciBsaXN0LHBvc2l0aW9uLGxlbmd0aCxpO2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7aWYoIXRoaXMuX2V2ZW50c3x8IXRoaXMuX2V2ZW50c1t0eXBlXSlyZXR1cm4gdGhpcztsaXN0PXRoaXMuX2V2ZW50c1t0eXBlXTtsZW5ndGg9bGlzdC5sZW5ndGg7cG9zaXRpb249LTE7aWYobGlzdD09PWxpc3RlbmVyfHxpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpJiZsaXN0Lmxpc3RlbmVyPT09bGlzdGVuZXIpe2RlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07aWYodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsdHlwZSxsaXN0ZW5lcil9ZWxzZSBpZihpc09iamVjdChsaXN0KSl7Zm9yKGk9bGVuZ3RoO2ktLSA+MDspe2lmKGxpc3RbaV09PT1saXN0ZW5lcnx8bGlzdFtpXS5saXN0ZW5lciYmbGlzdFtpXS5saXN0ZW5lcj09PWxpc3RlbmVyKXtwb3NpdGlvbj1pO2JyZWFrfX1pZihwb3NpdGlvbjwwKXJldHVybiB0aGlzO2lmKGxpc3QubGVuZ3RoPT09MSl7bGlzdC5sZW5ndGg9MDtkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdfWVsc2V7bGlzdC5zcGxpY2UocG9zaXRpb24sMSl9aWYodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsdHlwZSxsaXN0ZW5lcil9cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzPWZ1bmN0aW9uKHR5cGUpe3ZhciBrZXksbGlzdGVuZXJzO2lmKCF0aGlzLl9ldmVudHMpcmV0dXJuIHRoaXM7aWYoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil7aWYoYXJndW1lbnRzLmxlbmd0aD09PTApdGhpcy5fZXZlbnRzPXt9O2Vsc2UgaWYodGhpcy5fZXZlbnRzW3R5cGVdKWRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07cmV0dXJuIHRoaXN9aWYoYXJndW1lbnRzLmxlbmd0aD09PTApe2ZvcihrZXkgaW4gdGhpcy5fZXZlbnRzKXtpZihrZXk9PT1cInJlbW92ZUxpc3RlbmVyXCIpY29udGludWU7dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KX10aGlzLnJlbW92ZUFsbExpc3RlbmVycyhcInJlbW92ZUxpc3RlbmVyXCIpO3RoaXMuX2V2ZW50cz17fTtyZXR1cm4gdGhpc31saXN0ZW5lcnM9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzRnVuY3Rpb24obGlzdGVuZXJzKSl7dGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGxpc3RlbmVycyl9ZWxzZSBpZihsaXN0ZW5lcnMpe3doaWxlKGxpc3RlbmVycy5sZW5ndGgpdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoLTFdKX1kZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycz1mdW5jdGlvbih0eXBlKXt2YXIgcmV0O2lmKCF0aGlzLl9ldmVudHN8fCF0aGlzLl9ldmVudHNbdHlwZV0pcmV0PVtdO2Vsc2UgaWYoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKXJldD1bdGhpcy5fZXZlbnRzW3R5cGVdXTtlbHNlIHJldD10aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtyZXR1cm4gcmV0fTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQ9ZnVuY3Rpb24odHlwZSl7aWYodGhpcy5fZXZlbnRzKXt2YXIgZXZsaXN0ZW5lcj10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlyZXR1cm4gMTtlbHNlIGlmKGV2bGlzdGVuZXIpcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RofXJldHVybiAwfTtFdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudD1mdW5jdGlvbihlbWl0dGVyLHR5cGUpe3JldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSl9O2Z1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwiZnVuY3Rpb25cIn1mdW5jdGlvbiBpc051bWJlcihhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJudW1iZXJcIn1mdW5jdGlvbiBpc09iamVjdChhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJvYmplY3RcIiYmYXJnIT09bnVsbH1mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpe3JldHVybiBhcmc9PT12b2lkIDB9fSx7fV0sMjpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIE5ldVF1YW50PXJlcXVpcmUoXCIuL1R5cGVkTmV1UXVhbnQuanNcIik7dmFyIExaV0VuY29kZXI9cmVxdWlyZShcIi4vTFpXRW5jb2Rlci5qc1wiKTtmdW5jdGlvbiBCeXRlQXJyYXkoKXt0aGlzLnBhZ2U9LTE7dGhpcy5wYWdlcz1bXTt0aGlzLm5ld1BhZ2UoKX1CeXRlQXJyYXkucGFnZVNpemU9NDA5NjtCeXRlQXJyYXkuY2hhck1hcD17fTtmb3IodmFyIGk9MDtpPDI1NjtpKyspQnl0ZUFycmF5LmNoYXJNYXBbaV09U3RyaW5nLmZyb21DaGFyQ29kZShpKTtCeXRlQXJyYXkucHJvdG90eXBlLm5ld1BhZ2U9ZnVuY3Rpb24oKXt0aGlzLnBhZ2VzWysrdGhpcy5wYWdlXT1uZXcgVWludDhBcnJheShCeXRlQXJyYXkucGFnZVNpemUpO3RoaXMuY3Vyc29yPTB9O0J5dGVBcnJheS5wcm90b3R5cGUuZ2V0RGF0YT1mdW5jdGlvbigpe3ZhciBydj1cIlwiO2Zvcih2YXIgcD0wO3A8dGhpcy5wYWdlcy5sZW5ndGg7cCsrKXtmb3IodmFyIGk9MDtpPEJ5dGVBcnJheS5wYWdlU2l6ZTtpKyspe3J2Kz1CeXRlQXJyYXkuY2hhck1hcFt0aGlzLnBhZ2VzW3BdW2ldXX19cmV0dXJuIHJ2fTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlQnl0ZT1mdW5jdGlvbih2YWwpe2lmKHRoaXMuY3Vyc29yPj1CeXRlQXJyYXkucGFnZVNpemUpdGhpcy5uZXdQYWdlKCk7dGhpcy5wYWdlc1t0aGlzLnBhZ2VdW3RoaXMuY3Vyc29yKytdPXZhbH07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZVVURkJ5dGVzPWZ1bmN0aW9uKHN0cmluZyl7Zm9yKHZhciBsPXN0cmluZy5sZW5ndGgsaT0wO2k8bDtpKyspdGhpcy53cml0ZUJ5dGUoc3RyaW5nLmNoYXJDb2RlQXQoaSkpfTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlQnl0ZXM9ZnVuY3Rpb24oYXJyYXksb2Zmc2V0LGxlbmd0aCl7Zm9yKHZhciBsPWxlbmd0aHx8YXJyYXkubGVuZ3RoLGk9b2Zmc2V0fHwwO2k8bDtpKyspdGhpcy53cml0ZUJ5dGUoYXJyYXlbaV0pfTtmdW5jdGlvbiBHSUZFbmNvZGVyKHdpZHRoLGhlaWdodCl7dGhpcy53aWR0aD1+fndpZHRoO3RoaXMuaGVpZ2h0PX5+aGVpZ2h0O3RoaXMudHJhbnNwYXJlbnQ9bnVsbDt0aGlzLnRyYW5zSW5kZXg9MDt0aGlzLnJlcGVhdD0tMTt0aGlzLmRlbGF5PTA7dGhpcy5pbWFnZT1udWxsO3RoaXMucGl4ZWxzPW51bGw7dGhpcy5pbmRleGVkUGl4ZWxzPW51bGw7dGhpcy5jb2xvckRlcHRoPW51bGw7dGhpcy5jb2xvclRhYj1udWxsO3RoaXMubmV1UXVhbnQ9bnVsbDt0aGlzLnVzZWRFbnRyeT1uZXcgQXJyYXk7dGhpcy5wYWxTaXplPTc7dGhpcy5kaXNwb3NlPS0xO3RoaXMuZmlyc3RGcmFtZT10cnVlO3RoaXMuc2FtcGxlPTEwO3RoaXMuZGl0aGVyPWZhbHNlO3RoaXMuZ2xvYmFsUGFsZXR0ZT1mYWxzZTt0aGlzLm91dD1uZXcgQnl0ZUFycmF5fUdJRkVuY29kZXIucHJvdG90eXBlLnNldERlbGF5PWZ1bmN0aW9uKG1pbGxpc2Vjb25kcyl7dGhpcy5kZWxheT1NYXRoLnJvdW5kKG1pbGxpc2Vjb25kcy8xMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldEZyYW1lUmF0ZT1mdW5jdGlvbihmcHMpe3RoaXMuZGVsYXk9TWF0aC5yb3VuZCgxMDAvZnBzKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGlzcG9zZT1mdW5jdGlvbihkaXNwb3NhbENvZGUpe2lmKGRpc3Bvc2FsQ29kZT49MCl0aGlzLmRpc3Bvc2U9ZGlzcG9zYWxDb2RlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRSZXBlYXQ9ZnVuY3Rpb24ocmVwZWF0KXt0aGlzLnJlcGVhdD1yZXBlYXR9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFRyYW5zcGFyZW50PWZ1bmN0aW9uKGNvbG9yKXt0aGlzLnRyYW5zcGFyZW50PWNvbG9yfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGRGcmFtZT1mdW5jdGlvbihpbWFnZURhdGEpe3RoaXMuaW1hZ2U9aW1hZ2VEYXRhO3RoaXMuY29sb3JUYWI9dGhpcy5nbG9iYWxQYWxldHRlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2U/dGhpcy5nbG9iYWxQYWxldHRlOm51bGw7dGhpcy5nZXRJbWFnZVBpeGVscygpO3RoaXMuYW5hbHl6ZVBpeGVscygpO2lmKHRoaXMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpdGhpcy5nbG9iYWxQYWxldHRlPXRoaXMuY29sb3JUYWI7aWYodGhpcy5maXJzdEZyYW1lKXt0aGlzLndyaXRlTFNEKCk7dGhpcy53cml0ZVBhbGV0dGUoKTtpZih0aGlzLnJlcGVhdD49MCl7dGhpcy53cml0ZU5ldHNjYXBlRXh0KCl9fXRoaXMud3JpdGVHcmFwaGljQ3RybEV4dCgpO3RoaXMud3JpdGVJbWFnZURlc2MoKTtpZighdGhpcy5maXJzdEZyYW1lJiYhdGhpcy5nbG9iYWxQYWxldHRlKXRoaXMud3JpdGVQYWxldHRlKCk7dGhpcy53cml0ZVBpeGVscygpO3RoaXMuZmlyc3RGcmFtZT1mYWxzZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluaXNoPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDU5KX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0UXVhbGl0eT1mdW5jdGlvbihxdWFsaXR5KXtpZihxdWFsaXR5PDEpcXVhbGl0eT0xO3RoaXMuc2FtcGxlPXF1YWxpdHl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldERpdGhlcj1mdW5jdGlvbihkaXRoZXIpe2lmKGRpdGhlcj09PXRydWUpZGl0aGVyPVwiRmxveWRTdGVpbmJlcmdcIjt0aGlzLmRpdGhlcj1kaXRoZXJ9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldEdsb2JhbFBhbGV0dGU9ZnVuY3Rpb24ocGFsZXR0ZSl7dGhpcy5nbG9iYWxQYWxldHRlPXBhbGV0dGV9O0dJRkVuY29kZXIucHJvdG90eXBlLmdldEdsb2JhbFBhbGV0dGU9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5nbG9iYWxQYWxldHRlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2UmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZSgwKXx8dGhpcy5nbG9iYWxQYWxldHRlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUhlYWRlcj1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlVVRGQnl0ZXMoXCJHSUY4OWFcIil9O0dJRkVuY29kZXIucHJvdG90eXBlLmFuYWx5emVQaXhlbHM9ZnVuY3Rpb24oKXtpZighdGhpcy5jb2xvclRhYil7dGhpcy5uZXVRdWFudD1uZXcgTmV1UXVhbnQodGhpcy5waXhlbHMsdGhpcy5zYW1wbGUpO3RoaXMubmV1UXVhbnQuYnVpbGRDb2xvcm1hcCgpO3RoaXMuY29sb3JUYWI9dGhpcy5uZXVRdWFudC5nZXRDb2xvcm1hcCgpfWlmKHRoaXMuZGl0aGVyKXt0aGlzLmRpdGhlclBpeGVscyh0aGlzLmRpdGhlci5yZXBsYWNlKFwiLXNlcnBlbnRpbmVcIixcIlwiKSx0aGlzLmRpdGhlci5tYXRjaCgvLXNlcnBlbnRpbmUvKSE9PW51bGwpfWVsc2V7dGhpcy5pbmRleFBpeGVscygpfXRoaXMucGl4ZWxzPW51bGw7dGhpcy5jb2xvckRlcHRoPTg7dGhpcy5wYWxTaXplPTc7aWYodGhpcy50cmFuc3BhcmVudCE9PW51bGwpe3RoaXMudHJhbnNJbmRleD10aGlzLmZpbmRDbG9zZXN0KHRoaXMudHJhbnNwYXJlbnQsdHJ1ZSl9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5pbmRleFBpeGVscz1mdW5jdGlvbihpbWdxKXt2YXIgblBpeD10aGlzLnBpeGVscy5sZW5ndGgvMzt0aGlzLmluZGV4ZWRQaXhlbHM9bmV3IFVpbnQ4QXJyYXkoblBpeCk7dmFyIGs9MDtmb3IodmFyIGo9MDtqPG5QaXg7aisrKXt2YXIgaW5kZXg9dGhpcy5maW5kQ2xvc2VzdFJHQih0aGlzLnBpeGVsc1trKytdJjI1NSx0aGlzLnBpeGVsc1trKytdJjI1NSx0aGlzLnBpeGVsc1trKytdJjI1NSk7dGhpcy51c2VkRW50cnlbaW5kZXhdPXRydWU7dGhpcy5pbmRleGVkUGl4ZWxzW2pdPWluZGV4fX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZGl0aGVyUGl4ZWxzPWZ1bmN0aW9uKGtlcm5lbCxzZXJwZW50aW5lKXt2YXIga2VybmVscz17RmFsc2VGbG95ZFN0ZWluYmVyZzpbWzMvOCwxLDBdLFszLzgsMCwxXSxbMi84LDEsMV1dLEZsb3lkU3RlaW5iZXJnOltbNy8xNiwxLDBdLFszLzE2LC0xLDFdLFs1LzE2LDAsMV0sWzEvMTYsMSwxXV0sU3R1Y2tpOltbOC80MiwxLDBdLFs0LzQyLDIsMF0sWzIvNDIsLTIsMV0sWzQvNDIsLTEsMV0sWzgvNDIsMCwxXSxbNC80MiwxLDFdLFsyLzQyLDIsMV0sWzEvNDIsLTIsMl0sWzIvNDIsLTEsMl0sWzQvNDIsMCwyXSxbMi80MiwxLDJdLFsxLzQyLDIsMl1dLEF0a2luc29uOltbMS84LDEsMF0sWzEvOCwyLDBdLFsxLzgsLTEsMV0sWzEvOCwwLDFdLFsxLzgsMSwxXSxbMS84LDAsMl1dfTtpZigha2VybmVsfHwha2VybmVsc1trZXJuZWxdKXt0aHJvd1wiVW5rbm93biBkaXRoZXJpbmcga2VybmVsOiBcIitrZXJuZWx9dmFyIGRzPWtlcm5lbHNba2VybmVsXTt2YXIgaW5kZXg9MCxoZWlnaHQ9dGhpcy5oZWlnaHQsd2lkdGg9dGhpcy53aWR0aCxkYXRhPXRoaXMucGl4ZWxzO3ZhciBkaXJlY3Rpb249c2VycGVudGluZT8tMToxO3RoaXMuaW5kZXhlZFBpeGVscz1uZXcgVWludDhBcnJheSh0aGlzLnBpeGVscy5sZW5ndGgvMyk7Zm9yKHZhciB5PTA7eTxoZWlnaHQ7eSsrKXtpZihzZXJwZW50aW5lKWRpcmVjdGlvbj1kaXJlY3Rpb24qLTE7Zm9yKHZhciB4PWRpcmVjdGlvbj09MT8wOndpZHRoLTEseGVuZD1kaXJlY3Rpb249PTE/d2lkdGg6MDt4IT09eGVuZDt4Kz1kaXJlY3Rpb24pe2luZGV4PXkqd2lkdGgreDt2YXIgaWR4PWluZGV4KjM7dmFyIHIxPWRhdGFbaWR4XTt2YXIgZzE9ZGF0YVtpZHgrMV07dmFyIGIxPWRhdGFbaWR4KzJdO2lkeD10aGlzLmZpbmRDbG9zZXN0UkdCKHIxLGcxLGIxKTt0aGlzLnVzZWRFbnRyeVtpZHhdPXRydWU7dGhpcy5pbmRleGVkUGl4ZWxzW2luZGV4XT1pZHg7aWR4Kj0zO3ZhciByMj10aGlzLmNvbG9yVGFiW2lkeF07dmFyIGcyPXRoaXMuY29sb3JUYWJbaWR4KzFdO3ZhciBiMj10aGlzLmNvbG9yVGFiW2lkeCsyXTt2YXIgZXI9cjEtcjI7dmFyIGVnPWcxLWcyO3ZhciBlYj1iMS1iMjtmb3IodmFyIGk9ZGlyZWN0aW9uPT0xPzA6ZHMubGVuZ3RoLTEsZW5kPWRpcmVjdGlvbj09MT9kcy5sZW5ndGg6MDtpIT09ZW5kO2krPWRpcmVjdGlvbil7dmFyIHgxPWRzW2ldWzFdO3ZhciB5MT1kc1tpXVsyXTtpZih4MSt4Pj0wJiZ4MSt4PHdpZHRoJiZ5MSt5Pj0wJiZ5MSt5PGhlaWdodCl7dmFyIGQ9ZHNbaV1bMF07aWR4PWluZGV4K3gxK3kxKndpZHRoO2lkeCo9MztkYXRhW2lkeF09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHhdK2VyKmQpKTtkYXRhW2lkeCsxXT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeCsxXStlZypkKSk7ZGF0YVtpZHgrMl09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHgrMl0rZWIqZCkpfX19fX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluZENsb3Nlc3Q9ZnVuY3Rpb24oYyx1c2VkKXtyZXR1cm4gdGhpcy5maW5kQ2xvc2VzdFJHQigoYyYxNjcxMTY4MCk+PjE2LChjJjY1MjgwKT4+OCxjJjI1NSx1c2VkKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluZENsb3Nlc3RSR0I9ZnVuY3Rpb24ocixnLGIsdXNlZCl7aWYodGhpcy5jb2xvclRhYj09PW51bGwpcmV0dXJuLTE7aWYodGhpcy5uZXVRdWFudCYmIXVzZWQpe3JldHVybiB0aGlzLm5ldVF1YW50Lmxvb2t1cFJHQihyLGcsYil9dmFyIGM9YnxnPDw4fHI8PDE2O3ZhciBtaW5wb3M9MDt2YXIgZG1pbj0yNTYqMjU2KjI1Njt2YXIgbGVuPXRoaXMuY29sb3JUYWIubGVuZ3RoO2Zvcih2YXIgaT0wLGluZGV4PTA7aTxsZW47aW5kZXgrKyl7dmFyIGRyPXItKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkZz1nLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZGI9Yi0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGQ9ZHIqZHIrZGcqZGcrZGIqZGI7aWYoKCF1c2VkfHx0aGlzLnVzZWRFbnRyeVtpbmRleF0pJiZkPGRtaW4pe2RtaW49ZDttaW5wb3M9aW5kZXh9fXJldHVybiBtaW5wb3N9O0dJRkVuY29kZXIucHJvdG90eXBlLmdldEltYWdlUGl4ZWxzPWZ1bmN0aW9uKCl7dmFyIHc9dGhpcy53aWR0aDt2YXIgaD10aGlzLmhlaWdodDt0aGlzLnBpeGVscz1uZXcgVWludDhBcnJheSh3KmgqMyk7dmFyIGRhdGE9dGhpcy5pbWFnZTt2YXIgc3JjUG9zPTA7dmFyIGNvdW50PTA7Zm9yKHZhciBpPTA7aTxoO2krKyl7Zm9yKHZhciBqPTA7ajx3O2orKyl7dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107c3JjUG9zKyt9fX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVHcmFwaGljQ3RybEV4dD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSgzMyk7dGhpcy5vdXQud3JpdGVCeXRlKDI0OSk7dGhpcy5vdXQud3JpdGVCeXRlKDQpO3ZhciB0cmFuc3AsZGlzcDtpZih0aGlzLnRyYW5zcGFyZW50PT09bnVsbCl7dHJhbnNwPTA7ZGlzcD0wfWVsc2V7dHJhbnNwPTE7ZGlzcD0yfWlmKHRoaXMuZGlzcG9zZT49MCl7ZGlzcD10aGlzLmRpc3Bvc2UmN31kaXNwPDw9Mjt0aGlzLm91dC53cml0ZUJ5dGUoMHxkaXNwfDB8dHJhbnNwKTt0aGlzLndyaXRlU2hvcnQodGhpcy5kZWxheSk7dGhpcy5vdXQud3JpdGVCeXRlKHRoaXMudHJhbnNJbmRleCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUltYWdlRGVzYz1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSg0NCk7dGhpcy53cml0ZVNob3J0KDApO3RoaXMud3JpdGVTaG9ydCgwKTt0aGlzLndyaXRlU2hvcnQodGhpcy53aWR0aCk7dGhpcy53cml0ZVNob3J0KHRoaXMuaGVpZ2h0KTtpZih0aGlzLmZpcnN0RnJhbWV8fHRoaXMuZ2xvYmFsUGFsZXR0ZSl7dGhpcy5vdXQud3JpdGVCeXRlKDApfWVsc2V7dGhpcy5vdXQud3JpdGVCeXRlKDEyOHwwfDB8MHx0aGlzLnBhbFNpemUpfX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVMU0Q9ZnVuY3Rpb24oKXt0aGlzLndyaXRlU2hvcnQodGhpcy53aWR0aCk7dGhpcy53cml0ZVNob3J0KHRoaXMuaGVpZ2h0KTt0aGlzLm91dC53cml0ZUJ5dGUoMTI4fDExMnwwfHRoaXMucGFsU2l6ZSk7dGhpcy5vdXQud3JpdGVCeXRlKDApO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVOZXRzY2FwZUV4dD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSgzMyk7dGhpcy5vdXQud3JpdGVCeXRlKDI1NSk7dGhpcy5vdXQud3JpdGVCeXRlKDExKTt0aGlzLm91dC53cml0ZVVURkJ5dGVzKFwiTkVUU0NBUEUyLjBcIik7dGhpcy5vdXQud3JpdGVCeXRlKDMpO3RoaXMub3V0LndyaXRlQnl0ZSgxKTt0aGlzLndyaXRlU2hvcnQodGhpcy5yZXBlYXQpO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVQYWxldHRlPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlcyh0aGlzLmNvbG9yVGFiKTt2YXIgbj0zKjI1Ni10aGlzLmNvbG9yVGFiLmxlbmd0aDtmb3IodmFyIGk9MDtpPG47aSsrKXRoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVTaG9ydD1mdW5jdGlvbihwVmFsdWUpe3RoaXMub3V0LndyaXRlQnl0ZShwVmFsdWUmMjU1KTt0aGlzLm91dC53cml0ZUJ5dGUocFZhbHVlPj44JjI1NSl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlUGl4ZWxzPWZ1bmN0aW9uKCl7dmFyIGVuYz1uZXcgTFpXRW5jb2Rlcih0aGlzLndpZHRoLHRoaXMuaGVpZ2h0LHRoaXMuaW5kZXhlZFBpeGVscyx0aGlzLmNvbG9yRGVwdGgpO2VuYy5lbmNvZGUodGhpcy5vdXQpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zdHJlYW09ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5vdXR9O21vZHVsZS5leHBvcnRzPUdJRkVuY29kZXJ9LHtcIi4vTFpXRW5jb2Rlci5qc1wiOjMsXCIuL1R5cGVkTmV1UXVhbnQuanNcIjo0fV0sMzpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEVPRj0tMTt2YXIgQklUUz0xMjt2YXIgSFNJWkU9NTAwMzt2YXIgbWFza3M9WzAsMSwzLDcsMTUsMzEsNjMsMTI3LDI1NSw1MTEsMTAyMywyMDQ3LDQwOTUsODE5MSwxNjM4MywzMjc2Nyw2NTUzNV07ZnVuY3Rpb24gTFpXRW5jb2Rlcih3aWR0aCxoZWlnaHQscGl4ZWxzLGNvbG9yRGVwdGgpe3ZhciBpbml0Q29kZVNpemU9TWF0aC5tYXgoMixjb2xvckRlcHRoKTt2YXIgYWNjdW09bmV3IFVpbnQ4QXJyYXkoMjU2KTt2YXIgaHRhYj1uZXcgSW50MzJBcnJheShIU0laRSk7dmFyIGNvZGV0YWI9bmV3IEludDMyQXJyYXkoSFNJWkUpO3ZhciBjdXJfYWNjdW0sY3VyX2JpdHM9MDt2YXIgYV9jb3VudDt2YXIgZnJlZV9lbnQ9MDt2YXIgbWF4Y29kZTt2YXIgY2xlYXJfZmxnPWZhbHNlO3ZhciBnX2luaXRfYml0cyxDbGVhckNvZGUsRU9GQ29kZTtmdW5jdGlvbiBjaGFyX291dChjLG91dHMpe2FjY3VtW2FfY291bnQrK109YztpZihhX2NvdW50Pj0yNTQpZmx1c2hfY2hhcihvdXRzKX1mdW5jdGlvbiBjbF9ibG9jayhvdXRzKXtjbF9oYXNoKEhTSVpFKTtmcmVlX2VudD1DbGVhckNvZGUrMjtjbGVhcl9mbGc9dHJ1ZTtvdXRwdXQoQ2xlYXJDb2RlLG91dHMpfWZ1bmN0aW9uIGNsX2hhc2goaHNpemUpe2Zvcih2YXIgaT0wO2k8aHNpemU7KytpKWh0YWJbaV09LTF9ZnVuY3Rpb24gY29tcHJlc3MoaW5pdF9iaXRzLG91dHMpe3ZhciBmY29kZSxjLGksZW50LGRpc3AsaHNpemVfcmVnLGhzaGlmdDtnX2luaXRfYml0cz1pbml0X2JpdHM7Y2xlYXJfZmxnPWZhbHNlO25fYml0cz1nX2luaXRfYml0czttYXhjb2RlPU1BWENPREUobl9iaXRzKTtDbGVhckNvZGU9MTw8aW5pdF9iaXRzLTE7RU9GQ29kZT1DbGVhckNvZGUrMTtmcmVlX2VudD1DbGVhckNvZGUrMjthX2NvdW50PTA7ZW50PW5leHRQaXhlbCgpO2hzaGlmdD0wO2ZvcihmY29kZT1IU0laRTtmY29kZTw2NTUzNjtmY29kZSo9MikrK2hzaGlmdDtoc2hpZnQ9OC1oc2hpZnQ7aHNpemVfcmVnPUhTSVpFO2NsX2hhc2goaHNpemVfcmVnKTtvdXRwdXQoQ2xlYXJDb2RlLG91dHMpO291dGVyX2xvb3A6d2hpbGUoKGM9bmV4dFBpeGVsKCkpIT1FT0Ype2Zjb2RlPShjPDxCSVRTKStlbnQ7aT1jPDxoc2hpZnReZW50O2lmKGh0YWJbaV09PT1mY29kZSl7ZW50PWNvZGV0YWJbaV07Y29udGludWV9ZWxzZSBpZihodGFiW2ldPj0wKXtkaXNwPWhzaXplX3JlZy1pO2lmKGk9PT0wKWRpc3A9MTtkb3tpZigoaS09ZGlzcCk8MClpKz1oc2l6ZV9yZWc7aWYoaHRhYltpXT09PWZjb2RlKXtlbnQ9Y29kZXRhYltpXTtjb250aW51ZSBvdXRlcl9sb29wfX13aGlsZShodGFiW2ldPj0wKX1vdXRwdXQoZW50LG91dHMpO2VudD1jO2lmKGZyZWVfZW50PDE8PEJJVFMpe2NvZGV0YWJbaV09ZnJlZV9lbnQrKztodGFiW2ldPWZjb2RlfWVsc2V7Y2xfYmxvY2sob3V0cyl9fW91dHB1dChlbnQsb3V0cyk7b3V0cHV0KEVPRkNvZGUsb3V0cyl9ZnVuY3Rpb24gZW5jb2RlKG91dHMpe291dHMud3JpdGVCeXRlKGluaXRDb2RlU2l6ZSk7cmVtYWluaW5nPXdpZHRoKmhlaWdodDtjdXJQaXhlbD0wO2NvbXByZXNzKGluaXRDb2RlU2l6ZSsxLG91dHMpO291dHMud3JpdGVCeXRlKDApfWZ1bmN0aW9uIGZsdXNoX2NoYXIob3V0cyl7aWYoYV9jb3VudD4wKXtvdXRzLndyaXRlQnl0ZShhX2NvdW50KTtvdXRzLndyaXRlQnl0ZXMoYWNjdW0sMCxhX2NvdW50KTthX2NvdW50PTB9fWZ1bmN0aW9uIE1BWENPREUobl9iaXRzKXtyZXR1cm4oMTw8bl9iaXRzKS0xfWZ1bmN0aW9uIG5leHRQaXhlbCgpe2lmKHJlbWFpbmluZz09PTApcmV0dXJuIEVPRjstLXJlbWFpbmluZzt2YXIgcGl4PXBpeGVsc1tjdXJQaXhlbCsrXTtyZXR1cm4gcGl4JjI1NX1mdW5jdGlvbiBvdXRwdXQoY29kZSxvdXRzKXtjdXJfYWNjdW0mPW1hc2tzW2N1cl9iaXRzXTtpZihjdXJfYml0cz4wKWN1cl9hY2N1bXw9Y29kZTw8Y3VyX2JpdHM7ZWxzZSBjdXJfYWNjdW09Y29kZTtjdXJfYml0cys9bl9iaXRzO3doaWxlKGN1cl9iaXRzPj04KXtjaGFyX291dChjdXJfYWNjdW0mMjU1LG91dHMpO2N1cl9hY2N1bT4+PTg7Y3VyX2JpdHMtPTh9aWYoZnJlZV9lbnQ+bWF4Y29kZXx8Y2xlYXJfZmxnKXtpZihjbGVhcl9mbGcpe21heGNvZGU9TUFYQ09ERShuX2JpdHM9Z19pbml0X2JpdHMpO2NsZWFyX2ZsZz1mYWxzZX1lbHNleysrbl9iaXRzO2lmKG5fYml0cz09QklUUyltYXhjb2RlPTE8PEJJVFM7ZWxzZSBtYXhjb2RlPU1BWENPREUobl9iaXRzKX19aWYoY29kZT09RU9GQ29kZSl7d2hpbGUoY3VyX2JpdHM+MCl7Y2hhcl9vdXQoY3VyX2FjY3VtJjI1NSxvdXRzKTtjdXJfYWNjdW0+Pj04O2N1cl9iaXRzLT04fWZsdXNoX2NoYXIob3V0cyl9fXRoaXMuZW5jb2RlPWVuY29kZX1tb2R1bGUuZXhwb3J0cz1MWldFbmNvZGVyfSx7fV0sNDpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIG5jeWNsZXM9MTAwO3ZhciBuZXRzaXplPTI1Njt2YXIgbWF4bmV0cG9zPW5ldHNpemUtMTt2YXIgbmV0Ymlhc3NoaWZ0PTQ7dmFyIGludGJpYXNzaGlmdD0xNjt2YXIgaW50Ymlhcz0xPDxpbnRiaWFzc2hpZnQ7dmFyIGdhbW1hc2hpZnQ9MTA7dmFyIGdhbW1hPTE8PGdhbW1hc2hpZnQ7dmFyIGJldGFzaGlmdD0xMDt2YXIgYmV0YT1pbnRiaWFzPj5iZXRhc2hpZnQ7dmFyIGJldGFnYW1tYT1pbnRiaWFzPDxnYW1tYXNoaWZ0LWJldGFzaGlmdDt2YXIgaW5pdHJhZD1uZXRzaXplPj4zO3ZhciByYWRpdXNiaWFzc2hpZnQ9Njt2YXIgcmFkaXVzYmlhcz0xPDxyYWRpdXNiaWFzc2hpZnQ7dmFyIGluaXRyYWRpdXM9aW5pdHJhZCpyYWRpdXNiaWFzO3ZhciByYWRpdXNkZWM9MzA7dmFyIGFscGhhYmlhc3NoaWZ0PTEwO3ZhciBpbml0YWxwaGE9MTw8YWxwaGFiaWFzc2hpZnQ7dmFyIGFscGhhZGVjO3ZhciByYWRiaWFzc2hpZnQ9ODt2YXIgcmFkYmlhcz0xPDxyYWRiaWFzc2hpZnQ7dmFyIGFscGhhcmFkYnNoaWZ0PWFscGhhYmlhc3NoaWZ0K3JhZGJpYXNzaGlmdDt2YXIgYWxwaGFyYWRiaWFzPTE8PGFscGhhcmFkYnNoaWZ0O3ZhciBwcmltZTE9NDk5O3ZhciBwcmltZTI9NDkxO3ZhciBwcmltZTM9NDg3O3ZhciBwcmltZTQ9NTAzO3ZhciBtaW5waWN0dXJlYnl0ZXM9MypwcmltZTQ7ZnVuY3Rpb24gTmV1UXVhbnQocGl4ZWxzLHNhbXBsZWZhYyl7dmFyIG5ldHdvcms7dmFyIG5ldGluZGV4O3ZhciBiaWFzO3ZhciBmcmVxO3ZhciByYWRwb3dlcjtmdW5jdGlvbiBpbml0KCl7bmV0d29yaz1bXTtuZXRpbmRleD1uZXcgSW50MzJBcnJheSgyNTYpO2JpYXM9bmV3IEludDMyQXJyYXkobmV0c2l6ZSk7ZnJlcT1uZXcgSW50MzJBcnJheShuZXRzaXplKTtyYWRwb3dlcj1uZXcgSW50MzJBcnJheShuZXRzaXplPj4zKTt2YXIgaSx2O2ZvcihpPTA7aTxuZXRzaXplO2krKyl7dj0oaTw8bmV0Ymlhc3NoaWZ0KzgpL25ldHNpemU7bmV0d29ya1tpXT1uZXcgRmxvYXQ2NEFycmF5KFt2LHYsdiwwXSk7ZnJlcVtpXT1pbnRiaWFzL25ldHNpemU7Ymlhc1tpXT0wfX1mdW5jdGlvbiB1bmJpYXNuZXQoKXtmb3IodmFyIGk9MDtpPG5ldHNpemU7aSsrKXtuZXR3b3JrW2ldWzBdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bMV0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVsyXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzNdPWl9fWZ1bmN0aW9uIGFsdGVyc2luZ2xlKGFscGhhLGksYixnLHIpe25ldHdvcmtbaV1bMF0tPWFscGhhKihuZXR3b3JrW2ldWzBdLWIpL2luaXRhbHBoYTtuZXR3b3JrW2ldWzFdLT1hbHBoYSoobmV0d29ya1tpXVsxXS1nKS9pbml0YWxwaGE7bmV0d29ya1tpXVsyXS09YWxwaGEqKG5ldHdvcmtbaV1bMl0tcikvaW5pdGFscGhhfWZ1bmN0aW9uIGFsdGVybmVpZ2gocmFkaXVzLGksYixnLHIpe3ZhciBsbz1NYXRoLmFicyhpLXJhZGl1cyk7dmFyIGhpPU1hdGgubWluKGkrcmFkaXVzLG5ldHNpemUpO3ZhciBqPWkrMTt2YXIgaz1pLTE7dmFyIG09MTt2YXIgcCxhO3doaWxlKGo8aGl8fGs+bG8pe2E9cmFkcG93ZXJbbSsrXTtpZihqPGhpKXtwPW5ldHdvcmtbaisrXTtwWzBdLT1hKihwWzBdLWIpL2FscGhhcmFkYmlhcztwWzFdLT1hKihwWzFdLWcpL2FscGhhcmFkYmlhcztwWzJdLT1hKihwWzJdLXIpL2FscGhhcmFkYmlhc31pZihrPmxvKXtwPW5ldHdvcmtbay0tXTtwWzBdLT1hKihwWzBdLWIpL2FscGhhcmFkYmlhcztwWzFdLT1hKihwWzFdLWcpL2FscGhhcmFkYmlhcztwWzJdLT1hKihwWzJdLXIpL2FscGhhcmFkYmlhc319fWZ1bmN0aW9uIGNvbnRlc3QoYixnLHIpe3ZhciBiZXN0ZD1+KDE8PDMxKTt2YXIgYmVzdGJpYXNkPWJlc3RkO3ZhciBiZXN0cG9zPS0xO3ZhciBiZXN0Ymlhc3Bvcz1iZXN0cG9zO3ZhciBpLG4sZGlzdCxiaWFzZGlzdCxiZXRhZnJlcTtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe249bmV0d29ya1tpXTtkaXN0PU1hdGguYWJzKG5bMF0tYikrTWF0aC5hYnMoblsxXS1nKStNYXRoLmFicyhuWzJdLXIpO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdHBvcz1pfWJpYXNkaXN0PWRpc3QtKGJpYXNbaV0+PmludGJpYXNzaGlmdC1uZXRiaWFzc2hpZnQpO2lmKGJpYXNkaXN0PGJlc3RiaWFzZCl7YmVzdGJpYXNkPWJpYXNkaXN0O2Jlc3RiaWFzcG9zPWl9YmV0YWZyZXE9ZnJlcVtpXT4+YmV0YXNoaWZ0O2ZyZXFbaV0tPWJldGFmcmVxO2JpYXNbaV0rPWJldGFmcmVxPDxnYW1tYXNoaWZ0fWZyZXFbYmVzdHBvc10rPWJldGE7Ymlhc1tiZXN0cG9zXS09YmV0YWdhbW1hO3JldHVybiBiZXN0Ymlhc3Bvc31mdW5jdGlvbiBpbnhidWlsZCgpe3ZhciBpLGoscCxxLHNtYWxscG9zLHNtYWxsdmFsLHByZXZpb3VzY29sPTAsc3RhcnRwb3M9MDtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe3A9bmV0d29ya1tpXTtzbWFsbHBvcz1pO3NtYWxsdmFsPXBbMV07Zm9yKGo9aSsxO2o8bmV0c2l6ZTtqKyspe3E9bmV0d29ya1tqXTtpZihxWzFdPHNtYWxsdmFsKXtzbWFsbHBvcz1qO3NtYWxsdmFsPXFbMV19fXE9bmV0d29ya1tzbWFsbHBvc107aWYoaSE9c21hbGxwb3Mpe2o9cVswXTtxWzBdPXBbMF07cFswXT1qO2o9cVsxXTtxWzFdPXBbMV07cFsxXT1qO2o9cVsyXTtxWzJdPXBbMl07cFsyXT1qO2o9cVszXTtxWzNdPXBbM107cFszXT1qfWlmKHNtYWxsdmFsIT1wcmV2aW91c2NvbCl7bmV0aW5kZXhbcHJldmlvdXNjb2xdPXN0YXJ0cG9zK2k+PjE7Zm9yKGo9cHJldmlvdXNjb2wrMTtqPHNtYWxsdmFsO2orKyluZXRpbmRleFtqXT1pO3ByZXZpb3VzY29sPXNtYWxsdmFsO3N0YXJ0cG9zPWl9fW5ldGluZGV4W3ByZXZpb3VzY29sXT1zdGFydHBvcyttYXhuZXRwb3M+PjE7Zm9yKGo9cHJldmlvdXNjb2wrMTtqPDI1NjtqKyspbmV0aW5kZXhbal09bWF4bmV0cG9zfWZ1bmN0aW9uIGlueHNlYXJjaChiLGcscil7dmFyIGEscCxkaXN0O3ZhciBiZXN0ZD0xZTM7dmFyIGJlc3Q9LTE7dmFyIGk9bmV0aW5kZXhbZ107dmFyIGo9aS0xO3doaWxlKGk8bmV0c2l6ZXx8aj49MCl7aWYoaTxuZXRzaXplKXtwPW5ldHdvcmtbaV07ZGlzdD1wWzFdLWc7aWYoZGlzdD49YmVzdGQpaT1uZXRzaXplO2Vsc2V7aSsrO2lmKGRpc3Q8MClkaXN0PS1kaXN0O2E9cFswXS1iO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YT1wWzJdLXI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Q9cFszXX19fX1pZihqPj0wKXtwPW5ldHdvcmtbal07ZGlzdD1nLXBbMV07aWYoZGlzdD49YmVzdGQpaj0tMTtlbHNle2otLTtpZihkaXN0PDApZGlzdD0tZGlzdDthPXBbMF0tYjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2E9cFsyXS1yO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0PXBbM119fX19fXJldHVybiBiZXN0fWZ1bmN0aW9uIGxlYXJuKCl7dmFyIGk7dmFyIGxlbmd0aGNvdW50PXBpeGVscy5sZW5ndGg7dmFyIGFscGhhZGVjPTMwKyhzYW1wbGVmYWMtMSkvMzt2YXIgc2FtcGxlcGl4ZWxzPWxlbmd0aGNvdW50LygzKnNhbXBsZWZhYyk7dmFyIGRlbHRhPX5+KHNhbXBsZXBpeGVscy9uY3ljbGVzKTt2YXIgYWxwaGE9aW5pdGFscGhhO3ZhciByYWRpdXM9aW5pdHJhZGl1czt2YXIgcmFkPXJhZGl1cz4+cmFkaXVzYmlhc3NoaWZ0O2lmKHJhZDw9MSlyYWQ9MDtmb3IoaT0wO2k8cmFkO2krKylyYWRwb3dlcltpXT1hbHBoYSooKHJhZCpyYWQtaSppKSpyYWRiaWFzLyhyYWQqcmFkKSk7dmFyIHN0ZXA7aWYobGVuZ3RoY291bnQ8bWlucGljdHVyZWJ5dGVzKXtzYW1wbGVmYWM9MTtzdGVwPTN9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTEhPT0wKXtzdGVwPTMqcHJpbWUxfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUyIT09MCl7c3RlcD0zKnByaW1lMn1lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMyE9PTApe3N0ZXA9MypwcmltZTN9ZWxzZXtzdGVwPTMqcHJpbWU0fXZhciBiLGcscixqO3ZhciBwaXg9MDtpPTA7d2hpbGUoaTxzYW1wbGVwaXhlbHMpe2I9KHBpeGVsc1twaXhdJjI1NSk8PG5ldGJpYXNzaGlmdDtnPShwaXhlbHNbcGl4KzFdJjI1NSk8PG5ldGJpYXNzaGlmdDtyPShwaXhlbHNbcGl4KzJdJjI1NSk8PG5ldGJpYXNzaGlmdDtqPWNvbnRlc3QoYixnLHIpO2FsdGVyc2luZ2xlKGFscGhhLGosYixnLHIpO2lmKHJhZCE9PTApYWx0ZXJuZWlnaChyYWQsaixiLGcscik7cGl4Kz1zdGVwO2lmKHBpeD49bGVuZ3RoY291bnQpcGl4LT1sZW5ndGhjb3VudDtpKys7aWYoZGVsdGE9PT0wKWRlbHRhPTE7aWYoaSVkZWx0YT09PTApe2FscGhhLT1hbHBoYS9hbHBoYWRlYztyYWRpdXMtPXJhZGl1cy9yYWRpdXNkZWM7cmFkPXJhZGl1cz4+cmFkaXVzYmlhc3NoaWZ0O2lmKHJhZDw9MSlyYWQ9MDtmb3Ioaj0wO2o8cmFkO2orKylyYWRwb3dlcltqXT1hbHBoYSooKHJhZCpyYWQtaipqKSpyYWRiaWFzLyhyYWQqcmFkKSl9fX1mdW5jdGlvbiBidWlsZENvbG9ybWFwKCl7aW5pdCgpO2xlYXJuKCk7dW5iaWFzbmV0KCk7aW54YnVpbGQoKX10aGlzLmJ1aWxkQ29sb3JtYXA9YnVpbGRDb2xvcm1hcDtmdW5jdGlvbiBnZXRDb2xvcm1hcCgpe3ZhciBtYXA9W107dmFyIGluZGV4PVtdO2Zvcih2YXIgaT0wO2k8bmV0c2l6ZTtpKyspaW5kZXhbbmV0d29ya1tpXVszXV09aTt2YXIgaz0wO2Zvcih2YXIgbD0wO2w8bmV0c2l6ZTtsKyspe3ZhciBqPWluZGV4W2xdO21hcFtrKytdPW5ldHdvcmtbal1bMF07bWFwW2srK109bmV0d29ya1tqXVsxXTttYXBbaysrXT1uZXR3b3JrW2pdWzJdfXJldHVybiBtYXB9dGhpcy5nZXRDb2xvcm1hcD1nZXRDb2xvcm1hcDt0aGlzLmxvb2t1cFJHQj1pbnhzZWFyY2h9bW9kdWxlLmV4cG9ydHM9TmV1UXVhbnR9LHt9XSw1OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgVUEsYnJvd3Nlcixtb2RlLHBsYXRmb3JtLHVhO3VhPW5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtwbGF0Zm9ybT1uYXZpZ2F0b3IucGxhdGZvcm0udG9Mb3dlckNhc2UoKTtVQT11YS5tYXRjaCgvKG9wZXJhfGllfGZpcmVmb3h8Y2hyb21lfHZlcnNpb24pW1xcc1xcLzpdKFtcXHdcXGRcXC5dKyk/Lio/KHNhZmFyaXx2ZXJzaW9uW1xcc1xcLzpdKFtcXHdcXGRcXC5dKyl8JCkvKXx8W251bGwsXCJ1bmtub3duXCIsMF07bW9kZT1VQVsxXT09PVwiaWVcIiYmZG9jdW1lbnQuZG9jdW1lbnRNb2RlO2Jyb3dzZXI9e25hbWU6VUFbMV09PT1cInZlcnNpb25cIj9VQVszXTpVQVsxXSx2ZXJzaW9uOm1vZGV8fHBhcnNlRmxvYXQoVUFbMV09PT1cIm9wZXJhXCImJlVBWzRdP1VBWzRdOlVBWzJdKSxwbGF0Zm9ybTp7bmFtZTp1YS5tYXRjaCgvaXAoPzphZHxvZHxob25lKS8pP1wiaW9zXCI6KHVhLm1hdGNoKC8oPzp3ZWJvc3xhbmRyb2lkKS8pfHxwbGF0Zm9ybS5tYXRjaCgvbWFjfHdpbnxsaW51eC8pfHxbXCJvdGhlclwiXSlbMF19fTticm93c2VyW2Jyb3dzZXIubmFtZV09dHJ1ZTticm93c2VyW2Jyb3dzZXIubmFtZStwYXJzZUludChicm93c2VyLnZlcnNpb24sMTApXT10cnVlO2Jyb3dzZXIucGxhdGZvcm1bYnJvd3Nlci5wbGF0Zm9ybS5uYW1lXT10cnVlO21vZHVsZS5leHBvcnRzPWJyb3dzZXJ9LHt9XSw2OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgRXZlbnRFbWl0dGVyLEdJRixHSUZFbmNvZGVyLGJyb3dzZXIsZ2lmV29ya2VyLGV4dGVuZD1mdW5jdGlvbihjaGlsZCxwYXJlbnQpe2Zvcih2YXIga2V5IGluIHBhcmVudCl7aWYoaGFzUHJvcC5jYWxsKHBhcmVudCxrZXkpKWNoaWxkW2tleV09cGFyZW50W2tleV19ZnVuY3Rpb24gY3Rvcigpe3RoaXMuY29uc3RydWN0b3I9Y2hpbGR9Y3Rvci5wcm90b3R5cGU9cGFyZW50LnByb3RvdHlwZTtjaGlsZC5wcm90b3R5cGU9bmV3IGN0b3I7Y2hpbGQuX19zdXBlcl9fPXBhcmVudC5wcm90b3R5cGU7cmV0dXJuIGNoaWxkfSxoYXNQcm9wPXt9Lmhhc093blByb3BlcnR5LGluZGV4T2Y9W10uaW5kZXhPZnx8ZnVuY3Rpb24oaXRlbSl7Zm9yKHZhciBpPTAsbD10aGlzLmxlbmd0aDtpPGw7aSsrKXtpZihpIGluIHRoaXMmJnRoaXNbaV09PT1pdGVtKXJldHVybiBpfXJldHVybi0xfSxzbGljZT1bXS5zbGljZTtFdmVudEVtaXR0ZXI9cmVxdWlyZShcImV2ZW50c1wiKS5FdmVudEVtaXR0ZXI7YnJvd3Nlcj1yZXF1aXJlKFwiLi9icm93c2VyLmNvZmZlZVwiKTtHSUZFbmNvZGVyPXJlcXVpcmUoXCIuL0dJRkVuY29kZXIuanNcIik7Z2lmV29ya2VyPXJlcXVpcmUoXCIuL2dpZi53b3JrZXIuY29mZmVlXCIpO21vZHVsZS5leHBvcnRzPUdJRj1mdW5jdGlvbihzdXBlckNsYXNzKXt2YXIgZGVmYXVsdHMsZnJhbWVEZWZhdWx0cztleHRlbmQoR0lGLHN1cGVyQ2xhc3MpO2RlZmF1bHRzPXt3b3JrZXJTY3JpcHQ6XCJnaWYud29ya2VyLmpzXCIsd29ya2VyczoyLHJlcGVhdDowLGJhY2tncm91bmQ6XCIjZmZmXCIscXVhbGl0eToxMCx3aWR0aDpudWxsLGhlaWdodDpudWxsLHRyYW5zcGFyZW50Om51bGwsZGVidWc6ZmFsc2UsZGl0aGVyOmZhbHNlfTtmcmFtZURlZmF1bHRzPXtkZWxheTo1MDAsY29weTpmYWxzZSxkaXNwb3NlOi0xfTtmdW5jdGlvbiBHSUYob3B0aW9ucyl7dmFyIGJhc2Usa2V5LHZhbHVlO3RoaXMucnVubmluZz1mYWxzZTt0aGlzLm9wdGlvbnM9e307dGhpcy5mcmFtZXM9W107dGhpcy5mcmVlV29ya2Vycz1bXTt0aGlzLmFjdGl2ZVdvcmtlcnM9W107dGhpcy5zZXRPcHRpb25zKG9wdGlvbnMpO2ZvcihrZXkgaW4gZGVmYXVsdHMpe3ZhbHVlPWRlZmF1bHRzW2tleV07aWYoKGJhc2U9dGhpcy5vcHRpb25zKVtrZXldPT1udWxsKXtiYXNlW2tleV09dmFsdWV9fX1HSUYucHJvdG90eXBlLnNldE9wdGlvbj1mdW5jdGlvbihrZXksdmFsdWUpe3RoaXMub3B0aW9uc1trZXldPXZhbHVlO2lmKHRoaXMuX2NhbnZhcyE9bnVsbCYmKGtleT09PVwid2lkdGhcInx8a2V5PT09XCJoZWlnaHRcIikpe3JldHVybiB0aGlzLl9jYW52YXNba2V5XT12YWx1ZX19O0dJRi5wcm90b3R5cGUuc2V0T3B0aW9ucz1mdW5jdGlvbihvcHRpb25zKXt2YXIga2V5LHJlc3VsdHMsdmFsdWU7cmVzdWx0cz1bXTtmb3Ioa2V5IGluIG9wdGlvbnMpe2lmKCFoYXNQcm9wLmNhbGwob3B0aW9ucyxrZXkpKWNvbnRpbnVlO3ZhbHVlPW9wdGlvbnNba2V5XTtyZXN1bHRzLnB1c2godGhpcy5zZXRPcHRpb24oa2V5LHZhbHVlKSl9cmV0dXJuIHJlc3VsdHN9O0dJRi5wcm90b3R5cGUuYWRkRnJhbWU9ZnVuY3Rpb24oaW1hZ2Usb3B0aW9ucyl7dmFyIGZyYW1lLGtleTtpZihvcHRpb25zPT1udWxsKXtvcHRpb25zPXt9fWZyYW1lPXt9O2ZyYW1lLnRyYW5zcGFyZW50PXRoaXMub3B0aW9ucy50cmFuc3BhcmVudDtmb3Ioa2V5IGluIGZyYW1lRGVmYXVsdHMpe2ZyYW1lW2tleV09b3B0aW9uc1trZXldfHxmcmFtZURlZmF1bHRzW2tleV19aWYodGhpcy5vcHRpb25zLndpZHRoPT1udWxsKXt0aGlzLnNldE9wdGlvbihcIndpZHRoXCIsaW1hZ2Uud2lkdGgpfWlmKHRoaXMub3B0aW9ucy5oZWlnaHQ9PW51bGwpe3RoaXMuc2V0T3B0aW9uKFwiaGVpZ2h0XCIsaW1hZ2UuaGVpZ2h0KX1pZih0eXBlb2YgSW1hZ2VEYXRhIT09XCJ1bmRlZmluZWRcIiYmSW1hZ2VEYXRhIT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBJbWFnZURhdGEpe2ZyYW1lLmRhdGE9aW1hZ2UuZGF0YX1lbHNlIGlmKHR5cGVvZiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQhPT1cInVuZGVmaW5lZFwiJiZDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRHx8dHlwZW9mIFdlYkdMUmVuZGVyaW5nQ29udGV4dCE9PVwidW5kZWZpbmVkXCImJldlYkdMUmVuZGVyaW5nQ29udGV4dCE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgV2ViR0xSZW5kZXJpbmdDb250ZXh0KXtpZihvcHRpb25zLmNvcHkpe2ZyYW1lLmRhdGE9dGhpcy5nZXRDb250ZXh0RGF0YShpbWFnZSl9ZWxzZXtmcmFtZS5jb250ZXh0PWltYWdlfX1lbHNlIGlmKGltYWdlLmNoaWxkTm9kZXMhPW51bGwpe2lmKG9wdGlvbnMuY29weSl7ZnJhbWUuZGF0YT10aGlzLmdldEltYWdlRGF0YShpbWFnZSl9ZWxzZXtmcmFtZS5pbWFnZT1pbWFnZX19ZWxzZXt0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGltYWdlXCIpfXJldHVybiB0aGlzLmZyYW1lcy5wdXNoKGZyYW1lKX07R0lGLnByb3RvdHlwZS5yZW5kZXI9ZnVuY3Rpb24oKXt2YXIgaSxqLG51bVdvcmtlcnMscmVmO2lmKHRoaXMucnVubmluZyl7dGhyb3cgbmV3IEVycm9yKFwiQWxyZWFkeSBydW5uaW5nXCIpfWlmKHRoaXMub3B0aW9ucy53aWR0aD09bnVsbHx8dGhpcy5vcHRpb25zLmhlaWdodD09bnVsbCl7dGhyb3cgbmV3IEVycm9yKFwiV2lkdGggYW5kIGhlaWdodCBtdXN0IGJlIHNldCBwcmlvciB0byByZW5kZXJpbmdcIil9dGhpcy5ydW5uaW5nPXRydWU7dGhpcy5uZXh0RnJhbWU9MDt0aGlzLmZpbmlzaGVkRnJhbWVzPTA7dGhpcy5pbWFnZVBhcnRzPWZ1bmN0aW9uKCl7dmFyIGoscmVmLHJlc3VsdHM7cmVzdWx0cz1bXTtmb3IoaT1qPTAscmVmPXRoaXMuZnJhbWVzLmxlbmd0aDswPD1yZWY/ajxyZWY6aj5yZWY7aT0wPD1yZWY/KytqOi0tail7cmVzdWx0cy5wdXNoKG51bGwpfXJldHVybiByZXN1bHRzfS5jYWxsKHRoaXMpO251bVdvcmtlcnM9dGhpcy5zcGF3bldvcmtlcnMoKTtpZih0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9ZWxzZXtmb3IoaT1qPTAscmVmPW51bVdvcmtlcnM7MDw9cmVmP2o8cmVmOmo+cmVmO2k9MDw9cmVmPysrajotLWope3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9fXRoaXMuZW1pdChcInN0YXJ0XCIpO3JldHVybiB0aGlzLmVtaXQoXCJwcm9ncmVzc1wiLDApfTtHSUYucHJvdG90eXBlLmFib3J0PWZ1bmN0aW9uKCl7dmFyIHdvcmtlcjt3aGlsZSh0cnVlKXt3b3JrZXI9dGhpcy5hY3RpdmVXb3JrZXJzLnNoaWZ0KCk7aWYod29ya2VyPT1udWxsKXticmVha310aGlzLmxvZyhcImtpbGxpbmcgYWN0aXZlIHdvcmtlclwiKTt3b3JrZXIudGVybWluYXRlKCl9dGhpcy5ydW5uaW5nPWZhbHNlO3JldHVybiB0aGlzLmVtaXQoXCJhYm9ydFwiKX07R0lGLnByb3RvdHlwZS5zcGF3bldvcmtlcnM9ZnVuY3Rpb24oKXt2YXIgaixudW1Xb3JrZXJzLHJlZixyZXN1bHRzO251bVdvcmtlcnM9TWF0aC5taW4odGhpcy5vcHRpb25zLndvcmtlcnMsdGhpcy5mcmFtZXMubGVuZ3RoKTsoZnVuY3Rpb24oKXtyZXN1bHRzPVtdO2Zvcih2YXIgaj1yZWY9dGhpcy5mcmVlV29ya2Vycy5sZW5ndGg7cmVmPD1udW1Xb3JrZXJzP2o8bnVtV29ya2VyczpqPm51bVdvcmtlcnM7cmVmPD1udW1Xb3JrZXJzP2orKzpqLS0pe3Jlc3VsdHMucHVzaChqKX1yZXR1cm4gcmVzdWx0c30pLmFwcGx5KHRoaXMpLmZvckVhY2goZnVuY3Rpb24oX3RoaXMpe3JldHVybiBmdW5jdGlvbihpKXt2YXIgd29ya2VyO190aGlzLmxvZyhcInNwYXduaW5nIHdvcmtlciBcIitpKTt3b3JrZXI9bmV3IFdvcmtlcihfdGhpcy5vcHRpb25zLndvcmtlclNjcmlwdCk7d29ya2VyLm9ubWVzc2FnZT1mdW5jdGlvbihldmVudCl7X3RoaXMuYWN0aXZlV29ya2Vycy5zcGxpY2UoX3RoaXMuYWN0aXZlV29ya2Vycy5pbmRleE9mKHdvcmtlciksMSk7X3RoaXMuZnJlZVdvcmtlcnMucHVzaCh3b3JrZXIpO3JldHVybiBfdGhpcy5mcmFtZUZpbmlzaGVkKGV2ZW50LmRhdGEpfTtyZXR1cm4gX3RoaXMuZnJlZVdvcmtlcnMucHVzaCh3b3JrZXIpfX0odGhpcykpO3JldHVybiBudW1Xb3JrZXJzfTtHSUYucHJvdG90eXBlLmZyYW1lRmluaXNoZWQ9ZnVuY3Rpb24oZnJhbWUpe3ZhciBpLGoscmVmO3RoaXMubG9nKFwiZnJhbWUgXCIrZnJhbWUuaW5kZXgrXCIgZmluaXNoZWQgLSBcIit0aGlzLmFjdGl2ZVdvcmtlcnMubGVuZ3RoK1wiIGFjdGl2ZVwiKTt0aGlzLmZpbmlzaGVkRnJhbWVzKys7dGhpcy5lbWl0KFwicHJvZ3Jlc3NcIix0aGlzLmZpbmlzaGVkRnJhbWVzL3RoaXMuZnJhbWVzLmxlbmd0aCk7dGhpcy5pbWFnZVBhcnRzW2ZyYW1lLmluZGV4XT1mcmFtZTtpZih0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe3RoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPWZyYW1lLmdsb2JhbFBhbGV0dGU7dGhpcy5sb2coXCJnbG9iYWwgcGFsZXR0ZSBhbmFseXplZFwiKTtpZih0aGlzLmZyYW1lcy5sZW5ndGg+Mil7Zm9yKGk9aj0xLHJlZj10aGlzLmZyZWVXb3JrZXJzLmxlbmd0aDsxPD1yZWY/ajxyZWY6aj5yZWY7aT0xPD1yZWY/KytqOi0tail7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX19fWlmKGluZGV4T2YuY2FsbCh0aGlzLmltYWdlUGFydHMsbnVsbCk+PTApe3JldHVybiB0aGlzLnJlbmRlck5leHRGcmFtZSgpfWVsc2V7cmV0dXJuIHRoaXMuZmluaXNoUmVuZGVyaW5nKCl9fTtHSUYucHJvdG90eXBlLmZpbmlzaFJlbmRlcmluZz1mdW5jdGlvbigpe3ZhciBkYXRhLGZyYW1lLGksaW1hZ2UsaixrLGwsbGVuLGxlbjEsbGVuMixsZW4zLG9mZnNldCxwYWdlLHJlZixyZWYxLHJlZjI7bGVuPTA7cmVmPXRoaXMuaW1hZ2VQYXJ0cztmb3Ioaj0wLGxlbjE9cmVmLmxlbmd0aDtqPGxlbjE7aisrKXtmcmFtZT1yZWZbal07bGVuKz0oZnJhbWUuZGF0YS5sZW5ndGgtMSkqZnJhbWUucGFnZVNpemUrZnJhbWUuY3Vyc29yfWxlbis9ZnJhbWUucGFnZVNpemUtZnJhbWUuY3Vyc29yO3RoaXMubG9nKFwicmVuZGVyaW5nIGZpbmlzaGVkIC0gZmlsZXNpemUgXCIrTWF0aC5yb3VuZChsZW4vMWUzKStcImtiXCIpO2RhdGE9bmV3IFVpbnQ4QXJyYXkobGVuKTtvZmZzZXQ9MDtyZWYxPXRoaXMuaW1hZ2VQYXJ0cztmb3Ioaz0wLGxlbjI9cmVmMS5sZW5ndGg7azxsZW4yO2srKyl7ZnJhbWU9cmVmMVtrXTtyZWYyPWZyYW1lLmRhdGE7Zm9yKGk9bD0wLGxlbjM9cmVmMi5sZW5ndGg7bDxsZW4zO2k9KytsKXtwYWdlPXJlZjJbaV07ZGF0YS5zZXQocGFnZSxvZmZzZXQpO2lmKGk9PT1mcmFtZS5kYXRhLmxlbmd0aC0xKXtvZmZzZXQrPWZyYW1lLmN1cnNvcn1lbHNle29mZnNldCs9ZnJhbWUucGFnZVNpemV9fX1pbWFnZT1uZXcgQmxvYihbZGF0YV0se3R5cGU6XCJpbWFnZS9naWZcIn0pO3JldHVybiB0aGlzLmVtaXQoXCJmaW5pc2hlZFwiLGltYWdlLGRhdGEpfTtHSUYucHJvdG90eXBlLnJlbmRlck5leHRGcmFtZT1mdW5jdGlvbigpe3ZhciBmcmFtZSx0YXNrLHdvcmtlcjtpZih0aGlzLmZyZWVXb3JrZXJzLmxlbmd0aD09PTApe3Rocm93IG5ldyBFcnJvcihcIk5vIGZyZWUgd29ya2Vyc1wiKX1pZih0aGlzLm5leHRGcmFtZT49dGhpcy5mcmFtZXMubGVuZ3RoKXtyZXR1cm59ZnJhbWU9dGhpcy5mcmFtZXNbdGhpcy5uZXh0RnJhbWUrK107d29ya2VyPXRoaXMuZnJlZVdvcmtlcnMuc2hpZnQoKTt0YXNrPXRoaXMuZ2V0VGFzayhmcmFtZSk7dGhpcy5sb2coXCJzdGFydGluZyBmcmFtZSBcIisodGFzay5pbmRleCsxKStcIiBvZiBcIit0aGlzLmZyYW1lcy5sZW5ndGgpO3RoaXMuYWN0aXZlV29ya2Vycy5wdXNoKHdvcmtlcik7cmV0dXJuIHdvcmtlci5wb3N0TWVzc2FnZSh0YXNrKX07R0lGLnByb3RvdHlwZS5nZXRDb250ZXh0RGF0YT1mdW5jdGlvbihjdHgpe3JldHVybiBjdHguZ2V0SW1hZ2VEYXRhKDAsMCx0aGlzLm9wdGlvbnMud2lkdGgsdGhpcy5vcHRpb25zLmhlaWdodCkuZGF0YX07R0lGLnByb3RvdHlwZS5nZXRJbWFnZURhdGE9ZnVuY3Rpb24oaW1hZ2Upe3ZhciBjdHg7aWYodGhpcy5fY2FudmFzPT1udWxsKXt0aGlzLl9jYW52YXM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTt0aGlzLl9jYW52YXMud2lkdGg9dGhpcy5vcHRpb25zLndpZHRoO3RoaXMuX2NhbnZhcy5oZWlnaHQ9dGhpcy5vcHRpb25zLmhlaWdodH1jdHg9dGhpcy5fY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtjdHguc2V0RmlsbD10aGlzLm9wdGlvbnMuYmFja2dyb3VuZDtjdHguZmlsbFJlY3QoMCwwLHRoaXMub3B0aW9ucy53aWR0aCx0aGlzLm9wdGlvbnMuaGVpZ2h0KTtjdHguZHJhd0ltYWdlKGltYWdlLDAsMCk7cmV0dXJuIHRoaXMuZ2V0Q29udGV4dERhdGEoY3R4KX07R0lGLnByb3RvdHlwZS5nZXRUYXNrPWZ1bmN0aW9uKGZyYW1lKXt2YXIgaW5kZXgsdGFzaztpbmRleD10aGlzLmZyYW1lcy5pbmRleE9mKGZyYW1lKTt0YXNrPXtpbmRleDppbmRleCxsYXN0OmluZGV4PT09dGhpcy5mcmFtZXMubGVuZ3RoLTEsZGVsYXk6ZnJhbWUuZGVsYXksZGlzcG9zZTpmcmFtZS5kaXNwb3NlLHRyYW5zcGFyZW50OmZyYW1lLnRyYW5zcGFyZW50LHdpZHRoOnRoaXMub3B0aW9ucy53aWR0aCxoZWlnaHQ6dGhpcy5vcHRpb25zLmhlaWdodCxxdWFsaXR5OnRoaXMub3B0aW9ucy5xdWFsaXR5LGRpdGhlcjp0aGlzLm9wdGlvbnMuZGl0aGVyLGdsb2JhbFBhbGV0dGU6dGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGUscmVwZWF0OnRoaXMub3B0aW9ucy5yZXBlYXQsY2FuVHJhbnNmZXI6YnJvd3Nlci5uYW1lPT09XCJjaHJvbWVcIn07aWYoZnJhbWUuZGF0YSE9bnVsbCl7dGFzay5kYXRhPWZyYW1lLmRhdGF9ZWxzZSBpZihmcmFtZS5jb250ZXh0IT1udWxsKXt0YXNrLmRhdGE9dGhpcy5nZXRDb250ZXh0RGF0YShmcmFtZS5jb250ZXh0KX1lbHNlIGlmKGZyYW1lLmltYWdlIT1udWxsKXt0YXNrLmRhdGE9dGhpcy5nZXRJbWFnZURhdGEoZnJhbWUuaW1hZ2UpfWVsc2V7dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBmcmFtZVwiKX1yZXR1cm4gdGFza307R0lGLnByb3RvdHlwZS5sb2c9ZnVuY3Rpb24oKXt2YXIgYXJnczthcmdzPTE8PWFyZ3VtZW50cy5sZW5ndGg/c2xpY2UuY2FsbChhcmd1bWVudHMsMCk6W107aWYoIXRoaXMub3B0aW9ucy5kZWJ1Zyl7cmV0dXJufXJldHVybiBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLGFyZ3MpfTtyZXR1cm4gR0lGfShFdmVudEVtaXR0ZXIpfSx7XCIuL0dJRkVuY29kZXIuanNcIjoyLFwiLi9icm93c2VyLmNvZmZlZVwiOjUsXCIuL2dpZi53b3JrZXIuY29mZmVlXCI6NyxldmVudHM6MX1dLDc6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBHSUZFbmNvZGVyLHJlbmRlckZyYW1lO0dJRkVuY29kZXI9cmVxdWlyZShcIi4vR0lGRW5jb2Rlci5qc1wiKTtyZW5kZXJGcmFtZT1mdW5jdGlvbihmcmFtZSl7dmFyIGVuY29kZXIscGFnZSxzdHJlYW0sdHJhbnNmZXI7ZW5jb2Rlcj1uZXcgR0lGRW5jb2RlcihmcmFtZS53aWR0aCxmcmFtZS5oZWlnaHQpO2lmKGZyYW1lLmluZGV4PT09MCl7ZW5jb2Rlci53cml0ZUhlYWRlcigpfWVsc2V7ZW5jb2Rlci5maXJzdEZyYW1lPWZhbHNlfWVuY29kZXIuc2V0VHJhbnNwYXJlbnQoZnJhbWUudHJhbnNwYXJlbnQpO2VuY29kZXIuc2V0RGlzcG9zZShmcmFtZS5kaXNwb3NlKTtlbmNvZGVyLnNldFJlcGVhdChmcmFtZS5yZXBlYXQpO2VuY29kZXIuc2V0RGVsYXkoZnJhbWUuZGVsYXkpO2VuY29kZXIuc2V0UXVhbGl0eShmcmFtZS5xdWFsaXR5KTtlbmNvZGVyLnNldERpdGhlcihmcmFtZS5kaXRoZXIpO2VuY29kZXIuc2V0R2xvYmFsUGFsZXR0ZShmcmFtZS5nbG9iYWxQYWxldHRlKTtlbmNvZGVyLmFkZEZyYW1lKGZyYW1lLmRhdGEpO2lmKGZyYW1lLmxhc3Qpe2VuY29kZXIuZmluaXNoKCl9aWYoZnJhbWUuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe2ZyYW1lLmdsb2JhbFBhbGV0dGU9ZW5jb2Rlci5nZXRHbG9iYWxQYWxldHRlKCl9c3RyZWFtPWVuY29kZXIuc3RyZWFtKCk7ZnJhbWUuZGF0YT1zdHJlYW0ucGFnZXM7ZnJhbWUuY3Vyc29yPXN0cmVhbS5jdXJzb3I7ZnJhbWUucGFnZVNpemU9c3RyZWFtLmNvbnN0cnVjdG9yLnBhZ2VTaXplO2lmKGZyYW1lLmNhblRyYW5zZmVyKXt0cmFuc2Zlcj1mdW5jdGlvbigpe3ZhciBpLGxlbixyZWYscmVzdWx0cztyZWY9ZnJhbWUuZGF0YTtyZXN1bHRzPVtdO2ZvcihpPTAsbGVuPXJlZi5sZW5ndGg7aTxsZW47aSsrKXtwYWdlPXJlZltpXTtyZXN1bHRzLnB1c2gocGFnZS5idWZmZXIpfXJldHVybiByZXN1bHRzfSgpO3JldHVybiBzZWxmLnBvc3RNZXNzYWdlKGZyYW1lLHRyYW5zZmVyKX1lbHNle3JldHVybiBzZWxmLnBvc3RNZXNzYWdlKGZyYW1lKX19O3NlbGYub25tZXNzYWdlPWZ1bmN0aW9uKGV2ZW50KXtyZXR1cm4gcmVuZGVyRnJhbWUoZXZlbnQuZGF0YSl9fSx7XCIuL0dJRkVuY29kZXIuanNcIjoyfV19LHt9LFs2XSkoNil9KTtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Z2lmLmpzLm1hcFxyXG4iLCI7KGZ1bmN0aW9uKCkge1xyXG5cclxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICB2YXIgVGFyID0gcmVxdWlyZSgnLi90YXIuanMnKTtcclxuICB2YXIgZG93bmxvYWQgPSByZXF1aXJlKCcuL2Rvd25sb2FkLmpzJyk7XHJcbiAgdmFyIEdJRiA9IHJlcXVpcmUoJy4vZ2lmLmpzJyk7XHJcbn1cclxuXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxudmFyIG9iamVjdFR5cGVzID0ge1xyXG4nZnVuY3Rpb24nOiB0cnVlLFxyXG4nb2JqZWN0JzogdHJ1ZVxyXG59O1xyXG5cclxuZnVuY3Rpb24gY2hlY2tHbG9iYWwodmFsdWUpIHtcclxuICAgIHJldHVybiAodmFsdWUgJiYgdmFsdWUuT2JqZWN0ID09PSBPYmplY3QpID8gdmFsdWUgOiBudWxsO1xyXG4gIH1cclxuXHJcbi8qKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyB3aXRob3V0IGEgZGVwZW5kZW5jeSBvbiBgcm9vdGAuICovXHJcbnZhciBmcmVlUGFyc2VGbG9hdCA9IHBhcnNlRmxvYXQsXHJcbiAgZnJlZVBhcnNlSW50ID0gcGFyc2VJbnQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgLiAqL1xyXG52YXIgZnJlZUV4cG9ydHMgPSAob2JqZWN0VHlwZXNbdHlwZW9mIGV4cG9ydHNdICYmIGV4cG9ydHMgJiYgIWV4cG9ydHMubm9kZVR5cGUpXHJcbj8gZXhwb3J0c1xyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYC4gKi9cclxudmFyIGZyZWVNb2R1bGUgPSAob2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUpXHJcbj8gbW9kdWxlXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCB0aGUgcG9wdWxhciBDb21tb25KUyBleHRlbnNpb24gYG1vZHVsZS5leHBvcnRzYC4gKi9cclxudmFyIG1vZHVsZUV4cG9ydHMgPSAoZnJlZU1vZHVsZSAmJiBmcmVlTW9kdWxlLmV4cG9ydHMgPT09IGZyZWVFeHBvcnRzKVxyXG4/IGZyZWVFeHBvcnRzXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcy4gKi9cclxudmFyIGZyZWVHbG9iYWwgPSBjaGVja0dsb2JhbChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlICYmIHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsKTtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgc2VsZmAuICovXHJcbnZhciBmcmVlU2VsZiA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiBzZWxmXSAmJiBzZWxmKTtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgd2luZG93YC4gKi9cclxudmFyIGZyZWVXaW5kb3cgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygd2luZG93XSAmJiB3aW5kb3cpO1xyXG5cclxuLyoqIERldGVjdCBgdGhpc2AgYXMgdGhlIGdsb2JhbCBvYmplY3QuICovXHJcbnZhciB0aGlzR2xvYmFsID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHRoaXNdICYmIHRoaXMpO1xyXG5cclxuLyoqXHJcbiogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdC5cclxuKlxyXG4qIFRoZSBgdGhpc2AgdmFsdWUgaXMgdXNlZCBpZiBpdCdzIHRoZSBnbG9iYWwgb2JqZWN0IHRvIGF2b2lkIEdyZWFzZW1vbmtleSdzXHJcbiogcmVzdHJpY3RlZCBgd2luZG93YCBvYmplY3QsIG90aGVyd2lzZSB0aGUgYHdpbmRvd2Agb2JqZWN0IGlzIHVzZWQuXHJcbiovXHJcbnZhciByb290ID0gZnJlZUdsb2JhbCB8fFxyXG4oKGZyZWVXaW5kb3cgIT09ICh0aGlzR2xvYmFsICYmIHRoaXNHbG9iYWwud2luZG93KSkgJiYgZnJlZVdpbmRvdykgfHxcclxuICBmcmVlU2VsZiB8fCB0aGlzR2xvYmFsIHx8IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XHJcblxyXG5pZiggISgnZ2MnIGluIHdpbmRvdyApICkge1xyXG5cdHdpbmRvdy5nYyA9IGZ1bmN0aW9uKCl7fVxyXG59XHJcblxyXG5pZiAoIUhUTUxDYW52YXNFbGVtZW50LnByb3RvdHlwZS50b0Jsb2IpIHtcclxuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShIVE1MQ2FudmFzRWxlbWVudC5wcm90b3R5cGUsICd0b0Jsb2InLCB7XHJcbiAgdmFsdWU6IGZ1bmN0aW9uIChjYWxsYmFjaywgdHlwZSwgcXVhbGl0eSkge1xyXG5cclxuICAgIHZhciBiaW5TdHIgPSBhdG9iKCB0aGlzLnRvRGF0YVVSTCh0eXBlLCBxdWFsaXR5KS5zcGxpdCgnLCcpWzFdICksXHJcbiAgICAgICAgbGVuID0gYmluU3RyLmxlbmd0aCxcclxuICAgICAgICBhcnIgPSBuZXcgVWludDhBcnJheShsZW4pO1xyXG5cclxuICAgIGZvciAodmFyIGk9MDsgaTxsZW47IGkrKyApIHtcclxuICAgICBhcnJbaV0gPSBiaW5TdHIuY2hhckNvZGVBdChpKTtcclxuICAgIH1cclxuXHJcbiAgICBjYWxsYmFjayggbmV3IEJsb2IoIFthcnJdLCB7dHlwZTogdHlwZSB8fCAnaW1hZ2UvcG5nJ30gKSApO1xyXG4gIH1cclxuIH0pO1xyXG59XHJcblxyXG4vLyBAbGljZW5zZSBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXHJcbi8vIGNvcHlyaWdodCBQYXVsIElyaXNoIDIwMTVcclxuXHJcblxyXG4vLyBEYXRlLm5vdygpIGlzIHN1cHBvcnRlZCBldmVyeXdoZXJlIGV4Y2VwdCBJRTguIEZvciBJRTggd2UgdXNlIHRoZSBEYXRlLm5vdyBwb2x5ZmlsbFxyXG4vLyAgIGdpdGh1Yi5jb20vRmluYW5jaWFsLVRpbWVzL3BvbHlmaWxsLXNlcnZpY2UvYmxvYi9tYXN0ZXIvcG9seWZpbGxzL0RhdGUubm93L3BvbHlmaWxsLmpzXHJcbi8vIGFzIFNhZmFyaSA2IGRvZXNuJ3QgaGF2ZSBzdXBwb3J0IGZvciBOYXZpZ2F0aW9uVGltaW5nLCB3ZSB1c2UgYSBEYXRlLm5vdygpIHRpbWVzdGFtcCBmb3IgcmVsYXRpdmUgdmFsdWVzXHJcblxyXG4vLyBpZiB5b3Ugd2FudCB2YWx1ZXMgc2ltaWxhciB0byB3aGF0IHlvdSdkIGdldCB3aXRoIHJlYWwgcGVyZi5ub3csIHBsYWNlIHRoaXMgdG93YXJkcyB0aGUgaGVhZCBvZiB0aGUgcGFnZVxyXG4vLyBidXQgaW4gcmVhbGl0eSwgeW91J3JlIGp1c3QgZ2V0dGluZyB0aGUgZGVsdGEgYmV0d2VlbiBub3coKSBjYWxscywgc28gaXQncyBub3QgdGVycmlibHkgaW1wb3J0YW50IHdoZXJlIGl0J3MgcGxhY2VkXHJcblxyXG5cclxuKGZ1bmN0aW9uKCl7XHJcblxyXG4gIGlmIChcInBlcmZvcm1hbmNlXCIgaW4gd2luZG93ID09IGZhbHNlKSB7XHJcbiAgICAgIHdpbmRvdy5wZXJmb3JtYW5jZSA9IHt9O1xyXG4gIH1cclxuXHJcbiAgRGF0ZS5ub3cgPSAoRGF0ZS5ub3cgfHwgZnVuY3Rpb24gKCkgeyAgLy8gdGhhbmtzIElFOFxyXG5cdCAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gIH0pO1xyXG5cclxuICBpZiAoXCJub3dcIiBpbiB3aW5kb3cucGVyZm9ybWFuY2UgPT0gZmFsc2Upe1xyXG5cclxuICAgIHZhciBub3dPZmZzZXQgPSBEYXRlLm5vdygpO1xyXG5cclxuICAgIGlmIChwZXJmb3JtYW5jZS50aW1pbmcgJiYgcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydCl7XHJcbiAgICAgIG5vd09mZnNldCA9IHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnRcclxuICAgIH1cclxuXHJcbiAgICB3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24gbm93KCl7XHJcbiAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gbm93T2Zmc2V0O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbn0pKCk7XHJcblxyXG5cclxuZnVuY3Rpb24gcGFkKCBuICkge1xyXG5cdHJldHVybiBTdHJpbmcoXCIwMDAwMDAwXCIgKyBuKS5zbGljZSgtNyk7XHJcbn1cclxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvQWRkLW9ucy9Db2RlX3NuaXBwZXRzL1RpbWVyc1xyXG5cclxudmFyIGdfc3RhcnRUaW1lID0gd2luZG93LkRhdGUubm93KCk7XHJcblxyXG5mdW5jdGlvbiBndWlkKCkge1xyXG5cdGZ1bmN0aW9uIHM0KCkge1xyXG5cdFx0cmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApLnRvU3RyaW5nKDE2KS5zdWJzdHJpbmcoMSk7XHJcblx0fVxyXG5cdHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gQ0NGcmFtZUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgX2hhbmRsZXJzID0ge307XHJcblxyXG5cdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHJcblx0dGhpcy5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBoYW5kbGVyKSB7XHJcblxyXG5cdFx0X2hhbmRsZXJzW2V2ZW50XSA9IGhhbmRsZXI7XHJcblxyXG5cdH07XHJcblxyXG5cdHRoaXMuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblxyXG5cdFx0dmFyIGhhbmRsZXIgPSBfaGFuZGxlcnNbZXZlbnRdO1xyXG5cdFx0aWYgKGhhbmRsZXIpIHtcclxuXHJcblx0XHRcdGhhbmRsZXIuYXBwbHkobnVsbCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHR0aGlzLmZpbGVuYW1lID0gc2V0dGluZ3MubmFtZSB8fCBndWlkKCk7XHJcblx0dGhpcy5leHRlbnNpb24gPSAnJztcclxuXHR0aGlzLm1pbWVUeXBlID0gJyc7XHJcblxyXG59XHJcblxyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zYWZlVG9Qcm9jZWVkID0gZnVuY3Rpb24oKXsgcmV0dXJuIHRydWU7IH07XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdGVwID0gZnVuY3Rpb24oKSB7IGNvbnNvbGUubG9nKCAnU3RlcCBub3Qgc2V0IScgKSB9XHJcblxyXG5mdW5jdGlvbiBDQ1RhckVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcudGFyJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAnYXBwbGljYXRpb24veC10YXInXHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJyc7XHJcblxyXG5cdHRoaXMudGFwZSA9IG51bGxcclxuXHR0aGlzLmNvdW50ID0gMDtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe1xyXG5cclxuXHR0aGlzLmRpc3Bvc2UoKTtcclxuXHJcbn07XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBibG9iICkge1xyXG5cclxuXHR2YXIgZmlsZVJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcblx0ZmlsZVJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMudGFwZS5hcHBlbmQoIHBhZCggdGhpcy5jb3VudCApICsgdGhpcy5maWxlRXh0ZW5zaW9uLCBuZXcgVWludDhBcnJheSggZmlsZVJlYWRlci5yZXN1bHQgKSApO1xyXG5cclxuXHRcdC8vaWYoIHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lID4gMCAmJiAoIHRoaXMuZnJhbWVzLmxlbmd0aCAvIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlICkgPj0gdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgKSB7XHJcblxyXG5cdFx0dGhpcy5jb3VudCsrO1xyXG5cdFx0dGhpcy5zdGVwKCk7XHJcblx0fS5iaW5kKCB0aGlzICk7XHJcblx0ZmlsZVJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0Y2FsbGJhY2soIHRoaXMudGFwZS5zYXZlKCkgKTtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLnRhcGUgPSBuZXcgVGFyKCk7XHJcblx0dGhpcy5jb3VudCA9IDA7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ1BOR0VuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ1RhckVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy50eXBlID0gJ2ltYWdlL3BuZyc7XHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJy5wbmcnO1xyXG5cclxufVxyXG5cclxuQ0NQTkdFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDVGFyRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDUE5HRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0Y2FudmFzLnRvQmxvYiggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRDQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZC5jYWxsKCB0aGlzLCBibG9iICk7XHJcblx0fS5iaW5kKCB0aGlzICksIHRoaXMudHlwZSApXHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0pQRUdFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NUYXJFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMudHlwZSA9ICdpbWFnZS9qcGVnJztcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnLmpwZyc7XHJcblx0dGhpcy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG59XHJcblxyXG5DQ0pQRUdFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDVGFyRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDSlBFR0VuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGNhbnZhcy50b0Jsb2IoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0Q0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQuY2FsbCggdGhpcywgYmxvYiApO1xyXG5cdH0uYmluZCggdGhpcyApLCB0aGlzLnR5cGUsIHRoaXMucXVhbGl0eSApXHJcblxyXG59XHJcblxyXG4vKlxyXG5cclxuXHRXZWJNIEVuY29kZXJcclxuXHJcbiovXHJcblxyXG5mdW5jdGlvbiBDQ1dlYk1FbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcblx0aWYoIGNhbnZhcy50b0RhdGFVUkwoICdpbWFnZS93ZWJwJyApLnN1YnN0cig1LDEwKSAhPT0gJ2ltYWdlL3dlYnAnICl7XHJcblx0XHRjb25zb2xlLmxvZyggXCJXZWJQIG5vdCBzdXBwb3J0ZWQgLSB0cnkgYW5vdGhlciBleHBvcnQgZm9ybWF0XCIgKVxyXG5cdH1cclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy53ZWJtJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAndmlkZW8vd2VibSdcclxuXHR0aGlzLmJhc2VGaWxlbmFtZSA9IHRoaXMuZmlsZW5hbWU7XHJcblxyXG5cdHRoaXMuZnJhbWVzID0gW107XHJcblx0dGhpcy5wYXJ0ID0gMTtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlciA9IG5ldyBXZWJNV3JpdGVyKHtcclxuICAgIHF1YWxpdHk6IHRoaXMucXVhbGl0eSxcclxuICAgIGZpbGVXcml0ZXI6IG51bGwsXHJcbiAgICBmZDogbnVsbCxcclxuICAgIGZyYW1lUmF0ZTogc2V0dGluZ3MuZnJhbWVyYXRlXHJcbn0pO1xyXG5cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZGlzcG9zZSgpO1xyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlci5hZGRGcmFtZShjYW52YXMpO1xyXG5cclxuXHQvL3RoaXMuZnJhbWVzLnB1c2goIGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3dlYnAnLCB0aGlzLnF1YWxpdHkpICk7XHJcblxyXG5cdGlmKCB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSA+IDAgJiYgKCB0aGlzLmZyYW1lcy5sZW5ndGggLyB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApID49IHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lICkge1xyXG5cdFx0dGhpcy5zYXZlKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdFx0dGhpcy5maWxlbmFtZSA9IHRoaXMuYmFzZUZpbGVuYW1lICsgJy1wYXJ0LScgKyBwYWQoIHRoaXMucGFydCApO1xyXG5cdFx0XHRkb3dubG9hZCggYmxvYiwgdGhpcy5maWxlbmFtZSArIHRoaXMuZXh0ZW5zaW9uLCB0aGlzLm1pbWVUeXBlICk7XHJcblx0XHRcdHRoaXMuZGlzcG9zZSgpO1xyXG5cdFx0XHR0aGlzLnBhcnQrKztcclxuXHRcdFx0dGhpcy5maWxlbmFtZSA9IHRoaXMuYmFzZUZpbGVuYW1lICsgJy1wYXJ0LScgKyBwYWQoIHRoaXMucGFydCApO1xyXG5cdFx0XHR0aGlzLnN0ZXAoKTtcclxuXHRcdH0uYmluZCggdGhpcyApIClcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhpcy5zdGVwKCk7XHJcblx0fVxyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbi8vXHRpZiggIXRoaXMuZnJhbWVzLmxlbmd0aCApIHJldHVybjtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlci5jb21wbGV0ZSgpLnRoZW4oY2FsbGJhY2spO1xyXG5cclxuXHQvKnZhciB3ZWJtID0gV2hhbW15LmZyb21JbWFnZUFycmF5KCB0aGlzLmZyYW1lcywgdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKVxyXG5cdHZhciBibG9iID0gbmV3IEJsb2IoIFsgd2VibSBdLCB7IHR5cGU6IFwib2N0ZXQvc3RyZWFtXCIgfSApO1xyXG5cdGNhbGxiYWNrKCBibG9iICk7Ki9cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmZyYW1lcyA9IFtdO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxuXHR0aGlzLmVuY29kZXIgPSBuZXcgRkZNcGVnU2VydmVyLlZpZGVvKCBzZXR0aW5ncyApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvY2VzcycsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuZW1pdCggJ3Byb2Nlc3MnIClcclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oJ2ZpbmlzaGVkJywgZnVuY3Rpb24oIHVybCwgc2l6ZSApIHtcclxuICAgICAgICB2YXIgY2IgPSB0aGlzLmNhbGxiYWNrO1xyXG4gICAgICAgIGlmICggY2IgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGNiKCB1cmwsIHNpemUgKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvZ3Jlc3MnLCBmdW5jdGlvbiggcHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgaWYgKCB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyggcHJvZ3Jlc3MgKVxyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdlcnJvcicsIGZ1bmN0aW9uKCBkYXRhICkge1xyXG4gICAgICAgIGFsZXJ0KEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpKTtcclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zdGFydCggdGhpcy5zZXR0aW5ncyApO1xyXG5cclxufTtcclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmFkZCggY2FudmFzICk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG4gICAgdGhpcy5lbmNvZGVyLmVuZCgpO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zYWZlVG9Qcm9jZWVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5lbmNvZGVyLnNhZmVUb1Byb2NlZWQoKTtcclxufTtcclxuXHJcbi8qXHJcblx0SFRNTENhbnZhc0VsZW1lbnQuY2FwdHVyZVN0cmVhbSgpXHJcbiovXHJcblxyXG5mdW5jdGlvbiBDQ1N0cmVhbUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLmZyYW1lcmF0ZSA9IHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdHRoaXMudHlwZSA9ICd2aWRlby93ZWJtJztcclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcud2VibSc7XHJcblx0dGhpcy5zdHJlYW0gPSBudWxsO1xyXG5cdHRoaXMubWVkaWFSZWNvcmRlciA9IG51bGw7XHJcblx0dGhpcy5jaHVua3MgPSBbXTtcclxuXHJcbn1cclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0aWYoICF0aGlzLnN0cmVhbSApIHtcclxuXHRcdHRoaXMuc3RyZWFtID0gY2FudmFzLmNhcHR1cmVTdHJlYW0oIHRoaXMuZnJhbWVyYXRlICk7XHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIgPSBuZXcgTWVkaWFSZWNvcmRlciggdGhpcy5zdHJlYW0gKTtcclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlci5zdGFydCgpO1xyXG5cclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPSBmdW5jdGlvbihlKSB7XHJcblx0XHRcdHRoaXMuY2h1bmtzLnB1c2goZS5kYXRhKTtcclxuXHRcdH0uYmluZCggdGhpcyApO1xyXG5cclxuXHR9XHJcblx0dGhpcy5zdGVwKCk7XHJcblxyXG59XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdHRoaXMubWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbiggZSApIHtcclxuXHRcdHZhciBibG9iID0gbmV3IEJsb2IoIHRoaXMuY2h1bmtzLCB7ICd0eXBlJyA6ICd2aWRlby93ZWJtJyB9KTtcclxuXHRcdHRoaXMuY2h1bmtzID0gW107XHJcblx0XHRjYWxsYmFjayggYmxvYiApO1xyXG5cclxuXHR9LmJpbmQoIHRoaXMgKTtcclxuXHJcblx0dGhpcy5tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuXHJcbn1cclxuXHJcbi8qZnVuY3Rpb24gQ0NHSUZFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gc2V0dGluZ3MucXVhbGl0eSB8fCA2O1xyXG5cdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHJcblx0dGhpcy5lbmNvZGVyID0gbmV3IEdJRkVuY29kZXIoKTtcclxuXHR0aGlzLmVuY29kZXIuc2V0UmVwZWF0KCAxICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0RGVsYXkoIHNldHRpbmdzLnN0ZXAgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRRdWFsaXR5KCA2ICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0VHJhbnNwYXJlbnQoIG51bGwgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRTaXplKCAxNTAsIDE1MCApO1xyXG5cclxuICBcdHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuICBcdHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCggJzJkJyApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyICk7XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zdGFydCgpO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmNhbnZhcy53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHR0aGlzLmNhbnZhcy5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdHRoaXMuY3R4LmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCB0aGlzLmN0eCApO1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc2V0U2l6ZSggY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0ICk7XHJcblx0dmFyIHJlYWRCdWZmZXIgPSBuZXcgVWludDhBcnJheShjYW52YXMud2lkdGggKiBjYW52YXMuaGVpZ2h0ICogNCk7XHJcblx0dmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApO1xyXG5cdGNvbnRleHQucmVhZFBpeGVscygwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQsIGNvbnRleHQuUkdCQSwgY29udGV4dC5VTlNJR05FRF9CWVRFLCByZWFkQnVmZmVyKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHJlYWRCdWZmZXIsIHRydWUgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuZmluaXNoKCk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdHZhciBiaW5hcnlfZ2lmID0gdGhpcy5lbmNvZGVyLnN0cmVhbSgpLmdldERhdGEoKTtcclxuXHJcblx0dmFyIGRhdGFfdXJsID0gJ2RhdGE6aW1hZ2UvZ2lmO2Jhc2U2NCwnK2VuY29kZTY0KGJpbmFyeV9naWYpO1xyXG5cdHdpbmRvdy5sb2NhdGlvbiA9IGRhdGFfdXJsO1xyXG5cdHJldHVybjtcclxuXHJcblx0dmFyIGJsb2IgPSBuZXcgQmxvYiggWyBiaW5hcnlfZ2lmIF0sIHsgdHlwZTogXCJvY3RldC9zdHJlYW1cIiB9ICk7XHJcblx0dmFyIHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKCBibG9iICk7XHJcblx0Y2FsbGJhY2soIHVybCApO1xyXG5cclxufSovXHJcblxyXG5mdW5jdGlvbiBDQ0dJRkVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gMzEgLSAoICggc2V0dGluZ3MucXVhbGl0eSAqIDMwIC8gMTAwICkgfHwgMTAgKTtcclxuXHRzZXR0aW5ncy53b3JrZXJzID0gc2V0dGluZ3Mud29ya2VycyB8fCA0O1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcuZ2lmJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAnaW1hZ2UvZ2lmJ1xyXG5cclxuICBcdHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuICBcdHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCggJzJkJyApO1xyXG4gIFx0dGhpcy5zaXplU2V0ID0gZmFsc2U7XHJcblxyXG4gIFx0dGhpcy5lbmNvZGVyID0gbmV3IEdJRih7XHJcblx0XHR3b3JrZXJzOiBzZXR0aW5ncy53b3JrZXJzLFxyXG5cdFx0cXVhbGl0eTogc2V0dGluZ3MucXVhbGl0eSxcclxuXHRcdHdvcmtlclNjcmlwdDogc2V0dGluZ3Mud29ya2Vyc1BhdGggKyAnZ2lmLndvcmtlci5qcydcclxuXHR9ICk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvZ3Jlc3MnLCBmdW5jdGlvbiggcHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgaWYgKCB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyggcHJvZ3Jlc3MgKVxyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCdmaW5pc2hlZCcsIGZ1bmN0aW9uKCBibG9iICkge1xyXG4gICAgICAgIHZhciBjYiA9IHRoaXMuY2FsbGJhY2s7XHJcbiAgICAgICAgaWYgKCBjYiApIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgY2IoIGJsb2IgKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRpZiggIXRoaXMuc2l6ZVNldCApIHtcclxuXHRcdHRoaXMuZW5jb2Rlci5zZXRPcHRpb24oICd3aWR0aCcsY2FudmFzLndpZHRoICk7XHJcblx0XHR0aGlzLmVuY29kZXIuc2V0T3B0aW9uKCAnaGVpZ2h0JyxjYW52YXMuaGVpZ2h0ICk7XHJcblx0XHR0aGlzLnNpemVTZXQgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0dGhpcy5jYW52YXMud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0dGhpcy5jYW52YXMuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHR0aGlzLmN0eC5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHRoaXMuY3R4LCB7IGNvcHk6IHRydWUsIGRlbGF5OiB0aGlzLnNldHRpbmdzLnN0ZXAgfSApO1xyXG5cdHRoaXMuc3RlcCgpO1xyXG5cclxuXHQvKnRoaXMuZW5jb2Rlci5zZXRTaXplKCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQgKTtcclxuXHR2YXIgcmVhZEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGNhbnZhcy53aWR0aCAqIGNhbnZhcy5oZWlnaHQgKiA0KTtcclxuXHR2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICk7XHJcblx0Y29udGV4dC5yZWFkUGl4ZWxzKDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCwgY29udGV4dC5SR0JBLCBjb250ZXh0LlVOU0lHTkVEX0JZVEUsIHJlYWRCdWZmZXIpO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggcmVhZEJ1ZmZlciwgdHJ1ZSApOyovXHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG5cclxuXHR0aGlzLmVuY29kZXIucmVuZGVyKCk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ2FwdHVyZSggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBfc2V0dGluZ3MgPSBzZXR0aW5ncyB8fCB7fSxcclxuXHRcdF9kYXRlID0gbmV3IERhdGUoKSxcclxuXHRcdF92ZXJib3NlLFxyXG5cdFx0X2Rpc3BsYXksXHJcblx0XHRfdGltZSxcclxuXHRcdF9zdGFydFRpbWUsXHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lLFxyXG5cdFx0X3BlcmZvcm1hbmNlU3RhcnRUaW1lLFxyXG5cdFx0X3N0ZXAsXHJcbiAgICAgICAgX2VuY29kZXIsXHJcblx0XHRfdGltZW91dHMgPSBbXSxcclxuXHRcdF9pbnRlcnZhbHMgPSBbXSxcclxuXHRcdF9mcmFtZUNvdW50ID0gMCxcclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID0gMCxcclxuXHRcdF9sYXN0RnJhbWUgPSBudWxsLFxyXG5cdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcyA9IFtdLFxyXG5cdFx0X2NhcHR1cmluZyA9IGZhbHNlLFxyXG4gICAgICAgIF9oYW5kbGVycyA9IHt9O1xyXG5cclxuXHRfc2V0dGluZ3MuZnJhbWVyYXRlID0gX3NldHRpbmdzLmZyYW1lcmF0ZSB8fCA2MDtcclxuXHRfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA9IDIgKiAoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzIHx8IDEgKTtcclxuXHRfdmVyYm9zZSA9IF9zZXR0aW5ncy52ZXJib3NlIHx8IGZhbHNlO1xyXG5cdF9kaXNwbGF5ID0gX3NldHRpbmdzLmRpc3BsYXkgfHwgZmFsc2U7XHJcblx0X3NldHRpbmdzLnN0ZXAgPSAxMDAwLjAgLyBfc2V0dGluZ3MuZnJhbWVyYXRlIDtcclxuXHRfc2V0dGluZ3MudGltZUxpbWl0ID0gX3NldHRpbmdzLnRpbWVMaW1pdCB8fCAwO1xyXG5cdF9zZXR0aW5ncy5mcmFtZUxpbWl0ID0gX3NldHRpbmdzLmZyYW1lTGltaXQgfHwgMDtcclxuXHRfc2V0dGluZ3Muc3RhcnRUaW1lID0gX3NldHRpbmdzLnN0YXJ0VGltZSB8fCAwO1xyXG5cclxuXHR2YXIgX3RpbWVEaXNwbGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRfdGltZURpc3BsYXkuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5sZWZ0ID0gX3RpbWVEaXNwbGF5LnN0eWxlLnRvcCA9IDBcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2JsYWNrJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmZvbnRTaXplID0gJzExcHgnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnBhZGRpbmcgPSAnNXB4J1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5jb2xvciA9ICdyZWQnO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS56SW5kZXggPSAxMDAwMDBcclxuXHRpZiggX3NldHRpbmdzLmRpc3BsYXkgKSBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBfdGltZURpc3BsYXkgKTtcclxuXHJcblx0dmFyIGNhbnZhc01vdGlvbkJsdXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG5cdHZhciBjdHhNb3Rpb25CbHVyID0gY2FudmFzTW90aW9uQmx1ci5nZXRDb250ZXh0KCAnMmQnICk7XHJcblx0dmFyIGJ1ZmZlck1vdGlvbkJsdXI7XHJcblx0dmFyIGltYWdlRGF0YTtcclxuXHJcblx0X2xvZyggJ1N0ZXAgaXMgc2V0IHRvICcgKyBfc2V0dGluZ3Muc3RlcCArICdtcycgKTtcclxuXHJcbiAgICB2YXIgX2VuY29kZXJzID0ge1xyXG5cdFx0Z2lmOiBDQ0dJRkVuY29kZXIsXHJcblx0XHR3ZWJtOiBDQ1dlYk1FbmNvZGVyLFxyXG5cdFx0ZmZtcGVnc2VydmVyOiBDQ0ZGTXBlZ1NlcnZlckVuY29kZXIsXHJcblx0XHRwbmc6IENDUE5HRW5jb2RlcixcclxuXHRcdGpwZzogQ0NKUEVHRW5jb2RlcixcclxuXHRcdCd3ZWJtLW1lZGlhcmVjb3JkZXInOiBDQ1N0cmVhbUVuY29kZXJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIGN0b3IgPSBfZW5jb2RlcnNbIF9zZXR0aW5ncy5mb3JtYXQgXTtcclxuICAgIGlmICggIWN0b3IgKSB7XHJcblx0XHR0aHJvdyBcIkVycm9yOiBJbmNvcnJlY3Qgb3IgbWlzc2luZyBmb3JtYXQ6IFZhbGlkIGZvcm1hdHMgYXJlIFwiICsgT2JqZWN0LmtleXMoX2VuY29kZXJzKS5qb2luKFwiLCBcIik7XHJcbiAgICB9XHJcbiAgICBfZW5jb2RlciA9IG5ldyBjdG9yKCBfc2V0dGluZ3MgKTtcclxuICAgIF9lbmNvZGVyLnN0ZXAgPSBfc3RlcFxyXG5cclxuXHRfZW5jb2Rlci5vbigncHJvY2VzcycsIF9wcm9jZXNzKTtcclxuICAgIF9lbmNvZGVyLm9uKCdwcm9ncmVzcycsIF9wcm9ncmVzcyk7XHJcblxyXG4gICAgaWYgKFwicGVyZm9ybWFuY2VcIiBpbiB3aW5kb3cgPT0gZmFsc2UpIHtcclxuICAgIFx0d2luZG93LnBlcmZvcm1hbmNlID0ge307XHJcbiAgICB9XHJcblxyXG5cdERhdGUubm93ID0gKERhdGUubm93IHx8IGZ1bmN0aW9uICgpIHsgIC8vIHRoYW5rcyBJRThcclxuXHRcdHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuXHR9KTtcclxuXHJcblx0aWYgKFwibm93XCIgaW4gd2luZG93LnBlcmZvcm1hbmNlID09IGZhbHNlKXtcclxuXHJcblx0XHR2YXIgbm93T2Zmc2V0ID0gRGF0ZS5ub3coKTtcclxuXHJcblx0XHRpZiAocGVyZm9ybWFuY2UudGltaW5nICYmIHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQpe1xyXG5cdFx0XHRub3dPZmZzZXQgPSBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0XHJcblx0XHR9XHJcblxyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uIG5vdygpe1xyXG5cdFx0XHRyZXR1cm4gRGF0ZS5ub3coKSAtIG5vd09mZnNldDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciBfb2xkU2V0VGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0LFxyXG5cdFx0X29sZFNldEludGVydmFsID0gd2luZG93LnNldEludGVydmFsLFxyXG5cdCAgICBcdF9vbGRDbGVhckludGVydmFsID0gd2luZG93LmNsZWFySW50ZXJ2YWwsXHJcblx0XHRfb2xkQ2xlYXJUaW1lb3V0ID0gd2luZG93LmNsZWFyVGltZW91dCxcclxuXHRcdF9vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxyXG5cdFx0X29sZE5vdyA9IHdpbmRvdy5EYXRlLm5vdyxcclxuXHRcdF9vbGRQZXJmb3JtYW5jZU5vdyA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3csXHJcblx0XHRfb2xkR2V0VGltZSA9IHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lO1xyXG5cdC8vIERhdGUucHJvdG90eXBlLl9vbGRHZXRUaW1lID0gRGF0ZS5wcm90b3R5cGUuZ2V0VGltZTtcclxuXHJcblx0dmFyIG1lZGlhID0gW107XHJcblxyXG5cdGZ1bmN0aW9uIF9pbml0KCkge1xyXG5cclxuXHRcdF9sb2coICdDYXB0dXJlciBzdGFydCcgKTtcclxuXHJcblx0XHRfc3RhcnRUaW1lID0gd2luZG93LkRhdGUubm93KCk7XHJcblx0XHRfdGltZSA9IF9zdGFydFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cdFx0X3BlcmZvcm1hbmNlU3RhcnRUaW1lID0gd2luZG93LnBlcmZvcm1hbmNlLm5vdygpO1xyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSA9IF9wZXJmb3JtYW5jZVN0YXJ0VGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblxyXG5cdFx0d2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWUgPSBmdW5jdGlvbigpe1xyXG5cdFx0XHRyZXR1cm4gX3RpbWU7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LkRhdGUubm93ID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdHJldHVybiBfdGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0d2luZG93LnNldFRpbWVvdXQgPSBmdW5jdGlvbiggY2FsbGJhY2ssIHRpbWUgKSB7XHJcblx0XHRcdHZhciB0ID0ge1xyXG5cdFx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0XHR0aW1lOiB0aW1lLFxyXG5cdFx0XHRcdHRyaWdnZXJUaW1lOiBfdGltZSArIHRpbWVcclxuXHRcdFx0fTtcclxuXHRcdFx0X3RpbWVvdXRzLnB1c2goIHQgKTtcclxuXHRcdFx0X2xvZyggJ1RpbWVvdXQgc2V0IHRvICcgKyB0LnRpbWUgKTtcclxuICAgICAgICAgICAgcmV0dXJuIHQ7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCA9IGZ1bmN0aW9uKCBpZCApIHtcclxuXHRcdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfdGltZW91dHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdFx0aWYoIF90aW1lb3V0c1sgaiBdID09IGlkICkge1xyXG5cdFx0XHRcdFx0X3RpbWVvdXRzLnNwbGljZSggaiwgMSApO1xyXG5cdFx0XHRcdFx0X2xvZyggJ1RpbWVvdXQgY2xlYXJlZCcgKTtcclxuXHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uKCBjYWxsYmFjaywgdGltZSApIHtcclxuXHRcdFx0dmFyIHQgPSB7XHJcblx0XHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxyXG5cdFx0XHRcdHRpbWU6IHRpbWUsXHJcblx0XHRcdFx0dHJpZ2dlclRpbWU6IF90aW1lICsgdGltZVxyXG5cdFx0XHR9O1xyXG5cdFx0XHRfaW50ZXJ2YWxzLnB1c2goIHQgKTtcclxuXHRcdFx0X2xvZyggJ0ludGVydmFsIHNldCB0byAnICsgdC50aW1lICk7XHJcblx0XHRcdHJldHVybiB0O1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5jbGVhckludGVydmFsID0gZnVuY3Rpb24oIGlkICkge1xyXG5cdFx0XHRfbG9nKCAnY2xlYXIgSW50ZXJ2YWwnICk7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblx0XHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MucHVzaCggY2FsbGJhY2sgKTtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0cmV0dXJuIF9wZXJmb3JtYW5jZVRpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdGZ1bmN0aW9uIGhvb2tDdXJyZW50VGltZSgpIHtcclxuXHRcdFx0aWYoICF0aGlzLl9ob29rZWQgKSB7XHJcblx0XHRcdFx0dGhpcy5faG9va2VkID0gdHJ1ZTtcclxuXHRcdFx0XHR0aGlzLl9ob29rZWRUaW1lID0gdGhpcy5jdXJyZW50VGltZSB8fCAwO1xyXG5cdFx0XHRcdHRoaXMucGF1c2UoKTtcclxuXHRcdFx0XHRtZWRpYS5wdXNoKCB0aGlzICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHRoaXMuX2hvb2tlZFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIEhUTUxWaWRlb0VsZW1lbnQucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7IGdldDogaG9va0N1cnJlbnRUaW1lIH0gKVxyXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIEhUTUxBdWRpb0VsZW1lbnQucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7IGdldDogaG9va0N1cnJlbnRUaW1lIH0gKVxyXG5cdFx0fSBjYXRjaCAoZXJyKSB7XHJcblx0XHRcdF9sb2coZXJyKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RhcnQoKSB7XHJcblx0XHRfaW5pdCgpO1xyXG5cdFx0X2VuY29kZXIuc3RhcnQoKTtcclxuXHRcdF9jYXB0dXJpbmcgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0b3AoKSB7XHJcblx0XHRfY2FwdHVyaW5nID0gZmFsc2U7XHJcblx0XHRfZW5jb2Rlci5zdG9wKCk7XHJcblx0XHRfZGVzdHJveSgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NhbGwoIGZuLCBwICkge1xyXG5cdFx0X29sZFNldFRpbWVvdXQoIGZuLCAwLCBwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RlcCgpIHtcclxuXHRcdC8vX29sZFJlcXVlc3RBbmltYXRpb25GcmFtZSggX3Byb2Nlc3MgKTtcclxuXHRcdF9jYWxsKCBfcHJvY2VzcyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2Rlc3Ryb3koKSB7XHJcblx0XHRfbG9nKCAnQ2FwdHVyZXIgc3RvcCcgKTtcclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0ID0gX29sZFNldFRpbWVvdXQ7XHJcblx0XHR3aW5kb3cuc2V0SW50ZXJ2YWwgPSBfb2xkU2V0SW50ZXJ2YWw7XHJcblx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCA9IF9vbGRDbGVhckludGVydmFsO1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCA9IF9vbGRDbGVhclRpbWVvdXQ7XHJcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gX29sZFJlcXVlc3RBbmltYXRpb25GcmFtZTtcclxuXHRcdHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lID0gX29sZEdldFRpbWU7XHJcblx0XHR3aW5kb3cuRGF0ZS5ub3cgPSBfb2xkTm93O1xyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IF9vbGRQZXJmb3JtYW5jZU5vdztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF91cGRhdGVUaW1lKCkge1xyXG5cdFx0dmFyIHNlY29uZHMgPSBfZnJhbWVDb3VudCAvIF9zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0XHRpZiggKCBfc2V0dGluZ3MuZnJhbWVMaW1pdCAmJiBfZnJhbWVDb3VudCA+PSBfc2V0dGluZ3MuZnJhbWVMaW1pdCApIHx8ICggX3NldHRpbmdzLnRpbWVMaW1pdCAmJiBzZWNvbmRzID49IF9zZXR0aW5ncy50aW1lTGltaXQgKSApIHtcclxuXHRcdFx0X3N0b3AoKTtcclxuXHRcdFx0X3NhdmUoKTtcclxuXHRcdH1cclxuXHRcdHZhciBkID0gbmV3IERhdGUoIG51bGwgKTtcclxuXHRcdGQuc2V0U2Vjb25kcyggc2Vjb25kcyApO1xyXG5cdFx0aWYoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID4gMiApIHtcclxuXHRcdFx0X3RpbWVEaXNwbGF5LnRleHRDb250ZW50ID0gJ0NDYXB0dXJlICcgKyBfc2V0dGluZ3MuZm9ybWF0ICsgJyB8ICcgKyBfZnJhbWVDb3VudCArICcgZnJhbWVzICgnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKyAnIGludGVyKSB8ICcgKyAgZC50b0lTT1N0cmluZygpLnN1YnN0ciggMTEsIDggKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdF90aW1lRGlzcGxheS50ZXh0Q29udGVudCA9ICdDQ2FwdHVyZSAnICsgX3NldHRpbmdzLmZvcm1hdCArICcgfCAnICsgX2ZyYW1lQ291bnQgKyAnIGZyYW1lcyB8ICcgKyAgZC50b0lTT1N0cmluZygpLnN1YnN0ciggMTEsIDggKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jaGVja0ZyYW1lKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0aWYoIGNhbnZhc01vdGlvbkJsdXIud2lkdGggIT09IGNhbnZhcy53aWR0aCB8fCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCAhPT0gY2FudmFzLmhlaWdodCApIHtcclxuXHRcdFx0Y2FudmFzTW90aW9uQmx1ci53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHRcdFx0Y2FudmFzTW90aW9uQmx1ci5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyID0gbmV3IFVpbnQxNkFycmF5KCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCAqIGNhbnZhc01vdGlvbkJsdXIud2lkdGggKiA0ICk7XHJcblx0XHRcdGN0eE1vdGlvbkJsdXIuZmlsbFN0eWxlID0gJyMwJ1xyXG5cdFx0XHRjdHhNb3Rpb25CbHVyLmZpbGxSZWN0KCAwLCAwLCBjYW52YXNNb3Rpb25CbHVyLndpZHRoLCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCApO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9ibGVuZEZyYW1lKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0Ly9fbG9nKCAnSW50ZXJtZWRpYXRlIEZyYW1lOiAnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKTtcclxuXHJcblx0XHRjdHhNb3Rpb25CbHVyLmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblx0XHRpbWFnZURhdGEgPSBjdHhNb3Rpb25CbHVyLmdldEltYWdlRGF0YSggMCwgMCwgY2FudmFzTW90aW9uQmx1ci53aWR0aCwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogXTtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSArPSBpbWFnZURhdGEuZGF0YVsgaiArIDEgXTtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSArPSBpbWFnZURhdGEuZGF0YVsgaiArIDIgXTtcclxuXHRcdH1cclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50Kys7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3NhdmVGcmFtZSgpe1xyXG5cclxuXHRcdHZhciBkYXRhID0gaW1hZ2VEYXRhLmRhdGE7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0ZGF0YVsgaiBdID0gYnVmZmVyTW90aW9uQmx1clsgaiBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0XHRkYXRhWyBqICsgMSBdID0gYnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdFx0ZGF0YVsgaiArIDIgXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHR9XHJcblx0XHRjdHhNb3Rpb25CbHVyLnB1dEltYWdlRGF0YSggaW1hZ2VEYXRhLCAwLCAwICk7XHJcblx0XHRfZW5jb2Rlci5hZGQoIGNhbnZhc01vdGlvbkJsdXIgKTtcclxuXHRcdF9mcmFtZUNvdW50Kys7XHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA9IDA7XHJcblx0XHRfbG9nKCAnRnVsbCBNQiBGcmFtZSEgJyArIF9mcmFtZUNvdW50ICsgJyAnICsgIF90aW1lICk7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiBdID0gMDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSA9IDA7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gPSAwO1xyXG5cdFx0fVxyXG5cdFx0Z2MoKTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2FwdHVyZSggY2FudmFzICkge1xyXG5cclxuXHRcdGlmKCBfY2FwdHVyaW5nICkge1xyXG5cclxuXHRcdFx0aWYoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID4gMiApIHtcclxuXHJcblx0XHRcdFx0X2NoZWNrRnJhbWUoIGNhbnZhcyApO1xyXG5cdFx0XHRcdF9ibGVuZEZyYW1lKCBjYW52YXMgKTtcclxuXHJcblx0XHRcdFx0aWYoIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID49IC41ICogX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgKSB7XHJcblx0XHRcdFx0XHRfc2F2ZUZyYW1lKCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdF9zdGVwKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRfZW5jb2Rlci5hZGQoIGNhbnZhcyApO1xyXG5cdFx0XHRcdF9mcmFtZUNvdW50Kys7XHJcblx0XHRcdFx0X2xvZyggJ0Z1bGwgRnJhbWUhICcgKyBfZnJhbWVDb3VudCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9wcm9jZXNzKCkge1xyXG5cclxuXHRcdHZhciBzdGVwID0gMTAwMCAvIF9zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0XHR2YXIgZHQgPSAoIF9mcmFtZUNvdW50ICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyApICogc3RlcDtcclxuXHJcblx0XHRfdGltZSA9IF9zdGFydFRpbWUgKyBkdDtcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUgPSBfcGVyZm9ybWFuY2VTdGFydFRpbWUgKyBkdDtcclxuXHJcblx0XHRtZWRpYS5mb3JFYWNoKCBmdW5jdGlvbiggdiApIHtcclxuXHRcdFx0di5faG9va2VkVGltZSA9IGR0IC8gMTAwMDtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRfdXBkYXRlVGltZSgpO1xyXG5cdFx0X2xvZyggJ0ZyYW1lOiAnICsgX2ZyYW1lQ291bnQgKyAnICcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCApO1xyXG5cclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgX3RpbWVvdXRzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRpZiggX3RpbWUgPj0gX3RpbWVvdXRzWyBqIF0udHJpZ2dlclRpbWUgKSB7XHJcblx0XHRcdFx0X2NhbGwoIF90aW1lb3V0c1sgaiBdLmNhbGxiYWNrIClcclxuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCAndGltZW91dCEnICk7XHJcblx0XHRcdFx0X3RpbWVvdXRzLnNwbGljZSggaiwgMSApO1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfaW50ZXJ2YWxzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRpZiggX3RpbWUgPj0gX2ludGVydmFsc1sgaiBdLnRyaWdnZXJUaW1lICkge1xyXG5cdFx0XHRcdF9jYWxsKCBfaW50ZXJ2YWxzWyBqIF0uY2FsbGJhY2sgKTtcclxuXHRcdFx0XHRfaW50ZXJ2YWxzWyBqIF0udHJpZ2dlclRpbWUgKz0gX2ludGVydmFsc1sgaiBdLnRpbWU7XHJcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggJ2ludGVydmFsIScgKTtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MuZm9yRWFjaCggZnVuY3Rpb24oIGNiICkge1xyXG4gICAgIFx0XHRfY2FsbCggY2IsIF90aW1lIC0gZ19zdGFydFRpbWUgKTtcclxuICAgICAgICB9ICk7XHJcbiAgICAgICAgX3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcyA9IFtdO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zYXZlKCBjYWxsYmFjayApIHtcclxuXHJcblx0XHRpZiggIWNhbGxiYWNrICkge1xyXG5cdFx0XHRjYWxsYmFjayA9IGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0XHRcdGRvd25sb2FkKCBibG9iLCBfZW5jb2Rlci5maWxlbmFtZSArIF9lbmNvZGVyLmV4dGVuc2lvbiwgX2VuY29kZXIubWltZVR5cGUgKTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdF9lbmNvZGVyLnNhdmUoIGNhbGxiYWNrICk7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2xvZyggbWVzc2FnZSApIHtcclxuXHRcdGlmKCBfdmVyYm9zZSApIGNvbnNvbGUubG9nKCBtZXNzYWdlICk7XHJcblx0fVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbiggZXZlbnQsIGhhbmRsZXIgKSB7XHJcblxyXG4gICAgICAgIF9oYW5kbGVyc1tldmVudF0gPSBoYW5kbGVyO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZW1pdCggZXZlbnQgKSB7XHJcblxyXG4gICAgICAgIHZhciBoYW5kbGVyID0gX2hhbmRsZXJzW2V2ZW50XTtcclxuICAgICAgICBpZiAoIGhhbmRsZXIgKSB7XHJcblxyXG4gICAgICAgICAgICBoYW5kbGVyLmFwcGx5KCBudWxsLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggYXJndW1lbnRzLCAxICkgKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfcHJvZ3Jlc3MoIHByb2dyZXNzICkge1xyXG5cclxuICAgICAgICBfZW1pdCggJ3Byb2dyZXNzJywgcHJvZ3Jlc3MgKTtcclxuXHJcbiAgICB9XHJcblxyXG5cdHJldHVybiB7XHJcblx0XHRzdGFydDogX3N0YXJ0LFxyXG5cdFx0Y2FwdHVyZTogX2NhcHR1cmUsXHJcblx0XHRzdG9wOiBfc3RvcCxcclxuXHRcdHNhdmU6IF9zYXZlLFxyXG4gICAgICAgIG9uOiBfb25cclxuXHR9XHJcbn1cclxuXHJcbihmcmVlV2luZG93IHx8IGZyZWVTZWxmIHx8IHt9KS5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG5cclxuICAvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzIGxpa2Ugci5qcyBjaGVjayBmb3IgY29uZGl0aW9uIHBhdHRlcm5zIGxpa2UgdGhlIGZvbGxvd2luZzpcclxuICBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcclxuICAgIC8vIERlZmluZSBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlIHNvLCB0aHJvdWdoIHBhdGggbWFwcGluZywgaXQgY2FuIGJlXHJcbiAgICAvLyByZWZlcmVuY2VkIGFzIHRoZSBcInVuZGVyc2NvcmVcIiBtb2R1bGUuXHJcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XHJcbiAgICBcdHJldHVybiBDQ2FwdHVyZTtcclxuICAgIH0pO1xyXG59XHJcbiAgLy8gQ2hlY2sgZm9yIGBleHBvcnRzYCBhZnRlciBgZGVmaW5lYCBpbiBjYXNlIGEgYnVpbGQgb3B0aW1pemVyIGFkZHMgYW4gYGV4cG9ydHNgIG9iamVjdC5cclxuICBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlKSB7XHJcbiAgICAvLyBFeHBvcnQgZm9yIE5vZGUuanMuXHJcbiAgICBpZiAobW9kdWxlRXhwb3J0cykge1xyXG4gICAgXHQoZnJlZU1vZHVsZS5leHBvcnRzID0gQ0NhcHR1cmUpLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbiAgICB9XHJcbiAgICAvLyBFeHBvcnQgZm9yIENvbW1vbkpTIHN1cHBvcnQuXHJcbiAgICBmcmVlRXhwb3J0cy5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG59XHJcbmVsc2Uge1xyXG4gICAgLy8gRXhwb3J0IHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxyXG4gICAgcm9vdC5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG59XHJcblxyXG59KCkpO1xyXG4iLCIvKipcbiAqIEBhdXRob3IgYWx0ZXJlZHEgLyBodHRwOi8vYWx0ZXJlZHF1YWxpYS5jb20vXG4gKiBAYXV0aG9yIG1yLmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbS9cbiAqL1xuXG52YXIgRGV0ZWN0b3IgPSB7XG5cblx0Y2FudmFzOiAhISB3aW5kb3cuQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuXHR3ZWJnbDogKCBmdW5jdGlvbiAoKSB7XG5cblx0XHR0cnkge1xuXG5cdFx0XHR2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTsgcmV0dXJuICEhICggd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCAmJiAoIGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICkgfHwgY2FudmFzLmdldENvbnRleHQoICdleHBlcmltZW50YWwtd2ViZ2wnICkgKSApO1xuXG5cdFx0fSBjYXRjaCAoIGUgKSB7XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblxuXHRcdH1cblxuXHR9ICkoKSxcblx0d29ya2VyczogISEgd2luZG93Lldvcmtlcixcblx0ZmlsZWFwaTogd2luZG93LkZpbGUgJiYgd2luZG93LkZpbGVSZWFkZXIgJiYgd2luZG93LkZpbGVMaXN0ICYmIHdpbmRvdy5CbG9iLFxuXG5cdGdldFdlYkdMRXJyb3JNZXNzYWdlOiBmdW5jdGlvbiAoKSB7XG5cblx0XHR2YXIgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0ZWxlbWVudC5pZCA9ICd3ZWJnbC1lcnJvci1tZXNzYWdlJztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRTaXplID0gJzEzcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9ICdub3JtYWwnO1xuXHRcdGVsZW1lbnQuc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XG5cdFx0ZWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kID0gJyNmZmYnO1xuXHRcdGVsZW1lbnQuc3R5bGUuY29sb3IgPSAnIzAwMCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5wYWRkaW5nID0gJzEuNWVtJztcblx0XHRlbGVtZW50LnN0eWxlLnpJbmRleCA9ICc5OTknO1xuXHRcdGVsZW1lbnQuc3R5bGUud2lkdGggPSAnNDAwcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUubWFyZ2luID0gJzVlbSBhdXRvIDAnO1xuXG5cdFx0aWYgKCAhIHRoaXMud2ViZ2wgKSB7XG5cblx0XHRcdGVsZW1lbnQuaW5uZXJIVE1MID0gd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCA/IFtcblx0XHRcdFx0J1lvdXIgZ3JhcGhpY3MgY2FyZCBkb2VzIG5vdCBzZWVtIHRvIHN1cHBvcnQgPGEgaHJlZj1cImh0dHA6Ly9raHJvbm9zLm9yZy93ZWJnbC93aWtpL0dldHRpbmdfYV9XZWJHTF9JbXBsZW1lbnRhdGlvblwiIHN0eWxlPVwiY29sb3I6IzAwMFwiPldlYkdMPC9hPi48YnIgLz4nLFxuXHRcdFx0XHQnRmluZCBvdXQgaG93IHRvIGdldCBpdCA8YSBocmVmPVwiaHR0cDovL2dldC53ZWJnbC5vcmcvXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+aGVyZTwvYT4uJ1xuXHRcdFx0XS5qb2luKCAnXFxuJyApIDogW1xuXHRcdFx0XHQnWW91ciBicm93c2VyIGRvZXMgbm90IHNlZW0gdG8gc3VwcG9ydCA8YSBocmVmPVwiaHR0cDovL2tocm9ub3Mub3JnL3dlYmdsL3dpa2kvR2V0dGluZ19hX1dlYkdMX0ltcGxlbWVudGF0aW9uXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+V2ViR0w8L2E+Ljxici8+Jyxcblx0XHRcdFx0J0ZpbmQgb3V0IGhvdyB0byBnZXQgaXQgPGEgaHJlZj1cImh0dHA6Ly9nZXQud2ViZ2wub3JnL1wiIHN0eWxlPVwiY29sb3I6IzAwMFwiPmhlcmU8L2E+Lidcblx0XHRcdF0uam9pbiggJ1xcbicgKTtcblxuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50O1xuXG5cdH0sXG5cblx0YWRkR2V0V2ViR0xNZXNzYWdlOiBmdW5jdGlvbiAoIHBhcmFtZXRlcnMgKSB7XG5cblx0XHR2YXIgcGFyZW50LCBpZCwgZWxlbWVudDtcblxuXHRcdHBhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzIHx8IHt9O1xuXG5cdFx0cGFyZW50ID0gcGFyYW1ldGVycy5wYXJlbnQgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMucGFyZW50IDogZG9jdW1lbnQuYm9keTtcblx0XHRpZCA9IHBhcmFtZXRlcnMuaWQgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMuaWQgOiAnb2xkaWUnO1xuXG5cdFx0ZWxlbWVudCA9IERldGVjdG9yLmdldFdlYkdMRXJyb3JNZXNzYWdlKCk7XG5cdFx0ZWxlbWVudC5pZCA9IGlkO1xuXG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKCBlbGVtZW50ICk7XG5cblx0fVxuXG59O1xuXG4vL0VTNiBleHBvcnRcblxuZXhwb3J0IHsgRGV0ZWN0b3IgfTtcbiIsIi8vVGhpcyBsaWJyYXJ5IGlzIGRlc2lnbmVkIHRvIGhlbHAgc3RhcnQgdGhyZWUuanMgZWFzaWx5LCBjcmVhdGluZyB0aGUgcmVuZGVyIGxvb3AgYW5kIGNhbnZhcyBhdXRvbWFnaWNhbGx5LlxuLy9SZWFsbHkgaXQgc2hvdWxkIGJlIHNwdW4gb2ZmIGludG8gaXRzIG93biB0aGluZyBpbnN0ZWFkIG9mIGJlaW5nIHBhcnQgb2YgZXhwbGFuYXJpYS5cblxuLy9hbHNvLCBjaGFuZ2UgVGhyZWVhc3lfRW52aXJvbm1lbnQgdG8gVGhyZWVhc3lfUmVjb3JkZXIgdG8gZG93bmxvYWQgaGlnaC1xdWFsaXR5IGZyYW1lcyBvZiBhbiBhbmltYXRpb25cblxuaW1wb3J0IENDYXB0dXJlIGZyb20gJ2NjYXB0dXJlLmpzJztcbmltcG9ydCB7IERldGVjdG9yIH0gZnJvbSAnLi4vbGliL1dlYkdMX0RldGVjdG9yLmpzJztcbmltcG9ydCB7IHNldFRocmVlRW52aXJvbm1lbnQsIGdldFRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5mdW5jdGlvbiBUaHJlZWFzeUVudmlyb25tZW50KGNhbnZhc0VsZW0gPSBudWxsKXtcblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gMDtcbiAgICB0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyA9IChjYW52YXNFbGVtID09PSBudWxsKTtcblxuXHRpZighRGV0ZWN0b3Iud2ViZ2wpRGV0ZWN0b3IuYWRkR2V0V2ViR0xNZXNzYWdlKCk7XG5cbiAgICAvL2ZvdiwgYXNwZWN0LCBuZWFyLCBmYXJcblx0dGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoIDcwLCB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgMC4xLCAxMDAwMDAwMCApO1xuXHQvL3RoaXMuY2FtZXJhID0gbmV3IFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYSggNzAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDEwICk7XG5cblx0dGhpcy5jYW1lcmEucG9zaXRpb24uc2V0KDAsIDAsIDEwKTtcblx0dGhpcy5jYW1lcmEubG9va0F0KG5ldyBUSFJFRS5WZWN0b3IzKDAsMCwwKSk7XG5cblxuXHQvL2NyZWF0ZSBjYW1lcmEsIHNjZW5lLCB0aW1lciwgcmVuZGVyZXIgb2JqZWN0c1xuXHQvL2NyYWV0ZSByZW5kZXIgb2JqZWN0XG5cblxuXHRcblx0dGhpcy5zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xuXHR0aGlzLnNjZW5lLmFkZCh0aGlzLmNhbWVyYSk7XG5cblx0Ly9yZW5kZXJlclxuXHRsZXQgcmVuZGVyZXJPcHRpb25zID0geyBhbnRpYWxpYXM6IHRydWV9O1xuXG4gICAgaWYoIXRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzKXtcbiAgICAgICAgcmVuZGVyZXJPcHRpb25zLmNhbnZhcyA9IGNhbnZhc0VsZW07XG4gICAgfVxuXG5cdHRoaXMucmVuZGVyZXIgPSBuZXcgVEhSRUUuV2ViR0xSZW5kZXJlciggcmVuZGVyZXJPcHRpb25zICk7XG5cdHRoaXMucmVuZGVyZXIuc2V0UGl4ZWxSYXRpbyggd2luZG93LmRldmljZVBpeGVsUmF0aW8gKTtcblx0dGhpcy5yZW5kZXJlci5zZXRDbGVhckNvbG9yKG5ldyBUSFJFRS5Db2xvcigweEZGRkZGRiksIDEuMCk7XG5cblxuICAgIHRoaXMucmVzaXplQ2FudmFzSWZOZWNlc3NhcnkoKTsgLy9yZXNpemUgY2FudmFzIHRvIHdpbmRvdyBzaXplIGFuZCBzZXQgYXNwZWN0IHJhdGlvXG5cdC8qXG5cdHRoaXMucmVuZGVyZXIuZ2FtbWFJbnB1dCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIuZ2FtbWFPdXRwdXQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLnNoYWRvd01hcC5lbmFibGVkID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci52ci5lbmFibGVkID0gdHJ1ZTtcblx0Ki9cblxuXHR0aGlzLnRpbWVTY2FsZSA9IDE7XG5cdHRoaXMuZWxhcHNlZFRpbWUgPSAwO1xuXHR0aGlzLnRydWVFbGFwc2VkVGltZSA9IDA7XG5cbiAgICBpZih0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyl7XG5cdCAgICB0aGlzLmNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdCAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCggdGhpcy5yZW5kZXJlci5kb21FbGVtZW50ICk7XG4gICAgfVxuXG5cdHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vkb3duJywgdGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNldXAnLCB0aGlzLm9uTW91c2VVcC5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoc3RhcnQnLCB0aGlzLm9uTW91c2VEb3duLmJpbmQodGhpcyksIGZhbHNlICk7XG5cdHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAndG91Y2hlbmQnLCB0aGlzLm9uTW91c2VVcC5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXG5cdC8qXG5cdC8vcmVuZGVyZXIudnIuZW5hYmxlZCA9IHRydWU7IFxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3ZyZGlzcGxheXBvaW50ZXJyZXN0cmljdGVkJywgb25Qb2ludGVyUmVzdHJpY3RlZCwgZmFsc2UgKTtcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd2cmRpc3BsYXlwb2ludGVydW5yZXN0cmljdGVkJywgb25Qb2ludGVyVW5yZXN0cmljdGVkLCBmYWxzZSApO1xuXHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBXRUJWUi5jcmVhdGVCdXR0b24oIHJlbmRlcmVyICkgKTtcblx0Ki9cblxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIHRoaXMub25QYWdlTG9hZC5iaW5kKHRoaXMpLCBmYWxzZSk7XG5cblx0dGhpcy5jbG9jayA9IG5ldyBUSFJFRS5DbG9jaygpO1xuXG5cdHRoaXMuSVNfUkVDT1JESU5HID0gZmFsc2U7IC8vIHF1ZXJ5YWJsZSBpZiBvbmUgd2FudHMgdG8gZG8gdGhpbmdzIGxpa2UgYmVlZiB1cCBwYXJ0aWNsZSBjb3VudHMgZm9yIHJlbmRlclxuXG4gICAgaWYoIXRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzICYmIGNhbnZhc0VsZW0ub2Zmc2V0V2lkdGgpe1xuICAgICAgICAvL0lmIHRoZSBjYW52YXNFbGVtZW50IGlzIGFscmVhZHkgbG9hZGVkLCB0aGVuIHRoZSAnbG9hZCcgZXZlbnQgaGFzIGFscmVhZHkgZmlyZWQuIFdlIG5lZWQgdG8gdHJpZ2dlciBpdCBvdXJzZWx2ZXMuXG4gICAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5vblBhZ2VMb2FkLmJpbmQodGhpcykpO1xuICAgIH1cbn1cblxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25QYWdlTG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRjb25zb2xlLmxvZyhcIlRocmVlYXN5X1NldHVwIGxvYWRlZCFcIik7XG5cdGlmKHRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzKXtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCB0aGlzLmNvbnRhaW5lciApO1xuXHR9XG5cblx0dGhpcy5zdGFydCgpO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe1xuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSBwZXJmb3JtYW5jZS5ub3coKTtcblx0dGhpcy5jbG9jay5zdGFydCgpO1xuXHR0aGlzLnJlbmRlcih0aGlzLnByZXZfdGltZXN0ZXApO1xufVxuXG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbk1vdXNlRG93biA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmlzTW91c2VEb3duID0gdHJ1ZTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uTW91c2VVcD0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuaXNNb3VzZURvd24gPSBmYWxzZTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUG9pbnRlclJlc3RyaWN0ZWQ9IGZ1bmN0aW9uKCkge1xuXHR2YXIgcG9pbnRlckxvY2tFbGVtZW50ID0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50O1xuXHRpZiAoIHBvaW50ZXJMb2NrRWxlbWVudCAmJiB0eXBlb2YocG9pbnRlckxvY2tFbGVtZW50LnJlcXVlc3RQb2ludGVyTG9jaykgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0cG9pbnRlckxvY2tFbGVtZW50LnJlcXVlc3RQb2ludGVyTG9jaygpO1xuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vblBvaW50ZXJVbnJlc3RyaWN0ZWQ9IGZ1bmN0aW9uKCkge1xuXHR2YXIgY3VycmVudFBvaW50ZXJMb2NrRWxlbWVudCA9IGRvY3VtZW50LnBvaW50ZXJMb2NrRWxlbWVudDtcblx0dmFyIGV4cGVjdGVkUG9pbnRlckxvY2tFbGVtZW50ID0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50O1xuXHRpZiAoIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgJiYgY3VycmVudFBvaW50ZXJMb2NrRWxlbWVudCA9PT0gZXhwZWN0ZWRQb2ludGVyTG9ja0VsZW1lbnQgJiYgdHlwZW9mKGRvY3VtZW50LmV4aXRQb2ludGVyTG9jaykgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0ZG9jdW1lbnQuZXhpdFBvaW50ZXJMb2NrKCk7XG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLmV2ZW5pZnkgPSBmdW5jdGlvbih4KXtcblx0aWYoeCAlIDIgPT0gMSl7XG5cdFx0cmV0dXJuIHgrMTtcblx0fVxuXHRyZXR1cm4geDtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlc2l6ZUNhbnZhc0lmTmVjZXNzYXJ5PSBmdW5jdGlvbigpIHtcbiAgICAvL2h0dHBzOi8vd2ViZ2wyZnVuZGFtZW50YWxzLm9yZy93ZWJnbC9sZXNzb25zL3dlYmdsLWFudGktcGF0dGVybnMuaHRtbCB5ZXMsIGV2ZXJ5IGZyYW1lLlxuICAgIC8vdGhpcyBoYW5kbGVzIHRoZSBlZGdlIGNhc2Ugd2hlcmUgdGhlIGNhbnZhcyBzaXplIGNoYW5nZXMgYnV0IHRoZSB3aW5kb3cgc2l6ZSBkb2Vzbid0XG5cbiAgICBsZXQgd2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICBsZXQgaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xuICAgIFxuICAgIGlmKCF0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyl7IC8vIGEgY2FudmFzIHdhcyBwcm92aWRlZCBleHRlcm5hbGx5XG4gICAgICAgIHdpZHRoID0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmNsaWVudFdpZHRoO1xuICAgICAgICBoZWlnaHQgPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuY2xpZW50SGVpZ2h0O1xuICAgIH1cblxuICAgIGlmKHdpZHRoICE9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC53aWR0aCB8fCBoZWlnaHQgIT0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmhlaWdodCl7XG4gICAgICAgIC8vY2FudmFzIGRpbWVuc2lvbnMgY2hhbmdlZCwgdXBkYXRlIHRoZSBpbnRlcm5hbCByZXNvbHV0aW9uXG5cblx0ICAgIHRoaXMuY2FtZXJhLmFzcGVjdCA9IHdpZHRoIC8gaGVpZ2h0O1xuICAgICAgICAvL3RoaXMuY2FtZXJhLnNldEZvY2FsTGVuZ3RoKDMwKTsgLy9pZiBJIHVzZSB0aGlzLCB0aGUgY2FtZXJhIHdpbGwga2VlcCBhIGNvbnN0YW50IHdpZHRoIGluc3RlYWQgb2YgY29uc3RhbnQgaGVpZ2h0XG5cdCAgICB0aGlzLmFzcGVjdCA9IHRoaXMuY2FtZXJhLmFzcGVjdDtcblx0ICAgIHRoaXMuY2FtZXJhLnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKTtcblx0ICAgIHRoaXMucmVuZGVyZXIuc2V0U2l6ZSggdGhpcy5ldmVuaWZ5KHdpZHRoKSwgdGhpcy5ldmVuaWZ5KGhlaWdodCksdGhpcy5zaG91bGRDcmVhdGVDYW52YXMgKTtcbiAgICB9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5saXN0ZW5lcnMgPSB7XCJ1cGRhdGVcIjogW10sXCJyZW5kZXJcIjpbXX07IC8vdXBkYXRlIGV2ZW50IGxpc3RlbmVyc1xuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24odGltZXN0ZXApe1xuICAgIHRoaXMucmVzaXplQ2FudmFzSWZOZWNlc3NhcnkoKTtcblxuICAgIHZhciByZWFsdGltZURlbHRhID0gdGhpcy5jbG9jay5nZXREZWx0YSgpO1xuXHR2YXIgZGVsdGEgPSByZWFsdGltZURlbHRhKnRoaXMudGltZVNjYWxlO1xuXHR0aGlzLmVsYXBzZWRUaW1lICs9IGRlbHRhO1xuICAgIHRoaXMudHJ1ZUVsYXBzZWRUaW1lICs9IHJlYWx0aW1lRGVsdGE7XG5cdC8vZ2V0IHRpbWVzdGVwXG5cdGZvcih2YXIgaT0wO2k8dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0ubGVuZ3RoO2krKyl7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl1baV0oe1widFwiOnRoaXMuZWxhcHNlZFRpbWUsXCJkZWx0YVwiOmRlbHRhLCdyZWFsdGltZURlbHRhJzpyZWFsdGltZURlbHRhfSk7XG5cdH1cblxuXHR0aGlzLnJlbmRlcmVyLnJlbmRlciggdGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEgKTtcblxuXHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLmxlbmd0aDtpKyspe1xuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdW2ldKCk7XG5cdH1cblxuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSB0aW1lc3RlcDtcblx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLnJlbmRlci5iaW5kKHRoaXMpKTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZXZlbnRfbmFtZSwgZnVuYyl7XG5cdC8vUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyLlxuXHQvL2VhY2ggbGlzdGVuZXIgd2lsbCBiZSBjYWxsZWQgd2l0aCBhbiBvYmplY3QgY29uc2lzdGluZyBvZjpcblx0Ly9cdHt0OiA8Y3VycmVudCB0aW1lIGluIHM+LCBcImRlbHRhXCI6IDxkZWx0YSwgaW4gbXM+fVxuXHQvLyBhbiB1cGRhdGUgZXZlbnQgZmlyZXMgYmVmb3JlIGEgcmVuZGVyLiBhIHJlbmRlciBldmVudCBmaXJlcyBwb3N0LXJlbmRlci5cblx0aWYoZXZlbnRfbmFtZSA9PSBcInVwZGF0ZVwiKXsgXG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0ucHVzaChmdW5jKTtcblx0fWVsc2UgaWYoZXZlbnRfbmFtZSA9PSBcInJlbmRlclwiKXsgXG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0ucHVzaChmdW5jKTtcblx0fWVsc2V7XG5cdFx0Y29uc29sZS5lcnJvcihcIkludmFsaWQgZXZlbnQgbmFtZSFcIilcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKGV2ZW50X25hbWUsIGZ1bmMpe1xuXHQvL1VucmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyLCB1bmRvaW5nIGFuIFRocmVlYXN5X3NldHVwLm9uKCkgZXZlbnQgbGlzdGVuZXIuXG5cdC8vdGhlIG5hbWluZyBzY2hlbWUgbWlnaHQgbm90IGJlIHRoZSBiZXN0IGhlcmUuXG5cdGlmKGV2ZW50X25hbWUgPT0gXCJ1cGRhdGVcIil7IFxuXHRcdGxldCBpbmRleCA9IHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmluZGV4T2YoZnVuYyk7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0uc3BsaWNlKGluZGV4LDEpO1xuXHR9IGVsc2UgaWYoZXZlbnRfbmFtZSA9PSBcInJlbmRlclwiKXsgXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0uaW5kZXhPZihmdW5jKTtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5zcGxpY2UoaW5kZXgsMSk7XG5cdH1lbHNle1xuXHRcdGNvbnNvbGUuZXJyb3IoXCJOb25leGlzdGVudCBldmVudCBuYW1lIVwiKVxuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vZmYgPSBUaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyOyAvL2FsaWFzIHRvIG1hdGNoIFRocmVlYXN5RW52aXJvbm1lbnQub25cblxuY2xhc3MgVGhyZWVhc3lSZWNvcmRlciBleHRlbmRzIFRocmVlYXN5RW52aXJvbm1lbnR7XG5cdC8vYmFzZWQgb24gaHR0cDovL3d3dy50eXNvbmNhZGVuaGVhZC5jb20vYmxvZy9leHBvcnRpbmctY2FudmFzLWFuaW1hdGlvbi10by1tb3YvIHRvIHJlY29yZCBhbiBhbmltYXRpb25cblx0Ly93aGVuIGRvbmUsICAgICBmZm1wZWcgLXIgNjAgLWZyYW1lcmF0ZSA2MCAtaSAuLyUwN2QucG5nIC12Y29kZWMgbGlieDI2NCAtcGl4X2ZtdCB5dXY0MjBwIC1jcmY6diAwIHZpZGVvLm1wNFxuICAgIC8vIHRvIHBlcmZvcm0gbW90aW9uIGJsdXIgb24gYW4gb3ZlcnNhbXBsZWQgdmlkZW8sIGZmbXBlZyAtaSB2aWRlby5tcDQgLXZmIHRibGVuZD1hbGxfbW9kZT1hdmVyYWdlLGZyYW1lc3RlcD0yIHZpZGVvMi5tcDRcblx0Ly90aGVuLCBhZGQgdGhlIHl1djQyMHAgcGl4ZWxzICh3aGljaCBmb3Igc29tZSByZWFzb24gaXNuJ3QgZG9uZSBieSB0aGUgcHJldiBjb21tYW5kKSBieTpcblx0Ly8gZmZtcGVnIC1pIHZpZGVvLm1wNCAtdmNvZGVjIGxpYngyNjQgLXBpeF9mbXQgeXV2NDIwcCAtc3RyaWN0IC0yIC1hY29kZWMgYWFjIGZpbmlzaGVkX3ZpZGVvLm1wNFxuXHQvL2NoZWNrIHdpdGggZmZtcGVnIC1pIGZpbmlzaGVkX3ZpZGVvLm1wNFxuXG5cdGNvbnN0cnVjdG9yKGZwcz0zMCwgbGVuZ3RoID0gNSwgY2FudmFzRWxlbSA9IG51bGwpe1xuXHRcdC8qIGZwcyBpcyBldmlkZW50LCBhdXRvc3RhcnQgaXMgYSBib29sZWFuIChieSBkZWZhdWx0LCB0cnVlKSwgYW5kIGxlbmd0aCBpcyBpbiBzLiovXG5cdFx0c3VwZXIoY2FudmFzRWxlbSk7XG5cdFx0dGhpcy5mcHMgPSBmcHM7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSA9IDA7XG5cdFx0dGhpcy5mcmFtZUNvdW50ID0gZnBzICogbGVuZ3RoO1xuXHRcdHRoaXMuZnJhbWVzX3JlbmRlcmVkID0gMDtcblxuXHRcdHRoaXMuY2FwdHVyZXIgPSBuZXcgQ0NhcHR1cmUoIHtcblx0XHRcdGZyYW1lcmF0ZTogZnBzLFxuXHRcdFx0Zm9ybWF0OiAncG5nJyxcblx0XHRcdG5hbWU6IGRvY3VtZW50LnRpdGxlLFxuXHRcdFx0Ly92ZXJib3NlOiB0cnVlLFxuXHRcdH0gKTtcblxuXHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cblx0XHR0aGlzLklTX1JFQ09SRElORyA9IHRydWU7XG5cdH1cblx0c3RhcnQoKXtcblx0XHQvL21ha2UgYSByZWNvcmRpbmcgc2lnblxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUud2lkdGg9XCIyMHB4XCJcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmhlaWdodD1cIjIwcHhcIlxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUudG9wID0gJzIwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUubGVmdCA9ICcyMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdyZWQnO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yZWNvcmRpbmdfaWNvbik7XG5cblx0XHR0aGlzLmZyYW1lQ291bnRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLnRvcCA9ICcyMHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5sZWZ0ID0gJzUwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmNvbG9yID0gJ2JsYWNrJztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnMTBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMjU1LDI1NSwyNTUsMC4xKSc7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLmZyYW1lQ291bnRlcik7XG5cblx0XHR0aGlzLmNhcHR1cmVyLnN0YXJ0KCk7XG5cdFx0dGhpcy5yZW5kZXJpbmcgPSB0cnVlO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblx0cmVuZGVyKHRpbWVzdGVwKXtcbiAgICAgICAgdmFyIHJlYWx0aW1lRGVsdGEgPSAxL3RoaXMuZnBzOy8vaWdub3JpbmcgdGhlIHRydWUgdGltZSwgY2FsY3VsYXRlIHRoZSBkZWx0YVxuXHRcdHZhciBkZWx0YSA9IHJlYWx0aW1lRGVsdGEqdGhpcy50aW1lU2NhbGU7IFxuXHRcdHRoaXMuZWxhcHNlZFRpbWUgKz0gZGVsdGE7XG4gICAgICAgIHRoaXMudHJ1ZUVsYXBzZWRUaW1lICs9IHJlYWx0aW1lRGVsdGE7XG5cblx0XHQvL2dldCB0aW1lc3RlcFxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXVtpXSh7XCJ0XCI6dGhpcy5lbGFwc2VkVGltZSxcImRlbHRhXCI6ZGVsdGEsICdyZWFsdGltZURlbHRhJzpyZWFsdGltZURlbHRhfSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJlci5yZW5kZXIoIHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhICk7XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl1baV0oKTtcblx0XHR9XG5cblxuXHRcdHRoaXMucmVjb3JkX2ZyYW1lKCk7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnMTBweCc7XG5cblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xuXHR9XG5cdHJlY29yZF9mcmFtZSgpe1xuXHQvL1x0bGV0IGN1cnJlbnRfZnJhbWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYW52YXMnKS50b0RhdGFVUkwoKTtcblxuXHRcdHRoaXMuY2FwdHVyZXIuY2FwdHVyZSggZG9jdW1lbnQucXVlcnlTZWxlY3RvcignY2FudmFzJykgKTtcblxuXHRcdHRoaXMuZnJhbWVDb3VudGVyLmlubmVySFRNTCA9IHRoaXMuZnJhbWVzX3JlbmRlcmVkICsgXCIgLyBcIiArIHRoaXMuZnJhbWVDb3VudDsgLy91cGRhdGUgdGltZXJcblxuXHRcdHRoaXMuZnJhbWVzX3JlbmRlcmVkKys7XG5cblxuXHRcdGlmKHRoaXMuZnJhbWVzX3JlbmRlcmVkPnRoaXMuZnJhbWVDb3VudCl7XG5cdFx0XHR0aGlzLnJlbmRlciA9IG51bGw7IC8vaGFja3kgd2F5IG9mIHN0b3BwaW5nIHRoZSByZW5kZXJpbmdcblx0XHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0Ly90aGlzLmZyYW1lQ291bnRlci5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cblx0XHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cdFx0XHR0aGlzLmNhcHR1cmVyLnN0b3AoKTtcblx0XHRcdC8vIGRlZmF1bHQgc2F2ZSwgd2lsbCBkb3dubG9hZCBhdXRvbWF0aWNhbGx5IGEgZmlsZSBjYWxsZWQge25hbWV9LmV4dGVuc2lvbiAod2VibS9naWYvdGFyKVxuXHRcdFx0dGhpcy5jYXB0dXJlci5zYXZlKCk7XG5cdFx0fVxuXHR9XG5cdHJlc2l6ZUNhbnZhc0lmTmVjZXNzYXJ5KCkge1xuXHRcdC8vc3RvcCByZWNvcmRpbmcgaWYgd2luZG93IHNpemUgY2hhbmdlc1xuXHRcdGlmKHRoaXMucmVuZGVyaW5nICYmIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0ICE9IHRoaXMuYXNwZWN0KXtcblx0XHRcdHRoaXMuY2FwdHVyZXIuc3RvcCgpO1xuXHRcdFx0dGhpcy5yZW5kZXIgPSBudWxsOyAvL2hhY2t5IHdheSBvZiBzdG9wcGluZyB0aGUgcmVuZGVyaW5nXG5cdFx0XHRhbGVydChcIkFib3J0aW5nIHJlY29yZDogV2luZG93LXNpemUgY2hhbmdlIGRldGVjdGVkIVwiKTtcblx0XHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN1cGVyLnJlc2l6ZUNhbnZhc0lmTmVjZXNzYXJ5KCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gc2V0dXBUaHJlZShmcHM9MzAsIGxlbmd0aCA9IDUsIGNhbnZhc0VsZW0gPSBudWxsKXtcblx0LyogU2V0IHVwIHRoZSB0aHJlZS5qcyBlbnZpcm9ubWVudC4gU3dpdGNoIGJldHdlZW4gY2xhc3NlcyBkeW5hbWljYWxseSBzbyB0aGF0IHlvdSBjYW4gcmVjb3JkIGJ5IGFwcGVuZGluZyBcIj9yZWNvcmQ9dHJ1ZVwiIHRvIGFuIHVybC4gVGhlbiBFWFAudGhyZWVFbnZpcm9ubWVudC5jYW1lcmEgYW5kIEVYUC50aHJlZUVudmlyb25tZW50LnNjZW5lIHdvcmssIGFzIHdlbGwgYXMgRVhQLnRocmVlRW52aXJvbm1lbnQub24oJ2V2ZW50IG5hbWUnLCBjYWxsYmFjaykuIE9ubHkgb25lIGVudmlyb25tZW50IGV4aXN0cyBhdCBhIHRpbWUuXG5cbiAgICBUaGUgcmV0dXJuZWQgb2JqZWN0IGlzIGEgc2luZ2xldG9uOiBtdWx0aXBsZSBjYWxscyB3aWxsIHJldHVybiB0aGUgc2FtZSBvYmplY3Q6IEVYUC50aHJlZUVudmlyb25tZW50LiovXG5cdHZhciByZWNvcmRlciA9IG51bGw7XG5cdHZhciBpc19yZWNvcmRpbmcgPSBmYWxzZTtcblxuXHQvL2V4dHJhY3QgcmVjb3JkIHBhcmFtZXRlciBmcm9tIHVybFxuXHR2YXIgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhkb2N1bWVudC5sb2NhdGlvbi5zZWFyY2gpO1xuXHRsZXQgcmVjb3JkU3RyaW5nID0gcGFyYW1zLmdldChcInJlY29yZFwiKTtcblxuXHRpZihyZWNvcmRTdHJpbmcpeyAvL2RldGVjdCBpZiBVUkwgcGFyYW1zIGluY2x1ZGUgP3JlY29yZD0xIG9yID9yZWNvcmQ9dHJ1ZVxuICAgICAgICByZWNvcmRTdHJpbmcgPSByZWNvcmRTdHJpbmcudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaXNfcmVjb3JkaW5nID0gKHJlY29yZFN0cmluZyA9PSBcInRydWVcIiB8fCByZWNvcmRTdHJpbmcgPT0gXCIxXCIpO1xuICAgIH1cblxuICAgIGxldCB0aHJlZUVudmlyb25tZW50ID0gZ2V0VGhyZWVFbnZpcm9ubWVudCgpO1xuICAgIGlmKHRocmVlRW52aXJvbm1lbnQgIT09IG51bGwpey8vc2luZ2xldG9uIGhhcyBhbHJlYWR5IGJlZW4gY3JlYXRlZFxuICAgICAgICByZXR1cm4gdGhyZWVFbnZpcm9ubWVudDtcbiAgICB9XG5cblx0aWYoaXNfcmVjb3JkaW5nKXtcblx0XHR0aHJlZUVudmlyb25tZW50ID0gbmV3IFRocmVlYXN5UmVjb3JkZXIoZnBzLCBsZW5ndGgsIGNhbnZhc0VsZW0pO1xuXHR9ZWxzZXtcblx0XHR0aHJlZUVudmlyb25tZW50ID0gbmV3IFRocmVlYXN5RW52aXJvbm1lbnQoY2FudmFzRWxlbSk7XG5cdH1cbiAgICBzZXRUaHJlZUVudmlyb25tZW50KHRocmVlRW52aXJvbm1lbnQpO1xuICAgIHJldHVybiB0aHJlZUVudmlyb25tZW50O1xufVxuXG5leHBvcnQge3NldHVwVGhyZWUsIFRocmVlYXN5RW52aXJvbm1lbnQsIFRocmVlYXN5UmVjb3JkZXJ9XG4iLCJhc3luYyBmdW5jdGlvbiBkZWxheSh3YWl0VGltZSl7XG5cdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIHdhaXRUaW1lKTtcblx0fSk7XG5cbn1cblxuZXhwb3J0IHtkZWxheX07XG4iLCIvL0xpbmVPdXRwdXRTaGFkZXJzLmpzXG5cbi8vYmFzZWQgb24gaHR0cHM6Ly9tYXR0ZGVzbC5zdmJ0bGUuY29tL2RyYXdpbmctbGluZXMtaXMtaGFyZCBidXQgd2l0aCBzZXZlcmFsIGVycm9ycyBjb3JyZWN0ZWQsIGJldmVsIHNoYWRpbmcgYWRkZWQsIGFuZCBtb3JlXG5cbmNvbnN0IExJTkVfSk9JTl9UWVBFUyA9IHtcIk1JVEVSXCI6IDAuMiwgXCJCRVZFTFwiOjEuMixcIlJPVU5EXCI6Mi4yfTsgLy9JJ2QgdXNlIDAsMSwyIGJ1dCBKUyBkb2Vzbid0IGFkZCBhIGRlY2ltYWwgcGxhY2UgYXQgdGhlIGVuZCB3aGVuIGluc2VydGluZyB0aGVtIGluIGEgc3RyaW5nLiBjdXJzZWQganVzdGlmaWNhdGlvblxuXG52YXIgdlNoYWRlciA9IFtcblwidW5pZm9ybSBmbG9hdCBhc3BlY3Q7XCIsIC8vdXNlZCB0byBjYWxpYnJhdGUgc2NyZWVuIHNwYWNlXG5cInVuaWZvcm0gZmxvYXQgbGluZVdpZHRoO1wiLCAvL3dpZHRoIG9mIGxpbmVcblwidW5pZm9ybSBmbG9hdCBsaW5lSm9pblR5cGU7XCIsXG4vL1wiYXR0cmlidXRlIHZlYzMgcG9zaXRpb247XCIsIC8vYWRkZWQgYXV0b21hdGljYWxseSBieSB0aHJlZS5qc1xuXCJhdHRyaWJ1dGUgdmVjMyBuZXh0UG9pbnRQb3NpdGlvbjtcIixcblwiYXR0cmlidXRlIHZlYzMgcHJldmlvdXNQb2ludFBvc2l0aW9uO1wiLFxuXCJhdHRyaWJ1dGUgZmxvYXQgZGlyZWN0aW9uO1wiLFxuXCJhdHRyaWJ1dGUgZmxvYXQgYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4O1wiLFxuXG5cInZhcnlpbmcgZmxvYXQgY3Jvc3NMaW5lUG9zaXRpb247XCIsXG5cImF0dHJpYnV0ZSB2ZWMzIGNvbG9yO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgdkNvbG9yO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgbGluZVNlZ21lbnRBQ2xpcFNwYWNlO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgbGluZVNlZ21lbnRCQ2xpcFNwYWNlO1wiLFxuXCJ2YXJ5aW5nIGZsb2F0IHRoaWNrbmVzcztcIixcblxuXG5cInZhcnlpbmcgdmVjMyBkZWJ1Z0luZm87XCIsXG5cblwidmVjMyBhbmdsZV90b19odWUoZmxvYXQgYW5nbGUpIHtcIiwgLy9mb3IgZGVidWdnaW5nXG5cIiAgYW5nbGUgLz0gMy4xNDE1OTIqMi47XCIsXG5cIiAgcmV0dXJuIGNsYW1wKChhYnMoZnJhY3QoYW5nbGUrdmVjMygzLjAsIDIuMCwgMS4wKS8zLjApKjYuMC0zLjApLTEuMCksIDAuMCwgMS4wKTtcIixcblwifVwiLFxuXG4vL2dpdmVuIGFuIHVuaXQgdmVjdG9yLCBtb3ZlIGRpc3QgdW5pdHMgcGVycGVuZGljdWxhciB0byBpdC5cblwidmVjMiBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZSh2ZWMyIGRpciwgZmxvYXQgdHdpY2VEaXN0KSB7XCIsXG4gIFwidmVjMiBub3JtYWwgPSB2ZWMyKC1kaXIueSwgZGlyLngpIDtcIixcbiAgXCJub3JtYWwgKj0gdHdpY2VEaXN0LzIuMDtcIixcbiAgXCJub3JtYWwueCAvPSBhc3BlY3Q7XCIsXG4gIFwicmV0dXJuIG5vcm1hbDtcIixcblwifVwiLFxuXG5cInZvaWQgbWFpbigpIHtcIixcblxuICBcInZlYzIgYXNwZWN0VmVjID0gdmVjMihhc3BlY3QsIDEuMCk7XCIsXG4gIFwibWF0NCBwcm9qVmlld01vZGVsID0gcHJvamVjdGlvbk1hdHJpeCAqXCIsXG4gICAgICAgICAgICBcInZpZXdNYXRyaXggKiBtb2RlbE1hdHJpeDtcIixcbiAgXCJ2ZWM0IHByZXZpb3VzUHJvamVjdGVkID0gcHJvalZpZXdNb2RlbCAqIHZlYzQocHJldmlvdXNQb2ludFBvc2l0aW9uLCAxLjApO1wiLFxuICBcInZlYzQgY3VycmVudFByb2plY3RlZCA9IHByb2pWaWV3TW9kZWwgKiB2ZWM0KHBvc2l0aW9uLCAxLjApO1wiLFxuICBcInZlYzQgbmV4dFByb2plY3RlZCA9IHByb2pWaWV3TW9kZWwgKiB2ZWM0KG5leHRQb2ludFBvc2l0aW9uLCAxLjApO1wiLFxuXG5cbiAgLy9nZXQgMkQgc2NyZWVuIHNwYWNlIHdpdGggVyBkaXZpZGUgYW5kIGFzcGVjdCBjb3JyZWN0aW9uXG4gIFwidmVjMiBjdXJyZW50U2NyZWVuID0gY3VycmVudFByb2plY3RlZC54eSAvIGN1cnJlbnRQcm9qZWN0ZWQudyAqIGFzcGVjdFZlYztcIixcbiAgXCJ2ZWMyIHByZXZpb3VzU2NyZWVuID0gcHJldmlvdXNQcm9qZWN0ZWQueHkgLyBwcmV2aW91c1Byb2plY3RlZC53ICogYXNwZWN0VmVjO1wiLFxuICBcInZlYzIgbmV4dFNjcmVlbiA9IG5leHRQcm9qZWN0ZWQueHkgLyBuZXh0UHJvamVjdGVkLncgKiBhc3BlY3RWZWM7XCIsXG5cbiAgLy9cImNlbnRlclBvaW50Q2xpcFNwYWNlUG9zaXRpb24gPSBjdXJyZW50UHJvamVjdGVkLnh5IC8gY3VycmVudFByb2plY3RlZC53O1wiLC8vc2VuZCB0byBmcmFnbWVudCBzaGFkZXJcbiAgXCJjcm9zc0xpbmVQb3NpdGlvbiA9IGRpcmVjdGlvbjtcIiwgLy9zZW5kIGRpcmVjdGlvbiB0byB0aGUgZnJhZ21lbnQgc2hhZGVyXG4gIFwidkNvbG9yID0gY29sb3I7XCIsIC8vc2VuZCBkaXJlY3Rpb24gdG8gdGhlIGZyYWdtZW50IHNoYWRlclxuXG4gIFwidGhpY2tuZXNzID0gbGluZVdpZHRoIC8gNDAwLjtcIiwgLy9UT0RPOiBjb252ZXJ0IGxpbmVXaWR0aCB0byBwaXhlbHNcbiAgXCJmbG9hdCBvcmllbnRhdGlvbiA9IChkaXJlY3Rpb24tMC41KSoyLjtcIixcblxuICAvL2dldCBkaXJlY3Rpb25zIGZyb20gKEMgLSBCKSBhbmQgKEIgLSBBKVxuICBcInZlYzIgdmVjQSA9IChjdXJyZW50U2NyZWVuIC0gcHJldmlvdXNTY3JlZW4pO1wiLFxuICBcInZlYzIgdmVjQiA9IChuZXh0U2NyZWVuIC0gY3VycmVudFNjcmVlbik7XCIsXG4gIFwidmVjMiBkaXJBID0gbm9ybWFsaXplKHZlY0EpO1wiLFxuICBcInZlYzIgZGlyQiA9IG5vcm1hbGl6ZSh2ZWNCKTtcIixcblxuICAvL0RFQlVHXG4gIFwibGluZVNlZ21lbnRBQ2xpcFNwYWNlID0gbWl4KHByZXZpb3VzU2NyZWVuLGN1cnJlbnRTY3JlZW4sYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4KSAvIGFzcGVjdFZlYztcIiwvL3NlbmQgdG8gZnJhZ21lbnQgc2hhZGVyXG4gIFwibGluZVNlZ21lbnRCQ2xpcFNwYWNlID0gbWl4KGN1cnJlbnRTY3JlZW4sbmV4dFNjcmVlbixhcHByb2FjaE5leHRPclByZXZWZXJ0ZXgpIC8gYXNwZWN0VmVjO1wiLC8vc2VuZCB0byBmcmFnbWVudCBzaGFkZXJcblxuICAvL3N0YXJ0aW5nIHBvaW50IHVzZXMgKG5leHQgLSBjdXJyZW50KVxuICBcInZlYzIgb2Zmc2V0ID0gdmVjMigwLjApO1wiLFxuICBcImlmIChjdXJyZW50U2NyZWVuID09IHByZXZpb3VzU2NyZWVuKSB7XCIsXG4gIFwiICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXJCICogb3JpZW50YXRpb24sIHRoaWNrbmVzcyk7XCIsXG4gIC8vb2Zmc2V0ICs9IGRpckIgKiB0aGlja25lc3M7IC8vZW5kIGNhcFxuICBcIn0gXCIsXG4gIC8vZW5kaW5nIHBvaW50IHVzZXMgKGN1cnJlbnQgLSBwcmV2aW91cylcbiAgXCJlbHNlIGlmIChjdXJyZW50U2NyZWVuID09IG5leHRTY3JlZW4pIHtcIixcbiAgXCIgIG9mZnNldCA9IG9mZnNldFBlcnBlbmRpY3VsYXJBbG9uZ1NjcmVlblNwYWNlKGRpckEgKiBvcmllbnRhdGlvbiwgdGhpY2tuZXNzKTtcIixcbiAgLy9vZmZzZXQgKz0gZGlyQSAqIHRoaWNrbmVzczsgLy9lbmQgY2FwXG4gIFwifVwiLFxuICBcIi8vc29tZXdoZXJlIGluIG1pZGRsZSwgbmVlZHMgYSBqb2luXCIsXG4gIFwiZWxzZSB7XCIsXG4gIFwiICBpZiAobGluZUpvaW5UeXBlID09IFwiK0xJTkVfSk9JTl9UWVBFUy5NSVRFUitcIikge1wiLFxuICAgICAgICAvL2Nvcm5lciB0eXBlOiBtaXRlci4gVGhpcyBpcyBidWdneSAodGhlcmUncyBubyBtaXRlciBsaW1pdCB5ZXQpIHNvIGRvbid0IHVzZVxuICBcIiAgICAvL25vdyBjb21wdXRlIHRoZSBtaXRlciBqb2luIG5vcm1hbCBhbmQgbGVuZ3RoXCIsXG4gIFwiICAgIHZlYzIgbWl0ZXJEaXJlY3Rpb24gPSBub3JtYWxpemUoZGlyQSArIGRpckIpO1wiLFxuICBcIiAgICB2ZWMyIHByZXZMaW5lRXh0cnVkZURpcmVjdGlvbiA9IHZlYzIoLWRpckEueSwgZGlyQS54KTtcIixcbiAgXCIgICAgdmVjMiBtaXRlciA9IHZlYzIoLW1pdGVyRGlyZWN0aW9uLnksIG1pdGVyRGlyZWN0aW9uLngpO1wiLFxuICBcIiAgICBmbG9hdCBsZW4gPSB0aGlja25lc3MgLyAoZG90KG1pdGVyLCBwcmV2TGluZUV4dHJ1ZGVEaXJlY3Rpb24pKzAuMDAwMSk7XCIsIC8vY2FsY3VsYXRlLiBkb3QgcHJvZHVjdCBpcyBhbHdheXMgPiAwXG4gIFwiICAgIG9mZnNldCA9IG9mZnNldFBlcnBlbmRpY3VsYXJBbG9uZ1NjcmVlblNwYWNlKG1pdGVyRGlyZWN0aW9uICogb3JpZW50YXRpb24sIGxlbik7XCIsXG4gIFwiICB9IGVsc2UgaWYgKGxpbmVKb2luVHlwZSA9PSBcIitMSU5FX0pPSU5fVFlQRVMuQkVWRUwrXCIpe1wiLFxuICAgIC8vY29ybmVyIHR5cGU6IGJldmVsXG4gIFwiICAgIHZlYzIgZGlyID0gbWl4KGRpckEsIGRpckIsIGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleCk7XCIsXG4gIFwiICAgIG9mZnNldCA9IG9mZnNldFBlcnBlbmRpY3VsYXJBbG9uZ1NjcmVlblNwYWNlKGRpciAqIG9yaWVudGF0aW9uLCB0aGlja25lc3MpO1wiLFxuICBcIiAgfSBlbHNlIGlmIChsaW5lSm9pblR5cGUgPT0gXCIrTElORV9KT0lOX1RZUEVTLlJPVU5EK1wiKXtcIixcbiAgICAvL2Nvcm5lciB0eXBlOiByb3VuZFxuICBcIiAgICB2ZWMyIGRpciA9IG1peChkaXJBLCBkaXJCLCBhcHByb2FjaE5leHRPclByZXZWZXJ0ZXgpO1wiLFxuICBcIiAgICB2ZWMyIGhhbGZUaGlja25lc3NQYXN0VGhlVmVydGV4ID0gZGlyKnRoaWNrbmVzcy8yLiAqIGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleCAvIGFzcGVjdFZlYztcIixcbiAgXCIgICAgb2Zmc2V0ID0gb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UoZGlyICogb3JpZW50YXRpb24sIHRoaWNrbmVzcykgLSBoYWxmVGhpY2tuZXNzUGFzdFRoZVZlcnRleDtcIiwgLy9leHRlbmQgcmVjdHMgcGFzdCB0aGUgdmVydGV4XG4gIFwiICB9IGVsc2Uge1wiLCAvL25vIGxpbmUgam9pbiB0eXBlIHNwZWNpZmllZCwganVzdCBnbyBmb3IgdGhlIHByZXZpb3VzIHBvaW50XG4gIFwiICAgIG9mZnNldCA9IG9mZnNldFBlcnBlbmRpY3VsYXJBbG9uZ1NjcmVlblNwYWNlKGRpckEsIHRoaWNrbmVzcyk7XCIsXG4gIFwiICB9XCIsXG4gIFwifVwiLFxuXG4gIFwiZGVidWdJbmZvID0gdmVjMyhhcHByb2FjaE5leHRPclByZXZWZXJ0ZXgsIG9yaWVudGF0aW9uLCAwLjApO1wiLCAvL1RPRE86IHJlbW92ZS4gaXQncyBmb3IgZGVidWdnaW5nIGNvbG9yc1xuICBcImdsX1Bvc2l0aW9uID0gY3VycmVudFByb2plY3RlZCArIHZlYzQob2Zmc2V0LCAwLjAsMC4wKSAqY3VycmVudFByb2plY3RlZC53O1wiLFxuXCJ9XCJdLmpvaW4oXCJcXG5cIik7XG5cbnZhciBmU2hhZGVyID0gW1xuXCJ1bmlmb3JtIGZsb2F0IG9wYWNpdHk7XCIsXG5cInVuaWZvcm0gdmVjMiBzY3JlZW5TaXplO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGFzcGVjdDtcIixcblwidW5pZm9ybSBmbG9hdCBsaW5lSm9pblR5cGU7XCIsXG5cInZhcnlpbmcgdmVjMyB2Q29sb3I7XCIsXG5cInZhcnlpbmcgdmVjMyBkZWJ1Z0luZm87XCIsXG5cInZhcnlpbmcgdmVjMiBsaW5lU2VnbWVudEFDbGlwU3BhY2U7XCIsXG5cInZhcnlpbmcgdmVjMiBsaW5lU2VnbWVudEJDbGlwU3BhY2U7XCIsXG5cInZhcnlpbmcgZmxvYXQgY3Jvc3NMaW5lUG9zaXRpb247XCIsXG5cInZhcnlpbmcgZmxvYXQgdGhpY2tuZXNzO1wiLFxuXG4vKiB1c2VmdWwgZm9yIGRlYnVnZ2luZyEgZnJvbSBodHRwczovL3d3dy5yb25qYS10dXRvcmlhbHMuY29tLzIwMTgvMTEvMjQvc2RmLXNwYWNlLW1hbmlwdWxhdGlvbi5odG1sXG5cInZlYzMgcmVuZGVyTGluZXNPdXRzaWRlKGZsb2F0IGRpc3Qpe1wiLFxuXCIgICAgZmxvYXQgX0xpbmVEaXN0YW5jZSA9IDAuMztcIixcblwiICAgIGZsb2F0IF9MaW5lVGhpY2tuZXNzID0gMC4wNTtcIixcblwiICAgIGZsb2F0IF9TdWJMaW5lVGhpY2tuZXNzID0gMC4wNTtcIixcblwiICAgIGZsb2F0IF9TdWJMaW5lcyA9IDEuMDtcIixcblwiICAgIHZlYzMgY29sID0gbWl4KHZlYzMoMS4wLDAuMiwwLjIpLCB2ZWMzKDAuMCwwLjIsMS4yKSwgc3RlcCgwLjAsIGRpc3QpKTtcIixcblxuXCIgICAgZmxvYXQgZGlzdGFuY2VDaGFuZ2UgPSBmd2lkdGgoZGlzdCkgKiAwLjU7XCIsXG5cIiAgICBmbG9hdCBtYWpvckxpbmVEaXN0YW5jZSA9IGFicyhmcmFjdChkaXN0IC8gX0xpbmVEaXN0YW5jZSArIDAuNSkgLSAwLjUpICogX0xpbmVEaXN0YW5jZTtcIixcblwiICAgIGZsb2F0IG1ham9yTGluZXMgPSBzbW9vdGhzdGVwKF9MaW5lVGhpY2tuZXNzIC0gZGlzdGFuY2VDaGFuZ2UsIF9MaW5lVGhpY2tuZXNzICsgZGlzdGFuY2VDaGFuZ2UsIG1ham9yTGluZURpc3RhbmNlKTtcIixcblxuXCIgICAgZmxvYXQgZGlzdGFuY2VCZXR3ZWVuU3ViTGluZXMgPSBfTGluZURpc3RhbmNlIC8gX1N1YkxpbmVzO1wiLFxuXCIgICAgZmxvYXQgc3ViTGluZURpc3RhbmNlID0gYWJzKGZyYWN0KGRpc3QgLyBkaXN0YW5jZUJldHdlZW5TdWJMaW5lcyArIDAuNSkgLSAwLjUpICogZGlzdGFuY2VCZXR3ZWVuU3ViTGluZXM7XCIsXG5cIiAgICBmbG9hdCBzdWJMaW5lcyA9IHNtb290aHN0ZXAoX1N1YkxpbmVUaGlja25lc3MgLSBkaXN0YW5jZUNoYW5nZSwgX1N1YkxpbmVUaGlja25lc3MgKyBkaXN0YW5jZUNoYW5nZSwgc3ViTGluZURpc3RhbmNlKTtcIixcblxuXCIgICAgcmV0dXJuIGNvbCAqIG1ham9yTGluZXMgKiBzdWJMaW5lcztcIixcblwifVwiLCAqL1xuXG5cblwiZmxvYXQgbGluZVNERih2ZWMyIHBvaW50LCB2ZWMyIGxpbmVTdGFydFB0LHZlYzIgbGluZUVuZFB0KSB7XCIsXG4gIFwiZmxvYXQgaCA9IGNsYW1wKGRvdChwb2ludC1saW5lU3RhcnRQdCxsaW5lRW5kUHQtbGluZVN0YXJ0UHQpL2RvdChsaW5lRW5kUHQtbGluZVN0YXJ0UHQsbGluZUVuZFB0LWxpbmVTdGFydFB0KSwwLjAsMS4wKTtcIixcbiAgXCJ2ZWMyIHByb2plY3RlZFZlYyA9IChwb2ludC1saW5lU3RhcnRQdC0obGluZUVuZFB0LWxpbmVTdGFydFB0KSpoKTtcIixcbiAgXCJyZXR1cm4gbGVuZ3RoKHByb2plY3RlZFZlYyk7XCIsXG5cIn1cIixcblxuXG5cInZvaWQgbWFpbigpe1wiLFxuXCIgIHZlYzMgY29sID0gdkNvbG9yLnJnYjtcIixcbi8vXCIgIGNvbCA9IGRlYnVnSW5mby5yZ2I7XCIsXG5cIiAgZ2xfRnJhZ0NvbG9yID0gdmVjNChjb2wsIG9wYWNpdHkpO1wiLFxuXG5cIiAgaWYgKGxpbmVKb2luVHlwZSA9PSBcIitMSU5FX0pPSU5fVFlQRVMuUk9VTkQrXCIpe1wiLFxuXCIgICAgICB2ZWMyIHZlcnRTY3JlZW5TcGFjZVBvc2l0aW9uID0gZ2xfRnJhZ0Nvb3JkLnh5O1wiLCAvL2dvZXMgZnJvbSAwIHRvIHNjcmVlblNpemUueHlcblwiICAgICAgdmVjMiBsaW5lUHRBU2NyZWVuU3BhY2UgPSAobGluZVNlZ21lbnRBQ2xpcFNwYWNlKzEuKS8yLiAqIHNjcmVlblNpemU7XCIsIC8vY29udmVydCBbLTEsMV0gdG8gWzAsMV0sIHRoZW4gKnNjcmVlblNpemVcblwiICAgICAgdmVjMiBsaW5lUHRCU2NyZWVuU3BhY2UgPSAobGluZVNlZ21lbnRCQ2xpcFNwYWNlKzEuKS8yLiAqIHNjcmVlblNpemU7XCIsXG5cIiAgICAgIGZsb2F0IGRpc3RGcm9tTGluZSA9IGxpbmVTREYodmVydFNjcmVlblNwYWNlUG9zaXRpb24sIGxpbmVQdEFTY3JlZW5TcGFjZSxsaW5lUHRCU2NyZWVuU3BhY2UpO1wiLFxuXCIgICAgICBmbG9hdCBzZGYgPSAxLi0oMS4vdGhpY2tuZXNzIC9zY3JlZW5TaXplLnkgKiA0LjAgKmRpc3RGcm9tTGluZSk7XCIsXG5cIiAgICAgIGZsb2F0IHNkZk9wYWNpdHkgPSBjbGFtcChzZGYgLyAoYWJzKGRGZHgoc2RmKSkgKyBhYnMoZEZkeShzZGYpKSksMC4wLDEuMCk7XCIsXG4vL1wiICAgICAgaWYob3BhY2l0eSAqIHNkZk9wYWNpdHkgPCAwLjEpZGlzY2FyZDtcIixcblwiICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChjb2wsIG9wYWNpdHkgKiBzZGZPcGFjaXR5ICk7XCIsXG5cIiAgfVwiLFxuXCJ9XCJdLmpvaW4oXCJcXG5cIilcblxudmFyIHVuaWZvcm1zID0ge1xuXHRsaW5lV2lkdGg6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCwgLy9jdXJyZW50bHkgaW4gdW5pdHMgb2YgeUhlaWdodCo0MDBcblx0fSxcblx0c2NyZWVuU2l6ZToge1xuXHRcdHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yMiggMSwgMSApLFxuXHR9LFxuXHRsaW5lSm9pblR5cGU6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IExJTkVfSk9JTl9UWVBFUy5ST1VORCxcblx0fSxcblx0b3BhY2l0eToge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMS4wLFxuXHR9LFxuXHRhc3BlY3Q6IHsgLy9hc3BlY3QgcmF0aW8uIG5lZWQgdG8gbG9hZCBmcm9tIHJlbmRlcmVyXG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAxLjAsXG5cdH1cbn07XG5cbmV4cG9ydCB7IHZTaGFkZXIsIGZTaGFkZXIsIHVuaWZvcm1zLCBMSU5FX0pPSU5fVFlQRVMgfTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQgeyBnZXRUaHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcywgTElORV9KT0lOX1RZUEVTIH0gZnJvbSAnLi9MaW5lT3V0cHV0U2hhZGVycy5qcyc7XG5cbmNsYXNzIExpbmVPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8qIHNob3VsZCBiZSAuYWRkKCllZCB0byBhIFRyYW5zZm9ybWF0aW9uIHRvIHdvcmsuXG4gICAgICAgIENyaXNwIGxpbmVzIHVzaW5nIHRoZSB0ZWNobmlxdWUgaW4gaHR0cHM6Ly9tYXR0ZGVzbC5zdmJ0bGUuY29tL2RyYXdpbmctbGluZXMtaXMtaGFyZCwgYnV0IGFsc28gc3VwcG9ydGluZyBtaXRlcmVkIGxpbmVzIGFuZCBiZXZlbGVkIGxpbmVzIHRvbyFcbiAgICAgICAgICAgIG9wdGlvbnM6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgd2lkdGg6IG51bWJlci4gdW5pdHMgYXJlIGluIHNjcmVlblkvNDAwLlxuICAgICAgICAgICAgICAgIG9wYWNpdHk6IG51bWJlclxuICAgICAgICAgICAgICAgIGNvbG9yOiBoZXggY29kZSBvciBUSFJFRS5Db2xvcigpXG4gICAgICAgICAgICAgICAgbGluZUpvaW46IFwiYmV2ZWxcIiBvciBcInJvdW5kXCIuIGRlZmF1bHQ6IHJvdW5kLiBEb24ndCBjaGFuZ2UgdGhpcyBhZnRlciBpbml0aWFsaXphdGlvbi5cbiAgICAgICAgICAgIH1cbiAgICAgICAgKi9cblxuICAgICAgICB0aGlzLl93aWR0aCA9IG9wdGlvbnMud2lkdGggIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMud2lkdGggOiA1O1xuICAgICAgICB0aGlzLl9vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm9wYWNpdHkgOiAxO1xuICAgICAgICB0aGlzLl9jb2xvciA9IG9wdGlvbnMuY29sb3IgIT09IHVuZGVmaW5lZCA/IG5ldyBUSFJFRS5Db2xvcihvcHRpb25zLmNvbG9yKSA6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSk7XG5cbiAgICAgICAgdGhpcy5saW5lSm9pblR5cGUgPSBvcHRpb25zLmxpbmVKb2luVHlwZSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5saW5lSm9pblR5cGUudG9VcHBlckNhc2UoKSA6IFwiQkVWRUxcIjtcbiAgICAgICAgaWYoTElORV9KT0lOX1RZUEVTW3RoaXMubGluZUpvaW5UeXBlXSA9PT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIHRoaXMubGluZUpvaW5UeXBlID0gXCJCRVZFTFwiO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSAwOyAvL3Nob3VsZCBhbHdheXMgYmUgZXF1YWwgdG8gdGhpcy5wb2ludHMubGVuZ3RoXG4gICAgICAgIHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbXTsgLy8gaG93IG1hbnkgdGltZXMgdG8gYmUgY2FsbGVkIGluIGVhY2ggZGlyZWN0aW9uXG4gICAgICAgIHRoaXMuX291dHB1dERpbWVuc2lvbnMgPSAzOyAvL2hvdyBtYW55IGRpbWVuc2lvbnMgcGVyIHBvaW50IHRvIHN0b3JlP1xuXG4gICAgICAgIHRoaXMuaW5pdCgpO1xuICAgIH1cbiAgICBpbml0KCl7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCk7XG4gICAgICAgIHRoaXMuX3ZlcnRpY2VzO1xuICAgICAgICB0aGlzLm1ha2VHZW9tZXRyeSgpO1xuXG5cbiAgICAgICAgLy9tYWtlIGEgZGVlcCBjb3B5IG9mIHRoZSB1bmlmb3JtcyB0ZW1wbGF0ZVxuICAgICAgICB0aGlzLl91bmlmb3JtcyA9IHt9O1xuICAgICAgICBmb3IodmFyIHVuaWZvcm1OYW1lIGluIHVuaWZvcm1zKXtcbiAgICAgICAgICAgIHRoaXMuX3VuaWZvcm1zW3VuaWZvcm1OYW1lXSA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiB1bmlmb3Jtc1t1bmlmb3JtTmFtZV0udHlwZSxcbiAgICAgICAgICAgICAgICB2YWx1ZTogdW5pZm9ybXNbdW5pZm9ybU5hbWVdLnZhbHVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLlNoYWRlck1hdGVyaWFsKHtcbiAgICAgICAgICAgIHNpZGU6IFRIUkVFLkJhY2tTaWRlLFxuICAgICAgICAgICAgdmVydGV4U2hhZGVyOiB2U2hhZGVyLCBcbiAgICAgICAgICAgIGZyYWdtZW50U2hhZGVyOiBmU2hhZGVyLFxuICAgICAgICAgICAgdW5pZm9ybXM6IHRoaXMuX3VuaWZvcm1zLFxuICAgICAgICAgICAgZXh0ZW5zaW9uczp7ZGVyaXZhdGl2ZXM6IHRydWUsfSxcbiAgICAgICAgICAgIGFscGhhVGVzdDogMC41LFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTWVzaCh0aGlzLl9nZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuICAgICAgICB0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvLyBzZXR0ZXIgc2V0cyB0cmFuc3BhcmVudCBmbGFnIGlmIG5lY2Vzc2FyeVxuICAgICAgICB0aGlzLmNvbG9yID0gdGhpcy5fY29sb3I7IC8vc2V0dGVyIHNldHMgY29sb3IgYXR0cmlidXRlXG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLm9wYWNpdHkudmFsdWUgPSB0aGlzLl9vcGFjaXR5O1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5saW5lV2lkdGgudmFsdWUgPSB0aGlzLl93aWR0aDtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMubGluZUpvaW5UeXBlLnZhbHVlID0gTElORV9KT0lOX1RZUEVTW3RoaXMubGluZUpvaW5UeXBlXTtcblxuICAgICAgICBnZXRUaHJlZUVudmlyb25tZW50KCkuc2NlbmUuYWRkKHRoaXMubWVzaCk7XG4gICAgfVxuXG4gICAgbWFrZUdlb21ldHJ5KCl7XG4gICAgICAgIGNvbnN0IE1BWF9QT0lOVFMgPSAxMDAwOyAvL3RoZXNlIGFycmF5cyBnZXQgZGlzY2FyZGVkIG9uIGZpcnN0IGFjdGl2YXRpb24gYW55d2F5c1xuICAgICAgICBjb25zdCBOVU1fUE9JTlRTX1BFUl9WRVJURVggPSA0O1xuXG4gICAgICAgIGxldCBudW1WZXJ0cyA9IChNQVhfUE9JTlRTLTEpKk5VTV9QT0lOVFNfUEVSX1ZFUlRFWDtcblxuICAgICAgICB0aGlzLl92ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIG51bVZlcnRzKTtcbiAgICAgICAgdGhpcy5fbmV4dFBvaW50VmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIHRoaXMuX3ByZXZQb2ludFZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl9vdXRwdXREaW1lbnNpb25zICogbnVtVmVydHMpO1xuICAgICAgICB0aGlzLl9jb2xvcnMgPSBuZXcgRmxvYXQzMkFycmF5KG51bVZlcnRzICogMyk7XG5cbiAgICAgICAgLy8gYnVpbGQgZ2VvbWV0cnlcblxuICAgICAgICB0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdwb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl92ZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ25leHRQb2ludFBvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX25leHRQb2ludFZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAncHJldmlvdXNQb2ludFBvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ByZXZQb2ludFZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnY29sb3InLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fY29sb3JzLCAzICkgKTtcblxuICAgICAgICB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vdXNlZCBkdXJpbmcgdXBkYXRlcyBhcyBhIHBvaW50ZXIgdG8gdGhlIGJ1ZmZlclxuICAgICAgICB0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cbiAgICB9XG4gICAgX29uQWRkKCl7XG4gICAgICAgIC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBEb21haW4gbm9kZSB3ZSdyZSByZW5kZXJpbmcgZnJvbVxuICAgICAgICBsZXQgcm9vdCA9IG51bGw7XG4gICAgICAgIHRyeXtcbiAgICAgICAgICAgcm9vdCA9IHRoaXMuZ2V0Q2xvc2VzdERvbWFpbigpO1xuICAgICAgICB9Y2F0Y2goZXJyb3Ipe1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICAvL3RvZG86IGltcGxlbWVudCBzb21ldGhpbmcgbGlrZSBhc3NlcnQgcm9vdCB0eXBlb2YgUm9vdE5vZGVcblxuICAgICAgICB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuICAgICAgICB0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcbiAgICB9XG4gICAgX29uRmlyc3RBY3RpdmF0aW9uKCl7XG4gICAgICAgIHRoaXMuX29uQWRkKCk7IC8vc2V0dXAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gYW5kIHRoaXMuaXRlbURpbWVuc2lvbnMuIHVzZWQgaGVyZSBhZ2FpbiBiZWNhdXNlIGNsb25pbmcgbWVhbnMgdGhlIG9uQWRkKCkgbWlnaHQgYmUgY2FsbGVkIGJlZm9yZSB0aGlzIGlzIGNvbm5lY3RlZCB0byBhIHR5cGUgb2YgZG9tYWluXG5cbiAgICAgICAgLy8gcGVyaGFwcyBpbnN0ZWFkIG9mIGdlbmVyYXRpbmcgYSB3aG9sZSBuZXcgYXJyYXksIHRoaXMgY2FuIHJldXNlIHRoZSBvbGQgb25lP1xuXG4gICAgICAgIGNvbnN0IE5VTV9QT0lOVFNfUEVSX0xJTkVfU0VHTUVOVCA9IDQ7IC8vNCB1c2VkIGZvciBiZXZlbGluZ1xuICAgICAgICBjb25zdCBudW1WZXJ0cyA9ICh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbikgKiBOVU1fUE9JTlRTX1BFUl9MSU5FX1NFR01FTlQ7XG5cbiAgICAgICAgbGV0IHZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSggdGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIG51bVZlcnRzKTtcbiAgICAgICAgbGV0IG5leHRWZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIGxldCBwcmV2VmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICogbnVtVmVydHMpO1xuICAgICAgICBsZXQgY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheSggMyAqIG51bVZlcnRzKTtcblxuICAgICAgICBsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuICAgICAgICB0aGlzLl92ZXJ0aWNlcyA9IHZlcnRpY2VzO1xuICAgICAgICBwb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl92ZXJ0aWNlcyk7XG5cbiAgICAgICAgbGV0IHByZXZQb2ludFBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wcmV2aW91c1BvaW50UG9zaXRpb247XG4gICAgICAgIHRoaXMuX3ByZXZQb2ludFZlcnRpY2VzID0gcHJldlZlcnRpY2VzO1xuICAgICAgICBwcmV2UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcyk7XG5cbiAgICAgICAgbGV0IG5leHRQb2ludFBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5uZXh0UG9pbnRQb3NpdGlvbjtcbiAgICAgICAgdGhpcy5fbmV4dFBvaW50VmVydGljZXMgPSBuZXh0VmVydGljZXM7XG4gICAgICAgIG5leHRQb2ludFBvc2l0aW9uQXR0cmlidXRlLnNldEFycmF5KHRoaXMuX25leHRQb2ludFZlcnRpY2VzKTtcblxuICAgICAgICBsZXQgY29sb3JBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLmNvbG9yO1xuICAgICAgICB0aGlzLl9jb2xvcnMgPSBjb2xvcnM7XG4gICAgICAgIGNvbG9yQXR0cmlidXRlLnNldEFycmF5KHRoaXMuX2NvbG9ycyk7XG5cbiAgICAgICAgLy91c2VkIHRvIGRpZmZlcmVudGlhdGUgdGhlIGxlZnQgYm9yZGVyIG9mIHRoZSBsaW5lIGZyb20gdGhlIHJpZ2h0IGJvcmRlclxuICAgICAgICBsZXQgZGlyZWN0aW9uID0gbmV3IEZsb2F0MzJBcnJheShudW1WZXJ0cyk7XG4gICAgICAgIGZvcihsZXQgaT0wOyBpPG51bVZlcnRzO2krKyl7XG4gICAgICAgICAgICBkaXJlY3Rpb25baV0gPSBpJTI9PTAgPyAxIDogMDsgLy9hbHRlcm5hdGUgLTEgYW5kIDFcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdkaXJlY3Rpb24nLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggZGlyZWN0aW9uLCAxKSApO1xuXG4gICAgICAgIC8vdXNlZCB0byBkaWZmZXJlbnRpYXRlIHRoZSBwb2ludHMgd2hpY2ggbW92ZSB0b3dhcmRzIHByZXYgdmVydGV4IGZyb20gcG9pbnRzIHdoaWNoIG1vdmUgdG93YXJkcyBuZXh0IHZlcnRleFxuICAgICAgICBsZXQgbmV4dE9yUHJldiA9IG5ldyBGbG9hdDMyQXJyYXkobnVtVmVydHMpO1xuICAgICAgICBmb3IobGV0IGk9MDsgaTxudW1WZXJ0cztpKyspe1xuICAgICAgICAgICAgbmV4dE9yUHJldltpXSA9IGklNDwyID8gMCA6IDE7IC8vYWx0ZXJuYXRlIDAsMCwgMSwxXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4JywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIG5leHRPclByZXYsIDEpICk7XG5cbiAgICAgICAgLy9pbmRpY2VzXG4gICAgICAgIC8qXG4gICAgICAgIEZvciBlYWNoIHZlcnRleCwgd2UgY29ubmVjdCBpdCB0byB0aGUgbmV4dCB2ZXJ0ZXggbGlrZSB0aGlzOlxuICAgICAgICBuIC0tbisyLS1uKzQtLW4rNlxuICAgICAgICB8ICAvICB8IC8gfCAgLyAgfFxuICAgICAgIG4rMSAtLW4rMy0tbis1LS1uKzdcblxuICAgICAgIHB0MSAgIHB0MiBwdDIgICBwdDNcblxuICAgICAgIHZlcnRpY2VzIG4sbisxIGFyZSBhcm91bmQgcG9pbnQgMSwgbisyLG4rMyxuKzQsbis1IGFyZSBhcm91bmQgcHQyLCBuKzYsbis3IGFyZSBmb3IgcG9pbnQzLiB0aGUgbWlkZGxlIHNlZ21lbnQgKG4rMi1uKzUpIGlzIHRoZSBwb2x5Z29uIHVzZWQgZm9yIGJldmVsaW5nIGF0IHBvaW50IDIuXG5cbiAgICAgICAgdGhlbiB3ZSBhZHZhbmNlIG4gdHdvIGF0IGEgdGltZSB0byBtb3ZlIHRvIHRoZSBuZXh0IHZlcnRleC4gdmVydGljZXMgbiwgbisxIHJlcHJlc2VudCB0aGUgc2FtZSBwb2ludDtcbiAgICAgICAgdGhleSdyZSBzZXBhcmF0ZWQgaW4gdGhlIHZlcnRleCBzaGFkZXIgdG8gYSBjb25zdGFudCBzY3JlZW5zcGFjZSB3aWR0aCAqL1xuICAgICAgICBsZXQgaW5kaWNlcyA9IFtdO1xuICAgICAgICBmb3IobGV0IHZlcnROdW09MDt2ZXJ0TnVtPCh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbi0xKTt2ZXJ0TnVtICs9MSl7IC8vbm90IHN1cmUgd2h5IHRoaXMgLTMgaXMgdGhlcmUuIGkgZ3Vlc3MgaXQgc3RvcHMgdmVydE51bSszIHR3byBsaW5lcyBkb3duIGZyb20gZ29pbmcgc29tZXdoZXJlIGl0IHNob3VsZG4ndD9cbiAgICAgICAgICAgIGxldCBmaXJzdENvb3JkaW5hdGUgPSB2ZXJ0TnVtICUgdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXTtcbiAgICAgICAgICAgIGxldCBlbmRpbmdOZXdMaW5lID0gZmlyc3RDb29yZGluYXRlID09IHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0tMTtcbiAgICBcbiAgICAgICAgICAgIGxldCB2ZXJ0SW5kZXggPSB2ZXJ0TnVtICogTlVNX1BPSU5UU19QRVJfTElORV9TRUdNRU5UO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZighZW5kaW5nTmV3TGluZSl7XG4gICAgICAgICAgICAgICAgLy90aGVzZSB0cmlhbmdsZXMgc2hvdWxkIGJlIGRpc2FibGVkIHdoZW4gZG9pbmcgcm91bmQgam9pbnNcbiAgICAgICAgICAgICAgICBpZih0aGlzLmxpbmVKb2luVHlwZSA9PSBcIkJFVkVMXCIpe1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goIHZlcnRJbmRleCsxLCB2ZXJ0SW5kZXgsICAgdmVydEluZGV4KzIpO1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goIHZlcnRJbmRleCsxLCB2ZXJ0SW5kZXgrMiwgdmVydEluZGV4KzMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCggdmVydEluZGV4KzMsIHZlcnRJbmRleCsyLCB2ZXJ0SW5kZXgrNCk7XG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKCB2ZXJ0SW5kZXgrMywgdmVydEluZGV4KzQsIHZlcnRJbmRleCs1KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9nZW9tZXRyeS5zZXRJbmRleCggaW5kaWNlcyApO1xuXG4gICAgICAgIHRoaXMuc2V0QWxsVmVydGljZXNUb0NvbG9yKHRoaXMuY29sb3IpO1xuXG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgY29sb3JBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgIH1cbiAgICBldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG4gICAgICAgIGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTsgICAgXG4gICAgICAgIH1cblxuICAgICAgICAvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cbiAgICAgICAgLy9hc3NlcnQgaSA8IHZlcnRpY2VzLmNvdW50XG5cbiAgICAgICAgbGV0IHhWYWx1ZSA9ICB4ID09PSB1bmRlZmluZWQgPyAwIDogeDtcbiAgICAgICAgbGV0IHlWYWx1ZSA9ICB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcbiAgICAgICAgbGV0IHpWYWx1ZSA9ICB6ID09PSB1bmRlZmluZWQgPyAwIDogejtcblxuICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCwgeFZhbHVlLHlWYWx1ZSx6VmFsdWUpO1xuXG4gICAgICAgIC8qIHdlJ3JlIGRyYXdpbmcgbGlrZSB0aGlzOlxuICAgICAgICAqLS0tLSotLS0tKlxuXG4gICAgICAgICotLS0tKi0tLS0qXG4gICAgXG4gICAgICAgIGJ1dCB3ZSBkb24ndCB3YW50IHRvIGluc2VydCBhIGRpYWdvbmFsIGxpbmUgYW55d2hlcmUuIFRoaXMgaGFuZGxlcyB0aGF0OiAgKi9cblxuICAgICAgICBsZXQgZmlyc3RDb29yZGluYXRlID0gaSAlIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG5cbiAgICAgICAgLy9ib29sZWFuIHZhcmlhYmxlcy4gaWYgaW4gdGhlIGZ1dHVyZSBMaW5lT3V0cHV0IGNhbiBzdXBwb3J0IHZhcmlhYmxlLXdpZHRoIGxpbmVzLCB0aGVzZSBzaG91bGQgZWIgY2hhbmdlZFxuICAgICAgICBsZXQgc3RhcnRpbmdOZXdMaW5lID0gZmlyc3RDb29yZGluYXRlID09IDA7XG4gICAgICAgIGxldCBlbmRpbmdOZXdMaW5lID0gZmlyc3RDb29yZGluYXRlID09IHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0tMTtcblxuICAgICAgICBpZihzdGFydGluZ05ld0xpbmUpe1xuICAgICAgICAgICAgLy9tYWtlIHRoZSBwcmV2UG9pbnQgYmUgdGhlIHNhbWUgcG9pbnQgYXMgdGhpc1xuICAgICAgICAgICAgdGhpcy5zYXZlVmVydGV4SW5mb0luQnVmZmVycyh0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcywgdGhpcy5fY3VycmVudFBvaW50SW5kZXgsIHhWYWx1ZSx5VmFsdWUselZhbHVlKTtcbiAgICAgICAgfWVsc2V7XG5cbiAgICAgICAgICAgIGxldCBwcmV2WCA9IHRoaXMuX3ZlcnRpY2VzWyh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0xKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjRdO1xuICAgICAgICAgICAgbGV0IHByZXZZID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTEpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNCsxXTtcbiAgICAgICAgICAgIGxldCBwcmV2WiA9IHRoaXMuX3ZlcnRpY2VzWyh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0xKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjQrMl07XG5cbiAgICAgICAgICAgIC8vc2V0IHRoaXMgdGhpbmcncyBwcmV2UG9pbnQgdG8gdGhlIHByZXZpb3VzIHZlcnRleFxuICAgICAgICAgICAgdGhpcy5zYXZlVmVydGV4SW5mb0luQnVmZmVycyh0aGlzLl9wcmV2UG9pbnRWZXJ0aWNlcywgdGhpcy5fY3VycmVudFBvaW50SW5kZXgsIHByZXZYLHByZXZZLHByZXZaKTtcblxuICAgICAgICAgICAgLy9zZXQgdGhlIFBSRVZJT1VTIHBvaW50J3MgbmV4dFBvaW50IHRvIHRvIFRISVMgdmVydGV4LlxuICAgICAgICAgICAgdGhpcy5zYXZlVmVydGV4SW5mb0luQnVmZmVycyh0aGlzLl9uZXh0UG9pbnRWZXJ0aWNlcywgdGhpcy5fY3VycmVudFBvaW50SW5kZXgtMSwgeFZhbHVlLHlWYWx1ZSx6VmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoZW5kaW5nTmV3TGluZSl7XG4gICAgICAgICAgICAvL21ha2UgdGhlIG5leHRQb2ludCBiZSB0aGUgc2FtZSBwb2ludCBhcyB0aGlzXG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX25leHRQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCwgeFZhbHVlLHlWYWx1ZSx6VmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4Kys7XG4gICAgfVxuXG4gICAgc2F2ZVZlcnRleEluZm9JbkJ1ZmZlcnMoYXJyYXksIHZlcnROdW0sIHZhbHVlMSx2YWx1ZTIsdmFsdWUzKXtcbiAgICAgICAgLy9mb3IgZXZlcnkgY2FsbCB0byBhY3RpdmF0ZSgpLCBhbGwgNCBnZW9tZXRyeSB2ZXJ0aWNlcyByZXByZXNlbnRpbmcgdGhhdCBwb2ludCBuZWVkIHRvIHNhdmUgdGhhdCBpbmZvLlxuICAgICAgICAvL1RoZXJlZm9yZSwgdGhpcyBmdW5jdGlvbiB3aWxsIHNwcmVhZCB0aHJlZSBjb29yZGluYXRlcyBpbnRvIGEgZ2l2ZW4gYXJyYXksIHJlcGVhdGVkbHkuXG5cbiAgICAgICAgbGV0IGluZGV4ID0gdmVydE51bSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjQ7XG5cbiAgICAgICAgYXJyYXlbaW5kZXhdICAgPSB2YWx1ZTFcbiAgICAgICAgYXJyYXlbaW5kZXgrMV0gPSB2YWx1ZTJcbiAgICAgICAgYXJyYXlbaW5kZXgrMl0gPSB2YWx1ZTNcblxuICAgICAgICBhcnJheVtpbmRleCszXSA9IHZhbHVlMVxuICAgICAgICBhcnJheVtpbmRleCs0XSA9IHZhbHVlMlxuICAgICAgICBhcnJheVtpbmRleCs1XSA9IHZhbHVlM1xuXG4gICAgICAgIGFycmF5W2luZGV4KzZdID0gdmFsdWUxXG4gICAgICAgIGFycmF5W2luZGV4KzddID0gdmFsdWUyXG4gICAgICAgIGFycmF5W2luZGV4KzhdID0gdmFsdWUzXG5cbiAgICAgICAgYXJyYXlbaW5kZXgrOV0gID0gdmFsdWUxXG4gICAgICAgIGFycmF5W2luZGV4KzEwXSA9IHZhbHVlMlxuICAgICAgICBhcnJheVtpbmRleCsxMV0gPSB2YWx1ZTNcbiAgICAgICAgXG4gICAgfVxuICAgIG9uQWZ0ZXJBY3RpdmF0aW9uKCl7XG4gICAgICAgIGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgbGV0IHByZXZQb2ludFBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wcmV2aW91c1BvaW50UG9zaXRpb247XG4gICAgICAgIHByZXZQb2ludFBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgbGV0IG5leHRQb2ludFBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5uZXh0UG9pbnRQb3NpdGlvbjtcbiAgICAgICAgbmV4dFBvaW50UG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG4gICAgICAgIC8vdXBkYXRlIGFzcGVjdCByYXRpby4gaW4gdGhlIGZ1dHVyZSBwZXJoYXBzIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2hhbmdlZCB3aGVuIHRoZSBhc3BlY3QgcmF0aW8gY2hhbmdlcyBzbyBpdCdzIG5vdCBiZWluZyBkb25lIHBlciBmcmFtZT9cbiAgICAgICAgaWYodGhpcy5fdW5pZm9ybXMpe1xuICAgICAgICAgICAgY29uc3QgdGhyZWUgPSBnZXRUaHJlZUVudmlyb25tZW50KCk7XG4gICAgICAgICAgICB0aGlzLl91bmlmb3Jtcy5hc3BlY3QudmFsdWUgPSB0aHJlZS5jYW1lcmEuYXNwZWN0OyAvL1RPRE86IHJlLWVuYWJsZSBvbmNlIGRlYnVnZ2luZyBpcyBkb25lXG4gICAgICAgICAgICB0aHJlZS5yZW5kZXJlci5nZXREcmF3aW5nQnVmZmVyU2l6ZSh0aGlzLl91bmlmb3Jtcy5zY3JlZW5TaXplLnZhbHVlKTsgLy9tb2RpZmllcyB1bmlmb3JtIGluIHBsYWNlXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vcmVzZXQgYWZ0ZXIgZWFjaCB1cGRhdGVcbiAgICB9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICBnZXRUaHJlZUVudmlyb25tZW50KCkuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG4gICAgfVxuICAgIHNldEFsbFZlcnRpY2VzVG9Db2xvcihjb2xvcil7XG4gICAgICAgIGNvbnN0IGNvbCA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG4gICAgICAgIGNvbnN0IG51bVZlcnRpY2VzID0gKHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLTEpKjI7XG4gICAgICAgIGZvcihsZXQgaT0wOyBpPG51bVZlcnRpY2VzO2krKyl7XG4gICAgICAgICAgICAvL0Rvbid0IGZvcmdldCBzb21lIHBvaW50cyBhcHBlYXIgdHdpY2UgLSBhcyB0aGUgZW5kIG9mIG9uZSBsaW5lIHNlZ21lbnQgYW5kIHRoZSBiZWdpbm5pbmcgb2YgdGhlIG5leHQuXG4gICAgICAgICAgICB0aGlzLl9zZXRDb2xvckZvclZlcnRleFJHQihpLCBjb2wuciwgY29sLmcsIGNvbC5iKTtcbiAgICAgICAgfVxuICAgICAgICAvL3RlbGwgdGhyZWUuanMgdG8gdXBkYXRlIGNvbG9yc1xuICAgIH1cbiAgICBfc2V0Q29sb3JGb3JWZXJ0ZXgodmVydGV4SW5kZXgsIGNvbG9yKXtcbiAgICAgICAgLy9jb2xvciBpcyBhIFRIUkVFLkNvbG9yIGhlcmVcbiAgICAgICAgdGhpcy5fc2V0Q29sb3JGb3JWZXJ0ZXhSR0IodmVydGV4SW5kZXgsIGNvbG9yLnIsIGNvbG9yLmcsIGNvbG9yLmIpO1xuICAgIH1cbiAgICBfc2V0Q29sb3JGb3JWZXJ0ZXhSR0IodmVydGV4SW5kZXgsIG5vcm1hbGl6ZWRSLCBub3JtYWxpemVkRywgbm9ybWFsaXplZEIpe1xuICAgICAgICAvL2FsbCBvZiBub3JtYWxpemVkUiwgbm9ybWFsaXplZEcsIG5vcm1hbGl6ZWRCIGFyZSAwLTEuXG4gICAgICAgIGxldCBjb2xvckFycmF5ID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvci5hcnJheTtcbiAgICAgICAgbGV0IGluZGV4ID0gdmVydGV4SW5kZXggKiAzICogNDsgLy8qMyBiZWNhdXNlIGNvbG9ycyBoYXZlIDMgY2hhbm5lbHMsICo0IGJlY2F1c2UgNCB2ZXJ0aWNlcy9saW5lIHBvaW50XG5cbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDBdID0gbm9ybWFsaXplZFI7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAxXSA9IG5vcm1hbGl6ZWRHO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgMl0gPSBub3JtYWxpemVkQjtcblxuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgM10gPSBub3JtYWxpemVkUjtcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDRdID0gbm9ybWFsaXplZEc7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyA1XSA9IG5vcm1hbGl6ZWRCO1xuXG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyA2XSA9IG5vcm1hbGl6ZWRSO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgN10gPSBub3JtYWxpemVkRztcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDhdID0gbm9ybWFsaXplZEI7XG5cbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDldID0gbm9ybWFsaXplZFI7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAxMF0gPSBub3JtYWxpemVkRztcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDExXSA9IG5vcm1hbGl6ZWRCO1xuXG4gICAgICAgIGxldCBjb2xvckF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMuY29sb3I7XG4gICAgICAgIGNvbG9yQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICB9XG4gICAgc2V0IGNvbG9yKGNvbG9yKXtcbiAgICAgICAgLy9jdXJyZW50bHkgb25seSBhIHNpbmdsZSBjb2xvciBpcyBzdXBwb3J0ZWQuXG4gICAgICAgIC8vSSBzaG91bGQgcmVhbGx5IG1ha2UgaXQgcG9zc2libGUgdG8gc3BlY2lmeSBjb2xvciBieSBhIGZ1bmN0aW9uLlxuICAgICAgICB0aGlzLl9jb2xvciA9IGNvbG9yO1xuICAgICAgICB0aGlzLnNldEFsbFZlcnRpY2VzVG9Db2xvcihjb2xvcik7XG4gICAgfVxuICAgIGdldCBjb2xvcigpe1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuICAgIHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuICAgICAgICAvL21lc2ggaXMgYWx3YXlzIHRyYW5zcGFyZW50XG4gICAgICAgIHRoaXMubWF0ZXJpYWwub3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMSB8fCB0aGlzLmxpbmVKb2luVHlwZSA9PSBcIlJPVU5EXCI7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuICAgICAgICB0aGlzLl9vcGFjaXR5ID0gb3BhY2l0eTtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMub3BhY2l0eS52YWx1ZSA9IG9wYWNpdHk7XG4gICAgfVxuICAgIGdldCBvcGFjaXR5KCl7XG4gICAgICAgIHJldHVybiB0aGlzLl9vcGFjaXR5O1xuICAgIH1cbiAgICBzZXQgd2lkdGgod2lkdGgpe1xuICAgICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5saW5lV2lkdGgudmFsdWUgPSB3aWR0aDtcbiAgICB9XG4gICAgZ2V0IHdpZHRoKCl7XG4gICAgICAgIHJldHVybiB0aGlzLl93aWR0aDtcbiAgICB9XG4gICAgY2xvbmUoKXtcbiAgICAgICAgcmV0dXJuIG5ldyBMaW5lT3V0cHV0KHt3aWR0aDogdGhpcy53aWR0aCwgY29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eSwgbGluZUpvaW5UeXBlOiB0aGlzLmxpbmVKb2luVHlwZX0pO1xuICAgIH1cbn1cblxuZXhwb3J0IHtMaW5lT3V0cHV0fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmNsYXNzIFBvaW50T3V0cHV0IGV4dGVuZHMgT3V0cHV0Tm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcblx0XHRzdXBlcigpO1xuXHRcdC8qXG5cdFx0XHR3aWR0aDogbnVtYmVyXG5cdFx0XHRjb2xvcjogaGV4IGNvbG9yLCBhcyBpbiAweHJyZ2diYi4gVGVjaG5pY2FsbHksIHRoaXMgaXMgYSBKUyBpbnRlZ2VyLlxuXHRcdFx0b3BhY2l0eTogMC0xLiBPcHRpb25hbC5cblx0XHQqL1xuXG5cdFx0dGhpcy5fd2lkdGggPSBvcHRpb25zLndpZHRoICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLndpZHRoIDogMTtcblx0XHR0aGlzLl9jb2xvciA9IG9wdGlvbnMuY29sb3IgIT09IHVuZGVmaW5lZCA/IG5ldyBUSFJFRS5Db2xvcihvcHRpb25zLmNvbG9yKSA6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSk7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcblxuXHRcdHRoaXMucG9pbnRzID0gW107XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7Y29sb3I6IHRoaXMuX2NvbG9yfSk7XG4gICAgICAgIHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vdHJpZ2dlciBzZXR0ZXIgdG8gc2V0IHRoaXMubWF0ZXJpYWwncyBvcGFjaXR5IHByb3Blcmx5XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IDA7IC8vc2hvdWxkIGFsd2F5cyBiZSBlcXVhbCB0byB0aGlzLnBvaW50cy5sZW5ndGhcblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cdH1cblx0X29uQWRkKCl7IC8vc2hvdWxkIGJlIGNhbGxlZCB3aGVuIHRoaXMgaXMgLmFkZCgpZWQgdG8gc29tZXRoaW5nXG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIEFyZWFcblx0XHRsZXQgcm9vdCA9IHRoaXMuZ2V0Q2xvc2VzdERvbWFpbigpO1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblxuXHRcdGlmKHRoaXMucG9pbnRzLmxlbmd0aCA8IHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uKXtcblx0XHRcdGZvcih2YXIgaT10aGlzLnBvaW50cy5sZW5ndGg7aTx0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbjtpKyspe1xuXHRcdFx0XHR0aGlzLnBvaW50cy5wdXNoKG5ldyBQb2ludE1lc2goe3dpZHRoOiAxLG1hdGVyaWFsOnRoaXMubWF0ZXJpYWx9KSk7XG5cdFx0XHRcdHRoaXMucG9pbnRzW2ldLm1lc2guc2NhbGUuc2V0U2NhbGFyKHRoaXMuX3dpZHRoKTsgLy9zZXQgd2lkdGggYnkgc2NhbGluZyBwb2ludFxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcblx0XHRpZih0aGlzLnBvaW50cy5sZW5ndGggPCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbil0aGlzLl9vbkFkZCgpO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHRpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7XHRcblx0XHR9XG5cdFx0Ly9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuXHRcdHZhciBwb2ludCA9IHRoaXMuZ2V0UG9pbnQoaSk7XG5cdFx0cG9pbnQueCA9IHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuXHRcdHBvaW50LnkgPSB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcblx0XHRwb2ludC56ID0geiA9PT0gdW5kZWZpbmVkID8gMCA6IHo7XG5cdH1cblx0Z2V0UG9pbnQoaSl7XG5cdFx0cmV0dXJuIHRoaXMucG9pbnRzW2ldO1xuXHR9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5wb2ludHMubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLnBvaW50c1tpXS5yZW1vdmVTZWxmRnJvbVNjZW5lKCk7XG5cdFx0fVxuICAgIH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0Ly90ZWNobmljYWxseSB0aGlzIHNldHMgYWxsIHBvaW50cyB0byB0aGUgc2FtZSBjb2xvci4gVG9kbzogYWxsb3cgZGlmZmVyZW50IHBvaW50cyB0byBiZSBkaWZmZXJlbnRseSBjb2xvcmVkLlxuXHRcdFxuXHRcdGxldCBtYXQgPSB0aGlzLm1hdGVyaWFsO1xuXHRcdG1hdC5vcGFjaXR5ID0gb3BhY2l0eTsgLy9pbnN0YW50aWF0ZSB0aGUgcG9pbnRcblx0XHRtYXQudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMTtcbiAgICAgICAgbWF0LnZpc2libGUgPSBvcGFjaXR5ID4gMDtcblx0XHR0aGlzLl9vcGFjaXR5ID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdHNldCBjb2xvcihjb2xvcil7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuY29sb3IgPSBjb2xvcjtcblx0XHR0aGlzLl9jb2xvciA9IGNvbG9yO1xuXHR9XG5cdGdldCBjb2xvcigpe1xuXHRcdHJldHVybiB0aGlzLl9jb2xvcjtcblx0fVxuXHRzZXQgd2lkdGgod2lkdGgpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5wb2ludHMubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmdldFBvaW50KGkpLm1lc2guc2NhbGUuc2V0U2NhbGFyKHdpZHRoKTtcblx0XHR9XG5cdFx0dGhpcy5fd2lkdGggPSB3aWR0aDtcblx0fVxuXHRnZXQgd2lkdGgoKXtcblx0XHRyZXR1cm4gdGhpcy5fd2lkdGg7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IFBvaW50T3V0cHV0KHt3aWR0aDogdGhpcy53aWR0aCwgY29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eX0pO1xuXHR9XG59XG5cblxuY2xhc3MgUG9pbnRNZXNoe1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHQvKm9wdGlvbnM6XG5cdFx0XHR4LHk6IG51bWJlcnNcblx0XHRcdHdpZHRoOiBudW1iZXJcbiAgICAgICAgICAgIG1hdGVyaWFsOiBcblx0XHQqL1xuXG5cdFx0bGV0IHdpZHRoID0gb3B0aW9ucy53aWR0aCA9PT0gdW5kZWZpbmVkID8gMSA6IG9wdGlvbnMud2lkdGhcbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG9wdGlvbnMubWF0ZXJpYWw7IC8vb25lIG1hdGVyaWFsIHBlciBQb2ludE91dHB1dFxuXG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5zaGFyZWRDaXJjbGVHZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi5zZXQodGhpcy54LHRoaXMueSx0aGlzLnopO1xuXHRcdHRoaXMubWVzaC5zY2FsZS5zZXRTY2FsYXIodGhpcy53aWR0aC8yKTtcblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXG5cdFx0dGhpcy54ID0gb3B0aW9ucy54IHx8IDA7XG5cdFx0dGhpcy55ID0gb3B0aW9ucy55IHx8IDA7XG5cdFx0dGhpcy56ID0gb3B0aW9ucy56IHx8IDA7XG5cdH1cblx0cmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuXHRcdHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG5cdH1cblx0c2V0IHgoaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnggPSBpO1xuXHR9XG5cdHNldCB5KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi55ID0gaTtcblx0fVxuXHRzZXQgeihpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueiA9IGk7XG5cdH1cblx0Z2V0IHgoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLng7XG5cdH1cblx0Z2V0IHkoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLnk7XG5cdH1cblx0Z2V0IHooKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLno7XG5cdH1cbn1cblBvaW50TWVzaC5wcm90b3R5cGUuc2hhcmVkQ2lyY2xlR2VvbWV0cnkgPSBuZXcgVEhSRUUuU3BoZXJlR2VvbWV0cnkoMS8yLCA4LCA2KTsgLy9yYWRpdXMgMS8yIG1ha2VzIGRpYW1ldGVyIDEsIHNvIHRoYXQgc2NhbGluZyBieSBuIG1lYW5zIHdpZHRoPW5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RQb2ludCgpe1xuXHR2YXIgeCA9IG5ldyBFWFAuQXJlYSh7Ym91bmRzOiBbWy0xMCwxMF1dfSk7XG5cdHZhciB5ID0gbmV3IEVYUC5UcmFuc2Zvcm1hdGlvbih7J2V4cHInOiAoeCkgPT4geCp4fSk7XG5cdHZhciB5ID0gbmV3IEVYUC5Qb2ludE91dHB1dCgpO1xuXHR4LmFkZCh5KTtcblx0eS5hZGQoeik7XG5cdHguYWN0aXZhdGUoKTtcbn1cblxuZXhwb3J0IHtQb2ludE91dHB1dCwgUG9pbnRNZXNofVxuIiwiaW1wb3J0IHsgTGluZU91dHB1dCB9IGZyb20gJy4vTGluZU91dHB1dC5qcyc7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gJy4uL3V0aWxzLmpzJztcbmltcG9ydCB7IHRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxuZXhwb3J0IGNsYXNzIFZlY3Rvck91dHB1dCBleHRlbmRzIExpbmVPdXRwdXR7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcbiAgICAgICAgLypcbiAgICAgICAgICAgICAgICB3aWR0aDogbnVtYmVyLiB1bml0cyBhcmUgaW4gc2NyZWVuWS80MDAuXG4gICAgICAgICAgICAgICAgb3BhY2l0eTogbnVtYmVyXG4gICAgICAgICAgICAgICAgY29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcbiAgICAgICAgICAgICAgICBsaW5lSm9pbjogXCJiZXZlbFwiIG9yIFwicm91bmRcIi4gZGVmYXVsdDogcm91bmQuIERvbid0IGNoYW5nZSB0aGlzIGFmdGVyIGluaXRpYWxpemF0aW9uLlxuICAgICAgICAqL1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIH1cbiAgICBpbml0KCl7XG4gICAgICAgIHRoaXMuYXJyb3dNYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7Y29sb3I6IHRoaXMuX2NvbG9yLCBsaW5ld2lkdGg6IHRoaXMuX3dpZHRoLCBvcGFjaXR5OnRoaXMuX29wYWNpdHl9KTtcblxuICAgICAgICBzdXBlci5pbml0KCk7XG4gICAgICAgIHRoaXMuYXJyb3doZWFkcyA9IFtdO1xuXG4gICAgICAgIC8vVE9ETzogbWFrZSB0aGUgYXJyb3cgdGlwIGNvbG9ycyBtYXRjaCB0aGUgY29sb3JzIG9mIHRoZSBsaW5lcycgdGlwc1xuXG4gICAgICAgIGNvbnN0IGNpcmNsZVJlc29sdXRpb24gPSAxMjtcbiAgICAgICAgY29uc3QgYXJyb3doZWFkU2l6ZSA9IDAuMztcbiAgICAgICAgY29uc3QgRVBTSUxPTiA9IDAuMDAwMDE7XG4gICAgICAgIHRoaXMuRVBTSUxPTiA9IEVQU0lMT047XG5cbiAgICAgICAgdGhpcy5jb25lR2VvbWV0cnkgPSBuZXcgVEhSRUUuQ3lsaW5kZXJCdWZmZXJHZW9tZXRyeSggMCwgYXJyb3doZWFkU2l6ZSwgYXJyb3doZWFkU2l6ZSoxLjcsIGNpcmNsZVJlc29sdXRpb24sIDEgKTtcbiAgICAgICAgbGV0IGFycm93aGVhZE92ZXJzaG9vdEZhY3RvciA9IDAuMTsgLy91c2VkIHNvIHRoYXQgdGhlIGxpbmUgd29uJ3QgcnVkZWx5IGNsaXAgdGhyb3VnaCB0aGUgcG9pbnQgb2YgdGhlIGFycm93aGVhZFxuICAgICAgICB0aGlzLmNvbmVHZW9tZXRyeS50cmFuc2xhdGUoIDAsIC0gYXJyb3doZWFkU2l6ZSArIGFycm93aGVhZE92ZXJzaG9vdEZhY3RvciwgMCApO1xuICAgICAgICB0aGlzLl9jb25lVXBEaXJlY3Rpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygwLDEsMCk7XG4gICAgfVxuICAgIF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuICAgICAgICBzdXBlci5fb25GaXJzdEFjdGl2YXRpb24oKTtcblxuICAgICAgICBpZih0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aCA+IDEpe1xuICAgICAgICAgICAgdGhpcy5udW1BcnJvd2hlYWRzID0gdGhpcy5pdGVtRGltZW5zaW9ucy5zbGljZSgwLHRoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTEpLnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXJyZW50KXtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3VycmVudCArIHByZXY7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAvL2Fzc3VtZWQgaXRlbURpbWVuc2lvbnMgaXNuJ3QgYSBub256ZXJvIGFycmF5LiBUaGF0IHNob3VsZCBiZSB0aGUgY29uc3RydWN0b3IncyBwcm9ibGVtLlxuICAgICAgICAgICAgdGhpcy5udW1BcnJvd2hlYWRzID0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vcmVtb3ZlIGFueSBwcmV2aW91cyBhcnJvd2hlYWRzXG4gICAgICAgIGZvcih2YXIgaT0wO2k8dGhpcy5hcnJvd2hlYWRzLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgbGV0IGFycm93ID0gdGhpcy5hcnJvd2hlYWRzW2ldO1xuICAgICAgICAgICAgdGhyZWVFbnZpcm9ubWVudC5zY2VuZS5yZW1vdmUoYXJyb3cpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hcnJvd2hlYWRzID0gbmV3IEFycmF5KHRoaXMubnVtQXJyb3doZWFkcyk7XG4gICAgICAgIGZvcih2YXIgaT0wO2k8dGhpcy5udW1BcnJvd2hlYWRzO2krKyl7XG4gICAgICAgICAgICB0aGlzLmFycm93aGVhZHNbaV0gPSBuZXcgVEhSRUUuTWVzaCh0aGlzLmNvbmVHZW9tZXRyeSwgdGhpcy5hcnJvd01hdGVyaWFsKTtcbiAgICAgICAgICAgIHRoaXMubWVzaC5hZGQodGhpcy5hcnJvd2hlYWRzW2ldKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zb2xlLmxvZyhcIm51bWJlciBvZiBhcnJvd2hlYWRzICg9IG51bWJlciBvZiBsaW5lcyk6XCIrIHRoaXMubnVtQXJyb3doZWFkcyk7XG4gICAgfVxuICAgIGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcbiAgICAgICAgLy9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuICAgICAgICBzdXBlci5ldmFsdWF0ZVNlbGYoaSx0LHgseSx6KTtcblxuICAgICAgICBjb25zdCBsYXN0RGltZW5zaW9uTGVuZ3RoID0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXTtcbiAgICAgICAgbGV0IGZpcnN0Q29vcmRpbmF0ZSA9IGkgJSBsYXN0RGltZW5zaW9uTGVuZ3RoO1xuXG4gICAgICAgIC8vYm9vbGVhbiB2YXJpYWJsZXMuIGlmIGluIHRoZSBmdXR1cmUgTGluZU91dHB1dCBjYW4gc3VwcG9ydCB2YXJpYWJsZS13aWR0aCBsaW5lcywgdGhlc2Ugc2hvdWxkIGViIGNoYW5nZWRcbiAgICAgICAgbGV0IHN0YXJ0aW5nTmV3TGluZSA9IGZpcnN0Q29vcmRpbmF0ZSA9PSAwO1xuICAgICAgICBsZXQgZW5kaW5nTmV3TGluZSA9IGZpcnN0Q29vcmRpbmF0ZSA9PSBsYXN0RGltZW5zaW9uTGVuZ3RoLTE7XG5cbiAgICAgICAgaWYoZW5kaW5nTmV3TGluZSl7XG4gICAgICAgICAgICAvL3dlIG5lZWQgdG8gdXBkYXRlIGFycm93c1xuICAgICAgICAgICAgLy9jYWxjdWxhdGUgZGlyZWN0aW9uIG9mIGxhc3QgbGluZSBzZWdtZW50XG4gICAgICAgICAgICAvL3RoaXMgcG9pbnQgaXMgY3VycmVudFBvaW50SW5kZXgtMSBiZWNhdXNlIGN1cnJlbnRQb2ludEluZGV4IHdhcyBpbmNyZWFzZWQgYnkgMSBkdXJpbmcgc3VwZXIuZXZhbHVhdGVTZWxmKClcbiAgICAgICAgICAgIGxldCBpbmRleCA9ICh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0xKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjQ7XG5cbiAgICAgICAgICAgIGxldCBwcmV2WCA9IHRoaXMuX3ZlcnRpY2VzWyh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0yKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjRdO1xuICAgICAgICAgICAgbGV0IHByZXZZID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTIpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNCsxXTtcbiAgICAgICAgICAgIGxldCBwcmV2WiA9IHRoaXMuX3ZlcnRpY2VzWyh0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0yKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zKjQrMl07XG5cbiAgICAgICAgICAgIGxldCBkeCA9IHByZXZYIC0gdGhpcy5fdmVydGljZXNbaW5kZXhdO1xuICAgICAgICAgICAgbGV0IGR5ID0gcHJldlkgLSB0aGlzLl92ZXJ0aWNlc1tpbmRleCsxXTtcbiAgICAgICAgICAgIGxldCBkeiA9IHByZXZaIC0gdGhpcy5fdmVydGljZXNbaW5kZXgrMl07XG5cbiAgICAgICAgICAgIGxldCBsaW5lTnVtYmVyID0gTWF0aC5mbG9vcihpIC8gbGFzdERpbWVuc2lvbkxlbmd0aCk7XG4gICAgICAgICAgICBVdGlscy5hc3NlcnQobGluZU51bWJlciA8PSB0aGlzLm51bUFycm93aGVhZHMpOyAvL3RoaXMgbWF5IGJlIHdyb25nXG5cbiAgICAgICAgICAgIGxldCBkaXJlY3Rpb25WZWN0b3IgPSBuZXcgVEhSRUUuVmVjdG9yMygtZHgsLWR5LC1keik7XG5cbiAgICAgICAgICAgIC8vTWFrZSBhcnJvd3MgZGlzYXBwZWFyIGlmIHRoZSBsaW5lIGlzIHNtYWxsIGVub3VnaFxuICAgICAgICAgICAgLy9PbmUgd2F5IHRvIGRvIHRoaXMgd291bGQgYmUgdG8gc3VtIHRoZSBkaXN0YW5jZXMgb2YgYWxsIGxpbmUgc2VnbWVudHMuIEknbSBjaGVhdGluZyBoZXJlIGFuZCBqdXN0IG1lYXN1cmluZyB0aGUgZGlzdGFuY2Ugb2YgdGhlIGxhc3QgdmVjdG9yLCB0aGVuIG11bHRpcGx5aW5nIGJ5IHRoZSBudW1iZXIgb2YgbGluZSBzZWdtZW50cyAobmFpdmVseSBhc3N1bWluZyBhbGwgbGluZSBzZWdtZW50cyBhcmUgdGhlIHNhbWUgbGVuZ3RoKVxuICAgICAgICAgICAgbGV0IGxlbmd0aCA9IGRpcmVjdGlvblZlY3Rvci5sZW5ndGgoKSAqIChsYXN0RGltZW5zaW9uTGVuZ3RoLTEpO1xuXG4gICAgICAgICAgICBjb25zdCBlZmZlY3RpdmVEaXN0YW5jZSA9IDM7XG4gICAgICAgICAgICBsZXQgY2xhbXBlZExlbmd0aCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGxlbmd0aC9lZmZlY3RpdmVEaXN0YW5jZSwgMSkpO1xuXG4gICAgICAgICAgICAvL3NocmluayBmdW5jdGlvbiBkZXNpZ25lZCB0byBoYXZlIGEgc3RlZXAgc2xvcGUgY2xvc2UgdG8gMCBidXQgbWVsbG93IG91dCBhdCAwLjUgb3Igc28gaW4gb3JkZXIgdG8gYXZvaWQgdGhlIGxpbmUgd2lkdGggb3ZlcmNvbWluZyB0aGUgYXJyb3doZWFkIHdpZHRoXG4gICAgICAgICAgICAvL0luIENocm9tZSwgdGhyZWUuanMgY29tcGxhaW5zIHdoZW5ldmVyIHNvbWV0aGluZyBpcyBzZXQgdG8gMCBzY2FsZS4gQWRkaW5nIGFuIGVwc2lsb24gdGVybSBpcyB1bmZvcnR1bmF0ZSBidXQgbmVjZXNzYXJ5IHRvIGF2b2lkIGNvbnNvbGUgc3BhbS5cbiAgICAgICAgICAgIHRoaXMuYXJyb3doZWFkc1tsaW5lTnVtYmVyXS5zY2FsZS5zZXRTY2FsYXIoTWF0aC5hY29zKDEtMipjbGFtcGVkTGVuZ3RoKS9NYXRoLlBJICsgdGhpcy5FUFNJTE9OKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgIC8vcG9zaXRpb24vcm90YXRpb24gY29tZXMgYWZ0ZXIgc2luY2UgLm5vcm1hbGl6ZSgpIG1vZGlmaWVzIGRpcmVjdGlvblZlY3RvciBpbiBwbGFjZVxuICAgICAgICAgICAgbGV0IHBvcyA9IHRoaXMuYXJyb3doZWFkc1tsaW5lTnVtYmVyXS5wb3NpdGlvbjtcbiAgICAgICAgICAgIHBvcy54ID0geCA9PT0gdW5kZWZpbmVkID8gMCA6IHg7XG4gICAgICAgICAgICBwb3MueSA9IHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuICAgICAgICAgICAgcG9zLnogPSB6ID09PSB1bmRlZmluZWQgPyAwIDogejtcblxuICAgICAgICAgICAgaWYobGVuZ3RoID4gMCl7IC8vZGlyZWN0aW9uVmVjdG9yLm5vcm1hbGl6ZSgpIGZhaWxzIHdpdGggMCBsZW5ndGhcbiAgICAgICAgICAgICAgICB0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0ucXVhdGVybmlvbi5zZXRGcm9tVW5pdFZlY3RvcnModGhpcy5fY29uZVVwRGlyZWN0aW9uLCBkaXJlY3Rpb25WZWN0b3Iubm9ybWFsaXplKCkgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldCBjb2xvcihjb2xvcil7XG4gICAgICAgIC8vY3VycmVudGx5IG9ubHkgYSBzaW5nbGUgY29sb3IgaXMgc3VwcG9ydGVkLlxuICAgICAgICAvL0kgc2hvdWxkIHJlYWxseSBtYWtlIGl0IHBvc3NpYmxlIHRvIHNwZWNpZnkgY29sb3IgYnkgYSBmdW5jdGlvbi5cbiAgICAgICAgdGhpcy5fY29sb3IgPSBjb2xvcjtcbiAgICAgICAgdGhpcy5zZXRBbGxWZXJ0aWNlc1RvQ29sb3IoY29sb3IpO1xuICAgICAgICB0aGlzLmFycm93TWF0ZXJpYWwuY29sb3IgPSBuZXcgVEhSRUUuQ29sb3IodGhpcy5fY29sb3IpO1xuICAgIH1cblxuICAgIGdldCBjb2xvcigpe1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgc2V0IG9wYWNpdHkob3BhY2l0eSl7XG4gICAgICAgIHRoaXMuYXJyb3dNYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcbiAgICAgICAgdGhpcy5hcnJvd01hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMSB8fCB0aGlzLmxpbmVKb2luVHlwZSA9PSBcIlJPVU5EXCI7XG4gICAgICAgIHRoaXMuYXJyb3dNYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cbiAgICAgICAgLy9tZXNoIGlzIGFsd2F5cyB0cmFuc3BhcmVudFxuICAgICAgICB0aGlzLm1hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLm1hdGVyaWFsLnZpc2libGUgPSBvcGFjaXR5ID4gMDtcbiAgICAgICAgdGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLm9wYWNpdHkudmFsdWUgPSBvcGFjaXR5O1xuICAgIH1cblxuICAgIGdldCBvcGFjaXR5KCl7XG4gICAgICAgIHJldHVybiB0aGlzLl9vcGFjaXR5O1xuICAgIH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG4gICAgICAgIHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG4gICAgICAgIGZvcih2YXIgaT0wO2k8dGhpcy5udW1BcnJvd2hlYWRzO2krKyl7XG4gICAgICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLmFycm93aGVhZHNbaV0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNsb25lKCl7XG4gICAgICAgIHJldHVybiBuZXcgVmVjdG9yT3V0cHV0KHt3aWR0aDogdGhpcy53aWR0aCwgY29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eSxsaW5lSm9pblR5cGU6IHRoaXMubGluZUpvaW5UeXBlfSk7XG4gICAgfVxufVxuXG5cbiIsIi8vU3VyZmFjZU91dHB1dFNoYWRlcnMuanNcblxuLy9leHBlcmltZW50OiBzaGFkZXJzIHRvIGdldCB0aGUgdHJpYW5nbGUgcHVsc2F0aW5nIVxudmFyIHZTaGFkZXIgPSBbXG5cInZhcnlpbmcgdmVjMyB2Tm9ybWFsO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgdlBvc2l0aW9uO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgdlV2O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IHRpbWU7XCIsXG5cInVuaWZvcm0gdmVjMyBjb2xvcjtcIixcblwidW5pZm9ybSB2ZWMzIHZMaWdodDtcIixcblwidW5pZm9ybSBmbG9hdCBncmlkU3F1YXJlcztcIixcblxuXCJ2b2lkIG1haW4oKSB7XCIsXG5cdFwidlBvc2l0aW9uID0gcG9zaXRpb24ueHl6O1wiLFxuXHRcInZOb3JtYWwgPSBub3JtYWwueHl6O1wiLFxuXHRcInZVdiA9IHV2Lnh5O1wiLFxuXHRcImdsX1Bvc2l0aW9uID0gcHJvamVjdGlvbk1hdHJpeCAqXCIsXG4gICAgICAgICAgICBcIm1vZGVsVmlld01hdHJpeCAqXCIsXG4gICAgICAgICAgICBcInZlYzQocG9zaXRpb24sMS4wKTtcIixcblwifVwiXS5qb2luKFwiXFxuXCIpXG5cbnZhciBmU2hhZGVyID0gW1xuXCJ2YXJ5aW5nIHZlYzMgdk5vcm1hbDtcIixcblwidmFyeWluZyB2ZWMzIHZQb3NpdGlvbjtcIixcblwidmFyeWluZyB2ZWMyIHZVdjtcIixcblwidW5pZm9ybSBmbG9hdCB0aW1lO1wiLFxuXCJ1bmlmb3JtIHZlYzMgY29sb3I7XCIsXG5cInVuaWZvcm0gZmxvYXQgdXNlQ3VzdG9tR3JpZENvbG9yO1wiLFxuXCJ1bmlmb3JtIHZlYzMgZ3JpZENvbG9yO1wiLFxuXCJ1bmlmb3JtIHZlYzMgdkxpZ2h0O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGdyaWRTcXVhcmVzO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGxpbmVXaWR0aDtcIixcblwidW5pZm9ybSBmbG9hdCBzaG93R3JpZDtcIixcblwidW5pZm9ybSBmbG9hdCBzaG93U29saWQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcIixcblxuXHQvL3RoZSBmb2xsb3dpbmcgY29kZSBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS91bmNvbmVkL21hdGhib3gvYmxvYi9lYWViOGUxNWVmMmQwMjUyNzQwYTc0NTA1YTEyZDdhMTA1MWE2MWI2L3NyYy9zaGFkZXJzL2dsc2wvbWVzaC5mcmFnbWVudC5zaGFkZWQuZ2xzbFxuXCJ2ZWMzIG9mZlNwZWN1bGFyKHZlYzMgY29sb3IpIHtcIixcblwiICB2ZWMzIGMgPSAxLjAgLSBjb2xvcjtcIixcblwiICByZXR1cm4gMS4wIC0gYyAqIGM7XCIsXG5cIn1cIixcblxuXCJ2ZWM0IGdldFNoYWRlZENvbG9yKHZlYzQgcmdiYSkgeyBcIixcblwiICB2ZWMzIGNvbG9yID0gcmdiYS54eXo7XCIsXG5cIiAgdmVjMyBjb2xvcjIgPSBvZmZTcGVjdWxhcihyZ2JhLnh5eik7XCIsXG5cblwiICB2ZWMzIG5vcm1hbCA9IG5vcm1hbGl6ZSh2Tm9ybWFsKTtcIixcblwiICB2ZWMzIGxpZ2h0ID0gbm9ybWFsaXplKHZMaWdodCk7XCIsXG5cIiAgdmVjMyBwb3NpdGlvbiA9IG5vcm1hbGl6ZSh2UG9zaXRpb24pO1wiLFxuXG5cIiAgZmxvYXQgc2lkZSAgICA9IGdsX0Zyb250RmFjaW5nID8gLTEuMCA6IDEuMDtcIixcblwiICBmbG9hdCBjb3NpbmUgID0gc2lkZSAqIGRvdChub3JtYWwsIGxpZ2h0KTtcIixcblwiICBmbG9hdCBkaWZmdXNlID0gbWl4KG1heCgwLjAsIGNvc2luZSksIC41ICsgLjUgKiBjb3NpbmUsIC4xKTtcIixcblxuXCIgIGZsb2F0IHJpbUxpZ2h0aW5nID0gbWF4KG1pbigxLjAgLSBzaWRlKmRvdChub3JtYWwsIGxpZ2h0KSwgMS4wKSwwLjApO1wiLFxuXG5cIlx0ZmxvYXQgc3BlY3VsYXIgPSBtYXgoMC4wLCBhYnMoY29zaW5lKSAtIDAuNSk7XCIsIC8vZG91YmxlIHNpZGVkIHNwZWN1bGFyXG5cIiAgIHJldHVybiB2ZWM0KGRpZmZ1c2UqY29sb3IgKyAwLjkqcmltTGlnaHRpbmcqY29sb3IgKyAwLjQqY29sb3IyICogc3BlY3VsYXIsIHJnYmEuYSk7XCIsXG5cIn1cIixcblxuLy8gU21vb3RoIEhTViB0byBSR0IgY29udmVyc2lvbiBmcm9tIGh0dHBzOi8vd3d3LnNoYWRlcnRveS5jb20vdmlldy9Nc1MzV2NcblwidmVjMyBoc3YycmdiX3Ntb290aCggaW4gdmVjMyBjICl7XCIsXG5cIiAgICB2ZWMzIHJnYiA9IGNsYW1wKCBhYnMobW9kKGMueCo2LjArdmVjMygwLjAsNC4wLDIuMCksNi4wKS0zLjApLTEuMCwgMC4wLCAxLjAgKTtcIixcblwiXHRyZ2IgPSByZ2IqcmdiKigzLjAtMi4wKnJnYik7IC8vIGN1YmljIHNtb290aGluZ1x0XCIsXG5cIlx0cmV0dXJuIGMueiAqIG1peCggdmVjMygxLjApLCByZ2IsIGMueSk7XCIsXG5cIn1cIixcblxuLy9Gcm9tIFNhbSBIb2NldmFyOiBodHRwOi8vbG9sZW5naW5lLm5ldC9ibG9nLzIwMTMvMDcvMjcvcmdiLXRvLWhzdi1pbi1nbHNsXG5cInZlYzMgcmdiMmhzdih2ZWMzIGMpe1wiLFxuXCIgICAgdmVjNCBLID0gdmVjNCgwLjAsIC0xLjAgLyAzLjAsIDIuMCAvIDMuMCwgLTEuMCk7XCIsXG5cIiAgICB2ZWM0IHAgPSBtaXgodmVjNChjLmJnLCBLLnd6KSwgdmVjNChjLmdiLCBLLnh5KSwgc3RlcChjLmIsIGMuZykpO1wiLFxuXCIgICAgdmVjNCBxID0gbWl4KHZlYzQocC54eXcsIGMuciksIHZlYzQoYy5yLCBwLnl6eCksIHN0ZXAocC54LCBjLnIpKTtcIixcblxuXCIgICAgZmxvYXQgZCA9IHEueCAtIG1pbihxLncsIHEueSk7XCIsXG5cIiAgICBmbG9hdCBlID0gMS4wZS0xMDtcIixcblwiICAgIHJldHVybiB2ZWMzKGFicyhxLnogKyAocS53IC0gcS55KSAvICg2LjAgKiBkICsgZSkpLCBkIC8gKHEueCArIGUpLCBxLngpO1wiLFxuXCJ9XCIsXG4gLy9jaG9vc2VzIHRoZSBjb2xvciBmb3IgdGhlIGdyaWRsaW5lcyBieSB2YXJ5aW5nIGxpZ2h0bmVzcy4gXG4vL05PVCBjb250aW51b3VzIG9yIGVsc2UgYnkgdGhlIGludGVybWVkaWF0ZSBmdW5jdGlvbiB0aGVvcmVtIHRoZXJlJ2QgYmUgYSBwb2ludCB3aGVyZSB0aGUgZ3JpZGxpbmVzIHdlcmUgdGhlIHNhbWUgY29sb3IgYXMgdGhlIG1hdGVyaWFsLlxuXCJ2ZWMzIGdyaWRMaW5lQ29sb3IodmVjMyBjb2xvcil7XCIsXG5cIiB2ZWMzIGhzdiA9IHJnYjJoc3YoY29sb3IueHl6KTtcIixcblwiIC8vaHN2LnggKz0gMC4xO1wiLFxuXCIgaWYoaHN2LnogPCAwLjgpe2hzdi56ICs9IDAuMjt9ZWxzZXtoc3YueiA9IDAuODUtMC4xKmhzdi56O2hzdi55IC09IDAuMDt9XCIsXG5cIiByZXR1cm4gaHN2MnJnYl9zbW9vdGgoaHN2KTtcIixcblwifVwiLFxuXG5cInZlYzQgcmVuZGVyR3JpZGxpbmVzKHZlYzQgZXhpc3RpbmdDb2xvciwgdmVjMiB1diwgdmVjNCBzb2xpZENvbG9yKSB7XCIsXG5cIiAgdmVjMiBkaXN0VG9FZGdlID0gYWJzKG1vZCh2VXYueHkqZ3JpZFNxdWFyZXMgKyBsaW5lV2lkdGgvMi4wLDEuMCkpO1wiLFxuXCIgIHZlYzMgY2hvc2VuR3JpZExpbmVDb2xvciA9IG1peChncmlkTGluZUNvbG9yKHNvbGlkQ29sb3IueHl6KSwgZ3JpZENvbG9yLCB1c2VDdXN0b21HcmlkQ29sb3IpOyBcIiwgLy91c2UgZWl0aGVyIGdyaWRMaW5lQ29sb3IoKSBvciBvdmVycmlkZSB3aXRoIGN1c3RvbSBncmlkXG5cIiAgdmVjMyBibGVuZGVkR3JpZExpbmUgPSBzaG93U29saWQgKiBjaG9zZW5HcmlkTGluZUNvbG9yICsgKDEuMC1zaG93U29saWQpKnNvbGlkQ29sb3IueHl6O1wiLCAvL2lmIHNob3dTb2xpZCA9MCwgdXNlIHNvbGlkQ29sb3IgYXMgdGhlIGdyaWRsaW5lIGNvbG9yLCBvdGhlcndpc2Ugc2hhZGVcblxuXCIgIGlmKCBkaXN0VG9FZGdlLnggPCBsaW5lV2lkdGggfHwgZGlzdFRvRWRnZS55IDwgbGluZVdpZHRoKXtcIixcblwiICAgIHJldHVybiBtaXgoZXhpc3RpbmdDb2xvciwgdmVjNChibGVuZGVkR3JpZExpbmUsIDEuMCksc2hvd0dyaWQpO1wiLFxuXCIgIH1cIixcblwiICByZXR1cm4gZXhpc3RpbmdDb2xvcjtcIixcblwifVwiLFxuLypcblwidmVjNCBnZXRTaGFkZWRDb2xvck1hdGhib3godmVjNCByZ2JhKSB7IFwiLFxuXCIgIHZlYzMgY29sb3IgPSByZ2JhLnh5ejtcIixcblwiICB2ZWMzIGNvbG9yMiA9IG9mZlNwZWN1bGFyKHJnYmEueHl6KTtcIixcblxuXCIgIHZlYzMgbm9ybWFsID0gbm9ybWFsaXplKHZOb3JtYWwpO1wiLFxuXCIgIHZlYzMgbGlnaHQgPSBub3JtYWxpemUodkxpZ2h0KTtcIixcblwiICB2ZWMzIHBvc2l0aW9uID0gbm9ybWFsaXplKHZQb3NpdGlvbik7XCIsXG5cIiAgZmxvYXQgc2lkZSAgICA9IGdsX0Zyb250RmFjaW5nID8gLTEuMCA6IDEuMDtcIixcblwiICBmbG9hdCBjb3NpbmUgID0gc2lkZSAqIGRvdChub3JtYWwsIGxpZ2h0KTtcIixcblwiICBmbG9hdCBkaWZmdXNlID0gbWl4KG1heCgwLjAsIGNvc2luZSksIC41ICsgLjUgKiBjb3NpbmUsIC4xKTtcIixcblwiICAgdmVjMyAgaGFsZkxpZ2h0ID0gbm9ybWFsaXplKGxpZ2h0ICsgcG9zaXRpb24pO1wiLFxuXCJcdGZsb2F0IGNvc2luZUhhbGYgPSBtYXgoMC4wLCBzaWRlICogZG90KG5vcm1hbCwgaGFsZkxpZ2h0KSk7XCIsXG5cIlx0ZmxvYXQgc3BlY3VsYXIgPSBwb3coY29zaW5lSGFsZiwgMTYuMCk7XCIsXG5cIlx0cmV0dXJuIHZlYzQoY29sb3IgKiAoZGlmZnVzZSAqIC45ICsgLjA1KSAqMC4wICsgIC4yNSAqIGNvbG9yMiAqIHNwZWN1bGFyLCByZ2JhLmEpO1wiLFxuXCJ9XCIsKi9cblxuXCJ2b2lkIG1haW4oKXtcIixcbi8vXCIgIC8vZ2xfRnJhZ0NvbG9yID0gdmVjNCh2Tm9ybWFsLnh5eiwgMS4wKTsgLy8gdmlldyBkZWJ1ZyBub3JtYWxzXCIsXG4vL1wiICAvL2lmKHZOb3JtYWwueCA8IDAuMCl7Z2xfRnJhZ0NvbG9yID0gdmVjNChvZmZTcGVjdWxhcihjb2xvci5yZ2IpLCAxLjApO31lbHNle2dsX0ZyYWdDb2xvciA9IHZlYzQoKGNvbG9yLnJnYiksIDEuMCk7fVwiLCAvL3ZpZXcgc3BlY3VsYXIgYW5kIG5vbi1zcGVjdWxhciBjb2xvcnNcbi8vXCIgIGdsX0ZyYWdDb2xvciA9IHZlYzQobW9kKHZVdi54eSwxLjApLDAuMCwxLjApOyAvL3Nob3cgdXZzXG5cIiAgdmVjNCBzb2xpZENvbG9yID0gdmVjNChjb2xvci5yZ2IsIHNob3dTb2xpZCk7XCIsXG5cIiAgdmVjNCBzb2xpZENvbG9yT3V0ID0gc2hvd1NvbGlkKmdldFNoYWRlZENvbG9yKHNvbGlkQ29sb3IpO1wiLFxuXCIgIHZlYzQgY29sb3JXaXRoR3JpZGxpbmVzID0gcmVuZGVyR3JpZGxpbmVzKHNvbGlkQ29sb3JPdXQsIHZVdi54eSwgc29saWRDb2xvcik7XCIsXG5cIiAgY29sb3JXaXRoR3JpZGxpbmVzLmEgKj0gb3BhY2l0eTtcIixcblwiICBnbF9GcmFnQ29sb3IgPSBjb2xvcldpdGhHcmlkbGluZXM7XCIsXHRcblwifVwiXS5qb2luKFwiXFxuXCIpXG5cbnZhciB1bmlmb3JtcyA9IHtcblx0dGltZToge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMCxcblx0fSxcblx0Y29sb3I6IHtcblx0XHR0eXBlOiAnYycsXG5cdFx0dmFsdWU6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSksXG5cdH0sXG5cdHVzZUN1c3RvbUdyaWRDb2xvcjoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMCxcblx0fSxcblx0Z3JpZENvbG9yOiB7XG5cdFx0dHlwZTogJ2MnLFxuXHRcdHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMHg1NWFhNTUpLFxuXHR9LFxuXHRvcGFjaXR5OiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAwLjEsXG5cdH0sXG5cdHZMaWdodDogeyAvL2xpZ2h0IGRpcmVjdGlvblxuXHRcdHR5cGU6ICd2ZWMzJyxcblx0XHR2YWx1ZTogWzAsMCwxXSxcblx0fSxcblx0Z3JpZFNxdWFyZXM6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDQsXG5cdH0sXG5cdGxpbmVXaWR0aDoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMC4xLFxuXHR9LFxuXHRzaG93R3JpZDoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMS4wLFxuXHR9LFxuXHRzaG93U29saWQ6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCxcblx0fVxufTtcblxuZXhwb3J0IHsgdlNoYWRlciwgZlNoYWRlciwgdW5pZm9ybXMgfTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQge0xpbmVPdXRwdXR9IGZyb20gJy4vTGluZU91dHB1dC5qcyc7XG5pbXBvcnQgeyBnZXRUaHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcyB9IGZyb20gJy4vU3VyZmFjZU91dHB1dFNoYWRlcnMuanMnO1xuXG5jbGFzcyBTdXJmYWNlT3V0cHV0IGV4dGVuZHMgT3V0cHV0Tm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcblx0XHRzdXBlcigpO1xuXHRcdC8qIHNob3VsZCBiZSAuYWRkKCllZCB0byBhIFRyYW5zZm9ybWF0aW9uIHRvIHdvcmtcblx0XHRcdG9wdGlvbnM6XG5cdFx0XHR7XG5cdFx0XHRcdG9wYWNpdHk6IG51bWJlclxuXHRcdFx0XHRjb2xvcjogaGV4IGNvZGUgb3IgVEhSRUUuQ29sb3IoKS4gRGlmZnVzZSBjb2xvciBvZiB0aGlzIHN1cmZhY2UuXG5cdFx0XHRcdGdyaWRDb2xvcjogaGV4IGNvZGUgb3IgVEhSRUUuQ29sb3IoKS4gSWYgc2hvd0dyaWQgaXMgdHJ1ZSwgZ3JpZCBsaW5lcyB3aWxsIGFwcGVhciBvdmVyIHRoaXMgc3VyZmFjZS4gZ3JpZENvbG9yIGRldGVybWluZXMgdGhlaXIgY29sb3IgXG5cdFx0XHRcdHNob3dHcmlkOiBib29sZWFuLiBJZiB0cnVlLCB3aWxsIGRpc3BsYXkgYSBncmlkQ29sb3ItY29sb3JlZCBncmlkIG92ZXIgdGhlIHN1cmZhY2UuIERlZmF1bHQ6IHRydWVcblx0XHRcdFx0c2hvd1NvbGlkOiBib29sZWFuLiBJZiB0cnVlLCB3aWxsIGRpc3BsYXkgYSBzb2xpZCBzdXJmYWNlLiBEZWZhdWx0OiB0cnVlXG5cdFx0XHRcdGdyaWRTcXVhcmVzOiBudW1iZXIgcmVwcmVzZW50aW5nIGhvdyBtYW55IHNxdWFyZXMgcGVyIGRpbWVuc2lvbiB0byB1c2UgaW4gYSByZW5kZXJlZCBncmlkXG5cdFx0XHRcdGdyaWRMaW5lV2lkdGg6IG51bWJlciByZXByZXNlbnRpbmcgaG93IG1hbnkgc3F1YXJlcyBwZXIgZGltZW5zaW9uIHRvIHVzZSBpbiBhIHJlbmRlcmVkIGdyaWRcblx0XHRcdH1cblx0XHQqL1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cblx0XHR0aGlzLl9jb2xvciA9IG9wdGlvbnMuY29sb3IgIT09IHVuZGVmaW5lZCA/IG5ldyBUSFJFRS5Db2xvcihvcHRpb25zLmNvbG9yKSA6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSk7XG5cblx0XHR0aGlzLl9ncmlkQ29sb3IgPSBvcHRpb25zLmdyaWRDb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuZ3JpZENvbG9yKSA6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSk7XG4gICAgICAgIHRoaXMuX3VzZUN1c3RvbUdyaWRDb2xvciA9IG9wdGlvbnMuZ3JpZENvbG9yICE9PSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLl9ncmlkU3F1YXJlcyA9IG9wdGlvbnMuZ3JpZFNxdWFyZXMgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuZ3JpZFNxdWFyZXMgOiAxNjtcblx0XHR0aGlzLl9zaG93R3JpZCA9IG9wdGlvbnMuc2hvd0dyaWQgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuc2hvd0dyaWQgOiB0cnVlO1xuXHRcdHRoaXMuX3Nob3dTb2xpZCA9IG9wdGlvbnMuc2hvd1NvbGlkICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLnNob3dTb2xpZCA6IHRydWU7XG5cdFx0dGhpcy5fZ3JpZExpbmVXaWR0aCA9IG9wdGlvbnMuZ3JpZExpbmVXaWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5ncmlkTGluZVdpZHRoIDogMC4xNTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMudmVydGljZXMubGVuZ3RoXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBob3cgbWFueSB0aW1lcyB0byBiZSBjYWxsZWQgaW4gZWFjaCBkaXJlY3Rpb25cblx0XHR0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gMzsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT9cblxuXHRcdHRoaXMuaW5pdCgpO1xuXHR9XG5cdGluaXQoKXtcblx0XHR0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXHRcdHRoaXMuX3ZlcnRpY2VzO1xuXHRcdHRoaXMubWFrZUdlb21ldHJ5KCk7XG5cblx0XHQvL21ha2UgYSBkZWVwIGNvcHkgb2YgdGhlIHVuaWZvcm1zIHRlbXBsYXRlXG5cdFx0dGhpcy5fdW5pZm9ybXMgPSB7fTtcblx0XHRmb3IodmFyIHVuaWZvcm1OYW1lIGluIHVuaWZvcm1zKXtcblx0XHRcdHRoaXMuX3VuaWZvcm1zW3VuaWZvcm1OYW1lXSA9IHtcblx0XHRcdFx0dHlwZTogdW5pZm9ybXNbdW5pZm9ybU5hbWVdLnR5cGUsXG5cdFx0XHRcdHZhbHVlOiB1bmlmb3Jtc1t1bmlmb3JtTmFtZV0udmFsdWVcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLlNoYWRlck1hdGVyaWFsKHtcblx0XHRcdHNpZGU6IFRIUkVFLkJhY2tTaWRlLFxuXHRcdFx0dmVydGV4U2hhZGVyOiB2U2hhZGVyLCBcblx0XHRcdGZyYWdtZW50U2hhZGVyOiBmU2hhZGVyLFxuXHRcdFx0dW5pZm9ybXM6IHRoaXMuX3VuaWZvcm1zLFxuXHRcdFx0fSk7XG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cblx0XHR0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvLyBzZXR0ZXIgc2V0cyB0cmFuc3BhcmVudCBmbGFnIGlmIG5lY2Vzc2FyeVxuXHRcdHRoaXMuY29sb3IgPSB0aGlzLl9jb2xvcjsgLy9zZXR0ZXIgc2V0cyBjb2xvciB1bmlmb3JtXG5cdFx0dGhpcy5fdW5pZm9ybXMub3BhY2l0eS52YWx1ZSA9IHRoaXMuX29wYWNpdHk7XG5cdFx0dGhpcy5fdW5pZm9ybXMuZ3JpZFNxdWFyZXMudmFsdWUgPSB0aGlzLl9ncmlkU3F1YXJlcztcblx0XHR0aGlzLl91bmlmb3Jtcy5zaG93R3JpZC52YWx1ZSA9IHRoaXMudG9OdW0odGhpcy5fc2hvd0dyaWQpO1xuXHRcdHRoaXMuX3VuaWZvcm1zLnNob3dTb2xpZC52YWx1ZSA9IHRoaXMudG9OdW0odGhpcy5fc2hvd1NvbGlkKTtcblx0XHR0aGlzLl91bmlmb3Jtcy5saW5lV2lkdGgudmFsdWUgPSB0aGlzLl9ncmlkTGluZVdpZHRoO1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy51c2VDdXN0b21HcmlkQ29sb3IgPSB0aGlzLl91c2VDdXN0b21HcmlkQ29sb3I7XG5cblx0XHRpZighdGhpcy5zaG93U29saWQpdGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IHRydWU7XG5cblx0XHRnZXRUaHJlZUVudmlyb25tZW50KCkuc2NlbmUuYWRkKHRoaXMubWVzaCk7XG5cdH1cbiAgICB0b051bSh4KXtcbiAgICAgICAgaWYoeCA9PSBmYWxzZSlyZXR1cm4gMDtcbiAgICAgICAgaWYoeCA9PSB0cnVlKXJldHVybiAxO1xuICAgICAgICByZXR1cm4geDtcbiAgICB9XG5cdG1ha2VHZW9tZXRyeSgpe1xuXG5cdFx0bGV0IE1BWF9QT0lOVFMgPSAxMDAwMDtcblxuXHRcdHRoaXMuX3ZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheShNQVhfUE9JTlRTICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cdFx0dGhpcy5fbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDMpO1xuXHRcdHRoaXMuX3V2cyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDIpO1xuXG5cdFx0Ly8gYnVpbGQgZ2VvbWV0cnlcblxuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdub3JtYWwnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fbm9ybWFscywgMyApICk7XG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAndXYnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fdXZzLCAyICkgKTtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy91c2VkIGR1cmluZyB1cGRhdGVzIGFzIGEgcG9pbnRlciB0byB0aGUgYnVmZmVyXG5cblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cblx0fVxuXHRfc2V0VVZzKHV2cywgaW5kZXgsIHUsIHYpe1xuXG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG4gICAgICAgIC8vc2V0dXAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gYW5kIHRoaXMuaXRlbURpbWVuc2lvbnMuIHVzZWQgaGVyZSBhZ2FpbiBiZWNhdXNlIGNsb25pbmcgbWVhbnMgdGhlIG9uQWRkKCkgbWlnaHQgYmUgY2FsbGVkIGJlZm9yZSB0aGlzIGlzIGNvbm5lY3RlZCB0byBhIHR5cGUgb2YgZG9tYWluXG5cblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgRG9tYWluTm9kZSB3ZSdyZSByZW5kZXJpbmcgZnJvbVxuXHRcdGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcblxuXHRcdC8vIHBlcmhhcHMgaW5zdGVhZCBvZiBnZW5lcmF0aW5nIGEgd2hvbGUgbmV3IGFycmF5LCB0aGlzIGNhbiByZXVzZSB0aGUgb2xkIG9uZT9cblx0XHRsZXQgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cdFx0bGV0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogMyk7XG5cdFx0bGV0IHV2cyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiAyKTtcblxuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0dGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl92ZXJ0aWNlcyk7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBub3JtYWxzO1xuXHRcdG5vcm1hbEF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9ub3JtYWxzKTtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IHV2QXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy51djtcblxuXG5cdFx0Ly9hc3NlcnQgdGhpcy5pdGVtRGltZW5zaW9uc1swXSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0gPSB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiBhbmQgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9PSAyXG5cdFx0dmFyIGluZGljZXMgPSBbXTtcblxuXHRcdC8vcmVuZGVyZWQgdHJpYW5nbGUgaW5kaWNlc1xuXHRcdC8vZnJvbSB0aHJlZS5qcyBQbGFuZUdlb21ldHJ5LmpzXG5cdFx0bGV0IGJhc2UgPSAwO1xuXHRcdGxldCBpPTAsIGo9MDtcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXS0xO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xO2krKyl7XG5cblx0XHRcdFx0bGV0IGEgPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBiID0gaSArIChqKzEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGMgPSAoaSsxKSsgKGorMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRsZXQgZCA9IChpKzEpKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblxuICAgICAgICBcdFx0aW5kaWNlcy5wdXNoKGEsIGIsIGQpO1xuXHRcdFx0XHRpbmRpY2VzLnB1c2goYiwgYywgZCk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2RvdWJsZSBzaWRlZCByZXZlcnNlIGZhY2VzXG4gICAgICAgIFx0XHRpbmRpY2VzLnB1c2goZCwgYiwgYSk7XG5cdFx0XHRcdGluZGljZXMucHVzaChkLCBjLCBiKTtcblxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vbm9ybWFscyAod2lsbCBiZSBvdmVyd3JpdHRlbiBsYXRlcikgYW5kIHV2c1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtpKyspe1xuXG5cdFx0XHRcdGxldCBwb2ludEluZGV4ID0gaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHQvL3NldCBub3JtYWwgdG8gWzAsMCwxXSBhcyBhIHRlbXBvcmFyeSB2YWx1ZVxuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozXSA9IDA7XG5cdFx0XHRcdG5vcm1hbHNbKHBvaW50SW5kZXgpKjMrMV0gPSAwO1xuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozKzJdID0gMTtcblxuXHRcdFx0XHQvL3V2c1xuXHRcdFx0XHR1dnNbKHBvaW50SW5kZXgpKjJdID0gai8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKTtcblx0XHRcdFx0dXZzWyhwb2ludEluZGV4KSoyKzFdID0gaS8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl91dnMgPSB1dnM7XG5cdFx0dXZBdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdXZzKTtcblx0XHR1dkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHR0aGlzLl9nZW9tZXRyeS5zZXRJbmRleCggaW5kaWNlcyApO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHRpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7XHRcblx0XHR9XG5cblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cblx0XHQvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuXHRcdGxldCBpbmRleCA9IHRoaXMuX2N1cnJlbnRQb2ludEluZGV4KnRoaXMuX291dHB1dERpbWVuc2lvbnM7XG5cblx0ICAgIHRoaXMuX3ZlcnRpY2VzW2luZGV4XSAgID0geCA9PT0gdW5kZWZpbmVkID8gMCA6IHg7XG5cdFx0dGhpcy5fdmVydGljZXNbaW5kZXgrMV0gPSB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcblx0XHR0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXSA9IHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fcmVjYWxjTm9ybWFscygpO1xuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3Jlc2V0IGFmdGVyIGVhY2ggdXBkYXRlXG5cdH1cblx0X3JlY2FsY05vcm1hbHMoKXtcblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHQvL3JlbmRlcmVkIHRyaWFuZ2xlIGluZGljZXNcblx0XHQvL2Zyb20gdGhyZWUuanMgUGxhbmVHZW9tZXRyeS5qc1xuXHRcdGxldCBub3JtYWxWZWMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdGxldCBwYXJ0aWFsWCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0bGV0IHBhcnRpYWxZID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuXHRcdGxldCBiYXNlID0gMDtcblx0XHRsZXQgbmVnYXRpb25GYWN0b3IgPSAxO1xuXHRcdGxldCBpPTAsIGo9MDtcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtqKyspe1xuXHRcdFx0Zm9yKGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aSsrKXtcblxuXHRcdFx0XHQvL2N1cnJlbnRseSBkb2luZyB0aGUgbm9ybWFsIGZvciB0aGUgcG9pbnQgYXQgaW5kZXggYS5cblx0XHRcdFx0bGV0IGEgPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBiLGM7XG5cblx0XHRcdFx0Ly9UYW5nZW50cyBhcmUgY2FsY3VsYXRlZCB3aXRoIGZpbml0ZSBkaWZmZXJlbmNlcyAtIEZvciAoeCx5KSwgY29tcHV0ZSB0aGUgcGFydGlhbCBkZXJpdmF0aXZlcyB1c2luZyAoeCsxLHkpIGFuZCAoeCx5KzEpIGFuZCBjcm9zcyB0aGVtLiBCdXQgaWYgeW91J3JlIGF0IHRoZWJvcmRlciwgeCsxIGFuZCB5KzEgbWlnaHQgbm90IGV4aXN0LiBTbyBpbiB0aGF0IGNhc2Ugd2UgZ28gYmFja3dhcmRzIGFuZCB1c2UgKHgtMSx5KSBhbmQgKHgseS0xKSBpbnN0ZWFkLlxuXHRcdFx0XHQvL1doZW4gdGhhdCBoYXBwZW5zLCB0aGUgdmVjdG9yIHN1YnRyYWN0aW9uIHdpbGwgc3VidHJhY3QgdGhlIHdyb25nIHdheSwgaW50cm9kdWNpbmcgYSBmYWN0b3Igb2YgLTEgaW50byB0aGUgY3Jvc3MgcHJvZHVjdCB0ZXJtLiBTbyBuZWdhdGlvbkZhY3RvciBrZWVwcyB0cmFjayBvZiB3aGVuIHRoYXQgaGFwcGVucyBhbmQgaXMgbXVsdGlwbGllZCBhZ2FpbiB0byBjYW5jZWwgaXQgb3V0LlxuXHRcdFx0XHRuZWdhdGlvbkZhY3RvciA9IDE7IFxuXG5cdFx0XHRcdC8vYiBpcyB0aGUgaW5kZXggb2YgdGhlIHBvaW50IDEgYXdheSBpbiB0aGUgeSBkaXJlY3Rpb25cblx0XHRcdFx0aWYoaSA8IHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSl7XG5cdFx0XHRcdFx0YiA9IChpKzEpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdC8vZW5kIG9mIHRoZSB5IGF4aXMsIGdvIGJhY2t3YXJkcyBmb3IgdGFuZ2VudHNcblx0XHRcdFx0XHRiID0gKGktMSkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0XHRuZWdhdGlvbkZhY3RvciAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vYyBpcyB0aGUgaW5kZXggb2YgdGhlIHBvaW50IDEgYXdheSBpbiB0aGUgeCBkaXJlY3Rpb25cblx0XHRcdFx0aWYoaiA8IHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSl7XG5cdFx0XHRcdFx0YyA9IGkgKyAoaisxKSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdC8vZW5kIG9mIHRoZSB4IGF4aXMsIGdvIGJhY2t3YXJkcyBmb3IgdGFuZ2VudHNcblx0XHRcdFx0XHRjID0gaSArIChqLTEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0XHRuZWdhdGlvbkZhY3RvciAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vdGhlIHZlY3RvciBiLWEuIFxuXHRcdFx0XHQvL3RoaXMuX3ZlcnRpY2VzIHN0b3JlcyB0aGUgY29tcG9uZW50cyBvZiBlYWNoIHZlY3RvciBpbiBvbmUgYmlnIGZsb2F0MzJhcnJheSwgc28gdGhpcyBwdWxscyB0aGVtIG91dCBhbmQganVzdCBkb2VzIHRoZSBzdWJ0cmFjdGlvbiBudW1lcmljYWxseS4gVGhlIGNvbXBvbmVudHMgb2YgdmVjdG9yICM1MiBhcmUgeDo1MiozKzAseTo1MiozKzEsejo1MiozKzIsIGZvciBleGFtcGxlLlxuXHRcdFx0XHRwYXJ0aWFsWS5zZXQodGhpcy5fdmVydGljZXNbYiozXS10aGlzLl92ZXJ0aWNlc1thKjNdLHRoaXMuX3ZlcnRpY2VzW2IqMysxXS10aGlzLl92ZXJ0aWNlc1thKjMrMV0sdGhpcy5fdmVydGljZXNbYiozKzJdLXRoaXMuX3ZlcnRpY2VzW2EqMysyXSk7XG5cdFx0XHRcdC8vdGhlIHZlY3RvciBjLWEuXG5cdFx0XHRcdHBhcnRpYWxYLnNldCh0aGlzLl92ZXJ0aWNlc1tjKjNdLXRoaXMuX3ZlcnRpY2VzW2EqM10sdGhpcy5fdmVydGljZXNbYyozKzFdLXRoaXMuX3ZlcnRpY2VzW2EqMysxXSx0aGlzLl92ZXJ0aWNlc1tjKjMrMl0tdGhpcy5fdmVydGljZXNbYSozKzJdKTtcblxuXHRcdFx0XHQvL2ItYSBjcm9zcyBjLWFcblx0XHRcdFx0bm9ybWFsVmVjLmNyb3NzVmVjdG9ycyhwYXJ0aWFsWCxwYXJ0aWFsWSkubm9ybWFsaXplKCk7XG5cdFx0XHRcdG5vcm1hbFZlYy5tdWx0aXBseVNjYWxhcihuZWdhdGlvbkZhY3Rvcik7XG5cdFx0XHRcdC8vc2V0IG5vcm1hbFxuXHRcdFx0XHR0aGlzLl9ub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjNdID0gbm9ybWFsVmVjLng7XG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqMysxXSA9IG5vcm1hbFZlYy55O1xuXHRcdFx0XHR0aGlzLl9ub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjMrMl0gPSBub3JtYWxWZWMuejtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gZG9uJ3QgZm9yZ2V0IHRvIG5vcm1hbEF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWUgYWZ0ZXIgY2FsbGluZyB0aGlzIVxuXHR9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLm1lc2gpO1xuICAgIH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseSBtYWtlIHRoaXMgYSBmdW5jdGlvblxuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdFx0dGhpcy5fdW5pZm9ybXMuY29sb3IudmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IoY29sb3IpO1xuXHR9XG5cdGdldCBjb2xvcigpe1xuXHRcdHJldHVybiB0aGlzLl9jb2xvcjtcblx0fVxuXHRzZXQgZ3JpZENvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseSBtYWtlIHRoaXMgYSBmdW5jdGlvblxuXHRcdHRoaXMuX2dyaWRDb2xvciA9IGNvbG9yO1xuXHRcdHRoaXMuX3VuaWZvcm1zLmdyaWRDb2xvci52YWx1ZSA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLnVzZUN1c3RvbUdyaWRDb2xvciA9IDEuMDtcblx0fVxuXHRnZXQgZ3JpZENvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2dyaWRDb2xvcjtcblx0fVxuXHRzZXQgb3BhY2l0eShvcGFjaXR5KXtcblx0XHR0aGlzLm1hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuXHRcdHRoaXMubWF0ZXJpYWwudHJhbnNwYXJlbnQgPSAob3BhY2l0eSA8IDEpIHx8ICghdGhpcy5zaG93U29saWQpO1xuXHRcdHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBTdXJmYWNlT3V0cHV0KHtjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuZXhwb3J0IHtTdXJmYWNlT3V0cHV0fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5cbmNsYXNzIEZsYXRBcnJheU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG4gICAgLy9hbiBvdXRwdXQgd2hpY2ggZmlsbHMgYW4gYXJyYXkgd2l0aCBldmVyeSBjb29yZGluYXRlIHJlY2lldmVkLCBpbiBvcmRlci5cbiAgICAvL0l0J2xsIHJlZ2lzdGVyIFswLDEsMl0sWzMsNCw1XSBhcyBbMCwxLDIsMyw0LDVdLlxuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lypcblx0XHRcdGFycmF5OiBhbiBleGlzdGluZyBhcnJheSwgd2hpY2ggd2lsbCB0aGVuIGJlIG1vZGlmaWVkIGluIHBsYWNlIGV2ZXJ5IHRpbWUgdGhpcyBvdXRwdXQgaXMgYWN0aXZhdGVkXG5cdFx0Ki9cblxuXHRcdHRoaXMuYXJyYXkgPSBvcHRpb25zLmFycmF5O1xuICAgICAgICB0aGlzLl9jdXJyZW50QXJyYXlJbmRleCA9IDA7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIC4uLmNvb3Jkcyl7XG4gICAgICAgIGZvcih2YXIgaj0wO2o8Y29vcmRzLmxlbmd0aDtqKyspeyBcbiAgICAgICAgICAgIC8vSSBkb24ndCBuZWVkIHRvIHdvcnJ5IGFib3V0IG91dC1vZi1ib3VuZHMgZW50cmllcyBiZWNhdXNlIGphdmFzY3JpcHQgYXV0b21hdGljYWxseSBncm93cyBhcnJheXMgaWYgYSBuZXcgaW5kZXggaXMgc2V0LlxuICAgICAgICAgICAgLy9KYXZhc2NyaXB0IG1heSBoYXZlIHNvbWUgZ2FyYmFnZSBkZXNpZ24gY2hvaWNlcywgYnV0IEknbGwgY2xhaW0gdGhhdCBnYXJiYWdlIGZvciBteSBvd24gbmVmYXJpb3VzIGFkdmFudGFnZS5cbiAgICAgICAgICAgIHRoaXMuYXJyYXlbdGhpcy5fY3VycmVudEFycmF5SW5kZXhdID0gY29vcmRzW2pdXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50QXJyYXlJbmRleCsrO1xuICAgICAgICB9XG5cdH1cblx0b25BZnRlckFjdGl2YXRpb24oKXtcbiAgICAgICAgdGhpcy5fY3VycmVudEFycmF5SW5kZXggPSAwO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBGbGF0QXJyYXlPdXRwdXQoe2FycmF5OiBFWFAuTWF0aC5jbG9uZSh0aGlzLmFycmF5KX0pO1xuXHR9XG59XG5cbmV4cG9ydCB7RmxhdEFycmF5T3V0cHV0fTtcbiIsInZhciBleHBsYW5hcmlhbkFycm93U1ZHID0gXCJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBEOTRiV3dnZG1WeWMybHZiajBpTVM0d0lpQmxibU52WkdsdVp6MGlWVlJHTFRnaUlITjBZVzVrWVd4dmJtVTlJbTV2SWo4K0Nqd2hMUzBnUTNKbFlYUmxaQ0IzYVhSb0lFbHVhM05qWVhCbElDaG9kSFJ3T2k4dmQzZDNMbWx1YTNOallYQmxMbTl5Wnk4cElDMHRQZ29LUEhOMlp3b2dJQ0I0Yld4dWN6cGtZejBpYUhSMGNEb3ZMM0IxY213dWIzSm5MMlJqTDJWc1pXMWxiblJ6THpFdU1TOGlDaUFnSUhodGJHNXpPbU5qUFNKb2RIUndPaTh2WTNKbFlYUnBkbVZqYjIxdGIyNXpMbTl5Wnk5dWN5TWlDaUFnSUhodGJHNXpPbkprWmowaWFIUjBjRG92TDNkM2R5NTNNeTV2Y21jdk1UazVPUzh3TWk4eU1pMXlaR1l0YzNsdWRHRjRMVzV6SXlJS0lDQWdlRzFzYm5NNmMzWm5QU0pvZEhSd09pOHZkM2QzTG5jekxtOXlaeTh5TURBd0wzTjJaeUlLSUNBZ2VHMXNibk05SW1oMGRIQTZMeTkzZDNjdWR6TXViM0puTHpJd01EQXZjM1puSWdvZ0lDQjRiV3h1Y3pwNGJHbHVhejBpYUhSMGNEb3ZMM2QzZHk1M015NXZjbWN2TVRrNU9TOTRiR2x1YXlJS0lDQWdlRzFzYm5NNmMyOWthWEJ2WkdrOUltaDBkSEE2THk5emIyUnBjRzlrYVM1emIzVnlZMlZtYjNKblpTNXVaWFF2UkZSRUwzTnZaR2x3YjJScExUQXVaSFJrSWdvZ0lDQjRiV3h1Y3pwcGJtdHpZMkZ3WlQwaWFIUjBjRG92TDNkM2R5NXBibXR6WTJGd1pTNXZjbWN2Ym1GdFpYTndZV05sY3k5cGJtdHpZMkZ3WlNJS0lDQWdkMmxrZEdnOUlqSXdNQ0lLSUNBZ2FHVnBaMmgwUFNJeE16QWlDaUFnSUhacFpYZENiM2c5SWpBZ01DQXlNREFnTVRNd0lnb2dJQ0JwWkQwaWMzWm5NaUlLSUNBZ2RtVnljMmx2YmowaU1TNHhJZ29nSUNCcGJtdHpZMkZ3WlRwMlpYSnphVzl1UFNJd0xqa3hJSEl4TXpjeU5TSUtJQ0FnYzI5a2FYQnZaR2s2Wkc5amJtRnRaVDBpUlhod2JHRnVZWEpwWVc1T1pYaDBRWEp5YjNjdWMzWm5JajRLSUNBOFpHVm1jejRLUEhKaFpHbGhiRWR5WVdScFpXNTBJR2xrUFNKaElpQmplRDBpTlRBd0lpQmplVDBpTmpJM0xqY3hJaUJ5UFNJeU5ESXVNelVpSUdkeVlXUnBaVzUwVkhKaGJuTm1iM0p0UFNKdFlYUnlhWGdvTUNBdU1qazNNRElnTFRNdU9ETTVNU0F0TVM0eE9UTXhaUzA0SURJME1EZ3VNU0E0TXpndU9EVXBJaUJuY21Ga2FXVnVkRlZ1YVhSelBTSjFjMlZ5VTNCaFkyVlBibFZ6WlNJK0NqeHpkRzl3SUhOMGIzQXRZMjlzYjNJOUlpTmlZemN6TVRraUlHOW1abk5sZEQwaU1DSXZQZ284YzNSdmNDQnpkRzl3TFdOdmJHOXlQU0lqWmpCa01qWXpJaUJ2Wm1aelpYUTlJakVpTHo0S1BDOXlZV1JwWVd4SGNtRmthV1Z1ZEQ0S1BDOWtaV1p6UGdvOGJXVjBZV1JoZEdFK0NqeHlaR1k2VWtSR1BnbzhZMk02VjI5eWF5QnlaR1k2WVdKdmRYUTlJaUkrQ2p4a1l6cG1iM0p0WVhRK2FXMWhaMlV2YzNabkszaHRiRHd2WkdNNlptOXliV0YwUGdvOFpHTTZkSGx3WlNCeVpHWTZjbVZ6YjNWeVkyVTlJbWgwZEhBNkx5OXdkWEpzTG05eVp5OWtZeTlrWTIxcGRIbHdaUzlUZEdsc2JFbHRZV2RsSWk4K0NqeGtZenAwYVhSc1pTOCtDand2WTJNNlYyOXlhejRLUEM5eVpHWTZVa1JHUGdvOEwyMWxkR0ZrWVhSaFBnbzhaeUIwY21GdWMyWnZjbTA5SW5SeVlXNXpiR0YwWlNnd0lDMDVNakl1TXpZcElqNEtQSEJoZEdnZ1pEMGliVEU1Tnk0ME55QTVPRGN1TXpaak1DMHlOQzR5T0RFdE9EY3VNall4TFRZeExqY3dPQzA0Tnk0eU5qRXROakV1TnpBNGRqSTVMalk1Tkd3dE1UTXVOVFl6SURBdU16YzVOR010TVRNdU5UWXpJREF1TXpjNU16a3ROakl1TWpBeUlESXVPREkzTVMwM05DNDRNVEVnTnk0NU5qVTNMVEV5TGpZd09TQTFMakV6T0RZdE1Ua3VNekF4SURFMExqWTVOUzB4T1M0ek1ERWdNak11TmpZNUlEQWdPQzQ1TnpNNElETXVPVGN6TlNBeE9DNHhOak1nTVRrdU16QXhJREl6TGpZMk9TQXhOUzR6TWpjZ05TNDFNRFUxSURZeExqSTBPQ0EzTGpVNE5qTWdOelF1T0RFeElEY3VPVFkxTjJ3eE15NDFOak1nTUM0ek56azBkakk1TGpZNU5ITTROeTR5TmpFdE16Y3VOREk0SURnM0xqSTJNUzAyTVM0M01EaDZJaUJtYVd4c1BTSjFjbXdvSTJFcElpQnpkSEp2YTJVOUlpTTNNelUxTTJRaUlITjBjbTlyWlMxM2FXUjBhRDBpTWk0Mk1qZzFJaTgrQ2p4bklIUnlZVzV6Wm05eWJUMGliV0YwY21sNEtEQWdMakkyTWpnMUlDMHVNall5T0RVZ01DQXhOemd1TVRNZ09EWXdMakF4S1NJZ2MzUnliMnRsUFNJak1EQXdJaUJ6ZEhKdmEyVXRkMmxrZEdnOUlqRXdJajRLUEdWc2JHbHdjMlVnWTNnOUlqVTBOeTR4TkNJZ1kzazlJakV5TUM0NU15SWdjbmc5SWpJMUxqY3hOQ0lnY25rOUlqVXhMalF5T1NJZ1ptbHNiRDBpSTJabVppSXZQZ284Wld4c2FYQnpaU0JqZUQwaU5UTTBMak0zSWlCamVUMGlNVEl6TGpVeklpQnllRDBpTVRJdU5qSTNJaUJ5ZVQwaU1qWXVNalkwSWk4K0Nqd3ZaejRLUEdjZ2RISmhibk5tYjNKdFBTSnRZWFJ5YVhnb01DQXRMakkyTWpnMUlDMHVNall5T0RVZ01DQXhOemd1TmpZZ01URXhOQzQzS1NJZ2MzUnliMnRsUFNJak1EQXdJaUJ6ZEhKdmEyVXRkMmxrZEdnOUlqRXdJajRLUEdWc2JHbHdjMlVnWTNnOUlqVTBOeTR4TkNJZ1kzazlJakV5TUM0NU15SWdjbmc5SWpJMUxqY3hOQ0lnY25rOUlqVXhMalF5T1NJZ1ptbHNiRDBpSTJabVppSXZQZ284Wld4c2FYQnpaU0JqZUQwaU5UTTBMak0zSWlCamVUMGlNVEl6TGpVeklpQnllRDBpTVRJdU5qSTNJaUJ5ZVQwaU1qWXVNalkwSWk4K0Nqd3ZaejRLUEM5blBnbzhMM04yWno0S1wiO1xuXG5leHBvcnQgZGVmYXVsdCBleHBsYW5hcmlhbkFycm93U1ZHO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qVGhpcyBjbGFzcyBpcyBzdXBwb3NlZCB0byB0dXJuIGEgc2VyaWVzIG9mXG5kaXIuZGVsYXkoKVxuZGlyLnRyYW5zaXRpb25UbyguLi4pXG5kaXIuZGVsYXkoKVxuZGlyLm5leHRTbGlkZSgpO1xuXG5pbnRvIGEgc2VxdWVuY2UgdGhhdCBvbmx5IGFkdmFuY2VzIHdoZW4gdGhlIHJpZ2h0IGFycm93IGlzIHByZXNzZWQuXG5cbkFueSBkaXZzIHdpdGggdGhlIGV4cC1zbGlkZSBjbGFzcyB3aWxsIGFsc28gYmUgc2hvd24gYW5kIGhpZGRlbiBvbmUgYnkgb25lLlxuXG5BbHNvLFxuXG4qL1xuXG5pbXBvcnQge0FuaW1hdGlvbiwgRWFzaW5nfSBmcm9tICcuL0FuaW1hdGlvbi5qcyc7XG5pbXBvcnQgZXhwbGFuYXJpYW5BcnJvd1NWRyBmcm9tICcuL0RpcmVjdG9ySW1hZ2VDb25zdGFudHMuanMnO1xuXG5jbGFzcyBEaXJlY3Rpb25BcnJvd3tcbiAgICBjb25zdHJ1Y3RvcihmYWNlUmlnaHQpe1xuICAgICAgICB0aGlzLmFycm93SW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLnNyYyA9IGV4cGxhbmFyaWFuQXJyb3dTVkc7XG5cbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3dcIik7XG5cbiAgICAgICAgZmFjZVJpZ2h0ID0gZmFjZVJpZ2h0PT09dW5kZWZpbmVkID8gdHJ1ZSA6IGZhY2VSaWdodDtcblxuICAgICAgICBpZihmYWNlUmlnaHQpe1xuICAgICAgICAgICAgdGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3ctcmlnaHRcIilcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICB0aGlzLmFycm93SW1hZ2UuY2xhc3NMaXN0LmFkZChcImV4cC1hcnJvdy1sZWZ0XCIpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLm9uY2xpY2sgPSAoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHRoaXMuaGlkZVNlbGYoKTtcbiAgICAgICAgICAgIHRoaXMub25jbGlja0NhbGxiYWNrKCk7XG4gICAgICAgIH0pLmJpbmQodGhpcyk7XG5cbiAgICAgICAgdGhpcy5vbmNsaWNrQ2FsbGJhY2sgPSBudWxsOyAvLyB0byBiZSBzZXQgZXh0ZXJuYWxseVxuICAgIH1cbiAgICBzaG93U2VsZigpe1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnO1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3R5bGUub3BhY2l0eSA9IDE7XG4gICAgICAgIFxuICAgIH1cbiAgICBoaWRlU2VsZigpe1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuICAgIH1cbn1cblxuXG5jbGFzcyBOb25EZWNyZWFzaW5nRGlyZWN0b3J7XG4gICAgLy9Vc2luZyBhIE5vbkRlY3JlYXNpbmdEaXJlY3RvciwgY3JlYXRlIEhUTUwgZWxlbWVudHMgd2l0aCB0aGUgJ2V4cC1zbGlkZScgY2xhc3MuXG4gICAgLy9UaGUgZmlyc3QgSFRNTCBlbGVtZW50IHdpdGggdGhlICdleHAtc2xpZGUnIGNsYXNzIHdpbGwgYmUgc2hvd24gZmlyc3QuIFdoZW4gdGhlIG5leHQgc2xpZGUgYnV0dG9uIGlzIGNsaWNrZWQsIHRoYXQgd2lsbCBmYWRlIG91dCBhbmQgYmUgcmVwbGFjZWQgd2l0aCB0aGUgbmV4dCBlbGVtZW50IHdpdGggdGhlIGV4cC1zbGlkZSBjbGFzcywgaW4gb3JkZXIgb2YgSFRNTC5cbiAgICAvL0lmIHlvdSB3YW50IHRvIGRpc3BsYXkgbXVsdGlwbGUgSFRNTCBlbGVtZW50cyBhdCB0aGUgc2FtZSB0aW1lLCAnZXhwLXNsaWRlLTxuPicgd2lsbCBhbHNvIGJlIGRpc3BsYXllZCB3aGVuIHRoZSBwcmVzZW50YXRpb24gaXMgY3VycmVudGx5IG9uIHNsaWRlIG51bWJlciBuLiBGb3IgZXhhbXBsZSwgZXZlcnl0aGluZyBpbiB0aGUgZXhwLXNsaWRlLTEgY2xhc3Mgd2lsbCBiZSB2aXNpYmxlIGZyb20gdGhlIHN0YXJ0LCBhbmQgdGhlbiBleHAtc2xpZGUtMiwgYW5kIHNvIG9uLlxuICAgIC8vRG9uJ3QgZ2l2ZSBhbiBlbGVtZW50IGJvdGggdGhlIGV4cC1zbGlkZSBhbmQgZXhwLXNsaWRlLW4gY2xhc3Nlcy4gXG5cbiAgICAvLyBJIHdhbnQgRGlyZWN0b3IoKSB0byBiZSBhYmxlIHRvIGJhY2t0cmFjayBieSBwcmVzc2luZyBiYWNrd2FyZHMuIFRoaXMgZG9lc24ndCBkbyB0aGF0LlxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuICAgICAgICB0aGlzLnNsaWRlcyA9IFtdO1xuICAgICAgICB0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID0gMDsgICAgICAgIFxuICAgICAgICB0aGlzLm51bVNsaWRlcyA9IDA7XG4gICAgICAgIHRoaXMubnVtSFRNTFNsaWRlcyA9IDA7XG5cbiAgICAgICAgdGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBudWxsO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgXG5cblxuICAgIGFzeW5jIGJlZ2luKCl7XG4gICAgICAgIGF3YWl0IHRoaXMud2FpdEZvclBhZ2VMb2FkKCk7XG5cbiAgICAgICAgdGhpcy5zZXR1cEFuZEhpZGVBbGxTbGlkZUhUTUxFbGVtZW50cygpO1xuXG4gICAgICAgIHRoaXMuc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleCgwKTsgLy91bmhpZGUgZmlyc3Qgb25lXG5cbiAgICAgICAgdGhpcy5zZXR1cENsaWNrYWJsZXMoKTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBzZXR1cEFuZEhpZGVBbGxTbGlkZUhUTUxFbGVtZW50cygpe1xuXG4gICAgICAgIHRoaXMuc2xpZGVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZVwiKTtcbiAgICAgICAgdGhpcy5udW1IVE1MU2xpZGVzID0gdGhpcy5zbGlkZXMubGVuZ3RoO1xuXG4gICAgICAgIC8vaGlkZSBhbGwgc2xpZGVzIGV4Y2VwdCBmaXJzdCBvbmVcbiAgICAgICAgZm9yKHZhciBpPTA7aTx0aGlzLm51bUhUTUxTbGlkZXM7aSsrKXtcbiAgICAgICAgICAgIHRoaXMuc2xpZGVzW2ldLnN0eWxlLm9wYWNpdHkgPSAwOyBcbiAgICAgICAgICAgIHRoaXMuc2xpZGVzW2ldLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7Ly9vcGFjaXR5PTAgYWxvbmUgd29uJ3QgYmUgaW5zdGFudCBiZWNhdXNlIG9mIHRoZSAxcyBDU1MgdHJhbnNpdGlvblxuICAgICAgICB9XG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgLy91bmRvIHNldHRpbmcgZGlzcGxheS1ub25lIGFmdGVyIGEgYml0IG9mIHRpbWVcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGZvcih2YXIgaT0wO2k8c2VsZi5zbGlkZXMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICAgICAgc2VsZi5zbGlkZXNbaV0uc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LDEpO1xuXG4gICAgICAgIC8vbm93IGhhbmRsZSBleHAtc2xpZGUtPG4+XG4gICAgICAgIGxldCBhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbY2xhc3MqPVwiZXhwLXNsaWRlLVwiXScpOyAvL3RoaXMgaXMgYSBDU1MgYXR0cmlidXRlIHNlbGVjdG9yLCBhbmQgSSBoYXRlIHRoYXQgdGhpcyBleGlzdHMuIGl0J3Mgc28gdWdseVxuICAgICAgICBmb3IodmFyIGk9MDtpPGFsbFNwZWNpZmljU2xpZGVFbGVtZW50cy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGFsbFNwZWNpZmljU2xpZGVFbGVtZW50c1tpXS5zdHlsZS5vcGFjaXR5ID0gMDsgXG4gICAgICAgICAgICBhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHNbaV0uc3R5bGUuZGlzcGxheSA9ICdub25lJzsvL29wYWNpdHk9MCBhbG9uZSB3b24ndCBiZSBpbnN0YW50IGJlY2F1c2Ugb2YgdGhlIDFzIENTUyB0cmFuc2l0aW9uXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXR1cENsaWNrYWJsZXMoKXtcbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHRoaXMucmlnaHRBcnJvdyA9IG5ldyBEaXJlY3Rpb25BcnJvdygpO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMucmlnaHRBcnJvdy5hcnJvd0ltYWdlKTtcbiAgICAgICAgdGhpcy5yaWdodEFycm93Lm9uY2xpY2tDYWxsYmFjayA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBzZWxmLl9jaGFuZ2VTbGlkZSgxLCBmdW5jdGlvbigpe30pOyAvLyB0aGlzIGVycm9ycyB3aXRob3V0IHRoZSBlbXB0eSBmdW5jdGlvbiBiZWNhdXNlIHRoZXJlJ3Mgbm8gcmVzb2x2ZS4gVGhlcmUgbXVzdCBiZSBhIGJldHRlciB3YXkgdG8gZG8gdGhpbmdzLlxuICAgICAgICAgICAgY29uc29sZS53YXJuKFwiV0FSTklORzogSG9ycmlibGUgaGFjayBpbiBlZmZlY3QgdG8gY2hhbmdlIHNsaWRlcy4gUGxlYXNlIHJlcGxhY2UgdGhlIHBhc3MtYW4tZW1wdHktZnVuY3Rpb24gdGhpbmcgd2l0aCBzb21ldGhpbmcgdGhhdCBhY3R1YWxseSByZXNvbHZlcyBwcm9wZXJseSBhbmQgZG9lcyBhc3luYy5cIilcbiAgICAgICAgICAgIHNlbGYubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uKCk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGFzeW5jIHdhaXRGb3JQYWdlTG9hZCgpe1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgIGlmKGRvY3VtZW50LnJlYWR5U3RhdGUgPT0gJ2NvbXBsZXRlJyl7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIscmVzb2x2ZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBhc3luYyBuZXh0U2xpZGUoKXtcbiAgICAgICAgaWYoIXRoaXMuaW5pdGlhbGl6ZWQpdGhyb3cgbmV3IEVycm9yKFwiRVJST1I6IFVzZSAuYmVnaW4oKSBvbiBhIERpcmVjdG9yIGJlZm9yZSBjYWxsaW5nIGFueSBvdGhlciBtZXRob2RzIVwiKTtcblxuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5yaWdodEFycm93LnNob3dTZWxmKCk7XG4gICAgICAgIC8vcHJvbWlzZSBpcyByZXNvbHZlZCBieSBjYWxsaW5nIHRoaXMubmV4dFNsaWRlUHJvbWlzZS5yZXNvbHZlKCkgd2hlbiB0aGUgdGltZSBjb21lc1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgICAgICAgZnVuY3Rpb24ga2V5TGlzdGVuZXIoZSl7XG4gICAgICAgICAgICAgICAgaWYoZS5yZXBlYXQpcmV0dXJuOyAvL2tleWRvd24gZmlyZXMgbXVsdGlwbGUgdGltZXMgYnV0IHdlIG9ubHkgd2FudCB0aGUgZmlyc3Qgb25lXG4gICAgICAgICAgICAgICAgbGV0IHNsaWRlRGVsdGEgPSAwO1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoZS5rZXlDb2RlKSB7XG4gICAgICAgICAgICAgICAgICBjYXNlIDM0OlxuICAgICAgICAgICAgICAgICAgY2FzZSAzOTpcbiAgICAgICAgICAgICAgICAgIGNhc2UgNDA6XG4gICAgICAgICAgICAgICAgICAgIHNsaWRlRGVsdGEgPSAxO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZihzbGlkZURlbHRhICE9IDApe1xuICAgICAgICAgICAgICAgICAgICBzZWxmLl9jaGFuZ2VTbGlkZShzbGlkZURlbHRhLCByZXNvbHZlKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5yaWdodEFycm93LmhpZGVTZWxmKCk7XG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLGtleUxpc3RlbmVyKTsgLy90aGlzIGFwcHJvYWNoIHRha2VuIGZyb20gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzU3MTg2NDUvcmVzb2x2aW5nLWEtcHJvbWlzZS13aXRoLWV2ZW50bGlzdGVuZXJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBrZXlMaXN0ZW5lcik7XG4gICAgICAgICAgICAvL2hvcnJpYmxlIGhhY2sgc28gdGhhdCB0aGUgJ25leHQgc2xpZGUnIGFycm93IGNhbiB0cmlnZ2VyIHRoaXMgdG9vXG4gICAgICAgICAgICBzZWxmLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IGZ1bmN0aW9uKCl7IFxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIixrZXlMaXN0ZW5lcik7IFxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgX2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpe1xuICAgICAgICAvL3NsaWRlIGNoYW5naW5nIGxvZ2ljXG4gICAgICAgIGlmKHNsaWRlRGVsdGEgIT0gMCl7XG4gICAgICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IDAgJiYgc2xpZGVEZWx0YSA9PSAtMSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuOyAvL25vIGdvaW5nIHBhc3QgdGhlIGJlZ2lubmluZ1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA9PSB0aGlzLm51bUhUTUxTbGlkZXMtMSAmJiBzbGlkZURlbHRhID09IDEpe1xuICAgICAgICAgICAgICAgIHJldHVybjsgLy9ubyBnb2luZyBwYXN0IHRoZSBlbmRcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KHRoaXMuY3VycmVudFNsaWRlSW5kZXggKyBzbGlkZURlbHRhKTtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgoc2xpZGVOdW1iZXIpe1xuICAgICAgICAvL3VwZGF0ZXMgSFRNTCBhbmQgYWxzbyBzZXRzIHRoaXMuY3VycmVudFNsaWRlSW5kZXggdG8gc2xpZGVOdW1iZXJcblxuICAgICAgICBsZXQgcHJldlNsaWRlTnVtYmVyID0gdGhpcy5jdXJyZW50U2xpZGVJbmRleDtcbiAgICAgICAgdGhpcy5jdXJyZW50U2xpZGVJbmRleCA9IHNsaWRlTnVtYmVyO1xuXG5cbiAgICAgICAgLy9oaWRlIHRoZSBIVE1MIGVsZW1lbnRzIGZvciB0aGUgcHJldmlvdXMgc2xpZGVcblxuICAgICAgICAvL2l0ZW1zIHdpdGggY2xhc3MgZXhwLXNsaWRlXG4gICAgICAgIGlmKHByZXZTbGlkZU51bWJlciA8IHRoaXMuc2xpZGVzLmxlbmd0aCl7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1twcmV2U2xpZGVOdW1iZXJdLnN0eWxlLm9wYWNpdHkgPSAwO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvL2l0ZW1zIHdpdGggSFRNTCBjbGFzcyBleHAtc2xpZGUtblxuICAgICAgICBsZXQgcHJldlNsaWRlRWxlbXMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXhwLXNsaWRlLVwiKyhwcmV2U2xpZGVOdW1iZXIrMSkpXG4gICAgICAgIGZvcih2YXIgaT0wO2k8cHJldlNsaWRlRWxlbXMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICBwcmV2U2xpZGVFbGVtc1tpXS5zdHlsZS5vcGFjaXR5ID0gMDtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy9zaG93IHRoZSBIVE1MIGVsZW1lbnRzIGZvciB0aGUgY3VycmVudCBzbGlkZVxuICBcbiAgICAgICAgXG4gICAgICAgIC8vaXRlbXMgd2l0aCBIVE1MIGNsYXNzIGV4cC1zbGlkZS1uXG4gICAgICAgIGxldCBlbGVtc1RvRGlzcGxheU9ubHlPblRoaXNTbGlkZSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJleHAtc2xpZGUtXCIrKHNsaWRlTnVtYmVyKzEpKTtcblxuICAgICAgICBpZihzbGlkZU51bWJlciA+PSB0aGlzLm51bUhUTUxTbGlkZXMgJiYgZWxlbXNUb0Rpc3BsYXlPbmx5T25UaGlzU2xpZGUubGVuZ3RoID09IDApe1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlRyaWVkIHRvIHNob3cgc2xpZGUgI1wiK3NsaWRlTnVtYmVyK1wiLCBidXQgb25seSBcIiArIHRoaXMubnVtSFRNTFNsaWRlcyArIFwiSFRNTCBlbGVtZW50cyB3aXRoIGV4cC1zbGlkZSB3ZXJlIGZvdW5kISBNYWtlIG1vcmUgc2xpZGVzP1wiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvcih2YXIgaT0wO2k8ZWxlbXNUb0Rpc3BsYXlPbmx5T25UaGlzU2xpZGUubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICBlbGVtc1RvRGlzcGxheU9ubHlPblRoaXNTbGlkZVtpXS5zdHlsZS5vcGFjaXR5ID0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vaXRlbXMgd2l0aCBjbGFzcyBleHAtc2xpZGVcbiAgICAgICAgaWYoc2xpZGVOdW1iZXIgPCB0aGlzLnNsaWRlcy5sZW5ndGgpe1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbc2xpZGVOdW1iZXJdLnN0eWxlLm9wYWNpdHkgPSAxO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvL3ZlcmJzXG4gICAgYXN5bmMgZGVsYXkod2FpdFRpbWUpe1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIHdhaXRUaW1lKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIFRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TLCBvcHRpb25hbEFyZ3VtZW50cyl7XG4gICAgICAgIC8vaWYgc29tZW9uZSdzIHVzaW5nIHRoZSBvbGQgY2FsbGluZyBzdHJhdGVneSBvZiBzdGFnZ2VyRnJhY3Rpb24gYXMgdGhlIGxhc3QgYXJndW1lbnQsIGNvbnZlcnQgaXQgcHJvcGVybHlcbiAgICAgICAgaWYoVXRpbHMuaXNOdW1iZXIob3B0aW9uYWxBcmd1bWVudHMpKXtcbiAgICAgICAgICAgIG9wdGlvbmFsQXJndW1lbnRzID0ge3N0YWdnZXJGcmFjdGlvbjogb3B0aW9uYWxBcmd1bWVudHN9O1xuICAgICAgICB9XG4gICAgICAgIG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwLCBzdGFnZ2VyRnJhY3Rpb249c3RhZ2dlckZyYWN0aW9uLCBvcHRpb25hbEFyZ3VtZW50cyk7XG4gICAgfVxufVxuXG5cblxuXG5cblxuXG5jbGFzcyBVbmRvQ2FwYWJsZURpcmVjdG9yIGV4dGVuZHMgTm9uRGVjcmVhc2luZ0RpcmVjdG9ye1xuICAgIC8vdGhzaSBkaXJlY3RvciB1c2VzIGJvdGggZm9yd2FyZHMgYW5kIGJhY2t3YXJkcyBhcnJvd3MuIHRoZSBiYWNrd2FyZHMgYXJyb3cgd2lsbCB1bmRvIGFueSBVbmRvQ2FwYWJsZURpcmVjdG9yLlRyYW5zaXRpb25Ubygpc1xuICAgIC8vdG9kbzogaG9vayB1cCB0aGUgYXJyb3dzIGFuZCBtYWtlIGl0IG5vdFxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcblxuICAgICAgICB0aGlzLmZ1cnRoZXN0U2xpZGVJbmRleCA9IDA7IC8vbWF0Y2hlcyB0aGUgbnVtYmVyIG9mIHRpbWVzIG5leHRTbGlkZSgpIGhhcyBiZWVuIGNhbGxlZFxuICAgICAgICAvL3RoaXMuY3VycmVudFNsaWRlSW5kZXggaXMgYWx3YXlzIDwgdGhpcy5mdXJ0aGVzdFNsaWRlSW5kZXggLSBpZiBlcXVhbCwgd2UgcmVsZWFzZSB0aGUgcHJvbWlzZSBhbmQgbGV0IG5leHRTbGlkZSgpIHJldHVyblxuXG4gICAgICAgIHRoaXMudW5kb1N0YWNrID0gW107XG4gICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXggPSAwOyAvL2luY3JlYXNlZCBieSBvbmUgZXZlcnkgdGltZSBlaXRoZXIgdGhpcy5UcmFuc2l0aW9uVG8gaXMgY2FsbGVkIG9yIHRoaXMubmV4dFNsaWRlKCkgaXMgY2FsbGVkXG5cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vaWYgeW91IHByZXNzIHJpZ2h0IGJlZm9yZSB0aGUgZmlyc3QgZGlyZWN0b3IubmV4dFNsaWRlKCksIGRvbid0IGVycm9yXG4gICAgICAgIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gZnVuY3Rpb24oKXt9IFxuXG4gICAgICAgIGZ1bmN0aW9uIGtleUxpc3RlbmVyKGUpe1xuICAgICAgICAgICAgaWYoZS5yZXBlYXQpcmV0dXJuOyAvL2tleWRvd24gZmlyZXMgbXVsdGlwbGUgdGltZXMgYnV0IHdlIG9ubHkgd2FudCB0aGUgZmlyc3Qgb25lXG4gICAgICAgICAgICBsZXQgc2xpZGVEZWx0YSA9IDA7XG4gICAgICAgICAgICBzd2l0Y2ggKGUua2V5Q29kZSkge1xuICAgICAgICAgICAgICBjYXNlIDM0OlxuICAgICAgICAgICAgICBjYXNlIDM5OlxuICAgICAgICAgICAgICBjYXNlIDQwOlxuICAgICAgICAgICAgICAgIHNlbGYuaGFuZGxlRm9yd2FyZHNQcmVzcygpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDMzOlxuICAgICAgICAgICAgICBjYXNlIDM3OlxuICAgICAgICAgICAgICBjYXNlIDM4OlxuICAgICAgICAgICAgICAgIHNlbGYuaGFuZGxlQmFja3dhcmRzUHJlc3MoKTtcbiAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBrZXlMaXN0ZW5lcik7XG4gICAgfVxuXG4gICAgc2V0dXBDbGlja2FibGVzKCl7XG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLmxlZnRBcnJvdyA9IG5ldyBEaXJlY3Rpb25BcnJvdyhmYWxzZSk7XG4gICAgICAgIHRoaXMubGVmdEFycm93LmhpZGVTZWxmKCk7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5sZWZ0QXJyb3cuYXJyb3dJbWFnZSk7XG4gICAgICAgIHRoaXMubGVmdEFycm93Lm9uY2xpY2tDYWxsYmFjayA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBzZWxmLmhhbmRsZUJhY2t3YXJkc1ByZXNzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cgPSBuZXcgRGlyZWN0aW9uQXJyb3codHJ1ZSk7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yaWdodEFycm93LmFycm93SW1hZ2UpO1xuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cub25jbGlja0NhbGxiYWNrID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHNlbGYuaGFuZGxlRm9yd2FyZHNQcmVzcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbW92ZUZ1cnRoZXJJbnRvUHJlc2VudGF0aW9uKCl7XG4gICAgICAgICAgICAvL2lmIHRoZXJlJ3Mgbm90aGluZyB0byByZWRvLCAoc28gd2UncmUgbm90IGluIHRoZSBwYXN0IG9mIHRoZSB1bmRvIHN0YWNrKSwgYWR2YW5jZSBmdXJ0aGVyLlxuICAgICAgICAgICAgLy9pZiB0aGVyZSBhcmUgbGVzcyBIVE1MIHNsaWRlcyB0aGFuIGNhbGxzIHRvIGRpcmVjdG9yLm5ld1NsaWRlKCksIGNvbXBsYWluIGluIHRoZSBjb25zb2xlIGJ1dCBhbGxvdyB0aGUgcHJlc2VudGF0aW9uIHRvIHByb2NlZWRcbiAgICAgICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPCB0aGlzLm51bVNsaWRlcyl7XG4gICAgICAgICAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCArPSAxOyAvL2FkdmFuY2UgcGFzdCB0aGUgTmV3U2xpZGVVbmRvSXRlbVxuICAgICAgICAgICAgICAgIHRoaXMuZnVydGhlc3RTbGlkZUluZGV4ICs9IDE7IFxuXG4gICAgICAgICAgICAgICAgdGhpcy5zd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KHRoaXMuY3VycmVudFNsaWRlSW5kZXggKyAxKTsgLy90aGlzIHdpbGwgY29tcGxhaW4gaW4gdGhlIGNvbnNvbGUgd2luZG93IGlmIHRoZXJlIGFyZSBsZXNzIHNsaWRlcyB0aGFuIG5ld1NsaWRlKCkgY2FsbHNcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dBcnJvd3MoKTsgLy9zaG93QXJyb3dzIG11c3QgY29tZSBhZnRlciB0aGlzLmN1cnJlbnRTbGlkZUluZGV4IGFkdmFuY2VzIG9yIGVsc2Ugd2Ugd29uJ3QgYmUgYWJsZSB0byB0ZWxsIGlmIHdlJ3JlIGF0IHRoZSBlbmQgb3Igbm90XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpOyAvL2FsbG93IHByZXNlbnRhdGlvbiBjb2RlIHRvIHByb2NlZWRcbiAgICB9XG5cbiAgICBoYW5kbGVGb3J3YXJkc1ByZXNzKCl7XG4gICAgICAgIHRoaXMucmlnaHRBcnJvdy5oaWRlU2VsZigpO1xuXG4gICAgICAgIGlmKHRoaXMuZnVydGhlc3RTbGlkZUluZGV4ID09IHRoaXMuY3VycmVudFNsaWRlSW5kZXgpe1xuICAgICAgICAgICAgLy9pZiBub3RoaW5nIHRvIHJlZG9cbiAgICAgICAgICAgIHRoaXMubW92ZUZ1cnRoZXJJbnRvUHJlc2VudGF0aW9uKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgd2UgZ2V0IHRvIGhlcmUsIHdlJ3ZlIHByZXZpb3VzbHkgZG9uZSBhbiB1bmRvIGFuZCB3ZSBuZWVkIHRvIGNhdGNoIHVwXG5cbiAgICAgICAgaWYodGhpcy51bmRvU3RhY2tJbmRleCA8IHRoaXMudW5kb1N0YWNrLmxlbmd0aC0xKSB0aGlzLnVuZG9TdGFja0luZGV4ICs9IDE7XG5cbiAgICAgICAgd2hpbGUodGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF0uY29uc3RydWN0b3IgIT09IE5ld1NsaWRlVW5kb0l0ZW0pe1xuICAgICAgICAgICAgLy9sb29wIHRocm91Z2ggdW5kbyBzdGFjayBhbmQgcmVkbyBlYWNoIHVuZG9cblxuICAgICAgICAgICAgbGV0IHJlZG9JdGVtID0gdGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF1cbiAgICAgICAgICAgIHN3aXRjaChyZWRvSXRlbS50eXBlKXtcbiAgICAgICAgICAgICAgICBjYXNlIERFTEFZOlxuICAgICAgICAgICAgICAgICAgICAvL3doaWxlIHJlZG9pbmcsIHNraXAgYW55IGRlbGF5c1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFRSQU5TSVRJT05UTzpcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlZG9BbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKHJlZG9JdGVtLnRhcmdldCwgcmVkb0l0ZW0udG9WYWx1ZXMsIHJlZG9JdGVtLmR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IHJlZG9JdGVtLmR1cmF0aW9uTVMvMTAwMCwgcmVkb0l0ZW0ub3B0aW9uYWxBcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgLy9hbmQgbm93IHJlZG9BbmltYXRpb24sIGhhdmluZyBiZWVuIGNyZWF0ZWQsIGdvZXMgb2ZmIGFuZCBkb2VzIGl0cyBvd24gdGhpbmcgSSBndWVzcy4gdGhpcyBzZWVtcyBpbmVmZmljaWVudC4gdG9kbzogZml4IHRoYXQgYW5kIG1ha2UgdGhlbSBhbGwgY2VudHJhbGx5IHVwZGF0ZWQgYnkgdGhlIGFuaW1hdGlvbiBsb29wIG9yc29tZXRoaW5nXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgTkVXU0xJREU6XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZih0aGlzLnVuZG9TdGFja0luZGV4ID09IHRoaXMudW5kb1N0YWNrLmxlbmd0aC0xKXtcbiAgICAgICAgICAgICAgICAvL2Z1bGx5IHJlZG9uZSBhbmQgYXQgY3VycmVudCBzbGlkZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ICs9IDE7XG5cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgodGhpcy5jdXJyZW50U2xpZGVJbmRleCArIDEpO1xuICAgICAgICB0aGlzLnNob3dBcnJvd3MoKTtcbiAgICB9XG5cbiAgICBoYW5kbGVCYWNrd2FyZHNQcmVzcygpe1xuICAgICAgICB0aGlzLmxlZnRBcnJvdy5oaWRlU2VsZigpO1xuXG4gICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPT0gMCB8fCB0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IDApe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCAtPSAxO1xuICAgICAgICB3aGlsZSh0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XS5jb25zdHJ1Y3RvciAhPT0gTmV3U2xpZGVVbmRvSXRlbSl7XG4gICAgICAgICAgICAvL2xvb3AgdGhyb3VnaCB1bmRvIHN0YWNrIGFuZCByZWRvIGVhY2ggdW5kb1xuXG4gICAgICAgICAgICBpZih0aGlzLnVuZG9TdGFja0luZGV4ID09IDApe1xuICAgICAgICAgICAgICAgIC8vYXQgZmlyc3Qgc2xpZGVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy91bmRvIHRyYW5zZm9ybWF0aW9uIGluIHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdXG4gICAgICAgICAgICBsZXQgdW5kb0l0ZW0gPSB0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XTtcbiAgICAgICAgICAgIHN3aXRjaCh1bmRvSXRlbS50eXBlKXtcbiAgICAgICAgICAgICAgICBjYXNlIERFTEFZOlxuICAgICAgICAgICAgICAgICAgICAvL3doaWxlIHVuZG9pbmcsIHNraXAgYW55IGRlbGF5c1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFRSQU5TSVRJT05UTzpcbiAgICAgICAgICAgICAgICAgICAgbGV0IGR1cmF0aW9uID0gdW5kb0l0ZW0uZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gMSA6IHVuZG9JdGVtLmR1cmF0aW9uTVMvMTAwMDtcbiAgICAgICAgICAgICAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1pbihkdXJhdGlvbiAvIDIsIDEpOyAvL3VuZG9pbmcgc2hvdWxkIGJlIGZhc3Rlciwgc28gY3V0IGl0IGluIGhhbGYgLSBidXQgY2FwIGR1cmF0aW9ucyBhdCAxc1xuICAgICAgICAgICAgICAgICAgICAvL3RvZG86IGludmVydCB0aGUgZWFzaW5nIG9mIHRoZSB1bmRvSXRlbSB3aGVuIGNyZWF0aW5nIHRoZSB1bmRvIGFuaW1hdGlvbj9cbiAgICAgICAgICAgICAgICAgICAgbGV0IGVhc2luZyA9IEVhc2luZy5FYXNlSW5PdXQ7XG4gICAgICAgICAgICAgICAgICAgIHZhciB1bmRvQW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbih1bmRvSXRlbS50YXJnZXQsIHVuZG9JdGVtLmZyb21WYWx1ZXMsIGR1cmF0aW9uLCB7c3RhZ2dlckZyYWN0aW9uOjAsIGVhc2luZzogZWFzaW5nfSk7XG4gICAgICAgICAgICAgICAgICAgIC8vYW5kIG5vdyB1bmRvQW5pbWF0aW9uLCBoYXZpbmcgYmVlbiBjcmVhdGVkLCBnb2VzIG9mZiBhbmQgZG9lcyBpdHMgb3duIHRoaW5nIEkgZ3Vlc3MuIHRoaXMgc2VlbXMgaW5lZmZpY2llbnQuIHRvZG86IGZpeCB0aGF0IGFuZCBtYWtlIHRoZW0gYWxsIGNlbnRyYWxseSB1cGRhdGVkIGJ5IHRoZSBhbmltYXRpb24gbG9vcCBvcnNvbWV0aGluZ1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIE5FV1NMSURFOlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXggLT0gMTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgodGhpcy5jdXJyZW50U2xpZGVJbmRleCAtIDEpO1xuICAgICAgICB0aGlzLnNob3dBcnJvd3MoKTtcbiAgICB9XG5cbiAgICBzaG93QXJyb3dzKCl7XG4gICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPiAwKXtcbiAgICAgICAgICAgIHRoaXMubGVmdEFycm93LnNob3dTZWxmKCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5sZWZ0QXJyb3cuaGlkZVNlbGYoKTtcbiAgICAgICAgfVxuICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4IDwgdGhpcy5udW1TbGlkZXMpe1xuICAgICAgICAgICAgdGhpcy5yaWdodEFycm93LnNob3dTZWxmKCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5yaWdodEFycm93LmhpZGVTZWxmKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBuZXh0U2xpZGUoKXtcbiAgICAgICAgLypUaGUgdXNlciB3aWxsIGNhbGwgdGhpcyBmdW5jdGlvbiB0byBtYXJrIHRoZSB0cmFuc2l0aW9uIGJldHdlZW4gb25lIHNsaWRlIGFuZCB0aGUgbmV4dC4gVGhpcyBkb2VzIHR3byB0aGluZ3M6XG4gICAgICAgIEEpIHdhaXRzIHVudGlsIHRoZSB1c2VyIHByZXNzZXMgdGhlIHJpZ2h0IGFycm93IGtleSwgcmV0dXJucywgYW5kIGNvbnRpbnVlcyBleGVjdXRpb24gdW50aWwgdGhlIG5leHQgbmV4dFNsaWRlKCkgY2FsbFxuICAgICAgICBCKSBpZiB0aGUgdXNlciBwcmVzc2VzIHRoZSBsZWZ0IGFycm93IGtleSwgdGhleSBjYW4gdW5kbyBhbmQgZ28gYmFjayBpbiB0aW1lLCBhbmQgZXZlcnkgVHJhbnNpdGlvblRvKCkgY2FsbCBiZWZvcmUgdGhhdCB3aWxsIGJlIHVuZG9uZSB1bnRpbCBpdCByZWFjaGVzIGEgcHJldmlvdXMgbmV4dFNsaWRlKCkgY2FsbC4gQW55IG5vcm1hbCBqYXZhc2NyaXB0IGFzc2lnbm1lbnRzIHdvbid0IGJlIGNhdWdodCBpbiB0aGlzIDooXG4gICAgICAgIEMpIGlmIHVuZG9cbiAgICAgICAgKi9cbiAgICAgICAgaWYoIXRoaXMuaW5pdGlhbGl6ZWQpdGhyb3cgbmV3IEVycm9yKFwiRVJST1I6IFVzZSAuYmVnaW4oKSBvbiBhIERpcmVjdG9yIGJlZm9yZSBjYWxsaW5nIGFueSBvdGhlciBtZXRob2RzIVwiKTtcblxuICAgICAgICBcbiAgICAgICAgdGhpcy5udW1TbGlkZXMrKztcbiAgICAgICAgdGhpcy51bmRvU3RhY2sucHVzaChuZXcgTmV3U2xpZGVVbmRvSXRlbSh0aGlzLmN1cnJlbnRTbGlkZUluZGV4KSk7XG4gICAgICAgIHRoaXMuc2hvd0Fycm93cygpO1xuXG5cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vcHJvbWlzZSBpcyByZXNvbHZlZCBieSBjYWxsaW5nIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uKCkgd2hlbiB0aGUgdGltZSBjb21lc1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgIHNlbGYubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gZnVuY3Rpb24oKXsgXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIGFzeW5jIGRlbGF5KHdhaXRUaW1lKXtcbiAgICAgICAgdGhpcy51bmRvU3RhY2sucHVzaChuZXcgRGVsYXlVbmRvSXRlbSh3YWl0VGltZSkpO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4Kys7XG4gICAgICAgIGF3YWl0IHN1cGVyLmRlbGF5KHdhaXRUaW1lKTtcbiAgICB9XG4gICAgVHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMsIG9wdGlvbmFsQXJndW1lbnRzKXtcbiAgICAgICAgdmFyIGFuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwLCBvcHRpb25hbEFyZ3VtZW50cyk7XG4gICAgICAgIGxldCBmcm9tVmFsdWVzID0gYW5pbWF0aW9uLmZyb21WYWx1ZXM7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrLnB1c2gobmV3IFVuZG9JdGVtKHRhcmdldCwgdG9WYWx1ZXMsIGZyb21WYWx1ZXMsIGR1cmF0aW9uTVMsIG9wdGlvbmFsQXJndW1lbnRzKSk7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXgrKztcbiAgICB9XG59XG5cblxuLy9kaXNjb3VudCBlbnVtXG5jb25zdCBUUkFOU0lUSU9OVE8gPSAwO1xuY29uc3QgTkVXU0xJREUgPSAxO1xuY29uc3QgREVMQVk9MjtcblxuLy90aGluZ3MgdGhhdCBjYW4gYmUgc3RvcmVkIGluIGEgVW5kb0NhcGFibGVEaXJlY3RvcidzIC51bmRvU3RhY2tbXVxuY2xhc3MgVW5kb0l0ZW17XG4gICAgY29uc3RydWN0b3IodGFyZ2V0LCB0b1ZhbHVlcywgZnJvbVZhbHVlcywgZHVyYXRpb25NUywgb3B0aW9uYWxBcmd1bWVudHMpe1xuICAgICAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcbiAgICAgICAgdGhpcy50b1ZhbHVlcyA9IHRvVmFsdWVzO1xuICAgICAgICB0aGlzLmZyb21WYWx1ZXMgPSBmcm9tVmFsdWVzO1xuICAgICAgICB0aGlzLmR1cmF0aW9uTVMgPSBkdXJhdGlvbk1TO1xuICAgICAgICB0aGlzLnR5cGUgPSBUUkFOU0lUSU9OVE87XG4gICAgICAgIHRoaXMub3B0aW9uYWxBcmd1bWVudHMgPSBvcHRpb25hbEFyZ3VtZW50cztcbiAgICB9XG59XG5cbmNsYXNzIE5ld1NsaWRlVW5kb0l0ZW17XG4gICAgY29uc3RydWN0b3Ioc2xpZGVJbmRleCl7XG4gICAgICAgIHRoaXMuc2xpZGVJbmRleCA9IHNsaWRlSW5kZXg7XG4gICAgICAgIHRoaXMudHlwZSA9IE5FV1NMSURFO1xuICAgIH1cbn1cblxuY2xhc3MgRGVsYXlVbmRvSXRlbXtcbiAgICBjb25zdHJ1Y3Rvcih3YWl0VGltZSl7XG4gICAgICAgIHRoaXMud2FpdFRpbWUgPSB3YWl0VGltZTtcbiAgICAgICAgdGhpcy50eXBlID0gREVMQVk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBOb25EZWNyZWFzaW5nRGlyZWN0b3IsIERpcmVjdGlvbkFycm93LCBVbmRvQ2FwYWJsZURpcmVjdG9yIH07XG4iXSwibmFtZXMiOlsiTWF0aCIsIlV0aWxzIiwidGhyZWVFbnZpcm9ubWVudCIsIm1hdGgubGVycFZlY3RvcnMiLCJyZXF1aXJlIiwicmVxdWlyZSQkMCIsInJlcXVpcmUkJDEiLCJyZXF1aXJlJCQyIiwiZ2xvYmFsIiwidlNoYWRlciIsImZTaGFkZXIiLCJ1bmlmb3JtcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0NBQUE7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFQSxNQUFNLElBQUk7Q0FDVixDQUFDLFdBQVcsRUFBRTtDQUNkLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7Q0FDckIsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztDQUNyQixLQUFLO0NBQ0wsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0NBQ1g7Q0FDQSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQzVCLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Q0FDdEIsRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO0NBQ2pDLEVBQUUsT0FBTyxLQUFLLENBQUM7Q0FDZixFQUFFO0NBQ0YsQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNYLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztDQUNkLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDN0MsRUFBRSxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUMsR0FBRztDQUN2QixHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0NBQ3ZCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDO0NBQ3BDLEdBQUc7Q0FDSCxFQUFFLE9BQU8sSUFBSSxDQUFDO0NBQ2QsRUFBRTtDQUNGLElBQUksWUFBWSxFQUFFO0NBQ2xCLFFBQVEsTUFBTSxT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QUFJLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztDQUNsQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLElBQUk7Q0FDSixHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsQ0FBQztDQUNuQztDQUNBLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDNUMsSUFBSSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEcsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM3QyxLQUFLLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN2RyxLQUFLLElB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Q0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPRyxlQUFPLEVBQUUsVUFBVSxFQUFFQSxlQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU9BLGVBQU8sRUFBRSxVQUFVLEVBQUVBLGVBQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsWUFBWSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksR0FBRyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxZQUFZLEtBQUssQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsb0JBQW1CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQyxxQ0FBcUMsQ0FBQyxrREFBa0QsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsT0FBTyxPQUFPLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEdBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxHQUFHLFFBQVEsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsZ0JBQWdCLENBQUMsU0FBUyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGdCQUFnQixDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUMsQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLE9BQU8sVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsU0FBUyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxPQUFPLEdBQUcsR0FBRyxVQUFVLENBQUMsU0FBUyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxPQUFPLEdBQUcsR0FBRyxRQUFRLENBQUMsU0FBUyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxPQUFPLEdBQUcsR0FBRyxRQUFRLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEdBQUcsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFFLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBRyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLFVBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLFlBQVksQ0FBQyxDQUFDLEdBQUcsWUFBWSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQVksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBSyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxPQUFPLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxHQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsSUFBSSxFQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFLLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyw0QkFBNEIsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQUFBbUIsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFLLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU0sR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVUsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksV0FBVyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsU0FBUyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxHQUFHLFNBQVMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsRUFBRSxTQUFTLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLFNBQVMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxNQUFNLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLE1BQU0sUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLEVBQUUsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxBQUF3QixJQUFJLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLEVBQUUsZUFBZSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksY0FBYyxDQUFDLEVBQUUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLEFBQWEsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsSUFBSSxjQUFjLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLFFBQVEsQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsV0FBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLFNBQVMsQ0FBQyxPQUFPLFdBQVcsQ0FBQyxTQUFTLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEdBQUcsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFTLENBQUMsU0FBUyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsU0FBUyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLEVBQUUsV0FBVyxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLGFBQWEsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLFFBQVEsR0FBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLFNBQVMsV0FBVyxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLDZGQUE2RixDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFDLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxVQUFVLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxHQUFHLEdBQUcsR0FBRyxPQUFPLEVBQUUsR0FBRyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxHQUFHLElBQUksT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxHQUFHLElBQUksYUFBYSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxhQUFhLENBQUMsR0FBRyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFDLENBQUMsR0FBRyxPQUFPLFNBQVMsR0FBRyxXQUFXLEVBQUUsU0FBUyxHQUFHLElBQUksRUFBRSxLQUFLLFlBQVksU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEtBQUssR0FBRyxPQUFPLHdCQUF3QixHQUFHLFdBQVcsRUFBRSx3QkFBd0IsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLHdCQUF3QixFQUFFLE9BQU8scUJBQXFCLEdBQUcsV0FBVyxFQUFFLHFCQUFxQixHQUFHLElBQUksRUFBRSxLQUFLLFlBQVkscUJBQXFCLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBSyxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaURBQWlELENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFNLFVBQVUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxPQUFPLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxPQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsU0FBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsWUFBWSxFQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsR0FBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLE1BQUssQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEdBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FB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SUFBSSxxQkFBcUIsQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxXQUFXLENBQUM7Q0FDN0U7Q0FDQSxRQUFRLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUM7Q0FDL0QsUUFBUSxJQUFJLEtBQUssR0FBRyxXQUFXLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQzs7Q0FFeEMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7O0NBRTVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDOztDQUU1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQzs7Q0FFNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzdDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUM7O0NBRTdDLFFBQVEsSUFBSSxjQUFjLEdBQUcsSUFB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R0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNwQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUMsS0FBSyxJQUFJO0NBQ1Q7Q0FDQSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUMsS0FBSyxjQUFjLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDMUIsS0FBSzs7Q0FFTDtDQUNBO0NBQ0EsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ2xKO0NBQ0EsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFD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
