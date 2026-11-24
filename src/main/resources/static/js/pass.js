// The campus pass: shows which areas a role can open. Used on the login page and in the app.
// It only DISPLAYS access. The decision is always made by the server.
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

    function lock(open) {
        return svg('svg', { viewBox: '0 0 20 20', class: 'lock', 'aria-hidden': 'true' },
            svg('path', { d: open ? 'M6 9V6a4 4 0 0 1 7.5-2' : 'M6 9V6a4 4 0 0 1 8 0v3', class: 'lock-arc' }),
            svg('rect', { x: 3.5, y: 9, width: 13, height: 9, rx: 2.5, class: 'lock-body' }));
    }

    function initials(name) {
        return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
    }

    // info: { name, role, meta, footer } - without a role the pass is blank and everything is locked
    function render(target, info) {
        const role = info.role || '';
        target.className = 'pass ' + (role ? 'role-' + role.toLowerCase() : 'role-none');
        target.replaceChildren(
            el('div', { class: 'pass-top' },
                el('span', { class: 'pass-slot', 'aria-hidden': 'true' }),
                el('span', { class: 'pass-initials', 'aria-hidden': 'true' }, role ? initials(info.name) : '?'),
                el('span', { class: 'pass-role' }, role ? role[0] + role.slice(1).toLowerCase() : 'No access yet')),
            el('div', { class: 'pass-main' },
                el('p', { class: 'pass-name' }, info.name || 'Campus pass'),
                el('p', { class: 'pass-meta' }, info.meta || 'Pick an account to see what it opens'),
                el('ul', { class: 'doors' }, AREAS.map((a) => {
                    const open = a.roles.includes(role);
                    return el('li', { class: open ? 'door open' : 'door' }, lock(open), el('span', {}, a.name),
                        el('span', { class: 'door-state' }, open ? 'Open' : 'Locked'));
                })),
                info.footer || null));
    }

    return { render, svg };
})();
