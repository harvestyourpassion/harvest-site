// ===== SUPABASE DATA LAYER FOR ROOTS (spec schema) =====
// Reads/writes the canonical spec tables: `items` + `tabs`, keyed by user_id.
// Single workspace per user (no profiles) — Leo's decision, June 30 2026.
// Tab/sub-tab/section STRUCTURE still comes from getDefaultData() in app.js
// (string keys like "personal"); only ITEMS are persisted to the cloud.
// Item.tab (string key) <-> tabs.id (uuid) is mapped by normalized tab name.
// Loads cleanly even if a tab the item references has no row yet.

var sb = null;
var currentUser = null;
var ownerId = null;
var currentProfileId = null; // legacy ref guarded in app.js rename; kept null
var _tabKeyToUuid = {};
var _tabUuidToKey = {};

function _norm(name){ return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

function _uuidv4(){
  if(window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c){
    var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Override app.js generateId so new items get a real UUID (items.id is uuid).
function generateId(){ return _uuidv4(); }

// ===== INIT =====
function initSupabase(){
  sb = window.getSb ? window.getSb() : null;
  if(!sb){ setTimeout(initSupabase, 200); return; }

  sb.auth.onAuthStateChange(function(event, session){
    if(event === "SIGNED_IN" && session){
      currentUser = session.user; ownerId = session.user.id; loadFromCloud();
    } else if(event === "SIGNED_OUT"){
      currentUser = null; ownerId = null;
      state = {items:[], mainTabs:[], subTabs:[], sections:[], kpiWidgets:[], settings:{}};
      showLoginRequired();
    }
  });

  sb.auth.getSession().then(function(result){
    var session = result.data.session;
    if(session){ currentUser = session.user; ownerId = session.user.id; loadFromCloud(); }
    else { showLoginRequired(); }
  });
}

function doSignOut(){ if(sb) sb.auth.signOut(); }

// ===== LOAD =====
function loadFromCloud(){
  // Structure (tabs/subtabs/sections/kpis) from the app's defaults.
  state = getDefaultData();

  sb.from("tabs").select("*").eq("user_id", ownerId).order("order_index").then(function(tr){
    var tabs = (tr && tr.data) || [];
    _tabKeyToUuid = {}; _tabUuidToKey = {};
    var i, key;
    for(i = 0; i < tabs.length; i++){
      key = _norm(tabs[i].name);
      _tabKeyToUuid[key] = tabs[i].id;
      _tabUuidToKey[tabs[i].id] = key;
    }
    // Surface any cloud tab that isn't one of the default workspaces.
    for(i = 0; i < tabs.length; i++){
      key = _norm(tabs[i].name);
      var found = false, m;
      for(m = 0; m < state.mainTabs.length; m++){ if(state.mainTabs[m].id === key){ found = true; break; } }
      if(!found){
        state.mainTabs.push({id:key, name:tabs[i].name, icon:tabs[i].icon || "", color:tabs[i].color || "#3b82f6"});
      }
    }
    return sb.from("items").select("*").eq("user_id", ownerId);
  }).then(function(ir){
    var rows = (ir && ir.data) || [];
    state.items = rows.map(_rowToItem);
    state.items.sort(function(a, b){
      var ao = (a._order == null) ? 99999 : a._order;
      var bo = (b._order == null) ? 99999 : b._order;
      return ao - bo;
    });
    _showApp();
    window.userDisplayName = (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name)
      || (currentUser && currentUser.email ? currentUser.email.split("@")[0] : "");
    render();
    updateNotifBadge();
  });
}

function _rowToItem(row){
  var f = {}, legacyTags = null, ord = null;
  var src = row.fields || {}, k;
  for(k in src){
    if(!src.hasOwnProperty(k)) continue;
    if(k === "_legacy_tags"){ legacyTags = src[k]; continue; }
    if(k === "_order"){ ord = src[k]; continue; }
    if(k === "tags"){ if(!legacyTags) legacyTags = src[k]; continue; }
    if(k.charAt(0) === "_") continue; // strip _migrated, _legacy_id, _legacy_section
    f[k] = src[k];
  }
  return {
    id: row.id,
    tab: _tabUuidToKey[row.tab_id] || "personal",
    section: null,
    title: row.title,
    type: row.type,
    status: row.status,
    fields: f,
    subItems: row.sub_items || [],
    comments: row.comments || [],
    tags: legacyTags || [],
    customFields: row.custom_fields || [],
    pinned: !!row.pinned,
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : "",
    _order: ord
  };
}

function _showApp(){
  document.getElementById("mainTabNav").classList.remove("hidden");
  document.getElementById("subTabNav").classList.remove("hidden");
  var fb = document.getElementById("filterBar");
  fb.style.display = ""; fb.classList.remove("hidden");
}

// ===== SAVE (debounced cloud sync of items) =====
function saveData(){
  if(!sb || !ownerId) return;
  clearTimeout(window._cloudSyncTimer);
  window._cloudSyncTimer = setTimeout(_syncNow, 1200);
}

function _syncNow(){
  if(!sb || !ownerId) return;
  _ensureTabsForKeys().then(function(){
    var rows = state.items.map(function(it, idx){ return _itemToRow(it, idx); });
    if(rows.length){
      sb.from("items").upsert(rows, {onConflict:"id"}).then(function(res){
        if(res.error) console.error("Item sync error:", res.error);
      });
    }
    // Delete any cloud items no longer present in app state.
    var ids = state.items.map(function(it){ return it.id; });
    var del = sb.from("items").delete().eq("user_id", ownerId);
    if(ids.length){ del = del.not("id", "in", "(" + ids.join(",") + ")"); }
    del.then(function(res){ if(res.error) console.error("Item delete sync error:", res.error); });
  });
}

function _itemToRow(it, idx){
  var f = {}, src = it.fields || {}, k;
  for(k in src){ if(src.hasOwnProperty(k) && k.charAt(0) !== "_") f[k] = src[k]; }
  if(it.tags && it.tags.length) f._legacy_tags = it.tags; // preserve cross-tab tags
  f._order = idx;
  return {
    id: it.id,
    user_id: ownerId,
    tab_id: _tabKeyToUuid[it.tab] || null,
    section_id: null,
    title: it.title,
    type: it.type,
    status: it.status,
    fields: f,
    sub_items: it.subItems || [],
    comments: it.comments || [],
    custom_fields: it.customFields || [],
    pinned: !!it.pinned,
    updated_at: new Date().toISOString()
  };
}

// Create tab rows for any item.tab key that has no cloud row yet.
function _ensureTabsForKeys(){
  var need = {}, i, key;
  for(i = 0; i < state.items.length; i++){
    key = state.items[i].tab;
    if(key && !_tabKeyToUuid[key]) need[key] = true;
  }
  var keys = [];
  for(key in need){ if(need.hasOwnProperty(key)) keys.push(key); }
  if(!keys.length) return Promise.resolve();

  var rows = keys.map(function(k, i){
    var def = null, m;
    for(m = 0; m < state.mainTabs.length; m++){ if(state.mainTabs[m].id === k){ def = state.mainTabs[m]; break; } }
    var id = _uuidv4();
    _tabKeyToUuid[k] = id; _tabUuidToKey[id] = k;
    return {
      id: id, user_id: ownerId,
      name: def ? def.name : k,
      icon: def ? def.icon : "",
      color: def ? def.color : "#3b82f6",
      order_index: 90 + i
    };
  });
  return sb.from("tabs").upsert(rows, {onConflict:"id"}).then(function(res){
    if(res.error) console.error("Tab ensure error:", res.error);
  });
}

// ===== LOGIN PROMPT =====
function showLoginRequired(){
  document.getElementById("mainTabNav").innerHTML = "";
  document.getElementById("subTabNav").innerHTML = "";
  document.getElementById("filterBar").style.display = "none";
  var html = '<div class="flex flex-col items-center justify-center min-h-[60vh]">';
  html += '<div class="surface rounded-xl p-8 border border-c w-full max-w-sm text-center">';
  html += '<i class="fas fa-seedling text-4xl text-blue-400 mb-4"></i>';
  html += '<h2 class="text-xl font-bold mt-2 mb-2">Roots</h2>';
  html += '<p class="text-slate-400 text-sm mb-4">Sign in to access your personal operating system</p>';
  html += '<button onclick="if(typeof requireAuth===\'function\')requireAuth(\'/roots/\');else window.location.href=\'/\';" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-medium text-sm">Sign In</button>';
  html += '</div></div>';
  document.getElementById("content").innerHTML = html;
}
