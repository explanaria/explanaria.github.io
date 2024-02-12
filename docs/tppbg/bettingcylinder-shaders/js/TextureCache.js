function TextureCache(){
	this._cache = {};
	this.callbacks = {};

	this.loader = new THREE.TextureLoader();
}


TextureCache.prototype.loadTexture = function(image_url, callback){
	//Load a texture, fetching from the cache if it exists
	//After the first time a texture is loaded, the cache entry is set to "loading" to ensure only one request per file is made
	if(this._cache[image_url]){

		if(this._cache[image_url] == "loading"){
			//another request is pending for the same url, so store the callback until it loads
			if(!this.callbacks[image_url])this.callbacks[image_url] = [];

			this.callbacks[image_url].push(callback);

		}else{
			//already loaded, so just pull from the cache
			callback(this._cache[image_url]);
		}
	}else{
		this._cache[image_url] = "loading";
		//load the texture
		this.loader.load(image_url,function(tex){
			console.log(image_url);
			this._cache[image_url] = tex;

			//if other callbacks exist, call them
			if(this.callbacks[image_url]){
				for(var i=0;i<this.callbacks[image_url].length; i++){
					//call the callback with this lovely mess
					this.callbacks[image_url][i](tex);
				}
				delete this.callbacks[image_url];
			}
			//finally, run the original callback
			callback(tex);
		}.bind(this));
	}

}
