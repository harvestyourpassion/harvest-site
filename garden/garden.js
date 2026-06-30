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

  function show(view) {
    var m = $main();
    m.innerHTML = H.loading({ skeleton: true, count: 3 });
    if (view === 'dashboard') return renderDashboard(m);
    if (view === 'clients') return renderClients(m);
    if (view === 'sessions') return renderSessions(m);
    if (view === 'packages') return renderPackages(m);
    if (view === 'resources') return renderResources(m);
  }

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
            html += H.card({ body:
              '<div class="h-row" style="justify-content:space-between">' +
              '<div><div style="font-weight:600">' + H.esc(c.name || c.email || 'Unnamed') + '</div>' +
              '<div class="h-muted" style="font-size:12px">' + H.esc(c.email || '') + '</div></div>' +
              H.badge(c.status || 'active', kind) + '</div>' +
              (c.current_focus ? '<div class="h-muted" style="margin-top:6px;font-size:13px">Focus: ' + H.esc(c.current_focus) + '</div>' : '')
            });
          });
          html += '</div>';
        }
        m.innerHTML = html;
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

  w.Garden = { init: init };
})(window);
