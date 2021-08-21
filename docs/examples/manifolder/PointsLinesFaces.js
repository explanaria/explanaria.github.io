import PointMesh from "./PointMesh.js";
import LineMesh from "./LineMesh.js";

export class Line{
    constructor(p1,p2, color){
        this.p1 = p1;
        this.p2 = p2;

        this.gluedLine = null;

        this.color = color;
        this.mesh = new LineMesh({color: this.color, points:[p1.position,p2.position]});
    }
    glueToOtherLine(line2){
        this.gluedLine = line2;
    }
    updateFromPoints(){

    }
}

export class Point{
    constructor(position){
        this.position = position
        this.originalPosition = this.position.slice(); //array copy

        this.mesh = new PointMesh({color: 0x00ff00});
        this.updateMesh();
    }
    updateMesh(){
        this.mesh.x = this.position[0] || 0;
        this.mesh.y = this.position[1] || 0;
        this.mesh.z = this.position[2] || 0;
    }
}

export class Face{
    constructor(pointList){
        this.points = []; //ordered i guess

        this.lines = [];
    }
}

