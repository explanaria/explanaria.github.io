<script>
    import InteractiveD6Creator from "../twoD/InteractiveD6Creator.svelte";
    import { GroupElement, Group } from "../twoD/groupmath.js";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {onMount, onDestroy, tick} from "svelte";
    import {attachCanvas, three} from "../threeD/sharedthreejscanvas.js";
    import {generatorColors} from "../colors.js";
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

    let data;
    let d6creator;

    async function animate(){
        //EXP.setupThree() is required first, but it's called in sharedthreejscanvas.js
        data.showgroup = false;
        data.showbuttons = false;
        data.d6textOpacity = 0;
        data.recordNewOrientations = false;
        data.showInfo = false;
        await presentation.begin();
        await presentation.nextSlide();
        await presentation.nextSlide();
        if(d6creator)d6creator.onRotate();
        await presentation.nextSlide();
        if(d6creator)d6creator.onFlip();
        await presentation.nextSlide();

        //show the word D6 on the triangle, sneakily erasing the previous flip and rotate
        if(d6creator)d6creator.onRotate();
        if(d6creator)d6creator.onFlip();
        await presentation.delay(500);

        presentation.TransitionTo(data, {d6textOpacity: 1}, 1000);
        await presentation.nextSlide();
        await presentation.TransitionTo(data, {showgroup: true}, 1000);
        await presentation.nextSlide(); 
        await presentation.TransitionInstantly(data, {showbuttons: true, showInfo: true, recordNewOrientations: true});
            //player clicks  abunch of buttons

        //wait for user to discover all of the cayley graph
        await new Promise( (resolve, reject) => {
            resolveAllFound = resolve;
    
            //type "debug" to automatically clear
            let debugCode = 0;
            window.addEventListener("keydown", (event) => {
                if(event.key == 'debug'[debugCode]){
                    debugCode += 1;
                    if(debugCode == 'debug'.length)allFound()
                }
            })
        })

        await presentation.nextSlide(); 



        await presentation.nextSlide();
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
        await presentation.nextSlide();
        await presentation.nextSlide();

        if(!alreadyEnding){
            dispatch("chapterEnd");
        }
    }

    //used to let the InteractiveD6Creator notify us that it's finished finding all the elements
    let resolveAllFound = undefined;
    function allFound(event){
        if(resolveAllFound){
            resolveAllFound();
            resolveAllFound = undefined;
        }
    }

    let presentation, alreadyEnding = false;
    onMount(async () => {
        await tick();
        presentation = new EXP.UndoCapableDirector();
        animate();
    });
    onDestroy(() => {
        alreadyEnding = true;
        presentation.dispose();
    });
</script>

<InteractiveD6Creator bind:data={data} bind:this={d6creator} on:allFound={allFound} >
    <!-->
    <div slot="toppart">
        <!-- >stuff on top
    </div>
    -->
    <div slot="textpart" class="overlappingItemContainer textpart">
        <div class="exp-slide">
            Symmetry groups are pretty cool, so let's look at a simpler example: the symmetry group of an equilateral triangle.
            <br>
        </div>
        <div class="exp-slide">
            What's the symmetry group of this triangle? To find out, we'll need to find some actions which realign the triangle with itself.
        </div>
        <div class="exp-slide">
            One action which leaves the triangle looking unchanged is a <b style:color={generatorColors[0]}>rotation by 120 degrees</b>.
        </div>
        <div class="exp-slide">
            And another action which leaves the triangle looking unchanged is a <b style:color={generatorColors[1]}>horizontal flip</b>.
        </div>
        <div class="exp-slide">
            To help keep track of what each action does to the triangle, I'll doodle some letters on it.
        </div>
        <div class="exp-slide">
            Finally, on the right, I'll keep track of the actions you discover.
        </div>
        <div class="exp-slide">
            Each circle represents an action you can perform to the triangle which leaves it unchanged, and arrows will show you what happens if you <span style:color={generatorColors[0]}>rotate</span> and <span style:color={generatorColors[1]}>flip</span> the triangle.
            <br>Can you find the triangle's entire symmetry group? Use these buttons to find out!
        </div>
        <div class="exp-slide">
            Alright! Looks like we found everything! <br>
            Take a look at the cayley graph you filled out. Doesn't it look somewhat triangular? That's no coincidence. Somehow, the symmetry group is capturing info about the original shape we started with.
            <br>
        </div>
        <div class="exp-slide">
            Even more interesting, the resulting group doesn't depend on the actions we choose to build the graph with. For example, we built this graph using a <!--color --> <b style:color={generatorColors[0]}>rotation</b> and <b style:color={generatorColors[1]}>flip</b>. But what if we chose other actions?
        </div>
        <div class="exp-slide">
            I'll draw a <b style:color={generatorColors[2]}>purple</b> arrow to represent this action right here. What happens if we try building a cayley graph out of this action and a <b style:color={generatorColors[1]}>flip?</b>
        </div>
        <div class="exp-slide">
            It's the same graph. 
        </div>
    </div>
</InteractiveD6Creator>
