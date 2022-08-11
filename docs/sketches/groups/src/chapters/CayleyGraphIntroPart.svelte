<script>
    import InteractiveD6Creator from "./InteractiveD6Creator.svelte";
    import { GroupElement, Group } from "../twoD/groupmath.js";
    import * as EXP from "../../../../resources/build/explanaria-bundle.js";
    import {onMount, onDestroy} from "svelte";
    import {attachCanvas, three} from "../threeD/sharedthreejscanvas.js";
    
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


    let data;

    async function animate(){
        //EXP.setupThree() is required first, but it's called in sharedthreejscanvas.js
        data.showgroup = false;
        await presentation.begin();
        await presentation.nextSlide();
        await presentation.TransitionTo(data, {showgroup: true}, 1000);
        await presentation.nextSlide(); //todo: wait for user to discover all of the cayley graph

        await presentation.nextSlide();
        //now, we're going to add the purple arrow rf as a generator
        let newgenerator = data.d6group.getElemByName("rf");
        data.d6group.generators.push(newgenerator)

        //todo: hide "orientations found" and "arrows found"

        data.d6group.elements.forEach(element => data.isArrowVisibleMap[element.name] = [true,true,true]);
        data.isArrowVisibleMap = data.isArrowVisibleMap;
        
        data.isArrowVisibleMap[groupElem.name].push(false);
        data.d6group.elements.forEach(element => data.isArrowVisibleMap[element.name].push(true));
        data.isArrowVisibleMap["e"][2] = true; //show one arrow

        data = data;
        data.d6group = data.d6group;

    }

    let presentation;
    onMount(() => {
        presentation = new EXP.UndoCapableDirector();
        animate();
    });
    onDestroy(() => {
        presentation.removeClickables();
    });
</script>

<InteractiveD6Creator bind:data={data} >
    <div slot="toppart">
        <!-- >stuff on top -->
    </div>
    <div slot="textpart" class="overlappingItemContainer textpart">
        <div class="exp-slide">
            How many ways are there to fit an equilateral triangle into an equilateral triangle shaped hole? Use these buttons to find out!
            <br>
        </div>
        <div class="exp-slide">
            This map on the right is called a <b>"cayley graph"</b>. Each circle represents an action you can perform to the triangle which leaves it unchanged, and the arrows show you what happens if you <span>rotate</span> and <span>flip</span> the triangle.
            
            You might ask "if the triangle is unchanged, why is the text in a different position"? But remember, the text is just a doodle to help illustrate the actions more clearly. The triangle itself, without our added text, looks the same before and after.

            And interestingly, doesn't it look somewhat triangular? That's no coincidence. Somehow, the cayley graph is capturing info about the original shape we started with.
        </div>
        <div class="exp-slide">
            Even more interesting, the resulting group <!-- am i saying group or graph --> doesn't depend on the actions we choose to make the graph with. For example, we made this graph using a <!--color --> <b>rotation</b> and <b>flip</b>. But what if we chose other actions, like this one?
        </div>
        <div class="exp-slide">
            I'll draw a <!-- color -->purple arrow to represent this action right here. What happens if we try building a cayley graph out of this action and a <b>flip?</b>
        </div>
        <div class="exp-slide">
            It's the same graph. 
        </div>
    </div>
</InteractiveD6Creator>
