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
    else if (path === '/') section = 'home';

    function lc(s) { return section === s ? '#4ade80' : '#d1d5db'; }

    var navHTML = '<nav id="harvest-global-nav" style="border-bottom:1px solid #475569;background:#1e293b;position:sticky;top:0;z-index:9999;font-family:system-ui,-apple-system,sans-serif;">' +
        '<div style="max-width:1280px;margin:0 auto;padding:0 1rem;display:flex;justify-content:space-between;align-items:center;height:52px;">' +
        '<a href="/" style="display:flex;align-items:center;gap:0.5rem;text-decoration:none;">' +
            '<span style="font-size:1.25rem;">\ud83c\udf31</span>' +
            '<span style="font-size:1rem;font-weight:700;color:#22c55e;">Harvest Your Passion</span>' +
        '</a>' +
        '<div style="display:flex;align-items:center;gap:1.25rem;font-size:0.8rem;">' +
            '<a href="/" style="text-decoration:none;color:' + lc('home') + ';">Home</a>' +
            '<a href="/coaching/" style="text-decoration:none;color:' + lc('coaching') + ';">Coaching</a>' +
            '<a href="/roots/" style="text-decoration:none;color:' + lc('roots') + ';">Roots</a>' +
            '<a href="/blog/" style="text-decoration:none;color:' + lc('blog') + ';">Blog</a>' +
            '<a href="/store/" style="text-decoration:none;color:' + lc('store') + ';">Store</a>' +
            '<a href="/about/" style="text-decoration:none;color:' + lc('about') + ';">About</a>' +
            '<span id="harvest-nav-client"></span>' +
            '<span id="harvest-nav-auth" style="position:relative;"></span>' +
        '</div>' +
        '</div>' +
        '</nav>' +
        '<style>' +
        '#harvest-global-nav a:hover{color:#4ade80!important}' +
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

function getDisplayName(user) {
    // Priority: window.userDisplayName (set by Roots) > Google metadata > email
    if (window.userDisplayName) return window.userDisplayName;
    if (user && user.user_metadata && user.user_metadata.full_name) return user.user_metadata.full_name;
    if (user && user.email) return user.email.split('@')[0];
    return 'User';
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
        window.userDisplayName = newName;
        // Save to Supabase roots_profiles
        var client = window.getSb ? window.getSb() : null;
        if (client && window._harvestCurrentUser) {
            client.from('roots_profiles')
                .update({ name: newName })
                .eq('user_id', window._harvestCurrentUser.id)
                .then(function() {
                    updateNavAuth();
                    closeProfileDropdown();
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
            updateNavAuth();
        });
    }
}, 300);

// Re-update nav when Roots sets userDisplayName
var _origUserDisplayName = undefined;
setInterval(function() {
    if (window.userDisplayName !== _origUserDisplayName) {
        _origUserDisplayName = window.userDisplayName;
        updateNavAuth();
    }
}, 1000);
