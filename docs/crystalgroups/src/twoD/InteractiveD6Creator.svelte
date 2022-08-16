<script>
    import D6Group from "../twoD/D6Group.svelte";
    import { GroupElement, FiniteGroup } from "../twoD/groupmath.js";
    import {generatorColors} from "../colors.js";
    import {drawTrianglePath, lineWidth, D6_text_size_multiplier, triangleStrokeStyle, triangleShadowColor, triangleColor, D6TextColor} from "../twoD/d6canvasdrawing.js";
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
    
	import { onMount, onDestroy } from 'svelte';

    //group stuff
    let r = new GroupElement("r", "(123)");
    let f = new GroupElement("f", "(23)");
    let d6group = new FiniteGroup([r,f], {"rfr":"f", "rrr":"", "ff":""});

    let isArrowVisibleMap = {}; //elementTimesGenerators[elem] is [true, true] where the ith position controls whether or not to show or hide an arrow for that start, generator combo
    d6group.elements.forEach(startElement => {
                isArrowVisibleMap[startElement.name] = d6group.generators.map(generator => false) //every generator starts false
            }
    )
    //isArrowVisibleMap["e"] = [true, true];
    

    export let data = {
        d6group: d6group,
        isElementVisible: d6group.elements.map(element => 
            (
            //d6group.isGenerator(element) || 
            element.name == "e")
        ), //only e visible to start
        isArrowVisibleMap: isArrowVisibleMap,
        showgroup: true,
        showbuttons: true,
        showInfo: true,
        d6textOpacity: 1,
        currentOrientation: d6group.getElemByName("e"),
        recordNewOrientations: true,
    }

    //controlling the orientation of the triangle
    let prevOrientation = d6group.getElemByName("e");


    export function onRotate(){

        //terrible hack time.
        rotationTarget += 120 * flipScaleTarget;

        prevOrientation = data.currentOrientation;
        if(data.recordNewOrientations){
            data.currentOrientation = d6group.multiply(data.currentOrientation, d6group.generators[0])
            data.isArrowVisibleMap[prevOrientation.name][0] = true;
        }
        showNewGroupElements()
    }
    export function onFlip(){

        //terrible hack time.
        flipScaleTarget *= -1;

        prevOrientation = data.currentOrientation;
        if(data.recordNewOrientations){
            data.currentOrientation = d6group.multiply(data.currentOrientation, d6group.generators[1])
            data.isArrowVisibleMap[prevOrientation.name][1] = true;
        }
        showNewGroupElements()
    }
    function showNewGroupElements(){
        //moveTriangleToNewOrientation();
        let elementIndex = d6group.elements.indexOf(data.currentOrientation)
        data.isElementVisible[elementIndex] = true; //unhide the current orientation
        data = data; 

        //if all elements found, send a message
        //note: this will keep sending a message every time a button is clicked once the criterion has been reached
        let allFound = true;
        for(let i=0;i<d6group.elements.length;i++){
            let element = d6group.elements[i];
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

    let elemPositions; //filled in by svelte bind:positions={positions} from D6group.svelte


    //drawing a triangle like D6ElementCanvas

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

        ctx.fillStyle = D6TextColor;
        ctx.font = D6_text_size_multiplier * canvasSize+ "em serif";
        ctx.globalAlpha = data.d6textOpacity;
        ctx.fillText("D6", -0.4 * D6_text_size_multiplier * canvasSizePixels,-0.1 *D6_text_size_multiplier * canvasSizePixels);
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
        if(Math.abs(rotationAmount - rotationTarget) < 2){
            rotationAmount = rotationTarget;
        }
    }

    function applyCurrentAnimation(ctx, delta){
        ctx.scale(flipScaleAmount, 1);
        ctx.rotate(rotationAmount * Math.PI/180);
    }

    window.data = data;

    $: orientationsFound = data.isElementVisible.reduce((prev, current) => current ? prev+1 : prev, 0);
    $: arrowsFound = d6group.elements.reduce((prev, groupElem) => {
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
    .grouppart{
        width: 100%;
        position: relative;
    }

    .mainlayout{
        display: grid;
        grid-template-rows: 2em 21em 4em;
    }
    .button{
        font-size: 1em;
    }
</style>

<div>

    <div class="mainlayout">
        <slot name="toppart">
            <div class="top">
                {#if data.showInfo}
                <div class="fadeInImmediately">
                    <br>Orientations found: {orientationsFound} {orientationsFound == d6group.elements.length ? "🎉" : ""}
                    <br>Arrows found: {arrowsFound}/{d6group.elements.length * d6group.generators.length} {arrowsFound == d6group.elements.length * d6group.generators.length ? "🎉" : ""}
                </div>
                {/if}
            </div>
        </slot>
        <div class="twocolumns interactivepart">
            <div class="column">
                <canvas bind:this={canvas} style:width={canvasSize+"em"} style:height={canvasSize+"em"} /> 
                <br>
                <div class="twocolumns">
                    {#if data.showbuttons}
                    <button on:click={onRotate} style:border-color={generatorColors[0]} class="button fadeInImmediately">Rotate by 120 degrees</button>
                    <button on:click={onFlip} style:border-color={generatorColors[1]} class="button fadeInImmediately">Flip horizontally</button>
                    {/if}
                </div>
                <!-->Current orientation: {data.currentOrientation.name}<-->

            </div>

            <div class="grouppart">
                {#if data.showgroup}
                <div class="highlight fadeInImmediately" 
                    style:left={elemPositions !== undefined ? elemPositions.get(data.currentOrientation)[0] + "em":""} 
                    style:top={elemPositions !== undefined ? elemPositions.get(data.currentOrientation)[1]+ "em":""} />
                <D6Group {...data} bind:positions={elemPositions} />
                {/if}
            </div>
        </div>
        <slot name="textpart">
            <div class="textpart" style:background-color="red">
                How many ways are there to fit an equilateral triangle into an equilateral triangle shaped hole? Use these buttons to find out!
            </div>
        </slot>
    </div>
</div>
