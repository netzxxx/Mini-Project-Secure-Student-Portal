// The student document: a reactor core with the holder's own rod pattern, the holder's
// data and a machine-readable line. It only DISPLAYS access. The decision is made by the server.
const Pass = (() => {
    const AREAS = [
        { name: 'Own grades', roles: ['STUDENT'] },
        { name: 'Course gradebooks', roles: ['TEACHER', 'ADMIN'] },
        { name: 'Users and audit log', roles: ['ADMIN'] },
        { name: 'Own profile', roles: ['STUDENT', 'TEACHER', 'ADMIN'] },
    ];
    const SVG = 'http://www.w3.org/2000/svg';
    function svg(tag, attrs, ...children) {
        const node = document.createElementNS(SVG, tag);
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
        node.append(...children);
        return node;
    }

    // ---------- machine-readable line ----------
    function mrz(parts) {
        const line = parts.filter(Boolean).join('<<').toUpperCase().replace(/[^A-Z0-9<]/g, '<');
        return line.slice(0, 44).padEnd(44, '<');
    }

    // info: { username, name, role, group, id, footer }
    function render(target, info) {
        const reactorBox = el('div', { class: 'pass-reactor' });
        const line1 = el('span', {});
        const line2 = el('span', {});
        const field = (label, value) => el('div', {}, el('dt', {}, label), el('dd', {}, value));
        target.className = 'pass';
        target.replaceChildren(
            reactorBox,
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
                line1, line2));
        Reactor.mount(reactorBox, info.username, { scale: 1.15 });
        Motion.decode(line1, mrz([info.role, info.name]));
        Motion.decode(line2, mrz([info.username, info.group, String(info.id).padStart(6, '0')]));
    }

    return { render, mrz, svg };
})();
