

//desired API;
/*
points[i].expr(function(x){
return x = x*x;
});

var bOvera = new ComplexNumber(1,0);
var cOverd = new ComplexNumber(2,1);
points[i].expr(function(x){
return x = x.add(bOvera).divide(x.clone().add(cOverd);
});*/

The design goals of this API are to make it simple to run z -> z^2.

When designing a function, you need to specify its domain, range, and the function itself.

This is reflected in the API. There are domains (=inputs), transformations, and outputs.

One way to do it would to be explicitly spell out each part, like this:

var axes = new THINGNAME.Area({
axes: [[-10,10],
	[10,10]]
spacing: 0.2; //optional
})
var f = new THINGNAME.Function({	
	source: axes,
	outputDimensions:2;
	expr: function(emit,x,i,y,j){
		emit(x*x-y*y,2*x*y);
	}
})
var g = new THINGNAME.Function({	
	source: f,
	outputDimensions:2;
	expr: function(emit,x,i,y,j){
		emit(x+1,y+1);
	}
})
var points = new THINGNAME.PointOutput({
		source: g
	});


--

Alternately, a transformation and an output could be merged into one, like so:

var axes = new THINGNAME.Area({
axes: [[-10,10],
	[10,10]]
spacing: 0.2; //optional
})

var interval = new THINGNAME.Interval({ // define the domain of the function
axes: [[-10,10],
spacing: 0.2; //optional
})
var f = new THINGNAME.Function({	
	domain: interval,
	outputDimensions:2;
	expr: function(emit,x,i,y,j){
		emit(x, x*x);
	}
})
var points = new THINGNAME.PointOutput({
		source: f
	});


The way mathbox does it is to specify the domain and transformation in the same object, and then have another object that renders it properly. If it's a vector it'll expect a dimension-two input and silently complain about it.

--

List of complaints about mathbox:
1) It fails silently. If vector output doesn't get two inputs, it just won't display anything instead of an error.
2) It's hard to figure out what you have to do to see SOMETHING. 
3) The play() syntax is unintuitive.


4) It should be easy fr someone to write 'return x*x' and see it happen.

