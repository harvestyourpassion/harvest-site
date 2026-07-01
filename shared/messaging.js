/* shared/messaging.js — async coach↔client messaging (Addendum A).
 * Role-aware: figures out whether the current user is the coach or the client
 * for each conversation. Mount into any container:
 *    Messaging.mount(document.getElementById('el'))
 * Depends on shared/supabase.js (window.getSb/getUser) and window.H.
 */
(function (w) {
  'use strict';

  var sb, me, myCoachIds = [], myClientIds = [], clientRowById = {}, activeConv = null, elRoot;

  function esc(s) { return w.H ? H.esc(s) : String(s == null ? '' : s); }
  function fmt(d) { return d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; }

  function mount(el) {
    elRoot = el; sb = w.getSb();
    el.innerHTML = H.loading({ skeleton: true, count: 3 });
    w.getUser().then(function (user) {
      if (!user) { el.innerHTML = signInPrompt(); wireSignIn(); return; }
      me = user;
      Promise.all([
        sb.from('coaches').select('id').eq('user_id', me.id),
        sb.from('clients').select('id,name,email,coach_id,package_id').eq('user_id', me.id)
      ]).then(function (res) {
        myCoachIds = (res[0].data || []).map(function (c) { return c.id; });
        var clients = res[1].data || [];
        myClientIds = clients.map(function (c) { return c.id; });
        clients.forEach(function (c) { clientRowById[c.id] = c; });
        renderList();
      });
    });
  }

  function signInPrompt() {
    return '<div class="h-empty"><div class="h-empty__icon">🔒</div>' +
      '<div class="h-empty__title">Sign in to view messages</div>' +
      '<div style="margin-top:16px">' + H.button({ label: 'Sign in', id: 'msg-signin' }) + '</div></div>';
  }
  function wireSignIn() {
    var b = document.getElementById('msg-signin');
    if (b) b.addEventListener('click', function () { w.signIn(w.location.href); });
  }

  function roleFor(conv) { return myCoachIds.indexOf(conv.coach_id) !== -1 ? 'coach' : 'client'; }

  function renderList() {
    activeConv = null;
    sb.from('conversations')
      .select('*, clients(name,email), coaches(name)')
      .order('updated_at', { ascending: false })
      .then(function (res) {
        var convs = res.data || [];
        var html = '<div class="h-row" style="justify-content:space-between;margin-bottom:12px">' +
          '<h2 style="margin:0;font-size:var(--text-xl)">Messages</h2>' +
          H.button({ label: '+ New', id: 'msg-new', variant: 'secondary' }) + '</div>';
        if (!convs.length) {
          html += H.card({ body: H.empty({ icon: '💬', title: 'No conversations yet', description: 'Start one to message between sessions.' }) });
        } else {
          html += '<div style="display:flex;flex-direction:column;gap:8px">';
          convs.forEach(function (c) {
            var other = roleFor(c) === 'coach'
              ? (c.clients && (c.clients.name || c.clients.email)) || 'Client'
              : (c.coaches && c.coaches.name) || 'Coach';
            html += '<div class="h-card" data-conv="' + esc(c.id) + '" style="cursor:pointer">' +
              '<div class="h-row" style="justify-content:space-between">' +
              '<strong>' + esc(other) + '</strong>' +
              '<span class="h-muted" style="font-size:12px">' + fmt(c.updated_at) + '</span></div>' +
              (c.subject ? '<div class="h-muted" style="font-size:13px">' + esc(c.subject) + '</div>' : '') + '</div>';
          });
          html += '</div>';
        }
        elRoot.innerHTML = html;
        document.getElementById('msg-new').addEventListener('click', newConversation);
        elRoot.querySelectorAll('[data-conv]').forEach(function (d) {
          d.addEventListener('click', function () { openThread(d.getAttribute('data-conv')); });
        });
      });
  }

  function openThread(convId) {
    Promise.all([
      sb.from('conversations').select('*, clients(name,email,package_id), coaches(name)').eq('id', convId).maybeSingle(),
      sb.from('messages').select('*').eq('conversation_id', convId).order('created_at')
    ]).then(function (res) {
      var conv = res[0].data; activeConv = conv;
      var msgs = res[1].data || [];
      var role = roleFor(conv);
      var other = role === 'coach'
        ? (conv.clients && (conv.clients.name || conv.clients.email)) || 'Client'
        : (conv.coaches && conv.coaches.name) || 'Coach';

      var html = '<a class="h-muted" style="cursor:pointer;font-size:13px" id="msg-back">&larr; Messages</a>' +
        '<h2 style="margin:8px 0;font-size:var(--text-xl)">' + esc(other) + '</h2>';
      html += '<div id="msg-thread" style="display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow:auto;padding:4px 0">';
      msgs.forEach(function (m) {
        var mine = m.sender_id === me.id;
        html += '<div style="align-self:' + (mine ? 'flex-end' : 'flex-start') + ';max-width:80%;background:' +
          (mine ? 'var(--accent-blue)' : 'var(--elevated)') + ';color:' + (mine ? '#fff' : 'var(--text-primary)') +
          ';padding:8px 12px;border-radius:12px">' +
          '<div style="font-size:14px;white-space:pre-wrap">' + esc(m.body) + '</div>' +
          '<div style="font-size:11px;opacity:.7;margin-top:2px">' + fmt(m.created_at) + '</div></div>';
      });
      html += '</div>';

      // Message-limit hint for clients.
      var limitNote = '';
      if (role === 'client' && conv.clients) {
        limitNote = '<div id="msg-limit" class="h-muted" style="font-size:12px;margin:6px 0"></div>';
      }
      html += limitNote +
        '<div class="h-row" style="gap:8px;margin-top:8px">' +
        '<input id="msg-input" class="h-input" placeholder="Write a message…" style="flex:1">' +
        H.button({ label: 'Send', id: 'msg-send' }) + '</div>';
      elRoot.innerHTML = html;

      document.getElementById('msg-back').addEventListener('click', renderList);
      document.getElementById('msg-send').addEventListener('click', function () { send(conv, role); });
      document.getElementById('msg-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(conv, role); });
      var th = document.getElementById('msg-thread'); th.scrollTop = th.scrollHeight;

      markRead(convId, msgs);
      if (role === 'client') showLimit(conv, msgs);
    });
  }

  function showLimit(conv, msgs) {
    var el = document.getElementById('msg-limit');
    if (!el) return;
    var pkgId = conv.clients && conv.clients.package_id;
    if (!pkgId) return;
    sb.from('packages').select('message_limit,name').eq('id', pkgId).maybeSingle().then(function (r) {
      var lim = r.data && r.data.message_limit;
      if (lim == null) { el.textContent = 'Unlimited messages on ' + (r.data ? r.data.name : 'your plan') + '.'; return; }
      var used = msgs.filter(function (m) { return m.sender_id === me.id; }).length;
      el.textContent = used + ' of ' + lim + ' messages used.' + (used >= lim ? ' Over your plan limit — your coach may still reply.' : '');
      el._lim = lim; el._used = used;
    });
  }

  function markRead(convId, msgs) {
    var unread = msgs.filter(function (m) { return m.sender_id !== me.id && !m.read_at; }).map(function (m) { return m.id; });
    if (!unread.length) return;
    sb.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread).then(function () {});
  }

  function send(conv, role) {
    var input = document.getElementById('msg-input');
    var body = input.value.trim();
    if (!body) return;
    // Soft message-limit warning for clients (never hard-blocks).
    var limEl = document.getElementById('msg-limit');
    if (role === 'client' && limEl && limEl._lim != null && limEl._used >= limEl._lim) {
      H.toast('You’re over your plan’s message limit — sending anyway.', 'info');
    }
    input.disabled = true;
    sb.from('messages').insert({ conversation_id: conv.id, sender_id: me.id, body: body }).then(function (res) {
      input.disabled = false;
      if (res.error) { H.toast('Send failed: ' + res.error.message, 'error'); return; }
      sb.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conv.id).then(function () {});
      // Notify the other party.
      notifyOther(conv, role, body);
      openThread(conv.id);
    });
  }

  function notifyOther(conv, myRole, body) {
    // Recipient profile: if I'm the coach, notify the client's user; else the coach's user.
    var lookup = myRole === 'coach'
      ? sb.from('clients').select('user_id').eq('id', conv.client_id).maybeSingle()
      : sb.from('coaches').select('user_id').eq('id', conv.coach_id).maybeSingle();
    lookup.then(function (r) {
      var uid = r.data && r.data.user_id;
      if (!uid) return;
      sb.from('notifications').insert({
        user_id: uid, type: 'new_message', title: 'New message',
        body: body.slice(0, 120), channel: 'in_app', reference_id: conv.id
      }).then(function () {});
    });
  }

  function newConversation() {
    if (myCoachIds.length) {
      // Coach starts a thread with one of their clients.
      sb.from('clients').select('id,name,email').eq('coach_id', myCoachIds[0]).then(function (r) {
        var clients = r.data || [];
        if (!clients.length) { H.toast('Add a client first', 'info'); return; }
        var opts = clients.map(function (c) { return { value: c.id, label: c.name || c.email }; });
        H.modal({
          title: 'New Conversation',
          body: H.input({ id: 'nc-client', label: 'Client', type: 'select', options: opts }) +
            H.input({ id: 'nc-subject', label: 'Subject (optional)' }),
          actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Start', variant: 'primary' }],
          onMount: function (ctl) {
            ctl.el.querySelector('.h-btn--ghost').addEventListener('click', ctl.close);
            ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
              startConv(document.getElementById('nc-client').value, myCoachIds[0], document.getElementById('nc-subject').value, ctl);
            });
          }
        });
      });
    } else if (myClientIds.length) {
      // Client starts a thread with their coach.
      var c = clientRowById[myClientIds[0]];
      H.modal({
        title: 'Message your coach',
        body: H.input({ id: 'nc-subject', label: 'Subject (optional)' }),
        actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Start', variant: 'primary' }],
        onMount: function (ctl) {
          ctl.el.querySelector('.h-btn--ghost').addEventListener('click', ctl.close);
          ctl.el.querySelector('.h-btn--primary').addEventListener('click', function () {
            startConv(c.id, c.coach_id, document.getElementById('nc-subject').value, ctl);
          });
        }
      });
    } else {
      H.toast('No coaching relationship found for this account.', 'info');
    }
  }

  function startConv(clientId, coachId, subject, ctl) {
    sb.from('conversations').insert({ client_id: clientId, coach_id: coachId, subject: subject || null, status: 'open' })
      .select('id').maybeSingle().then(function (r) {
        if (r.error) { H.toast('Failed: ' + r.error.message, 'error'); return; }
        ctl.close(); openThread(r.data.id);
      });
  }

  w.Messaging = { mount: mount };
})(window);
