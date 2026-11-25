// Page effects. They use the Web Animations API, so no style attributes are written (CSP).
// With "reduce motion" switched on in the system every effect is skipped.
const Motion = (() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));

    // Letters spin until they settle on the text, like a departure board.
    function decode(node, text) {
        if (calm) { node.textContent = text; return; }
        const start = performance.now();
        const run = {};
        node.decodeRun = run;
        const frame = (now) => {
            if (node.decodeRun !== run) return; // a newer text has started
            const settled = (now - start) / 16;
            node.textContent = [...text].map((c, i) =>
                (i < settled || c === ' ' ? c : LETTERS[Math.floor(Math.random() * LETTERS.length)])).join('');
            if (settled < text.length) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    // Number counts up from 0.
    function count(node, value, suffix) {
        const end = value + (suffix || '');
        node.textContent = end;
        if (calm) return;
        const start = performance.now();
        const frame = (now) => {
            const p = Math.min(1, (now - start) / 900);
            node.textContent = p < 1 ? Math.round(value * (1 - Math.pow(1 - p, 3))) + (suffix || '') : end;
            if (p < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    // The document leans towards the pointer.
    function tilt(node) {
        if (calm || !window.matchMedia('(hover: hover)').matches) return;
        let current = null;
        const lean = (transform) => {
            const next = node.animate({ transform }, { duration: 260, easing: 'ease-out', fill: 'forwards' });
            if (current) next.finished.then(((old) => () => old.cancel())(current)).catch(() => {});
            current = next;
        };
        node.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            const r = node.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            lean('perspective(1100px) rotateX(' + (-y * 7).toFixed(2) + 'deg) rotateY(' + (x * 7).toFixed(2) + 'deg)');
        });
        node.addEventListener('pointerleave', () => lean('perspective(1100px) rotateX(0deg) rotateY(0deg)'));
    }

    // Rubber stamp comes down; used for grades and access answers.
    function stamp(node, delay) {
        if (calm) return;
        const rest = getComputedStyle(node).transform;
        const base = rest === 'none' ? '' : rest;
        node.animate([
            { opacity: 0, transform: base + ' scale(2.4) rotate(14deg)' },
            { opacity: 1, transform: base + ' scale(.9)', offset: 0.7 },
            { opacity: 1, transform: base || 'none' },
        ], { duration: 380, delay: delay || 0, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'backwards' });
    }

    function alarm(node) {
        if (calm) return;
        node.animate({ transform: ['scale(1)', 'scale(1.06)', 'scale(1)'], filter: ['none', 'brightness(1.8)', 'none'] }, { duration: 500, iterations: 2 });
    }

    function rise(nodes) {
        if (calm) return;
        nodes.forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }],
            { duration: 420, delay: i * 70, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'backwards' }));
    }

    function grow(node, delay) {
        if (calm) return;
        node.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
            { duration: 800, delay, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards' });
    }

    // New theme spreads as a circle from the button. Browsers without view transitions just switch.
    function reveal(origin, apply) {
        if (calm || !document.startViewTransition) { apply(); return; }
        const r = origin.getBoundingClientRect();
        const at = 'at ' + (r.left + r.width / 2) + 'px ' + (r.top + r.height / 2) + 'px)';
        const far = Math.hypot(window.innerWidth, window.innerHeight);
        document.startViewTransition(apply).ready.then(() => {
            document.documentElement.animate(
                { clipPath: ['circle(0px ' + at, 'circle(' + far + 'px ' + at] },
                { duration: 650, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' });
        }).catch(() => {});
    }

    return { calm, wait, decode, count, tilt, stamp, alarm, rise, grow, reveal };
})();
