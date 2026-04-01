/**
 * CookieGhost — Cross-browser API compatibility layer
 */

const _bcApi = typeof browser !== 'undefined' ? browser : chrome;

const CookieGhostBrowser = {
  cookies: {
    getAll: (details) => _bcApi.cookies.getAll(details),
    set: (details) => _bcApi.cookies.set(details),
    remove: (details) => _bcApi.cookies.remove(details),
    onChanged: _bcApi.cookies.onChanged,
  },
  storage: {
    local: {
      get: (keys) => _bcApi.storage.local.get(keys),
      set: (items) => _bcApi.storage.local.set(items),
    },
    session: {
      get: (keys) => {
        if (_bcApi.storage.session) {
          return _bcApi.storage.session.get(keys);
        }
        return _bcApi.storage.local.get(keys);
      },
      set: (items) => {
        if (_bcApi.storage.session) {
          return _bcApi.storage.session.set(items);
        }
        return _bcApi.storage.local.set(items);
      },
    },
  },
  runtime: {
    sendMessage: (msg) => _bcApi.runtime.sendMessage(msg),
    onMessage: _bcApi.runtime.onMessage,
    getURL: (path) => _bcApi.runtime.getURL(path),
  },
  tabs: {
    query: (q) => _bcApi.tabs.query(q),
    sendMessage: (tabId, msg) => _bcApi.tabs.sendMessage(tabId, msg),
  },
  webRequest: _bcApi.webRequest || null,
  declarativeNetRequest: _bcApi.declarativeNetRequest || null,
  alarms: _bcApi.alarms || null,
  isFirefox: typeof browser !== 'undefined',
  isChrome: typeof chrome !== 'undefined' && typeof browser === 'undefined',
};

// Make available both as module export and global
if (typeof globalThis !== 'undefined') {
  globalThis.CookieGhostBrowser = CookieGhostBrowser;
}

try {
  // ES module export for Chrome MV3
  if (typeof exports !== 'undefined') {
    exports.CookieGhostBrowser = CookieGhostBrowser;
  }
} catch (e) {
  // Not in a module context
}
