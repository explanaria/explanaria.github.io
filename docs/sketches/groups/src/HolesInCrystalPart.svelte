<script>
    import MoleculeCanvas from "./threeD/MoleculeCanvas.svelte";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {getAtomColor} from "./colors.js";
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
            <div class="frostedbg">
            </div>
        </div>

</div>


<div class="overlappingItemContainer textpart">
    <div class="exp-slide">
                Let's start by examing this structure of atoms.
    </div>
    <div class="exp-slide">
                hey look holes
    </div>
    <div class="exp-slide">
                why holes? it going to tell us about actions
    </div>
    <div class="exp-slide">
                all atoms seem to be aligned.
    </div>
    <div class="exp-slide">
                (show lines)
                every atom has a copy in this direction
    </div>
    <div class="exp-slide">
                that because you can TRANSLATE in this direction
    </div>
    <div class="exp-slide">
                what about this directoin? 
    </div>
    <div class="exp-slide">
                same thing: the crystal stays the same if you translate in this direction.
    </div>

    <div class="exp-slide">
                what about direction 3? 
    </div>
    <div class="exp-slide">
                yup.
    </div>
    <div class="exp-slide">
               but interestingly, this translation is the same as translatoin 1 then translation 2
    </div>
    <div class="exp-slide">
                so:
                    - we can understand crystals by looking at "the actions which leave it unchanged"
                    - combining two of those actions gives you another action
                these are two of the four tenets of group theory!
    </div>
    <div class="exp-slide">
                to illustrate this, let's take a break from crystals, and move to a simpler example.
    </div>
</div>
