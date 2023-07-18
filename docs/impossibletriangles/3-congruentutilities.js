import * as EXP from "../resources/build/explanaria-bundle.js";

// things useful for elliptic curves
export class Line{
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

		return EXP.Math.lerpVectors(x, p1, p2);
	}
	revealSelf(presentation=null){
        if(presentation == null){
            presentation = EXP;
        }
		presentation.TransitionTo(this.revealTransform, {'expr': (i,t,x) => [x]}, 500);
	}
	hideSelf(presentation=null){
        if(presentation == null){
            presentation = EXP;
        }
		presentation.TransitionTo(this.revealTransform, {'expr': (i,t,x) => [0]}, 500);
	}
}

export class LongLineThrough extends Line{
	constructor(p1,p2, color, numSamples, howLong=5){
		super(p1,p2,color,numSamples);
        this.length = howLong;
		this.interval.bounds = [[-howLong, howLong]];
	}
	expr(i, t,x){
		//this.transform's expr
		let p1 = EXP.Math.clone(this.p1);
		let p2 = EXP.Math.clone(this.p2);

        let directionTarget = EXP.Math.vectorAdd(p1, EXP.Math.multiplyScalar(this.length/2, EXP.Math.normalize(EXP.Math.vectorSub(p2,p1))));

		return EXP.Math.lerpVectors(x, p1, directionTarget);
	}
}

export function elliptic_curve_add(p1,p2, curveparams){
	//carry out elliptic curve group law
	//assumed p1,p2 are not inverses and so p3 won't be O

	//The curve argument: the curve y^2 = x^3 + ax + b should be represented as [a,b]
	let slope=0;
	if(p1[0] != p2[0]){
		slope = (p2[1]-p1[1]) / (p2[0]-p1[0])
	}else{
		if(p1[1] != p2[1]){
				//RESULT IS 0
			console.warn("Points are inverses so addition result is O");
			return [p1[0], Infinity];
		}else{
			//p1 == p2
			slope = (3*p1[0]*p1[0] + curveparams[0]) / (2*p1[1])
		}
	}

	let x3 = slope*slope - p1[0] - p2[0];
	let y3 = slope*(x3 - p1[0]) + p1[1];

    y3 = -y3;

	return [x3,y3];
}

//unused
export class Fraction{
    constructor(numerator, denominator){
        this.numer = numerator;
        this.denom = denominator;
    }
    add(otherfraction){
        //a/b + c/d   = ad/bd + cb/bd
        let commonDenom = this.lcm(this.denom, otherfraction.denom);
        this.numer = (this.numer * otherfraction.denom + otherfraction.numer * this.denom);
        this.denom = commonDenom;
        this.reduce();
    }
    sub(otherfraction){
        let commonDenom = this.lcm(this.denom, otherfraction.denom);
        this.numer = (this.numer * otherfraction.denom - otherfraction.numer * this.denom);
        this.denom = commonDenom;
        this.reduce();
    }
    mult(otherfraction){
        this.numer *= otherfraction.numer;
        this.denom *= otherfraction.denom;
    }
    div(otherfraction){
        this.numer *= otherfraction.denom;
        this.denom *= otherfraction.numer;
        this.reduce();
    }
    reduce(){
        let gcd = this.gcd(this.numer, this.denom);
        this.numer /= gcd;
        this.denom /= gcd;
    }
    equals(otherfraction){
        return this.numer == otherfraction.numer && this.denom == otherfraction.denom;
    }
    lcm(a,b){
        return a*b/gcd(a,b);
    }
    gcd(a,b){
        if (a == 0){
            return b;
        }
        while (b != 0) {
            if (a > b)
                a = a - b;
            else
                b = b - a;
        }
        return a;
    }
}


export function elliptic_curve_add_fractions(p1,p2, curveparams){
	//this one assumes all arguments are arrays of fractions
	let slope=new Fraction(0,1);
	if(p1[0].equals(p2[0])){
		slope = p2[1].clone().sub(p1[1]).div(p2[0].sub(p1[0]))
	}else{
		if(p1[1].equals(p2[1])){
				//RESULT IS 0
			console.warn("Points are inverses so addition result is O");
			return [p1[0], Infinity];
		}else{
			//p1 == p2
			slope = new Fraction(3,1).mul(p1[0]).mul(p1[0]).add(new Fraction(curveparams[0],1));
            slope.div(new Fraction(2,1).mul(p1[1]))
		}
	}

	let x3 = slope.clone().mul(slope).sub(p1[0]).sub(p2[0]);
	let y3 = slope.clone().mul(x3.clone().sub(p1[0])).add(p1[1]);

	return [x3,y3];
}

export class ExponentiallySpacedInterval extends EXP.Array{
	// an interval that goes from -inf to inf, but with far more points centered around 0 than around, say, 5000.
	/*
	detailedPartWidth: 10
	detailedPartSpacing: 1/10
	nonDetailedExponentCount: 5 // number of
		//these defaults will produce a detailed area of [-5,-4.9,-4.8... 4.8,4.9,5] and then add [5,5^1.5, 5^2,5^3...] up to detailedPartWidth/2 ^ nonDetailedExponentCount, by default 5^5.
	
	*/

	constructor(options){
		options.detailedPartWidth = options.detailedPartWidth === undefined ? 10 : options.detailedPartWidth;
		options.detailedPartSpacing = options.detailedPartSpacing === undefined ? 1/10 : options.detailedPartSpacing;
		options.nonDetailedExponentCount = options.nonDetailedExponentCount === undefined ? 5 : options.nonDetailedExponentCount;

		let range = ExponentiallySpacedInterval.range;

		let positiveCurveRange = (range(0,options.detailedPartWidth/2,options.detailedPartSpacing)).concat(range(1,options.nonDetailedExponentCount,0.5).map(i => Math.pow(options.detailedPartWidth/2,i)))

		options.data = positiveCurveRange.map(i => -i).reverse().concat(positiveCurveRange);

		super(options);
	}
	static range(startAt = 0,endAt=10,step = 1) { // from https://stackoverflow.com/questions/3895478/does-javascript-have-a-method-like-range-to-generate-a-range-within-the-supp#10050831
		return [...Array(parseInt((endAt-startAt)/step)).keys()].map(i => i*step + startAt);
	}

}
