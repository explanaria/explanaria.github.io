<script>
	import InteractiveD6Creator from "./InteractiveD6Creator.svelte";
    import MoleculeCanvas from "./threeD/MoleculeCanvas.svelte";

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
        <MoleculeCanvas />
    {/if}
    {#if mode == 1}
        <InteractiveD6Creator />
    {/if}
</div>
