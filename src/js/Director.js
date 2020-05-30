"use strict";

/*This class is supposed to turn a series of
dir.delay()
dir.transitionTo(...)
dir.delay()
dir.nextSlide();

into a sequence that only advances when the right arrow is pressed.

Any divs with the exp-slide class will also be shown and hidden one by one.

Also,

*/

import {Animation, Easing} from './Animation.js';
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
            this.hideSelf();
            this.onclickCallback();
        }).bind(this);

        this.onclickCallback = null; // to be set externally
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
    //Using a NonDecreasingDirector, create HTML elements with the 'exp-slide' class.
    //The first HTML element with the 'exp-slide' class will be shown first. When the next slide button is clicked, that will fade out and be replaced with the next element with the exp-slide class, in order of HTML.
    //If you want to display multiple HTML elements at the same time, 'exp-slide-<n>' will also be displayed when the presentation is currently on slide number n. For example, everything in the exp-slide-1 class will be visible from the start, and then exp-slide-2, and so on.
    //Don't give an element both the exp-slide and exp-slide-n classes. 

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

        this.setupAndHideAllSlideHTMLElements();

        this.switchDisplayedSlideIndex(0); //unhide first one

        this.setupClickables();

        this.initialized = true;
    }

    setupAndHideAllSlideHTMLElements(){

        this.slides = document.getElementsByClassName("exp-slide");
        this.numHTMLSlides = this.slides.length;

        //hide all slides except first one
        for(var i=0;i<this.numHTMLSlides;i++){
            this.slides[i].style.opacity = 0;
            this.slides[i].style.pointerEvents = 'none';
            this.slides[i].style.display = 'none';//opacity=0 alone won't be instant because of the 1s CSS transition
        }
        let self = this;
        //now handle exp-slide-<n>
        let allSpecificSlideElements = document.querySelectorAll('[class*="exp-slide-"]'); //this is a CSS attribute selector, and I hate that this exists. it's so ugly
        for(var i=0;i<allSpecificSlideElements.length;i++){
            allSpecificSlideElements[i].style.opacity = 0; 
            allSpecificSlideElements[i].style.pointerEvents = 'none';
            allSpecificSlideElements[i].style.display = 'none';//opacity=0 alone won't be instant because of the 1s CSS transition
        }

        //undo setting display-none after a bit of time
        window.setTimeout(function(){
            for(var i=0;i<self.slides.length;i++){
                self.slides[i].style.display = '';
            }
            for(var i=0;i<allSpecificSlideElements.length;i++){
                allSpecificSlideElements[i].style.display = '';
            }
        },1);

    }

    setupClickables(){
        let self = this;

        this.rightArrow = new DirectionArrow();
        document.body.appendChild(this.rightArrow.arrowImage);
        this.rightArrow.onclickCallback = function(){
            self._changeSlide(1, function(){}); // this errors without the empty function because there's no resolve. There must be a better way to do things.
            console.warn("WARNING: Horrible hack in effect to change slides. Please replace the pass-an-empty-function thing with something that actually resolves properly and does async.")
            self.nextSlideResolveFunction();
        }

    }

    async waitForPageLoad(){
        return new Promise(function(resolve, reject){
            if(document.readyState == 'complete'){
                resolve();
            }
            window.addEventListener("DOMContentLoaded",resolve);
        });
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
        if(slideDelta != 0){
            if(this.currentSlideIndex == 0 && slideDelta == -1){
                return; //no going past the beginning
            }
            if(this.currentSlideIndex == this.numHTMLSlides-1 && slideDelta == 1){
                return; //no going past the end
            }

            this.switchDisplayedSlideIndex(this.currentSlideIndex + slideDelta);
            resolve();
        }
    }

    switchDisplayedSlideIndex(slideNumber){
        //updates HTML and also sets this.currentSlideIndex to slideNumber

        let prevSlideNumber = this.currentSlideIndex;
        this.currentSlideIndex = slideNumber;


        //hide the HTML elements for the previous slide

        //items with class exp-slide
        if(prevSlideNumber < this.slides.length){
            this.slides[prevSlideNumber].style.opacity = 0;
            this.slides[prevSlideNumber].style.pointerEvents = 'none';
        }
        
        //items with HTML class exp-slide-n
        let prevSlideElems = document.getElementsByClassName("exp-slide-"+(prevSlideNumber+1))
        for(var i=0;i<prevSlideElems.length;i++){
            prevSlideElems[i].style.opacity = 0;
            prevSlideElems[i].style.pointerEvents = 'none';
        }


        //show the HTML elements for the current slide
  
        
        //items with HTML class exp-slide-n
        let elemsToDisplayOnlyOnThisSlide = document.getElementsByClassName("exp-slide-"+(slideNumber+1));

        if(slideNumber >= this.numHTMLSlides && elemsToDisplayOnlyOnThisSlide.length == 0){
            console.error("Tried to show slide #"+slideNumber+", but only " + this.numHTMLSlides + "HTML elements with exp-slide were found! Make more slides?");
            return;
        }

        for(var i=0;i<elemsToDisplayOnlyOnThisSlide.length;i++){
            elemsToDisplayOnlyOnThisSlide[i].style.opacity = 1;
            elemsToDisplayOnlyOnThisSlide[i].style.pointerEvents = 'all';
        }

        //items with class exp-slide
        if(slideNumber < this.slides.length){
            this.slides[slideNumber].style.opacity = 1;
            this.slides[slideNumber].style.pointerEvents = 'all';
            this.scrollUpToTopOfContainer(this.slides[slideNumber]);
        }

    }
    scrollUpToTopOfContainer(element){
        this.getScrollParent(element).scrollTop = 0;
    }
    getScrollParent(element, includeHidden){
        //from https://stackoverflow.com/questions/35939886/find-first-scrollable-parent
        var style = getComputedStyle(element);
        var excludeStaticParent = style.position === "absolute";
        var overflowRegex = includeHidden ? /(auto|scroll|hidden)/ : /(auto|scroll)/;
        if (style.position === "fixed") return document.body;
        for (var parent = element; (parent = parent.parentElement);) {
            style = getComputedStyle(parent);
            if (excludeStaticParent && style.position === "static") {
                continue;
            }
            if (overflowRegex.test(style.overflow + style.overflowY + style.overflowX)) return parent;
        }
        return document.body;
    }

    //verbs
    async _sleep(waitTime){
        return new Promise(function(resolve, reject){
            window.setTimeout(resolve, waitTime);
        });
    }
    async delay(waitTime){
        return this._sleep(waitTime);
    }
    TransitionTo(target, toValues, durationMS, optionalArguments){
        //if someone's using the old calling strategy of staggerFraction as the last argument, convert it properly
        if(optionalArguments && Utils.isNumber(optionalArguments)){
            optionalArguments = {staggerFraction: optionalArguments};
        }
        new Animation(target, toValues, durationMS === undefined ? undefined : durationMS/1000, staggerFraction=staggerFraction, optionalArguments);
    }
}





const FORWARDS = ("forwards");
const BACKWARDS = ("backwards");
const NO_SLIDE_MOVEMENT = ("not time traveling");

class UndoCapableDirector extends NonDecreasingDirector{
    //thsi director uses both forwards and backwards arrows. the backwards arrow will undo any UndoCapableDirector.TransitionTo()s
    //todo: hook up the arrows and make it not
    constructor(options){
        super(options);

        this.furthestSlideIndex = 0; //matches the number of times nextSlide() has been called
        //this.currentSlideIndex is always < this.furthestSlideIndex - if equal, we release the promise and let nextSlide() return

        this.undoStack = [];
        this.undoStackIndex = -1; //increased by one every time either this.TransitionTo is called or this.nextSlide() is called

        let self = this;

        this.currentReplayDirection = NO_SLIDE_MOVEMENT; //this variable is used to ensure that if you redo, then undo halfway through the redo, the redo ends up cancelled. 
        this.numArrowPresses = 0;

        //if you press right before the first director.nextSlide(), don't error
        this.nextSlideResolveFunction = function(){} 

        function keyListener(e){
            if(e.repeat)return; //keydown fires multiple times but we only want the first one
            let slideDelta = 0;
            switch (e.keyCode) {
              case 34:
              case 39:
              case 40:
                self.handleForwardsPress();
                break;
              case 33:
              case 37:
              case 38:
                self.handleBackwardsPress();
              default:
                break;
            }
        }

        window.addEventListener("keydown", keyListener);
    }

    setupClickables(){
        let self = this;

        this.leftArrow = new DirectionArrow(false);
        this.leftArrow.hideSelf();
        document.body.appendChild(this.leftArrow.arrowImage);
        this.leftArrow.onclickCallback = function(){
            self.handleBackwardsPress();
        }

        this.rightArrow = new DirectionArrow(true);
        document.body.appendChild(this.rightArrow.arrowImage);
        this.rightArrow.onclickCallback = function(){
            self.handleForwardsPress();
        }
    }

    moveFurtherIntoPresentation(){
            //if there's nothing to redo, (so we're not in the past of the undo stack), advance further.
            //if there are less HTML slides than calls to director.newSlide(), complain in the console but allow the presentation to proceed
            console.log("Moving further into presentation!");
            if(this.currentSlideIndex < this.numSlides){
                this.furthestSlideIndex += 1; 

                this.switchDisplayedSlideIndex(this.currentSlideIndex + 1); //this will complain in the console window if there are less slides than newSlide() calls
                this.showArrows(); //showArrows must come after this.currentSlideIndex advances or else we won't be able to tell if we're at the end or not
            }
            this.nextSlideResolveFunction(); //allow presentation code to proceed
    }
    isCaughtUpWithNothingToRedo(){
        return this.undoStackIndex == this.undoStack.length-1;
    }

    async handleForwardsPress(){

        //if there's nothing to redo, show the next slide
        if(this.isCaughtUpWithNothingToRedo()){
            this.moveFurtherIntoPresentation();
            return;
        }

        // if we get to here, we've previously done an undo, and we're in the past. We need to catch up and redo all those items

        //only redo if we're not already redoing
        //todo: add an input buffer instead of discarding them
        if(this.currentReplayDirection == FORWARDS)return;
        this.currentReplayDirection = FORWARDS;

        this.rightArrow.hideSelf();

        this.numArrowPresses += 1;
        let numArrowPresses = this.numArrowPresses;

        //advance past the current NewSlideUndoItem we're presumably paused on

        if(this.undoStack[this.undoStackIndex].constructor === NewSlideUndoItem){
            this.undoStackIndex += 1;
        }

        //change HTML slide first so that if there are any delays to undo, they don't slow down the slide
        this.switchDisplayedSlideIndex(this.currentSlideIndex + 1);
        this.showArrows();
        console.log(`Starting arrow press forwards #${numArrowPresses}`);

        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
            //loop through undo stack and redo each undo until we get to the next slide


            let redoItem = this.undoStack[this.undoStackIndex]
            await this.redoAnItem(redoItem);

            //If there's a delay somewhere in the undo stack, and we sleep for some amount of time, the user might have pressed undo during that time. In that case, handleBackwardsPress() will set this.currentReplayDirection to BACKWARDS. But we're still running, so we should stop redoing!
            if(this.currentReplayDirection != FORWARDS || numArrowPresses != this.numArrowPresses){
                //this function has been preempted by another arrow press
                console.log(`forwards has been preempted: this is ${numArrowPresses}, but there's another with ${this.numArrowPresses},${this.currentReplayDirection}`);
                return;
            }

            if(this.undoStackIndex == this.undoStack.length-1){
                //we've now fully caught up.

                //if the current undoItem isn't a NewSlideUndoItem, but we do have a nextSlideResolveFunction (meaning the main user code is waiting on this to activate) allow presentation code to proceed
                if(this.nextSlideResolveFunction){
                    this.nextSlideResolveFunction();
                }
                break;
            }
            
            this.undoStackIndex += 1;

        }
        this.currentReplayDirection = NO_SLIDE_MOVEMENT;
    }

    async redoAnItem(redoItem){
        switch(redoItem.type){
            case DELAY:
                //keep in mind during this delay period, the user might push the left arrow key. If that happens, this.currentReplayDirection will be DECREASING, so handleForwardsPress() will quit
                await this._sleep(redoItem.waitTime);
                break;
            case TRANSITIONTO:
                var redoAnimation = new Animation(redoItem.target, redoItem.toValues, redoItem.duration, redoItem.optionalArguments);
              //and now redoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething
                break;
            case NEWSLIDE:
                break;
            default:
                break;
        }
    }

    async handleBackwardsPress(){

        if(this.undoStackIndex == 0 || this.currentSlideIndex == 0){
            return;
        }

        //only undo if we're not already undoing
        if(this.currentReplayDirection == BACKWARDS)return;
        this.currentReplayDirection = BACKWARDS;

        this.leftArrow.hideSelf();

        this.numArrowPresses += 1;
        let numArrowPresses = this.numArrowPresses;

        //advance behind the current NewSlideUndoItem we're presumably paused on
        if(this.undoStack[this.undoStackIndex].constructor === NewSlideUndoItem){
            this.undoStackIndex -= 1;
        }


        //change HTML slide first so that if there are any delays to undo, they don't slow down the slide
        this.switchDisplayedSlideIndex(this.currentSlideIndex - 1);
        this.showArrows();

        while(this.undoStack[this.undoStackIndex].constructor !== NewSlideUndoItem){
            //loop through undo stack and undo each item until we reach the previous slide

            if(this.undoStackIndex == 0){
                //at first slide
                break;
            }

            //If there's a delay somewhere in the undo stack, and we sleep for some amount of time, the user might have pressed redo during that time. In that case, handleForwardsPress() will set this.currentReplayDirection to FORWARDS. But we're still running, so we should stop redoing!
            if(this.currentReplayDirection != BACKWARDS || numArrowPresses != this.numArrowPresses){
                //this function has been preempted by another arrow press
                console.log(`backwards has been preempted: ${numArrowPresses},${this.numArrowPresses},${this.currentReplayDirection}`);
                return;
            }

            //undo transformation in this.undoStack[this.undoStackIndex]
            let undoItem = this.undoStack[this.undoStackIndex];
            await this.undoAnItem(undoItem);
            this.undoStackIndex -= 1;
        }
        this.currentReplayDirection = NO_SLIDE_MOVEMENT;
    }

    async undoAnItem(undoItem){
        switch(undoItem.type){
                case DELAY:
                    //keep in mind during this delay period, the user might push the right arrow. If that happens, this.currentReplayDirection will be INCREASING, so handleBackwardsPress() will quit instead of continuing.
                    let waitTime = undoItem.waitTime;
                    await this._sleep(waitTime/5);
                    break;
                case TRANSITIONTO:
                    let duration = undoItem.duration;
                    duration = duration/5; //undoing should be faster.
                    //todo: invert the easing of the undoItem when creating the undo animation?
                    let easing = Easing.EaseInOut;
                    var undoAnimation = new Animation(undoItem.target, undoItem.fromValues, duration, undoItem.optionalArguments);
                    //and now undoAnimation, having been created, goes off and does its own thing I guess. this seems inefficient. todo: fix that and make them all centrally updated by the animation loop orsomething
                    break;
                case NEWSLIDE:
                    break;
                default:
                    break;
            }
    }

    showArrows(){
        if(this.currentSlideIndex > 0){
            this.leftArrow.showSelf();
        }else{
            this.leftArrow.hideSelf();
        }
        if(this.currentSlideIndex < this.numSlides){
            this.rightArrow.showSelf();
        }else{
            this.rightArrow.hideSelf();
        }
    }

    async nextSlide(){
        /*The user will call this function to mark the transition between one slide and the next. This does two things:
        A) waits until the user presses the right arrow key, returns, and continues execution until the next nextSlide() call
        B) if the user presses the left arrow key, they can undo and go back in time, and every TransitionTo() call before that will be undone until it reaches a previous nextSlide() call. Any normal javascript assignments won't be caught in this :(
        C) if undo
        */
        if(!this.initialized)throw new Error("ERROR: Use .begin() on a Director before calling any other methods!");

        
        this.numSlides++;
        this.undoStack.push(new NewSlideUndoItem(this.currentSlideIndex));
        this.undoStackIndex++;
        this.showArrows();


        let self = this;

        //promise is resolved by calling this.nextSlideResolveFunction() when the time comes
        return new Promise(function(resolve, reject){
            self.nextSlideResolveFunction = function(){ 
                resolve();
            }
        });

    } 
    async _sleep(waitTime){
        await super._sleep(waitTime);
    }

    async delay(waitTime){
        this.undoStack.push(new DelayUndoItem(waitTime));
        this.undoStackIndex++;
        console.log(this.undoStackIndex);
        await this._sleep(waitTime);
        console.log(this.undoStackIndex);
        if(!this.isCaughtUpWithNothingToRedo()){
            //This is a perilous situation. While we were delaying, the user pressed undo, and now we're in the past.
            //we SHOULDN't yield back after this, because the presentation code might start running more transformations after this which conflict with the undoing animations. So we need to wait until we reach the right slide again
            console.log("Egads! This is a perilous situation! Todo: wait until we're fully caught up to release");
            let self = this;
            //promise is resolved by calling this.nextSlideResolveFunction() when the time comes
            return new Promise(function(resolve, reject){
                self.nextSlideResolveFunction = function(){ 
                    console.log("Release!");
                    resolve();
                }
            });
        }
    }
    TransitionTo(target, toValues, durationMS, optionalArguments){
        let duration = durationMS === undefined ? 1 : durationMS/1000;
        var animation = new Animation(target, toValues, duration, optionalArguments);
        let fromValues = animation.fromValues;
        this.undoStack.push(new UndoItem(target, toValues, fromValues, duration, optionalArguments));
        this.undoStackIndex++;
    }
}


//discount enum
const TRANSITIONTO = 0;
const NEWSLIDE = 1;
const DELAY=2;

//things that can be stored in a UndoCapableDirector's .undoStack[]
class UndoItem{
    constructor(target, toValues, fromValues, duration, optionalArguments){
        this.target = target;
        this.toValues = toValues;
        this.fromValues = fromValues;
        this.duration = duration;
        this.type = TRANSITIONTO;
        this.optionalArguments = optionalArguments;
    }
}

class NewSlideUndoItem{
    constructor(slideIndex){
        this.slideIndex = slideIndex;
        this.type = NEWSLIDE;
    }
}

class DelayUndoItem{
    constructor(waitTime){
        this.waitTime = waitTime;
        this.type = DELAY;
    }
}

export { NonDecreasingDirector, DirectionArrow, UndoCapableDirector };
