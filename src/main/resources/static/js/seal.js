// Living guilloche seal on a canvas. The shape comes from a text (the username), so every account
// has its own. It can be dragged, pushed with the pointer and clicked. Decoration, not cryptography.
const Seal = (() => {
    const TURN = Math.PI * 2;
    const STEPS = 180; // points per line
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    // Three rings; spin has different signs, so they turn against each other like gears.
    function shape(text) {
        const next = random(text || 'student portal');
        const pick = (min, max) => min + Math.floor(next() * (max - min + 1));
        return [
            { radius: 405, wave: 50 + next() * 32, petals: pick(9, 18), lines: 12, detail: 6, spin: 0.05 },
            { radius: 245, wave: 75 + next() * 45, petals: pick(5, 9), lines: 14, detail: 8 + next() * 14, spin: -0.09 },
            { radius: 95, wave: 35 + next() * 25, petals: pick(3, 8), lines: 10, detail: 4, spin: 0.16 },
        ];
    }

    const mix = (a, b, p) => a + (b - a) * p;
    const ease = (p) => 1 - Math.pow(1 - p, 3);

    // Instrument ring around the seal: a scale, two counter-turning arcs and a glowing core.
    function instrument(ctx, now) {
        const t = calm ? 0 : now / 1000;
        ctx.globalAlpha *= 0.75;
        ctx.beginPath();
        for (let i = 0; i < 180; i++) {
            const a = (i / 180) * TURN + t * 0.03;
            const from = i % 15 ? 474 : 458;
            ctx.moveTo(Math.cos(a) * from, Math.sin(a) * from);
            ctx.lineTo(Math.cos(a) * 486, Math.sin(a) * 486);
        }
        ctx.stroke();
        const thin = ctx.lineWidth;
        ctx.lineWidth = 7;
        for (let i = 0; i < 3; i++) {
            const a = t * 0.35 + (i / 3) * TURN;
            ctx.beginPath();
            ctx.arc(0, 0, 440, a, a + 0.62);
            ctx.stroke();
        }
        ctx.lineWidth = 3;
        for (let i = 0; i < 2; i++) {
            const a = -t * 0.6 + (i / 2) * TURN;
            ctx.beginPath();
            ctx.arc(0, 0, 424, a, a + 1.1);
            ctx.stroke();
        }
        ctx.lineWidth = thin;
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 130);
        glow.addColorStop(0, 'rgba(214, 240, 255, .95)');
        glow.addColorStop(0.25, 'rgba(120, 200, 255, .5)');
        glow.addColorStop(1, 'rgba(60, 140, 255, 0)');
        ctx.fillStyle = glow;
        ctx.globalAlpha *= 0.85 + 0.15 * Math.sin(t * 2.4);
        ctx.beginPath();
        ctx.arc(0, 0, 130, 0, TURN);
        ctx.fill();
    }

    // options: { width: line width in screen pixels, speed, depth: 3D, instrument: scale and core }
    function mount(target, text, options) {
        const opt = { width: 1, speed: 1, depth: 1, instrument: false, ...options };
        const canvas = el('canvas', { class: 'seal', 'aria-hidden': 'true' });
        const ctx = canvas.getContext('2d');
        const bloom = document.createElement('canvas');
        const bloomCtx = bloom.getContext('2d');
        target.replaceChildren(canvas);

        let from = shape(text);
        let to = from;
        let morph = 1;      // 0 = old shape, 1 = new shape
        let drawn = calm ? 1 : 0; // how much of every line is engraved
        let angle = 0;
        let velocity = 0;   // extra spin from dragging
        let shake = 0;      // refused
        let burst = 0;      // admitted: 0..1
        let onBurst = null;
        let drag = null;
        let last = performance.now();
        const pointer = { x: 0, y: 0, power: 0, goal: 0 };
        let waves = [];
        const turn = [0, 0, 0];
        let light = false;  // slow computer: no bloom, lower resolution
        let slow = 0;
        let yaw = 0;        // camera follows the pointer
        let pitch = 0;

        function local(e) {
            const r = canvas.getBoundingClientRect();
            return { x: ((e.clientX - r.left) / r.width - 0.5) * 1000, y: ((e.clientY - r.top) / r.height - 0.5) * 1000 };
        }

        if (!calm) {
            canvas.addEventListener('pointermove', (e) => {
                const p = local(e);
                pointer.x = p.x;
                pointer.y = p.y;
                pointer.goal = 1;
                if (!drag) return;
                const a = Math.atan2(p.y, p.x);
                let step = a - drag.angle;
                if (step > Math.PI) step -= TURN;
                if (step < -Math.PI) step += TURN;
                angle += step;
                velocity = mix(velocity, step / Math.max(0.008, (e.timeStamp - drag.time) / 1000), 0.4);
                drag.angle = a;
                drag.time = e.timeStamp;
                drag.moved += Math.abs(step);
            });
            canvas.addEventListener('pointerleave', () => { pointer.goal = 0; });
            canvas.addEventListener('pointerdown', (e) => {
                const p = local(e);
                canvas.setPointerCapture(e.pointerId);
                drag = { angle: Math.atan2(p.y, p.x), time: e.timeStamp, moved: 0 };
                velocity = 0;
            });
            canvas.addEventListener('pointerup', () => {
                if (drag && drag.moved < 0.05) ripple();
                velocity = Math.max(-14, Math.min(14, velocity));
                drag = null;
            });
            canvas.addEventListener('pointercancel', () => { drag = null; });
        }

        function ripple() {
            if (!calm) waves = [...waves, { r: 0 }].slice(-4);
        }

        function change(rings) {
            // start from what is on screen; if a morph is running, finish it first
            from = to;
            to = rings;
            morph = calm ? 1 : 0;
            if (!calm) velocity += 0.5;
        }

        function draw(now) {
            if (!canvas.isConnected) return; // removed from the page: stop
            if (!calm) requestAnimationFrame(draw);
            if (!canvas.offsetParent) { last = now; return; }

            const gap = now - last;
            if (gap < 200) slow = Math.max(0, slow + (gap > 30 ? 1 : -1)); // longer gaps = hidden tab
            if (slow > 45) light = true;
            const dt = Math.min(0.05, gap / 1000);
            last = now;
            const size = canvas.clientWidth;
            const scale = light ? 0.75 : Math.min(1.5, window.devicePixelRatio || 1);
            const pixels = Math.round(size * scale);
            if (canvas.width !== pixels) { canvas.width = pixels; canvas.height = pixels; }

            drawn = Math.min(1, drawn + dt / 1.6);
            morph = Math.min(1, morph + dt / 0.8);
            shake = Math.max(0, shake - dt * 1.6);
            pointer.power = mix(pointer.power, pointer.goal, Math.min(1, dt * 8));
            if (!drag) {
                angle += velocity * dt;
                velocity *= Math.pow(0.35, dt);
            }
            yaw = mix(yaw, pointer.goal ? pointer.x / 900 : 0, Math.min(1, dt * 3));
            pitch = mix(pitch, pointer.goal ? -pointer.y / 900 : 0, Math.min(1, dt * 3));
            waves.forEach((w) => { w.r += dt * 620; });
            waves = waves.filter((w) => w.r < 800);
            if (burst) {
                burst = Math.min(1, burst + dt / 0.7);
                if (burst === 1 && onBurst) { onBurst(); onBurst = null; }
            }

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, pixels, pixels);
            const zoom = (pixels / 1000) * (1 + burst * burst * 3);
            ctx.setTransform(zoom, 0, 0, zoom, pixels / 2, pixels / 2);
            ctx.globalAlpha = 1 - burst;
            ctx.lineWidth = (opt.width * scale) / zoom;
            ctx.strokeStyle = shake > 0.02 ? '#ff8a97' : getComputedStyle(canvas).color;

            ctx.save();
            if (opt.instrument) instrument(ctx, now);
            ctx.restore();

            const fit = opt.instrument ? 0.84 : 0.94;
            const p = ease(morph);
            const until = Math.ceil(STEPS * ease(drawn));
            to.forEach((b, n) => {
                const a = from[n];
                turn[n] += b.spin * dt * opt.speed * (1 + Math.abs(velocity));
                const radius = mix(a.radius, b.radius, p);
                const wave = mix(a.wave, b.wave, p);
                const detail = mix(a.detail, b.detail, p);
                const spin = turn[n] + angle * (n === 1 ? -0.6 : 1);
                // every ring hangs in its own plane and swings slowly, like a gyroscope
                const time = calm ? 0 : now / 1000;
                const tiltX = opt.depth * (0.42 * Math.sin(time * 0.31 + n * 2.1) + pitch);
                const tiltY = opt.depth * (0.42 * Math.cos(time * 0.27 + n * 1.7) + yaw);
                const cx = Math.cos(tiltX);
                const sx = Math.sin(tiltX);
                const cy = Math.cos(tiltY);
                const sy = Math.sin(tiltY);
                ctx.beginPath();
                for (let i = 0; i < b.lines; i++) {
                    const shift = (i / b.lines) * TURN;
                    for (let s = 0; s <= until; s++) {
                        const t = (s / STEPS) * TURN;
                        // both petal counts close the line, so any mix of them closes it too
                        const petal = mix(Math.sin(a.petals * t + shift), Math.sin(b.petals * t + shift), p);
                        const fine = mix(Math.sin(a.petals * 3 * t - shift), Math.sin(b.petals * 3 * t - shift), p);
                        let r = radius + wave * petal + detail * fine;
                        for (const w of waves) {
                            const d = (r - w.r) / 55;
                            r += 42 * Math.exp(-d * d);
                        }
                        if (shake) r += shake * 22 * Math.sin(t * 60 + now / 18 + i);
                        r *= fit;
                        const flatX = r * Math.cos(t + spin);
                        const flatY = r * Math.sin(t + spin);
                        const high = opt.depth * wave * 0.5 * petal;
                        // turn around X, then around Y, then perspective
                        const y1 = flatY * cx - high * sx;
                        const z1 = flatY * sx + high * cx;
                        const near = 1500 / (1500 + z1 * cy - flatX * sy);
                        let x = (flatX * cy + z1 * sy) * near;
                        let y = y1 * near;
                        if (pointer.power > 0.01) {
                            const dx = x - pointer.x;
                            const dy = y - pointer.y;
                            const d2 = dx * dx + dy * dy;
                            if (d2 < 90000) {
                                const push = (pointer.power * 75 * Math.exp(-d2 / 22000)) / (Math.sqrt(d2) + 12);
                                x += dx * push;
                                y += dy * push;
                            }
                        }
                        if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                    }
                }
                ctx.stroke();
            });

            if (light) return;
            // bloom: a tiny copy of the picture, stretched back over it
            const small = Math.max(1, Math.round(pixels / 7));
            if (bloom.width !== small) { bloom.width = small; bloom.height = small; }
            bloomCtx.clearRect(0, 0, small, small);
            bloomCtx.drawImage(canvas, 0, 0, small, small);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.6;
            ctx.drawImage(bloom, 0, 0, pixels, pixels);
            ctx.globalCompositeOperation = 'source-over';
        }

        requestAnimationFrame((now) => { last = now; draw(now); });

        return {
            canvas,
            ripple,
            setText(value) { change(shape(value)); if (calm) requestAnimationFrame(draw); },
            setRings(rings) { from = rings; to = rings; morph = 1; if (calm) requestAnimationFrame(draw); },
            setSpeed(value) { opt.speed = value; },
            setDepth(value) { opt.depth = value; },
            kick() { velocity += 1.2; },
            refuse() { shake = calm ? 0 : 1; },
            // plays the opening animation, then resolves
            admit() {
                if (calm) return Promise.resolve();
                velocity = 5;
                burst = 0.001;
                // the timer is a fallback for a tab in the background, where frames are paused
                return new Promise((done) => { onBurst = done; setTimeout(done, 1000); });
            },
        };
    }

    return { mount, shape, calm };
})();
