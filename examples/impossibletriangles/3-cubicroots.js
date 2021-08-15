
/*
y = x^3 + -2x + 1

where are the roots

solve x^3 + -2x + 1 = 0

if one root, [leftmost root :]

if three roots, [roots[0]:roots[1]], then [roots[2]:500]
*/

const π = Math.PI;
const abs = Math.abs;
const cos = Math.cos;
const sqrt = Math.sqrt;
const atan2 = Math.atan2;
const cbrt = Math.cbrt;
function cardanoRealRoots(p, q, ε=1e-10) {
    //Find the real roots of x^3 + px + q = 0, ignoring any complex roots.
    //modified from https://services.math.duke.edu/~jdr/linalg_js/doc/polynomial.js.html#line-855
    //license: GLP3

    // Handle roots at zero
    if(abs(q) <= ε) {
        if(abs(p) <= ε)
            return [0];  // Triple root
        let s = sqrt(abs(p));
        if(p < 0)
            return [-s, 0, s];
        return [0];
    }

    // Discriminant
    const Δ = -27*q*q - 4*p*p*p;
    if(abs(Δ) <= ε) {
        // Simple root and double root
        const cr = cbrt(-q/2);
        return cr < 0
            ? [2*cr,  -cr]
            : [ -cr, 2*cr]; //information about which root is the double root has been thrown out here
    }

    if(Δ > 0) {
        // Three distinct real roots: 2*Re(cube roots of -q/2 + i sqrt(Δ/108))
        const D = sqrt(Δ/108);
        const mod = sqrt(cbrt(q*q/4 + Δ/108)) * 2;
        const arg = atan2(D, -q/2);
        return [mod*cos(arg/3), mod*cos(arg/3 + 2*π/3), mod*cos(arg/3 - 2*π/3)]
            .sort((x, y) => x-y);
    }

    // Simple real root and conjugate complex roots
    const D = sqrt(-Δ/108);
    const α = cbrt(-q/2 + D), β = cbrt(-q/2 - D), r = α + β;
    return [r]; //complex roots ignored
}

export {cardanoRealRoots};
