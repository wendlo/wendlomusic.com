/* Wendlo band console — About section.
   Edits draft.about (hero photo + story) and can re-enable the page if hidden. */

(function(){

  const DEFAULT_HERO = '../assets/about.jpg';

  /* The admin lives in /admin/, one folder below the site, so config-relative
     asset paths like "assets/about.jpg" need a ../ prefix to display here.
     Data URLs, http(s) URLs and absolute paths pass through untouched. */
  function heroSrc(draft){
    const s = String(draft.about.hero.src || '').trim();
    if(!s) return DEFAULT_HERO;
    if(/^(data:|https?:|\/)/i.test(s)) return s;
    return '../' + s;
  }

  Admin.register({
    id: 'about',
    title: 'About',
    icon: 'ti-id',
    desc: 'The page where visitors get to know you — one big photo and your story.',
    page: 'about',

    render(body){
      const ui = Admin.ui;
      const d = Admin.state.draft;

      /* ---------- hidden-page notice ---------- */
      if(!d.pages.enabled.about){
        const g = ui.group('This page is turned off', 'This page is currently hidden from the site.');
        const pill = ui.el('<span class="pill off"><i class="ti ti-eye-off"></i>Hidden</span>');
        const onBtn = ui.btn({
          label: 'Turn it on',
          icon: 'ti-eye',
          onClick(){
            d.pages.enabled.about = true;
            Admin.touch();
            Admin.rerender();
          }
        });
        g.appendChild(ui.row(pill, onBtn));
        body.appendChild(g);
      }

      /* ---------- hero photo ---------- */
      const gHero = ui.group('Hero photo', 'The big photo at the top of the About page.');

      let focalDesktop = null, focalMobile = null;

      const picker = ui.imagePicker({
        value: d.about.hero.src,
        defaultSrc: DEFAULT_HERO,
        onChange(v){
          d.about.hero.src = v;
          Admin.touch();
          const s = heroSrc(d);
          if(focalDesktop) focalDesktop.setSrc(s);
          if(focalMobile) focalMobile.setSrc(s);
        }
      });
      gHero.appendChild(ui.field('Photo', picker,
        'Wide, horizontal photos look best here. Reset any time to go back to the site default.'));

      focalDesktop = ui.focalPicker({
        src: heroSrc(d),
        value: d.about.hero.focal,
        onChange(v){ d.about.hero.focal = v; Admin.touch(); }
      });
      focalMobile = ui.focalPicker({
        src: heroSrc(d),
        value: d.about.hero.focalMobile,
        onChange(v){ d.about.hero.focalMobile = v; Admin.touch(); }
      });

      gHero.appendChild(ui.row(
        ui.field('Focus on computers', focalDesktop,
          'Click the spot that should stay in view when the photo gets cropped on big screens.'),
        ui.field('Focus on phones', focalMobile,
          'Phones crop the photo tighter — click the most important spot.')
      ));

      body.appendChild(gHero);

      /* ---------- your story ---------- */
      const gStory = ui.group('Your story', 'What visitors read on the About page.');

      gStory.appendChild(ui.field('Headline',
        ui.text({
          value: d.about.heading,
          placeholder: 'Two people, a pile of songs, and a van.',
          onInput(v){ d.about.heading = v; Admin.touch(); }
        }),
        'The big line at the top of the page.'));

      gStory.appendChild(ui.field('Bio',
        ui.textarea({
          value: d.about.body,
          rows: 6,
          placeholder: 'Tell people who you are, how you met, what the music sounds like…',
          onInput(v){ d.about.body = v; Admin.touch(); }
        }),
        'Line breaks are kept — press Enter to start a new paragraph.'));

      body.appendChild(gStory);
    }
  });
})();
