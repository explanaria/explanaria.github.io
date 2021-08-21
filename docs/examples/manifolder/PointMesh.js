import {setThreeEnvironment, getThreeEnvironment, threeEnvironment} from "./copypastes/ThreeEnvironment.js";

class PointMesh{
	constructor(options){
		/*options:
			x,y,z: numbers
			width: number
            color: THREE.Color
		*/

		this.width = options.width === undefined ? 1 : options.width
        this.material = new THREE.MeshBasicMaterial({color: options.color});

		this.mesh = new THREE.Mesh(this.sharedCircleGeometry,this.material);

		this.x = options.x || 0;
		this.y = options.y || 0;
		this.z = options.z || 0;

		this.mesh.position.set(this.x,this.y,this.z);
		this.mesh.scale.setScalar(this.width/2);
		threeEnvironment.scene.add(this.mesh);
	}
	removeSelfFromScene(){
		threeEnvironment.scene.remove(this.mesh);
	}
	set x(i){
		this.mesh.position.x = i;
	}
	set y(i){
		this.mesh.position.y = i;
	}
	set z(i){
		this.mesh.position.z = i;
	}
	get x(){
		return this.mesh.position.x;
	}
	get y(){
		return this.mesh.position.y;
	}
	get z(){
		return this.mesh.position.z;
	}
}
PointMesh.prototype.sharedCircleGeometry = new THREE.SphereGeometry(1/2, 20, 20); //radius 1/2 makes diameter 1, so that scaling by n means width=n

export default PointMesh;
