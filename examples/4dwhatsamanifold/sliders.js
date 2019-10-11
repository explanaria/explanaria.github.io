
class Slider{
    constructor(containerID, valueGetter, valueSetter){

        this.setupCanvas(containerID);
        this.context = this.canvas.getContext("2d");

        this.canvas.height = 150;
        this.canvas.width = 150;

        this.value = 0;

        this.valueGetter = valueGetter; //call every frame to change the display
        this.valueSetter = valueSetter;
        
        this.canvas.addEventListener("mousedown",this.mousedownEvt.bind(this));
        window.addEventListener("mouseup",this.mouseupEvt.bind(this));
        this.canvas.addEventListener("mousemove",this.mousemoveEvt.bind(this));
        this.canvas.addEventListener("touchmove", this.ontouchmove.bind(this),{'passive':false});
        this.canvas.addEventListener("touchstart", this.ontouchstart.bind(this),{'passive':false});
        this.canvas.addEventListener("touchend", this.ontouchend.bind(this),{'passive':false});

        //this.update();
    }
    setupCanvas(containerID){
        //setup this.canvas. used in a separate function so subclasses can override it.
        this.canvas = document.createElement("canvas");
        document.getElementById(containerID).appendChild(this.canvas);
    }
    activate(){
        if(this.dragging){
            this.valueSetter(this.value);
        }else{
            this.value = this.valueGetter();
        }
        
        this.draw();
        //window.requestAnimationFrame(this.update.bind(this)); //ugly but works.
    }
    draw(){}
    ontouchstart(event){
        if(event.target == this.canvas)event.preventDefault();

        let rect = this.canvas.getBoundingClientRect();

        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousedown(touch.clientX - rect.left, touch.clientY - rect.top);
        }
    }

    ontouchmove(event){
        event.preventDefault();
        
        let rect = this.canvas.getBoundingClientRect();

        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousemove(touch.clientX - rect.left, touch.clientY - rect.top);
        }
    }
    ontouchend(event){
        event.preventDefault();
        
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
    
        this.pos = [this.canvas.width/2,this.canvas.height/2];

        this.radius = 50;
        this.pointRadius = 20;
        this.pointColor = color
    }
    draw(){

        //let hueVal = (angle/Math.PI/2 + 0.5)*360;
        //context.fillStyle = "hsl("+hueVal+",50%,50%)";

        this.canvas.width = this.canvas.width;
        this.context.lineWidth = 10;

        this.context.strokeStyle = this.pointColor;
        drawCircleStroke(this.context, this.pos[0],this.pos[1],this.radius);

        this.context.fillStyle = "orange"
        if(this.dragging){
            this.context.fillStyle = "darkorange"
        }
        drawCircle(this.context, this.pos[0] + this.radius*Math.cos(this.value), this.pos[1] + this.radius*Math.sin(this.value), this.pointRadius);
    }
    onmousedown(x,y){
        let ptX = this.pos[0] + this.radius*Math.cos(this.value);
        let ptY = this.pos[1] + this.radius*Math.sin(this.value);
        if(dist(x,y, ptX, ptY) < (this.pointRadius*this.pointRadius) + 10){
            this.dragging = true;
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
    
        this.pos = [this.canvas.width/2,this.canvas.height/2];

        this.width = 100;
        this.pointRadius = 20;
        this.lineColor = color;
    }
    draw(){

        //let hueVal = (angle/Math.PI/2 + 0.5)*360;
        //context.fillStyle = "hsl("+hueVal+",50%,50%)";

        this.canvas.width = this.canvas.width;
        this.context.lineWidth = 10
        this.context.strokeStyle = this.lineColor;

        //left arrow

        let arrowHeight = 20;
        let arrowWidth = 20;

        this.context.beginPath();

        this.context.moveTo(this.pos[0]-this.width/2 + arrowWidth, this.pos[1]-arrowHeight)
        this.context.lineTo(this.pos[0]-this.width/2, this.pos[1])

        this.context.lineTo(this.pos[0]-this.width/2 + arrowWidth, this.pos[1]+arrowHeight)

        //big line
        this.context.moveTo(this.pos[0]-this.width/2, this.pos[1])
        this.context.lineTo(this.pos[0]+this.width/2, this.pos[1])

        //right arrow
        this.context.moveTo(this.pos[0]+this.width/2 - arrowWidth, this.pos[1]-arrowHeight)
        this.context.lineTo(this.pos[0]+this.width/2, this.pos[1])

        this.context.lineTo(this.pos[0]+this.width/2 - arrowWidth, this.pos[1]+arrowHeight)
        this.context.stroke();

        drawCircleStroke(this.context, this.value*this.width/2 + this.pos[0],this.pos[1],this.radius);

        //point
        this.context.fillStyle = "orange"
        if(this.dragging){
            this.context.fillStyle = "darkorange"
        }
        let xCoord = this.value*this.width/2;
        drawCircle(this.context, this.pos[0] + xCoord, this.pos[1], this.pointRadius);
    }
    onmousedown(x,y){
        let ptX = this.value*this.width/2 + this.pos[0];
        let ptY = this.pos[1]
        if(dist(x,y, ptX, ptY) < (this.pointRadius*this.pointRadius) + 10){
            this.dragging = true;
        }
    }
    onmouseup(x,y){
        this.dragging = false;
    }
    onmousemove(x,y){
        if(this.dragging){
            let mouseAngle = Math.atan2(y-this.pos[1],x-this.pos[0]);
            this.value = 2*(x - this.pos[0])/this.width; //-1 to 1
            this.valueSetter(this.value);
        }
    }
}

class PlaneSlider extends Slider{
    constructor(color, containerID, valueGetter, valueSetter){
        super(containerID, valueGetter, valueSetter);
    
        this.dragging = false;
    
        this.pos = [this.canvas.width/2,this.canvas.height/2];

        this.size = 130;
        this.pointRadius = 20;
        this.lineColor = color;

        this.values = [0,0];
        this.lastValues = [0,0];

        this.showDraggables = true;

        this.showInvalidCross = false;
        this.invalidCrossPos = [0,0];

        this.maxDraggableRadius = 1; //draggable values will be clamped to -maxradius and +maxradius.
    }
    activate(){
        if(this.dragging){
            this.valueSetter(this.values[0], this.values[1]);
        }else{
            this.values = this.valueGetter();
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
        this.context.beginPath();
        this.context.moveTo(this.pos[0]-this.size/2, this.pos[1]-this.size/2)
        this.context.lineTo(this.pos[0]-this.size/2, this.pos[1]+this.size/2)
        this.context.lineTo(this.pos[0]+this.size/2, this.pos[1]+this.size/2)
        this.context.lineTo(this.pos[0]+this.size/2, this.pos[1]-this.size/2)
        this.context.lineTo(this.pos[0]-this.size/2, this.pos[1]-this.size/2)
        this.context.lineTo(this.pos[0]-this.size/2, this.pos[1]+this.size/2) //go again to avoid ugly mitering
        this.context.stroke();

            //ok, axes time
            this.context.lineWidth = 10
            this.context.strokeStyle = this.lineColor;

            let arrowHeight = 20;
            let arrowWidth = 20;

            this.context.beginPath();

            //left arrow
            let lineY = this.pos[1]// + this.values[1]*this.size/2;
            this.context.moveTo(this.pos[0]-this.size/2 + arrowWidth, lineY-arrowHeight)
            this.context.lineTo(this.pos[0]-this.size/2, lineY)
            this.context.lineTo(this.pos[0]-this.size/2 + arrowWidth, lineY+arrowHeight)

            //big line
            this.context.moveTo(this.pos[0]-this.size/2, lineY)
            this.context.lineTo(this.pos[0]+this.size/2, lineY)

            //right arrow
            this.context.moveTo(this.pos[0]+this.size/2 - arrowWidth, lineY-arrowHeight)
            this.context.lineTo(this.pos[0]+this.size/2, lineY)
            this.context.lineTo(this.pos[0]+this.size/2 - arrowWidth,lineY + arrowHeight)

            //up/down axis now. bottom arrow:
            let lineX = this.pos[0]// + this.values[0]*this.size/2;
            this.context.moveTo(lineX-arrowHeight, this.pos[1]-this.size/2 + arrowWidth)
            this.context.lineTo(lineX,this.pos[1]-this.size/2)

            this.context.lineTo(lineX+arrowHeight, this.pos[1]-this.size/2 + arrowWidth)

            //big line
            this.context.moveTo(lineX,this.pos[1]-this.size/2)
            this.context.lineTo(lineX,this.pos[1]+this.size/2)

            //top arrow
            this.context.moveTo(lineX-arrowHeight, this.pos[1]+this.size/2 - arrowWidth)
            this.context.lineTo(lineX,this.pos[1]+this.size/2)
            this.context.lineTo(lineX + arrowHeight,this.pos[1]+this.size/2 - arrowWidth)

            this.context.stroke();

        if(this.showDraggables){
            //point
            this.context.fillStyle = "orange"
            if(this.dragging){
                this.context.fillStyle = "darkorange"
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
        if(dist(x,y, ptX, ptY) < (this.pointRadius*this.pointRadius) + 10){
            this.dragging = true;
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

//helper func
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

