/* ================================================
   Writing Desk — main.js
   ================================================ */

// ── Scroll-triggered fade animations ────────────
(function() {
  'use strict';
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.scroll-fade').forEach(function(el) {
    observer.observe(el);
  });
})();

// ── Vertical story line ──────────────────────────
// Measures the features container and draws the SVG
// line progressively as the user scrolls through it.
(function() {
  var container = document.getElementById('features-line-container');
  var svg       = document.getElementById('storyLine');
  var path      = document.getElementById('storyPath');
  if (!container || !svg || !path) return;

  var totalLength = 0;

  function init() {
    // Size the SVG to sit exactly over the container
    var h = container.offsetHeight;
    svg.setAttribute('viewBox', '0 0 120 ' + h);
    svg.style.height = h + 'px';
    svg.style.top    = '0px';

    // Regenerate path to match real height
    var pts = buildPath(h);
    path.setAttribute('d', pts.d);

    totalLength = path.getTotalLength();
    path.style.strokeDasharray  = totalLength;
    path.style.strokeDashoffset = totalLength;

    // Position node circles
    positionNodes(pts.nodes, h);
  }

  function buildPath(h) {
    // Five feature blocks — nodes at 20%, 36%, 52%, 68%, 84%
    var pcts  = [0.20, 0.36, 0.52, 0.68, 0.84];
    var nodeY = pcts.map(function(p) { return Math.round(p * h); });

    // Build a smooth meander: alternates left/right of centre
    var cx = 60;
    var amp = 28; // how far it swings left/right
    var segments = ['M ' + cx + ',0'];
    var prev = 0;

    for (var i = 0; i < nodeY.length; i++) {
      var y    = nodeY[i];
      var side = (i % 2 === 0) ? (cx - amp) : (cx + amp);
      var mid  = Math.round((prev + y) / 2);
      segments.push('C ' + cx + ',' + (prev + 40) + ' ' + side + ',' + (mid - 20) + ' ' + side + ',' + y);
      prev = y;
    }
    // Tail to end
    segments.push('C ' + (prev % 2 === 0 ? cx - amp : cx + amp) + ',' + (prev + 40) + ' ' + cx + ',' + (h - 40) + ' ' + cx + ',' + h);

    return { d: segments.join(' '), nodes: nodeY };
  }

  function positionNodes(nodeY, h) {
    var circles = svg.querySelectorAll('circle');
    var pairs   = [];
    for (var i = 0; i < circles.length; i += 2) {
      pairs.push([circles[i], circles[i + 1]]);
    }
    pairs.forEach(function(pair, i) {
      if (!nodeY[i]) return;
      // Get actual x position at this point along the path
      // Approximate: walk the path to find y ≈ nodeY[i]
      var point = getPathPointAtY(path, nodeY[i], h);
      pair.forEach(function(c) {
        if (c) {
          c.setAttribute('cx', point.x.toFixed(1));
          c.setAttribute('cy', nodeY[i]);
        }
      });
    });
  }

  function getPathPointAtY(pathEl, targetY, totalH) {
    // Sample the path at many points to find closest to targetY
    var len     = pathEl.getTotalLength();
    var samples = 200;
    var best    = { x: 60, y: targetY, dist: Infinity };
    for (var i = 0; i <= samples; i++) {
      var pt = pathEl.getPointAtLength((i / samples) * len);
      var d  = Math.abs(pt.y - targetY);
      if (d < best.dist) { best = { x: pt.x, y: pt.y, dist: d }; }
    }
    return best;
  }

  // ── Scroll-driven draw ─────────────────────────
  function onScroll() {
    if (!container || totalLength === 0) return;
    var rect     = container.getBoundingClientRect();
    var winH     = window.innerHeight;
    var total    = container.offsetHeight + winH;
    var scrolled = winH - rect.top; // how far we've scrolled into the element
    var progress = Math.max(0, Math.min(1, scrolled / total));
    path.style.strokeDashoffset = totalLength * (1 - progress);
  }

  // Debounce resize
  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() { init(); onScroll(); }, 120);
  });

  window.addEventListener('scroll', onScroll, { passive: true });

  // Init on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); onScroll(); });
  } else {
    // Small delay lets layout settle
    setTimeout(function() { init(); onScroll(); }, 60);
  }

})();

// ── Billing toggle (pricing page) ───────────────
function setBilling(mode) {
  var body       = document.body;
  var btnMonthly = document.getElementById('btn-monthly');
  var btnAnnual  = document.getElementById('btn-annual');
  if (!btnMonthly) return;

  if (mode === 'annual') {
    body.classList.add('annual');
    btnAnnual.classList.add('active');
    btnMonthly.classList.remove('active');
  } else {
    body.classList.remove('annual');
    btnMonthly.classList.add('active');
    btnAnnual.classList.remove('active');
  }
}

// ── Blog post table of contents ──────────────────
// Builds the sidebar's "On this page" list from whatever h2/h3s
// actually exist in the post — nothing to maintain per post. The
// card stays hidden (see post.html) until this confirms there's
// something to show, so short posts with no subheadings don't get
// an empty box.
(function() {
  var content = document.querySelector('.post-content');
  var tocCard = document.getElementById('post-toc-card');
  var tocList = document.getElementById('post-toc-list');
  if (!content || !tocCard || !tocList) return;

  var headings = content.querySelectorAll('h2, h3');
  if (headings.length === 0) return;

  var usedIds = {};
  headings.forEach(function(h) {
    if (!h.id) {
      var slug = h.textContent.toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
      var id = slug || 'section';
      var i = 2;
      while (usedIds[id]) { id = slug + '-' + i; i++; }
      usedIds[id] = true;
      h.id = id;
    }
    var link = document.createElement('a');
    link.href = '#' + h.id;
    link.textContent = h.textContent;
    if (h.tagName === 'H3') link.className = 'post-toc-sub';
    tocList.appendChild(link);
  });

  tocCard.style.display = '';
})();

// ── Download page tabs ───────────────────────────
function setDownloadTab(tab) {
  var btnDesktop   = document.getElementById('dl-tab-btn-desktop');
  var btnFormatter = document.getElementById('dl-tab-btn-formatter');
  var panelDesktop   = document.getElementById('dl-tab-desktop-panel');
  var panelFormatter = document.getElementById('dl-tab-formatter-panel');
  if (!btnDesktop) return;

  var showDesktop = tab !== 'formatter';
  btnDesktop.classList.toggle('active', showDesktop);
  btnFormatter.classList.toggle('active', !showDesktop);
  panelDesktop.style.display   = showDesktop ? '' : 'none';
  panelFormatter.style.display = showDesktop ? 'none' : '';
}

// ── Annual pricing visibility ────────────────────
// Show/hide annual vs monthly price spans
(function() {
  var style = document.createElement('style');
  style.textContent = [
    '.annual-price { display: none; }',
    '.monthly-price { display: block; }',
    'body.annual .annual-price { display: block !important; }',
    'body.annual .monthly-price { display: none !important; }'
  ].join('\n');
  document.head.appendChild(style);
})();
