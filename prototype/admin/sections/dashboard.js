/* Wendlo band console — Dashboard section.
   A friendly landing view: a hello, some at-a-glance numbers, quick actions,
   and a health check of the outside services the site talks to. */

(function(){

  Admin.register({
    id:'dashboard',
    title:'Dashboard',
    icon:'ti-layout-dashboard',
    desc:'A quick look at how the site is doing.',
    page:'home',

    render(body){
      const ui=Admin.ui, esc=Admin.util.esc;
      const cfg=Admin.state.draft;
      const has=v=>String(v==null?'':v).trim()!=='';

      /* ---------- greeting ---------- */
      const hello=ui.group('Welcome back 👋',
        'Everything you change here is saved as a draft automatically — visitors won’t see it until you hit <b>Publish</b> in the top right.');
      body.appendChild(hello);

      /* ---------- at-a-glance stats ---------- */
      const songCount=(cfg.music.entries||[]).filter(e=>e.type==='song').length;
      const posts=cfg.blog.posts||[];
      const postsLive=posts.filter(p=>p.published).length;
      const newSubs=Admin.subs.unreadCount();
      const pagesOn=Object.values(cfg.pages.enabled||{}).filter(Boolean).length;
      const pagesTotal=Object.keys(cfg.pages.enabled||{}).length;

      const stats=document.createElement('div');
      stats.className='stats';
      stats.style.marginBottom='14px';

      function stat(num,lbl,sectionId){
        const s=ui.el(`<div class="stat" role="button" tabindex="0">
          <div class="num">${esc(String(num))}</div>
          <div class="lbl">${esc(lbl)}</div>
        </div>`);
        const go=()=>Admin.go(sectionId);
        s.addEventListener('click',go);
        s.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); } });
        return s;
      }

      stats.appendChild(stat(songCount, songCount===1?'Song on the music page':'Songs on the music page', 'music'));
      stats.appendChild(stat(postsLive, `Blog posts live · ${posts.length} written`, 'blog'));
      stats.appendChild(stat(newSubs, newSubs===1?'New submission':'New submissions', 'submissions'));
      stats.appendChild(stat(`${pagesOn} / ${pagesTotal}`, 'Pages live', 'pages'));
      body.appendChild(stats);

      /* ---------- quick actions ---------- */
      const qa=ui.group('Quick actions','Jump straight to the things you do most.');
      qa.appendChild(ui.row(
        ui.btn({label:'Add a song',          icon:'ti-music',  kind:'sm fix',       onClick:()=>Admin.go('music')}),
        ui.btn({label:'Write a blog post',   icon:'ti-pencil', kind:'sm fix',       onClick:()=>Admin.go('blog')}),
        ui.btn({label:'Change photos',       icon:'ti-photo',  kind:'sm ghost fix', onClick:()=>Admin.go('design')}),
        ui.btn({label:'View submissions',    icon:'ti-inbox',  kind:'sm ghost fix', onClick:()=>Admin.go('submissions')})
      ));
      body.appendChild(qa);

      /* ---------- connections health ---------- */
      const conns=ui.group('Your connections',
        'The outside services your site talks to. Green means it’s hooked up and working with the site.');

      const items=[
        { icon:'ti-shopping-bag', name:'Shopify',
          sub:'Powers the merch store',
          ok: has(cfg.store && cfg.store.shopify && cfg.store.shopify.token) },
        { icon:'ti-calendar',     name:'Bandsintown',
          sub:'Fills in your tour dates',
          ok: has(cfg.tour && cfg.tour.bandsintown && cfg.tour.bandsintown.appId) },
        { icon:'ti-mail',         name:'Email list (Mailchimp)',
          sub:'Where “join our email list” signups go',
          ok: has(cfg.contact && cfg.contact.webhooks && cfg.contact.webhooks.email) },
        { icon:'ti-message-2',    name:'Contact form',
          sub:'Where “send us a message” notes go',
          ok: has(cfg.contact && cfg.contact.webhooks && cfg.contact.webhooks.contact) },
        { icon:'ti-forms',        name:'Google Form',
          sub:'Optional extra form on the contact page',
          ok: !!(cfg.contact && cfg.contact.googleForm && cfg.contact.googleForm.enabled && has(cfg.contact.googleForm.url)) }
      ];

      items.forEach(it=>{
        const row=ui.el(`<div class="svcrow">
          <i class="ti ${esc(it.icon)}"></i>
          <div>
            <div style="font-size:12.5px;font-weight:700">${esc(it.name)}</div>
            <div style="font-size:11px;color:var(--txt2)">${esc(it.sub)}</div>
          </div>
          <span class="pill ${it.ok?'ok':'off'}" style="margin-left:auto">${it.ok?'Connected':'Not set up'}</span>
        </div>`);
        row.appendChild(ui.btn({label:'Set up →', kind:'sm ghost fix', onClick:()=>Admin.go('connections')}));
        conns.appendChild(row);
      });

      body.appendChild(conns);
    }
  });

})();
