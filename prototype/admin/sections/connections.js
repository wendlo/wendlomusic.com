/* Wendlo band console — Connections section.
   One place to see and test every outside service the site talks to. */
(function(){
  Admin.register({
    id: 'connections',
    title: 'Connections',
    icon: 'ti-plug',
    desc: 'Every outside service the site talks to — check them all in one place.',

    render(body){
      const ui = Admin.ui;
      const d  = Admin.state.draft;

      /* ---------- helpers ---------- */

      /* A group with a status pill in its title. isOk() is re-checked whenever
         refresh() is called, so the pill follows what's typed in. */
      function connGroup(title, desc, isOk){
        const g = ui.group(title, desc);
        const pill = ui.el('<span class="pill off"><i class="ti ti-plug"></i>Not set up</span>');
        pill.style.marginLeft = '8px';
        pill.style.verticalAlign = 'middle';
        const h2 = g.querySelector('h2');
        if(h2) h2.appendChild(pill);
        function refresh(){
          const ok = !!isOk();
          pill.className = 'pill ' + (ok ? 'ok' : 'off');
          pill.innerHTML = ok
            ? '<i class="ti ti-circle-check"></i>Connected'
            : '<i class="ti ti-plug"></i>Not set up';
        }
        refresh();
        return { group: g, refresh };
      }

      /* A "Test" button that shows a spinner-ish disabled state while it runs. */
      function testBtn(label, run){
        const b = ui.btn({
          label, icon: 'ti-plug-connected',
          onClick: async (btn) => {
            btn.disabled = true;
            try{ await run(); }
            finally{ btn.disabled = false; }
          }
        });
        b.classList.add('fix');
        return b;
      }

      /* Webhook groups 3 & 4 share everything but the words and the key. */
      function webhookGroup({title, desc, hint, getUrl, setUrl}){
        const c = connGroup(title, desc, () => String(getUrl() || '').trim() !== '');
        c.group.appendChild(ui.field('Webhook URL',
          ui.text({
            value: getUrl(), mono: true,
            placeholder: 'https://script.google.com/macros/s/…/exec',
            onInput: v => { setUrl(v.trim()); Admin.touch(); c.refresh(); }
          }),
          hint));

        const row = ui.row(testBtn('Send a test', async () => {
          const url = String(getUrl() || '').trim();
          if(!url){
            Admin.toast('Paste a webhook URL first', 'bad');
            return;
          }
          if(!/^https?:\/\//i.test(url)){
            Admin.toast('That doesn’t look like a web address — it should start with https://', 'bad');
            return;
          }
          try{
            await fetch(url, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ type: 'test' })
            });
            Admin.toast('Request sent — check the receiving end', 'good');
          }catch(_){
            Admin.toast('Couldn’t reach that address — double-check the URL', 'bad');
          }
        }));
        row.style.marginTop = '4px';
        c.group.appendChild(row);
        body.appendChild(c.group);
      }

      /* ---------- top note ---------- */
      const intro = ui.group('How connections work',
        'These settings power the buttons and forms across the site — the store, the tour list, ' +
        'and the contact page all lean on them. Everything here autosaves as you type, and goes ' +
        'live for visitors when you press Publish.');
      body.appendChild(intro);

      /* ---------- 1) Shopify ---------- */
      const sh = d.store.shopify;
      const shop = connGroup('Shopify',
        'Runs the merch store — the site pulls your products from Shopify and sends buyers to ' +
        'Shopify’s secure checkout. These are the same details as on the Store page.',
        () => String(sh.domain||'').trim() && String(sh.token||'').trim());

      shop.group.appendChild(ui.field('Store domain',
        ui.text({
          value: sh.domain, mono: true, placeholder: 'yourstore.myshopify.com',
          onInput: v => { sh.domain = v.trim(); Admin.touch(); shop.refresh(); }
        }),
        'yourstore.myshopify.com'));

      shop.group.appendChild(ui.field('Storefront access token',
        ui.text({
          value: sh.token, mono: true, placeholder: 'shpat_… or a 32-character code',
          onInput: v => { sh.token = v.trim(); Admin.touch(); shop.refresh(); }
        }),
        'A public token — found in your Buy Button embed or Headless app'));

      shop.group.appendChild(ui.field('API version',
        ui.text({
          value: sh.apiVersion, mono: true, placeholder: '2024-10',
          onInput: v => { sh.apiVersion = v.trim(); Admin.touch(); }
        }),
        'Leave as-is unless Shopify says otherwise'));

      const shopRow = ui.row(
        testBtn('Test', async () => {
          const domain = String(sh.domain||'').trim().replace(/^https?:\/\//i,'').replace(/\/.*$/,'');
          const token  = String(sh.token||'').trim();
          const ver    = String(sh.apiVersion||'').trim() || '2024-10';
          if(!domain || !token){
            Admin.toast('Fill in the store domain and token first', 'bad');
            return;
          }
          try{
            const r = await fetch(`https://${domain}/api/${ver}/graphql.json`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': token
              },
              body: JSON.stringify({ query: '{ shop { name } }' })
            });
            if(!r.ok){
              throw new Error(
                r.status === 401 || r.status === 403
                  ? 'Shopify didn’t accept that token — double-check it'
                  : 'Shopify replied with an error (' + r.status + ') — check the domain and API version'
              );
            }
            const data = await r.json();
            if(data.errors && data.errors.length){
              throw new Error('Shopify didn’t accept the request — double-check the token and API version');
            }
            const name = data && data.data && data.data.shop && data.data.shop.name;
            if(!name) throw new Error('Shopify replied, but not the way we expected — check the API version');
            Admin.toast('Connected to ' + name, 'good');
          }catch(err){
            const msg = (err instanceof TypeError)
              ? 'Couldn’t reach Shopify — check the store domain and your internet connection'
              : (err && err.message) || 'Something went wrong testing the connection';
            Admin.toast(msg, 'bad');
          }
        }),
        ui.btn({ label:'Open the Store section', kind:'ghost', icon:'ti-shopping-bag',
                 onClick: () => Admin.go('store') })
      );
      shopRow.style.marginTop = '4px';
      shopRow.querySelectorAll('button').forEach(b => b.classList.add('fix'));
      shop.group.appendChild(shopRow);
      body.appendChild(shop.group);

      /* ---------- 2) Bandsintown ---------- */
      const bit = d.tour.bandsintown;
      const tour = connGroup('Bandsintown',
        'Fills the tour page — add shows on Bandsintown and they appear on the site automatically. ' +
        'These are the same details as on the Tour page.',
        () => String(bit.artist||'').trim() && String(bit.appId||'').trim());

      tour.group.appendChild(ui.field('Artist ID',
        ui.text({
          value: bit.artist, mono: true, placeholder: 'id_14800723',
          onInput: v => { bit.artist = v.trim(); Admin.touch(); tour.refresh(); }
        }),
        'Looks like id_14800723 — from your Bandsintown artist settings'));

      tour.group.appendChild(ui.field('App ID',
        ui.text({
          value: bit.appId, mono: true, placeholder: 'a long string of letters and numbers',
          onInput: v => { bit.appId = v.trim(); Admin.touch(); tour.refresh(); }
        }),
        'Your Bandsintown API key — it rarely changes'));

      const tourRow = ui.row(
        testBtn('Test', async () => {
          const artist = String(bit.artist||'').trim();
          const appId  = String(bit.appId ||'').trim();
          if(!artist || !appId){
            Admin.toast('Fill in the artist ID and app ID first', 'bad');
            return;
          }
          try{
            const url = 'https://rest.bandsintown.com/artists/' + encodeURIComponent(artist) +
                        '/events?app_id=' + encodeURIComponent(appId) + '&date=upcoming';
            const r = await fetch(url);
            if(!r.ok) throw new Error('Bandsintown replied with an error (' + r.status + ') — check both IDs');
            const events = await r.json();
            if(!Array.isArray(events)) throw new Error('Bandsintown didn’t accept those IDs — double-check them');
            const n = events.length;
            Admin.toast(
              n === 0 ? 'Connected — no upcoming shows listed right now'
                      : 'Connected — ' + n + ' upcoming show' + (n === 1 ? '' : 's') + ' found',
              'good');
          }catch(err){
            const msg = (err instanceof TypeError)
              ? 'Couldn’t reach Bandsintown — check your internet connection'
              : (err && err.message) || 'Something went wrong testing the connection';
            Admin.toast(msg, 'bad');
          }
        }),
        ui.btn({ label:'Open the Tour section', kind:'ghost', icon:'ti-map-pin',
                 onClick: () => Admin.go('tour') })
      );
      tourRow.style.marginTop = '4px';
      tourRow.querySelectorAll('button').forEach(b => b.classList.add('fix'));
      tour.group.appendChild(tourRow);
      body.appendChild(tour.group);

      /* ---------- 3) Email list webhook ---------- */
      webhookGroup({
        title: 'Email list webhook',
        desc: 'Where email-list signups are sent. When a visitor joins the list, the site POSTs ' +
              'their answers as JSON to this address — usually a Mailchimp bridge or a Google ' +
              'Apps Script URL. Leave it blank and signups are only kept in the Submissions inbox.',
        hint: 'Paste the web app URL from your Apps Script deployment (ends in /exec)',
        getUrl: () => d.contact.webhooks.email,
        setUrl: v => { d.contact.webhooks.email = v; }
      });

      /* ---------- 4) Contact-form webhook ---------- */
      webhookGroup({
        title: 'Contact-form webhook',
        desc: 'Where message-form submissions are sent — for example an Apps Script that emails ' +
              'you and logs each message to a Google Sheet. Leave it blank and messages are only ' +
              'kept in the Submissions inbox.',
        hint: 'Paste the web app URL from your Apps Script deployment (ends in /exec)',
        getUrl: () => d.contact.webhooks.contact,
        setUrl: v => { d.contact.webhooks.contact = v; }
      });

      /* ---------- 5) Google Form ---------- */
      const gf = d.contact.googleForm;
      const form = connGroup('Google Form',
        'Adds an extra button on the contact page that opens a Google Form — handy for longer ' +
        'questionnaires or street-team signups. Same settings as on the Contact page.',
        () => gf.enabled && String(gf.url||'').trim() !== '');

      form.group.appendChild(ui.field('',
        ui.toggle({
          checked: gf.enabled,
          label: 'Show the form button on the contact page',
          onChange: v => { gf.enabled = v; Admin.touch(); form.refresh(); }
        })));

      form.group.appendChild(ui.field('Button label',
        ui.text({
          value: gf.label, placeholder: 'Fill out our form',
          onInput: v => { gf.label = v; Admin.touch(); }
        }),
        'What visitors see on the button'));

      form.group.appendChild(ui.field('Form link',
        ui.text({
          value: gf.url, mono: true, placeholder: 'https://forms.gle/…',
          onInput: v => { gf.url = v.trim(); Admin.touch(); form.refresh(); }
        }),
        'The share link from Google Forms — visitors open it in a new tab'));

      const formRow = ui.row(
        ui.btn({
          label: 'Open the form', kind: 'ghost', icon: 'ti-external-link',
          onClick: () => {
            const url = String(gf.url||'').trim();
            if(!url){ Admin.toast('Paste the form link first', 'bad'); return; }
            window.open(url, '_blank');
          }
        })
      );
      formRow.style.marginTop = '4px';
      formRow.querySelectorAll('button').forEach(b => b.classList.add('fix'));
      form.group.appendChild(formRow);
      body.appendChild(form.group);
    }
  });
})();
