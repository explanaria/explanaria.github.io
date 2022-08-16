<script>
    export let currentChapter = 1;
    export let chapters = [1,2,3,4,"F"];

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

</script>

<style>
    .chapterselector{
        position: absolute;
        margin: auto 0;

        display: grid;
        z-index: 3;

        bottom: 1vh;
        bottom: 1svh;
        left:50%;
        grid-auto-flow: column;
        gap: 0.2em;
        transform: translateX(-50%);
    }
    .chapterbutton{
        border-radius: 20em;
        width: 1.5em;
        height: 1em;
        text-align: center;
        border: 1.5px solid #2e2e38;
        background-color: white;
        padding-top: 0.25em;
        padding-bottom: 0.25em;
    }
    .chapterbutton:hover{
        background-color: hsla(240, 70%, 70%, 1);
        color: white;
    }
    .selected{
        background-color: hsla(240, 90%, 70%, 1);
        color: white;
    }
</style>

<div class="chapterselector">
    {#each chapters as chapterName, zeroIndexedChapterNum}
        <div class="chapterbutton" on:click={() => dispatch("changeChapter", zeroIndexedChapterNum+1)} class:selected="{currentChapter == zeroIndexedChapterNum+1}">
            <!--{chapterName} -->
        </div>
    {/each}
</div>
