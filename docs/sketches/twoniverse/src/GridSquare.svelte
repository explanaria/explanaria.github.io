<script>
    import {introEmoji} from "./constants.js";
export let numbers = [];
export let coords = [0,0];
export let gridSize = [5,5];

export let spooky = false; //shows a spooky emoji to show you that this multiplication table is in an alternate universe

export let arrowsToShow = {"up": false, "down": false, "right": false, "left": false};

export let buttonCallback = (coords, directionVec) => {}; //overwrite
function setID(){
	numbers = [10,5];
}
let hasAValue =false;
$: hasAValue = numbers.length > 0
$: shouldShowArrows = true //hasAValue;

$: textID = coords.join("-"); //needed for the tooltips

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

    @keyframes rotate {
      from {transform: scale(2) rotate(0deg);}
      to {transform: scale(2) rotate(360deg);}
    }

    .spooky{
        font-size: 2em;
        opacity: 0.2;
        animation: rotate 30s linear infinite;
        pointer-events: none;
    }

</style>

<span>

    <span class="numbergrid" id={ textID }>


        {#if spooky}
        <span class="centerpart spooky">
				    {introEmoji}<br>{introEmoji}
	    </span>
        {/if}

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

	        {#if coords[0] > 1 && coords[1] > 1 && arrowsToShow.left}
	            <button on:click={buttonCallback(coords, [-1,0])} class="leftarrow">
	            &lt; -{coords[1]}
	            </button>
            {/if}

	        {#if coords[0] < gridSize[0] && coords[1] > 1 && arrowsToShow.right}
	            <button on:click={buttonCallback(coords, [1,0])} class="rightarrow">
	            &gt; +{coords[1]}
	            </button>
            {/if}


	        {#if coords[1] > 1 && coords[0] > 1 && arrowsToShow.up}
	            <button on:click={buttonCallback(coords, [0,-1])} class="uparrow">
	            ^ -{coords[0]}
	            </button>
            {/if}

	        {#if coords[1] < gridSize[1]  && coords[0] > 1 && arrowsToShow.down}
	            <button on:click={buttonCallback(coords, [0,1])} class="downarrow">
	            V +{coords[0]}
	            </button>
            {/if}
	    {/if}
    </span>
</span>
