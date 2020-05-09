//LineOutputShaders.js

//based on https://mattdesl.svbtle.com/drawing-lines-is-hard but with several errors corrected, bevel shading added, and more

const LINE_JOIN_TYPES = {"MITER": 0.2, "BEVEL":1.2,"ROUND":2.2}; //I'd use 0,1,2 but JS doesn't add a decimal place at the end when inserting them in a string. cursed justification

var vShader = [
"uniform float aspect;", //used to calibrate screen space
"uniform float lineWidth;", //width of line
"uniform float lineJoinType;",
//"attribute vec3 position;", //added automatically by three.js
"attribute vec3 nextPointPosition;",
"attribute vec3 previousPointPosition;",
"attribute float direction;",
"attribute float approachNextOrPrevVertex;",

"varying float crossLinePosition;",
"attribute vec3 color;",
"varying vec3 vColor;",
"varying vec2 lineSegmentAClipSpace;",
"varying vec2 lineSegmentBClipSpace;",
"varying float thickness;",


"varying vec3 debugInfo;",

"vec3 angle_to_hue(float angle) {", //for debugging
"  angle /= 3.141592*2.;",
"  return clamp((abs(fract(angle+vec3(3.0, 2.0, 1.0)/3.0)*6.0-3.0)-1.0), 0.0, 1.0);",
"}",

//given an unit vector, move dist units perpendicular to it.
"vec2 offsetPerpendicularAlongScreenSpace(vec2 dir, float twiceDist) {",
  "vec2 normal = vec2(-dir.y, dir.x) ;",
  "normal *= twiceDist/2.0;",
  "normal.x /= aspect;",
  "return normal;",
"}",

"void main() {",

  "vec2 aspectVec = vec2(aspect, 1.0);",
  "mat4 projViewModel = projectionMatrix *",
            "viewMatrix * modelMatrix;",
  "vec4 previousProjected = projViewModel * vec4(previousPointPosition, 1.0);",
  "vec4 currentProjected = projViewModel * vec4(position, 1.0);",
  "vec4 nextProjected = projViewModel * vec4(nextPointPosition, 1.0);",


  //get 2D screen space with W divide and aspect correction
  "vec2 currentScreen = currentProjected.xy / currentProjected.w * aspectVec;",
  "vec2 previousScreen = previousProjected.xy / previousProjected.w * aspectVec;",
  "vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;",

  //"centerPointClipSpacePosition = currentProjected.xy / currentProjected.w;",//send to fragment shader
  "crossLinePosition = direction;", //send direction to the fragment shader
  "vColor = color;", //send direction to the fragment shader

  "thickness = lineWidth / 400.;", //TODO: convert lineWidth to pixels
  "float orientation = (direction-0.5)*2.;",

  //get directions from (C - B) and (B - A)
  "vec2 vecA = (currentScreen - previousScreen);",
  "vec2 vecB = (nextScreen - currentScreen);",
  "vec2 dirA = normalize(vecA);",
  "vec2 dirB = normalize(vecB);",

  //DEBUG
  "lineSegmentAClipSpace = mix(previousScreen,currentScreen,approachNextOrPrevVertex) / aspectVec;",//send to fragment shader
  "lineSegmentBClipSpace = mix(currentScreen,nextScreen,approachNextOrPrevVertex) / aspectVec;",//send to fragment shader

  //starting point uses (next - current)
  "vec2 offset = vec2(0.0);",
  "if (currentScreen == previousScreen) {",
  "  offset = offsetPerpendicularAlongScreenSpace(dirB * orientation, thickness);",
  //offset += dirB * thickness; //end cap
  "} ",
  //ending point uses (current - previous)
  "else if (currentScreen == nextScreen) {",
  "  offset = offsetPerpendicularAlongScreenSpace(dirA * orientation, thickness);",
  //offset += dirA * thickness; //end cap
  "}",
  "//somewhere in middle, needs a join",
  "else {",
  "  if (lineJoinType == "+LINE_JOIN_TYPES.MITER+") {",
        //corner type: miter. This is buggy (there's no miter limit yet) so don't use
  "    //now compute the miter join normal and length",
  "    vec2 miterDirection = normalize(dirA + dirB);",
  "    vec2 prevLineExtrudeDirection = vec2(-dirA.y, dirA.x);",
  "    vec2 miter = vec2(-miterDirection.y, miterDirection.x);",
  "    float len = thickness / (dot(miter, prevLineExtrudeDirection)+0.0001);", //calculate. dot product is always > 0
  "    offset = offsetPerpendicularAlongScreenSpace(miterDirection * orientation, len);",
  "  } else if (lineJoinType == "+LINE_JOIN_TYPES.BEVEL+"){",
    //corner type: bevel
  "    vec2 dir = mix(dirA, dirB, approachNextOrPrevVertex);",
  "    offset = offsetPerpendicularAlongScreenSpace(dir * orientation, thickness);",
  "  } else if (lineJoinType == "+LINE_JOIN_TYPES.ROUND+"){",
    //corner type: round
  "    vec2 dir = mix(dirA, dirB, approachNextOrPrevVertex);",
  "    vec2 halfThicknessPastTheVertex = dir*thickness/2. * approachNextOrPrevVertex / aspectVec;",
  "    offset = offsetPerpendicularAlongScreenSpace(dir * orientation, thickness) - halfThicknessPastTheVertex;", //extend rects past the vertex
  "  } else {", //no line join type specified, just go for the previous point
  "    offset = offsetPerpendicularAlongScreenSpace(dirA, thickness);",
  "  }",
  "}",

  "debugInfo = vec3(approachNextOrPrevVertex, orientation, 0.0);", //TODO: remove. it's for debugging colors
  "gl_Position = currentProjected + vec4(offset, 0.0,0.0) *currentProjected.w;",
"}"].join("\n");

var fShader = [
"uniform float opacity;",
"uniform vec2 screenSize;",
"uniform float aspect;",
"uniform float lineJoinType;",
"varying vec3 vColor;",
"varying vec3 debugInfo;",
"varying vec2 lineSegmentAClipSpace;",
"varying vec2 lineSegmentBClipSpace;",
"varying float crossLinePosition;",
"varying float thickness;",

/* useful for debugging! from https://www.ronja-tutorials.com/2018/11/24/sdf-space-manipulation.html
"vec3 renderLinesOutside(float dist){",
"    float _LineDistance = 0.3;",
"    float _LineThickness = 0.05;",
"    float _SubLineThickness = 0.05;",
"    float _SubLines = 1.0;",
"    vec3 col = mix(vec3(1.0,0.2,0.2), vec3(0.0,0.2,1.2), step(0.0, dist));",

"    float distanceChange = fwidth(dist) * 0.5;",
"    float majorLineDistance = abs(fract(dist / _LineDistance + 0.5) - 0.5) * _LineDistance;",
"    float majorLines = smoothstep(_LineThickness - distanceChange, _LineThickness + distanceChange, majorLineDistance);",

"    float distanceBetweenSubLines = _LineDistance / _SubLines;",
"    float subLineDistance = abs(fract(dist / distanceBetweenSubLines + 0.5) - 0.5) * distanceBetweenSubLines;",
"    float subLines = smoothstep(_SubLineThickness - distanceChange, _SubLineThickness + distanceChange, subLineDistance);",

"    return col * majorLines * subLines;",
"}", */


"float lineSDF(vec2 point, vec2 lineStartPt,vec2 lineEndPt) {",
  "float h = clamp(dot(point-lineStartPt,lineEndPt-lineStartPt)/dot(lineEndPt-lineStartPt,lineEndPt-lineStartPt),0.0,1.0);",
  "vec2 projectedVec = (point-lineStartPt-(lineEndPt-lineStartPt)*h);",
  "return length(projectedVec);",
"}",


"void main(){",
"  vec3 col = vColor.rgb;",
//"  col = debugInfo.rgb;",
"  gl_FragColor = vec4(col, opacity);",

"  if (lineJoinType == "+LINE_JOIN_TYPES.ROUND+"){",
"      vec2 vertScreenSpacePosition = gl_FragCoord.xy;", //goes from 0 to screenSize.xy
"      vec2 linePtAScreenSpace = (lineSegmentAClipSpace+1.)/2. * screenSize;", //convert [-1,1] to [0,1], then *screenSize
"      vec2 linePtBScreenSpace = (lineSegmentBClipSpace+1.)/2. * screenSize;",
"      float distFromLine = lineSDF(vertScreenSpacePosition, linePtAScreenSpace,linePtBScreenSpace);",
"      float sdf = 1.-(1./thickness /screenSize.y * 4.0 *distFromLine);",
"      float sdfOpacity = clamp(sdf / (abs(dFdx(sdf)) + abs(dFdy(sdf))),0.0,1.0);",
"      gl_FragColor = vec4(col, opacity * sdfOpacity );",
"  }",
"}"].join("\n")

var uniforms = {
	lineWidth: {
		type: 'f',
		value: 1.0, //currently in units of yHeight*400
	},
	screenSize: {
		value: new THREE.Vector2( 1, 1 ),
	},
	lineJoinType: {
		type: 'f',
		value: LINE_JOIN_TYPES.ROUND,
	},
	opacity: {
		type: 'f',
		value: 1.0,
	},
	aspect: { //aspect ratio. need to load from renderer
		type: 'f',
		value: 1.0,
	}
};

export { vShader, fShader, uniforms, LINE_JOIN_TYPES };
