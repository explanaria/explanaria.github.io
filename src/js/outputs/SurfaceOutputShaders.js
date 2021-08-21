//SurfaceOutputShaders.js
import * as THREE from "../../lib/three.module.js";

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
"#extension GL_OES_standard_derivatives : enable",
"varying vec3 vNormal;",
"varying vec3 vPosition;",
"varying vec2 vUv;",
"uniform float time;",
"uniform vec3 color;",
"uniform float useCustomGridColor;",
"uniform vec3 gridColor;",
"uniform vec3 vLight;",
"uniform float gridSquares;",
"uniform float lineWidth;",
"uniform float showGrid;",
"uniform float showSolid;",
"uniform float opacity;",

	//the following code from https://github.com/unconed/mathbox/blob/eaeb8e15ef2d0252740a74505a12d7a1051a61b6/src/shaders/glsl/mesh.fragment.shaded.glsl
"vec3 offSpecular(vec3 color) {",
"  vec3 c = 1.0 - color;",
"  return 1.0 - c * c;",
"}",

"vec4 getShadedColor(vec3 rgb) { ",
"  vec3 color = rgb.xyz;",
"  vec3 color2 = offSpecular(rgb.xyz);",

"  vec3 normal = normalize(vNormal);",
"  vec3 light = normalize(vLight);",
"  vec3 position = normalize(vPosition);",

"  float side    = gl_FrontFacing ? -1.0 : 1.0;",
"  float cosine  = side * dot(normal, light);",
"  float diffuse = mix(max(0.0, cosine), .5 + .5 * cosine, .1);",

"  float rimLighting = max(min(1.0 - side*dot(normal, light), 1.0),0.0);",

"	float specular = max(0.0, abs(cosine) - 0.5);", //double sided specular
"   return vec4(diffuse*color + 0.9*rimLighting*color + 0.4*color2 * specular,1.0);",
"}",

// Smooth HSV to RGB conversion from https://www.shadertoy.com/view/MsS3Wc
"vec3 hsv2rgb_smooth( in vec3 c ){",
"    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );",
"	rgb = rgb*rgb*(3.0-2.0*rgb); // cubic smoothing	",
"	return c.z * mix( vec3(1.0), rgb, c.y);",
"}",

//From Sam Hocevar: http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
"vec3 rgb2hsv(vec3 c){",
"    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);",
"    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));",
"    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));",

"    float d = q.x - min(q.w, q.y);",
"    float e = 1.0e-10;",
"    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);",
"}",
 //chooses the color for the gridlines by varying lightness. 
//NOT continuous or else by the intermediate function theorem there'd be a point where the gridlines were the same color as the material.
"vec3 autoCalculatedGridLineColor(vec3 diffuseColor){",
" vec3 hsv = rgb2hsv(diffuseColor.xyz);",
" //hsv.x += 0.1;",
" if(hsv.z < 0.8){hsv.z += 0.2;}else{hsv.z = 0.85-0.1*hsv.z;hsv.y -= 0.0;}",
" vec3 autoCalculatedColor = hsv2rgb_smooth(hsv);",
" return mix(autoCalculatedColor, diffuseColor, (1.0-showSolid)*(1.0-useCustomGridColor));", //if showSolid is 0.0 and useCustomGridColor is 0.0, just use the diffuse color as the grid color
"}",

"vec4 renderGridlines(vec4 existingColor, vec2 uv, vec3 chosenGridLineColor) {",
"  vec2 vdistToGridEdge = (0.5-abs(mod(vUv.xy*gridSquares, 1.0)-0.5));", //thanks, desmos
"  float distToGridEdge = min(vdistToGridEdge.x,vdistToGridEdge.y);",
"  vec4 blendedGridLineColor = showGrid * vec4(chosenGridLineColor,1.0) + (1.0-showGrid)*existingColor.rgba;", //if showGrid =0, use solidColor as the gridline color, hiding the grid
"  float blendBetweenGridColorVsSolidColorFactor = (smoothstep(lineWidth-1.*fwidth(distToGridEdge), lineWidth, distToGridEdge));", //if distToEdge.x < lineWidth || distToEdge.y < lineWidth, but with a smoothstep
"  return mix(blendedGridLineColor,existingColor,blendBetweenGridColorVsSolidColorFactor);",
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
"  vec4 solidColor = showSolid*showSolid*vec4(color.rgb, 1.0);",
"  vec4 solidColorOut = showSolid*getShadedColor(color.rgb);",
"  vec3 chosenGridLineColor = mix(autoCalculatedGridLineColor(color.rgb), gridColor, useCustomGridColor); ", //use either autoCalculatedGridLineColor(color) or override with user-specified gridColor variable.
"  vec4 colorWithGridlines = renderGridlines(solidColorOut, vUv.xy, chosenGridLineColor);",
"  colorWithGridlines.a *= opacity;",
"  gl_FragColor = colorWithGridlines;",	
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
	useCustomGridColor: {
		type: 'f',
		value: 0,
	},
	gridColor: {
		type: 'c',
		value: new THREE.Color(0x55aa55),
	},
	opacity: {
		type: 'f',
		value: 0.1,
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
