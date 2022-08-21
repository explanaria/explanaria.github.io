<script>
	import { onMount } from 'svelte';
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {GroupElement, LazyGroup} from "./groupmath.js";
    import GroupElementDisplay from "./GroupElementDisplay.svelte";
    import SVGCayleyArrows from "./SVGCayleyArrows.svelte";

    export let transform="scale(1)";

    function average(a,b){
        return EXP.Math.vectorScale(EXP.Math.vectorAdd(b, a), 0.5)
    }

    import CrystalElementCanvas from "./CrystalElementCanvas.svelte";

    import { chooseElementBorderColor } from "../colors.js";

    let a = new GroupElement("a", "(5)");
    let b = new GroupElement("b", "(6)");
    let c = new GroupElement("c", "(7)");
    let i = new GroupElement("i", "()");

    export let group = new LazyGroup([a,b,c,i], {
        "ac":"ca", "ab":"ba", 
        "ii":"e"
    });

    //placing them on a 2D grid

    export let positions = new Map();
    group.elements.forEach(element => {positions.set(element, [0,0])}) //fill this dict with one position per element

    //set positions of this two-element group
    let e = group.getElemByName("e");
    let startPos = [7, 7];
    positions.set(group.getElemByName("e"), startPos)

    //set positions of translations
    let aVec = [6,5];
    let bVec = [0,-6];
    let cVec = [-6,5];
    positions.set(group.getElemByName("a"), EXP.Math.vectorAdd(startPos, aVec))
    positions.set(group.getElemByName("b"), EXP.Math.vectorAdd(startPos, bVec))
    positions.set(group.getElemByName("c"), EXP.Math.vectorAdd(startPos, cVec))

    //translations grid
    for(let i=0;i<1;i++){
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

    let iDirection = [-3,2.5];
    //m and m2
    positions.set(group.getElemByName("i"), EXP.Math.vectorAdd(startPos, iDirection))


    //set positions for new elements
    group.elements.forEach(element => {if(!positions.get(element))positions.set(element, [0,0])}) //fill this dict with one position per element

    //svelte reactivity hack
    let _arrowVisibility = {};
    export let isArrowVisibleMap = {}; //elementTimesGenerators[startElem.name][generator_index] is true if the arrow starting from startElemn and corresponding to the ith generator should show an arrow
    group.elements.forEach(startElement => {
                _arrowVisibility[startElement.name] = group.generators.map(generator => false); //every generator starts false
                Object.defineProperty(isArrowVisibleMap, startElement.name, {
                    set(x){
                        _arrowVisibility[startElement.name] = x; _arrowVisibility = _arrowVisibility; _arrowVisibility[startElement.name] = _arrowVisibility[startElement.name];
                    },
                    get(){
                        return _arrowVisibility[startElement.name];
                    }
                })
            }
    )

    let _isElementVisible = group.elements.map(element => false);
    export let isElementVisible = _isElementVisible.slice();

    //reactivity hack
    for(let i=0;i<group.elements.length;i++){
        Object.defineProperty(isElementVisible, i, {
            set(x){
                _isElementVisible[i] = x; _isElementVisible = _isElementVisible;
            },
            get(){
                return _isElementVisible[i];
            }
        })
    }

    export let elementsWhoseNamesNotToShow = [];
    
</script>

<style>
    .groupdisplay{
        position: absolute;
        transition: 1s ease-in-out transform;
    }
</style>

<div class="groupdisplay" style={"transform: " + transform}>
    {#each group.elements as element, i}
        {#if _isElementVisible[i]}
            <GroupElementDisplay element={element} showElementName={elementsWhoseNamesNotToShow.indexOf(element.name) == -1}
            borderColor={chooseElementBorderColor(group, element)}
            top={positions.get(element)[1]} left={positions.get(element)[0]}
            smallFont={true}>
                <CrystalElementCanvas element={element}/>
            </GroupElementDisplay>
        {/if}
    {/each}

    <SVGCayleyArrows group={group} positionsPerElementMap={positions} isArrowVisibleMap={_arrowVisibility} elementAvoidRadius={1.5}/>
</div>
