/* ============================================================================
 * assets/wishlist.js
 * Native theme wishlist — hardened + event-delegated build.
 *
 * FIXES / ADDS:
 *  - Live removal: un-hearting a card on the wishlist page removes it from the
 *    screen immediately (no reload).
 *  - Event delegation: one listener on document catches every heart click —
 *    existing, slick slider clones, and AJAX-loaded cards. No re-init needed.
 *  - MutationObserver: hearts inserted after load get their "saved" glow.
 *  - Request hardening: handle validation, wishlist size cap, concurrency- and
 *    time-limited fetches, graceful per-request failure.
 *  - Null-safe: private-mode localStorage, missing elements, bad attributes.
 *  - Vanilla (no jQuery). Backward-compatible globals preserved.
 *
 * REQUIRED MARKUP (already in the theme):
 *  - Heart:        <a button-wishlist data-product-handle="{{ product.handle }}" ...>
 *  - Wishlist page: container with [grid-wishlist] + an element .wishlist-page
 * ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    STORAGE_KEY: 'shopify-wishlist',   // keep — this is what the wishlist page reads
    DELIMITER: ',',
    ACTIVE_CLASS: 'active',
    MAX_ITEMS: 100,                    // cap: stops storage-stuffing -> request floods
    FETCH_CONCURRENCY: 6,              // max simultaneous product-card fetches
    FETCH_TIMEOUT_MS: 10000,           // per-request timeout (ms)
    CARD_VIEW: 'card',                 // /products/HANDLE?view=card
    CLICK_DEBOUNCE_MS: 250,            // ignore accidental double-fires
    HANDLE_RE: /^[a-z0-9]+(?:-[a-z0-9]+)*$/i  // valid Shopify handle only
  };

  var SEL = {
    button: '[button-wishlist]',
    grid: '[grid-wishlist]',
    page: '.wishlist-page',
    // Card wrapper candidates, tried in order for live-removal on the wishlist page.
    cardWrappers: ['.theme-product', '.product-wrapper-class', '.grid__item', '.card', 'li']
  };

  /* ---------------------------------------------------------------- Validation */
  function isValidHandle(h) {
    return typeof h === 'string' &&
           h.length > 0 &&
           h.length <= 255 &&
           CONFIG.HANDLE_RE.test(h);
  }

  /* ------------------------------------------------ Storage (guarded) */
  function readRaw() {
    try { return localStorage.getItem(CONFIG.STORAGE_KEY) || ''; }
    catch (e) { return ''; }
  }

  function writeRaw(value) {
    try {
      if (value) localStorage.setItem(CONFIG.STORAGE_KEY, value);
      else localStorage.removeItem(CONFIG.STORAGE_KEY);
      return true;
    } catch (e) { return false; }
  }

  function getWishlist() {
    var raw = readRaw();
    if (!raw) return [];
    var seen = {}, out = [];
    raw.split(CONFIG.DELIMITER).forEach(function (h) {
      h = (h || '').trim();
      if (!isValidHandle(h)) return;   // drop junk / injected values
      if (seen[h]) return;             // dedupe
      seen[h] = true;
      out.push(h);
    });
    if (out.length > CONFIG.MAX_ITEMS) out = out.slice(0, CONFIG.MAX_ITEMS);
    return out;
  }

  function setWishlist(arr) {
    if (!Array.isArray(arr)) arr = [];
    var seen = {}, clean = [];
    for (var i = 0; i < arr.length && clean.length < CONFIG.MAX_ITEMS; i++) {
      var h = (arr[i] || '').trim();
      if (isValidHandle(h) && !seen[h]) { seen[h] = true; clean.push(h); }
    }
    writeRaw(clean.join(CONFIG.DELIMITER));
    return clean;
  }

  function wishlistContains(h) {
    return isValidHandle(h) && getWishlist().indexOf(h) !== -1;
  }

  // Returns { list, added, valid }
  function toggleInWishlist(h) {
    if (!isValidHandle(h)) return { list: getWishlist(), added: false, valid: false };
    var list = getWishlist();
    var idx = list.indexOf(h);
    var added;
    if (idx === -1) { list.push(h); added = true; }
    else { list.splice(idx, 1); added = false; }
    return { list: setWishlist(list), added: added, valid: true };
  }

  /* ---------------------------------------------- Button state / glow */
  function getHandle(button) {
    if (!button || !button.dataset) return null;
    var h = button.dataset.productHandle;
    return isValidHandle(h) ? h : null;
  }

  function markButton(button) {
    var h = getHandle(button);
    if (!h) return;
    if (wishlistContains(h)) button.classList.add(CONFIG.ACTIVE_CLASS);
    else button.classList.remove(CONFIG.ACTIVE_CLASS);
  }

  function refreshButtons(root) {
    root = root || document;
    if (!root.querySelectorAll) return;
    var buttons = root.querySelectorAll(SEL.button);
    for (var i = 0; i < buttons.length; i++) markButton(buttons[i]);
  }

  function findCard(button) {
    for (var i = 0; i < SEL.cardWrappers.length; i++) {
      var el = button.closest(SEL.cardWrappers[i]);
      if (el) return el;
    }
    return null;
  }

  function setPageState(hasItems) {
    var page = document.querySelector(SEL.page);
    if (!page) return;
    if (hasItems) page.classList.add('wishlist_exists');
    else page.classList.remove('wishlist_exists');
  }

  // Short pulse animation (kept from original, now vanilla — no jQuery needed).
  function playAnimation(button) {
    button.classList.add('loading-wishlist', 'adding-wishlist');
    setTimeout(function () { button.classList.remove('loading-wishlist'); }, 1000);
    setTimeout(function () { button.classList.remove('adding-wishlist'); }, 2000);
  }

  /* ------------------- Delegated click (existing + cloned + AJAX hearts) */
  var lastClickAt = 0;

  document.addEventListener('click', function (e) {
    var button = e.target && e.target.closest ? e.target.closest(SEL.button) : null;
    if (!button) return; // not a wishlist heart — cart/quickview/compare untouched

    if (e.cancelable) e.preventDefault(); // href="javascript:void(0)" anchor

    var now = Date.now();
    if (now - lastClickAt < CONFIG.CLICK_DEBOUNCE_MS) return;
    lastClickAt = now;

    var h = getHandle(button);
    if (!h) {
      if (window.console) console.error('[Wishlist] Missing or invalid data-product-handle.');
      return;
    }

    var result = toggleInWishlist(h);
    if (!result.valid) return;

    // Force class to match real storage state (avoids drift on double events).
    button.classList.toggle(CONFIG.ACTIVE_CLASS, result.added);
    playAnimation(button);

    // Live-remove the card ONLY on the wishlist grid page.
    var grid = button.closest(SEL.grid);
    if (grid && !result.added) {
      var card = findCard(button);
      if (card && grid.contains(card)) card.remove();
      if (!grid.querySelector(SEL.button)) setPageState(false);
    }
  }, false);

  /* ---------------- Wishlist page grid: concurrency- + time-limited fetch */
  function fetchCard(handle) {
    var url = '/products/' + encodeURIComponent(handle) + '?view=' + encodeURIComponent(CONFIG.CARD_VIEW);
    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, CONFIG.FETCH_TIMEOUT_MS) : null;

    var opts = {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    };
    if (controller) opts.signal = controller.signal;

    return fetch(url, opts)
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) return '';
        return res.text();
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        return ''; // skip broken/aborted card, keep the rest working
      });
  }

  // Promise pool: at most `limit` fetches in flight; results keep original order.
  function runPool(handles, limit, onDone) {
    var results = new Array(handles.length);
    var index = 0, active = 0, finished = 0;

    if (handles.length === 0) return onDone(results);

    function launch() {
      while (active < limit && index < handles.length) {
        (function (i) {
          active++;
          fetchCard(handles[i]).then(function (html) {
            results[i] = (typeof html === 'string') ? html : '';
            active--; finished++;
            if (finished === handles.length) onDone(results);
            else launch();
          });
        })(index++);
      }
    }
    launch();
  }

  function setupGrid(grid) {
    var wishlist = getWishlist();

    if (wishlist.length === 0) {
      setPageState(false);
      grid.innerHTML = '';
      return;
    }
    setPageState(true);

    runPool(wishlist, CONFIG.FETCH_CONCURRENCY, function (cards) {
      var html = cards.filter(function (c) { return typeof c === 'string' && c; }).join('');
      grid.innerHTML = html;
      refreshButtons(grid);
      if (!grid.querySelector(SEL.button)) setPageState(false);
    });
  }

  /* ------------- Auto-mark hearts inserted after load (clones / AJAX) */
  function observeNewButtons() {
    if (!('MutationObserver' in window) || !document.body) return;
    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var added = mutations[m].addedNodes;
        for (var i = 0; i < added.length; i++) {
          var node = added[i];
          if (!node || node.nodeType !== 1) continue;
          if (node.matches && node.matches(SEL.button)) markButton(node);
          if (node.querySelectorAll) {
            var inner = node.querySelectorAll(SEL.button);
            for (var j = 0; j < inner.length; j++) markButton(inner[j]);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ------------------------- Backward-compatible globals */
  window.getWishlist = getWishlist;
  window.setWishlist = setWishlist;
  window.wishlistContains = wishlistContains;
  window.updateWishlist = function (h) {
    var r = toggleInWishlist(h);
    refreshButtons(document);
    return r.list.join(CONFIG.DELIMITER);
  };
  window.resetWishlist = function () {
    setWishlist([]);
    refreshButtons(document);
  };
  // Optional helper other scripts can call after injecting cards via AJAX.
  window.ThemeWishlist = {
    get: getWishlist,
    contains: wishlistContains,
    refresh: refreshButtons,
    reset: window.resetWishlist
  };

  /* -------------------------------------------------------------- Init */
  function init() {
    refreshButtons(document);
    var grid = document.querySelector(SEL.grid);
    if (grid) setupGrid(grid);
    observeNewButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();