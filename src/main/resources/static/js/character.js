// The character on the right side of the portal and its editor.
// The choice is kept in localStorage of this browser only: it is decoration, no personal data is sent anywhere.
const Character = (() => {
    const $ = (id) => document.getElementById(id);

    const SKINS = ['#f6dcc9', '#efc9ae', '#e3b492', '#d39e78', '#bd8560', '#a36c49', '#875538', '#6b402a', '#4f2e20', '#38211a'];
    const HAIRS = ['#0e0b0a', '#251812', '#3d2618', '#5c3a22', '#86572f', '#b5854a', '#dcb877', '#efe0b8', '#7d2c17', '#a9431d', '#8f949c', '#e6e6e6', '#1d3fbf', '#7a2bb8', '#c22672', '#1b8a6b'];
    const EYES = ['#3b2212', '#5e3a1a', '#7d5a26', '#4f6b2c', '#2f6b4f', '#2f6f9e', '#5c93c4', '#78848f', '#171210', '#6b4aa0'];
    const FABRIC = ['#f4f4f2', '#c9ccd1', '#7c828b', '#3a3f47', '#15171b', '#0f2350', '#1d4ed8', '#4f9be8', '#0f5e54', '#2f6b34', '#5d6b3a', '#8a6b45', '#c8ad86', '#6b2230', '#b3262e', '#e2632f', '#efbf3c', '#e7a3b4', '#6a3f9e'];
    const LIPS = ['#a8434a', '#b32136', '#7c1a2e', '#c4586d', '#d98080', '#8f4a3c', '#5b1830', '#d14b2d'];
    const METALS = ['#e2b64c', '#d9dde3', '#c98a6b', '#2b2d33'];

    // kinds of controls: s = slider, o = list of choices, c = colour, t = on/off
    const s = (key, label, min = -1, max = 1) => ({ kind: 's', key, label, min, max });
    const o = (key, label, options) => ({ kind: 'o', key, label, options });
    const c = (key, label, colors) => ({ kind: 'c', key, label, colors });
    const t = (key, label) => ({ kind: 't', key, label });

    const SECTIONS = [
        { name: 'Body', view: 'full', items: [
            o('build', 'Build', [[0, 'Masculine'], [.5, 'Neutral'], [1, 'Feminine']]),
            c('skin', 'Skin', SKINS), s('height', 'Height', .88, 1.08), s('weight', 'Weight', -.8, 1.4), s('muscle', 'Muscles', -.3, 1.4),
            o('tattoo', 'Arm tattoo', [['none', 'None'], ['band', 'Band'], ['sleeve', 'Sleeve'], ['pattern', 'Geometric']])] },
        { name: 'Face', view: 'face', items: [
            o('origin', 'Features', [['central', 'Central Asian'], ['asian', 'East Asian'], ['european', 'European'], ['african', 'African'], ['mixed', 'Mixed']]),
            o('faceShape', 'Face shape', [['natural', 'Natural'], ['oval', 'Oval'], ['round', 'Round'], ['square', 'Square'], ['rectangular', 'Long'], ['triangular', 'Pear'], ['diamond', 'Diamond'], ['heart', 'Heart']]),
            s('faceWidth', 'Face width'), s('faceLength', 'Face length'), s('faceFat', 'Fullness'), s('cheeks', 'Cheekbones'), s('cheekVolume', 'Cheeks'), s('temple', 'Temples'), s('forehead', 'Forehead'), s('brow', 'Brow ridge'),
            s('jaw', 'Jaw'), s('chin', 'Chin height'), s('chinWidth', 'Chin width'), s('chinForward', 'Chin forward'), s('doubleChin', 'Under the chin'), s('ears', 'Ear size'), s('earWing', 'Ears outwards'),
            s('age', 'Age', 0, 1), s('smile', 'Smile', -.3, 1), s('freckles', 'Freckles', 0, 1), s('moles', 'Moles', 0, 1), s('blemish', 'Blemishes', 0, 1), t('scar', 'Scar')] },
        { name: 'Eyes', view: 'face', items: [
            c('eyeColor', 'Eye colour', EYES), s('eyeSize', 'Size'), s('eyeNarrow', 'Narrow'), s('eyeTilt', 'Tilt'), s('eyeSpace', 'Distance'), s('eyeHeight', 'Height'), s('eyeDepth', 'Depth'), s('epicanthus', 'Inner fold'), s('eyefold', 'Upper lid'), s('eyeBag', 'Under the eyes'),
            s('lashes', 'Lashes', -.5, 1.2), c('browColor', 'Eyebrow colour', HAIRS), s('browThick', 'Eyebrow thickness'), s('browShape', 'Eyebrow arch'), s('browHeight', 'Eyebrow height'), s('browAngle', 'Eyebrow angle')] },
        { name: 'Nose and mouth', view: 'face', items: [
            s('noseWidth', 'Nose width'), s('noseLength', 'Nose length'), s('noseBridge', 'Nose bridge'), s('noseDepth', 'Nose projection'), s('noseHump', 'Nose hump'), s('noseTip', 'Tip height'), s('noseTipWidth', 'Tip width'), s('nostrils', 'Nostrils'),
            s('mouthWidth', 'Mouth width'), s('mouthHeight', 'Mouth height'), s('upperLip', 'Upper lip'), s('lips', 'Lower lip'), s('cupid', 'Cupid bow')] },
        { name: 'Make-up', view: 'face', items: [
            s('lipstick', 'Lipstick', 0, 1), c('lipColor', 'Lipstick colour', LIPS), s('eyeShadow', 'Eye shadow', 0, 1),
            c('shadowColor', 'Eye shadow colour', ['#3d2a2a', '#7a4a3a', '#8a5a8f', '#2f4a7a', '#2d6a5a', '#b0843c', '#17151a']), s('blush', 'Blush', 0, 1)] },
        { name: 'Hair', view: 'hair', items: [
            o('hair', 'Style', [['bald', 'Bald'], ['buzz', 'Buzz cut'], ['crop', 'Crop'], ['sidepart', 'Side part'], ['quiff', 'Quiff'], ['slick', 'Slicked back'], ['messy', 'Messy'], ['curly', 'Curly'],
                ['afro', 'Afro'], ['bob', 'Bob'], ['long', 'Long'], ['waves', 'Waves'], ['ponytail', 'Ponytail'], ['bun', 'Bun']]),
            c('hairColor', 'Hair colour', HAIRS), s('hairLength', 'Length'), s('hairVolume', 'Volume'), s('hairline', 'Hairline'),
            o('beard', 'Beard', [['none', 'None'], ['stubble', 'Stubble'], ['moustache', 'Moustache'], ['chin', 'Chin only'], ['goatee', 'Goatee'], ['short', 'Short'], ['full', 'Full'], ['long', 'Long']]),
            c('beardColor', 'Beard colour', HAIRS)] },
        { name: 'Top', view: 'top', items: [
            o('top', 'Clothes', [['tee', 'T-shirt'], ['polo', 'Polo'], ['tank', 'Tank top'], ['longsleeve', 'Long sleeve'], ['shirt', 'Shirt'], ['sweater', 'Sweater'], ['hoodie', 'Hoodie'],
                ['bomber', 'Bomber'], ['leather', 'Leather jacket'], ['blazer', 'Blazer']]),
            c('topColor', 'Colour', FABRIC), s('fit', 'Fit', -.5, 1.5),
            o('pattern', 'Pattern', [['plain', 'Plain'], ['stripes', 'Stripes'], ['check', 'Check'], ['camo', 'Camouflage'], ['block', 'Two colours'], ['fade', 'Gradient']]),
            c('patternColor', 'Pattern colour', FABRIC), c('innerColor', 'Shirt under a jacket', FABRIC), c('trimColor', 'Buttons and cords', FABRIC), t('tuck', 'Tucked in'), t('tie', 'Tie with a blazer'), c('tieColor', 'Tie', FABRIC)] },
        { name: 'Bottom', view: 'bottom', items: [
            o('bottom', 'Clothes', [['jeans', 'Jeans'], ['skinny', 'Skinny jeans'], ['chinos', 'Chinos'], ['joggers', 'Joggers'], ['cargo', 'Cargo'], ['shorts', 'Shorts'], ['skirt', 'Pleated skirt']]),
            c('bottomColor', 'Colour', ['#1c2a4a', '#2d4a7c', '#6f90bd', ...FABRIC]), s('legFit', 'Fit', -.5, 1.5), c('beltColor', 'Belt', ['#1a1614', '#4a2f1d', '#7a5232', '#3a3f47', '#f4f4f2'])] },
        { name: 'Shoes', view: 'shoes', items: [
            o('shoes', 'Shoes', [['sneakers', 'Sneakers'], ['hightops', 'High tops'], ['runners', 'Runners'], ['boots', 'Boots'], ['oxford', 'Oxfords'], ['heels', 'Heels']]),
            c('shoeColor', 'Colour', FABRIC), c('soleColor', 'Sole and laces', FABRIC), c('sockColor', 'Socks', FABRIC)] },
        { name: 'Accessories', view: 'top', items: [
            o('hat', 'Head', [['none', 'None'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['scarf', 'Headscarf']]), c('hatColor', 'Headwear colour', FABRIC),
            o('glasses', 'Glasses', [['none', 'None'], ['round', 'Round'], ['square', 'Square'], ['aviator', 'Aviator'], ['sport', 'Sport']]),
            c('frameColor', 'Frame', ['#15171b', '#5a3a22', '#e2b64c', '#d9dde3', '#1d4ed8', '#b3262e']), c('lensColor', 'Lens', ['#dfe8ef', '#101216', '#3a2a1c', '#1d3f6a', '#5a1f24']), s('lensDark', 'Lens darkness', .05, .97),
            o('earrings', 'Earrings', [['none', 'None'], ['stud', 'Studs'], ['hoop', 'Hoops']]), t('chain', 'Chain'), c('jewelColor', 'Jewellery', METALS),
            t('watch', 'Watch'), t('headphones', 'Headphones'), c('gadgetColor', 'Headphones colour', FABRIC), t('backpack', 'Backpack'), c('packColor', 'Backpack colour', FABRIC)] },
    ];
    // these change only colours or paint, so the shape is not built again
    const PAINT = new Set(['height', 'freckles', 'moles', 'blemish', 'scar', 'tattoo', 'lipstick', 'eyeShadow', 'blush', 'lensDark', 'pattern',
        ...SECTIONS.flatMap((sec) => sec.items.filter((i) => i.kind === 'c').map((i) => i.key))]);

    const BASE = {
        origin: 'central', faceShape: 'natural', faceLength: 0, faceFat: 0, cheekVolume: 0, temple: 0, forehead: 0, chinWidth: 0, chinForward: 0, doubleChin: 0, earWing: 0, moles: .3, blemish: 0,
        eyeDepth: 0, epicanthus: 0, eyefold: 0, eyeBag: 0, browHeight: 0, browAngle: 0, noseDepth: 0, noseHump: 0, noseTipWidth: 0, nostrils: 0, upperLip: 0, cupid: 0,
        build: 0, skin: '#d39e78', height: 1, weight: 0, muscle: .2, tattoo: 'none',
        faceWidth: 0, jaw: 0, chin: 0, cheeks: 0, brow: 0, ears: 0, age: 0, smile: .25, freckles: 0, scar: false,
        eyeColor: '#5e3a1a', eyeSize: 0, eyeNarrow: 0, eyeTilt: 0, eyeSpace: 0, eyeHeight: 0, lashes: 0, browColor: '#251812', browThick: 0, browShape: 0,
        noseWidth: 0, noseLength: 0, noseBridge: 0, noseTip: 0, mouthWidth: 0, mouthHeight: 0, lips: 0,
        lipstick: 0, lipColor: '#a8434a', eyeShadow: 0, shadowColor: '#3d2a2a', blush: 0,
        hair: 'quiff', hairColor: '#251812', hairLength: 0, hairVolume: 0, hairline: 0, beard: 'none', beardColor: '#251812',
        top: 'hoodie', topColor: '#0f2350', fit: 0, pattern: 'plain', patternColor: '#4f9be8', innerColor: '#f4f4f2', trimColor: '#c9ccd1', tie: true, tuck: false, tieColor: '#6b2230',
        bottom: 'jeans', bottomColor: '#1c2a4a', legFit: 0, beltColor: '#1a1614',
        shoes: 'sneakers', shoeColor: '#f4f4f2', soleColor: '#f4f4f2', sockColor: '#f4f4f2',
        hat: 'none', hatColor: '#15171b', glasses: 'none', frameColor: '#15171b', lensColor: '#dfe8ef', lensDark: .12,
        earrings: 'none', chain: false, jewelColor: '#e2b64c', watch: true, headphones: false, gadgetColor: '#15171b', backpack: false, packColor: '#15171b',
    };

    let viewer = null, config = null, key = '', history = [], timer = 0, section = SECTIONS[0];

    function load(username) {
        key = 'portal.character.' + username;
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch { /* a damaged record is ignored */ }
        const next = { ...BASE };
        // only known keys with the right type and range are taken from the record
        for (const item of SECTIONS.flatMap((x) => x.items)) {
            const v = saved[item.key];
            if (item.kind === 's' && Number.isFinite(v)) next[item.key] = Math.min(item.max, Math.max(item.min, v));
            if (item.kind === 't' && typeof v === 'boolean') next[item.key] = v;
            if (item.kind === 'c' && /^#[0-9a-f]{6}$/i.test(v)) next[item.key] = v;
            if (item.kind === 'o' && item.options.some(([value]) => value === v)) next[item.key] = v;
        }
        return next;
    }
    function save() { try { localStorage.setItem(key, JSON.stringify(config)); } catch { /* stays until reload */ } }

    function apply(shape, delay) {
        save();
        viewer.setColors(config);
        if (!shape) return;
        clearTimeout(timer);
        timer = setTimeout(() => viewer.setConfig(config), delay);
    }
    function remember() { history.push(JSON.stringify(config)); if (history.length > 60) history.shift(); $('char-undo').disabled = false; }
    function change(name, value, delay = 0) {
        config = { ...config, [name]: value };
        apply(!PAINT.has(name), delay);
    }
    function replace(next) { remember(); config = next; apply(true, 0); renderSection(); }

    // ---------- controls ----------
    function control(item) {
        const id = 'char-' + item.key;
        if (item.kind === 's') {
            const input = el('input', { type: 'range', id, min: item.min, max: item.max, step: (item.max - item.min) / 100, value: config[item.key] });
            input.addEventListener('pointerdown', remember);
            input.addEventListener('keydown', (e) => { if (e.key.startsWith('Arrow')) remember(); });
            input.addEventListener('input', () => change(item.key, Number(input.value), 90));
            return el('div', { class: 'char-slider' }, el('label', { for: id }, item.label), input);
        }
        if (item.kind === 't') {
            const input = el('input', { type: 'checkbox', id });
            input.checked = config[item.key];
            input.addEventListener('change', () => { remember(); change(item.key, input.checked); });
            return el('label', { class: 'char-check' }, input, item.label);
        }
        if (item.kind === 'o') {
            const row = el('div', { class: 'chips', role: 'group', 'aria-label': item.label });
            item.options.forEach(([value, label]) => row.append(el('button', {
                class: 'chip', type: 'button', 'aria-pressed': String(config[item.key] === value),
                onclick: (e) => {
                    remember();
                    change(item.key, value);
                    row.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
                },
            }, label)));
            return el('div', { class: 'char-group' }, el('h3', {}, item.label), row);
        }
        const row = el('div', { class: 'char-colors', role: 'group', 'aria-label': item.label });
        const own = el('input', { type: 'color', value: config[item.key], 'aria-label': item.label + ', own colour' });
        const mark = () => row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === config[item.key])));
        item.colors.forEach((color) => {
            const b = el('button', { class: 'char-color', type: 'button', 'data-color': color, 'aria-label': color, onclick: () => { remember(); change(item.key, color); own.value = color; mark(); } });
            b.style.backgroundColor = color; // set from script, so the CSP stays strict
            row.append(b);
        });
        own.addEventListener('click', remember);
        own.addEventListener('input', () => { change(item.key, own.value); mark(); });
        row.append(own);
        mark();
        return el('div', { class: 'char-group' }, el('h3', {}, item.label), row);
    }

    function renderSection() {
        $('char-sections').replaceChildren(...SECTIONS.map((x) => el('button', {
            class: 'char-tab', type: 'button', 'aria-pressed': String(x === section),
            onclick: () => { section = x; renderSection(); viewer.view(x.view); $('char-sections').querySelector('[aria-pressed="true"]').focus(); },
        }, x.name)));
        $('char-controls').replaceChildren(...section.items.map(control));
        $('char-controls').scrollTop = 0;
    }

    // ---------- random person ----------
    const any = (list) => list[Math.floor(Math.random() * list.length)];
    const bell = (size) => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5 * size;
    function randomize() {
        const next = { ...config };
        for (const item of SECTIONS.flatMap((x) => x.items)) {
            if (item.kind === 's') next[item.key] = item.min >= 0 ? BASE[item.key] : Math.min(item.max, Math.max(item.min, bell(.75)));
            if (item.kind === 'o') next[item.key] = any(item.options)[0];
            if (item.kind === 'c') next[item.key] = any(item.colors);
            if (item.kind === 't') next[item.key] = Math.random() < .25;
        }
        const woman = next.build > .6;
        Object.assign(next, {
            height: .95 + Math.random() * .1 - (woman ? .04 : 0), hairColor: any(HAIRS.slice(0, 12)), lipstick: woman && Math.random() < .5 ? .7 : 0, eyeShadow: woman && Math.random() < .4 ? .5 : 0,
            freckles: Math.random() < .2 ? .8 : 0, age: Math.random() < .3 ? Math.random() * .6 : 0, tattoo: Math.random() < .25 ? any(['band', 'sleeve', 'pattern']) : 'none',
            beard: woman ? 'none' : any(['none', 'none', 'stubble', 'short', 'full', 'goatee', 'moustache']), scar: Math.random() < .08,
            hat: Math.random() < .25 ? any(['cap', 'beanie']) : 'none', glasses: Math.random() < .35 ? any(['round', 'square', 'aviator']) : 'none', lensDark: any([.1, .1, .85]),
            hairline: 0, shadowColor: '#3d2a2a', skin: any(SKINS.slice(0, 9)),
        });
        if (next.shoes === 'heels' && !woman) next.shoes = 'boots';
        if (next.bottom === 'skirt' && !woman) next.bottom = 'chinos';
        next.browColor = next.beardColor = next.hairColor;
        replace(next);
    }

    // ---------- editor window ----------
    function open() {
        const d = $('char-dialog');
        $('char-stage').prepend(viewer.canvas);
        viewer.setEditing(true);
        renderSection();
        d.showModal();
        viewer.view(section.view);
    }
    function closed() {
        $('char-view').prepend(viewer.canvas);
        viewer.setEditing(false);
        viewer.view('full');
    }
    function png() {
        viewer.picture().toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            el('a', { href: url, download: 'character.png' }).click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    }

    function start(username) {
        if (viewer) return;
        config = load(username);
        viewer = Avatar.mount($('char-view'));
        if (!viewer) { $('char-open').disabled = true; return; }
        viewer.setConfig(config);
        $('char-open').addEventListener('click', open);
        $('char-view').addEventListener('dblclick', open);
        $('char-dialog').addEventListener('close', closed);
        $('char-done').addEventListener('click', () => $('char-dialog').close());
        $('char-random').addEventListener('click', randomize);
        $('char-reset').addEventListener('click', () => replace({ ...BASE }));
        $('char-png').addEventListener('click', png);
        $('char-undo').addEventListener('click', () => {
            if (!history.length) return;
            config = JSON.parse(history.pop());
            $('char-undo').disabled = !history.length;
            apply(true, 0);
            renderSection();
        });
        $('char-dialog').querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => viewer.view(b.dataset.view)));
    }

    return { start };
})();
