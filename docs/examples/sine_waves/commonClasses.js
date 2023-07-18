
    import * as EXP from "../../resources/build/explanaria-bundle.js";

	export let lightblue = 0x0070f0;
	export let orangered = 0xff7070;
	export let yellow = 0xffeb59;
	export let lightgreen = 0x70ff70;


	export class twoPointLine{
		constructor(funcA,funcB, col){

			let pt1 = funcA;
			let pt2 = funcB;

			this.area = new EXP.Area({bounds: [[0,1]],numItems:2});
			this.revealTransform = new EXP.Transformation({'expr': (i,t,x) => [0]});
			this.lineDefinition = new EXP.Transformation({'expr': (i,t,x) => EXP.Math.vectorAdd(EXP.Math.multiplyScalar((1-x),funcA(i,t,x)),EXP.Math.multiplyScalar(x,funcB(i,t,x)))});
			this.linePostTransform = new EXP.Transformation({'expr': (i,t,x,y,z) => [x,y]});
			this.out = new EXP.LineOutput({width:5,color:col});
			this.area.add(this.revealTransform).add(this.lineDefinition).add(this.linePostTransform).add(this.out);
		}
		activate(time){
			this.area.activate(time);
		}	
		reveal(duration=800){
			EXP.TransitionTo(this.revealTransform,{'expr': (i,t,x) => [x]},duration);
		}	
	}	

	export class PlusSign{
		constructor(centerPoint, width, color){
			this.lineA = new twoPointLine((i,t,x)=>[centerPoint[0],centerPoint[1]+width],(i,t,x)=>[centerPoint[0],centerPoint[1]-width],color)
			this.lineB = new twoPointLine((i,t,x)=>[centerPoint[0]+width,centerPoint[1]],(i,t,x)=>[centerPoint[0]-width,centerPoint[1]], color);
		}
		addTo(scene){
			scene.push(this.lineA);
			scene.push(this.lineB);
		}
		removeFromScene(scene){
			this.removeFrom(scene,this.lineA);
			this.removeFrom(scene,this.lineB);
		}
		removeFrom(scene, thing){
			var index = scene.indexOf( thing );
			if ( index !== - 1 ) {
				scene.splice( index, 1 );
			}
		}
		async reveal(duration,delay=500){
			this.lineA.out.opacity = 1;
			this.lineB.out.opacity = 1;
			this.lineA.reveal(duration);
			await EXP.delay(delay);
			this.lineB.reveal(duration);
		}
		async fadeOut(duration,delay=500){
			EXP.TransitionTo(this.lineA.out, {'opacity': 0},duration);
			EXP.TransitionTo(this.lineB.out, {'opacity': 0},duration);
			await EXP.delay(duration);
			EXP.TransitionTo(this.lineA.revealTransform,{'expr': (i,t,x) => [0]},10);
			EXP.TransitionTo(this.lineB.revealTransform,{'expr': (i,t,x) => [0]},10);
		}
	}

	export class EqualsSign{
		constructor(centerPoint, width, color){
			let height = width * 0.8; //oh sure it should be halved here... but I'm in a rush
			this.lineA = new twoPointLine((i,t,x)=>[centerPoint[0]-width,centerPoint[1]+height],(i,t,x)=>[centerPoint[0]+width,centerPoint[1]+height], color);
			this.lineB = new twoPointLine((i,t,x)=>[centerPoint[0]-width,centerPoint[1]-height],(i,t,x)=>[centerPoint[0]+width,centerPoint[1]-height], color);
		}
		addTo(scene){
			scene.push(this.lineA);
			scene.push(this.lineB);
		}
		async reveal(duration, delay=500){
			this.lineA.reveal(duration);
			await EXP.delay(delay);
			this.lineB.reveal(duration);
		}
	}

	export class RightArrow{
		constructor(centerPoint, width, color){
			let height = 0.8*width;
			let arrowBack = 2*width/3;
			this.lineA = new twoPointLine((i,t,x)=>[centerPoint[0]-width,centerPoint[1]],(i,t,x)=>[centerPoint[0]+width+0.02,centerPoint[1]],color)
			this.lineB = new twoPointLine((i,t,x)=>[centerPoint[0]+width,centerPoint[1]],(i,t,x)=>[centerPoint[0]+width-arrowBack,centerPoint[1]+height], color);
			this.lineC = new twoPointLine((i,t,x)=>[centerPoint[0]+width,centerPoint[1]],(i,t,x)=>[centerPoint[0]+width-arrowBack,centerPoint[1]-height], color);
		}
		addTo(scene){
			scene.push(this.lineA);
			scene.push(this.lineB);
			scene.push(this.lineC);
		}
		removeFromScene(scene){
			this.removeFrom(scene,this.lineA);
			this.removeFrom(scene,this.lineB);
			this.removeFrom(scene,this.lineC);
		}
		removeFrom(scene, thing){
			var index = scene.indexOf( thing );
			if ( index !== - 1 ) {
				scene.splice( index, 1 );
			}
		}
		async reveal(duration,delay=500){
			this.lineA.out.opacity = 1;
			this.lineB.out.opacity = 1;
			this.lineC.out.opacity = 1;
			this.lineA.reveal(duration);
			await EXP.delay(delay);
			this.lineB.reveal(duration);
			this.lineC.reveal(duration);
		}
		async fadeOut(duration,delay=500){
			EXP.TransitionTo(this.lineA.out, {'opacity': 0},duration);
			EXP.TransitionTo(this.lineB.out, {'opacity': 0},duration);
			EXP.TransitionTo(this.lineC.out, {'opacity': 0},duration);
			await EXP.delay(duration);
			EXP.TransitionTo(this.lineA.revealTransform,{'expr': (i,t,x) => [0]},10);
			EXP.TransitionTo(this.lineB.revealTransform,{'expr': (i,t,x) => [0]},10);
			EXP.TransitionTo(this.lineC.revealTransform,{'expr': (i,t,x) => [0]},10);
		}
	}

	export class XSign extends PlusSign{
		constructor(centerPoint, height, width, color){
			super(centerPoint, height, color);
			this.lineA = new twoPointLine((i,t,x)=>[centerPoint[0]+width,centerPoint[1]+height],(i,t,x)=>[centerPoint[0]-width,centerPoint[1]-height],color)
			this.lineB = new twoPointLine((i,t,x)=>[centerPoint[0]+width,centerPoint[1]-height],(i,t,x)=>[centerPoint[0]-width,centerPoint[1]+height], color);
		}
	}

	export class Box{
		constructor(bottomLeftCorner,topRightCorner, color){

			this.lineA = new twoPointLine((i,t,x)=>[bottomLeftCorner[0], topRightCorner[1]],(i,t,x)=>[topRightCorner[0],topRightCorner[1]], color);
			this.lineB = new twoPointLine((i,t,x)=>[topRightCorner[0],topRightCorner[1]],(i,t,x)=>[topRightCorner[0], bottomLeftCorner[1]], color);
			this.lineC = new twoPointLine((i,t,x)=>[topRightCorner[0], bottomLeftCorner[1]],(i,t,x)=>[bottomLeftCorner[0],bottomLeftCorner[1]], color);
			this.lineD = new twoPointLine((i,t,x)=>[bottomLeftCorner[0],bottomLeftCorner[1]],(i,t,x)=>[bottomLeftCorner[0], topRightCorner[1]], color);

			this.lines = [this.lineA,this.lineB,this.lineC,this.lineD];

			/*
			//THIS DOESN'T WORK. I HATE REFERENCES. I HATE JAVASCRIPT

			let BLCorner = [bottomLeftCorner[0],bottomLeftCorner[1]];
			let TRCorner = [topRightCorner[0],topRightCorner[1]];
			let topLeftCorner = [bottomLeftCorner[0], topRightCorner[1]];
			let bottomRightCorner = [topRightCorner[0], bottomLeftCorner[1]];
			this.lineA = new twoPointLine((i,t,x)=>topLeftCorner,(i,t,x)=>TRCorner, color);
			this.lineB = new twoPointLine((i,t,x)=>TRCorner,(i,t,x)=>bottomRightCorner, color);
			this.lineC = new twoPointLine((i,t,x)=>bottomRightCorner,(i,t,x)=>BLCorner, color);
			this.lineD = new twoPointLine((i,t,x)=>BLCorner,(i,t,x)=>topLeftCorner, color);
			*/
		}
		addTo(scene){
			this.lines.forEach((i) => scene.push(i));
		}
		async reveal(duration, delay=500){
			this.lineA.reveal(duration);
			await EXP.delay(delay);
			this.lineB.reveal(duration);
			await EXP.delay(delay);
			this.lineC.reveal(duration);
			await EXP.delay(delay);
			this.lineD.reveal(duration);
		}
		async fadeOut(duration,delay=500){
			[this.lineA,this.lineB,this.lineC,this.lineD].forEach((i) => EXP.TransitionTo(i.out, {'opacity': 0},duration));

			await EXP.delay(duration);
			this.lines.forEach((i) => EXP.TransitionTo(i.revealTransform,{'expr': (i,t,x) => [0]},10));
		}
	}
