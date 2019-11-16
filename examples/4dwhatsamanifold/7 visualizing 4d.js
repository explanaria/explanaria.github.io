let three, controls, objects, presentation;


let sq3 = Math.sqrt(3);
let userParams = {"mode": "orthographic", 'orthographic4Vec':[1/sq3,1/sq3,1/sq3]};

let sliderColors = {'col1':{'c':"#f07000", 'faded':"#F0CAA8"},'col2':{'c':"#f070f0",'faded':'#D6C2D6'}};

let R4Embedding = null, R4Rotation = null;

function colorMap(wCoordinate){
 let fourDRampAmt = Math.min(1, wCoordinate) //ramp from 0-1 then hold steady at 1
 let fourDAbsRampAmt = Math.min(1, Math.abs(wCoordinate)) //ramp from 0-1 then hold steady at 1
 /*
  //a color map that (A) goes from dark to light as you go from 0-1, and (B) cycles hue
 let lightness = Math.min(0.5, wCoordinate);
 return new THREE.Color().setHSL(wCoordinate, 0.5, fourDRampAmt/2);
 */

 //linear green->blue map

 let color = 40;
 let zeroWColor = new THREE.Color().setHSL((140)/360, 0.7, 0.6); //formerly 0x55e088
 if(wCoordinate > 0){
   return zeroWColor.lerp(new THREE.Color().setHSL(0/360, 0.85, 0.74), fourDAbsRampAmt); 
 }else{
   return zeroWColor.lerp(new THREE.Color().setHSL((140*2)/360, 0.85, 0.74), fourDAbsRampAmt); 
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

            //set up 4D color lerping by bolting it onto the existing material like a terrible person
            output.material.vertexColors = THREE.VertexColors;

	        let NUM_POINTS_IN_A_LINE = 2;
            let NUM_LINES = 1;

	        let colorArr = new Float32Array(NUM_POINTS_IN_A_LINE * NUM_LINES * 3);
            this.setColorInArray(this.points[ptAIndex], colorArr, 0);
            this.setColorInArray(this.points[ptBIndex], colorArr, 3);

            let colorAttribute = new THREE.Float32BufferAttribute( colorArr, 3)

	        output._geometry.addAttribute( 'color', colorAttribute  )
		    colorAttribute.needsUpdate = true;
            this.colorAttributes.push(colorAttribute);

        }
    }
    activate(t){
        for(var i=0;i<this.EXPLines.length;i++){
            this.EXPLines[i].activate(t);


            //calculate the appropriate 4D color and set it. Manually. this is terrible. todo: make this better
            let colorAttribute = this.colorAttributes[i];
            let ptA = this.points[this.lineData[i][0]];
            let ptB = this.points[this.lineData[i][1]];

            let ptA4DCoordinates = this.preEmbeddingTransformation.expr(i, t, ...ptA);
            this.setColorInArray(ptA4DCoordinates, colorAttribute.array, 0);
            let ptB4DCoordinates = this.preEmbeddingTransformation.expr(i, t, ...ptB);
            this.setColorInArray(ptB4DCoordinates, colorAttribute.array, 3);
		    colorAttribute.needsUpdate = true;
            
        }
    }
    setColorInArray(vec4Coords, colorArray, startIndex){
            let color = colorMap(vec4Coords[3]);
            colorArray[startIndex + 0] = color.r;
            colorArray[startIndex + 1] = color.g;
            colorArray[startIndex + 2] = color.b;
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
    return [x/(w+0.5), y/(w+0.5), z/(w+0.5)];
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
}

function setup(){
    setupThree();

    console.log("Loaded.");


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
    fivecell.objectParent.position.x = -2


    objects = [hypercube, fivecell];
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

        let newZ = z*Math.cos(t) + -w*Math.sin(t)
        let newW = z*Math.sin(t) + w*Math.cos(t)
       return [x,y,newZ,newW + 0.5]
    }});
}

window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
