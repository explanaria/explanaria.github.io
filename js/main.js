var three = new Threeasy_setup();

points = [];

for(var x=-10;x<10;x++){
	for(var y=-10;y<10;y++){
		points.push(new Point({x:x, y:y}));
	}
}
