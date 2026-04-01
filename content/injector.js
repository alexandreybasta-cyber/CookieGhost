/**
 * CookieGhost — Content script injector
 * Runs in ISOLATED world at document_start.
 * Injects the document.cookie override into the MAIN page world.
 */

(function() {
  'use strict';

  const api = typeof browser !== 'undefined' ? browser : chrome;

  // Check if extension is enabled before injecting
  api.runtime.sendMessage({ type: 'getStatus' }).then(response => {
    if (!response || !response.enabled) return;

    injectOverride(response);
  }).catch(() => {
    // Extension might not be ready yet on very early loads — inject with defaults
    injectOverride({ enabled: true });
  });

  function injectOverride(status) {
    // Method 1 (Chrome MV3): Use world: "MAIN" in manifest if supported
    // Method 2 (Firefox / fallback): Inject via script element

    const config = {
      enabled: true,
    };

    // Create a config element the injected script can read
    const configEl = document.createElement('script');
    configEl.id = 'cookieghost-config';
    configEl.type = 'application/json';
    configEl.textContent = JSON.stringify(config);

    // Create the override script element
    const script = document.createElement('script');
    script.src = api.runtime.getURL('content/document-cookie-override.js');

    // Inject at the earliest possible moment
    const target = document.documentElement || document.head || document.body;
    if (target) {
      target.insertBefore(configEl, target.firstChild);
      target.insertBefore(script, configEl.nextSibling);

      // Clean up after injection
      script.addEventListener('load', () => {
        script.remove();
        configEl.remove();
      });
      script.addEventListener('error', () => {
        script.remove();
        configEl.remove();
      });
    }
  }

  // Listen for messages from the background script (e.g., real-time activity updates)
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'statusChanged') {
      // Could re-inject or disable the override, but for simplicity,
      // the override stays active until page reload
      sendResponse({ received: true });
    }
  });
})();
