/* shared/guard.js - Client-side route protection.
 * Server-side RLS is the real enforcement; this is UX (redirect early, no flash
 * of admin UI). Depends on shared/supabase.js (window.getSb / getUser).
 *
 * Usage on a protected page, before rendering app content:
 *   <script src="/shared/guard.js"></script>
 *   <script>HGuard.require('admin').then(function(profile){ startApp(profile); });</script>
 *
 * Levels: 'auth' (any logged-in), 'coach' (coach or admin), 'admin' (admin only).
 */
(function (w) {
  'use strict';

  function loginRedirect() {
    var here = w.location.pathname + w.location.search;
    if (w.signIn) { w.signIn(w.location.origin + here); }
    else { w.location.href = '/?login=1&next=' + encodeURIComponent(here); }
  }

  function loadProfile() {
    var sb = w.getSb && w.getSb();
    if (!sb) return Promise.resolve(null);
    return w.getUser().then(function (user) {
      if (!user) return null;
      return sb.from('profiles').select('id,role,name,email,avatar_url,mode')
        .eq('id', user.id).maybeSingle()
        .then(function (res) {
          if (res.data) return res.data;
          // Profile row missing (edge: trigger lag) — minimal fallback.
          return { id: user.id, role: 'user', email: user.email, mode: 'simple' };
        });
    });
  }

  function allowed(role, level) {
    if (level === 'auth') return true;
    if (level === 'coach') return role === 'coach' || role === 'admin';
    if (level === 'admin') return role === 'admin';
    return true;
  }

  var HGuard = {
    loadProfile: loadProfile,
    /* Resolves with the profile if allowed; otherwise redirects and never resolves. */
    require: function (level) {
      return loadProfile().then(function (profile) {
        if (!profile) { loginRedirect(); return new Promise(function () {}); }
        if (!allowed(profile.role, level)) {
          if (w.H && w.H.toast) w.H.toast('You don’t have access to that area.', 'error');
          w.location.href = '/roots/';
          return new Promise(function () {});
        }
        w.harvestProfile = profile;
        return profile;
      });
    }
  };

  w.HGuard = HGuard;
})(window);
