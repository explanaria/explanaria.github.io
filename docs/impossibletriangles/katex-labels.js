import katex from './dist/katex-v0.13.13/katex.mjs';

function cssDropShadowOutline(blurRadius="0.05rem", color='#0005', moveRadius="0.15rem"){
    return "drop-shadow("+moveRadius+" 0 "+blurRadius+" "+color+") drop-shadow(0 "+moveRadius+" "+blurRadius+" "+color+") drop-shadow(-"+moveRadius+" 0 "+blurRadius+" "+color+") drop-shadow(0 -"+moveRadius+" "+blurRadius+" "+color+")"
}

function makeLabel(frostedBG=false){
    /*
    Need this CSS:
    .katexlabel{
        position: absolute;
        top: 0px;
        left: 0px;
        font-size: 24px;
        pointer-events: none;
    }
*/


    let parent = document.getElementById("canvasContainer");
    let positioningElem = document.createElement("div");
    if(frostedBG){
        //positioningElem.style.filter=cssDropShadowOutline("0.15rem",'#0002', "0.15rem"); //soft gray shadow
        //positioningElem.style.filter=cssDropShadowOutline("0.15rem",'#0008', "0.15rem"); //soft gray shadow
        //positioningElem.style.filter=cssDropShadowOutline("0.05rem",'#000f', "0.05rem"); //harder black shadow
        positioningElem.style.filter=cssDropShadowOutline("0.05rem",'#fff', "0.05rem");  //white border
    }
    //positioningElem.style.fontSize="24px"; //might need changing

    //changing a CSS transform doesn't cause a repaint according to https://csstriggers.com/, so it's much faster
    positioningElem.style.transform = "translate(-50%, -50%) translate(0px, 0px)";
    positioningElem.className = "katexlabel";
    parent.appendChild(positioningElem);

    return positioningElem;
}

const spareVec3 = new THREE.Vector3();
function screenSpaceCoordsOf3DPoint(point){
    three.camera.matrixWorldNeedsUpdate = true;

    spareVec3.x = point[0] || 0;
    spareVec3.y = point[1] || 0;
    spareVec3.z = point[2] || 0; //may be undefined, if so default to 0

    let vec = spareVec3.applyMatrix4(three.camera.matrixWorldInverse).applyMatrix4(three.camera.projectionMatrix);
    let arr = [vec.x, vec.y];
    arr[0] = (arr[0]+1)/2 * three.renderer.domElement.clientWidth;
    arr[1] = (-arr[1]+1)/2 * three.renderer.domElement.clientHeight;
    return arr;
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
        this._prevT = 0;

        this._prevColor = null;
        this._prevText = null;
        this._prevPosition = [0,0];

        window.addEventListener("resize", () => this.updatePosition(this._prevT), false);

    }
    updateHTMLColor(t){
        let htmlColor = "black";
        if(this._color.constructor == String){
            htmlColor = this._color;
        }else if(this._color.constructor == Function){
            htmlColor = this._color(t);
        }else if(this._color.constructor == THREE.Color){
            htmlColor = this._color.getStyle();
        }
        if(htmlColor != this._prevColor){
            this.htmlElem.style.color = htmlColor;
            this._prevColor = htmlColor;
        }
    }
    activate(t){

        if(this._opacity == 0){
            return; //we don't need to render anything!
        }
        

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
        this.updateHTMLColor(t);

        this.updatePosition(t);

        //if text has changed, re-render
        if(this._text != this._prevText){
            this._prevText = this._text;
            this.renderDisplayedText();
        }

        this._prevT =t;
    }
    updatePosition(t){
        if(this.position3D.constructor == Function){
            this._position3D = this.position3D(t);
        }else{
            this._position3D = this.position3D;
        }

        this.position2D = screenSpaceCoordsOf3DPoint(this._position3D);

        if(this.position2D[0] != this._prevPosition[0] || this.position2D[1] != this._prevPosition[1]){

            //Assumes we're at top: 0px, left 0px, the 50% 50% ensures the element is centered
            this.htmlElem.style.transform = "translate(-50%, -50%) translate("+this.position2D[0]+"0px, "+this.position2D[1]+"px)";
            this._prevPosition[0] = this.position2D[0];
            this._prevPosition[1] = this.position2D[1];
        }
    }

    format(x, precision=2){
        if(x%1 == 0){ //if is integer
            return String(x);            
        }
        return Number(x).toFixed(2);
    }
    renderDisplayedText(){
        this.htmlElem.innerHTML = this._text;
        
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
        this.updateHTMLColor(this._prevT);
    }
    get color(){
        return this._color;    
    }
}

export {Dynamic3DText};