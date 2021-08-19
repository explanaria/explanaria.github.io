import {constructEXPEllipticCurve} from "./3-makeellipticcurve.js";
	window.three = EXP.setupThree(120,10);
	var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

	three.camera.position.set(0,0,10);
	three.camera.lookAt(new THREE.Vector3(0,0,0));

	console.log("Loaded.");


    let p=-2, q=1;
    let curveY = (x)=>Math.sqrt(Math.abs(x*x*x + p*x+q));
    let [curveObjects, curveProjection] = constructEXPEllipticCurve(p, q)


	//points to add on the curve
	let points = [
					[-1,curveY(-1),0],
					[0.1,curveY(0.1),0]]

	var ellipticpts = new EXP.Array({data: points});
	var projpts = new EXP.Transformation({'expr':(i,t,a,b,c) => [a,b,c]});
	var ptsoutput = new EXP.PointOutput({width:0.2,color:0xff7070});

	ellipticpts.add(projpts).add(ptsoutput)


	let sceneObjects = ([ellipticpts]).concat(curveObjects); 
	three.on("update",function(time){
		sceneObjects.forEach(i => i.activate(time.t));
	});

	var additionLine;

	var showToProjectiveCoords; // a function


	function toProjectiveSphere(i,t,a,b,c){ //set as a Transformation later on
		if(c === undefined)c=0;
		let r = Math.sqrt(a*a+b*b); 
		let theta = Math.atan2(b,a);
		//new equation, this time a gnomonic projection. probably. it's buggy in the z direction 
		let new_r = r/Math.sqrt(1+r*r);

		return [new_r*Math.cos(theta),new_r*Math.sin(theta),4-4/Math.sqrt((1+new_r*new_r))]
	}



	async function animate(){
		//
		await EXP.delay(3000);

		//perform elliptic curve addition
		let p3 = elliptic_curve_add(points[0],points[1], [-2,1]);

		additionLine = new LongLineThrough(points[0],points[1],0xbf5050, 50);
		sceneObjects.push(additionLine);
		additionLine.revealSelf();

		await EXP.delay(1000);

		//draw 3rd point
		var addedPoint = new EXP.Array({data: [[...p3,0]]});
		var projpt3 = new EXP.Transformation({'expr':(i,t,a,b,c) => [a,b,c]});
		var pt3output = new EXP.PointOutput({width:0.0,color:0xff7070});
		addedPoint.add(projpt3).add(pt3output);
		sceneObjects.push(addedPoint);	

		//animate a fancy wiggle
		EXP.TransitionTo(pt3output,{opacity:1, width:0.6},400);
		await EXP.delay(400);

		EXP.TransitionTo(pt3output,{opacity:1, width:0.2},400);
		await EXP.delay(500);
        
		await EXP.delay(1000);
		EXP.TransitionTo(projpt3,{'expr':(i,t,a,b,c) => [a,-b,c]});

		showToProjectiveCoords = async function(){
			//todo: extend addition line

			EXP.TransitionTo(curveProjection, {'expr': toProjectiveSphere});	
			EXP.TransitionTo(projpts, {'expr': toProjectiveSphere});	
			EXP.TransitionTo(projpt3, {'expr': toProjectiveSphere});
			EXP.TransitionTo(additionLine.transform2, {'expr': toProjectiveSphere});
		}
		
		//showToProjectiveCoords();

	}

	animate();
