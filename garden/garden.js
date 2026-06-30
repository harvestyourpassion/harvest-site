/* garden/garden.js — Garden admin app (coach dashboard).
 * Reads the canonical spec Garden tables via the user's RLS session.
 * Uses window.H components. Admin-gated by guard.js before init().
 */
(function (w) {
  'use strict';

  var sb, profile, coach;
  var els = {};

  function $main() { return document.getElementById('g-main'); }

  function init(p) {
    profile = p;
    sb = w.getSb();
    bindNav();
    loadCoach().then(function () { show('dashboard'); });
  }

  function bindNav() {
    var items = document.querySelectorAll('.g-nav-item[data-view]');
    items.forEach(function (el) {
      el.addEventListener('click', function () {
        items.forEach(function (i) { i.classList.remove('is-active'); });
        el.classList.add('is-active');
        show(el.getAttribute('data-view'));
      });
    });
  }

  function loadCoach() {
    return sb.from('coaches').select('*').eq('user_id', profile.id).maybeSingle()
      .then(function (res) { coach = res.data; });
  }

  function show(view, arg) {
    var m = $main();
    m.innerHTML = H.loading({ skeleton: true, count: 3 });
    if (view === 'dashboard') return renderDashboard(m);
    if (view === 'clients') return renderClients(m);
    if (view === 'client') return renderClient(m, arg);
    if (view === 'sessions') return renderSessions(m);
    if (view === 'packages') return renderPackages(m);
    if (view === 'billing') return renderBilling(m);
    if (view === 'resources') return renderResources(m);
    if (view === 'settings') return renderSettings(m);
  }
  w.GardenNav = show;

  function head(title, sub) {
    return '<h1 class="g-h1">' + H.esc(title) + '</h1><p class="g-sub">' + H.esc(sub || '') + '</p>';
  }

  function fmtMoney(n) { return '$' + Number(n || 0).toLocaleString(); }
  function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }

  // ---------- Dashboard ----------
  function renderDashboard(m) {
    if (!coach) {
      m.innerHTML = head('Garden') + H.error({ title: 'No coach profile', message: 'Your coach record is missing. Contact support.' });
      return;
    }
    var cid = coach.id;
    Promise.all([
      sb.from('clients').select('id,status').eq('coach_id', cid),
      sb.from('sessions').select('id,scheduled_at,status').eq('coach_id', cid),
      sb.from('payments').select('amount,status').then(function (r) { return r; })
    ]).then(function (res) {
      var clients = res[0].data || [];
      var sessions = res[1].data || [];
      var active = clients.filter(function (c) { return c.status === 'active'; }).length;
      var prospects = clients.filter(function (c) { return c.status === 'prospect'; }).length;
      var now = Date.now();
      var upcoming = sessions.filter(function (s) {
        return s.status === 'scheduled' && new Date(s.scheduled_at).getTime() > now;
      });
      var html = head('Dashboard', coach.name);
      html += '<div class="h-row" style="gap:8px;margin-bottom:16px">' +
        H.button({ label: '+ New Client', id: 'g-new-client' }) +
        H.button({ label: '+ New Session', variant: 'secondary', id: 'g-new-session' }) + '</div>';
      html += '<div class="g-kpis">' +
        H.kpiCard({ value: active, label: 'Active Clients' }) +
        H.kpiCard({ value: prospects, label: 'Prospects' }) +
        H.kpiCard({ value: upcoming.length, label: 'Upcoming Sessions' }) +
        H.kpiCard({ value: clients.length, label: 'Total Clients' }) +
        '</div>';

      // Coach Inbox (pending actions)
      html += '<div class="g-section-title">Coach Inbox</div>';
      if (prospects === 0 && upcoming.length === 0) {
        html += H.card({ body: H.empty({ title: 'Inbox zero', description: 'No pending actions right now.' }) });
      } else {
        html += '<div style="display:flex;flex-direction:column;gap:10px">';
        clients.filter(function (c) { return c.status === 'prospect'; }).forEach(function () {
          html += H.card({ body: '<div class="h-row" style="justify-content:space-between">' + H.badge('New prospect', 'paused') + '<span class="h-muted">Review &amp; convert</span></div>' });
        });
        html += '</div>';
      }

      // Next sessions
      html += '<div class="g-section-title">Upcoming Sessions</div>';
      if (upcoming.length === 0) {
        html += H.card({ body: H.empty({ icon: '📅', title: 'No upcoming sessions', description: 'Sessions you schedule will appear here.' }) });
      } else {
        html += '<div style="display:flex;flex-direction:column;gap:10px">';
        upcoming.sort(function (a, b) { return new Date(a.scheduled_at) - new Date(b.scheduled_at); })
          .slice(0, 5).forEach(function (s) {
            html += H.card({ body: '<div class="h-row" style="justify-content:space-between"><span>' + fmtDate(s.scheduled_at) + '</span>' + H.badge('Scheduled', 'active') + '</div>' });
          });
        html += '</div>';
      }
      m.innerHTML = html;
      var nc = document.getElementById('g-new-client');
      var ns = document.getElementById('g-new-session');
      if (nc) nc.addEventListener('click', function () { createClientModal(); });
      if (ns) ns.addEventListener('click', function () { createSessionModal(); });
    }).catch(function (e) {
      m.innerHTML = head('Dashboard') + H.error({ title: 'Failed to load', message: String(e && e.message || e) });
    });
  }

  // ---------- Clients ----------
  function renderClients(m) {
    sb.from('clients').select('*').eq('coach_id', coach ? coach.id : '00000000-0000-0000-0000-000000000000')
      .order('created_at', { ascending: false })
      .then(function (res) {
        var clients = res.data || [];
        var html = head('Clients', clients.length + ' total');
        if (!clients.length) {
          html += H.card({ body: H.empty({ icon: '👥', title: 'No clients yet', description: 'Clients appear here when someone books, or when you convert a prospect from the contact form.' }) });
        } else {
          html += '<div style="display:flex;flex-direction:column;gap:10px">';
          clients.forEach(function (c) {
            var kind = c.status === 'active' ? 'active' : (c.status === 'prospect' ? 'paused' : 'done');
            html += '<div data-client-id="' + H.esc(c.id) + '" style="cursor:pointer">' + H.card({ body:
              '<div class="h-row" style="justify-content:space-between">' +
              '<div><div style="font-weight:600">' + H.esc(c.name || c.email || 'Unnamed') + '</div>' +
              '<div class="h-muted" style="font-size:12px">' + H.esc(c.email || '') + '</div></div>' +
              H.badge(c.status || 'active', kind) + '</div>' +
              (c.current_focus ? '<div class="h-muted" style="margin-top:6px;font-size:13px">Focus: ' + H.esc(c.current_focus) + '</div>' : '')
            }) + '</div>';
          });
          html += '</div>';
        }
        m.innerHTML = html;
        m.querySelectorAll('[data-client-id]').forEach(function (el) {
          el.addEventListener('click', function () { show('client', el.getAttribute('data-client-id')); });
        });
      });
  }

  // ---------- Client detail ----------
  function renderClient(m, clientId) {
    Promise.all([
      sb.from('clients').select('*').eq('id', clientId).maybeSingle(),
      sb.from('sessions').select('*').eq('client_id', clientId).order('scheduled_at', { ascending: false }),
      sb.from('client_activity').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(30)
    ]).then(function (res) {
      var c = res.data || res[0].data;
      c = res[0].data;
      var sessions = res[1].data || [];
      var activity = res[2].data || [];
      if (!c) { m.innerHTML = H.error({ title: 'Client not found' }); return; }
      var html = '<a class="h-muted" style="cursor:pointer;font-size:13px" id="g-back">&larr; Clients</a>';
      html += head(c.name || c.email || 'Client', c.email || '');
      html += '<div class="h-row" style="gap:8px;margin-bottom:16px">' +
        H.badge(c.status || 'active', c.status === 'active' ? 'active' : 'paused') +
        H.button({ label: 'Schedule Session', variant: 'secondary', id: 'g-c-session' }) +
        H.button({ label: 'Add Note', variant: 'ghost', id: 'g-c-note' }) + '</div>';
      if (c.current_focus) html += H.card({ body: '<strong>Current focus:</strong> ' + H.esc(c.current_focus) });
      if (c.goals && c.goals.length) {
        html += '<div class="g-section-title">Goals</div>' + H.card({ body: c.goals.map(function (g) { return H.badge(g, 'neutral'); }).join(' ') });
      }
      html += '<div class="g-section-title">Sessions (' + sessions.length + ')</div>';
      if (!sessions.length) html += H.card({ body: H.empty({ icon: '📅', title: 'No sessions yet' }) });
      else {
        html += '<div style="display:flex;flex-direction:column;gap:8px">';
        sessions.forEach(function (s) {
          html += H.card({ body: '<div class="h-row" style="justify-content:space-between"><span>' + fmtDate(s.scheduled_at) + '</span>' + H.badge(s.status || 'scheduled', s.status === 'completed' ? 'done' : 'active') + '</div>' });
        });
        html += '</div>';
      }
      html += '<div class="g-section-title">Timeline</div>';
      if (!activity.length) html += H.card({ body: H.empty({ icon: '🕑', title: 'No activity yet', description: 'Sessions, shares, and completions will appear here.' }) });
      else {
        html += '<div style="display:flex;flex-direction:column;gap:6px">';
        activity.forEach(function (a) {
          html += '<div class="h-row" style="gap:10px;font-size:13px"><span class="h-muted" style="min-width:90px">' + fmtDate(a.created_at) + '</span><span>' + H.esc(a.description || a.type) + '</span></div>';
        });
        html += '</div>';
      }
      m.innerHTML = html;
      document.getElementById('g-back').addEventListener('click', function () { show('clients'); });
      document.getElementById('g-c-session').addEventListener('click', function () { createSessionModal(c.id); });
      document.getElementById('g-c-note').addEventListener('click', function () { addNoteModal(c.id); });
    });
  }

  // ---------- Sessions ----------
  function renderSessions(m) {
    sb.from('sessions').select('*').eq('coach_id', coach ? coach.id : '0')
      .order('scheduled_at', { ascending: false })
      .then(function (res) {
        var sessions = res.data || [];
        var html = head('Sessions', sessions.length + ' total');
        if (!sessions.length) {
          html += H.card({ body: H.empty({ icon: '📅', title: 'No sessions yet', description: 'Booked and scheduled sessions will show here.' }) });
        } else {
          html += '<div style="display:flex;flex-direction:column;gap:10px">';
          sessions.forEach(function (s) {
            html += H.card({ body:
              '<div class="h-row" style="justify-content:space-between">' +
              '<span>' + fmtDate(s.scheduled_at) + '</span>' +
              H.badge(s.status || 'scheduled', s.status === 'completed' ? 'done' : 'active') + '</div>'
            });
          });
          html += '</div>';
        }
        m.innerHTML = html;
      });
  }

  // ---------- Packages ----------
  function renderPackages(m) {
    sb.from('packages').select('*').eq('coach_id', coach ? coach.id : '0').order('price')
      .then(function (res) {
        var pkgs = res.data || [];
        var html = head('Packages', 'Your coaching offers');
        if (!pkgs.length) {
          html += H.card({ body: H.empty({ icon: '📦', title: 'No packages', description: 'Add coaching packages to sell.' }) });
        } else {
          html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">';
          pkgs.forEach(function (p) {
            html += H.card({ body:
              '<div style="font-weight:700;font-size:16px">' + H.esc(p.name) + '</div>' +
              '<div style="color:var(--accent-green);font-weight:700;font-size:20px;margin:4px 0">' + fmtMoney(p.price) + '</div>' +
              '<div class="h-muted" style="font-size:13px;margin-bottom:8px">' + H.esc(p.description || '') + '</div>' +
              '<div class="h-row" style="gap:6px;flex-wrap:wrap">' +
              H.badge(p.hours + ' hrs', 'neutral') +
              (p.session_count ? H.badge(p.session_count + ' sessions', 'neutral') : '') +
              (p.message_limit === null ? H.badge('Unlimited msgs', 'active') : H.badge(p.message_limit + ' msgs', 'neutral')) +
              '</div>'
            });
          });
          html += '</div>';
        }
        m.innerHTML = html;
      });
  }

  // ---------- Resources ----------
  function renderResources(m) {
    sb.from('resources').select('*').eq('coach_id', coach ? coach.id : '0').order('created_at', { ascending: false })
      .then(function (res) {
        var rs = res.data || [];
        var html = head('Resources', rs.length + ' items');
        if (!rs.length) {
          html += H.card({ body: H.empty({ icon: '📚', title: 'No resources yet', description: 'Frameworks, books, articles, and exercises you can assign to clients will live here.' }) });
        } else {
          html += '<div style="display:flex;flex-direction:column;gap:10px">';
          rs.forEach(function (r) {
            html += H.card({ body: '<div style="font-weight:600">' + H.esc(r.title) + '</div>' + (r.type ? H.badge(r.type, 'neutral') : '') });
          });
          html += '</div>';
        }
        m.innerHTML = html;
      });
  }

  // ---------- Billing ----------
  function renderBilling(m) {
    Promise.all([
      sb.from('payments').select('*').order('paid_at', { ascending: false }).limit(50),
      sb.from('invoices').select('*').order('due_date', { ascending: false }).limit(50)
    ]).then(function (res) {
      var payments = res[0].data || [];
      var invoices = res[1].data || [];
      var revenue = payments.filter(function (p) { return p.status === 'succeeded' || p.status === 'paid'; })
        .reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
      var outstanding = invoices.filter(function (i) { return i.status !== 'paid'; })
        .reduce(function (s, i) { return s + Number(i.amount || 0); }, 0);
      var html = head('Billing', 'Payments & invoices');
      html += '<div class="g-kpis">' +
        H.kpiCard({ value: fmtMoney(revenue), label: 'Revenue' }) +
        H.kpiCard({ value: fmtMoney(outstanding), label: 'Outstanding' }) +
        H.kpiCard({ value: payments.length, label: 'Payments' }) + '</div>';
      html += '<div class="g-section-title">Invoices</div>';
      if (!invoices.length) html += H.card({ body: H.empty({ icon: '🧾', title: 'No invoices yet', description: 'Invoices appear after you bill a client or a package is purchased.' }) });
      else {
        html += '<div style="display:flex;flex-direction:column;gap:8px">';
        invoices.forEach(function (i) {
          var k = i.status === 'paid' ? 'done' : (i.status === 'overdue' ? 'overdue' : 'paused');
          html += H.card({ body: '<div class="h-row" style="justify-content:space-between"><span>' + fmtMoney(i.amount) + ' — ' + H.esc(i.description || '') + '</span>' + H.badge(i.status || 'pending', k) + '</div>' });
        });
        html += '</div>';
      }
      m.innerHTML = html;
    });
  }

  // ---------- Settings (availability) ----------
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function renderSettings(m) {
    sb.from('availability').select('*').eq('coach_id', coach ? coach.id : '0').order('day_of_week')
      .then(function (res) {
        var avail = res.data || [];
        var byDay = {};
        avail.forEach(function (a) { byDay[a.day_of_week] = a; });
        var html = head('Settings', 'Weekly availability for booking');
        html += '<div style="display:flex;flex-direction:column;gap:8px;max-width:480px">';
        for (var d = 0; d < 7; d++) {
          var a = byDay[d];
          html += '<div class="h-card h-row" style="justify-content:space-between" data-day="' + d + '">' +
            '<label class="h-row" style="gap:8px"><input type="checkbox" class="g-day-on" ' + (a ? 'checked' : '') + '> <strong>' + DAYS[d] + '</strong></label>' +
            '<span class="h-row" style="gap:6px">' +
            '<input type="time" class="h-input g-day-start" style="width:120px" value="' + (a ? (a.start_time || '09:00') : '09:00') + '">' +
            '<span class="h-muted">to</span>' +
            '<input type="time" class="h-input g-day-end" style="width:120px" value="' + (a ? (a.end_time || '17:00') : '17:00') + '">' +
            '</span></div>';
        }
        html += '</div>';
        html += '<div style="margin-top:16px">' + H.button({ label: 'Save Availability', id: 'g-save-avail' }) + '</div>';
        m.innerHTML = html;
        document.getElementById('g-save-avail').addEventListener('click', saveAvailability);
      });
  }

  function saveAvailability() {
    var rows = [];
    document.querySelectorAll('[data-day]').forEach(function (el) {
      var d = parseInt(el.getAttribute('data-day'), 10);
      if (el.querySelector('.g-day-on').checked) {
        rows.push({
          coach_id: coach.id, day_of_week: d,
          start_time: el.querySelector('.g-day-start').value || '09:00',
          end_time: el.querySelector('.g-day-end').value || '17:00',
          is_recurring: true
        });
      }
    });
    sb.from('availability').delete().eq('coach_id', coach.id).then(function () {
      if (!rows.length) { H.toast('Availability cleared', 'info'); return; }
      sb.from('availability').insert(rows).then(function (res) {
        if (res.error) H.toast('Save failed: ' + res.error.message, 'error');
        else H.toast('Availability saved', 'success');
      });
    });
  }

  // ---------- Modals ----------
  function createClientModal() {
    H.modal({
      title: 'New Client',
      body: H.input({ id: 'gc-name', label: 'Name', placeholder: 'Full name' }) +
        H.input({ id: 'gc-email', label: 'Email', type: 'email', placeholder: 'name@example.com' }) +
        H.input({ id: 'gc-focus', label: 'Current focus', placeholder: 'What they’re working on' }) +
        H.input({ id: 'gc-status', label: 'Status', type: 'select', options: ['prospect', 'active', 'paused', 'graduated'], value: 'active' }),
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Create', variant: 'primary' }
      ],
      onMount: function (ctl) {
        ctl.el.querySelector('.h-btn--ghost').addEventListener('click', ctl.close);
        ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
          var row = {
            coach_id: coach.id,
            name: document.getElementById('gc-name').value.trim(),
            email: document.getElementById('gc-email').value.trim(),
            current_focus: document.getElementById('gc-focus').value.trim(),
            status: document.getElementById('gc-status').value
          };
          if (!row.name && !row.email) { H.toast('Name or email required', 'error'); return; }
          sb.from('clients').insert(row).then(function (res) {
            if (res.error) H.toast('Failed: ' + res.error.message, 'error');
            else { H.toast('Client added', 'success'); ctl.close(); show('clients'); }
          });
        });
      }
    });
  }

  function createSessionModal(clientId) {
    sb.from('clients').select('id,name,email').eq('coach_id', coach.id).then(function (res) {
      var clients = res.data || [];
      if (!clients.length) { H.toast('Add a client first', 'info'); return; }
      var opts = clients.map(function (c) { return { value: c.id, label: c.name || c.email }; });
      H.modal({
        title: 'Schedule Session',
        body: H.input({ id: 'gs-client', label: 'Client', type: 'select', options: opts, value: clientId || opts[0].value }) +
          H.input({ id: 'gs-when', label: 'Date & time', type: 'datetime-local' }) +
          H.input({ id: 'gs-dur', label: 'Duration (min)', type: 'number', value: '60' }) +
          H.input({ id: 'gs-mode', label: 'Mode', type: 'select', options: ['coaching', 'personal_dev', 'mixed'], value: 'coaching' }),
        actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Schedule', variant: 'primary' }],
        onMount: function (ctl) {
          ctl.el.querySelector('.h-btn--ghost').addEventListener('click', ctl.close);
          ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
            var when = document.getElementById('gs-when').value;
            if (!when) { H.toast('Pick a date/time', 'error'); return; }
            var row = {
              coach_id: coach.id, client_id: document.getElementById('gs-client').value,
              scheduled_at: new Date(when).toISOString(),
              duration_minutes: parseInt(document.getElementById('gs-dur').value, 10) || 60,
              mode: document.getElementById('gs-mode').value, status: 'scheduled'
            };
            sb.from('sessions').insert(row).then(function (res) {
              if (res.error) H.toast('Failed: ' + res.error.message, 'error');
              else { H.toast('Session scheduled', 'success'); ctl.close(); show('sessions'); }
            });
          });
        }
      });
    });
  }

  function addNoteModal(clientId) {
    H.modal({
      title: 'Add Note',
      body: H.input({ id: 'gn-body', label: 'Note', type: 'textarea', placeholder: 'Session note, observation, follow-up…' }),
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Save', variant: 'primary' }],
      onMount: function (ctl) {
        ctl.el.querySelector('.h-btn--ghost').addEventListener('click', ctl.close);
        ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
          var body = document.getElementById('gn-body').value.trim();
          if (!body) { ctl.close(); return; }
          sb.from('client_activity').insert({ client_id: clientId, type: 'comment', description: body }).then(function (res) {
            if (res.error) H.toast('Failed: ' + res.error.message, 'error');
            else { H.toast('Note added', 'success'); ctl.close(); show('client', clientId); }
          });
        });
      }
    });
  }

  w.Garden = { init: init };
})(window);
