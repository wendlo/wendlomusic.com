/* Wendlo band console — Blog section.
   Write, edit, and publish posts. Everything edits Admin.state.draft.blog live. */

(function(){
  const ui = Admin.ui, U = Admin.util;

  function today(){ return new Date().toISOString().slice(0,10); }

  function niceDate(v){
    if(!v) return 'No date yet';
    const t = new Date(v + 'T12:00:00');
    if(isNaN(t)) return v;
    return t.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  }

  Admin.register({
    id: 'blog',
    title: 'Blog',
    icon: 'ti-news',
    desc: 'Tour diaries, updates, and anything else you want to share with visitors.',
    page: 'blog',

    render(body){
      const d = Admin.state.draft;

      /* ---------- turned-off notice ---------- */
      if(!d.pages.enabled.blog){
        const n = ui.group('The blog is turned off');
        const r = document.createElement('div'); r.className = 'arow';
        const pill = ui.el('<span class="pill off fix">Hidden</span>');
        const msg = ui.el('<span style="font-size:12.5px;color:var(--txt2)">The blog is hidden from the site. Visitors can’t see any of this yet.</span>');
        const on = ui.btn({ label:'Turn it on', icon:'ti-eye', kind:'accent', onClick:()=>{
          d.pages.enabled.blog = true;
          Admin.touch();
          Admin.rerender();
          Admin.toast('The blog is now on the site', 'good');
        }});
        on.classList.add('fix');
        r.appendChild(pill); r.appendChild(msg); r.appendChild(on);
        n.appendChild(r);
        body.appendChild(n);
      }

      /* ---------- header: blog title + new post ---------- */
      const g1 = ui.group('Blog page', 'This shows up at the top of the blog page.');
      const titleField = ui.field('Blog title',
        ui.text({ value: d.blog.heading, placeholder: 'Notes from the van',
          onInput: v => { d.blog.heading = v; Admin.touch(); } }),
        'Visitors see this as the big heading above your posts.');
      const addBtn = ui.btn({ label:'New post', icon:'ti-plus', kind:'accent', onClick:()=>{
        const p = { id: U.uid(), title:'', date: today(), cover:'', excerpt:'', body:'', published:false };
        d.blog.posts.unshift(p);
        Admin.touch();
        Admin.rerender();
        openEditor(p);
      }});
      addBtn.classList.add('fix');
      g1.appendChild(ui.row(titleField, addBtn));
      body.appendChild(g1);

      /* ---------- posts list ---------- */
      const g2 = ui.group('Posts', 'Newest first — the site sorts these by date automatically. Drafts stay hidden until you publish them.');
      const posts = [...d.blog.posts].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      if(!posts.length){
        g2.appendChild(ui.el('<div class="gdesc">No posts yet — hit “New post” to write your first one.</div>'));
      }
      posts.forEach(p => g2.appendChild(postRow(p)));
      body.appendChild(g2);

      /* ---------- one row in the list ---------- */
      function postRow(p){
        const row = ui.el(`<div class="subitem" style="margin-bottom:8px">
          <div class="stop">
            <span class="swho">${U.esc(p.title || 'Untitled')}</span>
            <span class="sacts" style="display:flex;gap:6px;align-items:center;flex:none"></span>
          </div>
          <div class="spre">${U.esc(niceDate(p.date))}${p.excerpt ? ' — ' + U.esc(p.excerpt) : ''}</div>
        </div>`);
        const acts = row.querySelector('.sacts');
        acts.appendChild(ui.el(`<span class="pill ${p.published ? 'ok' : 'off'}">${p.published ? 'Live' : 'Draft'}</span>`));
        acts.appendChild(ui.iconBtn({ icon:'ti-pencil', title:'Edit this post', onClick:()=>openEditor(p) }));
        acts.appendChild(ui.iconBtn({ icon:'ti-copy', title:'Duplicate this post', onClick:()=>{
          const dup = JSON.parse(JSON.stringify(p));
          dup.id = U.uid();
          dup.title = (p.title || 'Untitled') + ' (copy)';
          dup.published = false;
          const i = d.blog.posts.indexOf(p);
          d.blog.posts.splice(i + 1, 0, dup);
          Admin.touch();
          Admin.rerender();
          Admin.toast('Post duplicated — the copy starts as a draft');
        }}));
        acts.appendChild(ui.iconBtn({ icon:'ti-trash', title:'Delete this post', danger:true, onClick:async()=>{
          if(!await ui.confirm(`Delete “${p.title || 'Untitled'}”? Visitors won’t see it anymore, and this can’t be undone.`)) return;
          const i = d.blog.posts.indexOf(p);
          if(i > -1) d.blog.posts.splice(i, 1);
          Admin.touch();
          Admin.rerender();
          Admin.toast('Post deleted');
        }}));
        row.addEventListener('click', ()=>openEditor(p));
        return row;
      }

      /* ---------- the post editor ---------- */
      function openEditor(p){
        const box = document.createElement('div');

        /* title + date */
        const titleIn = ui.text({ value: p.title, placeholder: 'Post title',
          onInput: v => { p.title = v; Admin.touch(); } });
        const dateIn = ui.text({ type:'date', value: p.date,
          onInput: v => { p.date = v; Admin.touch(); } });
        box.appendChild(ui.row(
          ui.field('Title', titleIn),
          ui.field('Date', dateIn, 'Posts are sorted by this date on the site.')
        ));

        /* cover image */
        const picker = ui.imagePicker({ value: p.cover, defaultSrc: '',
          onChange: v => { p.cover = v; Admin.touch(); } });
        box.appendChild(ui.field('Cover photo', picker, 'Wide images look best — think 16:9.'));

        /* excerpt */
        const excerptIn = ui.textarea({ value: p.excerpt, rows: 2, placeholder: 'One or two friendly sentences…',
          onInput: v => { p.excerpt = v; Admin.touch(); } });
        box.appendChild(ui.field('Excerpt', excerptIn, 'Teaser shown on the list page.'));

        /* rich body editor */
        const editable = document.createElement('div');
        editable.className = 'atext';
        editable.contentEditable = 'true';
        editable.style.minHeight = '220px';
        editable.style.overflowY = 'auto';
        editable.innerHTML = p.body || '';
        editable.addEventListener('input', ()=>{ p.body = editable.innerHTML; Admin.touch(); });

        function exec(cmd, arg){
          editable.focus();
          document.execCommand(cmd, false, arg == null ? null : arg);
          p.body = editable.innerHTML;
          Admin.touch();
        }

        const linkBtn = ui.iconBtn({ icon:'ti-link', title:'Turn the selected text into a link', onClick: async()=>{
          const sel = window.getSelection();
          const range = (sel && sel.rangeCount && editable.contains(sel.anchorNode)) ? sel.getRangeAt(0).cloneRange() : null;
          const url = await ui.prompt('Link address', 'https://…');
          if(url === null) return;
          const u = url.trim();
          if(!u) return;
          editable.focus();
          if(range){
            const s = window.getSelection();
            s.removeAllRanges();
            s.addRange(range);
          }
          document.execCommand('createLink', false, u);
          p.body = editable.innerHTML;
          Admin.touch();
        }});

        const bar = document.createElement('div');
        bar.className = 'arow';
        bar.style.marginBottom = '8px';
        /* keep the text selection alive when a toolbar button is pressed */
        bar.addEventListener('mousedown', ev => ev.preventDefault());
        [
          ui.iconBtn({ icon:'ti-bold', title:'Bold', onClick:()=>exec('bold') }),
          ui.iconBtn({ icon:'ti-italic', title:'Italic', onClick:()=>exec('italic') }),
          ui.iconBtn({ icon:'ti-heading', title:'Heading', onClick:()=>exec('formatBlock', '<h3>') }),
          ui.iconBtn({ icon:'ti-quote', title:'Quote', onClick:()=>exec('formatBlock', '<blockquote>') }),
          linkBtn,
          ui.iconBtn({ icon:'ti-clear-formatting', title:'Clear styling', onClick:()=>exec('removeFormat') })
        ].forEach(b => { b.classList.add('fix'); bar.appendChild(b); });

        const bodyWrap = document.createElement('div');
        bodyWrap.appendChild(bar);
        bodyWrap.appendChild(editable);
        box.appendChild(ui.field('Story', bodyWrap, 'Select some words, then use the buttons to style them. The preview updates as you type.'));

        /* published toggle */
        const tog = ui.toggle({ checked: !!p.published, label:'Published',
          onChange: v => { p.published = v; Admin.touch(); } });
        box.appendChild(ui.field('', tog, 'Drafts are only visible here — flip this on when the post is ready for visitors.'));

        /* footer — the list refreshes on ANY close path (Done, ✕, or backdrop) */
        const done = ui.btn({ label:'Done', onClick:()=>h.close() });
        const h = ui.modal({ title: p.title ? 'Edit post' : 'New post', body: box, actions: [done], wide: true,
          onClose: ()=>Admin.rerender() });
      }
    }
  });
})();
