let three, controls, objects, knotParams;

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

    console.log("Loaded.");

    var torus = new EXP.Area({bounds: [[0,2*Math.PI],[0,2*Math.PI]], numItems: [17,17]});
    var a=1;
    var b=2;
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
    .add(manifoldParametrization.clone())
    .add(new EXP.LineOutput({width:10, color: green}));


    objects = [knotLine, torus];
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
