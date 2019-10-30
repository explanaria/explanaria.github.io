
//represent
class twoDCoordIntroScene{
    constructor(canvasID){
        this.canvas = document.getElementById(canvasID);
        this.context = this.canvas.getContext("2d");

        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
        this.onWindowResize();

        this.opacity = 1;

        this.cartesianOpacity = 1;
        this.cartesianPointOutArrowsOpacity = 0;
        this.showLonesomePoint = true;
        this.cartesianBreakdownLerpFactor = 0;
        this.polarOpacity = 0;

    }
    onWindowResize(){
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;

    }
    activate(t){
        this.canvas.width = this.canvas.width;

        this.context.fillStyle = '#ffffff';
        this.context.fillRect(0,0,this.canvas.width, this.canvas.height);
        this.canvas.style.opacity = this.opacity;

        let centerPos = [this.canvas.width/2, this.canvas.height/2];



        let lineLength = Math.min(Math.min(this.canvas.width, this.canvas.height)*2/3, 500);
        this.pointWanderingRadius = (lineLength/2 * 4/5);
        let pointPos = [this.pointWanderingRadius * Math.sin(t/3), this.pointWanderingRadius*Math.sin(t/5)];
    

        //the arrows connecting [0,0] and [0,x] and [x,y]
        this.context.globalAlpha = this.cartesianPointOutArrowsOpacity;
        this.draw2DCartesianArrows(t, pointPos);

        this.context.globalAlpha = this.cartesianOpacity;
        if(this.cartesianBreakdownLerpFactor == 0){
            this.draw2DCoordinates(t, pointPos);
            this.drawCartesianText(t, centerPos, pointPos);
    
        }else{
            this.draw2DCoordinatesButNextToOneAnother(t, centerPos, pointPos);
        }
        

        this.context.globalAlpha = this.polarOpacity;
        this.drawPolarCoordinates(t, pointPos);
        this.drawPolarText(t, centerPos, pointPos);

       
        this.context.globalAlpha = 1;

        if(this.showLonesomePoint){

            this.context.fillStyle = pointColorCanvas;
            drawCircle(this.context, centerPos[0]+pointPos[0],centerPos[1]+pointPos[1],20);
        }
    }
    draw2DCoordinates(t, pointPos){
        let pos = [this.canvas.width/2, this.canvas.height/2];

        let lineLength = Math.min(Math.min(this.canvas.width, this.canvas.height)*2/3, 500);

        this.context.lineWidth = 10;


        this.context.strokeStyle = coordinateLine1Color;
        drawVerticalArrow(this.context, pos, lineLength, 20, 20);
        this.context.strokeStyle = coordinateLine2Color;
        drawHorizontalArrow(this.context, pos, lineLength, 20, 20);

        //point    
        this.context.fillStyle = pointColorCanvas;
        drawCircle(this.context, pos[0]+pointPos[0],pos[1]+pointPos[1],20);

    }
    draw2DCartesianArrows(t, pointPos){
        let pos = [this.canvas.width/2, this.canvas.height/2];
        //lines to point
        this.context.lineWidth = 10;
        this.context.strokeStyle = coordinateLine2Color;
        drawArrow(this.context, pos[0], pos[1], pos[0] + pointPos[0], pos[1], 30);
        this.context.strokeStyle = coordinateLine1Color;
        drawArrow(this.context, pos[0]+ pointPos[0], pos[1], pos[0] + pointPos[0], pos[1]+ pointPos[1], 30);
    }

    draw2DCoordinatesButNextToOneAnother(t, centerPos, pointPos){
        //as two R copies independent of each other. slide 2, effectively
        let halfLineLength = Math.min(Math.min(this.canvas.width, this.canvas.height)*2/3, 500)/2;
        this.context.lineWidth = 10;

        //THIS FUNCTION IS ALL WRONG. I'm doing my animation internally instead of externally using EXP.TransitionTo. UGH HAD I REALIZED I COULD HAVE SAVED SO MUCH WORK

        //for smooth animation, I'm lerping from their starting point on the previous frame
        //to where they should be now.
        let lerpTo = (x,y) => EXP.Math.lerpVectors(this.cartesianBreakdownLerpFactor, x,y);
        let lerpNumbers = (x,y) => x * (this.cartesianBreakdownLerpFactor) + y*(1-this.cartesianBreakdownLerpFactor);

        let vectorAdd = EXP.Math.vectorAdd;

        //axis 1
        let lineY = centerPos[1];
        let lineX = centerPos[0];
        let newCenterPos1 = [lineX, lineY - this.canvas.height/10];
        let newCenterPos2 = [lineX, lineY + this.canvas.height/10];

        let axis1LineStart = lerpTo(newCenterPos1, centerPos);
        
        this.context.strokeStyle = coordinateLine2Color;
        drawArrow(this.context, axis1LineStart[0],axis1LineStart[1],axis1LineStart[0]+halfLineLength,axis1LineStart[1], 20);
        drawArrow(this.context, axis1LineStart[0],axis1LineStart[1],axis1LineStart[0]-halfLineLength,axis1LineStart[1], 20);
        drawLine(this.context, axis1LineStart[0], axis1LineStart[1]-10, axis1LineStart[0], axis1LineStart[1]+10); //small zero

        //point1 representation
        let point1Pos = [pointPos[0] + newCenterPos1[0], newCenterPos1[1]];
        point1Pos = lerpTo(point1Pos, vectorAdd(centerPos,pointPos));
        this.context.fillStyle = pointColorCanvas;
        drawCircle(this.context, point1Pos[0],point1Pos[1],20);

        //axis 2
        this.context.strokeStyle = coordinateLine1Color; //regrettably inverted

        let axis2LineStart = lerpTo(newCenterPos2, centerPos);
        let yUpArrowEnd = lerpTo([axis2LineStart[0]+halfLineLength,axis2LineStart[1]], [centerPos[0], centerPos[1] - halfLineLength]);
        let yDownArrowEnd = lerpTo([axis2LineStart[0]-halfLineLength,axis2LineStart[1]], [centerPos[0], centerPos[1] + halfLineLength]);
        drawArrow(this.context, axis2LineStart[0],axis2LineStart[1],yUpArrowEnd[0],yUpArrowEnd[1], 20);
        drawArrow(this.context, axis2LineStart[0],axis2LineStart[1],yDownArrowEnd[0],yDownArrowEnd[1], 20);
        drawLine(this.context, axis2LineStart[0], axis2LineStart[1]-10, axis2LineStart[0], axis2LineStart[1]+10); //small zero

        //point2 representation
        let point2Pos = [-pointPos[1] + newCenterPos2[0], newCenterPos2[1]];
        point2Pos = lerpTo(point2Pos,vectorAdd(centerPos,pointPos));
        this.context.fillStyle = pointColorCanvas;
        drawCircle(this.context, point2Pos[0],point2Pos[1],20);

        //coordinates
        let textOffset = lerpTo([-100, this.canvas.height/10 *3],[50,-50]);
        let textPos = lerpTo(centerPos, vectorAdd(pointPos, centerPos));
        this.drawTwoCoordinates(textPos, [pointPos[0]/this.pointWanderingRadius, -pointPos[1]/this.pointWanderingRadius],textOffset);

    }
    drawCartesianText(t, pos, pointPos){
        this.drawTwoCoordinates([pos[0]+pointPos[0],pos[1]+pointPos[1]], [pointPos[0]/this.pointWanderingRadius, -pointPos[1]/this.pointWanderingRadius]);
    }
    drawPolarText(t, pos, pointPos){
        const size = Math.sqrt(pointPos[1]*pointPos[1] + pointPos[0]*pointPos[0])
        let angle = Math.atan2(pointPos[1],pointPos[0]);
        angle = (angle+(Math.PI*2))%(Math.PI*2)
        this.drawTwoCoordinates([pos[0]+pointPos[0],pos[1]+pointPos[1]], [size/100, angle]);
    }
    drawTwoCoordinates(pos, coordinates, offset=[50,-50]){
        this.context.font = "48px Computer Modern Serif";

        let allStrings = ['[',format(coordinates[0]),',',format(coordinates[1]),']'];

        let textX = pos[0] + offset[0];
        let textY = pos[1] + offset[1];
        for(let i=0;i<allStrings.length;i++){

            let metrics = this.context.measureText(allStrings[i]);

            //draw a transparent rectangle under the text
            this.context.fillStyle = "rgba(255,255,255,0.9)"
            this.context.fillRect(textX, textY-38, metrics.width, 52);

            if(i == 1){this.context.fillStyle = coordinateLine2Color;}
            else if(i == 3){this.context.fillStyle = coordinateLine1Color}
            else{this.context.fillStyle = '#444';}

            this.context.fillText(allStrings[i], textX, textY);

            textX += metrics.width;
        }
    }
    drawPolarCoordinates(t, pointPos){
        let pos = [this.canvas.width/2, this.canvas.height/2];

        let lineLength = Math.min(Math.min(this.canvas.width, this.canvas.height)*2/3, 500);

        this.context.lineWidth = 10;


        this.context.strokeStyle = 'rgba(170,170,170, 0.5)';
        drawVerticalArrow(this.context, pos, lineLength, 20, 20,);
        drawHorizontalArrow(this.context, pos, lineLength, 20, 20);


        this.context.strokeStyle = 'white';
        //drawArrow(this.context, pos[0], pos[1], pos[0] + 150, pos[1], 30);

        //axis 1: arc
        const size = Math.sqrt(pointPos[1]*pointPos[1] + pointPos[0]*pointPos[0])
        let angle = Math.atan2(pointPos[1],pointPos[0]);
        let radius = Math.min(100, size*2/3); //show circle smaller than 100px if angle is smaller than 100px
        
        this.context.strokeStyle = coordinateLine1Color;
        this.context.beginPath();
        this.context.arc(pos[0],pos[1], radius, 0, angle);
        this.context.stroke();

        //arrow straight to the point
        this.context.strokeStyle = coordinateLine2Color;
        drawArrow(this.context, pos[0], pos[1], pos[0] + pointPos[0], pos[1]+ pointPos[1], 30);

        //point    
        this.context.fillStyle = pointColorCanvas;
        drawCircle(this.context, pos[0]+pointPos[0],pos[1]+pointPos[1],20);
    }
}

