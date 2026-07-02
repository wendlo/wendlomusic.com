/* Wendlo band console — Design section.
   Accent color, logo, and background texture for the whole site. */

(function(){
  Admin.register({
    id: 'design',
    title: 'Design',
    icon: 'ti-palette',
    desc: 'The color and artwork that give the whole site its look.',
    page: 'home',

    render(body){
      const ui = Admin.ui;
      const d  = Admin.state.draft.design;

      /* ============ Accent color ============ */
      const gAccent = ui.group('Accent color');

      const colorInput = ui.color({
        value: d.accent || '#E0A32B',
        onChange(v){ setAccent(v); }
      });

      const hexInput = ui.text({
        value: (d.accent || '#E0A32B').toUpperCase(),
        mono: true,
        placeholder: '#E0A32B',
        onInput(v){
          const m = String(v).trim().match(/^#?([0-9a-fA-F]{6})$/);
          if(!m) return;                       // wait until it looks like a real hex code
          const hex = '#' + m[1].toUpperCase();
          d.accent = hex;
          colorInput.value = hex;
          Admin.touch();
        }
      });
      hexInput.style.width = '110px';

      function setAccent(hex){
        hex = String(hex || '').toUpperCase();
        d.accent = hex;
        colorInput.value = hex;
        hexInput.value = hex;
        Admin.touch();
      }

      gAccent.appendChild(ui.field(
        '',
        ui.row(colorInput, hexInput),
        'Buttons, highlights, and the active nav glow. The hand-drawn nav art keeps its own baked-in color.'
      ));

      /* preset swatches */
      const PRESETS = [
        { name: 'Mustard',   hex: '#E0A32B' },
        { name: 'Persimmon', hex: '#E8553B' },
        { name: 'Teal',      hex: '#1D9E75' },
        { name: 'Butter',    hex: '#F2C14E' }
      ];
      const swatchRow = document.createElement('div');
      swatchRow.className = 'arow';
      PRESETS.forEach(p => {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = p.name + ' (' + p.hex + ')';
        b.setAttribute('aria-label', 'Use ' + p.name);
        b.style.width = '26px';
        b.style.height = '26px';
        b.style.borderRadius = '50%';
        b.style.border = '2px solid rgba(255,255,255,.35)';
        b.style.background = p.hex;
        b.style.cursor = 'pointer';
        b.style.padding = '0';
        b.addEventListener('click', () => setAccent(p.hex));
        swatchRow.appendChild(b);
      });
      gAccent.appendChild(ui.field(
        'Quick picks',
        swatchRow,
        'Tap a dot to try one of our favorites — you can always fine-tune it above.'
      ));

      body.appendChild(gAccent);

      /* ============ Logo ============ */
      const gLogo = ui.group('Logo');
      gLogo.appendChild(ui.field(
        '',
        ui.imagePicker({
          value: d.logo,
          defaultSrc: '../assets/wendlo-logo.gif',
          onChange(v){ d.logo = v; Admin.touch(); }
        }),
        'Transparent PNG or GIF. The default hand-drawn logo is recolored white automatically; custom uploads are used as-is.'
      ));
      body.appendChild(gLogo);

      /* ============ Background texture ============ */
      const gStripes = ui.group('Background texture');
      gStripes.appendChild(ui.field(
        '',
        ui.imagePicker({
          value: d.stripes,
          defaultSrc: '../assets/stripes.jpg',
          onChange(v){ d.stripes = v; Admin.touch(); }
        }),
        'The backdrop behind Music, Store, Contact and Blog.'
      ));
      body.appendChild(gStripes);
    }
  });
})();
