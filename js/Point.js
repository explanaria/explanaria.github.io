class Point{
	constructor(options){
		/*options: color: <THREE.Color or hex code
			x,y: numbers
			width: number
		*/

		this.x = options.x || 0;
		this.y = options.y || 0;
		this.z = options.z || 0;

		let width = options.width || 1;

		let color = options.color || 0x777777;
		this.mesh = new THREE.Mesh(new THREE.SphereGeometry(width/2, 8, 6),this.getFromMaterialCache(color));

		this.mesh.position.set(this.x,this.y,this.z);
		three.scene.add(this.mesh);
	}
	getFromMaterialCache(color){
		if(this._materials[color] === undefined){
			this._materials[color] = new THREE.MeshBasicMaterial({color: color})
		}
		return this._materials[color]
	}
}

Point.prototype._materials = {};
