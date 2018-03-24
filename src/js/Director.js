"use strict";

/*This class is supposed to turn a series of
dir.delay()
dir.transitionTo(...)
dir.delay()
dir.nextSlide();

*/

var EXP = EXP || {};

EXP.Director = class Director{
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
			window.addEventListener("keydown", (function(e){
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
				console.log(slideDelta);
				self._changeSlide(slideDelta, resolve)
			}));
		});
	}
	_changeSlide(slideDelta, resolve){
			//slide changing logic
		if(slideDelta != 0){
			if(this.currentSlideIndex == 0 && slideDelta == -1){
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
}
