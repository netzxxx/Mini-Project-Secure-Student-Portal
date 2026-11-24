(() => {
    if (!Api.token()) {
        window.location.href = '/';
        return;
    }

    const $ = (id) => document.getElementById(id);
    let me = null;

    function flash(message, kind) {
        const f = $('flash');
        f.textContent = message;
        f.className = 'flash ' + (kind || 'ok');
        setTimeout(() => f.classList.add('hidden'), 4000);
    }

    function handleError(err) {
        if (err.status === 401) {
            Api.setToken(null);
            window.location.href = '/';
            return;
        }
        flash(err.status === 403 ? 'Access denied (403).' : 'Error: ' + err.message, 'bad');
    }

    // ---------- tabs ----------
    function showTab(name) {
        document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
        document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('hidden', p.id !== 'tab-' + name));
        loaders[name]().catch(handleError);
    }

    function setupTabs() {
        let first = null;
        document.querySelectorAll('.tab').forEach((tab) => {
            // UI only: tabs for other roles are hidden. The API must enforce roles itself.
            const allowed = tab.dataset.roles.split(' ').includes(me.role);
            tab.classList.toggle('hidden', !allowed);
            if (allowed && !first) first = tab.dataset.tab;
            tab.addEventListener('click', () => showTab(tab.dataset.tab));
        });
        showTab(first);
    }

    // ---------- student: my grades ----------
    async function loadGrades() {
        const grades = await Api.get('/api/students/' + me.id + '/grades');
        const body = $('grades-body');
        body.replaceChildren(...grades.map((g) => el('tr', {},
            el('td', {}, el('strong', {}, g.courseCode), el('br'), el('span', { class: 'muted' }, g.courseTitle)),
            el('td', {}, g.teacherName),
            el('td', {}, g.midterm),
            el('td', {}, g.finalExam),
            el('td', {}, el('strong', {}, g.total)),
            el('td', {}, el('span', { class: 'letter ' + (g.total < 50 ? 'bad' : 'ok') }, g.letter)),
            el('td', { class: 'muted' }, g.teacherComment || '—'))));

        const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g.total, 0) / grades.length) : 0;
        $('grade-stats').replaceChildren(
            el('div', { class: 'stat' }, el('span', {}, 'Courses'), el('strong', {}, grades.length)),
            el('div', { class: 'stat' }, el('span', {}, 'Average total'), el('strong', {}, avg)),
            el('div', { class: 'stat' }, el('span', {}, 'Group'), el('strong', {}, me.groupName || '—')));
    }

    // ---------- teacher/admin: courses ----------
    async function loadCourses() {
        const courses = await Api.get('/api/teacher/courses');
        const list = $('courses-list');
        if (!courses.length) {
            list.replaceChildren(el('p', { class: 'muted' }, 'No courses.'));
            return;
        }
        list.replaceChildren(...courses.map((c) => el('div', { class: 'card' },
            el('h3', {}, c.code + ' · ' + c.title),
            el('p', { class: 'muted' }, 'Teacher: ' + c.teacherName),
            el('div', { class: 'table-wrap' }, el('table', {},
                el('thead', {}, el('tr', {},
                    el('th', {}, 'Student'), el('th', {}, 'Midterm'), el('th', {}, 'Final'),
                    el('th', {}, 'Comment'), el('th', {}, 'Total'), el('th', {}, ''))),
                el('tbody', {}, c.grades.map(gradeRow)))))));
    }

    function gradeRow(g) {
        const mid = el('input', { type: 'number', min: '0', max: '100', value: g.midterm, class: 'num' });
        const fin = el('input', { type: 'number', min: '0', max: '100', value: g.finalExam, class: 'num' });
        const com = el('input', { maxlength: '200', value: g.teacherComment || '' });
        const total = el('td', {}, el('strong', {}, g.total + ' (' + g.letter + ')'));
        const save = el('button', {
            class: 'btn small', type: 'button', onclick: async () => {
                try {
                    const u = await Api.put('/api/grades/' + g.id, {
                        midterm: Number(mid.value), finalExam: Number(fin.value), teacherComment: com.value || null,
                    });
                    total.replaceChildren(el('strong', {}, u.total + ' (' + u.letter + ')'));
                    flash('Grade saved for ' + u.studentName + '.');
                } catch (err) { handleError(err); }
            },
        }, 'Save');
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
    async function loadAdmin() {
        const [users, audit] = await Promise.all([Api.get('/api/admin/users'), Api.get('/api/admin/audit')]);
        $('users-body').replaceChildren(...users.map((u) => {
            const select = el('select', {}, ['STUDENT', 'TEACHER', 'ADMIN'].map((r) => {
                const o = el('option', { value: r }, r);
                if (r === u.role) o.selected = true;
                return o;
            }));
            const save = el('button', {
                class: 'btn small', type: 'button', onclick: async () => {
                    try {
                        await Api.put('/api/admin/users/' + u.id + '/role', { role: select.value });
                        flash('Role of ' + u.username + ' changed to ' + select.value + '.');
                        loadAdmin().catch(handleError);
                    } catch (err) { handleError(err); }
                },
            }, 'Apply');
            return el('tr', {}, el('td', {}, u.id), el('td', {}, u.username), el('td', {}, u.fullName),
                el('td', {}, u.groupName || '—'), el('td', {}, select), el('td', {}, save));
        }));
        $('audit-body').replaceChildren(...audit.map((a) => el('tr', {},
            el('td', {}, new Date(a.timestamp).toLocaleString()),
            el('td', {}, a.username),
            el('td', {}, a.action),
            el('td', {}, el('span', { class: 'outcome ' + a.outcome.toLowerCase() }, a.outcome)),
            el('td', { class: 'muted' }, a.ip))));
    }

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
        try {
            // The UI only sends these three fields. A malicious client can send more.
            await Api.patch('/api/me', {
                fullName: $('p-fullName').value.trim(),
                email: $('p-email').value.trim(),
                phone: $('p-phone').value.trim(),
            });
            flash('Profile saved.');
            await loadProfile();
            $('who-name').textContent = me.fullName;
        } catch (err) { handleError(err); }
    });

    const loaders = { grades: loadGrades, courses: loadCourses, admin: loadAdmin, profile: loadProfile };

    $('logout').addEventListener('click', () => {
        Api.setToken(null);
        window.location.href = '/';
    });

    // ---------- start ----------
    Api.showBuild($('build-badge'));
    Api.get('/api/me').then((user) => {
        me = user;
        $('who-name').textContent = me.fullName;
        $('who-role').textContent = me.role;
        setupTabs();
    }).catch(handleError);
})();
