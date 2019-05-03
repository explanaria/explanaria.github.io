"use strict";

/*This class is supposed to turn a series of
dir.delay()
dir.transitionTo(...)
dir.delay()
dir.nextSlide();

into a sequence that only advances when the right arrow is pressed.

Any divs with the exp-slide class will also be shown and hidden one by one.

*/

import {Animation} from './Animation.js';
import explanarianArrowSVG from './DirectorImageConstants.js';

class DirectionArrow{
	constructor(faceRight){
		this.arrowImage = new Image();
        this.arrowImage.src = explanarianArrowSVG;

        this.arrowImage.classList.add("exp-arrow");

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
}


class NonDecreasingDirector{
	// I want Director() to be able to backtrack by pressing backwards. This doesn't do that.
	constructor(options){
		this.undoStack = [];
		this.undoStackIndex = 0;

		this.slides = [];
		this.currentSlideIndex = 0;

		this.nextSlideResolveFunction = null;
        this.initialized = false;
	}


	async begin(){
		await this.waitForPageLoad();
        this.slides = document.getElementsByClassName("exp-slide");

        //hide all slides except first one
		for(var i=0;i<this.slides.length;i++){
            this.slides[i].style.opacity = 0; 
			this.slides[i].style.display = 'none';//opacity=0 alone won't be instant because of the 1s CSS transition
		}
		let self = this;
        //undo setting display-none after a bit of time
        window.setTimeout(function(){
		    for(var i=0;i<self.slides.length;i++){
			    self.slides[i].style.display = '';
		    }
        },1);

        this.showSlide(0); //unhide first one

		this.rightArrow = new DirectionArrow();
		document.body.appendChild(this.rightArrow.arrowImage);
		this.rightArrow.onclickCallback = function(){
			self._changeSlide(1, function(){}); // this errors without the empty function because there's no resolve. There must be a better way to do things.
			console.warn("WARNING: Horrible hack in effect to change slides. Please replace the pass-an-empty-function thing with something that actually resolves properly and does async.")
			self.nextSlideResolveFunction();
		}

        this.initialized = true;

	}

	async waitForPageLoad(){
		return new Promise(function(resolve, reject){
            if(document.readyState == 'complete'){
                resolve();
            }
			window.addEventListener("DOMContentLoaded",resolve);
		});
	}

	showSlide(slideNumber){
		for(var i=0;i<this.slides.length;i++){
			if(i != slideNumber)this.slides[i].style.opacity = 0;
		}
		this.slides[slideNumber].style.opacity = 1;
	}

	async nextSlide(){
        if(!this.initialized)throw new Error("ERROR: Use .begin() on a Director before calling any other methods!");

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
				return; //no going past the beginning
			}
			if(this.currentSlideIndex == this.slides.length-1 && slideDelta == 1){
				return; //no going past the end
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
	TransitionTo(target, toValues, durationMS){
		//EXP.Utils.Assert(this.undoStackIndex == 0); //This may not work well.
		new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000);
	}
}

class UndoCapableDirector extends NonDecreasingDirector{
	//todo. Make this able to backtrack
	constructor(options){
        super(options);
	}

	async nextSlide(){    if(!this.initialized)throw new Error("ERROR: Use .begin() on a Director before calling any other methods!");

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
                  case 33:
                  case 37:
                  case 38:
                    slideDelta = -1;
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
EXP.Director.NewSlideUndoPoint = class NewSlide{
	constructor(slideIndex){
        this.slideIndex = slideIndex;
	}
}

export { NonDecreasingDirector, DirectionArrow, UndoCapableDirector };
