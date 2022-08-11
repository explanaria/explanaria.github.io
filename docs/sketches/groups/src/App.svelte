<script>
	import CayleyGraphIntroPart from "./chapters/CayleyGraphIntroPart.svelte";
    import CrystalIntroPart from "./chapters/CrystalIntroPart.svelte";
    import HolesInCrystalPart from "./chapters/HolesInCrystalPart.svelte";

    let chapter = 1; //zero indexed
    let numChapters = 3;
    function swapmode(){
        chapter = (chapter + 1) % numChapters;
    }
</script>

<div class="maincontainer">
    <div class="rotatesign"> <!-- todo: put a message here --> </div>
    <span style:position="absolute" style:bottom="2em" style:left="0em">Chapter {chapter}. <button on:click={swapmode} >Swap chapter</button></span>
    {#if chapter == 0}
        <CrystalIntroPart />
    {/if}
    {#if chapter == 1}
        <HolesInCrystalPart />
    {/if}
    {#if chapter == 2}
        <CayleyGraphIntroPart />
    {/if}
</div>
