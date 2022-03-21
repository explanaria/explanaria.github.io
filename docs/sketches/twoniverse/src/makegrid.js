export function makeGrid(gridSize){
	for(let i=0;i<gridSize[0];i++){ //might be gridSize[1] here
		let column = []
		for(let i=0;i<gridSize[1];i++){
			column.push([]);
		}
		numbers.push(column)
	}
	
    //first row
	for(let i=0;i<gridSize[0];i++){
		numbers[i][0] = [i+1];
    }
    //first column
	for(let i=0;i<gridSize[1];i++){
		numbers[0][i] = [i+1];
	}
	
}
export function setMultiplicationEntry(numbers, a,b, product){
	numbers[a-1][b-1]=[product];
}
