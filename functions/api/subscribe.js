// /functions/api/subscribe.js
//
// Cloudflare Pages Function — proxies email signups to EmailOctopus.
// Keeps the API key server-side (never exposed to the browser).
//
// EmailOctopus now runs on a single shared Contacts pool per account
// (no more per-purpose lists). Every signup goes into that one list,
// tagged by source (sci-fi-download / horror-download / waitlist).
// Each automation is filtered on its matching tag, so only the right
// contacts trigger the right welcome email — this is EmailOctopus's own
// documented pattern for "different automations from different sources":
// https://help.emailoctopus.com/article/384
//
// Usage from client JS:
//   fetch('/api/subscribe', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ email, source })   // source e.g. 'waitlist'
//   })
//
// Setup required in Cloudflare Pages dashboard:
//   Settings > Environment variables > add:
//     EMAILOCTOPUS_API_KEY   your API key
//     EMAILOCTOPUS_LIST_ID   your single Contacts list ID (find it in the
//                            URL when viewing Contacts in EmailOctopus)
//
// In EmailOctopus, create the three tags below (sci-fi-download,
// horror-download, waitlist) and build one automation per tag:
// trigger "Contact subscribed" -> filter "Tags > has tag > <that tag>".
//
// "source" is passed from the client (not secret — it just says which
// form was submitted) but only keys in ALLOWED_TAGS are accepted, so a
// request can't be crafted to apply an arbitrary tag.
//
// Note: if someone who already subscribed via one form later submits a
// different form on the site (e.g. grabs the sci-fi PDF, then later joins
// the waitlist), EmailOctopus's "already a member" response is treated as
// a success here, but the new tag isn't retroactively applied. A future
// improvement would look them up and add the second tag; not implemented
// yet since it adds real complexity for an edge case that likely affects
// very few people early on.

const ALLOWED_TAGS = {
  'sci-fi-download': 'sci-fi-download',
  'horror-download': 'horror-download',
  'waitlist': 'waitlist',
};

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ success: false, message: 'Invalid request.' }, 400);
  }

  const email = (body.email || '').trim();
  const sourceKey = body.source || body.listId; // listId kept as a fallback alias for older client code
  const firstName = (body.firstName || '').trim();

  if (!email || !isValidEmail(email)) {
    return json({ success: false, message: 'Please enter a valid email address.' }, 400);
  }

  const tag = ALLOWED_TAGS[sourceKey];
  if (!tag) {
    return json({ success: false, message: 'Signup is not configured for this form yet.' }, 500);
  }

  const apiKey = env.EMAILOCTOPUS_API_KEY;
  const listId = env.EMAILOCTOPUS_LIST_ID;
  if (!apiKey || !listId) {
    return json({ success: false, message: 'Server is not configured.' }, 500);
  }

  const eoRes = await fetch(`https://emailoctopus.com/api/1.6/lists/${listId}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      email_address: email,
      fields: firstName ? { FirstName: firstName } : undefined,
      tags: [tag],
      status: 'SUBSCRIBED',
    }),
  });

  const eoData = await eoRes.json().catch(() => ({}));

  if (!eoRes.ok) {
    const code = eoData && eoData.error && eoData.error.code;
    if (code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
      // See note above: treated as success, tag not retroactively re-applied.
      return json({ success: true, message: 'Already subscribed.' });
    }
    return json({ success: false, message: 'Something went wrong. Please try again.' }, 502);
  }

  return json({ success: true });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}