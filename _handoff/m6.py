H='js/avatar-human.js';W='js/avatar-worker.js';A='js/avatar.js';C='js/character.js'
ed(W,("    ponytail: {","""    curtains: { len: .135, lift: .40, grav: .13, n: 9500, w: .0014, steps: 14, comb: 'curtain', curl: .0045, freq: 46, shell: .006, fade: .55, lock: .6 },
    fringe: { len: .082, lift: .30, grav: .13, n: 9500, w: .0014, steps: 9, comb: 'fringe', shell: .006, fade: .5, lock: .9, curl: .0015, freq: 40 },
    sidefringe: { len: .095, lift: .30, grav: .12, n: 9500, w: .0014, steps: 10, comb: 'sweep', shell: .006, fade: .5, lock: .7, curl: .002, freq: 30 },
    wavy: { len: .115, lift: .45, grav: .13, n: 9500, w: .0014, steps: 16, comb: 'curtain', curl: .0085, freq: 75, shell: .008, fade: .25, lock: .6 },
    ponytail: {"""),
("(n * 13, R,","(n * 19, R,"),
("            const cl = clumps[(floor(noise(root[0] * 26, root[1] * 26, root[2] * 26) * 210 + 210) + (i % 3)) % 420];\n",
"""            // hair gathers in locks: every lock has its own character and a centre
            const size = .0085, cell = at.map((q) => Math.round(q / size + .35 * noise(at[0] * 90, at[1] * 90, at[2] * 90)));
            const cl = clumps[floor(hash(cell[0], cell[1], cell[2]) * 419.9)], lock = (style.lock === undefined ? .35 : style.lock) * (.6 + .6 * cl[3]);
            const pull = cell.map((q, k) => (q * size - at[k]) * lock);
"""),
("                case 'part':","""                case 'curtain': dir = [(root[0] + cl[0] * .004 > 0 ? 1 : -1) * (.55 + abs(root[0]) * 4), root[1] > .06 ? .35 : -.6, root[2] > .0 ? .55 : -.5]; break;
                case 'fringe': dir = [.18 + root[0] * 1.5 + cl[0] * .3, root[1] > .08 ? .25 : -.3, root[2] > -.03 ? 1 : -.3]; break;
                case 'sweep': dir = [root[0] < -.03 ? -.5 : 1, root[1] > .07 ? .35 : -.4, root[2] > 0 ? .55 : -.4]; break;
                case 'part':"""),
("            let dl = hypot(...dir) || 1;\n","""            if (style.len < .15 && style.comb && style.comb !== 'tie') { // the sides lie down and back
                const q = clamp(sideness * 1.2, 0, 1), m = hypot(...dir) || 1;
                dir = [mix(dir[0] / m, 0, q), mix(dir[1] / m, -1, q), mix(dir[2] / m, root[2] > .02 ? .05 : -.45, q)];
            }
            let dl = hypot(...dir) || 1;
"""),
("if (style.len < .15 && root[1] < .052 && root[2] < .04 && root[2] > -.055) len = min(len, .006);","if (style.len < .15 && at[1] < .040 && at[2] < .04 && at[2] > -.05) len = min(len, .007 + max(0, at[1] - .015) * .5);"),
("                if (style.len > .15 && p[2] > .03 && p[1] < .07","                if ((style.comb === 'curtain') && p[2] > .045 && p[1] < .075 && abs(p[0]) < .050) p[0] += (p[0] >= 0 ? 1 : -1) * (.050 - abs(p[0])) * .25;\n                if (style.len > .15 && p[2] > .03 && p[1] < .07"),
("                let q = [p[0] + cos(ph) * amp,","                const gather = t * t * 1.0;\n                let q = [p[0] + pull[0] * gather + cos(ph) * amp,"),
("p[1] + sin(ph * 1.07 + 1) * amp * .7, p[2] + sin(ph) * amp];","p[1] + pull[1] * gather + sin(ph * 1.07 + 1) * amp * .7, p[2] + pull[2] * gather + sin(ph) * amp];"),
("phase = cl[3] * 6.28 + R() * .9,","phase = cl[3] * 6.28 + R() * .6,"),
("style.w * (.8 + .5 * R()), cl[3] * .6 + R() * .4);\n        });","style.w * .62 * (.8 + .5 * R()), cl[3] * .5 + R() * .5);\n        });"),
("(1500000, R, inside","(620000, R, inside"),
# collar
)
s=open(W,encoding='utf8').read()
a=s.index("            const base = plane(z, T.neck) + .010, fall");b=s.index("        }, [-.15, 1.36, -.16], [.15, 1.57, .16], .0034));")
s=s[:a]+'''            const nq = P.neckline(x, y, z), [q, t] = around(x, y, z), ax = abs(x), R0 = T.neck * 1.06;
            const point = z > -.03 ? step(.075, .02, ax) : 0; // the tips of the collar reach down in front
            const stand = max(abs(nq - .008) - .0016, abs(t - .014) - .020, q - R0 - .012);
            const fall = max(abs(nq - .015 - clamp(.036 - t, 0, .05) * .16) - .0018, t - .036, -.004 - .032 * point - t, q - R0 - .045);
            const open = z > -.02 ? .004 + clamp(.036 - t, 0, 1) * .62 - ax : -1;
            return smax(smin(stand, fall, .004), open, .002) - .0012;
'''+s[b:]
s=s.replace("hoodie: { grow: .024","hoodie: { grow: .018").replace("sweater: { grow: .019","sweater: { grow: .015")
open(W,'w',encoding='utf8',newline='\n').write(s)

s=open(A,encoding='utf8').read()
import re
a=s.index("float shadow(vec4 s) {");b=s.index("vec3 film(vec3 c) {")
s=s[:a]+'''float shadow(vec4 s) { // a large soft lamp: the edge of the shadow is wide
    vec3 p = s.xyz / s.w * .5 + .5;
    if (p.x < 0. || p.x > 1. || p.y < 0. || p.y > 1.) return 1.;
    float sum = 0., turn = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.283;
    for (int i = 0; i < 20; i++) {
        float r = sqrt((float(i) + .5) / 20.), a = float(i) * 2.39996 + turn;
        sum += step(p.z - .0024 - r * .0012, texture(uShadow, p.xy + vec2(cos(a), sin(a)) * r * uSoft).r);
    }
    return sum / 20.;
}
vec3 sky(vec3 r) { // a room with a big window
    float window = smoothstep(.62, .80, dot(r, normalize(vec3(.6, .45, .7)))) * (.65 + .35 * step(.06, abs(r.y - .42)));
    float lamp = smoothstep(.80, .95, dot(r, normalize(vec3(-.7, .5, .5))));
    return mix(vec3(.13, .115, .10), vec3(.46, .46, .45), smoothstep(-.5, .8, r.y)) + vec3(1.25, 1.24, 1.2) * window + vec3(.35, .32, .28) * lamp;
}
'''+s[b:]
s=s.replace("uniform sampler2D uShadow; uniform vec3 uEye;\nconst","uniform sampler2D uShadow; uniform vec3 uEye; uniform float uSoft;\nconst")
s=s.replace("            if (u.uShadow) gl.uniform1i(u.uShadow, 0);","            if (u.uShadow) gl.uniform1i(u.uShadow, 0);\n            if (u.uSoft) gl.uniform1f(u.uSoft, cam.dist < 1.3 ? .0095 : .0042);")
# skin lighting
s=s.replace("vec3 amb = mix(vec3(.20, .17, .17), vec3(.54, .58, .64), N.y * .5 + .5);","vec3 amb = mix(vec3(.30, .24, .21), vec3(.66, .66, .66), N.y * .5 + .5);")
s=s.replace("fill * vec3(.24, .28, .34) * ao","fill * vec3(.34, .33, .32) * ao")
s=s.replace("diffuse * vec3(2.35, 2.2, 2.0)","diffuse * vec3(1.95, 1.88, 1.78)").replace("sh * vec3(2.6, 2.45, 2.25)","sh * vec3(2.2, 2.15, 2.05)")
s=s.replace("col += rimLight * vec3(.35, .75, 1.3) * ao * (uMat == 1 || uMat == 7 ? .55 : .8);","col += rimLight * vec3(.34, .36, .40) * ao;")
s=s.replace("col += rim * vec3(.35, .75, 1.3) * .5 * (.3 + base * 2.);","col += rim * vec3(.3) * (.15 + base * 2.);")
s=s.replace("vec3(1., .96, .9) * pow(max(c1, 0.), 110.) * .34","vec3(1., .97, .93) * pow(max(c1, 0.), 90.) * .13").replace("pow(max(c2, 0.), 28.) * .75","pow(max(c2, 0.), 24.) * .6")
s=s.replace("base * mix(vec3(.16, .15, .16), vec3(.42, .50, .62), N.y * .5 + .5)","base * mix(vec3(.20, .18, .17), vec3(.55, .55, .55), N.y * .5 + .5)")
# relief
s=s.replace("    if (uMat == 0) return fade * (noise(p * 1500.) * .00010 + noise(p * 620.) * .00012);",
'''    if (uMat == 0) {
        float h = fade * (noise(p * 1300.) * .00013 + noise(p * 620.) * .00016) + noise(p * 210.) * .00012;
        if (uFace > .5) h += (1. - smoothstep(.0, .5, spots(vRest, 260., .75).x)) * .00035 * uSpots.y * cheeks(vRest) * fade;
        return h;
    }''')
s=s.replace("// height of the fine relief","""// small spots scattered over the skin: x = distance to the nearest one, y = its random number
vec2 spots(vec3 p, float density, float rare) {
    vec3 c = floor(p * density); vec2 best = vec2(9., 0.);
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
        vec3 q = c + vec3(i, j, k); float r = hash(q);
        if (r < rare) continue;
        vec3 o = vec3(hash(q + 7.3), hash(q + 17.1), hash(q + 31.7));
        float d = length(p * density - q - o);
        if (d < best.x) best = vec2(d, fract(r * 91.7));
    }
    return best;
}
float cheeks(vec3 q) { // where blemishes usually are
    float ax = abs(q.x);
    return clamp(smoothstep(.030, .012, length(vec2(ax - .046, (q.y + .038) * .75))) + .5 * smoothstep(.016, .0, abs(q.y + .100)) + .35 * smoothstep(.02, .0, abs(q.y - .052)), 0., 1.) * step(0., q.z);
}
// height of the fine relief""")
s=s.replace("uniform float uFace, uSkinFix;","uniform vec2 uSpots; uniform float uFace, uSkinFix;")
s=s.replace('''        base *= .93 + .14 * fbm(p * 55.);
        base *= mix(vec3(1.), vec3(1.05, .965, .95), fbm(p * 22. + 4.));
''','''        base *= .90 + .20 * fbm(p * 60.);
        base *= mix(vec3(1.02, .99, .97), vec3(1.05, .93, .90), smoothstep(.3, .7, fbm(p * 24. + 4.)));
        base *= mix(1., .93 + .14 * noise(p * 420.), smoothstep(.0012, .0004, length(fwidth(p))));
''')
s=s.replace('''            // freckles
''','''            // moles, blemishes, the skin under the eyebrows
            vec2 mole = spots(q + 3., 62., 1. - uSpots.x * .055);
            base *= mix(vec3(1.), vec3(.36, .26, .22), smoothstep(.062, .038, mole.x / (.5 + mole.y)) * step(-.02, q.z));
            vec2 spot = spots(q, 260., .75), old = spots(q + 9., 150., .6);
            float area = cheeks(q) * uSpots.y;
            base *= mix(vec3(1.), vec3(1.06, .60, .56), smoothstep(.55, .1, spot.x) * area * .75);
            base *= mix(vec3(1.), vec3(1.03, .80, .77), (smoothstep(.75, .2, old.x) * .6 + .55 * noise(q * 130.)) * area);
            float bt = clamp((ax - .0105) / .042, 0., 1.), line = .0172 + .0058 * sin(min(1., bt * 1.12) * 1.885) - .0095 * smoothstep(.62, 1., bt) + uBrow.y * .003 * sin(bt * 3.1416);
            float brow = smoothstep(1.25, .35, abs(q.y - line) / (.0044 * (1. - .75 * smoothstep(.5, 1., bt)))) * smoothstep(.009, .014, ax) * smoothstep(.0535, .048, ax) * step(.03, q.z);
            base = mix(base, uBrowColor * .6, brow * uBrow.x);
            // freckles
''')
s=s.replace("uniform vec4 uPaint, uPaint2;","uniform vec4 uPaint, uPaint2; uniform vec2 uBrow; uniform vec3 uBrowColor;")
s=s.replace("            gl.uniform3fv(u.uLip,","            gl.uniform2f(u.uSpots, config.moles, config.blemish);\n            gl.uniform2f(u.uBrow, .34 + config.browThick * .12, config.browShape);\n            gl.uniform3fv(u.uBrowColor, rgb(config.browColor));\n            gl.uniform3fv(u.uLip,")
s=s.replace("under * .5);","under * .75);")
s=s.replace("g.addColorStop(0, '#12407e'); g.addColorStop(1, '#030b1f');","g.addColorStop(0, '#b9bab8'); g.addColorStop(1, '#5d6063');")
# floor: only the shadow
a=s.index("    float px = fwidth(r);");b=s.index("    const DEPTH_FS")
s=s[:a]+'''    frag = vec4(0., 0., 0., clamp(dark, 0., 1.));
}`;
'''+s[b:]
s=s.replace("            gl.uniform3f(floor.u.uColor, .42, .78, 1);\n","")
s=s.replace("precision highp float;\nin vec3 vPos, vWorld, vNormal; in vec4 vShadow; in float vAo;\nuniform vec3 uColor;\nout vec4 frag;\n${LIGHT}\nvoid main() {\n    float r","precision highp float;\nin vec3 vPos, vWorld, vNormal; in vec4 vShadow; in float vAo;\nout vec4 frag;\n${LIGHT}\nvoid main() {\n    float r")
open(A,'w',encoding='utf8',newline='\n').write(s)
ed('css/character.css',("radial-gradient(ellipse at 50% 42%, #1d4f9e, #061333 75%)","radial-gradient(ellipse at 50% 38%, #c4c4c1, #74777a 85%)"),
("radial-gradient(ellipse at 50% 42%, #1f55a8, #040e28 72%)","radial-gradient(ellipse at 50% 38%, #c4c4c1, #6b6e71 85%)"))
ed(C,("['messy', 'Messy'],","['curtains', 'Curtains'], ['fringe', 'Choppy fringe'], ['sidefringe', 'Side fringe'], ['wavy', 'Medium wavy'], ['messy', 'Messy'],"))
