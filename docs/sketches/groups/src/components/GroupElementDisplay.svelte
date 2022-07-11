<script>
    import { GroupElement } from "./groupmath.js";
	import { onMount } from 'svelte';

    import {defaultGroupElementBorderColor} from "../colors.js";

    export let top = 0;
    export let left = 0;

    export let element; //a GroupElement
    export let arrows = [];  

    export let borderColor=defaultGroupElementBorderColor;

</script>

<style>

    .elementcontainer{
        position: absolute; /*top and left set dynamically */
        display: grid;
        grid: 1fr / 1fr;
        justify-items: center;
        border: 2px solid var(--groupElementBorderColor); /* overwritten using borderColor variable by svelte */
        border-radius: 5px;
        max-width: 300px;
        transform: translate(-50%, -50%); /*so that the position set by position: absolute is in the center */
        /* margin: 1em; not with position:absolute*/

        background-color: white;
    }

</style>


<div class="elementcontainer"
style:top={top+"px"} style:left={left+"px"} style:--groupElementBorderColor={borderColor}>

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
