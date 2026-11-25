// Draws the character with WebGL 2. The shapes come from avatar-worker.js;
// here are only the camera, light, materials and small movements (breathing, blinking, looking around).
const Avatar = (() => {
    const HEAD = 1.68;

    // What every part is made of: 0 skin, 1 cloth, 2 denim, 3 leather, 4 metal, 5 rubber, 6 glass, 7 knit
    const CLOTH = { tee: 1, polo: 7, tank: 1, longsleeve: 1, shirt: 1, sweater: 7, hoodie: 1, bomber: 1, leather: 3, blazer: 1 };
    const LEGS = { jeans: 2, skinny: 2, chinos: 1, joggers: 1, cargo: 1, shorts: 1, skirt: 1 };
    const SHOE = { sneakers: 3, hightops: 1, boots: 3, oxford: 3, runners: 7, heels: 3 };

    function materialOf(slot, c) {
        switch (slot) {
            case 'skin': return [0, c.skin];
            case 'top': return [CLOTH[c.top], c.topColor];
            case 'inner': return [1, c.innerColor];
            case 'rib': return [7, c.top === 'bomber' ? c.trimColor : c.topColor];
            case 'trim': return [1, c.trimColor];
            case 'tie': return [1, c.tieColor];
            case 'bottom': return [LEGS[c.bottom], c.bottomColor];
            case 'stitch': return [1, '#b98a4a'];
            case 'belt': return [3, c.beltColor];
            case 'shoe': return [SHOE[c.shoes], c.shoeColor];
            case 'sole': return [5, c.soleColor];
            case 'lace': return [1, c.soleColor];
            case 'sock': return [7, c.sockColor];
            case 'hat': return [c.hat === 'beanie' ? 7 : 1, c.hatColor];
            case 'frame': return [c.glasses === 'aviator' ? 4 : 5, c.frameColor];
            case 'lens': return [6, c.lensColor];
            case 'gold': return [4, c.jewelColor];
            case 'metal': return [4, '#c9ced6'];
            case 'strap': return [3, '#1c1c20'];
            case 'gadget': return [5, c.gadgetColor];
            case 'pack': return [1, c.packColor];
            case 'hair': return [0, c.hairColor];
            case 'beard': return [0, c.beardColor];
            case 'brows': return [0, c.browColor];
            default: return [0, '#0c0908'];
        }
    }

    function rgb(hex) { // sRGB text -> linear light
        return [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);
    }

    // ---------- shaders ----------
    const MOVE = `
uniform float uTime; uniform vec2 uTurn; uniform float uScale;
vec3 move(vec3 p) {
    float breath = sin(uTime * 1.5);
    float chest = exp(-pow((p.y - 1.30) / .16, 2.)) * smoothstep(.30, .12, abs(p.x));
    p.z += chest * .0035 * breath * step(0., p.z);
    p.y += .0022 * breath * smoothstep(.95, 1.4, p.y);
    float w = smoothstep(1.50, 1.60, p.y);
    vec3 q = p - vec3(0., 1.56, -.015);
    float a = uTurn.x * w, b = uTurn.y * w;
    q.yz = mat2(cos(b), sin(b), -sin(b), cos(b)) * q.yz;
    q.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * q.xz;
    p = mix(p, q + vec3(0., 1.56, -.015), step(.0001, w));
    p.x += .004 * sin(uTime * .6) * smoothstep(.1, 1.2, p.y);
    return p * uScale;
}
vec3 turnOnly(vec3 n, float y) {
    float w = smoothstep(1.50, 1.60, y), a = uTurn.x * w, b = uTurn.y * w;
    n.yz = mat2(cos(b), sin(b), -sin(b), cos(b)) * n.yz;
    n.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * n.xz;
    return n;
}`;
    const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNormal; layout(location=2) in float aAo; layout(location=3) in vec3 aRest; layout(location=4) in float aLip;
uniform mat4 uView, uLight; uniform vec4 uLocal; uniform float uLocalTurn;
out vec3 vPos, vWorld, vNormal, vRest; out vec4 vShadow; out float vAo, vLip;
${MOVE}
void main() {
    vec3 p = aPos, n = aNormal;
    if (uLocal.w > 0.) { // eyes and eyelids turn around their own centre
        mat2 m = mat2(cos(uLocalTurn), sin(uLocalTurn), -sin(uLocalTurn), cos(uLocalTurn));
        p.yz = m * p.yz; n.yz = m * n.yz;
        p = p * uLocal.w + uLocal.xyz;
    }
    vPos = p; vAo = aAo; vRest = aRest; vLip = aLip;
    vec3 w = move(p);
    vWorld = w; vNormal = turnOnly(n, p.y);
    vShadow = uLight * vec4(w + vNormal * .009, 1.);
    gl_Position = uView * vec4(w, 1.);
}`;
    const HAIR_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aTan; layout(location=2) in vec2 aSide; layout(location=3) in float aRnd;
uniform mat4 uView, uLight; uniform vec3 uEye; uniform float uPixel;
out vec3 vPos, vWorld, vNormal, vTan; out vec4 vShadow; out float vRnd, vT, vSide;
${MOVE}
void main() {
    vec3 w = move(aPos), t = normalize(turnOnly(aTan, aPos.y));
    vec3 toEye = uEye - w;
    vec3 side = normalize(cross(t, toEye) + 1e-6);
    float wide = max(abs(aSide.x), length(toEye) * uPixel * .55); // never thinner than about a pixel
    w += side * sign(aSide.x) * wide * .5 * uScale;
    vPos = aPos; vWorld = w; vTan = t; vRnd = aRnd; vT = aSide.y; vSide = sign(aSide.x);
    vNormal = normalize(turnOnly(aPos - vec3(0., ${HEAD} + .02, -.015), aPos.y));
    vShadow = uLight * vec4(w + vNormal * .006, 1.);
    gl_Position = uView * vec4(w, 1.);
}`;
    const LIGHT = `
uniform sampler2D uShadow; uniform vec3 uEye;
const vec3 KEY = normalize(vec3(.55, .75, .85));
float shadow(vec4 s) {
    vec3 p = s.xyz / s.w * .5 + .5;
    if (p.x < 0. || p.x > 1. || p.y < 0. || p.y > 1.) return 1.;
    float sum = 0., texel = 1. / 2048.;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
        sum += step(p.z - .0022, texture(uShadow, p.xy + vec2(i, j) * texel * 1.4).r);
    return sum / 9.;
}
vec3 sky(vec3 r) { // a simple photo studio for reflections
    float soft = smoothstep(.55, .9, dot(r, normalize(vec3(.5, .6, .6))));
    float strip = smoothstep(.82, .96, dot(normalize(r.xz + 1e-5), normalize(vec2(-.9, .3)))) * smoothstep(.9, .1, abs(r.y));
    return mix(vec3(.05, .06, .09), vec3(.30, .36, .46), smoothstep(-.4, .9, r.y)) + vec3(1.5, 1.42, 1.3) * soft + vec3(.35, .6, 1.) * strip;
}
vec3 film(vec3 c) {
    c *= .46;
    c = clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0., 1.);
    return pow(c, vec3(1. / 2.2));
}`;
    const FS = `#version 300 es
precision highp float;
in vec3 vPos, vWorld, vNormal, vRest; in vec4 vShadow; in float vAo, vLip;
uniform int uMat; uniform vec3 uColor, uColor2, uLip, uShade; uniform int uPattern;
uniform vec4 uPaint, uPaint2; uniform float uFace, uSkinFix; uniform vec2 uTint;
out vec4 frag;
${LIGHT}
float hash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { return noise(p) * .5 + noise(p * 2.1) * .3 + noise(p * 4.3) * .2; }
float ggx(float nh, float a) { float d = nh * nh * (a * a - 1.) + 1.; return a * a / (3.1416 * d * d); }

// height of the fine relief: pores, threads, grain
float relief(vec3 p) {
    float fade = smoothstep(.0009, .0003, length(fwidth(p)));
    float around = atan(p.x, p.z) * .16;
    if (uMat == 0) return fade * (noise(p * 1500.) * .00010 + noise(p * 620.) * .00012);
    if (uMat == 1) return fade * (sin(p.y * 2600.) * sin(around * 2600.) * .00009 + noise(p * 700.) * .00008) + noise(p * 130.) * .0003;
    if (uMat == 2) return fade * (sin((p.y + around * 1.2) * 2100.) * .00012 + noise(p * 900.) * .0001) + noise(p * 90.) * .0003;
    if (uMat == 3) return fade * (abs(noise(p * 420.) - .5) * .0007) + noise(p * 70.) * .0006;
    if (uMat == 7) return fade * (abs(sin(around * 900.)) * .0004 + sin(p.y * 1400. + abs(sin(around * 900.)) * 2.5) * .00018);
    return noise(p * 300.) * .00003;
}
void main() {
    vec3 N = normalize(vNormal), V = normalize(uEye - vWorld), p = vPos;
    if (!gl_FrontFacing) N = -N;
    // tilt the normal along the relief
    vec3 dx = dFdx(vWorld), dy = dFdy(vWorld);
    float h = relief(p), hx = dFdx(h), hy = dFdy(h);
    vec3 r1 = cross(dy, N), r2 = cross(N, dx); float det = dot(dx, r1);
    vec3 g = sign(det) * (hx * r1 + hy * r2);
    vec3 bumped = normalize(abs(det) * N - g);
    N = normalize(mix(N, bumped, uMat == 6 ? 0. : .8));

    vec3 base = uColor; float rough = .75, spec = .04, metal = 0.; float alpha = 1.; float sss = 0.;
    if (uMat == 0) {
        rough = .46; spec = .032; sss = 1.;
        base = mix(vec3(dot(base, vec3(.3, .6, .1))), base, .84);
        base *= .93 + .14 * fbm(p * 55.);
        base *= mix(vec3(1.), vec3(1.05, .965, .95), fbm(p * 22. + 4.));
        if (uFace > .5) {
            vec3 q = vRest; float ax = abs(q.x);
            // colour zones of a face
            float nose = smoothstep(.020, .004, length(vec2(ax, q.y + .030))) * smoothstep(.08, .1, q.z);
            float cheek = smoothstep(.030, .006, length(vec2(ax - .043, q.y + .026)));
            float ear = smoothstep(.072, .080, ax) * step(abs(q.y + .012), .045);
            base *= mix(vec3(1.), vec3(1.07, .88, .86), clamp(nose * .6 + cheek * (.35 + uPaint.x * 1.5) + ear * .7, 0., 1.6));
            float under = smoothstep(.017, .006, length(vec2((ax - .033) * .75, q.y - .0012 + .012)));
            base *= mix(vec3(1.), vec3(.90, .84, .87), under * .5);
            // freckles
            float fr = smoothstep(.70, .80, noise(q * 330.)) * smoothstep(.055, .02, length(vec2(ax - .022, (q.y + .022) * 1.4))) * step(.03, q.z);
            base *= mix(vec3(1.), vec3(.66, .5, .42), fr * uPaint.y);
            // eye shadow and eyeliner
            vec2 e = vec2(ax - .033, q.y - .0012);
            float lidMask = smoothstep(.021, .010, length(vec2(e.x * .85, e.y - .006))) * smoothstep(-.003, .004, e.y) * step(.05, q.z);
            base = mix(base, uShade, lidMask * uPaint.z * .75);
            // lids are a little darker at the lashes
            float rim = smoothstep(.0105, .0065, length(vec2(e.x * .48, e.y * 1.25)));
            base *= mix(vec3(1.), vec3(.60, .46, .44), rim * step(.06, q.z) * .55);
            // lips are marked in the geometry
            float lip = smoothstep(.10, .38, vLip) * step(.07, q.z);
            vec3 lipColor = mix(base * vec3(.95, .66, .64), uLip, uPaint.w);
            base = mix(base, lipColor * (.92 + .16 * noise(vec3(q.x * 1400., q.y * 160., 1.))), lip * .85);
            rough = mix(rough, .34, lip); spec = mix(spec, .045, lip);
            float oil = max(nose, smoothstep(.03, .0, length(vec2(ax, q.y - .06))));
            rough -= .07 * oil;
            // stubble
            float jaw = smoothstep(-.036, -.056, q.y + q.z * .25 + max(0., .046 - ax) * .55) * smoothstep(-.135, -.115, q.y) * smoothstep(-.015, .01, q.z) * (1. - lip);
            jaw = max(jaw, smoothstep(.030, .024, ax) * smoothstep(-.050, -.055, q.y) * smoothstep(-.072, -.064, q.y) * step(.06, q.z) * (1. - lip));
            base = mix(base, uColor2 * .5 + base * .25, jaw * uPaint2.x * (.35 + .5 * noise(q * 1300.)));
            // scar
            float scar = smoothstep(.0016, .0004, abs(q.x - .040 - (q.y + .02) * .25)) * smoothstep(.026, .02, abs(q.y + .022)) * step(.02, q.z);
            base = mix(base, base * vec3(1.15, .80, .78), scar * uPaint2.y);
            // the scalp is tinted under the hair
            float ang = atan(ax, q.z + .018), edge;
            if (ang < .50) edge = .074 + .006 * ang;
            else if (ang < .95) edge = mix(.077, .052, smoothstep(.50, .95, ang));
            else if (ang < 1.12) edge = mix(.052, 0., smoothstep(.95, 1.12, ang));
            else if (ang < 1.40) edge = mix(0., -.030, smoothstep(1.12, 1.18, ang)) + .052 * smoothstep(1.30, 1.40, ang);
            else if (ang < 1.75) edge = .024;
            else edge = mix(.024, -.070, smoothstep(1.75, 2.3, ang));
            float top = smoothstep(edge + .001, edge + .012, q.y + uTint.y * .012 + .008 * (noise(q * 260.) - .5)) * uPaint2.w;
            if (ax > .0745 && q.y < .03 && q.y > -.06 && q.z < .03) top = 0.; // ears stay skin
            base = mix(base, uColor2 * .35, top);
        }
        // tattoos on the arms
        if (uPaint2.z > .5 && abs(p.x) > .17 && p.y > .94) {
            float ink = 0., ang = atan(p.x, p.z);
            if (uPaint2.z < 1.5) ink = step(abs(p.y - 1.20), .006) + step(abs(p.y - 1.225), .011) * step(.5, fract((p.y * 60. + p.z * 60.)));
            else {
                float k = fbm(p * 34.);
                ink = smoothstep(.03, .0, abs(k - .5) - .012) + step(.9, sin(p.y * 160. + k * 14.)) * .6;
                if (uPaint2.z > 2.5) ink = step(.52, fract((p.y + p.z) * 26.)) * step(.52, fract((p.y - p.z) * 26.));
            }
            base = mix(base, vec3(.02, .03, .045), clamp(ink, 0., 1.) * .72);
        }
        if (p.y < 1.0 && abs(p.x) > .2) { // warm knuckles and fingertips
            base *= mix(vec3(1.), vec3(1.08, .86, .82), smoothstep(.62, .40, fbm(p * 40.)) * .6);
        }
    } else if (uMat == 1 || uMat == 7) {
        rough = uMat == 7 ? .95 : .82; spec = .03;
        if (uPattern == 1) { float v = abs(fract(p.y * 17.) - .5), w = fwidth(p.y * 17.); base = mix(base, uColor2, smoothstep(.25 - w, .25 + w, v)); }
        if (uPattern == 2) { float a = step(.5, fract(p.y * 13.)), b = step(.5, fract((p.x + p.z * .35) * 13.)); base = mix(base, uColor2, a * .5 + b * .5); base *= 1. - .25 * step(.93, fract(p.y * 13. + .25)); }
        if (uPattern == 3) { float k = fbm(p * 19.), m = fbm(p * 23. + 9.); base = k > .56 ? uColor2 : m > .58 ? base * .42 : m < .40 ? base * 1.5 : base; }
        if (uPattern == 4) base = p.y > 1.25 ? base : uColor2;
        if (uPattern == 5) base = mix(base, uColor2, smoothstep(1.42, .95, p.y));
        base *= .90 + .18 * noise(p * 900.);
    } else if (uMat == 2) {
        rough = .9;
        float worn = smoothstep(.25, .0, abs(p.y - .62)) * smoothstep(.0, .08, p.z) * .5 + smoothstep(.12, .0, abs(p.y - .88)) * .12;
        base = mix(base, base * 1.5 + vec3(.05, .06, .07), worn * (.55 + .6 * noise(p * 60.)));
        base *= .82 + .36 * noise(vec3(p.x * 500., p.y * 120., p.z * 500.));
        base *= mix(.8, 1.1, vAo);
    } else if (uMat == 3) { rough = .38; spec = .05; base *= .85 + .3 * fbm(p * 60.); }
    else if (uMat == 4) { metal = 1.; rough = .22; }
    else if (uMat == 5) { rough = .55; }
    else if (uMat == 6) { rough = .05; spec = .06; alpha = uSkinFix; base *= .3; }

    float nl = dot(N, KEY), nv = max(dot(N, V), .001);
    float sh = shadow(vShadow);
    vec3 H = normalize(KEY + V); float nh = max(dot(N, H), 0.), vh = max(dot(V, H), 0.);
    float ao = vAo;
    // light that passes through the skin: wide and red at the edge of the shadow
    vec3 diffuse = vec3(max(nl, 0.)) * sh;
    if (sss > .5) diffuse = mix(diffuse, clamp((vec3(nl) + vec3(.45, .18, .12)) / (vec3(1.45, 1.18, 1.12)), 0., 1.) * mix(vec3(.28, .06, .03), vec3(1.), sh), .75);
    vec3 F0 = mix(vec3(spec), base, metal);
    vec3 F = F0 + (1. - F0) * pow(1. - vh, 5.);
    float a = rough * rough, k = (rough + 1.) * (rough + 1.) / 8.;
    float vis = 1. / (4. * (max(nl, 0.) * (1. - k) + k) * (nv * (1. - k) + k));
    vec3 col = base * (1. - metal) * diffuse * vec3(2.35, 2.2, 2.0);
    col += F * ggx(nh, a) * vis * max(nl, 0.) * sh * vec3(2.6, 2.45, 2.25);
    if (sss > .5) col += F * ggx(nh, .055) * vis * max(nl, 0.) * sh * .5; // thin oily layer
    vec3 amb = mix(vec3(.20, .17, .17), vec3(.54, .58, .64), N.y * .5 + .5);
    vec3 aoc = sss > .5 ? pow(vec3(ao), vec3(.75, 1.05, 1.1)) : vec3(ao);
    col += base * (1. - metal) * amb * aoc;
    float fill = max(dot(N, normalize(vec3(-.8, .15, .6))), 0.);
    col += base * (1. - metal) * fill * vec3(.24, .28, .34) * ao;
    vec3 R = reflect(-V, N); float fres = pow(1. - nv, 5.);
    col += sky(R) * (F0 + (max(vec3(1. - rough), F0) - F0) * fres) * ao * mix(1., .35, rough) * (uMat == 6 ? .3 : uMat == 1 || uMat == 2 || uMat == 7 ? .12 : 1.);
    float rimLight = pow(1. - nv, 3.) * smoothstep(-.2, .6, dot(N, normalize(vec3(-.7, .3, -.8))));
    col += rimLight * vec3(.35, .75, 1.3) * ao * (uMat == 1 || uMat == 7 ? .55 : .8);
    if (uMat == 1 || uMat == 7) col += base * pow(1. - nv, 3.) * .35 * ao; // fuzz
    if (uMat == 0) col *= .84;
    if (uMat == 6) alpha = clamp(alpha + fres * .5 + dot(max(col - .5, 0.), vec3(.2)), 0., 1.);
    frag = vec4(film(col) * alpha, alpha);
}`;
    const HAIR_FS = `#version 300 es
precision highp float;
in vec3 vPos, vWorld, vNormal, vTan; in vec4 vShadow; in float vRnd, vT, vSide;
uniform vec3 uColor; uniform float uGloss;
out vec4 frag;
${LIGHT}
void main() {
    vec3 T = normalize(vTan), V = normalize(uEye - vWorld), N = normalize(vNormal);
    float sh = mix(.18, 1., shadow(vShadow));
    float tl = dot(T, KEY), tv = dot(T, V);
    float sl = sqrt(max(0., 1. - tl * tl)), sv = sqrt(max(0., 1. - tv * tv));
    float wrap = clamp(dot(N, KEY) * .5 + .5, 0., 1.);
    vec3 base = uColor * (.75 + 1.0 * vRnd) * mix(.55, 1.15, smoothstep(0., .5, vT));
    vec3 col = base * (sl * wrap * 1.75 * sh + .06);
    col += base * mix(vec3(.16, .15, .16), vec3(.42, .50, .62), N.y * .5 + .5) * mix(.45, 1., vT);
    // two highlights that run across the strands (Kajiya-Kay)
    float c1 = sl * sv - (tl + .06) * (tv + .06), c2 = sl * sv - (tl - .09) * (tv - .09);
    col += vec3(1., .96, .9) * pow(max(c1, 0.), 110.) * .34 * sh * wrap * uGloss * (.5 + vRnd);
    col += (base * 1.6 + .03) * pow(max(c2, 0.), 28.) * .75 * sh * wrap * uGloss;
    float rim = pow(1. - abs(dot(N, V)), 3.) * smoothstep(-.2, .6, dot(N, normalize(vec3(-.7, .3, -.8))));
    col += rim * vec3(.35, .75, 1.3) * .5 * (.3 + base * 2.);
    col *= 1. - .3 * vSide * vSide * abs(vSide);
    frag = vec4(film(col), 1.);
}`;
    const EYE_FS = `#version 300 es
precision highp float;
in vec3 vPos, vWorld, vNormal; in vec4 vShadow; in float vAo;
uniform vec3 uColor; uniform vec4 uLocal; uniform vec3 uGaze; uniform float uFaceSide;
out vec4 frag;
${LIGHT}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 x) { vec2 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
    vec3 d = normalize(vPos - uLocal.xyz), N = normalize(vNormal), V = normalize(uEye - vWorld);
    vec3 right = normalize(cross(vec3(0, 1, 0), uGaze)), up = cross(uGaze, right);
    vec2 q = vec2(dot(d, right), dot(d, up)); float r = length(q), a = atan(q.y, q.x), front = dot(d, uGaze);
    vec3 white = mix(vec3(.80, .77, .75), vec3(.62, .36, .33), smoothstep(.45, .95, r) * .6);
    float veins = smoothstep(.47, .5, noise(vec2(a * 9., r * 5.)) ) * smoothstep(.53, .5, noise(vec2(a * 9., r * 5.)));
    white = mix(white, vec3(.6, .2, .18), veins * smoothstep(.5, .9, r) * .35);
    float fibre = noise(vec2(a * 26., r * 7.)) * .6 + noise(vec2(a * 60., r * 12.)) * .4;
    vec3 iris = uColor * (.55 + 1.1 * fibre) * mix(1.45, .7, smoothstep(.16, .50, r));
    iris = mix(iris, uColor * vec3(1.6, 1.25, .8), smoothstep(.25, .16, r) * .5);
    iris *= mix(1., .18, smoothstep(.49, .56, r));
    iris *= smoothstep(.165, .195, r);
    // light gathers on the side opposite to the lamp, as in a real cornea
    iris *= 1. + .9 * smoothstep(.0, .4, dot(q, vec2(-.6, -.8)));
    vec3 base = front > 0. ? mix(iris, white, smoothstep(.54, .58, r)) : white;
    float lid = smoothstep(-.1, .62, d.y); // shade of the upper lid
    float side = smoothstep(.45, .95, abs(d.x));
    float sh = mix(.55, 1., shadow(vShadow));
    vec3 col = base * (max(dot(N, KEY), 0.) * 1.5 * sh + vec3(.48, .52, .60)) * mix(1., .32, lid) * mix(1., .6, side);
    vec3 R = reflect(-V, N), H = normalize(KEY + V);
    float fres = .03 + .5 * pow(1. - max(dot(N, V), 0.), 5.);
    col += sky(R) * fres * 1.2 + vec3(1.) * pow(max(dot(N, H), 0.), 900.) * 5. + vec3(.8, .9, 1.) * pow(max(dot(N, normalize(normalize(vec3(-.5, .5, .9)) + V)), 0.), 1200.) * 1.6;
    frag = vec4(film(col), 1.);
}`;
    const FLOOR_FS = `#version 300 es
precision highp float;
in vec3 vPos, vWorld, vNormal; in vec4 vShadow; in float vAo;
uniform vec3 uColor;
out vec4 frag;
${LIGHT}
void main() {
    float r = length(vWorld.xz);
    float contact = exp(-dot((vec2(abs(vWorld.x) - .11, vWorld.z - .03)) / vec2(.085, .15), (vec2(abs(vWorld.x) - .11, vWorld.z - .03)) / vec2(.085, .15)));
    float dark = max((1. - shadow(vShadow)) * .55, contact * .7) * smoothstep(.95, .5, r);
    float px = fwidth(r);
    float ring = smoothstep(px * 1.6, 0., abs(r - .56) - .002) * .9 + smoothstep(px * 1.6, 0., abs(r - .62) - .001) * .5;
    float a = atan(vWorld.z, vWorld.x);
    ring += smoothstep(px * 1.6, 0., abs(r - .59) - .012) * step(.82, fract(a * 11.459)) * .55;
    float glow = smoothstep(.62, .1, r) * .10;
    float alpha = clamp(dark + ring + glow, 0., 1.);
    frag = vec4(uColor * (ring + glow), alpha);
}`;
    const DEPTH_FS = `#version 300 es
precision highp float; void main() {}`;

    // ---------- matrices (column-major) ----------
    function mul(a, b) {
        const o = new Float32Array(16);
        for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
        return o;
    }
    function lookAt(eye, at) {
        const n = (v) => { const l = Math.hypot(...v); return v.map((q) => q / l); };
        const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const z = n(eye.map((q, i) => q - at[i])), x = n(cross([0, 1, 0], z)), y = cross(z, x);
        return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
    }
    function perspective(fov, aspect, near, far) {
        const f = 1 / Math.tan(fov / 2);
        return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
    }
    function ortho(s, near, far) {
        return new Float32Array([1 / s, 0, 0, 0, 0, 1 / s, 0, 0, 0, 0, -2 / (far - near), 0, 0, 0, -(far + near) / (far - near), 1]);
    }

    // where the camera looks: height, distance, angle
    const VIEWS = {
        full: { y: .93, dist: 4.35, yaw: .42 }, face: { y: 1.672, dist: .86, yaw: .28 }, hair: { y: 1.69, dist: 1.02, yaw: .62 },
        top: { y: 1.28, dist: 2.0, yaw: .42 }, bottom: { y: .62, dist: 2.5, yaw: .42 }, shoes: { y: .14, dist: 1.15, yaw: .75, pitch: .22 },
    };
    const FOV = .46;

    // ---------- viewer ----------
    function mount(box, onReady) {
        const canvas = document.createElement('canvas');
        canvas.className = 'avatar';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Your character. Drag to turn it.');
        const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false });
        if (!gl) { box.append(el('p', { class: 'muted' }, 'The character needs WebGL 2, which this browser does not offer.')); return null; }
        box.append(canvas);

        function program(vs, fs) {
            const p = gl.createProgram();
            for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
                const s = gl.createShader(type);
                gl.shaderSource(s, src);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
                gl.attachShader(p, s);
            }
            gl.linkProgram(p);
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
            const u = {};
            for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
            return { p, u };
        }
        const solid = program(VS, FS), hairy = program(HAIR_VS, HAIR_FS), eye = program(VS, EYE_FS), floor = program(VS, FLOOR_FS);
        const depth = program(VS, DEPTH_FS), depthHair = program(HAIR_VS, DEPTH_FS);

        const SIZE = 2048;
        const shadowMap = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, shadowMap);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SIZE, SIZE, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        const shadowBuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowMap, 0);
        gl.drawBuffers([gl.NONE]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const parts = new Map();
        function upload(arrays, index) {
            const vao = gl.createVertexArray(), buffers = [];
            gl.bindVertexArray(vao);
            arrays.forEach(([data, size], i) => {
                const b = gl.createBuffer(); buffers.push(b);
                gl.bindBuffer(gl.ARRAY_BUFFER, b);
                gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
                gl.enableVertexAttribArray(i);
                gl.vertexAttribPointer(i, size, gl.FLOAT, false, 0, 0);
            });
            const e = gl.createBuffer(); buffers.push(e);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
            gl.bindVertexArray(null);
            return { vao, buffers, count: index.length };
        }
        function remove(part) { part.buffers.forEach((b) => gl.deleteBuffer(b)); gl.deleteVertexArray(part.vao); }

        function sphere(r, from, rows, cols) { // pole up; from = 1 whole ball, .5 upper half
            const pos = [], nor = [], ao = [], idx = [];
            for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
                const a = i / rows * Math.PI * from, b = j / cols * 2 * Math.PI, n = [Math.sin(a) * Math.sin(b), Math.cos(a), Math.sin(a) * Math.cos(b)];
                pos.push(...n.map((q) => q * r)); nor.push(...n); ao.push(1);
                if (i && j) { const k = i * (cols + 1) + j; idx.push(k - cols - 2, k - 1, k, k - cols - 2, k, k - cols - 1); }
            }
            return upload([[new Float32Array(pos), 3], [new Float32Array(nor), 3], [new Float32Array(ao), 1]], new Uint32Array(idx));
        }
        const eyeball = sphere(1, 1, 28, 36), lid = sphere(1.04, .5, 14, 32);
        const ground = upload([[new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), 3], [new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3], [new Float32Array([1, 1, 1, 1]), 1]], new Uint32Array([0, 2, 1, 0, 3, 2]));

        // ---------- geometry from the worker ----------
        let config = null, request = 0, marks = null, busy = false, ready = false;
        const worker = new Worker('/js/avatar-worker.js');
        worker.onmessage = (e) => {
            const m = e.data;
            if (m.landmarks) { marks = m.landmarks; return; }
            if (m.done) { if (m.done === request) { busy = false; ready = true; box.classList.remove('busy'); if (onReady) onReady(); } wake(); return; }
            if (parts.has(m.name)) { remove(parts.get(m.name)); parts.delete(m.name); }
            if (m.gone || !m.data.index.length) { wake(); return; }
            const d = m.data;
            const made = m.kind === 'strands' ? upload([[d.pos, 3], [d.tan, 3], [d.side, 2], [d.rnd, 1]], d.index) : upload([[d.pos, 3], [d.normal, 3], [d.ao, 1], ...(d.rest ? [[d.rest, 3], [d.lip, 1]] : [])], d.index);
            parts.set(m.name, { ...made, slot: m.slot, strands: m.kind === 'strands' });
            wake();
        };
        function setConfig(next) {
            config = next;
            request++;
            busy = true;
            box.classList.add('busy');
            worker.postMessage({ id: request, config: next });
            wake();
        }
        function setColors(next) { config = next; wake(); }

        // ---------- camera ----------
        const cam = { y: VIEWS.full.y, dist: VIEWS.full.dist, yaw: VIEWS.full.yaw, pitch: .06 };
        let goal = { ...cam }, editing = false;
        const look = { x: 0, y: 0, tx: 0, ty: 0 };
        function view(name) { goal = { pitch: .05, ...VIEWS[name] }; wake(); }
        const pointers = new Map();
        canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, e); });
        canvas.addEventListener('pointermove', (e) => {
            const old = pointers.get(e.pointerId);
            if (!old) return;
            if (pointers.size === 1) {
                goal.yaw -= (e.clientX - old.clientX) * .009;
                if (editing) goal.pitch = Math.max(-.3, Math.min(.9, goal.pitch + (e.clientY - old.clientY) * .006));
            } else {
                const [p, q] = [...pointers.values()];
                const before = Math.hypot(p.clientX - q.clientX, p.clientY - q.clientY);
                const other = p.pointerId === e.pointerId ? q : p;
                const now = Math.hypot(e.clientX - other.clientX, e.clientY - other.clientY);
                if (editing) goal.dist = Math.max(.5, Math.min(5, goal.dist * before / now));
            }
            pointers.set(e.pointerId, e);
            wake();
        });
        for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, (e) => pointers.delete(e.pointerId));
        canvas.addEventListener('wheel', (e) => {
            if (!editing) return;
            e.preventDefault();
            goal.dist = Math.max(.5, Math.min(5, goal.dist * Math.exp(e.deltaY * .001)));
            wake();
        }, { passive: false });
        // the eyes and the head follow the pointer
        window.addEventListener('pointermove', (e) => {
            const r = canvas.getBoundingClientRect();
            look.tx = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 500));
            look.ty = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height * .25) / 500));
        });

        // ---------- drawing ----------
        function common(prog, light, viewMatrix, eyePos, time, turn) {
            gl.useProgram(prog.p);
            const u = prog.u;
            gl.uniformMatrix4fv(u.uView, false, viewMatrix);
            gl.uniformMatrix4fv(u.uLight, false, light);
            if (u.uEye) gl.uniform3fv(u.uEye, eyePos);
            gl.uniform1f(u.uTime, time);
            gl.uniform2fv(u.uTurn, turn);
            gl.uniform1f(u.uScale, config.height);
            if (u.uPixel) gl.uniform1f(u.uPixel, prog === depthHair ? 0 : 2 * Math.tan(FOV / 2) / canvas.height);
            if (u.uShadow) gl.uniform1i(u.uShadow, 0);
            if (u.uLocal) gl.uniform4f(u.uLocal, 0, 0, 0, 0);
        }
        function draw(part) { gl.bindVertexArray(part.vao); gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0); }

        function render(now) {
            const w = Math.round(canvas.clientWidth * Math.min(2, devicePixelRatio)), h = Math.round(canvas.clientHeight * Math.min(2, devicePixelRatio));
            if (!w || !h || !config || !marks) return;
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            const time = Motion.calm ? 0 : now / 1000;
            for (const k of ['y', 'dist', 'yaw', 'pitch']) cam[k] += (goal[k] - cam[k]) * (Motion.calm ? 1 : .12);
            look.x += (look.tx - look.x) * .06; look.y += (look.ty - look.y) * .06;
            const turn = Motion.calm ? [0, 0] : [look.x * .30 + .03 * Math.sin(time * .5), look.y * .13];
            // keep the whole figure inside narrow windows
            const fit = Math.max(1, .52 / (w / h));
            const s = config.height, at = [0, cam.y * s, 0], dist = cam.dist * s * fit;
            const eyePos = [Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist, at[1] + Math.sin(cam.pitch) * dist, Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist];
            const viewMatrix = mul(perspective(FOV, w / h, .1, 12), lookAt(eyePos, at));
            // close to the face the shadow map covers only the head, so it is sharper
            const span = cam.dist < 1.3 ? .42 : 1.12, mid = cam.dist < 1.3 ? cam.y * s : .92 * s;
            const light = mul(ortho(span, .1, 6), lookAt([.55 * 2.4, mid + .75 * 2.4, .85 * 2.4], [0, mid, 0]));

            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);
            gl.disable(gl.BLEND);
            gl.bindFramebuffer(gl.FRAMEBUFFER, shadowBuffer);
            gl.viewport(0, 0, SIZE, SIZE);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            for (const strandsPass of [false, true]) {
                common(strandsPass ? depthHair : depth, light, light, eyePos, time, turn);
                if (strandsPass) gl.uniform3f(depthHair.u.uEye, .55 * 9, 9, .85 * 9);
                for (const p of parts.values()) if (p.strands === strandsPass && p.slot !== 'lens' && p.slot !== 'lashes' && p.slot !== 'brows') draw(p);
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, w, h);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, shadowMap);

            // skin, clothes, things
            common(solid, light, viewMatrix, eyePos, time, turn);
            const u = solid.u, m = marks;
            const hairless = config.hair === 'bald' || config.hat === 'scarf';
            gl.uniform4f(u.uPaint, config.blush, config.freckles, config.eyeShadow, config.lipstick);
            const beardTint = config.beard === 'stubble' ? 1 : config.beard === 'none' ? 0 : 1.1;
            gl.uniform4f(u.uPaint2, beardTint, config.scar ? 1 : 0, { none: 0, band: 1, sleeve: 2, pattern: 3 }[config.tattoo] || 0, hairless ? 0 : config.hair === 'buzz' ? .75 : .9);
            gl.uniform2f(u.uTint, 0, config.hairline);
            gl.uniform3fv(u.uLip, rgb(config.lipColor));
            gl.uniform3fv(u.uShade, rgb(config.shadowColor));
            const paint = (name, p) => {
                const [mat, color] = materialOf(p.slot, config);
                gl.uniform1i(u.uMat, mat);
                gl.uniform3fv(u.uColor, rgb(color));
                gl.uniform1f(u.uFace, name === 'head' ? 1 : 0);
                const patterned = p.slot === 'top';
                gl.uniform1i(u.uPattern, patterned ? { plain: 0, stripes: 1, check: 2, camo: 3, block: 4, fade: 5 }[config.pattern] || 0 : 0);
                gl.uniform3fv(u.uColor2, rgb(p.slot === 'skin' ? (beardTint && false ? config.beardColor : config.hairColor) : config.patternColor));
                draw(p);
            };
            for (const [name, p] of parts) if (!p.strands && p.slot !== 'lens') paint(name, p);

            // eyelids, then eyes
            const blinkPhase = (time + .6) % 4.3;
            const blink = Motion.calm ? 0 : Math.max(0, 1 - Math.abs(blinkPhase - .12) / .1);
            gl.uniform1i(u.uMat, 0); gl.uniform1i(u.uPattern, 0); gl.uniform1f(u.uFace, 0);
            gl.uniform3fv(u.uColor, rgb(config.skin));
            if (ready) for (const side of [-1, 1]) {
                gl.uniform4f(u.uLocal, side * m.eyeX, HEAD + m.eyeY, m.eyeZ, m.eyeR);
                gl.uniform1f(u.uLocalTurn, -1.0 + blink * 1.6);
                draw(lid);
            }
            common(eye, light, viewMatrix, eyePos, time, turn);
            gl.uniform3fv(eye.u.uColor, rgb(config.eyeColor));
            const gx = look.x * .32, gy = -look.y * .16, gl2 = Math.hypot(gx, gy, 1);
            gl.uniform3f(eye.u.uGaze, gx / gl2, gy / gl2, 1 / gl2);
            if (parts.has('head')) for (const side of [-1, 1]) { gl.uniform4f(eye.u.uLocal, side * m.eyeX, HEAD + m.eyeY, m.eyeZ, m.eyeR); draw(eyeball); }

            common(hairy, light, viewMatrix, eyePos, time, turn);
            for (const p of parts.values()) if (p.strands) {
                gl.uniform3fv(hairy.u.uColor, rgb(materialOf(p.slot, config)[1]));
                gl.uniform1f(hairy.u.uGloss, p.slot === 'hair' ? 1 : .35);
                draw(p);
            }
            // see-through things last
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            common(floor, light, viewMatrix, eyePos, time, turn);
            gl.uniform1f(floor.u.uScale, 1);
            gl.uniform3f(floor.u.uColor, .42, .78, 1);
            gl.disable(gl.CULL_FACE);
            draw(ground);
            if (parts.has('lens')) {
                gl.useProgram(solid.p);
                gl.uniform4f(u.uLocal, 0, 0, 0, 0);
                gl.uniform1f(u.uSkinFix, config.lensDark);
                gl.depthMask(false);
                paint('lens', parts.get('lens'));
                gl.depthMask(true);
            }
            gl.bindVertexArray(null);
        }

        let frame = 0, seen = true;
        new IntersectionObserver((list) => { seen = list[0].isIntersecting; if (seen) wake(); }).observe(canvas);
        function loop(now) {
            frame = 0;
            if (!seen || !canvas.isConnected) return;
            render(now);
            if (!Motion.calm) wake();
        }
        function wake() { if (!frame) frame = requestAnimationFrame(loop); }
        new ResizeObserver(wake).observe(canvas);

        function picture() { // a frame on a dark background
            render(performance.now());
            const copy = document.createElement('canvas');
            copy.width = canvas.width; copy.height = canvas.height;
            const ctx = copy.getContext('2d');
            const g = ctx.createRadialGradient(copy.width / 2, copy.height * .4, 0, copy.width / 2, copy.height * .4, copy.height * .8);
            g.addColorStop(0, '#12407e'); g.addColorStop(1, '#030b1f');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, copy.width, copy.height);
            ctx.drawImage(canvas, 0, 0);
            return copy;
        }
        return { canvas, setConfig, setColors, view, picture, wake, setEditing: (v) => { editing = v; }, isBusy: () => busy };
    }

    return { mount };
})();
