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
		this.trueElapsedTime = 0;

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
	    removeSelfFromScene(){
	        exports.threeEnvironment.scene.remove(this.mesh);
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
	    removeSelfFromScene(){
			for(var i=0;i<this.points.length;i++){
				this.points[i].removeSelfFromScene();
			}
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
					opacity: number
					color: hex code or THREE.Color()
					showGrid: boolean. If true, will display a grid over the surface. Default: true
					showSolid: boolean. If true, will display a solid surface. Default: true
					gridSquares: number representing how many squares per dimension to use in a rendered grid
					gridLineWidth: number representing how many squares per dimension to use in a rendered grid
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
	    removeSelfFromScene(){
	        exports.threeEnvironment.scene.remove(this.mesh);
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
			this.slides = [];
			this.currentSlideIndex = 0;        
	        this.numSlides = 0;

			this.nextSlideResolveFunction = null;
	        this.initialized = false;
		}


		async begin(){
			await this.waitForPageLoad();
	        this.slides = document.getElementsByClassName("exp-slide");
	        this.numSlides = this.slides.length;

	        //hide all slides except first one
			for(var i=0;i<this.numSlides;i++){
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

	        this.showSlide(0); //unhide first one

			this.rightArrow = new DirectionArrow();
			document.body.appendChild(this.rightArrow.arrowImage);
			this.rightArrow.onclickCallback = function(){
				self._changeSlide(1, function(){}); // this errors without the empty function because there's no resolve. There must be a better way to do things.
				console.warn("WARNING: Horrible hack in effect to change slides. Please replace the pass-an-empty-function thing with something that actually resolves properly and does async.");
				self.nextSlideResolveFunction();
			};

	        this.initialized = true;

		}

		async waitForPageLoad(){
			return new Promise(function(resolve, reject){
	            if(document.readyState == 'complete'){
	                resolve();
	            }
				window.addEventListener("DOMContentLoaded",resolve);
			});
		}

		showSlide(slideNumber){
			for(var i=0;i<this.numSlides;i++){
				if(i != slideNumber)this.slides[i].style.opacity = 0;
			}
	        if(slideNumber >= this.numSlides){
	            console.error("Tried to show slide #"+slideNumber+", but only " + this.numSlides + "HTML elements with exp-slide were found! Make more slides?");
	            return;
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
					return; //no going past the beginning
				}
				if(this.currentSlideIndex == this.slides.length-1 && slideDelta == 1){
					return; //no going past the end
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

			this.leftArrow = new DirectionArrow(false);
			document.body.appendChild(this.leftArrow.arrowImage);
			this.leftArrow.onclickCallback = function(){}; //todo: put this in

	        this.nextSlideResolveFunction = function(){}; //if you press right before the first director.nextSlide(), don't error

	        let self = this;
	        function keyListener(e){
		    	if(e.repeat)return; //keydown fires multiple times but we only want the first one
				let slideDelta = 0;
				switch (e.keyCode) {
				  case 34:
				  case 39:
				  case 40:
					slideDelta = 1;
					break;
	              case 33:
	              case 37:
	              case 38:
	                slideDelta = -1;
				  default:
					break;
				}
				if(slideDelta != 0){
	                if(slideDelta == 1){
	                    self.handleForwardsPress();
	                }else if(slideDelta == -1){
	                    self.handleBackwardsPress();
	                }
				}
			}

			window.addEventListener("keydown", keyListener);
		}

	    moveFurtherIntoPresentation(){
	            //when not in the past (and therefore with nothing to redo), advance further.
	            //if there are less HTML slides than calls to director.newSlide(), complain in the console but allow the presentation to proceed
	            if(this.currentSlideIndex < this.numSlides){
	                this.undoStackIndex += 1; //advance past the NewSlideUndoItem
	                this.furthestSlideIndex += 1; 
	                this.currentSlideIndex += 1; //should still equal furthestSlideIndex
	            }

	            this.showSlide(this.currentSlideIndex); //this will complain in the console window if there are less slides than newSlide() calls
	            this.nextSlideResolveFunction(); //allow presentation code to proceed
	    }

	    handleForwardsPress(){
	        if(this.furthestSlideIndex == this.currentSlideIndex){
	            //unpause code execution and show next slide
	            this.moveFurtherIntoPresentation();
	            return;
	        }
	        // if we get to here, we've previously done an undo and we need to catch up

	        this.undoStackIndex += 1;
	        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
	            //loop through undo stack and redo each undo

	            if(this.undoStackIndex == this.undoStack.length){
	                //fully undone and at current slide
	                break;
	            }

	            //redo transformation in this.undoStack[this.undoStackIndex]
	            let redoItem = this.undoStack[this.undoStackIndex];
	            var redoAnimation = new Animation(redoItem.target, redoItem.toValues, redoItem.durationMS === undefined ? undefined : redoItem.durationMS/1000);
	            //and now redoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething

	            this.undoStackIndex += 1;
	        }
	        this.currentSlideIndex += 1;
	        this.showSlide(this.currentSlideIndex);
	    }

	    handleBackwardsPress(){

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
	            let duration = undoItem.durationMS === undefined ? 1 : undoItem.durationMS/1000;
	            duration = Math.min(duration / 2, 1); //undoing should be faster, so cut it in half - but cap durations at 1s
	            var undoAnimation = new Animation(undoItem.target, undoItem.fromValues, duration);
	            //and now undoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething

	            this.undoStackIndex -= 1;
	        }
	        this.currentSlideIndex -= 1;
	        this.showSlide(this.currentSlideIndex);

	    }

		async nextSlide(){
	        /*The user will call this function to mark the transition between one slide and the next. This does two things:
	        A) waits until the user presses the right arrow key, returns, and continues execution until the next nextSlide() call
	        B) if the user presses the left arrow key, they can undo and go back in time, and every TransitionTo() call before that will be undone until it reaches a previous nextSlide() call. Any normal javascript assignments won't be caught in this :(
	        C) if undo
	        */
	        
	        this.undoStack.push(new NewSlideUndoItem(this.currentSlideIndex));


	        if(!this.initialized)throw new Error("ERROR: Use .begin() on a Director before calling any other methods!");

			let self = this;

			//promise is resolved by calling this.nextSlideResolveFunction() when the time comes
			return new Promise(function(resolve, reject){
				self.nextSlideResolveFunction = function(){ 
					resolve();
				};
			});

		}
		TransitionTo(target, toValues, durationMS){
			var animation = new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000);
			let fromValues = animation.fromValues;
			this.undoStack.push(new UndoItem(target, toValues, fromValues, durationMS));
			this.undoStackIndex++;
		}
	}



	class UndoItem{
		constructor(target, toValues, fromValues, durationMS){
			this.target = target;
			this.toValues = toValues;
			this.fromValues = fromValues;
			this.durationMS = durationMS;
		}
	}
	class NewSlideUndoItem{
		constructor(slideIndex){
	        this.slideIndex = slideIndex;
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
	exports.VectorOutput = VectorOutput;
	exports.SurfaceOutput = SurfaceOutput;
	exports.NonDecreasingDirector = NonDecreasingDirector;
	exports.DirectionArrow = DirectionArrow;
	exports.UndoCapableDirector = UndoCapableDirector;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9IaXN0b3J5UmVjb3JkZXIuanMiLCIuLi9zcmMvanMvVGhyZWVFbnZpcm9ubWVudC5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL291dHB1dHMvTGluZU91dHB1dC5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1BvaW50LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvUG9pbnRPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9WZWN0b3JPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9TdXJmYWNlT3V0cHV0U2hhZGVycy5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1N1cmZhY2VPdXRwdXQuanMiLCIuLi9zcmMvanMvRGlyZWN0b3JJbWFnZUNvbnN0YW50cy5qcyIsIi4uL3NyYy9qcy9EaXJlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBUaGUgYmFzZSBjbGFzcyB0aGF0IGV2ZXJ5dGhpbmcgaW5oZXJpdHMgZnJvbS4gXG5cdEVhY2ggdGhpbmcgZHJhd24gdG8gdGhlIHNjcmVlbiBpcyBhIHRyZWUuIERvbWFpbnMsIHN1Y2ggYXMgRVhQLkFyZWEgb3IgRVhQLkFycmF5IGFyZSB0aGUgcm9vdCBub2Rlcyxcblx0RVhQLlRyYW5zZm9ybWF0aW9uIGlzIGN1cnJlbnRseSB0aGUgb25seSBpbnRlcm1lZGlhdGUgbm9kZSwgYW5kIHRoZSBsZWFmIG5vZGVzIGFyZSBzb21lIGZvcm0gb2YgT3V0cHV0IHN1Y2ggYXNcblx0RVhQLkxpbmVPdXRwdXQgb3IgRVhQLlBvaW50T3V0cHV0LCBvciBFWFAuVmVjdG9yT3V0cHV0LlxuXG5cdEFsbCBvZiB0aGVzZSBjYW4gYmUgLmFkZCgpZWQgdG8gZWFjaCBvdGhlciB0byBmb3JtIHRoYXQgdHJlZSwgYW5kIHRoaXMgZmlsZSBkZWZpbmVzIGhvdyBpdCB3b3Jrcy5cbiovXG5cbmNsYXNzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKCl7ICAgICAgICBcblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsOyAgICAgICAgXG4gICAgfVxuXHRhZGQodGhpbmcpe1xuXHRcdC8vY2hhaW5hYmxlIHNvIHlvdSBjYW4gYS5hZGQoYikuYWRkKGMpIHRvIG1ha2UgYS0+Yi0+Y1xuXHRcdHRoaXMuY2hpbGRyZW4ucHVzaCh0aGluZyk7XG5cdFx0dGhpbmcucGFyZW50ID0gdGhpcztcblx0XHRpZih0aGluZy5fb25BZGQpdGhpbmcuX29uQWRkKCk7XG5cdFx0cmV0dXJuIHRoaW5nO1xuXHR9XG5cdF9vbkFkZCgpe31cblx0cmVtb3ZlKHRoaW5nKXtcblx0XHR2YXIgaW5kZXggPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoIHRoaW5nICk7XG5cdFx0aWYgKCBpbmRleCAhPT0gLSAxICkge1xuXHRcdFx0dGhpbmcucGFyZW50ID0gbnVsbDtcblx0XHRcdHRoaXMuY2hpbGRyZW4uc3BsaWNlKCBpbmRleCwgMSApO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuICAgIGdldFRvcFBhcmVudCgpeyAvL2ZpbmQgdGhlIHBhcmVudCBvZiB0aGUgcGFyZW50IG9mIHRoZS4uLiB1bnRpbCB0aGVyZSdzIG5vIG1vcmUgcGFyZW50cy5cbiAgICAgICAgY29uc3QgTUFYX0NIQUlOID0gMTAwO1xuICAgICAgICBsZXQgcGFyZW50Q291bnQgPSAwO1xuXHRcdGxldCByb290ID0gdGhpcztcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmIHBhcmVudENvdW50IDwgTUFYX0NIQUlOKXtcblx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcbiAgICAgICAgICAgIHBhcmVudENvdW50Kz0gMTtcblx0XHR9XG5cdFx0aWYocGFyZW50Q291bnQgPj0gTUFYX0NIQUlOKXRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIHRvcC1sZXZlbCBwYXJlbnQhXCIpO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9XG4gICAgZ2V0Q2xvc2VzdERvbWFpbigpe1xuICAgICAgICAvKiBGaW5kIHRoZSBEb21haW5Ob2RlIHRoYXQgdGhpcyBOb2RlIGlzIGJlaW5nIGNhbGxlZCBmcm9tLlxuICAgICAgICBUcmF2ZXJzZSB0aGUgY2hhaW4gb2YgcGFyZW50cyB1cHdhcmRzIHVudGlsIHdlIGZpbmQgYSBEb21haW5Ob2RlLCBhdCB3aGljaCBwb2ludCB3ZSByZXR1cm4gaXQuXG4gICAgICAgIFRoaXMgYWxsb3dzIGFuIG91dHB1dCB0byByZXNpemUgYW4gYXJyYXkgdG8gbWF0Y2ggYSBkb21haW5Ob2RlJ3MgbnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBmb3IgZXhhbXBsZS5cblxuICAgICAgICBOb3RlIHRoYXQgdGhpcyByZXR1cm5zIHRoZSBNT1NUIFJFQ0VOVCBEb21haW5Ob2RlIGFuY2VzdG9yIC0gaXQncyBhc3N1bWVkIHRoYXQgZG9tYWlubm9kZXMgb3ZlcndyaXRlIG9uZSBhbm90aGVyLlxuICAgICAgICAqL1xuICAgICAgICBjb25zdCBNQVhfQ0hBSU4gPSAxMDA7XG4gICAgICAgIGxldCBwYXJlbnRDb3VudCA9IDA7XG5cdFx0bGV0IHJvb3QgPSB0aGlzLnBhcmVudDsgLy9zdGFydCBvbmUgbGV2ZWwgdXAgaW4gY2FzZSB0aGlzIGlzIGEgRG9tYWluTm9kZSBhbHJlYWR5LiB3ZSBkb24ndCB3YW50IHRoYXRcblx0XHR3aGlsZShyb290ICE9PSBudWxsICYmIHJvb3QucGFyZW50ICE9PSBudWxsICYmICFyb290LmlzRG9tYWluTm9kZSAmJiBwYXJlbnRDb3VudCA8IE1BWF9DSEFJTil7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG4gICAgICAgICAgICBwYXJlbnRDb3VudCs9IDE7XG5cdFx0fVxuXHRcdGlmKHBhcmVudENvdW50ID49IE1BWF9DSEFJTil0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBwYXJlbnQhXCIpO1xuICAgICAgICBpZihyb290ID09PSBudWxsIHx8ICFyb290LmlzRG9tYWluTm9kZSl0aHJvdyBuZXcgRXJyb3IoXCJObyBEb21haW5Ob2RlIHBhcmVudCBmb3VuZCFcIik7XG4gICAgICAgIHJldHVybiByb290O1xuICAgIH1cblxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblx0XHQvL2J1dCBjYWxsIGFsbCBjaGlsZHJlblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0ub25BZnRlckFjdGl2YXRpb24oKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgT3V0cHV0Tm9kZSBleHRlbmRzIE5vZGV7IC8vbW9yZSBvZiBhIGphdmEgaW50ZXJmYWNlLCByZWFsbHlcblx0Y29uc3RydWN0b3IoKXtzdXBlcigpO31cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope31cblx0b25BZnRlckFjdGl2YXRpb24oKXt9XG5cdF9vbkFkZCgpe31cbn1cblxuY2xhc3MgRG9tYWluTm9kZSBleHRlbmRzIE5vZGV7IC8vQSBub2RlIHRoYXQgY2FsbHMgb3RoZXIgZnVuY3Rpb25zIG92ZXIgc29tZSByYW5nZS5cblx0Y29uc3RydWN0b3IoKXtcbiAgICAgICAgc3VwZXIoKTtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cbiAgICAgICAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSBudWxsOyAvLyBudW1iZXIgb2YgdGltZXMgYW55IGNoaWxkIG5vZGUncyBldmFsdWF0ZVNlbGYoKSBpcyBjYWxsZWRcbiAgICB9XG4gICAgYWN0aXZhdGUodCl7fVxufVxuRG9tYWluTm9kZS5wcm90b3R5cGUuaXNEb21haW5Ob2RlID0gdHJ1ZTtcblxuZXhwb3J0IGRlZmF1bHQgTm9kZTtcbmV4cG9ydCB7T3V0cHV0Tm9kZSwgRG9tYWluTm9kZX07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9ICBmcm9tICcuL05vZGUuanMnO1xuLy90ZXN0Pz9cbmNsYXNzIEVYUEFycmF5IGV4dGVuZHMgRG9tYWluTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKnZhciBwb2ludHMgPSBuZXcgRVhQLkFycmF5KHtcblx0XHRkYXRhOiBbWy0xMCwxMF0sXG5cdFx0XHRbMTAsMTBdXVxuXHRcdH0pKi9cblxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZGF0YVwiKTsgLy8gYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LiBhc3N1bWVkIHRvIG9ubHkgY29udGFpbiBvbmUgdHlwZTogZWl0aGVyIG51bWJlcnMgb3IgYXJyYXlzXG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5kYXRhLCBBcnJheSk7XG5cblx0XHQvL0l0J3MgYXNzdW1lZCBhbiBFWFAuQXJyYXkgd2lsbCBvbmx5IHN0b3JlIHRoaW5ncyBzdWNoIGFzIDAsIFswXSwgWzAsMF0gb3IgWzAsMCwwXS4gSWYgYW4gYXJyYXkgdHlwZSBpcyBzdG9yZWQsIHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyBjb250YWlucyB0aGUgLmxlbmd0aCBvZiB0aGF0IGFycmF5LiBPdGhlcndpc2UgaXQncyAwLCBiZWNhdXNlIHBvaW50cyBhcmUgMC1kaW1lbnNpb25hbC5cblx0XHRpZihvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHR0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPSAwO1xuXHRcdH1lbHNlIGlmKG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0dGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID0gb3B0aW9ucy5kYXRhWzBdLmxlbmd0aDtcblx0XHR9ZWxzZXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJEYXRhIGluIGFuIEVYUC5BcnJheSBzaG91bGQgYmUgYSBudW1iZXIgb3IgYW4gYXJyYXkgb2Ygb3RoZXIgdGhpbmdzLCBub3QgXCIgKyBvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IpO1xuXHRcdH1cblxuXG5cdFx0RVhQLlV0aWxzLmFzc2VydChvcHRpb25zLmRhdGFbMF0ubGVuZ3RoICE9IDApOyAvL2Rvbid0IGFjY2VwdCBbW11dLCBkYXRhIG5lZWRzIHRvIGJlIHNvbWV0aGluZyBsaWtlIFtbMSwyXV0uXG5cblx0XHR0aGlzLmRhdGEgPSBvcHRpb25zLmRhdGE7XG5cdFx0dGhpcy5udW1JdGVtcyA9IHRoaXMuZGF0YS5sZW5ndGg7XG5cblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW3RoaXMuZGF0YS5sZW5ndGhdOyAvLyBhcnJheSB0byBzdG9yZSB0aGUgbnVtYmVyIG9mIHRpbWVzIHRoaXMgaXMgY2FsbGVkIHBlciBkaW1lbnNpb24uXG5cblx0XHQvL3RoZSBudW1iZXIgb2YgdGltZXMgZXZlcnkgY2hpbGQncyBleHByIGlzIGNhbGxlZFxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gdGhpcy5pdGVtRGltZW5zaW9ucy5yZWR1Y2UoKHN1bSx5KT0+c3VtKnkpO1xuXHR9XG5cdGFjdGl2YXRlKHQpe1xuXHRcdGlmKHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyA9PSAwKXtcblx0XHRcdC8vbnVtYmVycyBjYW4ndCBiZSBzcHJlYWQgdXNpbmcgLi4uIG9wZXJhdG9yXG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuZGF0YS5sZW5ndGg7aSsrKXtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGksdCx0aGlzLmRhdGFbaV0pO1xuXHRcdFx0fVxuXHRcdH1lbHNle1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmRhdGEubGVuZ3RoO2krKyl7XG5cdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpLHQsLi4udGhpcy5kYXRhW2ldKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm9uQWZ0ZXJBY3RpdmF0aW9uKCk7IC8vIGNhbGwgY2hpbGRyZW4gaWYgbmVjZXNzYXJ5XG5cdH1cblx0X2NhbGxBbGxDaGlsZHJlbiguLi5jb29yZGluYXRlcyl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpXG5cdFx0fVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEVYUC5BcnJheSh7ZGF0YTogRVhQLlV0aWxzLmFycmF5Q29weSh0aGlzLmRhdGEpfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0QXJyYXkoKXtcblx0dmFyIHggPSBuZXcgRVhQLkFycmF5KHtkYXRhOiBbWzAsMV0sWzAsMV1dfSk7XG5cdHZhciB5ID0gbmV3IEVYUC5UcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSk7IHJldHVybiBbMl19fSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKDUxMik7XG59XG5cbmV4cG9ydCB7RVhQQXJyYXkgYXMgQXJyYXl9O1xuIiwiZnVuY3Rpb24gbXVsdGlwbHlTY2FsYXIoYywgYXJyYXkpe1xuXHRmb3IodmFyIGk9MDtpPGFycmF5Lmxlbmd0aDtpKyspe1xuXHRcdGFycmF5W2ldICo9IGM7XG5cdH1cblx0cmV0dXJuIGFycmF5XG59XG5mdW5jdGlvbiB2ZWN0b3JBZGQodjEsdjIpe1xuICAgIGxldCB2ZWMgPSBjbG9uZSh2MSk7XG5cdGZvcih2YXIgaT0wO2k8djEubGVuZ3RoO2krKyl7XG5cdFx0dmVjW2ldICs9IHYyW2ldO1xuXHR9XG5cdHJldHVybiB2ZWNcbn1cbmZ1bmN0aW9uIGxlcnBWZWN0b3JzKHQsIHAxLCBwMil7XG5cdC8vYXNzdW1lZCB0IGluIFswLDFdXG5cdHJldHVybiB2ZWN0b3JBZGQobXVsdGlwbHlTY2FsYXIodCxjbG9uZShwMSkpLG11bHRpcGx5U2NhbGFyKDEtdCxjbG9uZShwMikpKTtcbn1cbmZ1bmN0aW9uIGNsb25lKHZlYyl7XG5cdHZhciBuZXdBcnIgPSBuZXcgQXJyYXkodmVjLmxlbmd0aCk7XG5cdGZvcih2YXIgaT0wO2k8dmVjLmxlbmd0aDtpKyspe1xuXHRcdG5ld0FycltpXSA9IHZlY1tpXTtcblx0fVxuXHRyZXR1cm4gbmV3QXJyXG59XG5mdW5jdGlvbiBtdWx0aXBseU1hdHJpeCh2ZWMsIG1hdHJpeCl7XG5cdC8vYXNzZXJ0IHZlYy5sZW5ndGggPT0gbnVtUm93c1xuXG5cdGxldCBudW1Sb3dzID0gbWF0cml4Lmxlbmd0aDtcblx0bGV0IG51bUNvbHMgPSBtYXRyaXhbMF0ubGVuZ3RoO1xuXG5cdHZhciBvdXRwdXQgPSBuZXcgQXJyYXkobnVtQ29scyk7XG5cdGZvcih2YXIgaj0wO2o8bnVtQ29scztqKyspe1xuXHRcdG91dHB1dFtqXSA9IDA7XG5cdFx0Zm9yKHZhciBpPTA7aTxudW1Sb3dzO2krKyl7XG5cdFx0XHRvdXRwdXRbal0gKz0gbWF0cml4W2ldW2pdICogdmVjW2ldO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gb3V0cHV0O1xufVxuXG4vL2hhY2tcbmxldCBNYXRoID0ge2Nsb25lOiBjbG9uZSwgbGVycFZlY3RvcnM6IGxlcnBWZWN0b3JzLCB2ZWN0b3JBZGQ6IHZlY3RvckFkZCwgbXVsdGlwbHlTY2FsYXI6IG11bHRpcGx5U2NhbGFyLCBtdWx0aXBseU1hdHJpeDogbXVsdGlwbHlNYXRyaXh9O1xuXG5leHBvcnQge3ZlY3RvckFkZCwgbGVycFZlY3RvcnMsIGNsb25lLCBtdWx0aXBseVNjYWxhciwgbXVsdGlwbHlNYXRyaXgsIE1hdGh9O1xuIiwiaW1wb3J0IHtjbG9uZX0gZnJvbSAnLi9tYXRoLmpzJ1xuXG5jbGFzcyBVdGlsc3tcblxuXHRzdGF0aWMgaXNBcnJheSh4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gQXJyYXk7XG5cdH1cblx0c3RhdGljIGFycmF5Q29weSh4KXtcblx0XHRyZXR1cm4geC5zbGljZSgpO1xuXHR9XG5cdHN0YXRpYyBpc0Z1bmN0aW9uKHgpe1xuXHRcdHJldHVybiB4LmNvbnN0cnVjdG9yID09PSBGdW5jdGlvbjtcblx0fVxuXG5cdHN0YXRpYyBhc3NlcnQodGhpbmcpe1xuXHRcdC8vQSBmdW5jdGlvbiB0byBjaGVjayBpZiBzb21ldGhpbmcgaXMgdHJ1ZSBhbmQgaGFsdCBvdGhlcndpc2UgaW4gYSBjYWxsYmFja2FibGUgd2F5LlxuXHRcdGlmKCF0aGluZyl7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIEFzc2VydGlvbiBmYWlsZWQuIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuXHRcdH1cblx0fVxuXG5cdHN0YXRpYyBhc3NlcnRUeXBlKHRoaW5nLCB0eXBlLCBlcnJvck1zZyl7XG5cdFx0Ly9BIGZ1bmN0aW9uIHRvIGNoZWNrIGlmIHNvbWV0aGluZyBpcyB0cnVlIGFuZCBoYWx0IG90aGVyd2lzZSBpbiBhIGNhbGxiYWNrYWJsZSB3YXkuXG5cdFx0aWYoISh0aGluZy5jb25zdHJ1Y3RvciA9PT0gdHlwZSkpe1xuXHRcdFx0aWYoZXJyb3JNc2cpe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFNvbWV0aGluZyBub3Qgb2YgcmVxdWlyZWQgdHlwZSBcIit0eXBlLm5hbWUrXCIhIFxcblwiK2Vycm9yTXNnK1wiXFxuIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdFx0fWVsc2V7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgU29tZXRoaW5nIG5vdCBvZiByZXF1aXJlZCB0eXBlIFwiK3R5cGUubmFtZStcIiEgU2VlIHRyYWNlYmFjayBmb3IgbW9yZS5cIik7XG5cdFx0XHR9XG4gICAgICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG5cdFx0fVxuXHR9XG5cblxuXHRzdGF0aWMgYXNzZXJ0UHJvcEV4aXN0cyh0aGluZywgbmFtZSl7XG5cdFx0aWYoIXRoaW5nIHx8ICEobmFtZSBpbiB0aGluZykpe1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBcIituYW1lK1wiIG5vdCBwcmVzZW50IGluIHJlcXVpcmVkIHByb3BlcnR5XCIpO1xuICAgICAgICAgICAgY29uc29sZS50cmFjZSgpO1xuXHRcdH1cblx0fVxuXHRcblx0c3RhdGljIGNsb25lKHZlYyl7XG5cdFx0cmV0dXJuIGNsb25lKHZlYyk7XG5cdH1cbn1cblxuZXhwb3J0IHtVdGlsc307XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7IERvbWFpbk5vZGUgfSBmcm9tICcuL05vZGUuanMnO1xuXG5jbGFzcyBBcmVhIGV4dGVuZHMgRG9tYWluTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8qdmFyIGF4ZXMgPSBuZXcgRVhQLkFyZWEoe1xuXHRcdGJvdW5kczogW1stMTAsMTBdLFxuXHRcdFx0WzEwLDEwXV1cblx0XHRudW1JdGVtczogMTA7IC8vb3B0aW9uYWwuIEFsdGVybmF0ZWx5IG51bUl0ZW1zIGNhbiB2YXJ5IGZvciBlYWNoIGF4aXM6IG51bUl0ZW1zOiBbMTAsMl1cblx0XHR9KSovXG5cblxuXHRcblx0XHRVdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiYm91bmRzXCIpOyAvLyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXlcblx0XHRVdGlscy5hc3NlcnRUeXBlKG9wdGlvbnMuYm91bmRzLCBBcnJheSk7XG5cdFx0VXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmJvdW5kc1swXSwgQXJyYXksIFwiRm9yIGFuIEFyZWEsIG9wdGlvbnMuYm91bmRzIG11c3QgYmUgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LCBldmVuIGZvciBvbmUgZGltZW5zaW9uIVwiKTsgLy8gaXQgTVVTVCBiZSBtdWx0aWRpbWVuc2lvbmFsXG5cdFx0dGhpcy5udW1EaW1lbnNpb25zID0gb3B0aW9ucy5ib3VuZHMubGVuZ3RoO1xuXG5cdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMuYm91bmRzWzBdLmxlbmd0aCAhPSAwKTsgLy9kb24ndCBhY2NlcHQgW1tdXSwgaXQgbmVlZHMgdG8gYmUgW1sxLDJdXS5cblxuXHRcdHRoaXMuYm91bmRzID0gb3B0aW9ucy5ib3VuZHM7XG5cdFx0dGhpcy5udW1JdGVtcyA9IG9wdGlvbnMubnVtSXRlbXMgfHwgMTY7XG5cblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdGlmKHRoaXMubnVtSXRlbXMuY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtRGltZW5zaW9ucztpKyspe1xuXHRcdFx0XHR0aGlzLml0ZW1EaW1lbnNpb25zLnB1c2godGhpcy5udW1JdGVtcyk7XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1JdGVtcy5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMubnVtSXRlbXMubGVuZ3RoID09IG9wdGlvbnMuYm91bmRzLmxlbmd0aCk7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtRGltZW5zaW9ucztpKyspe1xuXHRcdFx0XHR0aGlzLml0ZW1EaW1lbnNpb25zLnB1c2godGhpcy5udW1JdGVtc1tpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIHRpbWVzIGV2ZXJ5IGNoaWxkJ3MgZXhwciBpcyBjYWxsZWRcblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHRoaXMuaXRlbURpbWVuc2lvbnMucmVkdWNlKChzdW0seSk9PnN1bSp5KTtcblx0fVxuXHRhY3RpdmF0ZSh0KXtcblx0XHQvL1VzZSB0aGlzIHRvIGV2YWx1YXRlIGV4cHIoKSBhbmQgdXBkYXRlIHRoZSByZXN1bHQsIGNhc2NhZGUtc3R5bGUuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIGJvdW5kcyB0aGlzIG9iamVjdCBoYXMgd2lsbCBiZSB0aGUgbnVtYmVyIG9mIGRpbWVuc2lvbnMuXG5cdFx0Ly90aGUgZXhwcigpcyBhcmUgY2FsbGVkIHdpdGggZXhwcihpLCAuLi5bY29vcmRpbmF0ZXNdLCB0KSwgXG5cdFx0Ly9cdCh3aGVyZSBpIGlzIHRoZSBpbmRleCBvZiB0aGUgY3VycmVudCBldmFsdWF0aW9uID0gdGltZXMgZXhwcigpIGhhcyBiZWVuIGNhbGxlZCB0aGlzIGZyYW1lLCB0ID0gYWJzb2x1dGUgdGltZXN0ZXAgKHMpKS5cblx0XHQvL3BsZWFzZSBjYWxsIHdpdGggYSB0IHZhbHVlIG9idGFpbmVkIGZyb20gcGVyZm9ybWFuY2Uubm93KCkvMTAwMCBvciBzb21ldGhpbmcgbGlrZSB0aGF0XG5cblx0XHQvL25vdGUgdGhlIGxlc3MtdGhhbi1vci1lcXVhbC10byBpbiB0aGVzZSBsb29wc1xuXHRcdGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAxKXtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRsZXQgaW5kZXggPSBpO1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSwwLDAsMCk7XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1EaW1lbnNpb25zID09IDIpe1xuXHRcdFx0Ly90aGlzIGNhbiBiZSByZWR1Y2VkIGludG8gYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIG92ZXIgdGhlIGZpcnN0IGluZGV4IG9mIHRoaXMuYm91bmRzLCBJIGtub3cgaXRcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRmb3IodmFyIGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aisrKXtcblx0XHRcdFx0XHRsZXQgYzIgPSB0aGlzLmJvdW5kc1sxXVswXSArICh0aGlzLmJvdW5kc1sxXVsxXS10aGlzLmJvdW5kc1sxXVswXSkqKGovKHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSkpO1xuXHRcdFx0XHRcdGxldCBpbmRleCA9IGkqdGhpcy5pdGVtRGltZW5zaW9uc1sxXSArIGo7XG5cdFx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsYzIsMCwwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAzKXtcblx0XHRcdC8vdGhpcyBjYW4gYmUgcmVkdWNlZCBpbnRvIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSBvdmVyIHRoZSBmaXJzdCBpbmRleCBvZiB0aGlzLmJvdW5kcywgSSBrbm93IGl0XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0Zm9yKHZhciBqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzFdO2orKyl7XG5cdFx0XHRcdFx0bGV0IGMyID0gdGhpcy5ib3VuZHNbMV1bMF0gKyAodGhpcy5ib3VuZHNbMV1bMV0tdGhpcy5ib3VuZHNbMV1bMF0pKihqLyh0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTEpKTtcblx0XHRcdFx0XHRmb3IodmFyIGs9MDtrPHRoaXMuaXRlbURpbWVuc2lvbnNbMl07aysrKXtcblx0XHRcdFx0XHRcdGxldCBjMyA9IHRoaXMuYm91bmRzWzJdWzBdICsgKHRoaXMuYm91bmRzWzJdWzFdLXRoaXMuYm91bmRzWzJdWzBdKSooay8odGhpcy5pdGVtRGltZW5zaW9uc1syXS0xKSk7XG5cdFx0XHRcdFx0XHRsZXQgaW5kZXggPSAoaSp0aGlzLml0ZW1EaW1lbnNpb25zWzFdICsgaikqdGhpcy5pdGVtRGltZW5zaW9uc1syXSArIGs7XG5cdFx0XHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSxjMixjMywwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ZWxzZXtcblx0XHRcdGFzc2VydChcIlRPRE86IFVzZSBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgdG8gbG9vcCBvdmVyIGFsbCBpbmRpY2VzIVwiKTtcblx0XHR9XG5cblx0XHR0aGlzLm9uQWZ0ZXJBY3RpdmF0aW9uKCk7IC8vIGNhbGwgY2hpbGRyZW4gaWYgbmVjZXNzYXJ5XG5cdH1cblx0X2NhbGxBbGxDaGlsZHJlbiguLi5jb29yZGluYXRlcyl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5ldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpXG5cdFx0fVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEFyZWEoe2JvdW5kczogVXRpbHMuYXJyYXlDb3B5KHRoaXMuYm91bmRzKSwgbnVtSXRlbXM6IHRoaXMubnVtSXRlbXN9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHRcdGlmKGNsb25lLmNoaWxkcmVuW2ldLl9vbkFkZCljbG9uZS5jaGlsZHJlbltpXS5fb25BZGQoKTsgLy8gbmVjZXNzYXJ5IG5vdyB0aGF0IHRoZSBjaGFpbiBvZiBhZGRpbmcgaGFzIGJlZW4gZXN0YWJsaXNoZWRcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RBcmVhKCl7XG5cdHZhciB4ID0gbmV3IEFyZWEoe2JvdW5kczogW1swLDFdLFswLDFdXX0pO1xuXHR2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSl9fSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKCk7XG59XG5cbmV4cG9ydCB7IEFyZWEgfVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCBOb2RlIGZyb20gJy4vTm9kZS5qcyc7XG5cbi8vVXNhZ2U6IHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiBmdW5jdGlvbiguLi5hKXtjb25zb2xlLmxvZyguLi5hKX19KTtcbmNsYXNzIFRyYW5zZm9ybWF0aW9uIGV4dGVuZHMgTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblx0XG5cdFx0RVhQLlV0aWxzLmFzc2VydFByb3BFeGlzdHMob3B0aW9ucywgXCJleHByXCIpOyAvLyBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXlcblx0XHRFWFAuVXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmV4cHIsIEZ1bmN0aW9uKTtcblxuXHRcdHRoaXMuZXhwciA9IG9wdGlvbnMuZXhwcjtcblx0fVxuXHRldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpe1xuXHRcdC8vZXZhbHVhdGUgdGhpcyBUcmFuc2Zvcm1hdGlvbidzIF9leHByLCBhbmQgYnJvYWRjYXN0IHRoZSByZXN1bHQgdG8gYWxsIGNoaWxkcmVuLlxuXHRcdGxldCByZXN1bHQgPSB0aGlzLmV4cHIoLi4uY29vcmRpbmF0ZXMpO1xuXHRcdGlmKHJlc3VsdC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpcmVzdWx0ID0gW3Jlc3VsdF07XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZihjb29yZGluYXRlc1swXSxjb29yZGluYXRlc1sxXSwgLi4ucmVzdWx0KVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCB0aGlzRXhwciA9IHRoaXMuZXhwcjtcblx0XHRsZXQgY2xvbmUgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IHRoaXNFeHByLmJpbmQoKX0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cblx0bWFrZUxpbmsoKXtcbiAgICAgICAgLy9saWtlIGEgY2xvbmUsIGJ1dCB3aWxsIHVzZSB0aGUgc2FtZSBleHByIGFzIHRoaXMgVHJhbnNmb3JtYXRpb24uXG4gICAgICAgIC8vdXNlZnVsIGlmIHRoZXJlJ3MgYSBzcGVjaWZpYyBmdW5jdGlvbiB0aGF0IG5lZWRzIHRvIGJlIHVzZWQgYnkgYSBidW5jaCBvZiBvYmplY3RzXG5cdFx0cmV0dXJuIG5ldyBMaW5rZWRUcmFuc2Zvcm1hdGlvbih0aGlzKTtcblx0fVxufVxuXG5jbGFzcyBMaW5rZWRUcmFuc2Zvcm1hdGlvbiBleHRlbmRzIE5vZGV7XG4gICAgLypcbiAgICAgICAgTGlrZSBhbiBFWFAuVHJhbnNmb3JtYXRpb24sIGJ1dCBpdCB1c2VzIGFuIGV4aXN0aW5nIEVYUC5UcmFuc2Zvcm1hdGlvbidzIGV4cHIoKSwgc28gaWYgdGhlIGxpbmtlZCB0cmFuc2Zvcm1hdGlvbiB1cGRhdGVzLCBzbyBkb2VzIHRoaXMgb25lLiBJdCdzIGxpa2UgYSBwb2ludGVyIHRvIGEgVHJhbnNmb3JtYXRpb24sIGJ1dCBpbiBvYmplY3QgZm9ybS4gXG4gICAgKi9cblx0Y29uc3RydWN0b3IodHJhbnNmb3JtYXRpb25Ub0xpbmtUbyl7XG5cdFx0c3VwZXIoe30pO1xuXHRcdEVYUC5VdGlscy5hc3NlcnRUeXBlKHRyYW5zZm9ybWF0aW9uVG9MaW5rVG8sIFRyYW5zZm9ybWF0aW9uKTtcbiAgICAgICAgdGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUgPSB0cmFuc2Zvcm1hdGlvblRvTGlua1RvO1xuXHR9XG5cdGV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcyl7XG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMubGlua2VkVHJhbnNmb3JtYXRpb25Ob2RlLmV4cHIoLi4uY29vcmRpbmF0ZXMpO1xuXHRcdGlmKHJlc3VsdC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpcmVzdWx0ID0gW3Jlc3VsdF07XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZihjb29yZGluYXRlc1swXSxjb29yZGluYXRlc1sxXSwgLi4ucmVzdWx0KVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBMaW5rZWRUcmFuc2Zvcm1hdGlvbih0aGlzLmxpbmtlZFRyYW5zZm9ybWF0aW9uTm9kZSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxuXHRtYWtlTGluaygpe1xuXHRcdHJldHVybiBuZXcgTGlua2VkVHJhbnNmb3JtYXRpb24odGhpcy5saW5rZWRUcmFuc2Zvcm1hdGlvbk5vZGUpO1xuXHR9XG59XG5cblxuXG5cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RUcmFuc2Zvcm1hdGlvbigpe1xuXHR2YXIgeCA9IG5ldyBBcmVhKHtib3VuZHM6IFtbLTEwLDEwXV19KTtcblx0dmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oeydleHByJzogKHgpID0+IGNvbnNvbGUubG9nKHgqeCl9KTtcblx0eC5hZGQoeSk7XG5cdHguYWN0aXZhdGUoKTsgLy8gc2hvdWxkIHJldHVybiAxMDAsIDgxLCA2NC4uLiAwLCAxLCA0Li4uIDEwMFxufVxuXG5leHBvcnQgeyBUcmFuc2Zvcm1hdGlvbiwgTGlua2VkVHJhbnNmb3JtYXRpb259XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IHsgRG9tYWluTm9kZSB9IGZyb20gJy4vTm9kZS5qcyc7XG5cbmNsYXNzIEhpc3RvcnlSZWNvcmRlciBleHRlbmRzIERvbWFpbk5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIENsYXNzIHRoYXQgcmVjb3JkcyB0aGUgbGFzdCBmZXcgdmFsdWVzIG9mIHRoZSBwYXJlbnQgVHJhbnNmb3JtYXRpb24gYW5kIG1ha2VzIHRoZW0gYXZhaWxhYmxlIGZvciB1c2UgYXMgYW4gZXh0cmEgZGltZW5zaW9uLlxuICAgICAgICAgICAgVXNhZ2U6XG4gICAgICAgICAgICB2YXIgcmVjb3JkZXIgPSBuZXcgSGlzdG9yeVJlY29yZGVyKHtcbiAgICAgICAgICAgICAgICBtZW1vcnlMZW5ndGg6IDEwIC8vIGhvdyBtYW55IHBhc3QgdmFsdWVzIHRvIHN0b3JlP1xuICAgICAgICAgICAgICAgIHJlY29yZEZyYW1lSW50ZXJ2YWw6IDE1Ly9Ib3cgbG9uZyB0byB3YWl0IGJldHdlZW4gZWFjaCBjYXB0dXJlPyBNZWFzdXJlZCBpbiBmcmFtZXMsIHNvIDYwID0gMSBjYXB0dXJlIHBlciBzZWNvbmQsIDMwID0gMiBjYXB0dXJlcy9zZWNvbmQsIGV0Yy5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBleGFtcGxlIHVzYWdlOlxuICAgICAgICAgICAgbmV3IEFyZWEoe2JvdW5kczogW1stNSw1XV19KS5hZGQobmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiAoaSx0LHgpID0+IFtNYXRoLnNpbih4KSxNYXRoLmNvcyh4KV19KSkuYWRkKG5ldyBFWFAuSGlzdG9yeVJlY29yZGVyKHttZW1vcnlMZW5ndGg6IDV9KS5hZGQobmV3IExpbmVPdXRwdXQoe3dpZHRoOiA1LCBjb2xvcjogMHhmZjAwMDB9KSk7XG5cbiAgICAgICAgICAgIE5PVEU6IEl0IGlzIGFzc3VtZWQgdGhhdCBhbnkgcGFyZW50IHRyYW5zZm9ybWF0aW9uIG91dHB1dHMgYW4gYXJyYXkgb2YgbnVtYmVycyB0aGF0IGlzIDQgb3IgbGVzcyBpbiBsZW5ndGguXG4gICAgICAgICovXG5cblx0XHR0aGlzLm1lbW9yeUxlbmd0aCA9IG9wdGlvbnMubWVtb3J5TGVuZ3RoID09PSB1bmRlZmluZWQgPyAxMCA6IG9wdGlvbnMubWVtb3J5TGVuZ3RoO1xuICAgICAgICB0aGlzLnJlY29yZEZyYW1lSW50ZXJ2YWwgPSBvcHRpb25zLnJlY29yZEZyYW1lSW50ZXJ2YWwgPT09IHVuZGVmaW5lZCA/IDE1IDogb3B0aW9ucy5yZWNvcmRGcmFtZUludGVydmFsOyAvL3NldCB0byAxIHRvIHJlY29yZCBldmVyeSBmcmFtZS5cbiAgICAgICAgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDQ7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/ICh0b2RvOiBhdXRvZGV0ZWN0IHRoaXMgZnJvbSBwYXJlbnQncyBvdXRwdXQpXG5cdFx0dGhpcy5jdXJyZW50SGlzdG9yeUluZGV4PTA7XG4gICAgICAgIHRoaXMuZnJhbWVSZWNvcmRUaW1lciA9IDA7XG5cdH1cblx0X29uQWRkKCl7XG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIEFyZWFcblx0XHRsZXQgcm9vdCA9IHRoaXMuZ2V0Q2xvc2VzdERvbWFpbigpO1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbiAqIHRoaXMubWVtb3J5TGVuZ3RoO1xuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSByb290Lml0ZW1EaW1lbnNpb25zLmNvbmNhdChbdGhpcy5tZW1vcnlMZW5ndGhdKTtcblxuICAgICAgICB0aGlzLmJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcbiAgICBcbiAgICAgICAgLy9UaGlzIGlzIHNvIHRoYXQgbm8gc3VyZmFjZS9ib3VuZGFyeSB3aWxsIGFwcGVhciB1bnRpbCBoaXN0b3J5IGJlZ2lucyB0byBiZSByZWNvcmRlZC4gSSdtIHNvIHNvcnJ5LlxuICAgICAgICAvL1RvZG86IHByb3BlciBjbGlwIHNoYWRlciBsaWtlIG1hdGhib3ggZG9lcyBvciBzb21ldGhpbmcuXG4gICAgICAgIHRoaXMuYnVmZmVyLmZpbGwoTmFOKTsgXG5cdH1cbiAgICBvbkFmdGVyQWN0aXZhdGlvbigpe1xuICAgICAgICBzdXBlci5vbkFmdGVyQWN0aXZhdGlvbigpO1xuXG4gICAgICAgIC8vZXZlcnkgc28gb2Z0ZW4sIHNoaWZ0IHRvIHRoZSBuZXh0IGJ1ZmZlciBzbG90XG4gICAgICAgIHRoaXMuZnJhbWVSZWNvcmRUaW1lciArPSAxO1xuICAgICAgICBpZih0aGlzLmZyYW1lUmVjb3JkVGltZXIgPj0gdGhpcy5yZWNvcmRGcmFtZUludGVydmFsKXtcbiAgICAgICAgICAgIC8vcmVzZXQgZnJhbWUgcmVjb3JkIHRpbWVyXG4gICAgICAgICAgICB0aGlzLmZyYW1lUmVjb3JkVGltZXIgPSAwO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4ID0gKHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCsxKSV0aGlzLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgfVxuICAgIH1cblx0ZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKXtcblx0XHQvL2V2YWx1YXRlIHRoaXMgVHJhbnNmb3JtYXRpb24ncyBfZXhwciwgYW5kIGJyb2FkY2FzdCB0aGUgcmVzdWx0IHRvIGFsbCBjaGlsZHJlbi5cblx0XHRsZXQgaSA9IGNvb3JkaW5hdGVzWzBdO1xuXHRcdGxldCB0ID0gY29vcmRpbmF0ZXNbMV07XG4gICAgXG4gICAgICAgIC8vc3RlcCAxOiBzYXZlIGNvb3JkaW5hdGVzIGZvciB0aGlzIGZyYW1lIGluIGJ1ZmZlclxuICAgICAgICBpZihjb29yZGluYXRlcy5sZW5ndGggPiAyK3RoaXMuX291dHB1dERpbWVuc2lvbnMpe1xuICAgICAgICAgICAgLy90b2RvOiBtYWtlIHRoaXMgdXBkYXRlIHRoaXMuX291dHB1dERpbWVuc2lvbnMgYW5kIHJlYWxsb2NhdGUgbW9yZSBidWZmZXIgc3BhY2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVYUC5IaXN0b3J5UmVjb3JkZXIgaXMgdW5hYmxlIHRvIHJlY29yZCBoaXN0b3J5IG9mIHNvbWV0aGluZyB0aGF0IG91dHB1dHMgaW4gXCIrdGhpcy5fb3V0cHV0RGltZW5zaW9ucytcIiBkaW1lbnNpb25zISBZZXQuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGN5Y2xpY0J1ZmZlckluZGV4ID0gKGkqdGhpcy5tZW1vcnlMZW5ndGgrdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4KSp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuICAgICAgICBmb3IodmFyIGo9MDtqPGNvb3JkaW5hdGVzLmxlbmd0aC0yO2orKyl7IFxuICAgICAgICAgICAgdGhpcy5idWZmZXJbY3ljbGljQnVmZmVySW5kZXgral0gPSBjb29yZGluYXRlc1syK2pdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9zdGVwIDI6LCBjYWxsIGFueSBjaGlsZHJlbiBvbmNlIHBlciBoaXN0b3J5IGl0ZW1cbiAgICAgICAgZm9yKHZhciBjaGlsZE5vPTA7Y2hpbGRObzx0aGlzLmNoaWxkcmVuLmxlbmd0aDtjaGlsZE5vKyspe1xuXHRcdCAgICBmb3IodmFyIGo9MDtqPHRoaXMubWVtb3J5TGVuZ3RoO2orKyl7XG5cbiAgICAgICAgICAgICAgICAvL3RoZSArMSBpbiAoaiArIHRoaXMuY3VycmVudEhpc3RvcnlJbmRleCArIDEpIGlzIGltcG9ydGFudDsgd2l0aG91dCBpdCwgYSBMaW5lT3V0cHV0IHdpbGwgZHJhdyBhIGxpbmUgZnJvbSB0aGUgbW9zdCByZWNlbnQgdmFsdWUgdG8gdGhlIGVuZCBvZiBoaXN0b3J5XG4gICAgICAgICAgICAgICAgbGV0IGN5Y2xpY0hpc3RvcnlWYWx1ZSA9IChqICsgdGhpcy5jdXJyZW50SGlzdG9yeUluZGV4ICsgMSkgJSB0aGlzLm1lbW9yeUxlbmd0aDtcbiAgICAgICAgICAgICAgICBsZXQgY3ljbGljQnVmZmVySW5kZXggPSAoaSAqIHRoaXMubWVtb3J5TGVuZ3RoICsgY3ljbGljSGlzdG9yeVZhbHVlKSp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuICAgICAgICAgICAgICAgIGxldCBub25DeWNsaWNJbmRleCA9IGkgKiB0aGlzLm1lbW9yeUxlbmd0aCArIGo7XG5cblx0XHQgICAgICAgIC8vSSdtIHRvcm4gb24gd2hldGhlciB0byBhZGQgYSBmaW5hbCBjb29yZGluYXRlIGF0IHRoZSBlbmQgc28gaGlzdG9yeSBjYW4gZ28gb2ZmIGluIGEgbmV3IGRpcmVjdGlvbi5cbiAgICAgICAgICAgICAgICAvL3RoaXMuY2hpbGRyZW5bY2hpbGROb10uZXZhbHVhdGVTZWxmKG5vbkN5Y2xpY0luZGV4LHQsdGhpcy5idWZmZXJbY3ljbGljQnVmZmVySW5kZXhdLCBjeWNsaWNIaXN0b3J5VmFsdWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW5bY2hpbGROb10uZXZhbHVhdGVTZWxmKFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9uQ3ljbGljSW5kZXgsdCwgLy9pLHRcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuYnVmZmVyLnNsaWNlKGN5Y2xpY0J1ZmZlckluZGV4LGN5Y2xpY0J1ZmZlckluZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMpIC8vZXh0cmFjdCBjb29yZGluYXRlcyBmb3IgdGhpcyBoaXN0b3J5IHZhbHVlIGZyb20gYnVmZmVyXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IGNsb25lID0gbmV3IEhpc3RvcnlSZWNvcmRlcih7bWVtb3J5TGVuZ3RoOiB0aGlzLm1lbW9yeUxlbmd0aCwgcmVjb3JkRnJhbWVJbnRlcnZhbDogdGhpcy5yZWNvcmRGcmFtZUludGVydmFsfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5leHBvcnQgeyBIaXN0b3J5UmVjb3JkZXIgfVxuIiwidmFyIHRocmVlRW52aXJvbm1lbnQgPSBudWxsO1xuXG5mdW5jdGlvbiBzZXRUaHJlZUVudmlyb25tZW50KG5ld0Vudil7XG4gICAgdGhyZWVFbnZpcm9ubWVudCA9IG5ld0Vudjtcbn1cbmV4cG9ydCB7c2V0VGhyZWVFbnZpcm9ubWVudCwgdGhyZWVFbnZpcm9ubWVudH07XG4iLCJpbXBvcnQgeyBVdGlscyB9IGZyb20gJy4vdXRpbHMuanMnO1xuXG5pbXBvcnQgeyBUcmFuc2Zvcm1hdGlvbiB9IGZyb20gJy4vVHJhbnNmb3JtYXRpb24uanMnO1xuXG5pbXBvcnQgKiBhcyBtYXRoIGZyb20gJy4vbWF0aC5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxuY2xhc3MgQW5pbWF0aW9ue1xuXHRjb25zdHJ1Y3Rvcih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbiwgc3RhZ2dlckZyYWN0aW9uKXtcblx0XHRVdGlscy5hc3NlcnRUeXBlKHRvVmFsdWVzLCBPYmplY3QpO1xuXG5cdFx0dGhpcy50b1ZhbHVlcyA9IHRvVmFsdWVzO1xuXHRcdHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1x0XG5cdFx0dGhpcy5zdGFnZ2VyRnJhY3Rpb24gPSBzdGFnZ2VyRnJhY3Rpb24gPT09IHVuZGVmaW5lZCA/IDAgOiBzdGFnZ2VyRnJhY3Rpb247IC8vIHRpbWUgaW4gbXMgYmV0d2VlbiBmaXJzdCBlbGVtZW50IGJlZ2lubmluZyB0aGUgYW5pbWF0aW9uIGFuZCBsYXN0IGVsZW1lbnQgYmVnaW5uaW5nIHRoZSBhbmltYXRpb24uIFNob3VsZCBiZSBsZXNzIHRoYW4gZHVyYXRpb24uXG5yXG5cblx0XHRVdGlscy5hc3NlcnQodGhpcy5zdGFnZ2VyRnJhY3Rpb24gPj0gMCAmJiB0aGlzLnN0YWdnZXJGcmFjdGlvbiA8IDEpO1xuXG5cdFx0dGhpcy5mcm9tVmFsdWVzID0ge307XG5cdFx0Zm9yKHZhciBwcm9wZXJ0eSBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdFV0aWxzLmFzc2VydFByb3BFeGlzdHModGhpcy50YXJnZXQsIHByb3BlcnR5KTtcblxuXHRcdFx0Ly9jb3B5IHByb3BlcnR5LCBtYWtpbmcgc3VyZSB0byBzdG9yZSB0aGUgY29ycmVjdCAndGhpcydcblx0XHRcdGlmKFV0aWxzLmlzRnVuY3Rpb24odGhpcy50YXJnZXRbcHJvcGVydHldKSl7XG5cdFx0XHRcdHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0gPSB0aGlzLnRhcmdldFtwcm9wZXJ0eV0uYmluZCh0aGlzLnRhcmdldCk7XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0dGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHRoaXMudGFyZ2V0W3Byb3BlcnR5XTtcblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbiA9PT0gdW5kZWZpbmVkID8gMSA6IGR1cmF0aW9uOyAvL2luIHNcblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblxuICAgICAgICB0aGlzLnByZXZUcnVlVGltZSA9IDA7XG5cblxuXHRcdGlmKHRhcmdldC5jb25zdHJ1Y3RvciA9PT0gVHJhbnNmb3JtYXRpb24pe1xuXHRcdFx0Ly9maW5kIG91dCBob3cgbWFueSBvYmplY3RzIGFyZSBwYXNzaW5nIHRocm91Z2ggdGhpcyB0cmFuc2Zvcm1hdGlvblxuXHRcdFx0bGV0IHJvb3QgPSB0YXJnZXQ7XG5cdFx0XHR3aGlsZShyb290LnBhcmVudCAhPT0gbnVsbCl7XG5cdFx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcblx0XHRcdH1cblx0XHRcdHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cdFx0fWVsc2V7XG5cdFx0XHRpZih0aGlzLnN0YWdnZXJGcmFjdGlvbiAhPSAwKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcInN0YWdnZXJGcmFjdGlvbiBjYW4gb25seSBiZSB1c2VkIHdoZW4gVHJhbnNpdGlvblRvJ3MgdGFyZ2V0IGlzIGFuIEVYUC5UcmFuc2Zvcm1hdGlvbiFcIik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly9iZWdpblxuXHRcdHRoaXMuX3VwZGF0ZUNhbGxiYWNrID0gdGhpcy51cGRhdGUuYmluZCh0aGlzKVxuXHRcdHRocmVlRW52aXJvbm1lbnQub24oXCJ1cGRhdGVcIix0aGlzLl91cGRhdGVDYWxsYmFjayk7XG5cdH1cblx0dXBkYXRlKHRpbWUpe1xuXHRcdHRoaXMuZWxhcHNlZFRpbWUgKz0gdGltZS5yZWFsdGltZURlbHRhO1x0XG5cblx0XHRsZXQgcGVyY2VudGFnZSA9IHRoaXMuZWxhcHNlZFRpbWUvdGhpcy5kdXJhdGlvbjtcblxuXHRcdC8vaW50ZXJwb2xhdGUgdmFsdWVzXG5cdFx0Zm9yKGxldCBwcm9wZXJ0eSBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdHRoaXMuaW50ZXJwb2xhdGUocGVyY2VudGFnZSwgcHJvcGVydHksIHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0sdGhpcy50b1ZhbHVlc1twcm9wZXJ0eV0pO1xuXHRcdH1cblxuXHRcdGlmKHRoaXMuZWxhcHNlZFRpbWUgPj0gdGhpcy5kdXJhdGlvbil7XG5cdFx0XHR0aGlzLmVuZCgpO1xuXHRcdH1cblx0fVxuXHRpbnRlcnBvbGF0ZShwZXJjZW50YWdlLCBwcm9wZXJ0eU5hbWUsIGZyb21WYWx1ZSwgdG9WYWx1ZSl7XG5cdFx0Y29uc3QgbnVtT2JqZWN0cyA9IHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXG5cdFx0dmFyIG5ld1ZhbHVlID0gbnVsbDtcblx0XHRpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mKGZyb21WYWx1ZSkgPT09IFwibnVtYmVyXCIpe1xuXHRcdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BlcnR5TmFtZV0gPSB0KnRvVmFsdWUgKyAoMS10KSpmcm9tVmFsdWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXNGdW5jdGlvbih0b1ZhbHVlKSAmJiBVdGlscy5pc0Z1bmN0aW9uKGZyb21WYWx1ZSkpe1xuXHRcdFx0Ly9pZiBzdGFnZ2VyRnJhY3Rpb24gIT0gMCwgaXQncyB0aGUgYW1vdW50IG9mIHRpbWUgYmV0d2VlbiB0aGUgZmlyc3QgcG9pbnQncyBzdGFydCB0aW1lIGFuZCB0aGUgbGFzdCBwb2ludCdzIHN0YXJ0IHRpbWUuXG5cdFx0XHQvL0FTU1VNUFRJT046IHRoZSBmaXJzdCB2YXJpYWJsZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGksIGFuZCBpdCdzIGFzc3VtZWQgaSBpcyB6ZXJvLWluZGV4ZWQuXG5cblx0XHRcdC8vZW5jYXBzdWxhdGUgcGVyY2VudGFnZVxuXHRcdFx0dGhpcy50YXJnZXRbcHJvcGVydHlOYW1lXSA9IChmdW5jdGlvbihpLCAuLi5jb29yZHMpe1xuXHRcdFx0XHRsZXQgbGVycEZhY3RvciA9IHBlcmNlbnRhZ2UvKDEtdGhpcy5zdGFnZ2VyRnJhY3Rpb24pIC0gaSp0aGlzLnN0YWdnZXJGcmFjdGlvbi90aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHRcdFx0Ly9sZXQgcGVyY2VudCA9IE1hdGgubWluKE1hdGgubWF4KHBlcmNlbnRhZ2UgLSBpL3RoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uICAgLDEpLDApO1xuXG5cdFx0XHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24oTWF0aC5tYXgoTWF0aC5taW4obGVycEZhY3RvciwxKSwwKSk7XG5cdFx0XHRcdHJldHVybiBtYXRoLmxlcnBWZWN0b3JzKHQsdG9WYWx1ZShpLCAuLi5jb29yZHMpLGZyb21WYWx1ZShpLCAuLi5jb29yZHMpKVxuXHRcdFx0fSkuYmluZCh0aGlzKTtcblx0XHRcdHJldHVybjtcblx0XHR9ZWxzZXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJBbmltYXRpb24gY2xhc3MgY2Fubm90IHlldCBoYW5kbGUgdHJhbnNpdGlvbmluZyBiZXR3ZWVuIHRoaW5ncyB0aGF0IGFyZW4ndCBudW1iZXJzIG9yIGZ1bmN0aW9ucyFcIik7XG5cdFx0fVxuXG5cdH1cblx0aW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHgpe1xuXHRcdHJldHVybiB0aGlzLmNvc2luZUludGVycG9sYXRpb24oeCk7XG5cdH1cblx0Y29zaW5lSW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4gKDEtTWF0aC5jb3MoeCpNYXRoLlBJKSkvMjtcblx0fVxuXHRsaW5lYXJJbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiB4O1xuXHR9XG5cdGVuZCgpe1xuXHRcdGZvcih2YXIgcHJvcCBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BdID0gdGhpcy50b1ZhbHVlc1twcm9wXTtcblx0XHR9XG5cdFx0dGhyZWVFbnZpcm9ubWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwidXBkYXRlXCIsdGhpcy5fdXBkYXRlQ2FsbGJhY2spO1xuXHRcdC8vVG9kbzogZGVsZXRlIHRoaXNcblx0fVxufVxuXG4vL3RvZG86IHB1dCB0aGlzIGludG8gYSBEaXJlY3RvciBjbGFzcyBzbyB0aGF0IGl0IGNhbiBoYXZlIGFuIHVuZG8gc3RhY2tcbmZ1bmN0aW9uIFRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TLCBzdGFnZ2VyRnJhY3Rpb24pe1xuXHR2YXIgYW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDAsIHN0YWdnZXJGcmFjdGlvbik7XG59XG5cbmV4cG9ydCB7VHJhbnNpdGlvblRvLCBBbmltYXRpb259XG4iLCIoZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgbG9va3VwID0gW1xuXHRcdFx0J0EnLCAnQicsICdDJywgJ0QnLCAnRScsICdGJywgJ0cnLCAnSCcsXG5cdFx0XHQnSScsICdKJywgJ0snLCAnTCcsICdNJywgJ04nLCAnTycsICdQJyxcblx0XHRcdCdRJywgJ1InLCAnUycsICdUJywgJ1UnLCAnVicsICdXJywgJ1gnLFxuXHRcdFx0J1knLCAnWicsICdhJywgJ2InLCAnYycsICdkJywgJ2UnLCAnZicsXG5cdFx0XHQnZycsICdoJywgJ2knLCAnaicsICdrJywgJ2wnLCAnbScsICduJyxcblx0XHRcdCdvJywgJ3AnLCAncScsICdyJywgJ3MnLCAndCcsICd1JywgJ3YnLFxuXHRcdFx0J3cnLCAneCcsICd5JywgJ3onLCAnMCcsICcxJywgJzInLCAnMycsXG5cdFx0XHQnNCcsICc1JywgJzYnLCAnNycsICc4JywgJzknLCAnKycsICcvJ1xuXHRcdF07XG5cdGZ1bmN0aW9uIGNsZWFuKGxlbmd0aCkge1xuXHRcdHZhciBpLCBidWZmZXIgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuXHRcdGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0YnVmZmVyW2ldID0gMDtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdGZ1bmN0aW9uIGV4dGVuZChvcmlnLCBsZW5ndGgsIGFkZExlbmd0aCwgbXVsdGlwbGVPZikge1xuXHRcdHZhciBuZXdTaXplID0gbGVuZ3RoICsgYWRkTGVuZ3RoLFxuXHRcdFx0YnVmZmVyID0gY2xlYW4oKHBhcnNlSW50KG5ld1NpemUgLyBtdWx0aXBsZU9mKSArIDEpICogbXVsdGlwbGVPZik7XG5cblx0XHRidWZmZXIuc2V0KG9yaWcpO1xuXG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdGZ1bmN0aW9uIHBhZChudW0sIGJ5dGVzLCBiYXNlKSB7XG5cdFx0bnVtID0gbnVtLnRvU3RyaW5nKGJhc2UgfHwgOCk7XG5cdFx0cmV0dXJuIFwiMDAwMDAwMDAwMDAwXCIuc3Vic3RyKG51bS5sZW5ndGggKyAxMiAtIGJ5dGVzKSArIG51bTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN0cmluZ1RvVWludDggKGlucHV0LCBvdXQsIG9mZnNldCkge1xuXHRcdHZhciBpLCBsZW5ndGg7XG5cblx0XHRvdXQgPSBvdXQgfHwgY2xlYW4oaW5wdXQubGVuZ3RoKTtcblxuXHRcdG9mZnNldCA9IG9mZnNldCB8fCAwO1xuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IGlucHV0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRvdXRbb2Zmc2V0XSA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRvZmZzZXQgKz0gMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0O1xuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoO1xuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gKyBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArIGxvb2t1cFtudW0gJiAweDNGXTtcblx0XHR9O1xuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSk7XG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApO1xuXHRcdH1cblxuXHRcdC8vIHRoaXMgcHJldmVudHMgYW4gRVJSX0lOVkFMSURfVVJMIGluIENocm9tZSAoRmlyZWZveCBva2F5KVxuXHRcdHN3aXRjaCAob3V0cHV0Lmxlbmd0aCAlIDQpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0b3V0cHV0ICs9ICc9Jztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdG91dHB1dCArPSAnPT0nO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHR3aW5kb3cudXRpbHMgPSB7fVxuXHR3aW5kb3cudXRpbHMuY2xlYW4gPSBjbGVhbjtcblx0d2luZG93LnV0aWxzLnBhZCA9IHBhZDtcblx0d2luZG93LnV0aWxzLmV4dGVuZCA9IGV4dGVuZDtcblx0d2luZG93LnV0aWxzLnN0cmluZ1RvVWludDggPSBzdHJpbmdUb1VpbnQ4O1xuXHR3aW5kb3cudXRpbHMudWludDhUb0Jhc2U2NCA9IHVpbnQ4VG9CYXNlNjQ7XG59KCkpO1xuXG4oZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuLypcbnN0cnVjdCBwb3NpeF9oZWFkZXIgeyAgICAgICAgICAgICAvLyBieXRlIG9mZnNldFxuXHRjaGFyIG5hbWVbMTAwXTsgICAgICAgICAgICAgICAvLyAgIDBcblx0Y2hhciBtb2RlWzhdOyAgICAgICAgICAgICAgICAgLy8gMTAwXG5cdGNoYXIgdWlkWzhdOyAgICAgICAgICAgICAgICAgIC8vIDEwOFxuXHRjaGFyIGdpZFs4XTsgICAgICAgICAgICAgICAgICAvLyAxMTZcblx0Y2hhciBzaXplWzEyXTsgICAgICAgICAgICAgICAgLy8gMTI0XG5cdGNoYXIgbXRpbWVbMTJdOyAgICAgICAgICAgICAgIC8vIDEzNlxuXHRjaGFyIGNoa3N1bVs4XTsgICAgICAgICAgICAgICAvLyAxNDhcblx0Y2hhciB0eXBlZmxhZzsgICAgICAgICAgICAgICAgLy8gMTU2XG5cdGNoYXIgbGlua25hbWVbMTAwXTsgICAgICAgICAgIC8vIDE1N1xuXHRjaGFyIG1hZ2ljWzZdOyAgICAgICAgICAgICAgICAvLyAyNTdcblx0Y2hhciB2ZXJzaW9uWzJdOyAgICAgICAgICAgICAgLy8gMjYzXG5cdGNoYXIgdW5hbWVbMzJdOyAgICAgICAgICAgICAgIC8vIDI2NVxuXHRjaGFyIGduYW1lWzMyXTsgICAgICAgICAgICAgICAvLyAyOTdcblx0Y2hhciBkZXZtYWpvcls4XTsgICAgICAgICAgICAgLy8gMzI5XG5cdGNoYXIgZGV2bWlub3JbOF07ICAgICAgICAgICAgIC8vIDMzN1xuXHRjaGFyIHByZWZpeFsxNTVdOyAgICAgICAgICAgICAvLyAzNDVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyA1MDBcbn07XG4qL1xuXG5cdHZhciB1dGlscyA9IHdpbmRvdy51dGlscyxcblx0XHRoZWFkZXJGb3JtYXQ7XG5cblx0aGVhZGVyRm9ybWF0ID0gW1xuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlTmFtZScsXG5cdFx0XHQnbGVuZ3RoJzogMTAwXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZU1vZGUnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd1aWQnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdnaWQnLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlU2l6ZScsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtdGltZScsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdjaGVja3N1bScsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3R5cGUnLFxuXHRcdFx0J2xlbmd0aCc6IDFcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdsaW5rTmFtZScsXG5cdFx0XHQnbGVuZ3RoJzogMTAwXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndXN0YXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdvd25lcicsXG5cdFx0XHQnbGVuZ3RoJzogMzJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdncm91cCcsXG5cdFx0XHQnbGVuZ3RoJzogMzJcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtYWpvck51bWJlcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ21pbm9yTnVtYmVyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZW5hbWVQcmVmaXgnLFxuXHRcdFx0J2xlbmd0aCc6IDE1NVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3BhZGRpbmcnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fVxuXHRdO1xuXG5cdGZ1bmN0aW9uIGZvcm1hdEhlYWRlcihkYXRhLCBjYikge1xuXHRcdHZhciBidWZmZXIgPSB1dGlscy5jbGVhbig1MTIpLFxuXHRcdFx0b2Zmc2V0ID0gMDtcblxuXHRcdGhlYWRlckZvcm1hdC5mb3JFYWNoKGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0dmFyIHN0ciA9IGRhdGFbdmFsdWUuZmllbGRdIHx8IFwiXCIsXG5cdFx0XHRcdGksIGxlbmd0aDtcblxuXHRcdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gc3RyLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRcdGJ1ZmZlcltvZmZzZXRdID0gc3RyLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHRcdG9mZnNldCArPSAxO1xuXHRcdFx0fVxuXG5cdFx0XHRvZmZzZXQgKz0gdmFsdWUubGVuZ3RoIC0gaTsgLy8gc3BhY2UgaXQgb3V0IHdpdGggbnVsbHNcblx0XHR9KTtcblxuXHRcdGlmICh0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiBjYihidWZmZXIsIG9mZnNldCk7XG5cdFx0fVxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHR3aW5kb3cuaGVhZGVyID0ge31cblx0d2luZG93LmhlYWRlci5zdHJ1Y3R1cmUgPSBoZWFkZXJGb3JtYXQ7XG5cdHdpbmRvdy5oZWFkZXIuZm9ybWF0ID0gZm9ybWF0SGVhZGVyO1xufSgpKTtcblxuKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIGhlYWRlciA9IHdpbmRvdy5oZWFkZXIsXG5cdFx0dXRpbHMgPSB3aW5kb3cudXRpbHMsXG5cdFx0cmVjb3JkU2l6ZSA9IDUxMixcblx0XHRibG9ja1NpemU7XG5cblx0ZnVuY3Rpb24gVGFyKHJlY29yZHNQZXJCbG9jaykge1xuXHRcdHRoaXMud3JpdHRlbiA9IDA7XG5cdFx0YmxvY2tTaXplID0gKHJlY29yZHNQZXJCbG9jayB8fCAyMCkgKiByZWNvcmRTaXplO1xuXHRcdHRoaXMub3V0ID0gdXRpbHMuY2xlYW4oYmxvY2tTaXplKTtcblx0XHR0aGlzLmJsb2NrcyA9IFtdO1xuXHRcdHRoaXMubGVuZ3RoID0gMDtcblx0fVxuXG5cdFRhci5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24gKGZpbGVwYXRoLCBpbnB1dCwgb3B0cywgY2FsbGJhY2spIHtcblx0XHR2YXIgZGF0YSxcblx0XHRcdGNoZWNrc3VtLFxuXHRcdFx0bW9kZSxcblx0XHRcdG10aW1lLFxuXHRcdFx0dWlkLFxuXHRcdFx0Z2lkLFxuXHRcdFx0aGVhZGVyQXJyO1xuXG5cdFx0aWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGlucHV0ID0gdXRpbHMuc3RyaW5nVG9VaW50OChpbnB1dCk7XG5cdFx0fSBlbHNlIGlmIChpbnB1dC5jb25zdHJ1Y3RvciAhPT0gVWludDhBcnJheS5wcm90b3R5cGUuY29uc3RydWN0b3IpIHtcblx0XHRcdHRocm93ICdJbnZhbGlkIGlucHV0IHR5cGUuIFlvdSBnYXZlIG1lOiAnICsgaW5wdXQuY29uc3RydWN0b3IudG9TdHJpbmcoKS5tYXRjaCgvZnVuY3Rpb25cXHMqKFskQS1aYS16X11bMC05QS1aYS16X10qKVxccypcXCgvKVsxXTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGNhbGxiYWNrID0gb3B0cztcblx0XHRcdG9wdHMgPSB7fTtcblx0XHR9XG5cblx0XHRvcHRzID0gb3B0cyB8fCB7fTtcblxuXHRcdG1vZGUgPSBvcHRzLm1vZGUgfHwgcGFyc2VJbnQoJzc3NycsIDgpICYgMHhmZmY7XG5cdFx0bXRpbWUgPSBvcHRzLm10aW1lIHx8IE1hdGguZmxvb3IoK25ldyBEYXRlKCkgLyAxMDAwKTtcblx0XHR1aWQgPSBvcHRzLnVpZCB8fCAwO1xuXHRcdGdpZCA9IG9wdHMuZ2lkIHx8IDA7XG5cblx0XHRkYXRhID0ge1xuXHRcdFx0ZmlsZU5hbWU6IGZpbGVwYXRoLFxuXHRcdFx0ZmlsZU1vZGU6IHV0aWxzLnBhZChtb2RlLCA3KSxcblx0XHRcdHVpZDogdXRpbHMucGFkKHVpZCwgNyksXG5cdFx0XHRnaWQ6IHV0aWxzLnBhZChnaWQsIDcpLFxuXHRcdFx0ZmlsZVNpemU6IHV0aWxzLnBhZChpbnB1dC5sZW5ndGgsIDExKSxcblx0XHRcdG10aW1lOiB1dGlscy5wYWQobXRpbWUsIDExKSxcblx0XHRcdGNoZWNrc3VtOiAnICAgICAgICAnLFxuXHRcdFx0dHlwZTogJzAnLCAvLyBqdXN0IGEgZmlsZVxuXHRcdFx0dXN0YXI6ICd1c3RhciAgJyxcblx0XHRcdG93bmVyOiBvcHRzLm93bmVyIHx8ICcnLFxuXHRcdFx0Z3JvdXA6IG9wdHMuZ3JvdXAgfHwgJydcblx0XHR9O1xuXG5cdFx0Ly8gY2FsY3VsYXRlIHRoZSBjaGVja3N1bVxuXHRcdGNoZWNrc3VtID0gMDtcblx0XHRPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdHZhciBpLCB2YWx1ZSA9IGRhdGFba2V5XSwgbGVuZ3RoO1xuXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB2YWx1ZS5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0XHRjaGVja3N1bSArPSB2YWx1ZS5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0ZGF0YS5jaGVja3N1bSA9IHV0aWxzLnBhZChjaGVja3N1bSwgNikgKyBcIlxcdTAwMDAgXCI7XG5cblx0XHRoZWFkZXJBcnIgPSBoZWFkZXIuZm9ybWF0KGRhdGEpO1xuXG5cdFx0dmFyIGhlYWRlckxlbmd0aCA9IE1hdGguY2VpbCggaGVhZGVyQXJyLmxlbmd0aCAvIHJlY29yZFNpemUgKSAqIHJlY29yZFNpemU7XG5cdFx0dmFyIGlucHV0TGVuZ3RoID0gTWF0aC5jZWlsKCBpbnB1dC5sZW5ndGggLyByZWNvcmRTaXplICkgKiByZWNvcmRTaXplO1xuXG5cdFx0dGhpcy5ibG9ja3MucHVzaCggeyBoZWFkZXI6IGhlYWRlckFyciwgaW5wdXQ6IGlucHV0LCBoZWFkZXJMZW5ndGg6IGhlYWRlckxlbmd0aCwgaW5wdXRMZW5ndGg6IGlucHV0TGVuZ3RoIH0gKTtcblxuXHR9O1xuXG5cdFRhci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGJ1ZmZlcnMgPSBbXTtcblx0XHR2YXIgY2h1bmtzID0gW107XG5cdFx0dmFyIGxlbmd0aCA9IDA7XG5cdFx0dmFyIG1heCA9IE1hdGgucG93KCAyLCAyMCApO1xuXG5cdFx0dmFyIGNodW5rID0gW107XG5cdFx0dGhpcy5ibG9ja3MuZm9yRWFjaCggZnVuY3Rpb24oIGIgKSB7XG5cdFx0XHRpZiggbGVuZ3RoICsgYi5oZWFkZXJMZW5ndGggKyBiLmlucHV0TGVuZ3RoID4gbWF4ICkge1xuXHRcdFx0XHRjaHVua3MucHVzaCggeyBibG9ja3M6IGNodW5rLCBsZW5ndGg6IGxlbmd0aCB9ICk7XG5cdFx0XHRcdGNodW5rID0gW107XG5cdFx0XHRcdGxlbmd0aCA9IDA7XG5cdFx0XHR9XG5cdFx0XHRjaHVuay5wdXNoKCBiICk7XG5cdFx0XHRsZW5ndGggKz0gYi5oZWFkZXJMZW5ndGggKyBiLmlucHV0TGVuZ3RoO1xuXHRcdH0gKTtcblx0XHRjaHVua3MucHVzaCggeyBibG9ja3M6IGNodW5rLCBsZW5ndGg6IGxlbmd0aCB9ICk7XG5cblx0XHRjaHVua3MuZm9yRWFjaCggZnVuY3Rpb24oIGMgKSB7XG5cblx0XHRcdHZhciBidWZmZXIgPSBuZXcgVWludDhBcnJheSggYy5sZW5ndGggKTtcblx0XHRcdHZhciB3cml0dGVuID0gMDtcblx0XHRcdGMuYmxvY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBiICkge1xuXHRcdFx0XHRidWZmZXIuc2V0KCBiLmhlYWRlciwgd3JpdHRlbiApO1xuXHRcdFx0XHR3cml0dGVuICs9IGIuaGVhZGVyTGVuZ3RoO1xuXHRcdFx0XHRidWZmZXIuc2V0KCBiLmlucHV0LCB3cml0dGVuICk7XG5cdFx0XHRcdHdyaXR0ZW4gKz0gYi5pbnB1dExlbmd0aDtcblx0XHRcdH0gKTtcblx0XHRcdGJ1ZmZlcnMucHVzaCggYnVmZmVyICk7XG5cblx0XHR9ICk7XG5cblx0XHRidWZmZXJzLnB1c2goIG5ldyBVaW50OEFycmF5KCAyICogcmVjb3JkU2l6ZSApICk7XG5cblx0XHRyZXR1cm4gbmV3IEJsb2IoIGJ1ZmZlcnMsIHsgdHlwZTogJ29jdGV0L3N0cmVhbScgfSApO1xuXG5cdH07XG5cblx0VGFyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLndyaXR0ZW4gPSAwO1xuXHRcdHRoaXMub3V0ID0gdXRpbHMuY2xlYW4oYmxvY2tTaXplKTtcblx0fTtcblxuICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gVGFyO1xuICB9IGVsc2Uge1xuICAgIHdpbmRvdy5UYXIgPSBUYXI7XG4gIH1cbn0oKSk7XG4iLCIvL2Rvd25sb2FkLmpzIHYzLjAsIGJ5IGRhbmRhdmlzOyAyMDA4LTIwMTQuIFtDQ0JZMl0gc2VlIGh0dHA6Ly9kYW5tbC5jb20vZG93bmxvYWQuaHRtbCBmb3IgdGVzdHMvdXNhZ2Vcbi8vIHYxIGxhbmRlZCBhIEZGK0Nocm9tZSBjb21wYXQgd2F5IG9mIGRvd25sb2FkaW5nIHN0cmluZ3MgdG8gbG9jYWwgdW4tbmFtZWQgZmlsZXMsIHVwZ3JhZGVkIHRvIHVzZSBhIGhpZGRlbiBmcmFtZSBhbmQgb3B0aW9uYWwgbWltZVxuLy8gdjIgYWRkZWQgbmFtZWQgZmlsZXMgdmlhIGFbZG93bmxvYWRdLCBtc1NhdmVCbG9iLCBJRSAoMTArKSBzdXBwb3J0LCBhbmQgd2luZG93LlVSTCBzdXBwb3J0IGZvciBsYXJnZXIrZmFzdGVyIHNhdmVzIHRoYW4gZGF0YVVSTHNcbi8vIHYzIGFkZGVkIGRhdGFVUkwgYW5kIEJsb2IgSW5wdXQsIGJpbmQtdG9nZ2xlIGFyaXR5LCBhbmQgbGVnYWN5IGRhdGFVUkwgZmFsbGJhY2sgd2FzIGltcHJvdmVkIHdpdGggZm9yY2UtZG93bmxvYWQgbWltZSBhbmQgYmFzZTY0IHN1cHBvcnRcblxuLy8gZGF0YSBjYW4gYmUgYSBzdHJpbmcsIEJsb2IsIEZpbGUsIG9yIGRhdGFVUkxcblxuXG5cblxuZnVuY3Rpb24gZG93bmxvYWQoZGF0YSwgc3RyRmlsZU5hbWUsIHN0ck1pbWVUeXBlKSB7XG5cblx0dmFyIHNlbGYgPSB3aW5kb3csIC8vIHRoaXMgc2NyaXB0IGlzIG9ubHkgZm9yIGJyb3dzZXJzIGFueXdheS4uLlxuXHRcdHUgPSBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiLCAvLyB0aGlzIGRlZmF1bHQgbWltZSBhbHNvIHRyaWdnZXJzIGlmcmFtZSBkb3dubG9hZHNcblx0XHRtID0gc3RyTWltZVR5cGUgfHwgdSxcblx0XHR4ID0gZGF0YSxcblx0XHREID0gZG9jdW1lbnQsXG5cdFx0YSA9IEQuY3JlYXRlRWxlbWVudChcImFcIiksXG5cdFx0eiA9IGZ1bmN0aW9uKGEpe3JldHVybiBTdHJpbmcoYSk7fSxcblxuXG5cdFx0QiA9IHNlbGYuQmxvYiB8fCBzZWxmLk1vekJsb2IgfHwgc2VsZi5XZWJLaXRCbG9iIHx8IHosXG5cdFx0QkIgPSBzZWxmLk1TQmxvYkJ1aWxkZXIgfHwgc2VsZi5XZWJLaXRCbG9iQnVpbGRlciB8fCBzZWxmLkJsb2JCdWlsZGVyLFxuXHRcdGZuID0gc3RyRmlsZU5hbWUgfHwgXCJkb3dubG9hZFwiLFxuXHRcdGJsb2IsXG5cdFx0Yixcblx0XHR1YSxcblx0XHRmcjtcblxuXHQvL2lmKHR5cGVvZiBCLmJpbmQgPT09ICdmdW5jdGlvbicgKXsgQj1CLmJpbmQoc2VsZik7IH1cblxuXHRpZihTdHJpbmcodGhpcyk9PT1cInRydWVcIil7IC8vcmV2ZXJzZSBhcmd1bWVudHMsIGFsbG93aW5nIGRvd25sb2FkLmJpbmQodHJ1ZSwgXCJ0ZXh0L3htbFwiLCBcImV4cG9ydC54bWxcIikgdG8gYWN0IGFzIGEgY2FsbGJhY2tcblx0XHR4PVt4LCBtXTtcblx0XHRtPXhbMF07XG5cdFx0eD14WzFdO1xuXHR9XG5cblxuXG5cdC8vZ28gYWhlYWQgYW5kIGRvd25sb2FkIGRhdGFVUkxzIHJpZ2h0IGF3YXlcblx0aWYoU3RyaW5nKHgpLm1hdGNoKC9eZGF0YVxcOltcXHcrXFwtXStcXC9bXFx3K1xcLV0rWyw7XS8pKXtcblx0XHRyZXR1cm4gbmF2aWdhdG9yLm1zU2F2ZUJsb2IgPyAgLy8gSUUxMCBjYW4ndCBkbyBhW2Rvd25sb2FkXSwgb25seSBCbG9iczpcblx0XHRcdG5hdmlnYXRvci5tc1NhdmVCbG9iKGQyYih4KSwgZm4pIDpcblx0XHRcdHNhdmVyKHgpIDsgLy8gZXZlcnlvbmUgZWxzZSBjYW4gc2F2ZSBkYXRhVVJMcyB1bi1wcm9jZXNzZWRcblx0fS8vZW5kIGlmIGRhdGFVUkwgcGFzc2VkP1xuXG5cdHRyeXtcblxuXHRcdGJsb2IgPSB4IGluc3RhbmNlb2YgQiA/XG5cdFx0XHR4IDpcblx0XHRcdG5ldyBCKFt4XSwge3R5cGU6IG19KSA7XG5cdH1jYXRjaCh5KXtcblx0XHRpZihCQil7XG5cdFx0XHRiID0gbmV3IEJCKCk7XG5cdFx0XHRiLmFwcGVuZChbeF0pO1xuXHRcdFx0YmxvYiA9IGIuZ2V0QmxvYihtKTsgLy8gdGhlIGJsb2Jcblx0XHR9XG5cblx0fVxuXG5cblxuXHRmdW5jdGlvbiBkMmIodSkge1xuXHRcdHZhciBwPSB1LnNwbGl0KC9bOjssXS8pLFxuXHRcdHQ9IHBbMV0sXG5cdFx0ZGVjPSBwWzJdID09IFwiYmFzZTY0XCIgPyBhdG9iIDogZGVjb2RlVVJJQ29tcG9uZW50LFxuXHRcdGJpbj0gZGVjKHAucG9wKCkpLFxuXHRcdG14PSBiaW4ubGVuZ3RoLFxuXHRcdGk9IDAsXG5cdFx0dWlhPSBuZXcgVWludDhBcnJheShteCk7XG5cblx0XHRmb3IoaTtpPG14OysraSkgdWlhW2ldPSBiaW4uY2hhckNvZGVBdChpKTtcblxuXHRcdHJldHVybiBuZXcgQihbdWlhXSwge3R5cGU6IHR9KTtcblx0IH1cblxuXHRmdW5jdGlvbiBzYXZlcih1cmwsIHdpbk1vZGUpe1xuXG5cblx0XHRpZiAoJ2Rvd25sb2FkJyBpbiBhKSB7IC8vaHRtbDUgQVtkb3dubG9hZF1cblx0XHRcdGEuaHJlZiA9IHVybDtcblx0XHRcdGEuc2V0QXR0cmlidXRlKFwiZG93bmxvYWRcIiwgZm4pO1xuXHRcdFx0YS5pbm5lckhUTUwgPSBcImRvd25sb2FkaW5nLi4uXCI7XG5cdFx0XHRhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRELmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRhLmNsaWNrKCk7XG5cdFx0XHRcdEQuYm9keS5yZW1vdmVDaGlsZChhKTtcblx0XHRcdFx0aWYod2luTW9kZT09PXRydWUpe3NldFRpbWVvdXQoZnVuY3Rpb24oKXsgc2VsZi5VUkwucmV2b2tlT2JqZWN0VVJMKGEuaHJlZik7fSwgMjUwICk7fVxuXHRcdFx0fSwgNjYpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly9kbyBpZnJhbWUgZGF0YVVSTCBkb3dubG9hZCAob2xkIGNoK0ZGKTpcblx0XHR2YXIgZiA9IEQuY3JlYXRlRWxlbWVudChcImlmcmFtZVwiKTtcblx0XHRELmJvZHkuYXBwZW5kQ2hpbGQoZik7XG5cdFx0aWYoIXdpbk1vZGUpeyAvLyBmb3JjZSBhIG1pbWUgdGhhdCB3aWxsIGRvd25sb2FkOlxuXHRcdFx0dXJsPVwiZGF0YTpcIit1cmwucmVwbGFjZSgvXmRhdGE6KFtcXHdcXC9cXC1cXCtdKykvLCB1KTtcblx0XHR9XG5cblxuXHRcdGYuc3JjID0gdXJsO1xuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXsgRC5ib2R5LnJlbW92ZUNoaWxkKGYpOyB9LCAzMzMpO1xuXG5cdH0vL2VuZCBzYXZlclxuXG5cblx0aWYgKG5hdmlnYXRvci5tc1NhdmVCbG9iKSB7IC8vIElFMTArIDogKGhhcyBCbG9iLCBidXQgbm90IGFbZG93bmxvYWRdIG9yIFVSTClcblx0XHRyZXR1cm4gbmF2aWdhdG9yLm1zU2F2ZUJsb2IoYmxvYiwgZm4pO1xuXHR9XG5cblx0aWYoc2VsZi5VUkwpeyAvLyBzaW1wbGUgZmFzdCBhbmQgbW9kZXJuIHdheSB1c2luZyBCbG9iIGFuZCBVUkw6XG5cdFx0c2F2ZXIoc2VsZi5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpLCB0cnVlKTtcblx0fWVsc2V7XG5cdFx0Ly8gaGFuZGxlIG5vbi1CbG9iKCkrbm9uLVVSTCBicm93c2Vyczpcblx0XHRpZih0eXBlb2YgYmxvYiA9PT0gXCJzdHJpbmdcIiB8fCBibG9iLmNvbnN0cnVjdG9yPT09eiApe1xuXHRcdFx0dHJ5e1xuXHRcdFx0XHRyZXR1cm4gc2F2ZXIoIFwiZGF0YTpcIiArICBtICAgKyBcIjtiYXNlNjQsXCIgICsgIHNlbGYuYnRvYShibG9iKSAgKTtcblx0XHRcdH1jYXRjaCh5KXtcblx0XHRcdFx0cmV0dXJuIHNhdmVyKCBcImRhdGE6XCIgKyAgbSAgICsgXCIsXCIgKyBlbmNvZGVVUklDb21wb25lbnQoYmxvYikgICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQmxvYiBidXQgbm90IFVSTDpcblx0XHRmcj1uZXcgRmlsZVJlYWRlcigpO1xuXHRcdGZyLm9ubG9hZD1mdW5jdGlvbihlKXtcblx0XHRcdHNhdmVyKHRoaXMucmVzdWx0KTtcblx0XHR9O1xuXHRcdGZyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG5cdH1cblx0cmV0dXJuIHRydWU7XG59IC8qIGVuZCBkb3dubG9hZCgpICovXG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZG93bmxvYWQ7XG59XG4iLCIvLyBnaWYuanMgMC4yLjAgLSBodHRwczovL2dpdGh1Yi5jb20vam5vcmRiZXJnL2dpZi5qc1xyXG4oZnVuY3Rpb24oZil7aWYodHlwZW9mIGV4cG9ydHM9PT1cIm9iamVjdFwiJiZ0eXBlb2YgbW9kdWxlIT09XCJ1bmRlZmluZWRcIil7bW9kdWxlLmV4cG9ydHM9ZigpfWVsc2UgaWYodHlwZW9mIGRlZmluZT09PVwiZnVuY3Rpb25cIiYmZGVmaW5lLmFtZCl7ZGVmaW5lKFtdLGYpfWVsc2V7dmFyIGc7aWYodHlwZW9mIHdpbmRvdyE9PVwidW5kZWZpbmVkXCIpe2c9d2luZG93fWVsc2UgaWYodHlwZW9mIGdsb2JhbCE9PVwidW5kZWZpbmVkXCIpe2c9Z2xvYmFsfWVsc2UgaWYodHlwZW9mIHNlbGYhPT1cInVuZGVmaW5lZFwiKXtnPXNlbGZ9ZWxzZXtnPXRoaXN9Zy5HSUY9ZigpfX0pKGZ1bmN0aW9uKCl7dmFyIGRlZmluZSxtb2R1bGUsZXhwb3J0cztyZXR1cm4gZnVuY3Rpb24oKXtmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc31yZXR1cm4gZX0oKSh7MTpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7ZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCl7dGhpcy5fZXZlbnRzPXRoaXMuX2V2ZW50c3x8e307dGhpcy5fbWF4TGlzdGVuZXJzPXRoaXMuX21heExpc3RlbmVyc3x8dW5kZWZpbmVkfW1vZHVsZS5leHBvcnRzPUV2ZW50RW1pdHRlcjtFdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyPUV2ZW50RW1pdHRlcjtFdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHM9dW5kZWZpbmVkO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycz11bmRlZmluZWQ7RXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM9MTA7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnM9ZnVuY3Rpb24obil7aWYoIWlzTnVtYmVyKG4pfHxuPDB8fGlzTmFOKG4pKXRocm93IFR5cGVFcnJvcihcIm4gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiKTt0aGlzLl9tYXhMaXN0ZW5lcnM9bjtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0PWZ1bmN0aW9uKHR5cGUpe3ZhciBlcixoYW5kbGVyLGxlbixhcmdzLGksbGlzdGVuZXJzO2lmKCF0aGlzLl9ldmVudHMpdGhpcy5fZXZlbnRzPXt9O2lmKHR5cGU9PT1cImVycm9yXCIpe2lmKCF0aGlzLl9ldmVudHMuZXJyb3J8fGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikmJiF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKXtlcj1hcmd1bWVudHNbMV07aWYoZXIgaW5zdGFuY2VvZiBFcnJvcil7dGhyb3cgZXJ9ZWxzZXt2YXIgZXJyPW5ldyBFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4gKCcrZXIrXCIpXCIpO2Vyci5jb250ZXh0PWVyO3Rocm93IGVycn19fWhhbmRsZXI9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzVW5kZWZpbmVkKGhhbmRsZXIpKXJldHVybiBmYWxzZTtpZihpc0Z1bmN0aW9uKGhhbmRsZXIpKXtzd2l0Y2goYXJndW1lbnRzLmxlbmd0aCl7Y2FzZSAxOmhhbmRsZXIuY2FsbCh0aGlzKTticmVhaztjYXNlIDI6aGFuZGxlci5jYWxsKHRoaXMsYXJndW1lbnRzWzFdKTticmVhaztjYXNlIDM6aGFuZGxlci5jYWxsKHRoaXMsYXJndW1lbnRzWzFdLGFyZ3VtZW50c1syXSk7YnJlYWs7ZGVmYXVsdDphcmdzPUFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKTtoYW5kbGVyLmFwcGx5KHRoaXMsYXJncyl9fWVsc2UgaWYoaXNPYmplY3QoaGFuZGxlcikpe2FyZ3M9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpO2xpc3RlbmVycz1oYW5kbGVyLnNsaWNlKCk7bGVuPWxpc3RlbmVycy5sZW5ndGg7Zm9yKGk9MDtpPGxlbjtpKyspbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsYXJncyl9cmV0dXJuIHRydWV9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7dmFyIG07aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTtpZighdGhpcy5fZXZlbnRzKXRoaXMuX2V2ZW50cz17fTtpZih0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpdGhpcy5lbWl0KFwibmV3TGlzdGVuZXJcIix0eXBlLGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpP2xpc3RlbmVyLmxpc3RlbmVyOmxpc3RlbmVyKTtpZighdGhpcy5fZXZlbnRzW3R5cGVdKXRoaXMuX2V2ZW50c1t0eXBlXT1saXN0ZW5lcjtlbHNlIGlmKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO2Vsc2UgdGhpcy5fZXZlbnRzW3R5cGVdPVt0aGlzLl9ldmVudHNbdHlwZV0sbGlzdGVuZXJdO2lmKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkmJiF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKXtpZighaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSl7bT10aGlzLl9tYXhMaXN0ZW5lcnN9ZWxzZXttPUV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzfWlmKG0mJm0+MCYmdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aD5tKXt0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkPXRydWU7Y29uc29sZS5lcnJvcihcIihub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5IFwiK1wibGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiBcIitcIlVzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LlwiLHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO2lmKHR5cGVvZiBjb25zb2xlLnRyYWNlPT09XCJmdW5jdGlvblwiKXtjb25zb2xlLnRyYWNlKCl9fX1yZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbj1FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO0V2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZT1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO3ZhciBmaXJlZD1mYWxzZTtmdW5jdGlvbiBnKCl7dGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGcpO2lmKCFmaXJlZCl7ZmlyZWQ9dHJ1ZTtsaXN0ZW5lci5hcHBseSh0aGlzLGFyZ3VtZW50cyl9fWcubGlzdGVuZXI9bGlzdGVuZXI7dGhpcy5vbih0eXBlLGcpO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe3ZhciBsaXN0LHBvc2l0aW9uLGxlbmd0aCxpO2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7aWYoIXRoaXMuX2V2ZW50c3x8IXRoaXMuX2V2ZW50c1t0eXBlXSlyZXR1cm4gdGhpcztsaXN0PXRoaXMuX2V2ZW50c1t0eXBlXTtsZW5ndGg9bGlzdC5sZW5ndGg7cG9zaXRpb249LTE7aWYobGlzdD09PWxpc3RlbmVyfHxpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpJiZsaXN0Lmxpc3RlbmVyPT09bGlzdGVuZXIpe2RlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07aWYodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsdHlwZSxsaXN0ZW5lcil9ZWxzZSBpZihpc09iamVjdChsaXN0KSl7Zm9yKGk9bGVuZ3RoO2ktLSA+MDspe2lmKGxpc3RbaV09PT1saXN0ZW5lcnx8bGlzdFtpXS5saXN0ZW5lciYmbGlzdFtpXS5saXN0ZW5lcj09PWxpc3RlbmVyKXtwb3NpdGlvbj1pO2JyZWFrfX1pZihwb3NpdGlvbjwwKXJldHVybiB0aGlzO2lmKGxpc3QubGVuZ3RoPT09MSl7bGlzdC5sZW5ndGg9MDtkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdfWVsc2V7bGlzdC5zcGxpY2UocG9zaXRpb24sMSl9aWYodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsdHlwZSxsaXN0ZW5lcil9cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzPWZ1bmN0aW9uKHR5cGUpe3ZhciBrZXksbGlzdGVuZXJzO2lmKCF0aGlzLl9ldmVudHMpcmV0dXJuIHRoaXM7aWYoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil7aWYoYXJndW1lbnRzLmxlbmd0aD09PTApdGhpcy5fZXZlbnRzPXt9O2Vsc2UgaWYodGhpcy5fZXZlbnRzW3R5cGVdKWRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07cmV0dXJuIHRoaXN9aWYoYXJndW1lbnRzLmxlbmd0aD09PTApe2ZvcihrZXkgaW4gdGhpcy5fZXZlbnRzKXtpZihrZXk9PT1cInJlbW92ZUxpc3RlbmVyXCIpY29udGludWU7dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KX10aGlzLnJlbW92ZUFsbExpc3RlbmVycyhcInJlbW92ZUxpc3RlbmVyXCIpO3RoaXMuX2V2ZW50cz17fTtyZXR1cm4gdGhpc31saXN0ZW5lcnM9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzRnVuY3Rpb24obGlzdGVuZXJzKSl7dGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGxpc3RlbmVycyl9ZWxzZSBpZihsaXN0ZW5lcnMpe3doaWxlKGxpc3RlbmVycy5sZW5ndGgpdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoLTFdKX1kZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycz1mdW5jdGlvbih0eXBlKXt2YXIgcmV0O2lmKCF0aGlzLl9ldmVudHN8fCF0aGlzLl9ldmVudHNbdHlwZV0pcmV0PVtdO2Vsc2UgaWYoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKXJldD1bdGhpcy5fZXZlbnRzW3R5cGVdXTtlbHNlIHJldD10aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtyZXR1cm4gcmV0fTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQ9ZnVuY3Rpb24odHlwZSl7aWYodGhpcy5fZXZlbnRzKXt2YXIgZXZsaXN0ZW5lcj10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlyZXR1cm4gMTtlbHNlIGlmKGV2bGlzdGVuZXIpcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RofXJldHVybiAwfTtFdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudD1mdW5jdGlvbihlbWl0dGVyLHR5cGUpe3JldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSl9O2Z1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwiZnVuY3Rpb25cIn1mdW5jdGlvbiBpc051bWJlcihhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJudW1iZXJcIn1mdW5jdGlvbiBpc09iamVjdChhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJvYmplY3RcIiYmYXJnIT09bnVsbH1mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpe3JldHVybiBhcmc9PT12b2lkIDB9fSx7fV0sMjpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIE5ldVF1YW50PXJlcXVpcmUoXCIuL1R5cGVkTmV1UXVhbnQuanNcIik7dmFyIExaV0VuY29kZXI9cmVxdWlyZShcIi4vTFpXRW5jb2Rlci5qc1wiKTtmdW5jdGlvbiBCeXRlQXJyYXkoKXt0aGlzLnBhZ2U9LTE7dGhpcy5wYWdlcz1bXTt0aGlzLm5ld1BhZ2UoKX1CeXRlQXJyYXkucGFnZVNpemU9NDA5NjtCeXRlQXJyYXkuY2hhck1hcD17fTtmb3IodmFyIGk9MDtpPDI1NjtpKyspQnl0ZUFycmF5LmNoYXJNYXBbaV09U3RyaW5nLmZyb21DaGFyQ29kZShpKTtCeXRlQXJyYXkucHJvdG90eXBlLm5ld1BhZ2U9ZnVuY3Rpb24oKXt0aGlzLnBhZ2VzWysrdGhpcy5wYWdlXT1uZXcgVWludDhBcnJheShCeXRlQXJyYXkucGFnZVNpemUpO3RoaXMuY3Vyc29yPTB9O0J5dGVBcnJheS5wcm90b3R5cGUuZ2V0RGF0YT1mdW5jdGlvbigpe3ZhciBydj1cIlwiO2Zvcih2YXIgcD0wO3A8dGhpcy5wYWdlcy5sZW5ndGg7cCsrKXtmb3IodmFyIGk9MDtpPEJ5dGVBcnJheS5wYWdlU2l6ZTtpKyspe3J2Kz1CeXRlQXJyYXkuY2hhck1hcFt0aGlzLnBhZ2VzW3BdW2ldXX19cmV0dXJuIHJ2fTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlQnl0ZT1mdW5jdGlvbih2YWwpe2lmKHRoaXMuY3Vyc29yPj1CeXRlQXJyYXkucGFnZVNpemUpdGhpcy5uZXdQYWdlKCk7dGhpcy5wYWdlc1t0aGlzLnBhZ2VdW3RoaXMuY3Vyc29yKytdPXZhbH07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZVVURkJ5dGVzPWZ1bmN0aW9uKHN0cmluZyl7Zm9yKHZhciBsPXN0cmluZy5sZW5ndGgsaT0wO2k8bDtpKyspdGhpcy53cml0ZUJ5dGUoc3RyaW5nLmNoYXJDb2RlQXQoaSkpfTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlQnl0ZXM9ZnVuY3Rpb24oYXJyYXksb2Zmc2V0LGxlbmd0aCl7Zm9yKHZhciBsPWxlbmd0aHx8YXJyYXkubGVuZ3RoLGk9b2Zmc2V0fHwwO2k8bDtpKyspdGhpcy53cml0ZUJ5dGUoYXJyYXlbaV0pfTtmdW5jdGlvbiBHSUZFbmNvZGVyKHdpZHRoLGhlaWdodCl7dGhpcy53aWR0aD1+fndpZHRoO3RoaXMuaGVpZ2h0PX5+aGVpZ2h0O3RoaXMudHJhbnNwYXJlbnQ9bnVsbDt0aGlzLnRyYW5zSW5kZXg9MDt0aGlzLnJlcGVhdD0tMTt0aGlzLmRlbGF5PTA7dGhpcy5pbWFnZT1udWxsO3RoaXMucGl4ZWxzPW51bGw7dGhpcy5pbmRleGVkUGl4ZWxzPW51bGw7dGhpcy5jb2xvckRlcHRoPW51bGw7dGhpcy5jb2xvclRhYj1udWxsO3RoaXMubmV1UXVhbnQ9bnVsbDt0aGlzLnVzZWRFbnRyeT1uZXcgQXJyYXk7dGhpcy5wYWxTaXplPTc7dGhpcy5kaXNwb3NlPS0xO3RoaXMuZmlyc3RGcmFtZT10cnVlO3RoaXMuc2FtcGxlPTEwO3RoaXMuZGl0aGVyPWZhbHNlO3RoaXMuZ2xvYmFsUGFsZXR0ZT1mYWxzZTt0aGlzLm91dD1uZXcgQnl0ZUFycmF5fUdJRkVuY29kZXIucHJvdG90eXBlLnNldERlbGF5PWZ1bmN0aW9uKG1pbGxpc2Vjb25kcyl7dGhpcy5kZWxheT1NYXRoLnJvdW5kKG1pbGxpc2Vjb25kcy8xMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldEZyYW1lUmF0ZT1mdW5jdGlvbihmcHMpe3RoaXMuZGVsYXk9TWF0aC5yb3VuZCgxMDAvZnBzKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGlzcG9zZT1mdW5jdGlvbihkaXNwb3NhbENvZGUpe2lmKGRpc3Bvc2FsQ29kZT49MCl0aGlzLmRpc3Bvc2U9ZGlzcG9zYWxDb2RlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRSZXBlYXQ9ZnVuY3Rpb24ocmVwZWF0KXt0aGlzLnJlcGVhdD1yZXBlYXR9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFRyYW5zcGFyZW50PWZ1bmN0aW9uKGNvbG9yKXt0aGlzLnRyYW5zcGFyZW50PWNvbG9yfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGRGcmFtZT1mdW5jdGlvbihpbWFnZURhdGEpe3RoaXMuaW1hZ2U9aW1hZ2VEYXRhO3RoaXMuY29sb3JUYWI9dGhpcy5nbG9iYWxQYWxldHRlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2U/dGhpcy5nbG9iYWxQYWxldHRlOm51bGw7dGhpcy5nZXRJbWFnZVBpeGVscygpO3RoaXMuYW5hbHl6ZVBpeGVscygpO2lmKHRoaXMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpdGhpcy5nbG9iYWxQYWxldHRlPXRoaXMuY29sb3JUYWI7aWYodGhpcy5maXJzdEZyYW1lKXt0aGlzLndyaXRlTFNEKCk7dGhpcy53cml0ZVBhbGV0dGUoKTtpZih0aGlzLnJlcGVhdD49MCl7dGhpcy53cml0ZU5ldHNjYXBlRXh0KCl9fXRoaXMud3JpdGVHcmFwaGljQ3RybEV4dCgpO3RoaXMud3JpdGVJbWFnZURlc2MoKTtpZighdGhpcy5maXJzdEZyYW1lJiYhdGhpcy5nbG9iYWxQYWxldHRlKXRoaXMud3JpdGVQYWxldHRlKCk7dGhpcy53cml0ZVBpeGVscygpO3RoaXMuZmlyc3RGcmFtZT1mYWxzZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluaXNoPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDU5KX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0UXVhbGl0eT1mdW5jdGlvbihxdWFsaXR5KXtpZihxdWFsaXR5PDEpcXVhbGl0eT0xO3RoaXMuc2FtcGxlPXF1YWxpdHl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldERpdGhlcj1mdW5jdGlvbihkaXRoZXIpe2lmKGRpdGhlcj09PXRydWUpZGl0aGVyPVwiRmxveWRTdGVpbmJlcmdcIjt0aGlzLmRpdGhlcj1kaXRoZXJ9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldEdsb2JhbFBhbGV0dGU9ZnVuY3Rpb24ocGFsZXR0ZSl7dGhpcy5nbG9iYWxQYWxldHRlPXBhbGV0dGV9O0dJRkVuY29kZXIucHJvdG90eXBlLmdldEdsb2JhbFBhbGV0dGU9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5nbG9iYWxQYWxldHRlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2UmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZSgwKXx8dGhpcy5nbG9iYWxQYWxldHRlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUhlYWRlcj1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlVVRGQnl0ZXMoXCJHSUY4OWFcIil9O0dJRkVuY29kZXIucHJvdG90eXBlLmFuYWx5emVQaXhlbHM9ZnVuY3Rpb24oKXtpZighdGhpcy5jb2xvclRhYil7dGhpcy5uZXVRdWFudD1uZXcgTmV1UXVhbnQodGhpcy5waXhlbHMsdGhpcy5zYW1wbGUpO3RoaXMubmV1UXVhbnQuYnVpbGRDb2xvcm1hcCgpO3RoaXMuY29sb3JUYWI9dGhpcy5uZXVRdWFudC5nZXRDb2xvcm1hcCgpfWlmKHRoaXMuZGl0aGVyKXt0aGlzLmRpdGhlclBpeGVscyh0aGlzLmRpdGhlci5yZXBsYWNlKFwiLXNlcnBlbnRpbmVcIixcIlwiKSx0aGlzLmRpdGhlci5tYXRjaCgvLXNlcnBlbnRpbmUvKSE9PW51bGwpfWVsc2V7dGhpcy5pbmRleFBpeGVscygpfXRoaXMucGl4ZWxzPW51bGw7dGhpcy5jb2xvckRlcHRoPTg7dGhpcy5wYWxTaXplPTc7aWYodGhpcy50cmFuc3BhcmVudCE9PW51bGwpe3RoaXMudHJhbnNJbmRleD10aGlzLmZpbmRDbG9zZXN0KHRoaXMudHJhbnNwYXJlbnQsdHJ1ZSl9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5pbmRleFBpeGVscz1mdW5jdGlvbihpbWdxKXt2YXIgblBpeD10aGlzLnBpeGVscy5sZW5ndGgvMzt0aGlzLmluZGV4ZWRQaXhlbHM9bmV3IFVpbnQ4QXJyYXkoblBpeCk7dmFyIGs9MDtmb3IodmFyIGo9MDtqPG5QaXg7aisrKXt2YXIgaW5kZXg9dGhpcy5maW5kQ2xvc2VzdFJHQih0aGlzLnBpeGVsc1trKytdJjI1NSx0aGlzLnBpeGVsc1trKytdJjI1NSx0aGlzLnBpeGVsc1trKytdJjI1NSk7dGhpcy51c2VkRW50cnlbaW5kZXhdPXRydWU7dGhpcy5pbmRleGVkUGl4ZWxzW2pdPWluZGV4fX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZGl0aGVyUGl4ZWxzPWZ1bmN0aW9uKGtlcm5lbCxzZXJwZW50aW5lKXt2YXIga2VybmVscz17RmFsc2VGbG95ZFN0ZWluYmVyZzpbWzMvOCwxLDBdLFszLzgsMCwxXSxbMi84LDEsMV1dLEZsb3lkU3RlaW5iZXJnOltbNy8xNiwxLDBdLFszLzE2LC0xLDFdLFs1LzE2LDAsMV0sWzEvMTYsMSwxXV0sU3R1Y2tpOltbOC80MiwxLDBdLFs0LzQyLDIsMF0sWzIvNDIsLTIsMV0sWzQvNDIsLTEsMV0sWzgvNDIsMCwxXSxbNC80MiwxLDFdLFsyLzQyLDIsMV0sWzEvNDIsLTIsMl0sWzIvNDIsLTEsMl0sWzQvNDIsMCwyXSxbMi80MiwxLDJdLFsxLzQyLDIsMl1dLEF0a2luc29uOltbMS84LDEsMF0sWzEvOCwyLDBdLFsxLzgsLTEsMV0sWzEvOCwwLDFdLFsxLzgsMSwxXSxbMS84LDAsMl1dfTtpZigha2VybmVsfHwha2VybmVsc1trZXJuZWxdKXt0aHJvd1wiVW5rbm93biBkaXRoZXJpbmcga2VybmVsOiBcIitrZXJuZWx9dmFyIGRzPWtlcm5lbHNba2VybmVsXTt2YXIgaW5kZXg9MCxoZWlnaHQ9dGhpcy5oZWlnaHQsd2lkdGg9dGhpcy53aWR0aCxkYXRhPXRoaXMucGl4ZWxzO3ZhciBkaXJlY3Rpb249c2VycGVudGluZT8tMToxO3RoaXMuaW5kZXhlZFBpeGVscz1uZXcgVWludDhBcnJheSh0aGlzLnBpeGVscy5sZW5ndGgvMyk7Zm9yKHZhciB5PTA7eTxoZWlnaHQ7eSsrKXtpZihzZXJwZW50aW5lKWRpcmVjdGlvbj1kaXJlY3Rpb24qLTE7Zm9yKHZhciB4PWRpcmVjdGlvbj09MT8wOndpZHRoLTEseGVuZD1kaXJlY3Rpb249PTE/d2lkdGg6MDt4IT09eGVuZDt4Kz1kaXJlY3Rpb24pe2luZGV4PXkqd2lkdGgreDt2YXIgaWR4PWluZGV4KjM7dmFyIHIxPWRhdGFbaWR4XTt2YXIgZzE9ZGF0YVtpZHgrMV07dmFyIGIxPWRhdGFbaWR4KzJdO2lkeD10aGlzLmZpbmRDbG9zZXN0UkdCKHIxLGcxLGIxKTt0aGlzLnVzZWRFbnRyeVtpZHhdPXRydWU7dGhpcy5pbmRleGVkUGl4ZWxzW2luZGV4XT1pZHg7aWR4Kj0zO3ZhciByMj10aGlzLmNvbG9yVGFiW2lkeF07dmFyIGcyPXRoaXMuY29sb3JUYWJbaWR4KzFdO3ZhciBiMj10aGlzLmNvbG9yVGFiW2lkeCsyXTt2YXIgZXI9cjEtcjI7dmFyIGVnPWcxLWcyO3ZhciBlYj1iMS1iMjtmb3IodmFyIGk9ZGlyZWN0aW9uPT0xPzA6ZHMubGVuZ3RoLTEsZW5kPWRpcmVjdGlvbj09MT9kcy5sZW5ndGg6MDtpIT09ZW5kO2krPWRpcmVjdGlvbil7dmFyIHgxPWRzW2ldWzFdO3ZhciB5MT1kc1tpXVsyXTtpZih4MSt4Pj0wJiZ4MSt4PHdpZHRoJiZ5MSt5Pj0wJiZ5MSt5PGhlaWdodCl7dmFyIGQ9ZHNbaV1bMF07aWR4PWluZGV4K3gxK3kxKndpZHRoO2lkeCo9MztkYXRhW2lkeF09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHhdK2VyKmQpKTtkYXRhW2lkeCsxXT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeCsxXStlZypkKSk7ZGF0YVtpZHgrMl09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHgrMl0rZWIqZCkpfX19fX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluZENsb3Nlc3Q9ZnVuY3Rpb24oYyx1c2VkKXtyZXR1cm4gdGhpcy5maW5kQ2xvc2VzdFJHQigoYyYxNjcxMTY4MCk+PjE2LChjJjY1MjgwKT4+OCxjJjI1NSx1c2VkKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZmluZENsb3Nlc3RSR0I9ZnVuY3Rpb24ocixnLGIsdXNlZCl7aWYodGhpcy5jb2xvclRhYj09PW51bGwpcmV0dXJuLTE7aWYodGhpcy5uZXVRdWFudCYmIXVzZWQpe3JldHVybiB0aGlzLm5ldVF1YW50Lmxvb2t1cFJHQihyLGcsYil9dmFyIGM9YnxnPDw4fHI8PDE2O3ZhciBtaW5wb3M9MDt2YXIgZG1pbj0yNTYqMjU2KjI1Njt2YXIgbGVuPXRoaXMuY29sb3JUYWIubGVuZ3RoO2Zvcih2YXIgaT0wLGluZGV4PTA7aTxsZW47aW5kZXgrKyl7dmFyIGRyPXItKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkZz1nLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZGI9Yi0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGQ9ZHIqZHIrZGcqZGcrZGIqZGI7aWYoKCF1c2VkfHx0aGlzLnVzZWRFbnRyeVtpbmRleF0pJiZkPGRtaW4pe2RtaW49ZDttaW5wb3M9aW5kZXh9fXJldHVybiBtaW5wb3N9O0dJRkVuY29kZXIucHJvdG90eXBlLmdldEltYWdlUGl4ZWxzPWZ1bmN0aW9uKCl7dmFyIHc9dGhpcy53aWR0aDt2YXIgaD10aGlzLmhlaWdodDt0aGlzLnBpeGVscz1uZXcgVWludDhBcnJheSh3KmgqMyk7dmFyIGRhdGE9dGhpcy5pbWFnZTt2YXIgc3JjUG9zPTA7dmFyIGNvdW50PTA7Zm9yKHZhciBpPTA7aTxoO2krKyl7Zm9yKHZhciBqPTA7ajx3O2orKyl7dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107dGhpcy5waXhlbHNbY291bnQrK109ZGF0YVtzcmNQb3MrK107c3JjUG9zKyt9fX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVHcmFwaGljQ3RybEV4dD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSgzMyk7dGhpcy5vdXQud3JpdGVCeXRlKDI0OSk7dGhpcy5vdXQud3JpdGVCeXRlKDQpO3ZhciB0cmFuc3AsZGlzcDtpZih0aGlzLnRyYW5zcGFyZW50PT09bnVsbCl7dHJhbnNwPTA7ZGlzcD0wfWVsc2V7dHJhbnNwPTE7ZGlzcD0yfWlmKHRoaXMuZGlzcG9zZT49MCl7ZGlzcD10aGlzLmRpc3Bvc2UmN31kaXNwPDw9Mjt0aGlzLm91dC53cml0ZUJ5dGUoMHxkaXNwfDB8dHJhbnNwKTt0aGlzLndyaXRlU2hvcnQodGhpcy5kZWxheSk7dGhpcy5vdXQud3JpdGVCeXRlKHRoaXMudHJhbnNJbmRleCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUltYWdlRGVzYz1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSg0NCk7dGhpcy53cml0ZVNob3J0KDApO3RoaXMud3JpdGVTaG9ydCgwKTt0aGlzLndyaXRlU2hvcnQodGhpcy53aWR0aCk7dGhpcy53cml0ZVNob3J0KHRoaXMuaGVpZ2h0KTtpZih0aGlzLmZpcnN0RnJhbWV8fHRoaXMuZ2xvYmFsUGFsZXR0ZSl7dGhpcy5vdXQud3JpdGVCeXRlKDApfWVsc2V7dGhpcy5vdXQud3JpdGVCeXRlKDEyOHwwfDB8MHx0aGlzLnBhbFNpemUpfX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVMU0Q9ZnVuY3Rpb24oKXt0aGlzLndyaXRlU2hvcnQodGhpcy53aWR0aCk7dGhpcy53cml0ZVNob3J0KHRoaXMuaGVpZ2h0KTt0aGlzLm91dC53cml0ZUJ5dGUoMTI4fDExMnwwfHRoaXMucGFsU2l6ZSk7dGhpcy5vdXQud3JpdGVCeXRlKDApO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVOZXRzY2FwZUV4dD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSgzMyk7dGhpcy5vdXQud3JpdGVCeXRlKDI1NSk7dGhpcy5vdXQud3JpdGVCeXRlKDExKTt0aGlzLm91dC53cml0ZVVURkJ5dGVzKFwiTkVUU0NBUEUyLjBcIik7dGhpcy5vdXQud3JpdGVCeXRlKDMpO3RoaXMub3V0LndyaXRlQnl0ZSgxKTt0aGlzLndyaXRlU2hvcnQodGhpcy5yZXBlYXQpO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVQYWxldHRlPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlcyh0aGlzLmNvbG9yVGFiKTt2YXIgbj0zKjI1Ni10aGlzLmNvbG9yVGFiLmxlbmd0aDtmb3IodmFyIGk9MDtpPG47aSsrKXRoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVTaG9ydD1mdW5jdGlvbihwVmFsdWUpe3RoaXMub3V0LndyaXRlQnl0ZShwVmFsdWUmMjU1KTt0aGlzLm91dC53cml0ZUJ5dGUocFZhbHVlPj44JjI1NSl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlUGl4ZWxzPWZ1bmN0aW9uKCl7dmFyIGVuYz1uZXcgTFpXRW5jb2Rlcih0aGlzLndpZHRoLHRoaXMuaGVpZ2h0LHRoaXMuaW5kZXhlZFBpeGVscyx0aGlzLmNvbG9yRGVwdGgpO2VuYy5lbmNvZGUodGhpcy5vdXQpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zdHJlYW09ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5vdXR9O21vZHVsZS5leHBvcnRzPUdJRkVuY29kZXJ9LHtcIi4vTFpXRW5jb2Rlci5qc1wiOjMsXCIuL1R5cGVkTmV1UXVhbnQuanNcIjo0fV0sMzpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEVPRj0tMTt2YXIgQklUUz0xMjt2YXIgSFNJWkU9NTAwMzt2YXIgbWFza3M9WzAsMSwzLDcsMTUsMzEsNjMsMTI3LDI1NSw1MTEsMTAyMywyMDQ3LDQwOTUsODE5MSwxNjM4MywzMjc2Nyw2NTUzNV07ZnVuY3Rpb24gTFpXRW5jb2Rlcih3aWR0aCxoZWlnaHQscGl4ZWxzLGNvbG9yRGVwdGgpe3ZhciBpbml0Q29kZVNpemU9TWF0aC5tYXgoMixjb2xvckRlcHRoKTt2YXIgYWNjdW09bmV3IFVpbnQ4QXJyYXkoMjU2KTt2YXIgaHRhYj1uZXcgSW50MzJBcnJheShIU0laRSk7dmFyIGNvZGV0YWI9bmV3IEludDMyQXJyYXkoSFNJWkUpO3ZhciBjdXJfYWNjdW0sY3VyX2JpdHM9MDt2YXIgYV9jb3VudDt2YXIgZnJlZV9lbnQ9MDt2YXIgbWF4Y29kZTt2YXIgY2xlYXJfZmxnPWZhbHNlO3ZhciBnX2luaXRfYml0cyxDbGVhckNvZGUsRU9GQ29kZTtmdW5jdGlvbiBjaGFyX291dChjLG91dHMpe2FjY3VtW2FfY291bnQrK109YztpZihhX2NvdW50Pj0yNTQpZmx1c2hfY2hhcihvdXRzKX1mdW5jdGlvbiBjbF9ibG9jayhvdXRzKXtjbF9oYXNoKEhTSVpFKTtmcmVlX2VudD1DbGVhckNvZGUrMjtjbGVhcl9mbGc9dHJ1ZTtvdXRwdXQoQ2xlYXJDb2RlLG91dHMpfWZ1bmN0aW9uIGNsX2hhc2goaHNpemUpe2Zvcih2YXIgaT0wO2k8aHNpemU7KytpKWh0YWJbaV09LTF9ZnVuY3Rpb24gY29tcHJlc3MoaW5pdF9iaXRzLG91dHMpe3ZhciBmY29kZSxjLGksZW50LGRpc3AsaHNpemVfcmVnLGhzaGlmdDtnX2luaXRfYml0cz1pbml0X2JpdHM7Y2xlYXJfZmxnPWZhbHNlO25fYml0cz1nX2luaXRfYml0czttYXhjb2RlPU1BWENPREUobl9iaXRzKTtDbGVhckNvZGU9MTw8aW5pdF9iaXRzLTE7RU9GQ29kZT1DbGVhckNvZGUrMTtmcmVlX2VudD1DbGVhckNvZGUrMjthX2NvdW50PTA7ZW50PW5leHRQaXhlbCgpO2hzaGlmdD0wO2ZvcihmY29kZT1IU0laRTtmY29kZTw2NTUzNjtmY29kZSo9MikrK2hzaGlmdDtoc2hpZnQ9OC1oc2hpZnQ7aHNpemVfcmVnPUhTSVpFO2NsX2hhc2goaHNpemVfcmVnKTtvdXRwdXQoQ2xlYXJDb2RlLG91dHMpO291dGVyX2xvb3A6d2hpbGUoKGM9bmV4dFBpeGVsKCkpIT1FT0Ype2Zjb2RlPShjPDxCSVRTKStlbnQ7aT1jPDxoc2hpZnReZW50O2lmKGh0YWJbaV09PT1mY29kZSl7ZW50PWNvZGV0YWJbaV07Y29udGludWV9ZWxzZSBpZihodGFiW2ldPj0wKXtkaXNwPWhzaXplX3JlZy1pO2lmKGk9PT0wKWRpc3A9MTtkb3tpZigoaS09ZGlzcCk8MClpKz1oc2l6ZV9yZWc7aWYoaHRhYltpXT09PWZjb2RlKXtlbnQ9Y29kZXRhYltpXTtjb250aW51ZSBvdXRlcl9sb29wfX13aGlsZShodGFiW2ldPj0wKX1vdXRwdXQoZW50LG91dHMpO2VudD1jO2lmKGZyZWVfZW50PDE8PEJJVFMpe2NvZGV0YWJbaV09ZnJlZV9lbnQrKztodGFiW2ldPWZjb2RlfWVsc2V7Y2xfYmxvY2sob3V0cyl9fW91dHB1dChlbnQsb3V0cyk7b3V0cHV0KEVPRkNvZGUsb3V0cyl9ZnVuY3Rpb24gZW5jb2RlKG91dHMpe291dHMud3JpdGVCeXRlKGluaXRDb2RlU2l6ZSk7cmVtYWluaW5nPXdpZHRoKmhlaWdodDtjdXJQaXhlbD0wO2NvbXByZXNzKGluaXRDb2RlU2l6ZSsxLG91dHMpO291dHMud3JpdGVCeXRlKDApfWZ1bmN0aW9uIGZsdXNoX2NoYXIob3V0cyl7aWYoYV9jb3VudD4wKXtvdXRzLndyaXRlQnl0ZShhX2NvdW50KTtvdXRzLndyaXRlQnl0ZXMoYWNjdW0sMCxhX2NvdW50KTthX2NvdW50PTB9fWZ1bmN0aW9uIE1BWENPREUobl9iaXRzKXtyZXR1cm4oMTw8bl9iaXRzKS0xfWZ1bmN0aW9uIG5leHRQaXhlbCgpe2lmKHJlbWFpbmluZz09PTApcmV0dXJuIEVPRjstLXJlbWFpbmluZzt2YXIgcGl4PXBpeGVsc1tjdXJQaXhlbCsrXTtyZXR1cm4gcGl4JjI1NX1mdW5jdGlvbiBvdXRwdXQoY29kZSxvdXRzKXtjdXJfYWNjdW0mPW1hc2tzW2N1cl9iaXRzXTtpZihjdXJfYml0cz4wKWN1cl9hY2N1bXw9Y29kZTw8Y3VyX2JpdHM7ZWxzZSBjdXJfYWNjdW09Y29kZTtjdXJfYml0cys9bl9iaXRzO3doaWxlKGN1cl9iaXRzPj04KXtjaGFyX291dChjdXJfYWNjdW0mMjU1LG91dHMpO2N1cl9hY2N1bT4+PTg7Y3VyX2JpdHMtPTh9aWYoZnJlZV9lbnQ+bWF4Y29kZXx8Y2xlYXJfZmxnKXtpZihjbGVhcl9mbGcpe21heGNvZGU9TUFYQ09ERShuX2JpdHM9Z19pbml0X2JpdHMpO2NsZWFyX2ZsZz1mYWxzZX1lbHNleysrbl9iaXRzO2lmKG5fYml0cz09QklUUyltYXhjb2RlPTE8PEJJVFM7ZWxzZSBtYXhjb2RlPU1BWENPREUobl9iaXRzKX19aWYoY29kZT09RU9GQ29kZSl7d2hpbGUoY3VyX2JpdHM+MCl7Y2hhcl9vdXQoY3VyX2FjY3VtJjI1NSxvdXRzKTtjdXJfYWNjdW0+Pj04O2N1cl9iaXRzLT04fWZsdXNoX2NoYXIob3V0cyl9fXRoaXMuZW5jb2RlPWVuY29kZX1tb2R1bGUuZXhwb3J0cz1MWldFbmNvZGVyfSx7fV0sNDpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIG5jeWNsZXM9MTAwO3ZhciBuZXRzaXplPTI1Njt2YXIgbWF4bmV0cG9zPW5ldHNpemUtMTt2YXIgbmV0Ymlhc3NoaWZ0PTQ7dmFyIGludGJpYXNzaGlmdD0xNjt2YXIgaW50Ymlhcz0xPDxpbnRiaWFzc2hpZnQ7dmFyIGdhbW1hc2hpZnQ9MTA7dmFyIGdhbW1hPTE8PGdhbW1hc2hpZnQ7dmFyIGJldGFzaGlmdD0xMDt2YXIgYmV0YT1pbnRiaWFzPj5iZXRhc2hpZnQ7dmFyIGJldGFnYW1tYT1pbnRiaWFzPDxnYW1tYXNoaWZ0LWJldGFzaGlmdDt2YXIgaW5pdHJhZD1uZXRzaXplPj4zO3ZhciByYWRpdXNiaWFzc2hpZnQ9Njt2YXIgcmFkaXVzYmlhcz0xPDxyYWRpdXNiaWFzc2hpZnQ7dmFyIGluaXRyYWRpdXM9aW5pdHJhZCpyYWRpdXNiaWFzO3ZhciByYWRpdXNkZWM9MzA7dmFyIGFscGhhYmlhc3NoaWZ0PTEwO3ZhciBpbml0YWxwaGE9MTw8YWxwaGFiaWFzc2hpZnQ7dmFyIGFscGhhZGVjO3ZhciByYWRiaWFzc2hpZnQ9ODt2YXIgcmFkYmlhcz0xPDxyYWRiaWFzc2hpZnQ7dmFyIGFscGhhcmFkYnNoaWZ0PWFscGhhYmlhc3NoaWZ0K3JhZGJpYXNzaGlmdDt2YXIgYWxwaGFyYWRiaWFzPTE8PGFscGhhcmFkYnNoaWZ0O3ZhciBwcmltZTE9NDk5O3ZhciBwcmltZTI9NDkxO3ZhciBwcmltZTM9NDg3O3ZhciBwcmltZTQ9NTAzO3ZhciBtaW5waWN0dXJlYnl0ZXM9MypwcmltZTQ7ZnVuY3Rpb24gTmV1UXVhbnQocGl4ZWxzLHNhbXBsZWZhYyl7dmFyIG5ldHdvcms7dmFyIG5ldGluZGV4O3ZhciBiaWFzO3ZhciBmcmVxO3ZhciByYWRwb3dlcjtmdW5jdGlvbiBpbml0KCl7bmV0d29yaz1bXTtuZXRpbmRleD1uZXcgSW50MzJBcnJheSgyNTYpO2JpYXM9bmV3IEludDMyQXJyYXkobmV0c2l6ZSk7ZnJlcT1uZXcgSW50MzJBcnJheShuZXRzaXplKTtyYWRwb3dlcj1uZXcgSW50MzJBcnJheShuZXRzaXplPj4zKTt2YXIgaSx2O2ZvcihpPTA7aTxuZXRzaXplO2krKyl7dj0oaTw8bmV0Ymlhc3NoaWZ0KzgpL25ldHNpemU7bmV0d29ya1tpXT1uZXcgRmxvYXQ2NEFycmF5KFt2LHYsdiwwXSk7ZnJlcVtpXT1pbnRiaWFzL25ldHNpemU7Ymlhc1tpXT0wfX1mdW5jdGlvbiB1bmJpYXNuZXQoKXtmb3IodmFyIGk9MDtpPG5ldHNpemU7aSsrKXtuZXR3b3JrW2ldWzBdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bMV0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVsyXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzNdPWl9fWZ1bmN0aW9uIGFsdGVyc2luZ2xlKGFscGhhLGksYixnLHIpe25ldHdvcmtbaV1bMF0tPWFscGhhKihuZXR3b3JrW2ldWzBdLWIpL2luaXRhbHBoYTtuZXR3b3JrW2ldWzFdLT1hbHBoYSoobmV0d29ya1tpXVsxXS1nKS9pbml0YWxwaGE7bmV0d29ya1tpXVsyXS09YWxwaGEqKG5ldHdvcmtbaV1bMl0tcikvaW5pdGFscGhhfWZ1bmN0aW9uIGFsdGVybmVpZ2gocmFkaXVzLGksYixnLHIpe3ZhciBsbz1NYXRoLmFicyhpLXJhZGl1cyk7dmFyIGhpPU1hdGgubWluKGkrcmFkaXVzLG5ldHNpemUpO3ZhciBqPWkrMTt2YXIgaz1pLTE7dmFyIG09MTt2YXIgcCxhO3doaWxlKGo8aGl8fGs+bG8pe2E9cmFkcG93ZXJbbSsrXTtpZihqPGhpKXtwPW5ldHdvcmtbaisrXTtwWzBdLT1hKihwWzBdLWIpL2FscGhhcmFkYmlhcztwWzFdLT1hKihwWzFdLWcpL2FscGhhcmFkYmlhcztwWzJdLT1hKihwWzJdLXIpL2FscGhhcmFkYmlhc31pZihrPmxvKXtwPW5ldHdvcmtbay0tXTtwWzBdLT1hKihwWzBdLWIpL2FscGhhcmFkYmlhcztwWzFdLT1hKihwWzFdLWcpL2FscGhhcmFkYmlhcztwWzJdLT1hKihwWzJdLXIpL2FscGhhcmFkYmlhc319fWZ1bmN0aW9uIGNvbnRlc3QoYixnLHIpe3ZhciBiZXN0ZD1+KDE8PDMxKTt2YXIgYmVzdGJpYXNkPWJlc3RkO3ZhciBiZXN0cG9zPS0xO3ZhciBiZXN0Ymlhc3Bvcz1iZXN0cG9zO3ZhciBpLG4sZGlzdCxiaWFzZGlzdCxiZXRhZnJlcTtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe249bmV0d29ya1tpXTtkaXN0PU1hdGguYWJzKG5bMF0tYikrTWF0aC5hYnMoblsxXS1nKStNYXRoLmFicyhuWzJdLXIpO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdHBvcz1pfWJpYXNkaXN0PWRpc3QtKGJpYXNbaV0+PmludGJpYXNzaGlmdC1uZXRiaWFzc2hpZnQpO2lmKGJpYXNkaXN0PGJlc3RiaWFzZCl7YmVzdGJpYXNkPWJpYXNkaXN0O2Jlc3RiaWFzcG9zPWl9YmV0YWZyZXE9ZnJlcVtpXT4+YmV0YXNoaWZ0O2ZyZXFbaV0tPWJldGFmcmVxO2JpYXNbaV0rPWJldGFmcmVxPDxnYW1tYXNoaWZ0fWZyZXFbYmVzdHBvc10rPWJldGE7Ymlhc1tiZXN0cG9zXS09YmV0YWdhbW1hO3JldHVybiBiZXN0Ymlhc3Bvc31mdW5jdGlvbiBpbnhidWlsZCgpe3ZhciBpLGoscCxxLHNtYWxscG9zLHNtYWxsdmFsLHByZXZpb3VzY29sPTAsc3RhcnRwb3M9MDtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe3A9bmV0d29ya1tpXTtzbWFsbHBvcz1pO3NtYWxsdmFsPXBbMV07Zm9yKGo9aSsxO2o8bmV0c2l6ZTtqKyspe3E9bmV0d29ya1tqXTtpZihxWzFdPHNtYWxsdmFsKXtzbWFsbHBvcz1qO3NtYWxsdmFsPXFbMV19fXE9bmV0d29ya1tzbWFsbHBvc107aWYoaSE9c21hbGxwb3Mpe2o9cVswXTtxWzBdPXBbMF07cFswXT1qO2o9cVsxXTtxWzFdPXBbMV07cFsxXT1qO2o9cVsyXTtxWzJdPXBbMl07cFsyXT1qO2o9cVszXTtxWzNdPXBbM107cFszXT1qfWlmKHNtYWxsdmFsIT1wcmV2aW91c2NvbCl7bmV0aW5kZXhbcHJldmlvdXNjb2xdPXN0YXJ0cG9zK2k+PjE7Zm9yKGo9cHJldmlvdXNjb2wrMTtqPHNtYWxsdmFsO2orKyluZXRpbmRleFtqXT1pO3ByZXZpb3VzY29sPXNtYWxsdmFsO3N0YXJ0cG9zPWl9fW5ldGluZGV4W3ByZXZpb3VzY29sXT1zdGFydHBvcyttYXhuZXRwb3M+PjE7Zm9yKGo9cHJldmlvdXNjb2wrMTtqPDI1NjtqKyspbmV0aW5kZXhbal09bWF4bmV0cG9zfWZ1bmN0aW9uIGlueHNlYXJjaChiLGcscil7dmFyIGEscCxkaXN0O3ZhciBiZXN0ZD0xZTM7dmFyIGJlc3Q9LTE7dmFyIGk9bmV0aW5kZXhbZ107dmFyIGo9aS0xO3doaWxlKGk8bmV0c2l6ZXx8aj49MCl7aWYoaTxuZXRzaXplKXtwPW5ldHdvcmtbaV07ZGlzdD1wWzFdLWc7aWYoZGlzdD49YmVzdGQpaT1uZXRzaXplO2Vsc2V7aSsrO2lmKGRpc3Q8MClkaXN0PS1kaXN0O2E9cFswXS1iO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YT1wWzJdLXI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Q9cFszXX19fX1pZihqPj0wKXtwPW5ldHdvcmtbal07ZGlzdD1nLXBbMV07aWYoZGlzdD49YmVzdGQpaj0tMTtlbHNle2otLTtpZihkaXN0PDApZGlzdD0tZGlzdDthPXBbMF0tYjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2E9cFsyXS1yO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0PXBbM119fX19fXJldHVybiBiZXN0fWZ1bmN0aW9uIGxlYXJuKCl7dmFyIGk7dmFyIGxlbmd0aGNvdW50PXBpeGVscy5sZW5ndGg7dmFyIGFscGhhZGVjPTMwKyhzYW1wbGVmYWMtMSkvMzt2YXIgc2FtcGxlcGl4ZWxzPWxlbmd0aGNvdW50LygzKnNhbXBsZWZhYyk7dmFyIGRlbHRhPX5+KHNhbXBsZXBpeGVscy9uY3ljbGVzKTt2YXIgYWxwaGE9aW5pdGFscGhhO3ZhciByYWRpdXM9aW5pdHJhZGl1czt2YXIgcmFkPXJhZGl1cz4+cmFkaXVzYmlhc3NoaWZ0O2lmKHJhZDw9MSlyYWQ9MDtmb3IoaT0wO2k8cmFkO2krKylyYWRwb3dlcltpXT1hbHBoYSooKHJhZCpyYWQtaSppKSpyYWRiaWFzLyhyYWQqcmFkKSk7dmFyIHN0ZXA7aWYobGVuZ3RoY291bnQ8bWlucGljdHVyZWJ5dGVzKXtzYW1wbGVmYWM9MTtzdGVwPTN9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTEhPT0wKXtzdGVwPTMqcHJpbWUxfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUyIT09MCl7c3RlcD0zKnByaW1lMn1lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMyE9PTApe3N0ZXA9MypwcmltZTN9ZWxzZXtzdGVwPTMqcHJpbWU0fXZhciBiLGcscixqO3ZhciBwaXg9MDtpPTA7d2hpbGUoaTxzYW1wbGVwaXhlbHMpe2I9KHBpeGVsc1twaXhdJjI1NSk8PG5ldGJpYXNzaGlmdDtnPShwaXhlbHNbcGl4KzFdJjI1NSk8PG5ldGJpYXNzaGlmdDtyPShwaXhlbHNbcGl4KzJdJjI1NSk8PG5ldGJpYXNzaGlmdDtqPWNvbnRlc3QoYixnLHIpO2FsdGVyc2luZ2xlKGFscGhhLGosYixnLHIpO2lmKHJhZCE9PTApYWx0ZXJuZWlnaChyYWQsaixiLGcscik7cGl4Kz1zdGVwO2lmKHBpeD49bGVuZ3RoY291bnQpcGl4LT1sZW5ndGhjb3VudDtpKys7aWYoZGVsdGE9PT0wKWRlbHRhPTE7aWYoaSVkZWx0YT09PTApe2FscGhhLT1hbHBoYS9hbHBoYWRlYztyYWRpdXMtPXJhZGl1cy9yYWRpdXNkZWM7cmFkPXJhZGl1cz4+cmFkaXVzYmlhc3NoaWZ0O2lmKHJhZDw9MSlyYWQ9MDtmb3Ioaj0wO2o8cmFkO2orKylyYWRwb3dlcltqXT1hbHBoYSooKHJhZCpyYWQtaipqKSpyYWRiaWFzLyhyYWQqcmFkKSl9fX1mdW5jdGlvbiBidWlsZENvbG9ybWFwKCl7aW5pdCgpO2xlYXJuKCk7dW5iaWFzbmV0KCk7aW54YnVpbGQoKX10aGlzLmJ1aWxkQ29sb3JtYXA9YnVpbGRDb2xvcm1hcDtmdW5jdGlvbiBnZXRDb2xvcm1hcCgpe3ZhciBtYXA9W107dmFyIGluZGV4PVtdO2Zvcih2YXIgaT0wO2k8bmV0c2l6ZTtpKyspaW5kZXhbbmV0d29ya1tpXVszXV09aTt2YXIgaz0wO2Zvcih2YXIgbD0wO2w8bmV0c2l6ZTtsKyspe3ZhciBqPWluZGV4W2xdO21hcFtrKytdPW5ldHdvcmtbal1bMF07bWFwW2srK109bmV0d29ya1tqXVsxXTttYXBbaysrXT1uZXR3b3JrW2pdWzJdfXJldHVybiBtYXB9dGhpcy5nZXRDb2xvcm1hcD1nZXRDb2xvcm1hcDt0aGlzLmxvb2t1cFJHQj1pbnhzZWFyY2h9bW9kdWxlLmV4cG9ydHM9TmV1UXVhbnR9LHt9XSw1OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgVUEsYnJvd3Nlcixtb2RlLHBsYXRmb3JtLHVhO3VhPW5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtwbGF0Zm9ybT1uYXZpZ2F0b3IucGxhdGZvcm0udG9Mb3dlckNhc2UoKTtVQT11YS5tYXRjaCgvKG9wZXJhfGllfGZpcmVmb3h8Y2hyb21lfHZlcnNpb24pW1xcc1xcLzpdKFtcXHdcXGRcXC5dKyk/Lio/KHNhZmFyaXx2ZXJzaW9uW1xcc1xcLzpdKFtcXHdcXGRcXC5dKyl8JCkvKXx8W251bGwsXCJ1bmtub3duXCIsMF07bW9kZT1VQVsxXT09PVwiaWVcIiYmZG9jdW1lbnQuZG9jdW1lbnRNb2RlO2Jyb3dzZXI9e25hbWU6VUFbMV09PT1cInZlcnNpb25cIj9VQVszXTpVQVsxXSx2ZXJzaW9uOm1vZGV8fHBhcnNlRmxvYXQoVUFbMV09PT1cIm9wZXJhXCImJlVBWzRdP1VBWzRdOlVBWzJdKSxwbGF0Zm9ybTp7bmFtZTp1YS5tYXRjaCgvaXAoPzphZHxvZHxob25lKS8pP1wiaW9zXCI6KHVhLm1hdGNoKC8oPzp3ZWJvc3xhbmRyb2lkKS8pfHxwbGF0Zm9ybS5tYXRjaCgvbWFjfHdpbnxsaW51eC8pfHxbXCJvdGhlclwiXSlbMF19fTticm93c2VyW2Jyb3dzZXIubmFtZV09dHJ1ZTticm93c2VyW2Jyb3dzZXIubmFtZStwYXJzZUludChicm93c2VyLnZlcnNpb24sMTApXT10cnVlO2Jyb3dzZXIucGxhdGZvcm1bYnJvd3Nlci5wbGF0Zm9ybS5uYW1lXT10cnVlO21vZHVsZS5leHBvcnRzPWJyb3dzZXJ9LHt9XSw2OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgRXZlbnRFbWl0dGVyLEdJRixHSUZFbmNvZGVyLGJyb3dzZXIsZ2lmV29ya2VyLGV4dGVuZD1mdW5jdGlvbihjaGlsZCxwYXJlbnQpe2Zvcih2YXIga2V5IGluIHBhcmVudCl7aWYoaGFzUHJvcC5jYWxsKHBhcmVudCxrZXkpKWNoaWxkW2tleV09cGFyZW50W2tleV19ZnVuY3Rpb24gY3Rvcigpe3RoaXMuY29uc3RydWN0b3I9Y2hpbGR9Y3Rvci5wcm90b3R5cGU9cGFyZW50LnByb3RvdHlwZTtjaGlsZC5wcm90b3R5cGU9bmV3IGN0b3I7Y2hpbGQuX19zdXBlcl9fPXBhcmVudC5wcm90b3R5cGU7cmV0dXJuIGNoaWxkfSxoYXNQcm9wPXt9Lmhhc093blByb3BlcnR5LGluZGV4T2Y9W10uaW5kZXhPZnx8ZnVuY3Rpb24oaXRlbSl7Zm9yKHZhciBpPTAsbD10aGlzLmxlbmd0aDtpPGw7aSsrKXtpZihpIGluIHRoaXMmJnRoaXNbaV09PT1pdGVtKXJldHVybiBpfXJldHVybi0xfSxzbGljZT1bXS5zbGljZTtFdmVudEVtaXR0ZXI9cmVxdWlyZShcImV2ZW50c1wiKS5FdmVudEVtaXR0ZXI7YnJvd3Nlcj1yZXF1aXJlKFwiLi9icm93c2VyLmNvZmZlZVwiKTtHSUZFbmNvZGVyPXJlcXVpcmUoXCIuL0dJRkVuY29kZXIuanNcIik7Z2lmV29ya2VyPXJlcXVpcmUoXCIuL2dpZi53b3JrZXIuY29mZmVlXCIpO21vZHVsZS5leHBvcnRzPUdJRj1mdW5jdGlvbihzdXBlckNsYXNzKXt2YXIgZGVmYXVsdHMsZnJhbWVEZWZhdWx0cztleHRlbmQoR0lGLHN1cGVyQ2xhc3MpO2RlZmF1bHRzPXt3b3JrZXJTY3JpcHQ6XCJnaWYud29ya2VyLmpzXCIsd29ya2VyczoyLHJlcGVhdDowLGJhY2tncm91bmQ6XCIjZmZmXCIscXVhbGl0eToxMCx3aWR0aDpudWxsLGhlaWdodDpudWxsLHRyYW5zcGFyZW50Om51bGwsZGVidWc6ZmFsc2UsZGl0aGVyOmZhbHNlfTtmcmFtZURlZmF1bHRzPXtkZWxheTo1MDAsY29weTpmYWxzZSxkaXNwb3NlOi0xfTtmdW5jdGlvbiBHSUYob3B0aW9ucyl7dmFyIGJhc2Usa2V5LHZhbHVlO3RoaXMucnVubmluZz1mYWxzZTt0aGlzLm9wdGlvbnM9e307dGhpcy5mcmFtZXM9W107dGhpcy5mcmVlV29ya2Vycz1bXTt0aGlzLmFjdGl2ZVdvcmtlcnM9W107dGhpcy5zZXRPcHRpb25zKG9wdGlvbnMpO2ZvcihrZXkgaW4gZGVmYXVsdHMpe3ZhbHVlPWRlZmF1bHRzW2tleV07aWYoKGJhc2U9dGhpcy5vcHRpb25zKVtrZXldPT1udWxsKXtiYXNlW2tleV09dmFsdWV9fX1HSUYucHJvdG90eXBlLnNldE9wdGlvbj1mdW5jdGlvbihrZXksdmFsdWUpe3RoaXMub3B0aW9uc1trZXldPXZhbHVlO2lmKHRoaXMuX2NhbnZhcyE9bnVsbCYmKGtleT09PVwid2lkdGhcInx8a2V5PT09XCJoZWlnaHRcIikpe3JldHVybiB0aGlzLl9jYW52YXNba2V5XT12YWx1ZX19O0dJRi5wcm90b3R5cGUuc2V0T3B0aW9ucz1mdW5jdGlvbihvcHRpb25zKXt2YXIga2V5LHJlc3VsdHMsdmFsdWU7cmVzdWx0cz1bXTtmb3Ioa2V5IGluIG9wdGlvbnMpe2lmKCFoYXNQcm9wLmNhbGwob3B0aW9ucyxrZXkpKWNvbnRpbnVlO3ZhbHVlPW9wdGlvbnNba2V5XTtyZXN1bHRzLnB1c2godGhpcy5zZXRPcHRpb24oa2V5LHZhbHVlKSl9cmV0dXJuIHJlc3VsdHN9O0dJRi5wcm90b3R5cGUuYWRkRnJhbWU9ZnVuY3Rpb24oaW1hZ2Usb3B0aW9ucyl7dmFyIGZyYW1lLGtleTtpZihvcHRpb25zPT1udWxsKXtvcHRpb25zPXt9fWZyYW1lPXt9O2ZyYW1lLnRyYW5zcGFyZW50PXRoaXMub3B0aW9ucy50cmFuc3BhcmVudDtmb3Ioa2V5IGluIGZyYW1lRGVmYXVsdHMpe2ZyYW1lW2tleV09b3B0aW9uc1trZXldfHxmcmFtZURlZmF1bHRzW2tleV19aWYodGhpcy5vcHRpb25zLndpZHRoPT1udWxsKXt0aGlzLnNldE9wdGlvbihcIndpZHRoXCIsaW1hZ2Uud2lkdGgpfWlmKHRoaXMub3B0aW9ucy5oZWlnaHQ9PW51bGwpe3RoaXMuc2V0T3B0aW9uKFwiaGVpZ2h0XCIsaW1hZ2UuaGVpZ2h0KX1pZih0eXBlb2YgSW1hZ2VEYXRhIT09XCJ1bmRlZmluZWRcIiYmSW1hZ2VEYXRhIT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBJbWFnZURhdGEpe2ZyYW1lLmRhdGE9aW1hZ2UuZGF0YX1lbHNlIGlmKHR5cGVvZiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQhPT1cInVuZGVmaW5lZFwiJiZDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRHx8dHlwZW9mIFdlYkdMUmVuZGVyaW5nQ29udGV4dCE9PVwidW5kZWZpbmVkXCImJldlYkdMUmVuZGVyaW5nQ29udGV4dCE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgV2ViR0xSZW5kZXJpbmdDb250ZXh0KXtpZihvcHRpb25zLmNvcHkpe2ZyYW1lLmRhdGE9dGhpcy5nZXRDb250ZXh0RGF0YShpbWFnZSl9ZWxzZXtmcmFtZS5jb250ZXh0PWltYWdlfX1lbHNlIGlmKGltYWdlLmNoaWxkTm9kZXMhPW51bGwpe2lmKG9wdGlvbnMuY29weSl7ZnJhbWUuZGF0YT10aGlzLmdldEltYWdlRGF0YShpbWFnZSl9ZWxzZXtmcmFtZS5pbWFnZT1pbWFnZX19ZWxzZXt0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGltYWdlXCIpfXJldHVybiB0aGlzLmZyYW1lcy5wdXNoKGZyYW1lKX07R0lGLnByb3RvdHlwZS5yZW5kZXI9ZnVuY3Rpb24oKXt2YXIgaSxqLG51bVdvcmtlcnMscmVmO2lmKHRoaXMucnVubmluZyl7dGhyb3cgbmV3IEVycm9yKFwiQWxyZWFkeSBydW5uaW5nXCIpfWlmKHRoaXMub3B0aW9ucy53aWR0aD09bnVsbHx8dGhpcy5vcHRpb25zLmhlaWdodD09bnVsbCl7dGhyb3cgbmV3IEVycm9yKFwiV2lkdGggYW5kIGhlaWdodCBtdXN0IGJlIHNldCBwcmlvciB0byByZW5kZXJpbmdcIil9dGhpcy5ydW5uaW5nPXRydWU7dGhpcy5uZXh0RnJhbWU9MDt0aGlzLmZpbmlzaGVkRnJhbWVzPTA7dGhpcy5pbWFnZVBhcnRzPWZ1bmN0aW9uKCl7dmFyIGoscmVmLHJlc3VsdHM7cmVzdWx0cz1bXTtmb3IoaT1qPTAscmVmPXRoaXMuZnJhbWVzLmxlbmd0aDswPD1yZWY/ajxyZWY6aj5yZWY7aT0wPD1yZWY/KytqOi0tail7cmVzdWx0cy5wdXNoKG51bGwpfXJldHVybiByZXN1bHRzfS5jYWxsKHRoaXMpO251bVdvcmtlcnM9dGhpcy5zcGF3bldvcmtlcnMoKTtpZih0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9ZWxzZXtmb3IoaT1qPTAscmVmPW51bVdvcmtlcnM7MDw9cmVmP2o8cmVmOmo+cmVmO2k9MDw9cmVmPysrajotLWope3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9fXRoaXMuZW1pdChcInN0YXJ0XCIpO3JldHVybiB0aGlzLmVtaXQoXCJwcm9ncmVzc1wiLDApfTtHSUYucHJvdG90eXBlLmFib3J0PWZ1bmN0aW9uKCl7dmFyIHdvcmtlcjt3aGlsZSh0cnVlKXt3b3JrZXI9dGhpcy5hY3RpdmVXb3JrZXJzLnNoaWZ0KCk7aWYod29ya2VyPT1udWxsKXticmVha310aGlzLmxvZyhcImtpbGxpbmcgYWN0aXZlIHdvcmtlclwiKTt3b3JrZXIudGVybWluYXRlKCl9dGhpcy5ydW5uaW5nPWZhbHNlO3JldHVybiB0aGlzLmVtaXQoXCJhYm9ydFwiKX07R0lGLnByb3RvdHlwZS5zcGF3bldvcmtlcnM9ZnVuY3Rpb24oKXt2YXIgaixudW1Xb3JrZXJzLHJlZixyZXN1bHRzO251bVdvcmtlcnM9TWF0aC5taW4odGhpcy5vcHRpb25zLndvcmtlcnMsdGhpcy5mcmFtZXMubGVuZ3RoKTsoZnVuY3Rpb24oKXtyZXN1bHRzPVtdO2Zvcih2YXIgaj1yZWY9dGhpcy5mcmVlV29ya2Vycy5sZW5ndGg7cmVmPD1udW1Xb3JrZXJzP2o8bnVtV29ya2VyczpqPm51bVdvcmtlcnM7cmVmPD1udW1Xb3JrZXJzP2orKzpqLS0pe3Jlc3VsdHMucHVzaChqKX1yZXR1cm4gcmVzdWx0c30pLmFwcGx5KHRoaXMpLmZvckVhY2goZnVuY3Rpb24oX3RoaXMpe3JldHVybiBmdW5jdGlvbihpKXt2YXIgd29ya2VyO190aGlzLmxvZyhcInNwYXduaW5nIHdvcmtlciBcIitpKTt3b3JrZXI9bmV3IFdvcmtlcihfdGhpcy5vcHRpb25zLndvcmtlclNjcmlwdCk7d29ya2VyLm9ubWVzc2FnZT1mdW5jdGlvbihldmVudCl7X3RoaXMuYWN0aXZlV29ya2Vycy5zcGxpY2UoX3RoaXMuYWN0aXZlV29ya2Vycy5pbmRleE9mKHdvcmtlciksMSk7X3RoaXMuZnJlZVdvcmtlcnMucHVzaCh3b3JrZXIpO3JldHVybiBfdGhpcy5mcmFtZUZpbmlzaGVkKGV2ZW50LmRhdGEpfTtyZXR1cm4gX3RoaXMuZnJlZVdvcmtlcnMucHVzaCh3b3JrZXIpfX0odGhpcykpO3JldHVybiBudW1Xb3JrZXJzfTtHSUYucHJvdG90eXBlLmZyYW1lRmluaXNoZWQ9ZnVuY3Rpb24oZnJhbWUpe3ZhciBpLGoscmVmO3RoaXMubG9nKFwiZnJhbWUgXCIrZnJhbWUuaW5kZXgrXCIgZmluaXNoZWQgLSBcIit0aGlzLmFjdGl2ZVdvcmtlcnMubGVuZ3RoK1wiIGFjdGl2ZVwiKTt0aGlzLmZpbmlzaGVkRnJhbWVzKys7dGhpcy5lbWl0KFwicHJvZ3Jlc3NcIix0aGlzLmZpbmlzaGVkRnJhbWVzL3RoaXMuZnJhbWVzLmxlbmd0aCk7dGhpcy5pbWFnZVBhcnRzW2ZyYW1lLmluZGV4XT1mcmFtZTtpZih0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe3RoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPWZyYW1lLmdsb2JhbFBhbGV0dGU7dGhpcy5sb2coXCJnbG9iYWwgcGFsZXR0ZSBhbmFseXplZFwiKTtpZih0aGlzLmZyYW1lcy5sZW5ndGg+Mil7Zm9yKGk9aj0xLHJlZj10aGlzLmZyZWVXb3JrZXJzLmxlbmd0aDsxPD1yZWY/ajxyZWY6aj5yZWY7aT0xPD1yZWY/KytqOi0tail7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX19fWlmKGluZGV4T2YuY2FsbCh0aGlzLmltYWdlUGFydHMsbnVsbCk+PTApe3JldHVybiB0aGlzLnJlbmRlck5leHRGcmFtZSgpfWVsc2V7cmV0dXJuIHRoaXMuZmluaXNoUmVuZGVyaW5nKCl9fTtHSUYucHJvdG90eXBlLmZpbmlzaFJlbmRlcmluZz1mdW5jdGlvbigpe3ZhciBkYXRhLGZyYW1lLGksaW1hZ2UsaixrLGwsbGVuLGxlbjEsbGVuMixsZW4zLG9mZnNldCxwYWdlLHJlZixyZWYxLHJlZjI7bGVuPTA7cmVmPXRoaXMuaW1hZ2VQYXJ0cztmb3Ioaj0wLGxlbjE9cmVmLmxlbmd0aDtqPGxlbjE7aisrKXtmcmFtZT1yZWZbal07bGVuKz0oZnJhbWUuZGF0YS5sZW5ndGgtMSkqZnJhbWUucGFnZVNpemUrZnJhbWUuY3Vyc29yfWxlbis9ZnJhbWUucGFnZVNpemUtZnJhbWUuY3Vyc29yO3RoaXMubG9nKFwicmVuZGVyaW5nIGZpbmlzaGVkIC0gZmlsZXNpemUgXCIrTWF0aC5yb3VuZChsZW4vMWUzKStcImtiXCIpO2RhdGE9bmV3IFVpbnQ4QXJyYXkobGVuKTtvZmZzZXQ9MDtyZWYxPXRoaXMuaW1hZ2VQYXJ0cztmb3Ioaz0wLGxlbjI9cmVmMS5sZW5ndGg7azxsZW4yO2srKyl7ZnJhbWU9cmVmMVtrXTtyZWYyPWZyYW1lLmRhdGE7Zm9yKGk9bD0wLGxlbjM9cmVmMi5sZW5ndGg7bDxsZW4zO2k9KytsKXtwYWdlPXJlZjJbaV07ZGF0YS5zZXQocGFnZSxvZmZzZXQpO2lmKGk9PT1mcmFtZS5kYXRhLmxlbmd0aC0xKXtvZmZzZXQrPWZyYW1lLmN1cnNvcn1lbHNle29mZnNldCs9ZnJhbWUucGFnZVNpemV9fX1pbWFnZT1uZXcgQmxvYihbZGF0YV0se3R5cGU6XCJpbWFnZS9naWZcIn0pO3JldHVybiB0aGlzLmVtaXQoXCJmaW5pc2hlZFwiLGltYWdlLGRhdGEpfTtHSUYucHJvdG90eXBlLnJlbmRlck5leHRGcmFtZT1mdW5jdGlvbigpe3ZhciBmcmFtZSx0YXNrLHdvcmtlcjtpZih0aGlzLmZyZWVXb3JrZXJzLmxlbmd0aD09PTApe3Rocm93IG5ldyBFcnJvcihcIk5vIGZyZWUgd29ya2Vyc1wiKX1pZih0aGlzLm5leHRGcmFtZT49dGhpcy5mcmFtZXMubGVuZ3RoKXtyZXR1cm59ZnJhbWU9dGhpcy5mcmFtZXNbdGhpcy5uZXh0RnJhbWUrK107d29ya2VyPXRoaXMuZnJlZVdvcmtlcnMuc2hpZnQoKTt0YXNrPXRoaXMuZ2V0VGFzayhmcmFtZSk7dGhpcy5sb2coXCJzdGFydGluZyBmcmFtZSBcIisodGFzay5pbmRleCsxKStcIiBvZiBcIit0aGlzLmZyYW1lcy5sZW5ndGgpO3RoaXMuYWN0aXZlV29ya2Vycy5wdXNoKHdvcmtlcik7cmV0dXJuIHdvcmtlci5wb3N0TWVzc2FnZSh0YXNrKX07R0lGLnByb3RvdHlwZS5nZXRDb250ZXh0RGF0YT1mdW5jdGlvbihjdHgpe3JldHVybiBjdHguZ2V0SW1hZ2VEYXRhKDAsMCx0aGlzLm9wdGlvbnMud2lkdGgsdGhpcy5vcHRpb25zLmhlaWdodCkuZGF0YX07R0lGLnByb3RvdHlwZS5nZXRJbWFnZURhdGE9ZnVuY3Rpb24oaW1hZ2Upe3ZhciBjdHg7aWYodGhpcy5fY2FudmFzPT1udWxsKXt0aGlzLl9jYW52YXM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTt0aGlzLl9jYW52YXMud2lkdGg9dGhpcy5vcHRpb25zLndpZHRoO3RoaXMuX2NhbnZhcy5oZWlnaHQ9dGhpcy5vcHRpb25zLmhlaWdodH1jdHg9dGhpcy5fY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtjdHguc2V0RmlsbD10aGlzLm9wdGlvbnMuYmFja2dyb3VuZDtjdHguZmlsbFJlY3QoMCwwLHRoaXMub3B0aW9ucy53aWR0aCx0aGlzLm9wdGlvbnMuaGVpZ2h0KTtjdHguZHJhd0ltYWdlKGltYWdlLDAsMCk7cmV0dXJuIHRoaXMuZ2V0Q29udGV4dERhdGEoY3R4KX07R0lGLnByb3RvdHlwZS5nZXRUYXNrPWZ1bmN0aW9uKGZyYW1lKXt2YXIgaW5kZXgsdGFzaztpbmRleD10aGlzLmZyYW1lcy5pbmRleE9mKGZyYW1lKTt0YXNrPXtpbmRleDppbmRleCxsYXN0OmluZGV4PT09dGhpcy5mcmFtZXMubGVuZ3RoLTEsZGVsYXk6ZnJhbWUuZGVsYXksZGlzcG9zZTpmcmFtZS5kaXNwb3NlLHRyYW5zcGFyZW50OmZyYW1lLnRyYW5zcGFyZW50LHdpZHRoOnRoaXMub3B0aW9ucy53aWR0aCxoZWlnaHQ6dGhpcy5vcHRpb25zLmhlaWdodCxxdWFsaXR5OnRoaXMub3B0aW9ucy5xdWFsaXR5LGRpdGhlcjp0aGlzLm9wdGlvbnMuZGl0aGVyLGdsb2JhbFBhbGV0dGU6dGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGUscmVwZWF0OnRoaXMub3B0aW9ucy5yZXBlYXQsY2FuVHJhbnNmZXI6YnJvd3Nlci5uYW1lPT09XCJjaHJvbWVcIn07aWYoZnJhbWUuZGF0YSE9bnVsbCl7dGFzay5kYXRhPWZyYW1lLmRhdGF9ZWxzZSBpZihmcmFtZS5jb250ZXh0IT1udWxsKXt0YXNrLmRhdGE9dGhpcy5nZXRDb250ZXh0RGF0YShmcmFtZS5jb250ZXh0KX1lbHNlIGlmKGZyYW1lLmltYWdlIT1udWxsKXt0YXNrLmRhdGE9dGhpcy5nZXRJbWFnZURhdGEoZnJhbWUuaW1hZ2UpfWVsc2V7dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBmcmFtZVwiKX1yZXR1cm4gdGFza307R0lGLnByb3RvdHlwZS5sb2c9ZnVuY3Rpb24oKXt2YXIgYXJnczthcmdzPTE8PWFyZ3VtZW50cy5sZW5ndGg/c2xpY2UuY2FsbChhcmd1bWVudHMsMCk6W107aWYoIXRoaXMub3B0aW9ucy5kZWJ1Zyl7cmV0dXJufXJldHVybiBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLGFyZ3MpfTtyZXR1cm4gR0lGfShFdmVudEVtaXR0ZXIpfSx7XCIuL0dJRkVuY29kZXIuanNcIjoyLFwiLi9icm93c2VyLmNvZmZlZVwiOjUsXCIuL2dpZi53b3JrZXIuY29mZmVlXCI6NyxldmVudHM6MX1dLDc6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBHSUZFbmNvZGVyLHJlbmRlckZyYW1lO0dJRkVuY29kZXI9cmVxdWlyZShcIi4vR0lGRW5jb2Rlci5qc1wiKTtyZW5kZXJGcmFtZT1mdW5jdGlvbihmcmFtZSl7dmFyIGVuY29kZXIscGFnZSxzdHJlYW0sdHJhbnNmZXI7ZW5jb2Rlcj1uZXcgR0lGRW5jb2RlcihmcmFtZS53aWR0aCxmcmFtZS5oZWlnaHQpO2lmKGZyYW1lLmluZGV4PT09MCl7ZW5jb2Rlci53cml0ZUhlYWRlcigpfWVsc2V7ZW5jb2Rlci5maXJzdEZyYW1lPWZhbHNlfWVuY29kZXIuc2V0VHJhbnNwYXJlbnQoZnJhbWUudHJhbnNwYXJlbnQpO2VuY29kZXIuc2V0RGlzcG9zZShmcmFtZS5kaXNwb3NlKTtlbmNvZGVyLnNldFJlcGVhdChmcmFtZS5yZXBlYXQpO2VuY29kZXIuc2V0RGVsYXkoZnJhbWUuZGVsYXkpO2VuY29kZXIuc2V0UXVhbGl0eShmcmFtZS5xdWFsaXR5KTtlbmNvZGVyLnNldERpdGhlcihmcmFtZS5kaXRoZXIpO2VuY29kZXIuc2V0R2xvYmFsUGFsZXR0ZShmcmFtZS5nbG9iYWxQYWxldHRlKTtlbmNvZGVyLmFkZEZyYW1lKGZyYW1lLmRhdGEpO2lmKGZyYW1lLmxhc3Qpe2VuY29kZXIuZmluaXNoKCl9aWYoZnJhbWUuZ2xvYmFsUGFsZXR0ZT09PXRydWUpe2ZyYW1lLmdsb2JhbFBhbGV0dGU9ZW5jb2Rlci5nZXRHbG9iYWxQYWxldHRlKCl9c3RyZWFtPWVuY29kZXIuc3RyZWFtKCk7ZnJhbWUuZGF0YT1zdHJlYW0ucGFnZXM7ZnJhbWUuY3Vyc29yPXN0cmVhbS5jdXJzb3I7ZnJhbWUucGFnZVNpemU9c3RyZWFtLmNvbnN0cnVjdG9yLnBhZ2VTaXplO2lmKGZyYW1lLmNhblRyYW5zZmVyKXt0cmFuc2Zlcj1mdW5jdGlvbigpe3ZhciBpLGxlbixyZWYscmVzdWx0cztyZWY9ZnJhbWUuZGF0YTtyZXN1bHRzPVtdO2ZvcihpPTAsbGVuPXJlZi5sZW5ndGg7aTxsZW47aSsrKXtwYWdlPXJlZltpXTtyZXN1bHRzLnB1c2gocGFnZS5idWZmZXIpfXJldHVybiByZXN1bHRzfSgpO3JldHVybiBzZWxmLnBvc3RNZXNzYWdlKGZyYW1lLHRyYW5zZmVyKX1lbHNle3JldHVybiBzZWxmLnBvc3RNZXNzYWdlKGZyYW1lKX19O3NlbGYub25tZXNzYWdlPWZ1bmN0aW9uKGV2ZW50KXtyZXR1cm4gcmVuZGVyRnJhbWUoZXZlbnQuZGF0YSl9fSx7XCIuL0dJRkVuY29kZXIuanNcIjoyfV19LHt9LFs2XSkoNil9KTtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Z2lmLmpzLm1hcFxyXG4iLCI7KGZ1bmN0aW9uKCkge1xyXG5cclxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICB2YXIgVGFyID0gcmVxdWlyZSgnLi90YXIuanMnKTtcclxuICB2YXIgZG93bmxvYWQgPSByZXF1aXJlKCcuL2Rvd25sb2FkLmpzJyk7XHJcbiAgdmFyIEdJRiA9IHJlcXVpcmUoJy4vZ2lmLmpzJyk7XHJcbn1cclxuXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxudmFyIG9iamVjdFR5cGVzID0ge1xyXG4nZnVuY3Rpb24nOiB0cnVlLFxyXG4nb2JqZWN0JzogdHJ1ZVxyXG59O1xyXG5cclxuZnVuY3Rpb24gY2hlY2tHbG9iYWwodmFsdWUpIHtcclxuICAgIHJldHVybiAodmFsdWUgJiYgdmFsdWUuT2JqZWN0ID09PSBPYmplY3QpID8gdmFsdWUgOiBudWxsO1xyXG4gIH1cclxuXHJcbi8qKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyB3aXRob3V0IGEgZGVwZW5kZW5jeSBvbiBgcm9vdGAuICovXHJcbnZhciBmcmVlUGFyc2VGbG9hdCA9IHBhcnNlRmxvYXQsXHJcbiAgZnJlZVBhcnNlSW50ID0gcGFyc2VJbnQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgLiAqL1xyXG52YXIgZnJlZUV4cG9ydHMgPSAob2JqZWN0VHlwZXNbdHlwZW9mIGV4cG9ydHNdICYmIGV4cG9ydHMgJiYgIWV4cG9ydHMubm9kZVR5cGUpXHJcbj8gZXhwb3J0c1xyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYC4gKi9cclxudmFyIGZyZWVNb2R1bGUgPSAob2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUpXHJcbj8gbW9kdWxlXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCB0aGUgcG9wdWxhciBDb21tb25KUyBleHRlbnNpb24gYG1vZHVsZS5leHBvcnRzYC4gKi9cclxudmFyIG1vZHVsZUV4cG9ydHMgPSAoZnJlZU1vZHVsZSAmJiBmcmVlTW9kdWxlLmV4cG9ydHMgPT09IGZyZWVFeHBvcnRzKVxyXG4/IGZyZWVFeHBvcnRzXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcy4gKi9cclxudmFyIGZyZWVHbG9iYWwgPSBjaGVja0dsb2JhbChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlICYmIHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsKTtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgc2VsZmAuICovXHJcbnZhciBmcmVlU2VsZiA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiBzZWxmXSAmJiBzZWxmKTtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgd2luZG93YC4gKi9cclxudmFyIGZyZWVXaW5kb3cgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygd2luZG93XSAmJiB3aW5kb3cpO1xyXG5cclxuLyoqIERldGVjdCBgdGhpc2AgYXMgdGhlIGdsb2JhbCBvYmplY3QuICovXHJcbnZhciB0aGlzR2xvYmFsID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHRoaXNdICYmIHRoaXMpO1xyXG5cclxuLyoqXHJcbiogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdC5cclxuKlxyXG4qIFRoZSBgdGhpc2AgdmFsdWUgaXMgdXNlZCBpZiBpdCdzIHRoZSBnbG9iYWwgb2JqZWN0IHRvIGF2b2lkIEdyZWFzZW1vbmtleSdzXHJcbiogcmVzdHJpY3RlZCBgd2luZG93YCBvYmplY3QsIG90aGVyd2lzZSB0aGUgYHdpbmRvd2Agb2JqZWN0IGlzIHVzZWQuXHJcbiovXHJcbnZhciByb290ID0gZnJlZUdsb2JhbCB8fFxyXG4oKGZyZWVXaW5kb3cgIT09ICh0aGlzR2xvYmFsICYmIHRoaXNHbG9iYWwud2luZG93KSkgJiYgZnJlZVdpbmRvdykgfHxcclxuICBmcmVlU2VsZiB8fCB0aGlzR2xvYmFsIHx8IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XHJcblxyXG5pZiggISgnZ2MnIGluIHdpbmRvdyApICkge1xyXG5cdHdpbmRvdy5nYyA9IGZ1bmN0aW9uKCl7fVxyXG59XHJcblxyXG5pZiAoIUhUTUxDYW52YXNFbGVtZW50LnByb3RvdHlwZS50b0Jsb2IpIHtcclxuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShIVE1MQ2FudmFzRWxlbWVudC5wcm90b3R5cGUsICd0b0Jsb2InLCB7XHJcbiAgdmFsdWU6IGZ1bmN0aW9uIChjYWxsYmFjaywgdHlwZSwgcXVhbGl0eSkge1xyXG5cclxuICAgIHZhciBiaW5TdHIgPSBhdG9iKCB0aGlzLnRvRGF0YVVSTCh0eXBlLCBxdWFsaXR5KS5zcGxpdCgnLCcpWzFdICksXHJcbiAgICAgICAgbGVuID0gYmluU3RyLmxlbmd0aCxcclxuICAgICAgICBhcnIgPSBuZXcgVWludDhBcnJheShsZW4pO1xyXG5cclxuICAgIGZvciAodmFyIGk9MDsgaTxsZW47IGkrKyApIHtcclxuICAgICBhcnJbaV0gPSBiaW5TdHIuY2hhckNvZGVBdChpKTtcclxuICAgIH1cclxuXHJcbiAgICBjYWxsYmFjayggbmV3IEJsb2IoIFthcnJdLCB7dHlwZTogdHlwZSB8fCAnaW1hZ2UvcG5nJ30gKSApO1xyXG4gIH1cclxuIH0pO1xyXG59XHJcblxyXG4vLyBAbGljZW5zZSBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXHJcbi8vIGNvcHlyaWdodCBQYXVsIElyaXNoIDIwMTVcclxuXHJcblxyXG4vLyBEYXRlLm5vdygpIGlzIHN1cHBvcnRlZCBldmVyeXdoZXJlIGV4Y2VwdCBJRTguIEZvciBJRTggd2UgdXNlIHRoZSBEYXRlLm5vdyBwb2x5ZmlsbFxyXG4vLyAgIGdpdGh1Yi5jb20vRmluYW5jaWFsLVRpbWVzL3BvbHlmaWxsLXNlcnZpY2UvYmxvYi9tYXN0ZXIvcG9seWZpbGxzL0RhdGUubm93L3BvbHlmaWxsLmpzXHJcbi8vIGFzIFNhZmFyaSA2IGRvZXNuJ3QgaGF2ZSBzdXBwb3J0IGZvciBOYXZpZ2F0aW9uVGltaW5nLCB3ZSB1c2UgYSBEYXRlLm5vdygpIHRpbWVzdGFtcCBmb3IgcmVsYXRpdmUgdmFsdWVzXHJcblxyXG4vLyBpZiB5b3Ugd2FudCB2YWx1ZXMgc2ltaWxhciB0byB3aGF0IHlvdSdkIGdldCB3aXRoIHJlYWwgcGVyZi5ub3csIHBsYWNlIHRoaXMgdG93YXJkcyB0aGUgaGVhZCBvZiB0aGUgcGFnZVxyXG4vLyBidXQgaW4gcmVhbGl0eSwgeW91J3JlIGp1c3QgZ2V0dGluZyB0aGUgZGVsdGEgYmV0d2VlbiBub3coKSBjYWxscywgc28gaXQncyBub3QgdGVycmlibHkgaW1wb3J0YW50IHdoZXJlIGl0J3MgcGxhY2VkXHJcblxyXG5cclxuKGZ1bmN0aW9uKCl7XHJcblxyXG4gIGlmIChcInBlcmZvcm1hbmNlXCIgaW4gd2luZG93ID09IGZhbHNlKSB7XHJcbiAgICAgIHdpbmRvdy5wZXJmb3JtYW5jZSA9IHt9O1xyXG4gIH1cclxuXHJcbiAgRGF0ZS5ub3cgPSAoRGF0ZS5ub3cgfHwgZnVuY3Rpb24gKCkgeyAgLy8gdGhhbmtzIElFOFxyXG5cdCAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gIH0pO1xyXG5cclxuICBpZiAoXCJub3dcIiBpbiB3aW5kb3cucGVyZm9ybWFuY2UgPT0gZmFsc2Upe1xyXG5cclxuICAgIHZhciBub3dPZmZzZXQgPSBEYXRlLm5vdygpO1xyXG5cclxuICAgIGlmIChwZXJmb3JtYW5jZS50aW1pbmcgJiYgcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydCl7XHJcbiAgICAgIG5vd09mZnNldCA9IHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnRcclxuICAgIH1cclxuXHJcbiAgICB3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24gbm93KCl7XHJcbiAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gbm93T2Zmc2V0O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbn0pKCk7XHJcblxyXG5cclxuZnVuY3Rpb24gcGFkKCBuICkge1xyXG5cdHJldHVybiBTdHJpbmcoXCIwMDAwMDAwXCIgKyBuKS5zbGljZSgtNyk7XHJcbn1cclxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvQWRkLW9ucy9Db2RlX3NuaXBwZXRzL1RpbWVyc1xyXG5cclxudmFyIGdfc3RhcnRUaW1lID0gd2luZG93LkRhdGUubm93KCk7XHJcblxyXG5mdW5jdGlvbiBndWlkKCkge1xyXG5cdGZ1bmN0aW9uIHM0KCkge1xyXG5cdFx0cmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApLnRvU3RyaW5nKDE2KS5zdWJzdHJpbmcoMSk7XHJcblx0fVxyXG5cdHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gQ0NGcmFtZUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgX2hhbmRsZXJzID0ge307XHJcblxyXG5cdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHJcblx0dGhpcy5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBoYW5kbGVyKSB7XHJcblxyXG5cdFx0X2hhbmRsZXJzW2V2ZW50XSA9IGhhbmRsZXI7XHJcblxyXG5cdH07XHJcblxyXG5cdHRoaXMuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblxyXG5cdFx0dmFyIGhhbmRsZXIgPSBfaGFuZGxlcnNbZXZlbnRdO1xyXG5cdFx0aWYgKGhhbmRsZXIpIHtcclxuXHJcblx0XHRcdGhhbmRsZXIuYXBwbHkobnVsbCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHR0aGlzLmZpbGVuYW1lID0gc2V0dGluZ3MubmFtZSB8fCBndWlkKCk7XHJcblx0dGhpcy5leHRlbnNpb24gPSAnJztcclxuXHR0aGlzLm1pbWVUeXBlID0gJyc7XHJcblxyXG59XHJcblxyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zYWZlVG9Qcm9jZWVkID0gZnVuY3Rpb24oKXsgcmV0dXJuIHRydWU7IH07XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdGVwID0gZnVuY3Rpb24oKSB7IGNvbnNvbGUubG9nKCAnU3RlcCBub3Qgc2V0IScgKSB9XHJcblxyXG5mdW5jdGlvbiBDQ1RhckVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcudGFyJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAnYXBwbGljYXRpb24veC10YXInXHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJyc7XHJcblxyXG5cdHRoaXMudGFwZSA9IG51bGxcclxuXHR0aGlzLmNvdW50ID0gMDtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe1xyXG5cclxuXHR0aGlzLmRpc3Bvc2UoKTtcclxuXHJcbn07XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBibG9iICkge1xyXG5cclxuXHR2YXIgZmlsZVJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcblx0ZmlsZVJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMudGFwZS5hcHBlbmQoIHBhZCggdGhpcy5jb3VudCApICsgdGhpcy5maWxlRXh0ZW5zaW9uLCBuZXcgVWludDhBcnJheSggZmlsZVJlYWRlci5yZXN1bHQgKSApO1xyXG5cclxuXHRcdC8vaWYoIHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lID4gMCAmJiAoIHRoaXMuZnJhbWVzLmxlbmd0aCAvIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlICkgPj0gdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgKSB7XHJcblxyXG5cdFx0dGhpcy5jb3VudCsrO1xyXG5cdFx0dGhpcy5zdGVwKCk7XHJcblx0fS5iaW5kKCB0aGlzICk7XHJcblx0ZmlsZVJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0Y2FsbGJhY2soIHRoaXMudGFwZS5zYXZlKCkgKTtcclxuXHJcbn1cclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLnRhcGUgPSBuZXcgVGFyKCk7XHJcblx0dGhpcy5jb3VudCA9IDA7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ1BOR0VuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ1RhckVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy50eXBlID0gJ2ltYWdlL3BuZyc7XHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJy5wbmcnO1xyXG5cclxufVxyXG5cclxuQ0NQTkdFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDVGFyRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDUE5HRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0Y2FudmFzLnRvQmxvYiggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRDQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZC5jYWxsKCB0aGlzLCBibG9iICk7XHJcblx0fS5iaW5kKCB0aGlzICksIHRoaXMudHlwZSApXHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0pQRUdFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NUYXJFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMudHlwZSA9ICdpbWFnZS9qcGVnJztcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnLmpwZyc7XHJcblx0dGhpcy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG59XHJcblxyXG5DQ0pQRUdFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDVGFyRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDSlBFR0VuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGNhbnZhcy50b0Jsb2IoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0Q0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQuY2FsbCggdGhpcywgYmxvYiApO1xyXG5cdH0uYmluZCggdGhpcyApLCB0aGlzLnR5cGUsIHRoaXMucXVhbGl0eSApXHJcblxyXG59XHJcblxyXG4vKlxyXG5cclxuXHRXZWJNIEVuY29kZXJcclxuXHJcbiovXHJcblxyXG5mdW5jdGlvbiBDQ1dlYk1FbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcblx0aWYoIGNhbnZhcy50b0RhdGFVUkwoICdpbWFnZS93ZWJwJyApLnN1YnN0cig1LDEwKSAhPT0gJ2ltYWdlL3dlYnAnICl7XHJcblx0XHRjb25zb2xlLmxvZyggXCJXZWJQIG5vdCBzdXBwb3J0ZWQgLSB0cnkgYW5vdGhlciBleHBvcnQgZm9ybWF0XCIgKVxyXG5cdH1cclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy53ZWJtJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAndmlkZW8vd2VibSdcclxuXHR0aGlzLmJhc2VGaWxlbmFtZSA9IHRoaXMuZmlsZW5hbWU7XHJcblxyXG5cdHRoaXMuZnJhbWVzID0gW107XHJcblx0dGhpcy5wYXJ0ID0gMTtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlciA9IG5ldyBXZWJNV3JpdGVyKHtcclxuICAgIHF1YWxpdHk6IHRoaXMucXVhbGl0eSxcclxuICAgIGZpbGVXcml0ZXI6IG51bGwsXHJcbiAgICBmZDogbnVsbCxcclxuICAgIGZyYW1lUmF0ZTogc2V0dGluZ3MuZnJhbWVyYXRlXHJcbn0pO1xyXG5cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZGlzcG9zZSgpO1xyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlci5hZGRGcmFtZShjYW52YXMpO1xyXG5cclxuXHQvL3RoaXMuZnJhbWVzLnB1c2goIGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3dlYnAnLCB0aGlzLnF1YWxpdHkpICk7XHJcblxyXG5cdGlmKCB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSA+IDAgJiYgKCB0aGlzLmZyYW1lcy5sZW5ndGggLyB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApID49IHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lICkge1xyXG5cdFx0dGhpcy5zYXZlKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdFx0dGhpcy5maWxlbmFtZSA9IHRoaXMuYmFzZUZpbGVuYW1lICsgJy1wYXJ0LScgKyBwYWQoIHRoaXMucGFydCApO1xyXG5cdFx0XHRkb3dubG9hZCggYmxvYiwgdGhpcy5maWxlbmFtZSArIHRoaXMuZXh0ZW5zaW9uLCB0aGlzLm1pbWVUeXBlICk7XHJcblx0XHRcdHRoaXMuZGlzcG9zZSgpO1xyXG5cdFx0XHR0aGlzLnBhcnQrKztcclxuXHRcdFx0dGhpcy5maWxlbmFtZSA9IHRoaXMuYmFzZUZpbGVuYW1lICsgJy1wYXJ0LScgKyBwYWQoIHRoaXMucGFydCApO1xyXG5cdFx0XHR0aGlzLnN0ZXAoKTtcclxuXHRcdH0uYmluZCggdGhpcyApIClcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhpcy5zdGVwKCk7XHJcblx0fVxyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbi8vXHRpZiggIXRoaXMuZnJhbWVzLmxlbmd0aCApIHJldHVybjtcclxuXHJcbiAgdGhpcy52aWRlb1dyaXRlci5jb21wbGV0ZSgpLnRoZW4oY2FsbGJhY2spO1xyXG5cclxuXHQvKnZhciB3ZWJtID0gV2hhbW15LmZyb21JbWFnZUFycmF5KCB0aGlzLmZyYW1lcywgdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKVxyXG5cdHZhciBibG9iID0gbmV3IEJsb2IoIFsgd2VibSBdLCB7IHR5cGU6IFwib2N0ZXQvc3RyZWFtXCIgfSApO1xyXG5cdGNhbGxiYWNrKCBibG9iICk7Ki9cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmZyYW1lcyA9IFtdO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxuXHR0aGlzLmVuY29kZXIgPSBuZXcgRkZNcGVnU2VydmVyLlZpZGVvKCBzZXR0aW5ncyApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvY2VzcycsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuZW1pdCggJ3Byb2Nlc3MnIClcclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oJ2ZpbmlzaGVkJywgZnVuY3Rpb24oIHVybCwgc2l6ZSApIHtcclxuICAgICAgICB2YXIgY2IgPSB0aGlzLmNhbGxiYWNrO1xyXG4gICAgICAgIGlmICggY2IgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGNiKCB1cmwsIHNpemUgKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvZ3Jlc3MnLCBmdW5jdGlvbiggcHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgaWYgKCB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyggcHJvZ3Jlc3MgKVxyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdlcnJvcicsIGZ1bmN0aW9uKCBkYXRhICkge1xyXG4gICAgICAgIGFsZXJ0KEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpKTtcclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zdGFydCggdGhpcy5zZXR0aW5ncyApO1xyXG5cclxufTtcclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmFkZCggY2FudmFzICk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG4gICAgdGhpcy5lbmNvZGVyLmVuZCgpO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zYWZlVG9Qcm9jZWVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5lbmNvZGVyLnNhZmVUb1Byb2NlZWQoKTtcclxufTtcclxuXHJcbi8qXHJcblx0SFRNTENhbnZhc0VsZW1lbnQuY2FwdHVyZVN0cmVhbSgpXHJcbiovXHJcblxyXG5mdW5jdGlvbiBDQ1N0cmVhbUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLmZyYW1lcmF0ZSA9IHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdHRoaXMudHlwZSA9ICd2aWRlby93ZWJtJztcclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcud2VibSc7XHJcblx0dGhpcy5zdHJlYW0gPSBudWxsO1xyXG5cdHRoaXMubWVkaWFSZWNvcmRlciA9IG51bGw7XHJcblx0dGhpcy5jaHVua3MgPSBbXTtcclxuXHJcbn1cclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0aWYoICF0aGlzLnN0cmVhbSApIHtcclxuXHRcdHRoaXMuc3RyZWFtID0gY2FudmFzLmNhcHR1cmVTdHJlYW0oIHRoaXMuZnJhbWVyYXRlICk7XHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIgPSBuZXcgTWVkaWFSZWNvcmRlciggdGhpcy5zdHJlYW0gKTtcclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlci5zdGFydCgpO1xyXG5cclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlci5vbmRhdGFhdmFpbGFibGUgPSBmdW5jdGlvbihlKSB7XHJcblx0XHRcdHRoaXMuY2h1bmtzLnB1c2goZS5kYXRhKTtcclxuXHRcdH0uYmluZCggdGhpcyApO1xyXG5cclxuXHR9XHJcblx0dGhpcy5zdGVwKCk7XHJcblxyXG59XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdHRoaXMubWVkaWFSZWNvcmRlci5vbnN0b3AgPSBmdW5jdGlvbiggZSApIHtcclxuXHRcdHZhciBibG9iID0gbmV3IEJsb2IoIHRoaXMuY2h1bmtzLCB7ICd0eXBlJyA6ICd2aWRlby93ZWJtJyB9KTtcclxuXHRcdHRoaXMuY2h1bmtzID0gW107XHJcblx0XHRjYWxsYmFjayggYmxvYiApO1xyXG5cclxuXHR9LmJpbmQoIHRoaXMgKTtcclxuXHJcblx0dGhpcy5tZWRpYVJlY29yZGVyLnN0b3AoKTtcclxuXHJcbn1cclxuXHJcbi8qZnVuY3Rpb24gQ0NHSUZFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gc2V0dGluZ3MucXVhbGl0eSB8fCA2O1xyXG5cdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHJcblx0dGhpcy5lbmNvZGVyID0gbmV3IEdJRkVuY29kZXIoKTtcclxuXHR0aGlzLmVuY29kZXIuc2V0UmVwZWF0KCAxICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0RGVsYXkoIHNldHRpbmdzLnN0ZXAgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRRdWFsaXR5KCA2ICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0VHJhbnNwYXJlbnQoIG51bGwgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRTaXplKCAxNTAsIDE1MCApO1xyXG5cclxuICBcdHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuICBcdHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCggJzJkJyApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyICk7XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zdGFydCgpO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmNhbnZhcy53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHR0aGlzLmNhbnZhcy5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdHRoaXMuY3R4LmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCB0aGlzLmN0eCApO1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc2V0U2l6ZSggY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0ICk7XHJcblx0dmFyIHJlYWRCdWZmZXIgPSBuZXcgVWludDhBcnJheShjYW52YXMud2lkdGggKiBjYW52YXMuaGVpZ2h0ICogNCk7XHJcblx0dmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApO1xyXG5cdGNvbnRleHQucmVhZFBpeGVscygwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQsIGNvbnRleHQuUkdCQSwgY29udGV4dC5VTlNJR05FRF9CWVRFLCByZWFkQnVmZmVyKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHJlYWRCdWZmZXIsIHRydWUgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuZmluaXNoKCk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdHZhciBiaW5hcnlfZ2lmID0gdGhpcy5lbmNvZGVyLnN0cmVhbSgpLmdldERhdGEoKTtcclxuXHJcblx0dmFyIGRhdGFfdXJsID0gJ2RhdGE6aW1hZ2UvZ2lmO2Jhc2U2NCwnK2VuY29kZTY0KGJpbmFyeV9naWYpO1xyXG5cdHdpbmRvdy5sb2NhdGlvbiA9IGRhdGFfdXJsO1xyXG5cdHJldHVybjtcclxuXHJcblx0dmFyIGJsb2IgPSBuZXcgQmxvYiggWyBiaW5hcnlfZ2lmIF0sIHsgdHlwZTogXCJvY3RldC9zdHJlYW1cIiB9ICk7XHJcblx0dmFyIHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKCBibG9iICk7XHJcblx0Y2FsbGJhY2soIHVybCApO1xyXG5cclxufSovXHJcblxyXG5mdW5jdGlvbiBDQ0dJRkVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gMzEgLSAoICggc2V0dGluZ3MucXVhbGl0eSAqIDMwIC8gMTAwICkgfHwgMTAgKTtcclxuXHRzZXR0aW5ncy53b3JrZXJzID0gc2V0dGluZ3Mud29ya2VycyB8fCA0O1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcuZ2lmJ1xyXG5cdHRoaXMubWltZVR5cGUgPSAnaW1hZ2UvZ2lmJ1xyXG5cclxuICBcdHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuICBcdHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCggJzJkJyApO1xyXG4gIFx0dGhpcy5zaXplU2V0ID0gZmFsc2U7XHJcblxyXG4gIFx0dGhpcy5lbmNvZGVyID0gbmV3IEdJRih7XHJcblx0XHR3b3JrZXJzOiBzZXR0aW5ncy53b3JrZXJzLFxyXG5cdFx0cXVhbGl0eTogc2V0dGluZ3MucXVhbGl0eSxcclxuXHRcdHdvcmtlclNjcmlwdDogc2V0dGluZ3Mud29ya2Vyc1BhdGggKyAnZ2lmLndvcmtlci5qcydcclxuXHR9ICk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAncHJvZ3Jlc3MnLCBmdW5jdGlvbiggcHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgaWYgKCB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyggcHJvZ3Jlc3MgKVxyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCdmaW5pc2hlZCcsIGZ1bmN0aW9uKCBibG9iICkge1xyXG4gICAgICAgIHZhciBjYiA9IHRoaXMuY2FsbGJhY2s7XHJcbiAgICAgICAgaWYgKCBjYiApIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgY2IoIGJsb2IgKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRpZiggIXRoaXMuc2l6ZVNldCApIHtcclxuXHRcdHRoaXMuZW5jb2Rlci5zZXRPcHRpb24oICd3aWR0aCcsY2FudmFzLndpZHRoICk7XHJcblx0XHR0aGlzLmVuY29kZXIuc2V0T3B0aW9uKCAnaGVpZ2h0JyxjYW52YXMuaGVpZ2h0ICk7XHJcblx0XHR0aGlzLnNpemVTZXQgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0dGhpcy5jYW52YXMud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0dGhpcy5jYW52YXMuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHR0aGlzLmN0eC5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHRoaXMuY3R4LCB7IGNvcHk6IHRydWUsIGRlbGF5OiB0aGlzLnNldHRpbmdzLnN0ZXAgfSApO1xyXG5cdHRoaXMuc3RlcCgpO1xyXG5cclxuXHQvKnRoaXMuZW5jb2Rlci5zZXRTaXplKCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQgKTtcclxuXHR2YXIgcmVhZEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGNhbnZhcy53aWR0aCAqIGNhbnZhcy5oZWlnaHQgKiA0KTtcclxuXHR2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICk7XHJcblx0Y29udGV4dC5yZWFkUGl4ZWxzKDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCwgY29udGV4dC5SR0JBLCBjb250ZXh0LlVOU0lHTkVEX0JZVEUsIHJlYWRCdWZmZXIpO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggcmVhZEJ1ZmZlciwgdHJ1ZSApOyovXHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xyXG5cclxuXHR0aGlzLmVuY29kZXIucmVuZGVyKCk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ2FwdHVyZSggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBfc2V0dGluZ3MgPSBzZXR0aW5ncyB8fCB7fSxcclxuXHRcdF9kYXRlID0gbmV3IERhdGUoKSxcclxuXHRcdF92ZXJib3NlLFxyXG5cdFx0X2Rpc3BsYXksXHJcblx0XHRfdGltZSxcclxuXHRcdF9zdGFydFRpbWUsXHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lLFxyXG5cdFx0X3BlcmZvcm1hbmNlU3RhcnRUaW1lLFxyXG5cdFx0X3N0ZXAsXHJcbiAgICAgICAgX2VuY29kZXIsXHJcblx0XHRfdGltZW91dHMgPSBbXSxcclxuXHRcdF9pbnRlcnZhbHMgPSBbXSxcclxuXHRcdF9mcmFtZUNvdW50ID0gMCxcclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID0gMCxcclxuXHRcdF9sYXN0RnJhbWUgPSBudWxsLFxyXG5cdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcyA9IFtdLFxyXG5cdFx0X2NhcHR1cmluZyA9IGZhbHNlLFxyXG4gICAgICAgIF9oYW5kbGVycyA9IHt9O1xyXG5cclxuXHRfc2V0dGluZ3MuZnJhbWVyYXRlID0gX3NldHRpbmdzLmZyYW1lcmF0ZSB8fCA2MDtcclxuXHRfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA9IDIgKiAoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzIHx8IDEgKTtcclxuXHRfdmVyYm9zZSA9IF9zZXR0aW5ncy52ZXJib3NlIHx8IGZhbHNlO1xyXG5cdF9kaXNwbGF5ID0gX3NldHRpbmdzLmRpc3BsYXkgfHwgZmFsc2U7XHJcblx0X3NldHRpbmdzLnN0ZXAgPSAxMDAwLjAgLyBfc2V0dGluZ3MuZnJhbWVyYXRlIDtcclxuXHRfc2V0dGluZ3MudGltZUxpbWl0ID0gX3NldHRpbmdzLnRpbWVMaW1pdCB8fCAwO1xyXG5cdF9zZXR0aW5ncy5mcmFtZUxpbWl0ID0gX3NldHRpbmdzLmZyYW1lTGltaXQgfHwgMDtcclxuXHRfc2V0dGluZ3Muc3RhcnRUaW1lID0gX3NldHRpbmdzLnN0YXJ0VGltZSB8fCAwO1xyXG5cclxuXHR2YXIgX3RpbWVEaXNwbGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRfdGltZURpc3BsYXkuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5sZWZ0ID0gX3RpbWVEaXNwbGF5LnN0eWxlLnRvcCA9IDBcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2JsYWNrJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmZvbnRTaXplID0gJzExcHgnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnBhZGRpbmcgPSAnNXB4J1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5jb2xvciA9ICdyZWQnO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS56SW5kZXggPSAxMDAwMDBcclxuXHRpZiggX3NldHRpbmdzLmRpc3BsYXkgKSBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBfdGltZURpc3BsYXkgKTtcclxuXHJcblx0dmFyIGNhbnZhc01vdGlvbkJsdXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG5cdHZhciBjdHhNb3Rpb25CbHVyID0gY2FudmFzTW90aW9uQmx1ci5nZXRDb250ZXh0KCAnMmQnICk7XHJcblx0dmFyIGJ1ZmZlck1vdGlvbkJsdXI7XHJcblx0dmFyIGltYWdlRGF0YTtcclxuXHJcblx0X2xvZyggJ1N0ZXAgaXMgc2V0IHRvICcgKyBfc2V0dGluZ3Muc3RlcCArICdtcycgKTtcclxuXHJcbiAgICB2YXIgX2VuY29kZXJzID0ge1xyXG5cdFx0Z2lmOiBDQ0dJRkVuY29kZXIsXHJcblx0XHR3ZWJtOiBDQ1dlYk1FbmNvZGVyLFxyXG5cdFx0ZmZtcGVnc2VydmVyOiBDQ0ZGTXBlZ1NlcnZlckVuY29kZXIsXHJcblx0XHRwbmc6IENDUE5HRW5jb2RlcixcclxuXHRcdGpwZzogQ0NKUEVHRW5jb2RlcixcclxuXHRcdCd3ZWJtLW1lZGlhcmVjb3JkZXInOiBDQ1N0cmVhbUVuY29kZXJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIGN0b3IgPSBfZW5jb2RlcnNbIF9zZXR0aW5ncy5mb3JtYXQgXTtcclxuICAgIGlmICggIWN0b3IgKSB7XHJcblx0XHR0aHJvdyBcIkVycm9yOiBJbmNvcnJlY3Qgb3IgbWlzc2luZyBmb3JtYXQ6IFZhbGlkIGZvcm1hdHMgYXJlIFwiICsgT2JqZWN0LmtleXMoX2VuY29kZXJzKS5qb2luKFwiLCBcIik7XHJcbiAgICB9XHJcbiAgICBfZW5jb2RlciA9IG5ldyBjdG9yKCBfc2V0dGluZ3MgKTtcclxuICAgIF9lbmNvZGVyLnN0ZXAgPSBfc3RlcFxyXG5cclxuXHRfZW5jb2Rlci5vbigncHJvY2VzcycsIF9wcm9jZXNzKTtcclxuICAgIF9lbmNvZGVyLm9uKCdwcm9ncmVzcycsIF9wcm9ncmVzcyk7XHJcblxyXG4gICAgaWYgKFwicGVyZm9ybWFuY2VcIiBpbiB3aW5kb3cgPT0gZmFsc2UpIHtcclxuICAgIFx0d2luZG93LnBlcmZvcm1hbmNlID0ge307XHJcbiAgICB9XHJcblxyXG5cdERhdGUubm93ID0gKERhdGUubm93IHx8IGZ1bmN0aW9uICgpIHsgIC8vIHRoYW5rcyBJRThcclxuXHRcdHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuXHR9KTtcclxuXHJcblx0aWYgKFwibm93XCIgaW4gd2luZG93LnBlcmZvcm1hbmNlID09IGZhbHNlKXtcclxuXHJcblx0XHR2YXIgbm93T2Zmc2V0ID0gRGF0ZS5ub3coKTtcclxuXHJcblx0XHRpZiAocGVyZm9ybWFuY2UudGltaW5nICYmIHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQpe1xyXG5cdFx0XHRub3dPZmZzZXQgPSBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0XHJcblx0XHR9XHJcblxyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uIG5vdygpe1xyXG5cdFx0XHRyZXR1cm4gRGF0ZS5ub3coKSAtIG5vd09mZnNldDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciBfb2xkU2V0VGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0LFxyXG5cdFx0X29sZFNldEludGVydmFsID0gd2luZG93LnNldEludGVydmFsLFxyXG5cdCAgICBcdF9vbGRDbGVhckludGVydmFsID0gd2luZG93LmNsZWFySW50ZXJ2YWwsXHJcblx0XHRfb2xkQ2xlYXJUaW1lb3V0ID0gd2luZG93LmNsZWFyVGltZW91dCxcclxuXHRcdF9vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxyXG5cdFx0X29sZE5vdyA9IHdpbmRvdy5EYXRlLm5vdyxcclxuXHRcdF9vbGRQZXJmb3JtYW5jZU5vdyA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3csXHJcblx0XHRfb2xkR2V0VGltZSA9IHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lO1xyXG5cdC8vIERhdGUucHJvdG90eXBlLl9vbGRHZXRUaW1lID0gRGF0ZS5wcm90b3R5cGUuZ2V0VGltZTtcclxuXHJcblx0dmFyIG1lZGlhID0gW107XHJcblxyXG5cdGZ1bmN0aW9uIF9pbml0KCkge1xyXG5cclxuXHRcdF9sb2coICdDYXB0dXJlciBzdGFydCcgKTtcclxuXHJcblx0XHRfc3RhcnRUaW1lID0gd2luZG93LkRhdGUubm93KCk7XHJcblx0XHRfdGltZSA9IF9zdGFydFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cdFx0X3BlcmZvcm1hbmNlU3RhcnRUaW1lID0gd2luZG93LnBlcmZvcm1hbmNlLm5vdygpO1xyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSA9IF9wZXJmb3JtYW5jZVN0YXJ0VGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblxyXG5cdFx0d2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWUgPSBmdW5jdGlvbigpe1xyXG5cdFx0XHRyZXR1cm4gX3RpbWU7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LkRhdGUubm93ID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdHJldHVybiBfdGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0d2luZG93LnNldFRpbWVvdXQgPSBmdW5jdGlvbiggY2FsbGJhY2ssIHRpbWUgKSB7XHJcblx0XHRcdHZhciB0ID0ge1xyXG5cdFx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0XHR0aW1lOiB0aW1lLFxyXG5cdFx0XHRcdHRyaWdnZXJUaW1lOiBfdGltZSArIHRpbWVcclxuXHRcdFx0fTtcclxuXHRcdFx0X3RpbWVvdXRzLnB1c2goIHQgKTtcclxuXHRcdFx0X2xvZyggJ1RpbWVvdXQgc2V0IHRvICcgKyB0LnRpbWUgKTtcclxuICAgICAgICAgICAgcmV0dXJuIHQ7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCA9IGZ1bmN0aW9uKCBpZCApIHtcclxuXHRcdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfdGltZW91dHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdFx0aWYoIF90aW1lb3V0c1sgaiBdID09IGlkICkge1xyXG5cdFx0XHRcdFx0X3RpbWVvdXRzLnNwbGljZSggaiwgMSApO1xyXG5cdFx0XHRcdFx0X2xvZyggJ1RpbWVvdXQgY2xlYXJlZCcgKTtcclxuXHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uKCBjYWxsYmFjaywgdGltZSApIHtcclxuXHRcdFx0dmFyIHQgPSB7XHJcblx0XHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxyXG5cdFx0XHRcdHRpbWU6IHRpbWUsXHJcblx0XHRcdFx0dHJpZ2dlclRpbWU6IF90aW1lICsgdGltZVxyXG5cdFx0XHR9O1xyXG5cdFx0XHRfaW50ZXJ2YWxzLnB1c2goIHQgKTtcclxuXHRcdFx0X2xvZyggJ0ludGVydmFsIHNldCB0byAnICsgdC50aW1lICk7XHJcblx0XHRcdHJldHVybiB0O1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5jbGVhckludGVydmFsID0gZnVuY3Rpb24oIGlkICkge1xyXG5cdFx0XHRfbG9nKCAnY2xlYXIgSW50ZXJ2YWwnICk7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblx0XHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MucHVzaCggY2FsbGJhY2sgKTtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0cmV0dXJuIF9wZXJmb3JtYW5jZVRpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdGZ1bmN0aW9uIGhvb2tDdXJyZW50VGltZSgpIHtcclxuXHRcdFx0aWYoICF0aGlzLl9ob29rZWQgKSB7XHJcblx0XHRcdFx0dGhpcy5faG9va2VkID0gdHJ1ZTtcclxuXHRcdFx0XHR0aGlzLl9ob29rZWRUaW1lID0gdGhpcy5jdXJyZW50VGltZSB8fCAwO1xyXG5cdFx0XHRcdHRoaXMucGF1c2UoKTtcclxuXHRcdFx0XHRtZWRpYS5wdXNoKCB0aGlzICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHRoaXMuX2hvb2tlZFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIEhUTUxWaWRlb0VsZW1lbnQucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7IGdldDogaG9va0N1cnJlbnRUaW1lIH0gKVxyXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoIEhUTUxBdWRpb0VsZW1lbnQucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7IGdldDogaG9va0N1cnJlbnRUaW1lIH0gKVxyXG5cdFx0fSBjYXRjaCAoZXJyKSB7XHJcblx0XHRcdF9sb2coZXJyKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RhcnQoKSB7XHJcblx0XHRfaW5pdCgpO1xyXG5cdFx0X2VuY29kZXIuc3RhcnQoKTtcclxuXHRcdF9jYXB0dXJpbmcgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0b3AoKSB7XHJcblx0XHRfY2FwdHVyaW5nID0gZmFsc2U7XHJcblx0XHRfZW5jb2Rlci5zdG9wKCk7XHJcblx0XHRfZGVzdHJveSgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NhbGwoIGZuLCBwICkge1xyXG5cdFx0X29sZFNldFRpbWVvdXQoIGZuLCAwLCBwICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RlcCgpIHtcclxuXHRcdC8vX29sZFJlcXVlc3RBbmltYXRpb25GcmFtZSggX3Byb2Nlc3MgKTtcclxuXHRcdF9jYWxsKCBfcHJvY2VzcyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2Rlc3Ryb3koKSB7XHJcblx0XHRfbG9nKCAnQ2FwdHVyZXIgc3RvcCcgKTtcclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0ID0gX29sZFNldFRpbWVvdXQ7XHJcblx0XHR3aW5kb3cuc2V0SW50ZXJ2YWwgPSBfb2xkU2V0SW50ZXJ2YWw7XHJcblx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCA9IF9vbGRDbGVhckludGVydmFsO1xyXG5cdFx0d2luZG93LmNsZWFyVGltZW91dCA9IF9vbGRDbGVhclRpbWVvdXQ7XHJcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gX29sZFJlcXVlc3RBbmltYXRpb25GcmFtZTtcclxuXHRcdHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lID0gX29sZEdldFRpbWU7XHJcblx0XHR3aW5kb3cuRGF0ZS5ub3cgPSBfb2xkTm93O1xyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IF9vbGRQZXJmb3JtYW5jZU5vdztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF91cGRhdGVUaW1lKCkge1xyXG5cdFx0dmFyIHNlY29uZHMgPSBfZnJhbWVDb3VudCAvIF9zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0XHRpZiggKCBfc2V0dGluZ3MuZnJhbWVMaW1pdCAmJiBfZnJhbWVDb3VudCA+PSBfc2V0dGluZ3MuZnJhbWVMaW1pdCApIHx8ICggX3NldHRpbmdzLnRpbWVMaW1pdCAmJiBzZWNvbmRzID49IF9zZXR0aW5ncy50aW1lTGltaXQgKSApIHtcclxuXHRcdFx0X3N0b3AoKTtcclxuXHRcdFx0X3NhdmUoKTtcclxuXHRcdH1cclxuXHRcdHZhciBkID0gbmV3IERhdGUoIG51bGwgKTtcclxuXHRcdGQuc2V0U2Vjb25kcyggc2Vjb25kcyApO1xyXG5cdFx0aWYoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID4gMiApIHtcclxuXHRcdFx0X3RpbWVEaXNwbGF5LnRleHRDb250ZW50ID0gJ0NDYXB0dXJlICcgKyBfc2V0dGluZ3MuZm9ybWF0ICsgJyB8ICcgKyBfZnJhbWVDb3VudCArICcgZnJhbWVzICgnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKyAnIGludGVyKSB8ICcgKyAgZC50b0lTT1N0cmluZygpLnN1YnN0ciggMTEsIDggKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdF90aW1lRGlzcGxheS50ZXh0Q29udGVudCA9ICdDQ2FwdHVyZSAnICsgX3NldHRpbmdzLmZvcm1hdCArICcgfCAnICsgX2ZyYW1lQ291bnQgKyAnIGZyYW1lcyB8ICcgKyAgZC50b0lTT1N0cmluZygpLnN1YnN0ciggMTEsIDggKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jaGVja0ZyYW1lKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0aWYoIGNhbnZhc01vdGlvbkJsdXIud2lkdGggIT09IGNhbnZhcy53aWR0aCB8fCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCAhPT0gY2FudmFzLmhlaWdodCApIHtcclxuXHRcdFx0Y2FudmFzTW90aW9uQmx1ci53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHRcdFx0Y2FudmFzTW90aW9uQmx1ci5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyID0gbmV3IFVpbnQxNkFycmF5KCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCAqIGNhbnZhc01vdGlvbkJsdXIud2lkdGggKiA0ICk7XHJcblx0XHRcdGN0eE1vdGlvbkJsdXIuZmlsbFN0eWxlID0gJyMwJ1xyXG5cdFx0XHRjdHhNb3Rpb25CbHVyLmZpbGxSZWN0KCAwLCAwLCBjYW52YXNNb3Rpb25CbHVyLndpZHRoLCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCApO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9ibGVuZEZyYW1lKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0Ly9fbG9nKCAnSW50ZXJtZWRpYXRlIEZyYW1lOiAnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKTtcclxuXHJcblx0XHRjdHhNb3Rpb25CbHVyLmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblx0XHRpbWFnZURhdGEgPSBjdHhNb3Rpb25CbHVyLmdldEltYWdlRGF0YSggMCwgMCwgY2FudmFzTW90aW9uQmx1ci53aWR0aCwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogXTtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSArPSBpbWFnZURhdGEuZGF0YVsgaiArIDEgXTtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSArPSBpbWFnZURhdGEuZGF0YVsgaiArIDIgXTtcclxuXHRcdH1cclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50Kys7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3NhdmVGcmFtZSgpe1xyXG5cclxuXHRcdHZhciBkYXRhID0gaW1hZ2VEYXRhLmRhdGE7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0ZGF0YVsgaiBdID0gYnVmZmVyTW90aW9uQmx1clsgaiBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0XHRkYXRhWyBqICsgMSBdID0gYnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdFx0ZGF0YVsgaiArIDIgXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHR9XHJcblx0XHRjdHhNb3Rpb25CbHVyLnB1dEltYWdlRGF0YSggaW1hZ2VEYXRhLCAwLCAwICk7XHJcblx0XHRfZW5jb2Rlci5hZGQoIGNhbnZhc01vdGlvbkJsdXIgKTtcclxuXHRcdF9mcmFtZUNvdW50Kys7XHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA9IDA7XHJcblx0XHRfbG9nKCAnRnVsbCBNQiBGcmFtZSEgJyArIF9mcmFtZUNvdW50ICsgJyAnICsgIF90aW1lICk7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiBdID0gMDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDEgXSA9IDA7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gPSAwO1xyXG5cdFx0fVxyXG5cdFx0Z2MoKTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2FwdHVyZSggY2FudmFzICkge1xyXG5cclxuXHRcdGlmKCBfY2FwdHVyaW5nICkge1xyXG5cclxuXHRcdFx0aWYoIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID4gMiApIHtcclxuXHJcblx0XHRcdFx0X2NoZWNrRnJhbWUoIGNhbnZhcyApO1xyXG5cdFx0XHRcdF9ibGVuZEZyYW1lKCBjYW52YXMgKTtcclxuXHJcblx0XHRcdFx0aWYoIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID49IC41ICogX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgKSB7XHJcblx0XHRcdFx0XHRfc2F2ZUZyYW1lKCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdF9zdGVwKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRfZW5jb2Rlci5hZGQoIGNhbnZhcyApO1xyXG5cdFx0XHRcdF9mcmFtZUNvdW50Kys7XHJcblx0XHRcdFx0X2xvZyggJ0Z1bGwgRnJhbWUhICcgKyBfZnJhbWVDb3VudCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9wcm9jZXNzKCkge1xyXG5cclxuXHRcdHZhciBzdGVwID0gMTAwMCAvIF9zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0XHR2YXIgZHQgPSAoIF9mcmFtZUNvdW50ICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyApICogc3RlcDtcclxuXHJcblx0XHRfdGltZSA9IF9zdGFydFRpbWUgKyBkdDtcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUgPSBfcGVyZm9ybWFuY2VTdGFydFRpbWUgKyBkdDtcclxuXHJcblx0XHRtZWRpYS5mb3JFYWNoKCBmdW5jdGlvbiggdiApIHtcclxuXHRcdFx0di5faG9va2VkVGltZSA9IGR0IC8gMTAwMDtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRfdXBkYXRlVGltZSgpO1xyXG5cdFx0X2xvZyggJ0ZyYW1lOiAnICsgX2ZyYW1lQ291bnQgKyAnICcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCApO1xyXG5cclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgX3RpbWVvdXRzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRpZiggX3RpbWUgPj0gX3RpbWVvdXRzWyBqIF0udHJpZ2dlclRpbWUgKSB7XHJcblx0XHRcdFx0X2NhbGwoIF90aW1lb3V0c1sgaiBdLmNhbGxiYWNrIClcclxuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCAndGltZW91dCEnICk7XHJcblx0XHRcdFx0X3RpbWVvdXRzLnNwbGljZSggaiwgMSApO1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfaW50ZXJ2YWxzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRpZiggX3RpbWUgPj0gX2ludGVydmFsc1sgaiBdLnRyaWdnZXJUaW1lICkge1xyXG5cdFx0XHRcdF9jYWxsKCBfaW50ZXJ2YWxzWyBqIF0uY2FsbGJhY2sgKTtcclxuXHRcdFx0XHRfaW50ZXJ2YWxzWyBqIF0udHJpZ2dlclRpbWUgKz0gX2ludGVydmFsc1sgaiBdLnRpbWU7XHJcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggJ2ludGVydmFsIScgKTtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MuZm9yRWFjaCggZnVuY3Rpb24oIGNiICkge1xyXG4gICAgIFx0XHRfY2FsbCggY2IsIF90aW1lIC0gZ19zdGFydFRpbWUgKTtcclxuICAgICAgICB9ICk7XHJcbiAgICAgICAgX3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcyA9IFtdO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zYXZlKCBjYWxsYmFjayApIHtcclxuXHJcblx0XHRpZiggIWNhbGxiYWNrICkge1xyXG5cdFx0XHRjYWxsYmFjayA9IGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0XHRcdGRvd25sb2FkKCBibG9iLCBfZW5jb2Rlci5maWxlbmFtZSArIF9lbmNvZGVyLmV4dGVuc2lvbiwgX2VuY29kZXIubWltZVR5cGUgKTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdF9lbmNvZGVyLnNhdmUoIGNhbGxiYWNrICk7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2xvZyggbWVzc2FnZSApIHtcclxuXHRcdGlmKCBfdmVyYm9zZSApIGNvbnNvbGUubG9nKCBtZXNzYWdlICk7XHJcblx0fVxyXG5cclxuICAgIGZ1bmN0aW9uIF9vbiggZXZlbnQsIGhhbmRsZXIgKSB7XHJcblxyXG4gICAgICAgIF9oYW5kbGVyc1tldmVudF0gPSBoYW5kbGVyO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfZW1pdCggZXZlbnQgKSB7XHJcblxyXG4gICAgICAgIHZhciBoYW5kbGVyID0gX2hhbmRsZXJzW2V2ZW50XTtcclxuICAgICAgICBpZiAoIGhhbmRsZXIgKSB7XHJcblxyXG4gICAgICAgICAgICBoYW5kbGVyLmFwcGx5KCBudWxsLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggYXJndW1lbnRzLCAxICkgKTtcclxuXHJcbiAgICAgICAgfVxyXG5cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfcHJvZ3Jlc3MoIHByb2dyZXNzICkge1xyXG5cclxuICAgICAgICBfZW1pdCggJ3Byb2dyZXNzJywgcHJvZ3Jlc3MgKTtcclxuXHJcbiAgICB9XHJcblxyXG5cdHJldHVybiB7XHJcblx0XHRzdGFydDogX3N0YXJ0LFxyXG5cdFx0Y2FwdHVyZTogX2NhcHR1cmUsXHJcblx0XHRzdG9wOiBfc3RvcCxcclxuXHRcdHNhdmU6IF9zYXZlLFxyXG4gICAgICAgIG9uOiBfb25cclxuXHR9XHJcbn1cclxuXHJcbihmcmVlV2luZG93IHx8IGZyZWVTZWxmIHx8IHt9KS5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG5cclxuICAvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzIGxpa2Ugci5qcyBjaGVjayBmb3IgY29uZGl0aW9uIHBhdHRlcm5zIGxpa2UgdGhlIGZvbGxvd2luZzpcclxuICBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcclxuICAgIC8vIERlZmluZSBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlIHNvLCB0aHJvdWdoIHBhdGggbWFwcGluZywgaXQgY2FuIGJlXHJcbiAgICAvLyByZWZlcmVuY2VkIGFzIHRoZSBcInVuZGVyc2NvcmVcIiBtb2R1bGUuXHJcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XHJcbiAgICBcdHJldHVybiBDQ2FwdHVyZTtcclxuICAgIH0pO1xyXG59XHJcbiAgLy8gQ2hlY2sgZm9yIGBleHBvcnRzYCBhZnRlciBgZGVmaW5lYCBpbiBjYXNlIGEgYnVpbGQgb3B0aW1pemVyIGFkZHMgYW4gYGV4cG9ydHNgIG9iamVjdC5cclxuICBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlKSB7XHJcbiAgICAvLyBFeHBvcnQgZm9yIE5vZGUuanMuXHJcbiAgICBpZiAobW9kdWxlRXhwb3J0cykge1xyXG4gICAgXHQoZnJlZU1vZHVsZS5leHBvcnRzID0gQ0NhcHR1cmUpLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbiAgICB9XHJcbiAgICAvLyBFeHBvcnQgZm9yIENvbW1vbkpTIHN1cHBvcnQuXHJcbiAgICBmcmVlRXhwb3J0cy5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG59XHJcbmVsc2Uge1xyXG4gICAgLy8gRXhwb3J0IHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxyXG4gICAgcm9vdC5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG59XHJcblxyXG59KCkpO1xyXG4iLCIvKipcbiAqIEBhdXRob3IgYWx0ZXJlZHEgLyBodHRwOi8vYWx0ZXJlZHF1YWxpYS5jb20vXG4gKiBAYXV0aG9yIG1yLmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbS9cbiAqL1xuXG52YXIgRGV0ZWN0b3IgPSB7XG5cblx0Y2FudmFzOiAhISB3aW5kb3cuQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELFxuXHR3ZWJnbDogKCBmdW5jdGlvbiAoKSB7XG5cblx0XHR0cnkge1xuXG5cdFx0XHR2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTsgcmV0dXJuICEhICggd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCAmJiAoIGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICkgfHwgY2FudmFzLmdldENvbnRleHQoICdleHBlcmltZW50YWwtd2ViZ2wnICkgKSApO1xuXG5cdFx0fSBjYXRjaCAoIGUgKSB7XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblxuXHRcdH1cblxuXHR9ICkoKSxcblx0d29ya2VyczogISEgd2luZG93Lldvcmtlcixcblx0ZmlsZWFwaTogd2luZG93LkZpbGUgJiYgd2luZG93LkZpbGVSZWFkZXIgJiYgd2luZG93LkZpbGVMaXN0ICYmIHdpbmRvdy5CbG9iLFxuXG5cdGdldFdlYkdMRXJyb3JNZXNzYWdlOiBmdW5jdGlvbiAoKSB7XG5cblx0XHR2YXIgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0ZWxlbWVudC5pZCA9ICd3ZWJnbC1lcnJvci1tZXNzYWdlJztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRTaXplID0gJzEzcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9ICdub3JtYWwnO1xuXHRcdGVsZW1lbnQuc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XG5cdFx0ZWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kID0gJyNmZmYnO1xuXHRcdGVsZW1lbnQuc3R5bGUuY29sb3IgPSAnIzAwMCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5wYWRkaW5nID0gJzEuNWVtJztcblx0XHRlbGVtZW50LnN0eWxlLnpJbmRleCA9ICc5OTknO1xuXHRcdGVsZW1lbnQuc3R5bGUud2lkdGggPSAnNDAwcHgnO1xuXHRcdGVsZW1lbnQuc3R5bGUubWFyZ2luID0gJzVlbSBhdXRvIDAnO1xuXG5cdFx0aWYgKCAhIHRoaXMud2ViZ2wgKSB7XG5cblx0XHRcdGVsZW1lbnQuaW5uZXJIVE1MID0gd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCA/IFtcblx0XHRcdFx0J1lvdXIgZ3JhcGhpY3MgY2FyZCBkb2VzIG5vdCBzZWVtIHRvIHN1cHBvcnQgPGEgaHJlZj1cImh0dHA6Ly9raHJvbm9zLm9yZy93ZWJnbC93aWtpL0dldHRpbmdfYV9XZWJHTF9JbXBsZW1lbnRhdGlvblwiIHN0eWxlPVwiY29sb3I6IzAwMFwiPldlYkdMPC9hPi48YnIgLz4nLFxuXHRcdFx0XHQnRmluZCBvdXQgaG93IHRvIGdldCBpdCA8YSBocmVmPVwiaHR0cDovL2dldC53ZWJnbC5vcmcvXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+aGVyZTwvYT4uJ1xuXHRcdFx0XS5qb2luKCAnXFxuJyApIDogW1xuXHRcdFx0XHQnWW91ciBicm93c2VyIGRvZXMgbm90IHNlZW0gdG8gc3VwcG9ydCA8YSBocmVmPVwiaHR0cDovL2tocm9ub3Mub3JnL3dlYmdsL3dpa2kvR2V0dGluZ19hX1dlYkdMX0ltcGxlbWVudGF0aW9uXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+V2ViR0w8L2E+Ljxici8+Jyxcblx0XHRcdFx0J0ZpbmQgb3V0IGhvdyB0byBnZXQgaXQgPGEgaHJlZj1cImh0dHA6Ly9nZXQud2ViZ2wub3JnL1wiIHN0eWxlPVwiY29sb3I6IzAwMFwiPmhlcmU8L2E+Lidcblx0XHRcdF0uam9pbiggJ1xcbicgKTtcblxuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50O1xuXG5cdH0sXG5cblx0YWRkR2V0V2ViR0xNZXNzYWdlOiBmdW5jdGlvbiAoIHBhcmFtZXRlcnMgKSB7XG5cblx0XHR2YXIgcGFyZW50LCBpZCwgZWxlbWVudDtcblxuXHRcdHBhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzIHx8IHt9O1xuXG5cdFx0cGFyZW50ID0gcGFyYW1ldGVycy5wYXJlbnQgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMucGFyZW50IDogZG9jdW1lbnQuYm9keTtcblx0XHRpZCA9IHBhcmFtZXRlcnMuaWQgIT09IHVuZGVmaW5lZCA/IHBhcmFtZXRlcnMuaWQgOiAnb2xkaWUnO1xuXG5cdFx0ZWxlbWVudCA9IERldGVjdG9yLmdldFdlYkdMRXJyb3JNZXNzYWdlKCk7XG5cdFx0ZWxlbWVudC5pZCA9IGlkO1xuXG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKCBlbGVtZW50ICk7XG5cblx0fVxuXG59O1xuXG4vL0VTNiBleHBvcnRcblxuZXhwb3J0IHsgRGV0ZWN0b3IgfTtcbiIsIi8vVGhpcyBsaWJyYXJ5IGlzIGRlc2lnbmVkIHRvIGhlbHAgc3RhcnQgdGhyZWUuanMgZWFzaWx5LCBjcmVhdGluZyB0aGUgcmVuZGVyIGxvb3AgYW5kIGNhbnZhcyBhdXRvbWFnaWNhbGx5LlxuLy9SZWFsbHkgaXQgc2hvdWxkIGJlIHNwdW4gb2ZmIGludG8gaXRzIG93biB0aGluZyBpbnN0ZWFkIG9mIGJlaW5nIHBhcnQgb2YgZXhwbGFuYXJpYS5cblxuLy9hbHNvLCBjaGFuZ2UgVGhyZWVhc3lfRW52aXJvbm1lbnQgdG8gVGhyZWVhc3lfUmVjb3JkZXIgdG8gZG93bmxvYWQgaGlnaC1xdWFsaXR5IGZyYW1lcyBvZiBhbiBhbmltYXRpb25cblxuaW1wb3J0IENDYXB0dXJlIGZyb20gJ2NjYXB0dXJlLmpzJztcbmltcG9ydCB7IERldGVjdG9yIH0gZnJvbSAnLi4vbGliL1dlYkdMX0RldGVjdG9yLmpzJztcbmltcG9ydCB7IHNldFRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuL1RocmVlRW52aXJvbm1lbnQuanMnO1xuXG5mdW5jdGlvbiBUaHJlZWFzeUVudmlyb25tZW50KGNhbnZhc0NvbnRhaW5lciA9IG51bGwpe1xuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSAwO1xuICAgIHRoaXMuc2hvdWxkQ3JlYXRlQ29udGFpbmVyID0gKGNhbnZhc0NvbnRhaW5lciA9PT0gbnVsbCk7XG5cblx0aWYoIURldGVjdG9yLndlYmdsKURldGVjdG9yLmFkZEdldFdlYkdMTWVzc2FnZSgpO1xuXG5cdHRoaXMuY2FtZXJhID0gbmV3IFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYSh7XG5cdFx0bmVhcjogLjEsXG5cdFx0ZmFyOiAxMDAwMCxcblxuXHRcdC8vdHlwZTogJ3BlcnNwZWN0aXZlJyxcblx0XHRmb3Y6IDYwLFxuXHRcdGFzcGVjdDogMSxcbi8qXG5cdFx0Ly8gdHlwZTogJ29ydGhvZ3JhcGhpYycsXG5cdFx0bGVmdDogLTEsXG5cdFx0cmlnaHQ6IDEsXG5cdFx0Ym90dG9tOiAtMSxcblx0XHR0b3A6IDEsKi9cblx0ICB9KTtcblxuXHR0aGlzLmNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYSggNzAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDEwMDAwMDAwICk7XG5cdC8vdGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuT3J0aG9ncmFwaGljQ2FtZXJhKCA3MCwgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDAuMSwgMTAgKTtcblxuXHR0aGlzLmNhbWVyYS5wb3NpdGlvbi5zZXQoMCwgMCwgMTApO1xuXHR0aGlzLmNhbWVyYS5sb29rQXQobmV3IFRIUkVFLlZlY3RvcjMoMCwwLDApKTtcblxuXG5cdC8vY3JlYXRlIGNhbWVyYSwgc2NlbmUsIHRpbWVyLCByZW5kZXJlciBvYmplY3RzXG5cdC8vY3JhZXRlIHJlbmRlciBvYmplY3RcblxuXG5cdFxuXHR0aGlzLnNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5cdHRoaXMuc2NlbmUuYWRkKHRoaXMuY2FtZXJhKTtcblxuXHQvL3JlbmRlcmVyXG5cdGxldCByZW5kZXJlck9wdGlvbnMgPSB7IGFudGlhbGlhczogdHJ1ZX07XG5cblx0dGhpcy5yZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKCByZW5kZXJlck9wdGlvbnMgKTtcblx0dGhpcy5yZW5kZXJlci5zZXRQaXhlbFJhdGlvKCB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldENsZWFyQ29sb3IobmV3IFRIUkVFLkNvbG9yKDB4RkZGRkZGKSwgMS4wKTtcblxuXG4gICAgdGhpcy5vbldpbmRvd1Jlc2l6ZSgpOyAvL3Jlc2l6ZSBjYW52YXMgdG8gd2luZG93IHNpemUgYW5kIHNldCBhc3BlY3QgcmF0aW9cblx0Lypcblx0dGhpcy5yZW5kZXJlci5nYW1tYUlucHV0ID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci5nYW1tYU91dHB1dCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIuc2hhZG93TWFwLmVuYWJsZWQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlO1xuXHQqL1xuXG5cdHRoaXMudGltZVNjYWxlID0gMTtcblx0dGhpcy5lbGFwc2VkVGltZSA9IDA7XG5cdHRoaXMudHJ1ZUVsYXBzZWRUaW1lID0gMDtcblxuXHR0aGlzLmNvbnRhaW5lciA9IHRoaXMuc2hvdWxkQ3JlYXRlQ29udGFpbmVyID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKSA6IGNhbnZhc0NvbnRhaW5lcjtcblx0dGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQoIHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCApO1xuXG5cdHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vkb3duJywgdGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNldXAnLCB0aGlzLm9uTW91c2VVcC5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoc3RhcnQnLCB0aGlzLm9uTW91c2VEb3duLmJpbmQodGhpcyksIGZhbHNlICk7XG5cdHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAndG91Y2hlbmQnLCB0aGlzLm9uTW91c2VVcC5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAncmVzaXplJywgdGhpcy5vbldpbmRvd1Jlc2l6ZS5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXG5cdC8qXG5cdC8vcmVuZGVyZXIudnIuZW5hYmxlZCA9IHRydWU7IFxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3ZyZGlzcGxheXBvaW50ZXJyZXN0cmljdGVkJywgb25Qb2ludGVyUmVzdHJpY3RlZCwgZmFsc2UgKTtcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd2cmRpc3BsYXlwb2ludGVydW5yZXN0cmljdGVkJywgb25Qb2ludGVyVW5yZXN0cmljdGVkLCBmYWxzZSApO1xuXHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBXRUJWUi5jcmVhdGVCdXR0b24oIHJlbmRlcmVyICkgKTtcblx0Ki9cblxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIHRoaXMub25QYWdlTG9hZC5iaW5kKHRoaXMpLCBmYWxzZSk7XG5cblx0dGhpcy5jbG9jayA9IG5ldyBUSFJFRS5DbG9jaygpO1xuXG5cdHRoaXMuSVNfUkVDT1JESU5HID0gZmFsc2U7IC8vIHF1ZXJ5YWJsZSBpZiBvbmUgd2FudHMgdG8gZG8gdGhpbmdzIGxpa2UgYmVlZiB1cCBwYXJ0aWNsZSBjb3VudHMgZm9yIHJlbmRlclxuXG4gICAgaWYoIXRoaXMuc2hvdWxkQ3JlYXRlQ29udGFpbmVyICYmIGNhbnZhc0NvbnRhaW5lci5vZmZzZXRXaWR0aCl7XG4gICAgICAgIC8vSWYgdGhlIGNhbnZhc0VsZW1lbnQgaXMgYWxyZWFkeSBsb2FkZWQsIHRoZW4gdGhlICdsb2FkJyBldmVudCBoYXMgYWxyZWFkeSBmaXJlZC4gV2UgbmVlZCB0byB0cmlnZ2VyIGl0IG91cnNlbHZlcy5cbiAgICAgICAgdGhpcy5vblBhZ2VMb2FkKCk7XG4gICAgfVxufVxuXG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vblBhZ2VMb2FkID0gZnVuY3Rpb24oKSB7XG5cdGNvbnNvbGUubG9nKFwiVGhyZWVhc3lfU2V0dXAgbG9hZGVkIVwiKTtcblx0aWYodGhpcy5zaG91bGRDcmVhdGVDb250YWluZXIpe1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHRoaXMuY29udGFpbmVyICk7XG5cdH1cblxuXHR0aGlzLnN0YXJ0KCk7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCl7XG5cdHRoaXMucHJldl90aW1lc3RlcCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuXHR0aGlzLmNsb2NrLnN0YXJ0KCk7XG5cdHRoaXMucmVuZGVyKHRoaXMucHJldl90aW1lc3RlcCk7XG59XG5cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uTW91c2VEb3duID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuaXNNb3VzZURvd24gPSB0cnVlO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Nb3VzZVVwPSBmdW5jdGlvbigpIHtcblx0dGhpcy5pc01vdXNlRG93biA9IGZhbHNlO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Qb2ludGVyUmVzdHJpY3RlZD0gZnVuY3Rpb24oKSB7XG5cdHZhciBwb2ludGVyTG9ja0VsZW1lbnQgPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cdGlmICggcG9pbnRlckxvY2tFbGVtZW50ICYmIHR5cGVvZihwb2ludGVyTG9ja0VsZW1lbnQucmVxdWVzdFBvaW50ZXJMb2NrKSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRwb2ludGVyTG9ja0VsZW1lbnQucmVxdWVzdFBvaW50ZXJMb2NrKCk7XG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUG9pbnRlclVucmVzdHJpY3RlZD0gZnVuY3Rpb24oKSB7XG5cdHZhciBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ID0gZG9jdW1lbnQucG9pbnRlckxvY2tFbGVtZW50O1xuXHR2YXIgZXhwZWN0ZWRQb2ludGVyTG9ja0VsZW1lbnQgPSB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cdGlmICggY3VycmVudFBvaW50ZXJMb2NrRWxlbWVudCAmJiBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ID09PSBleHBlY3RlZFBvaW50ZXJMb2NrRWxlbWVudCAmJiB0eXBlb2YoZG9jdW1lbnQuZXhpdFBvaW50ZXJMb2NrKSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRkb2N1bWVudC5leGl0UG9pbnRlckxvY2soKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUuZXZlbmlmeSA9IGZ1bmN0aW9uKHgpe1xuXHRpZih4ICUgMiA9PSAxKXtcblx0XHRyZXR1cm4geCsxXG5cdH07XG5cdHJldHVybiB4O1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25XaW5kb3dSZXNpemU9IGZ1bmN0aW9uKCkge1xuICAgIGxldCB3aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICAgIGxldCBoZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cblx0dGhpcy5jYW1lcmEuYXNwZWN0ID0gd2lkdGggLyBoZWlnaHQ7XG5cdHRoaXMuYXNwZWN0ID0gdGhpcy5jYW1lcmEuYXNwZWN0O1xuXHR0aGlzLmNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG5cdHRoaXMucmVuZGVyZXIuc2V0U2l6ZSggdGhpcy5ldmVuaWZ5KHdpZHRoKSx0aGlzLmV2ZW5pZnkoaGVpZ2h0KSApO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUubGlzdGVuZXJzID0ge1widXBkYXRlXCI6IFtdLFwicmVuZGVyXCI6W119OyAvL3VwZGF0ZSBldmVudCBsaXN0ZW5lcnNcblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKHRpbWVzdGVwKXtcbiAgICB2YXIgcmVhbHRpbWVEZWx0YSA9IHRoaXMuY2xvY2suZ2V0RGVsdGEoKTtcblx0dmFyIGRlbHRhID0gcmVhbHRpbWVEZWx0YSp0aGlzLnRpbWVTY2FsZTtcblx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcbiAgICB0aGlzLnRydWVFbGFwc2VkVGltZSArPSByZWFsdGltZURlbHRhO1xuXHQvL2dldCB0aW1lc3RlcFxuXHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmxlbmd0aDtpKyspe1xuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YSwncmVhbHRpbWVEZWx0YSc6cmVhbHRpbWVEZWx0YX0pO1xuXHR9XG5cblx0dGhpcy5yZW5kZXJlci5yZW5kZXIoIHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhICk7XG5cblx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXVtpXSgpO1xuXHR9XG5cblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gdGltZXN0ZXA7XG5cdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50X25hbWUsIGZ1bmMpe1xuXHQvL1JlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lci5cblx0Ly9lYWNoIGxpc3RlbmVyIHdpbGwgYmUgY2FsbGVkIHdpdGggYW4gb2JqZWN0IGNvbnNpc3Rpbmcgb2Y6XG5cdC8vXHR7dDogPGN1cnJlbnQgdGltZSBpbiBzPiwgXCJkZWx0YVwiOiA8ZGVsdGEsIGluIG1zPn1cblx0Ly8gYW4gdXBkYXRlIGV2ZW50IGZpcmVzIGJlZm9yZSBhIHJlbmRlci4gYSByZW5kZXIgZXZlbnQgZmlyZXMgcG9zdC1yZW5kZXIuXG5cdGlmKGV2ZW50X25hbWUgPT0gXCJ1cGRhdGVcIil7IFxuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLnB1c2goZnVuYyk7XG5cdH1lbHNlIGlmKGV2ZW50X25hbWUgPT0gXCJyZW5kZXJcIil7IFxuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLnB1c2goZnVuYyk7XG5cdH1lbHNle1xuXHRcdGNvbnNvbGUuZXJyb3IoXCJJbnZhbGlkIGV2ZW50IG5hbWUhXCIpXG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbihldmVudF9uYW1lLCBmdW5jKXtcblx0Ly9VbnJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciwgdW5kb2luZyBhbiBUaHJlZWFzeV9zZXR1cC5vbigpIGV2ZW50IGxpc3RlbmVyLlxuXHQvL3RoZSBuYW1pbmcgc2NoZW1lIG1pZ2h0IG5vdCBiZSB0aGUgYmVzdCBoZXJlLlxuXHRpZihldmVudF9uYW1lID09IFwidXBkYXRlXCIpeyBcblx0XHRsZXQgaW5kZXggPSB0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5pbmRleE9mKGZ1bmMpO1xuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLnNwbGljZShpbmRleCwxKTtcblx0fSBlbHNlIGlmKGV2ZW50X25hbWUgPT0gXCJyZW5kZXJcIil7IFxuXHRcdGxldCBpbmRleCA9IHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLmluZGV4T2YoZnVuYyk7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0uc3BsaWNlKGluZGV4LDEpO1xuXHR9ZWxzZXtcblx0XHRjb25zb2xlLmVycm9yKFwiTm9uZXhpc3RlbnQgZXZlbnQgbmFtZSFcIilcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub2ZmID0gVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lcjsgLy9hbGlhcyB0byBtYXRjaCBUaHJlZWFzeUVudmlyb25tZW50Lm9uXG5cbmNsYXNzIFRocmVlYXN5UmVjb3JkZXIgZXh0ZW5kcyBUaHJlZWFzeUVudmlyb25tZW50e1xuXHQvL2Jhc2VkIG9uIGh0dHA6Ly93d3cudHlzb25jYWRlbmhlYWQuY29tL2Jsb2cvZXhwb3J0aW5nLWNhbnZhcy1hbmltYXRpb24tdG8tbW92LyB0byByZWNvcmQgYW4gYW5pbWF0aW9uXG5cdC8vd2hlbiBkb25lLCAgICAgZmZtcGVnIC1yIDYwIC1mcmFtZXJhdGUgNjAgLWkgLi8lMDdkLnBuZyAtdmNvZGVjIGxpYngyNjQgLXBpeF9mbXQgeXV2NDIwcCAtY3JmOnYgMCB2aWRlby5tcDRcbiAgICAvLyB0byBwZXJmb3JtIG1vdGlvbiBibHVyIG9uIGFuIG92ZXJzYW1wbGVkIHZpZGVvLCBmZm1wZWcgLWkgdmlkZW8ubXA0IC12ZiB0YmxlbmQ9YWxsX21vZGU9YXZlcmFnZSxmcmFtZXN0ZXA9MiB2aWRlbzIubXA0XG5cdC8vdGhlbiwgYWRkIHRoZSB5dXY0MjBwIHBpeGVscyAod2hpY2ggZm9yIHNvbWUgcmVhc29uIGlzbid0IGRvbmUgYnkgdGhlIHByZXYgY29tbWFuZCkgYnk6XG5cdC8vIGZmbXBlZyAtaSB2aWRlby5tcDQgLXZjb2RlYyBsaWJ4MjY0IC1waXhfZm10IHl1djQyMHAgLXN0cmljdCAtMiAtYWNvZGVjIGFhYyBmaW5pc2hlZF92aWRlby5tcDRcblx0Ly9jaGVjayB3aXRoIGZmbXBlZyAtaSBmaW5pc2hlZF92aWRlby5tcDRcblxuXHRjb25zdHJ1Y3RvcihmcHM9MzAsIGxlbmd0aCA9IDUsIGNhbnZhc0NvbnRhaW5lciA9IG51bGwpe1xuXHRcdC8qIGZwcyBpcyBldmlkZW50LCBhdXRvc3RhcnQgaXMgYSBib29sZWFuIChieSBkZWZhdWx0LCB0cnVlKSwgYW5kIGxlbmd0aCBpcyBpbiBzLiovXG5cdFx0c3VwZXIoY2FudmFzQ29udGFpbmVyKTtcblx0XHR0aGlzLmZwcyA9IGZwcztcblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblx0XHR0aGlzLmZyYW1lQ291bnQgPSBmcHMgKiBsZW5ndGg7XG5cdFx0dGhpcy5mcmFtZXNfcmVuZGVyZWQgPSAwO1xuXG5cdFx0dGhpcy5jYXB0dXJlciA9IG5ldyBDQ2FwdHVyZSgge1xuXHRcdFx0ZnJhbWVyYXRlOiBmcHMsXG5cdFx0XHRmb3JtYXQ6ICdwbmcnLFxuXHRcdFx0bmFtZTogZG9jdW1lbnQudGl0bGUsXG5cdFx0XHQvL3ZlcmJvc2U6IHRydWUsXG5cdFx0fSApO1xuXG5cdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMuSVNfUkVDT1JESU5HID0gdHJ1ZTtcblx0fVxuXHRzdGFydCgpe1xuXHRcdC8vbWFrZSBhIHJlY29yZGluZyBzaWduXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS53aWR0aD1cIjIwcHhcIlxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuaGVpZ2h0PVwiMjBweFwiXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS50b3AgPSAnMjBweCc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5sZWZ0ID0gJzIwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JlZCc7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLnJlY29yZGluZ19pY29uKTtcblxuXHRcdHRoaXMuZnJhbWVDb3VudGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUudG9wID0gJzIwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmxlZnQgPSAnNTBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuY29sb3IgPSAnYmxhY2snO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSgyNTUsMjU1LDI1NSwwLjEpJztcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuZnJhbWVDb3VudGVyKTtcblxuXHRcdHRoaXMuY2FwdHVyZXIuc3RhcnQoKTtcblx0XHR0aGlzLnJlbmRlcmluZyA9IHRydWU7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXHRyZW5kZXIodGltZXN0ZXApe1xuICAgICAgICB2YXIgcmVhbHRpbWVEZWx0YSA9IDEvdGhpcy5mcHM7Ly9pZ25vcmluZyB0aGUgdHJ1ZSB0aW1lLCBjYWxjdWxhdGUgdGhlIGRlbHRhXG5cdFx0dmFyIGRlbHRhID0gcmVhbHRpbWVEZWx0YSp0aGlzLnRpbWVTY2FsZTsgXG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcbiAgICAgICAgdGhpcy50cnVlRWxhcHNlZFRpbWUgKz0gcmVhbHRpbWVEZWx0YTtcblxuXHRcdC8vZ2V0IHRpbWVzdGVwXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YSwgJ3JlYWx0aW1lRGVsdGEnOnJlYWx0aW1lRGVsdGF9KTtcblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlcmVyLnJlbmRlciggdGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEgKTtcblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXVtpXSgpO1xuXHRcdH1cblxuXG5cdFx0dGhpcy5yZWNvcmRfZnJhbWUoKTtcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4JztcblxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG5cdH1cblx0cmVjb3JkX2ZyYW1lKCl7XG5cdC8vXHRsZXQgY3VycmVudF9mcmFtZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2NhbnZhcycpLnRvRGF0YVVSTCgpO1xuXG5cdFx0dGhpcy5jYXB0dXJlci5jYXB0dXJlKCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYW52YXMnKSApO1xuXG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuaW5uZXJIVE1MID0gdGhpcy5mcmFtZXNfcmVuZGVyZWQgKyBcIiAvIFwiICsgdGhpcy5mcmFtZUNvdW50OyAvL3VwZGF0ZSB0aW1lclxuXG5cdFx0dGhpcy5mcmFtZXNfcmVuZGVyZWQrKztcblxuXG5cdFx0aWYodGhpcy5mcmFtZXNfcmVuZGVyZWQ+dGhpcy5mcmFtZUNvdW50KXtcblx0XHRcdHRoaXMucmVuZGVyID0gbnVsbDsgLy9oYWNreSB3YXkgb2Ygc3RvcHBpbmcgdGhlIHJlbmRlcmluZ1xuXHRcdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHQvL3RoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuXHRcdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblx0XHRcdHRoaXMuY2FwdHVyZXIuc3RvcCgpO1xuXHRcdFx0Ly8gZGVmYXVsdCBzYXZlLCB3aWxsIGRvd25sb2FkIGF1dG9tYXRpY2FsbHkgYSBmaWxlIGNhbGxlZCB7bmFtZX0uZXh0ZW5zaW9uICh3ZWJtL2dpZi90YXIpXG5cdFx0XHR0aGlzLmNhcHR1cmVyLnNhdmUoKTtcblx0XHR9XG5cdH1cblx0b25XaW5kb3dSZXNpemUoKSB7XG5cdFx0Ly9zdG9wIHJlY29yZGluZyBpZiB3aW5kb3cgc2l6ZSBjaGFuZ2VzXG5cdFx0aWYodGhpcy5yZW5kZXJpbmcgJiYgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQgIT0gdGhpcy5hc3BlY3Qpe1xuXHRcdFx0dGhpcy5jYXB0dXJlci5zdG9wKCk7XG5cdFx0XHR0aGlzLnJlbmRlciA9IG51bGw7IC8vaGFja3kgd2F5IG9mIHN0b3BwaW5nIHRoZSByZW5kZXJpbmdcblx0XHRcdGFsZXJ0KFwiQWJvcnRpbmcgcmVjb3JkOiBXaW5kb3ctc2l6ZSBjaGFuZ2UgZGV0ZWN0ZWQhXCIpO1xuXHRcdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3VwZXIub25XaW5kb3dSZXNpemUoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBzZXR1cFRocmVlKGZwcz0zMCwgbGVuZ3RoID0gNSwgY2FudmFzQ29udGFpbmVyID0gbnVsbCl7XG5cdC8qIFNldCB1cCB0aGUgdGhyZWUuanMgZW52aXJvbm1lbnQuIFN3aXRjaCBiZXR3ZWVuIGNsYXNzZXMgZHluYW1pY2FsbHkgc28gdGhhdCB5b3UgY2FuIHJlY29yZCBieSBhcHBlbmRpbmcgXCI/cmVjb3JkPXRydWVcIiB0byBhbiB1cmwuIFRoZW4gRVhQLnRocmVlRW52aXJvbm1lbnQuY2FtZXJhIGFuZCBFWFAudGhyZWVFbnZpcm9ubWVudC5zY2VuZSB3b3JrLCBhcyB3ZWxsIGFzIEVYUC50aHJlZUVudmlyb25tZW50Lm9uKCdldmVudCBuYW1lJywgY2FsbGJhY2spLiBPbmx5IG9uZSBlbnZpcm9ubWVudCBleGlzdHMgYXQgYSB0aW1lLlxuXG4gICAgVGhlIHJldHVybmVkIG9iamVjdCBpcyBhIHNpbmdsZXRvbjogbXVsdGlwbGUgY2FsbHMgd2lsbCByZXR1cm4gdGhlIHNhbWUgb2JqZWN0OiBFWFAudGhyZWVFbnZpcm9ubWVudC4qL1xuXHR2YXIgcmVjb3JkZXIgPSBudWxsO1xuXHR2YXIgaXNfcmVjb3JkaW5nID0gZmFsc2U7XG5cblx0Ly9leHRyYWN0IHJlY29yZCBwYXJhbWV0ZXIgZnJvbSB1cmxcblx0dmFyIHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoZG9jdW1lbnQubG9jYXRpb24uc2VhcmNoKTtcblx0bGV0IHJlY29yZFN0cmluZyA9IHBhcmFtcy5nZXQoXCJyZWNvcmRcIik7XG5cblx0aWYocmVjb3JkU3RyaW5nKXsgLy9kZXRlY3QgaWYgVVJMIHBhcmFtcyBpbmNsdWRlID9yZWNvcmQ9MSBvciA/cmVjb3JkPXRydWVcbiAgICAgICAgcmVjb3JkU3RyaW5nID0gcmVjb3JkU3RyaW5nLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlzX3JlY29yZGluZyA9IChyZWNvcmRTdHJpbmcgPT0gXCJ0cnVlXCIgfHwgcmVjb3JkU3RyaW5nID09IFwiMVwiKTtcbiAgICB9XG5cbiAgICBpZihFWFAudGhyZWVFbnZpcm9ubWVudCAhPT0gbnVsbCl7Ly9zaW5nbGV0b24gaGFzIGFscmVhZHkgYmVlbiBjcmVhdGVkXG4gICAgICAgIHJldHVybiBFWFAudGhyZWVFbnZpcm9ubWVudDtcbiAgICB9XG5cbiAgICBsZXQgdGhyZWVFbnZpcm9ubWVudCA9IG51bGw7XG5cdGlmKGlzX3JlY29yZGluZyl7XG5cdFx0dGhyZWVFbnZpcm9ubWVudCA9IG5ldyBUaHJlZWFzeVJlY29yZGVyKGZwcywgbGVuZ3RoLCBjYW52YXNDb250YWluZXIpO1xuXHR9ZWxzZXtcblx0XHR0aHJlZUVudmlyb25tZW50ID0gbmV3IFRocmVlYXN5RW52aXJvbm1lbnQoY2FudmFzQ29udGFpbmVyKTtcblx0fVxuICAgIHNldFRocmVlRW52aXJvbm1lbnQodGhyZWVFbnZpcm9ubWVudCk7XG4gICAgcmV0dXJuIHRocmVlRW52aXJvbm1lbnQ7XG59XG5cbmV4cG9ydCB7c2V0dXBUaHJlZSwgVGhyZWVhc3lFbnZpcm9ubWVudCwgVGhyZWVhc3lSZWNvcmRlcn1cbiIsImFzeW5jIGZ1bmN0aW9uIGRlbGF5KHdhaXRUaW1lKXtcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHR9KTtcblxufVxuXG5leHBvcnQge2RlbGF5fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmNsYXNzIExpbmVPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29ya1xuXHRcdFx0b3B0aW9uczpcblx0XHRcdHtcblx0XHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0XHRvcGFjaXR5OiBudW1iZXJcblx0XHRcdFx0Y29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcblx0XHRcdH1cblx0XHQqL1xuXG5cdFx0dGhpcy5fd2lkdGggPSBvcHRpb25zLndpZHRoICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLndpZHRoIDogNTtcblx0XHR0aGlzLl9vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm9wYWNpdHkgOiAxO1xuXHRcdHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5jb2xvciA6IDB4NTVhYTU1O1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSAwOyAvL3Nob3VsZCBhbHdheXMgYmUgZXF1YWwgdG8gdGhpcy5wb2ludHMubGVuZ3RoXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBob3cgbWFueSB0aW1lcyB0byBiZSBjYWxsZWQgaW4gZWFjaCBkaXJlY3Rpb25cblx0XHR0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gMzsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT9cblxuXHRcdHRoaXMuaW5pdCgpO1xuXHR9XG5cdGluaXQoKXtcblx0XHR0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXHRcdHRoaXMuX3ZlcnRpY2VzO1xuXHRcdHRoaXMubWFrZUdlb21ldHJ5KCk7XG5cblx0XHR0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtjb2xvcjogdGhpcy5fY29sb3IsIGxpbmV3aWR0aDogdGhpcy5fd2lkdGgsb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSk7XG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLkxpbmVTZWdtZW50cyh0aGlzLl9nZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vIHNldHRlciBzZXRzIHRyYW5zcGFyZW50IGZsYWcgaWYgbmVjZXNzYXJ5XG5cblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXHR9XG5cblx0bWFrZUdlb21ldHJ5KCl7XG5cdFx0Ly8gZm9sbG93IGh0dHA6Ly9ibG9nLmNqZ2FtbW9uLmNvbS90aHJlZWpzLWdlb21ldHJ5XG5cdFx0Ly8gb3IgbWF0aGJveCdzIGxpbmVHZW9tZXRyeVxuXG5cdFx0Lypcblx0XHRUaGlzIGNvZGUgc2VlbXMgdG8gYmUgbmVjZXNzYXJ5IHRvIHJlbmRlciBsaW5lcyBhcyBhIHRyaWFuZ2xlIHN0cnAuXG5cdFx0SSBjYW4ndCBzZWVtIHRvIGdldCBpdCB0byB3b3JrIHByb3Blcmx5LlxuXG5cdFx0bGV0IG51bVZlcnRpY2VzID0gMztcblx0XHR2YXIgaW5kaWNlcyA9IFtdO1xuXG5cdFx0Ly9pbmRpY2VzXG5cdFx0bGV0IGJhc2UgPSAwO1xuXHRcdGZvcih2YXIgaz0wO2s8bnVtVmVydGljZXMtMTtrKz0xKXtcbiAgICAgICAgXHRpbmRpY2VzLnB1c2goIGJhc2UsIGJhc2UrMSwgYmFzZSsyKTtcblx0XHRcdGluZGljZXMucHVzaCggYmFzZSsyLCBiYXNlKzEsIGJhc2UrMyk7XG5cdFx0XHRiYXNlICs9IDI7XG5cdFx0fVxuXHRcdHRoaXMuX2dlb21ldHJ5LnNldEluZGV4KCBpbmRpY2VzICk7Ki9cblxuXHRcdGxldCBNQVhfUE9JTlRTID0gMTAwMDA7XG5cblx0XHR0aGlzLl92ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDIgKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcblxuXHRcdC8vIGJ1aWxkIGdlb21ldHJ5XG5cblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdwb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl92ZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG5cdFx0Ly90aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdub3JtYWwnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggbm9ybWFscywgMyApICk7XG5cdFx0Ly90aGlzLmdlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3V2JywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHV2cywgMiApICk7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vdXNlZCBkdXJpbmcgdXBkYXRlcyBhcyBhIHBvaW50ZXIgdG8gdGhlIGJ1ZmZlclxuXG5cdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IGZhbHNlO1xuXG5cdH1cblx0X29uQWRkKCl7XG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIERvbWFpbiBub2RlIHdlJ3JlIHJlbmRlcmluZyBmcm9tXG4gICAgICAgIGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cdFxuXHRcdC8vdG9kbzogaW1wbGVtZW50IHNvbWV0aGluZyBsaWtlIGFzc2VydCByb290IHR5cGVvZiBSb290Tm9kZVxuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcblx0XHR0aGlzLl9vbkFkZCgpOyAvL3NldHVwIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLml0ZW1EaW1lbnNpb25zLiB1c2VkIGhlcmUgYWdhaW4gYmVjYXVzZSBjbG9uaW5nIG1lYW5zIHRoZSBvbkFkZCgpIG1pZ2h0IGJlIGNhbGxlZCBiZWZvcmUgdGhpcyBpcyBjb25uZWN0ZWQgdG8gYSB0eXBlIG9mIGRvbWFpblxuXG5cdFx0Ly8gcGVyaGFwcyBpbnN0ZWFkIG9mIGdlbmVyYXRpbmcgYSB3aG9sZSBuZXcgYXJyYXksIHRoaXMgY2FuIHJldXNlIHRoZSBvbGQgb25lP1xuXHRcdGxldCB2ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zICogMik7XG5cblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdHRoaXMuX3ZlcnRpY2VzID0gdmVydGljZXM7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdmVydGljZXMpO1xuXG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHRpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7XHRcblx0XHR9XG5cblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cblx0XHQvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuXHRcdGxldCBpbmRleCA9IHRoaXMuX2N1cnJlbnRQb2ludEluZGV4KnRoaXMuX291dHB1dERpbWVuc2lvbnM7XG5cblx0XHRpZih4ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXhdID0geDtcblx0XHRpZih5ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMV0gPSB5O1xuXHRcdGlmKHogIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXSA9IHo7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXG5cdFx0Lyogd2UncmUgZHJhd2luZyBsaWtlIHRoaXM6XG5cdFx0Ki0tLS0qLS0tLSpcblxuICAgICAgICAqLS0tLSotLS0tKlxuXHRcblx0XHRidXQgd2UgZG9uJ3Qgd2FudCB0byBpbnNlcnQgYSBkaWFnb25hbCBsaW5lIGFueXdoZXJlLiBUaGlzIGhhbmRsZXMgdGhhdDogICovXG5cblx0XHRsZXQgZmlyc3RDb29yZGluYXRlID0gaSAlIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG5cblx0XHRpZighKGZpcnN0Q29vcmRpbmF0ZSA9PSAwIHx8IGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpKXtcblx0XHRcdGlmKHggIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zXSA9IHg7XG5cdFx0XHRpZih5ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysxXSA9IHk7XG5cdFx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysyXSA9IHo7XG5cdFx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXHRcdH1cblxuXHRcdC8vdmVydGljZXMgc2hvdWxkIHJlYWxseSBiZSBhbiB1bmlmb3JtLCB0aG91Z2guXG5cdH1cblx0b25BZnRlckFjdGl2YXRpb24oKXtcblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vcmVzZXQgYWZ0ZXIgZWFjaCB1cGRhdGVcblx0fVxuICAgIHJlbW92ZVNlbGZGcm9tU2NlbmUoKXtcbiAgICAgICAgdGhyZWVFbnZpcm9ubWVudC5zY2VuZS5yZW1vdmUodGhpcy5tZXNoKTtcbiAgICB9XG5cdHNldCBjb2xvcihjb2xvcil7XG5cdFx0Ly9jdXJyZW50bHkgb25seSBhIHNpbmdsZSBjb2xvciBpcyBzdXBwb3J0ZWQuXG5cdFx0Ly9JIHNob3VsZCByZWFsbHkgbWFrZSBpdCBwb3NzaWJsZSB0byBzcGVjaWZ5IGNvbG9yIGJ5IGEgZnVuY3Rpb24uXG5cdFx0dGhpcy5tYXRlcmlhbC5jb2xvciA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG5cdFx0dGhpcy5fY29sb3IgPSBjb2xvcjtcblx0fVxuXHRnZXQgY29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3I7XG5cdH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0dGhpcy5tYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcblx0XHR0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG5cdFx0dGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRzZXQgd2lkdGgod2lkdGgpe1xuXHRcdHRoaXMuX3dpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5tYXRlcmlhbC5saW5ld2lkdGggPSB3aWR0aDtcblx0fVxuXHRnZXQgd2lkdGgoKXtcblx0XHRyZXR1cm4gdGhpcy5fd2lkdGg7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IExpbmVPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuZXhwb3J0IHtMaW5lT3V0cHV0fTtcbiIsImltcG9ydCB7IHRocmVlRW52aXJvbm1lbnQgfSBmcm9tICcuLi9UaHJlZUVudmlyb25tZW50LmpzJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUG9pbnR7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdC8qb3B0aW9uczogY29sb3I6IDxUSFJFRS5Db2xvciBvciBoZXggY29kZVxuXHRcdFx0eCx5OiBudW1iZXJzXG5cdFx0XHR3aWR0aDogbnVtYmVyXG5cdFx0Ki9cblxuXHRcdGxldCB3aWR0aCA9IG9wdGlvbnMud2lkdGggPT09IHVuZGVmaW5lZCA/IDEgOiBvcHRpb25zLndpZHRoXG5cdFx0bGV0IGNvbG9yID0gb3B0aW9ucy5jb2xvciA9PT0gdW5kZWZpbmVkID8gMHg3Nzc3NzcgOiBvcHRpb25zLmNvbG9yO1xuXG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLk1lc2godGhpcy5zaGFyZWRDaXJjbGVHZW9tZXRyeSx0aGlzLmdldEZyb21NYXRlcmlhbENhY2hlKGNvbG9yKSk7XG5cblx0XHR0aGlzLm9wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgPT09IHVuZGVmaW5lZCA/IDEgOiBvcHRpb25zLm9wYWNpdHk7IC8vdHJpZ2dlciBzZXR0ZXJcblxuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi5zZXQodGhpcy54LHRoaXMueSx0aGlzLnopO1xuXHRcdHRoaXMubWVzaC5zY2FsZS5zZXRTY2FsYXIodGhpcy53aWR0aC8yKTtcblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXG5cdFx0dGhpcy54ID0gb3B0aW9ucy54IHx8IDA7XG5cdFx0dGhpcy55ID0gb3B0aW9ucy55IHx8IDA7XG5cdFx0dGhpcy56ID0gb3B0aW9ucy56IHx8IDA7XG5cdH1cblx0cmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuXHRcdHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG5cdH1cblx0c2V0IHgoaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnggPSBpO1xuXHR9XG5cdHNldCB5KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi55ID0gaTtcblx0fVxuXHRzZXQgeihpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueiA9IGk7XG5cdH1cblx0Z2V0IHgoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLng7XG5cdH1cblx0Z2V0IHkoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLnk7XG5cdH1cblx0Z2V0IHooKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLno7XG5cdH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0bGV0IG1hdCA9IHRoaXMubWVzaC5tYXRlcmlhbDtcblx0XHRtYXQub3BhY2l0eSA9IG9wYWNpdHk7XG5cdFx0bWF0LnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG4gICAgICAgIG1hdC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRnZXRGcm9tTWF0ZXJpYWxDYWNoZShjb2xvcil7XG5cdFx0aWYodGhpcy5fbWF0ZXJpYWxzW2NvbG9yXSA9PT0gdW5kZWZpbmVkKXtcblx0XHRcdHRoaXMuX21hdGVyaWFsc1tjb2xvcl0gPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe2NvbG9yOiBjb2xvcn0pXG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tYXRlcmlhbHNbY29sb3JdXG5cdH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHR0aGlzLm1lc2gubWF0ZXJpYWwgPSB0aGlzLmdldEZyb21NYXRlcmlhbENhY2hlKGNvbG9yKTtcblx0fVxufVxuUG9pbnQucHJvdG90eXBlLnNoYXJlZENpcmNsZUdlb21ldHJ5ID0gbmV3IFRIUkVFLlNwaGVyZUdlb21ldHJ5KDEvMiwgOCwgNik7IC8vcmFkaXVzIDEvMiBtYWtlcyBkaWFtZXRlciAxLCBzbyB0aGF0IHNjYWxpbmcgYnkgbiBtZWFucyB3aWR0aD1uXG5cblBvaW50LnByb3RvdHlwZS5fbWF0ZXJpYWxzID0ge307XG4iLCJpbXBvcnQgUG9pbnQgZnJvbSAnLi9Qb2ludC5qcyc7XG5pbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuXG5jbGFzcyBQb2ludE91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKlxuXHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0Y29sb3I6IGhleCBjb2xvciwgYXMgaW4gMHhycmdnYmIuIFRlY2huaWNhbGx5LCB0aGlzIGlzIGEgSlMgaW50ZWdlci5cblx0XHRcdG9wYWNpdHk6IDAtMS4gT3B0aW9uYWwuXG5cdFx0Ki9cblxuXHRcdHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDE7XG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmNvbG9yIDogMHg1NWFhNTU7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcblxuXG5cdFx0dGhpcy5wb2ludHMgPSBbXTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuXHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblx0fVxuXHRfb25BZGQoKXsgLy9zaG91bGQgYmUgY2FsbGVkIHdoZW4gdGhpcyBpcyAuYWRkKCllZCB0byBzb21ldGhpbmdcblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgQXJlYVxuXHRcdGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pe1xuXHRcdFx0Zm9yKHZhciBpPXRoaXMucG9pbnRzLmxlbmd0aDtpPHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO2krKyl7XG5cdFx0XHRcdHRoaXMucG9pbnRzLnB1c2gobmV3IFBvaW50KHt3aWR0aDogMSxjb2xvcjp0aGlzLl9jb2xvciwgb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSkpO1xuXHRcdFx0XHR0aGlzLnBvaW50c1tpXS5tZXNoLnNjYWxlLnNldFNjYWxhcih0aGlzLl93aWR0aCk7IC8vc2V0IHdpZHRoIGJ5IHNjYWxpbmcgcG9pbnRcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pdGhpcy5fb25BZGQoKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblx0XHR2YXIgcG9pbnQgPSB0aGlzLmdldFBvaW50KGkpO1xuXHRcdGlmKHggIT09IHVuZGVmaW5lZClwb2ludC54ID0geDtcblx0XHRpZih5ICE9PSB1bmRlZmluZWQpcG9pbnQueSA9IHk7XG5cdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXBvaW50LnogPSB6O1xuXHR9XG5cdGdldFBvaW50KGkpe1xuXHRcdHJldHVybiB0aGlzLnBvaW50c1tpXTtcblx0fVxuICAgIHJlbW92ZVNlbGZGcm9tU2NlbmUoKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMucG9pbnRzLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5wb2ludHNbaV0ucmVtb3ZlU2VsZkZyb21TY2VuZSgpO1xuXHRcdH1cbiAgICB9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdC8vdGVjaG5pY2FsbHkgdGhpcyB3aWxsIHNldCBhbGwgcG9pbnRzIG9mIHRoZSBzYW1lIGNvbG9yLCBhbmQgaXQnbGwgYmUgd2lwZWQgd2l0aCBhIGNvbG9yIGNoYW5nZS4gQnV0IEknbGwgZGVhbCB3aXRoIHRoYXQgc29tZXRpbWUgbGF0ZXIuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbjtpKyspe1xuXHRcdFx0bGV0IG1hdCA9IHRoaXMuZ2V0UG9pbnQoaSkubWVzaC5tYXRlcmlhbDtcblx0XHRcdG1hdC5vcGFjaXR5ID0gb3BhY2l0eTsgLy9pbnN0YW50aWF0ZSB0aGUgcG9pbnRcblx0XHRcdG1hdC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuICAgICAgICAgICAgbWF0LnZpc2libGUgPSBvcGFjaXR5ID4gMDtcblx0XHR9XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRzZXQgY29sb3IoY29sb3Ipe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5wb2ludHMubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmdldFBvaW50KGkpLmNvbG9yID0gY29sb3I7XG5cdFx0fVxuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdH1cblx0Z2V0IGNvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbG9yO1xuXHR9XG5cdHNldCB3aWR0aCh3aWR0aCl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnBvaW50cy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuZ2V0UG9pbnQoaSkubWVzaC5zY2FsZS5zZXRTY2FsYXIod2lkdGgpO1xuXHRcdH1cblx0XHR0aGlzLl93aWR0aCA9IHdpZHRoO1xuXHR9XG5cdGdldCB3aWR0aCgpe1xuXHRcdHJldHVybiB0aGlzLl93aWR0aDtcblx0fVxuXHRjbG9uZSgpe1xuXHRcdHJldHVybiBuZXcgUG9pbnRPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RQb2ludCgpe1xuXHR2YXIgeCA9IG5ldyBFWFAuQXJlYSh7Ym91bmRzOiBbWy0xMCwxMF1dfSk7XG5cdHZhciB5ID0gbmV3IEVYUC5UcmFuc2Zvcm1hdGlvbih7J2V4cHInOiAoeCkgPT4geCp4fSk7XG5cdHZhciB5ID0gbmV3IEVYUC5Qb2ludE91dHB1dCgpO1xuXHR4LmFkZCh5KTtcblx0eS5hZGQoeik7XG5cdHguYWN0aXZhdGUoKTtcbn1cblxuZXhwb3J0IHtQb2ludE91dHB1dH1cbiIsImltcG9ydCB7IExpbmVPdXRwdXQgfSBmcm9tICcuL0xpbmVPdXRwdXQuanMnO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuLi91dGlscy5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBWZWN0b3JPdXRwdXQgZXh0ZW5kcyBMaW5lT3V0cHV0e1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdC8qaW5wdXQ6IFRyYW5zZm9ybWF0aW9uXG5cdFx0XHR3aWR0aDogbnVtYmVyXG5cdFx0Ki9cblx0XHRzdXBlcihvcHRpb25zKTtcblxuXHR9XG5cdGluaXQoKXtcblx0XHR0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXHRcdHRoaXMuX3ZlcnRpY2VzO1xuXHRcdHRoaXMuYXJyb3doZWFkcyA9IFtdO1xuXG5cblx0XHR0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtjb2xvcjogdGhpcy5fY29sb3IsIGxpbmV3aWR0aDogdGhpcy5fd2lkdGgsIG9wYWNpdHk6dGhpcy5fb3BhY2l0eX0pO1xuXHRcdHRoaXMubGluZU1lc2ggPSBuZXcgVEhSRUUuTGluZVNlZ21lbnRzKHRoaXMuX2dlb21ldHJ5LHRoaXMubWF0ZXJpYWwpO1xuXG5cdFx0dGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy8gc2V0dGVyIHNldHMgdHJhbnNwYXJlbnQgZmxhZyBpZiBuZWNlc3NhcnlcblxuXG5cdFx0Y29uc3QgY2lyY2xlUmVzb2x1dGlvbiA9IDEyO1xuXHRcdGNvbnN0IGFycm93aGVhZFNpemUgPSAwLjM7XG5cdFx0Y29uc3QgRVBTSUxPTiA9IDAuMDAwMDE7XG5cdFx0dGhpcy5FUFNJTE9OID0gRVBTSUxPTjtcblxuXHRcdHRoaXMuY29uZUdlb21ldHJ5ID0gbmV3IFRIUkVFLkN5bGluZGVyQnVmZmVyR2VvbWV0cnkoIDAsIGFycm93aGVhZFNpemUsIGFycm93aGVhZFNpemUqMS43LCBjaXJjbGVSZXNvbHV0aW9uLCAxICk7XG5cdFx0bGV0IGFycm93aGVhZE92ZXJzaG9vdEZhY3RvciA9IDAuMTsgLy91c2VkIHNvIHRoYXQgdGhlIGxpbmUgd29uJ3QgcnVkZWx5IGNsaXAgdGhyb3VnaCB0aGUgcG9pbnQgb2YgdGhlIGFycm93aGVhZFxuXG5cdFx0dGhpcy5jb25lR2VvbWV0cnkudHJhbnNsYXRlKCAwLCAtIGFycm93aGVhZFNpemUgKyBhcnJvd2hlYWRPdmVyc2hvb3RGYWN0b3IsIDAgKTtcblxuXHRcdHRoaXMuX2NvbmVVcERpcmVjdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsMSwwKTtcblxuXHRcdHRoaXMubWFrZUdlb21ldHJ5KCk7XG5cblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLmFkZCh0aGlzLmxpbmVNZXNoKTtcblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcblx0XHRzdXBlci5fb25GaXJzdEFjdGl2YXRpb24oKTtcblxuXHRcdGlmKHRoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoID4gMSl7XG5cdFx0XHR0aGlzLm51bUFycm93aGVhZHMgPSB0aGlzLml0ZW1EaW1lbnNpb25zLnNsaWNlKDAsdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMSkucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cnJlbnQpe1xuXHRcdFx0XHRyZXR1cm4gY3VycmVudCArIHByZXY7XG5cdFx0XHR9KTtcblx0XHR9ZWxzZXtcblx0XHRcdC8vYXNzdW1lZCBpdGVtRGltZW5zaW9ucyBpc24ndCBhIG5vbnplcm8gYXJyYXkuIFRoYXQgc2hvdWxkIGJlIHRoZSBjb25zdHJ1Y3RvcidzIHByb2JsZW0uXG5cdFx0XHR0aGlzLm51bUFycm93aGVhZHMgPSAxO1xuXHRcdH1cblxuXHRcdC8vcmVtb3ZlIGFueSBwcmV2aW91cyBhcnJvd2hlYWRzXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmFycm93aGVhZHMubGVuZ3RoO2krKyl7XG5cdFx0XHRsZXQgYXJyb3cgPSB0aGlzLmFycm93aGVhZHNbaV07XG5cdFx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZShhcnJvdyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5hcnJvd2hlYWRzID0gbmV3IEFycmF5KHRoaXMubnVtQXJyb3doZWFkcyk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bUFycm93aGVhZHM7aSsrKXtcblx0XHRcdHRoaXMuYXJyb3doZWFkc1tpXSA9IG5ldyBUSFJFRS5NZXNoKHRoaXMuY29uZUdlb21ldHJ5LCB0aGlzLm1hdGVyaWFsKTtcblx0XHRcdHRocmVlRW52aXJvbm1lbnQuc2NlbmUuYWRkKHRoaXMuYXJyb3doZWFkc1tpXSk7XG5cdFx0fVxuXHRcdGNvbnNvbGUubG9nKFwibnVtYmVyIG9mIGFycm93aGVhZHMgKD0gbnVtYmVyIG9mIGxpbmVzKTpcIisgdGhpcy5udW1BcnJvd2hlYWRzKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0Ly9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuXHRcdGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcblx0XHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTtcdFxuXHRcdH1cblxuXHRcdC8vYXNzZXJ0IGkgPCB2ZXJ0aWNlcy5jb3VudFxuXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5fY3VycmVudFBvaW50SW5kZXgqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcblxuXHRcdGlmKHggIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleF0gPSB4O1xuXHRcdGlmKHkgIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCsxXSA9IHk7XG5cdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4KzJdID0gejtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4Kys7XG5cblx0XHQvKiB3ZSdyZSBkcmF3aW5nIGxpa2UgdGhpczpcblx0XHQqLS0tLSotLS0tKlxuXG4gICAgICAgICotLS0tKi0tLS0qXG5cdFxuXHRcdGJ1dCB3ZSBkb24ndCB3YW50IHRvIGluc2VydCBhIGRpYWdvbmFsIGxpbmUgYW55d2hlcmUuIFRoaXMgaGFuZGxlcyB0aGF0OiAgKi9cblxuXHRcdGxldCBmaXJzdENvb3JkaW5hdGUgPSBpICUgdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXTtcblxuXHRcdC8vdmVydGljZXMgc2hvdWxkIHJlYWxseSBiZSBhbiB1bmlmb3JtLCB0aG91Z2guXG5cdFx0aWYoIShmaXJzdENvb3JkaW5hdGUgPT0gMCB8fCBmaXJzdENvb3JkaW5hdGUgPT0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xKSl7XG5cdFx0XHRpZih4ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9uc10gPSB4O1xuXHRcdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMrMV0gPSB5O1xuXHRcdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMrMl0gPSB6O1xuXHRcdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblx0XHR9XG5cblx0XHRpZihmaXJzdENvb3JkaW5hdGUgPT0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xKXtcblxuXHRcdFx0Ly9jYWxjdWxhdGUgZGlyZWN0aW9uIG9mIGxhc3QgbGluZSBzZWdtZW50XG5cdFx0XHRsZXQgZHggPSB0aGlzLl92ZXJ0aWNlc1tpbmRleC10aGlzLl9vdXRwdXREaW1lbnNpb25zXSAtIHRoaXMuX3ZlcnRpY2VzW2luZGV4XVxuXHRcdFx0bGV0IGR5ID0gdGhpcy5fdmVydGljZXNbaW5kZXgtdGhpcy5fb3V0cHV0RGltZW5zaW9ucysxXSAtIHRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdXG5cdFx0XHRsZXQgZHogPSB0aGlzLl92ZXJ0aWNlc1tpbmRleC10aGlzLl9vdXRwdXREaW1lbnNpb25zKzJdIC0gdGhpcy5fdmVydGljZXNbaW5kZXgrMl1cblxuXHRcdFx0bGV0IGxpbmVOdW1iZXIgPSBNYXRoLmZsb29yKGkgLyB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdKTtcblx0XHRcdFV0aWxzLmFzc2VydChsaW5lTnVtYmVyIDw9IHRoaXMubnVtQXJyb3doZWFkcyk7IC8vdGhpcyBtYXkgYmUgd3JvbmdcblxuXHRcdFx0bGV0IGRpcmVjdGlvblZlY3RvciA9IG5ldyBUSFJFRS5WZWN0b3IzKC1keCwtZHksLWR6KVxuXG5cdFx0XHQvL01ha2UgYXJyb3dzIGRpc2FwcGVhciBpZiB0aGUgbGluZSBpcyBzbWFsbCBlbm91Z2hcblx0XHRcdC8vT25lIHdheSB0byBkbyB0aGlzIHdvdWxkIGJlIHRvIHN1bSB0aGUgZGlzdGFuY2VzIG9mIGFsbCBsaW5lIHNlZ21lbnRzLiBJJ20gY2hlYXRpbmcgaGVyZSBhbmQganVzdCBtZWFzdXJpbmcgdGhlIGRpc3RhbmNlIG9mIHRoZSBsYXN0IHZlY3RvciwgdGhlbiBtdWx0aXBseWluZyBieSB0aGUgbnVtYmVyIG9mIGxpbmUgc2VnbWVudHMgKG5haXZlbHkgYXNzdW1pbmcgYWxsIGxpbmUgc2VnbWVudHMgYXJlIHRoZSBzYW1lIGxlbmd0aClcblx0XHRcdGxldCBsZW5ndGggPSBkaXJlY3Rpb25WZWN0b3IubGVuZ3RoKCkgKiAodGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xKVxuXG5cdFx0XHRjb25zdCBlZmZlY3RpdmVEaXN0YW5jZSA9IDM7XG5cblx0XHRcdGxldCBjbGFtcGVkTGVuZ3RoID0gTWF0aC5tYXgoMCwgTWF0aC5taW4obGVuZ3RoL2VmZmVjdGl2ZURpc3RhbmNlLCAxKSkvMVxuXG5cdFx0XHQvL3NocmluayBmdW5jdGlvbiBkZXNpZ25lZCB0byBoYXZlIGEgc3RlZXAgc2xvcGUgY2xvc2UgdG8gMCBidXQgbWVsbG93IG91dCBhdCAwLjUgb3Igc28gaW4gb3JkZXIgdG8gYXZvaWQgdGhlIGxpbmUgd2lkdGggb3ZlcmNvbWluZyB0aGUgYXJyb3doZWFkIHdpZHRoXG5cdFx0XHQvL0luIENocm9tZSwgdGhyZWUuanMgY29tcGxhaW5zIHdoZW5ldmVyIHNvbWV0aGluZyBpcyBzZXQgdG8gMCBzY2FsZS4gQWRkaW5nIGFuIGVwc2lsb24gdGVybSBpcyB1bmZvcnR1bmF0ZSBidXQgbmVjZXNzYXJ5IHRvIGF2b2lkIGNvbnNvbGUgc3BhbS5cblx0XHRcdFxuXHRcdFx0dGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnNjYWxlLnNldFNjYWxhcihNYXRoLmFjb3MoMS0yKmNsYW1wZWRMZW5ndGgpL01hdGguUEkgKyB0aGlzLkVQU0lMT04pO1xuXHRcdFx0XG4gXHRcdFx0Ly9wb3NpdGlvbi9yb3RhdGlvbiBjb21lcyBhZnRlciBzaW5jZSAubm9ybWFsaXplKCkgbW9kaWZpZXMgZGlyZWN0aW9uVmVjdG9yIGluIHBsYWNlXG5cdFx0XG5cdFx0XHRsZXQgcG9zID0gdGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnBvc2l0aW9uO1xuXG5cdFx0XHRpZih4ICE9PSB1bmRlZmluZWQpcG9zLnggPSB4O1xuXHRcdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXBvcy55ID0geTtcblx0XHRcdGlmKHogIT09IHVuZGVmaW5lZClwb3MueiA9IHo7XG5cblx0XHRcdGlmKGxlbmd0aCA+IDApeyAvL2RpcmVjdGlvblZlY3Rvci5ub3JtYWxpemUoKSBmYWlscyB3aXRoIDAgbGVuZ3RoXG5cdFx0XHRcdHRoaXMuYXJyb3doZWFkc1tsaW5lTnVtYmVyXS5xdWF0ZXJuaW9uLnNldEZyb21Vbml0VmVjdG9ycyh0aGlzLl9jb25lVXBEaXJlY3Rpb24sIGRpcmVjdGlvblZlY3Rvci5ub3JtYWxpemUoKSApO1xuXHRcdFx0fVxuXG5cdFx0fVxuXHR9XG4gICAgcmVtb3ZlU2VsZkZyb21TY2VuZSgpe1xuICAgICAgICB0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLm1lc2gpO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1BcnJvd2hlYWRzO2krKyl7XG5cdFx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLnJlbW92ZSh0aGlzLmFycm93aGVhZHNbaV0pO1xuXHRcdH1cbiAgICB9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBWZWN0b3JPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuXG4iLCIvL1N1cmZhY2VPdXRwdXRTaGFkZXJzLmpzXG5cbi8vZXhwZXJpbWVudDogc2hhZGVycyB0byBnZXQgdGhlIHRyaWFuZ2xlIHB1bHNhdGluZyFcbnZhciB2U2hhZGVyID0gW1xuXCJ2YXJ5aW5nIHZlYzMgdk5vcm1hbDtcIixcblwidmFyeWluZyB2ZWMzIHZQb3NpdGlvbjtcIixcblwidmFyeWluZyB2ZWMyIHZVdjtcIixcblwidW5pZm9ybSBmbG9hdCB0aW1lO1wiLFxuXCJ1bmlmb3JtIHZlYzMgY29sb3I7XCIsXG5cInVuaWZvcm0gdmVjMyB2TGlnaHQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgZ3JpZFNxdWFyZXM7XCIsXG5cblwidm9pZCBtYWluKCkge1wiLFxuXHRcInZQb3NpdGlvbiA9IHBvc2l0aW9uLnh5ejtcIixcblx0XCJ2Tm9ybWFsID0gbm9ybWFsLnh5ejtcIixcblx0XCJ2VXYgPSB1di54eTtcIixcblx0XCJnbF9Qb3NpdGlvbiA9IHByb2plY3Rpb25NYXRyaXggKlwiLFxuICAgICAgICAgICAgXCJtb2RlbFZpZXdNYXRyaXggKlwiLFxuICAgICAgICAgICAgXCJ2ZWM0KHBvc2l0aW9uLDEuMCk7XCIsXG5cIn1cIl0uam9pbihcIlxcblwiKVxuXG52YXIgZlNoYWRlciA9IFtcblwidmFyeWluZyB2ZWMzIHZOb3JtYWw7XCIsXG5cInZhcnlpbmcgdmVjMyB2UG9zaXRpb247XCIsXG5cInZhcnlpbmcgdmVjMiB2VXY7XCIsXG5cInVuaWZvcm0gZmxvYXQgdGltZTtcIixcblwidW5pZm9ybSB2ZWMzIGNvbG9yO1wiLFxuXCJ1bmlmb3JtIHZlYzMgdkxpZ2h0O1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGdyaWRTcXVhcmVzO1wiLFxuXCJ1bmlmb3JtIGZsb2F0IGxpbmVXaWR0aDtcIixcblwidW5pZm9ybSBmbG9hdCBzaG93R3JpZDtcIixcblwidW5pZm9ybSBmbG9hdCBzaG93U29saWQ7XCIsXG5cInVuaWZvcm0gZmxvYXQgb3BhY2l0eTtcIixcblxuXHQvL3RoZSBmb2xsb3dpbmcgY29kZSBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS91bmNvbmVkL21hdGhib3gvYmxvYi9lYWViOGUxNWVmMmQwMjUyNzQwYTc0NTA1YTEyZDdhMTA1MWE2MWI2L3NyYy9zaGFkZXJzL2dsc2wvbWVzaC5mcmFnbWVudC5zaGFkZWQuZ2xzbFxuXCJ2ZWMzIG9mZlNwZWN1bGFyKHZlYzMgY29sb3IpIHtcIixcblwiICB2ZWMzIGMgPSAxLjAgLSBjb2xvcjtcIixcblwiICByZXR1cm4gMS4wIC0gYyAqIGM7XCIsXG5cIn1cIixcblxuXCJ2ZWM0IGdldFNoYWRlZENvbG9yKHZlYzQgcmdiYSkgeyBcIixcblwiICB2ZWMzIGNvbG9yID0gcmdiYS54eXo7XCIsXG5cIiAgdmVjMyBjb2xvcjIgPSBvZmZTcGVjdWxhcihyZ2JhLnh5eik7XCIsXG5cblwiICB2ZWMzIG5vcm1hbCA9IG5vcm1hbGl6ZSh2Tm9ybWFsKTtcIixcblwiICB2ZWMzIGxpZ2h0ID0gbm9ybWFsaXplKHZMaWdodCk7XCIsXG5cIiAgdmVjMyBwb3NpdGlvbiA9IG5vcm1hbGl6ZSh2UG9zaXRpb24pO1wiLFxuXG5cIiAgZmxvYXQgc2lkZSAgICA9IGdsX0Zyb250RmFjaW5nID8gLTEuMCA6IDEuMDtcIixcblwiICBmbG9hdCBjb3NpbmUgID0gc2lkZSAqIGRvdChub3JtYWwsIGxpZ2h0KTtcIixcblwiICBmbG9hdCBkaWZmdXNlID0gbWl4KG1heCgwLjAsIGNvc2luZSksIC41ICsgLjUgKiBjb3NpbmUsIC4xKTtcIixcblxuXCIgIGZsb2F0IHJpbUxpZ2h0aW5nID0gbWF4KG1pbigxLjAgLSBzaWRlKmRvdChub3JtYWwsIGxpZ2h0KSwgMS4wKSwwLjApO1wiLFxuXG5cIlx0ZmxvYXQgc3BlY3VsYXIgPSBtYXgoMC4wLCBhYnMoY29zaW5lKSAtIDAuNSk7XCIsIC8vZG91YmxlIHNpZGVkIHNwZWN1bGFyXG5cIiAgIHJldHVybiB2ZWM0KGRpZmZ1c2UqY29sb3IgKyAwLjkqcmltTGlnaHRpbmcqY29sb3IgKyAwLjQqY29sb3IyICogc3BlY3VsYXIsIHJnYmEuYSk7XCIsXG5cIn1cIixcblxuLy8gU21vb3RoIEhTViB0byBSR0IgY29udmVyc2lvbiBmcm9tIGh0dHBzOi8vd3d3LnNoYWRlcnRveS5jb20vdmlldy9Nc1MzV2NcblwidmVjMyBoc3YycmdiX3Ntb290aCggaW4gdmVjMyBjICl7XCIsXG5cIiAgICB2ZWMzIHJnYiA9IGNsYW1wKCBhYnMobW9kKGMueCo2LjArdmVjMygwLjAsNC4wLDIuMCksNi4wKS0zLjApLTEuMCwgMC4wLCAxLjAgKTtcIixcblwiXHRyZ2IgPSByZ2IqcmdiKigzLjAtMi4wKnJnYik7IC8vIGN1YmljIHNtb290aGluZ1x0XCIsXG5cIlx0cmV0dXJuIGMueiAqIG1peCggdmVjMygxLjApLCByZ2IsIGMueSk7XCIsXG5cIn1cIixcblxuLy9Gcm9tIFNhbSBIb2NldmFyOiBodHRwOi8vbG9sZW5naW5lLm5ldC9ibG9nLzIwMTMvMDcvMjcvcmdiLXRvLWhzdi1pbi1nbHNsXG5cInZlYzMgcmdiMmhzdih2ZWMzIGMpe1wiLFxuXCIgICAgdmVjNCBLID0gdmVjNCgwLjAsIC0xLjAgLyAzLjAsIDIuMCAvIDMuMCwgLTEuMCk7XCIsXG5cIiAgICB2ZWM0IHAgPSBtaXgodmVjNChjLmJnLCBLLnd6KSwgdmVjNChjLmdiLCBLLnh5KSwgc3RlcChjLmIsIGMuZykpO1wiLFxuXCIgICAgdmVjNCBxID0gbWl4KHZlYzQocC54eXcsIGMuciksIHZlYzQoYy5yLCBwLnl6eCksIHN0ZXAocC54LCBjLnIpKTtcIixcblxuXCIgICAgZmxvYXQgZCA9IHEueCAtIG1pbihxLncsIHEueSk7XCIsXG5cIiAgICBmbG9hdCBlID0gMS4wZS0xMDtcIixcblwiICAgIHJldHVybiB2ZWMzKGFicyhxLnogKyAocS53IC0gcS55KSAvICg2LjAgKiBkICsgZSkpLCBkIC8gKHEueCArIGUpLCBxLngpO1wiLFxuXCJ9XCIsXG4gLy9jaG9vc2VzIHRoZSBjb2xvciBmb3IgdGhlIGdyaWRsaW5lcyBieSB2YXJ5aW5nIGxpZ2h0bmVzcy4gXG4vL05PVCBjb250aW51b3VzIG9yIGVsc2UgYnkgdGhlIGludGVybWVkaWF0ZSBmdW5jdGlvbiB0aGVvcmVtIHRoZXJlJ2QgYmUgYSBwb2ludCB3aGVyZSB0aGUgZ3JpZGxpbmVzIHdlcmUgdGhlIHNhbWUgY29sb3IgYXMgdGhlIG1hdGVyaWFsLlxuXCJ2ZWMzIGdyaWRMaW5lQ29sb3IodmVjMyBjb2xvcil7XCIsXG5cIiB2ZWMzIGhzdiA9IHJnYjJoc3YoY29sb3IueHl6KTtcIixcblwiIC8vaHN2LnggKz0gMC4xO1wiLFxuXCIgaWYoaHN2LnogPCAwLjgpe2hzdi56ICs9IDAuMjt9ZWxzZXtoc3YueiA9IDAuODUtMC4xKmhzdi56O2hzdi55IC09IDAuMDt9XCIsXG5cIiByZXR1cm4gaHN2MnJnYl9zbW9vdGgoaHN2KTtcIixcblwifVwiLFxuXG5cInZlYzQgcmVuZGVyR3JpZGxpbmVzKHZlYzQgbWFpbkNvbG9yLCB2ZWMyIHV2LCB2ZWM0IGNvbG9yKSB7XCIsXG5cIiAgdmVjMiBkaXN0VG9FZGdlID0gYWJzKG1vZCh2VXYueHkqZ3JpZFNxdWFyZXMgKyBsaW5lV2lkdGgvMi4wLDEuMCkpO1wiLFxuXCIgIHZlYzMgZ3JpZENvbG9yID0gZ3JpZExpbmVDb2xvcihjb2xvci54eXopO1wiLFxuXG5cIiAgaWYoIGRpc3RUb0VkZ2UueCA8IGxpbmVXaWR0aCl7XCIsXG5cIiAgICByZXR1cm4gc2hvd0dyaWQqdmVjNChncmlkQ29sb3IsIGNvbG9yLmEpICsgKDEuLXNob3dHcmlkKSptYWluQ29sb3I7XCIsXG5cIiAgfSBlbHNlIGlmKGRpc3RUb0VkZ2UueSA8IGxpbmVXaWR0aCl7IFwiLFxuXCIgICAgcmV0dXJuIHNob3dHcmlkKnZlYzQoZ3JpZENvbG9yLCBjb2xvci5hKSArICgxLi1zaG93R3JpZCkqbWFpbkNvbG9yO1wiLFxuXCIgIH1cIixcblwiICByZXR1cm4gbWFpbkNvbG9yO1wiLFxuXCJ9XCIsXG4vKlxuXCJ2ZWM0IGdldFNoYWRlZENvbG9yTWF0aGJveCh2ZWM0IHJnYmEpIHsgXCIsXG5cIiAgdmVjMyBjb2xvciA9IHJnYmEueHl6O1wiLFxuXCIgIHZlYzMgY29sb3IyID0gb2ZmU3BlY3VsYXIocmdiYS54eXopO1wiLFxuXG5cIiAgdmVjMyBub3JtYWwgPSBub3JtYWxpemUodk5vcm1hbCk7XCIsXG5cIiAgdmVjMyBsaWdodCA9IG5vcm1hbGl6ZSh2TGlnaHQpO1wiLFxuXCIgIHZlYzMgcG9zaXRpb24gPSBub3JtYWxpemUodlBvc2l0aW9uKTtcIixcblwiICBmbG9hdCBzaWRlICAgID0gZ2xfRnJvbnRGYWNpbmcgPyAtMS4wIDogMS4wO1wiLFxuXCIgIGZsb2F0IGNvc2luZSAgPSBzaWRlICogZG90KG5vcm1hbCwgbGlnaHQpO1wiLFxuXCIgIGZsb2F0IGRpZmZ1c2UgPSBtaXgobWF4KDAuMCwgY29zaW5lKSwgLjUgKyAuNSAqIGNvc2luZSwgLjEpO1wiLFxuXCIgICB2ZWMzICBoYWxmTGlnaHQgPSBub3JtYWxpemUobGlnaHQgKyBwb3NpdGlvbik7XCIsXG5cIlx0ZmxvYXQgY29zaW5lSGFsZiA9IG1heCgwLjAsIHNpZGUgKiBkb3Qobm9ybWFsLCBoYWxmTGlnaHQpKTtcIixcblwiXHRmbG9hdCBzcGVjdWxhciA9IHBvdyhjb3NpbmVIYWxmLCAxNi4wKTtcIixcblwiXHRyZXR1cm4gdmVjNChjb2xvciAqIChkaWZmdXNlICogLjkgKyAuMDUpICowLjAgKyAgLjI1ICogY29sb3IyICogc3BlY3VsYXIsIHJnYmEuYSk7XCIsXG5cIn1cIiwqL1xuXG5cInZvaWQgbWFpbigpe1wiLFxuLy9cIiAgLy9nbF9GcmFnQ29sb3IgPSB2ZWM0KHZOb3JtYWwueHl6LCAxLjApOyAvLyB2aWV3IGRlYnVnIG5vcm1hbHNcIixcbi8vXCIgIC8vaWYodk5vcm1hbC54IDwgMC4wKXtnbF9GcmFnQ29sb3IgPSB2ZWM0KG9mZlNwZWN1bGFyKGNvbG9yLnJnYiksIDEuMCk7fWVsc2V7Z2xfRnJhZ0NvbG9yID0gdmVjNCgoY29sb3IucmdiKSwgMS4wKTt9XCIsIC8vdmlldyBzcGVjdWxhciBhbmQgbm9uLXNwZWN1bGFyIGNvbG9yc1xuLy9cIiAgZ2xfRnJhZ0NvbG9yID0gdmVjNChtb2QodlV2Lnh5LDEuMCksMC4wLDEuMCk7IC8vc2hvdyB1dnNcblwiICB2ZWM0IG1hdGVyaWFsQ29sb3IgPSBzaG93U29saWQqZ2V0U2hhZGVkQ29sb3IodmVjNChjb2xvci5yZ2IsIG9wYWNpdHkpKTtcIixcblwiICB2ZWM0IGNvbG9yV2l0aEdyaWRsaW5lcyA9IHJlbmRlckdyaWRsaW5lcyhtYXRlcmlhbENvbG9yLCB2VXYueHksIHZlYzQoY29sb3IucmdiLCBvcGFjaXR5KSk7XCIsXG5cIiAgZ2xfRnJhZ0NvbG9yID0gY29sb3JXaXRoR3JpZGxpbmVzO1wiLFx0XG5cIn1cIl0uam9pbihcIlxcblwiKVxuXG52YXIgdW5pZm9ybXMgPSB7XG5cdHRpbWU6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDAsXG5cdH0sXG5cdGNvbG9yOiB7XG5cdFx0dHlwZTogJ2MnLFxuXHRcdHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMHg1NWFhNTUpLFxuXHR9LFxuXHRvcGFjaXR5OiB7XG5cdFx0dHlwZTogJ2YnLFxuXHRcdHZhbHVlOiAwLjEsXG5cdH0sXG5cdHZMaWdodDogeyAvL2xpZ2h0IGRpcmVjdGlvblxuXHRcdHR5cGU6ICd2ZWMzJyxcblx0XHR2YWx1ZTogWzAsMCwxXSxcblx0fSxcblx0Z3JpZFNxdWFyZXM6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDQsXG5cdH0sXG5cdGxpbmVXaWR0aDoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMC4xLFxuXHR9LFxuXHRzaG93R3JpZDoge1xuXHRcdHR5cGU6ICdmJyxcblx0XHR2YWx1ZTogMS4wLFxuXHR9LFxuXHRzaG93U29saWQ6IHtcblx0XHR0eXBlOiAnZicsXG5cdFx0dmFsdWU6IDEuMCxcblx0fVxufTtcblxuZXhwb3J0IHsgdlNoYWRlciwgZlNoYWRlciwgdW5pZm9ybXMgfTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQge0xpbmVPdXRwdXR9IGZyb20gJy4vTGluZU91dHB1dC5qcyc7XG5pbXBvcnQgeyB0aHJlZUVudmlyb25tZW50IH0gZnJvbSAnLi4vVGhyZWVFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyB2U2hhZGVyLCBmU2hhZGVyLCB1bmlmb3JtcyB9IGZyb20gJy4vU3VyZmFjZU91dHB1dFNoYWRlcnMuanMnO1xuXG5jbGFzcyBTdXJmYWNlT3V0cHV0IGV4dGVuZHMgT3V0cHV0Tm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KXtcblx0XHRzdXBlcigpO1xuXHRcdC8qIHNob3VsZCBiZSAuYWRkKCllZCB0byBhIFRyYW5zZm9ybWF0aW9uIHRvIHdvcmtcblx0XHRcdG9wdGlvbnM6XG5cdFx0XHR7XG5cdFx0XHRcdG9wYWNpdHk6IG51bWJlclxuXHRcdFx0XHRjb2xvcjogaGV4IGNvZGUgb3IgVEhSRUUuQ29sb3IoKVxuXHRcdFx0XHRzaG93R3JpZDogYm9vbGVhbi4gSWYgdHJ1ZSwgd2lsbCBkaXNwbGF5IGEgZ3JpZCBvdmVyIHRoZSBzdXJmYWNlLiBEZWZhdWx0OiB0cnVlXG5cdFx0XHRcdHNob3dTb2xpZDogYm9vbGVhbi4gSWYgdHJ1ZSwgd2lsbCBkaXNwbGF5IGEgc29saWQgc3VyZmFjZS4gRGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHRncmlkU3F1YXJlczogbnVtYmVyIHJlcHJlc2VudGluZyBob3cgbWFueSBzcXVhcmVzIHBlciBkaW1lbnNpb24gdG8gdXNlIGluIGEgcmVuZGVyZWQgZ3JpZFxuXHRcdFx0XHRncmlkTGluZVdpZHRoOiBudW1iZXIgcmVwcmVzZW50aW5nIGhvdyBtYW55IHNxdWFyZXMgcGVyIGRpbWVuc2lvbiB0byB1c2UgaW4gYSByZW5kZXJlZCBncmlkXG5cdFx0XHR9XG5cdFx0Ki9cblx0XHR0aGlzLl9vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm9wYWNpdHkgOiAxO1xuXHRcdHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5jb2xvciA6IDB4NTVhYTU1O1xuXG5cdFx0dGhpcy5fZ3JpZFNxdWFyZXMgPSBvcHRpb25zLmdyaWRTcXVhcmVzICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmdyaWRTcXVhcmVzIDogMTY7XG5cdFx0dGhpcy5fc2hvd0dyaWQgPSBvcHRpb25zLnNob3dHcmlkICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLnNob3dHcmlkIDogdHJ1ZTtcblx0XHR0aGlzLl9zaG93U29saWQgPSBvcHRpb25zLnNob3dTb2xpZCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5zaG93U29saWQgOiB0cnVlO1xuXHRcdHRoaXMuX2dyaWRMaW5lV2lkdGggPSBvcHRpb25zLmdyaWRMaW5lV2lkdGggIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuZ3JpZExpbmVXaWR0aCA6IDAuMTU7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IDA7IC8vc2hvdWxkIGFsd2F5cyBiZSBlcXVhbCB0byB0aGlzLnZlcnRpY2VzLmxlbmd0aFxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbXTsgLy8gaG93IG1hbnkgdGltZXMgdG8gYmUgY2FsbGVkIGluIGVhY2ggZGlyZWN0aW9uXG5cdFx0dGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDM7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/XG5cblx0XHR0aGlzLmluaXQoKTtcblx0fVxuXHRpbml0KCl7XG5cdFx0dGhpcy5fZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcblx0XHR0aGlzLl92ZXJ0aWNlcztcblx0XHR0aGlzLm1ha2VHZW9tZXRyeSgpO1xuXG5cdFx0Ly9tYWtlIGEgZGVlcCBjb3B5IG9mIHRoZSB1bmlmb3JtcyB0ZW1wbGF0ZVxuXHRcdHRoaXMuX3VuaWZvcm1zID0ge307XG5cdFx0Zm9yKHZhciB1bmlmb3JtTmFtZSBpbiB1bmlmb3Jtcyl7XG5cdFx0XHR0aGlzLl91bmlmb3Jtc1t1bmlmb3JtTmFtZV0gPSB7XG5cdFx0XHRcdHR5cGU6IHVuaWZvcm1zW3VuaWZvcm1OYW1lXS50eXBlLFxuXHRcdFx0XHR2YWx1ZTogdW5pZm9ybXNbdW5pZm9ybU5hbWVdLnZhbHVlXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5TaGFkZXJNYXRlcmlhbCh7XG5cdFx0XHRzaWRlOiBUSFJFRS5CYWNrU2lkZSxcblx0XHRcdHZlcnRleFNoYWRlcjogdlNoYWRlciwgXG5cdFx0XHRmcmFnbWVudFNoYWRlcjogZlNoYWRlcixcblx0XHRcdHVuaWZvcm1zOiB0aGlzLl91bmlmb3Jtcyxcblx0XHRcdH0pO1xuXHRcdHRoaXMubWVzaCA9IG5ldyBUSFJFRS5NZXNoKHRoaXMuX2dlb21ldHJ5LHRoaXMubWF0ZXJpYWwpO1xuXG5cdFx0dGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy8gc2V0dGVyIHNldHMgdHJhbnNwYXJlbnQgZmxhZyBpZiBuZWNlc3Nhcnlcblx0XHR0aGlzLmNvbG9yID0gdGhpcy5fY29sb3I7IC8vc2V0dGVyIHNldHMgY29sb3IgdW5pZm9ybVxuXHRcdHRoaXMuX3VuaWZvcm1zLm9wYWNpdHkudmFsdWUgPSB0aGlzLl9vcGFjaXR5O1xuXHRcdHRoaXMuX3VuaWZvcm1zLmdyaWRTcXVhcmVzLnZhbHVlID0gdGhpcy5fZ3JpZFNxdWFyZXM7XG5cdFx0dGhpcy5fdW5pZm9ybXMuc2hvd0dyaWQudmFsdWUgPSB0aGlzLl9zaG93R3JpZCA/IDEgOiAwO1xuXHRcdHRoaXMuX3VuaWZvcm1zLnNob3dTb2xpZC52YWx1ZSA9IHRoaXMuX3Nob3dTb2xpZCA/IDEgOiAwO1xuXHRcdHRoaXMuX3VuaWZvcm1zLmxpbmVXaWR0aC52YWx1ZSA9IHRoaXMuX2dyaWRMaW5lV2lkdGg7XG5cblx0XHRpZighdGhpcy5zaG93U29saWQpdGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IHRydWU7XG5cblx0XHR0aHJlZUVudmlyb25tZW50LnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXHR9XG5cdG1ha2VHZW9tZXRyeSgpe1xuXG5cdFx0bGV0IE1BWF9QT0lOVFMgPSAxMDAwMDtcblxuXHRcdHRoaXMuX3ZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheShNQVhfUE9JTlRTICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cdFx0dGhpcy5fbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDMpO1xuXHRcdHRoaXMuX3V2cyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIDIpO1xuXG5cdFx0Ly8gYnVpbGQgZ2VvbWV0cnlcblxuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdub3JtYWwnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fbm9ybWFscywgMyApICk7XG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAndXYnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fdXZzLCAyICkgKTtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy91c2VkIGR1cmluZyB1cGRhdGVzIGFzIGEgcG9pbnRlciB0byB0aGUgYnVmZmVyXG5cblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cblx0fVxuXHRfc2V0VVZzKHV2cywgaW5kZXgsIHUsIHYpe1xuXG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG4gICAgICAgIC8vc2V0dXAgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gYW5kIHRoaXMuaXRlbURpbWVuc2lvbnMuIHVzZWQgaGVyZSBhZ2FpbiBiZWNhdXNlIGNsb25pbmcgbWVhbnMgdGhlIG9uQWRkKCkgbWlnaHQgYmUgY2FsbGVkIGJlZm9yZSB0aGlzIGlzIGNvbm5lY3RlZCB0byBhIHR5cGUgb2YgZG9tYWluXG5cblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgRG9tYWluTm9kZSB3ZSdyZSByZW5kZXJpbmcgZnJvbVxuXHRcdGxldCByb290ID0gdGhpcy5nZXRDbG9zZXN0RG9tYWluKCk7XG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcblxuXHRcdC8vIHBlcmhhcHMgaW5zdGVhZCBvZiBnZW5lcmF0aW5nIGEgd2hvbGUgbmV3IGFycmF5LCB0aGlzIGNhbiByZXVzZSB0aGUgb2xkIG9uZT9cblx0XHRsZXQgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cdFx0bGV0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogMyk7XG5cdFx0bGV0IHV2cyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiAyKTtcblxuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0dGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl92ZXJ0aWNlcyk7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBub3JtYWxzO1xuXHRcdG5vcm1hbEF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9ub3JtYWxzKTtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IHV2QXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy51djtcblxuXG5cdFx0Ly9hc3NlcnQgdGhpcy5pdGVtRGltZW5zaW9uc1swXSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0gPSB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiBhbmQgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9PSAyXG5cdFx0dmFyIGluZGljZXMgPSBbXTtcblxuXHRcdC8vcmVuZGVyZWQgdHJpYW5nbGUgaW5kaWNlc1xuXHRcdC8vZnJvbSB0aHJlZS5qcyBQbGFuZUdlb21ldHJ5LmpzXG5cdFx0bGV0IGJhc2UgPSAwO1xuXHRcdGxldCBpPTAsIGo9MDtcblx0XHRmb3Ioaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1swXS0xO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xO2krKyl7XG5cblx0XHRcdFx0bGV0IGEgPSBpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBiID0gaSArIChqKzEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGMgPSAoaSsxKSsgKGorMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRsZXQgZCA9IChpKzEpKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblxuICAgICAgICBcdFx0aW5kaWNlcy5wdXNoKGEsIGIsIGQpO1xuXHRcdFx0XHRpbmRpY2VzLnB1c2goYiwgYywgZCk7XG5cdFx0XHRcdFxuXHRcdFx0XHQvL2RvdWJsZSBzaWRlZCByZXZlcnNlIGZhY2VzXG4gICAgICAgIFx0XHRpbmRpY2VzLnB1c2goZCwgYiwgYSk7XG5cdFx0XHRcdGluZGljZXMucHVzaChkLCBjLCBiKTtcblxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vbm9ybWFscyAod2lsbCBiZSBvdmVyd3JpdHRlbiBsYXRlcikgYW5kIHV2c1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtpKyspe1xuXG5cdFx0XHRcdGxldCBwb2ludEluZGV4ID0gaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHQvL3NldCBub3JtYWwgdG8gWzAsMCwxXSBhcyBhIHRlbXBvcmFyeSB2YWx1ZVxuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozXSA9IDA7XG5cdFx0XHRcdG5vcm1hbHNbKHBvaW50SW5kZXgpKjMrMV0gPSAwO1xuXHRcdFx0XHRub3JtYWxzWyhwb2ludEluZGV4KSozKzJdID0gMTtcblxuXHRcdFx0XHQvL3V2c1xuXHRcdFx0XHR1dnNbKHBvaW50SW5kZXgpKjJdID0gai8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKTtcblx0XHRcdFx0dXZzWyhwb2ludEluZGV4KSoyKzFdID0gaS8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl91dnMgPSB1dnM7XG5cdFx0dXZBdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdXZzKTtcblx0XHR1dkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHR0aGlzLl9nZW9tZXRyeS5zZXRJbmRleCggaW5kaWNlcyApO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHRpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7XHRcblx0XHR9XG5cblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cblx0XHQvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuXHRcdGxldCBpbmRleCA9IHRoaXMuX2N1cnJlbnRQb2ludEluZGV4KnRoaXMuX291dHB1dERpbWVuc2lvbnM7XG5cblx0XHRpZih4ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXhdID0geDtcblx0XHRpZih5ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMV0gPSB5O1xuXHRcdGlmKHogIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXSA9IHo7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXHR9XG5cdG9uQWZ0ZXJBY3RpdmF0aW9uKCl7XG5cdFx0bGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHR0aGlzLl9yZWNhbGNOb3JtYWxzKCk7XG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdG5vcm1hbEF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vcmVzZXQgYWZ0ZXIgZWFjaCB1cGRhdGVcblx0fVxuXHRfcmVjYWxjTm9ybWFscygpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdC8vcmVuZGVyZWQgdHJpYW5nbGUgaW5kaWNlc1xuXHRcdC8vZnJvbSB0aHJlZS5qcyBQbGFuZUdlb21ldHJ5LmpzXG5cdFx0bGV0IG5vcm1hbFZlYyA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0bGV0IHBhcnRpYWxYID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XHRsZXQgcGFydGlhbFkgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG5cdFx0bGV0IGJhc2UgPSAwO1xuXHRcdGxldCBuZWdhdGlvbkZhY3RvciA9IDE7XG5cdFx0bGV0IGk9MCwgaj0wO1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2orKyl7XG5cdFx0XHRmb3IoaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtpKyspe1xuXG5cdFx0XHRcdC8vY3VycmVudGx5IGRvaW5nIHRoZSBub3JtYWwgZm9yIHRoZSBwb2ludCBhdCBpbmRleCBhLlxuXHRcdFx0XHRsZXQgYSA9IGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGIsYztcblxuXHRcdFx0XHQvL1RhbmdlbnRzIGFyZSBjYWxjdWxhdGVkIHdpdGggZmluaXRlIGRpZmZlcmVuY2VzIC0gRm9yICh4LHkpLCBjb21wdXRlIHRoZSBwYXJ0aWFsIGRlcml2YXRpdmVzIHVzaW5nICh4KzEseSkgYW5kICh4LHkrMSkgYW5kIGNyb3NzIHRoZW0uIEJ1dCBpZiB5b3UncmUgYXQgdGhlYm9yZGVyLCB4KzEgYW5kIHkrMSBtaWdodCBub3QgZXhpc3QuIFNvIGluIHRoYXQgY2FzZSB3ZSBnbyBiYWNrd2FyZHMgYW5kIHVzZSAoeC0xLHkpIGFuZCAoeCx5LTEpIGluc3RlYWQuXG5cdFx0XHRcdC8vV2hlbiB0aGF0IGhhcHBlbnMsIHRoZSB2ZWN0b3Igc3VidHJhY3Rpb24gd2lsbCBzdWJ0cmFjdCB0aGUgd3Jvbmcgd2F5LCBpbnRyb2R1Y2luZyBhIGZhY3RvciBvZiAtMSBpbnRvIHRoZSBjcm9zcyBwcm9kdWN0IHRlcm0uIFNvIG5lZ2F0aW9uRmFjdG9yIGtlZXBzIHRyYWNrIG9mIHdoZW4gdGhhdCBoYXBwZW5zIGFuZCBpcyBtdWx0aXBsaWVkIGFnYWluIHRvIGNhbmNlbCBpdCBvdXQuXG5cdFx0XHRcdG5lZ2F0aW9uRmFjdG9yID0gMTsgXG5cblx0XHRcdFx0Ly9iIGlzIHRoZSBpbmRleCBvZiB0aGUgcG9pbnQgMSBhd2F5IGluIHRoZSB5IGRpcmVjdGlvblxuXHRcdFx0XHRpZihpIDwgdGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKXtcblx0XHRcdFx0XHRiID0gKGkrMSkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0fWVsc2V7XG5cdFx0XHRcdFx0Ly9lbmQgb2YgdGhlIHkgYXhpcywgZ28gYmFja3dhcmRzIGZvciB0YW5nZW50c1xuXHRcdFx0XHRcdGIgPSAoaS0xKSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRcdG5lZ2F0aW9uRmFjdG9yICo9IC0xO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9jIGlzIHRoZSBpbmRleCBvZiB0aGUgcG9pbnQgMSBhd2F5IGluIHRoZSB4IGRpcmVjdGlvblxuXHRcdFx0XHRpZihqIDwgdGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKXtcblx0XHRcdFx0XHRjID0gaSArIChqKzEpICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0fWVsc2V7XG5cdFx0XHRcdFx0Ly9lbmQgb2YgdGhlIHggYXhpcywgZ28gYmFja3dhcmRzIGZvciB0YW5nZW50c1xuXHRcdFx0XHRcdGMgPSBpICsgKGotMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRcdG5lZ2F0aW9uRmFjdG9yICo9IC0xO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly90aGUgdmVjdG9yIGItYS4gXG5cdFx0XHRcdC8vdGhpcy5fdmVydGljZXMgc3RvcmVzIHRoZSBjb21wb25lbnRzIG9mIGVhY2ggdmVjdG9yIGluIG9uZSBiaWcgZmxvYXQzMmFycmF5LCBzbyB0aGlzIHB1bGxzIHRoZW0gb3V0IGFuZCBqdXN0IGRvZXMgdGhlIHN1YnRyYWN0aW9uIG51bWVyaWNhbGx5LiBUaGUgY29tcG9uZW50cyBvZiB2ZWN0b3IgIzUyIGFyZSB4OjUyKjMrMCx5OjUyKjMrMSx6OjUyKjMrMiwgZm9yIGV4YW1wbGUuXG5cdFx0XHRcdHBhcnRpYWxZLnNldCh0aGlzLl92ZXJ0aWNlc1tiKjNdLXRoaXMuX3ZlcnRpY2VzW2EqM10sdGhpcy5fdmVydGljZXNbYiozKzFdLXRoaXMuX3ZlcnRpY2VzW2EqMysxXSx0aGlzLl92ZXJ0aWNlc1tiKjMrMl0tdGhpcy5fdmVydGljZXNbYSozKzJdKTtcblx0XHRcdFx0Ly90aGUgdmVjdG9yIGMtYS5cblx0XHRcdFx0cGFydGlhbFguc2V0KHRoaXMuX3ZlcnRpY2VzW2MqM10tdGhpcy5fdmVydGljZXNbYSozXSx0aGlzLl92ZXJ0aWNlc1tjKjMrMV0tdGhpcy5fdmVydGljZXNbYSozKzFdLHRoaXMuX3ZlcnRpY2VzW2MqMysyXS10aGlzLl92ZXJ0aWNlc1thKjMrMl0pO1xuXG5cdFx0XHRcdC8vYi1hIGNyb3NzIGMtYVxuXHRcdFx0XHRub3JtYWxWZWMuY3Jvc3NWZWN0b3JzKHBhcnRpYWxYLHBhcnRpYWxZKS5ub3JtYWxpemUoKTtcblx0XHRcdFx0bm9ybWFsVmVjLm11bHRpcGx5U2NhbGFyKG5lZ2F0aW9uRmFjdG9yKTtcblx0XHRcdFx0Ly9zZXQgbm9ybWFsXG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqM10gPSBub3JtYWxWZWMueDtcblx0XHRcdFx0dGhpcy5fbm9ybWFsc1soaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdKSozKzFdID0gbm9ybWFsVmVjLnk7XG5cdFx0XHRcdHRoaXMuX25vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqMysyXSA9IG5vcm1hbFZlYy56O1xuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBkb24ndCBmb3JnZXQgdG8gbm9ybWFsQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZSBhZnRlciBjYWxsaW5nIHRoaXMhXG5cdH1cbiAgICByZW1vdmVTZWxmRnJvbVNjZW5lKCl7XG4gICAgICAgIHRocmVlRW52aXJvbm1lbnQuc2NlbmUucmVtb3ZlKHRoaXMubWVzaCk7XG4gICAgfVxuXHRzZXQgY29sb3IoY29sb3Ipe1xuXHRcdC8vY3VycmVudGx5IG9ubHkgYSBzaW5nbGUgY29sb3IgaXMgc3VwcG9ydGVkLlxuXHRcdC8vSSBzaG91bGQgcmVhbGx5IG1ha2UgdGhpcyBhIGZ1bmN0aW9uXG5cdFx0dGhpcy5fY29sb3IgPSBjb2xvcjtcblx0XHR0aGlzLl91bmlmb3Jtcy5jb2xvci52YWx1ZSA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG5cdH1cblx0Z2V0IGNvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbG9yO1xuXHR9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdHRoaXMubWF0ZXJpYWwub3BhY2l0eSA9IG9wYWNpdHk7XG5cdFx0dGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuXHRcdHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuICAgICAgICB0aGlzLl91bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBTdXJmYWNlT3V0cHV0KHtjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuZXhwb3J0IHtTdXJmYWNlT3V0cHV0fTtcbiIsInZhciBleHBsYW5hcmlhbkFycm93U1ZHID0gXCJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBEOTRiV3dnZG1WeWMybHZiajBpTVM0d0lpQmxibU52WkdsdVp6MGlWVlJHTFRnaUlITjBZVzVrWVd4dmJtVTlJbTV2SWo4K0Nqd2hMUzBnUTNKbFlYUmxaQ0IzYVhSb0lFbHVhM05qWVhCbElDaG9kSFJ3T2k4dmQzZDNMbWx1YTNOallYQmxMbTl5Wnk4cElDMHRQZ29LUEhOMlp3b2dJQ0I0Yld4dWN6cGtZejBpYUhSMGNEb3ZMM0IxY213dWIzSm5MMlJqTDJWc1pXMWxiblJ6THpFdU1TOGlDaUFnSUhodGJHNXpPbU5qUFNKb2RIUndPaTh2WTNKbFlYUnBkbVZqYjIxdGIyNXpMbTl5Wnk5dWN5TWlDaUFnSUhodGJHNXpPbkprWmowaWFIUjBjRG92TDNkM2R5NTNNeTV2Y21jdk1UazVPUzh3TWk4eU1pMXlaR1l0YzNsdWRHRjRMVzV6SXlJS0lDQWdlRzFzYm5NNmMzWm5QU0pvZEhSd09pOHZkM2QzTG5jekxtOXlaeTh5TURBd0wzTjJaeUlLSUNBZ2VHMXNibk05SW1oMGRIQTZMeTkzZDNjdWR6TXViM0puTHpJd01EQXZjM1puSWdvZ0lDQjRiV3h1Y3pwNGJHbHVhejBpYUhSMGNEb3ZMM2QzZHk1M015NXZjbWN2TVRrNU9TOTRiR2x1YXlJS0lDQWdlRzFzYm5NNmMyOWthWEJ2WkdrOUltaDBkSEE2THk5emIyUnBjRzlrYVM1emIzVnlZMlZtYjNKblpTNXVaWFF2UkZSRUwzTnZaR2x3YjJScExUQXVaSFJrSWdvZ0lDQjRiV3h1Y3pwcGJtdHpZMkZ3WlQwaWFIUjBjRG92TDNkM2R5NXBibXR6WTJGd1pTNXZjbWN2Ym1GdFpYTndZV05sY3k5cGJtdHpZMkZ3WlNJS0lDQWdkMmxrZEdnOUlqSXdNQ0lLSUNBZ2FHVnBaMmgwUFNJeE16QWlDaUFnSUhacFpYZENiM2c5SWpBZ01DQXlNREFnTVRNd0lnb2dJQ0JwWkQwaWMzWm5NaUlLSUNBZ2RtVnljMmx2YmowaU1TNHhJZ29nSUNCcGJtdHpZMkZ3WlRwMlpYSnphVzl1UFNJd0xqa3hJSEl4TXpjeU5TSUtJQ0FnYzI5a2FYQnZaR2s2Wkc5amJtRnRaVDBpUlhod2JHRnVZWEpwWVc1T1pYaDBRWEp5YjNjdWMzWm5JajRLSUNBOFpHVm1jejRLUEhKaFpHbGhiRWR5WVdScFpXNTBJR2xrUFNKaElpQmplRDBpTlRBd0lpQmplVDBpTmpJM0xqY3hJaUJ5UFNJeU5ESXVNelVpSUdkeVlXUnBaVzUwVkhKaGJuTm1iM0p0UFNKdFlYUnlhWGdvTUNBdU1qazNNRElnTFRNdU9ETTVNU0F0TVM0eE9UTXhaUzA0SURJME1EZ3VNU0E0TXpndU9EVXBJaUJuY21Ga2FXVnVkRlZ1YVhSelBTSjFjMlZ5VTNCaFkyVlBibFZ6WlNJK0NqeHpkRzl3SUhOMGIzQXRZMjlzYjNJOUlpTmlZemN6TVRraUlHOW1abk5sZEQwaU1DSXZQZ284YzNSdmNDQnpkRzl3TFdOdmJHOXlQU0lqWmpCa01qWXpJaUJ2Wm1aelpYUTlJakVpTHo0S1BDOXlZV1JwWVd4SGNtRmthV1Z1ZEQ0S1BDOWtaV1p6UGdvOGJXVjBZV1JoZEdFK0NqeHlaR1k2VWtSR1BnbzhZMk02VjI5eWF5QnlaR1k2WVdKdmRYUTlJaUkrQ2p4a1l6cG1iM0p0WVhRK2FXMWhaMlV2YzNabkszaHRiRHd2WkdNNlptOXliV0YwUGdvOFpHTTZkSGx3WlNCeVpHWTZjbVZ6YjNWeVkyVTlJbWgwZEhBNkx5OXdkWEpzTG05eVp5OWtZeTlrWTIxcGRIbHdaUzlUZEdsc2JFbHRZV2RsSWk4K0NqeGtZenAwYVhSc1pTOCtDand2WTJNNlYyOXlhejRLUEM5eVpHWTZVa1JHUGdvOEwyMWxkR0ZrWVhSaFBnbzhaeUIwY21GdWMyWnZjbTA5SW5SeVlXNXpiR0YwWlNnd0lDMDVNakl1TXpZcElqNEtQSEJoZEdnZ1pEMGliVEU1Tnk0ME55QTVPRGN1TXpaak1DMHlOQzR5T0RFdE9EY3VNall4TFRZeExqY3dPQzA0Tnk0eU5qRXROakV1TnpBNGRqSTVMalk1Tkd3dE1UTXVOVFl6SURBdU16YzVOR010TVRNdU5UWXpJREF1TXpjNU16a3ROakl1TWpBeUlESXVPREkzTVMwM05DNDRNVEVnTnk0NU5qVTNMVEV5TGpZd09TQTFMakV6T0RZdE1Ua3VNekF4SURFMExqWTVOUzB4T1M0ek1ERWdNak11TmpZNUlEQWdPQzQ1TnpNNElETXVPVGN6TlNBeE9DNHhOak1nTVRrdU16QXhJREl6TGpZMk9TQXhOUzR6TWpjZ05TNDFNRFUxSURZeExqSTBPQ0EzTGpVNE5qTWdOelF1T0RFeElEY3VPVFkxTjJ3eE15NDFOak1nTUM0ek56azBkakk1TGpZNU5ITTROeTR5TmpFdE16Y3VOREk0SURnM0xqSTJNUzAyTVM0M01EaDZJaUJtYVd4c1BTSjFjbXdvSTJFcElpQnpkSEp2YTJVOUlpTTNNelUxTTJRaUlITjBjbTlyWlMxM2FXUjBhRDBpTWk0Mk1qZzFJaTgrQ2p4bklIUnlZVzV6Wm05eWJUMGliV0YwY21sNEtEQWdMakkyTWpnMUlDMHVNall5T0RVZ01DQXhOemd1TVRNZ09EWXdMakF4S1NJZ2MzUnliMnRsUFNJak1EQXdJaUJ6ZEhKdmEyVXRkMmxrZEdnOUlqRXdJajRLUEdWc2JHbHdjMlVnWTNnOUlqVTBOeTR4TkNJZ1kzazlJakV5TUM0NU15SWdjbmc5SWpJMUxqY3hOQ0lnY25rOUlqVXhMalF5T1NJZ1ptbHNiRDBpSTJabVppSXZQZ284Wld4c2FYQnpaU0JqZUQwaU5UTTBMak0zSWlCamVUMGlNVEl6TGpVeklpQnllRDBpTVRJdU5qSTNJaUJ5ZVQwaU1qWXVNalkwSWk4K0Nqd3ZaejRLUEdjZ2RISmhibk5tYjNKdFBTSnRZWFJ5YVhnb01DQXRMakkyTWpnMUlDMHVNall5T0RVZ01DQXhOemd1TmpZZ01URXhOQzQzS1NJZ2MzUnliMnRsUFNJak1EQXdJaUJ6ZEhKdmEyVXRkMmxrZEdnOUlqRXdJajRLUEdWc2JHbHdjMlVnWTNnOUlqVTBOeTR4TkNJZ1kzazlJakV5TUM0NU15SWdjbmc5SWpJMUxqY3hOQ0lnY25rOUlqVXhMalF5T1NJZ1ptbHNiRDBpSTJabVppSXZQZ284Wld4c2FYQnpaU0JqZUQwaU5UTTBMak0zSWlCamVUMGlNVEl6TGpVeklpQnllRDBpTVRJdU5qSTNJaUJ5ZVQwaU1qWXVNalkwSWk4K0Nqd3ZaejRLUEM5blBnbzhMM04yWno0S1wiO1xuXG5leHBvcnQgZGVmYXVsdCBleHBsYW5hcmlhbkFycm93U1ZHO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qVGhpcyBjbGFzcyBpcyBzdXBwb3NlZCB0byB0dXJuIGEgc2VyaWVzIG9mXG5kaXIuZGVsYXkoKVxuZGlyLnRyYW5zaXRpb25UbyguLi4pXG5kaXIuZGVsYXkoKVxuZGlyLm5leHRTbGlkZSgpO1xuXG5pbnRvIGEgc2VxdWVuY2UgdGhhdCBvbmx5IGFkdmFuY2VzIHdoZW4gdGhlIHJpZ2h0IGFycm93IGlzIHByZXNzZWQuXG5cbkFueSBkaXZzIHdpdGggdGhlIGV4cC1zbGlkZSBjbGFzcyB3aWxsIGFsc28gYmUgc2hvd24gYW5kIGhpZGRlbiBvbmUgYnkgb25lLlxuXG4qL1xuXG5pbXBvcnQge0FuaW1hdGlvbn0gZnJvbSAnLi9BbmltYXRpb24uanMnO1xuaW1wb3J0IGV4cGxhbmFyaWFuQXJyb3dTVkcgZnJvbSAnLi9EaXJlY3RvckltYWdlQ29uc3RhbnRzLmpzJztcblxuY2xhc3MgRGlyZWN0aW9uQXJyb3d7XG5cdGNvbnN0cnVjdG9yKGZhY2VSaWdodCl7XG5cdFx0dGhpcy5hcnJvd0ltYWdlID0gbmV3IEltYWdlKCk7XG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5zcmMgPSBleHBsYW5hcmlhbkFycm93U1ZHO1xuXG4gICAgICAgIHRoaXMuYXJyb3dJbWFnZS5jbGFzc0xpc3QuYWRkKFwiZXhwLWFycm93XCIpO1xuXG5cdFx0ZmFjZVJpZ2h0ID0gZmFjZVJpZ2h0PT09dW5kZWZpbmVkID8gdHJ1ZSA6IGZhY2VSaWdodDtcblxuXHRcdGlmKGZhY2VSaWdodCl7XG5cdFx0XHR0aGlzLmFycm93SW1hZ2UuY2xhc3NMaXN0LmFkZChcImV4cC1hcnJvdy1yaWdodFwiKVxuXHRcdH1lbHNle1xuXHRcdFx0dGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3ctbGVmdFwiKVxuXHRcdH1cblx0XHR0aGlzLmFycm93SW1hZ2Uub25jbGljayA9IChmdW5jdGlvbigpe1xuXHRcdFx0dGhpcy5vbmNsaWNrKCk7XG5cdFx0fSkuYmluZCh0aGlzKTtcblxuXHRcdHRoaXMub25jbGlja0NhbGxiYWNrID0gbnVsbDsgLy8gdG8gYmUgc2V0IGV4dGVybmFsbHlcblx0fVxuXHRvbmNsaWNrKCl7XG5cdFx0dGhpcy5oaWRlU2VsZigpO1xuXHRcdHRoaXMub25jbGlja0NhbGxiYWNrKCk7XG5cdH1cblx0c2hvd1NlbGYoKXtcblx0XHR0aGlzLmFycm93SW1hZ2Uuc3R5bGUucG9pbnRlckV2ZW50cyA9ICcnO1xuXHRcdHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5vcGFjaXR5ID0gMTtcblx0XHRcblx0fVxuXHRoaWRlU2VsZigpe1xuXHRcdHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5vcGFjaXR5ID0gMDtcblx0XHR0aGlzLmFycm93SW1hZ2Uuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcblx0fVxufVxuXG5cbmNsYXNzIE5vbkRlY3JlYXNpbmdEaXJlY3Rvcntcblx0Ly8gSSB3YW50IERpcmVjdG9yKCkgdG8gYmUgYWJsZSB0byBiYWNrdHJhY2sgYnkgcHJlc3NpbmcgYmFja3dhcmRzLiBUaGlzIGRvZXNuJ3QgZG8gdGhhdC5cblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0dGhpcy5zbGlkZXMgPSBbXTtcblx0XHR0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID0gMDsgICAgICAgIFxuICAgICAgICB0aGlzLm51bVNsaWRlcyA9IDA7XG5cblx0XHR0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0fVxuXG5cblx0YXN5bmMgYmVnaW4oKXtcblx0XHRhd2FpdCB0aGlzLndhaXRGb3JQYWdlTG9hZCgpO1xuICAgICAgICB0aGlzLnNsaWRlcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJleHAtc2xpZGVcIik7XG4gICAgICAgIHRoaXMubnVtU2xpZGVzID0gdGhpcy5zbGlkZXMubGVuZ3RoO1xuXG4gICAgICAgIC8vaGlkZSBhbGwgc2xpZGVzIGV4Y2VwdCBmaXJzdCBvbmVcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtU2xpZGVzO2krKyl7XG4gICAgICAgICAgICB0aGlzLnNsaWRlc1tpXS5zdHlsZS5vcGFjaXR5ID0gMDsgXG5cdFx0XHR0aGlzLnNsaWRlc1tpXS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOy8vb3BhY2l0eT0wIGFsb25lIHdvbid0IGJlIGluc3RhbnQgYmVjYXVzZSBvZiB0aGUgMXMgQ1NTIHRyYW5zaXRpb25cblx0XHR9XG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xuICAgICAgICAvL3VuZG8gc2V0dGluZyBkaXNwbGF5LW5vbmUgYWZ0ZXIgYSBiaXQgb2YgdGltZVxuICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbigpe1xuXHRcdCAgICBmb3IodmFyIGk9MDtpPHNlbGYuc2xpZGVzLmxlbmd0aDtpKyspe1xuXHRcdFx0ICAgIHNlbGYuc2xpZGVzW2ldLnN0eWxlLmRpc3BsYXkgPSAnJztcblx0XHQgICAgfVxuICAgICAgICB9LDEpO1xuXG4gICAgICAgIHRoaXMuc2hvd1NsaWRlKDApOyAvL3VuaGlkZSBmaXJzdCBvbmVcblxuXHRcdHRoaXMucmlnaHRBcnJvdyA9IG5ldyBEaXJlY3Rpb25BcnJvdygpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yaWdodEFycm93LmFycm93SW1hZ2UpO1xuXHRcdHRoaXMucmlnaHRBcnJvdy5vbmNsaWNrQ2FsbGJhY2sgPSBmdW5jdGlvbigpe1xuXHRcdFx0c2VsZi5fY2hhbmdlU2xpZGUoMSwgZnVuY3Rpb24oKXt9KTsgLy8gdGhpcyBlcnJvcnMgd2l0aG91dCB0aGUgZW1wdHkgZnVuY3Rpb24gYmVjYXVzZSB0aGVyZSdzIG5vIHJlc29sdmUuIFRoZXJlIG11c3QgYmUgYSBiZXR0ZXIgd2F5IHRvIGRvIHRoaW5ncy5cblx0XHRcdGNvbnNvbGUud2FybihcIldBUk5JTkc6IEhvcnJpYmxlIGhhY2sgaW4gZWZmZWN0IHRvIGNoYW5nZSBzbGlkZXMuIFBsZWFzZSByZXBsYWNlIHRoZSBwYXNzLWFuLWVtcHR5LWZ1bmN0aW9uIHRoaW5nIHdpdGggc29tZXRoaW5nIHRoYXQgYWN0dWFsbHkgcmVzb2x2ZXMgcHJvcGVybHkgYW5kIGRvZXMgYXN5bmMuXCIpXG5cdFx0XHRzZWxmLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpO1xuXHRcdH1cblxuICAgICAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcblxuXHR9XG5cblx0YXN5bmMgd2FpdEZvclBhZ2VMb2FkKCl7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICAgICAgICBpZihkb2N1bWVudC5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScpe1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLHJlc29sdmUpO1xuXHRcdH0pO1xuXHR9XG5cblx0c2hvd1NsaWRlKHNsaWRlTnVtYmVyKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtU2xpZGVzO2krKyl7XG5cdFx0XHRpZihpICE9IHNsaWRlTnVtYmVyKXRoaXMuc2xpZGVzW2ldLnN0eWxlLm9wYWNpdHkgPSAwO1xuXHRcdH1cbiAgICAgICAgaWYoc2xpZGVOdW1iZXIgPj0gdGhpcy5udW1TbGlkZXMpe1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlRyaWVkIHRvIHNob3cgc2xpZGUgI1wiK3NsaWRlTnVtYmVyK1wiLCBidXQgb25seSBcIiArIHRoaXMubnVtU2xpZGVzICsgXCJIVE1MIGVsZW1lbnRzIHdpdGggZXhwLXNsaWRlIHdlcmUgZm91bmQhIE1ha2UgbW9yZSBzbGlkZXM/XCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cdFx0dGhpcy5zbGlkZXNbc2xpZGVOdW1iZXJdLnN0eWxlLm9wYWNpdHkgPSAxO1xuXHR9XG5cblx0YXN5bmMgbmV4dFNsaWRlKCl7XG4gICAgICAgIGlmKCF0aGlzLmluaXRpYWxpemVkKXRocm93IG5ldyBFcnJvcihcIkVSUk9SOiBVc2UgLmJlZ2luKCkgb24gYSBEaXJlY3RvciBiZWZvcmUgY2FsbGluZyBhbnkgb3RoZXIgbWV0aG9kcyFcIik7XG5cblx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cblx0XHR0aGlzLnJpZ2h0QXJyb3cuc2hvd1NlbGYoKTtcblx0XHQvL3Byb21pc2UgaXMgcmVzb2x2ZWQgYnkgY2FsbGluZyB0aGlzLm5leHRTbGlkZVByb21pc2UucmVzb2x2ZSgpIHdoZW4gdGhlIHRpbWUgY29tZXNcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0ZnVuY3Rpb24ga2V5TGlzdGVuZXIoZSl7XG5cdFx0XHRcdGlmKGUucmVwZWF0KXJldHVybjsgLy9rZXlkb3duIGZpcmVzIG11bHRpcGxlIHRpbWVzIGJ1dCB3ZSBvbmx5IHdhbnQgdGhlIGZpcnN0IG9uZVxuXHRcdFx0XHRsZXQgc2xpZGVEZWx0YSA9IDA7XG5cdFx0XHRcdHN3aXRjaCAoZS5rZXlDb2RlKSB7XG5cdFx0XHRcdCAgY2FzZSAzNDpcblx0XHRcdFx0ICBjYXNlIDM5OlxuXHRcdFx0XHQgIGNhc2UgNDA6XG5cdFx0XHRcdFx0c2xpZGVEZWx0YSA9IDE7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdCAgZGVmYXVsdDpcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZihzbGlkZURlbHRhICE9IDApe1xuXHRcdFx0XHRcdHNlbGYuX2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpO1xuXHRcdFx0XHRcdHNlbGYucmlnaHRBcnJvdy5oaWRlU2VsZigpO1xuXHRcdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLGtleUxpc3RlbmVyKTsgLy90aGlzIGFwcHJvYWNoIHRha2VuIGZyb20gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzU3MTg2NDUvcmVzb2x2aW5nLWEtcHJvbWlzZS13aXRoLWV2ZW50bGlzdGVuZXJcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwga2V5TGlzdGVuZXIpO1xuXHRcdFx0Ly9ob3JyaWJsZSBoYWNrIHNvIHRoYXQgdGhlICduZXh0IHNsaWRlJyBhcnJvdyBjYW4gdHJpZ2dlciB0aGlzIHRvb1xuXHRcdFx0c2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBmdW5jdGlvbigpeyBcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIixrZXlMaXN0ZW5lcik7IFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdF9jaGFuZ2VTbGlkZShzbGlkZURlbHRhLCByZXNvbHZlKXtcblx0XHQvL3NsaWRlIGNoYW5naW5nIGxvZ2ljXG5cdFx0Ly9yaWdodCBub3cgdGhlcmUgaXMgYSBwcm9ibGVtLiBHb2luZyBiYWNrd2FyZHMgc2hvdWxkIG5vdCByZXNvbHZlIHRoZSBwcm9taXNlOyBvbmx5IGdvaW5nIHRvIHRoZSBtb3N0IHJlY2VudCBzbGlkZSBhbmQgcHJlc3NpbmcgcmlnaHQgc2hvdWxkLlxuXHRcdGlmKHNsaWRlRGVsdGEgIT0gMCl7XG5cdFx0XHRpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IDAgJiYgc2xpZGVEZWx0YSA9PSAtMSl7XG5cdFx0XHRcdHJldHVybjsgLy9ubyBnb2luZyBwYXN0IHRoZSBiZWdpbm5pbmdcblx0XHRcdH1cblx0XHRcdGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gdGhpcy5zbGlkZXMubGVuZ3RoLTEgJiYgc2xpZGVEZWx0YSA9PSAxKXtcblx0XHRcdFx0cmV0dXJuOyAvL25vIGdvaW5nIHBhc3QgdGhlIGVuZFxuXHRcdFx0fVxuXHRcdFx0dGhpcy5jdXJyZW50U2xpZGVJbmRleCArPSBzbGlkZURlbHRhO1xuXHRcdFx0dGhpcy5zaG93U2xpZGUodGhpcy5jdXJyZW50U2xpZGVJbmRleCk7XG5cdFx0XHRyZXNvbHZlKCk7XG5cdFx0fVxuXHR9XG5cdC8vdmVyYnNcblx0YXN5bmMgZGVsYXkod2FpdFRpbWUpe1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHRcdH0pO1xuXHR9XG5cdFRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TKXtcblx0XHQvL1V0aWxzLkFzc2VydCh0aGlzLnVuZG9TdGFja0luZGV4ID09IDApOyAvL1RoaXMgbWF5IG5vdCB3b3JrIHdlbGwuXG5cdFx0bmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDApO1xuXHR9XG59XG5cblxuXG5cblxuXG5cbmNsYXNzIFVuZG9DYXBhYmxlRGlyZWN0b3IgZXh0ZW5kcyBOb25EZWNyZWFzaW5nRGlyZWN0b3J7XG4gICAgLy90aHNpIGRpcmVjdG9yIHVzZXMgYm90aCBmb3J3YXJkcyBhbmQgYmFja3dhcmRzIGFycm93cy4gdGhlIGJhY2t3YXJkcyBhcnJvdyB3aWxsIHVuZG8gYW55IFVuZG9DYXBhYmxlRGlyZWN0b3IuVHJhbnNpdGlvblRvKClzXG4gICAgLy90b2RvOiBob29rIHVwIHRoZSBhcnJvd3MgYW5kIG1ha2UgaXQgbm90XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcblxuICAgICAgICB0aGlzLmZ1cnRoZXN0U2xpZGVJbmRleCA9IDA7IC8vbWF0Y2hlcyB0aGUgbnVtYmVyIG9mIHRpbWVzIG5leHRTbGlkZSgpIGhhcyBiZWVuIGNhbGxlZFxuICAgICAgICAvL3RoaXMuY3VycmVudFNsaWRlSW5kZXggaXMgYWx3YXlzIDwgdGhpcy5mdXJ0aGVzdFNsaWRlSW5kZXggLSBpZiBlcXVhbCwgd2UgcmVsZWFzZSB0aGUgcHJvbWlzZSBhbmQgbGV0IG5leHRTbGlkZSgpIHJldHVyblxuXG5cdFx0dGhpcy51bmRvU3RhY2sgPSBbXTtcblx0XHR0aGlzLnVuZG9TdGFja0luZGV4ID0gMDsgLy9pbmNyZWFzZWQgYnkgb25lIGV2ZXJ5IHRpbWUgZWl0aGVyIHRoaXMuVHJhbnNpdGlvblRvIGlzIGNhbGxlZCBvciB0aGlzLm5leHRTbGlkZSgpIGlzIGNhbGxlZFxuXG5cdFx0dGhpcy5sZWZ0QXJyb3cgPSBuZXcgRGlyZWN0aW9uQXJyb3coZmFsc2UpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5sZWZ0QXJyb3cuYXJyb3dJbWFnZSk7XG5cdFx0dGhpcy5sZWZ0QXJyb3cub25jbGlja0NhbGxiYWNrID0gZnVuY3Rpb24oKXt9IC8vdG9kbzogcHV0IHRoaXMgaW5cblxuICAgICAgICB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IGZ1bmN0aW9uKCl7fSAvL2lmIHlvdSBwcmVzcyByaWdodCBiZWZvcmUgdGhlIGZpcnN0IGRpcmVjdG9yLm5leHRTbGlkZSgpLCBkb24ndCBlcnJvclxuXG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgZnVuY3Rpb24ga2V5TGlzdGVuZXIoZSl7XG5cdCAgICBcdGlmKGUucmVwZWF0KXJldHVybjsgLy9rZXlkb3duIGZpcmVzIG11bHRpcGxlIHRpbWVzIGJ1dCB3ZSBvbmx5IHdhbnQgdGhlIGZpcnN0IG9uZVxuXHRcdFx0bGV0IHNsaWRlRGVsdGEgPSAwO1xuXHRcdFx0c3dpdGNoIChlLmtleUNvZGUpIHtcblx0XHRcdCAgY2FzZSAzNDpcblx0XHRcdCAgY2FzZSAzOTpcblx0XHRcdCAgY2FzZSA0MDpcblx0XHRcdFx0c2xpZGVEZWx0YSA9IDE7XG5cdFx0XHRcdGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDMzOlxuICAgICAgICAgICAgICBjYXNlIDM3OlxuICAgICAgICAgICAgICBjYXNlIDM4OlxuICAgICAgICAgICAgICAgIHNsaWRlRGVsdGEgPSAtMTtcblx0XHRcdCAgZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRpZihzbGlkZURlbHRhICE9IDApe1xuICAgICAgICAgICAgICAgIGlmKHNsaWRlRGVsdGEgPT0gMSl7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuaGFuZGxlRm9yd2FyZHNQcmVzcygpO1xuICAgICAgICAgICAgICAgIH1lbHNlIGlmKHNsaWRlRGVsdGEgPT0gLTEpe1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmhhbmRsZUJhY2t3YXJkc1ByZXNzKCk7XG4gICAgICAgICAgICAgICAgfVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBrZXlMaXN0ZW5lcik7XG5cdH1cblxuICAgIG1vdmVGdXJ0aGVySW50b1ByZXNlbnRhdGlvbigpe1xuICAgICAgICAgICAgLy93aGVuIG5vdCBpbiB0aGUgcGFzdCAoYW5kIHRoZXJlZm9yZSB3aXRoIG5vdGhpbmcgdG8gcmVkbyksIGFkdmFuY2UgZnVydGhlci5cbiAgICAgICAgICAgIC8vaWYgdGhlcmUgYXJlIGxlc3MgSFRNTCBzbGlkZXMgdGhhbiBjYWxscyB0byBkaXJlY3Rvci5uZXdTbGlkZSgpLCBjb21wbGFpbiBpbiB0aGUgY29uc29sZSBidXQgYWxsb3cgdGhlIHByZXNlbnRhdGlvbiB0byBwcm9jZWVkXG4gICAgICAgICAgICBpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4IDwgdGhpcy5udW1TbGlkZXMpe1xuICAgICAgICAgICAgICAgIHRoaXMudW5kb1N0YWNrSW5kZXggKz0gMTsgLy9hZHZhbmNlIHBhc3QgdGhlIE5ld1NsaWRlVW5kb0l0ZW1cbiAgICAgICAgICAgICAgICB0aGlzLmZ1cnRoZXN0U2xpZGVJbmRleCArPSAxOyBcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRTbGlkZUluZGV4ICs9IDE7IC8vc2hvdWxkIHN0aWxsIGVxdWFsIGZ1cnRoZXN0U2xpZGVJbmRleFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnNob3dTbGlkZSh0aGlzLmN1cnJlbnRTbGlkZUluZGV4KTsgLy90aGlzIHdpbGwgY29tcGxhaW4gaW4gdGhlIGNvbnNvbGUgd2luZG93IGlmIHRoZXJlIGFyZSBsZXNzIHNsaWRlcyB0aGFuIG5ld1NsaWRlKCkgY2FsbHNcbiAgICAgICAgICAgIHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uKCk7IC8vYWxsb3cgcHJlc2VudGF0aW9uIGNvZGUgdG8gcHJvY2VlZFxuICAgIH1cblxuICAgIGhhbmRsZUZvcndhcmRzUHJlc3MoKXtcbiAgICAgICAgaWYodGhpcy5mdXJ0aGVzdFNsaWRlSW5kZXggPT0gdGhpcy5jdXJyZW50U2xpZGVJbmRleCl7XG4gICAgICAgICAgICAvL3VucGF1c2UgY29kZSBleGVjdXRpb24gYW5kIHNob3cgbmV4dCBzbGlkZVxuICAgICAgICAgICAgdGhpcy5tb3ZlRnVydGhlckludG9QcmVzZW50YXRpb24oKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiB3ZSBnZXQgdG8gaGVyZSwgd2UndmUgcHJldmlvdXNseSBkb25lIGFuIHVuZG8gYW5kIHdlIG5lZWQgdG8gY2F0Y2ggdXBcblxuICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ICs9IDE7XG4gICAgICAgIHdoaWxlKHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdLmNvbnN0cnVjdG9yICE9PSBOZXdTbGlkZVVuZG9JdGVtKXtcbiAgICAgICAgICAgIC8vbG9vcCB0aHJvdWdoIHVuZG8gc3RhY2sgYW5kIHJlZG8gZWFjaCB1bmRvXG5cbiAgICAgICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPT0gdGhpcy51bmRvU3RhY2subGVuZ3RoKXtcbiAgICAgICAgICAgICAgICAvL2Z1bGx5IHVuZG9uZSBhbmQgYXQgY3VycmVudCBzbGlkZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL3JlZG8gdHJhbnNmb3JtYXRpb24gaW4gdGhpcy51bmRvU3RhY2tbdGhpcy51bmRvU3RhY2tJbmRleF1cbiAgICAgICAgICAgIGxldCByZWRvSXRlbSA9IHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdXG4gICAgICAgICAgICB2YXIgcmVkb0FuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24ocmVkb0l0ZW0udGFyZ2V0LCByZWRvSXRlbS50b1ZhbHVlcywgcmVkb0l0ZW0uZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogcmVkb0l0ZW0uZHVyYXRpb25NUy8xMDAwKTtcbiAgICAgICAgICAgIC8vYW5kIG5vdyByZWRvQW5pbWF0aW9uLCBoYXZpbmcgYmVlbiBjcmVhdGVkLCBnb2VzIG9mZiBhbmQgZG9lcyBpdHMgb3duIHRoaW5nIEkgZ3Vlc3MuIHRoaXMgc2VlbXMgaW5lZmZpY2llbnQuIHRvZG86IGZpeCB0aGF0IGFuZCBtYWtlIHRoZW0gYWxsIGNlbnRyYWxseSB1cGRhdGVkIGJ5IHRoZSBhbmltYXRpb24gbG9vcCBvcnNvbWV0aGluZ1xuXG4gICAgICAgICAgICB0aGlzLnVuZG9TdGFja0luZGV4ICs9IDE7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jdXJyZW50U2xpZGVJbmRleCArPSAxO1xuICAgICAgICB0aGlzLnNob3dTbGlkZSh0aGlzLmN1cnJlbnRTbGlkZUluZGV4KTtcbiAgICB9XG5cbiAgICBoYW5kbGVCYWNrd2FyZHNQcmVzcygpe1xuXG4gICAgICAgIGlmKHRoaXMudW5kb1N0YWNrSW5kZXggPT0gMCB8fCB0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IDApe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCAtPSAxO1xuICAgICAgICB3aGlsZSh0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XS5jb25zdHJ1Y3RvciAhPT0gTmV3U2xpZGVVbmRvSXRlbSl7XG4gICAgICAgICAgICAvL2xvb3AgdGhyb3VnaCB1bmRvIHN0YWNrIGFuZCByZWRvIGVhY2ggdW5kb1xuXG4gICAgICAgICAgICBpZih0aGlzLnVuZG9TdGFja0luZGV4ID09IDApe1xuICAgICAgICAgICAgICAgIC8vYXQgZmlyc3Qgc2xpZGVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy91bmRvIHRyYW5zZm9ybWF0aW9uIGluIHRoaXMudW5kb1N0YWNrW3RoaXMudW5kb1N0YWNrSW5kZXhdXG4gICAgICAgICAgICBsZXQgdW5kb0l0ZW0gPSB0aGlzLnVuZG9TdGFja1t0aGlzLnVuZG9TdGFja0luZGV4XTtcbiAgICAgICAgICAgIGxldCBkdXJhdGlvbiA9IHVuZG9JdGVtLmR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IDEgOiB1bmRvSXRlbS5kdXJhdGlvbk1TLzEwMDA7XG4gICAgICAgICAgICBkdXJhdGlvbiA9IE1hdGgubWluKGR1cmF0aW9uIC8gMiwgMSk7IC8vdW5kb2luZyBzaG91bGQgYmUgZmFzdGVyLCBzbyBjdXQgaXQgaW4gaGFsZiAtIGJ1dCBjYXAgZHVyYXRpb25zIGF0IDFzXG4gICAgICAgICAgICB2YXIgdW5kb0FuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24odW5kb0l0ZW0udGFyZ2V0LCB1bmRvSXRlbS5mcm9tVmFsdWVzLCBkdXJhdGlvbik7XG4gICAgICAgICAgICAvL2FuZCBub3cgdW5kb0FuaW1hdGlvbiwgaGF2aW5nIGJlZW4gY3JlYXRlZCwgZ29lcyBvZmYgYW5kIGRvZXMgaXRzIG93biB0aGluZyBJIGd1ZXNzLiB0aGlzIHNlZW1zIGluZWZmaWNpZW50LiB0b2RvOiBmaXggdGhhdCBhbmQgbWFrZSB0aGVtIGFsbCBjZW50cmFsbHkgdXBkYXRlZCBieSB0aGUgYW5pbWF0aW9uIGxvb3Agb3Jzb21ldGhpbmdcblxuICAgICAgICAgICAgdGhpcy51bmRvU3RhY2tJbmRleCAtPSAxO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY3VycmVudFNsaWRlSW5kZXggLT0gMTtcbiAgICAgICAgdGhpcy5zaG93U2xpZGUodGhpcy5jdXJyZW50U2xpZGVJbmRleCk7XG5cbiAgICB9XG5cblx0YXN5bmMgbmV4dFNsaWRlKCl7XG4gICAgICAgIC8qVGhlIHVzZXIgd2lsbCBjYWxsIHRoaXMgZnVuY3Rpb24gdG8gbWFyayB0aGUgdHJhbnNpdGlvbiBiZXR3ZWVuIG9uZSBzbGlkZSBhbmQgdGhlIG5leHQuIFRoaXMgZG9lcyB0d28gdGhpbmdzOlxuICAgICAgICBBKSB3YWl0cyB1bnRpbCB0aGUgdXNlciBwcmVzc2VzIHRoZSByaWdodCBhcnJvdyBrZXksIHJldHVybnMsIGFuZCBjb250aW51ZXMgZXhlY3V0aW9uIHVudGlsIHRoZSBuZXh0IG5leHRTbGlkZSgpIGNhbGxcbiAgICAgICAgQikgaWYgdGhlIHVzZXIgcHJlc3NlcyB0aGUgbGVmdCBhcnJvdyBrZXksIHRoZXkgY2FuIHVuZG8gYW5kIGdvIGJhY2sgaW4gdGltZSwgYW5kIGV2ZXJ5IFRyYW5zaXRpb25UbygpIGNhbGwgYmVmb3JlIHRoYXQgd2lsbCBiZSB1bmRvbmUgdW50aWwgaXQgcmVhY2hlcyBhIHByZXZpb3VzIG5leHRTbGlkZSgpIGNhbGwuIEFueSBub3JtYWwgamF2YXNjcmlwdCBhc3NpZ25tZW50cyB3b24ndCBiZSBjYXVnaHQgaW4gdGhpcyA6KFxuICAgICAgICBDKSBpZiB1bmRvXG4gICAgICAgICovXG4gICAgICAgIFxuICAgICAgICB0aGlzLnVuZG9TdGFjay5wdXNoKG5ldyBOZXdTbGlkZVVuZG9JdGVtKHRoaXMuY3VycmVudFNsaWRlSW5kZXgpKTtcblxuXG4gICAgICAgIGlmKCF0aGlzLmluaXRpYWxpemVkKXRocm93IG5ldyBFcnJvcihcIkVSUk9SOiBVc2UgLmJlZ2luKCkgb24gYSBEaXJlY3RvciBiZWZvcmUgY2FsbGluZyBhbnkgb3RoZXIgbWV0aG9kcyFcIik7XG5cblx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cblx0XHQvL3Byb21pc2UgaXMgcmVzb2x2ZWQgYnkgY2FsbGluZyB0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpIHdoZW4gdGhlIHRpbWUgY29tZXNcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHRcdHNlbGYubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gZnVuY3Rpb24oKXsgXG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHR9XG5cdFRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TKXtcblx0XHR2YXIgYW5pbWF0aW9uID0gbmV3IEFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDApO1xuXHRcdGxldCBmcm9tVmFsdWVzID0gYW5pbWF0aW9uLmZyb21WYWx1ZXM7XG5cdFx0dGhpcy51bmRvU3RhY2sucHVzaChuZXcgVW5kb0l0ZW0odGFyZ2V0LCB0b1ZhbHVlcywgZnJvbVZhbHVlcywgZHVyYXRpb25NUykpO1xuXHRcdHRoaXMudW5kb1N0YWNrSW5kZXgrKztcblx0fVxufVxuXG5cblxuY2xhc3MgVW5kb0l0ZW17XG5cdGNvbnN0cnVjdG9yKHRhcmdldCwgdG9WYWx1ZXMsIGZyb21WYWx1ZXMsIGR1cmF0aW9uTVMpe1xuXHRcdHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xuXHRcdHRoaXMudG9WYWx1ZXMgPSB0b1ZhbHVlcztcblx0XHR0aGlzLmZyb21WYWx1ZXMgPSBmcm9tVmFsdWVzO1xuXHRcdHRoaXMuZHVyYXRpb25NUyA9IGR1cmF0aW9uTVM7XG5cdH1cbn1cbmNsYXNzIE5ld1NsaWRlVW5kb0l0ZW17XG5cdGNvbnN0cnVjdG9yKHNsaWRlSW5kZXgpe1xuICAgICAgICB0aGlzLnNsaWRlSW5kZXggPSBzbGlkZUluZGV4O1xuXHR9XG59XG5cbmV4cG9ydCB7IE5vbkRlY3JlYXNpbmdEaXJlY3RvciwgRGlyZWN0aW9uQXJyb3csIFVuZG9DYXBhYmxlRGlyZWN0b3IgfTtcbiJdLCJuYW1lcyI6WyJNYXRoIiwidGhyZWVFbnZpcm9ubWVudCIsIm1hdGgubGVycFZlY3RvcnMiLCJyZXF1aXJlIiwicmVxdWlyZSQkMCIsInJlcXVpcmUkJDEiLCJyZXF1aXJlJCQyIiwiZ2xvYmFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Q0FBQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBOztDQUVBLE1BQU0sSUFBSTtDQUNWLENBQUMsV0FBVyxFQUFFO0NBQ2QsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztDQUNyQixFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0NBQ3JCLEtBQUs7Q0FDTCxDQUFD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QyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN0RyxJQUFJLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztDQUNsQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLElBQUk7Q0FDSixHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsQ0FBQztDQUNuQztDQUNBLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDNUMsSUFBSSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEcsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM3QyxLQUFLLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFD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OztFQUdaLElBQUksTUFBTSxHQUFHO0lBQ1gsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsQ0FBQztFQUNILFNBQVMsS0FBSyxDQUFDLE1BQU0sRUFBRTtHQUN0QixJQUFJLENBQUMsRUFBRSxNQUFNLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7R0FDdkMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUMvQixNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2Q7R0FDRCxPQUFPLE1B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QUksS0FBSyxVQUFVLEVBQUU7SUFDL0IsUUFBUSxHQUFHLElBQUksQ0FBQztJQUNoQixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ1Y7O0dBRUQsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7O0dBRWxCLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxJQUFJLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO0dBQy9DLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0dBQ3JELEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztHQUNwQixHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7O0dBRXBCLElBQUksR0FBRztJQUNOLFFBQVEsRUFBRSxRQUFRO0lBQ2xCLFFBQVEsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDNUIsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN0QixHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3RCLFFBQVEsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO0lBQ3JDLEtBQUssRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUM7SUFDM0IsUUFBUSxFQUFFLFVBQVU7SUFDcEIsSUFBSSxFQUFFLEdBQUc7SUFDVCxLQUFLLEVBQUUsU0FBUztJQUNoQixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssSUFBSSxFQUFFO0lBQ3ZCLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxJQUFJLEVBQUU7SUFDdkIsQ0FBQzs7O0dBR0YsUUFBUSxHQUFHLENBQUMsQ0FBQztHQUNiLE1BQU0s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QUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPQSxlQUFPLEVBQUUsVUFBVSxFQUFFQSxlQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxTQUFTLFlBQVksRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFVBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLEdBQUcsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsWUFBWSxLQUFLLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLG9CQUFtQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsK0NBQStDLENBQUMscUNBQXFDLENBQUMsa0RBQWtELENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE9BQU8sT0FBTyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxRQUFRLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLGdCQUFnQixDQUFDLFNBQVMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFDLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLFNBQVMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsVUFBVSxDQUFDLFNBQVMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsUUFBUSxDQUFDLFNBQVMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsUUFBUSxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxVQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxHQUFHLFlBQVksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFZLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixHQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsR0FBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFHLElBQUksRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBSyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssNEJBQTRCLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEFBQW1CLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBSyxDQUFDLENBQUMsT0FBTyxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxNQUFNLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFVLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLFdBQVcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLFNBQVMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsR0FBRyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLEVBQUUsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsTUFBTSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFDLENBQUMsVUFBVSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsQUFBd0IsSUFBSSxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxBQUFhLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLElBQUksY0FBYyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLFFBQVEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxRQUFRLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFTLENBQUMsU0FBUyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLFdBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTLENBQUMsT0FBTyxXQUFXLENBQUMsU0FBUyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBUyxDQUFDLFNBQVMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxFQUFFLFdBQVcsQ0FBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxhQUFhLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxRQUFRLEdBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxTQUFTLFdBQVcsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyw2RkFBNkYsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxRQUFRLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBQyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsVUFBVSxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksR0FBRyxHQUFHLEdBQUcsT0FBTyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxJQUFJLGFBQWEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsYUFBYSxDQUFDLEdBQUcsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsT0FBTyxTQUFTLEdBQUcsV0FBVyxFQUFFLFNBQVMsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyx3QkFBd0IsR0FBRyxXQUFXLEVBQUUsd0JBQXdCLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSx3QkFBd0IsRUFBRSxPQUFPLHFCQUFxQixHQUFHLFdBQVcsRUFBRSxxQkFBcUIsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLHFCQUFxQixDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQUssQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBTSxVQUFVLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLFNBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLFlBQVksRUFBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEdBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxNQUFLLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGdCQUFnQixHQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsT0FBTyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqOTVCOzs7O0FDRi9CLENBQUMsQ0FBQyxXQUFXOztBQUViLENBQTRFO0dBQzFFLElBQUksR0FBRyxHQUFHQyxHQUFtQixDQUFDO0dBQzlCLElBQUksUUFBUSxHQUFHQyxVQUF3QixDQUFDO0dBQ3hDLElBQUksR0FBRyxHQUFHQyxHQUFtQixDQUFDO0VBQy9COztDQUlELElBQUksV0FBVyxHQUFHO0NBQ2xCLFVBQVUsRUFBRSxJQUFJO0NBQ2hCLFFBQVEsRUFBRSxJQUFJO0VBQ2IsQ0FBQzs7Q0FFRixTQUFTLFdBQVcsQ0FBQyxLQUFLLEVBQUU7S0FDeEIsT0FBTyxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLE1BQU0sSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDO0lBQzFEOzs7Q0FPSCxJQUFJLFdBQVcsR0FBRyxDQUFDLEFBQStCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRO0dBQzVFLE9BQU87R0FDUCxTQUFTLENBQUM7OztDQUdaLElBQUksVUFBVSxHQUFHLENBQUMsQUFBOEIsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVE7R0FDeEUsTUFBTTtHQUNOLFNBQVMsQ0FBQzs7O0NBR1osSUFBSSxhQUFhLEdBQUcsQ0FBQyxVQUFVLElBQUksVUFBVSxDQUFDLE9BQU8sS0FBSyxXQUFXO0dBQ25FLFdBQVc7R0FDWCxTQUFTLENBQUM7OztDQUdaLElBQUksVUFBVSxHQUFHLFdBQVcsQ0FBQyxXQUFXLElBQUksVUFBVSxJQUFJLE9BQU9DLGNBQU0sSUFBSSxRQUFRLElBQUlBLGNBQU0sQ0FBQyxDQUFDOzs7Q0FHL0YsSUFBSSxRQUFRLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDOzs7Q0FHN0QsSUFBSSxVQUFVLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDOzs7Q0FHbkUsSUFBSSxVQUFVLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDOzs7Ozs7OztDQVEvRCxJQUFJLElBQUksR0FBRyxVQUFVO0VBQ3BCLENBQUMsVUFBVSxNQUFNLFVBQVUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLEtBQUssVUFBVSxDQUFDO0dBQ2hFLFFBQVEsSUFBSSxVQUFVLElBQUksUUFBUSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7O0NBRXRELElBQUksRUFBRSxJQUFJLElBQUksTUFBTSxFQUFFLEdBQUc7RUFDeEIsTUFBTSxDQUFDLEVBQUUsR0FBRyxVQUFVLEdBQUU7RUFDeEI7O0NBRUQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUU7RUFDeEMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFO0dBQzVELEtBQUssRUFBRSxVQUFVLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFOztLQUV4QyxJQUFJLE1BQU0sR0FBRyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1NBQzVELEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTTtTQUNuQixHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7O0tBRTlCLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUc7TUFDMUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7TUFDOUI7O0tBRUQsUUFBUSxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJLFdBQVcsQ0FBQyxFQUFFLEVBQUUsQ0FBQztJQUM1RDtHQUNELENBQUMsQ0FBQztFQUNIOzs7Ozs7Ozs7Ozs7OztDQWNELENBQUMsVUFBVTs7R0FFVCxJQUFJLGFBQWEsSUFBSSxNQUFNLElBQUksS0FBSyxFQUFFO09BQ2xDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQzNCOztHQUVELElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxZQUFZO0lBQ25DLE9BQU8sSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUM1QixDQUFDLENBQUM7O0dBRUgsSUFBSSxLQUFLLElBQUksTUFBTSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUM7O0tBRXZDLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQzs7S0FFM0IsSUFBSSxXQUFXLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDO09BQzNELFNBQVMsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLGdCQUFlO01BQy9DOztLQUVELE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxHQUFHLFNBQVMsR0FBRyxFQUFFO09BQ3JDLE9BQU8sSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQztPQUMvQjtJQUNGOztFQUVGLEdBQUcsQ0FBQzs7O0NBR0wsU0FBUyxHQUFHLEVBQUUsQ0FBQyxHQUFHO0VBQ2pCLE9BQU8sTUFBTSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUN2Qzs7O0NBR0QsSUFBSSxXQUFXLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQzs7Q0FFcEMsU0FBUyxJQUFJLEdBQUc7RUFDZixTQUFTLEVBQUUsR0FBRztHQUNiLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztHQUMzRTtFQUNELE9BQU8sRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDO0VBQ3JGOztDQUVELFNBQVMsY0FBYyxFQUFFLFFBQVEsR0FBRzs7RUFFbkMsSUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDOztFQUVuQixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQzs7RUFFekIsSUFBSSxDQUFDLEVBQUUsR0FBRyxTQUFTLEtBQUssRUFBRSxPQUFPLEVBQUU7O0dBRWxDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUM7O0dBRTNCLENBQUM7O0VBRUYsSUFBSSxDQUFDLElBQUksR0FBRyxTQUFTLEtBQUssRUFBRTs7R0FFM0IsSUFBSSxPQUFPLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0dBQy9CLElBQUksT0FBTyxFQUFFOztJQUVaLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7SUFFOUQ7O0dBRUQsQ0FBQzs7RUFFRixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxJQUFJLElBQUksSUFBSSxFQUFFLENBQUM7RUFDeEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7RUFDcEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7O0VBRW5COztDQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFVBQVUsRUFBRSxDQUFDO0NBQzlDLGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsRUFBRSxDQUFDO0NBQzdDLGNBQWMsQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLFVBQVUsRUFBRSxDQUFDO0NBQzVDLGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsRUFBRSxDQUFDO0NBQzdDLGNBQWMsQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLFVBQVUsRUFBRSxDQUFDO0NBQ2hELGNBQWMsQ0FBQyxTQUFTLENBQUMsYUFBYSxHQUFHLFVBQVUsRUFBRSxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUM7Q0FDcEUsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsV0FBVyxFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUUsZUFBZSxHQUFFLEdBQUU7O0NBRTdFLFNBQVMsWUFBWSxFQUFFLFFBQVEsR0FBRzs7RUFFakMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7O0VBRXRDLElBQUksQ0FBQyxTQUFTLEdBQUcsT0FBTTtFQUN2QixJQUFJLENBQUMsUUFBUSxHQUFHLG9CQUFtQjtFQUNuQyxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQzs7RUFFeEIsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFJO0VBQ2hCLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDOztFQUVmOztDQUVELFlBQVksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsU0FBUyxFQUFFLENBQUM7O0NBRW5FLFlBQVksQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFVBQVU7O0VBRXhDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQzs7RUFFZixDQUFDOztDQUVGLFlBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLFVBQVUsSUFBSSxHQUFHOztFQUU3QyxJQUFJLFVBQVUsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO0VBQ2xDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsV0FBVztHQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxVQUFVLEVBQUUsVUFBVSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7Ozs7R0FJaEcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0dBQ2IsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0dBQ1osQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7RUFDZixVQUFVLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7O0dBRW5DOztDQUVELFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsUUFBUSxHQUFHOztFQUVsRCxRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDOztHQUU3Qjs7Q0FFRCxZQUFZLENBQUMsU0FBUyxDQUFDLE9BQU8sR0FBRyxXQUFXOztFQUUzQyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7RUFDdEIsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7O0dBRWY7O0NBRUQsU0FBUyxZQUFZLEVBQUUsUUFBUSxHQUFHOztFQUVqQyxZQUFZLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQzs7RUFFcEMsSUFBSSxDQUFDLElBQUksR0FBRyxXQUFXLENBQUM7RUFDeEIsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUM7O0VBRTVCOztDQUVELFlBQVksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUM7O0NBRWpFLFlBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLFVBQVUsTUFBTSxHQUFHOztFQUUvQyxNQUFNLENBQUMsTUFBTSxFQUFFLFVBQVUsSUFBSSxHQUFHO0dBQy9CLFlBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7R0FDOUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRTs7R0FFM0I7O0NBRUQsU0FBUyxhQUFhLEVBQUUsUUFBUSxHQUFHOztFQUVsQyxZQUFZLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQzs7RUFFcEMsSUFBSSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUM7RUFDekIsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUM7RUFDNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLFFBQVEsQ0FBQyxPQUFPLEdBQUcsR0FBRyxNQUFNLEVBQUUsQ0FBQzs7RUFFaEQ7O0NBRUQsYUFBYSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLFlBQVksQ0FBQyxTQUFTLEVBQUUsQ0FBQzs7Q0FFbEUsYUFBYSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxNQUFNLEdBQUc7O0VBRWhELE1BQU0sQ0FBQyxNQUFNLEVBQUUsVUFBVSxJQUFJLEdBQUc7R0FDL0IsWUFBWSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQztHQUM5QyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLEdBQUU7O0dBRXpDOzs7Ozs7OztDQVFELFNBQVMsYUFBYSxFQUFFLFFBQVEsR0FBRzs7RUFFbEMsSUFBSSxNQUFNLEdBQUcsUUFBUSxDQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUUsQ0FBQztFQUNoRCxJQUFJLE1BQU0sQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxZQUFZLEVBQUU7R0FDbkUsT0FBTyxDQUFDLEdBQUcsRUFBRSxnREFBZ0QsR0FBRTtHQUMvRDs7RUFFRCxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQzs7RUFFdEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLFFBQVEsQ0FBQyxPQUFPLEdBQUcsR0FBRyxNQUFNLEVBQUUsQ0FBQzs7RUFFaEQsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFPO0VBQ3hCLElBQUksQ0FBQyxRQUFRLEdBQUcsYUFBWTtFQUM1QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7O0VBRWxDLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO0VBQ2pCLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDOztHQUViLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxVQUFVLENBQUM7S0FDaEMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO0tBQ3JCLFVBQVUsRUFBRSxJQUFJO0tBQ2hCLEVBQUUsRUFBRSxJQUFJO0tBQ1IsU0FBUyxFQUFFLFFBQVEsQ0FBQyxTQUFTO0VBQ2hDLENBQUMsQ0FBQzs7O0VBR0Y7O0NBRUQsYUFBYSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzs7Q0FFcEUsYUFBYSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsVUFBVSxNQUFNLEdBQUc7O0VBRWxELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQzs7R0FFZjs7Q0FFRCxhQUFhLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxVQUFVLE1BQU0sR0FBRzs7R0FFL0MsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7Ozs7RUFJbkMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksR0FBRztHQUN0SCxJQUFJLENBQUMsSUFBSSxFQUFFLFVBQVUsSUFBSSxHQUFHO0lBQzNCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxRQUFRLEdBQUcsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNoRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDaEUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2YsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ1osSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxHQUFHLFFBQVEsR0FBRyxHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2hFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNaLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFFO0dBQ2hCLE1BQU07R0FDTixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7R0FDWjs7R0FFRDs7Q0FFRCxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxVQUFVLFFBQVEsR0FBRzs7OztHQUlsRCxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQzs7Ozs7O0dBTTVDOztDQUVELGFBQWEsQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLFVBQVUsTUFBTSxHQUFHOztFQUVwRCxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQzs7R0FFakI7O0NBRUQsU0FBUyxxQkFBcUIsRUFBRSxRQUFRLEdBQUc7O0VBRTFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDOztFQUV0QyxRQUFRLENBQUMsT0FBTyxHQUFHLEVBQUUsUUFBUSxDQUFDLE9BQU8sR0FBRyxHQUFHLE1BQU0sRUFBRSxDQUFDOztFQUVwRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksWUFBWSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsQ0FBQztLQUMvQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsV0FBVztTQUNuQyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsR0FBRTtNQUN6QixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDO0tBQ2pCLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQUcsRUFBRSxJQUFJLEdBQUc7U0FDOUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztTQUN2QixLQUFLLEVBQUUsR0FBRzthQUNOLElBQUksQ0FBQyxRQUFRLEdBQUcsU0FBUyxDQUFDO2FBQzFCLEVBQUUsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUM7VUFDbkI7TUFDSixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDO0tBQ2pCLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxVQUFVLFFBQVEsR0FBRztTQUM5QyxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxHQUFHO2FBQzVCLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLFFBQVEsR0FBRTtVQUN2QztNQUNKLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUM7S0FDakIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLFVBQVUsSUFBSSxHQUFHO1NBQ3ZDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztNQUN4QyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDOztFQUVwQjs7Q0FFRCxxQkFBcUIsQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsU0FBUyxFQUFFLENBQUM7O0NBRTVFLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsV0FBVzs7RUFFbEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDOztFQUVwQyxDQUFDOztDQUVGLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxNQUFNLEdBQUc7O0VBRXhELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxDQUFDOztHQUUzQjs7Q0FFRCxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsUUFBUSxHQUFHOztLQUV4RCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztLQUN6QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDOztHQUV0Qjs7Q0FFRCxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsYUFBYSxHQUFHLFdBQVc7S0FDdkQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxDQUFDO0VBQ3ZDLENBQUM7Ozs7OztDQU1GLFNBQVMsZUFBZSxFQUFFLFFBQVEsR0FBRzs7RUFFcEMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7O0VBRXRDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUM7RUFDekMsSUFBSSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUM7RUFDekIsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUM7RUFDekIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7RUFDbkIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7RUFDMUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7O0VBRWpCOztDQUVELGVBQWUsQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsU0FBUyxFQUFFLENBQUM7O0NBRXRFLGVBQWUsQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLFVBQVUsTUFBTSxHQUFHOztFQUVsRCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRztHQUNsQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO0dBQ3JELElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxhQUFhLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0dBQ3RELElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUM7O0dBRTNCLElBQUksQ0FBQyxhQUFhLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQyxFQUFFO0lBQ2hELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6QixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQzs7R0FFZjtFQUNELElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQzs7R0FFWjs7Q0FFRCxlQUFlLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxVQUFVLFFBQVEsR0FBRzs7RUFFckQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLEdBQUc7R0FDekMsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLE1BQU0sR0FBRyxZQUFZLEVBQUUsQ0FBQyxDQUFDO0dBQzdELElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO0dBQ2pCLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQzs7R0FFakIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7O0VBRWYsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQzs7R0FFMUI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnRUQsU0FBUyxZQUFZLEVBQUUsUUFBUSxHQUFHOztFQUVqQyxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQzs7RUFFdEMsUUFBUSxDQUFDLE9BQU8sR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsT0FBTyxHQUFHLEVBQUUsR0FBRyxHQUFHLE1BQU0sRUFBRSxFQUFFLENBQUM7RUFDbEUsUUFBUSxDQUFDLE9BQU8sR0FBRyxRQUFRLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQzs7RUFFekMsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFNO0VBQ3ZCLElBQUksQ0FBQyxRQUFRLEdBQUcsWUFBVzs7SUFFekIsSUFBSSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsYUFBYSxFQUFFLFFBQVEsRUFBRSxDQUFDO0lBQ2pELElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDMUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7O0lBRXJCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUM7R0FDeEIsT0FBTyxFQUFFLFFBQVEsQ0FBQyxPQUFPO0dBQ3pCLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTztHQUN6QixZQUFZLEVBQUUsUUFBUSxDQUFDLFdBQVcsR0FBRyxlQUFlO0dBQ3BELEVBQUUsQ0FBQzs7S0FFRCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsVUFBVSxRQUFRLEdBQUc7U0FDOUMsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsR0FBRzthQUM1QixJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxRQUFRLEdBQUU7VUFDdkM7TUFDSixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDOztLQUVqQixJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxJQUFJLEdBQUc7U0FDekMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztTQUN2QixLQUFLLEVBQUUsR0FBRzthQUNOLElBQUksQ0FBQyxRQUFRLEdBQUcsU0FBUyxDQUFDO2FBQzFCLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQztVQUNkO01BQ0osQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQzs7RUFFcEI7O0NBRUQsWUFBWSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzs7Q0FFbkUsWUFBWSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxNQUFNLEdBQUc7O0VBRS9DLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHO0dBQ25CLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7R0FDL0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztHQUNqRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztHQUNwQjs7RUFFRCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDO0VBQ2pDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7RUFDbkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQzs7RUFFbkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztFQUM3RSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Ozs7Ozs7O0dBUVo7O0NBRUQsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsVUFBVSxRQUFRLEdBQUc7O0tBRS9DLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDOztFQUU1QixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDOztHQUV0Qjs7Q0FFRCxTQUFTLFFBQVEsRUFBRSxRQUFRLEdBQUc7O0VBRTdCLElBQUksU0FBUyxHQUFHLFFBQVEsSUFBSSxFQUFFO0dBQzdCLEFBQ0EsUUFBUTtHQUNSLFFBQVE7R0FDUixLQUFLO0dBQ0wsVUFBVTtHQUNWLGdCQUFnQjtHQUNoQixxQkFBcUI7R0FDckIsS0FBSztTQUNDLFFBQVE7R0FDZCxTQUFTLEdBQUcsRUFBRTtHQUNkLFVBQVUsR0FBRyxFQUFFO0dBQ2YsV0FBVyxHQUFHLENBQUM7R0FDZix1QkFBdUIsR0FBRyxDQUFDO0dBQzNCLEFBQ0EsK0JBQStCLEdBQUcsRUFBRTtHQUNwQyxVQUFVLEdBQUcsS0FBSztTQUNaLFNBQVMsR0FBRyxFQUFFLENBQUM7O0VBRXRCLFNBQVMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUM7RUFDaEQsU0FBUyxDQUFDLGdCQUFnQixHQUFHLENBQUMsS0FBSyxTQUFTLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxFQUFFLENBQUM7RUFDckUsUUFBUSxHQUFHLFNBQVMsQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDO0VBQ3RDLFFBQVEsR0FBRyxTQUFTLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQztFQUN0QyxTQUFTLENBQUMsSUFBSSxHQUFHLE1BQU0sR0FBRyxTQUFTLENBQUMsU0FBUyxFQUFFO0VBQy9DLFNBQVMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUM7RUFDL0MsU0FBUyxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQztFQUNqRCxTQUFTLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDOztFQUUvQyxJQUFJLFlBQVksR0FBRyxRQUFRLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDO0VBQ25ELFlBQVksQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQztFQUN6QyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxFQUFDO0VBQ3BELFlBQVksQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQztFQUM3QyxZQUFZLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxZQUFXO0VBQzNDLFlBQVksQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLE9BQU07RUFDcEMsWUFBWSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBSztFQUNsQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7RUFDakMsWUFBWSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsT0FBTTtFQUNsQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsWUFBWSxFQUFFLENBQUM7O0VBRWxFLElBQUksZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUUsQ0FBQztFQUMxRCxJQUFJLGFBQWEsR0FBRyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLENBQUM7RUFDeEQsSUFBSSxnQkFBZ0IsQ0FBQztFQUNyQixJQUFJLFNBQVMsQ0FBQzs7RUFFZCxJQUFJLEVBQUUsaUJBQWlCLEdBQUcsU0FBUyxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQzs7S0FFL0MsSUFBSSxTQUFTLEdBQUc7R0FDbEIsR0FBRyxFQUFFLFlBQVk7R0FDakIsSUFBSSxFQUFFLGFBQWE7R0FDbkIsWUFBWSxFQUFFLHFCQUFxQjtHQUNuQyxHQUFHLEVBQUUsWUFBWTtHQUNqQixHQUFHLEVBQUUsYUFBYTtHQUNsQixvQkFBb0IsRUFBRSxlQUFlO01BQ2xDLENBQUM7O0tBRUYsSUFBSSxJQUFJLEdBQUcsU0FBUyxFQUFFLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztLQUN6QyxLQUFLLENBQUMsSUFBSSxHQUFHO0dBQ2YsTUFBTSx3REFBd0QsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztNQUNoRztLQUNELFFBQVEsR0FBRyxJQUFJLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQztLQUNqQyxRQUFRLENBQUMsSUFBSSxHQUFHLE1BQUs7O0VBRXhCLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0tBQzlCLFFBQVEsQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDOztLQUVuQyxJQUFJLGFBQWEsSUFBSSxNQUFNLElBQUksS0FBSyxFQUFFO01BQ3JDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO01BQ3hCOztFQUVKLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxZQUFZO0dBQ25DLE9BQU8sSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztHQUM1QixDQUFDLENBQUM7O0VBRUgsSUFBSSxLQUFLLElBQUksTUFBTSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUM7O0dBRXhDLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQzs7R0FFM0IsSUFBSSxXQUFXLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDO0lBQzVELFNBQVMsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLGdCQUFlO0lBQzlDOztHQUVELE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxHQUFHLFNBQVMsR0FBRyxFQUFFO0lBQ3RDLE9BQU8sSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQztLQUM5QjtHQUNEOztFQUVELElBQUksY0FBYyxHQUFHLE1BQU0sQ0FBQyxVQUFVO0dBQ3JDLGVBQWUsR0FBRyxNQUFNLENBQUMsV0FBVztPQUNoQyxpQkFBaUIsR0FBRyxNQUFNLENBQUMsYUFBYTtHQUM1QyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsWUFBWTtHQUN0Qyx5QkFBeUIsR0FBRyxNQUFNLENBQUMscUJBQXFCO0dBQ3hELE9BQU8sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUc7R0FDekIsa0JBQWtCLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHO0dBQzNDLFdBQVcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUM7OztFQUc3QyxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7O0VBRWYsU0FBUyxLQUFLLEdBQUc7O0dBRWhCLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxDQUFDOztHQUV6QixVQUFVLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztHQUMvQixLQUFLLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUM7R0FDekMscUJBQXFCLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztHQUNqRCxnQkFBZ0IsR0FBRyxxQkFBcUIsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDOztHQUUvRCxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEdBQUcsVUFBVTtJQUN6QyxPQUFPLEtBQUssQ0FBQztJQUNiLENBQUM7R0FDRixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxXQUFXO0lBQzVCLE9BQU8sS0FBSyxDQUFDO0lBQ2IsQ0FBQzs7R0FFRixNQUFNLENBQUMsVUFBVSxHQUFHLFVBQVUsUUFBUSxFQUFFLElBQUksR0FBRztJQUM5QyxJQUFJLENBQUMsR0FBRztLQUNQLFFBQVEsRUFBRSxRQUFRO0tBQ2xCLElBQUksRUFBRSxJQUFJO0tBQ1YsV0FBVyxFQUFFLEtBQUssR0FBRyxJQUFJO0tBQ3pCLENBQUM7SUFDRixTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ3BCLElBQUksRUFBRSxpQkFBaUIsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7YUFDMUIsT0FBTyxDQUFDLENBQUM7SUFDbEIsQ0FBQztHQUNGLE1BQU0sQ0FBQyxZQUFZLEdBQUcsVUFBVSxFQUFFLEdBQUc7SUFDcEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEdBQUc7S0FDM0MsSUFBSSxTQUFTLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHO01BQzFCLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO01BQ3pCLElBQUksRUFBRSxpQkFBaUIsRUFBRSxDQUFDO01BQzFCLFNBQVM7TUFDVDtLQUNEO0lBQ0QsQ0FBQztHQUNGLE1BQU0sQ0FBQyxXQUFXLEdBQUcsVUFBVSxRQUFRLEVBQUUsSUFBSSxHQUFHO0lBQy9DLElBQUksQ0FBQyxHQUFHO0tBQ1AsUUFBUSxFQUFFLFFBQVE7S0FDbEIsSUFBSSxFQUFFLElBQUk7S0FDVixXQUFXLEVBQUUsS0FBSyxHQUFHLElBQUk7S0FDekIsQ0FBQztJQUNGLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7SUFDckIsSUFBSSxFQUFFLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNwQyxPQUFPLENBQUMsQ0FBQztJQUNULENBQUM7R0FDRixNQUFNLENBQUMsYUFBYSxHQUFHLFVBQVUsRUFBRSxHQUFHO0lBQ3JDLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxDQUFDO0lBQ3pCLE9BQU8sSUFBSSxDQUFDO0lBQ1osQ0FBQztHQUNGLE1BQU0sQ0FBQyxxQkFBcUIsR0FBRyxVQUFVLFFBQVEsR0FBRztJQUNuRCwrQkFBK0IsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7SUFDakQsQ0FBQztHQUNGLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxHQUFHLFVBQVU7SUFDbEMsT0FBTyxnQkFBZ0IsQ0FBQztJQUN4QixDQUFDOztHQUVGLFNBQVMsZUFBZSxHQUFHO0lBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHO0tBQ25CLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0tBQ3BCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQUM7S0FDekMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0tBQ2IsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQztLQUNuQjtJQUNELE9BQU8sSUFBSSxDQUFDLFdBQVcsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDO0lBQzlDO0dBRUQsSUFBSTtJQUNILE1BQU0sQ0FBQyxjQUFjLEVBQUUsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLGFBQWEsRUFBRSxFQUFFLEdBQUcsRUFBRSxlQUFlLEVBQUUsR0FBRTtJQUM1RixNQUFNLENBQUMsY0FBYyxFQUFFLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsRUFBRSxHQUFHLEVBQUUsZUFBZSxFQUFFLEdBQUU7SUFDNUYsQ0FBQyxPQUFPLEdBQUcsRUFBRTtJQUNiLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNWOztHQUVEOztFQUVELFNBQVMsTUFBTSxHQUFHO0dBQ2pCLEtBQUssRUFBRSxDQUFDO0dBQ1IsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO0dBQ2pCLFVBQVUsR0FBRyxJQUFJLENBQUM7R0FDbEI7O0VBRUQsU0FBUyxLQUFLLEdBQUc7R0FDaEIsVUFBVSxHQUFHLEtBQUssQ0FBQztHQUNuQixRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7R0FDaEIsUUFBUSxFQUFFLENBQUM7R0FDWDs7RUFFRCxTQUFTLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHO0dBQ3ZCLGNBQWMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0dBQzNCOztFQUVELFNBQVMsS0FBSyxHQUFHOztHQUVoQixLQUFLLEVBQUUsUUFBUSxFQUFFLENBQUM7R0FDbEI7O0VBRUQsU0FBUyxRQUFRLEdBQUc7R0FDbkIsSUFBSSxFQUFFLGVBQWUsRUFBRSxDQUFDO0dBQ3hCLE1BQU0sQ0FBQyxVQUFVLEdBQUcsY0FBYyxDQUFDO0dBQ25DLE1BQU0sQ0FBQyxXQUFXLEdBQUcsZUFBZSxDQUFDO0dBQ3JDLE1BQU0sQ0FBQyxhQUFhLEdBQUcsaUJBQWlCLENBQUM7R0FDekMsTUFBTSxDQUFDLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQztHQUN2QyxNQUFNLENBQUMscUJBQXFCLEdBQUcseUJBQXlCLENBQUM7R0FDekQsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLFdBQVcsQ0FBQztHQUM1QyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUM7R0FDMUIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEdBQUcsa0JBQWtCLENBQUM7R0FDNUM7O0VBRUQsU0FBUyxXQUFXLEdBQUc7R0FDdEIsSUFBSSxPQUFPLEdBQUcsV0FBVyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUM7R0FDaEQsSUFBSSxFQUFFLFNBQVMsQ0FBQyxVQUFVLElBQUksV0FBVyxJQUFJLFNBQVMsQ0FBQyxVQUFVLFFBQVEsU0FBUyxDQUFDLFNBQVMsSUFBSSxPQUFPLElBQUksU0FBUyxDQUFDLFNBQVMsRUFBRSxHQUFHO0lBQ2xJLEtBQUssRUFBRSxDQUFDO0lBQ1IsS0FBSyxFQUFFLENBQUM7SUFDUjtHQUNELElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDO0dBQ3pCLENBQUMsQ0FBQyxVQUFVLEVBQUUsT0FBTyxFQUFFLENBQUM7R0FDeEIsSUFBSSxTQUFTLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxHQUFHO0lBQ3BDLFlBQVksQ0FBQyxXQUFXLEdBQUcsV0FBVyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxHQUFHLFdBQVcsR0FBRyxXQUFXLEdBQUcsdUJBQXVCLEdBQUcsWUFBWSxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQzFLLE1BQU07SUFDTixZQUFZLENBQUMsV0FBVyxHQUFHLFdBQVcsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLEtBQUssR0FBRyxXQUFXLEdBQUcsWUFBWSxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ2xJO0dBQ0Q7O0VBRUQsU0FBUyxXQUFXLEVBQUUsTUFBTSxHQUFHOztHQUU5QixJQUFJLGdCQUFnQixDQUFDLEtBQUssS0FBSyxNQUFNLENBQUMsS0FBSyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsTUFBTSxHQUFHO0lBQzFGLGdCQUFnQixDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQ3RDLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ3hDLGdCQUFnQixHQUFHLElBQUksV0FBVyxFQUFFLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxnQkFBZ0IsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUM7SUFDM0YsYUFBYSxDQUFDLFNBQVMsR0FBRyxLQUFJO0lBQzlCLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDaEY7O0dBRUQ7O0VBRUQsU0FBUyxXQUFXLEVBQUUsTUFBTSxHQUFHOzs7O0dBSTlCLGFBQWEsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztHQUN4QyxTQUFTLEdBQUcsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztHQUNoRyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUc7SUFDcEQsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQztJQUM3QyxnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7SUFDckQsZ0JBQWdCLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQ3JEO0dBQ0QsdUJBQXVCLEVBQUUsQ0FBQzs7R0FFMUI7O0VBRUQsU0FBUyxVQUFVLEVBQUU7O0dBRXBCLElBQUksSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUM7R0FDMUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHO0lBQ3BELElBQUksRUFBRSxDQUFDLEVBQUUsR0FBRyxnQkFBZ0IsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDLGdCQUFnQixDQUFDO0lBQ25FLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsZ0JBQWdCLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7SUFDM0UsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQztJQUMzRTtHQUNELGFBQWEsQ0FBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztHQUM5QyxRQUFRLENBQUMsR0FBRyxFQUFFLGdCQUFnQixFQUFFLENBQUM7R0FDakMsV0FBVyxFQUFFLENBQUM7R0FDZCx1QkFBdUIsR0FBRyxDQUFDLENBQUM7R0FDNUIsSUFBSSxFQUFFLGlCQUFpQixHQUFHLFdBQVcsR0FBRyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7R0FDdkQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHO0lBQ3BELGdCQUFnQixFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUMxQixnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzlCLGdCQUFnQixFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDOUI7R0FDRCxFQUFFLEVBQUUsQ0FBQzs7R0FFTDs7RUFFRCxTQUFTLFFBQVEsRUFBRSxNQUFNLEdBQUc7O0dBRTNCLElBQUksVUFBVSxHQUFHOztJQUVoQixJQUFJLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLEdBQUc7O0tBRXBDLFdBQVcsRUFBRSxNQUFNLEVBQUUsQ0FBQztLQUN0QixXQUFXLEVBQUUsTUFBTSxFQUFFLENBQUM7O0tBRXRCLElBQUksdUJBQXVCLElBQUksRUFBRSxHQUFHLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRztNQUNoRSxVQUFVLEVBQUUsQ0FBQztNQUNiLE1BQU07TUFDTixLQUFLLEVBQUUsQ0FBQztNQUNSOztLQUVELE1BQU07S0FDTixRQUFRLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxDQUFDO0tBQ3ZCLFdBQVcsRUFBRSxDQUFDO0tBQ2QsSUFBSSxFQUFFLGNBQWMsR0FBRyxXQUFXLEVBQUUsQ0FBQztLQUNyQzs7SUFFRDs7R0FFRDs7RUFFRCxTQUFTLFFBQVEsR0FBRzs7R0FFbkIsSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUM7R0FDdEMsSUFBSSxFQUFFLEdBQUcsRUFBRSxXQUFXLEdBQUcsdUJBQXVCLEdBQUcsU0FBUyxDQUFDLGdCQUFnQixLQUFLLElBQUksQ0FBQzs7R0FFdkYsS0FBSyxHQUFHLFVBQVUsR0FBRyxFQUFFLENBQUM7R0FDeEIsZ0JBQWdCLEdBQUcscUJBQXFCLEdBQUcsRUFBRSxDQUFDOztHQUU5QyxLQUFLLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxHQUFHO0lBQzVCLENBQUMsQ0FBQyxXQUFXLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztJQUMxQixFQUFFLENBQUM7O0dBRUosV0FBVyxFQUFFLENBQUM7R0FDZCxJQUFJLEVBQUUsU0FBUyxHQUFHLFdBQVcsR0FBRyxHQUFHLEdBQUcsdUJBQXVCLEVBQUUsQ0FBQzs7R0FFaEUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEdBQUc7SUFDM0MsSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLFdBQVcsR0FBRztLQUN6QyxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsR0FBRTs7S0FFaEMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7S0FDekIsU0FBUztLQUNUO0lBQ0Q7O0dBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEdBQUc7SUFDNUMsSUFBSSxLQUFLLElBQUksVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLFdBQVcsR0FBRztLQUMxQyxLQUFLLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDO0tBQ2xDLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxXQUFXLElBQUksVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQzs7S0FFcEQsU0FBUztLQUNUO0lBQ0Q7O0dBRUQsK0JBQStCLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxHQUFHO1FBQ25ELEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxHQUFHLFdBQVcsRUFBRSxDQUFDO1VBQy9CLEVBQUUsQ0FBQztTQUNKLCtCQUErQixHQUFHLEVBQUUsQ0FBQzs7R0FFM0M7O0VBRUQsU0FBUyxLQUFLLEVBQUUsUUFBUSxHQUFHOztHQUUxQixJQUFJLENBQUMsUUFBUSxHQUFHO0lBQ2YsUUFBUSxHQUFHLFVBQVUsSUFBSSxHQUFHO0tBQzNCLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztLQUM1RSxPQUFPLEtBQUssQ0FBQztNQUNiO0lBQ0Q7R0FDRCxRQUFRLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDOztHQUUxQjs7RUFFRCxTQUFTLElBQUksRUFBRSxPQUFPLEdBQUc7R0FDeEIsSUFBSSxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsQ0FBQztHQUN0Qzs7S0FFRSxTQUFTLEdBQUcsRUFBRSxLQUFLLEVBQUUsT0FBTyxHQUFHOztTQUUzQixTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDOztNQUU5Qjs7S0FFRCxTQUFTLEtBQUssRUFBRSxLQUFLLEdBQUc7O1NBRXBCLElBQUksT0FBTyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUMvQixLQUFLLE9BQU8sR0FBRzs7YUFFWCxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7O1VBRXJFOztNQUVKOztLQUVELFNBQVMsU0FBUyxFQUFFLFFBQVEsR0FBRzs7U0FFM0IsS0FBSyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsQ0FBQzs7TUFFakM7O0VBRUosT0FBTztHQUNOLEtBQUssRUFBRSxNQUFNO0dBQ2IsT0FBTyxFQUFFLFFBQVE7R0FDakIsSUFBSSxFQUFFLEtBQUs7R0FDWCxJQUFJLEVBQUUsS0FBSztTQUNMLEVBQUUsRUFBRSxHQUFHO0dBQ2I7RUFDRDs7Q0FFRCxDQUFDLFVBQVUsSUFBSSxRQUFRLElBQUksRUFBRSxFQUFFLFFBQVEsR0FBRyxRQUFRLENBQUM7OztHQUdqRCxBQVFLLElBQUksV0FBVyxJQUFJLFVBQVUsRUFBRTs7S0FFbEMsSUFBSSxhQUFhLEVBQUU7TUFDbEIsQ0FBQyxVQUFVLENBQUMsT0FBTyxHQUFHLFFBQVEsRUFBRSxRQUFRLEdBQUcsUUFBUSxDQUFDO01BQ3BEOztLQUVELFdBQVcsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0VBQ25DO01BQ0k7O0tBRUQsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7RUFDNUI7O0VBRUEsRUFBRSxFQUFFOzs7Q0NwOUJMO0NBQ0E7Q0FDQTtDQUNBOztDQUVBLElBQUksUUFBUSxHQUFHOztDQUVmLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsd0JBQXdCO0NBQzNDLENBQUMsS0FBSyxFQUFFLEVBQUUsWUFBWTs7Q0FFdEIsRUFBRSxJQUFJOztDQUVOLEdBQUcsSUFBSSxNQUFNLEdBQUcsUUFBUSxDQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxxQkFBcUIsTUFBTSxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRSxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsb0JBQW9CLEVBQUUsRUFBRSxFQUFFLENBQUM7O0NBRWhMLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRzs7Q0FFaEIsR0FBRyxPQUFPLEtBQUssQ0FBQzs7Q0FFaEIsR0FBRzs7Q0FFSCxFQUFFLElBQUk7Q0FDTixDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU07Q0FDMUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsVUFBVSxJQUFJLE1BQU0sQ0FBQyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUk7O0NBRTVFLENBQUMsb0JBQW9CLEVBQUUsWUFBWTs7Q0FFbkMsRUFBRSxJQUFJLE9BQU8sR0FBRyxRQUFRLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDO0NBQ2hELEVBQUUsT0FBTyxDQUFDLEVBQUUsR0FBRyxxQkFBcUIsQ0FBQztDQUNyQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLFdBQVcsQ0FBQztDQUN6QyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQztDQUNsQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLFFBQVEsQ0FBQztDQUN0QyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztDQUNyQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQztDQUNwQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQztDQUMvQixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztDQUNsQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztDQUMvQixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQztDQUNoQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQzs7Q0FFdEMsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRzs7Q0FFdEIsR0FBRyxPQUFPLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxxQkFBcUIsR0FBRztDQUN0RCxJQUFJLHdKQUF3SjtDQUM1SixJQUFJLHFGQUFxRjtDQUN6RixJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFHO0NBQ3BCLElBQUksaUpBQWlKO0NBQ3JKLElBQUkscUZBQXFGO0NBQ3pGLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7O0NBRWxCLEdBQUc7O0NBRUgsRUFBRSxPQUFPLE9BQU8sQ0FBQzs7Q0FFakIsRUFBRTs7Q0FFRixDQUFDLGtCQUFrQixFQUFFLFdBQVcsVUFBVSxHQUFHOztDQUU3QyxFQUFFLElBQUksTUFBTSxFQUFFLEVBQUUsRUFBRSxPQUFPLENBQUM7O0NBRTFCLEVBQUUsVUFBVSxHQUFHLFVBQVUsSUFBSSxFQUFFLENBQUM7O0NBRWhDLEVBQUUsTUFBTSxHQUFHLFVBQVUsQ0FBQyxNQUFNLEtBQUssU0FBUyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztDQUMvRSxFQUFFLEVBQUUsR0FBRyxVQUFVLENBQUMsRUFBRSxLQUFLLFNBQVMsR0FBRyxVQUFVLENBQUMsRUFBRSxHQUFHLE9BQU8sQ0FBQzs7Q0FFN0QsRUFBRSxPQUFPLEdBQUcsUUFBUSxDQUFDLG9CQUFvQixFQUFFLENBQUM7Q0FDNUMsRUFBRSxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQzs7Q0FFbEIsRUFBRSxNQUFNLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxDQUFDOztDQUVoQyxFQUFFOztDQUVGLENBQUMsQ0FBQzs7Q0N2RUY7QUFDQSxBQU9BO0NBQ0EsU0FBUyxtQkFBbUIsQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDO0NBQ3BELENBQUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUM7Q0FDeEIsSUFBSSxJQUFJLENBQUMscUJBQXFCLElBQUksZUFBZSxLQUFLLElBQUksQ0FBQyxDQUFDOztDQUU1RCxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDOztDQUVsRCxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUM7Q0FDNUMsRUFBRSxJQUFJLEVBQUUsRUFBRTtDQUNWLEVBQUUsR0FBRyxFQUFFLEtBQUs7O0NBRVo7Q0FDQSxFQUFFLEdBQUcsRUFBRSxFQUFFO0NBQ1QsRUFBRSxNQUFNLEVBQUUsQ0FBQztDQUNYO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLElBQUksQ0FBQyxDQUFDOztDQUVOLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsQ0FBQztDQUN4Rzs7Q0FFQSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0NBQ3BDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7O0NBRzlDO0NBQ0E7OztDQUdBO0NBQ0EsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO0NBQ2hDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDOztDQUU3QjtDQUNBLENBQUMsSUFBSSxlQUFlLEdBQUcsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7O0NBRTFDLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLEtBQUssQ0FBQyxhQUFhLEVBQUUsZUFBZSxFQUFFLENBQUM7Q0FDNUQsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztDQUN4RCxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQzs7O0NBRzdELElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO0NBQzFCO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQSxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0NBQ3BCLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7Q0FDdEIsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQzs7Q0FFMUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxRQUFRLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxHQUFHLGVBQWUsQ0FBQztDQUNqRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUM7O0NBRXhELENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDO0NBQzlGLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDO0NBQzFGLENBQUMsSUFBSSxD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QyxDQUFDOztDQUVaO0NBQ0E7Q0FDQSxJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUM7O0NBRXZCO0NBQ0EsSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNwQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUMsS0FBSyxJQUFJO0NBQ1Q7Q0FDQSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUMsS0FBSyxjQUFjLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDMUIsS0FBSzs7Q0FFTDtDQUNBLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLEtBQUssSUFBSTtDQUNUO0NBQ0EsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVDLEtBQUssY0FBYyxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQzFCLEtBQUs7O0NBRUw7Q0FDQTtDQUNBLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNsSjtDQUNBLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7Q0FFbEo7Q0FDQSxJQUFJLFNBQVMsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDO0NBQzFELElBQUksU0FBUyxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsQ0FBQztDQUM3QztDQUNBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO0NBQ3BFLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQztDQUN0RSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7Q0FDdEUsSUFBSTtDQUNKLEdBQUc7Q0FDSDtDQUNBLEVBQUU7Q0FDRixJQUFJLG1CQUFtQixFQUFFO0NBQ3pCLFFBQVFBLHdCQUFnQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ2pELEtBQUs7Q0FDTCxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQztDQUNqQjtDQUNBO0NBQ0EsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztDQUN0QixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDdEQsRUFBRTtDQUNGLENBQUMsSUFBSSxLQUFLLEVBQUU7Q0FDWixFQUFFLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztDQUNyQixFQUFFO0NBQ0YsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUM7Q0FDckIsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7Q0FDbEMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsR0FBRyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0NBQzFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEdBQUcsT0FBTyxHQUFHLENBQUMsQ0FBQztDQUN0QyxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO0NBQzFCLFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQztDQUMvQyxFQUFFO0NBQ0YsQ0FBQyxJQUFJLE9BQU8sRUFBRTtDQUNkLEVBQUUsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO0NBQ3ZCLEVBQUU7Q0FDRixDQUFDLEtBQUssRUFBRTtDQUNSLEVBQUUsT0FBTyxJQUFJLGFBQWEsQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztDQUN2RSxFQUFFO0NBQ0YsQ0FBQzs7Q0NqUkQsSUFBSSxtQkFBbUIsR0FBRyw0cEZBQTRwRixDQUFDOztDQ2lCdnJGLE1BQU0sY0FBYztDQUNwQixDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUM7Q0FDdkIsRUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7Q0FDaEMsUUFBUSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsR0FBRyxtQkFBbUIsQ0FBQzs7Q0FFbEQsUUFBUSxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7O0NBRW5ELEVBQUUsU0FBUyxHQUFHLFNBQVMsR0FBRyxTQUFTLEdBQUcsSUFBSSxHQUFHLFNBQVMsQ0FBQzs7Q0FFdkQsRUFBRSxHQUFHLFNBQVMsQ0FBQztDQUNmLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFDO0NBQ25ELEdBQUcsSUFBSTtDQUNQLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFDO0NBQ2xELEdBQUc7Q0FDSCxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxHQUFHLENBQUMsVUFBVTtDQUN2QyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztDQUNsQixHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOztDQUVoQixFQUFFLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDO0NBQzlCLEVBQUU7Q0FDRixDQUFDLE9BQU8sRUFBRTtDQUNWLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0NBQ2xCLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO0NBQ3pCLEVBQUU7Q0FDRixDQUFDLFFBQVEsRUFBRTtDQUNYLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztDQUMzQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7Q0FDcEM7Q0FDQSxFQUFFO0NBQ0YsQ0FBQyxRQUFRLEVBQUU7Q0FDWCxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7Q0FDcEMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDO0NBQy9DLEVBQUU7Q0FDRixDQUFDOzs7Q0FHRCxNQUFNLHFCQUFxQjtDQUMzQjtDQUNBLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQztDQUNyQixFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO0NBQ25CLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQztDQUM3QixRQUFRLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDOztDQUUzQixFQUFFLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxJQUFJLENBQUM7Q0FDdkMsUUFBUSxJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztDQUNqQyxFQUFFOzs7Q0FHRixDQUFDLE1BQU0sS0FBSyxFQUFFO0NBQ2QsRUFBRSxNQUFNLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztDQUMvQixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDLHNCQUFzQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0NBQ25FLFFBQVEsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQzs7Q0FFNUM7Q0FDQSxFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ25DLFlBQVksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztDQUM3QyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7Q0FDekMsR0FBRztDQUNILEVBQUUsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDO0NBQ2xCO0NBQ0EsUUFBUSxNQUFNLENBQUMsVUFBVSxDQUFDLFVBQVU7Q0FDcEMsTUFBTSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDM0MsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO0NBQ3pDLE9BQU87Q0FDUCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7O0NBRWIsUUFBUSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDOztDQUUxQixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxjQUFjLEVBQUUsQ0FBQztDQUN6QyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7Q0FDeEQsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsR0FBRyxVQUFVO0NBQzlDLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQztDQUN0QyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUtBQW1LLEVBQUM7Q0FDcEwsR0FBRyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztDQUNuQyxJQUFHOztDQUVILFFBQVEsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7O0NBRWhDLEVBQUU7O0NBRUYsQ0FBQyxNQUFNLGVBQWUsRUFBRTtDQUN4QixFQUFFLE9BQU8sSUFBSSxPQUFPLENBQUMsU0FBUyxPQUFPLEVBQUUsTUFBTSxDQUFDO0NBQzlDLFlBQVksR0FBRyxRQUFRLENBQUMsVUFBVSxJQUFJLFVBQVUsQ0FBQztDQUNqRCxnQkFBZ0IsT0FBTyxFQUFFLENBQUM7Q0FDMUIsYUFBYTtDQUNiLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0NBQ3ZELEdBQUcsQ0FBQyxDQUFDO0NBQ0wsRUFBRTs7Q0FFRixDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUM7Q0FDdkIsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUNuQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0NBQ3hELEdBQUc7Q0FDSCxRQUFRLEdBQUcsV0FBVyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUM7Q0FDekMsWUFBWSxPQUFPLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLFdBQVcsQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyw0REFBNEQsQ0FBQyxDQUFDO0NBQzdKLFlBQVksT0FBTztDQUNuQixTQUFTO0NBQ1QsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0NBQzdDLEVBQUU7O0NBRUYsQ0FBQyxNQUFNLFNBQVMsRUFBRTtDQUNsQixRQUFRLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMscUVBQXFFLENBQUMsQ0FBQzs7Q0FFcEgsRUFBRSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7O0NBRWxCLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztDQUM3Qjs7Q0FFQSxFQUFFLE9BQU8sSUFBSSxPQUFPLENBQUMsU0FBUyxPQUFPLEVBQUUsTUFBTSxDQUFDO0NBQzlDLEdBQUcsU0FBUyxXQUFXLENBQUMsQ0FBQyxDQUFDO0NBQzFCLElBQUksR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU87Q0FDdkIsSUFBSSxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7Q0FDdkIsSUFBSSxRQUFRLENBQUMsQ0FBQyxPQUFPO0NBQ3JCLE1BQU0sS0FBSyxFQUFFLENBQUM7Q0FDZCxNQUFNLEtBQUssRUFBRSxDQUFDO0NBQ2QsTUFBTSxLQUFLLEVBQUU7Q0FDYixLQUFLLFVBQVUsR0FBRyxDQUFDLENBQUM7Q0FDcEIsS0FBSyxNQUFNO0NBQ1gsTUFBTTtDQUNOLEtBQUssTUFBTTtDQUNYLEtBQUs7Q0FDTCxJQUFJLEdBQUcsVUFBVSxJQUFJLENBQUMsQ0FBQztDQUN2QixLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0NBQzVDLEtBQUssSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztDQUNoQyxLQUFLLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7Q0FDdkQsS0FBSztDQUNMLElBQUk7O0NBRUosR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0NBQ25EO0NBQ0EsR0FBRyxJQUFJLENBQUMsd0JBQXdCLEdBQUcsVUFBVTtDQUM3QyxJQUFJLE9BQU8sRUFBRSxDQUFDO0NBQ2QsSUFBSSxNQUFNLENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0NBQ3RELEtBQUk7Q0FDSixHQUFHLENBQUMsQ0FBQztDQUNMLEVBQUU7Q0FDRixDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDO0NBQ2xDO0NBQ0E7Q0FDQSxFQUFFLEdBQUcsVUFBVSxJQUFJLENBQUMsQ0FBQztDQUNyQixHQUFHLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixJQUFJLENBQUMsSUFBSSxVQUFVLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDdEQsSUFBSSxPQUFPO0NBQ1gsSUFBSTtDQUNKLEdBQUcsR0FBRyxJQUFJLENBQUMsaUJBQWlCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLFVBQVUsSUFBSSxDQUFDLENBQUM7Q0FDeEUsSUFBSSxPQUFPO0NBQ1gsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixJQUFJLFVBQVUsQ0FBQztDQUN4QyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7Q0FDMUMsR0FBRyxPQUFPLEVBQUUsQ0FBQztDQUNiLEdBQUc7Q0FDSCxFQUFFO0NBQ0Y7Q0FDQSxDQUFDLE1BQU0sS0FBSyxDQUFDLFFBQVEsQ0FBQztDQUN0QixFQUFFLE9BQU8sSUFBSSxPQUFPLENBQUMsU0FBUyxPQUFPLEVBQUUsTUFBTSxDQUFDO0NBQzlDLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7Q0FDeEMsR0FBRyxDQUFDLENBQUM7Q0FDTCxFQUFFO0NBQ0YsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUM7Q0FDM0M7Q0FDQSxFQUFFLElBQUksU0FBUyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxLQUFLLFNBQVMsR0FBRyxTQUFTLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzFGLEVBQUU7Q0FDRixDQUFDOzs7Ozs7OztDQVFELE1BQU0sbUJBQW1CLFNBQVMscUJBQXFCO0NBQ3ZEO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUM7Q0FDckIsUUFBUSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7O0NBRXZCLFFBQVEsSUFBSSxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBQztDQUNwQzs7Q0FFQSxFQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDO0NBQ3RCLEVBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxDQUFDLENBQUM7O0NBRTFCLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUM3QyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUM7Q0FDdkQsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsR0FBRyxVQUFVLEdBQUU7O0NBRS9DLFFBQVEsSUFBSSxDQUFDLHdCQUF3QixHQUFHLFVBQVUsR0FBRTs7Q0FFcEQsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7Q0FDeEIsUUFBUSxTQUFTLFdBQVcsQ0FBQyxDQUFDLENBQUM7Q0FDL0IsTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTztDQUN6QixHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztDQUN0QixHQUFHLFFBQVEsQ0FBQyxDQUFDLE9BQU87Q0FDcEIsS0FBSyxLQUFLLEVBQUUsQ0FBQztDQUNiLEtBQUssS0FBSyxFQUFFLENBQUM7Q0FDYixLQUFLLEtBQUssRUFBRTtDQUNaLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztDQUNuQixJQUFJLE1BQU07Q0FDVixjQUFjLEtBQUssRUFBRSxDQUFDO0NBQ3RCLGNBQWMsS0FBSyxFQUFFLENBQUM7Q0FDdEIsY0FBYyxLQUFLLEVBQUU7Q0FDckIsZ0JBQWdCLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUNoQyxLQUFLO0NBQ0wsSUFBSSxNQUFNO0NBQ1YsSUFBSTtDQUNKLEdBQUcsR0FBRyxVQUFVLElBQUksQ0FBQyxDQUFDO0NBQ3RCLGdCQUFnQixHQUFHLFVBQVUsSUFBSSxDQUFDLENBQUM7Q0FDbkMsb0JBQW9CLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO0NBQy9DLGlCQUFpQixLQUFLLEdBQUcsVUFBVSxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQzFDLG9CQUFvQixJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztDQUNoRCxpQkFBaUI7Q0FDakIsSUFBSTtDQUNKLEdBQUc7O0NBRUgsRUFBRSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0NBQ2xELEVBQUU7O0NBRUYsSUFBSSwyQkFBMkIsRUFBRTtDQUNqQztDQUNBO0NBQ0EsWUFBWSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0NBQ3ZELGdCQUFnQixJQUFJLENBQUMsY0FBYyxJQUFJLENBQUMsQ0FBQztDQUN6QyxnQkFBZ0IsSUFBSSxDQUFDLGtCQUFrQixJQUFJLENBQUMsQ0FBQztDQUM3QyxnQkFBZ0IsSUFBSSxDQUFDLGlCQUFpQixJQUFJLENBQUMsQ0FBQztDQUM1QyxhQUFhOztDQUViLFlBQVksSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztDQUNuRCxZQUFZLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO0NBQzVDLEtBQUs7O0NBRUwsSUFBSSxtQkFBbUIsRUFBRTtDQUN6QixRQUFRLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztDQUM3RDtDQUNBLFlBQVksSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7Q0FDL0MsWUFBWSxPQUFPO0NBQ25CLFNBQVM7Q0FDVDs7Q0FFQSxRQUFRLElBQUksQ0FBQyxjQUFjLElBQUksQ0FBQyxDQUFDO0NBQ2pDLFFBQVEsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxXQUFXLEtBQUssZ0JBQWdCLENBQUM7Q0FDbkY7O0NBRUEsWUFBWSxHQUFHLElBQUksQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7Q0FDNUQ7Q0FDQSxnQkFBZ0IsTUFBTTtDQUN0QixhQUFhOztDQUViO0NBQ0EsWUFBWSxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUM7Q0FDOUQsWUFBWSxJQUFJLGFBQWEsR0FBRyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLFVBQVUsS0FBSyxTQUFTLEdBQUcsU0FBUyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDNUo7O0NBRUEsWUFBWSxJQUFJLENBQUMsY0FBYyxJQUFJLENBQUMsQ0FBQztDQUNyQyxTQUFTO0NBQ1QsUUFBUSxJQUFJLENBQUMsaUJBQWlCLElBQUksQ0FBQyxDQUFDO0NBQ3BDLFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztDQUMvQyxLQUFLOztDQUVMLElBQUksb0JBQW9CLEVBQUU7O0NBRTFCLFFBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsaUJBQWlCLElBQUksQ0FBQyxDQUFDO0NBQ25FLFlBQVksT0FBTztDQUNuQixTQUFTOztDQUVULFFBQVEsSUFBSSxDQUFDLGNBQWMsSUFBSSxDQUFDLENBQUM7Q0FDakMsUUFBUSxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLFdBQVcsS0FBSyxnQkFBZ0IsQ0FBQztDQUNuRjs7Q0FFQSxZQUFZLEdBQUcsSUFBSSxDQUFDLGNBQWMsSUFBSSxDQUFDLENBQUM7Q0FDeEM7Q0FDQSxnQkFBZ0IsTUFBTTtDQUN0QixhQUFhOztDQUViO0NBQ0EsWUFBWSxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztDQUMvRCxZQUFZLElBQUksUUFBUSxHQUFHLFFBQVEsQ0FBQyxVQUFVLEtBQUssU0FBUyxHQUFHLENBQUMsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztDQUM1RixZQUFZLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Q0FDakQsWUFBWSxJQUFJLGFBQWEsR0FBRyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUM7Q0FDOUY7O0NBRUEsWUFBWSxJQUFJLENBQUMsY0FBYyxJQUFJLENBQUMsQ0FBQztDQUNyQyxTQUFTO0NBQ1QsUUFBUSxJQUFJLENBQUMsaUJBQWlCLElBQUksQ0FBQyxDQUFDO0NBQ3BDLFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQzs7Q0FFL0MsS0FBSzs7Q0FFTCxDQUFDLE1BQU0sU0FBUyxFQUFFO0NBQ2xCO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLFFBQVEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDOzs7Q0FHMUUsUUFBUSxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLHFFQUFxRSxDQUFDLENBQUM7O0NBRXBILEVBQUUsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDOztDQUVsQjtDQUNBLEVBQUUsT0FBTyxJQUFJLE9BQU8sQ0FBQyxTQUFTLE9BQU8sRUFBRSxNQUFNLENBQUM7Q0FDOUMsR0FBRyxJQUFJLENBQUMsd0JBQXdCLEdBQUcsVUFBVTtDQUM3QyxJQUFJLE9BQU8sRUFBRSxDQUFDO0NBQ2QsS0FBSTtDQUNKLEdBQUcsQ0FBQyxDQUFDOztDQUVMLEVBQUU7Q0FDRixDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQztDQUMzQyxFQUFFLElBQUksU0FBUyxHQUFHLElBQUksU0FBUyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxLQUFLLFNBQVMsR0FBRyxTQUFTLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzFHLEVBQUUsSUFBSSxVQUFVLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQztDQUN4QyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksUUFBUSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7Q0FDOUUsRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7Q0FDeEIsRUFBRTtDQUNGLENBQUM7Ozs7Q0FJRCxNQUFNLFFBQVE7Q0FDZCxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUM7Q0FDdEQsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztDQUN2QixFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0NBQzNCLEVBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7Q0FDL0IsRUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztDQUMvQixFQUFFO0NBQ0YsQ0FBQztDQUNELE1BQU0sZ0JBQWdCO0NBQ3RCLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQztDQUN4QixRQUFRLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO0NBQ3JDLEVBQUU7Q0FDRixDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7In0=
