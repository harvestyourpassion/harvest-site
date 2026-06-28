// ===== SUPABASE DATA LAYER FOR ROOTS =====
// Uses shared window.sb client from /shared/supabase.js
// Auth handled by shared global nav — no local auth screen needed

var sb = null;
var currentUser = null;
var currentProfileId = null;
var isOnline = true;

// ===== INIT =====
function initSupabase(){
  sb = window.getSb ? window.getSb() : null;
  if(!sb){
    // Retry after a moment (CDN might still be loading)
    setTimeout(function(){
      sb = window.getSb ? window.getSb() : null;
      if(sb){
        sb.auth.getSession().then(function(result){
          var session = result.data.session;
          if(session){
            currentUser = session.user;
            loadUserProfile();
          } else {
            showLoginRequired();
          }
        });
      } else {
        showLoginRequired();
      }
    }, 200);
    return;
  }
  // Listen for auth state changes from the shared nav
  sb.auth.onAuthStateChange(function(event, session){
    if(event === 'SIGNED_IN' && session){
      currentUser = session.user;
      loadUserProfile();
    } else if(event === 'SIGNED_OUT'){
      currentUser = null;
      currentProfileId = null;
      state = {items:[],mainTabs:[],subTabs:[],sections:[],kpiWidgets:[],settings:{}};
      render();
    }
  });
  // Check existing session
  sb.auth.getSession().then(function(result){
    var session = result.data.session;
    if(session){
      currentUser = session.user;
      loadUserProfile();
    } else {
      // Not logged in — show login screen, let user choose to sign in
      showLoginRequired();
    }
  });
}

function doSignOut(){
  if(sb) sb.auth.signOut();
}

// ===== PROFILE LOADING =====
function loadUserProfile(){
  sb.from('roots_profiles').select('*').eq('user_id', currentUser.id).then(function(result){
    if(result.error){console.error(result.error);return;}
    if(result.data.length === 0){
      // First time user — create default profile
      createDefaultCloudProfile();
    } else {
      // Load the default profile (or first one)
      var defaultProfile = result.data.find(function(p){return p.is_default;}) || result.data[0];
      currentProfileId = defaultProfile.id;
      currentProfile = defaultProfile.name;
      sectionOrder = defaultProfile.section_order || ["tabs","kpis"];
      loadFullProfile(currentProfileId);
    }
  });
}

function createDefaultCloudProfile(){
  var profileData = {
    user_id: currentUser.id,
    name: "My Life",
    is_default: true,
    section_order: ["tabs","kpis"],
    settings: {}
  };
  sb.from('roots_profiles').insert(profileData).select().then(function(result){
    if(result.error){console.error(result.error);return;}
    currentProfileId = result.data[0].id;
    currentProfile = "My Life";
    // Initialize with empty state
    state = {items:[], mainTabs:[], subTabs:[], sections:[], kpiWidgets:[], settings:{}};
    document.getElementById("filterBar").style.display = "";
    render();
    updateNotifBadge();
    document.getElementById("profileName").textContent = currentProfile;
  });
}

function loadFullProfile(profileId){
  // Load all data for this profile in parallel
  Promise.all([
    sb.from('roots_main_tabs').select('*').eq('profile_id', profileId).order('position'),
    sb.from('roots_sub_tabs').select('*').eq('profile_id', profileId).order('position'),
    sb.from('roots_sections').select('*').eq('profile_id', profileId).order('position'),
    sb.from('roots_items').select('*').eq('profile_id', profileId).order('position'),
    sb.from('roots_kpi_widgets').select('*').eq('profile_id', profileId).order('position')
  ]).then(function(results){
    var tabs = results[0].data || [];
    var subTabs = results[1].data || [];
    var sections = results[2].data || [];
    var items = results[3].data || [];
    var kpis = results[4].data || [];

    // Map to app state format
    state.mainTabs = tabs.map(function(t){return {id:t.id, name:t.name, icon:t.icon, color:t.color};});
    state.subTabs = subTabs.map(function(s){return {id:s.id, tabId:s.tab_id, name:s.name, mode:s.mode, filter:s.filter||{}};});
    state.sections = sections.map(function(s){return {id:s.id, subTabId:s.sub_tab_id, name:s.name, aggField:s.agg_field, aggOp:s.agg_op, order:s.position};});
    state.items = items.map(function(it){return {id:it.id, tab:it.tab, section:it.section, title:it.title, type:it.type, status:it.status, fields:it.fields||{}, subItems:it.sub_items||[], comments:it.comments||[], tags:it.tags||[], customFields:it.custom_fields||[], pinned:it.pinned, createdAt:it.created_at?it.created_at.slice(0,10):""};});
    state.kpiWidgets = kpis.map(function(k){return {id:k.id, label:k.label, type:k.type, filter:k.filter||{}};});
    state.settings = {};

    document.getElementById("filterBar").style.display = "";
    render();
    updateNotifBadge();
    document.getElementById("profileName").textContent = currentProfile;
  });
}

// ===== SAVE OPERATIONS =====
// These replace the old saveData() function

function cloudSaveItem(item){
  if(!currentProfileId || !sb) return;
  var row = {
    id: item.id, profile_id: currentProfileId, tab: item.tab,
    section: item.section || null, title: item.title, type: item.type,
    status: item.status, fields: item.fields || {},
    sub_items: item.subItems || [], comments: item.comments || [],
    tags: item.tags || [], custom_fields: item.customFields || [],
    pinned: item.pinned || false,
    position: state.items.indexOf(item),
    updated_at: new Date().toISOString()
  };
  sb.from('roots_items').upsert(row, {onConflict: 'id,profile_id'}).then(function(result){
    if(result.error) console.error("Save item error:", result.error);
  });
}

function cloudDeleteItem(itemId){
  if(!currentProfileId || !sb) return;
  sb.from('roots_items').delete().eq('id', itemId).eq('profile_id', currentProfileId).then(function(result){
    if(result.error) console.error("Delete item error:", result.error);
  });
}

function cloudSaveTabs(){
  if(!currentProfileId || !sb) return;
  // Delete all and re-insert (simplest for reorder)
  sb.from('roots_main_tabs').delete().eq('profile_id', currentProfileId).then(function(){
    var rows = state.mainTabs.map(function(t, i){
      return {id:t.id, profile_id:currentProfileId, name:t.name, icon:t.icon, color:t.color, position:i};
    });
    if(rows.length > 0) sb.from('roots_main_tabs').insert(rows);
  });
}

function cloudSaveSubTabs(){
  if(!currentProfileId || !sb) return;
  sb.from('roots_sub_tabs').delete().eq('profile_id', currentProfileId).then(function(){
    var rows = state.subTabs.map(function(s, i){
      return {id:s.id, profile_id:currentProfileId, tab_id:s.tabId, name:s.name, mode:s.mode, filter:s.filter||{}, position:i};
    });
    if(rows.length > 0) sb.from('roots_sub_tabs').insert(rows);
  });
}

function cloudSaveSections(){
  if(!currentProfileId || !sb) return;
  sb.from('roots_sections').delete().eq('profile_id', currentProfileId).then(function(){
    var rows = state.sections.map(function(s, i){
      return {id:s.id, profile_id:currentProfileId, sub_tab_id:s.subTabId, name:s.name, agg_field:s.aggField||"", agg_op:s.aggOp||"", position:s.order||i};
    });
    if(rows.length > 0) sb.from('roots_sections').insert(rows);
  });
}

function cloudSaveKPIs(){
  if(!currentProfileId || !sb) return;
  sb.from('roots_kpi_widgets').delete().eq('profile_id', currentProfileId).then(function(){
    var rows = state.kpiWidgets.map(function(k, i){
      return {id:k.id, profile_id:currentProfileId, label:k.label, type:k.type, filter:k.filter||{}, position:i};
    });
    if(rows.length > 0) sb.from('roots_kpi_widgets').insert(rows);
  });
}

function cloudSaveProfile(){
  if(!currentProfileId || !sb) return;
  sb.from('roots_profiles').update({
    section_order: sectionOrder,
    updated_at: new Date().toISOString()
  }).eq('id', currentProfileId);
}

// ===== (localStorage cache removed — cloud only) =====

function fallbackToLocal(){
  // No more localStorage fallback — always require cloud auth
  showLoginRequired();
}

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

// ===== ENHANCED saveData =====
// Override saveData to save to cloud only (no localStorage)
function saveData(){
  if(!sb || !currentProfileId) return;
  // Debounced cloud sync
  clearTimeout(window._cloudSyncTimer);
  window._cloudSyncTimer = setTimeout(function(){
    cloudSaveTabs();
    cloudSaveSubTabs();
    cloudSaveSections();
    cloudSaveKPIs();
    cloudSaveProfile();
    for(var i=0;i<state.items.length;i++){
      cloudSaveItem(state.items[i]);
    }
  }, 1500);
}
