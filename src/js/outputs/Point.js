import { threeEnvironment } from '../ThreeEnvironment.js';

export default class Point{
	constructor(options){
		/*options: color: <THREE.Color or hex code
			x,y: numbers
			width: number
		*/

		let width = options.width === undefined ? 1 : options.width
		let color = options.color === undefined ? 0x777777 : options.color;

		this.mesh = new THREE.Mesh(this.sharedCircleGeometry,this.getFromMaterialCache(color));

		this.opacity = options.opacity === undefined ? 1 : options.opacity; //trigger setter

		this.mesh.position.set(this.x,this.y,this.z);
		this.mesh.scale.setScalar(this.width/2);
		threeEnvironment.scene.add(this.mesh);

		this.x = options.x || 0;
		this.y = options.y || 0;
		this.z = options.z || 0;
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
	set opacity(opacity){
		let mat = this.mesh.material;
		mat.opacity = opacity;
		mat.transparent = opacity < 1;
        mat.visible = opacity > 0;
		this._opacity = opacity;
	}
	get opacity(){
		return this._opacity;
	}
	getFromMaterialCache(color){
		if(this._materials[color] === undefined){
			this._materials[color] = new THREE.MeshBasicMaterial({color: color})
		}
		return this._materials[color]
	}
	set color(color){
		this.mesh.material = this.getFromMaterialCache(color);
	}
}
Point.prototype.sharedCircleGeometry = new THREE.SphereGeometry(1/2, 8, 6); //radius 1/2 makes diameter 1, so that scaling by n means width=n

Point.prototype._materials = {};
