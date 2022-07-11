<script>
    import { rotate2D } from "./utils.js";
	import { onMount } from 'svelte';
    import { GroupElement } from "./groupmath.js";
    import * as EXP from "../../../../resources/build/explanaria-bundle.js";

    export let element = new GroupElement("", "(3)"); //a GroupElement

    $: canvasName = "canvas-" + element.name;
    let canvas = null, ctx = null;

    function drawTrianglePath(ctx, centerX, centerY, oneVertexVectorFromCenter){
        ctx.translate(centerX, centerY);
        ctx.beginPath();
        ctx.moveTo(...oneVertexVectorFromCenter);
        ctx.lineTo(...rotate2D(120, ...oneVertexVectorFromCenter));
        ctx.lineTo(...rotate2D(240, ...oneVertexVectorFromCenter));
        ctx.lineTo(...oneVertexVectorFromCenter);
        ctx.closePath();
        ctx.stroke();

        ctx.translate(-centerX, -centerY);
    }

    const canvasSize = 70;


    const triangleRadius = 0.4*canvasSize;
    const arowCenterDistance = 0.45*canvasSize; //how far from the center should the arced arrow that shows a rotation be?
    const offsetDegrees = 20; //don't end the arc directly at the end of the rotation, end slightly before to give the arrowhead some space
    const num_dashes = 5;
    const dash_radius = canvasSize/2; //how far from the center should dashed lines for mirroring go
    const D6_text_size = 12;
    export let NUM_DEGREES_IN_ONE_ROTATION = 120;


    let startVertex = [0,-triangleRadius]; //one vertex of the triangle

    let lastTime = 0;
    function draw(currentTime){
        let delta = (currentTime - lastTime)/1000;
        canvas.width = canvas.width;
        canvas.height = canvas.height;

        ctx.save();

        ctx.translate(canvas.width/2, canvas.height/2); //make all transformations start from center of canvas

        //draw triangle shadow
        ctx.save();
        ctx.fillStyle = "#555555";
        drawTrianglePath(ctx, 0,0, startVertex);
        ctx.fill();

        //draw triangle, rotated or scaled by the animation
        updateCurrentAnimation(ctx, delta);
        applyCurrentAnimation(ctx, delta);
        ctx.fillStyle = "#bbbbbb"
        drawTrianglePath(ctx, 0,0, startVertex);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.font = D6_text_size+ "pt serif"
        ctx.fillText("D6", -10,-10);

        ctx.restore();
        //finally, draw stuff like mirror lines which go on top of the triangle and don't rotate with it
        drawStaticElements(ctx);
        ctx.restore();

        lastTime = currentTime;
        window.requestAnimationFrame(draw);
    }
    function isAllRs(string){
        for(let i=0;i<string.length;i++){
            if(string[i] != 'r')return false;
        }
        return true;
    }


    function drawStaticElements(ctx){
        //draw things like arcs or dotted lines to represent transformations. these don't move
            if(isAllRs(element.name)){
                //this is a pure rotation. draw a rotation arrow
                //handles both "r" and "rr"!
                let rotationDegrees = NUM_DEGREES_IN_ONE_ROTATION * element.name.length; //increase arc distance if needed

                let arrowLineVec = [0,-arowCenterDistance];

                ctx.beginPath();
                ctx.moveTo(...arrowLineVec);
                for(let i=0;i<rotationDegrees - offsetDegrees;i+=1){
                    ctx.lineTo(...rotate2D(i, ...arrowLineVec));
                }             
                ctx.stroke();

                //arrowhead triangle
                
                let arrowheadSize = 6;
                let finalPoint = rotate2D(rotationDegrees - offsetDegrees, ...arrowLineVec);
                let finalDirection = rotate2D(90 + rotationDegrees - offsetDegrees, ...[0, -arrowheadSize]);

                drawTrianglePath(ctx, finalPoint[0],finalPoint[1], finalDirection);
                ctx.fill();
            }
            else if(element.name.search("f") != -1){//todo: add check for only "r"s being in there
                //draw a dotted flip line.
                //any Rs there will rotate the flip line.g
                let flipStartPos = [0, dash_radius];
                for(let i=0;i<element.name.length;i++){
                    if(element.name[i] == 'r'){
                        flipStartPos = rotate2D(NUM_DEGREES_IN_ONE_ROTATION, ...flipStartPos);
                    }
                    if(element.name[i] == 'f'){ //flip horizontally
                        flipStartPos[0] = -flipStartPos[0];
                    }
                }

                //now draw a dotted line from flipStartPos to -flipStartPos
                ctx.beginPath()
                for(let i=0;i<num_dashes*2;i++){
                    let lerpFactor = i / (num_dashes*2);
                    let posX = lerpFactor * flipStartPos[0]  + (1-lerpFactor) * (-flipStartPos[0]);
                    let posY = lerpFactor * flipStartPos[1]  + (1-lerpFactor) * (-flipStartPos[1]);
                    if(i%2 == 0){
                        ctx.moveTo(posX, posY);
                    }else{
                        ctx.lineTo(posX, posY);
                    }
                }
                ctx.stroke();
            }
    }


    //janky animation system time!
    let animationProgress = 0; //goes from 0 to 1 over the course of the animation

    function easing(t){
        //cosine ease
        return (1-Math.cos(t * Math.PI))/2
    }

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
            if(isAllRs(element.name)){
                //element is a pure rotation, named "r" or "rr"

                let rotationDegrees = NUM_DEGREES_IN_ONE_ROTATION * element.name.length;
                let rotationRadians = rotationDegrees * Math.PI / 180;
                
                //animation, rotation version
                applyCurrentAnimation = function(ctx, deltatime){
                    ctx.rotate(rotationRadians * easing(animationProgress))
                }
            }
            else if(element.name.search("f") != -1){
                //element is a flip. It's assumed there's only Rs in the rest of the name.

                //to create a flip around something that's not the x-axis, we'll rotate the canvas 
                let axisBeingFlipped = [1,0];
                for(let i=0;i<element.name.length;i++){
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
        canvas = document.getElementById(canvasName);
        ctx = canvas.getContext("2d");
        draw(0);
        await animationLoop();
    })
</script>

<style>
    .elementcanvas{
        width: 70px;
        height: 70px;
    }
</style>

<canvas class="elementcanvas" id={canvasName} width={canvasSize} height={canvasSize}/> 
