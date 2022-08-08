<script>
	import InteractiveD6Creator from "./InteractiveD6Creator.svelte";
	import CayleyGraphIntroPart from "./CayleyGraphIntroPart.svelte";
    import CrystalIntroPart from "./CrystalIntroPart.svelte";

    let mode = 1;
    let numModes = 2;
    function swapmode(){
        mode = (mode + 1) % numModes;
    }
</script>

<div class="maincontainer">
    <div class="rotatesign"> <!-- todo: put a message here --> </div>
    <span style:position="absolute" style:bottom="2em" style:left="0em">Chapter {mode}. <button on:click={swapmode} >Swap chapter</button></span>
    {#if mode == 0}
        <CrystalIntroPart />
    {/if}
    {#if mode == 1}
        <CayleyGraphIntroPart />
    {/if}
</div>
