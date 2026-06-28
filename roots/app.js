window.onerror=function(m,s,l,c,e){console.error("Error:",m,s,l);return true;};

// ===== DATA LAYER =====
var STORAGE_KEY = "compass_v6_profiles";
var state = {};
var undoState = null;
var currentProfile = "Leo";
var activeMainTab = "all";
var activeSubTab = "";
var filters = {status:"",priority:"",type:""};
var sortField = "";
var groupField = "";
var sectionOrder = ["tabs","kpis"];
var activeTabFilters = [];

function generateId(){return "id_" + Date.now() + "_" + Math.floor(Math.random()*9999);}

function loadProfiles(){
  var raw = localStorage.getItem(STORAGE_KEY);
  if(raw){try{return JSON.parse(raw);}catch(e){return null;}}
  return null;
}

function saveData(){
  var profiles = loadProfiles() || {};
  profiles[currentProfile] = {items:state.items,mainTabs:state.mainTabs,subTabs:state.subTabs,sections:state.sections,kpiWidgets:state.kpiWidgets,sectionOrder:sectionOrder,settings:state.settings||{}};
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function saveUndo(){
  undoState = JSON.parse(JSON.stringify(state));
  document.getElementById("undoBtn").className = "";
}

function doUndo(){
  if(undoState){state = undoState;undoState = null;document.getElementById("undoBtn").className = "hidden";saveData();render();}
}

function getDefaultData(){
  var items = [];
  var mainTabs = [
    {id:"personal",name:"Personal",icon:"\ud83d\udc64",color:"#3b82f6"},
    {id:"westvalley",name:"West Valley",icon:"\ud83e\udeb5",color:"#f97316"},
    {id:"tacos",name:"Tacos",icon:"\ud83c\udf2e",color:"#ef4444"},
    {id:"harvest",name:"Harvest",icon:"\ud83c\udf31",color:"#22c55e"}
  ];
  var subTabs = [
    {id:"personal_all",tabId:"personal",name:"All",mode:"auto",filter:{field:"all"}},
    {id:"personal_tasks",tabId:"personal",name:"Tasks",mode:"auto",filter:{field:"type",value:"Task"}},
    {id:"personal_goals",tabId:"personal",name:"Goals",mode:"auto",filter:{field:"type",value:"Goal"}},
    {id:"personal_habits",tabId:"personal",name:"Habits",mode:"auto",filter:{field:"type",values:["Habit","Routine"]}},
    {id:"personal_finances",tabId:"personal",name:"Finances",mode:"auto",filter:{field:"type",values:["Bill","Debt","Asset","Income"]}},
    {id:"personal_people",tabId:"personal",name:"People",mode:"auto",filter:{field:"type",value:"Contact"}},
    {id:"wv_all",tabId:"westvalley",name:"All",mode:"auto",filter:{field:"all"}},
    {id:"wv_projects",tabId:"westvalley",name:"Projects",mode:"auto",filter:{field:"type",value:"Project"}},
    {id:"wv_tasks",tabId:"westvalley",name:"Tasks",mode:"auto",filter:{field:"type",value:"Task"}},
    {id:"wv_goals",tabId:"westvalley",name:"Goals",mode:"auto",filter:{field:"type",value:"Goal"}},
    {id:"wv_inventory",tabId:"westvalley",name:"Inventory",mode:"manual",filter:{}},
    {id:"wv_habits",tabId:"westvalley",name:"Habits",mode:"auto",filter:{field:"type",values:["Habit","Routine"]}},
    {id:"wv_finances",tabId:"westvalley",name:"Finances",mode:"auto",filter:{field:"type",values:["Bill","Debt","Asset","Income"]}},
    {id:"wv_people",tabId:"westvalley",name:"People",mode:"auto",filter:{field:"type",value:"Contact"}},
    {id:"wv_ideas",tabId:"westvalley",name:"Ideas",mode:"auto",filter:{field:"type",value:"Idea"}},
    {id:"tacos_all",tabId:"tacos",name:"All",mode:"auto",filter:{field:"all"}},
    {id:"tacos_tasks",tabId:"tacos",name:"Tasks",mode:"auto",filter:{field:"type",value:"Task"}},
    {id:"tacos_finances",tabId:"tacos",name:"Finances",mode:"auto",filter:{field:"type",values:["Bill","Debt","Asset","Income"]}},
    {id:"tacos_people",tabId:"tacos",name:"People",mode:"auto",filter:{field:"type",value:"Contact"}},
    {id:"harvest_all",tabId:"harvest",name:"All",mode:"auto",filter:{field:"all"}},
    {id:"harvest_tasks",tabId:"harvest",name:"Tasks",mode:"auto",filter:{field:"type",value:"Task"}},
    {id:"harvest_goals",tabId:"harvest",name:"Goals",mode:"auto",filter:{field:"type",value:"Goal"}},
    {id:"harvest_habits",tabId:"harvest",name:"Habits",mode:"auto",filter:{field:"type",values:["Habit","Routine"]}},
    {id:"harvest_finances",tabId:"harvest",name:"Finances",mode:"auto",filter:{field:"type",values:["Bill","Debt","Asset","Income"]}},
    {id:"harvest_people",tabId:"harvest",name:"People",mode:"auto",filter:{field:"type",value:"Contact"}},
    {id:"harvest_ideas",tabId:"harvest",name:"Ideas",mode:"auto",filter:{field:"type",value:"Idea"}}
  ];
  var sections = [
    {id:"wv_inv_products",subTabId:"wv_inventory",name:"Products",aggField:"",aggOp:"",order:0},
    {id:"wv_inv_materials",subTabId:"wv_inventory",name:"Raw Materials",aggField:"",aggOp:"",order:1}
  ];

  // Personal items
  items.push({id:generateId(),tab:"personal",section:null,title:"Get Permanent Residency",type:"Goal",status:"Active",fields:{priority:"High",description:"Immigration path to permanent residency"},subItems:[{id:generateId(),text:"DACA Renewal",done:false,comments:[]},{id:generateId(),text:"EAD Expired",done:true,comments:[]},{id:generateId(),text:"Change of Status",done:false,comments:[]},{id:generateId(),text:"Find sponsor",done:false,comments:[]}],comments:[{id:generateId(),text:"June 17 EAD expired",date:"2026-06-17"},{id:generateId(),text:"May 22 Lawyer meeting",date:"2026-05-22"},{id:generateId(),text:"Feb 21 Filed",date:"2026-02-21"}],tags:[],customFields:[],pinned:true,createdAt:"2026-01-15"});
  items.push({id:generateId(),tab:"personal",section:null,title:"California trip with kids",type:"Goal",status:"Done",fields:{priority:"Medium"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-03-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"Daily prayer/reflection",type:"Habit",status:"Active",fields:{frequency:"Daily",streak:14},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"Night thinking time (11pm-2am)",type:"Habit",status:"Active",fields:{frequency:"Daily",streak:30},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"Read 1 book/month",type:"Habit",status:"Paused",fields:{frequency:"Monthly",streak:0},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  // Bills
  var bills=[["Mortgage",1287,"Monthly","Me"],["Auto Loan",565,"Monthly","Me"],["CC Interest",420,"Monthly","Me"],["Auto Insurance",365,"Monthly","Me"],["Electricity",200,"Monthly","Me"],["Donations",200,"Monthly","Me"],["Medical",200,"Monthly","Me"],["Food/Groceries/Fuel",1600,"Monthly","Me"],["Home 2 Mortgage",3000,"Monthly","Parents"],["Dad's Truck",990,"Monthly","Parents"]];
  for(var b=0;b<bills.length;b++){items.push({id:generateId(),tab:"personal",section:null,title:bills[b][0],type:"Bill",status:"Active",fields:{amount:bills[b][1],frequency:bills[b][2],payer:bills[b][3]},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});}
  // Assets
  items.push({id:generateId(),tab:"personal",section:null,title:"Home 1",type:"Asset",status:"Active",fields:{value:350000,notes:"$160K equity"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"Home 2",type:"Asset",status:"Active",fields:{value:465000,notes:"$57K equity (parents pay)"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"401K",type:"Asset",status:"Active",fields:{value:13000},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"RSUs",type:"Asset",status:"Active",fields:{value:33000},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  // Debts
  items.push({id:generateId(),tab:"personal",section:null,title:"Home 1 Mortgage",type:"Debt",status:"Active",fields:{amount:190000,rate:"3.125%",payment:1287},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"Credit Cards",type:"Debt",status:"Active",fields:{amount:23000,rate:"22%",payment:420},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"CRV",type:"Debt",status:"Active",fields:{amount:20000,payment:565},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  // Income
  items.push({id:generateId(),tab:"personal",section:null,title:"Amazon",type:"Income",status:"Suspended",fields:{amount:3666,frequency:"Monthly"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"WV WoodWorks",type:"Income",status:"Active",fields:{amount:0,frequency:"Variable"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  // Contacts
  items.push({id:generateId(),tab:"personal",section:null,title:"Mary Castillo",type:"Contact",status:"Active",fields:{relationship:"Wife",tabNotes:"Starting pottery business"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"Daniel Castillo",type:"Contact",status:"Active",fields:{relationship:"Family",tabNotes:"Born May 17, 2004"},subItems:[],comments:[],tags:["westvalley","harvest"],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"Rodrigo Castillo",type:"Contact",status:"Active",fields:{relationship:"Family",tabNotes:"Born Nov 2007"},subItems:[],comments:[],tags:["westvalley"],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"personal",section:null,title:"Alfredo",type:"Contact",status:"Active",fields:{relationship:"Friend",tabNotes:"Potential sponsor"},subItems:[],comments:[],tags:["westvalley"],customFields:[],pinned:false,createdAt:"2026-01-01"});

  // West Valley items
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Alfredo Bookshelf",type:"Project",status:"In Progress",fields:{priority:"High"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-05-01"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Kitchen Organizers",type:"Project",status:"To Do",fields:{priority:"Medium"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-05-15"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Backyard Half-Wall",type:"Project",status:"To Do",fields:{priority:"Low"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Stephanie Bench",type:"Project",status:"Done",fields:{priority:"Medium"},subItems:[],comments:[{id:generateId(),text:"Paid",date:"2026-05-20"}],tags:[],customFields:[],pinned:false,createdAt:"2026-04-01"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Adam 3x Benches",type:"Project",status:"Done",fields:{priority:"High"},subItems:[],comments:[{id:generateId(),text:"$1,385 Paid",date:"2026-06-10"}],tags:[],customFields:[],pinned:false,createdAt:"2026-04-15"});
  var wvTasks=[["Photograph and post all products","High"],["Calibrate tools","Medium"],["Clean QuickBooks","Medium"],["Call Devin Whyte CPA","High"],["File TPT returns","High"],["Improve online presence","Medium"]];
  for(var w=0;w<wvTasks.length;w++){items.push({id:generateId(),tab:"westvalley",section:null,title:wvTasks[w][0],type:"Task",status:"To Do",fields:{priority:wvTasks[w][1]},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});}
  items.push({id:generateId(),tab:"westvalley",section:null,title:"$5K/month by August",type:"Goal",status:"Active",fields:{priority:"High",dueDate:"2026-08-01"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"$8K/month by September",type:"Goal",status:"Active",fields:{priority:"High",dueDate:"2026-09-01"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Post 3x/week on WV Instagram",type:"Habit",status:"Future",fields:{frequency:"3x/week",streak:0},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Product Inventory",type:"Asset",status:"Active",fields:{value:1140},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Raw Material",type:"Asset",status:"Active",fields:{value:3000},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Projects & Sales",type:"Income",status:"Active",fields:{amount:0,frequency:"Variable"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Adam Mentier",type:"Contact",status:"Active",fields:{relationship:"Client",tabNotes:"3 benches $1,385 PAID"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-05-01"});
  items.push({id:generateId(),tab:"westvalley",section:null,title:"Devin Whyte",type:"Contact",status:"Active",fields:{relationship:"Business",phone:"480-490-7244",tabNotes:"CPA for TPT"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-05-01"});

  // Tacos items
  items.push({id:generateId(),tab:"tacos",section:null,title:"Clean QuickBooks",type:"Task",status:"To Do",fields:{priority:"Medium"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});
  items.push({id:generateId(),tab:"tacos",section:null,title:"Reconcile April-June 2026",type:"Task",status:"To Do",fields:{priority:"Medium"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});
  items.push({id:generateId(),tab:"tacos",section:null,title:"Sales Tax Payable",type:"Debt",status:"Active",fields:{amount:2154.17},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});
  items.push({id:generateId(),tab:"tacos",section:null,title:"Taco Sales",type:"Income",status:"Paused",fields:{amount:7500,frequency:"Monthly"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-01-01"});

  // Harvest items
  var hTasks=[["Update website with new pricing","High"],["Write more articles","Medium"],["Start posting content","Medium"],["LinkedIn outreach","High"],["Podcast with Daniel","Medium"]];
  for(var h=0;h<hTasks.length;h++){items.push({id:generateId(),tab:"harvest",section:null,title:hTasks[h][0],type:"Task",status:"To Do",fields:{priority:hTasks[h][1]},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});}
  items.push({id:generateId(),tab:"harvest",section:null,title:"First paying client (non-family)",type:"Goal",status:"Active",fields:{priority:"High"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});
  items.push({id:generateId(),tab:"harvest",section:null,title:"Build content bank to 10+ articles",type:"Goal",status:"Active",fields:{priority:"Medium"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});
  items.push({id:generateId(),tab:"harvest",section:null,title:"Build client management system - replace Paperbell",type:"Idea",status:"Active",fields:{priority:"Medium",description:"Custom CRM for coaching clients"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-15"});
  items.push({id:generateId(),tab:"harvest",section:null,title:"Write 1 article/week",type:"Habit",status:"Future",fields:{frequency:"Weekly",streak:0},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});
  items.push({id:generateId(),tab:"harvest",section:null,title:"Coaching",type:"Income",status:"Active",fields:{amount:0,frequency:"Variable"},subItems:[],comments:[],tags:[],customFields:[],pinned:false,createdAt:"2026-06-01"});

  var kpiWidgets = [
    {id:generateId(),label:"Active Items",type:"counter",filter:{statusIn:["Active","To Do","In Progress"]}},
    {id:generateId(),label:"High Priority",type:"counter",filter:{priority:"High",statusNot:"Done"}},
    {id:generateId(),label:"In Progress",type:"counter",filter:{status:"In Progress"}},
    {id:generateId(),label:"Completed",type:"counter",filter:{status:"Done"}}
  ];

  return {items:items,mainTabs:mainTabs,subTabs:subTabs,sections:sections,kpiWidgets:kpiWidgets,settings:{}};
}

function initApp(){
  // Always use Supabase cloud mode
  if(typeof initSupabase === "function"){
    initSupabase();
    return;
  }
  // If initSupabase doesn't exist, something is very wrong
  console.error("initSupabase not found — data.js may not have loaded");
}

function doInitApp(){
  var profiles = loadProfiles();
  if(profiles && profiles[currentProfile]){
    state = profiles[currentProfile];
    if(profiles[currentProfile].sectionOrder) sectionOrder = profiles[currentProfile].sectionOrder;
  } else {
    state = getDefaultData();
    saveData();
  }
  render();
  updateNotifBadge();
}

// ===== STATUS CYCLING =====
function cycleStatus(id){
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(!item) return;
  var statuses = ["Active","To Do","In Progress","Done","Paused","Future"];
  var idx = statuses.indexOf(item.status);
  item.status = statuses[(idx+1)%statuses.length];
  saveData();render();
}


var expandedItemId = "";

function toggleExpand(id){
  var container = document.getElementById("expand_" + id);
  var arrow = document.getElementById("arrow_" + id);
  if(!container) return;
  // If already expanded, collapse
  if(expandedItemId === id){
    container.innerHTML = "";
    container.classList.add("hidden");
    if(arrow) arrow.className = "fas fa-chevron-right text-slate-500 text-xs expand-arrow";
    expandedItemId = "";
    return;
  }
  // Collapse previous
  if(expandedItemId){
    var prev = document.getElementById("expand_" + expandedItemId);
    var prevArrow = document.getElementById("arrow_" + expandedItemId);
    if(prev){prev.innerHTML="";prev.classList.add("hidden");}
    if(prevArrow) prevArrow.className = "fas fa-chevron-right text-slate-500 text-xs expand-arrow";
  }
  expandedItemId = id;
  if(arrow) arrow.className = "fas fa-chevron-down text-blue-400 text-xs expand-arrow";
  container.classList.remove("hidden");
  container.innerHTML = buildExpandContent(id);
}

function buildExpandContent(id){
  var item = state.items.find(function(it){return it.id===id;});
  if(!item) return "";
  var html = '<div class="p-3 pt-0 space-y-3 border-t border-c mt-0">';
  // Type & Status row
  html += '<div class="flex flex-wrap gap-2">';
  html += '<select onchange="updateItemField(\'' + id + '\',\'type\',this.value)" class="text-xs py-1">';
  var types = ["Task","Goal","Habit","Routine","Project","Idea","Book","Bill","Debt","Asset","Income","Contact","Custom"];
  for(var i=0;i<types.length;i++){html += '<option' + (item.type===types[i]?" selected":"") + '>' + types[i] + '</option>';}
  html += '</select>';
  html += '<select onchange="updateItemField(\'' + id + '\',\'status\',this.value)" class="text-xs py-1">';
  var statuses = ["Active","To Do","In Progress","Done","Paused","Future","Suspended","Read","Reading","Want to Read"];
  for(var i=0;i<statuses.length;i++){html += '<option' + (item.status===statuses[i]?" selected":"") + '>' + statuses[i] + '</option>';}
  html += '</select>';
  html += '<select onchange="updateItemField(\'' + id + '\',\'priority\',this.value)" class="text-xs py-1"><option value="">Priority</option><option' + (item.fields&&item.fields.priority==="High"?" selected":"") + '>High</option><option' + (item.fields&&item.fields.priority==="Medium"?" selected":"") + '>Medium</option><option' + (item.fields&&item.fields.priority==="Low"?" selected":"") + '>Low</option></select>';
  html += '<label class="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" ' + (item.pinned?"checked":"") + ' onchange="togglePin(\'' + id + '\')"><i class="fas fa-thumbtack"></i>Pin</label>';
  html += '</div>';

  // Fields
  html += '<div class="space-y-2">';
  if(item.fields){
    var fkeys = Object.keys(item.fields);
    for(var f=0;f<fkeys.length;f++){
      var fk = fkeys[f];
      if(fk==="priority") continue;
      html += '<div class="flex items-center gap-2"><label class="text-xs text-slate-400 w-24 capitalize">' + fk + '</label><input class="flex-1 text-sm" value="' + (item.fields[fk]!==undefined?String(item.fields[fk]).replace(/"/g,"&quot;"):"") + '" onblur="updateFieldValue(\'' + id + '\',\'' + fk + '\',this.value)"></div>';
    }
  }
  // Custom fields
  if(item.customFields){
    for(var cf=0;cf<item.customFields.length;cf++){
      html += '<div class="flex items-center gap-2"><label class="text-xs text-slate-400 w-24">' + item.customFields[cf].key + '</label><input class="flex-1 text-sm" value="' + String(item.customFields[cf].value).replace(/"/g,"&quot;") + '" onblur="updateCustomField(\'' + id + '\',' + cf + ',this.value)"><button onclick="removeCustomField(\'' + id + '\',' + cf + ')" class="text-red-400 hover:text-red-300 text-xs p-1"><i class="fas fa-trash"></i></button></div>';
    }
  }
  html += '<button onclick="showAddCustomField(\'' + id + '\')" class="text-xs text-blue-400 hover:text-blue-300"><i class="fas fa-plus mr-1"></i>Add Field</button>';
  html += '</div>';

  // Sub-items
  html += '<div><h4 class="text-xs font-semibold text-slate-400 uppercase mb-2">' + (item.type==="Goal"?"Sub-Goals":item.type==="Routine"?"Steps":"Sub-Items") + ' (' + (item.subItems?item.subItems.length:0) + ')</h4>';
  if(item.subItems && item.subItems.length > 0){
    html += '<div class="space-y-1">';
    for(var s=0;s<item.subItems.length;s++){
      var si = item.subItems[s];
      html += '<div class="flex items-center gap-2 elevated rounded px-2 py-1"><input type="checkbox" ' + (si.done?"checked":"") + ' onchange="toggleSubItem(\'' + id + '\',' + s + ')" class="w-4 h-4"><span class="flex-1 text-sm ' + (si.done?"line-through text-slate-500":"") + '">' + si.text + '</span><button onclick="removeSubItem(\'' + id + '\',' + s + ')" class="text-red-400 text-xs p-1 hover:text-red-300"><i class="fas fa-times"></i></button></div>';
    }
    html += '</div>';
  }
  html += '<div class="flex gap-2 mt-2"><input id="newSubItem_' + id + '" placeholder="Add sub-item..." class="flex-1 text-sm" onkeydown="if(event.key===\'Enter\')addSubItem(\'' + id + '\')"><button onclick="addSubItem(\'' + id + '\')" class="text-blue-400 hover:text-blue-300 text-sm px-2"><i class="fas fa-plus"></i></button></div>';
  html += '</div>';

  // Comments
  html += '<div><h4 class="text-xs font-semibold text-slate-400 uppercase mb-2">Comments (' + (item.comments?item.comments.length:0) + ')</h4>';
  if(item.comments && item.comments.length > 0){
    html += '<div class="space-y-1">';
    for(var c=0;c<item.comments.length;c++){
      html += '<div class="text-xs elevated rounded px-2 py-1"><span class="text-slate-400">' + (item.comments[c].date||"") + '</span> ' + item.comments[c].text + '</div>';
    }
    html += '</div>';
  }
  html += '<div class="flex gap-2 mt-2"><input id="newComment_' + id + '" placeholder="Add comment..." class="flex-1 text-sm" onkeydown="if(event.key===\'Enter\')addComment(\'' + id + '\')"><button onclick="addComment(\'' + id + '\')" class="text-blue-400 hover:text-blue-300 text-sm px-2"><i class="fas fa-plus"></i></button></div>';
  html += '</div>';

  // Tags
  html += '<div><h4 class="text-xs font-semibold text-slate-400 uppercase mb-2">Cross-tab Tags</h4><div class="flex flex-wrap gap-1">';
  for(var t=0;t<state.mainTabs.length;t++){
    var tb = state.mainTabs[t];
    if(tb.id === item.tab) continue;
    var tagged = item.tags && item.tags.indexOf(tb.id) > -1;
    html += '<button onclick="toggleTag(\'' + id + '\',\'' + tb.id + '\')" class="text-xs px-2 py-1 rounded ' + (tagged?"bg-blue-600 text-white":"elevated text-slate-400") + '">' + tb.icon + ' ' + tb.name + '</button>';
  }
  html += '</div></div>';

  // Delete
  html += '<div class="pt-2 border-t border-c flex justify-between"><button onclick="deleteItem(\'' + id + '\')" class="text-red-400 hover:text-red-300 text-sm"><i class="fas fa-trash mr-1"></i>Delete</button><button onclick="toggleExpand(\'' + id + '\')" class="text-slate-400 hover:text-white text-sm"><i class="fas fa-chevron-up mr-1"></i>Collapse</button></div>';
  html += '</div>';
  return html;
}

function expandItem(id){
  // If already expanded, just refresh the content (don't collapse)
  if(expandedItemId === id){
    var container = document.getElementById("expand_" + id);
    if(container) container.innerHTML = buildExpandContent(id);
    return;
  }
  toggleExpand(id);
}

// ===== ITEM ACTIONS =====
function updateItemField(id, field, value){
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(!item) return;
  if(field==="type") item.type = value;
  else if(field==="status") item.status = value;
  else if(field==="priority"){if(!item.fields) item.fields={};item.fields.priority = value;}
  saveData();
}

function updateFieldValue(id, key, value){
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(!item) return;
  if(!item.fields) item.fields = {};
  var num = parseFloat(value);
  item.fields[key] = (!isNaN(num) && String(num)===value) ? num : value;
  saveData();
}

function updateCustomField(id, idx, value){
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(item && item.customFields && item.customFields[idx]) item.customFields[idx].value = value;
  saveData();
}

function removeCustomField(id, idx){
  if(!confirm("Remove this field?")) return;
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(item && item.customFields) item.customFields.splice(idx,1);
  saveData();expandItem(id);
}

function togglePin(id){
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(item) item.pinned = !item.pinned;
  saveData();render();
}

function toggleSubItem(id, idx){
  var item = state.items.find(function(it){return it.id===id;});
  if(item && item.subItems && item.subItems[idx]) item.subItems[idx].done = !item.subItems[idx].done;
  saveData();
}

function addSubItem(id){
  var input = document.getElementById("newSubItem_" + id);
  if(!input || !input.value.trim()) return;
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(!item) return;
  if(!item.subItems) item.subItems = [];
  item.subItems.push({id:generateId(),text:input.value.trim(),done:false,comments:[]});
  input.value = "";
  saveData();expandItem(id);
}

function removeSubItem(id, idx){
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(item && item.subItems) item.subItems.splice(idx,1);
  saveData();expandItem(id);
}

function addComment(id){
  var input = document.getElementById("newComment_" + id);
  if(!input || !input.value.trim()) return;
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(!item) return;
  if(!item.comments) item.comments = [];
  item.comments.unshift({id:generateId(),text:input.value.trim(),date:new Date().toISOString().slice(0,10)});
  input.value = "";
  saveData();expandItem(id);
}

function toggleTag(id, tabId){
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(!item) return;
  if(!item.tags) item.tags = [];
  var idx = item.tags.indexOf(tabId);
  if(idx > -1) item.tags.splice(idx,1);
  else item.tags.push(tabId);
  saveData();expandItem(id);
}

function deleteItem(id){
  if(!confirm("Delete this item permanently?")) return;
  saveUndo();
  state.items = state.items.filter(function(it){return it.id !== id;});
  saveData();closeModal();render();
}

function inlineEditTitle(id){
  var el = document.getElementById("itemTitle_" + id);
  if(!el) return;
  var item = state.items.find(function(it){return it.id===id;});
  if(!item) return;
  el.innerHTML = '<input id="titleInput_' + id + '" class="text-lg font-bold w-full" value="' + item.title.replace(/"/g,"&quot;") + '" onblur="saveTitleEdit(\'' + id + '\')" onkeydown="if(event.key===\'Enter\')this.blur()">';
  document.getElementById("titleInput_" + id).focus();
}

function saveTitleEdit(id){
  var input = document.getElementById("titleInput_" + id);
  if(!input) return;
  saveUndo();
  var item = state.items.find(function(it){return it.id===id;});
  if(item && input.value.trim()) item.title = input.value.trim();
  saveData();expandItem(id);
}

// ===== DRAG & DROP =====
var dragType = "";
var dragId = "";

document.addEventListener("dragstart", function(e){
  var el = e.target;
  if(el.dataset && el.dataset.tabcard){dragType="tabcard";dragId=el.dataset.tabcard;}
  else if(el.dataset && el.dataset.item){dragType="item";dragId=el.dataset.item;}
  else if(el.dataset && el.dataset.kpi){dragType="kpi";dragId=el.dataset.kpi;}
  else if(el.dataset && el.dataset.section){dragType="section";dragId=el.dataset.section;}
  else if(el.dataset && el.dataset.dashsection){dragType="dashsection";dragId=el.dataset.dashsection;}
  else return;
  e.dataTransfer.effectAllowed = "move";
  setTimeout(function(){el.style.opacity="0.4";},0);
});

document.addEventListener("dragend", function(e){
  e.target.style.opacity = "1";
  var overs = document.querySelectorAll(".drag-over");
  for(var i=0;i<overs.length;i++) overs[i].classList.remove("drag-over");
});

document.addEventListener("dragover", function(e){
  e.preventDefault();
  var target = findDragTarget(e.target);
  if(target) target.classList.add("drag-over");
});

document.addEventListener("dragleave", function(e){
  var target = findDragTarget(e.target);
  if(target) target.classList.remove("drag-over");
});

document.addEventListener("drop", function(e){
  e.preventDefault();
  var overs = document.querySelectorAll(".drag-over");
  for(var i=0;i<overs.length;i++) overs[i].classList.remove("drag-over");
  var target = findDragTarget(e.target);
  if(!target) return;
  if(dragType==="tabcard" && target.dataset.tabcard){
    reorderTabs(dragId, target.dataset.tabcard);
  }
  if(dragType==="kpi" && target.dataset.kpi){
    reorderKPIs(dragId, target.dataset.kpi);
  }
  if(dragType==="section" && target.dataset.section){
    reorderSections(dragId, target.dataset.section);
  }
  if(dragType==="item" && target.dataset.section){
    moveItemToSection(dragId, target.dataset.section);
  }
  if(dragType==="item" && target.dataset.item && target.dataset.item !== dragId){
    reorderItems(dragId, target.dataset.item);
  }
  if(dragType==="dashsection" && target.dataset.dashsection && target.dataset.dashsection !== dragId){
    swapDashSections();
  }
  dragType="";dragId="";
});

function findDragTarget(el){
  var max = 10;
  while(el && max > 0){
    if(el.dataset && (el.dataset.tabcard || el.dataset.kpi || el.dataset.section || el.dataset.item || el.dataset.dashsection)) return el;
    el = el.parentElement;
    max--;
  }
  return null;
}

function reorderTabs(fromId, toId){
  if(fromId===toId) return;
  saveUndo();
  var arr = state.mainTabs;
  var fromIdx = arr.findIndex(function(t){return t.id===fromId;});
  var toIdx = arr.findIndex(function(t){return t.id===toId;});
  if(fromIdx<0||toIdx<0) return;
  var item = arr.splice(fromIdx,1)[0];
  arr.splice(toIdx,0,item);
  saveData();render();
}

function reorderSections(fromId, toId){
  if(fromId===toId) return;
  saveUndo();
  var secs = state.sections.filter(function(s){return s.subTabId===activeSubTab;});
  var fromIdx = secs.findIndex(function(s){return s.id===fromId;});
  var toIdx = secs.findIndex(function(s){return s.id===toId;});
  if(fromIdx<0||toIdx<0) return;
  // Swap orders
  var tmp = secs[fromIdx].order;
  secs[fromIdx].order = secs[toIdx].order;
  secs[toIdx].order = tmp;
  saveData();render();
}

function reorderKPIs(fromId, toId){
  if(fromId===toId) return;
  saveUndo();
  var arr = state.kpiWidgets;
  var fromIdx = arr.findIndex(function(k){return k.id===fromId;});
  var toIdx = arr.findIndex(function(k){return k.id===toId;});
  if(fromIdx<0||toIdx<0) return;
  var item = arr.splice(fromIdx,1)[0];
  arr.splice(toIdx,0,item);
  saveData();render();
}

function enableSectionDrag(handle){
  var parent = handle.closest("[data-section]");
  if(parent) parent.setAttribute("draggable","true");
  setTimeout(function(){if(parent) parent.setAttribute("draggable","false");},3000);
}

function enableItemDrag(handle){
  var parent = handle.closest("[data-item]");
  if(parent) parent.setAttribute("draggable","true");
  setTimeout(function(){if(parent) parent.setAttribute("draggable","false");},3000);
}

function moveItemToSection(itemId, sectionId){
  saveUndo();
  var item = state.items.find(function(it){return it.id===itemId;});
  if(!item) return;
  item.section = sectionId;
  saveData();render();
}

function reorderItems(fromId, toId){
  saveUndo();
  var fromIdx = -1;
  var toIdx = -1;
  for(var i=0;i<state.items.length;i++){
    if(state.items[i].id===fromId) fromIdx = i;
    if(state.items[i].id===toId) toIdx = i;
  }
  if(fromIdx<0||toIdx<0) return;
  var item = state.items.splice(fromIdx,1)[0];
  state.items.splice(toIdx,0,item);
  saveData();render();
}

// ===== NOTIFICATIONS =====
function getNotifications(){
  var today = new Date().toISOString().slice(0,10);
  var soon = new Date(Date.now() + 7*86400000).toISOString().slice(0,10);
  var notifs = [];
  for(var i=0;i<state.items.length;i++){
    var it = state.items[i];
    if(it.status==="Done") continue;
    if(it.fields && it.fields.dueDate){
      if(it.fields.dueDate < today) notifs.push({type:"overdue",item:it});
      else if(it.fields.dueDate <= soon) notifs.push({type:"soon",item:it});
    }
  }
  return notifs;
}

function updateNotifBadge(){
  var notifs = getNotifications();
  var badge = document.getElementById("notifBadge");
  if(notifs.length > 0){badge.textContent = notifs.length;badge.classList.remove("hidden");}
  else{badge.classList.add("hidden");}
}

function showNotifications(){
  var notifs = getNotifications();
  var list = document.getElementById("notifList");
  var html = "";
  if(notifs.length === 0) html = '<p class="text-slate-400 text-sm">No notifications</p>';
  for(var i=0;i<notifs.length;i++){
    var n = notifs[i];
    var color = n.type==="overdue" ? "border-l-red-500" : "border-l-yellow-500";
    html += '<div class="surface rounded p-3 mb-2 border-l-4 ' + color + ' cursor-pointer" onclick="closeNotifPanel();expandItem(\'' + n.item.id + '\')"><div class="text-xs text-slate-400">' + (n.type==="overdue"?"OVERDUE":"Due Soon") + '</div><div class="text-sm font-medium">' + n.item.title + '</div><div class="text-xs text-slate-500">' + (n.item.fields.dueDate||"") + '</div></div>';
  }
  list.innerHTML = html;
  document.getElementById("notifPanel").classList.remove("hidden");
}

function closeNotifPanel(){document.getElementById("notifPanel").classList.add("hidden");}

// ===== PROFILES =====
function toggleProfileMenu(){
  var menu = document.getElementById("profileMenu");
  if(menu.classList.contains("hidden")){
    var html = '<div class="text-xs text-slate-400 mb-2 uppercase font-semibold">' + currentProfile + '</div>';
    html += '<button onclick="showEditDisplayName()" class="w-full text-left px-3 py-2 rounded hover:bg-slate-600 text-sm"><i class="fas fa-pen mr-2"></i>Edit Display Name</button>';
    html += '<button onclick="exportProfile()" class="w-full text-left px-3 py-2 rounded hover:bg-slate-600 text-sm"><i class="fas fa-download mr-2"></i>Export</button>';
    html += '<button onclick="importProfile()" class="w-full text-left px-3 py-2 rounded hover:bg-slate-600 text-sm"><i class="fas fa-upload mr-2"></i>Import</button>';
    html += '<button onclick="exportTemplate()" class="w-full text-left px-3 py-2 rounded hover:bg-slate-600 text-sm"><i class="fas fa-share-from-square mr-2"></i>Export as Template</button>';
    if(typeof doSignOut==="function" && currentUser) html += '<button onclick="doSignOut()" class="w-full text-left px-3 py-2 rounded hover:bg-slate-600 text-sm text-red-400"><i class="fas fa-sign-out-alt mr-2"></i>Sign Out</button>';
    menu.innerHTML = html;
    menu.classList.remove("hidden");
  } else {
    menu.classList.add("hidden");
  }
}

function showEditDisplayName(){
  document.getElementById("profileMenu").classList.add("hidden");
  var html = '<h2 class="text-lg font-bold mb-4"><i class="fas fa-pen mr-2 text-blue-400"></i>Edit Display Name</h2>';
  html += '<div class="space-y-3">';
  html += '<p class="text-xs text-slate-400">This name is shown in Roots and across the Harvest Your Passion site.</p>';
  html += '<input id="editDisplayName" value="' + currentProfile + '" class="w-full text-sm" placeholder="Your display name">';
  html += '<div class="flex gap-2"><button onclick="saveDisplayName()" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Save</button><button onclick="closeModal()" class="flex-1 elevated py-2 rounded text-sm">Cancel</button></div>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function saveDisplayName(){
  var name = document.getElementById("editDisplayName").value.trim();
  if(!name) return;
  currentProfile = name;
  document.getElementById("profileName").textContent = name;
  // Save to Supabase
  if(sb && currentProfileId){
    sb.from('roots_profiles').update({name: name}).eq('id', currentProfileId);
  }
  // Expose for the global nav to use
  window.userDisplayName = name;
  closeModal();
}

function switchProfile(name){
  currentProfile = name;
  var profiles = loadProfiles() || {};
  if(profiles[name]){
    state = profiles[name];
    if(profiles[name].sectionOrder) sectionOrder = profiles[name].sectionOrder;
  }
  activeMainTab = "all";activeSubTab = "";
  document.getElementById("profileName").textContent = name;
  document.getElementById("profileMenu").classList.add("hidden");
  render();updateNotifBadge();
}

function showNewProfile(){
  document.getElementById("profileMenu").classList.add("hidden");
  var html = '<h2 class="text-lg font-bold mb-4">New Profile</h2>';
  html += '<div class="space-y-3">';
  html += '<input id="newProfileName" placeholder="Profile name" class="w-full text-sm">';
  html += '<div class="text-xs text-slate-400">Template:</div>';
  html += '<div class="flex gap-2 flex-wrap"><button onclick="createProfile(\'blank\')" class="flex-1 elevated py-2 rounded text-sm hover:bg-slate-500">Blank</button><button onclick="createProfile(\'starter\')" class="flex-1 elevated py-2 rounded text-sm hover:bg-slate-500">Starter</button><button onclick="importTemplateForNewProfile()" class="flex-1 elevated py-2 rounded text-sm hover:bg-slate-500"><i class="fas fa-file-import mr-1"></i>Import Template</button></div>';
  html += '<button onclick="closeModal()" class="w-full elevated py-2 rounded text-sm">Cancel</button>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function createProfile(template){
  var name = document.getElementById("newProfileName").value.trim();
  if(!name) return;
  var profiles = loadProfiles() || {};
  if(template==="blank"){
    profiles[name] = {items:[],mainTabs:[],subTabs:[],sections:[],kpiWidgets:[],sectionOrder:["tabs","kpis"],settings:{}};
  } else {
    profiles[name] = {items:[],mainTabs:[{id:"personal",name:"Personal",icon:"\ud83d\udc64",color:"#3b82f6"}],subTabs:[{id:"personal_all",tabId:"personal",name:"All",mode:"auto",filter:{field:"all"}},{id:"personal_tasks",tabId:"personal",name:"Tasks",mode:"auto",filter:{field:"type",value:"Task"}}],sections:[],kpiWidgets:[],sectionOrder:["tabs","kpis"],settings:{}};
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  switchProfile(name);
  closeModal();
}

function exportProfile(){
  document.getElementById("profileMenu").classList.add("hidden");
  var data = JSON.stringify({profile:currentProfile,data:state},null,2);
  var blob = new Blob([data],{type:"application/json"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;a.download = "roots_" + currentProfile + ".json";a.click();
  URL.revokeObjectURL(url);
}

function importProfile(){
  document.getElementById("profileMenu").classList.add("hidden");
  var input = document.createElement("input");
  input.type = "file";input.accept = ".json";
  input.onchange = function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      try{
        var imported = JSON.parse(ev.target.result);
        if(imported.data){
          var profiles = loadProfiles() || {};
          var name = imported.profile || "Imported";
          profiles[name] = imported.data;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
          switchProfile(name);
        }
      }catch(err){alert("Invalid file");}
    };
    reader.readAsText(file);
  };
  input.click();
}

function exportTemplate(){
  document.getElementById("profileMenu").classList.add("hidden");
  var template = {};
  template.type = "roots_template";
  template.version = 1;
  template.exportedAt = new Date().toISOString();
  // Tabs: name, icon, color, order
  template.mainTabs = [];
  for(var i=0;i<state.mainTabs.length;i++){
    var t = state.mainTabs[i];
    template.mainTabs.push({id:t.id,name:t.name,icon:t.icon||"",color:t.color||""});
  }
  // Sub-tabs: config without item data
  template.subTabs = [];
  for(var i=0;i<state.subTabs.length;i++){
    var st = state.subTabs[i];
    template.subTabs.push({id:st.id,tabId:st.tabId,name:st.name,mode:st.mode||"auto",filter:st.filter||{}});
  }
  // Sections: structure + aggregation
  template.sections = [];
  for(var i=0;i<state.sections.length;i++){
    var sec = state.sections[i];
    template.sections.push({id:sec.id,subTabId:sec.subTabId,name:sec.name,aggField:sec.aggField||"",aggOp:sec.aggOp||"",order:sec.order||0});
  }
  // KPI widgets: config only
  template.kpiWidgets = [];
  for(var i=0;i<state.kpiWidgets.length;i++){
    var k = state.kpiWidgets[i];
    template.kpiWidgets.push({id:k.id,label:k.label,type:k.type||"counter",filter:k.filter||{}});
  }
  // Custom field definitions (unique keys used across all items)
  var fieldNames = getAllFieldNames();
  template.customFieldDefinitions = fieldNames;
  // Section order
  template.sectionOrder = sectionOrder ? sectionOrder.slice() : ["tabs","kpis"];
  // Export
  var data = JSON.stringify(template, null, 2);
  var blob = new Blob([data],{type:"application/json"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "roots_template_" + currentProfile.toLowerCase().replace(/[^a-z0-9]/g,"_") + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

function importTemplateForNewProfile(){
  var name = document.getElementById("newProfileName").value.trim();
  if(!name){alert("Enter a profile name first");return;}
  var input = document.createElement("input");
  input.type = "file";input.accept = ".json";
  input.onchange = function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      try{
        var tmpl = JSON.parse(ev.target.result);
        if(tmpl.type !== "roots_template"){alert("Not a valid Roots template file");return;}
        var profiles = loadProfiles() || {};
        profiles[name] = {items:[],mainTabs:tmpl.mainTabs||[],subTabs:tmpl.subTabs||[],sections:tmpl.sections||[],kpiWidgets:tmpl.kpiWidgets||[],sectionOrder:tmpl.sectionOrder||["tabs","kpis"],settings:{}};
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        switchProfile(name);
        closeModal();
      }catch(err){alert("Invalid template file");}
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== PASSWORD PROTECTION =====
function hashPassword(pass){
  // Simple SHA-256 using Web Crypto would be async; use a basic hash for localStorage
  // This is a djb2 variant — not cryptographic but sufficient for local lock
  var hash = 5381;
  for(var i=0;i<pass.length;i++){
    hash = ((hash << 5) + hash) + pass.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit int
  }
  return "h_" + Math.abs(hash).toString(36);
}

function showLockScreen(){
  document.getElementById("content").innerHTML = '';
  document.getElementById("mainTabNav").innerHTML = '';
  document.getElementById("subTabNav").innerHTML = '';
  document.getElementById("filterBar").style.display = 'none';
  var html = '<div class="flex flex-col items-center justify-center min-h-[60vh]">';
  html += '<div class="surface rounded-xl p-8 border border-c w-full max-w-sm text-center">';
  html += '<i class="fas fa-lock text-4xl text-blue-400 mb-4"></i>';
  html += '<h2 class="text-xl font-bold mb-4">Roots is Locked</h2>';
  html += '<input id="lockInput" type="password" placeholder="Enter password" class="w-full text-sm mb-3" onkeydown="if(event.key===\'Enter\')unlockApp()">';
  html += '<button onclick="unlockApp()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-medium text-sm">Unlock</button>';
  html += '<p id="lockError" class="text-red-400 text-xs mt-2 hidden">Incorrect password</p>';
  html += '</div></div>';
  document.getElementById("content").innerHTML = html;
  setTimeout(function(){var el=document.getElementById("lockInput");if(el)el.focus();},100);
}

function unlockApp(){
  var input = document.getElementById("lockInput").value;
  var stored = localStorage.getItem("roots_lock_hash");
  if(hashPassword(input) === stored){
    document.getElementById("lockError").classList.add("hidden");
    document.getElementById("filterBar").style.display = '';
    doInitApp();
  } else {
    document.getElementById("lockError").classList.remove("hidden");
  }
}

function showPasswordSettings(){
  document.getElementById("profileMenu").classList.add("hidden");
  var hasPass = localStorage.getItem("roots_lock_hash");
  var html = '<h2 class="text-lg font-bold mb-4"><i class="fas fa-lock mr-2"></i>Password Protection</h2>';
  html += '<div class="space-y-3">';
  if(hasPass){
    html += '<p class="text-sm text-slate-400">Password is currently set.</p>';
    html += '<input id="removePassInput" type="password" placeholder="Current password to remove" class="w-full text-sm">';
    html += '<button onclick="removePassword()" class="w-full bg-red-700 hover:bg-red-600 text-white py-2 rounded text-sm">Remove Password</button>';
  } else {
    html += '<input id="setPassInput" type="password" placeholder="Set a password" class="w-full text-sm">';
    html += '<input id="confirmPassInput" type="password" placeholder="Confirm password" class="w-full text-sm">';
    html += '<button onclick="setPassword()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm">Set Password</button>';
  }
  html += '<button onclick="closeModal()" class="w-full elevated py-2 rounded text-sm">Cancel</button>';
  html += '</div>';
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}

function setPassword(){
  var pass = document.getElementById("setPassInput").value;
  var confirm = document.getElementById("confirmPassInput").value;
  if(!pass){alert("Enter a password");return;}
  if(pass !== confirm){alert("Passwords do not match");return;}
  localStorage.setItem("roots_lock_hash", hashPassword(pass));
  closeModal();
  alert("Password set! App will be locked on next load.");
}

function removePassword(){
  var input = document.getElementById("removePassInput").value;
  var stored = localStorage.getItem("roots_lock_hash");
  if(hashPassword(input) === stored){
    localStorage.removeItem("roots_lock_hash");
    closeModal();
    alert("Password removed.");
  } else {
    alert("Incorrect password.");
  }
}

// ===== UTILITIES =====
function closeModal(){document.getElementById("modal").classList.add("hidden");}

function toggleMobileNav(){
  var nav = document.getElementById("mainTabNav");
  nav.classList.toggle("show");
  nav.style.flexDirection = "column";
}

// ===== INIT =====
// initApp() is called from index.html after all scripts load
