<script>
	import GridSquare from "./GridSquare.svelte"
    import Intro from "./Intro.svelte";
    import {makeGrid, setMultiplicationEntry} from "./makegrid.js";

    let gridSize = [5,5];

	let numbers = makeGrid(gridSize);
    setMultiplicationEntry(numbers, 2,3, 2) //2*3 = 2

    function buttonClick(sourceCoords, arrowDirection){
        //todo: check if sourceCoords[0] and sourceCoords[1] are in bounds
        let sourceX = sourceCoords[0];
        let sourceY = sourceCoords[1];
        let sourceNumbers = numbers[sourceY-1][sourceX-1];

        let targetX = sourceCoords[0] + arrowDirection[0];
        let targetY = sourceCoords[1] + arrowDirection[1];

        let targetNumbers = numbers[targetY-1][targetX-1];

        for(let number of sourceNumbers){
            //distributive law time!
            //if coords are (3,2) and we move in the (1,0) direction, we're adding 2.
            //if coords are (3,2) and we move in the (0,1) direction, we're adding 3. y is down
            number += sourceCoords[1] * arrowDirection[0]
            number += sourceCoords[0] * arrowDirection[1]

            console.log(number);
            if(!numbers[targetY-1][targetX-1].includes(number)){
                numbers[targetY-1][targetX-1].push(number);
            }
        }
        numbers[targetY-1][targetX-1] = numbers[targetY-1][targetX-1];
    }
	
</script>


<style>
	.biggrid{
			display:grid;
			grid: repeat(5, 1fr)/repeat(5, 1fr);
		max-width: 500px;
	}
</style>


<Intro />

<div class="biggrid">
	{#each numbers as column, j}
			{#each column as values, i}
			<gridSquare numbers={values} coords={[i+1,j+1]} buttonCallback={buttonClick} gridSize={gridSize}/>
			{/each}
	{/each}
</div>
