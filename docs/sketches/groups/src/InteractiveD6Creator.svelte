<script>
    import D6Group from "./components/D6Group.svelte";
    import { GroupElement, Group } from "./components/groupmath.js";
    import {generatorColors} from "./colors.js";
    import {drawTrianglePath, lineWidth, D6_text_size, triangleStrokeStyle, triangleShadowColor, triangleColor, D6TextColor} from "./components/d6canvasdrawing.js";
    
	import { onMount } from 'svelte';

    //group stuff
    let r = new GroupElement("r", "(123)");
    let f = new GroupElement("f", "(23)");
    let d6group = new Group([r,f], {"rfr":"f", "rrr":"", "ff":""});

    export let isArrowVisibleMap = {}; //elementTimesGenerators[elem] is [true, true] where the ith position controls whether or not to show or hide an arrow for that start, generator combo
    d6group.elements.forEach(startElement => {
                isArrowVisibleMap[startElement.name] = d6group.generators.map(generator => false) //every generator starts false
            }
    )
    //isArrowVisibleMap["e"] = [true, true];
    

    let data = {
        d6group: d6group,
        isElementVisible: d6group.elements.map(element => 
            (
            //d6group.isGenerator(element) || 
            element.name == "e")
        ), //only e visible to start
        isArrowVisibleMap: isArrowVisibleMap
    }

    //controlling the orientation of the triangle
    let prevOrientation = d6group.getElemByName("e");
    let currentOrientation = d6group.getElemByName("e");


    function onRotate(){

        //terrible hack time.
        rotationTarget += 120 * flipScaleTarget;

        prevOrientation = currentOrientation;
        currentOrientation = d6group.multiply(currentOrientation, d6group.generators[0])
        data.isArrowVisibleMap[prevOrientation.name][0] = true;
        showNewGroupElements()
    }
    function onFlip(){

        //terrible hack time.
        flipScaleTarget *= -1;

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


    //drawing a triangle like D6ElementCanvas

    const canvasSize = 100; // a bit bigger
    const triangleRadius = 0.35*canvasSize;


    let startVertex = [0,-triangleRadius];
    let canvas, ctx;


    let lastTime = 0;
    function draw(currentTime){
        let delta = (currentTime - lastTime)/1000;
        ctx = canvas.getContext("2d");
        canvas.width = canvas.height = canvasSize;
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
        ctx.font = D6_text_size+ "pt serif"
        ctx.fillText("D6", -10,-10);
        lastTime = currentTime;
        window.requestAnimationFrame(draw);
    }

    onMount(() => draw(0))

    let flipScaleTarget = 1;
    let flipScaleAmount = 1;
    let rotationTarget = 0;
    let rotationAmount = 0;

    let rotationSpeed = 3; //1 = 
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
        if(Math.abs(rotationAmount - rotationTarget) < 1){
            rotationAmount = rotationTarget;
        }
    }

    function applyCurrentAnimation(ctx, delta){
        ctx.scale(flipScaleAmount, 1);
        ctx.rotate(rotationAmount * Math.PI/180);
    }
    

</script>

<style>
    .highlight{
        position:absolute;
        width:70px;
        margin-left:-35px;
        height:80px;
        margin-top:-40px;
        box-shadow: 0px 0px 50px hsl(240, 89.5%, 70%);
    }
    .grouppart{
        width: 100%;
        position: relative;
        min-height: 300px;
    }
</style>

<div>



    <canvas bind:this={canvas} style:width={canvasSize+"px"} style:height={canvasSize+"px"} /> 
    <br>
    How many ways are there to fit an equilateral triangle into an equilateral triangle shaped hole? Use these buttons to find out!
    <!-->Current orientation: {currentOrientation.name}<-->
    <br>Orientations found: {data.isElementVisible.reduce((prev, current) => current ? prev+1 : prev, 0)}
    <br>Arrows found: {
        d6group.elements.reduce((prev, groupElem) => {
            let sum = prev;
            data.isArrowVisibleMap[groupElem.name].forEach(arrowVisible => {if(arrowVisible){sum++}})
            return sum;
        }, 0)}/{d6group.elements.length * d6group.generators.length}
    <br>
    <button on:click={onRotate} style:border-color={generatorColors[0]}>Rotate by 120 degrees</button>
    <button on:click={onFlip} style:border-color={generatorColors[1]}>Flip horizontally</button>

    <div class="grouppart">
        <div class="highlight" 
            style:left={elemPositions !== undefined ? elemPositions.get(currentOrientation)[0] + "px":""} 
            style:top={elemPositions !== undefined ? elemPositions.get(currentOrientation)[1]+ "px":""} />
        <D6Group {...data} bind:positions={elemPositions} />
    </div>

</div>
