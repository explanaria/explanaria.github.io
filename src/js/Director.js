"use strict";

/*This class is supposed to turn a series of
dir.delay()
dir.transitionTo(...)
dir.delay()
dir.nextSlide();

*/

var EXP = EXP || {};

EXP.DirectionArrow = class DirectionArrow{
	constructor(faceRight){
		this.arrowImage = EXP.DirectionArrow.arrowImage; //this should be changed once I want to make multiple arrows at once

		faceRight = faceRight===undefined ? true : faceRight;

		if(faceRight){
			this.arrowImage.classList.add("exp-arrow-right")
		}else{
			this.arrowImage.classList.add("exp-arrow-left")
		}
		this.arrowImage.onclick = (function(){
			this.onclick();
		}).bind(this);

		this.onclickCallback = null; // to be set externally
	}
	onclick(){
		this.hideSelf();
		this.onclickCallback();
	}
	showSelf(){
		this.arrowImage.style.pointerEvents = '';
		this.arrowImage.style.opacity = 1;
		
	}
	hideSelf(){
		this.arrowImage.style.opacity = 0;
		this.arrowImage.style.pointerEvents = 'none';
	}
	static async loadImage(){
		return new Promise(
			(function(resolve, reject){
				if(this.arrowImage && this.arrowImage.width != 0){
					return resolve(); //quit early
				}
				this.arrowImage = new Image();
				this.arrowImage.src = "../src/ExplanarianNextArrow.svg";
				this.arrowImage.className = "exp-arrow";
			}).bind(this));
	}
}
EXP.DirectionArrow.loadImage(); // preload


EXP.NonDecreasingDirector = class NonDecreasingDirector{
	// I want EXP.Director() to be able to backtrack by pressing backwards. This doesn't do that.
	constructor(options){
		this.undoStack = [];
		this.undoStackIndex = 0;

		this.slides = document.getElementsByClassName("exp-slide");
		this.currentSlideIndex = 0;

		this.nextSlideResolveFunction = null;
	}


	async begin(){
		await this.waitForPageLoad();

		this.rightArrow = new EXP.DirectionArrow();
		document.body.appendChild(this.rightArrow.arrowImage);
		let self = this;
		this.rightArrow.onclickCallback = function(){
			self._changeSlide(1, function(){}); // this errors without the empty function because there's no resolve. There must be a better way to do things.
			console.warn("WARNING: Horrible hack in effect to change slides. Please replace the pass-an-empty-function thing with somethign that actually resolves properly and does async.")
			self.nextSlideResolveFunction();
		}

	}

	async waitForPageLoad(){
		return new Promise(function(resolve, reject){
			window.addEventListener("load",resolve);
		});
	}

	showSlide(slideNumber){
		for(var i=0;i<this.slides.length;i++){
			this.slides[i].style.opacity = 0;
		}
		this.slides[slideNumber].style.opacity = 1;
	}

	async nextSlide(){
		let self = this;

		this.rightArrow.showSelf();
		//promise is resolved by calling this.nextSlidePromise.resolve() when the time comes

		return new Promise(function(resolve, reject){
			function keyListener(e){
				if(e.repeat)return; //keydown fires multiple times but we only want the first one
				let slideDelta = 0;
				switch (e.keyCode) {
				  case 34:
				  case 39:
				  case 40:
					slideDelta = 1;
					break;
				  default:
					break;
				}
				if(slideDelta != 0){
					self._changeSlide(slideDelta, resolve);
					self.rightArrow.hideSelf();
					window.removeEventListener("keydown",keyListener); //this approach taken from https://stackoverflow.com/questions/35718645/resolving-a-promise-with-eventlistener
				}
			}

			window.addEventListener("keydown", keyListener);
			//horrible hack so that the 'next slide' arrow can trigger this too
			self.nextSlideResolveFunction = function(){ 
				resolve();
				window.removeEventListener("keydown",keyListener); 
			}
		});
	}
	_changeSlide(slideDelta, resolve){
			//slide changing logic


		//right now there is a problem. Going backwards should not resolve the promise; only going to the most recent slide and pressing right should.
		if(slideDelta != 0){
			if(this.currentSlideIndex == 0 && slideDelta == -1){
				return;
			}
			if(this.currentSlideIndex == this.slides.length-1 && slideDelta == 1){
				return;
			}
			this.currentSlideIndex += slideDelta;
			this.showSlide(this.currentSlideIndex);
			resolve();
		}
	}
	//verbs
	async delay(waitTime){
		return new Promise(function(resolve, reject){
			window.setTimeout(resolve, waitTime);
		});
	}
	transitionTo(target, toValues, durationMS){
		//EXP.Utils.Assert(this.undoStackIndex == 0); //This may not work well.
		new EXP.Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000);
	}
}
/*
EXP.Director = class Director{
	//todo. Make this able to backtrack
	constructor(options){
		this.undoStack = [];
		this.undoStackIndex = 0;

		this.slides = document.getElementsByClassName("exp-slide");
		this.currentSlideIndex = 0;
		//this.showSlide(0); //fails because DOM isn't loaded.
	}

	async waitForPageLoad(){
		return new Promise(function(resolve, reject){
			window.addEventListener("load",resolve);
		});
	}

	showSlide(slideNumber){
		for(var i=0;i<this.slides.length;i++){
			this.slides[i].style.opacity = 0;
		}
		this.slides[slideNumber].style.opacity = 1;
	}

	nextSlide(){
		let self = this;
		return new Promise(function(resolve, reject){
			window.addEventListener("keypress", function keyListener(e){
				let slideDelta = 0;
				switch (e.keyCode) {
				  case 33:
				  case 37:
				  case 38:
					slideDelta = -1;
					break;
				  case 34:
				  case 39:
				  case 40:
					slideDelta = 1;
					break;
				}
				self._changeSlide(slideDelta, resolve);
				window.removeEventListener("keypress",keyListener); //this approach taken from https://stackoverflow.com/questions/35718645/resolving-a-promise-with-eventlistener
			});
		});
	}
	_changeSlide(slideDelta, resolve){
			//slide changing logic
		if(slideDelta != 0){
			if(this.currentSlideIndex == 0 && slideDelta == -1){
				return;
			}
			if(this.currentSlideIndex == this.slides.length-1 && slideDelta == 1){
				return;
			}
				console.log(slideDelta, this.currentSlideIndex);
			this.currentSlideIndex += slideDelta;
			this.showSlide(this.currentSlideIndex);
			resolve();
		}
	}

	//verbs
	async delay(waitTime){
		return new Promise(function(resolve, reject){
			window.setTimeout(resolve, waitTime);
		});
	}
	transitionTo(target, toValues, durationMS){
		//EXP.Utils.Assert(this.undoStackIndex == 0); //This may not work well.
		var animation = new EXP.Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000);
		let fromValues = animation.fromValues;
		this.undoStack.push(new EXP.Director.UndoItem(target, toValues, fromValues, durationMS));
		this.undoStackIndex++;
	}
}

EXP.Director.UndoItem = class UndoItem{
	constructor(target, toValues, fromValues, durationMS){
		this.target = target;
		this.toValues = toValues;
		this.fromValues = fromValues;
		this.durationMS = durationMS;
	}
}*/
