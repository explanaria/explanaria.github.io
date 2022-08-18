<script>
	import { onMount } from 'svelte';
    import {GroupElement, LazyGroup} from "./groupmath.js";
    import GroupElementDisplay from "./GroupElementDisplay.svelte";
    import SVGCayleyArrows from "./SVGCayleyArrows.svelte";

    import D6ElementCanvas from "./D6ElementCanvas.svelte";

    import { chooseElementBorderColor} from "../colors.js";

    let i = new GroupElement("i", "(12)");
    export let group = new LazyGroup([i], {"ii":"e"});

    export let isElementVisible = group.elements.map(element => true);

    let generators = ["i"];

    //placing them on a 2D grid

    export let positions = new Map();
    group.elements.forEach(element => {positions.set(element, [0,0])}) //fill this dict with one position per element

    //set positions of this two-element group
    positions.set(group.getElemByName("e"), [3,3])
    positions.set(group.getElemByName("i"), [8,8])


    let defaultArrowVisibility = {};
    group.elements.forEach(startElement => {
                defaultArrowVisibility[startElement.name] = group.generators.map(generator => false) //every generator starts false
            }
    )
    defaultArrowVisibility["e"] = [true];
    export let isArrowVisibleMap = defaultArrowVisibility; //elementTimesGenerators[startElem.name][generator_index] is true if the arrow starting from startElemn and corresponding to the ith generator should show an arrow
    
</script>

<style>
    .groupdisplay{
        position: absolute;
    }
</style>

<div class="groupdisplay">
    {#each group.elements as element, i}
        {#if isElementVisible[i]}
            <GroupElementDisplay element={element}
            borderColor={chooseElementBorderColor(group, element)}
            top={positions.get(element)[1]} left={positions.get(element)[0]}
            >
                <D6ElementCanvas element={element}/>
            </GroupElementDisplay>
        {/if}
    {/each}

    <SVGCayleyArrows group={group} positionsPerElementMap={positions} isArrowVisibleMap={isArrowVisibleMap}/>
</div>
