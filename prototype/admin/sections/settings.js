/* Wendlo band console — Settings section.
   Site basics, console password, backup & restore, and the danger zone. */

(function(){
  Admin.register({
    id:'settings',
    title:'Settings',
    icon:'ti-settings',
    desc:'The behind-the-scenes stuff — site name, password, and backups.',

    render(body){
      const ui = Admin.ui, util = Admin.util, draft = Admin.state.draft;

      /* ---------- Site basics ---------- */
      const basics = ui.group('Site basics');

      basics.appendChild(ui.field(
        'Browser-tab title',
        ui.text({
          value: draft.site.title,
          placeholder: 'Wendlo',
          onInput: v => { draft.site.title = v; Admin.touch(); }
        }),
        'Visitors see this in their browser tab and in bookmarks.'
      ));

      basics.appendChild(ui.field(
        'Search/social description',
        ui.textarea({
          rows: 2,
          value: draft.site.description,
          placeholder: 'A sentence or two about the band…',
          onInput: v => { draft.site.description = v; Admin.touch(); }
        }),
        'This shows up under your site name on Google and when someone shares a link.'
      ));

      body.appendChild(basics);

      /* ---------- Console password ---------- */
      const pass = ui.group('Console password', 'Protects this console only.');

      const newPw = ui.text({ type:'password', placeholder:'New password' });
      const repeatPw = ui.text({ type:'password', placeholder:'Type it again' });

      pass.appendChild(ui.field('New password', newPw));
      pass.appendChild(ui.field(
        'Repeat new password',
        repeatPw,
        'In this prototype the check runs in the browser; the production build gets real authentication.'
      ));

      pass.appendChild(ui.btn({
        label: 'Change password',
        icon: 'ti-key',
        onClick: async () => {
          const v = newPw.value;
          if(v.length < 6){
            Admin.toast('Pick a password with at least 6 characters', 'bad');
            return;
          }
          if(v !== repeatPw.value){
            Admin.toast('Those two passwords don’t match — try again', 'bad');
            return;
          }
          draft.admin.passHash = await WendloStore.sha256(v);
          Admin.touch();
          newPw.value = '';
          repeatPw.value = '';
          Admin.toast('Password changed', 'good');
        }
      }));

      body.appendChild(pass);

      /* ---------- Backup & restore ---------- */
      const backup = ui.group('Backup & restore', 'Save a copy of everything on this site, or bring one back.');

      const exportBtn = ui.btn({
        label: 'Export everything (JSON)',
        icon: 'ti-download',
        onClick: () => {
          util.downloadFile('wendlo-site-config.json', JSON.stringify(Admin.state.draft, null, 2), 'application/json');
          Admin.toast('Backup downloaded — keep it somewhere safe', 'good');
        }
      });

      const liveBtn = ui.btn({
        label: 'Download live-site file',
        icon: 'ti-world-upload',
        kind: 'ghost',
        onClick: () => {
          const cfg = WendloStore.clone(Admin.state.draft);
          if (cfg.admin) delete cfg.admin;   // never ship the password hash in the public file
          util.downloadFile('config-published.json', JSON.stringify(cfg, null, 2), 'application/json');
          Admin.toast('config-published.json downloaded — replace the one in the site folder and redeploy', 'good');
        }
      });

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'application/json,.json';
      fileInput.hidden = true;
      fileInput.addEventListener('change', () => {
        const f = fileInput.files[0];
        if(!f) return;
        const fr = new FileReader();
        fr.onerror = () => { Admin.toast('Could not read that file', 'bad'); fileInput.value = ''; };
        fr.onload = async () => {
          fileInput.value = '';
          let parsed;
          try{
            parsed = JSON.parse(fr.result);
          }catch(_){
            Admin.toast('That file doesn’t look like a Wendlo backup (couldn’t read it)', 'bad');
            return;
          }
          if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.pages){
            Admin.toast('That file doesn’t look like a Wendlo backup', 'bad');
            return;
          }
          if(!await ui.confirm('Replace everything in this console with the backup file? Any unpublished edits you have right now will be lost.')) return;
          Admin.state.draft = WendloStore.deepMerge(WendloStore.defaults(), parsed);
          Admin.touch();
          Admin.rerender();
          Admin.toast('Backup imported — check the preview, then publish when you’re happy', 'good');
        };
        fr.readAsText(f);
      });

      const importBtn = ui.btn({
        label: 'Import from file',
        icon: 'ti-upload',
        kind: 'ghost',
        onClick: () => fileInput.click()
      });

      backup.appendChild(ui.field(
        '',
        ui.row(exportBtn, importBtn),
        'Importing replaces everything here with what’s in the file. Visitors won’t see anything change until you publish.'
      ));
      backup.appendChild(ui.field(
        '',
        liveBtn,
        'On the deployed site, “Publish” only updates <b>this browser</b>. To update the live site for everyone: download this file, replace <b>config-published.json</b> in the site folder, and redeploy (automatic if the folder is connected to Vercel via git).'
      ));
      backup.appendChild(fileInput);

      body.appendChild(backup);

      /* ---------- Danger zone ---------- */
      const danger = ui.group('Danger zone', 'Careful — this can’t be undone once you publish.');

      danger.appendChild(ui.field(
        '',
        ui.btn({
          label: 'Reset the site to factory defaults',
          icon: 'ti-restore',
          kind: 'danger',
          onClick: async () => {
            if(!await ui.confirm('Reset everything — words, photos, links — back to how the site started?')) return;
            if(!await ui.confirm('Last check: this wipes all your edits here. Really reset the whole site?')) return;
            Admin.state.draft = WendloStore.defaults();
            Admin.touch();
            Admin.rerender();
            Admin.toast('Site reset to factory defaults — publish to make it live', 'good');
          }
        }),
        'Handy if things get tangled and you want a fresh start. Export a backup first, just in case.'
      ));

      body.appendChild(danger);
    }
  });
})();
