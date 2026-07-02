/* Wendlo band console — Tour section.
   Hero photo + crop focus, Bandsintown connection, and the "no shows" message. */

(function(){
  Admin.register({
    id: 'tour',
    title: 'Tour',
    icon: 'ti-map-pin',
    desc: 'The shows page — the big photo up top, and where your show listings come from.',
    page: 'tour',

    render(body){
      const ui = Admin.ui;
      const t  = Admin.state.draft.tour;
      const DEFAULT_HERO = '../assets/shows.jpg';

      /* ============ Hero photo ============ */
      const gHero = ui.group('Hero photo', 'Visitors see this big photo at the top of the tour page.');

      let focalDesk, focalMob;
      const heroSrc = () => t.hero.src || DEFAULT_HERO;

      const picker = ui.imagePicker({
        value: t.hero.src,
        defaultSrc: DEFAULT_HERO,
        onChange(v){
          t.hero.src = v;
          Admin.touch();
          focalDesk.setSrc(heroSrc());
          focalMob.setSrc(heroSrc());
        }
      });
      gHero.appendChild(ui.field('Photo', picker,
        'Upload your own, paste a link, or reset to use the site default.'));

      focalDesk = ui.focalPicker({
        src: heroSrc(),
        value: t.hero.focal,
        onChange(v){ t.hero.focal = v; Admin.touch(); }
      });
      gHero.appendChild(ui.field('Focus point — computers', focalDesk,
        'Click the most important part of the photo. When the photo gets cropped, that part stays in view.'));

      focalMob = ui.focalPicker({
        src: heroSrc(),
        value: t.hero.focalMobile,
        onChange(v){ t.hero.focalMobile = v; Admin.touch(); }
      });
      gHero.appendChild(ui.field('Focus point — phones', focalMob,
        'On phones the photo is cropped tall — click their faces so they stay in the frame.'));

      body.appendChild(gHero);

      /* ============ Bandsintown ============ */
      const gBit = ui.group('Bandsintown',
        'Shows come straight from your Bandsintown page — update there, they appear here.');

      gBit.appendChild(ui.field('Artist ID',
        ui.text({
          value: t.bandsintown.artist,
          mono: true,
          placeholder: 'id_14800723',
          onInput(v){ t.bandsintown.artist = v.trim(); Admin.touch(); }
        }),
        'Looks like id_14800723 — you can find it in your Bandsintown artist settings.'));

      gBit.appendChild(ui.field('App ID',
        ui.text({
          value: t.bandsintown.appId,
          mono: true,
          placeholder: 'your Bandsintown app id',
          onInput(v){ t.bandsintown.appId = v.trim(); Admin.touch(); }
        }),
        'The key Bandsintown gave this website. You shouldn’t normally need to change it.'));

      const pill = document.createElement('span');
      pill.className = 'pill off';
      pill.style.marginLeft = '10px';
      pill.hidden = true;

      const testBtn = ui.btn({
        label: 'Test connection',
        icon: 'ti-plug-connected',
        kind: 'ghost',
        async onClick(b){
          const artist = String(t.bandsintown.artist || '').trim();
          const appId  = String(t.bandsintown.appId  || '').trim();
          if(!artist || !appId){
            Admin.toast('Fill in both the Artist ID and the App ID first', 'bad');
            pill.hidden = false;
            pill.className = 'pill warn';
            pill.textContent = 'Missing details';
            return;
          }
          b.disabled = true;
          pill.hidden = false;
          pill.className = 'pill off';
          pill.textContent = 'Checking…';
          try{
            const url = 'https://rest.bandsintown.com/artists/' + encodeURIComponent(artist) +
                        '/events?app_id=' + encodeURIComponent(appId) + '&date=upcoming';
            const r = await fetch(url);
            if(!r.ok) throw new Error('Bandsintown said no (HTTP ' + r.status + ') — double-check both IDs');
            const data = await r.json();
            if(!Array.isArray(data)){
              const msg = data && (data.message || data.errorMessage);
              throw new Error(msg ? String(msg) : 'Bandsintown sent back something unexpected — double-check both IDs');
            }
            const n = data.length;
            const label = n + ' upcoming show' + (n === 1 ? '' : 's') + ' found';
            Admin.toast(label, 'good');
            pill.className = 'pill ok';
            pill.textContent = label;
          }catch(err){
            const raw = (err && err.message) ? err.message : '';
            const msg = (!raw || /fetch|network/i.test(raw))
              ? 'Could not reach Bandsintown — check your internet and the two IDs above'
              : raw;
            Admin.toast(msg, 'bad');
            pill.className = 'pill err';
            pill.textContent = 'Connection failed';
          }
          b.disabled = false;
        }
      });

      gBit.appendChild(ui.field('', ui.row(testBtn, pill),
        'Checks that the two IDs above actually reach your show listings.'));

      body.appendChild(gBit);

      /* ============ When there are no shows ============ */
      const gEmpty = ui.group('When there are no shows',
        'What visitors see on the tour page between tours.');

      gEmpty.appendChild(ui.field('Message',
        ui.text({
          value: t.emptyText,
          placeholder: 'No shows on the books right now.',
          onInput(v){ t.emptyText = v; Admin.touch(); }
        }),
        'A friendly line so the page never looks broken.'));

      gEmpty.appendChild(ui.field('Link text',
        ui.text({
          value: t.emptyLinkText,
          placeholder: 'Get notified on Bandsintown ↗',
          onInput(v){ t.emptyLinkText = v; Admin.touch(); }
        }),
        'The little link under the message — leave it blank to show no link.'));

      gEmpty.appendChild(ui.field('Link goes to',
        ui.text({
          value: t.emptyLinkUrl,
          placeholder: 'https://www.bandsintown.com/a/…',
          onInput(v){ t.emptyLinkUrl = v.trim(); Admin.touch(); }
        }),
        'Usually your Bandsintown page, so fans can follow you and get told about new dates.'));

      body.appendChild(gEmpty);
    }
  });
})();
