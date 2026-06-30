/* Harvest H-Component Library (vanilla JS, no build step)
 * Exposes a global `window.H`. Two kinds of helpers:
 *   - String builders: H.button(), H.card(), H.badge()... return HTML strings
 *     for use in innerHTML. (Consistent with the existing shared/nav.js style.)
 *   - Imperative UI: H.toast(), H.modal(), H.drawer() inject into the DOM and
 *     return a controller you can close().
 * Spec: Harvest_Platform_Spec_v2.0.md Section 3.
 */
(function (w) {
  'use strict';

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function attrs(obj) {
    if (!obj) return '';
    var out = '';
    for (var k in obj) {
      if (!obj.hasOwnProperty(k) || obj[k] == null || obj[k] === false) continue;
      out += ' ' + k + '="' + esc(obj[k]) + '"';
    }
    return out;
  }
  function cls() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) parts.push(arguments[i]);
    return parts.join(' ');
  }

  var H = {};
  H.esc = esc;

  /* ---------- Button ---------- */
  H.button = function (o) {
    o = o || {};
    var variant = o.variant || 'primary';
    var tag = o.href ? 'a' : 'button';
    var c = cls('h-btn', 'h-btn--' + variant, o.block && 'h-btn--block',
      o.loading && 'is-loading', o.disabled && 'is-disabled', o.class);
    var a = attrs({
      'class': c, href: o.href, id: o.id, type: o.href ? null : (o.type || 'button'),
      onclick: o.onclick, 'aria-label': o.ariaLabel, disabled: o.disabled ? 'disabled' : null
    });
    var icon = o.icon ? '<span class="h-btn__icon">' + o.icon + '</span>' : '';
    return '<' + tag + a + '>' + icon + esc(o.label || '') + '</' + tag + '>';
  };

  /* ---------- Card ---------- */
  H.card = function (o) {
    o = o || {};
    var c = cls('h-card', o.overdue && 'h-card--overdue', o.pinned && 'h-card--pinned', o.class);
    return '<div' + attrs({ 'class': c, id: o.id }) + '>' + (o.body || '') + '</div>';
  };
  H.expandableCard = function (o) {
    o = o || {};
    var c = cls('h-card', o.overdue && 'h-card--overdue', o.pinned && 'h-card--pinned', o.class);
    return '<div' + attrs({ 'class': c, id: o.id, 'data-h-expandable': '1' }) + '>' +
      '<div class="h-row" style="justify-content:space-between;cursor:pointer" data-h-expand-trigger>' +
      '<div class="h-row">' +
      '<span class="h-card__chevron">&#9656;</span>' +
      '<span>' + (o.header || '') + '</span></div>' +
      (o.meta ? '<div class="h-row">' + o.meta + '</div>' : '') +
      '</div>' +
      '<div class="h-card__expand">' + (o.expand || '') + '</div>' +
      '</div>';
  };

  /* ---------- Badges ---------- */
  H.badge = function (label, kind) {
    return '<span class="' + cls('h-badge', 'h-badge--' + (kind || 'neutral')) + '">' + esc(label) + '</span>';
  };
  H.typeBadge = function (type) {
    var t = String(type || '').toLowerCase();
    var known = { task: 'task', goal: 'goal', habit: 'habit', bill: 'bill' };
    return '<span class="' + cls('h-type', 'h-type--' + (known[t] || 'default')) + '">' + esc(type) + '</span>';
  };

  /* ---------- Input ---------- */
  H.input = function (o) {
    o = o || {};
    var id = o.id || ('h-in-' + Math.random().toString(36).slice(2, 8));
    var label = o.label ? '<label class="h-label" for="' + id + '">' + esc(o.label) + '</label>' : '';
    var common = { id: id, name: o.name || id, 'class': cls(o.error && 'is-error'), placeholder: o.placeholder, value: o.value };
    var field;
    if (o.type === 'textarea') {
      field = '<textarea' + attrs({ id: id, name: o.name || id, 'class': cls('h-textarea', o.error && 'is-error'), placeholder: o.placeholder }) + '>' + esc(o.value || '') + '</textarea>';
    } else if (o.type === 'select') {
      var opts = (o.options || []).map(function (op) {
        var val = op.value != null ? op.value : op;
        var lbl = op.label != null ? op.label : op;
        var sel = (o.value != null && String(o.value) === String(val)) ? ' selected' : '';
        return '<option value="' + esc(val) + '"' + sel + '>' + esc(lbl) + '</option>';
      }).join('');
      field = '<select' + attrs({ id: id, name: o.name || id, 'class': cls('h-select', o.error && 'is-error') }) + '>' + opts + '</select>';
    } else {
      field = '<input' + attrs({ type: o.type || 'text', id: id, name: o.name || id,
        'class': cls('h-input', o.error && 'is-error'), placeholder: o.placeholder, value: o.value }) + '>';
    }
    return '<div class="h-field">' + label + field + '</div>';
  };

  /* ---------- KPI ---------- */
  H.kpiCard = function (o) {
    o = o || {};
    var trend = '';
    if (o.trend) {
      var dir = o.trend > 0 ? 'up' : 'down';
      var arrow = o.trend > 0 ? '&#9650;' : '&#9660;';
      trend = '<div class="h-kpi__trend h-kpi__trend--' + dir + '">' + arrow + ' ' + esc(Math.abs(o.trend)) + '%</div>';
    }
    return '<div class="h-kpi">' +
      '<div class="h-kpi__value">' + esc(o.value) + '</div>' +
      '<div class="h-kpi__label">' + esc(o.label) + '</div>' + trend + '</div>';
  };

  /* ---------- States ---------- */
  H.empty = function (o) {
    o = o || {};
    return '<div class="h-empty">' +
      '<div class="h-empty__icon">' + (o.icon || '&#128230;') + '</div>' +
      '<div class="h-empty__title">' + esc(o.title || 'Nothing here yet') + '</div>' +
      (o.description ? '<p class="h-muted">' + esc(o.description) + '</p>' : '') +
      (o.cta ? '<div style="margin-top:16px">' + H.button(o.cta) + '</div>' : '') + '</div>';
  };
  H.error = function (o) {
    o = o || {};
    return '<div class="h-error">' +
      '<div class="h-error__icon">&#9888;</div>' +
      '<div class="h-error__title">' + esc(o.title || 'Something went wrong') + '</div>' +
      (o.message ? '<p class="h-muted">' + esc(o.message) + '</p>' : '') +
      (o.onRetry ? '<div style="margin-top:16px">' + H.button({ label: 'Retry', variant: 'secondary', onclick: o.onRetry }) + '</div>' : '') + '</div>';
  };
  H.loading = function (o) {
    o = o || {};
    if (o.skeleton) {
      var n = o.count || 3, out = '';
      for (var i = 0; i < n; i++) out += '<div class="h-skeleton" style="height:56px;margin-bottom:12px"></div>';
      return out;
    }
    return '<div class="h-spinner" role="status" aria-label="Loading"></div>';
  };

  /* ---------- Grip / Mode toggle ---------- */
  H.gripHandle = function () { return '<span class="h-grip" aria-hidden="true">&#8942;&#8942;</span>'; };
  H.modeToggle = function (o) {
    o = o || {};
    var modes = o.modes || ['simple', 'guided', 'builder'];
    var cur = o.value || modes[0];
    var btns = modes.map(function (m) {
      return '<button type="button" class="' + cls('h-modetoggle__opt', m === cur && 'is-active') +
        '" data-mode="' + esc(m) + '"' + (o.onchange ? ' onclick="' + o.onchange + '(\'' + esc(m) + '\')"' : '') + '>' +
        esc(m.charAt(0).toUpperCase() + m.slice(1)) + '</button>';
    }).join('');
    return '<div class="h-modetoggle">' + btns + '</div>';
  };

  /* ---------- Imperative: Toast ---------- */
  function toastWrap() {
    var el = document.querySelector('.h-toast-wrap');
    if (!el) { el = document.createElement('div'); el.className = 'h-toast-wrap'; document.body.appendChild(el); }
    return el;
  }
  H.toast = function (msg, kind, ms) {
    var wrap = toastWrap();
    var t = document.createElement('div');
    t.className = cls('h-toast', 'h-toast--' + (kind || 'info'));
    t.textContent = msg;
    wrap.appendChild(t);
    var timeout = setTimeout(close, ms || 4000);
    function close() { clearTimeout(timeout); if (t.parentNode) t.parentNode.removeChild(t); }
    t.addEventListener('click', close);
    return { close: close };
  };

  /* ---------- Imperative: Modal ---------- */
  H.modal = function (o) {
    o = o || {};
    var backdrop = document.createElement('div');
    backdrop.className = 'h-modal-backdrop';
    var foot = '';
    if (o.actions && o.actions.length) {
      foot = '<div class="h-modal__foot">' + o.actions.map(function (a) { return H.button(a); }).join('') + '</div>';
    }
    backdrop.innerHTML =
      '<div class="h-modal" role="dialog" aria-modal="true">' +
      '<div class="h-modal__head"><div class="h-modal__title">' + esc(o.title || '') + '</div>' +
      '<button class="h-modal__close" aria-label="Close">&times;</button></div>' +
      '<div class="h-modal__body">' + (o.body || '') + '</div>' + foot + '</div>';
    document.body.appendChild(backdrop);
    function close() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop && o.dismissable !== false) close(); });
    backdrop.querySelector('.h-modal__close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    var ctl = { close: close, el: backdrop };
    if (o.onMount) o.onMount(ctl);
    return ctl;
  };

  /* ---------- Imperative: Drawer ---------- */
  H.drawer = function (o) {
    o = o || {};
    var side = o.side || (window.innerWidth < 640 ? 'bottom' : 'right');
    var backdrop = document.createElement('div');
    backdrop.className = 'h-drawer-backdrop';
    var drawer = document.createElement('div');
    drawer.className = cls('h-drawer', 'h-drawer--' + side);
    drawer.innerHTML =
      '<div class="h-drawer__head"><div class="h-modal__title">' + esc(o.title || '') + '</div>' +
      '<button class="h-modal__close" aria-label="Close">&times;</button></div>' +
      '<div class="h-drawer__body">' + (o.body || '') + '</div>';
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    function close() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (drawer.parentNode) drawer.parentNode.removeChild(drawer);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    backdrop.addEventListener('click', close);
    drawer.querySelector('.h-modal__close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    var ctl = { close: close, el: drawer };
    if (o.onMount) o.onMount(ctl);
    return ctl;
  };

  /* ---------- Header / FAB / Tabs / Bottom nav (string builders) ---------- */
  H.header = function (o) {
    o = o || {};
    return '<header class="h-header h-scope">' +
      '<a class="h-header__brand" href="' + esc(o.href || '/') + '">' +
      (o.icon || '&#127793;') + ' <span>' + esc(o.title || 'Harvest Your Passion') + '</span></a>' +
      '<div class="h-header__actions">' + (o.actions || '') + '</div></header>';
  };
  H.fab = function (o) {
    o = o || {};
    return '<button class="h-fab" aria-label="' + esc(o.ariaLabel || 'Add') + '"' +
      (o.onclick ? ' onclick="' + esc(o.onclick) + '"' : '') + (o.id ? ' id="' + esc(o.id) + '"' : '') + '>' +
      (o.icon || '+') + '</button>';
  };
  H.tabBar = function (o) {
    o = o || {};
    var tabs = (o.tabs || []).map(function (t) {
      return '<button class="' + cls('h-tab', t.active && 'is-active') + '"' +
        (t.onclick ? ' onclick="' + esc(t.onclick) + '"' : '') + (t.id ? ' data-tab="' + esc(t.id) + '"' : '') + '>' +
        esc(t.label) + '</button>';
    }).join('');
    return '<nav class="h-tabbar">' + tabs + '</nav>';
  };
  H.bottomNav = function (o) {
    o = o || {};
    var items = (o.items || []).map(function (it) {
      return '<a class="' + cls('h-bottomnav__item', it.active && 'is-active') + '" href="' + esc(it.href || '#') + '">' +
        '<span>' + (it.icon || '') + '</span><span>' + esc(it.label) + '</span></a>';
    }).join('');
    return '<nav class="h-bottomnav">' + items + '</nav>';
  };

  /* ---------- Expandable card wiring (delegated) ---------- */
  document.addEventListener('click', function (e) {
    var trig = e.target.closest && e.target.closest('[data-h-expand-trigger]');
    if (!trig) return;
    var card = trig.closest('[data-h-expandable]');
    if (!card) return;
    var open = card.classList.contains('is-expanded');
    // one at a time
    var all = document.querySelectorAll('[data-h-expandable].is-expanded');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('is-expanded');
    if (!open) card.classList.add('is-expanded');
  });

  w.H = H;
})(window);
