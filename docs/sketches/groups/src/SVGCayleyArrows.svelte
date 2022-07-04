<script>
    export let group;
    export let startElement; //a GroupElement;
    export let positionsPerElementMap;
    import {generatorcolors} from "./colors.js"

    $: elementTimesGenerators = group.generators.map(generator => group.multiply(startElement, generator));

</script>

{#each elementTimesGenerators as targetElement, i}
<line x1={positionsPerElementMap.get(startElement)[0]} y1={positionsPerElementMap.get(startElement)[1]} x2={positionsPerElementMap.get(targetElement)[0]} y2={positionsPerElementMap.get(targetElement)[1]} stroke={generatorcolors[i]} 
      stroke-width="3" 
      marker-end={"url(#arrowhead-"+i+")"} /> <!--arrowhead-0, arrowhead-1 defined in D6group.svelte, carefully so the colors match up >
<!-- 
<path class="arrow" d="M {positionsPerElementMap.get(startElement)[0]} {positionsPerElementMap.get(startElement)[1]} C {} {} {} {} {} {} {} " marker-end="url(#arrowhead)"/> -->
{/each}
