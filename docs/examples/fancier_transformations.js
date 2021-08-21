    //setup variable 'three' beforehand using EXP.setupThree() please

    var controls, area, id, output;
    function init(){
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);
	    console.log("Loaded.");

	    area = new EXP.Area({bounds: [[-5,5],[-5,5]]});
	    id = new EXP.Transformation({'expr': (i,t,x,y) => [x,y,0]});
	    output = new EXP.PointOutput({width:0.2});

	    area.add(new EXP.PointOutput({width: 0.2, color:0xcccccc})); // grid

	    area.add(id); //transformation -> output
	    id.add(output);

	    three.on("update",function(time){
		    area.activate(time.t);
		    controls.update();
	    });
    	animate();
    }

	async function animate(){

		await EXP.delay(1000);

		//demonstrate some common functions
		/*
		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [Math.cos(x),Math.sin(x),0]});
		await EXP.delay(1000);

		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [Math.cos(x+t),Math.sin(x+t),0]});
		await EXP.delay(500);

	
		// bouncy circle
		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [(y+6)*Math.cos(x + t),(y+6)*Math.sin(x + t),0]});
		await EXP.delay(3000);


		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [(y+Math.sin(t*6)+5)*Math.cos(x + t),(y+Math.sin(t*6)+5)*Math.sin(x + t),0]});
		await EXP.delay(5000);*/


		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [x,x*x*x/6 + y,0]});
		await EXP.delay(1000);

		// bouncy circle
		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [y*Math.cos(x/4),y*Math.sin(x/4),0]});
		await EXP.delay(1000);

		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [y*Math.cos(x/4 + t),y*Math.sin(x/4 + t),0]});
		await EXP.delay(1000);

		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [(y+Math.sin(t*6))*Math.cos(x/4 + t),(y+Math.sin(t*6))*Math.sin(x/4 + t),0]});
		await EXP.delay(5000);

		//folds up into something 3D
		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [(y+Math.sin(t*6))*Math.cos(x/4 + t),(y+Math.sin(t*6))*Math.sin(x/4 + t),Math.abs(x)*3-9]});
		await EXP.delay(3000);

		//to the THIRD DIMENSION
		EXP.TransitionTo(three.camera.position, {z: 2, x: 9.3});
		await EXP.delay(5000);

		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [x,(x*x+y*y*(y+Math.sin(t)/3))/5,y+Math.sin(t)]});
		await EXP.delay(5000);

		//TransitionTo(three.camera.rotation, {y: Math.PI});

		//var anim = new Animation(output, {'color': 0xffffff}); // works (albeit not on THREE.Color()s)

		EXP.TransitionTo(three.camera.position, {z: 10, x: 0});
		await EXP.delay(1000);

		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [x,Math.sin(x+t),0]})
		await EXP.delay(3000);

		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [x,Math.sin(x+t),Math.cos(x+t)]})
		await EXP.delay(4000);


		EXP.TransitionTo(id, {'expr': (i,t,x,y) => [x,y+Math.sin(x+t),-(y*y/3)+Math.cos(x+t)+4]})
		await EXP.delay(4000);


	}
