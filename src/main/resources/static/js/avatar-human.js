// The human body of the character: the MakeHuman base mesh and its shape targets (CC0, see human-license.md),
// packed into human.bin. Here they are mixed, posed, smoothed and turned into distance grids for clothes and hair.
// Loaded by avatar-worker.js, which provides the maths helpers used below.
'use strict';

const Human = (() => {
    let H = null; // header
    let base = null, faces = null, weights = null, lips = null, buffer = null, start = 0;
    let level1 = null, headTop = null; // subdivision tables
    let rest0 = null, rimIndex = [];
    const K = .103, RZ = -.0555; // file units -> metres around the head centre

    async function load() {
        if (H) return;
        buffer = await (await fetch('/js/human.bin')).arrayBuffer();
        const size = new DataView(buffer).getUint32(0, true);
        H = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, size)));
        start = 4 + size;
        base = new Float32Array(buffer, start + H.verts[0], H.verts[1]);
        faces = new Uint16Array(buffer, start + H.faces[0], H.faces[1]);
        weights = new Uint8Array(buffer, start + H.weights[0], H.weights[1]);
        lips = new Uint8Array(buffer, start + H.lips[0], H.lips[1]);
        rest0 = new Float32Array(H.body * 3);
        for (let i = 0; i < H.body; i++) {
            rest0[i * 3] = base[i * 3] * K;
            rest0[i * 3 + 1] = (base[i * 3 + 1] - 7.285) * K + .002;
            rest0[i * 3 + 2] = base[i * 3 + 2] * K + RZ;
        }
        level1 = subdivision(faces, H.body);
        level1.rest = apply(level1, rest0, 3);
        level1.weights = apply(level1, Float32Array.from(weights, (q) => q / 255), 4);
        level1.lips = apply(level1, Float32Array.from(lips, (q) => q / 255), 1);
        // the head gets one more level
        const pick = [];
        for (let i = 0; i < level1.faces.length; i += 4) {
            let y = -9;
            for (let k = 0; k < 4; k++) y = max(y, level1.rest[level1.faces[i + k] * 3 + 1]);
            if (y > -.150) for (let k = 0; k < 4; k++) pick.push(level1.faces[i + k]);
        }
        headTop = subdivision(Uint32Array.from(pick), level1.count);
        headTop.rest = apply(headTop, level1.rest, 3);
        headTop.lips = apply(headTop, level1.lips, 1);
        // the edge of the upper lid, from the nose to the temple: lashes grow there
        const bins = Array.from({ length: 22 }, () => [1e9, -1]);
        for (let i = 0; i < headTop.count; i++) {
            const x = headTop.rest[i * 3] - .033, y = headTop.rest[i * 3 + 1] - .0012, z = headTop.rest[i * 3 + 2] - .0733, d = hypot(x, y, z);
            const a = Math.atan2(y, -x) / PI, k = floor(a * 22);
            if (a < 0 || k < 0 || k > 21 || z < .003 || d < .0148 || d > .017) continue;
            const r = hypot(x, y) + (d - .0148) * .3;
            if (r < bins[k][0]) bins[k] = [r, i];
        }
        rimIndex = bins.filter((b) => b[1] >= 0).map((b) => b[1]);
    }

    // ---------- Catmull-Clark: every new vertex is a weighted sum of old ones ----------
    function subdivision(f, n) {
        const nf = f.length / 4, edges = new Map(), ea = [], eb = [], ef = [];
        const key = (a, b) => (a < b ? a * 262144 + b : b * 262144 + a);
        const faceEdge = new Int32Array(f.length);
        for (let i = 0; i < nf; i++) for (let k = 0; k < 4; k++) {
            const a = f[i * 4 + k], b = f[i * 4 + (k + 1) % 4], q = key(a, b);
            let e = edges.get(q);
            if (e === undefined) { e = ea.length; edges.set(q, e); ea.push(a); eb.push(b); ef.push([]); }
            ef[e].push(i);
            faceEdge[i * 4 + k] = e;
        }
        const ne = ea.length, count = n + ne + nf;
        const vf = Array.from({ length: n }, () => []), ve = Array.from({ length: n }, () => []);
        for (let i = 0; i < f.length; i++) vf[f[i]].push(i >> 2);
        for (let e = 0; e < ne; e++) { ve[ea[e]].push(e); ve[eb[e]].push(e); }
        const at = new Uint32Array(count + 1), idx = [], w = [];
        const add = (map, v, q) => map.set(v, (map.get(v) || 0) + q);
        const flush = (i, map) => { for (const [v, q] of map) { idx.push(v); w.push(q); } at[i + 1] = idx.length; };
        for (let v = 0; v < n; v++) {
            const m = new Map(), border = ve[v].filter((e) => ef[e].length === 1), k = vf[v].length;
            if (!k) add(m, v, 1);
            else if (border.length) { add(m, v, .75); for (const e of border.slice(0, 2)) add(m, ea[e] === v ? eb[e] : ea[e], .125); if (border.length === 1) add(m, v, .125); }
            else {
                for (const i of vf[v]) for (let j = 0; j < 4; j++) add(m, f[i * 4 + j], 1 / (4 * k * k));
                for (const e of ve[v]) { add(m, ea[e], 1 / (k * k)); add(m, eb[e], 1 / (k * k)); }
                add(m, v, (k - 3) / k);
            }
            flush(v, m);
        }
        for (let e = 0; e < ne; e++) {
            const m = new Map(), s = ef[e].length > 1 ? .25 : .5;
            add(m, ea[e], s); add(m, eb[e], s);
            if (ef[e].length > 1) for (const i of ef[e].slice(0, 2)) for (let j = 0; j < 4; j++) add(m, f[i * 4 + j], .0625);
            flush(n + e, m);
        }
        for (let i = 0; i < nf; i++) { const m = new Map(); for (let j = 0; j < 4; j++) add(m, f[i * 4 + j], .25); flush(n + ne + i, m); }
        const out = new Uint32Array(nf * 16);
        for (let i = 0; i < nf; i++) for (let k = 0; k < 4; k++) {
            out.set([f[i * 4 + k], n + faceEdge[i * 4 + k], n + ne + i, n + faceEdge[i * 4 + (k + 3) % 4]], i * 16 + k * 4);
        }
        return { count, at, idx: Uint32Array.from(idx), w: Float32Array.from(w), faces: out };
    }
    function apply(s, src, dim) {
        const out = new Float32Array(s.count * dim);
        for (let i = 0; i < s.count; i++) for (let j = s.at[i]; j < s.at[i + 1]; j++) {
            const from = s.idx[j] * dim, q = s.w[j];
            for (let k = 0; k < dim; k++) out[i * dim + k] += src[from + k] * q;
        }
        return out;
    }
    function normals(pos, f) {
        const n = new Float32Array(pos.length);
        for (let i = 0; i < f.length; i += 4) {
            const a = f[i] * 3, b = f[i + 1] * 3, c = f[i + 2] * 3, d = f[i + 3] * 3;
            const x1 = pos[c] - pos[a], y1 = pos[c + 1] - pos[a + 1], z1 = pos[c + 2] - pos[a + 2], x2 = pos[d] - pos[b], y2 = pos[d + 1] - pos[b + 1], z2 = pos[d + 2] - pos[b + 2];
            const x = y1 * z2 - z1 * y2, y = z1 * x2 - x1 * z2, z = x1 * y2 - y1 * x2;
            for (const v of [a, b, c, d]) { n[v] += x; n[v + 1] += y; n[v + 2] += z; }
        }
        for (let i = 0; i < n.length; i += 3) { const l = hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
        return n;
    }

    // ---------- shape targets ----------
    function addTarget(v, name, q) {
        const t = H.targets[name];
        if (!t || abs(q) < .001) return;
        const [off, n, scale] = t;
        const idx = new Uint16Array(buffer, start + off, n), d = new Int16Array(buffer, start + off + n * 2, n * 3);
        for (let i = 0; i < n; i++) { const k = idx[i] * 3; v[k] += d[i * 3] * scale * q; v[k + 1] += d[i * 3 + 1] * scale * q; v[k + 2] += d[i * 3 + 2] * scale * q; }
    }
    const ORIGIN = { central: [.62, .38, 0], asian: [1, 0, 0], european: [0, 1, 0], african: [0, 0, 1], mixed: [.34, .33, .33] };
    // slider -> [target when negative, target when positive, strength]
    const PAIRS = {
        faceWidth: ['head-scale-horiz-decr', 'head-scale-horiz-incr', .55], faceLength: ['head-scale-vert-decr', 'head-scale-vert-incr', .5], faceFat: ['head-fat-decr', 'head-fat-incr', 1],
        jaw: ['chin-bones-decr', 'chin-bones-incr', 1], chinWidth: ['chin-width-decr', 'chin-width-incr', 1], chin: ['chin-height-decr', 'chin-height-incr', .7], chinForward: ['chin-prominent-decr', 'chin-prominent-incr', .9],
        cheeks: ['cheek-bones-decr', 'cheek-bones-incr', 1], cheekVolume: ['cheek-volume-decr', 'cheek-volume-incr', 1], doubleChin: ['neck-double-decr', 'neck-double-incr', 1],
        forehead: ['forehead-trans-backward', 'forehead-trans-forward', .8], temple: ['forehead-temple-decr', 'forehead-temple-incr', 1], brow: ['eyebrows-trans-backward', 'eyebrows-trans-forward', 1],
        ears: ['ear-scale-decr', 'ear-scale-incr', .9], earWing: ['ear-wing-decr', 'ear-wing-incr', 1],
        eyeSize: ['eye-scale-decr', 'eye-scale-incr', .6], eyeTilt: ['eye-corner2-down', 'eye-corner2-up', .9], eyeSpace: ['eye-trans-in', 'eye-trans-out', .6], eyeHeight: ['eye-trans-down', 'eye-trans-up', .6],
        eyeDepth: ['eye-push1-in', 'eye-push1-out', .9], epicanthus: ['eye-epicanthus-out', 'eye-epicanthus-in', 1], eyefold: ['eye-eyefold-down', 'eye-eyefold-up', 1], eyeBag: ['eye-bag-decr', 'eye-bag-incr', 1],
        browHeight: ['eyebrows-trans-down', 'eyebrows-trans-up', .8], browAngle: ['eyebrows-angle-down', 'eyebrows-angle-up', .8],
        noseWidth: ['nose-scale-horiz-decr', 'nose-scale-horiz-incr', .9], noseLength: ['nose-scale-vert-decr', 'nose-scale-vert-incr', .7], noseDepth: ['nose-scale-depth-decr', 'nose-scale-depth-incr', .8],
        noseBridge: ['nose-width1-decr', 'nose-width1-incr', 1], noseHump: ['nose-hump-decr', 'nose-hump-incr', .8], noseTip: ['nose-point-down', 'nose-point-up', 1], noseTipWidth: ['nose-point-width-decr', 'nose-point-width-incr', 1],
        nostrils: ['nose-nostrils-width-decr', 'nose-nostrils-width-incr', .8], mouthWidth: ['mouth-scale-horiz-decr', 'mouth-scale-horiz-incr', .7], mouthHeight: ['mouth-trans-down', 'mouth-trans-up', .5],
        upperLip: ['mouth-upperlip-volume-decr', 'mouth-upperlip-volume-incr', 1], lips: ['mouth-lowerlip-volume-decr', 'mouth-lowerlip-volume-incr', 1], cupid: ['mouth-cupidsbow-decr', 'mouth-cupidsbow-incr', 1],
    };
    const SHAPES = { oval: 'head-oval', round: 'head-round', square: 'head-square', rectangular: 'head-rectangular', triangular: 'head-triangular', diamond: 'head-diamond', heart: 'head-invertedtriangular' };

    function morph(c) {
        const v = base.slice(), o = ORIGIN[c.origin] || ORIGIN.central;
        for (const [sex, q] of [['male', 1 - c.build], ['female', c.build]]) {
            if (q < .01) continue;
            ['asian', 'caucasian', 'african'].forEach((r, i) => addTarget(v, r + '-' + sex + '-young', q * o[i]));
            const old = c.age * .6 * q;
            addTarget(v, 'caucasian-' + sex + '-old', old);
            addTarget(v, 'caucasian-' + sex + '-young', -old);
            const mu = clamp(c.muscle * .7, -1, 1), we = clamp(c.weight * .62, -1, 1);
            const mw = [['min', max(0, -mu)], ['average', 1 - abs(mu)], ['max', max(0, mu)]], ww = [['min', max(0, -we)], ['average', 1 - abs(we)], ['max', max(0, we)]];
            for (const [a, x] of mw) for (const [b, y] of ww) addTarget(v, 'universal-' + sex + '-young-' + a + 'muscle-' + b + 'weight', q * x * y);
        }
        for (const [k, [minus, plus, s]] of Object.entries(PAIRS)) { const q = c[k] || 0; addTarget(v, q < 0 ? minus : plus, abs(q) * s); }
        for (const part of ['1', '2', '3']) addTarget(v, 'eye-height' + part + (c.eyeNarrow > 0 ? '-decr' : '-incr'), abs(c.eyeNarrow) * .55);
        addTarget(v, SHAPES[c.faceShape], .6);
        addTarget(v, c.smile < 0 ? 'mouth-angles-down' : 'mouth-corner-puller', abs(c.smile) * .55);
        return v;
    }

    // ---------- pose ----------
    function mid(v, [from, n]) { const p = [0, 0, 0]; for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) p[k] += v[(from + i) * 3 + k] / n; return p; }
    function between(a, b) { // rotation that turns direction a into direction b
        const la = hypot(...a), lb = hypot(...b), p = a.map((q) => q / la), q = b.map((e) => e / lb);
        const x = p[1] * q[2] - p[2] * q[1], y = p[2] * q[0] - p[0] * q[2], z = p[0] * q[1] - p[1] * q[0], co = p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
        return { axis: [x, y, z], angle: Math.atan2(hypot(x, y, z), co) };
    }
    function spin(p, o, axis, angle) {
        const l = hypot(...axis) || 1, [x, y, z] = axis.map((q) => q / l), co = cos(angle), si = sin(angle);
        const a = p[0] - o[0], b = p[1] - o[1], c = p[2] - o[2], d = (x * a + y * b + z * c) * (1 - co);
        return [o[0] + a * co + (y * c - z * b) * si + x * d, o[1] + b * co + (z * a - x * c) * si + y * d, o[2] + c * co + (x * b - y * a) * si + z * d];
    }

    function person(c) {
        const v = morph(c), j = (n) => mid(v, H.joints[n]);
        // size: the eyes always end up at the same height, the head keeps its natural proportions
        const eyeJ = j('l-eye'), s = K, f = c.build;
        const toWorld = (p) => [p[0] * s, (p[1] - eyeJ[1]) * s + HEAD + .002, (p[2] - eyeJ[2]) * s + .0722];
        const J = {};
        for (const n of Object.keys(H.joints)) J[n] = toWorld(j(n));
        // below the neck the body is stretched so that waist, knees and ankles are where the clothes expect them
        const from = [J['l-ankle'][1], J['l-knee'][1], J['l-upper-leg'][1], J['l-shoulder'][1], J.neck[1]];
        const to = [.085, .50, .905, clamp(J['l-shoulder'][1], 1.40, 1.46), J.neck[1]];
        const warp = (y) => {
            if (y >= from[4]) return y;
            let i = 3;
            while (i > 0 && y < from[i]) i--;
            return to[i] + (y - from[i]) * (to[i + 1] - to[i]) / (from[i + 1] - from[i]);
        };
        for (const n of Object.keys(J)) J[n][1] = warp(J[n][1]);
        const legX = [.112 - J['l-ankle'][0], .100 - J['l-knee'][0], 0], legZ = [-.03 - J['l-ankle'][2], .008 - J['l-knee'][2], 0];
        const shift = (a, y) => (y < .085 ? a[0] : y < .5 ? mix(a[0], a[1], (y - .085) / .415) : y < .905 ? mix(a[1], a[2], (y - .5) / .405) : 0);
        const S = J['l-shoulder'], up = between([J['l-elbow'][0] - S[0], J['l-elbow'][1] - S[1], J['l-elbow'][2] - S[2]], [.205, -1, -.03 - c.weight * .0]);
        const E = spin(J['l-elbow'], S, up.axis, up.angle);
        const W0 = spin(J['l-hand'], S, up.axis, up.angle);
        const low = between([W0[0] - E[0], W0[1] - E[1], W0[2] - E[2]], [.09, -1, .20]);
        const W = spin(W0, E, low.axis, low.angle);

        const n = H.body, pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const side = v[i * 3] < 0 ? -1 : 1;
            let p = toWorld([v[i * 3] * side, v[i * 3 + 1], v[i * 3 + 2]]);
            p[1] = warp(p[1]);
            const wa = weights[i * 4] / 255, wf = weights[i * 4 + 1] / 255, wl = weights[i * 4 + 2] / 255;
            if (wl > 0 || p[1] < .9) { const q = max(wl, step(.9, .8, p[1])); p[0] += shift(legX, p[1]) * q; p[2] += shift(legZ, p[1]) * q; }
            if (wa > 0) p = spin(p, S, up.axis, up.angle * wa);
            if (wf > 0) p = spin(p, E, low.axis, low.angle * wf);
            if (wf > .5) { // the forearm turns so that the palm looks at the thigh
                const t = clamp(along(p[0], p[1], p[2], E, W), 0, 1);
                p = spin(p, E, [W[0] - E[0], W[1] - E[1], W[2] - E[2]], c.twist === undefined ? .75 * t : c.twist * t);
            }
            pos[i * 3] = p[0] * side; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
        }
        const eyes = ['eyeL', 'eyeR'].map((k) => {
            const [a, m] = H[k], o = [1e9, 1e9, 1e9], u = [-1e9, -1e9, -1e9];
            for (let i = 0; i < m; i++) { const p = toWorld([v[(a + i) * 3], v[(a + i) * 3 + 1], v[(a + i) * 3 + 2]]); for (let q = 0; q < 3; q++) { o[q] = min(o[q], p[q]); u[q] = max(u[q], p[q]); } }
            const r = (u[0] - o[0]) / 2;
            return { x: (o[0] + u[0]) / 2, y: (o[1] + u[1]) / 2, z: o[2] + r, r };
        });

        const p1 = apply(level1, pos, 3), n1 = normals(p1, level1.faces);
        const p2 = apply(headTop, p1, 3), n2 = normals(p2, headTop.faces);
        // a few landmarks of the finished face
        const find = (score) => { let best = -1e9, at = 0; for (let i = 0; i < p2.length / 3; i++) { const q = score(headTop.rest[i * 3], headTop.rest[i * 3 + 1], headTop.rest[i * 3 + 2]); if (q > best) { best = q; at = i; } } return [p2[at * 3], p2[at * 3 + 1] - HEAD, p2[at * 3 + 2]]; };
        const near = (a, b, g) => find((x, y, z) => -hypot(x - a, y - b, z - g));
        const rim = rimIndex.map((i) => [p2[i * 3], p2[i * 3 + 1], p2[i * 3 + 2]]);
        return { bodyKey: JSON.stringify([c.build, c.weight, c.muscle, c.age, c.origin, c.doubleChin]), rim, width: near(.07, .0, .03)[0] / .0715, nose: near(0, .004, .1), temple: near(.074, .006, .03), earTop: near(.079, .018, .004), lobe: near(.0765, -.044, .006), J, S, E, W, K: [.100, .5, J['l-knee'][2] + legZ[1]], A: [.112, .085, -.03], p1, n1, p2, n2, eye: eyes[0], rest1: level1.rest, rest2: headTop.rest, w1: level1.weights };
    }

    // ---------- distance grids ----------
    function grid(pos, nor, use, lo, hi, cell, fill) {
        const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1, ny = Math.ceil((hi[1] - lo[1]) / cell) + 1, nz = Math.ceil((hi[2] - lo[2]) / cell) + 1;
        const near = new Int32Array(nx * ny * nz).fill(-1), best = new Float32Array(nx * ny * nz).fill(1e9);
        for (let i = 0; i < pos.length / 3; i++) {
            if (!use(i)) continue;
            const a = Math.round((pos[i * 3] - lo[0]) / cell), b = Math.round((pos[i * 3 + 1] - lo[1]) / cell), g = Math.round((pos[i * 3 + 2] - lo[2]) / cell);
            if (a < 0 || b < 0 || g < 0 || a >= nx || b >= ny || g >= nz) continue;
            const at = a + nx * (b + ny * g);
            const d = (lo[0] + a * cell - pos[i * 3]) ** 2 + (lo[1] + b * cell - pos[i * 3 + 1]) ** 2 + (lo[2] + g * cell - pos[i * 3 + 2]) ** 2;
            if (d < best[at]) { best[at] = d; near[at] = i; }
        }
        // the nearest vertex spreads through the grid in sweeps
        const tryFrom = (at, x, y, z, i) => {
            if (i < 0) return;
            const d = (x - pos[i * 3]) ** 2 + (y - pos[i * 3 + 1]) ** 2 + (z - pos[i * 3 + 2]) ** 2;
            if (d < best[at]) { best[at] = d; near[at] = i; }
        };
        for (let pass = 0; pass < 4; pass++) {
            const fwd = pass % 2 === 0, D = fwd ? -1 : 1;
            for (let g0 = 0; g0 < nz; g0++) for (let b0 = 0; b0 < ny; b0++) for (let a0 = 0; a0 < nx; a0++) {
                const a = fwd ? a0 : nx - 1 - a0, b = fwd ? b0 : ny - 1 - b0, g = fwd ? g0 : nz - 1 - g0;
                const at = a + nx * (b + ny * g), x = lo[0] + a * cell, y = lo[1] + b * cell, z = lo[2] + g * cell;
                const ia = a + D >= 0 && a + D < nx, ib = b + D >= 0 && b + D < ny, ig = g + D >= 0 && g + D < nz;
                if (ia) tryFrom(at, x, y, z, near[at + D]);
                if (ib) tryFrom(at, x, y, z, near[at + D * nx]);
                if (ig) tryFrom(at, x, y, z, near[at + D * nx * ny]);
                if (ia && ib) tryFrom(at, x, y, z, near[at + D + D * nx]);
                if (ia && ig) tryFrom(at, x, y, z, near[at + D + D * nx * ny]);
                if (ib && ig) tryFrom(at, x, y, z, near[at + D * nx + D * nx * ny]);
                if (a - D >= 0 && a - D < nx && ib) tryFrom(at, x, y, z, near[at - D + D * nx]);
                if (b - D >= 0 && b - D < ny && ig) tryFrom(at, x, y, z, near[at - D * nx + D * nx * ny]);
                if (a - D >= 0 && a - D < nx && ig) tryFrom(at, x, y, z, near[at - D + D * nx * ny]);
            }
        }
        // the outside is filled starting from the far side, so nothing can appear in empty space
        const outside = new Uint8Array(near.length), band = (cell * 1.3) ** 2, queue = [];
        if (fill) {
            const visit = (at) => { if (!outside[at] && best[at] > band) { outside[at] = 1; queue.push(at); } };
            for (let g = 0; g < nz; g++) for (let b = 0; b < ny; b++) visit(nx - 1 + nx * (b + ny * g));
            while (queue.length) {
                const at = queue.pop(), a = at % nx, b = floor(at / nx) % ny, g = floor(at / nx / ny);
                if (a) visit(at - 1);
                if (a < nx - 1) visit(at + 1);
                if (b) visit(at - nx);
                if (b < ny - 1) visit(at + nx);
                if (g) visit(at - nx * ny);
                if (g < nz - 1) visit(at + nx * ny);
            }
        }
        const d = new Float32Array(near.length);
        for (let g = 0; g < nz; g++) for (let b = 0; b < ny; b++) for (let a = 0; a < nx; a++) {
            const at = a + nx * (b + ny * g), i = near[at];
            if (i < 0) { d[at] = 1; continue; }
            const x = lo[0] + a * cell - pos[i * 3], y = lo[1] + b * cell - pos[i * 3 + 1], z = lo[2] + g * cell - pos[i * 3 + 2];
            const dot = x * nor[i * 3] + y * nor[i * 3 + 1] + z * nor[i * 3 + 2], len = sqrt(best[at]), t = step(cell * 1.5, cell * 4, len);
            // the tangent plane of the nearest point is smoother than the distance to the point itself
            const far = mix(len, abs(dot), step(.5, .85, abs(dot) / (len + 1e-6)));
            d[at] = fill && best[at] > band ? (outside[at] ? far : -far) : mix(dot, dot < 0 ? -far : far, t);
        }
        for (const s of [1, nx, nx * ny]) { // a light blur removes the last facets
            const copy = d.slice();
            for (let at = s; at < d.length - s; at++) d[at] = copy[at] * .5 + (copy[at - s] + copy[at + s]) * .25;
        }
        return (x, y, z) => { // value between the grid points
            let a = (x - lo[0]) / cell, b = (y - lo[1]) / cell, g = (z - lo[2]) / cell, out = 0;
            const ca = clamp(a, 0, nx - 1.001), cb = clamp(b, 0, ny - 1.001), cg = clamp(g, 0, nz - 1.001);
            if (ca !== a || cb !== b || cg !== g) out = hypot(a - ca, b - cb, g - cg) * cell;
            a = floor(ca); b = floor(cb); g = floor(cg);
            const u = ca - a, v = cb - b, w = cg - g, at = a + nx * (b + ny * g), Y = nx, Z = nx * ny;
            return out + mix(mix(mix(d[at], d[at + 1], u), mix(d[at + Y], d[at + Y + 1], u), v), mix(mix(d[at + Z], d[at + Z + 1], u), mix(d[at + Z + Y], d[at + Z + Y + 1], u), v), w);
        };
    }

    // Where a region is cut from the body, the hole is closed with a flat lid of extra points.
    function region(P, use, cuts) {
        const { p1, n1 } = P, f = level1.faces, rims = cuts.map(() => new Set()), out = cuts.map(() => [0, 0, 0, 0]);
        for (let i = 0; i < f.length; i += 4) for (let k = 0; k < 4; k++) {
            const a = f[i + k], b = f[i + (k + 1) % 4];
            for (const [u, v] of [[a, b], [b, a]]) if (use(u) && !use(v)) {
                const q = cuts.findIndex((cut) => cut(v));
                if (q < 0) continue;
                rims[q].add(u);
                for (let e = 0; e < 3; e++) out[q][e] += p1[v * 3 + e] - p1[u * 3 + e];
            }
        }
        const pos = [], nor = [];
        for (let i = 0; i < p1.length / 3; i++) if (use(i)) {
            pos.push(p1[i * 3], p1[i * 3 + 1], p1[i * 3 + 2]);
            const q = rims.findIndex((rim) => rim.has(i)), l = q < 0 ? 1 : hypot(out[q][0], out[q][1], out[q][2]) || 1; // at the edge of a lid the normal looks between the two surfaces
            for (let e = 0; e < 3; e++) nor.push(n1[i * 3 + e] + (q < 0 ? 0 : out[q][e] / l));
        }
        rims.forEach((rim, q) => {
            const c = [0, 0, 0], l = hypot(out[q][0], out[q][1], out[q][2]) || 1;
            for (const v of rim) for (let e = 0; e < 3; e++) c[e] += p1[v * 3 + e] / rim.size;
            for (const v of rim) for (let t = .04; t < .98; t += .05) for (let e = 0; e < 3; e++) { pos.push(0); nor.push(out[q][e] / l); pos[pos.length - 1] = mix(c[e], p1[v * 3 + e], t); }
        });
        return [Float32Array.from(pos), Float32Array.from(nor), () => true];
    }
    let bodyKey = '', bodyGrids = null;
    function grids(P) {
        const { p1, rest1, w1 } = P, y = (i) => rest1[i * 3 + 1], x = (i) => p1[i * 3], w = (i, k) => w1[i * 4 + k];
        if (bodyKey !== P.bodyKey) {
            bodyKey = P.bodyKey;
            const tw = new Float32Array(p1.length / 3);
            for (let i = 0; i < tw.length; i++) tw[i] = w(i, 1) > .5 ? along(x(i), p1[i * 3 + 1], p1[i * 3 + 2], P.E, P.W) : 0;
            const inTrunk = (i) => x(i) > -.06 && !(y(i) > -.14 && hypot(x(i), rest1[i * 3 + 2] + .005) < .040) && w(i, 0) < .55 && w(i, 2) < .7 && y(i) < -.118;
            const inArm = (i) => x(i) > 0 && w(i, 0) > .12 && tw[i] < 1.06;
            const inLeg = (i) => x(i) > -.004 && w(i, 2) > .35 && y(i) < -.5 && p1[i * 3 + 1] > .09;
            bodyGrids = {
                trunk: grid(...region(P, inTrunk, [(v) => x(v) > 0 && w(v, 0) >= .55, (v) => x(v) > 0 && w(v, 2) >= .7, (v) => y(v) >= -.118]), [-.02, .74, -.24], [.34, 1.60, .28], .0075, true),
                arm: grid(...region(P, inArm, [(v) => x(v) > 0 && w(v, 0) <= .12, (v) => tw[v] >= 1.06]), [.07, .80, -.18], [.46, 1.54, .24], .0075, true),
                leg: grid(...region(P, inLeg, [(v) => w(v, 2) <= .35 && y(v) < -.5, (v) => p1[v * 3 + 1] <= .09]), [-.01, .08, -.22], [.30, .98, .22], .0075, true),
            };
        }
        const head = grid(P.p2, P.n2, (i) => P.p2[i * 3] > -.012 && P.rest2[i * 3 + 1] > -.15, [-.014, 1.46, -.17], [.13, 1.85, .16], .0036);
        return { ...bodyGrids, head };
    }

    // ---------- visible skin ----------
    function part(pos, nor, rest, lip, f, use, ao) {
        const map = new Int32Array(pos.length / 3).fill(-1), P = [], N = [], R = [], L = [], A = [], T = [];
        for (let i = 0; i < f.length; i += 4) {
            if (!use(f[i], f[i + 1], f[i + 2], f[i + 3])) continue;
            const q = [];
            for (let k = 0; k < 4; k++) {
                const v = f[i + k];
                if (map[v] < 0) {
                    map[v] = P.length / 3;
                    for (let e = 0; e < 3; e++) { P.push(pos[v * 3 + e]); N.push(nor[v * 3 + e]); R.push(rest[v * 3 + e]); }
                    L.push(lip ? lip[v] : 0);
                    A.push(ao(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]));
                }
                q.push(map[v]);
            }
            T.push(q[0], q[1], q[2], q[0], q[2], q[3]);
        }
        return { pos: new Float32Array(P), normal: new Float32Array(N), ao: new Float32Array(A), rest: new Float32Array(R), lip: new Float32Array(L), index: new Uint32Array(T) };
    }
    const occlude = (fn) => (x, y, z, a, b, g) => { let q = 0; for (const s of [.009, .022]) q += clamp((s - fn(x + a * s, y + b * s, z + g * s)) / s, 0, 1) / 2; return 1 - .8 * q; };
    const skin = {
        head: (P, G) => part(P.p2, P.n2, P.rest2, headTop.lips, headTop.faces, () => true, occlude((x, y, z) => G.head(abs(x), y, z))),
        chest: (P, G) => part(P.p1, P.n1, P.rest1, null, level1.faces, (a, b, c, d) => {
            const y = (i) => P.rest1[i * 3 + 1];
            return min(y(a), y(b), y(c), y(d)) < -.140 && max(y(a), y(b), y(c), y(d)) > -.335 && P.w1[a * 4] < .9;
        }, occlude((x, y, z) => G.trunk(abs(x), y, z))),
        arms: (P, G) => part(P.p1, P.n1, P.rest1, null, level1.faces, (a, b, c, d) => max(P.w1[a * 4], P.w1[b * 4], P.w1[c * 4], P.w1[d * 4]) > .25, () => 1),
        legs: (P, G) => part(P.p1, P.n1, P.rest1, null, level1.faces, (a) => P.p1[a * 3 + 1] < .80 && P.p1[a * 3 + 1] > .05 && P.w1[a * 4] < .01, () => 1),
    };
    // random points on the head, uniform by area
    function scatter(P, near) {
        const f = headTop.faces, n = f.length / 4, sum = new Float32Array(n);
        let total = 0;
        for (let i = 0; i < n; i++) {
            const a = f[i * 4] * 3, b = f[i * 4 + 1] * 3, c = f[i * 4 + 2] * 3, d = f[i * 4 + 3] * 3, p = P.p2;
            const x1 = p[c] - p[a], y1 = p[c + 1] - p[a + 1], z1 = p[c + 2] - p[a + 2], x2 = p[d] - p[b], y2 = p[d + 1] - p[b + 1], z2 = p[d + 2] - p[b + 2];
            if (!near || near([P.rest2[a], P.rest2[a + 1], P.rest2[a + 2]])) total += hypot(y1 * z2 - z1 * y2, z1 * x2 - x1 * z2, x1 * y2 - y1 * x2) / 2;
            sum[i] = total;
        }
        // density: points per square metre; accept(rest) -> keep or not
        return (density, random, accept, put) => {
            const count = Math.round(total * density);
            for (let k = 0; k < count; k++) {
                const t = random() * total;
                let lo = 0, hi = n - 1;
                while (lo < hi) { const m = (lo + hi) >> 1; if (sum[m] < t) lo = m + 1; else hi = m; }
                const u = random(), v = random(), w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
                const get = (src) => { const o = [0, 0, 0]; for (let q = 0; q < 4; q++) for (let e = 0; e < 3; e++) o[e] += src[f[lo * 4 + q] * 3 + e] * w[q]; return o; };
                const r = get(P.rest2);
                if (!accept(r)) continue;
                const p = get(P.p2), nn = get(P.n2), l = hypot(...nn) || 1;
                put([p[0], p[1] - HEAD, p[2]], nn.map((q) => q / l), r);
            }
        };
    }
    const FACE = [...Object.keys(PAIRS), 'origin', 'faceShape', 'eyeNarrow', 'smile', 'age'];
    return { load, person, grids, skin, scatter, FACE };
})();
