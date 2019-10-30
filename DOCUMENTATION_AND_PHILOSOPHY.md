Explanaria is an engine for creating animated 3D presentations designed for explaining math concepts.


# Goals

* Explanaria is *3D*. By using [three.js](https://github.com/mrdoob.three.js), Explanaria can output in full 3D with zero pain.

* Explanaria is *browser-based*, so that presentations can be viewed anywhere, on both mobile and desktop.

* Explanaria is *real-time*. Instead of slowly rendering frames for hours like manim or requiring one to scroll through a clunky scroll bar like Mathematica's Manipulate[], Explanaria is fast enough to run at 60fps, so you can enjoy buttery-smooth animations. (Of course, if you *want* to render frames one at a time with higher detail, Explanaria can do that too.)

* Explanaria should be *intuitive*, and ideally become something usable by even non-programmers.

* Explanaria should be *interactive*. Any javascript variable can be used as a source of data in a `EXP.Transformation`, whether the mouse position, the result of an API call, or any other source of user interaction.

# Core Concepts: A High-Level Overview
Let's say a mathematician wants to graph a function, such as `f(x) = x^3`. Along with the formula, one must also specify which range of x-values to graph, and similarly what range of y-values will be output by the function when called with those x-values. Therefore, as many students know, there are three parts of any function to consider: the domain, the range, and the function itself. 

In Explanaria, domains, functions, and ranges are represented as three different categories of objects. Domains represent the inputs where the function should be called, functions run a javascript function, and ranges are passed to a subclass of `EXP.OutputNode` (such as a `EXP.PointOutput` or `EXP.LineOutput`) which represents its output onscreen. 

This domain-function-range chain is at the core of how Explanaria operates internally. `Node`s must be connected via .add() to form such a chain. Calling `.activate()` on a Domain will recursively call and update each of its children in turn.

# Example code

Here is some sample code using Explanaria to render a Lissajous curve.

```
var three = EXP.setupThree(60,15);
var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

var area = new EXP.Area({bounds: [[0,2*Math.PI]], numItems: 16});
var varyParameters = new EXP.Transformation({'expr': (i,t,theta) => [theta, Math.sin(t)+1.1]});
var outputCurve = new EXP.Transformation({'expr': (i,t,theta,a) => [Math.sin(theta+t), Math.sin(theta+t*a)]});
var output = new EXP.PointOutput({width:0.2, color: 0x00ff00});

area.add(varyParameters).add(outputCurve).add(output)
	
three.on("update",function(time){
		area.activate(time.t);
		controls.update();
});
```

In the above code, the variable `area` (a Domain, specifically, an `EXP.Area`) will call `varyParameters`'s expr() 16 times, first with theta=`0`, then theta=`2pi/15`, then theta=`4pi/15`... and eventually finishing with theta=`2pi`. Then, the return value of `varyParameters` will be likewise passed to `outputCurve`, and finally it will be rendered by the `PointOutput` `output` as a point in XYZ coordinates.

Use .add() to specify which transformations should receive the output of the previous one. Think of data flowing from a root node in a tree to the children. A transformation can have multiple children.

See the examples in the `/examples` folder for more!

# API Reference

## Domains

* EXP.Area

	Represents a domain that is a closed rectangular interval of real numbers, such as [5,10] x [-3,0].

	Parameters:
    * bounds: an array of [start, end] pairs.
		For example, to call a function on all points with 0 <= x <= 1 and 0 <= y <= 1 (the mathematical interval [0,1] x [0,1]), *bounds* should be `[[0,1],[0,1]]`. Note that for one-dimensional intervals such as `[5,6]`, `bounds` expects a 1x2 array, (e.g. `[[5,6]]`)
	* numItems: integer representing the number of subdivisions between the start and endpoint of each dimension to call child functions on. Raise this number to increase resolution, and lower this to increase performance. Optional; defaults to 16.
		numItems can also vary for each axis: [10,2] will subdivide the first interval in `bounds` into 10 subdivisions and the second into 2, for example. Make sure there is one value in `numItems` per dimension-specifying-array in `bounds`.
	
	```
	var axes = new EXP.Area({
		bounds: [[-10,10],
			[10,10]]
		numItems: 10; //optional. Alternately numItems can vary for each axis: numItems: [10,2]
	})
	```

* EXP.Array

	Calls a function with pre-defined values from a javascript array. Useful for pre-computing certain values or displaying the result of a computation.

    * data: a javascript array containing either numbers or arrays of numbers. It is assumed all elements of `data` have the same type.
	
	```
	new EXP.Array({
	    data: [1,2,3,4,5]
	 });
	 //data can also be an array of vectors:
	 new EXP.Array({
	    data: [[0,1,2],[3,4,5]]
	 });
    ```

* EXP.HistoryRecorder

    Stores the last few outputs of an EXP.Transformation(). Useful for adding a LineOutput trail behind a PointOutput, for example. 

    Like a Transformation, this to be connected to a Domain to work, but it also acts as a Domain in its own right. If a HistoryRecorder's parent is an n-dimensional Domain, then the HistoryRecorder acts as an (n+1)-dimensional domain. Any child's `evaluateSelf()` will be called with n arguments, same as the input, but it'll be called `memoryLength` times per time the `HistoryRecorder`'s `evaluateSelf()` is called.

    Parameters:
        * memoryLength: integer representing the number of past values to remember
        * recordFrameInterval: integer representing the number of frames that must pass before a new history value is recorded. 1 = record every frame, 2 = record every other frame, and so on. Keep in mind Explanaria tries to run at 60fps. Default: 15.


    Example usage:

    ```
    var recorder = new HistoryRecorder({
        memoryLength: 10, 
        recordFrameInterval: 1
    });

    var area = new Area({bounds: [[-5,5]]});
    area.add(new Transformation({expr: (i,t,x) => [Math.sin(x+t),Math.cos(x+t)]}))
    .add(recorder)
    .add(new LineOutput({width: 5, color: 0xff0000}));
    ```

## Transformations

* EXP.Transformation

    Parameters:
    * expr: a javascript lambda function representing a transformation from R^n to R^n.
		The first two arguments to any expr will always be `i` and `t`. `i` is an integer representing the number of calls that have been made to this function, while `t` is the number of seconds since the beginning of the animation.
	The output of one expr will be input to any children. Returning an array of numbers is preferred.

    Example usage:
	```
	var norm = new EXP.Transformation({ 'expr':(i,t,x,y,z) => Math.sqrt(x*x+y*y+z*z)});
	var polarToCartesian = new EXP.Transformation({ 
	    'expr':(i,t,r,theta) => [r*Math.cos(theta), r*Math.sin(theta)]
	});
	```

    * Transformation.makeLink()

    Often one will want to define a function or `Transformation` once, but use it in multiple places - and then be able to call EXP.TransformTo() only once to change all of them. Explanaria offers this functionality through .makeLink(). 

    Transformation.makeLink() will return an EXP.LinkedTransformation object, which is a superclass of EXP.Transformation and therefore can be used in the exact same way as an EXP.Transformation - for example, you can .add() things to the LinkedTransformation object, and they will not be affected by the original Transformation object. However, if the original Transformation object's expr() is later changed to a different function, the LinkedTransformation object's expr() will automatically change to the same function. 

    This can be useful if, for example, one wants to render a point's path alongside graphs of its x and y coordinates, or if wants to express the same transformation using two different DomainNodes, or create two outputs depicting different representations of the same function.

	```
	var norm = new EXP.Transformation({ 'expr':(i,t,x,y,z) => Math.sqrt(x*x+y*y+z*z)});
	var norm2 = norm.makeLink();
    //can now add norm and norm2 to different Domains, or connect them to different outputs...

    await EXP.delay(1000);
    //After a while, perhaps we want to demonstrate the manhattan metric
    EXP.TransitionTo(norm, {'expr':(i,t,x,y,z) => Math.abs(x) + Math.abs(y) + Math.abs(z)});
    //norm2's expr() is now also the function (i,t,x,y,z) => Math.abs(x) + Math.abs(y) + Math.abs(z)!
	```

## Outputs

* EXP.PointOutput

	Renders a function's output as 3-dimensional points.

	Parameters:
	* width: number representing the size of each point, in three.js world units.
	* color: a hex number or THREE.Color representing the color each point should be.
	* opacity: number between 0 and 1 representing how transparent the points are. 1 = fully opaque, 0 = invisible. Optional; default: 1

    Example usage:

    ```new EXP.PointOutput({width: 0.2, color:0xcccccc}));```

* EXP.LineOutput

	Renders a function's output as lines. 

	Technical note: LineOutput renders lines connecting points where the last coordinate varies - for 2-dimensional output, lines will connect the elements of the domain with the same y-value, for example. This is done to ensure that 1-d intervals show up as lines. If you ever want to switch the dimension where lines are drawn, simply permute basis elements using a function such as `(i,t,x,y) => [y,x]`.

	Parameters:
	* width: number representing the width of the lines to be drawn. Currently in units of pixels, meaning the output will depend on the user's screen resolution. 
	* color: a hex number or THREE.Color representing the color each point should be.
	* opacity: number between 0 and 1 representing how transparent the points are. 1 = fully opaque, 0 = invisible.
	
	
    Example usage:

    ```new EXP.LineOutput({width: 5, color:0xcccccc}));```
* EXP.VectorOutput

    A subclass of EXP.LineOutput that renders vectors. The tip of the vector will be placed at the last point and will dynamically shrink and grow.

    Example usage:

    ```new EXP.VectorOutput({width: 5, color:0xcccccc}));```

* EXP.SurfaceOutput

    An Output that renders a smooth 2D surface, along with optional grid lines. 

    This Output only works if the parent Domain is two-dimensional.

	Parameters:
	* color: a hex number or THREE.Color representing the color of the surface.
	* opacity: number between 0 and 1 representing how transparent the surface is. 1 = fully opaque, 0 = invisible.
    * showGrid: boolean: whether or not to show grid lines. Default: true
    * showSolid: boolean: whether to show solid color in between the grid lines, or to make the non-grid-lines portion transparent instead. Default: true.
    * gridSquares: number representing the total number of squares along one side to show. Default: 16
    * gridLineWidth: number representing the width of a gridline. Default: 0.15

    Example usage:

    ```
    new EXP.SurfaceOutput({color:0xcccccc}));

    new EXP.SurfaceOutput({color:0xcccccc, showGrid: false}));

    //wireframe surface
    new EXP.SurfaceOutput({color:0xcccccc, showGrid: true, showSolid: false, gridSquares: 100})); 
    ```

# TransitionTo()

Explanaria allows for animated transitions between two functions, or parameters, or in fact any numeric key. This is done through the `EXP.TransitionTo` function.

For each `{key: newValue}` pair in the supplied `toValues` object, TransitionTo animates a transition from `target[key]`'s previous value to the specified `newValue`.  
	When combined with an `EXP.Transformation`, this can be used to smoothly animate between functions, tweak parameters, or more!
* EXP.TransitionTo()

	Parameters:

	* target: an object, such as an EXP.Transformation; see `toValues` documentation below.
	* toValues: an object consisting of any number of {key: newValue} pairs. For each pair, TransitionTo effectively sets `target[key] = newValue` 
	* durationMS: number; the duration, in milliseconds (1000 = 1 second) of transition time before the new properties are fully recognized.
    * staggerFraction: number representing the fraction of time to wait before the last element begins to animate. Default: 0.0. 0 = all points move simulaneously, 1 = everything instantly teleports from beginning to end. Low values tend to make better-looking animations.

    Example usage:

	```
	var f = new EXP.Transformation({'expr': (i,t,x) => [x, x*x]});
    var output = new EXP.PointOutput({width: 0.3, color: 0x5555ff, opacity: 1});
    f.add(output); //assume a domain is created and .activate()d elsewhere
    

	EXP.TransitionTo(f, {
		'expr': (i,t,x) => [x,x*x*x]
	}, durationMS=1000, staggerFraction=0.2);
	
    await EXP.delay(2000);
    EXP.TransitionTo(f, {
		'expr': (i,t,x) => [x,2*x+5]
	}, 1000);

    await EXP.delay(2000);
    EXP.TransitionTo(output, {
		'opacity':0.8, 'width':1
	}, 1000);
    ```

Technical note: TransitionTo assumes `target[key]` is either a number or a function (and if a function, it is assumed that this function always returns an array of numbers). Arrays of numbers are not yet supported, but as a workaround one can specify numbers as keys in an object: {0: 2, 1:3, 2:5} will result in an array of [2,3,5]. This is rather suboptimal, and should hopefully be addressed soon.


# Other things

There are a few helper functions defined in EXP.Math and EXP.Utils that may be helpful.

# Threeasy Setup

Explanaria comes with a standalone helper function to setup a three.js environment easily. Simply call `EXP.setupThree()` to create a three.js environment and renderer, as well as a render loop and an update loop.

Call `setupThree()` before creating any `EXP.*Output`s, or else the outputs will not render.

Using `setupThree()` also allows an animation to be recorded on a frame-by-frame basis. See the "Recording with Explanaria" section below. Appending `?record=true` to the page URL will cause Explanaria to automatically record a canvas using [https://github.com/spite/ccapture.js/](CCapture). This will automatically render and download a TAR file of PNGs, which can be compiled into a video file using ffmpeg or a video editor of your choice. If you want to increase the resolution of an explanarian while recording, there is an `IS_RECORDING` boolean variable is set to true if recording and false otherwise.

* EXP.setupThree()
	Parameters:
	* fps: frames per second to record, if recording.
	* seconds: seconds of footage to record, if recording.
    * canvasElem (optional): An existing <canvas> element to render inside.

This also starts a render loop. To use it, call `three.on("render", callback)` or `three.on("update", callback)`. Think of this as an event listener.

A callback function registered to the `update` event will be called with an object representing the current time. This object will take the form of `time = {"t": <number>,"delta":<number>, 'realtimeDelta':<number>}`. Here, `time.t` counts the seconds since `setupThree()` was called. `time.delta` measures the amount of time, in seconds, since the last `update` event. 

There is also a `three.timeScale` multiplier, which can be used to change the flow of simulated time. Change it from its default of 1 to, say, 0.5 and `time.t` and `time.delta` will both increase 0.5x as fast. `time.realtimeDelta` is unaffected by `three.timeScale` and always measures real, user-facing time. Use this for slow motion effects, or to speed up a slow wobble.

A callback function registered to the `render` event will be called with no arguments, after rendering is finished.

Example usage:

    var three = EXP.setupThree(60,15);
    // can now access three.camera, three.renderer, three.scene, three.IS_RECORDING

    var domain = new EXP.Area({bounds: [[-5,5]], numItems: 11});
    three.on("update",function(time){
        //time.t, time.delta, time.realtimeDelta all available to use
        //console.log("Number of seconds since beginning: " + time.t);
        //console.log("Seconds since last update: " + time.delta);
        domain.activate(time.t);
    });

Technical note: The result of a EXP.setupThree() call is also available at EXP.threeEnvironment. This is used internally to create three.js entities. As a result, the three.js environment is a 'singleton': after the first call, calling EXP.setupThree() multiple times will return the same object each time.

## Recording with Explanaria

Explanaria will record the output of the canvas whenever `?record=true` is present in the URL. If `EXP.setupThree(fps, seconds)` will record `fps * seconds` frames. If you want to record for longer, change the `seconds` number in the `EXP.setupThree()` call.

Note that recording will only capture the 3D content rendered to the <canvas> element - any DOM, such as buttons, sliders, or text boxes, will not be included. This is a limitation of CCapture.

You may also wish to increase the resolution or `numItems` of any Domains while recording, since you are no longer constrained by a 60fps refresh rate. To do so, you may wish to use a ternary operator to dynamically switch between a low resolution and a high resolution if recording, such as `three.IS_RECORDING ? 20 : 200`. For example, you could define an object like this: `var myArea = new EXP.Area({bounds: [[-5,5]], numItems: three.IS_RECORDING ? 20 : 200});`. 

Explanaria will record a frame that is the size of the current window. To record video at a specific resolution such as 1920x1080, instead of laboriously resizing your window, we recommend using your browser's developer tools, such as Firefox's [Responsive Design Mode](https://developer.mozilla.org/en-US/docs/Tools/Responsive_Design_Mode) or Chrome's [Device Mode](https://developers.google.com/web/tools/chrome-devtools/device-mode/), which allow one to type in "1920x1080" directly.

# Presentations
If you want to synchronize text-based slides to your animations, use an EXP.Director, such as EXP.NonDecreasingDirector() or EXP.UndoCapableDirector().
This section will be expanded later.

