<script>
    import MoleculeCanvas from "../threeD/MoleculeCanvas.svelte";
    import * as EXP from "../../../../resources/build/explanaria-bundle.js";
    import {getAtomColor} from "../colors.js";
    import {onMount, onDestroy} from "svelte";

    async function animate(){
        await presentation.begin();
        await presentation.nextSlide();
        let whitebg = document.getElementById("whitebg");
        await presentation.TransitionTo(whitebg.style, {opacity: 1}, 1);
        await presentation.nextSlide();
        await presentation.TransitionTo(whitebg.style, {opacity: 0}, 1);
        await presentation.nextSlide();
        await presentation.nextSlide();
        await presentation.nextSlide();

    }

    let presentation;
    onMount(() => {
        presentation = new EXP.UndoCapableDirector(); 
        animate();
    });
    onDestroy(() => {
        presentation.removeClickables();
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
    #overlays{
        z-index: 2;
        pointer-events: none;
    }
</style>

<div class="overlappingItemContainer exp-text">
    <MoleculeCanvas />
    <div id="whitebg" style="opacity: 0"/>
    <div id="overlays" class="overlappingItemContainer">
        <div class="exp-slide">
            <br><br><br>
            <center>
                <div class="frostedbg" style="width: 15em">
                    <h1>Group Theory Done Wrong</h1>
                    <br>
                    <aside>(Use the arrows to advance)</aside>
                </div>
            </center>
        </div>
        <div class="exp-slide">
            <div class="twocolumns">
                <div class="column" style:height={"50%"}>
                    <br><br>
                    This is a crystal of kyanite.
                    <br><br>    
                    <img class="materialimage" alt="Long, sharp, blue crystals of kyanite poking out of a white rock" src="./img/Kyanite-265746.jpg"/>
                    <br>
                    <aside>(photo by 
                        <a href="https://commons.wikimedia.org/wiki/File:Kyanite-265746.jpg">Rob Lavinsky, CC-BY-SA)</a>
                    </aside>
                </div>
                <div class="column" style:height={"50%"}>
                    <br><br>
                    And this is a crystal of andalusite.
                    <br><br>
                    <img class="materialimage" alt="A orange-gray crystal of andalusite, opaque and with long columns" src="./img/Andalusite_-_Al2SiO5_locality_-_Dolní_Bory,_Czech_Republic_(50426489511).jpg"/>
                    <br>
                    <aside>(photo by 
                        <a href="https://commons.wikimedia.org/wiki/File:Andalusite_-_Al2SiO5_locality_-_Doln%C3%AD_Bory,_Czech_Republic_(50426489511).jpg">Jan Helebrant, CC-BY-SA)</a>
                    </aside>
                </div>
            </div>
            <br><br>
            <p>
            Andalusite and kyanite might look different, but they're actually made of the exact same atoms, in the exact same ratio: just aluminum, silicon, and oxygen. The difference is how they're arranged.
            </p>
            <!-->
                <Dropdown title="Andalusite's name has a funny history...">
                    Geologists often name minerals after the places they were first discovered. Andalusite got its name from a crystal which was thought to be from Andalusia, Spain... but the crystal was mislabeled, and was actually from Guadalajara, a completely different part of spain.
                </Dropdown> -->
        </div>
        <div class="exp-slide">
            <div class="frostedbg">
                If we zoomed in until we could see the <span style:color={getAtomColor("Al")}>aluminum</span>, <span style:color={getAtomColor("Si")}>silicon</span>, and <span style:color={getAtomColor("O")}>oxygen</span> atoms,
                <div class="twocolumns">
                    <div class="column">
                        kyanite would look like this,
                    </div>
                    <div class="column">
                        and andalusite would look like this.
                    </div>
                </div>
            </div>
        </div>
        <div class="exp-slide frostedbg">
            <!-- labels: kyanite, andalusite -->
            I'm only showing a few thousand atoms here, but these patterns continue for hundreds of millions of atoms. It's quite pretty.
            <br>
            But, I want to ask: how would you describe <u>how</u> these atoms repeat? How would you describe what makes Kyanite's pattern of repeating atoms  different from Andalusite's pattern of repeating atoms?
            <br>
        </div>
        <div class="exp-slide frostedbg">
            <!-- labels: kyanite, andalusite -->
            Drag to rotate the 3D model yourself and take a look. What can we use to describe how these crystals repeat?
            We can't use the number of atoms - Andalusite and Kyanite have the same number of atoms.
            We can't look at one atom at a time - every <span style:color={getAtomColor("Al")}>aluminum</span> atom always has five bonds, and every <span style:color={getAtomColor("Si")}>silicon</span> atom always connects to four other atoms.
            <br>
        </div>
        <div class="exp-slide">
            So do andalusite and kyanite repeat in the same way? Or a different way? What would "repeating in a different way" even mean?
            <br>

            We don't really have the words to describe these patterns in everyday language, so mathematicians invented their own: the language of <b>group theory</b>. 

            <br>
            This explanarian presentation is an introduction to group theory, from the point of view of understanding crystals. When I was first learning group theory, it was taught very abstractly, and I had a hard time understanding why mathematicians cared about it so much.
        </div>

        <div class="exp-slide">
            <div class="frostedbg">
                Group theory is usually used to talk about symmetry, but it also can be defined much more abstractly. Why does group theory keep cropping up everywhere in math? For one thing, it's the language used to talk about symmetry. But another way to describe group theory is more abstract, involving combining and undoing. Since there's lots of things in math which can be combined and undone, like adding numbers or applying rotations, there's lots of places in math to use the ideas of group theory.
            </div>
        </div>
        <!-->
        <div class="exp-slide frostedbg">
            Group theory usually isn't taught using crystals and pictures. In fact, it's usually taught much more abstractly. Being able to manipulate 

 It turns out that having a language to talk about repetition was the right way to talk about symmetry, so they could describe anything that could combine and undo. And because there's lots of things in math involving combining and undoing, the language of group theory snuck its way into 

        Whenever something in math involves combining and undoing, you can usually find mathematicians trying to analyze it using abstract algebra, creating new subfields of math named "algebraic X" in the process. There's algebraic geometry, algebraic number theory, 
        </div>
        -->
        
    </div>
</div>


<div class="overlappingItemContainer textpart">
    <div class="exp-slide" />
    <div class="exp-slide" />
    <div class="exp-slide" />
</div>
