// Cloudflare Pages Function
// Two independent edge rewrites live in this one middleware:
//
// 1. /pricing — serves USD pricing to visitors outside the UK, using
//    CF-IPCountry at the edge. No client-side flash, no external
//    geolocation API. Every price on pricing.html is tagged with a
//    data-usd="$X" attribute alongside its existing £ text. A manual
//    override is supported via ?currency=usd or ?currency=gbp, which
//    sets a cookie so the choice sticks on future visits (handles VPNs,
//    UK expats browsing from abroad, etc).
//
// 2. /download — reweights the hero and default tab toward Mac or
//    Formatter depending on the visitor's OS, read from User-Agent at
//    the edge rather than client-side JS, for the same "no flash"
//    reason as the currency rewrite above. Both hero variants and both
//    tab panels are always present in the HTML; this only decides
//    which starts visible using the same ShowElement/HideElement
//    pattern as the currency toggle. No cookie/override here — unlike
//    currency, OS is unambiguous from User-Agent, so there's nothing
//    to remember across visits.

const CURRENCY_COOKIE = 'wd_currency';

class AttributeSwap {
  constructor(attr) {
    this.attr = attr;
  }
  element(el) {
    const value = el.getAttribute(this.attr);
    if (value !== null) {
      el.setInnerContent(value, { html: true });
    }
  }
}

class SetText {
  constructor(text) {
    this.text = text;
  }
  element(el) {
    el.setInnerContent(this.text, { html: false });
  }
}

class ShowElement {
  element(el) {
    el.removeAttribute('style');
  }
}

class HideElement {
  element(el) {
    el.setAttribute('style', 'display:none');
  }
}

class AddClass {
  constructor(cls) {
    this.cls = cls;
  }
  element(el) {
    const existing = el.getAttribute('class') || '';
    if (!existing.split(/\s+/).includes(this.cls)) {
      el.setAttribute('class', (existing + ' ' + this.cls).trim());
    }
  }
}

class RemoveClass {
  constructor(cls) {
    this.cls = cls;
  }
  element(el) {
    const existing = el.getAttribute('class') || '';
    el.setAttribute('class', existing.split(/\s+/).filter(c => c !== this.cls).join(' '));
  }
}

function getCookieCurrency(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)wd_currency=(usd|gbp)/);
  return match ? match[1] : null;
}

function isPricingPage(pathname) {
  const stripped = pathname.replace(/\/+$/, '') || '/';
  return (
    stripped === '/pricing' ||
    stripped === '/pricing.html' ||
    stripped === '/pricing/index.html'
  );
}

function isDownloadPage(pathname) {
  const stripped = pathname.replace(/\/+$/, '') || '/';
  return (
    stripped === '/download' ||
    stripped === '/download.html' ||
    stripped === '/download/index.html'
  );
}

// Simple substring check on User-Agent — every desktop macOS browser
// (Safari, Chrome, Firefox, Edge) includes "Macintosh" in its UA
// string. Not trying to distinguish iPad/iPhone here since Safari on
// iPadOS can report as "Macintosh" too depending on settings; that's
// fine, an iPad visitor seeing the Mac-download hero and choosing
// "Not on a Mac? See your options" one click away is a minor cost,
// far better than a false negative sending a real Mac user to
// Formatter first.
function isMacUserAgent(request) {
  const ua = request.headers.get('User-Agent') || '';
  return /Macintosh/i.test(ua);
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (isPricingPage(url.pathname)) {
    return handlePricingPage(context, url);
  }
  if (isDownloadPage(url.pathname)) {
    return handleDownloadPage(context, url);
  }
  return next();
}

async function handlePricingPage(context, url) {
  const { request, next } = context;

  // Explicit override: ?currency=usd or ?currency=gbp sets a cookie and
  // redirects to the clean URL.
  const override = url.searchParams.get('currency');
  if (override === 'usd' || override === 'gbp') {
    url.searchParams.delete('currency');
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        'Set-Cookie': `${CURRENCY_COOKIE}=${override}; Path=/; Max-Age=31536000; SameSite=Lax`,
      },
    });
  }

  const response = await next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const cookieCurrency = getCookieCurrency(request);
  const country = request.headers.get('CF-IPCountry');
  const currency = cookieCurrency || (country === 'GB' ? 'gbp' : 'usd');

  if (currency === 'gbp') {
    return response;
  }

  // Anything unexpected here (a malformed selector match, an element
  // handler throwing, etc.) falls back to the original GBP response
  // rather than crashing the whole page with a 1101. Awaiting .text()
  // here -- rather than streaming the body straight through -- is what
  // makes this try/catch actually effective: HTMLRewriter normally
  // transforms lazily as the response streams to the browser, which
  // happens after this function would otherwise have already returned,
  // so a plain try/catch around .transform() alone wouldn't catch
  // errors thrown inside the element handlers above.
  try {
    const rewritten = new HTMLRewriter()
      .on('[data-usd]', new AttributeSwap('data-usd'))
      .on('#currency-note-text', new SetText('Prices shown in USD ($).'))
      .on('#currency-toggle-usd', new HideElement())
      .on('#currency-toggle-gbp', new ShowElement())
      .transform(response.clone());

    const html = await rewritten.text();

    const headers = new Headers(rewritten.headers);
    headers.set('Cache-Control', 'private, no-store');

    return new Response(html, {
      status: rewritten.status,
      statusText: rewritten.statusText,
      headers,
    });
  } catch (err) {
    return response;
  }
}

async function handleDownloadPage(context, url) {
  const { next } = context;
  const response = await next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  // Default assumption is Mac — most visitors to a page called
  // /download who don't announce another OS are still more likely to
  // be on Safari/Chrome/Firefox on a Mac than not, and it's the
  // cheaper mistake: a wrongly-Mac'd non-Mac visitor sees one extra
  // click ("Not on a Mac?"), while a wrongly-non-Mac'd real Mac
  // visitor would otherwise land on a Formatter pitch by default.
  const isMac = isMacUserAgent(context.request);
  if (isMac) {
    return response;
  }

  try {
    const rewritten = new HTMLRewriter()
      .on('#dl-hero-mac', new HideElement())
      .on('#dl-hero-other', new ShowElement())
      .on('#dl-tab-desktop-panel', new HideElement())
      .on('#dl-tab-formatter-panel', new ShowElement())
      .on('#dl-tab-btn-desktop', new RemoveClass('active'))
      .on('#dl-tab-btn-formatter', new AddClass('active'))
      .transform(response.clone());

    const html = await rewritten.text();

    const headers = new Headers(rewritten.headers);
    headers.set('Cache-Control', 'private, no-store');

    return new Response(html, {
      status: rewritten.status,
      statusText: rewritten.statusText,
      headers,
    });
  } catch (err) {
    return response;
  }
}