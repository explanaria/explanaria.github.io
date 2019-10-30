let three, controls, objects, knotParams;

let userPointParams = {x1:0,x2:0,factors:['linear','linear']};

let sliderColors = {'col1':{'c':"#f07000", 'faded':"#F0CAA8"},'col2':{'c':"#f070f0",'faded':'#D6C2D6'}}

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

    var a=1;
    var b=2;

    let domainWidth = 2*Math.PI; //width of the area in R^2 that's being passed into this parametrization.


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
                return [b*Math.sin(theta1),theta2/1.5,b*Math.cos(theta1)];
            }

        }else{

            if(userPointParams.factors[1] == 'circle'){
                return [b*Math.sin(theta2),theta1/1.5,b*Math.cos(theta2)];
            }else{
                //plane
                return [theta2, theta1, 0];
            }


        }
    }


    var torus = new EXP.Area({bounds: [[-domainWidth/2,domainWidth/2],[-domainWidth/2, domainWidth/2]], numItems: [30,30]});
    var timeChange = new EXP.Transformation({'expr': (i,t,theta1,theta2) => [theta1, theta2]});
    var manifoldParametrization = new EXP.Transformation({'expr': (i,t,theta1,theta2) => manifoldEmbeddingIntoR3(i,t,theta1,theta2)
    });
    var output = new EXP.SurfaceOutput({opacity:0.3, color: blue, showGrid: true, gridLineWidth: 0.05, showSolid:true});

    //SO. For some reason, this makes everything look a lot better with transparency on. It still renders things behind it properly (I guess that takes depthTest).
    //I guess it OVERWRITES the thing behind it instead of adding to it?
    //which looks bad at opacity 1.0, but looks GREAT at opacity 0.3 - 0.
    //I wonder if I rendered things in two parts, one solid color with  X, and one lines with depthWrite off, whether it would look awesome
    //
    output.mesh.material.depthWrite = false;

    torus.add(timeChange).add(manifoldParametrization).add(output);

    var coord1 = new EXP.Area({bounds: [[0,1]], numItems: 20});
    let coord1Range = Math.PI*2; //how wide the coordinate display should be
    coord1
    .add(new EXP.Transformation({expr: (i,t,x) => [(x-0.5)*coord1Range + userPointParams.x1,userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine1Color}));


    var userPoint1 = new EXP.Array({data: [[0,1]]}); //discarded
    userPoint1
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.PointOutput({width:0.3, color: pointColor}));


    var coord2 = new EXP.Area({bounds: [[0,1]], numItems: 200});
    let coord2Range = Math.PI*2; //how wide the coordinate should be
    coord2
    .add(new EXP.Transformation({expr: (i,t,x) => [userPointParams.x1,(x-0.5)*coord2Range + userPointParams.x2]}))
    .add(manifoldParametrization.makeLink())
    .add(new EXP.LineOutput({width:10, color: coordinateLine2Color}));

    let coord1SliderC = new CircleSlider(coordinateLine1Color, '1circle', ()=>userPointParams.x1, (x)=>setFirstFactor(x, 'circle'));
    let coord1SliderR = new RealNumberSlider(coordinateLine1Color, '1real', ()=>userPointParams.x1, (x)=>setFirstFactor(x, 'real'));



    let coord2SliderC = new CircleSlider(coordinateLine2Color, '2circle',  ()=>userPointParams.x2, (x)=>setSecondFactor(x, 'circle'));
    let coord2SliderR = new RealNumberSlider(coordinateLine2Color, '2real',  ()=>userPointParams.x2, (x)=>setSecondFactor(x, 'real'));

    coord1SliderC.disabled = true;
    coord2SliderC.disabled = true;

    function setFirstFactor(value, factorType){
        userPointParams.x1 = value;
        userPointParams.factors[0] = factorType
        if(factorType == 'circle'){
            coord1SliderC.disabled = false;
            coord1SliderR.disabled = true;
        }else{
            coord1SliderC.disabled = true;
            coord1SliderR.disabled = false;
        }
    }
    function setSecondFactor(value, factorType){
        userPointParams.x2 = value;
        userPointParams.factors[1] = factorType
        if(factorType == 'circle'){
            coord2SliderC.disabled = false;
            coord2SliderR.disabled = true;
        }else{
            coord2SliderC.disabled = true;
            coord2SliderR.disabled = false;
        }
    }

    objects = [torus, coord1, coord2, userPoint1, coord1SliderC, coord1SliderR, coord2SliderC, coord2SliderR];
}


async function animate(){
    //await EXP.delay(2000);
   // EXP.TransitionTo(knotParams,{'a':3,'b':2});
}

window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
