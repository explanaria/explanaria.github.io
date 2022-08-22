<script>
    import CrystalIntroPart from "./chapters/1-CrystalIntroPart.svelte";
    import HolesInCrystalPart from "./chapters/2-HolesInCrystalPart.svelte";
	import CayleyGraphChapter from "./chapters/3-CayleyGraphChapter.svelte";
	import PointGroupChapter from "./chapters/5-PointGroupChapter.svelte";
	import Ending from "./chapters/Ending.svelte";
    import {tick} from "svelte";

    import ChapterSelector from "./chapters/chapterselector.svelte";

    import * as EXP from "../../resources/build/explanaria-bundle.js";

    export let onlyThree = false;

    let currentChapter = 1; //one indexed
    window.currentChapter = currentChapter;
    let numChapters = 4+1;

    let mainContainer = null;
    async function changeChapter(chapterNum){
        chapterNum = ((chapterNum-1)%numChapters) + 1; //round to 1-numChapters
        window.chapterNum = chapterNum;

        mainContainer.style.opacity = 0; //fadeout done via CSS animation
        await EXP.delay(500);
        currentChapter = null;
        await EXP.delay(1); //AAARGH i need this to make sure one chapter unloads before the next loads
        await tick();
        currentChapter = chapterNum;
        mainContainer.style.opacity = 1;
    }

    function changeChapterEvent(event){
        changeChapter(event.detail)
        window.chapterNum = chapterNum;
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
        <br><br>
        <h1>(Please turn your phone sideways! This presentation is designed for landscape mode.)</h1>
    </div>
    <ChapterSelector on:changeChapter={changeChapterEvent} chapters={onlyThree ? [1,2,3,'F'] : [1,2,3,4,'F']} currentChapter={currentChapter} />
    {#if currentChapter == 1}
        <CrystalIntroPart on:chapterEnd={chapterEnd} />
    {/if}
    {#if currentChapter == 2}
        <HolesInCrystalPart on:chapterEnd={chapterEnd} alludeToChapter3={true}/>
    {/if}
    {#if currentChapter == 3}
        <CayleyGraphChapter on:chapterEnd={chapterEnd} endHere={onlyThree}/>
    {/if}
    {#if onlyThree}
        {#if currentChapter == 4}
            <Ending/>
        {/if}
    {:else}
        {#if currentChapter == 4}
            <PointGroupChapter on:chapterEnd={chapterEnd} />
        {/if}

        {#if currentChapter == 5}
            <Ending/>
        {/if}
    {/if}
</div>
