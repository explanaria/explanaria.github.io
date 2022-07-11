<script>
    import D6Group from "./components/D6Group.svelte";
    import { GroupElement, Group } from "./components/groupmath.js";
    import {generatorColors} from "./colors.js";

    let r = new GroupElement("r", "(123)");
    let f = new GroupElement("f", "(23)");
    let d6group = new Group([r,f], {"rfr":"f", "rrr":"", "ff":""});

    export let isArrowVisibleMap = {}; //elementTimesGenerators[elem] is [true, true] where the ith position controls whether or not to show or hide an arrow for that start, generator combo
    d6group.elements.forEach(startElement => {
                isArrowVisibleMap[startElement.name] = d6group.generators.map(generator => false) //every generator starts false
            }
    )
    isArrowVisibleMap["e"] = [true, true];
    

    let data = {
        d6group: d6group,
        isElementVisible: d6group.elements.map(element => (d6group.isGenerator(element) || element.name == "e")), //only generators and e visible to start
        isArrowVisibleMap: isArrowVisibleMap
    }

    let prevOrientation = d6group.getElemByName("e");
    let currentOrientation = d6group.getElemByName("e");

    function onRotate(){
        prevOrientation = currentOrientation;
        currentOrientation = d6group.multiply(currentOrientation, d6group.generators[0])
        data.isArrowVisibleMap[prevOrientation.name][0] = true;
        showNewGroupElements()
    }
    function onFlip(){
        prevOrientation = currentOrientation;
        currentOrientation = d6group.multiply(currentOrientation, d6group.generators[1])
        data.isArrowVisibleMap[prevOrientation.name][1] = true;
        showNewGroupElements()
    }
    function showNewGroupElements(){
        //moveTriangleToNewOrientation();
        let elementIndex = d6group.elements.indexOf(currentOrientation)
        data.isElementVisible[elementIndex] = true; //unhide the current orientation
        data = data; //tell svelte about it
        /*if(all group elements shown(){
            move to next phase;
        }*/
    }

    let elemPositions; //filled in by svelte bind:positions={positions} from D6group.svelte

</script>

<style>
    .highlight{
        position:absolute;
        width:70px;
        margin-left:-35px;
        height:80px;
        margin-top:-40px;
        box-shadow: 0px 0px 30px hsl(240, 89.5%, 70%);
        
        
    }
</style>

<div>

<div class="highlight" 
    style:left={elemPositions !== undefined ? elemPositions.get(currentOrientation)[0] + "px":""} 
    style:top={elemPositions !== undefined ? elemPositions.get(currentOrientation)[1]+ "px":""} />
<D6Group {...data} bind:positions={elemPositions} />

<!--<InteractiveTriangle />-->

Current orientation: {currentOrientation.name}
<br>
<button on:click={onRotate} style:background-color={generatorColors[0]}>Rotate by 120 degrees</button>
<button on:click={onFlip} style:background-color={generatorColors[1]}>Flip </button>

</div>
