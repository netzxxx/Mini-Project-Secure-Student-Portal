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
            meta: [me.username, me.groupName, 'ID ' + me.id].filter(Boolean).join(' · '),
            footer: el('p', { class: 'pass-session' }, 'Session ends in ', sessionLeft),
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

    async function loadGrades() {
        const grades = await Api.get('/api/students/' + me.id + '/grades');
        if (!grades.length) {
            $('grade-stats').replaceChildren();
            $('grades-body').replaceChildren(el('p', { class: 'muted' }, 'No grades yet. They appear here once a teacher saves them.'));
            return;
        }
        $('grades-body').replaceChildren(...grades.map((g) => el('article', { class: 'card course' },
            el('header', { class: 'course-head' },
                el('div', {}, el('p', { class: 'code' }, g.courseCode), el('h2', {}, g.courseTitle),
                    el('p', { class: 'muted' }, g.teacherName)),
                el('p', { class: 'mark ' + (g.total < 50 ? 'bad' : '') }, g.letter, el('small', {}, g.total + ' / 100'))),
            bar('Midterm', g.midterm),
            bar('Final', g.finalExam),
            g.teacherComment ? el('p', { class: 'comment' }, g.teacherComment) : null)));

        const avg = Math.round(grades.reduce((s, g) => s + g.total, 0) / grades.length);
        const best = grades.reduce((a, b) => (b.total > a.total ? b : a));
        $('grade-stats').replaceChildren(
            fact('Average', avg + ' / 100'),
            fact('Courses', grades.length),
            fact('Passed', grades.filter((g) => g.total >= 50).length + ' of ' + grades.length),
            fact('Best course', best.courseCode));
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

    async function loadAdmin() {
        [allUsers, allAudit] = await Promise.all([Api.get('/api/admin/users'), Api.get('/api/admin/audit')]);
        renderUsers();
        renderAudit();
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
            const answer = c.status === null ? el('span', { class: 'muted' }, 'Not sent')
                : el('span', { class: 'outcome ' + (ok ? 'success' : 'denied') },
                    c.status + (ok ? ' as expected' : ' unexpected'));
            return el('tr', {}, el('td', { class: 'mono' }, 'GET ' + c.path), el('td', {}, c.what),
                el('td', {}, c.allowed ? '200 allow' : '403 refuse'), el('td', {}, answer));
        }));
    }

    $('run-checks').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        button.disabled = true;
        try {
            const rows = await Promise.all(checks().map(async (c) => ({ ...c, status: await Api.probe(c.path) })));
            renderChecks(rows);
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
        access: loadChecks, about: async () => {},
    };

    $('logout').addEventListener('click', signOut);

    // ---------- start ----------
    Api.showBuild($('build-badge'));
    Api.get('/api/me').then((user) => {
        me = user;
        // Accent colour follows the role, so it is obvious whose session is on screen.
        document.body.classList.add('role-' + me.role.toLowerCase());
        renderPass();
        startSessionClock();
        setupTabs();
    }).catch(handleError);
})();
