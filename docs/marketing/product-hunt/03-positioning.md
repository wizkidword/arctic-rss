# Positioning, landing-page, trust, and measurement plan

## Recommended positioning

**Arctic RSS is a calm, browser-based reader for the sources you choose.**

The landing page already delivers the core message in under ten seconds: “Follow the open web without the noise.” This branch makes **Browse as Guest** the first, visually primary hero CTA; account creation remains immediately adjacent for readers who want to follow, save, and organize sources.

## Audience and promise

- Readers who want direct relationships with publishers, blogs, communities, podcasts, and YouTube feeds.
- Existing RSS users who prefer a hosted browser reader.
- People who want a calmer alternative to algorithmic social feeds.

Promise only a quick, no-account way to explore public sources, then a path to build a personal reading space. Do not position AI as required or central.

## CTA hierarchy

1. **Browse as Guest** → `/guest`
2. **Create account** → `/signup`
3. **Log in** → `/login`

The guest CTA must remain functional after deployment and asset capture. Never replace it with a tracked Product Hunt URL.

## Trust and privacy

- Keep the privacy-policy and terms links visible on public surfaces.
- Keep analytics optional; do not enable, introduce, or claim analytics tracking without the product’s consent mechanism and a confirmed measurement configuration.
- Use only direct `https://arcticrss.com` links on Product Hunt. Use channel-specific UTMs only in external announcements after consent and analytics approval.

## Measurement plan (human approval required)

Track only consented, aggregate launch signals: landing-to-guest start, guest-to-signup, completed signup, first feed added, first follow, and qualitative feedback category. Record UTC date, anonymized session/cohort, event name, and source channel in the post-launch template; do not add an unapproved analytics vendor or collect sensitive reading data for the launch.
