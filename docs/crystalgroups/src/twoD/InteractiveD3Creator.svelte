<script>
    import D3Group from "../twoD/D3Group.svelte";
    import { GroupElement, FiniteGroup } from "../twoD/groupmath.js";
    import {generatorColors as defaultGeneratorColors} from "../colors.js";
    import {drawTrianglePath, lineWidth, D3_text_size_multiplier, triangleStrokeStyle, triangleShadowColor, triangleColor, D3TextColor} from "../twoD/D3canvasdrawing.js";
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
    
	import { onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';

    //group stuff
    let r = new GroupElement("r", "(123)");
    let f = new GroupElement("f", "(23)");

    let D3group = new FiniteGroup([r,f], {"rfr":"f", "rrr":"", "ff":""});

    let isArrowVisibleMap = {}; //elementTimesGenerators[elem] is [true, true] where the ith position controls whether or not to show or hide an arrow for that start, generator combo
    D3group.elements.forEach(startElement => {
                isArrowVisibleMap[startElement.name] = D3group.generators.map(generator => false) //every generator starts false
            }
    )
    //isArrowVisibleMap["e"] = [true, true];

    export let generatorColors = defaultGeneratorColors;
    

    export let data = {
        D3group: D3group,
        isElementVisible: D3group.elements.map(element => 
            (
            //D3group.isGenerator(element) || 
            element.name == "e")
        ), //only e visible to start
        isArrowVisibleMap: isArrowVisibleMap,
        generatorColors: generatorColors,
        showgroup: true,
        showbuttons: true,
        showInfo: true,
        D3textOpacity: 1,
        currentOrientation: D3group.getElemByName("e"),
        recordNewOrientations: true,
        opacity: 0,
    }

    //hack for reactivity

    //copy everything to a _data
    let _data = {};
    Object.keys(data).forEach(keyName => {_data[keyName] = data[keyName];})

    //redefine data with a setter that tells svelte to update data
    Object.keys(_data).forEach(keyName => 
        Object.defineProperty(data, keyName, {
          set(x) { _data[keyName] = x; _data = _data;}, //let svelte know about the reactive change
          get(x) { return _data[keyName]; }
        })
    );
    export function updateGroupGenerators(){
        D3group = data.D3group;       
        D3group.generators = data.D3group.generators; 
    }

    //controlling the orientation of the triangle
    let prevOrientation = D3group.getElemByName("e");

    export function onButton(generatorIndex){
        let generator = data.D3group.generators[generatorIndex];

        if(generator.name == "r")playRotation(120);
        if(generator.name == "rr")playRotation(240);
        if(generator.name == "f")playFlip();
        if(generator.name == "rf"){
            //at same time
            playRotation(120);
            playFlip();

        }

        prevOrientation = data.currentOrientation;
        if(data.recordNewOrientations){
            data.currentOrientation = D3group.multiply(data.currentOrientation, generator)
            data.isArrowVisibleMap[prevOrientation.name][generatorIndex] = true;
        }
        showNewGroupElements()
    }


    export function playRotation(degrees=120){

        //terrible hack time.
        rotationTarget += degrees * flipScaleTarget;
    }
    export function playFlip(){

        //terrible hack time.
        flipScaleTarget *= -1;
    }
    function showNewGroupElements(){
        //moveTriangleToNewOrientation();
        let elementIndex = D3group.elements.indexOf(data.currentOrientation)
        data.isElementVisible[elementIndex] = true; //unhide the current orientation
        data = data; 

        //if all elements found, send a message
        //note: this will keep sending a message every time a button is clicked once the criterion has been reached
        let allFound = true;
        for(let i=0;i<D3group.elements.length;i++){
            let element = D3group.elements[i];
            //if element isn't visible, or an arrow from it hasn't been found yet
            if(!data.isElementVisible[i] ||
                data.isArrowVisibleMap[element.name].indexOf(false) !== -1){
                allFound = false;
                break;
            }
        }
        if(allFound){
            dispatch("allFound", {});
        }
    }

    let elemPositions; //filled in by svelte bind:positions={positions} from D3group.svelte


    //drawing a triangle like D3ElementCanvas

    const canvasSize = 15; // a bit bigger

    const canvasSizePixels = canvasSize * 30;
    const triangleRadius = 0.4*canvasSizePixels;


    let startVertex = [0,-triangleRadius];
    let canvas, ctx;


    let lastTime = 0;
    let drawLoopEnabled = true;
    function draw(currentTime){
        if(!drawLoopEnabled)return;
        let delta = (currentTime - lastTime)/1000;
        ctx = canvas.getContext("2d");

        canvas.width = canvasSizePixels;
        canvas.height = canvasSizePixels;

        ctx.translate(canvas.width/2, canvas.height/2); //make all transformations start from center of canvas
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = triangleStrokeStyle;

        //draw triangle shadow
        ctx.save();
        ctx.fillStyle = triangleShadowColor;
        drawTrianglePath(ctx, 0,0, startVertex);
        ctx.fill();

        updateCurrentAnimation(ctx, delta);
        applyCurrentAnimation(ctx, delta);

        ctx.fillStyle = triangleColor
        drawTrianglePath(ctx, 0,0, startVertex);
        ctx.fill();

        ctx.fillStyle = D3TextColor;
        ctx.font = D3_text_size_multiplier * canvasSize+ "px serif";
        ctx.globalAlpha = data.D3textOpacity;
        ctx.fillText("D", -0.11 * canvasSizePixels,-0.06 * canvasSizePixels);
        ctx.font = D3_text_size_multiplier * 0.7 * canvasSize+ "px serif";
        ctx.fillText("3", 0.05 * canvasSizePixels, -0.00 * canvasSizePixels);
        ctx.globalAlpha = 1;
        
        lastTime = currentTime;
        window.requestAnimationFrame(draw);
    }

    onMount(() => {drawLoopEnabled = true; draw(0)})
    onDestroy(() => {drawLoopEnabled = false;})

    let flipScaleTarget = 1;
    let flipScaleAmount = 1;
    let rotationTarget = 0;
    let rotationAmount = 0;

    let rotationSpeed = 3; //1 = one second, 3 = 1/3 of a second
    let flipSpeed = 3;

    function updateCurrentAnimation(ctx, delta){
        if(flipScaleAmount != flipScaleTarget){
            flipScaleAmount += delta * 2 * flipSpeed * Math.sign(flipScaleTarget-flipScaleAmount)
        }
        if(Math.abs(flipScaleAmount - flipScaleTarget) < rotationSpeed * 2/60){
            flipScaleAmount = flipScaleTarget;
        }
        if(rotationAmount != rotationTarget){
            rotationAmount += delta * 120 * rotationSpeed * Math.sign(rotationTarget-rotationAmount)
        }
        if(Math.abs(rotationAmount - rotationTarget) < 5){
            rotationAmount = rotationTarget;
        }
    }

    function applyCurrentAnimation(ctx, delta){
        ctx.scale(flipScaleAmount, 1);
        ctx.rotate(rotationAmount * Math.PI/180);
    }

    $: orientationsFound = data.isElementVisible.reduce((prev, current) => current ? prev+1 : prev, 0);
    $: arrowsFound = D3group.elements.reduce((prev, groupElem) => {
                            let sum = prev;
                            data.isArrowVisibleMap[groupElem.name].forEach(arrowVisible => {if(arrowVisible){sum++}})
                            return sum;
                        }, 0)
    

</script>

<style>
    .highlight{
        position:absolute;
        width:3em;
        margin-left:-1.5em;
        height:4em;
        margin-top:-2em;
        box-shadow: 0px 0px 50px hsl(240, 89.5%, 70%);
        border-radius: 3em;
    }
    .mainlayout{
        display: grid;
        grid-template-rows: 0em 19em;
        transition: opacity 0.5s ease-in-out;
    }
    .button{
        font-size: 1em;
        animation: pulse 1s ease-in-out;
        border-radius: 2em;
    }
    @keyframes pulse{
        0%{
            transform: scale(1);
        }
        50%{
            transform: scale(1.2);
        }
        100%{
            transform: scale(1);
        }
    }
</style>

<div class="mainlayout" style:opacity={_data.opacity} style:pointer-events={_data.opacity != 0 ? "all" : "none"}>
    <slot name="toppart">
        <div class="top">
            {#if data.showInfo}
            <div in:fade="{{ duration: 500 }}">
                <br>Actions found: {orientationsFound} {orientationsFound == D3group.elements.length ? "🎉" : ""}
                <br>Arrows found: {arrowsFound}/{D3group.elements.length * D3group.generators.length} {arrowsFound == D3group.elements.length * D3group.generators.length ? "🎉" : ""}
            </div>
            {/if}
        </div>
    </slot>
    <div class="twocolumns interactivepart">
        <div class="column">
            <canvas bind:this={canvas} style:width={canvasSize+"em"} style:height={canvasSize+"em"} /> 
            <br>
            <div class="twocolumns" style="gap: 1em;">
                {#if data.showbuttons}
                <button in:fade="{{ duration: 500 }}" on:click={() => onButton(0)} style:border-color={_data.generatorColors[0]} class="button">
                    <slot name="button1text">
                    Rotate by 120 degrees
                    </slot>
                </button>
                <button in:fade="{{ duration: 500 }}" on:click={() => onButton(1)} style:border-color={_data.generatorColors[1]} class="button">
                    <slot name="button2text">
                    Flip horizontally
                    </slot>
                </button>
                {/if}
            </div>
            <!-->Current orientation: {data.currentOrientation.name}<-->

        </div>

        <div class="groupcontainer">
            {#if data.showgroup}
            <div class="highlight fadeInImmediately" 
                style:left={elemPositions !== undefined ? elemPositions.get(data.currentOrientation)[0] + "em":""} 
                style:top={elemPositions !== undefined ? elemPositions.get(data.currentOrientation)[1]+ "em":""} />
            <D3Group D3group={data.D3group} isElementVisible={data.isElementVisible} isArrowVisibleMap={data.isArrowVisibleMap} bind:positions={elemPositions} />
            {/if}
        </div>
    </div>
</div>
