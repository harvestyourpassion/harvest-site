// shared/nav.js — Global navigation bar for Harvest Your Passion
// Injects nav at top of page. Shows auth state + role-aware links.
// Usage: <script src="/shared/nav.js"></script> (after supabase.js)
// Dependencies: /shared/supabase.js must be loaded first

(function() {
    // Determine current section for highlighting
    var path = window.location.pathname;
    var section = '';
    if (path.startsWith('/roots')) section = 'roots';
    else if (path.startsWith('/coaching')) section = 'coaching';
    else if (path.startsWith('/blog')) section = 'blog';
    else if (path.startsWith('/store')) section = 'store';
    else if (path.startsWith('/about')) section = 'about';
    else if (path === '/') section = 'home';

    function activeClass(s) {
        return section === s ? 'text-green-400' : 'text-gray-300 hover:text-green-400';
    }

    // Build nav HTML
    var navHTML = '<nav id="harvest-global-nav" style="border-bottom:1px solid #475569;background:rgba(30,41,59,0.95);backdrop-filter:blur(8px);position:sticky;top:0;z-index:9999;font-family:system-ui,-apple-system,sans-serif;">' +
        '<div style="max-width:1280px;margin:0 auto;padding:0 1rem;display:flex;justify-content:space-between;align-items:center;height:56px;">' +
        '<a href="/" style="display:flex;align-items:center;gap:0.5rem;text-decoration:none;">' +
            '<span style="font-size:1.5rem;">🌱</span>' +
            '<span style="font-size:1.1rem;font-weight:700;color:#22c55e;">Harvest Your Passion</span>' +
        '</a>' +
        '<div style="display:flex;align-items:center;gap:1.5rem;font-size:0.875rem;">' +
            '<a href="/" class="' + activeClass('home') + '" style="text-decoration:none;color:' + (section === 'home' ? '#4ade80' : '#d1d5db') + ';transition:color 0.2s;">Home</a>' +
            '<a href="/coaching/" style="text-decoration:none;color:' + (section === 'coaching' ? '#4ade80' : '#d1d5db') + ';transition:color 0.2s;">Coaching</a>' +
            '<a href="/roots/" style="text-decoration:none;color:' + (section === 'roots' ? '#4ade80' : '#d1d5db') + ';transition:color 0.2s;">Roots</a>' +
            '<a href="/blog/" style="text-decoration:none;color:' + (section === 'blog' ? '#4ade80' : '#d1d5db') + ';transition:color 0.2s;">Blog</a>' +
            '<a href="/store/" style="text-decoration:none;color:' + (section === 'store' ? '#4ade80' : '#d1d5db') + ';transition:color 0.2s;">Store</a>' +
            '<a href="/about/" style="text-decoration:none;color:' + (section === 'about' ? '#4ade80' : '#d1d5db') + ';transition:color 0.2s;">About</a>' +
            '<span id="harvest-nav-auth" style="margin-left:0.5rem;"></span>' +
            '<span id="harvest-nav-client" style=""></span>' +
        '</div>' +
        '</div>' +
        '</nav>';

    // Inject at top of body
    var wrapper = document.createElement('div');
    wrapper.innerHTML = navHTML;
    document.body.insertBefore(wrapper.firstChild, document.body.firstChild);

    // Update auth state
    function updateNavAuth(session) {
        var el = document.getElementById('harvest-nav-auth');
        if (!el) return;
        if (session) {
            var user = session.user;
            var name = (user.user_metadata && user.user_metadata.full_name) || (user.email ? user.email.split('@')[0] : 'User');
            el.innerHTML = '<span style="color:#9ca3af;font-size:0.8rem;">Hi, ' + name + '</span> ' +
                '<button onclick="signOut().then(function(){location.reload();})" style="border:1px solid #475569;color:#e2e8f0;padding:0.25rem 0.75rem;border-radius:9999px;font-size:0.75rem;cursor:pointer;background:transparent;margin-left:0.5rem;">Sign Out</button>';
            
            // Check if coaching client — show "My Sessions" link
            if (user.id && window.isCoachingClient) {
                window.isCoachingClient(user.id).then(function(isClient) {
                    var clientEl = document.getElementById('harvest-nav-client');
                    if (isClient && clientEl) {
                        clientEl.innerHTML = '<a href="/coaching/sessions" style="text-decoration:none;color:#22c55e;font-size:0.8rem;font-weight:500;">My Sessions</a>';
                    }
                });
            }
        } else {
            el.innerHTML = '<button onclick="signIn()" style="background:#22c55e;color:white;padding:0.3rem 1rem;border-radius:9999px;font-size:0.8rem;font-weight:500;cursor:pointer;border:none;">Log In</button>';
        }
    }

    // Init auth display
    if (window.getSession) {
        window.getSession().then(function(session) {
            updateNavAuth(session);
        });
        // Listen for auth changes
        window.sb.auth.onAuthStateChange(function(_event, session) {
            updateNavAuth(session);
        });
    }
})();
