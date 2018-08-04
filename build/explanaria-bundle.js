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

	//hack
	let Math$1 = {clone: clone, lerpVectors: lerpVectors, vectorAdd: vectorAdd, multiplyScalar: multiplyScalar};

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

	function ThreeasyEnvironment(autostart = true){
		this.prev_timestep = 0;
		this.autostart = autostart;

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


		this.renderer = new THREE.WebGLRenderer( { antialias: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.gammaInput = true;
		this.renderer.gammaOutput = true;
		this.renderer.shadowMap.enabled = true;
		this.renderer.vr.enabled = true;
		//create camera, scene, timer, renderer objects
		//craete render object


		
		this.scene = new THREE.Scene();

		this.scene.add(this.camera);

		this.renderer = new THREE.WebGLRenderer( { antialias: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( this.evenify(window.innerWidth),this.evenify(window.innerHeight) );
		this.renderer.setClearColor(new THREE.Color(0xFFFFFF), 1.0);

		this.aspect = window.innerWidth/window.innerHeight;

		this.timeScale = 1;
		this.elapsedTime = 0;

		this.container = document.createElement( 'div' );
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
	}

	ThreeasyEnvironment.prototype.onPageLoad = function() {
		console.log("Threeasy_Setup loaded!");
		document.body.appendChild( this.container );

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

		constructor(autostart, fps=30, length = 5){
			/* fps is evident, autostart is a boolean (by default, true), and length is in s.*/
			super(autostart);
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

	function setupThree(autostart, fps=30, length = 5){
		var is_recording = false;

		//extract record parameter from url
		var params = new URLSearchParams(document.location.search);
		let recordString = params.get("record");

		if(recordString)is_recording = params.get("record").toLowerCase() == "true" || params.get("record").toLowerCase() == "1";

		if(is_recording){
			return new ThreeasyRecorder(autostart, fps, length);
		
		}else{
			return new ThreeasyEnvironment(autostart);
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
				console.warn("WARNING: Horrible hack in effect to change slides. Please replace the pass-an-empty-function thing with somethign that actually resolves properly and does async.");
				self.nextSlideResolveFunction();
			};

		}

		async waitForPageLoad(){
			return new Promise(function(resolve, reject){
				window.addEventListener("load",resolve);
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
		transitionTo(target, toValues, durationMS){
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
	exports.NonDecreasingDirector = NonDecreasingDirector;
	exports.DirectionArrow = DirectionArrow;
	exports.delay = delay;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL0xpbmVPdXRwdXQuanMiLCIuLi9zcmMvanMvUG9pbnQuanMiLCIuLi9zcmMvanMvUG9pbnRPdXRwdXQuanMiLCIuLi9zcmMvanMvVmVjdG9yT3V0cHV0LmpzIiwiLi4vc3JjL2pzL0RpcmVjdG9yLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIFRoZSBiYXNlIGNsYXNzIHRoYXQgZXZlcnl0aGluZyBpbmhlcml0cyBmcm9tLiBcblx0RWFjaCB0aGluZyBkcmF3biB0byB0aGUgc2NyZWVuIGlzIGEgdHJlZS4gRG9tYWlucywgc3VjaCBhcyBFWFAuQXJlYSBvciBFWFAuQXJyYXkgYXJlIHRoZSByb290IG5vZGVzLFxuXHRFWFAuVHJhbnNmb3JtYXRpb24gaXMgY3VycmVudGx5IHRoZSBvbmx5IGludGVybWVkaWF0ZSBub2RlLCBhbmQgdGhlIGxlYWYgbm9kZXMgYXJlIHNvbWUgZm9ybSBvZiBPdXRwdXQgc3VjaCBhc1xuXHRFWFAuTGluZU91dHB1dCBvciBFWFAuUG9pbnRPdXRwdXQsIG9yIEVYUC5WZWN0b3JPdXRwdXQuXG5cblx0QWxsIG9mIHRoZXNlIGNhbiBiZSAuYWRkKCllZCB0byBlYWNoIG90aGVyIHRvIGZvcm0gdGhhdCB0cmVlLCBhbmQgdGhpcyBmaWxlIGRlZmluZXMgaG93IGl0IHdvcmtzLlxuKi9cblxuY2xhc3MgTm9kZXtcblx0Y29uc3RydWN0b3IoKXt9XG5cdGFkZCh0aGluZyl7XG5cdFx0Ly9jaGFpbmFibGUgc28geW91IGNhbiBhLmFkZChiKS5hZGQoYykgdG8gbWFrZSBhLT5iLT5jXG5cdFx0dGhpcy5jaGlsZHJlbi5wdXNoKHRoaW5nKTtcblx0XHR0aGluZy5wYXJlbnQgPSB0aGlzO1xuXHRcdGlmKHRoaW5nLl9vbkFkZCl0aGluZy5fb25BZGQoKTtcblx0XHRyZXR1cm4gdGhpbmc7XG5cdH1cblx0X29uQWRkKCl7fVxuXHRyZW1vdmUodGhpbmcpe1xuXHRcdHZhciBpbmRleCA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZiggdGhpbmcgKTtcblx0XHRpZiAoIGluZGV4ICE9PSAtIDEgKSB7XG5cdFx0XHR0aGluZy5wYXJlbnQgPSBudWxsO1xuXHRcdFx0dGhpcy5jaGlsZHJlbi5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG59XG5cbmNsYXNzIE91dHB1dE5vZGV7IC8vbW9yZSBvZiBhIGphdmEgaW50ZXJmYWNlLCByZWFsbHlcblx0Y29uc3RydWN0b3IoKXt9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXt9XG5cdG9uQWZ0ZXJBY3RpdmF0aW9uKCl7fVxuXHRfb25BZGQoKXt9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGU7XG5leHBvcnQge091dHB1dE5vZGV9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCBOb2RlIGZyb20gJy4vTm9kZS5qcyc7XG5cbmNsYXNzIEVYUEFycmF5IGV4dGVuZHMgTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKnZhciBwb2ludHMgPSBuZXcgRVhQLkFycmF5KHtcblx0XHRkYXRhOiBbWy0xMCwxMF0sXG5cdFx0XHRbMTAsMTBdXVxuXHRcdH0pKi9cblxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZGF0YVwiKTsgLy8gYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LiBhc3N1bWVkIHRvIG9ubHkgY29udGFpbiBvbmUgdHlwZTogZWl0aGVyIG51bWJlcnMgb3IgYXJyYXlzXG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5kYXRhLCBBcnJheSk7XG5cblx0XHQvL0l0J3MgYXNzdW1lZCBhbiBFWFAuQXJyYXkgd2lsbCBvbmx5IHN0b3JlIHRoaW5ncyBzdWNoIGFzIDAsIFswXSwgWzAsMF0gb3IgWzAsMCwwXS4gSWYgYW4gYXJyYXkgdHlwZSBpcyBzdG9yZWQsIHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyBjb250YWlucyB0aGUgLmxlbmd0aCBvZiB0aGF0IGFycmF5LiBPdGhlcndpc2UgaXQncyAwLCBiZWNhdXNlIHBvaW50cyBhcmUgMC1kaW1lbnNpb25hbC5cblx0XHRpZihvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHR0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPSAwO1xuXHRcdH1lbHNlIGlmKG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0dGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID0gb3B0aW9ucy5kYXRhWzBdLmxlbmd0aDtcblx0XHR9ZWxzZXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJEYXRhIGluIGFuIEVYUC5BcnJheSBzaG91bGQgYmUgYSBudW1iZXIgb3IgYW4gYXJyYXkgb2Ygb3RoZXIgdGhpbmdzLCBub3QgXCIgKyBvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IpO1xuXHRcdH1cblxuXG5cdFx0RVhQLlV0aWxzLmFzc2VydChvcHRpb25zLmRhdGFbMF0ubGVuZ3RoICE9IDApOyAvL2Rvbid0IGFjY2VwdCBbW11dLCBkYXRhIG5lZWRzIHRvIGJlIHNvbWV0aGluZyBsaWtlIFtbMSwyXV0uXG5cblx0XHR0aGlzLmRhdGEgPSBvcHRpb25zLmRhdGE7XG5cblx0XHR0aGlzLm51bUl0ZW1zID0gdGhpcy5kYXRhLmxlbmd0aDtcblxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbdGhpcy5kYXRhLmxlbmd0aF07IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdC8vdGhlIG51bWJlciBvZiB0aW1lcyBldmVyeSBjaGlsZCdzIGV4cHIgaXMgY2FsbGVkXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSB0aGlzLml0ZW1EaW1lbnNpb25zLnJlZHVjZSgoc3VtLHkpPT5zdW0qeSlcblxuXHRcdHRoaXMuY2hpbGRyZW4gPSBbXTtcblx0XHR0aGlzLnBhcmVudCA9IG51bGw7XG5cdH1cblx0YWN0aXZhdGUodCl7XG5cdFx0aWYodGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID09IDApe1xuXHRcdFx0Ly9udW1iZXJzIGNhbid0IGJlIHNwcmVhZCB1c2luZyAuLi4gb3BlcmF0b3Jcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5kYXRhLmxlbmd0aDtpKyspe1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaSx0LHRoaXMuZGF0YVtpXSk7XG5cdFx0XHR9XG5cdFx0fWVsc2V7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuZGF0YS5sZW5ndGg7aSsrKXtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGksdCwuLi50aGlzLmRhdGFbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMub25BZnRlckFjdGl2YXRpb24oKTsgLy8gY2FsbCBjaGlsZHJlbiBpZiBuZWNlc3Nhcnlcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblxuXHRcdC8vYnV0IGNhbGwgYWxsIGNoaWxkcmVuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5vbkFmdGVyQWN0aXZhdGlvbigpXG5cdFx0fVxuXHR9XG5cdF9jYWxsQWxsQ2hpbGRyZW4oLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBFWFAuQXJyYXkoe2RhdGE6IEVYUC5VdGlscy5hcnJheUNvcHkodGhpcy5kYXRhKX0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cbn1cblxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdEFycmF5KCl7XG5cdHZhciB4ID0gbmV3IEVYUC5BcnJheSh7ZGF0YTogW1swLDFdLFswLDFdXX0pO1xuXHR2YXIgeSA9IG5ldyBFWFAuVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpOyByZXR1cm4gWzJdfX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSg1MTIpO1xufVxuXG5leHBvcnQge0VYUEFycmF5IGFzIEFycmF5fTtcbiIsImZ1bmN0aW9uIG11bHRpcGx5U2NhbGFyKGMsIGFycmF5KXtcblx0Zm9yKHZhciBpPTA7aTxhcnJheS5sZW5ndGg7aSsrKXtcblx0XHRhcnJheVtpXSAqPSBjO1xuXHR9XG5cdHJldHVybiBhcnJheVxufVxuZnVuY3Rpb24gdmVjdG9yQWRkKHYxLHYyKXtcblx0Zm9yKHZhciBpPTA7aTx2MS5sZW5ndGg7aSsrKXtcblx0XHR2MVtpXSArPSB2MltpXTtcblx0fVxuXHRyZXR1cm4gdjFcbn1cbmZ1bmN0aW9uIGxlcnBWZWN0b3JzKHQsIHAxLCBwMil7XG5cdC8vYXNzdW1lZCB0IGluIFswLDFdXG5cdHJldHVybiB2ZWN0b3JBZGQobXVsdGlwbHlTY2FsYXIodCxwMSksbXVsdGlwbHlTY2FsYXIoMS10LHAyKSk7XG59XG5mdW5jdGlvbiBjbG9uZSh2ZWMpe1xuXHR2YXIgbmV3QXJyID0gbmV3IEFycmF5KHZlYy5sZW5ndGgpO1xuXHRmb3IodmFyIGk9MDtpPHZlYy5sZW5ndGg7aSsrKXtcblx0XHRuZXdBcnJbaV0gPSB2ZWNbaV07XG5cdH1cblx0cmV0dXJuIG5ld0FyclxufVxuXG4vL2hhY2tcbmxldCBNYXRoID0ge2Nsb25lOiBjbG9uZSwgbGVycFZlY3RvcnM6IGxlcnBWZWN0b3JzLCB2ZWN0b3JBZGQ6IHZlY3RvckFkZCwgbXVsdGlwbHlTY2FsYXI6IG11bHRpcGx5U2NhbGFyfTtcblxuZXhwb3J0IHt2ZWN0b3JBZGQsIGxlcnBWZWN0b3JzLCBjbG9uZSwgbXVsdGlwbHlTY2FsYXIsIE1hdGh9O1xuIiwiaW1wb3J0IHtjbG9uZX0gZnJvbSAnLi9tYXRoLmpzJ1xuXG5jbGFzcyBVdGlsc3tcblxuXHRzdGF0aWMgaXNBcnJheSh4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gQXJyYXk7XG5cdH1cblx0c3RhdGljIGFycmF5Q29weSh4KXtcblx0XHRyZXR1cm4geC5zbGljZSgpO1xuXHR9XG5cdHN0YXRpYyBpc0Z1bmN0aW9uKHgpe1xuXHRcdHJldHVybiB4LmNvbnN0cnVjdG9yID09PSBGdW5jdGlvbjtcblx0fVxuXG5cdHN0YXRpYyBhc3NlcnQodGhpbmcpe1xuXHRcdC8vQSBmdW5jdGlvbiB0byBjaGVjayBpZiBzb21ldGhpbmcgaXMgdHJ1ZSBhbmQgaGFsdCBvdGhlcndpc2UgaW4gYSBjYWxsYmFja2FibGUgd2F5LlxuXHRcdGlmKCF0aGluZyl7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIEFzc2VydGlvbiBmYWlsZWQuIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdH1cblx0fVxuXG5cdHN0YXRpYyBhc3NlcnRUeXBlKHRoaW5nLCB0eXBlLCBlcnJvck1zZyl7XG5cdFx0Ly9BIGZ1bmN0aW9uIHRvIGNoZWNrIGlmIHNvbWV0aGluZyBpcyB0cnVlIGFuZCBoYWx0IG90aGVyd2lzZSBpbiBhIGNhbGxiYWNrYWJsZSB3YXkuXG5cdFx0aWYoISh0aGluZy5jb25zdHJ1Y3RvciA9PT0gdHlwZSkpe1xuXHRcdFx0aWYoZXJyb3JNc2cpe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFNvbWV0aGluZyBub3Qgb2YgcmVxdWlyZWQgdHlwZSBcIit0eXBlLm5hbWUrXCIhIFxcblwiK2Vycm9yTXNnK1wiXFxuIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdFx0fWVsc2V7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgU29tZXRoaW5nIG5vdCBvZiByZXF1aXJlZCB0eXBlIFwiK3R5cGUubmFtZStcIiEgU2VlIHRyYWNlYmFjayBmb3IgbW9yZS5cIik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblxuXHRzdGF0aWMgYXNzZXJ0UHJvcEV4aXN0cyh0aGluZywgbmFtZSl7XG5cdFx0aWYoIShuYW1lIGluIHRoaW5nKSl7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFwiK25hbWUrXCIgbm90IHByZXNlbnQgaW4gcmVxdWlyZWQgcHJvcGVydHlcIilcblx0XHR9XG5cdH1cblx0XG5cdHN0YXRpYyBjbG9uZSh2ZWMpe1xuXHRcdHJldHVybiBjbG9uZSh2ZWMpO1xuXHR9XG59XG5cbmV4cG9ydCB7VXRpbHN9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgTm9kZSBmcm9tICcuL05vZGUuanMnO1xuXG5jbGFzcyBBcmVhIGV4dGVuZHMgTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8qdmFyIGF4ZXMgPSBuZXcgRVhQLkFyZWEoe1xuXHRcdGJvdW5kczogW1stMTAsMTBdLFxuXHRcdFx0WzEwLDEwXV1cblx0XHRudW1JdGVtczogMTA7IC8vb3B0aW9uYWwuIEFsdGVybmF0ZWx5IG51bUl0ZW1zIGNhbiB2YXJ5IGZvciBlYWNoIGF4aXM6IG51bUl0ZW1zOiBbMTAsMl1cblx0XHR9KSovXG5cblxuXHRcblx0XHRVdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiYm91bmRzXCIpOyAvLyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXlcblx0XHRVdGlscy5hc3NlcnRUeXBlKG9wdGlvbnMuYm91bmRzLCBBcnJheSk7XG5cdFx0VXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmJvdW5kc1swXSwgQXJyYXksIFwiRm9yIGFuIEFyZWEsIG9wdGlvbnMuYm91bmRzIG11c3QgYmUgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LCBldmVuIGZvciBvbmUgZGltZW5zaW9uIVwiKTsgLy8gaXQgTVVTVCBiZSBtdWx0aWRpbWVuc2lvbmFsXG5cdFx0dGhpcy5udW1EaW1lbnNpb25zID0gb3B0aW9ucy5ib3VuZHMubGVuZ3RoO1xuXG5cdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMuYm91bmRzWzBdLmxlbmd0aCAhPSAwKTsgLy9kb24ndCBhY2NlcHQgW1tdXSwgaXQgbmVlZHMgdG8gYmUgW1sxLDJdXS5cblxuXHRcdHRoaXMuYm91bmRzID0gb3B0aW9ucy5ib3VuZHM7XG5cblx0XHR0aGlzLm51bUl0ZW1zID0gb3B0aW9ucy5udW1JdGVtcyB8fCAxNjtcblxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbXTsgLy8gYXJyYXkgdG8gc3RvcmUgdGhlIG51bWJlciBvZiB0aW1lcyB0aGlzIGlzIGNhbGxlZCBwZXIgZGltZW5zaW9uLlxuXG5cdFx0aWYodGhpcy5udW1JdGVtcy5jb25zdHJ1Y3RvciA9PT0gTnVtYmVyKXtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1EaW1lbnNpb25zO2krKyl7XG5cdFx0XHRcdHRoaXMuaXRlbURpbWVuc2lvbnMucHVzaCh0aGlzLm51bUl0ZW1zKTtcblx0XHRcdH1cblx0XHR9ZWxzZSBpZih0aGlzLm51bUl0ZW1zLmNvbnN0cnVjdG9yID09PSBBcnJheSl7XG5cdFx0XHRVdGlscy5hc3NlcnQob3B0aW9ucy5udW1JdGVtcy5sZW5ndGggPT0gb3B0aW9ucy5ib3VuZHMubGVuZ3RoKTtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1EaW1lbnNpb25zO2krKyl7XG5cdFx0XHRcdHRoaXMuaXRlbURpbWVuc2lvbnMucHVzaCh0aGlzLm51bUl0ZW1zW2ldKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL3RoZSBudW1iZXIgb2YgdGltZXMgZXZlcnkgY2hpbGQncyBleHByIGlzIGNhbGxlZFxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gdGhpcy5pdGVtRGltZW5zaW9ucy5yZWR1Y2UoKHN1bSx5KT0+c3VtKnkpXG5cblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsO1xuXHR9XG5cdGFjdGl2YXRlKHQpe1xuXHRcdC8vVXNlIHRoaXMgdG8gZXZhbHVhdGUgZXhwcigpIGFuZCB1cGRhdGUgdGhlIHJlc3VsdCwgY2FzY2FkZS1zdHlsZS5cblx0XHQvL3RoZSBudW1iZXIgb2YgYm91bmRzIHRoaXMgb2JqZWN0IGhhcyB3aWxsIGJlIHRoZSBudW1iZXIgb2YgZGltZW5zaW9ucy5cblx0XHQvL3RoZSBleHByKClzIGFyZSBjYWxsZWQgd2l0aCBleHByKGksIC4uLltjb29yZGluYXRlc10sIHQpLCBcblx0XHQvL1x0KHdoZXJlIGkgaXMgdGhlIGluZGV4IG9mIHRoZSBjdXJyZW50IGV2YWx1YXRpb24gPSB0aW1lcyBleHByKCkgaGFzIGJlZW4gY2FsbGVkIHRoaXMgZnJhbWUsIHQgPSBhYnNvbHV0ZSB0aW1lc3RlcCAocykpLlxuXHRcdC8vcGxlYXNlIGNhbGwgd2l0aCBhIHQgdmFsdWUgb2J0YWluZWQgZnJvbSBwZXJmb3JtYW5jZS5ub3coKS8xMDAwIG9yIHNvbWV0aGluZyBsaWtlIHRoYXRcblxuXHRcdC8vbm90ZSB0aGUgbGVzcy10aGFuLW9yLWVxdWFsLXRvIGluIHRoZXNlIGxvb3BzXG5cdFx0aWYodGhpcy5udW1EaW1lbnNpb25zID09IDEpe1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2krKyl7XG5cdFx0XHRcdGxldCBjMSA9IHRoaXMuYm91bmRzWzBdWzBdICsgKHRoaXMuYm91bmRzWzBdWzFdLXRoaXMuYm91bmRzWzBdWzBdKSooaS8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKSk7XG5cdFx0XHRcdGxldCBpbmRleCA9IGk7XG5cdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpbmRleCx0LGMxLDAsMCwwKTtcblx0XHRcdH1cblx0XHR9ZWxzZSBpZih0aGlzLm51bURpbWVuc2lvbnMgPT0gMil7XG5cdFx0XHQvL3RoaXMgY2FuIGJlIHJlZHVjZWQgaW50byBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgb3ZlciB0aGUgZmlyc3QgaW5kZXggb2YgdGhpcy5ib3VuZHMsIEkga25vdyBpdFxuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2krKyl7XG5cdFx0XHRcdGxldCBjMSA9IHRoaXMuYm91bmRzWzBdWzBdICsgKHRoaXMuYm91bmRzWzBdWzFdLXRoaXMuYm91bmRzWzBdWzBdKSooaS8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKSk7XG5cdFx0XHRcdGZvcih2YXIgaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtqKyspe1xuXHRcdFx0XHRcdGxldCBjMiA9IHRoaXMuYm91bmRzWzFdWzBdICsgKHRoaXMuYm91bmRzWzFdWzFdLXRoaXMuYm91bmRzWzFdWzBdKSooai8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKSk7XG5cdFx0XHRcdFx0bGV0IGluZGV4ID0gaSp0aGlzLml0ZW1EaW1lbnNpb25zWzFdICsgajtcblx0XHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSxjMiwwLDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1EaW1lbnNpb25zID09IDMpe1xuXHRcdFx0Ly90aGlzIGNhbiBiZSByZWR1Y2VkIGludG8gYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIG92ZXIgdGhlIGZpcnN0IGluZGV4IG9mIHRoaXMuYm91bmRzLCBJIGtub3cgaXRcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRmb3IodmFyIGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aisrKXtcblx0XHRcdFx0XHRsZXQgYzIgPSB0aGlzLmJvdW5kc1sxXVswXSArICh0aGlzLmJvdW5kc1sxXVsxXS10aGlzLmJvdW5kc1sxXVswXSkqKGovKHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSkpO1xuXHRcdFx0XHRcdGZvcih2YXIgaz0wO2s8dGhpcy5pdGVtRGltZW5zaW9uc1syXTtrKyspe1xuXHRcdFx0XHRcdFx0bGV0IGMzID0gdGhpcy5ib3VuZHNbMl1bMF0gKyAodGhpcy5ib3VuZHNbMl1bMV0tdGhpcy5ib3VuZHNbMl1bMF0pKihrLyh0aGlzLml0ZW1EaW1lbnNpb25zWzJdLTEpKTtcblx0XHRcdFx0XHRcdGxldCBpbmRleCA9IChpKnRoaXMuaXRlbURpbWVuc2lvbnNbMV0gKyBqKSp0aGlzLml0ZW1EaW1lbnNpb25zWzJdICsgaztcblx0XHRcdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpbmRleCx0LGMxLGMyLGMzLDApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1lbHNle1xuXHRcdFx0YXNzZXJ0KFwiVE9ETzogVXNlIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSB0byBsb29wIG92ZXIgYWxsIGluZGljZXMhXCIpO1xuXHRcdH1cblxuXHRcdHRoaXMub25BZnRlckFjdGl2YXRpb24oKTsgLy8gY2FsbCBjaGlsZHJlbiBpZiBuZWNlc3Nhcnlcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblxuXHRcdC8vYnV0IGNhbGwgYWxsIGNoaWxkcmVuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5vbkFmdGVyQWN0aXZhdGlvbigpXG5cdFx0fVxuXHR9XG5cdF9jYWxsQWxsQ2hpbGRyZW4oLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBBcmVhKHtib3VuZHM6IFV0aWxzLmFycmF5Q29weSh0aGlzLmJvdW5kcyksIG51bUl0ZW1zOiB0aGlzLm51bUl0ZW1zfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0XHRpZihjbG9uZS5jaGlsZHJlbltpXS5fb25BZGQpY2xvbmUuY2hpbGRyZW5baV0uX29uQWRkKCk7IC8vIG5lY2Vzc2FyeSBub3cgdGhhdCB0aGUgY2hhaW4gb2YgYWRkaW5nIGhhcyBiZWVuIGVzdGFibGlzaGVkXG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0QXJlYSgpe1xuXHR2YXIgeCA9IG5ldyBBcmVhKHtib3VuZHM6IFtbMCwxXSxbMCwxXV19KTtcblx0dmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpfX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSgpO1xufVxuXG5leHBvcnQgeyBBcmVhIH1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQgTm9kZSBmcm9tICcuL05vZGUuanMnO1xuXG4vL1VzYWdlOiB2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSl9fSk7XG5jbGFzcyBUcmFuc2Zvcm1hdGlvbiBleHRlbmRzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cdFxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZXhwclwiKTsgLy8gYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5XG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5leHByLCBGdW5jdGlvbik7XG5cblx0XHR0aGlzLmV4cHIgPSBvcHRpb25zLmV4cHI7XG5cblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsO1xuXHR9XG5cdGV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcyl7XG5cdFx0Ly9ldmFsdWF0ZSB0aGlzIFRyYW5zZm9ybWF0aW9uJ3MgX2V4cHIsIGFuZCBicm9hZGNhc3QgdGhlIHJlc3VsdCB0byBhbGwgY2hpbGRyZW4uXG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMuZXhwciguLi5jb29yZGluYXRlcyk7XG5cdFx0aWYocmVzdWx0LmNvbnN0cnVjdG9yICE9PSBBcnJheSlyZXN1bHQgPSBbcmVzdWx0XTtcblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKGNvb3JkaW5hdGVzWzBdLGNvb3JkaW5hdGVzWzFdLCAuLi5yZXN1bHQpXG5cdFx0fVxuXHR9XG5cdG9uQWZ0ZXJBY3RpdmF0aW9uKCl7XG5cdFx0Ly8gZG8gbm90aGluZ1xuXG5cdFx0Ly9idXQgY2FsbCBhbGwgY2hpbGRyZW5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLm9uQWZ0ZXJBY3RpdmF0aW9uKClcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgdGhpc0V4cHIgPSB0aGlzLmV4cHI7XG5cdFx0bGV0IGNsb25lID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiB0aGlzRXhwci5iaW5kKCl9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cblxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0VHJhbnNmb3JtYXRpb24oKXtcblx0dmFyIHggPSBuZXcgQXJlYSh7Ym91bmRzOiBbWy0xMCwxMF1dfSk7XG5cdHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHsnZXhwcic6ICh4KSA9PiBjb25zb2xlLmxvZyh4KngpfSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKCk7IC8vIHNob3VsZCByZXR1cm4gMTAwLCA4MSwgNjQuLi4gMCwgMSwgNC4uLiAxMDBcbn1cblxuZXhwb3J0IHsgVHJhbnNmb3JtYXRpb24gfVxuIiwiaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuL3V0aWxzLmpzJztcblxuaW1wb3J0IHsgVHJhbnNmb3JtYXRpb24gfSBmcm9tICcuL1RyYW5zZm9ybWF0aW9uLmpzJztcblxuaW1wb3J0ICogYXMgbWF0aCBmcm9tICcuL21hdGguanMnO1xuXG5jbGFzcyBBbmltYXRpb257XG5cdGNvbnN0cnVjdG9yKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uLCBzdGFnZ2VyRnJhY3Rpb24pe1xuXHRcdFV0aWxzLmFzc2VydFR5cGUodG9WYWx1ZXMsIE9iamVjdCk7XG5cblx0XHR0aGlzLnRvVmFsdWVzID0gdG9WYWx1ZXM7XG5cdFx0dGhpcy50YXJnZXQgPSB0YXJnZXQ7XHRcblx0XHR0aGlzLnN0YWdnZXJGcmFjdGlvbiA9IHN0YWdnZXJGcmFjdGlvbiA9PT0gdW5kZWZpbmVkID8gMCA6IHN0YWdnZXJGcmFjdGlvbjsgLy8gdGltZSBpbiBtcyBiZXR3ZWVuIGZpcnN0IGVsZW1lbnQgYmVnaW5uaW5nIHRoZSBhbmltYXRpb24gYW5kIGxhc3QgZWxlbWVudCBiZWdpbm5pbmcgdGhlIGFuaW1hdGlvbi4gU2hvdWxkIGJlIGxlc3MgdGhhbiBkdXJhdGlvbi5cbnJcblxuXHRcdFV0aWxzLmFzc2VydCh0aGlzLnN0YWdnZXJGcmFjdGlvbiA+PSAwICYmIHRoaXMuc3RhZ2dlckZyYWN0aW9uIDwgMSk7XG5cblx0XHR0aGlzLmZyb21WYWx1ZXMgPSB7fTtcblx0XHRmb3IodmFyIHByb3BlcnR5IGluIHRoaXMudG9WYWx1ZXMpe1xuXHRcdFx0VXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyh0aGlzLnRhcmdldCwgcHJvcGVydHkpO1xuXG5cdFx0XHQvL2NvcHkgcHJvcGVydHksIG1ha2luZyBzdXJlIHRvIHN0b3JlIHRoZSBjb3JyZWN0ICd0aGlzJ1xuXHRcdFx0aWYoVXRpbHMuaXNGdW5jdGlvbih0aGlzLnRhcmdldFtwcm9wZXJ0eV0pKXtcblx0XHRcdFx0dGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHRoaXMudGFyZ2V0W3Byb3BlcnR5XS5iaW5kKHRoaXMudGFyZ2V0KTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHR0aGlzLmZyb21WYWx1ZXNbcHJvcGVydHldID0gdGhpcy50YXJnZXRbcHJvcGVydHldO1xuXHRcdFx0fVxuXHRcdH1cblxuXG5cdFx0dGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uID09PSB1bmRlZmluZWQgPyAxIDogZHVyYXRpb247IC8vaW4gc1xuXHRcdHRoaXMuZWxhcHNlZFRpbWUgPSAwO1xuXG5cblx0XHRpZih0YXJnZXQuY29uc3RydWN0b3IgPT09IFRyYW5zZm9ybWF0aW9uKXtcblx0XHRcdC8vZmluZCBvdXQgaG93IG1hbnkgb2JqZWN0cyBhcmUgcGFzc2luZyB0aHJvdWdoIHRoaXMgdHJhbnNmb3JtYXRpb25cblx0XHRcdGxldCByb290ID0gdGFyZ2V0O1xuXHRcdFx0d2hpbGUocm9vdC5wYXJlbnQgIT09IG51bGwpe1xuXHRcdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXHRcdH1lbHNle1xuXHRcdFx0aWYodGhpcy5zdGFnZ2VyRnJhY3Rpb24gIT0gMCl7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJzdGFnZ2VyRnJhY3Rpb24gY2FuIG9ubHkgYmUgdXNlZCB3aGVuIFRyYW5zaXRpb25UbydzIHRhcmdldCBpcyBhbiBFWFAuVHJhbnNmb3JtYXRpb24hXCIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vYmVnaW5cblx0XHR0aGlzLl91cGRhdGVDYWxsYmFjayA9IHRoaXMudXBkYXRlLmJpbmQodGhpcylcblx0XHR0aHJlZS5vbihcInVwZGF0ZVwiLHRoaXMuX3VwZGF0ZUNhbGxiYWNrKTtcblx0fVxuXHR1cGRhdGUodGltZSl7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSB0aW1lLmRlbHRhO1x0XG5cblx0XHRsZXQgcGVyY2VudGFnZSA9IHRoaXMuZWxhcHNlZFRpbWUvdGhpcy5kdXJhdGlvbjtcblxuXHRcdC8vaW50ZXJwb2xhdGUgdmFsdWVzXG5cdFx0Zm9yKGxldCBwcm9wZXJ0eSBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdHRoaXMuaW50ZXJwb2xhdGUocGVyY2VudGFnZSwgcHJvcGVydHksIHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0sdGhpcy50b1ZhbHVlc1twcm9wZXJ0eV0pO1xuXHRcdH1cblxuXHRcdGlmKHRoaXMuZWxhcHNlZFRpbWUgPj0gdGhpcy5kdXJhdGlvbil7XG5cdFx0XHR0aGlzLmVuZCgpO1xuXHRcdH1cblx0fVxuXHRpbnRlcnBvbGF0ZShwZXJjZW50YWdlLCBwcm9wZXJ0eU5hbWUsIGZyb21WYWx1ZSwgdG9WYWx1ZSl7XG5cdFx0Y29uc3QgbnVtT2JqZWN0cyA9IHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXG5cdFx0dmFyIG5ld1ZhbHVlID0gbnVsbDtcblx0XHRpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mKGZyb21WYWx1ZSkgPT09IFwibnVtYmVyXCIpe1xuXHRcdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BlcnR5TmFtZV0gPSB0KnRvVmFsdWUgKyAoMS10KSpmcm9tVmFsdWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXNGdW5jdGlvbih0b1ZhbHVlKSAmJiBVdGlscy5pc0Z1bmN0aW9uKGZyb21WYWx1ZSkpe1xuXHRcdFx0Ly9pZiBzdGFnZ2VyRnJhY3Rpb24gIT0gMCwgaXQncyB0aGUgYW1vdW50IG9mIHRpbWUgYmV0d2VlbiB0aGUgZmlyc3QgcG9pbnQncyBzdGFydCB0aW1lIGFuZCB0aGUgbGFzdCBwb2ludCdzIHN0YXJ0IHRpbWUuXG5cdFx0XHQvL0FTU1VNUFRJT046IHRoZSBmaXJzdCB2YXJpYWJsZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGksIGFuZCBpdCdzIGFzc3VtZWQgaSBpcyB6ZXJvLWluZGV4ZWQuXG5cblx0XHRcdC8vZW5jYXBzdWxhdGUgcGVyY2VudGFnZVxuXHRcdFx0dGhpcy50YXJnZXRbcHJvcGVydHlOYW1lXSA9IChmdW5jdGlvbihpLCAuLi5jb29yZHMpe1xuXHRcdFx0XHRsZXQgbGVycEZhY3RvciA9IHBlcmNlbnRhZ2UvKDEtdGhpcy5zdGFnZ2VyRnJhY3Rpb24pIC0gaSp0aGlzLnN0YWdnZXJGcmFjdGlvbi90aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHRcdFx0Ly9sZXQgcGVyY2VudCA9IE1hdGgubWluKE1hdGgubWF4KHBlcmNlbnRhZ2UgLSBpL3RoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uICAgLDEpLDApO1xuXG5cdFx0XHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24oTWF0aC5tYXgoTWF0aC5taW4obGVycEZhY3RvciwxKSwwKSk7XG5cdFx0XHRcdHJldHVybiBtYXRoLmxlcnBWZWN0b3JzKHQsdG9WYWx1ZShpLCAuLi5jb29yZHMpLGZyb21WYWx1ZShpLCAuLi5jb29yZHMpKVxuXHRcdFx0fSkuYmluZCh0aGlzKTtcblx0XHRcdHJldHVybjtcblx0XHR9ZWxzZXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJBbmltYXRpb24gY2xhc3MgY2Fubm90IHlldCBoYW5kbGUgdHJhbnNpdGlvbmluZyBiZXR3ZWVuIHRoaW5ncyB0aGF0IGFyZW4ndCBudW1iZXJzIG9yIGZ1bmN0aW9ucyFcIik7XG5cdFx0fVxuXG5cdH1cblx0aW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHgpe1xuXHRcdHJldHVybiB0aGlzLmNvc2luZUludGVycG9sYXRpb24oeCk7XG5cdH1cblx0Y29zaW5lSW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4gKDEtTWF0aC5jb3MoeCpNYXRoLlBJKSkvMjtcblx0fVxuXHRsaW5lYXJJbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiB4O1xuXHR9XG5cdGVuZCgpe1xuXHRcdGZvcih2YXIgcHJvcCBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BdID0gdGhpcy50b1ZhbHVlc1twcm9wXTtcblx0XHR9XG5cdFx0dGhyZWUucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInVwZGF0ZVwiLHRoaXMuX3VwZGF0ZUNhbGxiYWNrKTtcblx0XHQvL1RvZG86IGRlbGV0ZSB0aGlzXG5cdH1cbn1cblxuLy90b2RvOiBwdXQgdGhpcyBpbnRvIGEgRGlyZWN0b3IgY2xhc3Mgc28gdGhhdCBpdCBjYW4gaGF2ZSBhbiB1bmRvIHN0YWNrXG5mdW5jdGlvbiBUcmFuc2l0aW9uVG8odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUywgc3RhZ2dlckZyYWN0aW9uKXtcblx0dmFyIGFuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwLCBzdGFnZ2VyRnJhY3Rpb24pO1xufVxuXG5leHBvcnQge1RyYW5zaXRpb25UbywgQW5pbWF0aW9ufVxuIiwiKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIGxvb2t1cCA9IFtcblx0XHRcdCdBJywgJ0InLCAnQycsICdEJywgJ0UnLCAnRicsICdHJywgJ0gnLFxuXHRcdFx0J0knLCAnSicsICdLJywgJ0wnLCAnTScsICdOJywgJ08nLCAnUCcsXG5cdFx0XHQnUScsICdSJywgJ1MnLCAnVCcsICdVJywgJ1YnLCAnVycsICdYJyxcblx0XHRcdCdZJywgJ1onLCAnYScsICdiJywgJ2MnLCAnZCcsICdlJywgJ2YnLFxuXHRcdFx0J2cnLCAnaCcsICdpJywgJ2onLCAnaycsICdsJywgJ20nLCAnbicsXG5cdFx0XHQnbycsICdwJywgJ3EnLCAncicsICdzJywgJ3QnLCAndScsICd2Jyxcblx0XHRcdCd3JywgJ3gnLCAneScsICd6JywgJzAnLCAnMScsICcyJywgJzMnLFxuXHRcdFx0JzQnLCAnNScsICc2JywgJzcnLCAnOCcsICc5JywgJysnLCAnLydcblx0XHRdO1xuXHRmdW5jdGlvbiBjbGVhbihsZW5ndGgpIHtcblx0XHR2YXIgaSwgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKTtcblx0XHRmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdGJ1ZmZlcltpXSA9IDA7XG5cdFx0fVxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHRmdW5jdGlvbiBleHRlbmQob3JpZywgbGVuZ3RoLCBhZGRMZW5ndGgsIG11bHRpcGxlT2YpIHtcblx0XHR2YXIgbmV3U2l6ZSA9IGxlbmd0aCArIGFkZExlbmd0aCxcblx0XHRcdGJ1ZmZlciA9IGNsZWFuKChwYXJzZUludChuZXdTaXplIC8gbXVsdGlwbGVPZikgKyAxKSAqIG11bHRpcGxlT2YpO1xuXG5cdFx0YnVmZmVyLnNldChvcmlnKTtcblxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHRmdW5jdGlvbiBwYWQobnVtLCBieXRlcywgYmFzZSkge1xuXHRcdG51bSA9IG51bS50b1N0cmluZyhiYXNlIHx8IDgpO1xuXHRcdHJldHVybiBcIjAwMDAwMDAwMDAwMFwiLnN1YnN0cihudW0ubGVuZ3RoICsgMTIgLSBieXRlcykgKyBudW07XG5cdH1cblxuXHRmdW5jdGlvbiBzdHJpbmdUb1VpbnQ4IChpbnB1dCwgb3V0LCBvZmZzZXQpIHtcblx0XHR2YXIgaSwgbGVuZ3RoO1xuXG5cdFx0b3V0ID0gb3V0IHx8IGNsZWFuKGlucHV0Lmxlbmd0aCk7XG5cblx0XHRvZmZzZXQgPSBvZmZzZXQgfHwgMDtcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSBpbnB1dC5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0b3V0W29mZnNldF0gPSBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0b2Zmc2V0ICs9IDE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aDtcblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwW251bSA+PiAxOCAmIDB4M0ZdICsgbG9va3VwW251bSA+PiAxMiAmIDB4M0ZdICsgbG9va3VwW251bSA+PiA2ICYgMHgzRl0gKyBsb29rdXBbbnVtICYgMHgzRl07XG5cdFx0fTtcblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pO1xuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKTtcblx0XHR9XG5cblx0XHQvLyB0aGlzIHByZXZlbnRzIGFuIEVSUl9JTlZBTElEX1VSTCBpbiBDaHJvbWUgKEZpcmVmb3ggb2theSlcblx0XHRzd2l0Y2ggKG91dHB1dC5sZW5ndGggJSA0KSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdG91dHB1dCArPSAnPSc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHRvdXRwdXQgKz0gJz09Jztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0O1xuXHR9XG5cblx0d2luZG93LnV0aWxzID0ge31cblx0d2luZG93LnV0aWxzLmNsZWFuID0gY2xlYW47XG5cdHdpbmRvdy51dGlscy5wYWQgPSBwYWQ7XG5cdHdpbmRvdy51dGlscy5leHRlbmQgPSBleHRlbmQ7XG5cdHdpbmRvdy51dGlscy5zdHJpbmdUb1VpbnQ4ID0gc3RyaW5nVG9VaW50ODtcblx0d2luZG93LnV0aWxzLnVpbnQ4VG9CYXNlNjQgPSB1aW50OFRvQmFzZTY0O1xufSgpKTtcblxuKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cbi8qXG5zdHJ1Y3QgcG9zaXhfaGVhZGVyIHsgICAgICAgICAgICAgLy8gYnl0ZSBvZmZzZXRcblx0Y2hhciBuYW1lWzEwMF07ICAgICAgICAgICAgICAgLy8gICAwXG5cdGNoYXIgbW9kZVs4XTsgICAgICAgICAgICAgICAgIC8vIDEwMFxuXHRjaGFyIHVpZFs4XTsgICAgICAgICAgICAgICAgICAvLyAxMDhcblx0Y2hhciBnaWRbOF07ICAgICAgICAgICAgICAgICAgLy8gMTE2XG5cdGNoYXIgc2l6ZVsxMl07ICAgICAgICAgICAgICAgIC8vIDEyNFxuXHRjaGFyIG10aW1lWzEyXTsgICAgICAgICAgICAgICAvLyAxMzZcblx0Y2hhciBjaGtzdW1bOF07ICAgICAgICAgICAgICAgLy8gMTQ4XG5cdGNoYXIgdHlwZWZsYWc7ICAgICAgICAgICAgICAgIC8vIDE1NlxuXHRjaGFyIGxpbmtuYW1lWzEwMF07ICAgICAgICAgICAvLyAxNTdcblx0Y2hhciBtYWdpY1s2XTsgICAgICAgICAgICAgICAgLy8gMjU3XG5cdGNoYXIgdmVyc2lvblsyXTsgICAgICAgICAgICAgIC8vIDI2M1xuXHRjaGFyIHVuYW1lWzMyXTsgICAgICAgICAgICAgICAvLyAyNjVcblx0Y2hhciBnbmFtZVszMl07ICAgICAgICAgICAgICAgLy8gMjk3XG5cdGNoYXIgZGV2bWFqb3JbOF07ICAgICAgICAgICAgIC8vIDMyOVxuXHRjaGFyIGRldm1pbm9yWzhdOyAgICAgICAgICAgICAvLyAzMzdcblx0Y2hhciBwcmVmaXhbMTU1XTsgICAgICAgICAgICAgLy8gMzQ1XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gNTAwXG59O1xuKi9cblxuXHR2YXIgdXRpbHMgPSB3aW5kb3cudXRpbHMsXG5cdFx0aGVhZGVyRm9ybWF0O1xuXG5cdGhlYWRlckZvcm1hdCA9IFtcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZU5hbWUnLFxuXHRcdFx0J2xlbmd0aCc6IDEwMFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVNb2RlJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndWlkJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZ2lkJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZVNpemUnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbXRpbWUnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnY2hlY2tzdW0nLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd0eXBlJyxcblx0XHRcdCdsZW5ndGgnOiAxXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbGlua05hbWUnLFxuXHRcdFx0J2xlbmd0aCc6IDEwMFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3VzdGFyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnb3duZXInLFxuXHRcdFx0J2xlbmd0aCc6IDMyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZ3JvdXAnLFxuXHRcdFx0J2xlbmd0aCc6IDMyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbWFqb3JOdW1iZXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtaW5vck51bWJlcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVuYW1lUHJlZml4Jyxcblx0XHRcdCdsZW5ndGgnOiAxNTVcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdwYWRkaW5nJyxcblx0XHRcdCdsZW5ndGgnOiAxMlxuXHRcdH1cblx0XTtcblxuXHRmdW5jdGlvbiBmb3JtYXRIZWFkZXIoZGF0YSwgY2IpIHtcblx0XHR2YXIgYnVmZmVyID0gdXRpbHMuY2xlYW4oNTEyKSxcblx0XHRcdG9mZnNldCA9IDA7XG5cblx0XHRoZWFkZXJGb3JtYXQuZm9yRWFjaChmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdHZhciBzdHIgPSBkYXRhW3ZhbHVlLmZpZWxkXSB8fCBcIlwiLFxuXHRcdFx0XHRpLCBsZW5ndGg7XG5cblx0XHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHN0ci5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0XHRidWZmZXJbb2Zmc2V0XSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0XHRvZmZzZXQgKz0gMTtcblx0XHRcdH1cblxuXHRcdFx0b2Zmc2V0ICs9IHZhbHVlLmxlbmd0aCAtIGk7IC8vIHNwYWNlIGl0IG91dCB3aXRoIG51bGxzXG5cdFx0fSk7XG5cblx0XHRpZiAodHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRyZXR1cm4gY2IoYnVmZmVyLCBvZmZzZXQpO1xuXHRcdH1cblx0XHRyZXR1cm4gYnVmZmVyO1xuXHR9XG5cblx0d2luZG93LmhlYWRlciA9IHt9XG5cdHdpbmRvdy5oZWFkZXIuc3RydWN0dXJlID0gaGVhZGVyRm9ybWF0O1xuXHR3aW5kb3cuaGVhZGVyLmZvcm1hdCA9IGZvcm1hdEhlYWRlcjtcbn0oKSk7XG5cbihmdW5jdGlvbiAoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBoZWFkZXIgPSB3aW5kb3cuaGVhZGVyLFxuXHRcdHV0aWxzID0gd2luZG93LnV0aWxzLFxuXHRcdHJlY29yZFNpemUgPSA1MTIsXG5cdFx0YmxvY2tTaXplO1xuXG5cdGZ1bmN0aW9uIFRhcihyZWNvcmRzUGVyQmxvY2spIHtcblx0XHR0aGlzLndyaXR0ZW4gPSAwO1xuXHRcdGJsb2NrU2l6ZSA9IChyZWNvcmRzUGVyQmxvY2sgfHwgMjApICogcmVjb3JkU2l6ZTtcblx0XHR0aGlzLm91dCA9IHV0aWxzLmNsZWFuKGJsb2NrU2l6ZSk7XG5cdFx0dGhpcy5ibG9ja3MgPSBbXTtcblx0XHR0aGlzLmxlbmd0aCA9IDA7XG5cdH1cblxuXHRUYXIucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uIChmaWxlcGF0aCwgaW5wdXQsIG9wdHMsIGNhbGxiYWNrKSB7XG5cdFx0dmFyIGRhdGEsXG5cdFx0XHRjaGVja3N1bSxcblx0XHRcdG1vZGUsXG5cdFx0XHRtdGltZSxcblx0XHRcdHVpZCxcblx0XHRcdGdpZCxcblx0XHRcdGhlYWRlckFycjtcblxuXHRcdGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRpbnB1dCA9IHV0aWxzLnN0cmluZ1RvVWludDgoaW5wdXQpO1xuXHRcdH0gZWxzZSBpZiAoaW5wdXQuY29uc3RydWN0b3IgIT09IFVpbnQ4QXJyYXkucHJvdG90eXBlLmNvbnN0cnVjdG9yKSB7XG5cdFx0XHR0aHJvdyAnSW52YWxpZCBpbnB1dCB0eXBlLiBZb3UgZ2F2ZSBtZTogJyArIGlucHV0LmNvbnN0cnVjdG9yLnRvU3RyaW5nKCkubWF0Y2goL2Z1bmN0aW9uXFxzKihbJEEtWmEtel9dWzAtOUEtWmEtel9dKilcXHMqXFwoLylbMV07XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRjYWxsYmFjayA9IG9wdHM7XG5cdFx0XHRvcHRzID0ge307XG5cdFx0fVxuXG5cdFx0b3B0cyA9IG9wdHMgfHwge307XG5cblx0XHRtb2RlID0gb3B0cy5tb2RlIHx8IHBhcnNlSW50KCc3NzcnLCA4KSAmIDB4ZmZmO1xuXHRcdG10aW1lID0gb3B0cy5tdGltZSB8fCBNYXRoLmZsb29yKCtuZXcgRGF0ZSgpIC8gMTAwMCk7XG5cdFx0dWlkID0gb3B0cy51aWQgfHwgMDtcblx0XHRnaWQgPSBvcHRzLmdpZCB8fCAwO1xuXG5cdFx0ZGF0YSA9IHtcblx0XHRcdGZpbGVOYW1lOiBmaWxlcGF0aCxcblx0XHRcdGZpbGVNb2RlOiB1dGlscy5wYWQobW9kZSwgNyksXG5cdFx0XHR1aWQ6IHV0aWxzLnBhZCh1aWQsIDcpLFxuXHRcdFx0Z2lkOiB1dGlscy5wYWQoZ2lkLCA3KSxcblx0XHRcdGZpbGVTaXplOiB1dGlscy5wYWQoaW5wdXQubGVuZ3RoLCAxMSksXG5cdFx0XHRtdGltZTogdXRpbHMucGFkKG10aW1lLCAxMSksXG5cdFx0XHRjaGVja3N1bTogJyAgICAgICAgJyxcblx0XHRcdHR5cGU6ICcwJywgLy8ganVzdCBhIGZpbGVcblx0XHRcdHVzdGFyOiAndXN0YXIgICcsXG5cdFx0XHRvd25lcjogb3B0cy5vd25lciB8fCAnJyxcblx0XHRcdGdyb3VwOiBvcHRzLmdyb3VwIHx8ICcnXG5cdFx0fTtcblxuXHRcdC8vIGNhbGN1bGF0ZSB0aGUgY2hlY2tzdW1cblx0XHRjaGVja3N1bSA9IDA7XG5cdFx0T2JqZWN0LmtleXMoZGF0YSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG5cdFx0XHR2YXIgaSwgdmFsdWUgPSBkYXRhW2tleV0sIGxlbmd0aDtcblxuXHRcdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdFx0Y2hlY2tzdW0gKz0gdmFsdWUuY2hhckNvZGVBdChpKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGRhdGEuY2hlY2tzdW0gPSB1dGlscy5wYWQoY2hlY2tzdW0sIDYpICsgXCJcXHUwMDAwIFwiO1xuXG5cdFx0aGVhZGVyQXJyID0gaGVhZGVyLmZvcm1hdChkYXRhKTtcblxuXHRcdHZhciBoZWFkZXJMZW5ndGggPSBNYXRoLmNlaWwoIGhlYWRlckFyci5sZW5ndGggLyByZWNvcmRTaXplICkgKiByZWNvcmRTaXplO1xuXHRcdHZhciBpbnB1dExlbmd0aCA9IE1hdGguY2VpbCggaW5wdXQubGVuZ3RoIC8gcmVjb3JkU2l6ZSApICogcmVjb3JkU2l6ZTtcblxuXHRcdHRoaXMuYmxvY2tzLnB1c2goIHsgaGVhZGVyOiBoZWFkZXJBcnIsIGlucHV0OiBpbnB1dCwgaGVhZGVyTGVuZ3RoOiBoZWFkZXJMZW5ndGgsIGlucHV0TGVuZ3RoOiBpbnB1dExlbmd0aCB9ICk7XG5cblx0fTtcblxuXHRUYXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBidWZmZXJzID0gW107XG5cdFx0dmFyIGNodW5rcyA9IFtdO1xuXHRcdHZhciBsZW5ndGggPSAwO1xuXHRcdHZhciBtYXggPSBNYXRoLnBvdyggMiwgMjAgKTtcblxuXHRcdHZhciBjaHVuayA9IFtdO1xuXHRcdHRoaXMuYmxvY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBiICkge1xuXHRcdFx0aWYoIGxlbmd0aCArIGIuaGVhZGVyTGVuZ3RoICsgYi5pbnB1dExlbmd0aCA+IG1heCApIHtcblx0XHRcdFx0Y2h1bmtzLnB1c2goIHsgYmxvY2tzOiBjaHVuaywgbGVuZ3RoOiBsZW5ndGggfSApO1xuXHRcdFx0XHRjaHVuayA9IFtdO1xuXHRcdFx0XHRsZW5ndGggPSAwO1xuXHRcdFx0fVxuXHRcdFx0Y2h1bmsucHVzaCggYiApO1xuXHRcdFx0bGVuZ3RoICs9IGIuaGVhZGVyTGVuZ3RoICsgYi5pbnB1dExlbmd0aDtcblx0XHR9ICk7XG5cdFx0Y2h1bmtzLnB1c2goIHsgYmxvY2tzOiBjaHVuaywgbGVuZ3RoOiBsZW5ndGggfSApO1xuXG5cdFx0Y2h1bmtzLmZvckVhY2goIGZ1bmN0aW9uKCBjICkge1xuXG5cdFx0XHR2YXIgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoIGMubGVuZ3RoICk7XG5cdFx0XHR2YXIgd3JpdHRlbiA9IDA7XG5cdFx0XHRjLmJsb2Nrcy5mb3JFYWNoKCBmdW5jdGlvbiggYiApIHtcblx0XHRcdFx0YnVmZmVyLnNldCggYi5oZWFkZXIsIHdyaXR0ZW4gKTtcblx0XHRcdFx0d3JpdHRlbiArPSBiLmhlYWRlckxlbmd0aDtcblx0XHRcdFx0YnVmZmVyLnNldCggYi5pbnB1dCwgd3JpdHRlbiApO1xuXHRcdFx0XHR3cml0dGVuICs9IGIuaW5wdXRMZW5ndGg7XG5cdFx0XHR9ICk7XG5cdFx0XHRidWZmZXJzLnB1c2goIGJ1ZmZlciApO1xuXG5cdFx0fSApO1xuXG5cdFx0YnVmZmVycy5wdXNoKCBuZXcgVWludDhBcnJheSggMiAqIHJlY29yZFNpemUgKSApO1xuXG5cdFx0cmV0dXJuIG5ldyBCbG9iKCBidWZmZXJzLCB7IHR5cGU6ICdvY3RldC9zdHJlYW0nIH0gKTtcblxuXHR9O1xuXG5cdFRhci5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy53cml0dGVuID0gMDtcblx0XHR0aGlzLm91dCA9IHV0aWxzLmNsZWFuKGJsb2NrU2l6ZSk7XG5cdH07XG5cbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFRhcjtcbiAgfSBlbHNlIHtcbiAgICB3aW5kb3cuVGFyID0gVGFyO1xuICB9XG59KCkpO1xuIiwiLy9kb3dubG9hZC5qcyB2My4wLCBieSBkYW5kYXZpczsgMjAwOC0yMDE0LiBbQ0NCWTJdIHNlZSBodHRwOi8vZGFubWwuY29tL2Rvd25sb2FkLmh0bWwgZm9yIHRlc3RzL3VzYWdlXG4vLyB2MSBsYW5kZWQgYSBGRitDaHJvbWUgY29tcGF0IHdheSBvZiBkb3dubG9hZGluZyBzdHJpbmdzIHRvIGxvY2FsIHVuLW5hbWVkIGZpbGVzLCB1cGdyYWRlZCB0byB1c2UgYSBoaWRkZW4gZnJhbWUgYW5kIG9wdGlvbmFsIG1pbWVcbi8vIHYyIGFkZGVkIG5hbWVkIGZpbGVzIHZpYSBhW2Rvd25sb2FkXSwgbXNTYXZlQmxvYiwgSUUgKDEwKykgc3VwcG9ydCwgYW5kIHdpbmRvdy5VUkwgc3VwcG9ydCBmb3IgbGFyZ2VyK2Zhc3RlciBzYXZlcyB0aGFuIGRhdGFVUkxzXG4vLyB2MyBhZGRlZCBkYXRhVVJMIGFuZCBCbG9iIElucHV0LCBiaW5kLXRvZ2dsZSBhcml0eSwgYW5kIGxlZ2FjeSBkYXRhVVJMIGZhbGxiYWNrIHdhcyBpbXByb3ZlZCB3aXRoIGZvcmNlLWRvd25sb2FkIG1pbWUgYW5kIGJhc2U2NCBzdXBwb3J0XG5cbi8vIGRhdGEgY2FuIGJlIGEgc3RyaW5nLCBCbG9iLCBGaWxlLCBvciBkYXRhVVJMXG5cblxuXG5cbmZ1bmN0aW9uIGRvd25sb2FkKGRhdGEsIHN0ckZpbGVOYW1lLCBzdHJNaW1lVHlwZSkge1xuXG5cdHZhciBzZWxmID0gd2luZG93LCAvLyB0aGlzIHNjcmlwdCBpcyBvbmx5IGZvciBicm93c2VycyBhbnl3YXkuLi5cblx0XHR1ID0gXCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIiwgLy8gdGhpcyBkZWZhdWx0IG1pbWUgYWxzbyB0cmlnZ2VycyBpZnJhbWUgZG93bmxvYWRzXG5cdFx0bSA9IHN0ck1pbWVUeXBlIHx8IHUsXG5cdFx0eCA9IGRhdGEsXG5cdFx0RCA9IGRvY3VtZW50LFxuXHRcdGEgPSBELmNyZWF0ZUVsZW1lbnQoXCJhXCIpLFxuXHRcdHogPSBmdW5jdGlvbihhKXtyZXR1cm4gU3RyaW5nKGEpO30sXG5cblxuXHRcdEIgPSBzZWxmLkJsb2IgfHwgc2VsZi5Nb3pCbG9iIHx8IHNlbGYuV2ViS2l0QmxvYiB8fCB6LFxuXHRcdEJCID0gc2VsZi5NU0Jsb2JCdWlsZGVyIHx8IHNlbGYuV2ViS2l0QmxvYkJ1aWxkZXIgfHwgc2VsZi5CbG9iQnVpbGRlcixcblx0XHRmbiA9IHN0ckZpbGVOYW1lIHx8IFwiZG93bmxvYWRcIixcblx0XHRibG9iLFxuXHRcdGIsXG5cdFx0dWEsXG5cdFx0ZnI7XG5cblx0Ly9pZih0eXBlb2YgQi5iaW5kID09PSAnZnVuY3Rpb24nICl7IEI9Qi5iaW5kKHNlbGYpOyB9XG5cblx0aWYoU3RyaW5nKHRoaXMpPT09XCJ0cnVlXCIpeyAvL3JldmVyc2UgYXJndW1lbnRzLCBhbGxvd2luZyBkb3dubG9hZC5iaW5kKHRydWUsIFwidGV4dC94bWxcIiwgXCJleHBvcnQueG1sXCIpIHRvIGFjdCBhcyBhIGNhbGxiYWNrXG5cdFx0eD1beCwgbV07XG5cdFx0bT14WzBdO1xuXHRcdHg9eFsxXTtcblx0fVxuXG5cblxuXHQvL2dvIGFoZWFkIGFuZCBkb3dubG9hZCBkYXRhVVJMcyByaWdodCBhd2F5XG5cdGlmKFN0cmluZyh4KS5tYXRjaCgvXmRhdGFcXDpbXFx3K1xcLV0rXFwvW1xcdytcXC1dK1ssO10vKSl7XG5cdFx0cmV0dXJuIG5hdmlnYXRvci5tc1NhdmVCbG9iID8gIC8vIElFMTAgY2FuJ3QgZG8gYVtkb3dubG9hZF0sIG9ubHkgQmxvYnM6XG5cdFx0XHRuYXZpZ2F0b3IubXNTYXZlQmxvYihkMmIoeCksIGZuKSA6XG5cdFx0XHRzYXZlcih4KSA7IC8vIGV2ZXJ5b25lIGVsc2UgY2FuIHNhdmUgZGF0YVVSTHMgdW4tcHJvY2Vzc2VkXG5cdH0vL2VuZCBpZiBkYXRhVVJMIHBhc3NlZD9cblxuXHR0cnl7XG5cblx0XHRibG9iID0geCBpbnN0YW5jZW9mIEIgP1xuXHRcdFx0eCA6XG5cdFx0XHRuZXcgQihbeF0sIHt0eXBlOiBtfSkgO1xuXHR9Y2F0Y2goeSl7XG5cdFx0aWYoQkIpe1xuXHRcdFx0YiA9IG5ldyBCQigpO1xuXHRcdFx0Yi5hcHBlbmQoW3hdKTtcblx0XHRcdGJsb2IgPSBiLmdldEJsb2IobSk7IC8vIHRoZSBibG9iXG5cdFx0fVxuXG5cdH1cblxuXG5cblx0ZnVuY3Rpb24gZDJiKHUpIHtcblx0XHR2YXIgcD0gdS5zcGxpdCgvWzo7LF0vKSxcblx0XHR0PSBwWzFdLFxuXHRcdGRlYz0gcFsyXSA9PSBcImJhc2U2NFwiID8gYXRvYiA6IGRlY29kZVVSSUNvbXBvbmVudCxcblx0XHRiaW49IGRlYyhwLnBvcCgpKSxcblx0XHRteD0gYmluLmxlbmd0aCxcblx0XHRpPSAwLFxuXHRcdHVpYT0gbmV3IFVpbnQ4QXJyYXkobXgpO1xuXG5cdFx0Zm9yKGk7aTxteDsrK2kpIHVpYVtpXT0gYmluLmNoYXJDb2RlQXQoaSk7XG5cblx0XHRyZXR1cm4gbmV3IEIoW3VpYV0sIHt0eXBlOiB0fSk7XG5cdCB9XG5cblx0ZnVuY3Rpb24gc2F2ZXIodXJsLCB3aW5Nb2RlKXtcblxuXG5cdFx0aWYgKCdkb3dubG9hZCcgaW4gYSkgeyAvL2h0bWw1IEFbZG93bmxvYWRdXG5cdFx0XHRhLmhyZWYgPSB1cmw7XG5cdFx0XHRhLnNldEF0dHJpYnV0ZShcImRvd25sb2FkXCIsIGZuKTtcblx0XHRcdGEuaW5uZXJIVE1MID0gXCJkb3dubG9hZGluZy4uLlwiO1xuXHRcdFx0YS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0RC5ib2R5LmFwcGVuZENoaWxkKGEpO1xuXHRcdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0YS5jbGljaygpO1xuXHRcdFx0XHRELmJvZHkucmVtb3ZlQ2hpbGQoYSk7XG5cdFx0XHRcdGlmKHdpbk1vZGU9PT10cnVlKXtzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7IHNlbGYuVVJMLnJldm9rZU9iamVjdFVSTChhLmhyZWYpO30sIDI1MCApO31cblx0XHRcdH0sIDY2KTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vZG8gaWZyYW1lIGRhdGFVUkwgZG93bmxvYWQgKG9sZCBjaCtGRik6XG5cdFx0dmFyIGYgPSBELmNyZWF0ZUVsZW1lbnQoXCJpZnJhbWVcIik7XG5cdFx0RC5ib2R5LmFwcGVuZENoaWxkKGYpO1xuXHRcdGlmKCF3aW5Nb2RlKXsgLy8gZm9yY2UgYSBtaW1lIHRoYXQgd2lsbCBkb3dubG9hZDpcblx0XHRcdHVybD1cImRhdGE6XCIrdXJsLnJlcGxhY2UoL15kYXRhOihbXFx3XFwvXFwtXFwrXSspLywgdSk7XG5cdFx0fVxuXG5cblx0XHRmLnNyYyA9IHVybDtcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7IEQuYm9keS5yZW1vdmVDaGlsZChmKTsgfSwgMzMzKTtcblxuXHR9Ly9lbmQgc2F2ZXJcblxuXG5cdGlmIChuYXZpZ2F0b3IubXNTYXZlQmxvYikgeyAvLyBJRTEwKyA6IChoYXMgQmxvYiwgYnV0IG5vdCBhW2Rvd25sb2FkXSBvciBVUkwpXG5cdFx0cmV0dXJuIG5hdmlnYXRvci5tc1NhdmVCbG9iKGJsb2IsIGZuKTtcblx0fVxuXG5cdGlmKHNlbGYuVVJMKXsgLy8gc2ltcGxlIGZhc3QgYW5kIG1vZGVybiB3YXkgdXNpbmcgQmxvYiBhbmQgVVJMOlxuXHRcdHNhdmVyKHNlbGYuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKSwgdHJ1ZSk7XG5cdH1lbHNle1xuXHRcdC8vIGhhbmRsZSBub24tQmxvYigpK25vbi1VUkwgYnJvd3NlcnM6XG5cdFx0aWYodHlwZW9mIGJsb2IgPT09IFwic3RyaW5nXCIgfHwgYmxvYi5jb25zdHJ1Y3Rvcj09PXogKXtcblx0XHRcdHRyeXtcblx0XHRcdFx0cmV0dXJuIHNhdmVyKCBcImRhdGE6XCIgKyAgbSAgICsgXCI7YmFzZTY0LFwiICArICBzZWxmLmJ0b2EoYmxvYikgICk7XG5cdFx0XHR9Y2F0Y2goeSl7XG5cdFx0XHRcdHJldHVybiBzYXZlciggXCJkYXRhOlwiICsgIG0gICArIFwiLFwiICsgZW5jb2RlVVJJQ29tcG9uZW50KGJsb2IpICApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEJsb2IgYnV0IG5vdCBVUkw6XG5cdFx0ZnI9bmV3IEZpbGVSZWFkZXIoKTtcblx0XHRmci5vbmxvYWQ9ZnVuY3Rpb24oZSl7XG5cdFx0XHRzYXZlcih0aGlzLnJlc3VsdCk7XG5cdFx0fTtcblx0XHRmci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuXHR9XG5cdHJldHVybiB0cnVlO1xufSAvKiBlbmQgZG93bmxvYWQoKSAqL1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICBtb2R1bGUuZXhwb3J0cyA9IGRvd25sb2FkO1xufVxuIiwiLy8gZ2lmLmpzIDAuMi4wIC0gaHR0cHM6Ly9naXRodWIuY29tL2pub3JkYmVyZy9naWYuanNcclxuKGZ1bmN0aW9uKGYpe2lmKHR5cGVvZiBleHBvcnRzPT09XCJvYmplY3RcIiYmdHlwZW9mIG1vZHVsZSE9PVwidW5kZWZpbmVkXCIpe21vZHVsZS5leHBvcnRzPWYoKX1lbHNlIGlmKHR5cGVvZiBkZWZpbmU9PT1cImZ1bmN0aW9uXCImJmRlZmluZS5hbWQpe2RlZmluZShbXSxmKX1lbHNle3ZhciBnO2lmKHR5cGVvZiB3aW5kb3chPT1cInVuZGVmaW5lZFwiKXtnPXdpbmRvd31lbHNlIGlmKHR5cGVvZiBnbG9iYWwhPT1cInVuZGVmaW5lZFwiKXtnPWdsb2JhbH1lbHNlIGlmKHR5cGVvZiBzZWxmIT09XCJ1bmRlZmluZWRcIil7Zz1zZWxmfWVsc2V7Zz10aGlzfWcuR0lGPWYoKX19KShmdW5jdGlvbigpe3ZhciBkZWZpbmUsbW9kdWxlLGV4cG9ydHM7cmV0dXJuIGZ1bmN0aW9uKCl7ZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9cmV0dXJuIGV9KCkoezE6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe2Z1bmN0aW9uIEV2ZW50RW1pdHRlcigpe3RoaXMuX2V2ZW50cz10aGlzLl9ldmVudHN8fHt9O3RoaXMuX21heExpc3RlbmVycz10aGlzLl9tYXhMaXN0ZW5lcnN8fHVuZGVmaW5lZH1tb2R1bGUuZXhwb3J0cz1FdmVudEVtaXR0ZXI7RXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlcj1FdmVudEVtaXR0ZXI7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzPXVuZGVmaW5lZDtFdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnM9dW5kZWZpbmVkO0V2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzPTEwO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzPWZ1bmN0aW9uKG4pe2lmKCFpc051bWJlcihuKXx8bjwwfHxpc05hTihuKSl0aHJvdyBUeXBlRXJyb3IoXCJuIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIik7dGhpcy5fbWF4TGlzdGVuZXJzPW47cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdD1mdW5jdGlvbih0eXBlKXt2YXIgZXIsaGFuZGxlcixsZW4sYXJncyxpLGxpc3RlbmVycztpZighdGhpcy5fZXZlbnRzKXRoaXMuX2V2ZW50cz17fTtpZih0eXBlPT09XCJlcnJvclwiKXtpZighdGhpcy5fZXZlbnRzLmVycm9yfHxpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpJiYhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCl7ZXI9YXJndW1lbnRzWzFdO2lmKGVyIGluc3RhbmNlb2YgRXJyb3Ipe3Rocm93IGVyfWVsc2V7dmFyIGVycj1uZXcgRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuICgnK2VyK1wiKVwiKTtlcnIuY29udGV4dD1lcjt0aHJvdyBlcnJ9fX1oYW5kbGVyPXRoaXMuX2V2ZW50c1t0eXBlXTtpZihpc1VuZGVmaW5lZChoYW5kbGVyKSlyZXR1cm4gZmFsc2U7aWYoaXNGdW5jdGlvbihoYW5kbGVyKSl7c3dpdGNoKGFyZ3VtZW50cy5sZW5ndGgpe2Nhc2UgMTpoYW5kbGVyLmNhbGwodGhpcyk7YnJlYWs7Y2FzZSAyOmhhbmRsZXIuY2FsbCh0aGlzLGFyZ3VtZW50c1sxXSk7YnJlYWs7Y2FzZSAzOmhhbmRsZXIuY2FsbCh0aGlzLGFyZ3VtZW50c1sxXSxhcmd1bWVudHNbMl0pO2JyZWFrO2RlZmF1bHQ6YXJncz1BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsMSk7aGFuZGxlci5hcHBseSh0aGlzLGFyZ3MpfX1lbHNlIGlmKGlzT2JqZWN0KGhhbmRsZXIpKXthcmdzPUFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKTtsaXN0ZW5lcnM9aGFuZGxlci5zbGljZSgpO2xlbj1saXN0ZW5lcnMubGVuZ3RoO2ZvcihpPTA7aTxsZW47aSsrKWxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLGFyZ3MpfXJldHVybiB0cnVlfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe3ZhciBtO2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7aWYoIXRoaXMuX2V2ZW50cyl0aGlzLl9ldmVudHM9e307aWYodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKXRoaXMuZW1pdChcIm5ld0xpc3RlbmVyXCIsdHlwZSxpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKT9saXN0ZW5lci5saXN0ZW5lcjpsaXN0ZW5lcik7aWYoIXRoaXMuX2V2ZW50c1t0eXBlXSl0aGlzLl9ldmVudHNbdHlwZV09bGlzdGVuZXI7ZWxzZSBpZihpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKXRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtlbHNlIHRoaXMuX2V2ZW50c1t0eXBlXT1bdGhpcy5fZXZlbnRzW3R5cGVdLGxpc3RlbmVyXTtpZihpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pJiYhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCl7aWYoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpe209dGhpcy5fbWF4TGlzdGVuZXJzfWVsc2V7bT1FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVyc31pZihtJiZtPjAmJnRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGg+bSl7dGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZD10cnVlO2NvbnNvbGUuZXJyb3IoXCIobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSBcIitcImxlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gXCIrXCJVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC5cIix0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtpZih0eXBlb2YgY29uc29sZS50cmFjZT09PVwiZnVuY3Rpb25cIil7Y29uc29sZS50cmFjZSgpfX19cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUub249RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2U9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTt2YXIgZmlyZWQ9ZmFsc2U7ZnVuY3Rpb24gZygpe3RoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSxnKTtpZighZmlyZWQpe2ZpcmVkPXRydWU7bGlzdGVuZXIuYXBwbHkodGhpcyxhcmd1bWVudHMpfX1nLmxpc3RlbmVyPWxpc3RlbmVyO3RoaXMub24odHlwZSxnKTtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lcj1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXt2YXIgbGlzdCxwb3NpdGlvbixsZW5ndGgsaTtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO2lmKCF0aGlzLl9ldmVudHN8fCF0aGlzLl9ldmVudHNbdHlwZV0pcmV0dXJuIHRoaXM7bGlzdD10aGlzLl9ldmVudHNbdHlwZV07bGVuZ3RoPWxpc3QubGVuZ3RoO3Bvc2l0aW9uPS0xO2lmKGxpc3Q9PT1saXN0ZW5lcnx8aXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSYmbGlzdC5saXN0ZW5lcj09PWxpc3RlbmVyKXtkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO2lmKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil0aGlzLmVtaXQoXCJyZW1vdmVMaXN0ZW5lclwiLHR5cGUsbGlzdGVuZXIpfWVsc2UgaWYoaXNPYmplY3QobGlzdCkpe2ZvcihpPWxlbmd0aDtpLS0gPjA7KXtpZihsaXN0W2ldPT09bGlzdGVuZXJ8fGxpc3RbaV0ubGlzdGVuZXImJmxpc3RbaV0ubGlzdGVuZXI9PT1saXN0ZW5lcil7cG9zaXRpb249aTticmVha319aWYocG9zaXRpb248MClyZXR1cm4gdGhpcztpZihsaXN0Lmxlbmd0aD09PTEpe2xpc3QubGVuZ3RoPTA7ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXX1lbHNle2xpc3Quc3BsaWNlKHBvc2l0aW9uLDEpfWlmKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil0aGlzLmVtaXQoXCJyZW1vdmVMaXN0ZW5lclwiLHR5cGUsbGlzdGVuZXIpfXJldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycz1mdW5jdGlvbih0eXBlKXt2YXIga2V5LGxpc3RlbmVycztpZighdGhpcy5fZXZlbnRzKXJldHVybiB0aGlzO2lmKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpe2lmKGFyZ3VtZW50cy5sZW5ndGg9PT0wKXRoaXMuX2V2ZW50cz17fTtlbHNlIGlmKHRoaXMuX2V2ZW50c1t0eXBlXSlkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO3JldHVybiB0aGlzfWlmKGFyZ3VtZW50cy5sZW5ndGg9PT0wKXtmb3Ioa2V5IGluIHRoaXMuX2V2ZW50cyl7aWYoa2V5PT09XCJyZW1vdmVMaXN0ZW5lclwiKWNvbnRpbnVlO3RoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSl9dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoXCJyZW1vdmVMaXN0ZW5lclwiKTt0aGlzLl9ldmVudHM9e307cmV0dXJuIHRoaXN9bGlzdGVuZXJzPXRoaXMuX2V2ZW50c1t0eXBlXTtpZihpc0Z1bmN0aW9uKGxpc3RlbmVycykpe3RoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSxsaXN0ZW5lcnMpfWVsc2UgaWYobGlzdGVuZXJzKXt3aGlsZShsaXN0ZW5lcnMubGVuZ3RoKXRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSxsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aC0xXSl9ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnM9ZnVuY3Rpb24odHlwZSl7dmFyIHJldDtpZighdGhpcy5fZXZlbnRzfHwhdGhpcy5fZXZlbnRzW3R5cGVdKXJldD1bXTtlbHNlIGlmKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlyZXQ9W3RoaXMuX2V2ZW50c1t0eXBlXV07ZWxzZSByZXQ9dGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7cmV0dXJuIHJldH07RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50PWZ1bmN0aW9uKHR5cGUpe2lmKHRoaXMuX2V2ZW50cyl7dmFyIGV2bGlzdGVuZXI9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpcmV0dXJuIDE7ZWxzZSBpZihldmxpc3RlbmVyKXJldHVybiBldmxpc3RlbmVyLmxlbmd0aH1yZXR1cm4gMH07RXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQ9ZnVuY3Rpb24oZW1pdHRlcix0eXBlKXtyZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpfTtmdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZyl7cmV0dXJuIHR5cGVvZiBhcmc9PT1cImZ1bmN0aW9uXCJ9ZnVuY3Rpb24gaXNOdW1iZXIoYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwibnVtYmVyXCJ9ZnVuY3Rpb24gaXNPYmplY3QoYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwib2JqZWN0XCImJmFyZyE9PW51bGx9ZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKXtyZXR1cm4gYXJnPT09dm9pZCAwfX0se31dLDI6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBOZXVRdWFudD1yZXF1aXJlKFwiLi9UeXBlZE5ldVF1YW50LmpzXCIpO3ZhciBMWldFbmNvZGVyPXJlcXVpcmUoXCIuL0xaV0VuY29kZXIuanNcIik7ZnVuY3Rpb24gQnl0ZUFycmF5KCl7dGhpcy5wYWdlPS0xO3RoaXMucGFnZXM9W107dGhpcy5uZXdQYWdlKCl9Qnl0ZUFycmF5LnBhZ2VTaXplPTQwOTY7Qnl0ZUFycmF5LmNoYXJNYXA9e307Zm9yKHZhciBpPTA7aTwyNTY7aSsrKUJ5dGVBcnJheS5jaGFyTWFwW2ldPVN0cmluZy5mcm9tQ2hhckNvZGUoaSk7Qnl0ZUFycmF5LnByb3RvdHlwZS5uZXdQYWdlPWZ1bmN0aW9uKCl7dGhpcy5wYWdlc1srK3RoaXMucGFnZV09bmV3IFVpbnQ4QXJyYXkoQnl0ZUFycmF5LnBhZ2VTaXplKTt0aGlzLmN1cnNvcj0wfTtCeXRlQXJyYXkucHJvdG90eXBlLmdldERhdGE9ZnVuY3Rpb24oKXt2YXIgcnY9XCJcIjtmb3IodmFyIHA9MDtwPHRoaXMucGFnZXMubGVuZ3RoO3ArKyl7Zm9yKHZhciBpPTA7aTxCeXRlQXJyYXkucGFnZVNpemU7aSsrKXtydis9Qnl0ZUFycmF5LmNoYXJNYXBbdGhpcy5wYWdlc1twXVtpXV19fXJldHVybiBydn07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZUJ5dGU9ZnVuY3Rpb24odmFsKXtpZih0aGlzLmN1cnNvcj49Qnl0ZUFycmF5LnBhZ2VTaXplKXRoaXMubmV3UGFnZSgpO3RoaXMucGFnZXNbdGhpcy5wYWdlXVt0aGlzLmN1cnNvcisrXT12YWx9O0J5dGVBcnJheS5wcm90b3R5cGUud3JpdGVVVEZCeXRlcz1mdW5jdGlvbihzdHJpbmcpe2Zvcih2YXIgbD1zdHJpbmcubGVuZ3RoLGk9MDtpPGw7aSsrKXRoaXMud3JpdGVCeXRlKHN0cmluZy5jaGFyQ29kZUF0KGkpKX07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZUJ5dGVzPWZ1bmN0aW9uKGFycmF5LG9mZnNldCxsZW5ndGgpe2Zvcih2YXIgbD1sZW5ndGh8fGFycmF5Lmxlbmd0aCxpPW9mZnNldHx8MDtpPGw7aSsrKXRoaXMud3JpdGVCeXRlKGFycmF5W2ldKX07ZnVuY3Rpb24gR0lGRW5jb2Rlcih3aWR0aCxoZWlnaHQpe3RoaXMud2lkdGg9fn53aWR0aDt0aGlzLmhlaWdodD1+fmhlaWdodDt0aGlzLnRyYW5zcGFyZW50PW51bGw7dGhpcy50cmFuc0luZGV4PTA7dGhpcy5yZXBlYXQ9LTE7dGhpcy5kZWxheT0wO3RoaXMuaW1hZ2U9bnVsbDt0aGlzLnBpeGVscz1udWxsO3RoaXMuaW5kZXhlZFBpeGVscz1udWxsO3RoaXMuY29sb3JEZXB0aD1udWxsO3RoaXMuY29sb3JUYWI9bnVsbDt0aGlzLm5ldVF1YW50PW51bGw7dGhpcy51c2VkRW50cnk9bmV3IEFycmF5O3RoaXMucGFsU2l6ZT03O3RoaXMuZGlzcG9zZT0tMTt0aGlzLmZpcnN0RnJhbWU9dHJ1ZTt0aGlzLnNhbXBsZT0xMDt0aGlzLmRpdGhlcj1mYWxzZTt0aGlzLmdsb2JhbFBhbGV0dGU9ZmFsc2U7dGhpcy5vdXQ9bmV3IEJ5dGVBcnJheX1HSUZFbmNvZGVyLnByb3RvdHlwZS5zZXREZWxheT1mdW5jdGlvbihtaWxsaXNlY29uZHMpe3RoaXMuZGVsYXk9TWF0aC5yb3VuZChtaWxsaXNlY29uZHMvMTApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRGcmFtZVJhdGU9ZnVuY3Rpb24oZnBzKXt0aGlzLmRlbGF5PU1hdGgucm91bmQoMTAwL2Zwcyl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldERpc3Bvc2U9ZnVuY3Rpb24oZGlzcG9zYWxDb2RlKXtpZihkaXNwb3NhbENvZGU+PTApdGhpcy5kaXNwb3NlPWRpc3Bvc2FsQ29kZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0UmVwZWF0PWZ1bmN0aW9uKHJlcGVhdCl7dGhpcy5yZXBlYXQ9cmVwZWF0fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRUcmFuc3BhcmVudD1mdW5jdGlvbihjb2xvcil7dGhpcy50cmFuc3BhcmVudD1jb2xvcn07R0lGRW5jb2Rlci5wcm90b3R5cGUuYWRkRnJhbWU9ZnVuY3Rpb24oaW1hZ2VEYXRhKXt0aGlzLmltYWdlPWltYWdlRGF0YTt0aGlzLmNvbG9yVGFiPXRoaXMuZ2xvYmFsUGFsZXR0ZSYmdGhpcy5nbG9iYWxQYWxldHRlLnNsaWNlP3RoaXMuZ2xvYmFsUGFsZXR0ZTpudWxsO3RoaXMuZ2V0SW1hZ2VQaXhlbHMoKTt0aGlzLmFuYWx5emVQaXhlbHMoKTtpZih0aGlzLmdsb2JhbFBhbGV0dGU9PT10cnVlKXRoaXMuZ2xvYmFsUGFsZXR0ZT10aGlzLmNvbG9yVGFiO2lmKHRoaXMuZmlyc3RGcmFtZSl7dGhpcy53cml0ZUxTRCgpO3RoaXMud3JpdGVQYWxldHRlKCk7aWYodGhpcy5yZXBlYXQ+PTApe3RoaXMud3JpdGVOZXRzY2FwZUV4dCgpfX10aGlzLndyaXRlR3JhcGhpY0N0cmxFeHQoKTt0aGlzLndyaXRlSW1hZ2VEZXNjKCk7aWYoIXRoaXMuZmlyc3RGcmFtZSYmIXRoaXMuZ2xvYmFsUGFsZXR0ZSl0aGlzLndyaXRlUGFsZXR0ZSgpO3RoaXMud3JpdGVQaXhlbHMoKTt0aGlzLmZpcnN0RnJhbWU9ZmFsc2V9O0dJRkVuY29kZXIucHJvdG90eXBlLmZpbmlzaD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSg1OSl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFF1YWxpdHk9ZnVuY3Rpb24ocXVhbGl0eSl7aWYocXVhbGl0eTwxKXF1YWxpdHk9MTt0aGlzLnNhbXBsZT1xdWFsaXR5fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXREaXRoZXI9ZnVuY3Rpb24oZGl0aGVyKXtpZihkaXRoZXI9PT10cnVlKWRpdGhlcj1cIkZsb3lkU3RlaW5iZXJnXCI7dGhpcy5kaXRoZXI9ZGl0aGVyfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRHbG9iYWxQYWxldHRlPWZ1bmN0aW9uKHBhbGV0dGUpe3RoaXMuZ2xvYmFsUGFsZXR0ZT1wYWxldHRlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5nZXRHbG9iYWxQYWxldHRlPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZ2xvYmFsUGFsZXR0ZSYmdGhpcy5nbG9iYWxQYWxldHRlLnNsaWNlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2UoMCl8fHRoaXMuZ2xvYmFsUGFsZXR0ZX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVIZWFkZXI9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZVVURkJ5dGVzKFwiR0lGODlhXCIpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5hbmFseXplUGl4ZWxzPWZ1bmN0aW9uKCl7aWYoIXRoaXMuY29sb3JUYWIpe3RoaXMubmV1UXVhbnQ9bmV3IE5ldVF1YW50KHRoaXMucGl4ZWxzLHRoaXMuc2FtcGxlKTt0aGlzLm5ldVF1YW50LmJ1aWxkQ29sb3JtYXAoKTt0aGlzLmNvbG9yVGFiPXRoaXMubmV1UXVhbnQuZ2V0Q29sb3JtYXAoKX1pZih0aGlzLmRpdGhlcil7dGhpcy5kaXRoZXJQaXhlbHModGhpcy5kaXRoZXIucmVwbGFjZShcIi1zZXJwZW50aW5lXCIsXCJcIiksdGhpcy5kaXRoZXIubWF0Y2goLy1zZXJwZW50aW5lLykhPT1udWxsKX1lbHNle3RoaXMuaW5kZXhQaXhlbHMoKX10aGlzLnBpeGVscz1udWxsO3RoaXMuY29sb3JEZXB0aD04O3RoaXMucGFsU2l6ZT03O2lmKHRoaXMudHJhbnNwYXJlbnQhPT1udWxsKXt0aGlzLnRyYW5zSW5kZXg9dGhpcy5maW5kQ2xvc2VzdCh0aGlzLnRyYW5zcGFyZW50LHRydWUpfX07R0lGRW5jb2Rlci5wcm90b3R5cGUuaW5kZXhQaXhlbHM9ZnVuY3Rpb24oaW1ncSl7dmFyIG5QaXg9dGhpcy5waXhlbHMubGVuZ3RoLzM7dGhpcy5pbmRleGVkUGl4ZWxzPW5ldyBVaW50OEFycmF5KG5QaXgpO3ZhciBrPTA7Zm9yKHZhciBqPTA7ajxuUGl4O2orKyl7dmFyIGluZGV4PXRoaXMuZmluZENsb3Nlc3RSR0IodGhpcy5waXhlbHNbaysrXSYyNTUsdGhpcy5waXhlbHNbaysrXSYyNTUsdGhpcy5waXhlbHNbaysrXSYyNTUpO3RoaXMudXNlZEVudHJ5W2luZGV4XT10cnVlO3RoaXMuaW5kZXhlZFBpeGVsc1tqXT1pbmRleH19O0dJRkVuY29kZXIucHJvdG90eXBlLmRpdGhlclBpeGVscz1mdW5jdGlvbihrZXJuZWwsc2VycGVudGluZSl7dmFyIGtlcm5lbHM9e0ZhbHNlRmxveWRTdGVpbmJlcmc6W1szLzgsMSwwXSxbMy84LDAsMV0sWzIvOCwxLDFdXSxGbG95ZFN0ZWluYmVyZzpbWzcvMTYsMSwwXSxbMy8xNiwtMSwxXSxbNS8xNiwwLDFdLFsxLzE2LDEsMV1dLFN0dWNraTpbWzgvNDIsMSwwXSxbNC80MiwyLDBdLFsyLzQyLC0yLDFdLFs0LzQyLC0xLDFdLFs4LzQyLDAsMV0sWzQvNDIsMSwxXSxbMi80MiwyLDFdLFsxLzQyLC0yLDJdLFsyLzQyLC0xLDJdLFs0LzQyLDAsMl0sWzIvNDIsMSwyXSxbMS80MiwyLDJdXSxBdGtpbnNvbjpbWzEvOCwxLDBdLFsxLzgsMiwwXSxbMS84LC0xLDFdLFsxLzgsMCwxXSxbMS84LDEsMV0sWzEvOCwwLDJdXX07aWYoIWtlcm5lbHx8IWtlcm5lbHNba2VybmVsXSl7dGhyb3dcIlVua25vd24gZGl0aGVyaW5nIGtlcm5lbDogXCIra2VybmVsfXZhciBkcz1rZXJuZWxzW2tlcm5lbF07dmFyIGluZGV4PTAsaGVpZ2h0PXRoaXMuaGVpZ2h0LHdpZHRoPXRoaXMud2lkdGgsZGF0YT10aGlzLnBpeGVsczt2YXIgZGlyZWN0aW9uPXNlcnBlbnRpbmU/LTE6MTt0aGlzLmluZGV4ZWRQaXhlbHM9bmV3IFVpbnQ4QXJyYXkodGhpcy5waXhlbHMubGVuZ3RoLzMpO2Zvcih2YXIgeT0wO3k8aGVpZ2h0O3krKyl7aWYoc2VycGVudGluZSlkaXJlY3Rpb249ZGlyZWN0aW9uKi0xO2Zvcih2YXIgeD1kaXJlY3Rpb249PTE/MDp3aWR0aC0xLHhlbmQ9ZGlyZWN0aW9uPT0xP3dpZHRoOjA7eCE9PXhlbmQ7eCs9ZGlyZWN0aW9uKXtpbmRleD15KndpZHRoK3g7dmFyIGlkeD1pbmRleCozO3ZhciByMT1kYXRhW2lkeF07dmFyIGcxPWRhdGFbaWR4KzFdO3ZhciBiMT1kYXRhW2lkeCsyXTtpZHg9dGhpcy5maW5kQ2xvc2VzdFJHQihyMSxnMSxiMSk7dGhpcy51c2VkRW50cnlbaWR4XT10cnVlO3RoaXMuaW5kZXhlZFBpeGVsc1tpbmRleF09aWR4O2lkeCo9Mzt2YXIgcjI9dGhpcy5jb2xvclRhYltpZHhdO3ZhciBnMj10aGlzLmNvbG9yVGFiW2lkeCsxXTt2YXIgYjI9dGhpcy5jb2xvclRhYltpZHgrMl07dmFyIGVyPXIxLXIyO3ZhciBlZz1nMS1nMjt2YXIgZWI9YjEtYjI7Zm9yKHZhciBpPWRpcmVjdGlvbj09MT8wOmRzLmxlbmd0aC0xLGVuZD1kaXJlY3Rpb249PTE/ZHMubGVuZ3RoOjA7aSE9PWVuZDtpKz1kaXJlY3Rpb24pe3ZhciB4MT1kc1tpXVsxXTt2YXIgeTE9ZHNbaV1bMl07aWYoeDEreD49MCYmeDEreDx3aWR0aCYmeTEreT49MCYmeTEreTxoZWlnaHQpe3ZhciBkPWRzW2ldWzBdO2lkeD1pbmRleCt4MSt5MSp3aWR0aDtpZHgqPTM7ZGF0YVtpZHhdPU1hdGgubWF4KDAsTWF0aC5taW4oMjU1LGRhdGFbaWR4XStlcipkKSk7ZGF0YVtpZHgrMV09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHgrMV0rZWcqZCkpO2RhdGFbaWR4KzJdPU1hdGgubWF4KDAsTWF0aC5taW4oMjU1LGRhdGFbaWR4KzJdK2ViKmQpKX19fX19O0dJRkVuY29kZXIucHJvdG90eXBlLmZpbmRDbG9zZXN0PWZ1bmN0aW9uKGMsdXNlZCl7cmV0dXJuIHRoaXMuZmluZENsb3Nlc3RSR0IoKGMmMTY3MTE2ODApPj4xNiwoYyY2NTI4MCk+PjgsYyYyNTUsdXNlZCl9O0dJRkVuY29kZXIucHJvdG90eXBlLmZpbmRDbG9zZXN0UkdCPWZ1bmN0aW9uKHIsZyxiLHVzZWQpe2lmKHRoaXMuY29sb3JUYWI9PT1udWxsKXJldHVybi0xO2lmKHRoaXMubmV1UXVhbnQmJiF1c2VkKXtyZXR1cm4gdGhpcy5uZXVRdWFudC5sb29rdXBSR0IocixnLGIpfXZhciBjPWJ8Zzw8OHxyPDwxNjt2YXIgbWlucG9zPTA7dmFyIGRtaW49MjU2KjI1NioyNTY7dmFyIGxlbj10aGlzLmNvbG9yVGFiLmxlbmd0aDtmb3IodmFyIGk9MCxpbmRleD0wO2k8bGVuO2luZGV4Kyspe3ZhciBkcj1yLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZGc9Zy0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGRiPWItKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkPWRyKmRyK2RnKmRnK2RiKmRiO2lmKCghdXNlZHx8dGhpcy51c2VkRW50cnlbaW5kZXhdKSYmZDxkbWluKXtkbWluPWQ7bWlucG9zPWluZGV4fX1yZXR1cm4gbWlucG9zfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5nZXRJbWFnZVBpeGVscz1mdW5jdGlvbigpe3ZhciB3PXRoaXMud2lkdGg7dmFyIGg9dGhpcy5oZWlnaHQ7dGhpcy5waXhlbHM9bmV3IFVpbnQ4QXJyYXkodypoKjMpO3ZhciBkYXRhPXRoaXMuaW1hZ2U7dmFyIHNyY1Bvcz0wO3ZhciBjb3VudD0wO2Zvcih2YXIgaT0wO2k8aDtpKyspe2Zvcih2YXIgaj0wO2o8dztqKyspe3RoaXMucGl4ZWxzW2NvdW50KytdPWRhdGFbc3JjUG9zKytdO3RoaXMucGl4ZWxzW2NvdW50KytdPWRhdGFbc3JjUG9zKytdO3RoaXMucGl4ZWxzW2NvdW50KytdPWRhdGFbc3JjUG9zKytdO3NyY1BvcysrfX19O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlR3JhcGhpY0N0cmxFeHQ9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoMzMpO3RoaXMub3V0LndyaXRlQnl0ZSgyNDkpO3RoaXMub3V0LndyaXRlQnl0ZSg0KTt2YXIgdHJhbnNwLGRpc3A7aWYodGhpcy50cmFuc3BhcmVudD09PW51bGwpe3RyYW5zcD0wO2Rpc3A9MH1lbHNle3RyYW5zcD0xO2Rpc3A9Mn1pZih0aGlzLmRpc3Bvc2U+PTApe2Rpc3A9dGhpcy5kaXNwb3NlJjd9ZGlzcDw8PTI7dGhpcy5vdXQud3JpdGVCeXRlKDB8ZGlzcHwwfHRyYW5zcCk7dGhpcy53cml0ZVNob3J0KHRoaXMuZGVsYXkpO3RoaXMub3V0LndyaXRlQnl0ZSh0aGlzLnRyYW5zSW5kZXgpO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVJbWFnZURlc2M9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoNDQpO3RoaXMud3JpdGVTaG9ydCgwKTt0aGlzLndyaXRlU2hvcnQoMCk7dGhpcy53cml0ZVNob3J0KHRoaXMud2lkdGgpO3RoaXMud3JpdGVTaG9ydCh0aGlzLmhlaWdodCk7aWYodGhpcy5maXJzdEZyYW1lfHx0aGlzLmdsb2JhbFBhbGV0dGUpe3RoaXMub3V0LndyaXRlQnl0ZSgwKX1lbHNle3RoaXMub3V0LndyaXRlQnl0ZSgxMjh8MHwwfDB8dGhpcy5wYWxTaXplKX19O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlTFNEPWZ1bmN0aW9uKCl7dGhpcy53cml0ZVNob3J0KHRoaXMud2lkdGgpO3RoaXMud3JpdGVTaG9ydCh0aGlzLmhlaWdodCk7dGhpcy5vdXQud3JpdGVCeXRlKDEyOHwxMTJ8MHx0aGlzLnBhbFNpemUpO3RoaXMub3V0LndyaXRlQnl0ZSgwKTt0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlTmV0c2NhcGVFeHQ9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoMzMpO3RoaXMub3V0LndyaXRlQnl0ZSgyNTUpO3RoaXMub3V0LndyaXRlQnl0ZSgxMSk7dGhpcy5vdXQud3JpdGVVVEZCeXRlcyhcIk5FVFNDQVBFMi4wXCIpO3RoaXMub3V0LndyaXRlQnl0ZSgzKTt0aGlzLm91dC53cml0ZUJ5dGUoMSk7dGhpcy53cml0ZVNob3J0KHRoaXMucmVwZWF0KTt0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlUGFsZXR0ZT1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZXModGhpcy5jb2xvclRhYik7dmFyIG49MyoyNTYtdGhpcy5jb2xvclRhYi5sZW5ndGg7Zm9yKHZhciBpPTA7aTxuO2krKyl0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlU2hvcnQ9ZnVuY3Rpb24ocFZhbHVlKXt0aGlzLm91dC53cml0ZUJ5dGUocFZhbHVlJjI1NSk7dGhpcy5vdXQud3JpdGVCeXRlKHBWYWx1ZT4+OCYyNTUpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZVBpeGVscz1mdW5jdGlvbigpe3ZhciBlbmM9bmV3IExaV0VuY29kZXIodGhpcy53aWR0aCx0aGlzLmhlaWdodCx0aGlzLmluZGV4ZWRQaXhlbHMsdGhpcy5jb2xvckRlcHRoKTtlbmMuZW5jb2RlKHRoaXMub3V0KX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc3RyZWFtPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMub3V0fTttb2R1bGUuZXhwb3J0cz1HSUZFbmNvZGVyfSx7XCIuL0xaV0VuY29kZXIuanNcIjozLFwiLi9UeXBlZE5ldVF1YW50LmpzXCI6NH1dLDM6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBFT0Y9LTE7dmFyIEJJVFM9MTI7dmFyIEhTSVpFPTUwMDM7dmFyIG1hc2tzPVswLDEsMyw3LDE1LDMxLDYzLDEyNywyNTUsNTExLDEwMjMsMjA0Nyw0MDk1LDgxOTEsMTYzODMsMzI3NjcsNjU1MzVdO2Z1bmN0aW9uIExaV0VuY29kZXIod2lkdGgsaGVpZ2h0LHBpeGVscyxjb2xvckRlcHRoKXt2YXIgaW5pdENvZGVTaXplPU1hdGgubWF4KDIsY29sb3JEZXB0aCk7dmFyIGFjY3VtPW5ldyBVaW50OEFycmF5KDI1Nik7dmFyIGh0YWI9bmV3IEludDMyQXJyYXkoSFNJWkUpO3ZhciBjb2RldGFiPW5ldyBJbnQzMkFycmF5KEhTSVpFKTt2YXIgY3VyX2FjY3VtLGN1cl9iaXRzPTA7dmFyIGFfY291bnQ7dmFyIGZyZWVfZW50PTA7dmFyIG1heGNvZGU7dmFyIGNsZWFyX2ZsZz1mYWxzZTt2YXIgZ19pbml0X2JpdHMsQ2xlYXJDb2RlLEVPRkNvZGU7ZnVuY3Rpb24gY2hhcl9vdXQoYyxvdXRzKXthY2N1bVthX2NvdW50KytdPWM7aWYoYV9jb3VudD49MjU0KWZsdXNoX2NoYXIob3V0cyl9ZnVuY3Rpb24gY2xfYmxvY2sob3V0cyl7Y2xfaGFzaChIU0laRSk7ZnJlZV9lbnQ9Q2xlYXJDb2RlKzI7Y2xlYXJfZmxnPXRydWU7b3V0cHV0KENsZWFyQ29kZSxvdXRzKX1mdW5jdGlvbiBjbF9oYXNoKGhzaXplKXtmb3IodmFyIGk9MDtpPGhzaXplOysraSlodGFiW2ldPS0xfWZ1bmN0aW9uIGNvbXByZXNzKGluaXRfYml0cyxvdXRzKXt2YXIgZmNvZGUsYyxpLGVudCxkaXNwLGhzaXplX3JlZyxoc2hpZnQ7Z19pbml0X2JpdHM9aW5pdF9iaXRzO2NsZWFyX2ZsZz1mYWxzZTtuX2JpdHM9Z19pbml0X2JpdHM7bWF4Y29kZT1NQVhDT0RFKG5fYml0cyk7Q2xlYXJDb2RlPTE8PGluaXRfYml0cy0xO0VPRkNvZGU9Q2xlYXJDb2RlKzE7ZnJlZV9lbnQ9Q2xlYXJDb2RlKzI7YV9jb3VudD0wO2VudD1uZXh0UGl4ZWwoKTtoc2hpZnQ9MDtmb3IoZmNvZGU9SFNJWkU7ZmNvZGU8NjU1MzY7ZmNvZGUqPTIpKytoc2hpZnQ7aHNoaWZ0PTgtaHNoaWZ0O2hzaXplX3JlZz1IU0laRTtjbF9oYXNoKGhzaXplX3JlZyk7b3V0cHV0KENsZWFyQ29kZSxvdXRzKTtvdXRlcl9sb29wOndoaWxlKChjPW5leHRQaXhlbCgpKSE9RU9GKXtmY29kZT0oYzw8QklUUykrZW50O2k9Yzw8aHNoaWZ0XmVudDtpZihodGFiW2ldPT09ZmNvZGUpe2VudD1jb2RldGFiW2ldO2NvbnRpbnVlfWVsc2UgaWYoaHRhYltpXT49MCl7ZGlzcD1oc2l6ZV9yZWctaTtpZihpPT09MClkaXNwPTE7ZG97aWYoKGktPWRpc3ApPDApaSs9aHNpemVfcmVnO2lmKGh0YWJbaV09PT1mY29kZSl7ZW50PWNvZGV0YWJbaV07Y29udGludWUgb3V0ZXJfbG9vcH19d2hpbGUoaHRhYltpXT49MCl9b3V0cHV0KGVudCxvdXRzKTtlbnQ9YztpZihmcmVlX2VudDwxPDxCSVRTKXtjb2RldGFiW2ldPWZyZWVfZW50Kys7aHRhYltpXT1mY29kZX1lbHNle2NsX2Jsb2NrKG91dHMpfX1vdXRwdXQoZW50LG91dHMpO291dHB1dChFT0ZDb2RlLG91dHMpfWZ1bmN0aW9uIGVuY29kZShvdXRzKXtvdXRzLndyaXRlQnl0ZShpbml0Q29kZVNpemUpO3JlbWFpbmluZz13aWR0aCpoZWlnaHQ7Y3VyUGl4ZWw9MDtjb21wcmVzcyhpbml0Q29kZVNpemUrMSxvdXRzKTtvdXRzLndyaXRlQnl0ZSgwKX1mdW5jdGlvbiBmbHVzaF9jaGFyKG91dHMpe2lmKGFfY291bnQ+MCl7b3V0cy53cml0ZUJ5dGUoYV9jb3VudCk7b3V0cy53cml0ZUJ5dGVzKGFjY3VtLDAsYV9jb3VudCk7YV9jb3VudD0wfX1mdW5jdGlvbiBNQVhDT0RFKG5fYml0cyl7cmV0dXJuKDE8PG5fYml0cyktMX1mdW5jdGlvbiBuZXh0UGl4ZWwoKXtpZihyZW1haW5pbmc9PT0wKXJldHVybiBFT0Y7LS1yZW1haW5pbmc7dmFyIHBpeD1waXhlbHNbY3VyUGl4ZWwrK107cmV0dXJuIHBpeCYyNTV9ZnVuY3Rpb24gb3V0cHV0KGNvZGUsb3V0cyl7Y3VyX2FjY3VtJj1tYXNrc1tjdXJfYml0c107aWYoY3VyX2JpdHM+MCljdXJfYWNjdW18PWNvZGU8PGN1cl9iaXRzO2Vsc2UgY3VyX2FjY3VtPWNvZGU7Y3VyX2JpdHMrPW5fYml0czt3aGlsZShjdXJfYml0cz49OCl7Y2hhcl9vdXQoY3VyX2FjY3VtJjI1NSxvdXRzKTtjdXJfYWNjdW0+Pj04O2N1cl9iaXRzLT04fWlmKGZyZWVfZW50Pm1heGNvZGV8fGNsZWFyX2ZsZyl7aWYoY2xlYXJfZmxnKXttYXhjb2RlPU1BWENPREUobl9iaXRzPWdfaW5pdF9iaXRzKTtjbGVhcl9mbGc9ZmFsc2V9ZWxzZXsrK25fYml0cztpZihuX2JpdHM9PUJJVFMpbWF4Y29kZT0xPDxCSVRTO2Vsc2UgbWF4Y29kZT1NQVhDT0RFKG5fYml0cyl9fWlmKGNvZGU9PUVPRkNvZGUpe3doaWxlKGN1cl9iaXRzPjApe2NoYXJfb3V0KGN1cl9hY2N1bSYyNTUsb3V0cyk7Y3VyX2FjY3VtPj49ODtjdXJfYml0cy09OH1mbHVzaF9jaGFyKG91dHMpfX10aGlzLmVuY29kZT1lbmNvZGV9bW9kdWxlLmV4cG9ydHM9TFpXRW5jb2Rlcn0se31dLDQ6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBuY3ljbGVzPTEwMDt2YXIgbmV0c2l6ZT0yNTY7dmFyIG1heG5ldHBvcz1uZXRzaXplLTE7dmFyIG5ldGJpYXNzaGlmdD00O3ZhciBpbnRiaWFzc2hpZnQ9MTY7dmFyIGludGJpYXM9MTw8aW50Ymlhc3NoaWZ0O3ZhciBnYW1tYXNoaWZ0PTEwO3ZhciBnYW1tYT0xPDxnYW1tYXNoaWZ0O3ZhciBiZXRhc2hpZnQ9MTA7dmFyIGJldGE9aW50Ymlhcz4+YmV0YXNoaWZ0O3ZhciBiZXRhZ2FtbWE9aW50Ymlhczw8Z2FtbWFzaGlmdC1iZXRhc2hpZnQ7dmFyIGluaXRyYWQ9bmV0c2l6ZT4+Mzt2YXIgcmFkaXVzYmlhc3NoaWZ0PTY7dmFyIHJhZGl1c2JpYXM9MTw8cmFkaXVzYmlhc3NoaWZ0O3ZhciBpbml0cmFkaXVzPWluaXRyYWQqcmFkaXVzYmlhczt2YXIgcmFkaXVzZGVjPTMwO3ZhciBhbHBoYWJpYXNzaGlmdD0xMDt2YXIgaW5pdGFscGhhPTE8PGFscGhhYmlhc3NoaWZ0O3ZhciBhbHBoYWRlYzt2YXIgcmFkYmlhc3NoaWZ0PTg7dmFyIHJhZGJpYXM9MTw8cmFkYmlhc3NoaWZ0O3ZhciBhbHBoYXJhZGJzaGlmdD1hbHBoYWJpYXNzaGlmdCtyYWRiaWFzc2hpZnQ7dmFyIGFscGhhcmFkYmlhcz0xPDxhbHBoYXJhZGJzaGlmdDt2YXIgcHJpbWUxPTQ5OTt2YXIgcHJpbWUyPTQ5MTt2YXIgcHJpbWUzPTQ4Nzt2YXIgcHJpbWU0PTUwMzt2YXIgbWlucGljdHVyZWJ5dGVzPTMqcHJpbWU0O2Z1bmN0aW9uIE5ldVF1YW50KHBpeGVscyxzYW1wbGVmYWMpe3ZhciBuZXR3b3JrO3ZhciBuZXRpbmRleDt2YXIgYmlhczt2YXIgZnJlcTt2YXIgcmFkcG93ZXI7ZnVuY3Rpb24gaW5pdCgpe25ldHdvcms9W107bmV0aW5kZXg9bmV3IEludDMyQXJyYXkoMjU2KTtiaWFzPW5ldyBJbnQzMkFycmF5KG5ldHNpemUpO2ZyZXE9bmV3IEludDMyQXJyYXkobmV0c2l6ZSk7cmFkcG93ZXI9bmV3IEludDMyQXJyYXkobmV0c2l6ZT4+Myk7dmFyIGksdjtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe3Y9KGk8PG5ldGJpYXNzaGlmdCs4KS9uZXRzaXplO25ldHdvcmtbaV09bmV3IEZsb2F0NjRBcnJheShbdix2LHYsMF0pO2ZyZXFbaV09aW50Ymlhcy9uZXRzaXplO2JpYXNbaV09MH19ZnVuY3Rpb24gdW5iaWFzbmV0KCl7Zm9yKHZhciBpPTA7aTxuZXRzaXplO2krKyl7bmV0d29ya1tpXVswXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzFdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bMl0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVszXT1pfX1mdW5jdGlvbiBhbHRlcnNpbmdsZShhbHBoYSxpLGIsZyxyKXtuZXR3b3JrW2ldWzBdLT1hbHBoYSoobmV0d29ya1tpXVswXS1iKS9pbml0YWxwaGE7bmV0d29ya1tpXVsxXS09YWxwaGEqKG5ldHdvcmtbaV1bMV0tZykvaW5pdGFscGhhO25ldHdvcmtbaV1bMl0tPWFscGhhKihuZXR3b3JrW2ldWzJdLXIpL2luaXRhbHBoYX1mdW5jdGlvbiBhbHRlcm5laWdoKHJhZGl1cyxpLGIsZyxyKXt2YXIgbG89TWF0aC5hYnMoaS1yYWRpdXMpO3ZhciBoaT1NYXRoLm1pbihpK3JhZGl1cyxuZXRzaXplKTt2YXIgaj1pKzE7dmFyIGs9aS0xO3ZhciBtPTE7dmFyIHAsYTt3aGlsZShqPGhpfHxrPmxvKXthPXJhZHBvd2VyW20rK107aWYoajxoaSl7cD1uZXR3b3JrW2orK107cFswXS09YSoocFswXS1iKS9hbHBoYXJhZGJpYXM7cFsxXS09YSoocFsxXS1nKS9hbHBoYXJhZGJpYXM7cFsyXS09YSoocFsyXS1yKS9hbHBoYXJhZGJpYXN9aWYoaz5sbyl7cD1uZXR3b3JrW2stLV07cFswXS09YSoocFswXS1iKS9hbHBoYXJhZGJpYXM7cFsxXS09YSoocFsxXS1nKS9hbHBoYXJhZGJpYXM7cFsyXS09YSoocFsyXS1yKS9hbHBoYXJhZGJpYXN9fX1mdW5jdGlvbiBjb250ZXN0KGIsZyxyKXt2YXIgYmVzdGQ9figxPDwzMSk7dmFyIGJlc3RiaWFzZD1iZXN0ZDt2YXIgYmVzdHBvcz0tMTt2YXIgYmVzdGJpYXNwb3M9YmVzdHBvczt2YXIgaSxuLGRpc3QsYmlhc2Rpc3QsYmV0YWZyZXE7Zm9yKGk9MDtpPG5ldHNpemU7aSsrKXtuPW5ldHdvcmtbaV07ZGlzdD1NYXRoLmFicyhuWzBdLWIpK01hdGguYWJzKG5bMV0tZykrTWF0aC5hYnMoblsyXS1yKTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Rwb3M9aX1iaWFzZGlzdD1kaXN0LShiaWFzW2ldPj5pbnRiaWFzc2hpZnQtbmV0Ymlhc3NoaWZ0KTtpZihiaWFzZGlzdDxiZXN0Ymlhc2Qpe2Jlc3RiaWFzZD1iaWFzZGlzdDtiZXN0Ymlhc3Bvcz1pfWJldGFmcmVxPWZyZXFbaV0+PmJldGFzaGlmdDtmcmVxW2ldLT1iZXRhZnJlcTtiaWFzW2ldKz1iZXRhZnJlcTw8Z2FtbWFzaGlmdH1mcmVxW2Jlc3Rwb3NdKz1iZXRhO2JpYXNbYmVzdHBvc10tPWJldGFnYW1tYTtyZXR1cm4gYmVzdGJpYXNwb3N9ZnVuY3Rpb24gaW54YnVpbGQoKXt2YXIgaSxqLHAscSxzbWFsbHBvcyxzbWFsbHZhbCxwcmV2aW91c2NvbD0wLHN0YXJ0cG9zPTA7Zm9yKGk9MDtpPG5ldHNpemU7aSsrKXtwPW5ldHdvcmtbaV07c21hbGxwb3M9aTtzbWFsbHZhbD1wWzFdO2ZvcihqPWkrMTtqPG5ldHNpemU7aisrKXtxPW5ldHdvcmtbal07aWYocVsxXTxzbWFsbHZhbCl7c21hbGxwb3M9ajtzbWFsbHZhbD1xWzFdfX1xPW5ldHdvcmtbc21hbGxwb3NdO2lmKGkhPXNtYWxscG9zKXtqPXFbMF07cVswXT1wWzBdO3BbMF09ajtqPXFbMV07cVsxXT1wWzFdO3BbMV09ajtqPXFbMl07cVsyXT1wWzJdO3BbMl09ajtqPXFbM107cVszXT1wWzNdO3BbM109an1pZihzbWFsbHZhbCE9cHJldmlvdXNjb2wpe25ldGluZGV4W3ByZXZpb3VzY29sXT1zdGFydHBvcytpPj4xO2ZvcihqPXByZXZpb3VzY29sKzE7ajxzbWFsbHZhbDtqKyspbmV0aW5kZXhbal09aTtwcmV2aW91c2NvbD1zbWFsbHZhbDtzdGFydHBvcz1pfX1uZXRpbmRleFtwcmV2aW91c2NvbF09c3RhcnRwb3MrbWF4bmV0cG9zPj4xO2ZvcihqPXByZXZpb3VzY29sKzE7ajwyNTY7aisrKW5ldGluZGV4W2pdPW1heG5ldHBvc31mdW5jdGlvbiBpbnhzZWFyY2goYixnLHIpe3ZhciBhLHAsZGlzdDt2YXIgYmVzdGQ9MWUzO3ZhciBiZXN0PS0xO3ZhciBpPW5ldGluZGV4W2ddO3ZhciBqPWktMTt3aGlsZShpPG5ldHNpemV8fGo+PTApe2lmKGk8bmV0c2l6ZSl7cD1uZXR3b3JrW2ldO2Rpc3Q9cFsxXS1nO2lmKGRpc3Q+PWJlc3RkKWk9bmV0c2l6ZTtlbHNle2krKztpZihkaXN0PDApZGlzdD0tZGlzdDthPXBbMF0tYjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2E9cFsyXS1yO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0PXBbM119fX19aWYoaj49MCl7cD1uZXR3b3JrW2pdO2Rpc3Q9Zy1wWzFdO2lmKGRpc3Q+PWJlc3RkKWo9LTE7ZWxzZXtqLS07aWYoZGlzdDwwKWRpc3Q9LWRpc3Q7YT1wWzBdLWI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXthPXBbMl0tcjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdD1wWzNdfX19fX1yZXR1cm4gYmVzdH1mdW5jdGlvbiBsZWFybigpe3ZhciBpO3ZhciBsZW5ndGhjb3VudD1waXhlbHMubGVuZ3RoO3ZhciBhbHBoYWRlYz0zMCsoc2FtcGxlZmFjLTEpLzM7dmFyIHNhbXBsZXBpeGVscz1sZW5ndGhjb3VudC8oMypzYW1wbGVmYWMpO3ZhciBkZWx0YT1+fihzYW1wbGVwaXhlbHMvbmN5Y2xlcyk7dmFyIGFscGhhPWluaXRhbHBoYTt2YXIgcmFkaXVzPWluaXRyYWRpdXM7dmFyIHJhZD1yYWRpdXM+PnJhZGl1c2JpYXNzaGlmdDtpZihyYWQ8PTEpcmFkPTA7Zm9yKGk9MDtpPHJhZDtpKyspcmFkcG93ZXJbaV09YWxwaGEqKChyYWQqcmFkLWkqaSkqcmFkYmlhcy8ocmFkKnJhZCkpO3ZhciBzdGVwO2lmKGxlbmd0aGNvdW50PG1pbnBpY3R1cmVieXRlcyl7c2FtcGxlZmFjPTE7c3RlcD0zfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUxIT09MCl7c3RlcD0zKnByaW1lMX1lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMiE9PTApe3N0ZXA9MypwcmltZTJ9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTMhPT0wKXtzdGVwPTMqcHJpbWUzfWVsc2V7c3RlcD0zKnByaW1lNH12YXIgYixnLHIsajt2YXIgcGl4PTA7aT0wO3doaWxlKGk8c2FtcGxlcGl4ZWxzKXtiPShwaXhlbHNbcGl4XSYyNTUpPDxuZXRiaWFzc2hpZnQ7Zz0ocGl4ZWxzW3BpeCsxXSYyNTUpPDxuZXRiaWFzc2hpZnQ7cj0ocGl4ZWxzW3BpeCsyXSYyNTUpPDxuZXRiaWFzc2hpZnQ7aj1jb250ZXN0KGIsZyxyKTthbHRlcnNpbmdsZShhbHBoYSxqLGIsZyxyKTtpZihyYWQhPT0wKWFsdGVybmVpZ2gocmFkLGosYixnLHIpO3BpeCs9c3RlcDtpZihwaXg+PWxlbmd0aGNvdW50KXBpeC09bGVuZ3RoY291bnQ7aSsrO2lmKGRlbHRhPT09MClkZWx0YT0xO2lmKGklZGVsdGE9PT0wKXthbHBoYS09YWxwaGEvYWxwaGFkZWM7cmFkaXVzLT1yYWRpdXMvcmFkaXVzZGVjO3JhZD1yYWRpdXM+PnJhZGl1c2JpYXNzaGlmdDtpZihyYWQ8PTEpcmFkPTA7Zm9yKGo9MDtqPHJhZDtqKyspcmFkcG93ZXJbal09YWxwaGEqKChyYWQqcmFkLWoqaikqcmFkYmlhcy8ocmFkKnJhZCkpfX19ZnVuY3Rpb24gYnVpbGRDb2xvcm1hcCgpe2luaXQoKTtsZWFybigpO3VuYmlhc25ldCgpO2lueGJ1aWxkKCl9dGhpcy5idWlsZENvbG9ybWFwPWJ1aWxkQ29sb3JtYXA7ZnVuY3Rpb24gZ2V0Q29sb3JtYXAoKXt2YXIgbWFwPVtdO3ZhciBpbmRleD1bXTtmb3IodmFyIGk9MDtpPG5ldHNpemU7aSsrKWluZGV4W25ldHdvcmtbaV1bM11dPWk7dmFyIGs9MDtmb3IodmFyIGw9MDtsPG5ldHNpemU7bCsrKXt2YXIgaj1pbmRleFtsXTttYXBbaysrXT1uZXR3b3JrW2pdWzBdO21hcFtrKytdPW5ldHdvcmtbal1bMV07bWFwW2srK109bmV0d29ya1tqXVsyXX1yZXR1cm4gbWFwfXRoaXMuZ2V0Q29sb3JtYXA9Z2V0Q29sb3JtYXA7dGhpcy5sb29rdXBSR0I9aW54c2VhcmNofW1vZHVsZS5leHBvcnRzPU5ldVF1YW50fSx7fV0sNTpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIFVBLGJyb3dzZXIsbW9kZSxwbGF0Zm9ybSx1YTt1YT1uYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7cGxhdGZvcm09bmF2aWdhdG9yLnBsYXRmb3JtLnRvTG93ZXJDYXNlKCk7VUE9dWEubWF0Y2goLyhvcGVyYXxpZXxmaXJlZm94fGNocm9tZXx2ZXJzaW9uKVtcXHNcXC86XShbXFx3XFxkXFwuXSspPy4qPyhzYWZhcml8dmVyc2lvbltcXHNcXC86XShbXFx3XFxkXFwuXSspfCQpLyl8fFtudWxsLFwidW5rbm93blwiLDBdO21vZGU9VUFbMV09PT1cImllXCImJmRvY3VtZW50LmRvY3VtZW50TW9kZTticm93c2VyPXtuYW1lOlVBWzFdPT09XCJ2ZXJzaW9uXCI/VUFbM106VUFbMV0sdmVyc2lvbjptb2RlfHxwYXJzZUZsb2F0KFVBWzFdPT09XCJvcGVyYVwiJiZVQVs0XT9VQVs0XTpVQVsyXSkscGxhdGZvcm06e25hbWU6dWEubWF0Y2goL2lwKD86YWR8b2R8aG9uZSkvKT9cImlvc1wiOih1YS5tYXRjaCgvKD86d2Vib3N8YW5kcm9pZCkvKXx8cGxhdGZvcm0ubWF0Y2goL21hY3x3aW58bGludXgvKXx8W1wib3RoZXJcIl0pWzBdfX07YnJvd3Nlclticm93c2VyLm5hbWVdPXRydWU7YnJvd3Nlclticm93c2VyLm5hbWUrcGFyc2VJbnQoYnJvd3Nlci52ZXJzaW9uLDEwKV09dHJ1ZTticm93c2VyLnBsYXRmb3JtW2Jyb3dzZXIucGxhdGZvcm0ubmFtZV09dHJ1ZTttb2R1bGUuZXhwb3J0cz1icm93c2VyfSx7fV0sNjpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEV2ZW50RW1pdHRlcixHSUYsR0lGRW5jb2Rlcixicm93c2VyLGdpZldvcmtlcixleHRlbmQ9ZnVuY3Rpb24oY2hpbGQscGFyZW50KXtmb3IodmFyIGtleSBpbiBwYXJlbnQpe2lmKGhhc1Byb3AuY2FsbChwYXJlbnQsa2V5KSljaGlsZFtrZXldPXBhcmVudFtrZXldfWZ1bmN0aW9uIGN0b3IoKXt0aGlzLmNvbnN0cnVjdG9yPWNoaWxkfWN0b3IucHJvdG90eXBlPXBhcmVudC5wcm90b3R5cGU7Y2hpbGQucHJvdG90eXBlPW5ldyBjdG9yO2NoaWxkLl9fc3VwZXJfXz1wYXJlbnQucHJvdG90eXBlO3JldHVybiBjaGlsZH0saGFzUHJvcD17fS5oYXNPd25Qcm9wZXJ0eSxpbmRleE9mPVtdLmluZGV4T2Z8fGZ1bmN0aW9uKGl0ZW0pe2Zvcih2YXIgaT0wLGw9dGhpcy5sZW5ndGg7aTxsO2krKyl7aWYoaSBpbiB0aGlzJiZ0aGlzW2ldPT09aXRlbSlyZXR1cm4gaX1yZXR1cm4tMX0sc2xpY2U9W10uc2xpY2U7RXZlbnRFbWl0dGVyPXJlcXVpcmUoXCJldmVudHNcIikuRXZlbnRFbWl0dGVyO2Jyb3dzZXI9cmVxdWlyZShcIi4vYnJvd3Nlci5jb2ZmZWVcIik7R0lGRW5jb2Rlcj1yZXF1aXJlKFwiLi9HSUZFbmNvZGVyLmpzXCIpO2dpZldvcmtlcj1yZXF1aXJlKFwiLi9naWYud29ya2VyLmNvZmZlZVwiKTttb2R1bGUuZXhwb3J0cz1HSUY9ZnVuY3Rpb24oc3VwZXJDbGFzcyl7dmFyIGRlZmF1bHRzLGZyYW1lRGVmYXVsdHM7ZXh0ZW5kKEdJRixzdXBlckNsYXNzKTtkZWZhdWx0cz17d29ya2VyU2NyaXB0OlwiZ2lmLndvcmtlci5qc1wiLHdvcmtlcnM6MixyZXBlYXQ6MCxiYWNrZ3JvdW5kOlwiI2ZmZlwiLHF1YWxpdHk6MTAsd2lkdGg6bnVsbCxoZWlnaHQ6bnVsbCx0cmFuc3BhcmVudDpudWxsLGRlYnVnOmZhbHNlLGRpdGhlcjpmYWxzZX07ZnJhbWVEZWZhdWx0cz17ZGVsYXk6NTAwLGNvcHk6ZmFsc2UsZGlzcG9zZTotMX07ZnVuY3Rpb24gR0lGKG9wdGlvbnMpe3ZhciBiYXNlLGtleSx2YWx1ZTt0aGlzLnJ1bm5pbmc9ZmFsc2U7dGhpcy5vcHRpb25zPXt9O3RoaXMuZnJhbWVzPVtdO3RoaXMuZnJlZVdvcmtlcnM9W107dGhpcy5hY3RpdmVXb3JrZXJzPVtdO3RoaXMuc2V0T3B0aW9ucyhvcHRpb25zKTtmb3Ioa2V5IGluIGRlZmF1bHRzKXt2YWx1ZT1kZWZhdWx0c1trZXldO2lmKChiYXNlPXRoaXMub3B0aW9ucylba2V5XT09bnVsbCl7YmFzZVtrZXldPXZhbHVlfX19R0lGLnByb3RvdHlwZS5zZXRPcHRpb249ZnVuY3Rpb24oa2V5LHZhbHVlKXt0aGlzLm9wdGlvbnNba2V5XT12YWx1ZTtpZih0aGlzLl9jYW52YXMhPW51bGwmJihrZXk9PT1cIndpZHRoXCJ8fGtleT09PVwiaGVpZ2h0XCIpKXtyZXR1cm4gdGhpcy5fY2FudmFzW2tleV09dmFsdWV9fTtHSUYucHJvdG90eXBlLnNldE9wdGlvbnM9ZnVuY3Rpb24ob3B0aW9ucyl7dmFyIGtleSxyZXN1bHRzLHZhbHVlO3Jlc3VsdHM9W107Zm9yKGtleSBpbiBvcHRpb25zKXtpZighaGFzUHJvcC5jYWxsKG9wdGlvbnMsa2V5KSljb250aW51ZTt2YWx1ZT1vcHRpb25zW2tleV07cmVzdWx0cy5wdXNoKHRoaXMuc2V0T3B0aW9uKGtleSx2YWx1ZSkpfXJldHVybiByZXN1bHRzfTtHSUYucHJvdG90eXBlLmFkZEZyYW1lPWZ1bmN0aW9uKGltYWdlLG9wdGlvbnMpe3ZhciBmcmFtZSxrZXk7aWYob3B0aW9ucz09bnVsbCl7b3B0aW9ucz17fX1mcmFtZT17fTtmcmFtZS50cmFuc3BhcmVudD10aGlzLm9wdGlvbnMudHJhbnNwYXJlbnQ7Zm9yKGtleSBpbiBmcmFtZURlZmF1bHRzKXtmcmFtZVtrZXldPW9wdGlvbnNba2V5XXx8ZnJhbWVEZWZhdWx0c1trZXldfWlmKHRoaXMub3B0aW9ucy53aWR0aD09bnVsbCl7dGhpcy5zZXRPcHRpb24oXCJ3aWR0aFwiLGltYWdlLndpZHRoKX1pZih0aGlzLm9wdGlvbnMuaGVpZ2h0PT1udWxsKXt0aGlzLnNldE9wdGlvbihcImhlaWdodFwiLGltYWdlLmhlaWdodCl9aWYodHlwZW9mIEltYWdlRGF0YSE9PVwidW5kZWZpbmVkXCImJkltYWdlRGF0YSE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgSW1hZ2VEYXRhKXtmcmFtZS5kYXRhPWltYWdlLmRhdGF9ZWxzZSBpZih0eXBlb2YgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIT09XCJ1bmRlZmluZWRcIiYmQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkR8fHR5cGVvZiBXZWJHTFJlbmRlcmluZ0NvbnRleHQhPT1cInVuZGVmaW5lZFwiJiZXZWJHTFJlbmRlcmluZ0NvbnRleHQhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIFdlYkdMUmVuZGVyaW5nQ29udGV4dCl7aWYob3B0aW9ucy5jb3B5KXtmcmFtZS5kYXRhPXRoaXMuZ2V0Q29udGV4dERhdGEoaW1hZ2UpfWVsc2V7ZnJhbWUuY29udGV4dD1pbWFnZX19ZWxzZSBpZihpbWFnZS5jaGlsZE5vZGVzIT1udWxsKXtpZihvcHRpb25zLmNvcHkpe2ZyYW1lLmRhdGE9dGhpcy5nZXRJbWFnZURhdGEoaW1hZ2UpfWVsc2V7ZnJhbWUuaW1hZ2U9aW1hZ2V9fWVsc2V7dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBpbWFnZVwiKX1yZXR1cm4gdGhpcy5mcmFtZXMucHVzaChmcmFtZSl9O0dJRi5wcm90b3R5cGUucmVuZGVyPWZ1bmN0aW9uKCl7dmFyIGksaixudW1Xb3JrZXJzLHJlZjtpZih0aGlzLnJ1bm5pbmcpe3Rocm93IG5ldyBFcnJvcihcIkFscmVhZHkgcnVubmluZ1wiKX1pZih0aGlzLm9wdGlvbnMud2lkdGg9PW51bGx8fHRoaXMub3B0aW9ucy5oZWlnaHQ9PW51bGwpe3Rocm93IG5ldyBFcnJvcihcIldpZHRoIGFuZCBoZWlnaHQgbXVzdCBiZSBzZXQgcHJpb3IgdG8gcmVuZGVyaW5nXCIpfXRoaXMucnVubmluZz10cnVlO3RoaXMubmV4dEZyYW1lPTA7dGhpcy5maW5pc2hlZEZyYW1lcz0wO3RoaXMuaW1hZ2VQYXJ0cz1mdW5jdGlvbigpe3ZhciBqLHJlZixyZXN1bHRzO3Jlc3VsdHM9W107Zm9yKGk9aj0wLHJlZj10aGlzLmZyYW1lcy5sZW5ndGg7MDw9cmVmP2o8cmVmOmo+cmVmO2k9MDw9cmVmPysrajotLWope3Jlc3VsdHMucHVzaChudWxsKX1yZXR1cm4gcmVzdWx0c30uY2FsbCh0aGlzKTtudW1Xb3JrZXJzPXRoaXMuc3Bhd25Xb3JrZXJzKCk7aWYodGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGU9PT10cnVlKXt0aGlzLnJlbmRlck5leHRGcmFtZSgpfWVsc2V7Zm9yKGk9aj0wLHJlZj1udW1Xb3JrZXJzOzA8PXJlZj9qPHJlZjpqPnJlZjtpPTA8PXJlZj8rK2o6LS1qKXt0aGlzLnJlbmRlck5leHRGcmFtZSgpfX10aGlzLmVtaXQoXCJzdGFydFwiKTtyZXR1cm4gdGhpcy5lbWl0KFwicHJvZ3Jlc3NcIiwwKX07R0lGLnByb3RvdHlwZS5hYm9ydD1mdW5jdGlvbigpe3ZhciB3b3JrZXI7d2hpbGUodHJ1ZSl7d29ya2VyPXRoaXMuYWN0aXZlV29ya2Vycy5zaGlmdCgpO2lmKHdvcmtlcj09bnVsbCl7YnJlYWt9dGhpcy5sb2coXCJraWxsaW5nIGFjdGl2ZSB3b3JrZXJcIik7d29ya2VyLnRlcm1pbmF0ZSgpfXRoaXMucnVubmluZz1mYWxzZTtyZXR1cm4gdGhpcy5lbWl0KFwiYWJvcnRcIil9O0dJRi5wcm90b3R5cGUuc3Bhd25Xb3JrZXJzPWZ1bmN0aW9uKCl7dmFyIGosbnVtV29ya2VycyxyZWYscmVzdWx0cztudW1Xb3JrZXJzPU1hdGgubWluKHRoaXMub3B0aW9ucy53b3JrZXJzLHRoaXMuZnJhbWVzLmxlbmd0aCk7KGZ1bmN0aW9uKCl7cmVzdWx0cz1bXTtmb3IodmFyIGo9cmVmPXRoaXMuZnJlZVdvcmtlcnMubGVuZ3RoO3JlZjw9bnVtV29ya2Vycz9qPG51bVdvcmtlcnM6aj5udW1Xb3JrZXJzO3JlZjw9bnVtV29ya2Vycz9qKys6ai0tKXtyZXN1bHRzLnB1c2goail9cmV0dXJuIHJlc3VsdHN9KS5hcHBseSh0aGlzKS5mb3JFYWNoKGZ1bmN0aW9uKF90aGlzKXtyZXR1cm4gZnVuY3Rpb24oaSl7dmFyIHdvcmtlcjtfdGhpcy5sb2coXCJzcGF3bmluZyB3b3JrZXIgXCIraSk7d29ya2VyPW5ldyBXb3JrZXIoX3RoaXMub3B0aW9ucy53b3JrZXJTY3JpcHQpO3dvcmtlci5vbm1lc3NhZ2U9ZnVuY3Rpb24oZXZlbnQpe190aGlzLmFjdGl2ZVdvcmtlcnMuc3BsaWNlKF90aGlzLmFjdGl2ZVdvcmtlcnMuaW5kZXhPZih3b3JrZXIpLDEpO190aGlzLmZyZWVXb3JrZXJzLnB1c2god29ya2VyKTtyZXR1cm4gX3RoaXMuZnJhbWVGaW5pc2hlZChldmVudC5kYXRhKX07cmV0dXJuIF90aGlzLmZyZWVXb3JrZXJzLnB1c2god29ya2VyKX19KHRoaXMpKTtyZXR1cm4gbnVtV29ya2Vyc307R0lGLnByb3RvdHlwZS5mcmFtZUZpbmlzaGVkPWZ1bmN0aW9uKGZyYW1lKXt2YXIgaSxqLHJlZjt0aGlzLmxvZyhcImZyYW1lIFwiK2ZyYW1lLmluZGV4K1wiIGZpbmlzaGVkIC0gXCIrdGhpcy5hY3RpdmVXb3JrZXJzLmxlbmd0aCtcIiBhY3RpdmVcIik7dGhpcy5maW5pc2hlZEZyYW1lcysrO3RoaXMuZW1pdChcInByb2dyZXNzXCIsdGhpcy5maW5pc2hlZEZyYW1lcy90aGlzLmZyYW1lcy5sZW5ndGgpO3RoaXMuaW1hZ2VQYXJ0c1tmcmFtZS5pbmRleF09ZnJhbWU7aWYodGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGU9PT10cnVlKXt0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT1mcmFtZS5nbG9iYWxQYWxldHRlO3RoaXMubG9nKFwiZ2xvYmFsIHBhbGV0dGUgYW5hbHl6ZWRcIik7aWYodGhpcy5mcmFtZXMubGVuZ3RoPjIpe2ZvcihpPWo9MSxyZWY9dGhpcy5mcmVlV29ya2Vycy5sZW5ndGg7MTw9cmVmP2o8cmVmOmo+cmVmO2k9MTw9cmVmPysrajotLWope3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9fX1pZihpbmRleE9mLmNhbGwodGhpcy5pbWFnZVBhcnRzLG51bGwpPj0wKXtyZXR1cm4gdGhpcy5yZW5kZXJOZXh0RnJhbWUoKX1lbHNle3JldHVybiB0aGlzLmZpbmlzaFJlbmRlcmluZygpfX07R0lGLnByb3RvdHlwZS5maW5pc2hSZW5kZXJpbmc9ZnVuY3Rpb24oKXt2YXIgZGF0YSxmcmFtZSxpLGltYWdlLGosayxsLGxlbixsZW4xLGxlbjIsbGVuMyxvZmZzZXQscGFnZSxyZWYscmVmMSxyZWYyO2xlbj0wO3JlZj10aGlzLmltYWdlUGFydHM7Zm9yKGo9MCxsZW4xPXJlZi5sZW5ndGg7ajxsZW4xO2orKyl7ZnJhbWU9cmVmW2pdO2xlbis9KGZyYW1lLmRhdGEubGVuZ3RoLTEpKmZyYW1lLnBhZ2VTaXplK2ZyYW1lLmN1cnNvcn1sZW4rPWZyYW1lLnBhZ2VTaXplLWZyYW1lLmN1cnNvcjt0aGlzLmxvZyhcInJlbmRlcmluZyBmaW5pc2hlZCAtIGZpbGVzaXplIFwiK01hdGgucm91bmQobGVuLzFlMykrXCJrYlwiKTtkYXRhPW5ldyBVaW50OEFycmF5KGxlbik7b2Zmc2V0PTA7cmVmMT10aGlzLmltYWdlUGFydHM7Zm9yKGs9MCxsZW4yPXJlZjEubGVuZ3RoO2s8bGVuMjtrKyspe2ZyYW1lPXJlZjFba107cmVmMj1mcmFtZS5kYXRhO2ZvcihpPWw9MCxsZW4zPXJlZjIubGVuZ3RoO2w8bGVuMztpPSsrbCl7cGFnZT1yZWYyW2ldO2RhdGEuc2V0KHBhZ2Usb2Zmc2V0KTtpZihpPT09ZnJhbWUuZGF0YS5sZW5ndGgtMSl7b2Zmc2V0Kz1mcmFtZS5jdXJzb3J9ZWxzZXtvZmZzZXQrPWZyYW1lLnBhZ2VTaXplfX19aW1hZ2U9bmV3IEJsb2IoW2RhdGFdLHt0eXBlOlwiaW1hZ2UvZ2lmXCJ9KTtyZXR1cm4gdGhpcy5lbWl0KFwiZmluaXNoZWRcIixpbWFnZSxkYXRhKX07R0lGLnByb3RvdHlwZS5yZW5kZXJOZXh0RnJhbWU9ZnVuY3Rpb24oKXt2YXIgZnJhbWUsdGFzayx3b3JrZXI7aWYodGhpcy5mcmVlV29ya2Vycy5sZW5ndGg9PT0wKXt0aHJvdyBuZXcgRXJyb3IoXCJObyBmcmVlIHdvcmtlcnNcIil9aWYodGhpcy5uZXh0RnJhbWU+PXRoaXMuZnJhbWVzLmxlbmd0aCl7cmV0dXJufWZyYW1lPXRoaXMuZnJhbWVzW3RoaXMubmV4dEZyYW1lKytdO3dvcmtlcj10aGlzLmZyZWVXb3JrZXJzLnNoaWZ0KCk7dGFzaz10aGlzLmdldFRhc2soZnJhbWUpO3RoaXMubG9nKFwic3RhcnRpbmcgZnJhbWUgXCIrKHRhc2suaW5kZXgrMSkrXCIgb2YgXCIrdGhpcy5mcmFtZXMubGVuZ3RoKTt0aGlzLmFjdGl2ZVdvcmtlcnMucHVzaCh3b3JrZXIpO3JldHVybiB3b3JrZXIucG9zdE1lc3NhZ2UodGFzayl9O0dJRi5wcm90b3R5cGUuZ2V0Q29udGV4dERhdGE9ZnVuY3Rpb24oY3R4KXtyZXR1cm4gY3R4LmdldEltYWdlRGF0YSgwLDAsdGhpcy5vcHRpb25zLndpZHRoLHRoaXMub3B0aW9ucy5oZWlnaHQpLmRhdGF9O0dJRi5wcm90b3R5cGUuZ2V0SW1hZ2VEYXRhPWZ1bmN0aW9uKGltYWdlKXt2YXIgY3R4O2lmKHRoaXMuX2NhbnZhcz09bnVsbCl7dGhpcy5fY2FudmFzPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7dGhpcy5fY2FudmFzLndpZHRoPXRoaXMub3B0aW9ucy53aWR0aDt0aGlzLl9jYW52YXMuaGVpZ2h0PXRoaXMub3B0aW9ucy5oZWlnaHR9Y3R4PXRoaXMuX2NhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7Y3R4LnNldEZpbGw9dGhpcy5vcHRpb25zLmJhY2tncm91bmQ7Y3R4LmZpbGxSZWN0KDAsMCx0aGlzLm9wdGlvbnMud2lkdGgsdGhpcy5vcHRpb25zLmhlaWdodCk7Y3R4LmRyYXdJbWFnZShpbWFnZSwwLDApO3JldHVybiB0aGlzLmdldENvbnRleHREYXRhKGN0eCl9O0dJRi5wcm90b3R5cGUuZ2V0VGFzaz1mdW5jdGlvbihmcmFtZSl7dmFyIGluZGV4LHRhc2s7aW5kZXg9dGhpcy5mcmFtZXMuaW5kZXhPZihmcmFtZSk7dGFzaz17aW5kZXg6aW5kZXgsbGFzdDppbmRleD09PXRoaXMuZnJhbWVzLmxlbmd0aC0xLGRlbGF5OmZyYW1lLmRlbGF5LGRpc3Bvc2U6ZnJhbWUuZGlzcG9zZSx0cmFuc3BhcmVudDpmcmFtZS50cmFuc3BhcmVudCx3aWR0aDp0aGlzLm9wdGlvbnMud2lkdGgsaGVpZ2h0OnRoaXMub3B0aW9ucy5oZWlnaHQscXVhbGl0eTp0aGlzLm9wdGlvbnMucXVhbGl0eSxkaXRoZXI6dGhpcy5vcHRpb25zLmRpdGhlcixnbG9iYWxQYWxldHRlOnRoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlLHJlcGVhdDp0aGlzLm9wdGlvbnMucmVwZWF0LGNhblRyYW5zZmVyOmJyb3dzZXIubmFtZT09PVwiY2hyb21lXCJ9O2lmKGZyYW1lLmRhdGEhPW51bGwpe3Rhc2suZGF0YT1mcmFtZS5kYXRhfWVsc2UgaWYoZnJhbWUuY29udGV4dCE9bnVsbCl7dGFzay5kYXRhPXRoaXMuZ2V0Q29udGV4dERhdGEoZnJhbWUuY29udGV4dCl9ZWxzZSBpZihmcmFtZS5pbWFnZSE9bnVsbCl7dGFzay5kYXRhPXRoaXMuZ2V0SW1hZ2VEYXRhKGZyYW1lLmltYWdlKX1lbHNle3Rocm93IG5ldyBFcnJvcihcIkludmFsaWQgZnJhbWVcIil9cmV0dXJuIHRhc2t9O0dJRi5wcm90b3R5cGUubG9nPWZ1bmN0aW9uKCl7dmFyIGFyZ3M7YXJncz0xPD1hcmd1bWVudHMubGVuZ3RoP3NsaWNlLmNhbGwoYXJndW1lbnRzLDApOltdO2lmKCF0aGlzLm9wdGlvbnMuZGVidWcpe3JldHVybn1yZXR1cm4gY29uc29sZS5sb2cuYXBwbHkoY29uc29sZSxhcmdzKX07cmV0dXJuIEdJRn0oRXZlbnRFbWl0dGVyKX0se1wiLi9HSUZFbmNvZGVyLmpzXCI6MixcIi4vYnJvd3Nlci5jb2ZmZWVcIjo1LFwiLi9naWYud29ya2VyLmNvZmZlZVwiOjcsZXZlbnRzOjF9XSw3OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgR0lGRW5jb2RlcixyZW5kZXJGcmFtZTtHSUZFbmNvZGVyPXJlcXVpcmUoXCIuL0dJRkVuY29kZXIuanNcIik7cmVuZGVyRnJhbWU9ZnVuY3Rpb24oZnJhbWUpe3ZhciBlbmNvZGVyLHBhZ2Usc3RyZWFtLHRyYW5zZmVyO2VuY29kZXI9bmV3IEdJRkVuY29kZXIoZnJhbWUud2lkdGgsZnJhbWUuaGVpZ2h0KTtpZihmcmFtZS5pbmRleD09PTApe2VuY29kZXIud3JpdGVIZWFkZXIoKX1lbHNle2VuY29kZXIuZmlyc3RGcmFtZT1mYWxzZX1lbmNvZGVyLnNldFRyYW5zcGFyZW50KGZyYW1lLnRyYW5zcGFyZW50KTtlbmNvZGVyLnNldERpc3Bvc2UoZnJhbWUuZGlzcG9zZSk7ZW5jb2Rlci5zZXRSZXBlYXQoZnJhbWUucmVwZWF0KTtlbmNvZGVyLnNldERlbGF5KGZyYW1lLmRlbGF5KTtlbmNvZGVyLnNldFF1YWxpdHkoZnJhbWUucXVhbGl0eSk7ZW5jb2Rlci5zZXREaXRoZXIoZnJhbWUuZGl0aGVyKTtlbmNvZGVyLnNldEdsb2JhbFBhbGV0dGUoZnJhbWUuZ2xvYmFsUGFsZXR0ZSk7ZW5jb2Rlci5hZGRGcmFtZShmcmFtZS5kYXRhKTtpZihmcmFtZS5sYXN0KXtlbmNvZGVyLmZpbmlzaCgpfWlmKGZyYW1lLmdsb2JhbFBhbGV0dGU9PT10cnVlKXtmcmFtZS5nbG9iYWxQYWxldHRlPWVuY29kZXIuZ2V0R2xvYmFsUGFsZXR0ZSgpfXN0cmVhbT1lbmNvZGVyLnN0cmVhbSgpO2ZyYW1lLmRhdGE9c3RyZWFtLnBhZ2VzO2ZyYW1lLmN1cnNvcj1zdHJlYW0uY3Vyc29yO2ZyYW1lLnBhZ2VTaXplPXN0cmVhbS5jb25zdHJ1Y3Rvci5wYWdlU2l6ZTtpZihmcmFtZS5jYW5UcmFuc2Zlcil7dHJhbnNmZXI9ZnVuY3Rpb24oKXt2YXIgaSxsZW4scmVmLHJlc3VsdHM7cmVmPWZyYW1lLmRhdGE7cmVzdWx0cz1bXTtmb3IoaT0wLGxlbj1yZWYubGVuZ3RoO2k8bGVuO2krKyl7cGFnZT1yZWZbaV07cmVzdWx0cy5wdXNoKHBhZ2UuYnVmZmVyKX1yZXR1cm4gcmVzdWx0c30oKTtyZXR1cm4gc2VsZi5wb3N0TWVzc2FnZShmcmFtZSx0cmFuc2Zlcil9ZWxzZXtyZXR1cm4gc2VsZi5wb3N0TWVzc2FnZShmcmFtZSl9fTtzZWxmLm9ubWVzc2FnZT1mdW5jdGlvbihldmVudCl7cmV0dXJuIHJlbmRlckZyYW1lKGV2ZW50LmRhdGEpfX0se1wiLi9HSUZFbmNvZGVyLmpzXCI6Mn1dfSx7fSxbNl0pKDYpfSk7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWdpZi5qcy5tYXBcclxuIiwiOyhmdW5jdGlvbigpIHtcclxuXHJcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgdmFyIFRhciA9IHJlcXVpcmUoJy4vdGFyLmpzJyk7XHJcbiAgdmFyIGRvd25sb2FkID0gcmVxdWlyZSgnLi9kb3dubG9hZC5qcycpO1xyXG4gIHZhciBHSUYgPSByZXF1aXJlKCcuL2dpZi5qcycpO1xyXG59XHJcblxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBvYmplY3RUeXBlcyA9IHtcclxuJ2Z1bmN0aW9uJzogdHJ1ZSxcclxuJ29iamVjdCc6IHRydWVcclxufTtcclxuXHJcbmZ1bmN0aW9uIGNoZWNrR2xvYmFsKHZhbHVlKSB7XHJcbiAgICByZXR1cm4gKHZhbHVlICYmIHZhbHVlLk9iamVjdCA9PT0gT2JqZWN0KSA/IHZhbHVlIDogbnVsbDtcclxuICB9XHJcblxyXG4vKiogQnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMgd2l0aG91dCBhIGRlcGVuZGVuY3kgb24gYHJvb3RgLiAqL1xyXG52YXIgZnJlZVBhcnNlRmxvYXQgPSBwYXJzZUZsb2F0LFxyXG4gIGZyZWVQYXJzZUludCA9IHBhcnNlSW50O1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBleHBvcnRzYC4gKi9cclxudmFyIGZyZWVFeHBvcnRzID0gKG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlKVxyXG4/IGV4cG9ydHNcclxuOiB1bmRlZmluZWQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYG1vZHVsZWAuICovXHJcbnZhciBmcmVlTW9kdWxlID0gKG9iamVjdFR5cGVzW3R5cGVvZiBtb2R1bGVdICYmIG1vZHVsZSAmJiAhbW9kdWxlLm5vZGVUeXBlKVxyXG4/IG1vZHVsZVxyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgdGhlIHBvcHVsYXIgQ29tbW9uSlMgZXh0ZW5zaW9uIGBtb2R1bGUuZXhwb3J0c2AuICovXHJcbnZhciBtb2R1bGVFeHBvcnRzID0gKGZyZWVNb2R1bGUgJiYgZnJlZU1vZHVsZS5leHBvcnRzID09PSBmcmVlRXhwb3J0cylcclxuPyBmcmVlRXhwb3J0c1xyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZ2xvYmFsYCBmcm9tIE5vZGUuanMuICovXHJcbnZhciBmcmVlR2xvYmFsID0gY2hlY2tHbG9iYWwoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSAmJiB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbCk7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHNlbGZgLiAqL1xyXG52YXIgZnJlZVNlbGYgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygc2VsZl0gJiYgc2VsZik7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHdpbmRvd2AuICovXHJcbnZhciBmcmVlV2luZG93ID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHdpbmRvd10gJiYgd2luZG93KTtcclxuXHJcbi8qKiBEZXRlY3QgYHRoaXNgIGFzIHRoZSBnbG9iYWwgb2JqZWN0LiAqL1xyXG52YXIgdGhpc0dsb2JhbCA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB0aGlzXSAmJiB0aGlzKTtcclxuXHJcbi8qKlxyXG4qIFVzZWQgYXMgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbCBvYmplY3QuXHJcbipcclxuKiBUaGUgYHRoaXNgIHZhbHVlIGlzIHVzZWQgaWYgaXQncyB0aGUgZ2xvYmFsIG9iamVjdCB0byBhdm9pZCBHcmVhc2Vtb25rZXknc1xyXG4qIHJlc3RyaWN0ZWQgYHdpbmRvd2Agb2JqZWN0LCBvdGhlcndpc2UgdGhlIGB3aW5kb3dgIG9iamVjdCBpcyB1c2VkLlxyXG4qL1xyXG52YXIgcm9vdCA9IGZyZWVHbG9iYWwgfHxcclxuKChmcmVlV2luZG93ICE9PSAodGhpc0dsb2JhbCAmJiB0aGlzR2xvYmFsLndpbmRvdykpICYmIGZyZWVXaW5kb3cpIHx8XHJcbiAgZnJlZVNlbGYgfHwgdGhpc0dsb2JhbCB8fCBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xyXG5cclxuaWYoICEoJ2djJyBpbiB3aW5kb3cgKSApIHtcclxuXHR3aW5kb3cuZ2MgPSBmdW5jdGlvbigpe31cclxufVxyXG5cclxuaWYgKCFIVE1MQ2FudmFzRWxlbWVudC5wcm90b3R5cGUudG9CbG9iKSB7XHJcbiBPYmplY3QuZGVmaW5lUHJvcGVydHkoSFRNTENhbnZhc0VsZW1lbnQucHJvdG90eXBlLCAndG9CbG9iJywge1xyXG4gIHZhbHVlOiBmdW5jdGlvbiAoY2FsbGJhY2ssIHR5cGUsIHF1YWxpdHkpIHtcclxuXHJcbiAgICB2YXIgYmluU3RyID0gYXRvYiggdGhpcy50b0RhdGFVUkwodHlwZSwgcXVhbGl0eSkuc3BsaXQoJywnKVsxXSApLFxyXG4gICAgICAgIGxlbiA9IGJpblN0ci5sZW5ndGgsXHJcbiAgICAgICAgYXJyID0gbmV3IFVpbnQ4QXJyYXkobGVuKTtcclxuXHJcbiAgICBmb3IgKHZhciBpPTA7IGk8bGVuOyBpKysgKSB7XHJcbiAgICAgYXJyW2ldID0gYmluU3RyLmNoYXJDb2RlQXQoaSk7XHJcbiAgICB9XHJcblxyXG4gICAgY2FsbGJhY2soIG5ldyBCbG9iKCBbYXJyXSwge3R5cGU6IHR5cGUgfHwgJ2ltYWdlL3BuZyd9ICkgKTtcclxuICB9XHJcbiB9KTtcclxufVxyXG5cclxuLy8gQGxpY2Vuc2UgaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVFxyXG4vLyBjb3B5cmlnaHQgUGF1bCBJcmlzaCAyMDE1XHJcblxyXG5cclxuLy8gRGF0ZS5ub3coKSBpcyBzdXBwb3J0ZWQgZXZlcnl3aGVyZSBleGNlcHQgSUU4LiBGb3IgSUU4IHdlIHVzZSB0aGUgRGF0ZS5ub3cgcG9seWZpbGxcclxuLy8gICBnaXRodWIuY29tL0ZpbmFuY2lhbC1UaW1lcy9wb2x5ZmlsbC1zZXJ2aWNlL2Jsb2IvbWFzdGVyL3BvbHlmaWxscy9EYXRlLm5vdy9wb2x5ZmlsbC5qc1xyXG4vLyBhcyBTYWZhcmkgNiBkb2Vzbid0IGhhdmUgc3VwcG9ydCBmb3IgTmF2aWdhdGlvblRpbWluZywgd2UgdXNlIGEgRGF0ZS5ub3coKSB0aW1lc3RhbXAgZm9yIHJlbGF0aXZlIHZhbHVlc1xyXG5cclxuLy8gaWYgeW91IHdhbnQgdmFsdWVzIHNpbWlsYXIgdG8gd2hhdCB5b3UnZCBnZXQgd2l0aCByZWFsIHBlcmYubm93LCBwbGFjZSB0aGlzIHRvd2FyZHMgdGhlIGhlYWQgb2YgdGhlIHBhZ2VcclxuLy8gYnV0IGluIHJlYWxpdHksIHlvdSdyZSBqdXN0IGdldHRpbmcgdGhlIGRlbHRhIGJldHdlZW4gbm93KCkgY2FsbHMsIHNvIGl0J3Mgbm90IHRlcnJpYmx5IGltcG9ydGFudCB3aGVyZSBpdCdzIHBsYWNlZFxyXG5cclxuXHJcbihmdW5jdGlvbigpe1xyXG5cclxuICBpZiAoXCJwZXJmb3JtYW5jZVwiIGluIHdpbmRvdyA9PSBmYWxzZSkge1xyXG4gICAgICB3aW5kb3cucGVyZm9ybWFuY2UgPSB7fTtcclxuICB9XHJcblxyXG4gIERhdGUubm93ID0gKERhdGUubm93IHx8IGZ1bmN0aW9uICgpIHsgIC8vIHRoYW5rcyBJRThcclxuXHQgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICB9KTtcclxuXHJcbiAgaWYgKFwibm93XCIgaW4gd2luZG93LnBlcmZvcm1hbmNlID09IGZhbHNlKXtcclxuXHJcbiAgICB2YXIgbm93T2Zmc2V0ID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICBpZiAocGVyZm9ybWFuY2UudGltaW5nICYmIHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQpe1xyXG4gICAgICBub3dPZmZzZXQgPSBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0XHJcbiAgICB9XHJcblxyXG4gICAgd2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uIG5vdygpe1xyXG4gICAgICByZXR1cm4gRGF0ZS5ub3coKSAtIG5vd09mZnNldDtcclxuICAgIH1cclxuICB9XHJcblxyXG59KSgpO1xyXG5cclxuXHJcbmZ1bmN0aW9uIHBhZCggbiApIHtcclxuXHRyZXR1cm4gU3RyaW5nKFwiMDAwMDAwMFwiICsgbikuc2xpY2UoLTcpO1xyXG59XHJcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL0FkZC1vbnMvQ29kZV9zbmlwcGV0cy9UaW1lcnNcclxuXHJcbnZhciBnX3N0YXJ0VGltZSA9IHdpbmRvdy5EYXRlLm5vdygpO1xyXG5cclxuZnVuY3Rpb24gZ3VpZCgpIHtcclxuXHRmdW5jdGlvbiBzNCgpIHtcclxuXHRcdHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKS50b1N0cmluZygxNikuc3Vic3RyaW5nKDEpO1xyXG5cdH1cclxuXHRyZXR1cm4gczQoKSArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDRnJhbWVFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIF9oYW5kbGVycyA9IHt9O1xyXG5cclxuXHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XHJcblxyXG5cdHRoaXMub24gPSBmdW5jdGlvbihldmVudCwgaGFuZGxlcikge1xyXG5cclxuXHRcdF9oYW5kbGVyc1tldmVudF0gPSBoYW5kbGVyO1xyXG5cclxuXHR9O1xyXG5cclxuXHR0aGlzLmVtaXQgPSBmdW5jdGlvbihldmVudCkge1xyXG5cclxuXHRcdHZhciBoYW5kbGVyID0gX2hhbmRsZXJzW2V2ZW50XTtcclxuXHRcdGlmIChoYW5kbGVyKSB7XHJcblxyXG5cdFx0XHRoYW5kbGVyLmFwcGx5KG51bGwsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xyXG5cclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0dGhpcy5maWxlbmFtZSA9IHNldHRpbmdzLm5hbWUgfHwgZ3VpZCgpO1xyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJyc7XHJcblx0dGhpcy5taW1lVHlwZSA9ICcnO1xyXG5cclxufVxyXG5cclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc2FmZVRvUHJvY2VlZCA9IGZ1bmN0aW9uKCl7IHJldHVybiB0cnVlOyB9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RlcCA9IGZ1bmN0aW9uKCkgeyBjb25zb2xlLmxvZyggJ1N0ZXAgbm90IHNldCEnICkgfVxyXG5cclxuZnVuY3Rpb24gQ0NUYXJFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5leHRlbnNpb24gPSAnLnRhcidcclxuXHR0aGlzLm1pbWVUeXBlID0gJ2FwcGxpY2F0aW9uL3gtdGFyJ1xyXG5cdHRoaXMuZmlsZUV4dGVuc2lvbiA9ICcnO1xyXG5cclxuXHR0aGlzLnRhcGUgPSBudWxsXHJcblx0dGhpcy5jb3VudCA9IDA7XHJcblxyXG59XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKXtcclxuXHJcblx0dGhpcy5kaXNwb3NlKCk7XHJcblxyXG59O1xyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggYmxvYiApIHtcclxuXHJcblx0dmFyIGZpbGVSZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG5cdGZpbGVSZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLnRhcGUuYXBwZW5kKCBwYWQoIHRoaXMuY291bnQgKSArIHRoaXMuZmlsZUV4dGVuc2lvbiwgbmV3IFVpbnQ4QXJyYXkoIGZpbGVSZWFkZXIucmVzdWx0ICkgKTtcclxuXHJcblx0XHQvL2lmKCB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSA+IDAgJiYgKCB0aGlzLmZyYW1lcy5sZW5ndGggLyB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApID49IHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lICkge1xyXG5cclxuXHRcdHRoaXMuY291bnQrKztcclxuXHRcdHRoaXMuc3RlcCgpO1xyXG5cdH0uYmluZCggdGhpcyApO1xyXG5cdGZpbGVSZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYik7XHJcblxyXG59XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdGNhbGxiYWNrKCB0aGlzLnRhcGUuc2F2ZSgpICk7XHJcblxyXG59XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy50YXBlID0gbmV3IFRhcigpO1xyXG5cdHRoaXMuY291bnQgPSAwO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NQTkdFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NUYXJFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMudHlwZSA9ICdpbWFnZS9wbmcnO1xyXG5cdHRoaXMuZmlsZUV4dGVuc2lvbiA9ICcucG5nJztcclxuXHJcbn1cclxuXHJcbkNDUE5HRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ1RhckVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1BOR0VuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGNhbnZhcy50b0Jsb2IoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0Q0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQuY2FsbCggdGhpcywgYmxvYiApO1xyXG5cdH0uYmluZCggdGhpcyApLCB0aGlzLnR5cGUgKVxyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NKUEVHRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDVGFyRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLnR5cGUgPSAnaW1hZ2UvanBlZyc7XHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJy5qcGcnO1xyXG5cdHRoaXMucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxufVxyXG5cclxuQ0NKUEVHRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ1RhckVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0pQRUdFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRjYW52YXMudG9CbG9iKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdENDVGFyRW5jb2Rlci5wcm90b3R5cGUuYWRkLmNhbGwoIHRoaXMsIGJsb2IgKTtcclxuXHR9LmJpbmQoIHRoaXMgKSwgdGhpcy50eXBlLCB0aGlzLnF1YWxpdHkgKVxyXG5cclxufVxyXG5cclxuLypcclxuXHJcblx0V2ViTSBFbmNvZGVyXHJcblxyXG4qL1xyXG5cclxuZnVuY3Rpb24gQ0NXZWJNRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG5cdGlmKCBjYW52YXMudG9EYXRhVVJMKCAnaW1hZ2Uvd2VicCcgKS5zdWJzdHIoNSwxMCkgIT09ICdpbWFnZS93ZWJwJyApe1xyXG5cdFx0Y29uc29sZS5sb2coIFwiV2ViUCBub3Qgc3VwcG9ydGVkIC0gdHJ5IGFub3RoZXIgZXhwb3J0IGZvcm1hdFwiIClcclxuXHR9XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcud2VibSdcclxuXHR0aGlzLm1pbWVUeXBlID0gJ3ZpZGVvL3dlYm0nXHJcblx0dGhpcy5iYXNlRmlsZW5hbWUgPSB0aGlzLmZpbGVuYW1lO1xyXG5cclxuXHR0aGlzLmZyYW1lcyA9IFtdO1xyXG5cdHRoaXMucGFydCA9IDE7XHJcblxyXG4gIHRoaXMudmlkZW9Xcml0ZXIgPSBuZXcgV2ViTVdyaXRlcih7XHJcbiAgICBxdWFsaXR5OiB0aGlzLnF1YWxpdHksXHJcbiAgICBmaWxlV3JpdGVyOiBudWxsLFxyXG4gICAgZmQ6IG51bGwsXHJcbiAgICBmcmFtZVJhdGU6IHNldHRpbmdzLmZyYW1lcmF0ZVxyXG59KTtcclxuXHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmRpc3Bvc2UoKTtcclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG4gIHRoaXMudmlkZW9Xcml0ZXIuYWRkRnJhbWUoY2FudmFzKTtcclxuXHJcblx0Ly90aGlzLmZyYW1lcy5wdXNoKCBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS93ZWJwJywgdGhpcy5xdWFsaXR5KSApO1xyXG5cclxuXHRpZiggdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgPiAwICYmICggdGhpcy5mcmFtZXMubGVuZ3RoIC8gdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKSA+PSB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSApIHtcclxuXHRcdHRoaXMuc2F2ZSggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRcdHRoaXMuZmlsZW5hbWUgPSB0aGlzLmJhc2VGaWxlbmFtZSArICctcGFydC0nICsgcGFkKCB0aGlzLnBhcnQgKTtcclxuXHRcdFx0ZG93bmxvYWQoIGJsb2IsIHRoaXMuZmlsZW5hbWUgKyB0aGlzLmV4dGVuc2lvbiwgdGhpcy5taW1lVHlwZSApO1xyXG5cdFx0XHR0aGlzLmRpc3Bvc2UoKTtcclxuXHRcdFx0dGhpcy5wYXJ0Kys7XHJcblx0XHRcdHRoaXMuZmlsZW5hbWUgPSB0aGlzLmJhc2VGaWxlbmFtZSArICctcGFydC0nICsgcGFkKCB0aGlzLnBhcnQgKTtcclxuXHRcdFx0dGhpcy5zdGVwKCk7XHJcblx0XHR9LmJpbmQoIHRoaXMgKSApXHJcblx0fSBlbHNlIHtcclxuXHRcdHRoaXMuc3RlcCgpO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4vL1x0aWYoICF0aGlzLmZyYW1lcy5sZW5ndGggKSByZXR1cm47XHJcblxyXG4gIHRoaXMudmlkZW9Xcml0ZXIuY29tcGxldGUoKS50aGVuKGNhbGxiYWNrKTtcclxuXHJcblx0Lyp2YXIgd2VibSA9IFdoYW1teS5mcm9tSW1hZ2VBcnJheSggdGhpcy5mcmFtZXMsIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlIClcclxuXHR2YXIgYmxvYiA9IG5ldyBCbG9iKCBbIHdlYm0gXSwgeyB0eXBlOiBcIm9jdGV0L3N0cmVhbVwiIH0gKTtcclxuXHRjYWxsYmFjayggYmxvYiApOyovXHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5mcmFtZXMgPSBbXTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDRkZNcGVnU2VydmVyRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHNldHRpbmdzLnF1YWxpdHkgPSAoIHNldHRpbmdzLnF1YWxpdHkgLyAxMDAgKSB8fCAuODtcclxuXHJcblx0dGhpcy5lbmNvZGVyID0gbmV3IEZGTXBlZ1NlcnZlci5WaWRlbyggc2V0dGluZ3MgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ3Byb2Nlc3MnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLmVtaXQoICdwcm9jZXNzJyApXHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCdmaW5pc2hlZCcsIGZ1bmN0aW9uKCB1cmwsIHNpemUgKSB7XHJcbiAgICAgICAgdmFyIGNiID0gdGhpcy5jYWxsYmFjaztcclxuICAgICAgICBpZiAoIGNiICkge1xyXG4gICAgICAgICAgICB0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBjYiggdXJsLCBzaXplICk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ3Byb2dyZXNzJywgZnVuY3Rpb24oIHByb2dyZXNzICkge1xyXG4gICAgICAgIGlmICggdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzICkge1xyXG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MoIHByb2dyZXNzIClcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAnZXJyb3InLCBmdW5jdGlvbiggZGF0YSApIHtcclxuICAgICAgICBhbGVydChKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSk7XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc3RhcnQoIHRoaXMuc2V0dGluZ3MgKTtcclxuXHJcbn07XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5hZGQoIGNhbnZhcyApO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuICAgIHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcclxuICAgIHRoaXMuZW5jb2Rlci5lbmQoKTtcclxuXHJcbn1cclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuc2FmZVRvUHJvY2VlZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZW5jb2Rlci5zYWZlVG9Qcm9jZWVkKCk7XHJcbn07XHJcblxyXG4vKlxyXG5cdEhUTUxDYW52YXNFbGVtZW50LmNhcHR1cmVTdHJlYW0oKVxyXG4qL1xyXG5cclxuZnVuY3Rpb24gQ0NTdHJlYW1FbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5mcmFtZXJhdGUgPSB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZTtcclxuXHR0aGlzLnR5cGUgPSAndmlkZW8vd2VibSc7XHJcblx0dGhpcy5leHRlbnNpb24gPSAnLndlYm0nO1xyXG5cdHRoaXMuc3RyZWFtID0gbnVsbDtcclxuXHR0aGlzLm1lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG5cdHRoaXMuY2h1bmtzID0gW107XHJcblxyXG59XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGlmKCAhdGhpcy5zdHJlYW0gKSB7XHJcblx0XHR0aGlzLnN0cmVhbSA9IGNhbnZhcy5jYXB0dXJlU3RyZWFtKCB0aGlzLmZyYW1lcmF0ZSApO1xyXG5cdFx0dGhpcy5tZWRpYVJlY29yZGVyID0gbmV3IE1lZGlhUmVjb3JkZXIoIHRoaXMuc3RyZWFtICk7XHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIuc3RhcnQoKTtcclxuXHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0XHR0aGlzLmNodW5rcy5wdXNoKGUuZGF0YSk7XHJcblx0XHR9LmJpbmQoIHRoaXMgKTtcclxuXHJcblx0fVxyXG5cdHRoaXMuc3RlcCgpO1xyXG5cclxufVxyXG5cclxuQ0NTdHJlYW1FbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuXHR0aGlzLm1lZGlhUmVjb3JkZXIub25zdG9wID0gZnVuY3Rpb24oIGUgKSB7XHJcblx0XHR2YXIgYmxvYiA9IG5ldyBCbG9iKCB0aGlzLmNodW5rcywgeyAndHlwZScgOiAndmlkZW8vd2VibScgfSk7XHJcblx0XHR0aGlzLmNodW5rcyA9IFtdO1xyXG5cdFx0Y2FsbGJhY2soIGJsb2IgKTtcclxuXHJcblx0fS5iaW5kKCB0aGlzICk7XHJcblxyXG5cdHRoaXMubWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcblxyXG59XHJcblxyXG4vKmZ1bmN0aW9uIENDR0lGRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9IHNldHRpbmdzLnF1YWxpdHkgfHwgNjtcclxuXHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XHJcblxyXG5cdHRoaXMuZW5jb2RlciA9IG5ldyBHSUZFbmNvZGVyKCk7XHJcblx0dGhpcy5lbmNvZGVyLnNldFJlcGVhdCggMSApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldERlbGF5KCBzZXR0aW5ncy5zdGVwICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0UXVhbGl0eSggNiApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldFRyYW5zcGFyZW50KCBudWxsICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0U2l6ZSggMTUwLCAxNTAgKTtcclxuXHJcbiAgXHR0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcbiAgXHR0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoICcyZCcgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2RlciApO1xyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc3RhcnQoKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5jYW52YXMud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0dGhpcy5jYW52YXMuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHR0aGlzLmN0eC5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggdGhpcy5jdHggKTtcclxuXHJcblx0dGhpcy5lbmNvZGVyLnNldFNpemUoIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCApO1xyXG5cdHZhciByZWFkQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoY2FudmFzLndpZHRoICogY2FudmFzLmhlaWdodCAqIDQpO1xyXG5cdHZhciBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKTtcclxuXHRjb250ZXh0LnJlYWRQaXhlbHMoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0LCBjb250ZXh0LlJHQkEsIGNvbnRleHQuVU5TSUdORURfQllURSwgcmVhZEJ1ZmZlcik7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCByZWFkQnVmZmVyLCB0cnVlICk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmZpbmlzaCgpO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuXHR2YXIgYmluYXJ5X2dpZiA9IHRoaXMuZW5jb2Rlci5zdHJlYW0oKS5nZXREYXRhKCk7XHJcblxyXG5cdHZhciBkYXRhX3VybCA9ICdkYXRhOmltYWdlL2dpZjtiYXNlNjQsJytlbmNvZGU2NChiaW5hcnlfZ2lmKTtcclxuXHR3aW5kb3cubG9jYXRpb24gPSBkYXRhX3VybDtcclxuXHRyZXR1cm47XHJcblxyXG5cdHZhciBibG9iID0gbmV3IEJsb2IoIFsgYmluYXJ5X2dpZiBdLCB7IHR5cGU6IFwib2N0ZXQvc3RyZWFtXCIgfSApO1xyXG5cdHZhciB1cmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTCggYmxvYiApO1xyXG5cdGNhbGxiYWNrKCB1cmwgKTtcclxuXHJcbn0qL1xyXG5cclxuZnVuY3Rpb24gQ0NHSUZFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9IDMxIC0gKCAoIHNldHRpbmdzLnF1YWxpdHkgKiAzMCAvIDEwMCApIHx8IDEwICk7XHJcblx0c2V0dGluZ3Mud29ya2VycyA9IHNldHRpbmdzLndvcmtlcnMgfHwgNDtcclxuXHJcblx0dGhpcy5leHRlbnNpb24gPSAnLmdpZidcclxuXHR0aGlzLm1pbWVUeXBlID0gJ2ltYWdlL2dpZidcclxuXHJcbiAgXHR0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcbiAgXHR0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoICcyZCcgKTtcclxuICBcdHRoaXMuc2l6ZVNldCA9IGZhbHNlO1xyXG5cclxuICBcdHRoaXMuZW5jb2RlciA9IG5ldyBHSUYoe1xyXG5cdFx0d29ya2Vyczogc2V0dGluZ3Mud29ya2VycyxcclxuXHRcdHF1YWxpdHk6IHNldHRpbmdzLnF1YWxpdHksXHJcblx0XHR3b3JrZXJTY3JpcHQ6IHNldHRpbmdzLndvcmtlcnNQYXRoICsgJ2dpZi53b3JrZXIuanMnXHJcblx0fSApO1xyXG5cclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ3Byb2dyZXNzJywgZnVuY3Rpb24oIHByb2dyZXNzICkge1xyXG4gICAgICAgIGlmICggdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzICkge1xyXG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MoIHByb2dyZXNzIClcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxuICAgIHRoaXMuZW5jb2Rlci5vbignZmluaXNoZWQnLCBmdW5jdGlvbiggYmxvYiApIHtcclxuICAgICAgICB2YXIgY2IgPSB0aGlzLmNhbGxiYWNrO1xyXG4gICAgICAgIGlmICggY2IgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGNiKCBibG9iICk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0aWYoICF0aGlzLnNpemVTZXQgKSB7XHJcblx0XHR0aGlzLmVuY29kZXIuc2V0T3B0aW9uKCAnd2lkdGgnLGNhbnZhcy53aWR0aCApO1xyXG5cdFx0dGhpcy5lbmNvZGVyLnNldE9wdGlvbiggJ2hlaWdodCcsY2FudmFzLmhlaWdodCApO1xyXG5cdFx0dGhpcy5zaXplU2V0ID0gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdHRoaXMuY2FudmFzLndpZHRoID0gY2FudmFzLndpZHRoO1xyXG5cdHRoaXMuY2FudmFzLmhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XHJcblx0dGhpcy5jdHguZHJhd0ltYWdlKCBjYW52YXMsIDAsIDAgKTtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCB0aGlzLmN0eCwgeyBjb3B5OiB0cnVlLCBkZWxheTogdGhpcy5zZXR0aW5ncy5zdGVwIH0gKTtcclxuXHR0aGlzLnN0ZXAoKTtcclxuXHJcblx0Lyp0aGlzLmVuY29kZXIuc2V0U2l6ZSggY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0ICk7XHJcblx0dmFyIHJlYWRCdWZmZXIgPSBuZXcgVWludDhBcnJheShjYW52YXMud2lkdGggKiBjYW52YXMuaGVpZ2h0ICogNCk7XHJcblx0dmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApO1xyXG5cdGNvbnRleHQucmVhZFBpeGVscygwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQsIGNvbnRleHQuUkdCQSwgY29udGV4dC5VTlNJR05FRF9CWVRFLCByZWFkQnVmZmVyKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHJlYWRCdWZmZXIsIHRydWUgKTsqL1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuICAgIHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcclxuXHJcblx0dGhpcy5lbmNvZGVyLnJlbmRlcigpO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NhcHR1cmUoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgX3NldHRpbmdzID0gc2V0dGluZ3MgfHwge30sXHJcblx0XHRfZGF0ZSA9IG5ldyBEYXRlKCksXHJcblx0XHRfdmVyYm9zZSxcclxuXHRcdF9kaXNwbGF5LFxyXG5cdFx0X3RpbWUsXHJcblx0XHRfc3RhcnRUaW1lLFxyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSxcclxuXHRcdF9wZXJmb3JtYW5jZVN0YXJ0VGltZSxcclxuXHRcdF9zdGVwLFxyXG4gICAgICAgIF9lbmNvZGVyLFxyXG5cdFx0X3RpbWVvdXRzID0gW10sXHJcblx0XHRfaW50ZXJ2YWxzID0gW10sXHJcblx0XHRfZnJhbWVDb3VudCA9IDAsXHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA9IDAsXHJcblx0XHRfbGFzdEZyYW1lID0gbnVsbCxcclxuXHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MgPSBbXSxcclxuXHRcdF9jYXB0dXJpbmcgPSBmYWxzZSxcclxuICAgICAgICBfaGFuZGxlcnMgPSB7fTtcclxuXHJcblx0X3NldHRpbmdzLmZyYW1lcmF0ZSA9IF9zZXR0aW5ncy5mcmFtZXJhdGUgfHwgNjA7XHJcblx0X3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgPSAyICogKCBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyB8fCAxICk7XHJcblx0X3ZlcmJvc2UgPSBfc2V0dGluZ3MudmVyYm9zZSB8fCBmYWxzZTtcclxuXHRfZGlzcGxheSA9IF9zZXR0aW5ncy5kaXNwbGF5IHx8IGZhbHNlO1xyXG5cdF9zZXR0aW5ncy5zdGVwID0gMTAwMC4wIC8gX3NldHRpbmdzLmZyYW1lcmF0ZSA7XHJcblx0X3NldHRpbmdzLnRpbWVMaW1pdCA9IF9zZXR0aW5ncy50aW1lTGltaXQgfHwgMDtcclxuXHRfc2V0dGluZ3MuZnJhbWVMaW1pdCA9IF9zZXR0aW5ncy5mcmFtZUxpbWl0IHx8IDA7XHJcblx0X3NldHRpbmdzLnN0YXJ0VGltZSA9IF9zZXR0aW5ncy5zdGFydFRpbWUgfHwgMDtcclxuXHJcblx0dmFyIF90aW1lRGlzcGxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUubGVmdCA9IF90aW1lRGlzcGxheS5zdHlsZS50b3AgPSAwXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdibGFjayc7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJ1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5mb250U2l6ZSA9ICcxMXB4J1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5wYWRkaW5nID0gJzVweCdcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuY29sb3IgPSAncmVkJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuekluZGV4ID0gMTAwMDAwXHJcblx0aWYoIF9zZXR0aW5ncy5kaXNwbGF5ICkgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggX3RpbWVEaXNwbGF5ICk7XHJcblxyXG5cdHZhciBjYW52YXNNb3Rpb25CbHVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuXHR2YXIgY3R4TW90aW9uQmx1ciA9IGNhbnZhc01vdGlvbkJsdXIuZ2V0Q29udGV4dCggJzJkJyApO1xyXG5cdHZhciBidWZmZXJNb3Rpb25CbHVyO1xyXG5cdHZhciBpbWFnZURhdGE7XHJcblxyXG5cdF9sb2coICdTdGVwIGlzIHNldCB0byAnICsgX3NldHRpbmdzLnN0ZXAgKyAnbXMnICk7XHJcblxyXG4gICAgdmFyIF9lbmNvZGVycyA9IHtcclxuXHRcdGdpZjogQ0NHSUZFbmNvZGVyLFxyXG5cdFx0d2VibTogQ0NXZWJNRW5jb2RlcixcclxuXHRcdGZmbXBlZ3NlcnZlcjogQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLFxyXG5cdFx0cG5nOiBDQ1BOR0VuY29kZXIsXHJcblx0XHRqcGc6IENDSlBFR0VuY29kZXIsXHJcblx0XHQnd2VibS1tZWRpYXJlY29yZGVyJzogQ0NTdHJlYW1FbmNvZGVyXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBjdG9yID0gX2VuY29kZXJzWyBfc2V0dGluZ3MuZm9ybWF0IF07XHJcbiAgICBpZiAoICFjdG9yICkge1xyXG5cdFx0dGhyb3cgXCJFcnJvcjogSW5jb3JyZWN0IG9yIG1pc3NpbmcgZm9ybWF0OiBWYWxpZCBmb3JtYXRzIGFyZSBcIiArIE9iamVjdC5rZXlzKF9lbmNvZGVycykuam9pbihcIiwgXCIpO1xyXG4gICAgfVxyXG4gICAgX2VuY29kZXIgPSBuZXcgY3RvciggX3NldHRpbmdzICk7XHJcbiAgICBfZW5jb2Rlci5zdGVwID0gX3N0ZXBcclxuXHJcblx0X2VuY29kZXIub24oJ3Byb2Nlc3MnLCBfcHJvY2Vzcyk7XHJcbiAgICBfZW5jb2Rlci5vbigncHJvZ3Jlc3MnLCBfcHJvZ3Jlc3MpO1xyXG5cclxuICAgIGlmIChcInBlcmZvcm1hbmNlXCIgaW4gd2luZG93ID09IGZhbHNlKSB7XHJcbiAgICBcdHdpbmRvdy5wZXJmb3JtYW5jZSA9IHt9O1xyXG4gICAgfVxyXG5cclxuXHREYXRlLm5vdyA9IChEYXRlLm5vdyB8fCBmdW5jdGlvbiAoKSB7ICAvLyB0aGFua3MgSUU4XHJcblx0XHRyZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcblx0fSk7XHJcblxyXG5cdGlmIChcIm5vd1wiIGluIHdpbmRvdy5wZXJmb3JtYW5jZSA9PSBmYWxzZSl7XHJcblxyXG5cdFx0dmFyIG5vd09mZnNldCA9IERhdGUubm93KCk7XHJcblxyXG5cdFx0aWYgKHBlcmZvcm1hbmNlLnRpbWluZyAmJiBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0KXtcclxuXHRcdFx0bm93T2Zmc2V0ID0gcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydFxyXG5cdFx0fVxyXG5cclxuXHRcdHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbiBub3coKXtcclxuXHRcdFx0cmV0dXJuIERhdGUubm93KCkgLSBub3dPZmZzZXQ7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR2YXIgX29sZFNldFRpbWVvdXQgPSB3aW5kb3cuc2V0VGltZW91dCxcclxuXHRcdF9vbGRTZXRJbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCxcclxuXHQgICAgXHRfb2xkQ2xlYXJJbnRlcnZhbCA9IHdpbmRvdy5jbGVhckludGVydmFsLFxyXG5cdFx0X29sZENsZWFyVGltZW91dCA9IHdpbmRvdy5jbGVhclRpbWVvdXQsXHJcblx0XHRfb2xkUmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSxcclxuXHRcdF9vbGROb3cgPSB3aW5kb3cuRGF0ZS5ub3csXHJcblx0XHRfb2xkUGVyZm9ybWFuY2VOb3cgPSB3aW5kb3cucGVyZm9ybWFuY2Uubm93LFxyXG5cdFx0X29sZEdldFRpbWUgPSB3aW5kb3cuRGF0ZS5wcm90b3R5cGUuZ2V0VGltZTtcclxuXHQvLyBEYXRlLnByb3RvdHlwZS5fb2xkR2V0VGltZSA9IERhdGUucHJvdG90eXBlLmdldFRpbWU7XHJcblxyXG5cdHZhciBtZWRpYSA9IFtdO1xyXG5cclxuXHRmdW5jdGlvbiBfaW5pdCgpIHtcclxuXHJcblx0XHRfbG9nKCAnQ2FwdHVyZXIgc3RhcnQnICk7XHJcblxyXG5cdFx0X3N0YXJ0VGltZSA9IHdpbmRvdy5EYXRlLm5vdygpO1xyXG5cdFx0X3RpbWUgPSBfc3RhcnRUaW1lICsgX3NldHRpbmdzLnN0YXJ0VGltZTtcclxuXHRcdF9wZXJmb3JtYW5jZVN0YXJ0VGltZSA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTtcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUgPSBfcGVyZm9ybWFuY2VTdGFydFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cclxuXHRcdHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0cmV0dXJuIF90aW1lO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5EYXRlLm5vdyA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRyZXR1cm4gX3RpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oIGNhbGxiYWNrLCB0aW1lICkge1xyXG5cdFx0XHR2YXIgdCA9IHtcclxuXHRcdFx0XHRjYWxsYmFjazogY2FsbGJhY2ssXHJcblx0XHRcdFx0dGltZTogdGltZSxcclxuXHRcdFx0XHR0cmlnZ2VyVGltZTogX3RpbWUgKyB0aW1lXHJcblx0XHRcdH07XHJcblx0XHRcdF90aW1lb3V0cy5wdXNoKCB0ICk7XHJcblx0XHRcdF9sb2coICdUaW1lb3V0IHNldCB0byAnICsgdC50aW1lICk7XHJcbiAgICAgICAgICAgIHJldHVybiB0O1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQgPSBmdW5jdGlvbiggaWQgKSB7XHJcblx0XHRcdGZvciggdmFyIGogPSAwOyBqIDwgX3RpbWVvdXRzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRcdGlmKCBfdGltZW91dHNbIGogXSA9PSBpZCApIHtcclxuXHRcdFx0XHRcdF90aW1lb3V0cy5zcGxpY2UoIGosIDEgKTtcclxuXHRcdFx0XHRcdF9sb2coICdUaW1lb3V0IGNsZWFyZWQnICk7XHJcblx0XHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblx0XHR3aW5kb3cuc2V0SW50ZXJ2YWwgPSBmdW5jdGlvbiggY2FsbGJhY2ssIHRpbWUgKSB7XHJcblx0XHRcdHZhciB0ID0ge1xyXG5cdFx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0XHR0aW1lOiB0aW1lLFxyXG5cdFx0XHRcdHRyaWdnZXJUaW1lOiBfdGltZSArIHRpbWVcclxuXHRcdFx0fTtcclxuXHRcdFx0X2ludGVydmFscy5wdXNoKCB0ICk7XHJcblx0XHRcdF9sb2coICdJbnRlcnZhbCBzZXQgdG8gJyArIHQudGltZSApO1xyXG5cdFx0XHRyZXR1cm4gdDtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKCBpZCApIHtcclxuXHRcdFx0X2xvZyggJ2NsZWFyIEludGVydmFsJyApO1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cdFx0XHRfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzLnB1c2goIGNhbGxiYWNrICk7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uKCl7XHJcblx0XHRcdHJldHVybiBfcGVyZm9ybWFuY2VUaW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHRmdW5jdGlvbiBob29rQ3VycmVudFRpbWUoKSB7XHJcblx0XHRcdGlmKCAhdGhpcy5faG9va2VkICkge1xyXG5cdFx0XHRcdHRoaXMuX2hvb2tlZCA9IHRydWU7XHJcblx0XHRcdFx0dGhpcy5faG9va2VkVGltZSA9IHRoaXMuY3VycmVudFRpbWUgfHwgMDtcclxuXHRcdFx0XHR0aGlzLnBhdXNlKCk7XHJcblx0XHRcdFx0bWVkaWEucHVzaCggdGhpcyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB0aGlzLl9ob29rZWRUaW1lICsgX3NldHRpbmdzLnN0YXJ0VGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCBIVE1MVmlkZW9FbGVtZW50LnByb3RvdHlwZSwgJ2N1cnJlbnRUaW1lJywgeyBnZXQ6IGhvb2tDdXJyZW50VGltZSB9IClcclxuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCBIVE1MQXVkaW9FbGVtZW50LnByb3RvdHlwZSwgJ2N1cnJlbnRUaW1lJywgeyBnZXQ6IGhvb2tDdXJyZW50VGltZSB9IClcclxuXHRcdH0gY2F0Y2ggKGVycikge1xyXG5cdFx0XHRfbG9nKGVycik7XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0YXJ0KCkge1xyXG5cdFx0X2luaXQoKTtcclxuXHRcdF9lbmNvZGVyLnN0YXJ0KCk7XHJcblx0XHRfY2FwdHVyaW5nID0gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zdG9wKCkge1xyXG5cdFx0X2NhcHR1cmluZyA9IGZhbHNlO1xyXG5cdFx0X2VuY29kZXIuc3RvcCgpO1xyXG5cdFx0X2Rlc3Ryb3koKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jYWxsKCBmbiwgcCApIHtcclxuXHRcdF9vbGRTZXRUaW1lb3V0KCBmbiwgMCwgcCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0ZXAoKSB7XHJcblx0XHQvL19vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIF9wcm9jZXNzICk7XHJcblx0XHRfY2FsbCggX3Byb2Nlc3MgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9kZXN0cm95KCkge1xyXG5cdFx0X2xvZyggJ0NhcHR1cmVyIHN0b3AnICk7XHJcblx0XHR3aW5kb3cuc2V0VGltZW91dCA9IF9vbGRTZXRUaW1lb3V0O1xyXG5cdFx0d2luZG93LnNldEludGVydmFsID0gX29sZFNldEludGVydmFsO1xyXG5cdFx0d2luZG93LmNsZWFySW50ZXJ2YWwgPSBfb2xkQ2xlYXJJbnRlcnZhbDtcclxuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQgPSBfb2xkQ2xlYXJUaW1lb3V0O1xyXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IF9vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XHJcblx0XHR3aW5kb3cuRGF0ZS5wcm90b3R5cGUuZ2V0VGltZSA9IF9vbGRHZXRUaW1lO1xyXG5cdFx0d2luZG93LkRhdGUubm93ID0gX29sZE5vdztcclxuXHRcdHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBfb2xkUGVyZm9ybWFuY2VOb3c7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfdXBkYXRlVGltZSgpIHtcclxuXHRcdHZhciBzZWNvbmRzID0gX2ZyYW1lQ291bnQgLyBfc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdFx0aWYoICggX3NldHRpbmdzLmZyYW1lTGltaXQgJiYgX2ZyYW1lQ291bnQgPj0gX3NldHRpbmdzLmZyYW1lTGltaXQgKSB8fCAoIF9zZXR0aW5ncy50aW1lTGltaXQgJiYgc2Vjb25kcyA+PSBfc2V0dGluZ3MudGltZUxpbWl0ICkgKSB7XHJcblx0XHRcdF9zdG9wKCk7XHJcblx0XHRcdF9zYXZlKCk7XHJcblx0XHR9XHJcblx0XHR2YXIgZCA9IG5ldyBEYXRlKCBudWxsICk7XHJcblx0XHRkLnNldFNlY29uZHMoIHNlY29uZHMgKTtcclxuXHRcdGlmKCBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA+IDIgKSB7XHJcblx0XHRcdF90aW1lRGlzcGxheS50ZXh0Q29udGVudCA9ICdDQ2FwdHVyZSAnICsgX3NldHRpbmdzLmZvcm1hdCArICcgfCAnICsgX2ZyYW1lQ291bnQgKyAnIGZyYW1lcyAoJyArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ICsgJyBpbnRlcikgfCAnICsgIGQudG9JU09TdHJpbmcoKS5zdWJzdHIoIDExLCA4ICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRfdGltZURpc3BsYXkudGV4dENvbnRlbnQgPSAnQ0NhcHR1cmUgJyArIF9zZXR0aW5ncy5mb3JtYXQgKyAnIHwgJyArIF9mcmFtZUNvdW50ICsgJyBmcmFtZXMgfCAnICsgIGQudG9JU09TdHJpbmcoKS5zdWJzdHIoIDExLCA4ICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2hlY2tGcmFtZSggY2FudmFzICkge1xyXG5cclxuXHRcdGlmKCBjYW52YXNNb3Rpb25CbHVyLndpZHRoICE9PSBjYW52YXMud2lkdGggfHwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgIT09IGNhbnZhcy5oZWlnaHQgKSB7XHJcblx0XHRcdGNhbnZhc01vdGlvbkJsdXIud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0XHRcdGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1ciA9IG5ldyBVaW50MTZBcnJheSggY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKiBjYW52YXNNb3Rpb25CbHVyLndpZHRoICogNCApO1xyXG5cdFx0XHRjdHhNb3Rpb25CbHVyLmZpbGxTdHlsZSA9ICcjMCdcclxuXHRcdFx0Y3R4TW90aW9uQmx1ci5maWxsUmVjdCggMCwgMCwgY2FudmFzTW90aW9uQmx1ci53aWR0aCwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfYmxlbmRGcmFtZSggY2FudmFzICkge1xyXG5cclxuXHRcdC8vX2xvZyggJ0ludGVybWVkaWF0ZSBGcmFtZTogJyArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ICk7XHJcblxyXG5cdFx0Y3R4TW90aW9uQmx1ci5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cdFx0aW1hZ2VEYXRhID0gY3R4TW90aW9uQmx1ci5nZXRJbWFnZURhdGEoIDAsIDAsIGNhbnZhc01vdGlvbkJsdXIud2lkdGgsIGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICk7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiBdICs9IGltYWdlRGF0YS5kYXRhWyBqIF07XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAxIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogKyAxIF07XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogKyAyIF07XHJcblx0XHR9XHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCsrO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zYXZlRnJhbWUoKXtcclxuXHJcblx0XHR2YXIgZGF0YSA9IGltYWdlRGF0YS5kYXRhO1xyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBidWZmZXJNb3Rpb25CbHVyLmxlbmd0aDsgais9IDQgKSB7XHJcblx0XHRcdGRhdGFbIGogXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdFx0ZGF0YVsgaiArIDEgXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAxIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHRcdGRhdGFbIGogKyAyIF0gPSBidWZmZXJNb3Rpb25CbHVyWyBqICsgMiBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0fVxyXG5cdFx0Y3R4TW90aW9uQmx1ci5wdXRJbWFnZURhdGEoIGltYWdlRGF0YSwgMCwgMCApO1xyXG5cdFx0X2VuY29kZXIuYWRkKCBjYW52YXNNb3Rpb25CbHVyICk7XHJcblx0XHRfZnJhbWVDb3VudCsrO1xyXG5cdFx0X2ludGVybWVkaWF0ZUZyYW1lQ291bnQgPSAwO1xyXG5cdFx0X2xvZyggJ0Z1bGwgTUIgRnJhbWUhICcgKyBfZnJhbWVDb3VudCArICcgJyArICBfdGltZSApO1xyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBidWZmZXJNb3Rpb25CbHVyLmxlbmd0aDsgais9IDQgKSB7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogXSA9IDA7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAxIF0gPSAwO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMiBdID0gMDtcclxuXHRcdH1cclxuXHRcdGdjKCk7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NhcHR1cmUoIGNhbnZhcyApIHtcclxuXHJcblx0XHRpZiggX2NhcHR1cmluZyApIHtcclxuXHJcblx0XHRcdGlmKCBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA+IDIgKSB7XHJcblxyXG5cdFx0XHRcdF9jaGVja0ZyYW1lKCBjYW52YXMgKTtcclxuXHRcdFx0XHRfYmxlbmRGcmFtZSggY2FudmFzICk7XHJcblxyXG5cdFx0XHRcdGlmKCBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA+PSAuNSAqIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzICkge1xyXG5cdFx0XHRcdFx0X3NhdmVGcmFtZSgpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRfc3RlcCgpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0X2VuY29kZXIuYWRkKCBjYW52YXMgKTtcclxuXHRcdFx0XHRfZnJhbWVDb3VudCsrO1xyXG5cdFx0XHRcdF9sb2coICdGdWxsIEZyYW1lISAnICsgX2ZyYW1lQ291bnQgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfcHJvY2VzcygpIHtcclxuXHJcblx0XHR2YXIgc3RlcCA9IDEwMDAgLyBfc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdFx0dmFyIGR0ID0gKCBfZnJhbWVDb3VudCArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50IC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgKSAqIHN0ZXA7XHJcblxyXG5cdFx0X3RpbWUgPSBfc3RhcnRUaW1lICsgZHQ7XHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lID0gX3BlcmZvcm1hbmNlU3RhcnRUaW1lICsgZHQ7XHJcblxyXG5cdFx0bWVkaWEuZm9yRWFjaCggZnVuY3Rpb24oIHYgKSB7XHJcblx0XHRcdHYuX2hvb2tlZFRpbWUgPSBkdCAvIDEwMDA7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0X3VwZGF0ZVRpbWUoKTtcclxuXHRcdF9sb2coICdGcmFtZTogJyArIF9mcmFtZUNvdW50ICsgJyAnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKTtcclxuXHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IF90aW1lb3V0cy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0aWYoIF90aW1lID49IF90aW1lb3V0c1sgaiBdLnRyaWdnZXJUaW1lICkge1xyXG5cdFx0XHRcdF9jYWxsKCBfdGltZW91dHNbIGogXS5jYWxsYmFjayApXHJcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggJ3RpbWVvdXQhJyApO1xyXG5cdFx0XHRcdF90aW1lb3V0cy5zcGxpY2UoIGosIDEgKTtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgX2ludGVydmFscy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0aWYoIF90aW1lID49IF9pbnRlcnZhbHNbIGogXS50cmlnZ2VyVGltZSApIHtcclxuXHRcdFx0XHRfY2FsbCggX2ludGVydmFsc1sgaiBdLmNhbGxiYWNrICk7XHJcblx0XHRcdFx0X2ludGVydmFsc1sgaiBdLnRyaWdnZXJUaW1lICs9IF9pbnRlcnZhbHNbIGogXS50aW1lO1xyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coICdpbnRlcnZhbCEnICk7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBjYiApIHtcclxuICAgICBcdFx0X2NhbGwoIGNiLCBfdGltZSAtIGdfc3RhcnRUaW1lICk7XHJcbiAgICAgICAgfSApO1xyXG4gICAgICAgIF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MgPSBbXTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc2F2ZSggY2FsbGJhY2sgKSB7XHJcblxyXG5cdFx0aWYoICFjYWxsYmFjayApIHtcclxuXHRcdFx0Y2FsbGJhY2sgPSBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdFx0XHRkb3dubG9hZCggYmxvYiwgX2VuY29kZXIuZmlsZW5hbWUgKyBfZW5jb2Rlci5leHRlbnNpb24sIF9lbmNvZGVyLm1pbWVUeXBlICk7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRfZW5jb2Rlci5zYXZlKCBjYWxsYmFjayApO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9sb2coIG1lc3NhZ2UgKSB7XHJcblx0XHRpZiggX3ZlcmJvc2UgKSBjb25zb2xlLmxvZyggbWVzc2FnZSApO1xyXG5cdH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb24oIGV2ZW50LCBoYW5kbGVyICkge1xyXG5cclxuICAgICAgICBfaGFuZGxlcnNbZXZlbnRdID0gaGFuZGxlcjtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2VtaXQoIGV2ZW50ICkge1xyXG5cclxuICAgICAgICB2YXIgaGFuZGxlciA9IF9oYW5kbGVyc1tldmVudF07XHJcbiAgICAgICAgaWYgKCBoYW5kbGVyICkge1xyXG5cclxuICAgICAgICAgICAgaGFuZGxlci5hcHBseSggbnVsbCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGFyZ3VtZW50cywgMSApICk7XHJcblxyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX3Byb2dyZXNzKCBwcm9ncmVzcyApIHtcclxuXHJcbiAgICAgICAgX2VtaXQoICdwcm9ncmVzcycsIHByb2dyZXNzICk7XHJcblxyXG4gICAgfVxyXG5cclxuXHRyZXR1cm4ge1xyXG5cdFx0c3RhcnQ6IF9zdGFydCxcclxuXHRcdGNhcHR1cmU6IF9jYXB0dXJlLFxyXG5cdFx0c3RvcDogX3N0b3AsXHJcblx0XHRzYXZlOiBfc2F2ZSxcclxuICAgICAgICBvbjogX29uXHJcblx0fVxyXG59XHJcblxyXG4oZnJlZVdpbmRvdyB8fCBmcmVlU2VsZiB8fCB7fSkuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxuXHJcbiAgLy8gU29tZSBBTUQgYnVpbGQgb3B0aW1pemVycyBsaWtlIHIuanMgY2hlY2sgZm9yIGNvbmRpdGlvbiBwYXR0ZXJucyBsaWtlIHRoZSBmb2xsb3dpbmc6XHJcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XHJcbiAgICAvLyBEZWZpbmUgYXMgYW4gYW5vbnltb3VzIG1vZHVsZSBzbywgdGhyb3VnaCBwYXRoIG1hcHBpbmcsIGl0IGNhbiBiZVxyXG4gICAgLy8gcmVmZXJlbmNlZCBhcyB0aGUgXCJ1bmRlcnNjb3JlXCIgbW9kdWxlLlxyXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xyXG4gICAgXHRyZXR1cm4gQ0NhcHR1cmU7XHJcbiAgICB9KTtcclxufVxyXG4gIC8vIENoZWNrIGZvciBgZXhwb3J0c2AgYWZ0ZXIgYGRlZmluZWAgaW4gY2FzZSBhIGJ1aWxkIG9wdGltaXplciBhZGRzIGFuIGBleHBvcnRzYCBvYmplY3QuXHJcbiAgZWxzZSBpZiAoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSkge1xyXG4gICAgLy8gRXhwb3J0IGZvciBOb2RlLmpzLlxyXG4gICAgaWYgKG1vZHVsZUV4cG9ydHMpIHtcclxuICAgIFx0KGZyZWVNb2R1bGUuZXhwb3J0cyA9IENDYXB0dXJlKS5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG4gICAgfVxyXG4gICAgLy8gRXhwb3J0IGZvciBDb21tb25KUyBzdXBwb3J0LlxyXG4gICAgZnJlZUV4cG9ydHMuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxufVxyXG5lbHNlIHtcclxuICAgIC8vIEV4cG9ydCB0byB0aGUgZ2xvYmFsIG9iamVjdC5cclxuICAgIHJvb3QuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxufVxyXG5cclxufSgpKTtcclxuIiwiLyoqXG4gKiBAYXV0aG9yIGFsdGVyZWRxIC8gaHR0cDovL2FsdGVyZWRxdWFsaWEuY29tL1xuICogQGF1dGhvciBtci5kb29iIC8gaHR0cDovL21yZG9vYi5jb20vXG4gKi9cblxudmFyIERldGVjdG9yID0ge1xuXG5cdGNhbnZhczogISEgd2luZG93LkNhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCxcblx0d2ViZ2w6ICggZnVuY3Rpb24gKCkge1xuXG5cdFx0dHJ5IHtcblxuXHRcdFx0dmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7IHJldHVybiAhISAoIHdpbmRvdy5XZWJHTFJlbmRlcmluZ0NvbnRleHQgJiYgKCBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApIHx8IGNhbnZhcy5nZXRDb250ZXh0KCAnZXhwZXJpbWVudGFsLXdlYmdsJyApICkgKTtcblxuXHRcdH0gY2F0Y2ggKCBlICkge1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cblx0XHR9XG5cblx0fSApKCksXG5cdHdvcmtlcnM6ICEhIHdpbmRvdy5Xb3JrZXIsXG5cdGZpbGVhcGk6IHdpbmRvdy5GaWxlICYmIHdpbmRvdy5GaWxlUmVhZGVyICYmIHdpbmRvdy5GaWxlTGlzdCAmJiB3aW5kb3cuQmxvYixcblxuXHRnZXRXZWJHTEVycm9yTWVzc2FnZTogZnVuY3Rpb24gKCkge1xuXG5cdFx0dmFyIGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRcdGVsZW1lbnQuaWQgPSAnd2ViZ2wtZXJyb3ItbWVzc2FnZSc7XG5cdFx0ZWxlbWVudC5zdHlsZS5mb250RmFtaWx5ID0gJ21vbm9zcGFjZSc7XG5cdFx0ZWxlbWVudC5zdHlsZS5mb250U2l6ZSA9ICcxM3B4Jztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRXZWlnaHQgPSAnbm9ybWFsJztcblx0XHRlbGVtZW50LnN0eWxlLnRleHRBbGlnbiA9ICdjZW50ZXInO1xuXHRcdGVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZCA9ICcjZmZmJztcblx0XHRlbGVtZW50LnN0eWxlLmNvbG9yID0gJyMwMDAnO1xuXHRcdGVsZW1lbnQuc3R5bGUucGFkZGluZyA9ICcxLjVlbSc7XG5cdFx0ZWxlbWVudC5zdHlsZS56SW5kZXggPSAnOTk5Jztcblx0XHRlbGVtZW50LnN0eWxlLndpZHRoID0gJzQwMHB4Jztcblx0XHRlbGVtZW50LnN0eWxlLm1hcmdpbiA9ICc1ZW0gYXV0byAwJztcblxuXHRcdGlmICggISB0aGlzLndlYmdsICkge1xuXG5cdFx0XHRlbGVtZW50LmlubmVySFRNTCA9IHdpbmRvdy5XZWJHTFJlbmRlcmluZ0NvbnRleHQgPyBbXG5cdFx0XHRcdCdZb3VyIGdyYXBoaWNzIGNhcmQgZG9lcyBub3Qgc2VlbSB0byBzdXBwb3J0IDxhIGhyZWY9XCJodHRwOi8va2hyb25vcy5vcmcvd2ViZ2wvd2lraS9HZXR0aW5nX2FfV2ViR0xfSW1wbGVtZW50YXRpb25cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5XZWJHTDwvYT4uPGJyIC8+Jyxcblx0XHRcdFx0J0ZpbmQgb3V0IGhvdyB0byBnZXQgaXQgPGEgaHJlZj1cImh0dHA6Ly9nZXQud2ViZ2wub3JnL1wiIHN0eWxlPVwiY29sb3I6IzAwMFwiPmhlcmU8L2E+Lidcblx0XHRcdF0uam9pbiggJ1xcbicgKSA6IFtcblx0XHRcdFx0J1lvdXIgYnJvd3NlciBkb2VzIG5vdCBzZWVtIHRvIHN1cHBvcnQgPGEgaHJlZj1cImh0dHA6Ly9raHJvbm9zLm9yZy93ZWJnbC93aWtpL0dldHRpbmdfYV9XZWJHTF9JbXBsZW1lbnRhdGlvblwiIHN0eWxlPVwiY29sb3I6IzAwMFwiPldlYkdMPC9hPi48YnIvPicsXG5cdFx0XHRcdCdGaW5kIG91dCBob3cgdG8gZ2V0IGl0IDxhIGhyZWY9XCJodHRwOi8vZ2V0LndlYmdsLm9yZy9cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5oZXJlPC9hPi4nXG5cdFx0XHRdLmpvaW4oICdcXG4nICk7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gZWxlbWVudDtcblxuXHR9LFxuXG5cdGFkZEdldFdlYkdMTWVzc2FnZTogZnVuY3Rpb24gKCBwYXJhbWV0ZXJzICkge1xuXG5cdFx0dmFyIHBhcmVudCwgaWQsIGVsZW1lbnQ7XG5cblx0XHRwYXJhbWV0ZXJzID0gcGFyYW1ldGVycyB8fCB7fTtcblxuXHRcdHBhcmVudCA9IHBhcmFtZXRlcnMucGFyZW50ICE9PSB1bmRlZmluZWQgPyBwYXJhbWV0ZXJzLnBhcmVudCA6IGRvY3VtZW50LmJvZHk7XG5cdFx0aWQgPSBwYXJhbWV0ZXJzLmlkICE9PSB1bmRlZmluZWQgPyBwYXJhbWV0ZXJzLmlkIDogJ29sZGllJztcblxuXHRcdGVsZW1lbnQgPSBEZXRlY3Rvci5nZXRXZWJHTEVycm9yTWVzc2FnZSgpO1xuXHRcdGVsZW1lbnQuaWQgPSBpZDtcblxuXHRcdHBhcmVudC5hcHBlbmRDaGlsZCggZWxlbWVudCApO1xuXG5cdH1cblxufTtcblxuLy9FUzYgZXhwb3J0XG5cbmV4cG9ydCB7IERldGVjdG9yIH07XG4iLCIvL1RoaXMgbGlicmFyeSBpcyBkZXNpZ25lZCB0byBoZWxwIHN0YXJ0IHRocmVlLmpzIGVhc2lseSwgY3JlYXRpbmcgdGhlIHJlbmRlciBsb29wIGFuZCBjYW52YXMgYXV0b21hZ2ljYWxseS5cbi8vUmVhbGx5IGl0IHNob3VsZCBiZSBzcHVuIG9mZiBpbnRvIGl0cyBvd24gdGhpbmcgaW5zdGVhZCBvZiBiZWluZyBwYXJ0IG9mIGV4cGxhbmFyaWEuXG5cbi8vYWxzbywgY2hhbmdlIFRocmVlYXN5X0Vudmlyb25tZW50IHRvIFRocmVlYXN5X1JlY29yZGVyIHRvIGRvd25sb2FkIGhpZ2gtcXVhbGl0eSBmcmFtZXMgb2YgYW4gYW5pbWF0aW9uXG5cbmltcG9ydCBDQ2FwdHVyZSBmcm9tICdjY2FwdHVyZS5qcyc7XG5pbXBvcnQgeyBEZXRlY3RvciB9IGZyb20gJy4uL2xpYi9XZWJHTF9EZXRlY3Rvci5qcyc7XG5cbmZ1bmN0aW9uIFRocmVlYXN5RW52aXJvbm1lbnQoYXV0b3N0YXJ0ID0gdHJ1ZSl7XG5cdHRoaXMucHJldl90aW1lc3RlcCA9IDA7XG5cdHRoaXMuYXV0b3N0YXJ0ID0gYXV0b3N0YXJ0O1xuXG5cdGlmKCFEZXRlY3Rvci53ZWJnbClEZXRlY3Rvci5hZGRHZXRXZWJHTE1lc3NhZ2UoKTtcblxuXHR0aGlzLmNhbWVyYSA9IG5ldyBUSFJFRS5PcnRob2dyYXBoaWNDYW1lcmEoe1xuXHRcdG5lYXI6IC4xLFxuXHRcdGZhcjogMTAwMDAsXG5cblx0XHQvL3R5cGU6ICdwZXJzcGVjdGl2ZScsXG5cdFx0Zm92OiA2MCxcblx0XHRhc3BlY3Q6IDEsXG4vKlxuXHRcdC8vIHR5cGU6ICdvcnRob2dyYXBoaWMnLFxuXHRcdGxlZnQ6IC0xLFxuXHRcdHJpZ2h0OiAxLFxuXHRcdGJvdHRvbTogLTEsXG5cdFx0dG9wOiAxLCovXG5cdCAgfSk7XG5cblx0dGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoIDcwLCB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgMC4xLCAxMDAwMDAwMCApO1xuXHQvL3RoaXMuY2FtZXJhID0gbmV3IFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYSggNzAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDEwICk7XG5cblx0dGhpcy5jYW1lcmEucG9zaXRpb24uc2V0KDAsIDAsIDEwKTtcblx0dGhpcy5jYW1lcmEubG9va0F0KG5ldyBUSFJFRS5WZWN0b3IzKDAsMCwwKSk7XG5cblxuXHR0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoIHsgYW50aWFsaWFzOiB0cnVlIH0gKTtcblx0dGhpcy5yZW5kZXJlci5zZXRQaXhlbFJhdGlvKCB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldFNpemUoIHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQgKTtcblx0dGhpcy5yZW5kZXJlci5nYW1tYUlucHV0ID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci5nYW1tYU91dHB1dCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIuc2hhZG93TWFwLmVuYWJsZWQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlO1xuXHQvL2NyZWF0ZSBjYW1lcmEsIHNjZW5lLCB0aW1lciwgcmVuZGVyZXIgb2JqZWN0c1xuXHQvL2NyYWV0ZSByZW5kZXIgb2JqZWN0XG5cblxuXHRcblx0dGhpcy5zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xuXG5cdHRoaXMuc2NlbmUuYWRkKHRoaXMuY2FtZXJhKTtcblxuXHR0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoIHsgYW50aWFsaWFzOiB0cnVlIH0gKTtcblx0dGhpcy5yZW5kZXJlci5zZXRQaXhlbFJhdGlvKCB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldFNpemUoIHRoaXMuZXZlbmlmeSh3aW5kb3cuaW5uZXJXaWR0aCksdGhpcy5ldmVuaWZ5KHdpbmRvdy5pbm5lckhlaWdodCkgKTtcblx0dGhpcy5yZW5kZXJlci5zZXRDbGVhckNvbG9yKG5ldyBUSFJFRS5Db2xvcigweEZGRkZGRiksIDEuMCk7XG5cblx0dGhpcy5hc3BlY3QgPSB3aW5kb3cuaW5uZXJXaWR0aC93aW5kb3cuaW5uZXJIZWlnaHQ7XG5cblx0dGhpcy50aW1lU2NhbGUgPSAxO1xuXHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblxuXHR0aGlzLmNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKCB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQgKTtcblxuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIHRoaXMub25Nb3VzZURvd24uYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZXVwJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaHN0YXJ0JywgdGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoZW5kJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIHRoaXMub25XaW5kb3dSZXNpemUuYmluZCh0aGlzKSwgZmFsc2UgKTtcblxuXHQvKlxuXHQvL3JlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlOyBcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd2cmRpc3BsYXlwb2ludGVycmVzdHJpY3RlZCcsIG9uUG9pbnRlclJlc3RyaWN0ZWQsIGZhbHNlICk7XG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cG9pbnRlcnVucmVzdHJpY3RlZCcsIG9uUG9pbnRlclVucmVzdHJpY3RlZCwgZmFsc2UgKTtcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggV0VCVlIuY3JlYXRlQnV0dG9uKCByZW5kZXJlciApICk7XG5cdCovXG5cblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCB0aGlzLm9uUGFnZUxvYWQuYmluZCh0aGlzKSwgZmFsc2UpO1xuXG5cdHRoaXMuY2xvY2sgPSBuZXcgVEhSRUUuQ2xvY2soKTtcblxuXHR0aGlzLklTX1JFQ09SRElORyA9IGZhbHNlOyAvLyBxdWVyeWFibGUgaWYgb25lIHdhbnRzIHRvIGRvIHRoaW5ncyBsaWtlIGJlZWYgdXAgcGFydGljbGUgY291bnRzIGZvciByZW5kZXJcbn1cblxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25QYWdlTG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRjb25zb2xlLmxvZyhcIlRocmVlYXN5X1NldHVwIGxvYWRlZCFcIik7XG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHRoaXMuY29udGFpbmVyICk7XG5cblx0aWYodGhpcy5hdXRvc3RhcnQpe1xuXHRcdHRoaXMuc3RhcnQoKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe1xuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSBwZXJmb3JtYW5jZS5ub3coKTtcblx0dGhpcy5jbG9jay5zdGFydCgpO1xuXHR0aGlzLnJlbmRlcih0aGlzLnByZXZfdGltZXN0ZXApO1xufVxuXG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbk1vdXNlRG93biA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmlzTW91c2VEb3duID0gdHJ1ZTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uTW91c2VVcD0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuaXNNb3VzZURvd24gPSBmYWxzZTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUG9pbnRlclJlc3RyaWN0ZWQ9IGZ1bmN0aW9uKCkge1xuXHR2YXIgcG9pbnRlckxvY2tFbGVtZW50ID0gcmVuZGVyZXIuZG9tRWxlbWVudDtcblx0aWYgKCBwb2ludGVyTG9ja0VsZW1lbnQgJiYgdHlwZW9mKHBvaW50ZXJMb2NrRWxlbWVudC5yZXF1ZXN0UG9pbnRlckxvY2spID09PSAnZnVuY3Rpb24nICkge1xuXHRcdHBvaW50ZXJMb2NrRWxlbWVudC5yZXF1ZXN0UG9pbnRlckxvY2soKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Qb2ludGVyVW5yZXN0cmljdGVkPSBmdW5jdGlvbigpIHtcblx0dmFyIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgPSBkb2N1bWVudC5wb2ludGVyTG9ja0VsZW1lbnQ7XG5cdHZhciBleHBlY3RlZFBvaW50ZXJMb2NrRWxlbWVudCA9IHJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cdGlmICggY3VycmVudFBvaW50ZXJMb2NrRWxlbWVudCAmJiBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ID09PSBleHBlY3RlZFBvaW50ZXJMb2NrRWxlbWVudCAmJiB0eXBlb2YoZG9jdW1lbnQuZXhpdFBvaW50ZXJMb2NrKSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRkb2N1bWVudC5leGl0UG9pbnRlckxvY2soKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUuZXZlbmlmeSA9IGZ1bmN0aW9uKHgpe1xuXHRpZih4ICUgMiA9PSAxKXtcblx0XHRyZXR1cm4geCsxXG5cdH07XG5cdHJldHVybiB4O1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25XaW5kb3dSZXNpemU9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmNhbWVyYS5hc3BlY3QgPSB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodDtcblx0dGhpcy5hc3BlY3QgPSB0aGlzLmNhbWVyYS5hc3BlY3Q7XG5cdHRoaXMuY2FtZXJhLnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKTtcblx0dGhpcy5yZW5kZXJlci5zZXRTaXplKCB0aGlzLmV2ZW5pZnkod2luZG93LmlubmVyV2lkdGgpLHRoaXMuZXZlbmlmeSh3aW5kb3cuaW5uZXJIZWlnaHQpICk7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5saXN0ZW5lcnMgPSB7XCJ1cGRhdGVcIjogW10sXCJyZW5kZXJcIjpbXX07IC8vdXBkYXRlIGV2ZW50IGxpc3RlbmVyc1xuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24odGltZXN0ZXApe1xuXHR2YXIgZGVsdGEgPSB0aGlzLmNsb2NrLmdldERlbHRhKCkqdGhpcy50aW1lU2NhbGU7XG5cdHRoaXMuZWxhcHNlZFRpbWUgKz0gZGVsdGE7XG5cdC8vZ2V0IHRpbWVzdGVwXG5cdGZvcih2YXIgaT0wO2k8dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0ubGVuZ3RoO2krKyl7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl1baV0oe1widFwiOnRoaXMuZWxhcHNlZFRpbWUsXCJkZWx0YVwiOmRlbHRhfSk7XG5cdH1cblxuXHR0aGlzLnJlbmRlcmVyLnJlbmRlciggdGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEgKTtcblxuXHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLmxlbmd0aDtpKyspe1xuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdW2ldKCk7XG5cdH1cblxuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSB0aW1lc3RlcDtcblx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLnJlbmRlci5iaW5kKHRoaXMpKTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZXZlbnRfbmFtZSwgZnVuYyl7XG5cdC8vUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyLlxuXHQvL2VhY2ggbGlzdGVuZXIgd2lsbCBiZSBjYWxsZWQgd2l0aCBhbiBvYmplY3QgY29uc2lzdGluZyBvZjpcblx0Ly9cdHt0OiA8Y3VycmVudCB0aW1lIGluIHM+LCBcImRlbHRhXCI6IDxkZWx0YSwgaW4gbXM+fVxuXHQvLyBhbiB1cGRhdGUgZXZlbnQgZmlyZXMgYmVmb3JlIGEgcmVuZGVyLiBhIHJlbmRlciBldmVudCBmaXJlcyBwb3N0LXJlbmRlci5cblx0aWYoZXZlbnRfbmFtZSA9PSBcInVwZGF0ZVwiKXsgXG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0ucHVzaChmdW5jKTtcblx0fWVsc2UgaWYoZXZlbnRfbmFtZSA9PSBcInJlbmRlclwiKXsgXG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0ucHVzaChmdW5jKTtcblx0fWVsc2V7XG5cdFx0Y29uc29sZS5lcnJvcihcIkludmFsaWQgZXZlbnQgbmFtZSFcIilcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKGV2ZW50X25hbWUsIGZ1bmMpe1xuXHQvL1VucmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyLCB1bmRvaW5nIGFuIFRocmVlYXN5X3NldHVwLm9uKCkgZXZlbnQgbGlzdGVuZXIuXG5cdC8vdGhlIG5hbWluZyBzY2hlbWUgbWlnaHQgbm90IGJlIHRoZSBiZXN0IGhlcmUuXG5cdGlmKGV2ZW50X25hbWUgPT0gXCJ1cGRhdGVcIil7IFxuXHRcdGxldCBpbmRleCA9IHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmluZGV4T2YoZnVuYyk7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0uc3BsaWNlKGluZGV4LDEpO1xuXHR9IGVsc2UgaWYoZXZlbnRfbmFtZSA9PSBcInJlbmRlclwiKXsgXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0uaW5kZXhPZihmdW5jKTtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5zcGxpY2UoaW5kZXgsMSk7XG5cdH1lbHNle1xuXHRcdGNvbnNvbGUuZXJyb3IoXCJOb25leGlzdGVudCBldmVudCBuYW1lIVwiKVxuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vZmYgPSBUaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyOyAvL2FsaWFzIHRvIG1hdGNoIFRocmVlYXN5RW52aXJvbm1lbnQub25cblxuY2xhc3MgVGhyZWVhc3lSZWNvcmRlciBleHRlbmRzIFRocmVlYXN5RW52aXJvbm1lbnR7XG5cdC8vYmFzZWQgb24gaHR0cDovL3d3dy50eXNvbmNhZGVuaGVhZC5jb20vYmxvZy9leHBvcnRpbmctY2FudmFzLWFuaW1hdGlvbi10by1tb3YvIHRvIHJlY29yZCBhbiBhbmltYXRpb25cblx0Ly93aGVuIGRvbmUsICAgICBmZm1wZWcgLXIgNjAgLWZyYW1lcmF0ZSA2MCAtaSAuLyUwN2QucG5nIC12Y29kZWMgbGlieDI2NCAtcGl4X2ZtdCB5dXY0MjBwIC1jcmY6diAwIHZpZGVvLm1wNFxuICAgIC8vIHRvIHBlcmZvcm0gbW90aW9uIGJsdXIgb24gYW4gb3ZlcnNhbXBsZWQgdmlkZW8sIGZmbXBlZyAtaSB2aWRlby5tcDQgLXZmIHRibGVuZD1hbGxfbW9kZT1hdmVyYWdlLGZyYW1lc3RlcD0yIHZpZGVvMi5tcDRcblx0Ly90aGVuLCBhZGQgdGhlIHl1djQyMHAgcGl4ZWxzICh3aGljaCBmb3Igc29tZSByZWFzb24gaXNuJ3QgZG9uZSBieSB0aGUgcHJldiBjb21tYW5kKSBieTpcblx0Ly8gZmZtcGVnIC1pIHZpZGVvLm1wNCAtdmNvZGVjIGxpYngyNjQgLXBpeF9mbXQgeXV2NDIwcCAtc3RyaWN0IC0yIC1hY29kZWMgYWFjIGZpbmlzaGVkX3ZpZGVvLm1wNFxuXHQvL2NoZWNrIHdpdGggZmZtcGVnIC1pIGZpbmlzaGVkX3ZpZGVvLm1wNFxuXG5cdGNvbnN0cnVjdG9yKGF1dG9zdGFydCwgZnBzPTMwLCBsZW5ndGggPSA1KXtcblx0XHQvKiBmcHMgaXMgZXZpZGVudCwgYXV0b3N0YXJ0IGlzIGEgYm9vbGVhbiAoYnkgZGVmYXVsdCwgdHJ1ZSksIGFuZCBsZW5ndGggaXMgaW4gcy4qL1xuXHRcdHN1cGVyKGF1dG9zdGFydCk7XG5cdFx0dGhpcy5mcHMgPSBmcHM7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSA9IDA7XG5cdFx0dGhpcy5mcmFtZUNvdW50ID0gZnBzICogbGVuZ3RoO1xuXHRcdHRoaXMuZnJhbWVzX3JlbmRlcmVkID0gMDtcblxuXHRcdHRoaXMuY2FwdHVyZXIgPSBuZXcgQ0NhcHR1cmUoIHtcblx0XHRcdGZyYW1lcmF0ZTogZnBzLFxuXHRcdFx0Zm9ybWF0OiAncG5nJyxcblx0XHRcdG5hbWU6IGRvY3VtZW50LnRpdGxlLFxuXHRcdFx0Ly92ZXJib3NlOiB0cnVlLFxuXHRcdH0gKTtcblxuXHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cblx0XHR0aGlzLklTX1JFQ09SRElORyA9IHRydWU7XG5cdH1cblx0c3RhcnQoKXtcblx0XHQvL21ha2UgYSByZWNvcmRpbmcgc2lnblxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUud2lkdGg9XCIyMHB4XCJcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmhlaWdodD1cIjIwcHhcIlxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUudG9wID0gJzIwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUubGVmdCA9ICcyMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdyZWQnO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yZWNvcmRpbmdfaWNvbik7XG5cblx0XHR0aGlzLmZyYW1lQ291bnRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLnRvcCA9ICcyMHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5sZWZ0ID0gJzUwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmNvbG9yID0gJ2JsYWNrJztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnMTBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMjU1LDI1NSwyNTUsMC4xKSc7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLmZyYW1lQ291bnRlcik7XG5cblx0XHR0aGlzLmNhcHR1cmVyLnN0YXJ0KCk7XG5cdFx0dGhpcy5yZW5kZXJpbmcgPSB0cnVlO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblx0cmVuZGVyKHRpbWVzdGVwKXtcblx0XHR2YXIgZGVsdGEgPSAxL3RoaXMuZnBzKnRoaXMudGltZVNjYWxlOyAvL2lnbm9yaW5nIHRoZSB0cnVlIHRpbWUsIGNhbGN1bGF0ZSB0aGUgZGVsdGFcblxuXHRcdC8vZ2V0IHRpbWVzdGVwXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YX0pO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSApO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdW2ldKCk7XG5cdFx0fVxuXG5cblx0XHR0aGlzLnJlY29yZF9mcmFtZSgpO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xuXHR9XG5cdHJlY29yZF9mcmFtZSgpe1xuXHQvL1x0bGV0IGN1cnJlbnRfZnJhbWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYW52YXMnKS50b0RhdGFVUkwoKTtcblxuXHRcdHRoaXMuY2FwdHVyZXIuY2FwdHVyZSggZG9jdW1lbnQucXVlcnlTZWxlY3RvcignY2FudmFzJykgKTtcblxuXHRcdHRoaXMuZnJhbWVDb3VudGVyLmlubmVySFRNTCA9IHRoaXMuZnJhbWVzX3JlbmRlcmVkICsgXCIgLyBcIiArIHRoaXMuZnJhbWVDb3VudDsgLy91cGRhdGUgdGltZXJcblxuXHRcdHRoaXMuZnJhbWVzX3JlbmRlcmVkKys7XG5cblxuXHRcdGlmKHRoaXMuZnJhbWVzX3JlbmRlcmVkPnRoaXMuZnJhbWVDb3VudCl7XG5cdFx0XHR0aGlzLnJlbmRlciA9IG51bGw7IC8vaGFja3kgd2F5IG9mIHN0b3BwaW5nIHRoZSByZW5kZXJpbmdcblx0XHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0Ly90aGlzLmZyYW1lQ291bnRlci5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cblx0XHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cdFx0XHR0aGlzLmNhcHR1cmVyLnN0b3AoKTtcblx0XHRcdC8vIGRlZmF1bHQgc2F2ZSwgd2lsbCBkb3dubG9hZCBhdXRvbWF0aWNhbGx5IGEgZmlsZSBjYWxsZWQge25hbWV9LmV4dGVuc2lvbiAod2VibS9naWYvdGFyKVxuXHRcdFx0dGhpcy5jYXB0dXJlci5zYXZlKCk7XG5cdFx0fVxuXHR9XG5cdG9uV2luZG93UmVzaXplKCkge1xuXHRcdC8vc3RvcCByZWNvcmRpbmcgaWYgd2luZG93IHNpemUgY2hhbmdlc1xuXHRcdGlmKHRoaXMucmVuZGVyaW5nICYmIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0ICE9IHRoaXMuYXNwZWN0KXtcblx0XHRcdHRoaXMuY2FwdHVyZXIuc3RvcCgpO1xuXHRcdFx0dGhpcy5yZW5kZXIgPSBudWxsOyAvL2hhY2t5IHdheSBvZiBzdG9wcGluZyB0aGUgcmVuZGVyaW5nXG5cdFx0XHRhbGVydChcIkFib3J0aW5nIHJlY29yZDogV2luZG93LXNpemUgY2hhbmdlIGRldGVjdGVkIVwiKTtcblx0XHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN1cGVyLm9uV2luZG93UmVzaXplKCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gc2V0dXBUaHJlZShhdXRvc3RhcnQsIGZwcz0zMCwgbGVuZ3RoID0gNSl7XG5cdC8qIEFsbCB0aGUgZXhpc3RpbmcgY29kZSBJIGhhdmUgdXNlcyBcIm5ldyBUaHJlZWFzeVNldHVwXCIgb3IgXCJuZXcgVGhyZWVhc3lSZWNvcmRlclwiIGFuZCBJIHdhbnQgdG8gc3dpdGNoXG4gICBiZXR3ZWVuIHRoZW0gZHluYW1pY2FsbHkgc28gdGhhdCB5b3UgY2FuIHJlY29yZCBieSBhcHBlbmRpbmcgXCI/cmVjb3JkPXRydWVcIiB0byBhbiB1cmwuICovXG5cdHZhciByZWNvcmRlciA9IG51bGw7XG5cdHZhciBpc19yZWNvcmRpbmcgPSBmYWxzZTtcblxuXHQvL2V4dHJhY3QgcmVjb3JkIHBhcmFtZXRlciBmcm9tIHVybFxuXHR2YXIgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhkb2N1bWVudC5sb2NhdGlvbi5zZWFyY2gpO1xuXHRsZXQgcmVjb3JkU3RyaW5nID0gcGFyYW1zLmdldChcInJlY29yZFwiKTtcblxuXHRpZihyZWNvcmRTdHJpbmcpaXNfcmVjb3JkaW5nID0gcGFyYW1zLmdldChcInJlY29yZFwiKS50b0xvd2VyQ2FzZSgpID09IFwidHJ1ZVwiIHx8IHBhcmFtcy5nZXQoXCJyZWNvcmRcIikudG9Mb3dlckNhc2UoKSA9PSBcIjFcIjtcblxuXHRpZihpc19yZWNvcmRpbmcpe1xuXHRcdHJldHVybiBuZXcgVGhyZWVhc3lSZWNvcmRlcihhdXRvc3RhcnQsIGZwcywgbGVuZ3RoKTtcblx0XG5cdH1lbHNle1xuXHRcdHJldHVybiBuZXcgVGhyZWVhc3lFbnZpcm9ubWVudChhdXRvc3RhcnQpO1xuXHR9XG59XG5cbmV4cG9ydCB7c2V0dXBUaHJlZSwgVGhyZWVhc3lFbnZpcm9ubWVudCwgVGhyZWVhc3lSZWNvcmRlcn1cbiIsImFzeW5jIGZ1bmN0aW9uIGRlbGF5KHdhaXRUaW1lKXtcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHR9KTtcblxufVxuXG5leHBvcnQge2RlbGF5fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi9Ob2RlLmpzJztcblxuY2xhc3MgTGluZU91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKiBzaG91bGQgYmUgLmFkZCgpZWQgdG8gYSBUcmFuc2Zvcm1hdGlvbiB0byB3b3JrXG5cdFx0XHRvcHRpb25zOlxuXHRcdFx0e1xuXHRcdFx0XHR3aWR0aDogbnVtYmVyXG5cdFx0XHRcdG9wYWNpdHk6IG51bWJlclxuXHRcdFx0XHRjb2xvcjogaGV4IGNvZGUgb3IgVEhSRUUuQ29sb3IoKVxuXHRcdFx0fVxuXHRcdCovXG5cblx0XHR0aGlzLl93aWR0aCA9IG9wdGlvbnMud2lkdGggIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMud2lkdGggOiA1O1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmNvbG9yIDogMHg1NWFhNTU7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IDA7IC8vc2hvdWxkIGFsd2F5cyBiZSBlcXVhbCB0byB0aGlzLnBvaW50cy5sZW5ndGhcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gW107IC8vIGhvdyBtYW55IHRpbWVzIHRvIGJlIGNhbGxlZCBpbiBlYWNoIGRpcmVjdGlvblxuXHRcdHRoaXMuX291dHB1dERpbWVuc2lvbnMgPSAzOyAvL2hvdyBtYW55IGRpbWVuc2lvbnMgcGVyIHBvaW50IHRvIHN0b3JlP1xuXG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsO1xuXG5cdFx0dGhpcy5pbml0KCk7XG5cdH1cblx0aW5pdCgpe1xuXHRcdHRoaXMuX2dlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCk7XG5cdFx0dGhpcy5fdmVydGljZXM7XG5cdFx0dGhpcy5tYWtlR2VvbWV0cnkoKTtcblxuXHRcdHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe2NvbG9yOiB0aGlzLl9jb2xvciwgbGluZXdpZHRoOiB0aGlzLl93aWR0aCxvcGFjaXR5OnRoaXMuX29wYWNpdHl9KTtcblx0XHR0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTGluZVNlZ21lbnRzKHRoaXMuX2dlb21ldHJ5LHRoaXMubWF0ZXJpYWwpO1xuXG5cdFx0dGhpcy5vcGFjaXR5ID0gdGhpcy5fb3BhY2l0eTsgLy8gc2V0dGVyIHNldHMgdHJhbnNwYXJlbnQgZmxhZyBpZiBuZWNlc3NhcnlcblxuXHRcdHRocmVlLnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXHR9XG5cdG1ha2VHZW9tZXRyeSgpe1xuXHRcdC8vIGZvbGxvdyBodHRwOi8vYmxvZy5jamdhbW1vbi5jb20vdGhyZWVqcy1nZW9tZXRyeVxuXHRcdC8vIG9yIG1hdGhib3gncyBsaW5lR2VvbWV0cnlcblxuXHRcdC8qXG5cdFx0VGhpcyBjb2RlIHNlZW1zIHRvIGJlIG5lY2Vzc2FyeSB0byByZW5kZXIgbGluZXMgYXMgYSB0cmlhbmdsZSBzdHJwLlxuXHRcdEkgY2FuJ3Qgc2VlbSB0byBnZXQgaXQgdG8gd29yayBwcm9wZXJseS5cblxuXHRcdGxldCBudW1WZXJ0aWNlcyA9IDM7XG5cdFx0dmFyIGluZGljZXMgPSBbXTtcblxuXHRcdC8vaW5kaWNlc1xuXHRcdGxldCBiYXNlID0gMDtcblx0XHRmb3IodmFyIGs9MDtrPG51bVZlcnRpY2VzLTE7ays9MSl7XG4gICAgICAgIFx0aW5kaWNlcy5wdXNoKCBiYXNlLCBiYXNlKzEsIGJhc2UrMik7XG5cdFx0XHRpbmRpY2VzLnB1c2goIGJhc2UrMiwgYmFzZSsxLCBiYXNlKzMpO1xuXHRcdFx0YmFzZSArPSAyO1xuXHRcdH1cblx0XHR0aGlzLl9nZW9tZXRyeS5zZXRJbmRleCggaW5kaWNlcyApOyovXG5cblx0XHRsZXQgTUFYX1BPSU5UUyA9IDEwMDAwO1xuXG5cdFx0dGhpcy5fdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KE1BWF9QT0lOVFMgKiAyICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyk7XG5cblx0XHQvLyBidWlsZCBnZW9tZXRyeVxuXG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAncG9zaXRpb24nLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdGhpcy5fdmVydGljZXMsIHRoaXMuX291dHB1dERpbWVuc2lvbnMgKSApO1xuXHRcdC8vdGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnbm9ybWFsJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIG5vcm1hbHMsIDMgKSApO1xuXHRcdC8vdGhpcy5nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICd1dicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB1dnMsIDIgKSApO1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3VzZWQgZHVyaW5nIHVwZGF0ZXMgYXMgYSBwb2ludGVyIHRvIHRoZSBidWZmZXJcblxuXHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblxuXHR9XG5cdF9vbkFkZCgpe1xuXHRcdC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBBcmVhXG5cdFx0bGV0IHJvb3QgPSB0aGlzO1xuXHRcdHdoaWxlKHJvb3QucGFyZW50ICE9PSBudWxsKXtcblx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcblx0XHR9XG5cdFxuXHRcdC8vdG9kbzogaW1wbGVtZW50IHNvbWV0aGluZyBsaWtlIGFzc2VydCByb290IHR5cGVvZiBSb290Tm9kZVxuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcblx0XHR0aGlzLl9vbkFkZCgpOyAvL3NldHVwIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLml0ZW1EaW1lbnNpb25zLiB1c2VkIGhlcmUgYWdhaW4gYmVjYXVzZSBjbG9uaW5nIG1lYW5zIHRoZSBvbkFkZCgpIG1pZ2h0IGJlIGNhbGxlZCBiZWZvcmUgdGhpcyBpcyBjb25uZWN0ZWQgdG8gYSB0eXBlIG9mIGRvbWFpblxuXG5cdFx0Ly8gcGVyaGFwcyBpbnN0ZWFkIG9mIGdlbmVyYXRpbmcgYSB3aG9sZSBuZXcgYXJyYXksIHRoaXMgY2FuIHJldXNlIHRoZSBvbGQgb25lP1xuXHRcdGxldCB2ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zICogMik7XG5cblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdHRoaXMuX3ZlcnRpY2VzID0gdmVydGljZXM7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUuc2V0QXJyYXkodGhpcy5fdmVydGljZXMpO1xuXG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHRpZighdGhpcy5fYWN0aXZhdGVkT25jZSl7XG5cdFx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRmlyc3RBY3RpdmF0aW9uKCk7XHRcblx0XHR9XG5cblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cblx0XHQvL2Fzc2VydCBpIDwgdmVydGljZXMuY291bnRcblxuXHRcdGxldCBpbmRleCA9IHRoaXMuX2N1cnJlbnRQb2ludEluZGV4KnRoaXMuX291dHB1dERpbWVuc2lvbnM7XG5cblx0XHRpZih4ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXhdID0geDtcblx0XHRpZih5ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMV0gPSB5O1xuXHRcdGlmKHogIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXSA9IHo7XG5cblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXG5cdFx0Lyogd2UncmUgZHJhd2luZyBsaWtlIHRoaXM6XG5cdFx0Ki0tLS0qLS0tLSpcblxuICAgICAgICAqLS0tLSotLS0tKlxuXHRcblx0XHRidXQgd2UgZG9uJ3Qgd2FudCB0byBpbnNlcnQgYSBkaWFnb25hbCBsaW5lIGFueXdoZXJlLiBUaGlzIGhhbmRsZXMgdGhhdDogICovXG5cblx0XHRsZXQgZmlyc3RDb29yZGluYXRlID0gaSAlIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV07XG5cblx0XHRpZighKGZpcnN0Q29vcmRpbmF0ZSA9PSAwIHx8IGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpKXtcblx0XHRcdGlmKHggIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zXSA9IHg7XG5cdFx0XHRpZih5ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysxXSA9IHk7XG5cdFx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysyXSA9IHo7XG5cdFx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXHRcdH1cblxuXHRcdC8vdmVydGljZXMgc2hvdWxkIHJlYWxseSBiZSBhbiB1bmlmb3JtLCB0aG91Z2guXG5cdH1cblx0b25BZnRlckFjdGl2YXRpb24oKXtcblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCA9IDA7IC8vcmVzZXQgYWZ0ZXIgZWFjaCB1cGRhdGVcblx0fVxuXHRzZXQgY29sb3IoY29sb3Ipe1xuXHRcdC8vY3VycmVudGx5IG9ubHkgYSBzaW5nbGUgY29sb3IgaXMgc3VwcG9ydGVkLlxuXHRcdC8vSSBzaG91bGQgcmVhbGx5XG5cdFx0dGhpcy5tYXRlcmlhbC5jb2xvciA9IG5ldyBUSFJFRS5Db2xvcihjb2xvcik7XG5cdFx0dGhpcy5fY29sb3IgPSBjb2xvcjtcblx0fVxuXHRnZXQgY29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3I7XG5cdH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0dGhpcy5tYXRlcmlhbC5vcGFjaXR5ID0gb3BhY2l0eTtcblx0XHR0aGlzLm1hdGVyaWFsLnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG5cdFx0dGhpcy5tYXRlcmlhbC52aXNpYmxlID0gb3BhY2l0eSA+IDA7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRzZXQgd2lkdGgod2lkdGgpe1xuXHRcdHRoaXMuX3dpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5tYXRlcmlhbC5saW5ld2lkdGggPSB3aWR0aDtcblx0fVxuXHRnZXQgd2lkdGgoKXtcblx0XHRyZXR1cm4gdGhpcy5fd2lkdGg7XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IExpbmVPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuZXhwb3J0IHtMaW5lT3V0cHV0fTtcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFBvaW50e1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHQvKm9wdGlvbnM6IGNvbG9yOiA8VEhSRUUuQ29sb3Igb3IgaGV4IGNvZGVcblx0XHRcdHgseTogbnVtYmVyc1xuXHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdCovXG5cblx0XHRsZXQgd2lkdGggPSBvcHRpb25zLndpZHRoID09PSB1bmRlZmluZWQgPyAxIDogb3B0aW9ucy53aWR0aFxuXHRcdGxldCBjb2xvciA9IG9wdGlvbnMuY29sb3IgPT09IHVuZGVmaW5lZCA/IDB4Nzc3Nzc3IDogb3B0aW9ucy5jb2xvcjtcblxuXHRcdHRoaXMubWVzaCA9IG5ldyBUSFJFRS5NZXNoKHRoaXMuc2hhcmVkQ2lyY2xlR2VvbWV0cnksdGhpcy5nZXRGcm9tTWF0ZXJpYWxDYWNoZShjb2xvcikpO1xuXG5cdFx0dGhpcy5vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ID09PSB1bmRlZmluZWQgPyAxIDogb3B0aW9ucy5vcGFjaXR5OyAvL3RyaWdnZXIgc2V0dGVyXG5cblx0XHR0aGlzLm1lc2gucG9zaXRpb24uc2V0KHRoaXMueCx0aGlzLnksdGhpcy56KTtcblx0XHR0aGlzLm1lc2guc2NhbGUuc2V0U2NhbGFyKHRoaXMud2lkdGgvMik7XG5cdFx0dGhyZWUuc2NlbmUuYWRkKHRoaXMubWVzaCk7XG5cblx0XHR0aGlzLnggPSBvcHRpb25zLnggfHwgMDtcblx0XHR0aGlzLnkgPSBvcHRpb25zLnkgfHwgMDtcblx0XHR0aGlzLnogPSBvcHRpb25zLnogfHwgMDtcblx0fVxuXHRzZXQgeChpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueCA9IGk7XG5cdH1cblx0c2V0IHkoaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnkgPSBpO1xuXHR9XG5cdHNldCB6KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi56ID0gaTtcblx0fVxuXHRnZXQgeCgpe1xuXHRcdHJldHVybiB0aGlzLm1lc2gucG9zaXRpb24ueDtcblx0fVxuXHRnZXQgeSgpe1xuXHRcdHJldHVybiB0aGlzLm1lc2gucG9zaXRpb24ueTtcblx0fVxuXHRnZXQgeigpe1xuXHRcdHJldHVybiB0aGlzLm1lc2gucG9zaXRpb24uejtcblx0fVxuXHRzZXQgb3BhY2l0eShvcGFjaXR5KXtcblx0XHRsZXQgbWF0ID0gdGhpcy5tZXNoLm1hdGVyaWFsO1xuXHRcdG1hdC5vcGFjaXR5ID0gb3BhY2l0eTtcblx0XHRtYXQudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMTtcblx0XHR0aGlzLl9vcGFjaXR5ID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdGdldEZyb21NYXRlcmlhbENhY2hlKGNvbG9yKXtcblx0XHRpZih0aGlzLl9tYXRlcmlhbHNbY29sb3JdID09PSB1bmRlZmluZWQpe1xuXHRcdFx0dGhpcy5fbWF0ZXJpYWxzW2NvbG9yXSA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7Y29sb3I6IGNvbG9yfSlcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX21hdGVyaWFsc1tjb2xvcl1cblx0fVxuXHRzZXQgY29sb3IoY29sb3Ipe1xuXHRcdHRoaXMubWVzaC5tYXRlcmlhbCA9IHRoaXMuZ2V0RnJvbU1hdGVyaWFsQ2FjaGUoY29sb3IpO1xuXHR9XG59XG5Qb2ludC5wcm90b3R5cGUuc2hhcmVkQ2lyY2xlR2VvbWV0cnkgPSBuZXcgVEhSRUUuU3BoZXJlR2VvbWV0cnkoMS8yLCA4LCA2KTsgLy9yYWRpdXMgMS8yIHNvIHRoYXQgc2NhbGluZyBieSBuIG1lYW5zIHdpZHRoPW5cblxuUG9pbnQucHJvdG90eXBlLl9tYXRlcmlhbHMgPSB7fTtcbiIsImltcG9ydCBQb2ludCBmcm9tICcuL1BvaW50LmpzJztcbmltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi9Ob2RlLmpzJztcblxuY2xhc3MgUG9pbnRPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lypcblx0XHRcdHdpZHRoOiBudW1iZXJcblx0XHRcdGNvbG9yOiBoZXggY29sb3IsIGFzIGluIDB4cnJnZ2JiLiBUZWNobmljYWxseSwgdGhpcyBpcyBhIEpTIGludGVnZXIuXG5cdFx0XHRvcGFjaXR5OiAwLTEuIE9wdGlvbmFsLlxuXHRcdCovXG5cblx0XHR0aGlzLl93aWR0aCA9IG9wdGlvbnMud2lkdGggIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMud2lkdGggOiAxO1xuXHRcdHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5jb2xvciA6IDB4NTVhYTU1O1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cblxuXHRcdHRoaXMucG9pbnRzID0gW107XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IDA7IC8vc2hvdWxkIGFsd2F5cyBiZSBlcXVhbCB0byB0aGlzLnBvaW50cy5sZW5ndGhcblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cblx0XHR0aGlzLnBhcmVudCA9IG51bGw7XG5cdH1cblx0X29uQWRkKCl7IC8vc2hvdWxkIGJlIGNhbGxlZCB3aGVuIHRoaXMgaXMgLmFkZCgpZWQgdG8gc29tZXRoaW5nXG5cblx0XHRsZXQgcGFyZW50Q291bnQgPSAwO1xuXHRcdC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBBcmVhXG5cdFx0bGV0IHJvb3QgPSB0aGlzO1xuXHRcdHdoaWxlKHJvb3QucGFyZW50ICE9PSBudWxsICYmIHBhcmVudENvdW50IDwgNTApe1xuXHRcdFx0cm9vdCA9IHJvb3QucGFyZW50O1xuXHRcdFx0cGFyZW50Q291bnQrKztcblx0XHR9XG5cdFx0aWYocGFyZW50Q291bnQgPj0gNTApdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGZpbmQgcm9vdCFcIik7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pe1xuXHRcdFx0Zm9yKHZhciBpPXRoaXMucG9pbnRzLmxlbmd0aDtpPHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO2krKyl7XG5cdFx0XHRcdHRoaXMucG9pbnRzLnB1c2gobmV3IFBvaW50KHt3aWR0aDogMSxjb2xvcjp0aGlzLl9jb2xvciwgb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSkpO1xuXHRcdFx0XHR0aGlzLnBvaW50c1tpXS5tZXNoLnNjYWxlLnNldFNjYWxhcih0aGlzLl93aWR0aCk7IC8vc2V0IHdpZHRoIGJ5IHNjYWxpbmcgcG9pbnRcblx0XHRcdFx0dGhpcy5wb2ludHNbaV0ubWVzaC52aXNpYmxlID0gZmFsc2U7IC8vaW5zdGFudGlhdGUgdGhlIHBvaW50XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdF9vbkZpcnN0QWN0aXZhdGlvbigpe1xuXHRcdGlmKHRoaXMucG9pbnRzLmxlbmd0aCA8IHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uKXRoaXMuX29uQWRkKCk7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope1xuXHRcdGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcblx0XHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTtcdFxuXHRcdH1cblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cdFx0dmFyIHBvaW50ID0gdGhpcy5nZXRQb2ludChpKTtcblx0XHRpZih4ICE9PSB1bmRlZmluZWQpcG9pbnQueCA9IHg7XG5cdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXBvaW50LnkgPSB5O1xuXHRcdGlmKHogIT09IHVuZGVmaW5lZClwb2ludC56ID0gejtcblx0XHRwb2ludC5tZXNoLnZpc2libGUgPSB0cnVlO1xuXHR9XG5cdGdldFBvaW50KGkpe1xuXHRcdHJldHVybiB0aGlzLnBvaW50c1tpXTtcblx0fVxuXHRzZXQgb3BhY2l0eShvcGFjaXR5KXtcblx0XHQvL3RlY2huaWNhbGx5IHRoaXMgd2lsbCBzZXQgYWxsIHBvaW50cyBvZiB0aGUgc2FtZSBjb2xvciwgYW5kIGl0J2xsIGJlIHdpcGVkIHdpdGggYSBjb2xvciBjaGFuZ2UuIEJ1dCBJJ2xsIGRlYWwgd2l0aCB0aGF0IHNvbWV0aW1lIGxhdGVyLlxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb247aSsrKXtcblx0XHRcdGxldCBtYXQgPSB0aGlzLmdldFBvaW50KGkpLm1lc2gubWF0ZXJpYWw7XG5cdFx0XHRtYXQub3BhY2l0eSA9IG9wYWNpdHk7IC8vaW5zdGFudGlhdGUgdGhlIHBvaW50XG5cdFx0XHRtYXQudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMTtcblx0XHR9XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRzZXQgY29sb3IoY29sb3Ipe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5wb2ludHMubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmdldFBvaW50KGkpLmNvbG9yID0gY29sb3I7XG5cdFx0fVxuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdH1cblx0Z2V0IGNvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbG9yO1xuXHR9XG5cdHNldCB3aWR0aCh3aWR0aCl7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnBvaW50cy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuZ2V0UG9pbnQoaSkubWVzaC5zY2FsZS5zZXRTY2FsYXIod2lkdGgpO1xuXHRcdH1cblx0XHR0aGlzLl93aWR0aCA9IHdpZHRoO1xuXHR9XG5cdGdldCB3aWR0aCgpe1xuXHRcdHJldHVybiB0aGlzLl93aWR0aDtcblx0fVxuXHRjbG9uZSgpe1xuXHRcdHJldHVybiBuZXcgUG9pbnRPdXRwdXQoe3dpZHRoOiB0aGlzLndpZHRoLCBjb2xvcjogdGhpcy5jb2xvciwgb3BhY2l0eTogdGhpcy5vcGFjaXR5fSk7XG5cdH1cbn1cblxuLy90ZXN0aW5nIGNvZGVcbmZ1bmN0aW9uIHRlc3RQb2ludCgpe1xuXHR2YXIgeCA9IG5ldyBFWFAuQXJlYSh7Ym91bmRzOiBbWy0xMCwxMF1dfSk7XG5cdHZhciB5ID0gbmV3IEVYUC5UcmFuc2Zvcm1hdGlvbih7J2V4cHInOiAoeCkgPT4geCp4fSk7XG5cdHZhciB5ID0gbmV3IEVYUC5Qb2ludE91dHB1dCgpO1xuXHR4LmFkZCh5KTtcblx0eS5hZGQoeik7XG5cdHguYWN0aXZhdGUoKTtcbn1cblxuZXhwb3J0IHtQb2ludE91dHB1dH1cbiIsImltcG9ydCB7IExpbmVPdXRwdXQgfSBmcm9tICcuL0xpbmVPdXRwdXQuanMnO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuL3V0aWxzLmpzJztcblxuZXhwb3J0IGNsYXNzIFZlY3Rvck91dHB1dCBleHRlbmRzIExpbmVPdXRwdXR7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0LyppbnB1dDogVHJhbnNmb3JtYXRpb25cblx0XHRcdHdpZHRoOiBudW1iZXJcblx0XHQqL1xuXHRcdHN1cGVyKG9wdGlvbnMpO1xuXG5cdH1cblx0aW5pdCgpe1xuXHRcdHRoaXMuX2dlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCk7XG5cdFx0dGhpcy5fdmVydGljZXM7XG5cdFx0dGhpcy5hcnJvd2hlYWRzID0gW107XG5cblxuXHRcdHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe2NvbG9yOiB0aGlzLl9jb2xvciwgbGluZXdpZHRoOiB0aGlzLl93aWR0aCwgb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSk7XG5cdFx0dGhpcy5saW5lTWVzaCA9IG5ldyBUSFJFRS5MaW5lU2VnbWVudHModGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cblx0XHR0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvLyBzZXR0ZXIgc2V0cyB0cmFuc3BhcmVudCBmbGFnIGlmIG5lY2Vzc2FyeVxuXG5cblx0XHRjb25zdCBjaXJjbGVSZXNvbHV0aW9uID0gMTI7XG5cdFx0Y29uc3QgYXJyb3doZWFkU2l6ZSA9IDAuMztcblx0XHRjb25zdCBFUFNJTE9OID0gMC4wMDAwMTtcblx0XHR0aGlzLkVQU0lMT04gPSBFUFNJTE9OO1xuXG5cdFx0dGhpcy5jb25lR2VvbWV0cnkgPSBuZXcgVEhSRUUuQ3lsaW5kZXJCdWZmZXJHZW9tZXRyeSggMCwgYXJyb3doZWFkU2l6ZSwgYXJyb3doZWFkU2l6ZSoxLjcsIGNpcmNsZVJlc29sdXRpb24sIDEgKTtcblx0XHRsZXQgYXJyb3doZWFkT3ZlcnNob290RmFjdG9yID0gMC4xOyAvL3VzZWQgc28gdGhhdCB0aGUgbGluZSB3b24ndCBydWRlbHkgY2xpcCB0aHJvdWdoIHRoZSBwb2ludCBvZiB0aGUgYXJyb3doZWFkXG5cblx0XHR0aGlzLmNvbmVHZW9tZXRyeS50cmFuc2xhdGUoIDAsIC0gYXJyb3doZWFkU2l6ZSArIGFycm93aGVhZE92ZXJzaG9vdEZhY3RvciwgMCApO1xuXG5cdFx0dGhpcy5fY29uZVVwRGlyZWN0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwxLDApO1xuXG5cdFx0dGhpcy5tYWtlR2VvbWV0cnkoKTtcblxuXHRcdHRocmVlLnNjZW5lLmFkZCh0aGlzLmxpbmVNZXNoKTtcblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcblx0XHRzdXBlci5fb25GaXJzdEFjdGl2YXRpb24oKTtcblxuXHRcdGlmKHRoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoID4gMSl7XG5cdFx0XHR0aGlzLm51bUFycm93aGVhZHMgPSB0aGlzLml0ZW1EaW1lbnNpb25zLnNsaWNlKDAsdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMSkucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cnJlbnQpe1xuXHRcdFx0XHRyZXR1cm4gY3VycmVudCArIHByZXY7XG5cdFx0XHR9KTtcblx0XHR9ZWxzZXtcblx0XHRcdC8vYXNzdW1lZCBpdGVtRGltZW5zaW9ucyBpc24ndCBhIG5vbnplcm8gYXJyYXkuIFRoYXQgc2hvdWxkIGJlIHRoZSBjb25zdHJ1Y3RvcidzIHByb2JsZW0uXG5cdFx0XHR0aGlzLm51bUFycm93aGVhZHMgPSAxO1xuXHRcdH1cblxuXHRcdC8vcmVtb3ZlIGFueSBwcmV2aW91cyBhcnJvd2hlYWRzXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmFycm93aGVhZHMubGVuZ3RoO2krKyl7XG5cdFx0XHRsZXQgYXJyb3cgPSB0aGlzLmFycm93aGVhZHNbaV07XG5cdFx0XHR0aHJlZS5zY2VuZS5yZW1vdmUoYXJyb3cpO1xuXHRcdH1cblxuXHRcdHRoaXMuYXJyb3doZWFkcyA9IG5ldyBBcnJheSh0aGlzLm51bUFycm93aGVhZHMpO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1BcnJvd2hlYWRzO2krKyl7XG5cdFx0XHR0aGlzLmFycm93aGVhZHNbaV0gPSBuZXcgVEhSRUUuTWVzaCh0aGlzLmNvbmVHZW9tZXRyeSwgdGhpcy5tYXRlcmlhbCk7XG5cdFx0XHR0aHJlZS5zY2VuZS5hZGQodGhpcy5hcnJvd2hlYWRzW2ldKTtcblx0XHR9XG5cdFx0Y29uc29sZS5sb2coXCJudW1iZXIgb2YgYXJyb3doZWFkcyAoPSBudW1iZXIgb2YgbGluZXMpOlwiKyB0aGlzLm51bUFycm93aGVhZHMpO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXG5cdFx0Ly9hc3NlcnQgaSA8IHZlcnRpY2VzLmNvdW50XG5cblx0XHRsZXQgaW5kZXggPSB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuXG5cdFx0aWYoeCAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4XSA9IHg7XG5cdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdID0geTtcblx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMl0gPSB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblxuXHRcdC8qIHdlJ3JlIGRyYXdpbmcgbGlrZSB0aGlzOlxuXHRcdCotLS0tKi0tLS0qXG5cbiAgICAgICAgKi0tLS0qLS0tLSpcblx0XG5cdFx0YnV0IHdlIGRvbid0IHdhbnQgdG8gaW5zZXJ0IGEgZGlhZ29uYWwgbGluZSBhbnl3aGVyZS4gVGhpcyBoYW5kbGVzIHRoYXQ6ICAqL1xuXG5cdFx0bGV0IGZpcnN0Q29vcmRpbmF0ZSA9IGkgJSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdO1xuXG5cdFx0Ly92ZXJ0aWNlcyBzaG91bGQgcmVhbGx5IGJlIGFuIHVuaWZvcm0sIHRob3VnaC5cblx0XHRpZighKGZpcnN0Q29vcmRpbmF0ZSA9PSAwIHx8IGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpKXtcblx0XHRcdGlmKHggIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zXSA9IHg7XG5cdFx0XHRpZih5ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysxXSA9IHk7XG5cdFx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysyXSA9IHo7XG5cdFx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXHRcdH1cblxuXHRcdGlmKGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpe1xuXG5cdFx0XHQvL2NhbGN1bGF0ZSBkaXJlY3Rpb24gb2YgbGFzdCBsaW5lIHNlZ21lbnRcblx0XHRcdGxldCBkeCA9IHRoaXMuX3ZlcnRpY2VzW2luZGV4LXRoaXMuX291dHB1dERpbWVuc2lvbnNdIC0gdGhpcy5fdmVydGljZXNbaW5kZXhdXG5cdFx0XHRsZXQgZHkgPSB0aGlzLl92ZXJ0aWNlc1tpbmRleC10aGlzLl9vdXRwdXREaW1lbnNpb25zKzFdIC0gdGhpcy5fdmVydGljZXNbaW5kZXgrMV1cblx0XHRcdGxldCBkeiA9IHRoaXMuX3ZlcnRpY2VzW2luZGV4LXRoaXMuX291dHB1dERpbWVuc2lvbnMrMl0gLSB0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXVxuXG5cdFx0XHRsZXQgbGluZU51bWJlciA9IE1hdGguZmxvb3IoaSAvIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0pO1xuXHRcdFx0VXRpbHMuYXNzZXJ0KGxpbmVOdW1iZXIgPD0gdGhpcy5udW1BcnJvd2hlYWRzKTsgLy90aGlzIG1heSBiZSB3cm9uZ1xuXG5cdFx0XHRsZXQgZGlyZWN0aW9uVmVjdG9yID0gbmV3IFRIUkVFLlZlY3RvcjMoLWR4LC1keSwtZHopXG5cblx0XHRcdC8vTWFrZSBhcnJvd3MgZGlzYXBwZWFyIGlmIHRoZSBsaW5lIGlzIHNtYWxsIGVub3VnaFxuXHRcdFx0Ly9PbmUgd2F5IHRvIGRvIHRoaXMgd291bGQgYmUgdG8gc3VtIHRoZSBkaXN0YW5jZXMgb2YgYWxsIGxpbmUgc2VnbWVudHMuIEknbSBjaGVhdGluZyBoZXJlIGFuZCBqdXN0IG1lYXN1cmluZyB0aGUgZGlzdGFuY2Ugb2YgdGhlIGxhc3QgdmVjdG9yLCB0aGVuIG11bHRpcGx5aW5nIGJ5IHRoZSBudW1iZXIgb2YgbGluZSBzZWdtZW50cyAobmFpdmVseSBhc3N1bWluZyBhbGwgbGluZSBzZWdtZW50cyBhcmUgdGhlIHNhbWUgbGVuZ3RoKVxuXHRcdFx0bGV0IGxlbmd0aCA9IGRpcmVjdGlvblZlY3Rvci5sZW5ndGgoKSAqICh0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpXG5cblx0XHRcdGNvbnN0IGVmZmVjdGl2ZURpc3RhbmNlID0gMztcblxuXHRcdFx0bGV0IGNsYW1wZWRMZW5ndGggPSBNYXRoLm1heCgwLCBNYXRoLm1pbihsZW5ndGgvZWZmZWN0aXZlRGlzdGFuY2UsIDEpKS8xXG5cblx0XHRcdC8vc2hyaW5rIGZ1bmN0aW9uIGRlc2lnbmVkIHRvIGhhdmUgYSBzdGVlcCBzbG9wZSBjbG9zZSB0byAwIGJ1dCBtZWxsb3cgb3V0IGF0IDAuNSBvciBzbyBpbiBvcmRlciB0byBhdm9pZCB0aGUgbGluZSB3aWR0aCBvdmVyY29taW5nIHRoZSBhcnJvd2hlYWQgd2lkdGhcblx0XHRcdC8vSW4gQ2hyb21lLCB0aHJlZS5qcyBjb21wbGFpbnMgd2hlbmV2ZXIgc29tZXRoaW5nIGlzIHNldCB0byAwIHNjYWxlLiBBZGRpbmcgYW4gZXBzaWxvbiB0ZXJtIGlzIHVuZm9ydHVuYXRlIGJ1dCBuZWNlc3NhcnkgdG8gYXZvaWQgY29uc29sZSBzcGFtLlxuXHRcdFx0XG5cdFx0XHR0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0uc2NhbGUuc2V0U2NhbGFyKE1hdGguYWNvcygxLTIqY2xhbXBlZExlbmd0aCkvTWF0aC5QSSArIHRoaXMuRVBTSUxPTik7XG5cdFx0XHRcbiBcdFx0XHQvL3Bvc2l0aW9uL3JvdGF0aW9uIGNvbWVzIGFmdGVyIHNpbmNlIC5ub3JtYWxpemUoKSBtb2RpZmllcyBkaXJlY3Rpb25WZWN0b3IgaW4gcGxhY2Vcblx0XHRcblx0XHRcdGxldCBwb3MgPSB0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0ucG9zaXRpb247XG5cblx0XHRcdGlmKHggIT09IHVuZGVmaW5lZClwb3MueCA9IHg7XG5cdFx0XHRpZih5ICE9PSB1bmRlZmluZWQpcG9zLnkgPSB5O1xuXHRcdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXBvcy56ID0gejtcblxuXHRcdFx0aWYobGVuZ3RoID4gMCl7IC8vZGlyZWN0aW9uVmVjdG9yLm5vcm1hbGl6ZSgpIGZhaWxzIHdpdGggMCBsZW5ndGhcblx0XHRcdFx0dGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnF1YXRlcm5pb24uc2V0RnJvbVVuaXRWZWN0b3JzKHRoaXMuX2NvbmVVcERpcmVjdGlvbiwgZGlyZWN0aW9uVmVjdG9yLm5vcm1hbGl6ZSgpICk7XG5cdFx0XHR9XG5cblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IFZlY3Rvck91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG5cbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vKlRoaXMgY2xhc3MgaXMgc3VwcG9zZWQgdG8gdHVybiBhIHNlcmllcyBvZlxuZGlyLmRlbGF5KClcbmRpci50cmFuc2l0aW9uVG8oLi4uKVxuZGlyLmRlbGF5KClcbmRpci5uZXh0U2xpZGUoKTtcblxuKi9cblxuaW1wb3J0IHtBbmltYXRpb259IGZyb20gJy4vQW5pbWF0aW9uLmpzJztcblxuY2xhc3MgRGlyZWN0aW9uQXJyb3d7XG5cdGNvbnN0cnVjdG9yKGZhY2VSaWdodCl7XG5cdFx0dGhpcy5hcnJvd0ltYWdlID0gRGlyZWN0aW9uQXJyb3cuYXJyb3dJbWFnZTsgLy90aGlzIHNob3VsZCBiZSBjaGFuZ2VkIG9uY2UgSSB3YW50IHRvIG1ha2UgbXVsdGlwbGUgYXJyb3dzIGF0IG9uY2VcblxuXHRcdGZhY2VSaWdodCA9IGZhY2VSaWdodD09PXVuZGVmaW5lZCA/IHRydWUgOiBmYWNlUmlnaHQ7XG5cblx0XHRpZihmYWNlUmlnaHQpe1xuXHRcdFx0dGhpcy5hcnJvd0ltYWdlLmNsYXNzTGlzdC5hZGQoXCJleHAtYXJyb3ctcmlnaHRcIilcblx0XHR9ZWxzZXtcblx0XHRcdHRoaXMuYXJyb3dJbWFnZS5jbGFzc0xpc3QuYWRkKFwiZXhwLWFycm93LWxlZnRcIilcblx0XHR9XG5cdFx0dGhpcy5hcnJvd0ltYWdlLm9uY2xpY2sgPSAoZnVuY3Rpb24oKXtcblx0XHRcdHRoaXMub25jbGljaygpO1xuXHRcdH0pLmJpbmQodGhpcyk7XG5cblx0XHR0aGlzLm9uY2xpY2tDYWxsYmFjayA9IG51bGw7IC8vIHRvIGJlIHNldCBleHRlcm5hbGx5XG5cdH1cblx0b25jbGljaygpe1xuXHRcdHRoaXMuaGlkZVNlbGYoKTtcblx0XHR0aGlzLm9uY2xpY2tDYWxsYmFjaygpO1xuXHR9XG5cdHNob3dTZWxmKCl7XG5cdFx0dGhpcy5hcnJvd0ltYWdlLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnJztcblx0XHR0aGlzLmFycm93SW1hZ2Uuc3R5bGUub3BhY2l0eSA9IDE7XG5cdFx0XG5cdH1cblx0aGlkZVNlbGYoKXtcblx0XHR0aGlzLmFycm93SW1hZ2Uuc3R5bGUub3BhY2l0eSA9IDA7XG5cdFx0dGhpcy5hcnJvd0ltYWdlLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cdH1cblx0c3RhdGljIGFzeW5jIGxvYWRJbWFnZSgpe1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShcblx0XHRcdChmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0XHRpZih0aGlzLmFycm93SW1hZ2UgJiYgdGhpcy5hcnJvd0ltYWdlLndpZHRoICE9IDApe1xuXHRcdFx0XHRcdHJldHVybiByZXNvbHZlKCk7IC8vcXVpdCBlYXJseVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuYXJyb3dJbWFnZSA9IG5ldyBJbWFnZSgpO1xuXHRcdFx0XHRcblx0XHRcdFx0dGhpcy5hcnJvd0ltYWdlLnNyYyA9IFxudGhpcy5hcnJvd0ltYWdlLmJhc2VVUkkuc3Vic3RyaW5nKDAsdGhpcy5hcnJvd0ltYWdlLmJhc2VVUkkuc2VhcmNoKFwiZXhwbGFuYXJpYVwiKSkgKyBcImV4cGxhbmFyaWEvc3JjL0V4cGxhbmFyaWFuTmV4dEFycm93LnN2Z1wiO1xuXHRcdFx0XHR0aGlzLmFycm93SW1hZ2UuY2xhc3NOYW1lID0gXCJleHAtYXJyb3dcIjtcblx0XHRcdH0pLmJpbmQodGhpcykpO1xuXHR9XG59XG5EaXJlY3Rpb25BcnJvdy5sb2FkSW1hZ2UoKTsgLy8gcHJlbG9hZFxuXG5cbmNsYXNzIE5vbkRlY3JlYXNpbmdEaXJlY3Rvcntcblx0Ly8gSSB3YW50IERpcmVjdG9yKCkgdG8gYmUgYWJsZSB0byBiYWNrdHJhY2sgYnkgcHJlc3NpbmcgYmFja3dhcmRzLiBUaGlzIGRvZXNuJ3QgZG8gdGhhdC5cblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0dGhpcy51bmRvU3RhY2sgPSBbXTtcblx0XHR0aGlzLnVuZG9TdGFja0luZGV4ID0gMDtcblxuXHRcdHRoaXMuc2xpZGVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZVwiKTtcblx0XHR0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID0gMDtcblxuXHRcdHRoaXMubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gbnVsbDtcblx0fVxuXG5cblx0YXN5bmMgYmVnaW4oKXtcblx0XHRhd2FpdCB0aGlzLndhaXRGb3JQYWdlTG9hZCgpO1xuXG5cdFx0dGhpcy5yaWdodEFycm93ID0gbmV3IERpcmVjdGlvbkFycm93KCk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLnJpZ2h0QXJyb3cuYXJyb3dJbWFnZSk7XG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xuXHRcdHRoaXMucmlnaHRBcnJvdy5vbmNsaWNrQ2FsbGJhY2sgPSBmdW5jdGlvbigpe1xuXHRcdFx0c2VsZi5fY2hhbmdlU2xpZGUoMSwgZnVuY3Rpb24oKXt9KTsgLy8gdGhpcyBlcnJvcnMgd2l0aG91dCB0aGUgZW1wdHkgZnVuY3Rpb24gYmVjYXVzZSB0aGVyZSdzIG5vIHJlc29sdmUuIFRoZXJlIG11c3QgYmUgYSBiZXR0ZXIgd2F5IHRvIGRvIHRoaW5ncy5cblx0XHRcdGNvbnNvbGUud2FybihcIldBUk5JTkc6IEhvcnJpYmxlIGhhY2sgaW4gZWZmZWN0IHRvIGNoYW5nZSBzbGlkZXMuIFBsZWFzZSByZXBsYWNlIHRoZSBwYXNzLWFuLWVtcHR5LWZ1bmN0aW9uIHRoaW5nIHdpdGggc29tZXRoaWduIHRoYXQgYWN0dWFsbHkgcmVzb2x2ZXMgcHJvcGVybHkgYW5kIGRvZXMgYXN5bmMuXCIpXG5cdFx0XHRzZWxmLm5leHRTbGlkZVJlc29sdmVGdW5jdGlvbigpO1xuXHRcdH1cblxuXHR9XG5cblx0YXN5bmMgd2FpdEZvclBhZ2VMb2FkKCl7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIixyZXNvbHZlKTtcblx0XHR9KTtcblx0fVxuXG5cdHNob3dTbGlkZShzbGlkZU51bWJlcil7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnNsaWRlcy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuc2xpZGVzW2ldLnN0eWxlLm9wYWNpdHkgPSAwO1xuXHRcdH1cblx0XHR0aGlzLnNsaWRlc1tzbGlkZU51bWJlcl0uc3R5bGUub3BhY2l0eSA9IDE7XG5cdH1cblxuXHRhc3luYyBuZXh0U2xpZGUoKXtcblx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cblx0XHR0aGlzLnJpZ2h0QXJyb3cuc2hvd1NlbGYoKTtcblx0XHQvL3Byb21pc2UgaXMgcmVzb2x2ZWQgYnkgY2FsbGluZyB0aGlzLm5leHRTbGlkZVByb21pc2UucmVzb2x2ZSgpIHdoZW4gdGhlIHRpbWUgY29tZXNcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0ZnVuY3Rpb24ga2V5TGlzdGVuZXIoZSl7XG5cdFx0XHRcdGlmKGUucmVwZWF0KXJldHVybjsgLy9rZXlkb3duIGZpcmVzIG11bHRpcGxlIHRpbWVzIGJ1dCB3ZSBvbmx5IHdhbnQgdGhlIGZpcnN0IG9uZVxuXHRcdFx0XHRsZXQgc2xpZGVEZWx0YSA9IDA7XG5cdFx0XHRcdHN3aXRjaCAoZS5rZXlDb2RlKSB7XG5cdFx0XHRcdCAgY2FzZSAzNDpcblx0XHRcdFx0ICBjYXNlIDM5OlxuXHRcdFx0XHQgIGNhc2UgNDA6XG5cdFx0XHRcdFx0c2xpZGVEZWx0YSA9IDE7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdCAgZGVmYXVsdDpcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZihzbGlkZURlbHRhICE9IDApe1xuXHRcdFx0XHRcdHNlbGYuX2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpO1xuXHRcdFx0XHRcdHNlbGYucmlnaHRBcnJvdy5oaWRlU2VsZigpO1xuXHRcdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLGtleUxpc3RlbmVyKTsgLy90aGlzIGFwcHJvYWNoIHRha2VuIGZyb20gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzU3MTg2NDUvcmVzb2x2aW5nLWEtcHJvbWlzZS13aXRoLWV2ZW50bGlzdGVuZXJcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwga2V5TGlzdGVuZXIpO1xuXHRcdFx0Ly9ob3JyaWJsZSBoYWNrIHNvIHRoYXQgdGhlICduZXh0IHNsaWRlJyBhcnJvdyBjYW4gdHJpZ2dlciB0aGlzIHRvb1xuXHRcdFx0c2VsZi5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBmdW5jdGlvbigpeyBcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIixrZXlMaXN0ZW5lcik7IFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdF9jaGFuZ2VTbGlkZShzbGlkZURlbHRhLCByZXNvbHZlKXtcblx0XHRcdC8vc2xpZGUgY2hhbmdpbmcgbG9naWNcblxuXG5cdFx0Ly9yaWdodCBub3cgdGhlcmUgaXMgYSBwcm9ibGVtLiBHb2luZyBiYWNrd2FyZHMgc2hvdWxkIG5vdCByZXNvbHZlIHRoZSBwcm9taXNlOyBvbmx5IGdvaW5nIHRvIHRoZSBtb3N0IHJlY2VudCBzbGlkZSBhbmQgcHJlc3NpbmcgcmlnaHQgc2hvdWxkLlxuXHRcdGlmKHNsaWRlRGVsdGEgIT0gMCl7XG5cdFx0XHRpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IDAgJiYgc2xpZGVEZWx0YSA9PSAtMSl7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gdGhpcy5zbGlkZXMubGVuZ3RoLTEgJiYgc2xpZGVEZWx0YSA9PSAxKXtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5jdXJyZW50U2xpZGVJbmRleCArPSBzbGlkZURlbHRhO1xuXHRcdFx0dGhpcy5zaG93U2xpZGUodGhpcy5jdXJyZW50U2xpZGVJbmRleCk7XG5cdFx0XHRyZXNvbHZlKCk7XG5cdFx0fVxuXHR9XG5cdC8vdmVyYnNcblx0YXN5bmMgZGVsYXkod2FpdFRpbWUpe1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHRcdH0pO1xuXHR9XG5cdHRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TKXtcblx0XHQvL0VYUC5VdGlscy5Bc3NlcnQodGhpcy51bmRvU3RhY2tJbmRleCA9PSAwKTsgLy9UaGlzIG1heSBub3Qgd29yayB3ZWxsLlxuXHRcdG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwKTtcblx0fVxufVxuLypcbmNsYXNzIERpcmVjdG9ye1xuXHQvL3RvZG8uIE1ha2UgdGhpcyBhYmxlIHRvIGJhY2t0cmFja1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHR0aGlzLnVuZG9TdGFjayA9IFtdO1xuXHRcdHRoaXMudW5kb1N0YWNrSW5kZXggPSAwO1xuXG5cdFx0dGhpcy5zbGlkZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXhwLXNsaWRlXCIpO1xuXHRcdHRoaXMuY3VycmVudFNsaWRlSW5kZXggPSAwO1xuXHRcdC8vdGhpcy5zaG93U2xpZGUoMCk7IC8vZmFpbHMgYmVjYXVzZSBET00gaXNuJ3QgbG9hZGVkLlxuXHR9XG5cblx0YXN5bmMgd2FpdEZvclBhZ2VMb2FkKCl7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIixyZXNvbHZlKTtcblx0XHR9KTtcblx0fVxuXG5cdHNob3dTbGlkZShzbGlkZU51bWJlcil7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnNsaWRlcy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuc2xpZGVzW2ldLnN0eWxlLm9wYWNpdHkgPSAwO1xuXHRcdH1cblx0XHR0aGlzLnNsaWRlc1tzbGlkZU51bWJlcl0uc3R5bGUub3BhY2l0eSA9IDE7XG5cdH1cblxuXHRuZXh0U2xpZGUoKXtcblx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleXByZXNzXCIsIGZ1bmN0aW9uIGtleUxpc3RlbmVyKGUpe1xuXHRcdFx0XHRsZXQgc2xpZGVEZWx0YSA9IDA7XG5cdFx0XHRcdHN3aXRjaCAoZS5rZXlDb2RlKSB7XG5cdFx0XHRcdCAgY2FzZSAzMzpcblx0XHRcdFx0ICBjYXNlIDM3OlxuXHRcdFx0XHQgIGNhc2UgMzg6XG5cdFx0XHRcdFx0c2xpZGVEZWx0YSA9IC0xO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHQgIGNhc2UgMzQ6XG5cdFx0XHRcdCAgY2FzZSAzOTpcblx0XHRcdFx0ICBjYXNlIDQwOlxuXHRcdFx0XHRcdHNsaWRlRGVsdGEgPSAxO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGYuX2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpO1xuXHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleXByZXNzXCIsa2V5TGlzdGVuZXIpOyAvL3RoaXMgYXBwcm9hY2ggdGFrZW4gZnJvbSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNTcxODY0NS9yZXNvbHZpbmctYS1wcm9taXNlLXdpdGgtZXZlbnRsaXN0ZW5lclxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblx0X2NoYW5nZVNsaWRlKHNsaWRlRGVsdGEsIHJlc29sdmUpe1xuXHRcdFx0Ly9zbGlkZSBjaGFuZ2luZyBsb2dpY1xuXHRcdGlmKHNsaWRlRGVsdGEgIT0gMCl7XG5cdFx0XHRpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IDAgJiYgc2xpZGVEZWx0YSA9PSAtMSl7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmKHRoaXMuY3VycmVudFNsaWRlSW5kZXggPT0gdGhpcy5zbGlkZXMubGVuZ3RoLTEgJiYgc2xpZGVEZWx0YSA9PSAxKXtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0XHRjb25zb2xlLmxvZyhzbGlkZURlbHRhLCB0aGlzLmN1cnJlbnRTbGlkZUluZGV4KTtcblx0XHRcdHRoaXMuY3VycmVudFNsaWRlSW5kZXggKz0gc2xpZGVEZWx0YTtcblx0XHRcdHRoaXMuc2hvd1NsaWRlKHRoaXMuY3VycmVudFNsaWRlSW5kZXgpO1xuXHRcdFx0cmVzb2x2ZSgpO1xuXHRcdH1cblx0fVxuXG5cdC8vdmVyYnNcblx0YXN5bmMgZGVsYXkod2FpdFRpbWUpe1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHRcdH0pO1xuXHR9XG5cdHRyYW5zaXRpb25Ubyh0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TKXtcblx0XHQvL0VYUC5VdGlscy5Bc3NlcnQodGhpcy51bmRvU3RhY2tJbmRleCA9PSAwKTsgLy9UaGlzIG1heSBub3Qgd29yayB3ZWxsLlxuXHRcdHZhciBhbmltYXRpb24gPSBuZXcgRVhQLkFuaW1hdGlvbih0YXJnZXQsIHRvVmFsdWVzLCBkdXJhdGlvbk1TID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkdXJhdGlvbk1TLzEwMDApO1xuXHRcdGxldCBmcm9tVmFsdWVzID0gYW5pbWF0aW9uLmZyb21WYWx1ZXM7XG5cdFx0dGhpcy51bmRvU3RhY2sucHVzaChuZXcgRVhQLkRpcmVjdG9yLlVuZG9JdGVtKHRhcmdldCwgdG9WYWx1ZXMsIGZyb21WYWx1ZXMsIGR1cmF0aW9uTVMpKTtcblx0XHR0aGlzLnVuZG9TdGFja0luZGV4Kys7XG5cdH1cbn1cblxuRVhQLkRpcmVjdG9yLlVuZG9JdGVtID0gY2xhc3MgVW5kb0l0ZW17XG5cdGNvbnN0cnVjdG9yKHRhcmdldCwgdG9WYWx1ZXMsIGZyb21WYWx1ZXMsIGR1cmF0aW9uTVMpe1xuXHRcdHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xuXHRcdHRoaXMudG9WYWx1ZXMgPSB0b1ZhbHVlcztcblx0XHR0aGlzLmZyb21WYWx1ZXMgPSBmcm9tVmFsdWVzO1xuXHRcdHRoaXMuZHVyYXRpb25NUyA9IGR1cmF0aW9uTVM7XG5cdH1cbn0qL1xuXG5leHBvcnQgeyBOb25EZWNyZWFzaW5nRGlyZWN0b3IsIERpcmVjdGlvbkFycm93IH07XG4iXSwibmFtZXMiOlsiTWF0aCIsIkFyZWEiLCJUcmFuc2Zvcm1hdGlvbiIsIm1hdGgubGVycFZlY3RvcnMiLCJyZXF1aXJlIiwicmVxdWlyZSQkMCIsInJlcXVpcmUkJDEiLCJyZXF1aXJlJCQyIiwiZ2xvYmFsIiwiZGVmaW5lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Q0FBQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBOztDQUVBLE1BQU0sSUFBSTtDQUNWLENBQUMsV0FBVyxFQUFFLEVBQUU7Q0FDaEIsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0NBQ1g7Q0FDQSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQzVCLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7Q0FDdEIsRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO0NBQ2pDLEVBQUUsT0FBTyxLQUFLLENBQUM7Q0FDZixFQUFFO0NBQ0YsQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNYLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztDQUNkLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7Q0FDN0MsRUFBRSxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUMsR0FBRztDQUN2QixHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0NBQ3ZCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDO0NBQ3BDLEdBQUc7Q0FDSCxFQUFFLE9BQU8sSUFBSSxDQUFDO0NBQ2QsRUFBRTtDQUNGLENBQUM7O0NBRUQsTUFBTSxVQUFVO0NBQ2hCLENBQUMsV0FBVyxFQUFFLEVBQUU7Q0FDaEIsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0NBQzlCLENBQUMsaUJBQWlCLEVBQUUsRUFBRTtDQUN0QixDQUFDLE1BQU0sRUFBRSxFQUFFO0NBQ1gsQ0FBQzs7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QUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3ZHLEtBQUssSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQzlDLEtBQUssSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDOUMsS0FBSztDQUNMLElBQUk7Q0FDSixHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsQ0FBQztDQUNuQztDQUNBLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDNUMsSUFBSSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdEcsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM3QyxLQUFLLElBQUksRUFB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RSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFDdEMsQ0FBQztFQUNILFNBQVMsS0FBSyxDQUFDLE1BQU0sRUFBRTtHQUN0QixJQUFJLENBQUMsRUFBRSxNQUFNLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7R0FDdkMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUMvQixNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2Q7R0FDRCxPQUFPLE1BQU0sQ0FBQztHQUNkOztFQUVELFNBQVMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRTtH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QUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPQSxlQUFPLEVBQUUsVUFBVSxFQUFFQSxlQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxTQUFTLFlBQVksRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFVBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLEdBQUcsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsWUFBWSxLQUFLLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLG9CQUFtQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsK0NBQStDLENBQUMscUNBQXFDLENBQUMsa0RBQWtELENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE9BQU8sT0FBTyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxTQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLDZCQUE2QixDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxRQUFRLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHLGdCQUFnQixDQUFDLFNBQVMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFDLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDLE1BQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLFNBQVMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsVUFBVSxDQUFDLFNBQVMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsUUFBUSxDQUFDLFNBQVMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxHQUFHLEdBQUcsUUFBUSxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxVQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxZQUFZLENBQUMsQ0FBQyxHQUFHLFlBQVksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFZLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixHQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsR0FBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFHLElBQUksRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBSyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssNEJBQTRCLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEFBQW1CLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBSyxDQUFDLENBQUMsT0FBTyxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxNQUFNLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFVLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLFdBQVcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksRUFBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLFNBQVMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsR0FBRyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLEVBQUUsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsTUFBTSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFDLENBQUMsVUFBVSxDQUFDLElBQUksRUFBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxFQUFFLENBQUMsQUFBd0IsSUFBSSxTQUFTLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxBQUFhLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLElBQUksY0FBYyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLFFBQVEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxRQUFRLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsU0FBUyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFTLENBQUMsU0FBUyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLFdBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxTQUFTLENBQUMsT0FBTyxXQUFXLENBQUMsU0FBUyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBUyxDQUFDLFNBQVMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxFQUFFLFdBQVcsQ0FBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxhQUFhLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxRQUFRLEdBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxTQUFTLFdBQVcsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyw2RkFBNkYsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxRQUFRLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBQyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsVUFBVSxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksR0FBRyxHQUFHLEdBQUcsT0FBTyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxJQUFJLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxJQUFJLGFBQWEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsYUFBYSxDQUFDLEdBQUcsRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsT0FBTyxTQUFTLEdBQUcsV0FBVyxFQUFFLFNBQVMsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyx3QkFBd0IsR0FBRyxXQUFXLEVBQUUsd0JBQXdCLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSx3QkFBd0IsRUFBRSxPQUFPLHFCQUFxQixHQUFHLFdBQVcsRUFBRSxxQkFBcUIsR0FBRyxJQUFJLEVBQUUsS0FBSyxZQUFZLHFCQUFxQixDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQUssQ0FBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBTSxVQUFVLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLFNBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBQyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLFlBQVksRUFBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEdBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxNQUFLLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGdCQUFnQixHQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMs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N0QsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQzs7Q0FFcEQsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztDQUNwQixDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDOztDQUV0QixDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDLGFBQWEsRUFBRSxLQUFLLEVBQUUsQ0FBQztDQUNsRCxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUM7O0NBRXhELENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDO0NBQzlGLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDO0NBQzFGLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDO0NBQy9GLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDOztDQUUzRixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7O0NBRTVFO0NB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Q0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMvQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzFDLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOztDQUU3QixFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDMUIsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzFCLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUMxQixFQUFFO0NBQ0YsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDVCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDM0IsRUFBRTtDQUNGLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ1QsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0NBQzNCLEVBQUU7Q0FDRixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNULEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUMzQixFQUFFO0NBQ0YsQ0FBQyxJQUFJLENBQUMsRUFBRTtDQUNSLEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Q0FDOUIsRUFBRTtDQUNGLENBQUMsSUFBSSxDQUFDLEVBQUU7Q0FDUixFQUFFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0NBQzlCLEVBQUU7Q0FD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
