<script>
    import CrystalIntroPart from "./chapters/1-CrystalIntroPart.svelte";
    import HolesInCrystalPart from "./chapters/2-HolesInCrystalPart.svelte";
	import CayleyGraphChapter from "./chapters/3-CayleyGraphChapter.svelte";
	import PointGroupChapter from "./chapters/5-PointGroupChapter.svelte";
	import Ending from "./chapters/Ending.svelte";

    import ChapterSelector from "./chapters/chapterselector.svelte";

    import * as EXP from "../../resources/build/explanaria-bundle.js";

    export let onlyTwo = false;

    let currentChapter = 1; //one indexed
    let numChapters = 4;

    if(!onlyTwo)currentChapter = 5; //// DEBUG

    let mainContainer = null;
    async function changeChapter(chapterNum){
        console.log(chapterNum)
        chapterNum = ((chapterNum-1)%numChapters) + 1; //round to 1-numChapters
        window.chapterNum = chapterNum;

        mainContainer.style.opacity = 0; //fadeout done via CSS animation
        await EXP.delay(500);
        currentChapter = chapterNum;
        mainContainer.style.opacity = 1;
    }

    function changeChapterEvent(event){
        changeChapter(event.detail)
    }


    async function rotateChapter(){
        //todo: move to next chapter, not just loop for debug purposes
        let nextChapter = (currentChapter % numChapters) + 1;
        changeChapter(nextChapter)
    }
    async function chapterEnd(){
        rotateChapter();
    }
</script>





<!-- chapter selector -->

<div class="maincontainer" bind:this={mainContainer} style="opacity: 1">
    <div class="rotatesign">
        <h1>(Please turn your phone sideways! This presentation is designed for landscape mode.)</h1>
    </div>
    <ChapterSelector on:changeChapter={changeChapterEvent} chapters={onlyTwo ? [1,2,'F'] : [1,2,3,4,'F']} currentChapter={currentChapter} />
    {#if currentChapter == 1}
        <CrystalIntroPart on:chapterEnd={chapterEnd} />
    {/if}
    {#if currentChapter == 2}
        <HolesInCrystalPart on:chapterEnd={chapterEnd}/>
    {/if}
    {#if onlyTwo}
        {#if currentChapter == 3}
            <Ending/>
        {/if}
    {:else}
        {#if currentChapter == 3}
            <CayleyGraphChapter on:chapterEnd={chapterEnd} />
        {/if}
        {#if currentChapter == 4}
            <PointGroupChapter on:chapterEnd={chapterEnd} />
        {/if}
        {#if currentChapter == 5}
            <Ending/>
        {/if}
    {/if}
</div>
