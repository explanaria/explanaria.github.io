<script>
    import { GroupElement } from "./groupmath.js";
    import D6ElementCanvas from "./D6ElementCanvas.svelte";

    export let top = 0;
    export let left = 0;

    export let element = new GroupElement();
    export let arrows = [];   
</script>

<style>
    .elementcanvas{
        width: 150px;
        height: 150px;
    }

    .elementcontainer{
        display: grid;
        grid: 1fr / 1fr;
        justify-items: center;
        border: 1px solid gray;
        max-width: 300px;
    }

</style>


<div class="elementcontainer" style="paosition: absolute; top: {top}px; left: {left}px">

        {element.name}
        <D6ElementCanvas class="elementcanvas" element={element} />

        {#if false}
            
            <MainDisplay />
            <RotateButton />
            <FlipButton />
            {#each arrows as arrow}
                <Arrow onclick={arrow.handler()} />
            {/each}
        {/if}
</div>
