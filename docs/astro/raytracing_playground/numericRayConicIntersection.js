import * as EXP from "../../resources/build/explanaria-bundle.js"; //also imports THREE

function dot(a,b){

    let sum=0;
    for(let i=0;i<a.length;i++){
        sum += a[i] * b[i]
    }
    return sum;
}

export function distanceSquared(point1, point2){

    let sum=0;
    for(let i=0;i<point1.length;i++){
        sum += (point1[i]-point2[i])*(point1[i]-point2[i]);
    }
    return sum;
}
export function distance(point1, point2){
    return Math.sqrt(distanceSquared(point1,point2));
}

export function rayLineSegmentIntersection(ray, startPt, endPt){
        let rayOrigin = ray.origin;
        let rayDirection = ray.direction;
        // from https://stackoverflow.com/questions/14307158/how-do-you-check-for-intersection-between-a-line-segment-and-a-line-ray-emanatin
        var v1 = EXP.Math.vectorSub(rayOrigin,startPt);
        var v2 = EXP.Math.vectorSub(endPt, startPt);
        var v3 = [-rayDirection[1], rayDirection[0]]; //perpendicular to rayDirection


        var dotProd = dot(v2, v3);
        if (Math.abs(dot) < 0.000001)
            return null;

        var t1 = (v2[0] * v1[1] - v2[1] * v1[0]) / dotProd; //the thing in parentheses is |v2 cross v1|
        var t2 = dot(v1, v3) / dotProd;

        if (t1 >= 0.0 && (t2 >= 0.0 && t2 <= 1.0))
            return t1;

        return null;

}


export function intersect(ray, equationFunc, domain){

    //step 1: have the ray intersect the line segment from


    //step 1: see if the ray intersects the bounding box. if it doesn't, return no intersection.

    //if it does, we need to investigate further.


    //step 2: grab the intersection from earlier and do newton's method to find the solution?
    

    //Line equation: jx + ky + l = 0
    let j = 1; //todo: do something if ray.direction[1] is 0
    let k = ray.direction[1] / ray.direction[0];
    let l = -(j * ray.origin[0] + k * ray.origin[1]);

    /*
    x = a + bt
    y = c + dt

    increase t by 1, x -> x+b, y -> y + d

    a(x+b) + b (y+d) = l
    ax + by + (ab + bd) = l
    a * ray.direction[0] + b * ray.direction[1] = 0
    set b = 1
    a = ray.direction[0] / ray.direction[1]

     (a + bt) 
    */


    /*
    ax^2 + bxy + cy^2 + dx + ey + f = 0
    jx + ky + l = 0

     // todo: redo this using x = blah

    y = (-jx + l) / k assuming k != 0
    x = (ky + l) / j

    Now substitute:

    ax^2 + bx(-gx + h)/d + c/d^2 (-gx-h)^2 + dx + e(-gx + h) / d + f = 0

    x^2(a k^2 - b j k +c j^2) + x(b k l + - 2 c j l + d k^2 - e j k) + (c l^2 + f k^2 + e k l)/k^2 = 0

    This big equation is just a quadratic in x. Use the quadratic formula to get the two possible x-solutions!
    */

    //quadratic formula
    let quad_a = ((a*k*k - b*j*k +c*j*j))/(k*k);
    let quad_b = ((b*k*l + - 2*c*j*l + d*k*k - e*j*k))/(k*k);
    let quad_c = (c*l*l + f*k*k + e*k*l)/(k*k);

    let discriminant = quad_b*quad_b - 4*quad_a*quad_c

    if(discriminant < 0){
        return null;
    }
    //quadratic formula to get x, then use gx + dy + h = 0 to get y
    let xSolution1 = (-quad_b + Math.sqrt(discriminant))/2*quad_a 
    let ySolution1 = (-j*xSolution1 + l) / k; //jx + ky + l = 0

    if(discriminant == 0)return [xSolution1, ySolution1];

    let xSolution2 = (-quad_b - Math.sqrt(discriminant))/2*quad_a;
    let ySolution2 = (-j*xSolution2 + l) / k; //jx + ky + l = 0

    //test [xSolution1, ySolution1], [xSolution2, ySolution2] to see which is closer to the ray
    //they both lie on the same line, so we'll just dot them with ray.direction and see which is bigger

    let dotProduct1 = (xSolution1 - ray.origin[0]) *ray.direction[0] + (ySolution1 - ray.origin[1]) * ray.direction[1];

    let dotProduct2 = (xSolution2 - ray.origin[0]) *ray.direction[0] + (ySolution2 - ray.origin[1]) * ray.direction[1];

    //if the dot product is negative, that means the solution lies in the opposite direction of the ray and shouldn't count

    let closestIntersection = null;
    let smallestPositiveDotProduct = null; //either 1 or 2 or null, for solution1 or solution 2
    if(dotProduct1 > 0){
        //todo: extra bonus tests here because it's not a complete conic section, just part of one cut off at the aperture
        smallestPositiveDotProduct = 1;
        closestIntersection = [xSolution1, ySolution1];
    }
    if(dotProduct2 > 0 && dotProduct2 < dotProduct1){
        //todo: extra bonus tests here because it's not a complete conic section, just part of one cut off at the aperture
        smallestPositiveDotProduct = 2;
        closestIntersection = [xSolution2, ySolution2];
    }

    if(closestIntersection == null){
        return null;
    }
    return closestIntersection;
}


