(() => {
    const form = document.getElementById('login-form');
    const error = document.getElementById('login-error');
    const user = document.getElementById('username');
    const pass = document.getElementById('password');

    Api.showBuild(document.getElementById('build-badge'));

    document.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            user.value = chip.dataset.user;
            pass.value = chip.dataset.pass;
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        error.classList.add('hidden');
        try {
            const res = await Api.post('/api/auth/login', { username: user.value.trim(), password: pass.value });
            Api.setToken(res.token);
            window.location.href = '/app.html';
        } catch (err) {
            error.textContent = err.status === 429
                ? 'Too many failed attempts. Try again later.'
                : 'Invalid username or password.';
            error.classList.remove('hidden');
        }
    });
})();
