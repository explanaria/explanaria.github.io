function multiplyScalar(c, array){
    //modifies input
	for(var i=0;i<array.length;i++){
		array[i] *= c;
	}
	return array
}
function length(array){

    let lengthSquared = 0;
	for(var i=0;i<array.length;i++){
		lengthSquared += array[i]*array[i];
	}
    return Math.sqrt(lengthSquared)
}
function normalize(array){

    let lengthSquared = 0;
	for(var i=0;i<array.length;i++){
		lengthSquared += array[i]*array[i];
	}
    let length = Math.sqrt(lengthSquared)
    let vec = clone(array);
	for(var i=0;i<array.length;i++){
		vec[i] /= length;
	}
	return vec
}
function vectorAdd(v1,v2){
    let vec = clone(v1);
	for(var i=0;i<v1.length;i++){
		vec[i] += v2[i];
	}
	return vec
}
function vectorSub(v1,v2){
    let vec = clone(v1);
	for(var i=0;i<v1.length;i++){
		vec[i] -= v2[i];
	}
	return vec
}
function vectorScale(v1,scalar){
    //unlike multiplyScalar, this clones the input, and the arguments are in a different order
    let vec = clone(v1);
	for(var i=0;i<v1.length;i++){
		vec[i] *= scalar;
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
let EXPMath = {clone: clone, lerpVectors: lerpVectors, vectorAdd: vectorAdd, vectorSub: vectorSub, vectorScale: vectorScale, multiplyScalar: multiplyScalar, multiplyMatrix: multiplyMatrix, normalize: normalize};

export {vectorAdd, vectorSub, lerpVectors, clone, multiplyScalar, multiplyMatrix, EXPMath as Math};
