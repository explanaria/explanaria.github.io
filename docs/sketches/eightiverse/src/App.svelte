<script>
	import Component2 from "./GridSquare.svelte"

    let gridSize = [5,5]
	
	let numbers = [];
	for(let i=0;i<gridSize[0];i++){ //might be gridSize[1] here
		let column = []
		for(let i=0;i<gridSize[1];i++){
			column.push([]);
		}
		numbers.push(column)
	}
	
	for(let i=0;i<5;i++){
		numbers[i][0] = [i+1];
		numbers[0][i] = [i+1];
	}
	
	//into the 2*3=6niverse
	numbers[2-1][3-1]=[8];

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

<h1>Spider-Math: Into the 2*3=8iverse</h1>

<p>Welcome to the 2*3=8niverse.</p>

<p>In our universe, multiplication only works in one way. 2*3 is always 6. But why 6 in particular? It's easy to write down other equations like 2+2=5 - they're just not true in the universe we normally work with.
</p>

<p>...but what about other universes? What if there was an 🌌alternate universe🌌 which followed all the same math rules, but where 2*3 was, say, 8 instead of 6? Will everything implode into a puff of contradictions? Or will it somehow stay internally consistent? Let's find out.</p>

<p>Below is an <b>alternate-universe multiplication table</b>, from an alternate universe where the rules of addition and multiplication work the same but 2*3 is 8 instead of 6. </p>

<p>In our universe, if you move sideways along a row of a multiplication table, you add the same number repeatedly. That's true because of the <u>distributive property</u> in our universe - so if the rules of this alternate universe are the same, we can still use the distributive property to move sideways across rows and up/down across columns.</p>

<p>Click the arrows to fill in the multiplication table, and you might find some interesting alternate-universe equations along the way.</p>

<style>
	.biggrid{
			display:grid;
			grid: repeat(5, 1fr)/repeat(5, 1fr);
		max-width: 500px;
	}
    p{
    line-height:1.3;
    max-width: 800;
    }
</style>

<div class="biggrid">
	{#each numbers as column, j}
			{#each column as values, i}
			<Component2 numbers={values} coords={[i+1,j+1]} buttonCallback={buttonClick} gridSize={gridSize}/>
			{/each}
	{/each}
</div>
