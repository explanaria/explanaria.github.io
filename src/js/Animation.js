class Animation{
	constructor(target, toValues, duration){
		assertType(toValues, Object);

		this.toValues = toValues;
		this.target = target;	

		this.fromValues = {};
		for(var property in this.toValues){
			assertPropExists(this.target, property);

			//copy property, making sure to store the correct 'this'
			if(isFunction(this.target[property])){
				this.fromValues[property] = this.target[property].bind(this.target);
			}else{
				this.fromValues[property] = this.target[property];
			}
		}


		this.duration = duration === undefined ? 1 : duration; //in s
		this.elapsedTime = 0;

		this._updateCallback = this.update.bind(this)
		three.on("update",this._updateCallback);
	}
	update(time){
		this.elapsedTime += time.delta;	

		let percentage = this.elapsedTime/this.duration;

		//interpolate values
		for(let property in this.toValues){
			this.interpolate(percentage, property, this.fromValues[property],this.toValues[property]);
		}

		if(percentage >= 1){
			this.end();
		}
	}
	interpolate(percentage, propertyName, fromValue, toValue){
		let t = this.interpolationFunction(percentage);

		var newValue = null;
		if(typeof(toValue) === "number" && typeof(fromValue) === "number"){
			this.target[propertyName] = t*toValue + (1-t)*fromValue;
			return;
		}else if(isFunction(toValue) && isFunction(fromValue)){
			
			//encapsulate percentage
			this.target[propertyName] = function(...coords){return vectorAdd(multiplyScalar(t,toValue(...coords)),multiplyScalar(1-t,fromValue(...coords)))};
			return;
		}else{
			console.error("Animation class cannot yet handle transitioning between things that aren't numbers or functions!");
		}

	}
	interpolationFunction(x){
		return this.cosineInterpolation(x);
	}
	cosineInterpolation(x){
		return (1-Math.cos(x*Math.PI))/2;
	}
	linearInterpolation(x){
		return x;
	}
	end(){
		for(var prop in this.toValues){
			this.target[prop] = this.toValues[prop];
		}
		three.removeEventListener("update",this._updateCallback);
	}
}

function TransitionTo(target, toValues){
	var animation = new Animation(target, toValues);
}
