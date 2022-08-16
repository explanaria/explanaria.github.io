<script>
    import { GroupElement } from "./groupmath.js";
	import { onMount } from 'svelte';

    import {defaultGroupElementBorderColor} from "../colors.js";

    export let top = 0;
    export let left = 0;

    export let element; //a GroupElement

    export let borderColor=defaultGroupElementBorderColor;

    export let showElementName = true;
    export let smallFont = false;

</script>

<style>

    .elementcontainer{
        position: absolute; /*top and left set dynamically */
        display: grid;
        grid: 1fr / 1fr;
        justify-items: center;
        border: 2px solid var(--groupElementBorderColor); /* overwritten using borderColor variable by svelte */
        border-radius: 3em;
        max-width: 300px;
        transform: translate(-50%, -50%); /*so that the position set by position: absolute is in the center */
        /* margin: 1em; not with position:absolute*/

        background-color: white;
    }

    .elementname{
        font-size: 0.8em;
    }

</style>


<div class="elementcontainer fadeInImmediately"
style:top={top+"em"} style:left={left+"em"} style:--groupElementBorderColor={borderColor}>

        {#if showElementName}
            <div class="elementname" class:smallFont={smallFont}>{element.name}</div>
        {/if}
        <slot element={element}> <!-- for the canvas. but this doesn't seem to work?? weird-->
            <p>representation of the element goes here</p>
        </slot>
</div>
