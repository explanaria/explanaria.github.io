<script>
	import { onMount } from 'svelte';
    import {GroupElement, Group} from "./groupmath.js";
    import GroupElementDisplay from "./GroupElementDisplay.svelte";
    import SVGCayleyArrows from "./SVGCayleyArrows.svelte";

    let r = new GroupElement("r", "(123)");
    let f = new GroupElement("f", "(23)");
    let d6group = new Group([r,f], {"rfr":"f", "rrr":"", "ff":""});
    console.log(d6group);

    import D6ElementCanvas from "./D6ElementCanvas.svelte";

    export let elements = [];
    export let visibleElements = [];

    let generators = ["r", "f"];

    //placing them on a 2D grid

    let positions = new Map();
    d6group.elements.forEach(element => {positions.set(element, [0,0])}) //fill this dict with one position per element


    let startPos = [300,350];
    let outerRadius = 250;
    let innerRadius = 100;
    let rotationRadians = 120 * Math.PI / 180;
    let startRadians = -Math.PI/2; //start upwards

    let currentElem = d6group.getElemByName("e");
    for(let i=0;i<3;i++){
        //place rotation elements on the outside of the circle.
        let position = [startPos[0] + outerRadius * Math.cos(rotationRadians * i + startRadians), 
                        startPos[1] + outerRadius * Math.sin(rotationRadians * i + startRadians)];
        positions.set(currentElem, position)

        //place flip elements on the inside of the circle
        let flipElem = d6group.multiply(currentElem, d6group.getElemByName("f"));
        let flipPosition = [startPos[0] + innerRadius * Math.cos(rotationRadians * i + startRadians), 
                           startPos[1] + innerRadius * Math.sin(rotationRadians * i + startRadians)];
        positions.set(flipElem, flipPosition)

        //move to next element
        currentElem = d6group.multiply(currentElem, d6group.getElemByName("r"));
        console.log(currentElem);
    }

    console.log(positions);
    
</script>

<style>
/*
.groupdisplay{
    display: grid;
    grid: 1fr / 1fr;
}
.ontop{
    grid-column-start: 1;
  grid-row-start: 1;
}*/
</style>

<div class="groupdisplay">
    {#each d6group.elements as element}
        <GroupElementDisplay element={element} top={positions.get(element)[1]} left={positions.get(element)[0]}>
            <D6ElementCanvas element={element}/>
        </GroupElementDisplay>
    {/each}

    <SVGCayleyArrows group={d6group} positionsPerElementMap={positions}/>
</div>
