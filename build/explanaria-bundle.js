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





	const FORWARDS = 1;
	const BACKWARDS = 2;
	const NO_SLIDE_MOVEMENT = 3;

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
	        this.rightArrow.hideSelf();

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

	        //Assumption: this.undoStack[this.undoStackIndex] is a NewSlideUndoItem
	        await this.redoAnItem(this.undoStack[this.undoStackIndex]);
	        this.undoStackIndex += 1;

	        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
	            //loop through undo stack and redo each undo until we get to the next slide

	            //If there's a delay somewhere in the undo stack, and we sleep for some amount of time, the user might have pressed undo during that time. In that case, handleBackwardsPress() will set this.currentReplayDirection to BACKWARDS. But we're still running, so we should stop redoing!
	            if(this.currentReplayDirection != FORWARDS){
	                return;
	            }

	            let redoItem = this.undoStack[this.undoStackIndex];
	            await this.redoAnItem(redoItem);

	            if(this.undoStackIndex == this.undoStack.length-1){
	                break;
	            }
	            
	            this.undoStackIndex += 1;

	        }
	        this.currentReplayDirection = NO_SLIDE_MOVEMENT;
	        this.switchDisplayedSlideIndex(this.currentSlideIndex + 1);
	        this.showArrows();
	    }

	    async redoAnItem(redoItem){
	        switch(redoItem.type){
	            case DELAY:
	                //while redoing, skip delays
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
	    }

	    handleBackwardsPress(){
	        this.leftArrow.hideSelf();

	        if(this.undoStackIndex == 0 || this.currentSlideIndex == 0){
	            return;
	        }

	        //only undo if we're not already undoing
	        if(this.currentReplayDirection == BACKWARDS)return;
	        this.currentReplayDirection = BACKWARDS;

	        //Assumption: this.undoStack[this.undoStackIndex] is a NewSlideUndoItem
	        this.undoAnItem(this.undoStack[this.undoStackIndex]);
	        this.undoStackIndex -= 1;

	        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
	            //loop through undo stack and undo each item until we reach the previous slide

	            if(this.undoStackIndex == 0){
	                //at first slide
	                break;
	            }

	            //If there's a delay somewhere in the undo stack, and we sleep for some amount of time, the user might have pressed redo during that time. In that case, handleForwardsPress() will set this.currentReplayDirection to FORWARDS. But we're still running, so we should stop redoing!
	            if(this.currentReplayDirection != BACKWARDS){
	                return;
	            }

	            //undo transformation in this.undoStack[this.undoStackIndex]
	            let undoItem = this.undoStack[this.undoStackIndex];
	            this.undoAnItem(undoItem);
	            this.undoStackIndex -= 1;
	        }

	        this.currentReplayDirection = NO_SLIDE_MOVEMENT;
	        this.switchDisplayedSlideIndex(this.currentSlideIndex - 1);
	        this.showArrows();
	    }

	    undoAnItem(undoItem){
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
	        await this._sleep(waitTime);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9IaXN0b3J5UmVjb3JkZXIuanMiLCIuLi9zcmMvanMvVGhyZWVFbnZpcm9ubWVudC5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL291dHB1dHMvTGluZU91dHB1dFNoYWRlcnMuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9MaW5lT3V0cHV0LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvUG9pbnRPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9WZWN0b3JPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9TdXJmYWNlT3V0cHV0U2hhZGVycy5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1N1cmZhY2VPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9GbGF0QXJyYXlPdXRwdXQuanMiLCIuLi9zcmMvanMvRGlyZWN0b3JJbWFnZUNvbnN0YW50cy5qcyIsIi4uL3NyYy9qcy9EaXJlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBUaGUgYmFzZSBjbGFzcyB0aGF0IGV2ZXJ5dGhpbmcgaW5oZXJpdHMgZnJvbS4gXG5cdEVhY2ggdGhpbmcgZHJhd24gdG8gdGhlIHNjcmVlbiBpcyBhIHRyZWUuIERvbWFpbnMsIHN1Y2ggYXMgRVhQLkFyZWEgb3IgRVhQLkFycmF5IGFyZSB0aGUgcm9vdCBub2Rlcyxcblx0RVhQLlRyYW5zZm9ybWF0aW9uIGlzIGN1cnJlbnRseSB0aGUgb25seSBpbnRlcm1lZGlhdGUgbm9kZSwgYW5kIHRoZSBsZWFmIG5vZGVzIGFyZSBzb21lIGZvcm0gb2YgT3V0cHV0IHN1Y2ggYXNcblx0RVhQLkxpbmVPdXRwdXQgb3IgRVhQLlBvaW50T3V0cHV0LCBvciBFWFAuVmVjdG9yT3V0cHV0LlxuXG5cdEFsbCBvZiB0aGVzZSBjYW4gYmUgLmFkZCgpZWQgdG8gZWFjaCBvdGhlciB0byBmb3JtIHRoYXQgdHJlZSwgYW5kIHRoaXMgZmlsZSBkZWZpbmVzIGhvdyBpdCB3b3Jrcy5cbiovXG5cbmNsYXNzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKCl7ICAgICAgICBcblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsOyAgICAgICAgXG4gICAgfVxuXHRhZGQodGhpbmcpe1xuXHRcdC8vY2hhaW5hYmxlIHNvIHlvdSBjYW4gYS5hZGQoYikuYWRkKGMpIHRvIG1ha2UgYS0+Yi0+Y1xuXHRcdHRoaXMuY2hpbGRyZW4ucHVzaCh0aGluZyk7XG5cdFx0dGhpbmcucGFyZW50ID0gdGhpcztcblx0XHRpZih0aGluZy5fb25BZGQpdGhpbmcuX29uQWRkKCk7XG5cdFx0cmV0dXJuIHRoaW5nO1xuXHR9XG5cdF9vbkFkZCgpe31cblx0cmVtb3ZlKHRoaW5nKXtcblx0XHR2YXIgaW5kZXggPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoIHRoaW5nICk7XG5cdFx0aWYgKCBpbmRleCAhPT0gLSAxICkge1xuXHRcdFx0dGhpbmcucGFyZW50ID0gbnVsbDtcblx0XHRcdHRoaXMuY2hpbGRyZW4uc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuICAgIGdldFRvcFBhcmVudCgpeyAvL2ZpbmQgdGhlIHBhcmVudCBvZiB0aGUgcGFyZW50IG9mIHRoZS4uLiB1bnRpbCB0aGVyZSdzIG5vIG1vcmUgcGFyZW50cy5cbiAgICAgICAgY29uc3QgTUFYX0NIQUlOID0gMTAwO1xuICAgICAgICBsZXQgcGFyZW50Q291bnQgPSAwO1xuXHRcdGxldCByb290ID0gdGhpcztcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmIHBhcmVudENvdW50IDwgTUFYX0NIQUlOKXtcblx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcbiAgICAgICAgICAgIHBhcmVudENvdW50Kz0gMTtcblx0XHR9XG5cdFx0aWYocGFyZW50Q291bnQgPj0gTUFYX0NIQUlOKXRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIHRvcC1sZXZlbCBwYXJlbnQhXCIpO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9XG4gICAgZ2V0RGVlcGVzdENoaWxkcmVuKCl7IC8vZmluZCBhbGwgbGVhZiBub2RlcyBmcm9tIHRoaXMgbm9kZVxuICAgICAgICAvL3RoaXMgYWxnb3JpdGhtIGNhbiBwcm9iYWJseSBiZSBpbXByb3ZlZFxuICAgICAgICBpZih0aGlzLmNoaWxkcmVuLmxlbmd0aCA9PSAwKXJldHVybiBbdGhpc107XG5cbiAgICAgICAgbGV0IGNoaWxkcmVuID0gW107XG4gICAgICAgIGZvcihsZXQgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGxldCBjaGlsZHNDaGlsZHJlbiA9IHRoaXMuY2hpbGRyZW5baV0uZ2V0RGVlcGVzdENoaWxkcmVuKCk7XG4gICAgICAgICAgICBmb3IobGV0IGo9MDtqPGNoaWxkc0NoaWxkcmVuLmxlbmd0aDtqKyspe1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goY2hpbGRzQ2hpbGRyZW5bal0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG4gICAgZ2V0Q2xvc2VzdERvbWFpbigpe1xuICAgICAgICAvKiBGaW5kIHRoZSBEb21haW5Ob2RlIHRoYXQgdGhpcyBOb2RlIGlzIGJlaW5nIGNhbGxlZCBmcm9tLlxuICAgICAgICBUcmF2ZXJzZSB0aGUgY2hhaW4gb2YgcGFyZW50cyB1cHdhcmRzIHVudGlsIHdlIGZpbmQgYSBEb21haW5Ob2RlLCBhdCB3aGljaCBwb2ludCB3ZSByZXR1cm4gaXQuXG4gICAgICAgIFRoaXMgYWxsb3dzIGFuIG91dHB1dCB0byByZXNpemUgYW4gYXJyYXkgdG8gbWF0Y2ggYSBkb21haW5Ob2RlJ3MgbnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBmb3IgZXhhbXBsZS5cblxuICAgICAgICBOb3RlIHRoYXQgdGhpcyByZXR1cm5zIHRoZSBNT1NUIFJFQ0VOVCBEb21haW5Ob2RlIGFuY2VzdG9yIC0gaXQncyBhc3N1bWVkIHRoYXQgZG9tYWlubm9kZXMgb3ZlcndyaXRlIG9uZSBhbm90aGVyLlxuICAgICAgICAqL1xuICAgICAgICBjb25zdCBNQVhfQ0hBSU4gPSAxMDA7XG4gICAgICAgIGxldCBwYXJlbnRDb3VudCA9IDA7XG5cdFx0bGV0IHJvb3QgPSB0aGlzLnBhcmVudDsgLy9zdGFydCBvbmUgbGV2ZWwgdXAgaW4gY2FzZSB0aGlzIGlzIGEgRG9tYWluTm9kZSBhbHJlYWR5LiB3ZSBkb24ndCB3YW50IHRoYXRcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmICFyb290LmlzRG9tYWluTm9kZSAmJiBwYXJlbnRDb3VudCA8IE1BWF9DSEFJTil7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG4gICAgICAgICAgICBwYXJlbnRDb3VudCs9IDE7XG5cdFx0fVxuXHRcdGlmKHBhcmVudENvdW50ID49IE1BWF9DSEFJTil0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBwYXJlbnQhXCIpO1xuICAgICAgICBpZihyb290ID09PSBudWxsIHx8ICFyb290LmlzRG9tYWluTm9kZSl0aHJvdyBuZXcgRXJyb3IoXCJObyBEb21haW5Ob2RlIHBhcmVudCBmb3VuZCFcIik7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH1cblxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblx0XHQvL2J1dCBjYWxsIGFsbCBjaGlsZHJlblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0ub25BZnRlckFjdGl2YXRpb24oKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgT3V0cHV0Tm9kZSBleHRlbmRzIE5vZGV7IC8vbW9yZSBvZiBhIGphdmEgaW50ZXJmYWNlLCByZWFsbHlcblx0Y29uc3RydWN0b3IoKXtzdXBlcigpO31cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope31cblx0b25BZnRlckFjdGl2YXRpb24oKXt9XG5cdF9vbkFkZCgpe31cbn1cblxuY2xhc3MgRG9tYWluTm9kZSBleHRlbmRzIE5vZGV7IC8vQSBub2RlIHRoYXQgY2FsbHMgb3RoZXIgZnVuY3Rpb25zIG92ZXIgc29tZSByYW5nZS5cblx0Y29uc3RydWN0b3IoKXtcbiAgICAgICAgc3VwZXIoKTtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSBudWxsOyAvLyBudW1iZXIgb2YgdGltZXMgYW55IGNoaWxkIG5vZGUncyBldmFsdWF0ZVNlbGYoKSBpcyBjYWxsZWRcbiAgICB9XG4gICAgYWN0aXZhdGUodCl7fVxufVxuRG9tYWluTm9kZS5wcm90b3R5cGUuaXNEb21haW5Ob2RlID0gdHJ1ZTtcblxuZXhwb3J0IGRlZmF1bHQgTm9kZTtcbmV4cG9ydCB7T3V0cHV0Tm9kZSwgRG9tYWluTm9kZX07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9ICBmcm9tICcuL05vZGUuanMnO1xuY2xhc3MgRVhQQXJyYXkgZXh0ZW5kcyBEb21haW5Ob2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHRzdXBlcigpO1xuXHRcdC8qdmFyIHBvaW50cyA9IG5ldyBFWFAuQXJyYXkoe1xuXHRcdGRhdGE6IFtbLTEwLDEwXSxcblx0XHRcdFsxMCwxMF1dXG5cdFx0fSkqL1xuXG5cdFx0RVhQLlV0aWxzLmFzc2VydFByb3BFeGlzdHMob3B0aW9ucywgXCJkYXRhXCIpOyAvLyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXkuIGFzc3VtZWQgdG8gb25seSBjb250YWluIG9uZSB0eXBlOiBlaXRoZXIgbnVtYmVycyBvciBhcnJheXNcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmRhdGEsIEFycmF5KTtcblxuXHRcdC8vSXQncyBhc3N1bWVkIGFuIEVYUC5BcnJheSB3aWxsIG9ubHkgc3RvcmUgdGhpbmdzIHN1Y2ggYXMgMCwgWzBdLCBbMCwwXSBvciBbMCwwLDBdLiBJZiBhbiBhcnJheSB0eXBlIGlzIHN0b3JlZCwgdGhpcy5hcnJheVR5cGVEaW1lbnNpb25zIGNvbnRhaW5zIHRoZSAubGVuZ3RoIG9mIHRoYXQgYXJyYXkuIE90aGVyd2lzZSBpdCdzIDAsIGJlY2F1c2UgcG9pbnRzIGFyZSAwLWRpbWVuc2lvbmFsLlxuXHRcdGlmKG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3RvciA9PT0gTnVtYmVyKXtcblx0XHRcdHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyA9IDA7XG5cdFx0fWVsc2UgaWYob3B0aW9ucy5kYXRhWzBdLmNvbnN0cnVjdG9yID09PSBBcnJheSl7XG5cdFx0XHR0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPSBvcHRpb25zLmRhdGFbMF0ubGVuZ3RoO1xuXHRcdH1lbHNle1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkRhdGEgaW4gYW4gRVhQLkFycmF5IHNob3VsZCBiZSBhIG51bWJlciBvciBhbiBhcnJheSBvZiBvdGhlciB0aGluZ3MsIG5vdCBcIiArIG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3Rvcik7XG5cdFx0fVxuXG5cblx0XHRFWFAuVXRpbHMuYXNzZXJ0KG9wdGlvbnMuZGF0YVswXS5sZW5ndGggIT0gMCk7IC8vZG9uJ3QgYWNjZXB0IFtbXV0sIGRhdGEgbmVlZHMgdG8gYmUgc29tZXRoaW5nIGxpa2UgW1sxLDJdXS5cblxuXHRcdHRoaXMuZGF0YSA9IG9wdGlvbnMuZGF0YTtcblx0XHR0aGlzLm51bUl0ZW1zID0gdGhpcy5kYXRhLmxlbmd0aDtcblxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbdGhpcy5kYXRhLmxlbmd0aF07IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdC8vdGhlIG51bWJlciBvZiB0aW1lcyBldmVyeSBjaGlsZCdzIGV4cHIgaXMgY2FsbGVkXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSB0aGlzLml0ZW1EaW1lbnNpb25zLnJlZHVjZSgoc3VtLHkpPT5zdW0qeSk7XG5cdH1cblx0YWN0aXZhdGUodCl7XG5cdFx0aWYodGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID09IDApe1xuXHRcdFx0Ly9udW1iZXJzIGNhbid0IGJlIHNwcmVhZCB1c2luZyAuLi4gb3BlcmF0b3Jcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5kYXRhLmxlbmd0aDtpKyspe1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaSx0LHRoaXMuZGF0YVtpXSk7XG5cdFx0XHR9XG5cdFx0fWVsc2V7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuZGF0YS5sZW5ndGg7aSsrKXtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGksdCwuLi50aGlzLmRhdGFbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMub25BZnRlckFjdGl2YXRpb24oKTsgLy8gY2FsbCBjaGlsZHJlbiBpZiBuZWNlc3Nhcnlcblx0fVxuXHRfY2FsbEFsbENoaWxkcmVuKC4uLmNvb3JkaW5hdGVzKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcylcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgY2xvbmUgPSBuZXcgRVhQLkFycmF5KHtkYXRhOiBFWFAuVXRpbHMuYXJyYXlDb3B5KHRoaXMuZGF0YSl9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RBcnJheSgpe1xuXHR2YXIgeCA9IG5ldyBFWFAuQXJyYXkoe2RhdGE6IFtbMCwxXSxbMCwxXV19KTtcblx0dmFyIHkgPSBuZXcgRVhQLlRyYW5zZm9ybWF0aW9uKHtleHByOiBmdW5jdGlvbiguLi5hKXtjb25zb2xlLmxvZyguLi5hKTsgcmV0dXJuIFsyXX19KTtcblx0eC5hZGQoeSk7XG5cdHguYWN0aXZhdGUoNTEyKTtcbn1cblxuZXhwb3J0IHtFWFBBcnJheSBhcyBBcnJheX07XG4iLCJmdW5jdGlvbiBtdWx0aXBseVNjYWxhcihjLCBhcnJheSl7XG5cdGZvcih2YXIgaT0wO2k8YXJyYXkubGVuZ3RoO2krKyl7XG5cdFx0YXJyYXlbaV0gKj0gYztcblx0fVxuXHRyZXR1cm4gYXJyYXlcbn1cbmZ1bmN0aW9uIHZlY3RvckFkZCh2MSx2Mil7XG4gICAgbGV0IHZlYyA9IGNsb25lKHYxKTtcblx0Zm9yKHZhciBpPTA7aTx2MS5sZW5ndGg7aSsrKXtcblx0XHR2ZWNbaV0gKz0gdjJbaV07XG5cdH1cblx0cmV0dXJuIHZlY1xufVxuZnVuY3Rpb24gdmVjdG9yU3ViKHYxLHYyKXtcbiAgICBsZXQgdmVjID0gY2xvbmUodjEpO1xuXHRmb3IodmFyIGk9MDtpPHYxLmxlbmd0aDtpKyspe1xuXHRcdHZlY1tpXSArPSB2MltpXTtcblx0fVxuXHRyZXR1cm4gdmVjXG59XG5mdW5jdGlvbiBsZXJwVmVjdG9ycyh0LCBwMSwgcDIpe1xuXHQvL2Fzc3VtZWQgdCBpbiBbMCwxXVxuXHRyZXR1cm4gdmVjdG9yQWRkKG11bHRpcGx5U2NhbGFyKHQsY2xvbmUocDEpKSxtdWx0aXBseVNjYWxhcigxLXQsY2xvbmUocDIpKSk7XG59XG5mdW5jdGlvbiBjbG9uZSh2ZWMpe1xuXHR2YXIgbmV3QXJyID0gbmV3IEFycmF5KHZlYy5sZW5ndGgpO1xuXHRmb3IodmFyIGk9MDtpPHZlYy5sZW5ndGg7aSsrKXtcblx0XHRuZXdBcnJbaV0gPSB2ZWNbaV07XG5cdH1cblx0cmV0dXJuIG5ld0FyclxufVxuZnVuY3Rpb24gbXVsdGlwbHlNYXRyaXgodmVjLCBtYXRyaXgpe1xuXHQvL2Fzc2VydCB2ZWMubGVuZ3RoID09IG51bVJvd3NcblxuXHRsZXQgbnVtUm93cyA9IG1hdHJpeC5sZW5ndGg7XG5cdGxldCBudW1Db2xzID0gbWF0cml4WzBdLmxlbmd0aDtcblxuXHR2YXIgb3V0cHV0ID0gbmV3IEFycmF5KG51bUNvbHMpO1xuXHRmb3IodmFyIGo9MDtqPG51bUNvbHM7aisrKXtcblx0XHRvdXRwdXRbal0gPSAwO1xuXHRcdGZvcih2YXIgaT0wO2k8bnVtUm93cztpKyspe1xuXHRcdFx0b3V0cHV0W2pdICs9IG1hdHJpeFtpXVtqXSAqIHZlY1tpXTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIG91dHB1dDtcbn1cblxuLy9oYWNrXG5sZXQgTWF0aCA9IHtjbG9uZTogY2xvbmUsIGxlcnBWZWN0b3JzOiBsZXJwVmVjdG9ycywgdmVjdG9yQWRkOiB2ZWN0b3JBZGQsIHZlY3RvclN1YjogdmVjdG9yU3ViLCBtdWx0aXBseVNjYWxhcjogbXVsdGlwbHlTY2FsYXIsIG11bHRpcGx5TWF0cml4OiBtdWx0aXBseU1hdHJpeH07XG5cbmV4cG9ydCB7dmVjdG9yQWRkLCB2ZWN0b3JTdWIsIGxlcnBWZWN0b3JzLCBjbG9uZSwgbXVsdGlwbHlTY2FsYXIsIG11bHRpcGx5TWF0cml4LCBNYXRofTtcbiIsImltcG9ydCB7Y2xvbmV9IGZyb20gJy4vbWF0aC5qcydcblxuY2xhc3MgVXRpbHN7XG5cblx0c3RhdGljIGlzQXJyYXkoeCl7XG5cdFx0cmV0dXJuIHguY29uc3RydWN0b3IgPT09IEFycmF5O1xuXHR9XG5cdHN0YXRpYyBpc09iamVjdCh4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0O1xuXHR9XG5cdHN0YXRpYyBhcnJheUNvcHkoeCl7XG5cdFx0cmV0dXJuIHguc2xpY2UoKTtcblx0fVxuXHRzdGF0aWMgaXNGdW5jdGlvbih4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gRnVuY3Rpb247XG5cdH1cblx0c3RhdGljIGlzTnVtYmVyKHgpe1xuXHRcdHJldHVybiB4LmNvbnN0cnVjdG9yID09PSBOdW1iZXI7XG5cdH1cblxuXHRzdGF0aWMgYXNzZXJ0KHRoaW5nKXtcblx0XHQvL0EgZnVuY3Rpb24gdG8gY2hlY2sgaWYgc29tZXRoaW5nIGlzIHRydWUgYW5kIGhhbHQgb3RoZXJ3aXNlIGluIGEgY2FsbGJhY2thYmxlIHdheS5cblx0XHRpZighdGhpbmcpe1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBBc3NlcnRpb24gZmFpbGVkLiBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcbiAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcblx0XHR9XG5cdH1cblxuXHRzdGF0aWMgYXNzZXJ0VHlwZSh0aGluZywgdHlwZSwgZXJyb3JNc2cpe1xuXHRcdC8vQSBmdW5jdGlvbiB0byBjaGVjayBpZiBzb21ldGhpbmcgaXMgdHJ1ZSBhbmQgaGFsdCBvdGhlcndpc2UgaW4gYSBjYWxsYmFja2FibGUgd2F5LlxuXHRcdGlmKCEodGhpbmcuY29uc3RydWN0b3IgPT09IHR5cGUpKXtcblx0XHRcdGlmKGVycm9yTXNnKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBTb21ldGhpbmcgbm90IG9mIHJlcXVpcmVkIHR5cGUgXCIrdHlwZS5uYW1lK1wiISBcXG5cIitlcnJvck1zZytcIlxcbiBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFNvbWV0aGluZyBub3Qgb2YgcmVxdWlyZWQgdHlwZSBcIit0eXBlLm5hbWUrXCIhIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdFx0fVxuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuXHRcdH1cblx0fVxuXG5cblx0c3RhdGljIGFzc2VydFByb3BFeGlzdHModGhpbmcsIG5hbWUpe1xuXHRcdGlmKCF0aGluZyB8fCAhKG5hbWUgaW4gdGhpbmcpKXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgXCIrbmFtZStcIiBub3QgcHJlc2VudCBpbiByZXF1aXJlZCBwcm9wZXJ0eVwiKTtcbiAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcblx0XHR9XG5cdH1cblx0XG5cdHN0YXRpYyBjbG9uZSh2ZWMpe1xuXHRcdHJldHVybiBjbG9uZSh2ZWMpO1xuXHR9XG5cblxuXHRzdGF0aWMgaXMxRE51bWVyaWNBcnJheSh2ZWMpe1xuICAgICAgICBpZighVXRpbHMuaXNBcnJheSh2ZWMpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGZvcihsZXQgaT0wO2k8dmVjLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgaWYoIVV0aWxzLmlzTnVtYmVyKHZlY1tpXSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcblx0fVxuXG59XG5cbmV4cG9ydCB7VXRpbHN9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyBEb21haW5Ob2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcblxuY2xhc3MgQXJlYSBleHRlbmRzIERvbWFpbk5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvKnZhciBheGVzID0gbmV3IEVYUC5BcmVhKHtcblx0XHRib3VuZHM6IFtbLTEwLDEwXSxcblx0XHRcdFsxMCwxMF1dXG5cdFx0bnVtSXRlbXM6IDEwOyAvL29wdGlvbmFsLiBBbHRlcm5hdGVseSBudW1JdGVtcyBjYW4gdmFyeSBmb3IgZWFjaCBheGlzOiBudW1JdGVtczogWzEwLDJdXG5cdFx0fSkqL1xuXG5cblx0XG5cdFx0VXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyhvcHRpb25zLCBcImJvdW5kc1wiKTsgLy8gYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5XG5cdFx0VXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmJvdW5kcywgQXJyYXkpO1xuXHRcdFV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5ib3VuZHNbMF0sIEFycmF5LCBcIkZvciBhbiBBcmVhLCBvcHRpb25zLmJvdW5kcyBtdXN0IGJlIGEgbXVsdGlkaW1lbnNpb25hbCBhcnJheSwgZXZlbiBmb3Igb25lIGRpbWVuc2lvbiFcIik7IC8vIGl0IE1VU1QgYmUgbXVsdGlkaW1lbnNpb25hbFxuXHRcdHRoaXMubnVtRGltZW5zaW9ucyA9IG9wdGlvbnMuYm91bmRzLmxlbmd0aDtcblxuXHRcdFV0aWxzLmFzc2VydChvcHRpb25zLmJvdW5kc1swXS5sZW5ndGggIT0gMCk7IC8vZG9uJ3QgYWNjZXB0IFtbXV0sIGl0IG5lZWRzIHRvIGJlIFtbMSwyXV0uXG5cblx0XHR0aGlzLmJvdW5kcyA9IG9wdGlvbnMuYm91bmRzO1xuXHRcdHRoaXMubnVtSXRlbXMgPSBvcHRpb25zLm51bUl0ZW1zIHx8IDE2O1xuXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBhcnJheSB0byBzdG9yZSB0aGUgbnVtYmVyIG9mIHRpbWVzIHRoaXMgaXMgY2FsbGVkIHBlciBkaW1lbnNpb24uXG5cblx0XHRpZih0aGlzLm51bUl0ZW1zLmNvbnN0cnVjdG9yID09PSBOdW1iZXIpe1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bURpbWVuc2lvbnM7aSsrKXtcblx0XHRcdFx0dGhpcy5pdGVtRGltZW5zaW9ucy5wdXNoKHRoaXMubnVtSXRlbXMpO1xuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtSXRlbXMuY29uc3RydWN0b3IgPT09IEFycmF5KXtcblx0XHRcdFV0aWxzLmFzc2VydChvcHRpb25zLm51bUl0ZW1zLmxlbmd0aCA9PSBvcHRpb25zLmJvdW5kcy5sZW5ndGgpO1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bURpbWVuc2lvbnM7aSsrKXtcblx0XHRcdFx0dGhpcy5pdGVtRGltZW5zaW9ucy5wdXNoKHRoaXMubnVtSXRlbXNbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vdGhlIG51bWJlciBvZiB0aW1lcyBldmVyeSBjaGlsZCdzIGV4cHIgaXMgY2FsbGVkXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSB0aGlzLml0ZW1EaW1lbnNpb25zLnJlZHVjZSgoc3VtLHkpPT5zdW0qeSk7XG5cdH1cblx0YWN0aXZhdGUodCl7XG5cdFx0Ly9Vc2UgdGhpcyB0byBldmFsdWF0ZSBleHByKCkgYW5kIHVwZGF0ZSB0aGUgcmVzdWx0LCBjYXNjYWRlLXN0eWxlLlxuXHRcdC8vdGhlIG51bWJlciBvZiBib3VuZHMgdGhpcyBvYmplY3QgaGFzIHdpbGwgYmUgdGhlIG51bWJlciBvZiBkaW1lbnNpb25zLlxuXHRcdC8vdGhlIGV4cHIoKXMgYXJlIGNhbGxlZCB3aXRoIGV4cHIoaSwgLi4uW2Nvb3JkaW5hdGVzXSwgdCksIFxuXHRcdC8vXHQod2hlcmUgaSBpcyB0aGUgaW5kZXggb2YgdGhlIGN1cnJlbnQgZXZhbHVhdGlvbiA9IHRpbWVzIGV4cHIoKSBoYXMgYmVlbiBjYWxsZWQgdGhpcyBmcmFtZSwgdCA9IGFic29sdXRlIHRpbWVzdGVwIChzKSkuXG5cdFx0Ly9wbGVhc2UgY2FsbCB3aXRoIGEgdCB2YWx1ZSBvYnRhaW5lZCBmcm9tIHBlcmZvcm1hbmNlLm5vdygpLzEwMDAgb3Igc29tZXRoaW5nIGxpa2UgdGhhdFxuXG5cdFx0Ly9ub3RlIHRoZSBsZXNzLXRoYW4tb3ItZXF1YWwtdG8gaW4gdGhlc2UgbG9vcHNcblx0XHRpZih0aGlzLm51bURpbWVuc2lvbnMgPT0gMSl7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0bGV0IGluZGV4ID0gaTtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsMCwwLDApO1xuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAyKXtcblx0XHRcdC8vdGhpcyBjYW4gYmUgcmVkdWNlZCBpbnRvIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSBvdmVyIHRoZSBmaXJzdCBpbmRleCBvZiB0aGlzLmJvdW5kcywgSSBrbm93IGl0XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0Zm9yKHZhciBqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzFdO2orKyl7XG5cdFx0XHRcdFx0bGV0IGMyID0gdGhpcy5ib3VuZHNbMV1bMF0gKyAodGhpcy5ib3VuZHNbMV1bMV0tdGhpcy5ib3VuZHNbMV1bMF0pKihqLyh0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTEpKTtcblx0XHRcdFx0XHRsZXQgaW5kZXggPSBpKnRoaXMuaXRlbURpbWVuc2lvbnNbMV0gKyBqO1xuXHRcdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpbmRleCx0LGMxLGMyLDAsMCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ZWxzZSBpZih0aGlzLm51bURpbWVuc2lvbnMgPT0gMyl7XG5cdFx0XHQvL3RoaXMgY2FuIGJlIHJlZHVjZWQgaW50byBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgb3ZlciB0aGUgZmlyc3QgaW5kZXggb2YgdGhpcy5ib3VuZHMsIEkga25vdyBpdFxuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2krKyl7XG5cdFx0XHRcdGxldCBjMSA9IHRoaXMuYm91bmRzWzBdWzBdICsgKHRoaXMuYm91bmRzWzBdWzFdLXRoaXMuYm91bmRzWzBdWzBdKSooaS8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKSk7XG5cdFx0XHRcdGZvcih2YXIgaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtqKyspe1xuXHRcdFx0XHRcdGxldCBjMiA9IHRoaXMuYm91bmRzWzFdWzBdICsgKHRoaXMuYm91bmRzWzFdWzFdLXRoaXMuYm91bmRzWzFdWzBdKSooai8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKSk7XG5cdFx0XHRcdFx0Zm9yKHZhciBrPTA7azx0aGlzLml0ZW1EaW1lbnNpb25zWzJdO2srKyl7XG5cdFx0XHRcdFx0XHRsZXQgYzMgPSB0aGlzLmJvdW5kc1syXVswXSArICh0aGlzLmJvdW5kc1syXVsxXS10aGlzLmJvdW5kc1syXVswXSkqKGsvKHRoaXMuaXRlbURpbWVuc2lvbnNbMl0tMSkpO1xuXHRcdFx0XHRcdFx0bGV0IGluZGV4ID0gKGkqdGhpcy5pdGVtRGltZW5zaW9uc1sxXSArIGopKnRoaXMuaXRlbURpbWVuc2lvbnNbMl0gKyBrO1xuXHRcdFx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsYzIsYzMsMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fWVsc2V7XG5cdFx0XHRhc3NlcnQoXCJUT0RPOiBVc2UgYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIHRvIGxvb3Agb3ZlciBhbGwgaW5kaWNlcyFcIik7XG5cdFx0fVxuXG5cdFx0dGhpcy5vbkFmdGVyQWN0aXZhdGlvbigpOyAvLyBjYWxsIGNoaWxkcmVuIGlmIG5lY2Vzc2FyeVxuXHR9XG5cdF9jYWxsQWxsQ2hpbGRyZW4oLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBBcmVhKHtib3VuZHM6IFV0aWxzLmFycmF5Q29weSh0aGlzLmJvdW5kcyksIG51bUl0ZW1zOiB0aGlzLm51bUl0ZW1zfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0XHRpZihjbG9uZS5jaGlsZHJlbltpXS5fb25BZGQpY2xvbmUuY2hpbGRyZW5baV0uX29uQWRkKCk7IC8vIG5lY2Vzc2FyeSBub3cgdGhhdCB0aGUgY2hhaW4gb2YgYWRkaW5nIGhhcyBiZWVuIGVzdGFibGlzaGVkXG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0QXJlYSgpe1xuXHR2YXIgeCA9IG5ldyBBcmVhKHtib3VuZHM6IFtbMCwxXSxbMCwxXV19KTtcblx0dmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpfX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSgpO1xufVxuXG5leHBvcnQgeyBBcmVhIH1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQgTm9kZSBmcm9tICcuL05vZGUuanMnO1xuXG4vL1VzYWdlOiB2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSl9fSk7XG5jbGFzcyBUcmFuc2Zvcm1hdGlvbiBleHRlbmRzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cdFxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZXhwclwiKTsgLy8gYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5XG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5leHByLCBGdW5jdGlvbik7XG5cblx0XHR0aGlzLmV4cHIgPSBvcHRpb25zLmV4cHI7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKXtcblx0XHQvL2V2YWx1YXRlIHRoaXMgVHJhbnNmb3JtYXRpb24ncyBfZXhwciwgYW5kIGJyb2FkY2FzdCB0aGUgcmVzdWx0IHRvIGFsbCBjaGlsZHJlbi5cblx0XHRsZXQgcmVzdWx0ID0gdGhpcy5leHByKC4uLmNvb3JkaW5hdGVzKTtcblx0XHRpZihyZXN1bHQuY29uc3RydWN0b3IgIT09IEFycmF5KXJlc3VsdCA9IFtyZXN1bHRdO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoY29vcmRpbmF0ZXNbMF0sY29vcmRpbmF0ZXNbMV0sIC4uLnJlc3VsdClcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgdGhpc0V4cHIgPSB0aGlzLmV4cHI7XG5cdFx0bGV0IGNsb25lID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiB0aGlzRXhwci5iaW5kKCl9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG5cdG1ha2VMaW5rKCl7XG4gICAgICAgIC8vbGlrZSBhIGNsb25lLCBidXQgd2lsbCB1c2UgdGhlIHNhbWUgZXhwciBhcyB0aGlzIFRyYW5zZm9ybWF0aW9uLlxuICAgICAgICAvL3VzZWZ1bCBpZiB0aGVyZSdzIGEgc3BlY2lmaWMgZnVuY3Rpb24gdGhhdCBuZWVkcyB0byBiZSB1c2VkIGJ5IGEgYnVuY2ggb2Ygb2JqZWN0c1xuXHRcdHJldHVybiBuZXcgTGlua2VkVHJhbnNmb3JtYXRpb24odGhpcyk7XG5cdH1cbn1cblxuY2xhc3MgTGlua2VkVHJhbnNmb3JtYXRpb24gZXh0ZW5kcyBOb2Rle1xuICAgIC8qXG4gICAgICAgIExpa2UgYW4gRVhQLlRyYW5zZm9ybWF0aW9uLCBidXQgaXQgdXNlcyBhbiBleGlzdGluZyBFWFAuVHJhbnNmb3JtYXRpb24ncyBleHByKCksIHNvIGlmIHRoZSBsaW5rZWQgdHJhbnNmb3JtYXRpb24gdXBkYXRlcywgc28gZG9lcyB0aGlzIG9uZS4gSXQncyBsaWtlIGEgcG9pbnRlciB0byBhIFRyYW5zZm9ybWF0aW9uLCBidXQgaW4gb2JqZWN0IGZvcm0uIFxuICAgICovXG5cdGNvbnN0cnVjdG9yKHRyYW5zZm9ybWF0aW9uVG9MaW5rVG8pe1xuXHRcdHN1cGVyKHt9KTtcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZSh0cmFuc2Zvcm1hdGlvblRvTGlua1RvLCBUcmFuc2Zvcm1hdGlvbik7XG4gICAgICAgIHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlID0gdHJhbnNmb3JtYXRpb25Ub0xpbmtUbztcblx0fVxuXHRldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGxldCByZXN1bHQgPSB0aGlzLmxpbmtlZFRyYW5zZm9ybWF0aW9uTm9kZS5leHByKC4uLmNvb3JkaW5hdGVzKTtcblx0XHRpZihyZXN1bHQuY29uc3RydWN0b3IgIT09IEFycmF5KXJlc3VsdCA9IFtyZXN1bHRdO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoY29vcmRpbmF0ZXNbMF0sY29vcmRpbmF0ZXNbMV0sIC4uLnJlc3VsdClcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgY2xvbmUgPSBuZXcgTGlua2VkVHJhbnNmb3JtYXRpb24odGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUpO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cblx0bWFrZUxpbmsoKXtcblx0XHRyZXR1cm4gbmV3IExpbmtlZFRyYW5zZm9ybWF0aW9uKHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlKTtcblx0fVxufVxuXG5cblxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0VHJhbnNmb3JtYXRpb24oKXtcblx0dmFyIHggPSBuZXcgQXJlYSh7Ym91bmRzOiBbWy0xMCwxMF1dfSk7XG5cdHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHsnZXhwcic6ICh4KSA9PiBjb25zb2xlLmxvZyh4KngpfSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKCk7IC8vIHNob3VsZCByZXR1cm4gMTAwLCA4MSwgNjQuLi4gMCwgMSwgNC4uLiAxMDBcbn1cblxuZXhwb3J0IHsgVHJhbnNmb3JtYXRpb24sIExpbmtlZFRyYW5zZm9ybWF0aW9ufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7IERvbWFpbk5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuXG5jbGFzcyBIaXN0b3J5UmVjb3JkZXIgZXh0ZW5kcyBEb21haW5Ob2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHRzdXBlcigpO1xuXG4gICAgICAgIC8qXG4gICAgICAgICAgICBDbGFzcyB0aGF0IHJlY29yZHMgdGhlIGxhc3QgZmV3IHZhbHVlcyBvZiB0aGUgcGFyZW50IFRyYW5zZm9ybWF0aW9uIGFuZCBtYWtlcyB0aGVtIGF2YWlsYWJsZSBmb3IgdXNlIGFzIGFuIGV4dHJhIGRpbWVuc2lvbi5cbiAgICAgICAgICAgIFVzYWdlOlxuICAgICAgICAgICAgdmFyIHJlY29yZGVyID0gbmV3IEhpc3RvcnlSZWNvcmRlcih7XG4gICAgICAgICAgICAgICAgbWVtb3J5TGVuZ3RoOiAxMCAvLyBob3cgbWFueSBwYXN0IHZhbHVlcyB0byBzdG9yZT9cbiAgICAgICAgICAgICAgICByZWNvcmRGcmFtZUludGVydmFsOiAxNS8vSG93IGxvbmcgdG8gd2FpdCBiZXR3ZWVuIGVhY2ggY2FwdHVyZT8gTWVhc3VyZWQgaW4gZnJhbWVzLCBzbyA2MCA9IDEgY2FwdHVyZSBwZXIgc2Vjb25kLCAzMCA9IDIgY2FwdHVyZXMvc2Vjb25kLCBldGMuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZXhhbXBsZSB1c2FnZTpcbiAgICAgICAgICAgIG5ldyBBcmVhKHtib3VuZHM6IFtbLTUsNV1dfSkuYWRkKG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogKGksdCx4KSA9PiBbTWF0aC5zaW4oeCksTWF0aC5jb3MoeCldfSkpLmFkZChuZXcgRVhQLkhpc3RvcnlSZWNvcmRlcih7bWVtb3J5TGVuZ3RoOiA1fSkuYWRkKG5ldyBMaW5lT3V0cHV0KHt3aWR0aDogNSwgY29sb3I6IDB4ZmYwMDAwfSkpO1xuXG4gICAgICAgICAgICBOT1RFOiBJdCBpcyBhc3N1bWVkIHRoYXQgYW55IHBhcmVudCB0cmFuc2Zvcm1hdGlvbiBvdXRwdXRzIGFuIGFycmF5IG9mIG51bWJlcnMgdGhhdCBpcyA0IG9yIGxlc3MgaW4gbGVuZ3RoLlxuICAgICAgICAqL1xuXG5cdFx0dGhpcy5tZW1vcnlMZW5ndGggPSBvcHRpb25zLm1lbW9yeUxlbmd0aCA9PT0gdW5kZWZpbmVkID8gMTAgOiBvcHRpb25zLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgdGhpcy5yZWNvcmRGcmFtZUludGVydmFsID0gb3B0aW9ucy5yZWNvcmRGcmFtZUludGVydmFsID09PSB1bmRlZmluZWQgPyAxNSA6IG9wdGlvbnMucmVjb3JkRnJhbWVJbnRlcnZhbDsgLy9zZXQgdG8gMSB0byByZWNvcmQgZXZlcnkgZnJhbWUuXG4gICAgICAgIHRoaXMuX291dHB1dERpbWVuc2lvbnMgPSA0OyAvL2hvdyBtYW55IGRpbWVuc2lvbnMgcGVyIHBvaW50IHRvIHN0b3JlPyAodG9kbzogYXV0b2RldGVjdCB0aGlzIGZyb20gcGFyZW50J3Mgb3V0cHV0KVxuXHRcdHRoaXMuY3VycmVudEhpc3RvcnlJbmRleD0wO1xuICAgICAgICB0aGlzLmZyYW1lUmVjb3JkVGltZXIgPSAwO1xuXHR9XG5cdF9vbkFkZCgpe1xuXHRcdC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBBcmVhXG5cdFx0bGV0IHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLm1lbW9yeUxlbmd0aDtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucy5jb25jYXQoW3RoaXMubWVtb3J5TGVuZ3RoXSk7XG5cbiAgICAgICAgdGhpcy5idWZmZXIgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG4gICAgXG4gICAgICAgIC8vVGhpcyBpcyBzbyB0aGF0IG5vIHN1cmZhY2UvYm91bmRhcnkgd2lsbCBhcHBlYXIgdW50aWwgaGlzdG9yeSBiZWdpbnMgdG8gYmUgcmVjb3JkZWQuIEknbSBzbyBzb3JyeS5cbiAgICAgICAgLy9Ub2RvOiBwcm9wZXIgY2xpcCBzaGFkZXIgbGlrZSBtYXRoYm94IGRvZXMgb3Igc29tZXRoaW5nLlxuICAgICAgICB0aGlzLmJ1ZmZlci5maWxsKE5hTik7IFxuXHR9XG4gICAgb25BZnRlckFjdGl2YXRpb24oKXtcbiAgICAgICAgc3VwZXIub25BZnRlckFjdGl2YXRpb24oKTtcblxuICAgICAgICAvL2V2ZXJ5IHNvIG9mdGVuLCBzaGlmdCB0byB0aGUgbmV4dCBidWZmZXIgc2xvdFxuICAgICAgICB0aGlzLmZyYW1lUmVjb3JkVGltZXIgKz0gMTtcbiAgICAgICAgaWYodGhpcy5mcmFtZVJlY29yZFRpbWVyID49IHRoaXMucmVjb3JkRnJhbWVJbnRlcnZhbCl7XG4gICAgICAgICAgICAvL3Jlc2V0IGZyYW1lIHJlY29yZCB0aW1lclxuICAgICAgICAgICAgdGhpcy5mcmFtZVJlY29yZFRpbWVyID0gMDtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCA9ICh0aGlzLmN1cnJlbnRIaXN0b3J5SW5kZXgrMSkldGhpcy5tZW1vcnlMZW5ndGg7XG4gICAgICAgIH1cbiAgICB9XG5cdGV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcyl7XG5cdFx0Ly9ldmFsdWF0ZSB0aGlzIFRyYW5zZm9ybWF0aW9uJ3MgX2V4cHIsIGFuZCBicm9hZGNhc3QgdGhlIHJlc3VsdCB0byBhbGwgY2hpbGRyZW4uXG5cdFx0bGV0IGkgPSBjb29yZGluYXRlc1swXTtcblx0XHRsZXQgdCA9IGNvb3JkaW5hdGVzWzFdO1xuICAgIFxuICAgICAgICAvL3N0ZXAgMTogc2F2ZSBjb29yZGluYXRlcyBmb3IgdGhpcyBmcmFtZSBpbiBidWZmZXJcbiAgICAgICAgaWYoY29vcmRpbmF0ZXMubGVuZ3RoID4gMit0aGlzLl9vdXRwdXREaW1lbnNpb25zKXtcbiAgICAgICAgICAgIC8vdG9kbzogbWFrZSB0aGlzIHVwZGF0ZSB0aGlzLl9vdXRwdXREaW1lbnNpb25zIGFuZCByZWFsbG9jYXRlIG1vcmUgYnVmZmVyIHNwYWNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFWFAuSGlzdG9yeVJlY29yZGVyIGlzIHVuYWJsZSB0byByZWNvcmQgaGlzdG9yeSBvZiBzb21ldGhpbmcgdGhhdCBvdXRwdXRzIGluIFwiK3RoaXMuX291dHB1dERpbWVuc2lvbnMrXCIgZGltZW5zaW9ucyEgWWV0LlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjeWNsaWNCdWZmZXJJbmRleCA9IChpKnRoaXMubWVtb3J5TGVuZ3RoK3RoaXMuY3VycmVudEhpc3RvcnlJbmRleCkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcbiAgICAgICAgZm9yKHZhciBqPTA7ajxjb29yZGluYXRlcy5sZW5ndGgtMjtqKyspeyBcbiAgICAgICAgICAgIHRoaXMuYnVmZmVyW2N5Y2xpY0J1ZmZlckluZGV4K2pdID0gY29vcmRpbmF0ZXNbMitqXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vc3RlcCAyOiwgY2FsbCBhbnkgY2hpbGRyZW4gb25jZSBwZXIgaGlzdG9yeSBpdGVtXG4gICAgICAgIGZvcih2YXIgY2hpbGRObz0wO2NoaWxkTm88dGhpcy5jaGlsZHJlbi5sZW5ndGg7Y2hpbGRObysrKXtcblx0XHQgICAgZm9yKHZhciBqPTA7ajx0aGlzLm1lbW9yeUxlbmd0aDtqKyspe1xuXG4gICAgICAgICAgICAgICAgLy90aGUgKzEgaW4gKGogKyB0aGlzLmN1cnJlbnRIaXN0b3J5SW5kZXggKyAxKSBpcyBpbXBvcnRhbnQ7IHdpdGhvdXQgaXQsIGEgTGluZU91dHB1dCB3aWxsIGRyYXcgYSBsaW5lIGZyb20gdGhlIG1vc3QgcmVjZW50IHZhbHVlIHRvIHRoZSBlbmQgb2YgaGlzdG9yeVxuICAgICAgICAgICAgICAgIGxldCBjeWNsaWNIaXN0b3J5VmFsdWUgPSAoaiArIHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCArIDEpICUgdGhpcy5tZW1vcnlMZW5ndGg7XG4gICAgICAgICAgICAgICAgbGV0IGN5Y2xpY0J1ZmZlckluZGV4ID0gKGkgKiB0aGlzLm1lbW9yeUxlbmd0aCArIGN5Y2xpY0hpc3RvcnlWYWx1ZSkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcbiAgICAgICAgICAgICAgICBsZXQgbm9uQ3ljbGljSW5kZXggPSBpICogdGhpcy5tZW1vcnlMZW5ndGggKyBqO1xuXG5cdFx0ICAgICAgICAvL0knbSB0b3JuIG9uIHdoZXRoZXIgdG8gYWRkIGEgZmluYWwgY29vcmRpbmF0ZSBhdCB0aGUgZW5kIHNvIGhpc3RvcnkgY2FuIGdvIG9mZiBpbiBhIG5ldyBkaXJlY3Rpb24uXG4gICAgICAgICAgICAgICAgLy90aGlzLmNoaWxkcmVuW2NoaWxkTm9dLmV2YWx1YXRlU2VsZihub25DeWNsaWNJbmRleCx0LHRoaXMuYnVmZmVyW2N5Y2xpY0J1ZmZlckluZGV4XSwgY3ljbGljSGlzdG9yeVZhbHVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuW2NoaWxkTm9dLmV2YWx1YXRlU2VsZihcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vbkN5Y2xpY0luZGV4LHQsIC8vaSx0XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi50aGlzLmJ1ZmZlci5zbGljZShjeWNsaWNCdWZmZXJJbmRleCxjeWNsaWNCdWZmZXJJbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zKSAvL2V4dHJhY3QgY29vcmRpbmF0ZXMgZm9yIHRoaXMgaGlzdG9yeSB2YWx1ZSBmcm9tIGJ1ZmZlclxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBIaXN0b3J5UmVjb3JkZXIoe21lbW9yeUxlbmd0aDogdGhpcy5tZW1vcnlMZW5ndGgsIHJlY29yZEZyYW1lSW50ZXJ2YWw6IHRoaXMucmVjb3JkRnJhbWVJbnRlcnZhbH0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cbn1cblxuZXhwb3J0IHsgSGlzdG9yeVJlY29yZGVyIH1cbiIsInZhciB0aHJlZUVudmlyb25tZW50ID0gbnVsbDtcblxuZnVuY3Rpb24gc2V0VGhyZWVFbnZpcm9ubWVudChuZXdFbnYpe1xuICAgIHRocmVlRW52aXJvbm1lbnQgPSBuZXdFbnY7XG59XG5mdW5jdGlvbiBnZXRUaHJlZUVudmlyb25tZW50KCl7XG4gICAgcmV0dXJuIHRocmVlRW52aXJvbm1lbnQ7XG59XG5leHBvcnQge3NldFRocmVlRW52aXJvbm1lbnQsIGdldFRocmVlRW52aXJvbm1lbnQsIHRocmVlRW52aXJvbm1lbnR9O1xuIiwiaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuL3V0aWxzLmpzJztcblxuaW1wb3J0IHsgVHJhbnNmb3JtYXRpb24gfSBmcm9tICcuL1RyYW5zZm9ybWF0aW9uLmpzJztcblxuaW1wb3J0ICogYXMgbWF0aCBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgdGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmxldCBFUFMgPSBOdW1iZXIuRVBTSUxPTjtcblxuY29uc3QgRWFzaW5nID0ge0Vhc2VJbk91dDoxLEVhc2VJbjoyLEVhc2VPdXQ6M307XG5cbmNsYXNzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHRoaXMudG9WYWx1ZSA9IHRvVmFsdWU7XG4gICAgICAgIHRoaXMuZnJvbVZhbHVlID0gZnJvbVZhbHVlO1xuICAgICAgICB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbiA9IGludGVycG9sYXRpb25GdW5jdGlvbjtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7fSAvL3BlcmNlbnRhZ2UgaXMgMC0xIGxpbmVhcmx5XG59XG5jbGFzcyBOdW1iZXJJbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgfVxuICAgIGludGVycG9sYXRlKHBlcmNlbnRhZ2Upe1xuXHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG5cdFx0cmV0dXJuIHQqdGhpcy50b1ZhbHVlICsgKDEtdCkqdGhpcy5mcm9tVmFsdWU7XG4gICAgfVxufVxuXG5jbGFzcyBCb29sSW50ZXJwb2xhdG9yIGV4dGVuZHMgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcbiAgICAgICAgc3VwZXIoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZShwZXJjZW50YWdlKXtcbiAgICAgICAgbGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcbiAgICAgICAgdGhpcy50YXJnZXRbcHJvcGVydHlOYW1lXSA9IHQgPiAwLjUgPyB0aGlzLnRvVmFsdWUgOiB0aGlzLmZyb21WYWx1ZTtcbiAgICB9XG59XG5cblxuY2xhc3MgVGhyZWVKc0NvbG9ySW50ZXJwb2xhdG9yIGV4dGVuZHMgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcbiAgICAgICAgc3VwZXIoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB0aGlzLnRlbXBWYWx1ZSA9IG5ldyBUSFJFRS5Db2xvcigpO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZShwZXJjZW50YWdlKXtcbiAgICAgICAgbGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcbiAgICAgICAgdGhpcy50ZW1wVmFsdWUuY29weSh0aGlzLmZyb21WYWx1ZSk7XG4gICAgICAgIHJldHVybiB0aGlzLnRlbXBWYWx1ZS5sZXJwKHRoaXMudG9WYWx1ZSwgdCk7XG4gICAgfVxufVxuY2xhc3MgVGhyZWVKc1ZlYzNJbnRlcnBvbGF0b3IgZXh0ZW5kcyBJbnRlcnBvbGF0b3J7XG4gICAgY29uc3RydWN0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pe1xuICAgICAgICBzdXBlcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgIGlmKFV0aWxzLmlzQXJyYXkodG9WYWx1ZSkgJiYgdG9WYWx1ZS5sZW5ndGggPD0gMyl7XG4gICAgICAgICAgICB0aGlzLnRvVmFsdWUgPSBuZXcgVEhSRUUuVmVjdG9yMyguLi50aGlzLnRvVmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGVtcFZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUocGVyY2VudGFnZSl7XG4gICAgICAgIGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG4gICAgICAgIHJldHVybiB0aGlzLnRlbXBWYWx1ZS5sZXJwVmVjdG9ycyh0aGlzLmZyb21WYWx1ZSwgdGhpcy50b1ZhbHVlLCB0KTsgLy90aGlzIG1vZGlmaWVzIHRoaXMudGVtcFZhbHVlIGluLXBsYWNlIGFuZCByZXR1cm5zIGl0XG4gICAgfVxufVxuXG5jbGFzcyBUcmFuc2Zvcm1hdGlvbkZ1bmN0aW9uSW50ZXJwb2xhdG9yIGV4dGVuZHMgSW50ZXJwb2xhdG9ye1xuICAgIGNvbnN0cnVjdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uLCBzdGFnZ2VyRnJhY3Rpb24sIHRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy5zdGFnZ2VyRnJhY3Rpb24gPSBzdGFnZ2VyRnJhY3Rpb247XG4gICAgICAgIHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gdGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZShwZXJjZW50YWdlKXtcblx0XHRcdC8vaWYgc3RhZ2dlckZyYWN0aW9uICE9IDAsIGl0J3MgdGhlIGFtb3VudCBvZiB0aW1lIGJldHdlZW4gdGhlIGZpcnN0IHBvaW50J3Mgc3RhcnQgdGltZSBhbmQgdGhlIGxhc3QgcG9pbnQncyBzdGFydCB0aW1lLlxuXHRcdFx0Ly9BU1NVTVBUSU9OOiB0aGUgZmlyc3QgdmFyaWFibGUgb2YgdGhpcyBmdW5jdGlvbiBpcyBpLCBhbmQgaXQncyBhc3N1bWVkIGkgaXMgemVyby1pbmRleGVkLlxuXHRcdFx0Ly9lbmNhcHN1bGF0ZSBwZXJjZW50YWdlXG5cblx0XHRcdHJldHVybiAoZnVuY3Rpb24oLi4uY29vcmRzKXtcbiAgICAgICAgICAgICAgICBjb25zdCBpID0gY29vcmRzWzBdO1xuXHRcdFx0XHRsZXQgbGVycEZhY3RvciA9IHBlcmNlbnRhZ2U7XG5cbiAgICAgICAgICAgICAgICAvL2ZhbmN5IHN0YWdnZXJpbmcgbWF0aCwgaWYgd2Uga25vdyBob3cgbWFueSBvYmplY3RzIGFyZSBmbG93aW5nIHRocm91Z2ggdGhpcyB0cmFuc2Zvcm1hdGlvbiBhdCBvbmNlXG4gICAgICAgICAgICAgICAgaWYodGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gIT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICAgICAgICAgIGxlcnBGYWN0b3IgPSBwZXJjZW50YWdlLygxLXRoaXMuc3RhZ2dlckZyYWN0aW9uK0VQUykgLSBpKnRoaXMuc3RhZ2dlckZyYWN0aW9uL3RoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuICAgICAgICAgICAgICAgIH1cblx0XHRcdFx0Ly9sZXQgcGVyY2VudCA9IE1hdGgubWluKE1hdGgubWF4KHBlcmNlbnRhZ2UgLSBpL3RoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uICAgLDEpLDApO1xuXG5cdFx0XHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24oTWF0aC5tYXgoTWF0aC5taW4obGVycEZhY3RvciwxKSwwKSk7XG5cdFx0XHRcdHJldHVybiBtYXRoLmxlcnBWZWN0b3JzKHQsdGhpcy50b1ZhbHVlKC4uLmNvb3JkcyksdGhpcy5mcm9tVmFsdWUoLi4uY29vcmRzKSlcblx0XHRcdH0pLmJpbmQodGhpcyk7XG4gICAgfVxufVxuXG5jbGFzcyBOdW1lcmljMURBcnJheUludGVycG9sYXRvciBleHRlbmRzIEludGVycG9sYXRvcntcbiAgICBjb25zdHJ1Y3Rvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbil7XG4gICAgICAgIHN1cGVyKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy5sYXJnZXN0TGVuZ3RoID0gTWF0aC5tYXgoZnJvbVZhbHVlLmxlbmd0aCwgdG9WYWx1ZS5sZW5ndGgpO1xuICAgICAgICB0aGlzLnNob3J0ZXN0TGVuZ3RoID0gTWF0aC5taW4oZnJvbVZhbHVlLmxlbmd0aCwgdG9WYWx1ZS5sZW5ndGgpO1xuICAgICAgICB0aGlzLmZyb21WYWx1ZUlzU2hvcnRlciA9IGZyb21WYWx1ZS5sZW5ndGggPCB0b1ZhbHVlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5yZXN1bHRBcnJheSA9IG5ldyBBcnJheSh0aGlzLmxhcmdlc3RMZW5ndGgpOyAvL2NhY2hlZCBmb3Igc3BlZWR1cFxuICAgIH1cbiAgICBpbnRlcnBvbGF0ZShwZXJjZW50YWdlKXtcblx0XHRsZXQgdCA9IHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHBlcmNlbnRhZ2UpO1xuICAgICAgICBmb3IobGV0IGk9MDtpPHRoaXMuc2hvcnRlc3RMZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIHRoaXMucmVzdWx0QXJyYXlbaV0gPSB0KnRoaXMudG9WYWx1ZVtpXSArICgxLXQpKnRoaXMuZnJvbVZhbHVlW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9pZiBvbmUgYXJyYXkgaXMgbG9uZ2VyIHRoYW4gdGhlIG90aGVyLCBpbnRlcnBvbGF0ZSBhcyBpZiB0aGUgc2hvcnRlciBhcnJheSBpcyBwYWRkZWQgd2l0aCB6ZXJvZXNcbiAgICAgICAgaWYodGhpcy5mcm9tVmFsdWVJc1Nob3J0ZXIpe1xuICAgICAgICAgICAgLy90aGlzLmZyb21WYWx1ZVtpXSBkb2Vzbid0IGV4aXN0LCBzbyBhc3N1bWUgaXQncyBhIHplcm9cbiAgICAgICAgICAgIGZvcihsZXQgaT10aGlzLnNob3J0ZXN0TGVuZ3RoO2k8dGhpcy5sb25nZXN0TGVuZ3RoO2krKyl7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXN1bHRBcnJheVtpXSA9IHQqdGhpcy50b1ZhbHVlW2ldOyAvLyArICgxLXQpKjA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgLy90aGlzLnRvVmFsdWVbaV0gZG9lc24ndCBleGlzdCwgc28gYXNzdW1lIGl0J3MgYSB6ZXJvXG4gICAgICAgICAgICBmb3IobGV0IGk9dGhpcy5zaG9ydGVzdExlbmd0aDtpPHRoaXMubG9uZ2VzdExlbmd0aDtpKyspe1xuICAgICAgICAgICAgICAgIHRoaXMucmVzdWx0QXJyYXlbaV0gPSAoMS10KSp0aGlzLmZyb21WYWx1ZVtpXTsgLy8gKyB0KjAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucmVzdWx0QXJyYXk7XG4gICAgfVxufVxuXG5cblxuXG5cbmNvbnN0IEV4aXN0aW5nQW5pbWF0aW9uU3ltYm9sID0gU3ltYm9sKCdDdXJyZW50RVhQQW5pbWF0aW9uJylcblxuXG5jbGFzcyBBbmltYXRpb257XG5cdGNvbnN0cnVjdG9yKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uPTEsIG9wdGlvbmFsQXJndW1lbnRzPXt9KXtcbiAgICAgICAgaWYoIVV0aWxzLmlzT2JqZWN0KHRvVmFsdWVzKSAmJiAhVXRpbHMuaXNBcnJheSh0b1ZhbHVlcykpe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRXJyb3IgdHJhbnNpdGlvbmluZzogdG9WYWx1ZXMgbXVzdCBiZSBhbiBhcnJheSBvciBhbiBvYmplY3QuXCIpO1xuICAgICAgICB9XG5cblx0XHR0aGlzLnRvVmFsdWVzID0gdG9WYWx1ZXM7XG5cdFx0dGhpcy50YXJnZXQgPSB0YXJnZXQ7XHRcblx0XHR0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247IC8vaW4gc1xuXG4gICAgICAgIC8vUGFyc2Ugb3B0aW9uYWwgdmFsdWVzIGluIG9wdGlvbmFsQXJndW1lbnRzXG5cbiAgICAgICAgLy9jaG9vc2UgZWFzaW5nIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuZWFzaW5nID0gb3B0aW9uYWxBcmd1bWVudHMuZWFzaW5nID09PSB1bmRlZmluZWQgPyBFYXNpbmcuRWFzZUluT3V0IDogb3B0aW9uYWxBcmd1bWVudHMuZWFzaW5nOy8vZGVmYXVsdCwgRWFzaW5nLkVhc2VJbk91dFxuICAgICAgICB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbiA9IEFuaW1hdGlvbi5jb3NpbmVFYXNlSW5PdXRJbnRlcnBvbGF0aW9uOyBcbiAgICAgICAgaWYodGhpcy5lYXNpbmcgPT0gRWFzaW5nLkVhc2VJbil7XG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbiA9IEFuaW1hdGlvbi5jb3NpbmVFYXNlSW5JbnRlcnBvbGF0aW9uO1xuICAgICAgICB9ZWxzZSBpZih0aGlzLmVhc2luZyA9PSBFYXNpbmcuRWFzZU91dCl7XG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbiA9IEFuaW1hdGlvbi5jb3NpbmVFYXNlT3V0SW50ZXJwb2xhdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vc2V0dXAgdmFsdWVzIG5lZWRlZCBmb3Igc3RhZ2dlcmVkIGFuaW1hdGlvblxuICAgICAgICB0aGlzLnN0YWdnZXJGcmFjdGlvbiA9IG9wdGlvbmFsQXJndW1lbnRzLnN0YWdnZXJGcmFjdGlvbiA9PT0gdW5kZWZpbmVkID8gMCA6IG9wdGlvbmFsQXJndW1lbnRzLnN0YWdnZXJGcmFjdGlvbjsgLy8gdGltZSBpbiBtcyBiZXR3ZWVuIGZpcnN0IGVsZW1lbnQgYmVnaW5uaW5nIHRoZSBhbmltYXRpb24gYW5kIGxhc3QgZWxlbWVudCBiZWdpbm5pbmcgdGhlIGFuaW1hdGlvbi4gU2hvdWxkIGJlIGxlc3MgdGhhbiBkdXJhdGlvbi5cblx0XHRVdGlscy5hc3NlcnQodGhpcy5zdGFnZ2VyRnJhY3Rpb24gPj0gMCAmJiB0aGlzLnN0YWdnZXJGcmFjdGlvbiA8IDEpO1xuXHRcdGlmKHRhcmdldC5jb25zdHJ1Y3RvciA9PT0gVHJhbnNmb3JtYXRpb24pe1xuXHRcdFx0dGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gPSB0YXJnZXQuZ2V0VG9wUGFyZW50KCkubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXHRcdH1lbHNle1xuXHRcdFx0aWYodGhpcy5zdGFnZ2VyRnJhY3Rpb24gIT0gMCl7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJzdGFnZ2VyRnJhY3Rpb24gY2FuIG9ubHkgYmUgdXNlZCB3aGVuIFRyYW5zaXRpb25UbydzIHRhcmdldCBpcyBhbiBFWFAuVHJhbnNmb3JtYXRpb24hXCIpO1xuXHRcdFx0fVxuXHRcdH1cbiAgICAgICAgXG5cdFx0dGhpcy5mcm9tVmFsdWVzID0ge307XG4gICAgICAgIHRoaXMuaW50ZXJwb2xhdG9ycyA9IFtdO1xuICAgICAgICB0aGlzLmludGVycG9sYXRpbmdQcm9wZXJ0eU5hbWVzID0gW107XG5cdFx0Zm9yKHZhciBwcm9wZXJ0eSBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdFV0aWxzLmFzc2VydFByb3BFeGlzdHModGhpcy50YXJnZXQsIHByb3BlcnR5KTtcblxuXHRcdFx0Ly9jb3B5IHByb3BlcnR5LCBtYWtpbmcgc3VyZSB0byBzdG9yZSB0aGUgY29ycmVjdCAndGhpcydcblx0XHRcdGlmKFV0aWxzLmlzRnVuY3Rpb24odGhpcy50YXJnZXRbcHJvcGVydHldKSl7XG5cdFx0XHRcdHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0gPSB0aGlzLnRhcmdldFtwcm9wZXJ0eV0uYmluZCh0aGlzLnRhcmdldCk7XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0dGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHRoaXMudGFyZ2V0W3Byb3BlcnR5XTtcblx0XHRcdH1cblxuICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0b3JzLnB1c2godGhpcy5jaG9vc2VJbnRlcnBvbGF0b3IodGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSwgdGhpcy50b1ZhbHVlc1twcm9wZXJ0eV0sdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24pKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGluZ1Byb3BlcnR5TmFtZXMucHVzaChwcm9wZXJ0eSk7XG5cdFx0fVxuXG5cblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5wcmV2VHJ1ZVRpbWUgPSAwO1xuXG4gICAgICAgIGlmKHRoaXMudGFyZ2V0W0V4aXN0aW5nQW5pbWF0aW9uU3ltYm9sXSAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIHRoaXMuZGVhbFdpdGhFeGlzdGluZ0FuaW1hdGlvbigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGFyZ2V0W0V4aXN0aW5nQW5pbWF0aW9uU3ltYm9sXSA9IHRoaXM7XG5cblx0XHQvL2JlZ2luXG5cdFx0dGhpcy5fdXBkYXRlQ2FsbGJhY2sgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpXG5cdFx0dGhyZWVFbnZpcm9ubWVudC5vbihcInVwZGF0ZVwiLHRoaXMuX3VwZGF0ZUNhbGxiYWNrKTtcblx0fVxuICAgIGRlYWxXaXRoRXhpc3RpbmdBbmltYXRpb24oKXtcbiAgICAgICAgLy9pZiBhbm90aGVyIGFuaW1hdGlvbiBpcyBoYWxmd2F5IHRocm91Z2ggcGxheWluZyB3aGVuIHRoaXMgYW5pbWF0aW9uIHN0YXJ0cywgcHJlZW1wdCBpdFxuICAgICAgICBsZXQgcHJldmlvdXNBbmltYXRpb24gPSB0aGlzLnRhcmdldFtFeGlzdGluZ0FuaW1hdGlvblN5bWJvbF07XG5cbiAgICAgICAgLy90b2RvOiBmYW5jeSBibGVuZGluZ1xuICAgICAgICBwcmV2aW91c0FuaW1hdGlvbi5lbmQoKTtcblx0XHRmb3IodmFyIHByb3BlcnR5IGluIHRoaXMuZnJvbVZhbHVlcyl7XG4gICAgICAgICAgICBpZihwcm9wZXJ0eSBpbiBwcmV2aW91c0FuaW1hdGlvbi50b1ZhbHVlcyl7XG4gICAgICAgICAgICAgICAgdGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHByZXZpb3VzQW5pbWF0aW9uLnRvVmFsdWVzW3Byb3BlcnR5XTtcbiAgICBcdFx0fVxuXHRcdH1cbiAgICB9XG4gICAgY2hvb3NlSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKXtcblx0XHRpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mKGZyb21WYWx1ZSkgPT09IFwibnVtYmVyXCIpe1xuICAgICAgICAgICAgLy9udW1iZXItbnVtYmVyXG4gICAgICAgICAgICByZXR1cm4gbmV3IE51bWJlckludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXNGdW5jdGlvbih0b1ZhbHVlKSAmJiBVdGlscy5pc0Z1bmN0aW9uKGZyb21WYWx1ZSkpe1xuICAgICAgICAgICAgLy9mdW5jdGlvbi1mdW5jdGlvblxuXHRcdFx0cmV0dXJuIG5ldyBUcmFuc2Zvcm1hdGlvbkZ1bmN0aW9uSW50ZXJwb2xhdG9yKGZyb21WYWx1ZSwgdG9WYWx1ZSwgaW50ZXJwb2xhdGlvbkZ1bmN0aW9uLCB0aGlzLnN0YWdnZXJGcmFjdGlvbiwgdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24pO1xuXHRcdH1lbHNlIGlmKHRvVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLkNvbG9yICYmIGZyb21WYWx1ZS5jb25zdHJ1Y3RvciA9PT0gVEhSRUUuQ29sb3Ipe1xuICAgICAgICAgICAgLy9USFJFRS5Db2xvclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBUaHJlZUpzQ29sb3JJbnRlcnBvbGF0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB9ZWxzZSBpZihmcm9tVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLlZlY3RvcjMgJiYgKHRvVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLlZlY3RvcjMgfHwgVXRpbHMuaXMxRE51bWVyaWNBcnJheSh0b1ZhbHVlKSkpe1xuICAgICAgICAgICAgLy9USFJFRS5WZWN0b3IzIC0gYnV0IHdlIGNhbiBhbHNvIGludGVycHJldCBhIHRvVmFsdWUgb2YgW2EsYixjXSBhcyBuZXcgVEhSRUUuVmVjdG9yMyhhLGIsYylcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGhyZWVKc1ZlYzNJbnRlcnBvbGF0b3IoZnJvbVZhbHVlLCB0b1ZhbHVlLCBpbnRlcnBvbGF0aW9uRnVuY3Rpb24pO1xuICAgICAgICB9ZWxzZSBpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwiYm9vbGVhblwiICYmIHR5cGVvZihmcm9tVmFsdWUpID09PSBcImJvb2xlYW5cIil7XG4gICAgICAgICAgICAvL2Jvb2xlYW5cbiAgICAgICAgICAgIHJldHVybiBuZXcgQm9vbEludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXMxRE51bWVyaWNBcnJheSh0b1ZhbHVlKSAmJiBVdGlscy5pczFETnVtZXJpY0FycmF5KGZyb21WYWx1ZSkpe1xuICAgICAgICAgICAgLy9mdW5jdGlvbi1mdW5jdGlvblxuXHRcdFx0cmV0dXJuIG5ldyBOdW1lcmljMURBcnJheUludGVycG9sYXRvcihmcm9tVmFsdWUsIHRvVmFsdWUsIGludGVycG9sYXRpb25GdW5jdGlvbik7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgLy9XZSBkb24ndCBrbm93IGhvdyB0byBpbnRlcnBvbGF0ZSB0aGlzLiBJbnN0ZWFkIHdlJ2xsIGp1c3QgZG8gbm90aGluZywgYW5kIGF0IHRoZSBlbmQgb2YgdGhlIGFuaW1hdGlvbiB3ZSdsbCBqdXN0IHNldCB0aGUgdGFyZ2V0IHRvIHRoZSB0b1ZhbHVlLlxuXHRcdFx0Y29uc29sZS5lcnJvcihcIkFuaW1hdGlvbiBjbGFzcyBjYW5ub3QgeWV0IGhhbmRsZSB0cmFuc2l0aW9uaW5nIGJldHdlZW4gdGhpbmdzIHRoYXQgYXJlbid0IG51bWJlcnMgb3IgZnVuY3Rpb25zIVwiKTtcblx0XHR9XG4gICAgfVxuXHR1cGRhdGUodGltZSl7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSB0aW1lLnJlYWx0aW1lRGVsdGE7XHRcblxuXHRcdGxldCBwZXJjZW50YWdlID0gdGhpcy5lbGFwc2VkVGltZS90aGlzLmR1cmF0aW9uO1xuXG5cdFx0Ly9pbnRlcnBvbGF0ZSB2YWx1ZXNcblx0XHRmb3IobGV0IGk9MDtpPHRoaXMuaW50ZXJwb2xhdG9ycy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGxldCBwcm9wZXJ0eU5hbWUgPSB0aGlzLmludGVycG9sYXRpbmdQcm9wZXJ0eU5hbWVzW2ldO1xuXHRcdFx0dGhpcy50YXJnZXRbcHJvcGVydHlOYW1lXSA9IHRoaXMuaW50ZXJwb2xhdG9yc1tpXS5pbnRlcnBvbGF0ZShwZXJjZW50YWdlKTtcblx0XHR9XG5cblx0XHRpZih0aGlzLmVsYXBzZWRUaW1lID49IHRoaXMuZHVyYXRpb24pe1xuXHRcdFx0dGhpcy5lbmQoKTtcblx0XHR9XG5cdH1cblx0c3RhdGljIGNvc2luZUVhc2VJbk91dEludGVycG9sYXRpb24oeCl7XG5cdFx0cmV0dXJuICgxLU1hdGguY29zKHgqTWF0aC5QSSkpLzI7XG5cdH1cblx0c3RhdGljIGNvc2luZUVhc2VJbkludGVycG9sYXRpb24oeCl7XG5cdFx0cmV0dXJuICgxLU1hdGguY29zKHgqTWF0aC5QSS8yKSk7XG5cdH1cblx0c3RhdGljIGNvc2luZUVhc2VPdXRJbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiBNYXRoLnNpbih4ICogTWF0aC5QSS8yKTtcblx0fVxuXHRzdGF0aWMgbGluZWFySW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4geDtcblx0fVxuXHRlbmQoKXtcblx0XHRmb3IodmFyIHByb3AgaW4gdGhpcy50b1ZhbHVlcyl7XG5cdFx0XHR0aGlzLnRhcmdldFtwcm9wXSA9IHRoaXMudG9WYWx1ZXNbcHJvcF07XG5cdFx0fVxuXHRcdHRocmVlRW52aXJvbm1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInVwZGF0ZVwiLHRoaXMuX3VwZGF0ZUNhbGxiYWNrKTtcbiAgICAgICAgdGhpcy50YXJnZXRbRXhpc3RpbmdBbmltYXRpb25TeW1ib2xdID0gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmZ1bmN0aW9uIFRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TLCBvcHRpb25hbEFyZ3VtZW50cyl7XG4gICAgLy9pZiBzb21lb25lJ3MgdXNpbmcgdGhlIG9sZCBjYWxsaW5nIHN0cmF0ZWd5IG9mIHN0YWdnZXJGcmFjdGlvbiBhcyB0aGUgbGFzdCBhcmd1bWVudCwgY29udmVydCBpdCBwcm9wZXJseVxuICAgIGlmKG9wdGlvbmFsQXJndW1lbnRzICYmIFV0aWxzLmlzTnVtYmVyKG9wdGlvbmFsQXJndW1lbnRzKSl7XG4gICAgICAgIG9wdGlvbmFsQXJndW1lbnRzID0ge3N0YWdnZXJGcmFjdGlvbjogb3B0aW9uYWxBcmd1bWVudHN9O1xuICAgIH1cblx0dmFyIGFuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwLCBvcHRpb25hbEFyZ3VtZW50cyk7XG59XG5cbmV4cG9ydCB7VHJhbnNpdGlvblRvLCBBbmltYXRpb24sIEVhc2luZ31cbiIsIihmdW5jdGlvbiAoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBsb29rdXAgPSBbXG5cdFx0XHQnQScsICdCJywgJ0MnLCAnRCcsICdFJywgJ0YnLCAnRycsICdIJyxcblx0XHRcdCdJJywgJ0onLCAnSycsICdMJywgJ00nLCAnTicsICdPJywgJ1AnLFxuXHRcdFx0J1EnLCAnUicsICdTJywgJ1QnLCAnVScsICdWJywgJ1cnLCAnWCcsXG5cdFx0XHQnWScsICdaJywgJ2EnLCAnYicsICdjJywgJ2QnLCAnZScsICdmJyxcblx0XHRcdCdnJywgJ2gnLCAnaScsICdqJywgJ2snLCAnbCcsICdtJywgJ24nLFxuXHRcdFx0J28nLCAncCcsICdxJywgJ3InLCAncycsICd0JywgJ3UnLCAndicsXG5cdFx0XHQndycsICd4JywgJ3knLCAneicsICcwJywgJzEnLCAnMicsICczJyxcblx0XHRcdCc0JywgJzUnLCAnNicsICc3JywgJzgnLCAnOScsICcrJywgJy8nXG5cdFx0XTtcblx0ZnVuY3Rpb24gY2xlYW4obGVuZ3RoKSB7XG5cdFx0dmFyIGksIGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGxlbmd0aCk7XG5cdFx0Zm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRidWZmZXJbaV0gPSAwO1xuXHRcdH1cblx0XHRyZXR1cm4gYnVmZmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gZXh0ZW5kKG9yaWcsIGxlbmd0aCwgYWRkTGVuZ3RoLCBtdWx0aXBsZU9mKSB7XG5cdFx0dmFyIG5ld1NpemUgPSBsZW5ndGggKyBhZGRMZW5ndGgsXG5cdFx0XHRidWZmZXIgPSBjbGVhbigocGFyc2VJbnQobmV3U2l6ZSAvIG11bHRpcGxlT2YpICsgMSkgKiBtdWx0aXBsZU9mKTtcblxuXHRcdGJ1ZmZlci5zZXQob3JpZyk7XG5cblx0XHRyZXR1cm4gYnVmZmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFkKG51bSwgYnl0ZXMsIGJhc2UpIHtcblx0XHRudW0gPSBudW0udG9TdHJpbmcoYmFzZSB8fCA4KTtcblx0XHRyZXR1cm4gXCIwMDAwMDAwMDAwMDBcIi5zdWJzdHIobnVtLmxlbmd0aCArIDEyIC0gYnl0ZXMpICsgbnVtO1xuXHR9XG5cblx0ZnVuY3Rpb24gc3RyaW5nVG9VaW50OCAoaW5wdXQsIG91dCwgb2Zmc2V0KSB7XG5cdFx0dmFyIGksIGxlbmd0aDtcblxuXHRcdG91dCA9IG91dCB8fCBjbGVhbihpbnB1dC5sZW5ndGgpO1xuXG5cdFx0b2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gaW5wdXQubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdG91dFtvZmZzZXRdID0gaW5wdXQuY2hhckNvZGVBdChpKTtcblx0XHRcdG9mZnNldCArPSAxO1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXQ7XG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0KHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGg7XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArIGxvb2t1cFtudW0gPj4gNiAmIDB4M0ZdICsgbG9va3VwW251bSAmIDB4M0ZdO1xuXHRcdH07XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKTtcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcCk7XG5cdFx0fVxuXG5cdFx0Ly8gdGhpcyBwcmV2ZW50cyBhbiBFUlJfSU5WQUxJRF9VUkwgaW4gQ2hyb21lIChGaXJlZm94IG9rYXkpXG5cdFx0c3dpdGNoIChvdXRwdXQubGVuZ3RoICUgNCkge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dDtcblx0fVxuXG5cdHdpbmRvdy51dGlscyA9IHt9XG5cdHdpbmRvdy51dGlscy5jbGVhbiA9IGNsZWFuO1xuXHR3aW5kb3cudXRpbHMucGFkID0gcGFkO1xuXHR3aW5kb3cudXRpbHMuZXh0ZW5kID0gZXh0ZW5kO1xuXHR3aW5kb3cudXRpbHMuc3RyaW5nVG9VaW50OCA9IHN0cmluZ1RvVWludDg7XG5cdHdpbmRvdy51dGlscy51aW50OFRvQmFzZTY0ID0gdWludDhUb0Jhc2U2NDtcbn0oKSk7XG5cbihmdW5jdGlvbiAoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXG4vKlxuc3RydWN0IHBvc2l4X2hlYWRlciB7ICAgICAgICAgICAgIC8vIGJ5dGUgb2Zmc2V0XG5cdGNoYXIgbmFtZVsxMDBdOyAgICAgICAgICAgICAgIC8vICAgMFxuXHRjaGFyIG1vZGVbOF07ICAgICAgICAgICAgICAgICAvLyAxMDBcblx0Y2hhciB1aWRbOF07ICAgICAgICAgICAgICAgICAgLy8gMTA4XG5cdGNoYXIgZ2lkWzhdOyAgICAgICAgICAgICAgICAgIC8vIDExNlxuXHRjaGFyIHNpemVbMTJdOyAgICAgICAgICAgICAgICAvLyAxMjRcblx0Y2hhciBtdGltZVsxMl07ICAgICAgICAgICAgICAgLy8gMTM2XG5cdGNoYXIgY2hrc3VtWzhdOyAgICAgICAgICAgICAgIC8vIDE0OFxuXHRjaGFyIHR5cGVmbGFnOyAgICAgICAgICAgICAgICAvLyAxNTZcblx0Y2hhciBsaW5rbmFtZVsxMDBdOyAgICAgICAgICAgLy8gMTU3XG5cdGNoYXIgbWFnaWNbNl07ICAgICAgICAgICAgICAgIC8vIDI1N1xuXHRjaGFyIHZlcnNpb25bMl07ICAgICAgICAgICAgICAvLyAyNjNcblx0Y2hhciB1bmFtZVszMl07ICAgICAgICAgICAgICAgLy8gMjY1XG5cdGNoYXIgZ25hbWVbMzJdOyAgICAgICAgICAgICAgIC8vIDI5N1xuXHRjaGFyIGRldm1ham9yWzhdOyAgICAgICAgICAgICAvLyAzMjlcblx0Y2hhciBkZXZtaW5vcls4XTsgICAgICAgICAgICAgLy8gMzM3XG5cdGNoYXIgcHJlZml4WzE1NV07ICAgICAgICAgICAgIC8vIDM0NVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDUwMFxufTtcbiovXG5cblx0dmFyIHV0aWxzID0gd2luZG93LnV0aWxzLFxuXHRcdGhlYWRlckZvcm1hdDtcblxuXHRoZWFkZXJGb3JtYXQgPSBbXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVOYW1lJyxcblx0XHRcdCdsZW5ndGgnOiAxMDBcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlTW9kZScsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3VpZCcsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2dpZCcsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVTaXplJyxcblx0XHRcdCdsZW5ndGgnOiAxMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ210aW1lJyxcblx0XHRcdCdsZW5ndGgnOiAxMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2NoZWNrc3VtJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndHlwZScsXG5cdFx0XHQnbGVuZ3RoJzogMVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2xpbmtOYW1lJyxcblx0XHRcdCdsZW5ndGgnOiAxMDBcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd1c3RhcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ293bmVyJyxcblx0XHRcdCdsZW5ndGgnOiAzMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2dyb3VwJyxcblx0XHRcdCdsZW5ndGgnOiAzMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ21ham9yTnVtYmVyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbWlub3JOdW1iZXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlbmFtZVByZWZpeCcsXG5cdFx0XHQnbGVuZ3RoJzogMTU1XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAncGFkZGluZycsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9XG5cdF07XG5cblx0ZnVuY3Rpb24gZm9ybWF0SGVhZGVyKGRhdGEsIGNiKSB7XG5cdFx0dmFyIGJ1ZmZlciA9IHV0aWxzLmNsZWFuKDUxMiksXG5cdFx0XHRvZmZzZXQgPSAwO1xuXG5cdFx0aGVhZGVyRm9ybWF0LmZvckVhY2goZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHR2YXIgc3RyID0gZGF0YVt2YWx1ZS5maWVsZF0gfHwgXCJcIixcblx0XHRcdFx0aSwgbGVuZ3RoO1xuXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSBzdHIubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdFx0YnVmZmVyW29mZnNldF0gPSBzdHIuY2hhckNvZGVBdChpKTtcblx0XHRcdFx0b2Zmc2V0ICs9IDE7XG5cdFx0XHR9XG5cblx0XHRcdG9mZnNldCArPSB2YWx1ZS5sZW5ndGggLSBpOyAvLyBzcGFjZSBpdCBvdXQgd2l0aCBudWxsc1xuXHRcdH0pO1xuXG5cdFx0aWYgKHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIGNiKGJ1ZmZlciwgb2Zmc2V0KTtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdHdpbmRvdy5oZWFkZXIgPSB7fVxuXHR3aW5kb3cuaGVhZGVyLnN0cnVjdHVyZSA9IGhlYWRlckZvcm1hdDtcblx0d2luZG93LmhlYWRlci5mb3JtYXQgPSBmb3JtYXRIZWFkZXI7XG59KCkpO1xuXG4oZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgaGVhZGVyID0gd2luZG93LmhlYWRlcixcblx0XHR1dGlscyA9IHdpbmRvdy51dGlscyxcblx0XHRyZWNvcmRTaXplID0gNTEyLFxuXHRcdGJsb2NrU2l6ZTtcblxuXHRmdW5jdGlvbiBUYXIocmVjb3Jkc1BlckJsb2NrKSB7XG5cdFx0dGhpcy53cml0dGVuID0gMDtcblx0XHRibG9ja1NpemUgPSAocmVjb3Jkc1BlckJsb2NrIHx8IDIwKSAqIHJlY29yZFNpemU7XG5cdFx0dGhpcy5vdXQgPSB1dGlscy5jbGVhbihibG9ja1NpemUpO1xuXHRcdHRoaXMuYmxvY2tzID0gW107XG5cdFx0dGhpcy5sZW5ndGggPSAwO1xuXHR9XG5cblx0VGFyLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbiAoZmlsZXBhdGgsIGlucHV0LCBvcHRzLCBjYWxsYmFjaykge1xuXHRcdHZhciBkYXRhLFxuXHRcdFx0Y2hlY2tzdW0sXG5cdFx0XHRtb2RlLFxuXHRcdFx0bXRpbWUsXG5cdFx0XHR1aWQsXG5cdFx0XHRnaWQsXG5cdFx0XHRoZWFkZXJBcnI7XG5cblx0XHRpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0aW5wdXQgPSB1dGlscy5zdHJpbmdUb1VpbnQ4KGlucHV0KTtcblx0XHR9IGVsc2UgaWYgKGlucHV0LmNvbnN0cnVjdG9yICE9PSBVaW50OEFycmF5LnByb3RvdHlwZS5jb25zdHJ1Y3Rvcikge1xuXHRcdFx0dGhyb3cgJ0ludmFsaWQgaW5wdXQgdHlwZS4gWW91IGdhdmUgbWU6ICcgKyBpbnB1dC5jb25zdHJ1Y3Rvci50b1N0cmluZygpLm1hdGNoKC9mdW5jdGlvblxccyooWyRBLVphLXpfXVswLTlBLVphLXpfXSopXFxzKlxcKC8pWzFdO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0Y2FsbGJhY2sgPSBvcHRzO1xuXHRcdFx0b3B0cyA9IHt9O1xuXHRcdH1cblxuXHRcdG9wdHMgPSBvcHRzIHx8IHt9O1xuXG5cdFx0bW9kZSA9IG9wdHMubW9kZSB8fCBwYXJzZUludCgnNzc3JywgOCkgJiAweGZmZjtcblx0XHRtdGltZSA9IG9wdHMubXRpbWUgfHwgTWF0aC5mbG9vcigrbmV3IERhdGUoKSAvIDEwMDApO1xuXHRcdHVpZCA9IG9wdHMudWlkIHx8IDA7XG5cdFx0Z2lkID0gb3B0cy5naWQgfHwgMDtcblxuXHRcdGRhdGEgPSB7XG5cdFx0XHRmaWxlTmFtZTogZmlsZXBhdGgsXG5cdFx0XHRmaWxlTW9kZTogdXRpbHMucGFkKG1vZGUsIDcpLFxuXHRcdFx0dWlkOiB1dGlscy5wYWQodWlkLCA3KSxcblx0XHRcdGdpZDogdXRpbHMucGFkKGdpZCwgNyksXG5cdFx0XHRmaWxlU2l6ZTogdXRpbHMucGFkKGlucHV0Lmxlbmd0aCwgMTEpLFxuXHRcdFx0bXRpbWU6IHV0aWxzLnBhZChtdGltZSwgMTEpLFxuXHRcdFx0Y2hlY2tzdW06ICcgICAgICAgICcsXG5cdFx0XHR0eXBlOiAnMCcsIC8vIGp1c3QgYSBmaWxlXG5cdFx0XHR1c3RhcjogJ3VzdGFyICAnLFxuXHRcdFx0b3duZXI6IG9wdHMub3duZXIgfHwgJycsXG5cdFx0XHRncm91cDogb3B0cy5ncm91cCB8fCAnJ1xuXHRcdH07XG5cblx0XHQvLyBjYWxjdWxhdGUgdGhlIGNoZWNrc3VtXG5cdFx0Y2hlY2tzdW0gPSAwO1xuXHRcdE9iamVjdC5rZXlzKGRhdGEpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdFx0dmFyIGksIHZhbHVlID0gZGF0YVtrZXldLCBsZW5ndGg7XG5cblx0XHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHZhbHVlLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRcdGNoZWNrc3VtICs9IHZhbHVlLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRkYXRhLmNoZWNrc3VtID0gdXRpbHMucGFkKGNoZWNrc3VtLCA2KSArIFwiXFx1MDAwMCBcIjtcblxuXHRcdGhlYWRlckFyciA9IGhlYWRlci5mb3JtYXQoZGF0YSk7XG5cblx0XHR2YXIgaGVhZGVyTGVuZ3RoID0gTWF0aC5jZWlsKCBoZWFkZXJBcnIubGVuZ3RoIC8gcmVjb3JkU2l6ZSApICogcmVjb3JkU2l6ZTtcblx0XHR2YXIgaW5wdXRMZW5ndGggPSBNYXRoLmNlaWwoIGlucHV0Lmxlbmd0aCAvIHJlY29yZFNpemUgKSAqIHJlY29yZFNpemU7XG5cblx0XHR0aGlzLmJsb2Nrcy5wdXNoKCB7IGhlYWRlcjogaGVhZGVyQXJyLCBpbnB1dDogaW5wdXQsIGhlYWRlckxlbmd0aDogaGVhZGVyTGVuZ3RoLCBpbnB1dExlbmd0aDogaW5wdXRMZW5ndGggfSApO1xuXG5cdH07XG5cblx0VGFyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgYnVmZmVycyA9IFtdO1xuXHRcdHZhciBjaHVua3MgPSBbXTtcblx0XHR2YXIgbGVuZ3RoID0gMDtcblx0XHR2YXIgbWF4ID0gTWF0aC5wb3coIDIsIDIwICk7XG5cblx0XHR2YXIgY2h1bmsgPSBbXTtcblx0XHR0aGlzLmJsb2Nrcy5mb3JFYWNoKCBmdW5jdGlvbiggYiApIHtcblx0XHRcdGlmKCBsZW5ndGggKyBiLmhlYWRlckxlbmd0aCArIGIuaW5wdXRMZW5ndGggPiBtYXggKSB7XG5cdFx0XHRcdGNodW5rcy5wdXNoKCB7IGJsb2NrczogY2h1bmssIGxlbmd0aDogbGVuZ3RoIH0gKTtcblx0XHRcdFx0Y2h1bmsgPSBbXTtcblx0XHRcdFx0bGVuZ3RoID0gMDtcblx0XHRcdH1cblx0XHRcdGNodW5rLnB1c2goIGIgKTtcblx0XHRcdGxlbmd0aCArPSBiLmhlYWRlckxlbmd0aCArIGIuaW5wdXRMZW5ndGg7XG5cdFx0fSApO1xuXHRcdGNodW5rcy5wdXNoKCB7IGJsb2NrczogY2h1bmssIGxlbmd0aDogbGVuZ3RoIH0gKTtcblxuXHRcdGNodW5rcy5mb3JFYWNoKCBmdW5jdGlvbiggYyApIHtcblxuXHRcdFx0dmFyIGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KCBjLmxlbmd0aCApO1xuXHRcdFx0dmFyIHdyaXR0ZW4gPSAwO1xuXHRcdFx0Yy5ibG9ja3MuZm9yRWFjaCggZnVuY3Rpb24oIGIgKSB7XG5cdFx0XHRcdGJ1ZmZlci5zZXQoIGIuaGVhZGVyLCB3cml0dGVuICk7XG5cdFx0XHRcdHdyaXR0ZW4gKz0gYi5oZWFkZXJMZW5ndGg7XG5cdFx0XHRcdGJ1ZmZlci5zZXQoIGIuaW5wdXQsIHdyaXR0ZW4gKTtcblx0XHRcdFx0d3JpdHRlbiArPSBiLmlucHV0TGVuZ3RoO1xuXHRcdFx0fSApO1xuXHRcdFx0YnVmZmVycy5wdXNoKCBidWZmZXIgKTtcblxuXHRcdH0gKTtcblxuXHRcdGJ1ZmZlcnMucHVzaCggbmV3IFVpbnQ4QXJyYXkoIDIgKiByZWNvcmRTaXplICkgKTtcblxuXHRcdHJldHVybiBuZXcgQmxvYiggYnVmZmVycywgeyB0eXBlOiAnb2N0ZXQvc3RyZWFtJyB9ICk7XG5cblx0fTtcblxuXHRUYXIucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMud3JpdHRlbiA9IDA7XG5cdFx0dGhpcy5vdXQgPSB1dGlscy5jbGVhbihibG9ja1NpemUpO1xuXHR9O1xuXG4gIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBUYXI7XG4gIH0gZWxzZSB7XG4gICAgd2luZG93LlRhciA9IFRhcjtcbiAgfVxufSgpKTtcbiIsIi8vZG93bmxvYWQuanMgdjMuMCwgYnkgZGFuZGF2aXM7IDIwMDgtMjAxNC4gW0NDQlkyXSBzZWUgaHR0cDovL2Rhbm1sLmNvbS9kb3dubG9hZC5odG1sIGZvciB0ZXN0cy91c2FnZVxuLy8gdjEgbGFuZGVkIGEgRkYrQ2hyb21lIGNvbXBhdCB3YXkgb2YgZG93bmxvYWRpbmcgc3RyaW5ncyB0byBsb2NhbCB1bi1uYW1lZCBmaWxlcywgdXBncmFkZWQgdG8gdXNlIGEgaGlkZGVuIGZyYW1lIGFuZCBvcHRpb25hbCBtaW1lXG4vLyB2MiBhZGRlZCBuYW1lZCBmaWxlcyB2aWEgYVtkb3dubG9hZF0sIG1zU2F2ZUJsb2IsIElFICgxMCspIHN1cHBvcnQsIGFuZCB3aW5kb3cuVVJMIHN1cHBvcnQgZm9yIGxhcmdlcitmYXN0ZXIgc2F2ZXMgdGhhbiBkYXRhVVJMc1xuLy8gdjMgYWRkZWQgZGF0YVVSTCBhbmQgQmxvYiBJbnB1dCwgYmluZC10b2dnbGUgYXJpdHksIGFuZCBsZWdhY3kgZGF0YVVSTCBmYWxsYmFjayB3YXMgaW1wcm92ZWQgd2l0aCBmb3JjZS1kb3dubG9hZCBtaW1lIGFuZCBiYXNlNjQgc3VwcG9ydFxuXG4vLyBkYXRhIGNhbiBiZSBhIHN0cmluZywgQmxvYiwgRmlsZSwgb3IgZGF0YVVSTFxuXG5cblxuXG5mdW5jdGlvbiBkb3dubG9hZChkYXRhLCBzdHJGaWxlTmFtZSwgc3RyTWltZVR5cGUpIHtcblxuXHR2YXIgc2VsZiA9IHdpbmRvdywgLy8gdGhpcyBzY3JpcHQgaXMgb25seSBmb3IgYnJvd3NlcnMgYW55d2F5Li4uXG5cdFx0dSA9IFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCIsIC8vIHRoaXMgZGVmYXVsdCBtaW1lIGFsc28gdHJpZ2dlcnMgaWZyYW1lIGRvd25sb2Fkc1xuXHRcdG0gPSBzdHJNaW1lVHlwZSB8fCB1LFxuXHRcdHggPSBkYXRhLFxuXHRcdEQgPSBkb2N1bWVudCxcblx0XHRhID0gRC5jcmVhdGVFbGVtZW50KFwiYVwiKSxcblx0XHR6ID0gZnVuY3Rpb24oYSl7cmV0dXJuIFN0cmluZyhhKTt9LFxuXG5cblx0XHRCID0gc2VsZi5CbG9iIHx8IHNlbGYuTW96QmxvYiB8fCBzZWxmLldlYktpdEJsb2IgfHwgeixcblx0XHRCQiA9IHNlbGYuTVNCbG9iQnVpbGRlciB8fCBzZWxmLldlYktpdEJsb2JCdWlsZGVyIHx8IHNlbGYuQmxvYkJ1aWxkZXIsXG5cdFx0Zm4gPSBzdHJGaWxlTmFtZSB8fCBcImRvd25sb2FkXCIsXG5cdFx0YmxvYixcblx0XHRiLFxuXHRcdHVhLFxuXHRcdGZyO1xuXG5cdC8vaWYodHlwZW9mIEIuYmluZCA9PT0gJ2Z1bmN0aW9uJyApeyBCPUIuYmluZChzZWxmKTsgfVxuXG5cdGlmKFN0cmluZyh0aGlzKT09PVwidHJ1ZVwiKXsgLy9yZXZlcnNlIGFyZ3VtZW50cywgYWxsb3dpbmcgZG93bmxvYWQuYmluZCh0cnVlLCBcInRleHQveG1sXCIsIFwiZXhwb3J0LnhtbFwiKSB0byBhY3QgYXMgYSBjYWxsYmFja1xuXHRcdHg9W3gsIG1dO1xuXHRcdG09eFswXTtcblx0XHR4PXhbMV07XG5cdH1cblxuXG5cblx0Ly9nbyBhaGVhZCBhbmQgZG93bmxvYWQgZGF0YVVSTHMgcmlnaHQgYXdheVxuXHRpZihTdHJpbmcoeCkubWF0Y2goL15kYXRhXFw6W1xcdytcXC1dK1xcL1tcXHcrXFwtXStbLDtdLykpe1xuXHRcdHJldHVybiBuYXZpZ2F0b3IubXNTYXZlQmxvYiA/ICAvLyBJRTEwIGNhbid0IGRvIGFbZG93bmxvYWRdLCBvbmx5IEJsb2JzOlxuXHRcdFx0bmF2aWdhdG9yLm1zU2F2ZUJsb2IoZDJiKHgpLCBmbikgOlxuXHRcdFx0c2F2ZXIoeCkgOyAvLyBldmVyeW9uZSBlbHNlIGNhbiBzYXZlIGRhdGFVUkxzIHVuLXByb2Nlc3NlZFxuXHR9Ly9lbmQgaWYgZGF0YVVSTCBwYXNzZWQ/XG5cblx0dHJ5e1xuXG5cdFx0YmxvYiA9IHggaW5zdGFuY2VvZiBCID9cblx0XHRcdHggOlxuXHRcdFx0bmV3IEIoW3hdLCB7dHlwZTogbX0pIDtcblx0fWNhdGNoKHkpe1xuXHRcdGlmKEJCKXtcblx0XHRcdGIgPSBuZXcgQkIoKTtcblx0XHRcdGIuYXBwZW5kKFt4XSk7XG5cdFx0XHRibG9iID0gYi5nZXRCbG9iKG0pOyAvLyB0aGUgYmxvYlxuXHRcdH1cblxuXHR9XG5cblxuXG5cdGZ1bmN0aW9uIGQyYih1KSB7XG5cdFx0dmFyIHA9IHUuc3BsaXQoL1s6OyxdLyksXG5cdFx0dD0gcFsxXSxcblx0XHRkZWM9IHBbMl0gPT0gXCJiYXNlNjRcIiA/IGF0b2IgOiBkZWNvZGVVUklDb21wb25lbnQsXG5cdFx0YmluPSBkZWMocC5wb3AoKSksXG5cdFx0bXg9IGJpbi5sZW5ndGgsXG5cdFx0aT0gMCxcblx0XHR1aWE9IG5ldyBVaW50OEFycmF5KG14KTtcblxuXHRcdGZvcihpO2k8bXg7KytpKSB1aWFbaV09IGJpbi5jaGFyQ29kZUF0KGkpO1xuXG5cdFx0cmV0dXJuIG5ldyBCKFt1aWFdLCB7dHlwZTogdH0pO1xuXHQgfVxuXG5cdGZ1bmN0aW9uIHNhdmVyKHVybCwgd2luTW9kZSl7XG5cblxuXHRcdGlmICgnZG93bmxvYWQnIGluIGEpIHsgLy9odG1sNSBBW2Rvd25sb2FkXVxuXHRcdFx0YS5ocmVmID0gdXJsO1xuXHRcdFx0YS5zZXRBdHRyaWJ1dGUoXCJkb3dubG9hZFwiLCBmbik7XG5cdFx0XHRhLmlubmVySFRNTCA9IFwiZG93bmxvYWRpbmcuLi5cIjtcblx0XHRcdGEuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdEQuYm9keS5hcHBlbmRDaGlsZChhKTtcblx0XHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGEuY2xpY2soKTtcblx0XHRcdFx0RC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xuXHRcdFx0XHRpZih3aW5Nb2RlPT09dHJ1ZSl7c2V0VGltZW91dChmdW5jdGlvbigpeyBzZWxmLlVSTC5yZXZva2VPYmplY3RVUkwoYS5ocmVmKTt9LCAyNTAgKTt9XG5cdFx0XHR9LCA2Nik7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvL2RvIGlmcmFtZSBkYXRhVVJMIGRvd25sb2FkIChvbGQgY2grRkYpOlxuXHRcdHZhciBmID0gRC5jcmVhdGVFbGVtZW50KFwiaWZyYW1lXCIpO1xuXHRcdEQuYm9keS5hcHBlbmRDaGlsZChmKTtcblx0XHRpZighd2luTW9kZSl7IC8vIGZvcmNlIGEgbWltZSB0aGF0IHdpbGwgZG93bmxvYWQ6XG5cdFx0XHR1cmw9XCJkYXRhOlwiK3VybC5yZXBsYWNlKC9eZGF0YTooW1xcd1xcL1xcLVxcK10rKS8sIHUpO1xuXHRcdH1cblxuXG5cdFx0Zi5zcmMgPSB1cmw7XG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpeyBELmJvZHkucmVtb3ZlQ2hpbGQoZik7IH0sIDMzMyk7XG5cblx0fS8vZW5kIHNhdmVyXG5cblxuXHRpZiAobmF2aWdhdG9yLm1zU2F2ZUJsb2IpIHsgLy8gSUUxMCsgOiAoaGFzIEJsb2IsIGJ1dCBub3QgYVtkb3dubG9hZF0gb3IgVVJMKVxuXHRcdHJldHVybiBuYXZpZ2F0b3IubXNTYXZlQmxvYihibG9iLCBmbik7XG5cdH1cblxuXHRpZihzZWxmLlVSTCl7IC8vIHNpbXBsZSBmYXN0IGFuZCBtb2Rlcm4gd2F5IHVzaW5nIEJsb2IgYW5kIFVSTDpcblx0XHRzYXZlcihzZWxmLlVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYiksIHRydWUpO1xuXHR9ZWxzZXtcblx0XHQvLyBoYW5kbGUgbm9uLUJsb2IoKStub24tVVJMIGJyb3dzZXJzOlxuXHRcdGlmKHR5cGVvZiBibG9iID09PSBcInN0cmluZ1wiIHx8IGJsb2IuY29uc3RydWN0b3I9PT16ICl7XG5cdFx0XHR0cnl7XG5cdFx0XHRcdHJldHVybiBzYXZlciggXCJkYXRhOlwiICsgIG0gICArIFwiO2Jhc2U2NCxcIiAgKyAgc2VsZi5idG9hKGJsb2IpICApO1xuXHRcdFx0fWNhdGNoKHkpe1xuXHRcdFx0XHRyZXR1cm4gc2F2ZXIoIFwiZGF0YTpcIiArICBtICAgKyBcIixcIiArIGVuY29kZVVSSUNvbXBvbmVudChibG9iKSAgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBCbG9iIGJ1dCBub3QgVVJMOlxuXHRcdGZyPW5ldyBGaWxlUmVhZGVyKCk7XG5cdFx0ZnIub25sb2FkPWZ1bmN0aW9uKGUpe1xuXHRcdFx0c2F2ZXIodGhpcy5yZXN1bHQpO1xuXHRcdH07XG5cdFx0ZnIucmVhZEFzRGF0YVVSTChibG9iKTtcblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn0gLyogZW5kIGRvd25sb2FkKCkgKi9cblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBkb3dubG9hZDtcbn1cbiIsIi8vIGdpZi5qcyAwLjIuMCAtIGh0dHBzOi8vZ2l0aHViLmNvbS9qbm9yZGJlcmcvZ2lmLmpzXHJcbihmdW5jdGlvbihmKXtpZih0eXBlb2YgZXhwb3J0cz09PVwib2JqZWN0XCImJnR5cGVvZiBtb2R1bGUhPT1cInVuZGVmaW5lZFwiKXttb2R1bGUuZXhwb3J0cz1mKCl9ZWxzZSBpZih0eXBlb2YgZGVmaW5lPT09XCJmdW5jdGlvblwiJiZkZWZpbmUuYW1kKXtkZWZpbmUoW10sZil9ZWxzZXt2YXIgZztpZih0eXBlb2Ygd2luZG93IT09XCJ1bmRlZmluZWRcIil7Zz13aW5kb3d9ZWxzZSBpZih0eXBlb2YgZ2xvYmFsIT09XCJ1bmRlZmluZWRcIil7Zz1nbG9iYWx9ZWxzZSBpZih0eXBlb2Ygc2VsZiE9PVwidW5kZWZpbmVkXCIpe2c9c2VsZn1lbHNle2c9dGhpc31nLkdJRj1mKCl9fSkoZnVuY3Rpb24oKXt2YXIgZGVmaW5lLG1vZHVsZSxleHBvcnRzO3JldHVybiBmdW5jdGlvbigpe2Z1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfXJldHVybiBlfSgpKHsxOltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXtmdW5jdGlvbiBFdmVudEVtaXR0ZXIoKXt0aGlzLl9ldmVudHM9dGhpcy5fZXZlbnRzfHx7fTt0aGlzLl9tYXhMaXN0ZW5lcnM9dGhpcy5fbWF4TGlzdGVuZXJzfHx1bmRlZmluZWR9bW9kdWxlLmV4cG9ydHM9RXZlbnRFbWl0dGVyO0V2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXI9RXZlbnRFbWl0dGVyO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cz11bmRlZmluZWQ7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzPXVuZGVmaW5lZDtFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycz0xMDtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycz1mdW5jdGlvbihuKXtpZighaXNOdW1iZXIobil8fG48MHx8aXNOYU4obikpdGhyb3cgVHlwZUVycm9yKFwibiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIpO3RoaXMuX21heExpc3RlbmVycz1uO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQ9ZnVuY3Rpb24odHlwZSl7dmFyIGVyLGhhbmRsZXIsbGVuLGFyZ3MsaSxsaXN0ZW5lcnM7aWYoIXRoaXMuX2V2ZW50cyl0aGlzLl9ldmVudHM9e307aWYodHlwZT09PVwiZXJyb3JcIil7aWYoIXRoaXMuX2V2ZW50cy5lcnJvcnx8aXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSYmIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpe2VyPWFyZ3VtZW50c1sxXTtpZihlciBpbnN0YW5jZW9mIEVycm9yKXt0aHJvdyBlcn1lbHNle3ZhciBlcnI9bmV3IEVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LiAoJytlcitcIilcIik7ZXJyLmNvbnRleHQ9ZXI7dGhyb3cgZXJyfX19aGFuZGxlcj10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNVbmRlZmluZWQoaGFuZGxlcikpcmV0dXJuIGZhbHNlO2lmKGlzRnVuY3Rpb24oaGFuZGxlcikpe3N3aXRjaChhcmd1bWVudHMubGVuZ3RoKXtjYXNlIDE6aGFuZGxlci5jYWxsKHRoaXMpO2JyZWFrO2Nhc2UgMjpoYW5kbGVyLmNhbGwodGhpcyxhcmd1bWVudHNbMV0pO2JyZWFrO2Nhc2UgMzpoYW5kbGVyLmNhbGwodGhpcyxhcmd1bWVudHNbMV0sYXJndW1lbnRzWzJdKTticmVhaztkZWZhdWx0OmFyZ3M9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpO2hhbmRsZXIuYXBwbHkodGhpcyxhcmdzKX19ZWxzZSBpZihpc09iamVjdChoYW5kbGVyKSl7YXJncz1BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsMSk7bGlzdGVuZXJzPWhhbmRsZXIuc2xpY2UoKTtsZW49bGlzdGVuZXJzLmxlbmd0aDtmb3IoaT0wO2k8bGVuO2krKylsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcyxhcmdzKX1yZXR1cm4gdHJ1ZX07RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcj1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXt2YXIgbTtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO2lmKCF0aGlzLl9ldmVudHMpdGhpcy5fZXZlbnRzPXt9O2lmKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcil0aGlzLmVtaXQoXCJuZXdMaXN0ZW5lclwiLHR5cGUsaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcik/bGlzdGVuZXIubGlzdGVuZXI6bGlzdGVuZXIpO2lmKCF0aGlzLl9ldmVudHNbdHlwZV0pdGhpcy5fZXZlbnRzW3R5cGVdPWxpc3RlbmVyO2Vsc2UgaWYoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSl0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7ZWxzZSB0aGlzLl9ldmVudHNbdHlwZV09W3RoaXMuX2V2ZW50c1t0eXBlXSxsaXN0ZW5lcl07aWYoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSYmIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpe2lmKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKXttPXRoaXMuX21heExpc3RlbmVyc31lbHNle209RXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnN9aWYobSYmbT4wJiZ0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoPm0pe3RoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQ9dHJ1ZTtjb25zb2xlLmVycm9yKFwiKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgXCIrXCJsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuIFwiK1wiVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuXCIsdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7aWYodHlwZW9mIGNvbnNvbGUudHJhY2U9PT1cImZ1bmN0aW9uXCIpe2NvbnNvbGUudHJhY2UoKX19fXJldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uPUV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7dmFyIGZpcmVkPWZhbHNlO2Z1bmN0aW9uIGcoKXt0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsZyk7aWYoIWZpcmVkKXtmaXJlZD10cnVlO2xpc3RlbmVyLmFwcGx5KHRoaXMsYXJndW1lbnRzKX19Zy5saXN0ZW5lcj1saXN0ZW5lcjt0aGlzLm9uKHR5cGUsZyk7cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXI9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7dmFyIGxpc3QscG9zaXRpb24sbGVuZ3RoLGk7aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTtpZighdGhpcy5fZXZlbnRzfHwhdGhpcy5fZXZlbnRzW3R5cGVdKXJldHVybiB0aGlzO2xpc3Q9dGhpcy5fZXZlbnRzW3R5cGVdO2xlbmd0aD1saXN0Lmxlbmd0aDtwb3NpdGlvbj0tMTtpZihsaXN0PT09bGlzdGVuZXJ8fGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikmJmxpc3QubGlzdGVuZXI9PT1saXN0ZW5lcil7ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtpZih0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpdGhpcy5lbWl0KFwicmVtb3ZlTGlzdGVuZXJcIix0eXBlLGxpc3RlbmVyKX1lbHNlIGlmKGlzT2JqZWN0KGxpc3QpKXtmb3IoaT1sZW5ndGg7aS0tID4wOyl7aWYobGlzdFtpXT09PWxpc3RlbmVyfHxsaXN0W2ldLmxpc3RlbmVyJiZsaXN0W2ldLmxpc3RlbmVyPT09bGlzdGVuZXIpe3Bvc2l0aW9uPWk7YnJlYWt9fWlmKHBvc2l0aW9uPDApcmV0dXJuIHRoaXM7aWYobGlzdC5sZW5ndGg9PT0xKXtsaXN0Lmxlbmd0aD0wO2RlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV19ZWxzZXtsaXN0LnNwbGljZShwb3NpdGlvbiwxKX1pZih0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpdGhpcy5lbWl0KFwicmVtb3ZlTGlzdGVuZXJcIix0eXBlLGxpc3RlbmVyKX1yZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnM9ZnVuY3Rpb24odHlwZSl7dmFyIGtleSxsaXN0ZW5lcnM7aWYoIXRoaXMuX2V2ZW50cylyZXR1cm4gdGhpcztpZighdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXtpZihhcmd1bWVudHMubGVuZ3RoPT09MCl0aGlzLl9ldmVudHM9e307ZWxzZSBpZih0aGlzLl9ldmVudHNbdHlwZV0pZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtyZXR1cm4gdGhpc31pZihhcmd1bWVudHMubGVuZ3RoPT09MCl7Zm9yKGtleSBpbiB0aGlzLl9ldmVudHMpe2lmKGtleT09PVwicmVtb3ZlTGlzdGVuZXJcIiljb250aW51ZTt0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpfXRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKFwicmVtb3ZlTGlzdGVuZXJcIik7dGhpcy5fZXZlbnRzPXt9O3JldHVybiB0aGlzfWxpc3RlbmVycz10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKXt0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsbGlzdGVuZXJzKX1lbHNlIGlmKGxpc3RlbmVycyl7d2hpbGUobGlzdGVuZXJzLmxlbmd0aCl0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGgtMV0pfWRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzPWZ1bmN0aW9uKHR5cGUpe3ZhciByZXQ7aWYoIXRoaXMuX2V2ZW50c3x8IXRoaXMuX2V2ZW50c1t0eXBlXSlyZXQ9W107ZWxzZSBpZihpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpcmV0PVt0aGlzLl9ldmVudHNbdHlwZV1dO2Vsc2UgcmV0PXRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO3JldHVybiByZXR9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudD1mdW5jdGlvbih0eXBlKXtpZih0aGlzLl9ldmVudHMpe3ZhciBldmxpc3RlbmVyPXRoaXMuX2V2ZW50c1t0eXBlXTtpZihpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKXJldHVybiAxO2Vsc2UgaWYoZXZsaXN0ZW5lcilyZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGh9cmV0dXJuIDB9O0V2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50PWZ1bmN0aW9uKGVtaXR0ZXIsdHlwZSl7cmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKX07ZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJmdW5jdGlvblwifWZ1bmN0aW9uIGlzTnVtYmVyKGFyZyl7cmV0dXJuIHR5cGVvZiBhcmc9PT1cIm51bWJlclwifWZ1bmN0aW9uIGlzT2JqZWN0KGFyZyl7cmV0dXJuIHR5cGVvZiBhcmc9PT1cIm9iamVjdFwiJiZhcmchPT1udWxsfWZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZyl7cmV0dXJuIGFyZz09PXZvaWQgMH19LHt9XSwyOltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgTmV1UXVhbnQ9cmVxdWlyZShcIi4vVHlwZWROZXVRdWFudC5qc1wiKTt2YXIgTFpXRW5jb2Rlcj1yZXF1aXJlKFwiLi9MWldFbmNvZGVyLmpzXCIpO2Z1bmN0aW9uIEJ5dGVBcnJheSgpe3RoaXMucGFnZT0tMTt0aGlzLnBhZ2VzPVtdO3RoaXMubmV3UGFnZSgpfUJ5dGVBcnJheS5wYWdlU2l6ZT00MDk2O0J5dGVBcnJheS5jaGFyTWFwPXt9O2Zvcih2YXIgaT0wO2k8MjU2O2krKylCeXRlQXJyYXkuY2hhck1hcFtpXT1TdHJpbmcuZnJvbUNoYXJDb2RlKGkpO0J5dGVBcnJheS5wcm90b3R5cGUubmV3UGFnZT1mdW5jdGlvbigpe3RoaXMucGFnZXNbKyt0aGlzLnBhZ2VdPW5ldyBVaW50OEFycmF5KEJ5dGVBcnJheS5wYWdlU2l6ZSk7dGhpcy5jdXJzb3I9MH07Qnl0ZUFycmF5LnByb3RvdHlwZS5nZXREYXRhPWZ1bmN0aW9uKCl7dmFyIHJ2PVwiXCI7Zm9yKHZhciBwPTA7cDx0aGlzLnBhZ2VzLmxlbmd0aDtwKyspe2Zvcih2YXIgaT0wO2k8Qnl0ZUFycmF5LnBhZ2VTaXplO2krKyl7cnYrPUJ5dGVBcnJheS5jaGFyTWFwW3RoaXMucGFnZXNbcF1baV1dfX1yZXR1cm4gcnZ9O0J5dGVBcnJheS5wcm90b3R5cGUud3JpdGVCeXRlPWZ1bmN0aW9uKHZhbCl7aWYodGhpcy5jdXJzb3I+PUJ5dGVBcnJheS5wYWdlU2l6ZSl0aGlzLm5ld1BhZ2UoKTt0aGlzLnBhZ2VzW3RoaXMucGFnZV1bdGhpcy5jdXJzb3IrK109dmFsfTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlVVRGQnl0ZXM9ZnVuY3Rpb24oc3RyaW5nKXtmb3IodmFyIGw9c3RyaW5nLmxlbmd0aCxpPTA7aTxsO2krKyl0aGlzLndyaXRlQnl0ZShzdHJpbmcuY2hhckNvZGVBdChpKSl9O0J5dGVBcnJheS5wcm90b3R5cGUud3JpdGVCeXRlcz1mdW5jdGlvbihhcnJheSxvZmZzZXQsbGVuZ3RoKXtmb3IodmFyIGw9bGVuZ3RofHxhcnJheS5sZW5ndGgsaT1vZmZzZXR8fDA7aTxsO2krKyl0aGlzLndyaXRlQnl0ZShhcnJheVtpXSl9O2Z1bmN0aW9uIEdJRkVuY29kZXIod2lkdGgsaGVpZ2h0KXt0aGlzLndpZHRoPX5+d2lkdGg7dGhpcy5oZWlnaHQ9fn5oZWlnaHQ7dGhpcy50cmFuc3BhcmVudD1udWxsO3RoaXMudHJhbnNJbmRleD0wO3RoaXMucmVwZWF0PS0xO3RoaXMuZGVsYXk9MDt0aGlzLmltYWdlPW51bGw7dGhpcy5waXhlbHM9bnVsbDt0aGlzLmluZGV4ZWRQaXhlbHM9bnVsbDt0aGlzLmNvbG9yRGVwdGg9bnVsbDt0aGlzLmNvbG9yVGFiPW51bGw7dGhpcy5uZXVRdWFudD1udWxsO3RoaXMudXNlZEVudHJ5PW5ldyBBcnJheTt0aGlzLnBhbFNpemU9Nzt0aGlzLmRpc3Bvc2U9LTE7dGhpcy5maXJzdEZyYW1lPXRydWU7dGhpcy5zYW1wbGU9MTA7dGhpcy5kaXRoZXI9ZmFsc2U7dGhpcy5nbG9iYWxQYWxldHRlPWZhbHNlO3RoaXMub3V0PW5ldyBCeXRlQXJyYXl9R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGVsYXk9ZnVuY3Rpb24obWlsbGlzZWNvbmRzKXt0aGlzLmRlbGF5PU1hdGgucm91bmQobWlsbGlzZWNvbmRzLzEwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RnJhbWVSYXRlPWZ1bmN0aW9uKGZwcyl7dGhpcy5kZWxheT1NYXRoLnJvdW5kKDEwMC9mcHMpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXREaXNwb3NlPWZ1bmN0aW9uKGRpc3Bvc2FsQ29kZSl7aWYoZGlzcG9zYWxDb2RlPj0wKXRoaXMuZGlzcG9zZT1kaXNwb3NhbENvZGV9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFJlcGVhdD1mdW5jdGlvbihyZXBlYXQpe3RoaXMucmVwZWF0PXJlcGVhdH07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0VHJhbnNwYXJlbnQ9ZnVuY3Rpb24oY29sb3Ipe3RoaXMudHJhbnNwYXJlbnQ9Y29sb3J9O0dJRkVuY29kZXIucHJvdG90eXBlLmFkZEZyYW1lPWZ1bmN0aW9uKGltYWdlRGF0YSl7dGhpcy5pbWFnZT1pbWFnZURhdGE7dGhpcy5jb2xvclRhYj10aGlzLmdsb2JhbFBhbGV0dGUmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZT90aGlzLmdsb2JhbFBhbGV0dGU6bnVsbDt0aGlzLmdldEltYWdlUGl4ZWxzKCk7dGhpcy5hbmFseXplUGl4ZWxzKCk7aWYodGhpcy5nbG9iYWxQYWxldHRlPT09dHJ1ZSl0aGlzLmdsb2JhbFBhbGV0dGU9dGhpcy5jb2xvclRhYjtpZih0aGlzLmZpcnN0RnJhbWUpe3RoaXMud3JpdGVMU0QoKTt0aGlzLndyaXRlUGFsZXR0ZSgpO2lmKHRoaXMucmVwZWF0Pj0wKXt0aGlzLndyaXRlTmV0c2NhcGVFeHQoKX19dGhpcy53cml0ZUdyYXBoaWNDdHJsRXh0KCk7dGhpcy53cml0ZUltYWdlRGVzYygpO2lmKCF0aGlzLmZpcnN0RnJhbWUmJiF0aGlzLmdsb2JhbFBhbGV0dGUpdGhpcy53cml0ZVBhbGV0dGUoKTt0aGlzLndyaXRlUGl4ZWxzKCk7dGhpcy5maXJzdEZyYW1lPWZhbHNlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5maW5pc2g9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoNTkpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRRdWFsaXR5PWZ1bmN0aW9uKHF1YWxpdHkpe2lmKHF1YWxpdHk8MSlxdWFsaXR5PTE7dGhpcy5zYW1wbGU9cXVhbGl0eX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGl0aGVyPWZ1bmN0aW9uKGRpdGhlcil7aWYoZGl0aGVyPT09dHJ1ZSlkaXRoZXI9XCJGbG95ZFN0ZWluYmVyZ1wiO3RoaXMuZGl0aGVyPWRpdGhlcn07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0R2xvYmFsUGFsZXR0ZT1mdW5jdGlvbihwYWxldHRlKXt0aGlzLmdsb2JhbFBhbGV0dGU9cGFsZXR0ZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZ2V0R2xvYmFsUGFsZXR0ZT1mdW5jdGlvbigpe3JldHVybiB0aGlzLmdsb2JhbFBhbGV0dGUmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZSYmdGhpcy5nbG9iYWxQYWxldHRlLnNsaWNlKDApfHx0aGlzLmdsb2JhbFBhbGV0dGV9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlSGVhZGVyPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVVVEZCeXRlcyhcIkdJRjg5YVwiKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuYW5hbHl6ZVBpeGVscz1mdW5jdGlvbigpe2lmKCF0aGlzLmNvbG9yVGFiKXt0aGlzLm5ldVF1YW50PW5ldyBOZXVRdWFudCh0aGlzLnBpeGVscyx0aGlzLnNhbXBsZSk7dGhpcy5uZXVRdWFudC5idWlsZENvbG9ybWFwKCk7dGhpcy5jb2xvclRhYj10aGlzLm5ldVF1YW50LmdldENvbG9ybWFwKCl9aWYodGhpcy5kaXRoZXIpe3RoaXMuZGl0aGVyUGl4ZWxzKHRoaXMuZGl0aGVyLnJlcGxhY2UoXCItc2VycGVudGluZVwiLFwiXCIpLHRoaXMuZGl0aGVyLm1hdGNoKC8tc2VycGVudGluZS8pIT09bnVsbCl9ZWxzZXt0aGlzLmluZGV4UGl4ZWxzKCl9dGhpcy5waXhlbHM9bnVsbDt0aGlzLmNvbG9yRGVwdGg9ODt0aGlzLnBhbFNpemU9NztpZih0aGlzLnRyYW5zcGFyZW50IT09bnVsbCl7dGhpcy50cmFuc0luZGV4PXRoaXMuZmluZENsb3Nlc3QodGhpcy50cmFuc3BhcmVudCx0cnVlKX19O0dJRkVuY29kZXIucHJvdG90eXBlLmluZGV4UGl4ZWxzPWZ1bmN0aW9uKGltZ3Epe3ZhciBuUGl4PXRoaXMucGl4ZWxzLmxlbmd0aC8zO3RoaXMuaW5kZXhlZFBpeGVscz1uZXcgVWludDhBcnJheShuUGl4KTt2YXIgaz0wO2Zvcih2YXIgaj0wO2o8blBpeDtqKyspe3ZhciBpbmRleD10aGlzLmZpbmRDbG9zZXN0UkdCKHRoaXMucGl4ZWxzW2srK10mMjU1LHRoaXMucGl4ZWxzW2srK10mMjU1LHRoaXMucGl4ZWxzW2srK10mMjU1KTt0aGlzLnVzZWRFbnRyeVtpbmRleF09dHJ1ZTt0aGlzLmluZGV4ZWRQaXhlbHNbal09aW5kZXh9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5kaXRoZXJQaXhlbHM9ZnVuY3Rpb24oa2VybmVsLHNlcnBlbnRpbmUpe3ZhciBrZXJuZWxzPXtGYWxzZUZsb3lkU3RlaW5iZXJnOltbMy84LDEsMF0sWzMvOCwwLDFdLFsyLzgsMSwxXV0sRmxveWRTdGVpbmJlcmc6W1s3LzE2LDEsMF0sWzMvMTYsLTEsMV0sWzUvMTYsMCwxXSxbMS8xNiwxLDFdXSxTdHVja2k6W1s4LzQyLDEsMF0sWzQvNDIsMiwwXSxbMi80MiwtMiwxXSxbNC80MiwtMSwxXSxbOC80MiwwLDFdLFs0LzQyLDEsMV0sWzIvNDIsMiwxXSxbMS80MiwtMiwyXSxbMi80MiwtMSwyXSxbNC80MiwwLDJdLFsyLzQyLDEsMl0sWzEvNDIsMiwyXV0sQXRraW5zb246W1sxLzgsMSwwXSxbMS84LDIsMF0sWzEvOCwtMSwxXSxbMS84LDAsMV0sWzEvOCwxLDFdLFsxLzgsMCwyXV19O2lmKCFrZXJuZWx8fCFrZXJuZWxzW2tlcm5lbF0pe3Rocm93XCJVbmtub3duIGRpdGhlcmluZyBrZXJuZWw6IFwiK2tlcm5lbH12YXIgZHM9a2VybmVsc1trZXJuZWxdO3ZhciBpbmRleD0wLGhlaWdodD10aGlzLmhlaWdodCx3aWR0aD10aGlzLndpZHRoLGRhdGE9dGhpcy5waXhlbHM7dmFyIGRpcmVjdGlvbj1zZXJwZW50aW5lPy0xOjE7dGhpcy5pbmRleGVkUGl4ZWxzPW5ldyBVaW50OEFycmF5KHRoaXMucGl4ZWxzLmxlbmd0aC8zKTtmb3IodmFyIHk9MDt5PGhlaWdodDt5Kyspe2lmKHNlcnBlbnRpbmUpZGlyZWN0aW9uPWRpcmVjdGlvbiotMTtmb3IodmFyIHg9ZGlyZWN0aW9uPT0xPzA6d2lkdGgtMSx4ZW5kPWRpcmVjdGlvbj09MT93aWR0aDowO3ghPT14ZW5kO3grPWRpcmVjdGlvbil7aW5kZXg9eSp3aWR0aCt4O3ZhciBpZHg9aW5kZXgqMzt2YXIgcjE9ZGF0YVtpZHhdO3ZhciBnMT1kYXRhW2lkeCsxXTt2YXIgYjE9ZGF0YVtpZHgrMl07aWR4PXRoaXMuZmluZENsb3Nlc3RSR0IocjEsZzEsYjEpO3RoaXMudXNlZEVudHJ5W2lkeF09dHJ1ZTt0aGlzLmluZGV4ZWRQaXhlbHNbaW5kZXhdPWlkeDtpZHgqPTM7dmFyIHIyPXRoaXMuY29sb3JUYWJbaWR4XTt2YXIgZzI9dGhpcy5jb2xvclRhYltpZHgrMV07dmFyIGIyPXRoaXMuY29sb3JUYWJbaWR4KzJdO3ZhciBlcj1yMS1yMjt2YXIgZWc9ZzEtZzI7dmFyIGViPWIxLWIyO2Zvcih2YXIgaT1kaXJlY3Rpb249PTE/MDpkcy5sZW5ndGgtMSxlbmQ9ZGlyZWN0aW9uPT0xP2RzLmxlbmd0aDowO2khPT1lbmQ7aSs9ZGlyZWN0aW9uKXt2YXIgeDE9ZHNbaV1bMV07dmFyIHkxPWRzW2ldWzJdO2lmKHgxK3g+PTAmJngxK3g8d2lkdGgmJnkxK3k+PTAmJnkxK3k8aGVpZ2h0KXt2YXIgZD1kc1tpXVswXTtpZHg9aW5kZXgreDEreTEqd2lkdGg7aWR4Kj0zO2RhdGFbaWR4XT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeF0rZXIqZCkpO2RhdGFbaWR4KzFdPU1hdGgubWF4KDAsTWF0aC5taW4oMjU1LGRhdGFbaWR4KzFdK2VnKmQpKTtkYXRhW2lkeCsyXT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeCsyXStlYipkKSl9fX19fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5maW5kQ2xvc2VzdD1mdW5jdGlvbihjLHVzZWQpe3JldHVybiB0aGlzLmZpbmRDbG9zZXN0UkdCKChjJjE2NzExNjgwKT4+MTYsKGMmNjUyODApPj44LGMmMjU1LHVzZWQpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5maW5kQ2xvc2VzdFJHQj1mdW5jdGlvbihyLGcsYix1c2VkKXtpZih0aGlzLmNvbG9yVGFiPT09bnVsbClyZXR1cm4tMTtpZih0aGlzLm5ldVF1YW50JiYhdXNlZCl7cmV0dXJuIHRoaXMubmV1UXVhbnQubG9va3VwUkdCKHIsZyxiKX12YXIgYz1ifGc8PDh8cjw8MTY7dmFyIG1pbnBvcz0wO3ZhciBkbWluPTI1NioyNTYqMjU2O3ZhciBsZW49dGhpcy5jb2xvclRhYi5sZW5ndGg7Zm9yKHZhciBpPTAsaW5kZXg9MDtpPGxlbjtpbmRleCsrKXt2YXIgZHI9ci0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGRnPWctKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkYj1iLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZD1kcipkcitkZypkZytkYipkYjtpZigoIXVzZWR8fHRoaXMudXNlZEVudHJ5W2luZGV4XSkmJmQ8ZG1pbil7ZG1pbj1kO21pbnBvcz1pbmRleH19cmV0dXJuIG1pbnBvc307R0lGRW5jb2Rlci5wcm90b3R5cGUuZ2V0SW1hZ2VQaXhlbHM9ZnVuY3Rpb24oKXt2YXIgdz10aGlzLndpZHRoO3ZhciBoPXRoaXMuaGVpZ2h0O3RoaXMucGl4ZWxzPW5ldyBVaW50OEFycmF5KHcqaCozKTt2YXIgZGF0YT10aGlzLmltYWdlO3ZhciBzcmNQb3M9MDt2YXIgY291bnQ9MDtmb3IodmFyIGk9MDtpPGg7aSsrKXtmb3IodmFyIGo9MDtqPHc7aisrKXt0aGlzLnBpeGVsc1tjb3VudCsrXT1kYXRhW3NyY1BvcysrXTt0aGlzLnBpeGVsc1tjb3VudCsrXT1kYXRhW3NyY1BvcysrXTt0aGlzLnBpeGVsc1tjb3VudCsrXT1kYXRhW3NyY1BvcysrXTtzcmNQb3MrK319fTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUdyYXBoaWNDdHJsRXh0PWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDMzKTt0aGlzLm91dC53cml0ZUJ5dGUoMjQ5KTt0aGlzLm91dC53cml0ZUJ5dGUoNCk7dmFyIHRyYW5zcCxkaXNwO2lmKHRoaXMudHJhbnNwYXJlbnQ9PT1udWxsKXt0cmFuc3A9MDtkaXNwPTB9ZWxzZXt0cmFuc3A9MTtkaXNwPTJ9aWYodGhpcy5kaXNwb3NlPj0wKXtkaXNwPXRoaXMuZGlzcG9zZSY3fWRpc3A8PD0yO3RoaXMub3V0LndyaXRlQnl0ZSgwfGRpc3B8MHx0cmFuc3ApO3RoaXMud3JpdGVTaG9ydCh0aGlzLmRlbGF5KTt0aGlzLm91dC53cml0ZUJ5dGUodGhpcy50cmFuc0luZGV4KTt0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlSW1hZ2VEZXNjPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDQ0KTt0aGlzLndyaXRlU2hvcnQoMCk7dGhpcy53cml0ZVNob3J0KDApO3RoaXMud3JpdGVTaG9ydCh0aGlzLndpZHRoKTt0aGlzLndyaXRlU2hvcnQodGhpcy5oZWlnaHQpO2lmKHRoaXMuZmlyc3RGcmFtZXx8dGhpcy5nbG9iYWxQYWxldHRlKXt0aGlzLm91dC53cml0ZUJ5dGUoMCl9ZWxzZXt0aGlzLm91dC53cml0ZUJ5dGUoMTI4fDB8MHwwfHRoaXMucGFsU2l6ZSl9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUxTRD1mdW5jdGlvbigpe3RoaXMud3JpdGVTaG9ydCh0aGlzLndpZHRoKTt0aGlzLndyaXRlU2hvcnQodGhpcy5oZWlnaHQpO3RoaXMub3V0LndyaXRlQnl0ZSgxMjh8MTEyfDB8dGhpcy5wYWxTaXplKTt0aGlzLm91dC53cml0ZUJ5dGUoMCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZU5ldHNjYXBlRXh0PWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDMzKTt0aGlzLm91dC53cml0ZUJ5dGUoMjU1KTt0aGlzLm91dC53cml0ZUJ5dGUoMTEpO3RoaXMub3V0LndyaXRlVVRGQnl0ZXMoXCJORVRTQ0FQRTIuMFwiKTt0aGlzLm91dC53cml0ZUJ5dGUoMyk7dGhpcy5vdXQud3JpdGVCeXRlKDEpO3RoaXMud3JpdGVTaG9ydCh0aGlzLnJlcGVhdCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZVBhbGV0dGU9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGVzKHRoaXMuY29sb3JUYWIpO3ZhciBuPTMqMjU2LXRoaXMuY29sb3JUYWIubGVuZ3RoO2Zvcih2YXIgaT0wO2k8bjtpKyspdGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZVNob3J0PWZ1bmN0aW9uKHBWYWx1ZSl7dGhpcy5vdXQud3JpdGVCeXRlKHBWYWx1ZSYyNTUpO3RoaXMub3V0LndyaXRlQnl0ZShwVmFsdWU+PjgmMjU1KX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVQaXhlbHM9ZnVuY3Rpb24oKXt2YXIgZW5jPW5ldyBMWldFbmNvZGVyKHRoaXMud2lkdGgsdGhpcy5oZWlnaHQsdGhpcy5pbmRleGVkUGl4ZWxzLHRoaXMuY29sb3JEZXB0aCk7ZW5jLmVuY29kZSh0aGlzLm91dCl9O0dJRkVuY29kZXIucHJvdG90eXBlLnN0cmVhbT1mdW5jdGlvbigpe3JldHVybiB0aGlzLm91dH07bW9kdWxlLmV4cG9ydHM9R0lGRW5jb2Rlcn0se1wiLi9MWldFbmNvZGVyLmpzXCI6MyxcIi4vVHlwZWROZXVRdWFudC5qc1wiOjR9XSwzOltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgRU9GPS0xO3ZhciBCSVRTPTEyO3ZhciBIU0laRT01MDAzO3ZhciBtYXNrcz1bMCwxLDMsNywxNSwzMSw2MywxMjcsMjU1LDUxMSwxMDIzLDIwNDcsNDA5NSw4MTkxLDE2MzgzLDMyNzY3LDY1NTM1XTtmdW5jdGlvbiBMWldFbmNvZGVyKHdpZHRoLGhlaWdodCxwaXhlbHMsY29sb3JEZXB0aCl7dmFyIGluaXRDb2RlU2l6ZT1NYXRoLm1heCgyLGNvbG9yRGVwdGgpO3ZhciBhY2N1bT1uZXcgVWludDhBcnJheSgyNTYpO3ZhciBodGFiPW5ldyBJbnQzMkFycmF5KEhTSVpFKTt2YXIgY29kZXRhYj1uZXcgSW50MzJBcnJheShIU0laRSk7dmFyIGN1cl9hY2N1bSxjdXJfYml0cz0wO3ZhciBhX2NvdW50O3ZhciBmcmVlX2VudD0wO3ZhciBtYXhjb2RlO3ZhciBjbGVhcl9mbGc9ZmFsc2U7dmFyIGdfaW5pdF9iaXRzLENsZWFyQ29kZSxFT0ZDb2RlO2Z1bmN0aW9uIGNoYXJfb3V0KGMsb3V0cyl7YWNjdW1bYV9jb3VudCsrXT1jO2lmKGFfY291bnQ+PTI1NClmbHVzaF9jaGFyKG91dHMpfWZ1bmN0aW9uIGNsX2Jsb2NrKG91dHMpe2NsX2hhc2goSFNJWkUpO2ZyZWVfZW50PUNsZWFyQ29kZSsyO2NsZWFyX2ZsZz10cnVlO291dHB1dChDbGVhckNvZGUsb3V0cyl9ZnVuY3Rpb24gY2xfaGFzaChoc2l6ZSl7Zm9yKHZhciBpPTA7aTxoc2l6ZTsrK2kpaHRhYltpXT0tMX1mdW5jdGlvbiBjb21wcmVzcyhpbml0X2JpdHMsb3V0cyl7dmFyIGZjb2RlLGMsaSxlbnQsZGlzcCxoc2l6ZV9yZWcsaHNoaWZ0O2dfaW5pdF9iaXRzPWluaXRfYml0cztjbGVhcl9mbGc9ZmFsc2U7bl9iaXRzPWdfaW5pdF9iaXRzO21heGNvZGU9TUFYQ09ERShuX2JpdHMpO0NsZWFyQ29kZT0xPDxpbml0X2JpdHMtMTtFT0ZDb2RlPUNsZWFyQ29kZSsxO2ZyZWVfZW50PUNsZWFyQ29kZSsyO2FfY291bnQ9MDtlbnQ9bmV4dFBpeGVsKCk7aHNoaWZ0PTA7Zm9yKGZjb2RlPUhTSVpFO2Zjb2RlPDY1NTM2O2Zjb2RlKj0yKSsraHNoaWZ0O2hzaGlmdD04LWhzaGlmdDtoc2l6ZV9yZWc9SFNJWkU7Y2xfaGFzaChoc2l6ZV9yZWcpO291dHB1dChDbGVhckNvZGUsb3V0cyk7b3V0ZXJfbG9vcDp3aGlsZSgoYz1uZXh0UGl4ZWwoKSkhPUVPRil7ZmNvZGU9KGM8PEJJVFMpK2VudDtpPWM8PGhzaGlmdF5lbnQ7aWYoaHRhYltpXT09PWZjb2RlKXtlbnQ9Y29kZXRhYltpXTtjb250aW51ZX1lbHNlIGlmKGh0YWJbaV0+PTApe2Rpc3A9aHNpemVfcmVnLWk7aWYoaT09PTApZGlzcD0xO2Rve2lmKChpLT1kaXNwKTwwKWkrPWhzaXplX3JlZztpZihodGFiW2ldPT09ZmNvZGUpe2VudD1jb2RldGFiW2ldO2NvbnRpbnVlIG91dGVyX2xvb3B9fXdoaWxlKGh0YWJbaV0+PTApfW91dHB1dChlbnQsb3V0cyk7ZW50PWM7aWYoZnJlZV9lbnQ8MTw8QklUUyl7Y29kZXRhYltpXT1mcmVlX2VudCsrO2h0YWJbaV09ZmNvZGV9ZWxzZXtjbF9ibG9jayhvdXRzKX19b3V0cHV0KGVudCxvdXRzKTtvdXRwdXQoRU9GQ29kZSxvdXRzKX1mdW5jdGlvbiBlbmNvZGUob3V0cyl7b3V0cy53cml0ZUJ5dGUoaW5pdENvZGVTaXplKTtyZW1haW5pbmc9d2lkdGgqaGVpZ2h0O2N1clBpeGVsPTA7Y29tcHJlc3MoaW5pdENvZGVTaXplKzEsb3V0cyk7b3V0cy53cml0ZUJ5dGUoMCl9ZnVuY3Rpb24gZmx1c2hfY2hhcihvdXRzKXtpZihhX2NvdW50PjApe291dHMud3JpdGVCeXRlKGFfY291bnQpO291dHMud3JpdGVCeXRlcyhhY2N1bSwwLGFfY291bnQpO2FfY291bnQ9MH19ZnVuY3Rpb24gTUFYQ09ERShuX2JpdHMpe3JldHVybigxPDxuX2JpdHMpLTF9ZnVuY3Rpb24gbmV4dFBpeGVsKCl7aWYocmVtYWluaW5nPT09MClyZXR1cm4gRU9GOy0tcmVtYWluaW5nO3ZhciBwaXg9cGl4ZWxzW2N1clBpeGVsKytdO3JldHVybiBwaXgmMjU1fWZ1bmN0aW9uIG91dHB1dChjb2RlLG91dHMpe2N1cl9hY2N1bSY9bWFza3NbY3VyX2JpdHNdO2lmKGN1cl9iaXRzPjApY3VyX2FjY3VtfD1jb2RlPDxjdXJfYml0cztlbHNlIGN1cl9hY2N1bT1jb2RlO2N1cl9iaXRzKz1uX2JpdHM7d2hpbGUoY3VyX2JpdHM+PTgpe2NoYXJfb3V0KGN1cl9hY2N1bSYyNTUsb3V0cyk7Y3VyX2FjY3VtPj49ODtjdXJfYml0cy09OH1pZihmcmVlX2VudD5tYXhjb2RlfHxjbGVhcl9mbGcpe2lmKGNsZWFyX2ZsZyl7bWF4Y29kZT1NQVhDT0RFKG5fYml0cz1nX2luaXRfYml0cyk7Y2xlYXJfZmxnPWZhbHNlfWVsc2V7KytuX2JpdHM7aWYobl9iaXRzPT1CSVRTKW1heGNvZGU9MTw8QklUUztlbHNlIG1heGNvZGU9TUFYQ09ERShuX2JpdHMpfX1pZihjb2RlPT1FT0ZDb2RlKXt3aGlsZShjdXJfYml0cz4wKXtjaGFyX291dChjdXJfYWNjdW0mMjU1LG91dHMpO2N1cl9hY2N1bT4+PTg7Y3VyX2JpdHMtPTh9Zmx1c2hfY2hhcihvdXRzKX19dGhpcy5lbmNvZGU9ZW5jb2RlfW1vZHVsZS5leHBvcnRzPUxaV0VuY29kZXJ9LHt9XSw0OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgbmN5Y2xlcz0xMDA7dmFyIG5ldHNpemU9MjU2O3ZhciBtYXhuZXRwb3M9bmV0c2l6ZS0xO3ZhciBuZXRiaWFzc2hpZnQ9NDt2YXIgaW50Ymlhc3NoaWZ0PTE2O3ZhciBpbnRiaWFzPTE8PGludGJpYXNzaGlmdDt2YXIgZ2FtbWFzaGlmdD0xMDt2YXIgZ2FtbWE9MTw8Z2FtbWFzaGlmdDt2YXIgYmV0YXNoaWZ0PTEwO3ZhciBiZXRhPWludGJpYXM+PmJldGFzaGlmdDt2YXIgYmV0YWdhbW1hPWludGJpYXM8PGdhbW1hc2hpZnQtYmV0YXNoaWZ0O3ZhciBpbml0cmFkPW5ldHNpemU+PjM7dmFyIHJhZGl1c2JpYXNzaGlmdD02O3ZhciByYWRpdXNiaWFzPTE8PHJhZGl1c2JpYXNzaGlmdDt2YXIgaW5pdHJhZGl1cz1pbml0cmFkKnJhZGl1c2JpYXM7dmFyIHJhZGl1c2RlYz0zMDt2YXIgYWxwaGFiaWFzc2hpZnQ9MTA7dmFyIGluaXRhbHBoYT0xPDxhbHBoYWJpYXNzaGlmdDt2YXIgYWxwaGFkZWM7dmFyIHJhZGJpYXNzaGlmdD04O3ZhciByYWRiaWFzPTE8PHJhZGJpYXNzaGlmdDt2YXIgYWxwaGFyYWRic2hpZnQ9YWxwaGFiaWFzc2hpZnQrcmFkYmlhc3NoaWZ0O3ZhciBhbHBoYXJhZGJpYXM9MTw8YWxwaGFyYWRic2hpZnQ7dmFyIHByaW1lMT00OTk7dmFyIHByaW1lMj00OTE7dmFyIHByaW1lMz00ODc7dmFyIHByaW1lND01MDM7dmFyIG1pbnBpY3R1cmVieXRlcz0zKnByaW1lNDtmdW5jdGlvbiBOZXVRdWFudChwaXhlbHMsc2FtcGxlZmFjKXt2YXIgbmV0d29yazt2YXIgbmV0aW5kZXg7dmFyIGJpYXM7dmFyIGZyZXE7dmFyIHJhZHBvd2VyO2Z1bmN0aW9uIGluaXQoKXtuZXR3b3JrPVtdO25ldGluZGV4PW5ldyBJbnQzMkFycmF5KDI1Nik7Ymlhcz1uZXcgSW50MzJBcnJheShuZXRzaXplKTtmcmVxPW5ldyBJbnQzMkFycmF5KG5ldHNpemUpO3JhZHBvd2VyPW5ldyBJbnQzMkFycmF5KG5ldHNpemU+PjMpO3ZhciBpLHY7Zm9yKGk9MDtpPG5ldHNpemU7aSsrKXt2PShpPDxuZXRiaWFzc2hpZnQrOCkvbmV0c2l6ZTtuZXR3b3JrW2ldPW5ldyBGbG9hdDY0QXJyYXkoW3Ysdix2LDBdKTtmcmVxW2ldPWludGJpYXMvbmV0c2l6ZTtiaWFzW2ldPTB9fWZ1bmN0aW9uIHVuYmlhc25ldCgpe2Zvcih2YXIgaT0wO2k8bmV0c2l6ZTtpKyspe25ldHdvcmtbaV1bMF0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVsxXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzJdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bM109aX19ZnVuY3Rpb24gYWx0ZXJzaW5nbGUoYWxwaGEsaSxiLGcscil7bmV0d29ya1tpXVswXS09YWxwaGEqKG5ldHdvcmtbaV1bMF0tYikvaW5pdGFscGhhO25ldHdvcmtbaV1bMV0tPWFscGhhKihuZXR3b3JrW2ldWzFdLWcpL2luaXRhbHBoYTtuZXR3b3JrW2ldWzJdLT1hbHBoYSoobmV0d29ya1tpXVsyXS1yKS9pbml0YWxwaGF9ZnVuY3Rpb24gYWx0ZXJuZWlnaChyYWRpdXMsaSxiLGcscil7dmFyIGxvPU1hdGguYWJzKGktcmFkaXVzKTt2YXIgaGk9TWF0aC5taW4oaStyYWRpdXMsbmV0c2l6ZSk7dmFyIGo9aSsxO3ZhciBrPWktMTt2YXIgbT0xO3ZhciBwLGE7d2hpbGUoajxoaXx8az5sbyl7YT1yYWRwb3dlclttKytdO2lmKGo8aGkpe3A9bmV0d29ya1tqKytdO3BbMF0tPWEqKHBbMF0tYikvYWxwaGFyYWRiaWFzO3BbMV0tPWEqKHBbMV0tZykvYWxwaGFyYWRiaWFzO3BbMl0tPWEqKHBbMl0tcikvYWxwaGFyYWRiaWFzfWlmKGs+bG8pe3A9bmV0d29ya1trLS1dO3BbMF0tPWEqKHBbMF0tYikvYWxwaGFyYWRiaWFzO3BbMV0tPWEqKHBbMV0tZykvYWxwaGFyYWRiaWFzO3BbMl0tPWEqKHBbMl0tcikvYWxwaGFyYWRiaWFzfX19ZnVuY3Rpb24gY29udGVzdChiLGcscil7dmFyIGJlc3RkPX4oMTw8MzEpO3ZhciBiZXN0Ymlhc2Q9YmVzdGQ7dmFyIGJlc3Rwb3M9LTE7dmFyIGJlc3RiaWFzcG9zPWJlc3Rwb3M7dmFyIGksbixkaXN0LGJpYXNkaXN0LGJldGFmcmVxO2ZvcihpPTA7aTxuZXRzaXplO2krKyl7bj1uZXR3b3JrW2ldO2Rpc3Q9TWF0aC5hYnMoblswXS1iKStNYXRoLmFicyhuWzFdLWcpK01hdGguYWJzKG5bMl0tcik7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0cG9zPWl9Ymlhc2Rpc3Q9ZGlzdC0oYmlhc1tpXT4+aW50Ymlhc3NoaWZ0LW5ldGJpYXNzaGlmdCk7aWYoYmlhc2Rpc3Q8YmVzdGJpYXNkKXtiZXN0Ymlhc2Q9Ymlhc2Rpc3Q7YmVzdGJpYXNwb3M9aX1iZXRhZnJlcT1mcmVxW2ldPj5iZXRhc2hpZnQ7ZnJlcVtpXS09YmV0YWZyZXE7Ymlhc1tpXSs9YmV0YWZyZXE8PGdhbW1hc2hpZnR9ZnJlcVtiZXN0cG9zXSs9YmV0YTtiaWFzW2Jlc3Rwb3NdLT1iZXRhZ2FtbWE7cmV0dXJuIGJlc3RiaWFzcG9zfWZ1bmN0aW9uIGlueGJ1aWxkKCl7dmFyIGksaixwLHEsc21hbGxwb3Msc21hbGx2YWwscHJldmlvdXNjb2w9MCxzdGFydHBvcz0wO2ZvcihpPTA7aTxuZXRzaXplO2krKyl7cD1uZXR3b3JrW2ldO3NtYWxscG9zPWk7c21hbGx2YWw9cFsxXTtmb3Ioaj1pKzE7ajxuZXRzaXplO2orKyl7cT1uZXR3b3JrW2pdO2lmKHFbMV08c21hbGx2YWwpe3NtYWxscG9zPWo7c21hbGx2YWw9cVsxXX19cT1uZXR3b3JrW3NtYWxscG9zXTtpZihpIT1zbWFsbHBvcyl7aj1xWzBdO3FbMF09cFswXTtwWzBdPWo7aj1xWzFdO3FbMV09cFsxXTtwWzFdPWo7aj1xWzJdO3FbMl09cFsyXTtwWzJdPWo7aj1xWzNdO3FbM109cFszXTtwWzNdPWp9aWYoc21hbGx2YWwhPXByZXZpb3VzY29sKXtuZXRpbmRleFtwcmV2aW91c2NvbF09c3RhcnRwb3MraT4+MTtmb3Ioaj1wcmV2aW91c2NvbCsxO2o8c21hbGx2YWw7aisrKW5ldGluZGV4W2pdPWk7cHJldmlvdXNjb2w9c21hbGx2YWw7c3RhcnRwb3M9aX19bmV0aW5kZXhbcHJldmlvdXNjb2xdPXN0YXJ0cG9zK21heG5ldHBvcz4+MTtmb3Ioaj1wcmV2aW91c2NvbCsxO2o8MjU2O2orKyluZXRpbmRleFtqXT1tYXhuZXRwb3N9ZnVuY3Rpb24gaW54c2VhcmNoKGIsZyxyKXt2YXIgYSxwLGRpc3Q7dmFyIGJlc3RkPTFlMzt2YXIgYmVzdD0tMTt2YXIgaT1uZXRpbmRleFtnXTt2YXIgaj1pLTE7d2hpbGUoaTxuZXRzaXplfHxqPj0wKXtpZihpPG5ldHNpemUpe3A9bmV0d29ya1tpXTtkaXN0PXBbMV0tZztpZihkaXN0Pj1iZXN0ZClpPW5ldHNpemU7ZWxzZXtpKys7aWYoZGlzdDwwKWRpc3Q9LWRpc3Q7YT1wWzBdLWI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXthPXBbMl0tcjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdD1wWzNdfX19fWlmKGo+PTApe3A9bmV0d29ya1tqXTtkaXN0PWctcFsxXTtpZihkaXN0Pj1iZXN0ZClqPS0xO2Vsc2V7ai0tO2lmKGRpc3Q8MClkaXN0PS1kaXN0O2E9cFswXS1iO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YT1wWzJdLXI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Q9cFszXX19fX19cmV0dXJuIGJlc3R9ZnVuY3Rpb24gbGVhcm4oKXt2YXIgaTt2YXIgbGVuZ3RoY291bnQ9cGl4ZWxzLmxlbmd0aDt2YXIgYWxwaGFkZWM9MzArKHNhbXBsZWZhYy0xKS8zO3ZhciBzYW1wbGVwaXhlbHM9bGVuZ3RoY291bnQvKDMqc2FtcGxlZmFjKTt2YXIgZGVsdGE9fn4oc2FtcGxlcGl4ZWxzL25jeWNsZXMpO3ZhciBhbHBoYT1pbml0YWxwaGE7dmFyIHJhZGl1cz1pbml0cmFkaXVzO3ZhciByYWQ9cmFkaXVzPj5yYWRpdXNiaWFzc2hpZnQ7aWYocmFkPD0xKXJhZD0wO2ZvcihpPTA7aTxyYWQ7aSsrKXJhZHBvd2VyW2ldPWFscGhhKigocmFkKnJhZC1pKmkpKnJhZGJpYXMvKHJhZCpyYWQpKTt2YXIgc3RlcDtpZihsZW5ndGhjb3VudDxtaW5waWN0dXJlYnl0ZXMpe3NhbXBsZWZhYz0xO3N0ZXA9M31lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMSE9PTApe3N0ZXA9MypwcmltZTF9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTIhPT0wKXtzdGVwPTMqcHJpbWUyfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUzIT09MCl7c3RlcD0zKnByaW1lM31lbHNle3N0ZXA9MypwcmltZTR9dmFyIGIsZyxyLGo7dmFyIHBpeD0wO2k9MDt3aGlsZShpPHNhbXBsZXBpeGVscyl7Yj0ocGl4ZWxzW3BpeF0mMjU1KTw8bmV0Ymlhc3NoaWZ0O2c9KHBpeGVsc1twaXgrMV0mMjU1KTw8bmV0Ymlhc3NoaWZ0O3I9KHBpeGVsc1twaXgrMl0mMjU1KTw8bmV0Ymlhc3NoaWZ0O2o9Y29udGVzdChiLGcscik7YWx0ZXJzaW5nbGUoYWxwaGEsaixiLGcscik7aWYocmFkIT09MClhbHRlcm5laWdoKHJhZCxqLGIsZyxyKTtwaXgrPXN0ZXA7aWYocGl4Pj1sZW5ndGhjb3VudClwaXgtPWxlbmd0aGNvdW50O2krKztpZihkZWx0YT09PTApZGVsdGE9MTtpZihpJWRlbHRhPT09MCl7YWxwaGEtPWFscGhhL2FscGhhZGVjO3JhZGl1cy09cmFkaXVzL3JhZGl1c2RlYztyYWQ9cmFkaXVzPj5yYWRpdXNiaWFzc2hpZnQ7aWYocmFkPD0xKXJhZD0wO2ZvcihqPTA7ajxyYWQ7aisrKXJhZHBvd2VyW2pdPWFscGhhKigocmFkKnJhZC1qKmopKnJhZGJpYXMvKHJhZCpyYWQpKX19fWZ1bmN0aW9uIGJ1aWxkQ29sb3JtYXAoKXtpbml0KCk7bGVhcm4oKTt1bmJpYXNuZXQoKTtpbnhidWlsZCgpfXRoaXMuYnVpbGRDb2xvcm1hcD1idWlsZENvbG9ybWFwO2Z1bmN0aW9uIGdldENvbG9ybWFwKCl7dmFyIG1hcD1bXTt2YXIgaW5kZXg9W107Zm9yKHZhciBpPTA7aTxuZXRzaXplO2krKylpbmRleFtuZXR3b3JrW2ldWzNdXT1pO3ZhciBrPTA7Zm9yKHZhciBsPTA7bDxuZXRzaXplO2wrKyl7dmFyIGo9aW5kZXhbbF07bWFwW2srK109bmV0d29ya1tqXVswXTttYXBbaysrXT1uZXR3b3JrW2pdWzFdO21hcFtrKytdPW5ldHdvcmtbal1bMl19cmV0dXJuIG1hcH10aGlzLmdldENvbG9ybWFwPWdldENvbG9ybWFwO3RoaXMubG9va3VwUkdCPWlueHNlYXJjaH1tb2R1bGUuZXhwb3J0cz1OZXVRdWFudH0se31dLDU6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBVQSxicm93c2VyLG1vZGUscGxhdGZvcm0sdWE7dWE9bmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpO3BsYXRmb3JtPW5hdmlnYXRvci5wbGF0Zm9ybS50b0xvd2VyQ2FzZSgpO1VBPXVhLm1hdGNoKC8ob3BlcmF8aWV8ZmlyZWZveHxjaHJvbWV8dmVyc2lvbilbXFxzXFwvOl0oW1xcd1xcZFxcLl0rKT8uKj8oc2FmYXJpfHZlcnNpb25bXFxzXFwvOl0oW1xcd1xcZFxcLl0rKXwkKS8pfHxbbnVsbCxcInVua25vd25cIiwwXTttb2RlPVVBWzFdPT09XCJpZVwiJiZkb2N1bWVudC5kb2N1bWVudE1vZGU7YnJvd3Nlcj17bmFtZTpVQVsxXT09PVwidmVyc2lvblwiP1VBWzNdOlVBWzFdLHZlcnNpb246bW9kZXx8cGFyc2VGbG9hdChVQVsxXT09PVwib3BlcmFcIiYmVUFbNF0/VUFbNF06VUFbMl0pLHBsYXRmb3JtOntuYW1lOnVhLm1hdGNoKC9pcCg/OmFkfG9kfGhvbmUpLyk/XCJpb3NcIjoodWEubWF0Y2goLyg/OndlYm9zfGFuZHJvaWQpLyl8fHBsYXRmb3JtLm1hdGNoKC9tYWN8d2lufGxpbnV4Lyl8fFtcIm90aGVyXCJdKVswXX19O2Jyb3dzZXJbYnJvd3Nlci5uYW1lXT10cnVlO2Jyb3dzZXJbYnJvd3Nlci5uYW1lK3BhcnNlSW50KGJyb3dzZXIudmVyc2lvbiwxMCldPXRydWU7YnJvd3Nlci5wbGF0Zm9ybVticm93c2VyLnBsYXRmb3JtLm5hbWVdPXRydWU7bW9kdWxlLmV4cG9ydHM9YnJvd3Nlcn0se31dLDY6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBFdmVudEVtaXR0ZXIsR0lGLEdJRkVuY29kZXIsYnJvd3NlcixnaWZXb3JrZXIsZXh0ZW5kPWZ1bmN0aW9uKGNoaWxkLHBhcmVudCl7Zm9yKHZhciBrZXkgaW4gcGFyZW50KXtpZihoYXNQcm9wLmNhbGwocGFyZW50LGtleSkpY2hpbGRba2V5XT1wYXJlbnRba2V5XX1mdW5jdGlvbiBjdG9yKCl7dGhpcy5jb25zdHJ1Y3Rvcj1jaGlsZH1jdG9yLnByb3RvdHlwZT1wYXJlbnQucHJvdG90eXBlO2NoaWxkLnByb3RvdHlwZT1uZXcgY3RvcjtjaGlsZC5fX3N1cGVyX189cGFyZW50LnByb3RvdHlwZTtyZXR1cm4gY2hpbGR9LGhhc1Byb3A9e30uaGFzT3duUHJvcGVydHksaW5kZXhPZj1bXS5pbmRleE9mfHxmdW5jdGlvbihpdGVtKXtmb3IodmFyIGk9MCxsPXRoaXMubGVuZ3RoO2k8bDtpKyspe2lmKGkgaW4gdGhpcyYmdGhpc1tpXT09PWl0ZW0pcmV0dXJuIGl9cmV0dXJuLTF9LHNsaWNlPVtdLnNsaWNlO0V2ZW50RW1pdHRlcj1yZXF1aXJlKFwiZXZlbnRzXCIpLkV2ZW50RW1pdHRlcjticm93c2VyPXJlcXVpcmUoXCIuL2Jyb3dzZXIuY29mZmVlXCIpO0dJRkVuY29kZXI9cmVxdWlyZShcIi4vR0lGRW5jb2Rlci5qc1wiKTtnaWZXb3JrZXI9cmVxdWlyZShcIi4vZ2lmLndvcmtlci5jb2ZmZWVcIik7bW9kdWxlLmV4cG9ydHM9R0lGPWZ1bmN0aW9uKHN1cGVyQ2xhc3Mpe3ZhciBkZWZhdWx0cyxmcmFtZURlZmF1bHRzO2V4dGVuZChHSUYsc3VwZXJDbGFzcyk7ZGVmYXVsdHM9e3dvcmtlclNjcmlwdDpcImdpZi53b3JrZXIuanNcIix3b3JrZXJzOjIscmVwZWF0OjAsYmFja2dyb3VuZDpcIiNmZmZcIixxdWFsaXR5OjEwLHdpZHRoOm51bGwsaGVpZ2h0Om51bGwsdHJhbnNwYXJlbnQ6bnVsbCxkZWJ1ZzpmYWxzZSxkaXRoZXI6ZmFsc2V9O2ZyYW1lRGVmYXVsdHM9e2RlbGF5OjUwMCxjb3B5OmZhbHNlLGRpc3Bvc2U6LTF9O2Z1bmN0aW9uIEdJRihvcHRpb25zKXt2YXIgYmFzZSxrZXksdmFsdWU7dGhpcy5ydW5uaW5nPWZhbHNlO3RoaXMub3B0aW9ucz17fTt0aGlzLmZyYW1lcz1bXTt0aGlzLmZyZWVXb3JrZXJzPVtdO3RoaXMuYWN0aXZlV29ya2Vycz1bXTt0aGlzLnNldE9wdGlvbnMob3B0aW9ucyk7Zm9yKGtleSBpbiBkZWZhdWx0cyl7dmFsdWU9ZGVmYXVsdHNba2V5XTtpZigoYmFzZT10aGlzLm9wdGlvbnMpW2tleV09PW51bGwpe2Jhc2Vba2V5XT12YWx1ZX19fUdJRi5wcm90b3R5cGUuc2V0T3B0aW9uPWZ1bmN0aW9uKGtleSx2YWx1ZSl7dGhpcy5vcHRpb25zW2tleV09dmFsdWU7aWYodGhpcy5fY2FudmFzIT1udWxsJiYoa2V5PT09XCJ3aWR0aFwifHxrZXk9PT1cImhlaWdodFwiKSl7cmV0dXJuIHRoaXMuX2NhbnZhc1trZXldPXZhbHVlfX07R0lGLnByb3RvdHlwZS5zZXRPcHRpb25zPWZ1bmN0aW9uKG9wdGlvbnMpe3ZhciBrZXkscmVzdWx0cyx2YWx1ZTtyZXN1bHRzPVtdO2ZvcihrZXkgaW4gb3B0aW9ucyl7aWYoIWhhc1Byb3AuY2FsbChvcHRpb25zLGtleSkpY29udGludWU7dmFsdWU9b3B0aW9uc1trZXldO3Jlc3VsdHMucHVzaCh0aGlzLnNldE9wdGlvbihrZXksdmFsdWUpKX1yZXR1cm4gcmVzdWx0c307R0lGLnByb3RvdHlwZS5hZGRGcmFtZT1mdW5jdGlvbihpbWFnZSxvcHRpb25zKXt2YXIgZnJhbWUsa2V5O2lmKG9wdGlvbnM9PW51bGwpe29wdGlvbnM9e319ZnJhbWU9e307ZnJhbWUudHJhbnNwYXJlbnQ9dGhpcy5vcHRpb25zLnRyYW5zcGFyZW50O2ZvcihrZXkgaW4gZnJhbWVEZWZhdWx0cyl7ZnJhbWVba2V5XT1vcHRpb25zW2tleV18fGZyYW1lRGVmYXVsdHNba2V5XX1pZih0aGlzLm9wdGlvbnMud2lkdGg9PW51bGwpe3RoaXMuc2V0T3B0aW9uKFwid2lkdGhcIixpbWFnZS53aWR0aCl9aWYodGhpcy5vcHRpb25zLmhlaWdodD09bnVsbCl7dGhpcy5zZXRPcHRpb24oXCJoZWlnaHRcIixpbWFnZS5oZWlnaHQpfWlmKHR5cGVvZiBJbWFnZURhdGEhPT1cInVuZGVmaW5lZFwiJiZJbWFnZURhdGEhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIEltYWdlRGF0YSl7ZnJhbWUuZGF0YT1pbWFnZS5kYXRhfWVsc2UgaWYodHlwZW9mIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCE9PVwidW5kZWZpbmVkXCImJkNhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEfHx0eXBlb2YgV2ViR0xSZW5kZXJpbmdDb250ZXh0IT09XCJ1bmRlZmluZWRcIiYmV2ViR0xSZW5kZXJpbmdDb250ZXh0IT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBXZWJHTFJlbmRlcmluZ0NvbnRleHQpe2lmKG9wdGlvbnMuY29weSl7ZnJhbWUuZGF0YT10aGlzLmdldENvbnRleHREYXRhKGltYWdlKX1lbHNle2ZyYW1lLmNvbnRleHQ9aW1hZ2V9fWVsc2UgaWYoaW1hZ2UuY2hpbGROb2RlcyE9bnVsbCl7aWYob3B0aW9ucy5jb3B5KXtmcmFtZS5kYXRhPXRoaXMuZ2V0SW1hZ2VEYXRhKGltYWdlKX1lbHNle2ZyYW1lLmltYWdlPWltYWdlfX1lbHNle3Rocm93IG5ldyBFcnJvcihcIkludmFsaWQgaW1hZ2VcIil9cmV0dXJuIHRoaXMuZnJhbWVzLnB1c2goZnJhbWUpfTtHSUYucHJvdG90eXBlLnJlbmRlcj1mdW5jdGlvbigpe3ZhciBpLGosbnVtV29ya2VycyxyZWY7aWYodGhpcy5ydW5uaW5nKXt0aHJvdyBuZXcgRXJyb3IoXCJBbHJlYWR5IHJ1bm5pbmdcIil9aWYodGhpcy5vcHRpb25zLndpZHRoPT1udWxsfHx0aGlzLm9wdGlvbnMuaGVpZ2h0PT1udWxsKXt0aHJvdyBuZXcgRXJyb3IoXCJXaWR0aCBhbmQgaGVpZ2h0IG11c3QgYmUgc2V0IHByaW9yIHRvIHJlbmRlcmluZ1wiKX10aGlzLnJ1bm5pbmc9dHJ1ZTt0aGlzLm5leHRGcmFtZT0wO3RoaXMuZmluaXNoZWRGcmFtZXM9MDt0aGlzLmltYWdlUGFydHM9ZnVuY3Rpb24oKXt2YXIgaixyZWYscmVzdWx0cztyZXN1bHRzPVtdO2ZvcihpPWo9MCxyZWY9dGhpcy5mcmFtZXMubGVuZ3RoOzA8PXJlZj9qPHJlZjpqPnJlZjtpPTA8PXJlZj8rK2o6LS1qKXtyZXN1bHRzLnB1c2gobnVsbCl9cmV0dXJuIHJlc3VsdHN9LmNhbGwodGhpcyk7bnVtV29ya2Vycz10aGlzLnNwYXduV29ya2VycygpO2lmKHRoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPT09dHJ1ZSl7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX1lbHNle2ZvcihpPWo9MCxyZWY9bnVtV29ya2VyczswPD1yZWY/ajxyZWY6aj5yZWY7aT0wPD1yZWY/KytqOi0tail7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX19dGhpcy5lbWl0KFwic3RhcnRcIik7cmV0dXJuIHRoaXMuZW1pdChcInByb2dyZXNzXCIsMCl9O0dJRi5wcm90b3R5cGUuYWJvcnQ9ZnVuY3Rpb24oKXt2YXIgd29ya2VyO3doaWxlKHRydWUpe3dvcmtlcj10aGlzLmFjdGl2ZVdvcmtlcnMuc2hpZnQoKTtpZih3b3JrZXI9PW51bGwpe2JyZWFrfXRoaXMubG9nKFwia2lsbGluZyBhY3RpdmUgd29ya2VyXCIpO3dvcmtlci50ZXJtaW5hdGUoKX10aGlzLnJ1bm5pbmc9ZmFsc2U7cmV0dXJuIHRoaXMuZW1pdChcImFib3J0XCIpfTtHSUYucHJvdG90eXBlLnNwYXduV29ya2Vycz1mdW5jdGlvbigpe3ZhciBqLG51bVdvcmtlcnMscmVmLHJlc3VsdHM7bnVtV29ya2Vycz1NYXRoLm1pbih0aGlzLm9wdGlvbnMud29ya2Vycyx0aGlzLmZyYW1lcy5sZW5ndGgpOyhmdW5jdGlvbigpe3Jlc3VsdHM9W107Zm9yKHZhciBqPXJlZj10aGlzLmZyZWVXb3JrZXJzLmxlbmd0aDtyZWY8PW51bVdvcmtlcnM/ajxudW1Xb3JrZXJzOmo+bnVtV29ya2VycztyZWY8PW51bVdvcmtlcnM/aisrOmotLSl7cmVzdWx0cy5wdXNoKGopfXJldHVybiByZXN1bHRzfSkuYXBwbHkodGhpcykuZm9yRWFjaChmdW5jdGlvbihfdGhpcyl7cmV0dXJuIGZ1bmN0aW9uKGkpe3ZhciB3b3JrZXI7X3RoaXMubG9nKFwic3Bhd25pbmcgd29ya2VyIFwiK2kpO3dvcmtlcj1uZXcgV29ya2VyKF90aGlzLm9wdGlvbnMud29ya2VyU2NyaXB0KTt3b3JrZXIub25tZXNzYWdlPWZ1bmN0aW9uKGV2ZW50KXtfdGhpcy5hY3RpdmVXb3JrZXJzLnNwbGljZShfdGhpcy5hY3RpdmVXb3JrZXJzLmluZGV4T2Yod29ya2VyKSwxKTtfdGhpcy5mcmVlV29ya2Vycy5wdXNoKHdvcmtlcik7cmV0dXJuIF90aGlzLmZyYW1lRmluaXNoZWQoZXZlbnQuZGF0YSl9O3JldHVybiBfdGhpcy5mcmVlV29ya2Vycy5wdXNoKHdvcmtlcil9fSh0aGlzKSk7cmV0dXJuIG51bVdvcmtlcnN9O0dJRi5wcm90b3R5cGUuZnJhbWVGaW5pc2hlZD1mdW5jdGlvbihmcmFtZSl7dmFyIGksaixyZWY7dGhpcy5sb2coXCJmcmFtZSBcIitmcmFtZS5pbmRleCtcIiBmaW5pc2hlZCAtIFwiK3RoaXMuYWN0aXZlV29ya2Vycy5sZW5ndGgrXCIgYWN0aXZlXCIpO3RoaXMuZmluaXNoZWRGcmFtZXMrKzt0aGlzLmVtaXQoXCJwcm9ncmVzc1wiLHRoaXMuZmluaXNoZWRGcmFtZXMvdGhpcy5mcmFtZXMubGVuZ3RoKTt0aGlzLmltYWdlUGFydHNbZnJhbWUuaW5kZXhdPWZyYW1lO2lmKHRoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPT09dHJ1ZSl7dGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGU9ZnJhbWUuZ2xvYmFsUGFsZXR0ZTt0aGlzLmxvZyhcImdsb2JhbCBwYWxldHRlIGFuYWx5emVkXCIpO2lmKHRoaXMuZnJhbWVzLmxlbmd0aD4yKXtmb3IoaT1qPTEscmVmPXRoaXMuZnJlZVdvcmtlcnMubGVuZ3RoOzE8PXJlZj9qPHJlZjpqPnJlZjtpPTE8PXJlZj8rK2o6LS1qKXt0aGlzLnJlbmRlck5leHRGcmFtZSgpfX19aWYoaW5kZXhPZi5jYWxsKHRoaXMuaW1hZ2VQYXJ0cyxudWxsKT49MCl7cmV0dXJuIHRoaXMucmVuZGVyTmV4dEZyYW1lKCl9ZWxzZXtyZXR1cm4gdGhpcy5maW5pc2hSZW5kZXJpbmcoKX19O0dJRi5wcm90b3R5cGUuZmluaXNoUmVuZGVyaW5nPWZ1bmN0aW9uKCl7dmFyIGRhdGEsZnJhbWUsaSxpbWFnZSxqLGssbCxsZW4sbGVuMSxsZW4yLGxlbjMsb2Zmc2V0LHBhZ2UscmVmLHJlZjEscmVmMjtsZW49MDtyZWY9dGhpcy5pbWFnZVBhcnRzO2ZvcihqPTAsbGVuMT1yZWYubGVuZ3RoO2o8bGVuMTtqKyspe2ZyYW1lPXJlZltqXTtsZW4rPShmcmFtZS5kYXRhLmxlbmd0aC0xKSpmcmFtZS5wYWdlU2l6ZStmcmFtZS5jdXJzb3J9bGVuKz1mcmFtZS5wYWdlU2l6ZS1mcmFtZS5jdXJzb3I7dGhpcy5sb2coXCJyZW5kZXJpbmcgZmluaXNoZWQgLSBmaWxlc2l6ZSBcIitNYXRoLnJvdW5kKGxlbi8xZTMpK1wia2JcIik7ZGF0YT1uZXcgVWludDhBcnJheShsZW4pO29mZnNldD0wO3JlZjE9dGhpcy5pbWFnZVBhcnRzO2ZvcihrPTAsbGVuMj1yZWYxLmxlbmd0aDtrPGxlbjI7aysrKXtmcmFtZT1yZWYxW2tdO3JlZjI9ZnJhbWUuZGF0YTtmb3IoaT1sPTAsbGVuMz1yZWYyLmxlbmd0aDtsPGxlbjM7aT0rK2wpe3BhZ2U9cmVmMltpXTtkYXRhLnNldChwYWdlLG9mZnNldCk7aWYoaT09PWZyYW1lLmRhdGEubGVuZ3RoLTEpe29mZnNldCs9ZnJhbWUuY3Vyc29yfWVsc2V7b2Zmc2V0Kz1mcmFtZS5wYWdlU2l6ZX19fWltYWdlPW5ldyBCbG9iKFtkYXRhXSx7dHlwZTpcImltYWdlL2dpZlwifSk7cmV0dXJuIHRoaXMuZW1pdChcImZpbmlzaGVkXCIsaW1hZ2UsZGF0YSl9O0dJRi5wcm90b3R5cGUucmVuZGVyTmV4dEZyYW1lPWZ1bmN0aW9uKCl7dmFyIGZyYW1lLHRhc2ssd29ya2VyO2lmKHRoaXMuZnJlZVdvcmtlcnMubGVuZ3RoPT09MCl7dGhyb3cgbmV3IEVycm9yKFwiTm8gZnJlZSB3b3JrZXJzXCIpfWlmKHRoaXMubmV4dEZyYW1lPj10aGlzLmZyYW1lcy5sZW5ndGgpe3JldHVybn1mcmFtZT10aGlzLmZyYW1lc1t0aGlzLm5leHRGcmFtZSsrXTt3b3JrZXI9dGhpcy5mcmVlV29ya2Vycy5zaGlmdCgpO3Rhc2s9dGhpcy5nZXRUYXNrKGZyYW1lKTt0aGlzLmxvZyhcInN0YXJ0aW5nIGZyYW1lIFwiKyh0YXNrLmluZGV4KzEpK1wiIG9mIFwiK3RoaXMuZnJhbWVzLmxlbmd0aCk7dGhpcy5hY3RpdmVXb3JrZXJzLnB1c2god29ya2VyKTtyZXR1cm4gd29ya2VyLnBvc3RNZXNzYWdlKHRhc2spfTtHSUYucHJvdG90eXBlLmdldENvbnRleHREYXRhPWZ1bmN0aW9uKGN0eCl7cmV0dXJuIGN0eC5nZXRJbWFnZURhdGEoMCwwLHRoaXMub3B0aW9ucy53aWR0aCx0aGlzLm9wdGlvbnMuaGVpZ2h0KS5kYXRhfTtHSUYucHJvdG90eXBlLmdldEltYWdlRGF0YT1mdW5jdGlvbihpbWFnZSl7dmFyIGN0eDtpZih0aGlzLl9jYW52YXM9PW51bGwpe3RoaXMuX2NhbnZhcz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO3RoaXMuX2NhbnZhcy53aWR0aD10aGlzLm9wdGlvbnMud2lkdGg7dGhpcy5fY2FudmFzLmhlaWdodD10aGlzLm9wdGlvbnMuaGVpZ2h0fWN0eD10aGlzLl9jYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO2N0eC5zZXRGaWxsPXRoaXMub3B0aW9ucy5iYWNrZ3JvdW5kO2N0eC5maWxsUmVjdCgwLDAsdGhpcy5vcHRpb25zLndpZHRoLHRoaXMub3B0aW9ucy5oZWlnaHQpO2N0eC5kcmF3SW1hZ2UoaW1hZ2UsMCwwKTtyZXR1cm4gdGhpcy5nZXRDb250ZXh0RGF0YShjdHgpfTtHSUYucHJvdG90eXBlLmdldFRhc2s9ZnVuY3Rpb24oZnJhbWUpe3ZhciBpbmRleCx0YXNrO2luZGV4PXRoaXMuZnJhbWVzLmluZGV4T2YoZnJhbWUpO3Rhc2s9e2luZGV4OmluZGV4LGxhc3Q6aW5kZXg9PT10aGlzLmZyYW1lcy5sZW5ndGgtMSxkZWxheTpmcmFtZS5kZWxheSxkaXNwb3NlOmZyYW1lLmRpc3Bvc2UsdHJhbnNwYXJlbnQ6ZnJhbWUudHJhbnNwYXJlbnQsd2lkdGg6dGhpcy5vcHRpb25zLndpZHRoLGhlaWdodDp0aGlzLm9wdGlvbnMuaGVpZ2h0LHF1YWxpdHk6dGhpcy5vcHRpb25zLnF1YWxpdHksZGl0aGVyOnRoaXMub3B0aW9ucy5kaXRoZXIsZ2xvYmFsUGFsZXR0ZTp0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZSxyZXBlYXQ6dGhpcy5vcHRpb25zLnJlcGVhdCxjYW5UcmFuc2Zlcjpicm93c2VyLm5hbWU9PT1cImNocm9tZVwifTtpZihmcmFtZS5kYXRhIT1udWxsKXt0YXNrLmRhdGE9ZnJhbWUuZGF0YX1lbHNlIGlmKGZyYW1lLmNvbnRleHQhPW51bGwpe3Rhc2suZGF0YT10aGlzLmdldENvbnRleHREYXRhKGZyYW1lLmNvbnRleHQpfWVsc2UgaWYoZnJhbWUuaW1hZ2UhPW51bGwpe3Rhc2suZGF0YT10aGlzLmdldEltYWdlRGF0YShmcmFtZS5pbWFnZSl9ZWxzZXt0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGZyYW1lXCIpfXJldHVybiB0YXNrfTtHSUYucHJvdG90eXBlLmxvZz1mdW5jdGlvbigpe3ZhciBhcmdzO2FyZ3M9MTw9YXJndW1lbnRzLmxlbmd0aD9zbGljZS5jYWxsKGFyZ3VtZW50cywwKTpbXTtpZighdGhpcy5vcHRpb25zLmRlYnVnKXtyZXR1cm59cmV0dXJuIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsYXJncyl9O3JldHVybiBHSUZ9KEV2ZW50RW1pdHRlcil9LHtcIi4vR0lGRW5jb2Rlci5qc1wiOjIsXCIuL2Jyb3dzZXIuY29mZmVlXCI6NSxcIi4vZ2lmLndvcmtlci5jb2ZmZWVcIjo3LGV2ZW50czoxfV0sNzpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEdJRkVuY29kZXIscmVuZGVyRnJhbWU7R0lGRW5jb2Rlcj1yZXF1aXJlKFwiLi9HSUZFbmNvZGVyLmpzXCIpO3JlbmRlckZyYW1lPWZ1bmN0aW9uKGZyYW1lKXt2YXIgZW5jb2RlcixwYWdlLHN0cmVhbSx0cmFuc2ZlcjtlbmNvZGVyPW5ldyBHSUZFbmNvZGVyKGZyYW1lLndpZHRoLGZyYW1lLmhlaWdodCk7aWYoZnJhbWUuaW5kZXg9PT0wKXtlbmNvZGVyLndyaXRlSGVhZGVyKCl9ZWxzZXtlbmNvZGVyLmZpcnN0RnJhbWU9ZmFsc2V9ZW5jb2Rlci5zZXRUcmFuc3BhcmVudChmcmFtZS50cmFuc3BhcmVudCk7ZW5jb2Rlci5zZXREaXNwb3NlKGZyYW1lLmRpc3Bvc2UpO2VuY29kZXIuc2V0UmVwZWF0KGZyYW1lLnJlcGVhdCk7ZW5jb2Rlci5zZXREZWxheShmcmFtZS5kZWxheSk7ZW5jb2Rlci5zZXRRdWFsaXR5KGZyYW1lLnF1YWxpdHkpO2VuY29kZXIuc2V0RGl0aGVyKGZyYW1lLmRpdGhlcik7ZW5jb2Rlci5zZXRHbG9iYWxQYWxldHRlKGZyYW1lLmdsb2JhbFBhbGV0dGUpO2VuY29kZXIuYWRkRnJhbWUoZnJhbWUuZGF0YSk7aWYoZnJhbWUubGFzdCl7ZW5jb2Rlci5maW5pc2goKX1pZihmcmFtZS5nbG9iYWxQYWxldHRlPT09dHJ1ZSl7ZnJhbWUuZ2xvYmFsUGFsZXR0ZT1lbmNvZGVyLmdldEdsb2JhbFBhbGV0dGUoKX1zdHJlYW09ZW5jb2Rlci5zdHJlYW0oKTtmcmFtZS5kYXRhPXN0cmVhbS5wYWdlcztmcmFtZS5jdXJzb3I9c3RyZWFtLmN1cnNvcjtmcmFtZS5wYWdlU2l6ZT1zdHJlYW0uY29uc3RydWN0b3IucGFnZVNpemU7aWYoZnJhbWUuY2FuVHJhbnNmZXIpe3RyYW5zZmVyPWZ1bmN0aW9uKCl7dmFyIGksbGVuLHJlZixyZXN1bHRzO3JlZj1mcmFtZS5kYXRhO3Jlc3VsdHM9W107Zm9yKGk9MCxsZW49cmVmLmxlbmd0aDtpPGxlbjtpKyspe3BhZ2U9cmVmW2ldO3Jlc3VsdHMucHVzaChwYWdlLmJ1ZmZlcil9cmV0dXJuIHJlc3VsdHN9KCk7cmV0dXJuIHNlbGYucG9zdE1lc3NhZ2UoZnJhbWUsdHJhbnNmZXIpfWVsc2V7cmV0dXJuIHNlbGYucG9zdE1lc3NhZ2UoZnJhbWUpfX07c2VsZi5vbm1lc3NhZ2U9ZnVuY3Rpb24oZXZlbnQpe3JldHVybiByZW5kZXJGcmFtZShldmVudC5kYXRhKX19LHtcIi4vR0lGRW5jb2Rlci5qc1wiOjJ9XX0se30sWzZdKSg2KX0pO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1naWYuanMubWFwXHJcbiIsIjsoZnVuY3Rpb24oKSB7XHJcblxyXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xyXG4gIHZhciBUYXIgPSByZXF1aXJlKCcuL3Rhci5qcycpO1xyXG4gIHZhciBkb3dubG9hZCA9IHJlcXVpcmUoJy4vZG93bmxvYWQuanMnKTtcclxuICB2YXIgR0lGID0gcmVxdWlyZSgnLi9naWYuanMnKTtcclxufVxyXG5cclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgb2JqZWN0VHlwZXMgPSB7XHJcbidmdW5jdGlvbic6IHRydWUsXHJcbidvYmplY3QnOiB0cnVlXHJcbn07XHJcblxyXG5mdW5jdGlvbiBjaGVja0dsb2JhbCh2YWx1ZSkge1xyXG4gICAgcmV0dXJuICh2YWx1ZSAmJiB2YWx1ZS5PYmplY3QgPT09IE9iamVjdCkgPyB2YWx1ZSA6IG51bGw7XHJcbiAgfVxyXG5cclxuLyoqIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIHdpdGhvdXQgYSBkZXBlbmRlbmN5IG9uIGByb290YC4gKi9cclxudmFyIGZyZWVQYXJzZUZsb2F0ID0gcGFyc2VGbG9hdCxcclxuICBmcmVlUGFyc2VJbnQgPSBwYXJzZUludDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZXhwb3J0c2AuICovXHJcbnZhciBmcmVlRXhwb3J0cyA9IChvYmplY3RUeXBlc1t0eXBlb2YgZXhwb3J0c10gJiYgZXhwb3J0cyAmJiAhZXhwb3J0cy5ub2RlVHlwZSlcclxuPyBleHBvcnRzXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBtb2R1bGVgLiAqL1xyXG52YXIgZnJlZU1vZHVsZSA9IChvYmplY3RUeXBlc1t0eXBlb2YgbW9kdWxlXSAmJiBtb2R1bGUgJiYgIW1vZHVsZS5ub2RlVHlwZSlcclxuPyBtb2R1bGVcclxuOiB1bmRlZmluZWQ7XHJcblxyXG4vKiogRGV0ZWN0IHRoZSBwb3B1bGFyIENvbW1vbkpTIGV4dGVuc2lvbiBgbW9kdWxlLmV4cG9ydHNgLiAqL1xyXG52YXIgbW9kdWxlRXhwb3J0cyA9IChmcmVlTW9kdWxlICYmIGZyZWVNb2R1bGUuZXhwb3J0cyA9PT0gZnJlZUV4cG9ydHMpXHJcbj8gZnJlZUV4cG9ydHNcclxuOiB1bmRlZmluZWQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGdsb2JhbGAgZnJvbSBOb2RlLmpzLiAqL1xyXG52YXIgZnJlZUdsb2JhbCA9IGNoZWNrR2xvYmFsKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUgJiYgdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWwpO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBzZWxmYC4gKi9cclxudmFyIGZyZWVTZWxmID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHNlbGZdICYmIHNlbGYpO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGB3aW5kb3dgLiAqL1xyXG52YXIgZnJlZVdpbmRvdyA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB3aW5kb3ddICYmIHdpbmRvdyk7XHJcblxyXG4vKiogRGV0ZWN0IGB0aGlzYCBhcyB0aGUgZ2xvYmFsIG9iamVjdC4gKi9cclxudmFyIHRoaXNHbG9iYWwgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2YgdGhpc10gJiYgdGhpcyk7XHJcblxyXG4vKipcclxuKiBVc2VkIGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxyXG4qXHJcbiogVGhlIGB0aGlzYCB2YWx1ZSBpcyB1c2VkIGlmIGl0J3MgdGhlIGdsb2JhbCBvYmplY3QgdG8gYXZvaWQgR3JlYXNlbW9ua2V5J3NcclxuKiByZXN0cmljdGVkIGB3aW5kb3dgIG9iamVjdCwgb3RoZXJ3aXNlIHRoZSBgd2luZG93YCBvYmplY3QgaXMgdXNlZC5cclxuKi9cclxudmFyIHJvb3QgPSBmcmVlR2xvYmFsIHx8XHJcbigoZnJlZVdpbmRvdyAhPT0gKHRoaXNHbG9iYWwgJiYgdGhpc0dsb2JhbC53aW5kb3cpKSAmJiBmcmVlV2luZG93KSB8fFxyXG4gIGZyZWVTZWxmIHx8IHRoaXNHbG9iYWwgfHwgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcclxuXHJcbmlmKCAhKCdnYycgaW4gd2luZG93ICkgKSB7XHJcblx0d2luZG93LmdjID0gZnVuY3Rpb24oKXt9XHJcbn1cclxuXHJcbmlmICghSFRNTENhbnZhc0VsZW1lbnQucHJvdG90eXBlLnRvQmxvYikge1xyXG4gT2JqZWN0LmRlZmluZVByb3BlcnR5KEhUTUxDYW52YXNFbGVtZW50LnByb3RvdHlwZSwgJ3RvQmxvYicsIHtcclxuICB2YWx1ZTogZnVuY3Rpb24gKGNhbGxiYWNrLCB0eXBlLCBxdWFsaXR5KSB7XHJcblxyXG4gICAgdmFyIGJpblN0ciA9IGF0b2IoIHRoaXMudG9EYXRhVVJMKHR5cGUsIHF1YWxpdHkpLnNwbGl0KCcsJylbMV0gKSxcclxuICAgICAgICBsZW4gPSBiaW5TdHIubGVuZ3RoLFxyXG4gICAgICAgIGFyciA9IG5ldyBVaW50OEFycmF5KGxlbik7XHJcblxyXG4gICAgZm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrICkge1xyXG4gICAgIGFycltpXSA9IGJpblN0ci5jaGFyQ29kZUF0KGkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNhbGxiYWNrKCBuZXcgQmxvYiggW2Fycl0sIHt0eXBlOiB0eXBlIHx8ICdpbWFnZS9wbmcnfSApICk7XHJcbiAgfVxyXG4gfSk7XHJcbn1cclxuXHJcbi8vIEBsaWNlbnNlIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcclxuLy8gY29weXJpZ2h0IFBhdWwgSXJpc2ggMjAxNVxyXG5cclxuXHJcbi8vIERhdGUubm93KCkgaXMgc3VwcG9ydGVkIGV2ZXJ5d2hlcmUgZXhjZXB0IElFOC4gRm9yIElFOCB3ZSB1c2UgdGhlIERhdGUubm93IHBvbHlmaWxsXHJcbi8vICAgZ2l0aHViLmNvbS9GaW5hbmNpYWwtVGltZXMvcG9seWZpbGwtc2VydmljZS9ibG9iL21hc3Rlci9wb2x5ZmlsbHMvRGF0ZS5ub3cvcG9seWZpbGwuanNcclxuLy8gYXMgU2FmYXJpIDYgZG9lc24ndCBoYXZlIHN1cHBvcnQgZm9yIE5hdmlnYXRpb25UaW1pbmcsIHdlIHVzZSBhIERhdGUubm93KCkgdGltZXN0YW1wIGZvciByZWxhdGl2ZSB2YWx1ZXNcclxuXHJcbi8vIGlmIHlvdSB3YW50IHZhbHVlcyBzaW1pbGFyIHRvIHdoYXQgeW91J2QgZ2V0IHdpdGggcmVhbCBwZXJmLm5vdywgcGxhY2UgdGhpcyB0b3dhcmRzIHRoZSBoZWFkIG9mIHRoZSBwYWdlXHJcbi8vIGJ1dCBpbiByZWFsaXR5LCB5b3UncmUganVzdCBnZXR0aW5nIHRoZSBkZWx0YSBiZXR3ZWVuIG5vdygpIGNhbGxzLCBzbyBpdCdzIG5vdCB0ZXJyaWJseSBpbXBvcnRhbnQgd2hlcmUgaXQncyBwbGFjZWRcclxuXHJcblxyXG4oZnVuY3Rpb24oKXtcclxuXHJcbiAgaWYgKFwicGVyZm9ybWFuY2VcIiBpbiB3aW5kb3cgPT0gZmFsc2UpIHtcclxuICAgICAgd2luZG93LnBlcmZvcm1hbmNlID0ge307XHJcbiAgfVxyXG5cclxuICBEYXRlLm5vdyA9IChEYXRlLm5vdyB8fCBmdW5jdGlvbiAoKSB7ICAvLyB0aGFua3MgSUU4XHJcblx0ICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgfSk7XHJcblxyXG4gIGlmIChcIm5vd1wiIGluIHdpbmRvdy5wZXJmb3JtYW5jZSA9PSBmYWxzZSl7XHJcblxyXG4gICAgdmFyIG5vd09mZnNldCA9IERhdGUubm93KCk7XHJcblxyXG4gICAgaWYgKHBlcmZvcm1hbmNlLnRpbWluZyAmJiBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0KXtcclxuICAgICAgbm93T2Zmc2V0ID0gcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydFxyXG4gICAgfVxyXG5cclxuICAgIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbiBub3coKXtcclxuICAgICAgcmV0dXJuIERhdGUubm93KCkgLSBub3dPZmZzZXQ7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxufSkoKTtcclxuXHJcblxyXG5mdW5jdGlvbiBwYWQoIG4gKSB7XHJcblx0cmV0dXJuIFN0cmluZyhcIjAwMDAwMDBcIiArIG4pLnNsaWNlKC03KTtcclxufVxyXG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9BZGQtb25zL0NvZGVfc25pcHBldHMvVGltZXJzXHJcblxyXG52YXIgZ19zdGFydFRpbWUgPSB3aW5kb3cuRGF0ZS5ub3coKTtcclxuXHJcbmZ1bmN0aW9uIGd1aWQoKSB7XHJcblx0ZnVuY3Rpb24gczQoKSB7XHJcblx0XHRyZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMCkudG9TdHJpbmcoMTYpLnN1YnN0cmluZygxKTtcclxuXHR9XHJcblx0cmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0ZyYW1lRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBfaGFuZGxlcnMgPSB7fTtcclxuXHJcblx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xyXG5cclxuXHR0aGlzLm9uID0gZnVuY3Rpb24oZXZlbnQsIGhhbmRsZXIpIHtcclxuXHJcblx0XHRfaGFuZGxlcnNbZXZlbnRdID0gaGFuZGxlcjtcclxuXHJcblx0fTtcclxuXHJcblx0dGhpcy5lbWl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuXHJcblx0XHR2YXIgaGFuZGxlciA9IF9oYW5kbGVyc1tldmVudF07XHJcblx0XHRpZiAoaGFuZGxlcikge1xyXG5cclxuXHRcdFx0aGFuZGxlci5hcHBseShudWxsLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcclxuXHJcblx0XHR9XHJcblxyXG5cdH07XHJcblxyXG5cdHRoaXMuZmlsZW5hbWUgPSBzZXR0aW5ncy5uYW1lIHx8IGd1aWQoKTtcclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcnO1xyXG5cdHRoaXMubWltZVR5cGUgPSAnJztcclxuXHJcbn1cclxuXHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnNhZmVUb1Byb2NlZWQgPSBmdW5jdGlvbigpeyByZXR1cm4gdHJ1ZTsgfTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnN0ZXAgPSBmdW5jdGlvbigpIHsgY29uc29sZS5sb2coICdTdGVwIG5vdCBzZXQhJyApIH1cclxuXHJcbmZ1bmN0aW9uIENDVGFyRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy50YXInXHJcblx0dGhpcy5taW1lVHlwZSA9ICdhcHBsaWNhdGlvbi94LXRhcidcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnJztcclxuXHJcblx0dGhpcy50YXBlID0gbnVsbFxyXG5cdHRoaXMuY291bnQgPSAwO1xyXG5cclxufVxyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCl7XHJcblxyXG5cdHRoaXMuZGlzcG9zZSgpO1xyXG5cclxufTtcclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGJsb2IgKSB7XHJcblxyXG5cdHZhciBmaWxlUmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcclxuXHRmaWxlUmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dGhpcy50YXBlLmFwcGVuZCggcGFkKCB0aGlzLmNvdW50ICkgKyB0aGlzLmZpbGVFeHRlbnNpb24sIG5ldyBVaW50OEFycmF5KCBmaWxlUmVhZGVyLnJlc3VsdCApICk7XHJcblxyXG5cdFx0Ly9pZiggdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgPiAwICYmICggdGhpcy5mcmFtZXMubGVuZ3RoIC8gdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKSA+PSB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSApIHtcclxuXHJcblx0XHR0aGlzLmNvdW50Kys7XHJcblx0XHR0aGlzLnN0ZXAoKTtcclxuXHR9LmJpbmQoIHRoaXMgKTtcclxuXHRmaWxlUmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKGJsb2IpO1xyXG5cclxufVxyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuXHRjYWxsYmFjayggdGhpcy50YXBlLnNhdmUoKSApO1xyXG5cclxufVxyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMudGFwZSA9IG5ldyBUYXIoKTtcclxuXHR0aGlzLmNvdW50ID0gMDtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDUE5HRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDVGFyRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLnR5cGUgPSAnaW1hZ2UvcG5nJztcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnLnBuZyc7XHJcblxyXG59XHJcblxyXG5DQ1BOR0VuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NUYXJFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NQTkdFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRjYW52YXMudG9CbG9iKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdENDVGFyRW5jb2Rlci5wcm90b3R5cGUuYWRkLmNhbGwoIHRoaXMsIGJsb2IgKTtcclxuXHR9LmJpbmQoIHRoaXMgKSwgdGhpcy50eXBlIClcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDSlBFR0VuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ1RhckVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy50eXBlID0gJ2ltYWdlL2pwZWcnO1xyXG5cdHRoaXMuZmlsZUV4dGVuc2lvbiA9ICcuanBnJztcclxuXHR0aGlzLnF1YWxpdHkgPSAoIHNldHRpbmdzLnF1YWxpdHkgLyAxMDAgKSB8fCAuODtcclxuXHJcbn1cclxuXHJcbkNDSlBFR0VuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NUYXJFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NKUEVHRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0Y2FudmFzLnRvQmxvYiggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRDQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZC5jYWxsKCB0aGlzLCBibG9iICk7XHJcblx0fS5iaW5kKCB0aGlzICksIHRoaXMudHlwZSwgdGhpcy5xdWFsaXR5IClcclxuXHJcbn1cclxuXHJcbi8qXHJcblxyXG5cdFdlYk0gRW5jb2RlclxyXG5cclxuKi9cclxuXHJcbmZ1bmN0aW9uIENDV2ViTUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuXHRpZiggY2FudmFzLnRvRGF0YVVSTCggJ2ltYWdlL3dlYnAnICkuc3Vic3RyKDUsMTApICE9PSAnaW1hZ2Uvd2VicCcgKXtcclxuXHRcdGNvbnNvbGUubG9nKCBcIldlYlAgbm90IHN1cHBvcnRlZCAtIHRyeSBhbm90aGVyIGV4cG9ydCBmb3JtYXRcIiApXHJcblx0fVxyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLnF1YWxpdHkgPSAoIHNldHRpbmdzLnF1YWxpdHkgLyAxMDAgKSB8fCAuODtcclxuXHJcblx0dGhpcy5leHRlbnNpb24gPSAnLndlYm0nXHJcblx0dGhpcy5taW1lVHlwZSA9ICd2aWRlby93ZWJtJ1xyXG5cdHRoaXMuYmFzZUZpbGVuYW1lID0gdGhpcy5maWxlbmFtZTtcclxuXHJcblx0dGhpcy5mcmFtZXMgPSBbXTtcclxuXHR0aGlzLnBhcnQgPSAxO1xyXG5cclxuICB0aGlzLnZpZGVvV3JpdGVyID0gbmV3IFdlYk1Xcml0ZXIoe1xyXG4gICAgcXVhbGl0eTogdGhpcy5xdWFsaXR5LFxyXG4gICAgZmlsZVdyaXRlcjogbnVsbCxcclxuICAgIGZkOiBudWxsLFxyXG4gICAgZnJhbWVSYXRlOiBzZXR0aW5ncy5mcmFtZXJhdGVcclxufSk7XHJcblxyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5kaXNwb3NlKCk7XHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuICB0aGlzLnZpZGVvV3JpdGVyLmFkZEZyYW1lKGNhbnZhcyk7XHJcblxyXG5cdC8vdGhpcy5mcmFtZXMucHVzaCggY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2Uvd2VicCcsIHRoaXMucXVhbGl0eSkgKTtcclxuXHJcblx0aWYoIHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lID4gMCAmJiAoIHRoaXMuZnJhbWVzLmxlbmd0aCAvIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlICkgPj0gdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgKSB7XHJcblx0XHR0aGlzLnNhdmUoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0XHR0aGlzLmZpbGVuYW1lID0gdGhpcy5iYXNlRmlsZW5hbWUgKyAnLXBhcnQtJyArIHBhZCggdGhpcy5wYXJ0ICk7XHJcblx0XHRcdGRvd25sb2FkKCBibG9iLCB0aGlzLmZpbGVuYW1lICsgdGhpcy5leHRlbnNpb24sIHRoaXMubWltZVR5cGUgKTtcclxuXHRcdFx0dGhpcy5kaXNwb3NlKCk7XHJcblx0XHRcdHRoaXMucGFydCsrO1xyXG5cdFx0XHR0aGlzLmZpbGVuYW1lID0gdGhpcy5iYXNlRmlsZW5hbWUgKyAnLXBhcnQtJyArIHBhZCggdGhpcy5wYXJ0ICk7XHJcblx0XHRcdHRoaXMuc3RlcCgpO1xyXG5cdFx0fS5iaW5kKCB0aGlzICkgKVxyXG5cdH0gZWxzZSB7XHJcblx0XHR0aGlzLnN0ZXAoKTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuLy9cdGlmKCAhdGhpcy5mcmFtZXMubGVuZ3RoICkgcmV0dXJuO1xyXG5cclxuICB0aGlzLnZpZGVvV3JpdGVyLmNvbXBsZXRlKCkudGhlbihjYWxsYmFjayk7XHJcblxyXG5cdC8qdmFyIHdlYm0gPSBXaGFtbXkuZnJvbUltYWdlQXJyYXkoIHRoaXMuZnJhbWVzLCB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApXHJcblx0dmFyIGJsb2IgPSBuZXcgQmxvYiggWyB3ZWJtIF0sIHsgdHlwZTogXCJvY3RldC9zdHJlYW1cIiB9ICk7XHJcblx0Y2FsbGJhY2soIGJsb2IgKTsqL1xyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZnJhbWVzID0gW107XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0ZGTXBlZ1NlcnZlckVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG5cdHRoaXMuZW5jb2RlciA9IG5ldyBGRk1wZWdTZXJ2ZXIuVmlkZW8oIHNldHRpbmdzICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdwcm9jZXNzJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCAncHJvY2VzcycgKVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbignZmluaXNoZWQnLCBmdW5jdGlvbiggdXJsLCBzaXplICkge1xyXG4gICAgICAgIHZhciBjYiA9IHRoaXMuY2FsbGJhY2s7XHJcbiAgICAgICAgaWYgKCBjYiApIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgY2IoIHVybCwgc2l6ZSApO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdwcm9ncmVzcycsIGZ1bmN0aW9uKCBwcm9ncmVzcyApIHtcclxuICAgICAgICBpZiAoIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyApIHtcclxuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzKCBwcm9ncmVzcyApXHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ2Vycm9yJywgZnVuY3Rpb24oIGRhdGEgKSB7XHJcbiAgICAgICAgYWxlcnQoSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMikpO1xyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuXHJcbn1cclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLnN0YXJ0KCB0aGlzLnNldHRpbmdzICk7XHJcblxyXG59O1xyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuYWRkKCBjYW52YXMgKTtcclxuXHJcbn1cclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbiAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XHJcbiAgICB0aGlzLmVuY29kZXIuZW5kKCk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnNhZmVUb1Byb2NlZWQgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmVuY29kZXIuc2FmZVRvUHJvY2VlZCgpO1xyXG59O1xyXG5cclxuLypcclxuXHRIVE1MQ2FudmFzRWxlbWVudC5jYXB0dXJlU3RyZWFtKClcclxuKi9cclxuXHJcbmZ1bmN0aW9uIENDU3RyZWFtRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMuZnJhbWVyYXRlID0gdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0dGhpcy50eXBlID0gJ3ZpZGVvL3dlYm0nO1xyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy53ZWJtJztcclxuXHR0aGlzLnN0cmVhbSA9IG51bGw7XHJcblx0dGhpcy5tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuXHR0aGlzLmNodW5rcyA9IFtdO1xyXG5cclxufVxyXG5cclxuQ0NTdHJlYW1FbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NTdHJlYW1FbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRpZiggIXRoaXMuc3RyZWFtICkge1xyXG5cdFx0dGhpcy5zdHJlYW0gPSBjYW52YXMuY2FwdHVyZVN0cmVhbSggdGhpcy5mcmFtZXJhdGUgKTtcclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlciA9IG5ldyBNZWRpYVJlY29yZGVyKCB0aGlzLnN0cmVhbSApO1xyXG5cdFx0dGhpcy5tZWRpYVJlY29yZGVyLnN0YXJ0KCk7XHJcblxyXG5cdFx0dGhpcy5tZWRpYVJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0dGhpcy5jaHVua3MucHVzaChlLmRhdGEpO1xyXG5cdFx0fS5iaW5kKCB0aGlzICk7XHJcblxyXG5cdH1cclxuXHR0aGlzLnN0ZXAoKTtcclxuXHJcbn1cclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0dGhpcy5tZWRpYVJlY29yZGVyLm9uc3RvcCA9IGZ1bmN0aW9uKCBlICkge1xyXG5cdFx0dmFyIGJsb2IgPSBuZXcgQmxvYiggdGhpcy5jaHVua3MsIHsgJ3R5cGUnIDogJ3ZpZGVvL3dlYm0nIH0pO1xyXG5cdFx0dGhpcy5jaHVua3MgPSBbXTtcclxuXHRcdGNhbGxiYWNrKCBibG9iICk7XHJcblxyXG5cdH0uYmluZCggdGhpcyApO1xyXG5cclxuXHR0aGlzLm1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG5cclxufVxyXG5cclxuLypmdW5jdGlvbiBDQ0dJRkVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzICk7XHJcblxyXG5cdHNldHRpbmdzLnF1YWxpdHkgPSBzZXR0aW5ncy5xdWFsaXR5IHx8IDY7XHJcblx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xyXG5cclxuXHR0aGlzLmVuY29kZXIgPSBuZXcgR0lGRW5jb2RlcigpO1xyXG5cdHRoaXMuZW5jb2Rlci5zZXRSZXBlYXQoIDEgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXREZWxheSggc2V0dGluZ3Muc3RlcCApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldFF1YWxpdHkoIDYgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRUcmFuc3BhcmVudCggbnVsbCApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldFNpemUoIDE1MCwgMTUwICk7XHJcblxyXG4gIFx0dGhpcy5jYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG4gIFx0dGhpcy5jdHggPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCAnMmQnICk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIgKTtcclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLnN0YXJ0KCk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuY2FudmFzLndpZHRoID0gY2FudmFzLndpZHRoO1xyXG5cdHRoaXMuY2FudmFzLmhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XHJcblx0dGhpcy5jdHguZHJhd0ltYWdlKCBjYW52YXMsIDAsIDAgKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHRoaXMuY3R4ICk7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zZXRTaXplKCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQgKTtcclxuXHR2YXIgcmVhZEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGNhbnZhcy53aWR0aCAqIGNhbnZhcy5oZWlnaHQgKiA0KTtcclxuXHR2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICk7XHJcblx0Y29udGV4dC5yZWFkUGl4ZWxzKDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCwgY29udGV4dC5SR0JBLCBjb250ZXh0LlVOU0lHTkVEX0JZVEUsIHJlYWRCdWZmZXIpO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggcmVhZEJ1ZmZlciwgdHJ1ZSApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5maW5pc2goKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0dmFyIGJpbmFyeV9naWYgPSB0aGlzLmVuY29kZXIuc3RyZWFtKCkuZ2V0RGF0YSgpO1xyXG5cclxuXHR2YXIgZGF0YV91cmwgPSAnZGF0YTppbWFnZS9naWY7YmFzZTY0LCcrZW5jb2RlNjQoYmluYXJ5X2dpZik7XHJcblx0d2luZG93LmxvY2F0aW9uID0gZGF0YV91cmw7XHJcblx0cmV0dXJuO1xyXG5cclxuXHR2YXIgYmxvYiA9IG5ldyBCbG9iKCBbIGJpbmFyeV9naWYgXSwgeyB0eXBlOiBcIm9jdGV0L3N0cmVhbVwiIH0gKTtcclxuXHR2YXIgdXJsID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwoIGJsb2IgKTtcclxuXHRjYWxsYmFjayggdXJsICk7XHJcblxyXG59Ki9cclxuXHJcbmZ1bmN0aW9uIENDR0lGRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHNldHRpbmdzLnF1YWxpdHkgPSAzMSAtICggKCBzZXR0aW5ncy5xdWFsaXR5ICogMzAgLyAxMDAgKSB8fCAxMCApO1xyXG5cdHNldHRpbmdzLndvcmtlcnMgPSBzZXR0aW5ncy53b3JrZXJzIHx8IDQ7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy5naWYnXHJcblx0dGhpcy5taW1lVHlwZSA9ICdpbWFnZS9naWYnXHJcblxyXG4gIFx0dGhpcy5jYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG4gIFx0dGhpcy5jdHggPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCAnMmQnICk7XHJcbiAgXHR0aGlzLnNpemVTZXQgPSBmYWxzZTtcclxuXHJcbiAgXHR0aGlzLmVuY29kZXIgPSBuZXcgR0lGKHtcclxuXHRcdHdvcmtlcnM6IHNldHRpbmdzLndvcmtlcnMsXHJcblx0XHRxdWFsaXR5OiBzZXR0aW5ncy5xdWFsaXR5LFxyXG5cdFx0d29ya2VyU2NyaXB0OiBzZXR0aW5ncy53b3JrZXJzUGF0aCArICdnaWYud29ya2VyLmpzJ1xyXG5cdH0gKTtcclxuXHJcbiAgICB0aGlzLmVuY29kZXIub24oICdwcm9ncmVzcycsIGZ1bmN0aW9uKCBwcm9ncmVzcyApIHtcclxuICAgICAgICBpZiAoIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyApIHtcclxuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzKCBwcm9ncmVzcyApXHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuXHJcbiAgICB0aGlzLmVuY29kZXIub24oJ2ZpbmlzaGVkJywgZnVuY3Rpb24oIGJsb2IgKSB7XHJcbiAgICAgICAgdmFyIGNiID0gdGhpcy5jYWxsYmFjaztcclxuICAgICAgICBpZiAoIGNiICkge1xyXG4gICAgICAgICAgICB0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBjYiggYmxvYiApO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGlmKCAhdGhpcy5zaXplU2V0ICkge1xyXG5cdFx0dGhpcy5lbmNvZGVyLnNldE9wdGlvbiggJ3dpZHRoJyxjYW52YXMud2lkdGggKTtcclxuXHRcdHRoaXMuZW5jb2Rlci5zZXRPcHRpb24oICdoZWlnaHQnLGNhbnZhcy5oZWlnaHQgKTtcclxuXHRcdHRoaXMuc2l6ZVNldCA9IHRydWU7XHJcblx0fVxyXG5cclxuXHR0aGlzLmNhbnZhcy53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHR0aGlzLmNhbnZhcy5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdHRoaXMuY3R4LmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggdGhpcy5jdHgsIHsgY29weTogdHJ1ZSwgZGVsYXk6IHRoaXMuc2V0dGluZ3Muc3RlcCB9ICk7XHJcblx0dGhpcy5zdGVwKCk7XHJcblxyXG5cdC8qdGhpcy5lbmNvZGVyLnNldFNpemUoIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCApO1xyXG5cdHZhciByZWFkQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoY2FudmFzLndpZHRoICogY2FudmFzLmhlaWdodCAqIDQpO1xyXG5cdHZhciBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKTtcclxuXHRjb250ZXh0LnJlYWRQaXhlbHMoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0LCBjb250ZXh0LlJHQkEsIGNvbnRleHQuVU5TSUdORURfQllURSwgcmVhZEJ1ZmZlcik7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCByZWFkQnVmZmVyLCB0cnVlICk7Ki9cclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbiAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5yZW5kZXIoKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDYXB0dXJlKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIF9zZXR0aW5ncyA9IHNldHRpbmdzIHx8IHt9LFxyXG5cdFx0X2RhdGUgPSBuZXcgRGF0ZSgpLFxyXG5cdFx0X3ZlcmJvc2UsXHJcblx0XHRfZGlzcGxheSxcclxuXHRcdF90aW1lLFxyXG5cdFx0X3N0YXJ0VGltZSxcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUsXHJcblx0XHRfcGVyZm9ybWFuY2VTdGFydFRpbWUsXHJcblx0XHRfc3RlcCxcclxuICAgICAgICBfZW5jb2RlcixcclxuXHRcdF90aW1lb3V0cyA9IFtdLFxyXG5cdFx0X2ludGVydmFscyA9IFtdLFxyXG5cdFx0X2ZyYW1lQ291bnQgPSAwLFxyXG5cdFx0X2ludGVybWVkaWF0ZUZyYW1lQ291bnQgPSAwLFxyXG5cdFx0X2xhc3RGcmFtZSA9IG51bGwsXHJcblx0XHRfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzID0gW10sXHJcblx0XHRfY2FwdHVyaW5nID0gZmFsc2UsXHJcbiAgICAgICAgX2hhbmRsZXJzID0ge307XHJcblxyXG5cdF9zZXR0aW5ncy5mcmFtZXJhdGUgPSBfc2V0dGluZ3MuZnJhbWVyYXRlIHx8IDYwO1xyXG5cdF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID0gMiAqICggX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgfHwgMSApO1xyXG5cdF92ZXJib3NlID0gX3NldHRpbmdzLnZlcmJvc2UgfHwgZmFsc2U7XHJcblx0X2Rpc3BsYXkgPSBfc2V0dGluZ3MuZGlzcGxheSB8fCBmYWxzZTtcclxuXHRfc2V0dGluZ3Muc3RlcCA9IDEwMDAuMCAvIF9zZXR0aW5ncy5mcmFtZXJhdGUgO1xyXG5cdF9zZXR0aW5ncy50aW1lTGltaXQgPSBfc2V0dGluZ3MudGltZUxpbWl0IHx8IDA7XHJcblx0X3NldHRpbmdzLmZyYW1lTGltaXQgPSBfc2V0dGluZ3MuZnJhbWVMaW1pdCB8fCAwO1xyXG5cdF9zZXR0aW5ncy5zdGFydFRpbWUgPSBfc2V0dGluZ3Muc3RhcnRUaW1lIHx8IDA7XHJcblxyXG5cdHZhciBfdGltZURpc3BsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmxlZnQgPSBfdGltZURpc3BsYXkuc3R5bGUudG9wID0gMFxyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnYmxhY2snO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5mb250RmFtaWx5ID0gJ21vbm9zcGFjZSdcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuZm9udFNpemUgPSAnMTFweCdcclxuXHRfdGltZURpc3BsYXkuc3R5bGUucGFkZGluZyA9ICc1cHgnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmNvbG9yID0gJ3JlZCc7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnpJbmRleCA9IDEwMDAwMFxyXG5cdGlmKCBfc2V0dGluZ3MuZGlzcGxheSApIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIF90aW1lRGlzcGxheSApO1xyXG5cclxuXHR2YXIgY2FudmFzTW90aW9uQmx1ciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcblx0dmFyIGN0eE1vdGlvbkJsdXIgPSBjYW52YXNNb3Rpb25CbHVyLmdldENvbnRleHQoICcyZCcgKTtcclxuXHR2YXIgYnVmZmVyTW90aW9uQmx1cjtcclxuXHR2YXIgaW1hZ2VEYXRhO1xyXG5cclxuXHRfbG9nKCAnU3RlcCBpcyBzZXQgdG8gJyArIF9zZXR0aW5ncy5zdGVwICsgJ21zJyApO1xyXG5cclxuICAgIHZhciBfZW5jb2RlcnMgPSB7XHJcblx0XHRnaWY6IENDR0lGRW5jb2RlcixcclxuXHRcdHdlYm06IENDV2ViTUVuY29kZXIsXHJcblx0XHRmZm1wZWdzZXJ2ZXI6IENDRkZNcGVnU2VydmVyRW5jb2RlcixcclxuXHRcdHBuZzogQ0NQTkdFbmNvZGVyLFxyXG5cdFx0anBnOiBDQ0pQRUdFbmNvZGVyLFxyXG5cdFx0J3dlYm0tbWVkaWFyZWNvcmRlcic6IENDU3RyZWFtRW5jb2RlclxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgY3RvciA9IF9lbmNvZGVyc1sgX3NldHRpbmdzLmZvcm1hdCBdO1xyXG4gICAgaWYgKCAhY3RvciApIHtcclxuXHRcdHRocm93IFwiRXJyb3I6IEluY29ycmVjdCBvciBtaXNzaW5nIGZvcm1hdDogVmFsaWQgZm9ybWF0cyBhcmUgXCIgKyBPYmplY3Qua2V5cyhfZW5jb2RlcnMpLmpvaW4oXCIsIFwiKTtcclxuICAgIH1cclxuICAgIF9lbmNvZGVyID0gbmV3IGN0b3IoIF9zZXR0aW5ncyApO1xyXG4gICAgX2VuY29kZXIuc3RlcCA9IF9zdGVwXHJcblxyXG5cdF9lbmNvZGVyLm9uKCdwcm9jZXNzJywgX3Byb2Nlc3MpO1xyXG4gICAgX2VuY29kZXIub24oJ3Byb2dyZXNzJywgX3Byb2dyZXNzKTtcclxuXHJcbiAgICBpZiAoXCJwZXJmb3JtYW5jZVwiIGluIHdpbmRvdyA9PSBmYWxzZSkge1xyXG4gICAgXHR3aW5kb3cucGVyZm9ybWFuY2UgPSB7fTtcclxuICAgIH1cclxuXHJcblx0RGF0ZS5ub3cgPSAoRGF0ZS5ub3cgfHwgZnVuY3Rpb24gKCkgeyAgLy8gdGhhbmtzIElFOFxyXG5cdFx0cmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG5cdH0pO1xyXG5cclxuXHRpZiAoXCJub3dcIiBpbiB3aW5kb3cucGVyZm9ybWFuY2UgPT0gZmFsc2Upe1xyXG5cclxuXHRcdHZhciBub3dPZmZzZXQgPSBEYXRlLm5vdygpO1xyXG5cclxuXHRcdGlmIChwZXJmb3JtYW5jZS50aW1pbmcgJiYgcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydCl7XHJcblx0XHRcdG5vd09mZnNldCA9IHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnRcclxuXHRcdH1cclxuXHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24gbm93KCl7XHJcblx0XHRcdHJldHVybiBEYXRlLm5vdygpIC0gbm93T2Zmc2V0O1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dmFyIF9vbGRTZXRUaW1lb3V0ID0gd2luZG93LnNldFRpbWVvdXQsXHJcblx0XHRfb2xkU2V0SW50ZXJ2YWwgPSB3aW5kb3cuc2V0SW50ZXJ2YWwsXHJcblx0ICAgIFx0X29sZENsZWFySW50ZXJ2YWwgPSB3aW5kb3cuY2xlYXJJbnRlcnZhbCxcclxuXHRcdF9vbGRDbGVhclRpbWVvdXQgPSB3aW5kb3cuY2xlYXJUaW1lb3V0LFxyXG5cdFx0X29sZFJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXHJcblx0XHRfb2xkTm93ID0gd2luZG93LkRhdGUubm93LFxyXG5cdFx0X29sZFBlcmZvcm1hbmNlTm93ID0gd2luZG93LnBlcmZvcm1hbmNlLm5vdyxcclxuXHRcdF9vbGRHZXRUaW1lID0gd2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWU7XHJcblx0Ly8gRGF0ZS5wcm90b3R5cGUuX29sZEdldFRpbWUgPSBEYXRlLnByb3RvdHlwZS5nZXRUaW1lO1xyXG5cclxuXHR2YXIgbWVkaWEgPSBbXTtcclxuXHJcblx0ZnVuY3Rpb24gX2luaXQoKSB7XHJcblxyXG5cdFx0X2xvZyggJ0NhcHR1cmVyIHN0YXJ0JyApO1xyXG5cclxuXHRcdF9zdGFydFRpbWUgPSB3aW5kb3cuRGF0ZS5ub3coKTtcclxuXHRcdF90aW1lID0gX3N0YXJ0VGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblx0XHRfcGVyZm9ybWFuY2VTdGFydFRpbWUgPSB3aW5kb3cucGVyZm9ybWFuY2Uubm93KCk7XHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lID0gX3BlcmZvcm1hbmNlU3RhcnRUaW1lICsgX3NldHRpbmdzLnN0YXJ0VGltZTtcclxuXHJcblx0XHR3aW5kb3cuRGF0ZS5wcm90b3R5cGUuZ2V0VGltZSA9IGZ1bmN0aW9uKCl7XHJcblx0XHRcdHJldHVybiBfdGltZTtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cuRGF0ZS5ub3cgPSBmdW5jdGlvbigpIHtcclxuXHRcdFx0cmV0dXJuIF90aW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHR3aW5kb3cuc2V0VGltZW91dCA9IGZ1bmN0aW9uKCBjYWxsYmFjaywgdGltZSApIHtcclxuXHRcdFx0dmFyIHQgPSB7XHJcblx0XHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxyXG5cdFx0XHRcdHRpbWU6IHRpbWUsXHJcblx0XHRcdFx0dHJpZ2dlclRpbWU6IF90aW1lICsgdGltZVxyXG5cdFx0XHR9O1xyXG5cdFx0XHRfdGltZW91dHMucHVzaCggdCApO1xyXG5cdFx0XHRfbG9nKCAnVGltZW91dCBzZXQgdG8gJyArIHQudGltZSApO1xyXG4gICAgICAgICAgICByZXR1cm4gdDtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0ID0gZnVuY3Rpb24oIGlkICkge1xyXG5cdFx0XHRmb3IoIHZhciBqID0gMDsgaiA8IF90aW1lb3V0cy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0XHRpZiggX3RpbWVvdXRzWyBqIF0gPT0gaWQgKSB7XHJcblx0XHRcdFx0XHRfdGltZW91dHMuc3BsaWNlKCBqLCAxICk7XHJcblx0XHRcdFx0XHRfbG9nKCAnVGltZW91dCBjbGVhcmVkJyApO1xyXG5cdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LnNldEludGVydmFsID0gZnVuY3Rpb24oIGNhbGxiYWNrLCB0aW1lICkge1xyXG5cdFx0XHR2YXIgdCA9IHtcclxuXHRcdFx0XHRjYWxsYmFjazogY2FsbGJhY2ssXHJcblx0XHRcdFx0dGltZTogdGltZSxcclxuXHRcdFx0XHR0cmlnZ2VyVGltZTogX3RpbWUgKyB0aW1lXHJcblx0XHRcdH07XHJcblx0XHRcdF9pbnRlcnZhbHMucHVzaCggdCApO1xyXG5cdFx0XHRfbG9nKCAnSW50ZXJ2YWwgc2V0IHRvICcgKyB0LnRpbWUgKTtcclxuXHRcdFx0cmV0dXJuIHQ7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LmNsZWFySW50ZXJ2YWwgPSBmdW5jdGlvbiggaWQgKSB7XHJcblx0XHRcdF9sb2coICdjbGVhciBJbnRlcnZhbCcgKTtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHRcdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcy5wdXNoKCBjYWxsYmFjayApO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbigpe1xyXG5cdFx0XHRyZXR1cm4gX3BlcmZvcm1hbmNlVGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0ZnVuY3Rpb24gaG9va0N1cnJlbnRUaW1lKCkge1xyXG5cdFx0XHRpZiggIXRoaXMuX2hvb2tlZCApIHtcclxuXHRcdFx0XHR0aGlzLl9ob29rZWQgPSB0cnVlO1xyXG5cdFx0XHRcdHRoaXMuX2hvb2tlZFRpbWUgPSB0aGlzLmN1cnJlbnRUaW1lIHx8IDA7XHJcblx0XHRcdFx0dGhpcy5wYXVzZSgpO1xyXG5cdFx0XHRcdG1lZGlhLnB1c2goIHRoaXMgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdGhpcy5faG9va2VkVGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdHRyeSB7XHJcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSggSFRNTFZpZGVvRWxlbWVudC5wcm90b3R5cGUsICdjdXJyZW50VGltZScsIHsgZ2V0OiBob29rQ3VycmVudFRpbWUgfSApXHJcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSggSFRNTEF1ZGlvRWxlbWVudC5wcm90b3R5cGUsICdjdXJyZW50VGltZScsIHsgZ2V0OiBob29rQ3VycmVudFRpbWUgfSApXHJcblx0XHR9IGNhdGNoIChlcnIpIHtcclxuXHRcdFx0X2xvZyhlcnIpO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zdGFydCgpIHtcclxuXHRcdF9pbml0KCk7XHJcblx0XHRfZW5jb2Rlci5zdGFydCgpO1xyXG5cdFx0X2NhcHR1cmluZyA9IHRydWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RvcCgpIHtcclxuXHRcdF9jYXB0dXJpbmcgPSBmYWxzZTtcclxuXHRcdF9lbmNvZGVyLnN0b3AoKTtcclxuXHRcdF9kZXN0cm95KCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2FsbCggZm4sIHAgKSB7XHJcblx0XHRfb2xkU2V0VGltZW91dCggZm4sIDAsIHAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zdGVwKCkge1xyXG5cdFx0Ly9fb2xkUmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBfcHJvY2VzcyApO1xyXG5cdFx0X2NhbGwoIF9wcm9jZXNzICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfZGVzdHJveSgpIHtcclxuXHRcdF9sb2coICdDYXB0dXJlciBzdG9wJyApO1xyXG5cdFx0d2luZG93LnNldFRpbWVvdXQgPSBfb2xkU2V0VGltZW91dDtcclxuXHRcdHdpbmRvdy5zZXRJbnRlcnZhbCA9IF9vbGRTZXRJbnRlcnZhbDtcclxuXHRcdHdpbmRvdy5jbGVhckludGVydmFsID0gX29sZENsZWFySW50ZXJ2YWw7XHJcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0ID0gX29sZENsZWFyVGltZW91dDtcclxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBfb2xkUmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xyXG5cdFx0d2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWUgPSBfb2xkR2V0VGltZTtcclxuXHRcdHdpbmRvdy5EYXRlLm5vdyA9IF9vbGROb3c7XHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gX29sZFBlcmZvcm1hbmNlTm93O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3VwZGF0ZVRpbWUoKSB7XHJcblx0XHR2YXIgc2Vjb25kcyA9IF9mcmFtZUNvdW50IC8gX3NldHRpbmdzLmZyYW1lcmF0ZTtcclxuXHRcdGlmKCAoIF9zZXR0aW5ncy5mcmFtZUxpbWl0ICYmIF9mcmFtZUNvdW50ID49IF9zZXR0aW5ncy5mcmFtZUxpbWl0ICkgfHwgKCBfc2V0dGluZ3MudGltZUxpbWl0ICYmIHNlY29uZHMgPj0gX3NldHRpbmdzLnRpbWVMaW1pdCApICkge1xyXG5cdFx0XHRfc3RvcCgpO1xyXG5cdFx0XHRfc2F2ZSgpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGQgPSBuZXcgRGF0ZSggbnVsbCApO1xyXG5cdFx0ZC5zZXRTZWNvbmRzKCBzZWNvbmRzICk7XHJcblx0XHRpZiggX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgPiAyICkge1xyXG5cdFx0XHRfdGltZURpc3BsYXkudGV4dENvbnRlbnQgPSAnQ0NhcHR1cmUgJyArIF9zZXR0aW5ncy5mb3JtYXQgKyAnIHwgJyArIF9mcmFtZUNvdW50ICsgJyBmcmFtZXMgKCcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCArICcgaW50ZXIpIHwgJyArICBkLnRvSVNPU3RyaW5nKCkuc3Vic3RyKCAxMSwgOCApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0X3RpbWVEaXNwbGF5LnRleHRDb250ZW50ID0gJ0NDYXB0dXJlICcgKyBfc2V0dGluZ3MuZm9ybWF0ICsgJyB8ICcgKyBfZnJhbWVDb3VudCArICcgZnJhbWVzIHwgJyArICBkLnRvSVNPU3RyaW5nKCkuc3Vic3RyKCAxMSwgOCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NoZWNrRnJhbWUoIGNhbnZhcyApIHtcclxuXHJcblx0XHRpZiggY2FudmFzTW90aW9uQmx1ci53aWR0aCAhPT0gY2FudmFzLndpZHRoIHx8IGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICE9PSBjYW52YXMuaGVpZ2h0ICkge1xyXG5cdFx0XHRjYW52YXNNb3Rpb25CbHVyLndpZHRoID0gY2FudmFzLndpZHRoO1xyXG5cdFx0XHRjYW52YXNNb3Rpb25CbHVyLmhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXIgPSBuZXcgVWludDE2QXJyYXkoIGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICogY2FudmFzTW90aW9uQmx1ci53aWR0aCAqIDQgKTtcclxuXHRcdFx0Y3R4TW90aW9uQmx1ci5maWxsU3R5bGUgPSAnIzAnXHJcblx0XHRcdGN0eE1vdGlvbkJsdXIuZmlsbFJlY3QoIDAsIDAsIGNhbnZhc01vdGlvbkJsdXIud2lkdGgsIGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICk7XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2JsZW5kRnJhbWUoIGNhbnZhcyApIHtcclxuXHJcblx0XHQvL19sb2coICdJbnRlcm1lZGlhdGUgRnJhbWU6ICcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCApO1xyXG5cclxuXHRcdGN0eE1vdGlvbkJsdXIuZHJhd0ltYWdlKCBjYW52YXMsIDAsIDAgKTtcclxuXHRcdGltYWdlRGF0YSA9IGN0eE1vdGlvbkJsdXIuZ2V0SW1hZ2VEYXRhKCAwLCAwLCBjYW52YXNNb3Rpb25CbHVyLndpZHRoLCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCApO1xyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBidWZmZXJNb3Rpb25CbHVyLmxlbmd0aDsgais9IDQgKSB7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogXSArPSBpbWFnZURhdGEuZGF0YVsgaiBdO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMSBdICs9IGltYWdlRGF0YS5kYXRhWyBqICsgMSBdO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMiBdICs9IGltYWdlRGF0YS5kYXRhWyBqICsgMiBdO1xyXG5cdFx0fVxyXG5cdFx0X2ludGVybWVkaWF0ZUZyYW1lQ291bnQrKztcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc2F2ZUZyYW1lKCl7XHJcblxyXG5cdFx0dmFyIGRhdGEgPSBpbWFnZURhdGEuZGF0YTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRkYXRhWyBqIF0gPSBidWZmZXJNb3Rpb25CbHVyWyBqIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHRcdGRhdGFbIGogKyAxIF0gPSBidWZmZXJNb3Rpb25CbHVyWyBqICsgMSBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0XHRkYXRhWyBqICsgMiBdID0gYnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdH1cclxuXHRcdGN0eE1vdGlvbkJsdXIucHV0SW1hZ2VEYXRhKCBpbWFnZURhdGEsIDAsIDAgKTtcclxuXHRcdF9lbmNvZGVyLmFkZCggY2FudmFzTW90aW9uQmx1ciApO1xyXG5cdFx0X2ZyYW1lQ291bnQrKztcclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID0gMDtcclxuXHRcdF9sb2coICdGdWxsIE1CIEZyYW1lISAnICsgX2ZyYW1lQ291bnQgKyAnICcgKyAgX3RpbWUgKTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqIF0gPSAwO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMSBdID0gMDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSA9IDA7XHJcblx0XHR9XHJcblx0XHRnYygpO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jYXB0dXJlKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0aWYoIF9jYXB0dXJpbmcgKSB7XHJcblxyXG5cdFx0XHRpZiggX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgPiAyICkge1xyXG5cclxuXHRcdFx0XHRfY2hlY2tGcmFtZSggY2FudmFzICk7XHJcblx0XHRcdFx0X2JsZW5kRnJhbWUoIGNhbnZhcyApO1xyXG5cclxuXHRcdFx0XHRpZiggX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgPj0gLjUgKiBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyApIHtcclxuXHRcdFx0XHRcdF9zYXZlRnJhbWUoKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0X3N0ZXAoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdF9lbmNvZGVyLmFkZCggY2FudmFzICk7XHJcblx0XHRcdFx0X2ZyYW1lQ291bnQrKztcclxuXHRcdFx0XHRfbG9nKCAnRnVsbCBGcmFtZSEgJyArIF9mcmFtZUNvdW50ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3Byb2Nlc3MoKSB7XHJcblxyXG5cdFx0dmFyIHN0ZXAgPSAxMDAwIC8gX3NldHRpbmdzLmZyYW1lcmF0ZTtcclxuXHRcdHZhciBkdCA9ICggX2ZyYW1lQ291bnQgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzICkgKiBzdGVwO1xyXG5cclxuXHRcdF90aW1lID0gX3N0YXJ0VGltZSArIGR0O1xyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSA9IF9wZXJmb3JtYW5jZVN0YXJ0VGltZSArIGR0O1xyXG5cclxuXHRcdG1lZGlhLmZvckVhY2goIGZ1bmN0aW9uKCB2ICkge1xyXG5cdFx0XHR2Ll9ob29rZWRUaW1lID0gZHQgLyAxMDAwO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdF91cGRhdGVUaW1lKCk7XHJcblx0XHRfbG9nKCAnRnJhbWU6ICcgKyBfZnJhbWVDb3VudCArICcgJyArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ICk7XHJcblxyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfdGltZW91dHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdGlmKCBfdGltZSA+PSBfdGltZW91dHNbIGogXS50cmlnZ2VyVGltZSApIHtcclxuXHRcdFx0XHRfY2FsbCggX3RpbWVvdXRzWyBqIF0uY2FsbGJhY2sgKVxyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coICd0aW1lb3V0IScgKTtcclxuXHRcdFx0XHRfdGltZW91dHMuc3BsaWNlKCBqLCAxICk7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IF9pbnRlcnZhbHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdGlmKCBfdGltZSA+PSBfaW50ZXJ2YWxzWyBqIF0udHJpZ2dlclRpbWUgKSB7XHJcblx0XHRcdFx0X2NhbGwoIF9pbnRlcnZhbHNbIGogXS5jYWxsYmFjayApO1xyXG5cdFx0XHRcdF9pbnRlcnZhbHNbIGogXS50cmlnZ2VyVGltZSArPSBfaW50ZXJ2YWxzWyBqIF0udGltZTtcclxuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCAnaW50ZXJ2YWwhJyApO1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcy5mb3JFYWNoKCBmdW5jdGlvbiggY2IgKSB7XHJcbiAgICAgXHRcdF9jYWxsKCBjYiwgX3RpbWUgLSBnX3N0YXJ0VGltZSApO1xyXG4gICAgICAgIH0gKTtcclxuICAgICAgICBfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzID0gW107XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3NhdmUoIGNhbGxiYWNrICkge1xyXG5cclxuXHRcdGlmKCAhY2FsbGJhY2sgKSB7XHJcblx0XHRcdGNhbGxiYWNrID0gZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRcdFx0ZG93bmxvYWQoIGJsb2IsIF9lbmNvZGVyLmZpbGVuYW1lICsgX2VuY29kZXIuZXh0ZW5zaW9uLCBfZW5jb2Rlci5taW1lVHlwZSApO1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0X2VuY29kZXIuc2F2ZSggY2FsbGJhY2sgKTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfbG9nKCBtZXNzYWdlICkge1xyXG5cdFx0aWYoIF92ZXJib3NlICkgY29uc29sZS5sb2coIG1lc3NhZ2UgKTtcclxuXHR9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uKCBldmVudCwgaGFuZGxlciApIHtcclxuXHJcbiAgICAgICAgX2hhbmRsZXJzW2V2ZW50XSA9IGhhbmRsZXI7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9lbWl0KCBldmVudCApIHtcclxuXHJcbiAgICAgICAgdmFyIGhhbmRsZXIgPSBfaGFuZGxlcnNbZXZlbnRdO1xyXG4gICAgICAgIGlmICggaGFuZGxlciApIHtcclxuXHJcbiAgICAgICAgICAgIGhhbmRsZXIuYXBwbHkoIG51bGwsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcmd1bWVudHMsIDEgKSApO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9wcm9ncmVzcyggcHJvZ3Jlc3MgKSB7XHJcblxyXG4gICAgICAgIF9lbWl0KCAncHJvZ3Jlc3MnLCBwcm9ncmVzcyApO1xyXG5cclxuICAgIH1cclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdHN0YXJ0OiBfc3RhcnQsXHJcblx0XHRjYXB0dXJlOiBfY2FwdHVyZSxcclxuXHRcdHN0b3A6IF9zdG9wLFxyXG5cdFx0c2F2ZTogX3NhdmUsXHJcbiAgICAgICAgb246IF9vblxyXG5cdH1cclxufVxyXG5cclxuKGZyZWVXaW5kb3cgfHwgZnJlZVNlbGYgfHwge30pLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcblxyXG4gIC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMgbGlrZSByLmpzIGNoZWNrIGZvciBjb25kaXRpb24gcGF0dGVybnMgbGlrZSB0aGUgZm9sbG93aW5nOlxyXG4gIGlmICh0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiYgZGVmaW5lLmFtZCkge1xyXG4gICAgLy8gRGVmaW5lIGFzIGFuIGFub255bW91cyBtb2R1bGUgc28sIHRocm91Z2ggcGF0aCBtYXBwaW5nLCBpdCBjYW4gYmVcclxuICAgIC8vIHJlZmVyZW5jZWQgYXMgdGhlIFwidW5kZXJzY29yZVwiIG1vZHVsZS5cclxuICAgIGRlZmluZShmdW5jdGlvbigpIHtcclxuICAgIFx0cmV0dXJuIENDYXB0dXJlO1xyXG4gICAgfSk7XHJcbn1cclxuICAvLyBDaGVjayBmb3IgYGV4cG9ydHNgIGFmdGVyIGBkZWZpbmVgIGluIGNhc2UgYSBidWlsZCBvcHRpbWl6ZXIgYWRkcyBhbiBgZXhwb3J0c2Agb2JqZWN0LlxyXG4gIGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUpIHtcclxuICAgIC8vIEV4cG9ydCBmb3IgTm9kZS5qcy5cclxuICAgIGlmIChtb2R1bGVFeHBvcnRzKSB7XHJcbiAgICBcdChmcmVlTW9kdWxlLmV4cG9ydHMgPSBDQ2FwdHVyZSkuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxuICAgIH1cclxuICAgIC8vIEV4cG9ydCBmb3IgQ29tbW9uSlMgc3VwcG9ydC5cclxuICAgIGZyZWVFeHBvcnRzLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbn1cclxuZWxzZSB7XHJcbiAgICAvLyBFeHBvcnQgdG8gdGhlIGdsb2JhbCBvYmplY3QuXHJcbiAgICByb290LkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbn1cclxuXHJcbn0oKSk7XHJcbiIsIi8qKlxuICogQGF1dGhvciBhbHRlcmVkcSAvIGh0dHA6Ly9hbHRlcmVkcXVhbGlhLmNvbS9cbiAqIEBhdXRob3IgbXIuZG9vYiAvIGh0dHA6Ly9tcmRvb2IuY29tL1xuICovXG5cbnZhciBEZXRlY3RvciA9IHtcblxuXHRjYW52YXM6ICEhIHdpbmRvdy5DYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsXG5cdHdlYmdsOiAoIGZ1bmN0aW9uICgpIHtcblxuXHRcdHRyeSB7XG5cblx0XHRcdHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApOyByZXR1cm4gISEgKCB3aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0ICYmICggY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKSB8fCBjYW52YXMuZ2V0Q29udGV4dCggJ2V4cGVyaW1lbnRhbC13ZWJnbCcgKSApICk7XG5cblx0XHR9IGNhdGNoICggZSApIHtcblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXG5cdFx0fVxuXG5cdH0gKSgpLFxuXHR3b3JrZXJzOiAhISB3aW5kb3cuV29ya2VyLFxuXHRmaWxlYXBpOiB3aW5kb3cuRmlsZSAmJiB3aW5kb3cuRmlsZVJlYWRlciAmJiB3aW5kb3cuRmlsZUxpc3QgJiYgd2luZG93LkJsb2IsXG5cblx0Z2V0V2ViR0xFcnJvck1lc3NhZ2U6IGZ1bmN0aW9uICgpIHtcblxuXHRcdHZhciBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRlbGVtZW50LmlkID0gJ3dlYmdsLWVycm9yLW1lc3NhZ2UnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udFNpemUgPSAnMTNweCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5mb250V2VpZ2h0ID0gJ25vcm1hbCc7XG5cdFx0ZWxlbWVudC5zdHlsZS50ZXh0QWxpZ24gPSAnY2VudGVyJztcblx0XHRlbGVtZW50LnN0eWxlLmJhY2tncm91bmQgPSAnI2ZmZic7XG5cdFx0ZWxlbWVudC5zdHlsZS5jb2xvciA9ICcjMDAwJztcblx0XHRlbGVtZW50LnN0eWxlLnBhZGRpbmcgPSAnMS41ZW0nO1xuXHRcdGVsZW1lbnQuc3R5bGUuekluZGV4ID0gJzk5OSc7XG5cdFx0ZWxlbWVudC5zdHlsZS53aWR0aCA9ICc0MDBweCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5tYXJnaW4gPSAnNWVtIGF1dG8gMCc7XG5cblx0XHRpZiAoICEgdGhpcy53ZWJnbCApIHtcblxuXHRcdFx0ZWxlbWVudC5pbm5lckhUTUwgPSB3aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0ID8gW1xuXHRcdFx0XHQnWW91ciBncmFwaGljcyBjYXJkIGRvZXMgbm90IHNlZW0gdG8gc3VwcG9ydCA8YSBocmVmPVwiaHR0cDovL2tocm9ub3Mub3JnL3dlYmdsL3dpa2kvR2V0dGluZ19hX1dlYkdMX0ltcGxlbWVudGF0aW9uXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+V2ViR0w8L2E+LjxiciAvPicsXG5cdFx0XHRcdCdGaW5kIG91dCBob3cgdG8gZ2V0IGl0IDxhIGhyZWY9XCJodHRwOi8vZ2V0LndlYmdsLm9yZy9cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5oZXJlPC9hPi4nXG5cdFx0XHRdLmpvaW4oICdcXG4nICkgOiBbXG5cdFx0XHRcdCdZb3VyIGJyb3dzZXIgZG9lcyBub3Qgc2VlbSB0byBzdXBwb3J0IDxhIGhyZWY9XCJodHRwOi8va2hyb25vcy5vcmcvd2ViZ2wvd2lraS9HZXR0aW5nX2FfV2ViR0xfSW1wbGVtZW50YXRpb25cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5XZWJHTDwvYT4uPGJyLz4nLFxuXHRcdFx0XHQnRmluZCBvdXQgaG93IHRvIGdldCBpdCA8YSBocmVmPVwiaHR0cDovL2dldC53ZWJnbC5vcmcvXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+aGVyZTwvYT4uJ1xuXHRcdFx0XS5qb2luKCAnXFxuJyApO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVsZW1lbnQ7XG5cblx0fSxcblxuXHRhZGRHZXRXZWJHTE1lc3NhZ2U6IGZ1bmN0aW9uICggcGFyYW1ldGVycyApIHtcblxuXHRcdHZhciBwYXJlbnQsIGlkLCBlbGVtZW50O1xuXG5cdFx0cGFyYW1ldGVycyA9IHBhcmFtZXRlcnMgfHwge307XG5cblx0XHRwYXJlbnQgPSBwYXJhbWV0ZXJzLnBhcmVudCAhPT0gdW5kZWZpbmVkID8gcGFyYW1ldGVycy5wYXJlbnQgOiBkb2N1bWVudC5ib2R5O1xuXHRcdGlkID0gcGFyYW1ldGVycy5pZCAhPT0gdW5kZWZpbmVkID8gcGFyYW1ldGVycy5pZCA6ICdvbGRpZSc7XG5cblx0XHRlbGVtZW50ID0gRGV0ZWN0b3IuZ2V0V2ViR0xFcnJvck1lc3NhZ2UoKTtcblx0XHRlbGVtZW50LmlkID0gaWQ7XG5cblx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQoIGVsZW1lbnQgKTtcblxuXHR9XG5cbn07XG5cbi8vRVM2IGV4cG9ydFxuXG5leHBvcnQgeyBEZXRlY3RvciB9O1xuIiwiLy9UaGlzIGxpYnJhcnkgaXMgZGVzaWduZWQgdG8gaGVscCBzdGFydCB0aHJlZS5qcyBlYXNpbHksIGNyZWF0aW5nIHRoZSByZW5kZXIgbG9vcCBhbmQgY2FudmFzIGF1dG9tYWdpY2FsbHkuXG4vL1JlYWxseSBpdCBzaG91bGQgYmUgc3B1biBvZmYgaW50byBpdHMgb3duIHRoaW5nIGluc3RlYWQgb2YgYmVpbmcgcGFydCBvZiBleHBsYW5hcmlhLlxuXG4vL2Fsc28sIGNoYW5nZSBUaHJlZWFzeV9FbnZpcm9ubWVudCB0byBUaHJlZWFzeV9SZWNvcmRlciB0byBkb3dubG9hZCBoaWdoLXF1YWxpdHkgZnJhbWVzIG9mIGFuIGFuaW1hdGlvblxuXG5pbXBvcnQgQ0NhcHR1cmUgZnJvbSAnY2NhcHR1cmUuanMnO1xuaW1wb3J0IHsgRGV0ZWN0b3IgfSBmcm9tICcuLi9saWIvV2ViR0xfRGV0ZWN0b3IuanMnO1xuaW1wb3J0IHsgc2V0VGhyZWVFbnZpcm9ubWVudCwgZ2V0VGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmZ1bmN0aW9uIFRocmVlYXN5RW52aXJvbm1lbnQoY2FudmFzRWxlbSA9IG51bGwpe1xuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSAwO1xuICAgIHRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzID0gKGNhbnZhc0VsZW0gPT09IG51bGwpO1xuXG5cdGlmKCFEZXRlY3Rvci53ZWJnbClEZXRlY3Rvci5hZGRHZXRXZWJHTE1lc3NhZ2UoKTtcblxuICAgIC8vZm92LCBhc3BlY3QsIG5lYXIsIGZhclxuXHR0aGlzLmNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYSggNzAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDEwMDAwMDAwICk7XG5cdC8vdGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuT3J0aG9ncmFwaGljQ2FtZXJhKCA3MCwgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDAuMSwgMTAgKTtcblxuXHR0aGlzLmNhbWVyYS5wb3NpdGlvbi5zZXQoMCwgMCwgMTApO1xuXHR0aGlzLmNhbWVyYS5sb29rQXQobmV3IFRIUkVFLlZlY3RvcjMoMCwwLDApKTtcblxuXG5cdC8vY3JlYXRlIGNhbWVyYSwgc2NlbmUsIHRpbWVyLCByZW5kZXJlciBvYmplY3RzXG5cdC8vY3JhZXRlIHJlbmRlciBvYmplY3RcblxuXG5cdFxuXHR0aGlzLnNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5cdHRoaXMuc2NlbmUuYWRkKHRoaXMuY2FtZXJhKTtcblxuXHQvL3JlbmRlcmVyXG5cdGxldCByZW5kZXJlck9wdGlvbnMgPSB7IGFudGlhbGlhczogdHJ1ZX07XG5cbiAgICBpZighdGhpcy5zaG91bGRDcmVhdGVDYW52YXMpe1xuICAgICAgICByZW5kZXJlck9wdGlvbnMuY2FudmFzID0gY2FudmFzRWxlbTtcbiAgICB9XG5cblx0dGhpcy5yZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKCByZW5kZXJlck9wdGlvbnMgKTtcblx0dGhpcy5yZW5kZXJlci5zZXRQaXhlbFJhdGlvKCB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldENsZWFyQ29sb3IobmV3IFRIUkVFLkNvbG9yKDB4RkZGRkZGKSwgMS4wKTtcblxuXG4gICAgdGhpcy5yZXNpemVDYW52YXNJZk5lY2Vzc2FyeSgpOyAvL3Jlc2l6ZSBjYW52YXMgdG8gd2luZG93IHNpemUgYW5kIHNldCBhc3BlY3QgcmF0aW9cblx0Lypcblx0dGhpcy5yZW5kZXJlci5nYW1tYUlucHV0ID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci5nYW1tYU91dHB1dCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIuc2hhZG93TWFwLmVuYWJsZWQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlO1xuXHQqL1xuXG5cdHRoaXMudGltZVNjYWxlID0gMTtcblx0dGhpcy5lbGFwc2VkVGltZSA9IDA7XG5cdHRoaXMudHJ1ZUVsYXBzZWRUaW1lID0gMDtcblxuICAgIGlmKHRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzKXtcblx0ICAgIHRoaXMuY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0ICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKCB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQgKTtcbiAgICB9XG5cblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCB0aGlzLm9uTW91c2VEb3duLmJpbmQodGhpcyksIGZhbHNlICk7XG5cdHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2V1cCcsIHRoaXMub25Nb3VzZVVwLmJpbmQodGhpcyksIGZhbHNlICk7XG5cdHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAndG91Y2hzdGFydCcsIHRoaXMub25Nb3VzZURvd24uYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaGVuZCcsIHRoaXMub25Nb3VzZVVwLmJpbmQodGhpcyksIGZhbHNlICk7XG5cblx0Lypcblx0Ly9yZW5kZXJlci52ci5lbmFibGVkID0gdHJ1ZTsgXG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cG9pbnRlcnJlc3RyaWN0ZWQnLCBvblBvaW50ZXJSZXN0cmljdGVkLCBmYWxzZSApO1xuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3ZyZGlzcGxheXBvaW50ZXJ1bnJlc3RyaWN0ZWQnLCBvblBvaW50ZXJVbnJlc3RyaWN0ZWQsIGZhbHNlICk7XG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIFdFQlZSLmNyZWF0ZUJ1dHRvbiggcmVuZGVyZXIgKSApO1xuXHQqL1xuXG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgdGhpcy5vblBhZ2VMb2FkLmJpbmQodGhpcyksIGZhbHNlKTtcblxuXHR0aGlzLmNsb2NrID0gbmV3IFRIUkVFLkNsb2NrKCk7XG5cblx0dGhpcy5JU19SRUNPUkRJTkcgPSBmYWxzZTsgLy8gcXVlcnlhYmxlIGlmIG9uZSB3YW50cyB0byBkbyB0aGluZ3MgbGlrZSBiZWVmIHVwIHBhcnRpY2xlIGNvdW50cyBmb3IgcmVuZGVyXG5cbiAgICBpZighdGhpcy5zaG91bGRDcmVhdGVDYW52YXMgJiYgY2FudmFzRWxlbS5vZmZzZXRXaWR0aCl7XG4gICAgICAgIC8vSWYgdGhlIGNhbnZhc0VsZW1lbnQgaXMgYWxyZWFkeSBsb2FkZWQsIHRoZW4gdGhlICdsb2FkJyBldmVudCBoYXMgYWxyZWFkeSBmaXJlZC4gV2UgbmVlZCB0byB0cmlnZ2VyIGl0IG91cnNlbHZlcy5cbiAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLm9uUGFnZUxvYWQuYmluZCh0aGlzKSk7XG4gICAgfVxufVxuXG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vblBhZ2VMb2FkID0gZnVuY3Rpb24oKSB7XG5cdGNvbnNvbGUubG9nKFwiVGhyZWVhc3lfU2V0dXAgbG9hZGVkIVwiKTtcblx0aWYodGhpcy5zaG91bGRDcmVhdGVDYW52YXMpe1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHRoaXMuY29udGFpbmVyICk7XG5cdH1cblxuXHR0aGlzLnN0YXJ0KCk7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCl7XG5cdHRoaXMucHJldl90aW1lc3RlcCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuXHR0aGlzLmNsb2NrLnN0YXJ0KCk7XG5cdHRoaXMucmVuZGVyKHRoaXMucHJldl90aW1lc3RlcCk7XG59XG5cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uTW91c2VEb3duID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuaXNNb3VzZURvd24gPSB0cnVlO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Nb3VzZVVwPSBmdW5jdGlvbigpIHtcblx0dGhpcy5pc01vdXNlRG93biA9IGZhbHNlO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Qb2ludGVyUmVzdHJpY3RlZD0gZnVuY3Rpb24oKSB7XG5cdHZhciBwb2ludGVyTG9ja0VsZW1lbnQgPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cdGlmICggcG9pbnRlckxvY2tFbGVtZW50ICYmIHR5cGVvZihwb2ludGVyTG9ja0VsZW1lbnQucmVxdWVzdFBvaW50ZXJMb2NrKSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRwb2ludGVyTG9ja0VsZW1lbnQucmVxdWVzdFBvaW50ZXJMb2NrKCk7XG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUG9pbnRlclVucmVzdHJpY3RlZD0gZnVuY3Rpb24oKSB7XG5cdHZhciBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ID0gZG9jdW1lbnQucG9pbnRlckxvY2tFbGVtZW50O1xuXHR2YXIgZXhwZWN0ZWRQb2ludGVyTG9ja0VsZW1lbnQgPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cdGlmICggY3VycmVudFBvaW50ZXJMb2NrRWxlbWVudCAmJiBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ID09PSBleHBlY3RlZFBvaW50ZXJMb2NrRWxlbWVudCAmJiB0eXBlb2YoZG9jdW1lbnQuZXhpdFBvaW50ZXJMb2NrKSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRkb2N1bWVudC5leGl0UG9pbnRlckxvY2soKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUuZXZlbmlmeSA9IGZ1bmN0aW9uKHgpe1xuXHRpZih4ICUgMiA9PSAxKXtcblx0XHRyZXR1cm4geCsxO1xuXHR9XG5cdHJldHVybiB4O1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVzaXplQ2FudmFzSWZOZWNlc3Nhcnk9IGZ1bmN0aW9uKCkge1xuICAgIC8vaHR0cHM6Ly93ZWJnbDJmdW5kYW1lbnRhbHMub3JnL3dlYmdsL2xlc3NvbnMvd2ViZ2wtYW50aS1wYXR0ZXJucy5odG1sIHllcywgZXZlcnkgZnJhbWUuXG4gICAgLy90aGlzIGhhbmRsZXMgdGhlIGVkZ2UgY2FzZSB3aGVyZSB0aGUgY2FudmFzIHNpemUgY2hhbmdlcyBidXQgdGhlIHdpbmRvdyBzaXplIGRvZXNuJ3RcblxuICAgIGxldCB3aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICAgIGxldCBoZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG4gICAgXG4gICAgaWYoIXRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzKXsgLy8gYSBjYW52YXMgd2FzIHByb3ZpZGVkIGV4dGVybmFsbHlcbiAgICAgICAgd2lkdGggPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuY2xpZW50V2lkdGg7XG4gICAgICAgIGhlaWdodCA9IHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5jbGllbnRIZWlnaHQ7XG4gICAgfVxuXG4gICAgaWYod2lkdGggIT0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50LndpZHRoIHx8IGhlaWdodCAhPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuaGVpZ2h0KXtcbiAgICAgICAgLy9jYW52YXMgZGltZW5zaW9ucyBjaGFuZ2VkLCB1cGRhdGUgdGhlIGludGVybmFsIHJlc29sdXRpb25cblxuXHQgICAgdGhpcy5jYW1lcmEuYXNwZWN0ID0gd2lkdGggLyBoZWlnaHQ7XG4gICAgICAgIC8vdGhpcy5jYW1lcmEuc2V0Rm9jYWxMZW5ndGgoMzApOyAvL2lmIEkgdXNlIHRoaXMsIHRoZSBjYW1lcmEgd2lsbCBrZWVwIGEgY29uc3RhbnQgd2lkdGggaW5zdGVhZCBvZiBjb25zdGFudCBoZWlnaHRcblx0ICAgIHRoaXMuYXNwZWN0ID0gdGhpcy5jYW1lcmEuYXNwZWN0O1xuXHQgICAgdGhpcy5jYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuXHQgICAgdGhpcy5yZW5kZXJlci5zZXRTaXplKCB0aGlzLmV2ZW5pZnkod2lkdGgpLCB0aGlzLmV2ZW5pZnkoaGVpZ2h0KSx0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyApO1xuICAgIH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLmxpc3RlbmVycyA9IHtcInVwZGF0ZVwiOiBbXSxcInJlbmRlclwiOltdfTsgLy91cGRhdGUgZXZlbnQgbGlzdGVuZXJzXG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbih0aW1lc3RlcCl7XG4gICAgdGhpcy5yZXNpemVDYW52YXNJZk5lY2Vzc2FyeSgpO1xuXG4gICAgdmFyIHJlYWx0aW1lRGVsdGEgPSB0aGlzLmNsb2NrLmdldERlbHRhKCk7XG5cdHZhciBkZWx0YSA9IHJlYWx0aW1lRGVsdGEqdGhpcy50aW1lU2NhbGU7XG5cdHRoaXMuZWxhcHNlZFRpbWUgKz0gZGVsdGE7XG4gICAgdGhpcy50cnVlRWxhcHNlZFRpbWUgKz0gcmVhbHRpbWVEZWx0YTtcblx0Ly9nZXQgdGltZXN0ZXBcblx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5sZW5ndGg7aSsrKXtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXVtpXSh7XCJ0XCI6dGhpcy5lbGFwc2VkVGltZSxcImRlbHRhXCI6ZGVsdGEsJ3JlYWx0aW1lRGVsdGEnOnJlYWx0aW1lRGVsdGF9KTtcblx0fVxuXG5cdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSApO1xuXG5cdGZvcih2YXIgaT0wO2k8dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0ubGVuZ3RoO2krKyl7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl1baV0oKTtcblx0fVxuXG5cdHRoaXMucHJldl90aW1lc3RlcCA9IHRpbWVzdGVwO1xuXHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub24gPSBmdW5jdGlvbihldmVudF9uYW1lLCBmdW5jKXtcblx0Ly9SZWdpc3RlcnMgYW4gZXZlbnQgbGlzdGVuZXIuXG5cdC8vZWFjaCBsaXN0ZW5lciB3aWxsIGJlIGNhbGxlZCB3aXRoIGFuIG9iamVjdCBjb25zaXN0aW5nIG9mOlxuXHQvL1x0e3Q6IDxjdXJyZW50IHRpbWUgaW4gcz4sIFwiZGVsdGFcIjogPGRlbHRhLCBpbiBtcz59XG5cdC8vIGFuIHVwZGF0ZSBldmVudCBmaXJlcyBiZWZvcmUgYSByZW5kZXIuIGEgcmVuZGVyIGV2ZW50IGZpcmVzIHBvc3QtcmVuZGVyLlxuXHRpZihldmVudF9uYW1lID09IFwidXBkYXRlXCIpeyBcblx0XHR0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5wdXNoKGZ1bmMpO1xuXHR9ZWxzZSBpZihldmVudF9uYW1lID09IFwicmVuZGVyXCIpeyBcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5wdXNoKGZ1bmMpO1xuXHR9ZWxzZXtcblx0XHRjb25zb2xlLmVycm9yKFwiSW52YWxpZCBldmVudCBuYW1lIVwiKVxuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnRfbmFtZSwgZnVuYyl7XG5cdC8vVW5yZWdpc3RlcnMgYW4gZXZlbnQgbGlzdGVuZXIsIHVuZG9pbmcgYW4gVGhyZWVhc3lfc2V0dXAub24oKSBldmVudCBsaXN0ZW5lci5cblx0Ly90aGUgbmFtaW5nIHNjaGVtZSBtaWdodCBub3QgYmUgdGhlIGJlc3QgaGVyZS5cblx0aWYoZXZlbnRfbmFtZSA9PSBcInVwZGF0ZVwiKXsgXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0uaW5kZXhPZihmdW5jKTtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5zcGxpY2UoaW5kZXgsMSk7XG5cdH0gZWxzZSBpZihldmVudF9uYW1lID09IFwicmVuZGVyXCIpeyBcblx0XHRsZXQgaW5kZXggPSB0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5pbmRleE9mKGZ1bmMpO1xuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLnNwbGljZShpbmRleCwxKTtcblx0fWVsc2V7XG5cdFx0Y29uc29sZS5lcnJvcihcIk5vbmV4aXN0ZW50IGV2ZW50IG5hbWUhXCIpXG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9mZiA9IFRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXI7IC8vYWxpYXMgdG8gbWF0Y2ggVGhyZWVhc3lFbnZpcm9ubWVudC5vblxuXG5jbGFzcyBUaHJlZWFzeVJlY29yZGVyIGV4dGVuZHMgVGhyZWVhc3lFbnZpcm9ubWVudHtcblx0Ly9iYXNlZCBvbiBodHRwOi8vd3d3LnR5c29uY2FkZW5oZWFkLmNvbS9ibG9nL2V4cG9ydGluZy1jYW52YXMtYW5pbWF0aW9uLXRvLW1vdi8gdG8gcmVjb3JkIGFuIGFuaW1hdGlvblxuXHQvL3doZW4gZG9uZSwgICAgIGZmbXBlZyAtciA2MCAtZnJhbWVyYXRlIDYwIC1pIC4vJTA3ZC5wbmcgLXZjb2RlYyBsaWJ4MjY0IC1waXhfZm10IHl1djQyMHAgLWNyZjp2IDAgdmlkZW8ubXA0XG4gICAgLy8gdG8gcGVyZm9ybSBtb3Rpb24gYmx1ciBvbiBhbiBvdmVyc2FtcGxlZCB2aWRlbywgZmZtcGVnIC1pIHZpZGVvLm1wNCAtdmYgdGJsZW5kPWFsbF9tb2RlPWF2ZXJhZ2UsZnJhbWVzdGVwPTIgdmlkZW8yLm1wNFxuXHQvL3RoZW4sIGFkZCB0aGUgeXV2NDIwcCBwaXhlbHMgKHdoaWNoIGZvciBzb21lIHJlYXNvbiBpc24ndCBkb25lIGJ5IHRoZSBwcmV2IGNvbW1hbmQpIGJ5OlxuXHQvLyBmZm1wZWcgLWkgdmlkZW8ubXA0IC12Y29kZWMgbGlieDI2NCAtcGl4X2ZtdCB5dXY0MjBwIC1zdHJpY3QgLTIgLWFjb2RlYyBhYWMgZmluaXNoZWRfdmlkZW8ubXA0XG5cdC8vY2hlY2sgd2l0aCBmZm1wZWcgLWkgZmluaXNoZWRfdmlkZW8ubXA0XG5cblx0Y29uc3RydWN0b3IoZnBzPTMwLCBsZW5ndGggPSA1LCBjYW52YXNFbGVtID0gbnVsbCl7XG5cdFx0LyogZnBzIGlzIGV2aWRlbnQsIGF1dG9zdGFydCBpcyBhIGJvb2xlYW4gKGJ5IGRlZmF1bHQsIHRydWUpLCBhbmQgbGVuZ3RoIGlzIGluIHMuKi9cblx0XHRzdXBlcihjYW52YXNFbGVtKTtcblx0XHR0aGlzLmZwcyA9IGZwcztcblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblx0XHR0aGlzLmZyYW1lQ291bnQgPSBmcHMgKiBsZW5ndGg7XG5cdFx0dGhpcy5mcmFtZXNfcmVuZGVyZWQgPSAwO1xuXG5cdFx0dGhpcy5jYXB0dXJlciA9IG5ldyBDQ2FwdHVyZSgge1xuXHRcdFx0ZnJhbWVyYXRlOiBmcHMsXG5cdFx0XHRmb3JtYXQ6ICdwbmcnLFxuXHRcdFx0bmFtZTogZG9jdW1lbnQudGl0bGUsXG5cdFx0XHQvL3ZlcmJvc2U6IHRydWUsXG5cdFx0fSApO1xuXG5cdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMuSVNfUkVDT1JESU5HID0gdHJ1ZTtcblx0fVxuXHRzdGFydCgpe1xuXHRcdC8vbWFrZSBhIHJlY29yZGluZyBzaWduXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS53aWR0aD1cIjIwcHhcIlxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuaGVpZ2h0PVwiMjBweFwiXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS50b3AgPSAnMjBweCc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5sZWZ0ID0gJzIwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JlZCc7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLnJlY29yZGluZ19pY29uKTtcblxuXHRcdHRoaXMuZnJhbWVDb3VudGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUudG9wID0gJzIwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmxlZnQgPSAnNTBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuY29sb3IgPSAnYmxhY2snO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSgyNTUsMjU1LDI1NSwwLjEpJztcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuZnJhbWVDb3VudGVyKTtcblxuXHRcdHRoaXMuY2FwdHVyZXIuc3RhcnQoKTtcblx0XHR0aGlzLnJlbmRlcmluZyA9IHRydWU7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXHRyZW5kZXIodGltZXN0ZXApe1xuICAgICAgICB2YXIgcmVhbHRpbWVEZWx0YSA9IDEvdGhpcy5mcHM7Ly9pZ25vcmluZyB0aGUgdHJ1ZSB0aW1lLCBjYWxjdWxhdGUgdGhlIGRlbHRhXG5cdFx0dmFyIGRlbHRhID0gcmVhbHRpbWVEZWx0YSp0aGlzLnRpbWVTY2FsZTsgXG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcbiAgICAgICAgdGhpcy50cnVlRWxhcHNlZFRpbWUgKz0gcmVhbHRpbWVEZWx0YTtcblxuXHRcdC8vZ2V0IHRpbWVzdGVwXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YSwgJ3JlYWx0aW1lRGVsdGEnOnJlYWx0aW1lRGVsdGF9KTtcblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlcmVyLnJlbmRlciggdGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEgKTtcblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXVtpXSgpO1xuXHRcdH1cblxuXG5cdFx0dGhpcy5yZWNvcmRfZnJhbWUoKTtcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4JztcblxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG5cdH1cblx0cmVjb3JkX2ZyYW1lKCl7XG5cdC8vXHRsZXQgY3VycmVudF9mcmFtZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2NhbnZhcycpLnRvRGF0YVVSTCgpO1xuXG5cdFx0dGhpcy5jYXB0dXJlci5jYXB0dXJlKCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYW52YXMnKSApO1xuXG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuaW5uZXJIVE1MID0gdGhpcy5mcmFtZXNfcmVuZGVyZWQgKyBcIiAvIFwiICsgdGhpcy5mcmFtZUNvdW50OyAvL3VwZGF0ZSB0aW1lclxuXG5cdFx0dGhpcy5mcmFtZXNfcmVuZGVyZWQrKztcblxuXG5cdFx0aWYodGhpcy5mcmFtZXNfcmVuZGVyZWQ+dGhpcy5mcmFtZUNvdW50KXtcblx0XHRcdHRoaXMucmVuZGVyID0gbnVsbDsgLy9oYWNreSB3YXkgb2Ygc3RvcHBpbmcgdGhlIHJlbmRlcmluZ1xuXHRcdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHQvL3RoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuXHRcdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblx0XHRcdHRoaXMuY2FwdHVyZXIuc3RvcCgpO1xuXHRcdFx0Ly8gZGVmYXVsdCBzYXZlLCB3aWxsIGRvd25sb2FkIGF1dG9tYXRpY2FsbHkgYSBmaWxlIGNhbGxlZCB7bmFtZX0uZXh0ZW5zaW9uICh3ZWJtL2dpZi90YXIpXG5cdFx0XHR0aGlzLmNhcHR1cmVyLnNhdmUoKTtcblx0XHR9XG5cdH1cblx0cmVzaXplQ2FudmFzSWZOZWNlc3NhcnkoKSB7XG5cdFx0Ly9zdG9wIHJlY29yZGluZyBpZiB3aW5kb3cgc2l6ZSBjaGFuZ2VzXG5cdFx0aWYodGhpcy5yZW5kZXJpbmcgJiYgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQgIT0gdGhpcy5hc3BlY3Qpe1xuXHRcdFx0dGhpcy5jYXB0dXJlci5zdG9wKCk7XG5cdFx0XHR0aGlzLnJlbmRlciA9IG51bGw7IC8vaGFja3kgd2F5IG9mIHN0b3BwaW5nIHRoZSByZW5kZXJpbmdcblx0XHRcdGFsZXJ0KFwiQWJvcnRpbmcgcmVjb3JkOiBXaW5kb3ctc2l6ZSBjaGFuZ2UgZGV0ZWN0ZWQhXCIpO1xuXHRcdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3VwZXIucmVzaXplQ2FudmFzSWZOZWNlc3NhcnkoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBzZXR1cFRocmVlKGZwcz0zMCwgbGVuZ3RoID0gNSwgY2FudmFzRWxlbSA9IG51bGwpe1xuXHQvKiBTZXQgdXAgdGhlIHRocmVlLmpzIGVudmlyb25tZW50LiBTd2l0Y2ggYmV0d2VlbiBjbGFzc2VzIGR5bmFtaWNhbGx5IHNvIHRoYXQgeW91IGNhbiByZWNvcmQgYnkgYXBwZW5kaW5nIFwiP3JlY29yZD10cnVlXCIgdG8gYW4gdXJsLiBUaGVuIEVYUC50aHJlZUVudmlyb25tZW50LmNhbWVyYSBhbmQgRVhQLnRocmVlRW52aXJvbm1lbnQuc2NlbmUgd29yaywgYXMgd2VsbCBhcyBFWFAudGhyZWVFbnZpcm9ubWVudC5vbignZXZlbnQgbmFtZScsIGNhbGxiYWNrKS4gT25seSBvbmUgZW52aXJvbm1lbnQgZXhpc3RzIGF0IGEgdGltZS5cblxuICAgIFRoZSByZXR1cm5lZCBvYmplY3QgaXMgYSBzaW5nbGV0b246IG11bHRpcGxlIGNhbGxzIHdpbGwgcmV0dXJuIHRoZSBzYW1lIG9iamVjdDogRVhQLnRocmVlRW52aXJvbm1lbnQuKi9cblx0dmFyIHJlY29yZGVyID0gbnVsbDtcblx0dmFyIGlzX3JlY29yZGluZyA9IGZhbHNlO1xuXG5cdC8vZXh0cmFjdCByZWNvcmQgcGFyYW1ldGVyIGZyb20gdXJsXG5cdHZhciBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKGRvY3VtZW50LmxvY2F0aW9uLnNlYXJjaCk7XG5cdGxldCByZWNvcmRTdHJpbmcgPSBwYXJhbXMuZ2V0KFwicmVjb3JkXCIpO1xuXG5cdGlmKHJlY29yZFN0cmluZyl7IC8vZGV0ZWN0IGlmIFVSTCBwYXJhbXMgaW5jbHVkZSA/cmVjb3JkPTEgb3IgP3JlY29yZD10cnVlXG4gICAgICAgIHJlY29yZFN0cmluZyA9IHJlY29yZFN0cmluZy50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpc19yZWNvcmRpbmcgPSAocmVjb3JkU3RyaW5nID09IFwidHJ1ZVwiIHx8IHJlY29yZFN0cmluZyA9PSBcIjFcIik7XG4gICAgfVxuXG4gICAgbGV0IHRocmVlRW52aXJvbm1lbnQgPSBnZXRUaHJlZUVudmlyb25tZW50KCk7XG4gICAgaWYodGhyZWVFbnZpcm9ubWVudCAhPT0gbnVsbCl7Ly9zaW5nbGV0b24gaGFzIGFscmVhZHkgYmVlbiBjcmVhdGVkXG4gICAgICAgIHJldHVybiB0aHJlZUVudmlyb25tZW50O1xuICAgIH1cblxuXHRpZihpc19yZWNvcmRpbmcpe1xuXHRcdHRocmVlRW52aXJvbm1lbnQgPSBuZXcgVGhyZWVhc3lSZWNvcmRlcihmcHMsIGxlbmd0aCwgY2FudmFzRWxlbSk7XG5cdH1lbHNle1xuXHRcdHRocmVlRW52aXJvbm1lbnQgPSBuZXcgVGhyZWVhc3lFbnZpcm9ubWVudChjYW52YXNFbGVtKTtcblx0fVxuICAgIHNldFRocmVlRW52aXJvbm1lbnQodGhyZWVFbnZpcm9ubWVudCk7XG4gICAgcmV0dXJuIHRocmVlRW52aXJvbm1lbnQ7XG59XG5cbmV4cG9ydCB7c2V0dXBUaHJlZSwgVGhyZWVhc3lFbnZpcm9ubWVudCwgVGhyZWVhc3lSZWNvcmRlcn1cbiIsImFzeW5jIGZ1bmN0aW9uIGRlbGF5KHdhaXRUaW1lKXtcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHR9KTtcblxufVxuXG5leHBvcnQge2RlbGF5fTtcbiIsIi8vTGluZU91dHB1dFNoYWRlcnMuanNcblxuLy9iYXNlZCBvbiBodHRwczovL21hdHRkZXNsLnN2YnRsZS5jb20vZHJhd2luZy1saW5lcy1pcy1oYXJkIGJ1dCB3aXRoIHNldmVyYWwgZXJyb3JzIGNvcnJlY3RlZCwgYmV2ZWwgc2hhZGluZyBhZGRlZCwgYW5kIG1vcmVcblxuY29uc3QgTElORV9KT0lOX1RZUEVTID0ge1wiTUlURVJcIjogMC4yLCBcIkJFVkVMXCI6MS4yLFwiUk9VTkRcIjoyLjJ9OyAvL0knZCB1c2UgMCwxLDIgYnV0IEpTIGRvZXNuJ3QgYWRkIGEgZGVjaW1hbCBwbGFjZSBhdCB0aGUgZW5kIHdoZW4gaW5zZXJ0aW5nIHRoZW0gaW4gYSBzdHJpbmcuIGN1cnNlZCBqdXN0aWZpY2F0aW9uXG5cbnZhciB2U2hhZGVyID0gW1xuXCJ1bmlmb3JtIGZsb2F0IGFzcGVjdDtcIiwgLy91c2VkIHRvIGNhbGlicmF0ZSBzY3JlZW4gc3BhY2VcblwidW5pZm9ybSBmbG9hdCBsaW5lV2lkdGg7XCIsIC8vd2lkdGggb2YgbGluZVxuXCJ1bmlmb3JtIGZsb2F0IGxpbmVKb2luVHlwZTtcIixcbi8vXCJhdHRyaWJ1dGUgdmVjMyBwb3NpdGlvbjtcIiwgLy9hZGRlZCBhdXRvbWF0aWNhbGx5IGJ5IHRocmVlLmpzXG5cImF0dHJpYnV0ZSB2ZWMzIG5leHRQb2ludFBvc2l0aW9uO1wiLFxuXCJhdHRyaWJ1dGUgdmVjMyBwcmV2aW91c1BvaW50UG9zaXRpb247XCIsXG5cImF0dHJpYnV0ZSBmbG9hdCBkaXJlY3Rpb247XCIsXG5cImF0dHJpYnV0ZSBmbG9hdCBhcHByb2FjaE5leHRPclByZXZWZXJ0ZXg7XCIsXG5cblwidmFyeWluZyBmbG9hdCBjcm9zc0xpbmVQb3NpdGlvbjtcIixcblwiYXR0cmlidXRlIHZlYzMgY29sb3I7XCIsXG5cInZhcnlpbmcgdmVjMyB2Q29sb3I7XCIsXG5cInZhcnlpbmcgdmVjMiBsaW5lU2VnbWVudEFDbGlwU3BhY2U7XCIsXG5cInZhcnlpbmcgdmVjMiBsaW5lU2VnbWVudEJDbGlwU3BhY2U7XCIsXG5cInZhcnlpbmcgZmxvYXQgdGhpY2tuZXNzO1wiLFxuXG5cblwidmFyeWluZyB2ZWMzIGRlYnVnSW5mbztcIixcblxuXCJ2ZWMzIGFuZ2xlX3RvX2h1ZShmbG9hdCBhbmdsZSkge1wiLCAvL2ZvciBkZWJ1Z2dpbmdcblwiICBhbmdsZSAvPSAzLjE0MTU5MioyLjtcIixcblwiICByZXR1cm4gY2xhbXAoKGFicyhmcmFjdChhbmdsZSt2ZWMzKDMuMCwgMi4wLCAxLjApLzMuMCkqNi4wLTMuMCktMS4wKSwgMC4wLCAxLjApO1wiLFxuXCJ9XCIsXG5cbi8vZ2l2ZW4gYW4gdW5pdCB2ZWN0b3IsIG1vdmUgZGlzdCB1bml0cyBwZXJwZW5kaWN1bGFyIHRvIGl0LlxuXCJ2ZWMyIG9mZnNldFBlcnBlbmRpY3VsYXJBbG9uZ1NjcmVlblNwYWNlKHZlYzIgZGlyLCBmbG9hdCB0d2ljZURpc3QpIHtcIixcbiAgXCJ2ZWMyIG5vcm1hbCA9IHZlYzIoLWRpci55LCBkaXIueCkgO1wiLFxuICBcIm5vcm1hbCAqPSB0d2ljZURpc3QvMi4wO1wiLFxuICBcIm5vcm1hbC54IC89IGFzcGVjdDtcIixcbiAgXCJyZXR1cm4gbm9ybWFsO1wiLFxuXCJ9XCIsXG5cblwidm9pZCBtYWluKCkge1wiLFxuXG4gIFwidmVjMiBhc3BlY3RWZWMgPSB2ZWMyKGFzcGVjdCwgMS4wKTtcIixcbiAgXCJtYXQ0IHByb2pWaWV3TW9kZWwgPSBwcm9qZWN0aW9uTWF0cml4ICpcIixcbiAgICAgICAgICAgIFwidmlld01hdHJpeCAqIG1vZGVsTWF0cml4O1wiLFxuICBcInZlYzQgcHJldmlvdXNQcm9qZWN0ZWQgPSBwcm9qVmlld01vZGVsICogdmVjNChwcmV2aW91c1BvaW50UG9zaXRpb24sIDEuMCk7XCIsXG4gIFwidmVjNCBjdXJyZW50UHJvamVjdGVkID0gcHJvalZpZXdNb2RlbCAqIHZlYzQocG9zaXRpb24sIDEuMCk7XCIsXG4gIFwidmVjNCBuZXh0UHJvamVjdGVkID0gcHJvalZpZXdNb2RlbCAqIHZlYzQobmV4dFBvaW50UG9zaXRpb24sIDEuMCk7XCIsXG5cblxuICAvL2dldCAyRCBzY3JlZW4gc3BhY2Ugd2l0aCBXIGRpdmlkZSBhbmQgYXNwZWN0IGNvcnJlY3Rpb25cbiAgXCJ2ZWMyIGN1cnJlbnRTY3JlZW4gPSBjdXJyZW50UHJvamVjdGVkLnh5IC8gY3VycmVudFByb2plY3RlZC53ICogYXNwZWN0VmVjO1wiLFxuICBcInZlYzIgcHJldmlvdXNTY3JlZW4gPSBwcmV2aW91c1Byb2plY3RlZC54eSAvIHByZXZpb3VzUHJvamVjdGVkLncgKiBhc3BlY3RWZWM7XCIsXG4gIFwidmVjMiBuZXh0U2NyZWVuID0gbmV4dFByb2plY3RlZC54eSAvIG5leHRQcm9qZWN0ZWQudyAqIGFzcGVjdFZlYztcIixcblxuICAvL1wiY2VudGVyUG9pbnRDbGlwU3BhY2VQb3NpdGlvbiA9IGN1cnJlbnRQcm9qZWN0ZWQueHkgLyBjdXJyZW50UHJvamVjdGVkLnc7XCIsLy9zZW5kIHRvIGZyYWdtZW50IHNoYWRlclxuICBcImNyb3NzTGluZVBvc2l0aW9uID0gZGlyZWN0aW9uO1wiLCAvL3NlbmQgZGlyZWN0aW9uIHRvIHRoZSBmcmFnbWVudCBzaGFkZXJcbiAgXCJ2Q29sb3IgPSBjb2xvcjtcIiwgLy9zZW5kIGRpcmVjdGlvbiB0byB0aGUgZnJhZ21lbnQgc2hhZGVyXG5cbiAgXCJ0aGlja25lc3MgPSBsaW5lV2lkdGggLyA0MDAuO1wiLCAvL1RPRE86IGNvbnZlcnQgbGluZVdpZHRoIHRvIHBpeGVsc1xuICBcImZsb2F0IG9yaWVudGF0aW9uID0gKGRpcmVjdGlvbi0wLjUpKjIuO1wiLFxuXG4gIC8vZ2V0IGRpcmVjdGlvbnMgZnJvbSAoQyAtIEIpIGFuZCAoQiAtIEEpXG4gIFwidmVjMiB2ZWNBID0gKGN1cnJlbnRTY3JlZW4gLSBwcmV2aW91c1NjcmVlbik7XCIsXG4gIFwidmVjMiB2ZWNCID0gKG5leHRTY3JlZW4gLSBjdXJyZW50U2NyZWVuKTtcIixcbiAgXCJ2ZWMyIGRpckEgPSBub3JtYWxpemUodmVjQSk7XCIsXG4gIFwidmVjMiBkaXJCID0gbm9ybWFsaXplKHZlY0IpO1wiLFxuXG4gIC8vREVCVUdcbiAgXCJsaW5lU2VnbWVudEFDbGlwU3BhY2UgPSBtaXgocHJldmlvdXNTY3JlZW4sY3VycmVudFNjcmVlbixhcHByb2FjaE5leHRPclByZXZWZXJ0ZXgpIC8gYXNwZWN0VmVjO1wiLC8vc2VuZCB0byBmcmFnbWVudCBzaGFkZXJcbiAgXCJsaW5lU2VnbWVudEJDbGlwU3BhY2UgPSBtaXgoY3VycmVudFNjcmVlbixuZXh0U2NyZWVuLGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleCkgLyBhc3BlY3RWZWM7XCIsLy9zZW5kIHRvIGZyYWdtZW50IHNoYWRlclxuXG4gIC8vc3RhcnRpbmcgcG9pbnQgdXNlcyAobmV4dCAtIGN1cnJlbnQpXG4gIFwidmVjMiBvZmZzZXQgPSB2ZWMyKDAuMCk7XCIsXG4gIFwiaWYgKGN1cnJlbnRTY3JlZW4gPT0gcHJldmlvdXNTY3JlZW4pIHtcIixcbiAgXCIgIG9mZnNldCA9IG9mZnNldFBlcnBlbmRpY3VsYXJBbG9uZ1NjcmVlblNwYWNlKGRpckIgKiBvcmllbnRhdGlvbiwgdGhpY2tuZXNzKTtcIixcbiAgLy9vZmZzZXQgKz0gZGlyQiAqIHRoaWNrbmVzczsgLy9lbmQgY2FwXG4gIFwifSBcIixcbiAgLy9lbmRpbmcgcG9pbnQgdXNlcyAoY3VycmVudCAtIHByZXZpb3VzKVxuICBcImVsc2UgaWYgKGN1cnJlbnRTY3JlZW4gPT0gbmV4dFNjcmVlbikge1wiLFxuICBcIiAgb2Zmc2V0ID0gb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UoZGlyQSAqIG9yaWVudGF0aW9uLCB0aGlja25lc3MpO1wiLFxuICAvL29mZnNldCArPSBkaXJBICogdGhpY2tuZXNzOyAvL2VuZCBjYXBcbiAgXCJ9XCIsXG4gIFwiLy9zb21ld2hlcmUgaW4gbWlkZGxlLCBuZWVkcyBhIGpvaW5cIixcbiAgXCJlbHNlIHtcIixcbiAgXCIgIGlmIChsaW5lSm9pblR5cGUgPT0gXCIrTElORV9KT0lOX1RZUEVTLk1JVEVSK1wiKSB7XCIsXG4gICAgICAgIC8vY29ybmVyIHR5cGU6IG1pdGVyLiBUaGlzIGlzIGJ1Z2d5ICh0aGVyZSdzIG5vIG1pdGVyIGxpbWl0IHlldCkgc28gZG9uJ3QgdXNlXG4gIFwiICAgIC8vbm93IGNvbXB1dGUgdGhlIG1pdGVyIGpvaW4gbm9ybWFsIGFuZCBsZW5ndGhcIixcbiAgXCIgICAgdmVjMiBtaXRlckRpcmVjdGlvbiA9IG5vcm1hbGl6ZShkaXJBICsgZGlyQik7XCIsXG4gIFwiICAgIHZlYzIgcHJldkxpbmVFeHRydWRlRGlyZWN0aW9uID0gdmVjMigtZGlyQS55LCBkaXJBLngpO1wiLFxuICBcIiAgICB2ZWMyIG1pdGVyID0gdmVjMigtbWl0ZXJEaXJlY3Rpb24ueSwgbWl0ZXJEaXJlY3Rpb24ueCk7XCIsXG4gIFwiICAgIGZsb2F0IGxlbiA9IHRoaWNrbmVzcyAvIChkb3QobWl0ZXIsIHByZXZMaW5lRXh0cnVkZURpcmVjdGlvbikrMC4wMDAxKTtcIiwgLy9jYWxjdWxhdGUuIGRvdCBwcm9kdWN0IGlzIGFsd2F5cyA+IDBcbiAgXCIgICAgb2Zmc2V0ID0gb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UobWl0ZXJEaXJlY3Rpb24gKiBvcmllbnRhdGlvbiwgbGVuKTtcIixcbiAgXCIgIH0gZWxzZSBpZiAobGluZUpvaW5UeXBlID09IFwiK0xJTkVfSk9JTl9UWVBFUy5CRVZFTCtcIil7XCIsXG4gICAgLy9jb3JuZXIgdHlwZTogYmV2ZWxcbiAgXCIgICAgdmVjMiBkaXIgPSBtaXgoZGlyQSwgZGlyQiwgYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4KTtcIixcbiAgXCIgICAgb2Zmc2V0ID0gb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UoZGlyICogb3JpZW50YXRpb24sIHRoaWNrbmVzcyk7XCIsXG4gIFwiICB9IGVsc2UgaWYgKGxpbmVKb2luVHlwZSA9PSBcIitMSU5FX0pPSU5fVFlQRVMuUk9VTkQrXCIpe1wiLFxuICAgIC8vY29ybmVyIHR5cGU6IHJvdW5kXG4gIFwiICAgIHZlYzIgZGlyID0gbWl4KGRpckEsIGRpckIsIGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleCk7XCIsXG4gIFwiICAgIHZlYzIgaGFsZlRoaWNrbmVzc1Bhc3RUaGVWZXJ0ZXggPSBkaXIqdGhpY2tuZXNzLzIuICogYXBwcm9hY2hOZXh0T3JQcmV2VmVydGV4IC8gYXNwZWN0VmVjO1wiLFxuICBcIiAgICBvZmZzZXQgPSBvZmZzZXRQZXJwZW5kaWN1bGFyQWxvbmdTY3JlZW5TcGFjZShkaXIgKiBvcmllbnRhdGlvbiwgdGhpY2tuZXNzKSAtIGhhbGZUaGlja25lc3NQYXN0VGhlVmVydGV4O1wiLCAvL2V4dGVuZCByZWN0cyBwYXN0IHRoZSB2ZXJ0ZXhcbiAgXCIgIH0gZWxzZSB7XCIsIC8vbm8gbGluZSBqb2luIHR5cGUgc3BlY2lmaWVkLCBqdXN0IGdvIGZvciB0aGUgcHJldmlvdXMgcG9pbnRcbiAgXCIgICAgb2Zmc2V0ID0gb2Zmc2V0UGVycGVuZGljdWxhckFsb25nU2NyZWVuU3BhY2UoZGlyQSwgdGhpY2tuZXNzKTtcIixcbiAgXCIgIH1cIixcbiAgXCJ9XCIsXG5cbiAgXCJkZWJ1Z0luZm8gPSB2ZWMzKGFwcHJvYWNoTmV4dE9yUHJldlZlcnRleCwgb3JpZW50YXRpb24sIDAuMCk7XCIsIC8vVE9ETzogcmVtb3ZlLiBpdCdzIGZvciBkZWJ1Z2dpbmcgY29sb3JzXG4gIFwiZ2xfUG9zaXRpb24gPSBjdXJyZW50UHJvamVjdGVkICsgdmVjNChvZmZzZXQsIDAuMCwwLjApICpjdXJyZW50UHJvamVjdGVkLnc7XCIsXG5cIn1cIl0uam9pbihcIlxcblwiKTtcblxudmFyIGZTaGFkZXIgPSBbXG5cInVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcIixcblwidW5pZm9ybSB2ZWMyIHNjcmVlblNpemU7XCIsXG5cInVuaWZvcm0gZmxvYXQgYXNwZWN0O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGxpbmVKb2luVHlwZTtcIixcblwidmFyeWluZyB2ZWMzIHZDb2xvcjtcIixcblwidmFyeWluZyB2ZWMzIGRlYnVnSW5mbztcIixcblwidmFyeWluZyB2ZWMyIGxpbmVTZWdtZW50QUNsaXBTcGFjZTtcIixcblwidmFyeWluZyB2ZWMyIGxpbmVTZWdtZW50QkNsaXBTcGFjZTtcIixcblwidmFyeWluZyBmbG9hdCBjcm9zc0xpbmVQb3NpdGlvbjtcIixcblwidmFyeWluZyBmbG9hdCB0aGlja25lc3M7XCIsXG5cbi8qIHVzZWZ1bCBmb3IgZGVidWdnaW5nISBmcm9tIGh0dHBzOi8vd3d3LnJvbmphLXR1dG9yaWFscy5jb20vMjAxOC8xMS8yNC9zZGYtc3BhY2UtbWFuaXB1bGF0aW9uLmh0bWxcblwidmVjMyByZW5kZXJMaW5lc091dHNpZGUoZmxvYXQgZGlzdCl7XCIsXG5cIiAgICBmbG9hdCBfTGluZURpc3RhbmNlID0gMC4zO1wiLFxuXCIgICAgZmxvYXQgX0xpbmVUaGlja25lc3MgPSAwLjA1O1wiLFxuXCIgICAgZmxvYXQgX1N1YkxpbmVUaGlja25lc3MgPSAwLjA1O1wiLFxuXCIgICAgZmxvYXQgX1N1YkxpbmVzID0gMS4wO1wiLFxuXCIgICAgdmVjMyBjb2wgPSBtaXgodmVjMygxLjAsMC4yLDAuMiksIHZlYzMoMC4wLDAuMiwxLjIpLCBzdGVwKDAuMCwgZGlzdCkpO1wiLFxuXG5cIiAgICBmbG9hdCBkaXN0YW5jZUNoYW5nZSA9IGZ3aWR0aChkaXN0KSAqIDAuNTtcIixcblwiICAgIGZsb2F0IG1ham9yTGluZURpc3RhbmNlID0gYWJzKGZyYWN0KGRpc3QgLyBfTGluZURpc3RhbmNlICsgMC41KSAtIDAuNSkgKiBfTGluZURpc3RhbmNlO1wiLFxuXCIgICAgZmxvYXQgbWFqb3JMaW5lcyA9IHNtb290aHN0ZXAoX0xpbmVUaGlja25lc3MgLSBkaXN0YW5jZUNoYW5nZSwgX0xpbmVUaGlja25lc3MgKyBkaXN0YW5jZUNoYW5nZSwgbWFqb3JMaW5lRGlzdGFuY2UpO1wiLFxuXG5cIiAgICBmbG9hdCBkaXN0YW5jZUJldHdlZW5TdWJMaW5lcyA9IF9MaW5lRGlzdGFuY2UgLyBfU3ViTGluZXM7XCIsXG5cIiAgICBmbG9hdCBzdWJMaW5lRGlzdGFuY2UgPSBhYnMoZnJhY3QoZGlzdCAvIGRpc3RhbmNlQmV0d2VlblN1YkxpbmVzICsgMC41KSAtIDAuNSkgKiBkaXN0YW5jZUJldHdlZW5TdWJMaW5lcztcIixcblwiICAgIGZsb2F0IHN1YkxpbmVzID0gc21vb3Roc3RlcChfU3ViTGluZVRoaWNrbmVzcyAtIGRpc3RhbmNlQ2hhbmdlLCBfU3ViTGluZVRoaWNrbmVzcyArIGRpc3RhbmNlQ2hhbmdlLCBzdWJMaW5lRGlzdGFuY2UpO1wiLFxuXG5cIiAgICByZXR1cm4gY29sICogbWFqb3JMaW5lcyAqIHN1YkxpbmVzO1wiLFxuXCJ9XCIsICovXG5cblxuXCJmbG9hdCBsaW5lU0RGKHZlYzIgcG9pbnQsIHZlYzIgbGluZVN0YXJ0UHQsdmVjMiBsaW5lRW5kUHQpIHtcIixcbiAgXCJmbG9hdCBoID0gY2xhbXAoZG90KHBvaW50LWxpbmVTdGFydFB0LGxpbmVFbmRQdC1saW5lU3RhcnRQdCkvZG90KGxpbmVFbmRQdC1saW5lU3RhcnRQdCxsaW5lRW5kUHQtbGluZVN0YXJ0UHQpLDAuMCwxLjApO1wiLFxuICBcInZlYzIgcHJvamVjdGVkVmVjID0gKHBvaW50LWxpbmVTdGFydFB0LShsaW5lRW5kUHQtbGluZVN0YXJ0UHQpKmgpO1wiLFxuICBcInJldHVybiBsZW5ndGgocHJvamVjdGVkVmVjKTtcIixcblwifVwiLFxuXG5cblwidm9pZCBtYWluKCl7XCIsXG5cIiAgdmVjMyBjb2wgPSB2Q29sb3IucmdiO1wiLFxuLy9cIiAgY29sID0gZGVidWdJbmZvLnJnYjtcIixcblwiICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGNvbCwgb3BhY2l0eSk7XCIsXG5cblwiICBpZiAobGluZUpvaW5UeXBlID09IFwiK0xJTkVfSk9JTl9UWVBFUy5ST1VORCtcIil7XCIsXG5cIiAgICAgIHZlYzIgdmVydFNjcmVlblNwYWNlUG9zaXRpb24gPSBnbF9GcmFnQ29vcmQueHk7XCIsIC8vZ29lcyBmcm9tIDAgdG8gc2NyZWVuU2l6ZS54eVxuXCIgICAgICB2ZWMyIGxpbmVQdEFTY3JlZW5TcGFjZSA9IChsaW5lU2VnbWVudEFDbGlwU3BhY2UrMS4pLzIuICogc2NyZWVuU2l6ZTtcIiwgLy9jb252ZXJ0IFstMSwxXSB0byBbMCwxXSwgdGhlbiAqc2NyZWVuU2l6ZVxuXCIgICAgICB2ZWMyIGxpbmVQdEJTY3JlZW5TcGFjZSA9IChsaW5lU2VnbWVudEJDbGlwU3BhY2UrMS4pLzIuICogc2NyZWVuU2l6ZTtcIixcblwiICAgICAgZmxvYXQgZGlzdEZyb21MaW5lID0gbGluZVNERih2ZXJ0U2NyZWVuU3BhY2VQb3NpdGlvbiwgbGluZVB0QVNjcmVlblNwYWNlLGxpbmVQdEJTY3JlZW5TcGFjZSk7XCIsXG5cIiAgICAgIGZsb2F0IHNkZiA9IDEuLSgxLi90aGlja25lc3MgL3NjcmVlblNpemUueSAqIDQuMCAqZGlzdEZyb21MaW5lKTtcIixcblwiICAgICAgZmxvYXQgc2RmT3BhY2l0eSA9IGNsYW1wKHNkZiAvIChhYnMoZEZkeChzZGYpKSArIGFicyhkRmR5KHNkZikpKSwwLjAsMS4wKTtcIixcbi8vXCIgICAgICBpZihvcGFjaXR5ICogc2RmT3BhY2l0eSA8IDAuMSlkaXNjYXJkO1wiLFxuXCIgICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGNvbCwgb3BhY2l0eSAqIHNkZk9wYWNpdHkgKTtcIixcblwiICB9XCIsXG5cIn1cIl0uam9pbihcIlxcblwiKVxuXG52YXIgdW5pZm9ybXMgPSB7XG5cdGxpbmVXaWR0aDoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMS4wLCAvL2N1cnJlbnRseSBpbiB1bml0cyBvZiB5SGVpZ2h0KjQwMFxuXHR9LFxuXHRzY3JlZW5TaXplOiB7XG5cdFx0dmFsdWU6IG5ldyBUSFJFRS5WZWN0b3IyKCAxLCAxICksXG5cdH0sXG5cdGxpbmVKb2luVHlwZToge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogTElORV9KT0lOX1RZUEVTLlJPVU5ELFxuXHR9LFxuXHRvcGFjaXR5OiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAxLjAsXG5cdH0sXG5cdGFzcGVjdDogeyAvL2FzcGVjdCByYXRpby4gbmVlZCB0byBsb2FkIGZyb20gcmVuZGVyZXJcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCxcblx0fVxufTtcblxuZXhwb3J0IHsgdlNoYWRlciwgZlNoYWRlciwgdW5pZm9ybXMsIExJTkVfSk9JTl9UWVBFUyB9O1xuIiwiaW1wb3J0IHtPdXRwdXROb2RlfSBmcm9tICcuLi9Ob2RlLmpzJztcbmltcG9ydCB7IGdldFRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuLi9UaHJlZUVudmlyb25tZW50LmpzJztcbmltcG9ydCB7IHZTaGFkZXIsIGZTaGFkZXIsIHVuaWZvcm1zLCBMSU5FX0pPSU5fVFlQRVMgfSBmcm9tICcuL0xpbmVPdXRwdXRTaGFkZXJzLmpzJztcblxuY2xhc3MgTGluZU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29yay5cbiAgICAgICAgQ3Jpc3AgbGluZXMgdXNpbmcgdGhlIHRlY2huaXF1ZSBpbiBodHRwczovL21hdHRkZXNsLnN2YnRsZS5jb20vZHJhd2luZy1saW5lcy1pcy1oYXJkLCBidXQgYWxzbyBzdXBwb3J0aW5nIG1pdGVyZWQgbGluZXMgYW5kIGJldmVsZWQgbGluZXMgdG9vIVxuICAgICAgICAgICAgb3B0aW9uczpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB3aWR0aDogbnVtYmVyLiB1bml0cyBhcmUgaW4gc2NyZWVuWS80MDAuXG4gICAgICAgICAgICAgICAgb3BhY2l0eTogbnVtYmVyXG4gICAgICAgICAgICAgICAgY29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcbiAgICAgICAgICAgICAgICBsaW5lSm9pbjogXCJiZXZlbFwiIG9yIFwicm91bmRcIi4gZGVmYXVsdDogcm91bmQuIERvbid0IGNoYW5nZSB0aGlzIGFmdGVyIGluaXRpYWxpemF0aW9uLlxuICAgICAgICAgICAgfVxuICAgICAgICAqL1xuXG4gICAgICAgIHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDU7XG4gICAgICAgIHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG4gICAgICAgIHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuY29sb3IpIDogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KTtcblxuICAgICAgICB0aGlzLmxpbmVKb2luVHlwZSA9IG9wdGlvbnMubGluZUpvaW5UeXBlICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmxpbmVKb2luVHlwZS50b1VwcGVyQ2FzZSgpIDogXCJCRVZFTFwiO1xuICAgICAgICBpZihMSU5FX0pPSU5fVFlQRVNbdGhpcy5saW5lSm9pblR5cGVdID09PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgdGhpcy5saW5lSm9pblR5cGUgPSBcIkJFVkVMXCI7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IDA7IC8vc2hvdWxkIGFsd2F5cyBiZSBlcXVhbCB0byB0aGlzLnBvaW50cy5sZW5ndGhcbiAgICAgICAgdGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBob3cgbWFueSB0aW1lcyB0byBiZSBjYWxsZWQgaW4gZWFjaCBkaXJlY3Rpb25cbiAgICAgICAgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDM7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/XG5cbiAgICAgICAgdGhpcy5pbml0KCk7XG4gICAgfVxuICAgIGluaXQoKXtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcbiAgICAgICAgdGhpcy5fdmVydGljZXM7XG4gICAgICAgIHRoaXMubWFrZUdlb21ldHJ5KCk7XG5cblxuICAgICAgICAvL21ha2UgYSBkZWVwIGNvcHkgb2YgdGhlIHVuaWZvcm1zIHRlbXBsYXRlXG4gICAgICAgIHRoaXMuX3VuaWZvcm1zID0ge307XG4gICAgICAgIGZvcih2YXIgdW5pZm9ybU5hbWUgaW4gdW5pZm9ybXMpe1xuICAgICAgICAgICAgdGhpcy5fdW5pZm9ybXNbdW5pZm9ybU5hbWVdID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IHVuaWZvcm1zW3VuaWZvcm1OYW1lXS50eXBlLFxuICAgICAgICAgICAgICAgIHZhbHVlOiB1bmlmb3Jtc1t1bmlmb3JtTmFtZV0udmFsdWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuU2hhZGVyTWF0ZXJpYWwoe1xuICAgICAgICAgICAgc2lkZTogVEhSRUUuQmFja1NpZGUsXG4gICAgICAgICAgICB2ZXJ0ZXhTaGFkZXI6IHZTaGFkZXIsIFxuICAgICAgICAgICAgZnJhZ21lbnRTaGFkZXI6IGZTaGFkZXIsXG4gICAgICAgICAgICB1bmlmb3JtczogdGhpcy5fdW5pZm9ybXMsXG4gICAgICAgICAgICBleHRlbnNpb25zOntkZXJpdmF0aXZlczogdHJ1ZSx9LFxuICAgICAgICAgICAgYWxwaGFUZXN0OiAwLjUsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMubWVzaCA9IG5ldyBUSFJFRS5NZXNoKHRoaXMuX2dlb21ldHJ5LHRoaXMubWF0ZXJpYWwpO1xuXG4gICAgICAgIHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vIHNldHRlciBzZXRzIHRyYW5zcGFyZW50IGZsYWcgaWYgbmVjZXNzYXJ5XG4gICAgICAgIHRoaXMuY29sb3IgPSB0aGlzLl9jb2xvcjsgLy9zZXR0ZXIgc2V0cyBjb2xvciBhdHRyaWJ1dGVcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMub3BhY2l0eS52YWx1ZSA9IHRoaXMuX29wYWNpdHk7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLmxpbmVXaWR0aC52YWx1ZSA9IHRoaXMuX3dpZHRoO1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5saW5lSm9pblR5cGUudmFsdWUgPSBMSU5FX0pPSU5fVFlQRVNbdGhpcy5saW5lSm9pblR5cGVdO1xuXG4gICAgICAgIGdldFRocmVlRW52aXJvbm1lbnQoKS5zY2VuZS5hZGQodGhpcy5tZXNoKTtcbiAgICB9XG5cbiAgICBtYWtlR2VvbWV0cnkoKXtcbiAgICAgICAgY29uc3QgTUFYX1BPSU5UUyA9IDEwMDA7IC8vdGhlc2UgYXJyYXlzIGdldCBkaXNjYXJkZWQgb24gZmlyc3QgYWN0aXZhdGlvbiBhbnl3YXlzXG4gICAgICAgIGNvbnN0IE5VTV9QT0lOVFNfUEVSX1ZFUlRFWCA9IDQ7XG5cbiAgICAgICAgbGV0IG51bVZlcnRzID0gKE1BWF9QT0lOVFMtMSkqTlVNX1BPSU5UU19QRVJfVkVSVEVYO1xuXG4gICAgICAgIHRoaXMuX3ZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl9vdXRwdXREaW1lbnNpb25zICogbnVtVmVydHMpO1xuICAgICAgICB0aGlzLl9uZXh0UG9pbnRWZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIG51bVZlcnRzKTtcbiAgICAgICAgdGhpcy5fcHJldlBvaW50VmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIHRoaXMuX2NvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkobnVtVmVydHMgKiAzKTtcblxuICAgICAgICAvLyBidWlsZCBnZW9tZXRyeVxuXG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnbmV4dFBvaW50UG9zaXRpb24nLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fbmV4dFBvaW50VmVydGljZXMsIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKSApO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdwcmV2aW91c1BvaW50UG9zaXRpb24nLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fcHJldlBvaW50VmVydGljZXMsIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKSApO1xuICAgICAgICB0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdjb2xvcicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl9jb2xvcnMsIDMgKSApO1xuXG4gICAgICAgIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy91c2VkIGR1cmluZyB1cGRhdGVzIGFzIGEgcG9pbnRlciB0byB0aGUgYnVmZmVyXG4gICAgICAgIHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblxuICAgIH1cbiAgICBfb25BZGQoKXtcbiAgICAgICAgLy9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIERvbWFpbiBub2RlIHdlJ3JlIHJlbmRlcmluZyBmcm9tXG4gICAgICAgIGxldCByb290ID0gbnVsbDtcbiAgICAgICAgdHJ5e1xuICAgICAgICAgICByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG4gICAgICAgIH1jYXRjaChlcnJvcil7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIC8vdG9kbzogaW1wbGVtZW50IHNvbWV0aGluZyBsaWtlIGFzc2VydCByb290IHR5cGVvZiBSb290Tm9kZVxuXG4gICAgICAgIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG4gICAgICAgIHRoaXMuaXRlbURpbWVuc2lvbnMgPSByb290Lml0ZW1EaW1lbnNpb25zO1xuICAgIH1cbiAgICBfb25GaXJzdEFjdGl2YXRpb24oKXtcbiAgICAgICAgdGhpcy5fb25BZGQoKTsgLy9zZXR1cCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiBhbmQgdGhpcy5pdGVtRGltZW5zaW9ucy4gdXNlZCBoZXJlIGFnYWluIGJlY2F1c2UgY2xvbmluZyBtZWFucyB0aGUgb25BZGQoKSBtaWdodCBiZSBjYWxsZWQgYmVmb3JlIHRoaXMgaXMgY29ubmVjdGVkIHRvIGEgdHlwZSBvZiBkb21haW5cblxuICAgICAgICAvLyBwZXJoYXBzIGluc3RlYWQgb2YgZ2VuZXJhdGluZyBhIHdob2xlIG5ldyBhcnJheSwgdGhpcyBjYW4gcmV1c2UgdGhlIG9sZCBvbmU/XG5cbiAgICAgICAgY29uc3QgTlVNX1BPSU5UU19QRVJfTElORV9TRUdNRU5UID0gNDsgLy80IHVzZWQgZm9yIGJldmVsaW5nXG4gICAgICAgIGNvbnN0IG51bVZlcnRzID0gKHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uKSAqIE5VTV9QT0lOVFNfUEVSX0xJTkVfU0VHTUVOVDtcblxuICAgICAgICBsZXQgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICogbnVtVmVydHMpO1xuICAgICAgICBsZXQgbmV4dFZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSggdGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIG51bVZlcnRzKTtcbiAgICAgICAgbGV0IHByZXZWZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiBudW1WZXJ0cyk7XG4gICAgICAgIGxldCBjb2xvcnMgPSBuZXcgRmxvYXQzMkFycmF5KCAzICogbnVtVmVydHMpO1xuXG4gICAgICAgIGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG4gICAgICAgIHRoaXMuX3ZlcnRpY2VzID0gdmVydGljZXM7XG4gICAgICAgIHBvc2l0aW9uQXR0cmlidXRlLnNldEFycmF5KHRoaXMuX3ZlcnRpY2VzKTtcblxuICAgICAgICBsZXQgcHJldlBvaW50UG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnByZXZpb3VzUG9pbnRQb3NpdGlvbjtcbiAgICAgICAgdGhpcy5fcHJldlBvaW50VmVydGljZXMgPSBwcmV2VmVydGljZXM7XG4gICAgICAgIHByZXZQb2ludFBvc2l0aW9uQXR0cmlidXRlLnNldEFycmF5KHRoaXMuX3ByZXZQb2ludFZlcnRpY2VzKTtcblxuICAgICAgICBsZXQgbmV4dFBvaW50UG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5leHRQb2ludFBvc2l0aW9uO1xuICAgICAgICB0aGlzLl9uZXh0UG9pbnRWZXJ0aWNlcyA9IG5leHRWZXJ0aWNlcztcbiAgICAgICAgbmV4dFBvaW50UG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fbmV4dFBvaW50VmVydGljZXMpO1xuXG4gICAgICAgIGxldCBjb2xvckF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMuY29sb3I7XG4gICAgICAgIHRoaXMuX2NvbG9ycyA9IGNvbG9ycztcbiAgICAgICAgY29sb3JBdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fY29sb3JzKTtcblxuICAgICAgICAvL3VzZWQgdG8gZGlmZmVyZW50aWF0ZSB0aGUgbGVmdCBib3JkZXIgb2YgdGhlIGxpbmUgZnJvbSB0aGUgcmlnaHQgYm9yZGVyXG4gICAgICAgIGxldCBkaXJlY3Rpb24gPSBuZXcgRmxvYXQzMkFycmF5KG51bVZlcnRzKTtcbiAgICAgICAgZm9yKGxldCBpPTA7IGk8bnVtVmVydHM7aSsrKXtcbiAgICAgICAgICAgIGRpcmVjdGlvbltpXSA9IGklMj09MCA/IDEgOiAwOyAvL2FsdGVybmF0ZSAtMSBhbmQgMVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ2RpcmVjdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCBkaXJlY3Rpb24sIDEpICk7XG5cbiAgICAgICAgLy91c2VkIHRvIGRpZmZlcmVudGlhdGUgdGhlIHBvaW50cyB3aGljaCBtb3ZlIHRvd2FyZHMgcHJldiB2ZXJ0ZXggZnJvbSBwb2ludHMgd2hpY2ggbW92ZSB0b3dhcmRzIG5leHQgdmVydGV4XG4gICAgICAgIGxldCBuZXh0T3JQcmV2ID0gbmV3IEZsb2F0MzJBcnJheShudW1WZXJ0cyk7XG4gICAgICAgIGZvcihsZXQgaT0wOyBpPG51bVZlcnRzO2krKyl7XG4gICAgICAgICAgICBuZXh0T3JQcmV2W2ldID0gaSU0PDIgPyAwIDogMTsgLy9hbHRlcm5hdGUgMCwwLCAxLDFcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdhcHByb2FjaE5leHRPclByZXZWZXJ0ZXgnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggbmV4dE9yUHJldiwgMSkgKTtcblxuICAgICAgICAvL2luZGljZXNcbiAgICAgICAgLypcbiAgICAgICAgRm9yIGVhY2ggdmVydGV4LCB3ZSBjb25uZWN0IGl0IHRvIHRoZSBuZXh0IHZlcnRleCBsaWtlIHRoaXM6XG4gICAgICAgIG4gLS1uKzItLW4rNC0tbis2XG4gICAgICAgIHwgIC8gIHwgLyB8ICAvICB8XG4gICAgICAgbisxIC0tbiszLS1uKzUtLW4rN1xuXG4gICAgICAgcHQxICAgcHQyIHB0MiAgIHB0M1xuXG4gICAgICAgdmVydGljZXMgbixuKzEgYXJlIGFyb3VuZCBwb2ludCAxLCBuKzIsbiszLG4rNCxuKzUgYXJlIGFyb3VuZCBwdDIsIG4rNixuKzcgYXJlIGZvciBwb2ludDMuIHRoZSBtaWRkbGUgc2VnbWVudCAobisyLW4rNSkgaXMgdGhlIHBvbHlnb24gdXNlZCBmb3IgYmV2ZWxpbmcgYXQgcG9pbnQgMi5cblxuICAgICAgICB0aGVuIHdlIGFkdmFuY2UgbiB0d28gYXQgYSB0aW1lIHRvIG1vdmUgdG8gdGhlIG5leHQgdmVydGV4LiB2ZXJ0aWNlcyBuLCBuKzEgcmVwcmVzZW50IHRoZSBzYW1lIHBvaW50O1xuICAgICAgICB0aGV5J3JlIHNlcGFyYXRlZCBpbiB0aGUgdmVydGV4IHNoYWRlciB0byBhIGNvbnN0YW50IHNjcmVlbnNwYWNlIHdpZHRoICovXG4gICAgICAgIGxldCBpbmRpY2VzID0gW107XG4gICAgICAgIGZvcihsZXQgdmVydE51bT0wO3ZlcnROdW08KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLTEpO3ZlcnROdW0gKz0xKXsgLy9ub3Qgc3VyZSB3aHkgdGhpcyAtMyBpcyB0aGVyZS4gaSBndWVzcyBpdCBzdG9wcyB2ZXJ0TnVtKzMgdHdvIGxpbmVzIGRvd24gZnJvbSBnb2luZyBzb21ld2hlcmUgaXQgc2hvdWxkbid0P1xuICAgICAgICAgICAgbGV0IGZpcnN0Q29vcmRpbmF0ZSA9IHZlcnROdW0gJSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdO1xuICAgICAgICAgICAgbGV0IGVuZGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xO1xuICAgIFxuICAgICAgICAgICAgbGV0IHZlcnRJbmRleCA9IHZlcnROdW0gKiBOVU1fUE9JTlRTX1BFUl9MSU5FX1NFR01FTlQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmKCFlbmRpbmdOZXdMaW5lKXtcbiAgICAgICAgICAgICAgICAvL3RoZXNlIHRyaWFuZ2xlcyBzaG91bGQgYmUgZGlzYWJsZWQgd2hlbiBkb2luZyByb3VuZCBqb2luc1xuICAgICAgICAgICAgICAgIGlmKHRoaXMubGluZUpvaW5UeXBlID09IFwiQkVWRUxcIil7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCggdmVydEluZGV4KzEsIHZlcnRJbmRleCwgICB2ZXJ0SW5kZXgrMik7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMucHVzaCggdmVydEluZGV4KzEsIHZlcnRJbmRleCsyLCB2ZXJ0SW5kZXgrMyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKCB2ZXJ0SW5kZXgrMywgdmVydEluZGV4KzIsIHZlcnRJbmRleCs0KTtcbiAgICAgICAgICAgICAgICBpbmRpY2VzLnB1c2goIHZlcnRJbmRleCszLCB2ZXJ0SW5kZXgrNCwgdmVydEluZGV4KzUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2dlb21ldHJ5LnNldEluZGV4KCBpbmRpY2VzICk7XG5cbiAgICAgICAgdGhpcy5zZXRBbGxWZXJ0aWNlc1RvQ29sb3IodGhpcy5jb2xvcik7XG5cbiAgICAgICAgcG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgICBjb2xvckF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgfVxuICAgIGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcbiAgICAgICAgaWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuICAgICAgICAgICAgdGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpOyAgICBcbiAgICAgICAgfVxuXG4gICAgICAgIC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblxuICAgICAgICAvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuICAgICAgICBsZXQgeFZhbHVlID0gIHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuICAgICAgICBsZXQgeVZhbHVlID0gIHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuICAgICAgICBsZXQgelZhbHVlID0gIHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXG4gICAgICAgIHRoaXMuc2F2ZVZlcnRleEluZm9JbkJ1ZmZlcnModGhpcy5fdmVydGljZXMsIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LCB4VmFsdWUseVZhbHVlLHpWYWx1ZSk7XG5cbiAgICAgICAgLyogd2UncmUgZHJhd2luZyBsaWtlIHRoaXM6XG4gICAgICAgICotLS0tKi0tLS0qXG5cbiAgICAgICAgKi0tLS0qLS0tLSpcbiAgICBcbiAgICAgICAgYnV0IHdlIGRvbid0IHdhbnQgdG8gaW5zZXJ0IGEgZGlhZ29uYWwgbGluZSBhbnl3aGVyZS4gVGhpcyBoYW5kbGVzIHRoYXQ6ICAqL1xuXG4gICAgICAgIGxldCBmaXJzdENvb3JkaW5hdGUgPSBpICUgdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXTtcblxuICAgICAgICAvL2Jvb2xlYW4gdmFyaWFibGVzLiBpZiBpbiB0aGUgZnV0dXJlIExpbmVPdXRwdXQgY2FuIHN1cHBvcnQgdmFyaWFibGUtd2lkdGggbGluZXMsIHRoZXNlIHNob3VsZCBlYiBjaGFuZ2VkXG4gICAgICAgIGxldCBzdGFydGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gMDtcbiAgICAgICAgbGV0IGVuZGluZ05ld0xpbmUgPSBmaXJzdENvb3JkaW5hdGUgPT0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xO1xuXG4gICAgICAgIGlmKHN0YXJ0aW5nTmV3TGluZSl7XG4gICAgICAgICAgICAvL21ha2UgdGhlIHByZXZQb2ludCBiZSB0aGUgc2FtZSBwb2ludCBhcyB0aGlzXG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX3ByZXZQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCwgeFZhbHVlLHlWYWx1ZSx6VmFsdWUpO1xuICAgICAgICB9ZWxzZXtcblxuICAgICAgICAgICAgbGV0IHByZXZYID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTEpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNF07XG4gICAgICAgICAgICBsZXQgcHJldlkgPSB0aGlzLl92ZXJ0aWNlc1sodGhpcy5fY3VycmVudFBvaW50SW5kZXgtMSkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucyo0KzFdO1xuICAgICAgICAgICAgbGV0IHByZXZaID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTEpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNCsyXTtcblxuICAgICAgICAgICAgLy9zZXQgdGhpcyB0aGluZydzIHByZXZQb2ludCB0byB0aGUgcHJldmlvdXMgdmVydGV4XG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX3ByZXZQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCwgcHJldlgscHJldlkscHJldlopO1xuXG4gICAgICAgICAgICAvL3NldCB0aGUgUFJFVklPVVMgcG9pbnQncyBuZXh0UG9pbnQgdG8gdG8gVEhJUyB2ZXJ0ZXguXG4gICAgICAgICAgICB0aGlzLnNhdmVWZXJ0ZXhJbmZvSW5CdWZmZXJzKHRoaXMuX25leHRQb2ludFZlcnRpY2VzLCB0aGlzLl9jdXJyZW50UG9pbnRJbmRleC0xLCB4VmFsdWUseVZhbHVlLHpWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihlbmRpbmdOZXdMaW5lKXtcbiAgICAgICAgICAgIC8vbWFrZSB0aGUgbmV4dFBvaW50IGJlIHRoZSBzYW1lIHBvaW50IGFzIHRoaXNcbiAgICAgICAgICAgIHRoaXMuc2F2ZVZlcnRleEluZm9JbkJ1ZmZlcnModGhpcy5fbmV4dFBvaW50VmVydGljZXMsIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LCB4VmFsdWUseVZhbHVlLHpWYWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcbiAgICB9XG5cbiAgICBzYXZlVmVydGV4SW5mb0luQnVmZmVycyhhcnJheSwgdmVydE51bSwgdmFsdWUxLHZhbHVlMix2YWx1ZTMpe1xuICAgICAgICAvL2ZvciBldmVyeSBjYWxsIHRvIGFjdGl2YXRlKCksIGFsbCA0IGdlb21ldHJ5IHZlcnRpY2VzIHJlcHJlc2VudGluZyB0aGF0IHBvaW50IG5lZWQgdG8gc2F2ZSB0aGF0IGluZm8uXG4gICAgICAgIC8vVGhlcmVmb3JlLCB0aGlzIGZ1bmN0aW9uIHdpbGwgc3ByZWFkIHRocmVlIGNvb3JkaW5hdGVzIGludG8gYSBnaXZlbiBhcnJheSwgcmVwZWF0ZWRseS5cblxuICAgICAgICBsZXQgaW5kZXggPSB2ZXJ0TnVtKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNDtcblxuICAgICAgICBhcnJheVtpbmRleF0gICA9IHZhbHVlMVxuICAgICAgICBhcnJheVtpbmRleCsxXSA9IHZhbHVlMlxuICAgICAgICBhcnJheVtpbmRleCsyXSA9IHZhbHVlM1xuXG4gICAgICAgIGFycmF5W2luZGV4KzNdID0gdmFsdWUxXG4gICAgICAgIGFycmF5W2luZGV4KzRdID0gdmFsdWUyXG4gICAgICAgIGFycmF5W2luZGV4KzVdID0gdmFsdWUzXG5cbiAgICAgICAgYXJyYXlbaW5kZXgrNl0gPSB2YWx1ZTFcbiAgICAgICAgYXJyYXlbaW5kZXgrN10gPSB2YWx1ZTJcbiAgICAgICAgYXJyYXlbaW5kZXgrOF0gPSB2YWx1ZTNcblxuICAgICAgICBhcnJheVtpbmRleCs5XSAgPSB2YWx1ZTFcbiAgICAgICAgYXJyYXlbaW5kZXgrMTBdID0gdmFsdWUyXG4gICAgICAgIGFycmF5W2luZGV4KzExXSA9IHZhbHVlM1xuICAgICAgICBcbiAgICB9XG4gICAgb25BZnRlckFjdGl2YXRpb24oKXtcbiAgICAgICAgbGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcbiAgICAgICAgcG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgICBsZXQgcHJldlBvaW50UG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnByZXZpb3VzUG9pbnRQb3NpdGlvbjtcbiAgICAgICAgcHJldlBvaW50UG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgICBsZXQgbmV4dFBvaW50UG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5leHRQb2ludFBvc2l0aW9uO1xuICAgICAgICBuZXh0UG9pbnRQb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cbiAgICAgICAgLy91cGRhdGUgYXNwZWN0IHJhdGlvLiBpbiB0aGUgZnV0dXJlIHBlcmhhcHMgdGhpcyBzaG91bGQgb25seSBiZSBjaGFuZ2VkIHdoZW4gdGhlIGFzcGVjdCByYXRpbyBjaGFuZ2VzIHNvIGl0J3Mgbm90IGJlaW5nIGRvbmUgcGVyIGZyYW1lP1xuICAgICAgICBpZih0aGlzLl91bmlmb3Jtcyl7XG4gICAgICAgICAgICBjb25zdCB0aHJlZSA9IGdldFRocmVlRW52aXJvbm1lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3VuaWZvcm1zLmFzcGVjdC52YWx1ZSA9IHRocmVlLmNhbWVyYS5hc3BlY3Q7IC8vVE9ETzogcmUtZW5hYmxlIG9uY2UgZGVidWdnaW5nIGlzIGRvbmVcbiAgICAgICAgICAgIHRocmVlLnJlbmRlcmVyLmdldERyYXdpbmdCdWZmZXJTaXplKHRoaXMuX3VuaWZvcm1zLnNjcmVlblNpemUudmFsdWUpOyAvL21vZGlmaWVzIHVuaWZvcm0gaW4gcGxhY2VcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy9yZXNldCBhZnRlciBlYWNoIHVwZGF0ZVxuICAgIH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG4gICAgICAgIGdldFRocmVlRW52aXJvbm1lbnQoKS5zY2VuZS5yZW1vdmUodGhpcy5tZXNoKTtcbiAgICB9XG4gICAgc2V0QWxsVmVydGljZXNUb0NvbG9yKGNvbG9yKXtcbiAgICAgICAgY29uc3QgY29sID0gbmV3IFRIUkVFLkNvbG9yKGNvbG9yKTtcbiAgICAgICAgY29uc3QgbnVtVmVydGljZXMgPSAodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24tMSkqMjtcbiAgICAgICAgZm9yKGxldCBpPTA7IGk8bnVtVmVydGljZXM7aSsrKXtcbiAgICAgICAgICAgIC8vRG9uJ3QgZm9yZ2V0IHNvbWUgcG9pbnRzIGFwcGVhciB0d2ljZSAtIGFzIHRoZSBlbmQgb2Ygb25lIGxpbmUgc2VnbWVudCBhbmQgdGhlIGJlZ2lubmluZyBvZiB0aGUgbmV4dC5cbiAgICAgICAgICAgIHRoaXMuX3NldENvbG9yRm9yVmVydGV4UkdCKGksIGNvbC5yLCBjb2wuZywgY29sLmIpO1xuICAgICAgICB9XG4gICAgICAgIC8vdGVsbCB0aHJlZS5qcyB0byB1cGRhdGUgY29sb3JzXG4gICAgfVxuICAgIF9zZXRDb2xvckZvclZlcnRleCh2ZXJ0ZXhJbmRleCwgY29sb3Ipe1xuICAgICAgICAvL2NvbG9yIGlzIGEgVEhSRUUuQ29sb3IgaGVyZVxuICAgICAgICB0aGlzLl9zZXRDb2xvckZvclZlcnRleFJHQih2ZXJ0ZXhJbmRleCwgY29sb3IuciwgY29sb3IuZywgY29sb3IuYik7XG4gICAgfVxuICAgIF9zZXRDb2xvckZvclZlcnRleFJHQih2ZXJ0ZXhJbmRleCwgbm9ybWFsaXplZFIsIG5vcm1hbGl6ZWRHLCBub3JtYWxpemVkQil7XG4gICAgICAgIC8vYWxsIG9mIG5vcm1hbGl6ZWRSLCBub3JtYWxpemVkRywgbm9ybWFsaXplZEIgYXJlIDAtMS5cbiAgICAgICAgbGV0IGNvbG9yQXJyYXkgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLmNvbG9yLmFycmF5O1xuICAgICAgICBsZXQgaW5kZXggPSB2ZXJ0ZXhJbmRleCAqIDMgKiA0OyAvLyozIGJlY2F1c2UgY29sb3JzIGhhdmUgMyBjaGFubmVscywgKjQgYmVjYXVzZSA0IHZlcnRpY2VzL2xpbmUgcG9pbnRcblxuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgMF0gPSBub3JtYWxpemVkUjtcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDFdID0gbm9ybWFsaXplZEc7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAyXSA9IG5vcm1hbGl6ZWRCO1xuXG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyAzXSA9IG5vcm1hbGl6ZWRSO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgNF0gPSBub3JtYWxpemVkRztcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDVdID0gbm9ybWFsaXplZEI7XG5cbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDZdID0gbm9ybWFsaXplZFI7XG4gICAgICAgIGNvbG9yQXJyYXlbaW5kZXggKyA3XSA9IG5vcm1hbGl6ZWRHO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgOF0gPSBub3JtYWxpemVkQjtcblxuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgOV0gPSBub3JtYWxpemVkUjtcbiAgICAgICAgY29sb3JBcnJheVtpbmRleCArIDEwXSA9IG5vcm1hbGl6ZWRHO1xuICAgICAgICBjb2xvckFycmF5W2luZGV4ICsgMTFdID0gbm9ybWFsaXplZEI7XG5cbiAgICAgICAgbGV0IGNvbG9yQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvcjtcbiAgICAgICAgY29sb3JBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgIH1cbiAgICBzZXQgY29sb3IoY29sb3Ipe1xuICAgICAgICAvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cbiAgICAgICAgLy9JIHNob3VsZCByZWFsbHkgbWFrZSBpdCBwb3NzaWJsZSB0byBzcGVjaWZ5IGNvbG9yIGJ5IGEgZnVuY3Rpb24uXG4gICAgICAgIHRoaXMuX2NvbG9yID0gY29sb3I7XG4gICAgICAgIHRoaXMuc2V0QWxsVmVydGljZXNUb0NvbG9yKGNvbG9yKTtcbiAgICB9XG4gICAgZ2V0IGNvbG9yKCl7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvcjtcbiAgICB9XG4gICAgc2V0IG9wYWNpdHkob3BhY2l0eSl7XG4gICAgICAgIC8vbWVzaCBpcyBhbHdheXMgdHJhbnNwYXJlbnRcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxIHx8IHRoaXMubGluZUpvaW5UeXBlID09IFwiUk9VTkRcIjtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG4gICAgICAgIHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gb3BhY2l0eTtcbiAgICB9XG4gICAgZ2V0IG9wYWNpdHkoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29wYWNpdHk7XG4gICAgfVxuICAgIHNldCB3aWR0aCh3aWR0aCl7XG4gICAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLmxpbmVXaWR0aC52YWx1ZSA9IHdpZHRoO1xuICAgIH1cbiAgICBnZXQgd2lkdGgoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dpZHRoO1xuICAgIH1cbiAgICBjbG9uZSgpe1xuICAgICAgICByZXR1cm4gbmV3IExpbmVPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5LCBsaW5lSm9pblR5cGU6IHRoaXMubGluZUpvaW5UeXBlfSk7XG4gICAgfVxufVxuXG5leHBvcnQge0xpbmVPdXRwdXR9O1xuIiwiaW1wb3J0IHtPdXRwdXROb2RlfSBmcm9tICcuLi9Ob2RlLmpzJztcbmltcG9ydCB7IHRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxuY2xhc3MgUG9pbnRPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lypcblx0XHRcdHdpZHRoOiBudW1iZXJcblx0XHRcdGNvbG9yOiBoZXggY29sb3IsIGFzIGluIDB4cnJnZ2JiLiBUZWNobmljYWxseSwgdGhpcyBpcyBhIEpTIGludGVnZXIuXG5cdFx0XHRvcGFjaXR5OiAwLTEuIE9wdGlvbmFsLlxuXHRcdCovXG5cblx0XHR0aGlzLl93aWR0aCA9IG9wdGlvbnMud2lkdGggIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMud2lkdGggOiAxO1xuXHRcdHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuY29sb3IpIDogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KTtcblx0XHR0aGlzLl9vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm9wYWNpdHkgOiAxO1xuXG5cdFx0dGhpcy5wb2ludHMgPSBbXTtcblxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtjb2xvcjogdGhpcy5fY29sb3J9KTtcbiAgICAgICAgdGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy90cmlnZ2VyIHNldHRlciB0byBzZXQgdGhpcy5tYXRlcmlhbCdzIG9wYWNpdHkgcHJvcGVybHlcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuXHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblx0fVxuXHRfb25BZGQoKXsgLy9zaG91bGQgYmUgY2FsbGVkIHdoZW4gdGhpcyBpcyAuYWRkKCllZCB0byBzb21ldGhpbmdcblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgQXJlYVxuXHRcdGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pe1xuXHRcdFx0Zm9yKHZhciBpPXRoaXMucG9pbnRzLmxlbmd0aDtpPHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO2krKyl7XG5cdFx0XHRcdHRoaXMucG9pbnRzLnB1c2gobmV3IFBvaW50TWVzaCh7d2lkdGg6IDEsbWF0ZXJpYWw6dGhpcy5tYXRlcmlhbH0pKTtcblx0XHRcdFx0dGhpcy5wb2ludHNbaV0ubWVzaC5zY2FsZS5zZXRTY2FsYXIodGhpcy5fd2lkdGgpOyAvL3NldCB3aWR0aCBieSBzY2FsaW5nIHBvaW50XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuXHRcdGlmKHRoaXMucG9pbnRzLmxlbmd0aCA8IHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uKXRoaXMuX29uQWRkKCk7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope1xuXHRcdGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcblx0XHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTtcdFxuXHRcdH1cblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cdFx0dmFyIHBvaW50ID0gdGhpcy5nZXRQb2ludChpKTtcblx0XHRwb2ludC54ID0geCA9PT0gdW5kZWZpbmVkID8gMCA6IHg7XG5cdFx0cG9pbnQueSA9IHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuXHRcdHBvaW50LnogPSB6ID09PSB1bmRlZmluZWQgPyAwIDogejtcblx0fVxuXHRnZXRQb2ludChpKXtcblx0XHRyZXR1cm4gdGhpcy5wb2ludHNbaV07XG5cdH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnBvaW50cy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMucG9pbnRzW2ldLnJlbW92ZVNlbGZGcm9tU2NlbmUoKTtcblx0XHR9XG4gICAgfVxuXHRzZXQgb3BhY2l0eShvcGFjaXR5KXtcblx0XHQvL3RlY2huaWNhbGx5IHRoaXMgc2V0cyBhbGwgcG9pbnRzIHRvIHRoZSBzYW1lIGNvbG9yLiBUb2RvOiBhbGxvdyBkaWZmZXJlbnQgcG9pbnRzIHRvIGJlIGRpZmZlcmVudGx5IGNvbG9yZWQuXG5cdFx0XG5cdFx0bGV0IG1hdCA9IHRoaXMubWF0ZXJpYWw7XG5cdFx0bWF0Lm9wYWNpdHkgPSBvcGFjaXR5OyAvL2luc3RhbnRpYXRlIHRoZSBwb2ludFxuXHRcdG1hdC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuICAgICAgICBtYXQudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuXHR9XG5cdGdldCBvcGFjaXR5KCl7XG5cdFx0cmV0dXJuIHRoaXMuX29wYWNpdHk7XG5cdH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC5jb2xvciA9IGNvbG9yO1xuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdH1cblx0Z2V0IGNvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbG9yO1xuXHR9XG5cdHNldCB3aWR0aCh3aWR0aCl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnBvaW50cy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuZ2V0UG9pbnQoaSkubWVzaC5zY2FsZS5zZXRTY2FsYXIod2lkdGgpO1xuXHRcdH1cblx0XHR0aGlzLl93aWR0aCA9IHdpZHRoO1xuXHR9XG5cdGdldCB3aWR0aCgpe1xuXHRcdHJldHVybiB0aGlzLl93aWR0aDtcblx0fVxuXHRjbG9uZSgpe1xuXHRcdHJldHVybiBuZXcgUG9pbnRPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuXG5jbGFzcyBQb2ludE1lc2h7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdC8qb3B0aW9uczpcblx0XHRcdHgseTogbnVtYmVyc1xuXHRcdFx0d2lkdGg6IG51bWJlclxuICAgICAgICAgICAgbWF0ZXJpYWw6IFxuXHRcdCovXG5cblx0XHRsZXQgd2lkdGggPSBvcHRpb25zLndpZHRoID09PSB1bmRlZmluZWQgPyAxIDogb3B0aW9ucy53aWR0aFxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gb3B0aW9ucy5tYXRlcmlhbDsgLy9vbmUgbWF0ZXJpYWwgcGVyIFBvaW50T3V0cHV0XG5cblx0XHR0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTWVzaCh0aGlzLnNoYXJlZENpcmNsZUdlb21ldHJ5LHRoaXMubWF0ZXJpYWwpO1xuXG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnNldCh0aGlzLngsdGhpcy55LHRoaXMueik7XG5cdFx0dGhpcy5tZXNoLnNjYWxlLnNldFNjYWxhcih0aGlzLndpZHRoLzIpO1xuXHRcdHRocmVlRW52aXJvbm1lbnQuc2NlbmUuYWRkKHRoaXMubWVzaCk7XG5cblx0XHR0aGlzLnggPSBvcHRpb25zLnggfHwgMDtcblx0XHR0aGlzLnkgPSBvcHRpb25zLnkgfHwgMDtcblx0XHR0aGlzLnogPSBvcHRpb25zLnogfHwgMDtcblx0fVxuXHRyZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG5cdFx0dGhyZWVFbnZpcm9ubWVudC5zY2VuZS5yZW1vdmUodGhpcy5tZXNoKTtcblx0fVxuXHRzZXQgeChpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueCA9IGk7XG5cdH1cblx0c2V0IHkoaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnkgPSBpO1xuXHR9XG5cdHNldCB6KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi56ID0gaTtcblx0fVxuXHRnZXQgeCgpe1xuXHRcdHJldHVybiB0aGlzLm1lc2gucG9zaXRpb24ueDtcblx0fVxuXHRnZXQgeSgpe1xuXHRcdHJldHVybiB0aGlzLm1lc2gucG9zaXRpb24ueTtcblx0fVxuXHRnZXQgeigpe1xuXHRcdHJldHVybiB0aGlzLm1lc2gucG9zaXRpb24uejtcblx0fVxufVxuUG9pbnRNZXNoLnByb3RvdHlwZS5zaGFyZWRDaXJjbGVHZW9tZXRyeSA9IG5ldyBUSFJFRS5TcGhlcmVHZW9tZXRyeSgxLzIsIDgsIDYpOyAvL3JhZGl1cyAxLzIgbWFrZXMgZGlhbWV0ZXIgMSwgc28gdGhhdCBzY2FsaW5nIGJ5IG4gbWVhbnMgd2lkdGg9blxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdFBvaW50KCl7XG5cdHZhciB4ID0gbmV3IEVYUC5BcmVhKHtib3VuZHM6IFtbLTEwLDEwXV19KTtcblx0dmFyIHkgPSBuZXcgRVhQLlRyYW5zZm9ybWF0aW9uKHsnZXhwcic6ICh4KSA9PiB4Knh9KTtcblx0dmFyIHkgPSBuZXcgRVhQLlBvaW50T3V0cHV0KCk7XG5cdHguYWRkKHkpO1xuXHR5LmFkZCh6KTtcblx0eC5hY3RpdmF0ZSgpO1xufVxuXG5leHBvcnQge1BvaW50T3V0cHV0LCBQb2ludE1lc2h9XG4iLCJpbXBvcnQgeyBMaW5lT3V0cHV0IH0gZnJvbSAnLi9MaW5lT3V0cHV0LmpzJztcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi4vdXRpbHMuanMnO1xuaW1wb3J0IHsgdGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4uL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5leHBvcnQgY2xhc3MgVmVjdG9yT3V0cHV0IGV4dGVuZHMgTGluZU91dHB1dHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuICAgICAgICAvKlxuICAgICAgICAgICAgICAgIHdpZHRoOiBudW1iZXIuIHVuaXRzIGFyZSBpbiBzY3JlZW5ZLzQwMC5cbiAgICAgICAgICAgICAgICBvcGFjaXR5OiBudW1iZXJcbiAgICAgICAgICAgICAgICBjb2xvcjogaGV4IGNvZGUgb3IgVEhSRUUuQ29sb3IoKVxuICAgICAgICAgICAgICAgIGxpbmVKb2luOiBcImJldmVsXCIgb3IgXCJyb3VuZFwiLiBkZWZhdWx0OiByb3VuZC4gRG9uJ3QgY2hhbmdlIHRoaXMgYWZ0ZXIgaW5pdGlhbGl6YXRpb24uXG4gICAgICAgICovXG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgfVxuICAgIGluaXQoKXtcbiAgICAgICAgdGhpcy5hcnJvd01hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtjb2xvcjogdGhpcy5fY29sb3IsIGxpbmV3aWR0aDogdGhpcy5fd2lkdGgsIG9wYWNpdHk6dGhpcy5fb3BhY2l0eX0pO1xuXG4gICAgICAgIHN1cGVyLmluaXQoKTtcbiAgICAgICAgdGhpcy5hcnJvd2hlYWRzID0gW107XG5cbiAgICAgICAgLy9UT0RPOiBtYWtlIHRoZSBhcnJvdyB0aXAgY29sb3JzIG1hdGNoIHRoZSBjb2xvcnMgb2YgdGhlIGxpbmVzJyB0aXBzXG5cbiAgICAgICAgY29uc3QgY2lyY2xlUmVzb2x1dGlvbiA9IDEyO1xuICAgICAgICBjb25zdCBhcnJvd2hlYWRTaXplID0gMC4zO1xuICAgICAgICBjb25zdCBFUFNJTE9OID0gMC4wMDAwMTtcbiAgICAgICAgdGhpcy5FUFNJTE9OID0gRVBTSUxPTjtcblxuICAgICAgICB0aGlzLmNvbmVHZW9tZXRyeSA9IG5ldyBUSFJFRS5DeWxpbmRlckJ1ZmZlckdlb21ldHJ5KCAwLCBhcnJvd2hlYWRTaXplLCBhcnJvd2hlYWRTaXplKjEuNywgY2lyY2xlUmVzb2x1dGlvbiwgMSApO1xuICAgICAgICBsZXQgYXJyb3doZWFkT3ZlcnNob290RmFjdG9yID0gMC4xOyAvL3VzZWQgc28gdGhhdCB0aGUgbGluZSB3b24ndCBydWRlbHkgY2xpcCB0aHJvdWdoIHRoZSBwb2ludCBvZiB0aGUgYXJyb3doZWFkXG4gICAgICAgIHRoaXMuY29uZUdlb21ldHJ5LnRyYW5zbGF0ZSggMCwgLSBhcnJvd2hlYWRTaXplICsgYXJyb3doZWFkT3ZlcnNob290RmFjdG9yLCAwICk7XG4gICAgICAgIHRoaXMuX2NvbmVVcERpcmVjdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsMSwwKTtcbiAgICB9XG4gICAgX29uRmlyc3RBY3RpdmF0aW9uKCl7XG4gICAgICAgIHN1cGVyLl9vbkZpcnN0QWN0aXZhdGlvbigpO1xuXG4gICAgICAgIGlmKHRoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoID4gMSl7XG4gICAgICAgICAgICB0aGlzLm51bUFycm93aGVhZHMgPSB0aGlzLml0ZW1EaW1lbnNpb25zLnNsaWNlKDAsdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMSkucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cnJlbnQpe1xuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyZW50ICsgcHJldjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIC8vYXNzdW1lZCBpdGVtRGltZW5zaW9ucyBpc24ndCBhIG5vbnplcm8gYXJyYXkuIFRoYXQgc2hvdWxkIGJlIHRoZSBjb25zdHJ1Y3RvcidzIHByb2JsZW0uXG4gICAgICAgICAgICB0aGlzLm51bUFycm93aGVhZHMgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9yZW1vdmUgYW55IHByZXZpb3VzIGFycm93aGVhZHNcbiAgICAgICAgZm9yKHZhciBpPTA7aTx0aGlzLmFycm93aGVhZHMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICBsZXQgYXJyb3cgPSB0aGlzLmFycm93aGVhZHNbaV07XG4gICAgICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZShhcnJvdyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmFycm93aGVhZHMgPSBuZXcgQXJyYXkodGhpcy5udW1BcnJvd2hlYWRzKTtcbiAgICAgICAgZm9yKHZhciBpPTA7aTx0aGlzLm51bUFycm93aGVhZHM7aSsrKXtcbiAgICAgICAgICAgIHRoaXMuYXJyb3doZWFkc1tpXSA9IG5ldyBUSFJFRS5NZXNoKHRoaXMuY29uZUdlb21ldHJ5LCB0aGlzLmFycm93TWF0ZXJpYWwpO1xuICAgICAgICAgICAgdGhpcy5tZXNoLmFkZCh0aGlzLmFycm93aGVhZHNbaV0pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUubG9nKFwibnVtYmVyIG9mIGFycm93aGVhZHMgKD0gbnVtYmVyIG9mIGxpbmVzKTpcIisgdGhpcy5udW1BcnJvd2hlYWRzKTtcbiAgICB9XG4gICAgZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope1xuICAgICAgICAvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG4gICAgICAgIHN1cGVyLmV2YWx1YXRlU2VsZihpLHQseCx5LHopO1xuXG4gICAgICAgIGNvbnN0IGxhc3REaW1lbnNpb25MZW5ndGggPSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdO1xuICAgICAgICBsZXQgZmlyc3RDb29yZGluYXRlID0gaSAlIGxhc3REaW1lbnNpb25MZW5ndGg7XG5cbiAgICAgICAgLy9ib29sZWFuIHZhcmlhYmxlcy4gaWYgaW4gdGhlIGZ1dHVyZSBMaW5lT3V0cHV0IGNhbiBzdXBwb3J0IHZhcmlhYmxlLXdpZHRoIGxpbmVzLCB0aGVzZSBzaG91bGQgZWIgY2hhbmdlZFxuICAgICAgICBsZXQgc3RhcnRpbmdOZXdMaW5lID0gZmlyc3RDb29yZGluYXRlID09IDA7XG4gICAgICAgIGxldCBlbmRpbmdOZXdMaW5lID0gZmlyc3RDb29yZGluYXRlID09IGxhc3REaW1lbnNpb25MZW5ndGgtMTtcblxuICAgICAgICBpZihlbmRpbmdOZXdMaW5lKXtcbiAgICAgICAgICAgIC8vd2UgbmVlZCB0byB1cGRhdGUgYXJyb3dzXG4gICAgICAgICAgICAvL2NhbGN1bGF0ZSBkaXJlY3Rpb24gb2YgbGFzdCBsaW5lIHNlZ21lbnRcbiAgICAgICAgICAgIC8vdGhpcyBwb2ludCBpcyBjdXJyZW50UG9pbnRJbmRleC0xIGJlY2F1c2UgY3VycmVudFBvaW50SW5kZXggd2FzIGluY3JlYXNlZCBieSAxIGR1cmluZyBzdXBlci5ldmFsdWF0ZVNlbGYoKVxuICAgICAgICAgICAgbGV0IGluZGV4ID0gKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTEpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNDtcblxuICAgICAgICAgICAgbGV0IHByZXZYID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTIpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNF07XG4gICAgICAgICAgICBsZXQgcHJldlkgPSB0aGlzLl92ZXJ0aWNlc1sodGhpcy5fY3VycmVudFBvaW50SW5kZXgtMikqdGhpcy5fb3V0cHV0RGltZW5zaW9ucyo0KzFdO1xuICAgICAgICAgICAgbGV0IHByZXZaID0gdGhpcy5fdmVydGljZXNbKHRoaXMuX2N1cnJlbnRQb2ludEluZGV4LTIpKnRoaXMuX291dHB1dERpbWVuc2lvbnMqNCsyXTtcblxuICAgICAgICAgICAgbGV0IGR4ID0gcHJldlggLSB0aGlzLl92ZXJ0aWNlc1tpbmRleF07XG4gICAgICAgICAgICBsZXQgZHkgPSBwcmV2WSAtIHRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdO1xuICAgICAgICAgICAgbGV0IGR6ID0gcHJldlogLSB0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXTtcblxuICAgICAgICAgICAgbGV0IGxpbmVOdW1iZXIgPSBNYXRoLmZsb29yKGkgLyBsYXN0RGltZW5zaW9uTGVuZ3RoKTtcbiAgICAgICAgICAgIFV0aWxzLmFzc2VydChsaW5lTnVtYmVyIDw9IHRoaXMubnVtQXJyb3doZWFkcyk7IC8vdGhpcyBtYXkgYmUgd3JvbmdcblxuICAgICAgICAgICAgbGV0IGRpcmVjdGlvblZlY3RvciA9IG5ldyBUSFJFRS5WZWN0b3IzKC1keCwtZHksLWR6KTtcblxuICAgICAgICAgICAgLy9NYWtlIGFycm93cyBkaXNhcHBlYXIgaWYgdGhlIGxpbmUgaXMgc21hbGwgZW5vdWdoXG4gICAgICAgICAgICAvL09uZSB3YXkgdG8gZG8gdGhpcyB3b3VsZCBiZSB0byBzdW0gdGhlIGRpc3RhbmNlcyBvZiBhbGwgbGluZSBzZWdtZW50cy4gSSdtIGNoZWF0aW5nIGhlcmUgYW5kIGp1c3QgbWVhc3VyaW5nIHRoZSBkaXN0YW5jZSBvZiB0aGUgbGFzdCB2ZWN0b3IsIHRoZW4gbXVsdGlwbHlpbmcgYnkgdGhlIG51bWJlciBvZiBsaW5lIHNlZ21lbnRzIChuYWl2ZWx5IGFzc3VtaW5nIGFsbCBsaW5lIHNlZ21lbnRzIGFyZSB0aGUgc2FtZSBsZW5ndGgpXG4gICAgICAgICAgICBsZXQgbGVuZ3RoID0gZGlyZWN0aW9uVmVjdG9yLmxlbmd0aCgpICogKGxhc3REaW1lbnNpb25MZW5ndGgtMSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGVmZmVjdGl2ZURpc3RhbmNlID0gMztcbiAgICAgICAgICAgIGxldCBjbGFtcGVkTGVuZ3RoID0gTWF0aC5tYXgoMCwgTWF0aC5taW4obGVuZ3RoL2VmZmVjdGl2ZURpc3RhbmNlLCAxKSk7XG5cbiAgICAgICAgICAgIC8vc2hyaW5rIGZ1bmN0aW9uIGRlc2lnbmVkIHRvIGhhdmUgYSBzdGVlcCBzbG9wZSBjbG9zZSB0byAwIGJ1dCBtZWxsb3cgb3V0IGF0IDAuNSBvciBzbyBpbiBvcmRlciB0byBhdm9pZCB0aGUgbGluZSB3aWR0aCBvdmVyY29taW5nIHRoZSBhcnJvd2hlYWQgd2lkdGhcbiAgICAgICAgICAgIC8vSW4gQ2hyb21lLCB0aHJlZS5qcyBjb21wbGFpbnMgd2hlbmV2ZXIgc29tZXRoaW5nIGlzIHNldCB0byAwIHNjYWxlLiBBZGRpbmcgYW4gZXBzaWxvbiB0ZXJtIGlzIHVuZm9ydHVuYXRlIGJ1dCBuZWNlc3NhcnkgdG8gYXZvaWQgY29uc29sZSBzcGFtLlxuICAgICAgICAgICAgdGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnNjYWxlLnNldFNjYWxhcihNYXRoLmFjb3MoMS0yKmNsYW1wZWRMZW5ndGgpL01hdGguUEkgKyB0aGlzLkVQU0lMT04pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAgLy9wb3NpdGlvbi9yb3RhdGlvbiBjb21lcyBhZnRlciBzaW5jZSAubm9ybWFsaXplKCkgbW9kaWZpZXMgZGlyZWN0aW9uVmVjdG9yIGluIHBsYWNlXG4gICAgICAgICAgICBsZXQgcG9zID0gdGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnBvc2l0aW9uO1xuICAgICAgICAgICAgcG9zLnggPSB4ID09PSB1bmRlZmluZWQgPyAwIDogeDtcbiAgICAgICAgICAgIHBvcy55ID0geSA9PT0gdW5kZWZpbmVkID8gMCA6IHk7XG4gICAgICAgICAgICBwb3MueiA9IHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXG4gICAgICAgICAgICBpZihsZW5ndGggPiAwKXsgLy9kaXJlY3Rpb25WZWN0b3Iubm9ybWFsaXplKCkgZmFpbHMgd2l0aCAwIGxlbmd0aFxuICAgICAgICAgICAgICAgIHRoaXMuYXJyb3doZWFkc1tsaW5lTnVtYmVyXS5xdWF0ZXJuaW9uLnNldEZyb21Vbml0VmVjdG9ycyh0aGlzLl9jb25lVXBEaXJlY3Rpb24sIGRpcmVjdGlvblZlY3Rvci5ub3JtYWxpemUoKSApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0IGNvbG9yKGNvbG9yKXtcbiAgICAgICAgLy9jdXJyZW50bHkgb25seSBhIHNpbmdsZSBjb2xvciBpcyBzdXBwb3J0ZWQuXG4gICAgICAgIC8vSSBzaG91bGQgcmVhbGx5IG1ha2UgaXQgcG9zc2libGUgdG8gc3BlY2lmeSBjb2xvciBieSBhIGZ1bmN0aW9uLlxuICAgICAgICB0aGlzLl9jb2xvciA9IGNvbG9yO1xuICAgICAgICB0aGlzLnNldEFsbFZlcnRpY2VzVG9Db2xvcihjb2xvcik7XG4gICAgICAgIHRoaXMuYXJyb3dNYXRlcmlhbC5jb2xvciA9IG5ldyBUSFJFRS5Db2xvcih0aGlzLl9jb2xvcik7XG4gICAgfVxuXG4gICAgZ2V0IGNvbG9yKCl7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvcjtcbiAgICB9XG5cbiAgICBzZXQgb3BhY2l0eShvcGFjaXR5KXtcbiAgICAgICAgdGhpcy5hcnJvd01hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLmFycm93TWF0ZXJpYWwudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxIHx8IHRoaXMubGluZUpvaW5UeXBlID09IFwiUk9VTkRcIjtcbiAgICAgICAgdGhpcy5hcnJvd01hdGVyaWFsLnZpc2libGUgPSBvcGFjaXR5ID4gMDtcblxuICAgICAgICAvL21lc2ggaXMgYWx3YXlzIHRyYW5zcGFyZW50XG4gICAgICAgIHRoaXMubWF0ZXJpYWwub3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuICAgICAgICB0aGlzLl9vcGFjaXR5ID0gb3BhY2l0eTtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMub3BhY2l0eS52YWx1ZSA9IG9wYWNpdHk7XG4gICAgfVxuXG4gICAgZ2V0IG9wYWNpdHkoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29wYWNpdHk7XG4gICAgfVxuICAgIHJlbW92ZVNlbGZGcm9tU2NlbmUoKXtcbiAgICAgICAgdGhyZWVFbnZpcm9ubWVudC5zY2VuZS5yZW1vdmUodGhpcy5tZXNoKTtcbiAgICAgICAgZm9yKHZhciBpPTA7aTx0aGlzLm51bUFycm93aGVhZHM7aSsrKXtcbiAgICAgICAgICAgIHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMuYXJyb3doZWFkc1tpXSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY2xvbmUoKXtcbiAgICAgICAgcmV0dXJuIG5ldyBWZWN0b3JPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5LGxpbmVKb2luVHlwZTogdGhpcy5saW5lSm9pblR5cGV9KTtcbiAgICB9XG59XG5cblxuIiwiLy9TdXJmYWNlT3V0cHV0U2hhZGVycy5qc1xuXG4vL2V4cGVyaW1lbnQ6IHNoYWRlcnMgdG8gZ2V0IHRoZSB0cmlhbmdsZSBwdWxzYXRpbmchXG52YXIgdlNoYWRlciA9IFtcblwidmFyeWluZyB2ZWMzIHZOb3JtYWw7XCIsXG5cInZhcnlpbmcgdmVjMyB2UG9zaXRpb247XCIsXG5cInZhcnlpbmcgdmVjMiB2VXY7XCIsXG5cInVuaWZvcm0gZmxvYXQgdGltZTtcIixcblwidW5pZm9ybSB2ZWMzIGNvbG9yO1wiLFxuXCJ1bmlmb3JtIHZlYzMgdkxpZ2h0O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGdyaWRTcXVhcmVzO1wiLFxuXG5cInZvaWQgbWFpbigpIHtcIixcblx0XCJ2UG9zaXRpb24gPSBwb3NpdGlvbi54eXo7XCIsXG5cdFwidk5vcm1hbCA9IG5vcm1hbC54eXo7XCIsXG5cdFwidlV2ID0gdXYueHk7XCIsXG5cdFwiZ2xfUG9zaXRpb24gPSBwcm9qZWN0aW9uTWF0cml4ICpcIixcbiAgICAgICAgICAgIFwibW9kZWxWaWV3TWF0cml4ICpcIixcbiAgICAgICAgICAgIFwidmVjNChwb3NpdGlvbiwxLjApO1wiLFxuXCJ9XCJdLmpvaW4oXCJcXG5cIilcblxudmFyIGZTaGFkZXIgPSBbXG5cInZhcnlpbmcgdmVjMyB2Tm9ybWFsO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgdlBvc2l0aW9uO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgdlV2O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IHRpbWU7XCIsXG5cInVuaWZvcm0gdmVjMyBjb2xvcjtcIixcblwidW5pZm9ybSBmbG9hdCB1c2VDdXN0b21HcmlkQ29sb3I7XCIsXG5cInVuaWZvcm0gdmVjMyBncmlkQ29sb3I7XCIsXG5cInVuaWZvcm0gdmVjMyB2TGlnaHQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgZ3JpZFNxdWFyZXM7XCIsXG5cInVuaWZvcm0gZmxvYXQgbGluZVdpZHRoO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IHNob3dHcmlkO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IHNob3dTb2xpZDtcIixcblwidW5pZm9ybSBmbG9hdCBvcGFjaXR5O1wiLFxuXG5cdC8vdGhlIGZvbGxvd2luZyBjb2RlIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL3VuY29uZWQvbWF0aGJveC9ibG9iL2VhZWI4ZTE1ZWYyZDAyNTI3NDBhNzQ1MDVhMTJkN2ExMDUxYTYxYjYvc3JjL3NoYWRlcnMvZ2xzbC9tZXNoLmZyYWdtZW50LnNoYWRlZC5nbHNsXG5cInZlYzMgb2ZmU3BlY3VsYXIodmVjMyBjb2xvcikge1wiLFxuXCIgIHZlYzMgYyA9IDEuMCAtIGNvbG9yO1wiLFxuXCIgIHJldHVybiAxLjAgLSBjICogYztcIixcblwifVwiLFxuXG5cInZlYzQgZ2V0U2hhZGVkQ29sb3IodmVjNCByZ2JhKSB7IFwiLFxuXCIgIHZlYzMgY29sb3IgPSByZ2JhLnh5ejtcIixcblwiICB2ZWMzIGNvbG9yMiA9IG9mZlNwZWN1bGFyKHJnYmEueHl6KTtcIixcblxuXCIgIHZlYzMgbm9ybWFsID0gbm9ybWFsaXplKHZOb3JtYWwpO1wiLFxuXCIgIHZlYzMgbGlnaHQgPSBub3JtYWxpemUodkxpZ2h0KTtcIixcblwiICB2ZWMzIHBvc2l0aW9uID0gbm9ybWFsaXplKHZQb3NpdGlvbik7XCIsXG5cblwiICBmbG9hdCBzaWRlICAgID0gZ2xfRnJvbnRGYWNpbmcgPyAtMS4wIDogMS4wO1wiLFxuXCIgIGZsb2F0IGNvc2luZSAgPSBzaWRlICogZG90KG5vcm1hbCwgbGlnaHQpO1wiLFxuXCIgIGZsb2F0IGRpZmZ1c2UgPSBtaXgobWF4KDAuMCwgY29zaW5lKSwgLjUgKyAuNSAqIGNvc2luZSwgLjEpO1wiLFxuXG5cIiAgZmxvYXQgcmltTGlnaHRpbmcgPSBtYXgobWluKDEuMCAtIHNpZGUqZG90KG5vcm1hbCwgbGlnaHQpLCAxLjApLDAuMCk7XCIsXG5cblwiXHRmbG9hdCBzcGVjdWxhciA9IG1heCgwLjAsIGFicyhjb3NpbmUpIC0gMC41KTtcIiwgLy9kb3VibGUgc2lkZWQgc3BlY3VsYXJcblwiICAgcmV0dXJuIHZlYzQoZGlmZnVzZSpjb2xvciArIDAuOSpyaW1MaWdodGluZypjb2xvciArIDAuNCpjb2xvcjIgKiBzcGVjdWxhciwgcmdiYS5hKTtcIixcblwifVwiLFxuXG4vLyBTbW9vdGggSFNWIHRvIFJHQiBjb252ZXJzaW9uIGZyb20gaHR0cHM6Ly93d3cuc2hhZGVydG95LmNvbS92aWV3L01zUzNXY1xuXCJ2ZWMzIGhzdjJyZ2Jfc21vb3RoKCBpbiB2ZWMzIGMgKXtcIixcblwiICAgIHZlYzMgcmdiID0gY2xhbXAoIGFicyhtb2QoYy54KjYuMCt2ZWMzKDAuMCw0LjAsMi4wKSw2LjApLTMuMCktMS4wLCAwLjAsIDEuMCApO1wiLFxuXCJcdHJnYiA9IHJnYipyZ2IqKDMuMC0yLjAqcmdiKTsgLy8gY3ViaWMgc21vb3RoaW5nXHRcIixcblwiXHRyZXR1cm4gYy56ICogbWl4KCB2ZWMzKDEuMCksIHJnYiwgYy55KTtcIixcblwifVwiLFxuXG4vL0Zyb20gU2FtIEhvY2V2YXI6IGh0dHA6Ly9sb2xlbmdpbmUubmV0L2Jsb2cvMjAxMy8wNy8yNy9yZ2ItdG8taHN2LWluLWdsc2xcblwidmVjMyByZ2IyaHN2KHZlYzMgYyl7XCIsXG5cIiAgICB2ZWM0IEsgPSB2ZWM0KDAuMCwgLTEuMCAvIDMuMCwgMi4wIC8gMy4wLCAtMS4wKTtcIixcblwiICAgIHZlYzQgcCA9IG1peCh2ZWM0KGMuYmcsIEsud3opLCB2ZWM0KGMuZ2IsIEsueHkpLCBzdGVwKGMuYiwgYy5nKSk7XCIsXG5cIiAgICB2ZWM0IHEgPSBtaXgodmVjNChwLnh5dywgYy5yKSwgdmVjNChjLnIsIHAueXp4KSwgc3RlcChwLngsIGMucikpO1wiLFxuXG5cIiAgICBmbG9hdCBkID0gcS54IC0gbWluKHEudywgcS55KTtcIixcblwiICAgIGZsb2F0IGUgPSAxLjBlLTEwO1wiLFxuXCIgICAgcmV0dXJuIHZlYzMoYWJzKHEueiArIChxLncgLSBxLnkpIC8gKDYuMCAqIGQgKyBlKSksIGQgLyAocS54ICsgZSksIHEueCk7XCIsXG5cIn1cIixcbiAvL2Nob29zZXMgdGhlIGNvbG9yIGZvciB0aGUgZ3JpZGxpbmVzIGJ5IHZhcnlpbmcgbGlnaHRuZXNzLiBcbi8vTk9UIGNvbnRpbnVvdXMgb3IgZWxzZSBieSB0aGUgaW50ZXJtZWRpYXRlIGZ1bmN0aW9uIHRoZW9yZW0gdGhlcmUnZCBiZSBhIHBvaW50IHdoZXJlIHRoZSBncmlkbGluZXMgd2VyZSB0aGUgc2FtZSBjb2xvciBhcyB0aGUgbWF0ZXJpYWwuXG5cInZlYzMgZ3JpZExpbmVDb2xvcih2ZWMzIGNvbG9yKXtcIixcblwiIHZlYzMgaHN2ID0gcmdiMmhzdihjb2xvci54eXopO1wiLFxuXCIgLy9oc3YueCArPSAwLjE7XCIsXG5cIiBpZihoc3YueiA8IDAuOCl7aHN2LnogKz0gMC4yO31lbHNle2hzdi56ID0gMC44NS0wLjEqaHN2Lno7aHN2LnkgLT0gMC4wO31cIixcblwiIHJldHVybiBoc3YycmdiX3Ntb290aChoc3YpO1wiLFxuXCJ9XCIsXG5cblwidmVjNCByZW5kZXJHcmlkbGluZXModmVjNCBleGlzdGluZ0NvbG9yLCB2ZWMyIHV2LCB2ZWM0IHNvbGlkQ29sb3IpIHtcIixcblwiICB2ZWMyIGRpc3RUb0VkZ2UgPSBhYnMobW9kKHZVdi54eSpncmlkU3F1YXJlcyArIGxpbmVXaWR0aC8yLjAsMS4wKSk7XCIsXG5cIiAgdmVjMyBjaG9zZW5HcmlkTGluZUNvbG9yID0gbWl4KGdyaWRMaW5lQ29sb3Ioc29saWRDb2xvci54eXopLCBncmlkQ29sb3IsIHVzZUN1c3RvbUdyaWRDb2xvcik7IFwiLCAvL3VzZSBlaXRoZXIgZ3JpZExpbmVDb2xvcigpIG9yIG92ZXJyaWRlIHdpdGggY3VzdG9tIGdyaWRcblwiICB2ZWMzIGJsZW5kZWRHcmlkTGluZSA9IHNob3dTb2xpZCAqIGNob3NlbkdyaWRMaW5lQ29sb3IgKyAoMS4wLXNob3dTb2xpZCkqc29saWRDb2xvci54eXo7XCIsIC8vaWYgc2hvd1NvbGlkID0wLCB1c2Ugc29saWRDb2xvciBhcyB0aGUgZ3JpZGxpbmUgY29sb3IsIG90aGVyd2lzZSBzaGFkZVxuXG5cIiAgaWYoIGRpc3RUb0VkZ2UueCA8IGxpbmVXaWR0aCB8fCBkaXN0VG9FZGdlLnkgPCBsaW5lV2lkdGgpe1wiLFxuXCIgICAgcmV0dXJuIG1peChleGlzdGluZ0NvbG9yLCB2ZWM0KGJsZW5kZWRHcmlkTGluZSwgMS4wKSxzaG93R3JpZCk7XCIsXG5cIiAgfVwiLFxuXCIgIHJldHVybiBleGlzdGluZ0NvbG9yO1wiLFxuXCJ9XCIsXG4vKlxuXCJ2ZWM0IGdldFNoYWRlZENvbG9yTWF0aGJveCh2ZWM0IHJnYmEpIHsgXCIsXG5cIiAgdmVjMyBjb2xvciA9IHJnYmEueHl6O1wiLFxuXCIgIHZlYzMgY29sb3IyID0gb2ZmU3BlY3VsYXIocmdiYS54eXopO1wiLFxuXG5cIiAgdmVjMyBub3JtYWwgPSBub3JtYWxpemUodk5vcm1hbCk7XCIsXG5cIiAgdmVjMyBsaWdodCA9IG5vcm1hbGl6ZSh2TGlnaHQpO1wiLFxuXCIgIHZlYzMgcG9zaXRpb24gPSBub3JtYWxpemUodlBvc2l0aW9uKTtcIixcblwiICBmbG9hdCBzaWRlICAgID0gZ2xfRnJvbnRGYWNpbmcgPyAtMS4wIDogMS4wO1wiLFxuXCIgIGZsb2F0IGNvc2luZSAgPSBzaWRlICogZG90KG5vcm1hbCwgbGlnaHQpO1wiLFxuXCIgIGZsb2F0IGRpZmZ1c2UgPSBtaXgobWF4KDAuMCwgY29zaW5lKSwgLjUgKyAuNSAqIGNvc2luZSwgLjEpO1wiLFxuXCIgICB2ZWMzICBoYWxmTGlnaHQgPSBub3JtYWxpemUobGlnaHQgKyBwb3NpdGlvbik7XCIsXG5cIlx0ZmxvYXQgY29zaW5lSGFsZiA9IG1heCgwLjAsIHNpZGUgKiBkb3Qobm9ybWFsLCBoYWxmTGlnaHQpKTtcIixcblwiXHRmbG9hdCBzcGVjdWxhciA9IHBvdyhjb3NpbmVIYWxmLCAxNi4wKTtcIixcblwiXHRyZXR1cm4gdmVjNChjb2xvciAqIChkaWZmdXNlICogLjkgKyAuMDUpICowLjAgKyAgLjI1ICogY29sb3IyICogc3BlY3VsYXIsIHJnYmEuYSk7XCIsXG5cIn1cIiwqL1xuXG5cInZvaWQgbWFpbigpe1wiLFxuLy9cIiAgLy9nbF9GcmFnQ29sb3IgPSB2ZWM0KHZOb3JtYWwueHl6LCAxLjApOyAvLyB2aWV3IGRlYnVnIG5vcm1hbHNcIixcbi8vXCIgIC8vaWYodk5vcm1hbC54IDwgMC4wKXtnbF9GcmFnQ29sb3IgPSB2ZWM0KG9mZlNwZWN1bGFyKGNvbG9yLnJnYiksIDEuMCk7fWVsc2V7Z2xfRnJhZ0NvbG9yID0gdmVjNCgoY29sb3IucmdiKSwgMS4wKTt9XCIsIC8vdmlldyBzcGVjdWxhciBhbmQgbm9uLXNwZWN1bGFyIGNvbG9yc1xuLy9cIiAgZ2xfRnJhZ0NvbG9yID0gdmVjNChtb2QodlV2Lnh5LDEuMCksMC4wLDEuMCk7IC8vc2hvdyB1dnNcblwiICB2ZWM0IHNvbGlkQ29sb3IgPSB2ZWM0KGNvbG9yLnJnYiwgc2hvd1NvbGlkKTtcIixcblwiICB2ZWM0IHNvbGlkQ29sb3JPdXQgPSBzaG93U29saWQqZ2V0U2hhZGVkQ29sb3Ioc29saWRDb2xvcik7XCIsXG5cIiAgdmVjNCBjb2xvcldpdGhHcmlkbGluZXMgPSByZW5kZXJHcmlkbGluZXMoc29saWRDb2xvck91dCwgdlV2Lnh5LCBzb2xpZENvbG9yKTtcIixcblwiICBjb2xvcldpdGhHcmlkbGluZXMuYSAqPSBvcGFjaXR5O1wiLFxuXCIgIGdsX0ZyYWdDb2xvciA9IGNvbG9yV2l0aEdyaWRsaW5lcztcIixcdFxuXCJ9XCJdLmpvaW4oXCJcXG5cIilcblxudmFyIHVuaWZvcm1zID0ge1xuXHR0aW1lOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAwLFxuXHR9LFxuXHRjb2xvcjoge1xuXHRcdHR5cGU6ICdjJyxcblx0XHR2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KSxcblx0fSxcblx0dXNlQ3VzdG9tR3JpZENvbG9yOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAwLFxuXHR9LFxuXHRncmlkQ29sb3I6IHtcblx0XHR0eXBlOiAnYycsXG5cdFx0dmFsdWU6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSksXG5cdH0sXG5cdG9wYWNpdHk6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDAuMSxcblx0fSxcblx0dkxpZ2h0OiB7IC8vbGlnaHQgZGlyZWN0aW9uXG5cdFx0dHlwZTogJ3ZlYzMnLFxuXHRcdHZhbHVlOiBbMCwwLDFdLFxuXHR9LFxuXHRncmlkU3F1YXJlczoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogNCxcblx0fSxcblx0bGluZVdpZHRoOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAwLjEsXG5cdH0sXG5cdHNob3dHcmlkOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAxLjAsXG5cdH0sXG5cdHNob3dTb2xpZDoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMS4wLFxuXHR9XG59O1xuXG5leHBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcyB9O1xuIiwiaW1wb3J0IHtPdXRwdXROb2RlfSBmcm9tICcuLi9Ob2RlLmpzJztcbmltcG9ydCB7TGluZU91dHB1dH0gZnJvbSAnLi9MaW5lT3V0cHV0LmpzJztcbmltcG9ydCB7IGdldFRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuLi9UaHJlZUVudmlyb25tZW50LmpzJztcbmltcG9ydCB7IHZTaGFkZXIsIGZTaGFkZXIsIHVuaWZvcm1zIH0gZnJvbSAnLi9TdXJmYWNlT3V0cHV0U2hhZGVycy5qcyc7XG5cbmNsYXNzIFN1cmZhY2VPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29ya1xuXHRcdFx0b3B0aW9uczpcblx0XHRcdHtcblx0XHRcdFx0b3BhY2l0eTogbnVtYmVyXG5cdFx0XHRcdGNvbG9yOiBoZXggY29kZSBvciBUSFJFRS5Db2xvcigpLiBEaWZmdXNlIGNvbG9yIG9mIHRoaXMgc3VyZmFjZS5cblx0XHRcdFx0Z3JpZENvbG9yOiBoZXggY29kZSBvciBUSFJFRS5Db2xvcigpLiBJZiBzaG93R3JpZCBpcyB0cnVlLCBncmlkIGxpbmVzIHdpbGwgYXBwZWFyIG92ZXIgdGhpcyBzdXJmYWNlLiBncmlkQ29sb3IgZGV0ZXJtaW5lcyB0aGVpciBjb2xvciBcblx0XHRcdFx0c2hvd0dyaWQ6IGJvb2xlYW4uIElmIHRydWUsIHdpbGwgZGlzcGxheSBhIGdyaWRDb2xvci1jb2xvcmVkIGdyaWQgb3ZlciB0aGUgc3VyZmFjZS4gRGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHRzaG93U29saWQ6IGJvb2xlYW4uIElmIHRydWUsIHdpbGwgZGlzcGxheSBhIHNvbGlkIHN1cmZhY2UuIERlZmF1bHQ6IHRydWVcblx0XHRcdFx0Z3JpZFNxdWFyZXM6IG51bWJlciByZXByZXNlbnRpbmcgaG93IG1hbnkgc3F1YXJlcyBwZXIgZGltZW5zaW9uIHRvIHVzZSBpbiBhIHJlbmRlcmVkIGdyaWRcblx0XHRcdFx0Z3JpZExpbmVXaWR0aDogbnVtYmVyIHJlcHJlc2VudGluZyBob3cgbWFueSBzcXVhcmVzIHBlciBkaW1lbnNpb24gdG8gdXNlIGluIGEgcmVuZGVyZWQgZ3JpZFxuXHRcdFx0fVxuXHRcdCovXG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcblxuXHRcdHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuY29sb3IpIDogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KTtcblxuXHRcdHRoaXMuX2dyaWRDb2xvciA9IG9wdGlvbnMuZ3JpZENvbG9yICE9PSB1bmRlZmluZWQgPyBuZXcgVEhSRUUuQ29sb3Iob3B0aW9ucy5ncmlkQ29sb3IpIDogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KTtcbiAgICAgICAgdGhpcy5fdXNlQ3VzdG9tR3JpZENvbG9yID0gb3B0aW9ucy5ncmlkQ29sb3IgIT09IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuX2dyaWRTcXVhcmVzID0gb3B0aW9ucy5ncmlkU3F1YXJlcyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5ncmlkU3F1YXJlcyA6IDE2O1xuXHRcdHRoaXMuX3Nob3dHcmlkID0gb3B0aW9ucy5zaG93R3JpZCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5zaG93R3JpZCA6IHRydWU7XG5cdFx0dGhpcy5fc2hvd1NvbGlkID0gb3B0aW9ucy5zaG93U29saWQgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuc2hvd1NvbGlkIDogdHJ1ZTtcblx0XHR0aGlzLl9ncmlkTGluZVdpZHRoID0gb3B0aW9ucy5ncmlkTGluZVdpZHRoICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmdyaWRMaW5lV2lkdGggOiAwLjE1O1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSAwOyAvL3Nob3VsZCBhbHdheXMgYmUgZXF1YWwgdG8gdGhpcy52ZXJ0aWNlcy5sZW5ndGhcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGhvdyBtYW55IHRpbWVzIHRvIGJlIGNhbGxlZCBpbiBlYWNoIGRpcmVjdGlvblxuXHRcdHRoaXMuX291dHB1dERpbWVuc2lvbnMgPSAzOyAvL2hvdyBtYW55IGRpbWVuc2lvbnMgcGVyIHBvaW50IHRvIHN0b3JlP1xuXG5cdFx0dGhpcy5pbml0KCk7XG5cdH1cblx0aW5pdCgpe1xuXHRcdHRoaXMuX2dlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCk7XG5cdFx0dGhpcy5fdmVydGljZXM7XG5cdFx0dGhpcy5tYWtlR2VvbWV0cnkoKTtcblxuXHRcdC8vbWFrZSBhIGRlZXAgY29weSBvZiB0aGUgdW5pZm9ybXMgdGVtcGxhdGVcblx0XHR0aGlzLl91bmlmb3JtcyA9IHt9O1xuXHRcdGZvcih2YXIgdW5pZm9ybU5hbWUgaW4gdW5pZm9ybXMpe1xuXHRcdFx0dGhpcy5fdW5pZm9ybXNbdW5pZm9ybU5hbWVdID0ge1xuXHRcdFx0XHR0eXBlOiB1bmlmb3Jtc1t1bmlmb3JtTmFtZV0udHlwZSxcblx0XHRcdFx0dmFsdWU6IHVuaWZvcm1zW3VuaWZvcm1OYW1lXS52YWx1ZVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuU2hhZGVyTWF0ZXJpYWwoe1xuXHRcdFx0c2lkZTogVEhSRUUuQmFja1NpZGUsXG5cdFx0XHR2ZXJ0ZXhTaGFkZXI6IHZTaGFkZXIsIFxuXHRcdFx0ZnJhZ21lbnRTaGFkZXI6IGZTaGFkZXIsXG5cdFx0XHR1bmlmb3JtczogdGhpcy5fdW5pZm9ybXMsXG5cdFx0XHR9KTtcblx0XHR0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTWVzaCh0aGlzLl9nZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vIHNldHRlciBzZXRzIHRyYW5zcGFyZW50IGZsYWcgaWYgbmVjZXNzYXJ5XG5cdFx0dGhpcy5jb2xvciA9IHRoaXMuX2NvbG9yOyAvL3NldHRlciBzZXRzIGNvbG9yIHVuaWZvcm1cblx0XHR0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gdGhpcy5fb3BhY2l0eTtcblx0XHR0aGlzLl91bmlmb3Jtcy5ncmlkU3F1YXJlcy52YWx1ZSA9IHRoaXMuX2dyaWRTcXVhcmVzO1xuXHRcdHRoaXMuX3VuaWZvcm1zLnNob3dHcmlkLnZhbHVlID0gdGhpcy50b051bSh0aGlzLl9zaG93R3JpZCk7XG5cdFx0dGhpcy5fdW5pZm9ybXMuc2hvd1NvbGlkLnZhbHVlID0gdGhpcy50b051bSh0aGlzLl9zaG93U29saWQpO1xuXHRcdHRoaXMuX3VuaWZvcm1zLmxpbmVXaWR0aC52YWx1ZSA9IHRoaXMuX2dyaWRMaW5lV2lkdGg7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLnVzZUN1c3RvbUdyaWRDb2xvciA9IHRoaXMuX3VzZUN1c3RvbUdyaWRDb2xvcjtcblxuXHRcdGlmKCF0aGlzLnNob3dTb2xpZCl0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gdHJ1ZTtcblxuXHRcdGdldFRocmVlRW52aXJvbm1lbnQoKS5zY2VuZS5hZGQodGhpcy5tZXNoKTtcblx0fVxuICAgIHRvTnVtKHgpe1xuICAgICAgICBpZih4ID09IGZhbHNlKXJldHVybiAwO1xuICAgICAgICBpZih4ID09IHRydWUpcmV0dXJuIDE7XG4gICAgICAgIHJldHVybiB4O1xuICAgIH1cblx0bWFrZUdlb21ldHJ5KCl7XG5cblx0XHRsZXQgTUFYX1BPSU5UUyA9IDEwMDAwO1xuXG5cdFx0dGhpcy5fdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KE1BWF9QT0lOVFMgKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcblx0XHR0aGlzLl9ub3JtYWxzID0gbmV3IEZsb2F0MzJBcnJheShNQVhfUE9JTlRTICogMyk7XG5cdFx0dGhpcy5fdXZzID0gbmV3IEZsb2F0MzJBcnJheShNQVhfUE9JTlRTICogMik7XG5cblx0XHQvLyBidWlsZCBnZW9tZXRyeVxuXG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAncG9zaXRpb24nLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fdmVydGljZXMsIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKSApO1xuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ25vcm1hbCcsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl9ub3JtYWxzLCAzICkgKTtcblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICd1dicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl91dnMsIDIgKSApO1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3VzZWQgZHVyaW5nIHVwZGF0ZXMgYXMgYSBwb2ludGVyIHRvIHRoZSBidWZmZXJcblxuXHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblxuXHR9XG5cdF9zZXRVVnModXZzLCBpbmRleCwgdSwgdil7XG5cblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcbiAgICAgICAgLy9zZXR1cCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiBhbmQgdGhpcy5pdGVtRGltZW5zaW9ucy4gdXNlZCBoZXJlIGFnYWluIGJlY2F1c2UgY2xvbmluZyBtZWFucyB0aGUgb25BZGQoKSBtaWdodCBiZSBjYWxsZWQgYmVmb3JlIHRoaXMgaXMgY29ubmVjdGVkIHRvIGEgdHlwZSBvZiBkb21haW5cblxuXHRcdC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBEb21haW5Ob2RlIHdlJ3JlIHJlbmRlcmluZyBmcm9tXG5cdFx0bGV0IHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSByb290Lml0ZW1EaW1lbnNpb25zO1xuXG5cdFx0Ly8gcGVyaGFwcyBpbnN0ZWFkIG9mIGdlbmVyYXRpbmcgYSB3aG9sZSBuZXcgYXJyYXksIHRoaXMgY2FuIHJldXNlIHRoZSBvbGQgb25lP1xuXHRcdGxldCB2ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcblx0XHRsZXQgbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiAzKTtcblx0XHRsZXQgdXZzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIDIpO1xuXG5cdFx0bGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcblx0XHR0aGlzLl92ZXJ0aWNlcyA9IHZlcnRpY2VzO1xuXHRcdHBvc2l0aW9uQXR0cmlidXRlLnNldEFycmF5KHRoaXMuX3ZlcnRpY2VzKTtcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHRsZXQgbm9ybWFsQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5ub3JtYWw7XG5cdFx0dGhpcy5fbm9ybWFscyA9IG5vcm1hbHM7XG5cdFx0bm9ybWFsQXR0cmlidXRlLnNldEFycmF5KHRoaXMuX25vcm1hbHMpO1xuXHRcdG5vcm1hbEF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHRsZXQgdXZBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnV2O1xuXG5cblx0XHQvL2Fzc2VydCB0aGlzLml0ZW1EaW1lbnNpb25zWzBdICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSA9IHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLl9vdXRwdXREaW1lbnNpb25zID09IDJcblx0XHR2YXIgaW5kaWNlcyA9IFtdO1xuXG5cdFx0Ly9yZW5kZXJlZCB0cmlhbmdsZSBpbmRpY2VzXG5cdFx0Ly9mcm9tIHRocmVlLmpzIFBsYW5lR2VvbWV0cnkuanNcblx0XHRsZXQgYmFzZSA9IDA7XG5cdFx0bGV0IGk9MCwgaj0wO1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTE7aisrKXtcblx0XHRcdGZvcihpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTE7aSsrKXtcblxuXHRcdFx0XHRsZXQgYSA9IGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGIgPSBpICsgKGorMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRsZXQgYyA9IChpKzEpKyAoaisxKSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBkID0gKGkrMSkrIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXG4gICAgICAgIFx0XHRpbmRpY2VzLnB1c2goYSwgYiwgZCk7XG5cdFx0XHRcdGluZGljZXMucHVzaChiLCBjLCBkKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vZG91YmxlIHNpZGVkIHJldmVyc2UgZmFjZXNcbiAgICAgICAgXHRcdGluZGljZXMucHVzaChkLCBiLCBhKTtcblx0XHRcdFx0aW5kaWNlcy5wdXNoKGQsIGMsIGIpO1xuXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly9ub3JtYWxzICh3aWxsIGJlIG92ZXJ3cml0dGVuIGxhdGVyKSBhbmQgdXZzXG5cdFx0Zm9yKGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aisrKXtcblx0XHRcdGZvcihpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzFdO2krKyl7XG5cblx0XHRcdFx0bGV0IHBvaW50SW5kZXggPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdC8vc2V0IG5vcm1hbCB0byBbMCwwLDFdIGFzIGEgdGVtcG9yYXJ5IHZhbHVlXG5cdFx0XHRcdG5vcm1hbHNbKHBvaW50SW5kZXgpKjNdID0gMDtcblx0XHRcdFx0bm9ybWFsc1socG9pbnRJbmRleCkqMysxXSA9IDA7XG5cdFx0XHRcdG5vcm1hbHNbKHBvaW50SW5kZXgpKjMrMl0gPSAxO1xuXG5cdFx0XHRcdC8vdXZzXG5cdFx0XHRcdHV2c1socG9pbnRJbmRleCkqMl0gPSBqLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpO1xuXHRcdFx0XHR1dnNbKHBvaW50SW5kZXgpKjIrMV0gPSBpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTEpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3V2cyA9IHV2cztcblx0XHR1dkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl91dnMpO1xuXHRcdHV2QXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblxuXHRcdHRoaXMuX2dlb21ldHJ5LnNldEluZGV4KCBpbmRpY2VzICk7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope1xuXHRcdGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcblx0XHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTtcdFxuXHRcdH1cblxuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblxuXHRcdC8vYXNzZXJ0IGkgPCB2ZXJ0aWNlcy5jb3VudFxuXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5fY3VycmVudFBvaW50SW5kZXgqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcblxuXHQgICAgdGhpcy5fdmVydGljZXNbaW5kZXhdICAgPSB4ID09PSB1bmRlZmluZWQgPyAwIDogeDtcblx0XHR0aGlzLl92ZXJ0aWNlc1tpbmRleCsxXSA9IHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuXHRcdHRoaXMuX3ZlcnRpY2VzW2luZGV4KzJdID0geiA9PT0gdW5kZWZpbmVkID8gMCA6IHo7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXHR9XG5cdG9uQWZ0ZXJBY3RpdmF0aW9uKCl7XG5cdFx0bGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHR0aGlzLl9yZWNhbGNOb3JtYWxzKCk7XG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdG5vcm1hbEF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vcmVzZXQgYWZ0ZXIgZWFjaCB1cGRhdGVcblx0fVxuXHRfcmVjYWxjTm9ybWFscygpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdC8vcmVuZGVyZWQgdHJpYW5nbGUgaW5kaWNlc1xuXHRcdC8vZnJvbSB0aHJlZS5qcyBQbGFuZUdlb21ldHJ5LmpzXG5cdFx0bGV0IG5vcm1hbFZlYyA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0bGV0IHBhcnRpYWxYID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XHRsZXQgcGFydGlhbFkgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG5cdFx0bGV0IGJhc2UgPSAwO1xuXHRcdGxldCBuZWdhdGlvbkZhY3RvciA9IDE7XG5cdFx0bGV0IGk9MCwgaj0wO1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtpKyspe1xuXG5cdFx0XHRcdC8vY3VycmVudGx5IGRvaW5nIHRoZSBub3JtYWwgZm9yIHRoZSBwb2ludCBhdCBpbmRleCBhLlxuXHRcdFx0XHRsZXQgYSA9IGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGIsYztcblxuXHRcdFx0XHQvL1RhbmdlbnRzIGFyZSBjYWxjdWxhdGVkIHdpdGggZmluaXRlIGRpZmZlcmVuY2VzIC0gRm9yICh4LHkpLCBjb21wdXRlIHRoZSBwYXJ0aWFsIGRlcml2YXRpdmVzIHVzaW5nICh4KzEseSkgYW5kICh4LHkrMSkgYW5kIGNyb3NzIHRoZW0uIEJ1dCBpZiB5b3UncmUgYXQgdGhlYm9yZGVyLCB4KzEgYW5kIHkrMSBtaWdodCBub3QgZXhpc3QuIFNvIGluIHRoYXQgY2FzZSB3ZSBnbyBiYWNrd2FyZHMgYW5kIHVzZSAoeC0xLHkpIGFuZCAoeCx5LTEpIGluc3RlYWQuXG5cdFx0XHRcdC8vV2hlbiB0aGF0IGhhcHBlbnMsIHRoZSB2ZWN0b3Igc3VidHJhY3Rpb24gd2lsbCBzdWJ0cmFjdCB0aGUgd3Jvbmcgd2F5LCBpbnRyb2R1Y2luZyBhIGZhY3RvciBvZiAtMSBpbnRvIHRoZSBjcm9zcyBwcm9kdWN0IHRlcm0uIFNvIG5lZ2F0aW9uRmFjdG9yIGtlZXBzIHRyYWNrIG9mIHdoZW4gdGhhdCBoYXBwZW5zIGFuZCBpcyBtdWx0aXBsaWVkIGFnYWluIHRvIGNhbmNlbCBpdCBvdXQuXG5cdFx0XHRcdG5lZ2F0aW9uRmFjdG9yID0gMTsgXG5cblx0XHRcdFx0Ly9iIGlzIHRoZSBpbmRleCBvZiB0aGUgcG9pbnQgMSBhd2F5IGluIHRoZSB5IGRpcmVjdGlvblxuXHRcdFx0XHRpZihpIDwgdGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKXtcblx0XHRcdFx0XHRiID0gKGkrMSkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0fWVsc2V7XG5cdFx0XHRcdFx0Ly9lbmQgb2YgdGhlIHkgYXhpcywgZ28gYmFja3dhcmRzIGZvciB0YW5nZW50c1xuXHRcdFx0XHRcdGIgPSAoaS0xKSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRcdG5lZ2F0aW9uRmFjdG9yICo9IC0xO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9jIGlzIHRoZSBpbmRleCBvZiB0aGUgcG9pbnQgMSBhd2F5IGluIHRoZSB4IGRpcmVjdGlvblxuXHRcdFx0XHRpZihqIDwgdGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKXtcblx0XHRcdFx0XHRjID0gaSArIChqKzEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0fWVsc2V7XG5cdFx0XHRcdFx0Ly9lbmQgb2YgdGhlIHggYXhpcywgZ28gYmFja3dhcmRzIGZvciB0YW5nZW50c1xuXHRcdFx0XHRcdGMgPSBpICsgKGotMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRcdG5lZ2F0aW9uRmFjdG9yICo9IC0xO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly90aGUgdmVjdG9yIGItYS4gXG5cdFx0XHRcdC8vdGhpcy5fdmVydGljZXMgc3RvcmVzIHRoZSBjb21wb25lbnRzIG9mIGVhY2ggdmVjdG9yIGluIG9uZSBiaWcgZmxvYXQzMmFycmF5LCBzbyB0aGlzIHB1bGxzIHRoZW0gb3V0IGFuZCBqdXN0IGRvZXMgdGhlIHN1YnRyYWN0aW9uIG51bWVyaWNhbGx5LiBUaGUgY29tcG9uZW50cyBvZiB2ZWN0b3IgIzUyIGFyZSB4OjUyKjMrMCx5OjUyKjMrMSx6OjUyKjMrMiwgZm9yIGV4YW1wbGUuXG5cdFx0XHRcdHBhcnRpYWxZLnNldCh0aGlzLl92ZXJ0aWNlc1tiKjNdLXRoaXMuX3ZlcnRpY2VzW2EqM10sdGhpcy5fdmVydGljZXNbYiozKzFdLXRoaXMuX3ZlcnRpY2VzW2EqMysxXSx0aGlzLl92ZXJ0aWNlc1tiKjMrMl0tdGhpcy5fdmVydGljZXNbYSozKzJdKTtcblx0XHRcdFx0Ly90aGUgdmVjdG9yIGMtYS5cblx0XHRcdFx0cGFydGlhbFguc2V0KHRoaXMuX3ZlcnRpY2VzW2MqM10tdGhpcy5fdmVydGljZXNbYSozXSx0aGlzLl92ZXJ0aWNlc1tjKjMrMV0tdGhpcy5fdmVydGljZXNbYSozKzFdLHRoaXMuX3ZlcnRpY2VzW2MqMysyXS10aGlzLl92ZXJ0aWNlc1thKjMrMl0pO1xuXG5cdFx0XHRcdC8vYi1hIGNyb3NzIGMtYVxuXHRcdFx0XHRub3JtYWxWZWMuY3Jvc3NWZWN0b3JzKHBhcnRpYWxYLHBhcnRpYWxZKS5ub3JtYWxpemUoKTtcblx0XHRcdFx0bm9ybWFsVmVjLm11bHRpcGx5U2NhbGFyKG5lZ2F0aW9uRmFjdG9yKTtcblx0XHRcdFx0Ly9zZXQgbm9ybWFsXG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqM10gPSBub3JtYWxWZWMueDtcblx0XHRcdFx0dGhpcy5fbm9ybWFsc1soaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdKSozKzFdID0gbm9ybWFsVmVjLnk7XG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqMysyXSA9IG5vcm1hbFZlYy56O1xuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBkb24ndCBmb3JnZXQgdG8gbm9ybWFsQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZSBhZnRlciBjYWxsaW5nIHRoaXMhXG5cdH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG4gICAgICAgIHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG4gICAgfVxuXHRzZXQgY29sb3IoY29sb3Ipe1xuXHRcdC8vY3VycmVudGx5IG9ubHkgYSBzaW5nbGUgY29sb3IgaXMgc3VwcG9ydGVkLlxuXHRcdC8vSSBzaG91bGQgcmVhbGx5IG1ha2UgdGhpcyBhIGZ1bmN0aW9uXG5cdFx0dGhpcy5fY29sb3IgPSBjb2xvcjtcblx0XHR0aGlzLl91bmlmb3Jtcy5jb2xvci52YWx1ZSA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG5cdH1cblx0Z2V0IGNvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbG9yO1xuXHR9XG5cdHNldCBncmlkQ29sb3IoY29sb3Ipe1xuXHRcdC8vY3VycmVudGx5IG9ubHkgYSBzaW5nbGUgY29sb3IgaXMgc3VwcG9ydGVkLlxuXHRcdC8vSSBzaG91bGQgcmVhbGx5IG1ha2UgdGhpcyBhIGZ1bmN0aW9uXG5cdFx0dGhpcy5fZ3JpZENvbG9yID0gY29sb3I7XG5cdFx0dGhpcy5fdW5pZm9ybXMuZ3JpZENvbG9yLnZhbHVlID0gbmV3IFRIUkVFLkNvbG9yKGNvbG9yKTtcbiAgICAgICAgdGhpcy5fdW5pZm9ybXMudXNlQ3VzdG9tR3JpZENvbG9yID0gMS4wO1xuXHR9XG5cdGdldCBncmlkQ29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fZ3JpZENvbG9yO1xuXHR9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdHRoaXMubWF0ZXJpYWwub3BhY2l0eSA9IG9wYWNpdHk7XG5cdFx0dGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IChvcGFjaXR5IDwgMSkgfHwgKCF0aGlzLnNob3dTb2xpZCk7XG5cdFx0dGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLm9wYWNpdHkudmFsdWUgPSBvcGFjaXR5O1xuXHR9XG5cdGdldCBvcGFjaXR5KCl7XG5cdFx0cmV0dXJuIHRoaXMuX29wYWNpdHk7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IFN1cmZhY2VPdXRwdXQoe2NvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG5leHBvcnQge1N1cmZhY2VPdXRwdXR9O1xuIiwiaW1wb3J0IHtPdXRwdXROb2RlfSBmcm9tICcuLi9Ob2RlLmpzJztcblxuY2xhc3MgRmxhdEFycmF5T3V0cHV0IGV4dGVuZHMgT3V0cHV0Tm9kZXtcbiAgICAvL2FuIG91dHB1dCB3aGljaCBmaWxscyBhbiBhcnJheSB3aXRoIGV2ZXJ5IGNvb3JkaW5hdGUgcmVjaWV2ZWQsIGluIG9yZGVyLlxuICAgIC8vSXQnbGwgcmVnaXN0ZXIgWzAsMSwyXSxbMyw0LDVdIGFzIFswLDEsMiwzLDQsNV0uXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKlxuXHRcdFx0YXJyYXk6IGFuIGV4aXN0aW5nIGFycmF5LCB3aGljaCB3aWxsIHRoZW4gYmUgbW9kaWZpZWQgaW4gcGxhY2UgZXZlcnkgdGltZSB0aGlzIG91dHB1dCBpcyBhY3RpdmF0ZWRcblx0XHQqL1xuXG5cdFx0dGhpcy5hcnJheSA9IG9wdGlvbnMuYXJyYXk7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRBcnJheUluZGV4ID0gMDtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgLi4uY29vcmRzKXtcbiAgICAgICAgZm9yKHZhciBqPTA7ajxjb29yZHMubGVuZ3RoO2orKyl7IFxuICAgICAgICAgICAgLy9JIGRvbid0IG5lZWQgdG8gd29ycnkgYWJvdXQgb3V0LW9mLWJvdW5kcyBlbnRyaWVzIGJlY2F1c2UgamF2YXNjcmlwdCBhdXRvbWF0aWNhbGx5IGdyb3dzIGFycmF5cyBpZiBhIG5ldyBpbmRleCBpcyBzZXQuXG4gICAgICAgICAgICAvL0phdmFzY3JpcHQgbWF5IGhhdmUgc29tZSBnYXJiYWdlIGRlc2lnbiBjaG9pY2VzLCBidXQgSSdsbCBjbGFpbSB0aGF0IGdhcmJhZ2UgZm9yIG15IG93biBuZWZhcmlvdXMgYWR2YW50YWdlLlxuICAgICAgICAgICAgdGhpcy5hcnJheVt0aGlzLl9jdXJyZW50QXJyYXlJbmRleF0gPSBjb29yZHNbal1cbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRBcnJheUluZGV4Kys7XG4gICAgICAgIH1cblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuICAgICAgICB0aGlzLl9jdXJyZW50QXJyYXlJbmRleCA9IDA7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IEZsYXRBcnJheU91dHB1dCh7YXJyYXk6IEVYUC5NYXRoLmNsb25lKHRoaXMuYXJyYXkpfSk7XG5cdH1cbn1cblxuZXhwb3J0IHtGbGF0QXJyYXlPdXRwdXR9O1xuIiwidmFyIGV4cGxhbmFyaWFuQXJyb3dTVkcgPSBcImRhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEQ5NGJXd2dkbVZ5YzJsdmJqMGlNUzR3SWlCbGJtTnZaR2x1WnowaVZWUkdMVGdpSUhOMFlXNWtZV3h2Ym1VOUltNXZJajgrQ2p3aExTMGdRM0psWVhSbFpDQjNhWFJvSUVsdWEzTmpZWEJsSUNob2RIUndPaTh2ZDNkM0xtbHVhM05qWVhCbExtOXlaeThwSUMwdFBnb0tQSE4yWndvZ0lDQjRiV3h1Y3pwa1l6MGlhSFIwY0RvdkwzQjFjbXd1YjNKbkwyUmpMMlZzWlcxbGJuUnpMekV1TVM4aUNpQWdJSGh0Ykc1ek9tTmpQU0pvZEhSd09pOHZZM0psWVhScGRtVmpiMjF0YjI1ekxtOXlaeTl1Y3lNaUNpQWdJSGh0Ykc1ek9uSmtaajBpYUhSMGNEb3ZMM2QzZHk1M015NXZjbWN2TVRrNU9TOHdNaTh5TWkxeVpHWXRjM2x1ZEdGNExXNXpJeUlLSUNBZ2VHMXNibk02YzNablBTSm9kSFJ3T2k4dmQzZDNMbmN6TG05eVp5OHlNREF3TDNOMlp5SUtJQ0FnZUcxc2JuTTlJbWgwZEhBNkx5OTNkM2N1ZHpNdWIzSm5Mekl3TURBdmMzWm5JZ29nSUNCNGJXeHVjenA0YkdsdWF6MGlhSFIwY0RvdkwzZDNkeTUzTXk1dmNtY3ZNVGs1T1M5NGJHbHVheUlLSUNBZ2VHMXNibk02YzI5a2FYQnZaR2s5SW1oMGRIQTZMeTl6YjJScGNHOWthUzV6YjNWeVkyVm1iM0puWlM1dVpYUXZSRlJFTDNOdlpHbHdiMlJwTFRBdVpIUmtJZ29nSUNCNGJXeHVjenBwYm10elkyRndaVDBpYUhSMGNEb3ZMM2QzZHk1cGJtdHpZMkZ3WlM1dmNtY3ZibUZ0WlhOd1lXTmxjeTlwYm10elkyRndaU0lLSUNBZ2QybGtkR2c5SWpJd01DSUtJQ0FnYUdWcFoyaDBQU0l4TXpBaUNpQWdJSFpwWlhkQ2IzZzlJakFnTUNBeU1EQWdNVE13SWdvZ0lDQnBaRDBpYzNabk1pSUtJQ0FnZG1WeWMybHZiajBpTVM0eElnb2dJQ0JwYm10elkyRndaVHAyWlhKemFXOXVQU0l3TGpreElISXhNemN5TlNJS0lDQWdjMjlrYVhCdlpHazZaRzlqYm1GdFpUMGlSWGh3YkdGdVlYSnBZVzVPWlhoMFFYSnliM2N1YzNabklqNEtJQ0E4WkdWbWN6NEtQSEpoWkdsaGJFZHlZV1JwWlc1MElHbGtQU0poSWlCamVEMGlOVEF3SWlCamVUMGlOakkzTGpjeElpQnlQU0l5TkRJdU16VWlJR2R5WVdScFpXNTBWSEpoYm5ObWIzSnRQU0p0WVhSeWFYZ29NQ0F1TWprM01ESWdMVE11T0RNNU1TQXRNUzR4T1RNeFpTMDRJREkwTURndU1TQTRNemd1T0RVcElpQm5jbUZrYVdWdWRGVnVhWFJ6UFNKMWMyVnlVM0JoWTJWUGJsVnpaU0krQ2p4emRHOXdJSE4wYjNBdFkyOXNiM0k5SWlOaVl6Y3pNVGtpSUc5bVpuTmxkRDBpTUNJdlBnbzhjM1J2Y0NCemRHOXdMV052Ykc5eVBTSWpaakJrTWpZeklpQnZabVp6WlhROUlqRWlMejRLUEM5eVlXUnBZV3hIY21Ga2FXVnVkRDRLUEM5a1pXWnpQZ284YldWMFlXUmhkR0UrQ2p4eVpHWTZVa1JHUGdvOFkyTTZWMjl5YXlCeVpHWTZZV0p2ZFhROUlpSStDanhrWXpwbWIzSnRZWFErYVcxaFoyVXZjM1puSzNodGJEd3ZaR002Wm05eWJXRjBQZ284WkdNNmRIbHdaU0J5WkdZNmNtVnpiM1Z5WTJVOUltaDBkSEE2THk5d2RYSnNMbTl5Wnk5a1l5OWtZMjFwZEhsd1pTOVRkR2xzYkVsdFlXZGxJaTgrQ2p4a1l6cDBhWFJzWlM4K0Nqd3ZZMk02VjI5eWF6NEtQQzl5WkdZNlVrUkdQZ284TDIxbGRHRmtZWFJoUGdvOFp5QjBjbUZ1YzJadmNtMDlJblJ5WVc1emJHRjBaU2d3SUMwNU1qSXVNellwSWo0S1BIQmhkR2dnWkQwaWJURTVOeTQwTnlBNU9EY3VNelpqTUMweU5DNHlPREV0T0RjdU1qWXhMVFl4TGpjd09DMDROeTR5TmpFdE5qRXVOekE0ZGpJNUxqWTVOR3d0TVRNdU5UWXpJREF1TXpjNU5HTXRNVE11TlRZeklEQXVNemM1TXprdE5qSXVNakF5SURJdU9ESTNNUzAzTkM0NE1URWdOeTQ1TmpVM0xURXlMall3T1NBMUxqRXpPRFl0TVRrdU16QXhJREUwTGpZNU5TMHhPUzR6TURFZ01qTXVOalk1SURBZ09DNDVOek00SURNdU9UY3pOU0F4T0M0eE5qTWdNVGt1TXpBeElESXpMalkyT1NBeE5TNHpNamNnTlM0MU1EVTFJRFl4TGpJME9DQTNMalU0TmpNZ056UXVPREV4SURjdU9UWTFOMnd4TXk0MU5qTWdNQzR6TnprMGRqSTVMalk1TkhNNE55NHlOakV0TXpjdU5ESTRJRGczTGpJMk1TMDJNUzQzTURoNklpQm1hV3hzUFNKMWNtd29JMkVwSWlCemRISnZhMlU5SWlNM016VTFNMlFpSUhOMGNtOXJaUzEzYVdSMGFEMGlNaTQyTWpnMUlpOCtDanhuSUhSeVlXNXpabTl5YlQwaWJXRjBjbWw0S0RBZ0xqSTJNamcxSUMwdU1qWXlPRFVnTUNBeE56Z3VNVE1nT0RZd0xqQXhLU0lnYzNSeWIydGxQU0lqTURBd0lpQnpkSEp2YTJVdGQybGtkR2c5SWpFd0lqNEtQR1ZzYkdsd2MyVWdZM2c5SWpVME55NHhOQ0lnWTNrOUlqRXlNQzQ1TXlJZ2NuZzlJakkxTGpjeE5DSWdjbms5SWpVeExqUXlPU0lnWm1sc2JEMGlJMlptWmlJdlBnbzhaV3hzYVhCelpTQmplRDBpTlRNMExqTTNJaUJqZVQwaU1USXpMalV6SWlCeWVEMGlNVEl1TmpJM0lpQnllVDBpTWpZdU1qWTBJaTgrQ2p3dlp6NEtQR2NnZEhKaGJuTm1iM0p0UFNKdFlYUnlhWGdvTUNBdExqSTJNamcxSUMwdU1qWXlPRFVnTUNBeE56Z3VOallnTVRFeE5DNDNLU0lnYzNSeWIydGxQU0lqTURBd0lpQnpkSEp2YTJVdGQybGtkR2c5SWpFd0lqNEtQR1ZzYkdsd2MyVWdZM2c5SWpVME55NHhOQ0lnWTNrOUlqRXlNQzQ1TXlJZ2NuZzlJakkxTGpjeE5DSWdjbms5SWpVeExqUXlPU0lnWm1sc2JEMGlJMlptWmlJdlBnbzhaV3hzYVhCelpTQmplRDBpTlRNMExqTTNJaUJqZVQwaU1USXpMalV6SWlCeWVEMGlNVEl1TmpJM0lpQnllVDBpTWpZdU1qWTBJaTgrQ2p3dlp6NEtQQzluUGdvOEwzTjJaejRLXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGV4cGxhbmFyaWFuQXJyb3dTVkc7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLypUaGlzIGNsYXNzIGlzIHN1cHBvc2VkIHRvIHR1cm4gYSBzZXJpZXMgb2ZcbmRpci5kZWxheSgpXG5kaXIudHJhbnNpdGlvblRvKC4uLilcbmRpci5kZWxheSgpXG5kaXIubmV4dFNsaWRlKCk7XG5cbmludG8gYSBzZXF1ZW5jZSB0aGF0IG9ubHkgYWR2YW5jZXMgd2hlbiB0aGUgcmlnaHQgYXJyb3cgaXMgcHJlc3NlZC5cblxuQW55IGRpdnMgd2l0aCB0aGUgZXhwLXNsaWRlIGNsYXNzIHdpbGwgYWxzbyBiZSBzaG93biBhbmQgaGlkZGVuIG9uZSBieSBvbmUuXG5cbkFsc28sXG5cbiovXG5cbmltcG9ydCB7QW5pbWF0aW9uLCBFYXNpbmd9IGZyb20gJy4vQW5pbWF0aW9uLmpzJztcbmltcG9ydCBleHBsYW5hcmlhbkFycm93U1ZHIGZyb20gJy4vRGlyZWN0b3JJbWFnZUNvbnN0YW50cy5qcyc7XG5cbmNsYXNzIERpcmVjdGlvbkFycm93e1xuICAgIGNvbnN0cnVjdG9yKGZhY2VSaWdodCl7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZSA9IG5ldyBJbWFnZSgpO1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3JjID0gZXhwbGFuYXJpYW5BcnJvd1NWRztcblxuICAgICAgICB0aGlzLmFycm93SW1hZ2UuY2xhc3NMaXN0LmFkZChcImV4cC1hcnJvd1wiKTtcblxuICAgICAgICBmYWNlUmlnaHQgPSBmYWNlUmlnaHQ9PT11bmRlZmluZWQgPyB0cnVlIDogZmFjZVJpZ2h0O1xuXG4gICAgICAgIGlmKGZhY2VSaWdodCl7XG4gICAgICAgICAgICB0aGlzLmFycm93SW1hZ2UuY2xhc3NMaXN0LmFkZChcImV4cC1hcnJvdy1yaWdodFwiKVxuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHRoaXMuYXJyb3dJbWFnZS5jbGFzc0xpc3QuYWRkKFwiZXhwLWFycm93LWxlZnRcIilcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFycm93SW1hZ2Uub25jbGljayA9IChmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5oaWRlU2VsZigpO1xuICAgICAgICAgICAgdGhpcy5vbmNsaWNrQ2FsbGJhY2soKTtcbiAgICAgICAgfSkuYmluZCh0aGlzKTtcblxuICAgICAgICB0aGlzLm9uY2xpY2tDYWxsYmFjayA9IG51bGw7IC8vIHRvIGJlIHNldCBleHRlcm5hbGx5XG4gICAgfVxuICAgIHNob3dTZWxmKCl7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5vcGFjaXR5ID0gMTtcbiAgICAgICAgXG4gICAgfVxuICAgIGhpZGVTZWxmKCl7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5vcGFjaXR5ID0gMDtcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gICAgfVxufVxuXG5cbmNsYXNzIE5vbkRlY3JlYXNpbmdEaXJlY3RvcntcbiAgICAvL1VzaW5nIGEgTm9uRGVjcmVhc2luZ0RpcmVjdG9yLCBjcmVhdGUgSFRNTCBlbGVtZW50cyB3aXRoIHRoZSAnZXhwLXNsaWRlJyBjbGFzcy5cbiAgICAvL1RoZSBmaXJzdCBIVE1MIGVsZW1lbnQgd2l0aCB0aGUgJ2V4cC1zbGlkZScgY2xhc3Mgd2lsbCBiZSBzaG93biBmaXJzdC4gV2hlbiB0aGUgbmV4dCBzbGlkZSBidXR0b24gaXMgY2xpY2tlZCwgdGhhdCB3aWxsIGZhZGUgb3V0IGFuZCBiZSByZXBsYWNlZCB3aXRoIHRoZSBuZXh0IGVsZW1lbnQgd2l0aCB0aGUgZXhwLXNsaWRlIGNsYXNzLCBpbiBvcmRlciBvZiBIVE1MLlxuICAgIC8vSWYgeW91IHdhbnQgdG8gZGlzcGxheSBtdWx0aXBsZSBIVE1MIGVsZW1lbnRzIGF0IHRoZSBzYW1lIHRpbWUsICdleHAtc2xpZGUtPG4+JyB3aWxsIGFsc28gYmUgZGlzcGxheWVkIHdoZW4gdGhlIHByZXNlbnRhdGlvbiBpcyBjdXJyZW50bHkgb24gc2xpZGUgbnVtYmVyIG4uIEZvciBleGFtcGxlLCBldmVyeXRoaW5nIGluIHRoZSBleHAtc2xpZGUtMSBjbGFzcyB3aWxsIGJlIHZpc2libGUgZnJvbSB0aGUgc3RhcnQsIGFuZCB0aGVuIGV4cC1zbGlkZS0yLCBhbmQgc28gb24uXG4gICAgLy9Eb24ndCBnaXZlIGFuIGVsZW1lbnQgYm90aCB0aGUgZXhwLXNsaWRlIGFuZCBleHAtc2xpZGUtbiBjbGFzc2VzLiBcblxuICAgIC8vIEkgd2FudCBEaXJlY3RvcigpIHRvIGJlIGFibGUgdG8gYmFja3RyYWNrIGJ5IHByZXNzaW5nIGJhY2t3YXJkcy4gVGhpcyBkb2Vzbid0IGRvIHRoYXQuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyl7XG4gICAgICAgIHRoaXMuc2xpZGVzID0gW107XG4gICAgICAgIHRoaXMuY3VycmVudFNsaWRlSW5kZXggPSAwOyAgICAgICAgXG4gICAgICAgIHRoaXMubnVtU2xpZGVzID0gMDtcbiAgICAgICAgdGhpcy5udW1IVE1MU2xpZGVzID0gMDtcblxuICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBcblxuXG4gICAgYXN5bmMgYmVnaW4oKXtcbiAgICAgICAgYXdhaXQgdGhpcy53YWl0Rm9yUGFnZUxvYWQoKTtcblxuICAgICAgICB0aGlzLnNldHVwQW5kSGlkZUFsbFNsaWRlSFRNTEVsZW1lbnRzKCk7XG5cbiAgICAgICAgdGhpcy5zd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KDApOyAvL3VuaGlkZSBmaXJzdCBvbmVcblxuICAgICAgICB0aGlzLnNldHVwQ2xpY2thYmxlcygpO1xuXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIHNldHVwQW5kSGlkZUFsbFNsaWRlSFRNTEVsZW1lbnRzKCl7XG5cbiAgICAgICAgdGhpcy5zbGlkZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXhwLXNsaWRlXCIpO1xuICAgICAgICB0aGlzLm51bUhUTUxTbGlkZXMgPSB0aGlzLnNsaWRlcy5sZW5ndGg7XG5cbiAgICAgICAgLy9oaWRlIGFsbCBzbGlkZXMgZXhjZXB0IGZpcnN0IG9uZVxuICAgICAgICBmb3IodmFyIGk9MDtpPHRoaXMubnVtSFRNTFNsaWRlcztpKyspe1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbaV0uc3R5bGUub3BhY2l0eSA9IDA7IFxuICAgICAgICAgICAgdGhpcy5zbGlkZXNbaV0uc3R5bGUuZGlzcGxheSA9ICdub25lJzsvL29wYWNpdHk9MCBhbG9uZSB3b24ndCBiZSBpbnN0YW50IGJlY2F1c2Ugb2YgdGhlIDFzIENTUyB0cmFuc2l0aW9uXG4gICAgICAgIH1cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgICAgICAvL3VuZG8gc2V0dGluZyBkaXNwbGF5LW5vbmUgYWZ0ZXIgYSBiaXQgb2YgdGltZVxuICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICAgICAgZm9yKHZhciBpPTA7aTxzZWxmLnNsaWRlcy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgICAgICBzZWxmLnNsaWRlc1tpXS5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sMSk7XG5cbiAgICAgICAgLy9ub3cgaGFuZGxlIGV4cC1zbGlkZS08bj5cbiAgICAgICAgbGV0IGFsbFNwZWNpZmljU2xpZGVFbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tjbGFzcyo9XCJleHAtc2xpZGUtXCJdJyk7IC8vdGhpcyBpcyBhIENTUyBhdHRyaWJ1dGUgc2VsZWN0b3IsIGFuZCBJIGhhdGUgdGhhdCB0aGlzIGV4aXN0cy4gaXQncyBzbyB1Z2x5XG4gICAgICAgIGZvcih2YXIgaT0wO2k8YWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgYWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzW2ldLnN0eWxlLm9wYWNpdHkgPSAwOyBcbiAgICAgICAgICAgIGFsbFNwZWNpZmljU2xpZGVFbGVtZW50c1tpXS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOy8vb3BhY2l0eT0wIGFsb25lIHdvbid0IGJlIGluc3RhbnQgYmVjYXVzZSBvZiB0aGUgMXMgQ1NTIHRyYW5zaXRpb25cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldHVwQ2xpY2thYmxlcygpe1xuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5yaWdodEFycm93ID0gbmV3IERpcmVjdGlvbkFycm93KCk7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yaWdodEFycm93LmFycm93SW1hZ2UpO1xuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cub25jbGlja0NhbGxiYWNrID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHNlbGYuX2NoYW5nZVNsaWRlKDEsIGZ1bmN0aW9uKCl7fSk7IC8vIHRoaXMgZXJyb3JzIHdpdGhvdXQgdGhlIGVtcHR5IGZ1bmN0aW9uIGJlY2F1c2UgdGhlcmUncyBubyByZXNvbHZlLiBUaGVyZSBtdXN0IGJlIGEgYmV0dGVyIHdheSB0byBkbyB0aGluZ3MuXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJXQVJOSU5HOiBIb3JyaWJsZSBoYWNrIGluIGVmZmVjdCB0byBjaGFuZ2Ugc2xpZGVzLiBQbGVhc2UgcmVwbGFjZSB0aGUgcGFzcy1hbi1lbXB0eS1mdW5jdGlvbiB0aGluZyB3aXRoIHNvbWV0aGluZyB0aGF0IGFjdHVhbGx5IHJlc29sdmVzIHByb3Blcmx5IGFuZCBkb2VzIGFzeW5jLlwiKVxuICAgICAgICAgICAgc2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24oKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgYXN5bmMgd2FpdEZvclBhZ2VMb2FkKCl7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgICAgICAgaWYoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PSAnY29tcGxldGUnKXtcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIixyZXNvbHZlKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGFzeW5jIG5leHRTbGlkZSgpe1xuICAgICAgICBpZighdGhpcy5pbml0aWFsaXplZCl0aHJvdyBuZXcgRXJyb3IoXCJFUlJPUjogVXNlIC5iZWdpbigpIG9uIGEgRGlyZWN0b3IgYmVmb3JlIGNhbGxpbmcgYW55IG90aGVyIG1ldGhvZHMhXCIpO1xuXG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cuc2hvd1NlbGYoKTtcbiAgICAgICAgLy9wcm9taXNlIGlzIHJlc29sdmVkIGJ5IGNhbGxpbmcgdGhpcy5uZXh0U2xpZGVQcm9taXNlLnJlc29sdmUoKSB3aGVuIHRoZSB0aW1lIGNvbWVzXG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICBmdW5jdGlvbiBrZXlMaXN0ZW5lcihlKXtcbiAgICAgICAgICAgICAgICBpZihlLnJlcGVhdClyZXR1cm47IC8va2V5ZG93biBmaXJlcyBtdWx0aXBsZSB0aW1lcyBidXQgd2Ugb25seSB3YW50IHRoZSBmaXJzdCBvbmVcbiAgICAgICAgICAgICAgICBsZXQgc2xpZGVEZWx0YSA9IDA7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChlLmtleUNvZGUpIHtcbiAgICAgICAgICAgICAgICAgIGNhc2UgMzQ6XG4gICAgICAgICAgICAgICAgICBjYXNlIDM5OlxuICAgICAgICAgICAgICAgICAgY2FzZSA0MDpcbiAgICAgICAgICAgICAgICAgICAgc2xpZGVEZWx0YSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmKHNsaWRlRGVsdGEgIT0gMCl7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnJpZ2h0QXJyb3cuaGlkZVNlbGYoKTtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsa2V5TGlzdGVuZXIpOyAvL3RoaXMgYXBwcm9hY2ggdGFrZW4gZnJvbSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNTcxODY0NS9yZXNvbHZpbmctYS1wcm9taXNlLXdpdGgtZXZlbnRsaXN0ZW5lclxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGtleUxpc3RlbmVyKTtcbiAgICAgICAgICAgIC8vaG9ycmlibGUgaGFjayBzbyB0aGF0IHRoZSAnbmV4dCBzbGlkZScgYXJyb3cgY2FuIHRyaWdnZXIgdGhpcyB0b29cbiAgICAgICAgICAgIHNlbGYubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gZnVuY3Rpb24oKXsgXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLGtleUxpc3RlbmVyKTsgXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBfY2hhbmdlU2xpZGUoc2xpZGVEZWx0YSwgcmVzb2x2ZSl7XG4gICAgICAgIC8vc2xpZGUgY2hhbmdpbmcgbG9naWNcbiAgICAgICAgaWYoc2xpZGVEZWx0YSAhPSAwKXtcbiAgICAgICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gMCAmJiBzbGlkZURlbHRhID09IC0xKXtcbiAgICAgICAgICAgICAgICByZXR1cm47IC8vbm8gZ29pbmcgcGFzdCB0aGUgYmVnaW5uaW5nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IHRoaXMubnVtSFRNTFNsaWRlcy0xICYmIHNsaWRlRGVsdGEgPT0gMSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuOyAvL25vIGdvaW5nIHBhc3QgdGhlIGVuZFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgodGhpcy5jdXJyZW50U2xpZGVJbmRleCArIHNsaWRlRGVsdGEpO1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleChzbGlkZU51bWJlcil7XG4gICAgICAgIC8vdXBkYXRlcyBIVE1MIGFuZCBhbHNvIHNldHMgdGhpcy5jdXJyZW50U2xpZGVJbmRleCB0byBzbGlkZU51bWJlclxuXG4gICAgICAgIGxldCBwcmV2U2xpZGVOdW1iZXIgPSB0aGlzLmN1cnJlbnRTbGlkZUluZGV4O1xuICAgICAgICB0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID0gc2xpZGVOdW1iZXI7XG5cblxuICAgICAgICAvL2hpZGUgdGhlIEhUTUwgZWxlbWVudHMgZm9yIHRoZSBwcmV2aW91cyBzbGlkZVxuXG4gICAgICAgIC8vaXRlbXMgd2l0aCBjbGFzcyBleHAtc2xpZGVcbiAgICAgICAgaWYocHJldlNsaWRlTnVtYmVyIDwgdGhpcy5zbGlkZXMubGVuZ3RoKXtcbiAgICAgICAgICAgIHRoaXMuc2xpZGVzW3ByZXZTbGlkZU51bWJlcl0uc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vaXRlbXMgd2l0aCBIVE1MIGNsYXNzIGV4cC1zbGlkZS1uXG4gICAgICAgIGxldCBwcmV2U2xpZGVFbGVtcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJleHAtc2xpZGUtXCIrKHByZXZTbGlkZU51bWJlcisxKSlcbiAgICAgICAgZm9yKHZhciBpPTA7aTxwcmV2U2xpZGVFbGVtcy5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIHByZXZTbGlkZUVsZW1zW2ldLnN0eWxlLm9wYWNpdHkgPSAwO1xuICAgICAgICB9XG5cblxuICAgICAgICAvL3Nob3cgdGhlIEhUTUwgZWxlbWVudHMgZm9yIHRoZSBjdXJyZW50IHNsaWRlXG4gIFxuICAgICAgICBcbiAgICAgICAgLy9pdGVtcyB3aXRoIEhUTUwgY2xhc3MgZXhwLXNsaWRlLW5cbiAgICAgICAgbGV0IGVsZW1zVG9EaXNwbGF5T25seU9uVGhpc1NsaWRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZS1cIisoc2xpZGVOdW1iZXIrMSkpO1xuXG4gICAgICAgIGlmKHNsaWRlTnVtYmVyID49IHRoaXMubnVtSFRNTFNsaWRlcyAmJiBlbGVtc1RvRGlzcGxheU9ubHlPblRoaXNTbGlkZS5sZW5ndGggPT0gMCl7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiVHJpZWQgdG8gc2hvdyBzbGlkZSAjXCIrc2xpZGVOdW1iZXIrXCIsIGJ1dCBvbmx5IFwiICsgdGhpcy5udW1IVE1MU2xpZGVzICsgXCJIVE1MIGVsZW1lbnRzIHdpdGggZXhwLXNsaWRlIHdlcmUgZm91bmQhIE1ha2UgbW9yZSBzbGlkZXM/XCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKHZhciBpPTA7aTxlbGVtc1RvRGlzcGxheU9ubHlPblRoaXNTbGlkZS5sZW5ndGg7aSsrKXtcbiAgICAgICAgICAgIGVsZW1zVG9EaXNwbGF5T25seU9uVGhpc1NsaWRlW2ldLnN0eWxlLm9wYWNpdHkgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9pdGVtcyB3aXRoIGNsYXNzIGV4cC1zbGlkZVxuICAgICAgICBpZihzbGlkZU51bWJlciA8IHRoaXMuc2xpZGVzLmxlbmd0aCl7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1tzbGlkZU51bWJlcl0uc3R5bGUub3BhY2l0eSA9IDE7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8vdmVyYnNcbiAgICBhc3luYyBfc2xlZXAod2FpdFRpbWUpe1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIHdhaXRUaW1lKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGFzeW5jIGRlbGF5KHdhaXRUaW1lKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NsZWVwKHdhaXRUaW1lKTtcbiAgICB9XG4gICAgVHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMsIG9wdGlvbmFsQXJndW1lbnRzKXtcbiAgICAgICAgLy9pZiBzb21lb25lJ3MgdXNpbmcgdGhlIG9sZCBjYWxsaW5nIHN0cmF0ZWd5IG9mIHN0YWdnZXJGcmFjdGlvbiBhcyB0aGUgbGFzdCBhcmd1bWVudCwgY29udmVydCBpdCBwcm9wZXJseVxuICAgICAgICBpZihvcHRpb25hbEFyZ3VtZW50cyAmJiBVdGlscy5pc051bWJlcihvcHRpb25hbEFyZ3VtZW50cykpe1xuICAgICAgICAgICAgb3B0aW9uYWxBcmd1bWVudHMgPSB7c3RhZ2dlckZyYWN0aW9uOiBvcHRpb25hbEFyZ3VtZW50c307XG4gICAgICAgIH1cbiAgICAgICAgbmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDAsIHN0YWdnZXJGcmFjdGlvbj1zdGFnZ2VyRnJhY3Rpb24sIG9wdGlvbmFsQXJndW1lbnRzKTtcbiAgICB9XG59XG5cblxuXG5cblxuY29uc3QgRk9SV0FSRFMgPSAxO1xuY29uc3QgQkFDS1dBUkRTID0gMjtcbmNvbnN0IE5PX1NMSURFX01PVkVNRU5UID0gMztcblxuY2xhc3MgVW5kb0NhcGFibGVEaXJlY3RvciBleHRlbmRzIE5vbkRlY3JlYXNpbmdEaXJlY3RvcntcbiAgICAvL3Roc2kgZGlyZWN0b3IgdXNlcyBib3RoIGZvcndhcmRzIGFuZCBiYWNrd2FyZHMgYXJyb3dzLiB0aGUgYmFja3dhcmRzIGFycm93IHdpbGwgdW5kbyBhbnkgVW5kb0NhcGFibGVEaXJlY3Rvci5UcmFuc2l0aW9uVG8oKXNcbiAgICAvL3RvZG86IGhvb2sgdXAgdGhlIGFycm93cyBhbmQgbWFrZSBpdCBub3RcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKXtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAgICAgdGhpcy5mdXJ0aGVzdFNsaWRlSW5kZXggPSAwOyAvL21hdGNoZXMgdGhlIG51bWJlciBvZiB0aW1lcyBuZXh0U2xpZGUoKSBoYXMgYmVlbiBjYWxsZWRcbiAgICAgICAgLy90aGlzLmN1cnJlbnRTbGlkZUluZGV4IGlzIGFsd2F5cyA8IHRoaXMuZnVydGhlc3RTbGlkZUluZGV4IC0gaWYgZXF1YWwsIHdlIHJlbGVhc2UgdGhlIHByb21pc2UgYW5kIGxldCBuZXh0U2xpZGUoKSByZXR1cm5cblxuICAgICAgICB0aGlzLnVuZG9TdGFjayA9IFtdO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ID0gLTE7IC8vaW5jcmVhc2VkIGJ5IG9uZSBldmVyeSB0aW1lIGVpdGhlciB0aGlzLlRyYW5zaXRpb25UbyBpcyBjYWxsZWQgb3IgdGhpcy5uZXh0U2xpZGUoKSBpcyBjYWxsZWRcblxuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID0gTk9fU0xJREVfTU9WRU1FTlQ7IC8vdGhpcyB2YXJpYWJsZSBpcyB1c2VkIHRvIGVuc3VyZSB0aGF0IGlmIHlvdSByZWRvLCB0aGVuIHVuZG8gaGFsZndheSB0aHJvdWdoIHRoZSByZWRvLCB0aGUgcmVkbyBlbmRzIHVwIGNhbmNlbGxlZC4gXG5cbiAgICAgICAgLy9pZiB5b3UgcHJlc3MgcmlnaHQgYmVmb3JlIHRoZSBmaXJzdCBkaXJlY3Rvci5uZXh0U2xpZGUoKSwgZG9uJ3QgZXJyb3JcbiAgICAgICAgdGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBmdW5jdGlvbigpe30gXG5cbiAgICAgICAgZnVuY3Rpb24ga2V5TGlzdGVuZXIoZSl7XG4gICAgICAgICAgICBpZihlLnJlcGVhdClyZXR1cm47IC8va2V5ZG93biBmaXJlcyBtdWx0aXBsZSB0aW1lcyBidXQgd2Ugb25seSB3YW50IHRoZSBmaXJzdCBvbmVcbiAgICAgICAgICAgIGxldCBzbGlkZURlbHRhID0gMDtcbiAgICAgICAgICAgIHN3aXRjaCAoZS5rZXlDb2RlKSB7XG4gICAgICAgICAgICAgIGNhc2UgMzQ6XG4gICAgICAgICAgICAgIGNhc2UgMzk6XG4gICAgICAgICAgICAgIGNhc2UgNDA6XG4gICAgICAgICAgICAgICAgc2VsZi5oYW5kbGVGb3J3YXJkc1ByZXNzKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMzM6XG4gICAgICAgICAgICAgIGNhc2UgMzc6XG4gICAgICAgICAgICAgIGNhc2UgMzg6XG4gICAgICAgICAgICAgICAgc2VsZi5oYW5kbGVCYWNrd2FyZHNQcmVzcygpO1xuICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGtleUxpc3RlbmVyKTtcbiAgICB9XG5cbiAgICBzZXR1cENsaWNrYWJsZXMoKXtcbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHRoaXMubGVmdEFycm93ID0gbmV3IERpcmVjdGlvbkFycm93KGZhbHNlKTtcbiAgICAgICAgdGhpcy5sZWZ0QXJyb3cuaGlkZVNlbGYoKTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLmxlZnRBcnJvdy5hcnJvd0ltYWdlKTtcbiAgICAgICAgdGhpcy5sZWZ0QXJyb3cub25jbGlja0NhbGxiYWNrID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHNlbGYuaGFuZGxlQmFja3dhcmRzUHJlc3MoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmlnaHRBcnJvdyA9IG5ldyBEaXJlY3Rpb25BcnJvdyh0cnVlKTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLnJpZ2h0QXJyb3cuYXJyb3dJbWFnZSk7XG4gICAgICAgIHRoaXMucmlnaHRBcnJvdy5vbmNsaWNrQ2FsbGJhY2sgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgc2VsZi5oYW5kbGVGb3J3YXJkc1ByZXNzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtb3ZlRnVydGhlckludG9QcmVzZW50YXRpb24oKXtcbiAgICAgICAgICAgIC8vaWYgdGhlcmUncyBub3RoaW5nIHRvIHJlZG8sIChzbyB3ZSdyZSBub3QgaW4gdGhlIHBhc3Qgb2YgdGhlIHVuZG8gc3RhY2spLCBhZHZhbmNlIGZ1cnRoZXIuXG4gICAgICAgICAgICAvL2lmIHRoZXJlIGFyZSBsZXNzIEhUTUwgc2xpZGVzIHRoYW4gY2FsbHMgdG8gZGlyZWN0b3IubmV3U2xpZGUoKSwgY29tcGxhaW4gaW4gdGhlIGNvbnNvbGUgYnV0IGFsbG93IHRoZSBwcmVzZW50YXRpb24gdG8gcHJvY2VlZFxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJNb3ZpbmcgZnVydGhlciBpbnRvIHByZXNlbnRhdGlvbiFcIik7XG4gICAgICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4IDwgdGhpcy5udW1TbGlkZXMpe1xuICAgICAgICAgICAgICAgIHRoaXMuZnVydGhlc3RTbGlkZUluZGV4ICs9IDE7IFxuXG4gICAgICAgICAgICAgICAgdGhpcy5zd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KHRoaXMuY3VycmVudFNsaWRlSW5kZXggKyAxKTsgLy90aGlzIHdpbGwgY29tcGxhaW4gaW4gdGhlIGNvbnNvbGUgd2luZG93IGlmIHRoZXJlIGFyZSBsZXNzIHNsaWRlcyB0aGFuIG5ld1NsaWRlKCkgY2FsbHNcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dBcnJvd3MoKTsgLy9zaG93QXJyb3dzIG11c3QgY29tZSBhZnRlciB0aGlzLmN1cnJlbnRTbGlkZUluZGV4IGFkdmFuY2VzIG9yIGVsc2Ugd2Ugd29uJ3QgYmUgYWJsZSB0byB0ZWxsIGlmIHdlJ3JlIGF0IHRoZSBlbmQgb3Igbm90XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpOyAvL2FsbG93IHByZXNlbnRhdGlvbiBjb2RlIHRvIHByb2NlZWRcbiAgICB9XG4gICAgaXNDYXVnaHRVcFdpdGhOb3RoaW5nVG9SZWRvKCl7XG4gICAgICAgIHJldHVybiB0aGlzLnVuZG9TdGFja0luZGV4ID09IHRoaXMudW5kb1N0YWNrLmxlbmd0aC0xO1xuICAgIH1cblxuICAgIGFzeW5jIGhhbmRsZUZvcndhcmRzUHJlc3MoKXtcbiAgICAgICAgdGhpcy5yaWdodEFycm93LmhpZGVTZWxmKCk7XG5cbiAgICAgICAgLy9pZiB0aGVyZSdzIG5vdGhpbmcgdG8gcmVkbywgc2hvdyB0aGUgbmV4dCBzbGlkZVxuICAgICAgICBpZih0aGlzLmlzQ2F1Z2h0VXBXaXRoTm90aGluZ1RvUmVkbygpKXtcbiAgICAgICAgICAgIHRoaXMubW92ZUZ1cnRoZXJJbnRvUHJlc2VudGF0aW9uKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB3ZSBnZXQgdG8gaGVyZSwgd2UndmUgcHJldmlvdXNseSBkb25lIGFuIHVuZG8sIGFuZCB3ZSdyZSBpbiB0aGUgcGFzdC4gV2UgbmVlZCB0byBjYXRjaCB1cCBhbmQgcmVkbyBhbGwgdGhvc2UgaXRlbXNcblxuICAgICAgICAvL29ubHkgcmVkbyBpZiB3ZSdyZSBub3QgYWxyZWFkeSByZWRvaW5nXG4gICAgICAgIC8vdG9kbzogYWRkIGFuIGlucHV0IGJ1ZmZlciBpbnN0ZWFkIG9mIGRpc2NhcmRpbmcgdGhlbVxuICAgICAgICBpZih0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPT0gRk9SV0FSRFMpcmV0dXJuO1xuICAgICAgICB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPSBGT1JXQVJEUztcblxuICAgICAgICAvL0Fzc3VtcHRpb246IHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdIGlzIGEgTmV3U2xpZGVVbmRvSXRlbVxuICAgICAgICBhd2FpdCB0aGlzLnJlZG9Bbkl0ZW0odGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF0pO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ICs9IDE7XG5cbiAgICAgICAgd2hpbGUodGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF0uY29uc3RydWN0b3IgIT09IE5ld1NsaWRlVW5kb0l0ZW0pe1xuICAgICAgICAgICAgLy9sb29wIHRocm91Z2ggdW5kbyBzdGFjayBhbmQgcmVkbyBlYWNoIHVuZG8gdW50aWwgd2UgZ2V0IHRvIHRoZSBuZXh0IHNsaWRlXG5cbiAgICAgICAgICAgIC8vSWYgdGhlcmUncyBhIGRlbGF5IHNvbWV3aGVyZSBpbiB0aGUgdW5kbyBzdGFjaywgYW5kIHdlIHNsZWVwIGZvciBzb21lIGFtb3VudCBvZiB0aW1lLCB0aGUgdXNlciBtaWdodCBoYXZlIHByZXNzZWQgdW5kbyBkdXJpbmcgdGhhdCB0aW1lLiBJbiB0aGF0IGNhc2UsIGhhbmRsZUJhY2t3YXJkc1ByZXNzKCkgd2lsbCBzZXQgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uIHRvIEJBQ0tXQVJEUy4gQnV0IHdlJ3JlIHN0aWxsIHJ1bm5pbmcsIHNvIHdlIHNob3VsZCBzdG9wIHJlZG9pbmchXG4gICAgICAgICAgICBpZih0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gIT0gRk9SV0FSRFMpe1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IHJlZG9JdGVtID0gdGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF1cbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVkb0FuSXRlbShyZWRvSXRlbSk7XG5cbiAgICAgICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPT0gdGhpcy51bmRvU3RhY2subGVuZ3RoLTEpe1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ICs9IDE7XG5cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPSBOT19TTElERV9NT1ZFTUVOVDtcbiAgICAgICAgdGhpcy5zd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KHRoaXMuY3VycmVudFNsaWRlSW5kZXggKyAxKTtcbiAgICAgICAgdGhpcy5zaG93QXJyb3dzKCk7XG4gICAgfVxuXG4gICAgYXN5bmMgcmVkb0FuSXRlbShyZWRvSXRlbSl7XG4gICAgICAgIHN3aXRjaChyZWRvSXRlbS50eXBlKXtcbiAgICAgICAgICAgIGNhc2UgREVMQVk6XG4gICAgICAgICAgICAgICAgLy93aGlsZSByZWRvaW5nLCBza2lwIGRlbGF5c1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBUUkFOU0lUSU9OVE86XG4gICAgICAgICAgICAgICAgdmFyIHJlZG9BbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKHJlZG9JdGVtLnRhcmdldCwgcmVkb0l0ZW0udG9WYWx1ZXMsIHJlZG9JdGVtLmR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IHJlZG9JdGVtLmR1cmF0aW9uTVMvMTAwMCwgcmVkb0l0ZW0ub3B0aW9uYWxBcmd1bWVudHMpO1xuICAgICAgICAgICAgICAvL2FuZCBub3cgcmVkb0FuaW1hdGlvbiwgaGF2aW5nIGJlZW4gY3JlYXRlZCwgZ29lcyBvZmYgYW5kIGRvZXMgaXRzIG93biB0aGluZyBJIGd1ZXNzLiB0aGlzIHNlZW1zIGluZWZmaWNpZW50LiB0b2RvOiBmaXggdGhhdCBhbmQgbWFrZSB0aGVtIGFsbCBjZW50cmFsbHkgdXBkYXRlZCBieSB0aGUgYW5pbWF0aW9uIGxvb3Agb3Jzb21ldGhpbmdcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgTkVXU0xJREU6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaGFuZGxlQmFja3dhcmRzUHJlc3MoKXtcbiAgICAgICAgdGhpcy5sZWZ0QXJyb3cuaGlkZVNlbGYoKTtcblxuICAgICAgICBpZih0aGlzLnVuZG9TdGFja0luZGV4ID09IDAgfHwgdGhpcy5jdXJyZW50U2xpZGVJbmRleCA9PSAwKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vb25seSB1bmRvIGlmIHdlJ3JlIG5vdCBhbHJlYWR5IHVuZG9pbmdcbiAgICAgICAgaWYodGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uID09IEJBQ0tXQVJEUylyZXR1cm47XG4gICAgICAgIHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiA9IEJBQ0tXQVJEUztcblxuICAgICAgICAvL0Fzc3VtcHRpb246IHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdIGlzIGEgTmV3U2xpZGVVbmRvSXRlbVxuICAgICAgICB0aGlzLnVuZG9Bbkl0ZW0odGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF0pO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4IC09IDE7XG5cbiAgICAgICAgd2hpbGUodGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF0uY29uc3RydWN0b3IgIT09IE5ld1NsaWRlVW5kb0l0ZW0pe1xuICAgICAgICAgICAgLy9sb29wIHRocm91Z2ggdW5kbyBzdGFjayBhbmQgdW5kbyBlYWNoIGl0ZW0gdW50aWwgd2UgcmVhY2ggdGhlIHByZXZpb3VzIHNsaWRlXG5cbiAgICAgICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPT0gMCl7XG4gICAgICAgICAgICAgICAgLy9hdCBmaXJzdCBzbGlkZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL0lmIHRoZXJlJ3MgYSBkZWxheSBzb21ld2hlcmUgaW4gdGhlIHVuZG8gc3RhY2ssIGFuZCB3ZSBzbGVlcCBmb3Igc29tZSBhbW91bnQgb2YgdGltZSwgdGhlIHVzZXIgbWlnaHQgaGF2ZSBwcmVzc2VkIHJlZG8gZHVyaW5nIHRoYXQgdGltZS4gSW4gdGhhdCBjYXNlLCBoYW5kbGVGb3J3YXJkc1ByZXNzKCkgd2lsbCBzZXQgdGhpcy5jdXJyZW50UmVwbGF5RGlyZWN0aW9uIHRvIEZPUldBUkRTLiBCdXQgd2UncmUgc3RpbGwgcnVubmluZywgc28gd2Ugc2hvdWxkIHN0b3AgcmVkb2luZyFcbiAgICAgICAgICAgIGlmKHRoaXMuY3VycmVudFJlcGxheURpcmVjdGlvbiAhPSBCQUNLV0FSRFMpe1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy91bmRvIHRyYW5zZm9ybWF0aW9uIGluIHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdXG4gICAgICAgICAgICBsZXQgdW5kb0l0ZW0gPSB0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XTtcbiAgICAgICAgICAgIHRoaXMudW5kb0FuSXRlbSh1bmRvSXRlbSk7XG4gICAgICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4IC09IDE7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmN1cnJlbnRSZXBsYXlEaXJlY3Rpb24gPSBOT19TTElERV9NT1ZFTUVOVDtcbiAgICAgICAgdGhpcy5zd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KHRoaXMuY3VycmVudFNsaWRlSW5kZXggLSAxKTtcbiAgICAgICAgdGhpcy5zaG93QXJyb3dzKCk7XG4gICAgfVxuXG4gICAgdW5kb0FuSXRlbSh1bmRvSXRlbSl7XG4gICAgICAgIHN3aXRjaCh1bmRvSXRlbS50eXBlKXtcbiAgICAgICAgICAgICAgICBjYXNlIERFTEFZOlxuICAgICAgICAgICAgICAgICAgICAvL3doaWxlIHVuZG9pbmcsIHNraXAgYW55IGRlbGF5c1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFRSQU5TSVRJT05UTzpcbiAgICAgICAgICAgICAgICAgICAgbGV0IGR1cmF0aW9uID0gdW5kb0l0ZW0uZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gMSA6IHVuZG9JdGVtLmR1cmF0aW9uTVMvMTAwMDtcbiAgICAgICAgICAgICAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1pbihkdXJhdGlvbiAvIDIsIDEpOyAvL3VuZG9pbmcgc2hvdWxkIGJlIGZhc3Rlciwgc28gY3V0IGl0IGluIGhhbGYgLSBidXQgY2FwIGR1cmF0aW9ucyBhdCAxc1xuICAgICAgICAgICAgICAgICAgICAvL3RvZG86IGludmVydCB0aGUgZWFzaW5nIG9mIHRoZSB1bmRvSXRlbSB3aGVuIGNyZWF0aW5nIHRoZSB1bmRvIGFuaW1hdGlvbj9cbiAgICAgICAgICAgICAgICAgICAgbGV0IGVhc2luZyA9IEVhc2luZy5FYXNlSW5PdXQ7XG4gICAgICAgICAgICAgICAgICAgIHZhciB1bmRvQW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbih1bmRvSXRlbS50YXJnZXQsIHVuZG9JdGVtLmZyb21WYWx1ZXMsIGR1cmF0aW9uLCB7c3RhZ2dlckZyYWN0aW9uOjAsIGVhc2luZzogZWFzaW5nfSk7XG4gICAgICAgICAgICAgICAgICAgIC8vYW5kIG5vdyB1bmRvQW5pbWF0aW9uLCBoYXZpbmcgYmVlbiBjcmVhdGVkLCBnb2VzIG9mZiBhbmQgZG9lcyBpdHMgb3duIHRoaW5nIEkgZ3Vlc3MuIHRoaXMgc2VlbXMgaW5lZmZpY2llbnQuIHRvZG86IGZpeCB0aGF0IGFuZCBtYWtlIHRoZW0gYWxsIGNlbnRyYWxseSB1cGRhdGVkIGJ5IHRoZSBhbmltYXRpb24gbG9vcCBvcnNvbWV0aGluZ1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIE5FV1NMSURFOlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICB9XG5cbiAgICBzaG93QXJyb3dzKCl7XG4gICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPiAwKXtcbiAgICAgICAgICAgIHRoaXMubGVmdEFycm93LnNob3dTZWxmKCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5sZWZ0QXJyb3cuaGlkZVNlbGYoKTtcbiAgICAgICAgfVxuICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4IDwgdGhpcy5udW1TbGlkZXMpe1xuICAgICAgICAgICAgdGhpcy5yaWdodEFycm93LnNob3dTZWxmKCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5yaWdodEFycm93LmhpZGVTZWxmKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBuZXh0U2xpZGUoKXtcbiAgICAgICAgLypUaGUgdXNlciB3aWxsIGNhbGwgdGhpcyBmdW5jdGlvbiB0byBtYXJrIHRoZSB0cmFuc2l0aW9uIGJldHdlZW4gb25lIHNsaWRlIGFuZCB0aGUgbmV4dC4gVGhpcyBkb2VzIHR3byB0aGluZ3M6XG4gICAgICAgIEEpIHdhaXRzIHVudGlsIHRoZSB1c2VyIHByZXNzZXMgdGhlIHJpZ2h0IGFycm93IGtleSwgcmV0dXJucywgYW5kIGNvbnRpbnVlcyBleGVjdXRpb24gdW50aWwgdGhlIG5leHQgbmV4dFNsaWRlKCkgY2FsbFxuICAgICAgICBCKSBpZiB0aGUgdXNlciBwcmVzc2VzIHRoZSBsZWZ0IGFycm93IGtleSwgdGhleSBjYW4gdW5kbyBhbmQgZ28gYmFjayBpbiB0aW1lLCBhbmQgZXZlcnkgVHJhbnNpdGlvblRvKCkgY2FsbCBiZWZvcmUgdGhhdCB3aWxsIGJlIHVuZG9uZSB1bnRpbCBpdCByZWFjaGVzIGEgcHJldmlvdXMgbmV4dFNsaWRlKCkgY2FsbC4gQW55IG5vcm1hbCBqYXZhc2NyaXB0IGFzc2lnbm1lbnRzIHdvbid0IGJlIGNhdWdodCBpbiB0aGlzIDooXG4gICAgICAgIEMpIGlmIHVuZG9cbiAgICAgICAgKi9cbiAgICAgICAgaWYoIXRoaXMuaW5pdGlhbGl6ZWQpdGhyb3cgbmV3IEVycm9yKFwiRVJST1I6IFVzZSAuYmVnaW4oKSBvbiBhIERpcmVjdG9yIGJlZm9yZSBjYWxsaW5nIGFueSBvdGhlciBtZXRob2RzIVwiKTtcblxuICAgICAgICBcbiAgICAgICAgdGhpcy5udW1TbGlkZXMrKztcbiAgICAgICAgdGhpcy51bmRvU3RhY2sucHVzaChuZXcgTmV3U2xpZGVVbmRvSXRlbSh0aGlzLmN1cnJlbnRTbGlkZUluZGV4KSk7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXgrKztcbiAgICAgICAgdGhpcy5zaG93QXJyb3dzKCk7XG5cblxuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgLy9wcm9taXNlIGlzIHJlc29sdmVkIGJ5IGNhbGxpbmcgdGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24oKSB3aGVuIHRoZSB0aW1lIGNvbWVzXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgICAgICAgc2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBmdW5jdGlvbigpeyBcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBcbiAgICBhc3luYyBfc2xlZXAod2FpdFRpbWUpe1xuICAgICAgICBhd2FpdCBzdXBlci5fc2xlZXAod2FpdFRpbWUpO1xuICAgIH1cblxuICAgIGFzeW5jIGRlbGF5KHdhaXRUaW1lKXtcbiAgICAgICAgdGhpcy51bmRvU3RhY2sucHVzaChuZXcgRGVsYXlVbmRvSXRlbSh3YWl0VGltZSkpO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4Kys7XG4gICAgICAgIGF3YWl0IHRoaXMuX3NsZWVwKHdhaXRUaW1lKTtcbiAgICB9XG4gICAgVHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMsIG9wdGlvbmFsQXJndW1lbnRzKXtcbiAgICAgICAgdmFyIGFuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwLCBvcHRpb25hbEFyZ3VtZW50cyk7XG4gICAgICAgIGxldCBmcm9tVmFsdWVzID0gYW5pbWF0aW9uLmZyb21WYWx1ZXM7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrLnB1c2gobmV3IFVuZG9JdGVtKHRhcmdldCwgdG9WYWx1ZXMsIGZyb21WYWx1ZXMsIGR1cmF0aW9uTVMsIG9wdGlvbmFsQXJndW1lbnRzKSk7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXgrKztcbiAgICB9XG59XG5cblxuLy9kaXNjb3VudCBlbnVtXG5jb25zdCBUUkFOU0lUSU9OVE8gPSAwO1xuY29uc3QgTkVXU0xJREUgPSAxO1xuY29uc3QgREVMQVk9MjtcblxuLy90aGluZ3MgdGhhdCBjYW4gYmUgc3RvcmVkIGluIGEgVW5kb0NhcGFibGVEaXJlY3RvcidzIC51bmRvU3RhY2tbXVxuY2xhc3MgVW5kb0l0ZW17XG4gICAgY29uc3RydWN0b3IodGFyZ2V0LCB0b1ZhbHVlcywgZnJvbVZhbHVlcywgZHVyYXRpb25NUywgb3B0aW9uYWxBcmd1bWVudHMpe1xuICAgICAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcbiAgICAgICAgdGhpcy50b1ZhbHVlcyA9IHRvVmFsdWVzO1xuICAgICAgICB0aGlzLmZyb21WYWx1ZXMgPSBmcm9tVmFsdWVzO1xuICAgICAgICB0aGlzLmR1cmF0aW9uTVMgPSBkdXJhdGlvbk1TO1xuICAgICAgICB0aGlzLnR5cGUgPSBUUkFOU0lUSU9OVE87XG4gICAgICAgIHRoaXMub3B0aW9uYWxBcmd1bWVudHMgPSBvcHRpb25hbEFyZ3VtZW50cztcbiAgICB9XG59XG5cbmNsYXNzIE5ld1NsaWRlVW5kb0l0ZW17XG4gICAgY29uc3RydWN0b3Ioc2xpZGVJbmRleCl7XG4gICAgICAgIHRoaXMuc2xpZGVJbmRleCA9IHNsaWRlSW5kZXg7XG4gICAgICAgIHRoaXMudHlwZSA9IE5FV1NMSURFO1xuICAgIH1cbn1cblxuY2xhc3MgRGVsYXlVbmRvSXRlbXtcbiAgICBjb25zdHJ1Y3Rvcih3YWl0VGltZSl7XG4gICAgICAgIHRoaXMud2FpdFRpbWUgPSB3YWl0VGltZTtcbiAgICAgICAgdGhpcy50eXBlID0gREVMQVk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBOb25EZWNyZWFzaW5nRGlyZWN0b3IsIERpcmVjdGlvbkFycm93LCBVbmRvQ2FwYWJsZURpcmVjdG9yIH07XG4iXSwibmFtZXMiOlsiTWF0aCIsIlV0aWxzIiwidGhyZWVFbnZpcm9ubWVudCIsIm1hdGgubGVycFZlY3RvcnMiLCJyZXF1aXJlIiwicmVxdWlyZSQkMCIsInJlcXVpcmUkJDEiLCJyZXF1aXJlJCQyIiwiZ2xvYmFsIiwidlNoYWRlciIsImZTaGFkZXIiLCJ1bmlmb3JtcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0NBQUE7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFQSxNQUFNLElBQUk7Q0FDVixDQUFDLFdBQVcsRUFBRTtDQUNkLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7Q0FDckIsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztDQUNyQixLQUFLO0NBQ0wsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0NBQ1g7Q0FDQSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQzVCLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Q0FDdEIsRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO0NBQ2pDLEVBQUUsT0FB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QUFhLElBQUksQ0FBQyxDQUFDO0NBQzdCLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDNUMsSUFBSSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEcsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7Q0FDbEIsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxJQUFJO0NBQ0osR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7Q0FDbkM7Q0FDQSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzVDLElBQUksSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3RHLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDN0MsS0FBSyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdkcsS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDOUMsS0FBSyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM5QyxLQUFLO0NBQ0wsSUFBSTtDQUNKLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO0NBQ25DO0NBQ0EsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM1QyxJQUFJLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN0RyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzdDLEtBQUssSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3ZHLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDOUMsTUFBTSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDeEcsTUFBTSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUM1RSxNQUFNLElB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LE9BQU8sVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBT0csZUFBTyxFQUFFLFVBQVUsRUFBRUEsZUFBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPQSxlQUFPLEVBQUUsVUFBVSxFQUFFQSxlQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxTQUFTLFlBQVksRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFVBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLEdBQUcsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsWUFBWSxLQUFLLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLG9CQUFtQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsK0NBQStDLENBQUMscUNBQXFDLENBQUMsa0RBQWtELENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE9BQU8sT0FBTyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxRQUFRLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLGdCQUFnQixDQUFDLFNBQVMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFDLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLFNBQVMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsVUFBVSxDQUFDLFNBQVMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsUUFBUSxDQUFDLFNBQVMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsUUFBUSxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxVQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxHQUFHLFlBQVksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFZLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixHQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsR0FBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFHLElBQUksRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBSyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssNEJBQTRCLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEFBQW1CLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBSyxDQUFDLENBQUMsT0FBTyxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxNQUFNLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFVLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLFdBQVcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLFNBQVMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsR0FBRyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLEVBQUUsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsTUFBTSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFDLENBQUMsVUFBVSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsQUFBd0IsSUFBSSxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxBQUFhLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLElBQUksY0FBYyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLFFBQVEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxRQUFRLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFTLENBQUMsU0FBUyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLFdBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTLENBQUMsT0FBTyxXQUFXLENBQUMsU0FBUyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBUyxDQUFDLFNBQVMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxFQUFFLFdBQVcsQ0FBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxhQUFhLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxRQUFRLEdBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxTQUFTLFdBQVcsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyw2RkFBNkYsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxRQUFRLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBQyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsVUFBVSxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksR0FBRyxHQUFHLEdBQUcsT0FBTyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxJQUFJLGFBQWEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsYUFBYSxDQUFDLEdBQUcsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsT0FBTyxTQUFTLEdBQUcsV0FBVyxFQUFFLFNBQVMsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyx3QkFBd0IsR0FBRyxXQUFXLEVBQUUsd0JBQXdCLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSx3QkFBd0IsRUFBRSxPQUFPLHFCQUFxQixHQUFHLFdBQVcsRUFBRSxxQkFBcUIsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLHFCQUFxQixDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQUssQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBTSxVQUFVLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLFNBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLFlBQVksRUFBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEdBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxNQUFLLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGdCQUFnQixHQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENB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Q0FBQyxDQUFDLENBQUM7Q0FDM0UsS0FBSztDQUNMLElBQUkscUJBQXFCLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDO0NBQzdFO0NBQ0EsUUFBUSxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDO0NBQy9ELFFBQVEsSUFBSSxLQUFLLEdBQUcsV0FBVyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7O0NBRXhDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDOztDQUU1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQzs7Q0FFNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM1QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDO0NBQzVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7O0NBRTVDLFFBQVEsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUM7Q0FDNUMsUUFBUSxVQUFVLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQztDQUM3QyxRQUFRLFVBQVUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFD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S0FBSzs7Q0FFTDtDQUNBLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLEtBQUssSUFBSTtDQUNUO0NBQ0EsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLEtBQUssY0FBYyxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQzFCLEtBQUs7O0NBRUw7Q0FDQTtDQUNBLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNsSjtDQUNBLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FB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
