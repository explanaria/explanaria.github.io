<script>
    export let group = {elements: []};
    export let positionsPerElementMap;
    import {generatorColors, drawGeneratorsWithOutlines, drawEyesOnArrows} from "../colors.js"
	import { onMount } from 'svelte';
    import SVGArrowLine from "./SVGArrowLine.svelte";

    let defaultShowArray = {}; //elementTimesGenerators[elem] is [true, true] where the ith position controls whether or not to show or hide an arrow for that start, generator combo
    group.elements.forEach(startElement => {
            defaultShowArray[startElement.name] = group.generators.map(generator => true) //show every arrow
    })

    export let isArrowVisibleMap = defaultShowArray;

    let elementTimesGenerators = new Map(); //elementTimesGenerators[x.name] is [x*a, x*b] where a,b are the generators of the group
    $: {
        group.elements.forEach(startElement => {
                //construct an array with one element per generator, consisting of startElement multiplied by every generator
                //these will be the targets of arrows leaving startElement
                elementTimesGenerators.set(
                    startElement, 
                    group.generators.map(generator => group.multiply(startElement, generator))
                )
            }
        )
    }



    // resize the svg with the arrows to match

    /*
    let width = 1000;
    let height = 300;
    function recalcPageSize(){
        width = window.innerWidth;
        height = window.innerHeight;
    }
    window.addEventListener("resize", recalcPageSize);
    onMount(recalcPageSize) */

    let width = 50;
    let height = 50; //The above code means that if this svg isn't positioned exactly at the top left of the screen, it creates scrollbars on the page. This small size means the svg won't create scrollbars, while overflow:visible ensures all the elements will still be there

</script>

<style>

.arrowsvg{
    position:absolute;
    top:0;
    left:0;
    pointer-events: none;
    overflow: visible; /* important if there's a scrollbar */
}

.arrowhead{
    z-index: 2;
}

</style>

<svg class="arrowsvg" xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 {width} {height}">
  <defs>
    {#each generatorColors as color, i}
    <marker class="arrowhead" id={"arrowhead-"+i} markerWidth="4" markerHeight="4" 
    refX="2" refY="2" orient="auto"> <!-- from https://thenewcode.com/1068/Making-Arrows-in-SVG -->
      <polygon points="0 0, 4 2, 0 4" fill={color}/>
      {#if drawEyesOnArrows}
          <ellipse rx="1" ry="0.6"
            cy="2.5" cx="1.5" fill="#fff" stroke="#000" stroke-width=0.1/>
          <ellipse rx="1" ry="0.6"
            cy="1.5" cx="1.5" fill="#fff" stroke="#000" stroke-width=0.1/>
          <ellipse rx="0.6" ry="0.35"
            cy="2.5" cx="1.85" fill="#000000"/>
          <ellipse rx="0.6" ry="0.35"
            cy="1.5" cx="1.85" fill="#000000"/>
      {/if}
    </marker>
    {/each}
    <filter id="outline" x="-100%" y="-100%" width="300%" height="300%">
      <!-- outline filter stolen from redblobgames, http://bl.ocks.org/redblobgames/c0da29c0539c8e7885664e774ffeae57 -->
      <feMorphology result="outline" in="SourceGraphic" operator="dilate" radius="1"></feMorphology>
      <feColorMatrix type="matrix" in="outline" result="black-outline" values="0 0 0 0 0  
                        0 0 0 0 0  
                        0 0 0 0 0  
                        0 0 0 1 0"></feColorMatrix>
      <feBlend in="SourceGraphic" in2="black-outline" mode="normal"></feBlend>
    </filter>
  </defs>


    {#each group.elements as startElement}
        {#each elementTimesGenerators.get(startElement) as targetElement, i}
            {#if isArrowVisibleMap[startElement.name][i]}
                {#if drawGeneratorsWithOutlines}
                    <SVGArrowLine start={positionsPerElementMap.get(startElement)} end={positionsPerElementMap.get(targetElement)}
                    stroke={generatorColors[i]} markerEnd={"url(#arrowhead-"+i+")"}
                    strokeWidth="0.25em" />
                {/if}
                <SVGArrowLine start={positionsPerElementMap.get(startElement)} end={positionsPerElementMap.get(targetElement)}
                    stroke={generatorColors[i]} markerEnd={"url(#arrowhead-"+i+")"}
                    strokeWidth="0.2em" />
            {/if}
        {/each}
    {/each}
</svg>
