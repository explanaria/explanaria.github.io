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

export {vectorAdd, lerpVectors, clone, multiplyScalar};
