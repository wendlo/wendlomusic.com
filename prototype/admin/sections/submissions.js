/* Wendlo band console — Submissions section.
   Inbox for contact-form messages and email-list signups stored by the site. */

(function(){
  const esc = s => Admin.util.esc(s);

  /* which tab is showing: 'contact' (Messages) or 'email' (Email list) */
  let tab = 'contact';

  /* map data keys → the friendly labels from the form settings, so the
     detail view reads like the form the fan filled out */
  function fieldLabels(type){
    const c = (Admin.state.draft.contact || {});
    const form = type === 'contact' ? c.messageForm : c.emailForm;
    const map = {};
    ((form && form.fields) || []).forEach(f => { if (f && f.key) map[f.key] = f.label || f.key; });
    return map;
  }
  function labelFor(key, labels){
    if (labels[key]) return labels[key];
    return String(key).charAt(0).toUpperCase() + String(key).slice(1);
  }

  function whoFor(s){
    const d = s.data || {};
    return d.name || d.email || 'Someone';
  }
  function whenFor(ts){
    const d = new Date(ts);
    if (isNaN(d)) return '';
    return d.toLocaleString(undefined, { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' });
  }
  function previewFor(s){
    const d = s.data || {};
    return [d.subject, d.message, d.meal].filter(Boolean).join(' — ');
  }

  function openDetail(s, rebuild){
    const labels = fieldLabels(s.type);
    const box = document.createElement('div');
    box.className = 'subdetail';

    Object.keys(s.data || {}).forEach(k => {
      const v = s.data[k];
      if (v === '' || v == null) return;
      box.appendChild(Admin.ui.el(
        `<div class="drow"><div class="dk">${esc(labelFor(k, labels))}</div><div class="dv">${esc(v)}</div></div>`
      ));
    });
    box.appendChild(Admin.ui.el(
      `<div class="drow"><div class="dk">Received</div><div class="dv">${esc(whenFor(s.ts))}</div></div>`
    ));

    const actions = [];
    const del = Admin.ui.btn({ label:'Delete', icon:'ti-trash', kind:'danger', onClick: async () => {
      const ok = await Admin.ui.confirm(
        s.type === 'contact'
          ? 'Delete this message for good? There’s no undo.'
          : 'Remove this signup from the list here? There’s no undo.'
      );
      if (!ok) return;
      Admin.subs.remove(s.id);
      handle.close();
      Admin.touch();          // refreshes the sidebar badge
      rebuild();
      Admin.toast('Deleted');
    }});
    actions.push(del);

    const email = (s.data || {}).email;
    if (email && /@/.test(String(email))){
      actions.push(Admin.ui.btn({ label:'Reply', icon:'ti-mail', kind:'ghost', onClick: () => {
        window.open('mailto:' + String(email).trim());
      }}));
    }

    actions.push(Admin.ui.btn({ label:'Close', kind:'ghost', onClick: () => handle.close() }));

    const handle = Admin.ui.modal({
      title: s.type === 'contact' ? 'Message from ' + whoFor(s) : 'Signup from ' + whoFor(s),
      body: box,
      actions
    });
  }

  Admin.register({
    id: 'submissions',
    title: 'Submissions',
    icon: 'ti-inbox',
    desc: 'Messages and email signups from fans land here.',
    page: 'contact',
    badge(){ const n = Admin.subs.unreadCount(); return n ? String(n) : ''; },

    render(body){
      /* --- where these live --- */
      const note = Admin.ui.group('Where these live',
        'In this prototype, submissions are saved in this browser — once you set your webhooks in Connections, new ones also go straight to your Google Sheet and Mailchimp.');
      body.appendChild(note);

      /* --- inbox (tabs + toolbar + list, rebuilt locally so switching is snappy) --- */
      const inbox = Admin.ui.group();
      const content = document.createElement('div');
      inbox.appendChild(content);
      body.appendChild(inbox);

      function rebuild(){
        content.innerHTML = '';

        /* tab row */
        const msgTab = Admin.ui.btn({
          label:'Messages', icon:'ti-mail',
          kind: 'sm ' + (tab === 'contact' ? 'accent' : 'ghost'),
          onClick: () => { if (tab !== 'contact'){ tab = 'contact'; rebuild(); } }
        });
        const listTab = Admin.ui.btn({
          label:'Email list', icon:'ti-users',
          kind: 'sm ' + (tab === 'email' ? 'accent' : 'ghost'),
          onClick: () => { if (tab !== 'email'){ tab = 'email'; rebuild(); } }
        });
        const tabs = Admin.ui.row(msgTab, listTab);
        tabs.style.marginBottom = '10px';
        content.appendChild(tabs);

        const items = Admin.subs.list(tab);
        const unread = items.filter(s => !s.read).length;

        /* toolbar row */
        const exportBtn = Admin.ui.btn({ label:'Export CSV', icon:'ti-download', kind:'ghost sm', onClick: () => {
          Admin.subs.exportCsv(tab);
        }});
        const readBtn = Admin.ui.btn({ label:'Mark all read', kind:'ghost sm', onClick: () => {
          if (!unread){ Admin.toast('All caught up already'); return; }
          items.forEach(s => { if (!s.read) Admin.subs.markRead(s.id, true); });
          Admin.touch();
          rebuild();
          Admin.toast('All marked as read', 'good');
        }});
        const counts = Admin.ui.el(
          `<span class="hint" style="margin-left:auto">${items.length} total${unread ? ' · ' + unread + ' unread' : ''}</span>`
        );
        const toolbar = Admin.ui.row(exportBtn, readBtn, counts);
        toolbar.style.marginBottom = '12px';
        content.appendChild(toolbar);

        /* list */
        if (!items.length){
          const emptyMsg = tab === 'contact'
            ? 'Nothing yet — when fans write in, it lands here.'
            : 'Nothing yet — when fans join the email list, they land here.';
          content.appendChild(Admin.ui.el(`<div class="hint" style="margin:14px 0 4px">${esc(emptyMsg)}</div>`));
          return;
        }

        const list = document.createElement('div');
        list.className = 'sublist';
        items.forEach(s => {
          const item = Admin.ui.el(
            `<div class="subitem ${s.read ? '' : 'unread'}">
              <div class="stop">
                <span class="swho">${esc(whoFor(s))}</span>
                <span class="swhen">${esc(whenFor(s.ts))}</span>
              </div>
              ${previewFor(s) ? `<div class="spre">${esc(previewFor(s))}</div>` : ''}
            </div>`
          );
          item.addEventListener('click', () => {
            if (!s.read){
              Admin.subs.markRead(s.id, true);
              s.read = true;
              Admin.touch();     // refreshes the sidebar badge
              rebuild();
            }
            openDetail(s, rebuild);
          });
          list.appendChild(item);
        });
        content.appendChild(list);
      }

      rebuild();
    }
  });
})();
