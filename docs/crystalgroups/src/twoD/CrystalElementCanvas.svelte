<script>
    import { rotate2D } from "./utils.js";
	import { onMount } from 'svelte';
    import { GroupElement } from "./groupmath.js";
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    import {easing, drawStaticElements, isPureTranslation, getTranslationVector, canvasSizePixels, canvasSize, dotColor} from "./crystalcanvasdrawing.js";
    import {tick} from "svelte";

    export let element = new GroupElement("", "(3)"); //a GroupElement

    $: canvasName = "canvas-" + element.name;
    let canvas = null, ctx = null;

    const lineWidth = 4;

    function drawDots(){

        return; //disable dots for now

        let height = canvas.height;
        let width = canvas.width;
        let radius = height/8;

        for(let i=-1;i+=1;i++){
            for(let j=-1;j+=1;j++){
                
                ctx.beginPath();
                ctx.arc(i * width/4, j * height/4, radius, 0, 2 * Math.PI);
                ctx.fill();

            }
        }
    }


    let lastTime = 0;
    function draw(currentTime){
        let delta = (currentTime - lastTime)/1000;
        canvas.width = canvasSizePixels;
        canvas.height = canvasSizePixels;
        ctx.lineWidth = lineWidth;

        ctx.save();

        ctx.translate(canvas.width/2, canvas.height/2); //make all transformations start from center of canvas

        //draw triangle shadow
        ctx.save();
        ctx.fillStyle = dotColor;
        drawDots();

        //draw triangle, rotated or scaled by the animation
        updateCurrentAnimation(ctx, delta);
        applyCurrentAnimation(ctx, delta);
        ctx.fillStyle = dotColor;
        drawDots();

        ctx.restore();
        //finally, draw stuff like mirror lines which go on top of the triangle and don't rotate with it
        drawStaticElements(ctx, element);
        ctx.restore();

        lastTime = currentTime;
        window.requestAnimationFrame(draw);
    }

    //janky animation system time!
    let animationProgress = 0; //goes from 0 to 1 over the course of the animation

    async function animationLoop(){
        //this one controls the animation of each element
        while(true){ //todo: stop looping when there's an onUnmount
            await oneFullAnimation();
            await EXP.delay(2000);
        }
    }

    async function oneFullAnimation(duration=2){
        animationProgress = 0;
        return new Promise(resolve => {
            if(isPureTranslation(element.name)){
                //element is a pure rotation, named "r" or "rr"

                /*
                let rotationDegrees = NUM_DEGREES_IN_ONE_ROTATION * element.name.length;
                let rotationRadians = rotationDegrees * Math.PI / 180;
                
                //animation, rotation version
                applyCurrentAnimation = function(ctx, deltatime){
                    ctx.rotate(rotationRadians * easing(animationProgress))
                }*/
            }
            else if(element.name.search("f") != -1){
                //element is a flip. It's assumed there's only Rs in the rest of the name.

                //to create a flip around something that's not the x-axis, we'll rotate the canvas 
                let axisBeingFlipped = [1,0];
                for(let i=element.name.length-1;i>=0;i--){ //traverse name from right to left, backwards, because that's how function notation works
                    if(element.name[i] == 'r'){
                        axisBeingFlipped = rotate2D(NUM_DEGREES_IN_ONE_ROTATION, ...axisBeingFlipped);
                    }
                    if(element.name[i] == 'f'){ //flip horizontally
                        axisBeingFlipped[0] = -axisBeingFlipped[0];
                    }
                }
                //now, to create a flip about that axis, we'll rotate the canvas so that axis is [0,1], flip about [0,1] using scale(-1,1), then unrotate.
                let angle = Math.atan2(axisBeingFlipped[1],axisBeingFlipped[0]);

                applyCurrentAnimation = function(ctx, deltatime){
                    let xScale = (1 - 2*easing(animationProgress));//as animationProgress goes from 0 to 1, this goes from 1 to -1
                    ctx.rotate(angle);
                    ctx.scale(xScale, 1); 
                    ctx.rotate(-angle);
                }

            }

            //update function, common to all
            updateCurrentAnimation = function(ctx, deltatime){
                animationProgress += deltatime / duration;
                if(animationProgress >= 1){
                    //animation done
                    //applyCurrentAnimation = ()=>{}; //don't reset this, leave the animation paused on the final frame
                    updateCurrentAnimation = ()=>{};
                    animationProgress = 1;
                    resolve();
                }
            } 
        })
    }
    //will be overwritten by oneFullAnimation
    function updateCurrentAnimation(ctx, deltatime){} 
    function applyCurrentAnimation(ctx, deltatime){}


    onMount(async () => {
        await tick(); //load canvas
        ctx = canvas.getContext("2d");
        draw(0);
        await animationLoop();
    })
</script>

<canvas class="elementcanvas" bind:this={canvas} width={canvasSize} height={canvasSize} style:width={canvasSize + "em"} style:height={canvasSize + "em"}/> 


