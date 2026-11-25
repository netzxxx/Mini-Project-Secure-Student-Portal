// Reactor lab: colours and settings of the core. Colours apply to every core in the portal.
const Lab = (() => {
    const $ = (id) => document.getElementById(id);
    let core = null;

    function showColors() {
        for (const name of ['core', 'control', 'shell']) $('lab-color-' + name).value = Reactor.colors[name];
    }

    function useText(text) {
        core.setText(text);
        core.set('coils', 0); // back to the own number of coils
        $('lab-coils').value = core.ownCoils();
    }

    function setText(text) {
        $('lab-text').value = text;
        useText(text);
    }

    function save() {
        // the picture is transparent: put the background of the stage behind it
        const copy = document.createElement('canvas');
        copy.width = core.canvas.width;
        copy.height = core.canvas.height;
        const ctx = copy.getContext('2d');
        ctx.fillStyle = '#04102c';
        ctx.fillRect(0, 0, copy.width, copy.height);
        ctx.drawImage(core.canvas, 0, 0);
        copy.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            el('a', { href: url, download: 'reactor.png' }).click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    }

    function open(username) {
        if (core) return;
        core = Reactor.mount($('lab-canvas'), username);
        setText(username);
        showColors();
        Reactor.swatches($('lab-swatches'), showColors);
        for (const name of ['core', 'control', 'shell']) {
            $('lab-color-' + name).addEventListener('input', (e) => Reactor.setColors({ [name]: e.target.value }));
        }
        $('lab-text').addEventListener('input', () => useText($('lab-text').value.trim().toLowerCase()));
        $('lab-power').addEventListener('input', (e) => core.set('power', Number(e.target.value) / 100));
        $('lab-coils').addEventListener('input', (e) => core.set('coils', Number(e.target.value)));
        $('lab-tilt').addEventListener('input', (e) => core.set('tilt', Number(e.target.value) / 100));
        $('lab-speed').addEventListener('input', (e) => core.set('speed', Number(e.target.value) / 10));
        $('lab-chain').addEventListener('click', () => core.chain());
        $('lab-stop').addEventListener('click', () => core.refuse());
        $('lab-random').addEventListener('click', () => setText(Math.random().toString(36).slice(2, 10)));
        $('lab-mine').addEventListener('click', () => setText(username));
        $('lab-save').addEventListener('click', save);
    }

    return { open };
})();
