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
var three = EXP.setupThree(true, 60,15);
var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

var area = new EXP.Area({bounds: [[0,2*Math.PI]], numItems: 16});
var varyParameters = new EXP.Transformation({'expr': (i,t,theta) => [theta, Math.sin(t)+1.1]});
var outputCurve = new EXP.Transformation({'expr': (i,t,theta,a) => [Math.sin(theta+t), Math.sin(theta+t*a)]});
var output = new EXP.PointOutput({width:0.2, color: 0x00ff00});

area.add(varyParameters).add(outputCurve).add(output)
	
three.on("update",function(time){
		area.activate(time.t);
		controls.update();
}
```


# API Reference

## Domains

* EXP.Area
	Represents a domain that is a closed rectangular interval of real numbers, such as [5,10] x [-3,0].

	Parameters:
    * bounds: an array of [start, end] pairs.
		For example, to call a function on all points with 0 <= x <= 1 and 0 <= y <= 1 (the mathematical interval [0,1] x [0,1]), *bounds* should be `[[0,1],[0,1]]`. Note that for one-dimensional intervals such as [5,6], `bounds` expects a 1x2 array, (e.g. [[5,6]])`
	* numItems: integer representing the number of subdivisions between the start and endpoint of each dimension to call child functions on. Raise this number to increase resolution, and lower this to increase performance. Optional; defaults to 16.
		numItems can also vary for each axis: [10,2] will subdivide the first interval in `bounds` into 10 subdivisions and the second into 2, for example. Make sure the size of bounds and numItems is equal.  
	
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


## Transformations

* EXP.Transformation
    * options.expr: a javascript lambda function representing a transformation from R^n to R^n.
		The first two arguments to any expr will always be `i` and `t`. `i` is an integer representing the number of calls that have been made to this function, while `t` is the number of seconds since the beginning of the animation.
	The output of one expr will be input to any children. Returning an array of numbers is preferred.
	```
	var norm = new EXP.Transformation({ 'expr':(i,t,x,y,z) => Math.sqrt(x*x+y*y+z*z)});
	var polarToCartesian = new EXP.Transformation({ 
	    'expr':(i,t,r,theta) => [r*Math.cos(theta), r*Math.sin(theta)]
	});
	```
## Outputs

* EXP.PointOutput
	Renders a function's output as 3-dimensional points.
	Parameters:
	* width: number representing the size of each point, in three.js world units.
	* color: a hex number or THREE.Color representing the color each point should be.
	* opacity: number between 0 and 1 representing how transparent the points are. 1 = fully opaque, 0 = invisible. Optional; default: 1

```new EXP.PointOutput({width: 0.2, color:0xcccccc}));```

* EXP.LineOutput
	Renders a function's output as lines. 

	Technical note: LineOutput renders lines connecting points where the last coordinate varies - for 2-dimensional output, lines will connect the elements of the domain with the same y-value, for example. This is done to ensure that 1-d intervals show up as lines. If you ever want to switch the dimension where lines are drawn, simply permute basis elements using a function such as `(i,t,x,y) => [y,x]`.

	Parameters:
	* width: number representing the width of the lines to be drawn. Currently in units of pixels, meaning the output will depend on the user's screen resolution. 
	* color: a hex number or THREE.Color representing the color each point should be.
	* opacity: number between 0 and 1 representing how transparent the points are. 1 = fully opaque, 0 = invisible.
	
	
```new EXP.LineOutput({width: 5, color:0xcccccc}));```
* EXP.VectorOutput

A subclass of EXP.LineOutput that renders vectors. The tip of the vector will be placed at the last point and will dynamically shrink and grow.

```new EXP.VectorOutput({width: 5, color:0xcccccc}));```

# TransitionTo

Explanaria allows for animated transitions between two functions, or parameters, or in fact any numeric key. This is done through the `EXP.TransitionTo` function.

For each `{key: newValue}` pair in the supplied `toValues` object, TransitionTo animates a transition from `target[key]`'s previous value to the specified `newValue`.  
	When combined with an `EXP.Transformation`, this can be used to smoothly animate between functions, tweak parameters, or more!
	Technical note: TransitionTo assumes `target[key] is either a number or a function returning
	

* EXP.TransitionTo
	Parameters:
	* target: an object, such as an EXP.Transformation; see `toValues` documentation below.
	* toValues: an object consisting of any number of {key: newValue} pairs. For each pair, TransitionTo effectively sets `target[key] = newValue` 
	* durationMS: an integer; the duration, in milliseconds (1000 = 1 second) of transition time before the new properties are fully recognized.

	```
	var f = new EXP.Transformation({'expr': (i,t,x) => [x, x*x]});
	EXP.TransitionTo(f, {
		'expr': (i,t,x) => [x,x*x*x]
	}, durationMS=1000, staggerFraction=0.2);
	
    await EXP.delay(2000);
    EXP.TransitionTo(f, {
		'expr': (i,t,x) => [x,2*x+5]
	}, 1000);

# Other things

There are a few helper functions defined in EXP.Math and EXP.Utils that may be helpful.

# Threeasy Setup

Explanaria comes with a standalone helper function to setup a three.js environment easily. Simply call `EXP.setupThree()` to create a three.js environment and renderer, as well as a render loop and an update loop.

Using setupThree() also allows an animation to be recorded on a frame-by-frame basis. Appending `?record=true` to the URL will cause Explanaria to automatically record a canvas using [https://github.com/spite/ccapture.js/](CCapture). This will automatically render and download a TAR file of PNGs, which can be compiled into a video file using ffmpeg or a video editor of your choice. If you want to increase the resolution of an explanarian while recording, there is an `IS_RECORDING` boolean variable is set to true if recording and false otherwise.

* EXP.setupThree()
	Parameters:
	* autostart: boolean. Default is true.
	* fps: frames per second to record, if recording.
	* seconds: seconds of footage to record, if recording.
		
`var three = EXP.setupThree(true, 60,15);`

# Presentations
If you want to synchronize text-based slides to your animations, use an EXP.Director().
This section will be expanded later.

