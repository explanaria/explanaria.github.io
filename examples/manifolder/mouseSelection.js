class MouseHandler{
    constructor(canvasDOMElement){
        this.canvas = canvasDOMElement;
        this.objects = [];
        window.addEventListener("mousemove",this.onmousemove.bind(this));
        window.addEventListener("touchmove",this.ontouchmove.bind(this));
        this.raycaster = new THREE.Raycaster();
    }
    onmousemove(){
    }
    ontouchmove(){
    }
}

export default MouseHandler;
