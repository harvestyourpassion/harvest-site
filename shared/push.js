/* shared/push.js — PWA web push subscription helper.
 * window.enablePush() requests permission, subscribes via the service worker,
 * and stores the subscription in push_subscriptions. Safe no-op where push is
 * unsupported. Depends on shared/supabase.js.
 */
(function (w) {
  'use strict';
  // Public VAPID key (safe to embed). Private key lives in the send-push secret.
  var VAPID_PUBLIC = 'BG_fgaE6G6F72kdqwryZ807rvxfhK04zOu1MH1c-Kf_jmi_vIQYz1UwB9rEHI-Y_JqdZzzxX7uFvgp0AF37AY18';

  function urlB64ToUint8(base64) {
    var padding = '='.repeat((4 - base64.length % 4) % 4);
    var b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = w.atob(b64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  w.pushSupported = function () {
    return ('serviceWorker' in w.navigator) && ('PushManager' in w) && ('Notification' in w);
  };

  w.enablePush = function () {
    if (!w.pushSupported()) { if (w.H) H.toast('Push not supported on this device/browser', 'error'); return Promise.resolve(false); }
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { if (w.H) H.toast('Notifications not enabled', 'info'); return false; }
      return w.navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription().then(function (existing) {
          return existing || reg.pushManager.subscribe({
            userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC)
          });
        });
      }).then(function (sub) {
        var sb = w.getSb && w.getSb();
        var json = sub.toJSON();
        return w.getUser().then(function (user) {
          if (!user || !sb) return false;
          return sb.from('push_subscriptions').upsert({
            user_id: user.id, endpoint: sub.endpoint,
            p256dh: json.keys.p256dh, auth: json.keys.auth
          }, { onConflict: 'endpoint' }).then(function (r) {
            if (r.error) { if (w.H) H.toast('Could not save subscription', 'error'); return false; }
            if (w.H) H.toast('Notifications enabled 🔔', 'success');
            return true;
          });
        });
      });
    }).catch(function (e) {
      if (w.H) H.toast('Push error: ' + (e && e.message), 'error');
      return false;
    });
  };
})(window);
