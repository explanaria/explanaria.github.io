<script>
    //units of this SVG are in em

    import EXP from "../../../resources/build/explanaria-bundle.js";

    export let group = {elements: []};
    export let positionsPerElementMap;
    import {generatorColors, drawGeneratorsWithOutlines, drawEyesOnArrows, specialGeneratorColors} from "../colors.js";
	import { onMount } from 'svelte';
    import SVGArrowLine from "./SVGArrowLine.svelte";

    export let elementAvoidRadius = 2.4;

    let thisSVGName = Math.random();

    function chooseGeneratorColor(group, i){
        let generator = group.generators[i];
        if(specialGeneratorColors[generator.name]){
            return specialGeneratorColors[generator.name];
        }
        return generatorColors[i]
    }

    function chooseEyeColor(group, i){
        let color = chooseGeneratorColor(group, i);
        let threeColor = new EXP.THREE.Color(color);
        threeColor.offsetHSL(0,0,-0.2); //slightly darken
        
        return "#" + threeColor.getHexString();
    }

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
    z-index: 1;
}

</style>

<svg class="arrowsvg" xmlns="http://www.w3.org/2000/svg" width={"1em"} height={"1em"} viewBox="0 0 {1} {1}">
    <!-- this sets the units of the SVG to be in em -->
  <defs>

    {#each group.generators as _, i}
    <marker class="arrowhead" id={"arrowhead-"+thisSVGName+i} markerWidth="4" markerHeight="4" 
    refX="2" refY="2" orient="auto"> <!-- from https://thenewcode.com/1068/Making-Arrows-in-SVG -->
      <polygon points="0 0, 4 2, 0 4" fill={chooseGeneratorColor(group, i)}/>
      {#if drawEyesOnArrows}
          <ellipse rx="1" ry="0.6"
            cy="2.5" cx="1.5" fill="#fff" stroke={chooseEyeColor(group, i)} stroke-width=0.1/>
          <ellipse rx="1" ry="0.6"
            cy="1.5" cx="1.5" fill="#fff" stroke={chooseEyeColor(group, i)} stroke-width=0.1/>
          <ellipse rx="0.6" ry="0.35"
            cy="2.5" cx="1.85" fill={chooseEyeColor(group, i)}/>
          <ellipse rx="0.6" ry="0.35"
            cy="1.5" cx="1.85" fill={chooseEyeColor(group, i)}/>
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
        {#if elementTimesGenerators.get(startElement)}
            {#each elementTimesGenerators.get(startElement) as targetElement, i}
                {#if isArrowVisibleMap[startElement.name] && isArrowVisibleMap[startElement.name][i]}
                    {#if drawGeneratorsWithOutlines}
                        <SVGArrowLine start={positionsPerElementMap.get(startElement)} end={positionsPerElementMap.get(targetElement)}
                        stroke={chooseGeneratorColor(group, i)} markerEnd={"url(#arrowhead-"+thisSVGName+i+")"}
                        strokeWidth="0.25"/>
                    {/if}
                    <SVGArrowLine start={positionsPerElementMap.get(startElement)} end={positionsPerElementMap.get(targetElement)}
                        stroke={chooseGeneratorColor(group, i)}
                         markerEnd={"url(#arrowhead-"+thisSVGName+i +")"}
                        strokeWidth="0.2" elementAvoidRadius={elementAvoidRadius}}/>
                {/if}
            {/each}
        {/if}
    {/each}
</svg>
