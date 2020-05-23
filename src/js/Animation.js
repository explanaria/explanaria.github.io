import { Utils } from './utils.js';

import { Transformation } from './Transformation.js';

import * as math from './math.js';
import { threeEnvironment } from './ThreeEnvironment.js';

let EPS = Number.EPSILON;

const EaseInOut = 1;
const EaseIn = 2;
const EaseOut = 3;

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
        this.target[propertyName] = t > 0.5 ? this.toValue : this.fromValue;
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






class Animation{
	constructor(target, toValues, duration=1, staggerFraction=0, easing=EaseInOut){
		Utils.assertType(toValues, Object);

		this.toValues = toValues;
		this.target = target;	
		this.staggerFraction = staggerFraction; // time in ms between first element beginning the animation and last element beginning the animation. Should be less than duration.
		Utils.assert(this.staggerFraction >= 0 && this.staggerFraction < 1);
		this.duration = duration; //in s

        //choose easing function
        this.interpolationFunction = Animation.cosineEaseInOutInterpolation; //default
        if(easing == EaseIn){
            this.interpolationFunction = Animation.cosineEaseInInterpolation;
        }else if(easing == EaseOut){
            this.interpolationFunction = Animation.cosineEaseOutInterpolation;
        }

        //setup values needed for staggered animation
		if(target.constructor === Transformation){
			this.targetNumCallsPerActivation = target.getTopParent().numCallsPerActivation;
		}else{
			if(this.staggerFraction != 0){
				console.error("staggerFraction can only be used when TransitionTo's target is an EXP.Transformation!");
			}
		}
        
		this.fromValues = {};
        this.interpolators = [];
        this.interpolatingPropertyNames = [];
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


		this.elapsedTime = 0;
        this.prevTrueTime = 0;

		//begin
		this._updateCallback = this.update.bind(this)
		threeEnvironment.on("update",this._updateCallback);
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
        }else if(typeof(toValue) === "boolean" && typeof(fromValue) === "boolean"){
            //boolean
            return new BoolInterpolator(fromValue, toValue, interpolationFunction);
        }else{
            //We don't know how to interpolate this. Instead we'll just do nothing, and at the end of the animation we'll just set the target to the toValue.
			console.error("Animation class cannot yet handle transitioning between things that aren't numbers or functions!");
		}
    }
	update(time){
		this.elapsedTime += time.realtimeDelta;	

		let percentage = this.elapsedTime/this.duration;

		//interpolate values
		for(let i=0;i<this.interpolators.length;i++){
            let propertyName = this.interpolatingPropertyNames[i];
			this.target[propertyName] = this.interpolators[i].interpolate(percentage);
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
	}
}

//todo: put this into a Director class so that it can have an undo stack
function TransitionTo(target, toValues, durationMS, staggerFraction){
	var animation = new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000, staggerFraction);
}

export {TransitionTo, Animation}
