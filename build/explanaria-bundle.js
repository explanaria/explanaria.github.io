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
	let Math$1 = {clone: clone, lerpVectors: lerpVectors, vectorAdd: vectorAdd, multiplyScalar: multiplyScalar, multiplyMatrix: multiplyMatrix};

	class Utils{

		static isArray(x){
			return x.constructor === Array;
		}
		static arrayCopy(x){
			return x.slice();
		}
		static isFunction(x){
			return x.constructor === Function;
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
	}

	class Area extends DomainNode{
		constructor(options){
			super();

			/*var axes = new EXP.Area({
			bounds: [[-10,10],
				[10,10]]
			numItems: 10; //optional. Alternately numItems can vary for each axis: numItems: [10,2]
			})*/


		
			Utils.assertPropExists(options, "bounds"); // a multidimensional array
			Utils.assertType(options.bounds, Array);
			Utils.assertType(options.bounds[0], Array, "For an Area, options.bounds must be a multidimensional array, even for one dimension!"); // it MUST be multidimensional
			this.numDimensions = options.bounds.length;

			Utils.assert(options.bounds[0].length != 0); //don't accept [[]], it needs to be [[1,2]].

			this.bounds = options.bounds;
			this.numItems = options.numItems || 16;

			this.itemDimensions = []; // array to store the number of times this is called per dimension.

			if(this.numItems.constructor === Number){
				for(var i=0;i<this.numDimensions;i++){
					this.itemDimensions.push(this.numItems);
				}
			}else if(this.numItems.constructor === Array){
				Utils.assert(options.numItems.length == options.bounds.length);
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
			let clone = new Area({bounds: Utils.arrayCopy(this.bounds), numItems: this.numItems});
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

	class Animation{
		constructor(target, toValues, duration, staggerFraction){
			Utils.assertType(toValues, Object);

			this.toValues = toValues;
			this.target = target;	
			this.staggerFraction = staggerFraction === undefined ? 0 : staggerFraction; // time in ms between first element beginning the animation and last element beginning the animation. Should be less than duration.

			Utils.assert(this.staggerFraction >= 0 && this.staggerFraction < 1);

			this.fromValues = {};
			for(var property in this.toValues){
				Utils.assertPropExists(this.target, property);

				//copy property, making sure to store the correct 'this'
				if(Utils.isFunction(this.target[property])){
					this.fromValues[property] = this.target[property].bind(this.target);
				}else{
					this.fromValues[property] = this.target[property];
				}
			}


			this.duration = duration === undefined ? 1 : duration; //in s
			this.elapsedTime = 0;

	        this.prevTrueTime = 0;


			if(target.constructor === Transformation){
				//find out how many objects are passing through this transformation
				let root = target;
				while(root.parent !== null){
					root = root.parent;
				}
				this.targetNumCallsPerActivation = root.numCallsPerActivation;
			}else{
				if(this.staggerFraction != 0){
					console.error("staggerFraction can only be used when TransitionTo's target is an EXP.Transformation!");
				}
			}

			//begin
			this._updateCallback = this.update.bind(this);
			exports.threeEnvironment.on("update",this._updateCallback);
		}
		update(time){
			this.elapsedTime += time.realtimeDelta;	

			let percentage = this.elapsedTime/this.duration;

			//interpolate values
			for(let property in this.toValues){
				this.interpolate(percentage, property, this.fromValues[property],this.toValues[property]);
			}

			if(this.elapsedTime >= this.duration){
				this.end();
			}
		}
		interpolate(percentage, propertyName, fromValue, toValue){
			const numObjects = this.targetNumCallsPerActivation;
			if(typeof(toValue) === "number" && typeof(fromValue) === "number"){
				let t = this.interpolationFunction(percentage);
				this.target[propertyName] = t*toValue + (1-t)*fromValue;
				return;
			}else if(Utils.isFunction(toValue) && Utils.isFunction(fromValue)){
				//if staggerFraction != 0, it's the amount of time between the first point's start time and the last point's start time.
				//ASSUMPTION: the first variable of this function is i, and it's assumed i is zero-indexed.

				//encapsulate percentage
				this.target[propertyName] = (function(...coords){
	                const i = coords[0];
					let lerpFactor = percentage;

	                //fancy staggering math, if we know how many objects are flowing through this transformation at once
	                if(this.targetNumCallsPerActivation !== undefined){
	                    lerpFactor = percentage/(1-this.staggerFraction+EPS) - i*this.staggerFraction/this.targetNumCallsPerActivation;
	                }
					//let percent = Math.min(Math.max(percentage - i/this.targetNumCallsPerActivation   ,1),0);

					let t = this.interpolationFunction(Math.max(Math.min(lerpFactor,1),0));
					return lerpVectors(t,toValue(...coords),fromValue(...coords))
				}).bind(this);
				return;
			}else if(toValue.constructor === THREE.Color && fromValue.constructor === THREE.Color){
	            let t = this.interpolationFunction(percentage);
	            let color = fromValue.clone();
	            this.target[propertyName] = color.lerp(toValue, t);
	        }else if(typeof(toValue) === "boolean" && typeof(fromValue) === "boolean"){
	            let t = this.interpolationFunction(percentage);
	            this.target[propertyName] = t > 0.5 ? toValue : fromValue;
	        }else{
				console.error("Animation class cannot yet handle transitioning between things that aren't numbers or functions!");
			}

		}
		interpolationFunction(x){
			return this.cosineInterpolation(x);
		}
		cosineInterpolation(x){
			return (1-Math.cos(x*Math.PI))/2;
		}
		linearInterpolation(x){
			return x;
		}
		end(){
			for(var prop in this.toValues){
				this.target[prop] = this.toValues[prop];
			}
			exports.threeEnvironment.removeEventListener("update",this._updateCallback);
			//Todo: delete this
		}
	}

	//todo: put this into a Director class so that it can have an undo stack
	function TransitionTo(target, toValues, durationMS, staggerFraction){
		var animation = new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000, staggerFraction);
	}

	var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

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


	    this.onWindowResize(); //resize canvas to window size and set aspect ratio
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

		window.addEventListener( 'resize', this.onWindowResize.bind(this), false );

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
	ThreeasyEnvironment.prototype.onWindowResize= function() {

	    let width = window.innerWidth;
	    let height = window.innerHeight;
	    
	    if(!this.shouldCreateCanvas){ // a canvas was provided externally

	        width = this.renderer.domElement.clientWidth;
	        height = this.renderer.domElement.clientHeight;
	    }

		this.camera.aspect = width / height;
	    //this.camera.setFocalLength(30); //if I use this, the camera will keep a constant width instead of constant height
		this.aspect = this.camera.aspect;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( this.evenify(width), this.evenify(height),this.shouldCreateCanvas );
	};
	ThreeasyEnvironment.prototype.listeners = {"update": [],"render":[]}; //update event listeners
	ThreeasyEnvironment.prototype.render = function(timestep){
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
		onWindowResize() {
			//stop recording if window size changes
			if(this.rendering && window.innerWidth / window.innerHeight != this.aspect){
				this.capturer.stop();
				this.render = null; //hacky way of stopping the rendering
				alert("Aborting record: Window-size change detected!");
				this.rendering = false;
				return;
			}
			super.onWindowResize();
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

	class LineOutput extends OutputNode{
		constructor(options = {}){
			super();
			/* should be .add()ed to a Transformation to work
				options:
				{
					width: number
					opacity: number
					color: hex code or THREE.Color()
				}
			*/

			this._width = options.width !== undefined ? options.width : 5;
			this._opacity = options.opacity !== undefined ? options.opacity : 1;
			this._color = options.color !== undefined ? new THREE.Color(options.color) : new THREE.Color(0x55aa55);

			this.numCallsPerActivation = 0; //should always be equal to this.points.length
			this.itemDimensions = []; // how many times to be called in each direction
			this._outputDimensions = 3; //how many dimensions per point to store?

			this.init();
		}
		init(){
			this._geometry = new THREE.BufferGeometry();
			this._vertices;
			this.makeGeometry();

			this.material = new THREE.LineBasicMaterial({vertexColors: THREE.VertexColors, linewidth: this._width,opacity:this._opacity});
			this.mesh = new THREE.LineSegments(this._geometry,this.material);

			this.opacity = this._opacity; // setter sets transparent flag if necessary

			exports.threeEnvironment.scene.add(this.mesh);
		}

		makeGeometry(){
			// follow http://blog.cjgammon.com/threejs-geometry
			// or mathbox's lineGeometry

			/*
			This code seems to be necessary to render lines as a triangle strp.
			I can't seem to get it to work properly.

			let numVertices = 3;
			var indices = [];

			//indices
			let base = 0;
			for(var k=0;k<numVertices-1;k+=1){
	        	indices.push( base, base+1, base+2);
				indices.push( base+2, base+1, base+3);
				base += 2;
			}
			this._geometry.setIndex( indices );*/

			const MAX_POINTS = 10000;
	        const NUM_POINTS_PER_LINE_SEGMENT = 2;

			this._vertices = new Float32Array(this._outputDimensions * (MAX_POINTS-1)*NUM_POINTS_PER_LINE_SEGMENT);
			this._colors = new Float32Array((MAX_POINTS-1)*NUM_POINTS_PER_LINE_SEGMENT * 3);

			// build geometry

			this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
	        this._geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( this._colors, 3 ) );
			//this._geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
			//this.geometry.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

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


	        // Why use (this.numCallsPerActivation-1)*2? 
	        // We want to render a chain with n points, each connected to the one in front of it by a line except the last one. Then because the last vertex doesn't introduce a new line, there are n-1 lines between the chain points.
	        // Each line is rendered using two vertices. So we multiply the number of lines, this.numCallsPerActivation-1, by two.
	        const NUM_POINTS_PER_LINE_SEGMENT = 2;

			let vertices = new Float32Array( this._outputDimensions * (this.numCallsPerActivation-1) * NUM_POINTS_PER_LINE_SEGMENT);
			let colors = new Float32Array( 3 * (this.numCallsPerActivation-1) * NUM_POINTS_PER_LINE_SEGMENT);

			let positionAttribute = this._geometry.attributes.position;
			this._vertices = vertices;
			positionAttribute.setArray(this._vertices);

			let colorAttribute = this._geometry.attributes.color;
			this._colors = colors;
			colorAttribute.setArray(this._colors);

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

			let index = this._currentPointIndex*this._outputDimensions;

		    this._vertices[index]   = x === undefined ? 0 : x;
			this._vertices[index+1] = y === undefined ? 0 : y;
			this._vertices[index+2] = z === undefined ? 0 : z;

			this._currentPointIndex++;

			/* we're drawing like this:
			*----*----*

	        *----*----*
		
			but we don't want to insert a diagonal line anywhere. This handles that:  */

			let firstCoordinate = i % this.itemDimensions[this.itemDimensions.length-1];

			if(!(firstCoordinate == 0 || firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1)){
				this._vertices[index+this._outputDimensions]   = x === undefined ? 0 : x;
				this._vertices[index+this._outputDimensions+1] = y === undefined ? 0 : y;
				this._vertices[index+this._outputDimensions+2] = z === undefined ? 0 : z;
				this._currentPointIndex++;
			}

			//vertices should really be an uniform, though.
		}
		onAfterActivation(){
			let positionAttribute = this._geometry.attributes.position;
			positionAttribute.needsUpdate = true;
			this._currentPointIndex = 0; //reset after each update
		}
	    removeSelfFromScene(){
	        exports.threeEnvironment.scene.remove(this.mesh);
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
	        colorArray[vertexIndex*3 + 0] = normalizedR;
	        colorArray[vertexIndex*3 + 1] = normalizedG;
	        colorArray[vertexIndex*3 + 2] = normalizedB;

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
			this.material.opacity = opacity;
			this.material.transparent = opacity < 1;
			this.material.visible = opacity > 0;
			this._opacity = opacity;
		}
		get opacity(){
			return this._opacity;
		}
		set width(width){
			this._width = width;
			this.material.linewidth = width;
		}
		get width(){
			return this._width;
		}
		clone(){
			return new LineOutput({width: this.width, color: this.color, opacity: this.opacity});
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
			/*input: Transformation
				width: number
			*/
			super(options);

		}
		init(){
			this._geometry = new THREE.BufferGeometry();
			this._vertices;
			this.arrowheads = [];


			this.material = new THREE.LineBasicMaterial({vertexColors: THREE.VertexColors, linewidth: this._width, opacity:this._opacity});
	        //TODO: make the arrow tip colors match the colors of the lines' tips
			this.arrowMaterial = new THREE.LineBasicMaterial({color: this._color, linewidth: this._width, opacity:this._opacity});
			this.lineMesh = new THREE.LineSegments(this._geometry,this.material);

			this.opacity = this._opacity; // setter sets transparent flag if necessary


			const circleResolution = 12;
			const arrowheadSize = 0.3;
			const EPSILON = 0.00001;
			this.EPSILON = EPSILON;

			this.coneGeometry = new THREE.CylinderBufferGeometry( 0, arrowheadSize, arrowheadSize*1.7, circleResolution, 1 );
			let arrowheadOvershootFactor = 0.1; //used so that the line won't rudely clip through the point of the arrowhead

			this.coneGeometry.translate( 0, - arrowheadSize + arrowheadOvershootFactor, 0 );

			this._coneUpDirection = new THREE.Vector3(0,1,0);

			this.makeGeometry();

	        this.mesh = new THREE.Object3D();
	        this.mesh.add(this.lineMesh);

			exports.threeEnvironment.scene.add(this.mesh);
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
			if(!this._activatedOnce){
				this._activatedOnce = true;
				this._onFirstActivation();	
			}

			//assert i < vertices.count

			let index = this._currentPointIndex*this._outputDimensions;

		    this._vertices[index]   = x === undefined ? 0 : x;
			this._vertices[index+1] = y === undefined ? 0 : y;
			this._vertices[index+2] = z === undefined ? 0 : z;

			this._currentPointIndex++;

			/* we're drawing like this:
			*----*----*

	        *----*----*
		
			but we don't want to insert a diagonal line anywhere. This handles that:  */

			let firstCoordinate = i % this.itemDimensions[this.itemDimensions.length-1];

			//vertices should really be an uniform, though.
			if(!(firstCoordinate == 0 || firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1)){
				this._vertices[index+this._outputDimensions]   = x === undefined ? 0 : x;
				this._vertices[index+this._outputDimensions+1] = y === undefined ? 0 : y;
				this._vertices[index+this._outputDimensions+2] = z === undefined ? 0 : z;
				this._currentPointIndex++;
			}

			if(firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1){

				//calculate direction of last line segment
				let dx = this._vertices[index-this._outputDimensions] - this._vertices[index];
				let dy = this._vertices[index-this._outputDimensions+1] - this._vertices[index+1];
				let dz = this._vertices[index-this._outputDimensions+2] - this._vertices[index+2];

				let lineNumber = Math.floor(i / this.itemDimensions[this.itemDimensions.length-1]);
				Utils.assert(lineNumber <= this.numArrowheads); //this may be wrong

				let directionVector = new THREE.Vector3(-dx,-dy,-dz);

				//Make arrows disappear if the line is small enough
				//One way to do this would be to sum the distances of all line segments. I'm cheating here and just measuring the distance of the last vector, then multiplying by the number of line segments (naively assuming all line segments are the same length)
				let length = directionVector.length() * (this.itemDimensions[this.itemDimensions.length-1]-1);

				const effectiveDistance = 3;

				let clampedLength = Math.max(0, Math.min(length/effectiveDistance, 1))/1;

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
	        this.arrowMaterial.color = this._color;
		}

		get color(){
			return this._color;
		}

	    set opacity(opacity){
			this.arrowMaterial.opacity = opacity;
			this.arrowMaterial.transparent = opacity < 1;
			this.arrowMaterial.visible = opacity > 0;

			this.material.opacity = opacity;
			this.material.transparent = opacity < 1;
			this.material.visible = opacity > 0;
			this._opacity = opacity;
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
			return new VectorOutput({width: this.width, color: this.color, opacity: this.opacity});
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
	    TransitionTo(target, toValues, durationMS){
	        //Utils.Assert(this.undoStackIndex == 0); //This may not work well.
	        new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000);
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
	                    var redoAnimation = new Animation(redoItem.target, redoItem.toValues, redoItem.durationMS === undefined ? undefined : redoItem.durationMS/1000);
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
	                    var undoAnimation = new Animation(undoItem.target, undoItem.fromValues, duration);
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
	    TransitionTo(target, toValues, durationMS){
	        var animation = new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000);
	        let fromValues = animation.fromValues;
	        this.undoStack.push(new UndoItem(target, toValues, fromValues, durationMS));
	        this.undoStackIndex++;
	    }
	}


	//discount enum
	const TRANSITIONTO = 0;
	const NEWSLIDE = 1;
	const DELAY=2;

	//things that can be stored in a UndoCapableDirector's .undoStack[]
	class UndoItem{
	    constructor(target, toValues, fromValues, durationMS){
	        this.target = target;
	        this.toValues = toValues;
	        this.fromValues = fromValues;
	        this.durationMS = durationMS;
	        this.type = TRANSITIONTO;
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
	exports.Utils = Utils;
	exports.Math = Math$1;
	exports.Array = EXPArray;
	exports.Area = Area;
	exports.HistoryRecorder = HistoryRecorder;
	exports.TransitionTo = TransitionTo;
	exports.Animation = Animation;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9IaXN0b3J5UmVjb3JkZXIuanMiLCIuLi9zcmMvanMvVGhyZWVFbnZpcm9ubWVudC5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL291dHB1dHMvTGluZU91dHB1dC5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1BvaW50T3V0cHV0LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvVmVjdG9yT3V0cHV0LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvU3VyZmFjZU91dHB1dFNoYWRlcnMuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9TdXJmYWNlT3V0cHV0LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvRmxhdEFycmF5T3V0cHV0LmpzIiwiLi4vc3JjL2pzL0RpcmVjdG9ySW1hZ2VDb25zdGFudHMuanMiLCIuLi9zcmMvanMvRGlyZWN0b3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyogVGhlIGJhc2UgY2xhc3MgdGhhdCBldmVyeXRoaW5nIGluaGVyaXRzIGZyb20uIFxuXHRFYWNoIHRoaW5nIGRyYXduIHRvIHRoZSBzY3JlZW4gaXMgYSB0cmVlLiBEb21haW5zLCBzdWNoIGFzIEVYUC5BcmVhIG9yIEVYUC5BcnJheSBhcmUgdGhlIHJvb3Qgbm9kZXMsXG5cdEVYUC5UcmFuc2Zvcm1hdGlvbiBpcyBjdXJyZW50bHkgdGhlIG9ubHkgaW50ZXJtZWRpYXRlIG5vZGUsIGFuZCB0aGUgbGVhZiBub2RlcyBhcmUgc29tZSBmb3JtIG9mIE91dHB1dCBzdWNoIGFzXG5cdEVYUC5MaW5lT3V0cHV0IG9yIEVYUC5Qb2ludE91dHB1dCwgb3IgRVhQLlZlY3Rvck91dHB1dC5cblxuXHRBbGwgb2YgdGhlc2UgY2FuIGJlIC5hZGQoKWVkIHRvIGVhY2ggb3RoZXIgdG8gZm9ybSB0aGF0IHRyZWUsIGFuZCB0aGlzIGZpbGUgZGVmaW5lcyBob3cgaXQgd29ya3MuXG4qL1xuXG5jbGFzcyBOb2Rle1xuXHRjb25zdHJ1Y3RvcigpeyAgICAgICAgXG5cdFx0dGhpcy5jaGlsZHJlbiA9IFtdO1xuXHRcdHRoaXMucGFyZW50ID0gbnVsbDsgICAgICAgIFxuICAgIH1cblx0YWRkKHRoaW5nKXtcblx0XHQvL2NoYWluYWJsZSBzbyB5b3UgY2FuIGEuYWRkKGIpLmFkZChjKSB0byBtYWtlIGEtPmItPmNcblx0XHR0aGlzLmNoaWxkcmVuLnB1c2godGhpbmcpO1xuXHRcdHRoaW5nLnBhcmVudCA9IHRoaXM7XG5cdFx0aWYodGhpbmcuX29uQWRkKXRoaW5nLl9vbkFkZCgpO1xuXHRcdHJldHVybiB0aGluZztcblx0fVxuXHRfb25BZGQoKXt9XG5cdHJlbW92ZSh0aGluZyl7XG5cdFx0dmFyIGluZGV4ID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKCB0aGluZyApO1xuXHRcdGlmICggaW5kZXggIT09IC0gMSApIHtcblx0XHRcdHRoaW5nLnBhcmVudCA9IG51bGw7XG5cdFx0XHR0aGlzLmNoaWxkcmVuLnNwbGljZSggaW5kZXgsIDEgKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cbiAgICBnZXRUb3BQYXJlbnQoKXsgLy9maW5kIHRoZSBwYXJlbnQgb2YgdGhlIHBhcmVudCBvZiB0aGUuLi4gdW50aWwgdGhlcmUncyBubyBtb3JlIHBhcmVudHMuXG4gICAgICAgIGNvbnN0IE1BWF9DSEFJTiA9IDEwMDtcbiAgICAgICAgbGV0IHBhcmVudENvdW50ID0gMDtcblx0XHRsZXQgcm9vdCA9IHRoaXM7XG5cdFx0d2hpbGUocm9vdCAhPT0gbnVsbCAmJiByb290LnBhcmVudCAhPT0gbnVsbCAmJiBwYXJlbnRDb3VudCA8IE1BWF9DSEFJTil7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG4gICAgICAgICAgICBwYXJlbnRDb3VudCs9IDE7XG5cdFx0fVxuXHRcdGlmKHBhcmVudENvdW50ID49IE1BWF9DSEFJTil0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCB0b3AtbGV2ZWwgcGFyZW50IVwiKTtcbiAgICAgICAgcmV0dXJuIHJvb3Q7XG4gICAgfVxuICAgIGdldERlZXBlc3RDaGlsZHJlbigpeyAvL2ZpbmQgYWxsIGxlYWYgbm9kZXMgZnJvbSB0aGlzIG5vZGVcbiAgICAgICAgLy90aGlzIGFsZ29yaXRobSBjYW4gcHJvYmFibHkgYmUgaW1wcm92ZWRcbiAgICAgICAgaWYodGhpcy5jaGlsZHJlbi5sZW5ndGggPT0gMClyZXR1cm4gW3RoaXNdO1xuXG4gICAgICAgIGxldCBjaGlsZHJlbiA9IFtdO1xuICAgICAgICBmb3IobGV0IGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICBsZXQgY2hpbGRzQ2hpbGRyZW4gPSB0aGlzLmNoaWxkcmVuW2ldLmdldERlZXBlc3RDaGlsZHJlbigpO1xuICAgICAgICAgICAgZm9yKGxldCBqPTA7ajxjaGlsZHNDaGlsZHJlbi5sZW5ndGg7aisrKXtcbiAgICAgICAgICAgICAgICBjaGlsZHJlbi5wdXNoKGNoaWxkc0NoaWxkcmVuW2pdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hpbGRyZW47XG4gICAgfVxuICAgIGdldENsb3Nlc3REb21haW4oKXtcbiAgICAgICAgLyogRmluZCB0aGUgRG9tYWluTm9kZSB0aGF0IHRoaXMgTm9kZSBpcyBiZWluZyBjYWxsZWQgZnJvbS5cbiAgICAgICAgVHJhdmVyc2UgdGhlIGNoYWluIG9mIHBhcmVudHMgdXB3YXJkcyB1bnRpbCB3ZSBmaW5kIGEgRG9tYWluTm9kZSwgYXQgd2hpY2ggcG9pbnQgd2UgcmV0dXJuIGl0LlxuICAgICAgICBUaGlzIGFsbG93cyBhbiBvdXRwdXQgdG8gcmVzaXplIGFuIGFycmF5IHRvIG1hdGNoIGEgZG9tYWluTm9kZSdzIG51bUNhbGxzUGVyQWN0aXZhdGlvbiwgZm9yIGV4YW1wbGUuXG5cbiAgICAgICAgTm90ZSB0aGF0IHRoaXMgcmV0dXJucyB0aGUgTU9TVCBSRUNFTlQgRG9tYWluTm9kZSBhbmNlc3RvciAtIGl0J3MgYXNzdW1lZCB0aGF0IGRvbWFpbm5vZGVzIG92ZXJ3cml0ZSBvbmUgYW5vdGhlci5cbiAgICAgICAgKi9cbiAgICAgICAgY29uc3QgTUFYX0NIQUlOID0gMTAwO1xuICAgICAgICBsZXQgcGFyZW50Q291bnQgPSAwO1xuXHRcdGxldCByb290ID0gdGhpcy5wYXJlbnQ7IC8vc3RhcnQgb25lIGxldmVsIHVwIGluIGNhc2UgdGhpcyBpcyBhIERvbWFpbk5vZGUgYWxyZWFkeS4gd2UgZG9uJ3Qgd2FudCB0aGF0XG5cdFx0d2hpbGUocm9vdCAhPT0gbnVsbCAmJiByb290LnBhcmVudCAhPT0gbnVsbCAmJiAhcm9vdC5pc0RvbWFpbk5vZGUgJiYgcGFyZW50Q291bnQgPCBNQVhfQ0hBSU4pe1xuXHRcdFx0cm9vdCA9IHJvb3QucGFyZW50O1xuICAgICAgICAgICAgcGFyZW50Q291bnQrPSAxO1xuXHRcdH1cblx0XHRpZihwYXJlbnRDb3VudCA+PSBNQVhfQ0hBSU4pdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGZpbmQgcGFyZW50IVwiKTtcbiAgICAgICAgaWYocm9vdCA9PT0gbnVsbCB8fCAhcm9vdC5pc0RvbWFpbk5vZGUpdGhyb3cgbmV3IEVycm9yKFwiTm8gRG9tYWluTm9kZSBwYXJlbnQgZm91bmQhXCIpO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9XG5cblx0b25BZnRlckFjdGl2YXRpb24oKXtcblx0XHQvLyBkbyBub3RoaW5nXG5cdFx0Ly9idXQgY2FsbCBhbGwgY2hpbGRyZW5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLm9uQWZ0ZXJBY3RpdmF0aW9uKCk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIE91dHB1dE5vZGUgZXh0ZW5kcyBOb2RleyAvL21vcmUgb2YgYSBqYXZhIGludGVyZmFjZSwgcmVhbGx5XG5cdGNvbnN0cnVjdG9yKCl7c3VwZXIoKTt9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXt9XG5cdG9uQWZ0ZXJBY3RpdmF0aW9uKCl7fVxuXHRfb25BZGQoKXt9XG59XG5cbmNsYXNzIERvbWFpbk5vZGUgZXh0ZW5kcyBOb2RleyAvL0Egbm9kZSB0aGF0IGNhbGxzIG90aGVyIGZ1bmN0aW9ucyBvdmVyIHNvbWUgcmFuZ2UuXG5cdGNvbnN0cnVjdG9yKCl7XG4gICAgICAgIHN1cGVyKCk7XG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBhcnJheSB0byBzdG9yZSB0aGUgbnVtYmVyIG9mIHRpbWVzIHRoaXMgaXMgY2FsbGVkIHBlciBkaW1lbnNpb24uXG4gICAgICAgIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gbnVsbDsgLy8gbnVtYmVyIG9mIHRpbWVzIGFueSBjaGlsZCBub2RlJ3MgZXZhbHVhdGVTZWxmKCkgaXMgY2FsbGVkXG4gICAgfVxuICAgIGFjdGl2YXRlKHQpe31cbn1cbkRvbWFpbk5vZGUucHJvdG90eXBlLmlzRG9tYWluTm9kZSA9IHRydWU7XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGU7XG5leHBvcnQge091dHB1dE5vZGUsIERvbWFpbk5vZGV9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7IERvbWFpbk5vZGUgfSAgZnJvbSAnLi9Ob2RlLmpzJztcbi8vdGVzdD8/XG5jbGFzcyBFWFBBcnJheSBleHRlbmRzIERvbWFpbk5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lyp2YXIgcG9pbnRzID0gbmV3IEVYUC5BcnJheSh7XG5cdFx0ZGF0YTogW1stMTAsMTBdLFxuXHRcdFx0WzEwLDEwXV1cblx0XHR9KSovXG5cblx0XHRFWFAuVXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyhvcHRpb25zLCBcImRhdGFcIik7IC8vIGEgbXVsdGlkaW1lbnNpb25hbCBhcnJheS4gYXNzdW1lZCB0byBvbmx5IGNvbnRhaW4gb25lIHR5cGU6IGVpdGhlciBudW1iZXJzIG9yIGFycmF5c1xuXHRcdEVYUC5VdGlscy5hc3NlcnRUeXBlKG9wdGlvbnMuZGF0YSwgQXJyYXkpO1xuXG5cdFx0Ly9JdCdzIGFzc3VtZWQgYW4gRVhQLkFycmF5IHdpbGwgb25seSBzdG9yZSB0aGluZ3Mgc3VjaCBhcyAwLCBbMF0sIFswLDBdIG9yIFswLDAsMF0uIElmIGFuIGFycmF5IHR5cGUgaXMgc3RvcmVkLCB0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgY29udGFpbnMgdGhlIC5sZW5ndGggb2YgdGhhdCBhcnJheS4gT3RoZXJ3aXNlIGl0J3MgMCwgYmVjYXVzZSBwb2ludHMgYXJlIDAtZGltZW5zaW9uYWwuXG5cdFx0aWYob3B0aW9ucy5kYXRhWzBdLmNvbnN0cnVjdG9yID09PSBOdW1iZXIpe1xuXHRcdFx0dGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID0gMDtcblx0XHR9ZWxzZSBpZihvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IgPT09IEFycmF5KXtcblx0XHRcdHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyA9IG9wdGlvbnMuZGF0YVswXS5sZW5ndGg7XG5cdFx0fWVsc2V7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiRGF0YSBpbiBhbiBFWFAuQXJyYXkgc2hvdWxkIGJlIGEgbnVtYmVyIG9yIGFuIGFycmF5IG9mIG90aGVyIHRoaW5ncywgbm90IFwiICsgb3B0aW9ucy5kYXRhWzBdLmNvbnN0cnVjdG9yKTtcblx0XHR9XG5cblxuXHRcdEVYUC5VdGlscy5hc3NlcnQob3B0aW9ucy5kYXRhWzBdLmxlbmd0aCAhPSAwKTsgLy9kb24ndCBhY2NlcHQgW1tdXSwgZGF0YSBuZWVkcyB0byBiZSBzb21ldGhpbmcgbGlrZSBbWzEsMl1dLlxuXG5cdFx0dGhpcy5kYXRhID0gb3B0aW9ucy5kYXRhO1xuXHRcdHRoaXMubnVtSXRlbXMgPSB0aGlzLmRhdGEubGVuZ3RoO1xuXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFt0aGlzLmRhdGEubGVuZ3RoXTsgLy8gYXJyYXkgdG8gc3RvcmUgdGhlIG51bWJlciBvZiB0aW1lcyB0aGlzIGlzIGNhbGxlZCBwZXIgZGltZW5zaW9uLlxuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIHRpbWVzIGV2ZXJ5IGNoaWxkJ3MgZXhwciBpcyBjYWxsZWRcblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHRoaXMuaXRlbURpbWVuc2lvbnMucmVkdWNlKChzdW0seSk9PnN1bSp5KTtcblx0fVxuXHRhY3RpdmF0ZSh0KXtcblx0XHRpZih0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPT0gMCl7XG5cdFx0XHQvL251bWJlcnMgY2FuJ3QgYmUgc3ByZWFkIHVzaW5nIC4uLiBvcGVyYXRvclxuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmRhdGEubGVuZ3RoO2krKyl7XG5cdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpLHQsdGhpcy5kYXRhW2ldKTtcblx0XHRcdH1cblx0XHR9ZWxzZXtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5kYXRhLmxlbmd0aDtpKyspe1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaSx0LC4uLnRoaXMuZGF0YVtpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5vbkFmdGVyQWN0aXZhdGlvbigpOyAvLyBjYWxsIGNoaWxkcmVuIGlmIG5lY2Vzc2FyeVxuXHR9XG5cdF9jYWxsQWxsQ2hpbGRyZW4oLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBFWFAuQXJyYXkoe2RhdGE6IEVYUC5VdGlscy5hcnJheUNvcHkodGhpcy5kYXRhKX0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cbn1cblxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdEFycmF5KCl7XG5cdHZhciB4ID0gbmV3IEVYUC5BcnJheSh7ZGF0YTogW1swLDFdLFswLDFdXX0pO1xuXHR2YXIgeSA9IG5ldyBFWFAuVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpOyByZXR1cm4gWzJdfX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSg1MTIpO1xufVxuXG5leHBvcnQge0VYUEFycmF5IGFzIEFycmF5fTtcbiIsImZ1bmN0aW9uIG11bHRpcGx5U2NhbGFyKGMsIGFycmF5KXtcblx0Zm9yKHZhciBpPTA7aTxhcnJheS5sZW5ndGg7aSsrKXtcblx0XHRhcnJheVtpXSAqPSBjO1xuXHR9XG5cdHJldHVybiBhcnJheVxufVxuZnVuY3Rpb24gdmVjdG9yQWRkKHYxLHYyKXtcbiAgICBsZXQgdmVjID0gY2xvbmUodjEpO1xuXHRmb3IodmFyIGk9MDtpPHYxLmxlbmd0aDtpKyspe1xuXHRcdHZlY1tpXSArPSB2MltpXTtcblx0fVxuXHRyZXR1cm4gdmVjXG59XG5mdW5jdGlvbiBsZXJwVmVjdG9ycyh0LCBwMSwgcDIpe1xuXHQvL2Fzc3VtZWQgdCBpbiBbMCwxXVxuXHRyZXR1cm4gdmVjdG9yQWRkKG11bHRpcGx5U2NhbGFyKHQsY2xvbmUocDEpKSxtdWx0aXBseVNjYWxhcigxLXQsY2xvbmUocDIpKSk7XG59XG5mdW5jdGlvbiBjbG9uZSh2ZWMpe1xuXHR2YXIgbmV3QXJyID0gbmV3IEFycmF5KHZlYy5sZW5ndGgpO1xuXHRmb3IodmFyIGk9MDtpPHZlYy5sZW5ndGg7aSsrKXtcblx0XHRuZXdBcnJbaV0gPSB2ZWNbaV07XG5cdH1cblx0cmV0dXJuIG5ld0FyclxufVxuZnVuY3Rpb24gbXVsdGlwbHlNYXRyaXgodmVjLCBtYXRyaXgpe1xuXHQvL2Fzc2VydCB2ZWMubGVuZ3RoID09IG51bVJvd3NcblxuXHRsZXQgbnVtUm93cyA9IG1hdHJpeC5sZW5ndGg7XG5cdGxldCBudW1Db2xzID0gbWF0cml4WzBdLmxlbmd0aDtcblxuXHR2YXIgb3V0cHV0ID0gbmV3IEFycmF5KG51bUNvbHMpO1xuXHRmb3IodmFyIGo9MDtqPG51bUNvbHM7aisrKXtcblx0XHRvdXRwdXRbal0gPSAwO1xuXHRcdGZvcih2YXIgaT0wO2k8bnVtUm93cztpKyspe1xuXHRcdFx0b3V0cHV0W2pdICs9IG1hdHJpeFtpXVtqXSAqIHZlY1tpXTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIG91dHB1dDtcbn1cblxuLy9oYWNrXG5sZXQgTWF0aCA9IHtjbG9uZTogY2xvbmUsIGxlcnBWZWN0b3JzOiBsZXJwVmVjdG9ycywgdmVjdG9yQWRkOiB2ZWN0b3JBZGQsIG11bHRpcGx5U2NhbGFyOiBtdWx0aXBseVNjYWxhciwgbXVsdGlwbHlNYXRyaXg6IG11bHRpcGx5TWF0cml4fTtcblxuZXhwb3J0IHt2ZWN0b3JBZGQsIGxlcnBWZWN0b3JzLCBjbG9uZSwgbXVsdGlwbHlTY2FsYXIsIG11bHRpcGx5TWF0cml4LCBNYXRofTtcbiIsImltcG9ydCB7Y2xvbmV9IGZyb20gJy4vbWF0aC5qcydcblxuY2xhc3MgVXRpbHN7XG5cblx0c3RhdGljIGlzQXJyYXkoeCl7XG5cdFx0cmV0dXJuIHguY29uc3RydWN0b3IgPT09IEFycmF5O1xuXHR9XG5cdHN0YXRpYyBhcnJheUNvcHkoeCl7XG5cdFx0cmV0dXJuIHguc2xpY2UoKTtcblx0fVxuXHRzdGF0aWMgaXNGdW5jdGlvbih4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gRnVuY3Rpb247XG5cdH1cblxuXHRzdGF0aWMgYXNzZXJ0KHRoaW5nKXtcblx0XHQvL0EgZnVuY3Rpb24gdG8gY2hlY2sgaWYgc29tZXRoaW5nIGlzIHRydWUgYW5kIGhhbHQgb3RoZXJ3aXNlIGluIGEgY2FsbGJhY2thYmxlIHdheS5cblx0XHRpZighdGhpbmcpe1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBBc3NlcnRpb24gZmFpbGVkLiBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcbiAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcblx0XHR9XG5cdH1cblxuXHRzdGF0aWMgYXNzZXJ0VHlwZSh0aGluZywgdHlwZSwgZXJyb3JNc2cpe1xuXHRcdC8vQSBmdW5jdGlvbiB0byBjaGVjayBpZiBzb21ldGhpbmcgaXMgdHJ1ZSBhbmQgaGFsdCBvdGhlcndpc2UgaW4gYSBjYWxsYmFja2FibGUgd2F5LlxuXHRcdGlmKCEodGhpbmcuY29uc3RydWN0b3IgPT09IHR5cGUpKXtcblx0XHRcdGlmKGVycm9yTXNnKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBTb21ldGhpbmcgbm90IG9mIHJlcXVpcmVkIHR5cGUgXCIrdHlwZS5uYW1lK1wiISBcXG5cIitlcnJvck1zZytcIlxcbiBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFNvbWV0aGluZyBub3Qgb2YgcmVxdWlyZWQgdHlwZSBcIit0eXBlLm5hbWUrXCIhIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdFx0fVxuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuXHRcdH1cblx0fVxuXG5cblx0c3RhdGljIGFzc2VydFByb3BFeGlzdHModGhpbmcsIG5hbWUpe1xuXHRcdGlmKCF0aGluZyB8fCAhKG5hbWUgaW4gdGhpbmcpKXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgXCIrbmFtZStcIiBub3QgcHJlc2VudCBpbiByZXF1aXJlZCBwcm9wZXJ0eVwiKTtcbiAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKTtcblx0XHR9XG5cdH1cblx0XG5cdHN0YXRpYyBjbG9uZSh2ZWMpe1xuXHRcdHJldHVybiBjbG9uZSh2ZWMpO1xuXHR9XG59XG5cbmV4cG9ydCB7VXRpbHN9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyBEb21haW5Ob2RlIH0gZnJvbSAnLi9Ob2RlLmpzJztcblxuY2xhc3MgQXJlYSBleHRlbmRzIERvbWFpbk5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvKnZhciBheGVzID0gbmV3IEVYUC5BcmVhKHtcblx0XHRib3VuZHM6IFtbLTEwLDEwXSxcblx0XHRcdFsxMCwxMF1dXG5cdFx0bnVtSXRlbXM6IDEwOyAvL29wdGlvbmFsLiBBbHRlcm5hdGVseSBudW1JdGVtcyBjYW4gdmFyeSBmb3IgZWFjaCBheGlzOiBudW1JdGVtczogWzEwLDJdXG5cdFx0fSkqL1xuXG5cblx0XG5cdFx0VXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyhvcHRpb25zLCBcImJvdW5kc1wiKTsgLy8gYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5XG5cdFx0VXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmJvdW5kcywgQXJyYXkpO1xuXHRcdFV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5ib3VuZHNbMF0sIEFycmF5LCBcIkZvciBhbiBBcmVhLCBvcHRpb25zLmJvdW5kcyBtdXN0IGJlIGEgbXVsdGlkaW1lbnNpb25hbCBhcnJheSwgZXZlbiBmb3Igb25lIGRpbWVuc2lvbiFcIik7IC8vIGl0IE1VU1QgYmUgbXVsdGlkaW1lbnNpb25hbFxuXHRcdHRoaXMubnVtRGltZW5zaW9ucyA9IG9wdGlvbnMuYm91bmRzLmxlbmd0aDtcblxuXHRcdFV0aWxzLmFzc2VydChvcHRpb25zLmJvdW5kc1swXS5sZW5ndGggIT0gMCk7IC8vZG9uJ3QgYWNjZXB0IFtbXV0sIGl0IG5lZWRzIHRvIGJlIFtbMSwyXV0uXG5cblx0XHR0aGlzLmJvdW5kcyA9IG9wdGlvbnMuYm91bmRzO1xuXHRcdHRoaXMubnVtSXRlbXMgPSBvcHRpb25zLm51bUl0ZW1zIHx8IDE2O1xuXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBhcnJheSB0byBzdG9yZSB0aGUgbnVtYmVyIG9mIHRpbWVzIHRoaXMgaXMgY2FsbGVkIHBlciBkaW1lbnNpb24uXG5cblx0XHRpZih0aGlzLm51bUl0ZW1zLmNvbnN0cnVjdG9yID09PSBOdW1iZXIpe1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bURpbWVuc2lvbnM7aSsrKXtcblx0XHRcdFx0dGhpcy5pdGVtRGltZW5zaW9ucy5wdXNoKHRoaXMubnVtSXRlbXMpO1xuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtSXRlbXMuY29uc3RydWN0b3IgPT09IEFycmF5KXtcblx0XHRcdFV0aWxzLmFzc2VydChvcHRpb25zLm51bUl0ZW1zLmxlbmd0aCA9PSBvcHRpb25zLmJvdW5kcy5sZW5ndGgpO1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bURpbWVuc2lvbnM7aSsrKXtcblx0XHRcdFx0dGhpcy5pdGVtRGltZW5zaW9ucy5wdXNoKHRoaXMubnVtSXRlbXNbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vdGhlIG51bWJlciBvZiB0aW1lcyBldmVyeSBjaGlsZCdzIGV4cHIgaXMgY2FsbGVkXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSB0aGlzLml0ZW1EaW1lbnNpb25zLnJlZHVjZSgoc3VtLHkpPT5zdW0qeSk7XG5cdH1cblx0YWN0aXZhdGUodCl7XG5cdFx0Ly9Vc2UgdGhpcyB0byBldmFsdWF0ZSBleHByKCkgYW5kIHVwZGF0ZSB0aGUgcmVzdWx0LCBjYXNjYWRlLXN0eWxlLlxuXHRcdC8vdGhlIG51bWJlciBvZiBib3VuZHMgdGhpcyBvYmplY3QgaGFzIHdpbGwgYmUgdGhlIG51bWJlciBvZiBkaW1lbnNpb25zLlxuXHRcdC8vdGhlIGV4cHIoKXMgYXJlIGNhbGxlZCB3aXRoIGV4cHIoaSwgLi4uW2Nvb3JkaW5hdGVzXSwgdCksIFxuXHRcdC8vXHQod2hlcmUgaSBpcyB0aGUgaW5kZXggb2YgdGhlIGN1cnJlbnQgZXZhbHVhdGlvbiA9IHRpbWVzIGV4cHIoKSBoYXMgYmVlbiBjYWxsZWQgdGhpcyBmcmFtZSwgdCA9IGFic29sdXRlIHRpbWVzdGVwIChzKSkuXG5cdFx0Ly9wbGVhc2UgY2FsbCB3aXRoIGEgdCB2YWx1ZSBvYnRhaW5lZCBmcm9tIHBlcmZvcm1hbmNlLm5vdygpLzEwMDAgb3Igc29tZXRoaW5nIGxpa2UgdGhhdFxuXG5cdFx0Ly9ub3RlIHRoZSBsZXNzLXRoYW4tb3ItZXF1YWwtdG8gaW4gdGhlc2UgbG9vcHNcblx0XHRpZih0aGlzLm51bURpbWVuc2lvbnMgPT0gMSl7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0bGV0IGluZGV4ID0gaTtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsMCwwLDApO1xuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAyKXtcblx0XHRcdC8vdGhpcyBjYW4gYmUgcmVkdWNlZCBpbnRvIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSBvdmVyIHRoZSBmaXJzdCBpbmRleCBvZiB0aGlzLmJvdW5kcywgSSBrbm93IGl0XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0Zm9yKHZhciBqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzFdO2orKyl7XG5cdFx0XHRcdFx0bGV0IGMyID0gdGhpcy5ib3VuZHNbMV1bMF0gKyAodGhpcy5ib3VuZHNbMV1bMV0tdGhpcy5ib3VuZHNbMV1bMF0pKihqLyh0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTEpKTtcblx0XHRcdFx0XHRsZXQgaW5kZXggPSBpKnRoaXMuaXRlbURpbWVuc2lvbnNbMV0gKyBqO1xuXHRcdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpbmRleCx0LGMxLGMyLDAsMCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ZWxzZSBpZih0aGlzLm51bURpbWVuc2lvbnMgPT0gMyl7XG5cdFx0XHQvL3RoaXMgY2FuIGJlIHJlZHVjZWQgaW50byBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgb3ZlciB0aGUgZmlyc3QgaW5kZXggb2YgdGhpcy5ib3VuZHMsIEkga25vdyBpdFxuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2krKyl7XG5cdFx0XHRcdGxldCBjMSA9IHRoaXMuYm91bmRzWzBdWzBdICsgKHRoaXMuYm91bmRzWzBdWzFdLXRoaXMuYm91bmRzWzBdWzBdKSooaS8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKSk7XG5cdFx0XHRcdGZvcih2YXIgaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtqKyspe1xuXHRcdFx0XHRcdGxldCBjMiA9IHRoaXMuYm91bmRzWzFdWzBdICsgKHRoaXMuYm91bmRzWzFdWzFdLXRoaXMuYm91bmRzWzFdWzBdKSooai8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKSk7XG5cdFx0XHRcdFx0Zm9yKHZhciBrPTA7azx0aGlzLml0ZW1EaW1lbnNpb25zWzJdO2srKyl7XG5cdFx0XHRcdFx0XHRsZXQgYzMgPSB0aGlzLmJvdW5kc1syXVswXSArICh0aGlzLmJvdW5kc1syXVsxXS10aGlzLmJvdW5kc1syXVswXSkqKGsvKHRoaXMuaXRlbURpbWVuc2lvbnNbMl0tMSkpO1xuXHRcdFx0XHRcdFx0bGV0IGluZGV4ID0gKGkqdGhpcy5pdGVtRGltZW5zaW9uc1sxXSArIGopKnRoaXMuaXRlbURpbWVuc2lvbnNbMl0gKyBrO1xuXHRcdFx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsYzIsYzMsMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fWVsc2V7XG5cdFx0XHRhc3NlcnQoXCJUT0RPOiBVc2UgYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIHRvIGxvb3Agb3ZlciBhbGwgaW5kaWNlcyFcIik7XG5cdFx0fVxuXG5cdFx0dGhpcy5vbkFmdGVyQWN0aXZhdGlvbigpOyAvLyBjYWxsIGNoaWxkcmVuIGlmIG5lY2Vzc2FyeVxuXHR9XG5cdF9jYWxsQWxsQ2hpbGRyZW4oLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBBcmVhKHtib3VuZHM6IFV0aWxzLmFycmF5Q29weSh0aGlzLmJvdW5kcyksIG51bUl0ZW1zOiB0aGlzLm51bUl0ZW1zfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0XHRpZihjbG9uZS5jaGlsZHJlbltpXS5fb25BZGQpY2xvbmUuY2hpbGRyZW5baV0uX29uQWRkKCk7IC8vIG5lY2Vzc2FyeSBub3cgdGhhdCB0aGUgY2hhaW4gb2YgYWRkaW5nIGhhcyBiZWVuIGVzdGFibGlzaGVkXG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0QXJlYSgpe1xuXHR2YXIgeCA9IG5ldyBBcmVhKHtib3VuZHM6IFtbMCwxXSxbMCwxXV19KTtcblx0dmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpfX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSgpO1xufVxuXG5leHBvcnQgeyBBcmVhIH1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQgTm9kZSBmcm9tICcuL05vZGUuanMnO1xuXG4vL1VzYWdlOiB2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSl9fSk7XG5jbGFzcyBUcmFuc2Zvcm1hdGlvbiBleHRlbmRzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cdFxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZXhwclwiKTsgLy8gYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5XG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5leHByLCBGdW5jdGlvbik7XG5cblx0XHR0aGlzLmV4cHIgPSBvcHRpb25zLmV4cHI7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKXtcblx0XHQvL2V2YWx1YXRlIHRoaXMgVHJhbnNmb3JtYXRpb24ncyBfZXhwciwgYW5kIGJyb2FkY2FzdCB0aGUgcmVzdWx0IHRvIGFsbCBjaGlsZHJlbi5cblx0XHRsZXQgcmVzdWx0ID0gdGhpcy5leHByKC4uLmNvb3JkaW5hdGVzKTtcblx0XHRpZihyZXN1bHQuY29uc3RydWN0b3IgIT09IEFycmF5KXJlc3VsdCA9IFtyZXN1bHRdO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoY29vcmRpbmF0ZXNbMF0sY29vcmRpbmF0ZXNbMV0sIC4uLnJlc3VsdClcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgdGhpc0V4cHIgPSB0aGlzLmV4cHI7XG5cdFx0bGV0IGNsb25lID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiB0aGlzRXhwci5iaW5kKCl9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG5cdG1ha2VMaW5rKCl7XG4gICAgICAgIC8vbGlrZSBhIGNsb25lLCBidXQgd2lsbCB1c2UgdGhlIHNhbWUgZXhwciBhcyB0aGlzIFRyYW5zZm9ybWF0aW9uLlxuICAgICAgICAvL3VzZWZ1bCBpZiB0aGVyZSdzIGEgc3BlY2lmaWMgZnVuY3Rpb24gdGhhdCBuZWVkcyB0byBiZSB1c2VkIGJ5IGEgYnVuY2ggb2Ygb2JqZWN0c1xuXHRcdHJldHVybiBuZXcgTGlua2VkVHJhbnNmb3JtYXRpb24odGhpcyk7XG5cdH1cbn1cblxuY2xhc3MgTGlua2VkVHJhbnNmb3JtYXRpb24gZXh0ZW5kcyBOb2Rle1xuICAgIC8qXG4gICAgICAgIExpa2UgYW4gRVhQLlRyYW5zZm9ybWF0aW9uLCBidXQgaXQgdXNlcyBhbiBleGlzdGluZyBFWFAuVHJhbnNmb3JtYXRpb24ncyBleHByKCksIHNvIGlmIHRoZSBsaW5rZWQgdHJhbnNmb3JtYXRpb24gdXBkYXRlcywgc28gZG9lcyB0aGlzIG9uZS4gSXQncyBsaWtlIGEgcG9pbnRlciB0byBhIFRyYW5zZm9ybWF0aW9uLCBidXQgaW4gb2JqZWN0IGZvcm0uIFxuICAgICovXG5cdGNvbnN0cnVjdG9yKHRyYW5zZm9ybWF0aW9uVG9MaW5rVG8pe1xuXHRcdHN1cGVyKHt9KTtcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZSh0cmFuc2Zvcm1hdGlvblRvTGlua1RvLCBUcmFuc2Zvcm1hdGlvbik7XG4gICAgICAgIHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlID0gdHJhbnNmb3JtYXRpb25Ub0xpbmtUbztcblx0fVxuXHRldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGxldCByZXN1bHQgPSB0aGlzLmxpbmtlZFRyYW5zZm9ybWF0aW9uTm9kZS5leHByKC4uLmNvb3JkaW5hdGVzKTtcblx0XHRpZihyZXN1bHQuY29uc3RydWN0b3IgIT09IEFycmF5KXJlc3VsdCA9IFtyZXN1bHRdO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoY29vcmRpbmF0ZXNbMF0sY29vcmRpbmF0ZXNbMV0sIC4uLnJlc3VsdClcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgY2xvbmUgPSBuZXcgTGlua2VkVHJhbnNmb3JtYXRpb24odGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUpO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cblx0bWFrZUxpbmsoKXtcblx0XHRyZXR1cm4gbmV3IExpbmtlZFRyYW5zZm9ybWF0aW9uKHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlKTtcblx0fVxufVxuXG5cblxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0VHJhbnNmb3JtYXRpb24oKXtcblx0dmFyIHggPSBuZXcgQXJlYSh7Ym91bmRzOiBbWy0xMCwxMF1dfSk7XG5cdHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHsnZXhwcic6ICh4KSA9PiBjb25zb2xlLmxvZyh4KngpfSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKCk7IC8vIHNob3VsZCByZXR1cm4gMTAwLCA4MSwgNjQuLi4gMCwgMSwgNC4uLiAxMDBcbn1cblxuZXhwb3J0IHsgVHJhbnNmb3JtYXRpb24sIExpbmtlZFRyYW5zZm9ybWF0aW9ufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7IERvbWFpbk5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuXG5jbGFzcyBIaXN0b3J5UmVjb3JkZXIgZXh0ZW5kcyBEb21haW5Ob2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHRzdXBlcigpO1xuXG4gICAgICAgIC8qXG4gICAgICAgICAgICBDbGFzcyB0aGF0IHJlY29yZHMgdGhlIGxhc3QgZmV3IHZhbHVlcyBvZiB0aGUgcGFyZW50IFRyYW5zZm9ybWF0aW9uIGFuZCBtYWtlcyB0aGVtIGF2YWlsYWJsZSBmb3IgdXNlIGFzIGFuIGV4dHJhIGRpbWVuc2lvbi5cbiAgICAgICAgICAgIFVzYWdlOlxuICAgICAgICAgICAgdmFyIHJlY29yZGVyID0gbmV3IEhpc3RvcnlSZWNvcmRlcih7XG4gICAgICAgICAgICAgICAgbWVtb3J5TGVuZ3RoOiAxMCAvLyBob3cgbWFueSBwYXN0IHZhbHVlcyB0byBzdG9yZT9cbiAgICAgICAgICAgICAgICByZWNvcmRGcmFtZUludGVydmFsOiAxNS8vSG93IGxvbmcgdG8gd2FpdCBiZXR3ZWVuIGVhY2ggY2FwdHVyZT8gTWVhc3VyZWQgaW4gZnJhbWVzLCBzbyA2MCA9IDEgY2FwdHVyZSBwZXIgc2Vjb25kLCAzMCA9IDIgY2FwdHVyZXMvc2Vjb25kLCBldGMuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZXhhbXBsZSB1c2FnZTpcbiAgICAgICAgICAgIG5ldyBBcmVhKHtib3VuZHM6IFtbLTUsNV1dfSkuYWRkKG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogKGksdCx4KSA9PiBbTWF0aC5zaW4oeCksTWF0aC5jb3MoeCldfSkpLmFkZChuZXcgRVhQLkhpc3RvcnlSZWNvcmRlcih7bWVtb3J5TGVuZ3RoOiA1fSkuYWRkKG5ldyBMaW5lT3V0cHV0KHt3aWR0aDogNSwgY29sb3I6IDB4ZmYwMDAwfSkpO1xuXG4gICAgICAgICAgICBOT1RFOiBJdCBpcyBhc3N1bWVkIHRoYXQgYW55IHBhcmVudCB0cmFuc2Zvcm1hdGlvbiBvdXRwdXRzIGFuIGFycmF5IG9mIG51bWJlcnMgdGhhdCBpcyA0IG9yIGxlc3MgaW4gbGVuZ3RoLlxuICAgICAgICAqL1xuXG5cdFx0dGhpcy5tZW1vcnlMZW5ndGggPSBvcHRpb25zLm1lbW9yeUxlbmd0aCA9PT0gdW5kZWZpbmVkID8gMTAgOiBvcHRpb25zLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgdGhpcy5yZWNvcmRGcmFtZUludGVydmFsID0gb3B0aW9ucy5yZWNvcmRGcmFtZUludGVydmFsID09PSB1bmRlZmluZWQgPyAxNSA6IG9wdGlvbnMucmVjb3JkRnJhbWVJbnRlcnZhbDsgLy9zZXQgdG8gMSB0byByZWNvcmQgZXZlcnkgZnJhbWUuXG4gICAgICAgIHRoaXMuX291dHB1dERpbWVuc2lvbnMgPSA0OyAvL2hvdyBtYW55IGRpbWVuc2lvbnMgcGVyIHBvaW50IHRvIHN0b3JlPyAodG9kbzogYXV0b2RldGVjdCB0aGlzIGZyb20gcGFyZW50J3Mgb3V0cHV0KVxuXHRcdHRoaXMuY3VycmVudEhpc3RvcnlJbmRleD0wO1xuICAgICAgICB0aGlzLmZyYW1lUmVjb3JkVGltZXIgPSAwO1xuXHR9XG5cdF9vbkFkZCgpe1xuXHRcdC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBBcmVhXG5cdFx0bGV0IHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLm1lbW9yeUxlbmd0aDtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucy5jb25jYXQoW3RoaXMubWVtb3J5TGVuZ3RoXSk7XG5cbiAgICAgICAgdGhpcy5idWZmZXIgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG4gICAgXG4gICAgICAgIC8vVGhpcyBpcyBzbyB0aGF0IG5vIHN1cmZhY2UvYm91bmRhcnkgd2lsbCBhcHBlYXIgdW50aWwgaGlzdG9yeSBiZWdpbnMgdG8gYmUgcmVjb3JkZWQuIEknbSBzbyBzb3JyeS5cbiAgICAgICAgLy9Ub2RvOiBwcm9wZXIgY2xpcCBzaGFkZXIgbGlrZSBtYXRoYm94IGRvZXMgb3Igc29tZXRoaW5nLlxuICAgICAgICB0aGlzLmJ1ZmZlci5maWxsKE5hTik7IFxuXHR9XG4gICAgb25BZnRlckFjdGl2YXRpb24oKXtcbiAgICAgICAgc3VwZXIub25BZnRlckFjdGl2YXRpb24oKTtcblxuICAgICAgICAvL2V2ZXJ5IHNvIG9mdGVuLCBzaGlmdCB0byB0aGUgbmV4dCBidWZmZXIgc2xvdFxuICAgICAgICB0aGlzLmZyYW1lUmVjb3JkVGltZXIgKz0gMTtcbiAgICAgICAgaWYodGhpcy5mcmFtZVJlY29yZFRpbWVyID49IHRoaXMucmVjb3JkRnJhbWVJbnRlcnZhbCl7XG4gICAgICAgICAgICAvL3Jlc2V0IGZyYW1lIHJlY29yZCB0aW1lclxuICAgICAgICAgICAgdGhpcy5mcmFtZVJlY29yZFRpbWVyID0gMDtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCA9ICh0aGlzLmN1cnJlbnRIaXN0b3J5SW5kZXgrMSkldGhpcy5tZW1vcnlMZW5ndGg7XG4gICAgICAgIH1cbiAgICB9XG5cdGV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcyl7XG5cdFx0Ly9ldmFsdWF0ZSB0aGlzIFRyYW5zZm9ybWF0aW9uJ3MgX2V4cHIsIGFuZCBicm9hZGNhc3QgdGhlIHJlc3VsdCB0byBhbGwgY2hpbGRyZW4uXG5cdFx0bGV0IGkgPSBjb29yZGluYXRlc1swXTtcblx0XHRsZXQgdCA9IGNvb3JkaW5hdGVzWzFdO1xuICAgIFxuICAgICAgICAvL3N0ZXAgMTogc2F2ZSBjb29yZGluYXRlcyBmb3IgdGhpcyBmcmFtZSBpbiBidWZmZXJcbiAgICAgICAgaWYoY29vcmRpbmF0ZXMubGVuZ3RoID4gMit0aGlzLl9vdXRwdXREaW1lbnNpb25zKXtcbiAgICAgICAgICAgIC8vdG9kbzogbWFrZSB0aGlzIHVwZGF0ZSB0aGlzLl9vdXRwdXREaW1lbnNpb25zIGFuZCByZWFsbG9jYXRlIG1vcmUgYnVmZmVyIHNwYWNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFWFAuSGlzdG9yeVJlY29yZGVyIGlzIHVuYWJsZSB0byByZWNvcmQgaGlzdG9yeSBvZiBzb21ldGhpbmcgdGhhdCBvdXRwdXRzIGluIFwiK3RoaXMuX291dHB1dERpbWVuc2lvbnMrXCIgZGltZW5zaW9ucyEgWWV0LlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjeWNsaWNCdWZmZXJJbmRleCA9IChpKnRoaXMubWVtb3J5TGVuZ3RoK3RoaXMuY3VycmVudEhpc3RvcnlJbmRleCkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcbiAgICAgICAgZm9yKHZhciBqPTA7ajxjb29yZGluYXRlcy5sZW5ndGgtMjtqKyspeyBcbiAgICAgICAgICAgIHRoaXMuYnVmZmVyW2N5Y2xpY0J1ZmZlckluZGV4K2pdID0gY29vcmRpbmF0ZXNbMitqXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vc3RlcCAyOiwgY2FsbCBhbnkgY2hpbGRyZW4gb25jZSBwZXIgaGlzdG9yeSBpdGVtXG4gICAgICAgIGZvcih2YXIgY2hpbGRObz0wO2NoaWxkTm88dGhpcy5jaGlsZHJlbi5sZW5ndGg7Y2hpbGRObysrKXtcblx0XHQgICAgZm9yKHZhciBqPTA7ajx0aGlzLm1lbW9yeUxlbmd0aDtqKyspe1xuXG4gICAgICAgICAgICAgICAgLy90aGUgKzEgaW4gKGogKyB0aGlzLmN1cnJlbnRIaXN0b3J5SW5kZXggKyAxKSBpcyBpbXBvcnRhbnQ7IHdpdGhvdXQgaXQsIGEgTGluZU91dHB1dCB3aWxsIGRyYXcgYSBsaW5lIGZyb20gdGhlIG1vc3QgcmVjZW50IHZhbHVlIHRvIHRoZSBlbmQgb2YgaGlzdG9yeVxuICAgICAgICAgICAgICAgIGxldCBjeWNsaWNIaXN0b3J5VmFsdWUgPSAoaiArIHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCArIDEpICUgdGhpcy5tZW1vcnlMZW5ndGg7XG4gICAgICAgICAgICAgICAgbGV0IGN5Y2xpY0J1ZmZlckluZGV4ID0gKGkgKiB0aGlzLm1lbW9yeUxlbmd0aCArIGN5Y2xpY0hpc3RvcnlWYWx1ZSkqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcbiAgICAgICAgICAgICAgICBsZXQgbm9uQ3ljbGljSW5kZXggPSBpICogdGhpcy5tZW1vcnlMZW5ndGggKyBqO1xuXG5cdFx0ICAgICAgICAvL0knbSB0b3JuIG9uIHdoZXRoZXIgdG8gYWRkIGEgZmluYWwgY29vcmRpbmF0ZSBhdCB0aGUgZW5kIHNvIGhpc3RvcnkgY2FuIGdvIG9mZiBpbiBhIG5ldyBkaXJlY3Rpb24uXG4gICAgICAgICAgICAgICAgLy90aGlzLmNoaWxkcmVuW2NoaWxkTm9dLmV2YWx1YXRlU2VsZihub25DeWNsaWNJbmRleCx0LHRoaXMuYnVmZmVyW2N5Y2xpY0J1ZmZlckluZGV4XSwgY3ljbGljSGlzdG9yeVZhbHVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuW2NoaWxkTm9dLmV2YWx1YXRlU2VsZihcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vbkN5Y2xpY0luZGV4LHQsIC8vaSx0XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi50aGlzLmJ1ZmZlci5zbGljZShjeWNsaWNCdWZmZXJJbmRleCxjeWNsaWNCdWZmZXJJbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zKSAvL2V4dHJhY3QgY29vcmRpbmF0ZXMgZm9yIHRoaXMgaGlzdG9yeSB2YWx1ZSBmcm9tIGJ1ZmZlclxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBIaXN0b3J5UmVjb3JkZXIoe21lbW9yeUxlbmd0aDogdGhpcy5tZW1vcnlMZW5ndGgsIHJlY29yZEZyYW1lSW50ZXJ2YWw6IHRoaXMucmVjb3JkRnJhbWVJbnRlcnZhbH0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cbn1cblxuZXhwb3J0IHsgSGlzdG9yeVJlY29yZGVyIH1cbiIsInZhciB0aHJlZUVudmlyb25tZW50ID0gbnVsbDtcblxuZnVuY3Rpb24gc2V0VGhyZWVFbnZpcm9ubWVudChuZXdFbnYpe1xuICAgIHRocmVlRW52aXJvbm1lbnQgPSBuZXdFbnY7XG59XG5mdW5jdGlvbiBnZXRUaHJlZUVudmlyb25tZW50KCl7XG4gICAgcmV0dXJuIHRocmVlRW52aXJvbm1lbnQ7XG59XG5leHBvcnQge3NldFRocmVlRW52aXJvbm1lbnQsIGdldFRocmVlRW52aXJvbm1lbnQsIHRocmVlRW52aXJvbm1lbnR9O1xuIiwiaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuL3V0aWxzLmpzJztcblxuaW1wb3J0IHsgVHJhbnNmb3JtYXRpb24gfSBmcm9tICcuL1RyYW5zZm9ybWF0aW9uLmpzJztcblxuaW1wb3J0ICogYXMgbWF0aCBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgdGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmxldCBFUFMgPSBOdW1iZXIuRVBTSUxPTjtcblxuY2xhc3MgQW5pbWF0aW9ue1xuXHRjb25zdHJ1Y3Rvcih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbiwgc3RhZ2dlckZyYWN0aW9uKXtcblx0XHRVdGlscy5hc3NlcnRUeXBlKHRvVmFsdWVzLCBPYmplY3QpO1xuXG5cdFx0dGhpcy50b1ZhbHVlcyA9IHRvVmFsdWVzO1xuXHRcdHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1x0XG5cdFx0dGhpcy5zdGFnZ2VyRnJhY3Rpb24gPSBzdGFnZ2VyRnJhY3Rpb24gPT09IHVuZGVmaW5lZCA/IDAgOiBzdGFnZ2VyRnJhY3Rpb247IC8vIHRpbWUgaW4gbXMgYmV0d2VlbiBmaXJzdCBlbGVtZW50IGJlZ2lubmluZyB0aGUgYW5pbWF0aW9uIGFuZCBsYXN0IGVsZW1lbnQgYmVnaW5uaW5nIHRoZSBhbmltYXRpb24uIFNob3VsZCBiZSBsZXNzIHRoYW4gZHVyYXRpb24uXG5yXG5cblx0XHRVdGlscy5hc3NlcnQodGhpcy5zdGFnZ2VyRnJhY3Rpb24gPj0gMCAmJiB0aGlzLnN0YWdnZXJGcmFjdGlvbiA8IDEpO1xuXG5cdFx0dGhpcy5mcm9tVmFsdWVzID0ge307XG5cdFx0Zm9yKHZhciBwcm9wZXJ0eSBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdFV0aWxzLmFzc2VydFByb3BFeGlzdHModGhpcy50YXJnZXQsIHByb3BlcnR5KTtcblxuXHRcdFx0Ly9jb3B5IHByb3BlcnR5LCBtYWtpbmcgc3VyZSB0byBzdG9yZSB0aGUgY29ycmVjdCAndGhpcydcblx0XHRcdGlmKFV0aWxzLmlzRnVuY3Rpb24odGhpcy50YXJnZXRbcHJvcGVydHldKSl7XG5cdFx0XHRcdHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0gPSB0aGlzLnRhcmdldFtwcm9wZXJ0eV0uYmluZCh0aGlzLnRhcmdldCk7XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0dGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHRoaXMudGFyZ2V0W3Byb3BlcnR5XTtcblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbiA9PT0gdW5kZWZpbmVkID8gMSA6IGR1cmF0aW9uOyAvL2luIHNcblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblxuICAgICAgICB0aGlzLnByZXZUcnVlVGltZSA9IDA7XG5cblxuXHRcdGlmKHRhcmdldC5jb25zdHJ1Y3RvciA9PT0gVHJhbnNmb3JtYXRpb24pe1xuXHRcdFx0Ly9maW5kIG91dCBob3cgbWFueSBvYmplY3RzIGFyZSBwYXNzaW5nIHRocm91Z2ggdGhpcyB0cmFuc2Zvcm1hdGlvblxuXHRcdFx0bGV0IHJvb3QgPSB0YXJnZXQ7XG5cdFx0XHR3aGlsZShyb290LnBhcmVudCAhPT0gbnVsbCl7XG5cdFx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcblx0XHRcdH1cblx0XHRcdHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cdFx0fWVsc2V7XG5cdFx0XHRpZih0aGlzLnN0YWdnZXJGcmFjdGlvbiAhPSAwKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcInN0YWdnZXJGcmFjdGlvbiBjYW4gb25seSBiZSB1c2VkIHdoZW4gVHJhbnNpdGlvblRvJ3MgdGFyZ2V0IGlzIGFuIEVYUC5UcmFuc2Zvcm1hdGlvbiFcIik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly9iZWdpblxuXHRcdHRoaXMuX3VwZGF0ZUNhbGxiYWNrID0gdGhpcy51cGRhdGUuYmluZCh0aGlzKVxuXHRcdHRocmVlRW52aXJvbm1lbnQub24oXCJ1cGRhdGVcIix0aGlzLl91cGRhdGVDYWxsYmFjayk7XG5cdH1cblx0dXBkYXRlKHRpbWUpe1xuXHRcdHRoaXMuZWxhcHNlZFRpbWUgKz0gdGltZS5yZWFsdGltZURlbHRhO1x0XG5cblx0XHRsZXQgcGVyY2VudGFnZSA9IHRoaXMuZWxhcHNlZFRpbWUvdGhpcy5kdXJhdGlvbjtcblxuXHRcdC8vaW50ZXJwb2xhdGUgdmFsdWVzXG5cdFx0Zm9yKGxldCBwcm9wZXJ0eSBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdHRoaXMuaW50ZXJwb2xhdGUocGVyY2VudGFnZSwgcHJvcGVydHksIHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0sdGhpcy50b1ZhbHVlc1twcm9wZXJ0eV0pO1xuXHRcdH1cblxuXHRcdGlmKHRoaXMuZWxhcHNlZFRpbWUgPj0gdGhpcy5kdXJhdGlvbil7XG5cdFx0XHR0aGlzLmVuZCgpO1xuXHRcdH1cblx0fVxuXHRpbnRlcnBvbGF0ZShwZXJjZW50YWdlLCBwcm9wZXJ0eU5hbWUsIGZyb21WYWx1ZSwgdG9WYWx1ZSl7XG5cdFx0Y29uc3QgbnVtT2JqZWN0cyA9IHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXG5cdFx0dmFyIG5ld1ZhbHVlID0gbnVsbDtcblx0XHRpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mKGZyb21WYWx1ZSkgPT09IFwibnVtYmVyXCIpe1xuXHRcdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BlcnR5TmFtZV0gPSB0KnRvVmFsdWUgKyAoMS10KSpmcm9tVmFsdWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXNGdW5jdGlvbih0b1ZhbHVlKSAmJiBVdGlscy5pc0Z1bmN0aW9uKGZyb21WYWx1ZSkpe1xuXHRcdFx0Ly9pZiBzdGFnZ2VyRnJhY3Rpb24gIT0gMCwgaXQncyB0aGUgYW1vdW50IG9mIHRpbWUgYmV0d2VlbiB0aGUgZmlyc3QgcG9pbnQncyBzdGFydCB0aW1lIGFuZCB0aGUgbGFzdCBwb2ludCdzIHN0YXJ0IHRpbWUuXG5cdFx0XHQvL0FTU1VNUFRJT046IHRoZSBmaXJzdCB2YXJpYWJsZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGksIGFuZCBpdCdzIGFzc3VtZWQgaSBpcyB6ZXJvLWluZGV4ZWQuXG5cblx0XHRcdC8vZW5jYXBzdWxhdGUgcGVyY2VudGFnZVxuXHRcdFx0dGhpcy50YXJnZXRbcHJvcGVydHlOYW1lXSA9IChmdW5jdGlvbiguLi5jb29yZHMpe1xuICAgICAgICAgICAgICAgIGNvbnN0IGkgPSBjb29yZHNbMF07XG5cdFx0XHRcdGxldCBsZXJwRmFjdG9yID0gcGVyY2VudGFnZTtcblxuICAgICAgICAgICAgICAgIC8vZmFuY3kgc3RhZ2dlcmluZyBtYXRoLCBpZiB3ZSBrbm93IGhvdyBtYW55IG9iamVjdHMgYXJlIGZsb3dpbmcgdGhyb3VnaCB0aGlzIHRyYW5zZm9ybWF0aW9uIGF0IG9uY2VcbiAgICAgICAgICAgICAgICBpZih0aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbiAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgICAgICAgICAgbGVycEZhY3RvciA9IHBlcmNlbnRhZ2UvKDEtdGhpcy5zdGFnZ2VyRnJhY3Rpb24rRVBTKSAtIGkqdGhpcy5zdGFnZ2VyRnJhY3Rpb24vdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb247XG4gICAgICAgICAgICAgICAgfVxuXHRcdFx0XHQvL2xldCBwZXJjZW50ID0gTWF0aC5taW4oTWF0aC5tYXgocGVyY2VudGFnZSAtIGkvdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gICAsMSksMCk7XG5cblx0XHRcdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihNYXRoLm1heChNYXRoLm1pbihsZXJwRmFjdG9yLDEpLDApKTtcblx0XHRcdFx0cmV0dXJuIG1hdGgubGVycFZlY3RvcnModCx0b1ZhbHVlKC4uLmNvb3JkcyksZnJvbVZhbHVlKC4uLmNvb3JkcykpXG5cdFx0XHR9KS5iaW5kKHRoaXMpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1lbHNlIGlmKHRvVmFsdWUuY29uc3RydWN0b3IgPT09IFRIUkVFLkNvbG9yICYmIGZyb21WYWx1ZS5jb25zdHJ1Y3RvciA9PT0gVEhSRUUuQ29sb3Ipe1xuICAgICAgICAgICAgbGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcbiAgICAgICAgICAgIGxldCBjb2xvciA9IGZyb21WYWx1ZS5jbG9uZSgpO1xuICAgICAgICAgICAgdGhpcy50YXJnZXRbcHJvcGVydHlOYW1lXSA9IGNvbG9yLmxlcnAodG9WYWx1ZSwgdCk7XG4gICAgICAgIH1lbHNlIGlmKHR5cGVvZih0b1ZhbHVlKSA9PT0gXCJib29sZWFuXCIgJiYgdHlwZW9mKGZyb21WYWx1ZSkgPT09IFwiYm9vbGVhblwiKXtcbiAgICAgICAgICAgIGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG4gICAgICAgICAgICB0aGlzLnRhcmdldFtwcm9wZXJ0eU5hbWVdID0gdCA+IDAuNSA/IHRvVmFsdWUgOiBmcm9tVmFsdWU7XG4gICAgICAgIH1lbHNle1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkFuaW1hdGlvbiBjbGFzcyBjYW5ub3QgeWV0IGhhbmRsZSB0cmFuc2l0aW9uaW5nIGJldHdlZW4gdGhpbmdzIHRoYXQgYXJlbid0IG51bWJlcnMgb3IgZnVuY3Rpb25zIVwiKTtcblx0XHR9XG5cblx0fVxuXHRpbnRlcnBvbGF0aW9uRnVuY3Rpb24oeCl7XG5cdFx0cmV0dXJuIHRoaXMuY29zaW5lSW50ZXJwb2xhdGlvbih4KTtcblx0fVxuXHRjb3NpbmVJbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiAoMS1NYXRoLmNvcyh4Kk1hdGguUEkpKS8yO1xuXHR9XG5cdGxpbmVhckludGVycG9sYXRpb24oeCl7XG5cdFx0cmV0dXJuIHg7XG5cdH1cblx0ZW5kKCl7XG5cdFx0Zm9yKHZhciBwcm9wIGluIHRoaXMudG9WYWx1ZXMpe1xuXHRcdFx0dGhpcy50YXJnZXRbcHJvcF0gPSB0aGlzLnRvVmFsdWVzW3Byb3BdO1xuXHRcdH1cblx0XHR0aHJlZUVudmlyb25tZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ1cGRhdGVcIix0aGlzLl91cGRhdGVDYWxsYmFjayk7XG5cdFx0Ly9Ub2RvOiBkZWxldGUgdGhpc1xuXHR9XG59XG5cbi8vdG9kbzogcHV0IHRoaXMgaW50byBhIERpcmVjdG9yIGNsYXNzIHNvIHRoYXQgaXQgY2FuIGhhdmUgYW4gdW5kbyBzdGFja1xuZnVuY3Rpb24gVHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMsIHN0YWdnZXJGcmFjdGlvbil7XG5cdHZhciBhbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGR1cmF0aW9uTVMvMTAwMCwgc3RhZ2dlckZyYWN0aW9uKTtcbn1cblxuZXhwb3J0IHtUcmFuc2l0aW9uVG8sIEFuaW1hdGlvbn1cbiIsIihmdW5jdGlvbiAoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBsb29rdXAgPSBbXG5cdFx0XHQnQScsICdCJywgJ0MnLCAnRCcsICdFJywgJ0YnLCAnRycsICdIJyxcblx0XHRcdCdJJywgJ0onLCAnSycsICdMJywgJ00nLCAnTicsICdPJywgJ1AnLFxuXHRcdFx0J1EnLCAnUicsICdTJywgJ1QnLCAnVScsICdWJywgJ1cnLCAnWCcsXG5cdFx0XHQnWScsICdaJywgJ2EnLCAnYicsICdjJywgJ2QnLCAnZScsICdmJyxcblx0XHRcdCdnJywgJ2gnLCAnaScsICdqJywgJ2snLCAnbCcsICdtJywgJ24nLFxuXHRcdFx0J28nLCAncCcsICdxJywgJ3InLCAncycsICd0JywgJ3UnLCAndicsXG5cdFx0XHQndycsICd4JywgJ3knLCAneicsICcwJywgJzEnLCAnMicsICczJyxcblx0XHRcdCc0JywgJzUnLCAnNicsICc3JywgJzgnLCAnOScsICcrJywgJy8nXG5cdFx0XTtcblx0ZnVuY3Rpb24gY2xlYW4obGVuZ3RoKSB7XG5cdFx0dmFyIGksIGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGxlbmd0aCk7XG5cdFx0Zm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRidWZmZXJbaV0gPSAwO1xuXHRcdH1cblx0XHRyZXR1cm4gYnVmZmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gZXh0ZW5kKG9yaWcsIGxlbmd0aCwgYWRkTGVuZ3RoLCBtdWx0aXBsZU9mKSB7XG5cdFx0dmFyIG5ld1NpemUgPSBsZW5ndGggKyBhZGRMZW5ndGgsXG5cdFx0XHRidWZmZXIgPSBjbGVhbigocGFyc2VJbnQobmV3U2l6ZSAvIG11bHRpcGxlT2YpICsgMSkgKiBtdWx0aXBsZU9mKTtcblxuXHRcdGJ1ZmZlci5zZXQob3JpZyk7XG5cblx0XHRyZXR1cm4gYnVmZmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFkKG51bSwgYnl0ZXMsIGJhc2UpIHtcblx0XHRudW0gPSBudW0udG9TdHJpbmcoYmFzZSB8fCA4KTtcblx0XHRyZXR1cm4gXCIwMDAwMDAwMDAwMDBcIi5zdWJzdHIobnVtLmxlbmd0aCArIDEyIC0gYnl0ZXMpICsgbnVtO1xuXHR9XG5cblx0ZnVuY3Rpb24gc3RyaW5nVG9VaW50OCAoaW5wdXQsIG91dCwgb2Zmc2V0KSB7XG5cdFx0dmFyIGksIGxlbmd0aDtcblxuXHRcdG91dCA9IG91dCB8fCBjbGVhbihpbnB1dC5sZW5ndGgpO1xuXG5cdFx0b2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gaW5wdXQubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdG91dFtvZmZzZXRdID0gaW5wdXQuY2hhckNvZGVBdChpKTtcblx0XHRcdG9mZnNldCArPSAxO1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXQ7XG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0KHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGg7XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArIGxvb2t1cFtudW0gPj4gNiAmIDB4M0ZdICsgbG9va3VwW251bSAmIDB4M0ZdO1xuXHRcdH07XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKTtcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcCk7XG5cdFx0fVxuXG5cdFx0Ly8gdGhpcyBwcmV2ZW50cyBhbiBFUlJfSU5WQUxJRF9VUkwgaW4gQ2hyb21lIChGaXJlZm94IG9rYXkpXG5cdFx0c3dpdGNoIChvdXRwdXQubGVuZ3RoICUgNCkge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dDtcblx0fVxuXG5cdHdpbmRvdy51dGlscyA9IHt9XG5cdHdpbmRvdy51dGlscy5jbGVhbiA9IGNsZWFuO1xuXHR3aW5kb3cudXRpbHMucGFkID0gcGFkO1xuXHR3aW5kb3cudXRpbHMuZXh0ZW5kID0gZXh0ZW5kO1xuXHR3aW5kb3cudXRpbHMuc3RyaW5nVG9VaW50OCA9IHN0cmluZ1RvVWludDg7XG5cdHdpbmRvdy51dGlscy51aW50OFRvQmFzZTY0ID0gdWludDhUb0Jhc2U2NDtcbn0oKSk7XG5cbihmdW5jdGlvbiAoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXG4vKlxuc3RydWN0IHBvc2l4X2hlYWRlciB7ICAgICAgICAgICAgIC8vIGJ5dGUgb2Zmc2V0XG5cdGNoYXIgbmFtZVsxMDBdOyAgICAgICAgICAgICAgIC8vICAgMFxuXHRjaGFyIG1vZGVbOF07ICAgICAgICAgICAgICAgICAvLyAxMDBcblx0Y2hhciB1aWRbOF07ICAgICAgICAgICAgICAgICAgLy8gMTA4XG5cdGNoYXIgZ2lkWzhdOyAgICAgICAgICAgICAgICAgIC8vIDExNlxuXHRjaGFyIHNpemVbMTJdOyAgICAgICAgICAgICAgICAvLyAxMjRcblx0Y2hhciBtdGltZVsxMl07ICAgICAgICAgICAgICAgLy8gMTM2XG5cdGNoYXIgY2hrc3VtWzhdOyAgICAgICAgICAgICAgIC8vIDE0OFxuXHRjaGFyIHR5cGVmbGFnOyAgICAgICAgICAgICAgICAvLyAxNTZcblx0Y2hhciBsaW5rbmFtZVsxMDBdOyAgICAgICAgICAgLy8gMTU3XG5cdGNoYXIgbWFnaWNbNl07ICAgICAgICAgICAgICAgIC8vIDI1N1xuXHRjaGFyIHZlcnNpb25bMl07ICAgICAgICAgICAgICAvLyAyNjNcblx0Y2hhciB1bmFtZVszMl07ICAgICAgICAgICAgICAgLy8gMjY1XG5cdGNoYXIgZ25hbWVbMzJdOyAgICAgICAgICAgICAgIC8vIDI5N1xuXHRjaGFyIGRldm1ham9yWzhdOyAgICAgICAgICAgICAvLyAzMjlcblx0Y2hhciBkZXZtaW5vcls4XTsgICAgICAgICAgICAgLy8gMzM3XG5cdGNoYXIgcHJlZml4WzE1NV07ICAgICAgICAgICAgIC8vIDM0NVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDUwMFxufTtcbiovXG5cblx0dmFyIHV0aWxzID0gd2luZG93LnV0aWxzLFxuXHRcdGhlYWRlckZvcm1hdDtcblxuXHRoZWFkZXJGb3JtYXQgPSBbXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVOYW1lJyxcblx0XHRcdCdsZW5ndGgnOiAxMDBcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlTW9kZScsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3VpZCcsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2dpZCcsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVTaXplJyxcblx0XHRcdCdsZW5ndGgnOiAxMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ210aW1lJyxcblx0XHRcdCdsZW5ndGgnOiAxMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2NoZWNrc3VtJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndHlwZScsXG5cdFx0XHQnbGVuZ3RoJzogMVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2xpbmtOYW1lJyxcblx0XHRcdCdsZW5ndGgnOiAxMDBcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd1c3RhcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ293bmVyJyxcblx0XHRcdCdsZW5ndGgnOiAzMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2dyb3VwJyxcblx0XHRcdCdsZW5ndGgnOiAzMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ21ham9yTnVtYmVyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbWlub3JOdW1iZXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlbmFtZVByZWZpeCcsXG5cdFx0XHQnbGVuZ3RoJzogMTU1XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAncGFkZGluZycsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9XG5cdF07XG5cblx0ZnVuY3Rpb24gZm9ybWF0SGVhZGVyKGRhdGEsIGNiKSB7XG5cdFx0dmFyIGJ1ZmZlciA9IHV0aWxzLmNsZWFuKDUxMiksXG5cdFx0XHRvZmZzZXQgPSAwO1xuXG5cdFx0aGVhZGVyRm9ybWF0LmZvckVhY2goZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHR2YXIgc3RyID0gZGF0YVt2YWx1ZS5maWVsZF0gfHwgXCJcIixcblx0XHRcdFx0aSwgbGVuZ3RoO1xuXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSBzdHIubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdFx0YnVmZmVyW29mZnNldF0gPSBzdHIuY2hhckNvZGVBdChpKTtcblx0XHRcdFx0b2Zmc2V0ICs9IDE7XG5cdFx0XHR9XG5cblx0XHRcdG9mZnNldCArPSB2YWx1ZS5sZW5ndGggLSBpOyAvLyBzcGFjZSBpdCBvdXQgd2l0aCBudWxsc1xuXHRcdH0pO1xuXG5cdFx0aWYgKHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIGNiKGJ1ZmZlciwgb2Zmc2V0KTtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdHdpbmRvdy5oZWFkZXIgPSB7fVxuXHR3aW5kb3cuaGVhZGVyLnN0cnVjdHVyZSA9IGhlYWRlckZvcm1hdDtcblx0d2luZG93LmhlYWRlci5mb3JtYXQgPSBmb3JtYXRIZWFkZXI7XG59KCkpO1xuXG4oZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgaGVhZGVyID0gd2luZG93LmhlYWRlcixcblx0XHR1dGlscyA9IHdpbmRvdy51dGlscyxcblx0XHRyZWNvcmRTaXplID0gNTEyLFxuXHRcdGJsb2NrU2l6ZTtcblxuXHRmdW5jdGlvbiBUYXIocmVjb3Jkc1BlckJsb2NrKSB7XG5cdFx0dGhpcy53cml0dGVuID0gMDtcblx0XHRibG9ja1NpemUgPSAocmVjb3Jkc1BlckJsb2NrIHx8IDIwKSAqIHJlY29yZFNpemU7XG5cdFx0dGhpcy5vdXQgPSB1dGlscy5jbGVhbihibG9ja1NpemUpO1xuXHRcdHRoaXMuYmxvY2tzID0gW107XG5cdFx0dGhpcy5sZW5ndGggPSAwO1xuXHR9XG5cblx0VGFyLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbiAoZmlsZXBhdGgsIGlucHV0LCBvcHRzLCBjYWxsYmFjaykge1xuXHRcdHZhciBkYXRhLFxuXHRcdFx0Y2hlY2tzdW0sXG5cdFx0XHRtb2RlLFxuXHRcdFx0bXRpbWUsXG5cdFx0XHR1aWQsXG5cdFx0XHRnaWQsXG5cdFx0XHRoZWFkZXJBcnI7XG5cblx0XHRpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0aW5wdXQgPSB1dGlscy5zdHJpbmdUb1VpbnQ4KGlucHV0KTtcblx0XHR9IGVsc2UgaWYgKGlucHV0LmNvbnN0cnVjdG9yICE9PSBVaW50OEFycmF5LnByb3RvdHlwZS5jb25zdHJ1Y3Rvcikge1xuXHRcdFx0dGhyb3cgJ0ludmFsaWQgaW5wdXQgdHlwZS4gWW91IGdhdmUgbWU6ICcgKyBpbnB1dC5jb25zdHJ1Y3Rvci50b1N0cmluZygpLm1hdGNoKC9mdW5jdGlvblxccyooWyRBLVphLXpfXVswLTlBLVphLXpfXSopXFxzKlxcKC8pWzFdO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0Y2FsbGJhY2sgPSBvcHRzO1xuXHRcdFx0b3B0cyA9IHt9O1xuXHRcdH1cblxuXHRcdG9wdHMgPSBvcHRzIHx8IHt9O1xuXG5cdFx0bW9kZSA9IG9wdHMubW9kZSB8fCBwYXJzZUludCgnNzc3JywgOCkgJiAweGZmZjtcblx0XHRtdGltZSA9IG9wdHMubXRpbWUgfHwgTWF0aC5mbG9vcigrbmV3IERhdGUoKSAvIDEwMDApO1xuXHRcdHVpZCA9IG9wdHMudWlkIHx8IDA7XG5cdFx0Z2lkID0gb3B0cy5naWQgfHwgMDtcblxuXHRcdGRhdGEgPSB7XG5cdFx0XHRmaWxlTmFtZTogZmlsZXBhdGgsXG5cdFx0XHRmaWxlTW9kZTogdXRpbHMucGFkKG1vZGUsIDcpLFxuXHRcdFx0dWlkOiB1dGlscy5wYWQodWlkLCA3KSxcblx0XHRcdGdpZDogdXRpbHMucGFkKGdpZCwgNyksXG5cdFx0XHRmaWxlU2l6ZTogdXRpbHMucGFkKGlucHV0Lmxlbmd0aCwgMTEpLFxuXHRcdFx0bXRpbWU6IHV0aWxzLnBhZChtdGltZSwgMTEpLFxuXHRcdFx0Y2hlY2tzdW06ICcgICAgICAgICcsXG5cdFx0XHR0eXBlOiAnMCcsIC8vIGp1c3QgYSBmaWxlXG5cdFx0XHR1c3RhcjogJ3VzdGFyICAnLFxuXHRcdFx0b3duZXI6IG9wdHMub3duZXIgfHwgJycsXG5cdFx0XHRncm91cDogb3B0cy5ncm91cCB8fCAnJ1xuXHRcdH07XG5cblx0XHQvLyBjYWxjdWxhdGUgdGhlIGNoZWNrc3VtXG5cdFx0Y2hlY2tzdW0gPSAwO1xuXHRcdE9iamVjdC5rZXlzKGRhdGEpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdFx0dmFyIGksIHZhbHVlID0gZGF0YVtrZXldLCBsZW5ndGg7XG5cblx0XHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHZhbHVlLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRcdGNoZWNrc3VtICs9IHZhbHVlLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRkYXRhLmNoZWNrc3VtID0gdXRpbHMucGFkKGNoZWNrc3VtLCA2KSArIFwiXFx1MDAwMCBcIjtcblxuXHRcdGhlYWRlckFyciA9IGhlYWRlci5mb3JtYXQoZGF0YSk7XG5cblx0XHR2YXIgaGVhZGVyTGVuZ3RoID0gTWF0aC5jZWlsKCBoZWFkZXJBcnIubGVuZ3RoIC8gcmVjb3JkU2l6ZSApICogcmVjb3JkU2l6ZTtcblx0XHR2YXIgaW5wdXRMZW5ndGggPSBNYXRoLmNlaWwoIGlucHV0Lmxlbmd0aCAvIHJlY29yZFNpemUgKSAqIHJlY29yZFNpemU7XG5cblx0XHR0aGlzLmJsb2Nrcy5wdXNoKCB7IGhlYWRlcjogaGVhZGVyQXJyLCBpbnB1dDogaW5wdXQsIGhlYWRlckxlbmd0aDogaGVhZGVyTGVuZ3RoLCBpbnB1dExlbmd0aDogaW5wdXRMZW5ndGggfSApO1xuXG5cdH07XG5cblx0VGFyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgYnVmZmVycyA9IFtdO1xuXHRcdHZhciBjaHVua3MgPSBbXTtcblx0XHR2YXIgbGVuZ3RoID0gMDtcblx0XHR2YXIgbWF4ID0gTWF0aC5wb3coIDIsIDIwICk7XG5cblx0XHR2YXIgY2h1bmsgPSBbXTtcblx0XHR0aGlzLmJsb2Nrcy5mb3JFYWNoKCBmdW5jdGlvbiggYiApIHtcblx0XHRcdGlmKCBsZW5ndGggKyBiLmhlYWRlckxlbmd0aCArIGIuaW5wdXRMZW5ndGggPiBtYXggKSB7XG5cdFx0XHRcdGNodW5rcy5wdXNoKCB7IGJsb2NrczogY2h1bmssIGxlbmd0aDogbGVuZ3RoIH0gKTtcblx0XHRcdFx0Y2h1bmsgPSBbXTtcblx0XHRcdFx0bGVuZ3RoID0gMDtcblx0XHRcdH1cblx0XHRcdGNodW5rLnB1c2goIGIgKTtcblx0XHRcdGxlbmd0aCArPSBiLmhlYWRlckxlbmd0aCArIGIuaW5wdXRMZW5ndGg7XG5cdFx0fSApO1xuXHRcdGNodW5rcy5wdXNoKCB7IGJsb2NrczogY2h1bmssIGxlbmd0aDogbGVuZ3RoIH0gKTtcblxuXHRcdGNodW5rcy5mb3JFYWNoKCBmdW5jdGlvbiggYyApIHtcblxuXHRcdFx0dmFyIGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KCBjLmxlbmd0aCApO1xuXHRcdFx0dmFyIHdyaXR0ZW4gPSAwO1xuXHRcdFx0Yy5ibG9ja3MuZm9yRWFjaCggZnVuY3Rpb24oIGIgKSB7XG5cdFx0XHRcdGJ1ZmZlci5zZXQoIGIuaGVhZGVyLCB3cml0dGVuICk7XG5cdFx0XHRcdHdyaXR0ZW4gKz0gYi5oZWFkZXJMZW5ndGg7XG5cdFx0XHRcdGJ1ZmZlci5zZXQoIGIuaW5wdXQsIHdyaXR0ZW4gKTtcblx0XHRcdFx0d3JpdHRlbiArPSBiLmlucHV0TGVuZ3RoO1xuXHRcdFx0fSApO1xuXHRcdFx0YnVmZmVycy5wdXNoKCBidWZmZXIgKTtcblxuXHRcdH0gKTtcblxuXHRcdGJ1ZmZlcnMucHVzaCggbmV3IFVpbnQ4QXJyYXkoIDIgKiByZWNvcmRTaXplICkgKTtcblxuXHRcdHJldHVybiBuZXcgQmxvYiggYnVmZmVycywgeyB0eXBlOiAnb2N0ZXQvc3RyZWFtJyB9ICk7XG5cblx0fTtcblxuXHRUYXIucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMud3JpdHRlbiA9IDA7XG5cdFx0dGhpcy5vdXQgPSB1dGlscy5jbGVhbihibG9ja1NpemUpO1xuXHR9O1xuXG4gIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBUYXI7XG4gIH0gZWxzZSB7XG4gICAgd2luZG93LlRhciA9IFRhcjtcbiAgfVxufSgpKTtcbiIsIi8vZG93bmxvYWQuanMgdjMuMCwgYnkgZGFuZGF2aXM7IDIwMDgtMjAxNC4gW0NDQlkyXSBzZWUgaHR0cDovL2Rhbm1sLmNvbS9kb3dubG9hZC5odG1sIGZvciB0ZXN0cy91c2FnZVxuLy8gdjEgbGFuZGVkIGEgRkYrQ2hyb21lIGNvbXBhdCB3YXkgb2YgZG93bmxvYWRpbmcgc3RyaW5ncyB0byBsb2NhbCB1bi1uYW1lZCBmaWxlcywgdXBncmFkZWQgdG8gdXNlIGEgaGlkZGVuIGZyYW1lIGFuZCBvcHRpb25hbCBtaW1lXG4vLyB2MiBhZGRlZCBuYW1lZCBmaWxlcyB2aWEgYVtkb3dubG9hZF0sIG1zU2F2ZUJsb2IsIElFICgxMCspIHN1cHBvcnQsIGFuZCB3aW5kb3cuVVJMIHN1cHBvcnQgZm9yIGxhcmdlcitmYXN0ZXIgc2F2ZXMgdGhhbiBkYXRhVVJMc1xuLy8gdjMgYWRkZWQgZGF0YVVSTCBhbmQgQmxvYiBJbnB1dCwgYmluZC10b2dnbGUgYXJpdHksIGFuZCBsZWdhY3kgZGF0YVVSTCBmYWxsYmFjayB3YXMgaW1wcm92ZWQgd2l0aCBmb3JjZS1kb3dubG9hZCBtaW1lIGFuZCBiYXNlNjQgc3VwcG9ydFxuXG4vLyBkYXRhIGNhbiBiZSBhIHN0cmluZywgQmxvYiwgRmlsZSwgb3IgZGF0YVVSTFxuXG5cblxuXG5mdW5jdGlvbiBkb3dubG9hZChkYXRhLCBzdHJGaWxlTmFtZSwgc3RyTWltZVR5cGUpIHtcblxuXHR2YXIgc2VsZiA9IHdpbmRvdywgLy8gdGhpcyBzY3JpcHQgaXMgb25seSBmb3IgYnJvd3NlcnMgYW55d2F5Li4uXG5cdFx0dSA9IFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCIsIC8vIHRoaXMgZGVmYXVsdCBtaW1lIGFsc28gdHJpZ2dlcnMgaWZyYW1lIGRvd25sb2Fkc1xuXHRcdG0gPSBzdHJNaW1lVHlwZSB8fCB1LFxuXHRcdHggPSBkYXRhLFxuXHRcdEQgPSBkb2N1bWVudCxcblx0XHRhID0gRC5jcmVhdGVFbGVtZW50KFwiYVwiKSxcblx0XHR6ID0gZnVuY3Rpb24oYSl7cmV0dXJuIFN0cmluZyhhKTt9LFxuXG5cblx0XHRCID0gc2VsZi5CbG9iIHx8IHNlbGYuTW96QmxvYiB8fCBzZWxmLldlYktpdEJsb2IgfHwgeixcblx0XHRCQiA9IHNlbGYuTVNCbG9iQnVpbGRlciB8fCBzZWxmLldlYktpdEJsb2JCdWlsZGVyIHx8IHNlbGYuQmxvYkJ1aWxkZXIsXG5cdFx0Zm4gPSBzdHJGaWxlTmFtZSB8fCBcImRvd25sb2FkXCIsXG5cdFx0YmxvYixcblx0XHRiLFxuXHRcdHVhLFxuXHRcdGZyO1xuXG5cdC8vaWYodHlwZW9mIEIuYmluZCA9PT0gJ2Z1bmN0aW9uJyApeyBCPUIuYmluZChzZWxmKTsgfVxuXG5cdGlmKFN0cmluZyh0aGlzKT09PVwidHJ1ZVwiKXsgLy9yZXZlcnNlIGFyZ3VtZW50cywgYWxsb3dpbmcgZG93bmxvYWQuYmluZCh0cnVlLCBcInRleHQveG1sXCIsIFwiZXhwb3J0LnhtbFwiKSB0byBhY3QgYXMgYSBjYWxsYmFja1xuXHRcdHg9W3gsIG1dO1xuXHRcdG09eFswXTtcblx0XHR4PXhbMV07XG5cdH1cblxuXG5cblx0Ly9nbyBhaGVhZCBhbmQgZG93bmxvYWQgZGF0YVVSTHMgcmlnaHQgYXdheVxuXHRpZihTdHJpbmcoeCkubWF0Y2goL15kYXRhXFw6W1xcdytcXC1dK1xcL1tcXHcrXFwtXStbLDtdLykpe1xuXHRcdHJldHVybiBuYXZpZ2F0b3IubXNTYXZlQmxvYiA/ICAvLyBJRTEwIGNhbid0IGRvIGFbZG93bmxvYWRdLCBvbmx5IEJsb2JzOlxuXHRcdFx0bmF2aWdhdG9yLm1zU2F2ZUJsb2IoZDJiKHgpLCBmbikgOlxuXHRcdFx0c2F2ZXIoeCkgOyAvLyBldmVyeW9uZSBlbHNlIGNhbiBzYXZlIGRhdGFVUkxzIHVuLXByb2Nlc3NlZFxuXHR9Ly9lbmQgaWYgZGF0YVVSTCBwYXNzZWQ/XG5cblx0dHJ5e1xuXG5cdFx0YmxvYiA9IHggaW5zdGFuY2VvZiBCID9cblx0XHRcdHggOlxuXHRcdFx0bmV3IEIoW3hdLCB7dHlwZTogbX0pIDtcblx0fWNhdGNoKHkpe1xuXHRcdGlmKEJCKXtcblx0XHRcdGIgPSBuZXcgQkIoKTtcblx0XHRcdGIuYXBwZW5kKFt4XSk7XG5cdFx0XHRibG9iID0gYi5nZXRCbG9iKG0pOyAvLyB0aGUgYmxvYlxuXHRcdH1cblxuXHR9XG5cblxuXG5cdGZ1bmN0aW9uIGQyYih1KSB7XG5cdFx0dmFyIHA9IHUuc3BsaXQoL1s6OyxdLyksXG5cdFx0dD0gcFsxXSxcblx0XHRkZWM9IHBbMl0gPT0gXCJiYXNlNjRcIiA/IGF0b2IgOiBkZWNvZGVVUklDb21wb25lbnQsXG5cdFx0YmluPSBkZWMocC5wb3AoKSksXG5cdFx0bXg9IGJpbi5sZW5ndGgsXG5cdFx0aT0gMCxcblx0XHR1aWE9IG5ldyBVaW50OEFycmF5KG14KTtcblxuXHRcdGZvcihpO2k8bXg7KytpKSB1aWFbaV09IGJpbi5jaGFyQ29kZUF0KGkpO1xuXG5cdFx0cmV0dXJuIG5ldyBCKFt1aWFdLCB7dHlwZTogdH0pO1xuXHQgfVxuXG5cdGZ1bmN0aW9uIHNhdmVyKHVybCwgd2luTW9kZSl7XG5cblxuXHRcdGlmICgnZG93bmxvYWQnIGluIGEpIHsgLy9odG1sNSBBW2Rvd25sb2FkXVxuXHRcdFx0YS5ocmVmID0gdXJsO1xuXHRcdFx0YS5zZXRBdHRyaWJ1dGUoXCJkb3dubG9hZFwiLCBmbik7XG5cdFx0XHRhLmlubmVySFRNTCA9IFwiZG93bmxvYWRpbmcuLi5cIjtcblx0XHRcdGEuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdEQuYm9keS5hcHBlbmRDaGlsZChhKTtcblx0XHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGEuY2xpY2soKTtcblx0XHRcdFx0RC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xuXHRcdFx0XHRpZih3aW5Nb2RlPT09dHJ1ZSl7c2V0VGltZW91dChmdW5jdGlvbigpeyBzZWxmLlVSTC5yZXZva2VPYmplY3RVUkwoYS5ocmVmKTt9LCAyNTAgKTt9XG5cdFx0XHR9LCA2Nik7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvL2RvIGlmcmFtZSBkYXRhVVJMIGRvd25sb2FkIChvbGQgY2grRkYpOlxuXHRcdHZhciBmID0gRC5jcmVhdGVFbGVtZW50KFwiaWZyYW1lXCIpO1xuXHRcdEQuYm9keS5hcHBlbmRDaGlsZChmKTtcblx0XHRpZighd2luTW9kZSl7IC8vIGZvcmNlIGEgbWltZSB0aGF0IHdpbGwgZG93bmxvYWQ6XG5cdFx0XHR1cmw9XCJkYXRhOlwiK3VybC5yZXBsYWNlKC9eZGF0YTooW1xcd1xcL1xcLVxcK10rKS8sIHUpO1xuXHRcdH1cblxuXG5cdFx0Zi5zcmMgPSB1cmw7XG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpeyBELmJvZHkucmVtb3ZlQ2hpbGQoZik7IH0sIDMzMyk7XG5cblx0fS8vZW5kIHNhdmVyXG5cblxuXHRpZiAobmF2aWdhdG9yLm1zU2F2ZUJsb2IpIHsgLy8gSUUxMCsgOiAoaGFzIEJsb2IsIGJ1dCBub3QgYVtkb3dubG9hZF0gb3IgVVJMKVxuXHRcdHJldHVybiBuYXZpZ2F0b3IubXNTYXZlQmxvYihibG9iLCBmbik7XG5cdH1cblxuXHRpZihzZWxmLlVSTCl7IC8vIHNpbXBsZSBmYXN0IGFuZCBtb2Rlcm4gd2F5IHVzaW5nIEJsb2IgYW5kIFVSTDpcblx0XHRzYXZlcihzZWxmLlVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYiksIHRydWUpO1xuXHR9ZWxzZXtcblx0XHQvLyBoYW5kbGUgbm9uLUJsb2IoKStub24tVVJMIGJyb3dzZXJzOlxuXHRcdGlmKHR5cGVvZiBibG9iID09PSBcInN0cmluZ1wiIHx8IGJsb2IuY29uc3RydWN0b3I9PT16ICl7XG5cdFx0XHR0cnl7XG5cdFx0XHRcdHJldHVybiBzYXZlciggXCJkYXRhOlwiICsgIG0gICArIFwiO2Jhc2U2NCxcIiAgKyAgc2VsZi5idG9hKGJsb2IpICApO1xuXHRcdFx0fWNhdGNoKHkpe1xuXHRcdFx0XHRyZXR1cm4gc2F2ZXIoIFwiZGF0YTpcIiArICBtICAgKyBcIixcIiArIGVuY29kZVVSSUNvbXBvbmVudChibG9iKSAgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBCbG9iIGJ1dCBub3QgVVJMOlxuXHRcdGZyPW5ldyBGaWxlUmVhZGVyKCk7XG5cdFx0ZnIub25sb2FkPWZ1bmN0aW9uKGUpe1xuXHRcdFx0c2F2ZXIodGhpcy5yZXN1bHQpO1xuXHRcdH07XG5cdFx0ZnIucmVhZEFzRGF0YVVSTChibG9iKTtcblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn0gLyogZW5kIGRvd25sb2FkKCkgKi9cblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBkb3dubG9hZDtcbn1cbiIsIi8vIGdpZi5qcyAwLjIuMCAtIGh0dHBzOi8vZ2l0aHViLmNvbS9qbm9yZGJlcmcvZ2lmLmpzXHJcbihmdW5jdGlvbihmKXtpZih0eXBlb2YgZXhwb3J0cz09PVwib2JqZWN0XCImJnR5cGVvZiBtb2R1bGUhPT1cInVuZGVmaW5lZFwiKXttb2R1bGUuZXhwb3J0cz1mKCl9ZWxzZSBpZih0eXBlb2YgZGVmaW5lPT09XCJmdW5jdGlvblwiJiZkZWZpbmUuYW1kKXtkZWZpbmUoW10sZil9ZWxzZXt2YXIgZztpZih0eXBlb2Ygd2luZG93IT09XCJ1bmRlZmluZWRcIil7Zz13aW5kb3d9ZWxzZSBpZih0eXBlb2YgZ2xvYmFsIT09XCJ1bmRlZmluZWRcIil7Zz1nbG9iYWx9ZWxzZSBpZih0eXBlb2Ygc2VsZiE9PVwidW5kZWZpbmVkXCIpe2c9c2VsZn1lbHNle2c9dGhpc31nLkdJRj1mKCl9fSkoZnVuY3Rpb24oKXt2YXIgZGVmaW5lLG1vZHVsZSxleHBvcnRzO3JldHVybiBmdW5jdGlvbigpe2Z1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfXJldHVybiBlfSgpKHsxOltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXtmdW5jdGlvbiBFdmVudEVtaXR0ZXIoKXt0aGlzLl9ldmVudHM9dGhpcy5fZXZlbnRzfHx7fTt0aGlzLl9tYXhMaXN0ZW5lcnM9dGhpcy5fbWF4TGlzdGVuZXJzfHx1bmRlZmluZWR9bW9kdWxlLmV4cG9ydHM9RXZlbnRFbWl0dGVyO0V2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXI9RXZlbnRFbWl0dGVyO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cz11bmRlZmluZWQ7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzPXVuZGVmaW5lZDtFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycz0xMDtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycz1mdW5jdGlvbihuKXtpZighaXNOdW1iZXIobil8fG48MHx8aXNOYU4obikpdGhyb3cgVHlwZUVycm9yKFwibiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIpO3RoaXMuX21heExpc3RlbmVycz1uO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQ9ZnVuY3Rpb24odHlwZSl7dmFyIGVyLGhhbmRsZXIsbGVuLGFyZ3MsaSxsaXN0ZW5lcnM7aWYoIXRoaXMuX2V2ZW50cyl0aGlzLl9ldmVudHM9e307aWYodHlwZT09PVwiZXJyb3JcIil7aWYoIXRoaXMuX2V2ZW50cy5lcnJvcnx8aXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSYmIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpe2VyPWFyZ3VtZW50c1sxXTtpZihlciBpbnN0YW5jZW9mIEVycm9yKXt0aHJvdyBlcn1lbHNle3ZhciBlcnI9bmV3IEVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LiAoJytlcitcIilcIik7ZXJyLmNvbnRleHQ9ZXI7dGhyb3cgZXJyfX19aGFuZGxlcj10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNVbmRlZmluZWQoaGFuZGxlcikpcmV0dXJuIGZhbHNlO2lmKGlzRnVuY3Rpb24oaGFuZGxlcikpe3N3aXRjaChhcmd1bWVudHMubGVuZ3RoKXtjYXNlIDE6aGFuZGxlci5jYWxsKHRoaXMpO2JyZWFrO2Nhc2UgMjpoYW5kbGVyLmNhbGwodGhpcyxhcmd1bWVudHNbMV0pO2JyZWFrO2Nhc2UgMzpoYW5kbGVyLmNhbGwodGhpcyxhcmd1bWVudHNbMV0sYXJndW1lbnRzWzJdKTticmVhaztkZWZhdWx0OmFyZ3M9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpO2hhbmRsZXIuYXBwbHkodGhpcyxhcmdzKX19ZWxzZSBpZihpc09iamVjdChoYW5kbGVyKSl7YXJncz1BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsMSk7bGlzdGVuZXJzPWhhbmRsZXIuc2xpY2UoKTtsZW49bGlzdGVuZXJzLmxlbmd0aDtmb3IoaT0wO2k8bGVuO2krKylsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcyxhcmdzKX1yZXR1cm4gdHJ1ZX07RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcj1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXt2YXIgbTtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO2lmKCF0aGlzLl9ldmVudHMpdGhpcy5fZXZlbnRzPXt9O2lmKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcil0aGlzLmVtaXQoXCJuZXdMaXN0ZW5lclwiLHR5cGUsaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcik/bGlzdGVuZXIubGlzdGVuZXI6bGlzdGVuZXIpO2lmKCF0aGlzLl9ldmVudHNbdHlwZV0pdGhpcy5fZXZlbnRzW3R5cGVdPWxpc3RlbmVyO2Vsc2UgaWYoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSl0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7ZWxzZSB0aGlzLl9ldmVudHNbdHlwZV09W3RoaXMuX2V2ZW50c1t0eXBlXSxsaXN0ZW5lcl07aWYoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSYmIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpe2lmKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKXttPXRoaXMuX21heExpc3RlbmVyc31lbHNle209RXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnN9aWYobSYmbT4wJiZ0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoPm0pe3RoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQ9dHJ1ZTtjb25zb2xlLmVycm9yKFwiKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgXCIrXCJsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuIFwiK1wiVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuXCIsdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7aWYodHlwZW9mIGNvbnNvbGUudHJhY2U9PT1cImZ1bmN0aW9uXCIpe2NvbnNvbGUudHJhY2UoKX19fXJldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uPUV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7dmFyIGZpcmVkPWZhbHNlO2Z1bmN0aW9uIGcoKXt0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsZyk7aWYoIWZpcmVkKXtmaXJlZD10cnVlO2xpc3RlbmVyLmFwcGx5KHRoaXMsYXJndW1lbnRzKX19Zy5saXN0ZW5lcj1saXN0ZW5lcjt0aGlzLm9uKHR5cGUsZyk7cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXI9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7dmFyIGxpc3QscG9zaXRpb24sbGVuZ3RoLGk7aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTtpZighdGhpcy5fZXZlbnRzfHwhdGhpcy5fZXZlbnRzW3R5cGVdKXJldHVybiB0aGlzO2xpc3Q9dGhpcy5fZXZlbnRzW3R5cGVdO2xlbmd0aD1saXN0Lmxlbmd0aDtwb3NpdGlvbj0tMTtpZihsaXN0PT09bGlzdGVuZXJ8fGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikmJmxpc3QubGlzdGVuZXI9PT1saXN0ZW5lcil7ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtpZih0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpdGhpcy5lbWl0KFwicmVtb3ZlTGlzdGVuZXJcIix0eXBlLGxpc3RlbmVyKX1lbHNlIGlmKGlzT2JqZWN0KGxpc3QpKXtmb3IoaT1sZW5ndGg7aS0tID4wOyl7aWYobGlzdFtpXT09PWxpc3RlbmVyfHxsaXN0W2ldLmxpc3RlbmVyJiZsaXN0W2ldLmxpc3RlbmVyPT09bGlzdGVuZXIpe3Bvc2l0aW9uPWk7YnJlYWt9fWlmKHBvc2l0aW9uPDApcmV0dXJuIHRoaXM7aWYobGlzdC5sZW5ndGg9PT0xKXtsaXN0Lmxlbmd0aD0wO2RlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV19ZWxzZXtsaXN0LnNwbGljZShwb3NpdGlvbiwxKX1pZih0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpdGhpcy5lbWl0KFwicmVtb3ZlTGlzdGVuZXJcIix0eXBlLGxpc3RlbmVyKX1yZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnM9ZnVuY3Rpb24odHlwZSl7dmFyIGtleSxsaXN0ZW5lcnM7aWYoIXRoaXMuX2V2ZW50cylyZXR1cm4gdGhpcztpZighdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXtpZihhcmd1bWVudHMubGVuZ3RoPT09MCl0aGlzLl9ldmVudHM9e307ZWxzZSBpZih0aGlzLl9ldmVudHNbdHlwZV0pZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtyZXR1cm4gdGhpc31pZihhcmd1bWVudHMubGVuZ3RoPT09MCl7Zm9yKGtleSBpbiB0aGlzLl9ldmVudHMpe2lmKGtleT09PVwicmVtb3ZlTGlzdGVuZXJcIiljb250aW51ZTt0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpfXRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKFwicmVtb3ZlTGlzdGVuZXJcIik7dGhpcy5fZXZlbnRzPXt9O3JldHVybiB0aGlzfWxpc3RlbmVycz10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKXt0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsbGlzdGVuZXJzKX1lbHNlIGlmKGxpc3RlbmVycyl7d2hpbGUobGlzdGVuZXJzLmxlbmd0aCl0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGgtMV0pfWRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzPWZ1bmN0aW9uKHR5cGUpe3ZhciByZXQ7aWYoIXRoaXMuX2V2ZW50c3x8IXRoaXMuX2V2ZW50c1t0eXBlXSlyZXQ9W107ZWxzZSBpZihpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpcmV0PVt0aGlzLl9ldmVudHNbdHlwZV1dO2Vsc2UgcmV0PXRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO3JldHVybiByZXR9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudD1mdW5jdGlvbih0eXBlKXtpZih0aGlzLl9ldmVudHMpe3ZhciBldmxpc3RlbmVyPXRoaXMuX2V2ZW50c1t0eXBlXTtpZihpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKXJldHVybiAxO2Vsc2UgaWYoZXZsaXN0ZW5lcilyZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGh9cmV0dXJuIDB9O0V2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50PWZ1bmN0aW9uKGVtaXR0ZXIsdHlwZSl7cmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKX07ZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJmdW5jdGlvblwifWZ1bmN0aW9uIGlzTnVtYmVyKGFyZyl7cmV0dXJuIHR5cGVvZiBhcmc9PT1cIm51bWJlclwifWZ1bmN0aW9uIGlzT2JqZWN0KGFyZyl7cmV0dXJuIHR5cGVvZiBhcmc9PT1cIm9iamVjdFwiJiZhcmchPT1udWxsfWZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZyl7cmV0dXJuIGFyZz09PXZvaWQgMH19LHt9XSwyOltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgTmV1UXVhbnQ9cmVxdWlyZShcIi4vVHlwZWROZXVRdWFudC5qc1wiKTt2YXIgTFpXRW5jb2Rlcj1yZXF1aXJlKFwiLi9MWldFbmNvZGVyLmpzXCIpO2Z1bmN0aW9uIEJ5dGVBcnJheSgpe3RoaXMucGFnZT0tMTt0aGlzLnBhZ2VzPVtdO3RoaXMubmV3UGFnZSgpfUJ5dGVBcnJheS5wYWdlU2l6ZT00MDk2O0J5dGVBcnJheS5jaGFyTWFwPXt9O2Zvcih2YXIgaT0wO2k8MjU2O2krKylCeXRlQXJyYXkuY2hhck1hcFtpXT1TdHJpbmcuZnJvbUNoYXJDb2RlKGkpO0J5dGVBcnJheS5wcm90b3R5cGUubmV3UGFnZT1mdW5jdGlvbigpe3RoaXMucGFnZXNbKyt0aGlzLnBhZ2VdPW5ldyBVaW50OEFycmF5KEJ5dGVBcnJheS5wYWdlU2l6ZSk7dGhpcy5jdXJzb3I9MH07Qnl0ZUFycmF5LnByb3RvdHlwZS5nZXREYXRhPWZ1bmN0aW9uKCl7dmFyIHJ2PVwiXCI7Zm9yKHZhciBwPTA7cDx0aGlzLnBhZ2VzLmxlbmd0aDtwKyspe2Zvcih2YXIgaT0wO2k8Qnl0ZUFycmF5LnBhZ2VTaXplO2krKyl7cnYrPUJ5dGVBcnJheS5jaGFyTWFwW3RoaXMucGFnZXNbcF1baV1dfX1yZXR1cm4gcnZ9O0J5dGVBcnJheS5wcm90b3R5cGUud3JpdGVCeXRlPWZ1bmN0aW9uKHZhbCl7aWYodGhpcy5jdXJzb3I+PUJ5dGVBcnJheS5wYWdlU2l6ZSl0aGlzLm5ld1BhZ2UoKTt0aGlzLnBhZ2VzW3RoaXMucGFnZV1bdGhpcy5jdXJzb3IrK109dmFsfTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlVVRGQnl0ZXM9ZnVuY3Rpb24oc3RyaW5nKXtmb3IodmFyIGw9c3RyaW5nLmxlbmd0aCxpPTA7aTxsO2krKyl0aGlzLndyaXRlQnl0ZShzdHJpbmcuY2hhckNvZGVBdChpKSl9O0J5dGVBcnJheS5wcm90b3R5cGUud3JpdGVCeXRlcz1mdW5jdGlvbihhcnJheSxvZmZzZXQsbGVuZ3RoKXtmb3IodmFyIGw9bGVuZ3RofHxhcnJheS5sZW5ndGgsaT1vZmZzZXR8fDA7aTxsO2krKyl0aGlzLndyaXRlQnl0ZShhcnJheVtpXSl9O2Z1bmN0aW9uIEdJRkVuY29kZXIod2lkdGgsaGVpZ2h0KXt0aGlzLndpZHRoPX5+d2lkdGg7dGhpcy5oZWlnaHQ9fn5oZWlnaHQ7dGhpcy50cmFuc3BhcmVudD1udWxsO3RoaXMudHJhbnNJbmRleD0wO3RoaXMucmVwZWF0PS0xO3RoaXMuZGVsYXk9MDt0aGlzLmltYWdlPW51bGw7dGhpcy5waXhlbHM9bnVsbDt0aGlzLmluZGV4ZWRQaXhlbHM9bnVsbDt0aGlzLmNvbG9yRGVwdGg9bnVsbDt0aGlzLmNvbG9yVGFiPW51bGw7dGhpcy5uZXVRdWFudD1udWxsO3RoaXMudXNlZEVudHJ5PW5ldyBBcnJheTt0aGlzLnBhbFNpemU9Nzt0aGlzLmRpc3Bvc2U9LTE7dGhpcy5maXJzdEZyYW1lPXRydWU7dGhpcy5zYW1wbGU9MTA7dGhpcy5kaXRoZXI9ZmFsc2U7dGhpcy5nbG9iYWxQYWxldHRlPWZhbHNlO3RoaXMub3V0PW5ldyBCeXRlQXJyYXl9R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGVsYXk9ZnVuY3Rpb24obWlsbGlzZWNvbmRzKXt0aGlzLmRlbGF5PU1hdGgucm91bmQobWlsbGlzZWNvbmRzLzEwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RnJhbWVSYXRlPWZ1bmN0aW9uKGZwcyl7dGhpcy5kZWxheT1NYXRoLnJvdW5kKDEwMC9mcHMpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXREaXNwb3NlPWZ1bmN0aW9uKGRpc3Bvc2FsQ29kZSl7aWYoZGlzcG9zYWxDb2RlPj0wKXRoaXMuZGlzcG9zZT1kaXNwb3NhbENvZGV9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFJlcGVhdD1mdW5jdGlvbihyZXBlYXQpe3RoaXMucmVwZWF0PXJlcGVhdH07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0VHJhbnNwYXJlbnQ9ZnVuY3Rpb24oY29sb3Ipe3RoaXMudHJhbnNwYXJlbnQ9Y29sb3J9O0dJRkVuY29kZXIucHJvdG90eXBlLmFkZEZyYW1lPWZ1bmN0aW9uKGltYWdlRGF0YSl7dGhpcy5pbWFnZT1pbWFnZURhdGE7dGhpcy5jb2xvclRhYj10aGlzLmdsb2JhbFBhbGV0dGUmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZT90aGlzLmdsb2JhbFBhbGV0dGU6bnVsbDt0aGlzLmdldEltYWdlUGl4ZWxzKCk7dGhpcy5hbmFseXplUGl4ZWxzKCk7aWYodGhpcy5nbG9iYWxQYWxldHRlPT09dHJ1ZSl0aGlzLmdsb2JhbFBhbGV0dGU9dGhpcy5jb2xvclRhYjtpZih0aGlzLmZpcnN0RnJhbWUpe3RoaXMud3JpdGVMU0QoKTt0aGlzLndyaXRlUGFsZXR0ZSgpO2lmKHRoaXMucmVwZWF0Pj0wKXt0aGlzLndyaXRlTmV0c2NhcGVFeHQoKX19dGhpcy53cml0ZUdyYXBoaWNDdHJsRXh0KCk7dGhpcy53cml0ZUltYWdlRGVzYygpO2lmKCF0aGlzLmZpcnN0RnJhbWUmJiF0aGlzLmdsb2JhbFBhbGV0dGUpdGhpcy53cml0ZVBhbGV0dGUoKTt0aGlzLndyaXRlUGl4ZWxzKCk7dGhpcy5maXJzdEZyYW1lPWZhbHNlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5maW5pc2g9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoNTkpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRRdWFsaXR5PWZ1bmN0aW9uKHF1YWxpdHkpe2lmKHF1YWxpdHk8MSlxdWFsaXR5PTE7dGhpcy5zYW1wbGU9cXVhbGl0eX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGl0aGVyPWZ1bmN0aW9uKGRpdGhlcil7aWYoZGl0aGVyPT09dHJ1ZSlkaXRoZXI9XCJGbG95ZFN0ZWluYmVyZ1wiO3RoaXMuZGl0aGVyPWRpdGhlcn07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0R2xvYmFsUGFsZXR0ZT1mdW5jdGlvbihwYWxldHRlKXt0aGlzLmdsb2JhbFBhbGV0dGU9cGFsZXR0ZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZ2V0R2xvYmFsUGFsZXR0ZT1mdW5jdGlvbigpe3JldHVybiB0aGlzLmdsb2JhbFBhbGV0dGUmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZSYmdGhpcy5nbG9iYWxQYWxldHRlLnNsaWNlKDApfHx0aGlzLmdsb2JhbFBhbGV0dGV9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlSGVhZGVyPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVVVEZCeXRlcyhcIkdJRjg5YVwiKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuYW5hbHl6ZVBpeGVscz1mdW5jdGlvbigpe2lmKCF0aGlzLmNvbG9yVGFiKXt0aGlzLm5ldVF1YW50PW5ldyBOZXVRdWFudCh0aGlzLnBpeGVscyx0aGlzLnNhbXBsZSk7dGhpcy5uZXVRdWFudC5idWlsZENvbG9ybWFwKCk7dGhpcy5jb2xvclRhYj10aGlzLm5ldVF1YW50LmdldENvbG9ybWFwKCl9aWYodGhpcy5kaXRoZXIpe3RoaXMuZGl0aGVyUGl4ZWxzKHRoaXMuZGl0aGVyLnJlcGxhY2UoXCItc2VycGVudGluZVwiLFwiXCIpLHRoaXMuZGl0aGVyLm1hdGNoKC8tc2VycGVudGluZS8pIT09bnVsbCl9ZWxzZXt0aGlzLmluZGV4UGl4ZWxzKCl9dGhpcy5waXhlbHM9bnVsbDt0aGlzLmNvbG9yRGVwdGg9ODt0aGlzLnBhbFNpemU9NztpZih0aGlzLnRyYW5zcGFyZW50IT09bnVsbCl7dGhpcy50cmFuc0luZGV4PXRoaXMuZmluZENsb3Nlc3QodGhpcy50cmFuc3BhcmVudCx0cnVlKX19O0dJRkVuY29kZXIucHJvdG90eXBlLmluZGV4UGl4ZWxzPWZ1bmN0aW9uKGltZ3Epe3ZhciBuUGl4PXRoaXMucGl4ZWxzLmxlbmd0aC8zO3RoaXMuaW5kZXhlZFBpeGVscz1uZXcgVWludDhBcnJheShuUGl4KTt2YXIgaz0wO2Zvcih2YXIgaj0wO2o8blBpeDtqKyspe3ZhciBpbmRleD10aGlzLmZpbmRDbG9zZXN0UkdCKHRoaXMucGl4ZWxzW2srK10mMjU1LHRoaXMucGl4ZWxzW2srK10mMjU1LHRoaXMucGl4ZWxzW2srK10mMjU1KTt0aGlzLnVzZWRFbnRyeVtpbmRleF09dHJ1ZTt0aGlzLmluZGV4ZWRQaXhlbHNbal09aW5kZXh9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5kaXRoZXJQaXhlbHM9ZnVuY3Rpb24oa2VybmVsLHNlcnBlbnRpbmUpe3ZhciBrZXJuZWxzPXtGYWxzZUZsb3lkU3RlaW5iZXJnOltbMy84LDEsMF0sWzMvOCwwLDFdLFsyLzgsMSwxXV0sRmxveWRTdGVpbmJlcmc6W1s3LzE2LDEsMF0sWzMvMTYsLTEsMV0sWzUvMTYsMCwxXSxbMS8xNiwxLDFdXSxTdHVja2k6W1s4LzQyLDEsMF0sWzQvNDIsMiwwXSxbMi80MiwtMiwxXSxbNC80MiwtMSwxXSxbOC80MiwwLDFdLFs0LzQyLDEsMV0sWzIvNDIsMiwxXSxbMS80MiwtMiwyXSxbMi80MiwtMSwyXSxbNC80MiwwLDJdLFsyLzQyLDEsMl0sWzEvNDIsMiwyXV0sQXRraW5zb246W1sxLzgsMSwwXSxbMS84LDIsMF0sWzEvOCwtMSwxXSxbMS84LDAsMV0sWzEvOCwxLDFdLFsxLzgsMCwyXV19O2lmKCFrZXJuZWx8fCFrZXJuZWxzW2tlcm5lbF0pe3Rocm93XCJVbmtub3duIGRpdGhlcmluZyBrZXJuZWw6IFwiK2tlcm5lbH12YXIgZHM9a2VybmVsc1trZXJuZWxdO3ZhciBpbmRleD0wLGhlaWdodD10aGlzLmhlaWdodCx3aWR0aD10aGlzLndpZHRoLGRhdGE9dGhpcy5waXhlbHM7dmFyIGRpcmVjdGlvbj1zZXJwZW50aW5lPy0xOjE7dGhpcy5pbmRleGVkUGl4ZWxzPW5ldyBVaW50OEFycmF5KHRoaXMucGl4ZWxzLmxlbmd0aC8zKTtmb3IodmFyIHk9MDt5PGhlaWdodDt5Kyspe2lmKHNlcnBlbnRpbmUpZGlyZWN0aW9uPWRpcmVjdGlvbiotMTtmb3IodmFyIHg9ZGlyZWN0aW9uPT0xPzA6d2lkdGgtMSx4ZW5kPWRpcmVjdGlvbj09MT93aWR0aDowO3ghPT14ZW5kO3grPWRpcmVjdGlvbil7aW5kZXg9eSp3aWR0aCt4O3ZhciBpZHg9aW5kZXgqMzt2YXIgcjE9ZGF0YVtpZHhdO3ZhciBnMT1kYXRhW2lkeCsxXTt2YXIgYjE9ZGF0YVtpZHgrMl07aWR4PXRoaXMuZmluZENsb3Nlc3RSR0IocjEsZzEsYjEpO3RoaXMudXNlZEVudHJ5W2lkeF09dHJ1ZTt0aGlzLmluZGV4ZWRQaXhlbHNbaW5kZXhdPWlkeDtpZHgqPTM7dmFyIHIyPXRoaXMuY29sb3JUYWJbaWR4XTt2YXIgZzI9dGhpcy5jb2xvclRhYltpZHgrMV07dmFyIGIyPXRoaXMuY29sb3JUYWJbaWR4KzJdO3ZhciBlcj1yMS1yMjt2YXIgZWc9ZzEtZzI7dmFyIGViPWIxLWIyO2Zvcih2YXIgaT1kaXJlY3Rpb249PTE/MDpkcy5sZW5ndGgtMSxlbmQ9ZGlyZWN0aW9uPT0xP2RzLmxlbmd0aDowO2khPT1lbmQ7aSs9ZGlyZWN0aW9uKXt2YXIgeDE9ZHNbaV1bMV07dmFyIHkxPWRzW2ldWzJdO2lmKHgxK3g+PTAmJngxK3g8d2lkdGgmJnkxK3k+PTAmJnkxK3k8aGVpZ2h0KXt2YXIgZD1kc1tpXVswXTtpZHg9aW5kZXgreDEreTEqd2lkdGg7aWR4Kj0zO2RhdGFbaWR4XT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeF0rZXIqZCkpO2RhdGFbaWR4KzFdPU1hdGgubWF4KDAsTWF0aC5taW4oMjU1LGRhdGFbaWR4KzFdK2VnKmQpKTtkYXRhW2lkeCsyXT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeCsyXStlYipkKSl9fX19fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5maW5kQ2xvc2VzdD1mdW5jdGlvbihjLHVzZWQpe3JldHVybiB0aGlzLmZpbmRDbG9zZXN0UkdCKChjJjE2NzExNjgwKT4+MTYsKGMmNjUyODApPj44LGMmMjU1LHVzZWQpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5maW5kQ2xvc2VzdFJHQj1mdW5jdGlvbihyLGcsYix1c2VkKXtpZih0aGlzLmNvbG9yVGFiPT09bnVsbClyZXR1cm4tMTtpZih0aGlzLm5ldVF1YW50JiYhdXNlZCl7cmV0dXJuIHRoaXMubmV1UXVhbnQubG9va3VwUkdCKHIsZyxiKX12YXIgYz1ifGc8PDh8cjw8MTY7dmFyIG1pbnBvcz0wO3ZhciBkbWluPTI1NioyNTYqMjU2O3ZhciBsZW49dGhpcy5jb2xvclRhYi5sZW5ndGg7Zm9yKHZhciBpPTAsaW5kZXg9MDtpPGxlbjtpbmRleCsrKXt2YXIgZHI9ci0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGRnPWctKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkYj1iLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZD1kcipkcitkZypkZytkYipkYjtpZigoIXVzZWR8fHRoaXMudXNlZEVudHJ5W2luZGV4XSkmJmQ8ZG1pbil7ZG1pbj1kO21pbnBvcz1pbmRleH19cmV0dXJuIG1pbnBvc307R0lGRW5jb2Rlci5wcm90b3R5cGUuZ2V0SW1hZ2VQaXhlbHM9ZnVuY3Rpb24oKXt2YXIgdz10aGlzLndpZHRoO3ZhciBoPXRoaXMuaGVpZ2h0O3RoaXMucGl4ZWxzPW5ldyBVaW50OEFycmF5KHcqaCozKTt2YXIgZGF0YT10aGlzLmltYWdlO3ZhciBzcmNQb3M9MDt2YXIgY291bnQ9MDtmb3IodmFyIGk9MDtpPGg7aSsrKXtmb3IodmFyIGo9MDtqPHc7aisrKXt0aGlzLnBpeGVsc1tjb3VudCsrXT1kYXRhW3NyY1BvcysrXTt0aGlzLnBpeGVsc1tjb3VudCsrXT1kYXRhW3NyY1BvcysrXTt0aGlzLnBpeGVsc1tjb3VudCsrXT1kYXRhW3NyY1BvcysrXTtzcmNQb3MrK319fTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUdyYXBoaWNDdHJsRXh0PWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDMzKTt0aGlzLm91dC53cml0ZUJ5dGUoMjQ5KTt0aGlzLm91dC53cml0ZUJ5dGUoNCk7dmFyIHRyYW5zcCxkaXNwO2lmKHRoaXMudHJhbnNwYXJlbnQ9PT1udWxsKXt0cmFuc3A9MDtkaXNwPTB9ZWxzZXt0cmFuc3A9MTtkaXNwPTJ9aWYodGhpcy5kaXNwb3NlPj0wKXtkaXNwPXRoaXMuZGlzcG9zZSY3fWRpc3A8PD0yO3RoaXMub3V0LndyaXRlQnl0ZSgwfGRpc3B8MHx0cmFuc3ApO3RoaXMud3JpdGVTaG9ydCh0aGlzLmRlbGF5KTt0aGlzLm91dC53cml0ZUJ5dGUodGhpcy50cmFuc0luZGV4KTt0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlSW1hZ2VEZXNjPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDQ0KTt0aGlzLndyaXRlU2hvcnQoMCk7dGhpcy53cml0ZVNob3J0KDApO3RoaXMud3JpdGVTaG9ydCh0aGlzLndpZHRoKTt0aGlzLndyaXRlU2hvcnQodGhpcy5oZWlnaHQpO2lmKHRoaXMuZmlyc3RGcmFtZXx8dGhpcy5nbG9iYWxQYWxldHRlKXt0aGlzLm91dC53cml0ZUJ5dGUoMCl9ZWxzZXt0aGlzLm91dC53cml0ZUJ5dGUoMTI4fDB8MHwwfHRoaXMucGFsU2l6ZSl9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUxTRD1mdW5jdGlvbigpe3RoaXMud3JpdGVTaG9ydCh0aGlzLndpZHRoKTt0aGlzLndyaXRlU2hvcnQodGhpcy5oZWlnaHQpO3RoaXMub3V0LndyaXRlQnl0ZSgxMjh8MTEyfDB8dGhpcy5wYWxTaXplKTt0aGlzLm91dC53cml0ZUJ5dGUoMCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZU5ldHNjYXBlRXh0PWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDMzKTt0aGlzLm91dC53cml0ZUJ5dGUoMjU1KTt0aGlzLm91dC53cml0ZUJ5dGUoMTEpO3RoaXMub3V0LndyaXRlVVRGQnl0ZXMoXCJORVRTQ0FQRTIuMFwiKTt0aGlzLm91dC53cml0ZUJ5dGUoMyk7dGhpcy5vdXQud3JpdGVCeXRlKDEpO3RoaXMud3JpdGVTaG9ydCh0aGlzLnJlcGVhdCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZVBhbGV0dGU9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGVzKHRoaXMuY29sb3JUYWIpO3ZhciBuPTMqMjU2LXRoaXMuY29sb3JUYWIubGVuZ3RoO2Zvcih2YXIgaT0wO2k8bjtpKyspdGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZVNob3J0PWZ1bmN0aW9uKHBWYWx1ZSl7dGhpcy5vdXQud3JpdGVCeXRlKHBWYWx1ZSYyNTUpO3RoaXMub3V0LndyaXRlQnl0ZShwVmFsdWU+PjgmMjU1KX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVQaXhlbHM9ZnVuY3Rpb24oKXt2YXIgZW5jPW5ldyBMWldFbmNvZGVyKHRoaXMud2lkdGgsdGhpcy5oZWlnaHQsdGhpcy5pbmRleGVkUGl4ZWxzLHRoaXMuY29sb3JEZXB0aCk7ZW5jLmVuY29kZSh0aGlzLm91dCl9O0dJRkVuY29kZXIucHJvdG90eXBlLnN0cmVhbT1mdW5jdGlvbigpe3JldHVybiB0aGlzLm91dH07bW9kdWxlLmV4cG9ydHM9R0lGRW5jb2Rlcn0se1wiLi9MWldFbmNvZGVyLmpzXCI6MyxcIi4vVHlwZWROZXVRdWFudC5qc1wiOjR9XSwzOltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgRU9GPS0xO3ZhciBCSVRTPTEyO3ZhciBIU0laRT01MDAzO3ZhciBtYXNrcz1bMCwxLDMsNywxNSwzMSw2MywxMjcsMjU1LDUxMSwxMDIzLDIwNDcsNDA5NSw4MTkxLDE2MzgzLDMyNzY3LDY1NTM1XTtmdW5jdGlvbiBMWldFbmNvZGVyKHdpZHRoLGhlaWdodCxwaXhlbHMsY29sb3JEZXB0aCl7dmFyIGluaXRDb2RlU2l6ZT1NYXRoLm1heCgyLGNvbG9yRGVwdGgpO3ZhciBhY2N1bT1uZXcgVWludDhBcnJheSgyNTYpO3ZhciBodGFiPW5ldyBJbnQzMkFycmF5KEhTSVpFKTt2YXIgY29kZXRhYj1uZXcgSW50MzJBcnJheShIU0laRSk7dmFyIGN1cl9hY2N1bSxjdXJfYml0cz0wO3ZhciBhX2NvdW50O3ZhciBmcmVlX2VudD0wO3ZhciBtYXhjb2RlO3ZhciBjbGVhcl9mbGc9ZmFsc2U7dmFyIGdfaW5pdF9iaXRzLENsZWFyQ29kZSxFT0ZDb2RlO2Z1bmN0aW9uIGNoYXJfb3V0KGMsb3V0cyl7YWNjdW1bYV9jb3VudCsrXT1jO2lmKGFfY291bnQ+PTI1NClmbHVzaF9jaGFyKG91dHMpfWZ1bmN0aW9uIGNsX2Jsb2NrKG91dHMpe2NsX2hhc2goSFNJWkUpO2ZyZWVfZW50PUNsZWFyQ29kZSsyO2NsZWFyX2ZsZz10cnVlO291dHB1dChDbGVhckNvZGUsb3V0cyl9ZnVuY3Rpb24gY2xfaGFzaChoc2l6ZSl7Zm9yKHZhciBpPTA7aTxoc2l6ZTsrK2kpaHRhYltpXT0tMX1mdW5jdGlvbiBjb21wcmVzcyhpbml0X2JpdHMsb3V0cyl7dmFyIGZjb2RlLGMsaSxlbnQsZGlzcCxoc2l6ZV9yZWcsaHNoaWZ0O2dfaW5pdF9iaXRzPWluaXRfYml0cztjbGVhcl9mbGc9ZmFsc2U7bl9iaXRzPWdfaW5pdF9iaXRzO21heGNvZGU9TUFYQ09ERShuX2JpdHMpO0NsZWFyQ29kZT0xPDxpbml0X2JpdHMtMTtFT0ZDb2RlPUNsZWFyQ29kZSsxO2ZyZWVfZW50PUNsZWFyQ29kZSsyO2FfY291bnQ9MDtlbnQ9bmV4dFBpeGVsKCk7aHNoaWZ0PTA7Zm9yKGZjb2RlPUhTSVpFO2Zjb2RlPDY1NTM2O2Zjb2RlKj0yKSsraHNoaWZ0O2hzaGlmdD04LWhzaGlmdDtoc2l6ZV9yZWc9SFNJWkU7Y2xfaGFzaChoc2l6ZV9yZWcpO291dHB1dChDbGVhckNvZGUsb3V0cyk7b3V0ZXJfbG9vcDp3aGlsZSgoYz1uZXh0UGl4ZWwoKSkhPUVPRil7ZmNvZGU9KGM8PEJJVFMpK2VudDtpPWM8PGhzaGlmdF5lbnQ7aWYoaHRhYltpXT09PWZjb2RlKXtlbnQ9Y29kZXRhYltpXTtjb250aW51ZX1lbHNlIGlmKGh0YWJbaV0+PTApe2Rpc3A9aHNpemVfcmVnLWk7aWYoaT09PTApZGlzcD0xO2Rve2lmKChpLT1kaXNwKTwwKWkrPWhzaXplX3JlZztpZihodGFiW2ldPT09ZmNvZGUpe2VudD1jb2RldGFiW2ldO2NvbnRpbnVlIG91dGVyX2xvb3B9fXdoaWxlKGh0YWJbaV0+PTApfW91dHB1dChlbnQsb3V0cyk7ZW50PWM7aWYoZnJlZV9lbnQ8MTw8QklUUyl7Y29kZXRhYltpXT1mcmVlX2VudCsrO2h0YWJbaV09ZmNvZGV9ZWxzZXtjbF9ibG9jayhvdXRzKX19b3V0cHV0KGVudCxvdXRzKTtvdXRwdXQoRU9GQ29kZSxvdXRzKX1mdW5jdGlvbiBlbmNvZGUob3V0cyl7b3V0cy53cml0ZUJ5dGUoaW5pdENvZGVTaXplKTtyZW1haW5pbmc9d2lkdGgqaGVpZ2h0O2N1clBpeGVsPTA7Y29tcHJlc3MoaW5pdENvZGVTaXplKzEsb3V0cyk7b3V0cy53cml0ZUJ5dGUoMCl9ZnVuY3Rpb24gZmx1c2hfY2hhcihvdXRzKXtpZihhX2NvdW50PjApe291dHMud3JpdGVCeXRlKGFfY291bnQpO291dHMud3JpdGVCeXRlcyhhY2N1bSwwLGFfY291bnQpO2FfY291bnQ9MH19ZnVuY3Rpb24gTUFYQ09ERShuX2JpdHMpe3JldHVybigxPDxuX2JpdHMpLTF9ZnVuY3Rpb24gbmV4dFBpeGVsKCl7aWYocmVtYWluaW5nPT09MClyZXR1cm4gRU9GOy0tcmVtYWluaW5nO3ZhciBwaXg9cGl4ZWxzW2N1clBpeGVsKytdO3JldHVybiBwaXgmMjU1fWZ1bmN0aW9uIG91dHB1dChjb2RlLG91dHMpe2N1cl9hY2N1bSY9bWFza3NbY3VyX2JpdHNdO2lmKGN1cl9iaXRzPjApY3VyX2FjY3VtfD1jb2RlPDxjdXJfYml0cztlbHNlIGN1cl9hY2N1bT1jb2RlO2N1cl9iaXRzKz1uX2JpdHM7d2hpbGUoY3VyX2JpdHM+PTgpe2NoYXJfb3V0KGN1cl9hY2N1bSYyNTUsb3V0cyk7Y3VyX2FjY3VtPj49ODtjdXJfYml0cy09OH1pZihmcmVlX2VudD5tYXhjb2RlfHxjbGVhcl9mbGcpe2lmKGNsZWFyX2ZsZyl7bWF4Y29kZT1NQVhDT0RFKG5fYml0cz1nX2luaXRfYml0cyk7Y2xlYXJfZmxnPWZhbHNlfWVsc2V7KytuX2JpdHM7aWYobl9iaXRzPT1CSVRTKW1heGNvZGU9MTw8QklUUztlbHNlIG1heGNvZGU9TUFYQ09ERShuX2JpdHMpfX1pZihjb2RlPT1FT0ZDb2RlKXt3aGlsZShjdXJfYml0cz4wKXtjaGFyX291dChjdXJfYWNjdW0mMjU1LG91dHMpO2N1cl9hY2N1bT4+PTg7Y3VyX2JpdHMtPTh9Zmx1c2hfY2hhcihvdXRzKX19dGhpcy5lbmNvZGU9ZW5jb2RlfW1vZHVsZS5leHBvcnRzPUxaV0VuY29kZXJ9LHt9XSw0OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgbmN5Y2xlcz0xMDA7dmFyIG5ldHNpemU9MjU2O3ZhciBtYXhuZXRwb3M9bmV0c2l6ZS0xO3ZhciBuZXRiaWFzc2hpZnQ9NDt2YXIgaW50Ymlhc3NoaWZ0PTE2O3ZhciBpbnRiaWFzPTE8PGludGJpYXNzaGlmdDt2YXIgZ2FtbWFzaGlmdD0xMDt2YXIgZ2FtbWE9MTw8Z2FtbWFzaGlmdDt2YXIgYmV0YXNoaWZ0PTEwO3ZhciBiZXRhPWludGJpYXM+PmJldGFzaGlmdDt2YXIgYmV0YWdhbW1hPWludGJpYXM8PGdhbW1hc2hpZnQtYmV0YXNoaWZ0O3ZhciBpbml0cmFkPW5ldHNpemU+PjM7dmFyIHJhZGl1c2JpYXNzaGlmdD02O3ZhciByYWRpdXNiaWFzPTE8PHJhZGl1c2JpYXNzaGlmdDt2YXIgaW5pdHJhZGl1cz1pbml0cmFkKnJhZGl1c2JpYXM7dmFyIHJhZGl1c2RlYz0zMDt2YXIgYWxwaGFiaWFzc2hpZnQ9MTA7dmFyIGluaXRhbHBoYT0xPDxhbHBoYWJpYXNzaGlmdDt2YXIgYWxwaGFkZWM7dmFyIHJhZGJpYXNzaGlmdD04O3ZhciByYWRiaWFzPTE8PHJhZGJpYXNzaGlmdDt2YXIgYWxwaGFyYWRic2hpZnQ9YWxwaGFiaWFzc2hpZnQrcmFkYmlhc3NoaWZ0O3ZhciBhbHBoYXJhZGJpYXM9MTw8YWxwaGFyYWRic2hpZnQ7dmFyIHByaW1lMT00OTk7dmFyIHByaW1lMj00OTE7dmFyIHByaW1lMz00ODc7dmFyIHByaW1lND01MDM7dmFyIG1pbnBpY3R1cmVieXRlcz0zKnByaW1lNDtmdW5jdGlvbiBOZXVRdWFudChwaXhlbHMsc2FtcGxlZmFjKXt2YXIgbmV0d29yazt2YXIgbmV0aW5kZXg7dmFyIGJpYXM7dmFyIGZyZXE7dmFyIHJhZHBvd2VyO2Z1bmN0aW9uIGluaXQoKXtuZXR3b3JrPVtdO25ldGluZGV4PW5ldyBJbnQzMkFycmF5KDI1Nik7Ymlhcz1uZXcgSW50MzJBcnJheShuZXRzaXplKTtmcmVxPW5ldyBJbnQzMkFycmF5KG5ldHNpemUpO3JhZHBvd2VyPW5ldyBJbnQzMkFycmF5KG5ldHNpemU+PjMpO3ZhciBpLHY7Zm9yKGk9MDtpPG5ldHNpemU7aSsrKXt2PShpPDxuZXRiaWFzc2hpZnQrOCkvbmV0c2l6ZTtuZXR3b3JrW2ldPW5ldyBGbG9hdDY0QXJyYXkoW3Ysdix2LDBdKTtmcmVxW2ldPWludGJpYXMvbmV0c2l6ZTtiaWFzW2ldPTB9fWZ1bmN0aW9uIHVuYmlhc25ldCgpe2Zvcih2YXIgaT0wO2k8bmV0c2l6ZTtpKyspe25ldHdvcmtbaV1bMF0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVsxXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzJdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bM109aX19ZnVuY3Rpb24gYWx0ZXJzaW5nbGUoYWxwaGEsaSxiLGcscil7bmV0d29ya1tpXVswXS09YWxwaGEqKG5ldHdvcmtbaV1bMF0tYikvaW5pdGFscGhhO25ldHdvcmtbaV1bMV0tPWFscGhhKihuZXR3b3JrW2ldWzFdLWcpL2luaXRhbHBoYTtuZXR3b3JrW2ldWzJdLT1hbHBoYSoobmV0d29ya1tpXVsyXS1yKS9pbml0YWxwaGF9ZnVuY3Rpb24gYWx0ZXJuZWlnaChyYWRpdXMsaSxiLGcscil7dmFyIGxvPU1hdGguYWJzKGktcmFkaXVzKTt2YXIgaGk9TWF0aC5taW4oaStyYWRpdXMsbmV0c2l6ZSk7dmFyIGo9aSsxO3ZhciBrPWktMTt2YXIgbT0xO3ZhciBwLGE7d2hpbGUoajxoaXx8az5sbyl7YT1yYWRwb3dlclttKytdO2lmKGo8aGkpe3A9bmV0d29ya1tqKytdO3BbMF0tPWEqKHBbMF0tYikvYWxwaGFyYWRiaWFzO3BbMV0tPWEqKHBbMV0tZykvYWxwaGFyYWRiaWFzO3BbMl0tPWEqKHBbMl0tcikvYWxwaGFyYWRiaWFzfWlmKGs+bG8pe3A9bmV0d29ya1trLS1dO3BbMF0tPWEqKHBbMF0tYikvYWxwaGFyYWRiaWFzO3BbMV0tPWEqKHBbMV0tZykvYWxwaGFyYWRiaWFzO3BbMl0tPWEqKHBbMl0tcikvYWxwaGFyYWRiaWFzfX19ZnVuY3Rpb24gY29udGVzdChiLGcscil7dmFyIGJlc3RkPX4oMTw8MzEpO3ZhciBiZXN0Ymlhc2Q9YmVzdGQ7dmFyIGJlc3Rwb3M9LTE7dmFyIGJlc3RiaWFzcG9zPWJlc3Rwb3M7dmFyIGksbixkaXN0LGJpYXNkaXN0LGJldGFmcmVxO2ZvcihpPTA7aTxuZXRzaXplO2krKyl7bj1uZXR3b3JrW2ldO2Rpc3Q9TWF0aC5hYnMoblswXS1iKStNYXRoLmFicyhuWzFdLWcpK01hdGguYWJzKG5bMl0tcik7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0cG9zPWl9Ymlhc2Rpc3Q9ZGlzdC0oYmlhc1tpXT4+aW50Ymlhc3NoaWZ0LW5ldGJpYXNzaGlmdCk7aWYoYmlhc2Rpc3Q8YmVzdGJpYXNkKXtiZXN0Ymlhc2Q9Ymlhc2Rpc3Q7YmVzdGJpYXNwb3M9aX1iZXRhZnJlcT1mcmVxW2ldPj5iZXRhc2hpZnQ7ZnJlcVtpXS09YmV0YWZyZXE7Ymlhc1tpXSs9YmV0YWZyZXE8PGdhbW1hc2hpZnR9ZnJlcVtiZXN0cG9zXSs9YmV0YTtiaWFzW2Jlc3Rwb3NdLT1iZXRhZ2FtbWE7cmV0dXJuIGJlc3RiaWFzcG9zfWZ1bmN0aW9uIGlueGJ1aWxkKCl7dmFyIGksaixwLHEsc21hbGxwb3Msc21hbGx2YWwscHJldmlvdXNjb2w9MCxzdGFydHBvcz0wO2ZvcihpPTA7aTxuZXRzaXplO2krKyl7cD1uZXR3b3JrW2ldO3NtYWxscG9zPWk7c21hbGx2YWw9cFsxXTtmb3Ioaj1pKzE7ajxuZXRzaXplO2orKyl7cT1uZXR3b3JrW2pdO2lmKHFbMV08c21hbGx2YWwpe3NtYWxscG9zPWo7c21hbGx2YWw9cVsxXX19cT1uZXR3b3JrW3NtYWxscG9zXTtpZihpIT1zbWFsbHBvcyl7aj1xWzBdO3FbMF09cFswXTtwWzBdPWo7aj1xWzFdO3FbMV09cFsxXTtwWzFdPWo7aj1xWzJdO3FbMl09cFsyXTtwWzJdPWo7aj1xWzNdO3FbM109cFszXTtwWzNdPWp9aWYoc21hbGx2YWwhPXByZXZpb3VzY29sKXtuZXRpbmRleFtwcmV2aW91c2NvbF09c3RhcnRwb3MraT4+MTtmb3Ioaj1wcmV2aW91c2NvbCsxO2o8c21hbGx2YWw7aisrKW5ldGluZGV4W2pdPWk7cHJldmlvdXNjb2w9c21hbGx2YWw7c3RhcnRwb3M9aX19bmV0aW5kZXhbcHJldmlvdXNjb2xdPXN0YXJ0cG9zK21heG5ldHBvcz4+MTtmb3Ioaj1wcmV2aW91c2NvbCsxO2o8MjU2O2orKyluZXRpbmRleFtqXT1tYXhuZXRwb3N9ZnVuY3Rpb24gaW54c2VhcmNoKGIsZyxyKXt2YXIgYSxwLGRpc3Q7dmFyIGJlc3RkPTFlMzt2YXIgYmVzdD0tMTt2YXIgaT1uZXRpbmRleFtnXTt2YXIgaj1pLTE7d2hpbGUoaTxuZXRzaXplfHxqPj0wKXtpZihpPG5ldHNpemUpe3A9bmV0d29ya1tpXTtkaXN0PXBbMV0tZztpZihkaXN0Pj1iZXN0ZClpPW5ldHNpemU7ZWxzZXtpKys7aWYoZGlzdDwwKWRpc3Q9LWRpc3Q7YT1wWzBdLWI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXthPXBbMl0tcjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdD1wWzNdfX19fWlmKGo+PTApe3A9bmV0d29ya1tqXTtkaXN0PWctcFsxXTtpZihkaXN0Pj1iZXN0ZClqPS0xO2Vsc2V7ai0tO2lmKGRpc3Q8MClkaXN0PS1kaXN0O2E9cFswXS1iO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YT1wWzJdLXI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Q9cFszXX19fX19cmV0dXJuIGJlc3R9ZnVuY3Rpb24gbGVhcm4oKXt2YXIgaTt2YXIgbGVuZ3RoY291bnQ9cGl4ZWxzLmxlbmd0aDt2YXIgYWxwaGFkZWM9MzArKHNhbXBsZWZhYy0xKS8zO3ZhciBzYW1wbGVwaXhlbHM9bGVuZ3RoY291bnQvKDMqc2FtcGxlZmFjKTt2YXIgZGVsdGE9fn4oc2FtcGxlcGl4ZWxzL25jeWNsZXMpO3ZhciBhbHBoYT1pbml0YWxwaGE7dmFyIHJhZGl1cz1pbml0cmFkaXVzO3ZhciByYWQ9cmFkaXVzPj5yYWRpdXNiaWFzc2hpZnQ7aWYocmFkPD0xKXJhZD0wO2ZvcihpPTA7aTxyYWQ7aSsrKXJhZHBvd2VyW2ldPWFscGhhKigocmFkKnJhZC1pKmkpKnJhZGJpYXMvKHJhZCpyYWQpKTt2YXIgc3RlcDtpZihsZW5ndGhjb3VudDxtaW5waWN0dXJlYnl0ZXMpe3NhbXBsZWZhYz0xO3N0ZXA9M31lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMSE9PTApe3N0ZXA9MypwcmltZTF9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTIhPT0wKXtzdGVwPTMqcHJpbWUyfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUzIT09MCl7c3RlcD0zKnByaW1lM31lbHNle3N0ZXA9MypwcmltZTR9dmFyIGIsZyxyLGo7dmFyIHBpeD0wO2k9MDt3aGlsZShpPHNhbXBsZXBpeGVscyl7Yj0ocGl4ZWxzW3BpeF0mMjU1KTw8bmV0Ymlhc3NoaWZ0O2c9KHBpeGVsc1twaXgrMV0mMjU1KTw8bmV0Ymlhc3NoaWZ0O3I9KHBpeGVsc1twaXgrMl0mMjU1KTw8bmV0Ymlhc3NoaWZ0O2o9Y29udGVzdChiLGcscik7YWx0ZXJzaW5nbGUoYWxwaGEsaixiLGcscik7aWYocmFkIT09MClhbHRlcm5laWdoKHJhZCxqLGIsZyxyKTtwaXgrPXN0ZXA7aWYocGl4Pj1sZW5ndGhjb3VudClwaXgtPWxlbmd0aGNvdW50O2krKztpZihkZWx0YT09PTApZGVsdGE9MTtpZihpJWRlbHRhPT09MCl7YWxwaGEtPWFscGhhL2FscGhhZGVjO3JhZGl1cy09cmFkaXVzL3JhZGl1c2RlYztyYWQ9cmFkaXVzPj5yYWRpdXNiaWFzc2hpZnQ7aWYocmFkPD0xKXJhZD0wO2ZvcihqPTA7ajxyYWQ7aisrKXJhZHBvd2VyW2pdPWFscGhhKigocmFkKnJhZC1qKmopKnJhZGJpYXMvKHJhZCpyYWQpKX19fWZ1bmN0aW9uIGJ1aWxkQ29sb3JtYXAoKXtpbml0KCk7bGVhcm4oKTt1bmJpYXNuZXQoKTtpbnhidWlsZCgpfXRoaXMuYnVpbGRDb2xvcm1hcD1idWlsZENvbG9ybWFwO2Z1bmN0aW9uIGdldENvbG9ybWFwKCl7dmFyIG1hcD1bXTt2YXIgaW5kZXg9W107Zm9yKHZhciBpPTA7aTxuZXRzaXplO2krKylpbmRleFtuZXR3b3JrW2ldWzNdXT1pO3ZhciBrPTA7Zm9yKHZhciBsPTA7bDxuZXRzaXplO2wrKyl7dmFyIGo9aW5kZXhbbF07bWFwW2srK109bmV0d29ya1tqXVswXTttYXBbaysrXT1uZXR3b3JrW2pdWzFdO21hcFtrKytdPW5ldHdvcmtbal1bMl19cmV0dXJuIG1hcH10aGlzLmdldENvbG9ybWFwPWdldENvbG9ybWFwO3RoaXMubG9va3VwUkdCPWlueHNlYXJjaH1tb2R1bGUuZXhwb3J0cz1OZXVRdWFudH0se31dLDU6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBVQSxicm93c2VyLG1vZGUscGxhdGZvcm0sdWE7dWE9bmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpO3BsYXRmb3JtPW5hdmlnYXRvci5wbGF0Zm9ybS50b0xvd2VyQ2FzZSgpO1VBPXVhLm1hdGNoKC8ob3BlcmF8aWV8ZmlyZWZveHxjaHJvbWV8dmVyc2lvbilbXFxzXFwvOl0oW1xcd1xcZFxcLl0rKT8uKj8oc2FmYXJpfHZlcnNpb25bXFxzXFwvOl0oW1xcd1xcZFxcLl0rKXwkKS8pfHxbbnVsbCxcInVua25vd25cIiwwXTttb2RlPVVBWzFdPT09XCJpZVwiJiZkb2N1bWVudC5kb2N1bWVudE1vZGU7YnJvd3Nlcj17bmFtZTpVQVsxXT09PVwidmVyc2lvblwiP1VBWzNdOlVBWzFdLHZlcnNpb246bW9kZXx8cGFyc2VGbG9hdChVQVsxXT09PVwib3BlcmFcIiYmVUFbNF0/VUFbNF06VUFbMl0pLHBsYXRmb3JtOntuYW1lOnVhLm1hdGNoKC9pcCg/OmFkfG9kfGhvbmUpLyk/XCJpb3NcIjoodWEubWF0Y2goLyg/OndlYm9zfGFuZHJvaWQpLyl8fHBsYXRmb3JtLm1hdGNoKC9tYWN8d2lufGxpbnV4Lyl8fFtcIm90aGVyXCJdKVswXX19O2Jyb3dzZXJbYnJvd3Nlci5uYW1lXT10cnVlO2Jyb3dzZXJbYnJvd3Nlci5uYW1lK3BhcnNlSW50KGJyb3dzZXIudmVyc2lvbiwxMCldPXRydWU7YnJvd3Nlci5wbGF0Zm9ybVticm93c2VyLnBsYXRmb3JtLm5hbWVdPXRydWU7bW9kdWxlLmV4cG9ydHM9YnJvd3Nlcn0se31dLDY6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBFdmVudEVtaXR0ZXIsR0lGLEdJRkVuY29kZXIsYnJvd3NlcixnaWZXb3JrZXIsZXh0ZW5kPWZ1bmN0aW9uKGNoaWxkLHBhcmVudCl7Zm9yKHZhciBrZXkgaW4gcGFyZW50KXtpZihoYXNQcm9wLmNhbGwocGFyZW50LGtleSkpY2hpbGRba2V5XT1wYXJlbnRba2V5XX1mdW5jdGlvbiBjdG9yKCl7dGhpcy5jb25zdHJ1Y3Rvcj1jaGlsZH1jdG9yLnByb3RvdHlwZT1wYXJlbnQucHJvdG90eXBlO2NoaWxkLnByb3RvdHlwZT1uZXcgY3RvcjtjaGlsZC5fX3N1cGVyX189cGFyZW50LnByb3RvdHlwZTtyZXR1cm4gY2hpbGR9LGhhc1Byb3A9e30uaGFzT3duUHJvcGVydHksaW5kZXhPZj1bXS5pbmRleE9mfHxmdW5jdGlvbihpdGVtKXtmb3IodmFyIGk9MCxsPXRoaXMubGVuZ3RoO2k8bDtpKyspe2lmKGkgaW4gdGhpcyYmdGhpc1tpXT09PWl0ZW0pcmV0dXJuIGl9cmV0dXJuLTF9LHNsaWNlPVtdLnNsaWNlO0V2ZW50RW1pdHRlcj1yZXF1aXJlKFwiZXZlbnRzXCIpLkV2ZW50RW1pdHRlcjticm93c2VyPXJlcXVpcmUoXCIuL2Jyb3dzZXIuY29mZmVlXCIpO0dJRkVuY29kZXI9cmVxdWlyZShcIi4vR0lGRW5jb2Rlci5qc1wiKTtnaWZXb3JrZXI9cmVxdWlyZShcIi4vZ2lmLndvcmtlci5jb2ZmZWVcIik7bW9kdWxlLmV4cG9ydHM9R0lGPWZ1bmN0aW9uKHN1cGVyQ2xhc3Mpe3ZhciBkZWZhdWx0cyxmcmFtZURlZmF1bHRzO2V4dGVuZChHSUYsc3VwZXJDbGFzcyk7ZGVmYXVsdHM9e3dvcmtlclNjcmlwdDpcImdpZi53b3JrZXIuanNcIix3b3JrZXJzOjIscmVwZWF0OjAsYmFja2dyb3VuZDpcIiNmZmZcIixxdWFsaXR5OjEwLHdpZHRoOm51bGwsaGVpZ2h0Om51bGwsdHJhbnNwYXJlbnQ6bnVsbCxkZWJ1ZzpmYWxzZSxkaXRoZXI6ZmFsc2V9O2ZyYW1lRGVmYXVsdHM9e2RlbGF5OjUwMCxjb3B5OmZhbHNlLGRpc3Bvc2U6LTF9O2Z1bmN0aW9uIEdJRihvcHRpb25zKXt2YXIgYmFzZSxrZXksdmFsdWU7dGhpcy5ydW5uaW5nPWZhbHNlO3RoaXMub3B0aW9ucz17fTt0aGlzLmZyYW1lcz1bXTt0aGlzLmZyZWVXb3JrZXJzPVtdO3RoaXMuYWN0aXZlV29ya2Vycz1bXTt0aGlzLnNldE9wdGlvbnMob3B0aW9ucyk7Zm9yKGtleSBpbiBkZWZhdWx0cyl7dmFsdWU9ZGVmYXVsdHNba2V5XTtpZigoYmFzZT10aGlzLm9wdGlvbnMpW2tleV09PW51bGwpe2Jhc2Vba2V5XT12YWx1ZX19fUdJRi5wcm90b3R5cGUuc2V0T3B0aW9uPWZ1bmN0aW9uKGtleSx2YWx1ZSl7dGhpcy5vcHRpb25zW2tleV09dmFsdWU7aWYodGhpcy5fY2FudmFzIT1udWxsJiYoa2V5PT09XCJ3aWR0aFwifHxrZXk9PT1cImhlaWdodFwiKSl7cmV0dXJuIHRoaXMuX2NhbnZhc1trZXldPXZhbHVlfX07R0lGLnByb3RvdHlwZS5zZXRPcHRpb25zPWZ1bmN0aW9uKG9wdGlvbnMpe3ZhciBrZXkscmVzdWx0cyx2YWx1ZTtyZXN1bHRzPVtdO2ZvcihrZXkgaW4gb3B0aW9ucyl7aWYoIWhhc1Byb3AuY2FsbChvcHRpb25zLGtleSkpY29udGludWU7dmFsdWU9b3B0aW9uc1trZXldO3Jlc3VsdHMucHVzaCh0aGlzLnNldE9wdGlvbihrZXksdmFsdWUpKX1yZXR1cm4gcmVzdWx0c307R0lGLnByb3RvdHlwZS5hZGRGcmFtZT1mdW5jdGlvbihpbWFnZSxvcHRpb25zKXt2YXIgZnJhbWUsa2V5O2lmKG9wdGlvbnM9PW51bGwpe29wdGlvbnM9e319ZnJhbWU9e307ZnJhbWUudHJhbnNwYXJlbnQ9dGhpcy5vcHRpb25zLnRyYW5zcGFyZW50O2ZvcihrZXkgaW4gZnJhbWVEZWZhdWx0cyl7ZnJhbWVba2V5XT1vcHRpb25zW2tleV18fGZyYW1lRGVmYXVsdHNba2V5XX1pZih0aGlzLm9wdGlvbnMud2lkdGg9PW51bGwpe3RoaXMuc2V0T3B0aW9uKFwid2lkdGhcIixpbWFnZS53aWR0aCl9aWYodGhpcy5vcHRpb25zLmhlaWdodD09bnVsbCl7dGhpcy5zZXRPcHRpb24oXCJoZWlnaHRcIixpbWFnZS5oZWlnaHQpfWlmKHR5cGVvZiBJbWFnZURhdGEhPT1cInVuZGVmaW5lZFwiJiZJbWFnZURhdGEhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIEltYWdlRGF0YSl7ZnJhbWUuZGF0YT1pbWFnZS5kYXRhfWVsc2UgaWYodHlwZW9mIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCE9PVwidW5kZWZpbmVkXCImJkNhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEfHx0eXBlb2YgV2ViR0xSZW5kZXJpbmdDb250ZXh0IT09XCJ1bmRlZmluZWRcIiYmV2ViR0xSZW5kZXJpbmdDb250ZXh0IT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBXZWJHTFJlbmRlcmluZ0NvbnRleHQpe2lmKG9wdGlvbnMuY29weSl7ZnJhbWUuZGF0YT10aGlzLmdldENvbnRleHREYXRhKGltYWdlKX1lbHNle2ZyYW1lLmNvbnRleHQ9aW1hZ2V9fWVsc2UgaWYoaW1hZ2UuY2hpbGROb2RlcyE9bnVsbCl7aWYob3B0aW9ucy5jb3B5KXtmcmFtZS5kYXRhPXRoaXMuZ2V0SW1hZ2VEYXRhKGltYWdlKX1lbHNle2ZyYW1lLmltYWdlPWltYWdlfX1lbHNle3Rocm93IG5ldyBFcnJvcihcIkludmFsaWQgaW1hZ2VcIil9cmV0dXJuIHRoaXMuZnJhbWVzLnB1c2goZnJhbWUpfTtHSUYucHJvdG90eXBlLnJlbmRlcj1mdW5jdGlvbigpe3ZhciBpLGosbnVtV29ya2VycyxyZWY7aWYodGhpcy5ydW5uaW5nKXt0aHJvdyBuZXcgRXJyb3IoXCJBbHJlYWR5IHJ1bm5pbmdcIil9aWYodGhpcy5vcHRpb25zLndpZHRoPT1udWxsfHx0aGlzLm9wdGlvbnMuaGVpZ2h0PT1udWxsKXt0aHJvdyBuZXcgRXJyb3IoXCJXaWR0aCBhbmQgaGVpZ2h0IG11c3QgYmUgc2V0IHByaW9yIHRvIHJlbmRlcmluZ1wiKX10aGlzLnJ1bm5pbmc9dHJ1ZTt0aGlzLm5leHRGcmFtZT0wO3RoaXMuZmluaXNoZWRGcmFtZXM9MDt0aGlzLmltYWdlUGFydHM9ZnVuY3Rpb24oKXt2YXIgaixyZWYscmVzdWx0cztyZXN1bHRzPVtdO2ZvcihpPWo9MCxyZWY9dGhpcy5mcmFtZXMubGVuZ3RoOzA8PXJlZj9qPHJlZjpqPnJlZjtpPTA8PXJlZj8rK2o6LS1qKXtyZXN1bHRzLnB1c2gobnVsbCl9cmV0dXJuIHJlc3VsdHN9LmNhbGwodGhpcyk7bnVtV29ya2Vycz10aGlzLnNwYXduV29ya2VycygpO2lmKHRoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPT09dHJ1ZSl7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX1lbHNle2ZvcihpPWo9MCxyZWY9bnVtV29ya2VyczswPD1yZWY/ajxyZWY6aj5yZWY7aT0wPD1yZWY/KytqOi0tail7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX19dGhpcy5lbWl0KFwic3RhcnRcIik7cmV0dXJuIHRoaXMuZW1pdChcInByb2dyZXNzXCIsMCl9O0dJRi5wcm90b3R5cGUuYWJvcnQ9ZnVuY3Rpb24oKXt2YXIgd29ya2VyO3doaWxlKHRydWUpe3dvcmtlcj10aGlzLmFjdGl2ZVdvcmtlcnMuc2hpZnQoKTtpZih3b3JrZXI9PW51bGwpe2JyZWFrfXRoaXMubG9nKFwia2lsbGluZyBhY3RpdmUgd29ya2VyXCIpO3dvcmtlci50ZXJtaW5hdGUoKX10aGlzLnJ1bm5pbmc9ZmFsc2U7cmV0dXJuIHRoaXMuZW1pdChcImFib3J0XCIpfTtHSUYucHJvdG90eXBlLnNwYXduV29ya2Vycz1mdW5jdGlvbigpe3ZhciBqLG51bVdvcmtlcnMscmVmLHJlc3VsdHM7bnVtV29ya2Vycz1NYXRoLm1pbih0aGlzLm9wdGlvbnMud29ya2Vycyx0aGlzLmZyYW1lcy5sZW5ndGgpOyhmdW5jdGlvbigpe3Jlc3VsdHM9W107Zm9yKHZhciBqPXJlZj10aGlzLmZyZWVXb3JrZXJzLmxlbmd0aDtyZWY8PW51bVdvcmtlcnM/ajxudW1Xb3JrZXJzOmo+bnVtV29ya2VycztyZWY8PW51bVdvcmtlcnM/aisrOmotLSl7cmVzdWx0cy5wdXNoKGopfXJldHVybiByZXN1bHRzfSkuYXBwbHkodGhpcykuZm9yRWFjaChmdW5jdGlvbihfdGhpcyl7cmV0dXJuIGZ1bmN0aW9uKGkpe3ZhciB3b3JrZXI7X3RoaXMubG9nKFwic3Bhd25pbmcgd29ya2VyIFwiK2kpO3dvcmtlcj1uZXcgV29ya2VyKF90aGlzLm9wdGlvbnMud29ya2VyU2NyaXB0KTt3b3JrZXIub25tZXNzYWdlPWZ1bmN0aW9uKGV2ZW50KXtfdGhpcy5hY3RpdmVXb3JrZXJzLnNwbGljZShfdGhpcy5hY3RpdmVXb3JrZXJzLmluZGV4T2Yod29ya2VyKSwxKTtfdGhpcy5mcmVlV29ya2Vycy5wdXNoKHdvcmtlcik7cmV0dXJuIF90aGlzLmZyYW1lRmluaXNoZWQoZXZlbnQuZGF0YSl9O3JldHVybiBfdGhpcy5mcmVlV29ya2Vycy5wdXNoKHdvcmtlcil9fSh0aGlzKSk7cmV0dXJuIG51bVdvcmtlcnN9O0dJRi5wcm90b3R5cGUuZnJhbWVGaW5pc2hlZD1mdW5jdGlvbihmcmFtZSl7dmFyIGksaixyZWY7dGhpcy5sb2coXCJmcmFtZSBcIitmcmFtZS5pbmRleCtcIiBmaW5pc2hlZCAtIFwiK3RoaXMuYWN0aXZlV29ya2Vycy5sZW5ndGgrXCIgYWN0aXZlXCIpO3RoaXMuZmluaXNoZWRGcmFtZXMrKzt0aGlzLmVtaXQoXCJwcm9ncmVzc1wiLHRoaXMuZmluaXNoZWRGcmFtZXMvdGhpcy5mcmFtZXMubGVuZ3RoKTt0aGlzLmltYWdlUGFydHNbZnJhbWUuaW5kZXhdPWZyYW1lO2lmKHRoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPT09dHJ1ZSl7dGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGU9ZnJhbWUuZ2xvYmFsUGFsZXR0ZTt0aGlzLmxvZyhcImdsb2JhbCBwYWxldHRlIGFuYWx5emVkXCIpO2lmKHRoaXMuZnJhbWVzLmxlbmd0aD4yKXtmb3IoaT1qPTEscmVmPXRoaXMuZnJlZVdvcmtlcnMubGVuZ3RoOzE8PXJlZj9qPHJlZjpqPnJlZjtpPTE8PXJlZj8rK2o6LS1qKXt0aGlzLnJlbmRlck5leHRGcmFtZSgpfX19aWYoaW5kZXhPZi5jYWxsKHRoaXMuaW1hZ2VQYXJ0cyxudWxsKT49MCl7cmV0dXJuIHRoaXMucmVuZGVyTmV4dEZyYW1lKCl9ZWxzZXtyZXR1cm4gdGhpcy5maW5pc2hSZW5kZXJpbmcoKX19O0dJRi5wcm90b3R5cGUuZmluaXNoUmVuZGVyaW5nPWZ1bmN0aW9uKCl7dmFyIGRhdGEsZnJhbWUsaSxpbWFnZSxqLGssbCxsZW4sbGVuMSxsZW4yLGxlbjMsb2Zmc2V0LHBhZ2UscmVmLHJlZjEscmVmMjtsZW49MDtyZWY9dGhpcy5pbWFnZVBhcnRzO2ZvcihqPTAsbGVuMT1yZWYubGVuZ3RoO2o8bGVuMTtqKyspe2ZyYW1lPXJlZltqXTtsZW4rPShmcmFtZS5kYXRhLmxlbmd0aC0xKSpmcmFtZS5wYWdlU2l6ZStmcmFtZS5jdXJzb3J9bGVuKz1mcmFtZS5wYWdlU2l6ZS1mcmFtZS5jdXJzb3I7dGhpcy5sb2coXCJyZW5kZXJpbmcgZmluaXNoZWQgLSBmaWxlc2l6ZSBcIitNYXRoLnJvdW5kKGxlbi8xZTMpK1wia2JcIik7ZGF0YT1uZXcgVWludDhBcnJheShsZW4pO29mZnNldD0wO3JlZjE9dGhpcy5pbWFnZVBhcnRzO2ZvcihrPTAsbGVuMj1yZWYxLmxlbmd0aDtrPGxlbjI7aysrKXtmcmFtZT1yZWYxW2tdO3JlZjI9ZnJhbWUuZGF0YTtmb3IoaT1sPTAsbGVuMz1yZWYyLmxlbmd0aDtsPGxlbjM7aT0rK2wpe3BhZ2U9cmVmMltpXTtkYXRhLnNldChwYWdlLG9mZnNldCk7aWYoaT09PWZyYW1lLmRhdGEubGVuZ3RoLTEpe29mZnNldCs9ZnJhbWUuY3Vyc29yfWVsc2V7b2Zmc2V0Kz1mcmFtZS5wYWdlU2l6ZX19fWltYWdlPW5ldyBCbG9iKFtkYXRhXSx7dHlwZTpcImltYWdlL2dpZlwifSk7cmV0dXJuIHRoaXMuZW1pdChcImZpbmlzaGVkXCIsaW1hZ2UsZGF0YSl9O0dJRi5wcm90b3R5cGUucmVuZGVyTmV4dEZyYW1lPWZ1bmN0aW9uKCl7dmFyIGZyYW1lLHRhc2ssd29ya2VyO2lmKHRoaXMuZnJlZVdvcmtlcnMubGVuZ3RoPT09MCl7dGhyb3cgbmV3IEVycm9yKFwiTm8gZnJlZSB3b3JrZXJzXCIpfWlmKHRoaXMubmV4dEZyYW1lPj10aGlzLmZyYW1lcy5sZW5ndGgpe3JldHVybn1mcmFtZT10aGlzLmZyYW1lc1t0aGlzLm5leHRGcmFtZSsrXTt3b3JrZXI9dGhpcy5mcmVlV29ya2Vycy5zaGlmdCgpO3Rhc2s9dGhpcy5nZXRUYXNrKGZyYW1lKTt0aGlzLmxvZyhcInN0YXJ0aW5nIGZyYW1lIFwiKyh0YXNrLmluZGV4KzEpK1wiIG9mIFwiK3RoaXMuZnJhbWVzLmxlbmd0aCk7dGhpcy5hY3RpdmVXb3JrZXJzLnB1c2god29ya2VyKTtyZXR1cm4gd29ya2VyLnBvc3RNZXNzYWdlKHRhc2spfTtHSUYucHJvdG90eXBlLmdldENvbnRleHREYXRhPWZ1bmN0aW9uKGN0eCl7cmV0dXJuIGN0eC5nZXRJbWFnZURhdGEoMCwwLHRoaXMub3B0aW9ucy53aWR0aCx0aGlzLm9wdGlvbnMuaGVpZ2h0KS5kYXRhfTtHSUYucHJvdG90eXBlLmdldEltYWdlRGF0YT1mdW5jdGlvbihpbWFnZSl7dmFyIGN0eDtpZih0aGlzLl9jYW52YXM9PW51bGwpe3RoaXMuX2NhbnZhcz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO3RoaXMuX2NhbnZhcy53aWR0aD10aGlzLm9wdGlvbnMud2lkdGg7dGhpcy5fY2FudmFzLmhlaWdodD10aGlzLm9wdGlvbnMuaGVpZ2h0fWN0eD10aGlzLl9jYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO2N0eC5zZXRGaWxsPXRoaXMub3B0aW9ucy5iYWNrZ3JvdW5kO2N0eC5maWxsUmVjdCgwLDAsdGhpcy5vcHRpb25zLndpZHRoLHRoaXMub3B0aW9ucy5oZWlnaHQpO2N0eC5kcmF3SW1hZ2UoaW1hZ2UsMCwwKTtyZXR1cm4gdGhpcy5nZXRDb250ZXh0RGF0YShjdHgpfTtHSUYucHJvdG90eXBlLmdldFRhc2s9ZnVuY3Rpb24oZnJhbWUpe3ZhciBpbmRleCx0YXNrO2luZGV4PXRoaXMuZnJhbWVzLmluZGV4T2YoZnJhbWUpO3Rhc2s9e2luZGV4OmluZGV4LGxhc3Q6aW5kZXg9PT10aGlzLmZyYW1lcy5sZW5ndGgtMSxkZWxheTpmcmFtZS5kZWxheSxkaXNwb3NlOmZyYW1lLmRpc3Bvc2UsdHJhbnNwYXJlbnQ6ZnJhbWUudHJhbnNwYXJlbnQsd2lkdGg6dGhpcy5vcHRpb25zLndpZHRoLGhlaWdodDp0aGlzLm9wdGlvbnMuaGVpZ2h0LHF1YWxpdHk6dGhpcy5vcHRpb25zLnF1YWxpdHksZGl0aGVyOnRoaXMub3B0aW9ucy5kaXRoZXIsZ2xvYmFsUGFsZXR0ZTp0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZSxyZXBlYXQ6dGhpcy5vcHRpb25zLnJlcGVhdCxjYW5UcmFuc2Zlcjpicm93c2VyLm5hbWU9PT1cImNocm9tZVwifTtpZihmcmFtZS5kYXRhIT1udWxsKXt0YXNrLmRhdGE9ZnJhbWUuZGF0YX1lbHNlIGlmKGZyYW1lLmNvbnRleHQhPW51bGwpe3Rhc2suZGF0YT10aGlzLmdldENvbnRleHREYXRhKGZyYW1lLmNvbnRleHQpfWVsc2UgaWYoZnJhbWUuaW1hZ2UhPW51bGwpe3Rhc2suZGF0YT10aGlzLmdldEltYWdlRGF0YShmcmFtZS5pbWFnZSl9ZWxzZXt0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGZyYW1lXCIpfXJldHVybiB0YXNrfTtHSUYucHJvdG90eXBlLmxvZz1mdW5jdGlvbigpe3ZhciBhcmdzO2FyZ3M9MTw9YXJndW1lbnRzLmxlbmd0aD9zbGljZS5jYWxsKGFyZ3VtZW50cywwKTpbXTtpZighdGhpcy5vcHRpb25zLmRlYnVnKXtyZXR1cm59cmV0dXJuIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsYXJncyl9O3JldHVybiBHSUZ9KEV2ZW50RW1pdHRlcil9LHtcIi4vR0lGRW5jb2Rlci5qc1wiOjIsXCIuL2Jyb3dzZXIuY29mZmVlXCI6NSxcIi4vZ2lmLndvcmtlci5jb2ZmZWVcIjo3LGV2ZW50czoxfV0sNzpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEdJRkVuY29kZXIscmVuZGVyRnJhbWU7R0lGRW5jb2Rlcj1yZXF1aXJlKFwiLi9HSUZFbmNvZGVyLmpzXCIpO3JlbmRlckZyYW1lPWZ1bmN0aW9uKGZyYW1lKXt2YXIgZW5jb2RlcixwYWdlLHN0cmVhbSx0cmFuc2ZlcjtlbmNvZGVyPW5ldyBHSUZFbmNvZGVyKGZyYW1lLndpZHRoLGZyYW1lLmhlaWdodCk7aWYoZnJhbWUuaW5kZXg9PT0wKXtlbmNvZGVyLndyaXRlSGVhZGVyKCl9ZWxzZXtlbmNvZGVyLmZpcnN0RnJhbWU9ZmFsc2V9ZW5jb2Rlci5zZXRUcmFuc3BhcmVudChmcmFtZS50cmFuc3BhcmVudCk7ZW5jb2Rlci5zZXREaXNwb3NlKGZyYW1lLmRpc3Bvc2UpO2VuY29kZXIuc2V0UmVwZWF0KGZyYW1lLnJlcGVhdCk7ZW5jb2Rlci5zZXREZWxheShmcmFtZS5kZWxheSk7ZW5jb2Rlci5zZXRRdWFsaXR5KGZyYW1lLnF1YWxpdHkpO2VuY29kZXIuc2V0RGl0aGVyKGZyYW1lLmRpdGhlcik7ZW5jb2Rlci5zZXRHbG9iYWxQYWxldHRlKGZyYW1lLmdsb2JhbFBhbGV0dGUpO2VuY29kZXIuYWRkRnJhbWUoZnJhbWUuZGF0YSk7aWYoZnJhbWUubGFzdCl7ZW5jb2Rlci5maW5pc2goKX1pZihmcmFtZS5nbG9iYWxQYWxldHRlPT09dHJ1ZSl7ZnJhbWUuZ2xvYmFsUGFsZXR0ZT1lbmNvZGVyLmdldEdsb2JhbFBhbGV0dGUoKX1zdHJlYW09ZW5jb2Rlci5zdHJlYW0oKTtmcmFtZS5kYXRhPXN0cmVhbS5wYWdlcztmcmFtZS5jdXJzb3I9c3RyZWFtLmN1cnNvcjtmcmFtZS5wYWdlU2l6ZT1zdHJlYW0uY29uc3RydWN0b3IucGFnZVNpemU7aWYoZnJhbWUuY2FuVHJhbnNmZXIpe3RyYW5zZmVyPWZ1bmN0aW9uKCl7dmFyIGksbGVuLHJlZixyZXN1bHRzO3JlZj1mcmFtZS5kYXRhO3Jlc3VsdHM9W107Zm9yKGk9MCxsZW49cmVmLmxlbmd0aDtpPGxlbjtpKyspe3BhZ2U9cmVmW2ldO3Jlc3VsdHMucHVzaChwYWdlLmJ1ZmZlcil9cmV0dXJuIHJlc3VsdHN9KCk7cmV0dXJuIHNlbGYucG9zdE1lc3NhZ2UoZnJhbWUsdHJhbnNmZXIpfWVsc2V7cmV0dXJuIHNlbGYucG9zdE1lc3NhZ2UoZnJhbWUpfX07c2VsZi5vbm1lc3NhZ2U9ZnVuY3Rpb24oZXZlbnQpe3JldHVybiByZW5kZXJGcmFtZShldmVudC5kYXRhKX19LHtcIi4vR0lGRW5jb2Rlci5qc1wiOjJ9XX0se30sWzZdKSg2KX0pO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1naWYuanMubWFwXHJcbiIsIjsoZnVuY3Rpb24oKSB7XHJcblxyXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xyXG4gIHZhciBUYXIgPSByZXF1aXJlKCcuL3Rhci5qcycpO1xyXG4gIHZhciBkb3dubG9hZCA9IHJlcXVpcmUoJy4vZG93bmxvYWQuanMnKTtcclxuICB2YXIgR0lGID0gcmVxdWlyZSgnLi9naWYuanMnKTtcclxufVxyXG5cclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgb2JqZWN0VHlwZXMgPSB7XHJcbidmdW5jdGlvbic6IHRydWUsXHJcbidvYmplY3QnOiB0cnVlXHJcbn07XHJcblxyXG5mdW5jdGlvbiBjaGVja0dsb2JhbCh2YWx1ZSkge1xyXG4gICAgcmV0dXJuICh2YWx1ZSAmJiB2YWx1ZS5PYmplY3QgPT09IE9iamVjdCkgPyB2YWx1ZSA6IG51bGw7XHJcbiAgfVxyXG5cclxuLyoqIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIHdpdGhvdXQgYSBkZXBlbmRlbmN5IG9uIGByb290YC4gKi9cclxudmFyIGZyZWVQYXJzZUZsb2F0ID0gcGFyc2VGbG9hdCxcclxuICBmcmVlUGFyc2VJbnQgPSBwYXJzZUludDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZXhwb3J0c2AuICovXHJcbnZhciBmcmVlRXhwb3J0cyA9IChvYmplY3RUeXBlc1t0eXBlb2YgZXhwb3J0c10gJiYgZXhwb3J0cyAmJiAhZXhwb3J0cy5ub2RlVHlwZSlcclxuPyBleHBvcnRzXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBtb2R1bGVgLiAqL1xyXG52YXIgZnJlZU1vZHVsZSA9IChvYmplY3RUeXBlc1t0eXBlb2YgbW9kdWxlXSAmJiBtb2R1bGUgJiYgIW1vZHVsZS5ub2RlVHlwZSlcclxuPyBtb2R1bGVcclxuOiB1bmRlZmluZWQ7XHJcblxyXG4vKiogRGV0ZWN0IHRoZSBwb3B1bGFyIENvbW1vbkpTIGV4dGVuc2lvbiBgbW9kdWxlLmV4cG9ydHNgLiAqL1xyXG52YXIgbW9kdWxlRXhwb3J0cyA9IChmcmVlTW9kdWxlICYmIGZyZWVNb2R1bGUuZXhwb3J0cyA9PT0gZnJlZUV4cG9ydHMpXHJcbj8gZnJlZUV4cG9ydHNcclxuOiB1bmRlZmluZWQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGdsb2JhbGAgZnJvbSBOb2RlLmpzLiAqL1xyXG52YXIgZnJlZUdsb2JhbCA9IGNoZWNrR2xvYmFsKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUgJiYgdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWwpO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBzZWxmYC4gKi9cclxudmFyIGZyZWVTZWxmID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHNlbGZdICYmIHNlbGYpO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGB3aW5kb3dgLiAqL1xyXG52YXIgZnJlZVdpbmRvdyA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB3aW5kb3ddICYmIHdpbmRvdyk7XHJcblxyXG4vKiogRGV0ZWN0IGB0aGlzYCBhcyB0aGUgZ2xvYmFsIG9iamVjdC4gKi9cclxudmFyIHRoaXNHbG9iYWwgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2YgdGhpc10gJiYgdGhpcyk7XHJcblxyXG4vKipcclxuKiBVc2VkIGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxyXG4qXHJcbiogVGhlIGB0aGlzYCB2YWx1ZSBpcyB1c2VkIGlmIGl0J3MgdGhlIGdsb2JhbCBvYmplY3QgdG8gYXZvaWQgR3JlYXNlbW9ua2V5J3NcclxuKiByZXN0cmljdGVkIGB3aW5kb3dgIG9iamVjdCwgb3RoZXJ3aXNlIHRoZSBgd2luZG93YCBvYmplY3QgaXMgdXNlZC5cclxuKi9cclxudmFyIHJvb3QgPSBmcmVlR2xvYmFsIHx8XHJcbigoZnJlZVdpbmRvdyAhPT0gKHRoaXNHbG9iYWwgJiYgdGhpc0dsb2JhbC53aW5kb3cpKSAmJiBmcmVlV2luZG93KSB8fFxyXG4gIGZyZWVTZWxmIHx8IHRoaXNHbG9iYWwgfHwgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcclxuXHJcbmlmKCAhKCdnYycgaW4gd2luZG93ICkgKSB7XHJcblx0d2luZG93LmdjID0gZnVuY3Rpb24oKXt9XHJcbn1cclxuXHJcbmlmICghSFRNTENhbnZhc0VsZW1lbnQucHJvdG90eXBlLnRvQmxvYikge1xyXG4gT2JqZWN0LmRlZmluZVByb3BlcnR5KEhUTUxDYW52YXNFbGVtZW50LnByb3RvdHlwZSwgJ3RvQmxvYicsIHtcclxuICB2YWx1ZTogZnVuY3Rpb24gKGNhbGxiYWNrLCB0eXBlLCBxdWFsaXR5KSB7XHJcblxyXG4gICAgdmFyIGJpblN0ciA9IGF0b2IoIHRoaXMudG9EYXRhVVJMKHR5cGUsIHF1YWxpdHkpLnNwbGl0KCcsJylbMV0gKSxcclxuICAgICAgICBsZW4gPSBiaW5TdHIubGVuZ3RoLFxyXG4gICAgICAgIGFyciA9IG5ldyBVaW50OEFycmF5KGxlbik7XHJcblxyXG4gICAgZm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrICkge1xyXG4gICAgIGFycltpXSA9IGJpblN0ci5jaGFyQ29kZUF0KGkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNhbGxiYWNrKCBuZXcgQmxvYiggW2Fycl0sIHt0eXBlOiB0eXBlIHx8ICdpbWFnZS9wbmcnfSApICk7XHJcbiAgfVxyXG4gfSk7XHJcbn1cclxuXHJcbi8vIEBsaWNlbnNlIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcclxuLy8gY29weXJpZ2h0IFBhdWwgSXJpc2ggMjAxNVxyXG5cclxuXHJcbi8vIERhdGUubm93KCkgaXMgc3VwcG9ydGVkIGV2ZXJ5d2hlcmUgZXhjZXB0IElFOC4gRm9yIElFOCB3ZSB1c2UgdGhlIERhdGUubm93IHBvbHlmaWxsXHJcbi8vICAgZ2l0aHViLmNvbS9GaW5hbmNpYWwtVGltZXMvcG9seWZpbGwtc2VydmljZS9ibG9iL21hc3Rlci9wb2x5ZmlsbHMvRGF0ZS5ub3cvcG9seWZpbGwuanNcclxuLy8gYXMgU2FmYXJpIDYgZG9lc24ndCBoYXZlIHN1cHBvcnQgZm9yIE5hdmlnYXRpb25UaW1pbmcsIHdlIHVzZSBhIERhdGUubm93KCkgdGltZXN0YW1wIGZvciByZWxhdGl2ZSB2YWx1ZXNcclxuXHJcbi8vIGlmIHlvdSB3YW50IHZhbHVlcyBzaW1pbGFyIHRvIHdoYXQgeW91J2QgZ2V0IHdpdGggcmVhbCBwZXJmLm5vdywgcGxhY2UgdGhpcyB0b3dhcmRzIHRoZSBoZWFkIG9mIHRoZSBwYWdlXHJcbi8vIGJ1dCBpbiByZWFsaXR5LCB5b3UncmUganVzdCBnZXR0aW5nIHRoZSBkZWx0YSBiZXR3ZWVuIG5vdygpIGNhbGxzLCBzbyBpdCdzIG5vdCB0ZXJyaWJseSBpbXBvcnRhbnQgd2hlcmUgaXQncyBwbGFjZWRcclxuXHJcblxyXG4oZnVuY3Rpb24oKXtcclxuXHJcbiAgaWYgKFwicGVyZm9ybWFuY2VcIiBpbiB3aW5kb3cgPT0gZmFsc2UpIHtcclxuICAgICAgd2luZG93LnBlcmZvcm1hbmNlID0ge307XHJcbiAgfVxyXG5cclxuICBEYXRlLm5vdyA9IChEYXRlLm5vdyB8fCBmdW5jdGlvbiAoKSB7ICAvLyB0aGFua3MgSUU4XHJcblx0ICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgfSk7XHJcblxyXG4gIGlmIChcIm5vd1wiIGluIHdpbmRvdy5wZXJmb3JtYW5jZSA9PSBmYWxzZSl7XHJcblxyXG4gICAgdmFyIG5vd09mZnNldCA9IERhdGUubm93KCk7XHJcblxyXG4gICAgaWYgKHBlcmZvcm1hbmNlLnRpbWluZyAmJiBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0KXtcclxuICAgICAgbm93T2Zmc2V0ID0gcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydFxyXG4gICAgfVxyXG5cclxuICAgIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbiBub3coKXtcclxuICAgICAgcmV0dXJuIERhdGUubm93KCkgLSBub3dPZmZzZXQ7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxufSkoKTtcclxuXHJcblxyXG5mdW5jdGlvbiBwYWQoIG4gKSB7XHJcblx0cmV0dXJuIFN0cmluZyhcIjAwMDAwMDBcIiArIG4pLnNsaWNlKC03KTtcclxufVxyXG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9BZGQtb25zL0NvZGVfc25pcHBldHMvVGltZXJzXHJcblxyXG52YXIgZ19zdGFydFRpbWUgPSB3aW5kb3cuRGF0ZS5ub3coKTtcclxuXHJcbmZ1bmN0aW9uIGd1aWQoKSB7XHJcblx0ZnVuY3Rpb24gczQoKSB7XHJcblx0XHRyZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMCkudG9TdHJpbmcoMTYpLnN1YnN0cmluZygxKTtcclxuXHR9XHJcblx0cmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0ZyYW1lRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBfaGFuZGxlcnMgPSB7fTtcclxuXHJcblx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xyXG5cclxuXHR0aGlzLm9uID0gZnVuY3Rpb24oZXZlbnQsIGhhbmRsZXIpIHtcclxuXHJcblx0XHRfaGFuZGxlcnNbZXZlbnRdID0gaGFuZGxlcjtcclxuXHJcblx0fTtcclxuXHJcblx0dGhpcy5lbWl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuXHJcblx0XHR2YXIgaGFuZGxlciA9IF9oYW5kbGVyc1tldmVudF07XHJcblx0XHRpZiAoaGFuZGxlcikge1xyXG5cclxuXHRcdFx0aGFuZGxlci5hcHBseShudWxsLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcclxuXHJcblx0XHR9XHJcblxyXG5cdH07XHJcblxyXG5cdHRoaXMuZmlsZW5hbWUgPSBzZXR0aW5ncy5uYW1lIHx8IGd1aWQoKTtcclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcnO1xyXG5cdHRoaXMubWltZVR5cGUgPSAnJztcclxuXHJcbn1cclxuXHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnNhZmVUb1Byb2NlZWQgPSBmdW5jdGlvbigpeyByZXR1cm4gdHJ1ZTsgfTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnN0ZXAgPSBmdW5jdGlvbigpIHsgY29uc29sZS5sb2coICdTdGVwIG5vdCBzZXQhJyApIH1cclxuXHJcbmZ1bmN0aW9uIENDVGFyRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy50YXInXHJcblx0dGhpcy5taW1lVHlwZSA9ICdhcHBsaWNhdGlvbi94LXRhcidcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnJztcclxuXHJcblx0dGhpcy50YXBlID0gbnVsbFxyXG5cdHRoaXMuY291bnQgPSAwO1xyXG5cclxufVxyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCl7XHJcblxyXG5cdHRoaXMuZGlzcG9zZSgpO1xyXG5cclxufTtcclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGJsb2IgKSB7XHJcblxyXG5cdHZhciBmaWxlUmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcclxuXHRmaWxlUmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dGhpcy50YXBlLmFwcGVuZCggcGFkKCB0aGlzLmNvdW50ICkgKyB0aGlzLmZpbGVFeHRlbnNpb24sIG5ldyBVaW50OEFycmF5KCBmaWxlUmVhZGVyLnJlc3VsdCApICk7XHJcblxyXG5cdFx0Ly9pZiggdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgPiAwICYmICggdGhpcy5mcmFtZXMubGVuZ3RoIC8gdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKSA+PSB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSApIHtcclxuXHJcblx0XHR0aGlzLmNvdW50Kys7XHJcblx0XHR0aGlzLnN0ZXAoKTtcclxuXHR9LmJpbmQoIHRoaXMgKTtcclxuXHRmaWxlUmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKGJsb2IpO1xyXG5cclxufVxyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuXHRjYWxsYmFjayggdGhpcy50YXBlLnNhdmUoKSApO1xyXG5cclxufVxyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMudGFwZSA9IG5ldyBUYXIoKTtcclxuXHR0aGlzLmNvdW50ID0gMDtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDUE5HRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDVGFyRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLnR5cGUgPSAnaW1hZ2UvcG5nJztcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnLnBuZyc7XHJcblxyXG59XHJcblxyXG5DQ1BOR0VuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NUYXJFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NQTkdFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRjYW52YXMudG9CbG9iKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdENDVGFyRW5jb2Rlci5wcm90b3R5cGUuYWRkLmNhbGwoIHRoaXMsIGJsb2IgKTtcclxuXHR9LmJpbmQoIHRoaXMgKSwgdGhpcy50eXBlIClcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDSlBFR0VuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ1RhckVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy50eXBlID0gJ2ltYWdlL2pwZWcnO1xyXG5cdHRoaXMuZmlsZUV4dGVuc2lvbiA9ICcuanBnJztcclxuXHR0aGlzLnF1YWxpdHkgPSAoIHNldHRpbmdzLnF1YWxpdHkgLyAxMDAgKSB8fCAuODtcclxuXHJcbn1cclxuXHJcbkNDSlBFR0VuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NUYXJFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NKUEVHRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0Y2FudmFzLnRvQmxvYiggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRDQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZC5jYWxsKCB0aGlzLCBibG9iICk7XHJcblx0fS5iaW5kKCB0aGlzICksIHRoaXMudHlwZSwgdGhpcy5xdWFsaXR5IClcclxuXHJcbn1cclxuXHJcbi8qXHJcblxyXG5cdFdlYk0gRW5jb2RlclxyXG5cclxuKi9cclxuXHJcbmZ1bmN0aW9uIENDV2ViTUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuXHRpZiggY2FudmFzLnRvRGF0YVVSTCggJ2ltYWdlL3dlYnAnICkuc3Vic3RyKDUsMTApICE9PSAnaW1hZ2Uvd2VicCcgKXtcclxuXHRcdGNvbnNvbGUubG9nKCBcIldlYlAgbm90IHN1cHBvcnRlZCAtIHRyeSBhbm90aGVyIGV4cG9ydCBmb3JtYXRcIiApXHJcblx0fVxyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLnF1YWxpdHkgPSAoIHNldHRpbmdzLnF1YWxpdHkgLyAxMDAgKSB8fCAuODtcclxuXHJcblx0dGhpcy5leHRlbnNpb24gPSAnLndlYm0nXHJcblx0dGhpcy5taW1lVHlwZSA9ICd2aWRlby93ZWJtJ1xyXG5cdHRoaXMuYmFzZUZpbGVuYW1lID0gdGhpcy5maWxlbmFtZTtcclxuXHJcblx0dGhpcy5mcmFtZXMgPSBbXTtcclxuXHR0aGlzLnBhcnQgPSAxO1xyXG5cclxuICB0aGlzLnZpZGVvV3JpdGVyID0gbmV3IFdlYk1Xcml0ZXIoe1xyXG4gICAgcXVhbGl0eTogdGhpcy5xdWFsaXR5LFxyXG4gICAgZmlsZVdyaXRlcjogbnVsbCxcclxuICAgIGZkOiBudWxsLFxyXG4gICAgZnJhbWVSYXRlOiBzZXR0aW5ncy5mcmFtZXJhdGVcclxufSk7XHJcblxyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5kaXNwb3NlKCk7XHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuICB0aGlzLnZpZGVvV3JpdGVyLmFkZEZyYW1lKGNhbnZhcyk7XHJcblxyXG5cdC8vdGhpcy5mcmFtZXMucHVzaCggY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2Uvd2VicCcsIHRoaXMucXVhbGl0eSkgKTtcclxuXHJcblx0aWYoIHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lID4gMCAmJiAoIHRoaXMuZnJhbWVzLmxlbmd0aCAvIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlICkgPj0gdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgKSB7XHJcblx0XHR0aGlzLnNhdmUoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0XHR0aGlzLmZpbGVuYW1lID0gdGhpcy5iYXNlRmlsZW5hbWUgKyAnLXBhcnQtJyArIHBhZCggdGhpcy5wYXJ0ICk7XHJcblx0XHRcdGRvd25sb2FkKCBibG9iLCB0aGlzLmZpbGVuYW1lICsgdGhpcy5leHRlbnNpb24sIHRoaXMubWltZVR5cGUgKTtcclxuXHRcdFx0dGhpcy5kaXNwb3NlKCk7XHJcblx0XHRcdHRoaXMucGFydCsrO1xyXG5cdFx0XHR0aGlzLmZpbGVuYW1lID0gdGhpcy5iYXNlRmlsZW5hbWUgKyAnLXBhcnQtJyArIHBhZCggdGhpcy5wYXJ0ICk7XHJcblx0XHRcdHRoaXMuc3RlcCgpO1xyXG5cdFx0fS5iaW5kKCB0aGlzICkgKVxyXG5cdH0gZWxzZSB7XHJcblx0XHR0aGlzLnN0ZXAoKTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuLy9cdGlmKCAhdGhpcy5mcmFtZXMubGVuZ3RoICkgcmV0dXJuO1xyXG5cclxuICB0aGlzLnZpZGVvV3JpdGVyLmNvbXBsZXRlKCkudGhlbihjYWxsYmFjayk7XHJcblxyXG5cdC8qdmFyIHdlYm0gPSBXaGFtbXkuZnJvbUltYWdlQXJyYXkoIHRoaXMuZnJhbWVzLCB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApXHJcblx0dmFyIGJsb2IgPSBuZXcgQmxvYiggWyB3ZWJtIF0sIHsgdHlwZTogXCJvY3RldC9zdHJlYW1cIiB9ICk7XHJcblx0Y2FsbGJhY2soIGJsb2IgKTsqL1xyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZnJhbWVzID0gW107XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0ZGTXBlZ1NlcnZlckVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG5cdHRoaXMuZW5jb2RlciA9IG5ldyBGRk1wZWdTZXJ2ZXIuVmlkZW8oIHNldHRpbmdzICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdwcm9jZXNzJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCAncHJvY2VzcycgKVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbignZmluaXNoZWQnLCBmdW5jdGlvbiggdXJsLCBzaXplICkge1xyXG4gICAgICAgIHZhciBjYiA9IHRoaXMuY2FsbGJhY2s7XHJcbiAgICAgICAgaWYgKCBjYiApIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgY2IoIHVybCwgc2l6ZSApO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdwcm9ncmVzcycsIGZ1bmN0aW9uKCBwcm9ncmVzcyApIHtcclxuICAgICAgICBpZiAoIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyApIHtcclxuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzKCBwcm9ncmVzcyApXHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ2Vycm9yJywgZnVuY3Rpb24oIGRhdGEgKSB7XHJcbiAgICAgICAgYWxlcnQoSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMikpO1xyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuXHJcbn1cclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLnN0YXJ0KCB0aGlzLnNldHRpbmdzICk7XHJcblxyXG59O1xyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuYWRkKCBjYW52YXMgKTtcclxuXHJcbn1cclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbiAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XHJcbiAgICB0aGlzLmVuY29kZXIuZW5kKCk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnNhZmVUb1Byb2NlZWQgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmVuY29kZXIuc2FmZVRvUHJvY2VlZCgpO1xyXG59O1xyXG5cclxuLypcclxuXHRIVE1MQ2FudmFzRWxlbWVudC5jYXB0dXJlU3RyZWFtKClcclxuKi9cclxuXHJcbmZ1bmN0aW9uIENDU3RyZWFtRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMuZnJhbWVyYXRlID0gdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0dGhpcy50eXBlID0gJ3ZpZGVvL3dlYm0nO1xyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy53ZWJtJztcclxuXHR0aGlzLnN0cmVhbSA9IG51bGw7XHJcblx0dGhpcy5tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuXHR0aGlzLmNodW5rcyA9IFtdO1xyXG5cclxufVxyXG5cclxuQ0NTdHJlYW1FbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NTdHJlYW1FbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRpZiggIXRoaXMuc3RyZWFtICkge1xyXG5cdFx0dGhpcy5zdHJlYW0gPSBjYW52YXMuY2FwdHVyZVN0cmVhbSggdGhpcy5mcmFtZXJhdGUgKTtcclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlciA9IG5ldyBNZWRpYVJlY29yZGVyKCB0aGlzLnN0cmVhbSApO1xyXG5cdFx0dGhpcy5tZWRpYVJlY29yZGVyLnN0YXJ0KCk7XHJcblxyXG5cdFx0dGhpcy5tZWRpYVJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0dGhpcy5jaHVua3MucHVzaChlLmRhdGEpO1xyXG5cdFx0fS5iaW5kKCB0aGlzICk7XHJcblxyXG5cdH1cclxuXHR0aGlzLnN0ZXAoKTtcclxuXHJcbn1cclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0dGhpcy5tZWRpYVJlY29yZGVyLm9uc3RvcCA9IGZ1bmN0aW9uKCBlICkge1xyXG5cdFx0dmFyIGJsb2IgPSBuZXcgQmxvYiggdGhpcy5jaHVua3MsIHsgJ3R5cGUnIDogJ3ZpZGVvL3dlYm0nIH0pO1xyXG5cdFx0dGhpcy5jaHVua3MgPSBbXTtcclxuXHRcdGNhbGxiYWNrKCBibG9iICk7XHJcblxyXG5cdH0uYmluZCggdGhpcyApO1xyXG5cclxuXHR0aGlzLm1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG5cclxufVxyXG5cclxuLypmdW5jdGlvbiBDQ0dJRkVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzICk7XHJcblxyXG5cdHNldHRpbmdzLnF1YWxpdHkgPSBzZXR0aW5ncy5xdWFsaXR5IHx8IDY7XHJcblx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xyXG5cclxuXHR0aGlzLmVuY29kZXIgPSBuZXcgR0lGRW5jb2RlcigpO1xyXG5cdHRoaXMuZW5jb2Rlci5zZXRSZXBlYXQoIDEgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXREZWxheSggc2V0dGluZ3Muc3RlcCApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldFF1YWxpdHkoIDYgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRUcmFuc3BhcmVudCggbnVsbCApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldFNpemUoIDE1MCwgMTUwICk7XHJcblxyXG4gIFx0dGhpcy5jYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG4gIFx0dGhpcy5jdHggPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCAnMmQnICk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIgKTtcclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLnN0YXJ0KCk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuY2FudmFzLndpZHRoID0gY2FudmFzLndpZHRoO1xyXG5cdHRoaXMuY2FudmFzLmhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XHJcblx0dGhpcy5jdHguZHJhd0ltYWdlKCBjYW52YXMsIDAsIDAgKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHRoaXMuY3R4ICk7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zZXRTaXplKCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQgKTtcclxuXHR2YXIgcmVhZEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGNhbnZhcy53aWR0aCAqIGNhbnZhcy5oZWlnaHQgKiA0KTtcclxuXHR2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICk7XHJcblx0Y29udGV4dC5yZWFkUGl4ZWxzKDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCwgY29udGV4dC5SR0JBLCBjb250ZXh0LlVOU0lHTkVEX0JZVEUsIHJlYWRCdWZmZXIpO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggcmVhZEJ1ZmZlciwgdHJ1ZSApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5maW5pc2goKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0dmFyIGJpbmFyeV9naWYgPSB0aGlzLmVuY29kZXIuc3RyZWFtKCkuZ2V0RGF0YSgpO1xyXG5cclxuXHR2YXIgZGF0YV91cmwgPSAnZGF0YTppbWFnZS9naWY7YmFzZTY0LCcrZW5jb2RlNjQoYmluYXJ5X2dpZik7XHJcblx0d2luZG93LmxvY2F0aW9uID0gZGF0YV91cmw7XHJcblx0cmV0dXJuO1xyXG5cclxuXHR2YXIgYmxvYiA9IG5ldyBCbG9iKCBbIGJpbmFyeV9naWYgXSwgeyB0eXBlOiBcIm9jdGV0L3N0cmVhbVwiIH0gKTtcclxuXHR2YXIgdXJsID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwoIGJsb2IgKTtcclxuXHRjYWxsYmFjayggdXJsICk7XHJcblxyXG59Ki9cclxuXHJcbmZ1bmN0aW9uIENDR0lGRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHNldHRpbmdzLnF1YWxpdHkgPSAzMSAtICggKCBzZXR0aW5ncy5xdWFsaXR5ICogMzAgLyAxMDAgKSB8fCAxMCApO1xyXG5cdHNldHRpbmdzLndvcmtlcnMgPSBzZXR0aW5ncy53b3JrZXJzIHx8IDQ7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy5naWYnXHJcblx0dGhpcy5taW1lVHlwZSA9ICdpbWFnZS9naWYnXHJcblxyXG4gIFx0dGhpcy5jYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG4gIFx0dGhpcy5jdHggPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCAnMmQnICk7XHJcbiAgXHR0aGlzLnNpemVTZXQgPSBmYWxzZTtcclxuXHJcbiAgXHR0aGlzLmVuY29kZXIgPSBuZXcgR0lGKHtcclxuXHRcdHdvcmtlcnM6IHNldHRpbmdzLndvcmtlcnMsXHJcblx0XHRxdWFsaXR5OiBzZXR0aW5ncy5xdWFsaXR5LFxyXG5cdFx0d29ya2VyU2NyaXB0OiBzZXR0aW5ncy53b3JrZXJzUGF0aCArICdnaWYud29ya2VyLmpzJ1xyXG5cdH0gKTtcclxuXHJcbiAgICB0aGlzLmVuY29kZXIub24oICdwcm9ncmVzcycsIGZ1bmN0aW9uKCBwcm9ncmVzcyApIHtcclxuICAgICAgICBpZiAoIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyApIHtcclxuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzKCBwcm9ncmVzcyApXHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuXHJcbiAgICB0aGlzLmVuY29kZXIub24oJ2ZpbmlzaGVkJywgZnVuY3Rpb24oIGJsb2IgKSB7XHJcbiAgICAgICAgdmFyIGNiID0gdGhpcy5jYWxsYmFjaztcclxuICAgICAgICBpZiAoIGNiICkge1xyXG4gICAgICAgICAgICB0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBjYiggYmxvYiApO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGlmKCAhdGhpcy5zaXplU2V0ICkge1xyXG5cdFx0dGhpcy5lbmNvZGVyLnNldE9wdGlvbiggJ3dpZHRoJyxjYW52YXMud2lkdGggKTtcclxuXHRcdHRoaXMuZW5jb2Rlci5zZXRPcHRpb24oICdoZWlnaHQnLGNhbnZhcy5oZWlnaHQgKTtcclxuXHRcdHRoaXMuc2l6ZVNldCA9IHRydWU7XHJcblx0fVxyXG5cclxuXHR0aGlzLmNhbnZhcy53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHR0aGlzLmNhbnZhcy5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdHRoaXMuY3R4LmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggdGhpcy5jdHgsIHsgY29weTogdHJ1ZSwgZGVsYXk6IHRoaXMuc2V0dGluZ3Muc3RlcCB9ICk7XHJcblx0dGhpcy5zdGVwKCk7XHJcblxyXG5cdC8qdGhpcy5lbmNvZGVyLnNldFNpemUoIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCApO1xyXG5cdHZhciByZWFkQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoY2FudmFzLndpZHRoICogY2FudmFzLmhlaWdodCAqIDQpO1xyXG5cdHZhciBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKTtcclxuXHRjb250ZXh0LnJlYWRQaXhlbHMoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0LCBjb250ZXh0LlJHQkEsIGNvbnRleHQuVU5TSUdORURfQllURSwgcmVhZEJ1ZmZlcik7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCByZWFkQnVmZmVyLCB0cnVlICk7Ki9cclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbiAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5yZW5kZXIoKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDYXB0dXJlKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIF9zZXR0aW5ncyA9IHNldHRpbmdzIHx8IHt9LFxyXG5cdFx0X2RhdGUgPSBuZXcgRGF0ZSgpLFxyXG5cdFx0X3ZlcmJvc2UsXHJcblx0XHRfZGlzcGxheSxcclxuXHRcdF90aW1lLFxyXG5cdFx0X3N0YXJ0VGltZSxcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUsXHJcblx0XHRfcGVyZm9ybWFuY2VTdGFydFRpbWUsXHJcblx0XHRfc3RlcCxcclxuICAgICAgICBfZW5jb2RlcixcclxuXHRcdF90aW1lb3V0cyA9IFtdLFxyXG5cdFx0X2ludGVydmFscyA9IFtdLFxyXG5cdFx0X2ZyYW1lQ291bnQgPSAwLFxyXG5cdFx0X2ludGVybWVkaWF0ZUZyYW1lQ291bnQgPSAwLFxyXG5cdFx0X2xhc3RGcmFtZSA9IG51bGwsXHJcblx0XHRfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzID0gW10sXHJcblx0XHRfY2FwdHVyaW5nID0gZmFsc2UsXHJcbiAgICAgICAgX2hhbmRsZXJzID0ge307XHJcblxyXG5cdF9zZXR0aW5ncy5mcmFtZXJhdGUgPSBfc2V0dGluZ3MuZnJhbWVyYXRlIHx8IDYwO1xyXG5cdF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID0gMiAqICggX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgfHwgMSApO1xyXG5cdF92ZXJib3NlID0gX3NldHRpbmdzLnZlcmJvc2UgfHwgZmFsc2U7XHJcblx0X2Rpc3BsYXkgPSBfc2V0dGluZ3MuZGlzcGxheSB8fCBmYWxzZTtcclxuXHRfc2V0dGluZ3Muc3RlcCA9IDEwMDAuMCAvIF9zZXR0aW5ncy5mcmFtZXJhdGUgO1xyXG5cdF9zZXR0aW5ncy50aW1lTGltaXQgPSBfc2V0dGluZ3MudGltZUxpbWl0IHx8IDA7XHJcblx0X3NldHRpbmdzLmZyYW1lTGltaXQgPSBfc2V0dGluZ3MuZnJhbWVMaW1pdCB8fCAwO1xyXG5cdF9zZXR0aW5ncy5zdGFydFRpbWUgPSBfc2V0dGluZ3Muc3RhcnRUaW1lIHx8IDA7XHJcblxyXG5cdHZhciBfdGltZURpc3BsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmxlZnQgPSBfdGltZURpc3BsYXkuc3R5bGUudG9wID0gMFxyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnYmxhY2snO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5mb250RmFtaWx5ID0gJ21vbm9zcGFjZSdcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuZm9udFNpemUgPSAnMTFweCdcclxuXHRfdGltZURpc3BsYXkuc3R5bGUucGFkZGluZyA9ICc1cHgnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmNvbG9yID0gJ3JlZCc7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnpJbmRleCA9IDEwMDAwMFxyXG5cdGlmKCBfc2V0dGluZ3MuZGlzcGxheSApIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIF90aW1lRGlzcGxheSApO1xyXG5cclxuXHR2YXIgY2FudmFzTW90aW9uQmx1ciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcblx0dmFyIGN0eE1vdGlvbkJsdXIgPSBjYW52YXNNb3Rpb25CbHVyLmdldENvbnRleHQoICcyZCcgKTtcclxuXHR2YXIgYnVmZmVyTW90aW9uQmx1cjtcclxuXHR2YXIgaW1hZ2VEYXRhO1xyXG5cclxuXHRfbG9nKCAnU3RlcCBpcyBzZXQgdG8gJyArIF9zZXR0aW5ncy5zdGVwICsgJ21zJyApO1xyXG5cclxuICAgIHZhciBfZW5jb2RlcnMgPSB7XHJcblx0XHRnaWY6IENDR0lGRW5jb2RlcixcclxuXHRcdHdlYm06IENDV2ViTUVuY29kZXIsXHJcblx0XHRmZm1wZWdzZXJ2ZXI6IENDRkZNcGVnU2VydmVyRW5jb2RlcixcclxuXHRcdHBuZzogQ0NQTkdFbmNvZGVyLFxyXG5cdFx0anBnOiBDQ0pQRUdFbmNvZGVyLFxyXG5cdFx0J3dlYm0tbWVkaWFyZWNvcmRlcic6IENDU3RyZWFtRW5jb2RlclxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgY3RvciA9IF9lbmNvZGVyc1sgX3NldHRpbmdzLmZvcm1hdCBdO1xyXG4gICAgaWYgKCAhY3RvciApIHtcclxuXHRcdHRocm93IFwiRXJyb3I6IEluY29ycmVjdCBvciBtaXNzaW5nIGZvcm1hdDogVmFsaWQgZm9ybWF0cyBhcmUgXCIgKyBPYmplY3Qua2V5cyhfZW5jb2RlcnMpLmpvaW4oXCIsIFwiKTtcclxuICAgIH1cclxuICAgIF9lbmNvZGVyID0gbmV3IGN0b3IoIF9zZXR0aW5ncyApO1xyXG4gICAgX2VuY29kZXIuc3RlcCA9IF9zdGVwXHJcblxyXG5cdF9lbmNvZGVyLm9uKCdwcm9jZXNzJywgX3Byb2Nlc3MpO1xyXG4gICAgX2VuY29kZXIub24oJ3Byb2dyZXNzJywgX3Byb2dyZXNzKTtcclxuXHJcbiAgICBpZiAoXCJwZXJmb3JtYW5jZVwiIGluIHdpbmRvdyA9PSBmYWxzZSkge1xyXG4gICAgXHR3aW5kb3cucGVyZm9ybWFuY2UgPSB7fTtcclxuICAgIH1cclxuXHJcblx0RGF0ZS5ub3cgPSAoRGF0ZS5ub3cgfHwgZnVuY3Rpb24gKCkgeyAgLy8gdGhhbmtzIElFOFxyXG5cdFx0cmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG5cdH0pO1xyXG5cclxuXHRpZiAoXCJub3dcIiBpbiB3aW5kb3cucGVyZm9ybWFuY2UgPT0gZmFsc2Upe1xyXG5cclxuXHRcdHZhciBub3dPZmZzZXQgPSBEYXRlLm5vdygpO1xyXG5cclxuXHRcdGlmIChwZXJmb3JtYW5jZS50aW1pbmcgJiYgcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydCl7XHJcblx0XHRcdG5vd09mZnNldCA9IHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnRcclxuXHRcdH1cclxuXHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24gbm93KCl7XHJcblx0XHRcdHJldHVybiBEYXRlLm5vdygpIC0gbm93T2Zmc2V0O1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dmFyIF9vbGRTZXRUaW1lb3V0ID0gd2luZG93LnNldFRpbWVvdXQsXHJcblx0XHRfb2xkU2V0SW50ZXJ2YWwgPSB3aW5kb3cuc2V0SW50ZXJ2YWwsXHJcblx0ICAgIFx0X29sZENsZWFySW50ZXJ2YWwgPSB3aW5kb3cuY2xlYXJJbnRlcnZhbCxcclxuXHRcdF9vbGRDbGVhclRpbWVvdXQgPSB3aW5kb3cuY2xlYXJUaW1lb3V0LFxyXG5cdFx0X29sZFJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXHJcblx0XHRfb2xkTm93ID0gd2luZG93LkRhdGUubm93LFxyXG5cdFx0X29sZFBlcmZvcm1hbmNlTm93ID0gd2luZG93LnBlcmZvcm1hbmNlLm5vdyxcclxuXHRcdF9vbGRHZXRUaW1lID0gd2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWU7XHJcblx0Ly8gRGF0ZS5wcm90b3R5cGUuX29sZEdldFRpbWUgPSBEYXRlLnByb3RvdHlwZS5nZXRUaW1lO1xyXG5cclxuXHR2YXIgbWVkaWEgPSBbXTtcclxuXHJcblx0ZnVuY3Rpb24gX2luaXQoKSB7XHJcblxyXG5cdFx0X2xvZyggJ0NhcHR1cmVyIHN0YXJ0JyApO1xyXG5cclxuXHRcdF9zdGFydFRpbWUgPSB3aW5kb3cuRGF0ZS5ub3coKTtcclxuXHRcdF90aW1lID0gX3N0YXJ0VGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblx0XHRfcGVyZm9ybWFuY2VTdGFydFRpbWUgPSB3aW5kb3cucGVyZm9ybWFuY2Uubm93KCk7XHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lID0gX3BlcmZvcm1hbmNlU3RhcnRUaW1lICsgX3NldHRpbmdzLnN0YXJ0VGltZTtcclxuXHJcblx0XHR3aW5kb3cuRGF0ZS5wcm90b3R5cGUuZ2V0VGltZSA9IGZ1bmN0aW9uKCl7XHJcblx0XHRcdHJldHVybiBfdGltZTtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cuRGF0ZS5ub3cgPSBmdW5jdGlvbigpIHtcclxuXHRcdFx0cmV0dXJuIF90aW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHR3aW5kb3cuc2V0VGltZW91dCA9IGZ1bmN0aW9uKCBjYWxsYmFjaywgdGltZSApIHtcclxuXHRcdFx0dmFyIHQgPSB7XHJcblx0XHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxyXG5cdFx0XHRcdHRpbWU6IHRpbWUsXHJcblx0XHRcdFx0dHJpZ2dlclRpbWU6IF90aW1lICsgdGltZVxyXG5cdFx0XHR9O1xyXG5cdFx0XHRfdGltZW91dHMucHVzaCggdCApO1xyXG5cdFx0XHRfbG9nKCAnVGltZW91dCBzZXQgdG8gJyArIHQudGltZSApO1xyXG4gICAgICAgICAgICByZXR1cm4gdDtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0ID0gZnVuY3Rpb24oIGlkICkge1xyXG5cdFx0XHRmb3IoIHZhciBqID0gMDsgaiA8IF90aW1lb3V0cy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0XHRpZiggX3RpbWVvdXRzWyBqIF0gPT0gaWQgKSB7XHJcblx0XHRcdFx0XHRfdGltZW91dHMuc3BsaWNlKCBqLCAxICk7XHJcblx0XHRcdFx0XHRfbG9nKCAnVGltZW91dCBjbGVhcmVkJyApO1xyXG5cdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LnNldEludGVydmFsID0gZnVuY3Rpb24oIGNhbGxiYWNrLCB0aW1lICkge1xyXG5cdFx0XHR2YXIgdCA9IHtcclxuXHRcdFx0XHRjYWxsYmFjazogY2FsbGJhY2ssXHJcblx0XHRcdFx0dGltZTogdGltZSxcclxuXHRcdFx0XHR0cmlnZ2VyVGltZTogX3RpbWUgKyB0aW1lXHJcblx0XHRcdH07XHJcblx0XHRcdF9pbnRlcnZhbHMucHVzaCggdCApO1xyXG5cdFx0XHRfbG9nKCAnSW50ZXJ2YWwgc2V0IHRvICcgKyB0LnRpbWUgKTtcclxuXHRcdFx0cmV0dXJuIHQ7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LmNsZWFySW50ZXJ2YWwgPSBmdW5jdGlvbiggaWQgKSB7XHJcblx0XHRcdF9sb2coICdjbGVhciBJbnRlcnZhbCcgKTtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHRcdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcy5wdXNoKCBjYWxsYmFjayApO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbigpe1xyXG5cdFx0XHRyZXR1cm4gX3BlcmZvcm1hbmNlVGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0ZnVuY3Rpb24gaG9va0N1cnJlbnRUaW1lKCkge1xyXG5cdFx0XHRpZiggIXRoaXMuX2hvb2tlZCApIHtcclxuXHRcdFx0XHR0aGlzLl9ob29rZWQgPSB0cnVlO1xyXG5cdFx0XHRcdHRoaXMuX2hvb2tlZFRpbWUgPSB0aGlzLmN1cnJlbnRUaW1lIHx8IDA7XHJcblx0XHRcdFx0dGhpcy5wYXVzZSgpO1xyXG5cdFx0XHRcdG1lZGlhLnB1c2goIHRoaXMgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdGhpcy5faG9va2VkVGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdHRyeSB7XHJcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSggSFRNTFZpZGVvRWxlbWVudC5wcm90b3R5cGUsICdjdXJyZW50VGltZScsIHsgZ2V0OiBob29rQ3VycmVudFRpbWUgfSApXHJcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSggSFRNTEF1ZGlvRWxlbWVudC5wcm90b3R5cGUsICdjdXJyZW50VGltZScsIHsgZ2V0OiBob29rQ3VycmVudFRpbWUgfSApXHJcblx0XHR9IGNhdGNoIChlcnIpIHtcclxuXHRcdFx0X2xvZyhlcnIpO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zdGFydCgpIHtcclxuXHRcdF9pbml0KCk7XHJcblx0XHRfZW5jb2Rlci5zdGFydCgpO1xyXG5cdFx0X2NhcHR1cmluZyA9IHRydWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RvcCgpIHtcclxuXHRcdF9jYXB0dXJpbmcgPSBmYWxzZTtcclxuXHRcdF9lbmNvZGVyLnN0b3AoKTtcclxuXHRcdF9kZXN0cm95KCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2FsbCggZm4sIHAgKSB7XHJcblx0XHRfb2xkU2V0VGltZW91dCggZm4sIDAsIHAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zdGVwKCkge1xyXG5cdFx0Ly9fb2xkUmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBfcHJvY2VzcyApO1xyXG5cdFx0X2NhbGwoIF9wcm9jZXNzICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfZGVzdHJveSgpIHtcclxuXHRcdF9sb2coICdDYXB0dXJlciBzdG9wJyApO1xyXG5cdFx0d2luZG93LnNldFRpbWVvdXQgPSBfb2xkU2V0VGltZW91dDtcclxuXHRcdHdpbmRvdy5zZXRJbnRlcnZhbCA9IF9vbGRTZXRJbnRlcnZhbDtcclxuXHRcdHdpbmRvdy5jbGVhckludGVydmFsID0gX29sZENsZWFySW50ZXJ2YWw7XHJcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0ID0gX29sZENsZWFyVGltZW91dDtcclxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBfb2xkUmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xyXG5cdFx0d2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWUgPSBfb2xkR2V0VGltZTtcclxuXHRcdHdpbmRvdy5EYXRlLm5vdyA9IF9vbGROb3c7XHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gX29sZFBlcmZvcm1hbmNlTm93O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3VwZGF0ZVRpbWUoKSB7XHJcblx0XHR2YXIgc2Vjb25kcyA9IF9mcmFtZUNvdW50IC8gX3NldHRpbmdzLmZyYW1lcmF0ZTtcclxuXHRcdGlmKCAoIF9zZXR0aW5ncy5mcmFtZUxpbWl0ICYmIF9mcmFtZUNvdW50ID49IF9zZXR0aW5ncy5mcmFtZUxpbWl0ICkgfHwgKCBfc2V0dGluZ3MudGltZUxpbWl0ICYmIHNlY29uZHMgPj0gX3NldHRpbmdzLnRpbWVMaW1pdCApICkge1xyXG5cdFx0XHRfc3RvcCgpO1xyXG5cdFx0XHRfc2F2ZSgpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGQgPSBuZXcgRGF0ZSggbnVsbCApO1xyXG5cdFx0ZC5zZXRTZWNvbmRzKCBzZWNvbmRzICk7XHJcblx0XHRpZiggX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgPiAyICkge1xyXG5cdFx0XHRfdGltZURpc3BsYXkudGV4dENvbnRlbnQgPSAnQ0NhcHR1cmUgJyArIF9zZXR0aW5ncy5mb3JtYXQgKyAnIHwgJyArIF9mcmFtZUNvdW50ICsgJyBmcmFtZXMgKCcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCArICcgaW50ZXIpIHwgJyArICBkLnRvSVNPU3RyaW5nKCkuc3Vic3RyKCAxMSwgOCApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0X3RpbWVEaXNwbGF5LnRleHRDb250ZW50ID0gJ0NDYXB0dXJlICcgKyBfc2V0dGluZ3MuZm9ybWF0ICsgJyB8ICcgKyBfZnJhbWVDb3VudCArICcgZnJhbWVzIHwgJyArICBkLnRvSVNPU3RyaW5nKCkuc3Vic3RyKCAxMSwgOCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NoZWNrRnJhbWUoIGNhbnZhcyApIHtcclxuXHJcblx0XHRpZiggY2FudmFzTW90aW9uQmx1ci53aWR0aCAhPT0gY2FudmFzLndpZHRoIHx8IGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICE9PSBjYW52YXMuaGVpZ2h0ICkge1xyXG5cdFx0XHRjYW52YXNNb3Rpb25CbHVyLndpZHRoID0gY2FudmFzLndpZHRoO1xyXG5cdFx0XHRjYW52YXNNb3Rpb25CbHVyLmhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXIgPSBuZXcgVWludDE2QXJyYXkoIGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICogY2FudmFzTW90aW9uQmx1ci53aWR0aCAqIDQgKTtcclxuXHRcdFx0Y3R4TW90aW9uQmx1ci5maWxsU3R5bGUgPSAnIzAnXHJcblx0XHRcdGN0eE1vdGlvbkJsdXIuZmlsbFJlY3QoIDAsIDAsIGNhbnZhc01vdGlvbkJsdXIud2lkdGgsIGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICk7XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2JsZW5kRnJhbWUoIGNhbnZhcyApIHtcclxuXHJcblx0XHQvL19sb2coICdJbnRlcm1lZGlhdGUgRnJhbWU6ICcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCApO1xyXG5cclxuXHRcdGN0eE1vdGlvbkJsdXIuZHJhd0ltYWdlKCBjYW52YXMsIDAsIDAgKTtcclxuXHRcdGltYWdlRGF0YSA9IGN0eE1vdGlvbkJsdXIuZ2V0SW1hZ2VEYXRhKCAwLCAwLCBjYW52YXNNb3Rpb25CbHVyLndpZHRoLCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCApO1xyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBidWZmZXJNb3Rpb25CbHVyLmxlbmd0aDsgais9IDQgKSB7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogXSArPSBpbWFnZURhdGEuZGF0YVsgaiBdO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMSBdICs9IGltYWdlRGF0YS5kYXRhWyBqICsgMSBdO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMiBdICs9IGltYWdlRGF0YS5kYXRhWyBqICsgMiBdO1xyXG5cdFx0fVxyXG5cdFx0X2ludGVybWVkaWF0ZUZyYW1lQ291bnQrKztcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc2F2ZUZyYW1lKCl7XHJcblxyXG5cdFx0dmFyIGRhdGEgPSBpbWFnZURhdGEuZGF0YTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRkYXRhWyBqIF0gPSBidWZmZXJNb3Rpb25CbHVyWyBqIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHRcdGRhdGFbIGogKyAxIF0gPSBidWZmZXJNb3Rpb25CbHVyWyBqICsgMSBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0XHRkYXRhWyBqICsgMiBdID0gYnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdH1cclxuXHRcdGN0eE1vdGlvbkJsdXIucHV0SW1hZ2VEYXRhKCBpbWFnZURhdGEsIDAsIDAgKTtcclxuXHRcdF9lbmNvZGVyLmFkZCggY2FudmFzTW90aW9uQmx1ciApO1xyXG5cdFx0X2ZyYW1lQ291bnQrKztcclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID0gMDtcclxuXHRcdF9sb2coICdGdWxsIE1CIEZyYW1lISAnICsgX2ZyYW1lQ291bnQgKyAnICcgKyAgX3RpbWUgKTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqIF0gPSAwO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMSBdID0gMDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSA9IDA7XHJcblx0XHR9XHJcblx0XHRnYygpO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jYXB0dXJlKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0aWYoIF9jYXB0dXJpbmcgKSB7XHJcblxyXG5cdFx0XHRpZiggX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgPiAyICkge1xyXG5cclxuXHRcdFx0XHRfY2hlY2tGcmFtZSggY2FudmFzICk7XHJcblx0XHRcdFx0X2JsZW5kRnJhbWUoIGNhbnZhcyApO1xyXG5cclxuXHRcdFx0XHRpZiggX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgPj0gLjUgKiBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyApIHtcclxuXHRcdFx0XHRcdF9zYXZlRnJhbWUoKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0X3N0ZXAoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdF9lbmNvZGVyLmFkZCggY2FudmFzICk7XHJcblx0XHRcdFx0X2ZyYW1lQ291bnQrKztcclxuXHRcdFx0XHRfbG9nKCAnRnVsbCBGcmFtZSEgJyArIF9mcmFtZUNvdW50ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3Byb2Nlc3MoKSB7XHJcblxyXG5cdFx0dmFyIHN0ZXAgPSAxMDAwIC8gX3NldHRpbmdzLmZyYW1lcmF0ZTtcclxuXHRcdHZhciBkdCA9ICggX2ZyYW1lQ291bnQgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzICkgKiBzdGVwO1xyXG5cclxuXHRcdF90aW1lID0gX3N0YXJ0VGltZSArIGR0O1xyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSA9IF9wZXJmb3JtYW5jZVN0YXJ0VGltZSArIGR0O1xyXG5cclxuXHRcdG1lZGlhLmZvckVhY2goIGZ1bmN0aW9uKCB2ICkge1xyXG5cdFx0XHR2Ll9ob29rZWRUaW1lID0gZHQgLyAxMDAwO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdF91cGRhdGVUaW1lKCk7XHJcblx0XHRfbG9nKCAnRnJhbWU6ICcgKyBfZnJhbWVDb3VudCArICcgJyArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ICk7XHJcblxyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfdGltZW91dHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdGlmKCBfdGltZSA+PSBfdGltZW91dHNbIGogXS50cmlnZ2VyVGltZSApIHtcclxuXHRcdFx0XHRfY2FsbCggX3RpbWVvdXRzWyBqIF0uY2FsbGJhY2sgKVxyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coICd0aW1lb3V0IScgKTtcclxuXHRcdFx0XHRfdGltZW91dHMuc3BsaWNlKCBqLCAxICk7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IF9pbnRlcnZhbHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdGlmKCBfdGltZSA+PSBfaW50ZXJ2YWxzWyBqIF0udHJpZ2dlclRpbWUgKSB7XHJcblx0XHRcdFx0X2NhbGwoIF9pbnRlcnZhbHNbIGogXS5jYWxsYmFjayApO1xyXG5cdFx0XHRcdF9pbnRlcnZhbHNbIGogXS50cmlnZ2VyVGltZSArPSBfaW50ZXJ2YWxzWyBqIF0udGltZTtcclxuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCAnaW50ZXJ2YWwhJyApO1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcy5mb3JFYWNoKCBmdW5jdGlvbiggY2IgKSB7XHJcbiAgICAgXHRcdF9jYWxsKCBjYiwgX3RpbWUgLSBnX3N0YXJ0VGltZSApO1xyXG4gICAgICAgIH0gKTtcclxuICAgICAgICBfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzID0gW107XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3NhdmUoIGNhbGxiYWNrICkge1xyXG5cclxuXHRcdGlmKCAhY2FsbGJhY2sgKSB7XHJcblx0XHRcdGNhbGxiYWNrID0gZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRcdFx0ZG93bmxvYWQoIGJsb2IsIF9lbmNvZGVyLmZpbGVuYW1lICsgX2VuY29kZXIuZXh0ZW5zaW9uLCBfZW5jb2Rlci5taW1lVHlwZSApO1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0X2VuY29kZXIuc2F2ZSggY2FsbGJhY2sgKTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfbG9nKCBtZXNzYWdlICkge1xyXG5cdFx0aWYoIF92ZXJib3NlICkgY29uc29sZS5sb2coIG1lc3NhZ2UgKTtcclxuXHR9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uKCBldmVudCwgaGFuZGxlciApIHtcclxuXHJcbiAgICAgICAgX2hhbmRsZXJzW2V2ZW50XSA9IGhhbmRsZXI7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9lbWl0KCBldmVudCApIHtcclxuXHJcbiAgICAgICAgdmFyIGhhbmRsZXIgPSBfaGFuZGxlcnNbZXZlbnRdO1xyXG4gICAgICAgIGlmICggaGFuZGxlciApIHtcclxuXHJcbiAgICAgICAgICAgIGhhbmRsZXIuYXBwbHkoIG51bGwsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcmd1bWVudHMsIDEgKSApO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9wcm9ncmVzcyggcHJvZ3Jlc3MgKSB7XHJcblxyXG4gICAgICAgIF9lbWl0KCAncHJvZ3Jlc3MnLCBwcm9ncmVzcyApO1xyXG5cclxuICAgIH1cclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdHN0YXJ0OiBfc3RhcnQsXHJcblx0XHRjYXB0dXJlOiBfY2FwdHVyZSxcclxuXHRcdHN0b3A6IF9zdG9wLFxyXG5cdFx0c2F2ZTogX3NhdmUsXHJcbiAgICAgICAgb246IF9vblxyXG5cdH1cclxufVxyXG5cclxuKGZyZWVXaW5kb3cgfHwgZnJlZVNlbGYgfHwge30pLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcblxyXG4gIC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMgbGlrZSByLmpzIGNoZWNrIGZvciBjb25kaXRpb24gcGF0dGVybnMgbGlrZSB0aGUgZm9sbG93aW5nOlxyXG4gIGlmICh0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiYgZGVmaW5lLmFtZCkge1xyXG4gICAgLy8gRGVmaW5lIGFzIGFuIGFub255bW91cyBtb2R1bGUgc28sIHRocm91Z2ggcGF0aCBtYXBwaW5nLCBpdCBjYW4gYmVcclxuICAgIC8vIHJlZmVyZW5jZWQgYXMgdGhlIFwidW5kZXJzY29yZVwiIG1vZHVsZS5cclxuICAgIGRlZmluZShmdW5jdGlvbigpIHtcclxuICAgIFx0cmV0dXJuIENDYXB0dXJlO1xyXG4gICAgfSk7XHJcbn1cclxuICAvLyBDaGVjayBmb3IgYGV4cG9ydHNgIGFmdGVyIGBkZWZpbmVgIGluIGNhc2UgYSBidWlsZCBvcHRpbWl6ZXIgYWRkcyBhbiBgZXhwb3J0c2Agb2JqZWN0LlxyXG4gIGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUpIHtcclxuICAgIC8vIEV4cG9ydCBmb3IgTm9kZS5qcy5cclxuICAgIGlmIChtb2R1bGVFeHBvcnRzKSB7XHJcbiAgICBcdChmcmVlTW9kdWxlLmV4cG9ydHMgPSBDQ2FwdHVyZSkuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxuICAgIH1cclxuICAgIC8vIEV4cG9ydCBmb3IgQ29tbW9uSlMgc3VwcG9ydC5cclxuICAgIGZyZWVFeHBvcnRzLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbn1cclxuZWxzZSB7XHJcbiAgICAvLyBFeHBvcnQgdG8gdGhlIGdsb2JhbCBvYmplY3QuXHJcbiAgICByb290LkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbn1cclxuXHJcbn0oKSk7XHJcbiIsIi8qKlxuICogQGF1dGhvciBhbHRlcmVkcSAvIGh0dHA6Ly9hbHRlcmVkcXVhbGlhLmNvbS9cbiAqIEBhdXRob3IgbXIuZG9vYiAvIGh0dHA6Ly9tcmRvb2IuY29tL1xuICovXG5cbnZhciBEZXRlY3RvciA9IHtcblxuXHRjYW52YXM6ICEhIHdpbmRvdy5DYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsXG5cdHdlYmdsOiAoIGZ1bmN0aW9uICgpIHtcblxuXHRcdHRyeSB7XG5cblx0XHRcdHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApOyByZXR1cm4gISEgKCB3aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0ICYmICggY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKSB8fCBjYW52YXMuZ2V0Q29udGV4dCggJ2V4cGVyaW1lbnRhbC13ZWJnbCcgKSApICk7XG5cblx0XHR9IGNhdGNoICggZSApIHtcblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXG5cdFx0fVxuXG5cdH0gKSgpLFxuXHR3b3JrZXJzOiAhISB3aW5kb3cuV29ya2VyLFxuXHRmaWxlYXBpOiB3aW5kb3cuRmlsZSAmJiB3aW5kb3cuRmlsZVJlYWRlciAmJiB3aW5kb3cuRmlsZUxpc3QgJiYgd2luZG93LkJsb2IsXG5cblx0Z2V0V2ViR0xFcnJvck1lc3NhZ2U6IGZ1bmN0aW9uICgpIHtcblxuXHRcdHZhciBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRlbGVtZW50LmlkID0gJ3dlYmdsLWVycm9yLW1lc3NhZ2UnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udFNpemUgPSAnMTNweCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5mb250V2VpZ2h0ID0gJ25vcm1hbCc7XG5cdFx0ZWxlbWVudC5zdHlsZS50ZXh0QWxpZ24gPSAnY2VudGVyJztcblx0XHRlbGVtZW50LnN0eWxlLmJhY2tncm91bmQgPSAnI2ZmZic7XG5cdFx0ZWxlbWVudC5zdHlsZS5jb2xvciA9ICcjMDAwJztcblx0XHRlbGVtZW50LnN0eWxlLnBhZGRpbmcgPSAnMS41ZW0nO1xuXHRcdGVsZW1lbnQuc3R5bGUuekluZGV4ID0gJzk5OSc7XG5cdFx0ZWxlbWVudC5zdHlsZS53aWR0aCA9ICc0MDBweCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5tYXJnaW4gPSAnNWVtIGF1dG8gMCc7XG5cblx0XHRpZiAoICEgdGhpcy53ZWJnbCApIHtcblxuXHRcdFx0ZWxlbWVudC5pbm5lckhUTUwgPSB3aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0ID8gW1xuXHRcdFx0XHQnWW91ciBncmFwaGljcyBjYXJkIGRvZXMgbm90IHNlZW0gdG8gc3VwcG9ydCA8YSBocmVmPVwiaHR0cDovL2tocm9ub3Mub3JnL3dlYmdsL3dpa2kvR2V0dGluZ19hX1dlYkdMX0ltcGxlbWVudGF0aW9uXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+V2ViR0w8L2E+LjxiciAvPicsXG5cdFx0XHRcdCdGaW5kIG91dCBob3cgdG8gZ2V0IGl0IDxhIGhyZWY9XCJodHRwOi8vZ2V0LndlYmdsLm9yZy9cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5oZXJlPC9hPi4nXG5cdFx0XHRdLmpvaW4oICdcXG4nICkgOiBbXG5cdFx0XHRcdCdZb3VyIGJyb3dzZXIgZG9lcyBub3Qgc2VlbSB0byBzdXBwb3J0IDxhIGhyZWY9XCJodHRwOi8va2hyb25vcy5vcmcvd2ViZ2wvd2lraS9HZXR0aW5nX2FfV2ViR0xfSW1wbGVtZW50YXRpb25cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5XZWJHTDwvYT4uPGJyLz4nLFxuXHRcdFx0XHQnRmluZCBvdXQgaG93IHRvIGdldCBpdCA8YSBocmVmPVwiaHR0cDovL2dldC53ZWJnbC5vcmcvXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+aGVyZTwvYT4uJ1xuXHRcdFx0XS5qb2luKCAnXFxuJyApO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVsZW1lbnQ7XG5cblx0fSxcblxuXHRhZGRHZXRXZWJHTE1lc3NhZ2U6IGZ1bmN0aW9uICggcGFyYW1ldGVycyApIHtcblxuXHRcdHZhciBwYXJlbnQsIGlkLCBlbGVtZW50O1xuXG5cdFx0cGFyYW1ldGVycyA9IHBhcmFtZXRlcnMgfHwge307XG5cblx0XHRwYXJlbnQgPSBwYXJhbWV0ZXJzLnBhcmVudCAhPT0gdW5kZWZpbmVkID8gcGFyYW1ldGVycy5wYXJlbnQgOiBkb2N1bWVudC5ib2R5O1xuXHRcdGlkID0gcGFyYW1ldGVycy5pZCAhPT0gdW5kZWZpbmVkID8gcGFyYW1ldGVycy5pZCA6ICdvbGRpZSc7XG5cblx0XHRlbGVtZW50ID0gRGV0ZWN0b3IuZ2V0V2ViR0xFcnJvck1lc3NhZ2UoKTtcblx0XHRlbGVtZW50LmlkID0gaWQ7XG5cblx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQoIGVsZW1lbnQgKTtcblxuXHR9XG5cbn07XG5cbi8vRVM2IGV4cG9ydFxuXG5leHBvcnQgeyBEZXRlY3RvciB9O1xuIiwiLy9UaGlzIGxpYnJhcnkgaXMgZGVzaWduZWQgdG8gaGVscCBzdGFydCB0aHJlZS5qcyBlYXNpbHksIGNyZWF0aW5nIHRoZSByZW5kZXIgbG9vcCBhbmQgY2FudmFzIGF1dG9tYWdpY2FsbHkuXG4vL1JlYWxseSBpdCBzaG91bGQgYmUgc3B1biBvZmYgaW50byBpdHMgb3duIHRoaW5nIGluc3RlYWQgb2YgYmVpbmcgcGFydCBvZiBleHBsYW5hcmlhLlxuXG4vL2Fsc28sIGNoYW5nZSBUaHJlZWFzeV9FbnZpcm9ubWVudCB0byBUaHJlZWFzeV9SZWNvcmRlciB0byBkb3dubG9hZCBoaWdoLXF1YWxpdHkgZnJhbWVzIG9mIGFuIGFuaW1hdGlvblxuXG5pbXBvcnQgQ0NhcHR1cmUgZnJvbSAnY2NhcHR1cmUuanMnO1xuaW1wb3J0IHsgRGV0ZWN0b3IgfSBmcm9tICcuLi9saWIvV2ViR0xfRGV0ZWN0b3IuanMnO1xuaW1wb3J0IHsgc2V0VGhyZWVFbnZpcm9ubWVudCwgZ2V0VGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmZ1bmN0aW9uIFRocmVlYXN5RW52aXJvbm1lbnQoY2FudmFzRWxlbSA9IG51bGwpe1xuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSAwO1xuICAgIHRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzID0gKGNhbnZhc0VsZW0gPT09IG51bGwpO1xuXG5cdGlmKCFEZXRlY3Rvci53ZWJnbClEZXRlY3Rvci5hZGRHZXRXZWJHTE1lc3NhZ2UoKTtcblxuICAgIC8vZm92LCBhc3BlY3QsIG5lYXIsIGZhclxuXHR0aGlzLmNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYSggNzAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDEwMDAwMDAwICk7XG5cdC8vdGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuT3J0aG9ncmFwaGljQ2FtZXJhKCA3MCwgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDAuMSwgMTAgKTtcblxuXHR0aGlzLmNhbWVyYS5wb3NpdGlvbi5zZXQoMCwgMCwgMTApO1xuXHR0aGlzLmNhbWVyYS5sb29rQXQobmV3IFRIUkVFLlZlY3RvcjMoMCwwLDApKTtcblxuXG5cdC8vY3JlYXRlIGNhbWVyYSwgc2NlbmUsIHRpbWVyLCByZW5kZXJlciBvYmplY3RzXG5cdC8vY3JhZXRlIHJlbmRlciBvYmplY3RcblxuXG5cdFxuXHR0aGlzLnNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5cdHRoaXMuc2NlbmUuYWRkKHRoaXMuY2FtZXJhKTtcblxuXHQvL3JlbmRlcmVyXG5cdGxldCByZW5kZXJlck9wdGlvbnMgPSB7IGFudGlhbGlhczogdHJ1ZX07XG5cbiAgICBpZighdGhpcy5zaG91bGRDcmVhdGVDYW52YXMpe1xuICAgICAgICByZW5kZXJlck9wdGlvbnMuY2FudmFzID0gY2FudmFzRWxlbTtcbiAgICB9XG5cblx0dGhpcy5yZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKCByZW5kZXJlck9wdGlvbnMgKTtcblx0dGhpcy5yZW5kZXJlci5zZXRQaXhlbFJhdGlvKCB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldENsZWFyQ29sb3IobmV3IFRIUkVFLkNvbG9yKDB4RkZGRkZGKSwgMS4wKTtcblxuXG4gICAgdGhpcy5vbldpbmRvd1Jlc2l6ZSgpOyAvL3Jlc2l6ZSBjYW52YXMgdG8gd2luZG93IHNpemUgYW5kIHNldCBhc3BlY3QgcmF0aW9cblx0Lypcblx0dGhpcy5yZW5kZXJlci5nYW1tYUlucHV0ID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci5nYW1tYU91dHB1dCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIuc2hhZG93TWFwLmVuYWJsZWQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlO1xuXHQqL1xuXG5cdHRoaXMudGltZVNjYWxlID0gMTtcblx0dGhpcy5lbGFwc2VkVGltZSA9IDA7XG5cdHRoaXMudHJ1ZUVsYXBzZWRUaW1lID0gMDtcblxuICAgIGlmKHRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzKXtcblx0ICAgIHRoaXMuY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0ICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKCB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQgKTtcbiAgICB9XG5cblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCB0aGlzLm9uTW91c2VEb3duLmJpbmQodGhpcyksIGZhbHNlICk7XG5cdHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2V1cCcsIHRoaXMub25Nb3VzZVVwLmJpbmQodGhpcyksIGZhbHNlICk7XG5cdHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAndG91Y2hzdGFydCcsIHRoaXMub25Nb3VzZURvd24uYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaGVuZCcsIHRoaXMub25Nb3VzZVVwLmJpbmQodGhpcyksIGZhbHNlICk7XG5cblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCB0aGlzLm9uV2luZG93UmVzaXplLmJpbmQodGhpcyksIGZhbHNlICk7XG5cblx0Lypcblx0Ly9yZW5kZXJlci52ci5lbmFibGVkID0gdHJ1ZTsgXG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cG9pbnRlcnJlc3RyaWN0ZWQnLCBvblBvaW50ZXJSZXN0cmljdGVkLCBmYWxzZSApO1xuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3ZyZGlzcGxheXBvaW50ZXJ1bnJlc3RyaWN0ZWQnLCBvblBvaW50ZXJVbnJlc3RyaWN0ZWQsIGZhbHNlICk7XG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIFdFQlZSLmNyZWF0ZUJ1dHRvbiggcmVuZGVyZXIgKSApO1xuXHQqL1xuXG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgdGhpcy5vblBhZ2VMb2FkLmJpbmQodGhpcyksIGZhbHNlKTtcblxuXHR0aGlzLmNsb2NrID0gbmV3IFRIUkVFLkNsb2NrKCk7XG5cblx0dGhpcy5JU19SRUNPUkRJTkcgPSBmYWxzZTsgLy8gcXVlcnlhYmxlIGlmIG9uZSB3YW50cyB0byBkbyB0aGluZ3MgbGlrZSBiZWVmIHVwIHBhcnRpY2xlIGNvdW50cyBmb3IgcmVuZGVyXG5cbiAgICBpZighdGhpcy5zaG91bGRDcmVhdGVDYW52YXMgJiYgY2FudmFzRWxlbS5vZmZzZXRXaWR0aCl7XG4gICAgICAgIC8vSWYgdGhlIGNhbnZhc0VsZW1lbnQgaXMgYWxyZWFkeSBsb2FkZWQsIHRoZW4gdGhlICdsb2FkJyBldmVudCBoYXMgYWxyZWFkeSBmaXJlZC4gV2UgbmVlZCB0byB0cmlnZ2VyIGl0IG91cnNlbHZlcy5cbiAgICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLm9uUGFnZUxvYWQuYmluZCh0aGlzKSk7XG4gICAgfVxufVxuXG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vblBhZ2VMb2FkID0gZnVuY3Rpb24oKSB7XG5cdGNvbnNvbGUubG9nKFwiVGhyZWVhc3lfU2V0dXAgbG9hZGVkIVwiKTtcblx0aWYodGhpcy5zaG91bGRDcmVhdGVDYW52YXMpe1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHRoaXMuY29udGFpbmVyICk7XG5cdH1cblxuXHR0aGlzLnN0YXJ0KCk7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCl7XG5cdHRoaXMucHJldl90aW1lc3RlcCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuXHR0aGlzLmNsb2NrLnN0YXJ0KCk7XG5cdHRoaXMucmVuZGVyKHRoaXMucHJldl90aW1lc3RlcCk7XG59XG5cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uTW91c2VEb3duID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuaXNNb3VzZURvd24gPSB0cnVlO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Nb3VzZVVwPSBmdW5jdGlvbigpIHtcblx0dGhpcy5pc01vdXNlRG93biA9IGZhbHNlO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Qb2ludGVyUmVzdHJpY3RlZD0gZnVuY3Rpb24oKSB7XG5cdHZhciBwb2ludGVyTG9ja0VsZW1lbnQgPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cdGlmICggcG9pbnRlckxvY2tFbGVtZW50ICYmIHR5cGVvZihwb2ludGVyTG9ja0VsZW1lbnQucmVxdWVzdFBvaW50ZXJMb2NrKSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRwb2ludGVyTG9ja0VsZW1lbnQucmVxdWVzdFBvaW50ZXJMb2NrKCk7XG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUG9pbnRlclVucmVzdHJpY3RlZD0gZnVuY3Rpb24oKSB7XG5cdHZhciBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ID0gZG9jdW1lbnQucG9pbnRlckxvY2tFbGVtZW50O1xuXHR2YXIgZXhwZWN0ZWRQb2ludGVyTG9ja0VsZW1lbnQgPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cdGlmICggY3VycmVudFBvaW50ZXJMb2NrRWxlbWVudCAmJiBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ID09PSBleHBlY3RlZFBvaW50ZXJMb2NrRWxlbWVudCAmJiB0eXBlb2YoZG9jdW1lbnQuZXhpdFBvaW50ZXJMb2NrKSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRkb2N1bWVudC5leGl0UG9pbnRlckxvY2soKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUuZXZlbmlmeSA9IGZ1bmN0aW9uKHgpe1xuXHRpZih4ICUgMiA9PSAxKXtcblx0XHRyZXR1cm4geCsxO1xuXHR9XG5cdHJldHVybiB4O1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25XaW5kb3dSZXNpemU9IGZ1bmN0aW9uKCkge1xuXG4gICAgbGV0IHdpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG4gICAgbGV0IGhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICBcbiAgICBpZighdGhpcy5zaG91bGRDcmVhdGVDYW52YXMpeyAvLyBhIGNhbnZhcyB3YXMgcHJvdmlkZWQgZXh0ZXJuYWxseVxuXG4gICAgICAgIHdpZHRoID0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmNsaWVudFdpZHRoO1xuICAgICAgICBoZWlnaHQgPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuY2xpZW50SGVpZ2h0O1xuICAgIH1cblxuXHR0aGlzLmNhbWVyYS5hc3BlY3QgPSB3aWR0aCAvIGhlaWdodDtcbiAgICAvL3RoaXMuY2FtZXJhLnNldEZvY2FsTGVuZ3RoKDMwKTsgLy9pZiBJIHVzZSB0aGlzLCB0aGUgY2FtZXJhIHdpbGwga2VlcCBhIGNvbnN0YW50IHdpZHRoIGluc3RlYWQgb2YgY29uc3RhbnQgaGVpZ2h0XG5cdHRoaXMuYXNwZWN0ID0gdGhpcy5jYW1lcmEuYXNwZWN0O1xuXHR0aGlzLmNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG5cdHRoaXMucmVuZGVyZXIuc2V0U2l6ZSggdGhpcy5ldmVuaWZ5KHdpZHRoKSwgdGhpcy5ldmVuaWZ5KGhlaWdodCksdGhpcy5zaG91bGRDcmVhdGVDYW52YXMgKTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLmxpc3RlbmVycyA9IHtcInVwZGF0ZVwiOiBbXSxcInJlbmRlclwiOltdfTsgLy91cGRhdGUgZXZlbnQgbGlzdGVuZXJzXG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbih0aW1lc3RlcCl7XG4gICAgdmFyIHJlYWx0aW1lRGVsdGEgPSB0aGlzLmNsb2NrLmdldERlbHRhKCk7XG5cdHZhciBkZWx0YSA9IHJlYWx0aW1lRGVsdGEqdGhpcy50aW1lU2NhbGU7XG5cdHRoaXMuZWxhcHNlZFRpbWUgKz0gZGVsdGE7XG4gICAgdGhpcy50cnVlRWxhcHNlZFRpbWUgKz0gcmVhbHRpbWVEZWx0YTtcblx0Ly9nZXQgdGltZXN0ZXBcblx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5sZW5ndGg7aSsrKXtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXVtpXSh7XCJ0XCI6dGhpcy5lbGFwc2VkVGltZSxcImRlbHRhXCI6ZGVsdGEsJ3JlYWx0aW1lRGVsdGEnOnJlYWx0aW1lRGVsdGF9KTtcblx0fVxuXG5cdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSApO1xuXG5cdGZvcih2YXIgaT0wO2k8dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0ubGVuZ3RoO2krKyl7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl1baV0oKTtcblx0fVxuXG5cdHRoaXMucHJldl90aW1lc3RlcCA9IHRpbWVzdGVwO1xuXHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub24gPSBmdW5jdGlvbihldmVudF9uYW1lLCBmdW5jKXtcblx0Ly9SZWdpc3RlcnMgYW4gZXZlbnQgbGlzdGVuZXIuXG5cdC8vZWFjaCBsaXN0ZW5lciB3aWxsIGJlIGNhbGxlZCB3aXRoIGFuIG9iamVjdCBjb25zaXN0aW5nIG9mOlxuXHQvL1x0e3Q6IDxjdXJyZW50IHRpbWUgaW4gcz4sIFwiZGVsdGFcIjogPGRlbHRhLCBpbiBtcz59XG5cdC8vIGFuIHVwZGF0ZSBldmVudCBmaXJlcyBiZWZvcmUgYSByZW5kZXIuIGEgcmVuZGVyIGV2ZW50IGZpcmVzIHBvc3QtcmVuZGVyLlxuXHRpZihldmVudF9uYW1lID09IFwidXBkYXRlXCIpeyBcblx0XHR0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5wdXNoKGZ1bmMpO1xuXHR9ZWxzZSBpZihldmVudF9uYW1lID09IFwicmVuZGVyXCIpeyBcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5wdXNoKGZ1bmMpO1xuXHR9ZWxzZXtcblx0XHRjb25zb2xlLmVycm9yKFwiSW52YWxpZCBldmVudCBuYW1lIVwiKVxuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnRfbmFtZSwgZnVuYyl7XG5cdC8vVW5yZWdpc3RlcnMgYW4gZXZlbnQgbGlzdGVuZXIsIHVuZG9pbmcgYW4gVGhyZWVhc3lfc2V0dXAub24oKSBldmVudCBsaXN0ZW5lci5cblx0Ly90aGUgbmFtaW5nIHNjaGVtZSBtaWdodCBub3QgYmUgdGhlIGJlc3QgaGVyZS5cblx0aWYoZXZlbnRfbmFtZSA9PSBcInVwZGF0ZVwiKXsgXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0uaW5kZXhPZihmdW5jKTtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5zcGxpY2UoaW5kZXgsMSk7XG5cdH0gZWxzZSBpZihldmVudF9uYW1lID09IFwicmVuZGVyXCIpeyBcblx0XHRsZXQgaW5kZXggPSB0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5pbmRleE9mKGZ1bmMpO1xuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLnNwbGljZShpbmRleCwxKTtcblx0fWVsc2V7XG5cdFx0Y29uc29sZS5lcnJvcihcIk5vbmV4aXN0ZW50IGV2ZW50IG5hbWUhXCIpXG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9mZiA9IFRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXI7IC8vYWxpYXMgdG8gbWF0Y2ggVGhyZWVhc3lFbnZpcm9ubWVudC5vblxuXG5jbGFzcyBUaHJlZWFzeVJlY29yZGVyIGV4dGVuZHMgVGhyZWVhc3lFbnZpcm9ubWVudHtcblx0Ly9iYXNlZCBvbiBodHRwOi8vd3d3LnR5c29uY2FkZW5oZWFkLmNvbS9ibG9nL2V4cG9ydGluZy1jYW52YXMtYW5pbWF0aW9uLXRvLW1vdi8gdG8gcmVjb3JkIGFuIGFuaW1hdGlvblxuXHQvL3doZW4gZG9uZSwgICAgIGZmbXBlZyAtciA2MCAtZnJhbWVyYXRlIDYwIC1pIC4vJTA3ZC5wbmcgLXZjb2RlYyBsaWJ4MjY0IC1waXhfZm10IHl1djQyMHAgLWNyZjp2IDAgdmlkZW8ubXA0XG4gICAgLy8gdG8gcGVyZm9ybSBtb3Rpb24gYmx1ciBvbiBhbiBvdmVyc2FtcGxlZCB2aWRlbywgZmZtcGVnIC1pIHZpZGVvLm1wNCAtdmYgdGJsZW5kPWFsbF9tb2RlPWF2ZXJhZ2UsZnJhbWVzdGVwPTIgdmlkZW8yLm1wNFxuXHQvL3RoZW4sIGFkZCB0aGUgeXV2NDIwcCBwaXhlbHMgKHdoaWNoIGZvciBzb21lIHJlYXNvbiBpc24ndCBkb25lIGJ5IHRoZSBwcmV2IGNvbW1hbmQpIGJ5OlxuXHQvLyBmZm1wZWcgLWkgdmlkZW8ubXA0IC12Y29kZWMgbGlieDI2NCAtcGl4X2ZtdCB5dXY0MjBwIC1zdHJpY3QgLTIgLWFjb2RlYyBhYWMgZmluaXNoZWRfdmlkZW8ubXA0XG5cdC8vY2hlY2sgd2l0aCBmZm1wZWcgLWkgZmluaXNoZWRfdmlkZW8ubXA0XG5cblx0Y29uc3RydWN0b3IoZnBzPTMwLCBsZW5ndGggPSA1LCBjYW52YXNFbGVtID0gbnVsbCl7XG5cdFx0LyogZnBzIGlzIGV2aWRlbnQsIGF1dG9zdGFydCBpcyBhIGJvb2xlYW4gKGJ5IGRlZmF1bHQsIHRydWUpLCBhbmQgbGVuZ3RoIGlzIGluIHMuKi9cblx0XHRzdXBlcihjYW52YXNFbGVtKTtcblx0XHR0aGlzLmZwcyA9IGZwcztcblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblx0XHR0aGlzLmZyYW1lQ291bnQgPSBmcHMgKiBsZW5ndGg7XG5cdFx0dGhpcy5mcmFtZXNfcmVuZGVyZWQgPSAwO1xuXG5cdFx0dGhpcy5jYXB0dXJlciA9IG5ldyBDQ2FwdHVyZSgge1xuXHRcdFx0ZnJhbWVyYXRlOiBmcHMsXG5cdFx0XHRmb3JtYXQ6ICdwbmcnLFxuXHRcdFx0bmFtZTogZG9jdW1lbnQudGl0bGUsXG5cdFx0XHQvL3ZlcmJvc2U6IHRydWUsXG5cdFx0fSApO1xuXG5cdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMuSVNfUkVDT1JESU5HID0gdHJ1ZTtcblx0fVxuXHRzdGFydCgpe1xuXHRcdC8vbWFrZSBhIHJlY29yZGluZyBzaWduXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS53aWR0aD1cIjIwcHhcIlxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuaGVpZ2h0PVwiMjBweFwiXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS50b3AgPSAnMjBweCc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5sZWZ0ID0gJzIwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JlZCc7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLnJlY29yZGluZ19pY29uKTtcblxuXHRcdHRoaXMuZnJhbWVDb3VudGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUudG9wID0gJzIwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmxlZnQgPSAnNTBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuY29sb3IgPSAnYmxhY2snO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSgyNTUsMjU1LDI1NSwwLjEpJztcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuZnJhbWVDb3VudGVyKTtcblxuXHRcdHRoaXMuY2FwdHVyZXIuc3RhcnQoKTtcblx0XHR0aGlzLnJlbmRlcmluZyA9IHRydWU7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXHRyZW5kZXIodGltZXN0ZXApe1xuICAgICAgICB2YXIgcmVhbHRpbWVEZWx0YSA9IDEvdGhpcy5mcHM7Ly9pZ25vcmluZyB0aGUgdHJ1ZSB0aW1lLCBjYWxjdWxhdGUgdGhlIGRlbHRhXG5cdFx0dmFyIGRlbHRhID0gcmVhbHRpbWVEZWx0YSp0aGlzLnRpbWVTY2FsZTsgXG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcbiAgICAgICAgdGhpcy50cnVlRWxhcHNlZFRpbWUgKz0gcmVhbHRpbWVEZWx0YTtcblxuXHRcdC8vZ2V0IHRpbWVzdGVwXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YSwgJ3JlYWx0aW1lRGVsdGEnOnJlYWx0aW1lRGVsdGF9KTtcblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlcmVyLnJlbmRlciggdGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEgKTtcblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXVtpXSgpO1xuXHRcdH1cblxuXG5cdFx0dGhpcy5yZWNvcmRfZnJhbWUoKTtcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4JztcblxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG5cdH1cblx0cmVjb3JkX2ZyYW1lKCl7XG5cdC8vXHRsZXQgY3VycmVudF9mcmFtZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2NhbnZhcycpLnRvRGF0YVVSTCgpO1xuXG5cdFx0dGhpcy5jYXB0dXJlci5jYXB0dXJlKCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYW52YXMnKSApO1xuXG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuaW5uZXJIVE1MID0gdGhpcy5mcmFtZXNfcmVuZGVyZWQgKyBcIiAvIFwiICsgdGhpcy5mcmFtZUNvdW50OyAvL3VwZGF0ZSB0aW1lclxuXG5cdFx0dGhpcy5mcmFtZXNfcmVuZGVyZWQrKztcblxuXG5cdFx0aWYodGhpcy5mcmFtZXNfcmVuZGVyZWQ+dGhpcy5mcmFtZUNvdW50KXtcblx0XHRcdHRoaXMucmVuZGVyID0gbnVsbDsgLy9oYWNreSB3YXkgb2Ygc3RvcHBpbmcgdGhlIHJlbmRlcmluZ1xuXHRcdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHQvL3RoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuXHRcdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblx0XHRcdHRoaXMuY2FwdHVyZXIuc3RvcCgpO1xuXHRcdFx0Ly8gZGVmYXVsdCBzYXZlLCB3aWxsIGRvd25sb2FkIGF1dG9tYXRpY2FsbHkgYSBmaWxlIGNhbGxlZCB7bmFtZX0uZXh0ZW5zaW9uICh3ZWJtL2dpZi90YXIpXG5cdFx0XHR0aGlzLmNhcHR1cmVyLnNhdmUoKTtcblx0XHR9XG5cdH1cblx0b25XaW5kb3dSZXNpemUoKSB7XG5cdFx0Ly9zdG9wIHJlY29yZGluZyBpZiB3aW5kb3cgc2l6ZSBjaGFuZ2VzXG5cdFx0aWYodGhpcy5yZW5kZXJpbmcgJiYgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQgIT0gdGhpcy5hc3BlY3Qpe1xuXHRcdFx0dGhpcy5jYXB0dXJlci5zdG9wKCk7XG5cdFx0XHR0aGlzLnJlbmRlciA9IG51bGw7IC8vaGFja3kgd2F5IG9mIHN0b3BwaW5nIHRoZSByZW5kZXJpbmdcblx0XHRcdGFsZXJ0KFwiQWJvcnRpbmcgcmVjb3JkOiBXaW5kb3ctc2l6ZSBjaGFuZ2UgZGV0ZWN0ZWQhXCIpO1xuXHRcdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3VwZXIub25XaW5kb3dSZXNpemUoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBzZXR1cFRocmVlKGZwcz0zMCwgbGVuZ3RoID0gNSwgY2FudmFzRWxlbSA9IG51bGwpe1xuXHQvKiBTZXQgdXAgdGhlIHRocmVlLmpzIGVudmlyb25tZW50LiBTd2l0Y2ggYmV0d2VlbiBjbGFzc2VzIGR5bmFtaWNhbGx5IHNvIHRoYXQgeW91IGNhbiByZWNvcmQgYnkgYXBwZW5kaW5nIFwiP3JlY29yZD10cnVlXCIgdG8gYW4gdXJsLiBUaGVuIEVYUC50aHJlZUVudmlyb25tZW50LmNhbWVyYSBhbmQgRVhQLnRocmVlRW52aXJvbm1lbnQuc2NlbmUgd29yaywgYXMgd2VsbCBhcyBFWFAudGhyZWVFbnZpcm9ubWVudC5vbignZXZlbnQgbmFtZScsIGNhbGxiYWNrKS4gT25seSBvbmUgZW52aXJvbm1lbnQgZXhpc3RzIGF0IGEgdGltZS5cblxuICAgIFRoZSByZXR1cm5lZCBvYmplY3QgaXMgYSBzaW5nbGV0b246IG11bHRpcGxlIGNhbGxzIHdpbGwgcmV0dXJuIHRoZSBzYW1lIG9iamVjdDogRVhQLnRocmVlRW52aXJvbm1lbnQuKi9cblx0dmFyIHJlY29yZGVyID0gbnVsbDtcblx0dmFyIGlzX3JlY29yZGluZyA9IGZhbHNlO1xuXG5cdC8vZXh0cmFjdCByZWNvcmQgcGFyYW1ldGVyIGZyb20gdXJsXG5cdHZhciBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKGRvY3VtZW50LmxvY2F0aW9uLnNlYXJjaCk7XG5cdGxldCByZWNvcmRTdHJpbmcgPSBwYXJhbXMuZ2V0KFwicmVjb3JkXCIpO1xuXG5cdGlmKHJlY29yZFN0cmluZyl7IC8vZGV0ZWN0IGlmIFVSTCBwYXJhbXMgaW5jbHVkZSA/cmVjb3JkPTEgb3IgP3JlY29yZD10cnVlXG4gICAgICAgIHJlY29yZFN0cmluZyA9IHJlY29yZFN0cmluZy50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpc19yZWNvcmRpbmcgPSAocmVjb3JkU3RyaW5nID09IFwidHJ1ZVwiIHx8IHJlY29yZFN0cmluZyA9PSBcIjFcIik7XG4gICAgfVxuXG4gICAgbGV0IHRocmVlRW52aXJvbm1lbnQgPSBnZXRUaHJlZUVudmlyb25tZW50KCk7XG4gICAgaWYodGhyZWVFbnZpcm9ubWVudCAhPT0gbnVsbCl7Ly9zaW5nbGV0b24gaGFzIGFscmVhZHkgYmVlbiBjcmVhdGVkXG4gICAgICAgIHJldHVybiB0aHJlZUVudmlyb25tZW50O1xuICAgIH1cblxuXHRpZihpc19yZWNvcmRpbmcpe1xuXHRcdHRocmVlRW52aXJvbm1lbnQgPSBuZXcgVGhyZWVhc3lSZWNvcmRlcihmcHMsIGxlbmd0aCwgY2FudmFzRWxlbSk7XG5cdH1lbHNle1xuXHRcdHRocmVlRW52aXJvbm1lbnQgPSBuZXcgVGhyZWVhc3lFbnZpcm9ubWVudChjYW52YXNFbGVtKTtcblx0fVxuICAgIHNldFRocmVlRW52aXJvbm1lbnQodGhyZWVFbnZpcm9ubWVudCk7XG4gICAgcmV0dXJuIHRocmVlRW52aXJvbm1lbnQ7XG59XG5cbmV4cG9ydCB7c2V0dXBUaHJlZSwgVGhyZWVhc3lFbnZpcm9ubWVudCwgVGhyZWVhc3lSZWNvcmRlcn1cbiIsImFzeW5jIGZ1bmN0aW9uIGRlbGF5KHdhaXRUaW1lKXtcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHR9KTtcblxufVxuXG5leHBvcnQge2RlbGF5fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmNsYXNzIExpbmVPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29ya1xuXHRcdFx0b3B0aW9uczpcblx0XHRcdHtcblx0XHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0XHRvcGFjaXR5OiBudW1iZXJcblx0XHRcdFx0Y29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcblx0XHRcdH1cblx0XHQqL1xuXG5cdFx0dGhpcy5fd2lkdGggPSBvcHRpb25zLndpZHRoICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLndpZHRoIDogNTtcblx0XHR0aGlzLl9vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm9wYWNpdHkgOiAxO1xuXHRcdHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuY29sb3IpIDogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbXTsgLy8gaG93IG1hbnkgdGltZXMgdG8gYmUgY2FsbGVkIGluIGVhY2ggZGlyZWN0aW9uXG5cdFx0dGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDM7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/XG5cblx0XHR0aGlzLmluaXQoKTtcblx0fVxuXHRpbml0KCl7XG5cdFx0dGhpcy5fZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcblx0XHR0aGlzLl92ZXJ0aWNlcztcblx0XHR0aGlzLm1ha2VHZW9tZXRyeSgpO1xuXG5cdFx0dGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7dmVydGV4Q29sb3JzOiBUSFJFRS5WZXJ0ZXhDb2xvcnMsIGxpbmV3aWR0aDogdGhpcy5fd2lkdGgsb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSk7XG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLkxpbmVTZWdtZW50cyh0aGlzLl9nZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vIHNldHRlciBzZXRzIHRyYW5zcGFyZW50IGZsYWcgaWYgbmVjZXNzYXJ5XG5cblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXHR9XG5cblx0bWFrZUdlb21ldHJ5KCl7XG5cdFx0Ly8gZm9sbG93IGh0dHA6Ly9ibG9nLmNqZ2FtbW9uLmNvbS90aHJlZWpzLWdlb21ldHJ5XG5cdFx0Ly8gb3IgbWF0aGJveCdzIGxpbmVHZW9tZXRyeVxuXG5cdFx0Lypcblx0XHRUaGlzIGNvZGUgc2VlbXMgdG8gYmUgbmVjZXNzYXJ5IHRvIHJlbmRlciBsaW5lcyBhcyBhIHRyaWFuZ2xlIHN0cnAuXG5cdFx0SSBjYW4ndCBzZWVtIHRvIGdldCBpdCB0byB3b3JrIHByb3Blcmx5LlxuXG5cdFx0bGV0IG51bVZlcnRpY2VzID0gMztcblx0XHR2YXIgaW5kaWNlcyA9IFtdO1xuXG5cdFx0Ly9pbmRpY2VzXG5cdFx0bGV0IGJhc2UgPSAwO1xuXHRcdGZvcih2YXIgaz0wO2s8bnVtVmVydGljZXMtMTtrKz0xKXtcbiAgICAgICAgXHRpbmRpY2VzLnB1c2goIGJhc2UsIGJhc2UrMSwgYmFzZSsyKTtcblx0XHRcdGluZGljZXMucHVzaCggYmFzZSsyLCBiYXNlKzEsIGJhc2UrMyk7XG5cdFx0XHRiYXNlICs9IDI7XG5cdFx0fVxuXHRcdHRoaXMuX2dlb21ldHJ5LnNldEluZGV4KCBpbmRpY2VzICk7Ki9cblxuXHRcdGNvbnN0IE1BWF9QT0lOVFMgPSAxMDAwMDtcbiAgICAgICAgY29uc3QgTlVNX1BPSU5UU19QRVJfTElORV9TRUdNRU5UID0gMjtcblxuXHRcdHRoaXMuX3ZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl9vdXRwdXREaW1lbnNpb25zICogKE1BWF9QT0lOVFMtMSkqTlVNX1BPSU5UU19QRVJfTElORV9TRUdNRU5UKTtcblx0XHR0aGlzLl9jb2xvcnMgPSBuZXcgRmxvYXQzMkFycmF5KChNQVhfUE9JTlRTLTEpKk5VTV9QT0lOVFNfUEVSX0xJTkVfU0VHTUVOVCAqIDMpO1xuXG5cdFx0Ly8gYnVpbGQgZ2VvbWV0cnlcblxuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcbiAgICAgICAgdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnY29sb3InLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fY29sb3JzLCAzICkgKTtcblx0XHQvL3RoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ25vcm1hbCcsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCBub3JtYWxzLCAzICkgKTtcblx0XHQvL3RoaXMuZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAndXYnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdXZzLCAyICkgKTtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy91c2VkIGR1cmluZyB1cGRhdGVzIGFzIGEgcG9pbnRlciB0byB0aGUgYnVmZmVyXG5cblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cblx0fVxuXHRfb25BZGQoKXtcblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgRG9tYWluIG5vZGUgd2UncmUgcmVuZGVyaW5nIGZyb21cbiAgICAgICAgbGV0IHJvb3QgPSBudWxsO1xuICAgICAgICB0cnl7XG4gICAgICAgICAgIHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcbiAgICAgICAgfWNhdGNoKGVycm9yKXtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihlcnJvcik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblx0XG5cdFx0Ly90b2RvOiBpbXBsZW1lbnQgc29tZXRoaW5nIGxpa2UgYXNzZXJ0IHJvb3QgdHlwZW9mIFJvb3ROb2RlXG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSByb290Lml0ZW1EaW1lbnNpb25zO1xuXHR9XG5cdF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuXHRcdHRoaXMuX29uQWRkKCk7IC8vc2V0dXAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gYW5kIHRoaXMuaXRlbURpbWVuc2lvbnMuIHVzZWQgaGVyZSBhZ2FpbiBiZWNhdXNlIGNsb25pbmcgbWVhbnMgdGhlIG9uQWRkKCkgbWlnaHQgYmUgY2FsbGVkIGJlZm9yZSB0aGlzIGlzIGNvbm5lY3RlZCB0byBhIHR5cGUgb2YgZG9tYWluXG5cblx0XHQvLyBwZXJoYXBzIGluc3RlYWQgb2YgZ2VuZXJhdGluZyBhIHdob2xlIG5ldyBhcnJheSwgdGhpcyBjYW4gcmV1c2UgdGhlIG9sZCBvbmU/XG5cblxuICAgICAgICAvLyBXaHkgdXNlICh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbi0xKSoyPyBcbiAgICAgICAgLy8gV2Ugd2FudCB0byByZW5kZXIgYSBjaGFpbiB3aXRoIG4gcG9pbnRzLCBlYWNoIGNvbm5lY3RlZCB0byB0aGUgb25lIGluIGZyb250IG9mIGl0IGJ5IGEgbGluZSBleGNlcHQgdGhlIGxhc3Qgb25lLiBUaGVuIGJlY2F1c2UgdGhlIGxhc3QgdmVydGV4IGRvZXNuJ3QgaW50cm9kdWNlIGEgbmV3IGxpbmUsIHRoZXJlIGFyZSBuLTEgbGluZXMgYmV0d2VlbiB0aGUgY2hhaW4gcG9pbnRzLlxuICAgICAgICAvLyBFYWNoIGxpbmUgaXMgcmVuZGVyZWQgdXNpbmcgdHdvIHZlcnRpY2VzLiBTbyB3ZSBtdWx0aXBseSB0aGUgbnVtYmVyIG9mIGxpbmVzLCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbi0xLCBieSB0d28uXG4gICAgICAgIGNvbnN0IE5VTV9QT0lOVFNfUEVSX0xJTkVfU0VHTUVOVCA9IDI7XG5cblx0XHRsZXQgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICogKHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLTEpICogTlVNX1BPSU5UU19QRVJfTElORV9TRUdNRU5UKTtcblx0XHRsZXQgY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheSggMyAqICh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbi0xKSAqIE5VTV9QT0lOVFNfUEVSX0xJTkVfU0VHTUVOVCk7XG5cblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdHRoaXMuX3ZlcnRpY2VzID0gdmVydGljZXM7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdmVydGljZXMpO1xuXG5cdFx0bGV0IGNvbG9yQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvcjtcblx0XHR0aGlzLl9jb2xvcnMgPSBjb2xvcnM7XG5cdFx0Y29sb3JBdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fY29sb3JzKTtcblxuICAgICAgICB0aGlzLnNldEFsbFZlcnRpY2VzVG9Db2xvcih0aGlzLmNvbG9yKTtcblxuXHRcdHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblx0XHRjb2xvckF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope1xuXHRcdGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcblx0XHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTtcdFxuXHRcdH1cblxuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblxuXHRcdC8vYXNzZXJ0IGkgPCB2ZXJ0aWNlcy5jb3VudFxuXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5fY3VycmVudFBvaW50SW5kZXgqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcblxuXHQgICAgdGhpcy5fdmVydGljZXNbaW5kZXhdICAgPSB4ID09PSB1bmRlZmluZWQgPyAwIDogeDtcblx0XHR0aGlzLl92ZXJ0aWNlc1tpbmRleCsxXSA9IHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuXHRcdHRoaXMuX3ZlcnRpY2VzW2luZGV4KzJdID0geiA9PT0gdW5kZWZpbmVkID8gMCA6IHo7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXG5cdFx0Lyogd2UncmUgZHJhd2luZyBsaWtlIHRoaXM6XG5cdFx0Ki0tLS0qLS0tLSpcblxuICAgICAgICAqLS0tLSotLS0tKlxuXHRcblx0XHRidXQgd2UgZG9uJ3Qgd2FudCB0byBpbnNlcnQgYSBkaWFnb25hbCBsaW5lIGFueXdoZXJlLiBUaGlzIGhhbmRsZXMgdGhhdDogICovXG5cblx0XHRsZXQgZmlyc3RDb29yZGluYXRlID0gaSAlIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG5cblx0XHRpZighKGZpcnN0Q29vcmRpbmF0ZSA9PSAwIHx8IGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpKXtcblx0XHRcdHRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnNdICAgPSB4ID09PSB1bmRlZmluZWQgPyAwIDogeDtcblx0XHRcdHRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMrMV0gPSB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcblx0XHRcdHRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMrMl0gPSB6ID09PSB1bmRlZmluZWQgPyAwIDogejtcblx0XHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4Kys7XG5cdFx0fVxuXG5cdFx0Ly92ZXJ0aWNlcyBzaG91bGQgcmVhbGx5IGJlIGFuIHVuaWZvcm0sIHRob3VnaC5cblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy9yZXNldCBhZnRlciBlYWNoIHVwZGF0ZVxuXHR9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLm1lc2gpO1xuICAgIH1cbiAgICBzZXRBbGxWZXJ0aWNlc1RvQ29sb3IoY29sb3Ipe1xuICAgICAgICBjb25zdCBjb2wgPSBuZXcgVEhSRUUuQ29sb3IoY29sb3IpO1xuICAgICAgICBjb25zdCBudW1WZXJ0aWNlcyA9ICh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbi0xKSoyO1xuICAgICAgICBmb3IobGV0IGk9MDsgaTxudW1WZXJ0aWNlcztpKyspe1xuICAgICAgICAgICAgLy9Eb24ndCBmb3JnZXQgc29tZSBwb2ludHMgYXBwZWFyIHR3aWNlIC0gYXMgdGhlIGVuZCBvZiBvbmUgbGluZSBzZWdtZW50IGFuZCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBuZXh0LlxuICAgICAgICAgICAgdGhpcy5fc2V0Q29sb3JGb3JWZXJ0ZXhSR0IoaSwgY29sLnIsIGNvbC5nLCBjb2wuYik7XG4gICAgICAgIH1cbiAgICAgICAgLy90ZWxsIHRocmVlLmpzIHRvIHVwZGF0ZSBjb2xvcnNcbiAgICB9XG4gICAgX3NldENvbG9yRm9yVmVydGV4KHZlcnRleEluZGV4LCBjb2xvcil7XG4gICAgICAgIC8vY29sb3IgaXMgYSBUSFJFRS5Db2xvciBoZXJlXG5cdFx0dGhpcy5fc2V0Q29sb3JGb3JWZXJ0ZXhSR0IodmVydGV4SW5kZXgsIGNvbG9yLnIsIGNvbG9yLmcsIGNvbG9yLmIpO1xuICAgIH1cbiAgICBfc2V0Q29sb3JGb3JWZXJ0ZXhSR0IodmVydGV4SW5kZXgsIG5vcm1hbGl6ZWRSLCBub3JtYWxpemVkRywgbm9ybWFsaXplZEIpe1xuICAgICAgICAvL2FsbCBvZiBub3JtYWxpemVkUiwgbm9ybWFsaXplZEcsIG5vcm1hbGl6ZWRCIGFyZSAwLTEuXG5cdFx0bGV0IGNvbG9yQXJyYXkgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLmNvbG9yLmFycmF5O1xuICAgICAgICBjb2xvckFycmF5W3ZlcnRleEluZGV4KjMgKyAwXSA9IG5vcm1hbGl6ZWRSO1xuICAgICAgICBjb2xvckFycmF5W3ZlcnRleEluZGV4KjMgKyAxXSA9IG5vcm1hbGl6ZWRHO1xuICAgICAgICBjb2xvckFycmF5W3ZlcnRleEluZGV4KjMgKyAyXSA9IG5vcm1hbGl6ZWRCO1xuXG5cdFx0bGV0IGNvbG9yQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5jb2xvcjtcblx0XHRjb2xvckF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgfVxuXHRzZXQgY29sb3IoY29sb3Ipe1xuXHRcdC8vY3VycmVudGx5IG9ubHkgYSBzaW5nbGUgY29sb3IgaXMgc3VwcG9ydGVkLlxuXHRcdC8vSSBzaG91bGQgcmVhbGx5IG1ha2UgaXQgcG9zc2libGUgdG8gc3BlY2lmeSBjb2xvciBieSBhIGZ1bmN0aW9uLlxuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG4gICAgICAgIHRoaXMuc2V0QWxsVmVydGljZXNUb0NvbG9yKGNvbG9yKTtcblx0fVxuXHRnZXQgY29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3I7XG5cdH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0dGhpcy5tYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcblx0XHR0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG5cdFx0dGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRzZXQgd2lkdGgod2lkdGgpe1xuXHRcdHRoaXMuX3dpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5tYXRlcmlhbC5saW5ld2lkdGggPSB3aWR0aDtcblx0fVxuXHRnZXQgd2lkdGgoKXtcblx0XHRyZXR1cm4gdGhpcy5fd2lkdGg7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IExpbmVPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuZXhwb3J0IHtMaW5lT3V0cHV0fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmNsYXNzIFBvaW50T3V0cHV0IGV4dGVuZHMgT3V0cHV0Tm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcblx0XHRzdXBlcigpO1xuXHRcdC8qXG5cdFx0XHR3aWR0aDogbnVtYmVyXG5cdFx0XHRjb2xvcjogaGV4IGNvbG9yLCBhcyBpbiAweHJyZ2diYi4gVGVjaG5pY2FsbHksIHRoaXMgaXMgYSBKUyBpbnRlZ2VyLlxuXHRcdFx0b3BhY2l0eTogMC0xLiBPcHRpb25hbC5cblx0XHQqL1xuXG5cdFx0dGhpcy5fd2lkdGggPSBvcHRpb25zLndpZHRoICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLndpZHRoIDogMTtcblx0XHR0aGlzLl9jb2xvciA9IG9wdGlvbnMuY29sb3IgIT09IHVuZGVmaW5lZCA/IG5ldyBUSFJFRS5Db2xvcihvcHRpb25zLmNvbG9yKSA6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSk7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcblxuXHRcdHRoaXMucG9pbnRzID0gW107XG5cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7Y29sb3I6IHRoaXMuX2NvbG9yfSk7XG4gICAgICAgIHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vdHJpZ2dlciBzZXR0ZXIgdG8gc2V0IHRoaXMubWF0ZXJpYWwncyBvcGFjaXR5IHByb3Blcmx5XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IDA7IC8vc2hvdWxkIGFsd2F5cyBiZSBlcXVhbCB0byB0aGlzLnBvaW50cy5sZW5ndGhcblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cdH1cblx0X29uQWRkKCl7IC8vc2hvdWxkIGJlIGNhbGxlZCB3aGVuIHRoaXMgaXMgLmFkZCgpZWQgdG8gc29tZXRoaW5nXG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIEFyZWFcblx0XHRsZXQgcm9vdCA9IHRoaXMuZ2V0Q2xvc2VzdERvbWFpbigpO1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblxuXHRcdGlmKHRoaXMucG9pbnRzLmxlbmd0aCA8IHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uKXtcblx0XHRcdGZvcih2YXIgaT10aGlzLnBvaW50cy5sZW5ndGg7aTx0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbjtpKyspe1xuXHRcdFx0XHR0aGlzLnBvaW50cy5wdXNoKG5ldyBQb2ludE1lc2goe3dpZHRoOiAxLG1hdGVyaWFsOnRoaXMubWF0ZXJpYWx9KSk7XG5cdFx0XHRcdHRoaXMucG9pbnRzW2ldLm1lc2guc2NhbGUuc2V0U2NhbGFyKHRoaXMuX3dpZHRoKTsgLy9zZXQgd2lkdGggYnkgc2NhbGluZyBwb2ludFxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcblx0XHRpZih0aGlzLnBvaW50cy5sZW5ndGggPCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbil0aGlzLl9vbkFkZCgpO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHRpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7XHRcblx0XHR9XG5cdFx0Ly9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuXHRcdHZhciBwb2ludCA9IHRoaXMuZ2V0UG9pbnQoaSk7XG5cdFx0cG9pbnQueCA9IHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuXHRcdHBvaW50LnkgPSB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcblx0XHRwb2ludC56ID0geiA9PT0gdW5kZWZpbmVkID8gMCA6IHo7XG5cdH1cblx0Z2V0UG9pbnQoaSl7XG5cdFx0cmV0dXJuIHRoaXMucG9pbnRzW2ldO1xuXHR9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5wb2ludHMubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLnBvaW50c1tpXS5yZW1vdmVTZWxmRnJvbVNjZW5lKCk7XG5cdFx0fVxuICAgIH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0Ly90ZWNobmljYWxseSB0aGlzIHNldHMgYWxsIHBvaW50cyB0byB0aGUgc2FtZSBjb2xvci4gVG9kbzogYWxsb3cgZGlmZmVyZW50IHBvaW50cyB0byBiZSBkaWZmZXJlbnRseSBjb2xvcmVkLlxuXHRcdFxuXHRcdGxldCBtYXQgPSB0aGlzLm1hdGVyaWFsO1xuXHRcdG1hdC5vcGFjaXR5ID0gb3BhY2l0eTsgLy9pbnN0YW50aWF0ZSB0aGUgcG9pbnRcblx0XHRtYXQudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMTtcbiAgICAgICAgbWF0LnZpc2libGUgPSBvcGFjaXR5ID4gMDtcblx0XHR0aGlzLl9vcGFjaXR5ID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdHNldCBjb2xvcihjb2xvcil7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwuY29sb3IgPSBjb2xvcjtcblx0XHR0aGlzLl9jb2xvciA9IGNvbG9yO1xuXHR9XG5cdGdldCBjb2xvcigpe1xuXHRcdHJldHVybiB0aGlzLl9jb2xvcjtcblx0fVxuXHRzZXQgd2lkdGgod2lkdGgpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5wb2ludHMubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmdldFBvaW50KGkpLm1lc2guc2NhbGUuc2V0U2NhbGFyKHdpZHRoKTtcblx0XHR9XG5cdFx0dGhpcy5fd2lkdGggPSB3aWR0aDtcblx0fVxuXHRnZXQgd2lkdGgoKXtcblx0XHRyZXR1cm4gdGhpcy5fd2lkdGg7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IFBvaW50T3V0cHV0KHt3aWR0aDogdGhpcy53aWR0aCwgY29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eX0pO1xuXHR9XG59XG5cblxuY2xhc3MgUG9pbnRNZXNoe1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHQvKm9wdGlvbnM6XG5cdFx0XHR4LHk6IG51bWJlcnNcblx0XHRcdHdpZHRoOiBudW1iZXJcbiAgICAgICAgICAgIG1hdGVyaWFsOiBcblx0XHQqL1xuXG5cdFx0bGV0IHdpZHRoID0gb3B0aW9ucy53aWR0aCA9PT0gdW5kZWZpbmVkID8gMSA6IG9wdGlvbnMud2lkdGhcbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG9wdGlvbnMubWF0ZXJpYWw7IC8vb25lIG1hdGVyaWFsIHBlciBQb2ludE91dHB1dFxuXG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5zaGFyZWRDaXJjbGVHZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi5zZXQodGhpcy54LHRoaXMueSx0aGlzLnopO1xuXHRcdHRoaXMubWVzaC5zY2FsZS5zZXRTY2FsYXIodGhpcy53aWR0aC8yKTtcblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXG5cdFx0dGhpcy54ID0gb3B0aW9ucy54IHx8IDA7XG5cdFx0dGhpcy55ID0gb3B0aW9ucy55IHx8IDA7XG5cdFx0dGhpcy56ID0gb3B0aW9ucy56IHx8IDA7XG5cdH1cblx0cmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuXHRcdHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG5cdH1cblx0c2V0IHgoaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnggPSBpO1xuXHR9XG5cdHNldCB5KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi55ID0gaTtcblx0fVxuXHRzZXQgeihpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueiA9IGk7XG5cdH1cblx0Z2V0IHgoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLng7XG5cdH1cblx0Z2V0IHkoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLnk7XG5cdH1cblx0Z2V0IHooKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLno7XG5cdH1cbn1cblBvaW50TWVzaC5wcm90b3R5cGUuc2hhcmVkQ2lyY2xlR2VvbWV0cnkgPSBuZXcgVEhSRUUuU3BoZXJlR2VvbWV0cnkoMS8yLCA4LCA2KTsgLy9yYWRpdXMgMS8yIG1ha2VzIGRpYW1ldGVyIDEsIHNvIHRoYXQgc2NhbGluZyBieSBuIG1lYW5zIHdpZHRoPW5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RQb2ludCgpe1xuXHR2YXIgeCA9IG5ldyBFWFAuQXJlYSh7Ym91bmRzOiBbWy0xMCwxMF1dfSk7XG5cdHZhciB5ID0gbmV3IEVYUC5UcmFuc2Zvcm1hdGlvbih7J2V4cHInOiAoeCkgPT4geCp4fSk7XG5cdHZhciB5ID0gbmV3IEVYUC5Qb2ludE91dHB1dCgpO1xuXHR4LmFkZCh5KTtcblx0eS5hZGQoeik7XG5cdHguYWN0aXZhdGUoKTtcbn1cblxuZXhwb3J0IHtQb2ludE91dHB1dCwgUG9pbnRNZXNofVxuIiwiaW1wb3J0IHsgTGluZU91dHB1dCB9IGZyb20gJy4vTGluZU91dHB1dC5qcyc7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gJy4uL3V0aWxzLmpzJztcbmltcG9ydCB7IHRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxuZXhwb3J0IGNsYXNzIFZlY3Rvck91dHB1dCBleHRlbmRzIExpbmVPdXRwdXR7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0LyppbnB1dDogVHJhbnNmb3JtYXRpb25cblx0XHRcdHdpZHRoOiBudW1iZXJcblx0XHQqL1xuXHRcdHN1cGVyKG9wdGlvbnMpO1xuXG5cdH1cblx0aW5pdCgpe1xuXHRcdHRoaXMuX2dlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCk7XG5cdFx0dGhpcy5fdmVydGljZXM7XG5cdFx0dGhpcy5hcnJvd2hlYWRzID0gW107XG5cblxuXHRcdHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe3ZlcnRleENvbG9yczogVEhSRUUuVmVydGV4Q29sb3JzLCBsaW5ld2lkdGg6IHRoaXMuX3dpZHRoLCBvcGFjaXR5OnRoaXMuX29wYWNpdHl9KTtcbiAgICAgICAgLy9UT0RPOiBtYWtlIHRoZSBhcnJvdyB0aXAgY29sb3JzIG1hdGNoIHRoZSBjb2xvcnMgb2YgdGhlIGxpbmVzJyB0aXBzXG5cdFx0dGhpcy5hcnJvd01hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtjb2xvcjogdGhpcy5fY29sb3IsIGxpbmV3aWR0aDogdGhpcy5fd2lkdGgsIG9wYWNpdHk6dGhpcy5fb3BhY2l0eX0pO1xuXHRcdHRoaXMubGluZU1lc2ggPSBuZXcgVEhSRUUuTGluZVNlZ21lbnRzKHRoaXMuX2dlb21ldHJ5LHRoaXMubWF0ZXJpYWwpO1xuXG5cdFx0dGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy8gc2V0dGVyIHNldHMgdHJhbnNwYXJlbnQgZmxhZyBpZiBuZWNlc3NhcnlcblxuXG5cdFx0Y29uc3QgY2lyY2xlUmVzb2x1dGlvbiA9IDEyO1xuXHRcdGNvbnN0IGFycm93aGVhZFNpemUgPSAwLjM7XG5cdFx0Y29uc3QgRVBTSUxPTiA9IDAuMDAwMDE7XG5cdFx0dGhpcy5FUFNJTE9OID0gRVBTSUxPTjtcblxuXHRcdHRoaXMuY29uZUdlb21ldHJ5ID0gbmV3IFRIUkVFLkN5bGluZGVyQnVmZmVyR2VvbWV0cnkoIDAsIGFycm93aGVhZFNpemUsIGFycm93aGVhZFNpemUqMS43LCBjaXJjbGVSZXNvbHV0aW9uLCAxICk7XG5cdFx0bGV0IGFycm93aGVhZE92ZXJzaG9vdEZhY3RvciA9IDAuMTsgLy91c2VkIHNvIHRoYXQgdGhlIGxpbmUgd29uJ3QgcnVkZWx5IGNsaXAgdGhyb3VnaCB0aGUgcG9pbnQgb2YgdGhlIGFycm93aGVhZFxuXG5cdFx0dGhpcy5jb25lR2VvbWV0cnkudHJhbnNsYXRlKCAwLCAtIGFycm93aGVhZFNpemUgKyBhcnJvd2hlYWRPdmVyc2hvb3RGYWN0b3IsIDAgKTtcblxuXHRcdHRoaXMuX2NvbmVVcERpcmVjdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsMSwwKTtcblxuXHRcdHRoaXMubWFrZUdlb21ldHJ5KCk7XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbmV3IFRIUkVFLk9iamVjdDNEKCk7XG4gICAgICAgIHRoaXMubWVzaC5hZGQodGhpcy5saW5lTWVzaCk7XG5cblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXHR9XG5cdF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuXHRcdHN1cGVyLl9vbkZpcnN0QWN0aXZhdGlvbigpO1xuXG5cdFx0aWYodGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGggPiAxKXtcblx0XHRcdHRoaXMubnVtQXJyb3doZWFkcyA9IHRoaXMuaXRlbURpbWVuc2lvbnMuc2xpY2UoMCx0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xKS5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VycmVudCl7XG5cdFx0XHRcdHJldHVybiBjdXJyZW50ICsgcHJldjtcblx0XHRcdH0pO1xuXHRcdH1lbHNle1xuXHRcdFx0Ly9hc3N1bWVkIGl0ZW1EaW1lbnNpb25zIGlzbid0IGEgbm9uemVybyBhcnJheS4gVGhhdCBzaG91bGQgYmUgdGhlIGNvbnN0cnVjdG9yJ3MgcHJvYmxlbS5cblx0XHRcdHRoaXMubnVtQXJyb3doZWFkcyA9IDE7XG5cdFx0fVxuXG5cdFx0Ly9yZW1vdmUgYW55IHByZXZpb3VzIGFycm93aGVhZHNcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuYXJyb3doZWFkcy5sZW5ndGg7aSsrKXtcblx0XHRcdGxldCBhcnJvdyA9IHRoaXMuYXJyb3doZWFkc1tpXTtcblx0XHRcdHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKGFycm93KTtcblx0XHR9XG5cblx0XHR0aGlzLmFycm93aGVhZHMgPSBuZXcgQXJyYXkodGhpcy5udW1BcnJvd2hlYWRzKTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtQXJyb3doZWFkcztpKyspe1xuXHRcdFx0dGhpcy5hcnJvd2hlYWRzW2ldID0gbmV3IFRIUkVFLk1lc2godGhpcy5jb25lR2VvbWV0cnksIHRoaXMuYXJyb3dNYXRlcmlhbCk7XG4gICAgICAgICAgICB0aGlzLm1lc2guYWRkKHRoaXMuYXJyb3doZWFkc1tpXSk7XG5cdFx0fVxuXHRcdGNvbnNvbGUubG9nKFwibnVtYmVyIG9mIGFycm93aGVhZHMgKD0gbnVtYmVyIG9mIGxpbmVzKTpcIisgdGhpcy5udW1BcnJvd2hlYWRzKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0Ly9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuXHRcdGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcblx0XHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTtcdFxuXHRcdH1cblxuXHRcdC8vYXNzZXJ0IGkgPCB2ZXJ0aWNlcy5jb3VudFxuXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5fY3VycmVudFBvaW50SW5kZXgqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcblxuXHQgICAgdGhpcy5fdmVydGljZXNbaW5kZXhdICAgPSB4ID09PSB1bmRlZmluZWQgPyAwIDogeDtcblx0XHR0aGlzLl92ZXJ0aWNlc1tpbmRleCsxXSA9IHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuXHRcdHRoaXMuX3ZlcnRpY2VzW2luZGV4KzJdID0geiA9PT0gdW5kZWZpbmVkID8gMCA6IHo7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXG5cdFx0Lyogd2UncmUgZHJhd2luZyBsaWtlIHRoaXM6XG5cdFx0Ki0tLS0qLS0tLSpcblxuICAgICAgICAqLS0tLSotLS0tKlxuXHRcblx0XHRidXQgd2UgZG9uJ3Qgd2FudCB0byBpbnNlcnQgYSBkaWFnb25hbCBsaW5lIGFueXdoZXJlLiBUaGlzIGhhbmRsZXMgdGhhdDogICovXG5cblx0XHRsZXQgZmlyc3RDb29yZGluYXRlID0gaSAlIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG5cblx0XHQvL3ZlcnRpY2VzIHNob3VsZCByZWFsbHkgYmUgYW4gdW5pZm9ybSwgdGhvdWdoLlxuXHRcdGlmKCEoZmlyc3RDb29yZGluYXRlID09IDAgfHwgZmlyc3RDb29yZGluYXRlID09IHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0tMSkpe1xuXHRcdFx0dGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9uc10gICA9IHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuXHRcdFx0dGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysxXSA9IHkgPT09IHVuZGVmaW5lZCA/IDAgOiB5O1xuXHRcdFx0dGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysyXSA9IHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXHRcdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblx0XHR9XG5cblx0XHRpZihmaXJzdENvb3JkaW5hdGUgPT0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xKXtcblxuXHRcdFx0Ly9jYWxjdWxhdGUgZGlyZWN0aW9uIG9mIGxhc3QgbGluZSBzZWdtZW50XG5cdFx0XHRsZXQgZHggPSB0aGlzLl92ZXJ0aWNlc1tpbmRleC10aGlzLl9vdXRwdXREaW1lbnNpb25zXSAtIHRoaXMuX3ZlcnRpY2VzW2luZGV4XVxuXHRcdFx0bGV0IGR5ID0gdGhpcy5fdmVydGljZXNbaW5kZXgtdGhpcy5fb3V0cHV0RGltZW5zaW9ucysxXSAtIHRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdXG5cdFx0XHRsZXQgZHogPSB0aGlzLl92ZXJ0aWNlc1tpbmRleC10aGlzLl9vdXRwdXREaW1lbnNpb25zKzJdIC0gdGhpcy5fdmVydGljZXNbaW5kZXgrMl1cblxuXHRcdFx0bGV0IGxpbmVOdW1iZXIgPSBNYXRoLmZsb29yKGkgLyB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdKTtcblx0XHRcdFV0aWxzLmFzc2VydChsaW5lTnVtYmVyIDw9IHRoaXMubnVtQXJyb3doZWFkcyk7IC8vdGhpcyBtYXkgYmUgd3JvbmdcblxuXHRcdFx0bGV0IGRpcmVjdGlvblZlY3RvciA9IG5ldyBUSFJFRS5WZWN0b3IzKC1keCwtZHksLWR6KVxuXG5cdFx0XHQvL01ha2UgYXJyb3dzIGRpc2FwcGVhciBpZiB0aGUgbGluZSBpcyBzbWFsbCBlbm91Z2hcblx0XHRcdC8vT25lIHdheSB0byBkbyB0aGlzIHdvdWxkIGJlIHRvIHN1bSB0aGUgZGlzdGFuY2VzIG9mIGFsbCBsaW5lIHNlZ21lbnRzLiBJJ20gY2hlYXRpbmcgaGVyZSBhbmQganVzdCBtZWFzdXJpbmcgdGhlIGRpc3RhbmNlIG9mIHRoZSBsYXN0IHZlY3RvciwgdGhlbiBtdWx0aXBseWluZyBieSB0aGUgbnVtYmVyIG9mIGxpbmUgc2VnbWVudHMgKG5haXZlbHkgYXNzdW1pbmcgYWxsIGxpbmUgc2VnbWVudHMgYXJlIHRoZSBzYW1lIGxlbmd0aClcblx0XHRcdGxldCBsZW5ndGggPSBkaXJlY3Rpb25WZWN0b3IubGVuZ3RoKCkgKiAodGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xKVxuXG5cdFx0XHRjb25zdCBlZmZlY3RpdmVEaXN0YW5jZSA9IDM7XG5cblx0XHRcdGxldCBjbGFtcGVkTGVuZ3RoID0gTWF0aC5tYXgoMCwgTWF0aC5taW4obGVuZ3RoL2VmZmVjdGl2ZURpc3RhbmNlLCAxKSkvMVxuXG5cdFx0XHQvL3NocmluayBmdW5jdGlvbiBkZXNpZ25lZCB0byBoYXZlIGEgc3RlZXAgc2xvcGUgY2xvc2UgdG8gMCBidXQgbWVsbG93IG91dCBhdCAwLjUgb3Igc28gaW4gb3JkZXIgdG8gYXZvaWQgdGhlIGxpbmUgd2lkdGggb3ZlcmNvbWluZyB0aGUgYXJyb3doZWFkIHdpZHRoXG5cdFx0XHQvL0luIENocm9tZSwgdGhyZWUuanMgY29tcGxhaW5zIHdoZW5ldmVyIHNvbWV0aGluZyBpcyBzZXQgdG8gMCBzY2FsZS4gQWRkaW5nIGFuIGVwc2lsb24gdGVybSBpcyB1bmZvcnR1bmF0ZSBidXQgbmVjZXNzYXJ5IHRvIGF2b2lkIGNvbnNvbGUgc3BhbS5cblx0XHRcdFxuXHRcdFx0dGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnNjYWxlLnNldFNjYWxhcihNYXRoLmFjb3MoMS0yKmNsYW1wZWRMZW5ndGgpL01hdGguUEkgKyB0aGlzLkVQU0lMT04pO1xuXHRcdFx0XG4gXHRcdFx0Ly9wb3NpdGlvbi9yb3RhdGlvbiBjb21lcyBhZnRlciBzaW5jZSAubm9ybWFsaXplKCkgbW9kaWZpZXMgZGlyZWN0aW9uVmVjdG9yIGluIHBsYWNlXG5cdFx0XG5cdFx0XHRsZXQgcG9zID0gdGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnBvc2l0aW9uO1xuXG5cdFx0XHRwb3MueCA9IHggPT09IHVuZGVmaW5lZCA/IDAgOiB4O1xuXHRcdFx0cG9zLnkgPSB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcblx0XHRcdHBvcy56ID0geiA9PT0gdW5kZWZpbmVkID8gMCA6IHo7XG5cblx0XHRcdGlmKGxlbmd0aCA+IDApeyAvL2RpcmVjdGlvblZlY3Rvci5ub3JtYWxpemUoKSBmYWlscyB3aXRoIDAgbGVuZ3RoXG5cdFx0XHRcdHRoaXMuYXJyb3doZWFkc1tsaW5lTnVtYmVyXS5xdWF0ZXJuaW9uLnNldEZyb21Vbml0VmVjdG9ycyh0aGlzLl9jb25lVXBEaXJlY3Rpb24sIGRpcmVjdGlvblZlY3Rvci5ub3JtYWxpemUoKSApO1xuXHRcdFx0fVxuXG5cdFx0fVxuXHR9XG5cblxuXHRzZXQgY29sb3IoY29sb3Ipe1xuXHRcdC8vY3VycmVudGx5IG9ubHkgYSBzaW5nbGUgY29sb3IgaXMgc3VwcG9ydGVkLlxuXHRcdC8vSSBzaG91bGQgcmVhbGx5IG1ha2UgaXQgcG9zc2libGUgdG8gc3BlY2lmeSBjb2xvciBieSBhIGZ1bmN0aW9uLlxuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG4gICAgICAgIHRoaXMuc2V0QWxsVmVydGljZXNUb0NvbG9yKGNvbG9yKTtcbiAgICAgICAgdGhpcy5hcnJvd01hdGVyaWFsLmNvbG9yID0gdGhpcy5fY29sb3I7XG5cdH1cblxuXHRnZXQgY29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3I7XG5cdH1cblxuICAgIHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdHRoaXMuYXJyb3dNYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcblx0XHR0aGlzLmFycm93TWF0ZXJpYWwudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMTtcblx0XHR0aGlzLmFycm93TWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXG5cdFx0dGhpcy5tYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcblx0XHR0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG5cdFx0dGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgfVxuXG5cdGdldCBvcGFjaXR5KCl7XG5cdFx0cmV0dXJuIHRoaXMuX29wYWNpdHk7XG5cdH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG4gICAgICAgIHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bUFycm93aGVhZHM7aSsrKXtcblx0XHRcdHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMuYXJyb3doZWFkc1tpXSk7XG5cdFx0fVxuICAgIH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IFZlY3Rvck91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG5cbiIsIi8vU3VyZmFjZU91dHB1dFNoYWRlcnMuanNcblxuLy9leHBlcmltZW50OiBzaGFkZXJzIHRvIGdldCB0aGUgdHJpYW5nbGUgcHVsc2F0aW5nIVxudmFyIHZTaGFkZXIgPSBbXG5cInZhcnlpbmcgdmVjMyB2Tm9ybWFsO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgdlBvc2l0aW9uO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgdlV2O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IHRpbWU7XCIsXG5cInVuaWZvcm0gdmVjMyBjb2xvcjtcIixcblwidW5pZm9ybSB2ZWMzIHZMaWdodDtcIixcblwidW5pZm9ybSBmbG9hdCBncmlkU3F1YXJlcztcIixcblxuXCJ2b2lkIG1haW4oKSB7XCIsXG5cdFwidlBvc2l0aW9uID0gcG9zaXRpb24ueHl6O1wiLFxuXHRcInZOb3JtYWwgPSBub3JtYWwueHl6O1wiLFxuXHRcInZVdiA9IHV2Lnh5O1wiLFxuXHRcImdsX1Bvc2l0aW9uID0gcHJvamVjdGlvbk1hdHJpeCAqXCIsXG4gICAgICAgICAgICBcIm1vZGVsVmlld01hdHJpeCAqXCIsXG4gICAgICAgICAgICBcInZlYzQocG9zaXRpb24sMS4wKTtcIixcblwifVwiXS5qb2luKFwiXFxuXCIpXG5cbnZhciBmU2hhZGVyID0gW1xuXCJ2YXJ5aW5nIHZlYzMgdk5vcm1hbDtcIixcblwidmFyeWluZyB2ZWMzIHZQb3NpdGlvbjtcIixcblwidmFyeWluZyB2ZWMyIHZVdjtcIixcblwidW5pZm9ybSBmbG9hdCB0aW1lO1wiLFxuXCJ1bmlmb3JtIHZlYzMgY29sb3I7XCIsXG5cInVuaWZvcm0gZmxvYXQgdXNlQ3VzdG9tR3JpZENvbG9yO1wiLFxuXCJ1bmlmb3JtIHZlYzMgZ3JpZENvbG9yO1wiLFxuXCJ1bmlmb3JtIHZlYzMgdkxpZ2h0O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGdyaWRTcXVhcmVzO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGxpbmVXaWR0aDtcIixcblwidW5pZm9ybSBmbG9hdCBzaG93R3JpZDtcIixcblwidW5pZm9ybSBmbG9hdCBzaG93U29saWQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcIixcblxuXHQvL3RoZSBmb2xsb3dpbmcgY29kZSBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS91bmNvbmVkL21hdGhib3gvYmxvYi9lYWViOGUxNWVmMmQwMjUyNzQwYTc0NTA1YTEyZDdhMTA1MWE2MWI2L3NyYy9zaGFkZXJzL2dsc2wvbWVzaC5mcmFnbWVudC5zaGFkZWQuZ2xzbFxuXCJ2ZWMzIG9mZlNwZWN1bGFyKHZlYzMgY29sb3IpIHtcIixcblwiICB2ZWMzIGMgPSAxLjAgLSBjb2xvcjtcIixcblwiICByZXR1cm4gMS4wIC0gYyAqIGM7XCIsXG5cIn1cIixcblxuXCJ2ZWM0IGdldFNoYWRlZENvbG9yKHZlYzQgcmdiYSkgeyBcIixcblwiICB2ZWMzIGNvbG9yID0gcmdiYS54eXo7XCIsXG5cIiAgdmVjMyBjb2xvcjIgPSBvZmZTcGVjdWxhcihyZ2JhLnh5eik7XCIsXG5cblwiICB2ZWMzIG5vcm1hbCA9IG5vcm1hbGl6ZSh2Tm9ybWFsKTtcIixcblwiICB2ZWMzIGxpZ2h0ID0gbm9ybWFsaXplKHZMaWdodCk7XCIsXG5cIiAgdmVjMyBwb3NpdGlvbiA9IG5vcm1hbGl6ZSh2UG9zaXRpb24pO1wiLFxuXG5cIiAgZmxvYXQgc2lkZSAgICA9IGdsX0Zyb250RmFjaW5nID8gLTEuMCA6IDEuMDtcIixcblwiICBmbG9hdCBjb3NpbmUgID0gc2lkZSAqIGRvdChub3JtYWwsIGxpZ2h0KTtcIixcblwiICBmbG9hdCBkaWZmdXNlID0gbWl4KG1heCgwLjAsIGNvc2luZSksIC41ICsgLjUgKiBjb3NpbmUsIC4xKTtcIixcblxuXCIgIGZsb2F0IHJpbUxpZ2h0aW5nID0gbWF4KG1pbigxLjAgLSBzaWRlKmRvdChub3JtYWwsIGxpZ2h0KSwgMS4wKSwwLjApO1wiLFxuXG5cIlx0ZmxvYXQgc3BlY3VsYXIgPSBtYXgoMC4wLCBhYnMoY29zaW5lKSAtIDAuNSk7XCIsIC8vZG91YmxlIHNpZGVkIHNwZWN1bGFyXG5cIiAgIHJldHVybiB2ZWM0KGRpZmZ1c2UqY29sb3IgKyAwLjkqcmltTGlnaHRpbmcqY29sb3IgKyAwLjQqY29sb3IyICogc3BlY3VsYXIsIHJnYmEuYSk7XCIsXG5cIn1cIixcblxuLy8gU21vb3RoIEhTViB0byBSR0IgY29udmVyc2lvbiBmcm9tIGh0dHBzOi8vd3d3LnNoYWRlcnRveS5jb20vdmlldy9Nc1MzV2NcblwidmVjMyBoc3YycmdiX3Ntb290aCggaW4gdmVjMyBjICl7XCIsXG5cIiAgICB2ZWMzIHJnYiA9IGNsYW1wKCBhYnMobW9kKGMueCo2LjArdmVjMygwLjAsNC4wLDIuMCksNi4wKS0zLjApLTEuMCwgMC4wLCAxLjAgKTtcIixcblwiXHRyZ2IgPSByZ2IqcmdiKigzLjAtMi4wKnJnYik7IC8vIGN1YmljIHNtb290aGluZ1x0XCIsXG5cIlx0cmV0dXJuIGMueiAqIG1peCggdmVjMygxLjApLCByZ2IsIGMueSk7XCIsXG5cIn1cIixcblxuLy9Gcm9tIFNhbSBIb2NldmFyOiBodHRwOi8vbG9sZW5naW5lLm5ldC9ibG9nLzIwMTMvMDcvMjcvcmdiLXRvLWhzdi1pbi1nbHNsXG5cInZlYzMgcmdiMmhzdih2ZWMzIGMpe1wiLFxuXCIgICAgdmVjNCBLID0gdmVjNCgwLjAsIC0xLjAgLyAzLjAsIDIuMCAvIDMuMCwgLTEuMCk7XCIsXG5cIiAgICB2ZWM0IHAgPSBtaXgodmVjNChjLmJnLCBLLnd6KSwgdmVjNChjLmdiLCBLLnh5KSwgc3RlcChjLmIsIGMuZykpO1wiLFxuXCIgICAgdmVjNCBxID0gbWl4KHZlYzQocC54eXcsIGMuciksIHZlYzQoYy5yLCBwLnl6eCksIHN0ZXAocC54LCBjLnIpKTtcIixcblxuXCIgICAgZmxvYXQgZCA9IHEueCAtIG1pbihxLncsIHEueSk7XCIsXG5cIiAgICBmbG9hdCBlID0gMS4wZS0xMDtcIixcblwiICAgIHJldHVybiB2ZWMzKGFicyhxLnogKyAocS53IC0gcS55KSAvICg2LjAgKiBkICsgZSkpLCBkIC8gKHEueCArIGUpLCBxLngpO1wiLFxuXCJ9XCIsXG4gLy9jaG9vc2VzIHRoZSBjb2xvciBmb3IgdGhlIGdyaWRsaW5lcyBieSB2YXJ5aW5nIGxpZ2h0bmVzcy4gXG4vL05PVCBjb250aW51b3VzIG9yIGVsc2UgYnkgdGhlIGludGVybWVkaWF0ZSBmdW5jdGlvbiB0aGVvcmVtIHRoZXJlJ2QgYmUgYSBwb2ludCB3aGVyZSB0aGUgZ3JpZGxpbmVzIHdlcmUgdGhlIHNhbWUgY29sb3IgYXMgdGhlIG1hdGVyaWFsLlxuXCJ2ZWMzIGdyaWRMaW5lQ29sb3IodmVjMyBjb2xvcil7XCIsXG5cIiB2ZWMzIGhzdiA9IHJnYjJoc3YoY29sb3IueHl6KTtcIixcblwiIC8vaHN2LnggKz0gMC4xO1wiLFxuXCIgaWYoaHN2LnogPCAwLjgpe2hzdi56ICs9IDAuMjt9ZWxzZXtoc3YueiA9IDAuODUtMC4xKmhzdi56O2hzdi55IC09IDAuMDt9XCIsXG5cIiByZXR1cm4gaHN2MnJnYl9zbW9vdGgoaHN2KTtcIixcblwifVwiLFxuXG5cInZlYzQgcmVuZGVyR3JpZGxpbmVzKHZlYzQgZXhpc3RpbmdDb2xvciwgdmVjMiB1diwgdmVjNCBzb2xpZENvbG9yKSB7XCIsXG5cIiAgdmVjMiBkaXN0VG9FZGdlID0gYWJzKG1vZCh2VXYueHkqZ3JpZFNxdWFyZXMgKyBsaW5lV2lkdGgvMi4wLDEuMCkpO1wiLFxuXCIgIHZlYzMgY2hvc2VuR3JpZExpbmVDb2xvciA9IG1peChncmlkTGluZUNvbG9yKHNvbGlkQ29sb3IueHl6KSwgZ3JpZENvbG9yLCB1c2VDdXN0b21HcmlkQ29sb3IpOyBcIiwgLy91c2UgZWl0aGVyIGdyaWRMaW5lQ29sb3IoKSBvciBvdmVycmlkZSB3aXRoIGN1c3RvbSBncmlkXG5cIiAgdmVjMyBibGVuZGVkR3JpZExpbmUgPSBzaG93U29saWQgKiBjaG9zZW5HcmlkTGluZUNvbG9yICsgKDEuMC1zaG93U29saWQpKnNvbGlkQ29sb3IueHl6O1wiLCAvL2lmIHNob3dTb2xpZCA9MCwgdXNlIHNvbGlkQ29sb3IgYXMgdGhlIGdyaWRsaW5lIGNvbG9yLCBvdGhlcndpc2Ugc2hhZGVcblxuXCIgIGlmKCBkaXN0VG9FZGdlLnggPCBsaW5lV2lkdGggfHwgZGlzdFRvRWRnZS55IDwgbGluZVdpZHRoKXtcIixcblwiICAgIHJldHVybiBtaXgoZXhpc3RpbmdDb2xvciwgdmVjNChibGVuZGVkR3JpZExpbmUsIDEuMCksc2hvd0dyaWQpO1wiLFxuXCIgIH1cIixcblwiICByZXR1cm4gZXhpc3RpbmdDb2xvcjtcIixcblwifVwiLFxuLypcblwidmVjNCBnZXRTaGFkZWRDb2xvck1hdGhib3godmVjNCByZ2JhKSB7IFwiLFxuXCIgIHZlYzMgY29sb3IgPSByZ2JhLnh5ejtcIixcblwiICB2ZWMzIGNvbG9yMiA9IG9mZlNwZWN1bGFyKHJnYmEueHl6KTtcIixcblxuXCIgIHZlYzMgbm9ybWFsID0gbm9ybWFsaXplKHZOb3JtYWwpO1wiLFxuXCIgIHZlYzMgbGlnaHQgPSBub3JtYWxpemUodkxpZ2h0KTtcIixcblwiICB2ZWMzIHBvc2l0aW9uID0gbm9ybWFsaXplKHZQb3NpdGlvbik7XCIsXG5cIiAgZmxvYXQgc2lkZSAgICA9IGdsX0Zyb250RmFjaW5nID8gLTEuMCA6IDEuMDtcIixcblwiICBmbG9hdCBjb3NpbmUgID0gc2lkZSAqIGRvdChub3JtYWwsIGxpZ2h0KTtcIixcblwiICBmbG9hdCBkaWZmdXNlID0gbWl4KG1heCgwLjAsIGNvc2luZSksIC41ICsgLjUgKiBjb3NpbmUsIC4xKTtcIixcblwiICAgdmVjMyAgaGFsZkxpZ2h0ID0gbm9ybWFsaXplKGxpZ2h0ICsgcG9zaXRpb24pO1wiLFxuXCJcdGZsb2F0IGNvc2luZUhhbGYgPSBtYXgoMC4wLCBzaWRlICogZG90KG5vcm1hbCwgaGFsZkxpZ2h0KSk7XCIsXG5cIlx0ZmxvYXQgc3BlY3VsYXIgPSBwb3coY29zaW5lSGFsZiwgMTYuMCk7XCIsXG5cIlx0cmV0dXJuIHZlYzQoY29sb3IgKiAoZGlmZnVzZSAqIC45ICsgLjA1KSAqMC4wICsgIC4yNSAqIGNvbG9yMiAqIHNwZWN1bGFyLCByZ2JhLmEpO1wiLFxuXCJ9XCIsKi9cblxuXCJ2b2lkIG1haW4oKXtcIixcbi8vXCIgIC8vZ2xfRnJhZ0NvbG9yID0gdmVjNCh2Tm9ybWFsLnh5eiwgMS4wKTsgLy8gdmlldyBkZWJ1ZyBub3JtYWxzXCIsXG4vL1wiICAvL2lmKHZOb3JtYWwueCA8IDAuMCl7Z2xfRnJhZ0NvbG9yID0gdmVjNChvZmZTcGVjdWxhcihjb2xvci5yZ2IpLCAxLjApO31lbHNle2dsX0ZyYWdDb2xvciA9IHZlYzQoKGNvbG9yLnJnYiksIDEuMCk7fVwiLCAvL3ZpZXcgc3BlY3VsYXIgYW5kIG5vbi1zcGVjdWxhciBjb2xvcnNcbi8vXCIgIGdsX0ZyYWdDb2xvciA9IHZlYzQobW9kKHZVdi54eSwxLjApLDAuMCwxLjApOyAvL3Nob3cgdXZzXG5cIiAgdmVjNCBzb2xpZENvbG9yID0gdmVjNChjb2xvci5yZ2IsIHNob3dTb2xpZCk7XCIsXG5cIiAgdmVjNCBzb2xpZENvbG9yT3V0ID0gc2hvd1NvbGlkKmdldFNoYWRlZENvbG9yKHNvbGlkQ29sb3IpO1wiLFxuXCIgIHZlYzQgY29sb3JXaXRoR3JpZGxpbmVzID0gcmVuZGVyR3JpZGxpbmVzKHNvbGlkQ29sb3JPdXQsIHZVdi54eSwgc29saWRDb2xvcik7XCIsXG5cIiAgY29sb3JXaXRoR3JpZGxpbmVzLmEgKj0gb3BhY2l0eTtcIixcblwiICBnbF9GcmFnQ29sb3IgPSBjb2xvcldpdGhHcmlkbGluZXM7XCIsXHRcblwifVwiXS5qb2luKFwiXFxuXCIpXG5cbnZhciB1bmlmb3JtcyA9IHtcblx0dGltZToge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMCxcblx0fSxcblx0Y29sb3I6IHtcblx0XHR0eXBlOiAnYycsXG5cdFx0dmFsdWU6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSksXG5cdH0sXG5cdHVzZUN1c3RvbUdyaWRDb2xvcjoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMCxcblx0fSxcblx0Z3JpZENvbG9yOiB7XG5cdFx0dHlwZTogJ2MnLFxuXHRcdHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMHg1NWFhNTUpLFxuXHR9LFxuXHRvcGFjaXR5OiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAwLjEsXG5cdH0sXG5cdHZMaWdodDogeyAvL2xpZ2h0IGRpcmVjdGlvblxuXHRcdHR5cGU6ICd2ZWMzJyxcblx0XHR2YWx1ZTogWzAsMCwxXSxcblx0fSxcblx0Z3JpZFNxdWFyZXM6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDQsXG5cdH0sXG5cdGxpbmVXaWR0aDoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMC4xLFxuXHR9LFxuXHRzaG93R3JpZDoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMS4wLFxuXHR9LFxuXHRzaG93U29saWQ6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCxcblx0fVxufTtcblxuZXhwb3J0IHsgdlNoYWRlciwgZlNoYWRlciwgdW5pZm9ybXMgfTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQge0xpbmVPdXRwdXR9IGZyb20gJy4vTGluZU91dHB1dC5qcyc7XG5pbXBvcnQgeyBnZXRUaHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcyB9IGZyb20gJy4vU3VyZmFjZU91dHB1dFNoYWRlcnMuanMnO1xuXG5jbGFzcyBTdXJmYWNlT3V0cHV0IGV4dGVuZHMgT3V0cHV0Tm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcblx0XHRzdXBlcigpO1xuXHRcdC8qIHNob3VsZCBiZSAuYWRkKCllZCB0byBhIFRyYW5zZm9ybWF0aW9uIHRvIHdvcmtcblx0XHRcdG9wdGlvbnM6XG5cdFx0XHR7XG5cdFx0XHRcdG9wYWNpdHk6IG51bWJlclxuXHRcdFx0XHRjb2xvcjogaGV4IGNvZGUgb3IgVEhSRUUuQ29sb3IoKS4gRGlmZnVzZSBjb2xvciBvZiB0aGlzIHN1cmZhY2UuXG5cdFx0XHRcdGdyaWRDb2xvcjogaGV4IGNvZGUgb3IgVEhSRUUuQ29sb3IoKS4gSWYgc2hvd0dyaWQgaXMgdHJ1ZSwgZ3JpZCBsaW5lcyB3aWxsIGFwcGVhciBvdmVyIHRoaXMgc3VyZmFjZS4gZ3JpZENvbG9yIGRldGVybWluZXMgdGhlaXIgY29sb3IgXG5cdFx0XHRcdHNob3dHcmlkOiBib29sZWFuLiBJZiB0cnVlLCB3aWxsIGRpc3BsYXkgYSBncmlkQ29sb3ItY29sb3JlZCBncmlkIG92ZXIgdGhlIHN1cmZhY2UuIERlZmF1bHQ6IHRydWVcblx0XHRcdFx0c2hvd1NvbGlkOiBib29sZWFuLiBJZiB0cnVlLCB3aWxsIGRpc3BsYXkgYSBzb2xpZCBzdXJmYWNlLiBEZWZhdWx0OiB0cnVlXG5cdFx0XHRcdGdyaWRTcXVhcmVzOiBudW1iZXIgcmVwcmVzZW50aW5nIGhvdyBtYW55IHNxdWFyZXMgcGVyIGRpbWVuc2lvbiB0byB1c2UgaW4gYSByZW5kZXJlZCBncmlkXG5cdFx0XHRcdGdyaWRMaW5lV2lkdGg6IG51bWJlciByZXByZXNlbnRpbmcgaG93IG1hbnkgc3F1YXJlcyBwZXIgZGltZW5zaW9uIHRvIHVzZSBpbiBhIHJlbmRlcmVkIGdyaWRcblx0XHRcdH1cblx0XHQqL1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cblx0XHR0aGlzLl9jb2xvciA9IG9wdGlvbnMuY29sb3IgIT09IHVuZGVmaW5lZCA/IG5ldyBUSFJFRS5Db2xvcihvcHRpb25zLmNvbG9yKSA6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSk7XG5cblx0XHR0aGlzLl9ncmlkQ29sb3IgPSBvcHRpb25zLmdyaWRDb2xvciAhPT0gdW5kZWZpbmVkID8gbmV3IFRIUkVFLkNvbG9yKG9wdGlvbnMuZ3JpZENvbG9yKSA6IG5ldyBUSFJFRS5Db2xvcigweDU1YWE1NSk7XG4gICAgICAgIHRoaXMuX3VzZUN1c3RvbUdyaWRDb2xvciA9IG9wdGlvbnMuZ3JpZENvbG9yICE9PSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLl9ncmlkU3F1YXJlcyA9IG9wdGlvbnMuZ3JpZFNxdWFyZXMgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuZ3JpZFNxdWFyZXMgOiAxNjtcblx0XHR0aGlzLl9zaG93R3JpZCA9IG9wdGlvbnMuc2hvd0dyaWQgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuc2hvd0dyaWQgOiB0cnVlO1xuXHRcdHRoaXMuX3Nob3dTb2xpZCA9IG9wdGlvbnMuc2hvd1NvbGlkICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLnNob3dTb2xpZCA6IHRydWU7XG5cdFx0dGhpcy5fZ3JpZExpbmVXaWR0aCA9IG9wdGlvbnMuZ3JpZExpbmVXaWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5ncmlkTGluZVdpZHRoIDogMC4xNTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMudmVydGljZXMubGVuZ3RoXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBob3cgbWFueSB0aW1lcyB0byBiZSBjYWxsZWQgaW4gZWFjaCBkaXJlY3Rpb25cblx0XHR0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gMzsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT9cblxuXHRcdHRoaXMuaW5pdCgpO1xuXHR9XG5cdGluaXQoKXtcblx0XHR0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXHRcdHRoaXMuX3ZlcnRpY2VzO1xuXHRcdHRoaXMubWFrZUdlb21ldHJ5KCk7XG5cblx0XHQvL21ha2UgYSBkZWVwIGNvcHkgb2YgdGhlIHVuaWZvcm1zIHRlbXBsYXRlXG5cdFx0dGhpcy5fdW5pZm9ybXMgPSB7fTtcblx0XHRmb3IodmFyIHVuaWZvcm1OYW1lIGluIHVuaWZvcm1zKXtcblx0XHRcdHRoaXMuX3VuaWZvcm1zW3VuaWZvcm1OYW1lXSA9IHtcblx0XHRcdFx0dHlwZTogdW5pZm9ybXNbdW5pZm9ybU5hbWVdLnR5cGUsXG5cdFx0XHRcdHZhbHVlOiB1bmlmb3Jtc1t1bmlmb3JtTmFtZV0udmFsdWVcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLlNoYWRlck1hdGVyaWFsKHtcblx0XHRcdHNpZGU6IFRIUkVFLkJhY2tTaWRlLFxuXHRcdFx0dmVydGV4U2hhZGVyOiB2U2hhZGVyLCBcblx0XHRcdGZyYWdtZW50U2hhZGVyOiBmU2hhZGVyLFxuXHRcdFx0dW5pZm9ybXM6IHRoaXMuX3VuaWZvcm1zLFxuXHRcdFx0fSk7XG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cblx0XHR0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvLyBzZXR0ZXIgc2V0cyB0cmFuc3BhcmVudCBmbGFnIGlmIG5lY2Vzc2FyeVxuXHRcdHRoaXMuY29sb3IgPSB0aGlzLl9jb2xvcjsgLy9zZXR0ZXIgc2V0cyBjb2xvciB1bmlmb3JtXG5cdFx0dGhpcy5fdW5pZm9ybXMub3BhY2l0eS52YWx1ZSA9IHRoaXMuX29wYWNpdHk7XG5cdFx0dGhpcy5fdW5pZm9ybXMuZ3JpZFNxdWFyZXMudmFsdWUgPSB0aGlzLl9ncmlkU3F1YXJlcztcblx0XHR0aGlzLl91bmlmb3Jtcy5zaG93R3JpZC52YWx1ZSA9IHRoaXMudG9OdW0odGhpcy5fc2hvd0dyaWQpO1xuXHRcdHRoaXMuX3VuaWZvcm1zLnNob3dTb2xpZC52YWx1ZSA9IHRoaXMudG9OdW0odGhpcy5fc2hvd1NvbGlkKTtcblx0XHR0aGlzLl91bmlmb3Jtcy5saW5lV2lkdGgudmFsdWUgPSB0aGlzLl9ncmlkTGluZVdpZHRoO1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy51c2VDdXN0b21HcmlkQ29sb3IgPSB0aGlzLl91c2VDdXN0b21HcmlkQ29sb3I7XG5cblx0XHRpZighdGhpcy5zaG93U29saWQpdGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IHRydWU7XG5cblx0XHRnZXRUaHJlZUVudmlyb25tZW50KCkuc2NlbmUuYWRkKHRoaXMubWVzaCk7XG5cdH1cbiAgICB0b051bSh4KXtcbiAgICAgICAgaWYoeCA9PSBmYWxzZSlyZXR1cm4gMDtcbiAgICAgICAgaWYoeCA9PSB0cnVlKXJldHVybiAxO1xuICAgICAgICByZXR1cm4geDtcbiAgICB9XG5cdG1ha2VHZW9tZXRyeSgpe1xuXG5cdFx0bGV0IE1BWF9QT0lOVFMgPSAxMDAwMDtcblxuXHRcdHRoaXMuX3ZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheShNQVhfUE9JTlRTICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cdFx0dGhpcy5fbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDMpO1xuXHRcdHRoaXMuX3V2cyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDIpO1xuXG5cdFx0Ly8gYnVpbGQgZ2VvbWV0cnlcblxuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdub3JtYWwnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fbm9ybWFscywgMyApICk7XG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAndXYnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fdXZzLCAyICkgKTtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy91c2VkIGR1cmluZyB1cGRhdGVzIGFzIGEgcG9pbnRlciB0byB0aGUgYnVmZmVyXG5cblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cblx0fVxuXHRfc2V0VVZzKHV2cywgaW5kZXgsIHUsIHYpe1xuXG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG4gICAgICAgIC8vc2V0dXAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gYW5kIHRoaXMuaXRlbURpbWVuc2lvbnMuIHVzZWQgaGVyZSBhZ2FpbiBiZWNhdXNlIGNsb25pbmcgbWVhbnMgdGhlIG9uQWRkKCkgbWlnaHQgYmUgY2FsbGVkIGJlZm9yZSB0aGlzIGlzIGNvbm5lY3RlZCB0byBhIHR5cGUgb2YgZG9tYWluXG5cblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgRG9tYWluTm9kZSB3ZSdyZSByZW5kZXJpbmcgZnJvbVxuXHRcdGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcblxuXHRcdC8vIHBlcmhhcHMgaW5zdGVhZCBvZiBnZW5lcmF0aW5nIGEgd2hvbGUgbmV3IGFycmF5LCB0aGlzIGNhbiByZXVzZSB0aGUgb2xkIG9uZT9cblx0XHRsZXQgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cdFx0bGV0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogMyk7XG5cdFx0bGV0IHV2cyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiAyKTtcblxuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0dGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl92ZXJ0aWNlcyk7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBub3JtYWxzO1xuXHRcdG5vcm1hbEF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9ub3JtYWxzKTtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IHV2QXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy51djtcblxuXG5cdFx0Ly9hc3NlcnQgdGhpcy5pdGVtRGltZW5zaW9uc1swXSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0gPSB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiBhbmQgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9PSAyXG5cdFx0dmFyIGluZGljZXMgPSBbXTtcblxuXHRcdC8vcmVuZGVyZWQgdHJpYW5nbGUgaW5kaWNlc1xuXHRcdC8vZnJvbSB0aHJlZS5qcyBQbGFuZUdlb21ldHJ5LmpzXG5cdFx0bGV0IGJhc2UgPSAwO1xuXHRcdGxldCBpPTAsIGo9MDtcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXS0xO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xO2krKyl7XG5cblx0XHRcdFx0bGV0IGEgPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBiID0gaSArIChqKzEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGMgPSAoaSsxKSsgKGorMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRsZXQgZCA9IChpKzEpKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblxuICAgICAgICBcdFx0aW5kaWNlcy5wdXNoKGEsIGIsIGQpO1xuXHRcdFx0XHRpbmRpY2VzLnB1c2goYiwgYywgZCk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2RvdWJsZSBzaWRlZCByZXZlcnNlIGZhY2VzXG4gICAgICAgIFx0XHRpbmRpY2VzLnB1c2goZCwgYiwgYSk7XG5cdFx0XHRcdGluZGljZXMucHVzaChkLCBjLCBiKTtcblxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vbm9ybWFscyAod2lsbCBiZSBvdmVyd3JpdHRlbiBsYXRlcikgYW5kIHV2c1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtpKyspe1xuXG5cdFx0XHRcdGxldCBwb2ludEluZGV4ID0gaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHQvL3NldCBub3JtYWwgdG8gWzAsMCwxXSBhcyBhIHRlbXBvcmFyeSB2YWx1ZVxuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozXSA9IDA7XG5cdFx0XHRcdG5vcm1hbHNbKHBvaW50SW5kZXgpKjMrMV0gPSAwO1xuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozKzJdID0gMTtcblxuXHRcdFx0XHQvL3V2c1xuXHRcdFx0XHR1dnNbKHBvaW50SW5kZXgpKjJdID0gai8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKTtcblx0XHRcdFx0dXZzWyhwb2ludEluZGV4KSoyKzFdID0gaS8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl91dnMgPSB1dnM7XG5cdFx0dXZBdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdXZzKTtcblx0XHR1dkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHR0aGlzLl9nZW9tZXRyeS5zZXRJbmRleCggaW5kaWNlcyApO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHRpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7XHRcblx0XHR9XG5cblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cblx0XHQvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuXHRcdGxldCBpbmRleCA9IHRoaXMuX2N1cnJlbnRQb2ludEluZGV4KnRoaXMuX291dHB1dERpbWVuc2lvbnM7XG5cblx0ICAgIHRoaXMuX3ZlcnRpY2VzW2luZGV4XSAgID0geCA9PT0gdW5kZWZpbmVkID8gMCA6IHg7XG5cdFx0dGhpcy5fdmVydGljZXNbaW5kZXgrMV0gPSB5ID09PSB1bmRlZmluZWQgPyAwIDogeTtcblx0XHR0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXSA9IHogPT09IHVuZGVmaW5lZCA/IDAgOiB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fcmVjYWxjTm9ybWFscygpO1xuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3Jlc2V0IGFmdGVyIGVhY2ggdXBkYXRlXG5cdH1cblx0X3JlY2FsY05vcm1hbHMoKXtcblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHQvL3JlbmRlcmVkIHRyaWFuZ2xlIGluZGljZXNcblx0XHQvL2Zyb20gdGhyZWUuanMgUGxhbmVHZW9tZXRyeS5qc1xuXHRcdGxldCBub3JtYWxWZWMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdGxldCBwYXJ0aWFsWCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0bGV0IHBhcnRpYWxZID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuXHRcdGxldCBiYXNlID0gMDtcblx0XHRsZXQgbmVnYXRpb25GYWN0b3IgPSAxO1xuXHRcdGxldCBpPTAsIGo9MDtcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtqKyspe1xuXHRcdFx0Zm9yKGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aSsrKXtcblxuXHRcdFx0XHQvL2N1cnJlbnRseSBkb2luZyB0aGUgbm9ybWFsIGZvciB0aGUgcG9pbnQgYXQgaW5kZXggYS5cblx0XHRcdFx0bGV0IGEgPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBiLGM7XG5cblx0XHRcdFx0Ly9UYW5nZW50cyBhcmUgY2FsY3VsYXRlZCB3aXRoIGZpbml0ZSBkaWZmZXJlbmNlcyAtIEZvciAoeCx5KSwgY29tcHV0ZSB0aGUgcGFydGlhbCBkZXJpdmF0aXZlcyB1c2luZyAoeCsxLHkpIGFuZCAoeCx5KzEpIGFuZCBjcm9zcyB0aGVtLiBCdXQgaWYgeW91J3JlIGF0IHRoZWJvcmRlciwgeCsxIGFuZCB5KzEgbWlnaHQgbm90IGV4aXN0LiBTbyBpbiB0aGF0IGNhc2Ugd2UgZ28gYmFja3dhcmRzIGFuZCB1c2UgKHgtMSx5KSBhbmQgKHgseS0xKSBpbnN0ZWFkLlxuXHRcdFx0XHQvL1doZW4gdGhhdCBoYXBwZW5zLCB0aGUgdmVjdG9yIHN1YnRyYWN0aW9uIHdpbGwgc3VidHJhY3QgdGhlIHdyb25nIHdheSwgaW50cm9kdWNpbmcgYSBmYWN0b3Igb2YgLTEgaW50byB0aGUgY3Jvc3MgcHJvZHVjdCB0ZXJtLiBTbyBuZWdhdGlvbkZhY3RvciBrZWVwcyB0cmFjayBvZiB3aGVuIHRoYXQgaGFwcGVucyBhbmQgaXMgbXVsdGlwbGllZCBhZ2FpbiB0byBjYW5jZWwgaXQgb3V0LlxuXHRcdFx0XHRuZWdhdGlvbkZhY3RvciA9IDE7IFxuXG5cdFx0XHRcdC8vYiBpcyB0aGUgaW5kZXggb2YgdGhlIHBvaW50IDEgYXdheSBpbiB0aGUgeSBkaXJlY3Rpb25cblx0XHRcdFx0aWYoaSA8IHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSl7XG5cdFx0XHRcdFx0YiA9IChpKzEpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdC8vZW5kIG9mIHRoZSB5IGF4aXMsIGdvIGJhY2t3YXJkcyBmb3IgdGFuZ2VudHNcblx0XHRcdFx0XHRiID0gKGktMSkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0XHRuZWdhdGlvbkZhY3RvciAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vYyBpcyB0aGUgaW5kZXggb2YgdGhlIHBvaW50IDEgYXdheSBpbiB0aGUgeCBkaXJlY3Rpb25cblx0XHRcdFx0aWYoaiA8IHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSl7XG5cdFx0XHRcdFx0YyA9IGkgKyAoaisxKSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdC8vZW5kIG9mIHRoZSB4IGF4aXMsIGdvIGJhY2t3YXJkcyBmb3IgdGFuZ2VudHNcblx0XHRcdFx0XHRjID0gaSArIChqLTEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0XHRuZWdhdGlvbkZhY3RvciAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vdGhlIHZlY3RvciBiLWEuIFxuXHRcdFx0XHQvL3RoaXMuX3ZlcnRpY2VzIHN0b3JlcyB0aGUgY29tcG9uZW50cyBvZiBlYWNoIHZlY3RvciBpbiBvbmUgYmlnIGZsb2F0MzJhcnJheSwgc28gdGhpcyBwdWxscyB0aGVtIG91dCBhbmQganVzdCBkb2VzIHRoZSBzdWJ0cmFjdGlvbiBudW1lcmljYWxseS4gVGhlIGNvbXBvbmVudHMgb2YgdmVjdG9yICM1MiBhcmUgeDo1MiozKzAseTo1MiozKzEsejo1MiozKzIsIGZvciBleGFtcGxlLlxuXHRcdFx0XHRwYXJ0aWFsWS5zZXQodGhpcy5fdmVydGljZXNbYiozXS10aGlzLl92ZXJ0aWNlc1thKjNdLHRoaXMuX3ZlcnRpY2VzW2IqMysxXS10aGlzLl92ZXJ0aWNlc1thKjMrMV0sdGhpcy5fdmVydGljZXNbYiozKzJdLXRoaXMuX3ZlcnRpY2VzW2EqMysyXSk7XG5cdFx0XHRcdC8vdGhlIHZlY3RvciBjLWEuXG5cdFx0XHRcdHBhcnRpYWxYLnNldCh0aGlzLl92ZXJ0aWNlc1tjKjNdLXRoaXMuX3ZlcnRpY2VzW2EqM10sdGhpcy5fdmVydGljZXNbYyozKzFdLXRoaXMuX3ZlcnRpY2VzW2EqMysxXSx0aGlzLl92ZXJ0aWNlc1tjKjMrMl0tdGhpcy5fdmVydGljZXNbYSozKzJdKTtcblxuXHRcdFx0XHQvL2ItYSBjcm9zcyBjLWFcblx0XHRcdFx0bm9ybWFsVmVjLmNyb3NzVmVjdG9ycyhwYXJ0aWFsWCxwYXJ0aWFsWSkubm9ybWFsaXplKCk7XG5cdFx0XHRcdG5vcm1hbFZlYy5tdWx0aXBseVNjYWxhcihuZWdhdGlvbkZhY3Rvcik7XG5cdFx0XHRcdC8vc2V0IG5vcm1hbFxuXHRcdFx0XHR0aGlzLl9ub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjNdID0gbm9ybWFsVmVjLng7XG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqMysxXSA9IG5vcm1hbFZlYy55O1xuXHRcdFx0XHR0aGlzLl9ub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjMrMl0gPSBub3JtYWxWZWMuejtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gZG9uJ3QgZm9yZ2V0IHRvIG5vcm1hbEF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWUgYWZ0ZXIgY2FsbGluZyB0aGlzIVxuXHR9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLm1lc2gpO1xuICAgIH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseSBtYWtlIHRoaXMgYSBmdW5jdGlvblxuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdFx0dGhpcy5fdW5pZm9ybXMuY29sb3IudmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IoY29sb3IpO1xuXHR9XG5cdGdldCBjb2xvcigpe1xuXHRcdHJldHVybiB0aGlzLl9jb2xvcjtcblx0fVxuXHRzZXQgZ3JpZENvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseSBtYWtlIHRoaXMgYSBmdW5jdGlvblxuXHRcdHRoaXMuX2dyaWRDb2xvciA9IGNvbG9yO1xuXHRcdHRoaXMuX3VuaWZvcm1zLmdyaWRDb2xvci52YWx1ZSA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLnVzZUN1c3RvbUdyaWRDb2xvciA9IDEuMDtcblx0fVxuXHRnZXQgZ3JpZENvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2dyaWRDb2xvcjtcblx0fVxuXHRzZXQgb3BhY2l0eShvcGFjaXR5KXtcblx0XHR0aGlzLm1hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuXHRcdHRoaXMubWF0ZXJpYWwudHJhbnNwYXJlbnQgPSAob3BhY2l0eSA8IDEpIHx8ICghdGhpcy5zaG93U29saWQpO1xuXHRcdHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBTdXJmYWNlT3V0cHV0KHtjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuZXhwb3J0IHtTdXJmYWNlT3V0cHV0fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5cbmNsYXNzIEZsYXRBcnJheU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG4gICAgLy9hbiBvdXRwdXQgd2hpY2ggZmlsbHMgYW4gYXJyYXkgd2l0aCBldmVyeSBjb29yZGluYXRlIHJlY2lldmVkLCBpbiBvcmRlci5cbiAgICAvL0l0J2xsIHJlZ2lzdGVyIFswLDEsMl0sWzMsNCw1XSBhcyBbMCwxLDIsMyw0LDVdLlxuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lypcblx0XHRcdGFycmF5OiBhbiBleGlzdGluZyBhcnJheSwgd2hpY2ggd2lsbCB0aGVuIGJlIG1vZGlmaWVkIGluIHBsYWNlIGV2ZXJ5IHRpbWUgdGhpcyBvdXRwdXQgaXMgYWN0aXZhdGVkXG5cdFx0Ki9cblxuXHRcdHRoaXMuYXJyYXkgPSBvcHRpb25zLmFycmF5O1xuICAgICAgICB0aGlzLl9jdXJyZW50QXJyYXlJbmRleCA9IDA7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIC4uLmNvb3Jkcyl7XG4gICAgICAgIGZvcih2YXIgaj0wO2o8Y29vcmRzLmxlbmd0aDtqKyspeyBcbiAgICAgICAgICAgIC8vSSBkb24ndCBuZWVkIHRvIHdvcnJ5IGFib3V0IG91dC1vZi1ib3VuZHMgZW50cmllcyBiZWNhdXNlIGphdmFzY3JpcHQgYXV0b21hdGljYWxseSBncm93cyBhcnJheXMgaWYgYSBuZXcgaW5kZXggaXMgc2V0LlxuICAgICAgICAgICAgLy9KYXZhc2NyaXB0IG1heSBoYXZlIHNvbWUgZ2FyYmFnZSBkZXNpZ24gY2hvaWNlcywgYnV0IEknbGwgY2xhaW0gdGhhdCBnYXJiYWdlIGZvciBteSBvd24gbmVmYXJpb3VzIGFkdmFudGFnZS5cbiAgICAgICAgICAgIHRoaXMuYXJyYXlbdGhpcy5fY3VycmVudEFycmF5SW5kZXhdID0gY29vcmRzW2pdXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50QXJyYXlJbmRleCsrO1xuICAgICAgICB9XG5cdH1cblx0b25BZnRlckFjdGl2YXRpb24oKXtcbiAgICAgICAgdGhpcy5fY3VycmVudEFycmF5SW5kZXggPSAwO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBGbGF0QXJyYXlPdXRwdXQoe2FycmF5OiBFWFAuTWF0aC5jbG9uZSh0aGlzLmFycmF5KX0pO1xuXHR9XG59XG5cbmV4cG9ydCB7RmxhdEFycmF5T3V0cHV0fTtcbiIsInZhciBleHBsYW5hcmlhbkFycm93U1ZHID0gXCJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBEOTRiV3dnZG1WeWMybHZiajBpTVM0d0lpQmxibU52WkdsdVp6MGlWVlJHTFRnaUlITjBZVzVrWVd4dmJtVTlJbTV2SWo4K0Nqd2hMUzBnUTNKbFlYUmxaQ0IzYVhSb0lFbHVhM05qWVhCbElDaG9kSFJ3T2k4dmQzZDNMbWx1YTNOallYQmxMbTl5Wnk4cElDMHRQZ29LUEhOMlp3b2dJQ0I0Yld4dWN6cGtZejBpYUhSMGNEb3ZMM0IxY213dWIzSm5MMlJqTDJWc1pXMWxiblJ6THpFdU1TOGlDaUFnSUhodGJHNXpPbU5qUFNKb2RIUndPaTh2WTNKbFlYUnBkbVZqYjIxdGIyNXpMbTl5Wnk5dWN5TWlDaUFnSUhodGJHNXpPbkprWmowaWFIUjBjRG92TDNkM2R5NTNNeTV2Y21jdk1UazVPUzh3TWk4eU1pMXlaR1l0YzNsdWRHRjRMVzV6SXlJS0lDQWdlRzFzYm5NNmMzWm5QU0pvZEhSd09pOHZkM2QzTG5jekxtOXlaeTh5TURBd0wzTjJaeUlLSUNBZ2VHMXNibk05SW1oMGRIQTZMeTkzZDNjdWR6TXViM0puTHpJd01EQXZjM1puSWdvZ0lDQjRiV3h1Y3pwNGJHbHVhejBpYUhSMGNEb3ZMM2QzZHk1M015NXZjbWN2TVRrNU9TOTRiR2x1YXlJS0lDQWdlRzFzYm5NNmMyOWthWEJ2WkdrOUltaDBkSEE2THk5emIyUnBjRzlrYVM1emIzVnlZMlZtYjNKblpTNXVaWFF2UkZSRUwzTnZaR2x3YjJScExUQXVaSFJrSWdvZ0lDQjRiV3h1Y3pwcGJtdHpZMkZ3WlQwaWFIUjBjRG92TDNkM2R5NXBibXR6WTJGd1pTNXZjbWN2Ym1GdFpYTndZV05sY3k5cGJtdHpZMkZ3WlNJS0lDQWdkMmxrZEdnOUlqSXdNQ0lLSUNBZ2FHVnBaMmgwUFNJeE16QWlDaUFnSUhacFpYZENiM2c5SWpBZ01DQXlNREFnTVRNd0lnb2dJQ0JwWkQwaWMzWm5NaUlLSUNBZ2RtVnljMmx2YmowaU1TNHhJZ29nSUNCcGJtdHpZMkZ3WlRwMlpYSnphVzl1UFNJd0xqa3hJSEl4TXpjeU5TSUtJQ0FnYzI5a2FYQnZaR2s2Wkc5amJtRnRaVDBpUlhod2JHRnVZWEpwWVc1T1pYaDBRWEp5YjNjdWMzWm5JajRLSUNBOFpHVm1jejRLUEhKaFpHbGhiRWR5WVdScFpXNTBJR2xrUFNKaElpQmplRDBpTlRBd0lpQmplVDBpTmpJM0xqY3hJaUJ5UFNJeU5ESXVNelVpSUdkeVlXUnBaVzUwVkhKaGJuTm1iM0p0UFNKdFlYUnlhWGdvTUNBdU1qazNNRElnTFRNdU9ETTVNU0F0TVM0eE9UTXhaUzA0SURJME1EZ3VNU0E0TXpndU9EVXBJaUJuY21Ga2FXVnVkRlZ1YVhSelBTSjFjMlZ5VTNCaFkyVlBibFZ6WlNJK0NqeHpkRzl3SUhOMGIzQXRZMjlzYjNJOUlpTmlZemN6TVRraUlHOW1abk5sZEQwaU1DSXZQZ284YzNSdmNDQnpkRzl3TFdOdmJHOXlQU0lqWmpCa01qWXpJaUJ2Wm1aelpYUTlJakVpTHo0S1BDOXlZV1JwWVd4SGNtRmthV1Z1ZEQ0S1BDOWtaV1p6UGdvOGJXVjBZV1JoZEdFK0NqeHlaR1k2VWtSR1BnbzhZMk02VjI5eWF5QnlaR1k2WVdKdmRYUTlJaUkrQ2p4a1l6cG1iM0p0WVhRK2FXMWhaMlV2YzNabkszaHRiRHd2WkdNNlptOXliV0YwUGdvOFpHTTZkSGx3WlNCeVpHWTZjbVZ6YjNWeVkyVTlJbWgwZEhBNkx5OXdkWEpzTG05eVp5OWtZeTlrWTIxcGRIbHdaUzlUZEdsc2JFbHRZV2RsSWk4K0NqeGtZenAwYVhSc1pTOCtDand2WTJNNlYyOXlhejRLUEM5eVpHWTZVa1JHUGdvOEwyMWxkR0ZrWVhSaFBnbzhaeUIwY21GdWMyWnZjbTA5SW5SeVlXNXpiR0YwWlNnd0lDMDVNakl1TXpZcElqNEtQSEJoZEdnZ1pEMGliVEU1Tnk0ME55QTVPRGN1TXpaak1DMHlOQzR5T0RFdE9EY3VNall4TFRZeExqY3dPQzA0Tnk0eU5qRXROakV1TnpBNGRqSTVMalk1Tkd3dE1UTXVOVFl6SURBdU16YzVOR010TVRNdU5UWXpJREF1TXpjNU16a3ROakl1TWpBeUlESXVPREkzTVMwM05DNDRNVEVnTnk0NU5qVTNMVEV5TGpZd09TQTFMakV6T0RZdE1Ua3VNekF4SURFMExqWTVOUzB4T1M0ek1ERWdNak11TmpZNUlEQWdPQzQ1TnpNNElETXVPVGN6TlNBeE9DNHhOak1nTVRrdU16QXhJREl6TGpZMk9TQXhOUzR6TWpjZ05TNDFNRFUxSURZeExqSTBPQ0EzTGpVNE5qTWdOelF1T0RFeElEY3VPVFkxTjJ3eE15NDFOak1nTUM0ek56azBkakk1TGpZNU5ITTROeTR5TmpFdE16Y3VOREk0SURnM0xqSTJNUzAyTVM0M01EaDZJaUJtYVd4c1BTSjFjbXdvSTJFcElpQnpkSEp2YTJVOUlpTTNNelUxTTJRaUlITjBjbTlyWlMxM2FXUjBhRDBpTWk0Mk1qZzFJaTgrQ2p4bklIUnlZVzV6Wm05eWJUMGliV0YwY21sNEtEQWdMakkyTWpnMUlDMHVNall5T0RVZ01DQXhOemd1TVRNZ09EWXdMakF4S1NJZ2MzUnliMnRsUFNJak1EQXdJaUJ6ZEhKdmEyVXRkMmxrZEdnOUlqRXdJajRLUEdWc2JHbHdjMlVnWTNnOUlqVTBOeTR4TkNJZ1kzazlJakV5TUM0NU15SWdjbmc5SWpJMUxqY3hOQ0lnY25rOUlqVXhMalF5T1NJZ1ptbHNiRDBpSTJabVppSXZQZ284Wld4c2FYQnpaU0JqZUQwaU5UTTBMak0zSWlCamVUMGlNVEl6TGpVeklpQnllRDBpTVRJdU5qSTNJaUJ5ZVQwaU1qWXVNalkwSWk4K0Nqd3ZaejRLUEdjZ2RISmhibk5tYjNKdFBTSnRZWFJ5YVhnb01DQXRMakkyTWpnMUlDMHVNall5T0RVZ01DQXhOemd1TmpZZ01URXhOQzQzS1NJZ2MzUnliMnRsUFNJak1EQXdJaUJ6ZEhKdmEyVXRkMmxrZEdnOUlqRXdJajRLUEdWc2JHbHdjMlVnWTNnOUlqVTBOeTR4TkNJZ1kzazlJakV5TUM0NU15SWdjbmc5SWpJMUxqY3hOQ0lnY25rOUlqVXhMalF5T1NJZ1ptbHNiRDBpSTJabVppSXZQZ284Wld4c2FYQnpaU0JqZUQwaU5UTTBMak0zSWlCamVUMGlNVEl6TGpVeklpQnllRDBpTVRJdU5qSTNJaUJ5ZVQwaU1qWXVNalkwSWk4K0Nqd3ZaejRLUEM5blBnbzhMM04yWno0S1wiO1xuXG5leHBvcnQgZGVmYXVsdCBleHBsYW5hcmlhbkFycm93U1ZHO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qVGhpcyBjbGFzcyBpcyBzdXBwb3NlZCB0byB0dXJuIGEgc2VyaWVzIG9mXG5kaXIuZGVsYXkoKVxuZGlyLnRyYW5zaXRpb25UbyguLi4pXG5kaXIuZGVsYXkoKVxuZGlyLm5leHRTbGlkZSgpO1xuXG5pbnRvIGEgc2VxdWVuY2UgdGhhdCBvbmx5IGFkdmFuY2VzIHdoZW4gdGhlIHJpZ2h0IGFycm93IGlzIHByZXNzZWQuXG5cbkFueSBkaXZzIHdpdGggdGhlIGV4cC1zbGlkZSBjbGFzcyB3aWxsIGFsc28gYmUgc2hvd24gYW5kIGhpZGRlbiBvbmUgYnkgb25lLlxuXG5BbHNvLFxuXG4qL1xuXG5pbXBvcnQge0FuaW1hdGlvbn0gZnJvbSAnLi9BbmltYXRpb24uanMnO1xuaW1wb3J0IGV4cGxhbmFyaWFuQXJyb3dTVkcgZnJvbSAnLi9EaXJlY3RvckltYWdlQ29uc3RhbnRzLmpzJztcblxuY2xhc3MgRGlyZWN0aW9uQXJyb3d7XG4gICAgY29uc3RydWN0b3IoZmFjZVJpZ2h0KXtcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlID0gbmV3IEltYWdlKCk7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zcmMgPSBleHBsYW5hcmlhbkFycm93U1ZHO1xuXG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5jbGFzc0xpc3QuYWRkKFwiZXhwLWFycm93XCIpO1xuXG4gICAgICAgIGZhY2VSaWdodCA9IGZhY2VSaWdodD09PXVuZGVmaW5lZCA/IHRydWUgOiBmYWNlUmlnaHQ7XG5cbiAgICAgICAgaWYoZmFjZVJpZ2h0KXtcbiAgICAgICAgICAgIHRoaXMuYXJyb3dJbWFnZS5jbGFzc0xpc3QuYWRkKFwiZXhwLWFycm93LXJpZ2h0XCIpXG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3ctbGVmdFwiKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5vbmNsaWNrID0gKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB0aGlzLmhpZGVTZWxmKCk7XG4gICAgICAgICAgICB0aGlzLm9uY2xpY2tDYWxsYmFjaygpO1xuICAgICAgICB9KS5iaW5kKHRoaXMpO1xuXG4gICAgICAgIHRoaXMub25jbGlja0NhbGxiYWNrID0gbnVsbDsgLy8gdG8gYmUgc2V0IGV4dGVybmFsbHlcbiAgICB9XG4gICAgc2hvd1NlbGYoKXtcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnJztcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLnN0eWxlLm9wYWNpdHkgPSAxO1xuICAgICAgICBcbiAgICB9XG4gICAgaGlkZVNlbGYoKXtcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLnN0eWxlLm9wYWNpdHkgPSAwO1xuICAgICAgICB0aGlzLmFycm93SW1hZ2Uuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgICB9XG59XG5cblxuY2xhc3MgTm9uRGVjcmVhc2luZ0RpcmVjdG9ye1xuICAgIC8vVXNpbmcgYSBOb25EZWNyZWFzaW5nRGlyZWN0b3IsIGNyZWF0ZSBIVE1MIGVsZW1lbnRzIHdpdGggdGhlICdleHAtc2xpZGUnIGNsYXNzLlxuICAgIC8vVGhlIGZpcnN0IEhUTUwgZWxlbWVudCB3aXRoIHRoZSAnZXhwLXNsaWRlJyBjbGFzcyB3aWxsIGJlIHNob3duIGZpcnN0LiBXaGVuIHRoZSBuZXh0IHNsaWRlIGJ1dHRvbiBpcyBjbGlja2VkLCB0aGF0IHdpbGwgZmFkZSBvdXQgYW5kIGJlIHJlcGxhY2VkIHdpdGggdGhlIG5leHQgZWxlbWVudCB3aXRoIHRoZSBleHAtc2xpZGUgY2xhc3MsIGluIG9yZGVyIG9mIEhUTUwuXG4gICAgLy9JZiB5b3Ugd2FudCB0byBkaXNwbGF5IG11bHRpcGxlIEhUTUwgZWxlbWVudHMgYXQgdGhlIHNhbWUgdGltZSwgJ2V4cC1zbGlkZS08bj4nIHdpbGwgYWxzbyBiZSBkaXNwbGF5ZWQgd2hlbiB0aGUgcHJlc2VudGF0aW9uIGlzIGN1cnJlbnRseSBvbiBzbGlkZSBudW1iZXIgbi4gRm9yIGV4YW1wbGUsIGV2ZXJ5dGhpbmcgaW4gdGhlIGV4cC1zbGlkZS0xIGNsYXNzIHdpbGwgYmUgdmlzaWJsZSBmcm9tIHRoZSBzdGFydCwgYW5kIHRoZW4gZXhwLXNsaWRlLTIsIGFuZCBzbyBvbi5cbiAgICAvL0Rvbid0IGdpdmUgYW4gZWxlbWVudCBib3RoIHRoZSBleHAtc2xpZGUgYW5kIGV4cC1zbGlkZS1uIGNsYXNzZXMuIFxuXG4gICAgLy8gSSB3YW50IERpcmVjdG9yKCkgdG8gYmUgYWJsZSB0byBiYWNrdHJhY2sgYnkgcHJlc3NpbmcgYmFja3dhcmRzLiBUaGlzIGRvZXNuJ3QgZG8gdGhhdC5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKXtcbiAgICAgICAgdGhpcy5zbGlkZXMgPSBbXTtcbiAgICAgICAgdGhpcy5jdXJyZW50U2xpZGVJbmRleCA9IDA7ICAgICAgICBcbiAgICAgICAgdGhpcy5udW1TbGlkZXMgPSAwO1xuICAgICAgICB0aGlzLm51bUhUTUxTbGlkZXMgPSAwO1xuXG4gICAgICAgIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gbnVsbDtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIFxuXG5cbiAgICBhc3luYyBiZWdpbigpe1xuICAgICAgICBhd2FpdCB0aGlzLndhaXRGb3JQYWdlTG9hZCgpO1xuXG4gICAgICAgIHRoaXMuc2V0dXBBbmRIaWRlQWxsU2xpZGVIVE1MRWxlbWVudHMoKTtcblxuICAgICAgICB0aGlzLnN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgoMCk7IC8vdW5oaWRlIGZpcnN0IG9uZVxuXG4gICAgICAgIHRoaXMuc2V0dXBDbGlja2FibGVzKCk7XG5cbiAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG4gICAgfVxuXG4gICAgc2V0dXBBbmRIaWRlQWxsU2xpZGVIVE1MRWxlbWVudHMoKXtcblxuICAgICAgICB0aGlzLnNsaWRlcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJleHAtc2xpZGVcIik7XG4gICAgICAgIHRoaXMubnVtSFRNTFNsaWRlcyA9IHRoaXMuc2xpZGVzLmxlbmd0aDtcblxuICAgICAgICAvL2hpZGUgYWxsIHNsaWRlcyBleGNlcHQgZmlyc3Qgb25lXG4gICAgICAgIGZvcih2YXIgaT0wO2k8dGhpcy5udW1IVE1MU2xpZGVzO2krKyl7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1tpXS5zdHlsZS5vcGFjaXR5ID0gMDsgXG4gICAgICAgICAgICB0aGlzLnNsaWRlc1tpXS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOy8vb3BhY2l0eT0wIGFsb25lIHdvbid0IGJlIGluc3RhbnQgYmVjYXVzZSBvZiB0aGUgMXMgQ1NTIHRyYW5zaXRpb25cbiAgICAgICAgfVxuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgICAgIC8vdW5kbyBzZXR0aW5nIGRpc3BsYXktbm9uZSBhZnRlciBhIGJpdCBvZiB0aW1lXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBmb3IodmFyIGk9MDtpPHNlbGYuc2xpZGVzLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgICAgIHNlbGYuc2xpZGVzW2ldLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwxKTtcblxuICAgICAgICAvL25vdyBoYW5kbGUgZXhwLXNsaWRlLTxuPlxuICAgICAgICBsZXQgYWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2NsYXNzKj1cImV4cC1zbGlkZS1cIl0nKTsgLy90aGlzIGlzIGEgQ1NTIGF0dHJpYnV0ZSBzZWxlY3RvciwgYW5kIEkgaGF0ZSB0aGF0IHRoaXMgZXhpc3RzLiBpdCdzIHNvIHVnbHlcbiAgICAgICAgZm9yKHZhciBpPTA7aTxhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHMubGVuZ3RoO2krKyl7XG4gICAgICAgICAgICBhbGxTcGVjaWZpY1NsaWRlRWxlbWVudHNbaV0uc3R5bGUub3BhY2l0eSA9IDA7IFxuICAgICAgICAgICAgYWxsU3BlY2lmaWNTbGlkZUVsZW1lbnRzW2ldLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7Ly9vcGFjaXR5PTAgYWxvbmUgd29uJ3QgYmUgaW5zdGFudCBiZWNhdXNlIG9mIHRoZSAxcyBDU1MgdHJhbnNpdGlvblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0dXBDbGlja2FibGVzKCl7XG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cgPSBuZXcgRGlyZWN0aW9uQXJyb3coKTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLnJpZ2h0QXJyb3cuYXJyb3dJbWFnZSk7XG4gICAgICAgIHRoaXMucmlnaHRBcnJvdy5vbmNsaWNrQ2FsbGJhY2sgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgc2VsZi5fY2hhbmdlU2xpZGUoMSwgZnVuY3Rpb24oKXt9KTsgLy8gdGhpcyBlcnJvcnMgd2l0aG91dCB0aGUgZW1wdHkgZnVuY3Rpb24gYmVjYXVzZSB0aGVyZSdzIG5vIHJlc29sdmUuIFRoZXJlIG11c3QgYmUgYSBiZXR0ZXIgd2F5IHRvIGRvIHRoaW5ncy5cbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIldBUk5JTkc6IEhvcnJpYmxlIGhhY2sgaW4gZWZmZWN0IHRvIGNoYW5nZSBzbGlkZXMuIFBsZWFzZSByZXBsYWNlIHRoZSBwYXNzLWFuLWVtcHR5LWZ1bmN0aW9uIHRoaW5nIHdpdGggc29tZXRoaW5nIHRoYXQgYWN0dWFsbHkgcmVzb2x2ZXMgcHJvcGVybHkgYW5kIGRvZXMgYXN5bmMuXCIpXG4gICAgICAgICAgICBzZWxmLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBhc3luYyB3YWl0Rm9yUGFnZUxvYWQoKXtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICBpZihkb2N1bWVudC5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScpe1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLHJlc29sdmUpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgYXN5bmMgbmV4dFNsaWRlKCl7XG4gICAgICAgIGlmKCF0aGlzLmluaXRpYWxpemVkKXRocm93IG5ldyBFcnJvcihcIkVSUk9SOiBVc2UgLmJlZ2luKCkgb24gYSBEaXJlY3RvciBiZWZvcmUgY2FsbGluZyBhbnkgb3RoZXIgbWV0aG9kcyFcIik7XG5cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHRoaXMucmlnaHRBcnJvdy5zaG93U2VsZigpO1xuICAgICAgICAvL3Byb21pc2UgaXMgcmVzb2x2ZWQgYnkgY2FsbGluZyB0aGlzLm5leHRTbGlkZVByb21pc2UucmVzb2x2ZSgpIHdoZW4gdGhlIHRpbWUgY29tZXNcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgIGZ1bmN0aW9uIGtleUxpc3RlbmVyKGUpe1xuICAgICAgICAgICAgICAgIGlmKGUucmVwZWF0KXJldHVybjsgLy9rZXlkb3duIGZpcmVzIG11bHRpcGxlIHRpbWVzIGJ1dCB3ZSBvbmx5IHdhbnQgdGhlIGZpcnN0IG9uZVxuICAgICAgICAgICAgICAgIGxldCBzbGlkZURlbHRhID0gMDtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGUua2V5Q29kZSkge1xuICAgICAgICAgICAgICAgICAgY2FzZSAzNDpcbiAgICAgICAgICAgICAgICAgIGNhc2UgMzk6XG4gICAgICAgICAgICAgICAgICBjYXNlIDQwOlxuICAgICAgICAgICAgICAgICAgICBzbGlkZURlbHRhID0gMTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYoc2xpZGVEZWx0YSAhPSAwKXtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5fY2hhbmdlU2xpZGUoc2xpZGVEZWx0YSwgcmVzb2x2ZSk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYucmlnaHRBcnJvdy5oaWRlU2VsZigpO1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIixrZXlMaXN0ZW5lcik7IC8vdGhpcyBhcHByb2FjaCB0YWtlbiBmcm9tIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM1NzE4NjQ1L3Jlc29sdmluZy1hLXByb21pc2Utd2l0aC1ldmVudGxpc3RlbmVyXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwga2V5TGlzdGVuZXIpO1xuICAgICAgICAgICAgLy9ob3JyaWJsZSBoYWNrIHNvIHRoYXQgdGhlICduZXh0IHNsaWRlJyBhcnJvdyBjYW4gdHJpZ2dlciB0aGlzIHRvb1xuICAgICAgICAgICAgc2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBmdW5jdGlvbigpeyBcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsa2V5TGlzdGVuZXIpOyBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIF9jaGFuZ2VTbGlkZShzbGlkZURlbHRhLCByZXNvbHZlKXtcbiAgICAgICAgLy9zbGlkZSBjaGFuZ2luZyBsb2dpY1xuICAgICAgICBpZihzbGlkZURlbHRhICE9IDApe1xuICAgICAgICAgICAgaWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA9PSAwICYmIHNsaWRlRGVsdGEgPT0gLTEpe1xuICAgICAgICAgICAgICAgIHJldHVybjsgLy9ubyBnb2luZyBwYXN0IHRoZSBiZWdpbm5pbmdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gdGhpcy5udW1IVE1MU2xpZGVzLTEgJiYgc2xpZGVEZWx0YSA9PSAxKXtcbiAgICAgICAgICAgICAgICByZXR1cm47IC8vbm8gZ29pbmcgcGFzdCB0aGUgZW5kXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleCh0aGlzLmN1cnJlbnRTbGlkZUluZGV4ICsgc2xpZGVEZWx0YSk7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzd2l0Y2hEaXNwbGF5ZWRTbGlkZUluZGV4KHNsaWRlTnVtYmVyKXtcbiAgICAgICAgLy91cGRhdGVzIEhUTUwgYW5kIGFsc28gc2V0cyB0aGlzLmN1cnJlbnRTbGlkZUluZGV4IHRvIHNsaWRlTnVtYmVyXG5cbiAgICAgICAgbGV0IHByZXZTbGlkZU51bWJlciA9IHRoaXMuY3VycmVudFNsaWRlSW5kZXg7XG4gICAgICAgIHRoaXMuY3VycmVudFNsaWRlSW5kZXggPSBzbGlkZU51bWJlcjtcblxuXG4gICAgICAgIC8vaGlkZSB0aGUgSFRNTCBlbGVtZW50cyBmb3IgdGhlIHByZXZpb3VzIHNsaWRlXG5cbiAgICAgICAgLy9pdGVtcyB3aXRoIGNsYXNzIGV4cC1zbGlkZVxuICAgICAgICBpZihwcmV2U2xpZGVOdW1iZXIgPCB0aGlzLnNsaWRlcy5sZW5ndGgpe1xuICAgICAgICAgICAgdGhpcy5zbGlkZXNbcHJldlNsaWRlTnVtYmVyXS5zdHlsZS5vcGFjaXR5ID0gMDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy9pdGVtcyB3aXRoIEhUTUwgY2xhc3MgZXhwLXNsaWRlLW5cbiAgICAgICAgbGV0IHByZXZTbGlkZUVsZW1zID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZS1cIisocHJldlNsaWRlTnVtYmVyKzEpKVxuICAgICAgICBmb3IodmFyIGk9MDtpPHByZXZTbGlkZUVsZW1zLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgcHJldlNsaWRlRWxlbXNbaV0uc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vc2hvdyB0aGUgSFRNTCBlbGVtZW50cyBmb3IgdGhlIGN1cnJlbnQgc2xpZGVcbiAgXG4gICAgICAgIFxuICAgICAgICAvL2l0ZW1zIHdpdGggSFRNTCBjbGFzcyBleHAtc2xpZGUtblxuICAgICAgICBsZXQgZWxlbXNUb0Rpc3BsYXlPbmx5T25UaGlzU2xpZGUgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXhwLXNsaWRlLVwiKyhzbGlkZU51bWJlcisxKSk7XG5cbiAgICAgICAgaWYoc2xpZGVOdW1iZXIgPj0gdGhpcy5udW1IVE1MU2xpZGVzICYmIGVsZW1zVG9EaXNwbGF5T25seU9uVGhpc1NsaWRlLmxlbmd0aCA9PSAwKXtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJUcmllZCB0byBzaG93IHNsaWRlICNcIitzbGlkZU51bWJlcitcIiwgYnV0IG9ubHkgXCIgKyB0aGlzLm51bUhUTUxTbGlkZXMgKyBcIkhUTUwgZWxlbWVudHMgd2l0aCBleHAtc2xpZGUgd2VyZSBmb3VuZCEgTWFrZSBtb3JlIHNsaWRlcz9cIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IodmFyIGk9MDtpPGVsZW1zVG9EaXNwbGF5T25seU9uVGhpc1NsaWRlLmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgZWxlbXNUb0Rpc3BsYXlPbmx5T25UaGlzU2xpZGVbaV0uc3R5bGUub3BhY2l0eSA9IDE7XG4gICAgICAgIH1cblxuICAgICAgICAvL2l0ZW1zIHdpdGggY2xhc3MgZXhwLXNsaWRlXG4gICAgICAgIGlmKHNsaWRlTnVtYmVyIDwgdGhpcy5zbGlkZXMubGVuZ3RoKXtcbiAgICAgICAgICAgIHRoaXMuc2xpZGVzW3NsaWRlTnVtYmVyXS5zdHlsZS5vcGFjaXR5ID0gMTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy92ZXJic1xuICAgIGFzeW5jIGRlbGF5KHdhaXRUaW1lKXtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCB3YWl0VGltZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBUcmFuc2l0aW9uVG8odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyl7XG4gICAgICAgIC8vVXRpbHMuQXNzZXJ0KHRoaXMudW5kb1N0YWNrSW5kZXggPT0gMCk7IC8vVGhpcyBtYXkgbm90IHdvcmsgd2VsbC5cbiAgICAgICAgbmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDApO1xuICAgIH1cbn1cblxuXG5cblxuXG5cblxuY2xhc3MgVW5kb0NhcGFibGVEaXJlY3RvciBleHRlbmRzIE5vbkRlY3JlYXNpbmdEaXJlY3RvcntcbiAgICAvL3Roc2kgZGlyZWN0b3IgdXNlcyBib3RoIGZvcndhcmRzIGFuZCBiYWNrd2FyZHMgYXJyb3dzLiB0aGUgYmFja3dhcmRzIGFycm93IHdpbGwgdW5kbyBhbnkgVW5kb0NhcGFibGVEaXJlY3Rvci5UcmFuc2l0aW9uVG8oKXNcbiAgICAvL3RvZG86IGhvb2sgdXAgdGhlIGFycm93cyBhbmQgbWFrZSBpdCBub3RcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKXtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAgICAgdGhpcy5mdXJ0aGVzdFNsaWRlSW5kZXggPSAwOyAvL21hdGNoZXMgdGhlIG51bWJlciBvZiB0aW1lcyBuZXh0U2xpZGUoKSBoYXMgYmVlbiBjYWxsZWRcbiAgICAgICAgLy90aGlzLmN1cnJlbnRTbGlkZUluZGV4IGlzIGFsd2F5cyA8IHRoaXMuZnVydGhlc3RTbGlkZUluZGV4IC0gaWYgZXF1YWwsIHdlIHJlbGVhc2UgdGhlIHByb21pc2UgYW5kIGxldCBuZXh0U2xpZGUoKSByZXR1cm5cblxuICAgICAgICB0aGlzLnVuZG9TdGFjayA9IFtdO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ID0gMDsgLy9pbmNyZWFzZWQgYnkgb25lIGV2ZXJ5IHRpbWUgZWl0aGVyIHRoaXMuVHJhbnNpdGlvblRvIGlzIGNhbGxlZCBvciB0aGlzLm5leHRTbGlkZSgpIGlzIGNhbGxlZFxuXG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICAvL2lmIHlvdSBwcmVzcyByaWdodCBiZWZvcmUgdGhlIGZpcnN0IGRpcmVjdG9yLm5leHRTbGlkZSgpLCBkb24ndCBlcnJvclxuICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IGZ1bmN0aW9uKCl7fSBcblxuICAgICAgICBmdW5jdGlvbiBrZXlMaXN0ZW5lcihlKXtcbiAgICAgICAgICAgIGlmKGUucmVwZWF0KXJldHVybjsgLy9rZXlkb3duIGZpcmVzIG11bHRpcGxlIHRpbWVzIGJ1dCB3ZSBvbmx5IHdhbnQgdGhlIGZpcnN0IG9uZVxuICAgICAgICAgICAgbGV0IHNsaWRlRGVsdGEgPSAwO1xuICAgICAgICAgICAgc3dpdGNoIChlLmtleUNvZGUpIHtcbiAgICAgICAgICAgICAgY2FzZSAzNDpcbiAgICAgICAgICAgICAgY2FzZSAzOTpcbiAgICAgICAgICAgICAgY2FzZSA0MDpcbiAgICAgICAgICAgICAgICBzZWxmLmhhbmRsZUZvcndhcmRzUHJlc3MoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAzMzpcbiAgICAgICAgICAgICAgY2FzZSAzNzpcbiAgICAgICAgICAgICAgY2FzZSAzODpcbiAgICAgICAgICAgICAgICBzZWxmLmhhbmRsZUJhY2t3YXJkc1ByZXNzKCk7XG4gICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwga2V5TGlzdGVuZXIpO1xuICAgIH1cblxuICAgIHNldHVwQ2xpY2thYmxlcygpe1xuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5sZWZ0QXJyb3cgPSBuZXcgRGlyZWN0aW9uQXJyb3coZmFsc2UpO1xuICAgICAgICB0aGlzLmxlZnRBcnJvdy5oaWRlU2VsZigpO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMubGVmdEFycm93LmFycm93SW1hZ2UpO1xuICAgICAgICB0aGlzLmxlZnRBcnJvdy5vbmNsaWNrQ2FsbGJhY2sgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgc2VsZi5oYW5kbGVCYWNrd2FyZHNQcmVzcygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yaWdodEFycm93ID0gbmV3IERpcmVjdGlvbkFycm93KHRydWUpO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMucmlnaHRBcnJvdy5hcnJvd0ltYWdlKTtcbiAgICAgICAgdGhpcy5yaWdodEFycm93Lm9uY2xpY2tDYWxsYmFjayA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBzZWxmLmhhbmRsZUZvcndhcmRzUHJlc3MoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1vdmVGdXJ0aGVySW50b1ByZXNlbnRhdGlvbigpe1xuICAgICAgICAgICAgLy9pZiB0aGVyZSdzIG5vdGhpbmcgdG8gcmVkbywgKHNvIHdlJ3JlIG5vdCBpbiB0aGUgcGFzdCBvZiB0aGUgdW5kbyBzdGFjayksIGFkdmFuY2UgZnVydGhlci5cbiAgICAgICAgICAgIC8vaWYgdGhlcmUgYXJlIGxlc3MgSFRNTCBzbGlkZXMgdGhhbiBjYWxscyB0byBkaXJlY3Rvci5uZXdTbGlkZSgpLCBjb21wbGFpbiBpbiB0aGUgY29uc29sZSBidXQgYWxsb3cgdGhlIHByZXNlbnRhdGlvbiB0byBwcm9jZWVkXG4gICAgICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4IDwgdGhpcy5udW1TbGlkZXMpe1xuICAgICAgICAgICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXggKz0gMTsgLy9hZHZhbmNlIHBhc3QgdGhlIE5ld1NsaWRlVW5kb0l0ZW1cbiAgICAgICAgICAgICAgICB0aGlzLmZ1cnRoZXN0U2xpZGVJbmRleCArPSAxOyBcblxuICAgICAgICAgICAgICAgIHRoaXMuc3dpdGNoRGlzcGxheWVkU2xpZGVJbmRleCh0aGlzLmN1cnJlbnRTbGlkZUluZGV4ICsgMSk7IC8vdGhpcyB3aWxsIGNvbXBsYWluIGluIHRoZSBjb25zb2xlIHdpbmRvdyBpZiB0aGVyZSBhcmUgbGVzcyBzbGlkZXMgdGhhbiBuZXdTbGlkZSgpIGNhbGxzXG4gICAgICAgICAgICAgICAgdGhpcy5zaG93QXJyb3dzKCk7IC8vc2hvd0Fycm93cyBtdXN0IGNvbWUgYWZ0ZXIgdGhpcy5jdXJyZW50U2xpZGVJbmRleCBhZHZhbmNlcyBvciBlbHNlIHdlIHdvbid0IGJlIGFibGUgdG8gdGVsbCBpZiB3ZSdyZSBhdCB0aGUgZW5kIG9yIG5vdFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24oKTsgLy9hbGxvdyBwcmVzZW50YXRpb24gY29kZSB0byBwcm9jZWVkXG4gICAgfVxuXG4gICAgaGFuZGxlRm9yd2FyZHNQcmVzcygpe1xuICAgICAgICB0aGlzLnJpZ2h0QXJyb3cuaGlkZVNlbGYoKTtcblxuICAgICAgICBpZih0aGlzLmZ1cnRoZXN0U2xpZGVJbmRleCA9PSB0aGlzLmN1cnJlbnRTbGlkZUluZGV4KXtcbiAgICAgICAgICAgIC8vaWYgbm90aGluZyB0byByZWRvXG4gICAgICAgICAgICB0aGlzLm1vdmVGdXJ0aGVySW50b1ByZXNlbnRhdGlvbigpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIHdlIGdldCB0byBoZXJlLCB3ZSd2ZSBwcmV2aW91c2x5IGRvbmUgYW4gdW5kbyBhbmQgd2UgbmVlZCB0byBjYXRjaCB1cFxuXG4gICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPCB0aGlzLnVuZG9TdGFjay5sZW5ndGgtMSkgdGhpcy51bmRvU3RhY2tJbmRleCArPSAxO1xuXG4gICAgICAgIHdoaWxlKHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdLmNvbnN0cnVjdG9yICE9PSBOZXdTbGlkZVVuZG9JdGVtKXtcbiAgICAgICAgICAgIC8vbG9vcCB0aHJvdWdoIHVuZG8gc3RhY2sgYW5kIHJlZG8gZWFjaCB1bmRvXG5cbiAgICAgICAgICAgIGxldCByZWRvSXRlbSA9IHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdXG4gICAgICAgICAgICBzd2l0Y2gocmVkb0l0ZW0udHlwZSl7XG4gICAgICAgICAgICAgICAgY2FzZSBERUxBWTpcbiAgICAgICAgICAgICAgICAgICAgLy93aGlsZSByZWRvaW5nLCBza2lwIGFueSBkZWxheXNcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUUkFOU0lUSU9OVE86XG4gICAgICAgICAgICAgICAgICAgIHZhciByZWRvQW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbihyZWRvSXRlbS50YXJnZXQsIHJlZG9JdGVtLnRvVmFsdWVzLCByZWRvSXRlbS5kdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiByZWRvSXRlbS5kdXJhdGlvbk1TLzEwMDApO1xuICAgICAgICAgICAgICAgICAgLy9hbmQgbm93IHJlZG9BbmltYXRpb24sIGhhdmluZyBiZWVuIGNyZWF0ZWQsIGdvZXMgb2ZmIGFuZCBkb2VzIGl0cyBvd24gdGhpbmcgSSBndWVzcy4gdGhpcyBzZWVtcyBpbmVmZmljaWVudC4gdG9kbzogZml4IHRoYXQgYW5kIG1ha2UgdGhlbSBhbGwgY2VudHJhbGx5IHVwZGF0ZWQgYnkgdGhlIGFuaW1hdGlvbiBsb29wIG9yc29tZXRoaW5nXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgTkVXU0xJREU6XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZih0aGlzLnVuZG9TdGFja0luZGV4ID09IHRoaXMudW5kb1N0YWNrLmxlbmd0aC0xKXtcbiAgICAgICAgICAgICAgICAvL2Z1bGx5IHJlZG9uZSBhbmQgYXQgY3VycmVudCBzbGlkZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ICs9IDE7XG5cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgodGhpcy5jdXJyZW50U2xpZGVJbmRleCArIDEpO1xuICAgICAgICB0aGlzLnNob3dBcnJvd3MoKTtcbiAgICB9XG5cbiAgICBoYW5kbGVCYWNrd2FyZHNQcmVzcygpe1xuICAgICAgICB0aGlzLmxlZnRBcnJvdy5oaWRlU2VsZigpO1xuXG4gICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPT0gMCB8fCB0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IDApe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCAtPSAxO1xuICAgICAgICB3aGlsZSh0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XS5jb25zdHJ1Y3RvciAhPT0gTmV3U2xpZGVVbmRvSXRlbSl7XG4gICAgICAgICAgICAvL2xvb3AgdGhyb3VnaCB1bmRvIHN0YWNrIGFuZCByZWRvIGVhY2ggdW5kb1xuXG4gICAgICAgICAgICBpZih0aGlzLnVuZG9TdGFja0luZGV4ID09IDApe1xuICAgICAgICAgICAgICAgIC8vYXQgZmlyc3Qgc2xpZGVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy91bmRvIHRyYW5zZm9ybWF0aW9uIGluIHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdXG4gICAgICAgICAgICBsZXQgdW5kb0l0ZW0gPSB0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XTtcbiAgICAgICAgICAgIHN3aXRjaCh1bmRvSXRlbS50eXBlKXtcbiAgICAgICAgICAgICAgICBjYXNlIERFTEFZOlxuICAgICAgICAgICAgICAgICAgICAvL3doaWxlIHVuZG9pbmcsIHNraXAgYW55IGRlbGF5c1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFRSQU5TSVRJT05UTzpcbiAgICAgICAgICAgICAgICAgICAgbGV0IGR1cmF0aW9uID0gdW5kb0l0ZW0uZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gMSA6IHVuZG9JdGVtLmR1cmF0aW9uTVMvMTAwMDtcbiAgICAgICAgICAgICAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1pbihkdXJhdGlvbiAvIDIsIDEpOyAvL3VuZG9pbmcgc2hvdWxkIGJlIGZhc3Rlciwgc28gY3V0IGl0IGluIGhhbGYgLSBidXQgY2FwIGR1cmF0aW9ucyBhdCAxc1xuICAgICAgICAgICAgICAgICAgICB2YXIgdW5kb0FuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24odW5kb0l0ZW0udGFyZ2V0LCB1bmRvSXRlbS5mcm9tVmFsdWVzLCBkdXJhdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIC8vYW5kIG5vdyB1bmRvQW5pbWF0aW9uLCBoYXZpbmcgYmVlbiBjcmVhdGVkLCBnb2VzIG9mZiBhbmQgZG9lcyBpdHMgb3duIHRoaW5nIEkgZ3Vlc3MuIHRoaXMgc2VlbXMgaW5lZmZpY2llbnQuIHRvZG86IGZpeCB0aGF0IGFuZCBtYWtlIHRoZW0gYWxsIGNlbnRyYWxseSB1cGRhdGVkIGJ5IHRoZSBhbmltYXRpb24gbG9vcCBvcnNvbWV0aGluZ1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIE5FV1NMSURFOlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXggLT0gMTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN3aXRjaERpc3BsYXllZFNsaWRlSW5kZXgodGhpcy5jdXJyZW50U2xpZGVJbmRleCAtIDEpO1xuICAgICAgICB0aGlzLnNob3dBcnJvd3MoKTtcbiAgICB9XG5cbiAgICBzaG93QXJyb3dzKCl7XG4gICAgICAgIGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPiAwKXtcbiAgICAgICAgICAgIHRoaXMubGVmdEFycm93LnNob3dTZWxmKCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5sZWZ0QXJyb3cuaGlkZVNlbGYoKTtcbiAgICAgICAgfVxuICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4IDwgdGhpcy5udW1TbGlkZXMpe1xuICAgICAgICAgICAgdGhpcy5yaWdodEFycm93LnNob3dTZWxmKCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5yaWdodEFycm93LmhpZGVTZWxmKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBuZXh0U2xpZGUoKXtcbiAgICAgICAgLypUaGUgdXNlciB3aWxsIGNhbGwgdGhpcyBmdW5jdGlvbiB0byBtYXJrIHRoZSB0cmFuc2l0aW9uIGJldHdlZW4gb25lIHNsaWRlIGFuZCB0aGUgbmV4dC4gVGhpcyBkb2VzIHR3byB0aGluZ3M6XG4gICAgICAgIEEpIHdhaXRzIHVudGlsIHRoZSB1c2VyIHByZXNzZXMgdGhlIHJpZ2h0IGFycm93IGtleSwgcmV0dXJucywgYW5kIGNvbnRpbnVlcyBleGVjdXRpb24gdW50aWwgdGhlIG5leHQgbmV4dFNsaWRlKCkgY2FsbFxuICAgICAgICBCKSBpZiB0aGUgdXNlciBwcmVzc2VzIHRoZSBsZWZ0IGFycm93IGtleSwgdGhleSBjYW4gdW5kbyBhbmQgZ28gYmFjayBpbiB0aW1lLCBhbmQgZXZlcnkgVHJhbnNpdGlvblRvKCkgY2FsbCBiZWZvcmUgdGhhdCB3aWxsIGJlIHVuZG9uZSB1bnRpbCBpdCByZWFjaGVzIGEgcHJldmlvdXMgbmV4dFNsaWRlKCkgY2FsbC4gQW55IG5vcm1hbCBqYXZhc2NyaXB0IGFzc2lnbm1lbnRzIHdvbid0IGJlIGNhdWdodCBpbiB0aGlzIDooXG4gICAgICAgIEMpIGlmIHVuZG9cbiAgICAgICAgKi9cbiAgICAgICAgaWYoIXRoaXMuaW5pdGlhbGl6ZWQpdGhyb3cgbmV3IEVycm9yKFwiRVJST1I6IFVzZSAuYmVnaW4oKSBvbiBhIERpcmVjdG9yIGJlZm9yZSBjYWxsaW5nIGFueSBvdGhlciBtZXRob2RzIVwiKTtcblxuICAgICAgICBcbiAgICAgICAgdGhpcy5udW1TbGlkZXMrKztcbiAgICAgICAgdGhpcy51bmRvU3RhY2sucHVzaChuZXcgTmV3U2xpZGVVbmRvSXRlbSh0aGlzLmN1cnJlbnRTbGlkZUluZGV4KSk7XG4gICAgICAgIHRoaXMuc2hvd0Fycm93cygpO1xuXG5cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vcHJvbWlzZSBpcyByZXNvbHZlZCBieSBjYWxsaW5nIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uKCkgd2hlbiB0aGUgdGltZSBjb21lc1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgICAgIHNlbGYubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gZnVuY3Rpb24oKXsgXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIGFzeW5jIGRlbGF5KHdhaXRUaW1lKXtcbiAgICAgICAgdGhpcy51bmRvU3RhY2sucHVzaChuZXcgRGVsYXlVbmRvSXRlbSh3YWl0VGltZSkpO1xuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4Kys7XG4gICAgICAgIGF3YWl0IHN1cGVyLmRlbGF5KHdhaXRUaW1lKTtcbiAgICB9XG4gICAgVHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMpe1xuICAgICAgICB2YXIgYW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDApO1xuICAgICAgICBsZXQgZnJvbVZhbHVlcyA9IGFuaW1hdGlvbi5mcm9tVmFsdWVzO1xuICAgICAgICB0aGlzLnVuZG9TdGFjay5wdXNoKG5ldyBVbmRvSXRlbSh0YXJnZXQsIHRvVmFsdWVzLCBmcm9tVmFsdWVzLCBkdXJhdGlvbk1TKSk7XG4gICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXgrKztcbiAgICB9XG59XG5cblxuLy9kaXNjb3VudCBlbnVtXG5jb25zdCBUUkFOU0lUSU9OVE8gPSAwO1xuY29uc3QgTkVXU0xJREUgPSAxO1xuY29uc3QgREVMQVk9MjtcblxuLy90aGluZ3MgdGhhdCBjYW4gYmUgc3RvcmVkIGluIGEgVW5kb0NhcGFibGVEaXJlY3RvcidzIC51bmRvU3RhY2tbXVxuY2xhc3MgVW5kb0l0ZW17XG4gICAgY29uc3RydWN0b3IodGFyZ2V0LCB0b1ZhbHVlcywgZnJvbVZhbHVlcywgZHVyYXRpb25NUyl7XG4gICAgICAgIHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xuICAgICAgICB0aGlzLnRvVmFsdWVzID0gdG9WYWx1ZXM7XG4gICAgICAgIHRoaXMuZnJvbVZhbHVlcyA9IGZyb21WYWx1ZXM7XG4gICAgICAgIHRoaXMuZHVyYXRpb25NUyA9IGR1cmF0aW9uTVM7XG4gICAgICAgIHRoaXMudHlwZSA9IFRSQU5TSVRJT05UTztcbiAgICB9XG59XG5cbmNsYXNzIE5ld1NsaWRlVW5kb0l0ZW17XG4gICAgY29uc3RydWN0b3Ioc2xpZGVJbmRleCl7XG4gICAgICAgIHRoaXMuc2xpZGVJbmRleCA9IHNsaWRlSW5kZXg7XG4gICAgICAgIHRoaXMudHlwZSA9IE5FV1NMSURFO1xuICAgIH1cbn1cblxuY2xhc3MgRGVsYXlVbmRvSXRlbXtcbiAgICBjb25zdHJ1Y3Rvcih3YWl0VGltZSl7XG4gICAgICAgIHRoaXMud2FpdFRpbWUgPSB3YWl0VGltZTtcbiAgICAgICAgdGhpcy50eXBlID0gREVMQVk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBOb25EZWNyZWFzaW5nRGlyZWN0b3IsIERpcmVjdGlvbkFycm93LCBVbmRvQ2FwYWJsZURpcmVjdG9yIH07XG4iXSwibmFtZXMiOlsiTWF0aCIsInRocmVlRW52aXJvbm1lbnQiLCJtYXRoLmxlcnBWZWN0b3JzIiwicmVxdWlyZSIsInJlcXVpcmUkJDAiLCJyZXF1aXJlJCQxIiwicmVxdWlyZSQkMiIsImdsb2JhbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0NBQUE7Q0FD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LENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxJQUFJO0NBQ0osR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7Q0FDbkM7Q0FDQSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzVDLElBQUksSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3RHLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDN0MsS0FBSyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdkcsS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDOUMsS0FBSyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM5QyxLQUFLO0NBQ0wsSUFBSTtDQUNKLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO0NBQ25DO0NBQ0EsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM1QyxJQUFJLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN0RyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzdDLEtBQUssSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3ZHLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFD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LENBQUMsR0FBRSxDQUFDLEFBQStOLENBQUMsRUFBRSxVQUFVLENBQUMsQUFBMEIsT0FBTyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPRSxlQUFPLEVBQUUsVUFBVSxFQUFFQSxlQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU9BLGVBQU8sRUFBRSxVQUFVLEVBQUVBLGVBQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsWUFBWSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksR0FBRyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxZQUFZLEtBQUssQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsb0JBQW1CLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQyxxQ0FBcUMsQ0FBQyxrREFBa0QsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsT0FBTyxPQUFPLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEdBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxHQUFHLFFBQVEsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsZ0JBQWdCLENBQUMsU0FBUyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGdCQUFnQixDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUMsQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLE9BQU8sVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsU0FBUyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxPQUFPLEdBQUcsR0FBRyxVQUFVLENBQUMsU0FBUyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxPQUFPLEdBQUcsR0FBRyxRQUFRLENBQUMsU0FBUyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxPQUFPLEdBQUcsR0FBRyxRQUFRLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEdBQUcsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFFLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBRyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLFVBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLFlBQVksQ0FBQyxDQUFDLEdBQUcsWUFBWSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQVksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBSyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxPQUFPLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxHQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsSUFBSSxFQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFLLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyw0QkFBNEIsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQUFBbUIsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFLLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU0sR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVUsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksV0FBVyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsU0FBUyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxHQUFHLFNBQVMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsRUFBRSxTQUFTLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLFNBQVMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxNQUFNLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLE1BQU0sUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLEVBQUUsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxBQUF3QixJQUFJLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLEVBQUUsZUFBZSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksY0FBYyxDQUFDLEVBQUUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLEFBQWEsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsSUFBSSxjQUFjLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLFFBQVEsQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsV0FBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLFNBQVMsQ0FBQyxPQUFPLFdBQVcsQ0FBQyxTQUFTLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEdBQUcsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFTLENBQUMsU0FBUyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsU0FBUyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLEVBQUUsV0FBVyxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLGFBQWEsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLFFBQVEsR0FBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLFNBQVMsV0FBVyxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLDZGQUE2RixDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFDLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxVQUFVLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxHQUFHLEdBQUcsR0FBRyxPQUFPLEVBQUUsR0FBRyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxHQUFHLElBQUksT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxHQUFHLElBQUksYUFBYSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxhQUFhLENBQUMsR0FBRyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFDLENBQUMsR0FBRyxPQUFPLFNBQVMsR0FBRyxXQUFXLEVBQUUsU0FBUyxHQUFHLElBQUksRUFBRSxLQUFLLFlBQVksU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEtBQUssR0FBRyxPQUFPLHdCQUF3QixHQUFHLFdBQVcsRUFBRSx3QkFBd0IsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLHdCQUF3QixFQUFFLE9BQU8scUJBQXFCLEdBQUcsV0FBVyxFQUFFLHFCQUFxQixHQUFHLElBQUksRUFBRSxLQUFLLFlBQVkscUJBQXFCLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBSyxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaURBQWlELENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsR0FBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFNLFVBQVUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxPQUFPLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxPQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsU0FBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsWUFBWSxFQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsR0FBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLE1BQUssQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEdBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUks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QUMsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRztJQUNwRCxnQkFBZ0IsRUFBRSxDQUFDLEVBQUUsSUFBSSxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQzdDLGdCQUFnQixFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUNyRCxnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7SUFDckQ7R0FDRCx1QkFBdUIsRUFBRSxDQUFDOztHQUUxQjs7RUFFRCxTQUFTLFVBQVUsRUFBRTs7R0FFcEIsSUFBSSxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQztHQUMxQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUc7SUFDcEQsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLGdCQUFnQixFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7SUFDbkUsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQztJQUMzRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLGdCQUFnQixFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDLGdCQUFnQixDQUFDO0lBQzNFO0dBQ0QsYUFBYSxDQUFDLFlBQVksRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0dBQzlDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQztH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QyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ2YsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ3pDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzs7Q0FFMUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDM0MsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDL0MsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDbEQsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7O0NBRTlDLFVBQVUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQ2hDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQzFCO0NBQ0E7Q0FDQSxVQUFVLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztDQUNoQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENB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Q0FBQyxDQUFDOztDQUV2QjtDQUNBLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLEtBQUssSUFBSTtDQUNUO0NBQ0EsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLEtBQUssY0FBYyxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQzFCLEtBQUs7O0NBRUw7Q0FDQSxJQUFJLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3BDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxLQUFLLElBQUk7Q0FDVDtDQUNBLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxLQUFLLGNBQWMsSUFBSSxDQUFDLENBQUMsQ0FBQztDQUMxQixLQUFLOztDQUVMO0NBQ0E7Q0FDQSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDbEo7Q0FDQSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0NBRWxKO0NBQ0EsSUFBSSxTQUFTLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztDQUMxRCxJQUFJLFNBQVMsQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLENBQUM7Q0FDN0M7Q0FDQSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQztDQUNwRSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7Q0FDdEUsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxH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
