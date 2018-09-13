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
		constructor(){}
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
	}

	class OutputNode{ //more of a java interface, really
		constructor(){}
		evaluateSelf(i, t, x, y, z){}
		onAfterActivation(){}
		_onAdd(){}
	}

	class EXPArray extends Node{
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

			this.children = [];
			this.parent = null;
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
		onAfterActivation(){
			// do nothing

			//but call all children
			for(var i=0;i<this.children.length;i++){
				this.children[i].onAfterActivation();
			}
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
		for(var i=0;i<v1.length;i++){
			v1[i] += v2[i];
		}
		return v1
	}
	function lerpVectors(t, p1, p2){
		//assumed t in [0,1]
		return vectorAdd(multiplyScalar(t,p1),multiplyScalar(1-t,p2));
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
			}
		}


		static assertPropExists(thing, name){
			if(!(name in thing)){
				console.error("ERROR! "+name+" not present in required property");
			}
		}
		
		static clone(vec){
			return clone(vec);
		}
	}

	class Area$1 extends Node{
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

			this.children = [];
			this.parent = null;
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
		onAfterActivation(){
			// do nothing

			//but call all children
			for(var i=0;i<this.children.length;i++){
				this.children[i].onAfterActivation();
			}
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

			this.children = [];
			this.parent = null;
		}
		evaluateSelf(...coordinates){
			//evaluate this Transformation's _expr, and broadcast the result to all children.
			let result = this.expr(...coordinates);
			if(result.constructor !== Array)result = [result];

			for(var i=0;i<this.children.length;i++){
				this.children[i].evaluateSelf(coordinates[0],coordinates[1], ...result);
			}
		}
		onAfterActivation(){
			// do nothing

			//but call all children
			for(var i=0;i<this.children.length;i++){
				this.children[i].onAfterActivation();
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
			three.on("update",this._updateCallback);
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
			three.removeEventListener("update",this._updateCallback);
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
	  if (typeof undefined == 'function' && typeof undefined.amd == 'object' && undefined.amd) {
	    // Define as an anonymous module so, through path mapping, it can be
	    // referenced as the "underscore" module.
	    undefined(function() {
	    	return CCapture;
	    });
	}
	  // Check for `exports` after `define` in case a build optimizer adds an `exports` object.
	  else if (freeExports && freeModule) {
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

	function ThreeasyEnvironment(autostart = true, canvasElement = null){
		this.prev_timestep = 0;
		this.autostart = autostart;
		this.shouldCreateCanvas = (canvasElement === null);

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
		let rendererOptions = { antialias: true};
		if(!this.shouldCreateCanvas){
			rendererOptions["canvas"] = canvasElement;
		}
		this.renderer = new THREE.WebGLRenderer( rendererOptions );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( this.evenify(window.innerWidth),this.evenify(window.innerHeight) );
		this.renderer.setClearColor(new THREE.Color(0xFFFFFF), 1.0);
		/*
		this.renderer.gammaInput = true;
		this.renderer.gammaOutput = true;
		this.renderer.shadowMap.enabled = true;
		this.renderer.vr.enabled = true;
		*/

		this.aspect = window.innerWidth/window.innerHeight;

		this.timeScale = 1;
		this.elapsedTime = 0;

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
	}

	ThreeasyEnvironment.prototype.onPageLoad = function() {
		console.log("Threeasy_Setup loaded!");
		if(this.shouldCreateCanvas){
			document.body.appendChild( this.container );
		}

		if(this.autostart){
			this.start();
		}
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
		var pointerLockElement = renderer.domElement;
		if ( pointerLockElement && typeof(pointerLockElement.requestPointerLock) === 'function' ) {
			pointerLockElement.requestPointerLock();
		}
	};
	ThreeasyEnvironment.prototype.onPointerUnrestricted= function() {
		var currentPointerLockElement = document.pointerLockElement;
		var expectedPointerLockElement = renderer.domElement;
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
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.aspect = this.camera.aspect;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( this.evenify(window.innerWidth),this.evenify(window.innerHeight) );
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

		constructor(autostart, fps=30, length = 5, canvasElement = null){
			/* fps is evident, autostart is a boolean (by default, true), and length is in s.*/
			super(autostart, canvasElement);
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

	function setupThree(autostart, fps=30, length = 5, canvasElement = null){
		var is_recording = false;

		//extract record parameter from url
		var params = new URLSearchParams(document.location.search);
		let recordString = params.get("record");

		if(recordString)is_recording = params.get("record").toLowerCase() == "true" || params.get("record").toLowerCase() == "1";

		if(is_recording){
			return new ThreeasyRecorder(autostart, fps, length, canvasElement);
		
		}else{
			return new ThreeasyEnvironment(autostart, canvasElement);
		}
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

			this.parent = null;

			this.init();
		}
		init(){
			this._geometry = new THREE.BufferGeometry();
			this._vertices;
			this.makeGeometry();

			this.material = new THREE.LineBasicMaterial({color: this._color, linewidth: this._width,opacity:this._opacity});
			this.mesh = new THREE.LineSegments(this._geometry,this.material);

			this.opacity = this._opacity; // setter sets transparent flag if necessary

			three.scene.add(this.mesh);
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
			//climb up parent hierarchy to find the Area
			let root = this;
			while(root.parent !== null){
				root = root.parent;
			}
		
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
			//I should really
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
			three.scene.add(this.mesh);

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
	Point.prototype.sharedCircleGeometry = new THREE.SphereGeometry(1/2, 8, 6); //radius 1/2 so that scaling by n means width=n

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

			this.parent = null;
		}
		_onAdd(){ //should be called when this is .add()ed to something

			let parentCount = 0;
			//climb up parent hierarchy to find the Area
			let root = this;
			while(root.parent !== null && parentCount < 50){
				root = root.parent;
				parentCount++;
			}
			if(parentCount >= 50)throw new Error("Unable to find root!");

			this.numCallsPerActivation = root.numCallsPerActivation;

			if(this.points.length < this.numCallsPerActivation){
				for(var i=this.points.length;i<this.numCallsPerActivation;i++){
					this.points.push(new Point({width: 1,color:this._color, opacity:this._opacity}));
					this.points[i].mesh.scale.setScalar(this._width); //set width by scaling point
					this.points[i].mesh.visible = false; //instantiate the point
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
			point.mesh.visible = true;
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

			three.scene.add(this.lineMesh);
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
				three.scene.remove(arrow);
			}

			this.arrowheads = new Array(this.numArrowheads);
			for(var i=0;i<this.numArrowheads;i++){
				this.arrowheads[i] = new THREE.Mesh(this.coneGeometry, this.material);
				three.scene.add(this.arrowheads[i]);
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

	class SurfaceOutput extends OutputNode{
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
			this._opacity = options.opacity !== undefined ? options.opacity : 1;
			this._color = options.color !== undefined ? options.color : 0x55aa55;

			this.numCallsPerActivation = 0; //should always be equal to this.vertices.length
			this.itemDimensions = []; // how many times to be called in each direction
			this._outputDimensions = 3; //how many dimensions per point to store?

			this.parent = null;

			this.init();
		}
		init(){
			this._geometry = new THREE.BufferGeometry();
			this._vertices;
			this.makeGeometry();

			this.material = new THREE.MeshBasicMaterial({color: this._color, opacity:this._opacity});
			this.mesh = new THREE.Mesh(this._geometry,this.material);

			this.opacity = this._opacity; // setter sets transparent flag if necessary

			three.scene.add(this.mesh);
		}
		makeGeometry(){

			let MAX_POINTS = 10000;

			this._vertices = new Float32Array(MAX_POINTS * this._outputDimensions);
			this._normals = new Float32Array(MAX_POINTS * this._outputDimensions);

			// build geometry

			this._geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this._vertices, this._outputDimensions ) );
			this._geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( this._normals, 3 ) );
			//this.geometry.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

			this._currentPointIndex = 0; //used during updates as a pointer to the buffer

			this._activatedOnce = false;

		}
		_onAdd(){
			//climb up parent hierarchy to find the Area
			let root = this;
			while(root.parent !== null){
				root = root.parent;
			}
		
			//todo: implement something like assert root typeof RootNode

			this.numCallsPerActivation = root.numCallsPerActivation;
			this.itemDimensions = root.itemDimensions;
		}
		_onFirstActivation(){
			this._onAdd(); //setup this.numCallsPerActivation and this.itemDimensions. used here again because cloning means the onAdd() might be called before this is connected to a type of domain

			// perhaps instead of generating a whole new array, this can reuse the old one?
			let vertices = new Float32Array(this.numCallsPerActivation * this._outputDimensions);
			let normals = new Float32Array(this.numCallsPerActivation * 3);

			console.log(this.itemDimensions, this.numCallsPerActivation, this._outputDimensions);

			let positionAttribute = this._geometry.attributes.position;
			this._vertices = vertices;
			positionAttribute.setArray(this._vertices);
			positionAttribute.needsUpdate = true;

			let normalAttribute = this._geometry.attributes.normal;
			this._normals = normals;
			normalAttribute.setArray(this._normals);
			normalAttribute.needsUpdate = true;


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

					//set normal to [0,0,1]
					/*normals[(i + j * this.itemDimensions[1])*3] = 0
					normals[(i + j * this.itemDimensions[1])*3+1] = 0
					normals[(i + j * this.itemDimensions[1])*3+2] = 0*/
				}
			}
			console.log(indices);
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

			//todo: recalc normals

			this._currentPointIndex = 0; //reset after each update
		}
		set color(color){
			//currently only a single color is supported.
			//I should really make this a function
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
			return new SurfaceOutput({color: this.color, opacity: this.opacity});
		}
	}

	class DirectionArrow{
		constructor(faceRight){
			this.arrowImage = DirectionArrow.arrowImage; //this should be changed once I want to make multiple arrows at once

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
		static async loadImage(){
			return new Promise(
				(function(resolve, reject){
					if(this.arrowImage && this.arrowImage.width != 0){
						return resolve(); //quit early
					}
					this.arrowImage = new Image();
					this.arrowImage.onload = resolve;
					
					this.arrowImage.src = 
	this.arrowImage.baseURI.substring(0,this.arrowImage.baseURI.search("explanaria")) + "explanaria/src/ExplanarianNextArrow.svg";
					this.arrowImage.className = "exp-arrow";
				}).bind(this));
		}
	}
	DirectionArrow.loadImage(); // preload


	class NonDecreasingDirector{
		// I want Director() to be able to backtrack by pressing backwards. This doesn't do that.
		constructor(options){
			this.undoStack = [];
			this.undoStackIndex = 0;

			this.slides = document.getElementsByClassName("exp-slide");
			this.currentSlideIndex = 0;

			this.nextSlideResolveFunction = null;
		}


		async begin(){
			await this.waitForPageLoad();

			this.rightArrow = new DirectionArrow();
			document.body.appendChild(this.rightArrow.arrowImage);
			let self = this;
			this.rightArrow.onclickCallback = function(){
				self._changeSlide(1, function(){}); // this errors without the empty function because there's no resolve. There must be a better way to do things.
				console.warn("WARNING: Horrible hack in effect to change slides. Please replace the pass-an-empty-function thing with something that actually resolves properly and does async.");
				self.nextSlideResolveFunction();
			};

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL291dHB1dHMvTGluZU91dHB1dC5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1BvaW50LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvUG9pbnRPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9WZWN0b3JPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9TdXJmYWNlT3V0cHV0LmpzIiwiLi4vc3JjL2pzL0RpcmVjdG9yLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIFRoZSBiYXNlIGNsYXNzIHRoYXQgZXZlcnl0aGluZyBpbmhlcml0cyBmcm9tLiBcblx0RWFjaCB0aGluZyBkcmF3biB0byB0aGUgc2NyZWVuIGlzIGEgdHJlZS4gRG9tYWlucywgc3VjaCBhcyBFWFAuQXJlYSBvciBFWFAuQXJyYXkgYXJlIHRoZSByb290IG5vZGVzLFxuXHRFWFAuVHJhbnNmb3JtYXRpb24gaXMgY3VycmVudGx5IHRoZSBvbmx5IGludGVybWVkaWF0ZSBub2RlLCBhbmQgdGhlIGxlYWYgbm9kZXMgYXJlIHNvbWUgZm9ybSBvZiBPdXRwdXQgc3VjaCBhc1xuXHRFWFAuTGluZU91dHB1dCBvciBFWFAuUG9pbnRPdXRwdXQsIG9yIEVYUC5WZWN0b3JPdXRwdXQuXG5cblx0QWxsIG9mIHRoZXNlIGNhbiBiZSAuYWRkKCllZCB0byBlYWNoIG90aGVyIHRvIGZvcm0gdGhhdCB0cmVlLCBhbmQgdGhpcyBmaWxlIGRlZmluZXMgaG93IGl0IHdvcmtzLlxuKi9cblxuY2xhc3MgTm9kZXtcblx0Y29uc3RydWN0b3IoKXt9XG5cdGFkZCh0aGluZyl7XG5cdFx0Ly9jaGFpbmFibGUgc28geW91IGNhbiBhLmFkZChiKS5hZGQoYykgdG8gbWFrZSBhLT5iLT5jXG5cdFx0dGhpcy5jaGlsZHJlbi5wdXNoKHRoaW5nKTtcblx0XHR0aGluZy5wYXJlbnQgPSB0aGlzO1xuXHRcdGlmKHRoaW5nLl9vbkFkZCl0aGluZy5fb25BZGQoKTtcblx0XHRyZXR1cm4gdGhpbmc7XG5cdH1cblx0X29uQWRkKCl7fVxuXHRyZW1vdmUodGhpbmcpe1xuXHRcdHZhciBpbmRleCA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZiggdGhpbmcgKTtcblx0XHRpZiAoIGluZGV4ICE9PSAtIDEgKSB7XG5cdFx0XHR0aGluZy5wYXJlbnQgPSBudWxsO1xuXHRcdFx0dGhpcy5jaGlsZHJlbi5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG59XG5cbmNsYXNzIE91dHB1dE5vZGV7IC8vbW9yZSBvZiBhIGphdmEgaW50ZXJmYWNlLCByZWFsbHlcblx0Y29uc3RydWN0b3IoKXt9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXt9XG5cdG9uQWZ0ZXJBY3RpdmF0aW9uKCl7fVxuXHRfb25BZGQoKXt9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGU7XG5leHBvcnQge091dHB1dE5vZGV9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCBOb2RlIGZyb20gJy4vTm9kZS5qcyc7XG5cbmNsYXNzIEVYUEFycmF5IGV4dGVuZHMgTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKnZhciBwb2ludHMgPSBuZXcgRVhQLkFycmF5KHtcblx0XHRkYXRhOiBbWy0xMCwxMF0sXG5cdFx0XHRbMTAsMTBdXVxuXHRcdH0pKi9cblxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZGF0YVwiKTsgLy8gYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LiBhc3N1bWVkIHRvIG9ubHkgY29udGFpbiBvbmUgdHlwZTogZWl0aGVyIG51bWJlcnMgb3IgYXJyYXlzXG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5kYXRhLCBBcnJheSk7XG5cblx0XHQvL0l0J3MgYXNzdW1lZCBhbiBFWFAuQXJyYXkgd2lsbCBvbmx5IHN0b3JlIHRoaW5ncyBzdWNoIGFzIDAsIFswXSwgWzAsMF0gb3IgWzAsMCwwXS4gSWYgYW4gYXJyYXkgdHlwZSBpcyBzdG9yZWQsIHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyBjb250YWlucyB0aGUgLmxlbmd0aCBvZiB0aGF0IGFycmF5LiBPdGhlcndpc2UgaXQncyAwLCBiZWNhdXNlIHBvaW50cyBhcmUgMC1kaW1lbnNpb25hbC5cblx0XHRpZihvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHR0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPSAwO1xuXHRcdH1lbHNlIGlmKG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0dGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID0gb3B0aW9ucy5kYXRhWzBdLmxlbmd0aDtcblx0XHR9ZWxzZXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJEYXRhIGluIGFuIEVYUC5BcnJheSBzaG91bGQgYmUgYSBudW1iZXIgb3IgYW4gYXJyYXkgb2Ygb3RoZXIgdGhpbmdzLCBub3QgXCIgKyBvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IpO1xuXHRcdH1cblxuXG5cdFx0RVhQLlV0aWxzLmFzc2VydChvcHRpb25zLmRhdGFbMF0ubGVuZ3RoICE9IDApOyAvL2Rvbid0IGFjY2VwdCBbW11dLCBkYXRhIG5lZWRzIHRvIGJlIHNvbWV0aGluZyBsaWtlIFtbMSwyXV0uXG5cblx0XHR0aGlzLmRhdGEgPSBvcHRpb25zLmRhdGE7XG5cblx0XHR0aGlzLm51bUl0ZW1zID0gdGhpcy5kYXRhLmxlbmd0aDtcblxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbdGhpcy5kYXRhLmxlbmd0aF07IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdC8vdGhlIG51bWJlciBvZiB0aW1lcyBldmVyeSBjaGlsZCdzIGV4cHIgaXMgY2FsbGVkXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSB0aGlzLml0ZW1EaW1lbnNpb25zLnJlZHVjZSgoc3VtLHkpPT5zdW0qeSlcblxuXHRcdHRoaXMuY2hpbGRyZW4gPSBbXTtcblx0XHR0aGlzLnBhcmVudCA9IG51bGw7XG5cdH1cblx0YWN0aXZhdGUodCl7XG5cdFx0aWYodGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID09IDApe1xuXHRcdFx0Ly9udW1iZXJzIGNhbid0IGJlIHNwcmVhZCB1c2luZyAuLi4gb3BlcmF0b3Jcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5kYXRhLmxlbmd0aDtpKyspe1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaSx0LHRoaXMuZGF0YVtpXSk7XG5cdFx0XHR9XG5cdFx0fWVsc2V7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuZGF0YS5sZW5ndGg7aSsrKXtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGksdCwuLi50aGlzLmRhdGFbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMub25BZnRlckFjdGl2YXRpb24oKTsgLy8gY2FsbCBjaGlsZHJlbiBpZiBuZWNlc3Nhcnlcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblxuXHRcdC8vYnV0IGNhbGwgYWxsIGNoaWxkcmVuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5vbkFmdGVyQWN0aXZhdGlvbigpXG5cdFx0fVxuXHR9XG5cdF9jYWxsQWxsQ2hpbGRyZW4oLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBFWFAuQXJyYXkoe2RhdGE6IEVYUC5VdGlscy5hcnJheUNvcHkodGhpcy5kYXRhKX0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cbn1cblxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdEFycmF5KCl7XG5cdHZhciB4ID0gbmV3IEVYUC5BcnJheSh7ZGF0YTogW1swLDFdLFswLDFdXX0pO1xuXHR2YXIgeSA9IG5ldyBFWFAuVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpOyByZXR1cm4gWzJdfX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSg1MTIpO1xufVxuXG5leHBvcnQge0VYUEFycmF5IGFzIEFycmF5fTtcbiIsImZ1bmN0aW9uIG11bHRpcGx5U2NhbGFyKGMsIGFycmF5KXtcblx0Zm9yKHZhciBpPTA7aTxhcnJheS5sZW5ndGg7aSsrKXtcblx0XHRhcnJheVtpXSAqPSBjO1xuXHR9XG5cdHJldHVybiBhcnJheVxufVxuZnVuY3Rpb24gdmVjdG9yQWRkKHYxLHYyKXtcblx0Zm9yKHZhciBpPTA7aTx2MS5sZW5ndGg7aSsrKXtcblx0XHR2MVtpXSArPSB2MltpXTtcblx0fVxuXHRyZXR1cm4gdjFcbn1cbmZ1bmN0aW9uIGxlcnBWZWN0b3JzKHQsIHAxLCBwMil7XG5cdC8vYXNzdW1lZCB0IGluIFswLDFdXG5cdHJldHVybiB2ZWN0b3JBZGQobXVsdGlwbHlTY2FsYXIodCxwMSksbXVsdGlwbHlTY2FsYXIoMS10LHAyKSk7XG59XG5mdW5jdGlvbiBjbG9uZSh2ZWMpe1xuXHR2YXIgbmV3QXJyID0gbmV3IEFycmF5KHZlYy5sZW5ndGgpO1xuXHRmb3IodmFyIGk9MDtpPHZlYy5sZW5ndGg7aSsrKXtcblx0XHRuZXdBcnJbaV0gPSB2ZWNbaV07XG5cdH1cblx0cmV0dXJuIG5ld0FyclxufVxuZnVuY3Rpb24gbXVsdGlwbHlNYXRyaXgodmVjLCBtYXRyaXgpe1xuXHQvL2Fzc2VydCB2ZWMubGVuZ3RoID09IG51bVJvd3NcblxuXHRsZXQgbnVtUm93cyA9IG1hdHJpeC5sZW5ndGg7XG5cdGxldCBudW1Db2xzID0gbWF0cml4WzBdLmxlbmd0aDtcblxuXHR2YXIgb3V0cHV0ID0gbmV3IEFycmF5KG51bUNvbHMpO1xuXHRmb3IodmFyIGo9MDtqPG51bUNvbHM7aisrKXtcblx0XHRvdXRwdXRbal0gPSAwO1xuXHRcdGZvcih2YXIgaT0wO2k8bnVtUm93cztpKyspe1xuXHRcdFx0b3V0cHV0W2pdICs9IG1hdHJpeFtpXVtqXSAqIHZlY1tpXTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIG91dHB1dDtcbn1cblxuLy9oYWNrXG5sZXQgTWF0aCA9IHtjbG9uZTogY2xvbmUsIGxlcnBWZWN0b3JzOiBsZXJwVmVjdG9ycywgdmVjdG9yQWRkOiB2ZWN0b3JBZGQsIG11bHRpcGx5U2NhbGFyOiBtdWx0aXBseVNjYWxhciwgbXVsdGlwbHlNYXRyaXg6IG11bHRpcGx5TWF0cml4fTtcblxuZXhwb3J0IHt2ZWN0b3JBZGQsIGxlcnBWZWN0b3JzLCBjbG9uZSwgbXVsdGlwbHlTY2FsYXIsIG11bHRpcGx5TWF0cml4LCBNYXRofTtcbiIsImltcG9ydCB7Y2xvbmV9IGZyb20gJy4vbWF0aC5qcydcblxuY2xhc3MgVXRpbHN7XG5cblx0c3RhdGljIGlzQXJyYXkoeCl7XG5cdFx0cmV0dXJuIHguY29uc3RydWN0b3IgPT09IEFycmF5O1xuXHR9XG5cdHN0YXRpYyBhcnJheUNvcHkoeCl7XG5cdFx0cmV0dXJuIHguc2xpY2UoKTtcblx0fVxuXHRzdGF0aWMgaXNGdW5jdGlvbih4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gRnVuY3Rpb247XG5cdH1cblxuXHRzdGF0aWMgYXNzZXJ0KHRoaW5nKXtcblx0XHQvL0EgZnVuY3Rpb24gdG8gY2hlY2sgaWYgc29tZXRoaW5nIGlzIHRydWUgYW5kIGhhbHQgb3RoZXJ3aXNlIGluIGEgY2FsbGJhY2thYmxlIHdheS5cblx0XHRpZighdGhpbmcpe1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBBc3NlcnRpb24gZmFpbGVkLiBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcblx0XHR9XG5cdH1cblxuXHRzdGF0aWMgYXNzZXJ0VHlwZSh0aGluZywgdHlwZSwgZXJyb3JNc2cpe1xuXHRcdC8vQSBmdW5jdGlvbiB0byBjaGVjayBpZiBzb21ldGhpbmcgaXMgdHJ1ZSBhbmQgaGFsdCBvdGhlcndpc2UgaW4gYSBjYWxsYmFja2FibGUgd2F5LlxuXHRcdGlmKCEodGhpbmcuY29uc3RydWN0b3IgPT09IHR5cGUpKXtcblx0XHRcdGlmKGVycm9yTXNnKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBTb21ldGhpbmcgbm90IG9mIHJlcXVpcmVkIHR5cGUgXCIrdHlwZS5uYW1lK1wiISBcXG5cIitlcnJvck1zZytcIlxcbiBTZWUgdHJhY2ViYWNrIGZvciBtb3JlLlwiKTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFNvbWV0aGluZyBub3Qgb2YgcmVxdWlyZWQgdHlwZSBcIit0eXBlLm5hbWUrXCIhIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cblx0c3RhdGljIGFzc2VydFByb3BFeGlzdHModGhpbmcsIG5hbWUpe1xuXHRcdGlmKCEobmFtZSBpbiB0aGluZykpe1xuXHRcdFx0Y29uc29sZS5lcnJvcihcIkVSUk9SISBcIituYW1lK1wiIG5vdCBwcmVzZW50IGluIHJlcXVpcmVkIHByb3BlcnR5XCIpXG5cdFx0fVxuXHR9XG5cdFxuXHRzdGF0aWMgY2xvbmUodmVjKXtcblx0XHRyZXR1cm4gY2xvbmUodmVjKTtcblx0fVxufVxuXG5leHBvcnQge1V0aWxzfTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQgeyBVdGlscyB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IE5vZGUgZnJvbSAnLi9Ob2RlLmpzJztcblxuY2xhc3MgQXJlYSBleHRlbmRzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvKnZhciBheGVzID0gbmV3IEVYUC5BcmVhKHtcblx0XHRib3VuZHM6IFtbLTEwLDEwXSxcblx0XHRcdFsxMCwxMF1dXG5cdFx0bnVtSXRlbXM6IDEwOyAvL29wdGlvbmFsLiBBbHRlcm5hdGVseSBudW1JdGVtcyBjYW4gdmFyeSBmb3IgZWFjaCBheGlzOiBudW1JdGVtczogWzEwLDJdXG5cdFx0fSkqL1xuXG5cblx0XG5cdFx0VXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyhvcHRpb25zLCBcImJvdW5kc1wiKTsgLy8gYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5XG5cdFx0VXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmJvdW5kcywgQXJyYXkpO1xuXHRcdFV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5ib3VuZHNbMF0sIEFycmF5LCBcIkZvciBhbiBBcmVhLCBvcHRpb25zLmJvdW5kcyBtdXN0IGJlIGEgbXVsdGlkaW1lbnNpb25hbCBhcnJheSwgZXZlbiBmb3Igb25lIGRpbWVuc2lvbiFcIik7IC8vIGl0IE1VU1QgYmUgbXVsdGlkaW1lbnNpb25hbFxuXHRcdHRoaXMubnVtRGltZW5zaW9ucyA9IG9wdGlvbnMuYm91bmRzLmxlbmd0aDtcblxuXHRcdFV0aWxzLmFzc2VydChvcHRpb25zLmJvdW5kc1swXS5sZW5ndGggIT0gMCk7IC8vZG9uJ3QgYWNjZXB0IFtbXV0sIGl0IG5lZWRzIHRvIGJlIFtbMSwyXV0uXG5cblx0XHR0aGlzLmJvdW5kcyA9IG9wdGlvbnMuYm91bmRzO1xuXG5cdFx0dGhpcy5udW1JdGVtcyA9IG9wdGlvbnMubnVtSXRlbXMgfHwgMTY7XG5cblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdGlmKHRoaXMubnVtSXRlbXMuY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtRGltZW5zaW9ucztpKyspe1xuXHRcdFx0XHR0aGlzLml0ZW1EaW1lbnNpb25zLnB1c2godGhpcy5udW1JdGVtcyk7XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1JdGVtcy5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMubnVtSXRlbXMubGVuZ3RoID09IG9wdGlvbnMuYm91bmRzLmxlbmd0aCk7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMubnVtRGltZW5zaW9ucztpKyspe1xuXHRcdFx0XHR0aGlzLml0ZW1EaW1lbnNpb25zLnB1c2godGhpcy5udW1JdGVtc1tpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIHRpbWVzIGV2ZXJ5IGNoaWxkJ3MgZXhwciBpcyBjYWxsZWRcblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHRoaXMuaXRlbURpbWVuc2lvbnMucmVkdWNlKChzdW0seSk9PnN1bSp5KVxuXG5cdFx0dGhpcy5jaGlsZHJlbiA9IFtdO1xuXHRcdHRoaXMucGFyZW50ID0gbnVsbDtcblx0fVxuXHRhY3RpdmF0ZSh0KXtcblx0XHQvL1VzZSB0aGlzIHRvIGV2YWx1YXRlIGV4cHIoKSBhbmQgdXBkYXRlIHRoZSByZXN1bHQsIGNhc2NhZGUtc3R5bGUuXG5cdFx0Ly90aGUgbnVtYmVyIG9mIGJvdW5kcyB0aGlzIG9iamVjdCBoYXMgd2lsbCBiZSB0aGUgbnVtYmVyIG9mIGRpbWVuc2lvbnMuXG5cdFx0Ly90aGUgZXhwcigpcyBhcmUgY2FsbGVkIHdpdGggZXhwcihpLCAuLi5bY29vcmRpbmF0ZXNdLCB0KSwgXG5cdFx0Ly9cdCh3aGVyZSBpIGlzIHRoZSBpbmRleCBvZiB0aGUgY3VycmVudCBldmFsdWF0aW9uID0gdGltZXMgZXhwcigpIGhhcyBiZWVuIGNhbGxlZCB0aGlzIGZyYW1lLCB0ID0gYWJzb2x1dGUgdGltZXN0ZXAgKHMpKS5cblx0XHQvL3BsZWFzZSBjYWxsIHdpdGggYSB0IHZhbHVlIG9idGFpbmVkIGZyb20gcGVyZm9ybWFuY2Uubm93KCkvMTAwMCBvciBzb21ldGhpbmcgbGlrZSB0aGF0XG5cblx0XHQvL25vdGUgdGhlIGxlc3MtdGhhbi1vci1lcXVhbC10byBpbiB0aGVzZSBsb29wc1xuXHRcdGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAxKXtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRsZXQgaW5kZXggPSBpO1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSwwLDAsMCk7XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1EaW1lbnNpb25zID09IDIpe1xuXHRcdFx0Ly90aGlzIGNhbiBiZSByZWR1Y2VkIGludG8gYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIG92ZXIgdGhlIGZpcnN0IGluZGV4IG9mIHRoaXMuYm91bmRzLCBJIGtub3cgaXRcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRmb3IodmFyIGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aisrKXtcblx0XHRcdFx0XHRsZXQgYzIgPSB0aGlzLmJvdW5kc1sxXVswXSArICh0aGlzLmJvdW5kc1sxXVsxXS10aGlzLmJvdW5kc1sxXVswXSkqKGovKHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSkpO1xuXHRcdFx0XHRcdGxldCBpbmRleCA9IGkqdGhpcy5pdGVtRGltZW5zaW9uc1sxXSArIGo7XG5cdFx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGluZGV4LHQsYzEsYzIsMCwwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1lbHNlIGlmKHRoaXMubnVtRGltZW5zaW9ucyA9PSAzKXtcblx0XHRcdC8vdGhpcyBjYW4gYmUgcmVkdWNlZCBpbnRvIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSBvdmVyIHRoZSBmaXJzdCBpbmRleCBvZiB0aGlzLmJvdW5kcywgSSBrbm93IGl0XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuaXRlbURpbWVuc2lvbnNbMF07aSsrKXtcblx0XHRcdFx0bGV0IGMxID0gdGhpcy5ib3VuZHNbMF1bMF0gKyAodGhpcy5ib3VuZHNbMF1bMV0tdGhpcy5ib3VuZHNbMF1bMF0pKihpLyh0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTEpKTtcblx0XHRcdFx0Zm9yKHZhciBqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzFdO2orKyl7XG5cdFx0XHRcdFx0bGV0IGMyID0gdGhpcy5ib3VuZHNbMV1bMF0gKyAodGhpcy5ib3VuZHNbMV1bMV0tdGhpcy5ib3VuZHNbMV1bMF0pKihqLyh0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTEpKTtcblx0XHRcdFx0XHRmb3IodmFyIGs9MDtrPHRoaXMuaXRlbURpbWVuc2lvbnNbMl07aysrKXtcblx0XHRcdFx0XHRcdGxldCBjMyA9IHRoaXMuYm91bmRzWzJdWzBdICsgKHRoaXMuYm91bmRzWzJdWzFdLXRoaXMuYm91bmRzWzJdWzBdKSooay8odGhpcy5pdGVtRGltZW5zaW9uc1syXS0xKSk7XG5cdFx0XHRcdFx0XHRsZXQgaW5kZXggPSAoaSp0aGlzLml0ZW1EaW1lbnNpb25zWzFdICsgaikqdGhpcy5pdGVtRGltZW5zaW9uc1syXSArIGs7XG5cdFx0XHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSxjMixjMywwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ZWxzZXtcblx0XHRcdGFzc2VydChcIlRPRE86IFVzZSBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgdG8gbG9vcCBvdmVyIGFsbCBpbmRpY2VzIVwiKTtcblx0XHR9XG5cblx0XHR0aGlzLm9uQWZ0ZXJBY3RpdmF0aW9uKCk7IC8vIGNhbGwgY2hpbGRyZW4gaWYgbmVjZXNzYXJ5XG5cdH1cblx0b25BZnRlckFjdGl2YXRpb24oKXtcblx0XHQvLyBkbyBub3RoaW5nXG5cblx0XHQvL2J1dCBjYWxsIGFsbCBjaGlsZHJlblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0ub25BZnRlckFjdGl2YXRpb24oKVxuXHRcdH1cblx0fVxuXHRfY2FsbEFsbENoaWxkcmVuKC4uLmNvb3JkaW5hdGVzKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcylcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgY2xvbmUgPSBuZXcgQXJlYSh7Ym91bmRzOiBVdGlscy5hcnJheUNvcHkodGhpcy5ib3VuZHMpLCBudW1JdGVtczogdGhpcy5udW1JdGVtc30pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdFx0aWYoY2xvbmUuY2hpbGRyZW5baV0uX29uQWRkKWNsb25lLmNoaWxkcmVuW2ldLl9vbkFkZCgpOyAvLyBuZWNlc3Nhcnkgbm93IHRoYXQgdGhlIGNoYWluIG9mIGFkZGluZyBoYXMgYmVlbiBlc3RhYmxpc2hlZFxuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cbn1cblxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdEFyZWEoKXtcblx0dmFyIHggPSBuZXcgQXJlYSh7Ym91bmRzOiBbWzAsMV0sWzAsMV1dfSk7XG5cdHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiBmdW5jdGlvbiguLi5hKXtjb25zb2xlLmxvZyguLi5hKX19KTtcblx0eC5hZGQoeSk7XG5cdHguYWN0aXZhdGUoKTtcbn1cblxuZXhwb3J0IHsgQXJlYSB9XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IE5vZGUgZnJvbSAnLi9Ob2RlLmpzJztcblxuLy9Vc2FnZTogdmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpfX0pO1xuY2xhc3MgVHJhbnNmb3JtYXRpb24gZXh0ZW5kcyBOb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHRzdXBlcigpO1xuXHRcblx0XHRFWFAuVXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyhvcHRpb25zLCBcImV4cHJcIik7IC8vIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgbXVsdGlkaW1lbnNpb25hbCBhcnJheVxuXHRcdEVYUC5VdGlscy5hc3NlcnRUeXBlKG9wdGlvbnMuZXhwciwgRnVuY3Rpb24pO1xuXG5cdFx0dGhpcy5leHByID0gb3B0aW9ucy5leHByO1xuXG5cdFx0dGhpcy5jaGlsZHJlbiA9IFtdO1xuXHRcdHRoaXMucGFyZW50ID0gbnVsbDtcblx0fVxuXHRldmFsdWF0ZVNlbGYoLi4uY29vcmRpbmF0ZXMpe1xuXHRcdC8vZXZhbHVhdGUgdGhpcyBUcmFuc2Zvcm1hdGlvbidzIF9leHByLCBhbmQgYnJvYWRjYXN0IHRoZSByZXN1bHQgdG8gYWxsIGNoaWxkcmVuLlxuXHRcdGxldCByZXN1bHQgPSB0aGlzLmV4cHIoLi4uY29vcmRpbmF0ZXMpO1xuXHRcdGlmKHJlc3VsdC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpcmVzdWx0ID0gW3Jlc3VsdF07XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLmV2YWx1YXRlU2VsZihjb29yZGluYXRlc1swXSxjb29yZGluYXRlc1sxXSwgLi4ucmVzdWx0KVxuXHRcdH1cblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblxuXHRcdC8vYnV0IGNhbGwgYWxsIGNoaWxkcmVuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5vbkFmdGVyQWN0aXZhdGlvbigpXG5cdFx0fVxuXHR9XG5cdGNsb25lKCl7XG5cdFx0bGV0IHRoaXNFeHByID0gdGhpcy5leHByO1xuXHRcdGxldCBjbG9uZSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogdGhpc0V4cHIuYmluZCgpfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5cblxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdFRyYW5zZm9ybWF0aW9uKCl7XG5cdHZhciB4ID0gbmV3IEFyZWEoe2JvdW5kczogW1stMTAsMTBdXX0pO1xuXHR2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7J2V4cHInOiAoeCkgPT4gY29uc29sZS5sb2coeCp4KX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSgpOyAvLyBzaG91bGQgcmV0dXJuIDEwMCwgODEsIDY0Li4uIDAsIDEsIDQuLi4gMTAwXG59XG5cbmV4cG9ydCB7IFRyYW5zZm9ybWF0aW9uIH1cbiIsImltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi91dGlscy5qcyc7XG5cbmltcG9ydCB7IFRyYW5zZm9ybWF0aW9uIH0gZnJvbSAnLi9UcmFuc2Zvcm1hdGlvbi5qcyc7XG5cbmltcG9ydCAqIGFzIG1hdGggZnJvbSAnLi9tYXRoLmpzJztcblxuY2xhc3MgQW5pbWF0aW9ue1xuXHRjb25zdHJ1Y3Rvcih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbiwgc3RhZ2dlckZyYWN0aW9uKXtcblx0XHRVdGlscy5hc3NlcnRUeXBlKHRvVmFsdWVzLCBPYmplY3QpO1xuXG5cdFx0dGhpcy50b1ZhbHVlcyA9IHRvVmFsdWVzO1xuXHRcdHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1x0XG5cdFx0dGhpcy5zdGFnZ2VyRnJhY3Rpb24gPSBzdGFnZ2VyRnJhY3Rpb24gPT09IHVuZGVmaW5lZCA/IDAgOiBzdGFnZ2VyRnJhY3Rpb247IC8vIHRpbWUgaW4gbXMgYmV0d2VlbiBmaXJzdCBlbGVtZW50IGJlZ2lubmluZyB0aGUgYW5pbWF0aW9uIGFuZCBsYXN0IGVsZW1lbnQgYmVnaW5uaW5nIHRoZSBhbmltYXRpb24uIFNob3VsZCBiZSBsZXNzIHRoYW4gZHVyYXRpb24uXG5yXG5cblx0XHRVdGlscy5hc3NlcnQodGhpcy5zdGFnZ2VyRnJhY3Rpb24gPj0gMCAmJiB0aGlzLnN0YWdnZXJGcmFjdGlvbiA8IDEpO1xuXG5cdFx0dGhpcy5mcm9tVmFsdWVzID0ge307XG5cdFx0Zm9yKHZhciBwcm9wZXJ0eSBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdFV0aWxzLmFzc2VydFByb3BFeGlzdHModGhpcy50YXJnZXQsIHByb3BlcnR5KTtcblxuXHRcdFx0Ly9jb3B5IHByb3BlcnR5LCBtYWtpbmcgc3VyZSB0byBzdG9yZSB0aGUgY29ycmVjdCAndGhpcydcblx0XHRcdGlmKFV0aWxzLmlzRnVuY3Rpb24odGhpcy50YXJnZXRbcHJvcGVydHldKSl7XG5cdFx0XHRcdHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0gPSB0aGlzLnRhcmdldFtwcm9wZXJ0eV0uYmluZCh0aGlzLnRhcmdldCk7XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0dGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHRoaXMudGFyZ2V0W3Byb3BlcnR5XTtcblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbiA9PT0gdW5kZWZpbmVkID8gMSA6IGR1cmF0aW9uOyAvL2luIHNcblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblxuXG5cdFx0aWYodGFyZ2V0LmNvbnN0cnVjdG9yID09PSBUcmFuc2Zvcm1hdGlvbil7XG5cdFx0XHQvL2ZpbmQgb3V0IGhvdyBtYW55IG9iamVjdHMgYXJlIHBhc3NpbmcgdGhyb3VnaCB0aGlzIHRyYW5zZm9ybWF0aW9uXG5cdFx0XHRsZXQgcm9vdCA9IHRhcmdldDtcblx0XHRcdHdoaWxlKHJvb3QucGFyZW50ICE9PSBudWxsKXtcblx0XHRcdFx0cm9vdCA9IHJvb3QucGFyZW50O1xuXHRcdFx0fVxuXHRcdFx0dGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR9ZWxzZXtcblx0XHRcdGlmKHRoaXMuc3RhZ2dlckZyYWN0aW9uICE9IDApe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwic3RhZ2dlckZyYWN0aW9uIGNhbiBvbmx5IGJlIHVzZWQgd2hlbiBUcmFuc2l0aW9uVG8ncyB0YXJnZXQgaXMgYW4gRVhQLlRyYW5zZm9ybWF0aW9uIVwiKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL2JlZ2luXG5cdFx0dGhpcy5fdXBkYXRlQ2FsbGJhY2sgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpXG5cdFx0dGhyZWUub24oXCJ1cGRhdGVcIix0aGlzLl91cGRhdGVDYWxsYmFjayk7XG5cdH1cblx0dXBkYXRlKHRpbWUpe1xuXHRcdHRoaXMuZWxhcHNlZFRpbWUgKz0gdGltZS5kZWx0YTtcdFxuXG5cdFx0bGV0IHBlcmNlbnRhZ2UgPSB0aGlzLmVsYXBzZWRUaW1lL3RoaXMuZHVyYXRpb247XG5cblx0XHQvL2ludGVycG9sYXRlIHZhbHVlc1xuXHRcdGZvcihsZXQgcHJvcGVydHkgaW4gdGhpcy50b1ZhbHVlcyl7XG5cdFx0XHR0aGlzLmludGVycG9sYXRlKHBlcmNlbnRhZ2UsIHByb3BlcnR5LCB0aGlzLmZyb21WYWx1ZXNbcHJvcGVydHldLHRoaXMudG9WYWx1ZXNbcHJvcGVydHldKTtcblx0XHR9XG5cblx0XHRpZih0aGlzLmVsYXBzZWRUaW1lID49IHRoaXMuZHVyYXRpb24pe1xuXHRcdFx0dGhpcy5lbmQoKTtcblx0XHR9XG5cdH1cblx0aW50ZXJwb2xhdGUocGVyY2VudGFnZSwgcHJvcGVydHlOYW1lLCBmcm9tVmFsdWUsIHRvVmFsdWUpe1xuXHRcdGNvbnN0IG51bU9iamVjdHMgPSB0aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblxuXHRcdHZhciBuZXdWYWx1ZSA9IG51bGw7XG5cdFx0aWYodHlwZW9mKHRvVmFsdWUpID09PSBcIm51bWJlclwiICYmIHR5cGVvZihmcm9tVmFsdWUpID09PSBcIm51bWJlclwiKXtcblx0XHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24ocGVyY2VudGFnZSk7XG5cdFx0XHR0aGlzLnRhcmdldFtwcm9wZXJ0eU5hbWVdID0gdCp0b1ZhbHVlICsgKDEtdCkqZnJvbVZhbHVlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1lbHNlIGlmKFV0aWxzLmlzRnVuY3Rpb24odG9WYWx1ZSkgJiYgVXRpbHMuaXNGdW5jdGlvbihmcm9tVmFsdWUpKXtcblx0XHRcdC8vaWYgc3RhZ2dlckZyYWN0aW9uICE9IDAsIGl0J3MgdGhlIGFtb3VudCBvZiB0aW1lIGJldHdlZW4gdGhlIGZpcnN0IHBvaW50J3Mgc3RhcnQgdGltZSBhbmQgdGhlIGxhc3QgcG9pbnQncyBzdGFydCB0aW1lLlxuXHRcdFx0Ly9BU1NVTVBUSU9OOiB0aGUgZmlyc3QgdmFyaWFibGUgb2YgdGhpcyBmdW5jdGlvbiBpcyBpLCBhbmQgaXQncyBhc3N1bWVkIGkgaXMgemVyby1pbmRleGVkLlxuXG5cdFx0XHQvL2VuY2Fwc3VsYXRlIHBlcmNlbnRhZ2Vcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BlcnR5TmFtZV0gPSAoZnVuY3Rpb24oaSwgLi4uY29vcmRzKXtcblx0XHRcdFx0bGV0IGxlcnBGYWN0b3IgPSBwZXJjZW50YWdlLygxLXRoaXMuc3RhZ2dlckZyYWN0aW9uKSAtIGkqdGhpcy5zdGFnZ2VyRnJhY3Rpb24vdGhpcy50YXJnZXROdW1DYWxsc1BlckFjdGl2YXRpb247XG5cdFx0XHRcdC8vbGV0IHBlcmNlbnQgPSBNYXRoLm1pbihNYXRoLm1heChwZXJjZW50YWdlIC0gaS90aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbiAgICwxKSwwKTtcblxuXHRcdFx0XHRsZXQgdCA9IHRoaXMuaW50ZXJwb2xhdGlvbkZ1bmN0aW9uKE1hdGgubWF4KE1hdGgubWluKGxlcnBGYWN0b3IsMSksMCkpO1xuXHRcdFx0XHRyZXR1cm4gbWF0aC5sZXJwVmVjdG9ycyh0LHRvVmFsdWUoaSwgLi4uY29vcmRzKSxmcm9tVmFsdWUoaSwgLi4uY29vcmRzKSlcblx0XHRcdH0pLmJpbmQodGhpcyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fWVsc2V7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiQW5pbWF0aW9uIGNsYXNzIGNhbm5vdCB5ZXQgaGFuZGxlIHRyYW5zaXRpb25pbmcgYmV0d2VlbiB0aGluZ3MgdGhhdCBhcmVuJ3QgbnVtYmVycyBvciBmdW5jdGlvbnMhXCIpO1xuXHRcdH1cblxuXHR9XG5cdGludGVycG9sYXRpb25GdW5jdGlvbih4KXtcblx0XHRyZXR1cm4gdGhpcy5jb3NpbmVJbnRlcnBvbGF0aW9uKHgpO1xuXHR9XG5cdGNvc2luZUludGVycG9sYXRpb24oeCl7XG5cdFx0cmV0dXJuICgxLU1hdGguY29zKHgqTWF0aC5QSSkpLzI7XG5cdH1cblx0bGluZWFySW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4geDtcblx0fVxuXHRlbmQoKXtcblx0XHRmb3IodmFyIHByb3AgaW4gdGhpcy50b1ZhbHVlcyl7XG5cdFx0XHR0aGlzLnRhcmdldFtwcm9wXSA9IHRoaXMudG9WYWx1ZXNbcHJvcF07XG5cdFx0fVxuXHRcdHRocmVlLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ1cGRhdGVcIix0aGlzLl91cGRhdGVDYWxsYmFjayk7XG5cdFx0Ly9Ub2RvOiBkZWxldGUgdGhpc1xuXHR9XG59XG5cbi8vdG9kbzogcHV0IHRoaXMgaW50byBhIERpcmVjdG9yIGNsYXNzIHNvIHRoYXQgaXQgY2FuIGhhdmUgYW4gdW5kbyBzdGFja1xuZnVuY3Rpb24gVHJhbnNpdGlvblRvKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMsIHN0YWdnZXJGcmFjdGlvbil7XG5cdHZhciBhbmltYXRpb24gPSBuZXcgQW5pbWF0aW9uKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGR1cmF0aW9uTVMvMTAwMCwgc3RhZ2dlckZyYWN0aW9uKTtcbn1cblxuZXhwb3J0IHtUcmFuc2l0aW9uVG8sIEFuaW1hdGlvbn1cbiIsIihmdW5jdGlvbiAoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBsb29rdXAgPSBbXG5cdFx0XHQnQScsICdCJywgJ0MnLCAnRCcsICdFJywgJ0YnLCAnRycsICdIJyxcblx0XHRcdCdJJywgJ0onLCAnSycsICdMJywgJ00nLCAnTicsICdPJywgJ1AnLFxuXHRcdFx0J1EnLCAnUicsICdTJywgJ1QnLCAnVScsICdWJywgJ1cnLCAnWCcsXG5cdFx0XHQnWScsICdaJywgJ2EnLCAnYicsICdjJywgJ2QnLCAnZScsICdmJyxcblx0XHRcdCdnJywgJ2gnLCAnaScsICdqJywgJ2snLCAnbCcsICdtJywgJ24nLFxuXHRcdFx0J28nLCAncCcsICdxJywgJ3InLCAncycsICd0JywgJ3UnLCAndicsXG5cdFx0XHQndycsICd4JywgJ3knLCAneicsICcwJywgJzEnLCAnMicsICczJyxcblx0XHRcdCc0JywgJzUnLCAnNicsICc3JywgJzgnLCAnOScsICcrJywgJy8nXG5cdFx0XTtcblx0ZnVuY3Rpb24gY2xlYW4obGVuZ3RoKSB7XG5cdFx0dmFyIGksIGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGxlbmd0aCk7XG5cdFx0Zm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRidWZmZXJbaV0gPSAwO1xuXHRcdH1cblx0XHRyZXR1cm4gYnVmZmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gZXh0ZW5kKG9yaWcsIGxlbmd0aCwgYWRkTGVuZ3RoLCBtdWx0aXBsZU9mKSB7XG5cdFx0dmFyIG5ld1NpemUgPSBsZW5ndGggKyBhZGRMZW5ndGgsXG5cdFx0XHRidWZmZXIgPSBjbGVhbigocGFyc2VJbnQobmV3U2l6ZSAvIG11bHRpcGxlT2YpICsgMSkgKiBtdWx0aXBsZU9mKTtcblxuXHRcdGJ1ZmZlci5zZXQob3JpZyk7XG5cblx0XHRyZXR1cm4gYnVmZmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFkKG51bSwgYnl0ZXMsIGJhc2UpIHtcblx0XHRudW0gPSBudW0udG9TdHJpbmcoYmFzZSB8fCA4KTtcblx0XHRyZXR1cm4gXCIwMDAwMDAwMDAwMDBcIi5zdWJzdHIobnVtLmxlbmd0aCArIDEyIC0gYnl0ZXMpICsgbnVtO1xuXHR9XG5cblx0ZnVuY3Rpb24gc3RyaW5nVG9VaW50OCAoaW5wdXQsIG91dCwgb2Zmc2V0KSB7XG5cdFx0dmFyIGksIGxlbmd0aDtcblxuXHRcdG91dCA9IG91dCB8fCBjbGVhbihpbnB1dC5sZW5ndGgpO1xuXG5cdFx0b2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gaW5wdXQubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdG91dFtvZmZzZXRdID0gaW5wdXQuY2hhckNvZGVBdChpKTtcblx0XHRcdG9mZnNldCArPSAxO1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXQ7XG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0KHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGg7XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArIGxvb2t1cFtudW0gPj4gNiAmIDB4M0ZdICsgbG9va3VwW251bSAmIDB4M0ZdO1xuXHRcdH07XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKTtcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcCk7XG5cdFx0fVxuXG5cdFx0Ly8gdGhpcyBwcmV2ZW50cyBhbiBFUlJfSU5WQUxJRF9VUkwgaW4gQ2hyb21lIChGaXJlZm94IG9rYXkpXG5cdFx0c3dpdGNoIChvdXRwdXQubGVuZ3RoICUgNCkge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dDtcblx0fVxuXG5cdHdpbmRvdy51dGlscyA9IHt9XG5cdHdpbmRvdy51dGlscy5jbGVhbiA9IGNsZWFuO1xuXHR3aW5kb3cudXRpbHMucGFkID0gcGFkO1xuXHR3aW5kb3cudXRpbHMuZXh0ZW5kID0gZXh0ZW5kO1xuXHR3aW5kb3cudXRpbHMuc3RyaW5nVG9VaW50OCA9IHN0cmluZ1RvVWludDg7XG5cdHdpbmRvdy51dGlscy51aW50OFRvQmFzZTY0ID0gdWludDhUb0Jhc2U2NDtcbn0oKSk7XG5cbihmdW5jdGlvbiAoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXG4vKlxuc3RydWN0IHBvc2l4X2hlYWRlciB7ICAgICAgICAgICAgIC8vIGJ5dGUgb2Zmc2V0XG5cdGNoYXIgbmFtZVsxMDBdOyAgICAgICAgICAgICAgIC8vICAgMFxuXHRjaGFyIG1vZGVbOF07ICAgICAgICAgICAgICAgICAvLyAxMDBcblx0Y2hhciB1aWRbOF07ICAgICAgICAgICAgICAgICAgLy8gMTA4XG5cdGNoYXIgZ2lkWzhdOyAgICAgICAgICAgICAgICAgIC8vIDExNlxuXHRjaGFyIHNpemVbMTJdOyAgICAgICAgICAgICAgICAvLyAxMjRcblx0Y2hhciBtdGltZVsxMl07ICAgICAgICAgICAgICAgLy8gMTM2XG5cdGNoYXIgY2hrc3VtWzhdOyAgICAgICAgICAgICAgIC8vIDE0OFxuXHRjaGFyIHR5cGVmbGFnOyAgICAgICAgICAgICAgICAvLyAxNTZcblx0Y2hhciBsaW5rbmFtZVsxMDBdOyAgICAgICAgICAgLy8gMTU3XG5cdGNoYXIgbWFnaWNbNl07ICAgICAgICAgICAgICAgIC8vIDI1N1xuXHRjaGFyIHZlcnNpb25bMl07ICAgICAgICAgICAgICAvLyAyNjNcblx0Y2hhciB1bmFtZVszMl07ICAgICAgICAgICAgICAgLy8gMjY1XG5cdGNoYXIgZ25hbWVbMzJdOyAgICAgICAgICAgICAgIC8vIDI5N1xuXHRjaGFyIGRldm1ham9yWzhdOyAgICAgICAgICAgICAvLyAzMjlcblx0Y2hhciBkZXZtaW5vcls4XTsgICAgICAgICAgICAgLy8gMzM3XG5cdGNoYXIgcHJlZml4WzE1NV07ICAgICAgICAgICAgIC8vIDM0NVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDUwMFxufTtcbiovXG5cblx0dmFyIHV0aWxzID0gd2luZG93LnV0aWxzLFxuXHRcdGhlYWRlckZvcm1hdDtcblxuXHRoZWFkZXJGb3JtYXQgPSBbXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVOYW1lJyxcblx0XHRcdCdsZW5ndGgnOiAxMDBcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlTW9kZScsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3VpZCcsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2dpZCcsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVTaXplJyxcblx0XHRcdCdsZW5ndGgnOiAxMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ210aW1lJyxcblx0XHRcdCdsZW5ndGgnOiAxMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2NoZWNrc3VtJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndHlwZScsXG5cdFx0XHQnbGVuZ3RoJzogMVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2xpbmtOYW1lJyxcblx0XHRcdCdsZW5ndGgnOiAxMDBcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd1c3RhcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ293bmVyJyxcblx0XHRcdCdsZW5ndGgnOiAzMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2dyb3VwJyxcblx0XHRcdCdsZW5ndGgnOiAzMlxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ21ham9yTnVtYmVyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbWlub3JOdW1iZXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdmaWxlbmFtZVByZWZpeCcsXG5cdFx0XHQnbGVuZ3RoJzogMTU1XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAncGFkZGluZycsXG5cdFx0XHQnbGVuZ3RoJzogMTJcblx0XHR9XG5cdF07XG5cblx0ZnVuY3Rpb24gZm9ybWF0SGVhZGVyKGRhdGEsIGNiKSB7XG5cdFx0dmFyIGJ1ZmZlciA9IHV0aWxzLmNsZWFuKDUxMiksXG5cdFx0XHRvZmZzZXQgPSAwO1xuXG5cdFx0aGVhZGVyRm9ybWF0LmZvckVhY2goZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHR2YXIgc3RyID0gZGF0YVt2YWx1ZS5maWVsZF0gfHwgXCJcIixcblx0XHRcdFx0aSwgbGVuZ3RoO1xuXG5cdFx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSBzdHIubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdFx0YnVmZmVyW29mZnNldF0gPSBzdHIuY2hhckNvZGVBdChpKTtcblx0XHRcdFx0b2Zmc2V0ICs9IDE7XG5cdFx0XHR9XG5cblx0XHRcdG9mZnNldCArPSB2YWx1ZS5sZW5ndGggLSBpOyAvLyBzcGFjZSBpdCBvdXQgd2l0aCBudWxsc1xuXHRcdH0pO1xuXG5cdFx0aWYgKHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIGNiKGJ1ZmZlciwgb2Zmc2V0KTtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1ZmZlcjtcblx0fVxuXG5cdHdpbmRvdy5oZWFkZXIgPSB7fVxuXHR3aW5kb3cuaGVhZGVyLnN0cnVjdHVyZSA9IGhlYWRlckZvcm1hdDtcblx0d2luZG93LmhlYWRlci5mb3JtYXQgPSBmb3JtYXRIZWFkZXI7XG59KCkpO1xuXG4oZnVuY3Rpb24gKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgaGVhZGVyID0gd2luZG93LmhlYWRlcixcblx0XHR1dGlscyA9IHdpbmRvdy51dGlscyxcblx0XHRyZWNvcmRTaXplID0gNTEyLFxuXHRcdGJsb2NrU2l6ZTtcblxuXHRmdW5jdGlvbiBUYXIocmVjb3Jkc1BlckJsb2NrKSB7XG5cdFx0dGhpcy53cml0dGVuID0gMDtcblx0XHRibG9ja1NpemUgPSAocmVjb3Jkc1BlckJsb2NrIHx8IDIwKSAqIHJlY29yZFNpemU7XG5cdFx0dGhpcy5vdXQgPSB1dGlscy5jbGVhbihibG9ja1NpemUpO1xuXHRcdHRoaXMuYmxvY2tzID0gW107XG5cdFx0dGhpcy5sZW5ndGggPSAwO1xuXHR9XG5cblx0VGFyLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbiAoZmlsZXBhdGgsIGlucHV0LCBvcHRzLCBjYWxsYmFjaykge1xuXHRcdHZhciBkYXRhLFxuXHRcdFx0Y2hlY2tzdW0sXG5cdFx0XHRtb2RlLFxuXHRcdFx0bXRpbWUsXG5cdFx0XHR1aWQsXG5cdFx0XHRnaWQsXG5cdFx0XHRoZWFkZXJBcnI7XG5cblx0XHRpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0aW5wdXQgPSB1dGlscy5zdHJpbmdUb1VpbnQ4KGlucHV0KTtcblx0XHR9IGVsc2UgaWYgKGlucHV0LmNvbnN0cnVjdG9yICE9PSBVaW50OEFycmF5LnByb3RvdHlwZS5jb25zdHJ1Y3Rvcikge1xuXHRcdFx0dGhyb3cgJ0ludmFsaWQgaW5wdXQgdHlwZS4gWW91IGdhdmUgbWU6ICcgKyBpbnB1dC5jb25zdHJ1Y3Rvci50b1N0cmluZygpLm1hdGNoKC9mdW5jdGlvblxccyooWyRBLVphLXpfXVswLTlBLVphLXpfXSopXFxzKlxcKC8pWzFdO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0Y2FsbGJhY2sgPSBvcHRzO1xuXHRcdFx0b3B0cyA9IHt9O1xuXHRcdH1cblxuXHRcdG9wdHMgPSBvcHRzIHx8IHt9O1xuXG5cdFx0bW9kZSA9IG9wdHMubW9kZSB8fCBwYXJzZUludCgnNzc3JywgOCkgJiAweGZmZjtcblx0XHRtdGltZSA9IG9wdHMubXRpbWUgfHwgTWF0aC5mbG9vcigrbmV3IERhdGUoKSAvIDEwMDApO1xuXHRcdHVpZCA9IG9wdHMudWlkIHx8IDA7XG5cdFx0Z2lkID0gb3B0cy5naWQgfHwgMDtcblxuXHRcdGRhdGEgPSB7XG5cdFx0XHRmaWxlTmFtZTogZmlsZXBhdGgsXG5cdFx0XHRmaWxlTW9kZTogdXRpbHMucGFkKG1vZGUsIDcpLFxuXHRcdFx0dWlkOiB1dGlscy5wYWQodWlkLCA3KSxcblx0XHRcdGdpZDogdXRpbHMucGFkKGdpZCwgNyksXG5cdFx0XHRmaWxlU2l6ZTogdXRpbHMucGFkKGlucHV0Lmxlbmd0aCwgMTEpLFxuXHRcdFx0bXRpbWU6IHV0aWxzLnBhZChtdGltZSwgMTEpLFxuXHRcdFx0Y2hlY2tzdW06ICcgICAgICAgICcsXG5cdFx0XHR0eXBlOiAnMCcsIC8vIGp1c3QgYSBmaWxlXG5cdFx0XHR1c3RhcjogJ3VzdGFyICAnLFxuXHRcdFx0b3duZXI6IG9wdHMub3duZXIgfHwgJycsXG5cdFx0XHRncm91cDogb3B0cy5ncm91cCB8fCAnJ1xuXHRcdH07XG5cblx0XHQvLyBjYWxjdWxhdGUgdGhlIGNoZWNrc3VtXG5cdFx0Y2hlY2tzdW0gPSAwO1xuXHRcdE9iamVjdC5rZXlzKGRhdGEpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdFx0dmFyIGksIHZhbHVlID0gZGF0YVtrZXldLCBsZW5ndGg7XG5cblx0XHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHZhbHVlLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRcdGNoZWNrc3VtICs9IHZhbHVlLmNoYXJDb2RlQXQoaSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRkYXRhLmNoZWNrc3VtID0gdXRpbHMucGFkKGNoZWNrc3VtLCA2KSArIFwiXFx1MDAwMCBcIjtcblxuXHRcdGhlYWRlckFyciA9IGhlYWRlci5mb3JtYXQoZGF0YSk7XG5cblx0XHR2YXIgaGVhZGVyTGVuZ3RoID0gTWF0aC5jZWlsKCBoZWFkZXJBcnIubGVuZ3RoIC8gcmVjb3JkU2l6ZSApICogcmVjb3JkU2l6ZTtcblx0XHR2YXIgaW5wdXRMZW5ndGggPSBNYXRoLmNlaWwoIGlucHV0Lmxlbmd0aCAvIHJlY29yZFNpemUgKSAqIHJlY29yZFNpemU7XG5cblx0XHR0aGlzLmJsb2Nrcy5wdXNoKCB7IGhlYWRlcjogaGVhZGVyQXJyLCBpbnB1dDogaW5wdXQsIGhlYWRlckxlbmd0aDogaGVhZGVyTGVuZ3RoLCBpbnB1dExlbmd0aDogaW5wdXRMZW5ndGggfSApO1xuXG5cdH07XG5cblx0VGFyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgYnVmZmVycyA9IFtdO1xuXHRcdHZhciBjaHVua3MgPSBbXTtcblx0XHR2YXIgbGVuZ3RoID0gMDtcblx0XHR2YXIgbWF4ID0gTWF0aC5wb3coIDIsIDIwICk7XG5cblx0XHR2YXIgY2h1bmsgPSBbXTtcblx0XHR0aGlzLmJsb2Nrcy5mb3JFYWNoKCBmdW5jdGlvbiggYiApIHtcblx0XHRcdGlmKCBsZW5ndGggKyBiLmhlYWRlckxlbmd0aCArIGIuaW5wdXRMZW5ndGggPiBtYXggKSB7XG5cdFx0XHRcdGNodW5rcy5wdXNoKCB7IGJsb2NrczogY2h1bmssIGxlbmd0aDogbGVuZ3RoIH0gKTtcblx0XHRcdFx0Y2h1bmsgPSBbXTtcblx0XHRcdFx0bGVuZ3RoID0gMDtcblx0XHRcdH1cblx0XHRcdGNodW5rLnB1c2goIGIgKTtcblx0XHRcdGxlbmd0aCArPSBiLmhlYWRlckxlbmd0aCArIGIuaW5wdXRMZW5ndGg7XG5cdFx0fSApO1xuXHRcdGNodW5rcy5wdXNoKCB7IGJsb2NrczogY2h1bmssIGxlbmd0aDogbGVuZ3RoIH0gKTtcblxuXHRcdGNodW5rcy5mb3JFYWNoKCBmdW5jdGlvbiggYyApIHtcblxuXHRcdFx0dmFyIGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KCBjLmxlbmd0aCApO1xuXHRcdFx0dmFyIHdyaXR0ZW4gPSAwO1xuXHRcdFx0Yy5ibG9ja3MuZm9yRWFjaCggZnVuY3Rpb24oIGIgKSB7XG5cdFx0XHRcdGJ1ZmZlci5zZXQoIGIuaGVhZGVyLCB3cml0dGVuICk7XG5cdFx0XHRcdHdyaXR0ZW4gKz0gYi5oZWFkZXJMZW5ndGg7XG5cdFx0XHRcdGJ1ZmZlci5zZXQoIGIuaW5wdXQsIHdyaXR0ZW4gKTtcblx0XHRcdFx0d3JpdHRlbiArPSBiLmlucHV0TGVuZ3RoO1xuXHRcdFx0fSApO1xuXHRcdFx0YnVmZmVycy5wdXNoKCBidWZmZXIgKTtcblxuXHRcdH0gKTtcblxuXHRcdGJ1ZmZlcnMucHVzaCggbmV3IFVpbnQ4QXJyYXkoIDIgKiByZWNvcmRTaXplICkgKTtcblxuXHRcdHJldHVybiBuZXcgQmxvYiggYnVmZmVycywgeyB0eXBlOiAnb2N0ZXQvc3RyZWFtJyB9ICk7XG5cblx0fTtcblxuXHRUYXIucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMud3JpdHRlbiA9IDA7XG5cdFx0dGhpcy5vdXQgPSB1dGlscy5jbGVhbihibG9ja1NpemUpO1xuXHR9O1xuXG4gIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBUYXI7XG4gIH0gZWxzZSB7XG4gICAgd2luZG93LlRhciA9IFRhcjtcbiAgfVxufSgpKTtcbiIsIi8vZG93bmxvYWQuanMgdjMuMCwgYnkgZGFuZGF2aXM7IDIwMDgtMjAxNC4gW0NDQlkyXSBzZWUgaHR0cDovL2Rhbm1sLmNvbS9kb3dubG9hZC5odG1sIGZvciB0ZXN0cy91c2FnZVxuLy8gdjEgbGFuZGVkIGEgRkYrQ2hyb21lIGNvbXBhdCB3YXkgb2YgZG93bmxvYWRpbmcgc3RyaW5ncyB0byBsb2NhbCB1bi1uYW1lZCBmaWxlcywgdXBncmFkZWQgdG8gdXNlIGEgaGlkZGVuIGZyYW1lIGFuZCBvcHRpb25hbCBtaW1lXG4vLyB2MiBhZGRlZCBuYW1lZCBmaWxlcyB2aWEgYVtkb3dubG9hZF0sIG1zU2F2ZUJsb2IsIElFICgxMCspIHN1cHBvcnQsIGFuZCB3aW5kb3cuVVJMIHN1cHBvcnQgZm9yIGxhcmdlcitmYXN0ZXIgc2F2ZXMgdGhhbiBkYXRhVVJMc1xuLy8gdjMgYWRkZWQgZGF0YVVSTCBhbmQgQmxvYiBJbnB1dCwgYmluZC10b2dnbGUgYXJpdHksIGFuZCBsZWdhY3kgZGF0YVVSTCBmYWxsYmFjayB3YXMgaW1wcm92ZWQgd2l0aCBmb3JjZS1kb3dubG9hZCBtaW1lIGFuZCBiYXNlNjQgc3VwcG9ydFxuXG4vLyBkYXRhIGNhbiBiZSBhIHN0cmluZywgQmxvYiwgRmlsZSwgb3IgZGF0YVVSTFxuXG5cblxuXG5mdW5jdGlvbiBkb3dubG9hZChkYXRhLCBzdHJGaWxlTmFtZSwgc3RyTWltZVR5cGUpIHtcblxuXHR2YXIgc2VsZiA9IHdpbmRvdywgLy8gdGhpcyBzY3JpcHQgaXMgb25seSBmb3IgYnJvd3NlcnMgYW55d2F5Li4uXG5cdFx0dSA9IFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCIsIC8vIHRoaXMgZGVmYXVsdCBtaW1lIGFsc28gdHJpZ2dlcnMgaWZyYW1lIGRvd25sb2Fkc1xuXHRcdG0gPSBzdHJNaW1lVHlwZSB8fCB1LFxuXHRcdHggPSBkYXRhLFxuXHRcdEQgPSBkb2N1bWVudCxcblx0XHRhID0gRC5jcmVhdGVFbGVtZW50KFwiYVwiKSxcblx0XHR6ID0gZnVuY3Rpb24oYSl7cmV0dXJuIFN0cmluZyhhKTt9LFxuXG5cblx0XHRCID0gc2VsZi5CbG9iIHx8IHNlbGYuTW96QmxvYiB8fCBzZWxmLldlYktpdEJsb2IgfHwgeixcblx0XHRCQiA9IHNlbGYuTVNCbG9iQnVpbGRlciB8fCBzZWxmLldlYktpdEJsb2JCdWlsZGVyIHx8IHNlbGYuQmxvYkJ1aWxkZXIsXG5cdFx0Zm4gPSBzdHJGaWxlTmFtZSB8fCBcImRvd25sb2FkXCIsXG5cdFx0YmxvYixcblx0XHRiLFxuXHRcdHVhLFxuXHRcdGZyO1xuXG5cdC8vaWYodHlwZW9mIEIuYmluZCA9PT0gJ2Z1bmN0aW9uJyApeyBCPUIuYmluZChzZWxmKTsgfVxuXG5cdGlmKFN0cmluZyh0aGlzKT09PVwidHJ1ZVwiKXsgLy9yZXZlcnNlIGFyZ3VtZW50cywgYWxsb3dpbmcgZG93bmxvYWQuYmluZCh0cnVlLCBcInRleHQveG1sXCIsIFwiZXhwb3J0LnhtbFwiKSB0byBhY3QgYXMgYSBjYWxsYmFja1xuXHRcdHg9W3gsIG1dO1xuXHRcdG09eFswXTtcblx0XHR4PXhbMV07XG5cdH1cblxuXG5cblx0Ly9nbyBhaGVhZCBhbmQgZG93bmxvYWQgZGF0YVVSTHMgcmlnaHQgYXdheVxuXHRpZihTdHJpbmcoeCkubWF0Y2goL15kYXRhXFw6W1xcdytcXC1dK1xcL1tcXHcrXFwtXStbLDtdLykpe1xuXHRcdHJldHVybiBuYXZpZ2F0b3IubXNTYXZlQmxvYiA/ICAvLyBJRTEwIGNhbid0IGRvIGFbZG93bmxvYWRdLCBvbmx5IEJsb2JzOlxuXHRcdFx0bmF2aWdhdG9yLm1zU2F2ZUJsb2IoZDJiKHgpLCBmbikgOlxuXHRcdFx0c2F2ZXIoeCkgOyAvLyBldmVyeW9uZSBlbHNlIGNhbiBzYXZlIGRhdGFVUkxzIHVuLXByb2Nlc3NlZFxuXHR9Ly9lbmQgaWYgZGF0YVVSTCBwYXNzZWQ/XG5cblx0dHJ5e1xuXG5cdFx0YmxvYiA9IHggaW5zdGFuY2VvZiBCID9cblx0XHRcdHggOlxuXHRcdFx0bmV3IEIoW3hdLCB7dHlwZTogbX0pIDtcblx0fWNhdGNoKHkpe1xuXHRcdGlmKEJCKXtcblx0XHRcdGIgPSBuZXcgQkIoKTtcblx0XHRcdGIuYXBwZW5kKFt4XSk7XG5cdFx0XHRibG9iID0gYi5nZXRCbG9iKG0pOyAvLyB0aGUgYmxvYlxuXHRcdH1cblxuXHR9XG5cblxuXG5cdGZ1bmN0aW9uIGQyYih1KSB7XG5cdFx0dmFyIHA9IHUuc3BsaXQoL1s6OyxdLyksXG5cdFx0dD0gcFsxXSxcblx0XHRkZWM9IHBbMl0gPT0gXCJiYXNlNjRcIiA/IGF0b2IgOiBkZWNvZGVVUklDb21wb25lbnQsXG5cdFx0YmluPSBkZWMocC5wb3AoKSksXG5cdFx0bXg9IGJpbi5sZW5ndGgsXG5cdFx0aT0gMCxcblx0XHR1aWE9IG5ldyBVaW50OEFycmF5KG14KTtcblxuXHRcdGZvcihpO2k8bXg7KytpKSB1aWFbaV09IGJpbi5jaGFyQ29kZUF0KGkpO1xuXG5cdFx0cmV0dXJuIG5ldyBCKFt1aWFdLCB7dHlwZTogdH0pO1xuXHQgfVxuXG5cdGZ1bmN0aW9uIHNhdmVyKHVybCwgd2luTW9kZSl7XG5cblxuXHRcdGlmICgnZG93bmxvYWQnIGluIGEpIHsgLy9odG1sNSBBW2Rvd25sb2FkXVxuXHRcdFx0YS5ocmVmID0gdXJsO1xuXHRcdFx0YS5zZXRBdHRyaWJ1dGUoXCJkb3dubG9hZFwiLCBmbik7XG5cdFx0XHRhLmlubmVySFRNTCA9IFwiZG93bmxvYWRpbmcuLi5cIjtcblx0XHRcdGEuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdEQuYm9keS5hcHBlbmRDaGlsZChhKTtcblx0XHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGEuY2xpY2soKTtcblx0XHRcdFx0RC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xuXHRcdFx0XHRpZih3aW5Nb2RlPT09dHJ1ZSl7c2V0VGltZW91dChmdW5jdGlvbigpeyBzZWxmLlVSTC5yZXZva2VPYmplY3RVUkwoYS5ocmVmKTt9LCAyNTAgKTt9XG5cdFx0XHR9LCA2Nik7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvL2RvIGlmcmFtZSBkYXRhVVJMIGRvd25sb2FkIChvbGQgY2grRkYpOlxuXHRcdHZhciBmID0gRC5jcmVhdGVFbGVtZW50KFwiaWZyYW1lXCIpO1xuXHRcdEQuYm9keS5hcHBlbmRDaGlsZChmKTtcblx0XHRpZighd2luTW9kZSl7IC8vIGZvcmNlIGEgbWltZSB0aGF0IHdpbGwgZG93bmxvYWQ6XG5cdFx0XHR1cmw9XCJkYXRhOlwiK3VybC5yZXBsYWNlKC9eZGF0YTooW1xcd1xcL1xcLVxcK10rKS8sIHUpO1xuXHRcdH1cblxuXG5cdFx0Zi5zcmMgPSB1cmw7XG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpeyBELmJvZHkucmVtb3ZlQ2hpbGQoZik7IH0sIDMzMyk7XG5cblx0fS8vZW5kIHNhdmVyXG5cblxuXHRpZiAobmF2aWdhdG9yLm1zU2F2ZUJsb2IpIHsgLy8gSUUxMCsgOiAoaGFzIEJsb2IsIGJ1dCBub3QgYVtkb3dubG9hZF0gb3IgVVJMKVxuXHRcdHJldHVybiBuYXZpZ2F0b3IubXNTYXZlQmxvYihibG9iLCBmbik7XG5cdH1cblxuXHRpZihzZWxmLlVSTCl7IC8vIHNpbXBsZSBmYXN0IGFuZCBtb2Rlcm4gd2F5IHVzaW5nIEJsb2IgYW5kIFVSTDpcblx0XHRzYXZlcihzZWxmLlVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYiksIHRydWUpO1xuXHR9ZWxzZXtcblx0XHQvLyBoYW5kbGUgbm9uLUJsb2IoKStub24tVVJMIGJyb3dzZXJzOlxuXHRcdGlmKHR5cGVvZiBibG9iID09PSBcInN0cmluZ1wiIHx8IGJsb2IuY29uc3RydWN0b3I9PT16ICl7XG5cdFx0XHR0cnl7XG5cdFx0XHRcdHJldHVybiBzYXZlciggXCJkYXRhOlwiICsgIG0gICArIFwiO2Jhc2U2NCxcIiAgKyAgc2VsZi5idG9hKGJsb2IpICApO1xuXHRcdFx0fWNhdGNoKHkpe1xuXHRcdFx0XHRyZXR1cm4gc2F2ZXIoIFwiZGF0YTpcIiArICBtICAgKyBcIixcIiArIGVuY29kZVVSSUNvbXBvbmVudChibG9iKSAgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBCbG9iIGJ1dCBub3QgVVJMOlxuXHRcdGZyPW5ldyBGaWxlUmVhZGVyKCk7XG5cdFx0ZnIub25sb2FkPWZ1bmN0aW9uKGUpe1xuXHRcdFx0c2F2ZXIodGhpcy5yZXN1bHQpO1xuXHRcdH07XG5cdFx0ZnIucmVhZEFzRGF0YVVSTChibG9iKTtcblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn0gLyogZW5kIGRvd25sb2FkKCkgKi9cblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBkb3dubG9hZDtcbn1cbiIsIi8vIGdpZi5qcyAwLjIuMCAtIGh0dHBzOi8vZ2l0aHViLmNvbS9qbm9yZGJlcmcvZ2lmLmpzXHJcbihmdW5jdGlvbihmKXtpZih0eXBlb2YgZXhwb3J0cz09PVwib2JqZWN0XCImJnR5cGVvZiBtb2R1bGUhPT1cInVuZGVmaW5lZFwiKXttb2R1bGUuZXhwb3J0cz1mKCl9ZWxzZSBpZih0eXBlb2YgZGVmaW5lPT09XCJmdW5jdGlvblwiJiZkZWZpbmUuYW1kKXtkZWZpbmUoW10sZil9ZWxzZXt2YXIgZztpZih0eXBlb2Ygd2luZG93IT09XCJ1bmRlZmluZWRcIil7Zz13aW5kb3d9ZWxzZSBpZih0eXBlb2YgZ2xvYmFsIT09XCJ1bmRlZmluZWRcIil7Zz1nbG9iYWx9ZWxzZSBpZih0eXBlb2Ygc2VsZiE9PVwidW5kZWZpbmVkXCIpe2c9c2VsZn1lbHNle2c9dGhpc31nLkdJRj1mKCl9fSkoZnVuY3Rpb24oKXt2YXIgZGVmaW5lLG1vZHVsZSxleHBvcnRzO3JldHVybiBmdW5jdGlvbigpe2Z1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfXJldHVybiBlfSgpKHsxOltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXtmdW5jdGlvbiBFdmVudEVtaXR0ZXIoKXt0aGlzLl9ldmVudHM9dGhpcy5fZXZlbnRzfHx7fTt0aGlzLl9tYXhMaXN0ZW5lcnM9dGhpcy5fbWF4TGlzdGVuZXJzfHx1bmRlZmluZWR9bW9kdWxlLmV4cG9ydHM9RXZlbnRFbWl0dGVyO0V2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXI9RXZlbnRFbWl0dGVyO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cz11bmRlZmluZWQ7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzPXVuZGVmaW5lZDtFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycz0xMDtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycz1mdW5jdGlvbihuKXtpZighaXNOdW1iZXIobil8fG48MHx8aXNOYU4obikpdGhyb3cgVHlwZUVycm9yKFwibiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIpO3RoaXMuX21heExpc3RlbmVycz1uO3JldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQ9ZnVuY3Rpb24odHlwZSl7dmFyIGVyLGhhbmRsZXIsbGVuLGFyZ3MsaSxsaXN0ZW5lcnM7aWYoIXRoaXMuX2V2ZW50cyl0aGlzLl9ldmVudHM9e307aWYodHlwZT09PVwiZXJyb3JcIil7aWYoIXRoaXMuX2V2ZW50cy5lcnJvcnx8aXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSYmIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpe2VyPWFyZ3VtZW50c1sxXTtpZihlciBpbnN0YW5jZW9mIEVycm9yKXt0aHJvdyBlcn1lbHNle3ZhciBlcnI9bmV3IEVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LiAoJytlcitcIilcIik7ZXJyLmNvbnRleHQ9ZXI7dGhyb3cgZXJyfX19aGFuZGxlcj10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNVbmRlZmluZWQoaGFuZGxlcikpcmV0dXJuIGZhbHNlO2lmKGlzRnVuY3Rpb24oaGFuZGxlcikpe3N3aXRjaChhcmd1bWVudHMubGVuZ3RoKXtjYXNlIDE6aGFuZGxlci5jYWxsKHRoaXMpO2JyZWFrO2Nhc2UgMjpoYW5kbGVyLmNhbGwodGhpcyxhcmd1bWVudHNbMV0pO2JyZWFrO2Nhc2UgMzpoYW5kbGVyLmNhbGwodGhpcyxhcmd1bWVudHNbMV0sYXJndW1lbnRzWzJdKTticmVhaztkZWZhdWx0OmFyZ3M9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpO2hhbmRsZXIuYXBwbHkodGhpcyxhcmdzKX19ZWxzZSBpZihpc09iamVjdChoYW5kbGVyKSl7YXJncz1BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsMSk7bGlzdGVuZXJzPWhhbmRsZXIuc2xpY2UoKTtsZW49bGlzdGVuZXJzLmxlbmd0aDtmb3IoaT0wO2k8bGVuO2krKylsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcyxhcmdzKX1yZXR1cm4gdHJ1ZX07RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcj1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXt2YXIgbTtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO2lmKCF0aGlzLl9ldmVudHMpdGhpcy5fZXZlbnRzPXt9O2lmKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcil0aGlzLmVtaXQoXCJuZXdMaXN0ZW5lclwiLHR5cGUsaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcik/bGlzdGVuZXIubGlzdGVuZXI6bGlzdGVuZXIpO2lmKCF0aGlzLl9ldmVudHNbdHlwZV0pdGhpcy5fZXZlbnRzW3R5cGVdPWxpc3RlbmVyO2Vsc2UgaWYoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSl0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7ZWxzZSB0aGlzLl9ldmVudHNbdHlwZV09W3RoaXMuX2V2ZW50c1t0eXBlXSxsaXN0ZW5lcl07aWYoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSYmIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpe2lmKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKXttPXRoaXMuX21heExpc3RlbmVyc31lbHNle209RXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnN9aWYobSYmbT4wJiZ0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoPm0pe3RoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQ9dHJ1ZTtjb25zb2xlLmVycm9yKFwiKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgXCIrXCJsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuIFwiK1wiVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuXCIsdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7aWYodHlwZW9mIGNvbnNvbGUudHJhY2U9PT1cImZ1bmN0aW9uXCIpe2NvbnNvbGUudHJhY2UoKX19fXJldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uPUV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7dmFyIGZpcmVkPWZhbHNlO2Z1bmN0aW9uIGcoKXt0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsZyk7aWYoIWZpcmVkKXtmaXJlZD10cnVlO2xpc3RlbmVyLmFwcGx5KHRoaXMsYXJndW1lbnRzKX19Zy5saXN0ZW5lcj1saXN0ZW5lcjt0aGlzLm9uKHR5cGUsZyk7cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXI9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7dmFyIGxpc3QscG9zaXRpb24sbGVuZ3RoLGk7aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTtpZighdGhpcy5fZXZlbnRzfHwhdGhpcy5fZXZlbnRzW3R5cGVdKXJldHVybiB0aGlzO2xpc3Q9dGhpcy5fZXZlbnRzW3R5cGVdO2xlbmd0aD1saXN0Lmxlbmd0aDtwb3NpdGlvbj0tMTtpZihsaXN0PT09bGlzdGVuZXJ8fGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikmJmxpc3QubGlzdGVuZXI9PT1saXN0ZW5lcil7ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtpZih0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpdGhpcy5lbWl0KFwicmVtb3ZlTGlzdGVuZXJcIix0eXBlLGxpc3RlbmVyKX1lbHNlIGlmKGlzT2JqZWN0KGxpc3QpKXtmb3IoaT1sZW5ndGg7aS0tID4wOyl7aWYobGlzdFtpXT09PWxpc3RlbmVyfHxsaXN0W2ldLmxpc3RlbmVyJiZsaXN0W2ldLmxpc3RlbmVyPT09bGlzdGVuZXIpe3Bvc2l0aW9uPWk7YnJlYWt9fWlmKHBvc2l0aW9uPDApcmV0dXJuIHRoaXM7aWYobGlzdC5sZW5ndGg9PT0xKXtsaXN0Lmxlbmd0aD0wO2RlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV19ZWxzZXtsaXN0LnNwbGljZShwb3NpdGlvbiwxKX1pZih0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpdGhpcy5lbWl0KFwicmVtb3ZlTGlzdGVuZXJcIix0eXBlLGxpc3RlbmVyKX1yZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnM9ZnVuY3Rpb24odHlwZSl7dmFyIGtleSxsaXN0ZW5lcnM7aWYoIXRoaXMuX2V2ZW50cylyZXR1cm4gdGhpcztpZighdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKXtpZihhcmd1bWVudHMubGVuZ3RoPT09MCl0aGlzLl9ldmVudHM9e307ZWxzZSBpZih0aGlzLl9ldmVudHNbdHlwZV0pZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtyZXR1cm4gdGhpc31pZihhcmd1bWVudHMubGVuZ3RoPT09MCl7Zm9yKGtleSBpbiB0aGlzLl9ldmVudHMpe2lmKGtleT09PVwicmVtb3ZlTGlzdGVuZXJcIiljb250aW51ZTt0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpfXRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKFwicmVtb3ZlTGlzdGVuZXJcIik7dGhpcy5fZXZlbnRzPXt9O3JldHVybiB0aGlzfWxpc3RlbmVycz10aGlzLl9ldmVudHNbdHlwZV07aWYoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKXt0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsbGlzdGVuZXJzKX1lbHNlIGlmKGxpc3RlbmVycyl7d2hpbGUobGlzdGVuZXJzLmxlbmd0aCl0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGgtMV0pfWRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzPWZ1bmN0aW9uKHR5cGUpe3ZhciByZXQ7aWYoIXRoaXMuX2V2ZW50c3x8IXRoaXMuX2V2ZW50c1t0eXBlXSlyZXQ9W107ZWxzZSBpZihpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpcmV0PVt0aGlzLl9ldmVudHNbdHlwZV1dO2Vsc2UgcmV0PXRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO3JldHVybiByZXR9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudD1mdW5jdGlvbih0eXBlKXtpZih0aGlzLl9ldmVudHMpe3ZhciBldmxpc3RlbmVyPXRoaXMuX2V2ZW50c1t0eXBlXTtpZihpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKXJldHVybiAxO2Vsc2UgaWYoZXZsaXN0ZW5lcilyZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGh9cmV0dXJuIDB9O0V2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50PWZ1bmN0aW9uKGVtaXR0ZXIsdHlwZSl7cmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKX07ZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpe3JldHVybiB0eXBlb2YgYXJnPT09XCJmdW5jdGlvblwifWZ1bmN0aW9uIGlzTnVtYmVyKGFyZyl7cmV0dXJuIHR5cGVvZiBhcmc9PT1cIm51bWJlclwifWZ1bmN0aW9uIGlzT2JqZWN0KGFyZyl7cmV0dXJuIHR5cGVvZiBhcmc9PT1cIm9iamVjdFwiJiZhcmchPT1udWxsfWZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZyl7cmV0dXJuIGFyZz09PXZvaWQgMH19LHt9XSwyOltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgTmV1UXVhbnQ9cmVxdWlyZShcIi4vVHlwZWROZXVRdWFudC5qc1wiKTt2YXIgTFpXRW5jb2Rlcj1yZXF1aXJlKFwiLi9MWldFbmNvZGVyLmpzXCIpO2Z1bmN0aW9uIEJ5dGVBcnJheSgpe3RoaXMucGFnZT0tMTt0aGlzLnBhZ2VzPVtdO3RoaXMubmV3UGFnZSgpfUJ5dGVBcnJheS5wYWdlU2l6ZT00MDk2O0J5dGVBcnJheS5jaGFyTWFwPXt9O2Zvcih2YXIgaT0wO2k8MjU2O2krKylCeXRlQXJyYXkuY2hhck1hcFtpXT1TdHJpbmcuZnJvbUNoYXJDb2RlKGkpO0J5dGVBcnJheS5wcm90b3R5cGUubmV3UGFnZT1mdW5jdGlvbigpe3RoaXMucGFnZXNbKyt0aGlzLnBhZ2VdPW5ldyBVaW50OEFycmF5KEJ5dGVBcnJheS5wYWdlU2l6ZSk7dGhpcy5jdXJzb3I9MH07Qnl0ZUFycmF5LnByb3RvdHlwZS5nZXREYXRhPWZ1bmN0aW9uKCl7dmFyIHJ2PVwiXCI7Zm9yKHZhciBwPTA7cDx0aGlzLnBhZ2VzLmxlbmd0aDtwKyspe2Zvcih2YXIgaT0wO2k8Qnl0ZUFycmF5LnBhZ2VTaXplO2krKyl7cnYrPUJ5dGVBcnJheS5jaGFyTWFwW3RoaXMucGFnZXNbcF1baV1dfX1yZXR1cm4gcnZ9O0J5dGVBcnJheS5wcm90b3R5cGUud3JpdGVCeXRlPWZ1bmN0aW9uKHZhbCl7aWYodGhpcy5jdXJzb3I+PUJ5dGVBcnJheS5wYWdlU2l6ZSl0aGlzLm5ld1BhZ2UoKTt0aGlzLnBhZ2VzW3RoaXMucGFnZV1bdGhpcy5jdXJzb3IrK109dmFsfTtCeXRlQXJyYXkucHJvdG90eXBlLndyaXRlVVRGQnl0ZXM9ZnVuY3Rpb24oc3RyaW5nKXtmb3IodmFyIGw9c3RyaW5nLmxlbmd0aCxpPTA7aTxsO2krKyl0aGlzLndyaXRlQnl0ZShzdHJpbmcuY2hhckNvZGVBdChpKSl9O0J5dGVBcnJheS5wcm90b3R5cGUud3JpdGVCeXRlcz1mdW5jdGlvbihhcnJheSxvZmZzZXQsbGVuZ3RoKXtmb3IodmFyIGw9bGVuZ3RofHxhcnJheS5sZW5ndGgsaT1vZmZzZXR8fDA7aTxsO2krKyl0aGlzLndyaXRlQnl0ZShhcnJheVtpXSl9O2Z1bmN0aW9uIEdJRkVuY29kZXIod2lkdGgsaGVpZ2h0KXt0aGlzLndpZHRoPX5+d2lkdGg7dGhpcy5oZWlnaHQ9fn5oZWlnaHQ7dGhpcy50cmFuc3BhcmVudD1udWxsO3RoaXMudHJhbnNJbmRleD0wO3RoaXMucmVwZWF0PS0xO3RoaXMuZGVsYXk9MDt0aGlzLmltYWdlPW51bGw7dGhpcy5waXhlbHM9bnVsbDt0aGlzLmluZGV4ZWRQaXhlbHM9bnVsbDt0aGlzLmNvbG9yRGVwdGg9bnVsbDt0aGlzLmNvbG9yVGFiPW51bGw7dGhpcy5uZXVRdWFudD1udWxsO3RoaXMudXNlZEVudHJ5PW5ldyBBcnJheTt0aGlzLnBhbFNpemU9Nzt0aGlzLmRpc3Bvc2U9LTE7dGhpcy5maXJzdEZyYW1lPXRydWU7dGhpcy5zYW1wbGU9MTA7dGhpcy5kaXRoZXI9ZmFsc2U7dGhpcy5nbG9iYWxQYWxldHRlPWZhbHNlO3RoaXMub3V0PW5ldyBCeXRlQXJyYXl9R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGVsYXk9ZnVuY3Rpb24obWlsbGlzZWNvbmRzKXt0aGlzLmRlbGF5PU1hdGgucm91bmQobWlsbGlzZWNvbmRzLzEwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RnJhbWVSYXRlPWZ1bmN0aW9uKGZwcyl7dGhpcy5kZWxheT1NYXRoLnJvdW5kKDEwMC9mcHMpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXREaXNwb3NlPWZ1bmN0aW9uKGRpc3Bvc2FsQ29kZSl7aWYoZGlzcG9zYWxDb2RlPj0wKXRoaXMuZGlzcG9zZT1kaXNwb3NhbENvZGV9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFJlcGVhdD1mdW5jdGlvbihyZXBlYXQpe3RoaXMucmVwZWF0PXJlcGVhdH07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0VHJhbnNwYXJlbnQ9ZnVuY3Rpb24oY29sb3Ipe3RoaXMudHJhbnNwYXJlbnQ9Y29sb3J9O0dJRkVuY29kZXIucHJvdG90eXBlLmFkZEZyYW1lPWZ1bmN0aW9uKGltYWdlRGF0YSl7dGhpcy5pbWFnZT1pbWFnZURhdGE7dGhpcy5jb2xvclRhYj10aGlzLmdsb2JhbFBhbGV0dGUmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZT90aGlzLmdsb2JhbFBhbGV0dGU6bnVsbDt0aGlzLmdldEltYWdlUGl4ZWxzKCk7dGhpcy5hbmFseXplUGl4ZWxzKCk7aWYodGhpcy5nbG9iYWxQYWxldHRlPT09dHJ1ZSl0aGlzLmdsb2JhbFBhbGV0dGU9dGhpcy5jb2xvclRhYjtpZih0aGlzLmZpcnN0RnJhbWUpe3RoaXMud3JpdGVMU0QoKTt0aGlzLndyaXRlUGFsZXR0ZSgpO2lmKHRoaXMucmVwZWF0Pj0wKXt0aGlzLndyaXRlTmV0c2NhcGVFeHQoKX19dGhpcy53cml0ZUdyYXBoaWNDdHJsRXh0KCk7dGhpcy53cml0ZUltYWdlRGVzYygpO2lmKCF0aGlzLmZpcnN0RnJhbWUmJiF0aGlzLmdsb2JhbFBhbGV0dGUpdGhpcy53cml0ZVBhbGV0dGUoKTt0aGlzLndyaXRlUGl4ZWxzKCk7dGhpcy5maXJzdEZyYW1lPWZhbHNlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5maW5pc2g9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoNTkpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRRdWFsaXR5PWZ1bmN0aW9uKHF1YWxpdHkpe2lmKHF1YWxpdHk8MSlxdWFsaXR5PTE7dGhpcy5zYW1wbGU9cXVhbGl0eX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0RGl0aGVyPWZ1bmN0aW9uKGRpdGhlcil7aWYoZGl0aGVyPT09dHJ1ZSlkaXRoZXI9XCJGbG95ZFN0ZWluYmVyZ1wiO3RoaXMuZGl0aGVyPWRpdGhlcn07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0R2xvYmFsUGFsZXR0ZT1mdW5jdGlvbihwYWxldHRlKXt0aGlzLmdsb2JhbFBhbGV0dGU9cGFsZXR0ZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuZ2V0R2xvYmFsUGFsZXR0ZT1mdW5jdGlvbigpe3JldHVybiB0aGlzLmdsb2JhbFBhbGV0dGUmJnRoaXMuZ2xvYmFsUGFsZXR0ZS5zbGljZSYmdGhpcy5nbG9iYWxQYWxldHRlLnNsaWNlKDApfHx0aGlzLmdsb2JhbFBhbGV0dGV9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlSGVhZGVyPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVVVEZCeXRlcyhcIkdJRjg5YVwiKX07R0lGRW5jb2Rlci5wcm90b3R5cGUuYW5hbHl6ZVBpeGVscz1mdW5jdGlvbigpe2lmKCF0aGlzLmNvbG9yVGFiKXt0aGlzLm5ldVF1YW50PW5ldyBOZXVRdWFudCh0aGlzLnBpeGVscyx0aGlzLnNhbXBsZSk7dGhpcy5uZXVRdWFudC5idWlsZENvbG9ybWFwKCk7dGhpcy5jb2xvclRhYj10aGlzLm5ldVF1YW50LmdldENvbG9ybWFwKCl9aWYodGhpcy5kaXRoZXIpe3RoaXMuZGl0aGVyUGl4ZWxzKHRoaXMuZGl0aGVyLnJlcGxhY2UoXCItc2VycGVudGluZVwiLFwiXCIpLHRoaXMuZGl0aGVyLm1hdGNoKC8tc2VycGVudGluZS8pIT09bnVsbCl9ZWxzZXt0aGlzLmluZGV4UGl4ZWxzKCl9dGhpcy5waXhlbHM9bnVsbDt0aGlzLmNvbG9yRGVwdGg9ODt0aGlzLnBhbFNpemU9NztpZih0aGlzLnRyYW5zcGFyZW50IT09bnVsbCl7dGhpcy50cmFuc0luZGV4PXRoaXMuZmluZENsb3Nlc3QodGhpcy50cmFuc3BhcmVudCx0cnVlKX19O0dJRkVuY29kZXIucHJvdG90eXBlLmluZGV4UGl4ZWxzPWZ1bmN0aW9uKGltZ3Epe3ZhciBuUGl4PXRoaXMucGl4ZWxzLmxlbmd0aC8zO3RoaXMuaW5kZXhlZFBpeGVscz1uZXcgVWludDhBcnJheShuUGl4KTt2YXIgaz0wO2Zvcih2YXIgaj0wO2o8blBpeDtqKyspe3ZhciBpbmRleD10aGlzLmZpbmRDbG9zZXN0UkdCKHRoaXMucGl4ZWxzW2srK10mMjU1LHRoaXMucGl4ZWxzW2srK10mMjU1LHRoaXMucGl4ZWxzW2srK10mMjU1KTt0aGlzLnVzZWRFbnRyeVtpbmRleF09dHJ1ZTt0aGlzLmluZGV4ZWRQaXhlbHNbal09aW5kZXh9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5kaXRoZXJQaXhlbHM9ZnVuY3Rpb24oa2VybmVsLHNlcnBlbnRpbmUpe3ZhciBrZXJuZWxzPXtGYWxzZUZsb3lkU3RlaW5iZXJnOltbMy84LDEsMF0sWzMvOCwwLDFdLFsyLzgsMSwxXV0sRmxveWRTdGVpbmJlcmc6W1s3LzE2LDEsMF0sWzMvMTYsLTEsMV0sWzUvMTYsMCwxXSxbMS8xNiwxLDFdXSxTdHVja2k6W1s4LzQyLDEsMF0sWzQvNDIsMiwwXSxbMi80MiwtMiwxXSxbNC80MiwtMSwxXSxbOC80MiwwLDFdLFs0LzQyLDEsMV0sWzIvNDIsMiwxXSxbMS80MiwtMiwyXSxbMi80MiwtMSwyXSxbNC80MiwwLDJdLFsyLzQyLDEsMl0sWzEvNDIsMiwyXV0sQXRraW5zb246W1sxLzgsMSwwXSxbMS84LDIsMF0sWzEvOCwtMSwxXSxbMS84LDAsMV0sWzEvOCwxLDFdLFsxLzgsMCwyXV19O2lmKCFrZXJuZWx8fCFrZXJuZWxzW2tlcm5lbF0pe3Rocm93XCJVbmtub3duIGRpdGhlcmluZyBrZXJuZWw6IFwiK2tlcm5lbH12YXIgZHM9a2VybmVsc1trZXJuZWxdO3ZhciBpbmRleD0wLGhlaWdodD10aGlzLmhlaWdodCx3aWR0aD10aGlzLndpZHRoLGRhdGE9dGhpcy5waXhlbHM7dmFyIGRpcmVjdGlvbj1zZXJwZW50aW5lPy0xOjE7dGhpcy5pbmRleGVkUGl4ZWxzPW5ldyBVaW50OEFycmF5KHRoaXMucGl4ZWxzLmxlbmd0aC8zKTtmb3IodmFyIHk9MDt5PGhlaWdodDt5Kyspe2lmKHNlcnBlbnRpbmUpZGlyZWN0aW9uPWRpcmVjdGlvbiotMTtmb3IodmFyIHg9ZGlyZWN0aW9uPT0xPzA6d2lkdGgtMSx4ZW5kPWRpcmVjdGlvbj09MT93aWR0aDowO3ghPT14ZW5kO3grPWRpcmVjdGlvbil7aW5kZXg9eSp3aWR0aCt4O3ZhciBpZHg9aW5kZXgqMzt2YXIgcjE9ZGF0YVtpZHhdO3ZhciBnMT1kYXRhW2lkeCsxXTt2YXIgYjE9ZGF0YVtpZHgrMl07aWR4PXRoaXMuZmluZENsb3Nlc3RSR0IocjEsZzEsYjEpO3RoaXMudXNlZEVudHJ5W2lkeF09dHJ1ZTt0aGlzLmluZGV4ZWRQaXhlbHNbaW5kZXhdPWlkeDtpZHgqPTM7dmFyIHIyPXRoaXMuY29sb3JUYWJbaWR4XTt2YXIgZzI9dGhpcy5jb2xvclRhYltpZHgrMV07dmFyIGIyPXRoaXMuY29sb3JUYWJbaWR4KzJdO3ZhciBlcj1yMS1yMjt2YXIgZWc9ZzEtZzI7dmFyIGViPWIxLWIyO2Zvcih2YXIgaT1kaXJlY3Rpb249PTE/MDpkcy5sZW5ndGgtMSxlbmQ9ZGlyZWN0aW9uPT0xP2RzLmxlbmd0aDowO2khPT1lbmQ7aSs9ZGlyZWN0aW9uKXt2YXIgeDE9ZHNbaV1bMV07dmFyIHkxPWRzW2ldWzJdO2lmKHgxK3g+PTAmJngxK3g8d2lkdGgmJnkxK3k+PTAmJnkxK3k8aGVpZ2h0KXt2YXIgZD1kc1tpXVswXTtpZHg9aW5kZXgreDEreTEqd2lkdGg7aWR4Kj0zO2RhdGFbaWR4XT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeF0rZXIqZCkpO2RhdGFbaWR4KzFdPU1hdGgubWF4KDAsTWF0aC5taW4oMjU1LGRhdGFbaWR4KzFdK2VnKmQpKTtkYXRhW2lkeCsyXT1NYXRoLm1heCgwLE1hdGgubWluKDI1NSxkYXRhW2lkeCsyXStlYipkKSl9fX19fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5maW5kQ2xvc2VzdD1mdW5jdGlvbihjLHVzZWQpe3JldHVybiB0aGlzLmZpbmRDbG9zZXN0UkdCKChjJjE2NzExNjgwKT4+MTYsKGMmNjUyODApPj44LGMmMjU1LHVzZWQpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5maW5kQ2xvc2VzdFJHQj1mdW5jdGlvbihyLGcsYix1c2VkKXtpZih0aGlzLmNvbG9yVGFiPT09bnVsbClyZXR1cm4tMTtpZih0aGlzLm5ldVF1YW50JiYhdXNlZCl7cmV0dXJuIHRoaXMubmV1UXVhbnQubG9va3VwUkdCKHIsZyxiKX12YXIgYz1ifGc8PDh8cjw8MTY7dmFyIG1pbnBvcz0wO3ZhciBkbWluPTI1NioyNTYqMjU2O3ZhciBsZW49dGhpcy5jb2xvclRhYi5sZW5ndGg7Zm9yKHZhciBpPTAsaW5kZXg9MDtpPGxlbjtpbmRleCsrKXt2YXIgZHI9ci0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGRnPWctKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkYj1iLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZD1kcipkcitkZypkZytkYipkYjtpZigoIXVzZWR8fHRoaXMudXNlZEVudHJ5W2luZGV4XSkmJmQ8ZG1pbil7ZG1pbj1kO21pbnBvcz1pbmRleH19cmV0dXJuIG1pbnBvc307R0lGRW5jb2Rlci5wcm90b3R5cGUuZ2V0SW1hZ2VQaXhlbHM9ZnVuY3Rpb24oKXt2YXIgdz10aGlzLndpZHRoO3ZhciBoPXRoaXMuaGVpZ2h0O3RoaXMucGl4ZWxzPW5ldyBVaW50OEFycmF5KHcqaCozKTt2YXIgZGF0YT10aGlzLmltYWdlO3ZhciBzcmNQb3M9MDt2YXIgY291bnQ9MDtmb3IodmFyIGk9MDtpPGg7aSsrKXtmb3IodmFyIGo9MDtqPHc7aisrKXt0aGlzLnBpeGVsc1tjb3VudCsrXT1kYXRhW3NyY1BvcysrXTt0aGlzLnBpeGVsc1tjb3VudCsrXT1kYXRhW3NyY1BvcysrXTt0aGlzLnBpeGVsc1tjb3VudCsrXT1kYXRhW3NyY1BvcysrXTtzcmNQb3MrK319fTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUdyYXBoaWNDdHJsRXh0PWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDMzKTt0aGlzLm91dC53cml0ZUJ5dGUoMjQ5KTt0aGlzLm91dC53cml0ZUJ5dGUoNCk7dmFyIHRyYW5zcCxkaXNwO2lmKHRoaXMudHJhbnNwYXJlbnQ9PT1udWxsKXt0cmFuc3A9MDtkaXNwPTB9ZWxzZXt0cmFuc3A9MTtkaXNwPTJ9aWYodGhpcy5kaXNwb3NlPj0wKXtkaXNwPXRoaXMuZGlzcG9zZSY3fWRpc3A8PD0yO3RoaXMub3V0LndyaXRlQnl0ZSgwfGRpc3B8MHx0cmFuc3ApO3RoaXMud3JpdGVTaG9ydCh0aGlzLmRlbGF5KTt0aGlzLm91dC53cml0ZUJ5dGUodGhpcy50cmFuc0luZGV4KTt0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlSW1hZ2VEZXNjPWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDQ0KTt0aGlzLndyaXRlU2hvcnQoMCk7dGhpcy53cml0ZVNob3J0KDApO3RoaXMud3JpdGVTaG9ydCh0aGlzLndpZHRoKTt0aGlzLndyaXRlU2hvcnQodGhpcy5oZWlnaHQpO2lmKHRoaXMuZmlyc3RGcmFtZXx8dGhpcy5nbG9iYWxQYWxldHRlKXt0aGlzLm91dC53cml0ZUJ5dGUoMCl9ZWxzZXt0aGlzLm91dC53cml0ZUJ5dGUoMTI4fDB8MHwwfHRoaXMucGFsU2l6ZSl9fTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZUxTRD1mdW5jdGlvbigpe3RoaXMud3JpdGVTaG9ydCh0aGlzLndpZHRoKTt0aGlzLndyaXRlU2hvcnQodGhpcy5oZWlnaHQpO3RoaXMub3V0LndyaXRlQnl0ZSgxMjh8MTEyfDB8dGhpcy5wYWxTaXplKTt0aGlzLm91dC53cml0ZUJ5dGUoMCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZU5ldHNjYXBlRXh0PWZ1bmN0aW9uKCl7dGhpcy5vdXQud3JpdGVCeXRlKDMzKTt0aGlzLm91dC53cml0ZUJ5dGUoMjU1KTt0aGlzLm91dC53cml0ZUJ5dGUoMTEpO3RoaXMub3V0LndyaXRlVVRGQnl0ZXMoXCJORVRTQ0FQRTIuMFwiKTt0aGlzLm91dC53cml0ZUJ5dGUoMyk7dGhpcy5vdXQud3JpdGVCeXRlKDEpO3RoaXMud3JpdGVTaG9ydCh0aGlzLnJlcGVhdCk7dGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZVBhbGV0dGU9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGVzKHRoaXMuY29sb3JUYWIpO3ZhciBuPTMqMjU2LXRoaXMuY29sb3JUYWIubGVuZ3RoO2Zvcih2YXIgaT0wO2k8bjtpKyspdGhpcy5vdXQud3JpdGVCeXRlKDApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZVNob3J0PWZ1bmN0aW9uKHBWYWx1ZSl7dGhpcy5vdXQud3JpdGVCeXRlKHBWYWx1ZSYyNTUpO3RoaXMub3V0LndyaXRlQnl0ZShwVmFsdWU+PjgmMjU1KX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVQaXhlbHM9ZnVuY3Rpb24oKXt2YXIgZW5jPW5ldyBMWldFbmNvZGVyKHRoaXMud2lkdGgsdGhpcy5oZWlnaHQsdGhpcy5pbmRleGVkUGl4ZWxzLHRoaXMuY29sb3JEZXB0aCk7ZW5jLmVuY29kZSh0aGlzLm91dCl9O0dJRkVuY29kZXIucHJvdG90eXBlLnN0cmVhbT1mdW5jdGlvbigpe3JldHVybiB0aGlzLm91dH07bW9kdWxlLmV4cG9ydHM9R0lGRW5jb2Rlcn0se1wiLi9MWldFbmNvZGVyLmpzXCI6MyxcIi4vVHlwZWROZXVRdWFudC5qc1wiOjR9XSwzOltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgRU9GPS0xO3ZhciBCSVRTPTEyO3ZhciBIU0laRT01MDAzO3ZhciBtYXNrcz1bMCwxLDMsNywxNSwzMSw2MywxMjcsMjU1LDUxMSwxMDIzLDIwNDcsNDA5NSw4MTkxLDE2MzgzLDMyNzY3LDY1NTM1XTtmdW5jdGlvbiBMWldFbmNvZGVyKHdpZHRoLGhlaWdodCxwaXhlbHMsY29sb3JEZXB0aCl7dmFyIGluaXRDb2RlU2l6ZT1NYXRoLm1heCgyLGNvbG9yRGVwdGgpO3ZhciBhY2N1bT1uZXcgVWludDhBcnJheSgyNTYpO3ZhciBodGFiPW5ldyBJbnQzMkFycmF5KEhTSVpFKTt2YXIgY29kZXRhYj1uZXcgSW50MzJBcnJheShIU0laRSk7dmFyIGN1cl9hY2N1bSxjdXJfYml0cz0wO3ZhciBhX2NvdW50O3ZhciBmcmVlX2VudD0wO3ZhciBtYXhjb2RlO3ZhciBjbGVhcl9mbGc9ZmFsc2U7dmFyIGdfaW5pdF9iaXRzLENsZWFyQ29kZSxFT0ZDb2RlO2Z1bmN0aW9uIGNoYXJfb3V0KGMsb3V0cyl7YWNjdW1bYV9jb3VudCsrXT1jO2lmKGFfY291bnQ+PTI1NClmbHVzaF9jaGFyKG91dHMpfWZ1bmN0aW9uIGNsX2Jsb2NrKG91dHMpe2NsX2hhc2goSFNJWkUpO2ZyZWVfZW50PUNsZWFyQ29kZSsyO2NsZWFyX2ZsZz10cnVlO291dHB1dChDbGVhckNvZGUsb3V0cyl9ZnVuY3Rpb24gY2xfaGFzaChoc2l6ZSl7Zm9yKHZhciBpPTA7aTxoc2l6ZTsrK2kpaHRhYltpXT0tMX1mdW5jdGlvbiBjb21wcmVzcyhpbml0X2JpdHMsb3V0cyl7dmFyIGZjb2RlLGMsaSxlbnQsZGlzcCxoc2l6ZV9yZWcsaHNoaWZ0O2dfaW5pdF9iaXRzPWluaXRfYml0cztjbGVhcl9mbGc9ZmFsc2U7bl9iaXRzPWdfaW5pdF9iaXRzO21heGNvZGU9TUFYQ09ERShuX2JpdHMpO0NsZWFyQ29kZT0xPDxpbml0X2JpdHMtMTtFT0ZDb2RlPUNsZWFyQ29kZSsxO2ZyZWVfZW50PUNsZWFyQ29kZSsyO2FfY291bnQ9MDtlbnQ9bmV4dFBpeGVsKCk7aHNoaWZ0PTA7Zm9yKGZjb2RlPUhTSVpFO2Zjb2RlPDY1NTM2O2Zjb2RlKj0yKSsraHNoaWZ0O2hzaGlmdD04LWhzaGlmdDtoc2l6ZV9yZWc9SFNJWkU7Y2xfaGFzaChoc2l6ZV9yZWcpO291dHB1dChDbGVhckNvZGUsb3V0cyk7b3V0ZXJfbG9vcDp3aGlsZSgoYz1uZXh0UGl4ZWwoKSkhPUVPRil7ZmNvZGU9KGM8PEJJVFMpK2VudDtpPWM8PGhzaGlmdF5lbnQ7aWYoaHRhYltpXT09PWZjb2RlKXtlbnQ9Y29kZXRhYltpXTtjb250aW51ZX1lbHNlIGlmKGh0YWJbaV0+PTApe2Rpc3A9aHNpemVfcmVnLWk7aWYoaT09PTApZGlzcD0xO2Rve2lmKChpLT1kaXNwKTwwKWkrPWhzaXplX3JlZztpZihodGFiW2ldPT09ZmNvZGUpe2VudD1jb2RldGFiW2ldO2NvbnRpbnVlIG91dGVyX2xvb3B9fXdoaWxlKGh0YWJbaV0+PTApfW91dHB1dChlbnQsb3V0cyk7ZW50PWM7aWYoZnJlZV9lbnQ8MTw8QklUUyl7Y29kZXRhYltpXT1mcmVlX2VudCsrO2h0YWJbaV09ZmNvZGV9ZWxzZXtjbF9ibG9jayhvdXRzKX19b3V0cHV0KGVudCxvdXRzKTtvdXRwdXQoRU9GQ29kZSxvdXRzKX1mdW5jdGlvbiBlbmNvZGUob3V0cyl7b3V0cy53cml0ZUJ5dGUoaW5pdENvZGVTaXplKTtyZW1haW5pbmc9d2lkdGgqaGVpZ2h0O2N1clBpeGVsPTA7Y29tcHJlc3MoaW5pdENvZGVTaXplKzEsb3V0cyk7b3V0cy53cml0ZUJ5dGUoMCl9ZnVuY3Rpb24gZmx1c2hfY2hhcihvdXRzKXtpZihhX2NvdW50PjApe291dHMud3JpdGVCeXRlKGFfY291bnQpO291dHMud3JpdGVCeXRlcyhhY2N1bSwwLGFfY291bnQpO2FfY291bnQ9MH19ZnVuY3Rpb24gTUFYQ09ERShuX2JpdHMpe3JldHVybigxPDxuX2JpdHMpLTF9ZnVuY3Rpb24gbmV4dFBpeGVsKCl7aWYocmVtYWluaW5nPT09MClyZXR1cm4gRU9GOy0tcmVtYWluaW5nO3ZhciBwaXg9cGl4ZWxzW2N1clBpeGVsKytdO3JldHVybiBwaXgmMjU1fWZ1bmN0aW9uIG91dHB1dChjb2RlLG91dHMpe2N1cl9hY2N1bSY9bWFza3NbY3VyX2JpdHNdO2lmKGN1cl9iaXRzPjApY3VyX2FjY3VtfD1jb2RlPDxjdXJfYml0cztlbHNlIGN1cl9hY2N1bT1jb2RlO2N1cl9iaXRzKz1uX2JpdHM7d2hpbGUoY3VyX2JpdHM+PTgpe2NoYXJfb3V0KGN1cl9hY2N1bSYyNTUsb3V0cyk7Y3VyX2FjY3VtPj49ODtjdXJfYml0cy09OH1pZihmcmVlX2VudD5tYXhjb2RlfHxjbGVhcl9mbGcpe2lmKGNsZWFyX2ZsZyl7bWF4Y29kZT1NQVhDT0RFKG5fYml0cz1nX2luaXRfYml0cyk7Y2xlYXJfZmxnPWZhbHNlfWVsc2V7KytuX2JpdHM7aWYobl9iaXRzPT1CSVRTKW1heGNvZGU9MTw8QklUUztlbHNlIG1heGNvZGU9TUFYQ09ERShuX2JpdHMpfX1pZihjb2RlPT1FT0ZDb2RlKXt3aGlsZShjdXJfYml0cz4wKXtjaGFyX291dChjdXJfYWNjdW0mMjU1LG91dHMpO2N1cl9hY2N1bT4+PTg7Y3VyX2JpdHMtPTh9Zmx1c2hfY2hhcihvdXRzKX19dGhpcy5lbmNvZGU9ZW5jb2RlfW1vZHVsZS5leHBvcnRzPUxaV0VuY29kZXJ9LHt9XSw0OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgbmN5Y2xlcz0xMDA7dmFyIG5ldHNpemU9MjU2O3ZhciBtYXhuZXRwb3M9bmV0c2l6ZS0xO3ZhciBuZXRiaWFzc2hpZnQ9NDt2YXIgaW50Ymlhc3NoaWZ0PTE2O3ZhciBpbnRiaWFzPTE8PGludGJpYXNzaGlmdDt2YXIgZ2FtbWFzaGlmdD0xMDt2YXIgZ2FtbWE9MTw8Z2FtbWFzaGlmdDt2YXIgYmV0YXNoaWZ0PTEwO3ZhciBiZXRhPWludGJpYXM+PmJldGFzaGlmdDt2YXIgYmV0YWdhbW1hPWludGJpYXM8PGdhbW1hc2hpZnQtYmV0YXNoaWZ0O3ZhciBpbml0cmFkPW5ldHNpemU+PjM7dmFyIHJhZGl1c2JpYXNzaGlmdD02O3ZhciByYWRpdXNiaWFzPTE8PHJhZGl1c2JpYXNzaGlmdDt2YXIgaW5pdHJhZGl1cz1pbml0cmFkKnJhZGl1c2JpYXM7dmFyIHJhZGl1c2RlYz0zMDt2YXIgYWxwaGFiaWFzc2hpZnQ9MTA7dmFyIGluaXRhbHBoYT0xPDxhbHBoYWJpYXNzaGlmdDt2YXIgYWxwaGFkZWM7dmFyIHJhZGJpYXNzaGlmdD04O3ZhciByYWRiaWFzPTE8PHJhZGJpYXNzaGlmdDt2YXIgYWxwaGFyYWRic2hpZnQ9YWxwaGFiaWFzc2hpZnQrcmFkYmlhc3NoaWZ0O3ZhciBhbHBoYXJhZGJpYXM9MTw8YWxwaGFyYWRic2hpZnQ7dmFyIHByaW1lMT00OTk7dmFyIHByaW1lMj00OTE7dmFyIHByaW1lMz00ODc7dmFyIHByaW1lND01MDM7dmFyIG1pbnBpY3R1cmVieXRlcz0zKnByaW1lNDtmdW5jdGlvbiBOZXVRdWFudChwaXhlbHMsc2FtcGxlZmFjKXt2YXIgbmV0d29yazt2YXIgbmV0aW5kZXg7dmFyIGJpYXM7dmFyIGZyZXE7dmFyIHJhZHBvd2VyO2Z1bmN0aW9uIGluaXQoKXtuZXR3b3JrPVtdO25ldGluZGV4PW5ldyBJbnQzMkFycmF5KDI1Nik7Ymlhcz1uZXcgSW50MzJBcnJheShuZXRzaXplKTtmcmVxPW5ldyBJbnQzMkFycmF5KG5ldHNpemUpO3JhZHBvd2VyPW5ldyBJbnQzMkFycmF5KG5ldHNpemU+PjMpO3ZhciBpLHY7Zm9yKGk9MDtpPG5ldHNpemU7aSsrKXt2PShpPDxuZXRiaWFzc2hpZnQrOCkvbmV0c2l6ZTtuZXR3b3JrW2ldPW5ldyBGbG9hdDY0QXJyYXkoW3Ysdix2LDBdKTtmcmVxW2ldPWludGJpYXMvbmV0c2l6ZTtiaWFzW2ldPTB9fWZ1bmN0aW9uIHVuYmlhc25ldCgpe2Zvcih2YXIgaT0wO2k8bmV0c2l6ZTtpKyspe25ldHdvcmtbaV1bMF0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVsxXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzJdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bM109aX19ZnVuY3Rpb24gYWx0ZXJzaW5nbGUoYWxwaGEsaSxiLGcscil7bmV0d29ya1tpXVswXS09YWxwaGEqKG5ldHdvcmtbaV1bMF0tYikvaW5pdGFscGhhO25ldHdvcmtbaV1bMV0tPWFscGhhKihuZXR3b3JrW2ldWzFdLWcpL2luaXRhbHBoYTtuZXR3b3JrW2ldWzJdLT1hbHBoYSoobmV0d29ya1tpXVsyXS1yKS9pbml0YWxwaGF9ZnVuY3Rpb24gYWx0ZXJuZWlnaChyYWRpdXMsaSxiLGcscil7dmFyIGxvPU1hdGguYWJzKGktcmFkaXVzKTt2YXIgaGk9TWF0aC5taW4oaStyYWRpdXMsbmV0c2l6ZSk7dmFyIGo9aSsxO3ZhciBrPWktMTt2YXIgbT0xO3ZhciBwLGE7d2hpbGUoajxoaXx8az5sbyl7YT1yYWRwb3dlclttKytdO2lmKGo8aGkpe3A9bmV0d29ya1tqKytdO3BbMF0tPWEqKHBbMF0tYikvYWxwaGFyYWRiaWFzO3BbMV0tPWEqKHBbMV0tZykvYWxwaGFyYWRiaWFzO3BbMl0tPWEqKHBbMl0tcikvYWxwaGFyYWRiaWFzfWlmKGs+bG8pe3A9bmV0d29ya1trLS1dO3BbMF0tPWEqKHBbMF0tYikvYWxwaGFyYWRiaWFzO3BbMV0tPWEqKHBbMV0tZykvYWxwaGFyYWRiaWFzO3BbMl0tPWEqKHBbMl0tcikvYWxwaGFyYWRiaWFzfX19ZnVuY3Rpb24gY29udGVzdChiLGcscil7dmFyIGJlc3RkPX4oMTw8MzEpO3ZhciBiZXN0Ymlhc2Q9YmVzdGQ7dmFyIGJlc3Rwb3M9LTE7dmFyIGJlc3RiaWFzcG9zPWJlc3Rwb3M7dmFyIGksbixkaXN0LGJpYXNkaXN0LGJldGFmcmVxO2ZvcihpPTA7aTxuZXRzaXplO2krKyl7bj1uZXR3b3JrW2ldO2Rpc3Q9TWF0aC5hYnMoblswXS1iKStNYXRoLmFicyhuWzFdLWcpK01hdGguYWJzKG5bMl0tcik7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0cG9zPWl9Ymlhc2Rpc3Q9ZGlzdC0oYmlhc1tpXT4+aW50Ymlhc3NoaWZ0LW5ldGJpYXNzaGlmdCk7aWYoYmlhc2Rpc3Q8YmVzdGJpYXNkKXtiZXN0Ymlhc2Q9Ymlhc2Rpc3Q7YmVzdGJpYXNwb3M9aX1iZXRhZnJlcT1mcmVxW2ldPj5iZXRhc2hpZnQ7ZnJlcVtpXS09YmV0YWZyZXE7Ymlhc1tpXSs9YmV0YWZyZXE8PGdhbW1hc2hpZnR9ZnJlcVtiZXN0cG9zXSs9YmV0YTtiaWFzW2Jlc3Rwb3NdLT1iZXRhZ2FtbWE7cmV0dXJuIGJlc3RiaWFzcG9zfWZ1bmN0aW9uIGlueGJ1aWxkKCl7dmFyIGksaixwLHEsc21hbGxwb3Msc21hbGx2YWwscHJldmlvdXNjb2w9MCxzdGFydHBvcz0wO2ZvcihpPTA7aTxuZXRzaXplO2krKyl7cD1uZXR3b3JrW2ldO3NtYWxscG9zPWk7c21hbGx2YWw9cFsxXTtmb3Ioaj1pKzE7ajxuZXRzaXplO2orKyl7cT1uZXR3b3JrW2pdO2lmKHFbMV08c21hbGx2YWwpe3NtYWxscG9zPWo7c21hbGx2YWw9cVsxXX19cT1uZXR3b3JrW3NtYWxscG9zXTtpZihpIT1zbWFsbHBvcyl7aj1xWzBdO3FbMF09cFswXTtwWzBdPWo7aj1xWzFdO3FbMV09cFsxXTtwWzFdPWo7aj1xWzJdO3FbMl09cFsyXTtwWzJdPWo7aj1xWzNdO3FbM109cFszXTtwWzNdPWp9aWYoc21hbGx2YWwhPXByZXZpb3VzY29sKXtuZXRpbmRleFtwcmV2aW91c2NvbF09c3RhcnRwb3MraT4+MTtmb3Ioaj1wcmV2aW91c2NvbCsxO2o8c21hbGx2YWw7aisrKW5ldGluZGV4W2pdPWk7cHJldmlvdXNjb2w9c21hbGx2YWw7c3RhcnRwb3M9aX19bmV0aW5kZXhbcHJldmlvdXNjb2xdPXN0YXJ0cG9zK21heG5ldHBvcz4+MTtmb3Ioaj1wcmV2aW91c2NvbCsxO2o8MjU2O2orKyluZXRpbmRleFtqXT1tYXhuZXRwb3N9ZnVuY3Rpb24gaW54c2VhcmNoKGIsZyxyKXt2YXIgYSxwLGRpc3Q7dmFyIGJlc3RkPTFlMzt2YXIgYmVzdD0tMTt2YXIgaT1uZXRpbmRleFtnXTt2YXIgaj1pLTE7d2hpbGUoaTxuZXRzaXplfHxqPj0wKXtpZihpPG5ldHNpemUpe3A9bmV0d29ya1tpXTtkaXN0PXBbMV0tZztpZihkaXN0Pj1iZXN0ZClpPW5ldHNpemU7ZWxzZXtpKys7aWYoZGlzdDwwKWRpc3Q9LWRpc3Q7YT1wWzBdLWI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXthPXBbMl0tcjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdD1wWzNdfX19fWlmKGo+PTApe3A9bmV0d29ya1tqXTtkaXN0PWctcFsxXTtpZihkaXN0Pj1iZXN0ZClqPS0xO2Vsc2V7ai0tO2lmKGRpc3Q8MClkaXN0PS1kaXN0O2E9cFswXS1iO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YT1wWzJdLXI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Q9cFszXX19fX19cmV0dXJuIGJlc3R9ZnVuY3Rpb24gbGVhcm4oKXt2YXIgaTt2YXIgbGVuZ3RoY291bnQ9cGl4ZWxzLmxlbmd0aDt2YXIgYWxwaGFkZWM9MzArKHNhbXBsZWZhYy0xKS8zO3ZhciBzYW1wbGVwaXhlbHM9bGVuZ3RoY291bnQvKDMqc2FtcGxlZmFjKTt2YXIgZGVsdGE9fn4oc2FtcGxlcGl4ZWxzL25jeWNsZXMpO3ZhciBhbHBoYT1pbml0YWxwaGE7dmFyIHJhZGl1cz1pbml0cmFkaXVzO3ZhciByYWQ9cmFkaXVzPj5yYWRpdXNiaWFzc2hpZnQ7aWYocmFkPD0xKXJhZD0wO2ZvcihpPTA7aTxyYWQ7aSsrKXJhZHBvd2VyW2ldPWFscGhhKigocmFkKnJhZC1pKmkpKnJhZGJpYXMvKHJhZCpyYWQpKTt2YXIgc3RlcDtpZihsZW5ndGhjb3VudDxtaW5waWN0dXJlYnl0ZXMpe3NhbXBsZWZhYz0xO3N0ZXA9M31lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMSE9PTApe3N0ZXA9MypwcmltZTF9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTIhPT0wKXtzdGVwPTMqcHJpbWUyfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUzIT09MCl7c3RlcD0zKnByaW1lM31lbHNle3N0ZXA9MypwcmltZTR9dmFyIGIsZyxyLGo7dmFyIHBpeD0wO2k9MDt3aGlsZShpPHNhbXBsZXBpeGVscyl7Yj0ocGl4ZWxzW3BpeF0mMjU1KTw8bmV0Ymlhc3NoaWZ0O2c9KHBpeGVsc1twaXgrMV0mMjU1KTw8bmV0Ymlhc3NoaWZ0O3I9KHBpeGVsc1twaXgrMl0mMjU1KTw8bmV0Ymlhc3NoaWZ0O2o9Y29udGVzdChiLGcscik7YWx0ZXJzaW5nbGUoYWxwaGEsaixiLGcscik7aWYocmFkIT09MClhbHRlcm5laWdoKHJhZCxqLGIsZyxyKTtwaXgrPXN0ZXA7aWYocGl4Pj1sZW5ndGhjb3VudClwaXgtPWxlbmd0aGNvdW50O2krKztpZihkZWx0YT09PTApZGVsdGE9MTtpZihpJWRlbHRhPT09MCl7YWxwaGEtPWFscGhhL2FscGhhZGVjO3JhZGl1cy09cmFkaXVzL3JhZGl1c2RlYztyYWQ9cmFkaXVzPj5yYWRpdXNiaWFzc2hpZnQ7aWYocmFkPD0xKXJhZD0wO2ZvcihqPTA7ajxyYWQ7aisrKXJhZHBvd2VyW2pdPWFscGhhKigocmFkKnJhZC1qKmopKnJhZGJpYXMvKHJhZCpyYWQpKX19fWZ1bmN0aW9uIGJ1aWxkQ29sb3JtYXAoKXtpbml0KCk7bGVhcm4oKTt1bmJpYXNuZXQoKTtpbnhidWlsZCgpfXRoaXMuYnVpbGRDb2xvcm1hcD1idWlsZENvbG9ybWFwO2Z1bmN0aW9uIGdldENvbG9ybWFwKCl7dmFyIG1hcD1bXTt2YXIgaW5kZXg9W107Zm9yKHZhciBpPTA7aTxuZXRzaXplO2krKylpbmRleFtuZXR3b3JrW2ldWzNdXT1pO3ZhciBrPTA7Zm9yKHZhciBsPTA7bDxuZXRzaXplO2wrKyl7dmFyIGo9aW5kZXhbbF07bWFwW2srK109bmV0d29ya1tqXVswXTttYXBbaysrXT1uZXR3b3JrW2pdWzFdO21hcFtrKytdPW5ldHdvcmtbal1bMl19cmV0dXJuIG1hcH10aGlzLmdldENvbG9ybWFwPWdldENvbG9ybWFwO3RoaXMubG9va3VwUkdCPWlueHNlYXJjaH1tb2R1bGUuZXhwb3J0cz1OZXVRdWFudH0se31dLDU6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBVQSxicm93c2VyLG1vZGUscGxhdGZvcm0sdWE7dWE9bmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpO3BsYXRmb3JtPW5hdmlnYXRvci5wbGF0Zm9ybS50b0xvd2VyQ2FzZSgpO1VBPXVhLm1hdGNoKC8ob3BlcmF8aWV8ZmlyZWZveHxjaHJvbWV8dmVyc2lvbilbXFxzXFwvOl0oW1xcd1xcZFxcLl0rKT8uKj8oc2FmYXJpfHZlcnNpb25bXFxzXFwvOl0oW1xcd1xcZFxcLl0rKXwkKS8pfHxbbnVsbCxcInVua25vd25cIiwwXTttb2RlPVVBWzFdPT09XCJpZVwiJiZkb2N1bWVudC5kb2N1bWVudE1vZGU7YnJvd3Nlcj17bmFtZTpVQVsxXT09PVwidmVyc2lvblwiP1VBWzNdOlVBWzFdLHZlcnNpb246bW9kZXx8cGFyc2VGbG9hdChVQVsxXT09PVwib3BlcmFcIiYmVUFbNF0/VUFbNF06VUFbMl0pLHBsYXRmb3JtOntuYW1lOnVhLm1hdGNoKC9pcCg/OmFkfG9kfGhvbmUpLyk/XCJpb3NcIjoodWEubWF0Y2goLyg/OndlYm9zfGFuZHJvaWQpLyl8fHBsYXRmb3JtLm1hdGNoKC9tYWN8d2lufGxpbnV4Lyl8fFtcIm90aGVyXCJdKVswXX19O2Jyb3dzZXJbYnJvd3Nlci5uYW1lXT10cnVlO2Jyb3dzZXJbYnJvd3Nlci5uYW1lK3BhcnNlSW50KGJyb3dzZXIudmVyc2lvbiwxMCldPXRydWU7YnJvd3Nlci5wbGF0Zm9ybVticm93c2VyLnBsYXRmb3JtLm5hbWVdPXRydWU7bW9kdWxlLmV4cG9ydHM9YnJvd3Nlcn0se31dLDY6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBFdmVudEVtaXR0ZXIsR0lGLEdJRkVuY29kZXIsYnJvd3NlcixnaWZXb3JrZXIsZXh0ZW5kPWZ1bmN0aW9uKGNoaWxkLHBhcmVudCl7Zm9yKHZhciBrZXkgaW4gcGFyZW50KXtpZihoYXNQcm9wLmNhbGwocGFyZW50LGtleSkpY2hpbGRba2V5XT1wYXJlbnRba2V5XX1mdW5jdGlvbiBjdG9yKCl7dGhpcy5jb25zdHJ1Y3Rvcj1jaGlsZH1jdG9yLnByb3RvdHlwZT1wYXJlbnQucHJvdG90eXBlO2NoaWxkLnByb3RvdHlwZT1uZXcgY3RvcjtjaGlsZC5fX3N1cGVyX189cGFyZW50LnByb3RvdHlwZTtyZXR1cm4gY2hpbGR9LGhhc1Byb3A9e30uaGFzT3duUHJvcGVydHksaW5kZXhPZj1bXS5pbmRleE9mfHxmdW5jdGlvbihpdGVtKXtmb3IodmFyIGk9MCxsPXRoaXMubGVuZ3RoO2k8bDtpKyspe2lmKGkgaW4gdGhpcyYmdGhpc1tpXT09PWl0ZW0pcmV0dXJuIGl9cmV0dXJuLTF9LHNsaWNlPVtdLnNsaWNlO0V2ZW50RW1pdHRlcj1yZXF1aXJlKFwiZXZlbnRzXCIpLkV2ZW50RW1pdHRlcjticm93c2VyPXJlcXVpcmUoXCIuL2Jyb3dzZXIuY29mZmVlXCIpO0dJRkVuY29kZXI9cmVxdWlyZShcIi4vR0lGRW5jb2Rlci5qc1wiKTtnaWZXb3JrZXI9cmVxdWlyZShcIi4vZ2lmLndvcmtlci5jb2ZmZWVcIik7bW9kdWxlLmV4cG9ydHM9R0lGPWZ1bmN0aW9uKHN1cGVyQ2xhc3Mpe3ZhciBkZWZhdWx0cyxmcmFtZURlZmF1bHRzO2V4dGVuZChHSUYsc3VwZXJDbGFzcyk7ZGVmYXVsdHM9e3dvcmtlclNjcmlwdDpcImdpZi53b3JrZXIuanNcIix3b3JrZXJzOjIscmVwZWF0OjAsYmFja2dyb3VuZDpcIiNmZmZcIixxdWFsaXR5OjEwLHdpZHRoOm51bGwsaGVpZ2h0Om51bGwsdHJhbnNwYXJlbnQ6bnVsbCxkZWJ1ZzpmYWxzZSxkaXRoZXI6ZmFsc2V9O2ZyYW1lRGVmYXVsdHM9e2RlbGF5OjUwMCxjb3B5OmZhbHNlLGRpc3Bvc2U6LTF9O2Z1bmN0aW9uIEdJRihvcHRpb25zKXt2YXIgYmFzZSxrZXksdmFsdWU7dGhpcy5ydW5uaW5nPWZhbHNlO3RoaXMub3B0aW9ucz17fTt0aGlzLmZyYW1lcz1bXTt0aGlzLmZyZWVXb3JrZXJzPVtdO3RoaXMuYWN0aXZlV29ya2Vycz1bXTt0aGlzLnNldE9wdGlvbnMob3B0aW9ucyk7Zm9yKGtleSBpbiBkZWZhdWx0cyl7dmFsdWU9ZGVmYXVsdHNba2V5XTtpZigoYmFzZT10aGlzLm9wdGlvbnMpW2tleV09PW51bGwpe2Jhc2Vba2V5XT12YWx1ZX19fUdJRi5wcm90b3R5cGUuc2V0T3B0aW9uPWZ1bmN0aW9uKGtleSx2YWx1ZSl7dGhpcy5vcHRpb25zW2tleV09dmFsdWU7aWYodGhpcy5fY2FudmFzIT1udWxsJiYoa2V5PT09XCJ3aWR0aFwifHxrZXk9PT1cImhlaWdodFwiKSl7cmV0dXJuIHRoaXMuX2NhbnZhc1trZXldPXZhbHVlfX07R0lGLnByb3RvdHlwZS5zZXRPcHRpb25zPWZ1bmN0aW9uKG9wdGlvbnMpe3ZhciBrZXkscmVzdWx0cyx2YWx1ZTtyZXN1bHRzPVtdO2ZvcihrZXkgaW4gb3B0aW9ucyl7aWYoIWhhc1Byb3AuY2FsbChvcHRpb25zLGtleSkpY29udGludWU7dmFsdWU9b3B0aW9uc1trZXldO3Jlc3VsdHMucHVzaCh0aGlzLnNldE9wdGlvbihrZXksdmFsdWUpKX1yZXR1cm4gcmVzdWx0c307R0lGLnByb3RvdHlwZS5hZGRGcmFtZT1mdW5jdGlvbihpbWFnZSxvcHRpb25zKXt2YXIgZnJhbWUsa2V5O2lmKG9wdGlvbnM9PW51bGwpe29wdGlvbnM9e319ZnJhbWU9e307ZnJhbWUudHJhbnNwYXJlbnQ9dGhpcy5vcHRpb25zLnRyYW5zcGFyZW50O2ZvcihrZXkgaW4gZnJhbWVEZWZhdWx0cyl7ZnJhbWVba2V5XT1vcHRpb25zW2tleV18fGZyYW1lRGVmYXVsdHNba2V5XX1pZih0aGlzLm9wdGlvbnMud2lkdGg9PW51bGwpe3RoaXMuc2V0T3B0aW9uKFwid2lkdGhcIixpbWFnZS53aWR0aCl9aWYodGhpcy5vcHRpb25zLmhlaWdodD09bnVsbCl7dGhpcy5zZXRPcHRpb24oXCJoZWlnaHRcIixpbWFnZS5oZWlnaHQpfWlmKHR5cGVvZiBJbWFnZURhdGEhPT1cInVuZGVmaW5lZFwiJiZJbWFnZURhdGEhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIEltYWdlRGF0YSl7ZnJhbWUuZGF0YT1pbWFnZS5kYXRhfWVsc2UgaWYodHlwZW9mIENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCE9PVwidW5kZWZpbmVkXCImJkNhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEfHx0eXBlb2YgV2ViR0xSZW5kZXJpbmdDb250ZXh0IT09XCJ1bmRlZmluZWRcIiYmV2ViR0xSZW5kZXJpbmdDb250ZXh0IT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBXZWJHTFJlbmRlcmluZ0NvbnRleHQpe2lmKG9wdGlvbnMuY29weSl7ZnJhbWUuZGF0YT10aGlzLmdldENvbnRleHREYXRhKGltYWdlKX1lbHNle2ZyYW1lLmNvbnRleHQ9aW1hZ2V9fWVsc2UgaWYoaW1hZ2UuY2hpbGROb2RlcyE9bnVsbCl7aWYob3B0aW9ucy5jb3B5KXtmcmFtZS5kYXRhPXRoaXMuZ2V0SW1hZ2VEYXRhKGltYWdlKX1lbHNle2ZyYW1lLmltYWdlPWltYWdlfX1lbHNle3Rocm93IG5ldyBFcnJvcihcIkludmFsaWQgaW1hZ2VcIil9cmV0dXJuIHRoaXMuZnJhbWVzLnB1c2goZnJhbWUpfTtHSUYucHJvdG90eXBlLnJlbmRlcj1mdW5jdGlvbigpe3ZhciBpLGosbnVtV29ya2VycyxyZWY7aWYodGhpcy5ydW5uaW5nKXt0aHJvdyBuZXcgRXJyb3IoXCJBbHJlYWR5IHJ1bm5pbmdcIil9aWYodGhpcy5vcHRpb25zLndpZHRoPT1udWxsfHx0aGlzLm9wdGlvbnMuaGVpZ2h0PT1udWxsKXt0aHJvdyBuZXcgRXJyb3IoXCJXaWR0aCBhbmQgaGVpZ2h0IG11c3QgYmUgc2V0IHByaW9yIHRvIHJlbmRlcmluZ1wiKX10aGlzLnJ1bm5pbmc9dHJ1ZTt0aGlzLm5leHRGcmFtZT0wO3RoaXMuZmluaXNoZWRGcmFtZXM9MDt0aGlzLmltYWdlUGFydHM9ZnVuY3Rpb24oKXt2YXIgaixyZWYscmVzdWx0cztyZXN1bHRzPVtdO2ZvcihpPWo9MCxyZWY9dGhpcy5mcmFtZXMubGVuZ3RoOzA8PXJlZj9qPHJlZjpqPnJlZjtpPTA8PXJlZj8rK2o6LS1qKXtyZXN1bHRzLnB1c2gobnVsbCl9cmV0dXJuIHJlc3VsdHN9LmNhbGwodGhpcyk7bnVtV29ya2Vycz10aGlzLnNwYXduV29ya2VycygpO2lmKHRoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPT09dHJ1ZSl7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX1lbHNle2ZvcihpPWo9MCxyZWY9bnVtV29ya2VyczswPD1yZWY/ajxyZWY6aj5yZWY7aT0wPD1yZWY/KytqOi0tail7dGhpcy5yZW5kZXJOZXh0RnJhbWUoKX19dGhpcy5lbWl0KFwic3RhcnRcIik7cmV0dXJuIHRoaXMuZW1pdChcInByb2dyZXNzXCIsMCl9O0dJRi5wcm90b3R5cGUuYWJvcnQ9ZnVuY3Rpb24oKXt2YXIgd29ya2VyO3doaWxlKHRydWUpe3dvcmtlcj10aGlzLmFjdGl2ZVdvcmtlcnMuc2hpZnQoKTtpZih3b3JrZXI9PW51bGwpe2JyZWFrfXRoaXMubG9nKFwia2lsbGluZyBhY3RpdmUgd29ya2VyXCIpO3dvcmtlci50ZXJtaW5hdGUoKX10aGlzLnJ1bm5pbmc9ZmFsc2U7cmV0dXJuIHRoaXMuZW1pdChcImFib3J0XCIpfTtHSUYucHJvdG90eXBlLnNwYXduV29ya2Vycz1mdW5jdGlvbigpe3ZhciBqLG51bVdvcmtlcnMscmVmLHJlc3VsdHM7bnVtV29ya2Vycz1NYXRoLm1pbih0aGlzLm9wdGlvbnMud29ya2Vycyx0aGlzLmZyYW1lcy5sZW5ndGgpOyhmdW5jdGlvbigpe3Jlc3VsdHM9W107Zm9yKHZhciBqPXJlZj10aGlzLmZyZWVXb3JrZXJzLmxlbmd0aDtyZWY8PW51bVdvcmtlcnM/ajxudW1Xb3JrZXJzOmo+bnVtV29ya2VycztyZWY8PW51bVdvcmtlcnM/aisrOmotLSl7cmVzdWx0cy5wdXNoKGopfXJldHVybiByZXN1bHRzfSkuYXBwbHkodGhpcykuZm9yRWFjaChmdW5jdGlvbihfdGhpcyl7cmV0dXJuIGZ1bmN0aW9uKGkpe3ZhciB3b3JrZXI7X3RoaXMubG9nKFwic3Bhd25pbmcgd29ya2VyIFwiK2kpO3dvcmtlcj1uZXcgV29ya2VyKF90aGlzLm9wdGlvbnMud29ya2VyU2NyaXB0KTt3b3JrZXIub25tZXNzYWdlPWZ1bmN0aW9uKGV2ZW50KXtfdGhpcy5hY3RpdmVXb3JrZXJzLnNwbGljZShfdGhpcy5hY3RpdmVXb3JrZXJzLmluZGV4T2Yod29ya2VyKSwxKTtfdGhpcy5mcmVlV29ya2Vycy5wdXNoKHdvcmtlcik7cmV0dXJuIF90aGlzLmZyYW1lRmluaXNoZWQoZXZlbnQuZGF0YSl9O3JldHVybiBfdGhpcy5mcmVlV29ya2Vycy5wdXNoKHdvcmtlcil9fSh0aGlzKSk7cmV0dXJuIG51bVdvcmtlcnN9O0dJRi5wcm90b3R5cGUuZnJhbWVGaW5pc2hlZD1mdW5jdGlvbihmcmFtZSl7dmFyIGksaixyZWY7dGhpcy5sb2coXCJmcmFtZSBcIitmcmFtZS5pbmRleCtcIiBmaW5pc2hlZCAtIFwiK3RoaXMuYWN0aXZlV29ya2Vycy5sZW5ndGgrXCIgYWN0aXZlXCIpO3RoaXMuZmluaXNoZWRGcmFtZXMrKzt0aGlzLmVtaXQoXCJwcm9ncmVzc1wiLHRoaXMuZmluaXNoZWRGcmFtZXMvdGhpcy5mcmFtZXMubGVuZ3RoKTt0aGlzLmltYWdlUGFydHNbZnJhbWUuaW5kZXhdPWZyYW1lO2lmKHRoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlPT09dHJ1ZSl7dGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGU9ZnJhbWUuZ2xvYmFsUGFsZXR0ZTt0aGlzLmxvZyhcImdsb2JhbCBwYWxldHRlIGFuYWx5emVkXCIpO2lmKHRoaXMuZnJhbWVzLmxlbmd0aD4yKXtmb3IoaT1qPTEscmVmPXRoaXMuZnJlZVdvcmtlcnMubGVuZ3RoOzE8PXJlZj9qPHJlZjpqPnJlZjtpPTE8PXJlZj8rK2o6LS1qKXt0aGlzLnJlbmRlck5leHRGcmFtZSgpfX19aWYoaW5kZXhPZi5jYWxsKHRoaXMuaW1hZ2VQYXJ0cyxudWxsKT49MCl7cmV0dXJuIHRoaXMucmVuZGVyTmV4dEZyYW1lKCl9ZWxzZXtyZXR1cm4gdGhpcy5maW5pc2hSZW5kZXJpbmcoKX19O0dJRi5wcm90b3R5cGUuZmluaXNoUmVuZGVyaW5nPWZ1bmN0aW9uKCl7dmFyIGRhdGEsZnJhbWUsaSxpbWFnZSxqLGssbCxsZW4sbGVuMSxsZW4yLGxlbjMsb2Zmc2V0LHBhZ2UscmVmLHJlZjEscmVmMjtsZW49MDtyZWY9dGhpcy5pbWFnZVBhcnRzO2ZvcihqPTAsbGVuMT1yZWYubGVuZ3RoO2o8bGVuMTtqKyspe2ZyYW1lPXJlZltqXTtsZW4rPShmcmFtZS5kYXRhLmxlbmd0aC0xKSpmcmFtZS5wYWdlU2l6ZStmcmFtZS5jdXJzb3J9bGVuKz1mcmFtZS5wYWdlU2l6ZS1mcmFtZS5jdXJzb3I7dGhpcy5sb2coXCJyZW5kZXJpbmcgZmluaXNoZWQgLSBmaWxlc2l6ZSBcIitNYXRoLnJvdW5kKGxlbi8xZTMpK1wia2JcIik7ZGF0YT1uZXcgVWludDhBcnJheShsZW4pO29mZnNldD0wO3JlZjE9dGhpcy5pbWFnZVBhcnRzO2ZvcihrPTAsbGVuMj1yZWYxLmxlbmd0aDtrPGxlbjI7aysrKXtmcmFtZT1yZWYxW2tdO3JlZjI9ZnJhbWUuZGF0YTtmb3IoaT1sPTAsbGVuMz1yZWYyLmxlbmd0aDtsPGxlbjM7aT0rK2wpe3BhZ2U9cmVmMltpXTtkYXRhLnNldChwYWdlLG9mZnNldCk7aWYoaT09PWZyYW1lLmRhdGEubGVuZ3RoLTEpe29mZnNldCs9ZnJhbWUuY3Vyc29yfWVsc2V7b2Zmc2V0Kz1mcmFtZS5wYWdlU2l6ZX19fWltYWdlPW5ldyBCbG9iKFtkYXRhXSx7dHlwZTpcImltYWdlL2dpZlwifSk7cmV0dXJuIHRoaXMuZW1pdChcImZpbmlzaGVkXCIsaW1hZ2UsZGF0YSl9O0dJRi5wcm90b3R5cGUucmVuZGVyTmV4dEZyYW1lPWZ1bmN0aW9uKCl7dmFyIGZyYW1lLHRhc2ssd29ya2VyO2lmKHRoaXMuZnJlZVdvcmtlcnMubGVuZ3RoPT09MCl7dGhyb3cgbmV3IEVycm9yKFwiTm8gZnJlZSB3b3JrZXJzXCIpfWlmKHRoaXMubmV4dEZyYW1lPj10aGlzLmZyYW1lcy5sZW5ndGgpe3JldHVybn1mcmFtZT10aGlzLmZyYW1lc1t0aGlzLm5leHRGcmFtZSsrXTt3b3JrZXI9dGhpcy5mcmVlV29ya2Vycy5zaGlmdCgpO3Rhc2s9dGhpcy5nZXRUYXNrKGZyYW1lKTt0aGlzLmxvZyhcInN0YXJ0aW5nIGZyYW1lIFwiKyh0YXNrLmluZGV4KzEpK1wiIG9mIFwiK3RoaXMuZnJhbWVzLmxlbmd0aCk7dGhpcy5hY3RpdmVXb3JrZXJzLnB1c2god29ya2VyKTtyZXR1cm4gd29ya2VyLnBvc3RNZXNzYWdlKHRhc2spfTtHSUYucHJvdG90eXBlLmdldENvbnRleHREYXRhPWZ1bmN0aW9uKGN0eCl7cmV0dXJuIGN0eC5nZXRJbWFnZURhdGEoMCwwLHRoaXMub3B0aW9ucy53aWR0aCx0aGlzLm9wdGlvbnMuaGVpZ2h0KS5kYXRhfTtHSUYucHJvdG90eXBlLmdldEltYWdlRGF0YT1mdW5jdGlvbihpbWFnZSl7dmFyIGN0eDtpZih0aGlzLl9jYW52YXM9PW51bGwpe3RoaXMuX2NhbnZhcz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO3RoaXMuX2NhbnZhcy53aWR0aD10aGlzLm9wdGlvbnMud2lkdGg7dGhpcy5fY2FudmFzLmhlaWdodD10aGlzLm9wdGlvbnMuaGVpZ2h0fWN0eD10aGlzLl9jYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO2N0eC5zZXRGaWxsPXRoaXMub3B0aW9ucy5iYWNrZ3JvdW5kO2N0eC5maWxsUmVjdCgwLDAsdGhpcy5vcHRpb25zLndpZHRoLHRoaXMub3B0aW9ucy5oZWlnaHQpO2N0eC5kcmF3SW1hZ2UoaW1hZ2UsMCwwKTtyZXR1cm4gdGhpcy5nZXRDb250ZXh0RGF0YShjdHgpfTtHSUYucHJvdG90eXBlLmdldFRhc2s9ZnVuY3Rpb24oZnJhbWUpe3ZhciBpbmRleCx0YXNrO2luZGV4PXRoaXMuZnJhbWVzLmluZGV4T2YoZnJhbWUpO3Rhc2s9e2luZGV4OmluZGV4LGxhc3Q6aW5kZXg9PT10aGlzLmZyYW1lcy5sZW5ndGgtMSxkZWxheTpmcmFtZS5kZWxheSxkaXNwb3NlOmZyYW1lLmRpc3Bvc2UsdHJhbnNwYXJlbnQ6ZnJhbWUudHJhbnNwYXJlbnQsd2lkdGg6dGhpcy5vcHRpb25zLndpZHRoLGhlaWdodDp0aGlzLm9wdGlvbnMuaGVpZ2h0LHF1YWxpdHk6dGhpcy5vcHRpb25zLnF1YWxpdHksZGl0aGVyOnRoaXMub3B0aW9ucy5kaXRoZXIsZ2xvYmFsUGFsZXR0ZTp0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZSxyZXBlYXQ6dGhpcy5vcHRpb25zLnJlcGVhdCxjYW5UcmFuc2Zlcjpicm93c2VyLm5hbWU9PT1cImNocm9tZVwifTtpZihmcmFtZS5kYXRhIT1udWxsKXt0YXNrLmRhdGE9ZnJhbWUuZGF0YX1lbHNlIGlmKGZyYW1lLmNvbnRleHQhPW51bGwpe3Rhc2suZGF0YT10aGlzLmdldENvbnRleHREYXRhKGZyYW1lLmNvbnRleHQpfWVsc2UgaWYoZnJhbWUuaW1hZ2UhPW51bGwpe3Rhc2suZGF0YT10aGlzLmdldEltYWdlRGF0YShmcmFtZS5pbWFnZSl9ZWxzZXt0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGZyYW1lXCIpfXJldHVybiB0YXNrfTtHSUYucHJvdG90eXBlLmxvZz1mdW5jdGlvbigpe3ZhciBhcmdzO2FyZ3M9MTw9YXJndW1lbnRzLmxlbmd0aD9zbGljZS5jYWxsKGFyZ3VtZW50cywwKTpbXTtpZighdGhpcy5vcHRpb25zLmRlYnVnKXtyZXR1cm59cmV0dXJuIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsYXJncyl9O3JldHVybiBHSUZ9KEV2ZW50RW1pdHRlcil9LHtcIi4vR0lGRW5jb2Rlci5qc1wiOjIsXCIuL2Jyb3dzZXIuY29mZmVlXCI6NSxcIi4vZ2lmLndvcmtlci5jb2ZmZWVcIjo3LGV2ZW50czoxfV0sNzpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEdJRkVuY29kZXIscmVuZGVyRnJhbWU7R0lGRW5jb2Rlcj1yZXF1aXJlKFwiLi9HSUZFbmNvZGVyLmpzXCIpO3JlbmRlckZyYW1lPWZ1bmN0aW9uKGZyYW1lKXt2YXIgZW5jb2RlcixwYWdlLHN0cmVhbSx0cmFuc2ZlcjtlbmNvZGVyPW5ldyBHSUZFbmNvZGVyKGZyYW1lLndpZHRoLGZyYW1lLmhlaWdodCk7aWYoZnJhbWUuaW5kZXg9PT0wKXtlbmNvZGVyLndyaXRlSGVhZGVyKCl9ZWxzZXtlbmNvZGVyLmZpcnN0RnJhbWU9ZmFsc2V9ZW5jb2Rlci5zZXRUcmFuc3BhcmVudChmcmFtZS50cmFuc3BhcmVudCk7ZW5jb2Rlci5zZXREaXNwb3NlKGZyYW1lLmRpc3Bvc2UpO2VuY29kZXIuc2V0UmVwZWF0KGZyYW1lLnJlcGVhdCk7ZW5jb2Rlci5zZXREZWxheShmcmFtZS5kZWxheSk7ZW5jb2Rlci5zZXRRdWFsaXR5KGZyYW1lLnF1YWxpdHkpO2VuY29kZXIuc2V0RGl0aGVyKGZyYW1lLmRpdGhlcik7ZW5jb2Rlci5zZXRHbG9iYWxQYWxldHRlKGZyYW1lLmdsb2JhbFBhbGV0dGUpO2VuY29kZXIuYWRkRnJhbWUoZnJhbWUuZGF0YSk7aWYoZnJhbWUubGFzdCl7ZW5jb2Rlci5maW5pc2goKX1pZihmcmFtZS5nbG9iYWxQYWxldHRlPT09dHJ1ZSl7ZnJhbWUuZ2xvYmFsUGFsZXR0ZT1lbmNvZGVyLmdldEdsb2JhbFBhbGV0dGUoKX1zdHJlYW09ZW5jb2Rlci5zdHJlYW0oKTtmcmFtZS5kYXRhPXN0cmVhbS5wYWdlcztmcmFtZS5jdXJzb3I9c3RyZWFtLmN1cnNvcjtmcmFtZS5wYWdlU2l6ZT1zdHJlYW0uY29uc3RydWN0b3IucGFnZVNpemU7aWYoZnJhbWUuY2FuVHJhbnNmZXIpe3RyYW5zZmVyPWZ1bmN0aW9uKCl7dmFyIGksbGVuLHJlZixyZXN1bHRzO3JlZj1mcmFtZS5kYXRhO3Jlc3VsdHM9W107Zm9yKGk9MCxsZW49cmVmLmxlbmd0aDtpPGxlbjtpKyspe3BhZ2U9cmVmW2ldO3Jlc3VsdHMucHVzaChwYWdlLmJ1ZmZlcil9cmV0dXJuIHJlc3VsdHN9KCk7cmV0dXJuIHNlbGYucG9zdE1lc3NhZ2UoZnJhbWUsdHJhbnNmZXIpfWVsc2V7cmV0dXJuIHNlbGYucG9zdE1lc3NhZ2UoZnJhbWUpfX07c2VsZi5vbm1lc3NhZ2U9ZnVuY3Rpb24oZXZlbnQpe3JldHVybiByZW5kZXJGcmFtZShldmVudC5kYXRhKX19LHtcIi4vR0lGRW5jb2Rlci5qc1wiOjJ9XX0se30sWzZdKSg2KX0pO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1naWYuanMubWFwXHJcbiIsIjsoZnVuY3Rpb24oKSB7XHJcblxyXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xyXG4gIHZhciBUYXIgPSByZXF1aXJlKCcuL3Rhci5qcycpO1xyXG4gIHZhciBkb3dubG9hZCA9IHJlcXVpcmUoJy4vZG93bmxvYWQuanMnKTtcclxuICB2YXIgR0lGID0gcmVxdWlyZSgnLi9naWYuanMnKTtcclxufVxyXG5cclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgb2JqZWN0VHlwZXMgPSB7XHJcbidmdW5jdGlvbic6IHRydWUsXHJcbidvYmplY3QnOiB0cnVlXHJcbn07XHJcblxyXG5mdW5jdGlvbiBjaGVja0dsb2JhbCh2YWx1ZSkge1xyXG4gICAgcmV0dXJuICh2YWx1ZSAmJiB2YWx1ZS5PYmplY3QgPT09IE9iamVjdCkgPyB2YWx1ZSA6IG51bGw7XHJcbiAgfVxyXG5cclxuLyoqIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIHdpdGhvdXQgYSBkZXBlbmRlbmN5IG9uIGByb290YC4gKi9cclxudmFyIGZyZWVQYXJzZUZsb2F0ID0gcGFyc2VGbG9hdCxcclxuICBmcmVlUGFyc2VJbnQgPSBwYXJzZUludDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZXhwb3J0c2AuICovXHJcbnZhciBmcmVlRXhwb3J0cyA9IChvYmplY3RUeXBlc1t0eXBlb2YgZXhwb3J0c10gJiYgZXhwb3J0cyAmJiAhZXhwb3J0cy5ub2RlVHlwZSlcclxuPyBleHBvcnRzXHJcbjogdW5kZWZpbmVkO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBtb2R1bGVgLiAqL1xyXG52YXIgZnJlZU1vZHVsZSA9IChvYmplY3RUeXBlc1t0eXBlb2YgbW9kdWxlXSAmJiBtb2R1bGUgJiYgIW1vZHVsZS5ub2RlVHlwZSlcclxuPyBtb2R1bGVcclxuOiB1bmRlZmluZWQ7XHJcblxyXG4vKiogRGV0ZWN0IHRoZSBwb3B1bGFyIENvbW1vbkpTIGV4dGVuc2lvbiBgbW9kdWxlLmV4cG9ydHNgLiAqL1xyXG52YXIgbW9kdWxlRXhwb3J0cyA9IChmcmVlTW9kdWxlICYmIGZyZWVNb2R1bGUuZXhwb3J0cyA9PT0gZnJlZUV4cG9ydHMpXHJcbj8gZnJlZUV4cG9ydHNcclxuOiB1bmRlZmluZWQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGdsb2JhbGAgZnJvbSBOb2RlLmpzLiAqL1xyXG52YXIgZnJlZUdsb2JhbCA9IGNoZWNrR2xvYmFsKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUgJiYgdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWwpO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBzZWxmYC4gKi9cclxudmFyIGZyZWVTZWxmID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHNlbGZdICYmIHNlbGYpO1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGB3aW5kb3dgLiAqL1xyXG52YXIgZnJlZVdpbmRvdyA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB3aW5kb3ddICYmIHdpbmRvdyk7XHJcblxyXG4vKiogRGV0ZWN0IGB0aGlzYCBhcyB0aGUgZ2xvYmFsIG9iamVjdC4gKi9cclxudmFyIHRoaXNHbG9iYWwgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2YgdGhpc10gJiYgdGhpcyk7XHJcblxyXG4vKipcclxuKiBVc2VkIGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxyXG4qXHJcbiogVGhlIGB0aGlzYCB2YWx1ZSBpcyB1c2VkIGlmIGl0J3MgdGhlIGdsb2JhbCBvYmplY3QgdG8gYXZvaWQgR3JlYXNlbW9ua2V5J3NcclxuKiByZXN0cmljdGVkIGB3aW5kb3dgIG9iamVjdCwgb3RoZXJ3aXNlIHRoZSBgd2luZG93YCBvYmplY3QgaXMgdXNlZC5cclxuKi9cclxudmFyIHJvb3QgPSBmcmVlR2xvYmFsIHx8XHJcbigoZnJlZVdpbmRvdyAhPT0gKHRoaXNHbG9iYWwgJiYgdGhpc0dsb2JhbC53aW5kb3cpKSAmJiBmcmVlV2luZG93KSB8fFxyXG4gIGZyZWVTZWxmIHx8IHRoaXNHbG9iYWwgfHwgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcclxuXHJcbmlmKCAhKCdnYycgaW4gd2luZG93ICkgKSB7XHJcblx0d2luZG93LmdjID0gZnVuY3Rpb24oKXt9XHJcbn1cclxuXHJcbmlmICghSFRNTENhbnZhc0VsZW1lbnQucHJvdG90eXBlLnRvQmxvYikge1xyXG4gT2JqZWN0LmRlZmluZVByb3BlcnR5KEhUTUxDYW52YXNFbGVtZW50LnByb3RvdHlwZSwgJ3RvQmxvYicsIHtcclxuICB2YWx1ZTogZnVuY3Rpb24gKGNhbGxiYWNrLCB0eXBlLCBxdWFsaXR5KSB7XHJcblxyXG4gICAgdmFyIGJpblN0ciA9IGF0b2IoIHRoaXMudG9EYXRhVVJMKHR5cGUsIHF1YWxpdHkpLnNwbGl0KCcsJylbMV0gKSxcclxuICAgICAgICBsZW4gPSBiaW5TdHIubGVuZ3RoLFxyXG4gICAgICAgIGFyciA9IG5ldyBVaW50OEFycmF5KGxlbik7XHJcblxyXG4gICAgZm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrICkge1xyXG4gICAgIGFycltpXSA9IGJpblN0ci5jaGFyQ29kZUF0KGkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNhbGxiYWNrKCBuZXcgQmxvYiggW2Fycl0sIHt0eXBlOiB0eXBlIHx8ICdpbWFnZS9wbmcnfSApICk7XHJcbiAgfVxyXG4gfSk7XHJcbn1cclxuXHJcbi8vIEBsaWNlbnNlIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcclxuLy8gY29weXJpZ2h0IFBhdWwgSXJpc2ggMjAxNVxyXG5cclxuXHJcbi8vIERhdGUubm93KCkgaXMgc3VwcG9ydGVkIGV2ZXJ5d2hlcmUgZXhjZXB0IElFOC4gRm9yIElFOCB3ZSB1c2UgdGhlIERhdGUubm93IHBvbHlmaWxsXHJcbi8vICAgZ2l0aHViLmNvbS9GaW5hbmNpYWwtVGltZXMvcG9seWZpbGwtc2VydmljZS9ibG9iL21hc3Rlci9wb2x5ZmlsbHMvRGF0ZS5ub3cvcG9seWZpbGwuanNcclxuLy8gYXMgU2FmYXJpIDYgZG9lc24ndCBoYXZlIHN1cHBvcnQgZm9yIE5hdmlnYXRpb25UaW1pbmcsIHdlIHVzZSBhIERhdGUubm93KCkgdGltZXN0YW1wIGZvciByZWxhdGl2ZSB2YWx1ZXNcclxuXHJcbi8vIGlmIHlvdSB3YW50IHZhbHVlcyBzaW1pbGFyIHRvIHdoYXQgeW91J2QgZ2V0IHdpdGggcmVhbCBwZXJmLm5vdywgcGxhY2UgdGhpcyB0b3dhcmRzIHRoZSBoZWFkIG9mIHRoZSBwYWdlXHJcbi8vIGJ1dCBpbiByZWFsaXR5LCB5b3UncmUganVzdCBnZXR0aW5nIHRoZSBkZWx0YSBiZXR3ZWVuIG5vdygpIGNhbGxzLCBzbyBpdCdzIG5vdCB0ZXJyaWJseSBpbXBvcnRhbnQgd2hlcmUgaXQncyBwbGFjZWRcclxuXHJcblxyXG4oZnVuY3Rpb24oKXtcclxuXHJcbiAgaWYgKFwicGVyZm9ybWFuY2VcIiBpbiB3aW5kb3cgPT0gZmFsc2UpIHtcclxuICAgICAgd2luZG93LnBlcmZvcm1hbmNlID0ge307XHJcbiAgfVxyXG5cclxuICBEYXRlLm5vdyA9IChEYXRlLm5vdyB8fCBmdW5jdGlvbiAoKSB7ICAvLyB0aGFua3MgSUU4XHJcblx0ICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgfSk7XHJcblxyXG4gIGlmIChcIm5vd1wiIGluIHdpbmRvdy5wZXJmb3JtYW5jZSA9PSBmYWxzZSl7XHJcblxyXG4gICAgdmFyIG5vd09mZnNldCA9IERhdGUubm93KCk7XHJcblxyXG4gICAgaWYgKHBlcmZvcm1hbmNlLnRpbWluZyAmJiBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0KXtcclxuICAgICAgbm93T2Zmc2V0ID0gcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydFxyXG4gICAgfVxyXG5cclxuICAgIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbiBub3coKXtcclxuICAgICAgcmV0dXJuIERhdGUubm93KCkgLSBub3dPZmZzZXQ7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxufSkoKTtcclxuXHJcblxyXG5mdW5jdGlvbiBwYWQoIG4gKSB7XHJcblx0cmV0dXJuIFN0cmluZyhcIjAwMDAwMDBcIiArIG4pLnNsaWNlKC03KTtcclxufVxyXG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9BZGQtb25zL0NvZGVfc25pcHBldHMvVGltZXJzXHJcblxyXG52YXIgZ19zdGFydFRpbWUgPSB3aW5kb3cuRGF0ZS5ub3coKTtcclxuXHJcbmZ1bmN0aW9uIGd1aWQoKSB7XHJcblx0ZnVuY3Rpb24gczQoKSB7XHJcblx0XHRyZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMCkudG9TdHJpbmcoMTYpLnN1YnN0cmluZygxKTtcclxuXHR9XHJcblx0cmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0ZyYW1lRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBfaGFuZGxlcnMgPSB7fTtcclxuXHJcblx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xyXG5cclxuXHR0aGlzLm9uID0gZnVuY3Rpb24oZXZlbnQsIGhhbmRsZXIpIHtcclxuXHJcblx0XHRfaGFuZGxlcnNbZXZlbnRdID0gaGFuZGxlcjtcclxuXHJcblx0fTtcclxuXHJcblx0dGhpcy5lbWl0ID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuXHJcblx0XHR2YXIgaGFuZGxlciA9IF9oYW5kbGVyc1tldmVudF07XHJcblx0XHRpZiAoaGFuZGxlcikge1xyXG5cclxuXHRcdFx0aGFuZGxlci5hcHBseShudWxsLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcclxuXHJcblx0XHR9XHJcblxyXG5cdH07XHJcblxyXG5cdHRoaXMuZmlsZW5hbWUgPSBzZXR0aW5ncy5uYW1lIHx8IGd1aWQoKTtcclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcnO1xyXG5cdHRoaXMubWltZVR5cGUgPSAnJztcclxuXHJcbn1cclxuXHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnNhZmVUb1Byb2NlZWQgPSBmdW5jdGlvbigpeyByZXR1cm4gdHJ1ZTsgfTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnN0ZXAgPSBmdW5jdGlvbigpIHsgY29uc29sZS5sb2coICdTdGVwIG5vdCBzZXQhJyApIH1cclxuXHJcbmZ1bmN0aW9uIENDVGFyRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy50YXInXHJcblx0dGhpcy5taW1lVHlwZSA9ICdhcHBsaWNhdGlvbi94LXRhcidcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnJztcclxuXHJcblx0dGhpcy50YXBlID0gbnVsbFxyXG5cdHRoaXMuY291bnQgPSAwO1xyXG5cclxufVxyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCl7XHJcblxyXG5cdHRoaXMuZGlzcG9zZSgpO1xyXG5cclxufTtcclxuXHJcbkNDVGFyRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGJsb2IgKSB7XHJcblxyXG5cdHZhciBmaWxlUmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcclxuXHRmaWxlUmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dGhpcy50YXBlLmFwcGVuZCggcGFkKCB0aGlzLmNvdW50ICkgKyB0aGlzLmZpbGVFeHRlbnNpb24sIG5ldyBVaW50OEFycmF5KCBmaWxlUmVhZGVyLnJlc3VsdCApICk7XHJcblxyXG5cdFx0Ly9pZiggdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgPiAwICYmICggdGhpcy5mcmFtZXMubGVuZ3RoIC8gdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKSA+PSB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSApIHtcclxuXHJcblx0XHR0aGlzLmNvdW50Kys7XHJcblx0XHR0aGlzLnN0ZXAoKTtcclxuXHR9LmJpbmQoIHRoaXMgKTtcclxuXHRmaWxlUmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKGJsb2IpO1xyXG5cclxufVxyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuXHRjYWxsYmFjayggdGhpcy50YXBlLnNhdmUoKSApO1xyXG5cclxufVxyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMudGFwZSA9IG5ldyBUYXIoKTtcclxuXHR0aGlzLmNvdW50ID0gMDtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDUE5HRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDVGFyRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLnR5cGUgPSAnaW1hZ2UvcG5nJztcclxuXHR0aGlzLmZpbGVFeHRlbnNpb24gPSAnLnBuZyc7XHJcblxyXG59XHJcblxyXG5DQ1BOR0VuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NUYXJFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NQTkdFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRjYW52YXMudG9CbG9iKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdENDVGFyRW5jb2Rlci5wcm90b3R5cGUuYWRkLmNhbGwoIHRoaXMsIGJsb2IgKTtcclxuXHR9LmJpbmQoIHRoaXMgKSwgdGhpcy50eXBlIClcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDSlBFR0VuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ1RhckVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy50eXBlID0gJ2ltYWdlL2pwZWcnO1xyXG5cdHRoaXMuZmlsZUV4dGVuc2lvbiA9ICcuanBnJztcclxuXHR0aGlzLnF1YWxpdHkgPSAoIHNldHRpbmdzLnF1YWxpdHkgLyAxMDAgKSB8fCAuODtcclxuXHJcbn1cclxuXHJcbkNDSlBFR0VuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NUYXJFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NKUEVHRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0Y2FudmFzLnRvQmxvYiggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRDQ1RhckVuY29kZXIucHJvdG90eXBlLmFkZC5jYWxsKCB0aGlzLCBibG9iICk7XHJcblx0fS5iaW5kKCB0aGlzICksIHRoaXMudHlwZSwgdGhpcy5xdWFsaXR5IClcclxuXHJcbn1cclxuXHJcbi8qXHJcblxyXG5cdFdlYk0gRW5jb2RlclxyXG5cclxuKi9cclxuXHJcbmZ1bmN0aW9uIENDV2ViTUVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuXHRpZiggY2FudmFzLnRvRGF0YVVSTCggJ2ltYWdlL3dlYnAnICkuc3Vic3RyKDUsMTApICE9PSAnaW1hZ2Uvd2VicCcgKXtcclxuXHRcdGNvbnNvbGUubG9nKCBcIldlYlAgbm90IHN1cHBvcnRlZCAtIHRyeSBhbm90aGVyIGV4cG9ydCBmb3JtYXRcIiApXHJcblx0fVxyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLnF1YWxpdHkgPSAoIHNldHRpbmdzLnF1YWxpdHkgLyAxMDAgKSB8fCAuODtcclxuXHJcblx0dGhpcy5leHRlbnNpb24gPSAnLndlYm0nXHJcblx0dGhpcy5taW1lVHlwZSA9ICd2aWRlby93ZWJtJ1xyXG5cdHRoaXMuYmFzZUZpbGVuYW1lID0gdGhpcy5maWxlbmFtZTtcclxuXHJcblx0dGhpcy5mcmFtZXMgPSBbXTtcclxuXHR0aGlzLnBhcnQgPSAxO1xyXG5cclxuICB0aGlzLnZpZGVvV3JpdGVyID0gbmV3IFdlYk1Xcml0ZXIoe1xyXG4gICAgcXVhbGl0eTogdGhpcy5xdWFsaXR5LFxyXG4gICAgZmlsZVdyaXRlcjogbnVsbCxcclxuICAgIGZkOiBudWxsLFxyXG4gICAgZnJhbWVSYXRlOiBzZXR0aW5ncy5mcmFtZXJhdGVcclxufSk7XHJcblxyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5kaXNwb3NlKCk7XHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuICB0aGlzLnZpZGVvV3JpdGVyLmFkZEZyYW1lKGNhbnZhcyk7XHJcblxyXG5cdC8vdGhpcy5mcmFtZXMucHVzaCggY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2Uvd2VicCcsIHRoaXMucXVhbGl0eSkgKTtcclxuXHJcblx0aWYoIHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lID4gMCAmJiAoIHRoaXMuZnJhbWVzLmxlbmd0aCAvIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlICkgPj0gdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgKSB7XHJcblx0XHR0aGlzLnNhdmUoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0XHR0aGlzLmZpbGVuYW1lID0gdGhpcy5iYXNlRmlsZW5hbWUgKyAnLXBhcnQtJyArIHBhZCggdGhpcy5wYXJ0ICk7XHJcblx0XHRcdGRvd25sb2FkKCBibG9iLCB0aGlzLmZpbGVuYW1lICsgdGhpcy5leHRlbnNpb24sIHRoaXMubWltZVR5cGUgKTtcclxuXHRcdFx0dGhpcy5kaXNwb3NlKCk7XHJcblx0XHRcdHRoaXMucGFydCsrO1xyXG5cdFx0XHR0aGlzLmZpbGVuYW1lID0gdGhpcy5iYXNlRmlsZW5hbWUgKyAnLXBhcnQtJyArIHBhZCggdGhpcy5wYXJ0ICk7XHJcblx0XHRcdHRoaXMuc3RlcCgpO1xyXG5cdFx0fS5iaW5kKCB0aGlzICkgKVxyXG5cdH0gZWxzZSB7XHJcblx0XHR0aGlzLnN0ZXAoKTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuLy9cdGlmKCAhdGhpcy5mcmFtZXMubGVuZ3RoICkgcmV0dXJuO1xyXG5cclxuICB0aGlzLnZpZGVvV3JpdGVyLmNvbXBsZXRlKCkudGhlbihjYWxsYmFjayk7XHJcblxyXG5cdC8qdmFyIHdlYm0gPSBXaGFtbXkuZnJvbUltYWdlQXJyYXkoIHRoaXMuZnJhbWVzLCB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApXHJcblx0dmFyIGJsb2IgPSBuZXcgQmxvYiggWyB3ZWJtIF0sIHsgdHlwZTogXCJvY3RldC9zdHJlYW1cIiB9ICk7XHJcblx0Y2FsbGJhY2soIGJsb2IgKTsqL1xyXG5cclxufVxyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZnJhbWVzID0gW107XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiBDQ0ZGTXBlZ1NlcnZlckVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHRzZXR0aW5ncy5xdWFsaXR5ID0gKCBzZXR0aW5ncy5xdWFsaXR5IC8gMTAwICkgfHwgLjg7XHJcblxyXG5cdHRoaXMuZW5jb2RlciA9IG5ldyBGRk1wZWdTZXJ2ZXIuVmlkZW8oIHNldHRpbmdzICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdwcm9jZXNzJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCAncHJvY2VzcycgKVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbignZmluaXNoZWQnLCBmdW5jdGlvbiggdXJsLCBzaXplICkge1xyXG4gICAgICAgIHZhciBjYiA9IHRoaXMuY2FsbGJhY2s7XHJcbiAgICAgICAgaWYgKCBjYiApIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgY2IoIHVybCwgc2l6ZSApO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcbiAgICB0aGlzLmVuY29kZXIub24oICdwcm9ncmVzcycsIGZ1bmN0aW9uKCBwcm9ncmVzcyApIHtcclxuICAgICAgICBpZiAoIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyApIHtcclxuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzKCBwcm9ncmVzcyApXHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ2Vycm9yJywgZnVuY3Rpb24oIGRhdGEgKSB7XHJcbiAgICAgICAgYWxlcnQoSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMikpO1xyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuXHJcbn1cclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLnN0YXJ0KCB0aGlzLnNldHRpbmdzICk7XHJcblxyXG59O1xyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuYWRkKCBjYW52YXMgKTtcclxuXHJcbn1cclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbiAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XHJcbiAgICB0aGlzLmVuY29kZXIuZW5kKCk7XHJcblxyXG59XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLnNhZmVUb1Byb2NlZWQgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmVuY29kZXIuc2FmZVRvUHJvY2VlZCgpO1xyXG59O1xyXG5cclxuLypcclxuXHRIVE1MQ2FudmFzRWxlbWVudC5jYXB0dXJlU3RyZWFtKClcclxuKi9cclxuXHJcbmZ1bmN0aW9uIENDU3RyZWFtRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMuZnJhbWVyYXRlID0gdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGU7XHJcblx0dGhpcy50eXBlID0gJ3ZpZGVvL3dlYm0nO1xyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy53ZWJtJztcclxuXHR0aGlzLnN0cmVhbSA9IG51bGw7XHJcblx0dGhpcy5tZWRpYVJlY29yZGVyID0gbnVsbDtcclxuXHR0aGlzLmNodW5rcyA9IFtdO1xyXG5cclxufVxyXG5cclxuQ0NTdHJlYW1FbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NTdHJlYW1FbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRpZiggIXRoaXMuc3RyZWFtICkge1xyXG5cdFx0dGhpcy5zdHJlYW0gPSBjYW52YXMuY2FwdHVyZVN0cmVhbSggdGhpcy5mcmFtZXJhdGUgKTtcclxuXHRcdHRoaXMubWVkaWFSZWNvcmRlciA9IG5ldyBNZWRpYVJlY29yZGVyKCB0aGlzLnN0cmVhbSApO1xyXG5cdFx0dGhpcy5tZWRpYVJlY29yZGVyLnN0YXJ0KCk7XHJcblxyXG5cdFx0dGhpcy5tZWRpYVJlY29yZGVyLm9uZGF0YWF2YWlsYWJsZSA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0dGhpcy5jaHVua3MucHVzaChlLmRhdGEpO1xyXG5cdFx0fS5iaW5kKCB0aGlzICk7XHJcblxyXG5cdH1cclxuXHR0aGlzLnN0ZXAoKTtcclxuXHJcbn1cclxuXHJcbkNDU3RyZWFtRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0dGhpcy5tZWRpYVJlY29yZGVyLm9uc3RvcCA9IGZ1bmN0aW9uKCBlICkge1xyXG5cdFx0dmFyIGJsb2IgPSBuZXcgQmxvYiggdGhpcy5jaHVua3MsIHsgJ3R5cGUnIDogJ3ZpZGVvL3dlYm0nIH0pO1xyXG5cdFx0dGhpcy5jaHVua3MgPSBbXTtcclxuXHRcdGNhbGxiYWNrKCBibG9iICk7XHJcblxyXG5cdH0uYmluZCggdGhpcyApO1xyXG5cclxuXHR0aGlzLm1lZGlhUmVjb3JkZXIuc3RvcCgpO1xyXG5cclxufVxyXG5cclxuLypmdW5jdGlvbiBDQ0dJRkVuY29kZXIoIHNldHRpbmdzICkge1xyXG5cclxuXHRDQ0ZyYW1lRW5jb2Rlci5jYWxsKCB0aGlzICk7XHJcblxyXG5cdHNldHRpbmdzLnF1YWxpdHkgPSBzZXR0aW5ncy5xdWFsaXR5IHx8IDY7XHJcblx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xyXG5cclxuXHR0aGlzLmVuY29kZXIgPSBuZXcgR0lGRW5jb2RlcigpO1xyXG5cdHRoaXMuZW5jb2Rlci5zZXRSZXBlYXQoIDEgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXREZWxheSggc2V0dGluZ3Muc3RlcCApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldFF1YWxpdHkoIDYgKTtcclxuICBcdHRoaXMuZW5jb2Rlci5zZXRUcmFuc3BhcmVudCggbnVsbCApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldFNpemUoIDE1MCwgMTUwICk7XHJcblxyXG4gIFx0dGhpcy5jYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG4gIFx0dGhpcy5jdHggPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCAnMmQnICk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIgKTtcclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLnN0YXJ0KCk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuY2FudmFzLndpZHRoID0gY2FudmFzLndpZHRoO1xyXG5cdHRoaXMuY2FudmFzLmhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XHJcblx0dGhpcy5jdHguZHJhd0ltYWdlKCBjYW52YXMsIDAsIDAgKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHRoaXMuY3R4ICk7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5zZXRTaXplKCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQgKTtcclxuXHR2YXIgcmVhZEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGNhbnZhcy53aWR0aCAqIGNhbnZhcy5oZWlnaHQgKiA0KTtcclxuXHR2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICk7XHJcblx0Y29udGV4dC5yZWFkUGl4ZWxzKDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCwgY29udGV4dC5SR0JBLCBjb250ZXh0LlVOU0lHTkVEX0JZVEUsIHJlYWRCdWZmZXIpO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggcmVhZEJ1ZmZlciwgdHJ1ZSApO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5maW5pc2goKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcblx0dmFyIGJpbmFyeV9naWYgPSB0aGlzLmVuY29kZXIuc3RyZWFtKCkuZ2V0RGF0YSgpO1xyXG5cclxuXHR2YXIgZGF0YV91cmwgPSAnZGF0YTppbWFnZS9naWY7YmFzZTY0LCcrZW5jb2RlNjQoYmluYXJ5X2dpZik7XHJcblx0d2luZG93LmxvY2F0aW9uID0gZGF0YV91cmw7XHJcblx0cmV0dXJuO1xyXG5cclxuXHR2YXIgYmxvYiA9IG5ldyBCbG9iKCBbIGJpbmFyeV9naWYgXSwgeyB0eXBlOiBcIm9jdGV0L3N0cmVhbVwiIH0gKTtcclxuXHR2YXIgdXJsID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwoIGJsb2IgKTtcclxuXHRjYWxsYmFjayggdXJsICk7XHJcblxyXG59Ki9cclxuXHJcbmZ1bmN0aW9uIENDR0lGRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHNldHRpbmdzLnF1YWxpdHkgPSAzMSAtICggKCBzZXR0aW5ncy5xdWFsaXR5ICogMzAgLyAxMDAgKSB8fCAxMCApO1xyXG5cdHNldHRpbmdzLndvcmtlcnMgPSBzZXR0aW5ncy53b3JrZXJzIHx8IDQ7XHJcblxyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJy5naWYnXHJcblx0dGhpcy5taW1lVHlwZSA9ICdpbWFnZS9naWYnXHJcblxyXG4gIFx0dGhpcy5jYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG4gIFx0dGhpcy5jdHggPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCAnMmQnICk7XHJcbiAgXHR0aGlzLnNpemVTZXQgPSBmYWxzZTtcclxuXHJcbiAgXHR0aGlzLmVuY29kZXIgPSBuZXcgR0lGKHtcclxuXHRcdHdvcmtlcnM6IHNldHRpbmdzLndvcmtlcnMsXHJcblx0XHRxdWFsaXR5OiBzZXR0aW5ncy5xdWFsaXR5LFxyXG5cdFx0d29ya2VyU2NyaXB0OiBzZXR0aW5ncy53b3JrZXJzUGF0aCArICdnaWYud29ya2VyLmpzJ1xyXG5cdH0gKTtcclxuXHJcbiAgICB0aGlzLmVuY29kZXIub24oICdwcm9ncmVzcycsIGZ1bmN0aW9uKCBwcm9ncmVzcyApIHtcclxuICAgICAgICBpZiAoIHRoaXMuc2V0dGluZ3Mub25Qcm9ncmVzcyApIHtcclxuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzKCBwcm9ncmVzcyApXHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuXHJcbiAgICB0aGlzLmVuY29kZXIub24oJ2ZpbmlzaGVkJywgZnVuY3Rpb24oIGJsb2IgKSB7XHJcbiAgICAgICAgdmFyIGNiID0gdGhpcy5jYWxsYmFjaztcclxuICAgICAgICBpZiAoIGNiICkge1xyXG4gICAgICAgICAgICB0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBjYiggYmxvYiApO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCggdGhpcyApICk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGlmKCAhdGhpcy5zaXplU2V0ICkge1xyXG5cdFx0dGhpcy5lbmNvZGVyLnNldE9wdGlvbiggJ3dpZHRoJyxjYW52YXMud2lkdGggKTtcclxuXHRcdHRoaXMuZW5jb2Rlci5zZXRPcHRpb24oICdoZWlnaHQnLGNhbnZhcy5oZWlnaHQgKTtcclxuXHRcdHRoaXMuc2l6ZVNldCA9IHRydWU7XHJcblx0fVxyXG5cclxuXHR0aGlzLmNhbnZhcy53aWR0aCA9IGNhbnZhcy53aWR0aDtcclxuXHR0aGlzLmNhbnZhcy5oZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xyXG5cdHRoaXMuY3R4LmRyYXdJbWFnZSggY2FudmFzLCAwLCAwICk7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggdGhpcy5jdHgsIHsgY29weTogdHJ1ZSwgZGVsYXk6IHRoaXMuc2V0dGluZ3Muc3RlcCB9ICk7XHJcblx0dGhpcy5zdGVwKCk7XHJcblxyXG5cdC8qdGhpcy5lbmNvZGVyLnNldFNpemUoIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCApO1xyXG5cdHZhciByZWFkQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoY2FudmFzLndpZHRoICogY2FudmFzLmhlaWdodCAqIDQpO1xyXG5cdHZhciBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKTtcclxuXHRjb250ZXh0LnJlYWRQaXhlbHMoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0LCBjb250ZXh0LlJHQkEsIGNvbnRleHQuVU5TSUdORURfQllURSwgcmVhZEJ1ZmZlcik7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCByZWFkQnVmZmVyLCB0cnVlICk7Ki9cclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHJcbiAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5yZW5kZXIoKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDYXB0dXJlKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIF9zZXR0aW5ncyA9IHNldHRpbmdzIHx8IHt9LFxyXG5cdFx0X2RhdGUgPSBuZXcgRGF0ZSgpLFxyXG5cdFx0X3ZlcmJvc2UsXHJcblx0XHRfZGlzcGxheSxcclxuXHRcdF90aW1lLFxyXG5cdFx0X3N0YXJ0VGltZSxcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUsXHJcblx0XHRfcGVyZm9ybWFuY2VTdGFydFRpbWUsXHJcblx0XHRfc3RlcCxcclxuICAgICAgICBfZW5jb2RlcixcclxuXHRcdF90aW1lb3V0cyA9IFtdLFxyXG5cdFx0X2ludGVydmFscyA9IFtdLFxyXG5cdFx0X2ZyYW1lQ291bnQgPSAwLFxyXG5cdFx0X2ludGVybWVkaWF0ZUZyYW1lQ291bnQgPSAwLFxyXG5cdFx0X2xhc3RGcmFtZSA9IG51bGwsXHJcblx0XHRfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzID0gW10sXHJcblx0XHRfY2FwdHVyaW5nID0gZmFsc2UsXHJcbiAgICAgICAgX2hhbmRsZXJzID0ge307XHJcblxyXG5cdF9zZXR0aW5ncy5mcmFtZXJhdGUgPSBfc2V0dGluZ3MuZnJhbWVyYXRlIHx8IDYwO1xyXG5cdF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzID0gMiAqICggX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgfHwgMSApO1xyXG5cdF92ZXJib3NlID0gX3NldHRpbmdzLnZlcmJvc2UgfHwgZmFsc2U7XHJcblx0X2Rpc3BsYXkgPSBfc2V0dGluZ3MuZGlzcGxheSB8fCBmYWxzZTtcclxuXHRfc2V0dGluZ3Muc3RlcCA9IDEwMDAuMCAvIF9zZXR0aW5ncy5mcmFtZXJhdGUgO1xyXG5cdF9zZXR0aW5ncy50aW1lTGltaXQgPSBfc2V0dGluZ3MudGltZUxpbWl0IHx8IDA7XHJcblx0X3NldHRpbmdzLmZyYW1lTGltaXQgPSBfc2V0dGluZ3MuZnJhbWVMaW1pdCB8fCAwO1xyXG5cdF9zZXR0aW5ncy5zdGFydFRpbWUgPSBfc2V0dGluZ3Muc3RhcnRUaW1lIHx8IDA7XHJcblxyXG5cdHZhciBfdGltZURpc3BsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmxlZnQgPSBfdGltZURpc3BsYXkuc3R5bGUudG9wID0gMFxyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnYmxhY2snO1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5mb250RmFtaWx5ID0gJ21vbm9zcGFjZSdcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuZm9udFNpemUgPSAnMTFweCdcclxuXHRfdGltZURpc3BsYXkuc3R5bGUucGFkZGluZyA9ICc1cHgnXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmNvbG9yID0gJ3JlZCc7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnpJbmRleCA9IDEwMDAwMFxyXG5cdGlmKCBfc2V0dGluZ3MuZGlzcGxheSApIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIF90aW1lRGlzcGxheSApO1xyXG5cclxuXHR2YXIgY2FudmFzTW90aW9uQmx1ciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcblx0dmFyIGN0eE1vdGlvbkJsdXIgPSBjYW52YXNNb3Rpb25CbHVyLmdldENvbnRleHQoICcyZCcgKTtcclxuXHR2YXIgYnVmZmVyTW90aW9uQmx1cjtcclxuXHR2YXIgaW1hZ2VEYXRhO1xyXG5cclxuXHRfbG9nKCAnU3RlcCBpcyBzZXQgdG8gJyArIF9zZXR0aW5ncy5zdGVwICsgJ21zJyApO1xyXG5cclxuICAgIHZhciBfZW5jb2RlcnMgPSB7XHJcblx0XHRnaWY6IENDR0lGRW5jb2RlcixcclxuXHRcdHdlYm06IENDV2ViTUVuY29kZXIsXHJcblx0XHRmZm1wZWdzZXJ2ZXI6IENDRkZNcGVnU2VydmVyRW5jb2RlcixcclxuXHRcdHBuZzogQ0NQTkdFbmNvZGVyLFxyXG5cdFx0anBnOiBDQ0pQRUdFbmNvZGVyLFxyXG5cdFx0J3dlYm0tbWVkaWFyZWNvcmRlcic6IENDU3RyZWFtRW5jb2RlclxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgY3RvciA9IF9lbmNvZGVyc1sgX3NldHRpbmdzLmZvcm1hdCBdO1xyXG4gICAgaWYgKCAhY3RvciApIHtcclxuXHRcdHRocm93IFwiRXJyb3I6IEluY29ycmVjdCBvciBtaXNzaW5nIGZvcm1hdDogVmFsaWQgZm9ybWF0cyBhcmUgXCIgKyBPYmplY3Qua2V5cyhfZW5jb2RlcnMpLmpvaW4oXCIsIFwiKTtcclxuICAgIH1cclxuICAgIF9lbmNvZGVyID0gbmV3IGN0b3IoIF9zZXR0aW5ncyApO1xyXG4gICAgX2VuY29kZXIuc3RlcCA9IF9zdGVwXHJcblxyXG5cdF9lbmNvZGVyLm9uKCdwcm9jZXNzJywgX3Byb2Nlc3MpO1xyXG4gICAgX2VuY29kZXIub24oJ3Byb2dyZXNzJywgX3Byb2dyZXNzKTtcclxuXHJcbiAgICBpZiAoXCJwZXJmb3JtYW5jZVwiIGluIHdpbmRvdyA9PSBmYWxzZSkge1xyXG4gICAgXHR3aW5kb3cucGVyZm9ybWFuY2UgPSB7fTtcclxuICAgIH1cclxuXHJcblx0RGF0ZS5ub3cgPSAoRGF0ZS5ub3cgfHwgZnVuY3Rpb24gKCkgeyAgLy8gdGhhbmtzIElFOFxyXG5cdFx0cmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG5cdH0pO1xyXG5cclxuXHRpZiAoXCJub3dcIiBpbiB3aW5kb3cucGVyZm9ybWFuY2UgPT0gZmFsc2Upe1xyXG5cclxuXHRcdHZhciBub3dPZmZzZXQgPSBEYXRlLm5vdygpO1xyXG5cclxuXHRcdGlmIChwZXJmb3JtYW5jZS50aW1pbmcgJiYgcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydCl7XHJcblx0XHRcdG5vd09mZnNldCA9IHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnRcclxuXHRcdH1cclxuXHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24gbm93KCl7XHJcblx0XHRcdHJldHVybiBEYXRlLm5vdygpIC0gbm93T2Zmc2V0O1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dmFyIF9vbGRTZXRUaW1lb3V0ID0gd2luZG93LnNldFRpbWVvdXQsXHJcblx0XHRfb2xkU2V0SW50ZXJ2YWwgPSB3aW5kb3cuc2V0SW50ZXJ2YWwsXHJcblx0ICAgIFx0X29sZENsZWFySW50ZXJ2YWwgPSB3aW5kb3cuY2xlYXJJbnRlcnZhbCxcclxuXHRcdF9vbGRDbGVhclRpbWVvdXQgPSB3aW5kb3cuY2xlYXJUaW1lb3V0LFxyXG5cdFx0X29sZFJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXHJcblx0XHRfb2xkTm93ID0gd2luZG93LkRhdGUubm93LFxyXG5cdFx0X29sZFBlcmZvcm1hbmNlTm93ID0gd2luZG93LnBlcmZvcm1hbmNlLm5vdyxcclxuXHRcdF9vbGRHZXRUaW1lID0gd2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWU7XHJcblx0Ly8gRGF0ZS5wcm90b3R5cGUuX29sZEdldFRpbWUgPSBEYXRlLnByb3RvdHlwZS5nZXRUaW1lO1xyXG5cclxuXHR2YXIgbWVkaWEgPSBbXTtcclxuXHJcblx0ZnVuY3Rpb24gX2luaXQoKSB7XHJcblxyXG5cdFx0X2xvZyggJ0NhcHR1cmVyIHN0YXJ0JyApO1xyXG5cclxuXHRcdF9zdGFydFRpbWUgPSB3aW5kb3cuRGF0ZS5ub3coKTtcclxuXHRcdF90aW1lID0gX3N0YXJ0VGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblx0XHRfcGVyZm9ybWFuY2VTdGFydFRpbWUgPSB3aW5kb3cucGVyZm9ybWFuY2Uubm93KCk7XHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lID0gX3BlcmZvcm1hbmNlU3RhcnRUaW1lICsgX3NldHRpbmdzLnN0YXJ0VGltZTtcclxuXHJcblx0XHR3aW5kb3cuRGF0ZS5wcm90b3R5cGUuZ2V0VGltZSA9IGZ1bmN0aW9uKCl7XHJcblx0XHRcdHJldHVybiBfdGltZTtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cuRGF0ZS5ub3cgPSBmdW5jdGlvbigpIHtcclxuXHRcdFx0cmV0dXJuIF90aW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHR3aW5kb3cuc2V0VGltZW91dCA9IGZ1bmN0aW9uKCBjYWxsYmFjaywgdGltZSApIHtcclxuXHRcdFx0dmFyIHQgPSB7XHJcblx0XHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxyXG5cdFx0XHRcdHRpbWU6IHRpbWUsXHJcblx0XHRcdFx0dHJpZ2dlclRpbWU6IF90aW1lICsgdGltZVxyXG5cdFx0XHR9O1xyXG5cdFx0XHRfdGltZW91dHMucHVzaCggdCApO1xyXG5cdFx0XHRfbG9nKCAnVGltZW91dCBzZXQgdG8gJyArIHQudGltZSApO1xyXG4gICAgICAgICAgICByZXR1cm4gdDtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0ID0gZnVuY3Rpb24oIGlkICkge1xyXG5cdFx0XHRmb3IoIHZhciBqID0gMDsgaiA8IF90aW1lb3V0cy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0XHRpZiggX3RpbWVvdXRzWyBqIF0gPT0gaWQgKSB7XHJcblx0XHRcdFx0XHRfdGltZW91dHMuc3BsaWNlKCBqLCAxICk7XHJcblx0XHRcdFx0XHRfbG9nKCAnVGltZW91dCBjbGVhcmVkJyApO1xyXG5cdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LnNldEludGVydmFsID0gZnVuY3Rpb24oIGNhbGxiYWNrLCB0aW1lICkge1xyXG5cdFx0XHR2YXIgdCA9IHtcclxuXHRcdFx0XHRjYWxsYmFjazogY2FsbGJhY2ssXHJcblx0XHRcdFx0dGltZTogdGltZSxcclxuXHRcdFx0XHR0cmlnZ2VyVGltZTogX3RpbWUgKyB0aW1lXHJcblx0XHRcdH07XHJcblx0XHRcdF9pbnRlcnZhbHMucHVzaCggdCApO1xyXG5cdFx0XHRfbG9nKCAnSW50ZXJ2YWwgc2V0IHRvICcgKyB0LnRpbWUgKTtcclxuXHRcdFx0cmV0dXJuIHQ7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LmNsZWFySW50ZXJ2YWwgPSBmdW5jdGlvbiggaWQgKSB7XHJcblx0XHRcdF9sb2coICdjbGVhciBJbnRlcnZhbCcgKTtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKCBjYWxsYmFjayApIHtcclxuXHRcdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcy5wdXNoKCBjYWxsYmFjayApO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbigpe1xyXG5cdFx0XHRyZXR1cm4gX3BlcmZvcm1hbmNlVGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0ZnVuY3Rpb24gaG9va0N1cnJlbnRUaW1lKCkge1xyXG5cdFx0XHRpZiggIXRoaXMuX2hvb2tlZCApIHtcclxuXHRcdFx0XHR0aGlzLl9ob29rZWQgPSB0cnVlO1xyXG5cdFx0XHRcdHRoaXMuX2hvb2tlZFRpbWUgPSB0aGlzLmN1cnJlbnRUaW1lIHx8IDA7XHJcblx0XHRcdFx0dGhpcy5wYXVzZSgpO1xyXG5cdFx0XHRcdG1lZGlhLnB1c2goIHRoaXMgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdGhpcy5faG9va2VkVGltZSArIF9zZXR0aW5ncy5zdGFydFRpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdHRyeSB7XHJcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSggSFRNTFZpZGVvRWxlbWVudC5wcm90b3R5cGUsICdjdXJyZW50VGltZScsIHsgZ2V0OiBob29rQ3VycmVudFRpbWUgfSApXHJcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSggSFRNTEF1ZGlvRWxlbWVudC5wcm90b3R5cGUsICdjdXJyZW50VGltZScsIHsgZ2V0OiBob29rQ3VycmVudFRpbWUgfSApXHJcblx0XHR9IGNhdGNoIChlcnIpIHtcclxuXHRcdFx0X2xvZyhlcnIpO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zdGFydCgpIHtcclxuXHRcdF9pbml0KCk7XHJcblx0XHRfZW5jb2Rlci5zdGFydCgpO1xyXG5cdFx0X2NhcHR1cmluZyA9IHRydWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RvcCgpIHtcclxuXHRcdF9jYXB0dXJpbmcgPSBmYWxzZTtcclxuXHRcdF9lbmNvZGVyLnN0b3AoKTtcclxuXHRcdF9kZXN0cm95KCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2FsbCggZm4sIHAgKSB7XHJcblx0XHRfb2xkU2V0VGltZW91dCggZm4sIDAsIHAgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zdGVwKCkge1xyXG5cdFx0Ly9fb2xkUmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBfcHJvY2VzcyApO1xyXG5cdFx0X2NhbGwoIF9wcm9jZXNzICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfZGVzdHJveSgpIHtcclxuXHRcdF9sb2coICdDYXB0dXJlciBzdG9wJyApO1xyXG5cdFx0d2luZG93LnNldFRpbWVvdXQgPSBfb2xkU2V0VGltZW91dDtcclxuXHRcdHdpbmRvdy5zZXRJbnRlcnZhbCA9IF9vbGRTZXRJbnRlcnZhbDtcclxuXHRcdHdpbmRvdy5jbGVhckludGVydmFsID0gX29sZENsZWFySW50ZXJ2YWw7XHJcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0ID0gX29sZENsZWFyVGltZW91dDtcclxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBfb2xkUmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xyXG5cdFx0d2luZG93LkRhdGUucHJvdG90eXBlLmdldFRpbWUgPSBfb2xkR2V0VGltZTtcclxuXHRcdHdpbmRvdy5EYXRlLm5vdyA9IF9vbGROb3c7XHJcblx0XHR3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gX29sZFBlcmZvcm1hbmNlTm93O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3VwZGF0ZVRpbWUoKSB7XHJcblx0XHR2YXIgc2Vjb25kcyA9IF9mcmFtZUNvdW50IC8gX3NldHRpbmdzLmZyYW1lcmF0ZTtcclxuXHRcdGlmKCAoIF9zZXR0aW5ncy5mcmFtZUxpbWl0ICYmIF9mcmFtZUNvdW50ID49IF9zZXR0aW5ncy5mcmFtZUxpbWl0ICkgfHwgKCBfc2V0dGluZ3MudGltZUxpbWl0ICYmIHNlY29uZHMgPj0gX3NldHRpbmdzLnRpbWVMaW1pdCApICkge1xyXG5cdFx0XHRfc3RvcCgpO1xyXG5cdFx0XHRfc2F2ZSgpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGQgPSBuZXcgRGF0ZSggbnVsbCApO1xyXG5cdFx0ZC5zZXRTZWNvbmRzKCBzZWNvbmRzICk7XHJcblx0XHRpZiggX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgPiAyICkge1xyXG5cdFx0XHRfdGltZURpc3BsYXkudGV4dENvbnRlbnQgPSAnQ0NhcHR1cmUgJyArIF9zZXR0aW5ncy5mb3JtYXQgKyAnIHwgJyArIF9mcmFtZUNvdW50ICsgJyBmcmFtZXMgKCcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCArICcgaW50ZXIpIHwgJyArICBkLnRvSVNPU3RyaW5nKCkuc3Vic3RyKCAxMSwgOCApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0X3RpbWVEaXNwbGF5LnRleHRDb250ZW50ID0gJ0NDYXB0dXJlICcgKyBfc2V0dGluZ3MuZm9ybWF0ICsgJyB8ICcgKyBfZnJhbWVDb3VudCArICcgZnJhbWVzIHwgJyArICBkLnRvSVNPU3RyaW5nKCkuc3Vic3RyKCAxMSwgOCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NoZWNrRnJhbWUoIGNhbnZhcyApIHtcclxuXHJcblx0XHRpZiggY2FudmFzTW90aW9uQmx1ci53aWR0aCAhPT0gY2FudmFzLndpZHRoIHx8IGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICE9PSBjYW52YXMuaGVpZ2h0ICkge1xyXG5cdFx0XHRjYW52YXNNb3Rpb25CbHVyLndpZHRoID0gY2FudmFzLndpZHRoO1xyXG5cdFx0XHRjYW52YXNNb3Rpb25CbHVyLmhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXIgPSBuZXcgVWludDE2QXJyYXkoIGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICogY2FudmFzTW90aW9uQmx1ci53aWR0aCAqIDQgKTtcclxuXHRcdFx0Y3R4TW90aW9uQmx1ci5maWxsU3R5bGUgPSAnIzAnXHJcblx0XHRcdGN0eE1vdGlvbkJsdXIuZmlsbFJlY3QoIDAsIDAsIGNhbnZhc01vdGlvbkJsdXIud2lkdGgsIGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICk7XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2JsZW5kRnJhbWUoIGNhbnZhcyApIHtcclxuXHJcblx0XHQvL19sb2coICdJbnRlcm1lZGlhdGUgRnJhbWU6ICcgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCApO1xyXG5cclxuXHRcdGN0eE1vdGlvbkJsdXIuZHJhd0ltYWdlKCBjYW52YXMsIDAsIDAgKTtcclxuXHRcdGltYWdlRGF0YSA9IGN0eE1vdGlvbkJsdXIuZ2V0SW1hZ2VEYXRhKCAwLCAwLCBjYW52YXNNb3Rpb25CbHVyLndpZHRoLCBjYW52YXNNb3Rpb25CbHVyLmhlaWdodCApO1xyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBidWZmZXJNb3Rpb25CbHVyLmxlbmd0aDsgais9IDQgKSB7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogXSArPSBpbWFnZURhdGEuZGF0YVsgaiBdO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMSBdICs9IGltYWdlRGF0YS5kYXRhWyBqICsgMSBdO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMiBdICs9IGltYWdlRGF0YS5kYXRhWyBqICsgMiBdO1xyXG5cdFx0fVxyXG5cdFx0X2ludGVybWVkaWF0ZUZyYW1lQ291bnQrKztcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc2F2ZUZyYW1lKCl7XHJcblxyXG5cdFx0dmFyIGRhdGEgPSBpbWFnZURhdGEuZGF0YTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRkYXRhWyBqIF0gPSBidWZmZXJNb3Rpb25CbHVyWyBqIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHRcdGRhdGFbIGogKyAxIF0gPSBidWZmZXJNb3Rpb25CbHVyWyBqICsgMSBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0XHRkYXRhWyBqICsgMiBdID0gYnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdH1cclxuXHRcdGN0eE1vdGlvbkJsdXIucHV0SW1hZ2VEYXRhKCBpbWFnZURhdGEsIDAsIDAgKTtcclxuXHRcdF9lbmNvZGVyLmFkZCggY2FudmFzTW90aW9uQmx1ciApO1xyXG5cdFx0X2ZyYW1lQ291bnQrKztcclxuXHRcdF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ID0gMDtcclxuXHRcdF9sb2coICdGdWxsIE1CIEZyYW1lISAnICsgX2ZyYW1lQ291bnQgKyAnICcgKyAgX3RpbWUgKTtcclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgYnVmZmVyTW90aW9uQmx1ci5sZW5ndGg7IGorPSA0ICkge1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqIF0gPSAwO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMSBdID0gMDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiArIDIgXSA9IDA7XHJcblx0XHR9XHJcblx0XHRnYygpO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jYXB0dXJlKCBjYW52YXMgKSB7XHJcblxyXG5cdFx0aWYoIF9jYXB0dXJpbmcgKSB7XHJcblxyXG5cdFx0XHRpZiggX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgPiAyICkge1xyXG5cclxuXHRcdFx0XHRfY2hlY2tGcmFtZSggY2FudmFzICk7XHJcblx0XHRcdFx0X2JsZW5kRnJhbWUoIGNhbnZhcyApO1xyXG5cclxuXHRcdFx0XHRpZiggX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgPj0gLjUgKiBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyApIHtcclxuXHRcdFx0XHRcdF9zYXZlRnJhbWUoKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0X3N0ZXAoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdF9lbmNvZGVyLmFkZCggY2FudmFzICk7XHJcblx0XHRcdFx0X2ZyYW1lQ291bnQrKztcclxuXHRcdFx0XHRfbG9nKCAnRnVsbCBGcmFtZSEgJyArIF9mcmFtZUNvdW50ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3Byb2Nlc3MoKSB7XHJcblxyXG5cdFx0dmFyIHN0ZXAgPSAxMDAwIC8gX3NldHRpbmdzLmZyYW1lcmF0ZTtcclxuXHRcdHZhciBkdCA9ICggX2ZyYW1lQ291bnQgKyBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzICkgKiBzdGVwO1xyXG5cclxuXHRcdF90aW1lID0gX3N0YXJ0VGltZSArIGR0O1xyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSA9IF9wZXJmb3JtYW5jZVN0YXJ0VGltZSArIGR0O1xyXG5cclxuXHRcdG1lZGlhLmZvckVhY2goIGZ1bmN0aW9uKCB2ICkge1xyXG5cdFx0XHR2Ll9ob29rZWRUaW1lID0gZHQgLyAxMDAwO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdF91cGRhdGVUaW1lKCk7XHJcblx0XHRfbG9nKCAnRnJhbWU6ICcgKyBfZnJhbWVDb3VudCArICcgJyArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ICk7XHJcblxyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBfdGltZW91dHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdGlmKCBfdGltZSA+PSBfdGltZW91dHNbIGogXS50cmlnZ2VyVGltZSApIHtcclxuXHRcdFx0XHRfY2FsbCggX3RpbWVvdXRzWyBqIF0uY2FsbGJhY2sgKVxyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coICd0aW1lb3V0IScgKTtcclxuXHRcdFx0XHRfdGltZW91dHMuc3BsaWNlKCBqLCAxICk7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IF9pbnRlcnZhbHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdGlmKCBfdGltZSA+PSBfaW50ZXJ2YWxzWyBqIF0udHJpZ2dlclRpbWUgKSB7XHJcblx0XHRcdFx0X2NhbGwoIF9pbnRlcnZhbHNbIGogXS5jYWxsYmFjayApO1xyXG5cdFx0XHRcdF9pbnRlcnZhbHNbIGogXS50cmlnZ2VyVGltZSArPSBfaW50ZXJ2YWxzWyBqIF0udGltZTtcclxuXHRcdFx0XHQvL2NvbnNvbGUubG9nKCAnaW50ZXJ2YWwhJyApO1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0X3JlcXVlc3RBbmltYXRpb25GcmFtZUNhbGxiYWNrcy5mb3JFYWNoKCBmdW5jdGlvbiggY2IgKSB7XHJcbiAgICAgXHRcdF9jYWxsKCBjYiwgX3RpbWUgLSBnX3N0YXJ0VGltZSApO1xyXG4gICAgICAgIH0gKTtcclxuICAgICAgICBfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzID0gW107XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3NhdmUoIGNhbGxiYWNrICkge1xyXG5cclxuXHRcdGlmKCAhY2FsbGJhY2sgKSB7XHJcblx0XHRcdGNhbGxiYWNrID0gZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRcdFx0ZG93bmxvYWQoIGJsb2IsIF9lbmNvZGVyLmZpbGVuYW1lICsgX2VuY29kZXIuZXh0ZW5zaW9uLCBfZW5jb2Rlci5taW1lVHlwZSApO1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0X2VuY29kZXIuc2F2ZSggY2FsbGJhY2sgKTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfbG9nKCBtZXNzYWdlICkge1xyXG5cdFx0aWYoIF92ZXJib3NlICkgY29uc29sZS5sb2coIG1lc3NhZ2UgKTtcclxuXHR9XHJcblxyXG4gICAgZnVuY3Rpb24gX29uKCBldmVudCwgaGFuZGxlciApIHtcclxuXHJcbiAgICAgICAgX2hhbmRsZXJzW2V2ZW50XSA9IGhhbmRsZXI7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9lbWl0KCBldmVudCApIHtcclxuXHJcbiAgICAgICAgdmFyIGhhbmRsZXIgPSBfaGFuZGxlcnNbZXZlbnRdO1xyXG4gICAgICAgIGlmICggaGFuZGxlciApIHtcclxuXHJcbiAgICAgICAgICAgIGhhbmRsZXIuYXBwbHkoIG51bGwsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBhcmd1bWVudHMsIDEgKSApO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9wcm9ncmVzcyggcHJvZ3Jlc3MgKSB7XHJcblxyXG4gICAgICAgIF9lbWl0KCAncHJvZ3Jlc3MnLCBwcm9ncmVzcyApO1xyXG5cclxuICAgIH1cclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdHN0YXJ0OiBfc3RhcnQsXHJcblx0XHRjYXB0dXJlOiBfY2FwdHVyZSxcclxuXHRcdHN0b3A6IF9zdG9wLFxyXG5cdFx0c2F2ZTogX3NhdmUsXHJcbiAgICAgICAgb246IF9vblxyXG5cdH1cclxufVxyXG5cclxuKGZyZWVXaW5kb3cgfHwgZnJlZVNlbGYgfHwge30pLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcblxyXG4gIC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMgbGlrZSByLmpzIGNoZWNrIGZvciBjb25kaXRpb24gcGF0dGVybnMgbGlrZSB0aGUgZm9sbG93aW5nOlxyXG4gIGlmICh0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiYgZGVmaW5lLmFtZCkge1xyXG4gICAgLy8gRGVmaW5lIGFzIGFuIGFub255bW91cyBtb2R1bGUgc28sIHRocm91Z2ggcGF0aCBtYXBwaW5nLCBpdCBjYW4gYmVcclxuICAgIC8vIHJlZmVyZW5jZWQgYXMgdGhlIFwidW5kZXJzY29yZVwiIG1vZHVsZS5cclxuICAgIGRlZmluZShmdW5jdGlvbigpIHtcclxuICAgIFx0cmV0dXJuIENDYXB0dXJlO1xyXG4gICAgfSk7XHJcbn1cclxuICAvLyBDaGVjayBmb3IgYGV4cG9ydHNgIGFmdGVyIGBkZWZpbmVgIGluIGNhc2UgYSBidWlsZCBvcHRpbWl6ZXIgYWRkcyBhbiBgZXhwb3J0c2Agb2JqZWN0LlxyXG4gIGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUpIHtcclxuICAgIC8vIEV4cG9ydCBmb3IgTm9kZS5qcy5cclxuICAgIGlmIChtb2R1bGVFeHBvcnRzKSB7XHJcbiAgICBcdChmcmVlTW9kdWxlLmV4cG9ydHMgPSBDQ2FwdHVyZSkuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxuICAgIH1cclxuICAgIC8vIEV4cG9ydCBmb3IgQ29tbW9uSlMgc3VwcG9ydC5cclxuICAgIGZyZWVFeHBvcnRzLkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbn1cclxuZWxzZSB7XHJcbiAgICAvLyBFeHBvcnQgdG8gdGhlIGdsb2JhbCBvYmplY3QuXHJcbiAgICByb290LkNDYXB0dXJlID0gQ0NhcHR1cmU7XHJcbn1cclxuXHJcbn0oKSk7XHJcbiIsIi8qKlxuICogQGF1dGhvciBhbHRlcmVkcSAvIGh0dHA6Ly9hbHRlcmVkcXVhbGlhLmNvbS9cbiAqIEBhdXRob3IgbXIuZG9vYiAvIGh0dHA6Ly9tcmRvb2IuY29tL1xuICovXG5cbnZhciBEZXRlY3RvciA9IHtcblxuXHRjYW52YXM6ICEhIHdpbmRvdy5DYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsXG5cdHdlYmdsOiAoIGZ1bmN0aW9uICgpIHtcblxuXHRcdHRyeSB7XG5cblx0XHRcdHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApOyByZXR1cm4gISEgKCB3aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0ICYmICggY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKSB8fCBjYW52YXMuZ2V0Q29udGV4dCggJ2V4cGVyaW1lbnRhbC13ZWJnbCcgKSApICk7XG5cblx0XHR9IGNhdGNoICggZSApIHtcblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXG5cdFx0fVxuXG5cdH0gKSgpLFxuXHR3b3JrZXJzOiAhISB3aW5kb3cuV29ya2VyLFxuXHRmaWxlYXBpOiB3aW5kb3cuRmlsZSAmJiB3aW5kb3cuRmlsZVJlYWRlciAmJiB3aW5kb3cuRmlsZUxpc3QgJiYgd2luZG93LkJsb2IsXG5cblx0Z2V0V2ViR0xFcnJvck1lc3NhZ2U6IGZ1bmN0aW9uICgpIHtcblxuXHRcdHZhciBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRlbGVtZW50LmlkID0gJ3dlYmdsLWVycm9yLW1lc3NhZ2UnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udEZhbWlseSA9ICdtb25vc3BhY2UnO1xuXHRcdGVsZW1lbnQuc3R5bGUuZm9udFNpemUgPSAnMTNweCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5mb250V2VpZ2h0ID0gJ25vcm1hbCc7XG5cdFx0ZWxlbWVudC5zdHlsZS50ZXh0QWxpZ24gPSAnY2VudGVyJztcblx0XHRlbGVtZW50LnN0eWxlLmJhY2tncm91bmQgPSAnI2ZmZic7XG5cdFx0ZWxlbWVudC5zdHlsZS5jb2xvciA9ICcjMDAwJztcblx0XHRlbGVtZW50LnN0eWxlLnBhZGRpbmcgPSAnMS41ZW0nO1xuXHRcdGVsZW1lbnQuc3R5bGUuekluZGV4ID0gJzk5OSc7XG5cdFx0ZWxlbWVudC5zdHlsZS53aWR0aCA9ICc0MDBweCc7XG5cdFx0ZWxlbWVudC5zdHlsZS5tYXJnaW4gPSAnNWVtIGF1dG8gMCc7XG5cblx0XHRpZiAoICEgdGhpcy53ZWJnbCApIHtcblxuXHRcdFx0ZWxlbWVudC5pbm5lckhUTUwgPSB3aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0ID8gW1xuXHRcdFx0XHQnWW91ciBncmFwaGljcyBjYXJkIGRvZXMgbm90IHNlZW0gdG8gc3VwcG9ydCA8YSBocmVmPVwiaHR0cDovL2tocm9ub3Mub3JnL3dlYmdsL3dpa2kvR2V0dGluZ19hX1dlYkdMX0ltcGxlbWVudGF0aW9uXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+V2ViR0w8L2E+LjxiciAvPicsXG5cdFx0XHRcdCdGaW5kIG91dCBob3cgdG8gZ2V0IGl0IDxhIGhyZWY9XCJodHRwOi8vZ2V0LndlYmdsLm9yZy9cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5oZXJlPC9hPi4nXG5cdFx0XHRdLmpvaW4oICdcXG4nICkgOiBbXG5cdFx0XHRcdCdZb3VyIGJyb3dzZXIgZG9lcyBub3Qgc2VlbSB0byBzdXBwb3J0IDxhIGhyZWY9XCJodHRwOi8va2hyb25vcy5vcmcvd2ViZ2wvd2lraS9HZXR0aW5nX2FfV2ViR0xfSW1wbGVtZW50YXRpb25cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5XZWJHTDwvYT4uPGJyLz4nLFxuXHRcdFx0XHQnRmluZCBvdXQgaG93IHRvIGdldCBpdCA8YSBocmVmPVwiaHR0cDovL2dldC53ZWJnbC5vcmcvXCIgc3R5bGU9XCJjb2xvcjojMDAwXCI+aGVyZTwvYT4uJ1xuXHRcdFx0XS5qb2luKCAnXFxuJyApO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVsZW1lbnQ7XG5cblx0fSxcblxuXHRhZGRHZXRXZWJHTE1lc3NhZ2U6IGZ1bmN0aW9uICggcGFyYW1ldGVycyApIHtcblxuXHRcdHZhciBwYXJlbnQsIGlkLCBlbGVtZW50O1xuXG5cdFx0cGFyYW1ldGVycyA9IHBhcmFtZXRlcnMgfHwge307XG5cblx0XHRwYXJlbnQgPSBwYXJhbWV0ZXJzLnBhcmVudCAhPT0gdW5kZWZpbmVkID8gcGFyYW1ldGVycy5wYXJlbnQgOiBkb2N1bWVudC5ib2R5O1xuXHRcdGlkID0gcGFyYW1ldGVycy5pZCAhPT0gdW5kZWZpbmVkID8gcGFyYW1ldGVycy5pZCA6ICdvbGRpZSc7XG5cblx0XHRlbGVtZW50ID0gRGV0ZWN0b3IuZ2V0V2ViR0xFcnJvck1lc3NhZ2UoKTtcblx0XHRlbGVtZW50LmlkID0gaWQ7XG5cblx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQoIGVsZW1lbnQgKTtcblxuXHR9XG5cbn07XG5cbi8vRVM2IGV4cG9ydFxuXG5leHBvcnQgeyBEZXRlY3RvciB9O1xuIiwiLy9UaGlzIGxpYnJhcnkgaXMgZGVzaWduZWQgdG8gaGVscCBzdGFydCB0aHJlZS5qcyBlYXNpbHksIGNyZWF0aW5nIHRoZSByZW5kZXIgbG9vcCBhbmQgY2FudmFzIGF1dG9tYWdpY2FsbHkuXG4vL1JlYWxseSBpdCBzaG91bGQgYmUgc3B1biBvZmYgaW50byBpdHMgb3duIHRoaW5nIGluc3RlYWQgb2YgYmVpbmcgcGFydCBvZiBleHBsYW5hcmlhLlxuXG4vL2Fsc28sIGNoYW5nZSBUaHJlZWFzeV9FbnZpcm9ubWVudCB0byBUaHJlZWFzeV9SZWNvcmRlciB0byBkb3dubG9hZCBoaWdoLXF1YWxpdHkgZnJhbWVzIG9mIGFuIGFuaW1hdGlvblxuXG5pbXBvcnQgQ0NhcHR1cmUgZnJvbSAnY2NhcHR1cmUuanMnO1xuaW1wb3J0IHsgRGV0ZWN0b3IgfSBmcm9tICcuLi9saWIvV2ViR0xfRGV0ZWN0b3IuanMnO1xuXG5mdW5jdGlvbiBUaHJlZWFzeUVudmlyb25tZW50KGF1dG9zdGFydCA9IHRydWUsIGNhbnZhc0VsZW1lbnQgPSBudWxsKXtcblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gMDtcblx0dGhpcy5hdXRvc3RhcnQgPSBhdXRvc3RhcnQ7XG5cdHRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzID0gKGNhbnZhc0VsZW1lbnQgPT09IG51bGwpXG5cblx0aWYoIURldGVjdG9yLndlYmdsKURldGVjdG9yLmFkZEdldFdlYkdMTWVzc2FnZSgpO1xuXG5cdHRoaXMuY2FtZXJhID0gbmV3IFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYSh7XG5cdFx0bmVhcjogLjEsXG5cdFx0ZmFyOiAxMDAwMCxcblxuXHRcdC8vdHlwZTogJ3BlcnNwZWN0aXZlJyxcblx0XHRmb3Y6IDYwLFxuXHRcdGFzcGVjdDogMSxcbi8qXG5cdFx0Ly8gdHlwZTogJ29ydGhvZ3JhcGhpYycsXG5cdFx0bGVmdDogLTEsXG5cdFx0cmlnaHQ6IDEsXG5cdFx0Ym90dG9tOiAtMSxcblx0XHR0b3A6IDEsKi9cblx0ICB9KTtcblxuXHR0aGlzLmNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYSggNzAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDEwMDAwMDAwICk7XG5cdC8vdGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuT3J0aG9ncmFwaGljQ2FtZXJhKCA3MCwgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDAuMSwgMTAgKTtcblxuXHR0aGlzLmNhbWVyYS5wb3NpdGlvbi5zZXQoMCwgMCwgMTApO1xuXHR0aGlzLmNhbWVyYS5sb29rQXQobmV3IFRIUkVFLlZlY3RvcjMoMCwwLDApKTtcblxuXG5cdC8vY3JlYXRlIGNhbWVyYSwgc2NlbmUsIHRpbWVyLCByZW5kZXJlciBvYmplY3RzXG5cdC8vY3JhZXRlIHJlbmRlciBvYmplY3RcblxuXG5cdFxuXHR0aGlzLnNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5cblx0dGhpcy5zY2VuZS5hZGQodGhpcy5jYW1lcmEpO1xuXHRsZXQgcmVuZGVyZXJPcHRpb25zID0geyBhbnRpYWxpYXM6IHRydWV9O1xuXHRpZighdGhpcy5zaG91bGRDcmVhdGVDYW52YXMpe1xuXHRcdHJlbmRlcmVyT3B0aW9uc1tcImNhbnZhc1wiXSA9IGNhbnZhc0VsZW1lbnQ7XG5cdH1cblx0dGhpcy5yZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKCByZW5kZXJlck9wdGlvbnMgKTtcblx0dGhpcy5yZW5kZXJlci5zZXRQaXhlbFJhdGlvKCB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldFNpemUoIHRoaXMuZXZlbmlmeSh3aW5kb3cuaW5uZXJXaWR0aCksdGhpcy5ldmVuaWZ5KHdpbmRvdy5pbm5lckhlaWdodCkgKTtcblx0dGhpcy5yZW5kZXJlci5zZXRDbGVhckNvbG9yKG5ldyBUSFJFRS5Db2xvcigweEZGRkZGRiksIDEuMCk7XG5cdC8qXG5cdHRoaXMucmVuZGVyZXIuZ2FtbWFJbnB1dCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIuZ2FtbWFPdXRwdXQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLnNoYWRvd01hcC5lbmFibGVkID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci52ci5lbmFibGVkID0gdHJ1ZTtcblx0Ki9cblxuXHR0aGlzLmFzcGVjdCA9IHdpbmRvdy5pbm5lcldpZHRoL3dpbmRvdy5pbm5lckhlaWdodDtcblxuXHR0aGlzLnRpbWVTY2FsZSA9IDE7XG5cdHRoaXMuZWxhcHNlZFRpbWUgPSAwO1xuXG5cdGlmKHRoaXMuc2hvdWxkQ3JlYXRlQ2FudmFzKXtcblx0XHR0aGlzLmNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0dGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQoIHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCApO1xuXHR9XG5cblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCB0aGlzLm9uTW91c2VEb3duLmJpbmQodGhpcyksIGZhbHNlICk7XG5cdHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2V1cCcsIHRoaXMub25Nb3VzZVVwLmJpbmQodGhpcyksIGZhbHNlICk7XG5cdHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAndG91Y2hzdGFydCcsIHRoaXMub25Nb3VzZURvd24uYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaGVuZCcsIHRoaXMub25Nb3VzZVVwLmJpbmQodGhpcyksIGZhbHNlICk7XG5cblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCB0aGlzLm9uV2luZG93UmVzaXplLmJpbmQodGhpcyksIGZhbHNlICk7XG5cblx0Lypcblx0Ly9yZW5kZXJlci52ci5lbmFibGVkID0gdHJ1ZTsgXG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cG9pbnRlcnJlc3RyaWN0ZWQnLCBvblBvaW50ZXJSZXN0cmljdGVkLCBmYWxzZSApO1xuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3ZyZGlzcGxheXBvaW50ZXJ1bnJlc3RyaWN0ZWQnLCBvblBvaW50ZXJVbnJlc3RyaWN0ZWQsIGZhbHNlICk7XG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIFdFQlZSLmNyZWF0ZUJ1dHRvbiggcmVuZGVyZXIgKSApO1xuXHQqL1xuXG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgdGhpcy5vblBhZ2VMb2FkLmJpbmQodGhpcyksIGZhbHNlKTtcblxuXHR0aGlzLmNsb2NrID0gbmV3IFRIUkVFLkNsb2NrKCk7XG5cblx0dGhpcy5JU19SRUNPUkRJTkcgPSBmYWxzZTsgLy8gcXVlcnlhYmxlIGlmIG9uZSB3YW50cyB0byBkbyB0aGluZ3MgbGlrZSBiZWVmIHVwIHBhcnRpY2xlIGNvdW50cyBmb3IgcmVuZGVyXG59XG5cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUGFnZUxvYWQgPSBmdW5jdGlvbigpIHtcblx0Y29uc29sZS5sb2coXCJUaHJlZWFzeV9TZXR1cCBsb2FkZWQhXCIpO1xuXHRpZih0aGlzLnNob3VsZENyZWF0ZUNhbnZhcyl7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggdGhpcy5jb250YWluZXIgKTtcblx0fVxuXG5cdGlmKHRoaXMuYXV0b3N0YXJ0KXtcblx0XHR0aGlzLnN0YXJ0KCk7XG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKXtcblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cdHRoaXMuY2xvY2suc3RhcnQoKTtcblx0dGhpcy5yZW5kZXIodGhpcy5wcmV2X3RpbWVzdGVwKTtcbn1cblxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Nb3VzZURvd24gPSBmdW5jdGlvbigpIHtcblx0dGhpcy5pc01vdXNlRG93biA9IHRydWU7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbk1vdXNlVXA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmlzTW91c2VEb3duID0gZmFsc2U7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vblBvaW50ZXJSZXN0cmljdGVkPSBmdW5jdGlvbigpIHtcblx0dmFyIHBvaW50ZXJMb2NrRWxlbWVudCA9IHJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cdGlmICggcG9pbnRlckxvY2tFbGVtZW50ICYmIHR5cGVvZihwb2ludGVyTG9ja0VsZW1lbnQucmVxdWVzdFBvaW50ZXJMb2NrKSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRwb2ludGVyTG9ja0VsZW1lbnQucmVxdWVzdFBvaW50ZXJMb2NrKCk7XG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUG9pbnRlclVucmVzdHJpY3RlZD0gZnVuY3Rpb24oKSB7XG5cdHZhciBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ID0gZG9jdW1lbnQucG9pbnRlckxvY2tFbGVtZW50O1xuXHR2YXIgZXhwZWN0ZWRQb2ludGVyTG9ja0VsZW1lbnQgPSByZW5kZXJlci5kb21FbGVtZW50O1xuXHRpZiAoIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgJiYgY3VycmVudFBvaW50ZXJMb2NrRWxlbWVudCA9PT0gZXhwZWN0ZWRQb2ludGVyTG9ja0VsZW1lbnQgJiYgdHlwZW9mKGRvY3VtZW50LmV4aXRQb2ludGVyTG9jaykgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0ZG9jdW1lbnQuZXhpdFBvaW50ZXJMb2NrKCk7XG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLmV2ZW5pZnkgPSBmdW5jdGlvbih4KXtcblx0aWYoeCAlIDIgPT0gMSl7XG5cdFx0cmV0dXJuIHgrMVxuXHR9O1xuXHRyZXR1cm4geDtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uV2luZG93UmVzaXplPSBmdW5jdGlvbigpIHtcblx0dGhpcy5jYW1lcmEuYXNwZWN0ID0gd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cdHRoaXMuYXNwZWN0ID0gdGhpcy5jYW1lcmEuYXNwZWN0O1xuXHR0aGlzLmNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG5cdHRoaXMucmVuZGVyZXIuc2V0U2l6ZSggdGhpcy5ldmVuaWZ5KHdpbmRvdy5pbm5lcldpZHRoKSx0aGlzLmV2ZW5pZnkod2luZG93LmlubmVySGVpZ2h0KSApO1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUubGlzdGVuZXJzID0ge1widXBkYXRlXCI6IFtdLFwicmVuZGVyXCI6W119OyAvL3VwZGF0ZSBldmVudCBsaXN0ZW5lcnNcblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKHRpbWVzdGVwKXtcblx0dmFyIGRlbHRhID0gdGhpcy5jbG9jay5nZXREZWx0YSgpKnRoaXMudGltZVNjYWxlO1xuXHR0aGlzLmVsYXBzZWRUaW1lICs9IGRlbHRhO1xuXHQvL2dldCB0aW1lc3RlcFxuXHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmxlbmd0aDtpKyspe1xuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YX0pO1xuXHR9XG5cblx0dGhpcy5yZW5kZXJlci5yZW5kZXIoIHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhICk7XG5cblx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXVtpXSgpO1xuXHR9XG5cblx0dGhpcy5wcmV2X3RpbWVzdGVwID0gdGltZXN0ZXA7XG5cdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50X25hbWUsIGZ1bmMpe1xuXHQvL1JlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lci5cblx0Ly9lYWNoIGxpc3RlbmVyIHdpbGwgYmUgY2FsbGVkIHdpdGggYW4gb2JqZWN0IGNvbnNpc3Rpbmcgb2Y6XG5cdC8vXHR7dDogPGN1cnJlbnQgdGltZSBpbiBzPiwgXCJkZWx0YVwiOiA8ZGVsdGEsIGluIG1zPn1cblx0Ly8gYW4gdXBkYXRlIGV2ZW50IGZpcmVzIGJlZm9yZSBhIHJlbmRlci4gYSByZW5kZXIgZXZlbnQgZmlyZXMgcG9zdC1yZW5kZXIuXG5cdGlmKGV2ZW50X25hbWUgPT0gXCJ1cGRhdGVcIil7IFxuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLnB1c2goZnVuYyk7XG5cdH1lbHNlIGlmKGV2ZW50X25hbWUgPT0gXCJyZW5kZXJcIil7IFxuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLnB1c2goZnVuYyk7XG5cdH1lbHNle1xuXHRcdGNvbnNvbGUuZXJyb3IoXCJJbnZhbGlkIGV2ZW50IG5hbWUhXCIpXG5cdH1cbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbihldmVudF9uYW1lLCBmdW5jKXtcblx0Ly9VbnJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciwgdW5kb2luZyBhbiBUaHJlZWFzeV9zZXR1cC5vbigpIGV2ZW50IGxpc3RlbmVyLlxuXHQvL3RoZSBuYW1pbmcgc2NoZW1lIG1pZ2h0IG5vdCBiZSB0aGUgYmVzdCBoZXJlLlxuXHRpZihldmVudF9uYW1lID09IFwidXBkYXRlXCIpeyBcblx0XHRsZXQgaW5kZXggPSB0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5pbmRleE9mKGZ1bmMpO1xuXHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLnNwbGljZShpbmRleCwxKTtcblx0fSBlbHNlIGlmKGV2ZW50X25hbWUgPT0gXCJyZW5kZXJcIil7IFxuXHRcdGxldCBpbmRleCA9IHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLmluZGV4T2YoZnVuYyk7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0uc3BsaWNlKGluZGV4LDEpO1xuXHR9ZWxzZXtcblx0XHRjb25zb2xlLmVycm9yKFwiTm9uZXhpc3RlbnQgZXZlbnQgbmFtZSFcIilcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub2ZmID0gVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lcjsgLy9hbGlhcyB0byBtYXRjaCBUaHJlZWFzeUVudmlyb25tZW50Lm9uXG5cbmNsYXNzIFRocmVlYXN5UmVjb3JkZXIgZXh0ZW5kcyBUaHJlZWFzeUVudmlyb25tZW50e1xuXHQvL2Jhc2VkIG9uIGh0dHA6Ly93d3cudHlzb25jYWRlbmhlYWQuY29tL2Jsb2cvZXhwb3J0aW5nLWNhbnZhcy1hbmltYXRpb24tdG8tbW92LyB0byByZWNvcmQgYW4gYW5pbWF0aW9uXG5cdC8vd2hlbiBkb25lLCAgICAgZmZtcGVnIC1yIDYwIC1mcmFtZXJhdGUgNjAgLWkgLi8lMDdkLnBuZyAtdmNvZGVjIGxpYngyNjQgLXBpeF9mbXQgeXV2NDIwcCAtY3JmOnYgMCB2aWRlby5tcDRcbiAgICAvLyB0byBwZXJmb3JtIG1vdGlvbiBibHVyIG9uIGFuIG92ZXJzYW1wbGVkIHZpZGVvLCBmZm1wZWcgLWkgdmlkZW8ubXA0IC12ZiB0YmxlbmQ9YWxsX21vZGU9YXZlcmFnZSxmcmFtZXN0ZXA9MiB2aWRlbzIubXA0XG5cdC8vdGhlbiwgYWRkIHRoZSB5dXY0MjBwIHBpeGVscyAod2hpY2ggZm9yIHNvbWUgcmVhc29uIGlzbid0IGRvbmUgYnkgdGhlIHByZXYgY29tbWFuZCkgYnk6XG5cdC8vIGZmbXBlZyAtaSB2aWRlby5tcDQgLXZjb2RlYyBsaWJ4MjY0IC1waXhfZm10IHl1djQyMHAgLXN0cmljdCAtMiAtYWNvZGVjIGFhYyBmaW5pc2hlZF92aWRlby5tcDRcblx0Ly9jaGVjayB3aXRoIGZmbXBlZyAtaSBmaW5pc2hlZF92aWRlby5tcDRcblxuXHRjb25zdHJ1Y3RvcihhdXRvc3RhcnQsIGZwcz0zMCwgbGVuZ3RoID0gNSwgY2FudmFzRWxlbWVudCA9IG51bGwpe1xuXHRcdC8qIGZwcyBpcyBldmlkZW50LCBhdXRvc3RhcnQgaXMgYSBib29sZWFuIChieSBkZWZhdWx0LCB0cnVlKSwgYW5kIGxlbmd0aCBpcyBpbiBzLiovXG5cdFx0c3VwZXIoYXV0b3N0YXJ0LCBjYW52YXNFbGVtZW50KTtcblx0XHR0aGlzLmZwcyA9IGZwcztcblx0XHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblx0XHR0aGlzLmZyYW1lQ291bnQgPSBmcHMgKiBsZW5ndGg7XG5cdFx0dGhpcy5mcmFtZXNfcmVuZGVyZWQgPSAwO1xuXG5cdFx0dGhpcy5jYXB0dXJlciA9IG5ldyBDQ2FwdHVyZSgge1xuXHRcdFx0ZnJhbWVyYXRlOiBmcHMsXG5cdFx0XHRmb3JtYXQ6ICdwbmcnLFxuXHRcdFx0bmFtZTogZG9jdW1lbnQudGl0bGUsXG5cdFx0XHQvL3ZlcmJvc2U6IHRydWUsXG5cdFx0fSApO1xuXG5cdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMuSVNfUkVDT1JESU5HID0gdHJ1ZTtcblx0fVxuXHRzdGFydCgpe1xuXHRcdC8vbWFrZSBhIHJlY29yZGluZyBzaWduXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS53aWR0aD1cIjIwcHhcIlxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuaGVpZ2h0PVwiMjBweFwiXG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS50b3AgPSAnMjBweCc7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5sZWZ0ID0gJzIwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JlZCc7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLnJlY29yZGluZ19pY29uKTtcblxuXHRcdHRoaXMuZnJhbWVDb3VudGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUudG9wID0gJzIwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmxlZnQgPSAnNTBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuY29sb3IgPSAnYmxhY2snO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSgyNTUsMjU1LDI1NSwwLjEpJztcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuZnJhbWVDb3VudGVyKTtcblxuXHRcdHRoaXMuY2FwdHVyZXIuc3RhcnQoKTtcblx0XHR0aGlzLnJlbmRlcmluZyA9IHRydWU7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXHRyZW5kZXIodGltZXN0ZXApe1xuXHRcdHZhciBkZWx0YSA9IDEvdGhpcy5mcHMqdGhpcy50aW1lU2NhbGU7IC8vaWdub3JpbmcgdGhlIHRydWUgdGltZSwgY2FsY3VsYXRlIHRoZSBkZWx0YVxuXG5cdFx0Ly9nZXQgdGltZXN0ZXBcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl1baV0oe1widFwiOnRoaXMuZWxhcHNlZFRpbWUsXCJkZWx0YVwiOmRlbHRhfSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJlci5yZW5kZXIoIHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhICk7XG5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl1baV0oKTtcblx0XHR9XG5cblxuXHRcdHRoaXMucmVjb3JkX2ZyYW1lKCk7XG5cdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnMTBweCc7XG5cblx0XHR0aGlzLmVsYXBzZWRUaW1lICs9IGRlbHRhO1xuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5yZW5kZXIuYmluZCh0aGlzKSk7XG5cdH1cblx0cmVjb3JkX2ZyYW1lKCl7XG5cdC8vXHRsZXQgY3VycmVudF9mcmFtZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2NhbnZhcycpLnRvRGF0YVVSTCgpO1xuXG5cdFx0dGhpcy5jYXB0dXJlci5jYXB0dXJlKCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYW52YXMnKSApO1xuXG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuaW5uZXJIVE1MID0gdGhpcy5mcmFtZXNfcmVuZGVyZWQgKyBcIiAvIFwiICsgdGhpcy5mcmFtZUNvdW50OyAvL3VwZGF0ZSB0aW1lclxuXG5cdFx0dGhpcy5mcmFtZXNfcmVuZGVyZWQrKztcblxuXG5cdFx0aWYodGhpcy5mcmFtZXNfcmVuZGVyZWQ+dGhpcy5mcmFtZUNvdW50KXtcblx0XHRcdHRoaXMucmVuZGVyID0gbnVsbDsgLy9oYWNreSB3YXkgb2Ygc3RvcHBpbmcgdGhlIHJlbmRlcmluZ1xuXHRcdFx0dGhpcy5yZWNvcmRpbmdfaWNvbi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0XHQvL3RoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuXHRcdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblx0XHRcdHRoaXMuY2FwdHVyZXIuc3RvcCgpO1xuXHRcdFx0Ly8gZGVmYXVsdCBzYXZlLCB3aWxsIGRvd25sb2FkIGF1dG9tYXRpY2FsbHkgYSBmaWxlIGNhbGxlZCB7bmFtZX0uZXh0ZW5zaW9uICh3ZWJtL2dpZi90YXIpXG5cdFx0XHR0aGlzLmNhcHR1cmVyLnNhdmUoKTtcblx0XHR9XG5cdH1cblx0b25XaW5kb3dSZXNpemUoKSB7XG5cdFx0Ly9zdG9wIHJlY29yZGluZyBpZiB3aW5kb3cgc2l6ZSBjaGFuZ2VzXG5cdFx0aWYodGhpcy5yZW5kZXJpbmcgJiYgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQgIT0gdGhpcy5hc3BlY3Qpe1xuXHRcdFx0dGhpcy5jYXB0dXJlci5zdG9wKCk7XG5cdFx0XHR0aGlzLnJlbmRlciA9IG51bGw7IC8vaGFja3kgd2F5IG9mIHN0b3BwaW5nIHRoZSByZW5kZXJpbmdcblx0XHRcdGFsZXJ0KFwiQWJvcnRpbmcgcmVjb3JkOiBXaW5kb3ctc2l6ZSBjaGFuZ2UgZGV0ZWN0ZWQhXCIpO1xuXHRcdFx0dGhpcy5yZW5kZXJpbmcgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3VwZXIub25XaW5kb3dSZXNpemUoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBzZXR1cFRocmVlKGF1dG9zdGFydCwgZnBzPTMwLCBsZW5ndGggPSA1LCBjYW52YXNFbGVtZW50ID0gbnVsbCl7XG5cdC8qIEFsbCB0aGUgZXhpc3RpbmcgY29kZSBJIGhhdmUgdXNlcyBcIm5ldyBUaHJlZWFzeVNldHVwXCIgb3IgXCJuZXcgVGhyZWVhc3lSZWNvcmRlclwiIGFuZCBJIHdhbnQgdG8gc3dpdGNoXG4gICBiZXR3ZWVuIHRoZW0gZHluYW1pY2FsbHkgc28gdGhhdCB5b3UgY2FuIHJlY29yZCBieSBhcHBlbmRpbmcgXCI/cmVjb3JkPXRydWVcIiB0byBhbiB1cmwuICovXG5cdHZhciByZWNvcmRlciA9IG51bGw7XG5cdHZhciBpc19yZWNvcmRpbmcgPSBmYWxzZTtcblxuXHQvL2V4dHJhY3QgcmVjb3JkIHBhcmFtZXRlciBmcm9tIHVybFxuXHR2YXIgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhkb2N1bWVudC5sb2NhdGlvbi5zZWFyY2gpO1xuXHRsZXQgcmVjb3JkU3RyaW5nID0gcGFyYW1zLmdldChcInJlY29yZFwiKTtcblxuXHRpZihyZWNvcmRTdHJpbmcpaXNfcmVjb3JkaW5nID0gcGFyYW1zLmdldChcInJlY29yZFwiKS50b0xvd2VyQ2FzZSgpID09IFwidHJ1ZVwiIHx8IHBhcmFtcy5nZXQoXCJyZWNvcmRcIikudG9Mb3dlckNhc2UoKSA9PSBcIjFcIjtcblxuXHRpZihpc19yZWNvcmRpbmcpe1xuXHRcdHJldHVybiBuZXcgVGhyZWVhc3lSZWNvcmRlcihhdXRvc3RhcnQsIGZwcywgbGVuZ3RoLCBjYW52YXNFbGVtZW50KTtcblx0XG5cdH1lbHNle1xuXHRcdHJldHVybiBuZXcgVGhyZWVhc3lFbnZpcm9ubWVudChhdXRvc3RhcnQsIGNhbnZhc0VsZW1lbnQpO1xuXHR9XG59XG5cbmV4cG9ydCB7c2V0dXBUaHJlZSwgVGhyZWVhc3lFbnZpcm9ubWVudCwgVGhyZWVhc3lSZWNvcmRlcn1cbiIsImFzeW5jIGZ1bmN0aW9uIGRlbGF5KHdhaXRUaW1lKXtcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHR9KTtcblxufVxuXG5leHBvcnQge2RlbGF5fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5cbmNsYXNzIExpbmVPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29ya1xuXHRcdFx0b3B0aW9uczpcblx0XHRcdHtcblx0XHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0XHRvcGFjaXR5OiBudW1iZXJcblx0XHRcdFx0Y29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcblx0XHRcdH1cblx0XHQqL1xuXG5cdFx0dGhpcy5fd2lkdGggPSBvcHRpb25zLndpZHRoICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLndpZHRoIDogNTtcblx0XHR0aGlzLl9vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm9wYWNpdHkgOiAxO1xuXHRcdHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5jb2xvciA6IDB4NTVhYTU1O1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSAwOyAvL3Nob3VsZCBhbHdheXMgYmUgZXF1YWwgdG8gdGhpcy5wb2ludHMubGVuZ3RoXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBob3cgbWFueSB0aW1lcyB0byBiZSBjYWxsZWQgaW4gZWFjaCBkaXJlY3Rpb25cblx0XHR0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gMzsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT9cblxuXHRcdHRoaXMucGFyZW50ID0gbnVsbDtcblxuXHRcdHRoaXMuaW5pdCgpO1xuXHR9XG5cdGluaXQoKXtcblx0XHR0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXHRcdHRoaXMuX3ZlcnRpY2VzO1xuXHRcdHRoaXMubWFrZUdlb21ldHJ5KCk7XG5cblx0XHR0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtjb2xvcjogdGhpcy5fY29sb3IsIGxpbmV3aWR0aDogdGhpcy5fd2lkdGgsb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSk7XG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLkxpbmVTZWdtZW50cyh0aGlzLl9nZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vIHNldHRlciBzZXRzIHRyYW5zcGFyZW50IGZsYWcgaWYgbmVjZXNzYXJ5XG5cblx0XHR0aHJlZS5zY2VuZS5hZGQodGhpcy5tZXNoKTtcblx0fVxuXHRtYWtlR2VvbWV0cnkoKXtcblx0XHQvLyBmb2xsb3cgaHR0cDovL2Jsb2cuY2pnYW1tb24uY29tL3RocmVlanMtZ2VvbWV0cnlcblx0XHQvLyBvciBtYXRoYm94J3MgbGluZUdlb21ldHJ5XG5cblx0XHQvKlxuXHRcdFRoaXMgY29kZSBzZWVtcyB0byBiZSBuZWNlc3NhcnkgdG8gcmVuZGVyIGxpbmVzIGFzIGEgdHJpYW5nbGUgc3RycC5cblx0XHRJIGNhbid0IHNlZW0gdG8gZ2V0IGl0IHRvIHdvcmsgcHJvcGVybHkuXG5cblx0XHRsZXQgbnVtVmVydGljZXMgPSAzO1xuXHRcdHZhciBpbmRpY2VzID0gW107XG5cblx0XHQvL2luZGljZXNcblx0XHRsZXQgYmFzZSA9IDA7XG5cdFx0Zm9yKHZhciBrPTA7azxudW1WZXJ0aWNlcy0xO2srPTEpe1xuICAgICAgICBcdGluZGljZXMucHVzaCggYmFzZSwgYmFzZSsxLCBiYXNlKzIpO1xuXHRcdFx0aW5kaWNlcy5wdXNoKCBiYXNlKzIsIGJhc2UrMSwgYmFzZSszKTtcblx0XHRcdGJhc2UgKz0gMjtcblx0XHR9XG5cdFx0dGhpcy5fZ2VvbWV0cnkuc2V0SW5kZXgoIGluZGljZXMgKTsqL1xuXG5cdFx0bGV0IE1BWF9QT0lOVFMgPSAxMDAwMDtcblxuXHRcdHRoaXMuX3ZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheShNQVhfUE9JTlRTICogMiAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMpO1xuXG5cdFx0Ly8gYnVpbGQgZ2VvbWV0cnlcblxuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcblx0XHQvL3RoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ25vcm1hbCcsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCBub3JtYWxzLCAzICkgKTtcblx0XHQvL3RoaXMuZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAndXYnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdXZzLCAyICkgKTtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy91c2VkIGR1cmluZyB1cGRhdGVzIGFzIGEgcG9pbnRlciB0byB0aGUgYnVmZmVyXG5cblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cblx0fVxuXHRfb25BZGQoKXtcblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgQXJlYVxuXHRcdGxldCByb290ID0gdGhpcztcblx0XHR3aGlsZShyb290LnBhcmVudCAhPT0gbnVsbCl7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG5cdFx0fVxuXHRcblx0XHQvL3RvZG86IGltcGxlbWVudCBzb21ldGhpbmcgbGlrZSBhc3NlcnQgcm9vdCB0eXBlb2YgUm9vdE5vZGVcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IHJvb3QuaXRlbURpbWVuc2lvbnM7XG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG5cdFx0dGhpcy5fb25BZGQoKTsgLy9zZXR1cCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiBhbmQgdGhpcy5pdGVtRGltZW5zaW9ucy4gdXNlZCBoZXJlIGFnYWluIGJlY2F1c2UgY2xvbmluZyBtZWFucyB0aGUgb25BZGQoKSBtaWdodCBiZSBjYWxsZWQgYmVmb3JlIHRoaXMgaXMgY29ubmVjdGVkIHRvIGEgdHlwZSBvZiBkb21haW5cblxuXHRcdC8vIHBlcmhhcHMgaW5zdGVhZCBvZiBnZW5lcmF0aW5nIGEgd2hvbGUgbmV3IGFycmF5LCB0aGlzIGNhbiByZXVzZSB0aGUgb2xkIG9uZT9cblx0XHRsZXQgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIDIpO1xuXG5cdFx0bGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcblx0XHR0aGlzLl92ZXJ0aWNlcyA9IHZlcnRpY2VzO1xuXHRcdHBvc2l0aW9uQXR0cmlidXRlLnNldEFycmF5KHRoaXMuX3ZlcnRpY2VzKTtcblxuXHRcdHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXG5cdFx0Ly9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuXG5cdFx0Ly9hc3NlcnQgaSA8IHZlcnRpY2VzLmNvdW50XG5cblx0XHRsZXQgaW5kZXggPSB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuXG5cdFx0aWYoeCAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4XSA9IHg7XG5cdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdID0geTtcblx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMl0gPSB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblxuXHRcdC8qIHdlJ3JlIGRyYXdpbmcgbGlrZSB0aGlzOlxuXHRcdCotLS0tKi0tLS0qXG5cbiAgICAgICAgKi0tLS0qLS0tLSpcblx0XG5cdFx0YnV0IHdlIGRvbid0IHdhbnQgdG8gaW5zZXJ0IGEgZGlhZ29uYWwgbGluZSBhbnl3aGVyZS4gVGhpcyBoYW5kbGVzIHRoYXQ6ICAqL1xuXG5cdFx0bGV0IGZpcnN0Q29vcmRpbmF0ZSA9IGkgJSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdO1xuXG5cdFx0aWYoIShmaXJzdENvb3JkaW5hdGUgPT0gMCB8fCBmaXJzdENvb3JkaW5hdGUgPT0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xKSl7XG5cdFx0XHRpZih4ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9uc10gPSB4O1xuXHRcdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMrMV0gPSB5O1xuXHRcdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMrMl0gPSB6O1xuXHRcdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblx0XHR9XG5cblx0XHQvL3ZlcnRpY2VzIHNob3VsZCByZWFsbHkgYmUgYW4gdW5pZm9ybSwgdGhvdWdoLlxuXHR9XG5cdG9uQWZ0ZXJBY3RpdmF0aW9uKCl7XG5cdFx0bGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3Jlc2V0IGFmdGVyIGVhY2ggdXBkYXRlXG5cdH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseVxuXHRcdHRoaXMubWF0ZXJpYWwuY29sb3IgPSBuZXcgVEhSRUUuQ29sb3IoY29sb3IpO1xuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdH1cblx0Z2V0IGNvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbG9yO1xuXHR9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdHRoaXMubWF0ZXJpYWwub3BhY2l0eSA9IG9wYWNpdHk7XG5cdFx0dGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuXHRcdHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuXHR9XG5cdGdldCBvcGFjaXR5KCl7XG5cdFx0cmV0dXJuIHRoaXMuX29wYWNpdHk7XG5cdH1cblx0c2V0IHdpZHRoKHdpZHRoKXtcblx0XHR0aGlzLl93aWR0aCA9IHdpZHRoO1xuXHRcdHRoaXMubWF0ZXJpYWwubGluZXdpZHRoID0gd2lkdGg7XG5cdH1cblx0Z2V0IHdpZHRoKCl7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZHRoO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBMaW5lT3V0cHV0KHt3aWR0aDogdGhpcy53aWR0aCwgY29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eX0pO1xuXHR9XG59XG5cbmV4cG9ydCB7TGluZU91dHB1dH07XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBQb2ludHtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0LypvcHRpb25zOiBjb2xvcjogPFRIUkVFLkNvbG9yIG9yIGhleCBjb2RlXG5cdFx0XHR4LHk6IG51bWJlcnNcblx0XHRcdHdpZHRoOiBudW1iZXJcblx0XHQqL1xuXG5cdFx0bGV0IHdpZHRoID0gb3B0aW9ucy53aWR0aCA9PT0gdW5kZWZpbmVkID8gMSA6IG9wdGlvbnMud2lkdGhcblx0XHRsZXQgY29sb3IgPSBvcHRpb25zLmNvbG9yID09PSB1bmRlZmluZWQgPyAweDc3Nzc3NyA6IG9wdGlvbnMuY29sb3I7XG5cblx0XHR0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTWVzaCh0aGlzLnNoYXJlZENpcmNsZUdlb21ldHJ5LHRoaXMuZ2V0RnJvbU1hdGVyaWFsQ2FjaGUoY29sb3IpKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSA9PT0gdW5kZWZpbmVkID8gMSA6IG9wdGlvbnMub3BhY2l0eTsgLy90cmlnZ2VyIHNldHRlclxuXG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnNldCh0aGlzLngsdGhpcy55LHRoaXMueik7XG5cdFx0dGhpcy5tZXNoLnNjYWxlLnNldFNjYWxhcih0aGlzLndpZHRoLzIpO1xuXHRcdHRocmVlLnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXG5cdFx0dGhpcy54ID0gb3B0aW9ucy54IHx8IDA7XG5cdFx0dGhpcy55ID0gb3B0aW9ucy55IHx8IDA7XG5cdFx0dGhpcy56ID0gb3B0aW9ucy56IHx8IDA7XG5cdH1cblx0c2V0IHgoaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnggPSBpO1xuXHR9XG5cdHNldCB5KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi55ID0gaTtcblx0fVxuXHRzZXQgeihpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueiA9IGk7XG5cdH1cblx0Z2V0IHgoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLng7XG5cdH1cblx0Z2V0IHkoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLnk7XG5cdH1cblx0Z2V0IHooKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLno7XG5cdH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0bGV0IG1hdCA9IHRoaXMubWVzaC5tYXRlcmlhbDtcblx0XHRtYXQub3BhY2l0eSA9IG9wYWNpdHk7XG5cdFx0bWF0LnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRnZXRGcm9tTWF0ZXJpYWxDYWNoZShjb2xvcil7XG5cdFx0aWYodGhpcy5fbWF0ZXJpYWxzW2NvbG9yXSA9PT0gdW5kZWZpbmVkKXtcblx0XHRcdHRoaXMuX21hdGVyaWFsc1tjb2xvcl0gPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe2NvbG9yOiBjb2xvcn0pXG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tYXRlcmlhbHNbY29sb3JdXG5cdH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHR0aGlzLm1lc2gubWF0ZXJpYWwgPSB0aGlzLmdldEZyb21NYXRlcmlhbENhY2hlKGNvbG9yKTtcblx0fVxufVxuUG9pbnQucHJvdG90eXBlLnNoYXJlZENpcmNsZUdlb21ldHJ5ID0gbmV3IFRIUkVFLlNwaGVyZUdlb21ldHJ5KDEvMiwgOCwgNik7IC8vcmFkaXVzIDEvMiBzbyB0aGF0IHNjYWxpbmcgYnkgbiBtZWFucyB3aWR0aD1uXG5cblBvaW50LnByb3RvdHlwZS5fbWF0ZXJpYWxzID0ge307XG4iLCJpbXBvcnQgUG9pbnQgZnJvbSAnLi9Qb2ludC5qcyc7XG5pbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuXG5jbGFzcyBQb2ludE91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKlxuXHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0Y29sb3I6IGhleCBjb2xvciwgYXMgaW4gMHhycmdnYmIuIFRlY2huaWNhbGx5LCB0aGlzIGlzIGEgSlMgaW50ZWdlci5cblx0XHRcdG9wYWNpdHk6IDAtMS4gT3B0aW9uYWwuXG5cdFx0Ki9cblxuXHRcdHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDE7XG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmNvbG9yIDogMHg1NWFhNTU7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcblxuXG5cdFx0dGhpcy5wb2ludHMgPSBbXTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuXHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblxuXHRcdHRoaXMucGFyZW50ID0gbnVsbDtcblx0fVxuXHRfb25BZGQoKXsgLy9zaG91bGQgYmUgY2FsbGVkIHdoZW4gdGhpcyBpcyAuYWRkKCllZCB0byBzb21ldGhpbmdcblxuXHRcdGxldCBwYXJlbnRDb3VudCA9IDA7XG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIEFyZWFcblx0XHRsZXQgcm9vdCA9IHRoaXM7XG5cdFx0d2hpbGUocm9vdC5wYXJlbnQgIT09IG51bGwgJiYgcGFyZW50Q291bnQgPCA1MCl7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG5cdFx0XHRwYXJlbnRDb3VudCsrO1xuXHRcdH1cblx0XHRpZihwYXJlbnRDb3VudCA+PSA1MCl0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCByb290IVwiKTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cblx0XHRpZih0aGlzLnBvaW50cy5sZW5ndGggPCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbil7XG5cdFx0XHRmb3IodmFyIGk9dGhpcy5wb2ludHMubGVuZ3RoO2k8dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb247aSsrKXtcblx0XHRcdFx0dGhpcy5wb2ludHMucHVzaChuZXcgUG9pbnQoe3dpZHRoOiAxLGNvbG9yOnRoaXMuX2NvbG9yLCBvcGFjaXR5OnRoaXMuX29wYWNpdHl9KSk7XG5cdFx0XHRcdHRoaXMucG9pbnRzW2ldLm1lc2guc2NhbGUuc2V0U2NhbGFyKHRoaXMuX3dpZHRoKTsgLy9zZXQgd2lkdGggYnkgc2NhbGluZyBwb2ludFxuXHRcdFx0XHR0aGlzLnBvaW50c1tpXS5tZXNoLnZpc2libGUgPSBmYWxzZTsgLy9pbnN0YW50aWF0ZSB0aGUgcG9pbnRcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pdGhpcy5fb25BZGQoKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblx0XHR2YXIgcG9pbnQgPSB0aGlzLmdldFBvaW50KGkpO1xuXHRcdGlmKHggIT09IHVuZGVmaW5lZClwb2ludC54ID0geDtcblx0XHRpZih5ICE9PSB1bmRlZmluZWQpcG9pbnQueSA9IHk7XG5cdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXBvaW50LnogPSB6O1xuXHRcdHBvaW50Lm1lc2gudmlzaWJsZSA9IHRydWU7XG5cdH1cblx0Z2V0UG9pbnQoaSl7XG5cdFx0cmV0dXJuIHRoaXMucG9pbnRzW2ldO1xuXHR9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdC8vdGVjaG5pY2FsbHkgdGhpcyB3aWxsIHNldCBhbGwgcG9pbnRzIG9mIHRoZSBzYW1lIGNvbG9yLCBhbmQgaXQnbGwgYmUgd2lwZWQgd2l0aCBhIGNvbG9yIGNoYW5nZS4gQnV0IEknbGwgZGVhbCB3aXRoIHRoYXQgc29tZXRpbWUgbGF0ZXIuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbjtpKyspe1xuXHRcdFx0bGV0IG1hdCA9IHRoaXMuZ2V0UG9pbnQoaSkubWVzaC5tYXRlcmlhbDtcblx0XHRcdG1hdC5vcGFjaXR5ID0gb3BhY2l0eTsgLy9pbnN0YW50aWF0ZSB0aGUgcG9pbnRcblx0XHRcdG1hdC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuXHRcdH1cblx0XHR0aGlzLl9vcGFjaXR5ID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdHNldCBjb2xvcihjb2xvcil7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnBvaW50cy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuZ2V0UG9pbnQoaSkuY29sb3IgPSBjb2xvcjtcblx0XHR9XG5cdFx0dGhpcy5fY29sb3IgPSBjb2xvcjtcblx0fVxuXHRnZXQgY29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3I7XG5cdH1cblx0c2V0IHdpZHRoKHdpZHRoKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMucG9pbnRzLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5nZXRQb2ludChpKS5tZXNoLnNjYWxlLnNldFNjYWxhcih3aWR0aCk7XG5cdFx0fVxuXHRcdHRoaXMuX3dpZHRoID0gd2lkdGg7XG5cdH1cblx0Z2V0IHdpZHRoKCl7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZHRoO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBQb2ludE91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdFBvaW50KCl7XG5cdHZhciB4ID0gbmV3IEVYUC5BcmVhKHtib3VuZHM6IFtbLTEwLDEwXV19KTtcblx0dmFyIHkgPSBuZXcgRVhQLlRyYW5zZm9ybWF0aW9uKHsnZXhwcic6ICh4KSA9PiB4Knh9KTtcblx0dmFyIHkgPSBuZXcgRVhQLlBvaW50T3V0cHV0KCk7XG5cdHguYWRkKHkpO1xuXHR5LmFkZCh6KTtcblx0eC5hY3RpdmF0ZSgpO1xufVxuXG5leHBvcnQge1BvaW50T3V0cHV0fVxuIiwiaW1wb3J0IHsgTGluZU91dHB1dCB9IGZyb20gJy4vTGluZU91dHB1dC5qcyc7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gJy4uL3V0aWxzLmpzJztcblxuZXhwb3J0IGNsYXNzIFZlY3Rvck91dHB1dCBleHRlbmRzIExpbmVPdXRwdXR7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0LyppbnB1dDogVHJhbnNmb3JtYXRpb25cblx0XHRcdHdpZHRoOiBudW1iZXJcblx0XHQqL1xuXHRcdHN1cGVyKG9wdGlvbnMpO1xuXG5cdH1cblx0aW5pdCgpe1xuXHRcdHRoaXMuX2dlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCk7XG5cdFx0dGhpcy5fdmVydGljZXM7XG5cdFx0dGhpcy5hcnJvd2hlYWRzID0gW107XG5cblxuXHRcdHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe2NvbG9yOiB0aGlzLl9jb2xvciwgbGluZXdpZHRoOiB0aGlzLl93aWR0aCwgb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSk7XG5cdFx0dGhpcy5saW5lTWVzaCA9IG5ldyBUSFJFRS5MaW5lU2VnbWVudHModGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cblx0XHR0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvLyBzZXR0ZXIgc2V0cyB0cmFuc3BhcmVudCBmbGFnIGlmIG5lY2Vzc2FyeVxuXG5cblx0XHRjb25zdCBjaXJjbGVSZXNvbHV0aW9uID0gMTI7XG5cdFx0Y29uc3QgYXJyb3doZWFkU2l6ZSA9IDAuMztcblx0XHRjb25zdCBFUFNJTE9OID0gMC4wMDAwMTtcblx0XHR0aGlzLkVQU0lMT04gPSBFUFNJTE9OO1xuXG5cdFx0dGhpcy5jb25lR2VvbWV0cnkgPSBuZXcgVEhSRUUuQ3lsaW5kZXJCdWZmZXJHZW9tZXRyeSggMCwgYXJyb3doZWFkU2l6ZSwgYXJyb3doZWFkU2l6ZSoxLjcsIGNpcmNsZVJlc29sdXRpb24sIDEgKTtcblx0XHRsZXQgYXJyb3doZWFkT3ZlcnNob290RmFjdG9yID0gMC4xOyAvL3VzZWQgc28gdGhhdCB0aGUgbGluZSB3b24ndCBydWRlbHkgY2xpcCB0aHJvdWdoIHRoZSBwb2ludCBvZiB0aGUgYXJyb3doZWFkXG5cblx0XHR0aGlzLmNvbmVHZW9tZXRyeS50cmFuc2xhdGUoIDAsIC0gYXJyb3doZWFkU2l6ZSArIGFycm93aGVhZE92ZXJzaG9vdEZhY3RvciwgMCApO1xuXG5cdFx0dGhpcy5fY29uZVVwRGlyZWN0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwxLDApO1xuXG5cdFx0dGhpcy5tYWtlR2VvbWV0cnkoKTtcblxuXHRcdHRocmVlLnNjZW5lLmFkZCh0aGlzLmxpbmVNZXNoKTtcblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcblx0XHRzdXBlci5fb25GaXJzdEFjdGl2YXRpb24oKTtcblxuXHRcdGlmKHRoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoID4gMSl7XG5cdFx0XHR0aGlzLm51bUFycm93aGVhZHMgPSB0aGlzLml0ZW1EaW1lbnNpb25zLnNsaWNlKDAsdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMSkucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cnJlbnQpe1xuXHRcdFx0XHRyZXR1cm4gY3VycmVudCArIHByZXY7XG5cdFx0XHR9KTtcblx0XHR9ZWxzZXtcblx0XHRcdC8vYXNzdW1lZCBpdGVtRGltZW5zaW9ucyBpc24ndCBhIG5vbnplcm8gYXJyYXkuIFRoYXQgc2hvdWxkIGJlIHRoZSBjb25zdHJ1Y3RvcidzIHByb2JsZW0uXG5cdFx0XHR0aGlzLm51bUFycm93aGVhZHMgPSAxO1xuXHRcdH1cblxuXHRcdC8vcmVtb3ZlIGFueSBwcmV2aW91cyBhcnJvd2hlYWRzXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmFycm93aGVhZHMubGVuZ3RoO2krKyl7XG5cdFx0XHRsZXQgYXJyb3cgPSB0aGlzLmFycm93aGVhZHNbaV07XG5cdFx0XHR0aHJlZS5zY2VuZS5yZW1vdmUoYXJyb3cpO1xuXHRcdH1cblxuXHRcdHRoaXMuYXJyb3doZWFkcyA9IG5ldyBBcnJheSh0aGlzLm51bUFycm93aGVhZHMpO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1BcnJvd2hlYWRzO2krKyl7XG5cdFx0XHR0aGlzLmFycm93aGVhZHNbaV0gPSBuZXcgVEhSRUUuTWVzaCh0aGlzLmNvbmVHZW9tZXRyeSwgdGhpcy5tYXRlcmlhbCk7XG5cdFx0XHR0aHJlZS5zY2VuZS5hZGQodGhpcy5hcnJvd2hlYWRzW2ldKTtcblx0XHR9XG5cdFx0Y29uc29sZS5sb2coXCJudW1iZXIgb2YgYXJyb3doZWFkcyAoPSBudW1iZXIgb2YgbGluZXMpOlwiKyB0aGlzLm51bUFycm93aGVhZHMpO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXG5cdFx0Ly9hc3NlcnQgaSA8IHZlcnRpY2VzLmNvdW50XG5cblx0XHRsZXQgaW5kZXggPSB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuXG5cdFx0aWYoeCAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4XSA9IHg7XG5cdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdID0geTtcblx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMl0gPSB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblxuXHRcdC8qIHdlJ3JlIGRyYXdpbmcgbGlrZSB0aGlzOlxuXHRcdCotLS0tKi0tLS0qXG5cbiAgICAgICAgKi0tLS0qLS0tLSpcblx0XG5cdFx0YnV0IHdlIGRvbid0IHdhbnQgdG8gaW5zZXJ0IGEgZGlhZ29uYWwgbGluZSBhbnl3aGVyZS4gVGhpcyBoYW5kbGVzIHRoYXQ6ICAqL1xuXG5cdFx0bGV0IGZpcnN0Q29vcmRpbmF0ZSA9IGkgJSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdO1xuXG5cdFx0Ly92ZXJ0aWNlcyBzaG91bGQgcmVhbGx5IGJlIGFuIHVuaWZvcm0sIHRob3VnaC5cblx0XHRpZighKGZpcnN0Q29vcmRpbmF0ZSA9PSAwIHx8IGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpKXtcblx0XHRcdGlmKHggIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zXSA9IHg7XG5cdFx0XHRpZih5ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysxXSA9IHk7XG5cdFx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysyXSA9IHo7XG5cdFx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXHRcdH1cblxuXHRcdGlmKGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpe1xuXG5cdFx0XHQvL2NhbGN1bGF0ZSBkaXJlY3Rpb24gb2YgbGFzdCBsaW5lIHNlZ21lbnRcblx0XHRcdGxldCBkeCA9IHRoaXMuX3ZlcnRpY2VzW2luZGV4LXRoaXMuX291dHB1dERpbWVuc2lvbnNdIC0gdGhpcy5fdmVydGljZXNbaW5kZXhdXG5cdFx0XHRsZXQgZHkgPSB0aGlzLl92ZXJ0aWNlc1tpbmRleC10aGlzLl9vdXRwdXREaW1lbnNpb25zKzFdIC0gdGhpcy5fdmVydGljZXNbaW5kZXgrMV1cblx0XHRcdGxldCBkeiA9IHRoaXMuX3ZlcnRpY2VzW2luZGV4LXRoaXMuX291dHB1dERpbWVuc2lvbnMrMl0gLSB0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXVxuXG5cdFx0XHRsZXQgbGluZU51bWJlciA9IE1hdGguZmxvb3IoaSAvIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0pO1xuXHRcdFx0VXRpbHMuYXNzZXJ0KGxpbmVOdW1iZXIgPD0gdGhpcy5udW1BcnJvd2hlYWRzKTsgLy90aGlzIG1heSBiZSB3cm9uZ1xuXG5cdFx0XHRsZXQgZGlyZWN0aW9uVmVjdG9yID0gbmV3IFRIUkVFLlZlY3RvcjMoLWR4LC1keSwtZHopXG5cblx0XHRcdC8vTWFrZSBhcnJvd3MgZGlzYXBwZWFyIGlmIHRoZSBsaW5lIGlzIHNtYWxsIGVub3VnaFxuXHRcdFx0Ly9PbmUgd2F5IHRvIGRvIHRoaXMgd291bGQgYmUgdG8gc3VtIHRoZSBkaXN0YW5jZXMgb2YgYWxsIGxpbmUgc2VnbWVudHMuIEknbSBjaGVhdGluZyBoZXJlIGFuZCBqdXN0IG1lYXN1cmluZyB0aGUgZGlzdGFuY2Ugb2YgdGhlIGxhc3QgdmVjdG9yLCB0aGVuIG11bHRpcGx5aW5nIGJ5IHRoZSBudW1iZXIgb2YgbGluZSBzZWdtZW50cyAobmFpdmVseSBhc3N1bWluZyBhbGwgbGluZSBzZWdtZW50cyBhcmUgdGhlIHNhbWUgbGVuZ3RoKVxuXHRcdFx0bGV0IGxlbmd0aCA9IGRpcmVjdGlvblZlY3Rvci5sZW5ndGgoKSAqICh0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpXG5cblx0XHRcdGNvbnN0IGVmZmVjdGl2ZURpc3RhbmNlID0gMztcblxuXHRcdFx0bGV0IGNsYW1wZWRMZW5ndGggPSBNYXRoLm1heCgwLCBNYXRoLm1pbihsZW5ndGgvZWZmZWN0aXZlRGlzdGFuY2UsIDEpKS8xXG5cblx0XHRcdC8vc2hyaW5rIGZ1bmN0aW9uIGRlc2lnbmVkIHRvIGhhdmUgYSBzdGVlcCBzbG9wZSBjbG9zZSB0byAwIGJ1dCBtZWxsb3cgb3V0IGF0IDAuNSBvciBzbyBpbiBvcmRlciB0byBhdm9pZCB0aGUgbGluZSB3aWR0aCBvdmVyY29taW5nIHRoZSBhcnJvd2hlYWQgd2lkdGhcblx0XHRcdC8vSW4gQ2hyb21lLCB0aHJlZS5qcyBjb21wbGFpbnMgd2hlbmV2ZXIgc29tZXRoaW5nIGlzIHNldCB0byAwIHNjYWxlLiBBZGRpbmcgYW4gZXBzaWxvbiB0ZXJtIGlzIHVuZm9ydHVuYXRlIGJ1dCBuZWNlc3NhcnkgdG8gYXZvaWQgY29uc29sZSBzcGFtLlxuXHRcdFx0XG5cdFx0XHR0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0uc2NhbGUuc2V0U2NhbGFyKE1hdGguYWNvcygxLTIqY2xhbXBlZExlbmd0aCkvTWF0aC5QSSArIHRoaXMuRVBTSUxPTik7XG5cdFx0XHRcbiBcdFx0XHQvL3Bvc2l0aW9uL3JvdGF0aW9uIGNvbWVzIGFmdGVyIHNpbmNlIC5ub3JtYWxpemUoKSBtb2RpZmllcyBkaXJlY3Rpb25WZWN0b3IgaW4gcGxhY2Vcblx0XHRcblx0XHRcdGxldCBwb3MgPSB0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0ucG9zaXRpb247XG5cblx0XHRcdGlmKHggIT09IHVuZGVmaW5lZClwb3MueCA9IHg7XG5cdFx0XHRpZih5ICE9PSB1bmRlZmluZWQpcG9zLnkgPSB5O1xuXHRcdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXBvcy56ID0gejtcblxuXHRcdFx0aWYobGVuZ3RoID4gMCl7IC8vZGlyZWN0aW9uVmVjdG9yLm5vcm1hbGl6ZSgpIGZhaWxzIHdpdGggMCBsZW5ndGhcblx0XHRcdFx0dGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnF1YXRlcm5pb24uc2V0RnJvbVVuaXRWZWN0b3JzKHRoaXMuX2NvbmVVcERpcmVjdGlvbiwgZGlyZWN0aW9uVmVjdG9yLm5vcm1hbGl6ZSgpICk7XG5cdFx0XHR9XG5cblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IFZlY3Rvck91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG5cbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQge0xpbmVPdXRwdXR9IGZyb20gJy4vTGluZU91dHB1dC5qcyc7XG5cbmNsYXNzIFN1cmZhY2VPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29ya1xuXHRcdFx0b3B0aW9uczpcblx0XHRcdHtcblx0XHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0XHRvcGFjaXR5OiBudW1iZXJcblx0XHRcdFx0Y29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcblx0XHRcdH1cblx0XHQqL1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmNvbG9yIDogMHg1NWFhNTU7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IDA7IC8vc2hvdWxkIGFsd2F5cyBiZSBlcXVhbCB0byB0aGlzLnZlcnRpY2VzLmxlbmd0aFxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbXTsgLy8gaG93IG1hbnkgdGltZXMgdG8gYmUgY2FsbGVkIGluIGVhY2ggZGlyZWN0aW9uXG5cdFx0dGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDM7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/XG5cblx0XHR0aGlzLnBhcmVudCA9IG51bGw7XG5cblx0XHR0aGlzLmluaXQoKTtcblx0fVxuXHRpbml0KCl7XG5cdFx0dGhpcy5fZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcblx0XHR0aGlzLl92ZXJ0aWNlcztcblx0XHR0aGlzLm1ha2VHZW9tZXRyeSgpO1xuXG5cdFx0dGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7Y29sb3I6IHRoaXMuX2NvbG9yLCBvcGFjaXR5OnRoaXMuX29wYWNpdHl9KTtcblx0XHR0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTWVzaCh0aGlzLl9nZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vIHNldHRlciBzZXRzIHRyYW5zcGFyZW50IGZsYWcgaWYgbmVjZXNzYXJ5XG5cblx0XHR0aHJlZS5zY2VuZS5hZGQodGhpcy5tZXNoKTtcblx0fVxuXHRtYWtlR2VvbWV0cnkoKXtcblxuXHRcdGxldCBNQVhfUE9JTlRTID0gMTAwMDA7XG5cblx0XHR0aGlzLl92ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMpO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KE1BWF9QT0lOVFMgKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcblxuXHRcdC8vIGJ1aWxkIGdlb21ldHJ5XG5cblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdwb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl92ZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnbm9ybWFsJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX25vcm1hbHMsIDMgKSApO1xuXHRcdC8vdGhpcy5nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICd1dicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB1dnMsIDIgKSApO1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3VzZWQgZHVyaW5nIHVwZGF0ZXMgYXMgYSBwb2ludGVyIHRvIHRoZSBidWZmZXJcblxuXHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblxuXHR9XG5cdF9vbkFkZCgpe1xuXHRcdC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBBcmVhXG5cdFx0bGV0IHJvb3QgPSB0aGlzO1xuXHRcdHdoaWxlKHJvb3QucGFyZW50ICE9PSBudWxsKXtcblx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcblx0XHR9XG5cdFxuXHRcdC8vdG9kbzogaW1wbGVtZW50IHNvbWV0aGluZyBsaWtlIGFzc2VydCByb290IHR5cGVvZiBSb290Tm9kZVxuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcblx0XHR0aGlzLl9vbkFkZCgpOyAvL3NldHVwIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLml0ZW1EaW1lbnNpb25zLiB1c2VkIGhlcmUgYWdhaW4gYmVjYXVzZSBjbG9uaW5nIG1lYW5zIHRoZSBvbkFkZCgpIG1pZ2h0IGJlIGNhbGxlZCBiZWZvcmUgdGhpcyBpcyBjb25uZWN0ZWQgdG8gYSB0eXBlIG9mIGRvbWFpblxuXG5cdFx0Ly8gcGVyaGFwcyBpbnN0ZWFkIG9mIGdlbmVyYXRpbmcgYSB3aG9sZSBuZXcgYXJyYXksIHRoaXMgY2FuIHJldXNlIHRoZSBvbGQgb25lP1xuXHRcdGxldCB2ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcblx0XHRsZXQgbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiAzKTtcblxuXHRcdGNvbnNvbGUubG9nKHRoaXMuaXRlbURpbWVuc2lvbnMsIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcblxuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0dGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl92ZXJ0aWNlcyk7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBub3JtYWxzO1xuXHRcdG5vcm1hbEF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9ub3JtYWxzKTtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cblx0XHQvL2Fzc2VydCB0aGlzLml0ZW1EaW1lbnNpb25zWzBdICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSA9IHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLl9vdXRwdXREaW1lbnNpb25zID09IDJcblx0XHR2YXIgaW5kaWNlcyA9IFtdO1xuXG5cdFx0Ly9yZW5kZXJlZCB0cmlhbmdsZSBpbmRpY2VzXG5cdFx0Ly9mcm9tIHRocmVlLmpzIFBsYW5lR2VvbWV0cnkuanNcblx0XHRsZXQgYmFzZSA9IDA7XG5cdFx0bGV0IGk9MCwgaj0wO1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTE7aisrKXtcblx0XHRcdGZvcihpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTE7aSsrKXtcblxuXHRcdFx0XHRsZXQgYSA9IGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGIgPSBpICsgKGorMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRsZXQgYyA9IChpKzEpKyAoaisxKSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBkID0gKGkrMSkrIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXG4gICAgICAgIFx0XHRpbmRpY2VzLnB1c2goYSwgYiwgZCk7XG5cdFx0XHRcdGluZGljZXMucHVzaChiLCBjLCBkKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vZG91YmxlIHNpZGVkIHJldmVyc2UgZmFjZXNcbiAgICAgICAgXHRcdGluZGljZXMucHVzaChkLCBiLCBhKTtcblx0XHRcdFx0aW5kaWNlcy5wdXNoKGQsIGMsIGIpO1xuXG5cdFx0XHRcdC8vc2V0IG5vcm1hbCB0byBbMCwwLDFdXG5cdFx0XHRcdC8qbm9ybWFsc1soaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdKSozXSA9IDBcblx0XHRcdFx0bm9ybWFsc1soaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdKSozKzFdID0gMFxuXHRcdFx0XHRub3JtYWxzWyhpICsgaiAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV0pKjMrMl0gPSAwKi9cblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc29sZS5sb2coaW5kaWNlcyk7XG5cdFx0dGhpcy5fZ2VvbWV0cnkuc2V0SW5kZXgoIGluZGljZXMgKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXG5cdFx0Ly9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuXG5cdFx0Ly9hc3NlcnQgaSA8IHZlcnRpY2VzLmNvdW50XG5cblx0XHRsZXQgaW5kZXggPSB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuXG5cdFx0aWYoeCAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4XSA9IHg7XG5cdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdID0geTtcblx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMl0gPSB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0Ly90b2RvOiByZWNhbGMgbm9ybWFsc1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3Jlc2V0IGFmdGVyIGVhY2ggdXBkYXRlXG5cdH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseSBtYWtlIHRoaXMgYSBmdW5jdGlvblxuXHRcdHRoaXMubWF0ZXJpYWwuY29sb3IgPSBuZXcgVEhSRUUuQ29sb3IoY29sb3IpO1xuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdH1cblx0Z2V0IGNvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbG9yO1xuXHR9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdHRoaXMubWF0ZXJpYWwub3BhY2l0eSA9IG9wYWNpdHk7XG5cdFx0dGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuXHRcdHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuXHR9XG5cdGdldCBvcGFjaXR5KCl7XG5cdFx0cmV0dXJuIHRoaXMuX29wYWNpdHk7XG5cdH1cblx0c2V0IHdpZHRoKHdpZHRoKXtcblx0XHR0aGlzLl93aWR0aCA9IHdpZHRoO1xuXHRcdHRoaXMubWF0ZXJpYWwubGluZXdpZHRoID0gd2lkdGg7XG5cdH1cblx0Z2V0IHdpZHRoKCl7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZHRoO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBTdXJmYWNlT3V0cHV0KHtjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuZXhwb3J0IHtTdXJmYWNlT3V0cHV0fTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vKlRoaXMgY2xhc3MgaXMgc3VwcG9zZWQgdG8gdHVybiBhIHNlcmllcyBvZlxuZGlyLmRlbGF5KClcbmRpci50cmFuc2l0aW9uVG8oLi4uKVxuZGlyLmRlbGF5KClcbmRpci5uZXh0U2xpZGUoKTtcblxuKi9cblxuaW1wb3J0IHtBbmltYXRpb259IGZyb20gJy4vQW5pbWF0aW9uLmpzJztcblxuY2xhc3MgRGlyZWN0aW9uQXJyb3d7XG5cdGNvbnN0cnVjdG9yKGZhY2VSaWdodCl7XG5cdFx0dGhpcy5hcnJvd0ltYWdlID0gRGlyZWN0aW9uQXJyb3cuYXJyb3dJbWFnZTsgLy90aGlzIHNob3VsZCBiZSBjaGFuZ2VkIG9uY2UgSSB3YW50IHRvIG1ha2UgbXVsdGlwbGUgYXJyb3dzIGF0IG9uY2VcblxuXHRcdGZhY2VSaWdodCA9IGZhY2VSaWdodD09PXVuZGVmaW5lZCA/IHRydWUgOiBmYWNlUmlnaHQ7XG5cblx0XHRpZihmYWNlUmlnaHQpe1xuXHRcdFx0dGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3ctcmlnaHRcIilcblx0XHR9ZWxzZXtcblx0XHRcdHRoaXMuYXJyb3dJbWFnZS5jbGFzc0xpc3QuYWRkKFwiZXhwLWFycm93LWxlZnRcIilcblx0XHR9XG5cdFx0dGhpcy5hcnJvd0ltYWdlLm9uY2xpY2sgPSAoZnVuY3Rpb24oKXtcblx0XHRcdHRoaXMub25jbGljaygpO1xuXHRcdH0pLmJpbmQodGhpcyk7XG5cblx0XHR0aGlzLm9uY2xpY2tDYWxsYmFjayA9IG51bGw7IC8vIHRvIGJlIHNldCBleHRlcm5hbGx5XG5cdH1cblx0b25jbGljaygpe1xuXHRcdHRoaXMuaGlkZVNlbGYoKTtcblx0XHR0aGlzLm9uY2xpY2tDYWxsYmFjaygpO1xuXHR9XG5cdHNob3dTZWxmKCl7XG5cdFx0dGhpcy5hcnJvd0ltYWdlLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnJztcblx0XHR0aGlzLmFycm93SW1hZ2Uuc3R5bGUub3BhY2l0eSA9IDE7XG5cdFx0XG5cdH1cblx0aGlkZVNlbGYoKXtcblx0XHR0aGlzLmFycm93SW1hZ2Uuc3R5bGUub3BhY2l0eSA9IDA7XG5cdFx0dGhpcy5hcnJvd0ltYWdlLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cdH1cblx0c3RhdGljIGFzeW5jIGxvYWRJbWFnZSgpe1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShcblx0XHRcdChmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0XHRpZih0aGlzLmFycm93SW1hZ2UgJiYgdGhpcy5hcnJvd0ltYWdlLndpZHRoICE9IDApe1xuXHRcdFx0XHRcdHJldHVybiByZXNvbHZlKCk7IC8vcXVpdCBlYXJseVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuYXJyb3dJbWFnZSA9IG5ldyBJbWFnZSgpO1xuXHRcdFx0XHR0aGlzLmFycm93SW1hZ2Uub25sb2FkID0gcmVzb2x2ZTtcblx0XHRcdFx0XG5cdFx0XHRcdHRoaXMuYXJyb3dJbWFnZS5zcmMgPSBcbnRoaXMuYXJyb3dJbWFnZS5iYXNlVVJJLnN1YnN0cmluZygwLHRoaXMuYXJyb3dJbWFnZS5iYXNlVVJJLnNlYXJjaChcImV4cGxhbmFyaWFcIikpICsgXCJleHBsYW5hcmlhL3NyYy9FeHBsYW5hcmlhbk5leHRBcnJvdy5zdmdcIjtcblx0XHRcdFx0dGhpcy5hcnJvd0ltYWdlLmNsYXNzTmFtZSA9IFwiZXhwLWFycm93XCI7XG5cdFx0XHR9KS5iaW5kKHRoaXMpKTtcblx0fVxufVxuRGlyZWN0aW9uQXJyb3cubG9hZEltYWdlKCk7IC8vIHByZWxvYWRcblxuXG5jbGFzcyBOb25EZWNyZWFzaW5nRGlyZWN0b3J7XG5cdC8vIEkgd2FudCBEaXJlY3RvcigpIHRvIGJlIGFibGUgdG8gYmFja3RyYWNrIGJ5IHByZXNzaW5nIGJhY2t3YXJkcy4gVGhpcyBkb2Vzbid0IGRvIHRoYXQuXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHRoaXMudW5kb1N0YWNrID0gW107XG5cdFx0dGhpcy51bmRvU3RhY2tJbmRleCA9IDA7XG5cblx0XHR0aGlzLnNsaWRlcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJleHAtc2xpZGVcIik7XG5cdFx0dGhpcy5jdXJyZW50U2xpZGVJbmRleCA9IDA7XG5cblx0XHR0aGlzLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbiA9IG51bGw7XG5cdH1cblxuXG5cdGFzeW5jIGJlZ2luKCl7XG5cdFx0YXdhaXQgdGhpcy53YWl0Rm9yUGFnZUxvYWQoKTtcblxuXHRcdHRoaXMucmlnaHRBcnJvdyA9IG5ldyBEaXJlY3Rpb25BcnJvdygpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yaWdodEFycm93LmFycm93SW1hZ2UpO1xuXHRcdGxldCBzZWxmID0gdGhpcztcblx0XHR0aGlzLnJpZ2h0QXJyb3cub25jbGlja0NhbGxiYWNrID0gZnVuY3Rpb24oKXtcblx0XHRcdHNlbGYuX2NoYW5nZVNsaWRlKDEsIGZ1bmN0aW9uKCl7fSk7IC8vIHRoaXMgZXJyb3JzIHdpdGhvdXQgdGhlIGVtcHR5IGZ1bmN0aW9uIGJlY2F1c2UgdGhlcmUncyBubyByZXNvbHZlLiBUaGVyZSBtdXN0IGJlIGEgYmV0dGVyIHdheSB0byBkbyB0aGluZ3MuXG5cdFx0XHRjb25zb2xlLndhcm4oXCJXQVJOSU5HOiBIb3JyaWJsZSBoYWNrIGluIGVmZmVjdCB0byBjaGFuZ2Ugc2xpZGVzLiBQbGVhc2UgcmVwbGFjZSB0aGUgcGFzcy1hbi1lbXB0eS1mdW5jdGlvbiB0aGluZyB3aXRoIHNvbWV0aGluZyB0aGF0IGFjdHVhbGx5IHJlc29sdmVzIHByb3Blcmx5IGFuZCBkb2VzIGFzeW5jLlwiKVxuXHRcdFx0c2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24oKTtcblx0XHR9XG5cblx0fVxuXG5cdGFzeW5jIHdhaXRGb3JQYWdlTG9hZCgpe1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0Ly93aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIixyZXNvbHZlKTtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsMSk7XG5cdFx0XHRyZXNvbHZlKClcblx0XHR9KTtcblx0fVxuXG5cdHNob3dTbGlkZShzbGlkZU51bWJlcil7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnNsaWRlcy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuc2xpZGVzW2ldLnN0eWxlLm9wYWNpdHkgPSAwO1xuXHRcdH1cblx0XHR0aGlzLnNsaWRlc1tzbGlkZU51bWJlcl0uc3R5bGUub3BhY2l0eSA9IDE7XG5cdH1cblxuXHRhc3luYyBuZXh0U2xpZGUoKXtcblx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cblx0XHR0aGlzLnJpZ2h0QXJyb3cuc2hvd1NlbGYoKTtcblx0XHQvL3Byb21pc2UgaXMgcmVzb2x2ZWQgYnkgY2FsbGluZyB0aGlzLm5leHRTbGlkZVByb21pc2UucmVzb2x2ZSgpIHdoZW4gdGhlIHRpbWUgY29tZXNcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0ZnVuY3Rpb24ga2V5TGlzdGVuZXIoZSl7XG5cdFx0XHRcdGlmKGUucmVwZWF0KXJldHVybjsgLy9rZXlkb3duIGZpcmVzIG11bHRpcGxlIHRpbWVzIGJ1dCB3ZSBvbmx5IHdhbnQgdGhlIGZpcnN0IG9uZVxuXHRcdFx0XHRsZXQgc2xpZGVEZWx0YSA9IDA7XG5cdFx0XHRcdHN3aXRjaCAoZS5rZXlDb2RlKSB7XG5cdFx0XHRcdCAgY2FzZSAzNDpcblx0XHRcdFx0ICBjYXNlIDM5OlxuXHRcdFx0XHQgIGNhc2UgNDA6XG5cdFx0XHRcdFx0c2xpZGVEZWx0YSA9IDE7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdCAgZGVmYXVsdDpcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZihzbGlkZURlbHRhICE9IDApe1xuXHRcdFx0XHRcdHNlbGYuX2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpO1xuXHRcdFx0XHRcdHNlbGYucmlnaHRBcnJvdy5oaWRlU2VsZigpO1xuXHRcdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLGtleUxpc3RlbmVyKTsgLy90aGlzIGFwcHJvYWNoIHRha2VuIGZyb20gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzU3MTg2NDUvcmVzb2x2aW5nLWEtcHJvbWlzZS13aXRoLWV2ZW50bGlzdGVuZXJcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwga2V5TGlzdGVuZXIpO1xuXHRcdFx0Ly9ob3JyaWJsZSBoYWNrIHNvIHRoYXQgdGhlICduZXh0IHNsaWRlJyBhcnJvdyBjYW4gdHJpZ2dlciB0aGlzIHRvb1xuXHRcdFx0c2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBmdW5jdGlvbigpeyBcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIixrZXlMaXN0ZW5lcik7IFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdF9jaGFuZ2VTbGlkZShzbGlkZURlbHRhLCByZXNvbHZlKXtcblx0XHRcdC8vc2xpZGUgY2hhbmdpbmcgbG9naWNcblxuXG5cdFx0Ly9yaWdodCBub3cgdGhlcmUgaXMgYSBwcm9ibGVtLiBHb2luZyBiYWNrd2FyZHMgc2hvdWxkIG5vdCByZXNvbHZlIHRoZSBwcm9taXNlOyBvbmx5IGdvaW5nIHRvIHRoZSBtb3N0IHJlY2VudCBzbGlkZSBhbmQgcHJlc3NpbmcgcmlnaHQgc2hvdWxkLlxuXHRcdGlmKHNsaWRlRGVsdGEgIT0gMCl7XG5cdFx0XHRpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IDAgJiYgc2xpZGVEZWx0YSA9PSAtMSl7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gdGhpcy5zbGlkZXMubGVuZ3RoLTEgJiYgc2xpZGVEZWx0YSA9PSAxKXtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5jdXJyZW50U2xpZGVJbmRleCArPSBzbGlkZURlbHRhO1xuXHRcdFx0dGhpcy5zaG93U2xpZGUodGhpcy5jdXJyZW50U2xpZGVJbmRleCk7XG5cdFx0XHRyZXNvbHZlKCk7XG5cdFx0fVxuXHR9XG5cdC8vdmVyYnNcblx0YXN5bmMgZGVsYXkod2FpdFRpbWUpe1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHRcdH0pO1xuXHR9XG5cdFRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TKXtcblx0XHQvL0VYUC5VdGlscy5Bc3NlcnQodGhpcy51bmRvU3RhY2tJbmRleCA9PSAwKTsgLy9UaGlzIG1heSBub3Qgd29yayB3ZWxsLlxuXHRcdG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwKTtcblx0fVxufVxuLypcbmNsYXNzIERpcmVjdG9ye1xuXHQvL3RvZG8uIE1ha2UgdGhpcyBhYmxlIHRvIGJhY2t0cmFja1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHR0aGlzLnVuZG9TdGFjayA9IFtdO1xuXHRcdHRoaXMudW5kb1N0YWNrSW5kZXggPSAwO1xuXG5cdFx0dGhpcy5zbGlkZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXhwLXNsaWRlXCIpO1xuXHRcdHRoaXMuY3VycmVudFNsaWRlSW5kZXggPSAwO1xuXHRcdC8vdGhpcy5zaG93U2xpZGUoMCk7IC8vZmFpbHMgYmVjYXVzZSBET00gaXNuJ3QgbG9hZGVkLlxuXHR9XG5cblx0YXN5bmMgd2FpdEZvclBhZ2VMb2FkKCl7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIixyZXNvbHZlKTtcblx0XHR9KTtcblx0fVxuXG5cdHNob3dTbGlkZShzbGlkZU51bWJlcil7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnNsaWRlcy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuc2xpZGVzW2ldLnN0eWxlLm9wYWNpdHkgPSAwO1xuXHRcdH1cblx0XHR0aGlzLnNsaWRlc1tzbGlkZU51bWJlcl0uc3R5bGUub3BhY2l0eSA9IDE7XG5cdH1cblxuXHRuZXh0U2xpZGUoKXtcblx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleXByZXNzXCIsIGZ1bmN0aW9uIGtleUxpc3RlbmVyKGUpe1xuXHRcdFx0XHRsZXQgc2xpZGVEZWx0YSA9IDA7XG5cdFx0XHRcdHN3aXRjaCAoZS5rZXlDb2RlKSB7XG5cdFx0XHRcdCAgY2FzZSAzMzpcblx0XHRcdFx0ICBjYXNlIDM3OlxuXHRcdFx0XHQgIGNhc2UgMzg6XG5cdFx0XHRcdFx0c2xpZGVEZWx0YSA9IC0xO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHQgIGNhc2UgMzQ6XG5cdFx0XHRcdCAgY2FzZSAzOTpcblx0XHRcdFx0ICBjYXNlIDQwOlxuXHRcdFx0XHRcdHNsaWRlRGVsdGEgPSAxO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGYuX2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpO1xuXHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleXByZXNzXCIsa2V5TGlzdGVuZXIpOyAvL3RoaXMgYXBwcm9hY2ggdGFrZW4gZnJvbSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNTcxODY0NS9yZXNvbHZpbmctYS1wcm9taXNlLXdpdGgtZXZlbnRsaXN0ZW5lclxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblx0X2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpe1xuXHRcdFx0Ly9zbGlkZSBjaGFuZ2luZyBsb2dpY1xuXHRcdGlmKHNsaWRlRGVsdGEgIT0gMCl7XG5cdFx0XHRpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IDAgJiYgc2xpZGVEZWx0YSA9PSAtMSl7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gdGhpcy5zbGlkZXMubGVuZ3RoLTEgJiYgc2xpZGVEZWx0YSA9PSAxKXtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0XHRjb25zb2xlLmxvZyhzbGlkZURlbHRhLCB0aGlzLmN1cnJlbnRTbGlkZUluZGV4KTtcblx0XHRcdHRoaXMuY3VycmVudFNsaWRlSW5kZXggKz0gc2xpZGVEZWx0YTtcblx0XHRcdHRoaXMuc2hvd1NsaWRlKHRoaXMuY3VycmVudFNsaWRlSW5kZXgpO1xuXHRcdFx0cmVzb2x2ZSgpO1xuXHRcdH1cblx0fVxuXG5cdC8vdmVyYnNcblx0YXN5bmMgZGVsYXkod2FpdFRpbWUpe1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHRcdH0pO1xuXHR9XG5cdHRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TKXtcblx0XHQvL0VYUC5VdGlscy5Bc3NlcnQodGhpcy51bmRvU3RhY2tJbmRleCA9PSAwKTsgLy9UaGlzIG1heSBub3Qgd29yayB3ZWxsLlxuXHRcdHZhciBhbmltYXRpb24gPSBuZXcgRVhQLkFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDApO1xuXHRcdGxldCBmcm9tVmFsdWVzID0gYW5pbWF0aW9uLmZyb21WYWx1ZXM7XG5cdFx0dGhpcy51bmRvU3RhY2sucHVzaChuZXcgRVhQLkRpcmVjdG9yLlVuZG9JdGVtKHRhcmdldCwgdG9WYWx1ZXMsIGZyb21WYWx1ZXMsIGR1cmF0aW9uTVMpKTtcblx0XHR0aGlzLnVuZG9TdGFja0luZGV4Kys7XG5cdH1cbn1cblxuRVhQLkRpcmVjdG9yLlVuZG9JdGVtID0gY2xhc3MgVW5kb0l0ZW17XG5cdGNvbnN0cnVjdG9yKHRhcmdldCwgdG9WYWx1ZXMsIGZyb21WYWx1ZXMsIGR1cmF0aW9uTVMpe1xuXHRcdHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xuXHRcdHRoaXMudG9WYWx1ZXMgPSB0b1ZhbHVlcztcblx0XHR0aGlzLmZyb21WYWx1ZXMgPSBmcm9tVmFsdWVzO1xuXHRcdHRoaXMuZHVyYXRpb25NUyA9IGR1cmF0aW9uTVM7XG5cdH1cbn0qL1xuXG5leHBvcnQgeyBOb25EZWNyZWFzaW5nRGlyZWN0b3IsIERpcmVjdGlvbkFycm93IH07XG4iXSwibmFtZXMiOlsiTWF0aCIsIkFyZWEiLCJUcmFuc2Zvcm1hdGlvbiIsIm1hdGgubGVycFZlY3RvcnMiLCJyZXF1aXJlIiwicmVxdWlyZSQkMCIsInJlcXVpcmUkJDEiLCJyZXF1aXJlJCQyIiwiZ2xvYmFsIiwiZGVmaW5lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Q0FBQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBOztDQUVBLE1BQU0sSUFBSTtDQUNWLENBQUMsV0FBVyxFQUFFLEVBQUU7Q0FDaEIsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0NBQ1g7Q0FDQSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQzVCLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Q0FDdEIsRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO0NBQ2pDLEVBQUUsT0FBTyxLQUFLLENBQUM7Q0FDZixFQUFFO0NBQ0YsQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNYLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztDQUNkLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDN0MsRUFBRSxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUMsR0FBRztDQUN2QixHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0NBQ3ZCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDO0NBQ3BDLEdBQUc7Q0FDSCxFQUFFLE9BQU8sSUFBSSxDQUFDO0NBQ2QsRUFBRTtDQUNGLENBQUM7O0NBRUQsTUFBTSxVQUFVO0NB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QUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3ZHLEtBQUssSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQzlDLEtBQUssSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDOUMsS0FBSztDQUNMLElBQUk7Q0FDSixHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsQ0FBQztDQUNuQztDQUNBLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDNUMsSUFBSSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEcsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM3QyxLQUFLLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FB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QUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsQ0FBQztFQUNILFNBQVMsS0FBSyxDQUFDLE1BQU0sRUFBRTtHQUN0QixJQUFJLENBQUMsRUFBRSxNQUFNLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7R0FDdkMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUMvQixNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2Q7R0FDRCxPQUFPLE1BQU0sQ0FBQztHQUNkOztFQUVELFNBQVMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRTtHQUNwRCxJQUFJLE9BQU8sR0FBRyxNQUFNLEdBQUcsU0FBUztJQUMvQixNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLENBQUM7O0dBRW5FLE1BQU0sQ0FBQyxHQUFHLENB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QUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPQSxlQUFPLEVBQUUsVUFBVSxFQUFFQSxlQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxTQUFTLFlBQVksRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFVBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLEdBQUcsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsWUFBWSxLQUFLLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLG9CQUFtQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsK0NBQStDLENBQUMscUNBQXFDLENBQUMsa0RBQWtELENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE9BQU8sT0FBTyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxRQUFRLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLGdCQUFnQixDQUFDLFNBQVMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFDLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLFNBQVMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsVUFBVSxDQUFDLFNBQVMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsUUFBUSxDQUFDLFNBQVMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsUUFBUSxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxVQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxHQUFHLFlBQVksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFZLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixHQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsR0FBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFHLElBQUksRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBSyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssNEJBQTRCLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEFBQW1CLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBSyxDQUFDLENBQUMsT0FBTyxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxNQUFNLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFVLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLFdBQVcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLFNBQVMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsR0FBRyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLEVBQUUsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsTUFBTSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFDLENBQUMsVUFBVSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsQUFBd0IsSUFBSSxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxBQUFhLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLElBQUksY0FBYyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLFFBQVEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxRQUFRLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFTLENBQUMsU0FBUyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLFdBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTLENBQUMsT0FBTyxXQUFXLENBQUMsU0FBUyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBUyxDQUFDLFNBQVMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxFQUFFLFdBQVcsQ0FBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxhQUFhLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxRQUFRLEdBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxTQUFTLFdBQVcsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyw2RkFBNkYsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxRQUFRLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBQyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsVUFBVSxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksR0FBRyxHQUFHLEdBQUcsT0FBTyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxJQUFJLGFBQWEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsYUFBYSxDQUFDLEdBQUcsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsT0FBTyxTQUFTLEdBQUcsV0FBVyxFQUFFLFNBQVMsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyx3QkFBd0IsR0FBRyxXQUFXLEVBQUUsd0JBQXdCLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSx3QkFBd0IsRUFBRSxPQUFPLHFCQUFxQixHQUFHLFdBQVcsRUFBRSxxQkFBcUIsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLHFCQUFxQixDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQUssQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBTSxVQUFVLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLFNBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLFlBQVksRUFBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEdBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxNQUFLLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGdCQUFnQixHQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsT0FBTyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqOTVCOzs7O0FDRi9CLENBQUMsQ0FBQyxXQUFXOztBQUViLENBQTRFO0dBQzFFLElBQUksR0FBRyxHQUFHQyxHQUFtQixDQUFDO0dBQzlCLElBQUksUUFBUSxHQUFHQyxVQUF3QixDQUFDO0dBQ3hDLElBQUksR0FBRyxHQUFHQyxHQUFtQixDQUFDO0VBQy9COztDQUlELElBQUksV0FBVyxHQUFHO0NBQ2xCLFVBQVUsRUFBRSxJQUFJO0NBQ2hCLFFBQVEsRUFBRSxJQUFJO0VBQ2IsQ0FBQzs7Q0FFRixTQUFTLFdBQVcsQ0FBQyxLQUFLLEVBQUU7S0FDeEIsT0FBTyxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLE1BQU0sSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDO0lBQzFEOzs7Q0FPSCxJQUFJLFdBQVcsR0FBRyxDQUFDLEFBQStCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRO0dBQzVFLE9BQU87R0FDUCxTQUFTLENBQUM7OztDQUdaLElBQUksVUFBVSxHQUFHLENBQUMsQUFBOEIsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVE7R0FDeEUsTUFBTTtHQUNOLFNBQVMsQ0FBQzs7O0NBR1osSUFBSSxhQUFhLEdBQUcsQ0FBQyxVQUFVLElBQUksVUFBVSxDQUFDLE9BQU8sS0FBSyxXQUFXO0dBQ25FLFdBQVc7R0FDWCxTQUFTLENBQUM7OztDQUdaLElBQUksVUFBVSxHQUFHLFdBQVcsQ0FBQyxXQUFXLElBQUksVUFBVSxJQUFJLE9BQU9DLGNBQU0sSUFBSSxRQUFRLElBQUlBLGNBQU0sQ0FBQyxDQUFDOzs7Q0FHL0YsSUFBSSxRQUFRLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDOzs7Q0FHN0QsSUFBSSxVQUFVLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDOzs7Q0FHbkUsSUFBSSxVQUFVLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDOzs7Ozs7OztDQVEvRCxJQUFJLElBQUksR0FBRyxVQUFVO0VBQ3BCLENBQUMsVUFBVSxNQUFNLFVBQVUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLEtBQUssVUFBVSxDQUFDO0dBQ2hFLFFBQVEsSUFBSSxVQUFVLElBQUksUUFBUSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7O0NBRXRELElBQUksRUFBRSxJQUFJLElBQUksTUFBTSxFQUFFLEdBQUc7RUFDeEIsTUFBTSxDQUFDLEVBQUUsR0FBRyxVQUFVLEdBQUU7RUFDeEI7O0NBRUQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUU7RUFDeEMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFO0dBQzVELEtBQUssRUFBRSxVQUFVLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFOztLQUV4QyxJQUFJLE1BQU0sR0FBRyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1NBQzVELEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTTtTQUNuQixHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7O0tBRTlCLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUc7TUFDMUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7TUFDOUI7O0tBRUQsUUFBUSxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJLFdBQVcsQ0FBQyxFQUFFLEVBQUUsQ0FBQztJQUM1RDtHQUNELENBQUMsQ0FBQztFQUNIOzs7Ozs7Ozs7Ozs7OztDQWNELENBQUMsVUFBVTs7R0FFVCxJQUFJLGFBQWEsSUFBSSxNQUFNLElBQUksS0FBSyxFQUFFO09BQ2xDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO0lBQzNCOztHQUVELElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxZQUFZO0lBQ25DLE9BQU8sSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUM1QixDQUFDLENBQUM7O0dBRUgsSUFBSSxLQUFLLElBQUksTUFBTSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUM7O0tBRXZDLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQzs7S0FFM0IsSUFBSSxXQUFXLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDO09BQzNELFNBQVMsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLGdCQUFlO01BQy9DOztLQUVELE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxHQUFHLFNBQVMsR0FBRyxFQUFFO09BQ3JDLE9BQU8sSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQztPQUMvQjtJQUNGOztFQUVGLEdBQUcsQ0FBQzs7O0NBR0wsU0FBUyxHQUFHLEVBQUUsQ0FBQyxHQUFHO0VBQ2pCLE9BQU8sTUFBTSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUN2Qzs7O0NBR0QsSUFBSSxXQUFXLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQzs7Q0FFcEMsU0FBUyxJQUFJLEdBQUc7RUFDZixTQUFTLEVBQUUsR0FBRztHQUNiLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztHQUMzRTtFQUNELE9BQU8sRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDO0VBQ3JGOztDQUVELFNBQVMsY0FBYyxFQUFFLFFBQVEsR0FBRzs7RUFFbkMsSUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDOztFQUVuQixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQzs7RUFFekIsSUFBSSxDQUFDLEVBQUUsR0FBRyxTQUFTLEtBQUssRUFBRSxPQUFPLEVBQUU7O0dBRWxDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUM7O0dBRTNCLENBQUM7O0VBRUYsSUFBSSxDQUFDLElBQUksR0FBRyxTQUFTLEtBQUssRUFBRTs7R0FFM0IsSUFBSSxPQUFPLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0dBQy9CLElBQUksT0FBTyxFQUFFOztJQUVaLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7SUFFOUQ7O0dBRUQsQ0FBQzs7RUFFRixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxJQUFJLElBQUksSUFBSSxFQUFFLENBQUM7RUFDeEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7RUFDcEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7O0VBRW5COztDQUVELGNBQWMsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFVBQVUsRUFBRSxDQUFDO0NBQzlDLGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsRUFBRSxDQUFDO0NBQzdDLGNBQWMsQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLFVBQVUsRUFBRSxDQUFDO0NBQzVDLGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsRUFBRSxDQUFDO0NBQzdDLGNBQWMsQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLFVBQVUsRUFBRSxDQUFDO0NBQ2hELGNBQWMsQ0FBQyxTQUFTLENBQUMsYUFBYSxHQUFHLFVBQVUsRUFBRSxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUM7Q0FDcEUsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsV0FBVyxFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUUsZUFBZSxHQUFFLEdBQUU7O0NBRTdFLFNBQVMsWUFBWSxFQUFFLFFBQVEsR0FBRzs7RUFFakMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7O0VBRXRDLElBQUksQ0FBQyxTQUFTLEdBQUcsT0FBTTtFQUN2QixJQUFJLENBQUMsUUFBUSxHQUFHLG9CQUFtQjtFQUNuQyxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQzs7RUFFeEIsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFJO0VBQ2hCLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDOztFQUVmOztDQUVELFlBQVksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsU0FBUyxFQUFFLENBQUM7O0NBRW5FLFlBQVksQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFVBQVU7O0VBRXhDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQzs7RUFFZixDQUFDOztDQUVGLFlBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLFVBQVUsSUFBSSxHQUFHOztFQUU3QyxJQUFJLFVBQVUsR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO0VBQ2xDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsV0FBVztHQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxVQUFVLEVBQUUsVUFBVSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7Ozs7R0FJaEcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0dBQ2IsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0dBQ1osQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7RUFDZixVQUFVLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7O0dBRW5DOztDQUVELFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsUUFBUSxHQUFHOztFQUVsRCxRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDOztHQUU3Qjs7Q0FFRCxZQUFZLENBQUMsU0FBUyxDQUFDLE9BQU8sR0FBRyxXQUFXOztFQUUzQyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7RUFDdEIsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7O0dBRWY7O0NBRUQsU0FBUyxZQUFZLEVBQUUsUUFBUSxHQUFHOztFQUVqQyxZQUFZLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQzs7RUFFcEMsSUFBSSxDQUFDLElBQUksR0FBRyxXQUFXLENBQUM7RUFDeEIsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUM7O0VBRTVCOztDQUVELFlBQVksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUM7O0NBRWpFLFlBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLFVBQVUsTUFBTSxHQUFHOztFQUUvQyxNQUFNLENBQUMsTUFBTSxFQUFFLFVBQVUsSUFBSSxHQUFHO0dBQy9CLFlBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7R0FDOUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRTs7R0FFM0I7O0NBRUQsU0FBUyxhQUFhLEVBQUUsUUFBUSxHQUFHOztFQUVsQyxZQUFZLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQzs7RUFFcEMsSUFBSSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUM7RUFDekIsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUM7RUFDNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLFFBQVEsQ0FBQyxPQUFPLEdBQUcsR0FBRyxNQUFNLEVBQUUsQ0FBQzs7RUFFaEQ7O0NBRUQsYUFBYSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLFlBQVksQ0FBQyxTQUFTLEVBQUUsQ0FBQzs7Q0FFbEUsYUFBYSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxNQUFNLEdBQUc7O0VBRWhELE1BQU0sQ0FBQyxNQUFNLEVBQUUsVUFBVSxJQUFJLEdBQUc7R0FDL0IsWUFBWSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQztHQUM5QyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLEdBQUU7O0dBRXpDOzs7Ozs7OztDQVFELFNBQVMsYUFBYSxFQUFFLFFBQVEsR0FBRzs7RUFFbEMsSUFBSSxNQUFNLEdBQUcsUUFBUSxDQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUUsQ0FBQztFQUNoRCxJQUFJLE1BQU0sQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxZQUFZLEVBQUU7R0FDbkUsT0FBTyxDQUFDLEdBQUcsRUFBRSxnREFBZ0QsR0FBRTtHQUMvRDs7RUFFRCxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQzs7RUFFdEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLFFBQVEsQ0FBQyxPQUFPLEdBQUcsR0FBRyxNQUFNLEVBQUUsQ0FBQzs7RUFFaEQsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFPO0VBQ3hCLElBQUksQ0FBQyxRQUFRLEdBQUcsYUFBWTtFQUM1QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7O0VBRWxDLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO0VBQ2pCLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDOztHQUViLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxVQUFVLENBQUM7S0FDaEMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO0tBQ3JCLFVBQVUsRUFBRSxJQUFJO0tBQ2hCLEVBQUUsRUFBRSxJQUFJO0tBQ1IsU0FBUyxFQUFFLFFBQVEsQ0FBQyxTQUFTO0VBQ2hDLENBQUMsQ0FBQzs7O0VBR0Y7O0NBRUQsYUFBYSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzs7Q0FFcEUsYUFBYSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsVUFBVSxNQUFNLEdBQUc7O0VBRWxELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQzs7R0FFZjs7Q0FFRCxhQUFhLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxVQUFVLE1BQU0sR0FBRzs7R0FFL0MsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7Ozs7RUFJbkMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksR0FBRztHQUN0SCxJQUFJLENBQUMsSUFBSSxFQUFFLFVBQVUsSUFBSSxHQUFHO0lBQzNCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxRQUFRLEdBQUcsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNoRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDaEUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2YsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ1osSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxHQUFHLFFBQVEsR0FBRyxHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2hFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNaLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFFO0dBQ2hCLE1BQU07R0FDTixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7R0FDWjs7R0FFRDs7Q0FFRCxhQUFhLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxVQUFVLFFBQVEsR0FBRzs7OztHQUlsRCxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQzs7Ozs7O0dBTTVDOztDQUVELGFBQWEsQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLFVBQVUsTUFBTSxHQUFHOztFQUVwRCxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQzs7R0FFakI7O0NBRUQsU0FBUyxxQkFBcUIsRUFBRSxRQUFRLEdBQUc7O0VBRTFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDOztFQUV0QyxRQUFRLENBQUMsT0FBTyxHQUFHLEVBQUUsUUFBUSxDQUFDLE9BQU8sR0FBRyxHQUFHLE1BQU0sRUFBRSxDQUFDOztFQUVwRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksWUFBWSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsQ0FBQztLQUMvQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsV0FBVztTQUNuQyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsR0FBRTtNQUN6QixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDO0tBQ2pCLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQUcsRUFBRSxJQUFJLEdBQUc7U0FDOUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztTQUN2QixLQUFLLEVBQUUsR0FBRzthQUNOLElBQUksQ0FBQyxRQUFRLEdBQUcsU0FBUyxDQUFDO2FBQzFCLEVBQUUsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUM7VUFDbkI7TUFDSixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDO0tBQ2pCLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxVQUFVLFFBQVEsR0FBRztTQUM5QyxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxHQUFHO2FBQzVCLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLFFBQVEsR0FBRTtVQUN2QztNQUNKLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUM7S0FDakIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLFVBQVUsSUFBSSxHQUFHO1NBQ3ZDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztNQUN4QyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDOztFQUVwQjs7Q0FFRCxxQkFBcUIsQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsU0FBUyxFQUFFLENBQUM7O0NBRTVFLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsV0FBVzs7RUFFbEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDOztFQUVwQyxDQUFDOztDQUVGLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxNQUFNLEdBQUc7O0VBRXhELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxDQUFDOztHQUUzQjs7Q0FFRCxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsUUFBUSxHQUFHOztLQUV4RCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztLQUN6QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDOztHQUV0Qjs7Q0FFRCxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsYUFBYSxHQUFHLFdBQVc7S0FDdkQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxDQUFDO0VBQ3ZDLENBQUM7Ozs7OztDQU1GLFNBQVMsZUFBZSxFQUFFLFFBQVEsR0FBRzs7RUFFcEMsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7O0VBRXRDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUM7RUFDekMsSUFBSSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUM7RUFDekIsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUM7RUFDekIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7RUFDbkIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7RUFDMUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7O0VBRWpCOztDQUVELGVBQWUsQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsU0FBUyxFQUFFLENBQUM7O0NBRXRFLGVBQWUsQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLFVBQVUsTUFBTSxHQUFHOztFQUVsRCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRztHQUNsQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO0dBQ3JELElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxhQUFhLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0dBQ3RELElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUM7O0dBRTNCLElBQUksQ0FBQyxhQUFhLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQyxFQUFFO0lBQ2hELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6QixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQzs7R0FFZjtFQUNELElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQzs7R0FFWjs7Q0FFRCxlQUFlLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxVQUFVLFFBQVEsR0FBRzs7RUFFckQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLEdBQUc7R0FDekMsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLE1BQU0sR0FBRyxZQUFZLEVBQUUsQ0FBQyxDQUFDO0dBQzdELElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO0dBQ2pCLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQzs7R0FFakIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7O0VBRWYsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQzs7R0FFMUI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnRUQsU0FBUyxZQUFZLEVBQUUsUUFBUSxHQUFHOztFQUVqQyxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQzs7RUFFdEMsUUFBUSxDQUFDLE9BQU8sR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsT0FBTyxHQUFHLEVBQUUsR0FBRyxHQUFHLE1BQU0sRUFBRSxFQUFFLENBQUM7RUFDbEUsUUFBUSxDQUFDLE9BQU8sR0FBRyxRQUFRLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQzs7RUFFekMsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFNO0VBQ3ZCLElBQUksQ0FBQyxRQUFRLEdBQUcsWUFBVzs7SUFFekIsSUFBSSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsYUFBYSxFQUFFLFFBQVEsRUFBRSxDQUFDO0lBQ2pELElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDMUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7O0lBRXJCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUM7R0FDeEIsT0FBTyxFQUFFLFFBQVEsQ0FBQyxPQUFPO0dBQ3pCLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTztHQUN6QixZQUFZLEVBQUUsUUFBUSxDQUFDLFdBQVcsR0FBRyxlQUFlO0dBQ3BELEVBQUUsQ0FBQzs7S0FFRCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsVUFBVSxRQUFRLEdBQUc7U0FDOUMsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsR0FBRzthQUM1QixJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxRQUFRLEdBQUU7VUFDdkM7TUFDSixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDOztLQUVqQixJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsVUFBVSxJQUFJLEdBQUc7U0FDekMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztTQUN2QixLQUFLLEVBQUUsR0FBRzthQUNOLElBQUksQ0FBQyxRQUFRLEdBQUcsU0FBUyxDQUFDO2FBQzFCLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQztVQUNkO01BQ0osQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQzs7RUFFcEI7O0NBRUQsWUFBWSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzs7Q0FFbkUsWUFBWSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxNQUFNLEdBQUc7O0VBRS9DLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHO0dBQ25CLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7R0FDL0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztHQUNqRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztHQUNwQjs7RUFFRCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDO0VBQ2pDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7RUFDbkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQzs7RUFFbkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztFQUM3RSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Ozs7Ozs7O0dBUVo7O0NBRUQsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsVUFBVSxRQUFRLEdBQUc7O0tBRS9DLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDOztFQUU1QixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDOztHQUV0Qjs7Q0FFRCxTQUFTLFFBQVEsRUFBRSxRQUFRLEdBQUc7O0VBRTdCLElBQUksU0FBUyxHQUFHLFFBQVEsSUFBSSxFQUFFO0dBQzdCLEFBQ0EsUUFBUTtHQUNSLFFBQVE7R0FDUixLQUFLO0dBQ0wsVUFBVTtHQUNWLGdCQUFnQjtHQUNoQixxQkFBcUI7R0FDckIsS0FBSztTQUNDLFFBQVE7R0FDZCxTQUFTLEdBQUcsRUFBRTtHQUNkLFVBQVUsR0FBRyxFQUFFO0dBQ2YsV0FBVyxHQUFHLENBQUM7R0FDZix1QkFBdUIsR0FBRyxDQUFDO0dBQzNCLEFBQ0EsK0JBQStCLEdBQUcsRUFBRTtHQUNwQyxVQUFVLEdBQUcsS0FBSztTQUNaLFNBQVMsR0FBRyxFQUFFLENBQUM7O0VBRXRCLFNBQVMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUM7RUFDaEQsU0FBUyxDQUFDLGdCQUFnQixHQUFHLENBQUMsS0FBSyxTQUFTLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxFQUFFLENBQUM7RUFDckUsUUFBUSxHQUFHLFNBQVMsQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDO0VBQ3RDLFFBQVEsR0FBRyxTQUFTLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQztFQUN0QyxTQUFTLENBQUMsSUFBSSxHQUFHLE1BQU0sR0FBRyxTQUFTLENBQUMsU0FBUyxFQUFFO0VBQy9DLFNBQVMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUM7RUFDL0MsU0FBUyxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQztFQUNqRCxTQUFTLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDOztFQUUvQyxJQUFJLFlBQVksR0FBRyxRQUFRLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDO0VBQ25ELFlBQVksQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQztFQUN6QyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxFQUFDO0VBQ3BELFlBQVksQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQztFQUM3QyxZQUFZLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxZQUFXO0VBQzNDLFlBQVksQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLE9BQU07RUFDcEMsWUFBWSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBSztFQUNsQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7RUFDakMsWUFBWSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsT0FBTTtFQUNsQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsWUFBWSxFQUFFLENBQUM7O0VBRWxFLElBQUksZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUUsQ0FBQztFQUMxRCxJQUFJLGFBQWEsR0FBRyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLENBQUM7RUFDeEQsSUFBSSxnQkFBZ0IsQ0FBQztFQUNyQixJQUFJLFNBQVMsQ0FBQzs7RUFFZCxJQUFJLEVBQUUsaUJBQWlCLEdBQUcsU0FBUyxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQzs7S0FFL0MsSUFBSSxTQUFTLEdBQUc7R0FDbEIsR0FBRyxFQUFFLFlBQVk7R0FDakIsSUFBSSxFQUFFLGFBQWE7R0FDbkIsWUFBWSxFQUFFLHFCQUFxQjtHQUNuQyxHQUFHLEVBQUUsWUFBWTtHQUNqQixHQUFHLEVBQUUsYUFBYTtHQUNsQixvQkFBb0IsRUFBRSxlQUFlO01BQ2xDLENBQUM7O0tBRUYsSUFBSSxJQUFJLEdBQUcsU0FBUyxFQUFFLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztLQUN6QyxLQUFLLENBQUMsSUFBSSxHQUFHO0dBQ2YsTUFBTSx3REFBd0QsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztNQUNoRztLQUNELFFBQVEsR0FBRyxJQUFJLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQztLQUNqQyxRQUFRLENBQUMsSUFBSSxHQUFHLE1BQUs7O0VBRXhCLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0tBQzlCLFFBQVEsQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDOztLQUVuQyxJQUFJLGFBQWEsSUFBSSxNQUFNLElBQUksS0FBSyxFQUFFO01BQ3JDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO01BQ3hCOztFQUVKLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxZQUFZO0dBQ25DLE9BQU8sSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztHQUM1QixDQUFDLENBQUM7O0VBRUgsSUFBSSxLQUFLLElBQUksTUFBTSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUM7O0dBRXhDLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQzs7R0FFM0IsSUFBSSxXQUFXLENBQUMsTUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDO0lBQzVELFNBQVMsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLGdCQUFlO0lBQzlDOztHQUVELE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxHQUFHLFNBQVMsR0FBRyxFQUFFO0lBQ3RDLE9BQU8sSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQztLQUM5QjtHQUNEOztFQUVELElBQUksY0FBYyxHQUFHLE1BQU0sQ0FBQyxVQUFVO0dBQ3JDLGVBQWUsR0FBRyxNQUFNLENBQUMsV0FBVztPQUNoQyxpQkFBaUIsR0FBRyxNQUFNLENBQUMsYUFBYTtHQUM1QyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsWUFBWTtHQUN0Qyx5QkFBeUIsR0FBRyxNQUFNLENBQUMscUJBQXFCO0dBQ3hELE9BQU8sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUc7R0FDekIsa0JBQWtCLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHO0dBQzNDLFdBQVcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUM7OztFQUc3QyxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7O0VBRWYsU0FBUyxLQUFLLEdBQUc7O0dBRWhCLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxDQUFDOztHQUV6QixVQUFVLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztHQUMvQixLQUFLLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUM7R0FDekMscUJBQXFCLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztHQUNqRCxnQkFBZ0IsR0FBRyxxQkFBcUIsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDOztHQUUvRCxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEdBQUcsVUFBVTtJQUN6QyxPQUFPLEtBQUssQ0FBQztJQUNiLENBQUM7R0FDRixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxXQUFXO0lBQzVCLE9BQU8sS0FBSyxDQUFDO0lBQ2IsQ0FBQzs7R0FFRixNQUFNLENBQUMsVUFBVSxHQUFHLFVBQVUsUUFBUSxFQUFFLElBQUksR0FBRztJQUM5QyxJQUFJLENBQUMsR0FBRztLQUNQLFFBQVEsRUFBRSxRQUFRO0tBQ2xCLElBQUksRUFBRSxJQUFJO0tBQ1YsV0FBVyxFQUFFLEtBQUssR0FBRyxJQUFJO0tBQ3pCLENBQUM7SUFDRixTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ3BCLElBQUksRUFBRSxpQkFBaUIsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7YUFDMUIsT0FBTyxDQUFDLENBQUM7SUFDbEIsQ0FBQztHQUNGLE1BQU0sQ0FBQyxZQUFZLEdBQUcsVUFBVSxFQUFFLEdBQUc7SUFDcEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEdBQUc7S0FDM0MsSUFBSSxTQUFTLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHO01BQzFCLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO01BQ3pCLElBQUksRUFBRSxpQkFBaUIsRUFBRSxDQUFDO01BQzFCLFNBQVM7TUFDVDtLQUNEO0lBQ0QsQ0FBQztHQUNGLE1BQU0sQ0FBQyxXQUFXLEdBQUcsVUFBVSxRQUFRLEVBQUUsSUFBSSxHQUFHO0lBQy9DLElBQUksQ0FBQyxHQUFHO0tBQ1AsUUFBUSxFQUFFLFFBQVE7S0FDbEIsSUFBSSxFQUFFLElBQUk7S0FDVixXQUFXLEVBQUUsS0FBSyxHQUFHLElBQUk7S0FDekIsQ0FBQztJQUNGLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7SUFDckIsSUFBSSxFQUFFLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNwQyxPQUFPLENBQUMsQ0FBQztJQUNULENBQUM7R0FDRixNQUFNLENBQUMsYUFBYSxHQUFHLFVBQVUsRUFBRSxHQUFHO0lBQ3JDLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxDQUFDO0lBQ3pCLE9BQU8sSUFBSSxDQUFDO0lBQ1osQ0FBQztHQUNGLE1BQU0sQ0FBQyxxQkFBcUIsR0FBRyxVQUFVLFFBQVEsR0FBRztJQUNuRCwrQkFBK0IsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7SUFDakQsQ0FBQztHQUNGLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxHQUFHLFVBQVU7SUFDbEMsT0FBTyxnQkFBZ0IsQ0FBQztJQUN4QixDQUFDOztHQUVGLFNBQVMsZUFBZSxHQUFHO0lBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHO0tBQ25CLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0tBQ3BCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQUM7S0FDekMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0tBQ2IsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQztLQUNuQjtJQUNELE9BQU8sSUFBSSxDQUFDLFdBQVcsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDO0lBQzlDO0dBRUQsSUFBSTtJQUNILE1BQU0sQ0FBQyxjQUFjLEVBQUUsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLGFBQWEsRUFBRSxFQUFFLEdBQUcsRUFBRSxlQUFlLEVBQUUsR0FBRTtJQUM1RixNQUFNLENBQUMsY0FBYyxFQUFFLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsRUFBRSxHQUFHLEVBQUUsZUFBZSxFQUFFLEdBQUU7SUFDNUYsQ0FBQyxPQUFPLEdBQUcsRUFBRTtJQUNiLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNWOztHQUVEOztFQUVELFNBQVMsTUFBTSxHQUFHO0dBQ2pCLEtBQUssRUFBRSxDQUFDO0dBQ1IsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO0dBQ2pCLFVBQVUsR0FBRyxJQUFJLENBQUM7R0FDbEI7O0VBRUQsU0FBUyxLQUFLLEdBQUc7R0FDaEIsVUFBVSxHQUFHLEtBQUssQ0FBQztHQUNuQixRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7R0FDaEIsUUFBUSxFQUFFLENBQUM7R0FDWDs7RUFFRCxTQUFTLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHO0dBQ3ZCLGNBQWMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0dBQzNCOztFQUVELFNBQVMsS0FBSyxHQUFHOztHQUVoQixLQUFLLEVBQUUsUUFBUSxFQUFFLENBQUM7R0FDbEI7O0VBRUQsU0FBUyxRQUFRLEdBQUc7R0FDbkIsSUFBSSxFQUFFLGVBQWUsRUFBRSxDQUFDO0dBQ3hCLE1BQU0sQ0FBQyxVQUFVLEdBQUcsY0FBYyxDQUFDO0dBQ25DLE1BQU0sQ0FBQyxXQUFXLEdBQUcsZUFBZSxDQUFDO0dBQ3JDLE1BQU0sQ0FBQyxhQUFhLEdBQUcsaUJBQWlCLENBQUM7R0FDekMsTUFBTSxDQUFDLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQztHQUN2QyxNQUFNLENBQUMscUJBQXFCLEdBQUcseUJBQXlCLENBQUM7R0FDekQsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLFdBQVcsQ0FBQztHQUM1QyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUM7R0FDMUIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEdBQUcsa0JBQWtCLENBQUM7R0FDNUM7O0VBRUQsU0FBUyxXQUFXLEdBQUc7R0FDdEIsSUFBSSxPQUFPLEdBQUcsV0FBVyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUM7R0FDaEQsSUFBSSxFQUFFLFNBQVMsQ0FBQyxVQUFVLElBQUksV0FBVyxJQUFJLFNBQVMsQ0FBQyxVQUFVLFFBQVEsU0FBUyxDQUFDLFNBQVMsSUFBSSxPQUFPLElBQUksU0FBUyxDQUFDLFNBQVMsRUFBRSxHQUFHO0lBQ2xJLEtBQUssRUFBRSxDQUFDO0lBQ1IsS0FBSyxFQUFFLENBQUM7SUFDUjtHQUNELElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDO0dBQ3pCLENBQUMsQ0FBQyxVQUFVLEVBQUUsT0FBTyxFQUFFLENBQUM7R0FDeEIsSUFBSSxTQUFTLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxHQUFHO0lBQ3BDLFlBQVksQ0FBQyxXQUFXLEdBQUcsV0FBVyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxHQUFHLFdBQVcsR0FBRyxXQUFXLEdBQUcsdUJBQXVCLEdBQUcsWUFBWSxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQzFLLE1BQU07SUFDTixZQUFZLENBQUMsV0FBVyxHQUFHLFdBQVcsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLEtBQUssR0FBRyxXQUFXLEdBQUcsWUFBWSxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ2xJO0dBQ0Q7O0VBRUQsU0FBUyxXQUFXLEVBQUUsTUFBTSxHQUFHOztHQUU5QixJQUFJLGdCQUFnQixDQUFDLEtBQUssS0FBSyxNQUFNLENBQUMsS0FBSyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsTUFBTSxHQUFHO0lBQzFGLGdCQUFnQixDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQ3RDLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ3hDLGdCQUFnQixHQUFHLElBQUksV0FBVyxFQUFFLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxnQkFBZ0IsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUM7SUFDM0YsYUFBYSxDQUFDLFNBQVMsR0FBRyxLQUFJO0lBQzlCLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDaEY7O0dBRUQ7O0VBRUQsU0FBUyxXQUFXLEVBQUUsTUFBTSxHQUFHOzs7O0dBSTlCLGFBQWEsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztHQUN4QyxTQUFTLEdBQUcsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztHQUNoRyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUc7SUFDcEQsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQztJQUM3QyxnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7SUFDckQsZ0JBQWdCLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQ3JEO0dBQ0QsdUJBQXVCLEVBQUUsQ0FBQzs7R0FFMUI7O0VBRUQsU0FBUyxVQUFVLEVBQUU7O0dBRXBCLElBQUksSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUM7R0FDMUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHO0lBQ3BELElBQUksRUFBRSxDQUFDLEVBQUUsR0FBRyxnQkFBZ0IsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDLGdCQUFnQixDQUFDO0lBQ25FLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsZ0JBQWdCLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7SUFDM0UsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQztJQUMzRTtHQUNELGFBQWEsQ0FBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztHQUM5QyxRQUFRLENBQUMsR0FBRyxFQUFFLGdCQUFnQixFQUFFLENBQUM7R0FDakMsV0FBVyxFQUFFLENBQUM7R0FDZCx1QkFBdUIsR0FBRyxDQUFDLENBQUM7R0FDNUIsSUFBSSxFQUFFLGlCQUFpQixHQUFHLFdBQVcsR0FBRyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7R0FDdkQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHO0lBQ3BELGdCQUFnQixFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUMxQixnQkFBZ0IsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzlCLGdCQUFnQixFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDOUI7R0FDRCxFQUFFLEVBQUUsQ0FBQzs7R0FFTDs7RUFFRCxTQUFTLFFBQVEsRUFBRSxNQUFNLEdBQUc7O0dBRTNCLElBQUksVUFBVSxHQUFHOztJQUVoQixJQUFJLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLEdBQUc7O0tBRXBDLFdBQVcsRUFBRSxNQUFNLEVBQUUsQ0FBQztLQUN0QixXQUFXLEVBQUUsTUFBTSxFQUFFLENBQUM7O0tBRXRCLElBQUksdUJBQXVCLElBQUksRUFBRSxHQUFHLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRztNQUNoRSxVQUFVLEVBQUUsQ0FBQztNQUNiLE1BQU07TUFDTixLQUFLLEVBQUUsQ0FBQztNQUNSOztLQUVELE1BQU07S0FDTixRQUFRLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxDQUFDO0tBQ3ZCLFdBQVcsRUFBRSxDQUFDO0tBQ2QsSUFBSSxFQUFFLGNBQWMsR0FBRyxXQUFXLEVBQUUsQ0FBQztLQUNyQzs7SUFFRDs7R0FFRDs7RUFFRCxTQUFTLFFBQVEsR0FBRzs7R0FFbkIsSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUM7R0FDdEMsSUFBSSxFQUFFLEdBQUcsRUFBRSxXQUFXLEdBQUcsdUJBQXVCLEdBQUcsU0FBUyxDQUFDLGdCQUFnQixLQUFLLElBQUksQ0FBQzs7R0FFdkYsS0FBSyxHQUFHLFVBQVUsR0FBRyxFQUFFLENBQUM7R0FDeEIsZ0JBQWdCLEdBQUcscUJBQXFCLEdBQUcsRUFBRSxDQUFDOztHQUU5QyxLQUFLLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxHQUFHO0lBQzVCLENBQUMsQ0FBQyxXQUFXLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztJQUMxQixFQUFFLENBQUM7O0dBRUosV0FBVyxFQUFFLENBQUM7R0FDZCxJQUFJLEVBQUUsU0FBUyxHQUFHLFdBQVcsR0FBRyxHQUFHLEdBQUcsdUJBQXVCLEVBQUUsQ0FBQzs7R0FFaEUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEdBQUc7SUFDM0MsSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLFdBQVcsR0FBRztLQUN6QyxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsR0FBRTs7S0FFaEMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7S0FDekIsU0FBUztLQUNUO0lBQ0Q7O0dBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEdBQUc7SUFDNUMsSUFBSSxLQUFLLElBQUksVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLFdBQVcsR0FBRztLQUMxQyxLQUFLLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDO0tBQ2xDLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxXQUFXLElBQUksVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQzs7S0FFcEQsU0FBUztLQUNUO0lBQ0Q7O0dBRUQsK0JBQStCLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxHQUFHO1FBQ25ELEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxHQUFHLFdBQVcsRUFBRSxDQUFDO1VBQy9CLEVBQUUsQ0FBQztTQUNKLCtCQUErQixHQUFHLEVBQUUsQ0FBQzs7R0FFM0M7O0VBRUQsU0FBUyxLQUFLLEVBQUUsUUFBUSxHQUFHOztHQUUxQixJQUFJLENBQUMsUUFBUSxHQUFHO0lBQ2YsUUFBUSxHQUFHLFVBQVUsSUFBSSxHQUFHO0tBQzNCLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztLQUM1RSxPQUFPLEtBQUssQ0FBQztNQUNiO0lBQ0Q7R0FDRCxRQUFRLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDOztHQUUxQjs7RUFFRCxTQUFTLElBQUksRUFBRSxPQUFPLEdBQUc7R0FDeEIsSUFBSSxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsQ0FBQztHQUN0Qzs7S0FFRSxTQUFTLEdBQUcsRUFBRSxLQUFLLEVBQUUsT0FBTyxHQUFHOztTQUUzQixTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDOztNQUU5Qjs7S0FFRCxTQUFTLEtBQUssRUFBRSxLQUFLLEdBQUc7O1NBRXBCLElBQUksT0FBTyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUMvQixLQUFLLE9BQU8sR0FBRzs7YUFFWCxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7O1VBRXJFOztNQUVKOztLQUVELFNBQVMsU0FBUyxFQUFFLFFBQVEsR0FBRzs7U0FFM0IsS0FBSyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsQ0FBQzs7TUFFakM7O0VBRUosT0FBTztHQUNOLEtBQUssRUFBRSxNQUFNO0dBQ2IsT0FBTyxFQUFFLFFBQVE7R0FDakIsSUFBSSxFQUFFLEtBQUs7R0FDWCxJQUFJLEVBQUUsS0FBSztTQUNMLEVBQUUsRUFBRSxHQUFHO0dBQ2I7RUFDRDs7Q0FFRCxDQUFDLFVBQVUsSUFBSSxRQUFRLElBQUksRUFBRSxFQUFFLFFBQVEsR0FBRyxRQUFRLENBQUM7OztHQUdqRCxJQUFJLE9BQU9DLFNBQU0sSUFBSSxVQUFVLElBQUksT0FBT0EsU0FBTSxDQUFDLEdBQUcsSUFBSSxRQUFRLElBQUlBLFNBQU0sQ0FBQyxHQUFHLEVBQUU7OztLQUc5RUEsU0FBTSxDQUFDLFdBQVc7TUFDakIsT0FBTyxRQUFRLENBQUM7TUFDaEIsQ0FBQyxDQUFDO0VBQ047O1FBRU0sSUFBSSxXQUFXLElBQUksVUFBVSxFQUFFOztLQUVsQyxJQUFJLGFBQWEsRUFBRTtNQUNsQixDQUFDLFVBQVUsQ0FBQyxPQUFPLEdBQUcsUUFBUSxFQUFFLFFBQVEsR0FBRyxRQUFRLENBQUM7TUFDcEQ7O0tBRUQsV0FBVyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7RUFDbkM7TUFDSTs7S0FFRCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztFQUM1Qjs7RUFFQSxFQUFFLEVBQUU7OztDQ3A5Qkw7Q0FDQTtDQUNBO0NBQ0E7O0NBRUEsSUFBSSxRQUFRLEdBQUc7O0NBRWYsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyx3QkFBd0I7Q0FDM0MsQ0FBQyxLQUFLLEVBQUUsRUFBRSxZQUFZOztDQUV0QixFQUFFLElBQUk7O0NBRU4sR0FBRyxJQUFJLE1BQU0sR0FBRyxRQUFRLENBQUMsYUFBYSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksTUFBTSxDQUFDLHFCQUFxQixNQUFNLE1BQU0sQ0FBQyxVQUFVLEVBQUUsT0FBTyxFQUFFLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxvQkFBb0IsRUFBRSxFQUFFLEVBQUUsQ0FBQzs7Q0FFaEwsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHOztDQUVoQixHQUFHLE9BQU8sS0FBSyxDQUFDOztDQUVoQixHQUFHOztDQUVILEVBQUUsSUFBSTtDQUNOLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsTUFBTTtDQUMxQixDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsSUFBSSxJQUFJLE1BQU0sQ0FBQyxVQUFVLElBQUksTUFBTSxDQUFDLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSTs7Q0FFNUUsQ0FBQyxvQkFBb0IsRUFBRSxZQUFZOztDQUVuQyxFQUFFLElBQUksT0FBTyxHQUFHLFFBQVEsQ0FBQyxhQUFhLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDaEQsRUFBRSxPQUFPLENBQUMsRUFBRSxHQUFHLHFCQUFxQixDQUFDO0NBQ3JDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsV0FBVyxDQUFDO0NBQ3pDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDO0NBQ2xDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsUUFBUSxDQUFDO0NBQ3RDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDO0NBQ3JDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDO0NBQ3BDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDO0NBQy9CLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0NBQ2xDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO0NBQy9CLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDO0NBQ2hDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDOztDQUV0QyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHOztDQUV0QixHQUFHLE9BQU8sQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLHFCQUFxQixHQUFHO0NBQ3RELElBQUksd0pBQXdKO0NBQzVKLElBQUkscUZBQXFGO0NBQ3pGLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUc7Q0FDcEIsSUFBSSxpSkFBaUo7Q0FDckosSUFBSSxxRkFBcUY7Q0FDekYsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQzs7Q0FFbEIsR0FBRzs7Q0FFSCxFQUFFLE9BQU8sT0FBTyxDQUFDOztDQUVqQixFQUFFOztDQUVGLENBQUMsa0JBQWtCLEVBQUUsV0FBVyxVQUFVLEdBQUc7O0NBRTdDLEVBQUUsSUFBSSxNQUFNLEVBQUUsRUFBRSxFQUFFLE9BQU8sQ0FBQzs7Q0FFMUIsRUFBRSxVQUFVLEdBQUcsVUFBVSxJQUFJLEVBQUUsQ0FBQzs7Q0FFaEMsRUFBRSxNQUFNLEdBQUcsVUFBVSxDQUFDLE1BQU0sS0FBSyxTQUFTLEdBQUcsVUFBVSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO0NBQy9FLEVBQUUsRUFBRSxHQUFHLFVBQVUsQ0FBQyxFQUFFLEtBQUssU0FBUyxHQUFHLFVBQVUsQ0FBQyxFQUFFLEdBQUcsT0FBTyxDQUFDOztDQUU3RCxFQUFFLE9BQU8sR0FBRyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztDQUM1QyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDOztDQUVsQixFQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLENBQUM7O0NBRWhDLEVBQUU7O0NBRUYsQ0FBQyxDQUFDOztDQ3ZFRjtBQUNBLEFBTUE7Q0FDQSxTQUFTLG1CQUFtQixDQUFDLFNBQVMsR0FBRyxJQUFJLEVBQUUsYUFBYSxHQUFHLElBQUksQ0FBQztDQUNwRSxDQUFDLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDO0NBQ3hCLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7Q0FDNUIsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLElBQUksYUFBYSxLQUFLLElBQUksRUFBQzs7Q0FFbkQsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsa0JBQWtCLEVBQUUsQ0FBQzs7Q0FFbEQsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDO0NBQzVDLEVBQUUsSUFBSSxFQUFFLEVBQUU7Q0FDVixFQUFFLEdBQUcsRUFBRSxLQUFLOztDQUVaO0NBQ0EsRUFBRSxHQUFHLEVBQUUsRUFBRTtDQUNULEVBQUUsTUFBTSxFQUFFLENBQUM7Q0FDWDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxJQUFJLENBQUMsQ0FBQzs7Q0FFTixDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLENBQUM7Q0FDeEc7O0NBRUEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztDQUNwQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7OztDQUc5QztDQUNBOzs7Q0FHQTtDQUNBLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQzs7Q0FFaEMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Q0FDN0IsQ0FBQyxJQUFJLGVBQWUsR0FBRyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztDQUMxQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUM7Q0FDN0IsRUFBRSxlQUFlLENBQUMsUUFBUSxDQUFDLEdBQUcsYUFBYSxDQUFDO0NBQzVDLEVBQUU7Q0FDRixDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxLQUFLLENBQUMsYUFBYSxFQUFFLGVBQWUsRUFBRSxDQUFDO0NBQzVELENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Q0FDeEQsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO0NBQzNGLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0NBQzdEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDOztDQUVwRCxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0NBQ3BCLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7O0NBRXRCLENBQUMsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUM7Q0FDNUIsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQyxhQUFhLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDbkQsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDO0NBQ3pELEVBQUU7O0NBRUYsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDOUYsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDMUYsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDL0YsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7O0NBRTNGLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQzs7Q0FFNUU7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQzs7Q0FFcEUsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDOztDQUVoQyxDQUFDLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDO0NBQzNCLENBQUM7O0NBRUQsbUJBQW1CLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxXQUFXO0NBQ3RELENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0NBQ3ZDLENBQUMsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUM7Q0FDNUIsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Q0FDOUMsRUFBRTs7Q0FFRixDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztDQUNuQixFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztDQUNmLEVBQUU7Q0FDRixFQUFDO0NBQ0QsbUJBQW1CLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxVQUFVO0NBQ2hELENBQUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUM7Q0FDeEMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO0NBQ3BCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7Q0FDakMsRUFBQzs7Q0FFRCxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLFdBQVc7Q0FDdkQsQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztDQUN6QixFQUFDO0NBQ0QsbUJBQW1CLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxXQUFXO0NBQ3BELENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7Q0FDMUIsRUFBQztDQUNELG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsRUFBRSxXQUFXO0NBQzlELENBQUMsSUFBSSxrQkFBa0IsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDO0NBQzlDLENBQUMsS0FBSyxrQkFBa0IsSUFBSSxPQUFPLGtCQUFrQixDQUFDLGtCQUFrQixDQUFDLEtBQUssVUFBVSxHQUFHO0NBQzNGLEVBQUUsa0JBQWtCLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztDQUMxQyxFQUFFO0NBQ0YsRUFBQztDQUNELG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSxXQUFXO0NBQ2hFLENBQUMsSUFBSSx5QkFBeUIsR0FBRyxRQUFRLENBQUMsa0JBQWtCLENBQUM7Q0FDN0QsQ0FBQyxJQUFJLDBCQUEwQixHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUM7Q0FDdEQsQ0FBQyxLQUFLLHlCQUF5QixJQUFJLHlCQUF5QixLQUFLLDBCQUEwQixJQUFJLE9BQU8sUUFBUSxDQUFDLGVBQWUsQ0FBQyxLQUFLLFVBQVUsR0FBRztDQUNqSixFQUFFLFFBQVEsQ0FBQyxlQUFlLEVBQUUsQ0FBQztDQUM3QixFQUFFO0NBQ0YsRUFBQztDQUNELG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDLENBQUM7Q0FDbkQsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ2YsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0NBQ1osRUFBRSxBQUNGLENBQUMsT0FBTyxDQUFDLENBQUM7Q0FDVixFQUFDO0NBQ0QsbUJBQW1CLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxXQUFXO0NBQ3pELENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDO0NBQzdELENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztDQUNsQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztDQUN0QyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7Q0FDM0YsRUFBQztDQUNELG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztDQUNyRSxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLFNBQVMsUUFBUSxDQUFDO0NBQ3pELENBQUMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO0NBQ2xELENBQUMsSUFBSSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUM7Q0FDM0I7Q0FDQSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUNuRCxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztDQUNwRSxFQUFFOztDQUVGLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7O0NBRWpELENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ25ELEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ2hDLEVBQUU7O0NBRUYsQ0FBQyxJQUFJLENBQUMsYUFBYSxHQUFHLFFBQVEsQ0FBQztDQUMvQixDQUFDLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQ3RELEVBQUM7Q0FDRCxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLFNBQVMsVUFBVSxFQUFFLElBQUksQ0FBQztDQUM3RDtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsR0FBRyxVQUFVLElBQUksUUFBUSxDQUFDO0NBQzNCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDdEMsRUFBRSxLQUFLLEdBQUcsVUFBVSxJQUFJLFFBQVEsQ0FBQztDQUNqQyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ3RDLEVBQUUsSUFBSTtDQUNOLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsRUFBQztDQUN0QyxFQUFFO0NBQ0YsRUFBQztDQUNELG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsR0FBRyxTQUFTLFVBQVUsRUFBRSxJQUFJLENBQUM7Q0FDOUU7Q0FDQTtDQUNBLENBQUMsR0FBRyxVQUFVLElBQUksUUFBUSxDQUFDO0NBQzNCLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDckQsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDM0MsRUFBRSxNQUFNLEdBQUcsVUFBVSxJQUFJLFFBQVEsQ0FBQztDQUNsQyxFQUFFLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ3JELEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzNDLEVBQUUsSUFBSTtDQUNOLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBQztDQUMxQyxFQUFFO0NBQ0YsRUFBQztDQUNELG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsbUJBQW1CLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDOztDQUV0RixNQUFNLGdCQUFnQixTQUFTLG1CQUFtQjtDQUNsRDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7O0NBRUEsQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsTUFBTSxHQUFHLENBQUMsRUFBRSxhQUFhLEdBQUcsSUFBSSxDQUFDO0NBQ2pFO0NBQ0EsRUFBRSxLQUFLLENBQUMsU0FBUyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0NBQ2xDLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7Q0FDakIsRUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQztDQUN2QixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsR0FBRyxHQUFHLE1BQU0sQ0FBQztDQUNqQyxFQUFFLElBQUksQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDOztDQUUzQixFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxRQUFRLEVBQUU7Q0FDaEMsR0FBRyxTQUFTLEVBQUUsR0FBRztDQUNqQixHQUFHLE1BQU0sRUFBRSxLQUFLO0NBQ2hCLEdBQUcsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLO0NBQ3ZCO0NBQ0EsR0FBRyxFQUFFLENBQUM7O0NBRU4sRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQzs7Q0FFekIsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQztDQUMzQixFQUFFO0NBQ0YsQ0FBQyxLQUFLLEVBQUU7Q0FDUjtDQUNBLEVBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQ3RELEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU07Q0FDeEMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBTTtDQUN6QyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUM7Q0FDbEQsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDO0NBQ3pDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQztDQUMxQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFNLENBQUM7Q0FDbEQsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsS0FBSyxDQUFDO0NBQ3BELEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDOztDQUVqRCxFQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUNwRCxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUM7Q0FDaEQsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDO0NBQ3ZDLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQztDQUN4QyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUM7Q0FDMUMsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDO0NBQ2hELEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLHVCQUF1QixDQUFDO0NBQ3BFLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDOztDQUUvQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7Q0FDeEIsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztDQUN4QixFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztDQUNoQixFQUFFO0NBQ0YsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO0NBQ2pCLEVBQUUsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQzs7Q0FFeEM7Q0FDQSxFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUNwRCxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztDQUNyRSxHQUFHOztDQUVILEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7O0NBRWxELEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ3BELEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQ2pDLEdBQUc7OztDQUdILEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0NBQ3RCLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsWUFBWSxHQUFHLE1BQU0sQ0FBQzs7Q0FFbEQsRUFBRSxJQUFJLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQztDQUM1QixFQUFFLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQ3ZELEVBQUU7Q0FDRixDQUFDLFlBQVksRUFBRTtDQUNmOztDQUVBLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDOztDQUU1RCxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxlQUFlLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7O0NBRS9FLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDOzs7Q0FHekIsRUFBRSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztDQUMxQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0NBQ3RCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztDQUM5Qzs7Q0FFQSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0NBQzFCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztDQUN4QjtDQUNBLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztDQUN4QixHQUFHO0NBQ0gsRUFBRTtDQUNGLENBQUMsY0FBYyxHQUFHO0NBQ2xCO0NBQ0EsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLElBQUksTUFBTSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUM7Q0FDN0UsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO0NBQ3hCLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Q0FDdEIsR0FBRyxLQUFLLENBQUMsK0NBQStDLENBQUMsQ0FBQztDQUMxRCxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0NBQzFCLEdBQUcsT0FBTztDQUNWLEdBQUc7Q0FDSCxFQUFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztDQUN6QixFQUFFO0NBQ0YsQ0FBQzs7Q0FFRCxTQUFTLFVBQVUsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLEVBQUUsRUFBRSxNQUFNLEdBQUcsQ0FBQyxFQUFFLGFBQWEsR0FBRyxJQUFJLENBQUM7QUFDeEUsQ0FHQSxDQUFDLElBQUksWUFBWSxHQUFHLEtBQUssQ0FBQzs7Q0FFMUI7Q0FDQSxDQUFDLElBQUksTUFBTSxHQUFHLElBQUksZUFBZSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7Q0FDNUQsQ0FBQyxJQUFJLFlBQVksR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDOztDQUV6QyxDQUFDLEdBQUcsWUFBWSxDQUFDLFlBQVksR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFdBQVcsRUFBRSxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFdBQVcsRUFBRSxJQUFJLEdBQUcsQ0FBQzs7Q0FFMUgsQ0FBQyxHQUFHLFlBQVksQ0FBQztDQUNqQixFQUFFLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxhQUFhLENBQUMsQ0FBQztDQUNyRTtDQUNBLEVBQUUsSUFBSTtDQUNOLEVBQUUsT0FBTyxJQUFJLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxhQUFhLENBQUMsQ0FBQztDQUMzRCxFQUFFO0NBQ0YsQ0FBQzs7Q0NyVEQsZUFBZSxLQUFLLENBQUMsUUFBUSxDQUFDO0NBQzlCLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxTQUFTLE9BQU8sRUFBRSxNQUFNLENBQUM7Q0FDN0MsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztDQUN2QyxFQUFFLENBQUMsQ0FBQzs7Q0FFSixDQUFDOztDQ0hELE1BQU0sVUFBVSxTQUFTLFVBQVU7Q0FDbkMsQ0FBQyxXQUFXLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztDQUMxQixFQUFFLEtBQUssRUFBRSxDQUFDO0NBQ1Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQSxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLEdBQUcsT0FBTyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7Q0FDaEUsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxPQUFPLEtBQUssU0FBUyxHQUFHLE9BQU8sQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0NBQ3RFLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVMsR0FBRyxPQUFPLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQzs7Q0FFdkUsRUFBRSxJQUFJLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFDO0NBQ2pDLEVBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxFQUFFLENBQUM7Q0FDM0IsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDOztDQUU3QixFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDOztDQUVyQixFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztDQUNkLEVBQUU7Q0FDRixDQUFDLElBQUksRUFBRTtDQUNQLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztDQUM5QyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Q0FDakIsRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7O0NBRXRCLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztDQUNsSCxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDOztDQUVuRSxFQUFFLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQzs7Q0FFL0IsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDN0IsRUFBRTtDQUNGLENBQUMsWUFBWSxFQUFFO0NBQ2Y7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBLEVBQUUsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDOztDQUV6QixFQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxZQUFZLENBQUMsVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQzs7Q0FFN0U7O0NBRUEsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsSUFBSSxLQUFLLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDO0NBQ3hIO0NBQ0E7O0NBRUEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDOztDQUU5QixFQUFFLElBQUksQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDOztDQUU5QixFQUFFO0NBQ0YsQ0FBQyxNQUFNLEVBQUU7Q0FDVDtDQUNBLEVBQUUsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDO0NBQ2xCLEVBQUUsTUFBTSxJQUFJLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQztDQUM3QixHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0NBQ3RCLEdBQUc7Q0FDSDtDQUNBOztDQUVBLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztDQUMxRCxFQUFFLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztDQUM1QyxFQUFFO0NBQ0YsQ0FBQyxrQkFBa0IsRUFBRTtDQUNyQixFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQzs7Q0FFaEI7Q0FDQSxFQUFFLElBQUksUUFBUSxHQUFHLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDLENBQUM7O0NBRTNGLEVBQUUsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUM7Q0FDN0QsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztDQUM1QixFQUFFLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7O0NBRTdDLEVBQUUsaUJBQWlCLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztDQUN2QyxFQUFFO0NBQ0YsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztDQUM1QixFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO0NBQzFCLEdBQUcsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7Q0FDOUIsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztDQUM3QixHQUFHOztDQUVIOztDQUVBOztDQUVBLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQzs7Q0FFN0QsRUFBRSxHQUFHLENBQUMsS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDL0MsRUFBRSxHQUFHLENBQUMsS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQ2pELEVBQUUsR0FBRyxDQUFDLEtBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQzs7Q0FFakQsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQzs7Q0FFNUI7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7O0NBRUEsRUFBRSxJQUFJLGVBQWUsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQzs7Q0FFOUUsRUFBRSxHQUFHLEVBQUUsZUFBZSxJQUFJLENBQUMsSUFBSSxlQUFlLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUN2RyxHQUFHLEdBQUcsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDdkUsR0FBRyxHQUFHLENBQUMsS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUN6RSxHQUFHLEdBQUcsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQ3pFLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7Q0FDN0IsR0FBRzs7Q0FFSDtDQUNBLEVBQUU7Q0FDRixDQUFDLGlCQUFpQixFQUFFO0NBQ3BCLEVBQUUsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUM7Q0FDN0QsRUFBRSxpQkFBaUIsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0NBQ3ZDLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBQztDQUM5QixFQUFFO0NBQ0YsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUM7Q0FDakI7Q0FDQTtDQUNBLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQy9DLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7Q0FDdEIsRUFBRTtDQUNGLENBQUMsSUFBSSxLQUFLLEVBQUU7Q0FDWixFQUFFLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztDQUNyQixFQUFFO0NBQ0YsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUM7Q0FDckIsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7Q0FDbEMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsR0FBRyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0NBQzFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEdBQUcsT0FBTyxHQUFHLENBQUMsQ0FBQztDQUN0QyxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO0NBQzFCLEVBQUU7Q0FDRixDQUFDLElBQUksT0FBTyxFQUFFO0NBQ2QsRUFBRSxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7Q0FDdkIsRUFBRTtDQUNGLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDO0NBQ2pCLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7Q0FDdEIsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7Q0FDbEMsRUFBRTtDQUNGLENBQUMsSUFBSSxLQUFLLEVBQUU7Q0FDWixFQUFFLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztDQUNyQixFQUFFO0NBQ0YsQ0FBQyxLQUFLLEVBQUU7Q0FDUixFQUFFLE9BQU8sSUFBSSxVQUFVLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Q0FDdkYsRUFBRTtDQUNGLENBQUM7O0NDdEtjLE1BQU0sS0FBSztDQUMxQixDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUM7Q0FDckI7Q0FDQTtDQUNBO0NBQ0E7O0NBRUEsRUFBRSxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVMsR0FBRyxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQUs7Q0FDN0QsRUFBRSxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVMsR0FBRyxRQUFRLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQzs7Q0FFckUsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7O0NBRXpGLEVBQUUsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxLQUFLLFNBQVMsR0FBRyxDQUFDLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQzs7Q0FFckUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMvQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzFDLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOztDQUU3QixFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDMUIsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzFCLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUMxQixFQUFFO0NBQ0YsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDVCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDM0IsRUFBRTtDQUNGLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ1QsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQzNCLEVBQUU7Q0FDRixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNULEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUMzQixFQUFFO0NBQ0YsQ0FBQyxJQUFJLENBQUMsRUFBRTtDQUNSLEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Q0FDOUIsRUFBRTtDQUNGLENBQUMsSUFBSSxDQUFDLEVBQUU7Q0FDUixFQUFFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0NBQzlCLEVBQUU7Q0FDRixDQUFDLElBQUksQ0FBQyxFQUFFO0NBQ1IsRUFBRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztDQUM5QixFQUFFO0NBQ0YsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUM7Q0FDckIsRUFBRSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztDQUMvQixFQUFFLEdBQUcsQ0FBQyxPQUFPLEdBQUcsT0FBTyxD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
