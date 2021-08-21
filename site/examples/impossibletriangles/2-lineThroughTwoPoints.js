
	class LineThroughTwoPoints{
		constructor(p1,p2, color, numSamples){
			this.interval = new EXP.Area({bounds: [[0, 1]], numItems:numSamples});
			//this.interval = new ExponentiallySpacedInterval({}); // uncomment if you want a near-infinitely long line for projective coordinates
			this.p1 = p1;
			this.p2 = p2;

			let startPt = p1;
			this.revealTransform = new EXP.Transformation({'expr':(i,t,x)=> [0]});
			this.transform = new EXP.Transformation({'expr':this.expr.bind(this)});
			this.transform2 = new EXP.Transformation({'expr': (i,t,...args) => args}); // available if you want to change something
			this.output = new EXP.LineOutput({width: 5, color: color});

			this.interval.add(this.revealTransform).add(this.transform).add(this.transform2).add(this.output);
		}
		activate(t){
			this.interval.activate(t);
		}
		expr(i, t,x){
			//this.transform's expr

			let p1 = EXP.Math.clone(this.p1);
			let p2 = EXP.Math.clone(this.p2);

			return EXP.Math.lerpVectors(x, p1, p2)
		}
		revealSelf(){
			EXP.TransitionTo(this.revealTransform, {'expr': (i,t,x) => [x]}, 500);
		}
	}

export {LineThroughTwoPoints};
