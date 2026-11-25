// Control panel layer: security status, target frame and audit radar.
// Everything shown is real: server answers, response headers and the audit log.
const Hud = (() => {
    // ---------- security status: reads the real response headers ----------
    async function securityStatus(target) {
        const start = performance.now();
        let rows;
        try {
            const res = await fetch('/api/info', { cache: 'no-store' });
            const ping = Math.round(performance.now() - start);
            const info = await res.json();
            const header = (name, label) => [label, res.headers.has(name) ? 'active' : 'missing', res.headers.has(name)];
            rows = [
                ['Server', ping + ' ms', true],
                ['Build', info.build, info.build === 'v2-fixed'],
                header('Content-Security-Policy', 'Content policy'),
                header('X-Frame-Options', 'Frame protection'),
                header('X-Content-Type-Options', 'Type protection'),
            ];
        } catch {
            rows = [['Server', 'no answer', false]];
        }
        target.replaceChildren(...rows.map(([label, value, ok]) => el('li', { class: ok ? '' : 'fault' },
            el('span', {}, label), el('strong', {}, value))));
        Motion.rise([...target.children]);
        target.querySelectorAll('strong').forEach((n) => Motion.decode(n, n.textContent));
    }

    // ---------- target frame: flies to the control under the mouse ----------
    function targetFrame() {
        if (Motion.calm || !window.matchMedia('(hover: hover)').matches) return;
        const frame = el('div', { class: 'target', 'aria-hidden': 'true' });
        document.body.append(frame);
        let locked = null;
        const hide = () => { locked = null; frame.classList.remove('on'); };
        document.addEventListener('pointerover', (e) => {
            if (e.pointerType !== 'mouse') return;
            const node = e.target.closest('button, input, select, .course, .team .card');
            if (!node || node.disabled) { hide(); return; }
            if (node === locked) return;
            locked = node;
            const r = node.getBoundingClientRect();
            // set through the DOM API: CSP allows it, it only blocks style attributes in HTML
            frame.style.transform = 'translate(' + (r.left - 6) + 'px,' + (r.top - 6) + 'px)';
            frame.style.width = (r.width + 12) + 'px';
            frame.style.height = (r.height + 12) + 'px';
            frame.classList.add('on');
        });
        window.addEventListener('scroll', hide, { passive: true, capture: true });
        window.addEventListener('hashchange', hide);
    }

    // ---------- audit radar: angle = minute of the hour, distance = user ----------
    function radar(target) {
        const canvas = el('canvas', { class: 'radar', role: 'img', 'aria-label': 'Audit events by minute of the hour and user' });
        const ctx = canvas.getContext('2d');
        target.replaceChildren(canvas);
        let events = [];
        let users = [];

        function draw(now) {
            if (!canvas.isConnected) return;
            if (!Motion.calm) requestAnimationFrame(draw);
            if (!canvas.offsetParent) return;
            const pixels = Math.round(canvas.clientWidth * Math.min(2, window.devicePixelRatio || 1));
            if (canvas.width !== pixels) { canvas.width = pixels; canvas.height = pixels; }
            const look = getComputedStyle(canvas);
            const line = look.color;
            const bad = look.getPropertyValue('--bad').trim();
            ctx.setTransform(pixels / 400, 0, 0, pixels / 400, pixels / 2, pixels / 2);
            ctx.clearRect(-200, -200, 400, 400);
            ctx.strokeStyle = line;
            ctx.fillStyle = line;
            ctx.globalAlpha = 0.35;
            [50, 100, 150].forEach((r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); });
            for (let m = 0; m < 60; m++) {
                const a = (m / 60) * Math.PI * 2;
                const from = m % 5 ? 171 : 164;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * from, Math.sin(a) * from);
                ctx.lineTo(Math.cos(a) * 176, Math.sin(a) * 176);
                ctx.stroke();
            }
            ctx.globalAlpha = 0.85;
            ctx.font = '13px Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            [['00', 0, -189], ['15', 189, 0], ['30', 0, 189], ['45', -189, 0]].forEach(([t, x, y]) => ctx.fillText(t, x, y));

            const sweep = (now / 2600) * Math.PI * 2;
            if (!Motion.calm) {
                for (let i = 0; i < 24; i++) {
                    ctx.globalAlpha = 0.16 * (1 - i / 24);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.arc(0, 0, 160, sweep - (i + 1) * 0.04, sweep - i * 0.04);
                    ctx.fill();
                }
            }
            events.forEach((e) => {
                const t = new Date(e.timestamp);
                const a = ((t.getMinutes() + t.getSeconds() / 60) / 60) * Math.PI * 2 - Math.PI / 2;
                const r = 30 + (users.indexOf(e.username) / Math.max(1, users.length - 1)) * 120;
                // a mark flashes when the beam passes it
                const behind = Motion.calm ? 0 : (((sweep - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                const ok = e.outcome === 'SUCCESS';
                ctx.fillStyle = ok ? line : bad;
                ctx.globalAlpha = 0.45 + 0.55 * Math.exp(-behind);
                ctx.beginPath();
                ctx.arc(Math.cos(a) * r, Math.sin(a) * r, (ok ? 3 : 5) + 4 * Math.exp(-behind * 2), 0, 7);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
        }
        requestAnimationFrame(draw);

        return {
            update(list) {
                events = list;
                users = [...new Set(list.map((e) => e.username))].sort();
                if (Motion.calm) requestAnimationFrame(draw);
            },
        };
    }

    targetFrame();

    return { securityStatus, radar };
})();
