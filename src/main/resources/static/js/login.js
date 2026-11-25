(() => {
    const $ = (id) => document.getElementById(id);
    const form = $('login-form');
    const error = $('login-error');
    const user = $('username');
    const pass = $('password');
    const submit = $('login-submit');
    let lockTimer = null;

    Api.showBuild($('build-badge'));

    // The seal and the line under it are drawn from the typed username.
    const seal = Seal.mount($('login-seal'), '', { width: 1, instrument: true });
    Hud.securityStatus($('security-status'));
    const line1 = el('span', {});
    const line2 = el('span', {});
    $('login-mrz').replaceChildren(line1, line2);
    Motion.decode(line2, Pass.mrz(['NARXOZ', 'ACCESS CHECKED BY SERVER']));

    function engrave() {
        const name = user.value.trim().toLowerCase();
        seal.setText(name);
        Motion.decode(line1, Pass.mrz(['PORTAL', name || 'username']));
    }

    let engraveTimer = null;
    engrave();
    pass.addEventListener('input', () => seal.kick());
    user.addEventListener('input', () => {
        clearTimeout(engraveTimer);
        engraveTimer = setTimeout(engrave, 250);
    });

    document.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            user.value = chip.dataset.user;
            pass.value = chip.dataset.pass;
            document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
            engrave();
            seal.ripple();
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
            await seal.admit();
            window.location.href = '/app.html';
        } catch (err) {
            seal.refuse();
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
