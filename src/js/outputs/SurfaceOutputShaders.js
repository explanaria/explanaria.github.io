//SurfaceOutputShaders.js

//experiment: shaders to get the triangle pulsating!
var vShader = [
"varying vec3 vNormal;",
"varying vec3 vPosition;",
"varying vec2 vUv;",
"uniform float time;",
"uniform vec3 color;",
"uniform vec3 vLight;",
"uniform float gridSquares;",

"void main() {",
	"vPosition = position.xyz;",
	"vNormal = normal.xyz;",
	"vUv = uv.xy;",
	"gl_Position = projectionMatrix *",
            "modelViewMatrix *",
            "vec4(position,1.0);",
"}"].join("\n")

var fShader = [
"varying vec3 vNormal;",
"varying vec3 vPosition;",
"varying vec2 vUv;",
"uniform float time;",
"uniform vec3 color;",
"uniform vec3 vLight;",
"uniform float gridSquares;",
"uniform float lineWidth;",
"uniform float showGrid;",
"uniform float showSolid;",

	//the following code from https://github.com/unconed/mathbox/blob/eaeb8e15ef2d0252740a74505a12d7a1051a61b6/src/shaders/glsl/mesh.fragment.shaded.glsl
"vec3 offSpecular(vec3 color) {",
"  vec3 c = 1.0 - color;",
"  return 1.0 - c * c;",
"}",

"vec4 getShadedColor(vec4 rgba) { ",
"  vec3 color = rgba.xyz;",
"  vec3 color2 = offSpecular(rgba.xyz);",

"  vec3 normal = normalize(vNormal);",
"  vec3 light = normalize(vLight);",
"  vec3 position = normalize(vPosition);",

"  float side    = gl_FrontFacing ? -1.0 : 1.0;",
"  float cosine  = side * dot(normal, light);",
"  float diffuse = mix(max(0.0, cosine), .5 + .5 * cosine, .1);",

"  float rimLighting = max(min(1.0 - side*dot(normal, light), 1.0),0.0);",

"	float specular = max(0.0, cosine - 0.5);",
"   return vec4(diffuse*color + 0.9*rimLighting*color + 0.4*color2 * specular, rgba.a);",
"}",

"vec4 gridLineColor(vec2 uv, vec4 color) {",
"  vec2 distToEdge = abs(mod(vUv.xy*gridSquares + lineWidth/2.0,1.0));",
"  if( distToEdge.x < lineWidth){",
"    return vec4(offSpecular(color.xyz), color.a);",
"  } else if(distToEdge.y < lineWidth){ ",
"    return vec4(offSpecular(color.xyz), color.a);",
"  }",
"  return vec4(0.0);",
"}",
/*
"vec4 getShadedColorMathbox(vec4 rgba) { ",
"  vec3 color = rgba.xyz;",
"  vec3 color2 = offSpecular(rgba.xyz);",

"  vec3 normal = normalize(vNormal);",
"  vec3 light = normalize(vLight);",
"  vec3 position = normalize(vPosition);",
"  float side    = gl_FrontFacing ? -1.0 : 1.0;",
"  float cosine  = side * dot(normal, light);",
"  float diffuse = mix(max(0.0, cosine), .5 + .5 * cosine, .1);",
"   vec3  halfLight = normalize(light + position);",
"	float cosineHalf = max(0.0, side * dot(normal, halfLight));",
"	float specular = pow(cosineHalf, 16.0);",
"	return vec4(color * (diffuse * .9 + .05) *0.0 +  .25 * color2 * specular, rgba.a);",
"}",*/

"void main(){",
//"  //gl_FragColor = vec4(vNormal.xyz, 1.0); // view debug normals",
//"  //if(vNormal.x < 0.0){gl_FragColor = vec4(offSpecular(color.rgb), 1.0);}else{gl_FragColor = vec4((color.rgb), 1.0);}", //view specular and non-specular colors
//"  gl_FragColor = vec4(mod(vUv.xy,1.0),0.0,1.0); //show uvs
"  vec4 materialColor = getShadedColor(vec4(color.rgb, 1.0));",
"  vec4 gridLineColor = gridLineColor(vUv.xy, vec4(color.rgb, 1.0));",
"  gl_FragColor = showSolid*materialColor + showGrid*gridLineColor;",	
"}"].join("\n")

var uniforms = {
	time: {
		type: 'f',
		value: 0,
	},
	color: {
		type: 'c',
		value: new THREE.Color(0x55aa55),
	},
	vLight: { //light direction
		type: 'vec3',
		value: [0,0,1],
	},
	gridSquares: {
		type: 'f',
		value: 4,
	},
	lineWidth: {
		type: 'f',
		value: 0.1,
	},
	showGrid: {
		type: 'f',
		value: 1.0,
	},
	showSolid: {
		type: 'f',
		value: 1.0,
	}
};

export { vShader, fShader, uniforms };
