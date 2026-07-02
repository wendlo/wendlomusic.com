/* Pages & nav — choose which pages are on the site and the order they appear in. */
(function(){

  const PAGE_SUBS = {
    home:    'Landing page',
    about:   'Band bio',
    tour:    'Shows from Bandsintown',
    contact: 'Forms + socials',
    music:   'Songs & videos',
    store:   'Shopify merch',
    blog:    'Posts'
  };

  /* Pages whose nav labels are plain text (no hand-drawn artwork) */
  const TEXT_LABEL_PAGES = ['about','blog'];

  Admin.register({
    id: 'pages',
    title: 'Pages & nav',
    icon: 'ti-stack-2',
    desc: 'Choose which pages visitors see, and the order they appear in the nav.',
    page: 'home',

    render(body){
      const d = Admin.state.draft;
      const ui = Admin.ui;
      const esc = Admin.util.esc;

      /* ---------- Your pages ---------- */
      const gPages = ui.group(
        'Your pages',
        'Drag to reorder the nav — the site follows this order left to right. Use the switches to show or hide a page; the preview updates instantly.'
      );

      const list = ui.dragList({
        items: d.pages.order,
        key: id => id,
        render(id){
          const wrap = ui.el(`<div style="flex:1;min-width:0;display:flex;align-items:center;gap:10px">
            <div style="flex:1;min-width:0">
              <div class="dtitle">${esc(d.pages.labels[id] || id)}</div>
              <div class="dsub">${esc(PAGE_SUBS[id] || '')}</div>
            </div>
          </div>`);

          const acts = document.createElement('div');
          acts.className = 'dacts';
          acts.appendChild(ui.toggle({
            checked: d.pages.enabled[id] !== false,
            onChange(on, input){
              if(id === 'home' && !on){
                input.checked = true;                    /* revert — home stays on */
                Admin.toast("The home page can't be turned off");
                return;
              }
              d.pages.enabled[id] = on;
              Admin.touch();
            }
          }));
          wrap.appendChild(acts);

          return wrap;
        },
        onReorder(newOrder){
          d.pages.order = newOrder;
          Admin.touch();
        }
      });
      gPages.appendChild(list);
      body.appendChild(gPages);

      /* ---------- Nav labels ---------- */
      const gLabels = ui.group(
        'Nav labels',
        'Home, tour, contact, music and store use the hand-drawn artwork in the nav, so their labels are fixed art — renaming those means new GIFs from the band. These two are plain text, so rename away.'
      );

      TEXT_LABEL_PAGES.forEach(id=>{
        gLabels.appendChild(ui.field(
          id.charAt(0).toUpperCase() + id.slice(1) + ' page',
          ui.text({
            value: d.pages.labels[id] || '',
            placeholder: id,
            onInput(v){
              d.pages.labels[id] = v;
              /* keep the list above in sync without a full rerender (which would steal focus) */
              const row = list.querySelector(`.adrag-item[data-key="${id}"] .dtitle`);
              if(row) row.textContent = v || id;
              Admin.touch();
            }
          }),
          `Visitors see this word in the nav for the ${esc(id)} page.`
        ));
      });
      body.appendChild(gLabels);

      /* ---------- Good to know ---------- */
      const gNote = ui.group(
        'Good to know',
        'When a page is switched off, it disappears completely — it’s removed from the nav and skipped in the slide order, so visitors can’t reach it at all. Nothing is deleted: switch it back on any time and everything is right where you left it.'
      );
      body.appendChild(gNote);
    }
  });
})();
