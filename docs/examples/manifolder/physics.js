function calculatePhysics(lines){

    //spring force between lines


    for(let i=0;i<faces.length;i++){
    let face = faces[i];


    for(let i=0;i<faces.length;i++){
    let face = faces[i];
    //for face in faces:
        //for line in face:
            //point1 = line.p1
            //point2 = line.p2

            //line stays the same width force
            //forces[p1] = r

            //angular force

    
        //for point in face:
            //points stay planar force
            //forces[ppont] do their thing


    const lineGlueAttractionForce = 1;
        if(lines[i].isGlued){
            let gluedPartner = lines[i].gluedPartner;
            for point in lines[i]:
                parnerPoint = gluedPartner.partnerPoint
                let vector = vecSub(partnerPoint.position,point.position);
                point.acceleration += vector / vector.lengthSquared() * lineGlueAttractionForce;
        }
    }

    //repel points not in the same plane force
    const lineGlueAttractionForce = 1;
    for(let i=0;i<points.length;i++){
        for(let j=0;j<points.length;j++){
            if points[i] and points[j] are not in the same face:
                make points[i] and points[j] repel each other
    }


    //lines don't stretch force

    //planes stay planar force

    //update each point a bit with its velocity
}

//use http://iamralpht.github.io/constraints/

//or https://github.com/slightlyoff/cassowary.js, or https://www.npmjs.com/package/kiwi.js which claims to be typescript
