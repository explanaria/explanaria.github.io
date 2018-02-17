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
