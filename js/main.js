var three = new Threeasy_setup();

points = [];

for(var x=-10;x<10;x++){
	for(var y=-10;y<10;y++){
		let pt = new Point({x:x, y:y, width:0.3})

		if(x == 0 || y == 0)pt.color = 0xff0000;

		points.push(pt);
	}
} 
