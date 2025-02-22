import * as EXP from "../../resources/build/explanaria-bundle.js"; //also imports THREE


export class ConicSectionMirror extends GlassElement{ //glassElement copied from raytracing.js
    constructor(xCenter, focalLength, eccentricity){
        super();
        this.apexPoint = [xCenter, 0];
        //this.height = height; //after this it's cut off. todo

        this._eccentricity = eccentricity; //0 for sphere, 1 for parabola, >1 for hyperbola
        this._focalLength = focalLength || 4;

        this.computeEquation();
    }

    computeEquation(){
        let k = 1/(2 * this.focalLength); //apex curvature. FL = 1/(2k), so k = 1/2FL. True for parabolas, close enough for other conic sections
        let ecc = this.eccentricity;

        //from https://www.pas.rochester.edu/~dmw/ast203/Lectures/Lect_03.pdf
        //The equation for a conic section opening left with apex curvative k, eccentriccy ecc, and apex (0,0) is:
        //y^2 + 2/k x + (1-ecc^2) x^2 = 0
        // Coefficients are in order ax^2 + bxy + cy^2 + dx + ey + f = 0
        //let coefficients = [(1 - ecc * ecc),0,1,2/k,0,0]; //apex at (0,0)

        //However, with apex at a nonzero x-coordinate (x0,0), the equation becomes:
        // y^2 + 2/k (x-x0) + (1-ecc^2) (x-x0)^2 = 0
        // y^2 ++ (1-ecc^2)x^2 + (2/k - (1-ecc^2)(2 x0)) x + (1-ecc^2) x0^2 - 2x0/k = 0
        // coefficients are in order ax^2 + bxy + cy^2 + dx + ey + f = 0

        let x0 = this.apexPoint[0];
        this.coefficients = [(1 - ecc * ecc),0,1,2/k -2*x0*(1 - ecc * ecc),0, (1 - ecc * ecc)*x0*x0 - 2*x0/k];
    }
    set focalLength(focalLength){
        this._focalLength = focalLength;
        this.computeEquation();
    }
    get focalLength(){
        return this._focalLength;    
    }
    set eccentricity(eccentricity){
        this._eccentricity = eccentricity;
        this.computeEquation();
    }
    get eccentricity(){
        return this._eccentricity;        
    }

    intersect(ray){ //true or false

        let [a,b,c,d,e,f] = this.coefficients;

        let intersectPoint = intersect(ray, ...this.coefficients);
        if(intersectPoint == null){
            return null;
        }
        //this is a mirror, so we can implicitly differentiate

        let outgoingRay = null; //todo: compute
        //ax^2 + bxy + cy^2 + dx + ey + f = 0
        /*
        implicit differentiation d/dx: 2ax + b(y + xdy/dx) + 2cy dx/dy + d + e dy/dx = 0
        dx/dy (bx + 2cy + e) = -d -2ax -by
        dx/dy = -(d -2ax -by) / (bx + 2cy + e)
        so the tangent vector will be [-(d -2ax -by), (bx + 2cy + e)]
        //and you can reflect off that!

        reflectedVector = closestIntersection
        */

        //reflections

        let x = solution[0];
        let y = solution[1];

        let normalVector = [(b*x + 2*c*y + e), (d -2*a*x -b*y)];
        //compute ray.direction projected onto N, = (V . N / N . N)N
        let NdotN = normalVector[0] * normalVector[0] + normalVector[1] * normalVector[1];
        let scaleFactor = (normalVector[0] * ray.direction[0] + normalVector[0] * ray.direction[1]) / NdotN
        outgoingRay = [ray.direction[0] - 2 *scaleFactor * normalVector[0], ray.direction[1] - 2 *scaleFactor * normalVector[1]]

        return new RayIntersection(closestIntersection, ray, outgoingRay);
    }
}

export function intersect(ray, a,b,c,d,e,f){
    //a,b,c,d,e,f are coefficients in ax^2 + bxy + cy^2 + dx + ey + f = 0

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


