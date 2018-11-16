(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.EXP = {})));
}(this, (function (exports) { 'use strict';

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

	class Area$1 extends DomainNode{
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
			let clone = new Area$1({bounds: Utils.arrayCopy(this.bounds), numItems: this.numItems});
			for(var i=0;i<this.children.length;i++){
				clone.add(this.children[i].clone());
				if(clone.children[i]._onAdd)clone.children[i]._onAdd(); // necessary now that the chain of adding has been established
			}
			return clone;
		}
	}

	//Usage: var y = new Transformation({expr: function(...a){console.log(...a)}});
	class Transformation$1 extends Node{
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
			let clone = new Transformation$1({expr: thisExpr.bind()});
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
			EXP.Utils.assertType(transformationToLinkTo, Transformation$1);
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


			if(target.constructor === Transformation$1){
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
			this.elapsedTime += time.delta;	

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
				this.target[propertyName] = (function(i, ...coords){
					let lerpFactor = percentage/(1-this.staggerFraction) - i*this.staggerFraction/this.targetNumCallsPerActivation;
					//let percent = Math.min(Math.max(percentage - i/this.targetNumCallsPerActivation   ,1),0);

					let t = this.interpolationFunction(Math.max(Math.min(lerpFactor,1),0));
					return lerpVectors(t,toValue(i, ...coords),fromValue(i, ...coords))
				}).bind(this);
				return;
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

	function ThreeasyEnvironment(canvasContainer = null){
		this.prev_timestep = 0;
	    this.shouldCreateContainer = (canvasContainer === null);

		if(!Detector.webgl)Detector.addGetWebGLMessage();

		this.camera = new THREE.OrthographicCamera({
			near: .1,
			far: 10000,

			//type: 'perspective',
			fov: 60,
			aspect: 1,
	/*
			// type: 'orthographic',
			left: -1,
			right: 1,
			bottom: -1,
			top: 1,*/
		  });

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

		this.container = this.shouldCreateContainer ? document.createElement( 'div' ) : canvasContainer;
		this.container.appendChild( this.renderer.domElement );

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

	    if(!this.shouldCreateContainer && canvasContainer.offsetWidth){
	        //If the canvasElement is already loaded, then the 'load' event has already fired. We need to trigger it ourselves.
	        this.onPageLoad();
	    }
	}

	ThreeasyEnvironment.prototype.onPageLoad = function() {
		console.log("Threeasy_Setup loaded!");
		if(this.shouldCreateContainer){
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
			return x+1
		}	return x;
	};
	ThreeasyEnvironment.prototype.onWindowResize= function() {
	    let width = window.innerWidth;
	    let height = window.innerHeight;

		this.camera.aspect = width / height;
		this.aspect = this.camera.aspect;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( this.evenify(width),this.evenify(height) );
	};
	ThreeasyEnvironment.prototype.listeners = {"update": [],"render":[]}; //update event listeners
	ThreeasyEnvironment.prototype.render = function(timestep){
		var delta = this.clock.getDelta()*this.timeScale;
		this.elapsedTime += delta;
		//get timestep
		for(var i=0;i<this.listeners["update"].length;i++){
			this.listeners["update"][i]({"t":this.elapsedTime,"delta":delta});
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

		constructor(fps=30, length = 5, canvasContainer = null){
			/* fps is evident, autostart is a boolean (by default, true), and length is in s.*/
			super(canvasContainer);
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
			var delta = 1/this.fps*this.timeScale; //ignoring the true time, calculate the delta

			//get timestep
			for(var i=0;i<this.listeners["update"].length;i++){
				this.listeners["update"][i]({"t":this.elapsedTime,"delta":delta});
			}

			this.renderer.render( this.scene, this.camera );

			for(var i=0;i<this.listeners["render"].length;i++){
				this.listeners["render"][i]();
			}


			this.record_frame();
			this.recording_icon.style.borderRadius = '10px';

			this.elapsedTime += delta;
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

	function setupThree(fps=30, length = 5, canvasContainer = null){
		var is_recording = false;

		//extract record parameter from url
		var params = new URLSearchParams(document.location.search);
		let recordString = params.get("record");

		if(recordString){ //detect if URL params include ?record=1 or ?record=true
	        recordString = recordString.toLowerCase();
	        is_recording = (recordString == "true" || recordString == "1");
	    }

	    if(EXP.threeEnvironment !== null){//singleton has already been created
	        return EXP.threeEnvironment;
	    }

	    let threeEnvironment = null;
		if(is_recording){
			threeEnvironment = new ThreeasyRecorder(fps, length, canvasContainer);
		}else{
			threeEnvironment = new ThreeasyEnvironment(canvasContainer);
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
			this._color = options.color !== undefined ? options.color : 0x55aa55;

			this.numCallsPerActivation = 0; //should always be equal to this.points.length
			this.itemDimensions = []; // how many times to be called in each direction
			this._outputDimensions = 3; //how many dimensions per point to store?

			this.init();
		}
		init(){
			this._geometry = new THREE.BufferGeometry();
			this._vertices;
			this.makeGeometry();

			this.material = new THREE.LineBasicMaterial({color: this._color, linewidth: this._width,opacity:this._opacity});
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

			let MAX_POINTS = 10000;

			this._vertices = new Float32Array(MAX_POINTS * 2 * this._outputDimensions);

			// build geometry

			this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
			//this._geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
			//this.geometry.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

			this._currentPointIndex = 0; //used during updates as a pointer to the buffer

			this._activatedOnce = false;

		}
		_onAdd(){
			//climb up parent hierarchy to find the Domain node we're rendering from
	        let root = this.getClosestDomain();
		
			//todo: implement something like assert root typeof RootNode

			this.numCallsPerActivation = root.numCallsPerActivation;
			this.itemDimensions = root.itemDimensions;
		}
		_onFirstActivation(){
			this._onAdd(); //setup this.numCallsPerActivation and this.itemDimensions. used here again because cloning means the onAdd() might be called before this is connected to a type of domain

			// perhaps instead of generating a whole new array, this can reuse the old one?
			let vertices = new Float32Array(this.numCallsPerActivation * this._outputDimensions * 2);

			let positionAttribute = this._geometry.attributes.position;
			this._vertices = vertices;
			positionAttribute.setArray(this._vertices);

			positionAttribute.needsUpdate = true;
		}
		evaluateSelf(i, t, x, y, z){
			if(!this._activatedOnce){
				this._activatedOnce = true;
				this._onFirstActivation();	
			}

			//it's assumed i will go from 0 to this.numCallsPerActivation, since this should only be called from an Area.

			//assert i < vertices.count

			let index = this._currentPointIndex*this._outputDimensions;

			if(x !== undefined)this._vertices[index] = x;
			if(y !== undefined)this._vertices[index+1] = y;
			if(z !== undefined)this._vertices[index+2] = z;

			this._currentPointIndex++;

			/* we're drawing like this:
			*----*----*

	        *----*----*
		
			but we don't want to insert a diagonal line anywhere. This handles that:  */

			let firstCoordinate = i % this.itemDimensions[this.itemDimensions.length-1];

			if(!(firstCoordinate == 0 || firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1)){
				if(x !== undefined)this._vertices[index+this._outputDimensions] = x;
				if(y !== undefined)this._vertices[index+this._outputDimensions+1] = y;
				if(z !== undefined)this._vertices[index+this._outputDimensions+2] = z;
				this._currentPointIndex++;
			}

			//vertices should really be an uniform, though.
		}
		onAfterActivation(){
			let positionAttribute = this._geometry.attributes.position;
			positionAttribute.needsUpdate = true;
			this._currentPointIndex = 0; //reset after each update
		}
		set color(color){
			//currently only a single color is supported.
			//I should really make it possible to specify color by a function.
			this.material.color = new THREE.Color(color);
			this._color = color;
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

	class Point{
		constructor(options){
			/*options: color: <THREE.Color or hex code
				x,y: numbers
				width: number
			*/

			let width = options.width === undefined ? 1 : options.width;
			let color = options.color === undefined ? 0x777777 : options.color;

			this.mesh = new THREE.Mesh(this.sharedCircleGeometry,this.getFromMaterialCache(color));

			this.opacity = options.opacity === undefined ? 1 : options.opacity; //trigger setter

			this.mesh.position.set(this.x,this.y,this.z);
			this.mesh.scale.setScalar(this.width/2);
			exports.threeEnvironment.scene.add(this.mesh);

			this.x = options.x || 0;
			this.y = options.y || 0;
			this.z = options.z || 0;
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
		set opacity(opacity){
			let mat = this.mesh.material;
			mat.opacity = opacity;
			mat.transparent = opacity < 1;
	        mat.visible = opacity > 0;
			this._opacity = opacity;
		}
		get opacity(){
			return this._opacity;
		}
		getFromMaterialCache(color){
			if(this._materials[color] === undefined){
				this._materials[color] = new THREE.MeshBasicMaterial({color: color});
			}
			return this._materials[color]
		}
		set color(color){
			this.mesh.material = this.getFromMaterialCache(color);
		}
	}
	Point.prototype.sharedCircleGeometry = new THREE.SphereGeometry(1/2, 8, 6); //radius 1/2 makes diameter 1, so that scaling by n means width=n

	Point.prototype._materials = {};

	class PointOutput extends OutputNode{
		constructor(options = {}){
			super();
			/*
				width: number
				color: hex color, as in 0xrrggbb. Technically, this is a JS integer.
				opacity: 0-1. Optional.
			*/

			this._width = options.width !== undefined ? options.width : 1;
			this._color = options.color !== undefined ? options.color : 0x55aa55;
			this._opacity = options.opacity !== undefined ? options.opacity : 1;


			this.points = [];

			this.numCallsPerActivation = 0; //should always be equal to this.points.length
			this._activatedOnce = false;
		}
		_onAdd(){ //should be called when this is .add()ed to something
			//climb up parent hierarchy to find the Area
			let root = this.getClosestDomain();

			this.numCallsPerActivation = root.numCallsPerActivation;

			if(this.points.length < this.numCallsPerActivation){
				for(var i=this.points.length;i<this.numCallsPerActivation;i++){
					this.points.push(new Point({width: 1,color:this._color, opacity:this._opacity}));
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
			if(x !== undefined)point.x = x;
			if(y !== undefined)point.y = y;
			if(z !== undefined)point.z = z;
		}
		getPoint(i){
			return this.points[i];
		}
		set opacity(opacity){
			//technically this will set all points of the same color, and it'll be wiped with a color change. But I'll deal with that sometime later.
			for(var i=0;i<this.numCallsPerActivation;i++){
				let mat = this.getPoint(i).mesh.material;
				mat.opacity = opacity; //instantiate the point
				mat.transparent = opacity < 1;
	            mat.visible = opacity > 0;
			}
			this._opacity = opacity;
		}
		get opacity(){
			return this._opacity;
		}
		set color(color){
			for(var i=0;i<this.points.length;i++){
				this.getPoint(i).color = color;
			}
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


			this.material = new THREE.LineBasicMaterial({color: this._color, linewidth: this._width, opacity:this._opacity});
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

			exports.threeEnvironment.scene.add(this.lineMesh);
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
				this.arrowheads[i] = new THREE.Mesh(this.coneGeometry, this.material);
				exports.threeEnvironment.scene.add(this.arrowheads[i]);
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

			if(x !== undefined)this._vertices[index] = x;
			if(y !== undefined)this._vertices[index+1] = y;
			if(z !== undefined)this._vertices[index+2] = z;

			this._currentPointIndex++;

			/* we're drawing like this:
			*----*----*

	        *----*----*
		
			but we don't want to insert a diagonal line anywhere. This handles that:  */

			let firstCoordinate = i % this.itemDimensions[this.itemDimensions.length-1];

			//vertices should really be an uniform, though.
			if(!(firstCoordinate == 0 || firstCoordinate == this.itemDimensions[this.itemDimensions.length-1]-1)){
				if(x !== undefined)this._vertices[index+this._outputDimensions] = x;
				if(y !== undefined)this._vertices[index+this._outputDimensions+1] = y;
				if(z !== undefined)this._vertices[index+this._outputDimensions+2] = z;
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

				if(x !== undefined)pos.x = x;
				if(y !== undefined)pos.y = y;
				if(z !== undefined)pos.z = z;

				if(length > 0){ //directionVector.normalize() fails with 0 length
					this.arrowheads[lineNumber].quaternion.setFromUnitVectors(this._coneUpDirection, directionVector.normalize() );
				}

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

	"vec4 renderGridlines(vec4 mainColor, vec2 uv, vec4 color) {",
	"  vec2 distToEdge = abs(mod(vUv.xy*gridSquares + lineWidth/2.0,1.0));",
	"  vec3 gridColor = gridLineColor(color.xyz);",

	"  if( distToEdge.x < lineWidth){",
	"    return showGrid*vec4(gridColor, color.a) + (1.-showGrid)*mainColor;",
	"  } else if(distToEdge.y < lineWidth){ ",
	"    return showGrid*vec4(gridColor, color.a) + (1.-showGrid)*mainColor;",
	"  }",
	"  return mainColor;",
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
	"  vec4 materialColor = showSolid*getShadedColor(vec4(color.rgb, opacity));",
	"  vec4 colorWithGridlines = renderGridlines(materialColor, vUv.xy, vec4(color.rgb, opacity));",
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
					width: number
					opacity: number
					color: hex code or THREE.Color()
					showGrid: boolean. If true, will display a grid over the surface. Default: true
					showSolid: boolean. If true, will display a solid surface. Default: true
					gridSquares: number representing how many squares per dimension to use in a rendered grid
				}
			*/
			this._opacity = options.opacity !== undefined ? options.opacity : 1;
			this._color = options.color !== undefined ? options.color : 0x55aa55;

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
			this._uniforms.showGrid.value = this._showGrid ? 1 : 0;
			this._uniforms.showSolid.value = this._showSolid ? 1 : 0;
			this._uniforms.lineWidth.value = this._gridLineWidth;

			if(!this.showSolid)this.material.transparent = true;

			exports.threeEnvironment.scene.add(this.mesh);
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

			if(x !== undefined)this._vertices[index] = x;
			if(y !== undefined)this._vertices[index+1] = y;
			if(z !== undefined)this._vertices[index+2] = z;

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
		set color(color){
			//currently only a single color is supported.
			//I should really make this a function
			this._color = color;
			this._uniforms.color.value = new THREE.Color(color);
		}
		get color(){
			return this._color;
		}
		set opacity(opacity){
			this.material.opacity = opacity;
			this.material.transparent = opacity < 1;
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
				this.onclick();
			}).bind(this);

			this.onclickCallback = null; // to be set externally
		}
		onclick(){
			this.hideSelf();
			this.onclickCallback();
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
		// I want Director() to be able to backtrack by pressing backwards. This doesn't do that.
		constructor(options){
			this.undoStack = [];
			this.undoStackIndex = 0;

			this.slides = [];
			this.currentSlideIndex = 0;

			this.nextSlideResolveFunction = null;
	        this.initialized = false;
		}


		async begin(){
			await this.waitForPageLoad();
	        this.slides = document.getElementsByClassName("exp-slide");

			this.rightArrow = new DirectionArrow();
			document.body.appendChild(this.rightArrow.arrowImage);
			let self = this;
			this.rightArrow.onclickCallback = function(){
				self._changeSlide(1, function(){}); // this errors without the empty function because there's no resolve. There must be a better way to do things.
				console.warn("WARNING: Horrible hack in effect to change slides. Please replace the pass-an-empty-function thing with something that actually resolves properly and does async.");
				self.nextSlideResolveFunction();
			};

	        this.initialized = true;

		}

		async waitForPageLoad(){
			return new Promise(function(resolve, reject){
				//window.addEventListener("load",resolve);
				window.setTimeout(resolve,1);
				resolve();
			});
		}

		showSlide(slideNumber){
			for(var i=0;i<this.slides.length;i++){
				this.slides[i].style.opacity = 0;
			}
			this.slides[slideNumber].style.opacity = 1;
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


			//right now there is a problem. Going backwards should not resolve the promise; only going to the most recent slide and pressing right should.
			if(slideDelta != 0){
				if(this.currentSlideIndex == 0 && slideDelta == -1){
					return;
				}
				if(this.currentSlideIndex == this.slides.length-1 && slideDelta == 1){
					return;
				}
				this.currentSlideIndex += slideDelta;
				this.showSlide(this.currentSlideIndex);
				resolve();
			}
		}
		//verbs
		async delay(waitTime){
			return new Promise(function(resolve, reject){
				window.setTimeout(resolve, waitTime);
			});
		}
		TransitionTo(target, toValues, durationMS){
			//EXP.Utils.Assert(this.undoStackIndex == 0); //This may not work well.
			new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000);
		}
	}

	exports.Array = EXPArray;
	exports.Area = Area$1;
	exports.Transformation = Transformation$1;
	exports.HistoryRecorder = HistoryRecorder;
	exports.TransitionTo = TransitionTo;
	exports.Animation = Animation;
	exports.setupThree = setupThree;
	exports.ThreeasyEnvironment = ThreeasyEnvironment;
	exports.ThreeasyRecorder = ThreeasyRecorder;
	exports.Utils = Utils;
	exports.Math = Math$1;
	exports.LineOutput = LineOutput;
	exports.PointOutput = PointOutput;
	exports.VectorOutput = VectorOutput;
	exports.SurfaceOutput = SurfaceOutput;
	exports.NonDecreasingDirector = NonDecreasingDirector;
	exports.DirectionArrow = DirectionArrow;
	exports.delay = delay;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9IaXN0b3J5UmVjb3JkZXIuanMiLCIuLi9zcmMvanMvVGhyZWVFbnZpcm9ubWVudC5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL291dHB1dHMvTGluZU91dHB1dC5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1BvaW50LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvUG9pbnRPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9WZWN0b3JPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9TdXJmYWNlT3V0cHV0U2hhZGVycy5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1N1cmZhY2VPdXRwdXQuanMiLCIuLi9zcmMvanMvRGlyZWN0b3JJbWFnZUNvbnN0YW50cy5qcyIsIi4uL3NyYy9qcy9EaXJlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBUaGUgYmFzZSBjbGFzcyB0aGF0IGV2ZXJ5dGhpbmcgaW5oZXJpdHMgZnJvbS4gXG5cdEVhY2ggdGhpbmcgZHJhd24gdG8gdGhlIHNjcmVlbiBpcyBhIHRyZWUuIERvbWFpbnMsIHN1Y2ggYXMgRVhQLkFyZWEgb3IgRVhQLkFycmF5IGFyZSB0aGUgcm9vdCBub2Rlcyxcblx0RVhQLlRyYW5zZm9ybWF0aW9uIGlzIGN1cnJlbnRseSB0aGUgb25seSBpbnRlcm1lZGlhdGUgbm9kZSwgYW5kIHRoZSBsZWFmIG5vZGVzIGFyZSBzb21lIGZvcm0gb2YgT3V0cHV0IHN1Y2ggYXNcblx0RVhQLkxpbmVPdXRwdXQgb3IgRVhQLlBvaW50T3V0cHV0LCBvciBFWFAuVmVjdG9yT3V0cHV0LlxuXG5cdEFsbCBvZiB0aGVzZSBjYW4gYmUgLmFkZCgpZWQgdG8gZWFjaCBvdGhlciB0byBmb3JtIHRoYXQgdHJlZSwgYW5kIHRoaXMgZmlsZSBkZWZpbmVzIGhvdyBpdCB3b3Jrcy5cbiovXG5cbmNsYXNzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKCl7ICAgICAgICBcblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsOyAgICAgICAgXG4gICAgfVxuXHRhZGQodGhpbmcpe1xuXHRcdC8vY2hhaW5hYmxlIHNvIHlvdSBjYW4gYS5hZGQoYikuYWRkKGMpIHRvIG1ha2UgYS0+Yi0+Y1xuXHRcdHRoaXMuY2hpbGRyZW4ucHVzaCh0aGluZyk7XG5cdFx0dGhpbmcucGFyZW50ID0gdGhpcztcblx0XHRpZih0aGluZy5fb25BZGQpdGhpbmcuX29uQWRkKCk7XG5cdFx0cmV0dXJuIHRoaW5nO1xuXHR9XG5cdF9vbkFkZCgpe31cblx0cmVtb3ZlKHRoaW5nKXtcblx0XHR2YXIgaW5kZXggPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoIHRoaW5nICk7XG5cdFx0aWYgKCBpbmRleCAhPT0gLSAxICkge1xuXHRcdFx0dGhpbmcucGFyZW50ID0gbnVsbDtcblx0XHRcdHRoaXMuY2hpbGRyZW4uc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuICAgIGdldFRvcFBhcmVudCgpeyAvL2ZpbmQgdGhlIHBhcmVudCBvZiB0aGUgcGFyZW50IG9mIHRoZS4uLiB1bnRpbCB0aGVyZSdzIG5vIG1vcmUgcGFyZW50cy5cbiAgICAgICAgY29uc3QgTUFYX0NIQUlOID0gMTAwO1xuICAgICAgICBsZXQgcGFyZW50Q291bnQgPSAwO1xuXHRcdGxldCByb290ID0gdGhpcztcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmIHBhcmVudENvdW50IDwgTUFYX0NIQUlOKXtcblx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcbiAgICAgICAgICAgIHBhcmVudENvdW50Kz0gMTtcblx0XHR9XG5cdFx0aWYocGFyZW50Q291bnQgPj0gTUFYX0NIQUlOKXRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIHRvcC1sZXZlbCBwYXJlbnQhXCIpO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9XG4gICAgZ2V0Q2xvc2VzdERvbWFpbigpe1xuICAgICAgICAvKiBGaW5kIHRoZSBEb21haW5Ob2RlIHRoYXQgdGhpcyBOb2RlIGlzIGJlaW5nIGNhbGxlZCBmcm9tLlxuICAgICAgICBUcmF2ZXJzZSB0aGUgY2hhaW4gb2YgcGFyZW50cyB1cHdhcmRzIHVudGlsIHdlIGZpbmQgYSBEb21haW5Ob2RlLCBhdCB3aGljaCBwb2ludCB3ZSByZXR1cm4gaXQuXG4gICAgICAgIFRoaXMgYWxsb3dzIGFuIG91dHB1dCB0byByZXNpemUgYW4gYXJyYXkgdG8gbWF0Y2ggYSBkb21haW5Ob2RlJ3MgbnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBmb3IgZXhhbXBsZS5cblxuICAgICAgICBOb3RlIHRoYXQgdGhpcyByZXR1cm5zIHRoZSBNT1NUIFJFQ0VOVCBEb21haW5Ob2RlIGFuY2VzdG9yIC0gaXQncyBhc3N1bWVkIHRoYXQgZG9tYWlubm9kZXMgb3ZlcndyaXRlIG9uZSBhbm90aGVyLlxuICAgICAgICAqL1xuICAgICAgICBjb25zdCBNQVhfQ0hBSU4gPSAxMDA7XG4gICAgICAgIGxldCBwYXJlbnRDb3VudCA9IDA7XG5cdFx0bGV0IHJvb3QgPSB0aGlzLnBhcmVudDsgLy9zdGFydCBvbmUgbGV2ZWwgdXAgaW4gY2FzZSB0aGlzIGlzIGEgRG9tYWluTm9kZSBhbHJlYWR5LiB3ZSBkb24ndCB3YW50IHRoYXRcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmICFyb290LmlzRG9tYWluTm9kZSAmJiBwYXJlbnRDb3VudCA8IE1BWF9DSEFJTil7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG4gICAgICAgICAgICBwYXJlbnRDb3VudCs9IDE7XG5cdFx0fVxuXHRcdGlmKHBhcmVudENvdW50ID49IE1BWF9DSEFJTil0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBwYXJlbnQhXCIpO1xuICAgICAgICBpZihyb290ID09PSBudWxsIHx8ICFyb290LmlzRG9tYWluTm9kZSl0aHJvdyBuZXcgRXJyb3IoXCJObyBEb21haW5Ob2RlIHBhcmVudCBmb3VuZCFcIik7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH1cblxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblx0XHQvL2J1dCBjYWxsIGFsbCBjaGlsZHJlblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0ub25BZnRlckFjdGl2YXRpb24oKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgT3V0cHV0Tm9kZSBleHRlbmRzIE5vZGV7IC8vbW9yZSBvZiBhIGphdmEgaW50ZXJmYWNlLCByZWFsbHlcblx0Y29uc3RydWN0b3IoKXtzdXBlcigpO31cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope31cblx0b25BZnRlckFjdGl2YXRpb24oKXt9XG5cdF9vbkFkZCgpe31cbn1cblxuY2xhc3MgRG9tYWluTm9kZSBleHRlbmRzIE5vZGV7IC8vQSBub2RlIHRoYXQgY2FsbHMgb3RoZXIgZnVuY3Rpb25zIG92ZXIgc29tZSByYW5nZS5cblx0Y29uc3RydWN0b3IoKXtcbiAgICAgICAgc3VwZXIoKTtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSBudWxsOyAvLyBudW1iZXIgb2YgdGltZXMgYW55IGNoaWxkIG5vZGUncyBldmFsdWF0ZVNlbGYoKSBpcyBjYWxsZWRcbiAgICB9XG4gICAgYWN0aXZhdGUodCl7fVxufVxuRG9tYWluTm9kZS5wcm90b3R5cGUuaXNEb21haW5Ob2RlID0gdHJ1ZTtcblxuZXhwb3J0IGRlZmF1bHQgTm9kZTtcbmV4cG9ydCB7T3V0cHV0Tm9kZSwgRG9tYWluTm9kZX07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9ICBmcm9tICcuL05vZGUuanMnO1xuLy90ZXN0Pz9cbmNsYXNzIEVYUEFycmF5IGV4dGVuZHMgRG9tYWluTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKnZhciBwb2ludHMgPSBuZXcgRVhQLkFycmF5KHtcblx0XHRkYXRhOiBbWy0xMCwxMF0sXG5cdFx0XHRbMTAsMTBdXVxuXHRcdH0pKi9cblxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZGF0YVwiKTsgLy8gYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LiBhc3N1bWVkIHRvIG9ubHkgY29udGFpbiBvbmUgdHlwZTogZWl0aGVyIG51bWJlcnMgb3IgYXJyYXlzXG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5kYXRhLCBBcnJheSk7XG5cblx0XHQvL0l0J3MgYXNzdW1lZCBhbiBFWFAuQXJyYXkgd2lsbCBvbmx5IHN0b3JlIHRoaW5ncyBzdWNoIGFzIDAsIFswXSwgWzAsMF0gb3IgWzAsMCwwXS4gSWYgYW4gYXJyYXkgdHlwZSBpcyBzdG9yZWQsIHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyBjb250YWlucyB0aGUgLmxlbmd0aCBvZiB0aGF0IGFycmF5LiBPdGhlcndpc2UgaXQncyAwLCBiZWNhdXNlIHBvaW50cyBhcmUgMC1kaW1lbnNpb25hbC5cblx0XHRpZihvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHR0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPSAwO1xuXHRcdH1lbHNlIGlmKG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0dGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID0gb3B0aW9ucy5kYXRhWzBdLmxlbmd0aDtcblx0XHR9ZWxzZXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJEYXRhIGluIGFuIEVYUC5BcnJheSBzaG91bGQgYmUgYSBudW1iZXIgb3IgYW4gYXJyYXkgb2Ygb3RoZXIgdGhpbmdzLCBub3QgXCIgKyBvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IpO1xuXHRcdH1cblxuXG5cdFx0RVhQLlV0aWxzLmFzc2VydChvcHRpb25zLmRhdGFbMF0ubGVuZ3RoICE9IDApOyAvL2Rvbid0IGFjY2VwdCBbW11dLCBkYXRhIG5lZWRzIHRvIGJlIHNvbWV0aGluZyBsaWtlIFtbMSwyXV0uXG5cblx0XHR0aGlzLmRhdGEgPSBvcHRpb25zLmRhdGE7XG5cdFx0dGhpcy5udW1JdGVtcyA9IHRoaXMuZGF0YS5sZW5ndGg7XG5cblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW3RoaXMuZGF0YS5sZW5ndGhdOyAvLyBhcnJheSB0byBzdG9yZSB0aGUgbnVtYmVyIG9mIHRpbWVzIHRoaXMgaXMgY2FsbGVkIHBlciBkaW1lbnNpb24uXG5cblx0XHQvL3RoZSBudW1iZXIgb2YgdGltZXMgZXZlcnkgY2hpbGQncyBleHByIGlzIGNhbGxlZFxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gdGhpcy5pdGVtRGltZW5zaW9ucy5yZWR1Y2UoKHN1bSx5KT0+c3VtKnkpO1xuXHR9XG5cdGFjdGl2YXRlKHQpe1xuXHRcdGlmKHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyA9PSAwKXtcblx0XHRcdC8vbnVtYmVycyBjYW4ndCBiZSBzcHJlYWQgdXNpbmcgLi4uIG9wZXJhdG9yXG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuZGF0YS5sZW5ndGg7aSsrKXtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGksdCx0aGlzLmRhdGFbaV0pO1xuXHRcdFx0fVxuXHRcdH1lbHNle1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmRhdGEubGVuZ3RoO2krKyl7XG5cdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpLHQsLi4udGhpcy5kYXRhW2ldKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm9uQWZ0ZXJBY3RpdmF0aW9uKCk7IC8vIGNhbGwgY2hpbGRyZW4gaWYgbmVjZXNzYXJ5XG5cdH1cblx0X2NhbGxBbGxDaGlsZHJlbiguLi5jb29yZGluYXRlcyl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpXG5cdFx0fVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEVYUC5BcnJheSh7ZGF0YTogRVhQLlV0aWxzLmFycmF5Q29weSh0aGlzLmRhdGEpfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0QXJyYXkoKXtcblx0dmFyIHggPSBuZXcgRVhQLkFycmF5KHtkYXRhOiBbWzAsMV0sWzAsMV1dfSk7XG5cdHZhciB5ID0gbmV3IEVYUC5UcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSk7IHJldHVybiBbMl19fSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKDUxMik7XG59XG5cbmV4cG9ydCB7RVhQQXJyYXkgYXMgQXJyYXl9O1xuIiwiZnVuY3Rpb24gbXVsdGlwbHlTY2FsYXIoYywgYXJyYXkpe1xuXHRmb3IodmFyIGk9MDtpPGFycmF5Lmxlbmd0aDtpKyspe1xuXHRcdGFycmF5W2ldICo9IGM7XG5cdH1cblx0cmV0dXJuIGFycmF5XG59XG5mdW5jdGlvbiB2ZWN0b3JBZGQodjEsdjIpe1xuICAgIGxldCB2ZWMgPSBjbG9uZSh2MSk7XG5cdGZvcih2YXIgaT0wO2k8djEubGVuZ3RoO2krKyl7XG5cdFx0dmVjW2ldICs9IHYyW2ldO1xuXHR9XG5cdHJldHVybiB2ZWNcbn1cbmZ1bmN0aW9uIGxlcnBWZWN0b3JzKHQsIHAxLCBwMil7XG5cdC8vYXNzdW1lZCB0IGluIFswLDFdXG5cdHJldHVybiB2ZWN0b3JBZGQobXVsdGlwbHlTY2FsYXIodCxjbG9uZShwMSkpLG11bHRpcGx5U2NhbGFyKDEtdCxjbG9uZShwMikpKTtcbn1cbmZ1bmN0aW9uIGNsb25lKHZlYyl7XG5cdHZhciBuZXdBcnIgPSBuZXcgQXJyYXkodmVjLmxlbmd0aCk7XG5cdGZvcih2YXIgaT0wO2k8dmVjLmxlbmd0aDtpKyspe1xuXHRcdG5ld0FycltpXSA9IHZlY1tpXTtcblx0fVxuXHRyZXR1cm4gbmV3QXJyXG59XG5mdW5jdGlvbiBtdWx0aXBseU1hdHJpeCh2ZWMsIG1hdHJpeCl7XG5cdC8vYXNzZXJ0IHZlYy5sZW5ndGggPT0gbnVtUm93c1xuXG5cdGxldCBudW1Sb3dzID0gbWF0cml4Lmxlbmd0aDtcblx0bGV0IG51bUNvbHMgPSBtYXRyaXhbMF0ubGVuZ3RoO1xuXG5cdHZhciBvdXRwdXQgPSBuZXcgQXJyYXkobnVtQ29scyk7XG5cdGZvcih2YXIgaj0wO2o8bnVtQ29scztqKyspe1xuXHRcdG91dHB1dFtqXSA9IDA7XG5cdFx0Zm9yKHZhciBpPTA7aTxudW1Sb3dzO2krKyl7XG5cdFx0XHRvdXRwdXRbal0gKz0gbWF0cml4W2ldW2pdICogdmVjW2ldO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gb3V0cHV0O1xufVxuXG4vL2hhY2tcbmxldCBNYXRoID0ge2Nsb25lOiBjbG9uZSwgbGVycFZlY3RvcnM6IGxlcnBWZWN0b3JzLCB2ZWN0b3JBZGQ6IHZlY3RvckFkZCwgbXVsdGlwbHlTY2FsYXI6IG11bHRpcGx5U2NhbGFyLCBtdWx0aXBseU1hdHJpeDogbXVsdGlwbHlNYXRyaXh9O1xuXG5leHBvcnQge3ZlY3RvckFkZCwgbGVycFZlY3RvcnMsIGNsb25lLCBtdWx0aXBseVNjYWxhciwgbXVsdGlwbHlNYXRyaXgsIE1hdGh9O1xuIiwiaW1wb3J0IHtjbG9uZX0gZnJvbSAnLi9tYXRoLmpzJ1xuXG5jbGFzcyBVdGlsc3tcblxuXHRzdGF0aWMgaXNBcnJheSh4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gQXJyYXk7XG5cdH1cblx0c3RhdGljIGFycmF5Q29weSh4KXtcblx0XHRyZXR1cm4geC5zbGljZSgpO1xuXHR9XG5cdHN0YXRpYyBpc0Z1bmN0aW9uKHgpe1xuXHRcdHJldHVybiB4LmNvbnN0cnVjdG9yID09PSBGdW5jdGlvbjtcblx0fVxuXG5cdHN0YXRpYyBhc3NlcnQodGhpbmcpe1xuXHRcdC8vQSBmdW5jdGlvbiB0byBjaGVjayBpZiBzb21ldGhpbmcgaXMgdHJ1ZSBhbmQgaGFsdCBvdGhlcndpc2UgaW4gYSBjYWxsYmFja2FibGUgd2F5LlxuXHRcdGlmKCF0aGluZyl7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIEFzc2VydGlvbiBmYWlsZWQuIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuXHRcdH1cblx0fVxuXG5cdHN0YXRpYyBhc3NlcnRUeXBlKHRoaW5nLCB0eXBlLCBlcnJvck1zZyl7XG5cdFx0Ly9BIGZ1bmN0aW9uIHRvIGNoZWNrIGlmIHNvbWV0aGluZyBpcyB0cnVlIGFuZCBoYWx0IG90aGVyd2lzZSBpbiBhIGNhbGxiYWNrYWJsZSB3YXkuXG5cdFx0aWYoISh0aGluZy5jb25zdHJ1Y3RvciA9PT0gdHlwZSkpe1xuXHRcdFx0aWYoZXJyb3JNc2cpe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFNvbWV0aGluZyBub3Qgb2YgcmVxdWlyZWQgdHlwZSBcIit0eXBlLm5hbWUrXCIhIFxcblwiK2Vycm9yTXNnK1wiXFxuIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdFx0fWVsc2V7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgU29tZXRoaW5nIG5vdCBvZiByZXF1aXJlZCB0eXBlIFwiK3R5cGUubmFtZStcIiEgU2VlIHRyYWNlYmFjayBmb3IgbW9yZS5cIik7XG5cdFx0XHR9XG4gICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG5cdFx0fVxuXHR9XG5cblxuXHRzdGF0aWMgYXNzZXJ0UHJvcEV4aXN0cyh0aGluZywgbmFtZSl7XG5cdFx0aWYoIXRoaW5nIHx8ICEobmFtZSBpbiB0aGluZykpe1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBcIituYW1lK1wiIG5vdCBwcmVzZW50IGluIHJlcXVpcmVkIHByb3BlcnR5XCIpO1xuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuXHRcdH1cblx0fVxuXHRcblx0c3RhdGljIGNsb25lKHZlYyl7XG5cdFx0cmV0dXJuIGNsb25lKHZlYyk7XG5cdH1cbn1cblxuZXhwb3J0IHtVdGlsc307XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7IERvbWFpbk5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuXG5jbGFzcyBBcmVhIGV4dGVuZHMgRG9tYWluTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8qdmFyIGF4ZXMgPSBuZXcgRVhQLkFyZWEoe1xuXHRcdGJvdW5kczogW1stMTAsMTBdLFxuXHRcdFx0WzEwLDEwXV1cblx0XHRudW1JdGVtczogMTA7IC8vb3B0aW9uYWwuIEFsdGVybmF0ZWx5IG51bUl0ZW1zIGNhbiB2YXJ5IGZvciBlYWNoIGF4aXM6IG51bUl0ZW1zOiBbMTAsMl1cblx0XHR9KSovXG5cblxuXHRcblx0XHRVdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiYm91bmRzXCIpOyAvLyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXlcblx0XHRVdGlscy5hc3NlcnRUeXBlKG9wdGlvbnMuYm91bmRzLCBBcnJheSk7XG5cdFx0VXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmJvdW5kc1swXSwgQXJyYXksIFwiRm9yIGFuIEFyZWEsIG9wdGlvbnMuYm91bmRzIG11c3QgYmUgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LCBldmVuIGZvciBvbmUgZGltZW5zaW9uIVwiKTsgLy8gaXQgTVVTVCBiZSBtdWx0aWRpbWVuc2lvbmFsXG5cdFx0dGhpcy5udW1EaW1lbnNpb25zID0gb3B0aW9ucy5ib3VuZHMubGVuZ3RoO1xuXG5cdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMuYm91bmRzWzBdLmxlbmd0aCAhPSAwKTsgLy9kb24ndCBhY2NlcHQgW1tdXSwgaXQgbmVlZHMgdG8gYmUgW1sxLDJdXS5cblxuXHRcdHRoaXMuYm91bmRzID0gb3B0aW9ucy5ib3VuZHM7XG5cdFx0dGhpcy5udW1JdGVtcyA9IG9wdGlvbnMubnVtSXRlbXMgfHwgMTY7XG5cblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdGlmKHRoaXMubnVtSXRlbXMuY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtRGltZW5zaW9ucztpKyspe1xuXHRcdFx0XHR0aGlzLml0ZW1EaW1lbnNpb25zLnB1c2godGhpcy5udW1JdGVtcyk7XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1JdGVtcy5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMubnVtSXRlbXMubGVuZ3RoID09IG9wdGlvbnMuYm91bmRzLmxlbmd0aCk7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtRGltZW5zaW9ucztpKyspe1xuXHRcdFx0XHR0aGlzLml0ZW1EaW1lbnNpb25zLnB1c2godGhpcy5udW1JdGVtc1tpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIHRpbWVzIGV2ZXJ5IGNoaWxkJ3MgZXhwciBpcyBjYWxsZWRcblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHRoaXMuaXRlbURpbWVuc2lvbnMucmVkdWNlKChzdW0seSk9PnN1bSp5KTtcblx0fVxuXHRhY3RpdmF0ZSh0KXtcblx0XHQvL1VzZSB0aGlzIHRvIGV2YWx1YXRlIGV4cHIoKSBhbmQgdXBkYXRlIHRoZSByZXN1bHQsIGNhc2NhZGUtc3R5bGUuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIGJvdW5kcyB0aGlzIG9iamVjdCBoYXMgd2lsbCBiZSB0aGUgbnVtYmVyIG9mIGRpbWVuc2lvbnMuXG5cdFx0Ly90aGUgZXhwcigpcyBhcmUgY2FsbGVkIHdpdGggZXhwcihpLCAuLi5bY29vcmRpbmF0ZXNdLCB0KSwgXG5cdFx0Ly9cdCh3aGVyZSBpIGlzIHRoZSBpbmRleCBvZiB0aGUgY3VycmVudCBldmFsdWF0aW9uID0gdGltZXMgZXhwcigpIGhhcyBiZWVuIGNhbGxlZCB0aGlzIGZyYW1lLCB0ID0gYWJzb2x1dGUgdGltZXN0ZXAgKHMpKS5cblx0XHQvL3BsZWFzZSBjYWxsIHdpdGggYSB0IHZhbHVlIG9idGFpbmVkIGZyb20gcGVyZm9ybWFuY2Uubm93KCkvMTAwMCBvciBzb21ldGhpbmcgbGlrZSB0aGF0XG5cblx0XHQvL25vdGUgdGhlIGxlc3MtdGhhbi1vci1lcXVhbC10byBpbiB0aGVzZSBsb29wc1xuXHRcdGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAxKXtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRsZXQgaW5kZXggPSBpO1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSwwLDAsMCk7XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1EaW1lbnNpb25zID09IDIpe1xuXHRcdFx0Ly90aGlzIGNhbiBiZSByZWR1Y2VkIGludG8gYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIG92ZXIgdGhlIGZpcnN0IGluZGV4IG9mIHRoaXMuYm91bmRzLCBJIGtub3cgaXRcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRmb3IodmFyIGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aisrKXtcblx0XHRcdFx0XHRsZXQgYzIgPSB0aGlzLmJvdW5kc1sxXVswXSArICh0aGlzLmJvdW5kc1sxXVsxXS10aGlzLmJvdW5kc1sxXVswXSkqKGovKHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSkpO1xuXHRcdFx0XHRcdGxldCBpbmRleCA9IGkqdGhpcy5pdGVtRGltZW5zaW9uc1sxXSArIGo7XG5cdFx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsYzIsMCwwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAzKXtcblx0XHRcdC8vdGhpcyBjYW4gYmUgcmVkdWNlZCBpbnRvIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSBvdmVyIHRoZSBmaXJzdCBpbmRleCBvZiB0aGlzLmJvdW5kcywgSSBrbm93IGl0XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0Zm9yKHZhciBqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzFdO2orKyl7XG5cdFx0XHRcdFx0bGV0IGMyID0gdGhpcy5ib3VuZHNbMV1bMF0gKyAodGhpcy5ib3VuZHNbMV1bMV0tdGhpcy5ib3VuZHNbMV1bMF0pKihqLyh0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTEpKTtcblx0XHRcdFx0XHRmb3IodmFyIGs9MDtrPHRoaXMuaXRlbURpbWVuc2lvbnNbMl07aysrKXtcblx0XHRcdFx0XHRcdGxldCBjMyA9IHRoaXMuYm91bmRzWzJdWzBdICsgKHRoaXMuYm91bmRzWzJdWzFdLXRoaXMuYm91bmRzWzJdWzBdKSooay8odGhpcy5pdGVtRGltZW5zaW9uc1syXS0xKSk7XG5cdFx0XHRcdFx0XHRsZXQgaW5kZXggPSAoaSp0aGlzLml0ZW1EaW1lbnNpb25zWzFdICsgaikqdGhpcy5pdGVtRGltZW5zaW9uc1syXSArIGs7XG5cdFx0XHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSxjMixjMywwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ZWxzZXtcblx0XHRcdGFzc2VydChcIlRPRE86IFVzZSBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgdG8gbG9vcCBvdmVyIGFsbCBpbmRpY2VzIVwiKTtcblx0XHR9XG5cblx0XHR0aGlzLm9uQWZ0ZXJBY3RpdmF0aW9uKCk7IC8vIGNhbGwgY2hpbGRyZW4gaWYgbmVjZXNzYXJ5XG5cdH1cblx0X2NhbGxBbGxDaGlsZHJlbiguLi5jb29yZGluYXRlcyl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpXG5cdFx0fVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEFyZWEoe2JvdW5kczogVXRpbHMuYXJyYXlDb3B5KHRoaXMuYm91bmRzKSwgbnVtSXRlbXM6IHRoaXMubnVtSXRlbXN9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHRcdGlmKGNsb25lLmNoaWxkcmVuW2ldLl9vbkFkZCljbG9uZS5jaGlsZHJlbltpXS5fb25BZGQoKTsgLy8gbmVjZXNzYXJ5IG5vdyB0aGF0IHRoZSBjaGFpbiBvZiBhZGRpbmcgaGFzIGJlZW4gZXN0YWJsaXNoZWRcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RBcmVhKCl7XG5cdHZhciB4ID0gbmV3IEFyZWEoe2JvdW5kczogW1swLDFdLFswLDFdXX0pO1xuXHR2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSl9fSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKCk7XG59XG5cbmV4cG9ydCB7IEFyZWEgfVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCBOb2RlIGZyb20gJy4vTm9kZS5qcyc7XG5cbi8vVXNhZ2U6IHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiBmdW5jdGlvbiguLi5hKXtjb25zb2xlLmxvZyguLi5hKX19KTtcbmNsYXNzIFRyYW5zZm9ybWF0aW9uIGV4dGVuZHMgTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblx0XG5cdFx0RVhQLlV0aWxzLmFzc2VydFByb3BFeGlzdHMob3B0aW9ucywgXCJleHByXCIpOyAvLyBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXlcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmV4cHIsIEZ1bmN0aW9uKTtcblxuXHRcdHRoaXMuZXhwciA9IG9wdGlvbnMuZXhwcjtcblx0fVxuXHRldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpe1xuXHRcdC8vZXZhbHVhdGUgdGhpcyBUcmFuc2Zvcm1hdGlvbidzIF9leHByLCBhbmQgYnJvYWRjYXN0IHRoZSByZXN1bHQgdG8gYWxsIGNoaWxkcmVuLlxuXHRcdGxldCByZXN1bHQgPSB0aGlzLmV4cHIoLi4uY29vcmRpbmF0ZXMpO1xuXHRcdGlmKHJlc3VsdC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpcmVzdWx0ID0gW3Jlc3VsdF07XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZihjb29yZGluYXRlc1swXSxjb29yZGluYXRlc1sxXSwgLi4ucmVzdWx0KVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCB0aGlzRXhwciA9IHRoaXMuZXhwcjtcblx0XHRsZXQgY2xvbmUgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IHRoaXNFeHByLmJpbmQoKX0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cblx0bWFrZUxpbmsoKXtcbiAgICAgICAgLy9saWtlIGEgY2xvbmUsIGJ1dCB3aWxsIHVzZSB0aGUgc2FtZSBleHByIGFzIHRoaXMgVHJhbnNmb3JtYXRpb24uXG4gICAgICAgIC8vdXNlZnVsIGlmIHRoZXJlJ3MgYSBzcGVjaWZpYyBmdW5jdGlvbiB0aGF0IG5lZWRzIHRvIGJlIHVzZWQgYnkgYSBidW5jaCBvZiBvYmplY3RzXG5cdFx0cmV0dXJuIG5ldyBMaW5rZWRUcmFuc2Zvcm1hdGlvbih0aGlzKTtcblx0fVxufVxuXG5jbGFzcyBMaW5rZWRUcmFuc2Zvcm1hdGlvbiBleHRlbmRzIE5vZGV7XG4gICAgLypcbiAgICAgICAgTGlrZSBhbiBFWFAuVHJhbnNmb3JtYXRpb24sIGJ1dCBpdCB1c2VzIGFuIGV4aXN0aW5nIEVYUC5UcmFuc2Zvcm1hdGlvbidzIGV4cHIoKSwgc28gaWYgdGhlIGxpbmtlZCB0cmFuc2Zvcm1hdGlvbiB1cGRhdGVzLCBzbyBkb2VzIHRoaXMgb25lLiBJdCdzIGxpa2UgYSBwb2ludGVyIHRvIGEgVHJhbnNmb3JtYXRpb24sIGJ1dCBpbiBvYmplY3QgZm9ybS4gXG4gICAgKi9cblx0Y29uc3RydWN0b3IodHJhbnNmb3JtYXRpb25Ub0xpbmtUbyl7XG5cdFx0c3VwZXIoe30pO1xuXHRcdEVYUC5VdGlscy5hc3NlcnRUeXBlKHRyYW5zZm9ybWF0aW9uVG9MaW5rVG8sIFRyYW5zZm9ybWF0aW9uKTtcbiAgICAgICAgdGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUgPSB0cmFuc2Zvcm1hdGlvblRvTGlua1RvO1xuXHR9XG5cdGV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcyl7XG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlLmV4cHIoLi4uY29vcmRpbmF0ZXMpO1xuXHRcdGlmKHJlc3VsdC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpcmVzdWx0ID0gW3Jlc3VsdF07XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZihjb29yZGluYXRlc1swXSxjb29yZGluYXRlc1sxXSwgLi4ucmVzdWx0KVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBMaW5rZWRUcmFuc2Zvcm1hdGlvbih0aGlzLmxpbmtlZFRyYW5zZm9ybWF0aW9uTm9kZSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxuXHRtYWtlTGluaygpe1xuXHRcdHJldHVybiBuZXcgTGlua2VkVHJhbnNmb3JtYXRpb24odGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUpO1xuXHR9XG59XG5cblxuXG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RUcmFuc2Zvcm1hdGlvbigpe1xuXHR2YXIgeCA9IG5ldyBBcmVhKHtib3VuZHM6IFtbLTEwLDEwXV19KTtcblx0dmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oeydleHByJzogKHgpID0+IGNvbnNvbGUubG9nKHgqeCl9KTtcblx0eC5hZGQoeSk7XG5cdHguYWN0aXZhdGUoKTsgLy8gc2hvdWxkIHJldHVybiAxMDAsIDgxLCA2NC4uLiAwLCAxLCA0Li4uIDEwMFxufVxuXG5leHBvcnQgeyBUcmFuc2Zvcm1hdGlvbiwgTGlua2VkVHJhbnNmb3JtYXRpb259XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5cbmNsYXNzIEhpc3RvcnlSZWNvcmRlciBleHRlbmRzIERvbWFpbk5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIENsYXNzIHRoYXQgcmVjb3JkcyB0aGUgbGFzdCBmZXcgdmFsdWVzIG9mIHRoZSBwYXJlbnQgVHJhbnNmb3JtYXRpb24gYW5kIG1ha2VzIHRoZW0gYXZhaWxhYmxlIGZvciB1c2UgYXMgYW4gZXh0cmEgZGltZW5zaW9uLlxuICAgICAgICAgICAgVXNhZ2U6XG4gICAgICAgICAgICB2YXIgcmVjb3JkZXIgPSBuZXcgSGlzdG9yeVJlY29yZGVyKHtcbiAgICAgICAgICAgICAgICBtZW1vcnlMZW5ndGg6IDEwIC8vIGhvdyBtYW55IHBhc3QgdmFsdWVzIHRvIHN0b3JlP1xuICAgICAgICAgICAgICAgIHJlY29yZEZyYW1lSW50ZXJ2YWw6IDE1Ly9Ib3cgbG9uZyB0byB3YWl0IGJldHdlZW4gZWFjaCBjYXB0dXJlPyBNZWFzdXJlZCBpbiBmcmFtZXMsIHNvIDYwID0gMSBjYXB0dXJlIHBlciBzZWNvbmQsIDMwID0gMiBjYXB0dXJlcy9zZWNvbmQsIGV0Yy5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBleGFtcGxlIHVzYWdlOlxuICAgICAgICAgICAgbmV3IEFyZWEoe2JvdW5kczogW1stNSw1XV19KS5hZGQobmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiAoaSx0LHgpID0+IFtNYXRoLnNpbih4KSxNYXRoLmNvcyh4KV19KSkuYWRkKG5ldyBFWFAuSGlzdG9yeVJlY29yZGVyKHttZW1vcnlMZW5ndGg6IDV9KS5hZGQobmV3IExpbmVPdXRwdXQoe3dpZHRoOiA1LCBjb2xvcjogMHhmZjAwMDB9KSk7XG5cbiAgICAgICAgICAgIE5PVEU6IEl0IGlzIGFzc3VtZWQgdGhhdCBhbnkgcGFyZW50IHRyYW5zZm9ybWF0aW9uIG91dHB1dHMgYW4gYXJyYXkgb2YgbnVtYmVycyB0aGF0IGlzIDQgb3IgbGVzcyBpbiBsZW5ndGguXG4gICAgICAgICovXG5cblx0XHR0aGlzLm1lbW9yeUxlbmd0aCA9IG9wdGlvbnMubWVtb3J5TGVuZ3RoID09PSB1bmRlZmluZWQgPyAxMCA6IG9wdGlvbnMubWVtb3J5TGVuZ3RoO1xuICAgICAgICB0aGlzLnJlY29yZEZyYW1lSW50ZXJ2YWwgPSBvcHRpb25zLnJlY29yZEZyYW1lSW50ZXJ2YWwgPT09IHVuZGVmaW5lZCA/IDE1IDogb3B0aW9ucy5yZWNvcmRGcmFtZUludGVydmFsOyAvL3NldCB0byAxIHRvIHJlY29yZCBldmVyeSBmcmFtZS5cbiAgICAgICAgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDQ7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/ICh0b2RvOiBhdXRvZGV0ZWN0IHRoaXMgZnJvbSBwYXJlbnQncyBvdXRwdXQpXG5cdFx0dGhpcy5jdXJyZW50SGlzdG9yeUluZGV4PTA7XG4gICAgICAgIHRoaXMuZnJhbWVSZWNvcmRUaW1lciA9IDA7XG5cdH1cblx0X29uQWRkKCl7XG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIEFyZWFcblx0XHRsZXQgcm9vdCA9IHRoaXMuZ2V0Q2xvc2VzdERvbWFpbigpO1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIHRoaXMubWVtb3J5TGVuZ3RoO1xuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSByb290Lml0ZW1EaW1lbnNpb25zLmNvbmNhdChbdGhpcy5tZW1vcnlMZW5ndGhdKTtcblxuICAgICAgICB0aGlzLmJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcbiAgICBcbiAgICAgICAgLy9UaGlzIGlzIHNvIHRoYXQgbm8gc3VyZmFjZS9ib3VuZGFyeSB3aWxsIGFwcGVhciB1bnRpbCBoaXN0b3J5IGJlZ2lucyB0byBiZSByZWNvcmRlZC4gSSdtIHNvIHNvcnJ5LlxuICAgICAgICAvL1RvZG86IHByb3BlciBjbGlwIHNoYWRlciBsaWtlIG1hdGhib3ggZG9lcyBvciBzb21ldGhpbmcuXG4gICAgICAgIHRoaXMuYnVmZmVyLmZpbGwoTmFOKTsgXG5cdH1cbiAgICBvbkFmdGVyQWN0aXZhdGlvbigpe1xuICAgICAgICBzdXBlci5vbkFmdGVyQWN0aXZhdGlvbigpO1xuXG4gICAgICAgIC8vZXZlcnkgc28gb2Z0ZW4sIHNoaWZ0IHRvIHRoZSBuZXh0IGJ1ZmZlciBzbG90XG4gICAgICAgIHRoaXMuZnJhbWVSZWNvcmRUaW1lciArPSAxO1xuICAgICAgICBpZih0aGlzLmZyYW1lUmVjb3JkVGltZXIgPj0gdGhpcy5yZWNvcmRGcmFtZUludGVydmFsKXtcbiAgICAgICAgICAgIC8vcmVzZXQgZnJhbWUgcmVjb3JkIHRpbWVyXG4gICAgICAgICAgICB0aGlzLmZyYW1lUmVjb3JkVGltZXIgPSAwO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4ID0gKHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCsxKSV0aGlzLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgfVxuICAgIH1cblx0ZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKXtcblx0XHQvL2V2YWx1YXRlIHRoaXMgVHJhbnNmb3JtYXRpb24ncyBfZXhwciwgYW5kIGJyb2FkY2FzdCB0aGUgcmVzdWx0IHRvIGFsbCBjaGlsZHJlbi5cblx0XHRsZXQgaSA9IGNvb3JkaW5hdGVzWzBdO1xuXHRcdGxldCB0ID0gY29vcmRpbmF0ZXNbMV07XG4gICAgXG4gICAgICAgIC8vc3RlcCAxOiBzYXZlIGNvb3JkaW5hdGVzIGZvciB0aGlzIGZyYW1lIGluIGJ1ZmZlclxuICAgICAgICBpZihjb29yZGluYXRlcy5sZW5ndGggPiAyK3RoaXMuX291dHB1dERpbWVuc2lvbnMpe1xuICAgICAgICAgICAgLy90b2RvOiBtYWtlIHRoaXMgdXBkYXRlIHRoaXMuX291dHB1dERpbWVuc2lvbnMgYW5kIHJlYWxsb2NhdGUgbW9yZSBidWZmZXIgc3BhY2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVYUC5IaXN0b3J5UmVjb3JkZXIgaXMgdW5hYmxlIHRvIHJlY29yZCBoaXN0b3J5IG9mIHNvbWV0aGluZyB0aGF0IG91dHB1dHMgaW4gXCIrdGhpcy5fb3V0cHV0RGltZW5zaW9ucytcIiBkaW1lbnNpb25zISBZZXQuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGN5Y2xpY0J1ZmZlckluZGV4ID0gKGkqdGhpcy5tZW1vcnlMZW5ndGgrdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4KSp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuICAgICAgICBmb3IodmFyIGo9MDtqPGNvb3JkaW5hdGVzLmxlbmd0aC0yO2orKyl7IFxuICAgICAgICAgICAgdGhpcy5idWZmZXJbY3ljbGljQnVmZmVySW5kZXgral0gPSBjb29yZGluYXRlc1syK2pdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9zdGVwIDI6LCBjYWxsIGFueSBjaGlsZHJlbiBvbmNlIHBlciBoaXN0b3J5IGl0ZW1cbiAgICAgICAgZm9yKHZhciBjaGlsZE5vPTA7Y2hpbGRObzx0aGlzLmNoaWxkcmVuLmxlbmd0aDtjaGlsZE5vKyspe1xuXHRcdCAgICBmb3IodmFyIGo9MDtqPHRoaXMubWVtb3J5TGVuZ3RoO2orKyl7XG5cbiAgICAgICAgICAgICAgICAvL3RoZSArMSBpbiAoaiArIHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCArIDEpIGlzIGltcG9ydGFudDsgd2l0aG91dCBpdCwgYSBMaW5lT3V0cHV0IHdpbGwgZHJhdyBhIGxpbmUgZnJvbSB0aGUgbW9zdCByZWNlbnQgdmFsdWUgdG8gdGhlIGVuZCBvZiBoaXN0b3J5XG4gICAgICAgICAgICAgICAgbGV0IGN5Y2xpY0hpc3RvcnlWYWx1ZSA9IChqICsgdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4ICsgMSkgJSB0aGlzLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgICAgICAgICBsZXQgY3ljbGljQnVmZmVySW5kZXggPSAoaSAqIHRoaXMubWVtb3J5TGVuZ3RoICsgY3ljbGljSGlzdG9yeVZhbHVlKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuICAgICAgICAgICAgICAgIGxldCBub25DeWNsaWNJbmRleCA9IGkgKiB0aGlzLm1lbW9yeUxlbmd0aCArIGo7XG5cblx0XHQgICAgICAgIC8vSSdtIHRvcm4gb24gd2hldGhlciB0byBhZGQgYSBmaW5hbCBjb29yZGluYXRlIGF0IHRoZSBlbmQgc28gaGlzdG9yeSBjYW4gZ28gb2ZmIGluIGEgbmV3IGRpcmVjdGlvbi5cbiAgICAgICAgICAgICAgICAvL3RoaXMuY2hpbGRyZW5bY2hpbGROb10uZXZhbHVhdGVTZWxmKG5vbkN5Y2xpY0luZGV4LHQsdGhpcy5idWZmZXJbY3ljbGljQnVmZmVySW5kZXhdLCBjeWNsaWNIaXN0b3J5VmFsdWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW5bY2hpbGROb10uZXZhbHVhdGVTZWxmKFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9uQ3ljbGljSW5kZXgsdCwgLy9pLHRcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuYnVmZmVyLnNsaWNlKGN5Y2xpY0J1ZmZlckluZGV4LGN5Y2xpY0J1ZmZlckluZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMpIC8vZXh0cmFjdCBjb29yZGluYXRlcyBmb3IgdGhpcyBoaXN0b3J5IHZhbHVlIGZyb20gYnVmZmVyXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEhpc3RvcnlSZWNvcmRlcih7bWVtb3J5TGVuZ3RoOiB0aGlzLm1lbW9yeUxlbmd0aCwgcmVjb3JkRnJhbWVJbnRlcnZhbDogdGhpcy5yZWNvcmRGcmFtZUludGVydmFsfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5leHBvcnQgeyBIaXN0b3J5UmVjb3JkZXIgfVxuIiwidmFyIHRocmVlRW52aXJvbm1lbnQgPSBudWxsO1xuXG5mdW5jdGlvbiBzZXRUaHJlZUVudmlyb25tZW50KG5ld0Vudil7XG4gICAgdGhyZWVFbnZpcm9ubWVudCA9IG5ld0Vudjtcbn1cbmV4cG9ydCB7c2V0VGhyZWVFbnZpcm9ubWVudCwgdGhyZWVFbnZpcm9ubWVudH07XG4iLCJpbXBvcnQgeyBVdGlscyB9IGZyb20gJy4vdXRpbHMuanMnO1xuXG5pbXBvcnQgeyBUcmFuc2Zvcm1hdGlvbiB9IGZyb20gJy4vVHJhbnNmb3JtYXRpb24uanMnO1xuXG5pbXBvcnQgKiBhcyBtYXRoIGZyb20gJy4vbWF0aC5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxuY2xhc3MgQW5pbWF0aW9ue1xuXHRjb25zdHJ1Y3Rvcih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbiwgc3RhZ2dlckZyYWN0aW9uKXtcblx0XHRVdGlscy5hc3NlcnRUeXBlKHRvVmFsdWVzLCBPYmplY3QpO1xuXG5cdFx0dGhpcy50b1ZhbHVlcyA9IHRvVmFsdWVzO1xuXHRcdHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1x0XG5cdFx0dGhpcy5zdGFnZ2VyRnJhY3Rpb24gPSBzdGFnZ2VyRnJhY3Rpb24gPT09IHVuZGVmaW5lZCA/IDAgOiBzdGFnZ2VyRnJhY3Rpb247IC8vIHRpbWUgaW4gbXMgYmV0d2VlbiBmaXJzdCBlbGVtZW50IGJlZ2lubmluZyB0aGUgYW5pbWF0aW9uIGFuZCBsYXN0IGVsZW1lbnQgYmVnaW5uaW5nIHRoZSBhbmltYXRpb24uIFNob3VsZCBiZSBsZXNzIHRoYW4gZHVyYXRpb24uXG5yXG5cblx0XHRVdGlscy5hc3NlcnQodGhpcy5zdGFnZ2VyRnJhY3Rpb24gPj0gMCAmJiB0aGlzLnN0YWdnZXJGcmFjdGlvbiA8IDEpO1xuXG5cdFx0dGhpcy5mcm9tVmFsdWVzID0ge307XG5cdFx0Zm9yKHZhciBwcm9wZXJ0eSBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdFV0aWxzLmFzc2VydFByb3BFeGlzdHModGhpcy50YXJnZXQsIHByb3BlcnR5KTtcblxuXHRcdFx0Ly9jb3B5IHByb3BlcnR5LCBtYWtpbmcgc3VyZSB0byBzdG9yZSB0aGUgY29ycmVjdCAndGhpcydcblx0XHRcdGlmKFV0aWxzLmlzRnVuY3Rpb24odGhpcy50YXJnZXRbcHJvcGVydHldKSl7XG5cdFx0XHRcdHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0gPSB0aGlzLnRhcmdldFtwcm9wZXJ0eV0uYmluZCh0aGlzLnRhcmdldCk7XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0dGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHRoaXMudGFyZ2V0W3Byb3BlcnR5XTtcblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbiA9PT0gdW5kZWZpbmVkID8gMSA6IGR1cmF0aW9uOyAvL2luIHNcblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblxuXG5cdFx0aWYodGFyZ2V0LmNvbnN0cnVjdG9yID09PSBUcmFuc2Zvcm1hdGlvbil7XG5cdFx0XHQvL2ZpbmQgb3V0IGhvdyBtYW55IG9iamVjdHMgYXJlIHBhc3NpbmcgdGhyb3VnaCB0aGlzIHRyYW5zZm9ybWF0aW9uXG5cdFx0XHRsZXQgcm9vdCA9IHRhcmdldDtcblx0XHRcdHdoaWxlKHJvb3QucGFyZW50ICE9PSBudWxsKXtcblx0XHRcdFx0cm9vdCA9IHJvb3QucGFyZW50O1xuXHRcdFx0fVxuXHRcdFx0dGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR9ZWxzZXtcblx0XHRcdGlmKHRoaXMuc3RhZ2dlckZyYWN0aW9uICE9IDApe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwic3RhZ2dlckZyYWN0aW9uIGNhbiBvbmx5IGJlIHVzZWQgd2hlbiBUcmFuc2l0aW9uVG8ncyB0YXJnZXQgaXMgYW4gRVhQLlRyYW5zZm9ybWF0aW9uIVwiKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL2JlZ2luXG5cdFx0dGhpcy5fdXBkYXRlQ2FsbGJhY2sgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpXG5cdFx0dGhyZWVFbnZpcm9ubWVudC5vbihcInVwZGF0ZVwiLHRoaXMuX3VwZGF0ZUNhbGxiYWNrKTtcblx0fVxuXHR1cGRhdGUodGltZSl7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSB0aW1lLmRlbHRhO1x0XG5cblx0XHRsZXQgcGVyY2VudGFnZSA9IHRoaXMuZWxhcHNlZFRpbWUvdGhpcy5kdXJhdGlvbjtcblxuXHRcdC8vaW50ZXJwb2xhdGUgdmFsdWVzXG5cdFx0Zm9yKGxldCBwcm9wZXJ0eSBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdHRoaXMuaW50ZXJwb2xhdGUocGVyY2VudGFnZSwgcHJvcGVydHksIHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0sdGhpcy50b1ZhbHVlc1twcm9wZXJ0eV0pO1xuXHRcdH1cblxuXHRcdGlmKHRoaXMuZWxhcHNlZFRpbWUgPj0gdGhpcy5kdXJhdGlvbil7XG5cdFx0XHR0aGlzLmVuZCgpO1xuXHRcdH1cblx0fVxuXHRpbnRlcnBvbGF0ZShwZXJjZW50YWdlLCBwcm9wZXJ0eU5hbWUsIGZyb21WYWx1ZSwgdG9WYWx1ZSl7XG5cdFx0Y29uc3QgbnVtT2JqZWN0cyA9IHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXG5cdFx0dmFyIG5ld1ZhbHVlID0gbnVsbDtcblx0XHRpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mKGZyb21WYWx1ZSkgPT09IFwibnVtYmVyXCIpe1xuXHRcdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BlcnR5TmFtZV0gPSB0KnRvVmFsdWUgKyAoMS10KSpmcm9tVmFsdWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXNGdW5jdGlvbih0b1ZhbHVlKSAmJiBVdGlscy5pc0Z1bmN0aW9uKGZyb21WYWx1ZSkpe1xuXHRcdFx0Ly9pZiBzdGFnZ2VyRnJhY3Rpb24gIT0gMCwgaXQncyB0aGUgYW1vdW50IG9mIHRpbWUgYmV0d2VlbiB0aGUgZmlyc3QgcG9pbnQncyBzdGFydCB0aW1lIGFuZCB0aGUgbGFzdCBwb2ludCdzIHN0YXJ0IHRpbWUuXG5cdFx0XHQvL0FTU1VNUFRJT046IHRoZSBmaXJzdCB2YXJpYWJsZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGksIGFuZCBpdCdzIGFzc3VtZWQgaSBpcyB6ZXJvLWluZGV4ZWQuXG5cblx0XHRcdC8vZW5jYXBzdWxhdGUgcGVyY2VudGFnZVxuXHRcdFx0dGhpcy50YXJnZXRbcHJvcGVydHlOYW1lXSA9IChmdW5jdGlvbihpLCAuLi5jb29yZHMpe1xuXHRcdFx0XHRsZXQgbGVycEZhY3RvciA9IHBlcmNlbnRhZ2UvKDEtdGhpcy5zdGFnZ2VyRnJhY3Rpb24pIC0gaSp0aGlzLnN0YWdnZXJGcmFjdGlvbi90aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHRcdFx0Ly9sZXQgcGVyY2VudCA9IE1hdGgubWluKE1hdGgubWF4KHBlcmNlbnRhZ2UgLSBpL3RoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uICAgLDEpLDApO1xuXG5cdFx0XHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24oTWF0aC5tYXgoTWF0aC5taW4obGVycEZhY3RvciwxKSwwKSk7XG5cdFx0XHRcdHJldHVybiBtYXRoLmxlcnBWZWN0b3JzKHQsdG9WYWx1ZShpLCAuLi5jb29yZHMpLGZyb21WYWx1ZShpLCAuLi5jb29yZHMpKVxuXHRcdFx0fSkuYmluZCh0aGlzKTtcblx0XHRcdHJldHVybjtcblx0XHR9ZWxzZXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJBbmltYXRpb24gY2xhc3MgY2Fubm90IHlldCBoYW5kbGUgdHJhbnNpdGlvbmluZyBiZXR3ZWVuIHRoaW5ncyB0aGF0IGFyZW4ndCBudW1iZXJzIG9yIGZ1bmN0aW9ucyFcIik7XG5cdFx0fVxuXG5cdH1cblx0aW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHgpe1xuXHRcdHJldHVybiB0aGlzLmNvc2luZUludGVycG9sYXRpb24oeCk7XG5cdH1cblx0Y29zaW5lSW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4gKDEtTWF0aC5jb3MoeCpNYXRoLlBJKSkvMjtcblx0fVxuXHRsaW5lYXJJbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiB4O1xuXHR9XG5cdGVuZCgpe1xuXHRcdGZvcih2YXIgcHJvcCBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BdID0gdGhpcy50b1ZhbHVlc1twcm9wXTtcblx0XHR9XG5cdFx0dGhyZWVFbnZpcm9ubWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwidXBkYXRlXCIsdGhpcy5fdXBkYXRlQ2FsbGJhY2spO1xuXHRcdC8vVG9kbzogZGVsZXRlIHRoaXNcblx0fVxufVxuXG4vL3RvZG86IHB1dCB0aGlzIGludG8gYSBEaXJlY3RvciBjbGFzcyBzbyB0aGF0IGl0IGNhbiBoYXZlIGFuIHVuZG8gc3RhY2tcbmZ1bmN0aW9uIFRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TLCBzdGFnZ2VyRnJhY3Rpb24pe1xuXHR2YXIgYW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDAsIHN0YWdnZXJGcmFjdGlvbik7XG59XG5cbmV4cG9ydCB7VHJhbnNpdGlvblRvLCBBbmltYXRpb259XG4iLCIoZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgbG9va3VwID0gW1xuXHRcdFx0J0EnLCAnQicsICdDJywgJ0QnLCAnRScsICdGJywgJ0cnLCAnSCcsXG5cdFx0XHQnSScsICdKJywgJ0snLCAnTCcsICdNJywgJ04nLCAnTycsICdQJyxcblx0XHRcdCdRJywgJ1InLCAnUycsICdUJywgJ1UnLCAnVicsICdXJywgJ1gnLFxuXHRcdFx0J1knLCAnWicsICdhJywgJ2InLCAnYycsICdkJywgJ2UnLCAnZicsXG5cdFx0XHQnZycsICdoJywgJ2knLCAnaicsICdrJywgJ2wnLCAnbScsICduJyxcblx0XHRcdCdvJywgJ3AnLCAncScsICdyJywgJ3MnLCAndCcsICd1JywgJ3YnLFxuXHRcdFx0J3cnLCAneCcsICd5JywgJ3onLCAnMCcsICcxJywgJzInLCAnMycsXG5cdFx0XHQnNCcsICc1JywgJzYnLCAnNycsICc4JywgJzknLCAnKycsICcvJ1xuXHRcdF07XG5cdGZ1bmN0aW9uIGNsZWFuKGxlbmd0aCkge1xuXHRcdHZhciBpLCBidWZmZXIgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuXHRcdGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0YnVmZmVyW2ldID0gMDtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdGZ1bmN0aW9uIGV4dGVuZChvcmlnLCBsZW5ndGgsIGFkZExlbmd0aCwgbXVsdGlwbGVPZikge1xuXHRcdHZhciBuZXdTaXplID0gbGVuZ3RoICsgYWRkTGVuZ3RoLFxuXHRcdFx0YnVmZmVyID0gY2xlYW4oKHBhcnNlSW50KG5ld1NpemUgLyBtdWx0aXBsZU9mKSArIDEpICogbXVsdGlwbGVPZik7XG5cblx0XHRidWZmZXIuc2V0KG9yaWcpO1xuXG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdGZ1bmN0aW9uIHBhZChudW0sIGJ5dGVzLCBiYXNlKSB7XG5cdFx0bnVtID0gbnVtLnRvU3RyaW5nKGJhc2UgfHwgOCk7XG5cdFx0cmV0dXJuIFwiMDAwMDAwMDAwMDAwXCIuc3Vic3RyKG51bS5sZW5ndGggKyAxMiAtIGJ5dGVzKSArIG51bTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN0cmluZ1RvVWludDggKGlucHV0LCBvdXQsIG9mZnNldCkge1xuXHRcdHZhciBpLCBsZW5ndGg7XG5cblx0XHRvdXQgPSBvdXQgfHwgY2xlYW4oaW5wdXQubGVuZ3RoKTtcblxuXHRcdG9mZnNldCA9IG9mZnNldCB8fCAwO1xuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IGlucHV0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRvdXRbb2Zmc2V0XSA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRvZmZzZXQgKz0gMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0O1xuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoO1xuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXTtcblx0XHR9O1xuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSk7XG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApO1xuXHRcdH1cblxuXHRcdC8vIHRoaXMgcHJldmVudHMgYW4gRVJSX0lOVkFMSURfVVJMIGluIENocm9tZSAoRmlyZWZveCBva2F5KVxuXHRcdHN3aXRjaCAob3V0cHV0Lmxlbmd0aCAlIDQpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0b3V0cHV0ICs9ICc9Jztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdG91dHB1dCArPSAnPT0nO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHR3aW5kb3cudXRpbHMgPSB7fVxuXHR3aW5kb3cudXRpbHMuY2xlYW4gPSBjbGVhbjtcblx0d2luZG93LnV0aWxzLnBhZCA9IHBhZDtcblx0d2luZG93LnV0aWxzLmV4dGVuZCA9IGV4dGVuZDtcblx0d2luZG93LnV0aWxzLnN0cmluZ1RvVWludDggPSBzdHJpbmdUb1VpbnQ4O1xuXHR3aW5kb3cudXRpbHMudWludDhUb0Jhc2U2NCA9IHVpbnQ4VG9CYXNlNjQ7XG59KCkpO1xuXG4oZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuLypcbnN0cnVjdCBwb3NpeF9oZWFkZXIgeyAgICAgICAgICAgICAvLyBieXRlIG9mZnNldFxuXHRjaGFyIG5hbWVbMTAwXTsgICAgICAgICAgICAgICAvLyAgIDBcblx0Y2hhciBtb2RlWzhdOyAgICAgICAgICAgICAgICAgLy8gMTAwXG5cdGNoYXIgdWlkWzhdOyAgICAgICAgICAgICAgICAgIC8vIDEwOFxuXHRjaGFyIGdpZFs4XTsgICAgICAgICAgICAgICAgICAvLyAxMTZcblx0Y2hhciBzaXplWzEyXTsgICAgICAgICAgICAgICAgLy8gMTI0XG5cdGNoYXIgbXRpbWVbMTJdOyAgICAgICAgICAgICAgIC8vIDEzNlxuXHRjaGFyIGNoa3N1bVs4XTsgICAgICAgICAgICAgICAvLyAxNDhcblx0Y2hhciB0eXBlZmxhZzsgICAgICAgICAgICAgICAgLy8gMTU2XG5cdGNoYXIgbGlua25hbWVbMTAwXTsgICAgICAgICAgIC8vIDE1N1xuXHRjaGFyIG1hZ2ljWzZdOyAgICAgICAgICAgICAgICAvLyAyNTdcblx0Y2hhciB2ZXJzaW9uWzJdOyAgICAgICAgICAgICAgLy8gMjYzXG5cdGNoYXIgdW5hbWVbMzJdOyAgICAgICAgICAgICAgIC8vIDI2NVxuXHRjaGFyIGduYW1lWzMyXTsgICAgICAgICAgICAgICAvLyAyOTdcblx0Y2hhciBkZXZtYWpvcls4XTsgICAgICAgICAgICAgLy8gMzI5XG5cdGNoYXIgZGV2bWlub3JbOF07ICAgICAgICAgICAgIC8vIDMzN1xuXHRjaGFyIHByZWZpeFsxNTVdOyAgICAgICAgICAgICAvLyAzNDVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyA1MDBcbn07XG4qL1xuXG5cdHZhciB1dGlscyA9IHdpbmRvdy51dGlscyxcblx0XHRoZWFkZXJGb3JtYXQ7XG5cblx0aGVhZGVyRm9ybWF0ID0gW1xuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlTmFtZScsXG5cdFx0XHQnbGVuZ3RoJzogMTAwXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZU1vZGUnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd1aWQnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdnaWQnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlU2l6ZScsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtdGltZScsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdjaGVja3N1bScsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3R5cGUnLFxuXHRcdFx0J2xlbmd0aCc6IDFcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdsaW5rTmFtZScsXG5cdFx0XHQnbGVuZ3RoJzogMTAwXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndXN0YXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdvd25lcicsXG5cdFx0XHQnbGVuZ3RoJzogMzJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdncm91cCcsXG5cdFx0XHQnbGVuZ3RoJzogMzJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtYWpvck51bWJlcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ21pbm9yTnVtYmVyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZW5hbWVQcmVmaXgnLFxuXHRcdFx0J2xlbmd0aCc6IDE1NVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3BhZGRpbmcnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fVxuXHRdO1xuXG5cdGZ1bmN0aW9uIGZvcm1hdEhlYWRlcihkYXRhLCBjYikge1xuXHRcdHZhciBidWZmZXIgPSB1dGlscy5jbGVhbig1MTIpLFxuXHRcdFx0b2Zmc2V0ID0gMDtcblxuXHRcdGhlYWRlckZvcm1hdC5mb3JFYWNoKGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0dmFyIHN0ciA9IGRhdGFbdmFsdWUuZmllbGRdIHx8IFwiXCIsXG5cdFx0XHRcdGksIGxlbmd0aDtcblxuXHRcdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gc3RyLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRcdGJ1ZmZlcltvZmZzZXRdID0gc3RyLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRcdG9mZnNldCArPSAxO1xuXHRcdFx0fVxuXG5cdFx0XHRvZmZzZXQgKz0gdmFsdWUubGVuZ3RoIC0gaTsgLy8gc3BhY2UgaXQgb3V0IHdpdGggbnVsbHNcblx0XHR9KTtcblxuXHRcdGlmICh0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiBjYihidWZmZXIsIG9mZnNldCk7XG5cdFx0fVxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHR3aW5kb3cuaGVhZGVyID0ge31cblx0d2luZG93LmhlYWRlci5zdHJ1Y3R1cmUgPSBoZWFkZXJGb3JtYXQ7XG5cdHdpbmRvdy5oZWFkZXIuZm9ybWF0ID0gZm9ybWF0SGVhZGVyO1xufSgpKTtcblxuKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIGhlYWRlciA9IHdpbmRvdy5oZWFkZXIsXG5cdFx0dXRpbHMgPSB3aW5kb3cudXRpbHMsXG5cdFx0cmVjb3JkU2l6ZSA9IDUxMixcblx0XHRibG9ja1NpemU7XG5cblx0ZnVuY3Rpb24gVGFyKHJlY29yZHNQZXJCbG9jaykge1xuXHRcdHRoaXMud3JpdHRlbiA9IDA7XG5cdFx0YmxvY2tTaXplID0gKHJlY29yZHNQZXJCbG9jayB8fCAyMCkgKiByZWNvcmRTaXplO1xuXHRcdHRoaXMub3V0ID0gdXRpbHMuY2xlYW4oYmxvY2tTaXplKTtcblx0XHR0aGlzLmJsb2NrcyA9IFtdO1xuXHRcdHRoaXMubGVuZ3RoID0gMDtcblx0fVxuXG5cdFRhci5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24gKGZpbGVwYXRoLCBpbnB1dCwgb3B0cywgY2FsbGJhY2spIHtcblx0XHR2YXIgZGF0YSxcblx0XHRcdGNoZWNrc3VtLFxuXHRcdFx0bW9kZSxcblx0XHRcdG10aW1lLFxuXHRcdFx0dWlkLFxuXHRcdFx0Z2lkLFxuXHRcdFx0aGVhZGVyQXJyO1xuXG5cdFx0aWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGlucHV0ID0gdXRpbHMuc3RyaW5nVG9VaW50OChpbnB1dCk7XG5cdFx0fSBlbHNlIGlmIChpbnB1dC5jb25zdHJ1Y3RvciAhPT0gVWludDhBcnJheS5wcm90b3R5cGUuY29uc3RydWN0b3IpIHtcblx0XHRcdHRocm93ICdJbnZhbGlkIGlucHV0IHR5cGUuIFlvdSBnYXZlIG1lOiAnICsgaW5wdXQuY29uc3RydWN0b3IudG9TdHJpbmcoKS5tYXRjaCgvZnVuY3Rpb25cXHMqKFskQS1aYS16X11bMC05QS1aYS16X10qKVxccypcXCgvKVsxXTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGNhbGxiYWNrID0gb3B0cztcblx0XHRcdG9wdHMgPSB7fTtcblx0XHR9XG5cblx0XHRvcHRzID0gb3B0cyB8fCB7fTtcblxuXHRcdG1vZGUgPSBvcHRzLm1vZGUgfHwgcGFyc2VJbnQoJzc3NycsIDgpICYgMHhmZmY7XG5cdFx0bXRpbWUgPSBvcHRzLm10aW1lIHx8IE1hdGguZmxvb3IoK25ldyBEYXRlKCkgLyAxMDAwKTtcblx0XHR1aWQgPSBvcHRzLnVpZCB8fCAwO1xuXHRcdGdpZCA9IG9wdHMuZ2lkIHx8IDA7XG5cblx0XHRkYXRhID0ge1xuXHRcdFx0ZmlsZU5hbWU6IGZpbGVwYXRoLFxuXHRcdFx0ZmlsZU1vZGU6IHV0aWxzLnBhZChtb2RlLCA3KSxcblx0XHRcdHVpZDogdXRpbHMucGFkKHVpZCwgNyksXG5cdFx0XHRnaWQ6IHV0aWxzLnBhZChnaWQsIDcpLFxuXHRcdFx0ZmlsZVNpemU6IHV0aWxzLnBhZChpbnB1dC5sZW5ndGgsIDExKSxcblx0XHRcdG10aW1lOiB1dGlscy5wYWQobXRpbWUsIDExKSxcblx0XHRcdGNoZWNrc3VtOiAnICAgICAgICAnLFxuXHRcdFx0dHlwZTogJzAnLCAvLyBqdXN0IGEgZmlsZVxuXHRcdFx0dXN0YXI6ICd1c3RhciAgJyxcblx0XHRcdG93bmVyOiBvcHRzLm93bmVyIHx8ICcnLFxuXHRcdFx0Z3JvdXA6IG9wdHMuZ3JvdXAgfHwgJydcblx0XHR9O1xuXG5cdFx0Ly8gY2FsY3VsYXRlIHRoZSBjaGVja3N1bVxuXHRcdGNoZWNrc3VtID0gMDtcblx0XHRPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdHZhciBpLCB2YWx1ZSA9IGRhdGFba2V5XSwgbGVuZ3RoO1xuXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB2YWx1ZS5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0XHRjaGVja3N1bSArPSB2YWx1ZS5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0ZGF0YS5jaGVja3N1bSA9IHV0aWxzLnBhZChjaGVja3N1bSwgNikgKyBcIlxcdTAwMDAgXCI7XG5cblx0XHRoZWFkZXJBcnIgPSBoZWFkZXIuZm9ybWF0KGRhdGEpO1xuXG5cdFx0dmFyIGhlYWRlckxlbmd0aCA9IE1hdGguY2VpbCggaGVhZGVyQXJyLmxlbmd0aCAvIHJlY29yZFNpemUgKSAqIHJlY29yZFNpemU7XG5cdFx0dmFyIGlucHV0TGVuZ3RoID0gTWF0aC5jZWlsKCBpbnB1dC5sZW5ndGggLyByZWNvcmRTaXplICkgKiByZWNvcmRTaXplO1xuXG5cdFx0dGhpcy5ibG9ja3MucHVzaCggeyBoZWFkZXI6IGhlYWRlckFyciwgaW5wdXQ6IGlucHV0LCBoZWFkZXJMZW5ndGg6IGhlYWRlckxlbmd0aCwgaW5wdXRMZW5ndGg6IGlucHV0TGVuZ3RoIH0gKTtcblxuXHR9O1xuXG5cdFRhci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGJ1ZmZlcnMgPSBbXTtcblx0XHR2YXIgY2h1bmtzID0gW107XG5cdFx0dmFyIGxlbmd0aCA9IDA7XG5cdFx0dmFyIG1heCA9IE1hdGgucG93KCAyLCAyMCApO1xuXG5cdFx0dmFyIGNodW5rID0gW107XG5cdFx0dGhpcy5ibG9ja3MuZm9yRWFjaCggZnVuY3Rpb24oIGIgKSB7XG5cdFx0XHRpZiggbGVuZ3RoICsgYi5oZWFkZXJMZW5ndGggKyBiLmlucHV0TGVuZ3RoID4gbWF4ICkge1xuXHRcdFx0XHRjaHVua3MucHVzaCggeyBibG9ja3M6IGNodW5rLCBsZW5ndGg6IGxlbmd0aCB9ICk7XG5cdFx0XHRcdGNodW5rID0gW107XG5cdFx0XHRcdGxlbmd0aCA9IDA7XG5cdFx0XHR9XG5cdFx0XHRjaHVuay5wdXNoKCBiICk7XG5cdFx0XHRsZW5ndGggKz0gYi5oZWFkZXJMZW5ndGggKyBiLmlucHV0TGVuZ3RoO1xuXHRcdH0gKTtcblx0XHRjaHVua3MucHVzaCggeyBibG9ja3M6IGNodW5rLCBsZW5ndGg6IGxlbmd0aCB9ICk7XG5cblx0XHRjaHVua3MuZm9yRWFjaCggZnVuY3Rpb24oIGMgKSB7XG5cblx0XHRcdHZhciBidWZmZXIgPSBuZXcgVWludDhBcnJheSggYy5sZW5ndGggKTtcblx0XHRcdHZhciB3cml0dGVuID0gMDtcblx0XHRcdGMuYmxvY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBiICkge1xuXHRcdFx0XHRidWZmZXIuc2V0KCBiLmhlYWRlciwgd3JpdHRlbiApO1xuXHRcdFx0XHR3cml0dGVuICs9IGIuaGVhZGVyTGVuZ3RoO1xuXHRcdFx0XHRidWZmZXIuc2V0KCBiLmlucHV0LCB3cml0dGVuICk7XG5cdFx0XHRcdHdyaXR0ZW4gKz0gYi5pbnB1dExlbmd0aDtcblx0XHRcdH0gKTtcblx0XHRcdGJ1ZmZlcnMucHVzaCggYnVmZmVyICk7XG5cblx0XHR9ICk7XG5cblx0XHRidWZmZXJzLnB1c2goIG5ldyBVaW50OEFycmF5KCAyICogcmVjb3JkU2l6ZSApICk7XG5cblx0XHRyZXR1cm4gbmV3IEJsb2IoIGJ1ZmZlcnMsIHsgdHlwZTogJ29jdGV0L3N0cmVhbScgfSApO1xuXG5cdH07XG5cblx0VGFyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLndyaXR0ZW4gPSAwO1xuXHRcdHRoaXMub3V0ID0gdXRpbHMuY2xlYW4oYmxvY2tTaXplKTtcblx0fTtcblxuICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gVGFyO1xuICB9IGVsc2Uge1xuICAgIHdpbmRvdy5UYXIgPSBUYXI7XG4gIH1cbn0oKSk7XG4iLCIvL2Rvd25sb2FkLmpzIHYzLjAsIGJ5IGRhbmRhdmlzOyAyMDA4LTIwMTQuIFtDQ0JZMl0gc2VlIGh0dHA6Ly9kYW5tbC5jb20vZG93bmxvYWQuaHRtbCBmb3IgdGVzdHMvdXNhZ2Vcbi8vIHYxIGxhbmRlZCBhIEZGK0Nocm9tZSBjb21wYXQgd2F5IG9mIGRvd25sb2FkaW5nIHN0cmluZ3MgdG8gbG9jYWwgdW4tbmFtZWQgZmlsZXMsIHVwZ3JhZGVkIHRvIHVzZSBhIGhpZGRlbiBmcmFtZSBhbmQgb3B0aW9uYWwgbWltZVxuLy8gdjIgYWRkZWQgbmFtZWQgZmlsZXMgdmlhIGFbZG93bmxvYWRdLCBtc1NhdmVCbG9iLCBJRSAoMTArKSBzdXBwb3J0LCBhbmQgd2luZG93LlVSTCBzdXBwb3J0IGZvciBsYXJnZXIrZmFzdGVyIHNhdmVzIHRoYW4gZGF0YVVSTHNcbi8vIHYzIGFkZGVkIGRhdGFVUkwgYW5kIEJsb2IgSW5wdXQsIGJpbmQtdG9nZ2xlIGFyaXR5LCBhbmQgbGVnYWN5IGRhdGFVUkwgZmFsbGJhY2sgd2FzIGltcHJvdmVkIHdpdGggZm9yY2UtZG93bmxvYWQgbWltZSBhbmQgYmFzZTY0IHN1cHBvcnRcblxuLy8gZGF0YSBjYW4gYmUgYSBzdHJpbmcsIEJsb2IsIEZpbGUsIG9yIGRhdGFVUkxcblxuXG5cblxuZnVuY3Rpb24gZG93bmxvYWQoZGF0YSwgc3RyRmlsZU5hbWUsIHN0ck1pbWVUeXBlKSB7XG5cblx0dmFyIHNlbGYgPSB3aW5kb3csIC8vIHRoaXMgc2NyaXB0IGlzIG9ubHkgZm9yIGJyb3dzZXJzIGFueXdheS4uLlxuXHRcdHUgPSBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiLCAvLyB0aGlzIGRlZmF1bHQgbWltZSBhbHNvIHRyaWdnZXJzIGlmcmFtZSBkb3dubG9hZHNcblx0XHRtID0gc3RyTWltZVR5cGUgfHwgdSxcblx0XHR4ID0gZGF0YSxcblx0XHREID0gZG9jdW1lbnQsXG5cdFx0YSA9IEQuY3JlYXRlRWxlbWVudChcImFcIiksXG5cdFx0eiA9IGZ1bmN0aW9uKGEpe3JldHVybiBTdHJpbmcoYSk7fSxcblxuXG5cdFx0QiA9IHNlbGYuQmxvYiB8fCBzZWxmLk1vekJsb2IgfHwgc2VsZi5XZWJLaXRCbG9iIHx8IHosXG5cdFx0QkIgPSBzZWxmLk1TQmxvYkJ1aWxkZXIgfHwgc2VsZi5XZWJLaXRCbG9iQnVpbGRlciB8fCBzZWxmLkJsb2JCdWlsZGVyLFxuXHRcdGZuID0gc3RyRmlsZU5hbWUgfHwgXCJkb3dubG9hZFwiLFxuXHRcdGJsb2IsXG5cdFx0Yixcblx0XHR1YSxcblx0XHRmcjtcblxuXHQvL2lmKHR5cGVvZiBCLmJpbmQgPT09ICdmdW5jdGlvbicgKXsgQj1CLmJpbmQoc2VsZik7IH1cblxuXHRpZihTdHJpbmcodGhpcyk9PT1cInRydWVcIil7IC8vcmV2ZXJzZSBhcmd1bWVudHMsIGFsbG93aW5nIGRvd25sb2FkLmJpbmQodHJ1ZSwgXCJ0ZXh0L3htbFwiLCBcImV4cG9ydC54bWxcIikgdG8gYWN0IGFzIGEgY2FsbGJhY2tcblx0XHR4PVt4LCBtXTtcblx0XHRtPXhbMF07XG5cdFx0eD14WzFdO1xuXHR9XG5cblxuXG5cdC8vZ28gYWhlYWQgYW5kIGRvd25sb2FkIGRhdGFVUkxzIHJpZ2h0IGF3YXlcblx0aWYoU3RyaW5nKHgpLm1hdGNoKC9eZGF0YVxcOltcXHcrXFwtXStcXC9bXFx3K1xcLV0rWyw7XS8pKXtcblx0XHRyZXR1cm4gbmF2aWdhdG9yLm1zU2F2ZUJsb2IgPyAgLy8gSUUxMCBjYW4ndCBkbyBhW2Rvd25sb2FkXSwgb25seSBCbG9iczpcblx0XHRcdG5hdmlnYXRvci5tc1NhdmVCbG9iKGQyYih4KSwgZm4pIDpcblx0XHRcdHNhdmVyKHgpIDsgLy8gZXZlcnlvbmUgZWxzZSBjYW4gc2F2ZSBkYXRhVVJMcyB1bi1wcm9jZXNzZWRcblx0fS8vZW5kIGlmIGRhdGFVUkwgcGFzc2VkP1xuXG5cdHRyeXtcblxuXHRcdGJsb2IgPSB4IGluc3RhbmNlb2YgQiA/XG5cdFx0XHR4IDpcblx0XHRcdG5ldyBCKFt4XSwge3R5cGU6IG19KSA7XG5cdH1jYXRjaCh5KXtcblx0XHRpZihCQil7XG5cdFx0XHRiID0gbmV3IEJCKCk7XG5cdFx0XHRiLmFwcGVuZChbeF0pO1xuXHRcdFx0YmxvYiA9IGIuZ2V0QmxvYihtKTsgLy8gdGhlIGJsb2Jcblx0XHR9XG5cblx0fVxuXG5cblxuXHRmdW5jdGlvbiBkMmIodSkge1xuXHRcdHZhciBwPSB1LnNwbGl0KC9bOjssXS8pLFxuXHRcdHQ9IHBbMV0sXG5cdFx0ZGVjPSBwWzJdID09IFwiYmFzZTY0XCIgPyBhdG9iIDogZGVjb2RlVVJJQ29tcG9uZW50LFxuXHRcdGJpbj0gZGVjKHAucG9wKCkpLFxuXHRcdG14PSBiaW4ubGVuZ3RoLFxuXHRcdGk9IDAsXG5cdFx0dWlhPSBuZXcgVWludDhBcnJheShteCk7XG5cblx0XHRmb3IoaTtpPG14OysraSkgdWlhW2ldPSBiaW4uY2hhckNvZGVBdChpKTtcblxuXHRcdHJldHVybiBuZXcgQihbdWlhXSwge3R5cGU6IHR9KTtcblx0IH1cblxuXHRmdW5jdGlvbiBzYXZlcih1cmwsIHdpbk1vZGUpe1xuXG5cblx0XHRpZiAoJ2Rvd25sb2FkJyBpbiBhKSB7IC8vaHRtbDUgQVtkb3dubG9hZF1cblx0XHRcdGEuaHJlZiA9IHVybDtcblx0XHRcdGEuc2V0QXR0cmlidXRlKFwiZG93bmxvYWRcIiwgZm4pO1xuXHRcdFx0YS5pbm5lckhUTUwgPSBcImRvd25sb2FkaW5nLi4uXCI7XG5cdFx0XHRhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRELmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRhLmNsaWNrKCk7XG5cdFx0XHRcdEQuYm9keS5yZW1vdmVDaGlsZChhKTtcblx0XHRcdFx0aWYod2luTW9kZT09PXRydWUpe3NldFRpbWVvdXQoZnVuY3Rpb24oKXsgc2VsZi5VUkwucmV2b2tlT2JqZWN0VVJMKGEuaHJlZik7fSwgMjUwICk7fVxuXHRcdFx0fSwgNjYpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly9kbyBpZnJhbWUgZGF0YVVSTCBkb3dubG9hZCAob2xkIGNoK0ZGKTpcblx0XHR2YXIgZiA9IEQuY3JlYXRlRWxlbWVudChcImlmcmFtZVwiKTtcblx0XHRELmJvZHkuYXBwZW5kQ2hpbGQoZik7XG5cdFx0aWYoIXdpbk1vZGUpeyAvLyBmb3JjZSBhIG1pbWUgdGhhdCB3aWxsIGRvd25sb2FkOlxuXHRcdFx0dXJsPVwiZGF0YTpcIit1cmwucmVwbGFjZSgvXmRhdGE6KFtcXHdcXC9cXC1cXCtdKykvLCB1KTtcblx0XHR9XG5cblxuXHRcdGYuc3JjID0gdXJsO1xuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXsgRC5ib2R5LnJlbW92ZUNoaWxkKGYpOyB9LCAzMzMpO1xuXG5cdH0vL2VuZCBzYXZlclxuXG5cblx0aWYgKG5hdmlnYXRvci5tc1NhdmVCbG9iKSB7IC8vIElFMTArIDogKGhhcyBCbG9iLCBidXQgbm90IGFbZG93bmxvYWRdIG9yIFVSTClcblx0XHRyZXR1cm4gbmF2aWdhdG9yLm1zU2F2ZUJsb2IoYmxvYiwgZm4pO1xuXHR9XG5cblx0aWYoc2VsZi5VUkwpeyAvLyBzaW1wbGUgZmFzdCBhbmQgbW9kZXJuIHdheSB1c2luZyBCbG9iIGFuZCBVUkw6XG5cdFx0c2F2ZXIoc2VsZi5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpLCB0cnVlKTtcblx0fWVsc2V7XG5cdFx0Ly8gaGFuZGxlIG5vbi1CbG9iKCkrbm9uLVVSTCBicm93c2Vyczpcblx0XHRpZih0eXBlb2YgYmxvYiA9PT0gXCJzdHJpbmdcIiB8fCBibG9iLmNvbnN0cnVjdG9yPT09eiApe1xuXHRcdFx0dHJ5e1xuXHRcdFx0XHRyZXR1cm4gc2F2ZXIoIFwiZGF0YTpcIiArICBtICAgKyBcIjtiYXNlNjQsXCIgICsgIHNlbGYuYnRvYShibG9iKSAgKTtcblx0XHRcdH1jYXRjaCh5KXtcblx0XHRcdFx0cmV0dXJuIHNhdmVyKCBcImRhdGE6XCIgKyAgbSAgICsgXCIsXCIgKyBlbmNvZGVVUklDb21wb25lbnQoYmxvYikgICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQmxvYiBidXQgbm90IFVSTDpcblx0XHRmcj1uZXcgRmlsZVJlYWRlcigpO1xuXHRcdGZyLm9ubG9hZD1mdW5jdGlvbihlKXtcblx0XHRcdHNhdmVyKHRoaXMucmVzdWx0KTtcblx0XHR9O1xuXHRcdGZyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG5cdH1cblx0cmV0dXJuIHRydWU7XG59IC8qIGVuZCBkb3dubG9hZCgpICovXG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZG93bmxvYWQ7XG59XG4iLCIvLyBnaWYuanMgMC4yLjAgLSBodHRwczovL2dpdGh1Yi5jb20vam5vcmRiZXJnL2dpZi5qc1xyXG4oZnVuY3Rpb24oZil7aWYodHlwZW9mIGV4cG9ydHM9PT1cIm9iamVjdFwiJiZ0eXBlb2YgbW9kdWxlIT09XCJ1bmRlZmluZWRcIil7bW9kdWxlLmV4cG9ydHM9ZigpfWVsc2UgaWYodHlwZW9mIGRlZmluZT09PVwiZnVuY3Rpb25cIiYmZGVmaW5lLmFtZCl7ZGVmaW5lKFtdLGYpfWVsc2V7dmFyIGc7aWYodHlwZW9mIHdpbmRvdyE9PVwidW5kZWZpbmVkXCIpe2c9d2luZG93fWVsc2UgaWYodHlwZW9mIGdsb2JhbCE9PVwidW5kZWZpbmVkXCIpe2c9Z2xvYmFsfWVsc2UgaWYodHlwZW9mIHNlbGYhPT1cInVuZGVmaW5lZFwiKXtnPXNlbGZ9ZWxzZXtnPXRoaXN9Zy5HSUY9ZigpfX0pKGZ1bmN0aW9uKCl7dmFyIGRlZmluZSxtb2R1bGUsZXhwb3J0cztyZXR1cm4gZnVuY3Rpb24oKXtmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc31yZXR1cm4gZX0oKSh7MTpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7ZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCl7dGhpcy5fZXZlbnRzPXRoaXMuX2V2ZW50c3x8e307dGhpcy5fbWF4TGlzdGVuZXJzPXRoaXMuX21heExpc3RlbmVyc3x8dW5kZWZpbmVkfW1vZHVsZS5leHBvcnRzPUV2ZW50RW1pdHRlcjtFdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyPUV2ZW50RW1pdHRlcjtFdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHM9dW5kZWZpbmVkO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycz11bmRlZmluZWQ7RXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM9MTA7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnM9ZnVuY3Rpb24obil7aWYoIWlzTnVtYmVyKG4pfHxuPDB8fGlzTmFOKG4pKXRocm93IFR5cGVFcnJvcihcIm4gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiKTt0aGlzLl9tYXhMaXN0ZW5lcnM9bjtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0PWZ1bmN0aW9uKHR5cGUpe3ZhciBlcixoYW5kbGVyLGxlbixhcmdzLGksbGlzdGVuZXJzO2lmKCF0aGlzLl9ldmVudHMpdGhpcy5fZXZlbnRzPXt9O2lmKHR5cGU9PT1cImVycm9yXCIpe2lmKCF0aGlzLl9ldmVudHMuZXJyb3J8fGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikmJiF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKXtlcj1hcmd1bWVudHNbMV07aWYoZXIgaW5zdGFuY2VvZiBFcnJvcil7dGhyb3cgZXJ9ZWxzZXt2YXIgZXJyPW5ldyBFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4gKCcrZXIrXCIpXCIpO2Vyci5jb250ZXh0PWVyO3Rocm93IGVycn19fWhhbmRsZXI9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzVW5kZWZpbmVkKGhhbmRsZXIpKXJldHVybiBmYWxzZTtpZihpc0Z1bmN0aW9uKGhhbmRsZXIpKXtzd2l0Y2goYXJndW1lbnRzLmxlbmd0aCl7Y2FzZSAxOmhhbmRsZXIuY2FsbCh0aGlzKTticmVhaztjYXNlIDI6aGFuZGxlci5jYWxsKHRoaXMsYXJndW1lbnRzWzFdKTticmVhaztjYXNlIDM6aGFuZGxlci5jYWxsKHRoaXMsYXJndW1lbnRzWzFdLGFyZ3VtZW50c1syXSk7YnJlYWs7ZGVmYXVsdDphcmdzPUFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKTtoYW5kbGVyLmFwcGx5KHRoaXMsYXJncyl9fWVsc2UgaWYoaXNPYmplY3QoaGFuZGxlcikpe2FyZ3M9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpO2xpc3RlbmVycz1oYW5kbGVyLnNsaWNlKCk7bGVuPWxpc3RlbmVycy5sZW5ndGg7Zm9yKGk9MDtpPGxlbjtpKyspbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsYXJncyl9cmV0dXJuIHRydWV9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7dmFyIG07aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTtpZighdGhpcy5fZXZlbnRzKXRoaXMuX2V2ZW50cz17fTtpZih0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpdGhpcy5lbWl0KFwibmV3TGlzdGVuZXJcIix0eXBlLGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpP2xpc3RlbmVyLmxpc3RlbmVyOmxpc3RlbmVyKTtpZighdGhpcy5fZXZlbnRzW3R5cGVdKXRoaXMuX2V2ZW50c1t0eXBlXT1saXN0ZW5lcjtlbHNlIGlmKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO2Vsc2UgdGhpcy5fZXZlbnRzW3R5cGVdPVt0aGlzLl9ldmVudHNbdHlwZV0sbGlzdGVuZXJdO2lmKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkmJiF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKXtpZighaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSl7bT10aGlzLl9tYXhMaXN0ZW5lcnN9ZWxzZXttPUV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzfWlmKG0mJm0+MCYmdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aD5tKXt0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkPXRydWU7Y29uc29sZS5lcnJvcihcIihub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5IFwiK1wibGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiBcIitcIlVzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LlwiLHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO2lmKHR5cGVvZiBjb25zb2xlLnRyYWNlPT09XCJmdW5jdGlvblwiKXtjb25zb2xlLnRyYWNlKCl9fX1yZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbj1FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO0V2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZT1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO3ZhciBmaXJlZD1mYWxzZTtmdW5jdGlvbiBnKCl7dGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGcpO2lmKCFmaXJlZCl7ZmlyZWQ9dHJ1ZTtsaXN0ZW5lci5hcHBseSh0aGlzLGFyZ3VtZW50cyl9fWcubGlzdGVuZXI9bGlzdGVuZXI7dGhpcy5vbih0eXBlLGcpO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe3ZhciBsaXN0LHBvc2l0aW9uLGxlbmd0aCxpO2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7aWYoIXRoaXMuX2V2ZW50c3x8IXRoaXMuX2V2ZW50c1t0eXBlXSlyZXR1cm4gdGhpcztsaXN0PXRoaXMuX2V2ZW50c1t0eXBlXTtsZW5ndGg9bGlzdC5sZW5ndGg7cG9zaXRpb249LTE7aWYobGlzdD09PWxpc3RlbmVyfHxpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpJiZsaXN0Lmxpc3RlbmVyPT09bGlzdGVuZXIpe2RlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07aWYodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsdHlwZSxsaXN0ZW5lcil9ZWxzZSBpZihpc09iamVjdChsaXN0KSl7Zm9yKGk9bGVuZ3RoO2ktLSA+MDspe2lmKGxpc3RbaV09PT1saXN0ZW5lcnx8bGlzdFtpXS5saXN0ZW5lciYmbGlzdFtpXS5saXN0ZW5lcj09PWxpc3RlbmVyKXtwb3NpdGlvbj1pO2JyZWFrfX1pZihwb3NpdGlvbjwwKXJldHVybiB0aGlzO2lmKGxpc3QubGVuZ3RoPT09MSl7bGlzdC5sZW5ndGg9MDtkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdfWVsc2V7bGlzdC5zcGxpY2UocG9zaXRpb24sMSl9aWYodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsdHlwZSxsaXN0ZW5lcil9cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzPWZ1bmN0aW9uKHR5cGUpe3ZhciBrZXksbGlzdGVuZXJzO2lmKCF0aGlzLl9ldmVudHMpcmV0dXJuIHRoaXM7aWYoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil7aWYoYXJndW1lbnRzLmxlbmd0aD09PTApdGhpcy5fZXZlbnRzPXt9O2Vsc2UgaWYodGhpcy5fZXZlbnRzW3R5cGVdKWRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07cmV0dXJuIHRoaXN9aWYoYXJndW1lbnRzLmxlbmd0aD09PTApe2ZvcihrZXkgaW4gdGhpcy5fZXZlbnRzKXtpZihrZXk9PT1cInJlbW92ZUxpc3RlbmVyXCIpY29udGludWU7dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KX10aGlzLnJlbW92ZUFsbExpc3RlbmVycyhcInJlbW92ZUxpc3RlbmVyXCIpO3RoaXMuX2V2ZW50cz17fTtyZXR1cm4gdGhpc31saXN0ZW5lcnM9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzRnVuY3Rpb24obGlzdGVuZXJzKSl7dGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGxpc3RlbmVycyl9ZWxzZSBpZihsaXN0ZW5lcnMpe3doaWxlKGxpc3RlbmVycy5sZW5ndGgpdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoLTFdKX1kZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycz1mdW5jdGlvbih0eXBlKXt2YXIgcmV0O2lmKCF0aGlzLl9ldmVudHN8fCF0aGlzLl9ldmVudHNbdHlwZV0pcmV0PVtdO2Vsc2UgaWYoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKXJldD1bdGhpcy5fZXZlbnRzW3R5cGVdXTtlbHNlIHJldD10aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtyZXR1cm4gcmV0fTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQ9ZnVuY3Rpb24odHlwZSl7aWYodGhpcy5fZXZlbnRzKXt2YXIgZXZsaXN0ZW5lcj10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlyZXR1cm4gMTtlbHNlIGlmKGV2bGlzdGVuZXIpcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RofXJldHVybiAwfTtFdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudD1mdW5jdGlvbihlbWl0dGVyLHR5cGUpe3JldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSl9O2Z1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwiZnVuY3Rpb25cIn1mdW5jdGlvbiBpc051bWJlcihhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJudW1iZXJcIn1mdW5jdGlvbiBpc09iamVjdChhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJvYmplY3RcIiYmYXJnIT09bnVsbH1mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpe3JldHVybiBhcmc9PT12b2lkIDB9fSx7fV0sMjpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIE5ldVF1YW50PXJlcXVpcmUoXCIuL1R5cGVkTmV1UXVhbnQuanNcIik7dmFyIExaV0VuY29kZXI9cmVxdWlyZShcIi4vTFpXRW5jb2Rlci5qc1wiKTtmdW5jdGlvbiBCeXRlQXJyYXkoKXt0aGlzLnBhZ2U9LTE7dGhpcy5wYWdlcz1bXTt0aGlzLm5ld1BhZ2UoKX1CeXRlQXJyYXkucGFnZVNpemU9NDA5NjtCeXRlQXJyYXkuY2hhck1hcD17fTtmb3IodmFyIGk9MDtpPDI1NjtpKyspQnl0ZUFycmF5LmNoYXJNYXBbaV09U3RyaW5nLmZyb21DaGFyQ29kZShpKTtCeXRlQXJyYXkucHJvdG90eXBlLm5ld1BhZ2U9ZnVuY3Rpb24oKXt0aGlzLnBhZ2VzWysrdGhpcy5wYWdlXT1uZXcgVWludDhBcnJheShCeXRlQXJyYXkucGFnZVNpemUpO3RoaXMuY3Vyc29yPTB9O0J5dGVBcnJheS5wcm90b3R5cGUuZ2V0RGF0YT1mdW5jdGlvbigpe3ZhciBydj1cIlwiO2Zvcih2YXIgcD0wO3A8dGhpcy5wYWdlcy5sZW5ndGg7cCsrKXtmb3IodmFyIGk9MDtpPEJ5dGVBcnJheS5wYWdlU2l6ZTtpKyspe3J2Kz1CeXRlQXJyYXkuY2hhck1hcFt0aGlzLnBhZ2VzW3BdW2ldXX19cmV0dXJuIHJ2fTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlQnl0ZT1mdW5jdGlvbih2YWwpe2lmKHRoaXMuY3Vyc29yPj1CeXRlQXJyYXkucGFnZVNpemUpdGhpcy5uZXdQYWdlKCk7dGhpcy5wYWdlc1t0aGlzLnBhZ2VdW3RoaXMuY3Vyc29yKytdPXZhbH07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZVVURkJ5dGVzPWZ1bmN0aW9uKHN0cmluZyl7Zm9yKHZhciBsPXN0cmluZy5sZW5ndGgsaT0wO2k8bDtpKyspdGhpcy53cml0ZUJ5dGUoc3RyaW5nLmNoYXJDb2RlQXQoaSkpfTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlQnl0ZXM9ZnVuY3Rpb24oYXJyYXksb2Zmc2V0LGxlbmd0aCl7Zm9yKHZhciBsPWxlbmd0aHx8YXJyYXkubGVuZ3RoLGk9b2Zmc2V0fHwwO2k8bDtpKyspdGhpcy53cml0ZUJ5dGUoYXJyYXlbaV0pfTtmdW5jdGlvbiBHSUZFbmNvZGVyKHdpZHRoLGhlaWdodCl7dGhpcy53aWR0aD1+fndpZHRoO3RoaXMuaGVpZ2h0PX5+aGVpZ2h0O3RoaXMudHJhbnNwYXJlbnQ9bnVsbDt0aGlzLnRyYW5zSW5kZXg9MDt0aGlzLnJlcGVhdD0tMTt0aGlzLmRlbGF5PTA7dGhpcy5pbWFnZT1udWxsO3RoaXMucGl4ZWxzPW51bGw7dGhpcy5pbmRleGVkUGl4ZWxzPW51bGw7dGhpcy5jb2xvckRlcHRoPW51bGw7dGhpcy5jb2xvclRhYj1udWxsO3RoaXMubmV1UXVhbnQ9bnVsbDt0aGlzLnVzZWRFbnRyeT1uZXcgQXJyYXk7dGhpcy5wYWxTaXplPTc7dGhpcy5kaXNwb3NlPS0xO3RoaXMuZmlyc3RGcmFtZT10cnVlO3RoaXMuc2FtcGxlPTEwO3RoaXMuZGl0aGVyPWZhbHNlO3RoaXMuZ2xvYmFsUGFsZXR0ZT1mYWxzZTt0aGlzLm91dD1uZXcgQnl0ZUFycmF5fUdJRkVuY29kZXIucHJvdG90eXBlLnNldERlbGF5PWZ1bmN0aW9uKG1pbGxpc2Vjb25kcyl7dGhpcy5kZWxheT1NYXRoLnJvdW5kKG1pbGxpc2Vjb25kcy8xMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldEZyYW1lUmF0ZT1mdW5jdGlvbihmcHMpe3RoaXMuZGVsYXk9TWF0aC5yb3VuZCgxMDAvZnBzKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGlzcG9zZT1mdW5jdGlvbihkaXNwb3NhbENvZGUpe2lmKGRpc3Bvc2FsQ29kZT49MCl0aGlzLmRpc3Bvc2U9ZGlzcG9zYWxDb2RlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRSZXBlYXQ9ZnVuY3Rpb24ocmVwZWF0KXt0aGlzLnJlcGVhdD1yZXBlYXR9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFRyYW5zcGFyZW50PWZ1bmN0aW9uKGNvbG9yKXt0aGlzLnRyYW5zcGFyZW50PWNvbG9yfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGRGcmFtZT1mdW5jdGlvbihpbWFnZURhdGEpe3RoaXMuaW1hZ2U9aW1hZ2VEYXRhO3RoaXMuY29sb3JUYWI9dGhpcy5nbG9iYWxQYWxldHRlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2U/dGhpcy5nbG9iYWxQYWxldHRlOm51bGw7dGhpcy5nZXRJbWFnZVBpeGVscygpO3RoaXMuYW5hbHl6ZVBpeGVscygpO2lmKHRoaXMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpdGhpcy5nbG9iYWxQYWxldHRlPXRoaXMuY29sb3JUYWI7aWYodGhpcy5maXJzdEZyYW1lKXt0aGlzLndyaXRlTFNEKCk7dGhpcy53cml0ZVBhbGV0dGUoKTtpZih0aGlzLnJlcGVhdD49MCl7dGhpcy53cml0ZU5ldHNjYXBlRXh0KCl9fXRoaXMud3JpdGVHcmFwaGljQ3RybEV4dCgpO3RoaXMud3JpdGVJbWFnZURlc2MoKTtpZighdGhpcy5maXJzdEZyYW1lJiYhdGhpcy5nbG9iYWxQYWxldHRlKXRoaXMud3JpdGVQYWxldHRlKCk7dGhpcy53cml0ZVBpeGVscygpO3RoaXMuZmlyc3RGcmFtZT1mYWxzZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluaXNoPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDU5KX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0UXVhbGl0eT1mdW5jdGlvbihxdWFsaXR5KXtpZihxdWFsaXR5PDEpcXVhbGl0eT0xO3RoaXMuc2FtcGxlPXF1YWxpdHl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldERpdGhlcj1mdW5jdGlvbihkaXRoZXIpe2lmKGRpdGhlcj09PXRydWUpZGl0aGVyPVwiRmxveWRTdGVpbmJlcmdcIjt0aGlzLmRpdGhlcj1kaXRoZXJ9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldEdsb2JhbFBhbGV0dGU9ZnVuY3Rpb24ocGFsZXR0ZSl7dGhpcy5nbG9iYWxQYWxldHRlPXBhbGV0dGV9O0dJRkVuY29kZXIucHJvdG90eXBlLmdldEdsb2JhbFBhbGV0dGU9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5nbG9iYWxQYWxldHRlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2UmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZSgwKXx8dGhpcy5nbG9iYWxQYWxldHRlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUhlYWRlcj1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlVVRGQnl0ZXMoXCJHSUY4OWFcIil9O0dJRkVuY29kZXIucHJvdG90eXBlLmFuYWx5emVQaXhlbHM9ZnVuY3Rpb24oKXtpZighdGhpcy5jb2xvclRhYil7dGhpcy5uZXVRdWFudD1uZXcgTmV1UXVhbnQodGhpcy5waXhlbHMsdGhpcy5zYW1wbGUpO3RoaXMubmV1UXVhbnQuYnVpbGRDb2xvcm1hcCgpO3RoaXMuY29sb3JUYWI9dGhpcy5uZXVRdWFudC5nZXRDb2xvcm1hcCgpfWlmKHRoaXMuZGl0aGVyKXt0aGlzLmRpdGhlclBpeGVscyh0aGlzLmRpdGhlci5yZXBsYWNlKFwiLXNlcnBlbnRpbmVcIixcIlwiKSx0aGlzLmRpdGhlci5tYXRjaCgvLXNlcnBlbnRpbmUvKSE9PW51bGwpfWVsc2V7dGhpcy5pbmRleFBpeGVscygpfXRoaXMucGl4ZWxzPW51bGw7dGhpcy5jb2xvckRlcHRoPTg7dGhpcy5wYWxTaXplPTc7aWYodGhpcy50cmFuc3BhcmVudCE9PW51bGwpe3RoaXMudHJhbnNJbmRleD10aGlzLmZpbmRDbG9zZXN0KHRoaXMudHJhbnNwYXJlbnQsdHJ1ZSl9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5pbmRleFBpeGVscz1mdW5jdGlvbihpbWdxKXt2YXIgblBpeD10aGlzLnBpeGVscy5sZW5ndGgvMzt0aGlzLmluZGV4ZWRQaXhlbHM9bmV3IFVpbnQ4QXJyYXkoblBpeCk7dmFyIGs9MDtmb3IodmFyIGo9MDtqPG5QaXg7aisrKXt2YXIgaW5kZXg9dGhpcy5maW5kQ2xvc2VzdFJHQih0aGlzLnBpeGVsc1trKytdJjI1NSx0aGlzLnBpeGVsc1trKytdJjI1NSx0aGlzLnBpeGVsc1trKytdJjI1NSk7dGhpcy51c2VkRW50cnlbaW5kZXhdPXRydWU7dGhpcy5pbmRleGVkUGl4ZWxzW2pdPWluZGV4fX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZGl0aGVyUGl4ZWxzPWZ1bmN0aW9uKGtlcm5lbCxzZXJwZW50aW5lKXt2YXIga2VybmVscz17RmFsc2VGbG95ZFN0ZWluYmVyZzpbWzMvOCwxLDBdLFszLzgsMCwxXSxbMi84LDEsMV1dLEZsb3lkU3RlaW5iZXJnOltbNy8xNiwxLDBdLFszLzE2LC0xLDFdLFs1LzE2LDAsMV0sWzEvMTYsMSwxXV0sU3R1Y2tpOltbOC80MiwxLDBdLFs0LzQyLDIsMF0sWzIvNDIsLTIsMV0sWzQvNDIsLTEsMV0sWzgvNDIsMCwxXSxbNC80MiwxLDFdLFsyLzQyLDIsMV0sWzEvNDIsLTIsMl0sWzIvNDIsLTEsMl0sWzQvNDIsMCwyXSxbMi80MiwxLDJdLFsxLzQyLDIsMl1dLEF0a2luc29uOltbMS84LDEsMF0sWzEvOCwyLDBdLFsxLzgsLTEsMV0sWzEvOCwwLDFdLFsxLzgsMSwxXSxbMS84LDAsMl1dfTtpZigha2VybmVsfHwha2VybmVsc1trZXJuZWxdKXt0aHJvd1wiVW5rbm93biBkaXRoZXJpbmcga2VybmVsOiBcIitrZXJuZWx9dmFyIGRzPWtlcm5lbHNba2VybmVsXTt2YXIgaW5kZXg9MCxoZWlnaHQ9dGhpcy5oZWlnaHQsd2lkdGg9dGhpcy53aWR0aCxkYXRhPXRoaXMucGl4ZWxzO3ZhciBkaXJlY3Rpb249c2VycGVudGluZT8tMToxO3RoaXMuaW5kZXhlZFBpeGVscz1uZXcgVWludDhBcnJheSh0aGlzLnBpeGVscy5sZW5ndGgvMyk7Zm9yKHZhciB5PTA7eTxoZWlnaHQ7eSsrKXtpZihzZXJwZW50aW5lKWRpcmVjdGlvbj1kaXJlY3Rpb24qLTE7Zm9yKHZhciB4PWRpcmVjdGlvbj09MT8wOndpZHRoLTEseGVuZD1kaXJlY3Rpb249PTE/d2lkdGg6MDt4IT09eGVuZDt4Kz1kaXJlY3Rpb24pe2luZGV4PXkqd2lkdGgreDt2YXIgaWR4PWluZGV4KjM7dmFyIHIxPWRhdGFbaWR4XTt2YXIgZzE9ZGF0YVtpZHgrMV07dmFyIGIxPWRhdGFbaWR4KzJdO2lkeD10aGlzLmZpbmRDbG9zZXN0UkdCKHIxLGcxLGIxKTt0aGlzLnVzZWRFbnRyeVtpZHhdPXRydWU7dGhpcy5pbmRleGVkUGl4ZWxzW2luZGV4XT1pZHg7aWR4Kj0zO3ZhciByMj10aGlzLmNvbG9yVGFiW2lkeF07dmFyIGcyPXRoaXMuY29sb3JUYWJbaWR4KzFdO3ZhciBiMj10aGlzLmNvbG9yVGFiW2lkeCsyXTt2YXIgZXI9cjEtcjI7dmFyIGVnPWcxLWcyO3ZhciBlYj1iMS1iMjtmb3IodmFyIGk9ZGlyZWN0aW9uPT0xPzA6ZHMubGVuZ3RoLTEsZW5kPWRpcmVjdGlvbj09MT9kcy5sZW5ndGg6MDtpIT09ZW5kO2krPWRpcmVjdGlvbil7dmFyIHgxPWRzW2ldWzFdO3ZhciB5MT1kc1tpXVsyXTtpZih4MSt4Pj0wJiZ4MSt4PHdpZHRoJiZ5MSt5Pj0wJiZ5MSt5PGhlaWdodCl7dmFyIGQ9ZHNbaV1bMF07aWR4PWluZGV4K3gxK3kxKndpZHRoO2lkeCo9MztkYXRhW2lkeF09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHhdK2VyKmQpKTtkYXRhW2lkeCsxXT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeCsxXStlZypkKSk7ZGF0YVtpZHgrMl09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHgrMl0rZWIqZCkpfX19fX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluZENsb3Nlc3Q9ZnVuY3Rpb24oYyx1c2VkKXtyZXR1cm4gdGhpcy5maW5kQ2xvc2VzdFJHQigoYyYxNjcxMTY4MCk+PjE2LChjJjY1MjgwKT4+OCxjJjI1NSx1c2VkKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluZENsb3Nlc3RSR0I9ZnVuY3Rpb24ocixnLGIsdXNlZCl7aWYodGhpcy5jb2xvclRhYj09PW51bGwpcmV0dXJuLTE7aWYodGhpcy5uZXVRdWFudCYmIXVzZWQpe3JldHVybiB0aGlzLm5ldVF1YW50Lmxvb2t1cFJHQihyLGcsYil9dmFyIGM9YnxnPDw4fHI8PDE2O3ZhciBtaW5wb3M9MDt2YXIgZG1pbj0yNTYqMjU2KjI1Njt2YXIgbGVuPXRoaXMuY29sb3JUYWIubGVuZ3RoO2Zvcih2YXIgaT0wLGluZGV4PTA7aTxsZW47aW5kZXgrKyl7dmFyIGRyPXItKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkZz1nLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZGI9Yi0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGQ9ZHIqZHIrZGcqZGcrZGIqZGI7aWYoKCF1c2VkfHx0aGlzLnVzZWRFbnRyeVtpbmRleF0pJiZkPGRtaW4pe2RtaW49ZDttaW5wb3M9aW5kZXh9fXJldHVybiBtaW5wb3N9O0dJRkVuY29kZXIucHJvdG90eXBlLmdldEltYWdlUGl4ZWxzPWZ1bmN0aW9uKCl7dmFyIHc9dGhpcy53aWR0aDt2YXIgaD10aGlzLmhlaWdodDt0aGlzLnBpeGVscz1uZXcgVWludDhBcnJheSh3KmgqMyk7dmFyIGRhdGE9dGhpcy5pbWFnZTt2YXIgc3JjUG9zPTA7dmFyIGNvdW50PTA7Zm9yKHZhciBpPTA7aTxoO2krKyl7Zm9yKHZhciBqPTA7ajx3O2orKyl7dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107c3JjUG9zKyt9fX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVHcmFwaGljQ3RybEV4dD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSgzMyk7dGhpcy5vdXQud3JpdGVCeXRlKDI0OSk7dGhpcy5vdXQud3JpdGVCeXRlKDQpO3ZhciB0cmFuc3AsZGlzcDtpZih0aGlzLnRyYW5zcGFyZW50PT09bnVsbCl7dHJhbnNwPTA7ZGlzcD0wfWVsc2V7dHJhbnNwPTE7ZGlzcD0yfWlmKHRoaXMuZGlzcG9zZT49MCl7ZGlzcD10aGlzLmRpc3Bvc2UmN31kaXNwPDw9Mjt0aGlzLm91dC53cml0ZUJ5dGUoMHxkaXNwfDB8dHJhbnNwKTt0aGlzLndyaXRlU2hvcnQodGhpcy5kZWxheSk7dGhpcy5vdXQud3JpdGVCeXRlKHRoaXMudHJhbnNJbmRleCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUltYWdlRGVzYz1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSg0NCk7dGhpcy53cml0ZVNob3J0KDApO3RoaXMud3JpdGVTaG9ydCgwKTt0aGlzLndyaXRlU2hvcnQodGhpcy53aWR0aCk7dGhpcy53cml0ZVNob3J0KHRoaXMuaGVpZ2h0KTtpZih0aGlzLmZpcnN0RnJhbWV8fHRoaXMuZ2xvYmFsUGFsZXR0ZSl7dGhpcy5vdXQud3JpdGVCeXRlKDApfWVsc2V7dGhpcy5vdXQud3JpdGVCeXRlKDEyOHwwfDB8MHx0aGlzLnBhbFNpemUpfX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVMU0Q9ZnVuY3Rpb24oKXt0aGlzLndyaXRlU2hvcnQodGhpcy53aWR0aCk7dGhpcy53cml0ZVNob3J0KHRoaXMuaGVpZ2h0KTt0aGlzLm91dC53cml0ZUJ5dGUoMTI4fDExMnwwfHRoaXMucGFsU2l6ZSk7dGhpcy5vdXQud3JpdGVCeXRlKDApO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVOZXRzY2FwZUV4dD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSgzMyk7dGhpcy5vdXQud3JpdGVCeXRlKDI1NSk7dGhpcy5vdXQud3JpdGVCeXRlKDExKTt0aGlzLm91dC53cml0ZVVURkJ5dGVzKFwiTkVUU0NBUEUyLjBcIik7dGhpcy5vdXQud3JpdGVCeXRlKDMpO3RoaXMub3V0LndyaXRlQnl0ZSgxKTt0aGlzLndyaXRlU2hvcnQodGhpcy5yZXBlYXQpO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVQYWxldHRlPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlcyh0aGlzLmNvbG9yVGFiKTt2YXIgbj0zKjI1Ni10aGlzLmNvbG9yVGFiLmxlbmd0aDtmb3IodmFyIGk9MDtpPG47aSsrKXRoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVTaG9ydD1mdW5jdGlvbihwVmFsdWUpe3RoaXMub3V0LndyaXRlQnl0ZShwVmFsdWUmMjU1KTt0aGlzLm91dC53cml0ZUJ5dGUocFZhbHVlPj44JjI1NSl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlUGl4ZWxzPWZ1bmN0aW9uKCl7dmFyIGVuYz1uZXcgTFpXRW5jb2Rlcih0aGlzLndpZHRoLHRoaXMuaGVpZ2h0LHRoaXMuaW5kZXhlZFBpeGVscyx0aGlzLmNvbG9yRGVwdGgpO2VuYy5lbmNvZGUodGhpcy5vdXQpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zdHJlYW09ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5vdXR9O21vZHVsZS5leHBvcnRzPUdJRkVuY29kZXJ9LHtcIi4vTFpXRW5jb2Rlci5qc1wiOjMsXCIuL1R5cGVkTmV1UXVhbnQuanNcIjo0fV0sMzpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEVPRj0tMTt2YXIgQklUUz0xMjt2YXIgSFNJWkU9NTAwMzt2YXIgbWFza3M9WzAsMSwzLDcsMTUsMzEsNjMsMTI3LDI1NSw1MTEsMTAyMywyMDQ3LDQwOTUsODE5MSwxNjM4MywzMjc2Nyw2NTUzNV07ZnVuY3Rpb24gTFpXRW5jb2Rlcih3aWR0aCxoZWlnaHQscGl4ZWxzLGNvbG9yRGVwdGgpe3ZhciBpbml0Q29kZVNpemU9TWF0aC5tYXgoMixjb2xvckRlcHRoKTt2YXIgYWNjdW09bmV3IFVpbnQ4QXJyYXkoMjU2KTt2YXIgaHRhYj1uZXcgSW50MzJBcnJheShIU0laRSk7dmFyIGNvZGV0YWI9bmV3IEludDMyQXJyYXkoSFNJWkUpO3ZhciBjdXJfYWNjdW0sY3VyX2JpdHM9MDt2YXIgYV9jb3VudDt2YXIgZnJlZV9lbnQ9MDt2YXIgbWF4Y29kZTt2YXIgY2xlYXJfZmxnPWZhbHNlO3ZhciBnX2luaXRfYml0cyxDbGVhckNvZGUsRU9GQ29kZTtmdW5jdGlvbiBjaGFyX291dChjLG91dHMpe2FjY3VtW2FfY291bnQrK109YztpZihhX2NvdW50Pj0yNTQpZmx1c2hfY2hhcihvdXRzKX1mdW5jdGlvbiBjbF9ibG9jayhvdXRzKXtjbF9oYXNoKEhTSVpFKTtmcmVlX2VudD1DbGVhckNvZGUrMjtjbGVhcl9mbGc9dHJ1ZTtvdXRwdXQoQ2xlYXJDb2RlLG91dHMpfWZ1bmN0aW9uIGNsX2hhc2goaHNpemUpe2Zvcih2YXIgaT0wO2k8aHNpemU7KytpKWh0YWJbaV09LTF9ZnVuY3Rpb24gY29tcHJlc3MoaW5pdF9iaXRzLG91dHMpe3ZhciBmY29kZSxjLGksZW50LGRpc3AsaHNpemVfcmVnLGhzaGlmdDtnX2luaXRfYml0cz1pbml0X2JpdHM7Y2xlYXJfZmxnPWZhbHNlO25fYml0cz1nX2luaXRfYml0czttYXhjb2RlPU1BWENPREUobl9iaXRzKTtDbGVhckNvZGU9MTw8aW5pdF9iaXRzLTE7RU9GQ29kZT1DbGVhckNvZGUrMTtmcmVlX2VudD1DbGVhckNvZGUrMjthX2NvdW50PTA7ZW50PW5leHRQaXhlbCgpO2hzaGlmdD0wO2ZvcihmY29kZT1IU0laRTtmY29kZTw2NTUzNjtmY29kZSo9MikrK2hzaGlmdDtoc2hpZnQ9OC1oc2hpZnQ7aHNpemVfcmVnPUhTSVpFO2NsX2hhc2goaHNpemVfcmVnKTtvdXRwdXQoQ2xlYXJDb2RlLG91dHMpO291dGVyX2xvb3A6d2hpbGUoKGM9bmV4dFBpeGVsKCkpIT1FT0Ype2Zjb2RlPShjPDxCSVRTKStlbnQ7aT1jPDxoc2hpZnReZW50O2lmKGh0YWJbaV09PT1mY29kZSl7ZW50PWNvZGV0YWJbaV07Y29udGludWV9ZWxzZSBpZihodGFiW2ldPj0wKXtkaXNwPWhzaXplX3JlZy1pO2lmKGk9PT0wKWRpc3A9MTtkb3tpZigoaS09ZGlzcCk8MClpKz1oc2l6ZV9yZWc7aWYoaHRhYltpXT09PWZjb2RlKXtlbnQ9Y29kZXRhYltpXTtjb250aW51ZSBvdXRlcl9sb29wfX13aGlsZShodGFiW2ldPj0wKX1vdXRwdXQoZW50LG91dHMpO2VudD1jO2lmKGZyZWVfZW50PDE8PEJJVFMpe2NvZGV0YWJbaV09ZnJlZV9lbnQrKztodGFiW2ldPWZjb2RlfWVsc2V7Y2xfYmxvY2sob3V0cyl9fW91dHB1dChlbnQsb3V0cyk7b3V0cHV0KEVPRkNvZGUsb3V0cyl9ZnVuY3Rpb24gZW5jb2RlKG91dHMpe291dHMud3JpdGVCeXRlKGluaXRDb2RlU2l6ZSk7cmVtYWluaW5nPXdpZHRoKmhlaWdodDtjdXJQaXhlbD0wO2NvbXByZXNzKGluaXRDb2RlU2l6ZSsxLG91dHMpO291dHMud3JpdGVCeXRlKDApfWZ1bmN0aW9uIGZsdXNoX2NoYXIob3V0cyl7aWYoYV9jb3VudD4wKXtvdXRzLndyaXRlQnl0ZShhX2NvdW50KTtvdXRzLndyaXRlQnl0ZXMoYWNjdW0sMCxhX2NvdW50KTthX2NvdW50PTB9fWZ1bmN0aW9uIE1BWENPREUobl9iaXRzKXtyZXR1cm4oMTw8bl9iaXRzKS0xfWZ1bmN0aW9uIG5leHRQaXhlbCgpe2lmKHJlbWFpbmluZz09PTApcmV0dXJuIEVPRjstLXJlbWFpbmluZzt2YXIgcGl4PXBpeGVsc1tjdXJQaXhlbCsrXTtyZXR1cm4gcGl4JjI1NX1mdW5jdGlvbiBvdXRwdXQoY29kZSxvdXRzKXtjdXJfYWNjdW0mPW1hc2tzW2N1cl9iaXRzXTtpZihjdXJfYml0cz4wKWN1cl9hY2N1bXw9Y29kZTw8Y3VyX2JpdHM7ZWxzZSBjdXJfYWNjdW09Y29kZTtjdXJfYml0cys9bl9iaXRzO3doaWxlKGN1cl9iaXRzPj04KXtjaGFyX291dChjdXJfYWNjdW0mMjU1LG91dHMpO2N1cl9hY2N1bT4+PTg7Y3VyX2JpdHMtPTh9aWYoZnJlZV9lbnQ+bWF4Y29kZXx8Y2xlYXJfZmxnKXtpZihjbGVhcl9mbGcpe21heGNvZGU9TUFYQ09ERShuX2JpdHM9Z19pbml0X2JpdHMpO2NsZWFyX2ZsZz1mYWxzZX1lbHNleysrbl9iaXRzO2lmKG5fYml0cz09QklUUyltYXhjb2RlPTE8PEJJVFM7ZWxzZSBtYXhjb2RlPU1BWENPREUobl9iaXRzKX19aWYoY29kZT09RU9GQ29kZSl7d2hpbGUoY3VyX2JpdHM+MCl7Y2hhcl9vdXQoY3VyX2FjY3VtJjI1NSxvdXRzKTtjdXJfYWNjdW0+Pj04O2N1cl9iaXRzLT04fWZsdXNoX2NoYXIob3V0cyl9fXRoaXMuZW5jb2RlPWVuY29kZX1tb2R1bGUuZXhwb3J0cz1MWldFbmNvZGVyfSx7fV0sNDpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIG5jeWNsZXM9MTAwO3ZhciBuZXRzaXplPTI1Njt2YXIgbWF4bmV0cG9zPW5ldHNpemUtMTt2YXIgbmV0Ymlhc3NoaWZ0PTQ7dmFyIGludGJpYXNzaGlmdD0xNjt2YXIgaW50Ymlhcz0xPDxpbnRiaWFzc2hpZnQ7dmFyIGdhbW1hc2hpZnQ9MTA7dmFyIGdhbW1hPTE8PGdhbW1hc2hpZnQ7dmFyIGJldGFzaGlmdD0xMDt2YXIgYmV0YT1pbnRiaWFzPj5iZXRhc2hpZnQ7dmFyIGJldGFnYW1tYT1pbnRiaWFzPDxnYW1tYXNoaWZ0LWJldGFzaGlmdDt2YXIgaW5pdHJhZD1uZXRzaXplPj4zO3ZhciByYWRpdXNiaWFzc2hpZnQ9Njt2YXIgcmFkaXVzYmlhcz0xPDxyYWRpdXNiaWFzc2hpZnQ7dmFyIGluaXRyYWRpdXM9aW5pdHJhZCpyYWRpdXNiaWFzO3ZhciByYWRpdXNkZWM9MzA7dmFyIGFscGhhYmlhc3NoaWZ0PTEwO3ZhciBpbml0YWxwaGE9MTw8YWxwaGFiaWFzc2hpZnQ7dmFyIGFscGhhZGVjO3ZhciByYWRiaWFzc2hpZnQ9ODt2YXIgcmFkYmlhcz0xPDxyYWRiaWFzc2hpZnQ7dmFyIGFscGhhcmFkYnNoaWZ0PWFscGhhYmlhc3NoaWZ0K3JhZGJpYXNzaGlmdDt2YXIgYWxwaGFyYWRiaWFzPTE8PGFscGhhcmFkYnNoaWZ0O3ZhciBwcmltZTE9NDk5O3ZhciBwcmltZTI9NDkxO3ZhciBwcmltZTM9NDg3O3ZhciBwcmltZTQ9NTAzO3ZhciBtaW5waWN0dXJlYnl0ZXM9MypwcmltZTQ7ZnVuY3Rpb24gTmV1UXVhbnQocGl4ZWxzLHNhbXBsZWZhYyl7dmFyIG5ldHdvcms7dmFyIG5ldGluZGV4O3ZhciBiaWFzO3ZhciBmcmVxO3ZhciByYWRwb3dlcjtmdW5jdGlvbiBpbml0KCl7bmV0d29yaz1bXTtuZXRpbmRleD1uZXcgSW50MzJBcnJheSgyNTYpO2JpYXM9bmV3IEludDMyQXJyYXkobmV0c2l6ZSk7ZnJlcT1uZXcgSW50MzJBcnJheShuZXRzaXplKTtyYWRwb3dlcj1uZXcgSW50MzJBcnJheShuZXRzaXplPj4zKTt2YXIgaSx2O2ZvcihpPTA7aTxuZXRzaXplO2krKyl7dj0oaTw8bmV0Ymlhc3NoaWZ0KzgpL25ldHNpemU7bmV0d29ya1tpXT1uZXcgRmxvYXQ2NEFycmF5KFt2LHYsdiwwXSk7ZnJlcVtpXT1pbnRiaWFzL25ldHNpemU7Ymlhc1tpXT0wfX1mdW5jdGlvbiB1bmJpYXNuZXQoKXtmb3IodmFyIGk9MDtpPG5ldHNpemU7aSsrKXtuZXR3b3JrW2ldWzBdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bMV0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVsyXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzNdPWl9fWZ1bmN0aW9uIGFsdGVyc2luZ2xlKGFscGhhLGksYixnLHIpe25ldHdvcmtbaV1bMF0tPWFscGhhKihuZXR3b3JrW2ldWzBdLWIpL2luaXRhbHBoYTtuZXR3b3JrW2ldWzFdLT1hbHBoYSoobmV0d29ya1tpXVsxXS1nKS9pbml0YWxwaGE7bmV0d29ya1tpXVsyXS09YWxwaGEqKG5ldHdvcmtbaV1bMl0tcikvaW5pdGFscGhhfWZ1bmN0aW9uIGFsdGVybmVpZ2gocmFkaXVzLGksYixnLHIpe3ZhciBsbz1NYXRoLmFicyhpLXJhZGl1cyk7dmFyIGhpPU1hdGgubWluKGkrcmFkaXVzLG5ldHNpemUpO3ZhciBqPWkrMTt2YXIgaz1pLTE7dmFyIG09MTt2YXIgcCxhO3doaWxlKGo8aGl8fGs+bG8pe2E9cmFkcG93ZXJbbSsrXTtpZihqPGhpKXtwPW5ldHdvcmtbaisrXTtwWzBdLT1hKihwWzBdLWIpL2FscGhhcmFkYmlhcztwWzFdLT1hKihwWzFdLWcpL2FscGhhcmFkYmlhcztwWzJdLT1hKihwWzJdLXIpL2FscGhhcmFkYmlhc31pZihrPmxvKXtwPW5ldHdvcmtbay0tXTtwWzBdLT1hKihwWzBdLWIpL2FscGhhcmFkYmlhcztwWzFdLT1hKihwWzFdLWcpL2FscGhhcmFkYmlhcztwWzJdLT1hKihwWzJdLXIpL2FscGhhcmFkYmlhc319fWZ1bmN0aW9uIGNvbnRlc3QoYixnLHIpe3ZhciBiZXN0ZD1+KDE8PDMxKTt2YXIgYmVzdGJpYXNkPWJlc3RkO3ZhciBiZXN0cG9zPS0xO3ZhciBiZXN0Ymlhc3Bvcz1iZXN0cG9zO3ZhciBpLG4sZGlzdCxiaWFzZGlzdCxiZXRhZnJlcTtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe249bmV0d29ya1tpXTtkaXN0PU1hdGguYWJzKG5bMF0tYikrTWF0aC5hYnMoblsxXS1nKStNYXRoLmFicyhuWzJdLXIpO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdHBvcz1pfWJpYXNkaXN0PWRpc3QtKGJpYXNbaV0+PmludGJpYXNzaGlmdC1uZXRiaWFzc2hpZnQpO2lmKGJpYXNkaXN0PGJlc3RiaWFzZCl7YmVzdGJpYXNkPWJpYXNkaXN0O2Jlc3RiaWFzcG9zPWl9YmV0YWZyZXE9ZnJlcVtpXT4+YmV0YXNoaWZ0O2ZyZXFbaV0tPWJldGFmcmVxO2JpYXNbaV0rPWJldGFmcmVxPDxnYW1tYXNoaWZ0fWZyZXFbYmVzdHBvc10rPWJldGE7Ymlhc1tiZXN0cG9zXS09YmV0YWdhbW1hO3JldHVybiBiZXN0Ymlhc3Bvc31mdW5jdGlvbiBpbnhidWlsZCgpe3ZhciBpLGoscCxxLHNtYWxscG9zLHNtYWxsdmFsLHByZXZpb3VzY29sPTAsc3RhcnRwb3M9MDtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe3A9bmV0d29ya1tpXTtzbWFsbHBvcz1pO3NtYWxsdmFsPXBbMV07Zm9yKGo9aSsxO2o8bmV0c2l6ZTtqKyspe3E9bmV0d29ya1tqXTtpZihxWzFdPHNtYWxsdmFsKXtzbWFsbHBvcz1qO3NtYWxsdmFsPXFbMV19fXE9bmV0d29ya1tzbWFsbHBvc107aWYoaSE9c21hbGxwb3Mpe2o9cVswXTtxWzBdPXBbMF07cFswXT1qO2o9cVsxXTtxWzFdPXBbMV07cFsxXT1qO2o9cVsyXTtxWzJdPXBbMl07cFsyXT1qO2o9cVszXTtxWzNdPXBbM107cFszXT1qfWlmKHNtYWxsdmFsIT1wcmV2aW91c2NvbCl7bmV0aW5kZXhbcHJldmlvdXNjb2xdPXN0YXJ0cG9zK2k+PjE7Zm9yKGo9cHJldmlvdXNjb2wrMTtqPHNtYWxsdmFsO2orKyluZXRpbmRleFtqXT1pO3ByZXZpb3VzY29sPXNtYWxsdmFsO3N0YXJ0cG9zPWl9fW5ldGluZGV4W3ByZXZpb3VzY29sXT1zdGFydHBvcyttYXhuZXRwb3M+PjE7Zm9yKGo9cHJldmlvdXNjb2wrMTtqPDI1NjtqKyspbmV0aW5kZXhbal09bWF4bmV0cG9zfWZ1bmN0aW9uIGlueHNlYXJjaChiLGcscil7dmFyIGEscCxkaXN0O3ZhciBiZXN0ZD0xZTM7dmFyIGJlc3Q9LTE7dmFyIGk9bmV0aW5kZXhbZ107dmFyIGo9aS0xO3doaWxlKGk8bmV0c2l6ZXx8aj49MCl7aWYoaTxuZXRzaXplKXtwPW5ldHdvcmtbaV07ZGlzdD1wWzFdLWc7aWYoZGlzdD49YmVzdGQpaT1uZXRzaXplO2Vsc2V7aSsrO2lmKGRpc3Q8MClkaXN0PS1kaXN0O2E9cFswXS1iO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YT1wWzJdLXI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Q9cFszXX19fX1pZihqPj0wKXtwPW5ldHdvcmtbal07ZGlzdD1nLXBbMV07aWYoZGlzdD49YmVzdGQpaj0tMTtlbHNle2otLTtpZihkaXN0PDApZGlzdD0tZGlzdDthPXBbMF0tYjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2E9cFsyXS1yO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0PXBbM119fX19fXJldHVybiBiZXN0fWZ1bmN0aW9uIGxlYXJuKCl7dmFyIGk7dmFyIGxlbmd0aGNvdW50PXBpeGVscy5sZW5ndGg7dmFyIGFscGhhZGVjPTMwKyhzYW1wbGVmYWMtMSkvMzt2YXIgc2FtcGxlcGl4ZWxzPWxlbmd0aGNvdW50LygzKnNhbXBsZWZhYyk7dmFyIGRlbHRhPX5+KHNhbXBsZXBpeGVscy9uY3ljbGVzKTt2YXIgYWxwaGE9aW5pdGFscGhhO3ZhciByYWRpdXM9aW5pdHJhZGl1czt2YXIgcmFkPXJhZGl1cz4+cmFkaXVzYmlhc3NoaWZ0O2lmKHJhZDw9MSlyYWQ9MDtmb3IoaT0wO2k8cmFkO2krKylyYWRwb3dlcltpXT1hbHBoYSooKHJhZCpyYWQtaSppKSpyYWRiaWFzLyhyYWQqcmFkKSk7dmFyIHN0ZXA7aWYobGVuZ3RoY291bnQ8bWlucGljdHVyZWJ5dGVzKXtzYW1wbGVmYWM9MTtzdGVwPTN9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTEhPT0wKXtzdGVwPTMqcHJpbWUxfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUyIT09MCl7c3RlcD0zKnByaW1lMn1lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMyE9PTApe3N0ZXA9MypwcmltZTN9ZWxzZXtzdGVwPTMqcHJpbWU0fXZhciBiLGcscixqO3ZhciBwaXg9MDtpPTA7d2hpbGUoaTxzYW1wbGVwaXhlbHMpe2I9KHBpeGVsc1twaXhdJjI1NSk8PG5ldGJpYXNzaGlmdDtnPShwaXhlbHNbcGl4KzFdJjI1NSk8PG5ldGJpYXNzaGlmdDtyPShwaXhlbHNbcGl4KzJdJjI1NSk8PG5ldGJpYXNzaGlmdDtqPWNvbnRlc3QoYixnLHIpO2FsdGVyc2luZ2xlKGFscGhhLGosYixnLHIpO2lmKHJhZCE9PTApYWx0ZXJuZWlnaChyYWQsaixiLGcscik7cGl4Kz1zdGVwO2lmKHBpeD49bGVuZ3RoY291bnQpcGl4LT1sZW5ndGhjb3VudDtpKys7aWYoZGVsdGE9PT0wKWRlbHRhPTE7aWYoaSVkZWx0YT09PTApe2FscGhhLT1hbHBoYS9hbHBoYWRlYztyYWRpdXMtPXJhZGl1cy9yYWRpdXNkZWM7cmFkPXJhZGl1cz4+cmFkaXVzYmlhc3NoaWZ0O2lmKHJhZDw9MSlyYWQ9MDtmb3Ioaj0wO2o8cmFkO2orKylyYWRwb3dlcltqXT1hbHBoYSooKHJhZCpyYWQtaipqKSpyYWRiaWFzLyhyYWQqcmFkKSl9fX1mdW5jdGlvbiBidWlsZENvbG9ybWFwKCl7aW5pdCgpO2xlYXJuKCk7dW5iaWFzbmV0KCk7aW54YnVpbGQoKX10aGlzLmJ1aWxkQ29sb3JtYXA9YnVpbGRDb2xvcm1hcDtmdW5jdGlvbiBnZXRDb2xvcm1hcCgpe3ZhciBtYXA9W107dmFyIGluZGV4PVtdO2Zvcih2YXIgaT0wO2k8bmV0c2l6ZTtpKyspaW5kZXhbbmV0d29ya1tpXVszXV09aTt2YXIgaz0wO2Zvcih2YXIgbD0wO2w8bmV0c2l6ZTtsKyspe3ZhciBqPWluZGV4W2xdO21hcFtrKytdPW5ldHdvcmtbal1bMF07bWFwW2srK109bmV0d29ya1tqXVsxXTttYXBbaysrXT1uZXR3b3JrW2pdWzJdfXJldHVybiBtYXB9dGhpcy5nZXRDb2xvcm1hcD1nZXRDb2xvcm1hcDt0aGlzLmxvb2t1cFJHQj1pbnhzZWFyY2h9bW9kdWxlLmV4cG9ydHM9TmV1UXVhbnR9LHt9XSw1OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgVUEsYnJvd3Nlcixtb2RlLHBsYXRmb3JtLHVhO3VhPW5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtwbGF0Zm9ybT1uYXZpZ2F0b3IucGxhdGZvcm0udG9Mb3dlckNhc2UoKTtVQT11YS5tYXRjaCgvKG9wZXJhfGllfGZpcmVmb3h8Y2hyb21lfHZlcnNpb24pW1xcc1xcLzpdKFtcXHdcXGRcXC5dKyk/Lio/KHNhZmFyaXx2ZXJzaW9uW1xcc1xcLzpdKFtcXHdcXGRcXC5dKyl8JCkvKXx8W251bGwsXCJ1bmtub3duXCIsMF07bW9kZT1VQVsxXT09PVwiaWVcIiYmZG9jdW1lbnQuZG9jdW1lbnRNb2RlO2Jyb3dzZXI9e25hbWU6VUFbMV09PT1cInZlcnNpb25cIj9VQVszXTpVQVsxXSx2ZXJzaW9uOm1vZGV8fHBhcnNlRmxvYXQoVUFbMV09PT1cIm9wZXJhXCImJlVBWzRdP1VBWzRdOlVBWzJdKSxwbGF0Zm9ybTp7bmFtZTp1YS5tYXRjaCgvaXAoPzphZHxvZHxob25lKS8pP1wiaW9zXCI6KHVhLm1hdGNoKC8oPzp3ZWJvc3xhbmRyb2lkKS8pfHxwbGF0Zm9ybS5tYXRjaCgvbWFjfHdpbnxsaW51eC8pfHxbXCJvdGhlclwiXSlbMF19fTticm93c2VyW2Jyb3dzZXIubmFtZV09dHJ1ZTticm93c2VyW2Jyb3dzZXIubmFtZStwYXJzZUludChicm93c2VyLnZlcnNpb24sMTApXT10cnVlO2Jyb3dzZXIucGxhdGZvcm1bYnJvd3Nlci5wbGF0Zm9ybS5uYW1lXT10cnVlO21vZHVsZS5leHBvcnRzPWJyb3dzZXJ9LHt9XSw2OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgRXZlbnRFbWl0dGVyLEdJRixHSUZFbmNvZGVyLGJyb3dzZXIsZ2lmV29ya2VyLGV4dGVuZD1mdW5jdGlvbihjaGlsZCxwYXJlbnQpe2Zvcih2YXIga2V5IGluIHBhcmVudCl7aWYoaGFzUHJvcC5jYWxsKHBhcmVudCxrZXkpKWNoaWxkW2tleV09cGFyZW50W2tleV19ZnVuY3Rpb24gY3Rvcigpe3RoaXMuY29uc3RydWN0b3I9Y2hpbGR9Y3Rvci5wcm90b3R5cGU9cGFyZW50LnByb3RvdHlwZTtjaGlsZC5wcm90b3R5cGU9bmV3IGN0b3I7Y2hpbGQuX19zdXBlcl9fPXBhcmVudC5wcm90b3R5cGU7cmV0dXJuIGNoaWxkfSxoYXNQcm9wPXt9Lmhhc093blByb3BlcnR5LGluZGV4T2Y9W10uaW5kZXhPZnx8ZnVuY3Rpb24oaXRlbSl7Zm9yKHZhciBpPTAsbD10aGlzLmxlbmd0aDtpPGw7aSsrKXtpZihpIGluIHRoaXMmJnRoaXNbaV09PT1pdGVtKXJldHVybiBpfXJldHVybi0xfSxzbGljZT1bXS5zbGljZTtFdmVudEVtaXR0ZXI9cmVxdWlyZShcImV2ZW50c1wiKS5FdmVudEVtaXR0ZXI7YnJvd3Nlcj1yZXF1aXJlKFwiLi9icm93c2VyLmNvZmZlZVwiKTtHSUZFbmNvZGVyPXJlcXVpcmUoXCIuL0dJRkVuY29kZXIuanNcIik7Z2lmV29ya2VyPXJlcXVpcmUoXCIuL2dpZi53b3JrZXIuY29mZmVlXCIpO21vZHVsZS5leHBvcnRzPUdJRj1mdW5jdGlvbihzdXBlckNsYXNzKXt2YXIgZGVmYXVsdHMsZnJhbWVEZWZhdWx0cztleHRlbmQoR0lGLHN1cGVyQ2xhc3MpO2RlZmF1bHRzPXt3b3JrZXJTY3JpcHQ6XCJnaWYud29ya2VyLmpzXCIsd29ya2VyczoyLHJlcGVhdDowLGJhY2tncm91bmQ6XCIjZmZmXCIscXVhbGl0eToxMCx3aWR0aDpudWxsLGhlaWdodDpudWxsLHRyYW5zcGFyZW50Om51bGwsZGVidWc6ZmFsc2UsZGl0aGVyOmZhbHNlfTtmcmFtZURlZmF1bHRzPXtkZWxheTo1MDAsY29weTpmYWxzZSxkaXNwb3NlOi0xfTtmdW5jdGlvbiBHSUYob3B0aW9ucyl7dmFyIGJhc2Usa2V5LHZhbHVlO3RoaXMucnVubmluZz1mYWxzZTt0aGlzLm9wdGlvbnM9e307dGhpcy5mcmFtZXM9W107dGhpcy5mcmVlV29ya2Vycz1bXTt0aGlzLmFjdGl2ZVdvcmtlcnM9W107dGhpcy5zZXRPcHRpb25zKG9wdGlvbnMpO2ZvcihrZXkgaW4gZGVmYXVsdHMpe3ZhbHVlPWRlZmF1bHRzW2tleV07aWYoKGJhc2U9dGhpcy5vcHRpb25zKVtrZXldPT1udWxsKXtiYXNlW2tleV09dmFsdWV9fX1HSUYucHJvdG90eXBlLnNldE9wdGlvbj1mdW5jdGlvbihrZXksdmFsdWUpe3RoaXMub3B0aW9uc1trZXldPXZhbHVlO2lmKHRoaXMuX2NhbnZhcyE9bnVsbCYmKGtleT09PVwid2lkdGhcInx8a2V5PT09XCJoZWlnaHRcIikpe3JldHVybiB0aGlzLl9jYW52YXNba2V5XT12YWx1ZX19O0dJRi5wcm90b3R5cGUuc2V0T3B0aW9ucz1mdW5jdGlvbihvcHRpb25zKXt2YXIga2V5LHJlc3VsdHMsdmFsdWU7cmVzdWx0cz1bXTtmb3Ioa2V5IGluIG9wdGlvbnMpe2lmKCFoYXNQcm9wLmNhbGwob3B0aW9ucyxrZXkpKWNvbnRpbnVlO3ZhbHVlPW9wdGlvbnNba2V5XTtyZXN1bHRzLnB1c2godGhpcy5zZXRPcHRpb24oa2V5LHZhbHVlKSl9cmV0dXJuIHJlc3VsdHN9O0dJRi5wcm90b3R5cGUuYWRkRnJhbWU9ZnVuY3Rpb24oaW1hZ2Usb3B0aW9ucyl7dmFyIGZyYW1lLGtleTtpZihvcHRpb25zPT1udWxsKXtvcHRpb25zPXt9fWZyYW1lPXt9O2ZyYW1lLnRyYW5zcGFyZW50PXRoaXMub3B0aW9ucy50cmFuc3BhcmVudDtmb3Ioa2V5IGluIGZyYW1lRGVmYXVsdHMpe2ZyYW1lW2tleV09b3B0aW9uc1trZXldfHxmcmFtZURlZmF1bHRzW2tleV19aWYodGhpcy5vcHRpb25zLndpZHRoPT1udWxsKXt0aGlzLnNldE9wdGlvbihcIndpZHRoXCIsaW1hZ2Uud2lkdGgpfWlmKHRoaXMub3B0aW9ucy5oZWlnaHQ9PW51bGwpe3RoaXMuc2V0T3B0aW9uKFwiaGVpZ2h0XCIsaW1hZ2UuaGVpZ2h0KX1pZih0eXBlb2YgSW1hZ2VEYXRhIT09XCJ1bmRlZmluZWRcIiYmSW1hZ2VEYXRhIT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBJbWFnZURhdGEpe2ZyYW1lLmRhdGE9aW1hZ2UuZGF0YX1lbHNlIGlmKHR5cGVvZiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQhPT1cInVuZGVmaW5lZFwiJiZDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRHx8dHlwZW9mIFdlYkdMUmVuZGVyaW5nQ29udGV4dCE9PVwidW5kZWZpbmVkXCImJldlYkdMUmVuZGVyaW5nQ29udGV4dCE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgV2ViR0xSZW5kZXJpbmdDb250ZXh0KXtpZihvcHRpb25zLmNvcHkpe2ZyYW1lLmRhdGE9dGhpcy5nZXRDb250ZXh0RGF0YShpbWFnZSl9ZWxzZXtmcmFtZS5jb250ZXh0PWltYWdlfX1lbHNlIGlmKGltYWdlLmNoaWxkTm9kZXMhPW51bGwpe2lmKG9wdGlvbnMuY29weSl7ZnJhbWUuZGF0YT10aGlzLmdldEltYWdlRGF0YShpbWFnZSl9ZWxzZXtmcmFtZS5pbWFnZT1pbWFnZX19ZWxzZXt0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGltYWdlXCIpfXJldHVybiB0aGlzLmZyYW1lcy5wdXNoKGZyYW1lKX07R0lGLnByb3RvdHlwZS5yZW5kZXI9ZnVuY3Rpb24oKXt2YXIgaSxqLG51bVdvcmtlcnMscmVmO2lmKHRoaXMucnVubmluZyl7dGhyb3cgbmV3IEVycm9yKFwiQWxyZWFkeSBydW5uaW5nXCIpfWlmKHRoaXMub3B0aW9ucy53aWR0aD09bnVsbHx8dGhpcy5vcHRpb25zLmhlaWdodD09bnVsbCl7dGhyb3cgbmV3IEVycm9yKFwiV2lkdGggYW5kIGhlaWdodCBtdXN0IGJlIHNldCBwcmlvciB0byByZW5kZXJpbmdcIil9dGhpcy5ydW5uaW5nPXRydWU7dGhpcy5uZXh0RnJhbWU9MDt0aGlzLmZpbmlzaGVkRnJhbWVzPTA7dGhpcy5pbWFnZVBhcnRzPWZ1bmN0aW9uKCl7dmFyIGoscmVmLHJlc3VsdHM7cmVzdWx0cz1bXTtmb3IoaT1qPTAscmVmPXRoaXMuZnJhbWVzLmxlbmd0aDswPD1yZWY/ajxyZWY6aj5yZWY7aT0wPD1yZWY/KytqOi0tail7cmVzdWx0cy5wdXNoKG51bGwpfXJldHVybiByZXN1bHRzfS5jYWxsKHRoaXMpO251bVdvcmtlcnM9dGhpcy5zcGF3bldvcmtlcnMoKTtpZih0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9ZWxzZXtmb3IoaT1qPTAscmVmPW51bVdvcmtlcnM7MDw9cmVmP2o8cmVmOmo+cmVmO2k9MDw9cmVmPysrajotLWope3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9fXRoaXMuZW1pdChcInN0YXJ0XCIpO3JldHVybiB0aGlzLmVtaXQoXCJwcm9ncmVzc1wiLDApfTtHSUYucHJvdG90eXBlLmFib3J0PWZ1bmN0aW9uKCl7dmFyIHdvcmtlcjt3aGlsZSh0cnVlKXt3b3JrZXI9dGhpcy5hY3RpdmVXb3JrZXJzLnNoaWZ0KCk7aWYod29ya2VyPT1udWxsKXticmVha310aGlzLmxvZyhcImtpbGxpbmcgYWN0aXZlIHdvcmtlclwiKTt3b3JrZXIudGVybWluYXRlKCl9dGhpcy5ydW5uaW5nPWZhbHNlO3JldHVybiB0aGlzLmVtaXQoXCJhYm9ydFwiKX07R0lGLnByb3RvdHlwZS5zcGF3bldvcmtlcnM9ZnVuY3Rpb24oKXt2YXIgaixudW1Xb3JrZXJzLHJlZixyZXN1bHRzO251bVdvcmtlcnM9TWF0aC5taW4odGhpcy5vcHRpb25zLndvcmtlcnMsdGhpcy5mcmFtZXMubGVuZ3RoKTsoZnVuY3Rpb24oKXtyZXN1bHRzPVtdO2Zvcih2YXIgaj1yZWY9dGhpcy5mcmVlV29ya2Vycy5sZW5ndGg7cmVmPD1udW1Xb3JrZXJzP2o8bnVtV29ya2VyczpqPm51bVdvcmtlcnM7cmVmPD1udW1Xb3JrZXJzP2orKzpqLS0pe3Jlc3VsdHMucHVzaChqKX1yZXR1cm4gcmVzdWx0c30pLmFwcGx5KHRoaXMpLmZvckVhY2goZnVuY3Rpb24oX3RoaXMpe3JldHVybiBmdW5jdGlvbihpKXt2YXIgd29ya2VyO190aGlzLmxvZyhcInNwYXduaW5nIHdvcmtlciBcIitpKTt3b3JrZXI9bmV3IFdvcmtlcihfdGhpcy5vcHRpb25zLndvcmtlclNjcmlwdCk7d29ya2VyLm9ubWVzc2FnZT1mdW5jdGlvbihldmVudCl7X3RoaXMuYWN0aXZlV29ya2Vycy5zcGxpY2UoX3RoaXMuYWN0aXZlV29ya2Vycy5pbmRleE9mKHdvcmtlciksMSk7X3RoaXMuZnJlZVdvcmtlcnMucHVzaCh3b3JrZXIpO3JldHVybiBfdGhpcy5mcmFtZUZpbmlzaGVkKGV2ZW50LmRhdGEpfTtyZXR1cm4gX3RoaXMuZnJlZVdvcmtlcnMucHVzaCh3b3JrZXIpfX0odGhpcykpO3JldHVybiBudW1Xb3JrZXJzfTtHSUYucHJvdG90eXBlLmZyYW1lRmluaXNoZWQ9ZnVuY3Rpb24oZnJhbWUpe3ZhciBpLGoscmVmO3RoaXMubG9nKFwiZnJhbWUgXCIrZnJhbWUuaW5kZXgrXCIgZmluaXNoZWQgLSBcIit0aGlzLmFjdGl2ZVdvcmtlcnMubGVuZ3RoK1wiIGFjdGl2ZVwiKTt0aGlzLmZpbmlzaGVkRnJhbWVzKys7dGhpcy5lbWl0KFwicHJvZ3Jlc3NcIix0aGlzLmZpbmlzaGVkRnJhbWVzL3RoaXMuZnJhbWVzLmxlbmd0aCk7dGhpcy5pbWFnZVBhcnRzW2ZyYW1lLmluZGV4XT1mcmFtZTtpZih0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe3RoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPWZyYW1lLmdsb2JhbFBhbGV0dGU7dGhpcy5sb2coXCJnbG9iYWwgcGFsZXR0ZSBhbmFseXplZFwiKTtpZih0aGlzLmZyYW1lcy5sZW5ndGg+Mil7Zm9yKGk9aj0xLHJlZj10aGlzLmZyZWVXb3JrZXJzLmxlbmd0aDsxPD1yZWY/ajxyZWY6aj5yZWY7aT0xPD1yZWY/KytqOi0tail7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX19fWlmKGluZGV4T2YuY2FsbCh0aGlzLmltYWdlUGFydHMsbnVsbCk+PTApe3JldHVybiB0aGlzLnJlbmRlck5leHRGcmFtZSgpfWVsc2V7cmV0dXJuIHRoaXMuZmluaXNoUmVuZGVyaW5nKCl9fTtHSUYucHJvdG90eXBlLmZpbmlzaFJlbmRlcmluZz1mdW5jdGlvbigpe3ZhciBkYXRhLGZyYW1lLGksaW1hZ2UsaixrLGwsbGVuLGxlbjEsbGVuMixsZW4zLG9mZnNldCxwYWdlLHJlZixyZWYxLHJlZjI7bGVuPTA7cmVmPXRoaXMuaW1hZ2VQYXJ0cztmb3Ioaj0wLGxlbjE9cmVmLmxlbmd0aDtqPGxlbjE7aisrKXtmcmFtZT1yZWZbal07bGVuKz0oZnJhbWUuZGF0YS5sZW5ndGgtMSkqZnJhbWUucGFnZVNpemUrZnJhbWUuY3Vyc29yfWxlbis9ZnJhbWUucGFnZVNpemUtZnJhbWUuY3Vyc29yO3RoaXMubG9nKFwicmVuZGVyaW5nIGZpbmlzaGVkIC0gZmlsZXNpemUgXCIrTWF0aC5yb3VuZChsZW4vMWUzKStcImtiXCIpO2RhdGE9bmV3IFVpbnQ4QXJyYXkobGVuKTtvZmZzZXQ9MDtyZWYxPXRoaXMuaW1hZ2VQYXJ0cztmb3Ioaz0wLGxlbjI9cmVmMS5sZW5ndGg7azxsZW4yO2srKyl7ZnJhbWU9cmVmMVtrXTtyZWYyPWZyYW1lLmRhdGE7Zm9yKGk9bD0wLGxlbjM9cmVmMi5sZW5ndGg7bDxsZW4zO2k9KytsKXtwYWdlPXJlZjJbaV07ZGF0YS5zZXQocGFnZSxvZmZzZXQpO2lmKGk9PT1mcmFtZS5kYXRhLmxlbmd0aC0xKXtvZmZzZXQrPWZyYW1lLmN1cnNvcn1lbHNle29mZnNldCs9ZnJhbWUucGFnZVNpemV9fX1pbWFnZT1uZXcgQmxvYihbZGF0YV0se3R5cGU6XCJpbWFnZS9naWZcIn0pO3JldHVybiB0aGlzLmVtaXQoXCJmaW5pc2hlZFwiLGltYWdlLGRhdGEpfTtHSUYucHJvdG90eXBlLnJlbmRlck5leHRGcmFtZT1mdW5jdGlvbigpe3ZhciBmcmFtZSx0YXNrLHdvcmtlcjtpZih0aGlzLmZyZWVXb3JrZXJzLmxlbmd0aD09PTApe3Rocm93IG5ldyBFcnJvcihcIk5vIGZyZWUgd29ya2Vyc1wiKX1pZih0aGlzLm5leHRGcmFtZT49dGhpcy5mcmFtZXMubGVuZ3RoKXtyZXR1cm59ZnJhbWU9dGhpcy5mcmFtZXNbdGhpcy5uZXh0RnJhbWUrK107d29ya2VyPXRoaXMuZnJlZVdvcmtlcnMuc2hpZnQoKTt0YXNrPXRoaXMuZ2V0VGFzayhmcmFtZSk7dGhpcy5sb2coXCJzdGFydGluZyBmcmFtZSBcIisodGFzay5pbmRleCsxKStcIiBvZiBcIit0aGlzLmZyYW1lcy5sZW5ndGgpO3RoaXMuYWN0aXZlV29ya2Vycy5wdXNoKHdvcmtlcik7cmV0dXJuIHdvcmtlci5wb3N0TWVzc2FnZSh0YXNrKX07R0lGLnByb3RvdHlwZS5nZXRDb250ZXh0RGF0YT1mdW5jdGlvbihjdHgpe3JldHVybiBjdHguZ2V0SW1hZ2VEYXRhKDAsMCx0aGlzLm9wdGlvbnMud2lkdGgsdGhpcy5vcHRpb25zLmhlaWdodCkuZGF0YX07R0lGLnByb3RvdHlwZS5nZXRJbWFnZURhdGE9ZnVuY3Rpb24oaW1hZ2Upe3ZhciBjdHg7aWYodGhpcy5fY2FudmFzPT1udWxsKXt0aGlzLl9jYW52YXM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTt0aGlzLl9jYW52YXMud2lkdGg9dGhpcy5vcHRpb25zLndpZHRoO3RoaXMuX2NhbnZhcy5oZWlnaHQ9dGhpcy5vcHRpb25zLmhlaWdodH1jdHg9dGhpcy5fY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtjdHguc2V0RmlsbD10aGlzLm9wdGlvbnMuYmFja2dyb3VuZDtjdHguZmlsbFJlY3QoMCwwLHRoaXMub3B0aW9ucy53aWR0aCx0aGlzLm9wdGlvbnMuaGVpZ2h0KTtjdHguZHJhd0ltYWdlKGltYWdlLDAsMCk7cmV0dXJuIHRoaXMuZ2V0Q29udGV4dERhdGEoY3R4KX07R0lGLnByb3RvdHlwZS5nZXRUYXNrPWZ1bmN0aW9uKGZyYW1lKXt2YXIgaW5kZXgsdGFzaztpbmRleD10aGlzLmZyYW1lcy5pbmRleE9mKGZyYW1lKTt0YXNrPXtpbmRleDppbmRleCxsYXN0OmluZGV4PT09dGhpcy5mcmFtZXMubGVuZ3RoLTEsZGVsYXk6ZnJhbWUuZGVsYXksZGlzcG9zZTpmcmFtZS5kaXNwb3NlLHRyYW5zcGFyZW50OmZyYW1lLnRyYW5zcGFyZW50LHdpZHRoOnRoaXMub3B0aW9ucy53aWR0aCxoZWlnaHQ6dGhpcy5vcHRpb25zLmhlaWdodCxxdWFsaXR5OnRoaXMub3B0aW9ucy5xdWFsaXR5LGRpdGhlcjp0aGlzLm9wdGlvbnMuZGl0aGVyLGdsb2JhbFBhbGV0dGU6dGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGUscmVwZWF0OnRoaXMub3B0aW9ucy5yZXBlYXQsY2FuVHJhbnNmZXI6YnJvd3Nlci5uYW1lPT09XCJjaHJvbWVcIn07aWYoZnJhbWUuZGF0YSE9bnVsbCl7dGFzay5kYXRhPWZyYW1lLmRhdGF9ZWxzZSBpZihmcmFtZS5jb250ZXh0IT1udWxsKXt0YXNrLmRhdGE9dGhpcy5nZXRDb250ZXh0RGF0YShmcmFtZS5jb250ZXh0KX1lbHNlIGlmKGZyYW1lLmltYWdlIT1udWxsKXt0YXNrLmRhdGE9dGhpcy5nZXRJbWFnZURhdGEoZnJhbWUuaW1hZ2UpfWVsc2V7dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBmcmFtZVwiKX1yZXR1cm4gdGFza307R0lGLnByb3RvdHlwZS5sb2c9ZnVuY3Rpb24oKXt2YXIgYXJnczthcmdzPTE8PWFyZ3VtZW50cy5sZW5ndGg/c2xpY2UuY2FsbChhcmd1bWVudHMsMCk6W107aWYoIXRoaXMub3B0aW9ucy5kZWJ1Zyl7cmV0dXJufXJldHVybiBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLGFyZ3MpfTtyZXR1cm4gR0lGfShFdmVudEVtaXR0ZXIpfSx7XCIuL0dJRkVuY29kZXIuanNcIjoyLFwiLi9icm93c2VyLmNvZmZlZVwiOjUsXCIuL2dpZi53b3JrZXIuY29mZmVlXCI6NyxldmVudHM6MX1dLDc6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBHSUZFbmNvZGVyLHJlbmRlckZyYW1lO0dJRkVuY29kZXI9cmVxdWlyZShcIi4vR0lGRW5jb2Rlci5qc1wiKTtyZW5kZXJGcmFtZT1mdW5jdGlvbihmcmFtZSl7dmFyIGVuY29kZXIscGFnZSxzdHJlYW0sdHJhbnNmZXI7ZW5jb2Rlcj1uZXcgR0lGRW5jb2RlcihmcmFtZS53aWR0aCxmcmFtZS5oZWlnaHQpO2lmKGZyYW1lLmluZGV4PT09MCl7ZW5jb2Rlci53cml0ZUhlYWRlcigpfWVsc2V7ZW5jb2Rlci5maXJzdEZyYW1lPWZhbHNlfWVuY29kZXIuc2V0VHJhbnNwYXJlbnQoZnJhbWUudHJhbnNwYXJlbnQpO2VuY29kZXIuc2V0RGlzcG9zZShmcmFtZS5kaXNwb3NlKTtlbmNvZGVyLnNldFJlcGVhdChmcmFtZS5yZXBlYXQpO2VuY29kZXIuc2V0RGVsYXkoZnJhbWUuZGVsYXkpO2VuY29kZXIuc2V0UXVhbGl0eShmcmFtZS5xdWFsaXR5KTtlbmNvZGVyLnNldERpdGhlcihmcmFtZS5kaXRoZXIpO2VuY29kZXIuc2V0R2xvYmFsUGFsZXR0ZShmcmFtZS5nbG9iYWxQYWxldHRlKTtlbmNvZGVyLmFkZEZyYW1lKGZyYW1lLmRhdGEpO2lmKGZyYW1lLmxhc3Qpe2VuY29kZXIuZmluaXNoKCl9aWYoZnJhbWUuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe2ZyYW1lLmdsb2JhbFBhbGV0dGU9ZW5jb2Rlci5nZXRHbG9iYWxQYWxldHRlKCl9c3RyZWFtPWVuY29kZXIuc3RyZWFtKCk7ZnJhbWUuZGF0YT1zdHJlYW0ucGFnZXM7ZnJhbWUuY3Vyc29yPXN0cmVhbS5jdXJzb3I7ZnJhbWUucGFnZVNpemU9c3RyZWFtLmNvbnN0cnVjdG9yLnBhZ2VTaXplO2lmKGZyYW1lLmNhblRyYW5zZmVyKXt0cmFuc2Zlcj1mdW5jdGlvbigpe3ZhciBpLGxlbixyZWYscmVzdWx0cztyZWY9ZnJhbWUuZGF0YTtyZXN1bHRzPVtdO2ZvcihpPTAsbGVuPXJlZi5sZW5ndGg7aTxsZW47aSsrKXtwYWdlPXJlZltpXTtyZXN1bHRzLnB1c2gocGFnZS5idWZmZXIpfXJldHVybiByZXN1bHRzfSgpO3JldHVybiBzZWxmLnBvc3RNZXNzYWdlKGZyYW1lLHRyYW5zZmVyKX1lbHNle3JldHVybiBzZWxmLnBvc3RNZXNzYWdlKGZyYW1lKX19O3NlbGYub25tZXNzYWdlPWZ1bmN0aW9uKGV2ZW50KXtyZXR1cm4gcmVuZGVyRnJhbWUoZXZlbnQuZGF0YSl9fSx7XCIuL0dJRkVuY29kZXIuanNcIjoyfV19LHt9LFs2XSkoNil9KTtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Z2lmLmpzLm1hcFxyXG4iLCI7KGZ1bmN0aW9uKCkge1xyXG5cclxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICB2YXIgVGFyID0gcmVxdWlyZSgnLi90YXIuanMnKTtcclxuICB2YXIgZG93bmxvYWQgPSByZXF1aXJlKCcuL2Rvd25sb2FkLmpzJyk7XHJcbiAgdmFyIEdJRiA9IHJlcXVpcmUoJy4vZ2lmLmpzJyk7XHJcbn1cclxuXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxudmFyIG9iamVjdFR5cGVzID0ge1xyXG4nZnVuY3Rpb24nOiB0cnVlLFxyXG4nb2JqZWN0JzogdHJ1ZVxyXG59O1xyXG5cclxuZnVuY3Rpb24gY2hlY2tHbG9iYWwodmFsdWUpIHtcclxuICAgIHJldHVybiAodmFsdWUgJiYgdmFsdWUuT2JqZWN0ID09PSBPYmplY3QpID8gdmFsdWUgOiBudWxsO1xyXG4gIH1cclxuXHJcbi8qKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyB3aXRob3V0IGEgZGVwZW5kZW5jeSBvbiBgcm9vdGAuICovXHJcbnZhciBmcmVlUGFyc2VGbG9hdCA9IHBhcnNlRmxvYXQsXHJcbiAgZnJlZVBhcnNlSW50ID0gcGFyc2VJbnQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgLiAqL1xyXG52YXIgZnJlZUV4cG9ydHMgPSAob2JqZWN0VHlwZXNbdHlwZW9mIGV4cG9ydHNdICYmIGV4cG9ydHMgJiYgIWV4cG9ydHMubm9kZVR5cGUpXHJcbj8gZXhwb3J0c1xyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYC4gKi9cclxudmFyIGZyZWVNb2R1bGUgPSAob2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUpXHJcbj8gbW9kdWxlXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCB0aGUgcG9wdWxhciBDb21tb25KUyBleHRlbnNpb24gYG1vZHVsZS5leHBvcnRzYC4gKi9cclxudmFyIG1vZHVsZUV4cG9ydHMgPSAoZnJlZU1vZHVsZSAmJiBmcmVlTW9kdWxlLmV4cG9ydHMgPT09IGZyZWVFeHBvcnRzKVxyXG4/IGZyZWVFeHBvcnRzXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcy4gKi9cclxudmFyIGZyZWVHbG9iYWwgPSBjaGVja0dsb2JhbChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlICYmIHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsKTtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgc2VsZmAuICovXHJcbnZhciBmcmVlU2VsZiA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiBzZWxmXSAmJiBzZWxmKTtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgd2luZG93YC4gKi9cclxudmFyIGZyZWVXaW5kb3cgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygd2luZG93XSAmJiB3aW5kb3cpO1xyXG5cclxuLyoqIERldGVjdCBgdGhpc2AgYXMgdGhlIGdsb2JhbCBvYmplY3QuICovXHJcbnZhciB0aGlzR2xvYmFsID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHRoaXNdICYmIHRoaXMpO1xyXG5cclxuLyoqXHJcbiogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdC5cclxuKlxyXG4qIFRoZSBgdGhpc2AgdmFsdWUgaXMgdXNlZCBpZiBpdCdzIHRoZSBnbG9iYWwgb2JqZWN0IHRvIGF2b2lkIEdyZWFzZW1vbmtleSdzXHJcbiogcmVzdHJpY3RlZCBgd2luZG93YCBvYmplY3QsIG90aGVyd2lzZSB0aGUgYHdpbmRvd2Agb2JqZWN0IGlzIHVzZWQuXHJcbiovXHJcbnZhciByb290ID0gZnJlZUdsb2JhbCB8fFxyXG4oKGZyZWVXaW5kb3cgIT09ICh0aGlzR2xvYmFsICYmIHRoaXNHbG9iYWwud2luZG93KSkgJiYgZnJlZVdpbmRvdykgfHxcclxuICBmcmVlU2VsZiB8fCB0aGlzR2xvYmFsIHx8IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XHJcblxyXG5pZiggISgnZ2MnIGluIHdpbmRvdyApICkge1xyXG5cdHdpbmRvdy5nYyA9IGZ1bmN0aW9uKCl7fVxyXG59XHJcblxyXG5pZiAoIUhUTUxDYW52YXNFbGVtZW50LnByb3RvdHlwZS50b0Jsb2IpIHtcclxuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShIVE1MQ2FudmFzRWxlbWVudC5wcm90b3R5cGUsICd0b0Jsb2InLCB7XHJcbiAgdmFsdWU6IGZ1bmN0aW9uIChjYWxsYmFjaywgdHlwZSwgcXVhbGl0eSkge1xyXG5cclxuICAgIHZhciBiaW5TdHIgPSBhdG9iKCB0aGlzLnRvRGF0YVVSTCh0eXBlLCBxdWFsaXR5KS5zcGxpdCgnLCcpWzFdICksXHJcbiAgICAgICAgbGVuID0gYmluU3RyLmxlbmd0aCxcclxuICAgICAgICBhcnIgPSBuZXcgVWludDhBcnJheShsZW4pO1xyXG5cclxuICAgIGZvciAodmFyIGk9MDsgaTxsZW47IGkrKyApIHtcclxuICAgICBhcnJbaV0gPSBiaW5TdHIuY2hhckNvZGVBdChpKTtcclxuICAgIH1cclxuXHJcbiAgICBjYWxsYmFjayggbmV3IEJsb2IoIFthcnJdLCB7dHlwZTogdHlwZSB8fCAnaW1hZ2UvcG5nJ30gKSApO1xyXG4gIH1cclxuIH0pO1xyXG59XHJcblxyXG4vLyBAbGljZW5zZSBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXHJcbi8vIGNvcHlyaWdodCBQYXVsIElyaXNoIDIwMTVcclxuXHJcblxyXG4vLyBEYXRlLm5vdygpIGlzIHN1cHBvcnRlZCBldmVyeXdoZXJlIGV4Y2VwdCBJRTguIEZvciBJRTggd2UgdXNlIHRoZSBEYXRlLm5vdyBwb2x5ZmlsbFxyXG4vLyAgIGdpdGh1Yi5jb20vRmluYW5jaWFsLVRpbWVzL3BvbHlmaWxsLXNlcnZpY2UvYmxvYi9tYXN0ZXIvcG9seWZpbGxzL0RhdGUubm93L3BvbHlmaWxsLmpzXHJcbi8vIGFzIFNhZmFyaSA2IGRvZXNuJ3QgaGF2ZSBzdXBwb3J0IGZvciBOYXZpZ2F0aW9uVGltaW5nLCB3ZSB1c2UgYSBEYXRlLm5vdygpIHRpbWVzdGFtcCBmb3IgcmVsYXRpdmUgdmFsdWVzXHJcblxyXG4vLyBpZiB5b3Ugd2FudCB2YWx1ZXMgc2ltaWxhciB0byB3aGF0IHlvdSdkIGdldCB3aXRoIHJlYWwgcGVyZi5ub3csIHBsYWNlIHRoaXMgdG93YXJkcyB0aGUgaGVhZCBvZiB0aGUgcGFnZVxyXG4vLyBidXQgaW4gcmVhbGl0eSwgeW91J3JlIGp1c3QgZ2V0dGluZyB0aGUgZGVsdGEgYmV0d2VlbiBub3coKSBjYWxscywgc28gaXQncyBub3QgdGVycmlibHkgaW1wb3J0YW50IHdoZXJlIGl0J3MgcGxhY2VkXHJcblxyXG5cclxuKGZ1bmN0aW9uKCl7XHJcblxyXG4gIGlmIChcInBlcmZvcm1hbmNlXCIgaW4gd2luZG93ID09IGZhbHNlKSB7XHJcbiAgICAgIHdpbmRvdy5wZXJmb3JtYW5jZSA9IHt9O1xyXG4gIH1cclxuXHJcbiAgRGF0ZS5ub3cgPSAoRGF0ZS5ub3cgfHwgZnVuY3Rpb24gKCkgeyAgLy8gdGhhbmtzIElFOFxyXG5cdCAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gIH0pO1xyXG5cclxuICBpZiAoXCJub3dcIiBpbiB3aW5kb3cucGVyZm9ybWFuY2UgPT0gZmFsc2Upe1xyXG5cclxuICAgIHZhciBub3dPZmZzZXQgPSBEYXRlLm5vdygpO1xyXG5cclxuICAgIGlmIChwZXJmb3JtYW5jZS50aW1pbmcgJiYgcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydCl7XHJcbiAgICAgIG5vd09mZnNldCA9IHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnRcclxuICAgIH1cclxuXHJcbiAgICB3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24gbm93KCl7XHJcbiAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gbm93T2Zmc2V0O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbn0pKCk7XHJcblxyXG5cclxuZnVuY3Rpb24gcGFkKCBuICkge1xyXG5cdHJldHVybiBTdHJpbmcoXCIwMDAwMDAwXCIgKyBuKS5zbGljZSgtNyk7XHJcbn1cclxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvQWRkLW9ucy9Db2RlX3NuaXBwZXRzL1RpbWVyc1xyXG5cclxudmFyIGdfc3RhcnRUaW1lID0gd2luZG93LkRhdGUubm93KCk7XHJcblxyXG5mdW5jdGlvbiBndWlkKCkge1xyXG5cdGZ1bmN0aW9uIHM0KCkge1xyXG5cdFx0cmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApLnRvU3RyaW5nKDE2KS5zdWJzdHJpbmcoMSk7XHJcblx0fVxyXG5cdHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gQ0NGcmFtZUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgX2hhbmRsZXJzID0ge307XHJcblxyXG5cdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHJcblx0dGhpcy5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBoYW5kbGVyKSB7XHJcblxyXG5cdFx0X2hhbmRsZXJzW2V2ZW50XSA9IGhhbmRsZXI7XHJcblxyXG5cdH07XHJcblxyXG5cdHRoaXMuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblxyXG5cdFx0dmFyIGhhbmRsZXIgPSBfaGFuZGxlcnNbZXZlbnRdO1xyXG5cdFx0aWYgKGhhbmRsZXIpIHtcclxuXHJcblx0XHRcdGhhbmRsZXIuYXBwbHkobnVsbCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHR0aGlzLmZpbGVuYW1lID0gc2V0dGluZ3MubmFtZSB8fCBndWlkKCk7XHJcblx0dGhpcy5leHRlbnNpb24gPSAnJztcclxuXHR0aGlzLm1pbWVUeXBlID0gJyc7XHJcblxyXG59XHJcblxyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zYWZlVG9Qcm9jZWVkID0gZnVuY3Rpb24oKXsgcmV0dXJuIHRydWU7IH07XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdGVwID0gZnVuY3Rpb24oKSB7IGNvbnNvbGUubG9nKCAnU3RlcCBub3Qgc2V0IScgKSB9XHJcblxyXG5mdW5jdGlvbiBDQ1RhckVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcudGFyJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAnYXBwbGljYXRpb24veC10YXInXHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJyc7XHJcblxyXG5cdHRoaXMudGFwZSA9IG51bGxcclxuXHR0aGlzLmNvdW50ID0gMDtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe1xyXG5cclxuXHR0aGlzLmRpc3Bvc2UoKTtcclxuXHJcbn07XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBibG9iICkge1xyXG5cclxuXHR2YXIgZmlsZVJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcblx0ZmlsZVJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMudGFwZS5hcHBlbmQoIHBhZCggdGhpcy5jb3VudCApICsgdGhpcy5maWxlRXh0ZW5zaW9uLCBuZXcgVWludDhBcnJheSggZmlsZVJlYWRlci5yZXN1bHQgKSApO1xyXG5cclxuXHRcdC8vaWYoIHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lID4gMCAmJiAoIHRoaXMuZnJhbWVzLmxlbmd0aCAvIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlICkgPj0gdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgKSB7XHJcblxyXG5cdFx0dGhpcy5jb3VudCsrO1xyXG5cdFx0dGhpcy5zdGVwKCk7XHJcblx0fS5iaW5kKCB0aGlzICk7XHJcblx0ZmlsZVJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0Y2FsbGJhY2soIHRoaXMudGFwZS5zYXZlKCkgKTtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLnRhcGUgPSBuZXcgVGFyKCk7XHJcblx0dGhpcy5jb3VudCA9IDA7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ1BOR0VuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ1RhckVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy50eXBlID0gJ2ltYWdlL3BuZyc7XHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJy5wbmcnO1xyXG5cclxufVxyXG5cclxuQ0NQTkdFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDVGFyRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDUE5HRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0Y2FudmFzLnRvQmxvYiggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRDQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZC5jYWxsKCB0aGlzLCBibG9iICk7XHJcblx0fS5iaW5kKCB0aGlzICksIHRoaXMudHlwZSApXHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0pQRUdFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NUYXJFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMudHlwZSA9ICdpbWFnZS9qcGVnJztcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnLmpwZyc7XHJcblx0dGhpcy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG59XHJcblxyXG5DQ0pQRUdFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDVGFyRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDSlBFR0VuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGNhbnZhcy50b0Jsb2IoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0Q0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQuY2FsbCggdGhpcywgYmxvYiApO1xyXG5cdH0uYmluZCggdGhpcyApLCB0aGlzLnR5cGUsIHRoaXMucXVhbGl0eSApXHJcblxyXG59XHJcblxyXG4vKlxyXG5cclxuXHRXZWJNIEVuY29kZXJcclxuXHJcbiovXHJcblxyXG5mdW5jdGlvbiBDQ1dlYk1FbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcblx0aWYoIGNhbnZhcy50b0RhdGFVUkwoICdpbWFnZS93ZWJwJyApLnN1YnN0cig1LDEwKSAhPT0gJ2ltYWdlL3dlYnAnICl7XHJcblx0XHRjb25zb2xlLmxvZyggXCJXZWJQIG5vdCBzdXBwb3J0ZWQgLSB0cnkgYW5vdGhlciBleHBvcnQgZm9ybWF0XCIgKVxyXG5cdH1cclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy53ZWJtJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAndmlkZW8vd2VibSdcclxuXHR0aGlzLmJhc2VGaWxlbmFtZSA9IHRoaXMuZmlsZW5hbWU7XHJcblxyXG5cdHRoaXMuZnJhbWVzID0gW107XHJcblx0dGhpcy5wYXJ0ID0gMTtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlciA9IG5ldyBXZWJNV3JpdGVyKHtcclxuICAgIHF1YWxpdHk6IHRoaXMucXVhbGl0eSxcclxuICAgIGZpbGVXcml0ZXI6IG51bGwsXHJcbiAgICBmZDogbnVsbCxcclxuICAgIGZyYW1lUmF0ZTogc2V0dGluZ3MuZnJhbWVyYXRlXHJcbn0pO1xyXG5cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZGlzcG9zZSgpO1xyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlci5hZGRGcmFtZShjYW52YXMpO1xyXG5cclxuXHQvL3RoaXMuZnJhbWVzLnB1c2goIGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3dlYnAnLCB0aGlzLnF1YWxpdHkpICk7XHJcblxyXG5cdGlmKCB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSA+IDAgJiYgKCB0aGlzLmZyYW1lcy5sZW5ndGggLyB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApID49IHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lICkge1xyXG5cdFx0dGhpcy5zYXZlKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdFx0dGhpcy5maWxlbmFtZSA9IHRoaXMuYmFzZUZpbGVuYW1lICsgJy1wYXJ0LScgKyBwYWQoIHRoaXMucGFydCApO1xyXG5cdFx0XHRkb3dubG9hZCggYmxvYiwgdGhpcy5maWxlbmFtZSArIHRoaXMuZXh0ZW5zaW9uLCB0aGlzLm1pbWVUeXBlICk7XHJcblx0XHRcdHRoaXMuZGlzcG9zZSgpO1xyXG5cdFx0XHR0aGlzLnBhcnQrKztcclxuXHRcdFx0dGhpcy5maWxlbmFtZSA9IHRoaXMuYmFzZUZpbGVuYW1lICsgJy1wYXJ0LScgKyBwYWQoIHRoaXMucGFydCApO1xyXG5cdFx0XHR0aGlzLnN0ZXAoKTtcclxuXHRcdH0uYmluZCggdGhpcyApIClcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhpcy5zdGVwKCk7XHJcblx0fVxyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbi8vXHRpZiggIXRoaXMuZnJhbWVzLmxlbmd0aCApIHJldHVybjtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlci5jb21wbGV0ZSgpLnRoZW4oY2FsbGJhY2spO1xyXG5cclxuXHQvKnZhciB3ZWJtID0gV2hhbW15LmZyb21JbWFnZUFycmF5KCB0aGlzLmZyYW1lcywgdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKVxyXG5cdHZhciBibG9iID0gbmV3IEJsb2IoIFsgd2VibSBdLCB7IHR5cGU6IFwib2N0ZXQvc3RyZWFtXCIgfSApO1xyXG5cdGNhbGxiYWNrKCBibG9iICk7Ki9cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmZyYW1lcyA9IFtdO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxuXHR0aGlzLmVuY29kZXIgPSBuZXcgRkZNcGVnU2VydmVyLlZpZGVvKCBzZXR0aW5ncyApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvY2VzcycsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuZW1pdCggJ3Byb2Nlc3MnIClcclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oJ2ZpbmlzaGVkJywgZnVuY3Rpb24oIHVybCwgc2l6ZSApIHtcclxuICAgICAgICB2YXIgY2IgPSB0aGlzLmNhbGxiYWNrO1xyXG4gICAgICAgIGlmICggY2IgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGNiKCB1cmwsIHNpemUgKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvZ3Jlc3MnLCBmdW5jdGlvbiggcHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgaWYgKCB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyggcHJvZ3Jlc3MgKVxyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdlcnJvcicsIGZ1bmN0aW9uKCBkYXRhICkge1xyXG4gICAgICAgIGFsZXJ0KEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpKTtcclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zdGFydCggdGhpcy5zZXR0aW5ncyApO1xyXG5cclxufTtcclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmFkZCggY2FudmFzICk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG4gICAgdGhpcy5lbmNvZGVyLmVuZCgpO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zYWZlVG9Qcm9jZWVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5lbmNvZGVyLnNhZmVUb1Byb2NlZWQoKTtcclxufTtcclxuXHJcbi8qXHJcblx0SFRNTENhbnZhc0VsZW1lbnQuY2FwdHVyZVN0cmVhbSgpXHJcbiovXHJcblxyXG5mdW5jdGlvbiBDQ1N0cmVhbUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLmZyYW1lcmF0ZSA9IHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdHRoaXMudHlwZSA9ICd2aWRlby93ZWJtJztcclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcud2VibSc7XHJcblx0dGhpcy5zdHJlYW0gPSBudWxsO1xyXG5cdHRoaXMubWVkaWFSZWNvcmRlciA9IG51bGw7XHJcblx0dGhpcy5jaHVua3MgPSBbXTtcclxuXHJcbn1cclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0aWYoICF0aGlzLnN0cmVhbSApIHtcclxuXHRcdHRoaXMuc3RyZWFtID0gY2FudmFzLmNhcHR1cmVTdHJlYW0oIHRoaXMuZnJhbWVyYXRlICk7XHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIgPSBuZXcgTWVkaWFSZWNvcmRlciggdGhpcy5zdHJlYW0gKTtcclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlci5zdGFydCgpO1xyXG5cclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPSBmdW5jdGlvbihlKSB7XHJcblx0XHRcdHRoaXMuY2h1bmtzLnB1c2goZS5kYXRhKTtcclxuXHRcdH0uYmluZCggdGhpcyApO1xyXG5cclxuXHR9XHJcblx0dGhpcy5zdGVwKCk7XHJcblxyXG59XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdHRoaXMubWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbiggZSApIHtcclxuXHRcdHZhciBibG9iID0gbmV3IEJsb2IoIHRoaXMuY2h1bmtzLCB7ICd0eXBlJyA6ICd2aWRlby93ZWJtJyB9KTtcclxuXHRcdHRoaXMuY2h1bmtzID0gW107XHJcblx0XHRjYWxsYmFjayggYmxvYiApO1xyXG5cclxuXHR9LmJpbmQoIHRoaXMgKTtcclxuXHJcblx0dGhpcy5tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuXHJcbn1cclxuXHJcbi8qZnVuY3Rpb24gQ0NHSUZFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gc2V0dGluZ3MucXVhbGl0eSB8fCA2O1xyXG5cdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHJcblx0dGhpcy5lbmNvZGVyID0gbmV3IEdJRkVuY29kZXIoKTtcclxuXHR0aGlzLmVuY29kZXIuc2V0UmVwZWF0KCAxICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0RGVsYXkoIHNldHRpbmdzLnN0ZXAgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRRdWFsaXR5KCA2ICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0VHJhbnNwYXJlbnQoIG51bGwgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRTaXplKCAxNTAsIDE1MCApO1xyXG5cclxuICBcdHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuICBcdHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCggJzJkJyApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyICk7XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zdGFydCgpO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmNhbnZhcy53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHR0aGlzLmNhbnZhcy5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdHRoaXMuY3R4LmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCB0aGlzLmN0eCApO1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc2V0U2l6ZSggY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0ICk7XHJcblx0dmFyIHJlYWRCdWZmZXIgPSBuZXcgVWludDhBcnJheShjYW52YXMud2lkdGggKiBjYW52YXMuaGVpZ2h0ICogNCk7XHJcblx0dmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApO1xyXG5cdGNvbnRleHQucmVhZFBpeGVscygwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQsIGNvbnRleHQuUkdCQSwgY29udGV4dC5VTlNJR05FRF9CWVRFLCByZWFkQnVmZmVyKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHJlYWRCdWZmZXIsIHRydWUgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuZmluaXNoKCk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdHZhciBiaW5hcnlfZ2lmID0gdGhpcy5lbmNvZGVyLnN0cmVhbSgpLmdldERhdGEoKTtcclxuXHJcblx0dmFyIGRhdGFfdXJsID0gJ2RhdGE6aW1hZ2UvZ2lmO2Jhc2U2NCwnK2VuY29kZTY0KGJpbmFyeV9naWYpO1xyXG5cdHdpbmRvdy5sb2NhdGlvbiA9IGRhdGFfdXJsO1xyXG5cdHJldHVybjtcclxuXHJcblx0dmFyIGJsb2IgPSBuZXcgQmxvYiggWyBiaW5hcnlfZ2lmIF0sIHsgdHlwZTogXCJvY3RldC9zdHJlYW1cIiB9ICk7XHJcblx0dmFyIHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKCBibG9iICk7XHJcblx0Y2FsbGJhY2soIHVybCApO1xyXG5cclxufSovXHJcblxyXG5mdW5jdGlvbiBDQ0dJRkVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gMzEgLSAoICggc2V0dGluZ3MucXVhbGl0eSAqIDMwIC8gMTAwICkgfHwgMTAgKTtcclxuXHRzZXR0aW5ncy53b3JrZXJzID0gc2V0dGluZ3Mud29ya2VycyB8fCA0O1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcuZ2lmJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAnaW1hZ2UvZ2lmJ1xyXG5cclxuICBcdHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuICBcdHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCggJzJkJyApO1xyXG4gIFx0dGhpcy5zaXplU2V0ID0gZmFsc2U7XHJcblxyXG4gIFx0dGhpcy5lbmNvZGVyID0gbmV3IEdJRih7XHJcblx0XHR3b3JrZXJzOiBzZXR0aW5ncy53b3JrZXJzLFxyXG5cdFx0cXVhbGl0eTogc2V0dGluZ3MucXVhbGl0eSxcclxuXHRcdHdvcmtlclNjcmlwdDogc2V0dGluZ3Mud29ya2Vyc1BhdGggKyAnZ2lmLndvcmtlci5qcydcclxuXHR9ICk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvZ3Jlc3MnLCBmdW5jdGlvbiggcHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgaWYgKCB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyggcHJvZ3Jlc3MgKVxyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCdmaW5pc2hlZCcsIGZ1bmN0aW9uKCBibG9iICkge1xyXG4gICAgICAgIHZhciBjYiA9IHRoaXMuY2FsbGJhY2s7XHJcbiAgICAgICAgaWYgKCBjYiApIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgY2IoIGJsb2IgKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRpZiggIXRoaXMuc2l6ZVNldCApIHtcclxuXHRcdHRoaXMuZW5jb2Rlci5zZXRPcHRpb24oICd3aWR0aCcsY2FudmFzLndpZHRoICk7XHJcblx0XHR0aGlzLmVuY29kZXIuc2V0T3B0aW9uKCAnaGVpZ2h0JyxjYW52YXMuaGVpZ2h0ICk7XHJcblx0XHR0aGlzLnNpemVTZXQgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0dGhpcy5jYW52YXMud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0dGhpcy5jYW52YXMuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHR0aGlzLmN0eC5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHRoaXMuY3R4LCB7IGNvcHk6IHRydWUsIGRlbGF5OiB0aGlzLnNldHRpbmdzLnN0ZXAgfSApO1xyXG5cdHRoaXMuc3RlcCgpO1xyXG5cclxuXHQvKnRoaXMuZW5jb2Rlci5zZXRTaXplKCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQgKTtcclxuXHR2YXIgcmVhZEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGNhbnZhcy53aWR0aCAqIGNhbnZhcy5oZWlnaHQgKiA0KTtcclxuXHR2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICk7XHJcblx0Y29udGV4dC5yZWFkUGl4ZWxzKDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCwgY29udGV4dC5SR0JBLCBjb250ZXh0LlVOU0lHTkVEX0JZVEUsIHJlYWRCdWZmZXIpO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggcmVhZEJ1ZmZlciwgdHJ1ZSApOyovXHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG5cclxuXHR0aGlzLmVuY29kZXIucmVuZGVyKCk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ2FwdHVyZSggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBfc2V0dGluZ3MgPSBzZXR0aW5ncyB8fCB7fSxcclxuXHRcdF9kYXRlID0gbmV3IERhdGUoKSxcclxuXHRcdF92ZXJib3NlLFxyXG5cdFx0X2Rpc3BsYXksXHJcblx0XHRfdGltZSxcclxuXHRcdF9zdGFydFRpbWUsXHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lLFxyXG5cdFx0X3BlcmZvcm1hbmNlU3RhcnRUaW1lLFxyXG5cdFx0X3N0ZXAsXHJcbiAgICAgICAgX2VuY29kZXIsXHJcblx0XHRfdGltZW91dHMgPSBbXSxcclxuXHRcdF9pbnRlcnZhbHMgPSBbXSxcclxuXHRcdF9mcmFtZUNvdW50ID0gMCxcclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID0gMCxcclxuXHRcdF9sYXN0RnJhbWUgPSBudWxsLFxyXG5cdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcyA9IFtdLFxyXG5cdFx0X2NhcHR1cmluZyA9IGZhbHNlLFxyXG4gICAgICAgIF9oYW5kbGVycyA9IHt9O1xyXG5cclxuXHRfc2V0dGluZ3MuZnJhbWVyYXRlID0gX3NldHRpbmdzLmZyYW1lcmF0ZSB8fCA2MDtcclxuXHRfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA9IDIgKiAoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzIHx8IDEgKTtcclxuXHRfdmVyYm9zZSA9IF9zZXR0aW5ncy52ZXJib3NlIHx8IGZhbHNlO1xyXG5cdF9kaXNwbGF5ID0gX3NldHRpbmdzLmRpc3BsYXkgfHwgZmFsc2U7XHJcblx0X3NldHRpbmdzLnN0ZXAgPSAxMDAwLjAgLyBfc2V0dGluZ3MuZnJhbWVyYXRlIDtcclxuXHRfc2V0dGluZ3MudGltZUxpbWl0ID0gX3NldHRpbmdzLnRpbWVMaW1pdCB8fCAwO1xyXG5cdF9zZXR0aW5ncy5mcmFtZUxpbWl0ID0gX3NldHRpbmdzLmZyYW1lTGltaXQgfHwgMDtcclxuXHRfc2V0dGluZ3Muc3RhcnRUaW1lID0gX3NldHRpbmdzLnN0YXJ0VGltZSB8fCAwO1xyXG5cclxuXHR2YXIgX3RpbWVEaXNwbGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRfdGltZURpc3BsYXkuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5sZWZ0ID0gX3RpbWVEaXNwbGF5LnN0eWxlLnRvcCA9IDBcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2JsYWNrJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmZvbnRTaXplID0gJzExcHgnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnBhZGRpbmcgPSAnNXB4J1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5jb2xvciA9ICdyZWQnO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS56SW5kZXggPSAxMDAwMDBcclxuXHRpZiggX3NldHRpbmdzLmRpc3BsYXkgKSBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBfdGltZURpc3BsYXkgKTtcclxuXHJcblx0dmFyIGNhbnZhc01vdGlvbkJsdXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG5cdHZhciBjdHhNb3Rpb25CbHVyID0gY2FudmFzTW90aW9uQmx1ci5nZXRDb250ZXh0KCAnMmQnICk7XHJcblx0dmFyIGJ1ZmZlck1vdGlvbkJsdXI7XHJcblx0dmFyIGltYWdlRGF0YTtcclxuXHJcblx0X2xvZyggJ1N0ZXAgaXMgc2V0IHRvICcgKyBfc2V0dGluZ3Muc3RlcCArICdtcycgKTtcclxuXHJcbiAgICB2YXIgX2VuY29kZXJzID0ge1xyXG5cdFx0Z2lmOiBDQ0dJRkVuY29kZXIsXHJcblx0XHR3ZWJtOiBDQ1dlYk1FbmNvZGVyLFxyXG5cdFx0ZmZtcGVnc2VydmVyOiBDQ0ZGTXBlZ1NlcnZlckVuY29kZXIsXHJcblx0XHRwbmc6IENDUE5HRW5jb2RlcixcclxuXHRcdGpwZzogQ0NKUEVHRW5jb2RlcixcclxuXHRcdCd3ZWJtLW1lZGlhcmVjb3JkZXInOiBDQ1N0cmVhbUVuY29kZXJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIGN0b3IgPSBfZW5jb2RlcnNbIF9zZXR0aW5ncy5mb3JtYXQgXTtcclxuICAgIGlmICggIWN0b3IgKSB7XHJcblx0XHR0aHJvdyBcIkVycm9yOiBJbmNvcnJlY3Qgb3IgbWlzc2luZyBmb3JtYXQ6IFZhbGlkIGZvcm1hdHMgYXJlIFwiICsgT2JqZWN0LmtleXMoX2VuY29kZXJzKS5qb2luKFwiLCBcIik7XHJcbiAgICB9XHJcbiAgICBfZW5jb2RlciA9IG5ldyBjdG9yKCBfc2V0dGluZ3MgKTtcclxuICAgIF9lbmNvZGVyLnN0ZXAgPSBfc3RlcFxyXG5cclxuXHRfZW5jb2Rlci5vbigncHJvY2VzcycsIF9wcm9jZXNzKTtcclxuICAgIF9lbmNvZGVyLm9uKCdwcm9ncmVzcycsIF9wcm9ncmVzcyk7XHJcblxyXG4gICAgaWYgKFwicGVyZm9ybWFuY2VcIiBpbiB3aW5kb3cgPT0gZmFsc2UpIHtcclxuICAgIFx0d2luZG93LnBlcmZvcm1hbmNlID0ge307XHJcbiAgICB9XHJcblxyXG5cdERhdGUubm93ID0gKERhdGUubm93IHx8IGZ1bmN0aW9uICgpIHsgIC8vIHRoYW5rcyBJRThcclxuXHRcdHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuXHR9KTtcclxuXHJcblx0aWYgKFwibm93XCIgaW4gd2luZG93LnBlcmZvcm1hbmNlID09IGZhbHNlKXtcclxuXHJcblx0XHR2YXIgbm93T2Zmc2V0ID0gRGF0ZS5ub3coKTtcclxuXHJcblx0XHRpZiAocGVyZm9ybWFuY2UudGltaW5nICYmIHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQpe1xyXG5cdFx0XHRub3dPZmZzZXQgPSBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0XHJcblx0XHR9XHJcblxyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uIG5vdygpe1xyXG5cdFx0XHRyZXR1cm4gRGF0ZS5ub3coKSAtIG5vd09mZnNldDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciBfb2xkU2V0VGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0LFxyXG5cdFx0X29sZFNldEludGVydmFsID0gd2luZG93LnNldEludGVydmFsLFxyXG5cdCAgICBcdF9vbGRDbGVhckludGVydmFsID0gd2luZG93LmNsZWFySW50ZXJ2YWwsXHJcblx0XHRfb2xkQ2xlYXJUaW1lb3V0ID0gd2luZG93LmNsZWFyVGltZW91dCxcclxuXHRcdF9vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxyXG5cdFx0X29sZE5vdyA9IHdpbmRvdy5EYXRlLm5vdyxcclxuXHRcdF9vbGRQZXJmb3JtYW5jZU5vdyA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3csXHJcblx0XHRfb2xkR2V0VGltZSA9IHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lO1xyXG5cdC8vIERhdGUucHJvdG90eXBlLl9vbGRHZXRUaW1lID0gRGF0ZS5wcm90b3R5cGUuZ2V0VGltZTtcclxuXHJcblx0dmFyIG1lZGlhID0gW107XHJcblxyXG5cdGZ1bmN0aW9uIF9pbml0KCkge1xyXG5cclxuXHRcdF9sb2coICdDYXB0dXJlciBzdGFydCcgKTtcclxuXHJcblx0XHRfc3RhcnRUaW1lID0gd2luZG93LkRhdGUubm93KCk7XHJcblx0XHRfdGltZSA9IF9zdGFydFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cdFx0X3BlcmZvcm1hbmNlU3RhcnRUaW1lID0gd2luZG93LnBlcmZvcm1hbmNlLm5vdygpO1xyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSA9IF9wZXJmb3JtYW5jZVN0YXJ0VGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblxyXG5cdFx0d2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWUgPSBmdW5jdGlvbigpe1xyXG5cdFx0XHRyZXR1cm4gX3RpbWU7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LkRhdGUubm93ID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdHJldHVybiBfdGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0d2luZG93LnNldFRpbWVvdXQgPSBmdW5jdGlvbiggY2FsbGJhY2ssIHRpbWUgKSB7XHJcblx0XHRcdHZhciB0ID0ge1xyXG5cdFx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0XHR0aW1lOiB0aW1lLFxyXG5cdFx0XHRcdHRyaWdnZXJUaW1lOiBfdGltZSArIHRpbWVcclxuXHRcdFx0fTtcclxuXHRcdFx0X3RpbWVvdXRzLnB1c2goIHQgKTtcclxuXHRcdFx0X2xvZyggJ1RpbWVvdXQgc2V0IHRvICcgKyB0LnRpbWUgKTtcclxuICAgICAgICAgICAgcmV0dXJuIHQ7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCA9IGZ1bmN0aW9uKCBpZCApIHtcclxuXHRcdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfdGltZW91dHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdFx0aWYoIF90aW1lb3V0c1sgaiBdID09IGlkICkge1xyXG5cdFx0XHRcdFx0X3RpbWVvdXRzLnNwbGljZSggaiwgMSApO1xyXG5cdFx0XHRcdFx0X2xvZyggJ1RpbWVvdXQgY2xlYXJlZCcgKTtcclxuXHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uKCBjYWxsYmFjaywgdGltZSApIHtcclxuXHRcdFx0dmFyIHQgPSB7XHJcblx0XHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxyXG5cdFx0XHRcdHRpbWU6IHRpbWUsXHJcblx0XHRcdFx0dHJpZ2dlclRpbWU6IF90aW1lICsgdGltZVxyXG5cdFx0XHR9O1xyXG5cdFx0XHRfaW50ZXJ2YWxzLnB1c2goIHQgKTtcclxuXHRcdFx0X2xvZyggJ0ludGVydmFsIHNldCB0byAnICsgdC50aW1lICk7XHJcblx0XHRcdHJldHVybiB0O1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5jbGVhckludGVydmFsID0gZnVuY3Rpb24oIGlkICkge1xyXG5cdFx0XHRfbG9nKCAnY2xlYXIgSW50ZXJ2YWwnICk7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblx0XHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MucHVzaCggY2FsbGJhY2sgKTtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0cmV0dXJuIF9wZXJmb3JtYW5jZVRpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdGZ1bmN0aW9uIGhvb2tDdXJyZW50VGltZSgpIHtcclxuXHRcdFx0aWYoICF0aGlzLl9ob29rZWQgKSB7XHJcblx0XHRcdFx0dGhpcy5faG9va2VkID0gdHJ1ZTtcclxuXHRcdFx0XHR0aGlzLl9ob29rZWRUaW1lID0gdGhpcy5jdXJyZW50VGltZSB8fCAwO1xyXG5cdFx0XHRcdHRoaXMucGF1c2UoKTtcclxuXHRcdFx0XHRtZWRpYS5wdXNoKCB0aGlzICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHRoaXMuX2hvb2tlZFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIEhUTUxWaWRlb0VsZW1lbnQucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7IGdldDogaG9va0N1cnJlbnRUaW1lIH0gKVxyXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIEhUTUxBdWRpb0VsZW1lbnQucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7IGdldDogaG9va0N1cnJlbnRUaW1lIH0gKVxyXG5cdFx0fSBjYXRjaCAoZXJyKSB7XHJcblx0XHRcdF9sb2coZXJyKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RhcnQoKSB7XHJcblx0XHRfaW5pdCgpO1xyXG5cdFx0X2VuY29kZXIuc3RhcnQoKTtcclxuXHRcdF9jYXB0dXJpbmcgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0b3AoKSB7XHJcblx0XHRfY2FwdHVyaW5nID0gZmFsc2U7XHJcblx0XHRfZW5jb2Rlci5zdG9wKCk7XHJcblx0XHRfZGVzdHJveSgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NhbGwoIGZuLCBwICkge1xyXG5cdFx0X29sZFNldFRpbWVvdXQoIGZuLCAwLCBwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RlcCgpIHtcclxuXHRcdC8vX29sZFJlcXVlc3RBbmltYXRpb25GcmFtZSggX3Byb2Nlc3MgKTtcclxuXHRcdF9jYWxsKCBfcHJvY2VzcyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2Rlc3Ryb3koKSB7XHJcblx0XHRfbG9nKCAnQ2FwdHVyZXIgc3RvcCcgKTtcclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0ID0gX29sZFNldFRpbWVvdXQ7XHJcblx0XHR3aW5kb3cuc2V0SW50ZXJ2YWwgPSBfb2xkU2V0SW50ZXJ2YWw7XHJcblx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCA9IF9vbGRDbGVhckludGVydmFsO1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCA9IF9vbGRDbGVhclRpbWVvdXQ7XHJcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gX29sZFJlcXVlc3RBbmltYXRpb25GcmFtZTtcclxuXHRcdHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lID0gX29sZEdldFRpbWU7XHJcblx0XHR3aW5kb3cuRGF0ZS5ub3cgPSBfb2xkTm93O1xyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IF9vbGRQZXJmb3JtYW5jZU5vdztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF91cGRhdGVUaW1lKCkge1xyXG5cdFx0dmFyIHNlY29uZHMgPSBfZnJhbWVDb3VudCAvIF9zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0XHRpZiggKCBfc2V0dGluZ3MuZnJhbWVMaW1pdCAmJiBfZnJhbWVDb3VudCA+PSBfc2V0dGluZ3MuZnJhbWVMaW1pdCApIHx8ICggX3NldHRpbmdzLnRpbWVMaW1pdCAmJiBzZWNvbmRzID49IF9zZXR0aW5ncy50aW1lTGltaXQgKSApIHtcclxuXHRcdFx0X3N0b3AoKTtcclxuXHRcdFx0X3NhdmUoKTtcclxuXHRcdH1cclxuXHRcdHZhciBkID0gbmV3IERhdGUoIG51bGwgKTtcclxuXHRcdGQuc2V0U2Vjb25kcyggc2Vjb25kcyApO1xyXG5cdFx0aWYoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID4gMiApIHtcclxuXHRcdFx0X3RpbWVEaXNwbGF5LnRleHRDb250ZW50ID0gJ0NDYXB0dXJlICcgKyBfc2V0dGluZ3MuZm9ybWF0ICsgJyB8ICcgKyBfZnJhbWVDb3VudCArICcgZnJhbWVzICgnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKyAnIGludGVyKSB8ICcgKyAgZC50b0lTT1N0cmluZygpLnN1YnN0ciggMTEsIDggKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdF90aW1lRGlzcGxheS50ZXh0Q29udGVudCA9ICdDQ2FwdHVyZSAnICsgX3NldHRpbmdzLmZvcm1hdCArICcgfCAnICsgX2ZyYW1lQ291bnQgKyAnIGZyYW1lcyB8ICcgKyAgZC50b0lTT1N0cmluZygpLnN1YnN0ciggMTEsIDggKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jaGVja0ZyYW1lKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0aWYoIGNhbnZhc01vdGlvbkJsdXIud2lkdGggIT09IGNhbnZhcy53aWR0aCB8fCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCAhPT0gY2FudmFzLmhlaWdodCApIHtcclxuXHRcdFx0Y2FudmFzTW90aW9uQmx1ci53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHRcdFx0Y2FudmFzTW90aW9uQmx1ci5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyID0gbmV3IFVpbnQxNkFycmF5KCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCAqIGNhbnZhc01vdGlvbkJsdXIud2lkdGggKiA0ICk7XHJcblx0XHRcdGN0eE1vdGlvbkJsdXIuZmlsbFN0eWxlID0gJyMwJ1xyXG5cdFx0XHRjdHhNb3Rpb25CbHVyLmZpbGxSZWN0KCAwLCAwLCBjYW52YXNNb3Rpb25CbHVyLndpZHRoLCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCApO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9ibGVuZEZyYW1lKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0Ly9fbG9nKCAnSW50ZXJtZWRpYXRlIEZyYW1lOiAnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKTtcclxuXHJcblx0XHRjdHhNb3Rpb25CbHVyLmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblx0XHRpbWFnZURhdGEgPSBjdHhNb3Rpb25CbHVyLmdldEltYWdlRGF0YSggMCwgMCwgY2FudmFzTW90aW9uQmx1ci53aWR0aCwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogXTtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSArPSBpbWFnZURhdGEuZGF0YVsgaiArIDEgXTtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSArPSBpbWFnZURhdGEuZGF0YVsgaiArIDIgXTtcclxuXHRcdH1cclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50Kys7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3NhdmVGcmFtZSgpe1xyXG5cclxuXHRcdHZhciBkYXRhID0gaW1hZ2VEYXRhLmRhdGE7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0ZGF0YVsgaiBdID0gYnVmZmVyTW90aW9uQmx1clsgaiBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0XHRkYXRhWyBqICsgMSBdID0gYnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdFx0ZGF0YVsgaiArIDIgXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHR9XHJcblx0XHRjdHhNb3Rpb25CbHVyLnB1dEltYWdlRGF0YSggaW1hZ2VEYXRhLCAwLCAwICk7XHJcblx0XHRfZW5jb2Rlci5hZGQoIGNhbnZhc01vdGlvbkJsdXIgKTtcclxuXHRcdF9mcmFtZUNvdW50Kys7XHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA9IDA7XHJcblx0XHRfbG9nKCAnRnVsbCBNQiBGcmFtZSEgJyArIF9mcmFtZUNvdW50ICsgJyAnICsgIF90aW1lICk7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiBdID0gMDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSA9IDA7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gPSAwO1xyXG5cdFx0fVxyXG5cdFx0Z2MoKTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2FwdHVyZSggY2FudmFzICkge1xyXG5cclxuXHRcdGlmKCBfY2FwdHVyaW5nICkge1xyXG5cclxuXHRcdFx0aWYoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID4gMiApIHtcclxuXHJcblx0XHRcdFx0X2NoZWNrRnJhbWUoIGNhbnZhcyApO1xyXG5cdFx0XHRcdF9ibGVuZEZyYW1lKCBjYW52YXMgKTtcclxuXHJcblx0XHRcdFx0aWYoIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID49IC41ICogX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgKSB7XHJcblx0XHRcdFx0XHRfc2F2ZUZyYW1lKCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdF9zdGVwKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRfZW5jb2Rlci5hZGQoIGNhbnZhcyApO1xyXG5cdFx0XHRcdF9mcmFtZUNvdW50Kys7XHJcblx0XHRcdFx0X2xvZyggJ0Z1bGwgRnJhbWUhICcgKyBfZnJhbWVDb3VudCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9wcm9jZXNzKCkge1xyXG5cclxuXHRcdHZhciBzdGVwID0gMTAwMCAvIF9zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0XHR2YXIgZHQgPSAoIF9mcmFtZUNvdW50ICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyApICogc3RlcDtcclxuXHJcblx0XHRfdGltZSA9IF9zdGFydFRpbWUgKyBkdDtcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUgPSBfcGVyZm9ybWFuY2VTdGFydFRpbWUgKyBkdDtcclxuXHJcblx0XHRtZWRpYS5mb3JFYWNoKCBmdW5jdGlvbiggdiApIHtcclxuXHRcdFx0di5faG9va2VkVGltZSA9IGR0IC8gMTAwMDtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRfdXBkYXRlVGltZSgpO1xyXG5cdFx0X2xvZyggJ0ZyYW1lOiAnICsgX2ZyYW1lQ291bnQgKyAnICcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCApO1xyXG5cclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgX3RpbWVvdXRzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRpZiggX3RpbWUgPj0gX3RpbWVvdXRzWyBqIF0udHJpZ2dlclRpbWUgKSB7XHJcblx0XHRcdFx0X2NhbGwoIF90aW1lb3V0c1sgaiBdLmNhbGxiYWNrIClcclxuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCAndGltZW91dCEnICk7XHJcblx0XHRcdFx0X3RpbWVvdXRzLnNwbGljZSggaiwgMSApO1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfaW50ZXJ2YWxzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRpZiggX3RpbWUgPj0gX2ludGVydmFsc1sgaiBdLnRyaWdnZXJUaW1lICkge1xyXG5cdFx0XHRcdF9jYWxsKCBfaW50ZXJ2YWxzWyBqIF0uY2FsbGJhY2sgKTtcclxuXHRcdFx0XHRfaW50ZXJ2YWxzWyBqIF0udHJpZ2dlclRpbWUgKz0gX2ludGVydmFsc1sgaiBdLnRpbWU7XHJcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggJ2ludGVydmFsIScgKTtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MuZm9yRWFjaCggZnVuY3Rpb24oIGNiICkge1xyXG4gICAgIFx0XHRfY2FsbCggY2IsIF90aW1lIC0gZ19zdGFydFRpbWUgKTtcclxuICAgICAgICB9ICk7XHJcbiAgICAgICAgX3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcyA9IFtdO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zYXZlKCBjYWxsYmFjayApIHtcclxuXHJcblx0XHRpZiggIWNhbGxiYWNrICkge1xyXG5cdFx0XHRjYWxsYmFjayA9IGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0XHRcdGRvd25sb2FkKCBibG9iLCBfZW5jb2Rlci5maWxlbmFtZSArIF9lbmNvZGVyLmV4dGVuc2lvbiwgX2VuY29kZXIubWltZVR5cGUgKTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdF9lbmNvZGVyLnNhdmUoIGNhbGxiYWNrICk7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2xvZyggbWVzc2FnZSApIHtcclxuXHRcdGlmKCBfdmVyYm9zZSApIGNvbnNvbGUubG9nKCBtZXNzYWdlICk7XHJcblx0fVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbiggZXZlbnQsIGhhbmRsZXIgKSB7XHJcblxyXG4gICAgICAgIF9oYW5kbGVyc1tldmVudF0gPSBoYW5kbGVyO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZW1pdCggZXZlbnQgKSB7XHJcblxyXG4gICAgICAgIHZhciBoYW5kbGVyID0gX2hhbmRsZXJzW2V2ZW50XTtcclxuICAgICAgICBpZiAoIGhhbmRsZXIgKSB7XHJcblxyXG4gICAgICAgICAgICBoYW5kbGVyLmFwcGx5KCBudWxsLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggYXJndW1lbnRzLCAxICkgKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfcHJvZ3Jlc3MoIHByb2dyZXNzICkge1xyXG5cclxuICAgICAgICBfZW1pdCggJ3Byb2dyZXNzJywgcHJvZ3Jlc3MgKTtcclxuXHJcbiAgICB9XHJcblxyXG5cdHJldHVybiB7XHJcblx0XHRzdGFydDogX3N0YXJ0LFxyXG5cdFx0Y2FwdHVyZTogX2NhcHR1cmUsXHJcblx0XHRzdG9wOiBfc3RvcCxcclxuXHRcdHNhdmU6IF9zYXZlLFxyXG4gICAgICAgIG9uOiBfb25cclxuXHR9XHJcbn1cclxuXHJcbihmcmVlV2luZG93IHx8IGZyZWVTZWxmIHx8IHt9KS5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG5cclxuICAvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzIGxpa2Ugci5qcyBjaGVjayBmb3IgY29uZGl0aW9uIHBhdHRlcm5zIGxpa2UgdGhlIGZvbGxvd2luZzpcclxuICBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcclxuICAgIC8vIERlZmluZSBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlIHNvLCB0aHJvdWdoIHBhdGggbWFwcGluZywgaXQgY2FuIGJlXHJcbiAgICAvLyByZWZlcmVuY2VkIGFzIHRoZSBcInVuZGVyc2NvcmVcIiBtb2R1bGUuXHJcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XHJcbiAgICBcdHJldHVybiBDQ2FwdHVyZTtcclxuICAgIH0pO1xyXG59XHJcbiAgLy8gQ2hlY2sgZm9yIGBleHBvcnRzYCBhZnRlciBgZGVmaW5lYCBpbiBjYXNlIGEgYnVpbGQgb3B0aW1pemVyIGFkZHMgYW4gYGV4cG9ydHNgIG9iamVjdC5cclxuICBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlKSB7XHJcbiAgICAvLyBFeHBvcnQgZm9yIE5vZGUuanMuXHJcbiAgICBpZiAobW9kdWxlRXhwb3J0cykge1xyXG4gICAgXHQoZnJlZU1vZHVsZS5leHBvcnRzID0gQ0NhcHR1cmUpLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbiAgICB9XHJcbiAgICAvLyBFeHBvcnQgZm9yIENvbW1vbkpTIHN1cHBvcnQuXHJcbiAgICBmcmVlRXhwb3J0cy5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG59XHJcbmVsc2Uge1xyXG4gICAgLy8gRXhwb3J0IHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxyXG4gICAgcm9vdC5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG59XHJcblxyXG59KCkpO1xyXG4iLCIvKipcbiAqIEBhdXRob3IgYWx0ZXJlZHEgLyBodHRwOi8vYWx0ZXJlZHF1YWxpYS5jb20vXG4gKiBAYXV0aG9yIG1yLmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbS9cbiAqL1xuXG52YXIgRGV0ZWN0b3IgPSB7XG5cblx0Y2FudmFzOiAhISB3aW5kb3cuQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuXHR3ZWJnbDogKCBmdW5jdGlvbiAoKSB7XG5cblx0XHR0cnkge1xuXG5cdFx0XHR2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTsgcmV0dXJuICEhICggd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCAmJiAoIGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICkgfHwgY2FudmFzLmdldENvbnRleHQoICdleHBlcmltZW50YWwtd2ViZ2wnICkgKSApO1xuXG5cdFx0fSBjYXRjaCAoIGUgKSB7XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblxuXHRcdH1cblxuXHR9ICkoKSxcblx0d29ya2VyczogISEgd2luZG93Lldvcmtlcixcblx0ZmlsZWFwaTogd2luZG93LkZpbGUgJiYgd2luZG93LkZpbGVSZWFkZXIgJiYgd2luZG93LkZpbGVMaXN0ICYmIHdpbmRvdy5CbG9iLFxuXG5cdGdldFdlYkdMRXJyb3JNZXNzYWdlOiBmdW5jdGlvbiAoKSB7XG5cblx0XHR2YXIgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0ZWxlbWVudC5pZCA9ICd3ZWJnbC1lcnJvci1tZXNzYWdlJztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRTaXplID0gJzEzcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9ICdub3JtYWwnO1xuXHRcdGVsZW1lbnQuc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XG5cdFx0ZWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kID0gJyNmZmYnO1xuXHRcdGVsZW1lbnQuc3R5bGUuY29sb3IgPSAnIzAwMCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5wYWRkaW5nID0gJzEuNWVtJztcblx0XHRlbGVtZW50LnN0eWxlLnpJbmRleCA9ICc5OTknO1xuXHRcdGVsZW1lbnQuc3R5bGUud2lkdGggPSAnNDAwcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUubWFyZ2luID0gJzVlbSBhdXRvIDAnO1xuXG5cdFx0aWYgKCAhIHRoaXMud2ViZ2wgKSB7XG5cblx0XHRcdGVsZW1lbnQuaW5uZXJIVE1MID0gd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCA/IFtcblx0XHRcdFx0J1lvdXIgZ3JhcGhpY3MgY2FyZCBkb2VzIG5vdCBzZWVtIHRvIHN1cHBvcnQgPGEgaHJlZj1cImh0dHA6Ly9raHJvbm9zLm9yZy93ZWJnbC93aWtpL0dldHRpbmdfYV9XZWJHTF9JbXBsZW1lbnRhdGlvblwiIHN0eWxlPVwiY29sb3I6IzAwMFwiPldlYkdMPC9hPi48YnIgLz4nLFxuXHRcdFx0XHQnRmluZCBvdXQgaG93IHRvIGdldCBpdCA8YSBocmVmPVwiaHR0cDovL2dldC53ZWJnbC5vcmcvXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+aGVyZTwvYT4uJ1xuXHRcdFx0XS5qb2luKCAnXFxuJyApIDogW1xuXHRcdFx0XHQnWW91ciBicm93c2VyIGRvZXMgbm90IHNlZW0gdG8gc3VwcG9ydCA8YSBocmVmPVwiaHR0cDovL2tocm9ub3Mub3JnL3dlYmdsL3dpa2kvR2V0dGluZ19hX1dlYkdMX0ltcGxlbWVudGF0aW9uXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+V2ViR0w8L2E+Ljxici8+Jyxcblx0XHRcdFx0J0ZpbmQgb3V0IGhvdyB0byBnZXQgaXQgPGEgaHJlZj1cImh0dHA6Ly9nZXQud2ViZ2wub3JnL1wiIHN0eWxlPVwiY29sb3I6IzAwMFwiPmhlcmU8L2E+Lidcblx0XHRcdF0uam9pbiggJ1xcbicgKTtcblxuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50O1xuXG5cdH0sXG5cblx0YWRkR2V0V2ViR0xNZXNzYWdlOiBmdW5jdGlvbiAoIHBhcmFtZXRlcnMgKSB7XG5cblx0XHR2YXIgcGFyZW50LCBpZCwgZWxlbWVudDtcblxuXHRcdHBhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzIHx8IHt9O1xuXG5cdFx0cGFyZW50ID0gcGFyYW1ldGVycy5wYXJlbnQgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMucGFyZW50IDogZG9jdW1lbnQuYm9keTtcblx0XHRpZCA9IHBhcmFtZXRlcnMuaWQgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMuaWQgOiAnb2xkaWUnO1xuXG5cdFx0ZWxlbWVudCA9IERldGVjdG9yLmdldFdlYkdMRXJyb3JNZXNzYWdlKCk7XG5cdFx0ZWxlbWVudC5pZCA9IGlkO1xuXG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKCBlbGVtZW50ICk7XG5cblx0fVxuXG59O1xuXG4vL0VTNiBleHBvcnRcblxuZXhwb3J0IHsgRGV0ZWN0b3IgfTtcbiIsIi8vVGhpcyBsaWJyYXJ5IGlzIGRlc2lnbmVkIHRvIGhlbHAgc3RhcnQgdGhyZWUuanMgZWFzaWx5LCBjcmVhdGluZyB0aGUgcmVuZGVyIGxvb3AgYW5kIGNhbnZhcyBhdXRvbWFnaWNhbGx5LlxuLy9SZWFsbHkgaXQgc2hvdWxkIGJlIHNwdW4gb2ZmIGludG8gaXRzIG93biB0aGluZyBpbnN0ZWFkIG9mIGJlaW5nIHBhcnQgb2YgZXhwbGFuYXJpYS5cblxuLy9hbHNvLCBjaGFuZ2UgVGhyZWVhc3lfRW52aXJvbm1lbnQgdG8gVGhyZWVhc3lfUmVjb3JkZXIgdG8gZG93bmxvYWQgaGlnaC1xdWFsaXR5IGZyYW1lcyBvZiBhbiBhbmltYXRpb25cblxuaW1wb3J0IENDYXB0dXJlIGZyb20gJ2NjYXB0dXJlLmpzJztcbmltcG9ydCB7IERldGVjdG9yIH0gZnJvbSAnLi4vbGliL1dlYkdMX0RldGVjdG9yLmpzJztcbmltcG9ydCB7IHNldFRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5mdW5jdGlvbiBUaHJlZWFzeUVudmlyb25tZW50KGNhbnZhc0NvbnRhaW5lciA9IG51bGwpe1xuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSAwO1xuICAgIHRoaXMuc2hvdWxkQ3JlYXRlQ29udGFpbmVyID0gKGNhbnZhc0NvbnRhaW5lciA9PT0gbnVsbCk7XG5cblx0aWYoIURldGVjdG9yLndlYmdsKURldGVjdG9yLmFkZEdldFdlYkdMTWVzc2FnZSgpO1xuXG5cdHRoaXMuY2FtZXJhID0gbmV3IFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYSh7XG5cdFx0bmVhcjogLjEsXG5cdFx0ZmFyOiAxMDAwMCxcblxuXHRcdC8vdHlwZTogJ3BlcnNwZWN0aXZlJyxcblx0XHRmb3Y6IDYwLFxuXHRcdGFzcGVjdDogMSxcbi8qXG5cdFx0Ly8gdHlwZTogJ29ydGhvZ3JhcGhpYycsXG5cdFx0bGVmdDogLTEsXG5cdFx0cmlnaHQ6IDEsXG5cdFx0Ym90dG9tOiAtMSxcblx0XHR0b3A6IDEsKi9cblx0ICB9KTtcblxuXHR0aGlzLmNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYSggNzAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDEwMDAwMDAwICk7XG5cdC8vdGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuT3J0aG9ncmFwaGljQ2FtZXJhKCA3MCwgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDAuMSwgMTAgKTtcblxuXHR0aGlzLmNhbWVyYS5wb3NpdGlvbi5zZXQoMCwgMCwgMTApO1xuXHR0aGlzLmNhbWVyYS5sb29rQXQobmV3IFRIUkVFLlZlY3RvcjMoMCwwLDApKTtcblxuXG5cdC8vY3JlYXRlIGNhbWVyYSwgc2NlbmUsIHRpbWVyLCByZW5kZXJlciBvYmplY3RzXG5cdC8vY3JhZXRlIHJlbmRlciBvYmplY3RcblxuXG5cdFxuXHR0aGlzLnNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5cdHRoaXMuc2NlbmUuYWRkKHRoaXMuY2FtZXJhKTtcblxuXHQvL3JlbmRlcmVyXG5cdGxldCByZW5kZXJlck9wdGlvbnMgPSB7IGFudGlhbGlhczogdHJ1ZX07XG5cblx0dGhpcy5yZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKCByZW5kZXJlck9wdGlvbnMgKTtcblx0dGhpcy5yZW5kZXJlci5zZXRQaXhlbFJhdGlvKCB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldENsZWFyQ29sb3IobmV3IFRIUkVFLkNvbG9yKDB4RkZGRkZGKSwgMS4wKTtcblxuXG4gICAgdGhpcy5vbldpbmRvd1Jlc2l6ZSgpOyAvL3Jlc2l6ZSBjYW52YXMgdG8gd2luZG93IHNpemUgYW5kIHNldCBhc3BlY3QgcmF0aW9cblx0Lypcblx0dGhpcy5yZW5kZXJlci5nYW1tYUlucHV0ID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci5nYW1tYU91dHB1dCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIuc2hhZG93TWFwLmVuYWJsZWQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlO1xuXHQqL1xuXG5cdHRoaXMudGltZVNjYWxlID0gMTtcblx0dGhpcy5lbGFwc2VkVGltZSA9IDA7XG5cblx0dGhpcy5jb250YWluZXIgPSB0aGlzLnNob3VsZENyZWF0ZUNvbnRhaW5lciA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICkgOiBjYW52YXNDb250YWluZXI7XG5cdHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKCB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQgKTtcblxuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIHRoaXMub25Nb3VzZURvd24uYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZXVwJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaHN0YXJ0JywgdGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoZW5kJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIHRoaXMub25XaW5kb3dSZXNpemUuYmluZCh0aGlzKSwgZmFsc2UgKTtcblxuXHQvKlxuXHQvL3JlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlOyBcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd2cmRpc3BsYXlwb2ludGVycmVzdHJpY3RlZCcsIG9uUG9pbnRlclJlc3RyaWN0ZWQsIGZhbHNlICk7XG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cG9pbnRlcnVucmVzdHJpY3RlZCcsIG9uUG9pbnRlclVucmVzdHJpY3RlZCwgZmFsc2UgKTtcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggV0VCVlIuY3JlYXRlQnV0dG9uKCByZW5kZXJlciApICk7XG5cdCovXG5cblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCB0aGlzLm9uUGFnZUxvYWQuYmluZCh0aGlzKSwgZmFsc2UpO1xuXG5cdHRoaXMuY2xvY2sgPSBuZXcgVEhSRUUuQ2xvY2soKTtcblxuXHR0aGlzLklTX1JFQ09SRElORyA9IGZhbHNlOyAvLyBxdWVyeWFibGUgaWYgb25lIHdhbnRzIHRvIGRvIHRoaW5ncyBsaWtlIGJlZWYgdXAgcGFydGljbGUgY291bnRzIGZvciByZW5kZXJcblxuICAgIGlmKCF0aGlzLnNob3VsZENyZWF0ZUNvbnRhaW5lciAmJiBjYW52YXNDb250YWluZXIub2Zmc2V0V2lkdGgpe1xuICAgICAgICAvL0lmIHRoZSBjYW52YXNFbGVtZW50IGlzIGFscmVhZHkgbG9hZGVkLCB0aGVuIHRoZSAnbG9hZCcgZXZlbnQgaGFzIGFscmVhZHkgZmlyZWQuIFdlIG5lZWQgdG8gdHJpZ2dlciBpdCBvdXJzZWx2ZXMuXG4gICAgICAgIHRoaXMub25QYWdlTG9hZCgpO1xuICAgIH1cbn1cblxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25QYWdlTG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRjb25zb2xlLmxvZyhcIlRocmVlYXN5X1NldHVwIGxvYWRlZCFcIik7XG5cdGlmKHRoaXMuc2hvdWxkQ3JlYXRlQ29udGFpbmVyKXtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCB0aGlzLmNvbnRhaW5lciApO1xuXHR9XG5cblx0dGhpcy5zdGFydCgpO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe1xuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSBwZXJmb3JtYW5jZS5ub3coKTtcblx0dGhpcy5jbG9jay5zdGFydCgpO1xuXHR0aGlzLnJlbmRlcih0aGlzLnByZXZfdGltZXN0ZXApO1xufVxuXG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbk1vdXNlRG93biA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmlzTW91c2VEb3duID0gdHJ1ZTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uTW91c2VVcD0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuaXNNb3VzZURvd24gPSBmYWxzZTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUG9pbnRlclJlc3RyaWN0ZWQ9IGZ1bmN0aW9uKCkge1xuXHR2YXIgcG9pbnRlckxvY2tFbGVtZW50ID0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50O1xuXHRpZiAoIHBvaW50ZXJMb2NrRWxlbWVudCAmJiB0eXBlb2YocG9pbnRlckxvY2tFbGVtZW50LnJlcXVlc3RQb2ludGVyTG9jaykgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0cG9pbnRlckxvY2tFbGVtZW50LnJlcXVlc3RQb2ludGVyTG9jaygpO1xuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vblBvaW50ZXJVbnJlc3RyaWN0ZWQ9IGZ1bmN0aW9uKCkge1xuXHR2YXIgY3VycmVudFBvaW50ZXJMb2NrRWxlbWVudCA9IGRvY3VtZW50LnBvaW50ZXJMb2NrRWxlbWVudDtcblx0dmFyIGV4cGVjdGVkUG9pbnRlckxvY2tFbGVtZW50ID0gdGhpcy5yZW5kZXJlci5kb21FbGVtZW50O1xuXHRpZiAoIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgJiYgY3VycmVudFBvaW50ZXJMb2NrRWxlbWVudCA9PT0gZXhwZWN0ZWRQb2ludGVyTG9ja0VsZW1lbnQgJiYgdHlwZW9mKGRvY3VtZW50LmV4aXRQb2ludGVyTG9jaykgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0ZG9jdW1lbnQuZXhpdFBvaW50ZXJMb2NrKCk7XG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLmV2ZW5pZnkgPSBmdW5jdGlvbih4KXtcblx0aWYoeCAlIDIgPT0gMSl7XG5cdFx0cmV0dXJuIHgrMVxuXHR9O1xuXHRyZXR1cm4geDtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uV2luZG93UmVzaXplPSBmdW5jdGlvbigpIHtcbiAgICBsZXQgd2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICBsZXQgaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xuXG5cdHRoaXMuY2FtZXJhLmFzcGVjdCA9IHdpZHRoIC8gaGVpZ2h0O1xuXHR0aGlzLmFzcGVjdCA9IHRoaXMuY2FtZXJhLmFzcGVjdDtcblx0dGhpcy5jYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuXHR0aGlzLnJlbmRlcmVyLnNldFNpemUoIHRoaXMuZXZlbmlmeSh3aWR0aCksdGhpcy5ldmVuaWZ5KGhlaWdodCkgKTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLmxpc3RlbmVycyA9IHtcInVwZGF0ZVwiOiBbXSxcInJlbmRlclwiOltdfTsgLy91cGRhdGUgZXZlbnQgbGlzdGVuZXJzXG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbih0aW1lc3RlcCl7XG5cdHZhciBkZWx0YSA9IHRoaXMuY2xvY2suZ2V0RGVsdGEoKSp0aGlzLnRpbWVTY2FsZTtcblx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcblx0Ly9nZXQgdGltZXN0ZXBcblx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5sZW5ndGg7aSsrKXtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXVtpXSh7XCJ0XCI6dGhpcy5lbGFwc2VkVGltZSxcImRlbHRhXCI6ZGVsdGF9KTtcblx0fVxuXG5cdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSApO1xuXG5cdGZvcih2YXIgaT0wO2k8dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0ubGVuZ3RoO2krKyl7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl1baV0oKTtcblx0fVxuXG5cdHRoaXMucHJldl90aW1lc3RlcCA9IHRpbWVzdGVwO1xuXHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub24gPSBmdW5jdGlvbihldmVudF9uYW1lLCBmdW5jKXtcblx0Ly9SZWdpc3RlcnMgYW4gZXZlbnQgbGlzdGVuZXIuXG5cdC8vZWFjaCBsaXN0ZW5lciB3aWxsIGJlIGNhbGxlZCB3aXRoIGFuIG9iamVjdCBjb25zaXN0aW5nIG9mOlxuXHQvL1x0e3Q6IDxjdXJyZW50IHRpbWUgaW4gcz4sIFwiZGVsdGFcIjogPGRlbHRhLCBpbiBtcz59XG5cdC8vIGFuIHVwZGF0ZSBldmVudCBmaXJlcyBiZWZvcmUgYSByZW5kZXIuIGEgcmVuZGVyIGV2ZW50IGZpcmVzIHBvc3QtcmVuZGVyLlxuXHRpZihldmVudF9uYW1lID09IFwidXBkYXRlXCIpeyBcblx0XHR0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5wdXNoKGZ1bmMpO1xuXHR9ZWxzZSBpZihldmVudF9uYW1lID09IFwicmVuZGVyXCIpeyBcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5wdXNoKGZ1bmMpO1xuXHR9ZWxzZXtcblx0XHRjb25zb2xlLmVycm9yKFwiSW52YWxpZCBldmVudCBuYW1lIVwiKVxuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnRfbmFtZSwgZnVuYyl7XG5cdC8vVW5yZWdpc3RlcnMgYW4gZXZlbnQgbGlzdGVuZXIsIHVuZG9pbmcgYW4gVGhyZWVhc3lfc2V0dXAub24oKSBldmVudCBsaXN0ZW5lci5cblx0Ly90aGUgbmFtaW5nIHNjaGVtZSBtaWdodCBub3QgYmUgdGhlIGJlc3QgaGVyZS5cblx0aWYoZXZlbnRfbmFtZSA9PSBcInVwZGF0ZVwiKXsgXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0uaW5kZXhPZihmdW5jKTtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5zcGxpY2UoaW5kZXgsMSk7XG5cdH0gZWxzZSBpZihldmVudF9uYW1lID09IFwicmVuZGVyXCIpeyBcblx0XHRsZXQgaW5kZXggPSB0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5pbmRleE9mKGZ1bmMpO1xuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLnNwbGljZShpbmRleCwxKTtcblx0fWVsc2V7XG5cdFx0Y29uc29sZS5lcnJvcihcIk5vbmV4aXN0ZW50IGV2ZW50IG5hbWUhXCIpXG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9mZiA9IFRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXI7IC8vYWxpYXMgdG8gbWF0Y2ggVGhyZWVhc3lFbnZpcm9ubWVudC5vblxuXG5jbGFzcyBUaHJlZWFzeVJlY29yZGVyIGV4dGVuZHMgVGhyZWVhc3lFbnZpcm9ubWVudHtcblx0Ly9iYXNlZCBvbiBodHRwOi8vd3d3LnR5c29uY2FkZW5oZWFkLmNvbS9ibG9nL2V4cG9ydGluZy1jYW52YXMtYW5pbWF0aW9uLXRvLW1vdi8gdG8gcmVjb3JkIGFuIGFuaW1hdGlvblxuXHQvL3doZW4gZG9uZSwgICAgIGZmbXBlZyAtciA2MCAtZnJhbWVyYXRlIDYwIC1pIC4vJTA3ZC5wbmcgLXZjb2RlYyBsaWJ4MjY0IC1waXhfZm10IHl1djQyMHAgLWNyZjp2IDAgdmlkZW8ubXA0XG4gICAgLy8gdG8gcGVyZm9ybSBtb3Rpb24gYmx1ciBvbiBhbiBvdmVyc2FtcGxlZCB2aWRlbywgZmZtcGVnIC1pIHZpZGVvLm1wNCAtdmYgdGJsZW5kPWFsbF9tb2RlPWF2ZXJhZ2UsZnJhbWVzdGVwPTIgdmlkZW8yLm1wNFxuXHQvL3RoZW4sIGFkZCB0aGUgeXV2NDIwcCBwaXhlbHMgKHdoaWNoIGZvciBzb21lIHJlYXNvbiBpc24ndCBkb25lIGJ5IHRoZSBwcmV2IGNvbW1hbmQpIGJ5OlxuXHQvLyBmZm1wZWcgLWkgdmlkZW8ubXA0IC12Y29kZWMgbGlieDI2NCAtcGl4X2ZtdCB5dXY0MjBwIC1zdHJpY3QgLTIgLWFjb2RlYyBhYWMgZmluaXNoZWRfdmlkZW8ubXA0XG5cdC8vY2hlY2sgd2l0aCBmZm1wZWcgLWkgZmluaXNoZWRfdmlkZW8ubXA0XG5cblx0Y29uc3RydWN0b3IoZnBzPTMwLCBsZW5ndGggPSA1LCBjYW52YXNDb250YWluZXIgPSBudWxsKXtcblx0XHQvKiBmcHMgaXMgZXZpZGVudCwgYXV0b3N0YXJ0IGlzIGEgYm9vbGVhbiAoYnkgZGVmYXVsdCwgdHJ1ZSksIGFuZCBsZW5ndGggaXMgaW4gcy4qL1xuXHRcdHN1cGVyKGNhbnZhc0NvbnRhaW5lcik7XG5cdFx0dGhpcy5mcHMgPSBmcHM7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSA9IDA7XG5cdFx0dGhpcy5mcmFtZUNvdW50ID0gZnBzICogbGVuZ3RoO1xuXHRcdHRoaXMuZnJhbWVzX3JlbmRlcmVkID0gMDtcblxuXHRcdHRoaXMuY2FwdHVyZXIgPSBuZXcgQ0NhcHR1cmUoIHtcblx0XHRcdGZyYW1lcmF0ZTogZnBzLFxuXHRcdFx0Zm9ybWF0OiAncG5nJyxcblx0XHRcdG5hbWU6IGRvY3VtZW50LnRpdGxlLFxuXHRcdFx0Ly92ZXJib3NlOiB0cnVlLFxuXHRcdH0gKTtcblxuXHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cblx0XHR0aGlzLklTX1JFQ09SRElORyA9IHRydWU7XG5cdH1cblx0c3RhcnQoKXtcblx0XHQvL21ha2UgYSByZWNvcmRpbmcgc2lnblxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUud2lkdGg9XCIyMHB4XCJcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmhlaWdodD1cIjIwcHhcIlxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUudG9wID0gJzIwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUubGVmdCA9ICcyMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdyZWQnO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yZWNvcmRpbmdfaWNvbik7XG5cblx0XHR0aGlzLmZyYW1lQ291bnRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLnRvcCA9ICcyMHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5sZWZ0ID0gJzUwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmNvbG9yID0gJ2JsYWNrJztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnMTBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMjU1LDI1NSwyNTUsMC4xKSc7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLmZyYW1lQ291bnRlcik7XG5cblx0XHR0aGlzLmNhcHR1cmVyLnN0YXJ0KCk7XG5cdFx0dGhpcy5yZW5kZXJpbmcgPSB0cnVlO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblx0cmVuZGVyKHRpbWVzdGVwKXtcblx0XHR2YXIgZGVsdGEgPSAxL3RoaXMuZnBzKnRoaXMudGltZVNjYWxlOyAvL2lnbm9yaW5nIHRoZSB0cnVlIHRpbWUsIGNhbGN1bGF0ZSB0aGUgZGVsdGFcblxuXHRcdC8vZ2V0IHRpbWVzdGVwXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YX0pO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSApO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdW2ldKCk7XG5cdFx0fVxuXG5cblx0XHR0aGlzLnJlY29yZF9mcmFtZSgpO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xuXHR9XG5cdHJlY29yZF9mcmFtZSgpe1xuXHQvL1x0bGV0IGN1cnJlbnRfZnJhbWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYW52YXMnKS50b0RhdGFVUkwoKTtcblxuXHRcdHRoaXMuY2FwdHVyZXIuY2FwdHVyZSggZG9jdW1lbnQucXVlcnlTZWxlY3RvcignY2FudmFzJykgKTtcblxuXHRcdHRoaXMuZnJhbWVDb3VudGVyLmlubmVySFRNTCA9IHRoaXMuZnJhbWVzX3JlbmRlcmVkICsgXCIgLyBcIiArIHRoaXMuZnJhbWVDb3VudDsgLy91cGRhdGUgdGltZXJcblxuXHRcdHRoaXMuZnJhbWVzX3JlbmRlcmVkKys7XG5cblxuXHRcdGlmKHRoaXMuZnJhbWVzX3JlbmRlcmVkPnRoaXMuZnJhbWVDb3VudCl7XG5cdFx0XHR0aGlzLnJlbmRlciA9IG51bGw7IC8vaGFja3kgd2F5IG9mIHN0b3BwaW5nIHRoZSByZW5kZXJpbmdcblx0XHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0Ly90aGlzLmZyYW1lQ291bnRlci5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cblx0XHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cdFx0XHR0aGlzLmNhcHR1cmVyLnN0b3AoKTtcblx0XHRcdC8vIGRlZmF1bHQgc2F2ZSwgd2lsbCBkb3dubG9hZCBhdXRvbWF0aWNhbGx5IGEgZmlsZSBjYWxsZWQge25hbWV9LmV4dGVuc2lvbiAod2VibS9naWYvdGFyKVxuXHRcdFx0dGhpcy5jYXB0dXJlci5zYXZlKCk7XG5cdFx0fVxuXHR9XG5cdG9uV2luZG93UmVzaXplKCkge1xuXHRcdC8vc3RvcCByZWNvcmRpbmcgaWYgd2luZG93IHNpemUgY2hhbmdlc1xuXHRcdGlmKHRoaXMucmVuZGVyaW5nICYmIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0ICE9IHRoaXMuYXNwZWN0KXtcblx0XHRcdHRoaXMuY2FwdHVyZXIuc3RvcCgpO1xuXHRcdFx0dGhpcy5yZW5kZXIgPSBudWxsOyAvL2hhY2t5IHdheSBvZiBzdG9wcGluZyB0aGUgcmVuZGVyaW5nXG5cdFx0XHRhbGVydChcIkFib3J0aW5nIHJlY29yZDogV2luZG93LXNpemUgY2hhbmdlIGRldGVjdGVkIVwiKTtcblx0XHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN1cGVyLm9uV2luZG93UmVzaXplKCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gc2V0dXBUaHJlZShmcHM9MzAsIGxlbmd0aCA9IDUsIGNhbnZhc0NvbnRhaW5lciA9IG51bGwpe1xuXHQvKiBTZXQgdXAgdGhlIHRocmVlLmpzIGVudmlyb25tZW50LiBTd2l0Y2ggYmV0d2VlbiBjbGFzc2VzIGR5bmFtaWNhbGx5IHNvIHRoYXQgeW91IGNhbiByZWNvcmQgYnkgYXBwZW5kaW5nIFwiP3JlY29yZD10cnVlXCIgdG8gYW4gdXJsLiBUaGVuIEVYUC50aHJlZUVudmlyb25tZW50LmNhbWVyYSBhbmQgRVhQLnRocmVlRW52aXJvbm1lbnQuc2NlbmUgd29yaywgYXMgd2VsbCBhcyBFWFAudGhyZWVFbnZpcm9ubWVudC5vbignZXZlbnQgbmFtZScsIGNhbGxiYWNrKS4gT25seSBvbmUgZW52aXJvbm1lbnQgZXhpc3RzIGF0IGEgdGltZS5cblxuICAgIFRoZSByZXR1cm5lZCBvYmplY3QgaXMgYSBzaW5nbGV0b246IG11bHRpcGxlIGNhbGxzIHdpbGwgcmV0dXJuIHRoZSBzYW1lIG9iamVjdDogRVhQLnRocmVlRW52aXJvbm1lbnQuKi9cblx0dmFyIHJlY29yZGVyID0gbnVsbDtcblx0dmFyIGlzX3JlY29yZGluZyA9IGZhbHNlO1xuXG5cdC8vZXh0cmFjdCByZWNvcmQgcGFyYW1ldGVyIGZyb20gdXJsXG5cdHZhciBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKGRvY3VtZW50LmxvY2F0aW9uLnNlYXJjaCk7XG5cdGxldCByZWNvcmRTdHJpbmcgPSBwYXJhbXMuZ2V0KFwicmVjb3JkXCIpO1xuXG5cdGlmKHJlY29yZFN0cmluZyl7IC8vZGV0ZWN0IGlmIFVSTCBwYXJhbXMgaW5jbHVkZSA/cmVjb3JkPTEgb3IgP3JlY29yZD10cnVlXG4gICAgICAgIHJlY29yZFN0cmluZyA9IHJlY29yZFN0cmluZy50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpc19yZWNvcmRpbmcgPSAocmVjb3JkU3RyaW5nID09IFwidHJ1ZVwiIHx8IHJlY29yZFN0cmluZyA9PSBcIjFcIik7XG4gICAgfVxuXG4gICAgaWYoRVhQLnRocmVlRW52aXJvbm1lbnQgIT09IG51bGwpey8vc2luZ2xldG9uIGhhcyBhbHJlYWR5IGJlZW4gY3JlYXRlZFxuICAgICAgICByZXR1cm4gRVhQLnRocmVlRW52aXJvbm1lbnQ7XG4gICAgfVxuXG4gICAgbGV0IHRocmVlRW52aXJvbm1lbnQgPSBudWxsO1xuXHRpZihpc19yZWNvcmRpbmcpe1xuXHRcdHRocmVlRW52aXJvbm1lbnQgPSBuZXcgVGhyZWVhc3lSZWNvcmRlcihmcHMsIGxlbmd0aCwgY2FudmFzQ29udGFpbmVyKTtcblx0fWVsc2V7XG5cdFx0dGhyZWVFbnZpcm9ubWVudCA9IG5ldyBUaHJlZWFzeUVudmlyb25tZW50KGNhbnZhc0NvbnRhaW5lcik7XG5cdH1cbiAgICBzZXRUaHJlZUVudmlyb25tZW50KHRocmVlRW52aXJvbm1lbnQpO1xuICAgIHJldHVybiB0aHJlZUVudmlyb25tZW50O1xufVxuXG5leHBvcnQge3NldHVwVGhyZWUsIFRocmVlYXN5RW52aXJvbm1lbnQsIFRocmVlYXN5UmVjb3JkZXJ9XG4iLCJhc3luYyBmdW5jdGlvbiBkZWxheSh3YWl0VGltZSl7XG5cdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIHdhaXRUaW1lKTtcblx0fSk7XG5cbn1cblxuZXhwb3J0IHtkZWxheX07XG4iLCJpbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuaW1wb3J0IHsgdGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4uL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5jbGFzcyBMaW5lT3V0cHV0IGV4dGVuZHMgT3V0cHV0Tm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcblx0XHRzdXBlcigpO1xuXHRcdC8qIHNob3VsZCBiZSAuYWRkKCllZCB0byBhIFRyYW5zZm9ybWF0aW9uIHRvIHdvcmtcblx0XHRcdG9wdGlvbnM6XG5cdFx0XHR7XG5cdFx0XHRcdHdpZHRoOiBudW1iZXJcblx0XHRcdFx0b3BhY2l0eTogbnVtYmVyXG5cdFx0XHRcdGNvbG9yOiBoZXggY29kZSBvciBUSFJFRS5Db2xvcigpXG5cdFx0XHR9XG5cdFx0Ki9cblxuXHRcdHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDU7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcblx0XHR0aGlzLl9jb2xvciA9IG9wdGlvbnMuY29sb3IgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuY29sb3IgOiAweDU1YWE1NTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbXTsgLy8gaG93IG1hbnkgdGltZXMgdG8gYmUgY2FsbGVkIGluIGVhY2ggZGlyZWN0aW9uXG5cdFx0dGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDM7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/XG5cblx0XHR0aGlzLmluaXQoKTtcblx0fVxuXHRpbml0KCl7XG5cdFx0dGhpcy5fZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcblx0XHR0aGlzLl92ZXJ0aWNlcztcblx0XHR0aGlzLm1ha2VHZW9tZXRyeSgpO1xuXG5cdFx0dGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7Y29sb3I6IHRoaXMuX2NvbG9yLCBsaW5ld2lkdGg6IHRoaXMuX3dpZHRoLG9wYWNpdHk6dGhpcy5fb3BhY2l0eX0pO1xuXHRcdHRoaXMubWVzaCA9IG5ldyBUSFJFRS5MaW5lU2VnbWVudHModGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cblx0XHR0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvLyBzZXR0ZXIgc2V0cyB0cmFuc3BhcmVudCBmbGFnIGlmIG5lY2Vzc2FyeVxuXG5cdFx0dGhyZWVFbnZpcm9ubWVudC5zY2VuZS5hZGQodGhpcy5tZXNoKTtcblx0fVxuXHRtYWtlR2VvbWV0cnkoKXtcblx0XHQvLyBmb2xsb3cgaHR0cDovL2Jsb2cuY2pnYW1tb24uY29tL3RocmVlanMtZ2VvbWV0cnlcblx0XHQvLyBvciBtYXRoYm94J3MgbGluZUdlb21ldHJ5XG5cblx0XHQvKlxuXHRcdFRoaXMgY29kZSBzZWVtcyB0byBiZSBuZWNlc3NhcnkgdG8gcmVuZGVyIGxpbmVzIGFzIGEgdHJpYW5nbGUgc3RycC5cblx0XHRJIGNhbid0IHNlZW0gdG8gZ2V0IGl0IHRvIHdvcmsgcHJvcGVybHkuXG5cblx0XHRsZXQgbnVtVmVydGljZXMgPSAzO1xuXHRcdHZhciBpbmRpY2VzID0gW107XG5cblx0XHQvL2luZGljZXNcblx0XHRsZXQgYmFzZSA9IDA7XG5cdFx0Zm9yKHZhciBrPTA7azxudW1WZXJ0aWNlcy0xO2srPTEpe1xuICAgICAgICBcdGluZGljZXMucHVzaCggYmFzZSwgYmFzZSsxLCBiYXNlKzIpO1xuXHRcdFx0aW5kaWNlcy5wdXNoKCBiYXNlKzIsIGJhc2UrMSwgYmFzZSszKTtcblx0XHRcdGJhc2UgKz0gMjtcblx0XHR9XG5cdFx0dGhpcy5fZ2VvbWV0cnkuc2V0SW5kZXgoIGluZGljZXMgKTsqL1xuXG5cdFx0bGV0IE1BWF9QT0lOVFMgPSAxMDAwMDtcblxuXHRcdHRoaXMuX3ZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheShNQVhfUE9JTlRTICogMiAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMpO1xuXG5cdFx0Ly8gYnVpbGQgZ2VvbWV0cnlcblxuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcblx0XHQvL3RoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ25vcm1hbCcsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCBub3JtYWxzLCAzICkgKTtcblx0XHQvL3RoaXMuZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAndXYnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdXZzLCAyICkgKTtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy91c2VkIGR1cmluZyB1cGRhdGVzIGFzIGEgcG9pbnRlciB0byB0aGUgYnVmZmVyXG5cblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cblx0fVxuXHRfb25BZGQoKXtcblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgRG9tYWluIG5vZGUgd2UncmUgcmVuZGVyaW5nIGZyb21cbiAgICAgICAgbGV0IHJvb3QgPSB0aGlzLmdldENsb3Nlc3REb21haW4oKTtcblx0XG5cdFx0Ly90b2RvOiBpbXBsZW1lbnQgc29tZXRoaW5nIGxpa2UgYXNzZXJ0IHJvb3QgdHlwZW9mIFJvb3ROb2RlXG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSByb290Lml0ZW1EaW1lbnNpb25zO1xuXHR9XG5cdF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuXHRcdHRoaXMuX29uQWRkKCk7IC8vc2V0dXAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gYW5kIHRoaXMuaXRlbURpbWVuc2lvbnMuIHVzZWQgaGVyZSBhZ2FpbiBiZWNhdXNlIGNsb25pbmcgbWVhbnMgdGhlIG9uQWRkKCkgbWlnaHQgYmUgY2FsbGVkIGJlZm9yZSB0aGlzIGlzIGNvbm5lY3RlZCB0byBhIHR5cGUgb2YgZG9tYWluXG5cblx0XHQvLyBwZXJoYXBzIGluc3RlYWQgb2YgZ2VuZXJhdGluZyBhIHdob2xlIG5ldyBhcnJheSwgdGhpcyBjYW4gcmV1c2UgdGhlIG9sZCBvbmU/XG5cdFx0bGV0IHZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKiAyKTtcblxuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0dGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl92ZXJ0aWNlcyk7XG5cblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope1xuXHRcdGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcblx0XHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTtcdFxuXHRcdH1cblxuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblxuXHRcdC8vYXNzZXJ0IGkgPCB2ZXJ0aWNlcy5jb3VudFxuXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5fY3VycmVudFBvaW50SW5kZXgqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcblxuXHRcdGlmKHggIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleF0gPSB4O1xuXHRcdGlmKHkgIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCsxXSA9IHk7XG5cdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4KzJdID0gejtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4Kys7XG5cblx0XHQvKiB3ZSdyZSBkcmF3aW5nIGxpa2UgdGhpczpcblx0XHQqLS0tLSotLS0tKlxuXG4gICAgICAgICotLS0tKi0tLS0qXG5cdFxuXHRcdGJ1dCB3ZSBkb24ndCB3YW50IHRvIGluc2VydCBhIGRpYWdvbmFsIGxpbmUgYW55d2hlcmUuIFRoaXMgaGFuZGxlcyB0aGF0OiAgKi9cblxuXHRcdGxldCBmaXJzdENvb3JkaW5hdGUgPSBpICUgdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXTtcblxuXHRcdGlmKCEoZmlyc3RDb29yZGluYXRlID09IDAgfHwgZmlyc3RDb29yZGluYXRlID09IHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0tMSkpe1xuXHRcdFx0aWYoeCAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnNdID0geDtcblx0XHRcdGlmKHkgIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zKzFdID0geTtcblx0XHRcdGlmKHogIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zKzJdID0gejtcblx0XHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4Kys7XG5cdFx0fVxuXG5cdFx0Ly92ZXJ0aWNlcyBzaG91bGQgcmVhbGx5IGJlIGFuIHVuaWZvcm0sIHRob3VnaC5cblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy9yZXNldCBhZnRlciBlYWNoIHVwZGF0ZVxuXHR9XG5cdHNldCBjb2xvcihjb2xvcil7XG5cdFx0Ly9jdXJyZW50bHkgb25seSBhIHNpbmdsZSBjb2xvciBpcyBzdXBwb3J0ZWQuXG5cdFx0Ly9JIHNob3VsZCByZWFsbHkgbWFrZSBpdCBwb3NzaWJsZSB0byBzcGVjaWZ5IGNvbG9yIGJ5IGEgZnVuY3Rpb24uXG5cdFx0dGhpcy5tYXRlcmlhbC5jb2xvciA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG5cdFx0dGhpcy5fY29sb3IgPSBjb2xvcjtcblx0fVxuXHRnZXQgY29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3I7XG5cdH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0dGhpcy5tYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcblx0XHR0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG5cdFx0dGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRzZXQgd2lkdGgod2lkdGgpe1xuXHRcdHRoaXMuX3dpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5tYXRlcmlhbC5saW5ld2lkdGggPSB3aWR0aDtcblx0fVxuXHRnZXQgd2lkdGgoKXtcblx0XHRyZXR1cm4gdGhpcy5fd2lkdGg7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IExpbmVPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuZXhwb3J0IHtMaW5lT3V0cHV0fTtcbiIsImltcG9ydCB7IHRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUG9pbnR7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdC8qb3B0aW9uczogY29sb3I6IDxUSFJFRS5Db2xvciBvciBoZXggY29kZVxuXHRcdFx0eCx5OiBudW1iZXJzXG5cdFx0XHR3aWR0aDogbnVtYmVyXG5cdFx0Ki9cblxuXHRcdGxldCB3aWR0aCA9IG9wdGlvbnMud2lkdGggPT09IHVuZGVmaW5lZCA/IDEgOiBvcHRpb25zLndpZHRoXG5cdFx0bGV0IGNvbG9yID0gb3B0aW9ucy5jb2xvciA9PT0gdW5kZWZpbmVkID8gMHg3Nzc3NzcgOiBvcHRpb25zLmNvbG9yO1xuXG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5zaGFyZWRDaXJjbGVHZW9tZXRyeSx0aGlzLmdldEZyb21NYXRlcmlhbENhY2hlKGNvbG9yKSk7XG5cblx0XHR0aGlzLm9wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgPT09IHVuZGVmaW5lZCA/IDEgOiBvcHRpb25zLm9wYWNpdHk7IC8vdHJpZ2dlciBzZXR0ZXJcblxuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi5zZXQodGhpcy54LHRoaXMueSx0aGlzLnopO1xuXHRcdHRoaXMubWVzaC5zY2FsZS5zZXRTY2FsYXIodGhpcy53aWR0aC8yKTtcblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXG5cdFx0dGhpcy54ID0gb3B0aW9ucy54IHx8IDA7XG5cdFx0dGhpcy55ID0gb3B0aW9ucy55IHx8IDA7XG5cdFx0dGhpcy56ID0gb3B0aW9ucy56IHx8IDA7XG5cdH1cblx0c2V0IHgoaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnggPSBpO1xuXHR9XG5cdHNldCB5KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi55ID0gaTtcblx0fVxuXHRzZXQgeihpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueiA9IGk7XG5cdH1cblx0Z2V0IHgoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLng7XG5cdH1cblx0Z2V0IHkoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLnk7XG5cdH1cblx0Z2V0IHooKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLno7XG5cdH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0bGV0IG1hdCA9IHRoaXMubWVzaC5tYXRlcmlhbDtcblx0XHRtYXQub3BhY2l0eSA9IG9wYWNpdHk7XG5cdFx0bWF0LnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG4gICAgICAgIG1hdC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRnZXRGcm9tTWF0ZXJpYWxDYWNoZShjb2xvcil7XG5cdFx0aWYodGhpcy5fbWF0ZXJpYWxzW2NvbG9yXSA9PT0gdW5kZWZpbmVkKXtcblx0XHRcdHRoaXMuX21hdGVyaWFsc1tjb2xvcl0gPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe2NvbG9yOiBjb2xvcn0pXG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tYXRlcmlhbHNbY29sb3JdXG5cdH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHR0aGlzLm1lc2gubWF0ZXJpYWwgPSB0aGlzLmdldEZyb21NYXRlcmlhbENhY2hlKGNvbG9yKTtcblx0fVxufVxuUG9pbnQucHJvdG90eXBlLnNoYXJlZENpcmNsZUdlb21ldHJ5ID0gbmV3IFRIUkVFLlNwaGVyZUdlb21ldHJ5KDEvMiwgOCwgNik7IC8vcmFkaXVzIDEvMiBtYWtlcyBkaWFtZXRlciAxLCBzbyB0aGF0IHNjYWxpbmcgYnkgbiBtZWFucyB3aWR0aD1uXG5cblBvaW50LnByb3RvdHlwZS5fbWF0ZXJpYWxzID0ge307XG4iLCJpbXBvcnQgUG9pbnQgZnJvbSAnLi9Qb2ludC5qcyc7XG5pbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuXG5jbGFzcyBQb2ludE91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKlxuXHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0Y29sb3I6IGhleCBjb2xvciwgYXMgaW4gMHhycmdnYmIuIFRlY2huaWNhbGx5LCB0aGlzIGlzIGEgSlMgaW50ZWdlci5cblx0XHRcdG9wYWNpdHk6IDAtMS4gT3B0aW9uYWwuXG5cdFx0Ki9cblxuXHRcdHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDE7XG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmNvbG9yIDogMHg1NWFhNTU7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcblxuXG5cdFx0dGhpcy5wb2ludHMgPSBbXTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuXHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblx0fVxuXHRfb25BZGQoKXsgLy9zaG91bGQgYmUgY2FsbGVkIHdoZW4gdGhpcyBpcyAuYWRkKCllZCB0byBzb21ldGhpbmdcblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgQXJlYVxuXHRcdGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pe1xuXHRcdFx0Zm9yKHZhciBpPXRoaXMucG9pbnRzLmxlbmd0aDtpPHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO2krKyl7XG5cdFx0XHRcdHRoaXMucG9pbnRzLnB1c2gobmV3IFBvaW50KHt3aWR0aDogMSxjb2xvcjp0aGlzLl9jb2xvciwgb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSkpO1xuXHRcdFx0XHR0aGlzLnBvaW50c1tpXS5tZXNoLnNjYWxlLnNldFNjYWxhcih0aGlzLl93aWR0aCk7IC8vc2V0IHdpZHRoIGJ5IHNjYWxpbmcgcG9pbnRcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pdGhpcy5fb25BZGQoKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblx0XHR2YXIgcG9pbnQgPSB0aGlzLmdldFBvaW50KGkpO1xuXHRcdGlmKHggIT09IHVuZGVmaW5lZClwb2ludC54ID0geDtcblx0XHRpZih5ICE9PSB1bmRlZmluZWQpcG9pbnQueSA9IHk7XG5cdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXBvaW50LnogPSB6O1xuXHR9XG5cdGdldFBvaW50KGkpe1xuXHRcdHJldHVybiB0aGlzLnBvaW50c1tpXTtcblx0fVxuXHRzZXQgb3BhY2l0eShvcGFjaXR5KXtcblx0XHQvL3RlY2huaWNhbGx5IHRoaXMgd2lsbCBzZXQgYWxsIHBvaW50cyBvZiB0aGUgc2FtZSBjb2xvciwgYW5kIGl0J2xsIGJlIHdpcGVkIHdpdGggYSBjb2xvciBjaGFuZ2UuIEJ1dCBJJ2xsIGRlYWwgd2l0aCB0aGF0IHNvbWV0aW1lIGxhdGVyLlxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb247aSsrKXtcblx0XHRcdGxldCBtYXQgPSB0aGlzLmdldFBvaW50KGkpLm1lc2gubWF0ZXJpYWw7XG5cdFx0XHRtYXQub3BhY2l0eSA9IG9wYWNpdHk7IC8vaW5zdGFudGlhdGUgdGhlIHBvaW50XG5cdFx0XHRtYXQudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMTtcbiAgICAgICAgICAgIG1hdC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0fVxuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuXHR9XG5cdGdldCBvcGFjaXR5KCl7XG5cdFx0cmV0dXJuIHRoaXMuX29wYWNpdHk7XG5cdH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMucG9pbnRzLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5nZXRQb2ludChpKS5jb2xvciA9IGNvbG9yO1xuXHRcdH1cblx0XHR0aGlzLl9jb2xvciA9IGNvbG9yO1xuXHR9XG5cdGdldCBjb2xvcigpe1xuXHRcdHJldHVybiB0aGlzLl9jb2xvcjtcblx0fVxuXHRzZXQgd2lkdGgod2lkdGgpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5wb2ludHMubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmdldFBvaW50KGkpLm1lc2guc2NhbGUuc2V0U2NhbGFyKHdpZHRoKTtcblx0XHR9XG5cdFx0dGhpcy5fd2lkdGggPSB3aWR0aDtcblx0fVxuXHRnZXQgd2lkdGgoKXtcblx0XHRyZXR1cm4gdGhpcy5fd2lkdGg7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IFBvaW50T3V0cHV0KHt3aWR0aDogdGhpcy53aWR0aCwgY29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eX0pO1xuXHR9XG59XG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0UG9pbnQoKXtcblx0dmFyIHggPSBuZXcgRVhQLkFyZWEoe2JvdW5kczogW1stMTAsMTBdXX0pO1xuXHR2YXIgeSA9IG5ldyBFWFAuVHJhbnNmb3JtYXRpb24oeydleHByJzogKHgpID0+IHgqeH0pO1xuXHR2YXIgeSA9IG5ldyBFWFAuUG9pbnRPdXRwdXQoKTtcblx0eC5hZGQoeSk7XG5cdHkuYWRkKHopO1xuXHR4LmFjdGl2YXRlKCk7XG59XG5cbmV4cG9ydCB7UG9pbnRPdXRwdXR9XG4iLCJpbXBvcnQgeyBMaW5lT3V0cHV0IH0gZnJvbSAnLi9MaW5lT3V0cHV0LmpzJztcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi4vdXRpbHMuanMnO1xuaW1wb3J0IHsgdGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4uL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5leHBvcnQgY2xhc3MgVmVjdG9yT3V0cHV0IGV4dGVuZHMgTGluZU91dHB1dHtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcblx0XHQvKmlucHV0OiBUcmFuc2Zvcm1hdGlvblxuXHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdCovXG5cdFx0c3VwZXIob3B0aW9ucyk7XG5cblx0fVxuXHRpbml0KCl7XG5cdFx0dGhpcy5fZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcblx0XHR0aGlzLl92ZXJ0aWNlcztcblx0XHR0aGlzLmFycm93aGVhZHMgPSBbXTtcblxuXG5cdFx0dGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7Y29sb3I6IHRoaXMuX2NvbG9yLCBsaW5ld2lkdGg6IHRoaXMuX3dpZHRoLCBvcGFjaXR5OnRoaXMuX29wYWNpdHl9KTtcblx0XHR0aGlzLmxpbmVNZXNoID0gbmV3IFRIUkVFLkxpbmVTZWdtZW50cyh0aGlzLl9nZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vIHNldHRlciBzZXRzIHRyYW5zcGFyZW50IGZsYWcgaWYgbmVjZXNzYXJ5XG5cblxuXHRcdGNvbnN0IGNpcmNsZVJlc29sdXRpb24gPSAxMjtcblx0XHRjb25zdCBhcnJvd2hlYWRTaXplID0gMC4zO1xuXHRcdGNvbnN0IEVQU0lMT04gPSAwLjAwMDAxO1xuXHRcdHRoaXMuRVBTSUxPTiA9IEVQU0lMT047XG5cblx0XHR0aGlzLmNvbmVHZW9tZXRyeSA9IG5ldyBUSFJFRS5DeWxpbmRlckJ1ZmZlckdlb21ldHJ5KCAwLCBhcnJvd2hlYWRTaXplLCBhcnJvd2hlYWRTaXplKjEuNywgY2lyY2xlUmVzb2x1dGlvbiwgMSApO1xuXHRcdGxldCBhcnJvd2hlYWRPdmVyc2hvb3RGYWN0b3IgPSAwLjE7IC8vdXNlZCBzbyB0aGF0IHRoZSBsaW5lIHdvbid0IHJ1ZGVseSBjbGlwIHRocm91Z2ggdGhlIHBvaW50IG9mIHRoZSBhcnJvd2hlYWRcblxuXHRcdHRoaXMuY29uZUdlb21ldHJ5LnRyYW5zbGF0ZSggMCwgLSBhcnJvd2hlYWRTaXplICsgYXJyb3doZWFkT3ZlcnNob290RmFjdG9yLCAwICk7XG5cblx0XHR0aGlzLl9jb25lVXBEaXJlY3Rpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygwLDEsMCk7XG5cblx0XHR0aGlzLm1ha2VHZW9tZXRyeSgpO1xuXG5cdFx0dGhyZWVFbnZpcm9ubWVudC5zY2VuZS5hZGQodGhpcy5saW5lTWVzaCk7XG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG5cdFx0c3VwZXIuX29uRmlyc3RBY3RpdmF0aW9uKCk7XG5cblx0XHRpZih0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aCA+IDEpe1xuXHRcdFx0dGhpcy5udW1BcnJvd2hlYWRzID0gdGhpcy5pdGVtRGltZW5zaW9ucy5zbGljZSgwLHRoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTEpLnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXJyZW50KXtcblx0XHRcdFx0cmV0dXJuIGN1cnJlbnQgKyBwcmV2O1xuXHRcdFx0fSk7XG5cdFx0fWVsc2V7XG5cdFx0XHQvL2Fzc3VtZWQgaXRlbURpbWVuc2lvbnMgaXNuJ3QgYSBub256ZXJvIGFycmF5LiBUaGF0IHNob3VsZCBiZSB0aGUgY29uc3RydWN0b3IncyBwcm9ibGVtLlxuXHRcdFx0dGhpcy5udW1BcnJvd2hlYWRzID0gMTtcblx0XHR9XG5cblx0XHQvL3JlbW92ZSBhbnkgcHJldmlvdXMgYXJyb3doZWFkc1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5hcnJvd2hlYWRzLmxlbmd0aDtpKyspe1xuXHRcdFx0bGV0IGFycm93ID0gdGhpcy5hcnJvd2hlYWRzW2ldO1xuXHRcdFx0dGhyZWVFbnZpcm9ubWVudC5zY2VuZS5yZW1vdmUoYXJyb3cpO1xuXHRcdH1cblxuXHRcdHRoaXMuYXJyb3doZWFkcyA9IG5ldyBBcnJheSh0aGlzLm51bUFycm93aGVhZHMpO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1BcnJvd2hlYWRzO2krKyl7XG5cdFx0XHR0aGlzLmFycm93aGVhZHNbaV0gPSBuZXcgVEhSRUUuTWVzaCh0aGlzLmNvbmVHZW9tZXRyeSwgdGhpcy5tYXRlcmlhbCk7XG5cdFx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLmFkZCh0aGlzLmFycm93aGVhZHNbaV0pO1xuXHRcdH1cblx0XHRjb25zb2xlLmxvZyhcIm51bWJlciBvZiBhcnJvd2hlYWRzICg9IG51bWJlciBvZiBsaW5lcyk6XCIrIHRoaXMubnVtQXJyb3doZWFkcyk7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope1xuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblx0XHRpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7XHRcblx0XHR9XG5cblx0XHQvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuXHRcdGxldCBpbmRleCA9IHRoaXMuX2N1cnJlbnRQb2ludEluZGV4KnRoaXMuX291dHB1dERpbWVuc2lvbnM7XG5cblx0XHRpZih4ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXhdID0geDtcblx0XHRpZih5ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMV0gPSB5O1xuXHRcdGlmKHogIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXSA9IHo7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXG5cdFx0Lyogd2UncmUgZHJhd2luZyBsaWtlIHRoaXM6XG5cdFx0Ki0tLS0qLS0tLSpcblxuICAgICAgICAqLS0tLSotLS0tKlxuXHRcblx0XHRidXQgd2UgZG9uJ3Qgd2FudCB0byBpbnNlcnQgYSBkaWFnb25hbCBsaW5lIGFueXdoZXJlLiBUaGlzIGhhbmRsZXMgdGhhdDogICovXG5cblx0XHRsZXQgZmlyc3RDb29yZGluYXRlID0gaSAlIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG5cblx0XHQvL3ZlcnRpY2VzIHNob3VsZCByZWFsbHkgYmUgYW4gdW5pZm9ybSwgdGhvdWdoLlxuXHRcdGlmKCEoZmlyc3RDb29yZGluYXRlID09IDAgfHwgZmlyc3RDb29yZGluYXRlID09IHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0tMSkpe1xuXHRcdFx0aWYoeCAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnNdID0geDtcblx0XHRcdGlmKHkgIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zKzFdID0geTtcblx0XHRcdGlmKHogIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zKzJdID0gejtcblx0XHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4Kys7XG5cdFx0fVxuXG5cdFx0aWYoZmlyc3RDb29yZGluYXRlID09IHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0tMSl7XG5cblx0XHRcdC8vY2FsY3VsYXRlIGRpcmVjdGlvbiBvZiBsYXN0IGxpbmUgc2VnbWVudFxuXHRcdFx0bGV0IGR4ID0gdGhpcy5fdmVydGljZXNbaW5kZXgtdGhpcy5fb3V0cHV0RGltZW5zaW9uc10gLSB0aGlzLl92ZXJ0aWNlc1tpbmRleF1cblx0XHRcdGxldCBkeSA9IHRoaXMuX3ZlcnRpY2VzW2luZGV4LXRoaXMuX291dHB1dERpbWVuc2lvbnMrMV0gLSB0aGlzLl92ZXJ0aWNlc1tpbmRleCsxXVxuXHRcdFx0bGV0IGR6ID0gdGhpcy5fdmVydGljZXNbaW5kZXgtdGhpcy5fb3V0cHV0RGltZW5zaW9ucysyXSAtIHRoaXMuX3ZlcnRpY2VzW2luZGV4KzJdXG5cblx0XHRcdGxldCBsaW5lTnVtYmVyID0gTWF0aC5mbG9vcihpIC8gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXSk7XG5cdFx0XHRVdGlscy5hc3NlcnQobGluZU51bWJlciA8PSB0aGlzLm51bUFycm93aGVhZHMpOyAvL3RoaXMgbWF5IGJlIHdyb25nXG5cblx0XHRcdGxldCBkaXJlY3Rpb25WZWN0b3IgPSBuZXcgVEhSRUUuVmVjdG9yMygtZHgsLWR5LC1keilcblxuXHRcdFx0Ly9NYWtlIGFycm93cyBkaXNhcHBlYXIgaWYgdGhlIGxpbmUgaXMgc21hbGwgZW5vdWdoXG5cdFx0XHQvL09uZSB3YXkgdG8gZG8gdGhpcyB3b3VsZCBiZSB0byBzdW0gdGhlIGRpc3RhbmNlcyBvZiBhbGwgbGluZSBzZWdtZW50cy4gSSdtIGNoZWF0aW5nIGhlcmUgYW5kIGp1c3QgbWVhc3VyaW5nIHRoZSBkaXN0YW5jZSBvZiB0aGUgbGFzdCB2ZWN0b3IsIHRoZW4gbXVsdGlwbHlpbmcgYnkgdGhlIG51bWJlciBvZiBsaW5lIHNlZ21lbnRzIChuYWl2ZWx5IGFzc3VtaW5nIGFsbCBsaW5lIHNlZ21lbnRzIGFyZSB0aGUgc2FtZSBsZW5ndGgpXG5cdFx0XHRsZXQgbGVuZ3RoID0gZGlyZWN0aW9uVmVjdG9yLmxlbmd0aCgpICogKHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0tMSlcblxuXHRcdFx0Y29uc3QgZWZmZWN0aXZlRGlzdGFuY2UgPSAzO1xuXG5cdFx0XHRsZXQgY2xhbXBlZExlbmd0aCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGxlbmd0aC9lZmZlY3RpdmVEaXN0YW5jZSwgMSkpLzFcblxuXHRcdFx0Ly9zaHJpbmsgZnVuY3Rpb24gZGVzaWduZWQgdG8gaGF2ZSBhIHN0ZWVwIHNsb3BlIGNsb3NlIHRvIDAgYnV0IG1lbGxvdyBvdXQgYXQgMC41IG9yIHNvIGluIG9yZGVyIHRvIGF2b2lkIHRoZSBsaW5lIHdpZHRoIG92ZXJjb21pbmcgdGhlIGFycm93aGVhZCB3aWR0aFxuXHRcdFx0Ly9JbiBDaHJvbWUsIHRocmVlLmpzIGNvbXBsYWlucyB3aGVuZXZlciBzb21ldGhpbmcgaXMgc2V0IHRvIDAgc2NhbGUuIEFkZGluZyBhbiBlcHNpbG9uIHRlcm0gaXMgdW5mb3J0dW5hdGUgYnV0IG5lY2Vzc2FyeSB0byBhdm9pZCBjb25zb2xlIHNwYW0uXG5cdFx0XHRcblx0XHRcdHRoaXMuYXJyb3doZWFkc1tsaW5lTnVtYmVyXS5zY2FsZS5zZXRTY2FsYXIoTWF0aC5hY29zKDEtMipjbGFtcGVkTGVuZ3RoKS9NYXRoLlBJICsgdGhpcy5FUFNJTE9OKTtcblx0XHRcdFxuIFx0XHRcdC8vcG9zaXRpb24vcm90YXRpb24gY29tZXMgYWZ0ZXIgc2luY2UgLm5vcm1hbGl6ZSgpIG1vZGlmaWVzIGRpcmVjdGlvblZlY3RvciBpbiBwbGFjZVxuXHRcdFxuXHRcdFx0bGV0IHBvcyA9IHRoaXMuYXJyb3doZWFkc1tsaW5lTnVtYmVyXS5wb3NpdGlvbjtcblxuXHRcdFx0aWYoeCAhPT0gdW5kZWZpbmVkKXBvcy54ID0geDtcblx0XHRcdGlmKHkgIT09IHVuZGVmaW5lZClwb3MueSA9IHk7XG5cdFx0XHRpZih6ICE9PSB1bmRlZmluZWQpcG9zLnogPSB6O1xuXG5cdFx0XHRpZihsZW5ndGggPiAwKXsgLy9kaXJlY3Rpb25WZWN0b3Iubm9ybWFsaXplKCkgZmFpbHMgd2l0aCAwIGxlbmd0aFxuXHRcdFx0XHR0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0ucXVhdGVybmlvbi5zZXRGcm9tVW5pdFZlY3RvcnModGhpcy5fY29uZVVwRGlyZWN0aW9uLCBkaXJlY3Rpb25WZWN0b3Iubm9ybWFsaXplKCkgKTtcblx0XHRcdH1cblxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdHJldHVybiBuZXcgVmVjdG9yT3V0cHV0KHt3aWR0aDogdGhpcy53aWR0aCwgY29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eX0pO1xuXHR9XG59XG5cblxuIiwiLy9TdXJmYWNlT3V0cHV0U2hhZGVycy5qc1xuXG4vL2V4cGVyaW1lbnQ6IHNoYWRlcnMgdG8gZ2V0IHRoZSB0cmlhbmdsZSBwdWxzYXRpbmchXG52YXIgdlNoYWRlciA9IFtcblwidmFyeWluZyB2ZWMzIHZOb3JtYWw7XCIsXG5cInZhcnlpbmcgdmVjMyB2UG9zaXRpb247XCIsXG5cInZhcnlpbmcgdmVjMiB2VXY7XCIsXG5cInVuaWZvcm0gZmxvYXQgdGltZTtcIixcblwidW5pZm9ybSB2ZWMzIGNvbG9yO1wiLFxuXCJ1bmlmb3JtIHZlYzMgdkxpZ2h0O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGdyaWRTcXVhcmVzO1wiLFxuXG5cInZvaWQgbWFpbigpIHtcIixcblx0XCJ2UG9zaXRpb24gPSBwb3NpdGlvbi54eXo7XCIsXG5cdFwidk5vcm1hbCA9IG5vcm1hbC54eXo7XCIsXG5cdFwidlV2ID0gdXYueHk7XCIsXG5cdFwiZ2xfUG9zaXRpb24gPSBwcm9qZWN0aW9uTWF0cml4ICpcIixcbiAgICAgICAgICAgIFwibW9kZWxWaWV3TWF0cml4ICpcIixcbiAgICAgICAgICAgIFwidmVjNChwb3NpdGlvbiwxLjApO1wiLFxuXCJ9XCJdLmpvaW4oXCJcXG5cIilcblxudmFyIGZTaGFkZXIgPSBbXG5cInZhcnlpbmcgdmVjMyB2Tm9ybWFsO1wiLFxuXCJ2YXJ5aW5nIHZlYzMgdlBvc2l0aW9uO1wiLFxuXCJ2YXJ5aW5nIHZlYzIgdlV2O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IHRpbWU7XCIsXG5cInVuaWZvcm0gdmVjMyBjb2xvcjtcIixcblwidW5pZm9ybSB2ZWMzIHZMaWdodDtcIixcblwidW5pZm9ybSBmbG9hdCBncmlkU3F1YXJlcztcIixcblwidW5pZm9ybSBmbG9hdCBsaW5lV2lkdGg7XCIsXG5cInVuaWZvcm0gZmxvYXQgc2hvd0dyaWQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgc2hvd1NvbGlkO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IG9wYWNpdHk7XCIsXG5cblx0Ly90aGUgZm9sbG93aW5nIGNvZGUgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vdW5jb25lZC9tYXRoYm94L2Jsb2IvZWFlYjhlMTVlZjJkMDI1Mjc0MGE3NDUwNWExMmQ3YTEwNTFhNjFiNi9zcmMvc2hhZGVycy9nbHNsL21lc2guZnJhZ21lbnQuc2hhZGVkLmdsc2xcblwidmVjMyBvZmZTcGVjdWxhcih2ZWMzIGNvbG9yKSB7XCIsXG5cIiAgdmVjMyBjID0gMS4wIC0gY29sb3I7XCIsXG5cIiAgcmV0dXJuIDEuMCAtIGMgKiBjO1wiLFxuXCJ9XCIsXG5cblwidmVjNCBnZXRTaGFkZWRDb2xvcih2ZWM0IHJnYmEpIHsgXCIsXG5cIiAgdmVjMyBjb2xvciA9IHJnYmEueHl6O1wiLFxuXCIgIHZlYzMgY29sb3IyID0gb2ZmU3BlY3VsYXIocmdiYS54eXopO1wiLFxuXG5cIiAgdmVjMyBub3JtYWwgPSBub3JtYWxpemUodk5vcm1hbCk7XCIsXG5cIiAgdmVjMyBsaWdodCA9IG5vcm1hbGl6ZSh2TGlnaHQpO1wiLFxuXCIgIHZlYzMgcG9zaXRpb24gPSBub3JtYWxpemUodlBvc2l0aW9uKTtcIixcblxuXCIgIGZsb2F0IHNpZGUgICAgPSBnbF9Gcm9udEZhY2luZyA/IC0xLjAgOiAxLjA7XCIsXG5cIiAgZmxvYXQgY29zaW5lICA9IHNpZGUgKiBkb3Qobm9ybWFsLCBsaWdodCk7XCIsXG5cIiAgZmxvYXQgZGlmZnVzZSA9IG1peChtYXgoMC4wLCBjb3NpbmUpLCAuNSArIC41ICogY29zaW5lLCAuMSk7XCIsXG5cblwiICBmbG9hdCByaW1MaWdodGluZyA9IG1heChtaW4oMS4wIC0gc2lkZSpkb3Qobm9ybWFsLCBsaWdodCksIDEuMCksMC4wKTtcIixcblxuXCJcdGZsb2F0IHNwZWN1bGFyID0gbWF4KDAuMCwgYWJzKGNvc2luZSkgLSAwLjUpO1wiLCAvL2RvdWJsZSBzaWRlZCBzcGVjdWxhclxuXCIgICByZXR1cm4gdmVjNChkaWZmdXNlKmNvbG9yICsgMC45KnJpbUxpZ2h0aW5nKmNvbG9yICsgMC40KmNvbG9yMiAqIHNwZWN1bGFyLCByZ2JhLmEpO1wiLFxuXCJ9XCIsXG5cbi8vIFNtb290aCBIU1YgdG8gUkdCIGNvbnZlcnNpb24gZnJvbSBodHRwczovL3d3dy5zaGFkZXJ0b3kuY29tL3ZpZXcvTXNTM1djXG5cInZlYzMgaHN2MnJnYl9zbW9vdGgoIGluIHZlYzMgYyApe1wiLFxuXCIgICAgdmVjMyByZ2IgPSBjbGFtcCggYWJzKG1vZChjLngqNi4wK3ZlYzMoMC4wLDQuMCwyLjApLDYuMCktMy4wKS0xLjAsIDAuMCwgMS4wICk7XCIsXG5cIlx0cmdiID0gcmdiKnJnYiooMy4wLTIuMCpyZ2IpOyAvLyBjdWJpYyBzbW9vdGhpbmdcdFwiLFxuXCJcdHJldHVybiBjLnogKiBtaXgoIHZlYzMoMS4wKSwgcmdiLCBjLnkpO1wiLFxuXCJ9XCIsXG5cbi8vRnJvbSBTYW0gSG9jZXZhcjogaHR0cDovL2xvbGVuZ2luZS5uZXQvYmxvZy8yMDEzLzA3LzI3L3JnYi10by1oc3YtaW4tZ2xzbFxuXCJ2ZWMzIHJnYjJoc3YodmVjMyBjKXtcIixcblwiICAgIHZlYzQgSyA9IHZlYzQoMC4wLCAtMS4wIC8gMy4wLCAyLjAgLyAzLjAsIC0xLjApO1wiLFxuXCIgICAgdmVjNCBwID0gbWl4KHZlYzQoYy5iZywgSy53eiksIHZlYzQoYy5nYiwgSy54eSksIHN0ZXAoYy5iLCBjLmcpKTtcIixcblwiICAgIHZlYzQgcSA9IG1peCh2ZWM0KHAueHl3LCBjLnIpLCB2ZWM0KGMuciwgcC55engpLCBzdGVwKHAueCwgYy5yKSk7XCIsXG5cblwiICAgIGZsb2F0IGQgPSBxLnggLSBtaW4ocS53LCBxLnkpO1wiLFxuXCIgICAgZmxvYXQgZSA9IDEuMGUtMTA7XCIsXG5cIiAgICByZXR1cm4gdmVjMyhhYnMocS56ICsgKHEudyAtIHEueSkgLyAoNi4wICogZCArIGUpKSwgZCAvIChxLnggKyBlKSwgcS54KTtcIixcblwifVwiLFxuIC8vY2hvb3NlcyB0aGUgY29sb3IgZm9yIHRoZSBncmlkbGluZXMgYnkgdmFyeWluZyBsaWdodG5lc3MuIFxuLy9OT1QgY29udGludW91cyBvciBlbHNlIGJ5IHRoZSBpbnRlcm1lZGlhdGUgZnVuY3Rpb24gdGhlb3JlbSB0aGVyZSdkIGJlIGEgcG9pbnQgd2hlcmUgdGhlIGdyaWRsaW5lcyB3ZXJlIHRoZSBzYW1lIGNvbG9yIGFzIHRoZSBtYXRlcmlhbC5cblwidmVjMyBncmlkTGluZUNvbG9yKHZlYzMgY29sb3Ipe1wiLFxuXCIgdmVjMyBoc3YgPSByZ2IyaHN2KGNvbG9yLnh5eik7XCIsXG5cIiAvL2hzdi54ICs9IDAuMTtcIixcblwiIGlmKGhzdi56IDwgMC44KXtoc3YueiArPSAwLjI7fWVsc2V7aHN2LnogPSAwLjg1LTAuMSpoc3Yuejtoc3YueSAtPSAwLjA7fVwiLFxuXCIgcmV0dXJuIGhzdjJyZ2Jfc21vb3RoKGhzdik7XCIsXG5cIn1cIixcblxuXCJ2ZWM0IHJlbmRlckdyaWRsaW5lcyh2ZWM0IG1haW5Db2xvciwgdmVjMiB1diwgdmVjNCBjb2xvcikge1wiLFxuXCIgIHZlYzIgZGlzdFRvRWRnZSA9IGFicyhtb2QodlV2Lnh5KmdyaWRTcXVhcmVzICsgbGluZVdpZHRoLzIuMCwxLjApKTtcIixcblwiICB2ZWMzIGdyaWRDb2xvciA9IGdyaWRMaW5lQ29sb3IoY29sb3IueHl6KTtcIixcblxuXCIgIGlmKCBkaXN0VG9FZGdlLnggPCBsaW5lV2lkdGgpe1wiLFxuXCIgICAgcmV0dXJuIHNob3dHcmlkKnZlYzQoZ3JpZENvbG9yLCBjb2xvci5hKSArICgxLi1zaG93R3JpZCkqbWFpbkNvbG9yO1wiLFxuXCIgIH0gZWxzZSBpZihkaXN0VG9FZGdlLnkgPCBsaW5lV2lkdGgpeyBcIixcblwiICAgIHJldHVybiBzaG93R3JpZCp2ZWM0KGdyaWRDb2xvciwgY29sb3IuYSkgKyAoMS4tc2hvd0dyaWQpKm1haW5Db2xvcjtcIixcblwiICB9XCIsXG5cIiAgcmV0dXJuIG1haW5Db2xvcjtcIixcblwifVwiLFxuLypcblwidmVjNCBnZXRTaGFkZWRDb2xvck1hdGhib3godmVjNCByZ2JhKSB7IFwiLFxuXCIgIHZlYzMgY29sb3IgPSByZ2JhLnh5ejtcIixcblwiICB2ZWMzIGNvbG9yMiA9IG9mZlNwZWN1bGFyKHJnYmEueHl6KTtcIixcblxuXCIgIHZlYzMgbm9ybWFsID0gbm9ybWFsaXplKHZOb3JtYWwpO1wiLFxuXCIgIHZlYzMgbGlnaHQgPSBub3JtYWxpemUodkxpZ2h0KTtcIixcblwiICB2ZWMzIHBvc2l0aW9uID0gbm9ybWFsaXplKHZQb3NpdGlvbik7XCIsXG5cIiAgZmxvYXQgc2lkZSAgICA9IGdsX0Zyb250RmFjaW5nID8gLTEuMCA6IDEuMDtcIixcblwiICBmbG9hdCBjb3NpbmUgID0gc2lkZSAqIGRvdChub3JtYWwsIGxpZ2h0KTtcIixcblwiICBmbG9hdCBkaWZmdXNlID0gbWl4KG1heCgwLjAsIGNvc2luZSksIC41ICsgLjUgKiBjb3NpbmUsIC4xKTtcIixcblwiICAgdmVjMyAgaGFsZkxpZ2h0ID0gbm9ybWFsaXplKGxpZ2h0ICsgcG9zaXRpb24pO1wiLFxuXCJcdGZsb2F0IGNvc2luZUhhbGYgPSBtYXgoMC4wLCBzaWRlICogZG90KG5vcm1hbCwgaGFsZkxpZ2h0KSk7XCIsXG5cIlx0ZmxvYXQgc3BlY3VsYXIgPSBwb3coY29zaW5lSGFsZiwgMTYuMCk7XCIsXG5cIlx0cmV0dXJuIHZlYzQoY29sb3IgKiAoZGlmZnVzZSAqIC45ICsgLjA1KSAqMC4wICsgIC4yNSAqIGNvbG9yMiAqIHNwZWN1bGFyLCByZ2JhLmEpO1wiLFxuXCJ9XCIsKi9cblxuXCJ2b2lkIG1haW4oKXtcIixcbi8vXCIgIC8vZ2xfRnJhZ0NvbG9yID0gdmVjNCh2Tm9ybWFsLnh5eiwgMS4wKTsgLy8gdmlldyBkZWJ1ZyBub3JtYWxzXCIsXG4vL1wiICAvL2lmKHZOb3JtYWwueCA8IDAuMCl7Z2xfRnJhZ0NvbG9yID0gdmVjNChvZmZTcGVjdWxhcihjb2xvci5yZ2IpLCAxLjApO31lbHNle2dsX0ZyYWdDb2xvciA9IHZlYzQoKGNvbG9yLnJnYiksIDEuMCk7fVwiLCAvL3ZpZXcgc3BlY3VsYXIgYW5kIG5vbi1zcGVjdWxhciBjb2xvcnNcbi8vXCIgIGdsX0ZyYWdDb2xvciA9IHZlYzQobW9kKHZVdi54eSwxLjApLDAuMCwxLjApOyAvL3Nob3cgdXZzXG5cIiAgdmVjNCBtYXRlcmlhbENvbG9yID0gc2hvd1NvbGlkKmdldFNoYWRlZENvbG9yKHZlYzQoY29sb3IucmdiLCBvcGFjaXR5KSk7XCIsXG5cIiAgdmVjNCBjb2xvcldpdGhHcmlkbGluZXMgPSByZW5kZXJHcmlkbGluZXMobWF0ZXJpYWxDb2xvciwgdlV2Lnh5LCB2ZWM0KGNvbG9yLnJnYiwgb3BhY2l0eSkpO1wiLFxuXCIgIGdsX0ZyYWdDb2xvciA9IGNvbG9yV2l0aEdyaWRsaW5lcztcIixcdFxuXCJ9XCJdLmpvaW4oXCJcXG5cIilcblxudmFyIHVuaWZvcm1zID0ge1xuXHR0aW1lOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAwLFxuXHR9LFxuXHRjb2xvcjoge1xuXHRcdHR5cGU6ICdjJyxcblx0XHR2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDB4NTVhYTU1KSxcblx0fSxcblx0b3BhY2l0eToge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMC4xLFxuXHR9LFxuXHR2TGlnaHQ6IHsgLy9saWdodCBkaXJlY3Rpb25cblx0XHR0eXBlOiAndmVjMycsXG5cdFx0dmFsdWU6IFswLDAsMV0sXG5cdH0sXG5cdGdyaWRTcXVhcmVzOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiA0LFxuXHR9LFxuXHRsaW5lV2lkdGg6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDAuMSxcblx0fSxcblx0c2hvd0dyaWQ6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCxcblx0fSxcblx0c2hvd1NvbGlkOiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAxLjAsXG5cdH1cbn07XG5cbmV4cG9ydCB7IHZTaGFkZXIsIGZTaGFkZXIsIHVuaWZvcm1zIH07XG4iLCJpbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuaW1wb3J0IHtMaW5lT3V0cHV0fSBmcm9tICcuL0xpbmVPdXRwdXQuanMnO1xuaW1wb3J0IHsgdGhyZWVFbnZpcm9ubWVudCB9IGZyb20gJy4uL1RocmVlRW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgdlNoYWRlciwgZlNoYWRlciwgdW5pZm9ybXMgfSBmcm9tICcuL1N1cmZhY2VPdXRwdXRTaGFkZXJzLmpzJztcblxuY2xhc3MgU3VyZmFjZU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKiBzaG91bGQgYmUgLmFkZCgpZWQgdG8gYSBUcmFuc2Zvcm1hdGlvbiB0byB3b3JrXG5cdFx0XHRvcHRpb25zOlxuXHRcdFx0e1xuXHRcdFx0XHR3aWR0aDogbnVtYmVyXG5cdFx0XHRcdG9wYWNpdHk6IG51bWJlclxuXHRcdFx0XHRjb2xvcjogaGV4IGNvZGUgb3IgVEhSRUUuQ29sb3IoKVxuXHRcdFx0XHRzaG93R3JpZDogYm9vbGVhbi4gSWYgdHJ1ZSwgd2lsbCBkaXNwbGF5IGEgZ3JpZCBvdmVyIHRoZSBzdXJmYWNlLiBEZWZhdWx0OiB0cnVlXG5cdFx0XHRcdHNob3dTb2xpZDogYm9vbGVhbi4gSWYgdHJ1ZSwgd2lsbCBkaXNwbGF5IGEgc29saWQgc3VyZmFjZS4gRGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHRncmlkU3F1YXJlczogbnVtYmVyIHJlcHJlc2VudGluZyBob3cgbWFueSBzcXVhcmVzIHBlciBkaW1lbnNpb24gdG8gdXNlIGluIGEgcmVuZGVyZWQgZ3JpZFxuXHRcdFx0fVxuXHRcdCovXG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcblx0XHR0aGlzLl9jb2xvciA9IG9wdGlvbnMuY29sb3IgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuY29sb3IgOiAweDU1YWE1NTtcblxuXHRcdHRoaXMuX2dyaWRTcXVhcmVzID0gb3B0aW9ucy5ncmlkU3F1YXJlcyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5ncmlkU3F1YXJlcyA6IDE2O1xuXHRcdHRoaXMuX3Nob3dHcmlkID0gb3B0aW9ucy5zaG93R3JpZCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5zaG93R3JpZCA6IHRydWU7XG5cdFx0dGhpcy5fc2hvd1NvbGlkID0gb3B0aW9ucy5zaG93U29saWQgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuc2hvd1NvbGlkIDogdHJ1ZTtcblx0XHR0aGlzLl9ncmlkTGluZVdpZHRoID0gb3B0aW9ucy5ncmlkTGluZVdpZHRoICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmdyaWRMaW5lV2lkdGggOiAwLjE1O1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSAwOyAvL3Nob3VsZCBhbHdheXMgYmUgZXF1YWwgdG8gdGhpcy52ZXJ0aWNlcy5sZW5ndGhcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGhvdyBtYW55IHRpbWVzIHRvIGJlIGNhbGxlZCBpbiBlYWNoIGRpcmVjdGlvblxuXHRcdHRoaXMuX291dHB1dERpbWVuc2lvbnMgPSAzOyAvL2hvdyBtYW55IGRpbWVuc2lvbnMgcGVyIHBvaW50IHRvIHN0b3JlP1xuXG5cdFx0dGhpcy5pbml0KCk7XG5cdH1cblx0aW5pdCgpe1xuXHRcdHRoaXMuX2dlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCk7XG5cdFx0dGhpcy5fdmVydGljZXM7XG5cdFx0dGhpcy5tYWtlR2VvbWV0cnkoKTtcblxuXHRcdC8vbWFrZSBhIGRlZXAgY29weSBvZiB0aGUgdW5pZm9ybXMgdGVtcGxhdGVcblx0XHR0aGlzLl91bmlmb3JtcyA9IHt9O1xuXHRcdGZvcih2YXIgdW5pZm9ybU5hbWUgaW4gdW5pZm9ybXMpe1xuXHRcdFx0dGhpcy5fdW5pZm9ybXNbdW5pZm9ybU5hbWVdID0ge1xuXHRcdFx0XHR0eXBlOiB1bmlmb3Jtc1t1bmlmb3JtTmFtZV0udHlwZSxcblx0XHRcdFx0dmFsdWU6IHVuaWZvcm1zW3VuaWZvcm1OYW1lXS52YWx1ZVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuU2hhZGVyTWF0ZXJpYWwoe1xuXHRcdFx0c2lkZTogVEhSRUUuQmFja1NpZGUsXG5cdFx0XHR2ZXJ0ZXhTaGFkZXI6IHZTaGFkZXIsIFxuXHRcdFx0ZnJhZ21lbnRTaGFkZXI6IGZTaGFkZXIsXG5cdFx0XHR1bmlmb3JtczogdGhpcy5fdW5pZm9ybXMsXG5cdFx0XHR9KTtcblx0XHR0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTWVzaCh0aGlzLl9nZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vIHNldHRlciBzZXRzIHRyYW5zcGFyZW50IGZsYWcgaWYgbmVjZXNzYXJ5XG5cdFx0dGhpcy5jb2xvciA9IHRoaXMuX2NvbG9yOyAvL3NldHRlciBzZXRzIGNvbG9yIHVuaWZvcm1cblx0XHR0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gdGhpcy5fb3BhY2l0eTtcblx0XHR0aGlzLl91bmlmb3Jtcy5ncmlkU3F1YXJlcy52YWx1ZSA9IHRoaXMuX2dyaWRTcXVhcmVzO1xuXHRcdHRoaXMuX3VuaWZvcm1zLnNob3dHcmlkLnZhbHVlID0gdGhpcy5fc2hvd0dyaWQgPyAxIDogMDtcblx0XHR0aGlzLl91bmlmb3Jtcy5zaG93U29saWQudmFsdWUgPSB0aGlzLl9zaG93U29saWQgPyAxIDogMDtcblx0XHR0aGlzLl91bmlmb3Jtcy5saW5lV2lkdGgudmFsdWUgPSB0aGlzLl9ncmlkTGluZVdpZHRoO1xuXG5cdFx0aWYoIXRoaXMuc2hvd1NvbGlkKXRoaXMubWF0ZXJpYWwudHJhbnNwYXJlbnQgPSB0cnVlO1xuXG5cdFx0dGhyZWVFbnZpcm9ubWVudC5zY2VuZS5hZGQodGhpcy5tZXNoKTtcblx0fVxuXHRtYWtlR2VvbWV0cnkoKXtcblxuXHRcdGxldCBNQVhfUE9JTlRTID0gMTAwMDA7XG5cblx0XHR0aGlzLl92ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMpO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KE1BWF9QT0lOVFMgKiAzKTtcblx0XHR0aGlzLl91dnMgPSBuZXcgRmxvYXQzMkFycmF5KE1BWF9QT0lOVFMgKiAyKTtcblxuXHRcdC8vIGJ1aWxkIGdlb21ldHJ5XG5cblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdwb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl92ZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnbm9ybWFsJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX25vcm1hbHMsIDMgKSApO1xuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3V2JywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3V2cywgMiApICk7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vdXNlZCBkdXJpbmcgdXBkYXRlcyBhcyBhIHBvaW50ZXIgdG8gdGhlIGJ1ZmZlclxuXG5cdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IGZhbHNlO1xuXG5cdH1cblx0X3NldFVWcyh1dnMsIGluZGV4LCB1LCB2KXtcblxuXHR9XG5cdF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuICAgICAgICAvL3NldHVwIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLml0ZW1EaW1lbnNpb25zLiB1c2VkIGhlcmUgYWdhaW4gYmVjYXVzZSBjbG9uaW5nIG1lYW5zIHRoZSBvbkFkZCgpIG1pZ2h0IGJlIGNhbGxlZCBiZWZvcmUgdGhpcyBpcyBjb25uZWN0ZWQgdG8gYSB0eXBlIG9mIGRvbWFpblxuXG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIERvbWFpbk5vZGUgd2UncmUgcmVuZGVyaW5nIGZyb21cblx0XHRsZXQgcm9vdCA9IHRoaXMuZ2V0Q2xvc2VzdERvbWFpbigpO1xuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IHJvb3QuaXRlbURpbWVuc2lvbnM7XG5cblx0XHQvLyBwZXJoYXBzIGluc3RlYWQgb2YgZ2VuZXJhdGluZyBhIHdob2xlIG5ldyBhcnJheSwgdGhpcyBjYW4gcmV1c2UgdGhlIG9sZCBvbmU/XG5cdFx0bGV0IHZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMpO1xuXHRcdGxldCBub3JtYWxzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIDMpO1xuXHRcdGxldCB1dnMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogMik7XG5cblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdHRoaXMuX3ZlcnRpY2VzID0gdmVydGljZXM7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdmVydGljZXMpO1xuXHRcdHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblxuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHR0aGlzLl9ub3JtYWxzID0gbm9ybWFscztcblx0XHRub3JtYWxBdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fbm9ybWFscyk7XG5cdFx0bm9ybWFsQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblxuXHRcdGxldCB1dkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMudXY7XG5cblxuXHRcdC8vYXNzZXJ0IHRoaXMuaXRlbURpbWVuc2lvbnNbMF0gKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdID0gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gYW5kIHRoaXMuX291dHB1dERpbWVuc2lvbnMgPT0gMlxuXHRcdHZhciBpbmRpY2VzID0gW107XG5cblx0XHQvL3JlbmRlcmVkIHRyaWFuZ2xlIGluZGljZXNcblx0XHQvL2Zyb20gdGhyZWUuanMgUGxhbmVHZW9tZXRyeS5qc1xuXHRcdGxldCBiYXNlID0gMDtcblx0XHRsZXQgaT0wLCBqPTA7XG5cdFx0Zm9yKGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMTtqKyspe1xuXHRcdFx0Zm9yKGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMTtpKyspe1xuXG5cdFx0XHRcdGxldCBhID0gaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRsZXQgYiA9IGkgKyAoaisxKSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBjID0gKGkrMSkrIChqKzEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGQgPSAoaSsxKSsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cbiAgICAgICAgXHRcdGluZGljZXMucHVzaChhLCBiLCBkKTtcblx0XHRcdFx0aW5kaWNlcy5wdXNoKGIsIGMsIGQpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly9kb3VibGUgc2lkZWQgcmV2ZXJzZSBmYWNlc1xuICAgICAgICBcdFx0aW5kaWNlcy5wdXNoKGQsIGIsIGEpO1xuXHRcdFx0XHRpbmRpY2VzLnB1c2goZCwgYywgYik7XG5cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL25vcm1hbHMgKHdpbGwgYmUgb3ZlcndyaXR0ZW4gbGF0ZXIpIGFuZCB1dnNcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtqKyspe1xuXHRcdFx0Zm9yKGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aSsrKXtcblxuXHRcdFx0XHRsZXQgcG9pbnRJbmRleCA9IGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0Ly9zZXQgbm9ybWFsIHRvIFswLDAsMV0gYXMgYSB0ZW1wb3JhcnkgdmFsdWVcblx0XHRcdFx0bm9ybWFsc1socG9pbnRJbmRleCkqM10gPSAwO1xuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozKzFdID0gMDtcblx0XHRcdFx0bm9ybWFsc1socG9pbnRJbmRleCkqMysyXSA9IDE7XG5cblx0XHRcdFx0Ly91dnNcblx0XHRcdFx0dXZzWyhwb2ludEluZGV4KSoyXSA9IGovKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSk7XG5cdFx0XHRcdHV2c1socG9pbnRJbmRleCkqMisxXSA9IGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fdXZzID0gdXZzO1xuXHRcdHV2QXR0cmlidXRlLnNldEFycmF5KHRoaXMuX3V2cyk7XG5cdFx0dXZBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fZ2VvbWV0cnkuc2V0SW5kZXgoIGluZGljZXMgKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXG5cdFx0Ly9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuXG5cdFx0Ly9hc3NlcnQgaSA8IHZlcnRpY2VzLmNvdW50XG5cblx0XHRsZXQgaW5kZXggPSB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuXG5cdFx0aWYoeCAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4XSA9IHg7XG5cdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdID0geTtcblx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMl0gPSB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fcmVjYWxjTm9ybWFscygpO1xuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3Jlc2V0IGFmdGVyIGVhY2ggdXBkYXRlXG5cdH1cblx0X3JlY2FsY05vcm1hbHMoKXtcblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdGxldCBub3JtYWxBdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLm5vcm1hbDtcblx0XHQvL3JlbmRlcmVkIHRyaWFuZ2xlIGluZGljZXNcblx0XHQvL2Zyb20gdGhyZWUuanMgUGxhbmVHZW9tZXRyeS5qc1xuXHRcdGxldCBub3JtYWxWZWMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdGxldCBwYXJ0aWFsWCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0bGV0IHBhcnRpYWxZID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuXHRcdGxldCBiYXNlID0gMDtcblx0XHRsZXQgbmVnYXRpb25GYWN0b3IgPSAxO1xuXHRcdGxldCBpPTAsIGo9MDtcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtqKyspe1xuXHRcdFx0Zm9yKGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aSsrKXtcblxuXHRcdFx0XHQvL2N1cnJlbnRseSBkb2luZyB0aGUgbm9ybWFsIGZvciB0aGUgcG9pbnQgYXQgaW5kZXggYS5cblx0XHRcdFx0bGV0IGEgPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBiLGM7XG5cblx0XHRcdFx0Ly9UYW5nZW50cyBhcmUgY2FsY3VsYXRlZCB3aXRoIGZpbml0ZSBkaWZmZXJlbmNlcyAtIEZvciAoeCx5KSwgY29tcHV0ZSB0aGUgcGFydGlhbCBkZXJpdmF0aXZlcyB1c2luZyAoeCsxLHkpIGFuZCAoeCx5KzEpIGFuZCBjcm9zcyB0aGVtLiBCdXQgaWYgeW91J3JlIGF0IHRoZWJvcmRlciwgeCsxIGFuZCB5KzEgbWlnaHQgbm90IGV4aXN0LiBTbyBpbiB0aGF0IGNhc2Ugd2UgZ28gYmFja3dhcmRzIGFuZCB1c2UgKHgtMSx5KSBhbmQgKHgseS0xKSBpbnN0ZWFkLlxuXHRcdFx0XHQvL1doZW4gdGhhdCBoYXBwZW5zLCB0aGUgdmVjdG9yIHN1YnRyYWN0aW9uIHdpbGwgc3VidHJhY3QgdGhlIHdyb25nIHdheSwgaW50cm9kdWNpbmcgYSBmYWN0b3Igb2YgLTEgaW50byB0aGUgY3Jvc3MgcHJvZHVjdCB0ZXJtLiBTbyBuZWdhdGlvbkZhY3RvciBrZWVwcyB0cmFjayBvZiB3aGVuIHRoYXQgaGFwcGVucyBhbmQgaXMgbXVsdGlwbGllZCBhZ2FpbiB0byBjYW5jZWwgaXQgb3V0LlxuXHRcdFx0XHRuZWdhdGlvbkZhY3RvciA9IDE7IFxuXG5cdFx0XHRcdC8vYiBpcyB0aGUgaW5kZXggb2YgdGhlIHBvaW50IDEgYXdheSBpbiB0aGUgeSBkaXJlY3Rpb25cblx0XHRcdFx0aWYoaSA8IHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSl7XG5cdFx0XHRcdFx0YiA9IChpKzEpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdC8vZW5kIG9mIHRoZSB5IGF4aXMsIGdvIGJhY2t3YXJkcyBmb3IgdGFuZ2VudHNcblx0XHRcdFx0XHRiID0gKGktMSkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0XHRuZWdhdGlvbkZhY3RvciAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vYyBpcyB0aGUgaW5kZXggb2YgdGhlIHBvaW50IDEgYXdheSBpbiB0aGUgeCBkaXJlY3Rpb25cblx0XHRcdFx0aWYoaiA8IHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSl7XG5cdFx0XHRcdFx0YyA9IGkgKyAoaisxKSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdC8vZW5kIG9mIHRoZSB4IGF4aXMsIGdvIGJhY2t3YXJkcyBmb3IgdGFuZ2VudHNcblx0XHRcdFx0XHRjID0gaSArIChqLTEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0XHRuZWdhdGlvbkZhY3RvciAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vdGhlIHZlY3RvciBiLWEuIFxuXHRcdFx0XHQvL3RoaXMuX3ZlcnRpY2VzIHN0b3JlcyB0aGUgY29tcG9uZW50cyBvZiBlYWNoIHZlY3RvciBpbiBvbmUgYmlnIGZsb2F0MzJhcnJheSwgc28gdGhpcyBwdWxscyB0aGVtIG91dCBhbmQganVzdCBkb2VzIHRoZSBzdWJ0cmFjdGlvbiBudW1lcmljYWxseS4gVGhlIGNvbXBvbmVudHMgb2YgdmVjdG9yICM1MiBhcmUgeDo1MiozKzAseTo1MiozKzEsejo1MiozKzIsIGZvciBleGFtcGxlLlxuXHRcdFx0XHRwYXJ0aWFsWS5zZXQodGhpcy5fdmVydGljZXNbYiozXS10aGlzLl92ZXJ0aWNlc1thKjNdLHRoaXMuX3ZlcnRpY2VzW2IqMysxXS10aGlzLl92ZXJ0aWNlc1thKjMrMV0sdGhpcy5fdmVydGljZXNbYiozKzJdLXRoaXMuX3ZlcnRpY2VzW2EqMysyXSk7XG5cdFx0XHRcdC8vdGhlIHZlY3RvciBjLWEuXG5cdFx0XHRcdHBhcnRpYWxYLnNldCh0aGlzLl92ZXJ0aWNlc1tjKjNdLXRoaXMuX3ZlcnRpY2VzW2EqM10sdGhpcy5fdmVydGljZXNbYyozKzFdLXRoaXMuX3ZlcnRpY2VzW2EqMysxXSx0aGlzLl92ZXJ0aWNlc1tjKjMrMl0tdGhpcy5fdmVydGljZXNbYSozKzJdKTtcblxuXHRcdFx0XHQvL2ItYSBjcm9zcyBjLWFcblx0XHRcdFx0bm9ybWFsVmVjLmNyb3NzVmVjdG9ycyhwYXJ0aWFsWCxwYXJ0aWFsWSkubm9ybWFsaXplKCk7XG5cdFx0XHRcdG5vcm1hbFZlYy5tdWx0aXBseVNjYWxhcihuZWdhdGlvbkZhY3Rvcik7XG5cdFx0XHRcdC8vc2V0IG5vcm1hbFxuXHRcdFx0XHR0aGlzLl9ub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjNdID0gbm9ybWFsVmVjLng7XG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqMysxXSA9IG5vcm1hbFZlYy55O1xuXHRcdFx0XHR0aGlzLl9ub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjMrMl0gPSBub3JtYWxWZWMuejtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gZG9uJ3QgZm9yZ2V0IHRvIG5vcm1hbEF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWUgYWZ0ZXIgY2FsbGluZyB0aGlzIVxuXHR9XG5cdHNldCBjb2xvcihjb2xvcil7XG5cdFx0Ly9jdXJyZW50bHkgb25seSBhIHNpbmdsZSBjb2xvciBpcyBzdXBwb3J0ZWQuXG5cdFx0Ly9JIHNob3VsZCByZWFsbHkgbWFrZSB0aGlzIGEgZnVuY3Rpb25cblx0XHR0aGlzLl9jb2xvciA9IGNvbG9yO1xuXHRcdHRoaXMuX3VuaWZvcm1zLmNvbG9yLnZhbHVlID0gbmV3IFRIUkVFLkNvbG9yKGNvbG9yKTtcblx0fVxuXHRnZXQgY29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3I7XG5cdH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0dGhpcy5tYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcblx0XHR0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG5cdFx0dGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgICAgIHRoaXMuX3VuaWZvcm1zLm9wYWNpdHkudmFsdWUgPSBvcGFjaXR5O1xuXHR9XG5cdGdldCBvcGFjaXR5KCl7XG5cdFx0cmV0dXJuIHRoaXMuX29wYWNpdHk7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IFN1cmZhY2VPdXRwdXQoe2NvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG5leHBvcnQge1N1cmZhY2VPdXRwdXR9O1xuIiwidmFyIGV4cGxhbmFyaWFuQXJyb3dTVkcgPSBcImRhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEQ5NGJXd2dkbVZ5YzJsdmJqMGlNUzR3SWlCbGJtTnZaR2x1WnowaVZWUkdMVGdpSUhOMFlXNWtZV3h2Ym1VOUltNXZJajgrQ2p3aExTMGdRM0psWVhSbFpDQjNhWFJvSUVsdWEzTmpZWEJsSUNob2RIUndPaTh2ZDNkM0xtbHVhM05qWVhCbExtOXlaeThwSUMwdFBnb0tQSE4yWndvZ0lDQjRiV3h1Y3pwa1l6MGlhSFIwY0RvdkwzQjFjbXd1YjNKbkwyUmpMMlZzWlcxbGJuUnpMekV1TVM4aUNpQWdJSGh0Ykc1ek9tTmpQU0pvZEhSd09pOHZZM0psWVhScGRtVmpiMjF0YjI1ekxtOXlaeTl1Y3lNaUNpQWdJSGh0Ykc1ek9uSmtaajBpYUhSMGNEb3ZMM2QzZHk1M015NXZjbWN2TVRrNU9TOHdNaTh5TWkxeVpHWXRjM2x1ZEdGNExXNXpJeUlLSUNBZ2VHMXNibk02YzNablBTSm9kSFJ3T2k4dmQzZDNMbmN6TG05eVp5OHlNREF3TDNOMlp5SUtJQ0FnZUcxc2JuTTlJbWgwZEhBNkx5OTNkM2N1ZHpNdWIzSm5Mekl3TURBdmMzWm5JZ29nSUNCNGJXeHVjenA0YkdsdWF6MGlhSFIwY0RvdkwzZDNkeTUzTXk1dmNtY3ZNVGs1T1M5NGJHbHVheUlLSUNBZ2VHMXNibk02YzI5a2FYQnZaR2s5SW1oMGRIQTZMeTl6YjJScGNHOWthUzV6YjNWeVkyVm1iM0puWlM1dVpYUXZSRlJFTDNOdlpHbHdiMlJwTFRBdVpIUmtJZ29nSUNCNGJXeHVjenBwYm10elkyRndaVDBpYUhSMGNEb3ZMM2QzZHk1cGJtdHpZMkZ3WlM1dmNtY3ZibUZ0WlhOd1lXTmxjeTlwYm10elkyRndaU0lLSUNBZ2QybGtkR2c5SWpJd01DSUtJQ0FnYUdWcFoyaDBQU0l4TXpBaUNpQWdJSFpwWlhkQ2IzZzlJakFnTUNBeU1EQWdNVE13SWdvZ0lDQnBaRDBpYzNabk1pSUtJQ0FnZG1WeWMybHZiajBpTVM0eElnb2dJQ0JwYm10elkyRndaVHAyWlhKemFXOXVQU0l3TGpreElISXhNemN5TlNJS0lDQWdjMjlrYVhCdlpHazZaRzlqYm1GdFpUMGlSWGh3YkdGdVlYSnBZVzVPWlhoMFFYSnliM2N1YzNabklqNEtJQ0E4WkdWbWN6NEtQSEpoWkdsaGJFZHlZV1JwWlc1MElHbGtQU0poSWlCamVEMGlOVEF3SWlCamVUMGlOakkzTGpjeElpQnlQU0l5TkRJdU16VWlJR2R5WVdScFpXNTBWSEpoYm5ObWIzSnRQU0p0WVhSeWFYZ29NQ0F1TWprM01ESWdMVE11T0RNNU1TQXRNUzR4T1RNeFpTMDRJREkwTURndU1TQTRNemd1T0RVcElpQm5jbUZrYVdWdWRGVnVhWFJ6UFNKMWMyVnlVM0JoWTJWUGJsVnpaU0krQ2p4emRHOXdJSE4wYjNBdFkyOXNiM0k5SWlOaVl6Y3pNVGtpSUc5bVpuTmxkRDBpTUNJdlBnbzhjM1J2Y0NCemRHOXdMV052Ykc5eVBTSWpaakJrTWpZeklpQnZabVp6WlhROUlqRWlMejRLUEM5eVlXUnBZV3hIY21Ga2FXVnVkRDRLUEM5a1pXWnpQZ284YldWMFlXUmhkR0UrQ2p4eVpHWTZVa1JHUGdvOFkyTTZWMjl5YXlCeVpHWTZZV0p2ZFhROUlpSStDanhrWXpwbWIzSnRZWFErYVcxaFoyVXZjM1puSzNodGJEd3ZaR002Wm05eWJXRjBQZ284WkdNNmRIbHdaU0J5WkdZNmNtVnpiM1Z5WTJVOUltaDBkSEE2THk5d2RYSnNMbTl5Wnk5a1l5OWtZMjFwZEhsd1pTOVRkR2xzYkVsdFlXZGxJaTgrQ2p4a1l6cDBhWFJzWlM4K0Nqd3ZZMk02VjI5eWF6NEtQQzl5WkdZNlVrUkdQZ284TDIxbGRHRmtZWFJoUGdvOFp5QjBjbUZ1YzJadmNtMDlJblJ5WVc1emJHRjBaU2d3SUMwNU1qSXVNellwSWo0S1BIQmhkR2dnWkQwaWJURTVOeTQwTnlBNU9EY3VNelpqTUMweU5DNHlPREV0T0RjdU1qWXhMVFl4TGpjd09DMDROeTR5TmpFdE5qRXVOekE0ZGpJNUxqWTVOR3d0TVRNdU5UWXpJREF1TXpjNU5HTXRNVE11TlRZeklEQXVNemM1TXprdE5qSXVNakF5SURJdU9ESTNNUzAzTkM0NE1URWdOeTQ1TmpVM0xURXlMall3T1NBMUxqRXpPRFl0TVRrdU16QXhJREUwTGpZNU5TMHhPUzR6TURFZ01qTXVOalk1SURBZ09DNDVOek00SURNdU9UY3pOU0F4T0M0eE5qTWdNVGt1TXpBeElESXpMalkyT1NBeE5TNHpNamNnTlM0MU1EVTFJRFl4TGpJME9DQTNMalU0TmpNZ056UXVPREV4SURjdU9UWTFOMnd4TXk0MU5qTWdNQzR6TnprMGRqSTVMalk1TkhNNE55NHlOakV0TXpjdU5ESTRJRGczTGpJMk1TMDJNUzQzTURoNklpQm1hV3hzUFNKMWNtd29JMkVwSWlCemRISnZhMlU5SWlNM016VTFNMlFpSUhOMGNtOXJaUzEzYVdSMGFEMGlNaTQyTWpnMUlpOCtDanhuSUhSeVlXNXpabTl5YlQwaWJXRjBjbWw0S0RBZ0xqSTJNamcxSUMwdU1qWXlPRFVnTUNBeE56Z3VNVE1nT0RZd0xqQXhLU0lnYzNSeWIydGxQU0lqTURBd0lpQnpkSEp2YTJVdGQybGtkR2c5SWpFd0lqNEtQR1ZzYkdsd2MyVWdZM2c5SWpVME55NHhOQ0lnWTNrOUlqRXlNQzQ1TXlJZ2NuZzlJakkxTGpjeE5DSWdjbms5SWpVeExqUXlPU0lnWm1sc2JEMGlJMlptWmlJdlBnbzhaV3hzYVhCelpTQmplRDBpTlRNMExqTTNJaUJqZVQwaU1USXpMalV6SWlCeWVEMGlNVEl1TmpJM0lpQnllVDBpTWpZdU1qWTBJaTgrQ2p3dlp6NEtQR2NnZEhKaGJuTm1iM0p0UFNKdFlYUnlhWGdvTUNBdExqSTJNamcxSUMwdU1qWXlPRFVnTUNBeE56Z3VOallnTVRFeE5DNDNLU0lnYzNSeWIydGxQU0lqTURBd0lpQnpkSEp2YTJVdGQybGtkR2c5SWpFd0lqNEtQR1ZzYkdsd2MyVWdZM2c5SWpVME55NHhOQ0lnWTNrOUlqRXlNQzQ1TXlJZ2NuZzlJakkxTGpjeE5DSWdjbms5SWpVeExqUXlPU0lnWm1sc2JEMGlJMlptWmlJdlBnbzhaV3hzYVhCelpTQmplRDBpTlRNMExqTTNJaUJqZVQwaU1USXpMalV6SWlCeWVEMGlNVEl1TmpJM0lpQnllVDBpTWpZdU1qWTBJaTgrQ2p3dlp6NEtQQzluUGdvOEwzTjJaejRLXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGV4cGxhbmFyaWFuQXJyb3dTVkc7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLypUaGlzIGNsYXNzIGlzIHN1cHBvc2VkIHRvIHR1cm4gYSBzZXJpZXMgb2ZcbmRpci5kZWxheSgpXG5kaXIudHJhbnNpdGlvblRvKC4uLilcbmRpci5kZWxheSgpXG5kaXIubmV4dFNsaWRlKCk7XG5cbmludG8gYSBzZXF1ZW5jZSB0aGF0IG9ubHkgYWR2YW5jZXMgd2hlbiB0aGUgcmlnaHQgYXJyb3cgaXMgcHJlc3NlZC5cblxuQW55IGRpdnMgd2l0aCB0aGUgZXhwLXNsaWRlIGNsYXNzIHdpbGwgYWxzbyBiZSBzaG93biBhbmQgaGlkZGVuIG9uZSBieSBvbmUuXG5cbiovXG5cbmltcG9ydCB7QW5pbWF0aW9ufSBmcm9tICcuL0FuaW1hdGlvbi5qcyc7XG5pbXBvcnQgZXhwbGFuYXJpYW5BcnJvd1NWRyBmcm9tICcuL0RpcmVjdG9ySW1hZ2VDb25zdGFudHMuanMnO1xuXG5jbGFzcyBEaXJlY3Rpb25BcnJvd3tcblx0Y29uc3RydWN0b3IoZmFjZVJpZ2h0KXtcblx0XHR0aGlzLmFycm93SW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLnNyYyA9IGV4cGxhbmFyaWFuQXJyb3dTVkc7XG5cbiAgICAgICAgdGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3dcIik7XG5cblx0XHRmYWNlUmlnaHQgPSBmYWNlUmlnaHQ9PT11bmRlZmluZWQgPyB0cnVlIDogZmFjZVJpZ2h0O1xuXG5cdFx0aWYoZmFjZVJpZ2h0KXtcblx0XHRcdHRoaXMuYXJyb3dJbWFnZS5jbGFzc0xpc3QuYWRkKFwiZXhwLWFycm93LXJpZ2h0XCIpXG5cdFx0fWVsc2V7XG5cdFx0XHR0aGlzLmFycm93SW1hZ2UuY2xhc3NMaXN0LmFkZChcImV4cC1hcnJvdy1sZWZ0XCIpXG5cdFx0fVxuXHRcdHRoaXMuYXJyb3dJbWFnZS5vbmNsaWNrID0gKGZ1bmN0aW9uKCl7XG5cdFx0XHR0aGlzLm9uY2xpY2soKTtcblx0XHR9KS5iaW5kKHRoaXMpO1xuXG5cdFx0dGhpcy5vbmNsaWNrQ2FsbGJhY2sgPSBudWxsOyAvLyB0byBiZSBzZXQgZXh0ZXJuYWxseVxuXHR9XG5cdG9uY2xpY2soKXtcblx0XHR0aGlzLmhpZGVTZWxmKCk7XG5cdFx0dGhpcy5vbmNsaWNrQ2FsbGJhY2soKTtcblx0fVxuXHRzaG93U2VsZigpe1xuXHRcdHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG5cdFx0dGhpcy5hcnJvd0ltYWdlLnN0eWxlLm9wYWNpdHkgPSAxO1xuXHRcdFxuXHR9XG5cdGhpZGVTZWxmKCl7XG5cdFx0dGhpcy5hcnJvd0ltYWdlLnN0eWxlLm9wYWNpdHkgPSAwO1xuXHRcdHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuXHR9XG59XG5cblxuY2xhc3MgTm9uRGVjcmVhc2luZ0RpcmVjdG9ye1xuXHQvLyBJIHdhbnQgRGlyZWN0b3IoKSB0byBiZSBhYmxlIHRvIGJhY2t0cmFjayBieSBwcmVzc2luZyBiYWNrd2FyZHMuIFRoaXMgZG9lc24ndCBkbyB0aGF0LlxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHR0aGlzLnVuZG9TdGFjayA9IFtdO1xuXHRcdHRoaXMudW5kb1N0YWNrSW5kZXggPSAwO1xuXG5cdFx0dGhpcy5zbGlkZXMgPSBbXTtcblx0XHR0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID0gMDtcblxuXHRcdHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gbnVsbDtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuXHR9XG5cblxuXHRhc3luYyBiZWdpbigpe1xuXHRcdGF3YWl0IHRoaXMud2FpdEZvclBhZ2VMb2FkKCk7XG4gICAgICAgIHRoaXMuc2xpZGVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZVwiKTtcblxuXHRcdHRoaXMucmlnaHRBcnJvdyA9IG5ldyBEaXJlY3Rpb25BcnJvdygpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yaWdodEFycm93LmFycm93SW1hZ2UpO1xuXHRcdGxldCBzZWxmID0gdGhpcztcblx0XHR0aGlzLnJpZ2h0QXJyb3cub25jbGlja0NhbGxiYWNrID0gZnVuY3Rpb24oKXtcblx0XHRcdHNlbGYuX2NoYW5nZVNsaWRlKDEsIGZ1bmN0aW9uKCl7fSk7IC8vIHRoaXMgZXJyb3JzIHdpdGhvdXQgdGhlIGVtcHR5IGZ1bmN0aW9uIGJlY2F1c2UgdGhlcmUncyBubyByZXNvbHZlLiBUaGVyZSBtdXN0IGJlIGEgYmV0dGVyIHdheSB0byBkbyB0aGluZ3MuXG5cdFx0XHRjb25zb2xlLndhcm4oXCJXQVJOSU5HOiBIb3JyaWJsZSBoYWNrIGluIGVmZmVjdCB0byBjaGFuZ2Ugc2xpZGVzLiBQbGVhc2UgcmVwbGFjZSB0aGUgcGFzcy1hbi1lbXB0eS1mdW5jdGlvbiB0aGluZyB3aXRoIHNvbWV0aGluZyB0aGF0IGFjdHVhbGx5IHJlc29sdmVzIHByb3Blcmx5IGFuZCBkb2VzIGFzeW5jLlwiKVxuXHRcdFx0c2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24oKTtcblx0XHR9XG5cbiAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG5cblx0fVxuXG5cdGFzeW5jIHdhaXRGb3JQYWdlTG9hZCgpe1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0Ly93aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIixyZXNvbHZlKTtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsMSk7XG5cdFx0XHRyZXNvbHZlKClcblx0XHR9KTtcblx0fVxuXG5cdHNob3dTbGlkZShzbGlkZU51bWJlcil7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnNsaWRlcy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuc2xpZGVzW2ldLnN0eWxlLm9wYWNpdHkgPSAwO1xuXHRcdH1cblx0XHR0aGlzLnNsaWRlc1tzbGlkZU51bWJlcl0uc3R5bGUub3BhY2l0eSA9IDE7XG5cdH1cblxuXHRhc3luYyBuZXh0U2xpZGUoKXtcbiAgICAgICAgaWYoIXRoaXMuaW5pdGlhbGl6ZWQpdGhyb3cgbmV3IEVycm9yKFwiRVJST1I6IFVzZSAuYmVnaW4oKSBvbiBhIERpcmVjdG9yIGJlZm9yZSBjYWxsaW5nIGFueSBvdGhlciBtZXRob2RzIVwiKTtcblxuXHRcdGxldCBzZWxmID0gdGhpcztcblxuXHRcdHRoaXMucmlnaHRBcnJvdy5zaG93U2VsZigpO1xuXHRcdC8vcHJvbWlzZSBpcyByZXNvbHZlZCBieSBjYWxsaW5nIHRoaXMubmV4dFNsaWRlUHJvbWlzZS5yZXNvbHZlKCkgd2hlbiB0aGUgdGltZSBjb21lc1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0XHRmdW5jdGlvbiBrZXlMaXN0ZW5lcihlKXtcblx0XHRcdFx0aWYoZS5yZXBlYXQpcmV0dXJuOyAvL2tleWRvd24gZmlyZXMgbXVsdGlwbGUgdGltZXMgYnV0IHdlIG9ubHkgd2FudCB0aGUgZmlyc3Qgb25lXG5cdFx0XHRcdGxldCBzbGlkZURlbHRhID0gMDtcblx0XHRcdFx0c3dpdGNoIChlLmtleUNvZGUpIHtcblx0XHRcdFx0ICBjYXNlIDM0OlxuXHRcdFx0XHQgIGNhc2UgMzk6XG5cdFx0XHRcdCAgY2FzZSA0MDpcblx0XHRcdFx0XHRzbGlkZURlbHRhID0gMTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0ICBkZWZhdWx0OlxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKHNsaWRlRGVsdGEgIT0gMCl7XG5cdFx0XHRcdFx0c2VsZi5fY2hhbmdlU2xpZGUoc2xpZGVEZWx0YSwgcmVzb2x2ZSk7XG5cdFx0XHRcdFx0c2VsZi5yaWdodEFycm93LmhpZGVTZWxmKCk7XG5cdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsa2V5TGlzdGVuZXIpOyAvL3RoaXMgYXBwcm9hY2ggdGFrZW4gZnJvbSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNTcxODY0NS9yZXNvbHZpbmctYS1wcm9taXNlLXdpdGgtZXZlbnRsaXN0ZW5lclxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBrZXlMaXN0ZW5lcik7XG5cdFx0XHQvL2hvcnJpYmxlIGhhY2sgc28gdGhhdCB0aGUgJ25leHQgc2xpZGUnIGFycm93IGNhbiB0cmlnZ2VyIHRoaXMgdG9vXG5cdFx0XHRzZWxmLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IGZ1bmN0aW9uKCl7IFxuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLGtleUxpc3RlbmVyKTsgXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblx0X2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpe1xuXHRcdFx0Ly9zbGlkZSBjaGFuZ2luZyBsb2dpY1xuXG5cblx0XHQvL3JpZ2h0IG5vdyB0aGVyZSBpcyBhIHByb2JsZW0uIEdvaW5nIGJhY2t3YXJkcyBzaG91bGQgbm90IHJlc29sdmUgdGhlIHByb21pc2U7IG9ubHkgZ29pbmcgdG8gdGhlIG1vc3QgcmVjZW50IHNsaWRlIGFuZCBwcmVzc2luZyByaWdodCBzaG91bGQuXG5cdFx0aWYoc2xpZGVEZWx0YSAhPSAwKXtcblx0XHRcdGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gMCAmJiBzbGlkZURlbHRhID09IC0xKXtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA9PSB0aGlzLnNsaWRlcy5sZW5ndGgtMSAmJiBzbGlkZURlbHRhID09IDEpe1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmN1cnJlbnRTbGlkZUluZGV4ICs9IHNsaWRlRGVsdGE7XG5cdFx0XHR0aGlzLnNob3dTbGlkZSh0aGlzLmN1cnJlbnRTbGlkZUluZGV4KTtcblx0XHRcdHJlc29sdmUoKTtcblx0XHR9XG5cdH1cblx0Ly92ZXJic1xuXHRhc3luYyBkZWxheSh3YWl0VGltZSl7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCB3YWl0VGltZSk7XG5cdFx0fSk7XG5cdH1cblx0VHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMpe1xuXHRcdC8vRVhQLlV0aWxzLkFzc2VydCh0aGlzLnVuZG9TdGFja0luZGV4ID09IDApOyAvL1RoaXMgbWF5IG5vdCB3b3JrIHdlbGwuXG5cdFx0bmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDApO1xuXHR9XG59XG4vKlxuY2xhc3MgRGlyZWN0b3J7XG5cdC8vdG9kby4gTWFrZSB0aGlzIGFibGUgdG8gYmFja3RyYWNrXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHRoaXMudW5kb1N0YWNrID0gW107XG5cdFx0dGhpcy51bmRvU3RhY2tJbmRleCA9IDA7XG5cblx0XHR0aGlzLnNsaWRlcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJleHAtc2xpZGVcIik7XG5cdFx0dGhpcy5jdXJyZW50U2xpZGVJbmRleCA9IDA7XG5cdFx0Ly90aGlzLnNob3dTbGlkZSgwKTsgLy9mYWlscyBiZWNhdXNlIERPTSBpc24ndCBsb2FkZWQuXG5cdH1cblxuXHRhc3luYyB3YWl0Rm9yUGFnZUxvYWQoKXtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLHJlc29sdmUpO1xuXHRcdH0pO1xuXHR9XG5cblx0c2hvd1NsaWRlKHNsaWRlTnVtYmVyKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuc2xpZGVzLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5zbGlkZXNbaV0uc3R5bGUub3BhY2l0eSA9IDA7XG5cdFx0fVxuXHRcdHRoaXMuc2xpZGVzW3NsaWRlTnVtYmVyXS5zdHlsZS5vcGFjaXR5ID0gMTtcblx0fVxuXG5cdG5leHRTbGlkZSgpe1xuXHRcdGxldCBzZWxmID0gdGhpcztcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5cHJlc3NcIiwgZnVuY3Rpb24ga2V5TGlzdGVuZXIoZSl7XG5cdFx0XHRcdGxldCBzbGlkZURlbHRhID0gMDtcblx0XHRcdFx0c3dpdGNoIChlLmtleUNvZGUpIHtcblx0XHRcdFx0ICBjYXNlIDMzOlxuXHRcdFx0XHQgIGNhc2UgMzc6XG5cdFx0XHRcdCAgY2FzZSAzODpcblx0XHRcdFx0XHRzbGlkZURlbHRhID0gLTE7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdCAgY2FzZSAzNDpcblx0XHRcdFx0ICBjYXNlIDM5OlxuXHRcdFx0XHQgIGNhc2UgNDA6XG5cdFx0XHRcdFx0c2xpZGVEZWx0YSA9IDE7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fY2hhbmdlU2xpZGUoc2xpZGVEZWx0YSwgcmVzb2x2ZSk7XG5cdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5cHJlc3NcIixrZXlMaXN0ZW5lcik7IC8vdGhpcyBhcHByb2FjaCB0YWtlbiBmcm9tIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM1NzE4NjQ1L3Jlc29sdmluZy1hLXByb21pc2Utd2l0aC1ldmVudGxpc3RlbmVyXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXHRfY2hhbmdlU2xpZGUoc2xpZGVEZWx0YSwgcmVzb2x2ZSl7XG5cdFx0XHQvL3NsaWRlIGNoYW5naW5nIGxvZ2ljXG5cdFx0aWYoc2xpZGVEZWx0YSAhPSAwKXtcblx0XHRcdGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gMCAmJiBzbGlkZURlbHRhID09IC0xKXtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA9PSB0aGlzLnNsaWRlcy5sZW5ndGgtMSAmJiBzbGlkZURlbHRhID09IDEpe1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcdGNvbnNvbGUubG9nKHNsaWRlRGVsdGEsIHRoaXMuY3VycmVudFNsaWRlSW5kZXgpO1xuXHRcdFx0dGhpcy5jdXJyZW50U2xpZGVJbmRleCArPSBzbGlkZURlbHRhO1xuXHRcdFx0dGhpcy5zaG93U2xpZGUodGhpcy5jdXJyZW50U2xpZGVJbmRleCk7XG5cdFx0XHRyZXNvbHZlKCk7XG5cdFx0fVxuXHR9XG5cblx0Ly92ZXJic1xuXHRhc3luYyBkZWxheSh3YWl0VGltZSl7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCB3YWl0VGltZSk7XG5cdFx0fSk7XG5cdH1cblx0dHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMpe1xuXHRcdC8vRVhQLlV0aWxzLkFzc2VydCh0aGlzLnVuZG9TdGFja0luZGV4ID09IDApOyAvL1RoaXMgbWF5IG5vdCB3b3JrIHdlbGwuXG5cdFx0dmFyIGFuaW1hdGlvbiA9IG5ldyBFWFAuQW5pbWF0aW9uKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGR1cmF0aW9uTVMvMTAwMCk7XG5cdFx0bGV0IGZyb21WYWx1ZXMgPSBhbmltYXRpb24uZnJvbVZhbHVlcztcblx0XHR0aGlzLnVuZG9TdGFjay5wdXNoKG5ldyBFWFAuRGlyZWN0b3IuVW5kb0l0ZW0odGFyZ2V0LCB0b1ZhbHVlcywgZnJvbVZhbHVlcywgZHVyYXRpb25NUykpO1xuXHRcdHRoaXMudW5kb1N0YWNrSW5kZXgrKztcblx0fVxufVxuXG5FWFAuRGlyZWN0b3IuVW5kb0l0ZW0gPSBjbGFzcyBVbmRvSXRlbXtcblx0Y29uc3RydWN0b3IodGFyZ2V0LCB0b1ZhbHVlcywgZnJvbVZhbHVlcywgZHVyYXRpb25NUyl7XG5cdFx0dGhpcy50YXJnZXQgPSB0YXJnZXQ7XG5cdFx0dGhpcy50b1ZhbHVlcyA9IHRvVmFsdWVzO1xuXHRcdHRoaXMuZnJvbVZhbHVlcyA9IGZyb21WYWx1ZXM7XG5cdFx0dGhpcy5kdXJhdGlvbk1TID0gZHVyYXRpb25NUztcblx0fVxufSovXG5cbmV4cG9ydCB7IE5vbkRlY3JlYXNpbmdEaXJlY3RvciwgRGlyZWN0aW9uQXJyb3cgfTtcbiJdLCJuYW1lcyI6WyJNYXRoIiwiQXJlYSIsIlRyYW5zZm9ybWF0aW9uIiwidGhyZWVFbnZpcm9ubWVudCIsIm1hdGgubGVycFZlY3RvcnMiLCJyZXF1aXJlIiwicmVxdWlyZSQkMCIsInJlcXVpcmUkJDEiLCJyZXF1aXJlJCQyIiwiZ2xvYmFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Q0FBQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBOztDQUVBLE1BQU0sSUFBSTtDQUNWLENBQUMsV0FBVyxFQUFFO0NBQ2QsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztDQUNyQixFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0NBQ3JCLEtBQUs7Q0FDTCxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7Q0FDWDtDQUNBLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDNUIsRUFBRSxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztDQUN0QixFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7Q0FDakMsRUFBRSxPQUFPLEtBQUssQ0FBQztDQUNmLEVBQUU7Q0FDRixDQUFDLE1BQU0sRUFBRSxFQUFFO0NBQ1gsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0NBQ2QsRUFBRSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztDQUM3QyxFQUFFLEtBQUssS0FBSyxLQUFLLEVBQUUsQ0FBQyxHQUFHO0NBQ3ZCLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Q0FDdkIsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUM7Q0FDcEMsR0FBRztDQUNILEVBQUUsT0FBTyxJQUFJLENBQUM7Q0FDZCxFQUFFO0NBQ0YsSUFBSSxZQUFZLEVBQUU7Q0FDbEIsUUFBUSxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUM7Q0FDOUIsUUFBUSxJQUFJLFdBQVcsR0FBRyxDQUFDLENBQUM7Q0FDNUIsRUFB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RSxHQUFHLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO0NBQzdCLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDNUMsSUFBSSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEcsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7Q0FDbEIsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxJQUFJO0NBQ0osR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUM7Q0FDbkM7Q0FDQSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzVDLElBQUksSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3RHLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDN0MsS0FBSyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdkcsS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDOUMsS0FBSyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM5QyxLQUFLO0NBQ0wsSUFBSTtDQUNKLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO0NBQ25DO0NBQ0EsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM1QyxJQUFJLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN0RyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzdDLEtBQUssSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3ZHLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDOUMsTUFBTSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDeEcsTUFBTSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMs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Q0FFRDtDQUNBLFNBQVMsWUFBWSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLGVBQWUsQ0FBQztDQUNwRSxDQUFDLElBQUksU0FBUyxHQUFHLElBQUksU0FBUyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxLQUFLLFNBQVMsR0FBRyxTQUFTLEdBQUcsVUFBVSxDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztDQUMxSCxDQUFDOzs7Ozs7Ozs7Ozs7O0NDakhELENBQUMsWUFBWTs7RUFHWixJQUFJLE1BQU0sR0FBRztJQUNYLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLENBQUM7RUFDSCxTQUFTLEtBQUssQ0FBQyxNQUFNLEVBQUU7R0FDdEIsSUFBSSxDQUFDLEVBQUUsTUFBTSxHQUFHLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0dBQ3ZDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDL0IsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNkO0dBQ0QsT0FBTyxNQUFNLENBQUM7R0FDZDs7RUFFRCxTQUFTLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUU7R0FDcEQsSUFBSSxPQUFPLEdBQUcsTUFBTSxHQUFHLFNBQVM7SUFDL0IsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDOztHQUVuRSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDOztHQUVqQixPQUFPLE1BQU0sQ0FBQztHQUNkOztFQUVELFNBQVMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0dBQzlCLEdBQUcsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztHQUM5QixPQUFPLGNBQWMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBRyxFQUFFLEdBQUcsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDO0dBQzVEOztFQUVELFNBQVMsYUFBYSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFO0dBQzNDLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQzs7R0FFZCxHQUFHLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7O0dBRWpDLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxDQUFDO0dBQ3JCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDdEQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNaOztHQUVELE9BQU8sR0FBRyxDQUFDO0dBQ1g7O0VBRUQsU0FBUyxhQUFhLENBQUMsS0FBSyxFQUFFO0dBQzdCLElBQUksQ0FBQztJQUNKLFVBQVUsR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUM7SUFDN0IsTUFBTSxHQUFHLEVBQUU7SUFDWCxJQUFJLEVBQUUsTUFBTSxDQUFDOztHQUVkLFNBQVMsZUFBZSxFQUFFLEdBQUcsRUFBRTtJQUM5QixPQUFPLE1BQU0sQ0FBQyxHQUFHLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDMUc7O0dBR0QsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLFVBQVUsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDbkUsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMvRCxNQUFNLElBQUksZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hDOzs7R0FHRCxRQUFRLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQztJQUN4QixLQUFLLENBQUM7S0FDTCxNQUFNLElBQUksR0FBRyxDQUFDO0tBQ2QsTUFBTTtJQUNQLEtBQUssQ0FBQztLQUNMLE1BQU0sSUFBSSxJQUFJLENBQUM7S0FDZixNQUFNO0lBQ1A7S0FDQyxNQUFNO0lBQ1A7O0dBRUQsT0FBTyxNQUFNLENBQUM7R0FDZDs7RUFFRCxNQUFNLENBQUMsS0FBSyxHQUFHLEdBQUU7RUFDakIsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0VBQzNCLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztFQUN2QixNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7RUFDN0IsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO0VBQzNDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztFQUMzQyxFQUFFLEVBQUU7O0NBRUwsQ0FBQyxZQUFZOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7RUF5QlosSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUs7R0FDdkIsWUFBWSxDQUFDOztFQUVkLFlBQVksR0FBRztHQUNkO0lBQ0MsT0FBTyxFQUFFLFVBQVU7SUFDbkIsUUFBUSxFQUFFLEdBQUc7SUFDYjtHQUNEO0lBQ0MsT0FBTyxFQUFFLFVBQVU7SUFDbkIsUUFBUSxFQUFFLENBQUM7SUFDWDtHQUNEO0lBQ0MsT0FBTyxFQUFFLEtBQUs7SUFDZCxRQUFRLEVBQUUsQ0FBQztJQUNYO0dBQ0Q7SUFDQyxPQUFPLEVBQUUsS0FBSztJQUNkLFFBQVEsRUFBRSxDQUFDO0lBQ1g7R0FDRDtJQUNDLE9BQU8sRUFBRSxVQUFVO0lBQ25CLFFBQVEsRUFBRSxFQUFFO0lBQ1o7R0FDRDtJQUNDLE9BQU8sRUFBRSxPQUFPO0lBQ2hCLFFBQVEsRUFBRSxFQUFFO0lBQ1o7R0FDRDtJQUNDLE9BQU8sRUFBRSxVQUFVO0lBQ25CLFFBQVEsRUFBRSxDQUFDO0lBQ1g7R0FDRDtJQUNDLE9BQU8sRUFBRSxNQUFNO0lBQ2YsUUFBUSxFQUFFLENBQUM7SUFDWDtHQUNEO0lBQ0MsT0FBTyxFQUFFLFVBQVU7SUFDbkIsUUFBUSxFQUFFLEdBQUc7SUFDYjtHQUNEO0lBQ0MsT0FBTyxFQUFFLE9BQU87SUFDaEIsUUFBUSxFQUFFLENBQUM7SUFDWDtHQUNEO0lBQ0MsT0FBTyxFQUFFLE9BQU87SUFDaEIsUUFBUSxFQUFFLEVBQUU7SUFDWjtHQUNEO0lBQ0MsT0FBTyxFQUFFLE9BQU87SUFDaEIsUUFBUSxFQUFFLEVBQUU7SUFDWjtHQUNEO0lBQ0MsT0FBTyxFQUFFLGFBQWE7SUFDdEIsUUFBUSxFQUFFLENBQUM7SUFDWDtHQUNEO0lBQ0MsT0FBTyxFQUFFLGFBQWE7SUFDdEIsUUFBUSxFQUFFLENBQUM7SUFDWDtHQUNEO0lBQ0MsT0FBTyxFQUFFLGdCQUFnQjtJQUN6QixRQUFRLEVBQUUsR0FBRztJQUNiO0dBQ0Q7SUFDQyxPQUFPLEVBQUUsU0FBUztJQUNsQixRQUFRLEVBQUUsRUFBRTtJQUNaO0dBQ0QsQ0FBQzs7RUFFRixTQUFTLFlBQVksQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFO0dBQy9CLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO0lBQzVCLE1BQU0sR0FBRyxDQUFDLENBQUM7O0dBRVosWUFBWSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEtBQUssRUFBRTtJQUNyQyxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUU7S0FDaEMsQ0FBQyxFQUFFLE1BQU0sQ0FBQzs7SUFFWCxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO0tBQ3BELE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ25DLE1BQU0sSUFBSSxDQUFDLENBQUM7S0FDWjs7SUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDM0IsQ0FBQyxDQUFDOztHQUVILElBQUksT0FBTyxFQUFFLEtBQUssVUFBVSxFQUFFO0lBQzdCLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUMxQjtHQUNELE9BQU8sTUFBTSxDQUFDO0dBQ2Q7O0VBRUQsTUFBTSxDQUFDLE1BQU0sR0FBRyxHQUFFO0VBQ2xCLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLFlBQVksQ0FBQztFQUN2QyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxZQUFZLENBQUM7RUFDcEMsRUFBRSxFQUFFOztDQUVMLENBQUMsWUFBWTs7RUFHWixJQUFJLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTTtHQUN6QixLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUs7R0FDcEIsVUFBVSxHQUFHLEdBQUc7R0FDaEIsU0FBUyxDQUFDOztFQUVYLFNBQVMsR0FBRyxDQUFDLGVBQWUsRUFBRTtHQUM3QixJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztHQUNqQixTQUFTLEdBQUcsQ0FBQyxlQUFlLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQztHQUNqRCxJQUFJLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7R0FDbEMsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7R0FDakIsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7R0FDaEI7O0VBRUQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBVSxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7R0FDakUsSUFBSSxJQUFJO0lBQ1AsUUFBUTtJQUNSLElBQUk7SUFDSixLQUFLO0lBQ0wsR0FBRztJQUNILEdBQUc7SUFDSCxTQUFTLENBQUM7O0dBRVgsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7SUFDOUIsS0FBSyxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbkMsTUFBTSxJQUFJLEtBQUssQ0FBQyxXQUFXLEtBQUssVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUU7SUFDbEUsTUFBTSxtQ0FBbUMsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQy9IOztHQUVELElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0lBQy9CLFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDaEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNWOztHQUVELElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDOztHQUVsQixJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBSSxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztHQUMvQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztHQUNyRCxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7R0FDcEIsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDOztHQUVwQixJQUFJLEdBQUc7SUFDTixRQUFRLEVBQUUsUUFBUTtJQUNsQixRQUFRLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQzVCLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDdEIsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN0QixRQUFRLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztJQUNyQyxLQUFLLEVBQUUsS0FB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QUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBT0EsZUFBTyxFQUFFLFVBQVUsRUFBRUEsZUFBTyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxZQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxVQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxHQUFHLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLFlBQVksS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLHdDQUF3QyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxvQkFBbUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLCtDQUErQyxDQUFDLHFDQUFxQyxDQUFDLGtEQUFrRCxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxPQUFPLE9BQU8sQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsUUFBUSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUMsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxnQkFBZ0IsQ0FBQyxTQUFTLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBQyxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsT0FBTyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFVBQVUsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFFBQVEsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFFBQVEsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksVUFBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsR0FBRyxZQUFZLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBSyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEdBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBRyxJQUFJLEVBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLDRCQUE0QixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxBQUFtQixJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQUssQ0FBQyxDQUFDLE9BQU8sTUFBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFDLENBQUMsU0FBUyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFDLENBQUMsU0FBUyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLEdBQUcsU0FBUyxHQUFHLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLE1BQU0sUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBSyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsTUFBTSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsRUFBRSxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLEFBQXdCLElBQUksU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxjQUFjLENBQUMsRUFBRSxDQUFDLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsQUFBYSxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxJQUFJLGNBQWMsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxRQUFRLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksUUFBUSxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBUyxDQUFDLFNBQVMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQVksQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxXQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsU0FBUyxDQUFDLE9BQU8sV0FBVyxDQUFDLFNBQVMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsR0FBRyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVMsQ0FBQyxTQUFTLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxXQUFXLENBQUMsR0FBRyxFQUFFLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsUUFBUSxHQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsU0FBUyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsNkZBQTZGLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksR0FBRyxJQUFJLE1BQU0sQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUMsQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLEdBQUcsR0FBRyxHQUFHLE9BQU8sRUFBRSxHQUFHLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxhQUFhLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUMsQ0FBQyxHQUFHLE9BQU8sU0FBUyxHQUFHLFdBQVcsRUFBRSxTQUFTLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sd0JBQXdCLEdBQUcsV0FBVyxFQUFFLHdCQUF3QixHQUFHLElBQUksRUFBRSxLQUFLLFlBQVksd0JBQXdCLEVBQUUsT0FBTyxxQkFBcUIsR0FBRyxXQUFXLEVBQUUscUJBQXFCLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSxxQkFBcUIsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFLLENBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQU0sVUFBVSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE9BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxTQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBQyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxZQUFZLEVBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxHQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsTUFBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsR0FBRSxD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QVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDOUYsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDMUYsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDL0YsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7O0NBRTNGLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQzs7Q0FFNUU7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQzs7Q0FFcEUsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDOztDQUVoQyxDQUFDLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDOztDQUUzQixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLElBQUksZUFBZSxDQUFDLFdBQVcsQ0FBQztDQUNsRTtDQUNBLFFBQVEsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0NBQzFCLEtBQUs7Q0FDTCxDQUFDOztDQUVELG1CQUFtQixD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LENBQUMsU0FBUyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7Q0FDckUsbUJBQW1CLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxTQUFTLFFBQVEsQ0FBQztDQUN6RCxDQUFDLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztDQUNsRCxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDO0NBQzNCO0NBQ0EsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDbkQsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Q0FDcEUsRUFBRTs7Q0FFRixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDOztDQUVqRCxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUNuRCxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUNoQyxFQUFFOztDQUVGLENBQUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxRQUFRLENBQUM7Q0FDL0IsQ0FBQyxNQUFNLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztDQUN0RCxFQUFDO0NBQ0QsbUJBQW1CLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxTQUFTLFVBQVUsRUFBRSxJQUFJLENBQUM7Q0FDN0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLEdBQUcsVUFBVSxJQUFJLFFBQVEsQ0FBQztDQUMzQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ3RDLEVBQUUsS0FBSyxHQUFHLFVBQVUsSUFBSSxRQUFRLENBQUM7Q0FDakMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUN0QyxFQUFFLElBQUk7Q0FDTixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMscUJBQXFCLEVBQUM7Q0FDdEMsRUFBRTtDQUNGLEVBQUM7Q0FDRCxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxVQUFVLEVBQUUsSUFBSSxDQUFDO0NBQzlFO0NBQ0E7Q0FDQSxDQUFDLEdBQUcsVUFBVSxJQUFJLFFBQVEsQ0FBQztDQUMzQixFQUFFLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ3JELEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzNDLEVBQUUsTUFBTSxHQUFHLFVBQVUsSUFBSSxRQUFRLENBQUM7Q0FDbEMsRUFBRSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUNyRCxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMzQyxFQUFFLElBQUk7Q0FDTixFQUFFLE9BQU8s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LENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzFDLEVBQUVBLHdCQUFnQixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOztDQUV4QyxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDMUIsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzFCLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUMxQixFQUFFO0NBQ0YsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDVCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDM0IsRUFBRTtDQUNGLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ1QsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQzNCLEVBQUU7Q0FDRixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNULEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUMzQixFQUFFO0NBQ0YsQ0FBQyxJQUFJLENBQUMsRUFBRTtDQUNSLEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Q0FDOUIsRUFBRTtDQUNGLENBQUMsSUFBSSxDQUFDLEVBQUU7Q0FDUixFQUFFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0NBQzlCLEVBQUU7Q0FDRixDQUFDLElBQUksQ0FBQyxFQUFFO0NBQ1IsRUFBRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMs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QUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzs7Q0FFeEM7Q0FDQSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMzQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQzs7Q0FFWjtDQUNBO0NBQ0EsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDOztDQUV2QjtDQUNBLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLEtBQUssSUFBSTtDQUNUO0NBQ0EsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLEtBQUssY0FBYyxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQzFCLEtBQUs7O0NBRUw7Q0FDQSxJQUFJLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3BDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxLQUFLLElBQUk7Q0FDVDtDQUNBLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QyxLQUFLLGNBQWMsSUFBSSxDQUFDLENBQUMsQ0FBQztDQUMxQixLQUFLOztDQUVMO0NBQ0E7Q0FDQSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDbEo7Q0FDQSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0NBRWxKO0NBQ0EsSUFBSSxTQUFTLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztDQUMxRCxJQUFJLFNBQVMsQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLENBQUM7Q0FDN0M7Q0FDQSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUks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
