/* shared/devpanel.js — admin-only diagnostics panel (GPT-0013).
 * Floating, collapsible, bottom-left. Visible ONLY to admins.
 * Shows: current user, role, environment, Supabase status, PWA status,
 * online status, app version. Load on any page: <script src="/shared/devpanel.js"></script>
 * Depends on shared/supabase.js.
 */
(function (w) {
  'use strict';
  var VERSION = '0.1.0';

  function env() {
    var h = w.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h.indexOf('192.168.') === 0) return 'local';
    if (h.indexOf('netlify.app') !== -1) return 'staging';
    if (h.indexOf('harvestyourpassion.com') !== -1) return 'production';
    return h;
  }

  function dot(ok) {
    return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' +
      (ok ? '#22c55e' : '#ef4444') + ';margin-right:6px;vertical-align:middle"></span>';
  }
  function row(label, value, ok) {
    return '<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-bottom:1px solid #334155">' +
      '<span style="color:#94a3b8">' + label + '</span>' +
      '<span style="color:#e2e8f0;text-align:right">' + (ok === undefined ? '' : dot(ok)) + value + '</span></div>';
  }

  function mount(profile) {
    if (document.getElementById('harvest-devpanel')) return;
    var sb = w.getSb && w.getSb();
    var box = document.createElement('div');
    box.id = 'harvest-devpanel';
    box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99998;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;';
    box.innerHTML =
      '<button id="hdp-toggle" style="background:#334155;color:#e2e8f0;border:1px solid #475569;border-radius:8px;padding:6px 10px;cursor:pointer;font:inherit">⚙ dev</button>' +
      '<div id="hdp-body" style="display:none;margin-top:6px;width:260px;background:#1e293b;border:1px solid #475569;border-radius:10px;padding:10px;box-shadow:0 10px 15px rgba(0,0,0,.4)"></div>';
    document.body.appendChild(box);

    var body = box.querySelector('#hdp-body');
    var toggle = box.querySelector('#hdp-toggle');
    toggle.addEventListener('click', function () {
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
      if (body.style.display === 'block') refresh();
    });

    function refresh() {
      var online = w.navigator.onLine;
      var sw = ('serviceWorker' in w.navigator) && !!w.navigator.serviceWorker.controller;
      var standalone = w.matchMedia && w.matchMedia('(display-mode: standalone)').matches;
      var uid = profile && profile.id ? profile.id.slice(0, 8) + '…' : '—';
      var html = '';
      html += '<div style="font-weight:700;color:#e2e8f0;margin-bottom:6px">Harvest Dev Panel</div>';
      html += row('User', (profile && profile.email) || '—');
      html += row('Role', (profile && profile.role) || '—');
      html += row('User ID', uid);
      html += row('Env', env());
      html += row('Online', online ? 'yes' : 'no', online);
      html += '<div id="hdp-sb-row" style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-bottom:1px solid #334155">' +
        '<span style="color:#94a3b8">Supabase</span>' +
        '<span id="hdp-sb-val" style="color:#e2e8f0;text-align:right">' + (sb ? dot(true) + 'checking…' : dot(false) + 'no client') + '</span></div>';
      html += row('Service Worker', sw ? 'active' : 'inactive', sw);
      html += row('PWA', standalone ? 'installed' : 'browser');
      html += row('Page', w.location.pathname);
      html += row('Version', VERSION);
      html += '<div style="display:flex;gap:6px;margin-top:8px">' +
        '<button id="hdp-copy" style="flex:1;background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:5px;cursor:pointer;font:inherit">Copy</button>' +
        '<button id="hdp-signout" style="flex:1;background:#475569;color:#e2e8f0;border:none;border-radius:6px;padding:5px;cursor:pointer;font:inherit">Sign out</button>' +
        '</div>';
      body.innerHTML = html;

      body.querySelector('#hdp-signout').addEventListener('click', function () {
        if (sb) sb.auth.signOut().then(function () { w.location.reload(); });
      });
      body.querySelector('#hdp-copy').addEventListener('click', function () {
        var txt = body.innerText.replace(/\n+/g, '\n');
        if (w.navigator.clipboard) w.navigator.clipboard.writeText(txt);
      });

      // Live Supabase ping (lightweight, public table)
      if (sb) {
        sb.from('feature_flags').select('key').limit(1).then(function (res) {
          var ok = !res.error;
          var el = body.querySelector('#hdp-sb-val');
          if (el) el.innerHTML = dot(ok) + (ok ? 'connected' : 'error');
        });
      }
    }
  }

  function init() {
    var sb = w.getSb && w.getSb();
    if (!sb) { setTimeout(init, 300); return; }
    w.getUser().then(function (user) {
      if (!user) return;
      sb.from('profiles').select('id,email,role').eq('id', user.id).maybeSingle().then(function (res) {
        var profile = res.data;
        if (profile && profile.role === 'admin') mount(profile);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
