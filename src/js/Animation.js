import { Utils } from './utils.js';

import { Transformation } from './Transformation.js';

import * as math from './math.js';
import { threeEnvironment } from './ThreeEnvironment.js';

let EPS = Number.EPSILON;

const Easing = {EaseInOut:1,EaseIn:2,EaseOut:3};

class Interpolator{
    constructor(fromValue, toValue, interpolationFunction){
        this.toValue = toValue;
        this.fromValue = fromValue;
        this.interpolationFunction = interpolationFunction;
    }
    interpolate(percentage){} //percentage is 0-1 linearly
}
class NumberInterpolator extends Interpolator{
    constructor(fromValue, toValue, interpolationFunction){
        super(fromValue, toValue, interpolationFunction);
    }
    interpolate(percentage){
		let t = this.interpolationFunction(percentage);
		return t*this.toValue + (1-t)*this.fromValue;
    }
}

class BoolInterpolator extends Interpolator{
    constructor(fromValue, toValue, interpolationFunction){
        super(fromValue, toValue, interpolationFunction);
    }
    interpolate(percentage){
        let t = this.interpolationFunction(percentage);
        if(t > 0.5){
            return this.toValue;
        }else{
            return this.fromValue;
        }
    }
}


class ThreeJsColorInterpolator extends Interpolator{
    constructor(fromValue, toValue, interpolationFunction){
        super(fromValue, toValue, interpolationFunction);
        this.tempValue = new THREE.Color();
    }
    interpolate(percentage){
        let t = this.interpolationFunction(percentage);
        this.tempValue.copy(this.fromValue);
        return this.tempValue.lerp(this.toValue, t);
    }
    interpolateAndCopyTo(percentage, target){
        let resultArray = this.interpolate(percentage);
        target.copy(resultArray);
    }
}
class ThreeJsVec3Interpolator extends Interpolator{
    constructor(fromValue, toValue, interpolationFunction){
        super(fromValue, toValue, interpolationFunction);
        if(Utils.isArray(toValue) && toValue.length <= 3){
            this.toValue = new THREE.Vector3(...this.toValue);
        }
        this.tempValue = new THREE.Vector3();
    }
    interpolate(percentage){
        let t = this.interpolationFunction(percentage);
        return this.tempValue.lerpVectors(this.fromValue, this.toValue, t); //this modifies this.tempValue in-place and returns it
    }
    interpolateAndCopyTo(percentage, target){
        let resultArray = this.interpolate(percentage);
        target.copy(resultArray);
    }
}

class TransformationFunctionInterpolator extends Interpolator{
    constructor(fromValue, toValue, interpolationFunction, staggerFraction, targetNumCallsPerActivation){
        super(fromValue, toValue, interpolationFunction);
        this.staggerFraction = staggerFraction;
        this.targetNumCallsPerActivation = targetNumCallsPerActivation;
    }
    interpolate(percentage){
			//if staggerFraction != 0, it's the amount of time between the first point's start time and the last point's start time.
			//ASSUMPTION: the first variable of this function is i, and it's assumed i is zero-indexed.
			//encapsulate percentage

			return (function(...coords){
                const i = coords[0];
				let lerpFactor = percentage;

                //fancy staggering math, if we know how many objects are flowing through this transformation at once
                if(this.targetNumCallsPerActivation !== undefined){
                    lerpFactor = percentage/(1-this.staggerFraction+EPS) - i*this.staggerFraction/this.targetNumCallsPerActivation;
                }
				//let percent = Math.min(Math.max(percentage - i/this.targetNumCallsPerActivation   ,1),0);

				let t = this.interpolationFunction(Math.max(Math.min(lerpFactor,1),0));
				return math.lerpVectors(t,this.toValue(...coords),this.fromValue(...coords))
			}).bind(this);
    }
}

class Numeric1DArrayInterpolator extends Interpolator{
    constructor(fromValue, toValue, interpolationFunction){
        super(fromValue, toValue, interpolationFunction);
        this.largestLength = Math.max(fromValue.length, toValue.length);
        this.shortestLength = Math.min(fromValue.length, toValue.length);
        this.fromValueIsShorter = fromValue.length < toValue.length;
        this.resultArray = new Array(this.largestLength); //cached for speedup
    }
    interpolate(percentage){
		let t = this.interpolationFunction(percentage);
        for(let i=0;i<this.shortestLength;i++){
            this.resultArray[i] = t*this.toValue[i] + (1-t)*this.fromValue[i];
        }

        //if one array is longer than the other, interpolate as if the shorter array is padded with zeroes
        if(this.fromValueIsShorter){
            //this.fromValue[i] doesn't exist, so assume it's a zero
            for(let i=this.shortestLength;i<this.largestLength;i++){
                this.resultArray[i] = t*this.toValue[i]; // + (1-t)*0;
            }
        }else{
            //this.toValue[i] doesn't exist, so assume it's a zero
            for(let i=this.shortestLength;i<this.largestLength;i++){
                this.resultArray[i] = (1-t)*this.fromValue[i]; // + t*0 
            }
        }
        return this.resultArray;
    }
    interpolateAndCopyTo(percentage, target){
        let resultArray = this.interpolate(percentage);
        for(let i=0;i<resultArray.length;i++){
            target[i] = resultArray[i];
        }
    }
}

class FallbackDoNothingInterpolator extends Interpolator{
    constructor(fromValue, toValue, interpolationFunction){
        super(fromValue, toValue, interpolationFunction);
    }
    interpolate(percentage){
        return this.fromValue;
    }
}





const ExistingAnimationSymbol = Symbol('CurrentEXPAnimation')


class Animation{
	constructor(target, toValues, duration=1, optionalArguments={}){
        if(!Utils.isObject(toValues) && !Utils.isArray(toValues)){
				console.error("Error transitioning: toValues must be an array or an object.");
        }

		this.toValues = toValues;
		this.target = target;	
		this.duration = duration; //in s

        //Parse optional values in optionalArguments

        //choose easing function
        this.easing = optionalArguments.easing === undefined ? Easing.EaseInOut : optionalArguments.easing;//default, Easing.EaseInOut
        this.interpolationFunction = Animation.cosineEaseInOutInterpolation; 
        if(this.easing == Easing.EaseIn){
            this.interpolationFunction = Animation.cosineEaseInInterpolation;
        }else if(this.easing == Easing.EaseOut){
            this.interpolationFunction = Animation.cosineEaseOutInterpolation;
        }

        //setup values needed for staggered animation
        this.staggerFraction = optionalArguments.staggerFraction === undefined ? 0 : optionalArguments.staggerFraction; // time in ms between first element beginning the animation and last element beginning the animation. Should be less than duration.
		Utils.assert(this.staggerFraction >= 0 && this.staggerFraction < 1);
		if(target.constructor === Transformation){
			this.targetNumCallsPerActivation = target.getTopParent().numCallsPerActivation;
		}else{
			if(this.staggerFraction != 0){
				console.error("staggerFraction can only be used when TransitionTo's target is an EXP.Transformation!");
			}
		}

        this.mode = "copyProperties";
        
		this.fromValues = {};
        this.interpolators = [];
        this.interpolatingPropertyNames = [];
        if(!Utils.isArray(toValues)){
		    for(var property in this.toValues){
			    Utils.assertPropExists(this.target, property);

			    //copy property, making sure to store the correct 'this'
			    if(Utils.isFunction(this.target[property])){
				    this.fromValues[property] = this.target[property].bind(this.target);
			    }else{
				    this.fromValues[property] = this.target[property];
			    }

                this.interpolators.push(this.chooseInterpolator(this.fromValues[property], this.toValues[property],this.interpolationFunction));
                this.interpolatingPropertyNames.push(property);
		    }
        }else{
            this.mode = "copyToTarget";
            //support Animation([a,b,c],[a,b,c,d,e]) where fromValues[property] might not be interpolatable, but fromValues is
		    this.fromValues = EXP.Math.clone(this.target);
            let wholeThingInterpolator = this.chooseInterpolator(this.fromValues, this.toValues,this.interpolationFunction);
            this.interpolators.push(wholeThingInterpolator);
        }


		this.elapsedTime = 0;
        this.prevTrueTime = 0;

        if(this.target[ExistingAnimationSymbol] !== undefined){
            this.dealWithExistingAnimation();
        }
        this.target[ExistingAnimationSymbol] = this;

		//begin
		this._updateCallback = this.update.bind(this)
		threeEnvironment.on("update",this._updateCallback);
	}
    dealWithExistingAnimation(){
        //if another animation is halfway through playing when this animation starts, preempt it
        let previousAnimation = this.target[ExistingAnimationSymbol];

        //todo: fancy blending
        previousAnimation.end();
		for(var property in this.fromValues){
            if(property in previousAnimation.toValues){
                this.fromValues[property] = previousAnimation.toValues[property];
    		}
		}
    }
    chooseInterpolator(fromValue, toValue, interpolationFunction){
		if(typeof(toValue) === "number" && typeof(fromValue) === "number"){
            //number-number
            return new NumberInterpolator(fromValue, toValue, interpolationFunction);
		}else if(Utils.isFunction(toValue) && Utils.isFunction(fromValue)){
            //function-function
			return new TransformationFunctionInterpolator(fromValue, toValue, interpolationFunction, this.staggerFraction, this.targetNumCallsPerActivation);
		}else if(toValue.constructor === THREE.Color && fromValue.constructor === THREE.Color){
            //THREE.Color
            return new ThreeJsColorInterpolator(fromValue, toValue, interpolationFunction);
        }else if(fromValue.constructor === THREE.Vector3 && (toValue.constructor === THREE.Vector3 || Utils.is1DNumericArray(toValue))){
            //THREE.Vector3 - but we can also interpret a toValue of [a,b,c] as new THREE.Vector3(a,b,c)
            return new ThreeJsVec3Interpolator(fromValue, toValue, interpolationFunction);
        }else if(typeof(toValue) === "boolean" && typeof(fromValue) === "boolean"){
            //boolean
            return new BoolInterpolator(fromValue, toValue, interpolationFunction);
		}else if(Utils.is1DNumericArray(toValue) && Utils.is1DNumericArray(fromValue)){
            //function-function
			return new Numeric1DArrayInterpolator(fromValue, toValue, interpolationFunction);
        }else{
            //We don't know how to interpolate this. Instead we'll just do nothing, and at the end of the animation we'll just set the target to the toValue.
			console.error("Animation class cannot yet handle transitioning between things that aren't numbers or functions or arrays!");
            return new FallbackDoNothingInterpolator(fromValue, toValue, interpolationFunction);
		}
    }
	update(time){
		this.elapsedTime += time.realtimeDelta;	

		let percentage = this.elapsedTime/this.duration;

		//interpolate values
        if(this.mode == 'copyProperties'){
		    for(let i=0;i<this.interpolators.length;i++){
                let propertyName = this.interpolatingPropertyNames[i];
			    this.target[propertyName] = this.interpolators[i].interpolate(percentage);
		    }
        }else{
            //copy to target
            this.interpolators[0].interpolateAndCopyTo(percentage, this.target);
        }

		if(this.elapsedTime >= this.duration){
			this.end();
		}
	}
	static cosineEaseInOutInterpolation(x){
		return (1-Math.cos(x*Math.PI))/2;
	}
	static cosineEaseInInterpolation(x){
		return (1-Math.cos(x*Math.PI/2));
	}
	static cosineEaseOutInterpolation(x){
		return Math.sin(x * Math.PI/2);
	}
	static linearInterpolation(x){
		return x;
	}
	end(){
		for(var prop in this.toValues){
			this.target[prop] = this.toValues[prop];
		}
		threeEnvironment.removeEventListener("update",this._updateCallback);
        this.target[ExistingAnimationSymbol] = undefined;
	}
}

function TransitionTo(target, toValues, durationMS, optionalArguments){
    //if someone's using the old calling strategy of staggerFraction as the last argument, convert it properly
    if(optionalArguments && Utils.isNumber(optionalArguments)){
        optionalArguments = {staggerFraction: optionalArguments};
    }
	var animation = new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000, optionalArguments);
}

export {TransitionTo, Animation, Easing}
