// =============================================================================
// config.js — Un-Doomed shared client configuration.
// Loaded by popup.html and options.html (before their own scripts) AND imported
// by the background service worker (background.js) via importScripts, so it is
// the single source of truth for where the backend lives.
// =============================================================================
//
//  ┌───────────────────────────────────────────────────────────────────────┐
//  │  >>> EDIT THIS ONE LINE WHEN YOU DEPLOY YOUR BACKEND <<<                 │
//  │                                                                         │
//  │  Local development : http://127.0.0.1:8000                              │
//  │  Production example: https://undoomed-backend.onrender.com              │
//  └───────────────────────────────────────────────────────────────────────┘
// Use globalThis (not window) so this works in a page AND in the service
// worker. In a page, globalThis === window, so window.UNDOOMED_API_BASE_URL
// still resolves for popup.js / options.js.
globalThis.UNDOOMED_API_BASE_URL = "https://undoomed.onrender.com";
//
// IMPORTANT: whatever origin you point this at must ALSO be listed in
// "host_permissions" in manifest.json, or the browser will block the request.
// Render (*.onrender.com) and Railway (*.up.railway.app) are already included
// there; add your own custom domain if you use one.
// =============================================================================
