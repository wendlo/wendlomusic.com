/* Wendlo band console — Contact section.
   Edits draft.contact: photos, words, social links, the optional Google Form,
   and the questions on the two contact forms. Webhooks live in Connections. */

(function(){

  const PLATFORMS = [
    { value:'instagram',  label:'Instagram'   },
    { value:'tiktok',     label:'TikTok'      },
    { value:'facebook',   label:'Facebook'    },
    { value:'youtube',    label:'YouTube'     },
    { value:'spotify',    label:'Spotify'     },
    { value:'apple',      label:'Apple Music' },
    { value:'soundcloud', label:'SoundCloud'  },
    { value:'twitter',    label:'Twitter / X' },
    { value:'bandcamp',   label:'Bandcamp'    },
    { value:'other',      label:'Other'       }
  ];

  function platformLabel(p){
    const hit = PLATFORMS.find(x=>x.value===p);
    return hit ? hit.label : 'Link';
  }

  /* Modal editor for one social link. Saves straight into the item, then touch + rerender. */
  function editSocial(s, title){
    const ui = Admin.ui;
    const box = document.createElement('div');

    const sel = ui.select({
      options: PLATFORMS,
      value: PLATFORMS.some(p=>p.value===s.platform) ? s.platform : 'other'
    });
    const lab = ui.text({ value:s.label, placeholder:'e.g. Instagram' });
    const url = ui.text({ value:s.url, placeholder:'https://…', mono:true });

    sel.addEventListener('change', ()=>{
      if(!lab.value.trim() && sel.value!=='other') lab.value = platformLabel(sel.value);
    });

    box.appendChild(ui.field('Platform', sel, 'Picks the little icon visitors see'));
    box.appendChild(ui.field('Label', lab, 'The name shown next to the icon'));
    box.appendChild(ui.field('Link', url, 'Paste the full web address — it should start with https://'));

    const cancel = ui.btn({ label:'Cancel', kind:'ghost', onClick:()=>h.close() });
    const save = ui.btn({ label:'Save', onClick:()=>{
      s.platform = sel.value;
      s.label = lab.value.trim() || platformLabel(sel.value);
      s.url = url.value.trim();
      h.close();
      Admin.touch();
      Admin.rerender();
    }});
    const h = ui.modal({ title: title || 'Edit link', body:box, actions:[cancel, save] });
    setTimeout(()=>lab.focus(), 50);
  }

  /* One editable question (label + optional placeholder), bound to a form field object. */
  function questionRow(f){
    const ui = Admin.ui;
    const labelInput = ui.text({
      value: f.label,
      placeholder: 'The question visitors see',
      onInput: v=>{ f.label = v; Admin.touch(); }
    });
    if(f.placeholder === undefined){
      return ui.field(prettyKey(f.key), labelInput);
    }
    const phInput = ui.text({
      value: f.placeholder,
      placeholder: 'Hint text inside the empty box (optional)',
      onInput: v=>{ f.placeholder = v; Admin.touch(); }
    });
    return ui.field(prettyKey(f.key), ui.row(labelInput, phInput));
  }

  function prettyKey(k){
    return String(k||'').charAt(0).toUpperCase() + String(k||'').slice(1);
  }

  Admin.register({
    id:'contact',
    title:'Contact',
    icon:'ti-mail',
    desc:'The contact page — photos, words, social links, and the two forms visitors can fill out.',
    page:'contact',

    render(body){
      const ui = Admin.ui, esc = Admin.util.esc;
      const c = Admin.state.draft.contact;

      /* ---------- Photos ---------- */
      const gPhotos = ui.group('Photos');
      gPhotos.appendChild(ui.field(
        'Polaroid collage',
        ui.imagePicker({
          value: c.polaroids.src,
          defaultSrc: '../assets/contactv2.png',
          onChange: v=>{ c.polaroids.src = v; Admin.touch(); }
        }),
        'The polaroid collage on the right — a transparent PNG works best'
      ));
      body.appendChild(gPhotos);

      /* ---------- Words ---------- */
      const gWords = ui.group('Words');

      gWords.appendChild(ui.field(
        'Heading',
        ui.text({ value:c.heading, onInput:v=>{ c.heading = v; Admin.touch(); } }),
        'The big line at the top of the contact page'
      ));

      gWords.appendChild(ui.row(
        ui.field('Message button',
          ui.text({ value:c.buttons.message.label, onInput:v=>{ c.buttons.message.label = v; Admin.touch(); } })),
        ui.field('Small line under it',
          ui.text({ value:c.buttons.message.sub, onInput:v=>{ c.buttons.message.sub = v; Admin.touch(); } }))
      ));

      gWords.appendChild(ui.row(
        ui.field('Email list button',
          ui.text({ value:c.buttons.email.label, onInput:v=>{ c.buttons.email.label = v; Admin.touch(); } })),
        ui.field('Small line under it',
          ui.text({ value:c.buttons.email.sub, onInput:v=>{ c.buttons.email.sub = v; Admin.touch(); } }))
      ));

      gWords.appendChild(ui.field(
        'Your email',
        ui.text({ value:c.bookingEmail, type:'email', onInput:v=>{ c.bookingEmail = v; Admin.touch(); } }),
        'Visitors see this for booking and business — make sure it’s one you actually check'
      ));

      gWords.appendChild(ui.row(
        ui.field('Licensing contact',
          ui.text({ value:c.licensing.name, onInput:v=>{ c.licensing.name = v; Admin.touch(); } }),
          'Who handles sync and licensing requests'),
        ui.field('Licensing email',
          ui.text({ value:c.licensing.email, type:'email', onInput:v=>{ c.licensing.email = v; Admin.touch(); } }))
      ));

      body.appendChild(gWords);

      /* ---------- Social links ---------- */
      const gSoc = ui.group('Social links', 'Drag to reorder · toggle to show/hide');

      const list = ui.dragList({
        items: c.socials,
        key: s=>s.id,
        render(s){
          const frag = document.createDocumentFragment();

          const info = ui.el('<div style="flex:1;min-width:0"></div>');
          info.appendChild(ui.el(`<div class="dtitle">${esc(s.label || platformLabel(s.platform))}</div>`));
          info.appendChild(ui.el(`<div class="dsub">${esc(s.url || 'No link yet — tap the pencil to add one')}</div>`));
          frag.appendChild(info);

          const acts = document.createElement('div');
          acts.className = 'dacts';
          acts.appendChild(ui.toggle({
            checked: s.enabled !== false,
            onChange: v=>{ s.enabled = v; Admin.touch(); }
          }));
          acts.appendChild(ui.iconBtn({
            icon:'ti-pencil', title:'Edit this link',
            onClick: ()=>editSocial(s, 'Edit link')
          }));
          acts.appendChild(ui.iconBtn({
            icon:'ti-trash', title:'Remove this link', danger:true,
            onClick: async ()=>{
              const name = s.label || platformLabel(s.platform);
              if(!await ui.confirm(`Remove the ${name} link? Visitors won’t see it on the contact page anymore.`)) return;
              const i = c.socials.indexOf(s);
              if(i > -1) c.socials.splice(i, 1);
              Admin.touch();
              Admin.rerender();
            }
          }));
          frag.appendChild(acts);

          return frag;
        },
        onReorder(newOrder){
          c.socials.splice(0, c.socials.length, ...newOrder);
          Admin.touch();
        }
      });
      gSoc.appendChild(list);

      const addBtn = ui.btn({
        label:'Add a link', icon:'ti-plus', kind:'ghost',
        onClick: ()=>{
          const s = { id:Admin.util.uid(), platform:'other', label:'', url:'', enabled:true };
          c.socials.push(s);
          Admin.touch();
          Admin.rerender();
          editSocial(s, 'New link');
        }
      });
      addBtn.style.marginTop = '12px';
      gSoc.appendChild(addBtn);

      body.appendChild(gSoc);

      /* ---------- Google Form (optional) ---------- */
      const gForm = ui.group('Google Form (optional)', 'Embed any Google Form as an extra button on the contact page.');

      gForm.appendChild(ui.field('', ui.toggle({
        checked: !!c.googleForm.enabled,
        label: 'Show the Google Form button',
        onChange: v=>{ c.googleForm.enabled = v; Admin.touch(); }
      })));

      gForm.appendChild(ui.field(
        'Button label',
        ui.text({ value:c.googleForm.label, placeholder:'Fill out our form', onInput:v=>{ c.googleForm.label = v; Admin.touch(); } })
      ));

      gForm.appendChild(ui.field(
        'Form link',
        ui.text({ value:c.googleForm.url, placeholder:'https://docs.google.com/forms/…', mono:true, onInput:v=>{ c.googleForm.url = v; Admin.touch(); } }),
        'In Google Forms, use the form’s “Send → embed” URL — it ends in ?embedded=true'
      ));

      body.appendChild(gForm);

      /* ---------- Form questions ---------- */
      const gQ = ui.group(
        'Form questions',
        'What each form asks. Answers show up under <b>Submissions</b> — the questions are yours, so keep them in Wendlo’s playful voice.'
      );

      gQ.appendChild(ui.el('<h2 style="margin-top:6px">The message form</h2>'));
      c.messageForm.fields.forEach(f=>gQ.appendChild(questionRow(f)));

      gQ.appendChild(ui.el('<h2 style="margin-top:22px">The email list form</h2>'));
      c.emailForm.fields.forEach(f=>gQ.appendChild(questionRow(f)));

      body.appendChild(gQ);
    }
  });

})();
