// Cloudflare Pages Function
// Serves USD pricing to visitors outside the UK on /pricing, using CF-IPCountry
// at the edge. No client-side flash, no external geolocation API.
//
// How it works:
// 1. Every price on pricing.html is tagged with a data-usd="$X" attribute
//    alongside its existing £ text (see pricing.html for the tagged elements).
// 2. This function reads Cloudflare's CF-IPCountry header. If the visitor is
//    not in GB, it rewrites those elements' text to the USD value server-side
//    using HTMLRewriter, before the response ever reaches the browser.
// 3. A manual override is supported via ?currency=usd or ?currency=gbp, which
//    sets a cookie so the choice sticks on future visits (handles VPNs, UK
//    expats browsing from abroad, etc).

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

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (!isPricingPage(url.pathname)) {
    return next();
  }

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