#!/usr/bin/env python3
# Migrate Leo's roots_* data -> spec `items`/`tabs` tables (single workspace per user).
# Idempotent: re-running deletes prior migrated rows for this user first.
# Uses Supabase REST with the service-role key (bypasses RLS).
import json, glob, os, uuid, urllib.request, urllib.parse

import os
SVC = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BASE = "https://rjjhuugtwwimsijnmvwy.supabase.co/rest/v1"
OWNER = "24ff4713-ccae-46b9-9212-14f96c053eb8"  # leandro.castillo.1994@gmail.com

bk = sorted(glob.glob("/Users/leandrocastillo/Desktop/Life Operating System/roots_backup_*"))[-1]
items = json.load(open(os.path.join(bk, "roots_items.json")))
print("source items:", len(items), "from", bk)

def req(method, path, body=None, headers=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("apikey", SVC); r.add_header("Authorization", "Bearer " + SVC)
    r.add_header("Content-Type", "application/json")
    if headers:
        for k, v in headers.items(): r.add_header(k, v)
    try:
        with urllib.request.urlopen(r) as resp:
            txt = resp.read().decode()
            return resp.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# --- idempotency: remove any prior migration for this user ---
# (fresh spec tables; this user has no other items/tabs yet)
print("cleanup:", req("DELETE", "/items?user_id=eq.%s&fields->>_migrated=eq.roots" % OWNER, headers={"Prefer": "return=minimal"})[0])
print("cleanup tabs:", req("DELETE", "/tabs?user_id=eq.%s" % OWNER, headers={"Prefer": "return=minimal"})[0])

# --- create tabs ---
TAB_DEFS = [
    ("personal",   "Personal",    "\U0001F3E0", "#3b82f6", 0),
    ("westvalley", "West Valley",  "\U0001FAB5", "#f59e0b", 1),
    ("harvest",    "Harvest",      "\U0001F331", "#22c55e", 2),
    ("tacos",      "Tacos",        "\U0001F32E", "#ef4444", 3),
]
tab_map = {}
for key, name, icon, color, order in TAB_DEFS:
    tid = str(uuid.uuid4())
    status, resp = req("POST", "/tabs", {
        "id": tid, "user_id": OWNER, "name": name, "icon": icon,
        "color": color, "order_index": order
    }, headers={"Prefer": "return=representation"})
    if status not in (200, 201):
        print("TAB FAIL", name, status, resp); raise SystemExit(1)
    tab_map[key] = tid
    print("  tab created:", name, "->", tid)

# --- build item rows ---
rows = []
for it in items:
    fields = dict(it.get("fields") or {})
    fields["_migrated"] = "roots"
    fields["_legacy_id"] = it["id"]
    if it.get("tags"):
        fields["_legacy_tags"] = it["tags"]
    if it.get("section"):
        fields["_legacy_section"] = it["section"]
    rows.append({
        "id": str(uuid.uuid4()),
        "user_id": OWNER,
        "tab_id": tab_map.get(it.get("tab")),
        "section_id": None,
        "title": it["title"],
        "type": it.get("type") or "Task",
        "status": it.get("status") or "Active",
        "fields": fields,
        "sub_items": it.get("sub_items") or [],
        "comments": it.get("comments") or [],
        "custom_fields": it.get("custom_fields") or [],
        "pinned": bool(it.get("pinned")),
        "created_at": it.get("created_at"),
    })

# --- bulk insert items ---
status, resp = req("POST", "/items", rows, headers={"Prefer": "return=minimal"})
if status not in (200, 201, 204):
    print("ITEMS FAIL", status, resp); raise SystemExit(1)
print("inserted", len(rows), "items, status", status)

# --- verify ---
status, resp = req("GET", "/items?select=tab_id&user_id=eq.%s&fields->>_migrated=eq.roots" % OWNER,
                   headers={"Prefer": "count=exact", "Range": "0-0"})
print("verify GET status", status)
