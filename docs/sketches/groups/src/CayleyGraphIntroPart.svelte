<script>
    import InteractiveD6Creator from "./InteractiveD6Creator.svelte";
    import { GroupElement, Group } from "./twoD/groupmath.js";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    
    /*
    export let data = {
        d6group: d6group,
        isElementVisible: d6group.elements.map(element => 
            (
            //d6group.isGenerator(element) || 
            element.name == "e")
        ), //only e visible to start
        isArrowVisibleMap: isArrowVisibleMap
    }*/

    let presentation = new EXP.UndoCapableDirector();
    let data;

    async function animate(){
        await presentation.begin();
        await presentation.nextSlide();
        await presentation.nextSlide(); //todo: wait for user to discover all of the cayley graph

        await presentation.nextSlide();
        //now, we're going to add the purple arrow rf as a generator
        let newgenerator = data.d6group.getElemByName("rf");
        data.d6group.generators.push(newgenerator)

        data.d6group.elements.forEach(element => data.isArrowVisibleMap[element.name] = [true,true,true]);
        data.isArrowVisibleMap = data.isArrowVisibleMap;
        
        data.isArrowVisibleMap[groupElem.name].push(false);
        data.d6group.elements.forEach(element => data.isArrowVisibleMap[element.name].push(true));
        data.isArrowVisibleMap["e"][2] = true; //show one arrow

        data = data;
        data.d6group = data.d6group;

    }
    animate();
</script>

<InteractiveD6Creator bind:data={data} >
    <div slot="toppart">
        stuff on top
    </div>
    <div slot="textpart" class="overlappingitemcontainer">
        <div class="exp-slide">
            How many ways are there to fit an equilateral triangle into an equilateral triangle shaped hole? Use these buttons to find out!
        </div>
        <div class="exp-slide">
            The pattern looks like a triangle whoa
        </div>
        <div class="exp-slide">
            We made this graph using <b>rotation</b> and <b>flip</b>. What if we chose different 
        </div>
    </div>
</InteractiveD6Creator>
