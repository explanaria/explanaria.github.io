let three, controls, objects, knotParams;

let userPointParams = {x1:Math.PI/2,x2:0,factors:['linear','linear']};

let presentation = null;



let overhandPoints = [[-3,0,0],[-2,1.25,0],[-1,1.5,0],[0,2,0.25],[1,2,0],[0.5,1,-0.25], [-0.5,1,0.25],[-1,2,0],[0,2,-0.25],[1,1.5,0],[2,1.25,0],[3,0,0]];
let knotPoints = [[-3,0,0],[-2,1.25,0],[-1,1.5,0],[0,2,0.25],[1,2,0],[0.5,1,-0.25], [-0.5,1,0.25],[-1,2,0],[0,2,-0.25],[1,1.5,0],[2,1.25,0],[3,0,0]]; //same as overhandPoints


let finalCirclePoints = [[0,-1,0],[-1.5,-0.75,0],[-1.75,-0.5,0],[-2,1,0],
[-1.5,1.75,0],[-0.5,2,0], [0.5,2,0],[1.5,1.75,0],
[2,1,0],[1.75,-0.5,0],[1.5,-0.75,0],[0,-1,0]];

let knotSpline, knotEndPoints, bonkEffect, knotGripPoint, twoDCanvas;

const zeroWColor = new THREE.Color(coordinateLine4ZeroColor);
const oneWColor = new THREE.Color(coordinateLine4Color);
const negativeWColor = new THREE.Color(coordinateLine4NegativeColor);

function fourDColorFunc(i,t,x,y,z,wCoordinate=0){
 let fourDAbsRampAmt = Math.min(1, Math.abs(wCoordinate)) //ramp from 0-1 then hold steady at 1
 /*
  //a color map that (A) goes from dark to light as you go from 0-1, and (B) cycles hue
 let lightness = Math.min(0.5, wCoordinate);
 return new THREE.Color().setHSL(wCoordinate, 0.5, fourDRampAmt/2);
 */

 if(wCoordinate > 0){
   return zeroWColor.clone().lerp(oneWColor.clone(), fourDAbsRampAmt); 
 }else{
   return zeroWColor.clone().lerp(negativeWColor.clone(), fourDAbsRampAmt); 
 }
}

class overlayCanvas{
    constructor(canvasID){
        this.canvas = document.getElementById(canvasID);
        this.context = this.canvas.getContext("2d");

        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
        this.onWindowResize();

        this.opacity = 0;
        this.maxFontSize = 48;

        //app-specific settings
        this.movingPoint4DSize = 0;
        this.movingPointTextOffset = [50,-50];
        this.fixedPoint4DSize = 0;
        this.fixedPointTextOffset = [50,50];
    }
    onWindowResize(){
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
    
        this.maxFontSize = Math.min(48, Math.min(this.canvas.width, this.canvas.height)/20);
    }
    activate(t){
        this.onWindowResize(); //also clears canvas

        this.context.fillStyle = 'rgba(255,255,255,0.0)';
        this.context.fillRect(0,0,this.canvas.width, this.canvas.height);
        this.canvas.style.opacity = this.opacity;

        
        this.drawCoordsForAPoint(knotPoints[4], this.movingPoint4DSize * this.maxFontSize, this.movingPointTextOffset);
        
        this.drawCoordsForAPoint(knotPoints[9], this.fixedPoint4DSize * this.maxFontSize, this.fixedPointTextOffset)

    }
    drawCoordsForAPoint(pointInArrayFormat, fourthCoordSize = 0, offset=[50,-50]){

        let screenSpaceCoords = this.screenSpaceCoordsOfPoint(pointInArrayFormat)
        this.drawCoordinateString(screenSpaceCoords, pointInArrayFormat, offset,fourthCoordSize);
    }
    screenSpaceCoordsOfPoint(point){
        three.camera.matrixWorldNeedsUpdate = true;
        let vec = new THREE.Vector3(...point).applyMatrix4(three.camera.matrixWorldInverse).applyMatrix4(three.camera.projectionMatrix)
        let arr = vec.toArray(); 
        arr[0] = (arr[0]+1)/2 * this.canvas.width;
        arr[1] = (-arr[1]+1)/2 * this.canvas.height;
        return arr; //yeah theres an extra arr[2] but just ignore it   
    }
    format(x, precision=2){
        return Number(x).toFixed(2);
    }
    drawCoordinateString(pos, coordinates, offset=[50,-50], fourthCoordSize=0){

        let allStrings = ['['];
        for(let i=0;i<coordinates.length;i++){
            allStrings.push(this.format(coordinates[i]));
            if(i != coordinates.length-1){
                allStrings.push(',')
            }
        }
        allStrings.push(']');

        let textMetrics = [];
        let totalTextWidth = 0;
        let totalTextHeight = 0;
        for(let i=0;i<allStrings.length;i++){
            //for fancy growing effect
            if(i == 7 || (i == 6 && allStrings[i] == ',')){
                this.context.font = fourthCoordSize+"px Computer Modern Serif";
            }else{
                this.context.font = this.maxFontSize+"px Computer Modern Serif";
            }

            let metrics = this.context.measureText(allStrings[i]);
            textMetrics.push(metrics);
            totalTextWidth += metrics.width;
            totalTextHeight = Math.max(totalTextHeight, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent); //English is a left-to-right language so we just care about the tallest letter
            
        }

        let startTextX = pos[0] + offset[0];
        let startTextY = pos[1] + offset[1];

        //ensure labels don't go offscreen
        if(startTextX + totalTextWidth > this.canvas.width)startTextX = this.canvas.width - totalTextWidth;
        if(startTextX - totalTextWidth < 0)startTextX = totalTextWidth;
        if(startTextY + totalTextHeight > this.canvas.height)startTextY = this.canvas.height - totalTextHeight;
        if(startTextY - totalTextHeight < 0)startTextY = totalTextHeight;

        let textX = startTextX;
        let textY = startTextY;

        for(let i=0;i<allStrings.length;i++){

            let fillStyle = '#444';

            if(i == 1){
                fillStyle = coordinateLine1Color;
            }else if(i == 3){
                fillStyle = coordinateLine2Color
            }else if(i == 5){
                fillStyle = coordinateLine3Color
            }else if(i == 7){
                fillStyle = coordinateLine4Color
            }

            //for fancy growing effect
            if(i == 7 || (i == 6 && allStrings[i] == ',')){
                this.context.font = fourthCoordSize+"px Computer Modern Serif";
            }else{
                this.context.font = this.maxFontSize+"px Computer Modern Serif";
            }

            this.drawText(allStrings[i], textX, textY, fillStyle);

            textX += textMetrics[i].width;
        }
        this.drawArrowFromTextToCoords(pos, startTextX, startTextY, totalTextWidth, totalTextHeight);
    }
    drawArrowFromTextToCoords(screenSpaceCoords, textX, textY, totalTextWidth, totalTextHeight){

        let textBuffer = 10;
        //choose the side of the text which will make the arrow the smallest, so the arrow doesn't go through the text
        let lineStartX = textX - textBuffer;
        let lineStartXRightSide = (textX + textBuffer + totalTextWidth);
        if(Math.abs(lineStartX - screenSpaceCoords[0]) > Math.abs(lineStartXRightSide-screenSpaceCoords[0])){
            lineStartX = lineStartXRightSide;
        }

        let lineStartY = textY - textBuffer;
        //let lineStartYBottom = (textY + textBuffer + totalTextHeight);
        //if(Math.abs(lineStartY - screenSpaceCoords[1]) > Math.abs(lineStartYBottom-screenSpaceCoords[1])){
        //    lineStartY = lineStartYBottom;
        //}

        //move arrow end position away from the end point by a little bit in the direction of the line
        let arrowDirection = new THREE.Vector2(screenSpaceCoords[0]-lineStartX, screenSpaceCoords[1]-lineStartY).normalize();
        let endPadding = 20;
        
        this.context.strokeStyle = "rgba(0,0,0,0.7)";
        this.context.lineWidth = 5;
        this.drawArrow(lineStartX, lineStartY, screenSpaceCoords[0] - arrowDirection.x*endPadding,screenSpaceCoords[1] - arrowDirection.y*endPadding, 20);
    }
    drawText(text, textX, textY, fillStyle){
        
        let metrics = this.context.measureText(text);

        //draw a transparent rectangle under the text
        this.context.fillStyle = "rgba(255,255,255,0.9)"
        this.context.fillRect(textX, textY-38, metrics.width, 52);

        this.context.fillStyle = fillStyle;

        this.context.fillText(text, textX, textY);
    }
    drawArrow(x1,y1,x2,y2, arrowSize){
        //main line
        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2,y2);

        //pos1 is the back of the midline of the triangle, pos2 the tip
        const size = Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2))
        arrowSize = Math.min(size/3, arrowSize);
        const negativeTriangleDirectionVec = [(x1-x2)/size*arrowSize,(y1-y2)/size*arrowSize];

        const halfTriangleDirectionPerpVec1 = [-negativeTriangleDirectionVec[1]/2*Math.sqrt(3),negativeTriangleDirectionVec[0]/2*Math.sqrt(3)];
        const halfTriangleDirectionPerpVec2 = [negativeTriangleDirectionVec[1]/2*Math.sqrt(3),-negativeTriangleDirectionVec[0]/2*Math.sqrt(3)];
        //the two 90-degree parts at the front
        this.context.moveTo(x2 + negativeTriangleDirectionVec[0] + halfTriangleDirectionPerpVec1[0], y2 + negativeTriangleDirectionVec[1] + halfTriangleDirectionPerpVec1[1]);
        this.context.lineTo(x2,y2);
        this.context.lineTo(x2 + negativeTriangleDirectionVec[0] + halfTriangleDirectionPerpVec2[0], y2 + negativeTriangleDirectionVec[1] + halfTriangleDirectionPerpVec2[1]);
        this.context.stroke();
    }
}

function setup(){
	three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
	controls = new FrontViewPreferredOrbitControls(three.camera,three.renderer.domElement);

    presentation = new EXP.UndoCapableDirector();
    

	three.camera.position.z = 4;
	three.camera.position.y = 3;

    controls.enableKeys = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    three.scene.add(new THREE.AmbientLight(0xffffff));
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
		controls.update();
	});



    knotEndPoints = new EXP.Array({data: [knotPoints[0],knotPoints[knotPoints.length-1]]});
    knotEndPoints.add(new EXP.PointOutput({color: 0x333333, width: 0.2}));


    knotGripPoint = new EXP.Array({data: [knotPoints[4]]});
    knotGripPoint.add(new EXP.PointOutput({color: 0x333333, width: 0.1, opacity:0}));



    let knotPointsDebug = new EXP.Array({data: knotPoints});
    //knotPointsDebug.add(new EXP.PointOutput({color: 0x333333, width: 0.1}));

    knotSpline = new EXP.Area({bounds: [[0,1]], numItems: 100});
    knotSpline
    .add(new EXP.Transformation({expr: (i,t,x) => getCatRomSpline(x, knotPoints)}))
    .add(new EXP.LineOutput({color: fourDColorFunc, width: 5}));

    //to get the classic "line over/under" effect, I give these lines a white outline behind them
    knotSpline.children[0].add(new EXP.Transformation({expr: (i,t,x,y,z) => {
        let cameraDirection = new THREE.Vector3(x,y,z).sub(three.camera.position).normalize(); //move away from camera
        return [x+cameraDirection.x* 0.05, y+cameraDirection.y* 0.05,z+cameraDirection.z * 0.05];
    }}))
    .add(new EXP.LineOutput({color: 0xffffff, width: 30}));

    


    /* cool stagger effect
    bonkEffectLine = new EXP.Array({data: [[1,0,0],[1,0,0]]});
    bonkEffectLine.add(new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z]}))
    .add(new EXP.LineOutput({color: blue, width: 5}));*/

    bonkEffect = new THREE.Mesh(new THREE.RingGeometry(0.2,0.3,32),new THREE.MeshBasicMaterial({color: blue, opacity: 0.0, transparent: true, side: THREE.DoubleSide}));
    //make the ring spiky
    for(let i=0;i<bonkEffect.geometry.vertices.length;i++){
        if(i % 2 == 0){
            bonkEffect.geometry.vertices[i].multiplyScalar(1.3);
        }
    }
    bonkEffect.geometry.verticesNeedUpdate =true
    three.scene.add(bonkEffect);

    twoDCanvas = new overlayCanvas("twoDcanvas");

    objects = [knotEndPoints, knotSpline,knotPointsDebug,knotGripPoint,twoDCanvas];

    console.log("Loaded.");
}

async function animate(){

    let canvasContainer = document.getElementById('canvasContainer');

    //twoDCanvasHandler.cartesianOpacity = 0;
    await presentation.begin();

    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    //show overhand knot
    await presentation.nextSlide();

    //show that if the ends are fixed, we can always undo the knot

    //slide loop alongprojScreenMat
    var l = knotPoints.length-1;
    for(let i=2; i<knotPoints.length-3;i++){
        if(i==4)continue;
        let knotPointSlidAlongLength = EXP.Math.vectorAdd(knotPoints[i],[4,-3,0]);
        knotPointSlidAlongLength[2] *= 3;
        presentation.TransitionTo(knotPoints[i], knotPointSlidAlongLength, 2000);
    }
    //compress points near the right end
    for(let i=l-2; i<knotPoints.length;i++){
        presentation.TransitionTo(knotPoints[i], knotPoints[l], 1000);
    }
    presentation.TransitionTo(knotPoints[1], [1,0,0], 2000);
    presentation.TransitionTo(knotPoints[4], EXP.Math.vectorAdd(knotPoints[3],[5,-2,0.5]), 2000);
    await presentation.delay(2000);

    //now send each point to a straight line
    var l = knotPoints.length-1;
    for(let i=1; i<knotPoints.length-3;i++){
        presentation.TransitionTo(knotPoints[i], [(i/l)*4-2,0,0], 2000);
    }

    await presentation.nextSlide();
    await presentation.nextSlide();


    //go back to the overhand knot
    presentation.TransitionTo(knotSpline.children[0].children[0], {opacity:0}, 500);
    await presentation.delay(500);
    for(let i=0; i<knotPoints.length;i++){
        presentation.TransitionTo(knotPoints[i], overhandPoints[i], 200);
    }
    await presentation.delay(300);
    presentation.TransitionTo(knotSpline.children[0].children[0], {opacity:1}, 500);


    await presentation.delay(1000);


    let joinPoint = [0,-1,0];
    presentation.TransitionTo(knotPoints[0], joinPoint, 1000);
    presentation.TransitionTo(knotPoints[knotPoints.length-1], joinPoint, 1000);
    presentation.TransitionTo(knotPoints[1], EXP.Math.vectorAdd(joinPoint,[-1.5,0.25,0]), 1000);
    presentation.TransitionTo(knotPoints[knotPoints.length-2], EXP.Math.vectorAdd(joinPoint,[1.5,0.25,0]), 1000);


    //also make the line closed    
    presentation.TransitionTo(knotSpline.children[0], {'expr': (i,t,x) => getCatRomSpline(x, knotPoints, closed=false, endTangentsAsIfClosed=true)}, 1000);
    await presentation.nextSlide();

    //Zoom in on the bonk point
    let bonkPoint = [1,1.5,0];
    presentation.TransitionTo(three.camera.position, {x:0,y:2,z:2}, 1000); //zoom in a bit. TODO: buggy
    presentation.TransitionTo(controls.target, {x:bonkPoint[0],y:bonkPoint[1],z:bonkPoint[2]}, 750, {easing:EXP.Easing.EaseIn});

    presentation.TransitionTo(knotGripPoint.children[0], {opacity: 1.0},1000);

    await presentation.nextSlide();
    
    //it's bonking time!
    //anticipation...
    presentation.TransitionTo(knotPoints[4], EXP.Math.vectorAdd(bonkPoint,[0,0.75,0]), 500);
    await presentation.delay(750);
    //go in for the kill
    presentation.TransitionTo(knotPoints[4], bonkPoint, 750, {easing:EXP.Easing.EaseIn});
    await presentation.delay(751);

    //bounce off!
    presentation.TransitionTo(knotPoints[4], [1,2,0], 750, {easing:EXP.Easing.EaseOut});

    //show bonk effect
    bonkEffect.position.set(...bonkPoint);
    bonkEffect.scale.setScalar(1.0);
    bonkEffect.material.opacity = 0.0;
    presentation.TransitionTo(bonkEffect.material, {'opacity':1.0},200, {easing: EXP.Easing.EaseIn});
    presentation.TransitionTo(bonkEffect.scale, {x:1.3,y:1.3,z:1.3},1000, {easing: EXP.Easing.EaseOut});
    await presentation.delay(200);
    //fade out bonk effect after a bit
    presentation.TransitionTo(bonkEffect.material, {'opacity':0.0},500, {easing: EXP.Easing.EaseOut});

    //todo: make bonk effect better. Star particles? the word "bonk"?


    await presentation.nextSlide();
    //show coordinates for both points
    presentation.TransitionTo(twoDCanvas, {'opacity':1.0},1000);

    await presentation.nextSlide();

    //replay the bonk, this time with coordinates enabled
    presentation.TransitionTo(knotPoints[4], EXP.Math.vectorAdd(bonkPoint,[0,0.75,0]), 500);
    await presentation.delay(750);
    //go in for the kill
    presentation.TransitionTo(knotPoints[4], bonkPoint, 1000);
    presentation.TransitionTo(bonkEffect.scale, {x:1,y:1,z:1},1000);
    await presentation.delay(800);

    //of course, bonk
    presentation.TransitionTo(bonkEffect.material, {'opacity':1.0},200, {easing: EXP.Easing.EaseIn});
    presentation.TransitionTo(bonkEffect.scale, {x:1.3,y:1.3,z:1.3},400, {easing: EXP.Easing.EaseOut});
    //fade out bonk effect after a bit

    await presentation.nextSlide();
    presentation.TransitionTo(bonkEffect.material, {'opacity':0.0},500, {easing: EXP.Easing.EaseOut});

    //move point back to start
    presentation.TransitionTo(knotPoints[4], [...overhandPoints[4],0.0], 750);
    presentation.TransitionTo(knotPoints[9], [...overhandPoints[9],0.0], 750);
    await presentation.delay(750);
    //but what if... fourth dimension
    presentation.TransitionTo(twoDCanvas, {fixedPoint4DSize:1.0,movingPoint4DSize:1.0},1000);

    await presentation.nextSlide();
    presentation.TransitionTo(knotPoints[4], [...overhandPoints[4],3.0], 1000);
    await presentation.nextSlide();

    //replay the bonk
    presentation.TransitionTo(knotPoints[4], [...EXP.Math.vectorAdd(bonkPoint,[0,0.75,0]),3.0], 1000);
    await presentation.delay(1000);
    //go in for the kill... but there's no collision
    presentation.TransitionTo(knotPoints[4], [...bonkPoint,3.0], 750);
    await presentation.delay(751);

    await presentation.nextSlide();
    presentation.TransitionTo(knotPoints[4], [...EXP.Math.vectorAdd(bonkPoint,[0,-0.75,0]),3.0], 1000);
    presentation.TransitionTo(twoDCanvas.movingPointTextOffset, [50,50],1000); //sneakily move the coordinate label further down
    await presentation.delay(1000);
    presentation.TransitionTo(knotPoints[4], EXP.Math.vectorAdd(bonkPoint,[0,-0.75,0]), 1000);
    await presentation.nextSlide();

    //fade out coords
    presentation.TransitionTo(twoDCanvas, {'opacity':0.0},1000);
    presentation.TransitionTo(knotGripPoint.children[0], {opacity: 0.0},1000);

    presentation.TransitionTo(three.camera.position, {x:0,y:0,z:4}, 1000); //zoom out again
    presentation.TransitionTo(controls.target, {x:0,y:1,z:0}, 1000);
    await presentation.delay(1000);

    //show it's an unbroken circle!
    for(let i=0; i<knotPoints.length;i++){
        presentation.TransitionTo(knotPoints[i], finalCirclePoints[i], 2000);
    }


}

window.addEventListener("load",function(){
    setup();
    animate();
});
