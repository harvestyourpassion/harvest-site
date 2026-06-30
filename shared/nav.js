// shared/nav.js - Global navigation bar for Harvest Your Passion
// Injects nav at top of page. Shows auth state + profile dropdown.
// Usage: <script src="/shared/nav.js"></script> (works in head or body)
// Dependencies: /shared/supabase.js must be loaded first

function injectHarvestNav() {
    if (document.getElementById('harvest-global-nav')) return;

    var path = window.location.pathname;
    var section = '';
    if (path.indexOf('/roots') === 0) section = 'roots';
    else if (path.indexOf('/coaching') === 0) section = 'coaching';
    else if (path.indexOf('/blog') === 0) section = 'blog';
    else if (path.indexOf('/store') === 0) section = 'store';
    else if (path.indexOf('/about') === 0) section = 'about';
    else if (path.indexOf('/contact') === 0) section = 'contact';
    else if (path === '/') section = 'home';

    var sectionLabels = { roots: 'Roots', coaching: 'Coaching', blog: 'Blog', store: 'Store', about: 'About' };
    var sectionColors = { roots: '#3b82f6', coaching: '#22c55e', blog: '#f97316', store: '#a855f7', about: '#64748b' };
    var sectionLabel = sectionLabels[section] || '';
    var sectionColor = sectionColors[section] || '#4ade80';

    function lc(s) { return section === s ? '#4ade80' : '#d1d5db'; }

    var navHTML = '<nav id="harvest-global-nav" style="border-bottom:1px solid #475569;background:#1e293b;position:sticky;top:0;z-index:9999;font-family:system-ui,-apple-system,sans-serif;">' +
        '<div style="max-width:1280px;margin:0 auto;padding:0 1rem;display:flex;justify-content:space-between;align-items:center;height:52px;">' +
        '<a href="/" style="display:flex;align-items:center;gap:0.5rem;text-decoration:none;">' +
            '<span style="font-size:1.25rem;">\ud83c\udf31</span>' +
            '<span style="font-size:1rem;font-weight:700;color:#e2e8f0;">Harvest Your Passion</span>' +
            (section && section !== 'home' ? '<span style="color:#64748b;margin:0 0.3rem;font-weight:300;">&mdash;</span><span style="font-size:1rem;font-weight:700;color:' + sectionColor + ';">' + sectionLabel + '</span>' : '') +
        '</a>' +
        '<div style="display:flex;align-items:center;gap:1.25rem;font-size:0.8rem;">' +
            '<a href="/" style="text-decoration:none;color:' + lc('home') + ';">Home</a>' +
            '<a href="/coaching/" style="text-decoration:none;color:' + lc('coaching') + ';">Coaching</a>' +
            '<a href="/roots/" style="text-decoration:none;color:' + lc('roots') + ';">Roots</a>' +
            '<a href="/blog/" style="text-decoration:none;color:' + lc('blog') + ';">Blog</a>' +
            '<a href="/store/" style="text-decoration:none;color:' + lc('store') + ';">Store</a>' +
            '<a href="/about/" style="text-decoration:none;color:' + lc('about') + ';">About</a>' +
            '<a href="/contact/" style="text-decoration:none;color:' + lc('contact') + ';">Contact</a>' +
            '<span id="harvest-nav-client"></span>' +
            '<span id="harvest-nav-auth" style="position:relative;"></span>' +
        '</div>' +
        '</div>' +
        '</nav>' +
        '<style>' +
        '#harvest-global-nav a:hover{color:#4ade80!important}' +
        ':root{--harvest-nav-max-width:1280px;--harvest-nav-padding:1rem;}' +
        '.harvest-container{max-width:var(--harvest-nav-max-width);margin:0 auto;padding:0 var(--harvest-nav-padding);}' +
        '#harvest-profile-dropdown{display:none;position:absolute;top:100%;right:0;margin-top:0.5rem;background:#1e293b;border:1px solid #475569;border-radius:0.5rem;padding:0.75rem 1rem;min-width:220px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10000;}' +
        '#harvest-profile-dropdown.open{display:block;}' +
        '#harvest-profile-dropdown .profile-name{color:#e2e8f0;font-size:0.85rem;font-weight:600;margin-bottom:0.25rem;}' +
        '#harvest-profile-dropdown .profile-email{color:#9ca3af;font-size:0.7rem;margin-bottom:0.75rem;}' +
        '#harvest-profile-dropdown .profile-action{display:block;width:100%;text-align:left;background:none;border:none;color:#d1d5db;font-size:0.75rem;padding:0.4rem 0;cursor:pointer;}' +
        '#harvest-profile-dropdown .profile-action:hover{color:#4ade80;}' +
        '#harvest-profile-dropdown .profile-divider{border-top:1px solid #475569;margin:0.5rem 0;}' +
        '</style>';

    if (document.body) {
        var wrapper = document.createElement('div');
        wrapper.innerHTML = navHTML;
        while (wrapper.firstChild) {
            document.body.insertBefore(wrapper.firstChild, document.body.children[0] || null);
        }
        updateNavAuth();
    }
}

// Global display name — single source of truth across all pages
// Priority: Supabase roots_profiles.name > Google metadata > email
window.harvestDisplayName = null;

function getDisplayName(user) {
    // If we already loaded from Supabase, use that
    if (window.harvestDisplayName) return window.harvestDisplayName;
    // Fallback to window.userDisplayName (set by Roots legacy)
    if (window.userDisplayName) return window.userDisplayName;
    // Fallback to Google metadata
    if (user && user.user_metadata && user.user_metadata.full_name) return user.user_metadata.full_name;
    // Fallback to email prefix
    if (user && user.email) return user.email.split('@')[0];
    return 'User';
}

// Load saved name from Supabase roots_profiles
function loadSavedName(userId) {
    var client = window.getSb ? window.getSb() : null;
    if (!client || !userId) return;

    client.from('roots_profiles')
        .select('name')
        .eq('user_id', userId)
        .maybeSingle()
        .then(function(result) {
            if (result.data && result.data.name) {
                window.harvestDisplayName = result.data.name;
                // Also set window.userDisplayName so Roots picks it up
                window.userDisplayName = result.data.name;
                updateNavAuth();
            }
        });
}

function toggleProfileDropdown() {
    var dd = document.getElementById('harvest-profile-dropdown');
    if (dd) dd.classList.toggle('open');
}

function closeProfileDropdown() {
    var dd = document.getElementById('harvest-profile-dropdown');
    if (dd) dd.classList.remove('open');
}

function editDisplayName() {
    var currentName = getDisplayName(window._harvestCurrentUser);
    var newName = prompt('Edit your display name:', currentName);
    if (newName && newName.trim() && newName !== currentName) {
        newName = newName.trim();
        // Update all name sources
        window.harvestDisplayName = newName;
        window.userDisplayName = newName;

        // Save to Supabase roots_profiles
        var client = window.getSb ? window.getSb() : null;
        if (client && window._harvestCurrentUser) {
            var userId = window._harvestCurrentUser.id;
            // Update existing profile, or insert if none exists
            client.from('roots_profiles')
                .update({ name: newName })
                .eq('user_id', userId)
                .select()
                .then(function(result) {
                    if (result.data && result.data.length === 0) {
                        // No profile row exists yet - create one
                        client.from('roots_profiles')
                            .insert({ user_id: userId, name: newName })
                            .then(function() {
                                updateNavAuth();
                                closeProfileDropdown();
                            });
                    } else {
                        updateNavAuth();
                        closeProfileDropdown();
                    }
                });
        } else {
            updateNavAuth();
            closeProfileDropdown();
        }
    }
}

function updateNavAuth() {
    var el = document.getElementById('harvest-nav-auth');
    if (!el) return;

    if (window.getSession) {
        window.getSession().then(function(session) {
            if (session) {
                var user = session.user;
                window._harvestCurrentUser = user;

                // Load saved name from DB (only once)
                if (!window._harvestNameLoaded) {
                    window._harvestNameLoaded = true;
                    loadSavedName(user.id);
                }

                var name = getDisplayName(user);
                var email = user.email || '';

                el.innerHTML = '<div style="position:relative;display:inline-block;">' +
                    '<button onclick="toggleProfileDropdown()" style="background:#334155;color:#e2e8f0;padding:0.3rem 0.7rem;border-radius:9999px;font-size:0.75rem;cursor:pointer;border:1px solid #475569;">' + name + ' \u25BE</button>' +
                    '<div id="harvest-profile-dropdown">' +
                        '<div class="profile-name">' + name + '</div>' +
                        '<div class="profile-email">' + email + '</div>' +
                        '<div class="profile-divider"></div>' +
                        '<button class="profile-action" onclick="editDisplayName()">\u270F\uFE0F Edit Name</button>' +
                        '<button class="profile-action" onclick="signOut().then(function(){location.reload();})">\ud83d\udeaa Sign Out</button>' +
                    '</div>' +
                '</div>';

                // Check coaching client
                if (user.id && window.isCoachingClient) {
                    window.isCoachingClient(user.id).then(function(isClient) {
                        var clientEl = document.getElementById('harvest-nav-client');
                        if (isClient && clientEl) {
                            clientEl.innerHTML = '<a href="/coaching/sessions" style="text-decoration:none;color:#22c55e;font-size:0.75rem;font-weight:500;">My Sessions</a>';
                        }
                    });
                }
            } else {
                el.innerHTML = '<button onclick="signIn()" style="background:#22c55e;color:white;padding:0.3rem 0.85rem;border-radius:9999px;font-size:0.75rem;font-weight:500;cursor:pointer;border:none;">Log In</button>';
            }
        });
    } else {
        el.innerHTML = '<button onclick="if(window.signIn)signIn();" style="background:#22c55e;color:white;padding:0.3rem 0.85rem;border-radius:9999px;font-size:0.75rem;font-weight:500;cursor:pointer;border:none;">Log In</button>';
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('#harvest-nav-auth')) {
        closeProfileDropdown();
    }
});

// Inject when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHarvestNav);
} else {
    injectHarvestNav();
}

// Listen for auth changes
setTimeout(function() {
    if (window.getSb && window.getSb()) {
        window.getSb().auth.onAuthStateChange(function() {
            window._harvestNameLoaded = false; // reload name on auth change
            updateNavAuth();
        });
    }
}, 300);

// Sync: if Roots (or anything) changes userDisplayName, update nav
var _lastKnownName = undefined;
setInterval(function() {
    var current = window.userDisplayName || window.harvestDisplayName;
    if (current !== _lastKnownName) {
        _lastKnownName = current;
        if (current) window.harvestDisplayName = current;
        updateNavAuth();
    }
}, 1000);
