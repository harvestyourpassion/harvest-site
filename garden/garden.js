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
    loadCoach().then(function () {
      // Returning from Google Calendar OAuth consent? Capture the refresh token.
      if (new URLSearchParams(w.location.search).get('calconnect') === '1') {
        captureCalendarToken();
      } else {
        show('dashboard');
      }
    });
  }

  function captureCalendarToken() {
    var m = $main();
    m.innerHTML = H.loading({ skeleton: true, count: 1 });
    sb.auth.getSession().then(function (res) {
      var s = res.data.session;
      var refresh = s && s.provider_refresh_token;
      var access = s && s.provider_token;
      if (!refresh) {
        H.toast('Google didn’t return a refresh token — try Connect again and allow offline access.', 'error');
        history.replaceState({}, '', '/garden/');
        show('settings'); return;
      }
      sb.functions.invoke('google-calendar', {
        body: { action: 'connect', coach_id: coach.id, refresh_token: refresh, access_token: access, email: (s.user && s.user.email) }
      }).then(function (r) {
        if (r && r.data && r.data.connected) H.toast('Google Calendar connected', 'success');
        else H.toast('Connect failed: ' + ((r.data && r.data.error) || (r.error && r.error.message) || '?'), 'error');
        history.replaceState({}, '', '/garden/');
        show('settings');
      }).catch(function (e) { H.toast('Connect error: ' + e.message, 'error'); show('settings'); });
    });
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
      .then(function (res) {
        coach = res.data;
        // Admins manage a single coaching practice. If this admin account isn't
        // the one the coach row is keyed to, fall back to the first coach so
        // Garden works regardless of which of Leo's accounts is signed in.
        if (!coach && profile.role === 'admin') {
          return sb.from('coaches').select('*').order('created_at').limit(1).maybeSingle()
            .then(function (r2) { coach = r2.data; });
        }
      });
  }

  function show(view, arg) {
    var m = $main();
    m.innerHTML = H.loading({ skeleton: true, count: 3 });
    if (view === 'dashboard') return renderDashboard(m);
    if (view === 'clients') return renderClients(m);
    if (view === 'messages') return w.Messaging.mount(m);
    if (view === 'client') return renderClient(m, arg);
    if (view === 'session') return renderSession(m, arg);
    if (view === 'sessions') return renderSessions(m);
    if (view === 'packages') return renderPackages(m);
    if (view === 'billing') return renderBilling(m);
    if (view === 'surveys') return renderSurveys(m);
    if (view === 'contracts') return renderContracts(m);
    if (view === 'emails') return renderEmails(m);
    if (view === 'insights') return renderInsights(m);
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
        H.button({ label: 'Add Note', variant: 'ghost', id: 'g-c-note' }) +
        (c.user_id ? H.button({ label: '👁 View as Client', variant: 'secondary', id: 'g-c-actas' }) : '') + '</div>';
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
      var actAs = document.getElementById('g-c-actas');
      if (actAs) actAs.addEventListener('click', function () {
        w.location.href = '/roots/?as=' + encodeURIComponent(c.user_id) + '&asname=' + encodeURIComponent(c.name || 'Client');
      });
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
            html += '<div data-session-id="' + H.esc(s.id) + '" style="cursor:pointer">' + H.card({ body:
              '<div class="h-row" style="justify-content:space-between">' +
              '<span>' + fmtDate(s.scheduled_at) + '</span>' +
              H.badge(s.status || 'scheduled', s.status === 'completed' ? 'done' : 'active') + '</div>'
            }) + '</div>';
          });
          html += '</div>';
        }
        m.innerHTML = html;
        m.querySelectorAll('[data-session-id]').forEach(function (el) {
          el.addEventListener('click', function () { show('session', el.getAttribute('data-session-id')); });
        });
      });
  }

  // ---------- Session detail (prep/live/post + outcome) ----------
  var OUTCOMES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'forfeited', 'no_show'];
  function renderSession(m, sessionId) {
    Promise.all([
      sb.from('sessions').select('*, clients(name,email)').eq('id', sessionId).maybeSingle(),
      sb.from('session_notes').select('*').eq('session_id', sessionId).order('created_at')
    ]).then(function (res) {
      var s = res[0].data;
      var notes = res[1].data || [];
      if (!s) { m.innerHTML = H.error({ title: 'Session not found' }); return; }
      var clientName = (s.clients && (s.clients.name || s.clients.email)) || 'Client';
      var html = '<a class="h-muted" style="cursor:pointer;font-size:13px" id="g-s-back">&larr; Sessions</a>';
      html += head('Session — ' + clientName, fmtDate(s.scheduled_at));
      html += '<div class="h-row" style="gap:6px;flex-wrap:wrap;margin-bottom:16px">';
      OUTCOMES.forEach(function (o) {
        html += '<button class="h-btn ' + (s.status === o ? 'h-btn--primary' : 'h-btn--secondary') + '" style="min-height:34px;padding:0 10px" data-outcome="' + o + '">' + o.replace('_', ' ') + '</button>';
      });
      html += '</div>';
      if (s.zoom_link) html += H.card({ body: '🔗 <a href="' + H.esc(s.zoom_link) + '" target="_blank" style="color:var(--accent-blue)">Zoom link</a>' });

      ['prep', 'live', 'post'].forEach(function (kind) {
        var note = notes.filter(function (n) { return n.type === kind; })[0];
        html += '<div class="g-section-title">' + kind.charAt(0).toUpperCase() + kind.slice(1) + ' notes</div>';
        html += '<textarea class="h-textarea" id="g-note-' + kind + '" placeholder="' + kind + ' notes…">' + H.esc(note ? note.content : '') + '</textarea>';
      });
      html += '<div class="h-row" style="gap:8px;margin-top:14px">' +
        H.button({ label: 'Save Notes', id: 'g-save-notes' }) +
        H.button({ label: 'Post-Session: generate follow-up', variant: 'secondary', id: 'g-followup' }) + '</div>';
      m.innerHTML = html;

      document.getElementById('g-s-back').addEventListener('click', function () { show('sessions'); });
      m.querySelectorAll('[data-outcome]').forEach(function (b) {
        b.addEventListener('click', function () {
          sb.from('sessions').update({ status: b.getAttribute('data-outcome') }).eq('id', sessionId).then(function (r) {
            if (r.error) H.toast('Failed: ' + r.error.message, 'error');
            else { H.toast('Outcome: ' + b.getAttribute('data-outcome'), 'success'); show('session', sessionId); }
          });
        });
      });
      document.getElementById('g-save-notes').addEventListener('click', function () {
        saveNotes(sessionId, notes);
      });
      document.getElementById('g-followup').addEventListener('click', function () {
        postSessionFollowup(s);
      });
    });
  }

  function saveNotes(sessionId, existing) {
    var ops = ['prep', 'live', 'post'].map(function (kind) {
      var content = document.getElementById('g-note-' + kind).value;
      var note = existing.filter(function (n) { return n.type === kind; })[0];
      if (note) return sb.from('session_notes').update({ content: content }).eq('id', note.id);
      if (content.trim()) return sb.from('session_notes').insert({ session_id: sessionId, type: kind, content: content });
      return Promise.resolve();
    });
    Promise.all(ops).then(function () { H.toast('Notes saved', 'success'); });
  }

  // Post-session one-button: mark generated, log a summary to the client timeline.
  function postSessionFollowup(s) {
    var post = document.getElementById('g-note-post');
    var summary = (post && post.value.trim()) || 'Session completed — follow-up generated.';
    Promise.all([
      sb.from('sessions').update({ status: 'completed', follow_up_generated: true, summary: summary }).eq('id', s.id),
      sb.from('client_activity').insert({ client_id: s.client_id, type: 'session', description: 'Session summary: ' + summary })
    ]).then(function (res) {
      if (res[0].error || res[1].error) H.toast('Partial failure — check console', 'error');
      else { H.toast('Follow-up generated & logged to timeline', 'success'); show('session', s.id); }
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
        html += '<div class="g-section-title">Google Calendar</div>';
        html += '<div id="g-cal-block" class="h-card">' + H.loading({}) + '</div>';
        m.innerHTML = html;
        document.getElementById('g-save-avail').addEventListener('click', saveAvailability);
        renderCalendarBlock();
      });
  }

  function renderCalendarBlock() {
    var block = document.getElementById('g-cal-block');
    if (!block) return;
    sb.functions.invoke('google-calendar', { body: { action: 'status', coach_id: coach.id } }).then(function (r) {
      var connected = r && r.data && r.data.connected;
      var email = r && r.data && r.data.email;
      if (connected) {
        block.innerHTML = '<div class="h-row" style="justify-content:space-between">' +
          '<span>' + H.badge('Connected', 'active') + ' <span class="h-muted">' + H.esc(email || '') + '</span></span>' +
          H.button({ label: 'Disconnect', variant: 'ghost', id: 'g-cal-disc' }) + '</div>' +
          '<p class="h-muted" style="font-size:13px;margin-top:8px">Booked times are checked against your Google Calendar so clients only see when you’re actually free.</p>';
        document.getElementById('g-cal-disc').addEventListener('click', function () {
          sb.functions.invoke('google-calendar', { body: { action: 'disconnect', coach_id: coach.id } }).then(function () { H.toast('Disconnected', 'info'); renderCalendarBlock(); });
        });
      } else {
        block.innerHTML = '<p class="h-muted" style="font-size:13px;margin-bottom:10px">Connect your Google Calendar so availability reflects your real schedule.</p>' +
          H.button({ label: 'Connect Google Calendar', id: 'g-cal-conn' });
        document.getElementById('g-cal-conn').addEventListener('click', connectCalendar);
      }
    }).catch(function () { block.innerHTML = H.error({ title: 'Calendar status unavailable' }); });
  }

  function connectCalendar() {
    sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
        redirectTo: w.location.origin + '/garden/?calconnect=1',
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
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
            sb.from('sessions').insert(row).select('id').maybeSingle().then(function (res) {
              if (res.error) { H.toast('Failed: ' + res.error.message, 'error'); return; }
              var sessionId = res.data && res.data.id;
              // Attach a Zoom link (best-effort; server-side gated by zoom flag).
              sb.functions.invoke('zoom-meeting', {
                body: { topic: 'Harvest Coaching Session', start_time: row.scheduled_at, duration: row.duration_minutes, session_id: sessionId }
              }).then(function (z) {
                // Also push to Google Calendar (no-op if not connected/disabled).
                sb.functions.invoke('google-calendar', { body: { action: 'create-event', coach_id: coach.id, session_id: sessionId } }).catch(function () {});
                if (z && z.data && z.data.join_url) H.toast('Session scheduled + Zoom link added', 'success');
                else H.toast('Session scheduled', 'success');
                ctl.close(); show('sessions');
              }).catch(function () { H.toast('Session scheduled', 'success'); ctl.close(); show('sessions'); });
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

  // ---------- Surveys ----------
  function renderSurveys(m) {
    sb.from('surveys').select('*').eq('coach_id', coach ? coach.id : '0').order('created_at', { ascending: false })
      .then(function (res) {
        var surveys = res.data || [];
        var html = head('Surveys', 'Intake, check-in, and end-of-package surveys');
        html += '<div style="margin-bottom:16px">' + H.button({ label: '+ New Survey', id: 'g-new-survey' }) + '</div>';
        if (!surveys.length) {
          html += H.card({ body: H.empty({ icon: '📋', title: 'No surveys yet', description: 'Build an intake or check-in survey to send clients.' }) });
        } else {
          html += '<div style="display:flex;flex-direction:column;gap:10px">';
          surveys.forEach(function (s) {
            html += '<div class="h-card" data-survey="' + H.esc(s.id) + '" style="cursor:pointer">' +
              '<div class="h-row" style="justify-content:space-between"><strong>' + H.esc(s.name) + '</strong>' +
              H.badge(s.trigger_type || 'manual', 'neutral') + '</div>' +
              (s.description ? '<div class="h-muted" style="font-size:13px;margin-top:4px">' + H.esc(s.description) + '</div>' : '') + '</div>';
          });
          html += '</div>';
        }
        m.innerHTML = html;
        document.getElementById('g-new-survey').addEventListener('click', newSurveyModal);
        m.querySelectorAll('[data-survey]').forEach(function (el) {
          el.addEventListener('click', function () { surveyDetail(el.getAttribute('data-survey')); });
        });
      });
  }

  function newSurveyModal() {
    H.modal({
      title: 'New Survey',
      body: H.input({ id: 'sv-name', label: 'Name', placeholder: 'Intake Survey' }) +
        H.input({ id: 'sv-desc', label: 'Description', type: 'textarea' }) +
        H.input({ id: 'sv-trigger', label: 'When to send', type: 'select', options: [
          { value: 'manual', label: 'Manually' }, { value: 'on_signup', label: 'On signup' },
          { value: 'pre_session', label: 'Before session' }, { value: 'end_of_package', label: 'End of package' }
        ], value: 'manual' }),
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Create', variant: 'primary' }],
      onMount: function (ctl) {
        ctl.el.querySelector('.h-btn--ghost').addEventListener('click', ctl.close);
        ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
          var name = document.getElementById('sv-name').value.trim();
          if (!name) { H.toast('Name required', 'error'); return; }
          sb.from('surveys').insert({
            coach_id: coach.id, name: name,
            description: document.getElementById('sv-desc').value.trim(),
            trigger_type: document.getElementById('sv-trigger').value
          }).then(function (res) {
            if (res.error) H.toast('Failed: ' + res.error.message, 'error');
            else { H.toast('Survey created', 'success'); ctl.close(); show('surveys'); }
          });
        });
      }
    });
  }

  function surveyDetail(surveyId) {
    Promise.all([
      sb.from('surveys').select('*').eq('id', surveyId).maybeSingle(),
      sb.from('survey_questions').select('*').eq('survey_id', surveyId).order('order_index'),
      sb.from('survey_responses').select('*, clients(name,email)').eq('survey_id', surveyId).order('submitted_at', { ascending: false })
    ]).then(function (res) {
      var s = res[0].data, qs = res[1].data || [], resp = res[2].data || [];
      var body = '<div class="g-section-title" style="margin-top:0">Questions (' + qs.length + ')</div>';
      body += '<div style="display:flex;flex-direction:column;gap:6px">';
      qs.forEach(function (q) { body += '<div class="h-card">' + H.esc(q.content) + ' ' + H.badge(q.type || 'text', 'neutral') + '</div>'; });
      body += '</div>';
      body += '<div style="margin:12px 0">' +
        H.input({ id: 'sq-content', label: 'Add a question', placeholder: 'Question text' }) +
        H.input({ id: 'sq-type', label: 'Type', type: 'select', options: ['short_text', 'long_text', 'scale', 'choice'], value: 'short_text' }) +
        H.button({ label: 'Add Question', id: 'sq-add', variant: 'secondary' }) + '</div>';
      body += '<div class="g-section-title">Responses (' + resp.length + ')</div>';
      if (!resp.length) body += H.card({ body: H.empty({ icon: '📥', title: 'No responses yet' }) });
      else {
        resp.forEach(function (r) {
          var who = (r.clients && (r.clients.name || r.clients.email)) || 'Client';
          body += '<div class="h-card"><strong>' + H.esc(who) + '</strong><pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;color:var(--text-secondary);margin:6px 0 0">' + H.esc(JSON.stringify(r.answers || {}, null, 2)) + '</pre></div>';
        });
      }
      var modal = H.modal({ title: s ? s.name : 'Survey', body: body, actions: [{ label: 'Close', variant: 'ghost' }] });
      modal.el.querySelector('.h-btn--ghost').addEventListener('click', modal.close);
      modal.el.querySelector('#sq-add').addEventListener('click', function () {
        var content = document.getElementById('sq-content').value.trim();
        if (!content) return;
        sb.from('survey_questions').insert({
          survey_id: surveyId, content: content,
          type: document.getElementById('sq-type').value, order_index: qs.length
        }).then(function (r) {
          if (r.error) H.toast('Failed: ' + r.error.message, 'error');
          else { H.toast('Question added', 'success'); modal.close(); surveyDetail(surveyId); }
        });
      });
    });
  }

  // ---------- Contracts ----------
  function renderContracts(m) {
    sb.from('contracts').select('*, clients(name,email)').eq('coach_id', coach ? coach.id : '0').order('created_at', { ascending: false })
      .then(function (res) {
        var contracts = res.data || [];
        var html = head('Contracts', 'Agreements & signatures');
        html += '<div style="margin-bottom:16px">' + H.button({ label: '+ New Contract', id: 'g-new-contract' }) + '</div>';
        if (!contracts.length) {
          html += H.card({ body: H.empty({ icon: '📝', title: 'No contracts yet', description: 'Send an agreement to a client for signature.' }) });
        } else {
          html += '<div style="display:flex;flex-direction:column;gap:10px">';
          contracts.forEach(function (c) {
            var who = (c.clients && (c.clients.name || c.clients.email)) || 'Client';
            var kind = c.status === 'signed' ? 'done' : (c.status === 'expired' ? 'overdue' : 'paused');
            html += '<div class="h-card" data-contract="' + H.esc(c.id) + '" style="cursor:pointer">' +
              '<div class="h-row" style="justify-content:space-between"><strong>' + H.esc(who) + '</strong>' + H.badge(c.status || 'pending', kind) + '</div>' +
              (c.expires_at ? '<div class="h-muted" style="font-size:12px;margin-top:4px">Expires ' + fmtDate(c.expires_at) + '</div>' : '') + '</div>';
          });
          html += '</div>';
        }
        m.innerHTML = html;
        document.getElementById('g-new-contract').addEventListener('click', newContractModal);
        m.querySelectorAll('[data-contract]').forEach(function (el) {
          el.addEventListener('click', function () { contractActions(el.getAttribute('data-contract')); });
        });
      });
  }

  function newContractModal() {
    sb.from('clients').select('id,name,email').eq('coach_id', coach.id).then(function (res) {
      var clients = res.data || [];
      var opts = clients.map(function (c) { return { value: c.id, label: c.name || c.email }; });
      H.modal({
        title: 'New Contract',
        body: (opts.length ? H.input({ id: 'ct-client', label: 'Client', type: 'select', options: opts }) : '<p class="h-muted">Add a client first.</p>') +
          H.input({ id: 'ct-url', label: 'Document URL (optional)', placeholder: 'https://…' }) +
          H.input({ id: 'ct-expires', label: 'Expires', type: 'date' }),
        actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Create', variant: 'primary' }],
        onMount: function (ctl) {
          ctl.el.querySelector('.h-btn--ghost').addEventListener('click', ctl.close);
          ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
            if (!opts.length) { ctl.close(); return; }
            var exp = document.getElementById('ct-expires').value;
            sb.from('contracts').insert({
              coach_id: coach.id, client_id: document.getElementById('ct-client').value,
              template_url: document.getElementById('ct-url').value.trim() || null,
              status: 'pending', expires_at: exp ? new Date(exp).toISOString() : null
            }).then(function (r) {
              if (r.error) H.toast('Failed: ' + r.error.message, 'error');
              else { H.toast('Contract created', 'success'); ctl.close(); show('contracts'); }
            });
          });
        }
      });
    });
  }

  function contractActions(id) {
    H.modal({
      title: 'Contract',
      body: '<p class="h-muted">Update the signature status.</p>',
      actions: [
        { label: 'Mark Signed', variant: 'primary' },
        { label: 'Mark Expired', variant: 'destructive' },
        { label: 'Close', variant: 'ghost' }
      ],
      onMount: function (ctl) {
        ctl.el.querySelector('.h-btn--ghost').addEventListener('click', ctl.close);
        ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
          sb.from('contracts').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('id', id).then(function () { H.toast('Marked signed', 'success'); ctl.close(); show('contracts'); });
        });
        ctl.el.querySelector('.h-btn--destructive').addEventListener('click', function () {
          sb.from('contracts').update({ status: 'expired' }).eq('id', id).then(function () { H.toast('Marked expired', 'info'); ctl.close(); show('contracts'); });
        });
      }
    });
  }

  // ---------- Email Templates ----------
  var EMAIL_VARS = ['{client_name}', '{session_date}', '{package_name}', '{zoom_link}'];
  function renderEmails(m) {
    sb.from('email_templates').select('*').eq('coach_id', coach ? coach.id : '0').order('created_at', { ascending: false })
      .then(function (res) {
        var templates = res.data || [];
        var html = head('Email Templates', 'Reusable messages with variables');
        html += '<div style="margin-bottom:16px">' + H.button({ label: '+ New Template', id: 'g-new-email' }) + '</div>';
        html += '<div class="h-muted" style="font-size:13px;margin-bottom:12px">Variables: ' + EMAIL_VARS.map(function (v) { return '<code>' + v + '</code>'; }).join(' ') + '</div>';
        if (!templates.length) {
          html += H.card({ body: H.empty({ icon: '✉️', title: 'No templates yet', description: 'Create reusable emails for booking, reminders, and follow-ups.' }) });
        } else {
          html += '<div style="display:flex;flex-direction:column;gap:10px">';
          templates.forEach(function (t) {
            html += '<div class="h-card" data-email="' + H.esc(t.id) + '" style="cursor:pointer">' +
              '<strong>' + H.esc(t.name) + '</strong><div class="h-muted" style="font-size:13px">' + H.esc(t.subject || '') + '</div></div>';
          });
          html += '</div>';
        }
        m.innerHTML = html;
        document.getElementById('g-new-email').addEventListener('click', function () { emailModal(null); });
        m.querySelectorAll('[data-email]').forEach(function (el) {
          var t = templates.find(function (x) { return x.id === el.getAttribute('data-email'); });
          el.addEventListener('click', function () { emailModal(t); });
        });
      });
  }

  function emailModal(t) {
    t = t || {};
    H.modal({
      title: t.id ? 'Edit Template' : 'New Template',
      body: H.input({ id: 'em-name', label: 'Name', value: t.name || '' }) +
        H.input({ id: 'em-subject', label: 'Subject', value: t.subject || '' }) +
        H.input({ id: 'em-body', label: 'Body', type: 'textarea', value: t.body || '' }) +
        H.input({ id: 'em-trigger', label: 'Trigger', type: 'select', options: ['manual', 'on_booking', 'reminder_48h', 'reminder_24h', 'reminder_1h', 'post_session'], value: t.trigger_type || 'manual' }),
      actions: (t.id ? [{ label: 'Delete', variant: 'destructive' }] : []).concat([{ label: 'Save', variant: 'primary' }]),
      onMount: function (ctl) {
        if (t.id) ctl.el.querySelector('.h-btn--destructive').addEventListener('click', function () {
          sb.from('email_templates').delete().eq('id', t.id).then(function () { H.toast('Deleted', 'info'); ctl.close(); show('emails'); });
        });
        ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
          var row = {
            coach_id: coach.id, name: document.getElementById('em-name').value.trim(),
            subject: document.getElementById('em-subject').value, body: document.getElementById('em-body').value,
            trigger_type: document.getElementById('em-trigger').value, variables: EMAIL_VARS
          };
          if (!row.name) { H.toast('Name required', 'error'); return; }
          var op = t.id ? sb.from('email_templates').update(row).eq('id', t.id) : sb.from('email_templates').insert(row);
          op.then(function (r) {
            if (r.error) H.toast('Failed: ' + r.error.message, 'error');
            else { H.toast('Saved', 'success'); ctl.close(); show('emails'); }
          });
        });
      }
    });
  }

  // ---------- Insights ----------
  function renderInsights(m) {
    var cid = coach ? coach.id : '0';
    sb.from('sessions').select('id,mode,status').eq('coach_id', cid).then(function (sres) {
      var sessions = sres.data || [];
      var ids = sessions.map(function (s) { return s.id; });
      var notesQ = ids.length
        ? sb.from('session_notes').select('tools_used').in('session_id', ids)
        : Promise.resolve({ data: [] });
      return Promise.resolve(notesQ).then(function (nres) { return { sessions: sessions, notes: nres.data || [] }; });
    }).then(function (bundle) {
      var sessions = bundle.sessions, notes = bundle.notes;
      var completed = sessions.filter(function (s) { return s.status === 'completed'; }).length;
      var modeCount = { coaching: 0, personal_dev: 0, mixed: 0 };
      sessions.forEach(function (s) { if (modeCount[s.mode] != null) modeCount[s.mode]++; });
      var tools = {};
      notes.forEach(function (n) { (n.tools_used || []).forEach(function (t) { tools[t] = (tools[t] || 0) + 1; }); });
      var toolList = Object.keys(tools).sort(function (a, b) { return tools[b] - tools[a]; });

      var html = head('Insights', 'Patterns across your coaching');
      html += '<div class="g-kpis">' +
        H.kpiCard({ value: sessions.length, label: 'Total Sessions' }) +
        H.kpiCard({ value: completed, label: 'Completed' }) +
        H.kpiCard({ value: modeCount.coaching, label: 'Coaching' }) +
        H.kpiCard({ value: modeCount.personal_dev, label: 'Personal Dev' }) + '</div>';
      html += '<div class="g-section-title">Coaching vs Personal Dev</div>';
      var totalModes = modeCount.coaching + modeCount.personal_dev + modeCount.mixed || 1;
      html += H.card({ body:
        'Coaching ' + Math.round(modeCount.coaching / totalModes * 100) + '% · ' +
        'Personal Dev ' + Math.round(modeCount.personal_dev / totalModes * 100) + '% · ' +
        'Mixed ' + Math.round(modeCount.mixed / totalModes * 100) + '%' });
      html += '<div class="g-section-title">Tools Used (frequency)</div>';
      if (!toolList.length) html += H.card({ body: H.empty({ icon: '🧰', title: 'No tools logged yet', description: 'Tools you note in session notes will rank here.' }) });
      else {
        html += '<div style="display:flex;flex-direction:column;gap:6px">';
        toolList.forEach(function (t) { html += '<div class="h-card h-row" style="justify-content:space-between"><span>' + H.esc(t) + '</span>' + H.badge(String(tools[t]), 'neutral') + '</div>'; });
        html += '</div>';
      }
      m.innerHTML = html;
    }).catch(function (e) {
      m.innerHTML = head('Insights') + H.error({ title: 'Failed to load', message: String(e && e.message || e) });
    });
  }

  w.Garden = { init: init };
})(window);
