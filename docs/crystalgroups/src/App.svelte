<script>
	import CayleyGraphIntroPart from "./chapters/CayleyGraphIntroPart.svelte";
    import CrystalIntroPart from "./chapters/CrystalIntroPart.svelte";
    import HolesInCrystalPart from "./chapters/HolesInCrystalPart.svelte";
    import * as EXP from "../../resources/build/explanaria-bundle.js";

    let chapter = 0; //zero indexed
    let numChapters = 3;
    function rotateChapter(){
        //todo: move to next chapter, not just loop for debug purposes
        chapter = (chapter + 1) % numChapters;
    }

    let mainContainer = null;
    async function chapterEnd(){
        console.log(mainContainer.style)
        mainContainer.style.opacity = 0; //fadeout done via CSS animation
        await EXP.delay(500);
        rotateChapter();
        mainContainer.style.opacity = 1;
    }
</script>

<div class="rotatesign"> <!-- todo: put a message here --> </div>
<span style:position="absolute" style:bottom="2em" style:left="0em">Chapter {chapter}. <button on:click={chapterEnd} >Swap chapter</button></span>

<div class="maincontainer" bind:this={mainContainer} style="opacity: 1">
    {#if chapter == 0}
        <CrystalIntroPart on:chapterEnd={chapterEnd} />
    {/if}
    {#if chapter == 1}
        <HolesInCrystalPart on:chapterEnd={chapterEnd} />
    {/if}
    {#if chapter == 2}
        <CayleyGraphIntroPart on:chapterEnd={chapterEnd} />
    {/if}
</div>
