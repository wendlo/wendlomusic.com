/* Wendlo band console — Music section.
   Manages draft.music.entries: songs (artwork + listen links) and YouTube embeds. */

(function(){
  const { ui, util } = Admin;

  /* service key → [display name, tabler icon] */
  const SERVICES = {
    spotify: ['Spotify',     'ti-brand-spotify'],
    apple:   ['Apple Music', 'ti-brand-apple'],
    amazon:  ['Amazon Music','ti-brand-amazon'],
    deezer:  ['Deezer',      'ti-brand-deezer'],
    itunes:  ['iTunes',      'ti-music'],
    napster: ['Napster',     'ti-music'],
    tidal:   ['Tidal',       'ti-brand-tidal'],
    youtube: ['YouTube',     'ti-brand-youtube']
  };
  const SVC_KEYS = Object.keys(SERVICES);

  function entries(){ return Admin.state.draft.music.entries; }

  function blankLinks(){
    const links = {};
    SVC_KEYS.forEach(k => { links[k] = { url:'', on:false }; });
    return links;
  }

  /* make sure an older/imported song has a slot for every service */
  function ensureLinks(e){
    if(!e.links) e.links = blankLinks();
    SVC_KEYS.forEach(k => { if(!e.links[k]) e.links[k] = { url:'', on:false }; });
  }

  function onLinkCount(e){
    ensureLinks(e);
    return SVC_KEYS.filter(k => e.links[k].on && e.links[k].url.trim()).length;
  }

  /* ============ song editor ============ */
  function openSongEditor(e){
    ensureLinks(e);
    const body = document.createElement('div');

    body.appendChild(ui.field('Title',
      ui.text({ value:e.title, placeholder:'Song name', onInput:v => { e.title = v; Admin.touch(); } })));

    body.appendChild(ui.field('Tag',
      ui.text({ value:e.tag, placeholder:'Single / EP / Cover…', onInput:v => { e.tag = v; Admin.touch(); } }),
      'A little label under the title — like “Single” or “EP”.'));

    body.appendChild(ui.field('Blurb',
      ui.textarea({ value:e.blurb, rows:3, placeholder:'A sentence or two about the song…',
        onInput:v => { e.blurb = v; Admin.touch(); } }),
      'Visitors see this next to the artwork. Keep it short and personal.'));

    body.appendChild(ui.field('Artwork',
      ui.imagePicker({ value:e.art, defaultSrc:'', onChange:v => { e.art = v; Admin.touch(); } }),
      'Square images look best.'));

    const svcWrap = document.createElement('div');
    SVC_KEYS.forEach(svc => {
      const [name, icon] = SERVICES[svc];
      const row = document.createElement('div');
      row.className = 'svcrow';
      row.appendChild(ui.el(`<span class="svcname"><i class="ti ${icon}"></i>${util.esc(name)}</span>`));
      row.appendChild(ui.toggle({ checked:e.links[svc].on,
        onChange:v => { e.links[svc].on = v; Admin.touch(); } }));
      row.appendChild(ui.text({ value:e.links[svc].url, placeholder:'https://…',
        onInput:v => { e.links[svc].url = v; Admin.touch(); } }));
      svcWrap.appendChild(row);
    });
    body.appendChild(ui.field('Where people can listen', svcWrap,
      'Toggle a service on and give it a link. Off or empty = hidden on the site. Links from an import can be overridden — just edit the box.'));

    if(e.source){
      const srcWrap = document.createElement('div');
      srcWrap.appendChild(ui.el(
        `<div class="hint" style="margin:10px 0 6px">Imported from: ${util.esc(e.source)}</div>`));
      const reBtn = ui.btn({ label:'Re-import', icon:'ti-refresh', kind:'sm ghost',
        onClick: async (b) => {
          const ok = await ui.confirm('Fetch the smart link again and replace the listening links below for every service it finds? Your titles and blurb stay as they are.');
          if(!ok) return;
          b.disabled = true; b.innerHTML = '<i class="ti ti-refresh"></i>Fetching…';
          try{
            const res = await util.parseSmartLink(e.source);
            SVC_KEYS.forEach(svc => {
              if(res.links[svc]) e.links[svc] = { url:res.links[svc], on:true };
            });
            Admin.touch();
            Admin.toast('Listening links refreshed', 'good');
            h.close(); openSongEditor(e);   // repaint with fresh values
          }catch(err){
            Admin.toast(err.message, 'bad');
            b.disabled = false; b.innerHTML = '<i class="ti ti-refresh"></i>Re-import';
          }
        }});
      srcWrap.appendChild(reBtn);
      body.appendChild(srcWrap);
    }

    const done = ui.btn({ label:'Done', icon:'ti-check', onClick:() => h.close() });
    const h = ui.modal({ title: e.title || 'New song', body, actions:[done], wide:true,
      onClose: () => Admin.rerender() });
  }

  /* ============ youtube editor ============ */
  function openYoutubeEditor(e){
    const body = document.createElement('div');

    const status = document.createElement('div');
    status.className = 'hint';
    function paintStatus(){
      const v = String(e.url || '').trim();
      if(!v){ status.innerHTML = 'Paste any YouTube link — a watch page, a short share link, whatever you have.'; return; }
      status.innerHTML = util.ytId(v)
        ? '<span class="pill ok"><i class="ti ti-check"></i>Looks good</span>'
        : '<span class="pill err"><i class="ti ti-alert-triangle"></i>Not a YouTube link I recognize</span>';
    }
    const urlField = ui.field('YouTube link',
      ui.text({ value:e.url, placeholder:'https://www.youtube.com/watch?v=…',
        onInput:v => { e.url = v; Admin.touch(); paintStatus(); } }));
    urlField.appendChild(status);
    paintStatus();
    body.appendChild(urlField);

    body.appendChild(ui.field('Caption (just for you)',
      ui.text({ value:e.title, placeholder:'e.g. September — official video',
        onInput:v => { e.title = v; Admin.touch(); } }),
      'Only shows in this console, so you can tell your videos apart. Visitors just see the video.'));

    const done = ui.btn({ label:'Done', icon:'ti-check', onClick:() => h.close() });
    const h = ui.modal({ title: e.title || 'YouTube video', body, actions:[done],
      onClose: () => Admin.rerender() });
  }

  /* ============ import from smart link ============ */
  function openImportModal(){
    const body = document.createElement('div');
    const input = ui.text({ placeholder:'https://distrokid.com/hyperfollow/…' });
    body.appendChild(ui.field('Smart link', input,
      'Paste the smart link — artwork + listening links are pulled in automatically. DistroKid HyperFollow and TuneCore links both work.'));

    const cancel = ui.btn({ label:'Cancel', kind:'ghost', onClick:() => h.close() });
    const go = ui.btn({ label:'Import', icon:'ti-sparkles', kind:'accent',
      onClick: async (b) => {
        const url = input.value.trim();
        if(!url){ Admin.toast('Paste a link first', 'bad'); input.focus(); return; }
        b.disabled = true; b.innerHTML = '<i class="ti ti-sparkles"></i>Fetching…';
        try{
          const res = await util.parseSmartLink(url);
          const links = {};
          SVC_KEYS.forEach(svc => {
            links[svc] = { url: res.links[svc] || '', on: !!res.links[svc] };
          });
          const entry = {
            id: util.uid(), type:'song',
            title: res.title || '', tag:'', blurb:'',
            art: res.artwork || '', source: url, links
          };
          h.close();
          entries().push(entry);
          Admin.touch();
          Admin.rerender();
          Admin.toast('Imported — give it a quick look', 'good');
          openSongEditor(entry);   // straight into review
        }catch(err){
          Admin.toast(err.message, 'bad');
          b.disabled = false; b.innerHTML = '<i class="ti ti-sparkles"></i>Import';
        }
      }});

    const h = ui.modal({ title:'Import from a link', body, actions:[cancel, go] });
    setTimeout(() => input.focus(), 50);
  }

  /* ============ add / duplicate / delete ============ */
  function addSong(){
    const entry = { id:util.uid(), type:'song', title:'', tag:'', blurb:'', art:'', source:'', links:blankLinks() };
    entries().push(entry);
    Admin.touch(); Admin.rerender();
    openSongEditor(entry);
  }

  function addYoutube(){
    const entry = { id:util.uid(), type:'youtube', title:'', url:'' };
    entries().push(entry);
    Admin.touch(); Admin.rerender();
    openYoutubeEditor(entry);
  }

  function duplicateEntry(e){
    const copy = JSON.parse(JSON.stringify(e));
    copy.id = util.uid();
    if(copy.type === 'song') copy.title = copy.title ? copy.title + ' (copy)' : '';
    const list = entries();
    list.splice(list.indexOf(e) + 1, 0, copy);
    Admin.touch(); Admin.rerender();
    Admin.toast('Duplicated');
  }

  async function deleteEntry(e){
    const what = e.type === 'youtube'
      ? (e.title ? `the video “${e.title}”` : 'this YouTube video')
      : (e.title ? `“${e.title}”` : 'this song');
    const ok = await ui.confirm(`Remove ${what} from the music page? Visitors won’t see it anymore. (You can still discard changes before publishing.)`);
    if(!ok) return;
    const list = entries();
    const i = list.indexOf(e);
    if(i > -1) list.splice(i, 1);
    Admin.touch(); Admin.rerender();
    Admin.toast('Removed');
  }

  /* ============ list row ============ */
  function renderRow(e){
    const frag = document.createDocumentFragment();

    if(e.type === 'youtube'){
      frag.appendChild(ui.el('<div class="dthumb"><i class="ti ti-brand-youtube"></i></div>'));
      frag.appendChild(ui.el(`<div style="flex:1;min-width:0">
        <div class="dtitle">${util.esc(e.title || 'YouTube video')}</div>
        <div class="dsub">Video embed</div></div>`));
    }else{
      const thumb = ui.el('<div class="dthumb"><i class="ti ti-music"></i></div>');
      if(e.art){ thumb.style.backgroundImage = `url("${util.adminSrc(e.art)}")`; thumb.innerHTML = ''; }
      frag.appendChild(thumb);
      const n = onLinkCount(e);
      frag.appendChild(ui.el(`<div style="flex:1;min-width:0">
        <div class="dtitle">${util.esc(e.title || 'Untitled song')}</div>
        <div class="dsub">Song · ${n} listen link${n === 1 ? '' : 's'} on</div></div>`));
    }

    const acts = document.createElement('div');
    acts.className = 'dacts';
    acts.appendChild(ui.iconBtn({ icon:'ti-pencil', title:'Edit',
      onClick:() => e.type === 'youtube' ? openYoutubeEditor(e) : openSongEditor(e) }));
    acts.appendChild(ui.iconBtn({ icon:'ti-copy', title:'Duplicate',
      onClick:() => duplicateEntry(e) }));
    acts.appendChild(ui.iconBtn({ icon:'ti-trash', title:'Remove', danger:true,
      onClick:() => deleteEntry(e) }));
    frag.appendChild(acts);

    return frag;
  }

  /* ============ section ============ */
  Admin.register({
    id:'music', title:'Music', icon:'ti-music',
    desc:'The songs and videos visitors see on the music page — add releases, reorder them, and manage listening links.',
    page:'music',
    render(body){

      /* --- add --- */
      const add = ui.group('Add to the page');
      add.appendChild(ui.row(
        ui.btn({ label:'Import from a link', icon:'ti-sparkles', kind:'accent', onClick:openImportModal }),
        ui.btn({ label:'Add a song manually', icon:'ti-plus', onClick:addSong }),
        ui.btn({ label:'Add a YouTube video', icon:'ti-brand-youtube', kind:'ghost', onClick:addYoutube })
      ));
      add.appendChild(ui.el('<div class="hint" style="margin-top:8px">Importing is the easy way — paste a DistroKid HyperFollow or TuneCore link and the artwork and listening links fill themselves in.</div>'));
      body.appendChild(add);

      /* --- order --- */
      const order = ui.group('Page order',
        'Drag to reorder — songs alternate sides automatically; videos sit full-width in the flow.');
      const list = entries();
      if(!list.length){
        order.appendChild(ui.el('<div class="hint">Nothing here yet — add a song or a video above and it shows up on the music page right away.</div>'));
      }else{
        order.appendChild(ui.dragList({
          items: list,
          key: e => e.id,
          render: renderRow,
          onReorder: newOrder => {
            Admin.state.draft.music.entries = newOrder;
            Admin.touch();
          }
        }));
      }
      body.appendChild(order);
    }
  });
})();
