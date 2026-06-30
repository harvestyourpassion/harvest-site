// shared/supabase.js - Supabase client initialization
// Provides window.sb via lazy init (works regardless of script load order)
// Usage: <script src="/shared/supabase.js"></script>

// Lazy initializer - creates client on first access
window.getSb = function() {
    if (!window.sb && window.supabase) {
        window.sb = window.supabase.createClient(
            'https://rjjhuugtwwimsijnmvwy.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqamh1dWd0d3dpbXNpam5tdnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjE5MDksImV4cCI6MjA5ODA5NzkwOX0.1Dl5E5yD_hQOR1CWNAgORqRRuV88jPG6NkY7IfWacO0'
        );
    }
    return window.sb;
};

// Try immediate init (works if CDN loaded first)
window.getSb();

// Fallback: retry after DOM is ready (catches slow CDN loads)
if (!window.sb) {
    document.addEventListener('DOMContentLoaded', function() {
        window.getSb();
    });
    // Also try after a short delay as final fallback
    setTimeout(function() { window.getSb(); }, 100);
}

// Helper: get current session
window.getSession = function() {
    var client = window.getSb();
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function(result) {
        return result.data.session;
    });
};

// Helper: get current user
window.getUser = function() {
    return window.getSession().then(function(session) {
        return session ? session.user : null;
    });
};

// Helper: sign in with Google
window.signIn = function(redirectTo) {
    var client = window.getSb();
    if (!client) return Promise.resolve(null);
    return client.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectTo || window.location.origin + window.location.pathname,
            // Always show the Google account chooser — never silently reuse the
            // last-used account.
            queryParams: { prompt: 'select_account' }
        }
    });
};

// Helper: sign out
window.signOut = function() {
    var client = window.getSb();
    if (!client) return Promise.resolve(null);
    return client.auth.signOut();
};

// Helper: require auth - redirects to login if not authenticated
window.requireAuth = function(redirectAfterLogin) {
    return window.getSession().then(function(session) {
        if (!session) {
            var redirect = redirectAfterLogin || window.location.pathname;
            window.signIn(window.location.origin + redirect);
            return null;
        }
        return session;
    });
};

// Helper: check if user is a coaching client
window.isCoachingClient = function(userId) {
    var client = window.getSb();
    if (!client) return Promise.resolve(false);
    return client
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
        .then(function(result) {
            return result.data !== null;
        });
};
