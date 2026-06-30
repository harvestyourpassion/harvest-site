// shared/pwa.js - Service worker registration
// Decision (Leo, June 30 2026): no offline mode. SW only enables install + push.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/service-worker.js').catch(function (err) {
            console.warn('Service worker registration failed:', err);
        });
    });
}
