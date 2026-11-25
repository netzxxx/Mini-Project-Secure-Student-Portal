// A ring reactor on a canvas, drawn in 3D from flat faces. Its shape comes from a text (the username),
// so every account has its own. Drag turns it, the pointer heats the coils, a click sends a pulse around.
// It is decoration: it has nothing to do with tokens or access.
const Reactor = (() => {
    const TURN = Math.PI * 2;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mix = (a, b, p) => a + (b - a) * p;

    // ---------- colours: shared by every core on the page and remembered in this browser ----------
    const KEY = 'portal.reactor';
    const PRESETS = {
        'Cherenkov blue': { core: '#35c8ff', control: '#c9e4f5', shell: '#8fc4e8' },
        'Ice white': { core: '#d9efff', control: '#4f9dff', shell: '#ffffff' },
        'Emerald': { core: '#1fe39a', control: '#e6fff5', shell: '#5affc4' },
        'Violet': { core: '#9a6bff', control: '#f0e8ff', shell: '#bfa2ff' },
        'Amber': { core: '#ffab2e', control: '#fff3dd', shell: '#ffc970' },
        'Crimson': { core: '#ff4465', control: '#ffe6ea', shell: '#ff8a9e' },
    };
    const colors = { ...PRESETS['Cherenkov blue'] };
    const isColor = (v) => /^#[0-9a-f]{6}$/i.test(v);
    const redraw = new Set(); // cores that must repaint when motion is reduced

    function setColors(next) {
        for (const name of Object.keys(colors)) if (isColor(next[name])) colors[name] = next[name];
        try { localStorage.setItem(KEY, JSON.stringify(colors)); } catch { /* kept until reload */ }
        redraw.forEach((paint) => paint());
    }
    try {
        const saved = JSON.parse(localStorage.getItem(KEY)) || {};
        for (const name of Object.keys(colors)) if (isColor(saved[name])) colors[name] = saved[name];
    } catch { /* default colours */ }

    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const rgba = (c, a) => 'rgba(' + c.map(Math.round).join(',') + ',' + a + ')';
    const blend = (a, b, p) => a.map((v, i) => mix(v, b[i], p));

    // Small seeded generator: the same text always gives the same numbers.
    function random(text) {
        let h = 2166136261;
        for (const c of text) h = Math.imul(h ^ c.codePointAt(0), 16777619);
        return () => {
            h = Math.imul(h ^ (h >>> 15), 2246822519);
            h = Math.imul(h ^ (h >>> 13), 3266489917);
            h ^= h >>> 16;
            return (h >>> 0) / 4294967296;
        };
    }

    // ---------- 3D model ----------
    // The model is a list of flat faces. kind: light = glowing cell, coil, metal, dark.
    // Every account has its own number of coils, windings, rows and drum shape.
    function build(text, coils) {
        const next = random(text || 'student portal');
        const pick = (min, max) => min + Math.floor(next() * (max - min + 1));
        const own = pick(9, 12);
        const n = coils || own;
        const windings = pick(4, 8);
        const rows = pick(2, 4);
        const bottom = 190 + next() * 65;
        const depth = 205 + next() * 55;
        const fin = 14 + next() * 20;
        const share = 0.48 + next() * 0.14;
        const faces = [];
        const part = TURN / n;
        const at = (r, a, z) => [r * Math.cos(a), r * Math.sin(a), z];

        // corners are put in one order, so the side that looks away can be skipped
        function face(points, out, kind, angle, extra) {
            const [a, b, , d] = points;
            const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
            const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
            let normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
            const size = Math.hypot(...normal) || 1;
            normal = normal.map((c) => c / size);
            const same = normal[0] * out[0] + normal[1] * out[1] + normal[2] * out[2] >= 0;
            const turned = (((angle % TURN) + TURN) % TURN) / part;
            faces.push({
                p: same ? points : [a, d, points[2], b], normal: same ? normal : normal.map((c) => -c),
                kind, coil: Math.floor(turned) % n, phase: next() * TURN, ...extra,
            });
        }

        // a band turned around the axis, from (r0, z0) to (r1, z1) between two angles
        function band(r0, z0, r1, z1, outR, outZ, a0, a1, kind, extra) {
            const m = (a0 + a1) / 2;
            face([at(r0, a0, z0), at(r1, a0, z1), at(r1, a1, z1), at(r0, a1, z0)],
                [outR * Math.cos(m), outR * Math.sin(m), outZ], kind, m, extra);
        }
        function around(count, share1, draw) {
            for (let i = 0; i < count; i++) draw((i / count) * TURN, ((i + share1) / count) * TURN, i);
        }

        // well in the middle: glowing floor, steps and an inner ring
        around(24, 1, (a, b) => {
            band(8, -40, 112, -40, 0, 1, a, b, 'light');
            band(112, -40, 112, 70, -1, 0, a, b, 'light', { lines: 3 });
            band(112, 70, 158, 92, -0.4, 1, a, b, 'metal');
            band(158, 92, 158, 150, -1, 0, a, b, 'dark', { lines: 2 });
            band(62, 20, 80, 20, 0, 1, a, b, 'metal');
            band(80, 20, 80, 0, 1, 0, a, b, 'metal');
            band(62, 20, 62, 0, -1, 0, a, b, 'metal');
        });
        // top plate
        around(48, 1, (a, b) => band(158, 150, 226, 150, 0, 1, a, b, 'metal', { smooth: true }));
        around(3, 0.07, (a, b) => band(184, 152, 200, 152, 0, 1, a + 0.5, b + 0.5, 'dark'));

        // coils with glowing cells between them
        around(n, share, (a, b) => {
            const m = (a + b) / 2;
            band(222, 172, 350, 172, 0, 1, a, b, 'coil', { lines: windings });
            band(350, 172, 350, 48, 1, 0, a, b, 'coil', { lines: windings });
            band(222, 150, 222, 172, -1, 0, a, b, 'coil');
            for (const [side, sign] of [[a, -1], [b, 1]]) {
                face([at(222, side, 172), at(350, side, 172), at(350, side, 48), at(222, side, 48)],
                    [-Math.sin(side) * sign, Math.cos(side) * sign, 0], 'coil', m);
            }
            const from = b;
            const to = a + part;
            const half = (from + to) / 2;
            [[from, half], [half, to]].forEach(([c, d]) => {
                band(226, 140, 322, 132, 0.1, 1, c, d, 'light');
                band(322, 132, 328, 48, 1, 0.1, c, d, 'light', { lines: 1 });
            });
        });
        // collar
        around(48, 1, (a, b) => {
            band(300, 46, 358, 46, 0, 1, a, b, 'metal', { smooth: true });
            band(358, 46, 358, 24, 1, 0, a, b, 'metal', { smooth: true });
        });
        // drum: glowing panels in rows, fins between them
        const radiusAt = (z) => mix(332, bottom, Math.pow((24 - z) / depth, 1.25));
        const panels = n * 2;
        for (let row = 0; row < rows; row++) {
            const z0 = 24 - (row / rows) * depth;
            const z1 = 24 - ((row + 0.86) / rows) * depth;
            const z2 = 24 - ((row + 1) / rows) * depth;
            around(panels, 0.86, (a, b) => band(radiusAt(z0), z0, radiusAt(z1), z1, 1, -0.3, a, b, 'light', { lines: row ? 0 : 2 }));
            around(panels, 1, (a, b) => band(radiusAt(z1), z1, radiusAt(z2), z2, 1, -0.3, a, b, 'metal'));
            around(panels, 1, (a) => {
                const c = a - 0.07 * part;
                const drop = row === rows - 1 ? 22 : 0;
                face([at(radiusAt(z0) - 4, c, z0), at(radiusAt(z0) + fin, c, z0), at(radiusAt(z2) + fin, c, z2 - drop), at(radiusAt(z2) - 4, c, z2)],
                    [-Math.sin(c), Math.cos(c), 0], 'metal', c, { both: true });
            });
        }
        return { faces, coils: n, own };
    }

    // ---------- one reactor ----------
    // options: { scale, coils: 0 = the account's own number, power 0..1, speed }
    function mount(target, text, options) {
        const opt = { scale: 1, coils: 0, power: 0.65, speed: 1, ...options };
        const canvas = el('canvas', { class: 'reactor', 'aria-hidden': 'true' });
        const ctx = canvas.getContext('2d');
        const bloom = document.createElement('canvas');
        const bloomCtx = bloom.getContext('2d');
        target.replaceChildren(canvas);

        let name = text;
        let model = build(name, opt.coils);
        let heat = new Array(model.coils).fill(0);
        let power = calm ? opt.power : 0; // the core lights up at the start
        let boost = 0;                    // short extra power
        let alarm = 0;                    // refused: emergency stop
        let burst = 0;                    // admitted: 0..1
        let onBurst = null;
        let yaw = 0.3;
        let spin = 0;                     // extra turning speed from dragging
        let tilt = 1.02;
        let drag = null;
        let pulses = [];                  // running around the coils
        let sparks = [];                  // rising from the well
        let light = false;                // slow computer: no bloom, lower resolution
        let slow = 0;
        let last = performance.now();
        const pointer = { x: 0, y: 0, on: false };

        function local(e) {
            const r = canvas.getBoundingClientRect();
            return { x: ((e.clientX - r.left) / r.width - 0.5) * 1000, y: ((e.clientY - r.top) / r.height - 0.5) * 1000 };
        }

        // 3D point -> screen, seen from above at an angle
        function project(point) {
            const c = Math.cos(yaw);
            const s = Math.sin(yaw);
            const px = point[0] * c - point[1] * s;
            const py = point[0] * s + point[1] * c;
            const z = point[2] + 25;
            const depth = py * Math.sin(tilt) + z * Math.cos(tilt);
            const near = 1700 / (1700 - depth);
            return { x: px * near * opt.scale, y: (py * Math.cos(tilt) - z * Math.sin(tilt)) * near * opt.scale, depth };
        }

        function coilPoint(i) {
            const a = ((i + 0.3) / model.coils) * TURN;
            return project([290 * Math.cos(a), 290 * Math.sin(a), 172]);
        }

        function chain(p) {
            if (calm) return;
            let start = Math.floor(Math.random() * model.coils);
            if (p) {
                let best = Infinity;
                for (let i = 0; i < model.coils; i++) {
                    const c = coilPoint(i);
                    const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
                    if (d < best) { best = d; start = i; }
                }
            }
            // two pulses run around the ring in opposite directions, twice
            pulses.push({ at: start, way: 1, left: model.coils * 2 }, { at: start, way: -1, left: model.coils * 2 });
            pulses = pulses.slice(-8);
            boost = Math.min(1, boost + 0.5);
            for (let i = 0; i < 26; i++) spark();
        }

        function spark() {
            if (sparks.length > 90) return;
            const a = Math.random() * TURN;
            const r = Math.random() * 100;
            sparks.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: 120, v: 160 + Math.random() * 320, life: 1 });
        }

        if (!calm) {
            canvas.addEventListener('pointermove', (e) => {
                const p = local(e);
                pointer.on = true;
                if (drag) {
                    const dx = p.x - pointer.x;
                    const seconds = Math.max(0.008, (e.timeStamp - drag.time) / 1000);
                    yaw -= dx / 260;
                    tilt = Math.max(0.2, Math.min(1.4, tilt - (p.y - pointer.y) / 420));
                    spin = mix(spin, -dx / 260 / seconds, 0.4);
                    drag.moved += Math.abs(dx) + Math.abs(p.y - pointer.y);
                    drag.time = e.timeStamp;
                }
                pointer.x = p.x;
                pointer.y = p.y;
            });
            canvas.addEventListener('pointerleave', () => { pointer.on = false; });
            canvas.addEventListener('pointerdown', (e) => {
                Object.assign(pointer, local(e));
                canvas.setPointerCapture(e.pointerId);
                drag = { time: e.timeStamp, moved: 0 };
                spin = 0;
            });
            canvas.addEventListener('pointerup', (e) => {
                if (drag && drag.moved < 12) chain(local(e));
                spin = Math.max(-9, Math.min(9, spin));
                drag = null;
            });
            canvas.addEventListener('pointercancel', () => { drag = null; });
        }

        function step(dt) {
            alarm = Math.max(0, alarm - dt / 1.7);
            boost = Math.max(0, boost - dt / 1.5);
            // emergency stop: the light goes out, then the core starts again
            power = mix(power, alarm > 0.3 ? 0.02 : Math.min(1.3, opt.power + boost * 0.6), Math.min(1, dt * (alarm > 0.3 ? 9 : 2.6)));
            if (!drag) {
                yaw += (0.18 * opt.speed + spin) * dt;
                spin *= Math.pow(0.3, dt);
            }
            heat = heat.map((h) => h * Math.pow(0.06, dt));
            if (pointer.on && !drag) {
                heat.forEach((h, i) => {
                    const c = coilPoint(i);
                    heat[i] = Math.max(h, Math.exp(-((c.x - pointer.x) ** 2 + (c.y - pointer.y) ** 2) / 9000));
                });
            }
            pulses = pulses.filter((p) => {
                const move = Math.min(p.left, dt * 15);
                p.at += p.way * move;
                p.left -= move;
                heat[((Math.round(p.at) % model.coils) + model.coils) % model.coils] = 1;
                return p.left > 0;
            });
            if (Math.random() < dt * 14 * power) spark();
            sparks = sparks.filter((s) => {
                s.z += s.v * dt;
                s.life -= dt * 1.1;
                return s.life > 0;
            });
            if (burst) {
                burst = Math.min(1, burst + dt / 0.75);
                if (burst === 1 && onBurst) { onBurst(); onBurst = null; }
            }
        }

        function paint(now) {
            const pixels = Math.round(canvas.clientWidth * (light ? 0.75 : Math.min(1.5, window.devicePixelRatio || 1)));
            if (!pixels) return;
            if (canvas.width !== pixels) { canvas.width = pixels; canvas.height = pixels; }
            const time = calm ? 0 : (now / 1000) * opt.speed;
            const red = [255, 48, 72];
            const night = [5, 14, 36];
            const white = [255, 255, 255];
            const core = blend(rgb(colors.core), red, Math.min(1, alarm * 1.3));
            const coil = rgb(colors.control);
            const metal = rgb(colors.shell);
            const level = Math.max(0, power + burst * 2);

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, pixels, pixels);
            const zoom = (pixels / 1000) * (1 + burst * burst * 2.6);
            ctx.setTransform(zoom, 0, 0, zoom, pixels / 2, pixels / 2);
            ctx.globalAlpha = 1 - burst * burst;
            ctx.lineJoin = 'round';

            // light around the body
            const reach = 490 * opt.scale;
            const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
            halo.addColorStop(0, rgba(core, Math.min(0.8, 0.6 * level)));
            halo.addColorStop(0.6, rgba(core, Math.min(0.35, 0.24 * level)));
            halo.addColorStop(1, rgba(core, 0));
            ctx.fillStyle = halo;
            ctx.fillRect(-reach, -reach, reach * 2, reach * 2);

            const c = Math.cos(yaw);
            const s = Math.sin(yaw);
            const list = [];
            for (const f of model.faces) {
                const q = f.p.map(project);
                // area > 0 means the face looks at us
                const area = (q[1].x - q[0].x) * (q[2].y - q[0].y) - (q[1].y - q[0].y) * (q[2].x - q[0].x);
                if (area <= 0 && !f.both) continue;
                list.push({ f, q, depth: (q[0].depth + q[1].depth + q[2].depth + q[3].depth) / 4 });
            }
            list.sort((a, b) => a.depth - b.depth);

            for (const { f, q } of list) {
                const hot = heat[f.coil] || 0;
                const nx = f.normal[0] * c - f.normal[1] * s;
                const ny = f.normal[0] * s + f.normal[1] * c;
                const lit = 0.34 + 0.66 * Math.max(0, -0.45 * nx + 0.4 * ny + 0.8 * f.normal[2]);
                ctx.beginPath();
                ctx.moveTo(q[0].x, q[0].y);
                for (let i = 1; i < 4; i++) ctx.lineTo(q[i].x, q[i].y);
                ctx.closePath();
                let fill;
                let edge;
                if (f.kind === 'light') {
                    const glow = Math.min(1, level * (0.78 + 0.14 * Math.sin(time * 2.6 + f.phase)) + hot * 0.6);
                    fill = blend(blend(core, night, 0.82), blend(core, white, 0.08 + 0.4 * glow), Math.min(1, glow));
                    edge = blend(core, white, 0.45);
                } else {
                    const own = f.kind === 'coil' ? coil : metal;
                    const dim = f.kind === 'dark' ? 0.85 : 0.5;
                    fill = blend(blend(own, night, dim + (1 - lit) * 0.35), core, Math.min(0.75, 0.1 * level + hot * 0.65));
                    edge = blend(own, core, 0.3);
                }
                ctx.fillStyle = rgba(fill, 1);
                ctx.fill();
                // smooth bands hide their seams with a line of the same colour
                ctx.strokeStyle = f.smooth ? rgba(fill, 1) : rgba(edge, f.kind === 'light' ? 0.55 : 0.75);
                ctx.lineWidth = f.kind === 'coil' ? 1.8 : 1.3;
                ctx.stroke();
                if (f.lines) {
                    ctx.strokeStyle = f.kind === 'coil' ? rgba(blend(edge, white, hot), 0.9) : rgba(edge, 0.5);
                    ctx.beginPath();
                    for (let i = 1; i <= f.lines; i++) {
                        const t = i / (f.lines + 1);
                        ctx.moveTo(mix(q[0].x, q[1].x, t), mix(q[0].y, q[1].y, t));
                        ctx.lineTo(mix(q[3].x, q[2].x, t), mix(q[3].y, q[2].y, t));
                    }
                    ctx.stroke();
                }
            }

            // beam from the well and rising sparks
            ctx.globalCompositeOperation = 'lighter';
            const well = project([0, 0, 125]);
            const beam = ctx.createRadialGradient(well.x, well.y, 0, well.x, well.y, 190 * opt.scale);
            beam.addColorStop(0, rgba(blend(core, white, 0.75), Math.min(0.95, 0.75 * level)));
            beam.addColorStop(0.35, rgba(core, Math.min(0.6, 0.4 * level)));
            beam.addColorStop(1, rgba(core, 0));
            ctx.fillStyle = beam;
            ctx.fillRect(well.x - 190 * opt.scale, well.y - 190 * opt.scale, 380 * opt.scale, 380 * opt.scale);
            ctx.lineWidth = 3;
            sparks.forEach((p) => {
                const low = project([p.x, p.y, p.z - p.v * 0.05]);
                const high = project([p.x, p.y, p.z]);
                ctx.strokeStyle = rgba(blend(core, white, 0.6), p.life);
                ctx.beginPath();
                ctx.moveTo(low.x, low.y);
                ctx.lineTo(high.x, high.y);
                ctx.stroke();
            });
            ctx.globalCompositeOperation = 'source-over';

            if (light) return;
            // bloom: a tiny copy of the picture, stretched back over it
            const small = Math.max(1, Math.round(pixels / 9));
            if (bloom.width !== small) { bloom.width = small; bloom.height = small; }
            bloomCtx.clearRect(0, 0, small, small);
            bloomCtx.drawImage(canvas, 0, 0, small, small);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.min(0.55, 0.1 + level * 0.3) * (1 - burst * burst);
            ctx.drawImage(bloom, 0, 0, pixels, pixels);
            ctx.globalCompositeOperation = 'source-over';
        }

        function frame(now) {
            if (!canvas.isConnected) { redraw.delete(still); return; }
            requestAnimationFrame(frame);
            const gap = now - last;
            last = now;
            if (!canvas.offsetParent) return;
            if (gap < 200) slow = Math.max(0, slow + (gap > 30 ? 1 : -1)); // longer gaps = hidden tab
            if (slow > 45) light = true;
            step(Math.min(0.05, gap / 1000));
            paint(now);
        }

        function still() {
            if (!calm) return;
            power = opt.power;
            requestAnimationFrame(paint);
        }

        redraw.add(still);
        if (calm) {
            still();
            // the canvas may be in a hidden tab now: paint when it gets a size
            new ResizeObserver(still).observe(canvas);
        } else {
            requestAnimationFrame((now) => { last = now; frame(now); });
        }

        function rebuild() {
            model = build(name, opt.coils);
            heat = new Array(model.coils).fill(calm ? 0 : 1); // flash on change
            pulses = [];
            still();
        }

        return {
            canvas,
            chain: () => chain(null),
            ownCoils: () => model.own,
            setText(value) { if (value !== name) { name = value; rebuild(); } },
            // power, speed, coils, tilt
            set(option, value) {
                if (option === 'tilt') tilt = value;
                opt[option] = value;
                if (option === 'coils') rebuild(); else still();
            },
            kick() { boost = Math.min(1, boost + 0.22); },
            refuse() { if (!calm) { alarm = 1; pulses = []; } },
            // plays the power surge, then resolves
            admit() {
                if (calm) return Promise.resolve();
                chain(null);
                spin = 5;
                burst = 0.001;
                // the timer is a fallback for a tab in the background, where frames are paused
                return new Promise((done) => { onBurst = done; setTimeout(done, 1100); });
            },
        };
    }

    // Row of colour buttons. Colours are set through the DOM API, which CSP allows.
    function swatches(target, onPick) {
        target.replaceChildren(...Object.entries(PRESETS).map(([label, set]) => {
            const button = el('button', {
                type: 'button', class: 'swatch', 'aria-label': label, title: label,
                onclick: () => { setColors(set); if (onPick) onPick(); },
            });
            button.style.backgroundColor = set.core;
            return button;
        }));
    }

    return { mount, colors, setColors, swatches };
})();
