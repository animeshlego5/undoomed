// =============================================================================
// config.js — Un-doomed shared client configuration.
// Loaded by BOTH popup.html and options.html (before their own scripts), so it
// is the single source of truth for where the backend lives.
// =============================================================================
//
//  ┌───────────────────────────────────────────────────────────────────────┐
//  │  >>> EDIT THIS ONE LINE WHEN YOU DEPLOY YOUR BACKEND <<<                 │
//  │                                                                         │
//  │  Local development : http://127.0.0.1:8000                              │
//  │  Production example: https://undoomed-backend.onrender.com              │
//  └───────────────────────────────────────────────────────────────────────┘
window.UNDOOMED_API_BASE_URL = "https://undoomed.onrender.com";
//
// IMPORTANT: whatever origin you point this at must ALSO be listed in
// "host_permissions" in manifest.json, or the browser will block the request.
// Render (*.onrender.com) and Railway (*.up.railway.app) are already included
// there; add your own custom domain if you use one.
// =============================================================================
