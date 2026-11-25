// Seal lab: the user can build a seal by hand and save it as a picture.
const Lab = (() => {
    const $ = (id) => document.getElementById(id);
    const NAMES = ['outer', 'middle', 'inner'];
    let seal = null;
    let rings = null;
    let owner = '';

    // put the numbers of the seal on the sliders
    function show(text) {
        rings = Seal.shape(text);
        NAMES.forEach((n, i) => { $('lab-' + n).value = rings[i].petals; });
        $('lab-depth').value = 100;
        seal.setText(text);
    }

    function fromSliders() {
        const depth = Number($('lab-depth').value) / 100;
        seal.setRings(rings.map((r, i) => ({
            ...r, petals: Number($('lab-' + NAMES[i]).value), wave: r.wave * depth, detail: r.detail * depth,
        })));
    }

    function save() {
        // white lines need the blue field behind them
        const copy = document.createElement('canvas');
        copy.width = seal.canvas.width;
        copy.height = seal.canvas.height;
        const ctx = copy.getContext('2d');
        ctx.fillStyle = getComputedStyle($('lab-stage')).backgroundColor;
        ctx.fillRect(0, 0, copy.width, copy.height);
        ctx.drawImage(seal.canvas, 0, 0);
        copy.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            el('a', { href: url, download: 'seal.png' }).click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    }

    function open(username) {
        owner = username;
        if (seal) return;
        seal = Seal.mount($('lab-canvas'), owner, { width: 1, instrument: true });
        $('lab-text').value = owner;
        show(owner);
        $('lab-text').addEventListener('input', () => show($('lab-text').value.trim().toLowerCase()));
        [...NAMES, 'depth'].forEach((n) => $('lab-' + n).addEventListener('input', fromSliders));
        $('lab-speed').addEventListener('input', () => seal.setSpeed(Number($('lab-speed').value)));
        $('lab-space').addEventListener('input', () => seal.setDepth(Number($('lab-space').value) / 100));
        $('lab-random').addEventListener('click', () => {
            const word = Math.random().toString(36).slice(2, 10);
            $('lab-text').value = word;
            show(word);
            seal.ripple();
        });
        $('lab-mine').addEventListener('click', () => { $('lab-text').value = owner; show(owner); });
        $('lab-wave').addEventListener('click', () => seal.ripple());
        $('lab-save').addEventListener('click', save);
    }

    return { open };
})();
