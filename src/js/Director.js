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
		this.slides = [];
		this.currentSlideIndex = 0;        
        this.numSlides = 0;
        this.numHTMLSlides = 0;

		this.nextSlideResolveFunction = null;
        this.initialized = false;
	}


	async begin(){
		await this.waitForPageLoad();
        this.slides = document.getElementsByClassName("exp-slide");
        this.numHTMLSlides = this.slides.length;

        //hide all slides except first one
		for(var i=0;i<this.numHTMLSlides;i++){
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
		for(var i=0;i<this.numHTMLSlides;i++){
			if(i != slideNumber)this.slides[i].style.opacity = 0;
		}
        if(slideNumber >= this.numHTMLSlides){
            console.error("Tried to show slide #"+slideNumber+", but only " + this.numHTMLSlides + "HTML elements with exp-slide were found! Make more slides?");
            return;
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
		//Utils.Assert(this.undoStackIndex == 0); //This may not work well.
		new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000);
	}
}







class UndoCapableDirector extends NonDecreasingDirector{
    //thsi director uses both forwards and backwards arrows. the backwards arrow will undo any UndoCapableDirector.TransitionTo()s
    //todo: hook up the arrows and make it not
	constructor(options){
        super(options);

        this.furthestSlideIndex = 0; //matches the number of times nextSlide() has been called
        //this.currentSlideIndex is always < this.furthestSlideIndex - if equal, we release the promise and let nextSlide() return

		this.undoStack = [];
		this.undoStackIndex = 0; //increased by one every time either this.TransitionTo is called or this.nextSlide() is called

		this.leftArrow = new DirectionArrow(false);
		document.body.appendChild(this.leftArrow.arrowImage);
		this.leftArrow.onclickCallback = function(){} //todo: put this in

        this.nextSlideResolveFunction = function(){} //if you press right before the first director.nextSlide(), don't error

        let self = this;
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
                if(slideDelta == 1){
                    self.handleForwardsPress();
                }else if(slideDelta == -1){
                    self.handleBackwardsPress();
                }
			}
		}

		window.addEventListener("keydown", keyListener);
	}

    moveFurtherIntoPresentation(){
            //when not in the past (and therefore with nothing to redo), advance further.
            //if there are less HTML slides than calls to director.newSlide(), complain in the console but allow the presentation to proceed
            if(this.currentSlideIndex < this.numSlides){
                this.undoStackIndex += 1; //advance past the NewSlideUndoItem
                this.furthestSlideIndex += 1; 
                this.currentSlideIndex += 1; //should still equal furthestSlideIndex
            }

            this.showSlide(this.currentSlideIndex); //this will complain in the console window if there are less slides than newSlide() calls
            this.nextSlideResolveFunction(); //allow presentation code to proceed
    }

    handleForwardsPress(){
        if(this.furthestSlideIndex == this.currentSlideIndex){
            //unpause code execution and show next slide
            this.moveFurtherIntoPresentation();
            return;
        }
        // if we get to here, we've previously done an undo and we need to catch up

        if(this.undoStackIndex < this.undoStack.length-1) this.undoStackIndex += 1;

        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
            //loop through undo stack and redo each undo

            if(this.undoStackIndex == this.undoStack.length){
                //fully undone and at current slide
                break;
            }

            //redo transformation in this.undoStack[this.undoStackIndex]
            let redoItem = this.undoStack[this.undoStackIndex]
            var redoAnimation = new Animation(redoItem.target, redoItem.toValues, redoItem.durationMS === undefined ? undefined : redoItem.durationMS/1000);
            //and now redoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething

            this.undoStackIndex += 1;
        }
        this.currentSlideIndex += 1;
        this.showSlide(this.currentSlideIndex);
    }

    handleBackwardsPress(){

        if(this.undoStackIndex == 0 || this.currentSlideIndex == 0){
            return;
        }

        this.undoStackIndex -= 1;
        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
            //loop through undo stack and redo each undo

            if(this.undoStackIndex == 0){
                //at first slide
                break;
            }

            //undo transformation in this.undoStack[this.undoStackIndex]
            let undoItem = this.undoStack[this.undoStackIndex];
            let duration = undoItem.durationMS === undefined ? 1 : undoItem.durationMS/1000;
            duration = Math.min(duration / 2, 1); //undoing should be faster, so cut it in half - but cap durations at 1s
            var undoAnimation = new Animation(undoItem.target, undoItem.fromValues, duration);
            //and now undoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething

            this.undoStackIndex -= 1;
        }
        this.currentSlideIndex -= 1;
        this.showSlide(this.currentSlideIndex);

    }

	async nextSlide(){
        /*The user will call this function to mark the transition between one slide and the next. This does two things:
        A) waits until the user presses the right arrow key, returns, and continues execution until the next nextSlide() call
        B) if the user presses the left arrow key, they can undo and go back in time, and every TransitionTo() call before that will be undone until it reaches a previous nextSlide() call. Any normal javascript assignments won't be caught in this :(
        C) if undo
        */
        
        this.numSlides++;
        this.undoStack.push(new NewSlideUndoItem(this.currentSlideIndex));


        if(!this.initialized)throw new Error("ERROR: Use .begin() on a Director before calling any other methods!");

		let self = this;

		//promise is resolved by calling this.nextSlideResolveFunction() when the time comes
		return new Promise(function(resolve, reject){
			self.nextSlideResolveFunction = function(){ 
				resolve();
			}
		});

	}
	TransitionTo(target, toValues, durationMS){
		var animation = new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000);
		let fromValues = animation.fromValues;
		this.undoStack.push(new UndoItem(target, toValues, fromValues, durationMS));
		this.undoStackIndex++;
	}
}



class UndoItem{
	constructor(target, toValues, fromValues, durationMS){
		this.target = target;
		this.toValues = toValues;
		this.fromValues = fromValues;
		this.durationMS = durationMS;
	}
}
class NewSlideUndoItem{
	constructor(slideIndex){
        this.slideIndex = slideIndex;
	}
}

export { NonDecreasingDirector, DirectionArrow, UndoCapableDirector };
