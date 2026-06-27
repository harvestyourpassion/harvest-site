// shared/supabase.js - Supabase client initialization
// All pages import this. Single source of truth for auth + DB access.
// Usage: <script src="/shared/supabase.js"></script>
// Then use: window.sb (the initialized Supabase client)

// Guard: only init once, and only if the Supabase library is loaded
if (window.supabase && !window.sb) {
    window.sb = window.supabase.createClient(
        'https://rjjhuugtwwimsijnmvwy.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqamh1dWd0d3dpbXNpam5tdnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjE5MDksImV4cCI6MjA5ODA5NzkwOX0.1Dl5E5yD_hQOR1CWNAgORqRRuV88jPG6NkY7IfWacO0'
    );
}

// Helper: get current session
window.getSession = function() {
    if (!window.sb) return Promise.resolve(null);
    return window.sb.auth.getSession().then(function(result) {
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
    if (!window.sb) return Promise.resolve(null);
    return window.sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectTo || window.location.origin + window.location.pathname
        }
    });
};

// Helper: sign out
window.signOut = function() {
    if (!window.sb) return Promise.resolve(null);
    return window.sb.auth.signOut();
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
    if (!window.sb) return Promise.resolve(false);
    return window.sb
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
        .then(function(result) {
            return result.data !== null;
        });
};
