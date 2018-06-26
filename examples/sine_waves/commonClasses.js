

	let lightblue = 0x0070f0;
	let orangered = 0xff7070;
	let yellow = 0xffeb59;
	let lightgreen = 0x70ff70;


	class twoPointLine{
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

	class PlusSign{
		constructor(centerPoint, width, color){
			this.lineA = new twoPointLine((i,t,x)=>[centerPoint[0],centerPoint[1]+width],(i,t,x)=>[centerPoint[0],centerPoint[1]-width],color)
			this.lineB = new twoPointLine((i,t,x)=>[centerPoint[0]+width,centerPoint[1]],(i,t,x)=>[centerPoint[0]-width,centerPoint[1]], color);
		}
		addTo(scene){
			scene.push(this.lineA);
			scene.push(this.lineB);
		}
		async reveal(duration,delay=500){
			this.lineA.reveal(duration);
			await EXP.delay(delay);
			this.lineB.reveal(duration);
		}
	}

	class EqualsSign{
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
