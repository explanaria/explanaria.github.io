let three, controls, objects, knotParams;

let userPointParams = {x1:0,x2:0};

function setup(){
	three = EXP.setupThree(60,15,document.getElementById("canvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

	three.camera.position.z = 4;

    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
		//controls.update();
	});

    let blue = 0x0070f0;
    let green = 0x50d050;

    let fadedRed = 0xf07000;
    let fadedPurple = 0xf070f0;

    let gray = 0x555555;

    console.log("Loaded.");

    var a=1;
    var b=2;
    function manifoldEmbeddingIntoR3(i,t,theta1,theta2){

        //if productType1 == 'circle' and productType2 == 'circle'
        return [(a*Math.cos(theta1)+b)*Math.cos(theta2),(a*Math.cos(theta1)+b)*Math.sin(theta2),a*Math.sin(theta1)];

    }

    var torus = new EXP.Area({bounds: [[0,2*Math.PI],[0,2*Math.PI]], numItems: [17,17]});
    var timeChange = new EXP.Transformation({'expr': (i,t,theta1,theta2) => [theta1, theta2]});
    var manifoldParametrization = new EXP.Transformation({'expr': (i,t,theta1,theta2) => 
    [(a*Math.cos(theta1)+b)*Math.cos(theta2),(a*Math.cos(theta1)+b)*Math.sin(theta2),a*Math.sin(theta1)]
    });
    var output = new EXP.SurfaceOutput({opacity:0.3, color: blue, showGrid: true, gridLineWidth: 0.05, showSolid:true});

    torus.add(timeChange).add(manifoldParametrization).add(output);

    knotParams = {a:2,b:3};

    var knotLine = new EXP.Area({bounds: [[0,1]], numItems: 200});
    knotLine
    .add(new EXP.Transformation({expr: (i,t,x) => [knotParams.b * x * 2*Math.PI,knotParams.a * x *2*Math.PI]}))
    .add(manifoldParametrization.makeLink())
   // .add(new EXP.LineOutput({width:10, color: green}));


    var coord1 = new EXP.Area({bounds: [[0,1]], numItems: 20});
    let coord1Range = Math.PI*2; //how wide the coordinate display should be
    coord1
    .add(new EXP.Transformation({expr: (i,t,x) => [(x-0.5)*coord1Range + userPointParams.x1,userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: fadedRed}));


    var userPoint1 = new EXP.Array({data: [[0,1]]}); //discarded
    userPoint1
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.PointOutput({width:0.3, color: fadedRed}));


    var coord2 = new EXP.Area({bounds: [[0,1]], numItems: 200});
    let coord2Range = Math.PI*2; //how wide the coordinate should be
    coord2
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,(x-0.5)*coord2Range + userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: fadedPurple}));

    let coord1Slider = new CircleSlider("#f07000", 'circleContainer1', ()=>userPointParams.x1, (x)=>{userPointParams.x1 = x});
    let coord2Slider = new CircleSlider("#f070f0", 'circleContainer2',  ()=>userPointParams.x2, (x)=>{userPointParams.x2 = x});


    objects = [knotLine, torus, coord1, coord2, userPoint1, coord1Slider, coord2Slider];
}


class CircleSlider{
    constructor(color, containerID, valueGetter, valueSetter){

        this.canvas = document.createElement("canvas");
        document.getElementById(containerID).appendChild(this.canvas);

        this.context = this.canvas.getContext("2d");

        this.canvas.height = 150;
        this.canvas.width = 150;

        this.valueGetter = valueGetter; //call every frame to change the display
        this.valueSetter = valueSetter;

    
        this.dragging = false;
        this.pointAngle = 0;
    
        this.pos = [this.canvas.width/2,this.canvas.height/2];

        this.radius = 50;
        this.pointRadius = 20;
        this.pointColor = color

        
        this.canvas.addEventListener("mousedown",this.onmousedown.bind(this));
        this.canvas.addEventListener("mouseup",this.onmouseup.bind(this));
        this.canvas.addEventListener("mousemove",this.onmousemove.bind(this));
        this.canvas.addEventListener("touchmove", this.ontouchmove.bind(this),{'passive':false});
        this.canvas.addEventListener("touchstart", this.ontouchstart.bind(this),{'passive':false});

        //this.update();
    }
    activate(){
        if(this.dragging){
            this.valueSetter(this.pointAngle);
        }else{
            this.pointAngle = this.valueGetter();
        }
        
        this.draw();
        //window.requestAnimationFrame(this.update.bind(this)); //ugly but works.
    }
    draw(){

        //let hueVal = (angle/Math.PI/2 + 0.5)*360;
        //context.fillStyle = "hsl("+hueVal+",50%,50%)";

        this.canvas.width = this.canvas.width;
        this.context.lineWidth = 10;

        this.context.strokeStyle = this.pointColor;
        drawCircleStroke(this.context, this.pos[0],this.pos[1],this.radius);

        this.context.fillStyle = "orange"
        if(this.dragging){
            this.context.fillStyle = "darkorange"
        }
        drawCircle(this.context, this.pos[0] + this.radius*Math.cos(this.pointAngle), this.pos[1] + this.radius*Math.sin(this.pointAngle), this.pointRadius);
    }
    ontouchstart(event){
        if(event.target == this.canvas)event.preventDefault();

        let rect = this.canvas.getBoundingClientRect();

        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousedown({x: touch.clientX - rect.left, y: touch.clientY- rect.top});
        }
    }

    ontouchmove(event){
        event.preventDefault();

        let rect = this.canvas.getBoundingClientRect();
        
        for(var i=0;i<event.touches.length;i++){
            let touch = event.touches[i];
            this.onmousemove({x: touch.clientX - rect.left, y: touch.clientY- rect.top});
        }
    }

    onmousedown(event){
        let x = event.x;
        let y = event.y;
        let ptX = this.pos[0] + this.radius*Math.cos(this.pointAngle);
        let ptY = this.pos[1] + this.radius*Math.sin(this.pointAngle);
        if(dist(x,y, ptX, ptY) < this.pointRadius + 10){
            this.dragging = true;
        }
    }
    onmouseup(event){
        this.dragging = false;
    }
    angleDiff(a,b){
        const pi2 = Math.PI*2;
        const dist = Math.abs(a-b)%pi2
        return dist > Math.PI ? (pi2-dist) : dist
    }
    onmousemove(event){
        let x = event.x;
        let y = event.y;
        //convert mouse angle to this

        if(this.dragging){
            let mouseAngle = Math.atan2(y-this.centerPos[1],x-this.centerPos[0]);
            this.pointAngle = mouseAngle;
            this.valueSetter(this.pointAngle);
        }
    }
}



//helper func
function drawCircleStroke(context, x,y,radius){
    context.beginPath();
    context.arc(x,y, radius, 0, 2 * Math.PI);
    context.stroke();
}
function drawCircle(context, x,y,radius){
    context.beginPath();
    context.arc(x,y, radius, 0, 2 * Math.PI);
    context.fill();
}
function dist(a,b,c,d){
    return Math.sqrt((b-d)*(b-d)+(c-a)*(c-a))
}




async function animate(){

    await EXP.delay(2000);
    EXP.TransitionTo(knotParams,{'a':3,'b':2});

    await EXP.delay(5000);
    EXP.TransitionTo(knotParams,{'a':5});
}

window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
