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
function vectorSub(v1,v2){
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
let Math = {clone: clone, lerpVectors: lerpVectors, vectorAdd: vectorAdd, vectorSub: vectorSub, multiplyScalar: multiplyScalar, multiplyMatrix: multiplyMatrix};

export {vectorAdd, vectorSub, lerpVectors, clone, multiplyScalar, multiplyMatrix, Math};
