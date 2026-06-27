// Coaching Client Utilities
// Used by coaching pages on harvest-your-passion.netlify.app/coaching/

// Coach ID for Leandro (from coaches table)
var COACH_ID = null;

// Get the coach record (there's currently one coach)
async function getCoachId() {
  if (COACH_ID) return COACH_ID;
  var result = await window.sb.from('coaches').select('id').limit(1).single();
  if (result.data) COACH_ID = result.data.id;
  return COACH_ID;
}

// Ensure a client record exists for the authenticated user
async function ensureClientForUser(user) {
  if (!user || !user.email) return null;
  
  var coachId = await getCoachId();
  if (!coachId) return null;
  
  // Check if client exists by user_id or email
  var existing = await window.sb.from('clients')
    .select('id')
    .or('user_id.eq.' + user.id + ',email.eq.' + user.email)
    .limit(1);
  
  if (existing.data && existing.data.length > 0) {
    // Update user_id if not set (backfill)
    var clientId = existing.data[0].id;
    await window.sb.from('clients').update({ user_id: user.id }).eq('id', clientId).is('user_id', null);
    return clientId;
  }
  
  // Create new client
  var newClient = await window.sb.from('clients').insert({
    coach_id: coachId,
    name: (user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0],
    email: user.email,
    user_id: user.id,
    status: 'active',
    goals: ['Signed up via website'],
    created_at: new Date().toISOString()
  }).select('id').single();
  
  return newClient.data ? newClient.data.id : null;
}

// Format date for display
function formatDate(dateStr) {
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// Format time for display
function formatTime(dateStr) {
  var d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
