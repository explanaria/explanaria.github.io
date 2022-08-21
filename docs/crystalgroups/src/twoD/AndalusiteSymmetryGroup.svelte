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

    let m = new GroupElement("m", "(12)");
    let m2 = new GroupElement("m2", "(12)");
    let a = new GroupElement("a", "(5)");
    let b = new GroupElement("b", "(6)");
    let c = new GroupElement("c", "(7)");
    let cinvs = new GroupElement("c⁻¹", "(7)");

    let g = new GroupElement("g", "(9)"); //glide reflection in -y plane reflect, ca translate. stands for 0.5+x,0.5-y.0.5+z

    let r = new GroupElement("r", "(1)"); //xy plane rotation: [-x,-y,z]

    export let group = new LazyGroup([a,b,c, cinvs, m, m2, g, r], { "rr":"e", "mm2":"c", "m2m2":'e', "m2m":"c⁻¹", "mm":"e", 
        "ac":"ca", "ab":"ba", "bc":"cb", 
        "gg": 'ac',
        "mr":"rm",

        "rgrg":"ca",

        "mgc": "gm", //implemented

        "rgmc": "rmg",
        "grab": "rg",
        "mgrab": "rmg",

        "mc":"m2", //early in presentation but must be late in rules because rgmc -> rmg
       
         /*
        "gaga":"a", "gbgb":"b",

        "gmc": "mg", */

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
    positions.set(group.getElemByName("c⁻¹"), EXP.Math.vectorAdd(startPos, EXP.Math.vectorScale(cVec, -1)));

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

    //move ac slightly out of the way
    let bcDirection = EXP.Math.vectorScale(average(cVec, bVec), 2.4);
    positions.set(group.getElemByName("cb"), EXP.Math.vectorAdd(
        bcDirection, 
    startPos))

    let mDirection = [-8,2];
    //m and m2
    positions.set(group.getElemByName("m"), EXP.Math.vectorAdd(startPos, mDirection))
    positions.set(group.getElemByName("m2"), EXP.Math.vectorAdd(startPos, EXP.Math.vectorScale(mDirection, -0.8)))

    let gDirection = EXP.Math.vectorAdd([0,-0.5], average(aVec, cVec))
    positions.set(group.getElemByName("g"), EXP.Math.vectorAdd(
        gDirection, 
    startPos))

    let rDirection = [-4.5,-5];
    positions.set(group.getElemByName(r.name), EXP.Math.vectorAdd(
        rDirection, 
    startPos))

    group.multiply(r, m);
    positions.set(group.getElemByName("rm"), EXP.Math.vectorAdd(
        EXP.Math.vectorAdd(rDirection, mDirection), 
    startPos))

    
    for(let x of [r, m, e, group.getElemByName("rm")]){
        let newElement = group.multiply(x, g);
        positions.set(newElement, EXP.Math.vectorAdd(positions.get(x), gDirection))
    }


    //where m doesn't quite commute: g -> mg, rg -> rmg
    let mDoesntCommuteDirection1 = EXP.Math.vectorAdd(EXP.Math.vectorScale(mDirection, 0.5), EXP.Math.vectorScale(gDirection, -0.4));

    group.multiply(g, m);
    positions.set(group.getElemByName("gm"), EXP.Math.vectorAdd(
        mDoesntCommuteDirection1,
    positions.get(group.getElemByName("g"))))

    let mDoesntCommuteDirection2 = EXP.Math.vectorAdd(EXP.Math.vectorScale(mDirection, 0.5), EXP.Math.vectorScale(gDirection, -0.4));
    mDoesntCommuteDirection2 = mDoesntCommuteDirection1;

    let rgPos = positions.get(group.getElemByName("rg"));
    group.multiply(group.multiply(r, g), m);
    positions.set(group.getElemByName("rgm"), EXP.Math.vectorAdd(
        mDoesntCommuteDirection2,
    rgPos))


    let rDoesntCommuteDirection1 = [3, -3];
    let rDoesntCommuteDirection2 = EXP.Math.vectorAdd(EXP.Math.vectorAdd(EXP.Math.vectorScale(mDirection, 0.3), EXP.Math.vectorScale(rDirection, 0.3)), EXP.Math.vectorScale(gDirection, -0.2));

    //g - gr - rg
    group.multiply(g, r);
    positions.set(group.getElemByName("gr"), EXP.Math.vectorAdd(
        rDoesntCommuteDirection1,
    positions.get(group.getElemByName("g"))))

    //mg - mgr - rmg
    group.multiply(group.multiply(m, g), r);
    positions.set(group.getElemByName("mgr"), EXP.Math.vectorAdd(
        rDoesntCommuteDirection2,
    positions.get(group.getElemByName("mg"))))
    
    /*
    let g1g2Pos = EXP.Math.vectorAdd(XYglideRotationPosition, EXP.Math.vectorScale(aVec, -0.5));



    positions.set(group.getElemByName("g2g1"), EXP.Math.vectorAdd(
        g2g1Pos,
    startPos));

    //mg1 and mg2
    group.multiply(m, g2);
    group.multiply(m, g1);
    positions.set(group.getElemByName("mg1"), EXP.Math.vectorAdd(
        EXP.Math.vectorScale(aVec, 0.5), 
    startPos))
    positions.set(group.getElemByName("mg2"), EXP.Math.vectorAdd(
        EXP.Math.vectorScale(bVec, 0.5), 
    startPos))

    */



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

    export let elementsWhoseNamesNotToShow = ["b","a","ca","cb", "ba"];
    
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
