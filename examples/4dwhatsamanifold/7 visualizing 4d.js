let three, controls, objects=[], presentation;



let sq3 = Math.sqrt(3);
let userParams = {"mode": "orthographic", 'orthographic4Vec':[1/sq3,1/sq3,1/sq3]};

let sliderColors = {'col1':{'c':"#f07000", 'faded':"#F0CAA8"},'col2':{'c':"#f070f0",'faded':'#D6C2D6'}};

let R4Embedding = null, R4Rotation = null, positiveWOutput = null;



const zeroWColor = new THREE.Color(coordinateLine4ZeroColor);
const oneWColor = new THREE.Color(coordinateLine4Color);
const negativeWColor = new THREE.Color(coordinateLine4NegativeColor);
function colorMap(wCoordinate){
 let fourDRampAmt = Math.min(1, wCoordinate) //ramp from 0-1 then hold steady at 1
 let fourDAbsRampAmt = Math.min(1, Math.abs(wCoordinate)) //ramp from 0-1 then hold steady at 1
 /*
  //a color map that (A) goes from dark to light as you go from 0-1, and (B) cycles hue
 let lightness = Math.min(0.5, wCoordinate);
 return new THREE.Color().setHSL(wCoordinate, 0.5, fourDRampAmt/2);
 */

 if(wCoordinate > 0){
   //This should be coordinateline4color. w=+1
   return zeroWColor.clone().lerp(oneWColor.clone(), fourDAbsRampAmt); 
 }else{
    //this is coordinateLine4NegativeColor. w=-1
   return zeroWColor.clone().lerp(negativeWColor.clone(), fourDAbsRampAmt); 
 }
}


class Polychoron{
    constructor(points, lines, embeddingTransformation, R4Rotation){
        this.points = points;
        this.lineData = lines;
        this.embeddingTransformation = embeddingTransformation;
        this.preEmbeddingTransformation = R4Rotation;

        this.outputs = [];
        this.EXPLines = [];

        this.color = 0x00ff88;
        this.colorAttributes = []; //the attributes containing arrays for color. this is a giant hacky way of changing color for EXP.LineOutputs

        this.objectParent = new THREE.Object3D();
        three.scene.add(this.objectParent);

        this.makeEXPLines(lines);        
    }
    makeEXPLines(){
        for(var i=0;i<this.lineData.length;i++){
            let ptAIndex = this.lineData[i][0];
            let ptBIndex = this.lineData[i][1];
            var line = new EXP.Array({data: [this.points[ptAIndex],this.points[ptBIndex]]});
            let output = new EXP.LineOutput({width: 10, color: 0xffffff});
            line
                .add(this.preEmbeddingTransformation.makeLink())
                .add(this.embeddingTransformation.makeLink())
                .add(output);

            this.EXPLines.push(line);
            this.outputs.push(output);
            this.objectParent.add(output.mesh);

            //set up color lerping by memorizing the attributes like a terrible person
            this.colorAttributes.push(output._geometry.attributes.color);

        }
    }
    activate(t){
        for(var i=0;i<this.EXPLines.length;i++){
            this.EXPLines[i].activate(t);

            let lineOutput = this.outputs[i];


            //calculate the appropriate 4D color and set it. Manually. this is terrible. todo: make this dynamic and Transformation-chainable
            let ptA = this.points[this.lineData[i][0]];
            let ptB = this.points[this.lineData[i][1]];

            let ptA4DCoordinates = this.preEmbeddingTransformation.expr(i, t, ...ptA);
            let color1 = colorMap(ptA4DCoordinates[3]);
            lineOutput._setColorForVertexRGB(0, color1.r, color1.g, color1.b);

            let ptB4DCoordinates = this.preEmbeddingTransformation.expr(i, t, ...ptB);
            let color2 = colorMap(ptB4DCoordinates[3]);
            lineOutput._setColorForVertexRGB(1, color2.r, color2.g, color2.b);

		    lineOutput._geometry.attributes.color.needsUpdate = true;
        }
    }
}

function makeHypercube(R4Embedding, R4Rotation){

    let points = [];
    let lines = [];

    //utility function used to avoid adding [a,b] and [b,a] as two separate lines twice
    function addLine(oneIndex, twoIndex){
        if(oneIndex < twoIndex){
             lines.push([oneIndex,twoIndex]) 
        }
    }

    for(let x=0;x<=1;x++){ //-1 - 1
        for(let y=0;y<=1;y++){
            for(let z=0;z<=1;z++){
                for(let w=0;w<=1;w++){
                    let point = [x-0.5,y-0.5,z-0.5, w] //xyz are -1/2 to 1/2, w is 0-1
                    points.push(point);
        
                    //we should now add a line to every point that shares 3/4 coordinates
                    let pointIndex = w + 2*z + 4*y + 8*x;
                    addLine(pointIndex, ((1-w)+ 2*z     +4*y     + 8*x));
                    addLine(pointIndex, (w    + 2*(1-z) +4*y     + 8*x));
                    addLine(pointIndex, (w    + 2*z     +4*(1-y) + 8*x));
                    addLine(pointIndex, (w    + 2*z     +4*y     + 8*(1-x)));
                }
            }
        }
    }

    return new Polychoron(points, lines, R4Embedding, R4Rotation);
}


function perspectiveEmbedding(i,t,x,y,z,w){
    return [0.5*x/(w+0.5), 0.5*y/(w+0.5), 0.5*z/(w+0.5)];
}
function orthographicEmbedding(i,t,x,y,z,w){
    let wProjection = EXP.Math.multiplyScalar(w,EXP.Math.clone(userParams.orthographic4Vec));
    return EXP.Math.vectorAdd([x,y,z],wProjection);
}


function R4EmbeddingFunc(i,t,x,y,z,w){
    if(w == 0)w = 0.001;
    if(userParams.mode == "perspective") return perspectiveEmbedding(i,t,x,y,z,w);
    //else if(userParams.mode == "orthographic") 
    return orthographicEmbedding(i,t,x,y,z,w)
}


function setupThree(){
	three = EXP.setupThree(60,15,document.getElementById("canvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);
    

	three.camera.position.z = 6;
	three.camera.position.y = 0.5;
    //controls.autoRotate = true;
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
		controls.update();
	});

    
	presentation = new EXP.UndoCapableDirector();
    console.log("Loaded.");

}

function setup(){
    setupThree();
    setup4DPolychora();
    setupAxes();
}

function setup4DPolychora(){

    R4Embedding = new EXP.Transformation({'expr': R4EmbeddingFunc});
    R4Rotation = new EXP.Transformation({'expr': (i,t,x,y,z,w) => [x,y,z,w]});


    
/*
    let hypercube = new Polychoron(
        [//points
            [0,0,0,1], [0,0,0,-1],
            [0,0,1,0], [0,0,-1,0],
            [0,1,0,0], [0,-1,0,0],
            [1,0,0,0], [-1,0,0,0],
        ],
        [ //lines
            [0,1],
            [2,3],
            [4,5],
            [6,7],
        ],
    R4Embedding);
    */


    let hypercube = makeHypercube(R4Embedding,R4Rotation);

    hypercube.objectParent.position.x = 2


    let sq5 = Math.sqrt(5), sq29 = Math.sqrt(2/9), sq23 = Math.sqrt(2/3);
    let fivecell = new Polychoron(
        [//points
            //[0,0,0,0], [0,0,0,1], [0,0,1,0], [0,1,0,0], [1,0,0,0],

            //[1,1,1,-1/sq5], [1,-1,-1,-1/sq5], [-1,1,-1,-1/sq5], [-1,-1,1,-1/sq5], [0,0,0,sq5-1/sq5]
            [sq5*Math.sqrt(8/9),-sq5/3,0,0], [-sq5*sq29,-sq5/3,-sq5*sq23,0], [-sq5*sq29,-sq5/3,sq5*sq23,0], [0,sq5,0,0], [0,0,0,1] //has base on XZ plane, almost all w=0

        ],
        [ //lines
            [0,1], [0,2], [0,3], [0,4],
            [1,2],[1,3],[1,4],
            [2,3],[2,4],
            [3,4],
        ],
    R4Embedding,R4Rotation);
    fivecell.objectParent.position.x = -2;

    objects.push(hypercube);
    objects.push(fivecell);
}

function setupAxes(){
    let axisSize = 1.5;
    xAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    xAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
    xAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [axisSize*x,0,0]}))
    .add(xAxisControl)
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine1Color}));
    
    xAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [-axisSize*x,0,0]}))
    .add(xAxisControl.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine1Color}));

    yAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    yAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
    yAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,axisSize*x,0]}))
    .add(yAxisControl)
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine2Color}));
    yAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,-axisSize*x,0]}))
    .add(yAxisControl.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine2Color}));

    let zAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    zAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
    zAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,0,axisSize*x]}))
    .add(zAxisControl)
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine3Color}));
    zAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,0,-axisSize*x]}))
    .add(zAxisControl.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine3Color}));

    //the fourth dimension!
    wAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    positiveWOutput = new EXP.VectorOutput({width:5, color: coordinateLine4Color, opacity:1});
    let negativeWOutput = new EXP.VectorOutput({width:5, color: coordinateLine4NegativeColor, opacity:1});

    wAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,0,0,x*Math.sqrt(3)]}))
    .add(R4Embedding.makeLink())
    .add(positiveWOutput);
    wAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,0,0,-x*Math.sqrt(3)]}))
    .add(R4Embedding.makeLink())
    .add(negativeWOutput);

    
    let colorForW1 = colorMap(1);
    let colorForW0 = colorMap(0);
    let colorForWNeg1 = colorMap(-1);

    //HORRIBLE HACK ALERT
    //when the first time activate() is called, it sets the colors and vertex arrays.
    //meaning we need to activate it once first before messing with color data.
    wAxis.activate(0);

    positiveWOutput._setColorForVertex(0, colorForW0);
    positiveWOutput._setColorForVertex(1, colorForW1);

    negativeWOutput._setColorForVertex(0, colorForW0);
    negativeWOutput._setColorForVertex(1, colorForWNeg1);

/*
    wAxis
    .add(new EXP.Transformation({expr: (i,t,x) => {

        let wProjectionComponent = EXP.Math.multiplyScalar(-x,EXP.Math.clone(userParams.orthographic4Vec));
        
        return [...wProjectionComponent,x]

    }}))
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine4Color, opacity:1}));
*/
    [xAxis, yAxis, zAxis, wAxis].forEach((x) => objects.push(x));

}


async function animate(){
    await presentation.begin();
    await presentation.nextSlide();
   // EXP.TransitionTo(knotParams,{'a':3,'b':2});
    presentation.TransitionTo(R4Embedding, {'expr': perspectiveEmbedding});
    await presentation.nextSlide();
    presentation.TransitionTo(R4Embedding, {'expr': orthographicEmbedding});
    await presentation.nextSlide();

    //hyper-rotation!
    presentation.TransitionTo(R4Rotation, {'expr': (i,t,x,y,z,w) => {
            //center of rotation is [0,0,0,0.5], hence the w - 0.5 part
        w = w-0.5

        let newZ = z*Math.cos(t*Math.PI) + -w*Math.sin(t*Math.PI)
        let newW = z*Math.sin(t*Math.PI) + w*Math.cos(t*Math.PI)
       return [x,y,newZ,newW + 0.5]
    }});
}

window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
