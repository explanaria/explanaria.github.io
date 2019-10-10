let three, controls, objects, knotParams;

let userPointParams = {x1:0,x2:0,factors:['circle','circle']};

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

        //todo: make this dynamic

        //circle 2:
        // x*cos(t2), y*cos(t2), a*sin(t1)
        //cylinder
        // x,y, z


        if(userPointParams.factors[0] == 'circle'){

            if(userPointParams.factors[1] == 'circle'){
                return [(a*Math.cos(theta1)+b)*Math.cos(theta2),(a*Math.cos(theta1)+b)*Math.sin(theta2),a*Math.sin(theta1)];
            }else{
                return [b*Math.cos(theta2),b*Math.sin(theta2),theta1];
            }

        }else{

            if(userPointParams.factors[1] == 'circle'){
                return 0 //todo, but its a cylinder in the other direction
            }else{
                //plane
                return [theta2, theta1, 0];
            }


        }
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
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
