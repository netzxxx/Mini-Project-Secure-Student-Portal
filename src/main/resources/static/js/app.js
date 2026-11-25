(() => {
    if (!Api.token()) {
        window.location.href = '/';
        return;
    }

    const $ = (id) => document.getElementById(id);
    let me = null;

    let flashTimer = null;

    function flash(message, kind) {
        const f = $('flash');
        f.textContent = message;
        f.className = 'flash ' + (kind || 'ok');
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => f.classList.add('hidden'), 4000);
    }

    function handleError(err) {
        if (err.status === 401) {
            Api.setToken(null);
            window.location.href = '/';
            return;
        }
        flash(err.status === 403 ? 'Access denied (403). The server refused this request.' : 'Error: ' + err.message, 'bad');
    }

    // ---------- tabs ----------
    function allowedTabs() {
        // UI only: tabs for other roles are hidden. The API must enforce roles itself.
        return [...document.querySelectorAll('.tab')].filter((t) => t.dataset.roles.split(' ').includes(me.role));
    }

    function showTab(name) {
        document.querySelectorAll('.tab').forEach((t) => {
            t.classList.toggle('active', t.dataset.tab === name);
            if (t.dataset.tab === name) t.setAttribute('aria-current', 'page');
            else t.removeAttribute('aria-current');
        });
        document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('hidden', p.id !== 'tab-' + name));
        // working screens get the full height
        $('pass').classList.toggle('hidden', ['admin', 'access', 'reactor', 'about'].includes(name));
        const open = $('tab-' + name);
        Motion.rise([...open.children].filter((n) => n.id !== 'contact-card'));
        loaders[name]().catch(handleError);
    }

    // The open tab lives in the URL hash, so reload and Back work.
    function openFromHash() {
        const names = allowedTabs().map((t) => t.dataset.tab);
        const wanted = window.location.hash.slice(1);
        showTab(names.includes(wanted) ? wanted : names[0]);
    }

    function setupTabs() {
        allowedTabs().forEach((tab) => {
            tab.classList.remove('hidden');
            tab.addEventListener('click', () => {
                if (window.location.hash === '#' + tab.dataset.tab) showTab(tab.dataset.tab);
                else window.location.hash = tab.dataset.tab;
            });
        });
        window.addEventListener('hashchange', openFromHash);
        openFromHash();
    }

    // ---------- campus pass ----------
    const sessionLeft = el('strong', {}, '');

    function renderPass() {
        Pass.render($('pass'), {
            name: me.fullName,
            role: me.role,
            username: me.username,
            group: me.groupName,
            id: me.id,
            footer: sessionLeft,
        });
    }

    function startSessionClock() {
        const exp = Api.claims().exp;
        if (!exp) { sessionLeft.textContent = '—'; return; }
        const tick = () => {
            const left = Math.max(0, Math.floor(exp - Date.now() / 1000));
            sessionLeft.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
            if (left === 0) signOut();
        };
        tick();
        setInterval(tick, 1000);
    }

    function signOut() {
        Api.setToken(null);
        window.location.href = '/';
    }

    // ---------- student: my grades ----------
    // Bars are SVG: width is an attribute there, so no inline style is needed (CSP).
    function bar(label, value) {
        return el('div', { class: 'bar' }, el('span', {}, label),
            Pass.svg('svg', { class: 'bar-track', viewBox: '0 0 100 6', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
                Pass.svg('rect', { width: 100, height: 6, class: 'bar-bg' }),
                Pass.svg('rect', { width: value, height: 6, class: value < 50 ? 'bar-fill low' : 'bar-fill' })),
            el('strong', {}, value));
    }

    // Two arcs: outer = midterm, inner = final. Lengths are SVG attributes, so CSP is fine.
    function gauge(g) {
        const arc = (r, value, name) => Pass.svg('circle', {
            cx: 60, cy: 60, r, pathLength: 100, 'stroke-dasharray': value + ' 100', class: 'arc ' + name,
            transform: 'rotate(-90 60 60)',
        });
        const letter = Pass.svg('text', { x: 60, y: 59, class: 'gauge-letter' }, g.letter);
        const total = Pass.svg('text', { x: 60, y: 80, class: 'gauge-total' }, g.total + ' / 100');
        return Pass.svg('svg', {
            viewBox: '0 0 120 120', class: g.total < 50 ? 'gauge bad' : 'gauge', role: 'img',
            'aria-label': 'Grade ' + g.letter + ', ' + g.total + ' of 100',
        }, Pass.svg('circle', { cx: 60, cy: 60, r: 57, pathLength: 120, class: 'scale' }),
        arc(49, g.midterm, 'outer'), arc(41, g.finalExam, 'inner'), letter, total);
    }

    async function loadGrades() {
        const grades = await Api.get('/api/students/' + me.id + '/grades');
        if (!grades.length) {
            $('grade-stats').replaceChildren();
            $('grades-body').replaceChildren(el('p', { class: 'muted' }, 'No grades yet. They appear here once a teacher saves them.'));
            return;
        }
        $('grades-body').replaceChildren(...grades.map((g) => el('article', { class: 'course' },
            el('div', {}, el('p', { class: 'code' }, g.courseCode), el('h2', {}, g.courseTitle),
                el('p', { class: 'muted' }, g.teacherName),
                g.teacherComment ? el('p', { class: 'comment' }, g.teacherComment) : null),
            el('div', { class: 'course-bars' }, bar('Midterm', g.midterm), bar('Final', g.finalExam)),
            gauge(g))));

        Motion.rise([...$('grades-body').children]);
        $('grades-body').querySelectorAll('.bar-fill').forEach((b, i) => Motion.grow(b, 200 + i * 60));
        if (!Motion.calm) {
            $('grades-body').querySelectorAll('.arc').forEach((a, i) => {
                const length = parseFloat(a.getAttribute('stroke-dasharray'));
                a.animate({ strokeDashoffset: [length, 0] }, { duration: 1300, delay: 150 + i * 90, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards' });
            });
        }

        const avg = Math.round(grades.reduce((s, g) => s + g.total, 0) / grades.length);
        const best = grades.reduce((a, b) => (b.total > a.total ? b : a));
        $('grade-stats').replaceChildren(
            fact('Average', avg + ' / 100'),
            fact('Courses', grades.length),
            fact('Passed', grades.filter((g) => g.total >= 50).length + ' of ' + grades.length),
            fact('Best course', best.courseCode));
        Motion.count($('grade-stats').querySelector('strong'), avg, ' / 100');
    }

    function fact(label, value) {
        return el('div', {}, el('span', {}, label), el('strong', {}, value));
    }

    // ---------- teacher/admin: courses ----------
    async function loadCourses() {
        const courses = await Api.get('/api/teacher/courses');
        const list = $('courses-list');
        if (!courses.length) {
            list.replaceChildren(el('p', { class: 'muted' }, 'No courses are assigned to you.'));
            return;
        }
        list.replaceChildren(...courses.map((c) => el('div', { class: 'card' },
            el('p', { class: 'code' }, c.code), el('h2', {}, c.title),
            el('p', { class: 'muted' }, c.teacherName + ' · ' + c.grades.length + (c.grades.length === 1 ? ' student' : ' students')),
            el('div', { class: 'table-wrap' }, el('table', {},
                el('thead', {}, el('tr', {},
                    el('th', {}, 'Student'), el('th', {}, 'Midterm'), el('th', {}, 'Final'),
                    el('th', {}, 'Comment'), el('th', {}, 'Total'), el('th', {}, ''))),
                el('tbody', {}, c.grades.map(gradeRow)))))));
    }

    function gradeRow(g) {
        const mid = el('input', { type: 'number', min: '0', max: '100', value: g.midterm, class: 'num', 'aria-label': 'Midterm, ' + g.studentName });
        const fin = el('input', { type: 'number', min: '0', max: '100', value: g.finalExam, class: 'num', 'aria-label': 'Final, ' + g.studentName });
        const com = el('input', { maxlength: '200', class: 'comment-input', value: g.teacherComment || '', 'aria-label': 'Comment, ' + g.studentName });
        const total = el('td', {}, el('strong', {}, g.total + ' (' + g.letter + ')'));
        const save = el('button', {
            class: 'btn small', type: 'button', onclick: async () => {
                // quick feedback; the server validates the range again
                if (![mid, fin].every((i) => i.value !== '' && i.checkValidity())) {
                    flash('Midterm and final must be whole numbers from 0 to 100.', 'bad');
                    return;
                }
                try {
                    const u = await Api.put('/api/grades/' + g.id, {
                        midterm: Number(mid.value), finalExam: Number(fin.value), teacherComment: com.value || null,
                    });
                    total.replaceChildren(el('strong', {}, u.total + ' (' + u.letter + ')'));
                    save.classList.remove('primary');
                    flash('Grade saved for ' + u.studentName + '.');
                } catch (err) { handleError(err); }
            },
        }, 'Save');
        // highlight Save while the row has unsaved edits
        [mid, fin, com].forEach((i) => i.addEventListener('input', () => save.classList.add('primary')));
        const name = el('button', { class: 'link', type: 'button', onclick: () => showContact(g.studentId) }, g.studentName);
        return el('tr', {}, el('td', {}, name), el('td', {}, mid), el('td', {}, fin), el('td', {}, com), total, el('td', {}, save));
    }

    async function showContact(userId) {
        try {
            const u = await Api.get('/api/users/' + userId);
            const card = $('contact-card');
            card.replaceChildren(
                el('h3', {}, u.fullName),
                el('p', {}, 'Email: ' + (u.email || '—')),
                el('p', {}, 'Group: ' + (u.groupName || '—')),
                el('button', { class: 'btn ghost small', type: 'button', onclick: () => card.classList.add('hidden') }, 'Close'));
            card.classList.remove('hidden');
        } catch (err) { handleError(err); }
    }

    // ---------- admin ----------
    let allUsers = [];
    let allAudit = [];
    let auditFilter = 'ALL';

    const radar = Hud.radar($('radar'));
    let seenDenied = null; // time of the newest refused request already shown

    function renderMonitor() {
        radar.update(allAudit);
        const refused = allAudit.filter((a) => a.outcome !== 'SUCCESS');
        const last = refused.reduce((m, a) => (!m || a.timestamp > m.timestamp ? a : m), null);
        $('audit-totals').replaceChildren(
            el('div', {}, el('dt', {}, 'Allowed'), el('dd', {}, allAudit.length - refused.length)),
            el('div', { class: refused.length ? 'fault' : '' }, el('dt', {}, 'Refused'), el('dd', {}, refused.length)),
            el('div', {}, el('dt', {}, 'Last refused'), el('dd', { class: 'last' }, last ? last.username + ', ' + last.action : 'None')));
        const newest = last ? last.timestamp : '';
        if (seenDenied !== null && newest > seenDenied) {
            flash('Refused: ' + last.username + ', ' + last.action, 'bad');
            Motion.alarm($('radar'));
        }
        seenDenied = newest;
    }

    // While the Admin tab is open the log refreshes itself, so an attack shows up live.
    setInterval(async () => {
        if (!me || me.role !== 'ADMIN' || document.hidden || $('tab-admin').classList.contains('hidden')) return;
        try {
            const fresh = await Api.get('/api/admin/audit');
            if (JSON.stringify(fresh) === JSON.stringify(allAudit)) return;
            allAudit = fresh;
            renderAudit();
            renderMonitor();
        } catch (err) { handleError(err); }
    }, 4000);

    async function loadAdmin() {
        [allUsers, allAudit] = await Promise.all([Api.get('/api/admin/users'), Api.get('/api/admin/audit')]);
        renderUsers();
        renderAudit();
        renderMonitor();
    }

    function renderUsers() {
        const q = $('user-search').value.trim().toLowerCase();
        const shown = allUsers.filter((u) => [u.username, u.fullName, u.groupName].join(' ').toLowerCase().includes(q));
        $('users-body').replaceChildren(...(shown.length ? shown.map(userRow)
            : [el('tr', {}, el('td', { colspan: '6', class: 'muted' }, 'No users match this search.'))]));
    }

    function userRow(u) {
        const select = el('select', { 'aria-label': 'Role of ' + u.username }, ['STUDENT', 'TEACHER', 'ADMIN'].map((r) => {
            const o = el('option', { value: r }, r);
            if (r === u.role) o.selected = true;
            return o;
        }));
        const save = el('button', {
            class: 'btn small', type: 'button', disabled: '', onclick: async () => {
                if (!window.confirm('Change role of ' + u.username + ' from ' + u.role + ' to ' + select.value + '?')) return;
                try {
                    await Api.put('/api/admin/users/' + u.id + '/role', { role: select.value });
                    flash('Role of ' + u.username + ' changed to ' + select.value + '.');
                    loadAdmin().catch(handleError);
                } catch (err) { handleError(err); }
            },
        }, 'Change role');
        select.addEventListener('change', () => { save.disabled = select.value === u.role; });
        return el('tr', {}, el('td', {}, u.id), el('td', { class: 'mono' }, u.username), el('td', {}, u.fullName),
            el('td', {}, u.groupName || '—'), el('td', {}, select), el('td', {}, save));
    }

    function renderAudit() {
        const outcomes = ['ALL', ...new Set(allAudit.map((a) => a.outcome))];
        if (!outcomes.includes(auditFilter)) auditFilter = 'ALL';
        const match = (o) => allAudit.filter((a) => o === 'ALL' || a.outcome === o);
        $('audit-filters').replaceChildren(...outcomes.map((o) => el('button', {
            class: 'chip', type: 'button', 'aria-pressed': String(o === auditFilter),
            onclick: () => { auditFilter = o; renderAudit(); },
        }, (o === 'ALL' ? 'All' : o[0] + o.slice(1).toLowerCase()) + ' ' + match(o).length)));
        $('audit-body').replaceChildren(...match(auditFilter).map((a) => el('tr', {},
            el('td', {}, new Date(a.timestamp).toLocaleString('en-GB')),
            el('td', { class: 'mono' }, a.username),
            el('td', { class: 'mono' }, a.action),
            el('td', {}, el('span', { class: 'outcome ' + a.outcome.toLowerCase() }, a.outcome)),
            el('td', { class: 'muted' }, a.ip))));
    }

    $('user-search').addEventListener('input', renderUsers);

    // ---------- access check (read-only GET requests, own token) ----------
    function checks() {
        const role = me.role;
        const other = me.id === 4 ? 5 : 4; // seeded students have ids 4, 5, 6
        const list = [{ path: '/api/me', what: 'Own profile', allowed: true }];
        if (role === 'STUDENT') list.push({ path: '/api/students/' + me.id + '/grades', what: 'Own grades', allowed: true });
        // a teacher may read students of their own courses, so for teachers the answer depends on the data
        if (role !== 'TEACHER') {
            list.push({ path: '/api/students/' + other + '/grades', what: 'Grades of another student (T1)', allowed: role === 'ADMIN' });
        }
        list.push(
            { path: '/api/teacher/courses', what: 'Course gradebooks', allowed: role !== 'STUDENT' },
            { path: '/api/admin/users', what: 'All users (T2)', allowed: role === 'ADMIN' },
            { path: '/api/admin/audit', what: 'Audit log (T2)', allowed: role === 'ADMIN' });
        return list.map((c) => ({ ...c, expected: c.allowed ? 200 : 403, status: null }));
    }

    async function loadChecks() {
        renderChecks(checks());
        $('checks-result').textContent = '';
    }

    function renderChecks(rows) {
        $('checks-body').replaceChildren(...rows.map((c) => {
            const ok = c.status === c.expected;
            const words = { 200: 'Admitted', 403: 'Refused' };
            const answer = c.status === null ? el('span', { class: 'muted' }, 'Not sent')
                : el('span', { class: 'stamp wide' + (c.fresh ? ' fresh' : '') + (c.status === 403 ? ' bad' : '') },
                    el('span', {}, c.status), el('span', {}, words[c.status] || 'Error'));
            const verdict = c.status === null ? '' : (ok ? 'As expected' : 'Not as expected');
            return el('tr', {}, el('td', { class: 'mono' }, 'GET ' + c.path), el('td', {}, c.what),
                el('td', {}, c.expected), el('td', {}, answer),
                el('td', { class: ok ? 'muted' : 'outcome denied' }, verdict));
        }));
    }

    // Draws one request on the route: 401 stops at the JWT check, other refusals at the access rules.
    async function travel(status) {
        if (Motion.calm) return;
        const stations = [...document.querySelectorAll('.station')];
        const stop = status === 200 ? 3 : (status === 401 ? 1 : 2);
        const at = (i) => ((i + 0.5) * 25) + '%';
        const dot = el('span', { class: 'request' });
        $('route').append(dot);
        await Promise.race([Motion.wait(900), dot.animate({ left: [at(0), at(stop)] }, { duration: stop * 170, easing: 'ease-in', fill: 'forwards' }).finished]);
        dot.classList.add(status === 200 ? 'ok' : 'no');
        stations[stop].animate({ transform: ['scale(1)', 'scale(1.18)', 'scale(1)'] }, { duration: 260 });
        await Motion.wait(160);
        dot.animate({ left: [at(stop), at(0)], opacity: [1, 0] }, { duration: 320, easing: 'ease-out', fill: 'forwards' });
        await Motion.wait(240);
        dot.remove();
    }

    $('run-checks').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        button.disabled = true;
        try {
            // one request after another, so every answer can be seen on the route
            const rows = checks();
            for (const c of rows) {
                c.status = await Api.probe(c.path);
                await travel(c.status);
                c.fresh = true;
                renderChecks(rows);
                document.querySelectorAll('.stamp.fresh').forEach((s) => Motion.stamp(s));
                c.fresh = false;
            }
            const wrong = rows.filter((c) => c.status !== c.expected).length;
            $('checks-result').textContent = wrong
                ? wrong + ' of ' + rows.length + ' answers differ from the access rules.'
                : 'All ' + rows.length + ' answers match the access rules for ' + me.role + '.';
        } catch (err) { handleError(err); } finally { button.disabled = false; }
    });

    // ---------- profile ----------
    async function loadProfile() {
        me = await Api.get('/api/me');
        $('profile-facts').replaceChildren(
            el('dt', {}, 'Username'), el('dd', {}, me.username),
            el('dt', {}, 'Role'), el('dd', {}, me.role),
            el('dt', {}, 'Group'), el('dd', {}, me.groupName || '—'));
        $('p-fullName').value = me.fullName || '';
        $('p-email').value = me.email || '';
        $('p-phone').value = me.phone || '';
    }

    $('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!$('p-fullName').value.trim() || !$('p-email').checkValidity()) {
            flash('Enter your full name and a valid email.', 'bad');
            return;
        }
        try {
            // The UI only sends these three fields. A malicious client can send more.
            await Api.patch('/api/me', {
                fullName: $('p-fullName').value.trim(),
                email: $('p-email').value.trim(),
                phone: $('p-phone').value.trim(),
            });
            flash('Profile saved.');
            await loadProfile();
            renderPass();
        } catch (err) { handleError(err); }
    });

    const loaders = {
        grades: loadGrades, courses: loadCourses, admin: loadAdmin, profile: loadProfile,
        access: loadChecks, reactor: async () => Lab.open(me.username), about: async () => {},
    };

    $('logout').addEventListener('click', signOut);

    // ---------- start ----------
    Api.showBuild($('build-badge'));
    Api.get('/api/me').then((user) => {
        me = user;
        renderPass();
        Motion.tilt($('pass'));
        startSessionClock();
        setupTabs();
    }).catch(handleError);
})();
