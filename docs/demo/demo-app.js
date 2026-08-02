document.addEventListener('DOMContentLoaded', function () {
  var os = new Prestige({
    grid: false,
    animations: true,
    lockScreen: true,
    lockPassword: '0000',
    tiling: true,
    session: false,
    toastCenter: true,
    minimizedPreview: true,
    snap: true,
    shakeToMinimize: true,
    flickToMinimize: true,
    expose: true,
    xray: true,
    search: true,
    windowSwitcher: true,
    dockDragDrop: true,
    particleExplosion: true,
    gpuAcceleration: true
  });
  window._p = os;
  os.init();

  function section() {
    return $tag('div', { class: 'window-content-main' });
  }

  // -----------------------------------------------------------------------
  // APP: Overview — system stats, badges, progress, live actions
  // -----------------------------------------------------------------------
  os.registerApp('overview', {
    title: 'System Overview',
    icon: 'layout-dashboard',
    placement: 'topdock',
    content: function () {
      var root = section();
      var stats = $tag('div', { class: 'stats-row' });
      stats.append(
        createStatCard('98%', 'Uptime'),
        createStatCard('2.4s', 'Avg Latency'),
        createStatCard('1.2K', 'Req/s')
      );
      root.appendChild(createCard('System Overview', stats));

      var badges = $tag('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
      badges.append(createBadge('Healthy', 'success'), createBadge('v2.5.0', 'info'), createBadge('Beta', 'warning'));
      root.appendChild(createCard('Status', badges));

      var actions = $tag('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
      actions.append(
        createBtn('Notify', { variant: 'primary', type: 'button', onclick: function () { os.toast('This is a toast notification.', 'success'); } }),
        createBtn('Confirm', { variant: 'ghost', type: 'button', onclick: function () {
          os.dialogConfirm({ title: 'Restart services?', message: 'Restart all background workers?', danger: true })
            .then(function (ok) { os.toast(ok ? 'Services restarted.' : 'Restart cancelled.', ok ? 'success' : 'info'); });
        } }),
        createBtn('Menu', { variant: 'ghost', type: 'button', onclick: function (e) {
          os.showContextMenu({ x: e.clientX, y: e.clientY, items: [
            { label: 'Open Components', onclick: function () { os.openWindow('components', 'blocks', 'Components', document.querySelector('.dock-item[data-section="components"]')); } },
            { sep: true },
            { label: 'Shake to minimize', kbd: 'Shake', onclick: function () { os.toast('Drag a titlebar and shake.', 'info'); } },
            { label: 'Feature flags', danger: true, onclick: function () { os.dialogInfo({ title: 'Config-driven', message: 'Every feature is a constructor flag. Set any option to false at runtime.' }); } }
          ] });
        } })
      );
      root.appendChild(createCard('Actions', actions));

      var progress = $tag('div', { style: { display: 'grid', gap: '14px' } });
      progress.append(createProgressBar(100, 100, { label: 'Build pipeline' }));
      progress.append(createProgressBar(72, 100, { label: 'Test suite' }));
      progress.append(createProgressBar(45, 100, { label: 'Deployment' }));
      root.appendChild(createCard('Progress', progress));
      return root;
    }
  });

  // -----------------------------------------------------------------------
  // APP: Components — switches, accordion, tabs, badges, progress
  // -----------------------------------------------------------------------
  os.registerApp('components', {
    title: 'Component Showcase',
    icon: 'blocks',
    placement: 'dock',
    content: function () {
      var root = section();

      var switchState = $tag('strong', null, [$text('Enabled')]);
      var switches = $tag('div', { style: { display: 'grid', gap: '10px' } });
      switches.append(createSwitch({ checked: true, label: 'Notifications', onChange: function (checked) { switchState.textContent = checked ? 'Enabled' : 'Paused'; } }));
      switches.append(createSwitch({ checked: false, label: 'Do not disturb' }));
      root.appendChild(createCard('Switch', $tag('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, [switches, switchState])));

      root.appendChild(createCard('Accordion', createAccordion({ items: [
        { title: 'DOM-first', content: $text('Pass a DOM node or a rendering function to preserve event handlers and lifecycle ownership.'), open: true },
        { title: 'Composable', content: $text('Nest built-ins inside cards, tabs, windows, drawers, or your own registered components.') },
        { title: 'Accessible', content: $text('Interactive primitives include semantic roles, labels, and keyboard support where appropriate.') }
      ] })));

      root.appendChild(createCard('Tabs', createTabs([
        { label: 'Overview', content: $tag('div', { class: 'card' }, [$tag('div', { class: 'card-body' }, [$text('Welcome to the Tabs component. Click any tab above to switch content.')])]) },
        { label: 'Stats', content: $tag('div', { class: 'stats-row' }, [createStatCard('97%', 'Uptime'), createStatCard('1.2s', 'Latency'), createStatCard('42', 'Requests')]) },
        { label: 'Progress', content: $tag('div', { style: { display: 'grid', gap: '12px' } }, [createProgressBar(100, 100, { label: 'Build' }), createProgressBar(72, 100, { label: 'Tests' }), createProgressBar(20, 100, { label: 'Review' })]) }
      ])));

      var badges = $tag('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
      badges.append(createBadge('Healthy', 'success'), createBadge('v2.5.0', 'info'), createBadge('Beta', 'warning'), createBadge('Down', 'danger'));
      root.appendChild(createCard('Badges', badges));

      var progress = $tag('div', { style: { display: 'grid', gap: '12px' } });
      [20, 45, 72, 100].forEach(function (value) { progress.appendChild(createProgressBar(value, 100, { label: value + '%' })); });
      root.appendChild(createCard('Progress bars', progress));
      return root;
    }
  });

  // -----------------------------------------------------------------------
  // APP: Controls — dropdown, tooltip, breadcrumb, avatar, stepper, choices
  // -----------------------------------------------------------------------
  os.registerApp('controls', {
    title: 'Interactive Controls',
    icon: 'sliders-horizontal',
    placement: 'dock',
    content: function () {
      var root = section();

      var nav = $tag('div', { style: { display: 'grid', gap: '14px' } });
      nav.appendChild(createBreadcrumb({ items: [
        { label: 'Workspace', href: '#' },
        { label: 'Projects', href: '#' },
        { label: 'Atlas' }
      ] }));

      var avatar = createAvatar({ name: 'Sarah Johnson', size: 'lg' });
      nav.appendChild($tag('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [avatar, $tag('strong', null, [$text('Sarah Johnson')])]));

      var menuStatus = $tag('strong', null, [$text('No action selected')]);
      var menu = createDropdown({ label: 'Project actions', items: [
        { label: 'Duplicate project', onClick: function () { menuStatus.textContent = 'Duplicate selected'; } },
        { divider: true },
        { label: 'Archive project', danger: true, onClick: function () { menuStatus.textContent = 'Archive selected'; } }
      ] });
      nav.appendChild($tag('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [menu, menuStatus]));

      nav.appendChild(createTooltip({
        trigger: createBtn('Why components?', { variant: 'ghost', size: 'sm', type: 'button' }),
        message: 'Tooltips wrap any focusable trigger.'
      }));

      nav.appendChild(createStepper({ steps: ['Draft', 'Review', 'Launch'], active: 1 }));
      root.appendChild(createCard('Navigation & identity', nav));

      var choices = $tag('div', { style: { display: 'grid', gap: '12px' } });
      var role = createRadioGroup({ label: 'Role', value: 'editor', items: [
        { value: 'viewer', label: 'Viewer' },
        { value: 'editor', label: 'Editor' },
        { value: 'owner', label: 'Owner' }
      ] });
      var accessLabel = $tag('strong', null, [$text('Team')]);
      var access = createSegmentedControl({ label: 'Access level', items: [
        { value: 'private', label: 'Private' },
        { value: 'team', label: 'Team' },
        { value: 'public', label: 'Public' }
      ], value: 'team', onChange: function (next) { accessLabel.textContent = next.charAt(0).toUpperCase() + next.slice(1); } });
      choices.append(createField('Role', role), $tag('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [$text('Access level'), accessLabel]), access);
      root.appendChild(createCard('Choice controls', choices));
      return root;
    }
  });

  // -----------------------------------------------------------------------
  // APP: Forms — every form primitive in one place
  // -----------------------------------------------------------------------
  os.registerApp('forms', {
    title: 'Form Controls',
    icon: 'text-cursor-input',
    placement: 'dock',
    content: function () {
      var root = section();
      var identity = $tag('div', { style: { display: 'grid', gap: '12px' } });
      var plan = createSelect({ ariaLabel: 'Plan', value: 'team', options: [
        { value: 'starter', label: 'Starter' },
        { value: 'team', label: 'Team' },
        { value: 'scale', label: 'Scale' }
      ] });
      identity.append(
        createField('Workspace plan', plan),
        createField('Project note', createTextarea({ placeholder: 'Add a short note', rows: 3 })),
        createCheckbox({ label: 'Send billing updates', checked: true })
      );
      root.appendChild(createCard('Inputs & text', identity));

      var compound = $tag('div', { style: { display: 'grid', gap: '12px' } });
      compound.append(
        createSearchInput({ placeholder: 'Search members' }),
        createField('Workspace URL', createInputGroup({ prefix: 'https://', input: { placeholder: 'workspace.example' } })),
        createFileInput({ label: 'Attach brief' })
      );
      root.appendChild(createCard('Compound inputs', compound));
      return root;
    }
  });

  // -----------------------------------------------------------------------
  // APP: Data — data tables, pagination, skeleton
  // -----------------------------------------------------------------------
  os.registerApp('data', {
    title: 'Data & Tables',
    icon: 'table-properties',
    placement: 'dock',
    content: function () {
      var root = section();
      root.appendChild(createCard('Data table', createDataTable({
        columns: [
          { key: 'name', label: 'Project', sortable: true },
          { key: 'owner', label: 'Owner', sortable: true },
          { key: 'status', label: 'Status', sortable: true }
        ],
        rows: [
          { name: 'Atlas', owner: 'Sarah', status: 'Review' },
          { name: 'Orion', owner: 'Mateo', status: 'Draft' },
          { name: 'Nova', owner: 'Priya', status: 'Launch' }
        ],
        onRowClick: function (row) { os.toast('Opened ' + row.name + '.', 'info'); }
      })));

      root.appendChild(createCard('Simple table', createTable(
        ['Service', 'Status', 'Latency'],
        [['API', 'Healthy', '12ms'], ['Worker', 'Healthy', '48ms'], ['Cache', 'Degraded', '210ms']]
      )));

      var paging = $tag('div', { style: { display: 'grid', gap: '12px' } });
      paging.appendChild(createSkeleton({ count: 3, widths: ['92%', '68%', '80%'] }));
      var currentPage = $tag('strong', null, [$text('Page 1')]);
      paging.append(currentPage, createPagination({ total: 4, onChange: function (next) { currentPage.textContent = 'Page ' + next; } }));
      root.appendChild(createCard('Loading & pagination', paging));
      return root;
    }
  });

  // -----------------------------------------------------------------------
  // APP: Feedback — alerts, empty states, overlays
  // -----------------------------------------------------------------------
  os.registerApp('feedback', {
    title: 'Feedback & Overlays',
    icon: 'message-square-more',
    placement: 'dock',
    content: function () {
      var root = section();
      var alerts = $tag('div', { style: { display: 'grid', gap: '10px' } });
      alerts.append(
        createAlert({ type: 'info', title: 'Information', message: 'Text is escaped by default; pass a DOM node for rich content.' }),
        createAlert({ type: 'success', title: 'Success', message: 'Built with shared theme tokens.' }),
        createAlert({ type: 'warning', title: 'Warning', message: 'This alert can be dismissed.', dismissible: true }),
        createAlert({ type: 'danger', title: 'Danger', message: 'Use sparingly — reserved for destructive outcomes.' })
      );
      root.appendChild(createCard('Alerts', alerts));

      root.appendChild(createCard('Empty state', createEmptyState({
        icon: '\u25CB',
        title: 'No projects yet',
        description: 'Empty states give a calm, useful starting point.',
        action: { label: 'Create project', onClick: function () { os.toast('Project creation started.', 'success'); } }
      })));

      var overlays = $tag('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
      overlays.append(
        createBtn('Custom modal', { variant: 'primary', type: 'button', onclick: function () {
          os.customModal({ title: 'Release ready', body: $text('The release has passed all component checks.'), buttons: [{ label: 'Close', variant: 'primary', value: true }] });
        } }),
        createBtn('Drawer', { variant: 'ghost', type: 'button', onclick: function () {
          os.drawer({ title: 'Component details', content: $text('Drawers accept DOM nodes, renderer functions, or legacy HTML when explicitly needed.') });
        } }),
        createBtn('Context menu', { variant: 'ghost', type: 'button', onclick: function (e) {
          os.showContextMenu({ x: e.clientX, y: e.clientY, items: [
            { label: 'Refresh', onclick: function () { os.toast('Refreshed.', 'info'); } },
            { label: 'Delete', danger: true, onclick: function () { os.toast('Deleted.', 'danger'); } }
          ] });
        } })
      );
      root.appendChild(createCard('Overlays', overlays));
      return root;
    }
  });

  // -----------------------------------------------------------------------
  // APP: Toast — toast notification lab
  // -----------------------------------------------------------------------
  os.registerApp('toast', {
    title: 'Toast Notification Lab',
    icon: 'bell',
    placement: 'dock',
    content: function () {
      var root = section();
      var msgInput = createInput({ placeholder: 'Message', value: 'Hello from Prestige UI' });
      var typeSelect = createSelect({
        ariaLabel: 'Type',
        options: [
          { value: 'info', label: 'Info' },
          { value: 'success', label: 'Success' },
          { value: 'warning', label: 'Warning' },
          { value: 'danger', label: 'Danger' }
        ]
      });
      var durInput = createInput({ type: 'number', value: '3500' });
      var fire = createBtn('Fire Toast', { variant: 'primary', type: 'button', onclick: function () {
        os.toast(msgInput.value || 'Toast', typeSelect.value, parseInt(durInput.value, 10) || 3500);
      } });
      var form = $tag('div', { style: { display: 'grid', gap: '12px' } });
      form.append(
        createField('Message', msgInput),
        createField('Type', typeSelect),
        createField('Duration (ms)', durInput),
        fire
      );
      root.appendChild(createCard('Toast Notification Lab', form));

      var quick = $tag('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
      quick.append(
        createBtn('Info', { variant: 'ghost', type: 'button', onclick: function () { os.toast('Info: System is healthy', 'info'); } }),
        createBtn('Success', { variant: 'primary', type: 'button', onclick: function () { os.toast('Saved successfully!', 'success'); } }),
        createBtn('Warning', { variant: 'ghost', type: 'button', onclick: function () { os.toast('Session expires in 5min', 'warning'); } }),
        createBtn('Danger', { variant: 'danger', type: 'button', onclick: function () { os.toast('Connection lost', 'danger'); } })
      );
      root.appendChild(createCard('Quick toasts', quick));
      return root;
    }
  });

  // -----------------------------------------------------------------------
  // APP: Dialogs — every dialog variant plus modal, drawer
  // -----------------------------------------------------------------------
  os.registerApp('dialogs', {
    title: 'Dialogs',
    icon: 'message-square',
    placement: 'topdock',
    content: function () {
      var root = section();
      var result = $tag('p', { style: { margin: '0', minHeight: '20px' } }, [$text('Click a button to test.')]);
      function showResult(label, value) {
        result.textContent = label + ' \u2192 ' + (value === null ? 'null' : typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
      var row = $tag('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' } });
      row.append(
        createBtn('Info',    { variant: 'primary', type: 'button', onclick: function () { os.dialogInfo('Data saved successfully.').then(function (v) { showResult('info', v); }); } }),
        createBtn('Warning', { variant: 'ghost',   type: 'button', onclick: function () { os.dialogWarning('Session expiring.').then(function (v) { showResult('warning', v); }); } }),
        createBtn('Danger',  { variant: 'danger',  type: 'button', onclick: function () { os.dialogDanger({ title: 'Error', message: 'Connection lost.' }).then(function (v) { showResult('danger', v); }); } }),
        createBtn('Alert',   { variant: 'ghost',   type: 'button', onclick: function () { os.dialogAlert('This is an alert.').then(function (v) { showResult('alert', v); }); } }),
        createBtn('Confirm', { variant: 'ghost',   type: 'button', onclick: function () { os.dialogConfirm({ title: 'Delete?', message: 'Permanently delete?', danger: true }).then(function (v) { showResult('confirm', v); }); } }),
        createBtn('Prompt',  { variant: 'ghost',   type: 'button', onclick: function () { os.dialogPrompt({ title: 'Your Name', defaultValue: 'Guest' }).then(function (v) { showResult('prompt', v); }); } }),
        createBtn('Save',    { variant: 'ghost',   type: 'button', onclick: function () { os.dialogSave({ defaultFilename: 'report.txt' }).then(function (v) { showResult('save', v); }); } }),
        createBtn('Open',    { variant: 'ghost',   type: 'button', onclick: function () { os.dialogOpen({ multiple: true }).then(function (v) { showResult('open', v); }); } })
      );
      root.appendChild(createCard('Dialogs', $tag('div', null, [row, result])));

      var overlays = $tag('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
      overlays.append(
        createBtn('Custom modal', { variant: 'primary', type: 'button', onclick: function () {
          os.customModal({ title: 'Release ready', body: $text('The release has passed all component checks.'), buttons: [{ label: 'Close', variant: 'primary', value: true }] });
        } }),
        createBtn('Drawer', { variant: 'ghost', type: 'button', onclick: function () {
          os.drawer({ title: 'Component details', content: $text('Drawers accept DOM nodes, renderer functions, or legacy HTML when explicitly needed.') });
        } })
      );
      root.appendChild(createCard('Overlays', overlays));
      return root;
    }
  });

  // -----------------------------------------------------------------------
  // APP: Store — reactive signals, persistence, URL sync
  // -----------------------------------------------------------------------
  os.registerApp('store', {
    title: 'Reactive Store',
    icon: 'database',
    placement: 'topdock',
    content: function () {
      var root = section();
      var prefs = os.store.createStore('demo_prefs', { name: 'Guest', role: 'Editor' }, { persistKey: 'demo_prefs' });

      var form = $tag('div', { style: { display: 'grid', gap: '12px' } });
      var nameInput = createInput({ placeholder: 'Display name', value: prefs.name });
      var roleInput = createInput({ placeholder: 'Role', value: prefs.role });
      form.append(
        createField('Display name', nameInput),
        createField('Role', roleInput)
      );

      var live = $tag('p', { style: { margin: '0', fontSize: '14px' } });
      function render() { live.textContent = 'Live: ' + prefs.name + ' \u00B7 ' + prefs.role; }

      var unsubName  = prefs.$bindInput(nameInput, 'name');
      var unsubRole  = prefs.$bindInput(roleInput, 'role');
      var unsubAll   = prefs.$subscribe(render);
      render();

      var urlBtn = createBtn('Sync to URL', { variant: 'ghost', type: 'button', onclick: function () { os.syncUrlState(); os.toast('Window state synced to ?windows=', 'info'); } });
      root.appendChild(createCard('Reactive signals', $tag('div', null, [form, $tag('div', { style: { marginTop: '12px' } }, [live])])));
      root.appendChild(createCard('Persistence', $tag('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [$text('Changes persist to localStorage automatically.'), urlBtn])));
      return root;
    }
  });

  // -----------------------------------------------------------------------
  // APP: Config — runtime flags
  // -----------------------------------------------------------------------
  os.registerApp('config', {
    title: 'Config',
    icon: 'settings',
    placement: 'dock',
    content: function () {
      var root = section();
      var toggles = $tag('div', { style: { display: 'grid', gap: '10px' } });
      toggles.append(
        createSwitch({ checked: true, label: 'Animations', onChange: function (checked) { document.documentElement.setAttribute('data-animations', String(checked)); } }),
        createSwitch({ checked: true, label: 'GPU acceleration', onChange: function (checked) { document.documentElement.setAttribute('data-gpu', String(checked)); } })
      );
      root.appendChild(createCard('Runtime flags', toggles));
      return root;
    }
  });

  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  // APP: About — project story, TypeScript features, architecture, use cases
  // -----------------------------------------------------------------------
  os.registerApp('about', {
    title: 'About',
    icon: 'info',
    maximized: true,
    placement: 'dock',
    content: function () {
      var root = section();

      function bullets(items) {
        var list = $tag('ul', { style: { margin: '0', paddingLeft: '18px', display: 'grid', gap: '6px', lineHeight: '1.5' } });
        items.forEach(function (item) {
          list.appendChild($tag('li', null, [
            $tag('strong', null, [$text(item[0] + ' — ')]),
            $text(item[1])
          ]));
        });
        return list;
      }

      function chipRow(names) {
        var row = $tag('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
        names.forEach(function (name) { row.appendChild(createBadge(name, 'dark')); });
        return row;
      }

      function useCard(icon, title, body) {
        var bodyChildren = typeof body === 'string' ? [$text(body)] : (Array.isArray(body) ? body : [body]);
        return $tag('div', { class: 'card' }, [$tag('div', { class: 'card-body' }, [
          $tag('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } }, [$icon(icon, { style: 'width:18px;height:18px' }), $tag('strong', null, [$text(title)])]),
          $tag('div', { style: { opacity: '0.7', fontSize: '12px', lineHeight: '1.6' } }, bodyChildren)
        ])]);
      }

      // ── Hero ────────────────────────────────────────────────────────────
      var hero = $tag('div', { style: { padding: '20px 0 14px', textAlign: 'center' } });
      hero.append(
        $tag('div', { style: { fontSize: '40px', fontWeight: '800', letterSpacing: '-0.5px' } }, [$text('Prestige UI')]),
        $tag('p', { style: { margin: '8px 0 0', opacity: '0.7', fontSize: '15px' } }, [$text('A type-safe web desktop shell — compiled from strict TypeScript into standalone vanilla JavaScript.')]),
        $tag('div', { style: { marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'center' } }, [
          createBadge('Open source', 'dark'),
          createBadge('TypeScript', 'dark'),
          createBadge('Zero-dependency', 'dark'),
          createBadge('AI / ML ready', 'dark'),
          createBadge('Web3 ready', 'dark')
        ])
      );
      root.appendChild(hero);

      // ── Key metrics strip ───────────────────────────────────────────────
      var metrics = $tag('div', { class: 'stats-row' });
      metrics.append(
        createStatCard('0', 'Runtime deps'),
        createStatCard('178 / 178', 'Tests passing'),
        createStatCard('62', 'Lucide icons'),
        createStatCard('28+', 'Components'),
        createStatCard('~140 kB', 'JS bundle')
      );
      root.appendChild(createCard('At a glance', metrics));

      // ── Project story ───────────────────────────────────────────────────
      var intro = $tag('div', { style: { fontSize: '13px', lineHeight: '1.7', opacity: '0.85' } }, [
        $tag('strong', null, [$text('Prestige UI')]),
        $text(' began as an advanced '),
        $tag('strong', null, [$text('proprietary interface')]),
        $text(', engineered in '),
        $tag('strong', null, [$text('C++ on the Qt framework')]),
        $text(' to deliver a '),
        $tag('strong', null, [$text('high-performance, secure, and visually distinctive')]),
        $text(' commercial user interface. This '),
        $tag('strong', null, [$text('open-source release')]),
        $text(' re-imagines that heritage for the modern web: the entire shell is authored in '),
        $tag('strong', null, [$text('strict TypeScript')]),
        $text(' and compiled down to '),
        $tag('strong', null, [$text('standalone, zero-dependency JavaScript')]),
        $text('. TypeScript is purely a '),
        $tag('strong', null, [$text('compile-time tool')]),
        $text(' — what ships is '),
        $tag('strong', null, [$text('pure vanilla JS + CSS')]),
        $text(' that runs in any browser with a '),
        $tag('strong', null, [$tag('code', null, [$text('<script>')]), $text(' tag')]),
        $text(', with '),
        $tag('strong', null, [$text('no Node, bundler, or build step')]),
        $text(' required by your users.')
      ]);
      root.appendChild(createCard('Project story', intro));

      // ── Frontend + Core features ────────────────────────────────────────
      var features = $tag('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' } });
      features.append(
        createCard('Frontend — visual effects', bullets([
          ['Desktop shell', 'Dock, menubar, topdock, draggable windows with snap, tiling, expose and X-Ray peek.'],
          ['Effects', 'Snap-to-fullscreen, shake and flick to minimize, particle explosion, Ctrl+` switcher, Spotlight search.'],
          ['Theming', '75+ CSS custom properties drive every color — change tokens.css and the theme propagates everywhere.'],
          ['GPU & motion', 'GPU acceleration hints with transform/opacity-only animations for buttery 60fps motion.']
        ])),
        createCard('Core — security & memory', bullets([
          ['Zero-dependency', 'Pure vanilla JS + CSS output — nothing to install, audit, or vendor at runtime.'],
          ['Security', 'XSS-safe by default: structural DOM builders, no innerHTML for dynamic content, sanitized URLs, strict app-id guard.'],
          ['Memory', 'Explicit lifecycle: DisposalStack + Owned on TC39 Symbol.dispose, and a full destroy() to tear down cleanly.'],
          ['Config-driven', 'Every feature is a constructor flag — disable anything at runtime, no code changes needed.']
        ]))
      );
      root.appendChild(features);

      // ── TypeScript — developer experience ───────────────────────────────
      root.appendChild(createCard('TypeScript — developer experience', $tag('div', { style: { display: 'grid', gap: '8px', fontSize: '13px', lineHeight: '1.7', opacity: '0.85' } }, [
        $tag('p', { style: { margin: '0' } }, [$text('The whole shell is written in strict TypeScript: noImplicitAny, strictNullChecks, exactOptionalPropertyTypes, noUnusedLocals — the compiler catches whole classes of bugs before they ship, and editors give full autocomplete and type inference over the public API (dist/index.d.ts).')]),
        $tag('p', { style: { margin: '0' } }, [$text('Zero runtime cost: TypeScript never ships. The build emits standalone ES modules (dist/prestige.js) and a UMD drop-in (dist/prestige.umd.cjs) that restores the vanilla window.* helpers, so legacy <script> pages keep working unchanged.')])
      ])));

      // ── Typed contracts grid ────────────────────────────────────────────
      root.appendChild(createCard('Typed contracts out of the box', $tag('div', { style: { display: 'grid', gap: '8px', fontSize: '13px', lineHeight: '1.7', opacity: '0.85' } }, [
        $tag('p', { style: { margin: '0' } }, [$text('Domain models are shipped as strict interfaces (AppManifest, WindowState, StoreOptions, ModelConfig, SSEStreamEvent, Web3TransactionDetails), so AI/ML and Web3 integrations type-check against a single source of truth.')]),
        chipRow(['AppManifest', 'WindowState', 'SSEStreamEvent', 'ModelConfig', 'Web3TransactionDetails', 'DisposalStack', 'Owned', 'PrestigeStore', 'ComponentRegistry'])
      ])));

      // ── Architecture & innovation ───────────────────────────────────────
      root.appendChild(createCard('Architecture & innovation', $tag('div', { style: { display: 'grid', gap: '8px', fontSize: '13px', lineHeight: '1.7', opacity: '0.85' } }, [
        $tag('p', { style: { margin: '0' } }, [$text('The codebase is modular by design: focused TypeScript modules under typescript/src/ (utils, core, ui, types), each with a single responsibility. Extensions register through the component registry or the app manifest rather than touching core internals.')]),
        $tag('p', { style: { margin: '0' } }, [$text('Components are DOM-first: factory functions build real nodes with typed $tag()/$text() helpers, preserving event handlers and lifecycle ownership, with opt-in HTML parsing for trusted content only. Event delegation, GPU-rendered layers, and transform/opacity-only animation keep the shell fast even with many windows open.')])
      ])));

      // ── Tech stack ──────────────────────────────────────────────────────
      root.appendChild(createCard('Built with', $tag('div', { style: { display: 'grid', gap: '12px', fontSize: '13px', lineHeight: '1.7', opacity: '0.85' } }, [
        $tag('p', { style: { margin: '0' } }, [$text('Authoring and release tooling — all dev-only, never shipped to your users.')]),
        chipRow(['TypeScript 5.5+', 'Vite 6', 'Vitest 3', 'happy-dom', 'Terser', 'Python (CSS build)'])
      ])));

      // ── Distribution ────────────────────────────────────────────────────
      root.appendChild(createCard('What ships', $tag('div', { style: { display: 'grid', gap: '8px', fontSize: '13px', lineHeight: '1.7', opacity: '0.85' } }, [
        $tag('p', { style: { margin: '0' } }, [$text('Three drop-in artifacts plus types and integrity manifests — no bundler on your side.')]),
        chipRow(['prestige.umd.cjs', 'prestige.js', 'prestige.css', 'index.d.ts', 'manifest.json'])
      ])));

      // ── Use cases ───────────────────────────────────────────────────────
      var uses = $tag('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' } });
      uses.append(
        useCard('gauge', 'Dashboards', [
          $tag('strong', null, [$text('Stat cards')]), $text(', '),
          $tag('strong', null, [$text('data tables')]), $text(', '),
          $tag('strong', null, [$text('progress indicators')]), $text(', and '),
          $tag('strong', null, [$text('real-time toasts')]),
          $text(' engineered for executive control centers, live operations monitoring, and analytics dashboards.')
        ]),
        useCard('cpu', 'AI / ML Platforms', [
          $text('Streamlined user interfaces for '),
          $tag('strong', null, [$text('AI model management')]), $text(', '),
          $tag('strong', null, [$text('interactive chat windows')]), $text(', and '),
          $tag('strong', null, [$text('live streaming data logs')]),
          $text(' backed by robust state management and instant, reactive updates.')
        ]),
        useCard('shield', 'Web3 & Security', [
          $text('High-assurance UI modules for '),
          $tag('strong', null, [$text('secure transaction confirmation')]), $text(', '),
          $tag('strong', null, [$text('wallet monitoring')]), $text(', and '),
          $tag('strong', null, [$text('tamper-evident visual guards')]),
          $text(' built for enterprise security and decentralized applications.')
        ])
      );
      root.appendChild(uses);

      // ── GitHub button — bottom center ───────────────────────────────────
      var footer = $tag('div', { style: { marginTop: '18px', display: 'flex', justifyContent: 'center' } });
      footer.appendChild(createBtn('View project on GitHub', {
        variant: 'primary',
        type: 'button',
        onclick: function () { window.open('https://github.com/Eng-AliKazemi/PRESTIGE-UI', '_blank', 'noopener'); }
      }));
      root.appendChild(footer);
      return root;
    }
  });

  // Menubar actions are thin wrappers over core methods.
  $id('search-btn').addEventListener('click', function () { os.showSearch(); });
  $id('lock-btn').addEventListener('click', function () { os.lock(); });
  $id('logout-btn').addEventListener('click', function () {
    os.dialogConfirm({ title: 'Logout', message: 'Are you sure you want to logout?' })
      .then(function (ok) { if (ok) os.toast('Logged out successfully.', 'success'); });
  });

  if (typeof renderIcons === 'function') renderIcons();
});
