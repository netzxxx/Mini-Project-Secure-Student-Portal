// Builds the geometry of the character in the background, so the page never freezes.
// Every part (head, shirt, shoe...) is a distance function: negative inside, positive outside.
// mesh() turns such a function into triangles; hair is grown strand by strand.
'use strict';

const { abs, min, max, sqrt, sin, cos, PI, floor, hypot, exp } = Math;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const step = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const HEAD = 1.68; // height of the head centre
importScripts('/js/avatar-human.js');

// ---------- distance functions ----------
function smin(a, b, k) { const h = max(k - abs(a - b), 0) / k; return min(a, b) - h * h * k * .25; } // soft union
function smax(a, b, k) { return -smin(-a, -b, k); } // soft intersection

function ball(x, y, z, cx, cy, cz, r) { return hypot(x - cx, y - cy, z - cz) - r; }

function ell(x, y, z, cx, cy, cz, rx, ry, rz) { // ellipsoid
    x -= cx; y -= cy; z -= cz;
    const a = x / rx, b = y / ry, c = z / rz;
    const k0 = sqrt(a * a + b * b + c * c);
    if (k0 < 1e-4) return -min(rx, ry, rz);
    const d = a / rx, e = b / ry, f = c / rz;
    return k0 * (k0 - 1) / sqrt(d * d + e * e + f * f);
}

function cap(x, y, z, a, b, ra, rb) { // capsule with two radii
    const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
    x -= a[0]; y -= a[1]; z -= a[2];
    const t = clamp((x * bx + y * by + z * bz) / (bx * bx + by * by + bz * bz), 0, 1);
    return hypot(x - bx * t, y - by * t, z - bz * t) - ra - (rb - ra) * t;
}
function along(x, y, z, a, b) {
    const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
    return ((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / (bx * bx + by * by + bz * bz);
}
function box(x, y, z, cx, cy, cz, hx, hy, hz, r) {
    const a = abs(x - cx) - hx + r, b = abs(y - cy) - hy + r, c = abs(z - cz) - hz + r;
    return hypot(max(a, 0), max(b, 0), max(c, 0)) + min(max(a, b, c), 0) - r;
}

// ---------- noise ----------
function hash(i, j, k) { const n = sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return n - floor(n); }
function noise(x, y, z) {
    const i = floor(x), j = floor(y), k = floor(z);
    let u = x - i, v = y - j, w = z - k;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
    return mix(mix(mix(hash(i, j, k), hash(i + 1, j, k), u), mix(hash(i, j + 1, k), hash(i + 1, j + 1, k), u), v),
        mix(mix(hash(i, j, k + 1), hash(i + 1, j, k + 1), u), mix(hash(i, j + 1, k + 1), hash(i + 1, j + 1, k + 1), u), v), w) * 2 - 1;
}
const folds = (x, y, z) => 1 - 2 * abs(noise(x, y, z)); // sharp ridges, like creases in cloth

// ---------- surface nets: distance function -> triangles ----------
function mesh(f, lo, hi, cell) {
    const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1, ny = Math.ceil((hi[1] - lo[1]) / cell) + 1, nz = Math.ceil((hi[2] - lo[2]) / cell) + 1;
    const grid = new Float32Array(nx * ny * nz).fill(1);
    const B = 6, reach = B * cell * 1.75;
    for (let k = 0; k < nz; k += B) for (let j = 0; j < ny; j += B) for (let i = 0; i < nx; i += B) {
        // blocks far from the surface are filled with one value
        const c = f(lo[0] + (i + B / 2) * cell, lo[1] + (j + B / 2) * cell, lo[2] + (k + B / 2) * cell);
        const skip = abs(c) > reach;
        for (let w = k; w < min(k + B, nz); w++) for (let v = j; v < min(j + B, ny); v++) for (let u = i; u < min(i + B, nx); u++) {
            grid[u + nx * (v + ny * w)] = skip ? c : f(lo[0] + u * cell, lo[1] + v * cell, lo[2] + w * cell);
        }
    }
    const index = new Int32Array(nx * ny * nz).fill(-1);
    const pos = [], tri = [];
    const sx = 1, sy = nx, sz = nx * ny;
    const corner = [0, sx, sy, sx + sy, sz, sx + sz, sy + sz, sx + sy + sz];
    const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const at = i + nx * (j + ny * k);
        let inside = 0;
        for (let c = 0; c < 8; c++) if (grid[at + corner[c]] < 0) inside++;
        if (inside === 0 || inside === 8) continue;
        let x = 0, y = 0, z = 0, n = 0;
        for (const [a, b] of edges) {
            const va = grid[at + corner[a]], vb = grid[at + corner[b]];
            if ((va < 0) === (vb < 0)) continue;
            const t = va / (va - vb);
            x += mix(a & 1, b & 1, t); y += mix((a >> 1) & 1, (b >> 1) & 1, t); z += mix(a >> 2, b >> 2, t); n++;
        }
        index[at] = pos.length / 3;
        pos.push(lo[0] + (i + x / n) * cell, lo[1] + (j + y / n) * cell, lo[2] + (k + z / n) * cell);
    }
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        const at = i + nx * (j + ny * k), here = grid[at] < 0;
        for (const [d, e, g] of [[sx, sy, sz], [sy, sz, sx], [sz, sx, sy]]) {
            if (here === (grid[at + d] < 0)) continue;
            const a = index[at - e - g], b = index[at - g], c = index[at], q = index[at - e];
            if (a < 0 || b < 0 || c < 0 || q < 0) continue;
            if (here) tri.push(a, b, c, a, c, q); else tri.push(a, c, b, a, q, c);
        }
    }
    const n = pos.length / 3, normal = new Float32Array(n * 3), ao = new Float32Array(n), h = cell * .5;
    for (let i = 0; i < n; i++) {
        let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], nxv, nyv, nzv;
        {
            const a = f(x + h, y - h, z - h), b = f(x - h, y - h, z + h), c = f(x - h, y + h, z - h), d = f(x + h, y + h, z + h);
            nxv = a - b - c + d; nyv = -a - b + c + d; nzv = -a + b - c + d;
            const l = hypot(nxv, nyv, nzv) || 1;
            nxv /= l; nyv /= l; nzv /= l;
            const s = clamp(f(x, y, z), -cell, cell) * .8; // move the vertex exactly onto the surface
            x -= nxv * s; y -= nyv * s; z -= nzv * s;
        }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        normal[i * 3] = nxv; normal[i * 3 + 1] = nyv; normal[i * 3 + 2] = nzv;
        let shade = 0; // ambient occlusion: how closed the place is
        for (const s of [.008, .026]) shade += clamp((s - f(x + nxv * s, y + nyv * s, z + nzv * s)) / s, 0, 1) / 2;
        ao[i] = 1 - .75 * shade;
    }
    return { pos: new Float32Array(pos), normal, ao, index: new Uint32Array(tri) };
}

// Bounds are given for the right half; mirrored parts are computed once and copied.
function mirrored(m) {
    const n = m.pos.length / 3, t = m.index.length;
    const pos = new Float32Array(n * 6), normal = new Float32Array(n * 6), ao = new Float32Array(n * 2), index = new Uint32Array(t * 2);
    pos.set(m.pos); normal.set(m.normal); ao.set(m.ao); ao.set(m.ao, n); index.set(m.index);
    for (let i = 0; i < n * 3; i++) {
        const s = i % 3 === 0 ? -1 : 1;
        pos[n * 3 + i] = s * m.pos[i];
        normal[n * 3 + i] = s * m.normal[i];
    }
    for (let i = 0; i < t; i += 3) { index[t + i] = n + m.index[i]; index[t + i + 1] = n + m.index[i + 2]; index[t + i + 2] = n + m.index[i + 1]; }
    return { pos, normal, ao, index };
}

// ---------- the person ----------
// The body itself comes from avatar-human.js; here it becomes distance functions for clothes and hair.
function person(c) {
    const H = Human.person(c), G = Human.grids(H), { S, E, W } = H;
    const torso = (x, y, z, grow) => max(G.trunk(abs(x), y, z) - grow, (.80 - y) * .7, (y - 1.52) * .7);
    const arm = (x, y, z) => max(G.arm(x, y, z), min(cap(x, y, z, S, E, armR, armR), cap(x, y, z, E, W, armR, armR)), (along(x, y, z, E, W) - 1.06) * .27); // x is already positive
    const armR = .078 + max(0, c.weight) * .02 + max(0, c.muscle) * .012;
    const armT = (x, y, z) => { const u = along(x, y, z, S, E); return y > E[1] ? u : 1 + max(0, along(x, y, z, E, W)); };
    const leg = (x, y, z) => max(G.leg(x, max(y, .105), z), (y - .92) * .8); // straight down to the shoe
    const skull = (x, y, z) => (y < -.13 ? G.trunk : G.head)(abs(x), y + HEAD, z);
    const neckline = (x, Y, z) => (Y < 1.545 ? G.trunk(abs(x), Y, z) : min(G.trunk(abs(x), Y, z), G.head(abs(x), Y, z)));
    return {
        H, G, S, E, W, K: H.K, A: H.A, torso, arm, armT, leg, skull, neckline, f: c.build, w: c.weight, mus: c.muscle, fw: H.width,
        eyeX: H.eye.x, eyeY: H.eye.y - HEAD, eyeZ: H.eye.z, eyeR: H.eye.r, nose: H.nose, temple: H.temple, earTop: H.earTop, lobe: H.lobe,
    };
}

// ---------- clothes ----------
const TOPS = {
    tee: { grow: .011, sleeve: .60, hem: .88, neck: .074 },
    polo: { grow: .009, sleeve: .62, hem: .90, neck: .064, collar: 1, buttons: 2 },
    tank: { grow: .006, sleeve: 0, hem: .89, neck: .088 },
    longsleeve: { grow: .009, sleeve: 1.93, hem: .89, neck: .070 },
    shirt: { grow: .010, sleeve: 1.91, hem: .86, neck: .060, collar: 1, buttons: 7 },
    sweater: { grow: .019, sleeve: 1.95, hem: .89, neck: .066, rib: 1 },
    hoodie: { grow: .024, sleeve: 1.95, hem: .86, neck: .070, hood: 1, rib: 1, pocket: 1 },
    bomber: { grow: .027, sleeve: 1.95, hem: .91, neck: .068, open: .028, rib: 1, zip: 1, stand: 1 },
    leather: { grow: .021, sleeve: 1.94, hem: .91, neck: .066, stand: 1, open: .042, lapel: 1, zip: 1 },
    blazer: { grow: .020, sleeve: 1.92, hem: .845, neck: .060, open: .035, lapel: 1, buttons: 2 },
};

function clothes(c, P, add) {
    const T = TOPS[c.top] || TOPS.tee;
    const grow = T.grow + c.fit * .010;
    const jacket = Boolean(T.open);
    const tucked = (c.tuck || c.bottom === 'skirt') && !jacket && !T.rib;
    const hemAt = tucked ? .975 : T.hem;
    const collarTop = 1.478;
    // the neck opening is a tilted circle: lower in front, higher at the back
    const plane = (z, neck) => 1.492 - (neck - .06) * 1.2 - (z + .03) * .5;
    const around = (x, y, z) => { const t = (y - 1.485) * .89 + (z + .032) * .455; return [hypot(x, y - 1.485 - t * .89, z + .032 - t * .455), t]; };
    const under = (({ jeans: .011, skinny: .004, chinos: .013, joggers: .019, cargo: .022, shorts: .026 })[c.bottom] || .010) + c.legFit * .010 + .007;
    const opening = (x, y, z, neck) => { const [q, t] = around(x, y, z); return max(q - neck * 1.06, -.06 - t); };
    const bump = (x, y, z, s) => {
        // creases: diagonal under the arms, soft on the belly
        const pit = step(.22, .05, hypot(abs(x) - P.S[0] + .03, (y - 1.35) * .7));
        const low = step(1.16, .95, y) * (T.rib || tucked ? step(T.hem + .02, T.hem + .12, y) : 1);
        return s * (.0038 * pit * folds(x * 9 + y * 22, y * 8 - x * 16, z * 9) + .0030 * low * folds(x * 11, y * 16 + x * 5, z * 11) + .0011 * noise(x * 16, y * 11, z * 16));
    };
    function cloth(x, y, z, g, sleeve, hem, neck, s) {
        const ax = abs(x);
        const low = hem > .96 ? mix(g, .002, step(1.07, 1.01, y)) : g + (y < 1.08 && !T.rib ? (1.08 - y) * .03 : 0);
        let d = P.torso(x, y, z, low);
        d = smin(d, cap(ax, y, z, [P.S[0] - .03, P.S[1], P.S[2]], P.S, .022 + P.mus * .008 + g, .022 + P.mus * .008 + g), .05);
        if (y > 1.36) d = smin(d, P.neckline(x, y, z) - min(g, .012) - .001 + step(1.43, 1.36, y) * .04, .014);
        if (y < 1.04 && hem < .96) d = smin(d, P.leg(ax, y, z) - under, .05); // over the trousers
        d += bump(x, y, z, s);
        if (sleeve > 0) {
            const t = P.armT(ax, y, z);
            const loose = g * (t < 1 ? 1 : 1.05) + (sleeve < 1 ? .012 * clamp(t, 0, 1) : .003);
            let a = P.arm(ax, y, z) - loose;
            const bend = exp(-(((t - 1) / .22) ** 2)), wrist = exp(-(((t - sleeve) / .35) ** 2)) * (sleeve > 1 ? 1 : .3);
            a += s * (.0042 * bend * folds(x * 10 + y * 12, y * 30, z * 12) + .0020 * wrist * folds(x * 8, y * 46 + z * 14, z * 9) + .0012 * noise(x * 20, y * 14, z * 20));
            const lastPart = sleeve < 1 ? (t - sleeve) * .285 : (t - sleeve) * .25;
            a = smax(a, lastPart, .006);
            if (lastPart > -.03) a = max(a, -(P.arm(ax, y, z) - .003));
            d = smin(d, a, mix(.004, .035, step(1.22, 1.34, y)));
        } else {
            // sleeveless: the shoulder is cut off
            d = smax(d, -cap(ax, y, z, [P.S[0] + .05, 1.30, -.01], [P.S[0] + .045, 1.52, -.01], .062, .075), .012);
        }
        d = smax(d, hem - y - .006 * noise(x * 7, 1, z * 7), .008);
        d = smax(d, -opening(x, y, z, neck), .005);
        d = smax(d, y - 1.53, .01);
        return d;
    }
    const outer = (x, y, z) => cloth(x, y, z, grow, T.sleeve, hemAt, T.neck, 1);
    const lapelEdge = (y) => (T.lapel ? T.open + step(c.top === 'blazer' ? 1.08 : 1.14, 1.44, y) * .035 - (c.top === 'blazer' ? step(1.12, 1.02, y) * .026 : 0) : T.open);
    const shape = jacket
        ? (x, y, z) => smax(outer(x, y, z), z > 0 ? -max(abs(x) - lapelEdge(y), .02 - z) : -1, .006)
        : outer;
    const reach = P.W[0] + .07;
    const inner = jacket ? (c.top === 'blazer' ? { grow: .007, sleeve: 0, hem: .975, neck: .058 } : { grow: .008, sleeve: .3, hem: .975, neck: .072 }) : null;
    add('top', 'top', [c.top, c.fit, tucked, c.bottom, c.legFit], () => mesh(shape, [-reach, T.hem - .05, -.24], [reach, 1.56, .24], .0062));
    if (inner) add('inner', 'inner', [c.top], () => mesh((x, y, z) => cloth(x, y, z, inner.grow, 0.001, inner.hem, inner.neck, .5), [-.24, .84, -.2], [.24, 1.56, .22], .0065));

    // ring of a collar around the neck
    const ringAt = (x, y, z, r, height, thick) => {
        const q = P.neckline(x, y, z) - r;
        const [w, t] = around(x, y, z), o = T.stand ? y - plane(z, T.neck) - .014 : w - T.neck * 1.06 + height * .4;
        return max(hypot(max(abs(q) - thick, 0), max(abs(o) - height, 0)), -.07 - t, t - .06, jacket && z > 0 ? T.open * .7 - abs(x) : -1);
    };
    const neckBox = [[-.14, 1.34, -.15], [.14, 1.58, .17]];
    if (!T.collar && !T.hood && c.top !== 'blazer' && T.sleeve !== 0) {
        add('rib', 'rib', [c.top, c.fit], () => mesh((x, y, z) => ringAt(x, y, z, min(grow, .012) + .002, T.stand ? .018 : .006, .0012) - .0052
            - .0006 * sin(Math.atan2(x, z) * 130), ...neckBox, .0038));
    }
    const collar = T.collar || c.top === 'blazer';
    if (collar) {
        add('collar', c.top === 'blazer' ? 'inner' : 'top', [c.top, 'collar', c.build], () => mesh((x, y, z) => {
            const base = plane(z, T.neck) + .010, fall = clamp((base + .02 - y) / .04, 0, 1);
            let d = hypot(max(abs(P.neckline(x, y, z) - .0085 - fall * .016) - .0012, 0), max(y - base - .018, base - .018 - step(.02, .07, z) * (.006 + .020 * step(.062, .012, abs(x))) - y, 0)) - .0030;
            return smax(smax(d, z > 0 ? .005 + step(base + .015, base - .035, y) * .030 - abs(x) : -1, .003), z > 0 ? abs(x) - .066 + step(base, base - .03, y) * .02 : -1, .004); // open at the throat
        }, [-.15, 1.36, -.16], [.15, 1.57, .16], .0034));
    }
    // things sewn on the front: placed a little above the cloth surface
    const front = (x, y) => { let z = .26; for (let i = 0; i < 40; i++) { const d = shape(x, y, z); if (d < .0006) break; z -= d * .7; } return z; };
    if (T.buttons) {
        add('buttons', 'trim', [c.top, c.fit, 'b'], () => {
            const list = [];
            const x0 = jacket ? lapelEdge(1.02) + .012 : 0;
            for (let i = 0; i < T.buttons; i++) { const y = jacket ? 1.06 - i * .085 : 1.415 - i * .078; list.push([x0, y, front(x0, y)]); }
            return mesh((x, y, z) => {
                let d = 1;
                for (const b of list) d = min(d, hypot(max(hypot(x - b[0], y - b[1]) - .0042, 0), max(abs(z - b[2]) - .0012, 0)) - .0012);
                return d;
            }, [x0 - .012, .86, 0], [x0 + .012, 1.45, .22], .0016);
        });
    }
    if (!jacket && T.collar) { // button placket
        const end = c.top === 'polo' ? 1.30 : T.hem + .01;
        add('placket', 'top', [c.top, c.fit, 'p'], () => mesh((x, y, z) => smax(max(shape(x, y, z) - .0026, abs(x) - .015, end - y, y - 1.45), -(z - .02), .002) + .001, [-.02, end - .01, 0], [.02, 1.46, .22], .0036));
    }
    if (T.zip) {
        add('zip', 'metal', [c.top, c.fit, 'z'], () => mesh((x, y, z) => {
            const ax = abs(x), e = lapelEdge(y);
            return max(shape(ax, y, z) - .0012 - .0009 * sin(y * 900), abs(ax - e - .002) - .0026, 1 * (y - 1.45), T.hem + .012 - y, .03 - z);
        }, [-.1, T.hem, 0], [.1, 1.46, .24], .0028));
    }
    if (T.lapel) {
        add('lapel', 'top', [c.top, c.fit, 'l'], () => mesh((x, y, z) => {
            const ax = abs(x), e = lapelEdge(y), top = step(1.09, 1.42, y);
            const notch = abs(y - 1.375 - (ax - .08) * .4) < .006 && ax > e + .042 ? 1 : 0;
            const d = max(outer(ax, y, z) - .0052, e - .002 - ax, ax - e - .006 - .056 * top, 1.09 - y, y - 1.47, .0 - z);
            return d + notch * .004;
        }, [-.2, 1.06, -.02], [.2, 1.49, .24], .0038));
    }
    if (T.rib) { // ribbed cuffs and hem
        add('cuffs', c.top === 'bomber' ? 'rib' : 'top', [c.top, c.fit, 'c'], () => mirrored(mesh((x, y, z) => {
            const t = P.armT(x, y, z), ang = Math.atan2(x - P.W[0], z - P.W[2]);
            return max(P.arm(x, y, z) - .0115 - .0008 * sin(ang * 34), abs(t - T.sleeve - .05) * .25 - .022);
        }, [P.W[0] - .09, .86, -.09], [P.W[0] + .08, 1.03, .12], .0034)));
        add('hem', c.top === 'bomber' ? 'rib' : 'top', [c.top, c.fit, 'h', c.bottom, c.legFit], () => mesh((x, y, z) => {
            let d = max(smin(P.torso(x, y, z, grow + .007), P.leg(abs(x), y, z) - under - .004, .05) - .0009 * sin(Math.atan2(x, z) * 110), abs(y - T.hem - .012) - .024);
            if (jacket) d = max(d, z > 0 ? T.open - abs(x) : -1);
            return d;
        }, [-.27, T.hem - .03, -.24], [.27, T.hem + .06, .24], .005));
    }
    if (T.pocket) {
        add('pocket', 'top', [c.top, c.fit, 'k'], () => mesh((x, y, z) => smax(max(shape(x, y, z) - .0055, .03 - z), max(abs(x) - .115 + step(.97, 1.05, y) * .05, abs(y - .985) - .07), .006), [-.14, .9, 0], [.14, 1.07, .26], .0046));
    }
    if (T.hood) {
        add('hood', 'top', [c.top, 'hood'], () => mesh((x, y, z) => {
            // the hood lies on the back; its edge goes around the neck to the front
            let d = ell(x, y, z, 0, 1.475, -.095, .118, .062, .068);
            d = smin(d, smax(hypot(P.neckline(x, y, z) - .020, (y - plane(z, T.neck)) * .6) - .015, hypot(x, (z + .03) * .92) - .100, .02), .025);
            d = smax(d, -ell(x, y, z, 0, 1.535, -.075, .082, .058, .05), .018);
            d = smax(d, .004 - P.neckline(x, y, z), .006);
            return d + .003 * folds(x * 14, y * 16, z * 14);
        }, [-.16, 1.36, -.2], [.16, 1.58, .13], .0055));
        add('cords', 'trim', ['cords'], () => {
            const line = [];
            for (let i = 0; i <= 10; i++) { const y = 1.435 - i * .018; line.push([.026 + i * .001, y, front(.026 + i * .001, y) + .002 + (i < 2 ? .006 : 0)]); }
            return mirrored(mesh((x, y, z) => {
                let d = 1;
                for (let i = 0; i < 10; i++) d = min(d, cap(x, y, z, line[i], line[i + 1], .0026, .0026));
                return min(d, cap(x, y, z, line[10], [line[10][0], line[10][1] - .018, line[10][2]], .0036, .0036));
            }, [.015, 1.22, .02], [.055, 1.45, .22], .0024));
        });
    }
    if (c.top === 'blazer' && c.tie) {
        add('tie', 'tie', ['tie'], () => {
            const at = (y) => { let z = .22; for (let i = 0; i < 30; i++) z -= cloth(0, y, z, .007, .001, .9, .058, 0) * .7; return z; };
            const zs = []; for (let i = 0; i <= 24; i++) zs.push(at(1.0 + i * .018));
            return mesh((x, y, z) => {
                const k = clamp((y - 1.0) / .018, 0, 23.99), i = floor(k), zz = mix(zs[i], zs[i + 1], k - i);
                const half = mix(.037, .015, step(1.04, 1.40, y)) * (y < 1.05 ? clamp((y - 1.005) / .045, 0, 1) : 1);
                return min(max(box(x, y, z, 0, 1.215, zz + .007, half, .195, .004, .002), 1.06 - y), ell(x, y, z, 0, 1.418, zs[23] + .006, .018, .016, .011));
            }, [-.05, .99, 0], [.05, 1.45, .22], .0034);
        });
    }

    // ----- trousers, shorts, skirt -----
    const B = c.bottom, gl = ({ jeans: .011, skinny: .004, chinos: .013, joggers: .019, cargo: .022, shorts: .020, skirt: .008 })[B] || .011;
    const cut = B === 'shorts' ? .53 : B === 'skirt' ? .56 : .055;
    const waist = 1.005;
    if (B === 'skirt') {
        add('bottom', 'bottom', [B], () => mesh((x, y, z) => {
            const t = clamp((waist - y) / (waist - cut), 0, 1), ang = Math.atan2(x, z);
            const a = mix(.140, .255, t ** .7) + P.w * .03 + P.f * .008, b = mix(.095, .215, t ** .7) + P.w * .03;
            const pleat = .0085 * t * sin(ang * 26) + .004 * t * sin(ang * 9 + 1);
            const k0 = hypot(x / a, (z + .008) / b), k1 = hypot(x / (a * a), (z + .008) / (b * b));
            let d = (k1 < 1e-5 ? -1 : k0 * (k0 - 1) / k1) + pleat;
            d = smin(d, P.torso(x, y, z, .009), .03);
            d = max(d * .8, y - waist, cut - y);
            return max(d, -max((k1 < 1e-5 ? -1 : k0 * (k0 - 1) / k1) + pleat + .014, y - .74));
        }, [-.32, cut - .02, -.28], [.32, waist + .02, .28], .0056));
    } else {
        const trousers = (x, y, z) => {
            const ax = abs(x);
            let g = gl + c.legFit * .010;
            if (B !== 'skinny' && y < .5) g += (B === 'joggers' ? .006 : .012) * step(.5, .1, y);
            if (B === 'shorts') g += .018 * step(.85, .53, y);
            let d = P.leg(ax, y, z) - g;
            const knee = exp(-(((y - .50) / .07) ** 2)), ankle = step(.24, .08, y) * (B === 'shorts' ? 0 : 1), crotch = exp(-(((y - .84) / .07) ** 2)) * step(.17, .03, ax);
            d += .0042 * knee * folds(x * 10, y * 30, z * 12) + (B === 'skinny' ? .004 : .0068) * ankle * folds(x * 9 + z * 5, y * 38, z * 9)
                + .0042 * crotch * folds(ax * 16 - y * 14, y * 14 + ax * 12, z * 8) + .0012 * noise(x * 15, y * 10, z * 15);
            d = smin(d, smax(P.torso(x, y, z, .007 + c.legFit * .003), .80 - y, .03), .05);
            d = smax(d, .0045 - ax - max(0, y - .815) * 2, .006); // gap between the legs
            return smax(smax(d, y - waist, .004), cut - y + (B === 'shorts' ? .004 * noise(x * 12, 0, z * 12) : 0), .004);
        };
        add('bottom', 'bottom', [B, c.legFit], () => mesh(trousers, [-.27, cut - .02, -.24], [.27, waist + .02, .22], .006));
        if (B === 'joggers') {
            add('anklecuff', 'bottom', ['ankle'], () => mirrored(mesh((x, y, z) => max(P.leg(x, y, z) - .012 - .0009 * sin(Math.atan2(x - P.A[0], z - P.A[2]) * 40), abs(y - .085) - .026), [.02, .05, -.14], [.2, .13, .1], .0036)));
        }
        if (B === 'cargo') {
            add('pockets', 'bottom', ['cargo', c.legFit], () => mirrored(mesh((x, y, z) => smin(
                smax(max(trousers(x, y, z) - .014, .13 - x), max(abs(y - .60) - .075, abs(z) - .06), .006),
                smax(max(trousers(x, y, z) - .019, .13 - x), max(abs(y - .655) - .024, abs(z) - .064), .004), .002), [.1, .5, -.1], [.26, .71, .1], .0046)));
        }
        if (B === 'jeans' || B === 'skinny' || B === 'chinos') { // seams and pocket edges
            add('seams', B === 'chinos' ? 'bottom' : 'stitch', [B, c.legFit, 's'], () => mirrored(mesh((x, y, z) => {
                const d = trousers(x, y, z);
                const pocket = hypot(x - .165, y - 1.0) - .085;
                const fly = max(abs(x - .022) - .0008, .90 - y);
                return max(d - .0009, min(z > 0 ? min(abs(pocket) - .0008, fly) : 1, z < -.05 ? abs(max(abs(x - .085) - .05, abs(y - .89) - .052)) - .0008 : 1), y - .985, .6 - y);
            }, [0, .78, -.22], [.25, .99, .2], .0026)));
        }
        const beltSeen = tucked || jacket;
    if (B !== 'skirt' && beltSeen) {
        add('belt', 'belt', [B, 'belt', c.legFit], () => mesh((x, y, z) => max(P.torso(x, y, z, .0115 + c.legFit * .003), abs(y - .985) - .017), [-.26, .95, -.22], [.26, 1.02, .22], .005));
        add('buckle', 'metal', ['buckle'], () => mesh((x, y, z) => {
            const zz = z - P.beltZ;
            return max(box(x, y, zz, 0, .985, .003, .023, .019, .004, .003), -box(x, y, zz, 0, .985, .003, .016, .012, .02, .002));
        }, [-.03, .96, .05], [.03, 1.01, .2], .0026));
        }
    }

    // ----- shoes -----
    const shoe = c.shoes;
    const heel = shoe === 'heels' ? .055 : 0;
    const X = P.A[0];
    const sole2 = (x, z, g) => { // outline of the foot from above
        let d = hypot(x - X - .002, z + .058) - .033;
        d = smin(d, hypot((x - X - .009) * .93, (z - .075) * .8) - .042, .10);
        d = smin(d, hypot((x - X - .006), (z - .128) * (shoe === 'oxford' || shoe === 'heels' ? .72 : .95)) - .031, .05);
        return d - g;
    };
    const solid = ({ sneakers: .030, hightops: .028, boots: .036, oxford: .018, runners: .038, heels: .008 })[shoe] || .03;
    const rise = (z) => heel * step(.07, -.04, z);
    const last = (x, y, z) => {
        const yy = y - rise(z);
        const toe = ell(x, yy, z, X + .007, .030, .100, .044, .044, .068);
        let d = cap(x, yy, z, [X, .060, -.055], [X + .004, .052, .06], .038, .037);
        d = smin(d, toe, .03);
        d = smin(d, cap(x, yy, z, [X, .115, -.032], [X + .002, .075, .03], .037, .04), .03);
        if (shoe === 'hightops') d = smin(d, cap(x, yy, z, [X, .06, -.04], [X, .16, -.03], .042, .048), .02);
        if (shoe === 'boots') d = smin(d, cap(x, yy, z, [X, .06, -.04], [X, .235, -.028], .046, .058), .02);
        const top = ({ hightops: .165, boots: .24 })[shoe] || .105 - (z - .0) * .25;
        d = smax(d, yy - top, .012);
        d = smax(d, -max(cap(x, yy, z, [X, .10, -.032], [X, .3, -.03], .034, .046), top - .035 - yy), .006);
        if (shoe !== 'heels') { // seams of the toe cap, the side panels and the heel
            const q = x - X - .004, groove = (v) => exp(-((v / .0016) ** 2));
            d += .0014 * (groove(z - .098 + q * q * 9) + (z < .09 ? groove(abs(q) - .021 - max(0, .06 - z) * .08) : 0) + groove(z + .048 - yy * .25));
            if (shoe === 'runners') d += .0012 * sin((z + yy * .6) * 260) * step(.02, .035, abs(q)) * step(.10, .08, z);
        }
        return smax(d, sole2(x, z, .0015), .012);
    };
    const shoeBox = [[.02, -.005, -.13], [.22, .28, .21]];
    add('shoe', 'shoe', [shoe], () => mirrored(mesh((x, y, z) => smax(last(x, y, z), solid * .6 - y + rise(z), .004), ...shoeBox, .0044)));
    add('sole', 'sole', [shoe, 's'], () => mirrored(mesh((x, y, z) => {
        const wave = shoe === 'runners' ? .006 * sin(z * 34) : 0;
        const tread = shoe === 'boots' || shoe === 'runners' ? .004 * (sin(z * 190) > .2 ? 1 : 0) : 0;
        const toeUp = .012 * step(.09, .18, z);
        let d = smax(sole2(x, z, .0045 + (shoe === 'runners' ? .003 : 0)), max(y - solid - rise(z) - wave - toeUp * .5 - (shoe === 'runners' ? .012 * step(.03, -.08, z) : 0), tread + toeUp + rise(z) * (z > -.055 || heel === 0 ? 1 : 0) - y), .005);
        if (heel) d = min(d, cap(x, y, z, [X, .06, -.072], [X, .006, -.078], .018, .007));
        if (shoe === 'oxford' || shoe === 'boots') d = smax(d, -box(x, y, z, X, 0, .0, .1, .012, .028, .004), .003);
        return d;
    }, ...shoeBox, .0044)));
    if (shoe !== 'heels') {
        add('laces', 'lace', [shoe, 'l'], () => {
            const rows = [];
            const count = shoe === 'boots' ? 8 : shoe === 'hightops' ? 7 : shoe === 'oxford' ? 4 : 6;
            for (let i = 0; i < count; i++) {
                let y0 = .25, z0 = .25;
                const t = i / (count - 1), yy = shoe === 'boots' ? mix(.07, .215, t) : shoe === 'hightops' ? mix(.066, .15, t) : mix(.068, .097, t);
                const zz = mix(.085, shoe === 'boots' || shoe === 'hightops' ? .014 : .020, t ** .7);
                y0 = yy; z0 = zz + .06;
                for (let s = 0; s < 40; s++) { const d = last(X + .004, y0, z0); if (d < .001) break; z0 -= d * .6; y0 -= shoe === 'boots' && i > 3 ? 0 : d * .45; }
                rows.push([y0, z0]);
            }
            return mirrored(mesh((x, y, z) => {
                let d = 1;
                rows.forEach(([ry, rz], i) => {
                    const s = i % 2 ? 1 : -1, q = abs(x - X - .004);
                    d = min(d, cap(x, y + q * .10, z + q * q * 5, [X + .004 - .019, ry - s * .003, rz + .001], [X + .004 + .019, ry + s * .003, rz + .0015], .0031, .0031));
                });
                return d;
            }, [X - .04, .05, -.02], [X + .05, .25, .14], .0022));
        });
        add('socks', 'sock', [shoe, B === 'shorts' || B === 'skirt'], () => mirrored(mesh((x, y, z) => max(P.leg(x, y, z) - .0035, y - (B === 'shorts' || B === 'skirt' ? .20 : .085), .05 - y), [.03, .04, -.12], [.18, .22, .07], .005)));
    }
}

// ---------- accessories ----------
function accessories(c, P, add) {
    const H = HEAD, face = Human.FACE.map((k) => c[k]);
    if (c.glasses !== 'none') {
        const style = c.glasses, z0 = max(.1005, P.nose[2] + .0015), cx = P.eyeX + .0035, cy = P.eyeY - .003;
        const [hw, hh, r, t] = ({ round: [.0225, .0215, .0215, .0011], square: [.0255, .0185, .006, .0019], aviator: [.0265, .0225, .015, .0010], sport: [.034, .0165, .011, .0016] })[style] || [.024, .02, .01, .0015];
        const lens = (ax, y) => {
            const drop = style === 'aviator' ? (ax - cx) * .18 : 0;
            const a = abs(ax - cx) - hw + r, b = abs(y - cy + drop) - hh + r;
            return hypot(max(a, 0), max(b, 0)) + min(max(a, b), 0) - r;
        };
        const bow = (ax) => z0 - ax * ax * 5.5;
        add('frame', 'frame', [style, face], () => {
            return mesh((x, y, z) => {
                const ax = abs(x), Y = y - H;
                let d = hypot(max(abs(lens(ax, Y)) - t, 0), max(abs(z - bow(ax)) - t * .9, 0)) - .0007;
                d = smin(d, cap(ax, Y, z - bow(ax), [0, cy + .009, .0005], [cx - hw + .003, cy + .004, 0], t * 1.1, t * 1.1), .002);
                if (style === 'aviator') d = min(d, cap(ax, Y, z - bow(ax), [0, cy + .0165, 0], [cx - hw + .012, cy + .0165, 0], .0011, .0011));
                const ex = P.temple[0] + .004;
                d = smin(d, cap(ax, Y, z, [cx + hw, cy + .008, bow(cx + hw)], [ex, cy + .011, .06], t * 1.1, t * 1.2), .003);
                d = smin(d, cap(ax, Y, z, [ex, cy + .011, .06], [P.earTop[0], .022, P.earTop[2] - .012], t * 1.2, t * 1.2), .003);
                return smin(d, cap(ax, Y, z, [P.earTop[0], .022, P.earTop[2] - .012], [P.earTop[0] - .004, -.006, P.earTop[2] - .034], t * 1.2, t * 1.4), .003);
            }, [-.1, H - .045, -.05], [.1, H + .05, .115], .0019);
        });
        add('lens', 'lens', [style, face, 'lens'], () => mesh((x, y, z) => max(lens(abs(x), y - H), abs(z - bow(abs(x)) + .0004) - .0016), [-.08, H - .04, .06], [.08, H + .04, .11], .0016));
    }
    const shell = (x, y, z, g) => ell(x, y - H, z, 0, .036, -.018, .0755 * mix(1, P.fw, .4) + g, .0885 + g, .095 + g);
    if (c.hat === 'cap') {
        add('hat', 'hat', ['cap', face], () => mesh((x, y, z) => {
            const Y = y - H;
            let d = max(shell(x, y, z, .017), .052 + (z < 0 ? z * .16 : 0) - Y);
            d -= .0008 * exp(-(((abs(((Math.atan2(x, z) / (PI / 3)) % 1 + 1) % 1 - .5) - .5) / .03) ** 2)); // panel seams
            return smin(d, ball(x, Y, z, 0, .142, -.018, .006), .003);
        }, [-.115, H + .02, -.14], [.115, H + .16, .115], .004));
        add('brim', 'hat', ['brim'], () => mesh((x, y, z) => {
            const Y = y - H - .063 + x * x * 3.6 + (z - .09) * .16;
            return smax(hypot(x * .92, (z - .075) * .9) - .082, abs(Y) - .0028, .003);
        }, [-.1, H, .0], [.1, H + .09, .18], .0028));
    }
    if (c.hat === 'beanie') {
        add('hat', 'hat', ['beanie', face], () => mesh((x, y, z) => {
            const Y = y - H, ang = Math.atan2(x, z + .018);
            let d = max(ell(x, Y, z, 0, .043, -.022, .0915, .112, .112) - .0016 * sin(ang * 46), .040 + z * .12 - Y);
            return smin(d, max(shell(x, y, z, .022) - .0014 * sin(ang * 60), abs(Y - .062 - z * .12) - .024) - .002, .004);
        }, [-.12, H, -.15], [.12, H + .18, .12], .0036));
    }
    if (c.hat === 'scarf') {
        add('hat', 'hat', ['scarf', face, c.build, c.weight, c.muscle], () => mesh((x, y, z) => {
            const Y = y - H;
            let d = min(P.skull(x, Y, z) - .014, cap(x, y, z, [0, 1.46, -.018], [0, 1.60, -.008], .082, .07));
            d = smin(d, shell(x, y, z, .013), .03);
            d = smin(d, ell(abs(x), Y, z, .076, -.004, -.018, .020, .046, .034), .02);
            d = smin(d, max(P.torso(x, y, z, .034), 1.395 + abs(x) * .16 - y), .04);
            d = smin(d, ell(x, Y, z, 0, -.145, .035, .085, .032, .065), .03);
            const hole = hypot(x / (.0655 * P.fw), (Y + .02) / .089) - 1;
            d = smax(d, -max(hole * .06, .012 - z), .007);
            return d + .0034 * step(.02, -.12, Y) * folds(x * 9 + y * 15, y * 22 - abs(x) * 8, z * 9) + .0016 * folds(x * 12 + y * 8, y * 14, z * 9);
        }, [-.2, 1.33, -.17], [.2, H + .16, .17], .005));
    }
    if (c.headphones) {
        add('phones', 'gadget', ['phones', c.hat !== 'none'], () => mesh((x, y, z) => {
            const ax = abs(x), Y = y - H, up = c.hat !== 'none' ? .012 : .008;
            let d = hypot(max(abs(hypot(ax, (Y - .01) * .82) - .098 - up) - .003, 0), max(abs(z + .012) - .011, 0)) - .0035;
            d = max(d, .03 - Y);
            d = min(d, cap(ax, Y, z, [.1, .03, -.012], [.101, -.005, -.012], .005, .005));
            return smin(d, hypot(max(hypot((Y + .004) * .85, z + .012) - .022, 0), max(abs(ax - .097) - .008, 0)) - .0085, .004);
        }, [-.13, H - .06, -.07], [.13, H + .16, .04], .0038));
    }
    if (c.earrings !== 'none') {
        add('earrings', 'gold', [c.earrings, face], () => mirrored(mesh((x, y, z) => {
            const ex = x - P.lobe[0] - .003, ey = y - H - P.lobe[1], ez = z - P.lobe[2];
            if (c.earrings === 'stud') return hypot(ex, ey, ez) - .0036;
            return hypot(hypot(ey + .013, ez) - .0125, ex) - .0015;
        }, [P.lobe[0] - .012, H + P.lobe[1] - .035, P.lobe[2] - .02], [P.lobe[0] + .014, H + P.lobe[1] + .012, P.lobe[2] + .02], .0014)));
    }
    if (c.chain) {
        add('chain', 'gold', ['chain', c.top, c.build, c.weight, c.muscle, c.fit], () => {
            const g = (TOPS[c.top] || TOPS.tee).grow + c.fit * .01 + .0035, pts = [];
            for (let i = 0; i < 120; i++) {
                const a = i / 120 * 2 * PI, x = sin(a), z = cos(a);
                const y = 1.475 - (z > 0 ? .115 * z ** 1.5 : -.012 * z);
                let r = .25; for (let s = 0; s < 30; s++) r -= P.torso(x * r, y, z * r, TOPS[c.top] && TOPS[c.top].open ? .0115 : g) * .6;
                pts.push([x * r, y, z * r]);
            }
            return mesh((x, y, z) => {
                let d = 1;
                for (let i = 0; i < pts.length; i++) { const p = pts[i], dx = x - p[0], dy = y - p[1], dz = z - p[2]; const q = dx * dx + dy * dy + dz * dz; if (q < d) d = q; }
                return sqrt(d) - .0034;
            }, [-.14, 1.33, -.13], [.14, 1.51, .18], .0028);
        });
    }
    if (c.watch && (TOPS[c.top] || TOPS.tee).sleeve < 1) {
        add('strap', 'strap', ['watch', c.build, c.weight, c.muscle], () => mesh((x, y, z) => max(P.arm(x, y, z) - .0045, abs(P.armT(x, y, z) - 1.9) * .25 - .009), [P.W[0] - .07, .88, -.04], [P.W[0] + .05, 1.0, .09], .0026));
        add('dial', 'metal', ['watch', c.build, c.weight], () => {
            const q = [mix(P.E[0], P.W[0], .9), mix(P.E[1], P.W[1], .9), mix(P.E[2], P.W[2], .9)], out = .031 - P.f * .004 + P.w * .003;
            return mesh((x, y, z) => hypot(max(hypot(y - q[1], z - q[2]) - .016, 0), max(abs(x - q[0] - out) - .003, 0)) - .002, [q[0], q[1] - .025, q[2] - .025], [q[0] + .05, q[1] + .025, q[2] + .025], .0018);
        });
    }
    if (c.backpack) {
        const g = (TOPS[c.top] || TOPS.tee).grow + c.fit * .01;
        add('pack', 'pack', ['pack', c.top, c.build, c.weight, c.muscle, c.fit], () => mesh((x, y, z) => {
            const zz = -.215 - P.w * .02, curve = x * x * .8;
            let d = box(x, y, z + curve * .5, 0, 1.22, zz, .142, .215, .075, .055);
            d = smin(d, box(x, y, z + curve, 0, 1.13, zz - .07, .112, .095, .03, .025), .01);
            d = smax(d, -(hypot(abs(y - 1.36 + x * x * 2) - .0, z + .3) - .004), .004);
            d = min(d, cap(x, y, z, [-.03, 1.45, -.17], [.03, 1.45, -.17], .007, .007));
            const ax = abs(x);
            return min(d, max(P.torso(x, y, z, g + .012), -P.torso(x, y, z, g - .01), abs(ax - .098 - step(1.2, 1.05, y) * .04) - .019, 1.08 - y));
        }, [-.21, .98, -.36], [.21, 1.52, .2], .0056));
    }
}

// ---------- hair: every strand is a line of points ----------
function random(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// len: length, lift: how far it stands off, grav: pull down, curl/freq: waves, n: strands, w: strand width
const HAIR = {
    buzz: { len: .007, lift: .9, grav: 0, n: 9000, w: .0011, steps: 2, shell: .0006 },
    crop: { len: .030, lift: .34, grav: .02, n: 8500, w: .0014, steps: 5, comb: 'forward', shell: .003, fade: .6 },
    sidepart: { len: .050, lift: .10, grav: .20, n: 9000, w: .0014, steps: 8, comb: 'side', shell: .006, fade: .62 },
    quiff: { len: .075, lift: .34, grav: .01, n: 9000, w: .0014, steps: 8, comb: 'up', shell: .006, fade: .75 },
    slick: { len: .105, lift: .16, grav: .05, n: 9000, w: .0013, steps: 9, comb: 'back', shell: .005, fade: .4 },
    messy: { len: .062, lift: .42, grav: .10, n: 8500, w: .0015, steps: 7, comb: 'mess', curl: .006, freq: 60, shell: .007, fade: .4 },
    curly: { len: .065, lift: .55, grav: .12, n: 7500, w: .0014, steps: 16, curl: .0095, freq: 190, shell: .009, fade: .3 },
    afro: { len: .075, lift: 1, grav: 0, n: 11000, w: .0014, steps: 14, curl: .006, freq: 260, shell: .03 },
    bob: { len: .19, lift: .08, grav: .24, n: 9500, w: .0015, steps: 13, comb: 'part', shell: .006 },
    long: { len: .40, lift: .06, grav: .24, n: 10000, w: .0016, steps: 20, comb: 'part', curl: .002, freq: 22, shell: .006 },
    waves: { len: .38, lift: .10, grav: .24, n: 9500, w: .0016, steps: 24, comb: 'part', curl: .012, freq: 46, shell: .006 },
    ponytail: { len: .115, lift: .08, grav: .0, n: 8000, w: .0014, steps: 10, comb: 'tie', shell: .004, tail: .34 },
    bun: { len: .115, lift: .08, grav: .0, n: 8000, w: .0014, steps: 10, comb: 'tie', shell: .004, bun: 1 },
};

function strands(c, P) {
    const out = { pos: [], tan: [], side: [], rnd: [], index: [] };
    function push(points, width, rnd) {
        const base = out.rnd.length;
        points.forEach((p, i) => {
            const a = points[max(0, i - 1)], b = points[min(points.length - 1, i + 1)];
            const l = hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
            const t = i / (points.length - 1), wd = width * (1 - .75 * t * t) * (.45 + .55 * min(1, t * 4));
            for (const s of [-1, 1]) {
                out.pos.push(p[0], p[1], p[2]);
                out.tan.push((b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l);
                out.side.push(s * wd, t);
                out.rnd.push(rnd);
            }
            if (i) { const q = base + i * 2; out.index.push(q - 2, q - 1, q, q, q - 1, q + 1); }
        });
    }
    const grad = (fn, x, y, z) => { const h = .002, a = fn(x + h, y, z) - fn(x - h, y, z), b = fn(x, y + h, z) - fn(x, y - h, z), g = fn(x, y, z + h) - fn(x, y, z - h), l = hypot(a, b, g) || 1; return [a / l, b / l, g / l]; };
    const pack = () => ({ pos: new Float32Array(out.pos), tan: new Float32Array(out.tan), side: new Float32Array(out.side), rnd: new Float32Array(out.rnd), index: new Uint32Array(out.index) });
    // The edge of the hair in the coordinates of the neutral head: forehead, temples, around the ears, nape.
    function hairline(x, y, z) {
        const a = Math.atan2(abs(x), z + .018); // 0 = front, pi = back
        let edge;
        if (a < .50) edge = .074 - c.hairline * .012 + .006 * a;
        else if (a < .95) edge = mix(.077 - c.hairline * .012, .052, step(.50, .95, a));
        else if (a < 1.12) edge = mix(.052, .000, step(.95, 1.12, a));
        else if (a < 1.40) edge = mix(.000, -.030, step(1.12, 1.18, a)) + .052 * step(1.30, 1.40, a);
        else if (a < 1.75) edge = .024;
        else edge = mix(.024, -.070, step(1.75, 2.3, a));
        return y - edge - .003 * noise(x * 160, y * 160, z * 160);
    }
    const onEar = (r) => abs(r[0]) > .0745 && r[1] < .03 && r[1] > -.06 && r[2] > -.045 && r[2] < .03;

    const obstacle = (x, y, z) => {
        let d = P.skull(x, y, z);
        const ax = abs(x);
        return y < -.12 ? min(d, P.torso(x, y + HEAD, z, .024), cap(ax, y, z, [.1, 1.45 - HEAD, -.015], [P.S[0], P.S[1] - HEAD, P.S[2]], .05, .07)) : d;
    };

    function scalp() {
        const style = HAIR[c.hair];
        if (!style || c.hat === 'scarf') return;
        const R = random(7);
        const covered = c.hat === 'cap' ? .050 : c.hat === 'beanie' ? .042 : 9;
        const knot = [0, style.bun ? .085 : .062, -.118];
        const lenK = 1 + c.hairLength * .45, vol = 1 + c.hairVolume * .5;
        const n = style.n;
        const clumps = [];
        for (let i = 0; i < 420; i++) clumps.push([R() * 2 - 1, R() * 2 - 1, R() * 2 - 1, R()]);
        let i = 0;
        Human.scatter(P.H)(n * 13, R, (r) => hairline(...r) > 0 && !onEar(r), (root, g, at) => {
            i++;
            const line = hairline(...at);
            if (covered < 9 && root[1] > covered + root[2] * .12) { if (style.len < .15) return; }
            const cl = clumps[(floor(noise(root[0] * 26, root[1] * 26, root[2] * 26) * 210 + 210) + (i % 3)) % 420];
            let len = style.len * lenK * (.82 + .3 * R());
            // shorter on the sides and at the nape
            const sideness = step(.075, .015, root[1]) * (root[2] < .062 ? 1 : .4);
            if (style.fade) len *= mix(1, .18 + .22 * (1 - style.fade), sideness * clamp(style.fade * 1.35, 0, 1));
            if (line < .006 && !style.tail && !style.bun) len *= .55 + line * 70;
            if (style.len < .15 && root[1] < .052 && root[2] < .04 && root[2] > -.055) len = min(len, .006);
            let dir;
            const partX = .022;
            switch (style.comb) {
                case 'forward': dir = [root[0] * 2, -.25, root[1] > .05 ? 1 : .35]; break;
                case 'side': dir = [root[0] > partX ? .9 : -1, root[1] > .07 ? -.1 : -.9, .2]; break;
                case 'up': dir = [root[0] * 3, root[2] > 0 ? .8 : -.5, root[2] > .03 ? -.25 : -1]; break;
                case 'back': dir = [root[0] * 1.5, root[2] > .03 ? .15 : -.4, -1]; break;
                case 'mess': dir = [cl[0], .15 + cl[1] * .5, .45 + cl[2]]; break;
                case 'part': dir = [root[0] > .004 ? .6 : -.6, -.45, root[2] > .03 ? .05 : -.35]; break;
                case 'tie': dir = [knot[0] - root[0], knot[1] - root[1], knot[2] - root[2]]; break;
                default: dir = [g[0] + cl[0] * .2, g[1] + cl[1] * .2, g[2] + cl[2] * .2];
            }
            let dl = hypot(...dir) || 1;
            dir = dir.map((q, k) => q / dl + g[k] * style.lift * vol * (style.comb ? mix(1, .22, clamp(sideness + (root[2] < -.02 ? .6 : 0), 0, 1)) : 1) * (1 + cl[k] * .25) + cl[k] * .12);
            dl = hypot(...dir); dir = dir.map((q) => q / dl);
            if (style.comb === 'tie') len = hypot(knot[0] - root[0], knot[1] - root[1], knot[2] - root[2]) * 1.22;
            const pts = [root.map((q, k) => q - g[k] * .001)];
            let p = root.slice();
            const st = len / style.steps, phase = cl[3] * 6.28 + R() * .9, off = .0016 + R() * (style.shell + .0045 * vol);
            for (let s = 1; s <= style.steps; s++) {
                const t = s / style.steps;
                if (style.comb === 'tie') { const d = [knot[0] - p[0], knot[1] - p[1], knot[2] - p[2]], q = hypot(...d) || 1; dir = dir.map((e, k) => e * .55 + d[k] / q * .45); }
                dir[1] -= style.grav * (style.steps > 10 ? 1 : 1.4) * (style.len > .15 ? 1.1 : 1);
                if (style.comb === 'up' && root[2] > -.02 && t > .25) { dir[2] -= .34; dir[1] -= .05; }
                if (style.len > .15) { dir[0] *= .97; if (root[2] > .0) dir[2] -= .012; }
                dl = hypot(...dir); dir = dir.map((q) => q / dl);
                p = [p[0] + dir[0] * st, p[1] + dir[1] * st, p[2] + dir[2] * st];
                const free = (style.len < .03 ? .0008 : off);
                const d = obstacle(...p);
                if (d < free) {
                    const q = grad(obstacle, ...p);
                    p = p.map((e, k) => e + q[k] * (free - d));
                    const dot = dir[0] * q[0] + dir[1] * q[1] + dir[2] * q[2];
                    if (dot < 0) dir = dir.map((e, k) => e - q[k] * dot);
                }
                // long hair stays out of the face
                if (style.len > .15 && p[2] > .03 && p[1] < .07 && abs(p[0]) < .064 * P.fw) p[0] += (p[0] >= 0 ? 1 : -1) * (.064 * P.fw - abs(p[0])) * .6;
                const amp = (style.curl || .0006) * min(1, t * 2.2) * vol, ph = phase + s * st * (style.freq || 30);
                let q = [p[0] + cos(ph) * amp, p[1] + sin(ph * 1.07 + 1) * amp * .7, p[2] + sin(ph) * amp];
                if (covered < 9 && q[1] > covered + q[2] * .12 - .004) { // under the hat: pressed to the head
                    const e = grad(P.skull, ...q), dd = P.skull(...q);
                    q = q.map((m, k) => m - e[k] * max(0, dd - .004));
                }
                pts.push(q);
            }
            push(pts.map((q) => [q[0], q[1] + HEAD, q[2]]), style.w * (.8 + .5 * R()), cl[3] * .6 + R() * .4);
        });
        if (style.tail || style.bun) {
            for (let i = 0; i < 2600; i++) {
                const a = R() * 6.283, r = sqrt(R()) * .017, pts = [];
                if (style.tail) {
                    let p = [cos(a) * r + knot[0], knot[1] + sin(a) * r, knot[2]], d = [cos(a) * .22, .35 + sin(a) * .2, -1];
                    const L = style.tail * lenK * (.75 + .3 * R());
                    for (let s = 0; s <= 16; s++) {
                        pts.push(p.slice());
                        d[1] -= .30; const l = hypot(...d); d = d.map((q) => q / l);
                        d[2] *= .86;
                        p = p.map((q, k) => q + d[k] * L / 16);
                        p[0] += cos(a * 3 + s * .5) * .0012;
                        const o = obstacle(...p); if (o < .008) { const q = grad(obstacle, ...p); p = p.map((e, k) => e + q[k] * (.008 - o)); }
                    }
                } else {
                    const tilt = R() * 2 - 1, turn = R() * 6.28, rad = .034 * vol * (.75 + .25 * R());
                    for (let s = 0; s <= 12; s++) {
                        const q = turn + s * .26, y = tilt * .85, m = sqrt(1 - y * y);
                        pts.push([knot[0] + cos(q) * m * rad, knot[1] + sin(q) * m * rad + y * .006, knot[2] - .018 + y * rad * .8]);
                    }
                }
                push(pts.map((q) => [q[0], q[1] + HEAD, q[2]]), .0015, R());
            }
        }
    }

    function brows() {
        const R = random(21), thick = 1 + c.browThick * .5;
        // the brow follows a line on the neutral head: t runs from the nose to the temple
        const line = (t) => .0172 + .0058 * sin(min(1, t * 1.12) * PI * .6) - .0095 * step(.62, 1, t) + c.browShape * .003 * sin(t * PI);
        const inside = (r) => {
            const t = (abs(r[0]) - .0105) / .042;
            if (t < 0 || t > 1 || r[2] < .03) return false;
            const band = .0044 * thick * (1 - .78 * step(.5, 1, t)) * (.6 + .4 * step(0, .16, t));
            return abs(r[1] - line(t)) < band * (.75 + .5 * R());
        };
        Human.scatter(P.H, (r) => r[2] > .03 && r[1] > .004 && r[1] < .036)(1500000, R, inside, (root, g, r) => {
            const t = (abs(r[0]) - .0105) / .042, s = r[0] < 0 ? -1 : 1;
            const up = mix(1.25, .05, step(0, .45, t)) - .3 * step(.5, 1, t) + (r[1] > line(t) ? -.45 : .35);
            let d = [s * (1 - .75 * step(.16, 0, t)), up, -.2];
            const dot = d[0] * g[0] + d[1] * g[1] + d[2] * g[2];
            d = d.map((q, k) => q - g[k] * dot + g[k] * .16 + (R() - .5) * .25);
            const l = hypot(...d), L = .0072 * (.65 + .5 * R());
            const pts = [0, 1, 2, 3].map((k) => { const m = k / 3 * L; return root.map((q, e) => q + d[e] / l * m - g[e] * m * m * 9 + (e === 1 ? HEAD : 0)); });
            push(pts, .00050, R());
        });
    }
    function lashes() {
        const R = random(5), long = .0048 + P.f * .0026 + c.lashes * .004, rim = P.H.rim, n = rim.length - 1;
        for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 90; i++) {
            const u = (i + R()) / 90 * n, k = floor(u), a = rim[k], b = rim[min(n, k + 1)], m = u - k;
            const p = a.map((q, e) => mix(q, b[e], m)), t = u / n * 2 - 1; // -1 = nose side
            const L = long * (.65 + .45 * R()) * (.55 + .45 * step(-1, .3, t)) * (1 - .3 * step(.8, 1, t));
            push([0, 1, 2, 3].map((q) => { const e = q / 3; return [s * (p[0] + (t * .45 + .05) * L * e), p[1] + L * (e * e * .62 - e * .05), p[2] + L * e * (1 - .25 * e)]; }), .00036, 0);
        }
    }
    function beard() {
        const style = c.beard;
        if (style === 'none') return;
        const R = random(33), L = ({ stubble: .0016, moustache: .010, chin: .013, goatee: .014, short: .008, full: .026, long: .070 })[style] || .01;
        const inside = (r) => {
            const [x, y, z] = r, ax = abs(x), n = .0025 * noise(x * 120, y * 120, z * 120);
            if (z < -.012 || y < -.125) return false;
            const lipHalf = .0135 * (1 - (ax / .0235) ** 2), lip = ax < .0235 && y > -.0675 - lipHalf && y < -.0675 + lipHalf;
            if (lip) return false;
            const must = ax < .030 - (y + .06) * .3 && ax > .002 && y > -.066 - ax * .25 && y < -.0525 + n * .4;
            const chin = ax < .021 + n && y < -.084 && y > -.118, soul = ax < .006 + n && y < -.080 && y > -.088;
            const link = ax > .0235 && ax < .0305 && y < -.060 && y > -.100;
            const jaw = (y < -.040 - z * .42 - max(0, .046 - ax) * .55 + n && ax > .026) || (y < -.092 && y > -.122);
            if (style === 'moustache') return must;
            if (style === 'chin') return chin || soul;
            if (style === 'goatee') return must || chin || link || soul;
            return must || chin || soul || link || jaw;
        };
        Human.scatter(P.H, (r) => r[1] < -.02 && r[2] > -.02)(style === 'stubble' ? 420000 : 300000, R, (r) => inside(r) && (style === 'stubble' || R() < .9), (root, g, r) => {
            const must = r[1] > -.066 && abs(r[0]) < .03;
            let d = must ? [(r[0] >= 0 ? 1 : -1) * .9, -.75, .25] : [r[0] * 5, -1, .22];
            const l = hypot(...d);
            d = d.map((q, k) => q / l + g[k] * .55 + (R() - .5) * .4);
            const len = L * (must ? (style === 'long' ? .22 : style === 'full' ? .36 : 1) : 1) * (.5 + .6 * R()) * (abs(r[0]) > .05 ? .6 : 1), n = len > .02 ? 6 : 3;
            let p = root.map((q, k) => q - g[k] * .0003);
            const pts = [p];
            for (let s = 1; s <= n; s++) { d[1] -= .14; const q = hypot(...d); p = p.map((e, k) => e + d[k] / q * len / n); if (n > 3) { const o = P.skull(...p); if (o < .001) p = p.map((e, k) => e + g[k] * (.0015 - o)); } pts.push(p); }
            push(pts.map((q) => [q[0], q[1] + HEAD, q[2]]), style === 'stubble' ? .0003 : .00055, R());
        });
    }
    return { hair: () => { scalp(); return pack(); }, brows: () => { brows(); return pack(); }, lashes: () => { lashes(); return pack(); }, beard: () => { beard(); return pack(); } };
}

// ---------- all parts of one character ----------
const cache = new Map(); // part name -> key of the version already sent
const BODY = ['build', 'weight', 'muscle'];

async function build(id, c) {
    await Human.load();
    if (id !== latest) return;
    const P = person(c);
    let bz = .2; for (let i = 0; i < 30; i++) bz -= P.torso(0, .985, bz, .0115) * .7;
    P.beltZ = bz;
    const jobs = [];
    const pick = (names) => names.map((n) => c[n]);
    const body = pick(BODY), face = pick(Human.FACE);
    const plan = (name, slot, key, make, kind) => jobs.push({ name, slot, key: JSON.stringify(key), make, kind: kind || 'mesh' });

    for (const name of ['head', 'chest', 'arms']) plan(name, 'skin', [face, body], () => Human.skin[name](P.H, P.G));
    if (c.bottom === 'shorts' || c.bottom === 'skirt') plan('legs', 'skin', [face, body], () => Human.skin.legs(P.H, P.G));
    const add = (name, slot, key, make) => plan(name, slot, [key, body], make);
    clothes(c, P, add);
    accessories(c, P, add);
    const S = strands(c, P);
    plan('hair', 'hair', [c.hair, c.hairLength, c.hairVolume, c.hairline, c.hat, face, body], () => strands(c, P).hair(), 'strands');
    plan('brows', 'brows', [face, body, c.browShape, c.browThick], S.brows, 'strands');
    plan('lashes', 'lashes', [face, body, c.lashes], () => strands(c, P).lashes(), 'strands');
    plan('beard', 'beard', [c.beard, face, body], () => strands(c, P).beard(), 'strands');

    const names = new Set(jobs.map((j) => j.name));
    for (const name of [...cache.keys()]) if (!names.has(name)) { cache.delete(name); postMessage({ name, gone: true }); }
    postMessage({ landmarks: { eyeX: P.eyeX, eyeY: P.eyeY, eyeZ: P.eyeZ, eyeR: P.eyeR } });
    run(id, jobs.filter((j) => cache.get(j.name) !== j.key));
}

// One part at a time: a newer request cancels the rest of the old one.
let latest = 0;
function run(id, jobs) {
    if (id !== latest) return;
    const job = jobs.shift();
    if (!job) { postMessage({ done: id }); return; }
    const data = job.make();
    cache.set(job.name, job.key);
    postMessage({ name: job.name, slot: job.slot, kind: job.kind, data }, Object.values(data).map((a) => a.buffer));
    setTimeout(() => run(id, jobs), 0);
}

onmessage = (e) => { latest = e.data.id; build(e.data.id, e.data.config); };
