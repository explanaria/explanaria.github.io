
class CircleSlider{
    constructor(color, containerID, valueGetter, valueSetter){

        this.canvas = document.createElement("canvas");
        document.getElementById(containerID).appendChild(this.canvas);

        this.context = this.canvas.getContext("2d");

        this.canvas.height = 150;
        this.canvas.width = 150;

        this.valueGetter = valueGetter; //call every frame to change the display
        this.valueSetter = valueSetter;

    
        this.dragging = false;
        this.pointAngle = 0;
    
        this.pos = [this.canvas.width/2,this.canvas.height/2];

        this.radius = 50;
        this.pointRadius = 20;
        this.pointColor = color

        
        this.canvas.addEventListener("mousedown",this.onmousedown.bind(this));
        this.canvas.addEventListener("mouseup",this.onmouseup.bind(this));
        this.canvas.addEventListener("mousemove",this.onmousemove.bind(this));
        this.canvas.addEventListener("touchmove", this.ontouchmove.bind(this),{'passive':false});
        this.canvas.addEventListener("touchstart", this.ontouchstart.bind(this),{'passive':false});

        //this.update();
    }
    activate(){
        if(this.dragging){
            this.valueSetter(this.pointAngle);
        }else{
            this.pointAngle = this.valueGetter();
        }
        
        this.draw();
        //window.requestAnimationFrame(this.update.bind(this)); //ugly but works.
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
        drawCircle(this.context, this.pos[0] + this.radius*Math.cos(this.pointAngle), this.pos[1] + this.radius*Math.sin(this.pointAngle), this.pointRadius);
    }
    ontouchstart(event){
        if(event.target == this.canvas)event.preventDefault();

        let rect = this.canvas.getBoundingClientRect();

        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousedown({x: touch.clientX, y: touch.clientY});
        }
    }

    ontouchmove(event){
        event.preventDefault();

        let rect = this.canvas.getBoundingClientRect();
        
        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousemove({x: touch.clientX, y: touch.clientY});
        }
    }

    onmousedown(event){
        let rect = this.canvas.getBoundingClientRect();
        let x = event.x - rect.left;
        let y = event.y - rect.top;        

        let ptX = this.pos[0] + this.radius*Math.cos(this.pointAngle);
        let ptY = this.pos[1] + this.radius*Math.sin(this.pointAngle);
        console.log(dist(x,y, ptX, ptY));
        if(dist(x,y, ptX, ptY) < (this.pointRadius*this.pointRadius) + 10){
            this.dragging = true;
        }
    }
    onmouseup(event){
        this.dragging = false;
    }
    angleDiff(a,b){
        const pi2 = Math.PI*2;
        const dist = Math.abs(a-b)%pi2
        return dist > Math.PI ? (pi2-dist) : dist
    }
    onmousemove(event){
        let rect = this.canvas.getBoundingClientRect();
        let x = event.x - rect.left;
        let y = event.y - rect.top;
        //convert mouse angle to this

        if(this.dragging){
            let mouseAngle = Math.atan2(y-this.pos[1],x-this.pos[0]);
            this.pointAngle = mouseAngle;
            this.valueSetter(this.pointAngle);
        }
    }
}

/*
class R1Slider{
    constructor(color, containerID, valueGetter, valueSetter){

        this.canvas = document.createElement("canvas");
        document.getElementById(containerID).appendChild(this.canvas);

        this.context = this.canvas.getContext("2d");

        this.canvas.height = 150;
        this.canvas.width = 150;

        this.valueGetter = valueGetter; //call every frame to change the display
        this.valueSetter = valueSetter;

    
        this.dragging = false;
        this.pointAngle = 0;
    
        this.pos = [this.canvas.width/2,this.canvas.height/2];

        this.width = 50;
        this.pointRadius = 20;
        this.pointColor = color

        
        this.canvas.addEventListener("mousedown",this.onmousedown.bind(this));
        this.canvas.addEventListener("mouseup",this.onmouseup.bind(this));
        this.canvas.addEventListener("mousemove",this.onmousemove.bind(this));
        this.canvas.addEventListener("touchmove", this.ontouchmove.bind(this),{'passive':false});
        this.canvas.addEventListener("touchstart", this.ontouchstart.bind(this),{'passive':false});

        //this.update();
    }
    activate(){
        if(this.dragging){
            this.valueSetter(this.pointAngle);
        }else{
            this.pointAngle = this.valueGetter();
        }
        
        this.draw();
        //window.requestAnimationFrame(this.update.bind(this)); //ugly but works.
    }
    draw(){

        //let hueVal = (angle/Math.PI/2 + 0.5)*360;
        //context.fillStyle = "hsl("+hueVal+",50%,50%)";

        this.canvas.width = this.canvas.width;
        this.context.lineWidth = 10;

        this.context.strokeStyle = this.pointColor;
        this.context.moveTo(this.
        drawCircleStroke(this.context, this.pos[0],this.pos[1],this.radius);

        this.context.fillStyle = "orange"
        if(this.dragging){
            this.context.fillStyle = "darkorange"
        }
        drawCircle(this.context, this.pos[0] + this.radius*Math.cos(this.pointAngle), this.pos[1], this.pointRadius);
    }
    ontouchstart(event){
        if(event.target == this.canvas)event.preventDefault();

        let rect = this.canvas.getBoundingClientRect();

        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousedown({x: touch.clientX - rect.left, y: touch.clientY- rect.top});
        }
    }

    ontouchmove(event){
        event.preventDefault();

        let rect = this.canvas.getBoundingClientRect();
        
        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousemove({x: touch.clientX - rect.left, y: touch.clientY- rect.top});
        }
    }

    onmousedown(event){
        let x = event.x;
        let y = event.y;
        let ptX = this.pos[0] + this.radius*Math.cos(this.pointAngle);
        let ptY = this.pos[1] + this.radius*Math.sin(this.pointAngle);
        console.log(dist(x,y, ptX, ptY));
        if(dist(x,y, ptX, ptY) < (this.pointRadius*this.pointRadius) + 10){
            this.dragging = true;
        }
    }
    onmouseup(event){
        this.dragging = false;
    }
    angleDiff(a,b){
        const pi2 = Math.PI*2;
        const dist = Math.abs(a-b)%pi2
        return dist > Math.PI ? (pi2-dist) : dist
    }
    onmousemove(event){
        let x = event.x;
        let y = event.y;
        //convert mouse angle to this

        if(this.dragging){
            let mouseAngle = Math.atan2(y-this.pos[1],x-this.pos[0]);
            this.pointAngle = mouseAngle;
            this.valueSetter(this.pointAngle);
        }
    }
}

*/


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

