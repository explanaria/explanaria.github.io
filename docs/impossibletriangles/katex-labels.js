import katex from './dist/katex-v0.13.13/katex.mjs';

function cssDropShadowOutline(blurRadius="0.05rem", color='#0005', moveRadius="0.15rem"){
    return "drop-shadow("+moveRadius+" 0 "+blurRadius+" "+color+") drop-shadow(0 "+moveRadius+" "+blurRadius+" "+color+") drop-shadow(-"+moveRadius+" 0 "+blurRadius+" "+color+") drop-shadow(0 -"+moveRadius+" "+blurRadius+" "+color+")"
}

function makeLabel(frostedBG=false, fontSize=undefined){
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
    if(fontSize){
        positioningElem.style.fontSize= fontSize+"em";
    }
    //changing a CSS transform doesn't cause a repaint according to https://csstriggers.com/, so it's much faster
    positioningElem.style.transform = "translate(-50%, -50%) translate(0px, 0px)";
    positioningElem.className = "katexlabel";
    parent.appendChild(positioningElem);

    return positioningElem;
}

const spareVec3 = new THREE.Vector3();
const spareVec2 = new THREE.Vector3();
function screenSpaceCoordsOf3DPoint(point){
    three.camera.matrixWorldNeedsUpdate = true;

    spareVec3.x = point[0] || 0;
    spareVec3.y = point[1] || 0;
    spareVec3.z = point[2] || 0; //may be undefined, if so default to 0

    let vec = spareVec3.applyMatrix4(three.camera.matrixWorldInverse).applyMatrix4(three.camera.projectionMatrix);
    let arr = [vec.x, vec.y];

    //computing the canvas width and height is hard.
    //we want these to be in pixels, ideally.
    //we can use three.renderer.domElement.clientWidth, but that hits the DOM multiple times every frame and causes a slow repaint
    three.renderer.getSize(spareVec2); //might not take into account CSS related transforms
    let canvasWidth = spareVec2.x; 
    let canvasHeight = spareVec2.y;

    arr[0] = (arr[0]+1)/2 * canvasWidth;
    arr[1] = (-arr[1]+1)/2 * canvasHeight;
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
        this.textSize = options.textSize || null; //todo: allow changing after creation
        this.htmlElem = makeLabel(this.frostedBG, this.textSize);
        this.align = options.align || "center"; //where should the text go in relation to the position3D?
        this.color = options.color || "black";
        this.opacity = options.opacity === undefined ? 1 : options.opacity; //setter changes HTML
        this.roundingDecimals = 2;

        if(options.maxWidth)this.htmlElem.style.maxWidth = options.maxWidth + "%";

        this._text = '';
        this._prevText = '';
        this._prevT = 0;

        this._prevColor = null;
        this._prevText = null;
        this._prevPosition = [0,0];

        window.addEventListener("resize", () => this.updatePositionIfNeeded(this._prevT), false);
    }
    updateHTMLColor(t){
        let htmlColor = "black";
        if(this._color.constructor == String){
            htmlColor = this._color;
        }else if(this._color.constructor == Function){
            htmlColor = this._color(t);
            if(htmlColor.constructor == THREE.Color){
                htmlColor = htmlColor.getStyle();
            }
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
                this._text = this.format(this._text);
            }
        }else if(this.text.constructor == Number){ //text IS a number
            this._text = this.format(this.text);
        }

        //compute color
        this.updateHTMLColor(t);

        this.updatePositionIfNeeded(t);

        //if text has changed, re-render
        if(this._text != this._prevText){
            this._prevText = this._text;
            this.renderDisplayedText();
        }

        this._prevT =t;
    }

    computealignText(){
        let buffer="20px";
        if(this._align == "center"){
            return "translate(-50%, -50%)";
        }
        if(this._align == "right"){ //0%, 50% plus a 10% buffer
            return "translate(0%, -50%) translate(10px, 0)";
        }
        if(this._align == "left"){
            return "translate(-100%, -50%) translate(-10px, 0)";
        }
        if(this._align == "top"){
            return "translate(-50%, -110%) translate(0, -10px)";
        }
        if(this._align == "bottom"){
            return "translate(-50%, 10%) translate(0, 10px)";
        }
    }

    updateHTMLPosition(){
        //Assumes we're at top: 0px, left 0px, the 50% 50% ensures the element is centered
        this.htmlElem.style.transform = this.computealignText() + " translate("+this.position2D[0]+"px, "+this.position2D[1]+"px)";

    }

    updatePositionIfNeeded(t){
        if(this.position3D.constructor == Function){
            this._position3D = this.position3D(t);
        }else{
            this._position3D = this.position3D;
        }

        this.position2D = screenSpaceCoordsOf3DPoint(this._position3D);

        if(this.position2D[0] != this._prevPosition[0] || this.position2D[1] != this._prevPosition[1]){
            this.updateHTMLPosition();
            this._prevPosition[0] = this.position2D[0];
            this._prevPosition[1] = this.position2D[1];
        }
    }

    format(x, precision=2){
        let roundedX = Math.round(x)
        if(Math.abs(x - roundedX) < 0.000001){ //if is integer
            return String(roundedX);            
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
    get align(){
        return this._align;
    }
    set align(val){
        this._align = val;
        this.updateHTMLPosition();
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
