function isArray(x){
	return x.constructor === Array;
}

function assert(thing){
	//A function to check if something is true and halt otherwise in a callbackable way.
	if(!thing){
		console.error("ERROR!");
	}
}

function assertType(thing, type){
	//A function to check if something is true and halt otherwise in a callbackable way.
	if(!thing.constructor === type){
		console.error("ERROR! Something not of type"+type);
	}
}


function assertPropExists(thing, name){
	if(!(name in thing)){
		console.error("ERROR! "+name+" not present in required property")
	}
}

