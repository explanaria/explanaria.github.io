import * as EXP from "../../resources/build/explanaria-bundle.js"; //also imports THREE
import {intersect, rayLineSegmentIntersection, distanceSquared, distance} from "./numericRayConicIntersection.js";

export class LightSource{};

export class Ray{
    constructor(origin, direction){
        this.origin = origin;
        this.direction = direction;

        this.visualizationLength = 1;
        //phase?
    }
}

export class GlassElement{
    constructor(){
        this.reflective = false; //otherwise refractive
    }
    intersect(ray){ //returns null or RayIntersection
        return null;
    }
}

function getPerpendicularVector(vec){
    return [vec[1], -vec[0]];
}

export class ParallelLightSource extends LightSource{
    //a line of parallel light rays
    constructor(centerPoint, normalVector, width, numRays){
        super();
        this.centerPoint = centerPoint;
        this.normal = normalVector || [1,0];
        this.width = width || 2;
        this.numRays = numRays || 10;

        //2D: draw as a line from point A to B
        let parallelVec = EXP.Math.vectorScale(getPerpendicularVector(this.normal), this.width/2);
        

        this.visualizerLineStart = EXP.Math.vectorAdd(centerPoint, parallelVec);
        this.visualizerLineEnd = EXP.Math.vectorSub(centerPoint, parallelVec);
    }
    render(){
        //todo
    }

    spawnRays(){
        //spawn new rays
        let newRays = [];

        if(this.numRays == 1){
            let rayStartPos = this.centerPoint //midpoint
            newRays.push(new Ray(rayStartPos, this.normal));
            return newRays;
        }

        for(let i=0;i<this.numRays;i++){
            let t = i/(this.numRays-1);

            // pos = t * visualizerLineStart + (1-t) * visualizerLineEnd
            let rayStartPos = EXP.Math.vectorAdd(EXP.Math.vectorScale(this.visualizerLineStart, t), EXP.Math.vectorScale(this.visualizerLineEnd, 1-t));
            newRays.push(new Ray(rayStartPos, this.normal));
        }
        return newRays;
    }
}


export class RayIntersection{
        constructor(intersectionPoint, incomingRay, outgoingRay){
            this.intersectionPoint = intersectionPoint;
            this.incomingRay = incomingRay;
            this.outgoingRay = outgoingRay; //newly created
        }
}


export class FlatMirror extends GlassElement{
    //mirror that is a line segment from startPt to endPt
    constructor(start, end){
        super();
        this.startPt = start;
        this.endPt = end;

        this.normal = perpendicular(this.startPt - this.endPt);
    }
    intersects(ray){
        let rayOrigin = ray.origin;
        let rayDirection = ray.direction;


        // from https://stackoverflow.com/questions/14307158/how-do-you-check-for-intersection-between-a-line-segment-and-a-line-ray-emanatin
        var v1 = rayOrigin - this.startPt;
        var v2 = this.endPt - this.startPt;
        var v3 = new Vector(-rayDirection.Y, rayDirection.X);


        var dot = dot(v2, v3);
        if (Math.abs(dot) < 0.000001)
            return null;

        var t1 = Vector.CrossProduct(v2, v1) / dot;
        var t2 = (v1 * v3) / dot;

        if (t1 >= 0.0 && (t2 >= 0.0 && t2 <= 1.0))
            return t1;

        return null;
    }
}



export class ConicSectionMirror extends GlassElement{ //glassElement copied from raytracing.js
    constructor(xCenter, focalLength, eccentricity){
        super();
        this.apexPoint = [xCenter, 0];
        //this.height = height; //after this it's cut off. todo

        this.opensLeft = true; //opens
        

        this.eccentricity = eccentricity; //0 for sphere, 1 for parabola, >1 for hyperbola
        this.focalLength = focalLength || 4;

        this.computeEquation();

        this.aperture = 4; //x in [-5,5]
    }
    
    masterEquation(x){
        let k = 1/(2 * this.focalLength); //apex curvature. FL = 1/(2k), so k = 1/2FL. True for parabolas, close enough for other conic sections
        return k*x*x / (1 + Math.sqrt(k*k * (1-this.eccentricity*this.eccentricity)*x*x))

    }

    computeEquation(){
    }

    xCurveCoord(yPos){
        //given a y coordinate, return the x coordinate of the mirror.
        //takes into account the x-coordinate of this.apexPoint
        let dm = this.opensLeft ? -1 : 1; //direction multiplier
        return this.masterEquation(yPos)*dm + this.apexPoint[0];

    }

    intersect(ray){ //true or false

        //first, intersect ray with bounding box to see if we don't need to bother
        //todo

        let sagitta = this.masterEquation(this.aperture/2) - 0; //the total left-right width of the bounding box. always positive

        let dm = this.opensLeft ? -1 : 1; //direction multiplier

        //assuming a left facing curve like )
        let topLeftPt = EXP.Math.vectorAdd([dm*sagitta, this.aperture/2], this.apexPoint);
        let topRightPt = EXP.Math.vectorAdd([0, this.aperture/2], this.apexPoint);

        let bottomLeftPt = EXP.Math.vectorAdd([dm*sagitta, -this.aperture/2], this.apexPoint);
        let bottomRightPt = EXP.Math.vectorAdd([0, -this.aperture/2], this.apexPoint);

        //to see if we intersect this axis-aligned bounding box, we can see if we intersect the two diagonals.
        
        let intersection1 = rayLineSegmentIntersection(ray, topLeftPt, bottomRightPt);
        let intersection2 = rayLineSegmentIntersection(ray, topRightPt, bottomLeftPt);

        if(intersection1 == null || intersection2 == null){
            return null;
        }

        //todo: rotate if dealing with a non-left-or-right opening curved mirror

        let testPoint = ray.origin;

        let stepSize = 1;
        //are you on the left or right of the curve x = f(y)?
        //true means to the right of
        let prevSign = testPoint[0] > this.xCurveCoord(testPoint[1]);

        for(let i=0;i<=100;i++){
            //move in the drection of ray.direction a bit
            let newPoint = EXP.Math.vectorAdd(EXP.Math.vectorScale(ray.direction, stepSize), testPoint);

            let comparedXVal = this.xCurveCoord(newPoint[1]);
            let currentSign = newPoint[0] > comparedXVal;

            if(prevSign != currentSign){ 
                //too far of a step!
                stepSize /= 2;
            }else{
                testPoint = newPoint;
            }

            if(stepSize < 0.0001){
                break;
            }
        }

        //testPoint is now at the intersection
        //console.log(testPoint);

        let intersectPoint = testPoint
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


        let dy = 0.01;

        //compute normal vector using a tiny tangent and symmetric differences
        let y = intersectPoint[1] - dy;
        let x = this.xCurveCoord(y);

        let y2 = intersectPoint[1] + dy;
        let x2 = this.xCurveCoord(y2);

        //let tangentVector = [(x-x2)/dy, (y-y2)/dy];
        let normalVector = [-(y-y2)/dy, (x-x2)/dy];

        //compute ray.direction projected onto N, = (V . N / N . N)N
        let NdotN = normalVector[0] * normalVector[0] + normalVector[1] * normalVector[1];
        let scaleFactor = (normalVector[0] * ray.direction[0] + normalVector[1] * ray.direction[1]) / NdotN
        let outgoingRayDirection = [ray.direction[0] - 2 *scaleFactor * normalVector[0], ray.direction[1] - 2 *scaleFactor * normalVector[1]]

        outgoingRay = new Ray(intersectPoint, outgoingRayDirection);

        //stop the ray from bumping into this exact same mirror
        //move it along its direction a bit
        outgoingRay.origin = EXP.Math.vectorAdd(outgoingRay.origin, EXP.Math.vectorScale(outgoingRay.direction, 0.01));

        return new RayIntersection(intersectPoint, ray, outgoingRay);
    }
}


export class ParabolicMirror extends ConicSectionMirror{
    constructor(xCenter, focalLength){
        super(xCenter, focalLength, 1);
    }
}

//spherical mirror:
//x = sqrt(1-y^2)
//taylor series: sqrt(x) has all derivatives infinite at x=0.
//but not at x=1! So taylor series of sqrt around x=1: sqrt(1+x) = 1 + x/2 - x^2/8 + x^3/16 - (5 x^4)/128
//therefore, y = 1 - x^2/2 - x^4/8 is a good approximation for x = sqrt(1-y^2)


export class RayTracingScene{
    constructor(){
        this.raySources = [];
        this.glassElements = [];

        this.rays = [];
        this.unprocessedRays = [];
    }

    add(thing){
        if(thing instanceof GlassElement){
            this.glassElements.push(thing)
        }else if(thing instanceof Ray){
            this.rays.push(thing)
        }
        else if(thing instanceof LightSource){
            this.raySources.push(thing)
        }
        else{
            throw new Error("How do I add a thing that isn't a GlassElement or ray? This thing is" + thing.constructor);
        }
    }

    findClosestIntersection(ray){
        let intersections = this.glassElements.map(glass => glass.intersect(ray));
        intersections = intersections.filter(intersection => intersection != null);

        if(intersections.length == 0){
            return null;
        }
        if(intersections.length == 1){
            return intersections[0];
        }

        //more than one! Compute the closest and return that
        let closestIntersection = null;
        let prevClosestDistSquared = 9999999;
        for(let i=0;i<intersections.length;i++){
            let int = intersections[i]
            let distSquared = distanceSquared(int.incomingRay.origin, int.intersectionPoint);
            if(distSquared < prevClosestDistSquared && distSquared != 0){
                closestIntersection = int;
                prevClosestDistSquared = distSquared;
            }
        }
        return closestIntersection;
    }

    clear(){
        this.rays = [];
        this.unprocessedRays = [];
    }

    trace(){
        for(let source of this.raySources){
            this.unprocessedRays = this.unprocessedRays.concat(source.spawnRays());
        }
        console.log("Now we have" + this.unprocessedRays.length + "rays");

        let maxIterations = 100;
        for(let i=0;i<maxIterations;i++){
            if(this.unprocessedRays.length == 0)break;

            let ray = this.unprocessedRays.shift(); //get first ray in queue
            let closestIntersection = this.findClosestIntersection(ray);

            if(closestIntersection != null){
                let rayLength = distance(ray.origin, closestIntersection.intersectionPoint);
                ray.visualizationLength = rayLength;//Math.min(4, rayLength);
            }else{
                ray.visualizationLength = 5;
            }

            this.rays.push(ray); //processed!

            if(closestIntersection != null){
                let intersectionPoint = closestIntersection;
                let newRay = intersectionPoint.outgoingRay; //todo: create two rays for both transmission and reflection
                if(newRay != null){
                    this.unprocessedRays.push(newRay);
                }
            }
        }

        if(this.unprocessedRays.length > 0){
            console.warn("Over " + maxIterations + "rays were created when tracing!")
        }
        console.log("After we're done, we have" + this.rays.length + "rays");
        console.log(this.rays);
    }
}

window.GlassElement = GlassElement;
window.ParabolicMirror = ParabolicMirror;
window.EXP = EXP;


