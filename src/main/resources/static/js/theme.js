// Loaded in <head> without defer, so the saved theme is applied before the first paint.
// Only the theme name is kept in localStorage; nothing sensitive.
(() => {
    const KEY = 'portal.theme';
    const root = document.documentElement;

    function saved() {
        try { return localStorage.getItem(KEY); } catch { return null; }
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const stored = saved();
    root.dataset.theme = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light');

    document.addEventListener('DOMContentLoaded', () => {
        const button = document.getElementById('theme-toggle');
        const label = () => {
            button.textContent = root.dataset.theme === 'dark' ? 'Light theme' : 'Dark theme';
        };
        label();
        button.addEventListener('click', () => {
            root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem(KEY, root.dataset.theme); } catch { /* theme just won't persist */ }
            label();
        });
    });
})();
