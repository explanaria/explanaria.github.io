class FlatManifold{
    constructor(){
        this.points = [];
        this.sides = [];
    }

    draw(){
        for side in sides: side.draw();
    }
}

//things an user can do:
    click square to drag a square into it
    the square snaps to existing sides

    


FROM A POINT: 


class MainSimulation{

    constructor(){
        this.objects = [];
    }

    start(){
        this.canvas2d = document.getElementById("twoDcanvas");
        this.context2d = this.canvas.getContext('2d');

        this.canvas3d = document.getElementById("threeDcanvas");

        this.width = this.canvas2d.width;
        this.height= this.canvas2d.height;
        this.last_t = Date.now() / 1000;

        window.addEventListener("mousemove", this.onmousemove.bind(this));
        window.addEventListener("mousedown", this.onmousedown.bind(this));
        window.addEventListener("mouseup", this.onmouseup.bind(this));

        window.addEventListener("touchmove", this.ontouchmove.bind(this),{'passive':false});
        window.addEventListener("touchstart", this.ontouchstart.bind(this),{'passive':false});
        window.addEventListener("touchend", this.onmouseup.bind(this),{'passive':false});
        window.addEventListener("touchcancel", this.onmouseup.bind(this),{'passive':false});

        //this.objects.push(new FirstNote(this));

        this.update();
    }

    updateCanvasSize(){
        //called every frame. also clears the canvas
        this.canvas2d.width = this.canvas3d.width = this.width = window.innerWidth;
        this.canvas2d.height = this.canvas3d.width = this.height = window.innerHeight;

    }


    ontouchmove(event){
        event.preventDefault();

        let rect = this.canvas.getBoundingClientRect();
        
        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousemove({x: touch.clientX - rect.left, y: touch.clientY- rect.top});
        }

    }

    onmousemove(event){
        let x = event.x;
        let y = event.y;
        for(var i=0;i<this.objects.length;i++){
            this.objects[i].onmousemove(x,y);
            if(dist([x,y],this.objects[i].pos) < 30){
                //hover
                this.objects[i].onhover();
            }
        }
    }

    ontouchstart(event){
        if(event.target == this.canvas)event.preventDefault();

        let rect = this.canvas.getBoundingClientRect();

        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousedown({x: touch.clientX - rect.left, y: touch.clientY- rect.top});
        }
    }

    onmousedown(event){
        let x = event.x;
        let y = event.y;
        for(var i=0;i<this.objects.length;i++){
            this.objects[i].onmousedown(x,y);
            if(dist([x,y],this.objects[i].pos) < 30){
                this.objects[i].clicked = true;
                this.objects[i].onclick();
            }
        }
    }

    onmouseup(event){
        let x = event.x;
        let y = event.y;

        for(var i=0;i<this.objects.length;i++){
           this.objects[i].onmouseup(x,y);
           this.objects[i].clicked = false;
        }
    }

    update(){
        let context = this.context;
        const t = Date.now() / 1000;
        const dt = Math.min(t-this.last_t, 1/30);
        this.last_t = t;

        this.objects = this.objects.filter( (x)=>!x.isDead);

        //draw
        this.updateCanvasSize();
       // context.fillRect(0,0,this.width,this.height);


        for(var i=0;i<this.objects.length;i++){
            this.objects[i].draw(context);
        }
        window.requestAnimationFrame(this.update.bind(this));
    }
}


class GameObject{

    constructor(){

        this.pos = [-50,-50];
        this.clicked = false;
        this.isDead = false;
    }
    
    onclick(){}
    onmouseup(x,y){}
    onmousemove(x,y){}
    onmousedown(x,y){}
    onhover(){}
    update(dt){};

}



