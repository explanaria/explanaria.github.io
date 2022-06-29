<script>
    import { GroupElement } from "./groupmath.js";
	import { onMount } from 'svelte';

    import {groupElementBorderColor} from "./colors.js";

    export let top = 0;
    export let left = 0;

    export let element; //a GroupElement
    export let arrows = [];  

    //control colors via js
    let containerElem;
    onMount( () => {containerElem.style.setProperty('--groupElementBorderColor', groupElementBorderColor);});
</script>

<style>

    .elementcontainer{
        display: grid;
        grid: 1fr / 1fr;
        justify-items: center;
        --groupElementBorderColor: #333;
        border: 2px solid var(--groupElementBorderColor);
        border-radius: 5px;
        max-width: 300px;
        margin: 1em;
    }

</style>


<div class="elementcontainer" bind:this={containerElem} style="position: absolute; top: {top}px; left: {left}px">

        {element.name}
        <slot element={element}> <!-- for the canvas. but this doesn't seem to work?? weird-->
            <p>representation of the element goes here</p>
        </slot>

        {#if false}
            
            <MainDisplay />
            <RotateButton />
            <FlipButton />
            {#each arrows as arrow}
                <Arrow onclick={arrow.handler()} />
            {/each}
        {/if}
</div>
