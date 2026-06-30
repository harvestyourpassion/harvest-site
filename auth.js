// Supabase Auth Configuration for Harvest Your Passion
// Project: rjjhuugtwwimsijnmvwy (Garden / Harvest Your Passion)
var SUPABASE_URL = 'https://rjjhuugtwwimsijnmvwy.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqamh1dWd0d3dpbXNpam5tdnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjE5MDksImV4cCI6MjA5ODA5NzkwOX0.1Dl5E5yD_hQOR1CWNAgORqRRuV88jPG6NkY7IfWacO0';

var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check auth state on page load
function checkAuth() {
    supabaseClient.auth.getSession().then(function(result) {
        var session = result.data.session;
        updateAuthUI(session);
    });

    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange(function(_event, session) {
        updateAuthUI(session);
    });
}

// Update the nav auth button based on login state
function updateAuthUI(session) {
    var authSection = document.getElementById('auth-section');
    if (!authSection) return;
    
    if (session) {
        var user = session.user;
        var name = (user.user_metadata && user.user_metadata.full_name) || (user.email ? user.email.split('@')[0] : 'User');
        authSection.innerHTML = '<div class="flex items-center space-x-3">' +
            '<span class="text-sm text-gray-300 hidden sm:inline">Hi, ' + name + '</span>' +
            '<button onclick="logout()" class="border border-gray-600 hover:border-red-500 text-white hover:text-red-400 px-3 py-1.5 rounded-full text-sm transition-colors">Sign Out</button>' +
            '</div>';
    } else {
        authSection.innerHTML = '<button onclick="login()" class="border border-gray-600 hover:border-harvest-green text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors">Log In</button>';
    }
}

// Sign in with Google OAuth
function login() {
    supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
            // Always show the Google account chooser.
            queryParams: { prompt: 'select_account' }
        }
    }).then(function(result) {
        if (result.error) console.error('Login error:', result.error.message);
    });
}

// Sign out
function logout() {
    supabaseClient.auth.signOut().then(function(result) {
        if (result.error) console.error('Logout error:', result.error.message);
    });
}

// Initialize on page load
checkAuth();
