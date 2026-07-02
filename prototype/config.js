/* Wendlo shared content model + store.
   Loaded by BOTH the site (index.html) and the admin console (/admin/).
   The site renders from WendloStore.published(); the admin edits a draft and publishes.
   Image fields: '' = use the built-in default asset; otherwise an absolute/relative URL or a data: URL. */

window.WENDLO_DEFAULTS = {
  v: 1,
  site: {
    title: 'Wendlo',
    description: 'Wendlo — warm, slightly unserious pop. Music, tour dates, and merch.',
    announcement: { enabled:false, text:'Click here to join our email list! 💌', page:'contact' }
  },
  design: {
    accent: '#E0A32B',            // mustard
    logo: '',                     // default: assets/wendlo-logo.gif (inverted to white via CSS)
    stripes: ''                   // default: assets/stripes.jpg  (music/store/contact/blog background)
  },
  pages: {
    order: ['home','about','tour','contact','music','store','blog'],
    enabled: { home:true, about:false, tour:true, contact:true, music:true, store:true, blog:false },
    labels:  { home:'home', about:'about', tour:'tour', contact:'contact', music:'music', store:'store', blog:'blog' }
  },
  home: {
    hero: { src:'', focal:'50% 50%', focalMobile:'50% 42%' },
    emailCta: { enabled:true, text:'join our email list!' },
    clickHere: { enabled:true }
  },
  about: {
    hero: { src:'', focal:'50% 50%', focalMobile:'50% 40%' },
    heading: 'Two people, a pile of songs, and a van.',
    body: 'Warm, slightly unserious pop — about love, naps, and the people at the top who could stand to be a little nicer.'
  },
  tour: {
    hero: { src:'', focal:'50% 50%', focalMobile:'24% 42%' },
    bandsintown: { artist:'id_14800723', appId:'e013532ece4ef52f851d48a4d3730c70' },
    emptyText: 'No shows on the books right now.',
    emptyLinkText: 'Get notified on Bandsintown ↗',
    emptyLinkUrl: 'https://www.bandsintown.com/a/14800723'
  },
  contact: {
    polaroids: { src:'' },        // default: assets/contactv2.png
    heading: 'Get in touch',
    bookingEmail: 'hello@wendlomusic.com',
    licensing: { name:'Low Profile NYC', email:'yo@lowprofilenyc.com' },
    buttons: {
      message: { label:'Send us a message', sub:'Booking, event inquiries, or love letters 👩‍❤️‍👨' },
      email:   { label:'Join our email list', sub:'Become a Wendling' }
    },
    googleForm: { enabled:false, label:'Fill out our form', url:'' },
    webhooks: { contact:'', email:'' },   // optional POST endpoints (Google Apps Script / Mailchimp bridge)
    messageForm: {
      fields: [
        { key:'name',    label:'Name',    type:'text',     required:true },
        { key:'email',   label:'Email',   type:'email',    required:true },
        { key:'subject', label:'Subject', type:'text',     required:false },
        { key:'message', label:'Message', type:'textarea', required:true }
      ],
      submitLabel:'Send', successText:'Got it — we read everything. 💌'
    },
    emailForm: {
      fields: [
        { key:'name',    label:"What's your name?",                       type:'text',     required:true,  placeholder:'' },
        { key:'email',   label:'Do you have an email address?',           type:'email',    required:true,  placeholder:'under_score@hotmail.com' },
        { key:'location',label:'Where do you live?',                      type:'text',     required:false, placeholder:'Full address, or just a postal code :)' },
        { key:'meal',    label:"What's the best meal you've ever eaten?", type:'text',     required:false, placeholder:'' },
        { key:'message', label:'Anything else to say?',                   type:'textarea', required:false, placeholder:'If you have a message for Wendlo, put it here!' }
      ],
      submitLabel:'Join', successText:'Welcome, Wendling! 🎉'
    },
    socials: [
      { id:'ig',  platform:'instagram',  label:'Instagram',   url:'https://www.instagram.com/wendlomusic',  enabled:true },
      { id:'tt',  platform:'tiktok',     label:'TikTok',      url:'https://www.tiktok.com/@wendlomusic',    enabled:true },
      { id:'fb',  platform:'facebook',   label:'Facebook',    url:'https://www.facebook.com/wendlomusic',   enabled:true },
      { id:'yt',  platform:'youtube',    label:'YouTube',     url:'https://www.youtube.com/@wendlo',        enabled:true },
      { id:'sp',  platform:'spotify',    label:'Spotify',     url:'https://open.spotify.com/artist/7Gv2m6LRpBmAheRectfl2E', enabled:true },
      { id:'am',  platform:'apple',      label:'Apple Music', url:'https://music.apple.com/us/artist/wendlo/1251092804',    enabled:true },
      { id:'sc',  platform:'soundcloud', label:'SoundCloud',  url:'https://soundcloud.com/wendlo',          enabled:false }
    ]
  },
  music: {
    /* entries render top-to-bottom; type 'song' alternates art/text sides, type 'youtube' is a full-width inline embed */
    services: ['spotify','apple','amazon','deezer','itunes','napster','tidal','youtube'],
    entries: [
      { id:'m1', type:'song', title:'Untethered', tag:'Single',
        blurb:'“We all need to be grounded sometimes — in the arms of a loved one.”',
        art:'assets/art-untethered.jpg', source:'',
        links:{ spotify:{url:'https://open.spotify.com/track/74e6w4agZGH0ylgs5ayNst',on:true},
                apple:{url:'https://music.apple.com/us/album/untethered-single/1826150148',on:true},
                amazon:{url:'',on:false}, deezer:{url:'',on:false}, itunes:{url:'',on:false},
                napster:{url:'',on:false}, tidal:{url:'',on:false}, youtube:{url:'',on:false} } },
      { id:'m2', type:'song', title:'Must Be Nice!', tag:'Single',
        blurb:'“An ode to the people at the top who pay no mind to everyone else.”',
        art:'assets/art-mustbenice.jpg', source:'',
        links:{ spotify:{url:'https://open.spotify.com/track/5CHCxB9CdsRbXQ9XAk7h8g',on:true},
                apple:{url:'https://music.apple.com/us/album/must-be-nice/1817539414?i=1817539415',on:true},
                amazon:{url:'',on:false}, deezer:{url:'',on:false}, itunes:{url:'',on:false},
                napster:{url:'',on:false}, tidal:{url:'',on:false}, youtube:{url:'',on:false} } },
      { id:'m3', type:'youtube', title:'Wendlo • September [Official Video]',
        url:'https://www.youtube.com/watch?v=Dpzbv2AZ-dw' },
      { id:'m4', type:'song', title:'Wasting Time With You', tag:'Single',
        blurb:'“What’s all this other stuff for?? I just wanna hang out!”',
        art:'assets/art-wasting.jpg', source:'',
        links:{ spotify:{url:'https://open.spotify.com/track/5UhkNRrD7irazpKbSuZ8R1',on:true},
                apple:{url:'https://music.apple.com/us/album/wasting-time-with-you-single/1803715184',on:true},
                amazon:{url:'',on:false}, deezer:{url:'',on:false}, itunes:{url:'',on:false},
                napster:{url:'',on:false}, tidal:{url:'',on:false}, youtube:{url:'',on:false} } },
      { id:'m5', type:'song', title:'Shadow', tag:'Single',
        blurb:'“Started as a voice memo line — ‘let me be your shadow…’”',
        art:'assets/art-shadow.jpg', source:'',
        links:{ spotify:{url:'https://open.spotify.com/track/6Bmte0o9RDfxgh534B1ubR',on:true},
                apple:{url:'https://music.apple.com/us/album/shadow/1574915394?i=1574915395',on:true},
                amazon:{url:'',on:false}, deezer:{url:'',on:false}, itunes:{url:'',on:false},
                napster:{url:'',on:false}, tidal:{url:'',on:false}, youtube:{url:'',on:false} } },
      { id:'m6', type:'song', title:'Downtown', tag:'Single',
        blurb:'“Growing up in Alaska, I had pictures of moving to a big city…”',
        art:'assets/art-downtown.jpg', source:'',
        links:{ spotify:{url:'https://open.spotify.com/track/1p8IGe4y3GWmTHUz1anSz1',on:true},
                apple:{url:'https://music.apple.com/us/album/downtown-single/1467650995',on:true},
                amazon:{url:'',on:false}, deezer:{url:'',on:false}, itunes:{url:'',on:false},
                napster:{url:'',on:false}, tidal:{url:'',on:false}, youtube:{url:'',on:false} } }
    ]
  },
  store: {
    shopify: { domain:'fep1gx-a1.myshopify.com', token:'13038a835c47c3e30b20f34cd745adfc', apiVersion:'2024-10' }
  },
  blog: {
    heading:'Notes from the van',
    posts: [
      { id:'p1', title:'Hello from the van', date:'2026-06-20', cover:'assets/about.jpg',
        excerpt:'A little corner of the internet where we overshare about songs, snacks, and highway exits.',
        body:'<p>Hi. We’re Wendlo, and this is the blog — the part of the site where nobody makes us keep it short.</p><p>Expect tour diaries, demos that may never come out, and a running list of the best gas-station snacks in North America (currently topped by a boiled peanut situation in Georgia we’re still thinking about).</p><p>If you want these in your inbox instead, join the email list. We only send the good stuff.</p>',
        published:true }
    ]
  },
  admin: { passHash:'' }   // ''  → default password "wendlo" (change it in Settings)
};

(function(){
  const PUB_KEY='wendlo_config', DRAFT_KEY='wendlo_config_draft', SUB_KEY='wendlo_submissions';
  /* where config-published.json lives, relative to THIS script (works from / and /admin/) */
  const CONFIG_BASE = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src) : null;
  let REMOTE = null;   // deployed site content (config-published.json), merged under local edits

  function isObj(x){ return x && typeof x==='object' && !Array.isArray(x); }
  function deepMerge(base, over){
    if(!isObj(base)) return (over===undefined)? base : over;
    if(!isObj(over)) return (over===undefined)? clone(base) : over;
    const out={};
    for(const k of new Set([...Object.keys(base),...Object.keys(over)])){
      if(k in over){ out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k],over[k]) : clone(over[k]); }
      else out[k]=clone(base[k]);
    }
    return out;
  }
  function clone(x){ return x===undefined?x:JSON.parse(JSON.stringify(x)); }
  function read(key){ try{ const s=localStorage.getItem(key); return s?JSON.parse(s):null; }catch(_){ return null; } }
  function write(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); return true; }catch(err){ console.error('[WendloStore] save failed (storage full?)',err); return false; } }

  window.WendloStore = {
    defaults(){ return clone(window.WENDLO_DEFAULTS); },
    /* precedence: baked defaults < deployed config-published.json < this browser's local publishes */
    base(){ return REMOTE ? deepMerge(window.WENDLO_DEFAULTS, REMOTE) : clone(window.WENDLO_DEFAULTS); },
    published(){ return deepMerge(this.base(), read(PUB_KEY)||{}); },
    draft(){ const d=read(DRAFT_KEY); return d ? deepMerge(this.base(),d) : this.published(); },

    /* fetch the deployed content file; resolves true if a non-empty one loaded */
    async loadRemote(){
      if(!CONFIG_BASE) return false;
      try{
        const r=await fetch(new URL('config-published.json', CONFIG_BASE), {cache:'no-cache'});
        if(!r.ok) return false;
        const j=await r.json();
        if(j && typeof j==='object' && !Array.isArray(j) && Object.keys(j).length){ REMOTE=j; return true; }
      }catch(_){}
      return false;
    },
    saveDraft(cfg){ return write(DRAFT_KEY,cfg); },
    publish(cfg){ const ok=write(PUB_KEY,cfg); if(ok) write(DRAFT_KEY,cfg); return ok; },
    discardDraft(){ try{ localStorage.removeItem(DRAFT_KEY); }catch(_){} },
    resetAll(){ try{ localStorage.removeItem(PUB_KEY); localStorage.removeItem(DRAFT_KEY); }catch(_){} },
    isDirty(){ return JSON.stringify(this.draft())!==JSON.stringify(this.published()); },
    deepMerge, clone,
    uid(){ return 'x'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4); },

    submissions:{
      list(type){ const all=read(SUB_KEY)||[]; return type? all.filter(s=>s.type===type) : all; },
      add(type,data){ const all=read(SUB_KEY)||[];
        all.unshift({ id:WendloStore.uid(), type, data, ts:new Date().toISOString(), read:false });
        write(SUB_KEY,all); return all[0]; },
      markRead(id,val){ const all=read(SUB_KEY)||[]; const s=all.find(x=>x.id===id); if(s) s.read=(val!==false); write(SUB_KEY,all); },
      remove(id){ write(SUB_KEY,(read(SUB_KEY)||[]).filter(x=>x.id!==id)); },
      unreadCount(){ return (read(SUB_KEY)||[]).filter(x=>!x.read).length; }
    },

    async sha256(str){
      const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
  };
})();
