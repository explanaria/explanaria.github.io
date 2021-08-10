import {clone} from './math.js'

class Utils{
	static isArray(x){
        if(x === undefined){
            return false;
        }
		return x.constructor === Array;
	}
	static isObject(x){
        if(x === undefined){
            return false;
        }
		return x.constructor === Object;
	}
	static arrayCopy(x){
		return x.slice();
	}
	static isFunction(x){
        if(x === undefined){
            return false;
        }
		return x.constructor === Function;
	}
	static isNumber(x){
        if(x === undefined){
            return false;
        }
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
			console.error("ERROR! This object should have the property "+name+", but it was missing:");
            console.log(thing);
            console.trace();
		}
	}
	
	static clone(vec){
		return clone(vec);
	}


	static is1DNumericArray(vec){
        if(!Utils.isArray(vec)) return false;
        for(let i=0;i<vec.length;i++){
            if(!Utils.isNumber(vec[i])) return false;
        }
        return true;
	}

    static dist(vec1, vec2){
        let sum = 0;
        Utils.assert(Utils.is1DNumericArray(vec1));
        Utils.assert(Utils.is1DNumericArray(vec2));
        for(let i=0;i<vec1.length;i++){
            sum += (vec1[i]-vec2[i])*(vec1[i]-vec2[i])
        }
        return Math.sqrt(sum);
    }

}

export {Utils};
