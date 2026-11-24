(() => {
    const $ = (id) => document.getElementById(id);
    const form = $('login-form');
    const error = $('login-error');
    const user = $('username');
    const pass = $('password');
    const submit = $('login-submit');
    let lockTimer = null;

    Api.showBuild($('build-badge'));
    Pass.render($('pass'), {});

    document.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            user.value = chip.dataset.user;
            pass.value = chip.dataset.pass;
            document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
            Pass.render($('pass'), {
                name: chip.dataset.name, role: chip.dataset.role, meta: chip.dataset.user,
            });
        });
    });

    $('show-password').addEventListener('click', (e) => {
        const show = pass.type === 'password';
        pass.type = show ? 'text' : 'password';
        e.currentTarget.textContent = show ? 'Hide' : 'Show';
        e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });

    function showError(message) {
        error.textContent = message;
        error.classList.remove('hidden');
    }

    // The server locks the username (FIX Test 5) and sends Retry-After; here we only show the time left.
    function showLock(seconds) {
        const until = Date.now() + seconds * 1000;
        const tick = () => {
            const left = Math.ceil((until - Date.now()) / 1000);
            if (left <= 0) {
                clearInterval(lockTimer);
                error.classList.add('hidden');
                return;
            }
            const time = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
            showError('Too many failed attempts. This account unlocks in ' + time + '.');
        };
        tick();
        lockTimer = setInterval(tick, 1000);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearInterval(lockTimer);
        error.classList.add('hidden');
        if (!user.value.trim() || !pass.value) {
            showError('Enter your username and password.');
            return;
        }
        submit.disabled = true;
        submit.textContent = 'Signing in…';
        try {
            const res = await Api.post('/api/auth/login', { username: user.value.trim(), password: pass.value });
            Api.setToken(res.token);
            window.location.href = '/app.html';
        } catch (err) {
            if (err.status === 429 && err.retryAfter) showLock(err.retryAfter);
            else if (err.status === 429) showError('Too many failed attempts. Try again later.');
            else if (err.status === 401 || err.status === 400) showError('Invalid username or password.');
            else showError('The server did not respond. Check that the app is running and try again.');
        } finally {
            submit.disabled = false;
            submit.textContent = 'Sign in';
        }
    });
})();
