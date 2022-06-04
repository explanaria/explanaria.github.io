<script>
    export let sourceCoords = [0,0]; //x,y of start cell
    export let arrowDirection = [1,0]; //[0,1], [-1, 0]. the direction of the arrow that was clicked

    export let sourceNumber = 0;

    export let addMultiplicationEntry = (x,y,newProduct) => null; //callback provided from outside

    let destinationCoords = sourceCoords.map((coord, i) => {
        console.log(coord, i, arrowDirection[i])
        return coord + arrowDirection[i]
    }); //x,y of final cell
    console.log(destinationCoords)


    //distributive law time!
    //if coords are (3,2) and we move in the (1,0) direction, we're adding 2.
    //if coords are (3,2) and we move in the (0,1) direction, we're adding 3. +y is down
    let thingBeingAddedToBothSides = sourceCoords[1] * arrowDirection[0] + sourceCoords[0] * arrowDirection[1];
    $: addSign = Math.sign(thingBeingAddedToBothSides) == 1 ? "+" : ""; //the negative sign will appear when we print thingBeingAddedToBothSides
    let destinationNumber = sourceNumber + thingBeingAddedToBothSides;

    //html DOM IDs of GridSquare elements to appear over
    let sourceID = sourceCoords.join("-");
    let destinationID = destinationCoords.join("-");

    //appear/disappear/motion animation
    import { crossfade } from "svelte/transition";
    const [send, receive] = crossfade({
        duration: d => Math.sqrt(d * 1000),
        fallback(node, params) {
	        const style = getComputedStyle(node);
	        const transform = style.transform === 'none' ? '' : style.transform;

	        return {
		        duration: 500,
		        css: t => `
			        transform: ${transform} scale(${t});
			        opacity: ${t}
		        `
	        };
        }
    }); 


    let appearAboveThisID = sourceID;

    /*
    $: targetRect = document.getElementById(appearAboveThisID).getBoundingClientRect();
    $: targetLeft = targetRect.left + targetRect.width/2;
    $: targetTop = targetRect.top // + targetRect.height/2;*/


    $: targetRect = document.getElementById(appearAboveThisID)
    $: targetLeft = targetRect.offsetLeft + targetRect.offsetWidth/2;
    $: targetTop = targetRect.offsetTop // + targetRect.height/2;

    let phase = 1;
    //phase 1: over the source
    window.setTimeout(toPhase2, 800);

    //phase 2: +3 markers appear on both sides
    function toPhase2(){
        phase = 2;
        window.setTimeout(toPhase3, 1000);
    }

    //phase 3: add to both sides
    function toPhase3(){
        phase = 3;
        window.setTimeout(toPhase4, 1000);
    }

    //phase 4: move over target
    function toPhase4(){
        appearAboveThisID = destinationID;
        phase = 4;
        window.setTimeout(toPhase5, 500);
        addMultiplicationEntry(destinationCoords[0], destinationCoords[1], destinationNumber)
    }

    //fade out.
    //todo: remove from outer array
    function toPhase5(){
        phase = 5;
    }
	

</script>

<style>
    .tooltip{
        position: absolute;
        background-color: white;
        border-radius: 5px;
        border: 2px solid gray;
        font-size: 1.3em;
        transform: translate(-50%, -50%);
        padding: 0.2em;
    }
    .tooltipgrid{
        display: grid;
        grid: 1fr / 1fr 2fr 1fr 2fr 2fr;
        margin: none;
        text-align: center;
    }
    .column{
        display: grid;
        grid: 1fr 1fr / 100%;
        margin: 0px;
    }

</style>

{#if phase == 1}
<div class="tooltip" style="left: {targetLeft}px; top: {targetTop}px" in:receive={{ key: sourceID + '-' + destinationID }} out:send={{ key: sourceID + '-' + destinationID }}>
    <div class="tooltipgrid">
        <div>{sourceCoords[0]}</div>
        <div>*</div>
        <div>{sourceCoords[1]}</div>
        <div> = </div>
        <div>{sourceNumber}</div>
     </div>
</div>
{/if}

{#if phase == 2}
<div class="tooltip" style="left: {targetLeft}px; top: {targetTop}px" in:receive={{ key: sourceID + '-' + destinationID }} out:send={{ key: sourceID + '-' + destinationID }}>
    <div class="tooltipgrid">
        <div>{sourceCoords[0]}</div>
        <div class="column">
        <div>*</div>
            <div>{addSign}{thingBeingAddedToBothSides}</div>
        </div>
        <div>{sourceCoords[1]}</div>
        <div> = </div>
        <div class="column">
            <div>{sourceNumber}</div>
            <div>{addSign}{thingBeingAddedToBothSides}</div>
        </div>
     </div>
</div>
{/if}

{#if phase == 3}
<div class="tooltip" style="left: {targetLeft}px; top: {targetTop}px" in:receive={{ key: sourceID + '-' + destinationID }} out:send={{ key: sourceID + '-' + destinationID }}>
    <div class="tooltipgrid">
        <div>{destinationCoords[0]}</div>
        <div>*</div>
        <div>{destinationCoords[1]}</div>
        <div> = </div>
        <div>{destinationNumber}</div>
     </div>
</div>
{/if}

{#if phase == 4}
<div class="tooltip" style="left: {targetLeft}px; top: {targetTop}px" in:receive={{ key: sourceID + '-' + destinationID }} out:send={{ key: sourceID + '-' + destinationID }}>
    <div class="tooltipgrid">
        <div>{destinationCoords[0]}</div>
        <div>*</div>
        <div>{destinationCoords[1]}</div>
        <div>=</div>
        <div>{destinationNumber}</div>
     </div>
</div>
{/if}
