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
	        		/*indices.push(d, b, a);
					indices.push(d, c, b);*/

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbGFuYXJpYS1idW5kbGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9qcy9Ob2RlLmpzIiwiLi4vc3JjL2pzL0FycmF5LmpzIiwiLi4vc3JjL2pzL21hdGguanMiLCIuLi9zcmMvanMvdXRpbHMuanMiLCIuLi9zcmMvanMvQXJlYS5qcyIsIi4uL3NyYy9qcy9UcmFuc2Zvcm1hdGlvbi5qcyIsIi4uL3NyYy9qcy9BbmltYXRpb24uanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL3Rhci5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvZG93bmxvYWQuanMiLCIuLi9ub2RlX21vZHVsZXMvY2NhcHR1cmUuanMvc3JjL2dpZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9jY2FwdHVyZS5qcy9zcmMvQ0NhcHR1cmUuanMiLCIuLi9zcmMvbGliL1dlYkdMX0RldGVjdG9yLmpzIiwiLi4vc3JjL2pzL3RocmVlX2Jvb3RzdHJhcC5qcyIsIi4uL3NyYy9qcy9hc3luY0RlbGF5RnVuY3Rpb25zLmpzIiwiLi4vc3JjL2pzL291dHB1dHMvTGluZU91dHB1dC5qcyIsIi4uL3NyYy9qcy9vdXRwdXRzL1BvaW50LmpzIiwiLi4vc3JjL2pzL291dHB1dHMvUG9pbnRPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9WZWN0b3JPdXRwdXQuanMiLCIuLi9zcmMvanMvb3V0cHV0cy9TdXJmYWNlT3V0cHV0LmpzIiwiLi4vc3JjL2pzL0RpcmVjdG9yLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIFRoZSBiYXNlIGNsYXNzIHRoYXQgZXZlcnl0aGluZyBpbmhlcml0cyBmcm9tLiBcblx0RWFjaCB0aGluZyBkcmF3biB0byB0aGUgc2NyZWVuIGlzIGEgdHJlZS4gRG9tYWlucywgc3VjaCBhcyBFWFAuQXJlYSBvciBFWFAuQXJyYXkgYXJlIHRoZSByb290IG5vZGVzLFxuXHRFWFAuVHJhbnNmb3JtYXRpb24gaXMgY3VycmVudGx5IHRoZSBvbmx5IGludGVybWVkaWF0ZSBub2RlLCBhbmQgdGhlIGxlYWYgbm9kZXMgYXJlIHNvbWUgZm9ybSBvZiBPdXRwdXQgc3VjaCBhc1xuXHRFWFAuTGluZU91dHB1dCBvciBFWFAuUG9pbnRPdXRwdXQsIG9yIEVYUC5WZWN0b3JPdXRwdXQuXG5cblx0QWxsIG9mIHRoZXNlIGNhbiBiZSAuYWRkKCllZCB0byBlYWNoIG90aGVyIHRvIGZvcm0gdGhhdCB0cmVlLCBhbmQgdGhpcyBmaWxlIGRlZmluZXMgaG93IGl0IHdvcmtzLlxuKi9cblxuY2xhc3MgTm9kZXtcblx0Y29uc3RydWN0b3IoKXt9XG5cdGFkZCh0aGluZyl7XG5cdFx0Ly9jaGFpbmFibGUgc28geW91IGNhbiBhLmFkZChiKS5hZGQoYykgdG8gbWFrZSBhLT5iLT5jXG5cdFx0dGhpcy5jaGlsZHJlbi5wdXNoKHRoaW5nKTtcblx0XHR0aGluZy5wYXJlbnQgPSB0aGlzO1xuXHRcdGlmKHRoaW5nLl9vbkFkZCl0aGluZy5fb25BZGQoKTtcblx0XHRyZXR1cm4gdGhpbmc7XG5cdH1cblx0X29uQWRkKCl7fVxuXHRyZW1vdmUodGhpbmcpe1xuXHRcdHZhciBpbmRleCA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZiggdGhpbmcgKTtcblx0XHRpZiAoIGluZGV4ICE9PSAtIDEgKSB7XG5cdFx0XHR0aGluZy5wYXJlbnQgPSBudWxsO1xuXHRcdFx0dGhpcy5jaGlsZHJlbi5zcGxpY2UoIGluZGV4LCAxICk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG59XG5cbmNsYXNzIE91dHB1dE5vZGV7IC8vbW9yZSBvZiBhIGphdmEgaW50ZXJmYWNlLCByZWFsbHlcblx0Y29uc3RydWN0b3IoKXt9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXt9XG5cdG9uQWZ0ZXJBY3RpdmF0aW9uKCl7fVxuXHRfb25BZGQoKXt9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGU7XG5leHBvcnQge091dHB1dE5vZGV9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCBOb2RlIGZyb20gJy4vTm9kZS5qcyc7XG5cbmNsYXNzIEVYUEFycmF5IGV4dGVuZHMgTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKnZhciBwb2ludHMgPSBuZXcgRVhQLkFycmF5KHtcblx0XHRkYXRhOiBbWy0xMCwxMF0sXG5cdFx0XHRbMTAsMTBdXVxuXHRcdH0pKi9cblxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZGF0YVwiKTsgLy8gYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LiBhc3N1bWVkIHRvIG9ubHkgY29udGFpbiBvbmUgdHlwZTogZWl0aGVyIG51bWJlcnMgb3IgYXJyYXlzXG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5kYXRhLCBBcnJheSk7XG5cblx0XHQvL0l0J3MgYXNzdW1lZCBhbiBFWFAuQXJyYXkgd2lsbCBvbmx5IHN0b3JlIHRoaW5ncyBzdWNoIGFzIDAsIFswXSwgWzAsMF0gb3IgWzAsMCwwXS4gSWYgYW4gYXJyYXkgdHlwZSBpcyBzdG9yZWQsIHRoaXMuYXJyYXlUeXBlRGltZW5zaW9ucyBjb250YWlucyB0aGUgLmxlbmd0aCBvZiB0aGF0IGFycmF5LiBPdGhlcndpc2UgaXQncyAwLCBiZWNhdXNlIHBvaW50cyBhcmUgMC1kaW1lbnNpb25hbC5cblx0XHRpZihvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IgPT09IE51bWJlcil7XG5cdFx0XHR0aGlzLmFycmF5VHlwZURpbWVuc2lvbnMgPSAwO1xuXHRcdH1lbHNlIGlmKG9wdGlvbnMuZGF0YVswXS5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpe1xuXHRcdFx0dGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID0gb3B0aW9ucy5kYXRhWzBdLmxlbmd0aDtcblx0XHR9ZWxzZXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJEYXRhIGluIGFuIEVYUC5BcnJheSBzaG91bGQgYmUgYSBudW1iZXIgb3IgYW4gYXJyYXkgb2Ygb3RoZXIgdGhpbmdzLCBub3QgXCIgKyBvcHRpb25zLmRhdGFbMF0uY29uc3RydWN0b3IpO1xuXHRcdH1cblxuXG5cdFx0RVhQLlV0aWxzLmFzc2VydChvcHRpb25zLmRhdGFbMF0ubGVuZ3RoICE9IDApOyAvL2Rvbid0IGFjY2VwdCBbW11dLCBkYXRhIG5lZWRzIHRvIGJlIHNvbWV0aGluZyBsaWtlIFtbMSwyXV0uXG5cblx0XHR0aGlzLmRhdGEgPSBvcHRpb25zLmRhdGE7XG5cblx0XHR0aGlzLm51bUl0ZW1zID0gdGhpcy5kYXRhLmxlbmd0aDtcblxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbdGhpcy5kYXRhLmxlbmd0aF07IC8vIGFycmF5IHRvIHN0b3JlIHRoZSBudW1iZXIgb2YgdGltZXMgdGhpcyBpcyBjYWxsZWQgcGVyIGRpbWVuc2lvbi5cblxuXHRcdC8vdGhlIG51bWJlciBvZiB0aW1lcyBldmVyeSBjaGlsZCdzIGV4cHIgaXMgY2FsbGVkXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSB0aGlzLml0ZW1EaW1lbnNpb25zLnJlZHVjZSgoc3VtLHkpPT5zdW0qeSlcblxuXHRcdHRoaXMuY2hpbGRyZW4gPSBbXTtcblx0XHR0aGlzLnBhcmVudCA9IG51bGw7XG5cdH1cblx0YWN0aXZhdGUodCl7XG5cdFx0aWYodGhpcy5hcnJheVR5cGVEaW1lbnNpb25zID09IDApe1xuXHRcdFx0Ly9udW1iZXJzIGNhbid0IGJlIHNwcmVhZCB1c2luZyAuLi4gb3BlcmF0b3Jcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5kYXRhLmxlbmd0aDtpKyspe1xuXHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaSx0LHRoaXMuZGF0YVtpXSk7XG5cdFx0XHR9XG5cdFx0fWVsc2V7XG5cdFx0XHRmb3IodmFyIGk9MDtpPHRoaXMuZGF0YS5sZW5ndGg7aSsrKXtcblx0XHRcdFx0dGhpcy5fY2FsbEFsbENoaWxkcmVuKGksdCwuLi50aGlzLmRhdGFbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMub25BZnRlckFjdGl2YXRpb24oKTsgLy8gY2FsbCBjaGlsZHJlbiBpZiBuZWNlc3Nhcnlcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblxuXHRcdC8vYnV0IGNhbGwgYWxsIGNoaWxkcmVuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5vbkFmdGVyQWN0aXZhdGlvbigpXG5cdFx0fVxuXHR9XG5cdF9jYWxsQWxsQ2hpbGRyZW4oLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBFWFAuQXJyYXkoe2RhdGE6IEVYUC5VdGlscy5hcnJheUNvcHkodGhpcy5kYXRhKX0pO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdGNsb25lLmFkZCh0aGlzLmNoaWxkcmVuW2ldLmNsb25lKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY2xvbmU7XG5cdH1cbn1cblxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdEFycmF5KCl7XG5cdHZhciB4ID0gbmV3IEVYUC5BcnJheSh7ZGF0YTogW1swLDFdLFswLDFdXX0pO1xuXHR2YXIgeSA9IG5ldyBFWFAuVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpOyByZXR1cm4gWzJdfX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSg1MTIpO1xufVxuXG5leHBvcnQge0VYUEFycmF5IGFzIEFycmF5fTtcbiIsImZ1bmN0aW9uIG11bHRpcGx5U2NhbGFyKGMsIGFycmF5KXtcblx0Zm9yKHZhciBpPTA7aTxhcnJheS5sZW5ndGg7aSsrKXtcblx0XHRhcnJheVtpXSAqPSBjO1xuXHR9XG5cdHJldHVybiBhcnJheVxufVxuZnVuY3Rpb24gdmVjdG9yQWRkKHYxLHYyKXtcblx0Zm9yKHZhciBpPTA7aTx2MS5sZW5ndGg7aSsrKXtcblx0XHR2MVtpXSArPSB2MltpXTtcblx0fVxuXHRyZXR1cm4gdjFcbn1cbmZ1bmN0aW9uIGxlcnBWZWN0b3JzKHQsIHAxLCBwMil7XG5cdC8vYXNzdW1lZCB0IGluIFswLDFdXG5cdHJldHVybiB2ZWN0b3JBZGQobXVsdGlwbHlTY2FsYXIodCxwMSksbXVsdGlwbHlTY2FsYXIoMS10LHAyKSk7XG59XG5mdW5jdGlvbiBjbG9uZSh2ZWMpe1xuXHR2YXIgbmV3QXJyID0gbmV3IEFycmF5KHZlYy5sZW5ndGgpO1xuXHRmb3IodmFyIGk9MDtpPHZlYy5sZW5ndGg7aSsrKXtcblx0XHRuZXdBcnJbaV0gPSB2ZWNbaV07XG5cdH1cblx0cmV0dXJuIG5ld0FyclxufVxuXG4vL2hhY2tcbmxldCBNYXRoID0ge2Nsb25lOiBjbG9uZSwgbGVycFZlY3RvcnM6IGxlcnBWZWN0b3JzLCB2ZWN0b3JBZGQ6IHZlY3RvckFkZCwgbXVsdGlwbHlTY2FsYXI6IG11bHRpcGx5U2NhbGFyfTtcblxuZXhwb3J0IHt2ZWN0b3JBZGQsIGxlcnBWZWN0b3JzLCBjbG9uZSwgbXVsdGlwbHlTY2FsYXIsIE1hdGh9O1xuIiwiaW1wb3J0IHtjbG9uZX0gZnJvbSAnLi9tYXRoLmpzJ1xuXG5jbGFzcyBVdGlsc3tcblxuXHRzdGF0aWMgaXNBcnJheSh4KXtcblx0XHRyZXR1cm4geC5jb25zdHJ1Y3RvciA9PT0gQXJyYXk7XG5cdH1cblx0c3RhdGljIGFycmF5Q29weSh4KXtcblx0XHRyZXR1cm4geC5zbGljZSgpO1xuXHR9XG5cdHN0YXRpYyBpc0Z1bmN0aW9uKHgpe1xuXHRcdHJldHVybiB4LmNvbnN0cnVjdG9yID09PSBGdW5jdGlvbjtcblx0fVxuXG5cdHN0YXRpYyBhc3NlcnQodGhpbmcpe1xuXHRcdC8vQSBmdW5jdGlvbiB0byBjaGVjayBpZiBzb21ldGhpbmcgaXMgdHJ1ZSBhbmQgaGFsdCBvdGhlcndpc2UgaW4gYSBjYWxsYmFja2FibGUgd2F5LlxuXHRcdGlmKCF0aGluZyl7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIEFzc2VydGlvbiBmYWlsZWQuIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdH1cblx0fVxuXG5cdHN0YXRpYyBhc3NlcnRUeXBlKHRoaW5nLCB0eXBlLCBlcnJvck1zZyl7XG5cdFx0Ly9BIGZ1bmN0aW9uIHRvIGNoZWNrIGlmIHNvbWV0aGluZyBpcyB0cnVlIGFuZCBoYWx0IG90aGVyd2lzZSBpbiBhIGNhbGxiYWNrYWJsZSB3YXkuXG5cdFx0aWYoISh0aGluZy5jb25zdHJ1Y3RvciA9PT0gdHlwZSkpe1xuXHRcdFx0aWYoZXJyb3JNc2cpe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFNvbWV0aGluZyBub3Qgb2YgcmVxdWlyZWQgdHlwZSBcIit0eXBlLm5hbWUrXCIhIFxcblwiK2Vycm9yTXNnK1wiXFxuIFNlZSB0cmFjZWJhY2sgZm9yIG1vcmUuXCIpO1xuXHRcdFx0fWVsc2V7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJFUlJPUiEgU29tZXRoaW5nIG5vdCBvZiByZXF1aXJlZCB0eXBlIFwiK3R5cGUubmFtZStcIiEgU2VlIHRyYWNlYmFjayBmb3IgbW9yZS5cIik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblxuXHRzdGF0aWMgYXNzZXJ0UHJvcEV4aXN0cyh0aGluZywgbmFtZSl7XG5cdFx0aWYoIShuYW1lIGluIHRoaW5nKSl7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiRVJST1IhIFwiK25hbWUrXCIgbm90IHByZXNlbnQgaW4gcmVxdWlyZWQgcHJvcGVydHlcIilcblx0XHR9XG5cdH1cblx0XG5cdHN0YXRpYyBjbG9uZSh2ZWMpe1xuXHRcdHJldHVybiBjbG9uZSh2ZWMpO1xuXHR9XG59XG5cbmV4cG9ydCB7VXRpbHN9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7IFV0aWxzIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgTm9kZSBmcm9tICcuL05vZGUuanMnO1xuXG5jbGFzcyBBcmVhIGV4dGVuZHMgTm9kZXtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8qdmFyIGF4ZXMgPSBuZXcgRVhQLkFyZWEoe1xuXHRcdGJvdW5kczogW1stMTAsMTBdLFxuXHRcdFx0WzEwLDEwXV1cblx0XHRudW1JdGVtczogMTA7IC8vb3B0aW9uYWwuIEFsdGVybmF0ZWx5IG51bUl0ZW1zIGNhbiB2YXJ5IGZvciBlYWNoIGF4aXM6IG51bUl0ZW1zOiBbMTAsMl1cblx0XHR9KSovXG5cblxuXHRcblx0XHRVdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiYm91bmRzXCIpOyAvLyBhIG11bHRpZGltZW5zaW9uYWwgYXJyYXlcblx0XHRVdGlscy5hc3NlcnRUeXBlKG9wdGlvbnMuYm91bmRzLCBBcnJheSk7XG5cdFx0VXRpbHMuYXNzZXJ0VHlwZShvcHRpb25zLmJvdW5kc1swXSwgQXJyYXksIFwiRm9yIGFuIEFyZWEsIG9wdGlvbnMuYm91bmRzIG11c3QgYmUgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5LCBldmVuIGZvciBvbmUgZGltZW5zaW9uIVwiKTsgLy8gaXQgTVVTVCBiZSBtdWx0aWRpbWVuc2lvbmFsXG5cdFx0dGhpcy5udW1EaW1lbnNpb25zID0gb3B0aW9ucy5ib3VuZHMubGVuZ3RoO1xuXG5cdFx0VXRpbHMuYXNzZXJ0KG9wdGlvbnMuYm91bmRzWzBdLmxlbmd0aCAhPSAwKTsgLy9kb24ndCBhY2NlcHQgW1tdXSwgaXQgbmVlZHMgdG8gYmUgW1sxLDJdXS5cblxuXHRcdHRoaXMuYm91bmRzID0gb3B0aW9ucy5ib3VuZHM7XG5cblx0XHR0aGlzLm51bUl0ZW1zID0gb3B0aW9ucy5udW1JdGVtcyB8fCAxNjtcblxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbXTsgLy8gYXJyYXkgdG8gc3RvcmUgdGhlIG51bWJlciBvZiB0aW1lcyB0aGlzIGlzIGNhbGxlZCBwZXIgZGltZW5zaW9uLlxuXG5cdFx0aWYodGhpcy5udW1JdGVtcy5jb25zdHJ1Y3RvciA9PT0gTnVtYmVyKXtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1EaW1lbnNpb25zO2krKyl7XG5cdFx0XHRcdHRoaXMuaXRlbURpbWVuc2lvbnMucHVzaCh0aGlzLm51bUl0ZW1zKTtcblx0XHRcdH1cblx0XHR9ZWxzZSBpZih0aGlzLm51bUl0ZW1zLmNvbnN0cnVjdG9yID09PSBBcnJheSl7XG5cdFx0XHRVdGlscy5hc3NlcnQob3B0aW9ucy5udW1JdGVtcy5sZW5ndGggPT0gb3B0aW9ucy5ib3VuZHMubGVuZ3RoKTtcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1EaW1lbnNpb25zO2krKyl7XG5cdFx0XHRcdHRoaXMuaXRlbURpbWVuc2lvbnMucHVzaCh0aGlzLm51bUl0ZW1zW2ldKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL3RoZSBudW1iZXIgb2YgdGltZXMgZXZlcnkgY2hpbGQncyBleHByIGlzIGNhbGxlZFxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gdGhpcy5pdGVtRGltZW5zaW9ucy5yZWR1Y2UoKHN1bSx5KT0+c3VtKnkpXG5cblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsO1xuXHR9XG5cdGFjdGl2YXRlKHQpe1xuXHRcdC8vVXNlIHRoaXMgdG8gZXZhbHVhdGUgZXhwcigpIGFuZCB1cGRhdGUgdGhlIHJlc3VsdCwgY2FzY2FkZS1zdHlsZS5cblx0XHQvL3RoZSBudW1iZXIgb2YgYm91bmRzIHRoaXMgb2JqZWN0IGhhcyB3aWxsIGJlIHRoZSBudW1iZXIgb2YgZGltZW5zaW9ucy5cblx0XHQvL3RoZSBleHByKClzIGFyZSBjYWxsZWQgd2l0aCBleHByKGksIC4uLltjb29yZGluYXRlc10sIHQpLCBcblx0XHQvL1x0KHdoZXJlIGkgaXMgdGhlIGluZGV4IG9mIHRoZSBjdXJyZW50IGV2YWx1YXRpb24gPSB0aW1lcyBleHByKCkgaGFzIGJlZW4gY2FsbGVkIHRoaXMgZnJhbWUsIHQgPSBhYnNvbHV0ZSB0aW1lc3RlcCAocykpLlxuXHRcdC8vcGxlYXNlIGNhbGwgd2l0aCBhIHQgdmFsdWUgb2J0YWluZWQgZnJvbSBwZXJmb3JtYW5jZS5ub3coKS8xMDAwIG9yIHNvbWV0aGluZyBsaWtlIHRoYXRcblxuXHRcdC8vbm90ZSB0aGUgbGVzcy10aGFuLW9yLWVxdWFsLXRvIGluIHRoZXNlIGxvb3BzXG5cdFx0aWYodGhpcy5udW1EaW1lbnNpb25zID09IDEpe1xuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2krKyl7XG5cdFx0XHRcdGxldCBjMSA9IHRoaXMuYm91bmRzWzBdWzBdICsgKHRoaXMuYm91bmRzWzBdWzFdLXRoaXMuYm91bmRzWzBdWzBdKSooaS8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKSk7XG5cdFx0XHRcdGxldCBpbmRleCA9IGk7XG5cdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpbmRleCx0LGMxLDAsMCwwKTtcblx0XHRcdH1cblx0XHR9ZWxzZSBpZih0aGlzLm51bURpbWVuc2lvbnMgPT0gMil7XG5cdFx0XHQvL3RoaXMgY2FuIGJlIHJlZHVjZWQgaW50byBhIGZhbmN5IHJlY3Vyc2lvbiB0ZWNobmlxdWUgb3ZlciB0aGUgZmlyc3QgaW5kZXggb2YgdGhpcy5ib3VuZHMsIEkga25vdyBpdFxuXHRcdFx0Zm9yKHZhciBpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzBdO2krKyl7XG5cdFx0XHRcdGxldCBjMSA9IHRoaXMuYm91bmRzWzBdWzBdICsgKHRoaXMuYm91bmRzWzBdWzFdLXRoaXMuYm91bmRzWzBdWzBdKSooaS8odGhpcy5pdGVtRGltZW5zaW9uc1swXS0xKSk7XG5cdFx0XHRcdGZvcih2YXIgaj0wO2o8dGhpcy5pdGVtRGltZW5zaW9uc1sxXTtqKyspe1xuXHRcdFx0XHRcdGxldCBjMiA9IHRoaXMuYm91bmRzWzFdWzBdICsgKHRoaXMuYm91bmRzWzFdWzFdLXRoaXMuYm91bmRzWzFdWzBdKSooai8odGhpcy5pdGVtRGltZW5zaW9uc1sxXS0xKSk7XG5cdFx0XHRcdFx0bGV0IGluZGV4ID0gaSp0aGlzLml0ZW1EaW1lbnNpb25zWzFdICsgajtcblx0XHRcdFx0XHR0aGlzLl9jYWxsQWxsQ2hpbGRyZW4oaW5kZXgsdCxjMSxjMiwwLDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fWVsc2UgaWYodGhpcy5udW1EaW1lbnNpb25zID09IDMpe1xuXHRcdFx0Ly90aGlzIGNhbiBiZSByZWR1Y2VkIGludG8gYSBmYW5jeSByZWN1cnNpb24gdGVjaG5pcXVlIG92ZXIgdGhlIGZpcnN0IGluZGV4IG9mIHRoaXMuYm91bmRzLCBJIGtub3cgaXRcblx0XHRcdGZvcih2YXIgaT0wO2k8dGhpcy5pdGVtRGltZW5zaW9uc1swXTtpKyspe1xuXHRcdFx0XHRsZXQgYzEgPSB0aGlzLmJvdW5kc1swXVswXSArICh0aGlzLmJvdW5kc1swXVsxXS10aGlzLmJvdW5kc1swXVswXSkqKGkvKHRoaXMuaXRlbURpbWVuc2lvbnNbMF0tMSkpO1xuXHRcdFx0XHRmb3IodmFyIGo9MDtqPHRoaXMuaXRlbURpbWVuc2lvbnNbMV07aisrKXtcblx0XHRcdFx0XHRsZXQgYzIgPSB0aGlzLmJvdW5kc1sxXVswXSArICh0aGlzLmJvdW5kc1sxXVsxXS10aGlzLmJvdW5kc1sxXVswXSkqKGovKHRoaXMuaXRlbURpbWVuc2lvbnNbMV0tMSkpO1xuXHRcdFx0XHRcdGZvcih2YXIgaz0wO2s8dGhpcy5pdGVtRGltZW5zaW9uc1syXTtrKyspe1xuXHRcdFx0XHRcdFx0bGV0IGMzID0gdGhpcy5ib3VuZHNbMl1bMF0gKyAodGhpcy5ib3VuZHNbMl1bMV0tdGhpcy5ib3VuZHNbMl1bMF0pKihrLyh0aGlzLml0ZW1EaW1lbnNpb25zWzJdLTEpKTtcblx0XHRcdFx0XHRcdGxldCBpbmRleCA9IChpKnRoaXMuaXRlbURpbWVuc2lvbnNbMV0gKyBqKSp0aGlzLml0ZW1EaW1lbnNpb25zWzJdICsgaztcblx0XHRcdFx0XHRcdHRoaXMuX2NhbGxBbGxDaGlsZHJlbihpbmRleCx0LGMxLGMyLGMzLDApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1lbHNle1xuXHRcdFx0YXNzZXJ0KFwiVE9ETzogVXNlIGEgZmFuY3kgcmVjdXJzaW9uIHRlY2huaXF1ZSB0byBsb29wIG92ZXIgYWxsIGluZGljZXMhXCIpO1xuXHRcdH1cblxuXHRcdHRoaXMub25BZnRlckFjdGl2YXRpb24oKTsgLy8gY2FsbCBjaGlsZHJlbiBpZiBuZWNlc3Nhcnlcblx0fVxuXHRvbkFmdGVyQWN0aXZhdGlvbigpe1xuXHRcdC8vIGRvIG5vdGhpbmdcblxuXHRcdC8vYnV0IGNhbGwgYWxsIGNoaWxkcmVuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5jaGlsZHJlbltpXS5vbkFmdGVyQWN0aXZhdGlvbigpXG5cdFx0fVxuXHR9XG5cdF9jYWxsQWxsQ2hpbGRyZW4oLi4uY29vcmRpbmF0ZXMpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKC4uLmNvb3JkaW5hdGVzKVxuXHRcdH1cblx0fVxuXHRjbG9uZSgpe1xuXHRcdGxldCBjbG9uZSA9IG5ldyBBcmVhKHtib3VuZHM6IFV0aWxzLmFycmF5Q29weSh0aGlzLmJvdW5kcyksIG51bUl0ZW1zOiB0aGlzLm51bUl0ZW1zfSk7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmNoaWxkcmVuLmxlbmd0aDtpKyspe1xuXHRcdFx0Y2xvbmUuYWRkKHRoaXMuY2hpbGRyZW5baV0uY2xvbmUoKSk7XG5cdFx0XHRpZihjbG9uZS5jaGlsZHJlbltpXS5fb25BZGQpY2xvbmUuY2hpbGRyZW5baV0uX29uQWRkKCk7IC8vIG5lY2Vzc2FyeSBub3cgdGhhdCB0aGUgY2hhaW4gb2YgYWRkaW5nIGhhcyBiZWVuIGVzdGFibGlzaGVkXG5cdFx0fVxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxufVxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0QXJlYSgpe1xuXHR2YXIgeCA9IG5ldyBBcmVhKHtib3VuZHM6IFtbMCwxXSxbMCwxXV19KTtcblx0dmFyIHkgPSBuZXcgVHJhbnNmb3JtYXRpb24oe2V4cHI6IGZ1bmN0aW9uKC4uLmEpe2NvbnNvbGUubG9nKC4uLmEpfX0pO1xuXHR4LmFkZCh5KTtcblx0eC5hY3RpdmF0ZSgpO1xufVxuXG5leHBvcnQgeyBBcmVhIH1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG5pbXBvcnQgTm9kZSBmcm9tICcuL05vZGUuanMnO1xuXG4vL1VzYWdlOiB2YXIgeSA9IG5ldyBUcmFuc2Zvcm1hdGlvbih7ZXhwcjogZnVuY3Rpb24oLi4uYSl7Y29uc29sZS5sb2coLi4uYSl9fSk7XG5jbGFzcyBUcmFuc2Zvcm1hdGlvbiBleHRlbmRzIE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpe1xuXHRcdHN1cGVyKCk7XG5cdFxuXHRcdEVYUC5VdGlscy5hc3NlcnRQcm9wRXhpc3RzKG9wdGlvbnMsIFwiZXhwclwiKTsgLy8gYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBtdWx0aWRpbWVuc2lvbmFsIGFycmF5XG5cdFx0RVhQLlV0aWxzLmFzc2VydFR5cGUob3B0aW9ucy5leHByLCBGdW5jdGlvbik7XG5cblx0XHR0aGlzLmV4cHIgPSBvcHRpb25zLmV4cHI7XG5cblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5wYXJlbnQgPSBudWxsO1xuXHR9XG5cdGV2YWx1YXRlU2VsZiguLi5jb29yZGluYXRlcyl7XG5cdFx0Ly9ldmFsdWF0ZSB0aGlzIFRyYW5zZm9ybWF0aW9uJ3MgX2V4cHIsIGFuZCBicm9hZGNhc3QgdGhlIHJlc3VsdCB0byBhbGwgY2hpbGRyZW4uXG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMuZXhwciguLi5jb29yZGluYXRlcyk7XG5cdFx0aWYocmVzdWx0LmNvbnN0cnVjdG9yICE9PSBBcnJheSlyZXN1bHQgPSBbcmVzdWx0XTtcblxuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5jaGlsZHJlbi5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuY2hpbGRyZW5baV0uZXZhbHVhdGVTZWxmKGNvb3JkaW5hdGVzWzBdLGNvb3JkaW5hdGVzWzFdLCAuLi5yZXN1bHQpXG5cdFx0fVxuXHR9XG5cdG9uQWZ0ZXJBY3RpdmF0aW9uKCl7XG5cdFx0Ly8gZG8gbm90aGluZ1xuXG5cdFx0Ly9idXQgY2FsbCBhbGwgY2hpbGRyZW5cblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLmNoaWxkcmVuW2ldLm9uQWZ0ZXJBY3RpdmF0aW9uKClcblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRsZXQgdGhpc0V4cHIgPSB0aGlzLmV4cHI7XG5cdFx0bGV0IGNsb25lID0gbmV3IFRyYW5zZm9ybWF0aW9uKHtleHByOiB0aGlzRXhwci5iaW5kKCl9KTtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMuY2hpbGRyZW4ubGVuZ3RoO2krKyl7XG5cdFx0XHRjbG9uZS5hZGQodGhpcy5jaGlsZHJlbltpXS5jbG9uZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNsb25lO1xuXHR9XG59XG5cblxuXG5cbi8vdGVzdGluZyBjb2RlXG5mdW5jdGlvbiB0ZXN0VHJhbnNmb3JtYXRpb24oKXtcblx0dmFyIHggPSBuZXcgQXJlYSh7Ym91bmRzOiBbWy0xMCwxMF1dfSk7XG5cdHZhciB5ID0gbmV3IFRyYW5zZm9ybWF0aW9uKHsnZXhwcic6ICh4KSA9PiBjb25zb2xlLmxvZyh4KngpfSk7XG5cdHguYWRkKHkpO1xuXHR4LmFjdGl2YXRlKCk7IC8vIHNob3VsZCByZXR1cm4gMTAwLCA4MSwgNjQuLi4gMCwgMSwgNC4uLiAxMDBcbn1cblxuZXhwb3J0IHsgVHJhbnNmb3JtYXRpb24gfVxuIiwiaW1wb3J0IHsgVXRpbHMgfSBmcm9tICcuL3V0aWxzLmpzJztcblxuaW1wb3J0IHsgVHJhbnNmb3JtYXRpb24gfSBmcm9tICcuL1RyYW5zZm9ybWF0aW9uLmpzJztcblxuaW1wb3J0ICogYXMgbWF0aCBmcm9tICcuL21hdGguanMnO1xuXG5jbGFzcyBBbmltYXRpb257XG5cdGNvbnN0cnVjdG9yKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uLCBzdGFnZ2VyRnJhY3Rpb24pe1xuXHRcdFV0aWxzLmFzc2VydFR5cGUodG9WYWx1ZXMsIE9iamVjdCk7XG5cblx0XHR0aGlzLnRvVmFsdWVzID0gdG9WYWx1ZXM7XG5cdFx0dGhpcy50YXJnZXQgPSB0YXJnZXQ7XHRcblx0XHR0aGlzLnN0YWdnZXJGcmFjdGlvbiA9IHN0YWdnZXJGcmFjdGlvbiA9PT0gdW5kZWZpbmVkID8gMCA6IHN0YWdnZXJGcmFjdGlvbjsgLy8gdGltZSBpbiBtcyBiZXR3ZWVuIGZpcnN0IGVsZW1lbnQgYmVnaW5uaW5nIHRoZSBhbmltYXRpb24gYW5kIGxhc3QgZWxlbWVudCBiZWdpbm5pbmcgdGhlIGFuaW1hdGlvbi4gU2hvdWxkIGJlIGxlc3MgdGhhbiBkdXJhdGlvbi5cbnJcblxuXHRcdFV0aWxzLmFzc2VydCh0aGlzLnN0YWdnZXJGcmFjdGlvbiA+PSAwICYmIHRoaXMuc3RhZ2dlckZyYWN0aW9uIDwgMSk7XG5cblx0XHR0aGlzLmZyb21WYWx1ZXMgPSB7fTtcblx0XHRmb3IodmFyIHByb3BlcnR5IGluIHRoaXMudG9WYWx1ZXMpe1xuXHRcdFx0VXRpbHMuYXNzZXJ0UHJvcEV4aXN0cyh0aGlzLnRhcmdldCwgcHJvcGVydHkpO1xuXG5cdFx0XHQvL2NvcHkgcHJvcGVydHksIG1ha2luZyBzdXJlIHRvIHN0b3JlIHRoZSBjb3JyZWN0ICd0aGlzJ1xuXHRcdFx0aWYoVXRpbHMuaXNGdW5jdGlvbih0aGlzLnRhcmdldFtwcm9wZXJ0eV0pKXtcblx0XHRcdFx0dGhpcy5mcm9tVmFsdWVzW3Byb3BlcnR5XSA9IHRoaXMudGFyZ2V0W3Byb3BlcnR5XS5iaW5kKHRoaXMudGFyZ2V0KTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHR0aGlzLmZyb21WYWx1ZXNbcHJvcGVydHldID0gdGhpcy50YXJnZXRbcHJvcGVydHldO1xuXHRcdFx0fVxuXHRcdH1cblxuXG5cdFx0dGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uID09PSB1bmRlZmluZWQgPyAxIDogZHVyYXRpb247IC8vaW4gc1xuXHRcdHRoaXMuZWxhcHNlZFRpbWUgPSAwO1xuXG5cblx0XHRpZih0YXJnZXQuY29uc3RydWN0b3IgPT09IFRyYW5zZm9ybWF0aW9uKXtcblx0XHRcdC8vZmluZCBvdXQgaG93IG1hbnkgb2JqZWN0cyBhcmUgcGFzc2luZyB0aHJvdWdoIHRoaXMgdHJhbnNmb3JtYXRpb25cblx0XHRcdGxldCByb290ID0gdGFyZ2V0O1xuXHRcdFx0d2hpbGUocm9vdC5wYXJlbnQgIT09IG51bGwpe1xuXHRcdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IHJvb3QubnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXHRcdH1lbHNle1xuXHRcdFx0aWYodGhpcy5zdGFnZ2VyRnJhY3Rpb24gIT0gMCl7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoXCJzdGFnZ2VyRnJhY3Rpb24gY2FuIG9ubHkgYmUgdXNlZCB3aGVuIFRyYW5zaXRpb25UbydzIHRhcmdldCBpcyBhbiBFWFAuVHJhbnNmb3JtYXRpb24hXCIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vYmVnaW5cblx0XHR0aGlzLl91cGRhdGVDYWxsYmFjayA9IHRoaXMudXBkYXRlLmJpbmQodGhpcylcblx0XHR0aHJlZS5vbihcInVwZGF0ZVwiLHRoaXMuX3VwZGF0ZUNhbGxiYWNrKTtcblx0fVxuXHR1cGRhdGUodGltZSl7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSB0aW1lLmRlbHRhO1x0XG5cblx0XHRsZXQgcGVyY2VudGFnZSA9IHRoaXMuZWxhcHNlZFRpbWUvdGhpcy5kdXJhdGlvbjtcblxuXHRcdC8vaW50ZXJwb2xhdGUgdmFsdWVzXG5cdFx0Zm9yKGxldCBwcm9wZXJ0eSBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdHRoaXMuaW50ZXJwb2xhdGUocGVyY2VudGFnZSwgcHJvcGVydHksIHRoaXMuZnJvbVZhbHVlc1twcm9wZXJ0eV0sdGhpcy50b1ZhbHVlc1twcm9wZXJ0eV0pO1xuXHRcdH1cblxuXHRcdGlmKHRoaXMuZWxhcHNlZFRpbWUgPj0gdGhpcy5kdXJhdGlvbil7XG5cdFx0XHR0aGlzLmVuZCgpO1xuXHRcdH1cblx0fVxuXHRpbnRlcnBvbGF0ZShwZXJjZW50YWdlLCBwcm9wZXJ0eU5hbWUsIGZyb21WYWx1ZSwgdG9WYWx1ZSl7XG5cdFx0Y29uc3QgbnVtT2JqZWN0cyA9IHRoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uO1xuXG5cdFx0dmFyIG5ld1ZhbHVlID0gbnVsbDtcblx0XHRpZih0eXBlb2YodG9WYWx1ZSkgPT09IFwibnVtYmVyXCIgJiYgdHlwZW9mKGZyb21WYWx1ZSkgPT09IFwibnVtYmVyXCIpe1xuXHRcdFx0bGV0IHQgPSB0aGlzLmludGVycG9sYXRpb25GdW5jdGlvbihwZXJjZW50YWdlKTtcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BlcnR5TmFtZV0gPSB0KnRvVmFsdWUgKyAoMS10KSpmcm9tVmFsdWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fWVsc2UgaWYoVXRpbHMuaXNGdW5jdGlvbih0b1ZhbHVlKSAmJiBVdGlscy5pc0Z1bmN0aW9uKGZyb21WYWx1ZSkpe1xuXHRcdFx0Ly9pZiBzdGFnZ2VyRnJhY3Rpb24gIT0gMCwgaXQncyB0aGUgYW1vdW50IG9mIHRpbWUgYmV0d2VlbiB0aGUgZmlyc3QgcG9pbnQncyBzdGFydCB0aW1lIGFuZCB0aGUgbGFzdCBwb2ludCdzIHN0YXJ0IHRpbWUuXG5cdFx0XHQvL0FTU1VNUFRJT046IHRoZSBmaXJzdCB2YXJpYWJsZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGksIGFuZCBpdCdzIGFzc3VtZWQgaSBpcyB6ZXJvLWluZGV4ZWQuXG5cblx0XHRcdC8vZW5jYXBzdWxhdGUgcGVyY2VudGFnZVxuXHRcdFx0dGhpcy50YXJnZXRbcHJvcGVydHlOYW1lXSA9IChmdW5jdGlvbihpLCAuLi5jb29yZHMpe1xuXHRcdFx0XHRsZXQgbGVycEZhY3RvciA9IHBlcmNlbnRhZ2UvKDEtdGhpcy5zdGFnZ2VyRnJhY3Rpb24pIC0gaSp0aGlzLnN0YWdnZXJGcmFjdGlvbi90aGlzLnRhcmdldE51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHRcdFx0Ly9sZXQgcGVyY2VudCA9IE1hdGgubWluKE1hdGgubWF4KHBlcmNlbnRhZ2UgLSBpL3RoaXMudGFyZ2V0TnVtQ2FsbHNQZXJBY3RpdmF0aW9uICAgLDEpLDApO1xuXG5cdFx0XHRcdGxldCB0ID0gdGhpcy5pbnRlcnBvbGF0aW9uRnVuY3Rpb24oTWF0aC5tYXgoTWF0aC5taW4obGVycEZhY3RvciwxKSwwKSk7XG5cdFx0XHRcdHJldHVybiBtYXRoLmxlcnBWZWN0b3JzKHQsdG9WYWx1ZShpLCAuLi5jb29yZHMpLGZyb21WYWx1ZShpLCAuLi5jb29yZHMpKVxuXHRcdFx0fSkuYmluZCh0aGlzKTtcblx0XHRcdHJldHVybjtcblx0XHR9ZWxzZXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJBbmltYXRpb24gY2xhc3MgY2Fubm90IHlldCBoYW5kbGUgdHJhbnNpdGlvbmluZyBiZXR3ZWVuIHRoaW5ncyB0aGF0IGFyZW4ndCBudW1iZXJzIG9yIGZ1bmN0aW9ucyFcIik7XG5cdFx0fVxuXG5cdH1cblx0aW50ZXJwb2xhdGlvbkZ1bmN0aW9uKHgpe1xuXHRcdHJldHVybiB0aGlzLmNvc2luZUludGVycG9sYXRpb24oeCk7XG5cdH1cblx0Y29zaW5lSW50ZXJwb2xhdGlvbih4KXtcblx0XHRyZXR1cm4gKDEtTWF0aC5jb3MoeCpNYXRoLlBJKSkvMjtcblx0fVxuXHRsaW5lYXJJbnRlcnBvbGF0aW9uKHgpe1xuXHRcdHJldHVybiB4O1xuXHR9XG5cdGVuZCgpe1xuXHRcdGZvcih2YXIgcHJvcCBpbiB0aGlzLnRvVmFsdWVzKXtcblx0XHRcdHRoaXMudGFyZ2V0W3Byb3BdID0gdGhpcy50b1ZhbHVlc1twcm9wXTtcblx0XHR9XG5cdFx0dGhyZWUucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInVwZGF0ZVwiLHRoaXMuX3VwZGF0ZUNhbGxiYWNrKTtcblx0XHQvL1RvZG86IGRlbGV0ZSB0aGlzXG5cdH1cbn1cblxuLy90b2RvOiBwdXQgdGhpcyBpbnRvIGEgRGlyZWN0b3IgY2xhc3Mgc28gdGhhdCBpdCBjYW4gaGF2ZSBhbiB1bmRvIHN0YWNrXG5mdW5jdGlvbiBUcmFuc2l0aW9uVG8odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUywgc3RhZ2dlckZyYWN0aW9uKXtcblx0dmFyIGFuaW1hdGlvbiA9IG5ldyBBbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwLCBzdGFnZ2VyRnJhY3Rpb24pO1xufVxuXG5leHBvcnQge1RyYW5zaXRpb25UbywgQW5pbWF0aW9ufVxuIiwiKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIGxvb2t1cCA9IFtcblx0XHRcdCdBJywgJ0InLCAnQycsICdEJywgJ0UnLCAnRicsICdHJywgJ0gnLFxuXHRcdFx0J0knLCAnSicsICdLJywgJ0wnLCAnTScsICdOJywgJ08nLCAnUCcsXG5cdFx0XHQnUScsICdSJywgJ1MnLCAnVCcsICdVJywgJ1YnLCAnVycsICdYJyxcblx0XHRcdCdZJywgJ1onLCAnYScsICdiJywgJ2MnLCAnZCcsICdlJywgJ2YnLFxuXHRcdFx0J2cnLCAnaCcsICdpJywgJ2onLCAnaycsICdsJywgJ20nLCAnbicsXG5cdFx0XHQnbycsICdwJywgJ3EnLCAncicsICdzJywgJ3QnLCAndScsICd2Jyxcblx0XHRcdCd3JywgJ3gnLCAneScsICd6JywgJzAnLCAnMScsICcyJywgJzMnLFxuXHRcdFx0JzQnLCAnNScsICc2JywgJzcnLCAnOCcsICc5JywgJysnLCAnLydcblx0XHRdO1xuXHRmdW5jdGlvbiBjbGVhbihsZW5ndGgpIHtcblx0XHR2YXIgaSwgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKTtcblx0XHRmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdGJ1ZmZlcltpXSA9IDA7XG5cdFx0fVxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHRmdW5jdGlvbiBleHRlbmQob3JpZywgbGVuZ3RoLCBhZGRMZW5ndGgsIG11bHRpcGxlT2YpIHtcblx0XHR2YXIgbmV3U2l6ZSA9IGxlbmd0aCArIGFkZExlbmd0aCxcblx0XHRcdGJ1ZmZlciA9IGNsZWFuKChwYXJzZUludChuZXdTaXplIC8gbXVsdGlwbGVPZikgKyAxKSAqIG11bHRpcGxlT2YpO1xuXG5cdFx0YnVmZmVyLnNldChvcmlnKTtcblxuXHRcdHJldHVybiBidWZmZXI7XG5cdH1cblxuXHRmdW5jdGlvbiBwYWQobnVtLCBieXRlcywgYmFzZSkge1xuXHRcdG51bSA9IG51bS50b1N0cmluZyhiYXNlIHx8IDgpO1xuXHRcdHJldHVybiBcIjAwMDAwMDAwMDAwMFwiLnN1YnN0cihudW0ubGVuZ3RoICsgMTIgLSBieXRlcykgKyBudW07XG5cdH1cblxuXHRmdW5jdGlvbiBzdHJpbmdUb1VpbnQ4IChpbnB1dCwgb3V0LCBvZmZzZXQpIHtcblx0XHR2YXIgaSwgbGVuZ3RoO1xuXG5cdFx0b3V0ID0gb3V0IHx8IGNsZWFuKGlucHV0Lmxlbmd0aCk7XG5cblx0XHRvZmZzZXQgPSBvZmZzZXQgfHwgMDtcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSBpbnB1dC5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0b3V0W29mZnNldF0gPSBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0b2Zmc2V0ICs9IDE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aDtcblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwW251bSA+PiAxOCAmIDB4M0ZdICsgbG9va3VwW251bSA+PiAxMiAmIDB4M0ZdICsgbG9va3VwW251bSA+PiA2ICYgMHgzRl0gKyBsb29rdXBbbnVtICYgMHgzRl07XG5cdFx0fTtcblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pO1xuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKTtcblx0XHR9XG5cblx0XHQvLyB0aGlzIHByZXZlbnRzIGFuIEVSUl9JTlZBTElEX1VSTCBpbiBDaHJvbWUgKEZpcmVmb3ggb2theSlcblx0XHRzd2l0Y2ggKG91dHB1dC5sZW5ndGggJSA0KSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdG91dHB1dCArPSAnPSc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHRvdXRwdXQgKz0gJz09Jztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0O1xuXHR9XG5cblx0d2luZG93LnV0aWxzID0ge31cblx0d2luZG93LnV0aWxzLmNsZWFuID0gY2xlYW47XG5cdHdpbmRvdy51dGlscy5wYWQgPSBwYWQ7XG5cdHdpbmRvdy51dGlscy5leHRlbmQgPSBleHRlbmQ7XG5cdHdpbmRvdy51dGlscy5zdHJpbmdUb1VpbnQ4ID0gc3RyaW5nVG9VaW50ODtcblx0d2luZG93LnV0aWxzLnVpbnQ4VG9CYXNlNjQgPSB1aW50OFRvQmFzZTY0O1xufSgpKTtcblxuKGZ1bmN0aW9uICgpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cbi8qXG5zdHJ1Y3QgcG9zaXhfaGVhZGVyIHsgICAgICAgICAgICAgLy8gYnl0ZSBvZmZzZXRcblx0Y2hhciBuYW1lWzEwMF07ICAgICAgICAgICAgICAgLy8gICAwXG5cdGNoYXIgbW9kZVs4XTsgICAgICAgICAgICAgICAgIC8vIDEwMFxuXHRjaGFyIHVpZFs4XTsgICAgICAgICAgICAgICAgICAvLyAxMDhcblx0Y2hhciBnaWRbOF07ICAgICAgICAgICAgICAgICAgLy8gMTE2XG5cdGNoYXIgc2l6ZVsxMl07ICAgICAgICAgICAgICAgIC8vIDEyNFxuXHRjaGFyIG10aW1lWzEyXTsgICAgICAgICAgICAgICAvLyAxMzZcblx0Y2hhciBjaGtzdW1bOF07ICAgICAgICAgICAgICAgLy8gMTQ4XG5cdGNoYXIgdHlwZWZsYWc7ICAgICAgICAgICAgICAgIC8vIDE1NlxuXHRjaGFyIGxpbmtuYW1lWzEwMF07ICAgICAgICAgICAvLyAxNTdcblx0Y2hhciBtYWdpY1s2XTsgICAgICAgICAgICAgICAgLy8gMjU3XG5cdGNoYXIgdmVyc2lvblsyXTsgICAgICAgICAgICAgIC8vIDI2M1xuXHRjaGFyIHVuYW1lWzMyXTsgICAgICAgICAgICAgICAvLyAyNjVcblx0Y2hhciBnbmFtZVszMl07ICAgICAgICAgICAgICAgLy8gMjk3XG5cdGNoYXIgZGV2bWFqb3JbOF07ICAgICAgICAgICAgIC8vIDMyOVxuXHRjaGFyIGRldm1pbm9yWzhdOyAgICAgICAgICAgICAvLyAzMzdcblx0Y2hhciBwcmVmaXhbMTU1XTsgICAgICAgICAgICAgLy8gMzQ1XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gNTAwXG59O1xuKi9cblxuXHR2YXIgdXRpbHMgPSB3aW5kb3cudXRpbHMsXG5cdFx0aGVhZGVyRm9ybWF0O1xuXG5cdGhlYWRlckZvcm1hdCA9IFtcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZU5hbWUnLFxuXHRcdFx0J2xlbmd0aCc6IDEwMFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVNb2RlJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAndWlkJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZ2lkJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZmlsZVNpemUnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbXRpbWUnLFxuXHRcdFx0J2xlbmd0aCc6IDEyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnY2hlY2tzdW0nLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICd0eXBlJyxcblx0XHRcdCdsZW5ndGgnOiAxXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbGlua05hbWUnLFxuXHRcdFx0J2xlbmd0aCc6IDEwMFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ3VzdGFyJyxcblx0XHRcdCdsZW5ndGgnOiA4XG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnb3duZXInLFxuXHRcdFx0J2xlbmd0aCc6IDMyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnZ3JvdXAnLFxuXHRcdFx0J2xlbmd0aCc6IDMyXG5cdFx0fSxcblx0XHR7XG5cdFx0XHQnZmllbGQnOiAnbWFqb3JOdW1iZXInLFxuXHRcdFx0J2xlbmd0aCc6IDhcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdtaW5vck51bWJlcicsXG5cdFx0XHQnbGVuZ3RoJzogOFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0J2ZpZWxkJzogJ2ZpbGVuYW1lUHJlZml4Jyxcblx0XHRcdCdsZW5ndGgnOiAxNTVcblx0XHR9LFxuXHRcdHtcblx0XHRcdCdmaWVsZCc6ICdwYWRkaW5nJyxcblx0XHRcdCdsZW5ndGgnOiAxMlxuXHRcdH1cblx0XTtcblxuXHRmdW5jdGlvbiBmb3JtYXRIZWFkZXIoZGF0YSwgY2IpIHtcblx0XHR2YXIgYnVmZmVyID0gdXRpbHMuY2xlYW4oNTEyKSxcblx0XHRcdG9mZnNldCA9IDA7XG5cblx0XHRoZWFkZXJGb3JtYXQuZm9yRWFjaChmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdHZhciBzdHIgPSBkYXRhW3ZhbHVlLmZpZWxkXSB8fCBcIlwiLFxuXHRcdFx0XHRpLCBsZW5ndGg7XG5cblx0XHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHN0ci5sZW5ndGg7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuXHRcdFx0XHRidWZmZXJbb2Zmc2V0XSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0XHRvZmZzZXQgKz0gMTtcblx0XHRcdH1cblxuXHRcdFx0b2Zmc2V0ICs9IHZhbHVlLmxlbmd0aCAtIGk7IC8vIHNwYWNlIGl0IG91dCB3aXRoIG51bGxzXG5cdFx0fSk7XG5cblx0XHRpZiAodHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRyZXR1cm4gY2IoYnVmZmVyLCBvZmZzZXQpO1xuXHRcdH1cblx0XHRyZXR1cm4gYnVmZmVyO1xuXHR9XG5cblx0d2luZG93LmhlYWRlciA9IHt9XG5cdHdpbmRvdy5oZWFkZXIuc3RydWN0dXJlID0gaGVhZGVyRm9ybWF0O1xuXHR3aW5kb3cuaGVhZGVyLmZvcm1hdCA9IGZvcm1hdEhlYWRlcjtcbn0oKSk7XG5cbihmdW5jdGlvbiAoKSB7XG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBoZWFkZXIgPSB3aW5kb3cuaGVhZGVyLFxuXHRcdHV0aWxzID0gd2luZG93LnV0aWxzLFxuXHRcdHJlY29yZFNpemUgPSA1MTIsXG5cdFx0YmxvY2tTaXplO1xuXG5cdGZ1bmN0aW9uIFRhcihyZWNvcmRzUGVyQmxvY2spIHtcblx0XHR0aGlzLndyaXR0ZW4gPSAwO1xuXHRcdGJsb2NrU2l6ZSA9IChyZWNvcmRzUGVyQmxvY2sgfHwgMjApICogcmVjb3JkU2l6ZTtcblx0XHR0aGlzLm91dCA9IHV0aWxzLmNsZWFuKGJsb2NrU2l6ZSk7XG5cdFx0dGhpcy5ibG9ja3MgPSBbXTtcblx0XHR0aGlzLmxlbmd0aCA9IDA7XG5cdH1cblxuXHRUYXIucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uIChmaWxlcGF0aCwgaW5wdXQsIG9wdHMsIGNhbGxiYWNrKSB7XG5cdFx0dmFyIGRhdGEsXG5cdFx0XHRjaGVja3N1bSxcblx0XHRcdG1vZGUsXG5cdFx0XHRtdGltZSxcblx0XHRcdHVpZCxcblx0XHRcdGdpZCxcblx0XHRcdGhlYWRlckFycjtcblxuXHRcdGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRpbnB1dCA9IHV0aWxzLnN0cmluZ1RvVWludDgoaW5wdXQpO1xuXHRcdH0gZWxzZSBpZiAoaW5wdXQuY29uc3RydWN0b3IgIT09IFVpbnQ4QXJyYXkucHJvdG90eXBlLmNvbnN0cnVjdG9yKSB7XG5cdFx0XHR0aHJvdyAnSW52YWxpZCBpbnB1dCB0eXBlLiBZb3UgZ2F2ZSBtZTogJyArIGlucHV0LmNvbnN0cnVjdG9yLnRvU3RyaW5nKCkubWF0Y2goL2Z1bmN0aW9uXFxzKihbJEEtWmEtel9dWzAtOUEtWmEtel9dKilcXHMqXFwoLylbMV07XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRjYWxsYmFjayA9IG9wdHM7XG5cdFx0XHRvcHRzID0ge307XG5cdFx0fVxuXG5cdFx0b3B0cyA9IG9wdHMgfHwge307XG5cblx0XHRtb2RlID0gb3B0cy5tb2RlIHx8IHBhcnNlSW50KCc3NzcnLCA4KSAmIDB4ZmZmO1xuXHRcdG10aW1lID0gb3B0cy5tdGltZSB8fCBNYXRoLmZsb29yKCtuZXcgRGF0ZSgpIC8gMTAwMCk7XG5cdFx0dWlkID0gb3B0cy51aWQgfHwgMDtcblx0XHRnaWQgPSBvcHRzLmdpZCB8fCAwO1xuXG5cdFx0ZGF0YSA9IHtcblx0XHRcdGZpbGVOYW1lOiBmaWxlcGF0aCxcblx0XHRcdGZpbGVNb2RlOiB1dGlscy5wYWQobW9kZSwgNyksXG5cdFx0XHR1aWQ6IHV0aWxzLnBhZCh1aWQsIDcpLFxuXHRcdFx0Z2lkOiB1dGlscy5wYWQoZ2lkLCA3KSxcblx0XHRcdGZpbGVTaXplOiB1dGlscy5wYWQoaW5wdXQubGVuZ3RoLCAxMSksXG5cdFx0XHRtdGltZTogdXRpbHMucGFkKG10aW1lLCAxMSksXG5cdFx0XHRjaGVja3N1bTogJyAgICAgICAgJyxcblx0XHRcdHR5cGU6ICcwJywgLy8ganVzdCBhIGZpbGVcblx0XHRcdHVzdGFyOiAndXN0YXIgICcsXG5cdFx0XHRvd25lcjogb3B0cy5vd25lciB8fCAnJyxcblx0XHRcdGdyb3VwOiBvcHRzLmdyb3VwIHx8ICcnXG5cdFx0fTtcblxuXHRcdC8vIGNhbGN1bGF0ZSB0aGUgY2hlY2tzdW1cblx0XHRjaGVja3N1bSA9IDA7XG5cdFx0T2JqZWN0LmtleXMoZGF0YSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG5cdFx0XHR2YXIgaSwgdmFsdWUgPSBkYXRhW2tleV0sIGxlbmd0aDtcblxuXHRcdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcblx0XHRcdFx0Y2hlY2tzdW0gKz0gdmFsdWUuY2hhckNvZGVBdChpKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGRhdGEuY2hlY2tzdW0gPSB1dGlscy5wYWQoY2hlY2tzdW0sIDYpICsgXCJcXHUwMDAwIFwiO1xuXG5cdFx0aGVhZGVyQXJyID0gaGVhZGVyLmZvcm1hdChkYXRhKTtcblxuXHRcdHZhciBoZWFkZXJMZW5ndGggPSBNYXRoLmNlaWwoIGhlYWRlckFyci5sZW5ndGggLyByZWNvcmRTaXplICkgKiByZWNvcmRTaXplO1xuXHRcdHZhciBpbnB1dExlbmd0aCA9IE1hdGguY2VpbCggaW5wdXQubGVuZ3RoIC8gcmVjb3JkU2l6ZSApICogcmVjb3JkU2l6ZTtcblxuXHRcdHRoaXMuYmxvY2tzLnB1c2goIHsgaGVhZGVyOiBoZWFkZXJBcnIsIGlucHV0OiBpbnB1dCwgaGVhZGVyTGVuZ3RoOiBoZWFkZXJMZW5ndGgsIGlucHV0TGVuZ3RoOiBpbnB1dExlbmd0aCB9ICk7XG5cblx0fTtcblxuXHRUYXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBidWZmZXJzID0gW107XG5cdFx0dmFyIGNodW5rcyA9IFtdO1xuXHRcdHZhciBsZW5ndGggPSAwO1xuXHRcdHZhciBtYXggPSBNYXRoLnBvdyggMiwgMjAgKTtcblxuXHRcdHZhciBjaHVuayA9IFtdO1xuXHRcdHRoaXMuYmxvY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBiICkge1xuXHRcdFx0aWYoIGxlbmd0aCArIGIuaGVhZGVyTGVuZ3RoICsgYi5pbnB1dExlbmd0aCA+IG1heCApIHtcblx0XHRcdFx0Y2h1bmtzLnB1c2goIHsgYmxvY2tzOiBjaHVuaywgbGVuZ3RoOiBsZW5ndGggfSApO1xuXHRcdFx0XHRjaHVuayA9IFtdO1xuXHRcdFx0XHRsZW5ndGggPSAwO1xuXHRcdFx0fVxuXHRcdFx0Y2h1bmsucHVzaCggYiApO1xuXHRcdFx0bGVuZ3RoICs9IGIuaGVhZGVyTGVuZ3RoICsgYi5pbnB1dExlbmd0aDtcblx0XHR9ICk7XG5cdFx0Y2h1bmtzLnB1c2goIHsgYmxvY2tzOiBjaHVuaywgbGVuZ3RoOiBsZW5ndGggfSApO1xuXG5cdFx0Y2h1bmtzLmZvckVhY2goIGZ1bmN0aW9uKCBjICkge1xuXG5cdFx0XHR2YXIgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoIGMubGVuZ3RoICk7XG5cdFx0XHR2YXIgd3JpdHRlbiA9IDA7XG5cdFx0XHRjLmJsb2Nrcy5mb3JFYWNoKCBmdW5jdGlvbiggYiApIHtcblx0XHRcdFx0YnVmZmVyLnNldCggYi5oZWFkZXIsIHdyaXR0ZW4gKTtcblx0XHRcdFx0d3JpdHRlbiArPSBiLmhlYWRlckxlbmd0aDtcblx0XHRcdFx0YnVmZmVyLnNldCggYi5pbnB1dCwgd3JpdHRlbiApO1xuXHRcdFx0XHR3cml0dGVuICs9IGIuaW5wdXRMZW5ndGg7XG5cdFx0XHR9ICk7XG5cdFx0XHRidWZmZXJzLnB1c2goIGJ1ZmZlciApO1xuXG5cdFx0fSApO1xuXG5cdFx0YnVmZmVycy5wdXNoKCBuZXcgVWludDhBcnJheSggMiAqIHJlY29yZFNpemUgKSApO1xuXG5cdFx0cmV0dXJuIG5ldyBCbG9iKCBidWZmZXJzLCB7IHR5cGU6ICdvY3RldC9zdHJlYW0nIH0gKTtcblxuXHR9O1xuXG5cdFRhci5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy53cml0dGVuID0gMDtcblx0XHR0aGlzLm91dCA9IHV0aWxzLmNsZWFuKGJsb2NrU2l6ZSk7XG5cdH07XG5cbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFRhcjtcbiAgfSBlbHNlIHtcbiAgICB3aW5kb3cuVGFyID0gVGFyO1xuICB9XG59KCkpO1xuIiwiLy9kb3dubG9hZC5qcyB2My4wLCBieSBkYW5kYXZpczsgMjAwOC0yMDE0LiBbQ0NCWTJdIHNlZSBodHRwOi8vZGFubWwuY29tL2Rvd25sb2FkLmh0bWwgZm9yIHRlc3RzL3VzYWdlXG4vLyB2MSBsYW5kZWQgYSBGRitDaHJvbWUgY29tcGF0IHdheSBvZiBkb3dubG9hZGluZyBzdHJpbmdzIHRvIGxvY2FsIHVuLW5hbWVkIGZpbGVzLCB1cGdyYWRlZCB0byB1c2UgYSBoaWRkZW4gZnJhbWUgYW5kIG9wdGlvbmFsIG1pbWVcbi8vIHYyIGFkZGVkIG5hbWVkIGZpbGVzIHZpYSBhW2Rvd25sb2FkXSwgbXNTYXZlQmxvYiwgSUUgKDEwKykgc3VwcG9ydCwgYW5kIHdpbmRvdy5VUkwgc3VwcG9ydCBmb3IgbGFyZ2VyK2Zhc3RlciBzYXZlcyB0aGFuIGRhdGFVUkxzXG4vLyB2MyBhZGRlZCBkYXRhVVJMIGFuZCBCbG9iIElucHV0LCBiaW5kLXRvZ2dsZSBhcml0eSwgYW5kIGxlZ2FjeSBkYXRhVVJMIGZhbGxiYWNrIHdhcyBpbXByb3ZlZCB3aXRoIGZvcmNlLWRvd25sb2FkIG1pbWUgYW5kIGJhc2U2NCBzdXBwb3J0XG5cbi8vIGRhdGEgY2FuIGJlIGEgc3RyaW5nLCBCbG9iLCBGaWxlLCBvciBkYXRhVVJMXG5cblxuXG5cbmZ1bmN0aW9uIGRvd25sb2FkKGRhdGEsIHN0ckZpbGVOYW1lLCBzdHJNaW1lVHlwZSkge1xuXG5cdHZhciBzZWxmID0gd2luZG93LCAvLyB0aGlzIHNjcmlwdCBpcyBvbmx5IGZvciBicm93c2VycyBhbnl3YXkuLi5cblx0XHR1ID0gXCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIiwgLy8gdGhpcyBkZWZhdWx0IG1pbWUgYWxzbyB0cmlnZ2VycyBpZnJhbWUgZG93bmxvYWRzXG5cdFx0bSA9IHN0ck1pbWVUeXBlIHx8IHUsXG5cdFx0eCA9IGRhdGEsXG5cdFx0RCA9IGRvY3VtZW50LFxuXHRcdGEgPSBELmNyZWF0ZUVsZW1lbnQoXCJhXCIpLFxuXHRcdHogPSBmdW5jdGlvbihhKXtyZXR1cm4gU3RyaW5nKGEpO30sXG5cblxuXHRcdEIgPSBzZWxmLkJsb2IgfHwgc2VsZi5Nb3pCbG9iIHx8IHNlbGYuV2ViS2l0QmxvYiB8fCB6LFxuXHRcdEJCID0gc2VsZi5NU0Jsb2JCdWlsZGVyIHx8IHNlbGYuV2ViS2l0QmxvYkJ1aWxkZXIgfHwgc2VsZi5CbG9iQnVpbGRlcixcblx0XHRmbiA9IHN0ckZpbGVOYW1lIHx8IFwiZG93bmxvYWRcIixcblx0XHRibG9iLFxuXHRcdGIsXG5cdFx0dWEsXG5cdFx0ZnI7XG5cblx0Ly9pZih0eXBlb2YgQi5iaW5kID09PSAnZnVuY3Rpb24nICl7IEI9Qi5iaW5kKHNlbGYpOyB9XG5cblx0aWYoU3RyaW5nKHRoaXMpPT09XCJ0cnVlXCIpeyAvL3JldmVyc2UgYXJndW1lbnRzLCBhbGxvd2luZyBkb3dubG9hZC5iaW5kKHRydWUsIFwidGV4dC94bWxcIiwgXCJleHBvcnQueG1sXCIpIHRvIGFjdCBhcyBhIGNhbGxiYWNrXG5cdFx0eD1beCwgbV07XG5cdFx0bT14WzBdO1xuXHRcdHg9eFsxXTtcblx0fVxuXG5cblxuXHQvL2dvIGFoZWFkIGFuZCBkb3dubG9hZCBkYXRhVVJMcyByaWdodCBhd2F5XG5cdGlmKFN0cmluZyh4KS5tYXRjaCgvXmRhdGFcXDpbXFx3K1xcLV0rXFwvW1xcdytcXC1dK1ssO10vKSl7XG5cdFx0cmV0dXJuIG5hdmlnYXRvci5tc1NhdmVCbG9iID8gIC8vIElFMTAgY2FuJ3QgZG8gYVtkb3dubG9hZF0sIG9ubHkgQmxvYnM6XG5cdFx0XHRuYXZpZ2F0b3IubXNTYXZlQmxvYihkMmIoeCksIGZuKSA6XG5cdFx0XHRzYXZlcih4KSA7IC8vIGV2ZXJ5b25lIGVsc2UgY2FuIHNhdmUgZGF0YVVSTHMgdW4tcHJvY2Vzc2VkXG5cdH0vL2VuZCBpZiBkYXRhVVJMIHBhc3NlZD9cblxuXHR0cnl7XG5cblx0XHRibG9iID0geCBpbnN0YW5jZW9mIEIgP1xuXHRcdFx0eCA6XG5cdFx0XHRuZXcgQihbeF0sIHt0eXBlOiBtfSkgO1xuXHR9Y2F0Y2goeSl7XG5cdFx0aWYoQkIpe1xuXHRcdFx0YiA9IG5ldyBCQigpO1xuXHRcdFx0Yi5hcHBlbmQoW3hdKTtcblx0XHRcdGJsb2IgPSBiLmdldEJsb2IobSk7IC8vIHRoZSBibG9iXG5cdFx0fVxuXG5cdH1cblxuXG5cblx0ZnVuY3Rpb24gZDJiKHUpIHtcblx0XHR2YXIgcD0gdS5zcGxpdCgvWzo7LF0vKSxcblx0XHR0PSBwWzFdLFxuXHRcdGRlYz0gcFsyXSA9PSBcImJhc2U2NFwiID8gYXRvYiA6IGRlY29kZVVSSUNvbXBvbmVudCxcblx0XHRiaW49IGRlYyhwLnBvcCgpKSxcblx0XHRteD0gYmluLmxlbmd0aCxcblx0XHRpPSAwLFxuXHRcdHVpYT0gbmV3IFVpbnQ4QXJyYXkobXgpO1xuXG5cdFx0Zm9yKGk7aTxteDsrK2kpIHVpYVtpXT0gYmluLmNoYXJDb2RlQXQoaSk7XG5cblx0XHRyZXR1cm4gbmV3IEIoW3VpYV0sIHt0eXBlOiB0fSk7XG5cdCB9XG5cblx0ZnVuY3Rpb24gc2F2ZXIodXJsLCB3aW5Nb2RlKXtcblxuXG5cdFx0aWYgKCdkb3dubG9hZCcgaW4gYSkgeyAvL2h0bWw1IEFbZG93bmxvYWRdXG5cdFx0XHRhLmhyZWYgPSB1cmw7XG5cdFx0XHRhLnNldEF0dHJpYnV0ZShcImRvd25sb2FkXCIsIGZuKTtcblx0XHRcdGEuaW5uZXJIVE1MID0gXCJkb3dubG9hZGluZy4uLlwiO1xuXHRcdFx0YS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0RC5ib2R5LmFwcGVuZENoaWxkKGEpO1xuXHRcdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0YS5jbGljaygpO1xuXHRcdFx0XHRELmJvZHkucmVtb3ZlQ2hpbGQoYSk7XG5cdFx0XHRcdGlmKHdpbk1vZGU9PT10cnVlKXtzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7IHNlbGYuVVJMLnJldm9rZU9iamVjdFVSTChhLmhyZWYpO30sIDI1MCApO31cblx0XHRcdH0sIDY2KTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vZG8gaWZyYW1lIGRhdGFVUkwgZG93bmxvYWQgKG9sZCBjaCtGRik6XG5cdFx0dmFyIGYgPSBELmNyZWF0ZUVsZW1lbnQoXCJpZnJhbWVcIik7XG5cdFx0RC5ib2R5LmFwcGVuZENoaWxkKGYpO1xuXHRcdGlmKCF3aW5Nb2RlKXsgLy8gZm9yY2UgYSBtaW1lIHRoYXQgd2lsbCBkb3dubG9hZDpcblx0XHRcdHVybD1cImRhdGE6XCIrdXJsLnJlcGxhY2UoL15kYXRhOihbXFx3XFwvXFwtXFwrXSspLywgdSk7XG5cdFx0fVxuXG5cblx0XHRmLnNyYyA9IHVybDtcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7IEQuYm9keS5yZW1vdmVDaGlsZChmKTsgfSwgMzMzKTtcblxuXHR9Ly9lbmQgc2F2ZXJcblxuXG5cdGlmIChuYXZpZ2F0b3IubXNTYXZlQmxvYikgeyAvLyBJRTEwKyA6IChoYXMgQmxvYiwgYnV0IG5vdCBhW2Rvd25sb2FkXSBvciBVUkwpXG5cdFx0cmV0dXJuIG5hdmlnYXRvci5tc1NhdmVCbG9iKGJsb2IsIGZuKTtcblx0fVxuXG5cdGlmKHNlbGYuVVJMKXsgLy8gc2ltcGxlIGZhc3QgYW5kIG1vZGVybiB3YXkgdXNpbmcgQmxvYiBhbmQgVVJMOlxuXHRcdHNhdmVyKHNlbGYuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKSwgdHJ1ZSk7XG5cdH1lbHNle1xuXHRcdC8vIGhhbmRsZSBub24tQmxvYigpK25vbi1VUkwgYnJvd3NlcnM6XG5cdFx0aWYodHlwZW9mIGJsb2IgPT09IFwic3RyaW5nXCIgfHwgYmxvYi5jb25zdHJ1Y3Rvcj09PXogKXtcblx0XHRcdHRyeXtcblx0XHRcdFx0cmV0dXJuIHNhdmVyKCBcImRhdGE6XCIgKyAgbSAgICsgXCI7YmFzZTY0LFwiICArICBzZWxmLmJ0b2EoYmxvYikgICk7XG5cdFx0XHR9Y2F0Y2goeSl7XG5cdFx0XHRcdHJldHVybiBzYXZlciggXCJkYXRhOlwiICsgIG0gICArIFwiLFwiICsgZW5jb2RlVVJJQ29tcG9uZW50KGJsb2IpICApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEJsb2IgYnV0IG5vdCBVUkw6XG5cdFx0ZnI9bmV3IEZpbGVSZWFkZXIoKTtcblx0XHRmci5vbmxvYWQ9ZnVuY3Rpb24oZSl7XG5cdFx0XHRzYXZlcih0aGlzLnJlc3VsdCk7XG5cdFx0fTtcblx0XHRmci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuXHR9XG5cdHJldHVybiB0cnVlO1xufSAvKiBlbmQgZG93bmxvYWQoKSAqL1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICBtb2R1bGUuZXhwb3J0cyA9IGRvd25sb2FkO1xufVxuIiwiLy8gZ2lmLmpzIDAuMi4wIC0gaHR0cHM6Ly9naXRodWIuY29tL2pub3JkYmVyZy9naWYuanNcclxuKGZ1bmN0aW9uKGYpe2lmKHR5cGVvZiBleHBvcnRzPT09XCJvYmplY3RcIiYmdHlwZW9mIG1vZHVsZSE9PVwidW5kZWZpbmVkXCIpe21vZHVsZS5leHBvcnRzPWYoKX1lbHNlIGlmKHR5cGVvZiBkZWZpbmU9PT1cImZ1bmN0aW9uXCImJmRlZmluZS5hbWQpe2RlZmluZShbXSxmKX1lbHNle3ZhciBnO2lmKHR5cGVvZiB3aW5kb3chPT1cInVuZGVmaW5lZFwiKXtnPXdpbmRvd31lbHNlIGlmKHR5cGVvZiBnbG9iYWwhPT1cInVuZGVmaW5lZFwiKXtnPWdsb2JhbH1lbHNlIGlmKHR5cGVvZiBzZWxmIT09XCJ1bmRlZmluZWRcIil7Zz1zZWxmfWVsc2V7Zz10aGlzfWcuR0lGPWYoKX19KShmdW5jdGlvbigpe3ZhciBkZWZpbmUsbW9kdWxlLGV4cG9ydHM7cmV0dXJuIGZ1bmN0aW9uKCl7ZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9cmV0dXJuIGV9KCkoezE6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe2Z1bmN0aW9uIEV2ZW50RW1pdHRlcigpe3RoaXMuX2V2ZW50cz10aGlzLl9ldmVudHN8fHt9O3RoaXMuX21heExpc3RlbmVycz10aGlzLl9tYXhMaXN0ZW5lcnN8fHVuZGVmaW5lZH1tb2R1bGUuZXhwb3J0cz1FdmVudEVtaXR0ZXI7RXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlcj1FdmVudEVtaXR0ZXI7RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzPXVuZGVmaW5lZDtFdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnM9dW5kZWZpbmVkO0V2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzPTEwO0V2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzPWZ1bmN0aW9uKG4pe2lmKCFpc051bWJlcihuKXx8bjwwfHxpc05hTihuKSl0aHJvdyBUeXBlRXJyb3IoXCJuIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIik7dGhpcy5fbWF4TGlzdGVuZXJzPW47cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdD1mdW5jdGlvbih0eXBlKXt2YXIgZXIsaGFuZGxlcixsZW4sYXJncyxpLGxpc3RlbmVycztpZighdGhpcy5fZXZlbnRzKXRoaXMuX2V2ZW50cz17fTtpZih0eXBlPT09XCJlcnJvclwiKXtpZighdGhpcy5fZXZlbnRzLmVycm9yfHxpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpJiYhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCl7ZXI9YXJndW1lbnRzWzFdO2lmKGVyIGluc3RhbmNlb2YgRXJyb3Ipe3Rocm93IGVyfWVsc2V7dmFyIGVycj1uZXcgRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuICgnK2VyK1wiKVwiKTtlcnIuY29udGV4dD1lcjt0aHJvdyBlcnJ9fX1oYW5kbGVyPXRoaXMuX2V2ZW50c1t0eXBlXTtpZihpc1VuZGVmaW5lZChoYW5kbGVyKSlyZXR1cm4gZmFsc2U7aWYoaXNGdW5jdGlvbihoYW5kbGVyKSl7c3dpdGNoKGFyZ3VtZW50cy5sZW5ndGgpe2Nhc2UgMTpoYW5kbGVyLmNhbGwodGhpcyk7YnJlYWs7Y2FzZSAyOmhhbmRsZXIuY2FsbCh0aGlzLGFyZ3VtZW50c1sxXSk7YnJlYWs7Y2FzZSAzOmhhbmRsZXIuY2FsbCh0aGlzLGFyZ3VtZW50c1sxXSxhcmd1bWVudHNbMl0pO2JyZWFrO2RlZmF1bHQ6YXJncz1BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsMSk7aGFuZGxlci5hcHBseSh0aGlzLGFyZ3MpfX1lbHNlIGlmKGlzT2JqZWN0KGhhbmRsZXIpKXthcmdzPUFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKTtsaXN0ZW5lcnM9aGFuZGxlci5zbGljZSgpO2xlbj1saXN0ZW5lcnMubGVuZ3RoO2ZvcihpPTA7aTxsZW47aSsrKWxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLGFyZ3MpfXJldHVybiB0cnVlfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyPWZ1bmN0aW9uKHR5cGUsbGlzdGVuZXIpe3ZhciBtO2lmKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSl0aHJvdyBUeXBlRXJyb3IoXCJsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb25cIik7aWYoIXRoaXMuX2V2ZW50cyl0aGlzLl9ldmVudHM9e307aWYodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKXRoaXMuZW1pdChcIm5ld0xpc3RlbmVyXCIsdHlwZSxpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKT9saXN0ZW5lci5saXN0ZW5lcjpsaXN0ZW5lcik7aWYoIXRoaXMuX2V2ZW50c1t0eXBlXSl0aGlzLl9ldmVudHNbdHlwZV09bGlzdGVuZXI7ZWxzZSBpZihpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKXRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtlbHNlIHRoaXMuX2V2ZW50c1t0eXBlXT1bdGhpcy5fZXZlbnRzW3R5cGVdLGxpc3RlbmVyXTtpZihpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pJiYhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCl7aWYoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpe209dGhpcy5fbWF4TGlzdGVuZXJzfWVsc2V7bT1FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVyc31pZihtJiZtPjAmJnRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGg+bSl7dGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZD10cnVlO2NvbnNvbGUuZXJyb3IoXCIobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSBcIitcImxlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gXCIrXCJVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC5cIix0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtpZih0eXBlb2YgY29uc29sZS50cmFjZT09PVwiZnVuY3Rpb25cIil7Y29uc29sZS50cmFjZSgpfX19cmV0dXJuIHRoaXN9O0V2ZW50RW1pdHRlci5wcm90b3R5cGUub249RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2U9ZnVuY3Rpb24odHlwZSxsaXN0ZW5lcil7aWYoIWlzRnVuY3Rpb24obGlzdGVuZXIpKXRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTt2YXIgZmlyZWQ9ZmFsc2U7ZnVuY3Rpb24gZygpe3RoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSxnKTtpZighZmlyZWQpe2ZpcmVkPXRydWU7bGlzdGVuZXIuYXBwbHkodGhpcyxhcmd1bWVudHMpfX1nLmxpc3RlbmVyPWxpc3RlbmVyO3RoaXMub24odHlwZSxnKTtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lcj1mdW5jdGlvbih0eXBlLGxpc3RlbmVyKXt2YXIgbGlzdCxwb3NpdGlvbixsZW5ndGgsaTtpZighaXNGdW5jdGlvbihsaXN0ZW5lcikpdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO2lmKCF0aGlzLl9ldmVudHN8fCF0aGlzLl9ldmVudHNbdHlwZV0pcmV0dXJuIHRoaXM7bGlzdD10aGlzLl9ldmVudHNbdHlwZV07bGVuZ3RoPWxpc3QubGVuZ3RoO3Bvc2l0aW9uPS0xO2lmKGxpc3Q9PT1saXN0ZW5lcnx8aXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSYmbGlzdC5saXN0ZW5lcj09PWxpc3RlbmVyKXtkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO2lmKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil0aGlzLmVtaXQoXCJyZW1vdmVMaXN0ZW5lclwiLHR5cGUsbGlzdGVuZXIpfWVsc2UgaWYoaXNPYmplY3QobGlzdCkpe2ZvcihpPWxlbmd0aDtpLS0gPjA7KXtpZihsaXN0W2ldPT09bGlzdGVuZXJ8fGxpc3RbaV0ubGlzdGVuZXImJmxpc3RbaV0ubGlzdGVuZXI9PT1saXN0ZW5lcil7cG9zaXRpb249aTticmVha319aWYocG9zaXRpb248MClyZXR1cm4gdGhpcztpZihsaXN0Lmxlbmd0aD09PTEpe2xpc3QubGVuZ3RoPTA7ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXX1lbHNle2xpc3Quc3BsaWNlKHBvc2l0aW9uLDEpfWlmKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcil0aGlzLmVtaXQoXCJyZW1vdmVMaXN0ZW5lclwiLHR5cGUsbGlzdGVuZXIpfXJldHVybiB0aGlzfTtFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycz1mdW5jdGlvbih0eXBlKXt2YXIga2V5LGxpc3RlbmVycztpZighdGhpcy5fZXZlbnRzKXJldHVybiB0aGlzO2lmKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpe2lmKGFyZ3VtZW50cy5sZW5ndGg9PT0wKXRoaXMuX2V2ZW50cz17fTtlbHNlIGlmKHRoaXMuX2V2ZW50c1t0eXBlXSlkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO3JldHVybiB0aGlzfWlmKGFyZ3VtZW50cy5sZW5ndGg9PT0wKXtmb3Ioa2V5IGluIHRoaXMuX2V2ZW50cyl7aWYoa2V5PT09XCJyZW1vdmVMaXN0ZW5lclwiKWNvbnRpbnVlO3RoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSl9dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoXCJyZW1vdmVMaXN0ZW5lclwiKTt0aGlzLl9ldmVudHM9e307cmV0dXJuIHRoaXN9bGlzdGVuZXJzPXRoaXMuX2V2ZW50c1t0eXBlXTtpZihpc0Z1bmN0aW9uKGxpc3RlbmVycykpe3RoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSxsaXN0ZW5lcnMpfWVsc2UgaWYobGlzdGVuZXJzKXt3aGlsZShsaXN0ZW5lcnMubGVuZ3RoKXRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSxsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aC0xXSl9ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtyZXR1cm4gdGhpc307RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnM9ZnVuY3Rpb24odHlwZSl7dmFyIHJldDtpZighdGhpcy5fZXZlbnRzfHwhdGhpcy5fZXZlbnRzW3R5cGVdKXJldD1bXTtlbHNlIGlmKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlyZXQ9W3RoaXMuX2V2ZW50c1t0eXBlXV07ZWxzZSByZXQ9dGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7cmV0dXJuIHJldH07RXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50PWZ1bmN0aW9uKHR5cGUpe2lmKHRoaXMuX2V2ZW50cyl7dmFyIGV2bGlzdGVuZXI9dGhpcy5fZXZlbnRzW3R5cGVdO2lmKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpcmV0dXJuIDE7ZWxzZSBpZihldmxpc3RlbmVyKXJldHVybiBldmxpc3RlbmVyLmxlbmd0aH1yZXR1cm4gMH07RXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQ9ZnVuY3Rpb24oZW1pdHRlcix0eXBlKXtyZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpfTtmdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZyl7cmV0dXJuIHR5cGVvZiBhcmc9PT1cImZ1bmN0aW9uXCJ9ZnVuY3Rpb24gaXNOdW1iZXIoYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwibnVtYmVyXCJ9ZnVuY3Rpb24gaXNPYmplY3QoYXJnKXtyZXR1cm4gdHlwZW9mIGFyZz09PVwib2JqZWN0XCImJmFyZyE9PW51bGx9ZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKXtyZXR1cm4gYXJnPT09dm9pZCAwfX0se31dLDI6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBOZXVRdWFudD1yZXF1aXJlKFwiLi9UeXBlZE5ldVF1YW50LmpzXCIpO3ZhciBMWldFbmNvZGVyPXJlcXVpcmUoXCIuL0xaV0VuY29kZXIuanNcIik7ZnVuY3Rpb24gQnl0ZUFycmF5KCl7dGhpcy5wYWdlPS0xO3RoaXMucGFnZXM9W107dGhpcy5uZXdQYWdlKCl9Qnl0ZUFycmF5LnBhZ2VTaXplPTQwOTY7Qnl0ZUFycmF5LmNoYXJNYXA9e307Zm9yKHZhciBpPTA7aTwyNTY7aSsrKUJ5dGVBcnJheS5jaGFyTWFwW2ldPVN0cmluZy5mcm9tQ2hhckNvZGUoaSk7Qnl0ZUFycmF5LnByb3RvdHlwZS5uZXdQYWdlPWZ1bmN0aW9uKCl7dGhpcy5wYWdlc1srK3RoaXMucGFnZV09bmV3IFVpbnQ4QXJyYXkoQnl0ZUFycmF5LnBhZ2VTaXplKTt0aGlzLmN1cnNvcj0wfTtCeXRlQXJyYXkucHJvdG90eXBlLmdldERhdGE9ZnVuY3Rpb24oKXt2YXIgcnY9XCJcIjtmb3IodmFyIHA9MDtwPHRoaXMucGFnZXMubGVuZ3RoO3ArKyl7Zm9yKHZhciBpPTA7aTxCeXRlQXJyYXkucGFnZVNpemU7aSsrKXtydis9Qnl0ZUFycmF5LmNoYXJNYXBbdGhpcy5wYWdlc1twXVtpXV19fXJldHVybiBydn07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZUJ5dGU9ZnVuY3Rpb24odmFsKXtpZih0aGlzLmN1cnNvcj49Qnl0ZUFycmF5LnBhZ2VTaXplKXRoaXMubmV3UGFnZSgpO3RoaXMucGFnZXNbdGhpcy5wYWdlXVt0aGlzLmN1cnNvcisrXT12YWx9O0J5dGVBcnJheS5wcm90b3R5cGUud3JpdGVVVEZCeXRlcz1mdW5jdGlvbihzdHJpbmcpe2Zvcih2YXIgbD1zdHJpbmcubGVuZ3RoLGk9MDtpPGw7aSsrKXRoaXMud3JpdGVCeXRlKHN0cmluZy5jaGFyQ29kZUF0KGkpKX07Qnl0ZUFycmF5LnByb3RvdHlwZS53cml0ZUJ5dGVzPWZ1bmN0aW9uKGFycmF5LG9mZnNldCxsZW5ndGgpe2Zvcih2YXIgbD1sZW5ndGh8fGFycmF5Lmxlbmd0aCxpPW9mZnNldHx8MDtpPGw7aSsrKXRoaXMud3JpdGVCeXRlKGFycmF5W2ldKX07ZnVuY3Rpb24gR0lGRW5jb2Rlcih3aWR0aCxoZWlnaHQpe3RoaXMud2lkdGg9fn53aWR0aDt0aGlzLmhlaWdodD1+fmhlaWdodDt0aGlzLnRyYW5zcGFyZW50PW51bGw7dGhpcy50cmFuc0luZGV4PTA7dGhpcy5yZXBlYXQ9LTE7dGhpcy5kZWxheT0wO3RoaXMuaW1hZ2U9bnVsbDt0aGlzLnBpeGVscz1udWxsO3RoaXMuaW5kZXhlZFBpeGVscz1udWxsO3RoaXMuY29sb3JEZXB0aD1udWxsO3RoaXMuY29sb3JUYWI9bnVsbDt0aGlzLm5ldVF1YW50PW51bGw7dGhpcy51c2VkRW50cnk9bmV3IEFycmF5O3RoaXMucGFsU2l6ZT03O3RoaXMuZGlzcG9zZT0tMTt0aGlzLmZpcnN0RnJhbWU9dHJ1ZTt0aGlzLnNhbXBsZT0xMDt0aGlzLmRpdGhlcj1mYWxzZTt0aGlzLmdsb2JhbFBhbGV0dGU9ZmFsc2U7dGhpcy5vdXQ9bmV3IEJ5dGVBcnJheX1HSUZFbmNvZGVyLnByb3RvdHlwZS5zZXREZWxheT1mdW5jdGlvbihtaWxsaXNlY29uZHMpe3RoaXMuZGVsYXk9TWF0aC5yb3VuZChtaWxsaXNlY29uZHMvMTApfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRGcmFtZVJhdGU9ZnVuY3Rpb24oZnBzKXt0aGlzLmRlbGF5PU1hdGgucm91bmQoMTAwL2Zwcyl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldERpc3Bvc2U9ZnVuY3Rpb24oZGlzcG9zYWxDb2RlKXtpZihkaXNwb3NhbENvZGU+PTApdGhpcy5kaXNwb3NlPWRpc3Bvc2FsQ29kZX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc2V0UmVwZWF0PWZ1bmN0aW9uKHJlcGVhdCl7dGhpcy5yZXBlYXQ9cmVwZWF0fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRUcmFuc3BhcmVudD1mdW5jdGlvbihjb2xvcil7dGhpcy50cmFuc3BhcmVudD1jb2xvcn07R0lGRW5jb2Rlci5wcm90b3R5cGUuYWRkRnJhbWU9ZnVuY3Rpb24oaW1hZ2VEYXRhKXt0aGlzLmltYWdlPWltYWdlRGF0YTt0aGlzLmNvbG9yVGFiPXRoaXMuZ2xvYmFsUGFsZXR0ZSYmdGhpcy5nbG9iYWxQYWxldHRlLnNsaWNlP3RoaXMuZ2xvYmFsUGFsZXR0ZTpudWxsO3RoaXMuZ2V0SW1hZ2VQaXhlbHMoKTt0aGlzLmFuYWx5emVQaXhlbHMoKTtpZih0aGlzLmdsb2JhbFBhbGV0dGU9PT10cnVlKXRoaXMuZ2xvYmFsUGFsZXR0ZT10aGlzLmNvbG9yVGFiO2lmKHRoaXMuZmlyc3RGcmFtZSl7dGhpcy53cml0ZUxTRCgpO3RoaXMud3JpdGVQYWxldHRlKCk7aWYodGhpcy5yZXBlYXQ+PTApe3RoaXMud3JpdGVOZXRzY2FwZUV4dCgpfX10aGlzLndyaXRlR3JhcGhpY0N0cmxFeHQoKTt0aGlzLndyaXRlSW1hZ2VEZXNjKCk7aWYoIXRoaXMuZmlyc3RGcmFtZSYmIXRoaXMuZ2xvYmFsUGFsZXR0ZSl0aGlzLndyaXRlUGFsZXR0ZSgpO3RoaXMud3JpdGVQaXhlbHMoKTt0aGlzLmZpcnN0RnJhbWU9ZmFsc2V9O0dJRkVuY29kZXIucHJvdG90eXBlLmZpbmlzaD1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZSg1OSl9O0dJRkVuY29kZXIucHJvdG90eXBlLnNldFF1YWxpdHk9ZnVuY3Rpb24ocXVhbGl0eSl7aWYocXVhbGl0eTwxKXF1YWxpdHk9MTt0aGlzLnNhbXBsZT1xdWFsaXR5fTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXREaXRoZXI9ZnVuY3Rpb24oZGl0aGVyKXtpZihkaXRoZXI9PT10cnVlKWRpdGhlcj1cIkZsb3lkU3RlaW5iZXJnXCI7dGhpcy5kaXRoZXI9ZGl0aGVyfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5zZXRHbG9iYWxQYWxldHRlPWZ1bmN0aW9uKHBhbGV0dGUpe3RoaXMuZ2xvYmFsUGFsZXR0ZT1wYWxldHRlfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5nZXRHbG9iYWxQYWxldHRlPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZ2xvYmFsUGFsZXR0ZSYmdGhpcy5nbG9iYWxQYWxldHRlLnNsaWNlJiZ0aGlzLmdsb2JhbFBhbGV0dGUuc2xpY2UoMCl8fHRoaXMuZ2xvYmFsUGFsZXR0ZX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVIZWFkZXI9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZVVURkJ5dGVzKFwiR0lGODlhXCIpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5hbmFseXplUGl4ZWxzPWZ1bmN0aW9uKCl7aWYoIXRoaXMuY29sb3JUYWIpe3RoaXMubmV1UXVhbnQ9bmV3IE5ldVF1YW50KHRoaXMucGl4ZWxzLHRoaXMuc2FtcGxlKTt0aGlzLm5ldVF1YW50LmJ1aWxkQ29sb3JtYXAoKTt0aGlzLmNvbG9yVGFiPXRoaXMubmV1UXVhbnQuZ2V0Q29sb3JtYXAoKX1pZih0aGlzLmRpdGhlcil7dGhpcy5kaXRoZXJQaXhlbHModGhpcy5kaXRoZXIucmVwbGFjZShcIi1zZXJwZW50aW5lXCIsXCJcIiksdGhpcy5kaXRoZXIubWF0Y2goLy1zZXJwZW50aW5lLykhPT1udWxsKX1lbHNle3RoaXMuaW5kZXhQaXhlbHMoKX10aGlzLnBpeGVscz1udWxsO3RoaXMuY29sb3JEZXB0aD04O3RoaXMucGFsU2l6ZT03O2lmKHRoaXMudHJhbnNwYXJlbnQhPT1udWxsKXt0aGlzLnRyYW5zSW5kZXg9dGhpcy5maW5kQ2xvc2VzdCh0aGlzLnRyYW5zcGFyZW50LHRydWUpfX07R0lGRW5jb2Rlci5wcm90b3R5cGUuaW5kZXhQaXhlbHM9ZnVuY3Rpb24oaW1ncSl7dmFyIG5QaXg9dGhpcy5waXhlbHMubGVuZ3RoLzM7dGhpcy5pbmRleGVkUGl4ZWxzPW5ldyBVaW50OEFycmF5KG5QaXgpO3ZhciBrPTA7Zm9yKHZhciBqPTA7ajxuUGl4O2orKyl7dmFyIGluZGV4PXRoaXMuZmluZENsb3Nlc3RSR0IodGhpcy5waXhlbHNbaysrXSYyNTUsdGhpcy5waXhlbHNbaysrXSYyNTUsdGhpcy5waXhlbHNbaysrXSYyNTUpO3RoaXMudXNlZEVudHJ5W2luZGV4XT10cnVlO3RoaXMuaW5kZXhlZFBpeGVsc1tqXT1pbmRleH19O0dJRkVuY29kZXIucHJvdG90eXBlLmRpdGhlclBpeGVscz1mdW5jdGlvbihrZXJuZWwsc2VycGVudGluZSl7dmFyIGtlcm5lbHM9e0ZhbHNlRmxveWRTdGVpbmJlcmc6W1szLzgsMSwwXSxbMy84LDAsMV0sWzIvOCwxLDFdXSxGbG95ZFN0ZWluYmVyZzpbWzcvMTYsMSwwXSxbMy8xNiwtMSwxXSxbNS8xNiwwLDFdLFsxLzE2LDEsMV1dLFN0dWNraTpbWzgvNDIsMSwwXSxbNC80MiwyLDBdLFsyLzQyLC0yLDFdLFs0LzQyLC0xLDFdLFs4LzQyLDAsMV0sWzQvNDIsMSwxXSxbMi80MiwyLDFdLFsxLzQyLC0yLDJdLFsyLzQyLC0xLDJdLFs0LzQyLDAsMl0sWzIvNDIsMSwyXSxbMS80MiwyLDJdXSxBdGtpbnNvbjpbWzEvOCwxLDBdLFsxLzgsMiwwXSxbMS84LC0xLDFdLFsxLzgsMCwxXSxbMS84LDEsMV0sWzEvOCwwLDJdXX07aWYoIWtlcm5lbHx8IWtlcm5lbHNba2VybmVsXSl7dGhyb3dcIlVua25vd24gZGl0aGVyaW5nIGtlcm5lbDogXCIra2VybmVsfXZhciBkcz1rZXJuZWxzW2tlcm5lbF07dmFyIGluZGV4PTAsaGVpZ2h0PXRoaXMuaGVpZ2h0LHdpZHRoPXRoaXMud2lkdGgsZGF0YT10aGlzLnBpeGVsczt2YXIgZGlyZWN0aW9uPXNlcnBlbnRpbmU/LTE6MTt0aGlzLmluZGV4ZWRQaXhlbHM9bmV3IFVpbnQ4QXJyYXkodGhpcy5waXhlbHMubGVuZ3RoLzMpO2Zvcih2YXIgeT0wO3k8aGVpZ2h0O3krKyl7aWYoc2VycGVudGluZSlkaXJlY3Rpb249ZGlyZWN0aW9uKi0xO2Zvcih2YXIgeD1kaXJlY3Rpb249PTE/MDp3aWR0aC0xLHhlbmQ9ZGlyZWN0aW9uPT0xP3dpZHRoOjA7eCE9PXhlbmQ7eCs9ZGlyZWN0aW9uKXtpbmRleD15KndpZHRoK3g7dmFyIGlkeD1pbmRleCozO3ZhciByMT1kYXRhW2lkeF07dmFyIGcxPWRhdGFbaWR4KzFdO3ZhciBiMT1kYXRhW2lkeCsyXTtpZHg9dGhpcy5maW5kQ2xvc2VzdFJHQihyMSxnMSxiMSk7dGhpcy51c2VkRW50cnlbaWR4XT10cnVlO3RoaXMuaW5kZXhlZFBpeGVsc1tpbmRleF09aWR4O2lkeCo9Mzt2YXIgcjI9dGhpcy5jb2xvclRhYltpZHhdO3ZhciBnMj10aGlzLmNvbG9yVGFiW2lkeCsxXTt2YXIgYjI9dGhpcy5jb2xvclRhYltpZHgrMl07dmFyIGVyPXIxLXIyO3ZhciBlZz1nMS1nMjt2YXIgZWI9YjEtYjI7Zm9yKHZhciBpPWRpcmVjdGlvbj09MT8wOmRzLmxlbmd0aC0xLGVuZD1kaXJlY3Rpb249PTE/ZHMubGVuZ3RoOjA7aSE9PWVuZDtpKz1kaXJlY3Rpb24pe3ZhciB4MT1kc1tpXVsxXTt2YXIgeTE9ZHNbaV1bMl07aWYoeDEreD49MCYmeDEreDx3aWR0aCYmeTEreT49MCYmeTEreTxoZWlnaHQpe3ZhciBkPWRzW2ldWzBdO2lkeD1pbmRleCt4MSt5MSp3aWR0aDtpZHgqPTM7ZGF0YVtpZHhdPU1hdGgubWF4KDAsTWF0aC5taW4oMjU1LGRhdGFbaWR4XStlcipkKSk7ZGF0YVtpZHgrMV09TWF0aC5tYXgoMCxNYXRoLm1pbigyNTUsZGF0YVtpZHgrMV0rZWcqZCkpO2RhdGFbaWR4KzJdPU1hdGgubWF4KDAsTWF0aC5taW4oMjU1LGRhdGFbaWR4KzJdK2ViKmQpKX19fX19O0dJRkVuY29kZXIucHJvdG90eXBlLmZpbmRDbG9zZXN0PWZ1bmN0aW9uKGMsdXNlZCl7cmV0dXJuIHRoaXMuZmluZENsb3Nlc3RSR0IoKGMmMTY3MTE2ODApPj4xNiwoYyY2NTI4MCk+PjgsYyYyNTUsdXNlZCl9O0dJRkVuY29kZXIucHJvdG90eXBlLmZpbmRDbG9zZXN0UkdCPWZ1bmN0aW9uKHIsZyxiLHVzZWQpe2lmKHRoaXMuY29sb3JUYWI9PT1udWxsKXJldHVybi0xO2lmKHRoaXMubmV1UXVhbnQmJiF1c2VkKXtyZXR1cm4gdGhpcy5uZXVRdWFudC5sb29rdXBSR0IocixnLGIpfXZhciBjPWJ8Zzw8OHxyPDwxNjt2YXIgbWlucG9zPTA7dmFyIGRtaW49MjU2KjI1NioyNTY7dmFyIGxlbj10aGlzLmNvbG9yVGFiLmxlbmd0aDtmb3IodmFyIGk9MCxpbmRleD0wO2k8bGVuO2luZGV4Kyspe3ZhciBkcj1yLSh0aGlzLmNvbG9yVGFiW2krK10mMjU1KTt2YXIgZGc9Zy0odGhpcy5jb2xvclRhYltpKytdJjI1NSk7dmFyIGRiPWItKHRoaXMuY29sb3JUYWJbaSsrXSYyNTUpO3ZhciBkPWRyKmRyK2RnKmRnK2RiKmRiO2lmKCghdXNlZHx8dGhpcy51c2VkRW50cnlbaW5kZXhdKSYmZDxkbWluKXtkbWluPWQ7bWlucG9zPWluZGV4fX1yZXR1cm4gbWlucG9zfTtHSUZFbmNvZGVyLnByb3RvdHlwZS5nZXRJbWFnZVBpeGVscz1mdW5jdGlvbigpe3ZhciB3PXRoaXMud2lkdGg7dmFyIGg9dGhpcy5oZWlnaHQ7dGhpcy5waXhlbHM9bmV3IFVpbnQ4QXJyYXkodypoKjMpO3ZhciBkYXRhPXRoaXMuaW1hZ2U7dmFyIHNyY1Bvcz0wO3ZhciBjb3VudD0wO2Zvcih2YXIgaT0wO2k8aDtpKyspe2Zvcih2YXIgaj0wO2o8dztqKyspe3RoaXMucGl4ZWxzW2NvdW50KytdPWRhdGFbc3JjUG9zKytdO3RoaXMucGl4ZWxzW2NvdW50KytdPWRhdGFbc3JjUG9zKytdO3RoaXMucGl4ZWxzW2NvdW50KytdPWRhdGFbc3JjUG9zKytdO3NyY1BvcysrfX19O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlR3JhcGhpY0N0cmxFeHQ9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoMzMpO3RoaXMub3V0LndyaXRlQnl0ZSgyNDkpO3RoaXMub3V0LndyaXRlQnl0ZSg0KTt2YXIgdHJhbnNwLGRpc3A7aWYodGhpcy50cmFuc3BhcmVudD09PW51bGwpe3RyYW5zcD0wO2Rpc3A9MH1lbHNle3RyYW5zcD0xO2Rpc3A9Mn1pZih0aGlzLmRpc3Bvc2U+PTApe2Rpc3A9dGhpcy5kaXNwb3NlJjd9ZGlzcDw8PTI7dGhpcy5vdXQud3JpdGVCeXRlKDB8ZGlzcHwwfHRyYW5zcCk7dGhpcy53cml0ZVNob3J0KHRoaXMuZGVsYXkpO3RoaXMub3V0LndyaXRlQnl0ZSh0aGlzLnRyYW5zSW5kZXgpO3RoaXMub3V0LndyaXRlQnl0ZSgwKX07R0lGRW5jb2Rlci5wcm90b3R5cGUud3JpdGVJbWFnZURlc2M9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoNDQpO3RoaXMud3JpdGVTaG9ydCgwKTt0aGlzLndyaXRlU2hvcnQoMCk7dGhpcy53cml0ZVNob3J0KHRoaXMud2lkdGgpO3RoaXMud3JpdGVTaG9ydCh0aGlzLmhlaWdodCk7aWYodGhpcy5maXJzdEZyYW1lfHx0aGlzLmdsb2JhbFBhbGV0dGUpe3RoaXMub3V0LndyaXRlQnl0ZSgwKX1lbHNle3RoaXMub3V0LndyaXRlQnl0ZSgxMjh8MHwwfDB8dGhpcy5wYWxTaXplKX19O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlTFNEPWZ1bmN0aW9uKCl7dGhpcy53cml0ZVNob3J0KHRoaXMud2lkdGgpO3RoaXMud3JpdGVTaG9ydCh0aGlzLmhlaWdodCk7dGhpcy5vdXQud3JpdGVCeXRlKDEyOHwxMTJ8MHx0aGlzLnBhbFNpemUpO3RoaXMub3V0LndyaXRlQnl0ZSgwKTt0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlTmV0c2NhcGVFeHQ9ZnVuY3Rpb24oKXt0aGlzLm91dC53cml0ZUJ5dGUoMzMpO3RoaXMub3V0LndyaXRlQnl0ZSgyNTUpO3RoaXMub3V0LndyaXRlQnl0ZSgxMSk7dGhpcy5vdXQud3JpdGVVVEZCeXRlcyhcIk5FVFNDQVBFMi4wXCIpO3RoaXMub3V0LndyaXRlQnl0ZSgzKTt0aGlzLm91dC53cml0ZUJ5dGUoMSk7dGhpcy53cml0ZVNob3J0KHRoaXMucmVwZWF0KTt0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlUGFsZXR0ZT1mdW5jdGlvbigpe3RoaXMub3V0LndyaXRlQnl0ZXModGhpcy5jb2xvclRhYik7dmFyIG49MyoyNTYtdGhpcy5jb2xvclRhYi5sZW5ndGg7Zm9yKHZhciBpPTA7aTxuO2krKyl0aGlzLm91dC53cml0ZUJ5dGUoMCl9O0dJRkVuY29kZXIucHJvdG90eXBlLndyaXRlU2hvcnQ9ZnVuY3Rpb24ocFZhbHVlKXt0aGlzLm91dC53cml0ZUJ5dGUocFZhbHVlJjI1NSk7dGhpcy5vdXQud3JpdGVCeXRlKHBWYWx1ZT4+OCYyNTUpfTtHSUZFbmNvZGVyLnByb3RvdHlwZS53cml0ZVBpeGVscz1mdW5jdGlvbigpe3ZhciBlbmM9bmV3IExaV0VuY29kZXIodGhpcy53aWR0aCx0aGlzLmhlaWdodCx0aGlzLmluZGV4ZWRQaXhlbHMsdGhpcy5jb2xvckRlcHRoKTtlbmMuZW5jb2RlKHRoaXMub3V0KX07R0lGRW5jb2Rlci5wcm90b3R5cGUuc3RyZWFtPWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMub3V0fTttb2R1bGUuZXhwb3J0cz1HSUZFbmNvZGVyfSx7XCIuL0xaV0VuY29kZXIuanNcIjozLFwiLi9UeXBlZE5ldVF1YW50LmpzXCI6NH1dLDM6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBFT0Y9LTE7dmFyIEJJVFM9MTI7dmFyIEhTSVpFPTUwMDM7dmFyIG1hc2tzPVswLDEsMyw3LDE1LDMxLDYzLDEyNywyNTUsNTExLDEwMjMsMjA0Nyw0MDk1LDgxOTEsMTYzODMsMzI3NjcsNjU1MzVdO2Z1bmN0aW9uIExaV0VuY29kZXIod2lkdGgsaGVpZ2h0LHBpeGVscyxjb2xvckRlcHRoKXt2YXIgaW5pdENvZGVTaXplPU1hdGgubWF4KDIsY29sb3JEZXB0aCk7dmFyIGFjY3VtPW5ldyBVaW50OEFycmF5KDI1Nik7dmFyIGh0YWI9bmV3IEludDMyQXJyYXkoSFNJWkUpO3ZhciBjb2RldGFiPW5ldyBJbnQzMkFycmF5KEhTSVpFKTt2YXIgY3VyX2FjY3VtLGN1cl9iaXRzPTA7dmFyIGFfY291bnQ7dmFyIGZyZWVfZW50PTA7dmFyIG1heGNvZGU7dmFyIGNsZWFyX2ZsZz1mYWxzZTt2YXIgZ19pbml0X2JpdHMsQ2xlYXJDb2RlLEVPRkNvZGU7ZnVuY3Rpb24gY2hhcl9vdXQoYyxvdXRzKXthY2N1bVthX2NvdW50KytdPWM7aWYoYV9jb3VudD49MjU0KWZsdXNoX2NoYXIob3V0cyl9ZnVuY3Rpb24gY2xfYmxvY2sob3V0cyl7Y2xfaGFzaChIU0laRSk7ZnJlZV9lbnQ9Q2xlYXJDb2RlKzI7Y2xlYXJfZmxnPXRydWU7b3V0cHV0KENsZWFyQ29kZSxvdXRzKX1mdW5jdGlvbiBjbF9oYXNoKGhzaXplKXtmb3IodmFyIGk9MDtpPGhzaXplOysraSlodGFiW2ldPS0xfWZ1bmN0aW9uIGNvbXByZXNzKGluaXRfYml0cyxvdXRzKXt2YXIgZmNvZGUsYyxpLGVudCxkaXNwLGhzaXplX3JlZyxoc2hpZnQ7Z19pbml0X2JpdHM9aW5pdF9iaXRzO2NsZWFyX2ZsZz1mYWxzZTtuX2JpdHM9Z19pbml0X2JpdHM7bWF4Y29kZT1NQVhDT0RFKG5fYml0cyk7Q2xlYXJDb2RlPTE8PGluaXRfYml0cy0xO0VPRkNvZGU9Q2xlYXJDb2RlKzE7ZnJlZV9lbnQ9Q2xlYXJDb2RlKzI7YV9jb3VudD0wO2VudD1uZXh0UGl4ZWwoKTtoc2hpZnQ9MDtmb3IoZmNvZGU9SFNJWkU7ZmNvZGU8NjU1MzY7ZmNvZGUqPTIpKytoc2hpZnQ7aHNoaWZ0PTgtaHNoaWZ0O2hzaXplX3JlZz1IU0laRTtjbF9oYXNoKGhzaXplX3JlZyk7b3V0cHV0KENsZWFyQ29kZSxvdXRzKTtvdXRlcl9sb29wOndoaWxlKChjPW5leHRQaXhlbCgpKSE9RU9GKXtmY29kZT0oYzw8QklUUykrZW50O2k9Yzw8aHNoaWZ0XmVudDtpZihodGFiW2ldPT09ZmNvZGUpe2VudD1jb2RldGFiW2ldO2NvbnRpbnVlfWVsc2UgaWYoaHRhYltpXT49MCl7ZGlzcD1oc2l6ZV9yZWctaTtpZihpPT09MClkaXNwPTE7ZG97aWYoKGktPWRpc3ApPDApaSs9aHNpemVfcmVnO2lmKGh0YWJbaV09PT1mY29kZSl7ZW50PWNvZGV0YWJbaV07Y29udGludWUgb3V0ZXJfbG9vcH19d2hpbGUoaHRhYltpXT49MCl9b3V0cHV0KGVudCxvdXRzKTtlbnQ9YztpZihmcmVlX2VudDwxPDxCSVRTKXtjb2RldGFiW2ldPWZyZWVfZW50Kys7aHRhYltpXT1mY29kZX1lbHNle2NsX2Jsb2NrKG91dHMpfX1vdXRwdXQoZW50LG91dHMpO291dHB1dChFT0ZDb2RlLG91dHMpfWZ1bmN0aW9uIGVuY29kZShvdXRzKXtvdXRzLndyaXRlQnl0ZShpbml0Q29kZVNpemUpO3JlbWFpbmluZz13aWR0aCpoZWlnaHQ7Y3VyUGl4ZWw9MDtjb21wcmVzcyhpbml0Q29kZVNpemUrMSxvdXRzKTtvdXRzLndyaXRlQnl0ZSgwKX1mdW5jdGlvbiBmbHVzaF9jaGFyKG91dHMpe2lmKGFfY291bnQ+MCl7b3V0cy53cml0ZUJ5dGUoYV9jb3VudCk7b3V0cy53cml0ZUJ5dGVzKGFjY3VtLDAsYV9jb3VudCk7YV9jb3VudD0wfX1mdW5jdGlvbiBNQVhDT0RFKG5fYml0cyl7cmV0dXJuKDE8PG5fYml0cyktMX1mdW5jdGlvbiBuZXh0UGl4ZWwoKXtpZihyZW1haW5pbmc9PT0wKXJldHVybiBFT0Y7LS1yZW1haW5pbmc7dmFyIHBpeD1waXhlbHNbY3VyUGl4ZWwrK107cmV0dXJuIHBpeCYyNTV9ZnVuY3Rpb24gb3V0cHV0KGNvZGUsb3V0cyl7Y3VyX2FjY3VtJj1tYXNrc1tjdXJfYml0c107aWYoY3VyX2JpdHM+MCljdXJfYWNjdW18PWNvZGU8PGN1cl9iaXRzO2Vsc2UgY3VyX2FjY3VtPWNvZGU7Y3VyX2JpdHMrPW5fYml0czt3aGlsZShjdXJfYml0cz49OCl7Y2hhcl9vdXQoY3VyX2FjY3VtJjI1NSxvdXRzKTtjdXJfYWNjdW0+Pj04O2N1cl9iaXRzLT04fWlmKGZyZWVfZW50Pm1heGNvZGV8fGNsZWFyX2ZsZyl7aWYoY2xlYXJfZmxnKXttYXhjb2RlPU1BWENPREUobl9iaXRzPWdfaW5pdF9iaXRzKTtjbGVhcl9mbGc9ZmFsc2V9ZWxzZXsrK25fYml0cztpZihuX2JpdHM9PUJJVFMpbWF4Y29kZT0xPDxCSVRTO2Vsc2UgbWF4Y29kZT1NQVhDT0RFKG5fYml0cyl9fWlmKGNvZGU9PUVPRkNvZGUpe3doaWxlKGN1cl9iaXRzPjApe2NoYXJfb3V0KGN1cl9hY2N1bSYyNTUsb3V0cyk7Y3VyX2FjY3VtPj49ODtjdXJfYml0cy09OH1mbHVzaF9jaGFyKG91dHMpfX10aGlzLmVuY29kZT1lbmNvZGV9bW9kdWxlLmV4cG9ydHM9TFpXRW5jb2Rlcn0se31dLDQ6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe3ZhciBuY3ljbGVzPTEwMDt2YXIgbmV0c2l6ZT0yNTY7dmFyIG1heG5ldHBvcz1uZXRzaXplLTE7dmFyIG5ldGJpYXNzaGlmdD00O3ZhciBpbnRiaWFzc2hpZnQ9MTY7dmFyIGludGJpYXM9MTw8aW50Ymlhc3NoaWZ0O3ZhciBnYW1tYXNoaWZ0PTEwO3ZhciBnYW1tYT0xPDxnYW1tYXNoaWZ0O3ZhciBiZXRhc2hpZnQ9MTA7dmFyIGJldGE9aW50Ymlhcz4+YmV0YXNoaWZ0O3ZhciBiZXRhZ2FtbWE9aW50Ymlhczw8Z2FtbWFzaGlmdC1iZXRhc2hpZnQ7dmFyIGluaXRyYWQ9bmV0c2l6ZT4+Mzt2YXIgcmFkaXVzYmlhc3NoaWZ0PTY7dmFyIHJhZGl1c2JpYXM9MTw8cmFkaXVzYmlhc3NoaWZ0O3ZhciBpbml0cmFkaXVzPWluaXRyYWQqcmFkaXVzYmlhczt2YXIgcmFkaXVzZGVjPTMwO3ZhciBhbHBoYWJpYXNzaGlmdD0xMDt2YXIgaW5pdGFscGhhPTE8PGFscGhhYmlhc3NoaWZ0O3ZhciBhbHBoYWRlYzt2YXIgcmFkYmlhc3NoaWZ0PTg7dmFyIHJhZGJpYXM9MTw8cmFkYmlhc3NoaWZ0O3ZhciBhbHBoYXJhZGJzaGlmdD1hbHBoYWJpYXNzaGlmdCtyYWRiaWFzc2hpZnQ7dmFyIGFscGhhcmFkYmlhcz0xPDxhbHBoYXJhZGJzaGlmdDt2YXIgcHJpbWUxPTQ5OTt2YXIgcHJpbWUyPTQ5MTt2YXIgcHJpbWUzPTQ4Nzt2YXIgcHJpbWU0PTUwMzt2YXIgbWlucGljdHVyZWJ5dGVzPTMqcHJpbWU0O2Z1bmN0aW9uIE5ldVF1YW50KHBpeGVscyxzYW1wbGVmYWMpe3ZhciBuZXR3b3JrO3ZhciBuZXRpbmRleDt2YXIgYmlhczt2YXIgZnJlcTt2YXIgcmFkcG93ZXI7ZnVuY3Rpb24gaW5pdCgpe25ldHdvcms9W107bmV0aW5kZXg9bmV3IEludDMyQXJyYXkoMjU2KTtiaWFzPW5ldyBJbnQzMkFycmF5KG5ldHNpemUpO2ZyZXE9bmV3IEludDMyQXJyYXkobmV0c2l6ZSk7cmFkcG93ZXI9bmV3IEludDMyQXJyYXkobmV0c2l6ZT4+Myk7dmFyIGksdjtmb3IoaT0wO2k8bmV0c2l6ZTtpKyspe3Y9KGk8PG5ldGJpYXNzaGlmdCs4KS9uZXRzaXplO25ldHdvcmtbaV09bmV3IEZsb2F0NjRBcnJheShbdix2LHYsMF0pO2ZyZXFbaV09aW50Ymlhcy9uZXRzaXplO2JpYXNbaV09MH19ZnVuY3Rpb24gdW5iaWFzbmV0KCl7Zm9yKHZhciBpPTA7aTxuZXRzaXplO2krKyl7bmV0d29ya1tpXVswXT4+PW5ldGJpYXNzaGlmdDtuZXR3b3JrW2ldWzFdPj49bmV0Ymlhc3NoaWZ0O25ldHdvcmtbaV1bMl0+Pj1uZXRiaWFzc2hpZnQ7bmV0d29ya1tpXVszXT1pfX1mdW5jdGlvbiBhbHRlcnNpbmdsZShhbHBoYSxpLGIsZyxyKXtuZXR3b3JrW2ldWzBdLT1hbHBoYSoobmV0d29ya1tpXVswXS1iKS9pbml0YWxwaGE7bmV0d29ya1tpXVsxXS09YWxwaGEqKG5ldHdvcmtbaV1bMV0tZykvaW5pdGFscGhhO25ldHdvcmtbaV1bMl0tPWFscGhhKihuZXR3b3JrW2ldWzJdLXIpL2luaXRhbHBoYX1mdW5jdGlvbiBhbHRlcm5laWdoKHJhZGl1cyxpLGIsZyxyKXt2YXIgbG89TWF0aC5hYnMoaS1yYWRpdXMpO3ZhciBoaT1NYXRoLm1pbihpK3JhZGl1cyxuZXRzaXplKTt2YXIgaj1pKzE7dmFyIGs9aS0xO3ZhciBtPTE7dmFyIHAsYTt3aGlsZShqPGhpfHxrPmxvKXthPXJhZHBvd2VyW20rK107aWYoajxoaSl7cD1uZXR3b3JrW2orK107cFswXS09YSoocFswXS1iKS9hbHBoYXJhZGJpYXM7cFsxXS09YSoocFsxXS1nKS9hbHBoYXJhZGJpYXM7cFsyXS09YSoocFsyXS1yKS9hbHBoYXJhZGJpYXN9aWYoaz5sbyl7cD1uZXR3b3JrW2stLV07cFswXS09YSoocFswXS1iKS9hbHBoYXJhZGJpYXM7cFsxXS09YSoocFsxXS1nKS9hbHBoYXJhZGJpYXM7cFsyXS09YSoocFsyXS1yKS9hbHBoYXJhZGJpYXN9fX1mdW5jdGlvbiBjb250ZXN0KGIsZyxyKXt2YXIgYmVzdGQ9figxPDwzMSk7dmFyIGJlc3RiaWFzZD1iZXN0ZDt2YXIgYmVzdHBvcz0tMTt2YXIgYmVzdGJpYXNwb3M9YmVzdHBvczt2YXIgaSxuLGRpc3QsYmlhc2Rpc3QsYmV0YWZyZXE7Zm9yKGk9MDtpPG5ldHNpemU7aSsrKXtuPW5ldHdvcmtbaV07ZGlzdD1NYXRoLmFicyhuWzBdLWIpK01hdGguYWJzKG5bMV0tZykrTWF0aC5hYnMoblsyXS1yKTtpZihkaXN0PGJlc3RkKXtiZXN0ZD1kaXN0O2Jlc3Rwb3M9aX1iaWFzZGlzdD1kaXN0LShiaWFzW2ldPj5pbnRiaWFzc2hpZnQtbmV0Ymlhc3NoaWZ0KTtpZihiaWFzZGlzdDxiZXN0Ymlhc2Qpe2Jlc3RiaWFzZD1iaWFzZGlzdDtiZXN0Ymlhc3Bvcz1pfWJldGFmcmVxPWZyZXFbaV0+PmJldGFzaGlmdDtmcmVxW2ldLT1iZXRhZnJlcTtiaWFzW2ldKz1iZXRhZnJlcTw8Z2FtbWFzaGlmdH1mcmVxW2Jlc3Rwb3NdKz1iZXRhO2JpYXNbYmVzdHBvc10tPWJldGFnYW1tYTtyZXR1cm4gYmVzdGJpYXNwb3N9ZnVuY3Rpb24gaW54YnVpbGQoKXt2YXIgaSxqLHAscSxzbWFsbHBvcyxzbWFsbHZhbCxwcmV2aW91c2NvbD0wLHN0YXJ0cG9zPTA7Zm9yKGk9MDtpPG5ldHNpemU7aSsrKXtwPW5ldHdvcmtbaV07c21hbGxwb3M9aTtzbWFsbHZhbD1wWzFdO2ZvcihqPWkrMTtqPG5ldHNpemU7aisrKXtxPW5ldHdvcmtbal07aWYocVsxXTxzbWFsbHZhbCl7c21hbGxwb3M9ajtzbWFsbHZhbD1xWzFdfX1xPW5ldHdvcmtbc21hbGxwb3NdO2lmKGkhPXNtYWxscG9zKXtqPXFbMF07cVswXT1wWzBdO3BbMF09ajtqPXFbMV07cVsxXT1wWzFdO3BbMV09ajtqPXFbMl07cVsyXT1wWzJdO3BbMl09ajtqPXFbM107cVszXT1wWzNdO3BbM109an1pZihzbWFsbHZhbCE9cHJldmlvdXNjb2wpe25ldGluZGV4W3ByZXZpb3VzY29sXT1zdGFydHBvcytpPj4xO2ZvcihqPXByZXZpb3VzY29sKzE7ajxzbWFsbHZhbDtqKyspbmV0aW5kZXhbal09aTtwcmV2aW91c2NvbD1zbWFsbHZhbDtzdGFydHBvcz1pfX1uZXRpbmRleFtwcmV2aW91c2NvbF09c3RhcnRwb3MrbWF4bmV0cG9zPj4xO2ZvcihqPXByZXZpb3VzY29sKzE7ajwyNTY7aisrKW5ldGluZGV4W2pdPW1heG5ldHBvc31mdW5jdGlvbiBpbnhzZWFyY2goYixnLHIpe3ZhciBhLHAsZGlzdDt2YXIgYmVzdGQ9MWUzO3ZhciBiZXN0PS0xO3ZhciBpPW5ldGluZGV4W2ddO3ZhciBqPWktMTt3aGlsZShpPG5ldHNpemV8fGo+PTApe2lmKGk8bmV0c2l6ZSl7cD1uZXR3b3JrW2ldO2Rpc3Q9cFsxXS1nO2lmKGRpc3Q+PWJlc3RkKWk9bmV0c2l6ZTtlbHNle2krKztpZihkaXN0PDApZGlzdD0tZGlzdDthPXBbMF0tYjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2E9cFsyXS1yO2lmKGE8MClhPS1hO2Rpc3QrPWE7aWYoZGlzdDxiZXN0ZCl7YmVzdGQ9ZGlzdDtiZXN0PXBbM119fX19aWYoaj49MCl7cD1uZXR3b3JrW2pdO2Rpc3Q9Zy1wWzFdO2lmKGRpc3Q+PWJlc3RkKWo9LTE7ZWxzZXtqLS07aWYoZGlzdDwwKWRpc3Q9LWRpc3Q7YT1wWzBdLWI7aWYoYTwwKWE9LWE7ZGlzdCs9YTtpZihkaXN0PGJlc3RkKXthPXBbMl0tcjtpZihhPDApYT0tYTtkaXN0Kz1hO2lmKGRpc3Q8YmVzdGQpe2Jlc3RkPWRpc3Q7YmVzdD1wWzNdfX19fX1yZXR1cm4gYmVzdH1mdW5jdGlvbiBsZWFybigpe3ZhciBpO3ZhciBsZW5ndGhjb3VudD1waXhlbHMubGVuZ3RoO3ZhciBhbHBoYWRlYz0zMCsoc2FtcGxlZmFjLTEpLzM7dmFyIHNhbXBsZXBpeGVscz1sZW5ndGhjb3VudC8oMypzYW1wbGVmYWMpO3ZhciBkZWx0YT1+fihzYW1wbGVwaXhlbHMvbmN5Y2xlcyk7dmFyIGFscGhhPWluaXRhbHBoYTt2YXIgcmFkaXVzPWluaXRyYWRpdXM7dmFyIHJhZD1yYWRpdXM+PnJhZGl1c2JpYXNzaGlmdDtpZihyYWQ8PTEpcmFkPTA7Zm9yKGk9MDtpPHJhZDtpKyspcmFkcG93ZXJbaV09YWxwaGEqKChyYWQqcmFkLWkqaSkqcmFkYmlhcy8ocmFkKnJhZCkpO3ZhciBzdGVwO2lmKGxlbmd0aGNvdW50PG1pbnBpY3R1cmVieXRlcyl7c2FtcGxlZmFjPTE7c3RlcD0zfWVsc2UgaWYobGVuZ3RoY291bnQlcHJpbWUxIT09MCl7c3RlcD0zKnByaW1lMX1lbHNlIGlmKGxlbmd0aGNvdW50JXByaW1lMiE9PTApe3N0ZXA9MypwcmltZTJ9ZWxzZSBpZihsZW5ndGhjb3VudCVwcmltZTMhPT0wKXtzdGVwPTMqcHJpbWUzfWVsc2V7c3RlcD0zKnByaW1lNH12YXIgYixnLHIsajt2YXIgcGl4PTA7aT0wO3doaWxlKGk8c2FtcGxlcGl4ZWxzKXtiPShwaXhlbHNbcGl4XSYyNTUpPDxuZXRiaWFzc2hpZnQ7Zz0ocGl4ZWxzW3BpeCsxXSYyNTUpPDxuZXRiaWFzc2hpZnQ7cj0ocGl4ZWxzW3BpeCsyXSYyNTUpPDxuZXRiaWFzc2hpZnQ7aj1jb250ZXN0KGIsZyxyKTthbHRlcnNpbmdsZShhbHBoYSxqLGIsZyxyKTtpZihyYWQhPT0wKWFsdGVybmVpZ2gocmFkLGosYixnLHIpO3BpeCs9c3RlcDtpZihwaXg+PWxlbmd0aGNvdW50KXBpeC09bGVuZ3RoY291bnQ7aSsrO2lmKGRlbHRhPT09MClkZWx0YT0xO2lmKGklZGVsdGE9PT0wKXthbHBoYS09YWxwaGEvYWxwaGFkZWM7cmFkaXVzLT1yYWRpdXMvcmFkaXVzZGVjO3JhZD1yYWRpdXM+PnJhZGl1c2JpYXNzaGlmdDtpZihyYWQ8PTEpcmFkPTA7Zm9yKGo9MDtqPHJhZDtqKyspcmFkcG93ZXJbal09YWxwaGEqKChyYWQqcmFkLWoqaikqcmFkYmlhcy8ocmFkKnJhZCkpfX19ZnVuY3Rpb24gYnVpbGRDb2xvcm1hcCgpe2luaXQoKTtsZWFybigpO3VuYmlhc25ldCgpO2lueGJ1aWxkKCl9dGhpcy5idWlsZENvbG9ybWFwPWJ1aWxkQ29sb3JtYXA7ZnVuY3Rpb24gZ2V0Q29sb3JtYXAoKXt2YXIgbWFwPVtdO3ZhciBpbmRleD1bXTtmb3IodmFyIGk9MDtpPG5ldHNpemU7aSsrKWluZGV4W25ldHdvcmtbaV1bM11dPWk7dmFyIGs9MDtmb3IodmFyIGw9MDtsPG5ldHNpemU7bCsrKXt2YXIgaj1pbmRleFtsXTttYXBbaysrXT1uZXR3b3JrW2pdWzBdO21hcFtrKytdPW5ldHdvcmtbal1bMV07bWFwW2srK109bmV0d29ya1tqXVsyXX1yZXR1cm4gbWFwfXRoaXMuZ2V0Q29sb3JtYXA9Z2V0Q29sb3JtYXA7dGhpcy5sb29rdXBSR0I9aW54c2VhcmNofW1vZHVsZS5leHBvcnRzPU5ldVF1YW50fSx7fV0sNTpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIFVBLGJyb3dzZXIsbW9kZSxwbGF0Zm9ybSx1YTt1YT1uYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7cGxhdGZvcm09bmF2aWdhdG9yLnBsYXRmb3JtLnRvTG93ZXJDYXNlKCk7VUE9dWEubWF0Y2goLyhvcGVyYXxpZXxmaXJlZm94fGNocm9tZXx2ZXJzaW9uKVtcXHNcXC86XShbXFx3XFxkXFwuXSspPy4qPyhzYWZhcml8dmVyc2lvbltcXHNcXC86XShbXFx3XFxkXFwuXSspfCQpLyl8fFtudWxsLFwidW5rbm93blwiLDBdO21vZGU9VUFbMV09PT1cImllXCImJmRvY3VtZW50LmRvY3VtZW50TW9kZTticm93c2VyPXtuYW1lOlVBWzFdPT09XCJ2ZXJzaW9uXCI/VUFbM106VUFbMV0sdmVyc2lvbjptb2RlfHxwYXJzZUZsb2F0KFVBWzFdPT09XCJvcGVyYVwiJiZVQVs0XT9VQVs0XTpVQVsyXSkscGxhdGZvcm06e25hbWU6dWEubWF0Y2goL2lwKD86YWR8b2R8aG9uZSkvKT9cImlvc1wiOih1YS5tYXRjaCgvKD86d2Vib3N8YW5kcm9pZCkvKXx8cGxhdGZvcm0ubWF0Y2goL21hY3x3aW58bGludXgvKXx8W1wib3RoZXJcIl0pWzBdfX07YnJvd3Nlclticm93c2VyLm5hbWVdPXRydWU7YnJvd3Nlclticm93c2VyLm5hbWUrcGFyc2VJbnQoYnJvd3Nlci52ZXJzaW9uLDEwKV09dHJ1ZTticm93c2VyLnBsYXRmb3JtW2Jyb3dzZXIucGxhdGZvcm0ubmFtZV09dHJ1ZTttb2R1bGUuZXhwb3J0cz1icm93c2VyfSx7fV0sNjpbZnVuY3Rpb24ocmVxdWlyZSxtb2R1bGUsZXhwb3J0cyl7dmFyIEV2ZW50RW1pdHRlcixHSUYsR0lGRW5jb2Rlcixicm93c2VyLGdpZldvcmtlcixleHRlbmQ9ZnVuY3Rpb24oY2hpbGQscGFyZW50KXtmb3IodmFyIGtleSBpbiBwYXJlbnQpe2lmKGhhc1Byb3AuY2FsbChwYXJlbnQsa2V5KSljaGlsZFtrZXldPXBhcmVudFtrZXldfWZ1bmN0aW9uIGN0b3IoKXt0aGlzLmNvbnN0cnVjdG9yPWNoaWxkfWN0b3IucHJvdG90eXBlPXBhcmVudC5wcm90b3R5cGU7Y2hpbGQucHJvdG90eXBlPW5ldyBjdG9yO2NoaWxkLl9fc3VwZXJfXz1wYXJlbnQucHJvdG90eXBlO3JldHVybiBjaGlsZH0saGFzUHJvcD17fS5oYXNPd25Qcm9wZXJ0eSxpbmRleE9mPVtdLmluZGV4T2Z8fGZ1bmN0aW9uKGl0ZW0pe2Zvcih2YXIgaT0wLGw9dGhpcy5sZW5ndGg7aTxsO2krKyl7aWYoaSBpbiB0aGlzJiZ0aGlzW2ldPT09aXRlbSlyZXR1cm4gaX1yZXR1cm4tMX0sc2xpY2U9W10uc2xpY2U7RXZlbnRFbWl0dGVyPXJlcXVpcmUoXCJldmVudHNcIikuRXZlbnRFbWl0dGVyO2Jyb3dzZXI9cmVxdWlyZShcIi4vYnJvd3Nlci5jb2ZmZWVcIik7R0lGRW5jb2Rlcj1yZXF1aXJlKFwiLi9HSUZFbmNvZGVyLmpzXCIpO2dpZldvcmtlcj1yZXF1aXJlKFwiLi9naWYud29ya2VyLmNvZmZlZVwiKTttb2R1bGUuZXhwb3J0cz1HSUY9ZnVuY3Rpb24oc3VwZXJDbGFzcyl7dmFyIGRlZmF1bHRzLGZyYW1lRGVmYXVsdHM7ZXh0ZW5kKEdJRixzdXBlckNsYXNzKTtkZWZhdWx0cz17d29ya2VyU2NyaXB0OlwiZ2lmLndvcmtlci5qc1wiLHdvcmtlcnM6MixyZXBlYXQ6MCxiYWNrZ3JvdW5kOlwiI2ZmZlwiLHF1YWxpdHk6MTAsd2lkdGg6bnVsbCxoZWlnaHQ6bnVsbCx0cmFuc3BhcmVudDpudWxsLGRlYnVnOmZhbHNlLGRpdGhlcjpmYWxzZX07ZnJhbWVEZWZhdWx0cz17ZGVsYXk6NTAwLGNvcHk6ZmFsc2UsZGlzcG9zZTotMX07ZnVuY3Rpb24gR0lGKG9wdGlvbnMpe3ZhciBiYXNlLGtleSx2YWx1ZTt0aGlzLnJ1bm5pbmc9ZmFsc2U7dGhpcy5vcHRpb25zPXt9O3RoaXMuZnJhbWVzPVtdO3RoaXMuZnJlZVdvcmtlcnM9W107dGhpcy5hY3RpdmVXb3JrZXJzPVtdO3RoaXMuc2V0T3B0aW9ucyhvcHRpb25zKTtmb3Ioa2V5IGluIGRlZmF1bHRzKXt2YWx1ZT1kZWZhdWx0c1trZXldO2lmKChiYXNlPXRoaXMub3B0aW9ucylba2V5XT09bnVsbCl7YmFzZVtrZXldPXZhbHVlfX19R0lGLnByb3RvdHlwZS5zZXRPcHRpb249ZnVuY3Rpb24oa2V5LHZhbHVlKXt0aGlzLm9wdGlvbnNba2V5XT12YWx1ZTtpZih0aGlzLl9jYW52YXMhPW51bGwmJihrZXk9PT1cIndpZHRoXCJ8fGtleT09PVwiaGVpZ2h0XCIpKXtyZXR1cm4gdGhpcy5fY2FudmFzW2tleV09dmFsdWV9fTtHSUYucHJvdG90eXBlLnNldE9wdGlvbnM9ZnVuY3Rpb24ob3B0aW9ucyl7dmFyIGtleSxyZXN1bHRzLHZhbHVlO3Jlc3VsdHM9W107Zm9yKGtleSBpbiBvcHRpb25zKXtpZighaGFzUHJvcC5jYWxsKG9wdGlvbnMsa2V5KSljb250aW51ZTt2YWx1ZT1vcHRpb25zW2tleV07cmVzdWx0cy5wdXNoKHRoaXMuc2V0T3B0aW9uKGtleSx2YWx1ZSkpfXJldHVybiByZXN1bHRzfTtHSUYucHJvdG90eXBlLmFkZEZyYW1lPWZ1bmN0aW9uKGltYWdlLG9wdGlvbnMpe3ZhciBmcmFtZSxrZXk7aWYob3B0aW9ucz09bnVsbCl7b3B0aW9ucz17fX1mcmFtZT17fTtmcmFtZS50cmFuc3BhcmVudD10aGlzLm9wdGlvbnMudHJhbnNwYXJlbnQ7Zm9yKGtleSBpbiBmcmFtZURlZmF1bHRzKXtmcmFtZVtrZXldPW9wdGlvbnNba2V5XXx8ZnJhbWVEZWZhdWx0c1trZXldfWlmKHRoaXMub3B0aW9ucy53aWR0aD09bnVsbCl7dGhpcy5zZXRPcHRpb24oXCJ3aWR0aFwiLGltYWdlLndpZHRoKX1pZih0aGlzLm9wdGlvbnMuaGVpZ2h0PT1udWxsKXt0aGlzLnNldE9wdGlvbihcImhlaWdodFwiLGltYWdlLmhlaWdodCl9aWYodHlwZW9mIEltYWdlRGF0YSE9PVwidW5kZWZpbmVkXCImJkltYWdlRGF0YSE9PW51bGwmJmltYWdlIGluc3RhbmNlb2YgSW1hZ2VEYXRhKXtmcmFtZS5kYXRhPWltYWdlLmRhdGF9ZWxzZSBpZih0eXBlb2YgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIT09XCJ1bmRlZmluZWRcIiYmQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEIT09bnVsbCYmaW1hZ2UgaW5zdGFuY2VvZiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkR8fHR5cGVvZiBXZWJHTFJlbmRlcmluZ0NvbnRleHQhPT1cInVuZGVmaW5lZFwiJiZXZWJHTFJlbmRlcmluZ0NvbnRleHQhPT1udWxsJiZpbWFnZSBpbnN0YW5jZW9mIFdlYkdMUmVuZGVyaW5nQ29udGV4dCl7aWYob3B0aW9ucy5jb3B5KXtmcmFtZS5kYXRhPXRoaXMuZ2V0Q29udGV4dERhdGEoaW1hZ2UpfWVsc2V7ZnJhbWUuY29udGV4dD1pbWFnZX19ZWxzZSBpZihpbWFnZS5jaGlsZE5vZGVzIT1udWxsKXtpZihvcHRpb25zLmNvcHkpe2ZyYW1lLmRhdGE9dGhpcy5nZXRJbWFnZURhdGEoaW1hZ2UpfWVsc2V7ZnJhbWUuaW1hZ2U9aW1hZ2V9fWVsc2V7dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBpbWFnZVwiKX1yZXR1cm4gdGhpcy5mcmFtZXMucHVzaChmcmFtZSl9O0dJRi5wcm90b3R5cGUucmVuZGVyPWZ1bmN0aW9uKCl7dmFyIGksaixudW1Xb3JrZXJzLHJlZjtpZih0aGlzLnJ1bm5pbmcpe3Rocm93IG5ldyBFcnJvcihcIkFscmVhZHkgcnVubmluZ1wiKX1pZih0aGlzLm9wdGlvbnMud2lkdGg9PW51bGx8fHRoaXMub3B0aW9ucy5oZWlnaHQ9PW51bGwpe3Rocm93IG5ldyBFcnJvcihcIldpZHRoIGFuZCBoZWlnaHQgbXVzdCBiZSBzZXQgcHJpb3IgdG8gcmVuZGVyaW5nXCIpfXRoaXMucnVubmluZz10cnVlO3RoaXMubmV4dEZyYW1lPTA7dGhpcy5maW5pc2hlZEZyYW1lcz0wO3RoaXMuaW1hZ2VQYXJ0cz1mdW5jdGlvbigpe3ZhciBqLHJlZixyZXN1bHRzO3Jlc3VsdHM9W107Zm9yKGk9aj0wLHJlZj10aGlzLmZyYW1lcy5sZW5ndGg7MDw9cmVmP2o8cmVmOmo+cmVmO2k9MDw9cmVmPysrajotLWope3Jlc3VsdHMucHVzaChudWxsKX1yZXR1cm4gcmVzdWx0c30uY2FsbCh0aGlzKTtudW1Xb3JrZXJzPXRoaXMuc3Bhd25Xb3JrZXJzKCk7aWYodGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGU9PT10cnVlKXt0aGlzLnJlbmRlck5leHRGcmFtZSgpfWVsc2V7Zm9yKGk9aj0wLHJlZj1udW1Xb3JrZXJzOzA8PXJlZj9qPHJlZjpqPnJlZjtpPTA8PXJlZj8rK2o6LS1qKXt0aGlzLnJlbmRlck5leHRGcmFtZSgpfX10aGlzLmVtaXQoXCJzdGFydFwiKTtyZXR1cm4gdGhpcy5lbWl0KFwicHJvZ3Jlc3NcIiwwKX07R0lGLnByb3RvdHlwZS5hYm9ydD1mdW5jdGlvbigpe3ZhciB3b3JrZXI7d2hpbGUodHJ1ZSl7d29ya2VyPXRoaXMuYWN0aXZlV29ya2Vycy5zaGlmdCgpO2lmKHdvcmtlcj09bnVsbCl7YnJlYWt9dGhpcy5sb2coXCJraWxsaW5nIGFjdGl2ZSB3b3JrZXJcIik7d29ya2VyLnRlcm1pbmF0ZSgpfXRoaXMucnVubmluZz1mYWxzZTtyZXR1cm4gdGhpcy5lbWl0KFwiYWJvcnRcIil9O0dJRi5wcm90b3R5cGUuc3Bhd25Xb3JrZXJzPWZ1bmN0aW9uKCl7dmFyIGosbnVtV29ya2VycyxyZWYscmVzdWx0cztudW1Xb3JrZXJzPU1hdGgubWluKHRoaXMub3B0aW9ucy53b3JrZXJzLHRoaXMuZnJhbWVzLmxlbmd0aCk7KGZ1bmN0aW9uKCl7cmVzdWx0cz1bXTtmb3IodmFyIGo9cmVmPXRoaXMuZnJlZVdvcmtlcnMubGVuZ3RoO3JlZjw9bnVtV29ya2Vycz9qPG51bVdvcmtlcnM6aj5udW1Xb3JrZXJzO3JlZjw9bnVtV29ya2Vycz9qKys6ai0tKXtyZXN1bHRzLnB1c2goail9cmV0dXJuIHJlc3VsdHN9KS5hcHBseSh0aGlzKS5mb3JFYWNoKGZ1bmN0aW9uKF90aGlzKXtyZXR1cm4gZnVuY3Rpb24oaSl7dmFyIHdvcmtlcjtfdGhpcy5sb2coXCJzcGF3bmluZyB3b3JrZXIgXCIraSk7d29ya2VyPW5ldyBXb3JrZXIoX3RoaXMub3B0aW9ucy53b3JrZXJTY3JpcHQpO3dvcmtlci5vbm1lc3NhZ2U9ZnVuY3Rpb24oZXZlbnQpe190aGlzLmFjdGl2ZVdvcmtlcnMuc3BsaWNlKF90aGlzLmFjdGl2ZVdvcmtlcnMuaW5kZXhPZih3b3JrZXIpLDEpO190aGlzLmZyZWVXb3JrZXJzLnB1c2god29ya2VyKTtyZXR1cm4gX3RoaXMuZnJhbWVGaW5pc2hlZChldmVudC5kYXRhKX07cmV0dXJuIF90aGlzLmZyZWVXb3JrZXJzLnB1c2god29ya2VyKX19KHRoaXMpKTtyZXR1cm4gbnVtV29ya2Vyc307R0lGLnByb3RvdHlwZS5mcmFtZUZpbmlzaGVkPWZ1bmN0aW9uKGZyYW1lKXt2YXIgaSxqLHJlZjt0aGlzLmxvZyhcImZyYW1lIFwiK2ZyYW1lLmluZGV4K1wiIGZpbmlzaGVkIC0gXCIrdGhpcy5hY3RpdmVXb3JrZXJzLmxlbmd0aCtcIiBhY3RpdmVcIik7dGhpcy5maW5pc2hlZEZyYW1lcysrO3RoaXMuZW1pdChcInByb2dyZXNzXCIsdGhpcy5maW5pc2hlZEZyYW1lcy90aGlzLmZyYW1lcy5sZW5ndGgpO3RoaXMuaW1hZ2VQYXJ0c1tmcmFtZS5pbmRleF09ZnJhbWU7aWYodGhpcy5vcHRpb25zLmdsb2JhbFBhbGV0dGU9PT10cnVlKXt0aGlzLm9wdGlvbnMuZ2xvYmFsUGFsZXR0ZT1mcmFtZS5nbG9iYWxQYWxldHRlO3RoaXMubG9nKFwiZ2xvYmFsIHBhbGV0dGUgYW5hbHl6ZWRcIik7aWYodGhpcy5mcmFtZXMubGVuZ3RoPjIpe2ZvcihpPWo9MSxyZWY9dGhpcy5mcmVlV29ya2Vycy5sZW5ndGg7MTw9cmVmP2o8cmVmOmo+cmVmO2k9MTw9cmVmPysrajotLWope3RoaXMucmVuZGVyTmV4dEZyYW1lKCl9fX1pZihpbmRleE9mLmNhbGwodGhpcy5pbWFnZVBhcnRzLG51bGwpPj0wKXtyZXR1cm4gdGhpcy5yZW5kZXJOZXh0RnJhbWUoKX1lbHNle3JldHVybiB0aGlzLmZpbmlzaFJlbmRlcmluZygpfX07R0lGLnByb3RvdHlwZS5maW5pc2hSZW5kZXJpbmc9ZnVuY3Rpb24oKXt2YXIgZGF0YSxmcmFtZSxpLGltYWdlLGosayxsLGxlbixsZW4xLGxlbjIsbGVuMyxvZmZzZXQscGFnZSxyZWYscmVmMSxyZWYyO2xlbj0wO3JlZj10aGlzLmltYWdlUGFydHM7Zm9yKGo9MCxsZW4xPXJlZi5sZW5ndGg7ajxsZW4xO2orKyl7ZnJhbWU9cmVmW2pdO2xlbis9KGZyYW1lLmRhdGEubGVuZ3RoLTEpKmZyYW1lLnBhZ2VTaXplK2ZyYW1lLmN1cnNvcn1sZW4rPWZyYW1lLnBhZ2VTaXplLWZyYW1lLmN1cnNvcjt0aGlzLmxvZyhcInJlbmRlcmluZyBmaW5pc2hlZCAtIGZpbGVzaXplIFwiK01hdGgucm91bmQobGVuLzFlMykrXCJrYlwiKTtkYXRhPW5ldyBVaW50OEFycmF5KGxlbik7b2Zmc2V0PTA7cmVmMT10aGlzLmltYWdlUGFydHM7Zm9yKGs9MCxsZW4yPXJlZjEubGVuZ3RoO2s8bGVuMjtrKyspe2ZyYW1lPXJlZjFba107cmVmMj1mcmFtZS5kYXRhO2ZvcihpPWw9MCxsZW4zPXJlZjIubGVuZ3RoO2w8bGVuMztpPSsrbCl7cGFnZT1yZWYyW2ldO2RhdGEuc2V0KHBhZ2Usb2Zmc2V0KTtpZihpPT09ZnJhbWUuZGF0YS5sZW5ndGgtMSl7b2Zmc2V0Kz1mcmFtZS5jdXJzb3J9ZWxzZXtvZmZzZXQrPWZyYW1lLnBhZ2VTaXplfX19aW1hZ2U9bmV3IEJsb2IoW2RhdGFdLHt0eXBlOlwiaW1hZ2UvZ2lmXCJ9KTtyZXR1cm4gdGhpcy5lbWl0KFwiZmluaXNoZWRcIixpbWFnZSxkYXRhKX07R0lGLnByb3RvdHlwZS5yZW5kZXJOZXh0RnJhbWU9ZnVuY3Rpb24oKXt2YXIgZnJhbWUsdGFzayx3b3JrZXI7aWYodGhpcy5mcmVlV29ya2Vycy5sZW5ndGg9PT0wKXt0aHJvdyBuZXcgRXJyb3IoXCJObyBmcmVlIHdvcmtlcnNcIil9aWYodGhpcy5uZXh0RnJhbWU+PXRoaXMuZnJhbWVzLmxlbmd0aCl7cmV0dXJufWZyYW1lPXRoaXMuZnJhbWVzW3RoaXMubmV4dEZyYW1lKytdO3dvcmtlcj10aGlzLmZyZWVXb3JrZXJzLnNoaWZ0KCk7dGFzaz10aGlzLmdldFRhc2soZnJhbWUpO3RoaXMubG9nKFwic3RhcnRpbmcgZnJhbWUgXCIrKHRhc2suaW5kZXgrMSkrXCIgb2YgXCIrdGhpcy5mcmFtZXMubGVuZ3RoKTt0aGlzLmFjdGl2ZVdvcmtlcnMucHVzaCh3b3JrZXIpO3JldHVybiB3b3JrZXIucG9zdE1lc3NhZ2UodGFzayl9O0dJRi5wcm90b3R5cGUuZ2V0Q29udGV4dERhdGE9ZnVuY3Rpb24oY3R4KXtyZXR1cm4gY3R4LmdldEltYWdlRGF0YSgwLDAsdGhpcy5vcHRpb25zLndpZHRoLHRoaXMub3B0aW9ucy5oZWlnaHQpLmRhdGF9O0dJRi5wcm90b3R5cGUuZ2V0SW1hZ2VEYXRhPWZ1bmN0aW9uKGltYWdlKXt2YXIgY3R4O2lmKHRoaXMuX2NhbnZhcz09bnVsbCl7dGhpcy5fY2FudmFzPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7dGhpcy5fY2FudmFzLndpZHRoPXRoaXMub3B0aW9ucy53aWR0aDt0aGlzLl9jYW52YXMuaGVpZ2h0PXRoaXMub3B0aW9ucy5oZWlnaHR9Y3R4PXRoaXMuX2NhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7Y3R4LnNldEZpbGw9dGhpcy5vcHRpb25zLmJhY2tncm91bmQ7Y3R4LmZpbGxSZWN0KDAsMCx0aGlzLm9wdGlvbnMud2lkdGgsdGhpcy5vcHRpb25zLmhlaWdodCk7Y3R4LmRyYXdJbWFnZShpbWFnZSwwLDApO3JldHVybiB0aGlzLmdldENvbnRleHREYXRhKGN0eCl9O0dJRi5wcm90b3R5cGUuZ2V0VGFzaz1mdW5jdGlvbihmcmFtZSl7dmFyIGluZGV4LHRhc2s7aW5kZXg9dGhpcy5mcmFtZXMuaW5kZXhPZihmcmFtZSk7dGFzaz17aW5kZXg6aW5kZXgsbGFzdDppbmRleD09PXRoaXMuZnJhbWVzLmxlbmd0aC0xLGRlbGF5OmZyYW1lLmRlbGF5LGRpc3Bvc2U6ZnJhbWUuZGlzcG9zZSx0cmFuc3BhcmVudDpmcmFtZS50cmFuc3BhcmVudCx3aWR0aDp0aGlzLm9wdGlvbnMud2lkdGgsaGVpZ2h0OnRoaXMub3B0aW9ucy5oZWlnaHQscXVhbGl0eTp0aGlzLm9wdGlvbnMucXVhbGl0eSxkaXRoZXI6dGhpcy5vcHRpb25zLmRpdGhlcixnbG9iYWxQYWxldHRlOnRoaXMub3B0aW9ucy5nbG9iYWxQYWxldHRlLHJlcGVhdDp0aGlzLm9wdGlvbnMucmVwZWF0LGNhblRyYW5zZmVyOmJyb3dzZXIubmFtZT09PVwiY2hyb21lXCJ9O2lmKGZyYW1lLmRhdGEhPW51bGwpe3Rhc2suZGF0YT1mcmFtZS5kYXRhfWVsc2UgaWYoZnJhbWUuY29udGV4dCE9bnVsbCl7dGFzay5kYXRhPXRoaXMuZ2V0Q29udGV4dERhdGEoZnJhbWUuY29udGV4dCl9ZWxzZSBpZihmcmFtZS5pbWFnZSE9bnVsbCl7dGFzay5kYXRhPXRoaXMuZ2V0SW1hZ2VEYXRhKGZyYW1lLmltYWdlKX1lbHNle3Rocm93IG5ldyBFcnJvcihcIkludmFsaWQgZnJhbWVcIil9cmV0dXJuIHRhc2t9O0dJRi5wcm90b3R5cGUubG9nPWZ1bmN0aW9uKCl7dmFyIGFyZ3M7YXJncz0xPD1hcmd1bWVudHMubGVuZ3RoP3NsaWNlLmNhbGwoYXJndW1lbnRzLDApOltdO2lmKCF0aGlzLm9wdGlvbnMuZGVidWcpe3JldHVybn1yZXR1cm4gY29uc29sZS5sb2cuYXBwbHkoY29uc29sZSxhcmdzKX07cmV0dXJuIEdJRn0oRXZlbnRFbWl0dGVyKX0se1wiLi9HSUZFbmNvZGVyLmpzXCI6MixcIi4vYnJvd3Nlci5jb2ZmZWVcIjo1LFwiLi9naWYud29ya2VyLmNvZmZlZVwiOjcsZXZlbnRzOjF9XSw3OltmdW5jdGlvbihyZXF1aXJlLG1vZHVsZSxleHBvcnRzKXt2YXIgR0lGRW5jb2RlcixyZW5kZXJGcmFtZTtHSUZFbmNvZGVyPXJlcXVpcmUoXCIuL0dJRkVuY29kZXIuanNcIik7cmVuZGVyRnJhbWU9ZnVuY3Rpb24oZnJhbWUpe3ZhciBlbmNvZGVyLHBhZ2Usc3RyZWFtLHRyYW5zZmVyO2VuY29kZXI9bmV3IEdJRkVuY29kZXIoZnJhbWUud2lkdGgsZnJhbWUuaGVpZ2h0KTtpZihmcmFtZS5pbmRleD09PTApe2VuY29kZXIud3JpdGVIZWFkZXIoKX1lbHNle2VuY29kZXIuZmlyc3RGcmFtZT1mYWxzZX1lbmNvZGVyLnNldFRyYW5zcGFyZW50KGZyYW1lLnRyYW5zcGFyZW50KTtlbmNvZGVyLnNldERpc3Bvc2UoZnJhbWUuZGlzcG9zZSk7ZW5jb2Rlci5zZXRSZXBlYXQoZnJhbWUucmVwZWF0KTtlbmNvZGVyLnNldERlbGF5KGZyYW1lLmRlbGF5KTtlbmNvZGVyLnNldFF1YWxpdHkoZnJhbWUucXVhbGl0eSk7ZW5jb2Rlci5zZXREaXRoZXIoZnJhbWUuZGl0aGVyKTtlbmNvZGVyLnNldEdsb2JhbFBhbGV0dGUoZnJhbWUuZ2xvYmFsUGFsZXR0ZSk7ZW5jb2Rlci5hZGRGcmFtZShmcmFtZS5kYXRhKTtpZihmcmFtZS5sYXN0KXtlbmNvZGVyLmZpbmlzaCgpfWlmKGZyYW1lLmdsb2JhbFBhbGV0dGU9PT10cnVlKXtmcmFtZS5nbG9iYWxQYWxldHRlPWVuY29kZXIuZ2V0R2xvYmFsUGFsZXR0ZSgpfXN0cmVhbT1lbmNvZGVyLnN0cmVhbSgpO2ZyYW1lLmRhdGE9c3RyZWFtLnBhZ2VzO2ZyYW1lLmN1cnNvcj1zdHJlYW0uY3Vyc29yO2ZyYW1lLnBhZ2VTaXplPXN0cmVhbS5jb25zdHJ1Y3Rvci5wYWdlU2l6ZTtpZihmcmFtZS5jYW5UcmFuc2Zlcil7dHJhbnNmZXI9ZnVuY3Rpb24oKXt2YXIgaSxsZW4scmVmLHJlc3VsdHM7cmVmPWZyYW1lLmRhdGE7cmVzdWx0cz1bXTtmb3IoaT0wLGxlbj1yZWYubGVuZ3RoO2k8bGVuO2krKyl7cGFnZT1yZWZbaV07cmVzdWx0cy5wdXNoKHBhZ2UuYnVmZmVyKX1yZXR1cm4gcmVzdWx0c30oKTtyZXR1cm4gc2VsZi5wb3N0TWVzc2FnZShmcmFtZSx0cmFuc2Zlcil9ZWxzZXtyZXR1cm4gc2VsZi5wb3N0TWVzc2FnZShmcmFtZSl9fTtzZWxmLm9ubWVzc2FnZT1mdW5jdGlvbihldmVudCl7cmV0dXJuIHJlbmRlckZyYW1lKGV2ZW50LmRhdGEpfX0se1wiLi9HSUZFbmNvZGVyLmpzXCI6Mn1dfSx7fSxbNl0pKDYpfSk7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWdpZi5qcy5tYXBcclxuIiwiOyhmdW5jdGlvbigpIHtcclxuXHJcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgdmFyIFRhciA9IHJlcXVpcmUoJy4vdGFyLmpzJyk7XHJcbiAgdmFyIGRvd25sb2FkID0gcmVxdWlyZSgnLi9kb3dubG9hZC5qcycpO1xyXG4gIHZhciBHSUYgPSByZXF1aXJlKCcuL2dpZi5qcycpO1xyXG59XHJcblxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBvYmplY3RUeXBlcyA9IHtcclxuJ2Z1bmN0aW9uJzogdHJ1ZSxcclxuJ29iamVjdCc6IHRydWVcclxufTtcclxuXHJcbmZ1bmN0aW9uIGNoZWNrR2xvYmFsKHZhbHVlKSB7XHJcbiAgICByZXR1cm4gKHZhbHVlICYmIHZhbHVlLk9iamVjdCA9PT0gT2JqZWN0KSA/IHZhbHVlIDogbnVsbDtcclxuICB9XHJcblxyXG4vKiogQnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMgd2l0aG91dCBhIGRlcGVuZGVuY3kgb24gYHJvb3RgLiAqL1xyXG52YXIgZnJlZVBhcnNlRmxvYXQgPSBwYXJzZUZsb2F0LFxyXG4gIGZyZWVQYXJzZUludCA9IHBhcnNlSW50O1xyXG5cclxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBleHBvcnRzYC4gKi9cclxudmFyIGZyZWVFeHBvcnRzID0gKG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlKVxyXG4/IGV4cG9ydHNcclxuOiB1bmRlZmluZWQ7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYG1vZHVsZWAuICovXHJcbnZhciBmcmVlTW9kdWxlID0gKG9iamVjdFR5cGVzW3R5cGVvZiBtb2R1bGVdICYmIG1vZHVsZSAmJiAhbW9kdWxlLm5vZGVUeXBlKVxyXG4/IG1vZHVsZVxyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgdGhlIHBvcHVsYXIgQ29tbW9uSlMgZXh0ZW5zaW9uIGBtb2R1bGUuZXhwb3J0c2AuICovXHJcbnZhciBtb2R1bGVFeHBvcnRzID0gKGZyZWVNb2R1bGUgJiYgZnJlZU1vZHVsZS5leHBvcnRzID09PSBmcmVlRXhwb3J0cylcclxuPyBmcmVlRXhwb3J0c1xyXG46IHVuZGVmaW5lZDtcclxuXHJcbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZ2xvYmFsYCBmcm9tIE5vZGUuanMuICovXHJcbnZhciBmcmVlR2xvYmFsID0gY2hlY2tHbG9iYWwoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSAmJiB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbCk7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHNlbGZgLiAqL1xyXG52YXIgZnJlZVNlbGYgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygc2VsZl0gJiYgc2VsZik7XHJcblxyXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHdpbmRvd2AuICovXHJcbnZhciBmcmVlV2luZG93ID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHdpbmRvd10gJiYgd2luZG93KTtcclxuXHJcbi8qKiBEZXRlY3QgYHRoaXNgIGFzIHRoZSBnbG9iYWwgb2JqZWN0LiAqL1xyXG52YXIgdGhpc0dsb2JhbCA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB0aGlzXSAmJiB0aGlzKTtcclxuXHJcbi8qKlxyXG4qIFVzZWQgYXMgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbCBvYmplY3QuXHJcbipcclxuKiBUaGUgYHRoaXNgIHZhbHVlIGlzIHVzZWQgaWYgaXQncyB0aGUgZ2xvYmFsIG9iamVjdCB0byBhdm9pZCBHcmVhc2Vtb25rZXknc1xyXG4qIHJlc3RyaWN0ZWQgYHdpbmRvd2Agb2JqZWN0LCBvdGhlcndpc2UgdGhlIGB3aW5kb3dgIG9iamVjdCBpcyB1c2VkLlxyXG4qL1xyXG52YXIgcm9vdCA9IGZyZWVHbG9iYWwgfHxcclxuKChmcmVlV2luZG93ICE9PSAodGhpc0dsb2JhbCAmJiB0aGlzR2xvYmFsLndpbmRvdykpICYmIGZyZWVXaW5kb3cpIHx8XHJcbiAgZnJlZVNlbGYgfHwgdGhpc0dsb2JhbCB8fCBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xyXG5cclxuaWYoICEoJ2djJyBpbiB3aW5kb3cgKSApIHtcclxuXHR3aW5kb3cuZ2MgPSBmdW5jdGlvbigpe31cclxufVxyXG5cclxuaWYgKCFIVE1MQ2FudmFzRWxlbWVudC5wcm90b3R5cGUudG9CbG9iKSB7XHJcbiBPYmplY3QuZGVmaW5lUHJvcGVydHkoSFRNTENhbnZhc0VsZW1lbnQucHJvdG90eXBlLCAndG9CbG9iJywge1xyXG4gIHZhbHVlOiBmdW5jdGlvbiAoY2FsbGJhY2ssIHR5cGUsIHF1YWxpdHkpIHtcclxuXHJcbiAgICB2YXIgYmluU3RyID0gYXRvYiggdGhpcy50b0RhdGFVUkwodHlwZSwgcXVhbGl0eSkuc3BsaXQoJywnKVsxXSApLFxyXG4gICAgICAgIGxlbiA9IGJpblN0ci5sZW5ndGgsXHJcbiAgICAgICAgYXJyID0gbmV3IFVpbnQ4QXJyYXkobGVuKTtcclxuXHJcbiAgICBmb3IgKHZhciBpPTA7IGk8bGVuOyBpKysgKSB7XHJcbiAgICAgYXJyW2ldID0gYmluU3RyLmNoYXJDb2RlQXQoaSk7XHJcbiAgICB9XHJcblxyXG4gICAgY2FsbGJhY2soIG5ldyBCbG9iKCBbYXJyXSwge3R5cGU6IHR5cGUgfHwgJ2ltYWdlL3BuZyd9ICkgKTtcclxuICB9XHJcbiB9KTtcclxufVxyXG5cclxuLy8gQGxpY2Vuc2UgaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVFxyXG4vLyBjb3B5cmlnaHQgUGF1bCBJcmlzaCAyMDE1XHJcblxyXG5cclxuLy8gRGF0ZS5ub3coKSBpcyBzdXBwb3J0ZWQgZXZlcnl3aGVyZSBleGNlcHQgSUU4LiBGb3IgSUU4IHdlIHVzZSB0aGUgRGF0ZS5ub3cgcG9seWZpbGxcclxuLy8gICBnaXRodWIuY29tL0ZpbmFuY2lhbC1UaW1lcy9wb2x5ZmlsbC1zZXJ2aWNlL2Jsb2IvbWFzdGVyL3BvbHlmaWxscy9EYXRlLm5vdy9wb2x5ZmlsbC5qc1xyXG4vLyBhcyBTYWZhcmkgNiBkb2Vzbid0IGhhdmUgc3VwcG9ydCBmb3IgTmF2aWdhdGlvblRpbWluZywgd2UgdXNlIGEgRGF0ZS5ub3coKSB0aW1lc3RhbXAgZm9yIHJlbGF0aXZlIHZhbHVlc1xyXG5cclxuLy8gaWYgeW91IHdhbnQgdmFsdWVzIHNpbWlsYXIgdG8gd2hhdCB5b3UnZCBnZXQgd2l0aCByZWFsIHBlcmYubm93LCBwbGFjZSB0aGlzIHRvd2FyZHMgdGhlIGhlYWQgb2YgdGhlIHBhZ2VcclxuLy8gYnV0IGluIHJlYWxpdHksIHlvdSdyZSBqdXN0IGdldHRpbmcgdGhlIGRlbHRhIGJldHdlZW4gbm93KCkgY2FsbHMsIHNvIGl0J3Mgbm90IHRlcnJpYmx5IGltcG9ydGFudCB3aGVyZSBpdCdzIHBsYWNlZFxyXG5cclxuXHJcbihmdW5jdGlvbigpe1xyXG5cclxuICBpZiAoXCJwZXJmb3JtYW5jZVwiIGluIHdpbmRvdyA9PSBmYWxzZSkge1xyXG4gICAgICB3aW5kb3cucGVyZm9ybWFuY2UgPSB7fTtcclxuICB9XHJcblxyXG4gIERhdGUubm93ID0gKERhdGUubm93IHx8IGZ1bmN0aW9uICgpIHsgIC8vIHRoYW5rcyBJRThcclxuXHQgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICB9KTtcclxuXHJcbiAgaWYgKFwibm93XCIgaW4gd2luZG93LnBlcmZvcm1hbmNlID09IGZhbHNlKXtcclxuXHJcbiAgICB2YXIgbm93T2Zmc2V0ID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICBpZiAocGVyZm9ybWFuY2UudGltaW5nICYmIHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQpe1xyXG4gICAgICBub3dPZmZzZXQgPSBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0XHJcbiAgICB9XHJcblxyXG4gICAgd2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uIG5vdygpe1xyXG4gICAgICByZXR1cm4gRGF0ZS5ub3coKSAtIG5vd09mZnNldDtcclxuICAgIH1cclxuICB9XHJcblxyXG59KSgpO1xyXG5cclxuXHJcbmZ1bmN0aW9uIHBhZCggbiApIHtcclxuXHRyZXR1cm4gU3RyaW5nKFwiMDAwMDAwMFwiICsgbikuc2xpY2UoLTcpO1xyXG59XHJcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL0FkZC1vbnMvQ29kZV9zbmlwcGV0cy9UaW1lcnNcclxuXHJcbnZhciBnX3N0YXJ0VGltZSA9IHdpbmRvdy5EYXRlLm5vdygpO1xyXG5cclxuZnVuY3Rpb24gZ3VpZCgpIHtcclxuXHRmdW5jdGlvbiBzNCgpIHtcclxuXHRcdHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKS50b1N0cmluZygxNikuc3Vic3RyaW5nKDEpO1xyXG5cdH1cclxuXHRyZXR1cm4gczQoKSArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDRnJhbWVFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0dmFyIF9oYW5kbGVycyA9IHt9O1xyXG5cclxuXHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XHJcblxyXG5cdHRoaXMub24gPSBmdW5jdGlvbihldmVudCwgaGFuZGxlcikge1xyXG5cclxuXHRcdF9oYW5kbGVyc1tldmVudF0gPSBoYW5kbGVyO1xyXG5cclxuXHR9O1xyXG5cclxuXHR0aGlzLmVtaXQgPSBmdW5jdGlvbihldmVudCkge1xyXG5cclxuXHRcdHZhciBoYW5kbGVyID0gX2hhbmRsZXJzW2V2ZW50XTtcclxuXHRcdGlmIChoYW5kbGVyKSB7XHJcblxyXG5cdFx0XHRoYW5kbGVyLmFwcGx5KG51bGwsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xyXG5cclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0dGhpcy5maWxlbmFtZSA9IHNldHRpbmdzLm5hbWUgfHwgZ3VpZCgpO1xyXG5cdHRoaXMuZXh0ZW5zaW9uID0gJyc7XHJcblx0dGhpcy5taW1lVHlwZSA9ICcnO1xyXG5cclxufVxyXG5cclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCl7fTtcclxuQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbigpe307XHJcbkNDRnJhbWVFbmNvZGVyLnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oKXt9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc2FmZVRvUHJvY2VlZCA9IGZ1bmN0aW9uKCl7IHJldHVybiB0cnVlOyB9O1xyXG5DQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUuc3RlcCA9IGZ1bmN0aW9uKCkgeyBjb25zb2xlLmxvZyggJ1N0ZXAgbm90IHNldCEnICkgfVxyXG5cclxuZnVuY3Rpb24gQ0NUYXJFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5leHRlbnNpb24gPSAnLnRhcidcclxuXHR0aGlzLm1pbWVUeXBlID0gJ2FwcGxpY2F0aW9uL3gtdGFyJ1xyXG5cdHRoaXMuZmlsZUV4dGVuc2lvbiA9ICcnO1xyXG5cclxuXHR0aGlzLnRhcGUgPSBudWxsXHJcblx0dGhpcy5jb3VudCA9IDA7XHJcblxyXG59XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24oKXtcclxuXHJcblx0dGhpcy5kaXNwb3NlKCk7XHJcblxyXG59O1xyXG5cclxuQ0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggYmxvYiApIHtcclxuXHJcblx0dmFyIGZpbGVSZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG5cdGZpbGVSZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLnRhcGUuYXBwZW5kKCBwYWQoIHRoaXMuY291bnQgKSArIHRoaXMuZmlsZUV4dGVuc2lvbiwgbmV3IFVpbnQ4QXJyYXkoIGZpbGVSZWFkZXIucmVzdWx0ICkgKTtcclxuXHJcblx0XHQvL2lmKCB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSA+IDAgJiYgKCB0aGlzLmZyYW1lcy5sZW5ndGggLyB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZSApID49IHRoaXMuc2V0dGluZ3MuYXV0b1NhdmVUaW1lICkge1xyXG5cclxuXHRcdHRoaXMuY291bnQrKztcclxuXHRcdHRoaXMuc3RlcCgpO1xyXG5cdH0uYmluZCggdGhpcyApO1xyXG5cdGZpbGVSZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYik7XHJcblxyXG59XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG5cdGNhbGxiYWNrKCB0aGlzLnRhcGUuc2F2ZSgpICk7XHJcblxyXG59XHJcblxyXG5DQ1RhckVuY29kZXIucHJvdG90eXBlLmRpc3Bvc2UgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy50YXBlID0gbmV3IFRhcigpO1xyXG5cdHRoaXMuY291bnQgPSAwO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NQTkdFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NUYXJFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMudHlwZSA9ICdpbWFnZS9wbmcnO1xyXG5cdHRoaXMuZmlsZUV4dGVuc2lvbiA9ICcucG5nJztcclxuXHJcbn1cclxuXHJcbkNDUE5HRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ1RhckVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1BOR0VuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGNhbnZhcy50b0Jsb2IoIGZ1bmN0aW9uKCBibG9iICkge1xyXG5cdFx0Q0NUYXJFbmNvZGVyLnByb3RvdHlwZS5hZGQuY2FsbCggdGhpcywgYmxvYiApO1xyXG5cdH0uYmluZCggdGhpcyApLCB0aGlzLnR5cGUgKVxyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NKUEVHRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDVGFyRW5jb2Rlci5jYWxsKCB0aGlzLCBzZXR0aW5ncyApO1xyXG5cclxuXHR0aGlzLnR5cGUgPSAnaW1hZ2UvanBlZyc7XHJcblx0dGhpcy5maWxlRXh0ZW5zaW9uID0gJy5qcGcnO1xyXG5cdHRoaXMucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxufVxyXG5cclxuQ0NKUEVHRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ1RhckVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ0pQRUdFbmNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHRjYW52YXMudG9CbG9iKCBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdENDVGFyRW5jb2Rlci5wcm90b3R5cGUuYWRkLmNhbGwoIHRoaXMsIGJsb2IgKTtcclxuXHR9LmJpbmQoIHRoaXMgKSwgdGhpcy50eXBlLCB0aGlzLnF1YWxpdHkgKVxyXG5cclxufVxyXG5cclxuLypcclxuXHJcblx0V2ViTSBFbmNvZGVyXHJcblxyXG4qL1xyXG5cclxuZnVuY3Rpb24gQ0NXZWJNRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApO1xyXG5cdGlmKCBjYW52YXMudG9EYXRhVVJMKCAnaW1hZ2Uvd2VicCcgKS5zdWJzdHIoNSwxMCkgIT09ICdpbWFnZS93ZWJwJyApe1xyXG5cdFx0Y29uc29sZS5sb2coIFwiV2ViUCBub3Qgc3VwcG9ydGVkIC0gdHJ5IGFub3RoZXIgZXhwb3J0IGZvcm1hdFwiIClcclxuXHR9XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHRoaXMucXVhbGl0eSA9ICggc2V0dGluZ3MucXVhbGl0eSAvIDEwMCApIHx8IC44O1xyXG5cclxuXHR0aGlzLmV4dGVuc2lvbiA9ICcud2VibSdcclxuXHR0aGlzLm1pbWVUeXBlID0gJ3ZpZGVvL3dlYm0nXHJcblx0dGhpcy5iYXNlRmlsZW5hbWUgPSB0aGlzLmZpbGVuYW1lO1xyXG5cclxuXHR0aGlzLmZyYW1lcyA9IFtdO1xyXG5cdHRoaXMucGFydCA9IDE7XHJcblxyXG4gIHRoaXMudmlkZW9Xcml0ZXIgPSBuZXcgV2ViTVdyaXRlcih7XHJcbiAgICBxdWFsaXR5OiB0aGlzLnF1YWxpdHksXHJcbiAgICBmaWxlV3JpdGVyOiBudWxsLFxyXG4gICAgZmQ6IG51bGwsXHJcbiAgICBmcmFtZVJhdGU6IHNldHRpbmdzLmZyYW1lcmF0ZVxyXG59KTtcclxuXHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NXZWJNRW5jb2Rlci5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiggY2FudmFzICkge1xyXG5cclxuXHR0aGlzLmRpc3Bvc2UoKTtcclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG4gIHRoaXMudmlkZW9Xcml0ZXIuYWRkRnJhbWUoY2FudmFzKTtcclxuXHJcblx0Ly90aGlzLmZyYW1lcy5wdXNoKCBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS93ZWJwJywgdGhpcy5xdWFsaXR5KSApO1xyXG5cclxuXHRpZiggdGhpcy5zZXR0aW5ncy5hdXRvU2F2ZVRpbWUgPiAwICYmICggdGhpcy5mcmFtZXMubGVuZ3RoIC8gdGhpcy5zZXR0aW5ncy5mcmFtZXJhdGUgKSA+PSB0aGlzLnNldHRpbmdzLmF1dG9TYXZlVGltZSApIHtcclxuXHRcdHRoaXMuc2F2ZSggZnVuY3Rpb24oIGJsb2IgKSB7XHJcblx0XHRcdHRoaXMuZmlsZW5hbWUgPSB0aGlzLmJhc2VGaWxlbmFtZSArICctcGFydC0nICsgcGFkKCB0aGlzLnBhcnQgKTtcclxuXHRcdFx0ZG93bmxvYWQoIGJsb2IsIHRoaXMuZmlsZW5hbWUgKyB0aGlzLmV4dGVuc2lvbiwgdGhpcy5taW1lVHlwZSApO1xyXG5cdFx0XHR0aGlzLmRpc3Bvc2UoKTtcclxuXHRcdFx0dGhpcy5wYXJ0Kys7XHJcblx0XHRcdHRoaXMuZmlsZW5hbWUgPSB0aGlzLmJhc2VGaWxlbmFtZSArICctcGFydC0nICsgcGFkKCB0aGlzLnBhcnQgKTtcclxuXHRcdFx0dGhpcy5zdGVwKCk7XHJcblx0XHR9LmJpbmQoIHRoaXMgKSApXHJcblx0fSBlbHNlIHtcclxuXHRcdHRoaXMuc3RlcCgpO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcbkNDV2ViTUVuY29kZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiggY2FsbGJhY2sgKSB7XHJcblxyXG4vL1x0aWYoICF0aGlzLmZyYW1lcy5sZW5ndGggKSByZXR1cm47XHJcblxyXG4gIHRoaXMudmlkZW9Xcml0ZXIuY29tcGxldGUoKS50aGVuKGNhbGxiYWNrKTtcclxuXHJcblx0Lyp2YXIgd2VibSA9IFdoYW1teS5mcm9tSW1hZ2VBcnJheSggdGhpcy5mcmFtZXMsIHRoaXMuc2V0dGluZ3MuZnJhbWVyYXRlIClcclxuXHR2YXIgYmxvYiA9IG5ldyBCbG9iKCBbIHdlYm0gXSwgeyB0eXBlOiBcIm9jdGV0L3N0cmVhbVwiIH0gKTtcclxuXHRjYWxsYmFjayggYmxvYiApOyovXHJcblxyXG59XHJcblxyXG5DQ1dlYk1FbmNvZGVyLnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5mcmFtZXMgPSBbXTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIENDRkZNcGVnU2VydmVyRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMsIHNldHRpbmdzICk7XHJcblxyXG5cdHNldHRpbmdzLnF1YWxpdHkgPSAoIHNldHRpbmdzLnF1YWxpdHkgLyAxMDAgKSB8fCAuODtcclxuXHJcblx0dGhpcy5lbmNvZGVyID0gbmV3IEZGTXBlZ1NlcnZlci5WaWRlbyggc2V0dGluZ3MgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ3Byb2Nlc3MnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLmVtaXQoICdwcm9jZXNzJyApXHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCdmaW5pc2hlZCcsIGZ1bmN0aW9uKCB1cmwsIHNpemUgKSB7XHJcbiAgICAgICAgdmFyIGNiID0gdGhpcy5jYWxsYmFjaztcclxuICAgICAgICBpZiAoIGNiICkge1xyXG4gICAgICAgICAgICB0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBjYiggdXJsLCBzaXplICk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ3Byb2dyZXNzJywgZnVuY3Rpb24oIHByb2dyZXNzICkge1xyXG4gICAgICAgIGlmICggdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzICkge1xyXG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MoIHByb2dyZXNzIClcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG4gICAgdGhpcy5lbmNvZGVyLm9uKCAnZXJyb3InLCBmdW5jdGlvbiggZGF0YSApIHtcclxuICAgICAgICBhbGVydChKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSk7XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoIENDRnJhbWVFbmNvZGVyLnByb3RvdHlwZSApO1xyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc3RhcnQoIHRoaXMuc2V0dGluZ3MgKTtcclxuXHJcbn07XHJcblxyXG5DQ0ZGTXBlZ1NlcnZlckVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdHRoaXMuZW5jb2Rlci5hZGQoIGNhbnZhcyApO1xyXG5cclxufVxyXG5cclxuQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuICAgIHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcclxuICAgIHRoaXMuZW5jb2Rlci5lbmQoKTtcclxuXHJcbn1cclxuXHJcbkNDRkZNcGVnU2VydmVyRW5jb2Rlci5wcm90b3R5cGUuc2FmZVRvUHJvY2VlZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZW5jb2Rlci5zYWZlVG9Qcm9jZWVkKCk7XHJcbn07XHJcblxyXG4vKlxyXG5cdEhUTUxDYW52YXNFbGVtZW50LmNhcHR1cmVTdHJlYW0oKVxyXG4qL1xyXG5cclxuZnVuY3Rpb24gQ0NTdHJlYW1FbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0dGhpcy5mcmFtZXJhdGUgPSB0aGlzLnNldHRpbmdzLmZyYW1lcmF0ZTtcclxuXHR0aGlzLnR5cGUgPSAndmlkZW8vd2VibSc7XHJcblx0dGhpcy5leHRlbnNpb24gPSAnLndlYm0nO1xyXG5cdHRoaXMuc3RyZWFtID0gbnVsbDtcclxuXHR0aGlzLm1lZGlhUmVjb3JkZXIgPSBudWxsO1xyXG5cdHRoaXMuY2h1bmtzID0gW107XHJcblxyXG59XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSggQ0NGcmFtZUVuY29kZXIucHJvdG90eXBlICk7XHJcblxyXG5DQ1N0cmVhbUVuY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCBjYW52YXMgKSB7XHJcblxyXG5cdGlmKCAhdGhpcy5zdHJlYW0gKSB7XHJcblx0XHR0aGlzLnN0cmVhbSA9IGNhbnZhcy5jYXB0dXJlU3RyZWFtKCB0aGlzLmZyYW1lcmF0ZSApO1xyXG5cdFx0dGhpcy5tZWRpYVJlY29yZGVyID0gbmV3IE1lZGlhUmVjb3JkZXIoIHRoaXMuc3RyZWFtICk7XHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIuc3RhcnQoKTtcclxuXHJcblx0XHR0aGlzLm1lZGlhUmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0XHR0aGlzLmNodW5rcy5wdXNoKGUuZGF0YSk7XHJcblx0XHR9LmJpbmQoIHRoaXMgKTtcclxuXHJcblx0fVxyXG5cdHRoaXMuc3RlcCgpO1xyXG5cclxufVxyXG5cclxuQ0NTdHJlYW1FbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuXHR0aGlzLm1lZGlhUmVjb3JkZXIub25zdG9wID0gZnVuY3Rpb24oIGUgKSB7XHJcblx0XHR2YXIgYmxvYiA9IG5ldyBCbG9iKCB0aGlzLmNodW5rcywgeyAndHlwZScgOiAndmlkZW8vd2VibScgfSk7XHJcblx0XHR0aGlzLmNodW5rcyA9IFtdO1xyXG5cdFx0Y2FsbGJhY2soIGJsb2IgKTtcclxuXHJcblx0fS5iaW5kKCB0aGlzICk7XHJcblxyXG5cdHRoaXMubWVkaWFSZWNvcmRlci5zdG9wKCk7XHJcblxyXG59XHJcblxyXG4vKmZ1bmN0aW9uIENDR0lGRW5jb2Rlciggc2V0dGluZ3MgKSB7XHJcblxyXG5cdENDRnJhbWVFbmNvZGVyLmNhbGwoIHRoaXMgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9IHNldHRpbmdzLnF1YWxpdHkgfHwgNjtcclxuXHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XHJcblxyXG5cdHRoaXMuZW5jb2RlciA9IG5ldyBHSUZFbmNvZGVyKCk7XHJcblx0dGhpcy5lbmNvZGVyLnNldFJlcGVhdCggMSApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldERlbGF5KCBzZXR0aW5ncy5zdGVwICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0UXVhbGl0eSggNiApO1xyXG4gIFx0dGhpcy5lbmNvZGVyLnNldFRyYW5zcGFyZW50KCBudWxsICk7XHJcbiAgXHR0aGlzLmVuY29kZXIuc2V0U2l6ZSggMTUwLCAxNTAgKTtcclxuXHJcbiAgXHR0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcbiAgXHR0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoICcyZCcgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2RlciApO1xyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHR0aGlzLmVuY29kZXIuc3RhcnQoKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0dGhpcy5jYW52YXMud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0dGhpcy5jYW52YXMuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHR0aGlzLmN0eC5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cdHRoaXMuZW5jb2Rlci5hZGRGcmFtZSggdGhpcy5jdHggKTtcclxuXHJcblx0dGhpcy5lbmNvZGVyLnNldFNpemUoIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCApO1xyXG5cdHZhciByZWFkQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoY2FudmFzLndpZHRoICogY2FudmFzLmhlaWdodCAqIDQpO1xyXG5cdHZhciBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKTtcclxuXHRjb250ZXh0LnJlYWRQaXhlbHMoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0LCBjb250ZXh0LlJHQkEsIGNvbnRleHQuVU5TSUdORURfQllURSwgcmVhZEJ1ZmZlcik7XHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCByZWFkQnVmZmVyLCB0cnVlICk7XHJcblxyXG59XHJcblxyXG5DQ0dJRkVuY29kZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmZpbmlzaCgpO1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuXHR2YXIgYmluYXJ5X2dpZiA9IHRoaXMuZW5jb2Rlci5zdHJlYW0oKS5nZXREYXRhKCk7XHJcblxyXG5cdHZhciBkYXRhX3VybCA9ICdkYXRhOmltYWdlL2dpZjtiYXNlNjQsJytlbmNvZGU2NChiaW5hcnlfZ2lmKTtcclxuXHR3aW5kb3cubG9jYXRpb24gPSBkYXRhX3VybDtcclxuXHRyZXR1cm47XHJcblxyXG5cdHZhciBibG9iID0gbmV3IEJsb2IoIFsgYmluYXJ5X2dpZiBdLCB7IHR5cGU6IFwib2N0ZXQvc3RyZWFtXCIgfSApO1xyXG5cdHZhciB1cmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTCggYmxvYiApO1xyXG5cdGNhbGxiYWNrKCB1cmwgKTtcclxuXHJcbn0qL1xyXG5cclxuZnVuY3Rpb24gQ0NHSUZFbmNvZGVyKCBzZXR0aW5ncyApIHtcclxuXHJcblx0Q0NGcmFtZUVuY29kZXIuY2FsbCggdGhpcywgc2V0dGluZ3MgKTtcclxuXHJcblx0c2V0dGluZ3MucXVhbGl0eSA9IDMxIC0gKCAoIHNldHRpbmdzLnF1YWxpdHkgKiAzMCAvIDEwMCApIHx8IDEwICk7XHJcblx0c2V0dGluZ3Mud29ya2VycyA9IHNldHRpbmdzLndvcmtlcnMgfHwgNDtcclxuXHJcblx0dGhpcy5leHRlbnNpb24gPSAnLmdpZidcclxuXHR0aGlzLm1pbWVUeXBlID0gJ2ltYWdlL2dpZidcclxuXHJcbiAgXHR0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7XHJcbiAgXHR0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoICcyZCcgKTtcclxuICBcdHRoaXMuc2l6ZVNldCA9IGZhbHNlO1xyXG5cclxuICBcdHRoaXMuZW5jb2RlciA9IG5ldyBHSUYoe1xyXG5cdFx0d29ya2Vyczogc2V0dGluZ3Mud29ya2VycyxcclxuXHRcdHF1YWxpdHk6IHNldHRpbmdzLnF1YWxpdHksXHJcblx0XHR3b3JrZXJTY3JpcHQ6IHNldHRpbmdzLndvcmtlcnNQYXRoICsgJ2dpZi53b3JrZXIuanMnXHJcblx0fSApO1xyXG5cclxuICAgIHRoaXMuZW5jb2Rlci5vbiggJ3Byb2dyZXNzJywgZnVuY3Rpb24oIHByb2dyZXNzICkge1xyXG4gICAgICAgIGlmICggdGhpcy5zZXR0aW5ncy5vblByb2dyZXNzICkge1xyXG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLm9uUHJvZ3Jlc3MoIHByb2dyZXNzIClcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQoIHRoaXMgKSApO1xyXG5cclxuICAgIHRoaXMuZW5jb2Rlci5vbignZmluaXNoZWQnLCBmdW5jdGlvbiggYmxvYiApIHtcclxuICAgICAgICB2YXIgY2IgPSB0aGlzLmNhbGxiYWNrO1xyXG4gICAgICAgIGlmICggY2IgKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGNiKCBibG9iICk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKCB0aGlzICkgKTtcclxuXHJcbn1cclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCBDQ0ZyYW1lRW5jb2Rlci5wcm90b3R5cGUgKTtcclxuXHJcbkNDR0lGRW5jb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oIGNhbnZhcyApIHtcclxuXHJcblx0aWYoICF0aGlzLnNpemVTZXQgKSB7XHJcblx0XHR0aGlzLmVuY29kZXIuc2V0T3B0aW9uKCAnd2lkdGgnLGNhbnZhcy53aWR0aCApO1xyXG5cdFx0dGhpcy5lbmNvZGVyLnNldE9wdGlvbiggJ2hlaWdodCcsY2FudmFzLmhlaWdodCApO1xyXG5cdFx0dGhpcy5zaXplU2V0ID0gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdHRoaXMuY2FudmFzLndpZHRoID0gY2FudmFzLndpZHRoO1xyXG5cdHRoaXMuY2FudmFzLmhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XHJcblx0dGhpcy5jdHguZHJhd0ltYWdlKCBjYW52YXMsIDAsIDAgKTtcclxuXHJcblx0dGhpcy5lbmNvZGVyLmFkZEZyYW1lKCB0aGlzLmN0eCwgeyBjb3B5OiB0cnVlLCBkZWxheTogdGhpcy5zZXR0aW5ncy5zdGVwIH0gKTtcclxuXHR0aGlzLnN0ZXAoKTtcclxuXHJcblx0Lyp0aGlzLmVuY29kZXIuc2V0U2l6ZSggY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0ICk7XHJcblx0dmFyIHJlYWRCdWZmZXIgPSBuZXcgVWludDhBcnJheShjYW52YXMud2lkdGggKiBjYW52YXMuaGVpZ2h0ICogNCk7XHJcblx0dmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApO1xyXG5cdGNvbnRleHQucmVhZFBpeGVscygwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQsIGNvbnRleHQuUkdCQSwgY29udGV4dC5VTlNJR05FRF9CWVRFLCByZWFkQnVmZmVyKTtcclxuXHR0aGlzLmVuY29kZXIuYWRkRnJhbWUoIHJlYWRCdWZmZXIsIHRydWUgKTsqL1xyXG5cclxufVxyXG5cclxuQ0NHSUZFbmNvZGVyLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cclxuICAgIHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcclxuXHJcblx0dGhpcy5lbmNvZGVyLnJlbmRlcigpO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gQ0NhcHR1cmUoIHNldHRpbmdzICkge1xyXG5cclxuXHR2YXIgX3NldHRpbmdzID0gc2V0dGluZ3MgfHwge30sXHJcblx0XHRfZGF0ZSA9IG5ldyBEYXRlKCksXHJcblx0XHRfdmVyYm9zZSxcclxuXHRcdF9kaXNwbGF5LFxyXG5cdFx0X3RpbWUsXHJcblx0XHRfc3RhcnRUaW1lLFxyXG5cdFx0X3BlcmZvcm1hbmNlVGltZSxcclxuXHRcdF9wZXJmb3JtYW5jZVN0YXJ0VGltZSxcclxuXHRcdF9zdGVwLFxyXG4gICAgICAgIF9lbmNvZGVyLFxyXG5cdFx0X3RpbWVvdXRzID0gW10sXHJcblx0XHRfaW50ZXJ2YWxzID0gW10sXHJcblx0XHRfZnJhbWVDb3VudCA9IDAsXHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA9IDAsXHJcblx0XHRfbGFzdEZyYW1lID0gbnVsbCxcclxuXHRcdF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MgPSBbXSxcclxuXHRcdF9jYXB0dXJpbmcgPSBmYWxzZSxcclxuICAgICAgICBfaGFuZGxlcnMgPSB7fTtcclxuXHJcblx0X3NldHRpbmdzLmZyYW1lcmF0ZSA9IF9zZXR0aW5ncy5mcmFtZXJhdGUgfHwgNjA7XHJcblx0X3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgPSAyICogKCBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyB8fCAxICk7XHJcblx0X3ZlcmJvc2UgPSBfc2V0dGluZ3MudmVyYm9zZSB8fCBmYWxzZTtcclxuXHRfZGlzcGxheSA9IF9zZXR0aW5ncy5kaXNwbGF5IHx8IGZhbHNlO1xyXG5cdF9zZXR0aW5ncy5zdGVwID0gMTAwMC4wIC8gX3NldHRpbmdzLmZyYW1lcmF0ZSA7XHJcblx0X3NldHRpbmdzLnRpbWVMaW1pdCA9IF9zZXR0aW5ncy50aW1lTGltaXQgfHwgMDtcclxuXHRfc2V0dGluZ3MuZnJhbWVMaW1pdCA9IF9zZXR0aW5ncy5mcmFtZUxpbWl0IHx8IDA7XHJcblx0X3NldHRpbmdzLnN0YXJ0VGltZSA9IF9zZXR0aW5ncy5zdGFydFRpbWUgfHwgMDtcclxuXHJcblx0dmFyIF90aW1lRGlzcGxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUubGVmdCA9IF90aW1lRGlzcGxheS5zdHlsZS50b3AgPSAwXHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdibGFjayc7XHJcblx0X3RpbWVEaXNwbGF5LnN0eWxlLmZvbnRGYW1pbHkgPSAnbW9ub3NwYWNlJ1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5mb250U2l6ZSA9ICcxMXB4J1xyXG5cdF90aW1lRGlzcGxheS5zdHlsZS5wYWRkaW5nID0gJzVweCdcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuY29sb3IgPSAncmVkJztcclxuXHRfdGltZURpc3BsYXkuc3R5bGUuekluZGV4ID0gMTAwMDAwXHJcblx0aWYoIF9zZXR0aW5ncy5kaXNwbGF5ICkgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggX3RpbWVEaXNwbGF5ICk7XHJcblxyXG5cdHZhciBjYW52YXNNb3Rpb25CbHVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKTtcclxuXHR2YXIgY3R4TW90aW9uQmx1ciA9IGNhbnZhc01vdGlvbkJsdXIuZ2V0Q29udGV4dCggJzJkJyApO1xyXG5cdHZhciBidWZmZXJNb3Rpb25CbHVyO1xyXG5cdHZhciBpbWFnZURhdGE7XHJcblxyXG5cdF9sb2coICdTdGVwIGlzIHNldCB0byAnICsgX3NldHRpbmdzLnN0ZXAgKyAnbXMnICk7XHJcblxyXG4gICAgdmFyIF9lbmNvZGVycyA9IHtcclxuXHRcdGdpZjogQ0NHSUZFbmNvZGVyLFxyXG5cdFx0d2VibTogQ0NXZWJNRW5jb2RlcixcclxuXHRcdGZmbXBlZ3NlcnZlcjogQ0NGRk1wZWdTZXJ2ZXJFbmNvZGVyLFxyXG5cdFx0cG5nOiBDQ1BOR0VuY29kZXIsXHJcblx0XHRqcGc6IENDSlBFR0VuY29kZXIsXHJcblx0XHQnd2VibS1tZWRpYXJlY29yZGVyJzogQ0NTdHJlYW1FbmNvZGVyXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBjdG9yID0gX2VuY29kZXJzWyBfc2V0dGluZ3MuZm9ybWF0IF07XHJcbiAgICBpZiAoICFjdG9yICkge1xyXG5cdFx0dGhyb3cgXCJFcnJvcjogSW5jb3JyZWN0IG9yIG1pc3NpbmcgZm9ybWF0OiBWYWxpZCBmb3JtYXRzIGFyZSBcIiArIE9iamVjdC5rZXlzKF9lbmNvZGVycykuam9pbihcIiwgXCIpO1xyXG4gICAgfVxyXG4gICAgX2VuY29kZXIgPSBuZXcgY3RvciggX3NldHRpbmdzICk7XHJcbiAgICBfZW5jb2Rlci5zdGVwID0gX3N0ZXBcclxuXHJcblx0X2VuY29kZXIub24oJ3Byb2Nlc3MnLCBfcHJvY2Vzcyk7XHJcbiAgICBfZW5jb2Rlci5vbigncHJvZ3Jlc3MnLCBfcHJvZ3Jlc3MpO1xyXG5cclxuICAgIGlmIChcInBlcmZvcm1hbmNlXCIgaW4gd2luZG93ID09IGZhbHNlKSB7XHJcbiAgICBcdHdpbmRvdy5wZXJmb3JtYW5jZSA9IHt9O1xyXG4gICAgfVxyXG5cclxuXHREYXRlLm5vdyA9IChEYXRlLm5vdyB8fCBmdW5jdGlvbiAoKSB7ICAvLyB0aGFua3MgSUU4XHJcblx0XHRyZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcblx0fSk7XHJcblxyXG5cdGlmIChcIm5vd1wiIGluIHdpbmRvdy5wZXJmb3JtYW5jZSA9PSBmYWxzZSl7XHJcblxyXG5cdFx0dmFyIG5vd09mZnNldCA9IERhdGUubm93KCk7XHJcblxyXG5cdFx0aWYgKHBlcmZvcm1hbmNlLnRpbWluZyAmJiBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0KXtcclxuXHRcdFx0bm93T2Zmc2V0ID0gcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydFxyXG5cdFx0fVxyXG5cclxuXHRcdHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbiBub3coKXtcclxuXHRcdFx0cmV0dXJuIERhdGUubm93KCkgLSBub3dPZmZzZXQ7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR2YXIgX29sZFNldFRpbWVvdXQgPSB3aW5kb3cuc2V0VGltZW91dCxcclxuXHRcdF9vbGRTZXRJbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCxcclxuXHQgICAgXHRfb2xkQ2xlYXJJbnRlcnZhbCA9IHdpbmRvdy5jbGVhckludGVydmFsLFxyXG5cdFx0X29sZENsZWFyVGltZW91dCA9IHdpbmRvdy5jbGVhclRpbWVvdXQsXHJcblx0XHRfb2xkUmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSxcclxuXHRcdF9vbGROb3cgPSB3aW5kb3cuRGF0ZS5ub3csXHJcblx0XHRfb2xkUGVyZm9ybWFuY2VOb3cgPSB3aW5kb3cucGVyZm9ybWFuY2Uubm93LFxyXG5cdFx0X29sZEdldFRpbWUgPSB3aW5kb3cuRGF0ZS5wcm90b3R5cGUuZ2V0VGltZTtcclxuXHQvLyBEYXRlLnByb3RvdHlwZS5fb2xkR2V0VGltZSA9IERhdGUucHJvdG90eXBlLmdldFRpbWU7XHJcblxyXG5cdHZhciBtZWRpYSA9IFtdO1xyXG5cclxuXHRmdW5jdGlvbiBfaW5pdCgpIHtcclxuXHJcblx0XHRfbG9nKCAnQ2FwdHVyZXIgc3RhcnQnICk7XHJcblxyXG5cdFx0X3N0YXJ0VGltZSA9IHdpbmRvdy5EYXRlLm5vdygpO1xyXG5cdFx0X3RpbWUgPSBfc3RhcnRUaW1lICsgX3NldHRpbmdzLnN0YXJ0VGltZTtcclxuXHRcdF9wZXJmb3JtYW5jZVN0YXJ0VGltZSA9IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTtcclxuXHRcdF9wZXJmb3JtYW5jZVRpbWUgPSBfcGVyZm9ybWFuY2VTdGFydFRpbWUgKyBfc2V0dGluZ3Muc3RhcnRUaW1lO1xyXG5cclxuXHRcdHdpbmRvdy5EYXRlLnByb3RvdHlwZS5nZXRUaW1lID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0cmV0dXJuIF90aW1lO1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5EYXRlLm5vdyA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRyZXR1cm4gX3RpbWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oIGNhbGxiYWNrLCB0aW1lICkge1xyXG5cdFx0XHR2YXIgdCA9IHtcclxuXHRcdFx0XHRjYWxsYmFjazogY2FsbGJhY2ssXHJcblx0XHRcdFx0dGltZTogdGltZSxcclxuXHRcdFx0XHR0cmlnZ2VyVGltZTogX3RpbWUgKyB0aW1lXHJcblx0XHRcdH07XHJcblx0XHRcdF90aW1lb3V0cy5wdXNoKCB0ICk7XHJcblx0XHRcdF9sb2coICdUaW1lb3V0IHNldCB0byAnICsgdC50aW1lICk7XHJcbiAgICAgICAgICAgIHJldHVybiB0O1xyXG5cdFx0fTtcclxuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQgPSBmdW5jdGlvbiggaWQgKSB7XHJcblx0XHRcdGZvciggdmFyIGogPSAwOyBqIDwgX3RpbWVvdXRzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRcdGlmKCBfdGltZW91dHNbIGogXSA9PSBpZCApIHtcclxuXHRcdFx0XHRcdF90aW1lb3V0cy5zcGxpY2UoIGosIDEgKTtcclxuXHRcdFx0XHRcdF9sb2coICdUaW1lb3V0IGNsZWFyZWQnICk7XHJcblx0XHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblx0XHR3aW5kb3cuc2V0SW50ZXJ2YWwgPSBmdW5jdGlvbiggY2FsbGJhY2ssIHRpbWUgKSB7XHJcblx0XHRcdHZhciB0ID0ge1xyXG5cdFx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0XHR0aW1lOiB0aW1lLFxyXG5cdFx0XHRcdHRyaWdnZXJUaW1lOiBfdGltZSArIHRpbWVcclxuXHRcdFx0fTtcclxuXHRcdFx0X2ludGVydmFscy5wdXNoKCB0ICk7XHJcblx0XHRcdF9sb2coICdJbnRlcnZhbCBzZXQgdG8gJyArIHQudGltZSApO1xyXG5cdFx0XHRyZXR1cm4gdDtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKCBpZCApIHtcclxuXHRcdFx0X2xvZyggJ2NsZWFyIEludGVydmFsJyApO1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH07XHJcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oIGNhbGxiYWNrICkge1xyXG5cdFx0XHRfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzLnB1c2goIGNhbGxiYWNrICk7XHJcblx0XHR9O1xyXG5cdFx0d2luZG93LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uKCl7XHJcblx0XHRcdHJldHVybiBfcGVyZm9ybWFuY2VUaW1lO1xyXG5cdFx0fTtcclxuXHJcblx0XHRmdW5jdGlvbiBob29rQ3VycmVudFRpbWUoKSB7XHJcblx0XHRcdGlmKCAhdGhpcy5faG9va2VkICkge1xyXG5cdFx0XHRcdHRoaXMuX2hvb2tlZCA9IHRydWU7XHJcblx0XHRcdFx0dGhpcy5faG9va2VkVGltZSA9IHRoaXMuY3VycmVudFRpbWUgfHwgMDtcclxuXHRcdFx0XHR0aGlzLnBhdXNlKCk7XHJcblx0XHRcdFx0bWVkaWEucHVzaCggdGhpcyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB0aGlzLl9ob29rZWRUaW1lICsgX3NldHRpbmdzLnN0YXJ0VGltZTtcclxuXHRcdH07XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCBIVE1MVmlkZW9FbGVtZW50LnByb3RvdHlwZSwgJ2N1cnJlbnRUaW1lJywgeyBnZXQ6IGhvb2tDdXJyZW50VGltZSB9IClcclxuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KCBIVE1MQXVkaW9FbGVtZW50LnByb3RvdHlwZSwgJ2N1cnJlbnRUaW1lJywgeyBnZXQ6IGhvb2tDdXJyZW50VGltZSB9IClcclxuXHRcdH0gY2F0Y2ggKGVycikge1xyXG5cdFx0XHRfbG9nKGVycik7XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0YXJ0KCkge1xyXG5cdFx0X2luaXQoKTtcclxuXHRcdF9lbmNvZGVyLnN0YXJ0KCk7XHJcblx0XHRfY2FwdHVyaW5nID0gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zdG9wKCkge1xyXG5cdFx0X2NhcHR1cmluZyA9IGZhbHNlO1xyXG5cdFx0X2VuY29kZXIuc3RvcCgpO1xyXG5cdFx0X2Rlc3Ryb3koKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jYWxsKCBmbiwgcCApIHtcclxuXHRcdF9vbGRTZXRUaW1lb3V0KCBmbiwgMCwgcCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3N0ZXAoKSB7XHJcblx0XHQvL19vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIF9wcm9jZXNzICk7XHJcblx0XHRfY2FsbCggX3Byb2Nlc3MgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9kZXN0cm95KCkge1xyXG5cdFx0X2xvZyggJ0NhcHR1cmVyIHN0b3AnICk7XHJcblx0XHR3aW5kb3cuc2V0VGltZW91dCA9IF9vbGRTZXRUaW1lb3V0O1xyXG5cdFx0d2luZG93LnNldEludGVydmFsID0gX29sZFNldEludGVydmFsO1xyXG5cdFx0d2luZG93LmNsZWFySW50ZXJ2YWwgPSBfb2xkQ2xlYXJJbnRlcnZhbDtcclxuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQgPSBfb2xkQ2xlYXJUaW1lb3V0O1xyXG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IF9vbGRSZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XHJcblx0XHR3aW5kb3cuRGF0ZS5wcm90b3R5cGUuZ2V0VGltZSA9IF9vbGRHZXRUaW1lO1xyXG5cdFx0d2luZG93LkRhdGUubm93ID0gX29sZE5vdztcclxuXHRcdHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBfb2xkUGVyZm9ybWFuY2VOb3c7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfdXBkYXRlVGltZSgpIHtcclxuXHRcdHZhciBzZWNvbmRzID0gX2ZyYW1lQ291bnQgLyBfc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdFx0aWYoICggX3NldHRpbmdzLmZyYW1lTGltaXQgJiYgX2ZyYW1lQ291bnQgPj0gX3NldHRpbmdzLmZyYW1lTGltaXQgKSB8fCAoIF9zZXR0aW5ncy50aW1lTGltaXQgJiYgc2Vjb25kcyA+PSBfc2V0dGluZ3MudGltZUxpbWl0ICkgKSB7XHJcblx0XHRcdF9zdG9wKCk7XHJcblx0XHRcdF9zYXZlKCk7XHJcblx0XHR9XHJcblx0XHR2YXIgZCA9IG5ldyBEYXRlKCBudWxsICk7XHJcblx0XHRkLnNldFNlY29uZHMoIHNlY29uZHMgKTtcclxuXHRcdGlmKCBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA+IDIgKSB7XHJcblx0XHRcdF90aW1lRGlzcGxheS50ZXh0Q29udGVudCA9ICdDQ2FwdHVyZSAnICsgX3NldHRpbmdzLmZvcm1hdCArICcgfCAnICsgX2ZyYW1lQ291bnQgKyAnIGZyYW1lcyAoJyArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ICsgJyBpbnRlcikgfCAnICsgIGQudG9JU09TdHJpbmcoKS5zdWJzdHIoIDExLCA4ICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRfdGltZURpc3BsYXkudGV4dENvbnRlbnQgPSAnQ0NhcHR1cmUgJyArIF9zZXR0aW5ncy5mb3JtYXQgKyAnIHwgJyArIF9mcmFtZUNvdW50ICsgJyBmcmFtZXMgfCAnICsgIGQudG9JU09TdHJpbmcoKS5zdWJzdHIoIDExLCA4ICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2hlY2tGcmFtZSggY2FudmFzICkge1xyXG5cclxuXHRcdGlmKCBjYW52YXNNb3Rpb25CbHVyLndpZHRoICE9PSBjYW52YXMud2lkdGggfHwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgIT09IGNhbnZhcy5oZWlnaHQgKSB7XHJcblx0XHRcdGNhbnZhc01vdGlvbkJsdXIud2lkdGggPSBjYW52YXMud2lkdGg7XHJcblx0XHRcdGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1ciA9IG5ldyBVaW50MTZBcnJheSggY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKiBjYW52YXNNb3Rpb25CbHVyLndpZHRoICogNCApO1xyXG5cdFx0XHRjdHhNb3Rpb25CbHVyLmZpbGxTdHlsZSA9ICcjMCdcclxuXHRcdFx0Y3R4TW90aW9uQmx1ci5maWxsUmVjdCggMCwgMCwgY2FudmFzTW90aW9uQmx1ci53aWR0aCwgY2FudmFzTW90aW9uQmx1ci5oZWlnaHQgKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfYmxlbmRGcmFtZSggY2FudmFzICkge1xyXG5cclxuXHRcdC8vX2xvZyggJ0ludGVybWVkaWF0ZSBGcmFtZTogJyArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50ICk7XHJcblxyXG5cdFx0Y3R4TW90aW9uQmx1ci5kcmF3SW1hZ2UoIGNhbnZhcywgMCwgMCApO1xyXG5cdFx0aW1hZ2VEYXRhID0gY3R4TW90aW9uQmx1ci5nZXRJbWFnZURhdGEoIDAsIDAsIGNhbnZhc01vdGlvbkJsdXIud2lkdGgsIGNhbnZhc01vdGlvbkJsdXIuaGVpZ2h0ICk7XHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IGJ1ZmZlck1vdGlvbkJsdXIubGVuZ3RoOyBqKz0gNCApIHtcclxuXHRcdFx0YnVmZmVyTW90aW9uQmx1clsgaiBdICs9IGltYWdlRGF0YS5kYXRhWyBqIF07XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAxIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogKyAxIF07XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAyIF0gKz0gaW1hZ2VEYXRhLmRhdGFbIGogKyAyIF07XHJcblx0XHR9XHJcblx0XHRfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCsrO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9zYXZlRnJhbWUoKXtcclxuXHJcblx0XHR2YXIgZGF0YSA9IGltYWdlRGF0YS5kYXRhO1xyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBidWZmZXJNb3Rpb25CbHVyLmxlbmd0aDsgais9IDQgKSB7XHJcblx0XHRcdGRhdGFbIGogXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogXSAqIDIgLyBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcztcclxuXHRcdFx0ZGF0YVsgaiArIDEgXSA9IGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAxIF0gKiAyIC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXM7XHJcblx0XHRcdGRhdGFbIGogKyAyIF0gPSBidWZmZXJNb3Rpb25CbHVyWyBqICsgMiBdICogMiAvIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzO1xyXG5cdFx0fVxyXG5cdFx0Y3R4TW90aW9uQmx1ci5wdXRJbWFnZURhdGEoIGltYWdlRGF0YSwgMCwgMCApO1xyXG5cdFx0X2VuY29kZXIuYWRkKCBjYW52YXNNb3Rpb25CbHVyICk7XHJcblx0XHRfZnJhbWVDb3VudCsrO1xyXG5cdFx0X2ludGVybWVkaWF0ZUZyYW1lQ291bnQgPSAwO1xyXG5cdFx0X2xvZyggJ0Z1bGwgTUIgRnJhbWUhICcgKyBfZnJhbWVDb3VudCArICcgJyArICBfdGltZSApO1xyXG5cdFx0Zm9yKCB2YXIgaiA9IDA7IGogPCBidWZmZXJNb3Rpb25CbHVyLmxlbmd0aDsgais9IDQgKSB7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogXSA9IDA7XHJcblx0XHRcdGJ1ZmZlck1vdGlvbkJsdXJbIGogKyAxIF0gPSAwO1xyXG5cdFx0XHRidWZmZXJNb3Rpb25CbHVyWyBqICsgMiBdID0gMDtcclxuXHRcdH1cclxuXHRcdGdjKCk7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX2NhcHR1cmUoIGNhbnZhcyApIHtcclxuXHJcblx0XHRpZiggX2NhcHR1cmluZyApIHtcclxuXHJcblx0XHRcdGlmKCBfc2V0dGluZ3MubW90aW9uQmx1ckZyYW1lcyA+IDIgKSB7XHJcblxyXG5cdFx0XHRcdF9jaGVja0ZyYW1lKCBjYW52YXMgKTtcclxuXHRcdFx0XHRfYmxlbmRGcmFtZSggY2FudmFzICk7XHJcblxyXG5cdFx0XHRcdGlmKCBfaW50ZXJtZWRpYXRlRnJhbWVDb3VudCA+PSAuNSAqIF9zZXR0aW5ncy5tb3Rpb25CbHVyRnJhbWVzICkge1xyXG5cdFx0XHRcdFx0X3NhdmVGcmFtZSgpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRfc3RlcCgpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0X2VuY29kZXIuYWRkKCBjYW52YXMgKTtcclxuXHRcdFx0XHRfZnJhbWVDb3VudCsrO1xyXG5cdFx0XHRcdF9sb2coICdGdWxsIEZyYW1lISAnICsgX2ZyYW1lQ291bnQgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfcHJvY2VzcygpIHtcclxuXHJcblx0XHR2YXIgc3RlcCA9IDEwMDAgLyBfc2V0dGluZ3MuZnJhbWVyYXRlO1xyXG5cdFx0dmFyIGR0ID0gKCBfZnJhbWVDb3VudCArIF9pbnRlcm1lZGlhdGVGcmFtZUNvdW50IC8gX3NldHRpbmdzLm1vdGlvbkJsdXJGcmFtZXMgKSAqIHN0ZXA7XHJcblxyXG5cdFx0X3RpbWUgPSBfc3RhcnRUaW1lICsgZHQ7XHJcblx0XHRfcGVyZm9ybWFuY2VUaW1lID0gX3BlcmZvcm1hbmNlU3RhcnRUaW1lICsgZHQ7XHJcblxyXG5cdFx0bWVkaWEuZm9yRWFjaCggZnVuY3Rpb24oIHYgKSB7XHJcblx0XHRcdHYuX2hvb2tlZFRpbWUgPSBkdCAvIDEwMDA7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0X3VwZGF0ZVRpbWUoKTtcclxuXHRcdF9sb2coICdGcmFtZTogJyArIF9mcmFtZUNvdW50ICsgJyAnICsgX2ludGVybWVkaWF0ZUZyYW1lQ291bnQgKTtcclxuXHJcblx0XHRmb3IoIHZhciBqID0gMDsgaiA8IF90aW1lb3V0cy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0aWYoIF90aW1lID49IF90aW1lb3V0c1sgaiBdLnRyaWdnZXJUaW1lICkge1xyXG5cdFx0XHRcdF9jYWxsKCBfdGltZW91dHNbIGogXS5jYWxsYmFjayApXHJcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyggJ3RpbWVvdXQhJyApO1xyXG5cdFx0XHRcdF90aW1lb3V0cy5zcGxpY2UoIGosIDEgKTtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGZvciggdmFyIGogPSAwOyBqIDwgX2ludGVydmFscy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0aWYoIF90aW1lID49IF9pbnRlcnZhbHNbIGogXS50cmlnZ2VyVGltZSApIHtcclxuXHRcdFx0XHRfY2FsbCggX2ludGVydmFsc1sgaiBdLmNhbGxiYWNrICk7XHJcblx0XHRcdFx0X2ludGVydmFsc1sgaiBdLnRyaWdnZXJUaW1lICs9IF9pbnRlcnZhbHNbIGogXS50aW1lO1xyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coICdpbnRlcnZhbCEnICk7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRfcmVxdWVzdEFuaW1hdGlvbkZyYW1lQ2FsbGJhY2tzLmZvckVhY2goIGZ1bmN0aW9uKCBjYiApIHtcclxuICAgICBcdFx0X2NhbGwoIGNiLCBfdGltZSAtIGdfc3RhcnRUaW1lICk7XHJcbiAgICAgICAgfSApO1xyXG4gICAgICAgIF9yZXF1ZXN0QW5pbWF0aW9uRnJhbWVDYWxsYmFja3MgPSBbXTtcclxuXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc2F2ZSggY2FsbGJhY2sgKSB7XHJcblxyXG5cdFx0aWYoICFjYWxsYmFjayApIHtcclxuXHRcdFx0Y2FsbGJhY2sgPSBmdW5jdGlvbiggYmxvYiApIHtcclxuXHRcdFx0XHRkb3dubG9hZCggYmxvYiwgX2VuY29kZXIuZmlsZW5hbWUgKyBfZW5jb2Rlci5leHRlbnNpb24sIF9lbmNvZGVyLm1pbWVUeXBlICk7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRfZW5jb2Rlci5zYXZlKCBjYWxsYmFjayApO1xyXG5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9sb2coIG1lc3NhZ2UgKSB7XHJcblx0XHRpZiggX3ZlcmJvc2UgKSBjb25zb2xlLmxvZyggbWVzc2FnZSApO1xyXG5cdH1cclxuXHJcbiAgICBmdW5jdGlvbiBfb24oIGV2ZW50LCBoYW5kbGVyICkge1xyXG5cclxuICAgICAgICBfaGFuZGxlcnNbZXZlbnRdID0gaGFuZGxlcjtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2VtaXQoIGV2ZW50ICkge1xyXG5cclxuICAgICAgICB2YXIgaGFuZGxlciA9IF9oYW5kbGVyc1tldmVudF07XHJcbiAgICAgICAgaWYgKCBoYW5kbGVyICkge1xyXG5cclxuICAgICAgICAgICAgaGFuZGxlci5hcHBseSggbnVsbCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGFyZ3VtZW50cywgMSApICk7XHJcblxyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX3Byb2dyZXNzKCBwcm9ncmVzcyApIHtcclxuXHJcbiAgICAgICAgX2VtaXQoICdwcm9ncmVzcycsIHByb2dyZXNzICk7XHJcblxyXG4gICAgfVxyXG5cclxuXHRyZXR1cm4ge1xyXG5cdFx0c3RhcnQ6IF9zdGFydCxcclxuXHRcdGNhcHR1cmU6IF9jYXB0dXJlLFxyXG5cdFx0c3RvcDogX3N0b3AsXHJcblx0XHRzYXZlOiBfc2F2ZSxcclxuICAgICAgICBvbjogX29uXHJcblx0fVxyXG59XHJcblxyXG4oZnJlZVdpbmRvdyB8fCBmcmVlU2VsZiB8fCB7fSkuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxuXHJcbiAgLy8gU29tZSBBTUQgYnVpbGQgb3B0aW1pemVycyBsaWtlIHIuanMgY2hlY2sgZm9yIGNvbmRpdGlvbiBwYXR0ZXJucyBsaWtlIHRoZSBmb2xsb3dpbmc6XHJcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XHJcbiAgICAvLyBEZWZpbmUgYXMgYW4gYW5vbnltb3VzIG1vZHVsZSBzbywgdGhyb3VnaCBwYXRoIG1hcHBpbmcsIGl0IGNhbiBiZVxyXG4gICAgLy8gcmVmZXJlbmNlZCBhcyB0aGUgXCJ1bmRlcnNjb3JlXCIgbW9kdWxlLlxyXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xyXG4gICAgXHRyZXR1cm4gQ0NhcHR1cmU7XHJcbiAgICB9KTtcclxufVxyXG4gIC8vIENoZWNrIGZvciBgZXhwb3J0c2AgYWZ0ZXIgYGRlZmluZWAgaW4gY2FzZSBhIGJ1aWxkIG9wdGltaXplciBhZGRzIGFuIGBleHBvcnRzYCBvYmplY3QuXHJcbiAgZWxzZSBpZiAoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSkge1xyXG4gICAgLy8gRXhwb3J0IGZvciBOb2RlLmpzLlxyXG4gICAgaWYgKG1vZHVsZUV4cG9ydHMpIHtcclxuICAgIFx0KGZyZWVNb2R1bGUuZXhwb3J0cyA9IENDYXB0dXJlKS5DQ2FwdHVyZSA9IENDYXB0dXJlO1xyXG4gICAgfVxyXG4gICAgLy8gRXhwb3J0IGZvciBDb21tb25KUyBzdXBwb3J0LlxyXG4gICAgZnJlZUV4cG9ydHMuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxufVxyXG5lbHNlIHtcclxuICAgIC8vIEV4cG9ydCB0byB0aGUgZ2xvYmFsIG9iamVjdC5cclxuICAgIHJvb3QuQ0NhcHR1cmUgPSBDQ2FwdHVyZTtcclxufVxyXG5cclxufSgpKTtcclxuIiwiLyoqXG4gKiBAYXV0aG9yIGFsdGVyZWRxIC8gaHR0cDovL2FsdGVyZWRxdWFsaWEuY29tL1xuICogQGF1dGhvciBtci5kb29iIC8gaHR0cDovL21yZG9vYi5jb20vXG4gKi9cblxudmFyIERldGVjdG9yID0ge1xuXG5cdGNhbnZhczogISEgd2luZG93LkNhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCxcblx0d2ViZ2w6ICggZnVuY3Rpb24gKCkge1xuXG5cdFx0dHJ5IHtcblxuXHRcdFx0dmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7IHJldHVybiAhISAoIHdpbmRvdy5XZWJHTFJlbmRlcmluZ0NvbnRleHQgJiYgKCBjYW52YXMuZ2V0Q29udGV4dCggJ3dlYmdsJyApIHx8IGNhbnZhcy5nZXRDb250ZXh0KCAnZXhwZXJpbWVudGFsLXdlYmdsJyApICkgKTtcblxuXHRcdH0gY2F0Y2ggKCBlICkge1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cblx0XHR9XG5cblx0fSApKCksXG5cdHdvcmtlcnM6ICEhIHdpbmRvdy5Xb3JrZXIsXG5cdGZpbGVhcGk6IHdpbmRvdy5GaWxlICYmIHdpbmRvdy5GaWxlUmVhZGVyICYmIHdpbmRvdy5GaWxlTGlzdCAmJiB3aW5kb3cuQmxvYixcblxuXHRnZXRXZWJHTEVycm9yTWVzc2FnZTogZnVuY3Rpb24gKCkge1xuXG5cdFx0dmFyIGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRcdGVsZW1lbnQuaWQgPSAnd2ViZ2wtZXJyb3ItbWVzc2FnZSc7XG5cdFx0ZWxlbWVudC5zdHlsZS5mb250RmFtaWx5ID0gJ21vbm9zcGFjZSc7XG5cdFx0ZWxlbWVudC5zdHlsZS5mb250U2l6ZSA9ICcxM3B4Jztcblx0XHRlbGVtZW50LnN0eWxlLmZvbnRXZWlnaHQgPSAnbm9ybWFsJztcblx0XHRlbGVtZW50LnN0eWxlLnRleHRBbGlnbiA9ICdjZW50ZXInO1xuXHRcdGVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZCA9ICcjZmZmJztcblx0XHRlbGVtZW50LnN0eWxlLmNvbG9yID0gJyMwMDAnO1xuXHRcdGVsZW1lbnQuc3R5bGUucGFkZGluZyA9ICcxLjVlbSc7XG5cdFx0ZWxlbWVudC5zdHlsZS56SW5kZXggPSAnOTk5Jztcblx0XHRlbGVtZW50LnN0eWxlLndpZHRoID0gJzQwMHB4Jztcblx0XHRlbGVtZW50LnN0eWxlLm1hcmdpbiA9ICc1ZW0gYXV0byAwJztcblxuXHRcdGlmICggISB0aGlzLndlYmdsICkge1xuXG5cdFx0XHRlbGVtZW50LmlubmVySFRNTCA9IHdpbmRvdy5XZWJHTFJlbmRlcmluZ0NvbnRleHQgPyBbXG5cdFx0XHRcdCdZb3VyIGdyYXBoaWNzIGNhcmQgZG9lcyBub3Qgc2VlbSB0byBzdXBwb3J0IDxhIGhyZWY9XCJodHRwOi8va2hyb25vcy5vcmcvd2ViZ2wvd2lraS9HZXR0aW5nX2FfV2ViR0xfSW1wbGVtZW50YXRpb25cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5XZWJHTDwvYT4uPGJyIC8+Jyxcblx0XHRcdFx0J0ZpbmQgb3V0IGhvdyB0byBnZXQgaXQgPGEgaHJlZj1cImh0dHA6Ly9nZXQud2ViZ2wub3JnL1wiIHN0eWxlPVwiY29sb3I6IzAwMFwiPmhlcmU8L2E+Lidcblx0XHRcdF0uam9pbiggJ1xcbicgKSA6IFtcblx0XHRcdFx0J1lvdXIgYnJvd3NlciBkb2VzIG5vdCBzZWVtIHRvIHN1cHBvcnQgPGEgaHJlZj1cImh0dHA6Ly9raHJvbm9zLm9yZy93ZWJnbC93aWtpL0dldHRpbmdfYV9XZWJHTF9JbXBsZW1lbnRhdGlvblwiIHN0eWxlPVwiY29sb3I6IzAwMFwiPldlYkdMPC9hPi48YnIvPicsXG5cdFx0XHRcdCdGaW5kIG91dCBob3cgdG8gZ2V0IGl0IDxhIGhyZWY9XCJodHRwOi8vZ2V0LndlYmdsLm9yZy9cIiBzdHlsZT1cImNvbG9yOiMwMDBcIj5oZXJlPC9hPi4nXG5cdFx0XHRdLmpvaW4oICdcXG4nICk7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gZWxlbWVudDtcblxuXHR9LFxuXG5cdGFkZEdldFdlYkdMTWVzc2FnZTogZnVuY3Rpb24gKCBwYXJhbWV0ZXJzICkge1xuXG5cdFx0dmFyIHBhcmVudCwgaWQsIGVsZW1lbnQ7XG5cblx0XHRwYXJhbWV0ZXJzID0gcGFyYW1ldGVycyB8fCB7fTtcblxuXHRcdHBhcmVudCA9IHBhcmFtZXRlcnMucGFyZW50ICE9PSB1bmRlZmluZWQgPyBwYXJhbWV0ZXJzLnBhcmVudCA6IGRvY3VtZW50LmJvZHk7XG5cdFx0aWQgPSBwYXJhbWV0ZXJzLmlkICE9PSB1bmRlZmluZWQgPyBwYXJhbWV0ZXJzLmlkIDogJ29sZGllJztcblxuXHRcdGVsZW1lbnQgPSBEZXRlY3Rvci5nZXRXZWJHTEVycm9yTWVzc2FnZSgpO1xuXHRcdGVsZW1lbnQuaWQgPSBpZDtcblxuXHRcdHBhcmVudC5hcHBlbmRDaGlsZCggZWxlbWVudCApO1xuXG5cdH1cblxufTtcblxuLy9FUzYgZXhwb3J0XG5cbmV4cG9ydCB7IERldGVjdG9yIH07XG4iLCIvL1RoaXMgbGlicmFyeSBpcyBkZXNpZ25lZCB0byBoZWxwIHN0YXJ0IHRocmVlLmpzIGVhc2lseSwgY3JlYXRpbmcgdGhlIHJlbmRlciBsb29wIGFuZCBjYW52YXMgYXV0b21hZ2ljYWxseS5cbi8vUmVhbGx5IGl0IHNob3VsZCBiZSBzcHVuIG9mZiBpbnRvIGl0cyBvd24gdGhpbmcgaW5zdGVhZCBvZiBiZWluZyBwYXJ0IG9mIGV4cGxhbmFyaWEuXG5cbi8vYWxzbywgY2hhbmdlIFRocmVlYXN5X0Vudmlyb25tZW50IHRvIFRocmVlYXN5X1JlY29yZGVyIHRvIGRvd25sb2FkIGhpZ2gtcXVhbGl0eSBmcmFtZXMgb2YgYW4gYW5pbWF0aW9uXG5cbmltcG9ydCBDQ2FwdHVyZSBmcm9tICdjY2FwdHVyZS5qcyc7XG5pbXBvcnQgeyBEZXRlY3RvciB9IGZyb20gJy4uL2xpYi9XZWJHTF9EZXRlY3Rvci5qcyc7XG5cbmZ1bmN0aW9uIFRocmVlYXN5RW52aXJvbm1lbnQoYXV0b3N0YXJ0ID0gdHJ1ZSl7XG5cdHRoaXMucHJldl90aW1lc3RlcCA9IDA7XG5cdHRoaXMuYXV0b3N0YXJ0ID0gYXV0b3N0YXJ0O1xuXG5cdGlmKCFEZXRlY3Rvci53ZWJnbClEZXRlY3Rvci5hZGRHZXRXZWJHTE1lc3NhZ2UoKTtcblxuXHR0aGlzLmNhbWVyYSA9IG5ldyBUSFJFRS5PcnRob2dyYXBoaWNDYW1lcmEoe1xuXHRcdG5lYXI6IC4xLFxuXHRcdGZhcjogMTAwMDAsXG5cblx0XHQvL3R5cGU6ICdwZXJzcGVjdGl2ZScsXG5cdFx0Zm92OiA2MCxcblx0XHRhc3BlY3Q6IDEsXG4vKlxuXHRcdC8vIHR5cGU6ICdvcnRob2dyYXBoaWMnLFxuXHRcdGxlZnQ6IC0xLFxuXHRcdHJpZ2h0OiAxLFxuXHRcdGJvdHRvbTogLTEsXG5cdFx0dG9wOiAxLCovXG5cdCAgfSk7XG5cblx0dGhpcy5jYW1lcmEgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoIDcwLCB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgMC4xLCAxMDAwMDAwMCApO1xuXHQvL3RoaXMuY2FtZXJhID0gbmV3IFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYSggNzAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDEwICk7XG5cblx0dGhpcy5jYW1lcmEucG9zaXRpb24uc2V0KDAsIDAsIDEwKTtcblx0dGhpcy5jYW1lcmEubG9va0F0KG5ldyBUSFJFRS5WZWN0b3IzKDAsMCwwKSk7XG5cblxuXHR0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoIHsgYW50aWFsaWFzOiB0cnVlIH0gKTtcblx0dGhpcy5yZW5kZXJlci5zZXRQaXhlbFJhdGlvKCB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldFNpemUoIHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQgKTtcblx0dGhpcy5yZW5kZXJlci5nYW1tYUlucHV0ID0gdHJ1ZTtcblx0dGhpcy5yZW5kZXJlci5nYW1tYU91dHB1dCA9IHRydWU7XG5cdHRoaXMucmVuZGVyZXIuc2hhZG93TWFwLmVuYWJsZWQgPSB0cnVlO1xuXHR0aGlzLnJlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlO1xuXHQvL2NyZWF0ZSBjYW1lcmEsIHNjZW5lLCB0aW1lciwgcmVuZGVyZXIgb2JqZWN0c1xuXHQvL2NyYWV0ZSByZW5kZXIgb2JqZWN0XG5cblxuXHRcblx0dGhpcy5zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xuXG5cdHRoaXMuc2NlbmUuYWRkKHRoaXMuY2FtZXJhKTtcblxuXHR0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoIHsgYW50aWFsaWFzOiB0cnVlIH0gKTtcblx0dGhpcy5yZW5kZXJlci5zZXRQaXhlbFJhdGlvKCB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyApO1xuXHR0aGlzLnJlbmRlcmVyLnNldFNpemUoIHRoaXMuZXZlbmlmeSh3aW5kb3cuaW5uZXJXaWR0aCksdGhpcy5ldmVuaWZ5KHdpbmRvdy5pbm5lckhlaWdodCkgKTtcblx0dGhpcy5yZW5kZXJlci5zZXRDbGVhckNvbG9yKG5ldyBUSFJFRS5Db2xvcigweEZGRkZGRiksIDEuMCk7XG5cblx0dGhpcy5hc3BlY3QgPSB3aW5kb3cuaW5uZXJXaWR0aC93aW5kb3cuaW5uZXJIZWlnaHQ7XG5cblx0dGhpcy50aW1lU2NhbGUgPSAxO1xuXHR0aGlzLmVsYXBzZWRUaW1lID0gMDtcblxuXHR0aGlzLmNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKCB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQgKTtcblxuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIHRoaXMub25Nb3VzZURvd24uYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZXVwJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblx0dGhpcy5yZW5kZXJlci5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd0b3VjaHN0YXJ0JywgdGhpcy5vbk1vdXNlRG93bi5iaW5kKHRoaXMpLCBmYWxzZSApO1xuXHR0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3RvdWNoZW5kJywgdGhpcy5vbk1vdXNlVXAuYmluZCh0aGlzKSwgZmFsc2UgKTtcblxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIHRoaXMub25XaW5kb3dSZXNpemUuYmluZCh0aGlzKSwgZmFsc2UgKTtcblxuXHQvKlxuXHQvL3JlbmRlcmVyLnZyLmVuYWJsZWQgPSB0cnVlOyBcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd2cmRpc3BsYXlwb2ludGVycmVzdHJpY3RlZCcsIG9uUG9pbnRlclJlc3RyaWN0ZWQsIGZhbHNlICk7XG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cG9pbnRlcnVucmVzdHJpY3RlZCcsIG9uUG9pbnRlclVucmVzdHJpY3RlZCwgZmFsc2UgKTtcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggV0VCVlIuY3JlYXRlQnV0dG9uKCByZW5kZXJlciApICk7XG5cdCovXG5cblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCB0aGlzLm9uUGFnZUxvYWQuYmluZCh0aGlzKSwgZmFsc2UpO1xuXG5cdHRoaXMuY2xvY2sgPSBuZXcgVEhSRUUuQ2xvY2soKTtcblxuXHR0aGlzLklTX1JFQ09SRElORyA9IGZhbHNlOyAvLyBxdWVyeWFibGUgaWYgb25lIHdhbnRzIHRvIGRvIHRoaW5ncyBsaWtlIGJlZWYgdXAgcGFydGljbGUgY291bnRzIGZvciByZW5kZXJcbn1cblxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25QYWdlTG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRjb25zb2xlLmxvZyhcIlRocmVlYXN5X1NldHVwIGxvYWRlZCFcIik7XG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHRoaXMuY29udGFpbmVyICk7XG5cblx0aWYodGhpcy5hdXRvc3RhcnQpe1xuXHRcdHRoaXMuc3RhcnQoKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe1xuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSBwZXJmb3JtYW5jZS5ub3coKTtcblx0dGhpcy5jbG9jay5zdGFydCgpO1xuXHR0aGlzLnJlbmRlcih0aGlzLnByZXZfdGltZXN0ZXApO1xufVxuXG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vbk1vdXNlRG93biA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmlzTW91c2VEb3duID0gdHJ1ZTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uTW91c2VVcD0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuaXNNb3VzZURvd24gPSBmYWxzZTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uUG9pbnRlclJlc3RyaWN0ZWQ9IGZ1bmN0aW9uKCkge1xuXHR2YXIgcG9pbnRlckxvY2tFbGVtZW50ID0gcmVuZGVyZXIuZG9tRWxlbWVudDtcblx0aWYgKCBwb2ludGVyTG9ja0VsZW1lbnQgJiYgdHlwZW9mKHBvaW50ZXJMb2NrRWxlbWVudC5yZXF1ZXN0UG9pbnRlckxvY2spID09PSAnZnVuY3Rpb24nICkge1xuXHRcdHBvaW50ZXJMb2NrRWxlbWVudC5yZXF1ZXN0UG9pbnRlckxvY2soKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25Qb2ludGVyVW5yZXN0cmljdGVkPSBmdW5jdGlvbigpIHtcblx0dmFyIGN1cnJlbnRQb2ludGVyTG9ja0VsZW1lbnQgPSBkb2N1bWVudC5wb2ludGVyTG9ja0VsZW1lbnQ7XG5cdHZhciBleHBlY3RlZFBvaW50ZXJMb2NrRWxlbWVudCA9IHJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cdGlmICggY3VycmVudFBvaW50ZXJMb2NrRWxlbWVudCAmJiBjdXJyZW50UG9pbnRlckxvY2tFbGVtZW50ID09PSBleHBlY3RlZFBvaW50ZXJMb2NrRWxlbWVudCAmJiB0eXBlb2YoZG9jdW1lbnQuZXhpdFBvaW50ZXJMb2NrKSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRkb2N1bWVudC5leGl0UG9pbnRlckxvY2soKTtcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUuZXZlbmlmeSA9IGZ1bmN0aW9uKHgpe1xuXHRpZih4ICUgMiA9PSAxKXtcblx0XHRyZXR1cm4geCsxXG5cdH07XG5cdHJldHVybiB4O1xufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUub25XaW5kb3dSZXNpemU9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLmNhbWVyYS5hc3BlY3QgPSB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodDtcblx0dGhpcy5hc3BlY3QgPSB0aGlzLmNhbWVyYS5hc3BlY3Q7XG5cdHRoaXMuY2FtZXJhLnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKTtcblx0dGhpcy5yZW5kZXJlci5zZXRTaXplKCB0aGlzLmV2ZW5pZnkod2luZG93LmlubmVyV2lkdGgpLHRoaXMuZXZlbmlmeSh3aW5kb3cuaW5uZXJIZWlnaHQpICk7XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5saXN0ZW5lcnMgPSB7XCJ1cGRhdGVcIjogW10sXCJyZW5kZXJcIjpbXX07IC8vdXBkYXRlIGV2ZW50IGxpc3RlbmVyc1xuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24odGltZXN0ZXApe1xuXHR2YXIgZGVsdGEgPSB0aGlzLmNsb2NrLmdldERlbHRhKCkqdGhpcy50aW1lU2NhbGU7XG5cdHRoaXMuZWxhcHNlZFRpbWUgKz0gZGVsdGE7XG5cdC8vZ2V0IHRpbWVzdGVwXG5cdGZvcih2YXIgaT0wO2k8dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0ubGVuZ3RoO2krKyl7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl1baV0oe1widFwiOnRoaXMuZWxhcHNlZFRpbWUsXCJkZWx0YVwiOmRlbHRhfSk7XG5cdH1cblxuXHR0aGlzLnJlbmRlcmVyLnJlbmRlciggdGhpcy5zY2VuZSwgdGhpcy5jYW1lcmEgKTtcblxuXHRmb3IodmFyIGk9MDtpPHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdLmxlbmd0aDtpKyspe1xuXHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdW2ldKCk7XG5cdH1cblxuXHR0aGlzLnByZXZfdGltZXN0ZXAgPSB0aW1lc3RlcDtcblx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLnJlbmRlci5iaW5kKHRoaXMpKTtcbn1cblRocmVlYXN5RW52aXJvbm1lbnQucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZXZlbnRfbmFtZSwgZnVuYyl7XG5cdC8vUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyLlxuXHQvL2VhY2ggbGlzdGVuZXIgd2lsbCBiZSBjYWxsZWQgd2l0aCBhbiBvYmplY3QgY29uc2lzdGluZyBvZjpcblx0Ly9cdHt0OiA8Y3VycmVudCB0aW1lIGluIHM+LCBcImRlbHRhXCI6IDxkZWx0YSwgaW4gbXM+fVxuXHQvLyBhbiB1cGRhdGUgZXZlbnQgZmlyZXMgYmVmb3JlIGEgcmVuZGVyLiBhIHJlbmRlciBldmVudCBmaXJlcyBwb3N0LXJlbmRlci5cblx0aWYoZXZlbnRfbmFtZSA9PSBcInVwZGF0ZVwiKXsgXG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0ucHVzaChmdW5jKTtcblx0fWVsc2UgaWYoZXZlbnRfbmFtZSA9PSBcInJlbmRlclwiKXsgXG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0ucHVzaChmdW5jKTtcblx0fWVsc2V7XG5cdFx0Y29uc29sZS5lcnJvcihcIkludmFsaWQgZXZlbnQgbmFtZSFcIilcblx0fVxufVxuVGhyZWVhc3lFbnZpcm9ubWVudC5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKGV2ZW50X25hbWUsIGZ1bmMpe1xuXHQvL1VucmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyLCB1bmRvaW5nIGFuIFRocmVlYXN5X3NldHVwLm9uKCkgZXZlbnQgbGlzdGVuZXIuXG5cdC8vdGhlIG5hbWluZyBzY2hlbWUgbWlnaHQgbm90IGJlIHRoZSBiZXN0IGhlcmUuXG5cdGlmKGV2ZW50X25hbWUgPT0gXCJ1cGRhdGVcIil7IFxuXHRcdGxldCBpbmRleCA9IHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdLmluZGV4T2YoZnVuYyk7XG5cdFx0dGhpcy5saXN0ZW5lcnNbXCJ1cGRhdGVcIl0uc3BsaWNlKGluZGV4LDEpO1xuXHR9IGVsc2UgaWYoZXZlbnRfbmFtZSA9PSBcInJlbmRlclwiKXsgXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5saXN0ZW5lcnNbXCJyZW5kZXJcIl0uaW5kZXhPZihmdW5jKTtcblx0XHR0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5zcGxpY2UoaW5kZXgsMSk7XG5cdH1lbHNle1xuXHRcdGNvbnNvbGUuZXJyb3IoXCJOb25leGlzdGVudCBldmVudCBuYW1lIVwiKVxuXHR9XG59XG5UaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5vZmYgPSBUaHJlZWFzeUVudmlyb25tZW50LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyOyAvL2FsaWFzIHRvIG1hdGNoIFRocmVlYXN5RW52aXJvbm1lbnQub25cblxuY2xhc3MgVGhyZWVhc3lSZWNvcmRlciBleHRlbmRzIFRocmVlYXN5RW52aXJvbm1lbnR7XG5cdC8vYmFzZWQgb24gaHR0cDovL3d3dy50eXNvbmNhZGVuaGVhZC5jb20vYmxvZy9leHBvcnRpbmctY2FudmFzLWFuaW1hdGlvbi10by1tb3YvIHRvIHJlY29yZCBhbiBhbmltYXRpb25cblx0Ly93aGVuIGRvbmUsICAgICBmZm1wZWcgLXIgNjAgLWZyYW1lcmF0ZSA2MCAtaSAuLyUwN2QucG5nIC12Y29kZWMgbGlieDI2NCAtcGl4X2ZtdCB5dXY0MjBwIC1jcmY6diAwIHZpZGVvLm1wNFxuICAgIC8vIHRvIHBlcmZvcm0gbW90aW9uIGJsdXIgb24gYW4gb3ZlcnNhbXBsZWQgdmlkZW8sIGZmbXBlZyAtaSB2aWRlby5tcDQgLXZmIHRibGVuZD1hbGxfbW9kZT1hdmVyYWdlLGZyYW1lc3RlcD0yIHZpZGVvMi5tcDRcblx0Ly90aGVuLCBhZGQgdGhlIHl1djQyMHAgcGl4ZWxzICh3aGljaCBmb3Igc29tZSByZWFzb24gaXNuJ3QgZG9uZSBieSB0aGUgcHJldiBjb21tYW5kKSBieTpcblx0Ly8gZmZtcGVnIC1pIHZpZGVvLm1wNCAtdmNvZGVjIGxpYngyNjQgLXBpeF9mbXQgeXV2NDIwcCAtc3RyaWN0IC0yIC1hY29kZWMgYWFjIGZpbmlzaGVkX3ZpZGVvLm1wNFxuXHQvL2NoZWNrIHdpdGggZmZtcGVnIC1pIGZpbmlzaGVkX3ZpZGVvLm1wNFxuXG5cdGNvbnN0cnVjdG9yKGF1dG9zdGFydCwgZnBzPTMwLCBsZW5ndGggPSA1KXtcblx0XHQvKiBmcHMgaXMgZXZpZGVudCwgYXV0b3N0YXJ0IGlzIGEgYm9vbGVhbiAoYnkgZGVmYXVsdCwgdHJ1ZSksIGFuZCBsZW5ndGggaXMgaW4gcy4qL1xuXHRcdHN1cGVyKGF1dG9zdGFydCk7XG5cdFx0dGhpcy5mcHMgPSBmcHM7XG5cdFx0dGhpcy5lbGFwc2VkVGltZSA9IDA7XG5cdFx0dGhpcy5mcmFtZUNvdW50ID0gZnBzICogbGVuZ3RoO1xuXHRcdHRoaXMuZnJhbWVzX3JlbmRlcmVkID0gMDtcblxuXHRcdHRoaXMuY2FwdHVyZXIgPSBuZXcgQ0NhcHR1cmUoIHtcblx0XHRcdGZyYW1lcmF0ZTogZnBzLFxuXHRcdFx0Zm9ybWF0OiAncG5nJyxcblx0XHRcdG5hbWU6IGRvY3VtZW50LnRpdGxlLFxuXHRcdFx0Ly92ZXJib3NlOiB0cnVlLFxuXHRcdH0gKTtcblxuXHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cblx0XHR0aGlzLklTX1JFQ09SRElORyA9IHRydWU7XG5cdH1cblx0c3RhcnQoKXtcblx0XHQvL21ha2UgYSByZWNvcmRpbmcgc2lnblxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUud2lkdGg9XCIyMHB4XCJcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmhlaWdodD1cIjIwcHhcIlxuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUudG9wID0gJzIwcHgnO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUubGVmdCA9ICcyMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJvcmRlclJhZGl1cyA9ICcxMHB4Jztcblx0XHR0aGlzLnJlY29yZGluZ19pY29uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdyZWQnO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5yZWNvcmRpbmdfaWNvbik7XG5cblx0XHR0aGlzLmZyYW1lQ291bnRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLnRvcCA9ICcyMHB4Jztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5sZWZ0ID0gJzUwcHgnO1xuXHRcdHRoaXMuZnJhbWVDb3VudGVyLnN0eWxlLmNvbG9yID0gJ2JsYWNrJztcblx0XHR0aGlzLmZyYW1lQ291bnRlci5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnMTBweCc7XG5cdFx0dGhpcy5mcmFtZUNvdW50ZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMjU1LDI1NSwyNTUsMC4xKSc7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLmZyYW1lQ291bnRlcik7XG5cblx0XHR0aGlzLmNhcHR1cmVyLnN0YXJ0KCk7XG5cdFx0dGhpcy5yZW5kZXJpbmcgPSB0cnVlO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblx0cmVuZGVyKHRpbWVzdGVwKXtcblx0XHR2YXIgZGVsdGEgPSAxL3RoaXMuZnBzKnRoaXMudGltZVNjYWxlOyAvL2lnbm9yaW5nIHRoZSB0cnVlIHRpbWUsIGNhbGN1bGF0ZSB0aGUgZGVsdGFcblxuXHRcdC8vZ2V0IHRpbWVzdGVwXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInVwZGF0ZVwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1widXBkYXRlXCJdW2ldKHtcInRcIjp0aGlzLmVsYXBzZWRUaW1lLFwiZGVsdGFcIjpkZWx0YX0pO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYSApO1xuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmxpc3RlbmVyc1tcInJlbmRlclwiXS5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMubGlzdGVuZXJzW1wicmVuZGVyXCJdW2ldKCk7XG5cdFx0fVxuXG5cblx0XHR0aGlzLnJlY29yZF9mcmFtZSgpO1xuXHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuXG5cdFx0dGhpcy5lbGFwc2VkVGltZSArPSBkZWx0YTtcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucmVuZGVyLmJpbmQodGhpcykpO1xuXHR9XG5cdHJlY29yZF9mcmFtZSgpe1xuXHQvL1x0bGV0IGN1cnJlbnRfZnJhbWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYW52YXMnKS50b0RhdGFVUkwoKTtcblxuXHRcdHRoaXMuY2FwdHVyZXIuY2FwdHVyZSggZG9jdW1lbnQucXVlcnlTZWxlY3RvcignY2FudmFzJykgKTtcblxuXHRcdHRoaXMuZnJhbWVDb3VudGVyLmlubmVySFRNTCA9IHRoaXMuZnJhbWVzX3JlbmRlcmVkICsgXCIgLyBcIiArIHRoaXMuZnJhbWVDb3VudDsgLy91cGRhdGUgdGltZXJcblxuXHRcdHRoaXMuZnJhbWVzX3JlbmRlcmVkKys7XG5cblxuXHRcdGlmKHRoaXMuZnJhbWVzX3JlbmRlcmVkPnRoaXMuZnJhbWVDb3VudCl7XG5cdFx0XHR0aGlzLnJlbmRlciA9IG51bGw7IC8vaGFja3kgd2F5IG9mIHN0b3BwaW5nIHRoZSByZW5kZXJpbmdcblx0XHRcdHRoaXMucmVjb3JkaW5nX2ljb24uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXHRcdFx0Ly90aGlzLmZyYW1lQ291bnRlci5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cblx0XHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cdFx0XHR0aGlzLmNhcHR1cmVyLnN0b3AoKTtcblx0XHRcdC8vIGRlZmF1bHQgc2F2ZSwgd2lsbCBkb3dubG9hZCBhdXRvbWF0aWNhbGx5IGEgZmlsZSBjYWxsZWQge25hbWV9LmV4dGVuc2lvbiAod2VibS9naWYvdGFyKVxuXHRcdFx0dGhpcy5jYXB0dXJlci5zYXZlKCk7XG5cdFx0fVxuXHR9XG5cdG9uV2luZG93UmVzaXplKCkge1xuXHRcdC8vc3RvcCByZWNvcmRpbmcgaWYgd2luZG93IHNpemUgY2hhbmdlc1xuXHRcdGlmKHRoaXMucmVuZGVyaW5nICYmIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0ICE9IHRoaXMuYXNwZWN0KXtcblx0XHRcdHRoaXMuY2FwdHVyZXIuc3RvcCgpO1xuXHRcdFx0dGhpcy5yZW5kZXIgPSBudWxsOyAvL2hhY2t5IHdheSBvZiBzdG9wcGluZyB0aGUgcmVuZGVyaW5nXG5cdFx0XHRhbGVydChcIkFib3J0aW5nIHJlY29yZDogV2luZG93LXNpemUgY2hhbmdlIGRldGVjdGVkIVwiKTtcblx0XHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN1cGVyLm9uV2luZG93UmVzaXplKCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gc2V0dXBUaHJlZShhdXRvc3RhcnQsIGZwcz0zMCwgbGVuZ3RoID0gNSl7XG5cdC8qIEFsbCB0aGUgZXhpc3RpbmcgY29kZSBJIGhhdmUgdXNlcyBcIm5ldyBUaHJlZWFzeVNldHVwXCIgb3IgXCJuZXcgVGhyZWVhc3lSZWNvcmRlclwiIGFuZCBJIHdhbnQgdG8gc3dpdGNoXG4gICBiZXR3ZWVuIHRoZW0gZHluYW1pY2FsbHkgc28gdGhhdCB5b3UgY2FuIHJlY29yZCBieSBhcHBlbmRpbmcgXCI/cmVjb3JkPXRydWVcIiB0byBhbiB1cmwuICovXG5cdHZhciByZWNvcmRlciA9IG51bGw7XG5cdHZhciBpc19yZWNvcmRpbmcgPSBmYWxzZTtcblxuXHQvL2V4dHJhY3QgcmVjb3JkIHBhcmFtZXRlciBmcm9tIHVybFxuXHR2YXIgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhkb2N1bWVudC5sb2NhdGlvbi5zZWFyY2gpO1xuXHRsZXQgcmVjb3JkU3RyaW5nID0gcGFyYW1zLmdldChcInJlY29yZFwiKTtcblxuXHRpZihyZWNvcmRTdHJpbmcpaXNfcmVjb3JkaW5nID0gcGFyYW1zLmdldChcInJlY29yZFwiKS50b0xvd2VyQ2FzZSgpID09IFwidHJ1ZVwiIHx8IHBhcmFtcy5nZXQoXCJyZWNvcmRcIikudG9Mb3dlckNhc2UoKSA9PSBcIjFcIjtcblxuXHRpZihpc19yZWNvcmRpbmcpe1xuXHRcdHJldHVybiBuZXcgVGhyZWVhc3lSZWNvcmRlcihhdXRvc3RhcnQsIGZwcywgbGVuZ3RoKTtcblx0XG5cdH1lbHNle1xuXHRcdHJldHVybiBuZXcgVGhyZWVhc3lFbnZpcm9ubWVudChhdXRvc3RhcnQpO1xuXHR9XG59XG5cbmV4cG9ydCB7c2V0dXBUaHJlZSwgVGhyZWVhc3lFbnZpcm9ubWVudCwgVGhyZWVhc3lSZWNvcmRlcn1cbiIsImFzeW5jIGZ1bmN0aW9uIGRlbGF5KHdhaXRUaW1lKXtcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG5cdFx0d2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgd2FpdFRpbWUpO1xuXHR9KTtcblxufVxuXG5leHBvcnQge2RlbGF5fTtcbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5cbmNsYXNzIExpbmVPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29ya1xuXHRcdFx0b3B0aW9uczpcblx0XHRcdHtcblx0XHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0XHRvcGFjaXR5OiBudW1iZXJcblx0XHRcdFx0Y29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcblx0XHRcdH1cblx0XHQqL1xuXG5cdFx0dGhpcy5fd2lkdGggPSBvcHRpb25zLndpZHRoICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLndpZHRoIDogNTtcblx0XHR0aGlzLl9vcGFjaXR5ID0gb3B0aW9ucy5vcGFjaXR5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLm9wYWNpdHkgOiAxO1xuXHRcdHRoaXMuX2NvbG9yID0gb3B0aW9ucy5jb2xvciAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5jb2xvciA6IDB4NTVhYTU1O1xuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSAwOyAvL3Nob3VsZCBhbHdheXMgYmUgZXF1YWwgdG8gdGhpcy5wb2ludHMubGVuZ3RoXG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IFtdOyAvLyBob3cgbWFueSB0aW1lcyB0byBiZSBjYWxsZWQgaW4gZWFjaCBkaXJlY3Rpb25cblx0XHR0aGlzLl9vdXRwdXREaW1lbnNpb25zID0gMzsgLy9ob3cgbWFueSBkaW1lbnNpb25zIHBlciBwb2ludCB0byBzdG9yZT9cblxuXHRcdHRoaXMucGFyZW50ID0gbnVsbDtcblxuXHRcdHRoaXMuaW5pdCgpO1xuXHR9XG5cdGluaXQoKXtcblx0XHR0aGlzLl9nZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXHRcdHRoaXMuX3ZlcnRpY2VzO1xuXHRcdHRoaXMubWFrZUdlb21ldHJ5KCk7XG5cblx0XHR0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtjb2xvcjogdGhpcy5fY29sb3IsIGxpbmV3aWR0aDogdGhpcy5fd2lkdGgsb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSk7XG5cdFx0dGhpcy5tZXNoID0gbmV3IFRIUkVFLkxpbmVTZWdtZW50cyh0aGlzLl9nZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vIHNldHRlciBzZXRzIHRyYW5zcGFyZW50IGZsYWcgaWYgbmVjZXNzYXJ5XG5cblx0XHR0aHJlZS5zY2VuZS5hZGQodGhpcy5tZXNoKTtcblx0fVxuXHRtYWtlR2VvbWV0cnkoKXtcblx0XHQvLyBmb2xsb3cgaHR0cDovL2Jsb2cuY2pnYW1tb24uY29tL3RocmVlanMtZ2VvbWV0cnlcblx0XHQvLyBvciBtYXRoYm94J3MgbGluZUdlb21ldHJ5XG5cblx0XHQvKlxuXHRcdFRoaXMgY29kZSBzZWVtcyB0byBiZSBuZWNlc3NhcnkgdG8gcmVuZGVyIGxpbmVzIGFzIGEgdHJpYW5nbGUgc3RycC5cblx0XHRJIGNhbid0IHNlZW0gdG8gZ2V0IGl0IHRvIHdvcmsgcHJvcGVybHkuXG5cblx0XHRsZXQgbnVtVmVydGljZXMgPSAzO1xuXHRcdHZhciBpbmRpY2VzID0gW107XG5cblx0XHQvL2luZGljZXNcblx0XHRsZXQgYmFzZSA9IDA7XG5cdFx0Zm9yKHZhciBrPTA7azxudW1WZXJ0aWNlcy0xO2srPTEpe1xuICAgICAgICBcdGluZGljZXMucHVzaCggYmFzZSwgYmFzZSsxLCBiYXNlKzIpO1xuXHRcdFx0aW5kaWNlcy5wdXNoKCBiYXNlKzIsIGJhc2UrMSwgYmFzZSszKTtcblx0XHRcdGJhc2UgKz0gMjtcblx0XHR9XG5cdFx0dGhpcy5fZ2VvbWV0cnkuc2V0SW5kZXgoIGluZGljZXMgKTsqL1xuXG5cdFx0bGV0IE1BWF9QT0lOVFMgPSAxMDAwMDtcblxuXHRcdHRoaXMuX3ZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheShNQVhfUE9JTlRTICogMiAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMpO1xuXG5cdFx0Ly8gYnVpbGQgZ2VvbWV0cnlcblxuXHRcdHRoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ3Bvc2l0aW9uJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX3ZlcnRpY2VzLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zICkgKTtcblx0XHQvL3RoaXMuX2dlb21ldHJ5LmFkZEF0dHJpYnV0ZSggJ25vcm1hbCcsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCBub3JtYWxzLCAzICkgKTtcblx0XHQvL3RoaXMuZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAndXYnLCBuZXcgVEhSRUUuRmxvYXQzMkJ1ZmZlckF0dHJpYnV0ZSggdXZzLCAyICkgKTtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy91c2VkIGR1cmluZyB1cGRhdGVzIGFzIGEgcG9pbnRlciB0byB0aGUgYnVmZmVyXG5cblx0XHR0aGlzLl9hY3RpdmF0ZWRPbmNlID0gZmFsc2U7XG5cblx0fVxuXHRfb25BZGQoKXtcblx0XHQvL2NsaW1iIHVwIHBhcmVudCBoaWVyYXJjaHkgdG8gZmluZCB0aGUgQXJlYVxuXHRcdGxldCByb290ID0gdGhpcztcblx0XHR3aGlsZShyb290LnBhcmVudCAhPT0gbnVsbCl7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG5cdFx0fVxuXHRcblx0XHQvL3RvZG86IGltcGxlbWVudCBzb21ldGhpbmcgbGlrZSBhc3NlcnQgcm9vdCB0eXBlb2YgUm9vdE5vZGVcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cdFx0dGhpcy5pdGVtRGltZW5zaW9ucyA9IHJvb3QuaXRlbURpbWVuc2lvbnM7XG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG5cdFx0dGhpcy5fb25BZGQoKTsgLy9zZXR1cCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiBhbmQgdGhpcy5pdGVtRGltZW5zaW9ucy4gdXNlZCBoZXJlIGFnYWluIGJlY2F1c2UgY2xvbmluZyBtZWFucyB0aGUgb25BZGQoKSBtaWdodCBiZSBjYWxsZWQgYmVmb3JlIHRoaXMgaXMgY29ubmVjdGVkIHRvIGEgdHlwZSBvZiBkb21haW5cblxuXHRcdC8vIHBlcmhhcHMgaW5zdGVhZCBvZiBnZW5lcmF0aW5nIGEgd2hvbGUgbmV3IGFycmF5LCB0aGlzIGNhbiByZXVzZSB0aGUgb2xkIG9uZT9cblx0XHRsZXQgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uICogdGhpcy5fb3V0cHV0RGltZW5zaW9ucyAqIDIpO1xuXG5cdFx0bGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcblx0XHR0aGlzLl92ZXJ0aWNlcyA9IHZlcnRpY2VzO1xuXHRcdHBvc2l0aW9uQXR0cmlidXRlLnNldEFycmF5KHRoaXMuX3ZlcnRpY2VzKTtcblxuXHRcdHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXG5cdFx0Ly9pdCdzIGFzc3VtZWQgaSB3aWxsIGdvIGZyb20gMCB0byB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiwgc2luY2UgdGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSBhbiBBcmVhLlxuXG5cdFx0Ly9hc3NlcnQgaSA8IHZlcnRpY2VzLmNvdW50XG5cblx0XHRsZXQgaW5kZXggPSB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuXG5cdFx0aWYoeCAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4XSA9IHg7XG5cdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdID0geTtcblx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMl0gPSB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblxuXHRcdC8qIHdlJ3JlIGRyYXdpbmcgbGlrZSB0aGlzOlxuXHRcdCotLS0tKi0tLS0qXG5cbiAgICAgICAgKi0tLS0qLS0tLSpcblx0XG5cdFx0YnV0IHdlIGRvbid0IHdhbnQgdG8gaW5zZXJ0IGEgZGlhZ29uYWwgbGluZSBhbnl3aGVyZS4gVGhpcyBoYW5kbGVzIHRoYXQ6ICAqL1xuXG5cdFx0bGV0IGZpcnN0Q29vcmRpbmF0ZSA9IGkgJSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdO1xuXG5cdFx0aWYoIShmaXJzdENvb3JkaW5hdGUgPT0gMCB8fCBmaXJzdENvb3JkaW5hdGUgPT0gdGhpcy5pdGVtRGltZW5zaW9uc1t0aGlzLml0ZW1EaW1lbnNpb25zLmxlbmd0aC0xXS0xKSl7XG5cdFx0XHRpZih4ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9uc10gPSB4O1xuXHRcdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMrMV0gPSB5O1xuXHRcdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4K3RoaXMuX291dHB1dERpbWVuc2lvbnMrMl0gPSB6O1xuXHRcdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblx0XHR9XG5cblx0XHQvL3ZlcnRpY2VzIHNob3VsZCByZWFsbHkgYmUgYW4gdW5pZm9ybSwgdGhvdWdoLlxuXHR9XG5cdG9uQWZ0ZXJBY3RpdmF0aW9uKCl7XG5cdFx0bGV0IHBvc2l0aW9uQXR0cmlidXRlID0gdGhpcy5fZ2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbjtcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3Jlc2V0IGFmdGVyIGVhY2ggdXBkYXRlXG5cdH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHQvL2N1cnJlbnRseSBvbmx5IGEgc2luZ2xlIGNvbG9yIGlzIHN1cHBvcnRlZC5cblx0XHQvL0kgc2hvdWxkIHJlYWxseVxuXHRcdHRoaXMubWF0ZXJpYWwuY29sb3IgPSBuZXcgVEhSRUUuQ29sb3IoY29sb3IpO1xuXHRcdHRoaXMuX2NvbG9yID0gY29sb3I7XG5cdH1cblx0Z2V0IGNvbG9yKCl7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbG9yO1xuXHR9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdHRoaXMubWF0ZXJpYWwub3BhY2l0eSA9IG9wYWNpdHk7XG5cdFx0dGhpcy5tYXRlcmlhbC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuXHRcdHRoaXMubWF0ZXJpYWwudmlzaWJsZSA9IG9wYWNpdHkgPiAwO1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcGFjaXR5O1xuXHR9XG5cdGdldCBvcGFjaXR5KCl7XG5cdFx0cmV0dXJuIHRoaXMuX29wYWNpdHk7XG5cdH1cblx0c2V0IHdpZHRoKHdpZHRoKXtcblx0XHR0aGlzLl93aWR0aCA9IHdpZHRoO1xuXHRcdHRoaXMubWF0ZXJpYWwubGluZXdpZHRoID0gd2lkdGg7XG5cdH1cblx0Z2V0IHdpZHRoKCl7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZHRoO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBMaW5lT3V0cHV0KHt3aWR0aDogdGhpcy53aWR0aCwgY29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eX0pO1xuXHR9XG59XG5cbmV4cG9ydCB7TGluZU91dHB1dH07XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBQb2ludHtcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0LypvcHRpb25zOiBjb2xvcjogPFRIUkVFLkNvbG9yIG9yIGhleCBjb2RlXG5cdFx0XHR4LHk6IG51bWJlcnNcblx0XHRcdHdpZHRoOiBudW1iZXJcblx0XHQqL1xuXG5cdFx0bGV0IHdpZHRoID0gb3B0aW9ucy53aWR0aCA9PT0gdW5kZWZpbmVkID8gMSA6IG9wdGlvbnMud2lkdGhcblx0XHRsZXQgY29sb3IgPSBvcHRpb25zLmNvbG9yID09PSB1bmRlZmluZWQgPyAweDc3Nzc3NyA6IG9wdGlvbnMuY29sb3I7XG5cblx0XHR0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTWVzaCh0aGlzLnNoYXJlZENpcmNsZUdlb21ldHJ5LHRoaXMuZ2V0RnJvbU1hdGVyaWFsQ2FjaGUoY29sb3IpKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSA9PT0gdW5kZWZpbmVkID8gMSA6IG9wdGlvbnMub3BhY2l0eTsgLy90cmlnZ2VyIHNldHRlclxuXG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnNldCh0aGlzLngsdGhpcy55LHRoaXMueik7XG5cdFx0dGhpcy5tZXNoLnNjYWxlLnNldFNjYWxhcih0aGlzLndpZHRoLzIpO1xuXHRcdHRocmVlLnNjZW5lLmFkZCh0aGlzLm1lc2gpO1xuXG5cdFx0dGhpcy54ID0gb3B0aW9ucy54IHx8IDA7XG5cdFx0dGhpcy55ID0gb3B0aW9ucy55IHx8IDA7XG5cdFx0dGhpcy56ID0gb3B0aW9ucy56IHx8IDA7XG5cdH1cblx0c2V0IHgoaSl7XG5cdFx0dGhpcy5tZXNoLnBvc2l0aW9uLnggPSBpO1xuXHR9XG5cdHNldCB5KGkpe1xuXHRcdHRoaXMubWVzaC5wb3NpdGlvbi55ID0gaTtcblx0fVxuXHRzZXQgeihpKXtcblx0XHR0aGlzLm1lc2gucG9zaXRpb24ueiA9IGk7XG5cdH1cblx0Z2V0IHgoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLng7XG5cdH1cblx0Z2V0IHkoKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLnk7XG5cdH1cblx0Z2V0IHooKXtcblx0XHRyZXR1cm4gdGhpcy5tZXNoLnBvc2l0aW9uLno7XG5cdH1cblx0c2V0IG9wYWNpdHkob3BhY2l0eSl7XG5cdFx0bGV0IG1hdCA9IHRoaXMubWVzaC5tYXRlcmlhbDtcblx0XHRtYXQub3BhY2l0eSA9IG9wYWNpdHk7XG5cdFx0bWF0LnRyYW5zcGFyZW50ID0gb3BhY2l0eSA8IDE7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wYWNpdHk7XG5cdH1cblx0Z2V0IG9wYWNpdHkoKXtcblx0XHRyZXR1cm4gdGhpcy5fb3BhY2l0eTtcblx0fVxuXHRnZXRGcm9tTWF0ZXJpYWxDYWNoZShjb2xvcil7XG5cdFx0aWYodGhpcy5fbWF0ZXJpYWxzW2NvbG9yXSA9PT0gdW5kZWZpbmVkKXtcblx0XHRcdHRoaXMuX21hdGVyaWFsc1tjb2xvcl0gPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe2NvbG9yOiBjb2xvcn0pXG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tYXRlcmlhbHNbY29sb3JdXG5cdH1cblx0c2V0IGNvbG9yKGNvbG9yKXtcblx0XHR0aGlzLm1lc2gubWF0ZXJpYWwgPSB0aGlzLmdldEZyb21NYXRlcmlhbENhY2hlKGNvbG9yKTtcblx0fVxufVxuUG9pbnQucHJvdG90eXBlLnNoYXJlZENpcmNsZUdlb21ldHJ5ID0gbmV3IFRIUkVFLlNwaGVyZUdlb21ldHJ5KDEvMiwgOCwgNik7IC8vcmFkaXVzIDEvMiBzbyB0aGF0IHNjYWxpbmcgYnkgbiBtZWFucyB3aWR0aD1uXG5cblBvaW50LnByb3RvdHlwZS5fbWF0ZXJpYWxzID0ge307XG4iLCJpbXBvcnQgUG9pbnQgZnJvbSAnLi9Qb2ludC5qcyc7XG5pbXBvcnQge091dHB1dE5vZGV9IGZyb20gJy4uL05vZGUuanMnO1xuXG5jbGFzcyBQb2ludE91dHB1dCBleHRlbmRzIE91dHB1dE5vZGV7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0c3VwZXIoKTtcblx0XHQvKlxuXHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0Y29sb3I6IGhleCBjb2xvciwgYXMgaW4gMHhycmdnYmIuIFRlY2huaWNhbGx5LCB0aGlzIGlzIGEgSlMgaW50ZWdlci5cblx0XHRcdG9wYWNpdHk6IDAtMS4gT3B0aW9uYWwuXG5cdFx0Ki9cblxuXHRcdHRoaXMuX3dpZHRoID0gb3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aWR0aCA6IDE7XG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmNvbG9yIDogMHg1NWFhNTU7XG5cdFx0dGhpcy5fb3BhY2l0eSA9IG9wdGlvbnMub3BhY2l0eSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5vcGFjaXR5IDogMTtcblxuXG5cdFx0dGhpcy5wb2ludHMgPSBbXTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gMDsgLy9zaG91bGQgYWx3YXlzIGJlIGVxdWFsIHRvIHRoaXMucG9pbnRzLmxlbmd0aFxuXHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblxuXHRcdHRoaXMucGFyZW50ID0gbnVsbDtcblx0fVxuXHRfb25BZGQoKXsgLy9zaG91bGQgYmUgY2FsbGVkIHdoZW4gdGhpcyBpcyAuYWRkKCllZCB0byBzb21ldGhpbmdcblxuXHRcdGxldCBwYXJlbnRDb3VudCA9IDA7XG5cdFx0Ly9jbGltYiB1cCBwYXJlbnQgaGllcmFyY2h5IHRvIGZpbmQgdGhlIEFyZWFcblx0XHRsZXQgcm9vdCA9IHRoaXM7XG5cdFx0d2hpbGUocm9vdC5wYXJlbnQgIT09IG51bGwgJiYgcGFyZW50Q291bnQgPCA1MCl7XG5cdFx0XHRyb290ID0gcm9vdC5wYXJlbnQ7XG5cdFx0XHRwYXJlbnRDb3VudCsrO1xuXHRcdH1cblx0XHRpZihwYXJlbnRDb3VudCA+PSA1MCl0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCByb290IVwiKTtcblxuXHRcdHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uID0gcm9vdC5udW1DYWxsc1BlckFjdGl2YXRpb247XG5cblx0XHRpZih0aGlzLnBvaW50cy5sZW5ndGggPCB0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbil7XG5cdFx0XHRmb3IodmFyIGk9dGhpcy5wb2ludHMubGVuZ3RoO2k8dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb247aSsrKXtcblx0XHRcdFx0dGhpcy5wb2ludHMucHVzaChuZXcgUG9pbnQoe3dpZHRoOiAxLGNvbG9yOnRoaXMuX2NvbG9yLCBvcGFjaXR5OnRoaXMuX29wYWNpdHl9KSk7XG5cdFx0XHRcdHRoaXMucG9pbnRzW2ldLm1lc2guc2NhbGUuc2V0U2NhbGFyKHRoaXMuX3dpZHRoKTsgLy9zZXQgd2lkdGggYnkgc2NhbGluZyBwb2ludFxuXHRcdFx0XHR0aGlzLnBvaW50c1tpXS5tZXNoLnZpc2libGUgPSBmYWxzZTsgLy9pbnN0YW50aWF0ZSB0aGUgcG9pbnRcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0X29uRmlyc3RBY3RpdmF0aW9uKCl7XG5cdFx0aWYodGhpcy5wb2ludHMubGVuZ3RoIDwgdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24pdGhpcy5fb25BZGQoKTtcblx0fVxuXHRldmFsdWF0ZVNlbGYoaSwgdCwgeCwgeSwgeil7XG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblx0XHR2YXIgcG9pbnQgPSB0aGlzLmdldFBvaW50KGkpO1xuXHRcdGlmKHggIT09IHVuZGVmaW5lZClwb2ludC54ID0geDtcblx0XHRpZih5ICE9PSB1bmRlZmluZWQpcG9pbnQueSA9IHk7XG5cdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXBvaW50LnogPSB6O1xuXHRcdHBvaW50Lm1lc2gudmlzaWJsZSA9IHRydWU7XG5cdH1cblx0Z2V0UG9pbnQoaSl7XG5cdFx0cmV0dXJuIHRoaXMucG9pbnRzW2ldO1xuXHR9XG5cdHNldCBvcGFjaXR5KG9wYWNpdHkpe1xuXHRcdC8vdGVjaG5pY2FsbHkgdGhpcyB3aWxsIHNldCBhbGwgcG9pbnRzIG9mIHRoZSBzYW1lIGNvbG9yLCBhbmQgaXQnbGwgYmUgd2lwZWQgd2l0aCBhIGNvbG9yIGNoYW5nZS4gQnV0IEknbGwgZGVhbCB3aXRoIHRoYXQgc29tZXRpbWUgbGF0ZXIuXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbjtpKyspe1xuXHRcdFx0bGV0IG1hdCA9IHRoaXMuZ2V0UG9pbnQoaSkubWVzaC5tYXRlcmlhbDtcblx0XHRcdG1hdC5vcGFjaXR5ID0gb3BhY2l0eTsgLy9pbnN0YW50aWF0ZSB0aGUgcG9pbnRcblx0XHRcdG1hdC50cmFuc3BhcmVudCA9IG9wYWNpdHkgPCAxO1xuXHRcdH1cblx0XHR0aGlzLl9vcGFjaXR5ID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdHNldCBjb2xvcihjb2xvcil7XG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLnBvaW50cy5sZW5ndGg7aSsrKXtcblx0XHRcdHRoaXMuZ2V0UG9pbnQoaSkuY29sb3IgPSBjb2xvcjtcblx0XHR9XG5cdFx0dGhpcy5fY29sb3IgPSBjb2xvcjtcblx0fVxuXHRnZXQgY29sb3IoKXtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3I7XG5cdH1cblx0c2V0IHdpZHRoKHdpZHRoKXtcblx0XHRmb3IodmFyIGk9MDtpPHRoaXMucG9pbnRzLmxlbmd0aDtpKyspe1xuXHRcdFx0dGhpcy5nZXRQb2ludChpKS5tZXNoLnNjYWxlLnNldFNjYWxhcih3aWR0aCk7XG5cdFx0fVxuXHRcdHRoaXMuX3dpZHRoID0gd2lkdGg7XG5cdH1cblx0Z2V0IHdpZHRoKCl7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZHRoO1xuXHR9XG5cdGNsb25lKCl7XG5cdFx0cmV0dXJuIG5ldyBQb2ludE91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG4vL3Rlc3RpbmcgY29kZVxuZnVuY3Rpb24gdGVzdFBvaW50KCl7XG5cdHZhciB4ID0gbmV3IEVYUC5BcmVhKHtib3VuZHM6IFtbLTEwLDEwXV19KTtcblx0dmFyIHkgPSBuZXcgRVhQLlRyYW5zZm9ybWF0aW9uKHsnZXhwcic6ICh4KSA9PiB4Knh9KTtcblx0dmFyIHkgPSBuZXcgRVhQLlBvaW50T3V0cHV0KCk7XG5cdHguYWRkKHkpO1xuXHR5LmFkZCh6KTtcblx0eC5hY3RpdmF0ZSgpO1xufVxuXG5leHBvcnQge1BvaW50T3V0cHV0fVxuIiwiaW1wb3J0IHsgTGluZU91dHB1dCB9IGZyb20gJy4vTGluZU91dHB1dC5qcyc7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gJy4uL3V0aWxzLmpzJztcblxuZXhwb3J0IGNsYXNzIFZlY3Rvck91dHB1dCBleHRlbmRzIExpbmVPdXRwdXR7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSl7XG5cdFx0LyppbnB1dDogVHJhbnNmb3JtYXRpb25cblx0XHRcdHdpZHRoOiBudW1iZXJcblx0XHQqL1xuXHRcdHN1cGVyKG9wdGlvbnMpO1xuXG5cdH1cblx0aW5pdCgpe1xuXHRcdHRoaXMuX2dlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCk7XG5cdFx0dGhpcy5fdmVydGljZXM7XG5cdFx0dGhpcy5hcnJvd2hlYWRzID0gW107XG5cblxuXHRcdHRoaXMubWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe2NvbG9yOiB0aGlzLl9jb2xvciwgbGluZXdpZHRoOiB0aGlzLl93aWR0aCwgb3BhY2l0eTp0aGlzLl9vcGFjaXR5fSk7XG5cdFx0dGhpcy5saW5lTWVzaCA9IG5ldyBUSFJFRS5MaW5lU2VnbWVudHModGhpcy5fZ2VvbWV0cnksdGhpcy5tYXRlcmlhbCk7XG5cblx0XHR0aGlzLm9wYWNpdHkgPSB0aGlzLl9vcGFjaXR5OyAvLyBzZXR0ZXIgc2V0cyB0cmFuc3BhcmVudCBmbGFnIGlmIG5lY2Vzc2FyeVxuXG5cblx0XHRjb25zdCBjaXJjbGVSZXNvbHV0aW9uID0gMTI7XG5cdFx0Y29uc3QgYXJyb3doZWFkU2l6ZSA9IDAuMztcblx0XHRjb25zdCBFUFNJTE9OID0gMC4wMDAwMTtcblx0XHR0aGlzLkVQU0lMT04gPSBFUFNJTE9OO1xuXG5cdFx0dGhpcy5jb25lR2VvbWV0cnkgPSBuZXcgVEhSRUUuQ3lsaW5kZXJCdWZmZXJHZW9tZXRyeSggMCwgYXJyb3doZWFkU2l6ZSwgYXJyb3doZWFkU2l6ZSoxLjcsIGNpcmNsZVJlc29sdXRpb24sIDEgKTtcblx0XHRsZXQgYXJyb3doZWFkT3ZlcnNob290RmFjdG9yID0gMC4xOyAvL3VzZWQgc28gdGhhdCB0aGUgbGluZSB3b24ndCBydWRlbHkgY2xpcCB0aHJvdWdoIHRoZSBwb2ludCBvZiB0aGUgYXJyb3doZWFkXG5cblx0XHR0aGlzLmNvbmVHZW9tZXRyeS50cmFuc2xhdGUoIDAsIC0gYXJyb3doZWFkU2l6ZSArIGFycm93aGVhZE92ZXJzaG9vdEZhY3RvciwgMCApO1xuXG5cdFx0dGhpcy5fY29uZVVwRGlyZWN0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwxLDApO1xuXG5cdFx0dGhpcy5tYWtlR2VvbWV0cnkoKTtcblxuXHRcdHRocmVlLnNjZW5lLmFkZCh0aGlzLmxpbmVNZXNoKTtcblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcblx0XHRzdXBlci5fb25GaXJzdEFjdGl2YXRpb24oKTtcblxuXHRcdGlmKHRoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoID4gMSl7XG5cdFx0XHR0aGlzLm51bUFycm93aGVhZHMgPSB0aGlzLml0ZW1EaW1lbnNpb25zLnNsaWNlKDAsdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMSkucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cnJlbnQpe1xuXHRcdFx0XHRyZXR1cm4gY3VycmVudCArIHByZXY7XG5cdFx0XHR9KTtcblx0XHR9ZWxzZXtcblx0XHRcdC8vYXNzdW1lZCBpdGVtRGltZW5zaW9ucyBpc24ndCBhIG5vbnplcm8gYXJyYXkuIFRoYXQgc2hvdWxkIGJlIHRoZSBjb25zdHJ1Y3RvcidzIHByb2JsZW0uXG5cdFx0XHR0aGlzLm51bUFycm93aGVhZHMgPSAxO1xuXHRcdH1cblxuXHRcdC8vcmVtb3ZlIGFueSBwcmV2aW91cyBhcnJvd2hlYWRzXG5cdFx0Zm9yKHZhciBpPTA7aTx0aGlzLmFycm93aGVhZHMubGVuZ3RoO2krKyl7XG5cdFx0XHRsZXQgYXJyb3cgPSB0aGlzLmFycm93aGVhZHNbaV07XG5cdFx0XHR0aHJlZS5zY2VuZS5yZW1vdmUoYXJyb3cpO1xuXHRcdH1cblxuXHRcdHRoaXMuYXJyb3doZWFkcyA9IG5ldyBBcnJheSh0aGlzLm51bUFycm93aGVhZHMpO1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5udW1BcnJvd2hlYWRzO2krKyl7XG5cdFx0XHR0aGlzLmFycm93aGVhZHNbaV0gPSBuZXcgVEhSRUUuTWVzaCh0aGlzLmNvbmVHZW9tZXRyeSwgdGhpcy5tYXRlcmlhbCk7XG5cdFx0XHR0aHJlZS5zY2VuZS5hZGQodGhpcy5hcnJvd2hlYWRzW2ldKTtcblx0XHR9XG5cdFx0Y29uc29sZS5sb2coXCJudW1iZXIgb2YgYXJyb3doZWFkcyAoPSBudW1iZXIgb2YgbGluZXMpOlwiKyB0aGlzLm51bUFycm93aGVhZHMpO1xuXHR9XG5cdGV2YWx1YXRlU2VsZihpLCB0LCB4LCB5LCB6KXtcblx0XHQvL2l0J3MgYXNzdW1lZCBpIHdpbGwgZ28gZnJvbSAwIHRvIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCBzaW5jZSB0aGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIGFuIEFyZWEuXG5cdFx0aWYoIXRoaXMuX2FjdGl2YXRlZE9uY2Upe1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkT25jZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkZpcnN0QWN0aXZhdGlvbigpO1x0XG5cdFx0fVxuXG5cdFx0Ly9hc3NlcnQgaSA8IHZlcnRpY2VzLmNvdW50XG5cblx0XHRsZXQgaW5kZXggPSB0aGlzLl9jdXJyZW50UG9pbnRJbmRleCp0aGlzLl9vdXRwdXREaW1lbnNpb25zO1xuXG5cdFx0aWYoeCAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4XSA9IHg7XG5cdFx0aWYoeSAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4KzFdID0geTtcblx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrMl0gPSB6O1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXgrKztcblxuXHRcdC8qIHdlJ3JlIGRyYXdpbmcgbGlrZSB0aGlzOlxuXHRcdCotLS0tKi0tLS0qXG5cbiAgICAgICAgKi0tLS0qLS0tLSpcblx0XG5cdFx0YnV0IHdlIGRvbid0IHdhbnQgdG8gaW5zZXJ0IGEgZGlhZ29uYWwgbGluZSBhbnl3aGVyZS4gVGhpcyBoYW5kbGVzIHRoYXQ6ICAqL1xuXG5cdFx0bGV0IGZpcnN0Q29vcmRpbmF0ZSA9IGkgJSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdO1xuXG5cdFx0Ly92ZXJ0aWNlcyBzaG91bGQgcmVhbGx5IGJlIGFuIHVuaWZvcm0sIHRob3VnaC5cblx0XHRpZighKGZpcnN0Q29vcmRpbmF0ZSA9PSAwIHx8IGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpKXtcblx0XHRcdGlmKHggIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCt0aGlzLl9vdXRwdXREaW1lbnNpb25zXSA9IHg7XG5cdFx0XHRpZih5ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysxXSA9IHk7XG5cdFx0XHRpZih6ICE9PSB1bmRlZmluZWQpdGhpcy5fdmVydGljZXNbaW5kZXgrdGhpcy5fb3V0cHV0RGltZW5zaW9ucysyXSA9IHo7XG5cdFx0XHR0aGlzLl9jdXJyZW50UG9pbnRJbmRleCsrO1xuXHRcdH1cblxuXHRcdGlmKGZpcnN0Q29vcmRpbmF0ZSA9PSB0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpe1xuXG5cdFx0XHQvL2NhbGN1bGF0ZSBkaXJlY3Rpb24gb2YgbGFzdCBsaW5lIHNlZ21lbnRcblx0XHRcdGxldCBkeCA9IHRoaXMuX3ZlcnRpY2VzW2luZGV4LXRoaXMuX291dHB1dERpbWVuc2lvbnNdIC0gdGhpcy5fdmVydGljZXNbaW5kZXhdXG5cdFx0XHRsZXQgZHkgPSB0aGlzLl92ZXJ0aWNlc1tpbmRleC10aGlzLl9vdXRwdXREaW1lbnNpb25zKzFdIC0gdGhpcy5fdmVydGljZXNbaW5kZXgrMV1cblx0XHRcdGxldCBkeiA9IHRoaXMuX3ZlcnRpY2VzW2luZGV4LXRoaXMuX291dHB1dERpbWVuc2lvbnMrMl0gLSB0aGlzLl92ZXJ0aWNlc1tpbmRleCsyXVxuXG5cdFx0XHRsZXQgbGluZU51bWJlciA9IE1hdGguZmxvb3IoaSAvIHRoaXMuaXRlbURpbWVuc2lvbnNbdGhpcy5pdGVtRGltZW5zaW9ucy5sZW5ndGgtMV0pO1xuXHRcdFx0VXRpbHMuYXNzZXJ0KGxpbmVOdW1iZXIgPD0gdGhpcy5udW1BcnJvd2hlYWRzKTsgLy90aGlzIG1heSBiZSB3cm9uZ1xuXG5cdFx0XHRsZXQgZGlyZWN0aW9uVmVjdG9yID0gbmV3IFRIUkVFLlZlY3RvcjMoLWR4LC1keSwtZHopXG5cblx0XHRcdC8vTWFrZSBhcnJvd3MgZGlzYXBwZWFyIGlmIHRoZSBsaW5lIGlzIHNtYWxsIGVub3VnaFxuXHRcdFx0Ly9PbmUgd2F5IHRvIGRvIHRoaXMgd291bGQgYmUgdG8gc3VtIHRoZSBkaXN0YW5jZXMgb2YgYWxsIGxpbmUgc2VnbWVudHMuIEknbSBjaGVhdGluZyBoZXJlIGFuZCBqdXN0IG1lYXN1cmluZyB0aGUgZGlzdGFuY2Ugb2YgdGhlIGxhc3QgdmVjdG9yLCB0aGVuIG11bHRpcGx5aW5nIGJ5IHRoZSBudW1iZXIgb2YgbGluZSBzZWdtZW50cyAobmFpdmVseSBhc3N1bWluZyBhbGwgbGluZSBzZWdtZW50cyBhcmUgdGhlIHNhbWUgbGVuZ3RoKVxuXHRcdFx0bGV0IGxlbmd0aCA9IGRpcmVjdGlvblZlY3Rvci5sZW5ndGgoKSAqICh0aGlzLml0ZW1EaW1lbnNpb25zW3RoaXMuaXRlbURpbWVuc2lvbnMubGVuZ3RoLTFdLTEpXG5cblx0XHRcdGNvbnN0IGVmZmVjdGl2ZURpc3RhbmNlID0gMztcblxuXHRcdFx0bGV0IGNsYW1wZWRMZW5ndGggPSBNYXRoLm1heCgwLCBNYXRoLm1pbihsZW5ndGgvZWZmZWN0aXZlRGlzdGFuY2UsIDEpKS8xXG5cblx0XHRcdC8vc2hyaW5rIGZ1bmN0aW9uIGRlc2lnbmVkIHRvIGhhdmUgYSBzdGVlcCBzbG9wZSBjbG9zZSB0byAwIGJ1dCBtZWxsb3cgb3V0IGF0IDAuNSBvciBzbyBpbiBvcmRlciB0byBhdm9pZCB0aGUgbGluZSB3aWR0aCBvdmVyY29taW5nIHRoZSBhcnJvd2hlYWQgd2lkdGhcblx0XHRcdC8vSW4gQ2hyb21lLCB0aHJlZS5qcyBjb21wbGFpbnMgd2hlbmV2ZXIgc29tZXRoaW5nIGlzIHNldCB0byAwIHNjYWxlLiBBZGRpbmcgYW4gZXBzaWxvbiB0ZXJtIGlzIHVuZm9ydHVuYXRlIGJ1dCBuZWNlc3NhcnkgdG8gYXZvaWQgY29uc29sZSBzcGFtLlxuXHRcdFx0XG5cdFx0XHR0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0uc2NhbGUuc2V0U2NhbGFyKE1hdGguYWNvcygxLTIqY2xhbXBlZExlbmd0aCkvTWF0aC5QSSArIHRoaXMuRVBTSUxPTik7XG5cdFx0XHRcbiBcdFx0XHQvL3Bvc2l0aW9uL3JvdGF0aW9uIGNvbWVzIGFmdGVyIHNpbmNlIC5ub3JtYWxpemUoKSBtb2RpZmllcyBkaXJlY3Rpb25WZWN0b3IgaW4gcGxhY2Vcblx0XHRcblx0XHRcdGxldCBwb3MgPSB0aGlzLmFycm93aGVhZHNbbGluZU51bWJlcl0ucG9zaXRpb247XG5cblx0XHRcdGlmKHggIT09IHVuZGVmaW5lZClwb3MueCA9IHg7XG5cdFx0XHRpZih5ICE9PSB1bmRlZmluZWQpcG9zLnkgPSB5O1xuXHRcdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXBvcy56ID0gejtcblxuXHRcdFx0aWYobGVuZ3RoID4gMCl7IC8vZGlyZWN0aW9uVmVjdG9yLm5vcm1hbGl6ZSgpIGZhaWxzIHdpdGggMCBsZW5ndGhcblx0XHRcdFx0dGhpcy5hcnJvd2hlYWRzW2xpbmVOdW1iZXJdLnF1YXRlcm5pb24uc2V0RnJvbVVuaXRWZWN0b3JzKHRoaXMuX2NvbmVVcERpcmVjdGlvbiwgZGlyZWN0aW9uVmVjdG9yLm5vcm1hbGl6ZSgpICk7XG5cdFx0XHR9XG5cblx0XHR9XG5cdH1cblx0Y2xvbmUoKXtcblx0XHRyZXR1cm4gbmV3IFZlY3Rvck91dHB1dCh7d2lkdGg6IHRoaXMud2lkdGgsIGNvbG9yOiB0aGlzLmNvbG9yLCBvcGFjaXR5OiB0aGlzLm9wYWNpdHl9KTtcblx0fVxufVxuXG5cbiIsImltcG9ydCB7T3V0cHV0Tm9kZX0gZnJvbSAnLi4vTm9kZS5qcyc7XG5pbXBvcnQge0xpbmVPdXRwdXR9IGZyb20gJy4vTGluZU91dHB1dC5qcyc7XG5cbmNsYXNzIFN1cmZhY2VPdXRwdXQgZXh0ZW5kcyBPdXRwdXROb2Rle1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cdFx0Lyogc2hvdWxkIGJlIC5hZGQoKWVkIHRvIGEgVHJhbnNmb3JtYXRpb24gdG8gd29ya1xuXHRcdFx0b3B0aW9uczpcblx0XHRcdHtcblx0XHRcdFx0d2lkdGg6IG51bWJlclxuXHRcdFx0XHRvcGFjaXR5OiBudW1iZXJcblx0XHRcdFx0Y29sb3I6IGhleCBjb2RlIG9yIFRIUkVFLkNvbG9yKClcblx0XHRcdH1cblx0XHQqL1xuXHRcdHRoaXMuX29wYWNpdHkgPSBvcHRpb25zLm9wYWNpdHkgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMub3BhY2l0eSA6IDE7XG5cdFx0dGhpcy5fY29sb3IgPSBvcHRpb25zLmNvbG9yICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmNvbG9yIDogMHg1NWFhNTU7XG5cblx0XHR0aGlzLm51bUNhbGxzUGVyQWN0aXZhdGlvbiA9IDA7IC8vc2hvdWxkIGFsd2F5cyBiZSBlcXVhbCB0byB0aGlzLnZlcnRpY2VzLmxlbmd0aFxuXHRcdHRoaXMuaXRlbURpbWVuc2lvbnMgPSBbXTsgLy8gaG93IG1hbnkgdGltZXMgdG8gYmUgY2FsbGVkIGluIGVhY2ggZGlyZWN0aW9uXG5cdFx0dGhpcy5fb3V0cHV0RGltZW5zaW9ucyA9IDM7IC8vaG93IG1hbnkgZGltZW5zaW9ucyBwZXIgcG9pbnQgdG8gc3RvcmU/XG5cblx0XHR0aGlzLnBhcmVudCA9IG51bGw7XG5cblx0XHR0aGlzLmluaXQoKTtcblx0fVxuXHRpbml0KCl7XG5cdFx0dGhpcy5fZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQnVmZmVyR2VvbWV0cnkoKTtcblx0XHR0aGlzLl92ZXJ0aWNlcztcblx0XHR0aGlzLm1ha2VHZW9tZXRyeSgpO1xuXG5cdFx0dGhpcy5tYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7Y29sb3I6IHRoaXMuX2NvbG9yLCBvcGFjaXR5OnRoaXMuX29wYWNpdHl9KTtcblx0XHR0aGlzLm1lc2ggPSBuZXcgVEhSRUUuTWVzaCh0aGlzLl9nZW9tZXRyeSx0aGlzLm1hdGVyaWFsKTtcblxuXHRcdHRoaXMub3BhY2l0eSA9IHRoaXMuX29wYWNpdHk7IC8vIHNldHRlciBzZXRzIHRyYW5zcGFyZW50IGZsYWcgaWYgbmVjZXNzYXJ5XG5cblx0XHR0aHJlZS5zY2VuZS5hZGQodGhpcy5tZXNoKTtcblx0fVxuXHRtYWtlR2VvbWV0cnkoKXtcblxuXHRcdGxldCBNQVhfUE9JTlRTID0gMTAwMDA7XG5cblx0XHR0aGlzLl92ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoTUFYX1BPSU5UUyAqIHRoaXMuX291dHB1dERpbWVuc2lvbnMpO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KE1BWF9QT0lOVFMgKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcblxuXHRcdC8vIGJ1aWxkIGdlb21ldHJ5XG5cblx0XHR0aGlzLl9nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICdwb3NpdGlvbicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB0aGlzLl92ZXJ0aWNlcywgdGhpcy5fb3V0cHV0RGltZW5zaW9ucyApICk7XG5cdFx0dGhpcy5fZ2VvbWV0cnkuYWRkQXR0cmlidXRlKCAnbm9ybWFsJywgbmV3IFRIUkVFLkZsb2F0MzJCdWZmZXJBdHRyaWJ1dGUoIHRoaXMuX25vcm1hbHMsIDMgKSApO1xuXHRcdC8vdGhpcy5nZW9tZXRyeS5hZGRBdHRyaWJ1dGUoICd1dicsIG5ldyBUSFJFRS5GbG9hdDMyQnVmZmVyQXR0cmlidXRlKCB1dnMsIDIgKSApO1xuXG5cdFx0dGhpcy5fY3VycmVudFBvaW50SW5kZXggPSAwOyAvL3VzZWQgZHVyaW5nIHVwZGF0ZXMgYXMgYSBwb2ludGVyIHRvIHRoZSBidWZmZXJcblxuXHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSBmYWxzZTtcblxuXHR9XG5cdF9vbkFkZCgpe1xuXHRcdC8vY2xpbWIgdXAgcGFyZW50IGhpZXJhcmNoeSB0byBmaW5kIHRoZSBBcmVhXG5cdFx0bGV0IHJvb3QgPSB0aGlzO1xuXHRcdHdoaWxlKHJvb3QucGFyZW50ICE9PSBudWxsKXtcblx0XHRcdHJvb3QgPSByb290LnBhcmVudDtcblx0XHR9XG5cdFxuXHRcdC8vdG9kbzogaW1wbGVtZW50IHNvbWV0aGluZyBsaWtlIGFzc2VydCByb290IHR5cGVvZiBSb290Tm9kZVxuXG5cdFx0dGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gPSByb290Lm51bUNhbGxzUGVyQWN0aXZhdGlvbjtcblx0XHR0aGlzLml0ZW1EaW1lbnNpb25zID0gcm9vdC5pdGVtRGltZW5zaW9ucztcblx0fVxuXHRfb25GaXJzdEFjdGl2YXRpb24oKXtcblx0XHR0aGlzLl9vbkFkZCgpOyAvL3NldHVwIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLml0ZW1EaW1lbnNpb25zLiB1c2VkIGhlcmUgYWdhaW4gYmVjYXVzZSBjbG9uaW5nIG1lYW5zIHRoZSBvbkFkZCgpIG1pZ2h0IGJlIGNhbGxlZCBiZWZvcmUgdGhpcyBpcyBjb25uZWN0ZWQgdG8gYSB0eXBlIG9mIGRvbWFpblxuXG5cdFx0Ly8gcGVyaGFwcyBpbnN0ZWFkIG9mIGdlbmVyYXRpbmcgYSB3aG9sZSBuZXcgYXJyYXksIHRoaXMgY2FuIHJldXNlIHRoZSBvbGQgb25lP1xuXHRcdGxldCB2ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcblx0XHRsZXQgbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24gKiAzKTtcblxuXHRcdGNvbnNvbGUubG9nKHRoaXMuaXRlbURpbWVuc2lvbnMsIHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uLCB0aGlzLl9vdXRwdXREaW1lbnNpb25zKTtcblxuXHRcdGxldCBwb3NpdGlvbkF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb247XG5cdFx0dGhpcy5fdmVydGljZXMgPSB2ZXJ0aWNlcztcblx0XHRwb3NpdGlvbkF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl92ZXJ0aWNlcyk7XG5cdFx0cG9zaXRpb25BdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cdFx0bGV0IG5vcm1hbEF0dHJpYnV0ZSA9IHRoaXMuX2dlb21ldHJ5LmF0dHJpYnV0ZXMubm9ybWFsO1xuXHRcdHRoaXMuX25vcm1hbHMgPSBub3JtYWxzO1xuXHRcdG5vcm1hbEF0dHJpYnV0ZS5zZXRBcnJheSh0aGlzLl9ub3JtYWxzKTtcblx0XHRub3JtYWxBdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG5cblx0XHQvL2Fzc2VydCB0aGlzLml0ZW1EaW1lbnNpb25zWzBdICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSA9IHRoaXMubnVtQ2FsbHNQZXJBY3RpdmF0aW9uIGFuZCB0aGlzLl9vdXRwdXREaW1lbnNpb25zID09IDJcblx0XHR2YXIgaW5kaWNlcyA9IFtdO1xuXG5cdFx0Ly9yZW5kZXJlZCB0cmlhbmdsZSBpbmRpY2VzXG5cdFx0Ly9mcm9tIHRocmVlLmpzIFBsYW5lR2VvbWV0cnkuanNcblx0XHRsZXQgYmFzZSA9IDA7XG5cdFx0bGV0IGk9MCwgaj0wO1xuXHRcdGZvcihqPTA7ajx0aGlzLml0ZW1EaW1lbnNpb25zWzBdLTE7aisrKXtcblx0XHRcdGZvcihpPTA7aTx0aGlzLml0ZW1EaW1lbnNpb25zWzFdLTE7aSsrKXtcblxuXHRcdFx0XHRsZXQgYSA9IGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXTtcblx0XHRcdFx0bGV0IGIgPSBpICsgKGorMSkgKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXHRcdFx0XHRsZXQgYyA9IChpKzEpKyAoaisxKSAqIHRoaXMuaXRlbURpbWVuc2lvbnNbMV07XG5cdFx0XHRcdGxldCBkID0gKGkrMSkrIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdO1xuXG4gICAgICAgIFx0XHRpbmRpY2VzLnB1c2goYSwgYiwgZCk7XG5cdFx0XHRcdGluZGljZXMucHVzaChiLCBjLCBkKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vZG91YmxlIHNpZGVkIHJldmVyc2UgZmFjZXNcbiAgICAgICAgXHRcdC8qaW5kaWNlcy5wdXNoKGQsIGIsIGEpO1xuXHRcdFx0XHRpbmRpY2VzLnB1c2goZCwgYywgYik7Ki9cblxuXHRcdFx0XHQvL3NldCBub3JtYWwgdG8gWzAsMCwxXVxuXHRcdFx0XHQvKm5vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqM10gPSAwXG5cdFx0XHRcdG5vcm1hbHNbKGkgKyBqICogdGhpcy5pdGVtRGltZW5zaW9uc1sxXSkqMysxXSA9IDBcblx0XHRcdFx0bm9ybWFsc1soaSArIGogKiB0aGlzLml0ZW1EaW1lbnNpb25zWzFdKSozKzJdID0gMCovXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnNvbGUubG9nKGluZGljZXMpO1xuXHRcdHRoaXMuX2dlb21ldHJ5LnNldEluZGV4KCBpbmRpY2VzICk7XG5cdH1cblx0ZXZhbHVhdGVTZWxmKGksIHQsIHgsIHksIHope1xuXHRcdGlmKCF0aGlzLl9hY3RpdmF0ZWRPbmNlKXtcblx0XHRcdHRoaXMuX2FjdGl2YXRlZE9uY2UgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25GaXJzdEFjdGl2YXRpb24oKTtcdFxuXHRcdH1cblxuXHRcdC8vaXQncyBhc3N1bWVkIGkgd2lsbCBnbyBmcm9tIDAgdG8gdGhpcy5udW1DYWxsc1BlckFjdGl2YXRpb24sIHNpbmNlIHRoaXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGZyb20gYW4gQXJlYS5cblxuXHRcdC8vYXNzZXJ0IGkgPCB2ZXJ0aWNlcy5jb3VudFxuXG5cdFx0bGV0IGluZGV4ID0gdGhpcy5fY3VycmVudFBvaW50SW5kZXgqdGhpcy5fb3V0cHV0RGltZW5zaW9ucztcblxuXHRcdGlmKHggIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleF0gPSB4O1xuXHRcdGlmKHkgIT09IHVuZGVmaW5lZCl0aGlzLl92ZXJ0aWNlc1tpbmRleCsxXSA9IHk7XG5cdFx0aWYoeiAhPT0gdW5kZWZpbmVkKXRoaXMuX3ZlcnRpY2VzW2luZGV4KzJdID0gejtcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4Kys7XG5cdH1cblx0b25BZnRlckFjdGl2YXRpb24oKXtcblx0XHRsZXQgcG9zaXRpb25BdHRyaWJ1dGUgPSB0aGlzLl9nZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uO1xuXHRcdHBvc2l0aW9uQXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblxuXHRcdC8vdG9kbzogcmVjYWxjIG5vcm1hbHNcblxuXHRcdHRoaXMuX2N1cnJlbnRQb2ludEluZGV4ID0gMDsgLy9yZXNldCBhZnRlciBlYWNoIHVwZGF0ZVxuXHR9XG5cdHNldCBjb2xvcihjb2xvcil7XG5cdFx0Ly9jdXJyZW50bHkgb25seSBhIHNpbmdsZSBjb2xvciBpcyBzdXBwb3J0ZWQuXG5cdFx0Ly9JIHNob3VsZCByZWFsbHkgbWFrZSB0aGlzIGEgZnVuY3Rpb25cblx0XHR0aGlzLm1hdGVyaWFsLmNvbG9yID0gbmV3IFRIUkVFLkNvbG9yKGNvbG9yKTtcblx0XHR0aGlzLl9jb2xvciA9IGNvbG9yO1xuXHR9XG5cdGdldCBjb2xvcigpe1xuXHRcdHJldHVybiB0aGlzLl9jb2xvcjtcblx0fVxuXHRzZXQgb3BhY2l0eShvcGFjaXR5KXtcblx0XHR0aGlzLm1hdGVyaWFsLm9wYWNpdHkgPSBvcGFjaXR5O1xuXHRcdHRoaXMubWF0ZXJpYWwudHJhbnNwYXJlbnQgPSBvcGFjaXR5IDwgMTtcblx0XHR0aGlzLm1hdGVyaWFsLnZpc2libGUgPSBvcGFjaXR5ID4gMDtcblx0XHR0aGlzLl9vcGFjaXR5ID0gb3BhY2l0eTtcblx0fVxuXHRnZXQgb3BhY2l0eSgpe1xuXHRcdHJldHVybiB0aGlzLl9vcGFjaXR5O1xuXHR9XG5cdHNldCB3aWR0aCh3aWR0aCl7XG5cdFx0dGhpcy5fd2lkdGggPSB3aWR0aDtcblx0XHR0aGlzLm1hdGVyaWFsLmxpbmV3aWR0aCA9IHdpZHRoO1xuXHR9XG5cdGdldCB3aWR0aCgpe1xuXHRcdHJldHVybiB0aGlzLl93aWR0aDtcblx0fVxuXHRjbG9uZSgpe1xuXHRcdHJldHVybiBuZXcgU3VyZmFjZU91dHB1dCh7Y29sb3I6IHRoaXMuY29sb3IsIG9wYWNpdHk6IHRoaXMub3BhY2l0eX0pO1xuXHR9XG59XG5cbmV4cG9ydCB7U3VyZmFjZU91dHB1dH07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLypUaGlzIGNsYXNzIGlzIHN1cHBvc2VkIHRvIHR1cm4gYSBzZXJpZXMgb2ZcbmRpci5kZWxheSgpXG5kaXIudHJhbnNpdGlvblRvKC4uLilcbmRpci5kZWxheSgpXG5kaXIubmV4dFNsaWRlKCk7XG5cbiovXG5cbmltcG9ydCB7QW5pbWF0aW9ufSBmcm9tICcuL0FuaW1hdGlvbi5qcyc7XG5cbmNsYXNzIERpcmVjdGlvbkFycm93e1xuXHRjb25zdHJ1Y3RvcihmYWNlUmlnaHQpe1xuXHRcdHRoaXMuYXJyb3dJbWFnZSA9IERpcmVjdGlvbkFycm93LmFycm93SW1hZ2U7IC8vdGhpcyBzaG91bGQgYmUgY2hhbmdlZCBvbmNlIEkgd2FudCB0byBtYWtlIG11bHRpcGxlIGFycm93cyBhdCBvbmNlXG5cblx0XHRmYWNlUmlnaHQgPSBmYWNlUmlnaHQ9PT11bmRlZmluZWQgPyB0cnVlIDogZmFjZVJpZ2h0O1xuXG5cdFx0aWYoZmFjZVJpZ2h0KXtcblx0XHRcdHRoaXMuYXJyb3dJbWFnZS5jbGFzc0xpc3QuYWRkKFwiZXhwLWFycm93LXJpZ2h0XCIpXG5cdFx0fWVsc2V7XG5cdFx0XHR0aGlzLmFycm93SW1hZ2UuY2xhc3NMaXN0LmFkZChcImV4cC1hcnJvdy1sZWZ0XCIpXG5cdFx0fVxuXHRcdHRoaXMuYXJyb3dJbWFnZS5vbmNsaWNrID0gKGZ1bmN0aW9uKCl7XG5cdFx0XHR0aGlzLm9uY2xpY2soKTtcblx0XHR9KS5iaW5kKHRoaXMpO1xuXG5cdFx0dGhpcy5vbmNsaWNrQ2FsbGJhY2sgPSBudWxsOyAvLyB0byBiZSBzZXQgZXh0ZXJuYWxseVxuXHR9XG5cdG9uY2xpY2soKXtcblx0XHR0aGlzLmhpZGVTZWxmKCk7XG5cdFx0dGhpcy5vbmNsaWNrQ2FsbGJhY2soKTtcblx0fVxuXHRzaG93U2VsZigpe1xuXHRcdHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJyc7XG5cdFx0dGhpcy5hcnJvd0ltYWdlLnN0eWxlLm9wYWNpdHkgPSAxO1xuXHRcdFxuXHR9XG5cdGhpZGVTZWxmKCl7XG5cdFx0dGhpcy5hcnJvd0ltYWdlLnN0eWxlLm9wYWNpdHkgPSAwO1xuXHRcdHRoaXMuYXJyb3dJbWFnZS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuXHR9XG5cdHN0YXRpYyBhc3luYyBsb2FkSW1hZ2UoKXtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoXG5cdFx0XHQoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHRcdFx0aWYodGhpcy5hcnJvd0ltYWdlICYmIHRoaXMuYXJyb3dJbWFnZS53aWR0aCAhPSAwKXtcblx0XHRcdFx0XHRyZXR1cm4gcmVzb2x2ZSgpOyAvL3F1aXQgZWFybHlcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmFycm93SW1hZ2UgPSBuZXcgSW1hZ2UoKTtcblx0XHRcdFx0dGhpcy5hcnJvd0ltYWdlLm9ubG9hZCA9IHJlc29sdmU7XG5cdFx0XHRcdFxuXHRcdFx0XHR0aGlzLmFycm93SW1hZ2Uuc3JjID0gXG50aGlzLmFycm93SW1hZ2UuYmFzZVVSSS5zdWJzdHJpbmcoMCx0aGlzLmFycm93SW1hZ2UuYmFzZVVSSS5zZWFyY2goXCJleHBsYW5hcmlhXCIpKSArIFwiZXhwbGFuYXJpYS9zcmMvRXhwbGFuYXJpYW5OZXh0QXJyb3cuc3ZnXCI7XG5cdFx0XHRcdHRoaXMuYXJyb3dJbWFnZS5jbGFzc05hbWUgPSBcImV4cC1hcnJvd1wiO1xuXHRcdFx0fSkuYmluZCh0aGlzKSk7XG5cdH1cbn1cbkRpcmVjdGlvbkFycm93LmxvYWRJbWFnZSgpOyAvLyBwcmVsb2FkXG5cblxuY2xhc3MgTm9uRGVjcmVhc2luZ0RpcmVjdG9ye1xuXHQvLyBJIHdhbnQgRGlyZWN0b3IoKSB0byBiZSBhYmxlIHRvIGJhY2t0cmFjayBieSBwcmVzc2luZyBiYWNrd2FyZHMuIFRoaXMgZG9lc24ndCBkbyB0aGF0LlxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKXtcblx0XHR0aGlzLnVuZG9TdGFjayA9IFtdO1xuXHRcdHRoaXMudW5kb1N0YWNrSW5kZXggPSAwO1xuXG5cdFx0dGhpcy5zbGlkZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZXhwLXNsaWRlXCIpO1xuXHRcdHRoaXMuY3VycmVudFNsaWRlSW5kZXggPSAwO1xuXG5cdFx0dGhpcy5uZXh0U2xpZGVSZXNvbHZlRnVuY3Rpb24gPSBudWxsO1xuXHR9XG5cblxuXHRhc3luYyBiZWdpbigpe1xuXHRcdGF3YWl0IHRoaXMud2FpdEZvclBhZ2VMb2FkKCk7XG5cblx0XHR0aGlzLnJpZ2h0QXJyb3cgPSBuZXcgRGlyZWN0aW9uQXJyb3coKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMucmlnaHRBcnJvdy5hcnJvd0ltYWdlKTtcblx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cdFx0dGhpcy5yaWdodEFycm93Lm9uY2xpY2tDYWxsYmFjayA9IGZ1bmN0aW9uKCl7XG5cdFx0XHRzZWxmLl9jaGFuZ2VTbGlkZSgxLCBmdW5jdGlvbigpe30pOyAvLyB0aGlzIGVycm9ycyB3aXRob3V0IHRoZSBlbXB0eSBmdW5jdGlvbiBiZWNhdXNlIHRoZXJlJ3Mgbm8gcmVzb2x2ZS4gVGhlcmUgbXVzdCBiZSBhIGJldHRlciB3YXkgdG8gZG8gdGhpbmdzLlxuXHRcdFx0Y29uc29sZS53YXJuKFwiV0FSTklORzogSG9ycmlibGUgaGFjayBpbiBlZmZlY3QgdG8gY2hhbmdlIHNsaWRlcy4gUGxlYXNlIHJlcGxhY2UgdGhlIHBhc3MtYW4tZW1wdHktZnVuY3Rpb24gdGhpbmcgd2l0aCBzb21ldGhpbmcgdGhhdCBhY3R1YWxseSByZXNvbHZlcyBwcm9wZXJseSBhbmQgZG9lcyBhc3luYy5cIilcblx0XHRcdHNlbGYubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uKCk7XG5cdFx0fVxuXG5cdH1cblxuXHRhc3luYyB3YWl0Rm9yUGFnZUxvYWQoKXtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHRcdC8vd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIscmVzb2x2ZSk7XG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLDEpO1xuXHRcdFx0cmVzb2x2ZSgpXG5cdFx0fSk7XG5cdH1cblxuXHRzaG93U2xpZGUoc2xpZGVOdW1iZXIpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5zbGlkZXMubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLnNsaWRlc1tpXS5zdHlsZS5vcGFjaXR5ID0gMDtcblx0XHR9XG5cdFx0dGhpcy5zbGlkZXNbc2xpZGVOdW1iZXJdLnN0eWxlLm9wYWNpdHkgPSAxO1xuXHR9XG5cblx0YXN5bmMgbmV4dFNsaWRlKCl7XG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xuXG5cdFx0dGhpcy5yaWdodEFycm93LnNob3dTZWxmKCk7XG5cdFx0Ly9wcm9taXNlIGlzIHJlc29sdmVkIGJ5IGNhbGxpbmcgdGhpcy5uZXh0U2xpZGVQcm9taXNlLnJlc29sdmUoKSB3aGVuIHRoZSB0aW1lIGNvbWVzXG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHRcdGZ1bmN0aW9uIGtleUxpc3RlbmVyKGUpe1xuXHRcdFx0XHRpZihlLnJlcGVhdClyZXR1cm47IC8va2V5ZG93biBmaXJlcyBtdWx0aXBsZSB0aW1lcyBidXQgd2Ugb25seSB3YW50IHRoZSBmaXJzdCBvbmVcblx0XHRcdFx0bGV0IHNsaWRlRGVsdGEgPSAwO1xuXHRcdFx0XHRzd2l0Y2ggKGUua2V5Q29kZSkge1xuXHRcdFx0XHQgIGNhc2UgMzQ6XG5cdFx0XHRcdCAgY2FzZSAzOTpcblx0XHRcdFx0ICBjYXNlIDQwOlxuXHRcdFx0XHRcdHNsaWRlRGVsdGEgPSAxO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHQgIGRlZmF1bHQ6XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoc2xpZGVEZWx0YSAhPSAwKXtcblx0XHRcdFx0XHRzZWxmLl9jaGFuZ2VTbGlkZShzbGlkZURlbHRhLCByZXNvbHZlKTtcblx0XHRcdFx0XHRzZWxmLnJpZ2h0QXJyb3cuaGlkZVNlbGYoKTtcblx0XHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIixrZXlMaXN0ZW5lcik7IC8vdGhpcyBhcHByb2FjaCB0YWtlbiBmcm9tIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM1NzE4NjQ1L3Jlc29sdmluZy1hLXByb21pc2Utd2l0aC1ldmVudGxpc3RlbmVyXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGtleUxpc3RlbmVyKTtcblx0XHRcdC8vaG9ycmlibGUgaGFjayBzbyB0aGF0IHRoZSAnbmV4dCBzbGlkZScgYXJyb3cgY2FuIHRyaWdnZXIgdGhpcyB0b29cblx0XHRcdHNlbGYubmV4dFNsaWRlUmVzb2x2ZUZ1bmN0aW9uID0gZnVuY3Rpb24oKXsgXG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsa2V5TGlzdGVuZXIpOyBcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRfY2hhbmdlU2xpZGUoc2xpZGVEZWx0YSwgcmVzb2x2ZSl7XG5cdFx0XHQvL3NsaWRlIGNoYW5naW5nIGxvZ2ljXG5cblxuXHRcdC8vcmlnaHQgbm93IHRoZXJlIGlzIGEgcHJvYmxlbS4gR29pbmcgYmFja3dhcmRzIHNob3VsZCBub3QgcmVzb2x2ZSB0aGUgcHJvbWlzZTsgb25seSBnb2luZyB0byB0aGUgbW9zdCByZWNlbnQgc2xpZGUgYW5kIHByZXNzaW5nIHJpZ2h0IHNob3VsZC5cblx0XHRpZihzbGlkZURlbHRhICE9IDApe1xuXHRcdFx0aWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA9PSAwICYmIHNsaWRlRGVsdGEgPT0gLTEpe1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IHRoaXMuc2xpZGVzLmxlbmd0aC0xICYmIHNsaWRlRGVsdGEgPT0gMSl7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuY3VycmVudFNsaWRlSW5kZXggKz0gc2xpZGVEZWx0YTtcblx0XHRcdHRoaXMuc2hvd1NsaWRlKHRoaXMuY3VycmVudFNsaWRlSW5kZXgpO1xuXHRcdFx0cmVzb2x2ZSgpO1xuXHRcdH1cblx0fVxuXHQvL3ZlcmJzXG5cdGFzeW5jIGRlbGF5KHdhaXRUaW1lKXtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIHdhaXRUaW1lKTtcblx0XHR9KTtcblx0fVxuXHRUcmFuc2l0aW9uVG8odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyl7XG5cdFx0Ly9FWFAuVXRpbHMuQXNzZXJ0KHRoaXMudW5kb1N0YWNrSW5kZXggPT0gMCk7IC8vVGhpcyBtYXkgbm90IHdvcmsgd2VsbC5cblx0XHRuZXcgQW5pbWF0aW9uKHRhcmdldCwgdG9WYWx1ZXMsIGR1cmF0aW9uTVMgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGR1cmF0aW9uTVMvMTAwMCk7XG5cdH1cbn1cbi8qXG5jbGFzcyBEaXJlY3Rvcntcblx0Ly90b2RvLiBNYWtlIHRoaXMgYWJsZSB0byBiYWNrdHJhY2tcblx0Y29uc3RydWN0b3Iob3B0aW9ucyl7XG5cdFx0dGhpcy51bmRvU3RhY2sgPSBbXTtcblx0XHR0aGlzLnVuZG9TdGFja0luZGV4ID0gMDtcblxuXHRcdHRoaXMuc2xpZGVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImV4cC1zbGlkZVwiKTtcblx0XHR0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID0gMDtcblx0XHQvL3RoaXMuc2hvd1NsaWRlKDApOyAvL2ZhaWxzIGJlY2F1c2UgRE9NIGlzbid0IGxvYWRlZC5cblx0fVxuXG5cdGFzeW5jIHdhaXRGb3JQYWdlTG9hZCgpe1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIscmVzb2x2ZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRzaG93U2xpZGUoc2xpZGVOdW1iZXIpe1xuXHRcdGZvcih2YXIgaT0wO2k8dGhpcy5zbGlkZXMubGVuZ3RoO2krKyl7XG5cdFx0XHR0aGlzLnNsaWRlc1tpXS5zdHlsZS5vcGFjaXR5ID0gMDtcblx0XHR9XG5cdFx0dGhpcy5zbGlkZXNbc2xpZGVOdW1iZXJdLnN0eWxlLm9wYWNpdHkgPSAxO1xuXHR9XG5cblx0bmV4dFNsaWRlKCl7XG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlwcmVzc1wiLCBmdW5jdGlvbiBrZXlMaXN0ZW5lcihlKXtcblx0XHRcdFx0bGV0IHNsaWRlRGVsdGEgPSAwO1xuXHRcdFx0XHRzd2l0Y2ggKGUua2V5Q29kZSkge1xuXHRcdFx0XHQgIGNhc2UgMzM6XG5cdFx0XHRcdCAgY2FzZSAzNzpcblx0XHRcdFx0ICBjYXNlIDM4OlxuXHRcdFx0XHRcdHNsaWRlRGVsdGEgPSAtMTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0ICBjYXNlIDM0OlxuXHRcdFx0XHQgIGNhc2UgMzk6XG5cdFx0XHRcdCAgY2FzZSA0MDpcblx0XHRcdFx0XHRzbGlkZURlbHRhID0gMTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxmLl9jaGFuZ2VTbGlkZShzbGlkZURlbHRhLCByZXNvbHZlKTtcblx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJrZXlwcmVzc1wiLGtleUxpc3RlbmVyKTsgLy90aGlzIGFwcHJvYWNoIHRha2VuIGZyb20gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzU3MTg2NDUvcmVzb2x2aW5nLWEtcHJvbWlzZS13aXRoLWV2ZW50bGlzdGVuZXJcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cdF9jaGFuZ2VTbGlkZShzbGlkZURlbHRhLCByZXNvbHZlKXtcblx0XHRcdC8vc2xpZGUgY2hhbmdpbmcgbG9naWNcblx0XHRpZihzbGlkZURlbHRhICE9IDApe1xuXHRcdFx0aWYodGhpcy5jdXJyZW50U2xpZGVJbmRleCA9PSAwICYmIHNsaWRlRGVsdGEgPT0gLTEpe1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZih0aGlzLmN1cnJlbnRTbGlkZUluZGV4ID09IHRoaXMuc2xpZGVzLmxlbmd0aC0xICYmIHNsaWRlRGVsdGEgPT0gMSl7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdFx0Y29uc29sZS5sb2coc2xpZGVEZWx0YSwgdGhpcy5jdXJyZW50U2xpZGVJbmRleCk7XG5cdFx0XHR0aGlzLmN1cnJlbnRTbGlkZUluZGV4ICs9IHNsaWRlRGVsdGE7XG5cdFx0XHR0aGlzLnNob3dTbGlkZSh0aGlzLmN1cnJlbnRTbGlkZUluZGV4KTtcblx0XHRcdHJlc29sdmUoKTtcblx0XHR9XG5cdH1cblxuXHQvL3ZlcmJzXG5cdGFzeW5jIGRlbGF5KHdhaXRUaW1lKXtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIHdhaXRUaW1lKTtcblx0XHR9KTtcblx0fVxuXHR0cmFuc2l0aW9uVG8odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyl7XG5cdFx0Ly9FWFAuVXRpbHMuQXNzZXJ0KHRoaXMudW5kb1N0YWNrSW5kZXggPT0gMCk7IC8vVGhpcyBtYXkgbm90IHdvcmsgd2VsbC5cblx0XHR2YXIgYW5pbWF0aW9uID0gbmV3IEVYUC5BbmltYXRpb24odGFyZ2V0LCB0b1ZhbHVlcywgZHVyYXRpb25NUyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZHVyYXRpb25NUy8xMDAwKTtcblx0XHRsZXQgZnJvbVZhbHVlcyA9IGFuaW1hdGlvbi5mcm9tVmFsdWVzO1xuXHRcdHRoaXMudW5kb1N0YWNrLnB1c2gobmV3IEVYUC5EaXJlY3Rvci5VbmRvSXRlbSh0YXJnZXQsIHRvVmFsdWVzLCBmcm9tVmFsdWVzLCBkdXJhdGlvbk1TKSk7XG5cdFx0dGhpcy51bmRvU3RhY2tJbmRleCsrO1xuXHR9XG59XG5cbkVYUC5EaXJlY3Rvci5VbmRvSXRlbSA9IGNsYXNzIFVuZG9JdGVte1xuXHRjb25zdHJ1Y3Rvcih0YXJnZXQsIHRvVmFsdWVzLCBmcm9tVmFsdWVzLCBkdXJhdGlvbk1TKXtcblx0XHR0aGlzLnRhcmdldCA9IHRhcmdldDtcblx0XHR0aGlzLnRvVmFsdWVzID0gdG9WYWx1ZXM7XG5cdFx0dGhpcy5mcm9tVmFsdWVzID0gZnJvbVZhbHVlcztcblx0XHR0aGlzLmR1cmF0aW9uTVMgPSBkdXJhdGlvbk1TO1xuXHR9XG59Ki9cblxuZXhwb3J0IHsgTm9uRGVjcmVhc2luZ0RpcmVjdG9yLCBEaXJlY3Rpb25BcnJvdyB9O1xuIl0sIm5hbWVzIjpbIk1hdGgiLCJBcmVhIiwiVHJhbnNmb3JtYXRpb24iLCJtYXRoLmxlcnBWZWN0b3JzIiwicmVxdWlyZSIsInJlcXVpcmUkJDAiLCJyZXF1aXJlJCQxIiwicmVxdWlyZSQkMiIsImdsb2JhbCIsImRlZmluZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0NBQUE7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFQSxNQUFNLElBQUk7Q0FDVixDQUFDLFdBQVcsRUFBRSxFQUFFO0NBQ2hCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztDQUNYO0NBQ0EsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztDQUM1QixFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0NBQ3RCLEVBQUUsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztDQUNqQyxFQUFFLE9BQU8sS0FBSyxDQUFDO0NBQ2YsRUFBRTtDQUNGLENBQUMsTUFBTSxFQUFFLEVB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QWEsSUFBSSxDQUFDLENBQUM7Q0FDbkM7Q0FDQSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0NBQzVDLElBQUksSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3RHLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Q0FDN0MsS0FBSyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDdkcsS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztDQUM5QyxNQUFNLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJ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Q0FDaEMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDM0MsR0FBRztDQUNILEVBQUUsS0FBSyxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7Q0FDM0Q7Q0FDQSxFQUFFO0NBQ0YsQ0FBQzs7Q0FFRDtDQUNBLFNBQVMsWUFBWSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLGVBQWUsQ0FBQztDQUNwRSxDQUFDLElBQUksU0FBUyxHQUFHLElBQUksU0FBUyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxLQUFLLFNBQVMsR0FBRyxTQUFTLEdBQUcsVUFBVSxDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztDQUMxSCxDQUFDOzs7Ozs7Ozs7Ozs7O0NDaEhELENBQUMsWUFBWTs7RUFHWixJQUFJLE1BQU0sR0FBRztJQUNYLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0lBQ3RDLENBQUM7RUFDSCxTQUFTLEtBQUssQ0FBQyxNQUFNLEVBQUU7R0FDdEIsSUFBSSxDQUFDLEVBQUUsTUFBTSxHQUFHLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0dBQ3ZDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDL0IsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNkO0dBQ0QsT0FBTyxNQUFNLENBQUM7R0FDZDs7RUFFRCxTQUFTLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUU7R0FDcEQsSUFBSSxPQUFPLEdBQUcsTUFBTSxHQUFHLFNBQVM7SUFDL0IsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDOztHQUVuRSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDOztHQUVqQixPQUFPLE1BQU0sQ0FBQztHQUNkOztFQUVELFNBQVMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0dBQzlCLEdBQUcsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztHQUM5QixPQUFPLGNBQWMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBRyxFQUFFLEdBQUcsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDO0dBQzVEOztFQUVELFNBQVMs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QUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU9DLGVBQU8sRUFBRSxVQUFVLEVBQUVBLGVBQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBT0EsZUFBTyxFQUFFLFVBQVUsRUFBRUEsZUFBTyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxZQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxVQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxHQUFHLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLFlBQVksS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLHdDQUF3QyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxvQkFBbUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLCtDQUErQyxDQUFDLHFDQUFxQyxDQUFDLGtEQUFrRCxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxPQUFPLE9BQU8sQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxTQUFTLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsUUFBUSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUMsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxnQkFBZ0IsQ0FBQyxTQUFTLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBQyxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQyxNQUFNLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsT0FBTyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFVBQVUsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFFBQVEsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU8sR0FBRyxHQUFHLFFBQVEsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxTQUFTLE1BQU0sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksVUFBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsWUFBWSxDQUFDLENBQUMsR0FBRyxZQUFZLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBSyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEdBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBRyxJQUFJLEVBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLDRCQUE0QixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxBQUFtQixJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQUssQ0FBQyxDQUFDLE9BQU8sTUFBTSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxTQUFTLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFDLENBQUMsU0FBUyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxTQUFTLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFDLENBQUMsU0FBUyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFDLENBQUMsU0FBUyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLEdBQUcsU0FBUyxHQUFHLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLE1BQU0sUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBSyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsTUFBTSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsRUFBRSxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLEFBQXdCLElBQUksU0FBUyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxjQUFjLENBQUMsRUFBRSxDQUFDLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsQUFBYSxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxJQUFJLGNBQWMsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxRQUFRLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksUUFBUSxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxTQUFTLFNBQVMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsU0FBUyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBUyxDQUFDLFNBQVMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQVksQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxXQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsU0FBUyxDQUFDLE9BQU8sV0FBVyxDQUFDLFNBQVMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsR0FBRyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVMsQ0FBQyxTQUFTLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxXQUFXLENBQUMsR0FBRyxFQUFFLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsUUFBUSxHQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsU0FBUyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsNkZBQTZGLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsUUFBUSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLElBQUksR0FBRyxJQUFJLE1BQU0sQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUMsQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLFNBQVMsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLFVBQVUsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLEdBQUcsR0FBRyxHQUFHLE9BQU8sRUFBRSxHQUFHLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxhQUFhLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxHQUFHLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUMsQ0FBQyxHQUFHLE9BQU8sU0FBUyxHQUFHLFdBQVcsRUFBRSxTQUFTLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sd0JBQXdCLEdBQUcsV0FBVyxFQUFFLHdCQUF3QixHQUFHLElBQUksRUFBRSxLQUFLLFlBQVksd0JBQXdCLEVBQUUsT0FBTyxxQkFBcUIsR0FBRyxXQUFXLEVBQUUscUJBQXFCLEdBQUcsSUFBSSxFQUFFLEtBQUssWUFBWSxxQkFBcUIsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFLLENBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQU0sVUFBVSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE9BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxTQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBQyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxZQUFZLEVBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxHQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsTUFBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsR0FBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLE9BQU8sV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBQyxDQUFDLENBQUMs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QyxXQUFXLENBQUMsT0FBTyxDQUFDO0NBQ3JCO0NBQ0E7Q0FDQTtDQUNBOztDQUVBLEVBQUUsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLEdBQUcsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFLO0NBQzdELEVBQUUsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLEdBQUcsUUFBUSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7O0NBRXJFLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDOztDQUV6RixFQUFFLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sS0FBSyxTQUFTLEdBQUcsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7O0NBRXJFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDL0MsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUMxQyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzs7Q0FFN0IsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQzFCLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUMxQixFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDMUIsRUFBRTtDQUNGLENBQUMsSUFB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
