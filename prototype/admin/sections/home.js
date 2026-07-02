/* Wendlo band console — Home section.
   Edits the home-page hero photo (with desktop + phone crop focus), the
   email-list magnet, and the site-wide announcement bar. */

(function(){
  Admin.register({
    id: 'home',
    title: 'Home',
    icon: 'ti-home',
    desc: 'The first thing visitors see — the big photo and the email-list invitation.',
    page: 'home',

    render(body){
      const ui = Admin.ui;
      const d  = Admin.state.draft;

      /* Admin runs from /admin/, so the built-in default asset needs the ../ prefix.
         Custom values (data: URLs or http links) are fine as-is. */
      const DEFAULT_HERO = '../assets/home.jpg';
      const heroSrc = () => (d.home.hero.src || DEFAULT_HERO);

      /* ---------- Hero photo ---------- */
      const gHero = ui.group('Hero photo',
        'The big full-screen photo visitors see the moment they arrive.');

      let focalDesktop, focalPhone;   // set below; the picker updates them when the photo changes

      const picker = ui.imagePicker({
        value: d.home.hero.src,
        defaultSrc: DEFAULT_HERO,
        onChange(v){
          d.home.hero.src = v;
          Admin.touch();
          const s = heroSrc();
          if(focalDesktop) focalDesktop.setSrc(s);
          if(focalPhone)   focalPhone.setSrc(s);
        }
      });
      gHero.appendChild(ui.field('Photo', picker,
        'Wide, landscape photos work best here. Reset goes back to the original band photo.'));

      focalDesktop = ui.focalPicker({
        src: heroSrc(),
        value: d.home.hero.focal,
        onChange(v){ d.home.hero.focal = v; Admin.touch(); }
      });
      gHero.appendChild(ui.field('Desktop focus', focalDesktop,
        'Click the photo where faces are — that spot stays in view when the image is cropped.'));

      focalPhone = ui.focalPicker({
        src: heroSrc(),
        value: d.home.hero.focalMobile,
        onChange(v){ d.home.hero.focalMobile = v; Admin.touch(); }
      });
      gHero.appendChild(ui.field('Phone focus (portrait crop)', focalPhone,
        'Phones crop the photo much tighter, top to bottom. Click where faces are so they stay in view.'));

      body.appendChild(gHero);

      /* ---------- Email list magnet ---------- */
      const gMagnet = ui.group('Email list magnet',
        'The friendly invitation on the home page that sends people to join the email list.');

      gMagnet.appendChild(ui.field('', ui.toggle({
        checked: !!d.home.emailCta.enabled,
        label: 'Show the email-list link',
        onChange(v){ d.home.emailCta.enabled = v; Admin.touch(); }
      })));

      gMagnet.appendChild(ui.field('Link text', ui.text({
        value: d.home.emailCta.text,
        placeholder: 'join our email list!',
        onInput(v){ d.home.emailCta.text = v; Admin.touch(); }
      }), 'Keep it short and warm — this is what visitors click to sign up.'));

      gMagnet.appendChild(ui.field('', ui.toggle({
        checked: !!d.home.clickHere.enabled,
        label: 'Show the hand-drawn “click here” arrow',
        onChange(v){ d.home.clickHere.enabled = v; Admin.touch(); }
      })));

      body.appendChild(gMagnet);

      /* ---------- Announcement bar ---------- */
      const gBar = ui.group('Announcement bar',
        'A thin banner across the very top of every page — handy for a new song or tour news.');

      gBar.appendChild(ui.field('', ui.toggle({
        checked: !!d.site.announcement.enabled,
        label: 'Show the announcement bar',
        onChange(v){ d.site.announcement.enabled = v; Admin.touch(); }
      })));

      gBar.appendChild(ui.field('What it says', ui.text({
        value: d.site.announcement.text,
        placeholder: 'Click here to join our email list! 💌',
        onInput(v){ d.site.announcement.text = v; Admin.touch(); }
      }), 'Visitors see this across the top of every page while the bar is on.'));

      const pageOptions = ['home','about','tour','contact','music','store','blog']
        .map(id => ({ value: id, label: (d.pages.labels && d.pages.labels[id]) || id }));

      gBar.appendChild(ui.field('Where it links', ui.select({
        options: pageOptions,
        value: d.site.announcement.page,
        onChange(v){ d.site.announcement.page = v; Admin.touch(); }
      }), 'Where clicking the bar takes people.'));

      body.appendChild(gBar);
    }
  });
})();
