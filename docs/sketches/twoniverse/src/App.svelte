<script>
	import GridSquare from "./GridSquare.svelte"
    import Intro from "./Intro.svelte";
    import ImplicationAnimationTooltip from "./ImplicationAnimationTooltip.svelte";

    let gridSize = [5,5];
    let startEquation = [3,2,2] //2*3 = 2

    let numbers = [];
	for(let i=0;i<gridSize[0];i++){ //might be gridSize[1] here
		let column = []
		for(let i=0;i<gridSize[1];i++){
			column.push([]);
		}
		numbers.push(column)
	}
	
    //fill in first row
	for(let i=0;i<gridSize[0];i++){
		numbers[i][0] = [i+1];
    }
    //fill in first column
	for(let i=0;i<gridSize[1];i++){
		numbers[0][i] = [i+1];
	}


    function addMultiplicationEntry(x,y, newProduct){
        if(!numbers[y-1][x-1].includes(newProduct)){
            numbers[y-1][x-1].push(newProduct);
        }
        notifySvelteOfChange(x,y);
    }
    function getMultiplicationEntry(x,y, product){
	    return numbers[y-1][x-1];
    }
    function notifySvelteOfChange(x,y){
        numbers[y-1][x-1]=numbers[y-1][x-1]
    }

    const arrowTemplate = {'up': [0,-1], "left": [-1,0], "down": [0,1], "right": [1,0]};
    //given a square [x,y], which arrows should we show?
    function computeArrowsToShow(numbers, x, y){
        let arrowVisibility = {};
        for(let arrowName in arrowTemplate){
            let arrowDirection = arrowTemplate[arrowName];
            let newNumbers = numbersWhichWouldBeCreated(numbers, [x,y], arrowDirection);
            arrowVisibility[arrowName] = newNumbers.length > 0; //show an arrow if we'd learn something from it
        }
        return arrowVisibility;
    }

    function numbersWhichWouldBeCreated(numbers, sourceCoords, arrowDirection){
        //assuming we're at x*y and want to click the arrow in [1,0] direction, return the NEW numbers we'd learn. not any which are already there

        let newNumbers = [];

        let sourceX = sourceCoords[0];
        let sourceY = sourceCoords[1];
        let sourceNumbers = numbers[sourceY-1][sourceX-1];

        let targetX = sourceCoords[0] + arrowDirection[0];
        let targetY = sourceCoords[1] + arrowDirection[1];

        if(targetX-1 < 0 || targetY-1 < 0 || targetY-1 >= numbers.length || targetX-1 >= numbers[targetY-1].length){
            //out of bounds
            return [];
        }

        let targetNumbers = numbers[targetY-1][targetX-1];

        for(let number of sourceNumbers){
            let newNumber = number;
            newNumber += sourceCoords[1] * arrowDirection[0] + sourceCoords[0] * arrowDirection[1]; //one of the two terms will always be zero so i might as well add them
            if(!numbers[targetY-1][targetX-1].includes(newNumber)){
                newNumbers.push(newNumber)
            }
        }
        if(newNumbers.length > 0)console.log(sourceX, sourceY, targetX, targetY, sourceNumbers, newNumbers)
        return newNumbers;
    }

    addMultiplicationEntry(...startEquation) //2*3 = 2

    let implicationAnimations = []; //these guys appear when you click a button, show an animation, then calls addMultiplicationEntry 

    function buttonClick(sourceCoords, arrowDirection){
        //todo: check if sourceCoords[0] and sourceCoords[1] are in bounds
        let sourceX = sourceCoords[0];
        let sourceY = sourceCoords[1];
        let sourceNumbers = numbers[sourceY-1][sourceX-1];

        let targetX = sourceCoords[0] + arrowDirection[0];
        let targetY = sourceCoords[1] + arrowDirection[1];

        let targetNumbers = numbers[targetY-1][targetX-1];

        for(let number of sourceNumbers){
            implicationAnimations.push([sourceCoords, arrowDirection, number]);
            implicationAnimations = implicationAnimations;
        }
    }
	
</script>


<style>
	.biggrid{
			display:grid;
			grid: repeat(5, 1fr)/repeat(5, 1fr);
		    max-width: 500px;
	}
</style>



<Intro startEquation={[2,3,2]}/>


<div class="position: relative">
    {#each implicationAnimations as tooltipData}
        <ImplicationAnimationTooltip sourceCoords={tooltipData[0]} arrowDirection={tooltipData[1]} sourceNumber={tooltipData[2]} addMultiplicationEntry={addMultiplicationEntry}/>
    {/each}
    <div class="biggrid">
	    {#each numbers as column, j}
			    {#each column as values, i}
			    <GridSquare numbers={values} coords={[i+1,j+1]} buttonCallback={buttonClick} gridSize={gridSize} arrowsToShow={computeArrowsToShow(numbers, i+1,j+1)}/>
			    {/each}
	    {/each}
    </div>
</div>
