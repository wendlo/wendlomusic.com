/* Wendlo band console — Store section.
   The store itself lives in Shopify; this page only manages the connection. */
(function(){
  Admin.register({
    id: 'store',
    title: 'Store',
    icon: 'ti-shopping-bag',
    desc: 'Your merch shop — the products live in Shopify, and the site shows them automatically.',
    page: 'store',

    render(body){
      const ui  = Admin.ui;
      const esc = Admin.util.esc;
      const sh  = Admin.state.draft.store.shopify;

      /* ---------- How the store works ---------- */
      const how = ui.group('How the store works',
        'All your products — prices, photos, sizes, and inventory — live in your Shopify shop. ' +
        'The site pulls them in automatically, so the store page always matches what’s in Shopify. ' +
        'When a visitor buys something, checkout happens on Shopify’s secure pages, not on this site.');

      const openRow = ui.row(
        ui.btn({
          label: 'Open Shopify admin',
          icon: 'ti-external-link',
          kind: 'ghost',
          onClick: () => window.open('https://admin.shopify.com', '_blank')
        })
      );
      openRow.querySelector('button').classList.add('fix');
      how.appendChild(openRow);
      body.appendChild(how);

      /* ---------- Shopify connection ---------- */
      const conn = ui.group('Shopify connection',
        'These three details link the site to your Shopify shop. They almost never change — ' +
        'if the store page ever looks empty, come here and press “Test connection”.');

      conn.appendChild(ui.field('Store domain',
        ui.text({
          value: sh.domain, mono: true, placeholder: 'yourstore.myshopify.com',
          onInput: v => { sh.domain = v.trim(); Admin.touch(); }
        }),
        'yourstore.myshopify.com'));

      conn.appendChild(ui.field('Storefront access token',
        ui.text({
          value: sh.token, mono: true, placeholder: 'shpat_… or a 32-character code',
          onInput: v => { sh.token = v.trim(); Admin.touch(); }
        }),
        'A public token — found in your Buy Button embed or Headless app'));

      conn.appendChild(ui.field('API version',
        ui.text({
          value: sh.apiVersion, mono: true, placeholder: '2024-10',
          onInput: v => { sh.apiVersion = v.trim(); Admin.touch(); }
        }),
        'Leave as-is unless Shopify says otherwise'));

      /* status pill + test button */
      const pill = ui.el('<span class="pill off fix"><i class="ti ti-plug"></i>Not tested yet</span>');
      function setPill(kind, icon, text){
        pill.className = 'pill ' + kind + ' fix';
        pill.innerHTML = `<i class="ti ${icon}"></i>${esc(text)}`;
      }

      const testBtn = ui.btn({
        label: 'Test connection',
        icon: 'ti-plug-connected',
        onClick: async (b) => {
          const domain = String(sh.domain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
          const token  = String(sh.token || '').trim();
          const ver    = String(sh.apiVersion || '').trim() || '2024-10';

          if(!domain || !token){
            setPill('warn', 'ti-alert-triangle', 'Missing details');
            Admin.toast('Fill in the store domain and token first', 'bad');
            return;
          }

          b.disabled = true;
          setPill('warn', 'ti-loader-2', 'Testing…');
          try{
            const r = await fetch(`https://${domain}/api/${ver}/graphql.json`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': token
              },
              body: JSON.stringify({ query: '{ shop { name } products(first:1){ nodes{ title } } }' })
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

            setPill('ok', 'ti-circle-check', 'Connected to ' + name);
            Admin.toast('Connected to ' + name, 'good');
          }catch(err){
            const msg = (err instanceof TypeError)
              ? 'Couldn’t reach Shopify — check the store domain and your internet connection'
              : (err && err.message) || 'Something went wrong testing the connection';
            setPill('err', 'ti-plug-x', 'Not connected');
            Admin.toast(msg, 'bad');
          }finally{
            b.disabled = false;
          }
        }
      });
      testBtn.classList.add('fix');

      const testRow = ui.row(testBtn, pill);
      testRow.style.marginTop = '4px';
      conn.appendChild(testRow);
      body.appendChild(conn);

      /* ---------- Where to change products ---------- */
      const note = ui.group('Changing what you sell',
        'To add or remove products, change prices, sizes, photos, or inventory, do it in Shopify — ' +
        'the site picks it up automatically. This page only controls the connection between the two.');
      body.appendChild(note);
    }
  });
})();
