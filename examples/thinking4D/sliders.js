
class Slider{
    constructor(containerID, valueGetter, valueSetter){

        this.setupCanvas(containerID);
        this.context = this.canvas.getContext("2d");

        this.canvas.height = 150;
        this.canvas.width = 150;

        this.value = 0;
        this.lastValue = 0;

        this.valueGetter = valueGetter; //call every frame to change the display
        this.valueSetter = valueSetter;
        
        this.canvas.addEventListener("mousedown",this.mousedownEvt.bind(this));
        this.canvas.addEventListener("touchstart", this.ontouchstart.bind(this),{'passive':false});

        window.addEventListener("mouseup",this.mouseupEvt.bind(this),false);
        window.addEventListener("touchend", this.ontouchend.bind(this),{'passive':false});

        window.addEventListener("mousemove",this.mousemoveEvt.bind(this),false);
        window.addEventListener("touchmove", this.ontouchmove.bind(this),{'passive':false});


	
        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
        this.onWindowResize();

        //this.update();
    }

    setupCanvas(containerID){
        //setup this.canvas. used in a separate function so subclasses can override it.
        this.canvas = document.createElement("canvas");
        document.getElementById(containerID).appendChild(this.canvas);
    }
    activate(){
        if(this.value != this.lastValue){
            this.valueSetter(this.value);
            this.lastValue = this.value;
        }else{
            this.value = this.valueGetter();
            this.lastValue = this.value;
        }
        
        this.draw();
        //window.requestAnimationFrame(this.update.bind(this)); //ugly but works.
    }
    draw(){}
    onWindowResize() {
        this.width = this.canvas.clientWidth;
        this.canvas.width = this.width;
        this.height = this.canvas.clientHeight;
        this.canvas.height = this.height;
    }
    ontouchstart(event){
        if(event.target == this.canvas){
            event.preventDefault();
        }else{
            return;
        }

        let rect = this.canvas.getBoundingClientRect();

        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousedown(touch.clientX - rect.left, touch.clientY - rect.top);
        }
    }

    ontouchmove(event){
        if(event.target == this.canvas){
            event.preventDefault();
        }
        
        let rect = this.canvas.getBoundingClientRect();

        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousemove(touch.clientX - rect.left, touch.clientY - rect.top);
        }
    }
    ontouchend(event){
        if(event.target == this.canvas)event.preventDefault(); //allow other canvases to also touchend
        
        let rect = this.canvas.getBoundingClientRect();

        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmouseup(touch.clientX - rect.left, touch.clientY - rect.top);
        }
    }

    mousedownEvt(event){
        let rect = this.canvas.getBoundingClientRect();
        let x = event.x - rect.left;
        let y = event.y - rect.top;   

        this.onmousedown(x,y);
    }
    mouseupEvt(event){
        let rect = this.canvas.getBoundingClientRect();
        let x = event.x - rect.left;
        let y = event.y - rect.top;
        this.onmouseup(x,y);    
    }
    mousemoveEvt(event){
        let rect = this.canvas.getBoundingClientRect();
        let x = event.x - rect.left;
        let y = event.y - rect.top;
        this.onmousemove(x,y);
    }
}



class CircleSlider extends Slider{
    constructor(color, containerID, valueGetter, valueSetter){
        super(containerID, valueGetter, valueSetter);
    
        this.dragging = false;
        this.movingExternally = false;
    
        this.pos = [this.canvas.width/2,this.canvas.height/2];

        this.radius = 50;
        this.pointRadius = 15;
        this.pointColor = color

        this.disabled = false;
        this.disabledColor = disabledGray;
   
        this.lineWidth = 10;
        this.onWindowResize();
    }
    onWindowResize(){
        super.onWindowResize();
    
        this.radius = 35 / 100 * this.canvas.width;
        this.pointRadius = 15 /100 * this.canvas.width;
        this.lineWidth = 7/100 * this.canvas.width;
        this.pos = [this.canvas.width/2,this.canvas.height/2];
    }
    draw(){

        //let hueVal = (angle/Math.PI/2 + 0.5)*360;
        //context.fillStyle = "hsl("+hueVal+",50%,50%)";

        this.canvas.width = this.canvas.width;
        this.context.lineWidth = this.lineWidth;

        this.context.strokeStyle = this.pointColor;
        if(this.disabled)this.context.strokeStyle = this.disabledColor;
        this.drawPointTrack();

        this.context.fillStyle = pointColorCanvas
        if(this.dragging){
            this.context.fillStyle = pointColorDragging
        }
        if(!this.disabled)this.drawPoint();
    }

    drawPointTrack(){
        //this.radius = 35 / 100 * this.canvas.width;
        //this.pointRadius = 15 /100 * this.canvas.width;
        drawCircleStroke(this.context, this.pos[0],this.pos[1],this.radius);
    }
    drawPoint(x,y){
        drawCircle(this.context, this.pos[0] + this.radius*Math.cos(this.value), this.pos[1] + this.radius*Math.sin(this.value), this.pointRadius);
    }

    onmousedown(x,y){
        let ptX = this.pos[0] + this.radius*Math.cos(this.value);
        let ptY = this.pos[1] + this.radius*Math.sin(this.value);
        if(dist(x,y, ptX, ptY) < this.pointRadius + 200){
            this.dragging = true;
            this.onmousemove(x,y);
        }
    }
    onmouseup(x,y){
        this.dragging = false;
    }
    angleDiff(a,b){
        const pi2 = Math.PI*2;
        const dist = Math.abs(a-b)%pi2
        return dist > Math.PI ? (pi2-dist) : dist
    }
    onmousemove(x,y){
        if(this.dragging){
            let mouseAngle = Math.atan2(y-this.pos[1],x-this.pos[0]);
            this.value = mouseAngle;
            this.valueSetter(this.value);
        }
    }
}


class RealNumberSlider extends Slider{
    constructor(color, containerID, valueGetter, valueSetter){
        super(containerID, valueGetter, valueSetter);
    
        this.dragging = false;
    
        this.pointRadius = 15;
        this.lineColor = color;
        this.disabledColor = disabledGray;

        this.mode = "horizontal"; //or 'vertical'

        this.onWindowResize();
    }
    onWindowResize(){
        super.onWindowResize();
        this.pos = [this.canvas.width/2,this.canvas.height/2];
        this.pointRadius = 15 /100 * this.canvas.width;
    
        if(this.mode == 'horizontal'){
            this.width = 70 / 100 * this.canvas.width;
            this.lineWidth = 7/100 * this.canvas.width;
        }else{
            this.width = 70 / 100 * this.canvas.height;
            this.lineWidth = 7/100 * this.canvas.height;

        }
    }
    draw(){

        //let hueVal = (angle/Math.PI/2 + 0.5)*360;
        //context.fillStyle = "hsl("+hueVal+",50%,50%)";

        this.canvas.width = this.canvas.width;
        this.context.lineWidth = this.lineWidth;
        this.context.strokeStyle = this.lineColor;

        if(this.disabled)this.context.strokeStyle = this.disabledColor;

        //left arrow

        let arrowHeight = 20;
        let arrowWidth = 20;

        if(this.mode == 'horizontal'){
            drawHorizontalArrow(this.context, this.pos, this.width, arrowWidth, arrowHeight);
        }else{
            drawVerticalArrow(this.context, this.pos, this.width, arrowWidth, arrowHeight);
        }

        //point
        this.context.fillStyle = pointColorCanvas;
        if(this.dragging){
            this.context.fillStyle = pointColorDragging;
        }
        let xCoord = this.value*this.width/2;
        if(!this.disabled){
            if(this.mode == 'horizontal'){
                drawCircle(this.context, this.pos[0] + xCoord, this.pos[1], this.pointRadius);
            }else{
                drawCircle(this.context, this.pos[0], this.pos[1] + xCoord, this.pointRadius);
            }
        }
    }
    onmousedown(x,y){
        let ptX = this.value*this.width/2 + this.pos[0];
        let ptY = this.pos[1]
        if(dist(x,y, ptX, ptY) < this.pointRadius + 200){
            this.dragging = true;
        }
    }
    onmouseup(x,y){
        this.dragging = false;
    }
    onmousemove(x,y){
        if(this.dragging){
            if(this.mode == 'horizontal'){
                this.value = 2*(x - this.pos[0])/(this.width); //-1 to 1
            }else{
                this.value = 2*(y - this.pos[1])/(this.width); 
            }
            this.value = clamp(this.value, -1, 1);//-1 to 1
            this.valueSetter(this.value);
        }
    }
}

function clamp(x,minX,maxX){
    return Math.max(Math.min(x, maxX),minX);
}

class PlaneSlider extends Slider{
    constructor(color, containerID, valueGetter, valueSetter){
        super(containerID, valueGetter, valueSetter);
    
        this.dragging = false;
    
        this.pos = [this.canvas.width/2,this.canvas.height/2];

        this.size = 130;
        this.pointRadius = 15;
        this.lineColor = color;
        this.lineColor2 = color;

        this.values = [0,0];
        this.lastValues = [0,0];

        this.showDraggables = true;

        this.showInvalidCross = false;
        this.invalidCrossPos = [0,0];

        this.maxDraggableRadius = 1; //draggable values will be clamped to -maxradius and +maxradius.
   
        this.onWindowResize();
    }
    onWindowResize(){
        super.onWindowResize();
    
        this.size = this.canvas.width - (this.pointRadius*2);
        this.pointRadius = 15 /100 * this.canvas.width;
        this.pos = [this.canvas.width/2,this.canvas.height/2];
    }
    activate(){
        if(this.lastValues[0] != this.values[0] || this.lastValues[1] != this.values[1]){
            //values changed externally
            this.valueSetter(this.values[0], this.values[1]);
            this.lastValues = this.values;
        }else{
            this.values = this.valueGetter();
            this.lastValues = this.values;
        }
        
        this.draw();
    }
    draw(){

        //let hueVal = (angle/Math.PI/2 + 0.5)*360;
        //context.fillStyle = "hsl("+hueVal+",50%,50%)";

        this.canvas.width = this.canvas.width;

        this.context.lineWidth = 3
        this.context.strokeStyle = this.lineColor;


        //outer border
        let borderWidth = this.maxDraggableRadius * this.canvas.width * 0.9;
        this.context.beginPath();
        this.context.moveTo(this.pos[0]-borderWidth/2, this.pos[1]-borderWidth/2)
        this.context.lineTo(this.pos[0]-borderWidth/2, this.pos[1]+borderWidth/2)
        this.context.lineTo(this.pos[0]+borderWidth/2, this.pos[1]+borderWidth/2)
        this.context.lineTo(this.pos[0]+borderWidth/2, this.pos[1]-borderWidth/2)
        this.context.lineTo(this.pos[0]-borderWidth/2, this.pos[1]-borderWidth/2)
        this.context.lineTo(this.pos[0]-borderWidth/2, this.pos[1]+borderWidth/2) //go again to avoid ugly mitering
        this.context.stroke();

        let axisLength = 0.8 * this.maxDraggableRadius * this.canvas.width;
        //ok, axes time
        this.context.lineWidth = 10 / 150 * this.canvas.width;
        this.context.strokeStyle = this.lineColor;

        let arrowHeight = 20 / 150 * this.canvas.width;
        let arrowWidth = 20 / 150 * this.canvas.width;

        drawHorizontalArrow(this.context, this.pos, axisLength, arrowWidth, arrowHeight);
        this.context.strokeStyle = this.lineColor2;
        drawVerticalArrow(this.context, this.pos, axisLength, arrowWidth, arrowHeight);



        if(this.showDraggables){
            //point
            this.context.fillStyle = pointColorCanvas
            if(this.dragging){
                this.context.fillStyle = pointColorDragging
            }
            let xCoord = this.values[0]*this.size/2;
            let yCoord = this.values[1]*this.size/2;
            drawCircle(this.context, this.pos[0] + xCoord, this.pos[1]+yCoord, this.pointRadius);
        }


        if(this.showInvalidCross){
            this.context.strokeStyle = "HSL(33, 100%, 30%)"
            let crossX = this.pos[0] + this.invalidCrossPos[0]*this.size/2;
            let crossY = this.pos[1] + this.invalidCrossPos[1]*this.size/2;
            let crossWidth = 20;

            this.context.beginPath();
            this.context.moveTo(crossX + crossWidth, crossY+crossWidth);
            this.context.lineTo(crossX - crossWidth, crossY-crossWidth);
            this.context.moveTo(crossX + crossWidth, crossY-crossWidth);
            this.context.lineTo(crossX - crossWidth, crossY+crossWidth);

            this.context.stroke();

        }
    }

    onmousedown(x,y){
        let ptX = this.values[0]*this.size/2 + this.pos[0];
        let ptY = this.values[1]*this.size/2 + this.pos[0];
        if(dist(x,y, ptX, ptY) < this.pointRadius + 200){
            this.dragging = true;
            this.onmousemove(x,y);
        }
    }
    onmouseup(x,y){
        this.dragging = false;
    }
    onmousemove(x,y){
        if(this.dragging){
            let mouseAngle = Math.atan2(y-this.pos[1],x-this.pos[0]);
            this.lastValues = this.values;
            this.values = [
                clamp(2*(x - this.pos[0])/this.size, -this.maxDraggableRadius, this.maxDraggableRadius), //-1 to 1
                clamp(2*(y - this.pos[1])/this.size, -this.maxDraggableRadius, this.maxDraggableRadius),
            ]
            this.valueSetter(this.values[0],this.values[1]);
        }
    }
}

function drawHorizontalArrow(context, pos, lineLength, arrowWidth, arrowHeight){


        context.beginPath();

        //left arrow
        let lineY = pos[1]// + values[1]*axisWidth/2;
        context.moveTo(pos[0]-lineLength/2 + arrowWidth, lineY-arrowHeight)
        context.lineTo(pos[0]-lineLength/2, lineY)
        context.lineTo(pos[0]-lineLength/2 + arrowWidth, lineY+arrowHeight)

        //big line
        context.moveTo(pos[0]-lineLength/2, lineY)
        context.lineTo(pos[0]+lineLength/2, lineY)

        //right arrow
        context.moveTo(pos[0]+lineLength/2 - arrowWidth, lineY-arrowHeight)
        context.lineTo(pos[0]+lineLength/2, lineY)
        context.lineTo(pos[0]+lineLength/2 - arrowWidth,lineY + arrowHeight)

        context.stroke();
}

function drawVerticalArrow(context, pos, lineLength, arrowWidth, arrowHeight){

        //up/down axis now. bottom arrow:
        let lineX = pos[0]// + values[0]*axisWidth/2;
        context.beginPath();
        context.moveTo(lineX-arrowHeight, pos[1]-lineLength/2 + arrowWidth)
        context.lineTo(lineX,pos[1]-lineLength/2)

        context.lineTo(lineX+arrowHeight, pos[1]-lineLength/2 + arrowWidth)

        //big line
        context.moveTo(lineX,pos[1]-lineLength/2)
        context.lineTo(lineX,pos[1]+lineLength/2)

        //top arrow
        context.moveTo(lineX-arrowHeight, pos[1]+lineLength/2 - arrowWidth)
        context.lineTo(lineX,pos[1]+lineLength/2)
        context.lineTo(lineX + arrowHeight,pos[1]+lineLength/2 - arrowWidth)

        context.stroke();
}

//helper func
function drawLine(context, x1,y1,x2,y2){
    context.beginPath();
    context.moveTo(x1,y1);
    context.lineTo(x2,y2);
    context.stroke();
}

function drawArrow(context, x1,y1,x2,y2, arrowSize){
    drawLine(context, x1,y1,x2,y2)

  //pos1 is the back of the midline of the triangle, pos2 the tip
  const size = Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2))
  arrowSize = Math.min(size/3, arrowSize);
  const negativeTriangleDirectionVec = [(x1-x2)/size*arrowSize,(y1-y2)/size*arrowSize];

  const halfTriangleDirectionPerpVec1 = [-negativeTriangleDirectionVec[1]/2*Math.sqrt(3),negativeTriangleDirectionVec[0]/2*Math.sqrt(3)];
  const halfTriangleDirectionPerpVec2 = [negativeTriangleDirectionVec[1]/2*Math.sqrt(3),-negativeTriangleDirectionVec[0]/2*Math.sqrt(3)];
  context.beginPath();
  context.moveTo(x2 + negativeTriangleDirectionVec[0] + halfTriangleDirectionPerpVec1[0], y2 + negativeTriangleDirectionVec[1] + halfTriangleDirectionPerpVec1[1]);
  context.lineTo(x2,y2);
  context.lineTo(x2 + negativeTriangleDirectionVec[0] + halfTriangleDirectionPerpVec2[0], y2 + negativeTriangleDirectionVec[1] + halfTriangleDirectionPerpVec2[1]);
  context.stroke();

}
function drawCircleStroke(context, x,y,radius){
    context.beginPath();
    context.arc(x,y, radius, 0, 2 * Math.PI);
    context.stroke();
}
function drawCircle(context, x,y,radius){
    context.beginPath();
    context.arc(x,y, radius, 0, 2 * Math.PI);
    context.fill();
}
function dist(a,b,c,d){
    return Math.sqrt((b-d)*(b-d)+(c-a)*(c-a))
}
function clamp(val, min, max){
    return Math.min(Math.max(val, min),max);
}






class CirclePlaneSlider extends PlaneSlider{
    //a PlaneSlider but restricted to the interior of a disk.
    constructor(color, containerID, valueGetter, valueSetter){
        super(color, containerID, valueGetter, valueSetter);
        this.maxDraggableRadius = 1;
    }
    draw(){

        this.canvas.width = this.canvas.width;

        this.context.lineWidth = 3
        this.context.strokeStyle = this.lineColor;

        //outer border is a circle
        let borderWidth = this.maxDraggableRadius * this.canvas.width -this.pointRadius;
        drawCircleStroke(this.context, this.pos[0], this.pos[1], borderWidth/2);

        let axisLength = 0.6 * this.maxDraggableRadius * this.canvas.width;
        //ok, axes time
        this.context.lineWidth = 10 / 150 * this.canvas.width;
        this.context.strokeStyle = this.lineColor;

        let arrowHeight = 20 / 150 * this.canvas.width;
        let arrowWidth = 20 / 150 * this.canvas.width;

        drawHorizontalArrow(this.context, this.pos, axisLength, arrowWidth, arrowHeight);
        drawVerticalArrow(this.context, this.pos, axisLength, arrowWidth, arrowHeight);

        if(this.showDraggables){
            //point
            this.context.fillStyle = pointColorCanvas
            if(this.dragging){
                this.context.fillStyle = pointColorDragging
            }
            let xCoord = this.values[0]*this.size/2;
            let yCoord = this.values[1]*this.size/2;
            drawCircle(this.context, this.pos[0] + xCoord, this.pos[1]+yCoord, this.pointRadius);
        }

        if(this.showInvalidCross){
            this.context.strokeStyle = "HSL(33, 100%, 30%)"
            let crossX = this.pos[0] + this.invalidCrossPos[0]*this.size/2;
            let crossY = this.pos[1] + this.invalidCrossPos[1]*this.size/2;
            let crossWidth = 20;

            this.context.beginPath();
            this.context.moveTo(crossX + crossWidth, crossY+crossWidth);
            this.context.lineTo(crossX - crossWidth, crossY-crossWidth);
            this.context.moveTo(crossX + crossWidth, crossY-crossWidth);
            this.context.lineTo(crossX - crossWidth, crossY+crossWidth);
            this.context.stroke();
        }
    }

    activate(){
        if(this.dragging){
            this.showDraggables = true;
        }else{
            this.values = this.valueGetter();
            this.lastValues = this.values;

            let radius = dist(this.values[0],this.values[1], 0,0);

            if(radius < 0 || radius > 1){
                this.showDraggables = false;
            }else{
                this.showDraggables = true;
            }
        }
        
        this.draw();
    }

    onmousedown(x,y){
        this.dragging = true;
        this.onmousemove(x,y);
    }
    onmousemove(x,y){
        if(this.dragging){
            let mouseAngle = Math.atan2(y-this.pos[1],x-this.pos[0]);
            let radius = dist(x,y, this.pos[0], this.pos[1])/(this.size/2);

            radius = clamp(radius, 0, this.maxDraggableRadius); //clamp to within circle

            this.lastValues = this.values;
            this.values = [
                Math.cos(mouseAngle)*radius,
                Math.sin(mouseAngle)*radius,
            ]
            this.valueSetter(this.values[0],this.values[1]);
        }
    }
}


