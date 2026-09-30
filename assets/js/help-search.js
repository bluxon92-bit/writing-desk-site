/* Writing Desk Help Centre — accordion, local filter, deep-link, sitewide search */
(function () {
  'use strict';

  var searchCache = null; // { records: [...], index: lunr index }
  var searchPromise = null;

  function loadSearchIndex(url) {
    if (searchPromise) return searchPromise;
    searchPromise = fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Could not load search index');
        return res.json();
      })
      .then(function (records) {
        var index = window.lunr(function () {
          this.ref('idx');
          this.field('q', { boost: 10 });
          this.field('a');
          records.forEach(function (record, i) {
            this.add({ idx: i, q: record.q, a: record.a });
          }, this);
        });
        searchCache = { records: records, index: index };
        return searchCache;
      })
      .catch(function (err) {
        console.error('Help search index failed to load:', err);
        return null;
      });
    return searchPromise;
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function renderResults(container, results, query, contactUrl) {
    if (!results || results.length === 0) {
      container.innerHTML = query
        ? '<div class="help-result-empty">No results for &ldquo;' + escapeHtml(query) + '&rdquo;. Try different words, or <a href="' + contactUrl + '">contact us</a>.</div>'
        : '';
      container.classList.toggle('open', !!query);
      return;
    }
    var html = results.slice(0, 8).map(function (r) {
      return '<a class="help-result-item" href="' + r.url + '">' +
        '<span class="help-result-cat">' + escapeHtml(r.category_name) + '</span>' +
        '<span class="help-result-q">' + escapeHtml(r.q) + '</span>' +
        '</a>';
    }).join('');
    container.innerHTML = html;
    container.classList.add('open');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function initSitewideSearch(inputId, resultsId, opts) {
    opts = opts || {};
    var input = document.getElementById(inputId);
    var results = document.getElementById(resultsId);
    if (!input || !results) return;

    var indexUrl = input.getAttribute('data-index-url');
    var contactUrl = input.getAttribute('data-contact-url') || '/help/contact/';
    if (opts.autofocus) input.focus();

    var runSearch = debounce(function () {
      var query = input.value.trim();
      if (!query) {
        renderResults(results, [], '', contactUrl);
        return;
      }
      loadSearchIndex(indexUrl).then(function (cache) {
        if (!cache) return;
        var matches;
        try {
          matches = cache.index.query(function (q) {
            query.split(/\s+/).forEach(function (term) {
              if (term.length < 2) return;
              q.term(term, { boost: 3 });
              q.term(term, { wildcard: window.lunr.Query.wildcard.TRAILING });
            });
          });
        } catch (e) {
          matches = [];
        }
        var records = matches.map(function (m) { return cache.records[m.ref]; });
        renderResults(results, records, query, contactUrl);
      });
    }, 120);

    input.addEventListener('input', runSearch);
    input.addEventListener('focus', function () {
      if (input.value.trim()) runSearch();
    });
    document.addEventListener('click', function (e) {
      if (!results.contains(e.target) && e.target !== input) {
        results.classList.remove('open');
      }
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        results.classList.remove('open');
        input.blur();
      }
    });
  }

  function initAccordion(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.help-item-q').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.help-item');
        var isOpen = item.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen);
      });
    });
  }

  function initLocalFilter(inputId, containerId, noResultsId) {
    var input = document.getElementById(inputId);
    var container = document.getElementById(containerId);
    var noResults = document.getElementById(noResultsId);
    if (!input || !container) return;

    input.addEventListener('input', function () {
      var query = input.value.trim().toLowerCase();
      var items = container.querySelectorAll('.help-item');
      var visibleCount = 0;
      items.forEach(function (item) {
        var haystack = item.getAttribute('data-search') || '';
        var match = !query || haystack.indexOf(query) !== -1;
        item.hidden = !match;
        if (match) visibleCount++;
      });
      if (noResults) noResults.hidden = visibleCount > 0;
    });
  }

  function openFromHash(containerId) {
    var id = window.location.hash.replace('#', '');
    if (!id) return;
    var item = document.getElementById(id);
    if (!item || !item.classList.contains('help-item')) return;
    item.classList.add('open');
    var btn = item.querySelector('.help-item-q');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      item.classList.add('flash');
      setTimeout(function () { item.classList.remove('flash'); }, 1600);
    }, 80);
  }

  window.WDHelp = {
    initSitewideSearch: initSitewideSearch,
    initAccordion: initAccordion,
    initLocalFilter: initLocalFilter,
    openFromHash: openFromHash
  };
})();
