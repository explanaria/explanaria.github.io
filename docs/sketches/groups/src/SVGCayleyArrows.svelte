<script>
    export let group = {elements: []};
    export let positionsPerElementMap;
    import {generatorcolors, drawGeneratorsWithOutlines, drawEyesOnArrows} from "./colors.js"
	import { onMount } from 'svelte';
    import SVGArrowLine from "./SVGArrowLine.svelte";

    let elementTimesGenerators = new Map(); //elementTimesGenerators[x] is [x*a, x*b] where a,b are the generators of the group
    $: {
        group.elements.forEach(startElement => 
            elementTimesGenerators.set(
                //construct an array with one element per generator, consisting of startElement multiplied by every generator
                //these will be the targets of arrows leaving startElement
                startElement, 
                group.generators.map(generator => group.multiply(startElement, generator))
            )
        )
    }



    // resize the svg with the arrows to match
    let width = 1000;
    let height = 300;
    function recalcPageSize(){
        width = window.innerWidth;
        height = window.innerHeight;
    }
    
    window.addEventListener("resize", recalcPageSize);
    onMount(recalcPageSize)

</script>

<style>

.arrowsvg{
    width: 100%;
    height: 100%;
    position:absolute;
    top:0;
    left:0;
    pointer-events: none;
    overflow: visible; /* important if there's a scrollbar */
}

</style>

<svg class="arrowsvg" xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 {width} {height}">
  <defs>
    {#each generatorcolors as color, i}
    <marker id={"arrowhead-"+i} markerWidth="4" markerHeight="4" 
    refX="0" refY="2" orient="auto"> <!-- from https://thenewcode.com/1068/Making-Arrows-in-SVG -->
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
            {#if drawGeneratorsWithOutlines}
                <line x1={positionsPerElementMap.get(startElement)[0]} y1={positionsPerElementMap.get(startElement)[1]} x2={positionsPerElementMap.get(targetElement)[0]} y2={positionsPerElementMap.get(targetElement)[1]} stroke=#000 
                  stroke-width="6" 
                  marker-end={"url(#arrowhead-"+i+")"} /> <!-- black outline -->
            {/if}
            <SVGArrowLine start={positionsPerElementMap.get(startElement)} end={positionsPerElementMap.get(targetElement)}
                stroke={generatorcolors[i]} markerEnd={"url(#arrowhead-"+i+")"}
                strokeWidth="5" />
        {/each}
    {/each}
</svg>
