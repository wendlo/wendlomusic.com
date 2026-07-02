/* Wendlo band console — core runtime + UI kit.
   Sections register with Admin.register({id,title,icon,desc?,page?,badge?,render(body)}).
   They read/write Admin.state.draft (the full config object) and call Admin.touch() after changes. */

window.Admin = (function(){

  /* ================= state ================= */
  const state = { draft: WendloStore.draft(), section: 'dashboard' };   // draft refreshed in boot() after remote content loads
  const sections = [];
  let bootDone = false;

  const $ = sel => document.querySelector(sel);
  const debounce = (fn,ms)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

  /* ================= utils ================= */
  const util = {
    uid: () => WendloStore.uid(),
    esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
    debounce,
    ytId(url){ const m=String(url||'').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/); return m?m[1]:''; },

    /* config stores site-relative paths (assets/…); the admin runs from /admin/, so prefix for display */
    adminSrc(s){ return (!s || /^(data:|https?:|\/)/i.test(s)) ? s : '../'+s; },

    /* downscale an uploaded image to a storable data URL */
    fileToDataUrl(file, maxDim=1600, quality=0.82){
      return new Promise((resolve,reject)=>{
        const fr=new FileReader();
        fr.onerror=()=>reject(new Error('Could not read file'));
        fr.onload=()=>{
          const img=new Image();
          img.onerror=()=>reject(new Error('Not an image'));
          img.onload=()=>{
            let {width:w,height:h}=img;
            const scale=Math.min(1, maxDim/Math.max(w,h));
            w=Math.round(w*scale); h=Math.round(h*scale);
            const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
            cv.getContext('2d').drawImage(img,0,0,w,h);
            const isPng=/png|gif|webp/i.test(file.type) && hasAlpha(cv);
            resolve(isPng ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg',quality));
          };
          img.src=fr.result;
        };
        fr.readAsDataURL(file);
      });
      function hasAlpha(cv){
        try{ const d=cv.getContext('2d').getImageData(0,0,Math.min(cv.width,64),Math.min(cv.height,64)).data;
          for(let i=3;i<d.length;i+=4) if(d[i]<250) return true; }catch(_){}
        return false;
      }
    },

    async fetchText(url){
      /* 1) our own server's proxy (serve.py /proxy — no CORS, most reliable; the
            production build does the same thing in an API route) */
      try{ const r=await fetch('/proxy?url='+encodeURIComponent(url));
        if(r.ok){ const t=await r.text(); if(t && t.length>200 && !t.startsWith('proxy:')) return t; } }catch(_){}
      /* 2) direct (works only if the remote site sends CORS headers) */
      try{ const r=await fetch(url,{redirect:'follow'}); if(r.ok) return await r.text(); }catch(_){}
      /* 3) public CORS proxies as a last resort */
      for(const proxy of [u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
                          u=>`https://corsproxy.io/?url=${encodeURIComponent(u)}`]){
        try{ const r=await fetch(proxy(url)); if(r.ok){ const t=await r.text(); if(t && t.length>200) return t; } }catch(_){}
      }
      throw new Error('Could not fetch that page. Make sure the site is running via serve.py, or enter the details manually.');
    },

    /* Parse a DistroKid HyperFollow / TuneCore / Linkfire-style smart-link page:
       returns {title, artwork, links:{spotify,apple,amazon,deezer,itunes,napster,tidal,youtube}} */
    async parseSmartLink(url){
      const raw=await util.fetchText(url);
      /* metas via a real DOM parse (robust against attribute order, entities, og:image:url variants) */
      const doc=new DOMParser().parseFromString(raw,'text/html');
      const meta=p=>{ const el=doc.querySelector(`meta[property="${p}"],meta[name="${p}"]`); return el?(el.getAttribute('content')||''):''; };
      let title=meta('og:title')||meta('twitter:title')||doc.title||'';
      title=title.split(/\s*[|–—]\s*(?:DistroKid|HyperFollow|TuneCore|Linkfire|Listen now).*/i)[0]
                 .replace(/\s*(?:by|—|-)\s*Wendlo\s*$/i,'').trim();
      const artwork=meta('og:image')||meta('og:image:url')||meta('twitter:image')||'';
      /* smart-link pages (HyperFollow etc.) HTML-entity-encode their URLs — decode before matching */
      const txt=raw
        .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n))
        .replace(/&#x([0-9a-fA-F]+);/g,(_,n)=>String.fromCharCode(parseInt(n,16)))
        .replace(/\\u0026/g,'&').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
      const PATTERNS={
        spotify:/https?:\/\/open\.spotify\.com\/(?:track|album)\/[\w]+[^"'\s\\<>]*/i,
        apple:/https?:\/\/music\.apple\.com\/[^"'\s\\<>]+/i,
        amazon:/https?:\/\/(?:music\.amazon\.[a-z.]+|www\.amazon\.[a-z.]+\/music)[^"'\s\\<>]*/i,
        deezer:/https?:\/\/(?:www\.)?deezer\.com\/[^"'\s\\<>]+|https?:\/\/deezer\.page\.link\/[^"'\s\\<>]+/i,
        itunes:/https?:\/\/(?:itunes|geo\.itunes)\.apple\.com\/(?!lookup)[^"'\s\\<>]+/i,
        napster:/https?:\/\/[a-z.]*napster\.com\/[^"'\s\\<>]+/i,
        tidal:/https?:\/\/(?:listen\.)?tidal\.com\/[^"'\s\\<>]+/i,
        youtube:/https?:\/\/(?:music\.youtube\.com|www\.youtube\.com\/watch|youtu\.be\/)[^"'\s\\<>]*/i
      };
      const links={};
      for(const [svc,re] of Object.entries(PATTERNS)){
        const m=txt.match(re);
        if(m) links[svc]=m[0];
      }
      return { title, artwork, links };
    },

    downloadFile(name, text, mime='text/plain'){
      const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([text],{type:mime}));
      a.download=name; a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    },
    csv(rows){ return rows.map(r=>r.map(c=>{ c=String(c==null?'':c); return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c; }).join(',')).join('\n'); }
  };

  /* ================= submissions ================= */
  const subs = {
    list: t => WendloStore.submissions.list(t),
    remove: id => WendloStore.submissions.remove(id),
    markRead: (id,v) => WendloStore.submissions.markRead(id,v),
    unreadCount: () => WendloStore.submissions.unreadCount(),
    exportCsv(type){
      const items=subs.list(type); if(!items.length) return Admin.toast('Nothing to export','bad');
      const keys=[...new Set(items.flatMap(s=>Object.keys(s.data)))];
      const rows=[['date',...keys], ...items.map(s=>[s.ts,...keys.map(k=>s.data[k]||'')])];
      util.downloadFile(`wendlo-${type}-submissions.csv`, util.csv(rows), 'text/csv');
    }
  };

  /* ================= preview ================= */
  const pv = { ready:false, device:'desktop' };
  function pvPush(){
    const f=$('#pvIframe'); if(!f||!f.contentWindow) return;
    f.contentWindow.postMessage({type:'wendlo-config',config:state.draft},'*');
  }
  const pvPushDebounced = debounce(pvPush,140);
  function pvGoto(page){ const f=$('#pvIframe'); if(f&&f.contentWindow) f.contentWindow.postMessage({type:'wendlo-goto',page},'*'); }
  function pvSetDevice(mode){
    pv.device=mode;
    document.querySelectorAll('#pvDevices button').forEach(b=>b.classList.toggle('on',b.dataset.pv===mode));
    const f=$('#pvIframe'); if(f&&f.contentWindow) f.contentWindow.postMessage({type:'wendlo-device',mode:mode==='desktop'?'desktop':'mobile'},'*');
    layoutPreview();
  }
  const PV_SIZES={ 'desktop':[1280,800], 'mobile-p':[390,780], 'mobile-l':[780,390] };
  function layoutPreview(){
    const stageEl=$('#pvStage'), frame=$('#pvFrame'); if(!stageEl||!frame) return;
    const [w,h]=PV_SIZES[pv.device];
    const availW=stageEl.clientWidth-28, availH=stageEl.clientHeight-28;
    const scale=Math.min(availW/w, availH/h, 1);
    frame.className='pv-frame '+pv.device;
    frame.style.width=Math.round(w*scale)+'px';
    frame.style.height=Math.round(h*scale)+'px';
  }
  window.addEventListener('resize',debounce(layoutPreview,80));
  window.addEventListener('message',e=>{ if((e.data||{}).type==='wendlo-ready'){ pv.ready=true; pvPush(); pvSetDevice(pv.device); } });

  /* ================= dirty / publish ================= */
  function refreshPubState(){
    const dirty=WendloStore.isDirty();
    const el=$('#pubState');
    el.classList.toggle('dirty',dirty);
    el.innerHTML=`<span class="dot"></span>${dirty?'Unsaved changes — visitors still see the last published version':'Everything published'}`;
    $('#btnPublish').disabled=!dirty;
    $('#btnDiscard').disabled=!dirty;
  }
  function touch(){
    WendloStore.saveDraft(state.draft);
    pvPushDebounced();
    refreshPubState();
    renderSidebar();  // badges may change
  }
  function publish(){
    if(!WendloStore.publish(state.draft)){ toast('Could not save — storage may be full (try smaller images)','bad'); return; }
    refreshPubState(); toast('Published — the site is live with your changes','good');
  }
  async function discard(){
    if(!await ui.confirm('Throw away all unpublished changes and go back to the live version?')) return;
    WendloStore.discardDraft();
    state.draft=WendloStore.draft();
    pvPush(); refreshPubState(); rerender(); renderSidebar();
    toast('Changes discarded');
  }

  /* ================= toasts / modal ================= */
  function toast(msg,kind){
    const t=document.createElement('div'); t.className='toast '+(kind||'');
    t.innerHTML=(kind==='good'?'<i class="ti ti-check"></i>':kind==='bad'?'<i class="ti ti-alert-triangle"></i>':'')+util.esc(msg);
    $('#toasts').appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),320); },2600);
  }

  /* ================= UI kit ================= */
  const ui = {
    el(html){ const d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstElementChild; },

    group(title,desc){
      const g=document.createElement('div'); g.className='ag';
      if(title) g.appendChild(ui.el(`<h2>${util.esc(title)}</h2>`));
      if(desc) g.appendChild(ui.el(`<div class="gdesc">${desc}</div>`));
      return g;
    },
    field(label,control,hint){
      const f=document.createElement('div'); f.className='afield';
      if(label) f.appendChild(ui.el(`<label>${util.esc(label)}</label>`));
      f.appendChild(control);
      if(hint) f.appendChild(ui.el(`<div class="hint">${hint}</div>`));
      return f;
    },
    row(...els){ const r=document.createElement('div'); r.className='arow'; els.forEach(e=>e&&r.appendChild(e)); return r; },

    text({value='',placeholder='',mono=false,type='text',onInput}={}){
      const i=document.createElement('input'); i.type=type; i.className='atext'+(mono?' mono':'');
      i.value=value; i.placeholder=placeholder;
      if(onInput) i.addEventListener('input',()=>onInput(i.value,i));
      return i;
    },
    textarea({value='',rows=3,placeholder='',onInput}={}){
      const t=document.createElement('textarea'); t.className='atext'; t.rows=rows; t.value=value; t.placeholder=placeholder;
      if(onInput) t.addEventListener('input',()=>onInput(t.value,t));
      return t;
    },
    select({options=[],value,onChange}={}){
      const s=document.createElement('select'); s.className='asel';
      options.forEach(o=>{ const op=document.createElement('option'); op.value=o.value; op.textContent=o.label; s.appendChild(op); });
      if(value!==undefined) s.value=value;
      if(onChange) s.addEventListener('change',()=>onChange(s.value,s));
      return s;
    },
    color({value='#E0A32B',onChange}={}){
      const i=document.createElement('input'); i.type='color'; i.className='acolor'; i.value=value;
      if(onChange) i.addEventListener('input',()=>onChange(i.value,i));
      return i;
    },
    toggle({checked=false,label='',onChange}={}){
      const l=ui.el(`<label class="atog"><input type="checkbox"><span class="knob"></span>${label?`<span class="tlabel">${util.esc(label)}</span>`:''}</label>`);
      const input=l.querySelector('input'); input.checked=checked;
      if(onChange) input.addEventListener('change',()=>onChange(input.checked,input));
      return l;
    },
    btn({label='',icon='',kind='',onClick}={}){
      const b=document.createElement('button'); b.type='button'; b.className='abtn '+kind;
      b.innerHTML=(icon?`<i class="ti ${icon}"></i>`:'')+util.esc(label);
      if(onClick) b.addEventListener('click',()=>onClick(b));
      return b;
    },
    iconBtn({icon,title='',danger=false,onClick}={}){
      const b=document.createElement('button'); b.type='button'; b.className='iconbtn'+(danger?' danger':''); b.title=title;
      b.innerHTML=`<i class="ti ${icon}"></i>`;
      if(onClick) b.addEventListener('click',e=>{ e.stopPropagation(); onClick(b); });
      return b;
    },

    /* image picker: upload (downscaled) / paste URL / reset to default */
    imagePicker({value='',defaultSrc='',onChange}={}){
      const wrap=ui.el(`<div class="aimg">
        <div class="thumb"><i class="ti ti-photo"></i></div>
        <div class="acts">
          <div class="arow">
            <button type="button" class="abtn sm fix"><i class="ti ti-upload"></i>Upload</button>
            <button type="button" class="abtn sm ghost fix">URL…</button>
            <button type="button" class="abtn sm ghost fix reset">Reset</button>
          </div>
          <div class="note"></div>
        </div>
        <input type="file" accept="image/*" hidden>
      </div>`);
      const thumb=wrap.querySelector('.thumb'), note=wrap.querySelector('.note'), file=wrap.querySelector('input[type=file]');
      const [upBtn,urlBtn,resetBtn]=wrap.querySelectorAll('button');
      let cur=value;
      function paint(){
        const src=util.adminSrc(cur||defaultSrc);
        thumb.style.backgroundImage=src?`url("${src}")`:'';
        thumb.innerHTML=src?'':'<i class="ti ti-photo"></i>';
        note.textContent=cur?(cur.startsWith('data:')?'Custom upload':'Custom URL'):'Using the site default';
        resetBtn.style.display=cur?'':'none';
      }
      upBtn.addEventListener('click',()=>file.click());
      file.addEventListener('change',async()=>{
        if(!file.files[0]) return;
        try{ cur=await util.fileToDataUrl(file.files[0]); paint(); onChange&&onChange(cur); }
        catch(err){ toast(err.message,'bad'); }
        file.value='';
      });
      urlBtn.addEventListener('click',async()=>{
        const v=await ui.prompt('Image URL','https://…',cur&&!cur.startsWith('data:')?cur:'');
        if(v===null) return;
        cur=v.trim(); paint(); onChange&&onChange(cur);
      });
      resetBtn.addEventListener('click',()=>{ cur=''; paint(); onChange&&onChange(''); });
      paint();
      return wrap;
    },

    /* focal picker: click the image to choose the crop focus */
    focalPicker({src,value='50% 50%',onChange}={}){
      const wrap=ui.el(`<div class="afocal"><img alt=""><div class="cross"></div></div>`);
      const img=wrap.querySelector('img'), cross=wrap.querySelector('.cross');
      img.src=src;
      function place(v){ const m=String(v||'50% 50%').match(/([\d.]+)%\s+([\d.]+)%/); const x=m?+m[1]:50, y=m?+m[2]:50;
        cross.style.left=x+'%'; cross.style.top=y+'%'; }
      place(value);
      wrap.addEventListener('click',e=>{
        const r=wrap.getBoundingClientRect();
        const x=Math.round((e.clientX-r.left)/r.width*100), y=Math.round((e.clientY-r.top)/r.height*100);
        const v=`${x}% ${y}%`; place(v); onChange&&onChange(v);
      });
      wrap.setSrc=(s)=>{ img.src=s; };
      return wrap;
    },

    /* drag-to-reorder list */
    dragList({items,key,render,onReorder}={}){
      const list=document.createElement('div'); list.className='adrag';
      let order=[...items];
      function build(){
        list.innerHTML='';
        order.forEach((item,idx)=>{
          const row=document.createElement('div'); row.className='adrag-item'; row.draggable=false;
          const grip=ui.el('<span class="grip" title="Drag to reorder"><i class="ti ti-grip-vertical"></i></span>');
          row.appendChild(grip);
          const main=document.createElement('div'); main.className='dmain';
          main.appendChild(render(item,idx));
          row.appendChild(main);
          row.dataset.key=key(item);
          grip.addEventListener('pointerdown',e=>startDrag(e,row));
          list.appendChild(row);
        });
      }
      let dragRow=null;
      function startDrag(e,row){
        e.preventDefault(); dragRow=row; row.classList.add('dragging');
        const move=ev=>{
          const rows=[...list.children].filter(r=>r!==dragRow);
          let target=null;
          for(const r of rows){ const rc=r.getBoundingClientRect(); if(ev.clientY < rc.top+rc.height/2){ target=r; break; } }
          rows.forEach(r=>r.classList.remove('dropover'));
          if(target){ target.classList.add('dropover'); list.insertBefore(dragRow,target); }
          else list.appendChild(dragRow);
        };
        const up=()=>{
          document.removeEventListener('pointermove',move); document.removeEventListener('pointerup',up);
          dragRow.classList.remove('dragging');
          [...list.children].forEach(r=>r.classList.remove('dropover'));
          const newOrder=[...list.children].map(r=>order.find(it=>key(it)===r.dataset.key));
          order=newOrder; onReorder&&onReorder(newOrder);
        };
        document.addEventListener('pointermove',move); document.addEventListener('pointerup',up);
      }
      build();
      list.refresh=(newItems)=>{ order=[...newItems]; build(); };
      return list;
    },

    /* modals stack: opening a modal on top of another hides the one below and
       restores it when the top one closes. onClose fires on EVERY close path. */
    _modalStack:[],
    modal({title,body,actions=[],wide=false,onClose}={}){
      const root=$('#modalRoot');
      const m=ui.el(`<div class="amodal" ${wide?'style="width:min(760px,94vw)"':''}>
        <header><h2>${util.esc(title||'')}</h2><button class="x">&times;</button></header>
        <div class="mbody"></div><footer></footer></div>`);
      m.querySelector('.mbody').appendChild(body);
      const foot=m.querySelector('footer');
      if(!actions.length) foot.remove(); else actions.forEach(a=>foot.appendChild(a));
      const prev=ui._modalStack[ui._modalStack.length-1];
      if(prev) prev.el.style.display='none';
      root.appendChild(m); root.classList.add('open');
      let closed=false;
      const entry={el:m,onClose};
      ui._modalStack.push(entry);
      const close=()=>{
        if(closed) return; closed=true;
        const i=ui._modalStack.indexOf(entry); if(i>=0) ui._modalStack.splice(i,1);
        m.remove();
        const top=ui._modalStack[ui._modalStack.length-1];
        if(top) top.el.style.display='';
        else root.classList.remove('open');
        try{ onClose&&onClose(); }catch(err){ console.error(err); }
      };
      m.querySelector('.x').addEventListener('click',close);
      const backdrop=e=>{ if(e.target===root && ui._modalStack[ui._modalStack.length-1]===entry){ root.removeEventListener('click',backdrop); close(); } };
      root.addEventListener('click',backdrop);
      return {close, el:m};
    },
    confirm(msg){
      return new Promise(res=>{
        const body=ui.el(`<p style="font-size:13.5px;line-height:1.55;color:var(--txt2)">${util.esc(msg)}</p>`);
        const no=ui.btn({label:'Cancel',kind:'ghost',onClick:()=>{h.close();res(false);}});
        const yes=ui.btn({label:'Yes, do it',onClick:()=>{h.close();res(true);}});
        const h=ui.modal({title:'Are you sure?',body,actions:[no,yes]});
      });
    },
    prompt(title,placeholder='',value=''){
      return new Promise(res=>{
        const input=ui.text({value,placeholder});
        const body=document.createElement('div'); body.appendChild(input);
        const no=ui.btn({label:'Cancel',kind:'ghost',onClick:()=>{h.close();res(null);}});
        const ok=ui.btn({label:'OK',onClick:()=>{h.close();res(input.value);}});
        const h=ui.modal({title,body,actions:[no,ok]});
        input.addEventListener('keydown',e=>{ if(e.key==='Enter'){ h.close(); res(input.value); } });
        setTimeout(()=>input.focus(),50);
      });
    }
  };

  /* ================= sections / routing ================= */
  function register(sec){ sections.push(sec); }
  function renderSidebar(){
    const sb=$('#sidebar'); if(!sb) return;
    sb.innerHTML='';
    sections.forEach(sec=>{
      const badge=sec.badge?sec.badge():'';
      const b=ui.el(`<button class="snav ${state.section===sec.id?'on':''}">
        <i class="ti ${sec.icon}"></i>${util.esc(sec.title)}${badge?`<span class="sbadge">${util.esc(String(badge))}</span>`:''}</button>`);
      b.addEventListener('click',()=>{ state.section=sec.id; renderSidebar(); rerender(); if(sec.page) pvGoto(sec.page); });
      sb.appendChild(b);
    });
  }
  function rerender(){
    const sec=sections.find(s=>s.id===state.section) || sections[0];
    if(!sec) return;
    $('#editorHead').innerHTML=`<h1><i class="ti ${sec.icon}"></i>${util.esc(sec.title)}</h1>${sec.desc?`<p>${sec.desc}</p>`:''}`;
    const body=$('#editorBody'); body.innerHTML='';
    sec.render(body);
  }

  /* ================= login ================= */
  async function checkLogin(){
    if(sessionStorage.getItem('wendlo_admin_ok')==='1'){ $('#login').style.display='none'; $('#app').hidden=false; layoutPreview(); return; }
    $('#loginForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const pw=$('#loginPass').value;
      const want=state.draft.admin.passHash || await WendloStore.sha256('wendlo');
      const got=await WendloStore.sha256(pw);
      if(got===want){
        sessionStorage.setItem('wendlo_admin_ok','1');
        $('#login').style.display='none'; $('#app').hidden=false; layoutPreview();
      }else{
        $('#loginErr').textContent='That’s not it — try again.';
        $('#loginPass').value=''; $('#loginPass').focus();
      }
    });
  }

  /* ================= boot ================= */
  function boot(){
    if(bootDone) return; bootDone=true;
    state.draft = WendloStore.draft();   // re-read now that config-published.json (if any) is loaded
    $('#btnPublish').addEventListener('click',publish);
    $('#btnDiscard').addEventListener('click',discard);
    document.querySelectorAll('#pvDevices button').forEach(b=>b.addEventListener('click',()=>pvSetDevice(b.dataset.pv)));
    checkLogin();
    renderSidebar(); rerender(); refreshPubState(); layoutPreview();
  }

  function goSection(id){
    const sec=sections.find(s=>s.id===id); if(!sec) return;
    state.section=id; renderSidebar(); rerender(); if(sec.page) pvGoto(sec.page);
  }

  return {
    state, util, ui, subs, toast,
    register, boot, rerender, go: goSection,
    touch, publish, discard,
    preview: { goto:pvGoto, setDevice:pvSetDevice, push:pvPush }
  };
})();
