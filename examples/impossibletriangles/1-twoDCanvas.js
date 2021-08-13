
class overlayCanvas{
    constructor(canvasID){
        this.canvas = document.getElementById(canvasID);
        this.context = this.canvas.getContext("2d");

        window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
        this.onWindowResize();

        this.opacity = 0;
        this.maxFontSize = 48;

        //app-specific settings
    }
    onWindowResize(){
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
    
        this.maxFontSize = Math.max(24, Math.min(48, Math.min(this.canvas.width, this.canvas.height)/20));
    }
    calcFontSize(relativeFraction){
        return relativeFraction * this.maxFontSize;
    }
    activate(t){
        this.onWindowResize(); //also clears canvas

        this.context.fillStyle = 'rgba(255,255,255,0.0)';
        this.context.fillRect(0,0,this.canvas.width, this.canvas.height);
        this.canvas.style.opacity = this.opacity;

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
    drawText(text, textX, textY, fillStyle){
        let metrics = this.context.measureText(text);
        //draw a transparent rectangle under the text
        this.context.fillStyle = "rgba(255,255,255,0.9)"
        this.context.fillRect(textX, textY-38, metrics.width, 52);

        this.context.fillStyle = fillStyle;

        this.context.fillText(text, textX, textY);
    }
}


let canvas = null;
function get2DCanvas(){
    if(canvas == null)setup2DCanvas();
    return canvas;
}

function setup2DCanvas(){
    console.log("Setting up 2D canvas");
    canvas = new overlayCanvas("2dcanvas"); //todo: do some fancy injecting and CSS so it's directly positioned over the 3D canvas with no mouse events
    return canvas;
}

/*
Dynamic3DText using a 2D drawn-on-canvas implementation*/
class Dynamic3DText{
    //text positioned in 3D space, but always perpendicular to the camera.
    //able to change its position
    //actually drawn in 2D on a canvas

    //currently does NOT change its size based on depth
    constructor(options){

        /* position3D: function(t) -> [x,y,z]. position in 3D space where the text pretends to be placed at
        text: function(t) -> [x,y,z] or string. What to write
        color: color (todo)
        align: "right" or "top" or "bottom" or "left" or "center" (todo). relationship to its position3D. whether the text should display to the right of that point, or left, or centered on it
        */
           
        this.position3D = options.position3D; 
        this.text = options.text; 
        this.canvas = get2DCanvas();
        this.roundingDecimals = 2;

    }
    activate(t){
        
        if(this.position3D.constructor == Function){
            this._position3D = this.position3D(t);
        }else{
            this._position3D = this.position3D;
        }
        
        this.position2D = this.canvas.screenSpaceCoordsOfPoint(this._position3D);

        //figure out what text to display
        if(this.text.constructor == String){
            this._text = this.text;
        }else if(this.text.constructor == Function){
            this._text = this.text(t);
            if(this._text.constructor == Number){ //function which returns a number
                this._text = this.format(this._text)
            }
        }else if(this.text.constructor == Number){ //text IS a number
            this._text = this.format(this.text)
        }

        this.draw(); //does this go here?
    }

    format(x, precision=2){
        if(x%1 == 0){ //if is integer
            return x;            
        }
        return Number(x).toFixed(2);
    }
    draw(){
        this.canvas.drawText(this._text, this.position2D[0], this.position2D[1], "black")
    }
}

/*


let x = new Dynamic3DText({
    text: (t) => trianglePoints[0]}, 
    position3D: (t) => EXP.Utils.vecAdd(EXP.Utils.vecAdd(trianglePoints[0] + trianglePoints[1]), EXP.Utils.vecScale(trianglePoints[2], -0.3))
})*/

export {Dynamic3DText, setup2DCanvas};
