let three, controls, objects, knotParams;


let sq3 = Math.sqrt(3);

let userParams = {"mode": "orthographic", 'orthographic4Vec':[1/sq3,1/sq3,1/sq3]};

let sliderColors = {'col1':{'c':"#f07000", 'faded':"#F0CAA8"},'col2':{'c':"#f070f0",'faded':'#D6C2D6'}};

let R4Embedding = null;


class Polychoron{
    constructor(points, lines, embeddingTransformation){
        this.points = points;
        this.lineData = lines;
        this.embeddingTransformation = embeddingTransformation;

        this.outputs = [];
        this.EXPObjects = [];
        this.color = 0x00ff88;

        this.objectParent = new THREE.Object3D();
        three.scene.add(this.objectParent);

        this.makeEXPLines(lines);        
    }
    makeEXPLines(){
        for(var i=0;i<this.lineData.length;i++){
            let ptAIndex = this.lineData[i][0];
            let ptBIndex = this.lineData[i][1];
            var line = new EXP.Array({data: [this.points[ptAIndex],this.points[ptBIndex]]});
            let output = new EXP.LineOutput({width: 10, color: this.color});
            line
                .add(this.embeddingTransformation.makeLink())
                .add(output);

            this.EXPObjects.push(line);
            this.outputs.push(output);

            this.objectParent.add(output.mesh);
        }
    }
    activate(t){
        for(var i=0;i<this.EXPObjects.length;i++){
            this.EXPObjects[i].activate(t);
        }
    }
}

function makeHypercube(R4Embedding){

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

    return new Polychoron(points, lines, R4Embedding);
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


function setup(){
	three = EXP.setupThree(60,15,document.getElementById("canvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);
    

	three.camera.position.z = 6;
	three.camera.position.y = 0.5;
    controls.autoRotate = true;
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
		controls.update();
	});

    console.log("Loaded.");


    R4Embedding = new EXP.Transformation({'expr': R4EmbeddingFunc});


    
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
    let hypercube = makeHypercube(R4Embedding);

    hypercube.objectParent.position.x = 1


    let sq5 = Math.sqrt(5)
    let fivecell = new Polychoron(
        [//points
            //[0,0,0,0], [0,0,0,1], [0,0,1,0], [0,1,0,0], [1,0,0,0],
            [1,1,1,-1/sq5], [1,-1,-1,-1/sq5], [-1,1,-1,-1/sq5], [-1,-1,1,-1/sq5], [0,0,0,sq5-1/sq5]

        ],
        [ //lines
            [0,1], [0,2], [0,3], [0,4],
            [1,2],[1,3],[1,4],
            [2,3],[2,4],
            [3,4],
        ],
    R4Embedding);


    objects = [hypercube, fivecell];
}


async function animate(){
    await EXP.delay(2000);
   // EXP.TransitionTo(knotParams,{'a':3,'b':2});
    EXP.TransitionTo(R4Embedding, {'expr': perspectiveEmbedding});
    await EXP.delay(2000);
    EXP.TransitionTo(R4Embedding, {'expr': orthographicEmbedding});

    /* //hyper-rotation!
    EXP.TransitionTo(R4Embedding, {'expr': (i,t,x,y,z,w) => {
let newZ = z*Math.cos(t) + -w*Math.sin(t)
let newW = z*Math.sin(t) + w*Math.cos(t)
       return perspectiveEmbedding(i,t,x,y,newZ,newW);
    }});
    */

//userParams.orthographic4Vec = [1.2,1.2,1.2]
}

window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);