/* content/content.js — Content management admin (Phase 4).
 * Pipeline board (idea→…→workshop), editor, publish, evergreen reviews.
 * Reads/writes content_items + content_calendar via RLS (admin).
 */
(function (w) {
  'use strict';

  var STAGES = ['idea', 'thought', 'draft', 'article', 'framework', 'course', 'book', 'workshop'];
  var PLATFORMS = ['blog', 'linkedin', 'facebook', 'instagram', 'newsletter'];
  var sb, profile, view = 'pipeline';

  function init(p) {
    profile = p; sb = w.getSb();
    renderTabs();
    document.getElementById('c-new').innerHTML = H.button({ label: '+ New Idea', id: 'c-new-btn' });
    document.getElementById('c-new-btn').addEventListener('click', newIdea);
    show('pipeline');
  }

  function renderTabs() {
    var tabs = [
      { id: 'pipeline', label: 'Pipeline' },
      { id: 'published', label: 'Published' },
      { id: 'calendar', label: 'Calendar' },
      { id: 'evergreen', label: 'Evergreen Reviews' }
    ];
    document.getElementById('c-tabs').innerHTML = tabs.map(function (t) {
      return '<button class="h-tab' + (t.id === view ? ' is-active' : '') + '" data-cview="' + t.id + '">' + t.label + '</button>';
    }).join('');
    document.querySelectorAll('[data-cview]').forEach(function (el) {
      el.addEventListener('click', function () { show(el.getAttribute('data-cview')); });
    });
  }

  function show(v) {
    view = v; renderTabs();
    var m = document.getElementById('c-main');
    m.innerHTML = H.loading({ skeleton: true, count: 3 });
    if (v === 'pipeline') return renderPipeline(m);
    if (v === 'published') return renderPublished(m);
    if (v === 'calendar') return renderCalendar(m);
    if (v === 'evergreen') return renderEvergreen(m);
  }

  function load() {
    return sb.from('content_items').select('*').order('updated_at', { ascending: false }).then(function (r) { return r.data || []; });
  }

  // ---------- Pipeline board ----------
  function renderPipeline(m) {
    load().then(function (items) {
      var byStage = {};
      STAGES.forEach(function (s) { byStage[s] = []; });
      items.forEach(function (it) { (byStage[it.stage] || (byStage[it.stage] = [])).push(it); });
      var html = '<div class="c-board">';
      STAGES.forEach(function (s) {
        html += '<div class="c-col"><h3>' + s + ' (' + byStage[s].length + ')</h3>';
        byStage[s].forEach(function (it) {
          html += '<div class="c-pcard" data-id="' + it.id + '">' + H.esc(it.title) +
            (it.is_public ? ' <span style="color:var(--accent-green)">●</span>' : '') + '</div>';
        });
        html += '</div>';
      });
      html += '</div>';
      m.innerHTML = html;
      m.querySelectorAll('.c-pcard').forEach(function (el) {
        el.addEventListener('click', function () {
          var it = items.find(function (x) { return x.id === el.getAttribute('data-id'); });
          editModal(it);
        });
      });
    });
  }

  // ---------- Published ----------
  function renderPublished(m) {
    load().then(function (items) {
      var pub = items.filter(function (i) { return i.is_public; });
      var html = '';
      if (!pub.length) html = H.card({ body: H.empty({ icon: '📰', title: 'Nothing published', description: 'Toggle an item public to publish it to the blog & libraries.' }) });
      else {
        html += '<div style="display:flex;flex-direction:column;gap:8px">';
        pub.forEach(function (it) {
          html += '<div class="h-card h-row" style="justify-content:space-between;cursor:pointer" data-id="' + it.id + '">' +
            '<span>' + H.esc(it.title) + '</span>' + H.badge(it.stage, 'neutral') + '</div>';
        });
        html += '</div>';
      }
      m.innerHTML = html;
      m.querySelectorAll('[data-id]').forEach(function (el) {
        el.addEventListener('click', function () {
          var it = items.find(function (x) { return x.id === el.getAttribute('data-id'); });
          editModal(it);
        });
      });
    });
  }

  // ---------- Calendar ----------
  function renderCalendar(m) {
    sb.from('content_calendar').select('*, content_items(title)').order('scheduled_date').then(function (res) {
      var rows = res.data || [];
      var html = '';
      if (!rows.length) html = H.card({ body: H.empty({ icon: '🗓️', title: 'No scheduled content', description: 'Schedule items to platforms from the editor.' }) });
      else {
        html += '<div style="display:flex;flex-direction:column;gap:8px">';
        rows.forEach(function (r) {
          var title = (r.content_items && r.content_items.title) || '—';
          html += '<div class="h-card h-row" style="justify-content:space-between"><span>' + H.esc(title) + '</span><span class="h-row" style="gap:6px">' + H.badge(r.platform || '', 'neutral') + '<span class="h-muted">' + (r.scheduled_date || '') + '</span></span></div>';
        });
        html += '</div>';
      }
      m.innerHTML = html;
    });
  }

  // ---------- Evergreen ----------
  function renderEvergreen(m) {
    load().then(function (items) {
      var due = items.filter(function (i) { return i.review_date; })
        .sort(function (a, b) { return new Date(a.review_date) - new Date(b.review_date); });
      var html = '';
      if (!due.length) html = H.card({ body: H.empty({ icon: '🌲', title: 'No reviews scheduled', description: 'Set a review interval on an item to flag it for 6/12/24-month review.' }) });
      else {
        html += '<div style="display:flex;flex-direction:column;gap:8px">';
        var now = Date.now();
        due.forEach(function (it) {
          var overdue = new Date(it.review_date).getTime() < now;
          html += '<div class="h-card h-row" style="justify-content:space-between;cursor:pointer" data-id="' + it.id + '"><span>' + H.esc(it.title) + '</span>' +
            H.badge(it.review_date, overdue ? 'overdue' : 'paused') + '</div>';
        });
        html += '</div>';
      }
      m.innerHTML = html;
      m.querySelectorAll('[data-id]').forEach(function (el) {
        el.addEventListener('click', function () {
          var it = items.find(function (x) { return x.id === el.getAttribute('data-id'); });
          editModal(it);
        });
      });
    });
  }

  // ---------- Create / Edit ----------
  function newIdea() {
    H.modal({
      title: 'New Idea',
      body: H.input({ id: 'ci-title', label: 'Title', placeholder: 'The seed of an idea…' }),
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Add', variant: 'primary' }],
      onMount: function (ctl) {
        ctl.el.querySelector('.h-btn--ghost').addEventListener('click', ctl.close);
        ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
          var title = document.getElementById('ci-title').value.trim();
          if (!title) { H.toast('Title required', 'error'); return; }
          sb.from('content_items').insert({ user_id: profile.id, title: title, stage: 'idea' }).then(function (res) {
            if (res.error) H.toast('Failed: ' + res.error.message, 'error');
            else { H.toast('Idea captured', 'success'); ctl.close(); show('pipeline'); }
          });
        });
      }
    });
  }

  function editModal(it) {
    H.modal({
      title: 'Edit Content',
      body:
        H.input({ id: 'ce-title', label: 'Title', value: it.title }) +
        H.input({ id: 'ce-stage', label: 'Stage', type: 'select', options: STAGES, value: it.stage }) +
        H.input({ id: 'ce-body', label: 'Body', type: 'textarea', value: it.body || '' }) +
        H.input({ id: 'ce-review', label: 'Review interval', type: 'select', options: ['none', '6mo', '12mo', '24mo'], value: it.review_interval || 'none' }) +
        '<label class="h-row" style="gap:8px;margin:8px 0"><input type="checkbox" id="ce-public" ' + (it.is_public ? 'checked' : '') + '> Public (publish to blog & libraries)</label>' +
        '<div class="h-row" style="gap:6px;flex-wrap:wrap" id="ce-sched">' +
        '<span class="h-muted" style="width:100%">Schedule to platform:</span>' +
        PLATFORMS.map(function (p) { return '<button type="button" class="h-btn h-btn--secondary" data-platform="' + p + '" style="min-height:32px;padding:0 10px">' + p + '</button>'; }).join('') +
        '</div>',
      actions: [{ label: 'Delete', variant: 'destructive' }, { label: 'Save', variant: 'primary' }],
      onMount: function (ctl) {
        ctl.el.querySelector('.h-btn--destructive').addEventListener('click', function () {
          sb.from('content_items').delete().eq('id', it.id).then(function () { H.toast('Deleted', 'info'); ctl.close(); show(view); });
        });
        ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
          var upd = {
            title: document.getElementById('ce-title').value.trim(),
            stage: document.getElementById('ce-stage').value,
            body: document.getElementById('ce-body').value,
            review_interval: document.getElementById('ce-review').value,
            is_public: document.getElementById('ce-public').checked,
            updated_at: new Date().toISOString()
          };
          if (upd.review_interval !== 'none') {
            var months = parseInt(upd.review_interval, 10);
            var d = new Date(); d.setMonth(d.getMonth() + months);
            upd.review_date = d.toISOString().slice(0, 10);
          } else { upd.review_date = null; }
          sb.from('content_items').update(upd).eq('id', it.id).then(function (res) {
            if (res.error) H.toast('Failed: ' + res.error.message, 'error');
            else { H.toast('Saved', 'success'); ctl.close(); show(view); }
          });
        });
        ctl.el.querySelectorAll('[data-platform]').forEach(function (b) {
          b.addEventListener('click', function () {
            sb.from('content_calendar').insert({ content_id: it.id, platform: b.getAttribute('data-platform'), scheduled_date: new Date().toISOString().slice(0, 10), status: 'scheduled' }).then(function (res) {
              if (res.error) H.toast('Failed: ' + res.error.message, 'error');
              else H.toast('Scheduled to ' + b.getAttribute('data-platform'), 'success');
            });
          });
        });
      }
    });
  }

  w.Content = { init: init };
})(window);
