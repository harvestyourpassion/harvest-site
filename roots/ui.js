// ===== RENDERING =====
function render(){
  renderMainTabs();
  renderSubTabs();
  renderContent();
}

function renderMainTabs(){
  var nav = document.getElementById("mainTabNav");
  var html = '<button onclick="switchMainTab(\'all\')" class="px-4 py-2 text-sm font-medium whitespace-nowrap ' + (activeMainTab==="all"?"tab-active":"text-slate-400 hover:text-white") + '" style="min-height:44px"><i class="fas fa-th-large mr-1"></i>All</button>';
  for(var i=0;i<state.mainTabs.length;i++){
    var t = state.mainTabs[i];
    html += '<button draggable="true" data-tabcard="' + t.id + '" onclick="switchMainTab(\'' + t.id + '\')" oncontextmenu="tabContextMenu(event,\'' + t.id + '\')" class="px-4 py-2 text-sm font-medium whitespace-nowrap flex items-center gap-1 ' + (activeMainTab===t.id?"tab-active":"text-slate-400 hover:text-white") + '" style="min-height:44px;border-bottom-color:' + t.color + '"><span>' + t.icon + '</span><span>' + t.name + '</span></button>';
  }
  html += '<button onclick="showAddTab()" class="px-3 py-2 text-slate-400 hover:text-blue-400" style="min-height:44px"><i class="fas fa-plus"></i></button>';
  nav.innerHTML = html;
}

function renderSubTabs(){
  var nav = document.getElementById("subTabNav");
  if(activeMainTab === "all"){nav.innerHTML = "";nav.style.display="none";return;}
  nav.style.display = "flex";
  var subs = state.subTabs.filter(function(s){return s.tabId === activeMainTab;});
  var html = "";
  for(var i=0;i<subs.length;i++){
    var s = subs[i];
    html += '<button onclick="switchSubTab(\'' + s.id + '\')" oncontextmenu="subTabContextMenu(event,\'' + s.id + '\')" class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ' + (activeSubTab===s.id?"subtab-active":"text-slate-400 hover:text-white hover:bg-slate-600") + '" style="min-height:36px">' + s.name + '</button>';
  }
  html += '<button onclick="showAddSubTab()" class="px-2 py-1 text-slate-400 hover:text-blue-400 text-xs"><i class="fas fa-plus"></i></button>';
  nav.innerHTML = html;
  if(!activeSubTab && subs.length > 0) activeSubTab = subs[0].id;
}

function renderContent(){
  var content = document.getElementById("content");
  if(activeMainTab === "all"){
    renderAllTab(content);
    document.getElementById("filterBar").style.display = "none";
    return;
  }
  document.getElementById("filterBar").style.display = "flex";
  var sub = state.subTabs.find(function(s){return s.id === activeSubTab;});
  if(!sub){content.innerHTML = '<p class="text-slate-400 text-center mt-10">Select a sub-tab</p>';return;}
  var items = getFilteredItems(sub);
  items = applyUserFilters(items);
  items = applySorting(items);

  if(groupField){
    content.innerHTML = renderGroupedItems(items);
  } else if(sub.mode === "manual"){
    content.innerHTML = renderManualSections(sub, items);
  } else {
    content.innerHTML = renderItemList(items);
  }
}

function getFilteredItems(sub){
  var tabItems = state.items.filter(function(it){
    return it.tab === activeMainTab || (it.tags && it.tags.indexOf(activeMainTab) > -1);
  });
  if(!sub.filter || sub.filter.field === "all") return tabItems;
  return tabItems.filter(function(it){
    if(sub.filter.field === "type"){
      if(sub.filter.values) return sub.filter.values.indexOf(it.type) > -1;
      return it.type === sub.filter.value;
    }
    if(sub.filter.field === "status"){
      if(sub.filter.values) return sub.filter.values.indexOf(it.status) > -1;
      return it.status === sub.filter.value;
    }
    if(sub.filter.field === "priority"){
      if(sub.filter.values) return sub.filter.values.indexOf(it.fields&&it.fields.priority) > -1;
      return it.fields && it.fields.priority === sub.filter.value;
    }
    return true;
  });
}

function applyUserFilters(items){
  var fs = document.getElementById("filterStatus").value;
  var fp = document.getElementById("filterPriority").value;
  var ft = document.getElementById("filterType").value;
  if(fs) items = items.filter(function(it){return it.status === fs;});
  if(fp) items = items.filter(function(it){return it.fields && it.fields.priority === fp;});
  if(ft) items = items.filter(function(it){return it.type === ft;});
  return items;
}

function applySorting(items){
  var s = document.getElementById("sortBy").value;
  if(!s) return items;
  var pOrd = {High:0,Medium:1,Low:2};
  var sOrd = {"In Progress":0,"Active":1,"To Do":2,"Future":3,"Paused":4,"Done":5};
  items = items.slice();
  if(s==="priority") items.sort(function(a,b){return (pOrd[a.fields&&a.fields.priority]||2) - (pOrd[b.fields&&b.fields.priority]||2);});
  if(s==="status") items.sort(function(a,b){return (sOrd[a.status]||3) - (sOrd[b.status]||3);});
  if(s==="alpha") items.sort(function(a,b){return a.title.localeCompare(b.title);});
  if(s==="recent") items.sort(function(a,b){return b.createdAt > a.createdAt ? 1 : -1;});
  if(s==="dueDate") items.sort(function(a,b){var da=a.fields&&a.fields.dueDate||"9999";var db=b.fields&&b.fields.dueDate||"9999";return da>db?1:-1;});
  // Pinned always first
  items.sort(function(a,b){return (b.pinned?1:0)-(a.pinned?1:0);});
  return items;
}

function applyFilters(){
  groupField = document.getElementById("groupBy").value;
  renderContent();
}
function clearFilters(){
  document.getElementById("filterStatus").value="";
  document.getElementById("filterPriority").value="";
  document.getElementById("filterType").value="";
  document.getElementById("sortBy").value="";
  document.getElementById("groupBy").value="";
  groupField="";
  renderContent();
}

// ===== ALL TAB (Dashboard) =====
function renderAllTab(content){
  var html = '<div class="space-y-6">';
  for(var si=0;si<sectionOrder.length;si++){
    if(sectionOrder[si]==="tabs") html += '<div draggable="true" data-dashsection="tabs" class="relative">' + renderWorkspacesSection() + '<span class="absolute top-0 left-0 drag-handle text-slate-500 text-xs p-1 cursor-grab"><i class="fas fa-grip-vertical"></i></span></div>';
    if(sectionOrder[si]==="kpis") html += '<div draggable="true" data-dashsection="kpis" class="relative">' + renderKPISection() + '<span class="absolute top-0 left-0 drag-handle text-slate-500 text-xs p-1 cursor-grab"><i class="fas fa-grip-vertical"></i></span></div>';
  }
  // KPI filtered items (if a KPI is active)
  html += renderKPIFilteredItems();
  // Recent items
  // Tab filter pills
  if(activeTabFilters.length > 0 || activeKpiFilter){
    html += '<div class="flex flex-wrap items-center gap-2 mt-2">';
    html += '<span class="text-xs text-slate-400">Filtering:</span>';
    for(var tf=0;tf<activeTabFilters.length;tf++){
      var ftab = state.mainTabs.find(function(t){return t.id===activeTabFilters[tf];});
      if(ftab) html += '<span class="text-xs px-2 py-1 rounded bg-blue-700 text-white cursor-pointer" onclick="toggleTabFilter(\'' + ftab.id + '\')">' + ftab.icon + ' ' + ftab.name + ' <i class="fas fa-times ml-1"></i></span>';
    }
    html += '<button onclick="clearTabFilters()" class="text-xs text-slate-400 hover:text-white px-2 py-1"><i class="fas fa-times-circle mr-1"></i>Clear All</button>';
    html += '</div>';
  }
  if(!activeKpiFilter){
    var allItems = state.items.filter(function(it){return it.status!=="Done";});
    if(activeTabFilters.length > 0){
      allItems = allItems.filter(function(it){return activeTabFilters.indexOf(it.tab)>-1 || (it.tags && it.tags.some(function(tg){return activeTabFilters.indexOf(tg)>-1;}));});
    }
    var label = activeTabFilters.length > 0 ? "Filtered Items (" + allItems.length + ")" : "Recent Active Items";
    html += '<div class="mt-4"><h3 class="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">' + label + '</h3>';
    html += renderItemList(activeTabFilters.length > 0 ? allItems : allItems.slice(0,10));
  }
  html += '</div></div>';
  content.innerHTML = html;
}

function renderWorkspacesSection(){
  var html = '<div><h3 class="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider"><i class="fas fa-layer-group mr-1"></i>Workspaces</h3><div class="grid grid-cols-2 md:grid-cols-4 gap-3">';
  for(var i=0;i<state.mainTabs.length;i++){
    var t = state.mainTabs[i];
    var count = state.items.filter(function(it){return it.tab===t.id && it.status!=="Done";}).length;
    html += '<div onclick="switchMainTab(\'' + t.id + '\')" class="surface rounded-lg p-4 border border-c hover:border-blue-500 cursor-pointer transition-all relative" draggable="true" data-tabcard="' + t.id + '"><span class="absolute top-2 left-2 drag-handle text-slate-500 text-xs"><i class="fas fa-grip-vertical"></i></span><div class="absolute bottom-2 right-2 flex gap-1">' + (i>0?'<button onclick="event.stopPropagation();moveTabCard(\'' + t.id + '\',-1)" class="text-slate-500 hover:text-white text-xs p-0.5"><i class="fas fa-chevron-left"></i></button>':'') + (i<state.mainTabs.length-1?'<button onclick="event.stopPropagation();moveTabCard(\'' + t.id + '\',1)" class="text-slate-500 hover:text-white text-xs p-0.5"><i class="fas fa-chevron-right"></i></button>':'') + '</div><div class="flex items-center gap-2 mb-2"><span class="text-2xl">' + t.icon + '</span><span class="font-medium text-sm">' + t.name + '</span></div><div class="text-2xl font-bold" style="color:' + t.color + '">' + count + '</div><div class="text-xs text-slate-400">active items</div></div>';
  }
  html += '</div></div>';
  return html;
}

function renderKPISection(){
  var html = '<div><h3 class="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider"><i class="fas fa-chart-bar mr-1"></i>Metrics</h3><div class="grid grid-cols-2 md:grid-cols-4 gap-3">';
  for(var i=0;i<state.kpiWidgets.length;i++){
    var k = state.kpiWidgets[i];
    var val = calcKPI(k);
    var display = '';
    if(k.type==="progress"){
      var pct = k.filter && k.filter.total ? Math.round((val / k.filter.total) * 100) : 0;
      display = '<div class="text-xl font-bold text-blue-400">' + val + ' / ' + (k.filter&&k.filter.total||0) + '</div><div class="w-full bg-slate-600 rounded-full h-2 mt-2"><div class="bg-blue-500 h-2 rounded-full" style="width:' + Math.min(pct,100) + '%"></div></div>';
    } else {
      var prefix = (k.type==="total") ? "$" : "";
      display = '<div class="text-3xl font-bold text-blue-400">' + prefix + (typeof val==="number"?val.toLocaleString():val) + '</div>';
    }
    html += '<div class="kpi-card surface rounded-lg p-4 border border-c cursor-pointer relative" draggable="true" data-kpi="' + k.id + '" onclick="filterByKPI(\'' + k.id + '\')">';
    html += '<button onclick="event.stopPropagation();editKPI(\'' + k.id + '\')" class="absolute top-2 right-2 text-slate-500 hover:text-white text-xs p-1"><i class="fas fa-cog"></i></button>';
    html += '<span class="absolute top-2 left-2 drag-handle text-slate-500 text-xs"><i class="fas fa-grip-vertical"></i></span>';
    html += '<div class="absolute bottom-2 right-2 flex gap-1">' + (i>0?'<button onclick="event.stopPropagation();moveKPI(\'' + k.id + '\',-1)" class="text-slate-500 hover:text-white text-xs p-0.5"><i class="fas fa-chevron-left"></i></button>':'') + (i<state.kpiWidgets.length-1?'<button onclick="event.stopPropagation();moveKPI(\'' + k.id + '\',1)" class="text-slate-500 hover:text-white text-xs p-0.5"><i class="fas fa-chevron-right"></i></button>':'') + '</div>';
    html += '<div class="text-xs text-slate-400 mb-1">' + k.label + '</div>' + display;
    html += '</div>';
  }
  html += '<div onclick="showAddKPI()" class="kpi-card surface rounded-lg p-4 border border-c border-dashed hover:border-blue-500 cursor-pointer flex items-center justify-center"><i class="fas fa-plus text-slate-400"></i></div>';
  html += '</div></div>';
  return html;
}

function calcKPI(k){
  var items = state.items;
  var matched = [];
  for(var i=0;i<items.length;i++){
    var it = items[i];
    var match = true;
    if(k.filter){
      if(k.filter.status && it.status !== k.filter.status) match = false;
      if(k.filter.statusIn && k.filter.statusIn.indexOf(it.status) === -1) match = false;
      if(k.filter.statusNot && it.status === k.filter.statusNot) match = false;
      if(k.filter.priority && (!it.fields || it.fields.priority !== k.filter.priority)) match = false;
      if(k.filter.type && it.type !== k.filter.type) match = false;
      if(k.filter.tab && it.tab !== k.filter.tab) match = false;
    }
    if(match) matched.push(it);
  }
  if(k.type==="counter") return matched.length;
  if(k.type==="total"){
    var sum = 0;
    var field = k.filter && k.filter.sumField || "amount";
    for(var j=0;j<matched.length;j++){
      var v = matched[j].fields && matched[j].fields[field];
      if(typeof v==="number") sum += v;
      else if(typeof v==="string"){var n=parseFloat(v);if(!isNaN(n))sum+=n;}
    }
    return Math.round(sum);
  }
  if(k.type==="progress"){
    return matched.length;
  }
  if(k.type==="formula"){
    // formula references other KPIs by label: e.g. "Active Items - Completed"
    // For now, just return count (formula eval is complex)
    return matched.length;
  }
  return matched.length;
}

var activeKpiFilter = "";

function filterByKPI(kpiId){
  // Toggle: if same KPI clicked again, clear the filter
  if(activeKpiFilter === kpiId){
    activeKpiFilter = "";
  } else {
    activeKpiFilter = kpiId;
  }
  // Re-render the All tab to show/hide filtered items
  var content = document.getElementById("content");
  if(activeMainTab === "all") renderAllTab(content);
}

function toggleTabFilter(tabId){
  var idx = activeTabFilters.indexOf(tabId);
  if(idx > -1){
    activeTabFilters.splice(idx, 1);
  } else {
    activeTabFilters.push(tabId);
  }
  var content = document.getElementById("content");
  if(activeMainTab === "all") renderAllTab(content);
}

function clearTabFilters(){
  activeTabFilters = [];
  var content = document.getElementById("content");
  if(activeMainTab === "all") renderAllTab(content);
}

function renderKPIFilteredItems(){
  if(!activeKpiFilter) return "";
  var k = state.kpiWidgets.find(function(w){return w.id===activeKpiFilter;});
  if(!k) return "";
  // Use same logic as calcKPI to get matched items
  var matched = [];
  for(var i=0;i<state.items.length;i++){
    var it = state.items[i];
    var match = true;
    if(k.filter){
      if(k.filter.status && it.status !== k.filter.status) match = false;
      if(k.filter.statusIn && k.filter.statusIn.indexOf(it.status) === -1) match = false;
      if(k.filter.statusNot && it.status === k.filter.statusNot) match = false;
      if(k.filter.priority && (!it.fields || it.fields.priority !== k.filter.priority)) match = false;
      if(k.filter.type && it.type !== k.filter.type) match = false;
      if(k.filter.tab && it.tab !== k.filter.tab) match = false;
    }
    if(match) matched.push(it);
  }
  var html = '<div class="mt-4 surface rounded-lg border border-blue-500 p-4">';
  html += '<div class="flex items-center justify-between mb-3"><h3 class="text-sm font-semibold text-blue-400"><i class="fas fa-filter mr-1"></i>' + k.label + ' (' + matched.length + ')</h3><button onclick="filterByKPI(\'' + activeKpiFilter + '\')" class="text-slate-400 hover:text-white text-xs"><i class="fas fa-times mr-1"></i>Close</button></div>';
  html += renderKPIItemList(matched);
  html += '</div>';
  return html;
}

function renderKPIItemList(items){
  return renderItemList(items);
}

function swapDashSections(){
  sectionOrder = sectionOrder.reverse();
  saveData();
  renderContent();
}

function moveTabCard(tabId, dir){
  saveUndo();
  var idx = -1;
  for(var i=0;i<state.mainTabs.length;i++){
    if(state.mainTabs[i].id===tabId) idx = i;
  }
  if(idx<0) return;
  var newIdx = idx + dir;
  if(newIdx<0 || newIdx>=state.mainTabs.length) return;
  var item = state.mainTabs.splice(idx,1)[0];
  state.mainTabs.splice(newIdx,0,item);
  saveData();render();
}

function moveKPI(kpiId, dir){
  saveUndo();
  var idx = -1;
  for(var i=0;i<state.kpiWidgets.length;i++){
    if(state.kpiWidgets[i].id===kpiId) idx = i;
  }
  if(idx<0) return;
  var newIdx = idx + dir;
  if(newIdx<0 || newIdx>=state.kpiWidgets.length) return;
  var item = state.kpiWidgets.splice(idx,1)[0];
  state.kpiWidgets.splice(newIdx,0,item);
  saveData();render();
}

// ===== ITEM RENDERING =====
function renderItemList(items){
  if(!items || items.length === 0) return '<p class="text-slate-500 text-sm text-center py-4">No items</p>';
  var html = '<div class="space-y-2">';
  for(var i=0;i<items.length;i++){html += renderItemCard(items[i]);}
  html += '</div>';
  return html;
}

function renderGroupedItems(items){
  var groups = {};
  for(var i=0;i<items.length;i++){
    var key = "";
    if(groupField==="status") key = items[i].status||"None";
    if(groupField==="priority") key = (items[i].fields&&items[i].fields.priority)||"None";
    if(groupField==="type") key = items[i].type||"None";
    if(!groups[key]) groups[key] = [];
    groups[key].push(items[i]);
  }
  var html = "";
  var keys = Object.keys(groups);
  for(var k=0;k<keys.length;k++){
    html += '<div class="mb-4"><h3 class="text-sm font-semibold text-slate-300 mb-2 px-2 py-1 elevated rounded">' + keys[k] + ' <span class="text-slate-500">(' + groups[keys[k]].length + ')</span></h3>';
    html += renderItemList(groups[keys[k]]);
    html += '</div>';
  }
  return html;
}

function renderManualSections(sub, items){
  var secs = state.sections.filter(function(s){return s.subTabId === sub.id;});
  secs.sort(function(a,b){return (a.order||0)-(b.order||0);});
  var html = "";
  for(var i=0;i<secs.length;i++){
    var sec = secs[i];
    var secItems = items.filter(function(it){return it.section === sec.id;});
    html += '<div class="mb-4 surface rounded-lg border border-c p-3" draggable="false" data-section="' + sec.id + '">';
    html += '<div class="flex items-center justify-between mb-2"><div class="flex items-center gap-2"><span class="drag-handle cursor-grab section-handle text-slate-400" onmousedown="enableSectionDrag(this)"><i class="fas fa-grip-vertical"></i></span><h3 class="font-semibold text-sm">' + sec.name + '</h3><span class="text-xs text-slate-500">(' + secItems.length + ')</span></div><button onclick="editSection(\'' + sec.id + '\')" class="text-slate-400 hover:text-white text-xs px-2"><i class="fas fa-cog"></i></button></div>';
    html += renderItemList(secItems);
    if(sec.aggField && sec.aggOp){
      var aggVal = calcAggregate(secItems, sec.aggField, sec.aggOp);
      html += '<div class="mt-2 pt-2 border-t border-c text-right text-sm"><span class="text-slate-400">' + sec.aggOp + '(' + sec.aggField + '):</span> <span class="font-bold text-blue-400">$' + aggVal.toLocaleString() + '</span></div>';
    }
    html += '<button onclick="showAddItem(\'' + sec.id + '\')" class="mt-2 text-xs text-slate-400 hover:text-blue-400"><i class="fas fa-plus mr-1"></i>Add Item</button>';
    html += '</div>';
  }
  // Show unsectioned items
  var secIds = secs.map(function(s){return s.id;});
  var unsectioned = items.filter(function(it){return !it.section || secIds.indexOf(it.section)===-1;});
  if(unsectioned.length > 0){
    html += '<div class="mb-4 elevated rounded-lg border border-c border-dashed p-3">';
    html += '<h3 class="font-semibold text-sm text-slate-400 mb-2"><i class="fas fa-inbox mr-1"></i>Unsorted (' + unsectioned.length + ')</h3>';
    html += renderItemList(unsectioned);
    html += '</div>';
  }
  html += '<button onclick="showAddSection()" class="text-sm text-slate-400 hover:text-blue-400 mt-2"><i class="fas fa-plus mr-1"></i>Add Section</button>';
  return html;
}

function calcAggregate(items, field, op){
  var vals = [];
  for(var i=0;i<items.length;i++){
    var v = items[i].fields && (items[i].fields[field] || items[i].fields[field.toLowerCase()]);
    if(typeof v === "number") vals.push(v);
    else if(typeof v === "string"){var n=parseFloat(v);if(!isNaN(n))vals.push(n);}
  }
  if(vals.length === 0) return 0;
  if(op==="SUM") return vals.reduce(function(a,b){return a+b;},0);
  if(op==="AVG") return vals.reduce(function(a,b){return a+b;},0)/vals.length;
  if(op==="COUNT") return vals.length;
  if(op==="MIN") return Math.min.apply(null,vals);
  if(op==="MAX") return Math.max.apply(null,vals);
  return 0;
}

function renderItemCard(item){
  var isOverdue = item.fields && item.fields.dueDate && item.fields.dueDate < new Date().toISOString().slice(0,10) && item.status !== "Done";
  var html = '<div class="item-card surface rounded-lg border border-c transition-all ' + (isOverdue?"overdue-border":"") + (item.pinned?" border-l-2 border-l-amber-400":"") + '" draggable="false" data-item="' + item.id + '" id="itemWrap_' + item.id + '">';
  html += '<div class="flex items-center gap-2 flex-wrap p-3 cursor-pointer" onclick="toggleExpand(\'' + item.id + '\')">';
  // Drag handle
  html += '<span class="drag-handle text-slate-500 text-xs item-handle" onmousedown="event.stopPropagation();enableItemDrag(this)"><i class="fas fa-grip-vertical"></i></span>';
  html += '<i class="fas fa-chevron-right text-slate-500 text-xs expand-arrow" id="arrow_' + item.id + '"></i>';
  // Pin
  if(item.pinned) html += '<i class="fas fa-thumbtack text-amber-400 text-xs"></i>';
  // Type badge
  var typeColors = {Task:"bg-blue-900 text-blue-300",Goal:"bg-purple-900 text-purple-300",Habit:"bg-green-900 text-green-300",Routine:"bg-teal-900 text-teal-300",Project:"bg-orange-900 text-orange-300",Idea:"bg-yellow-900 text-yellow-300",Book:"bg-indigo-900 text-indigo-300",Bill:"bg-red-900 text-red-300",Debt:"bg-rose-900 text-rose-300",Asset:"bg-emerald-900 text-emerald-300",Income:"bg-lime-900 text-lime-300",Contact:"bg-cyan-900 text-cyan-300",Custom:"bg-slate-700 text-slate-300"};
  html += '<span class="badge ' + (typeColors[item.type]||"bg-slate-700 text-slate-300") + '">' + item.type + '</span>';
  // Title
  html += '<span class="font-medium text-sm flex-1 truncate">' + item.title + '</span>';
  // Status
  var stColors = {Active:"bg-green-700 text-green-100","To Do":"bg-slate-600 text-slate-200","In Progress":"bg-blue-700 text-blue-100",Done:"bg-slate-700 text-slate-400",Paused:"bg-yellow-800 text-yellow-200",Future:"bg-indigo-800 text-indigo-200",Suspended:"bg-red-800 text-red-200"};
  html += '<span class="badge ' + (stColors[item.status]||"bg-slate-600 text-slate-200") + ' cursor-pointer" onclick="event.stopPropagation();cycleStatus(\'' + item.id + '\')">' + item.status + '</span>';
  // Priority
  if(item.fields && item.fields.priority){
    var pColors = {High:"text-red-400",Medium:"text-yellow-400",Low:"text-green-400"};
    html += '<span class="text-xs ' + (pColors[item.fields.priority]||"") + '"><i class="fas fa-flag"></i></span>';
  }
  // Amount/Value
  if(item.fields && item.fields.amount) html += '<span class="text-xs text-slate-400">$' + Number(item.fields.amount).toLocaleString() + '</span>';
  if(item.fields && item.fields.value) html += '<span class="text-xs text-emerald-400">$' + Number(item.fields.value).toLocaleString() + '</span>';
  // Due date
  if(item.fields && item.fields.dueDate) html += '<span class="text-xs ' + (isOverdue?"text-red-400":"text-slate-400") + '"><i class="fas fa-calendar mr-1"></i>' + item.fields.dueDate + '</span>';
  // Streak
  if(item.type==="Habit" && item.fields && item.fields.streak) html += '<span class="text-xs text-orange-400"><i class="fas fa-fire mr-1"></i>' + item.fields.streak + '</span>';
  // SubItems count
  if(item.subItems && item.subItems.length > 0){
    var done = item.subItems.filter(function(s){return s.done;}).length;
    html += '<span class="text-xs text-slate-400">' + done + '/' + item.subItems.length + '</span>';
  }
  // Tab origin badge (shown on All tab so user knows where item lives)
  if(activeMainTab === "all" || activeKpiFilter){
    var tabInfo = state.mainTabs.find(function(t){return t.id===item.tab;});
    var isActiveFilter = activeTabFilters.indexOf(item.tab) > -1;
    if(tabInfo) html += '<span class="text-xs px-2 py-0.5 rounded cursor-pointer hover:bg-slate-500 ' + (isActiveFilter?"bg-blue-700 text-white":"elevated") + '" onclick="event.stopPropagation();toggleTabFilter(\'' + item.tab + '\')" title="Filter by ' + tabInfo.name + '">' + tabInfo.icon + ' ' + tabInfo.name + '</span>';
    // Show cross-tab tags too
    if(item.tags && item.tags.length > 0){
      for(var tg=0;tg<item.tags.length;tg++){
        var tagTab = state.mainTabs.find(function(t){return t.id===item.tags[tg];});
        var isTagActive = activeTabFilters.indexOf(tagTab?tagTab.id:"") > -1;
        if(tagTab) html += '<span class="text-xs px-2 py-0.5 rounded cursor-pointer hover:bg-slate-500 border border-slate-500 ' + (isTagActive?"bg-blue-700 text-white":"elevated") + '" onclick="event.stopPropagation();toggleTabFilter(\'' + tagTab.id + '\')" title="Filter by ' + tagTab.name + '">' + tagTab.icon + ' ' + tagTab.name + '</span>';
      }
    }
  }
  html += '</div>';
  html += '<div id="expand_' + item.id + '" class="hidden"></div>';
  html += '</div>';
  return html;
}

// ===== ADD ITEM =====
function showAddItem(sectionId){
  var html = '<h2 class="text-lg font-bold mb-4"><i class="fas fa-plus mr-2 text-blue-400"></i>New Item</h2>';
  html += '<div class="space-y-3">';
  html += '<input id="newItemTitle" placeholder="Title" class="w-full text-sm">';
  html += '<select id="newItemType" class="w-full text-sm" onchange="updateNewItemFields()"><option value="">Choose type...</option>';
  var types = ["Task","Goal","Habit","Routine","Project","Idea","Book","Bill","Debt","Asset","Income","Contact","Custom"];
  for(var i=0;i<types.length;i++) html += '<option>' + types[i] + '</option>';
  html += '</select>';
  html += '<select id="newItemStatus" class="w-full text-sm"><option>Active</option><option>To Do</option><option>In Progress</option><option>Done</option><option>Paused</option><option>Future</option></select>';
  html += '<select id="newItemPriority" class="w-full text-sm"><option value="">Priority (optional)</option><option>High</option><option>Medium</option><option>Low</option></select>';
  html += '<div id="newItemExtraFields"></div>';
  html += '<input type="hidden" id="newItemSection" value="' + (sectionId||"") + '">';
  html += '<div class="flex gap-2 pt-2"><button onclick="createItem()" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-medium text-sm">Create</button><button onclick="closeModal()" class="flex-1 elevated hover:bg-slate-500 py-2 rounded text-sm">Cancel</button></div>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
  setTimeout(function(){document.getElementById("newItemTitle").focus();},100);
}

function updateNewItemFields(){
  var type = document.getElementById("newItemType").value;
  var container = document.getElementById("newItemExtraFields");
  var html = "";
  if(type==="Habit"||type==="Routine") html += '<input id="nf_frequency" placeholder="Frequency (Daily, Weekly...)" class="w-full text-sm">';
  if(type==="Bill"||type==="Income") html += '<input id="nf_amount" placeholder="Amount" type="number" class="w-full text-sm"><input id="nf_frequency" placeholder="Frequency" class="w-full text-sm">';
  if(type==="Bill") html += '<input id="nf_payer" placeholder="Payer" class="w-full text-sm">';
  if(type==="Debt") html += '<input id="nf_amount" placeholder="Amount" type="number" class="w-full text-sm"><input id="nf_rate" placeholder="Rate" class="w-full text-sm"><input id="nf_payment" placeholder="Monthly Payment" type="number" class="w-full text-sm">';
  if(type==="Asset") html += '<input id="nf_value" placeholder="Value" type="number" class="w-full text-sm"><input id="nf_notes" placeholder="Notes" class="w-full text-sm">';
  if(type==="Contact") html += '<input id="nf_relationship" placeholder="Relationship" class="w-full text-sm"><input id="nf_phone" placeholder="Phone" class="w-full text-sm"><input id="nf_email" placeholder="Email" class="w-full text-sm">';
  if(type==="Book") html += '<input id="nf_author" placeholder="Author" class="w-full text-sm">';
  if(type==="Task"||type==="Goal"||type==="Project") html += '<input id="nf_dueDate" placeholder="Due Date" type="date" class="w-full text-sm"><textarea id="nf_description" placeholder="Description" class="w-full text-sm" rows="2"></textarea>';
  container.innerHTML = html;
}

function createItem(){
  var title = document.getElementById("newItemTitle").value.trim();
  var type = document.getElementById("newItemType").value;
  if(!title){alert("Title is required");return;}
  if(!type){alert("Please choose a type");return;}
  saveUndo();
  var fields = {};
  var priority = document.getElementById("newItemPriority").value;
  if(priority) fields.priority = priority;
  var status = document.getElementById("newItemStatus").value;
  var section = document.getElementById("newItemSection").value || null;
  // Gather extra fields
  var extras = ["frequency","amount","payer","rate","payment","value","notes","relationship","phone","email","author","dueDate","description"];
  for(var i=0;i<extras.length;i++){
    var el = document.getElementById("nf_" + extras[i]);
    if(el && el.value.trim()){
      var v = el.value.trim();
      var num = parseFloat(v);
      fields[extras[i]] = (!isNaN(num) && String(num)===v) ? num : v;
    }
  }
  var newItem = {id:generateId(),tab:activeMainTab==="all"?(state.mainTabs[0]?state.mainTabs[0].id:"personal"):activeMainTab,section:section,title:title,type:type,status:status,fields:fields,subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:new Date().toISOString().slice(0,10)};
  state.items.push(newItem);
  saveData();closeModal();render();
}

// ===== CUSTOM FIELDS =====
function showAddCustomField(id){
  var existing = getAllFieldNames();
  var html = '<h3 class="text-sm font-bold mb-3">Add Custom Field</h3>';
  html += '<div class="space-y-2">';
  if(existing.length > 0){
    html += '<div class="text-xs text-slate-400 mb-1">Existing fields:</div><div class="flex flex-wrap gap-1 mb-2">';
    for(var i=0;i<existing.length;i++){
      html += '<button onclick="document.getElementById(\'cfName\').value=\'' + existing[i] + '\'" class="text-xs elevated px-2 py-1 rounded hover:bg-slate-500">' + existing[i] + '</button>';
    }
    html += '</div>';
  }
  html += '<input id="cfName" placeholder="Field name" class="w-full text-sm">';
  html += '<input id="cfValue" placeholder="Value" class="w-full text-sm">';
  html += '<div class="flex gap-2"><button onclick="doAddCustomField(\'' + id + '\')" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm">Add</button><button onclick="expandItem(\'' + id + '\')" class="elevated px-3 py-1 rounded text-sm">Cancel</button></div>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
}

function doAddCustomField(id){
  var name = document.getElementById("cfName").value.trim();
  var value = document.getElementById("cfValue").value.trim();
  if(!name) return;
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(!item) return;
  if(!item.customFields) item.customFields = [];
  item.customFields.push({key:name,value:value});
  saveData();expandItem(id);
}

function getAllFieldNames(){
  var names = {};
  for(var i=0;i<state.items.length;i++){
    if(state.items[i].customFields){
      for(var j=0;j<state.items[i].customFields.length;j++){
        names[state.items[i].customFields[j].key] = true;
      }
    }
  }
  return Object.keys(names);
}

// ===== TAB MANAGEMENT =====
function switchMainTab(id){
  activeMainTab = id;
  activeSubTab = "";
  var subs = state.subTabs.filter(function(s){return s.tabId === id;});
  if(subs.length > 0) activeSubTab = subs[0].id;
  render();
}

function switchSubTab(id){activeSubTab = id;renderContent();}

function showAddTab(){
  var html = '<h2 class="text-lg font-bold mb-4"><i class="fas fa-folder-plus mr-2 text-blue-400"></i>New Tab</h2>';
  html += '<div class="space-y-3">';
  html += '<input id="newTabName" placeholder="Tab name" class="w-full text-sm">';
  html += '<input id="newTabIcon" placeholder="Emoji icon (e.g. \ud83d\udcbc)" class="w-full text-sm" value="\ud83d\udcc1">';
  html += '<input id="newTabColor" type="color" value="#3b82f6" class="w-full h-10 rounded">';
  html += '<div class="flex gap-2"><button onclick="createTab()" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Create</button><button onclick="closeModal()" class="flex-1 elevated py-2 rounded text-sm">Cancel</button></div>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function createTab(){
  var name = document.getElementById("newTabName").value.trim();
  if(!name) return;
  saveUndo();
  var id = name.toLowerCase().replace(/[^a-z0-9]/g,"_");
  var icon = document.getElementById("newTabIcon").value || "\ud83d\udcc1";
  var color = document.getElementById("newTabColor").value;
  state.mainTabs.push({id:id,name:name,icon:icon,color:color});
  state.subTabs.push({id:id+"_all",tabId:id,name:"All",mode:"auto",filter:{field:"all"}});
  saveData();closeModal();render();
}

function tabContextMenu(e, tabId){
  e.preventDefault();
  var html = '<h3 class="text-sm font-bold mb-3">Tab Options</h3>';
  var tab = state.mainTabs.find(function(t){return t.id===tabId;});
  if(!tab) return;
  html += '<div class="space-y-2">';
  html += '<input id="renameTab" value="' + tab.name + '" class="w-full text-sm" placeholder="Tab name">';
  html += '<input id="renameTabIcon" value="' + tab.icon + '" class="w-full text-sm" placeholder="Icon emoji">';
  html += '<input id="renameTabColor" type="color" value="' + tab.color + '" class="w-full h-8 rounded">';
  html += '<div class="flex gap-2"><button onclick="saveTabEdit(\'' + tabId + '\')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Save</button><button onclick="duplicateTab(\'' + tabId + '\')" class="flex-1 elevated py-2 rounded text-sm">Duplicate</button></div>';
  html += '<button onclick="deleteTab(\'' + tabId + '\')" class="w-full text-red-400 hover:text-red-300 text-sm py-2"><i class="fas fa-trash mr-1"></i>Delete Tab</button>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function saveTabEdit(tabId){
  saveUndo();
  var tab = state.mainTabs.find(function(t){return t.id===tabId;});
  if(!tab) return;
  tab.name = document.getElementById("renameTab").value.trim() || tab.name;
  tab.icon = document.getElementById("renameTabIcon").value || tab.icon;
  tab.color = document.getElementById("renameTabColor").value || tab.color;
  saveData();closeModal();render();
}

function duplicateTab(tabId){
  saveUndo();
  var tab = state.mainTabs.find(function(t){return t.id===tabId;});
  if(!tab) return;
  var newId = tab.id + "_copy";
  state.mainTabs.push({id:newId,name:tab.name+" Copy",icon:tab.icon,color:tab.color});
  var subs = state.subTabs.filter(function(s){return s.tabId===tabId;});
  for(var i=0;i<subs.length;i++){
    state.subTabs.push({id:newId+"_"+i,tabId:newId,name:subs[i].name,mode:subs[i].mode,filter:JSON.parse(JSON.stringify(subs[i].filter))});
  }
  saveData();closeModal();render();
}

function deleteTab(tabId){
  if(!confirm("Delete this tab and all its items?")) return;
  saveUndo();
  state.mainTabs = state.mainTabs.filter(function(t){return t.id!==tabId;});
  state.subTabs = state.subTabs.filter(function(s){return s.tabId!==tabId;});
  state.items = state.items.filter(function(it){return it.tab!==tabId;});
  if(activeMainTab===tabId) activeMainTab="all";
  saveData();closeModal();render();
}

// ===== SUB-TAB MANAGEMENT =====
function showAddSubTab(){
  var html = '<h2 class="text-lg font-bold mb-4">New Sub-Tab</h2>';
  html += '<div class="space-y-3">';
  html += '<input id="newSubTabName" placeholder="Name" class="w-full text-sm">';
  html += '<div class="text-xs text-slate-400 mb-1">Mode:</div>';
  html += '<div class="flex gap-2"><button onclick="setSubTabMode(\'auto\')" id="stModeAuto" class="flex-1 elevated py-2 rounded text-sm border border-blue-500">Auto-filter</button><button onclick="setSubTabMode(\'manual\')" id="stModeManual" class="flex-1 elevated py-2 rounded text-sm border border-c">Manual</button></div>';
  html += '<div id="subTabFilterOpts"><select id="stFilterField" class="w-full text-sm"><option value="all">All items</option><option value="type">By Type</option><option value="status">By Status</option><option value="priority">By Priority</option></select><select id="stFilterValue" class="w-full text-sm mt-2"><option>Task</option><option>Goal</option><option>Habit</option><option>Routine</option><option>Project</option><option>Idea</option><option>Book</option><option>Bill</option><option>Debt</option><option>Asset</option><option>Income</option><option>Contact</option><option>Active</option><option>To Do</option><option>In Progress</option><option>Done</option><option>Paused</option><option>Future</option><option>High</option><option>Medium</option><option>Low</option></select></div>';
  html += '<input type="hidden" id="stMode" value="auto">';
  html += '<div class="flex gap-2"><button onclick="createSubTab()" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Create</button><button onclick="closeModal()" class="flex-1 elevated py-2 rounded text-sm">Cancel</button></div>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function setSubTabMode(mode){
  document.getElementById("stMode").value = mode;
  document.getElementById("stModeAuto").className = "flex-1 elevated py-2 rounded text-sm border " + (mode==="auto"?"border-blue-500":"border-c");
  document.getElementById("stModeManual").className = "flex-1 elevated py-2 rounded text-sm border " + (mode==="manual"?"border-blue-500":"border-c");
  document.getElementById("subTabFilterOpts").style.display = mode==="auto"?"block":"none";
}

function createSubTab(){
  var name = document.getElementById("newSubTabName").value.trim();
  if(!name) return;
  saveUndo();
  var mode = document.getElementById("stMode").value;
  var filter = {};
  if(mode==="auto"){
    var field = document.getElementById("stFilterField").value;
    var value = document.getElementById("stFilterValue").value;
    filter = field==="all" ? {field:"all"} : {field:field,value:value};
  }
  var id = activeMainTab + "_" + name.toLowerCase().replace(/[^a-z0-9]/g,"_");
  state.subTabs.push({id:id,tabId:activeMainTab,name:name,mode:mode,filter:filter});
  saveData();closeModal();render();
  switchSubTab(id);
}

function subTabContextMenu(e, subTabId){
  e.preventDefault();
  var sub = state.subTabs.find(function(s){return s.id===subTabId;});
  if(!sub) return;
  var html = '<h3 class="text-sm font-bold mb-3">Sub-Tab Options</h3>';
  html += '<div class="space-y-2">';
  html += '<input id="renameSubTab" value="' + sub.name + '" class="w-full text-sm" placeholder="Sub-tab name">';
  html += '<div class="text-xs text-slate-400 mb-1">Mode: ' + (sub.mode||"auto") + '</div>';
  if(sub.mode==="auto"){
    html += '<select id="editStFilterField" class="w-full text-sm"><option value="all"' + (sub.filter&&sub.filter.field==="all"?" selected":"") + '>All items</option><option value="type"' + (sub.filter&&sub.filter.field==="type"?" selected":"") + '>By Type</option><option value="status"' + (sub.filter&&sub.filter.field==="status"?" selected":"") + '>By Status</option><option value="priority"' + (sub.filter&&sub.filter.field==="priority"?" selected":"") + '>By Priority</option></select>';
    html += '<select id="editStFilterValue" class="w-full text-sm mt-2"><option>Task</option><option>Goal</option><option>Habit</option><option>Routine</option><option>Project</option><option>Idea</option><option>Book</option><option>Bill</option><option>Debt</option><option>Asset</option><option>Income</option><option>Contact</option><option>Active</option><option>To Do</option><option>In Progress</option><option>Done</option><option>Paused</option><option>Future</option><option>High</option><option>Medium</option><option>Low</option></select>';
  }
  html += '<div class="flex gap-2"><button onclick="saveSubTabEdit(\'' + subTabId + '\')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Save</button><button onclick="deleteSubTab(\'' + subTabId + '\')" class="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded text-sm">Delete</button></div>';
  html += '<button onclick="closeModal()" class="w-full elevated py-2 rounded text-sm mt-1">Cancel</button>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function saveSubTabEdit(subTabId){
  saveUndo();
  var sub = state.subTabs.find(function(s){return s.id===subTabId;});
  if(!sub) return;
  sub.name = document.getElementById("renameSubTab").value.trim() || sub.name;
  if(sub.mode==="auto"){
    var field = document.getElementById("editStFilterField").value;
    var value = document.getElementById("editStFilterValue").value;
    sub.filter = field==="all" ? {field:"all"} : {field:field,value:value};
  }
  saveData();closeModal();render();
}

function deleteSubTab(subTabId){
  if(!confirm("Delete this sub-tab?")) return;
  saveUndo();
  state.subTabs = state.subTabs.filter(function(s){return s.id!==subTabId;});
  state.sections = state.sections.filter(function(s){return s.subTabId!==subTabId;});
  if(activeSubTab===subTabId) activeSubTab="";
  saveData();closeModal();render();
}

// ===== SECTION MANAGEMENT =====
function showAddSection(){
  var html = '<h2 class="text-lg font-bold mb-4">New Section</h2>';
  html += '<div class="space-y-3">';
  html += '<input id="newSectionName" placeholder="Section name" class="w-full text-sm">';
  html += '<select id="newSectionAggField" class="w-full text-sm"><option value="">Aggregate field (optional)</option><option>amount</option><option>value</option><option>payment</option></select>';
  html += '<select id="newSectionAggOp" class="w-full text-sm"><option value="">Operation</option><option>SUM</option><option>AVG</option><option>COUNT</option><option>MIN</option><option>MAX</option></select>';
  html += '<div class="flex gap-2"><button onclick="createSection()" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Create</button><button onclick="closeModal()" class="flex-1 elevated py-2 rounded text-sm">Cancel</button></div>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function createSection(){
  var name = document.getElementById("newSectionName").value.trim();
  if(!name) return;
  saveUndo();
  var secs = state.sections.filter(function(s){return s.subTabId===activeSubTab;});
  state.sections.push({id:generateId(),subTabId:activeSubTab,name:name,aggField:document.getElementById("newSectionAggField").value,aggOp:document.getElementById("newSectionAggOp").value,order:secs.length});
  saveData();closeModal();render();
}

function editSection(secId){
  var sec = state.sections.find(function(s){return s.id===secId;});
  if(!sec) return;
  var html = '<h2 class="text-lg font-bold mb-4">Edit Section</h2>';
  html += '<div class="space-y-3">';
  html += '<input id="editSecName" value="' + sec.name + '" class="w-full text-sm">';
  html += '<select id="editSecAggField" class="w-full text-sm"><option value="">Aggregate field</option><option' + (sec.aggField==="amount"?" selected":"") + '>amount</option><option' + (sec.aggField==="value"?" selected":"") + '>value</option><option' + (sec.aggField==="payment"?" selected":"") + '>payment</option></select>';
  html += '<select id="editSecAggOp" class="w-full text-sm"><option value="">Operation</option><option' + (sec.aggOp==="SUM"?" selected":"") + '>SUM</option><option' + (sec.aggOp==="AVG"?" selected":"") + '>AVG</option><option' + (sec.aggOp==="COUNT"?" selected":"") + '>COUNT</option><option' + (sec.aggOp==="MIN"?" selected":"") + '>MIN</option><option' + (sec.aggOp==="MAX"?" selected":"") + '>MAX</option></select>';
  html += '<div class="flex gap-2"><button onclick="saveSection(\'' + secId + '\')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Save</button><button onclick="deleteSection(\'' + secId + '\')" class="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded text-sm">Delete</button></div>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function saveSection(secId){
  saveUndo();
  var sec = state.sections.find(function(s){return s.id===secId;});
  if(!sec) return;
  sec.name = document.getElementById("editSecName").value.trim() || sec.name;
  sec.aggField = document.getElementById("editSecAggField").value;
  sec.aggOp = document.getElementById("editSecAggOp").value;
  saveData();closeModal();render();
}

function deleteSection(secId){
  if(!confirm("Delete this section?")) return;
  saveUndo();
  state.sections = state.sections.filter(function(s){return s.id!==secId;});
  state.items.forEach(function(it){if(it.section===secId) it.section=null;});
  saveData();closeModal();render();
}

// ===== KPI WIDGETS =====
function showAddKPI(){
  var html = '<h2 class="text-lg font-bold mb-4">New KPI Widget</h2>';
  html += '<div class="space-y-3">';
  html += '<input id="kpiLabel" placeholder="Label" class="w-full text-sm">';
  html += '<select id="kpiType" class="w-full text-sm"><option value="counter">Counter (count items)</option><option value="total">Total (sum a field)</option><option value="progress">Progress (X / target)</option></select>';
  html += '<div class="text-xs text-slate-400 mt-2">Filter by status (comma-separated):</div>';
  html += '<input id="kpiStatusIn" placeholder="e.g. Active,To Do" class="w-full text-sm">';
  html += '<div class="text-xs text-slate-400">Filter by priority:</div>';
  html += '<select id="kpiPriority" class="w-full text-sm"><option value="">Any</option><option>High</option><option>Medium</option><option>Low</option></select>';
  html += '<div class="text-xs text-slate-400">Filter by type:</div>';
  html += '<select id="kpiTypeFilter" class="w-full text-sm"><option value="">Any</option><option>Task</option><option>Goal</option><option>Habit</option><option>Bill</option><option>Debt</option><option>Asset</option><option>Income</option><option>Project</option></select>';
  html += '<div class="text-xs text-slate-400">Sum field (for Total type):</div>';
  html += '<select id="kpiSumField" class="w-full text-sm"><option value="amount">amount</option><option value="value">value</option><option value="payment">payment</option></select>';
  html += '<div class="text-xs text-slate-400">Target (for Progress type):</div>';
  html += '<input id="kpiTarget" placeholder="e.g. 10" type="number" class="w-full text-sm">';
  html += '<div class="flex gap-2"><button onclick="createKPI()" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Create</button><button onclick="closeModal()" class="flex-1 elevated py-2 rounded text-sm">Cancel</button></div>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function createKPI(){
  var label = document.getElementById("kpiLabel").value.trim();
  if(!label) return;
  saveUndo();
  var kpiType = document.getElementById("kpiType").value;
  var filter = {};
  var statusIn = document.getElementById("kpiStatusIn").value.trim();
  if(statusIn) filter.statusIn = statusIn.split(",").map(function(s){return s.trim();});
  var priority = document.getElementById("kpiPriority").value;
  if(priority) filter.priority = priority;
  var typeFilter = document.getElementById("kpiTypeFilter").value;
  if(typeFilter) filter.type = typeFilter;
  if(kpiType==="total"){
    filter.sumField = document.getElementById("kpiSumField").value;
  }
  if(kpiType==="progress"){
    var target = parseInt(document.getElementById("kpiTarget").value) || 10;
    filter.total = target;
  }
  state.kpiWidgets.push({id:generateId(),label:label,type:kpiType,filter:filter});
  saveData();closeModal();render();
}

function editKPI(kpiId){
  var k = state.kpiWidgets.find(function(w){return w.id===kpiId;});
  if(!k) return;
  var html = '<h2 class="text-lg font-bold mb-4"><i class="fas fa-chart-bar mr-2 text-blue-400"></i>Edit KPI</h2>';
  html += '<div class="space-y-3">';
  html += '<div class="text-xs text-slate-400">Label:</div>';
  html += '<input id="editKpiLabel" value="' + k.label + '" class="w-full text-sm" placeholder="KPI label">';
  html += '<div class="text-xs text-slate-400">Type:</div>';
  html += '<select id="editKpiType" class="w-full text-sm"><option value="counter"' + (k.type==="counter"?" selected":"") + '>Counter (count items)</option><option value="total"' + (k.type==="total"?" selected":"") + '>Total (sum a field)</option><option value="progress"' + (k.type==="progress"?" selected":"") + '>Progress (X / target)</option></select>';
  html += '<div class="text-xs text-slate-400">Filter by status (comma-separated):</div>';
  html += '<input id="editKpiStatusIn" value="' + (k.filter&&k.filter.statusIn?k.filter.statusIn.join(", "):"") + '" class="w-full text-sm" placeholder="e.g. Active, To Do">';
  html += '<div class="text-xs text-slate-400">Exclude status:</div>';
  html += '<input id="editKpiStatusNot" value="' + (k.filter&&k.filter.statusNot||"") + '" class="w-full text-sm" placeholder="e.g. Done">';
  html += '<div class="text-xs text-slate-400">Filter by priority:</div>';
  html += '<select id="editKpiPriority" class="w-full text-sm"><option value="">Any</option><option' + (k.filter&&k.filter.priority==="High"?" selected":"") + '>High</option><option' + (k.filter&&k.filter.priority==="Medium"?" selected":"") + '>Medium</option><option' + (k.filter&&k.filter.priority==="Low"?" selected":"") + '>Low</option></select>';
  html += '<div class="text-xs text-slate-400">Filter by type:</div>';
  html += '<select id="editKpiTypeFilter" class="w-full text-sm"><option value="">Any</option><option' + (k.filter&&k.filter.type==="Task"?" selected":"") + '>Task</option><option' + (k.filter&&k.filter.type==="Goal"?" selected":"") + '>Goal</option><option' + (k.filter&&k.filter.type==="Habit"?" selected":"") + '>Habit</option><option' + (k.filter&&k.filter.type==="Bill"?" selected":"") + '>Bill</option><option' + (k.filter&&k.filter.type==="Debt"?" selected":"") + '>Debt</option><option' + (k.filter&&k.filter.type==="Asset"?" selected":"") + '>Asset</option><option' + (k.filter&&k.filter.type==="Income"?" selected":"") + '>Income</option><option' + (k.filter&&k.filter.type==="Project"?" selected":"") + '>Project</option></select>';
  html += '<div class="text-xs text-slate-400">Sum field (for Total type):</div>';
  html += '<select id="editKpiSumField" class="w-full text-sm"><option value="amount"' + (k.filter&&k.filter.sumField==="amount"?" selected":"") + '>amount</option><option value="value"' + (k.filter&&k.filter.sumField==="value"?" selected":"") + '>value</option><option value="payment"' + (k.filter&&k.filter.sumField==="payment"?" selected":"") + '>payment</option></select>';
  html += '<div class="text-xs text-slate-400">Target (for Progress type):</div>';
  html += '<input id="editKpiTarget" value="' + (k.filter&&k.filter.total||"") + '" type="number" class="w-full text-sm" placeholder="e.g. 10">';
  html += '<div class="flex gap-2 pt-2"><button onclick="saveKPIEdit(\'' + kpiId + '\')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Save</button><button onclick="deleteKPI(\'' + kpiId + '\')" class="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded text-sm">Delete</button></div>';
  html += '<button onclick="closeModal()" class="w-full elevated py-2 rounded text-sm">Cancel</button>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function saveKPIEdit(kpiId){
  saveUndo();
  var k = state.kpiWidgets.find(function(w){return w.id===kpiId;});
  if(!k) return;
  k.label = document.getElementById("editKpiLabel").value.trim() || k.label;
  k.type = document.getElementById("editKpiType").value;
  var filter = {};
  var statusIn = document.getElementById("editKpiStatusIn").value.trim();
  if(statusIn) filter.statusIn = statusIn.split(",").map(function(s){return s.trim();});
  var statusNot = document.getElementById("editKpiStatusNot").value.trim();
  if(statusNot) filter.statusNot = statusNot;
  var priority = document.getElementById("editKpiPriority").value;
  if(priority) filter.priority = priority;
  var typeFilter = document.getElementById("editKpiTypeFilter").value;
  if(typeFilter) filter.type = typeFilter;
  if(k.type==="total"){
    filter.sumField = document.getElementById("editKpiSumField").value;
  }
  if(k.type==="progress"){
    var target = parseInt(document.getElementById("editKpiTarget").value) || 10;
    filter.total = target;
  }
  k.filter = filter;
  saveData();closeModal();render();
}

function deleteKPI(kpiId){
  if(!confirm("Delete this KPI?")) return;
  saveUndo();
  state.kpiWidgets = state.kpiWidgets.filter(function(w){return w.id!==kpiId;});
  saveData();closeModal();render();
}

