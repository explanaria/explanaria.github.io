export class RotateAboutCenterControls{

    constructor(objects, canvasDomElement){
        this.objects = objects;
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this.enabled = true;

        this.autoRotateSpeed = 0.1;

        this.canvas = canvasDomElement;
        this.addMouseHandler(canvasDomElement);
    }

    onmousemove(x,y) {
        if (!this.mouseDown || !this.enabled) {
            return;
        }

        let deltaX = x - this.mouseX;
        let deltaY = y - this.mouseY;
        this.mouseX = x;
        this.mouseY = y;

        this.rotateScene(deltaX, deltaY);
    }

    onmousedown(x,y) {
        this.mouseDown = true;
        this.mouseX = x;
        this.mouseY = y;
    }


    onmouseup(x,y) {
        this.mouseDown = false;
    }

    addMouseHandler(canvas) {
        canvas.addEventListener('mousemove', this.mousemoveEvt.bind(this), false);
        canvas.addEventListener('mousedown', this.mousedownEvt.bind(this), false);
        canvas.addEventListener('mouseup', this.mouseupEvt.bind(this), false);
        canvas.addEventListener("touchmove", this.ontouchmove.bind(this),{'passive':false});
        canvas.addEventListener("touchstart", this.ontouchstart.bind(this),{'passive':false});
        canvas.addEventListener("touchend", this.ontouchend.bind(this),{'passive':false});
    }

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

    rotateScene(deltaX, deltaY) {
        for(var i=0;i<this.objects.length;i++){
            let object = this.objects[i];
            object.rotation.y += deltaX / 100;
            object.rotation.x += deltaY / 100;
        }
    }

    update(dt){
        if(this.enabled && !this.mouseDown){
            this.rotateScene(this.autoRotateSpeed * 100 * dt, 0);
        }
    }

}
