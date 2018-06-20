var EXP = EXP || {};

EXP.Utils = class Utils{

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
			console.error("ERROR! "+name+" not present in required property")
		}
	}
}

