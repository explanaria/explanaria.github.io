<script>
export let numbers = [];
export let coords = [0,0];
export let gridSize = [5,5]

export let buttonCallback = (coords, directionVec) => {}; //overwrite
function setID(){
	numbers = [10,5];
}
let hasAValue =false;
$: hasAValue = numbers.length > 0
$: shouldShowArrows = hasAValue;

/*$: if( coords[0] == 1  || coords[1] == 1){ 
		shouldShowArrows = false;
}*/
	
</script>

<style>
	.numbergrid{
        display:grid;
        grid: 0.2fr 1fr 0.2fr / 0.2fr 1fr 0.2fr;
        margin:0.5em;
        border: 1px solid black;
	}
	.centerpart{
		grid-column-start: 2;
		grid-row-start: 2;
		text-align: center;
		font-size: 2em;

        min-width: 2em;
        min-height:2em;
	}
    .multiplenums{
		font-size: 60%;
    }
	.leftarrow{
		grid-column-start: 1;
		grid-row-start: 2;
	}
	.rightarrow{
		grid-column-start: 3;
		grid-row-start: 2;
	}
	.uparrow{
		grid-column-start: 2;
		grid-row-start: 1;
	}
	.downarrow{
		grid-column-start: 2;
		grid-row-start: 3;
	}

    .tooltip{

		grid-column: 1 / 4;
        grid-row-start: 1;
        position: relative;
        background-color: red;
        transform: translate(0px, -2em);
        font-size: 1.3em;
    }
</style>

<span>

    <span class="numbergrid">
        <span class="tooltip">{coords[0]} * {coords[1]} = {numbers[0]} </span>

	    <span class="centerpart">
	      {#if hasAValue}
			    {#if numbers.length == 1}
				    {numbers}
			    {:else}
				    <span class="multiplenums">{numbers.join(" = ")}</span>
			    {/if}
		    
		    {:else}
			    {"-"}
		    {/if}
	    </span>
	    {#if shouldShowArrows}

	        {#if coords[0] > 1 && coords[1] > 1}
	            <button on:click={buttonCallback(coords, [-1,0])} class="leftarrow">
	            &lt; -{coords[1]}
	            </button>
            {/if}

	        {#if coords[0] < gridSize[0] && coords[1] > 1}
	            <button on:click={buttonCallback(coords, [1,0])} class="rightarrow">
	            &gt; +{coords[1]}
	            </button>
            {/if}


	        {#if coords[1] > 1 && coords[0] > 1}
	            <button on:click={buttonCallback(coords, [0,-1])} class="uparrow">
	            ^ -{coords[0]}
	            </button>
            {/if}

	        {#if coords[1] < gridSize[1]  && coords[0] > 1}
	            <button on:click={buttonCallback(coords, [0,1])} class="downarrow">
	            V +{coords[0]}
	            </button>
            {/if}
	    {/if}
    </span>
</span>
