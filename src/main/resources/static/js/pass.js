// The student document: an engraved seal (guilloche, like on diplomas and banknotes), the holder's
// data and a machine-readable line. It only DISPLAYS access. The decision is made by the server.
const Pass = (() => {
    const AREAS = [
        { name: 'Own grades', roles: ['STUDENT'] },
        { name: 'Course gradebooks', roles: ['TEACHER', 'ADMIN'] },
        { name: 'Users and audit log', roles: ['ADMIN'] },
        { name: 'Own profile', roles: ['STUDENT', 'TEACHER', 'ADMIN'] },
    ];
    const SVG = 'http://www.w3.org/2000/svg';
    const TURN = Math.PI * 2;

    function svg(tag, attrs, ...children) {
        const node = document.createElementNS(SVG, tag);
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
        node.append(...children);
        return node;
    }

    // ---------- seal ----------
    // Small seeded generator: the same text always gives the same seal. Decoration, not cryptography.
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

    // One ring = several closed waves, each shifted a little. Their crossings make the engraved lace.
    function ring(radius, wave, petals, lines, detail) {
        let d = '';
        for (let i = 0; i < lines; i++) {
            const shift = (i / lines) * TURN;
            for (let a = 0; a <= 360; a++) {
                const t = (a / 360) * TURN;
                const r = radius + wave * Math.sin(petals * t + shift) + detail * Math.sin(petals * 3 * t - shift);
                d += (a ? 'L' : 'M') + (r * Math.cos(t)).toFixed(1) + ' ' + (r * Math.sin(t)).toFixed(1);
            }
            d += 'Z';
        }
        return svg('path', { d, pathLength: 1, class: 'engraved' });
    }

    function seal(text) {
        const next = random(text || 'student portal');
        const pick = (min, max) => min + Math.floor(next() * (max - min + 1));
        return svg('svg', { viewBox: '-500 -500 1000 1000', class: 'seal', 'aria-hidden': 'true' },
            ring(405, 50 + next() * 32, pick(9, 18), 12, 6),
            ring(245, 75 + next() * 45, pick(5, 9), 14, 8 + next() * 14),
            ring(95, 35 + next() * 25, pick(3, 8), 10, 4));
    }

    // ---------- machine-readable line ----------
    function mrz(parts) {
        const line = parts.filter(Boolean).join('<<').toUpperCase().replace(/[^A-Z0-9<]/g, '<');
        return line.slice(0, 44).padEnd(44, '<');
    }

    // info: { username, name, role, group, id, footer }
    function render(target, info) {
        const field = (label, value) => el('div', {}, el('dt', {}, label), el('dd', {}, value));
        target.className = 'pass';
        target.replaceChildren(
            el('div', { class: 'pass-seal' }, seal(info.username)),
            el('div', { class: 'pass-data' },
                el('p', { class: 'pass-role' }, info.role[0] + info.role.slice(1).toLowerCase()),
                el('p', { class: 'pass-name' }, info.name),
                el('dl', { class: 'pass-fields' },
                    field('Username', info.username),
                    info.group ? field('Group', info.group) : null,
                    field('Document no.', String(info.id).padStart(6, '0')),
                    field('Session ends in', info.footer))),
            el('ul', { class: 'doors', 'aria-label': 'Access of this role' }, AREAS.map((a) => {
                const open = a.roles.includes(info.role);
                return el('li', { class: open ? 'door open' : 'door' }, el('span', {}, a.name),
                    el('span', { class: 'door-state' }, open ? 'Admitted' : 'No entry'));
            })),
            el('p', { class: 'mrz', 'aria-hidden': 'true' },
                el('span', {}, mrz([info.role, info.name])),
                el('span', {}, mrz([info.username, info.group, String(info.id).padStart(6, '0')]))));
    }

    return { render, seal, mrz, svg };
})();
