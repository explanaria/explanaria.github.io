<script>
	import { onMount } from 'svelte';
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {GroupElement, LazyGroup} from "./groupmath.js";
    import GroupElementDisplay from "./GroupElementDisplay.svelte";
    import SVGCayleyArrows from "./SVGCayleyArrows.svelte";

    import CrystalElementCanvas from "./CrystalElementCanvas.svelte";

    import { chooseElementBorderColor } from "../colors.js";

    let i = new GroupElement("i", "(12)");
    let a = new GroupElement("a", "(5)");
    let b = new GroupElement("b", "(6)");
    let c = new GroupElement("c", "(7)");
    let ca = new GroupElement("ca", "(9)");

    let ga = new GroupElement("ga", "(9)"); //glide reflection in a
    let gb = new GroupElement("gb", "(1)"); //glide reflection in b
    export let group = new LazyGroup([a,b,c, ca, i], {"ii":"e", "ac":"ca", "ab":"ba", "gaga":"a", "gbgb":"b"});

    let generators = ["i"];

    //placing them on a 2D grid

    export let positions = new Map();
    group.elements.forEach(element => {positions.set(element, [0,0])}) //fill this dict with one position per element

    //set positions of this two-element group
    let e = group.getElemByName("e");
    let startPos = [4, 8];
    positions.set(group.getElemByName("e"), startPos)

    //set positions of translations
    let aVec = [5,0];
    let bVec = [0,-5];
    let cVec = [-3,3];
    positions.set(group.getElemByName("a"), EXP.Math.vectorAdd(startPos, aVec))
    positions.set(group.getElemByName("b"), EXP.Math.vectorAdd(startPos, bVec))
    positions.set(group.getElemByName("c"), EXP.Math.vectorAdd(startPos, cVec))

    //translations grid
    for(let i=0;i<3;i++){
        let els = group.elements.slice();
        for(let x of els){
            let newElement = group.multiply(x, a);
            positions.set(newElement, EXP.Math.vectorAdd(positions.get(x), aVec))
        }
        for(let x of els){
            let newElement = group.multiply(x, b);
            positions.set(newElement, EXP.Math.vectorAdd(positions.get(x), bVec))
        }
        for(let x of els){
            let newElement = group.multiply(x, c);
            positions.set(newElement, EXP.Math.vectorAdd(positions.get(x), cVec))
        }
    }

    let caca = group.multiply(ca, ca);
    positions.set(caca, EXP.Math.vectorAdd(positions.get(ca), EXP.Math.vectorAdd(aVec,cVec)))

    positions.set(group.getElemByName("i"), [8,8])

    //set positions for new elements
    group.elements.forEach(element => {if(!positions.get(element))positions.set(element, [0,0])}) //fill this dict with one position per element

    let defaultArrowVisibility = {};
    group.elements.forEach(startElement => {
                defaultArrowVisibility[startElement.name] = group.generators.map(generator => false) //every generator starts false
            }
    )

    export let isArrowVisibleMap = defaultArrowVisibility; //elementTimesGenerators[startElem.name][generator_index] is true if the arrow starting from startElemn and corresponding to the ith generator should show an arrow

    export let isElementVisible = group.elements.map(element => false);
    
</script>

<style>
    .groupdisplay{
        position: absolute;
    }
</style>

<div class="groupdisplay">
    {#each group.elements as element, i}
        {#if isElementVisible[i]}
            <GroupElementDisplay element={element} showElementName={false}
            borderColor={chooseElementBorderColor(group, element)}
            top={positions.get(element)[1]} left={positions.get(element)[0]}
            >
                <CrystalElementCanvas element={element}/>
            </GroupElementDisplay>
        {/if}
    {/each}

    <SVGCayleyArrows group={group} positionsPerElementMap={positions} isArrowVisibleMap={isArrowVisibleMap} elementAvoidRadius={1.25}/>
</div>
