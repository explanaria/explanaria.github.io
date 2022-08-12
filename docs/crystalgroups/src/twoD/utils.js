export function rotate2D(degrees, x,y){
    let rad = degrees * Math.PI / 180;
    return [x * Math.cos(rad) - y * Math.sin(rad),
            x * Math.sin(rad) + y * Math.cos(rad)]
}
