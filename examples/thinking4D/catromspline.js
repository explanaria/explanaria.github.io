//Adaptde from THREE.CatmullRomCurve3 by zz85

/**
 * @author zz85 https://github.com/zz85
 *
 * Centripetal CatmullRom Curve - which is useful for avoiding
 * cusps and self-intersections in non-uniform catmull rom curves.
 * http://www.cemyuksel.com/research/catmullrom_param/catmullrom.pdf
 *
 * curve.type accepts centripetal(default), chordal
 */

class CubicPoly{
	constructor(){}

	/*
	 * Compute coefficients for a cubic polynomial
	 *   p(s) = c0 + c1*s + c2*s^2 + c3*s^3
	 * such that
	 *   p(0) = x0, p(1) = x1
	 *  and
	 *   p'(0) = t0, p'(1) = t1.
	 */
	init( x0, x1, t0, t1 ) {

		this.c0 = x0;
		this.c1 = t0;
		this.c2 = - 3 * x0 + 3 * x1 - 2 * t0 - t1;
		this.c3 = 2 * x0 - 2 * x1 + t0 + t1;

	}
	initNonuniformCatmullRom ( x0, x1, x2, x3, dt0, dt1, dt2 ) {

		// compute tangents when parameterized in [t1,t2]
		var t1 = ( x1 - x0 ) / dt0 - ( x2 - x0 ) / ( dt0 + dt1 ) + ( x2 - x1 ) / dt1;
		var t2 = ( x2 - x1 ) / dt1 - ( x3 - x1 ) / ( dt1 + dt2 ) + ( x3 - x2 ) / dt2;

		// rescale tangents for parametrization in [0,1]
		t1 *= dt1;
		t2 *= dt1;

		this.init( x1, x2, t1, t2 );

	}

	calc( t ) {
		var t2 = t * t;
		var t3 = t2 * t;
		return this.c0 + this.c1 * t + this.c2 * t2 + this.c3 * t3;
	}
}

function distanceToSquared(a,b){
    return (a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]) + (a[2]-b[2])*(a[2]-b[2]);
}


var px = new CubicPoly(), py = new CubicPoly(), pz = new CubicPoly();


function getCatRomSpline( t, points, isClosed=false, endTangentsAsIfClosed=false) {
    const curveType = "chordal";

	var l = points.length;

	var p = ( l - ( isClosed ? 0 : 1 ) ) * t;
	var intPoint = Math.floor( p );
	var weight = p - intPoint;

	if (isClosed || endTangentsAsIfClosed) {
		intPoint += intPoint > 0 ? 0 : ( Math.floor( Math.abs( intPoint ) / l ) + 1 ) * l;

	} else if ( weight === 0 && intPoint === l - 1 ) {
		intPoint = l - 2;
		weight = 1;
	}

	var p0, p1, p2, p3; // 4 points

	if ( isClosed || endTangentsAsIfClosed || intPoint > 0 ) {
		p0 = points[ ( intPoint - 1 ) % l ];
	} else {
		// extrapolate first point
        p0 = EXP.Math.vectorSub(EXP.Math.vectorSub(points[0],points[1]), points[0]);
	}

	p1 = points[ intPoint % l ];
	p2 = points[ ( intPoint + 1 ) % l ];

	if ( isClosed || endTangentsAsIfClosed|| intPoint + 2 < l ) {
		p3 = points[ ( intPoint + 2 ) % l ];
	} else {
		// extrapolate last point
        p3 = EXP.Math.vectorSub(EXP.Math.vectorSub(points[l - 1],points[l - 2]), points[l - 1]);
	}

	// init Centripetal / Chordal Catmull-Rom
	var pow = curveType === 'chordal' ? 0.5 : 0.25;
	var dt0 = Math.pow( distanceToSquared(p0, p1 ), pow );
	var dt1 = Math.pow( distanceToSquared(p1, p2 ), pow );
	var dt2 = Math.pow( distanceToSquared(p2, p3 ), pow );

	// safety check for repeated points
	if ( dt1 < 1e-4 ) dt1 = 1.0;
	if ( dt0 < 1e-4 ) dt0 = dt1;
	if ( dt2 < 1e-4 ) dt2 = dt1;

	px.initNonuniformCatmullRom( p0[0], p1[0], p2[0], p3[0], dt0, dt1, dt2 );
	py.initNonuniformCatmullRom( p0[1], p1[1], p2[1], p3[1], dt0, dt1, dt2 );
	pz.initNonuniformCatmullRom( p0[2], p1[2], p2[2], p3[2], dt0, dt1, dt2 );

	return [px.calc( weight ),
		py.calc( weight ),
		pz.calc( weight )
	];
};

