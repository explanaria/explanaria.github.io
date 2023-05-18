<script>
    import MoleculeCanvas from "../threeD/MoleculeCanvas.svelte";
    import D3Group from "../twoD/D3Group.svelte";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {getAtomColor} from "../colors.js";
    import {onMount, onDestroy, tick} from "svelte";
    import {clearThreeScene} from "../threeD/sharedthreejscanvas.js";
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

    let _D3Opacity = 0;

    let data = {
      set D3Opacity(x) { _D3Opacity = x; }, //let svelte know about the reactive change
      get D3Opacity() { return _D3Opacity; }
    };

    async function animate(){
        let whitebg = document.getElementById("whitebg");
        await presentation.begin();
        await presentation.nextSlide();
        await presentation.TransitionInstantly(whitebg.style, {opacity: 1});
        await presentation.nextSlide();
        await presentation.TransitionInstantly(whitebg.style, {opacity: 0});
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();

        await presentation.TransitionInstantly(whitebg.style, {opacity: 0.8});
        await presentation.TransitionTo(data, {D3Opacity: 1}, 500);
        
        await presentation.nextSlide();
        await presentation.nextSlide();

        await presentation.TransitionInstantly(whitebg.style, {opacity: 0});
        await presentation.TransitionTo(data, {D3Opacity: 0}, 500);

        await presentation.nextSlide();

        if(!alreadyEnding){
            dispatch("chapterEnd");
        }
    }

    let presentation, alreadyEnding = false;
    onMount(async () => {
        await tick();
        presentation = new EXP.UndoCapableDirector(); 
        window.firstPresentation = presentation;
        animate();
    });
    onDestroy(() => {
        alreadyEnding = true;
        presentation.dispose();
    });

    let slideStart = 1;
</script>

<style>
    .materialimage{
        height:10em;
        margin: 0 auto;
    }
    #whitebg{
        background-color: white;
        transition: opacity 0.5s ease-in-out;
        pointer-events: none;
        z-index: 1;
    }

    .exp-backbtn{
        width: 2.5em;
        height: 2.5em;
    }
    .homelink{
        text-decoration:none;
        color: hsla(240, 90%, 70%, 1);
        position:absolute;
        top:0.5em;
        left:0.5em; 
        display: grid; 
        grid-template-columns: 2.5em 1fr;
    }
    .homelink:hover{
	    transform: scale(1.1);
    }

</style>

<div class="overlappingItemContainer exp-text fullscreen">
    <MoleculeCanvas style="z-index: 0"/>
    <div id="whitebg" style="opacity: 0; z-index: 1"/>

    <div class="noclick" style="transform: scale(0.8) translate(25%, 6em); z-index: 2" style:opacity={_D3Opacity} >
        <div class="groupcontainer">
            <D3Group elementsWhoseNamesNotToShow={["rr","rf","fr","e","r","f"]}/>
        </div>
    </div>

    <div id="overlays" class="overlappingItemContainer noclick" style="z-index: 3">
        <div class="">
            <br><br><br>
            <center>
                <div class="frostedbg exp-slide" style="width: 27em">
                    <h1>Clear Crystal Conundrums</h1>
                    <p>A Multifaceted Intro to Group Theory</p>

                    <br>
                    <aside>(Use the right arrow to advance)</aside>
                </div>
            </center>

            <a href="https://explanaria.github.io" class="homelink yesclick exp-slide-1">
                    <img src="img/BackButton.svg" class="exp-backbtn" alt="Back">
                    <span style="font-size: 0.7em; margin: auto;padding-left:0.2em; padding-top: 0.5em;">More<br>Explanaria</span>
            </a>

        </div>
        <div class="">
            <div class="exp-slide frostedbg">
                <div class="twocolumns">
                    <div class="column" style="height: 40%;">
                        <br>
                        <h2>This is a crystal of kyanite.</h2>
                        <br>
                        <img class="materialimage" alt="Long, sharp, blue crystals of kyanite poking out of a white rock" src="./img/Kyanite-265746.jpg"/>
                        <br>
                        <aside>(photo by 
                            <a href="https://commons.wikimedia.org/wiki/File:Kyanite-265746.jpg">Rob Lavinsky, CC-BY-SA)</a>
                        </aside>
                    </div>
                    <div class="column" style="height: 40%;">
                        <br>
                        <h2>And this is a crystal of andalusite.</h2>
                        <br>
                        <img class="materialimage" alt="A orange-gray crystal of andalusite, opaque and with long columns" src="./img/Andalusite_-_Al2SiO5_locality_-_Dolní_Bory,_Czech_Republic_(50426489511).jpg"/>
                        <br>
                        <aside>(photo by 
                            <a href="https://commons.wikimedia.org/wiki/File:Andalusite_-_Al2SiO5_locality_-_Doln%C3%AD_Bory,_Czech_Republic_(50426489511).jpg">Jan Helebrant, CC-BY-SA)</a>
                        </aside>
                    </div>
                </div>
            <br>
            <p>
            Andalusite and kyanite might look different, but they're actually made of the exact same atoms, in the exact same ratio: just aluminum, silicon, and oxygen. The difference is how they're arranged.
            </p>
            <!-->
                <Dropdown title="andalusite's name has a funny history...">
                    Geologists often name minerals after the places they were first discovered. andalusite got its name from a crystal which was thought to be from Andalusia, Spain... but the crystal was mislabeled, and was actually from Guadalajara, a completely different part of spain.
                </Dropdown> -->
            </div>
        </div>
        <div class="">
            <div class="frostedbg exp-slide">
                <br>
                If we zoomed in to see the <span style={"color: " + getAtomColor('Al')}>aluminum</span>, <span style={"color: " + getAtomColor('Si')}>silicon</span>, and <span style={"color: " + getAtomColor('O')}>oxygen</span> atoms,
                <br><br>
                <div class="twocolumns">
                    <div class="column" style="text-align: left">
                        kyanite would look like this...
                    </div>
                    <div class="column" style="text-align: right">
                        and andalusite would look like this.
                    </div>
                </div>
            </div>
        </div>
        <div class="hidewhenpresenting">
            <div class="frostedbg exp-slide">
                I'm only showing a few thousand atoms here, but these patterns continue for hundreds of millions of atoms. It's quite pretty.
                <br>
                But, I want to ask: how would you describe <u>the way</u> these atoms repeat? How would you describe what makes kyanite's pattern of repeating atoms different from andalusite's pattern of repeating atoms?
            </div>
        </div>
        <div class="hidewhenpresenting">
            <div class="frostedbg exp-slide">
                <!-- labels: kyanite, andalusite -->
                Drag to rotate the 3D model yourself and take a look. What can we use to describe how andalusite and kyanite repeat? It's not easy.
            </div>
        </div>
        <div class="hidewhenpresenting">
            <div class="frostedbg exp-slide">
                <!-- labels: kyanite, andalusite -->
                The number of atoms won't help - both crystals have the same number (and ratio) of atoms, and there's billions of them.
                <br>Looking at one atom at a time won't help - each atom behaves similarly to all others. For example, in both crystals, every <span style={"color: " + getAtomColor('O')}>oxygen</span> atom has three bonds, and every <span style={"color: " + getAtomColor('Si')}>silicon</span> atom always connects to four other atoms.
            </div>
        </div>
        <div class="hidewhenpresenting">
            <div class="frostedbg exp-slide">
                So do andalusite and kyanite repeat in the same way? Or a different way? <br>What would "repeating in a different way" even mean?
                <br>
                <br> 
            </div>
        </div>
        <div class="hidewhenpresenting">
            <div class="frostedbg exp-slide">
                So do andalusite and kyanite repeat in the same way? Or a different way? <br>What would "repeating in a different way" even mean?
                <br>We don't really have the words to describe this in everyday language, so mathematicians invented their own: the language of <b>group theory</b>. 
            </div>
        </div>
        <div class="hidewhenpresenting">
            <div class="frostedbg exp-slide">
                Group theory is a powerful way to think about repetition, symmetry, and the way things can combine and undo. In this presentation, we'll try to figure out the difference between andalusite and kyanite, and along the way we'll learn about group theory visually using these colorful graphs.
            </div>
        </div>
        <div class="hidewhenpresenting">
            <div class="frostedbg exp-slide">
                When I first learned group theory, it was taught in a very self-contained way, and I had a hard time seeing why mathematicians want to use it everywhere. Sure, it was interesting to think about a way to define symmetry, but what kind of problems would lead someone to think about such specific actions?
                <!-->
                Group theory is usually said to be the right way to talk about symmetry. But another way to describe group theory is that it's all about things that can be combined and undoed. And there's lots of things in math which can be combined and undone, like adding numbers or applying rotations.
                -->
            </div>
        </div>
        <div class="">
            <div class="frostedbg exp-slide">
                <p style="margin: auto 7em;">As it turns out, group theory is the perfect language for talking about repeating patterns, like crystals.
                <br><br>
                Let's see why.</p>
            </div>
        </div>
        <!-->
        <div class=" frostedbg exp-slide">
            Group theory usually isn't taught using crystals and pictures. In fact, it's usually taught much more abstractly. Being able to manipulate 

 It turns out that having a language to talk about repetition was the right way to talk about symmetry, so they could describe anything that could combine and undo. And because there's lots of things in math involving combining and undoing, the language of group theory snuck its way into 

        Whenever something in math involves combining and undoing, you can usually find mathematicians trying to analyze it using abstract algebra, creating new subfields of math named "algebraic X" in the process. There's algebraic geometry, algebraic number theory, 
        </div>
        -->
        
    </div>
</div>
