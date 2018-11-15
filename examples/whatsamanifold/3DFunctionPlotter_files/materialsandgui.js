var gui = null;
		function generateMaterials() {
			var texture = new THREE.TextureLoader().load( "gridblue.png" );
			texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

			var materials = {

            
			"matte" :
			{
				m: new THREE.MeshPhongMaterial( { color: 0x000000, specular: 0x111111, shininess: 1, side: THREE.DoubleSide } ),
				h: 0, s: 0, l: 0.175
			},

			"flat" :
			{
				m: new THREE.MeshLambertMaterial( { color: 0x000000, flatShading: true, side: THREE.DoubleSide } ),
				h: 0, s: 0, l: 0.5
			},

			"textured" :
			{
				m: new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0x111111, shininess: 50, map: texture, side: THREE.DoubleSide } ),
				h: 0, s: 0, l: 0.8
			},

			"colors" :
			{
				m: new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0xffffff, shininess: 2, vertexColors: THREE.VertexColors, side: THREE.DoubleSide } ),
				h: 0, s: 0, l: 1
			},

			"plastic" :
			{
				m: new THREE.MeshPhongMaterial( { color: 0x000000, specular: 0x888888, shininess: 250, side: THREE.DoubleSide } ),
				h: 0.6, s: 0.8, l: 0.1
			},

			};

			return materials;

		}

		function setupGui() {

			var createHandler = function( id ) {

				return function() {

					var mat_old = materials[ current_material ];
					mat_old.h = m_h.getValue();
					mat_old.s = m_s.getValue();
					mat_old.l = m_l.getValue();

					current_material = id;

					var mat = materials[ id ];
					effect.material = mat.m;

					m_h.setValue( mat.h );
					m_s.setValue( mat.s );
					m_l.setValue( mat.l );

					effect.enableUvs = (current_material === "textured") ? true : false;
					effect.enableColors = (current_material === "colors") ? true : false;

				};

			};

			effectController = {

			material: "textured",

			speed: 1.0,
			resolution: 100,

			hue: 0.0,
			saturation: 0,
			lightness: 0.8,
            shininess: 1,

			lhue: 0.04,
			lsaturation: 1.0,
			llightness: 0.5,

			lx: 0.5,
			ly: 0.5,
			lz: 1.0,
			dummy: function() {
			}

			};

			var h, m_h, m_s, m_l;

			gui = new dat.GUI();

			// material (type)

			h = gui.addFolder( "Materials" );

			for ( var m in materials ) {

				effectController[ m ] = createHandler( m );
				h.add( effectController, m ).name( m );

			}

			// material (color)

			h = gui.addFolder( "Material color" );

			m_h = h.add( effectController, "hue", 0.0, 1.0, 0.025 );
			m_s = h.add( effectController, "saturation", 0.0, 1.0, 0.025 );
			m_l = h.add( effectController, "lightness", 0.0, 1.0, 0.025 );
            m_shiny = h.add( effectController, "shininess", 1.0, 250.0, 0.025 );

			// light (point)

			h = gui.addFolder( "Point light color" );

			h.add( effectController, "lhue", 0.0, 1.0, 0.025 ).name("hue");
			h.add( effectController, "lsaturation", 0.0, 1.0, 0.025 ).name("saturation");
			h.add( effectController, "llightness", 0.0, 1.0, 0.025 ).name("lightness");

			// light (directional)

			h = gui.addFolder( "Directional light orientation" );

			h.add( effectController, "lx", -1.0, 1.0, 0.025 ).name("x");
			h.add( effectController, "ly", -1.0, 1.0, 0.025 ).name("y");
			h.add( effectController, "lz", -1.0, 1.0, 0.025 ).name("z");

			// simulation

			h = gui.addFolder( "Simulation" );

			h.add( effectController, "speed", 0.1, 8.0, 0.05 );
			h.add( effectController, "resolution", 14, 100, 1 );

		}


