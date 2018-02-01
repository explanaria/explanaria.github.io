class Point{
	constructor(options){
		/*options: color: <THREE.Color or hex code
			x,y: numbers
			width: number
		*/

		this.x = options.x || 0;
		this.y = options.y || 0;

		let color = options.color || 0x777777;
		this.mesh = new THREE.Mesh(new THREE.SphereGeometry(options.width || 1, 8, 6),this.getFromMaterialCache(color));
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
