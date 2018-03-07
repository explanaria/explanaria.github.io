var EXP = EXP || {};

EXP.Point = class Point{
	constructor(options){
		/*options: color: <THREE.Color or hex code
			x,y: numbers
			width: number
		*/

		let width = options.width === undefined ? 1 : options.width
		let color = options.color === undefined ? 0x777777 : options.color;

		this.mesh = new THREE.Mesh(new THREE.SphereGeometry(width/2, 8, 6),this.getFromMaterialCache(color));

		this.mesh.position.set(this.x,this.y,this.z);
		three.scene.add(this.mesh);

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

EXP.Point.prototype._materials = {};
