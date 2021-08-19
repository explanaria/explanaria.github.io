import katex from './dist/katex-v0.13.13/katex.mjs';

function cssDropShadowOutline(blurRadius="0.05rem", color='#0005', moveRadius="0.15rem"){
    return "drop-shadow("+moveRadius+" 0 "+blurRadius+" "+color+") drop-shadow(0 "+moveRadius+" "+blurRadius+" "+color+") drop-shadow(-"+moveRadius+" 0 "+blurRadius+" "+color+") drop-shadow(0 -"+moveRadius+" "+blurRadius+" "+color+")"
}

function makeLabel(frostedBG=false){
    let parent = document.getElementById("canvasContainer");
    let positioningElem = document.createElement("div");
    positioningElem.style.position = "absolute";
    positioningElem.style.transform="translate(-50%, -50%)";
    if(frostedBG){
        //positioningElem.style.backgroundColor="rgba(255,255,255,0.3)";
        positioningElem.style.filter=cssDropShadowOutline("0.15rem",'#0002', "0.15rem"); //soft gray shadow
        //positioningElem.style.filter=cssDropShadowOutline("0.15rem",'#0008', "0.15rem"); //soft gray shadow
        //positioningElem.style.filter=cssDropShadowOutline("0.05rem",'#000f', "0.05rem"); //harder black shadow
    }
    positioningElem.style.fontSize="24px"; //might need changing
    positioningElem.style.pointerEvents="none";
    positioningElem.className = "EXP-textlabel"
    parent.appendChild(positioningElem);

    return positioningElem;
}

//let three = xxxx;
function screenSpaceCoordsOf3DPoint(point){
    three.camera.matrixWorldNeedsUpdate = true;
    let vec = new THREE.Vector3(...point).applyMatrix4(three.camera.matrixWorldInverse).applyMatrix4(three.camera.projectionMatrix)
    let arr = vec.toArray(); 
    arr[0] = (arr[0]+1)/2 * three.renderer.domElement.width;
    arr[1] = (-arr[1]+1)/2 * three.renderer.domElement.height;
    return arr; //yeah theres an extra arr[2] but just ignore it   
}

class Dynamic3DText{
    //text positioned in 3D space, but always perpendicular to the camera.
    //able to change its position
    //actually drawn using HTML

    //currently does NOT change its size based on depth
    constructor(options){

        /* position3D: function(t) -> [x,y,z]. position in 3D space where the text pretends to be placed at
        text: function(t) -> [x,y,z] or string. What to write
        color: color (todo)
        align: "right" or "top" or "bottom" or "left" or "center" (todo). relationship to its position3D. whether the text should display to the right of that point, or left, or centered on it
        */
           
        this.position3D = options.position3D; 
        this.position2D = [0,0]
        this.text = options.text;
        this.frostedBG = options.frostedBG || false;
        this.htmlElem = makeLabel(this.frostedBG);
        this.color = options.color || "black";
        this.opacity = options.opacity === undefined ? 1 : options.opacity; //setter changes HTML
        this.roundingDecimals = 2;

        this._text = '';
        this._prevText = '';

        window.addEventListener("resize", this.updatePosition.bind(this), false)

    }
    updateHTMLColor(){
        let htmlColor = "black";
        if(this._color.constructor == String){
            htmlColor = this._color;
        }else if(this._color.constructor == Function){
            htmlColor = this._color(t);
        }else if(this._color.constructor == THREE.Color){
            htmlColor = this._color.getStyle();
        }
        this.htmlElem.style.color = htmlColor;
    }
    activate(t){
        
        if(this.position3D.constructor == Function){
            this._position3D = this.position3D(t);
        }else{
            this._position3D = this.position3D;
        }
        
        this.position2D = screenSpaceCoordsOf3DPoint(this._position3D);

        //figure out what text to display
        if(this.text.constructor == String){
            this._text = this.text;
        }else if(this.text.constructor == Function){
            this._text = this.text(t);
            if(this._text.constructor == Number){ //function which returns a number
                this._text = this.format(this._text)
            }
        }else if(this.text.constructor == Number){ //text IS a number
            this._text = this.format(this.text);
        }

        //compute color
        this.updateHTMLColor();

        //if text has changed, re-render
        if(this._text != this._prevText){
            this._prevText = this._text;
            this.renderDisplayedText();
        }

        this.updatePosition();
    }
    updatePosition(){
        this.htmlElem.style.left = this.position2D[0]/window.devicePixelRatio + 'px';
        this.htmlElem.style.top = this.position2D[1]/window.devicePixelRatio + 'px';
    }

    format(x, precision=2){
        if(x%1 == 0){ //if is integer
            return String(x);            
        }
        return Number(x).toFixed(2);
    }
    renderDisplayedText(){
        katex.render(this._text, this.htmlElem, {
            throwOnError: false
        });
    }
    set opacity(val){
        this.htmlElem.style.opacity = val;
        this._opacity = val;
    }
    get opacity(){
        return this._opacity;
    }
    set color(val){
        this._color = val;
        this.updateHTMLColor();
    }
    get color(){
        return this._color;    
    }
}

/*


let x = new Dynamic3DText({
    text: (t) => trianglePoints[0]}, 
    position3D: (t) => EXP.Utils.vecAdd(EXP.Utils.vecAdd(trianglePoints[0] + trianglePoints[1]), EXP.Utils.vecScale(trianglePoints[2], -0.3))
})*/

export {Dynamic3DText};
