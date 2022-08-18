<script>
    import InteractiveD6Creator from "../twoD/InteractiveD6Creator.svelte";
    import { GroupElement, FiniteGroup } from "../twoD/groupmath.js";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {onMount, onDestroy, tick} from "svelte";
    import {attachCanvas, three} from "../threeD/sharedthreejscanvas.js";
    import {generatorColors, rColor, rfColor, rrColor} from "../colors.js";
    import { fade } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

    let data, data2, data3;
    let d6creator, d6creator2, d6creator3;

    export let debugSkipInteractives = false;

    export let showgroupaxioms = false;
    export let endHere = true;

    let chapterData = {set showgroupaxioms(x){ showgroupaxioms = x;}, get showgroupaxioms(){return showgroupaxioms}}

    let keylistener = null;
    async function waitForClear(){
        return;
    //wait for user to discover all of the second cayley graph
        return new Promise( (resolve, reject) => {
            if(alreadyEnding)resolve();
            resolveAllFound = resolve;

            //type "debug" to automatically clear
            let debugCode = 0;

            keylistener = (event) => {
                if(event.key == 'debug'[debugCode]){
                    debugCode += 1;
                    if(debugCode == 'debug'.length)allFound()
                }
            }
            window.addEventListener("keydown", keylistener);
        })
    }


    async function animate(){
        //EXP.setupThree() is required first, but it's called in sharedthreejscanvas.js
        window.data2 = data2;
        data2.opacity = 0;
        data2.d6group.generators[0] = data2.d6group.getElemByName("rf");
        data2.generatorColors[0] = rfColor;
        data2.d6group = data2.d6group; //update svelte
        data2.showbuttons = false;

        //you're just a measly subgroup
        data3.d6group.elements = [data3.d6group.getElemByName("e"), data3.d6group.getElemByName("r"), data3.d6group.getElemByName("rr")];
        data3.opacity = 0;
        data3.d6group.generators[1] = data3.d6group.getElemByName("rr");
        data3.generatorColors[1] = rrColor;
        data3.d6group = data3.d6group; //update svelte
        data3.showbuttons = false;


        data.showgroup = false;
        data.showbuttons = false;
        data.d6textOpacity = 0;
        data.opacity = 1;
        data.recordNewOrientations = false;
        data.showInfo = false;
        await presentation.begin();

        if(!debugSkipInteractives){

        await presentation.nextSlide();
        await presentation.nextSlide();
        if(d6creator)d6creator.onButton(0);
        await presentation.nextSlide();
        if(d6creator)d6creator.onButton(1);
        await presentation.nextSlide();

        //show the word D6 on the triangle, sneakily erasing the previous flip and rotate
        if(d6creator)d6creator.onButton(0);
        if(d6creator)d6creator.onButton(1);
        await presentation.delay(500);

        presentation.TransitionTo(data, {d6textOpacity: 1}, 500);
        await presentation.nextSlide();
        await presentation.TransitionInstantly(data, {showgroup: true});
        await presentation.nextSlide(); 
        await presentation.TransitionInstantly(data, {showbuttons: true, showInfo: true, recordNewOrientations: true});
            //player clicks a bunch of buttons

        //wait for user to discover all of the cayley graph
        await waitForClear()

        await presentation.nextSlide(); 


        presentation.TransitionInstantly(data, {showInfo: false});

        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        //now, we're going to add the purple arrow rf as a generator
        let newgenerator = data.d6group.getElemByName("rf");
        data.d6group.generators.push(newgenerator)

        //todo: hide "orientations found" and "arrows found"

        data.d6group.elements.forEach(element => data.isArrowVisibleMap[element.name] = [true,true,false]);
        data.isArrowVisibleMap = data.isArrowVisibleMap;
        data.isArrowVisibleMap["e"][2] = true; //show one arrow


        //data = data;
        //data.d6group = data.d6group;
        await presentation.nextSlide();

        presentation.TransitionInstantly(data, {opacity: 0});
        presentation.TransitionInstantly(data2, {opacity: 1, showbuttons: true});

        //wait for user to discover all of the second cayley graph
        await waitForClear()

        await presentation.nextSlide();
        await presentation.nextSlide();

        presentation.TransitionInstantly(data2, {showInfo: false});
        let newgeneratorR = data2.d6group.getElemByName("r");
        data2.d6group.generators.push(newgeneratorR)
        let newgeneratorRR = data2.d6group.getElemByName("rr");
        data2.d6group.generators.push(newgeneratorRR)
        data2.isArrowVisibleMap["e"] = [true, true, true, true] //show arrows to r and rr

        await presentation.nextSlide();
        presentation.TransitionInstantly(data2, {opacity: 0});
        presentation.TransitionInstantly(data3, {opacity: 1, showbuttons: true});

        await waitForClear()

        await presentation.nextSlide();

        }

        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
            //show group rules

        presentation.TransitionInstantly(data3, {opacity: 0});
        presentation.TransitionInstantly(chapterData, {showgroupaxioms: true})

        console.log("show group rules")
        await presentation.nextSlide();
        await presentation.nextSlide(); 
        await presentation.nextSlide(); 

        presentation.TransitionInstantly(chapterData, {showgroupaxioms: false})
        presentation.TransitionInstantly(data, {opacity: 1});

        await presentation.nextSlide();
        await presentation.nextSlide(); 
        if(endHere){
        await presentation.nextSlide();
        }


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
            window.removeEventListener("keydown", keylistener);
            if(!alreadyEnding)window.setTimeout(() => presentation.handleForwardsPress(), 1); //advance to next slide automatically
        }
    }

    let presentation, alreadyEnding = false;
    onMount(async () => {
        await tick();
        presentation = new EXP.UndoCapableDirector();
        window.presentation = presentation;
        animate();
    });
    /*
    onDestroy(async () => {
        alreadyEnding = true;
        allFound();
        presentation.dispose();
        await tick();
    });*/
</script>

<div class="cayleymainlayout">
    <div class="overlappingItemContainer">
        <InteractiveD6Creator bind:data={data} bind:this={d6creator} on:allFound={allFound} />

        <InteractiveD6Creator bind:data={data2} bind:this={d6creator2} on:allFound={allFound} generatorColors={[generatorColors[2], generatorColors[1]]}>
            <span slot="button1text">Angled flip</span>
        </InteractiveD6Creator>

        <InteractiveD6Creator bind:data={data3} bind:this={d6creator3} on:allFound={allFound} generatorColors={[generatorColors[0], generatorColors[0]]}>
            <span slot="button2text">Rotate 240 degrees</span>
        </InteractiveD6Creator>

        {#if showgroupaxioms}
        <div id="grouprules" class="frostedbg" transition:fade="{{ duration: 500 }}">
            <h1> The Group Axioms </h1>
            <br>
            A group is a set of <b>elements</b> and a <b>way to combine them</b> (written *) which obey these rules:

            <br><br>
            <ul class="twocolumns">
                <li>Identity: <aside>e exists, e*x = x</aside></li>
                <p>Doing nothing is always an option</p>
            </ul>
            <br>
            <ul class="twocolumns">
                <li>Composition: <aside>If x,y in group, so is x*y</aside></li>
                <p>Group elements can be combined to your heart's content</p>
            </ul>
            <br>
            <ul class="twocolumns">
                <li>Associativity: <aside>(x*y)*z = x*(y*z)</aside></li>
                <p>Parentheses work like we expect them to</p>
            </ul>
            <br>
            <ul class="twocolumns">
                <li>Inverses: <aside>given x, x<sup>-1</sup> exists, and x * x<sup>-1</sup> = e</aside></li>
                <p>You can always undo things</p>
            </ul>
        </div>
        {/if}
    </div>

    <div class="overlappingItemContainer textpart cayleytextpart">
        {#if !debugSkipInteractives}
        <div class="exp-slide">
            Symmetry groups are pretty cool, so let's look at a simple example: the symmetry group of an equilateral triangle.
            <br>
        </div>
        <div class="exp-slide">
            What's the symmetry group of this triangle? To find out, we'll need to find some actions which realign the triangle with itself.
        </div>
        <div class="exp-slide">
            One action which leaves the triangle looking unchanged is a <b style={"color: " + generatorColors[0]}>rotation by 120 degrees</b>.
        </div>
        <div class="exp-slide">
            And another action which leaves the triangle looking unchanged is a <b style={"color: " + generatorColors[1]}>horizontal flip</b>.
        </div>
        <div class="exp-slide">
            To help keep track of what each action does to the triangle, I'll doodle some letters on it.
        </div>
        <div class="exp-slide">
            Finally, on the right, I'll keep track of the actions you discover.
        </div>
        <div class="exp-slide">
            Each circle represents an action in the group, and arrows will show you what happens if you <span style={"color: " + generatorColors[0]}>rotate</span> and <span style={"color: " + generatorColors[1]}>flip</span> the triangle.
            <br>Use these buttons to explore the group until you find every action and arrow!
        </div>
        <div class="exp-slide">
            Alright! Looks like you found everything! <br>
            This way of drawing symmetry groups, where we draw one circle per action and arrows to represent <span style={"color: " + generatorColors[0]}>certain</span> <span style={"color: " + generatorColors[1]}>actions</span>, is called a Cayley graph.
            <br>
        </div>
        <div class="exp-slide">
            Doesn't the triangle's Cayley graph look somewhat triangular? That's no coincidence. Somehow, the symmetry group is capturing info about the original shape we started with.
        </div>
        <div class="exp-slide">
            This group is called "the dihedral group of order 6". It's usually written "D<sub>6</sub>"; the 6 is because there are only 6 actions in this group.
            <br><aside>Confusingly, some mathematicians call it D<sub>3</sub> instead, named after the 3-sided triangle we made it from.</aside>
        </div>
        <div class="exp-slide">
            Even more interesting, the resulting group doesn't depend on the actions we choose to build the graph with. For example, we built this Cayley graph using a <!--color --> <b style={"color: " + generatorColors[0]}>rotation</b> and <b style={"color: " + generatorColors[1]}>flip</b>. But what if we chose other actions?
        </div>
        <div class="exp-slide">
            For example, what if I choose the action labeled "rf"? I'll draw it in <b style={"color: " + generatorColors[2]}>purple</b>.
        </div>
        <div class="exp-slide">
            What happens if we try building this triangle's Cayley graph out of <b style={"color: " + generatorColors[2]}>this purple flip</b> and a <b style={"color: " + generatorColors[1]}>horizontal flip</b>? Try applying the actions in different orders.
        </div>
        <div class="exp-slide">
            The arrows are a bit different, but we still reach all the same elements. The symmetry group of a shape is somehow independent of the actions we use to build it.
        </div>
        <div class="exp-slide">
            Let's test it one more time. What if we choose <b style={"color: " + generatorColors[0]}>these</b> <b style={"color: " + rrColor}>two</b> elements as our starting actions?
        </div>
        <div class="exp-slide">
            Let's try building the triangle's Cayley graph out of <b style={"color: " + rColor}>these</b> <b style={"color: " + rrColor}>two</b> elements.
        </div>
        
        {/if}

        <div class="exp-slide">
            Huh. This isn't the full symmetry group of our triangle. Why can't we reach any of the flips? I thought the symmetry group of a shape was independent of the actions we started from?
        </div>
        <div class="exp-slide">
            We couldn't make the full group because <b>groups can have groups inside them</b>, called "subgroups". One of the most important rules of a group is that combining two things in a group gives you another element in that group.
        </div>

        <div class="exp-slide">
            Or, to say it another way, you can't escape a group by only combining things in that group. Since both of our <b style={"color: " + rColor}>starting</b> <b style={"color: " + rrColor}>actions</b> were in the same rotations-only subgroup, applying them won't ever let us leave the subgroup.
        </div>
        <div class="exp-slide">
            Also, notice how applying a <b style={"color: " + rColor}>120 degree rotation</b>, then a <b style={"color: " + rrColor}>240 degree rotation</b> gets you back where you started. You could say that 120 degrees and 240 rotations undo one another.
        </div>
        <div class="exp-slide">
            All the actions we've seen so far can be undone. In fact, being able to undo anything is so important it's part of the definition of a group: every element is required to have another action which undoes it, called its <b>inverse</b>.
        </div>
        <div class="exp-slide">
            Speaking of definitions, what are the rules for being a group, anyways? Mathematicians have pruned them down to just four.
        </div>
        <div class="exp-slide">
           A group is defined as anything which follows these four rules.
        </div>
        <div class="exp-slide">
           Notice how the rules doesn't say <b>how</b> elements of a group combine. That's on purpose: different groups can combine in different ways. Numbers can combine using addition. Actions can combine by doing one thing after another. They're all groups.
        </div>
        <div class="exp-slide">
           I like to think of a group as "things which can combine and undo". And there's lots of things in math which combine and undo. From numbers to rotating triangles to moving crystals, groups allow us to study them all at the same time.
        </div>
        <div class="exp-slide">
           Cayley graphs, such as the ones you created, are a great way to visualize groups. You can undo an arrow by following it backwards, and combine two arrows by following one, then the other.
        </div>

        <div class="exp-slide">
           Once you have a group, there's lots of questions you can ask about it: given a group, how many subgroups are there, and what are they? Are there any other groups with only 6 actions? Given two groups, is there a copy of one hiding inside the other?
        </div>
        {#if endHere}
        <div class="exp-slide">
           It's been a long journey from crystals to combining, but I hope this taste of group theory has made you curious to learn more!
        </div>
        {:else}
        <div class="exp-slide">
           So now that we more about groups, we can use our knowledge of groups to finally tell apart those annoyingly similar crystals!
        </div>
        {/if}
    </div>
</div>
