// shared/nav.js - Global navigation bar for Harvest Your Passion
// Injects nav at top of page. Shows auth state + role-aware links.
// Usage: <script src="/shared/nav.js"></script> (works in head or body)
// Dependencies: /shared/supabase.js must be loaded first

function injectHarvestNav() {
    if (document.getElementById('harvest-global-nav')) return; // already injected

    var path = window.location.pathname;
    var section = '';
    if (path.indexOf('/roots') === 0) section = 'roots';
    else if (path.indexOf('/coaching') === 0) section = 'coaching';
    else if (path.indexOf('/blog') === 0) section = 'blog';
    else if (path.indexOf('/store') === 0) section = 'store';
    else if (path.indexOf('/about') === 0) section = 'about';
    else if (path === '/') section = 'home';

    function linkColor(s) {
        return section === s ? '#4ade80' : '#d1d5db';
    }

    var navHTML = '<nav id="harvest-global-nav" style="border-bottom:1px solid #475569;background:#1e293b;position:sticky;top:0;z-index:9999;font-family:system-ui,-apple-system,sans-serif;">' +
        '<div style="max-width:1280px;margin:0 auto;padding:0 1rem;display:flex;justify-content:space-between;align-items:center;height:52px;">' +
        '<a href="/" style="display:flex;align-items:center;gap:0.5rem;text-decoration:none;">' +
            '<span style="font-size:1.25rem;">\ud83c\udf31</span>' +
            '<span style="font-size:1rem;font-weight:700;color:#22c55e;">Harvest Your Passion</span>' +
        '</a>' +
        '<div style="display:flex;align-items:center;gap:1.25rem;font-size:0.8rem;">' +
            '<a href="/" style="text-decoration:none;color:' + linkColor('home') + ';">Home</a>' +
            '<a href="/coaching/" style="text-decoration:none;color:' + linkColor('coaching') + ';">Coaching</a>' +
            '<a href="/roots/" style="text-decoration:none;color:' + linkColor('roots') + ';">Roots</a>' +
            '<a href="/blog/" style="text-decoration:none;color:' + linkColor('blog') + ';">Blog</a>' +
            '<a href="/store/" style="text-decoration:none;color:' + linkColor('store') + ';">Store</a>' +
            '<a href="/about/" style="text-decoration:none;color:' + linkColor('about') + ';">About</a>' +
            '<span id="harvest-nav-auth"></span>' +
            '<span id="harvest-nav-client"></span>' +
        '</div>' +
        '</div>' +
        '</nav>';

    // Inject at top of body
    if (document.body) {
        var wrapper = document.createElement('div');
        wrapper.innerHTML = navHTML;
        document.body.insertBefore(wrapper.firstChild, document.body.firstChild);
        updateNavAuth();
    }
}

function updateNavAuth() {
    var el = document.getElementById('harvest-nav-auth');
    if (!el) return;

    if (window.getSession) {
        window.getSession().then(function(session) {
            if (session) {
                var user = session.user;
                var name = (user.user_metadata && user.user_metadata.full_name) || (user.email ? user.email.split('@')[0] : 'User');
                el.innerHTML = '<span style="color:#9ca3af;font-size:0.75rem;">Hi, ' + name + '</span> ' +
                    '<button onclick="signOut().then(function(){location.reload();})" style="border:1px solid #475569;color:#e2e8f0;padding:0.2rem 0.6rem;border-radius:9999px;font-size:0.7rem;cursor:pointer;background:transparent;margin-left:0.4rem;">Sign Out</button>';

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
                el.innerHTML = '<button onclick="signIn()" style="background:#22c55e;color:white;padding:0.25rem 0.85rem;border-radius:9999px;font-size:0.75rem;font-weight:500;cursor:pointer;border:none;">Log In</button>';
            }
        });
    } else {
        // No supabase yet - show login button that will init on click
        el.innerHTML = '<button onclick="if(window.signIn)signIn();else alert(\u0027Auth loading...\u0027);" style="background:#22c55e;color:white;padding:0.25rem 0.85rem;border-radius:9999px;font-size:0.75rem;font-weight:500;cursor:pointer;border:none;">Log In</button>';
    }
}

// Inject when DOM is ready (handles both head and body placement)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHarvestNav);
} else {
    // DOM already ready
    injectHarvestNav();
}

// Listen for auth changes to update nav
if (window.getSb && window.getSb()) {
    window.getSb().auth.onAuthStateChange(function() {
        updateNavAuth();
    });
} else {
    // Retry after supabase initializes
    setTimeout(function() {
        if (window.getSb && window.getSb()) {
            window.getSb().auth.onAuthStateChange(function() {
                updateNavAuth();
            });
        }
    }, 300);
}
